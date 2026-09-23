import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  base58Encode,
  decodeProjectAccount,
  projectInvariantsHold,
  PROJECT_ACCOUNT_LEN,
} from '../src/lib/solana/decode';

function buildProjectAccount(values: {
  founder?: Uint8Array;
  projectId?: bigint;
  founderBps?: number;
  devPoolBps?: number;
  committedBps?: number;
  allocatedBps?: number;
  taskCount?: bigint;
  memberCount?: number;
  bump?: number;
}): Uint8Array {
  const data = new Uint8Array(PROJECT_ACCOUNT_LEN);
  const view = new DataView(data.buffer);
  data.set(values.founder || new Uint8Array(32), 8);
  let o = 40;
  view.setBigUint64(o, values.projectId === undefined ? 0n : values.projectId, true);
  o += 8;
  view.setUint16(o, values.founderBps === undefined ? 4000 : values.founderBps, true);
  o += 2;
  view.setUint16(o, values.devPoolBps === undefined ? 6000 : values.devPoolBps, true);
  o += 2;
  view.setUint16(o, values.committedBps === undefined ? 0 : values.committedBps, true);
  o += 2;
  view.setUint16(o, values.allocatedBps === undefined ? 0 : values.allocatedBps, true);
  o += 2;
  view.setBigUint64(o, values.taskCount === undefined ? 0n : values.taskCount, true);
  o += 8;
  view.setUint32(o, values.memberCount === undefined ? 0 : values.memberCount, true);
  o += 4;
  view.setUint8(o, values.bump === undefined ? 255 : values.bump);
  return data;
}

test('base58Encode maps 32 zero bytes to the System Program address', () => {
  assert.equal(base58Encode(new Uint8Array(32)), '11111111111111111111111111111111');
});

test('base58Encode round-trips a known vector', () => {
  // 0x00 0x01 0x02 -> leading zero becomes '1'
  assert.equal(base58Encode(new Uint8Array([0, 1, 2])), '15T');
});

test('decodeProjectAccount reads the frozen field order', () => {
  const founder = new Uint8Array(32);
  founder[31] = 1;
  const data = buildProjectAccount({
    founder,
    projectId: 649825720450n,
    committedBps: 1000,
    allocatedBps: 2000,
    taskCount: 4n,
    memberCount: 3,
    bump: 254,
  });
  const project = decodeProjectAccount(data);
  assert.equal(project.founder, base58Encode(founder));
  assert.equal(project.projectId, '649825720450');
  assert.equal(project.founderBps, 4000);
  assert.equal(project.devPoolBps, 6000);
  assert.equal(project.committedBps, 1000);
  assert.equal(project.allocatedBps, 2000);
  assert.equal(project.taskCount, '4');
  assert.equal(project.memberCount, 3);
  assert.equal(project.bump, 254);
  assert.equal(project.remainingBps, 3000);
});

test('decodeProjectAccount refuses an account of the wrong size', () => {
  assert.throws(() => decodeProjectAccount(new Uint8Array(100)), /101 bytes/);
  assert.throws(() => decodeProjectAccount(new Uint8Array(0)), /Refusing to decode/);
});

test('decodeProjectAccount refuses a pool overdraft instead of reporting it', () => {
  const data = buildProjectAccount({ committedBps: 5000, allocatedBps: 2000 });
  assert.throws(() => decodeProjectAccount(data), /pool invariant/);
});

test('projectInvariantsHold enforces the basis-point split', () => {
  const ok = decodeProjectAccount(buildProjectAccount({ allocatedBps: 1000 }));
  assert.equal(projectInvariantsHold(ok), true);
  const skewed = decodeProjectAccount(buildProjectAccount({ founderBps: 3000 }));
  assert.equal(projectInvariantsHold(skewed), false);
});
