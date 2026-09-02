use crate::constants::*;
use anchor_lang::prelude::*;

/// Address derivation, kept in one place so that Rust and TypeScript can be
/// diffed against a single definition. The TypeScript twin lives in
/// `src/lib/solana/pda.ts` and is covered by byte-vector parity tests.
///
/// Encoding rules, frozen:
///   * `u64` seeds are 8-byte LITTLE-endian (`to_le_bytes`)
///   * `u8` seeds are a single raw byte, never a decimal string
///   * seed order is fixed and never reordered
pub fn project_pda(program_id: &Pubkey, founder: &Pubkey, project_id: u64) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[SEED_PROJECT, founder.as_ref(), &project_id.to_le_bytes()],
        program_id,
    )
}

pub fn task_pda(program_id: &Pubkey, project: &Pubkey, task_id: u64) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[SEED_TASK, project.as_ref(), &task_id.to_le_bytes()],
        program_id,
    )
}

pub fn contribution_pda(
    program_id: &Pubkey,
    task: &Pubkey,
    contributor: &Pubkey,
    attempt: u8,
) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[SEED_CONTRIBUTION, task.as_ref(), contributor.as_ref(), &[attempt]],
        program_id,
    )
}

pub fn member_pda(program_id: &Pubkey, project: &Pubkey, wallet: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[SEED_MEMBER, project.as_ref(), wallet.as_ref()],
        program_id,
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    fn program() -> Pubkey {
        Pubkey::new_from_array([7u8; 32])
    }

    fn founder() -> Pubkey {
        Pubkey::new_from_array([1u8; 32])
    }

    fn contributor() -> Pubkey {
        Pubkey::new_from_array([2u8; 32])
    }

    #[test]
    fn project_pda_is_deterministic() {
        let a = project_pda(&program(), &founder(), 1);
        let b = project_pda(&program(), &founder(), 1);
        assert_eq!(a, b);
    }

    #[test]
    fn project_id_changes_the_address() {
        let a = project_pda(&program(), &founder(), 1).0;
        let b = project_pda(&program(), &founder(), 2).0;
        assert_ne!(a, b);
    }

    #[test]
    fn founder_changes_the_address() {
        let a = project_pda(&program(), &founder(), 1).0;
        let b = project_pda(&program(), &contributor(), 1).0;
        assert_ne!(a, b);
    }

    #[test]
    fn u64_seed_is_little_endian() {
        assert_eq!(1u64.to_le_bytes(), [1, 0, 0, 0, 0, 0, 0, 0]);
        assert_eq!(
            258u64.to_le_bytes(),
            [2, 1, 0, 0, 0, 0, 0, 0],
            "258 = 0x0102 must serialise low byte first"
        );
    }

    #[test]
    fn attempt_seed_is_one_raw_byte() {
        let project = project_pda(&program(), &founder(), 1).0;
        let task = task_pda(&program(), &project, 1).0;
        let a1 = contribution_pda(&program(), &task, &contributor(), 1).0;
        let a2 = contribution_pda(&program(), &task, &contributor(), 2).0;
        assert_ne!(a1, a2, "each attempt must get its own contribution account");
    }

    #[test]
    fn member_address_depends_on_project_and_wallet() {
        let p1 = project_pda(&program(), &founder(), 1).0;
        let p2 = project_pda(&program(), &founder(), 2).0;
        assert_ne!(
            member_pda(&program(), &p1, &contributor()).0,
            member_pda(&program(), &p2, &contributor()).0
        );
    }
}
