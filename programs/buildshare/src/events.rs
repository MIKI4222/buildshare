use anchor_lang::prelude::*;

/// FROZEN (DESIGN FREEZE v1.2 SS6): exactly these ten events, exactly these
/// names. `update_task` deliberately emits nothing. There is no
/// `AllocationFailed` event: a failed transaction writes no state, so there is
/// nothing to observe. There is no `ContributionCreated` event (B4).

#[event]
pub struct ProjectInitialized {
    pub project: Pubkey,
    pub founder: Pubkey,
    pub project_id: u64,
    pub founder_bps: u16,
    pub dev_pool_bps: u16,
}

#[event]
pub struct TaskCreated {
    pub project: Pubkey,
    pub task: Pubkey,
    pub task_id: u64,
    pub reward_bps: u16,
}

#[event]
pub struct TaskClaimed {
    pub task: Pubkey,
    pub contributor: Pubkey,
    pub attempt: u8,
    pub commitment_hash: [u8; 32],
    pub claim_expires_at: i64,
    pub reserved_now: bool,
}

#[event]
pub struct ClaimExpired {
    pub task: Pubkey,
    pub contributor: Pubkey,
    pub attempt: u8,
}

#[event]
pub struct TaskCancelled {
    pub project: Pubkey,
    pub task: Pubkey,
    pub released_bps: u16,
}

#[event]
pub struct ContributionSubmitted {
    pub task: Pubkey,
    pub contribution: Pubkey,
    pub contributor: Pubkey,
    pub attempt: u8,
    pub evidence_hash: [u8; 32],
}

#[event]
pub struct ContributionApproved {
    pub contribution: Pubkey,
    pub approved_at: i64,
}

#[event]
pub struct ContributionRejected {
    pub contribution: Pubkey,
    pub reject_reason_hash: [u8; 32],
    pub rejected_at: i64,
}

#[event]
pub struct MemberCreated {
    pub project: Pubkey,
    pub member: Pubkey,
    pub wallet: Pubkey,
}

#[event]
pub struct OwnershipAllocated {
    pub project: Pubkey,
    pub task: Pubkey,
    pub contribution: Pubkey,
    pub member: Pubkey,
    pub reward_bps: u16,
    pub project_allocated_bps: u16,
    pub project_committed_bps: u16,
}
