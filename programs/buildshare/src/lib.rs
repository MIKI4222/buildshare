#![allow(unexpected_cfgs)]
//! BuildShare - verified contributions into programmable project ownership.
//!
//! P1 STEP 3: ALLOCATION BUSINESS LOGIC.
//! Accounts, PDA derivation, constraints, errors, events, all eleven
//! instructions and the real ownership accounting core (see allocation.rs).
//! There is no `unimplemented!()` left anywhere in the program.
//!
//! PROGRAM_ID: NOT GENERATED. `declare_id!` below holds a placeholder.

use anchor_lang::prelude::*;

pub mod allocation;
pub mod constants;
pub mod errors;
pub mod events;
pub mod instructions;
pub mod pda;
pub mod state;

pub use allocation::*;
pub use constants::*;
pub use errors::BuildshareError;
pub use instructions::*;
pub use state::*;

// PROGRAM_ID: NOT GENERATED.
// Syntactically valid placeholder so the crate can be parsed. NOT a deploy
// target and NOT derived from any keypair. `anchor keys sync` will replace it
// when the program keypair is deliberately created (not part of P1 STEP 2).
declare_id!("BUILDSHARE1111111111111111111111111111111111");

#[program]
pub mod buildshare {
    use super::*;

    pub fn initialize_project(
        ctx: Context<InitializeProject>,
        project_id: u64,
        founder_bps: u16,
        dev_pool_bps: u16,
    ) -> Result<()> {
        instructions::initialize_project::handler(ctx, project_id, founder_bps, dev_pool_bps)
    }

    pub fn create_member(ctx: Context<CreateMember>) -> Result<()> {
        instructions::create_member::handler(ctx)
    }

    pub fn create_task(
        ctx: Context<CreateTask>,
        task_id: u64,
        reward_bps: u16,
        acceptance_criteria_hash: [u8; 32],
        repo_ref_hash: [u8; 32],
    ) -> Result<()> {
        instructions::create_task::handler(
            ctx,
            task_id,
            reward_bps,
            acceptance_criteria_hash,
            repo_ref_hash,
        )
    }

    pub fn update_task(
        ctx: Context<UpdateTask>,
        reward_bps: u16,
        acceptance_criteria_hash: [u8; 32],
        repo_ref_hash: [u8; 32],
    ) -> Result<()> {
        instructions::update_task::handler(ctx, reward_bps, acceptance_criteria_hash, repo_ref_hash)
    }

    pub fn claim_task(ctx: Context<ClaimTask>, commitment_hash: [u8; 32]) -> Result<()> {
        instructions::claim_task::handler(ctx, commitment_hash)
    }

    pub fn expire_claim(ctx: Context<ExpireClaim>) -> Result<()> {
        instructions::expire_claim::handler(ctx)
    }

    pub fn cancel_task(ctx: Context<CancelTask>) -> Result<()> {
        instructions::cancel_task::handler(ctx)
    }

    pub fn submit_contribution(
        ctx: Context<SubmitContribution>,
        attempt: u8,
        evidence_hash: [u8; 32],
    ) -> Result<()> {
        instructions::submit_contribution::handler(ctx, attempt, evidence_hash)
    }

    pub fn approve_contribution(ctx: Context<ApproveContribution>) -> Result<()> {
        instructions::approve_contribution::handler(ctx)
    }

    pub fn reject_contribution(
        ctx: Context<RejectContribution>,
        reject_reason_hash: [u8; 32],
    ) -> Result<()> {
        instructions::reject_contribution::handler(ctx, reject_reason_hash)
    }

    pub fn allocate_ownership(ctx: Context<AllocateOwnership>) -> Result<()> {
        instructions::allocate_ownership::handler(ctx)
    }
}
