use anchor_lang::prelude::*;

/// Member - 79 B on chain (8 discriminator + 71 data).
/// Justification for the account existing at all: ownership must be readable
/// per wallet without replaying the whole event log, and `allocate_ownership`
/// needs a single writable place to add the reward to.
#[account]
pub struct Member {
    pub project: Pubkey,       // 32
    pub wallet: Pubkey,        // 32
    pub ownership_bps: u16,    //  2
    pub allocation_count: u32, //  4
    pub bump: u8,              //  1
}

impl Member {
    pub const LEN: usize = 32 + 32 + 2 + 4 + 1;
    pub const SPACE: usize = 8 + Self::LEN;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn member_account_is_79_bytes() {
        assert_eq!(Member::LEN, 71);
        assert_eq!(Member::SPACE, 79);
    }
}
