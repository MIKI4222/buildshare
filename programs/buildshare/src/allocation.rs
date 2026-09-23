use crate::errors::BuildshareError;
use crate::state::{Contribution, ContributionStatus, Member, Project, Task, TaskStatus};
use anchor_lang::prelude::*;

/// P1 STEP 3: the ownership accounting core.
///
/// Kept as a pure function over the four accounts so that every branch of the
/// matrix can be exercised by `cargo test` without a validator, and so that the
/// instruction handler contains no arithmetic of its own.
///
/// FROZEN BEHAVIOUR (DESIGN FREEZE v1.2):
/// - `committed_bps -= reward`, `allocated_bps += reward`. `remaining_bps` is
///   never stored, only derived.
/// - `task.reserved_committed` stays `true`. It records that this task already
///   consumed its single reservation; allocation moves the reward from
///   committed to allocated, it does not hand the reservation back.
/// - Double allocation is blocked by the `contribution.allocated` latch and,
///   independently, by `task.status` no longer being `Submitted`.
/// - Every write happens after every check. A failing check returns an error,
///   the transaction is rolled back and no account is partially updated.
pub struct AllocationOutcome {
    pub reward_bps: u16,
    pub project_committed_bps: u16,
    pub project_allocated_bps: u16,
    pub member_ownership_bps: u16,
}

