import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  SEED_PROJECT,
  SEED_TASK,
  SEED_CONTRIBUTION,
  SEED_MEMBER,
  asciiSeed,
  u64le,
  u8byte,
  projectSeeds,
  taskSeeds,
  contributionSeeds,
  memberSeeds,
  seedsToHex,
} from '../src/lib/solana/pda';

const key = (fill: number) => new Uint8Array(32).fill(fill);

describe('PDA seed encoding (P1 STEP 2, Rust parity)', () => {
  it('freezes the seed prefixes and their byte lengths', () => {
    assert.equal(SEED_PROJECT, 'project');
    assert.equal(SEED_TASK, 'task');
    assert.equal(SEED_CONTRIBUTION, 'contribution');
    assert.equal(SEED_MEMBER, 'member');
    assert.equal(asciiSeed(SEED_PROJECT).length, 7);
    assert.equal(asciiSeed(SEED_TASK).length, 4);
    assert.equal(asciiSeed(SEED_CONTRIBUTION).length, 12);
    assert.equal(asciiSeed(SEED_MEMBER).length, 6);
  });

  it('encodes u64 seeds little-endian exactly like Rust to_le_bytes()', () => {
    assert.deepEqual(Array.from(u64le(0)), [0, 0, 0, 0, 0, 0, 0, 0]);
    assert.deepEqual(Array.from(u64le(1)), [1, 0, 0, 0, 0, 0, 0, 0]);
    // 258 = 0x0102 -> low byte first
    assert.deepEqual(Array.from(u64le(258)), [2, 1, 0, 0, 0, 0, 0, 0]);
    assert.deepEqual(Array.from(u64le(4294967296)), [0, 0, 0, 0, 1, 0, 0, 0]);
  });

  it('handles ids above 2^31 without 32-bit truncation', () => {
    // A bit-shift implementation would return zeroes here.
    assert.deepEqual(Array.from(u64le(2147483648)), [0, 0, 0, 128, 0, 0, 0, 0]);
  });

  it('rejects seed values a u64 cannot hold', () => {
    assert.throws(() => u64le(-1), RangeError);
    assert.throws(() => u64le(1.5), RangeError);
    assert.throws(() => u64le(18446744073709551616n), RangeError);
  });

  it('encodes the attempt seed as exactly one raw byte', () => {
    assert.deepEqual(Array.from(u8byte(1)), [1]);
    assert.deepEqual(Array.from(u8byte(255)), [255]);
    assert.equal(u8byte(7).length, 1, 'never a decimal string such as "7"');
    assert.throws(() => u8byte(256), RangeError);
    assert.throws(() => u8byte(-1), RangeError);
  });

  it('keeps the frozen seed order for every account', () => {
    const project = projectSeeds(key(1), 1);
    assert.equal(project.length, 3);
    assert.deepEqual(Array.from(project[0]), Array.from(asciiSeed('project')));
    assert.deepEqual(Array.from(project[1]), Array.from(key(1)));
    assert.deepEqual(Array.from(project[2]), Array.from(u64le(1)));

    const task = taskSeeds(key(2), 3);
    assert.equal(task.length, 3);
    assert.deepEqual(Array.from(task[0]), Array.from(asciiSeed('task')));

    const contribution = contributionSeeds(key(3), key(4), 2);
    assert.equal(contribution.length, 4);
    assert.deepEqual(Array.from(contribution[0]), Array.from(asciiSeed('contribution')));
    assert.deepEqual(Array.from(contribution[1]), Array.from(key(3)));
    assert.deepEqual(Array.from(contribution[2]), Array.from(key(4)));
    assert.deepEqual(Array.from(contribution[3]), [2]);

    const member = memberSeeds(key(5), key(6));
    assert.equal(member.length, 3);
    assert.deepEqual(Array.from(member[0]), Array.from(asciiSeed('member')));
  });

  it('gives every seed list the exact byte length the freeze specifies', () => {
    const total = (seeds: Uint8Array[]) => seeds.reduce((sum, s) => sum + s.length, 0);
    assert.equal(total(projectSeeds(key(1), 1)), 7 + 32 + 8);
    assert.equal(total(taskSeeds(key(1), 1)), 4 + 32 + 8);
    assert.equal(total(contributionSeeds(key(1), key(2), 1)), 12 + 32 + 32 + 1);
    assert.equal(total(memberSeeds(key(1), key(2))), 6 + 32 + 32);
  });

  it('produces different seeds per attempt so each retry gets its own account', () => {
    const a1 = seedsToHex(contributionSeeds(key(1), key(2), 1));
    const a2 = seedsToHex(contributionSeeds(key(1), key(2), 2));
    assert.notEqual(a1, a2);
  });

  it('produces different seeds per contributor for the same task and attempt', () => {
    const alice = seedsToHex(contributionSeeds(key(1), key(2), 1));
    const bob = seedsToHex(contributionSeeds(key(1), key(3), 1));
    assert.notEqual(alice, bob);
  });

  it('is deterministic: the same inputs always give the same bytes', () => {
    assert.equal(
      seedsToHex(projectSeeds(key(9), 42)),
      seedsToHex(projectSeeds(key(9), 42)),
    );
  });
});
