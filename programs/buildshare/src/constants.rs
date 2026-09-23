use anchor_lang::prelude::*;

/// DESIGN FREEZE v1.2 / B3: 10 000 bps == 100 %.
/// There is deliberately NO `ownership_total` field on Project. A constant
/// cannot drift out of sync with itself; a stored copy can.
pub const BPS_TOTAL: u16 = 10_000;

/// Claim window, 7 days, identical to the P0 `DEFAULT_CLAIM_WINDOW_DAYS`.
pub const CLAIM_WINDOW_SECS: i64 = 604_800;

/// PDA seed prefixes. Frozen: never change these byte strings, the addresses
/// of every existing account depend on them.
pub const SEED_PROJECT: &[u8] = b"project";
pub const SEED_TASK: &[u8] = b"task";
pub const SEED_CONTRIBUTION: &[u8] = b"contribution";
pub const SEED_MEMBER: &[u8] = b"member";

/// A hash field that is still all zeroes has never been written. Used to
/// reject an empty evidence hash or an empty rejection reason.
pub const ZERO_HASH: [u8; 32] = [0u8; 32];

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bps_total_is_ten_thousand() {
        assert_eq!(BPS_TOTAL, 10_000);
    }

    #[test]
    fn claim_window_is_seven_days() {
        assert_eq!(CLAIM_WINDOW_SECS, 7 * 24 * 60 * 60);
    }

    #[test]
    fn seed_prefix_lengths_match_the_frozen_table() {
        assert_eq!(SEED_PROJECT.len(), 7);
        assert_eq!(SEED_TASK.len(), 4);
        assert_eq!(SEED_CONTRIBUTION.len(), 12);
        assert_eq!(SEED_MEMBER.len(), 6);
    }
}
