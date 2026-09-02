use crate::allocation::apply_allocation;
use crate::errors::BuildshareError;
use crate::events::OwnershipAllocated;
use crate::state::{Contribution, ContributionStatus, Member, Project, Task};
use anchor_lang::prelude::*;

/// P1 STEP 3: the only instruction in the program that moves ownership.
///
/// Two-transaction model on purpose: `approve_contribution` records the human
/// decision and touches no accounting, `allocate_ownership` performs the whole
/// accounting change atomically. If this instruction fails, the transaction is
/// rolled back and project, task, contribution and member are all unchanged.
///
/// Retry is off-chain only: the client simply sends this instruction again.
/// There is no `retry_allocation` instruction and no `AllocationFailed` event -
/// a failed Solana transaction leaves no state and nothing to observe.
#[derive(Accounts)]
pub struct AllocateOwnership<'info> {
    pub founder: Signer<'info>,
    #[account(
        mut,
        has_one = founder @ BuildshareError::NotAuthorized,
    )]
    pub project: Account<'info, Project>,
    #[account(
        mut,
        has_one = project @ BuildshareError::InvalidProject,
    )]
    pub task: Account<'info, Task>,
    #[account(
        mut,
        has_one = task @ BuildshareError::InvalidTask,
        constraint = Some(contribution.contributor) == task.contributor @ BuildshareError::InvalidContributor,
        constraint = contribution.attempt == task.attempt @ BuildshareError::InvalidAttempt,
        constraint = !contribution.allocated @ BuildshareError::DoubleAllocation,
        constraint = contribution.status == ContributionStatus::Approved @ BuildshareError::InvalidContributionTransition,
    )]
    pub contribution: Account<'info, Contribution>,
    /// Existing account only. No `init_if_needed`: re-initialising a Member
    /// would reset `ownership_bps` and silently erase ownership.
    #[account(
        mut,
        has_one = project @ BuildshareError::InvalidProject,
        constraint = member.wallet == contribution.contributor @ BuildshareError::InvalidMember,
    )]
    pub member: Account<'info, Member>,
}

pub fn handler(ctx: Context<AllocateOwnership>) -> Result<()> {
    let project = &mut ctx.accounts.project;
    let task = &mut ctx.accounts.task;
    let contribution = &mut ctx.accounts.contribution;
    let member = &mut ctx.accounts.member;

    // All arithmetic and every state transition live in one audited place.
    let outcome = apply_allocation(project, task, contribution, member)?;

    emit!(OwnershipAllocated {
        project: project.key(),
        task: task.key(),
        contribution: contribution.key(),
        member: member.key(),
        reward_bps: outcome.reward_bps,
        project_allocated_bps: outcome.project_allocated_bps,
        project_committed_bps: outcome.project_committed_bps,
    });
    Ok(())
}
