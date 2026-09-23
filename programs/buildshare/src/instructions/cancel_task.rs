use crate::errors::BuildshareError;
use crate::events::TaskCancelled;
use crate::state::{Project, Task, TaskStatus};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct CancelTask<'info> {
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
}

pub fn handler(ctx: Context<CancelTask>) -> Result<()> {
    let project = &mut ctx.accounts.project;
    let task = &mut ctx.accounts.task;

    // A claimed task cannot be cancelled from under the contributor.
    require!(
        matches!(
            task.status,
            TaskStatus::Open | TaskStatus::Expired | TaskStatus::Rejected
        ),
        BuildshareError::InvalidTaskTransition
    );

    let released_bps = if task.reserved_committed {
        project.committed_bps = project
            .committed_bps
            .checked_sub(task.reward_bps)
            .ok_or_else(|| error!(BuildshareError::ArithmeticUnderflow))?;
        task.reserved_committed = false;
        task.reward_bps
    } else {
        0
    };

    task.status = TaskStatus::Cancelled;
    task.contributor = None;

    let task_key = task.key();
    project.assert_invariants()?;

    emit!(TaskCancelled {
        project: project.key(),
        task: task_key,
        released_bps,
    });
    Ok(())
}
