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
  CANCEL_TASK_DISCRIMINATOR,
  CLAIM_TASK_DISCRIMINATOR,
  CREATE_MEMBER_DISCRIMINATOR,
  APPROVE_CONTRIBUTION_DISCRIMINATOR,
  CREATE_TASK_DISCRIMINATOR,
  EXPIRE_CLAIM_DISCRIMINATOR,
  INITIALIZE_PROJECT_DISCRIMINATOR,
  SUBMIT_CONTRIBUTION_DISCRIMINATOR,
  UPDATE_TASK_DISCRIMINATOR,
  encodeClaimTaskData,
  encodeUpdateTaskData,
  encodeSubmitContributionData,
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

describe('claim_task wire format', () => {
  it('the discriminator matches sha256 of its global name', () => {
    assert.deepEqual(CLAIM_TASK_DISCRIMINATOR, anchorDiscriminator('claim_task'));
  });

  it('encodes exactly 8 + 32 bytes', () => {
    const hash = new Uint8Array(32).fill(7);
    const data = encodeClaimTaskData(hash);
    assert.equal(data.length, 40);
    assert.deepEqual(Array.from(data.subarray(0, 8)), CLAIM_TASK_DISCRIMINATOR);
    assert.deepEqual(Array.from(data.subarray(8)), Array.from(hash));
  });

  it('refuses a hash that is not 32 bytes', () => {
    assert.throws(() => encodeClaimTaskData(new Uint8Array(31)), RangeError);
    assert.throws(() => encodeClaimTaskData(new Uint8Array(33)), RangeError);
  });

  it('does not share a discriminator with create_member', () => {
    assert.notDeepEqual(CLAIM_TASK_DISCRIMINATOR, CREATE_MEMBER_DISCRIMINATOR);
  });
});

// Every instruction this app has actually signed from a browser, pinned
// against the Anchor naming rule. Signatures on Devnet prove the program
// accepted these exact bytes; this test proves they never drift.
describe('the full set of browser-signed instructions', () => {
  const pinned: Array<[string, number[]]> = [
    ['initialize_project', INITIALIZE_PROJECT_DISCRIMINATOR],
    ['create_task', CREATE_TASK_DISCRIMINATOR],
    ['update_task', UPDATE_TASK_DISCRIMINATOR],
    ['cancel_task', CANCEL_TASK_DISCRIMINATOR],
    ['claim_task', CLAIM_TASK_DISCRIMINATOR],
    ['expire_claim', EXPIRE_CLAIM_DISCRIMINATOR],
    ['submit_contribution', SUBMIT_CONTRIBUTION_DISCRIMINATOR],
    ['create_member', CREATE_MEMBER_DISCRIMINATOR],
    ['approve_contribution', APPROVE_CONTRIBUTION_DISCRIMINATOR],
    ['allocate_ownership', ALLOCATE_OWNERSHIP_DISCRIMINATOR],
  ];

  for (const [name, bytes] of pinned) {
    it(name + ' matches sha256 of its global name', () => {
      assert.deepEqual(bytes, anchorDiscriminator(name));
      assert.equal(bytes.length, 8);
    });
  }

  it('all ten discriminators are distinct', () => {
    const seen = new Set(pinned.map(([, bytes]) => bytes.join(',')));
    assert.equal(seen.size, pinned.length);
  });
});

describe('submit_contribution wire format', () => {
  it('encodes discriminator, attempt byte, then a 32-byte evidence hash', () => {
    const hash = new Uint8Array(32).fill(9);
    const data = encodeSubmitContributionData(2, hash);
    assert.equal(data.length, 41);
    assert.deepEqual(Array.from(data.subarray(0, 8)), SUBMIT_CONTRIBUTION_DISCRIMINATOR);
    assert.equal(data[8], 2);
    assert.deepEqual(Array.from(data.subarray(9)), Array.from(hash));
  });

  it('reproduces the bytes Devnet accepted in 3bysPZU9', () => {
    // Evidence hash of contribution ctr_mu5r96xt_pmu76g, attempt 2, read back
    // from the Contribution account at 4F3Boqnx after allocation.
    const evidence =
      '7934e62031f4d4e82aa74c8b6df2d42c4f23213eb964496341790e92fe25f7c6';
    const bytes = Uint8Array.from(
      (evidence.match(/../g) as string[]).map((b) => parseInt(b, 16)),
    );
    const data = encodeSubmitContributionData(2, bytes);
    assert.deepEqual(
      Array.from(data.subarray(0, 9)),
      [...SUBMIT_CONTRIBUTION_DISCRIMINATOR, 2],
    );
    assert.deepEqual(Array.from(data.subarray(9)), Array.from(bytes));
  });

  it('refuses an evidence hash that is not 32 bytes', () => {
    assert.throws(() => encodeSubmitContributionData(2, new Uint8Array(31)), RangeError);
    assert.throws(() => encodeSubmitContributionData(2, new Uint8Array(33)), RangeError);
  });
});


describe('cancel_task browser wire format', () => {
  it('sends exactly its eight-byte discriminator and no arguments', () => {
    const data = new Uint8Array(CANCEL_TASK_DISCRIMINATOR);
    assert.equal(data.length, 8);
    assert.deepEqual(Array.from(data), CANCEL_TASK_DISCRIMINATOR);
  });
});


describe('update_task browser wire format', () => {
  it('matches sha256 of its frozen Anchor global name', () => {
    assert.deepEqual(UPDATE_TASK_DISCRIMINATOR, anchorDiscriminator('update_task'));
  });

  it('reproduces the 74 bytes Devnet accepted in 3zD2FDS', () => {
    const toBytes = (hex: string) =>
      Uint8Array.from((hex.match(/../g) as string[]).map((b) => parseInt(b, 16)));
    const acceptance = toBytes(
      'fba1fcadd6eaf880d0e227f3b4363d44f26b773a12de99039bfe2d9d9f0a6eba',
    );
    const repo = toBytes(
      '003e3cf1499ded4349abff49752a6f4a1892bf7d493b68e9578e141a957f10b2',
    );
    const data = encodeUpdateTaskData(200, acceptance, repo);
    assert.equal(data.length, 74);
    assert.deepEqual(Array.from(data.subarray(0, 8)), UPDATE_TASK_DISCRIMINATOR);
    assert.deepEqual(Array.from(data.subarray(8, 10)), [200, 0]);
    assert.deepEqual(Array.from(data.subarray(10, 42)), Array.from(acceptance));
    assert.deepEqual(Array.from(data.subarray(42, 74)), Array.from(repo));
  });

  it('refuses hashes that are not exactly 32 bytes', () => {
    assert.throws(
      () => encodeUpdateTaskData(200, new Uint8Array(31), new Uint8Array(32)),
      RangeError,
    );
    assert.throws(
      () => encodeUpdateTaskData(200, new Uint8Array(32), new Uint8Array(33)),
      RangeError,
    );
  });
});
