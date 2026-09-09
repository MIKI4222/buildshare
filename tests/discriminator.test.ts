// Proves where the pinned instruction discriminators come from.
//
// Anchor computes them as the first eight bytes of sha256 of the string
// 'global:<instruction name>'. Pinning the bytes keeps the wire format stable;
// this test keeps the pinned bytes honest. Renaming an instruction on chain
// breaks this test instead of breaking production silently.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  ALLOCATE_OWNERSHIP_DISCRIMINATOR,
  CREATE_MEMBER_DISCRIMINATOR,
} from '../src/providers/solana/live';

function anchorDiscriminator(instruction: string): number[] {
  const digest = createHash('sha256').update('global:' + instruction).digest();
  return Array.from(digest.subarray(0, 8));
}

describe('anchor instruction discriminators', () => {
  it('allocate_ownership matches sha256 of its global name', () => {
    assert.deepEqual(
      ALLOCATE_OWNERSHIP_DISCRIMINATOR,
      anchorDiscriminator('allocate_ownership'),
    );
  });

  it('create_member matches sha256 of its global name', () => {
    assert.deepEqual(CREATE_MEMBER_DISCRIMINATOR, anchorDiscriminator('create_member'));
  });

  it('each discriminator is exactly eight bytes', () => {
    assert.equal(ALLOCATE_OWNERSHIP_DISCRIMINATOR.length, 8);
    assert.equal(CREATE_MEMBER_DISCRIMINATOR.length, 8);
  });

  it('the two instructions do not share a discriminator', () => {
    assert.notDeepEqual(ALLOCATE_OWNERSHIP_DISCRIMINATOR, CREATE_MEMBER_DISCRIMINATOR);
  });
});
