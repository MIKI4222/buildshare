use crate::errors::BuildshareError;
use crate::events::ContributionApproved;
use crate::state::{Contribution, ContributionStatus, Project, Task, TaskStatus};
use anchor_lang::prelude::*;

/// Approval is a HUMAN decision. AI never signs anything: its evaluation only
/// enters the evidence hash. Approval alone allocates nothing.
#[derive(Accounts)]
pub struct ApproveContribution<'info> {
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
        constraint = Some(contribution.contributor) == task.contributor @ BuildshareError::InvalidContributor,
        constraint = contribution.attempt == task.attempt @ BuildshareError::InvalidAttempt,
    )]
    pub contribution: Account<'info, Contribution>,
}

pub fn handler(ctx: Context<ApproveContribution>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let task = &ctx.accounts.task;
    require!(
        task.status == TaskStatus::Submitted,
        BuildshareError::InvalidTaskTransition
    );

    let contribution = &mut ctx.accounts.contribution;
    require!(
        contribution.status == ContributionStatus::Submitted,
        BuildshareError::InvalidContributionTransition
    );
    require!(!contribution.allocated, BuildshareError::DoubleAllocation);

    contribution.status = ContributionStatus::Approved;
    contribution.approved_at = now;

    emit!(ContributionApproved {
        contribution: contribution.key(),
        approved_at: now,
    });
    Ok(())
}
