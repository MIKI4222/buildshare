use crate::constants::ZERO_HASH;
use crate::errors::BuildshareError;
use crate::events::ContributionRejected;
use crate::state::{Contribution, ContributionStatus, Project, Task, TaskStatus};
use anchor_lang::prelude::*;

/// Rejection is terminal for THIS attempt only. The task returns to a
/// claimable status and keeps its reservation, so a retry never re-reserves.
#[derive(Accounts)]
pub struct RejectContribution<'info> {
    pub founder: Signer<'info>,
    #[account(has_one = founder @ BuildshareError::NotAuthorized)]
    pub project: Account<'info, Project>,
    #[account(
        mut,
        has_one = project @ BuildshareError::InvalidProject,
    )]
    pub task: Account<'info, Task>,
    #[account(
        mut,
        has_one = task @ BuildshareError::InvalidTask,
        constraint = contribution.attempt == task.attempt @ BuildshareError::InvalidAttempt,
    )]
    pub contribution: Account<'info, Contribution>,
}

pub fn handler(ctx: Context<RejectContribution>, reject_reason_hash: [u8; 32]) -> Result<()> {
    require!(
        reject_reason_hash != ZERO_HASH,
        BuildshareError::RejectReasonRequired
    );

    let now = Clock::get()?.unix_timestamp;

    let contribution = &mut ctx.accounts.contribution;
    require!(
        matches!(
            contribution.status,
            ContributionStatus::Submitted | ContributionStatus::Approved
        ),
        BuildshareError::InvalidContributionTransition
    );
    require!(!contribution.allocated, BuildshareError::DoubleAllocation);

    contribution.status = ContributionStatus::Rejected;
    contribution.reject_reason_hash = reject_reason_hash;
    contribution.rejected_at = now;
    let contribution_key = contribution.key();

    // The task becomes claimable again; the reservation is untouched.
    let task = &mut ctx.accounts.task;
    task.status = TaskStatus::Rejected;
    task.contributor = None;

    emit!(ContributionRejected {
        contribution: contribution_key,
        reject_reason_hash,
        rejected_at: now,
    });
    Ok(())
}
