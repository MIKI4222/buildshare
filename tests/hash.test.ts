import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { canonicalize, isHash, sha256Canonical, sha256Text, shortHash } from '../src/domain/hash';
import {
  buildEvidenceV1,
  canonicalEvidenceJSON,
  computeAIEvaluationHash,
  computeEvidenceHash,
  EVIDENCE_SCHEMA_VERSION,
} from '../src/domain/evidence';
import {
  claimExpiryFrom,
  computeCommitmentHashes,
  hashAcceptanceCriteria,
  isClaimExpired,
  normalizeAcceptanceCriteria,
} from '../src/domain/commitment';

const evidenceInput = {
  projectId: 'prj_1',
  taskId: 'tsk_1',
  taskExternalKey: 'BUILD-001',
  acceptanceCriteriaHash: 'a'.repeat(64),
  rewardBps: 1000,
  repositoryFullName: 'acme/repo',
  baseBranch: 'main',
  prNumber: 17,
  mergeCommitSha: 'c'.repeat(40),
  contributorGithubId: '1002',
  contributorWallet: 'AliceWallet111111111111111111111111111111',
  aiEvaluationHash: 'b'.repeat(64),
  approvedByWallet: 'FounderWallet1111111111111111111111111111',
  approvedAt: '2026-01-10T00:00:00.000Z',
};

const commitmentInput = {
  projectId: 'prj_1',
  taskId: 'tsk_1',
  taskExternalKey: 'BUILD-001',
  acceptanceCriteria: 'Criterion one\nCriterion two',
  rewardBps: 1000,
  repositoryFullName: 'acme/repo',
  baseBranch: 'main',
  contributorWallet: 'AliceWallet111111111111111111111111111111',
  attempt: 1,
};

describe('canonicalization', () => {
  it('sorts object keys so that key order does not change the hash', () => {
    assert.equal(canonicalize({ b: 1, a: 2 }), canonicalize({ a: 2, b: 1 }));
  });

  it('produces a stable string for nested structures', () => {
    const left = canonicalize({ outer: { z: [1, 2], a: 'x' } });
    const right = canonicalize({ outer: { a: 'x', z: [1, 2] } });
    assert.equal(left, right);
  });

  it('preserves array order', () => {
    assert.notEqual(canonicalize({ a: [1, 2] }), canonicalize({ a: [2, 1] }));
  });

  it('drops undefined values', () => {
    assert.equal(canonicalize({ a: 1, b: undefined }), canonicalize({ a: 1 }));
  });

  it('keeps null values distinct from missing values', () => {
    assert.notEqual(canonicalize({ a: 1, b: null }), canonicalize({ a: 1 }));
  });

  it('distinguishes a number from its string form', () => {
    assert.notEqual(canonicalize({ a: 1 }), canonicalize({ a: '1' }));
  });
});

