use crate::errors::BuildshareError;
use anchor_lang::prelude::*;

/// Project - 101 B on chain (8 discriminator + 93 data).
/// FROZEN field order. No `ownership_total` (B3), no `remaining_bps`: both
/// would be a second source of truth for a value that can be derived.
#[account]
pub struct Project {
    pub founder: Pubkey,    // 32
    pub project_id: u64,    //  8
    pub founder_bps: u16,   //  2
    pub dev_pool_bps: u16,  //  2
    pub committed_bps: u16, //  2
    pub allocated_bps: u16, //  2
    pub task_count: u64,    //  8
    pub member_count: u32,  //  4
    pub bump: u8,           //  1
    pub reserved: [u8; 32], // 32
}

impl Project {
    pub const LEN: usize = 32 + 8 + 2 + 2 + 2 + 2 + 8 + 4 + 1 + 32;
    pub const SPACE: usize = 8 + Self::LEN;

    /// Never stored. `dev_pool_bps - committed_bps - allocated_bps`.
    pub fn remaining_bps(&self) -> Result<u16> {
        let after_committed = self
            .dev_pool_bps
            .checked_sub(self.committed_bps)
            .ok_or_else(|| error!(BuildshareError::ArithmeticUnderflow))?;
        after_committed
            .checked_sub(self.allocated_bps)
            .ok_or_else(|| error!(BuildshareError::ArithmeticUnderflow))
    }

    /// I1 and I2 from the specification, checked together.
    pub fn assert_invariants(&self) -> Result<()> {
        let split = self
            .founder_bps
            .checked_add(self.dev_pool_bps)
            .ok_or_else(|| error!(BuildshareError::ArithmeticOverflow))?;
        require!(split == crate::constants::BPS_TOTAL, BuildshareError::InvalidSplit);
        let used = self
            .committed_bps
            .checked_add(self.allocated_bps)
            .ok_or_else(|| error!(BuildshareError::ArithmeticOverflow))?;
        require!(used <= self.dev_pool_bps, BuildshareError::InvariantViolation);
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn project_account_is_101_bytes() {
        assert_eq!(Project::LEN, 93);
        assert_eq!(Project::SPACE, 101);
    }
}