pub fn apply_allocation(
    project: &mut Project,
    task: &mut Task,
    contribution: &mut Contribution,
    member: &mut Member,
) -> Result<AllocationOutcome> {
    // ---- relational checks (stored fields, independent of the Anchor context)
    require!(
        member.project == task.project,
        BuildshareError::InvalidProject
    );
    require!(
        contribution.attempt == task.attempt,
        BuildshareError::InvalidAttempt
    );
    require!(
        task.contributor == Some(contribution.contributor),
        BuildshareError::InvalidContributor
    );
    require!(
        member.wallet == contribution.contributor,
        BuildshareError::InvalidMember
    );

    // ---- state machine checks
    // NOTE: TaskStatus has no `Approved` variant and none was added. Approval
    // lives on the CONTRIBUTION (`ContributionStatus::Approved`); the task
    // stays `Submitted` until allocation moves it to `Completed`.
    require!(
        task.status == TaskStatus::Submitted,
        BuildshareError::InvalidTaskTransition
    );
    require!(
        contribution.status == ContributionStatus::Approved,
        BuildshareError::InvalidContributionTransition
    );
    require!(!contribution.allocated, BuildshareError::DoubleAllocation);

    // ---- accounting checks
    let reward = task.reward_bps;
    require!(reward > 0, BuildshareError::InvalidBps);
    require!(task.reserved_committed, BuildshareError::NoCommitment);

    let committed = project
        .committed_bps
        .checked_sub(reward)
        .ok_or_else(|| error!(BuildshareError::ArithmeticUnderflow))?;
    let allocated = project
        .allocated_bps
        .checked_add(reward)
        .ok_or_else(|| error!(BuildshareError::ArithmeticOverflow))?;
    let ownership = member
        .ownership_bps
        .checked_add(reward)
        .ok_or_else(|| error!(BuildshareError::ArithmeticOverflow))?;
    let allocation_count = member
        .allocation_count
        .checked_add(1)
        .ok_or_else(|| error!(BuildshareError::ArithmeticOverflow))?;

    require!(
        allocated <= project.dev_pool_bps,
        BuildshareError::InvariantViolation
    );
    let used = committed
        .checked_add(allocated)
        .ok_or_else(|| error!(BuildshareError::ArithmeticOverflow))?;
    require!(
        used <= project.dev_pool_bps,
        BuildshareError::InvariantViolation
    );
    require!(
        ownership <= project.dev_pool_bps,
        BuildshareError::InvariantViolation
    );

    // ---- writes: only now, after every check above passed
    project.committed_bps = committed;
    project.allocated_bps = allocated;
    member.ownership_bps = ownership;
    member.allocation_count = allocation_count;
    contribution.status = ContributionStatus::Settled;
    contribution.allocated = true;
    task.status = TaskStatus::Completed;
    // task.reserved_committed intentionally left true.

    project.assert_invariants()?;

    Ok(AllocationOutcome {
        reward_bps: reward,
        project_committed_bps: project.committed_bps,
        project_allocated_bps: project.allocated_bps,
        member_ownership_bps: member.ownership_bps,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn project(founder: Pubkey) -> Project {
        Project {
            founder,
            project_id: 1,
            founder_bps: 4_000,
            dev_pool_bps: 6_000,
            committed_bps: 0,
            allocated_bps: 0,
            task_count: 0,
            member_count: 0,
            bump: 255,
            reserved: [0u8; 32],
        }
    }

    /// A task in exactly the state `approve_contribution` leaves behind:
    /// claimed, submitted, reserved once, attempt N.
    fn task(project_key: Pubkey, contributor: Pubkey, reward: u16, attempt: u8) -> Task {
        Task {
            project: project_key,
            task_id: 1,
            status: TaskStatus::Submitted,
            reward_bps: reward,
            attempt,
            contributor: Some(contributor),
            claimed_at: 1_700_000_000,
            claim_expires_at: 1_700_604_800,
            acceptance_criteria_hash: [1u8; 32],
            repo_ref_hash: [2u8; 32],
            commitment_hash: [3u8; 32],
            reserved_committed: true,
            bump: 255,
        }
    }

    fn contribution(task_key: Pubkey, contributor: Pubkey, attempt: u8) -> Contribution {
        Contribution {
            task: task_key,
            contributor,
            attempt,
            status: ContributionStatus::Approved,
            commitment_hash: [3u8; 32],
            evidence_hash: [4u8; 32],
            reject_reason_hash: [0u8; 32],
            approved_at: 1_700_100_000,
            rejected_at: 0,
            allocated: false,
            bump: 255,
        }
    }

    fn member(project_key: Pubkey, wallet: Pubkey) -> Member {
        Member {
            project: project_key,
            wallet,
            ownership_bps: 0,
            allocation_count: 0,
            bump: 255,
        }
    }

    struct World {
        project: Project,
        task: Task,
        contribution: Contribution,
        member: Member,
    }

    /// Reward already reserved at claim time, as `claim_task` would have done.
    fn world(reward: u16, attempt: u8) -> World {
        let founder = Pubkey::new_unique();
        let project_key = Pubkey::new_unique();
        let task_key = Pubkey::new_unique();
        let contributor = Pubkey::new_unique();
        let mut p = project(founder);
        p.committed_bps = reward;
        World {
            project: p,
            task: task(project_key, contributor, reward, attempt),
            contribution: contribution(task_key, contributor, attempt),
            member: member(project_key, contributor),
        }
    }

    fn run(w: &mut World) -> Result<AllocationOutcome> {
        apply_allocation(
            &mut w.project,
            &mut w.task,
            &mut w.contribution,
            &mut w.member,
        )
    }

    // A. Basic allocation.
    #[test]
    fn a_basic_allocation_moves_committed_into_allocated() {
        let mut w = world(1_000, 1);
        let out = run(&mut w).unwrap();

        assert_eq!(out.reward_bps, 1_000);
        assert_eq!(w.member.ownership_bps, 1_000);
        assert_eq!(w.member.allocation_count, 1);
        assert_eq!(w.project.committed_bps, 0);
        assert_eq!(w.project.allocated_bps, 1_000);
        assert_eq!(w.project.remaining_bps().unwrap(), 5_000);
        assert_eq!(w.contribution.status, ContributionStatus::Settled);
        assert!(w.contribution.allocated);
        assert_eq!(w.task.status, TaskStatus::Completed);
        assert!(w.task.reserved_committed);
    }

    // B + J. Double allocation is impossible and changes nothing.
    #[test]
    fn b_second_allocation_fails_and_leaves_accounting_untouched() {
        let mut w = world(1_000, 1);
        run(&mut w).unwrap();

        let before = (
            w.project.committed_bps,
            w.project.allocated_bps,
            w.member.ownership_bps,
            w.member.allocation_count,
        );
        assert!(run(&mut w).is_err());
        assert_eq!(
            before,
            (
                w.project.committed_bps,
                w.project.allocated_bps,
                w.member.ownership_bps,
                w.member.allocation_count,
            )
        );
    }

    // C. Retry after rejection: attempt 2, committed still one reward.
    #[test]
    fn c_retry_after_rejection_never_double_reserves() {
        let mut w = world(1_000, 2);
        assert_eq!(w.project.committed_bps, 1_000, "retry must not reserve twice");

        run(&mut w).unwrap();

        assert_eq!(w.project.committed_bps, 0);
        assert_eq!(w.project.allocated_bps, 1_000);
        assert_eq!(w.member.ownership_bps, 1_000);
    }

    // D. Member accumulation across two tasks: 1000 + 500 = 1500.
    #[test]
    fn d_member_ownership_accumulates_across_tasks() {
        let mut w = world(1_000, 1);
        run(&mut w).unwrap();

        // Second task of the same project, same contributor, same Member account.
        let mut task2 = task(w.task.project, w.member.wallet, 500, 1);
        let mut contribution2 = contribution(Pubkey::new_unique(), w.member.wallet, 1);
        w.project.committed_bps = 500; // reserved by claim of task 2

        apply_allocation(
            &mut w.project,
            &mut task2,
            &mut contribution2,
            &mut w.member,
        )
        .unwrap();

        assert_eq!(w.member.ownership_bps, 1_500);
        assert_eq!(w.member.allocation_count, 2);
        assert_eq!(w.project.committed_bps, 0);
        assert_eq!(w.project.allocated_bps, 1_500);
    }

    // E. Two contributors keep separate Member accounts.
    #[test]
    fn e_different_contributors_get_separate_ownership() {
        let mut w = world(1_000, 1);
        run(&mut w).unwrap();

        let contributor_b = Pubkey::new_unique();
        let mut task_b = task(w.task.project, contributor_b, 500, 1);
        let mut contribution_b = contribution(Pubkey::new_unique(), contributor_b, 1);
        let mut member_b = member(w.task.project, contributor_b);
        w.project.committed_bps = 500;

        apply_allocation(
            &mut w.project,
            &mut task_b,
            &mut contribution_b,
            &mut member_b,
        )
        .unwrap();

        assert_eq!(w.member.ownership_bps, 1_000);
        assert_eq!(member_b.ownership_bps, 500);
        assert_eq!(w.project.allocated_bps, 1_500);
    }

    // F. Somebody else's Member account.
    #[test]
    fn f_wrong_member_wallet_is_rejected() {
        let mut w = world(1_000, 1);
        w.member.wallet = Pubkey::new_unique();
        assert!(run(&mut w).is_err());
        assert_eq!(w.project.committed_bps, 1_000);
        assert_eq!(w.project.allocated_bps, 0);
    }

    // F (second half). Contribution that belongs to a different contributor.
    #[test]
    fn f_wrong_contributor_on_contribution_is_rejected() {
        let mut w = world(1_000, 1);
        let other = Pubkey::new_unique();
        w.contribution.contributor = other;
        w.member.wallet = other;
        assert!(run(&mut w).is_err());
        assert_eq!(w.project.allocated_bps, 0);
    }

    // F (third half). Member of another project.
    #[test]
    fn f_member_of_another_project_is_rejected() {
        let mut w = world(1_000, 1);
        w.member.project = Pubkey::new_unique();
        assert!(run(&mut w).is_err());
        assert_eq!(w.project.allocated_bps, 0);
    }

    // H. Stale attempt.
    #[test]
    fn h_attempt_mismatch_is_rejected() {
        let mut w = world(1_000, 2);
        w.contribution.attempt = 1;
        assert!(run(&mut w).is_err());
        assert_eq!(w.project.committed_bps, 1_000);
        assert_eq!(w.project.allocated_bps, 0);
    }

    // I. Not approved yet.
    #[test]
    fn i_unapproved_contribution_is_rejected() {
        let mut w = world(1_000, 1);
        w.contribution.status = ContributionStatus::Submitted;
        assert!(run(&mut w).is_err());
        assert_eq!(w.project.allocated_bps, 0);
        assert_eq!(w.member.ownership_bps, 0);
    }

    // I (second half). Rejected contribution can never be allocated.
    #[test]
    fn i_rejected_contribution_is_rejected() {
        let mut w = world(1_000, 1);
        w.contribution.status = ContributionStatus::Rejected;
        assert!(run(&mut w).is_err());
        assert_eq!(w.project.allocated_bps, 0);
    }

    // K. committed < reward. Unreachable through the instruction set; checked
    // anyway so a future bug fails loudly instead of underflowing.
    #[test]
    fn k_insufficient_committed_underflows_safely() {
        let mut w = world(1_000, 1);
        w.project.committed_bps = 500;
        assert!(run(&mut w).is_err());
        assert_eq!(w.project.committed_bps, 500);
        assert_eq!(w.project.allocated_bps, 0);
        assert_eq!(w.member.ownership_bps, 0);
    }

    // K (second half). A task that never reserved cannot allocate.
    #[test]
    fn k_unreserved_task_is_rejected() {
        let mut w = world(1_000, 1);
        w.task.reserved_committed = false;
        assert!(run(&mut w).is_err());
        assert_eq!(w.project.allocated_bps, 0);
    }

    // L. Pool invariant holds across a full series of allocations.
    #[test]
    fn l_pool_invariant_holds_across_a_series() {
        let founder = Pubkey::new_unique();
        let project_key = Pubkey::new_unique();
        let mut p = project(founder);

        let rewards: [u16; 4] = [1_000, 800, 500, 300];
        // All four tasks claimed first: every reward reserved up front.
        for r in rewards.iter() {
            p.committed_bps += r;
        }
        assert_eq!(p.committed_bps, 2_600);

        let mut total = 0u16;
        for (i, r) in rewards.iter().enumerate() {
            let contributor = Pubkey::new_unique();
            let mut t = task(project_key, contributor, *r, 1);
            t.task_id = i as u64;
            let mut c = contribution(Pubkey::new_unique(), contributor, 1);
            let mut m = member(project_key, contributor);
            apply_allocation(&mut p, &mut t, &mut c, &mut m).unwrap();
            total += r;

            assert_eq!(m.ownership_bps, *r);
            assert_eq!(p.allocated_bps, total);
            assert!(p.committed_bps + p.allocated_bps <= p.dev_pool_bps);
            p.assert_invariants().unwrap();
        }

        assert_eq!(p.committed_bps, 0);
        assert_eq!(p.allocated_bps, 2_600);
        assert_eq!(p.remaining_bps().unwrap(), 3_400);
    }

    // Overflow guard: allocation may never push allocated past the dev pool.
    #[test]
    fn allocation_cannot_exceed_the_development_pool() {
        let mut w = world(1_000, 1);
        w.project.allocated_bps = 5_500; // 5500 + 1000 > 6000
        assert!(run(&mut w).is_err());
        assert_eq!(w.project.allocated_bps, 5_500);
    }
}