describe('sha256', () => {
  it('matches the known SHA-256 digest of "abc"', async () => {
    assert.equal(
      await sha256Text('abc'),
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('returns 64 lowercase hex characters', async () => {
    const hash = await sha256Text('buildshare');
    assert.match(hash, /^[0-9a-f]{64}$/);
    assert.ok(isHash(hash));
  });

  it('is deterministic for identical input', async () => {
    assert.equal(await sha256Text('same'), await sha256Text('same'));
  });

  it('changes completely for a one character difference', async () => {
    assert.notEqual(await sha256Text('same'), await sha256Text('samf'));
  });

  it('hashes canonical objects independently of key order', async () => {
    assert.equal(await sha256Canonical({ a: 1, b: 2 }), await sha256Canonical({ b: 2, a: 1 }));
  });

  it('rejects non hex strings in isHash', () => {
    assert.equal(isHash('zz'), false);
    assert.equal(isHash('a'.repeat(63)), false);
  });

  it('shortens a hash for display without inventing characters', async () => {
    const hash = await sha256Text('display');
    const short = shortHash(hash);
    assert.ok(hash.startsWith(short.split('...')[0]));
  });
});

describe('evidence hashing', () => {
  it('stamps the schema version', () => {
    assert.equal(buildEvidenceV1(evidenceInput).schemaVersion, EVIDENCE_SCHEMA_VERSION);
  });

  it('contains exactly the 15 evidence v1 fields', () => {
    assert.equal(Object.keys(buildEvidenceV1(evidenceInput)).length, 15);
  });

  it('emits canonical JSON with sorted keys', () => {
    const json = canonicalEvidenceJSON(evidenceInput);
    assert.ok(json.startsWith('{"acceptanceCriteriaHash"'));
  });

  it('is deterministic', async () => {
    assert.equal(await computeEvidenceHash(evidenceInput), await computeEvidenceHash(evidenceInput));
  });

  it('changes when the reward changes', async () => {
    const other = { ...evidenceInput, rewardBps: 1001 };
    assert.notEqual(await computeEvidenceHash(evidenceInput), await computeEvidenceHash(other));
  });

  it('changes when the merge commit changes', async () => {
    const other = { ...evidenceInput, mergeCommitSha: 'd'.repeat(40) };
    assert.notEqual(await computeEvidenceHash(evidenceInput), await computeEvidenceHash(other));
  });

  it('changes when the acceptance criteria hash changes', async () => {
    const other = { ...evidenceInput, acceptanceCriteriaHash: 'e'.repeat(64) };
    assert.notEqual(await computeEvidenceHash(evidenceInput), await computeEvidenceHash(other));
  });

  it('hashes the AI evaluation separately', async () => {
    const hash = await computeAIEvaluationHash({
      model: 'm',
      promptVersion: 'buildshare-ai-v1',
      overallScore: 94,
      recommendation: 'APPROVE',
      rawResponse: '{}',
    });
    assert.ok(isHash(hash));
  });

  it('produces a different AI evaluation hash for a different score', async () => {
    const base = { model: 'm', promptVersion: 'v', recommendation: 'APPROVE', rawResponse: '{}' };
    const a = await computeAIEvaluationHash({ ...base, overallScore: 94 });
    const b = await computeAIEvaluationHash({ ...base, overallScore: 95 });
    assert.notEqual(a, b);
  });
});

describe('commitment hashing', () => {
  it('normalizes cosmetic whitespace only', () => {
    assert.equal(
      normalizeAcceptanceCriteria('  a  b \n\n c '),
      normalizeAcceptanceCriteria('a b\nc'),
    );
  });

  it('does not normalize away wording changes', () => {
    assert.notEqual(normalizeAcceptanceCriteria('a b'), normalizeAcceptanceCriteria('a c'));
  });

  it('produces a stable acceptance criteria hash', async () => {
    const a = await hashAcceptanceCriteria('Criterion one\nCriterion two');
    const b = await hashAcceptanceCriteria('  Criterion one \n\n Criterion two  ');
    assert.equal(a, b);
  });

  it('produces both hashes with the correct shape', async () => {
    const hashes = await computeCommitmentHashes(commitmentInput);
    assert.ok(isHash(hashes.acceptanceCriteriaHash));
    assert.ok(isHash(hashes.commitmentHash));
  });

  it('binds the commitment to the reward', async () => {
    const a = await computeCommitmentHashes(commitmentInput);
    const b = await computeCommitmentHashes({ ...commitmentInput, rewardBps: 900 });
    assert.notEqual(a.commitmentHash, b.commitmentHash);
  });

  it('binds the commitment to the contributor wallet', async () => {
    const a = await computeCommitmentHashes(commitmentInput);
    const b = await computeCommitmentHashes({ ...commitmentInput, contributorWallet: 'BobWallet11111111111111111111111111111111' });
    assert.notEqual(a.commitmentHash, b.commitmentHash);
  });

  it('binds the commitment to the attempt number', async () => {
    const a = await computeCommitmentHashes(commitmentInput);
    const b = await computeCommitmentHashes({ ...commitmentInput, attempt: 2 });
    assert.notEqual(a.commitmentHash, b.commitmentHash);
  });

  it('computes the claim expiry from the claim time', () => {
    assert.equal(
      claimExpiryFrom('2026-01-01T00:00:00.000Z', 7),
      '2026-01-08T00:00:00.000Z',
    );
  });

  it('reports an unexpired claim as active', () => {
    assert.equal(
      isClaimExpired({ claimExpiresAt: '2026-01-08T00:00:00.000Z' }, '2026-01-07T23:59:59.000Z'),
      false,
    );
  });

  it('reports an expired claim as expired', () => {
    assert.equal(
      isClaimExpired({ claimExpiresAt: '2026-01-08T00:00:00.000Z' }, '2026-01-08T00:00:01.000Z'),
      true,
    );
  });
});
