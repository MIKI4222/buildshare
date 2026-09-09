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

export const TASK_DATA_LEN = 191;
export const TASK_ACCOUNT_LEN = DISCRIMINATOR_LEN + TASK_DATA_LEN; // 199

// FROZEN discriminants, mirrored from state/task.rs. The index IS the on-chain
// value, so this array must never be reordered.
export const TASK_STATUS_NAMES = [
  'OPEN',
  'CLAIMED',
  'SUBMITTED',
  'REJECTED',
  'EXPIRED',
  'COMPLETED',
  'CANCELLED',
] as const;

export type OnchainTaskStatus = (typeof TASK_STATUS_NAMES)[number];

export interface OnchainTaskAccount {
  project: string;
  taskId: string;
  status: OnchainTaskStatus;
  statusCode: number;
  rewardBps: number;
  attempt: number;
  contributor: string | null;
  claimedAt: string;
  claimExpiresAt: string;
  acceptanceCriteriaHash: string;
  repoRefHash: string;
  commitmentHash: string;
  reservedCommitted: boolean;
  bump: number;
}

function toHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 1) {
    out += bytes[i].toString(16).padStart(2, '0');
  }
  return out;
}

// Unlike Project, the Task layout is NOT fixed-offset: `contributor` is a Borsh
// Option, which is 1 byte when None and 33 bytes when Some. Task::LEN is the
// space reserved for the largest case, not the length actually written, so the
// account stays 199 bytes while its tail is zeroed. Every field after the
// option therefore shifts by 32 bytes, and the offset is derived from the tag
// instead of being hard-coded. Getting this wrong would silently misread a
// freshly created, unclaimed task - exactly the account create_task must verify.
export function decodeTaskAccount(data: Uint8Array): OnchainTaskAccount {
  if (data.length !== TASK_ACCOUNT_LEN) {
    throw new Error(
      'Refusing to decode a Task account of ' + data.length +
        ' bytes: the frozen layout is ' + TASK_ACCOUNT_LEN + ' bytes.',
    );
  }
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

  const project = base58Encode(data.subarray(8, 40));
  const taskId = view.getBigUint64(40, true).toString();

  const statusCode = data[48];
  if (statusCode >= TASK_STATUS_NAMES.length) {
    throw new Error('Unknown TaskStatus discriminant: ' + statusCode);
  }
  const status = TASK_STATUS_NAMES[statusCode];

  const rewardBps = view.getUint16(49, true);
  if (rewardBps > BPS_TOTAL_ONCHAIN) {
    throw new Error('Refusing a Task reward above the total: ' + rewardBps);
  }
  const attempt = data[51];

  const tag = data[52];
  if (tag !== 0 && tag !== 1) {
    throw new Error('Invalid Borsh Option tag for contributor: ' + tag);
  }
  const contributor = tag === 1 ? base58Encode(data.subarray(53, 85)) : null;

  let at = tag === 1 ? 85 : 53;
  const claimedAt = view.getBigInt64(at, true).toString();
  at += 8;
  const claimExpiresAt = view.getBigInt64(at, true).toString();
  at += 8;
  const acceptanceCriteriaHash = toHex(data.subarray(at, at + 32));
  at += 32;
  const repoRefHash = toHex(data.subarray(at, at + 32));
  at += 32;
  const commitmentHash = toHex(data.subarray(at, at + 32));
  at += 32;

  const reservedByte = data[at];
  if (reservedByte !== 0 && reservedByte !== 1) {
    throw new Error('Invalid Borsh bool for reserved_committed: ' + reservedByte);
  }
  at += 1;
  const bump = data[at];

  return {
    project,
    taskId,
    status,
    statusCode,
    rewardBps,
    attempt,
    contributor,
    claimedAt,
    claimExpiresAt,
    acceptanceCriteriaHash,
    repoRefHash,
    commitmentHash,
    reservedCommitted: reservedByte === 1,
    bump,
  };
}
