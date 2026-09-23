import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { CREATE_TASK_DISCRIMINATOR, encodeCreateTaskData } from '../src/providers/solana/live';
import {
  REPO_REF_SCHEMA_VERSION,
  hashRepoRef,
  normalizeRepoFullName,
} from '../src/domain/repo-ref';
import { HEX64 } from '../src/domain/hash';
import { DemoSolanaProvider } from '../src/providers/solana/demo';

const A = new Uint8Array(32).fill(0xaa);
const B = new Uint8Array(32).fill(0xbb);

test('create_task discriminator is the anchor hash of the instruction name', () => {
  const expected = createHash('sha256').update('global:create_task').digest().subarray(0, 8);
  assert.deepEqual(CREATE_TASK_DISCRIMINATOR, Array.from(expected));
});

test('encodeCreateTaskData lays the arguments out in IDL order', () => {
  const data = encodeCreateTaskData(3, 1000, A, B);
  assert.equal(data.length, 82);
  assert.deepEqual(Array.from(data.subarray(0, 8)), CREATE_TASK_DISCRIMINATOR);
  // task_id u64 little endian
  assert.deepEqual(Array.from(data.subarray(8, 16)), [3, 0, 0, 0, 0, 0, 0, 0]);
  // reward_bps u16 little endian: 1000 = 0x03e8
  assert.deepEqual(Array.from(data.subarray(16, 18)), [0xe8, 0x03]);
  assert.deepEqual(Array.from(data.subarray(18, 50)), Array.from(A));
  assert.deepEqual(Array.from(data.subarray(50, 82)), Array.from(B));
});

test('encodeCreateTaskData refuses a hash that is not 32 bytes', () => {
  assert.throws(() => encodeCreateTaskData(0, 1, new Uint8Array(31), B), RangeError);
  assert.throws(() => encodeCreateTaskData(0, 1, A, new Uint8Array(33)), RangeError);
});

test('encodeCreateTaskData accepts task id zero', () => {
  const data = encodeCreateTaskData(0, 1, A, B);
  assert.deepEqual(Array.from(data.subarray(8, 16)), [0, 0, 0, 0, 0, 0, 0, 0]);
});

test('hashRepoRef is deterministic and hex64', async () => {
  const one = await hashRepoRef('MIKI4222/buildshare', 'main');
  const two = await hashRepoRef('MIKI4222/buildshare', 'main');
  assert.equal(one, two);
  assert.ok(HEX64.test(one));
});

test('hashRepoRef ignores repository case but not branch case', async () => {
  const lower = await hashRepoRef('miki4222/buildshare', 'main');
  const upper = await hashRepoRef('  MIKI4222/BuildShare  ', 'main');
  assert.equal(lower, upper);
  const branch = await hashRepoRef('miki4222/buildshare', 'Main');
  assert.notEqual(lower, branch);
});

test('hashRepoRef refuses an empty reference', async () => {
  await assert.rejects(() => hashRepoRef('   ', 'main'));
  await assert.rejects(() => hashRepoRef('miki4222/buildshare', ''));
});

test('the repo ref schema version is frozen', () => {
  assert.equal(REPO_REF_SCHEMA_VERSION, 'buildshare-repo-ref-v1');
  assert.equal(normalizeRepoFullName(' A/B '), 'a/b');
});

test('the demo provider refuses to create a task on chain', async () => {
  const demo = new DemoSolanaProvider();
  await assert.rejects(
    () =>
      demo.createTask({
        projectId: 'p1',
        taskId: 't1',
        onchainProjectId: 1,
        onchainTaskId: 0,
        founderWallet: 'FounderWallet1111111111111111111111111111',
        rewardBps: 1000,
        acceptanceCriteriaHash: 'a'.repeat(64),
        repoRefHash: 'b'.repeat(64),
      }),
    (e: unknown) => (e as { code?: string }).code === 'LIVE_MODE_UNAVAILABLE',
  );
});
