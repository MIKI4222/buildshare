use crate::constants::*;
use crate::errors::BuildshareError;
use crate::events::ContributionSubmitted;
use crate::state::{Contribution, ContributionStatus, Project, Task, TaskStatus};
use anchor_lang::prelude::*;

/// B4: ONE atomic instruction. The Contribution account is created together
/// with a non-zero evidence hash, so a Contribution with an empty evidence
/// hash cannot exist on chain.
#[derive(Accounts)]
#[instruction(attempt: u8)]
pub struct SubmitContribution<'info> {
    #[account(mut)]
    pub contributor: Signer<'info>,
    pub project: Account<'info, Project>,
    #[account(
        mut,
        has_one = project @ BuildshareError::InvalidProject,
        constraint = task.contributor == Some(contributor.key()) @ BuildshareError::InvalidContributor,
        constraint = task.attempt == attempt @ BuildshareError::InvalidAttempt,
    )]
    pub task: Account<'info, Task>,
    #[account(
        init,
        payer = contributor,
        space = Contribution::SPACE,
        seeds = [
            SEED_CONTRIBUTION,
            task.key().as_ref(),
            contributor.key().as_ref(),
            &[attempt],
        ],
        bump
    )]
    pub contribution: Account<'info, Contribution>,
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<SubmitContribution>,
    attempt: u8,
    evidence_hash: [u8; 32],
) -> Result<()> {
    require!(evidence_hash != ZERO_HASH, BuildshareError::EmptyHash);

    let now = Clock::get()?.unix_timestamp;
    let task = &mut ctx.accounts.task;

    require!(
        task.status == TaskStatus::Claimed,
        BuildshareError::InvalidTaskTransition
    );
    require!(now <= task.claim_expires_at, BuildshareError::ClaimExpired);
    require!(
        task.commitment_hash != ZERO_HASH,
        BuildshareError::NoCommitment
    );

    let task_key = task.key();
    let commitment_hash = task.commitment_hash;
    task.status = TaskStatus::Submitted;

    let contribution = &mut ctx.accounts.contribution;
    contribution.task = task_key;
    contribution.contributor = ctx.accounts.contributor.key();
    contribution.attempt = attempt;
    contribution.status = ContributionStatus::Submitted;
    contribution.commitment_hash = commitment_hash;
    contribution.evidence_hash = evidence_hash;
    contribution.reject_reason_hash = ZERO_HASH;
    contribution.approved_at = 0;
    contribution.rejected_at = 0;
    contribution.allocated = false;
    contribution.bump = ctx.bumps.contribution;

    emit!(ContributionSubmitted {
        task: task_key,
        contribution: contribution.key(),
        contributor: contribution.contributor,
        attempt,
        evidence_hash,
    });
    Ok(())
}
