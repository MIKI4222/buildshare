use anchor_lang::prelude::*;

/// FROZEN (DESIGN FREEZE v1.2 SS7). Anchor assigns 6000 to the first variant and
/// increments. The order below therefore IS the wire format: appending is safe,
/// reordering, renaming or removing is a breaking change for every client.
#[error_code]
pub enum BuildshareError {
    #[msg("founder_bps + dev_pool_bps must equal exactly 10000")]
    InvalidSplit, // 6000
    #[msg("basis point value is zero or out of range")]
    InvalidBps, // 6001
    #[msg("reward exceeds the remaining development pool")]
    PoolExceeded, // 6002
    #[msg("task status does not allow this transition")]
    InvalidTaskTransition, // 6003
    #[msg("contribution status does not allow this transition")]
    InvalidContributionTransition, // 6004
    #[msg("the commitment is immutable once the task is claimed")]
    CommitmentImmutable, // 6005
    #[msg("task is not claimable in its current status")]
    NotClaimable, // 6006
    #[msg("the claim window has expired")]
    ClaimExpired, // 6007
    #[msg("the claim is still active and cannot be expired yet")]
    ClaimStillActive, // 6008
    #[msg("task carries no commitment")]
    NoCommitment, // 6009
    #[msg("this contribution has already been allocated")]
    DoubleAllocation, // 6010
    #[msg("a rejection reason hash is required")]
    RejectReasonRequired, // 6011
    #[msg("signer is not authorised for this action")]
    NotAuthorized, // 6012
    #[msg("account does not belong to the given project")]
    InvalidProject, // 6013
    #[msg("account does not belong to the given task")]
    InvalidTask, // 6014
    #[msg("contribution does not match the given task or attempt")]
    InvalidContribution, // 6015
    #[msg("member account does not match the contributor")]
    InvalidMember, // 6016
    #[msg("signer is not the contributor recorded on the task")]
    InvalidContributor, // 6017
    #[msg("attempt number does not match the on-chain task state")]
    InvalidAttempt, // 6018
    #[msg("attempt counter overflowed")]
    AttemptOverflow, // 6019
    #[msg("hash must not be all zeroes")]
    EmptyHash, // 6020
    #[msg("arithmetic overflow")]
    ArithmeticOverflow, // 6021
    #[msg("arithmetic underflow")]
    ArithmeticUnderflow, // 6022
    #[msg("an ownership accounting invariant was violated")]
    InvariantViolation, // 6023
}
