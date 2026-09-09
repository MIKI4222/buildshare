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
  INITIALIZE_PROJECT_DISCRIMINATOR,
  encodeInitializeProjectData,
} from '../src/providers/solana/live';
import { u16le, u64le } from '../src/lib/solana/pda';

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

describe('initialize_project discriminator and instruction data', () => {
  it('the pinned discriminator is sha256 of its global name', () => {
    assert.deepEqual(
      INITIALIZE_PROJECT_DISCRIMINATOR,
      anchorDiscriminator('initialize_project'),
    );
  });

  it('instruction data is exactly 20 bytes', () => {
    assert.equal(encodeInitializeProjectData(1, 4_000, 6_000).length, 20);
  });

  it('lays out discriminator, u64 LE id, then two u16 LE splits', () => {
    const data = encodeInitializeProjectData(7, 4_000, 6_000);
    assert.deepEqual(Array.from(data.subarray(0, 8)), INITIALIZE_PROJECT_DISCRIMINATOR);
    assert.deepEqual(Array.from(data.subarray(8, 16)), Array.from(u64le(7)));
    assert.deepEqual(Array.from(data.subarray(16, 18)), Array.from(u16le(4_000)));
    assert.deepEqual(Array.from(data.subarray(18, 20)), Array.from(u16le(6_000)));
  });

  it('encodes ids above 2^31 without corruption', () => {
    const data = encodeInitializeProjectData(649_825_720_450, 4_000, 6_000);
    assert.deepEqual(Array.from(data.subarray(8, 16)), Array.from(u64le(649_825_720_450)));
  });

  it('refuses basis points outside u16', () => {
    assert.throws(() => encodeInitializeProjectData(1, -1, 6_000), RangeError);
    assert.throws(() => encodeInitializeProjectData(1, 70_000, 6_000), RangeError);
  });

  it('does not collide with the other discriminators', () => {
    assert.notDeepEqual(INITIALIZE_PROJECT_DISCRIMINATOR, ALLOCATE_OWNERSHIP_DISCRIMINATOR);
    assert.notDeepEqual(INITIALIZE_PROJECT_DISCRIMINATOR, CREATE_MEMBER_DISCRIMINATOR);
  });
});
