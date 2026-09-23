use crate::constants::*;
use crate::errors::BuildshareError;
use crate::events::TaskCreated;
use crate::state::{Project, Task, TaskStatus};
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction(task_id: u64)]
pub struct CreateTask<'info> {
    #[account(mut)]
    pub founder: Signer<'info>,
    #[account(
        mut,
        has_one = founder @ BuildshareError::NotAuthorized,
    )]
    pub project: Account<'info, Project>,
    #[account(
        init,
        payer = founder,
        space = Task::SPACE,
        seeds = [SEED_TASK, project.key().as_ref(), &task_id.to_le_bytes()],
        bump
    )]
    pub task: Account<'info, Task>,
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<CreateTask>,
    task_id: u64,
    reward_bps: u16,
    acceptance_criteria_hash: [u8; 32],
    repo_ref_hash: [u8; 32],
) -> Result<()> {
    require!(reward_bps > 0, BuildshareError::InvalidBps);
    require!(reward_bps <= BPS_TOTAL, BuildshareError::InvalidBps);
    // Advisory ceiling only. The authoritative reservation happens in
    // claim_task, where remaining_bps is re-checked against live state.
    require!(
        reward_bps <= ctx.accounts.project.dev_pool_bps,
        BuildshareError::PoolExceeded
    );
    require!(
        acceptance_criteria_hash != ZERO_HASH,
        BuildshareError::EmptyHash
    );

    let project_key = ctx.accounts.project.key();
    let task = &mut ctx.accounts.task;
    task.project = project_key;
    task.task_id = task_id;
    task.status = TaskStatus::Open;
    task.reward_bps = reward_bps;
    task.attempt = 0;
    task.contributor = None;
    task.claimed_at = 0;
    task.claim_expires_at = 0;
    task.acceptance_criteria_hash = acceptance_criteria_hash;
    task.repo_ref_hash = repo_ref_hash;
    task.commitment_hash = ZERO_HASH;
    task.reserved_committed = false;
    task.bump = ctx.bumps.task;

    let task_key = task.key();

    let project = &mut ctx.accounts.project;
    project.task_count = project
        .task_count
        .checked_add(1)
        .ok_or_else(|| error!(BuildshareError::ArithmeticOverflow))?;

    emit!(TaskCreated {
        project: project_key,
        task: task_key,
        task_id,
        reward_bps,
    });
    Ok(())
}
