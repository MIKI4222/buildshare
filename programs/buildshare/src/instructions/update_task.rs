use crate::constants::ZERO_HASH;
use crate::errors::BuildshareError;
use crate::state::{Project, Task, TaskStatus};
use anchor_lang::prelude::*;

/// Editable only while Open. Emits no event: the frozen event list has exactly
/// ten entries and TaskUpdated is not one of them.
#[derive(Accounts)]
pub struct UpdateTask<'info> {
    pub founder: Signer<'info>,
    #[account(has_one = founder @ BuildshareError::NotAuthorized)]
    pub project: Account<'info, Project>,
    #[account(
        mut,
        has_one = project @ BuildshareError::InvalidProject,
    )]
    pub task: Account<'info, Task>,
}

pub fn handler(
    ctx: Context<UpdateTask>,
    reward_bps: u16,
    acceptance_criteria_hash: [u8; 32],
    repo_ref_hash: [u8; 32],
) -> Result<()> {
    let project = &ctx.accounts.project;
    let task = &mut ctx.accounts.task;

    // Immutability after CLAIMED, enforced on chain rather than in the UI.
    require!(
        task.status == TaskStatus::Open,
        BuildshareError::CommitmentImmutable
    );
    // A reserved task cannot have its reward changed: the reservation is
    // already counted in project.committed_bps.
    require!(!task.reserved_committed, BuildshareError::CommitmentImmutable);
    require!(reward_bps > 0, BuildshareError::InvalidBps);
    require!(
        reward_bps <= project.dev_pool_bps,
        BuildshareError::PoolExceeded
    );
    require!(
        acceptance_criteria_hash != ZERO_HASH,
        BuildshareError::EmptyHash
    );

    task.reward_bps = reward_bps;
    task.acceptance_criteria_hash = acceptance_criteria_hash;
    task.repo_ref_hash = repo_ref_hash;
    Ok(())
}
