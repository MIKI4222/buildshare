/**
 * PDA seed construction, TypeScript side.
 *
 * Twin of `programs/buildshare/src/pda.rs`. Both files must produce
 * byte-identical seeds or the client and the program disagree about which
 * account an operation refers to.
 *
 * Frozen encoding rules (DESIGN FREEZE v1.2):
 *   - seed prefixes are ASCII, exactly as written in constants.rs
 *   - u64 seeds are 8 bytes LITTLE-endian
 *   - the attempt seed is ONE raw byte (u8), never a decimal string
 *   - seed order is fixed and never reordered
 *
 * Dependency-free on purpose: no @solana/web3.js import, so these helpers and
 * their tests run in the demo path and in plain Node.
 */

export const SEED_PROJECT = 'project';
export const SEED_TASK = 'task';
export const SEED_CONTRIBUTION = 'contribution';
export const SEED_MEMBER = 'member';

export const U64_MAX = 18446744073709551615n;

/** ASCII seed prefix as bytes. */
export function asciiSeed(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

/**
 * 8-byte little-endian encoding of a u64, matching Rust `u64::to_le_bytes()`.
 * BigInt + DataView on purpose: bit shifts in JavaScript are 32-bit and would
 * silently corrupt ids above 2^31.
 */
export function u64le(value: number | bigint): Uint8Array {
  if (typeof value === 'number' && !Number.isInteger(value)) {
    throw new RangeError('u64 seed must be an integer: ' + String(value));
  }
  const big = typeof value === 'bigint' ? value : BigInt(value);
  if (big < 0n || big > U64_MAX) {
    throw new RangeError('u64 seed out of range: ' + String(value));
  }
  const bytes = new Uint8Array(8);
  new DataView(bytes.buffer).setBigUint64(0, big, true);
  return bytes;
}

/** Single raw byte, matching a Rust `&[attempt]` seed where attempt: u8. */
export function u8byte(value: number): Uint8Array {
  if (!Number.isInteger(value) || value < 0 || value > 255) {
    throw new RangeError('u8 seed out of range: ' + String(value));
  }
  return new Uint8Array([value]);
}

export function projectSeeds(
  founderBytes: Uint8Array,
  onchainProjectId: number | bigint,
): Uint8Array[] {
  return [asciiSeed(SEED_PROJECT), founderBytes, u64le(onchainProjectId)];
}

export function taskSeeds(
  projectPdaBytes: Uint8Array,
  onchainTaskId: number | bigint,
): Uint8Array[] {
  return [asciiSeed(SEED_TASK), projectPdaBytes, u64le(onchainTaskId)];
}

export function contributionSeeds(
  taskPdaBytes: Uint8Array,
  contributorBytes: Uint8Array,
  attempt: number,
): Uint8Array[] {
  return [asciiSeed(SEED_CONTRIBUTION), taskPdaBytes, contributorBytes, u8byte(attempt)];
}

export function memberSeeds(
  projectPdaBytes: Uint8Array,
  walletBytes: Uint8Array,
): Uint8Array[] {
  return [asciiSeed(SEED_MEMBER), projectPdaBytes, walletBytes];
}

/** Debug/parity helper: lowercase hex of a seed list, joined by '|'. */
export function seedsToHex(seeds: Uint8Array[]): string {
  return seeds
    .map((seed) =>
      Array.from(seed)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join(''),
    )
    .join('|');
}
