use crate::errors::BuildshareError;
use crate::events::ClaimExpired;
use crate::state::{Task, TaskStatus};
use anchor_lang::prelude::*;

/// Permissionless: anyone may expire a stale claim. The reservation is NOT
/// released here - it belongs to the task and survives until cancel_task.
#[derive(Accounts)]
pub struct ExpireClaim<'info> {
    pub caller: Signer<'info>,
    #[account(mut)]
    pub task: Account<'info, Task>,
}

pub fn handler(ctx: Context<ExpireClaim>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let task = &mut ctx.accounts.task;

    require!(
        task.status == TaskStatus::Claimed,
        BuildshareError::InvalidTaskTransition
    );
    require!(
        now >= task.claim_expires_at,
        BuildshareError::ClaimStillActive
    );
    let contributor = task
        .contributor
        .ok_or_else(|| error!(BuildshareError::NoCommitment))?;

    task.status = TaskStatus::Expired;
    task.contributor = None;

    emit!(ClaimExpired {
        task: task.key(),
        contributor,
        attempt: task.attempt,
    });
    Ok(())
}
