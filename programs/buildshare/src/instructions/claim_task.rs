use crate::constants::*;
use crate::errors::BuildshareError;
use crate::events::TaskClaimed;
use crate::state::{Project, Task, TaskStatus};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct ClaimTask<'info> {
    pub contributor: Signer<'info>,
    #[account(mut)]
    pub project: Account<'info, Project>,
    #[account(
        mut,
        has_one = project @ BuildshareError::InvalidProject,
    )]
    pub task: Account<'info, Task>,
}

pub fn handler(ctx: Context<ClaimTask>, commitment_hash: [u8; 32]) -> Result<()> {
    require!(commitment_hash != ZERO_HASH, BuildshareError::EmptyHash);

    let now = Clock::get()?.unix_timestamp;
    let project = &mut ctx.accounts.project;
    let task = &mut ctx.accounts.task;

    require!(task.is_claimable(), BuildshareError::NotClaimable);

    // I5: reserve at most once per TASK, for the lifetime of the task.
    // NEVER key this off `attempt == 1`: claim #1 may expire, and claim #2
    // must not reserve a second time.
    let reserved_now = if task.reserved_committed {
        false
    } else {
        let remaining = project.remaining_bps()?;
        require!(task.reward_bps <= remaining, BuildshareError::PoolExceeded);
        project.committed_bps = project
            .committed_bps
            .checked_add(task.reward_bps)
            .ok_or_else(|| error!(BuildshareError::ArithmeticOverflow))?;
        task.reserved_committed = true;
        true
    };

    task.attempt = task
        .attempt
        .checked_add(1)
        .ok_or_else(|| error!(BuildshareError::AttemptOverflow))?;
    task.status = TaskStatus::Claimed;
    task.contributor = Some(ctx.accounts.contributor.key());
    task.claimed_at = now;
    task.claim_expires_at = now
        .checked_add(CLAIM_WINDOW_SECS)
        .ok_or_else(|| error!(BuildshareError::ArithmeticOverflow))?;
    task.commitment_hash = commitment_hash;

    let task_key = task.key();
    let attempt = task.attempt;
    let claim_expires_at = task.claim_expires_at;

    project.assert_invariants()?;

    emit!(TaskClaimed {
        task: task_key,
        contributor: ctx.accounts.contributor.key(),
        attempt,
        commitment_hash,
        claim_expires_at,
        reserved_now,
    });
    Ok(())
}
