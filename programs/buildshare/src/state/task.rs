use anchor_lang::prelude::*;

/// FROZEN discriminants. Never renumber: the value is stored on chain.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum TaskStatus {
    Open = 0,
    Claimed = 1,
    Submitted = 2,
    Rejected = 3,
    Expired = 4,
    Completed = 5,
    Cancelled = 6,
}

/// Task - 199 B on chain (8 discriminator + 191 data).
/// `repo_ref_hash` replaces plaintext repository/branch (B2): no Borsh String
/// anywhere, therefore the layout is fixed size and rent is predictable.
#[account]
pub struct Task {
    pub project: Pubkey,                    // 32
    pub task_id: u64,                       //  8
    pub status: TaskStatus,                 //  1
    pub reward_bps: u16,                    //  2
    pub attempt: u8,                        //  1
    pub contributor: Option<Pubkey>,        // 33
    pub claimed_at: i64,                    //  8
    pub claim_expires_at: i64,              //  8
    pub acceptance_criteria_hash: [u8; 32], // 32
    pub repo_ref_hash: [u8; 32],            // 32
    pub commitment_hash: [u8; 32],          // 32
    /// I5: the reward is reserved in `project.committed_bps` at most once per
    /// task, no matter how many attempts happen. NEVER use `attempt == 1` for
    /// this: claim #1 can expire, and claim #2 must not reserve again.
    pub reserved_committed: bool,           //  1
    pub bump: u8,                           //  1
}

impl Task {
    pub const LEN: usize = 32 + 8 + 1 + 2 + 1 + 33 + 8 + 8 + 32 + 32 + 32 + 1 + 1;
    pub const SPACE: usize = 8 + Self::LEN;

    pub fn is_claimable(&self) -> bool {
        matches!(
            self.status,
            TaskStatus::Open | TaskStatus::Expired | TaskStatus::Rejected
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn task_account_is_199_bytes() {
        assert_eq!(Task::LEN, 191);
        assert_eq!(Task::SPACE, 199);
    }

    #[test]
    fn status_discriminants_are_frozen() {
        assert_eq!(TaskStatus::Open as u8, 0);
        assert_eq!(TaskStatus::Claimed as u8, 1);
        assert_eq!(TaskStatus::Submitted as u8, 2);
        assert_eq!(TaskStatus::Rejected as u8, 3);
        assert_eq!(TaskStatus::Expired as u8, 4);
        assert_eq!(TaskStatus::Completed as u8, 5);
        assert_eq!(TaskStatus::Cancelled as u8, 6);
    }
}
