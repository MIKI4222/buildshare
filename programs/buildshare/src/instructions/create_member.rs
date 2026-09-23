use crate::constants::*;
use crate::errors::BuildshareError;
use crate::events::MemberCreated;
use crate::state::{Member, Project};
use anchor_lang::prelude::*;

/// Permissionless on purpose (B5): anyone may pay the rent to create the Member
/// account, because `allocate_ownership` must never be blocked by a missing
/// account and `init_if_needed` is banned.
#[derive(Accounts)]
pub struct CreateMember<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut)]
    pub project: Account<'info, Project>,
    /// CHECK: used only as a PDA seed and stored as the member wallet. It does
    /// not sign and holds no lamports here, so no further validation applies.
    pub wallet: UncheckedAccount<'info>,
    #[account(
        init,
        payer = payer,
        space = Member::SPACE,
        seeds = [SEED_MEMBER, project.key().as_ref(), wallet.key().as_ref()],
        bump
    )]
    pub member: Account<'info, Member>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<CreateMember>) -> Result<()> {
    let project_key = ctx.accounts.project.key();
    let member = &mut ctx.accounts.member;
    member.project = project_key;
    member.wallet = ctx.accounts.wallet.key();
    member.ownership_bps = 0;
    member.allocation_count = 0;
    member.bump = ctx.bumps.member;

    let member_key = member.key();
    let wallet_key = member.wallet;

    let project = &mut ctx.accounts.project;
    project.member_count = project
        .member_count
        .checked_add(1)
        .ok_or_else(|| error!(BuildshareError::ArithmeticOverflow))?;

    emit!(MemberCreated {
        project: project_key,
        member: member_key,
        wallet: wallet_key,
    });
    Ok(())
}
