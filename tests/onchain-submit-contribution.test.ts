import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  APPROVE_CONTRIBUTION_DISCRIMINATOR,
  SUBMIT_CONTRIBUTION_DISCRIMINATOR,
  encodeSubmitContributionData,
} from '../src/providers/solana/live';

// Wire format for submit_contribution, read from the IDL:
// args are attempt u8 then evidence_hash [u8; 32].
const EVIDENCE = new Uint8Array(32).fill(7);

test('submit_contribution discriminator is the frozen IDL value', () => {
  assert.deepEqual(SUBMIT_CONTRIBUTION_DISCRIMINATOR, [123, 132, 230, 253, 141, 22, 214, 91]);
});

test('approve_contribution discriminator is the frozen IDL value', () => {
  assert.deepEqual(APPROVE_CONTRIBUTION_DISCRIMINATOR, [202, 161, 21, 234, 88, 85, 197, 7]);
});

test('payload is exactly 41 bytes', () => {
  assert.equal(encodeSubmitContributionData(1, EVIDENCE).length, 41);
});

test('layout is discriminator, then attempt, then evidence hash', () => {
  const data = encodeSubmitContributionData(3, EVIDENCE);
  assert.deepEqual(Array.from(data.slice(0, 8)), SUBMIT_CONTRIBUTION_DISCRIMINATOR);
  assert.equal(data[8], 3);
  assert.deepEqual(Array.from(data.slice(9, 41)), Array.from(EVIDENCE));
});

test('attempt zero is encoded as a real byte, not skipped', () => {
  const data = encodeSubmitContributionData(0, EVIDENCE);
  assert.equal(data.length, 41);
  assert.equal(data[8], 0);
});

test('a hash that is not 32 bytes is refused', () => {
  assert.throws(() => encodeSubmitContributionData(1, new Uint8Array(31)), RangeError);
  assert.throws(() => encodeSubmitContributionData(1, new Uint8Array(33)), RangeError);
});

test('an attempt that does not fit in one byte is refused', () => {
  assert.throws(() => encodeSubmitContributionData(256, EVIDENCE), RangeError);
  assert.throws(() => encodeSubmitContributionData(-1, EVIDENCE), RangeError);
  assert.throws(() => encodeSubmitContributionData(1.5, EVIDENCE), RangeError);
});
