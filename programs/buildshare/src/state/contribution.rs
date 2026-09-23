use anchor_lang::prelude::*;

/// FROZEN. `Settled` (not `Onchain`): the on-chain vocabulary must not borrow a
/// client-side status name. The P0 client maps `Settled` -> `ONCHAIN`.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
#[borsh(use_discriminant = true)]
pub enum ContributionStatus {
    Submitted = 0,
    Approved = 1,
    Rejected = 2,
    Settled = 3,
}

/// Contribution - 188 B on chain (8 discriminator + 180 data).
/// One account per ATTEMPT. A retry never reuses this account: the attempt
/// number is part of the PDA seeds, so attempt 2 has its own address, its own
/// evidence hash and its own audit trail.
#[account]
pub struct Contribution {
    pub task: Pubkey,                     // 32
    pub contributor: Pubkey,              // 32
    pub attempt: u8,                      //  1
    pub status: ContributionStatus,       //  1
    pub commitment_hash: [u8; 32],        // 32
    pub evidence_hash: [u8; 32],          // 32
    pub reject_reason_hash: [u8; 32],     // 32
    pub approved_at: i64,                 //  8
    pub rejected_at: i64,                 //  8
    /// Single-use latch. The only thing standing between us and a double
    /// allocation, so it is checked and set inside `allocate_ownership`.
    pub allocated: bool,                  //  1
    pub bump: u8,                         //  1
}

impl Contribution {
    pub const LEN: usize = 32 + 32 + 1 + 1 + 32 + 32 + 32 + 8 + 8 + 1 + 1;
    pub const SPACE: usize = 8 + Self::LEN;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn contribution_account_is_188_bytes() {
        assert_eq!(Contribution::LEN, 180);
        assert_eq!(Contribution::SPACE, 188);
    }

    #[test]
    fn status_discriminants_are_frozen() {
        assert_eq!(ContributionStatus::Submitted as u8, 0);
        assert_eq!(ContributionStatus::Approved as u8, 1);
        assert_eq!(ContributionStatus::Rejected as u8, 2);
        assert_eq!(ContributionStatus::Settled as u8, 3);
    }
}
