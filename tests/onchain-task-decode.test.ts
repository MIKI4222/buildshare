import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  decodeTaskAccount,
  TASK_ACCOUNT_LEN,
  TASK_STATUS_NAMES,
} from '../src/lib/solana/decode';

const PROJECT = new Uint8Array(32).fill(7);
const CONTRIBUTOR = new Uint8Array(32).fill(9);

// Builds a Task account the way Borsh actually writes one: the tail after a
// None contributor stays zeroed, and every later field shifts by 32 bytes.
function buildTaskAccount(values: {
  taskId?: bigint;
  statusCode?: number;
  rewardBps?: number;
  attempt?: number;
  contributor?: Uint8Array | null;
  claimedAt?: bigint;
  claimExpiresAt?: bigint;
  reservedCommitted?: number;
  bump?: number;
}): Uint8Array {
  const data = new Uint8Array(TASK_ACCOUNT_LEN);
  const view = new DataView(data.buffer);
  data.set([79, 34, 229, 55, 88, 90, 55, 84], 0);
  data.set(PROJECT, 8);
  view.setBigUint64(40, values.taskId === undefined ? 0n : values.taskId, true);
  data[48] = values.statusCode === undefined ? 0 : values.statusCode;
  view.setUint16(49, values.rewardBps === undefined ? 1000 : values.rewardBps, true);
  data[51] = values.attempt === undefined ? 0 : values.attempt;

  const contributor = values.contributor === undefined ? null : values.contributor;
  let at: number;
  if (contributor === null) {
    data[52] = 0;
    at = 53;
  } else {
    data[52] = 1;
    data.set(contributor, 53);
    at = 85;
  }

  view.setBigInt64(at, values.claimedAt === undefined ? 0n : values.claimedAt, true);
  at += 8;
  view.setBigInt64(at, values.claimExpiresAt === undefined ? 0n : values.claimExpiresAt, true);
  at += 8;
  data.fill(0xaa, at, at + 32);
  at += 32;
  data.fill(0xbb, at, at + 32);
  at += 32;
  data.fill(0xcc, at, at + 32);
  at += 32;
  data[at] = values.reservedCommitted === undefined ? 1 : values.reservedCommitted;
  at += 1;
  data[at] = values.bump === undefined ? 254 : values.bump;
  return data;
}

test('decodeTaskAccount reads a claimed task at the Some offsets', () => {
  const task = decodeTaskAccount(
    buildTaskAccount({
      taskId: 3n,
      statusCode: 1,
      rewardBps: 2500,
      attempt: 2,
      contributor: CONTRIBUTOR,
      claimedAt: 1757000000n,
      claimExpiresAt: 1757604800n,
      bump: 250,
    }),
  );
  assert.equal(task.taskId, '3');
  assert.equal(task.status, 'CLAIMED');
  assert.equal(task.statusCode, 1);
  assert.equal(task.rewardBps, 2500);
  assert.equal(task.attempt, 2);
  assert.equal(task.contributor, decodeTaskAccount(
    buildTaskAccount({ contributor: CONTRIBUTOR }),
  ).contributor);
  assert.equal(task.claimedAt, '1757000000');
  assert.equal(task.claimExpiresAt, '1757604800');
  assert.equal(task.acceptanceCriteriaHash, 'aa'.repeat(32));
  assert.equal(task.repoRefHash, 'bb'.repeat(32));
  assert.equal(task.commitmentHash, 'cc'.repeat(32));
  assert.equal(task.reservedCommitted, true);
  assert.equal(task.bump, 250);
});

// This is the case a fixed-offset decoder gets wrong, and the one create_task
// has to verify: a brand new task has no contributor yet.
test('decodeTaskAccount shifts by 32 bytes when there is no contributor', () => {
  const task = decodeTaskAccount(
    buildTaskAccount({
      taskId: 0n,
      statusCode: 0,
      rewardBps: 1000,
      contributor: null,
      claimedAt: 0n,
      claimExpiresAt: 0n,
      reservedCommitted: 0,
      bump: 253,
    }),
  );
  assert.equal(task.contributor, null);
  assert.equal(task.taskId, '0');
  assert.equal(task.status, 'OPEN');
  assert.equal(task.claimedAt, '0');
  assert.equal(task.acceptanceCriteriaHash, 'aa'.repeat(32));
  assert.equal(task.commitmentHash, 'cc'.repeat(32));
  assert.equal(task.reservedCommitted, false);
  assert.equal(task.bump, 253);
});

test('decodeTaskAccount reads a task id above 2^32', () => {
  const task = decodeTaskAccount(buildTaskAccount({ taskId: 4294967296n, contributor: null }));
  assert.equal(task.taskId, '4294967296');
});

test('decodeTaskAccount refuses an account of the wrong size', () => {
  assert.throws(() => decodeTaskAccount(new Uint8Array(198)), /199 bytes/);
  assert.throws(() => decodeTaskAccount(new Uint8Array(0)), /Refusing to decode/);
});

test('decodeTaskAccount refuses an unknown status instead of guessing', () => {
  assert.throws(() => decodeTaskAccount(buildTaskAccount({ statusCode: 7 })), /Unknown TaskStatus/);
  assert.equal(TASK_STATUS_NAMES.length, 7);
});

test('decodeTaskAccount refuses a corrupt Option tag and a corrupt bool', () => {
  const badTag = buildTaskAccount({ contributor: null });
  badTag[52] = 2;
  assert.throws(() => decodeTaskAccount(badTag), /Option tag/);

  const badBool = buildTaskAccount({ contributor: null });
  badBool[53 + 8 + 8 + 96] = 5;
  assert.throws(() => decodeTaskAccount(badBool), /reserved_committed/);
});

test('decodeTaskAccount refuses a reward above the total', () => {
  assert.throws(
    () => decodeTaskAccount(buildTaskAccount({ rewardBps: 10001, contributor: null })),
    /above the total/,
  );
});

test('the frozen status order matches state/task.rs', () => {
  assert.deepEqual(Array.from(TASK_STATUS_NAMES), [
    'OPEN',
    'CLAIMED',
    'SUBMITTED',
    'REJECTED',
    'EXPIRED',
    'COMPLETED',
    'CANCELLED',
  ]);
});
