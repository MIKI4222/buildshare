use crate::constants::*;
use crate::errors::BuildshareError;
use crate::events::ProjectInitialized;
use crate::state::Project;
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction(project_id: u64)]
pub struct InitializeProject<'info> {
    #[account(mut)]
    pub founder: Signer<'info>,
    #[account(
        init,
        payer = founder,
        space = Project::SPACE,
        seeds = [SEED_PROJECT, founder.key().as_ref(), &project_id.to_le_bytes()],
        bump
    )]
    pub project: Account<'info, Project>,
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<InitializeProject>,
    project_id: u64,
    founder_bps: u16,
    dev_pool_bps: u16,
) -> Result<()> {
    let split = founder_bps
        .checked_add(dev_pool_bps)
        .ok_or_else(|| error!(BuildshareError::ArithmeticOverflow))?;
    require!(split == BPS_TOTAL, BuildshareError::InvalidSplit);
    require!(dev_pool_bps > 0, BuildshareError::InvalidBps);

    let project = &mut ctx.accounts.project;
    project.founder = ctx.accounts.founder.key();
    project.project_id = project_id;
    project.founder_bps = founder_bps;
    project.dev_pool_bps = dev_pool_bps;
    project.committed_bps = 0;
    project.allocated_bps = 0;
    project.task_count = 0;
    project.member_count = 0;
    project.bump = ctx.bumps.project;
    project.reserved = [0u8; 32];
    project.assert_invariants()?;

    emit!(ProjectInitialized {
        project: project.key(),
        founder: project.founder,
        project_id,
        founder_bps,
        dev_pool_bps,
    });
    Ok(())
}
