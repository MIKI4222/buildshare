import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';

import {
  REJECT_CONTRIBUTION_DISCRIMINATOR,
  encodeRejectContributionData,
} from '../src/providers/solana/live';

test('reject_contribution discriminator is the frozen Anchor value', () => {
  const expected = Array.from(
    createHash('sha256')
      .update('global:reject_contribution')
      .digest()
      .subarray(0, 8),
  );
  assert.deepEqual(
    REJECT_CONTRIBUTION_DISCRIMINATOR,
    [119, 66, 240, 138, 76, 79, 25, 155],
  );
  assert.deepEqual(REJECT_CONTRIBUTION_DISCRIMINATOR, expected);
});

test('reject_contribution payload is discriminator then reason hash', () => {
  const reason = new Uint8Array(32).fill(0xab);
  const data = encodeRejectContributionData(reason);
  assert.equal(data.length, 40);
  assert.deepEqual(
    Array.from(data.subarray(0, 8)),
    REJECT_CONTRIBUTION_DISCRIMINATOR,
  );
  assert.deepEqual(
    Array.from(data.subarray(8, 40)),
    Array.from(reason),
  );
});

test('reject_contribution refuses wrong-length and zero hashes', () => {
  assert.throws(
    () => encodeRejectContributionData(new Uint8Array(31)),
    RangeError,
  );
  assert.throws(
    () => encodeRejectContributionData(new Uint8Array(33)),
    RangeError,
  );
  assert.throws(
    () => encodeRejectContributionData(new Uint8Array(32)),
    /zero hash/,
  );
});

// Deliberately not added to the browser-proven discriminator list.
// That list changes only after a real public Devnet signature and read-back.
