// Read-only decoder for BuildShare on-chain accounts.
//
// Why hand-written: the frontend must not ship an Anchor client just to READ
// four numbers. The Project layout is frozen (DESIGN FREEZE v1.2 2.1), so 93
// bytes of data behind an 8-byte Anchor discriminator can be decoded with a
// DataView. Anything of an unexpected length is REFUSED, never guessed.

export const DISCRIMINATOR_LEN = 8;
export const PROJECT_DATA_LEN = 93;
export const PROJECT_ACCOUNT_LEN = DISCRIMINATOR_LEN + PROJECT_DATA_LEN; // 101
export const BPS_TOTAL_ONCHAIN = 10000;

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

// Base58 for 32-byte public keys. Leading zero bytes become leading '1'.
export function base58Encode(bytes: Uint8Array): string {
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros += 1;
  let value = 0n;
  for (let i = 0; i < bytes.length; i += 1) {
    value = value * 256n + BigInt(bytes[i]);
  }
  let out = '';
  while (value > 0n) {
    out = BASE58_ALPHABET.charAt(Number(value % 58n)) + out;
    value = value / 58n;
  }
  let prefix = '';
  for (let i = 0; i < zeros; i += 1) prefix += '1';
  return prefix + out;
}

export interface OnchainProjectAccount {
  founder: string;
  projectId: string;
  founderBps: number;
  devPoolBps: number;
  committedBps: number;
  allocatedBps: number;
  taskCount: string;
  memberCount: number;
  bump: number;
  // Derived, never stored on chain (Project::remaining_bps).
  remainingBps: number;
}

export function decodeProjectAccount(data: Uint8Array): OnchainProjectAccount {
  if (data.length !== PROJECT_ACCOUNT_LEN) {
    throw new Error(
      'Refusing to decode a Project account of ' + data.length +
        ' bytes: the frozen layout is ' + PROJECT_ACCOUNT_LEN + ' bytes.',
    );
  }
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let offset = DISCRIMINATOR_LEN;
  const founder = base58Encode(data.slice(offset, offset + 32));
  offset += 32;
  const projectId = view.getBigUint64(offset, true).toString();
  offset += 8;
  const founderBps = view.getUint16(offset, true);
  offset += 2;
  const devPoolBps = view.getUint16(offset, true);
  offset += 2;
  const committedBps = view.getUint16(offset, true);
  offset += 2;
  const allocatedBps = view.getUint16(offset, true);
  offset += 2;
  const taskCount = view.getBigUint64(offset, true).toString();
  offset += 8;
  const memberCount = view.getUint32(offset, true);
  offset += 4;
  const bump = view.getUint8(offset);

  const remainingBps = devPoolBps - committedBps - allocatedBps;
  if (remainingBps < 0) {
    throw new Error('Decoded Project violates the pool invariant: committed + allocated > pool.');
  }
  return {
    founder,
    projectId,
    founderBps,
    devPoolBps,
    committedBps,
    allocatedBps,
    taskCount,
    memberCount,
    bump,
    remainingBps,
  };
}

// I1 and I2 from the specification, mirrored on the client for display only.
export function projectInvariantsHold(project: OnchainProjectAccount): boolean {
  if (project.founderBps + project.devPoolBps !== BPS_TOTAL_ONCHAIN) return false;
  return project.committedBps + project.allocatedBps <= project.devPoolBps;
}
