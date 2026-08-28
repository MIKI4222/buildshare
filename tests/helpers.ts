// Shared test helpers. Deterministic clock and ids so every assertion is
// reproducible; no randomness, no self-referential fixtures.

import assert from 'node:assert/strict';
import type { Deps, PullRequestInput } from '../src/domain/reducers';
import { DomainError, type DomainErrorCode } from '../src/domain/errors';
import type { AppDB, User } from '../src/domain/types';

export const WALLETS = {
  founder: 'FounderWallet1111111111111111111111111111',
  alice: 'AliceWallet111111111111111111111111111111',
  bob: 'BobWallet11111111111111111111111111111111',
};

export const IDS = {
  founder: 'usr_founder',
  alice: 'usr_alice',
  bob: 'usr_bob',
};

// A real 88-character base58 signature shape, used only to test the validator.
export const VALID_SIGNATURE_SHAPE = '5'.repeat(88);
export const TEST_PROGRAM_ID = 'BSharE1111111111111111111111111111111111111';
export const SYSTEM_PROGRAM_ID = '11111111111111111111111111111111';

export interface TestDeps extends Deps {
  advanceDays: (days: number) => void;
  advanceMs: (ms: number) => void;
  current: () => string;
}

export function makeDeps(startIso = '2026-01-01T00:00:00.000Z'): TestDeps {
  let ms = Date.parse(startIso);
  let counter = 0;
  return {
    now: () => new Date(ms).toISOString(),
    newId: (prefix: string) => {
      counter += 1;
      return prefix + '_test_' + String(counter).padStart(4, '0');
    },
    advanceDays: (days: number) => {
      ms += days * 24 * 60 * 60 * 1000;
    },
    advanceMs: (delta: number) => {
      ms += delta;
    },
    current: () => new Date(ms).toISOString(),
  };
}

export function testUsers(): User[] {
  const createdAt = '2026-01-01T00:00:00.000Z';
  return [
    { id: IDS.founder, walletAddress: WALLETS.founder, githubUsername: 'founder', githubUserId: '1001', avatarUrl: null, createdAt },
    { id: IDS.alice, walletAddress: WALLETS.alice, githubUsername: 'alice', githubUserId: '1002', avatarUrl: null, createdAt },
    { id: IDS.bob, walletAddress: WALLETS.bob, githubUsername: 'bob', githubUserId: '1003', avatarUrl: null, createdAt },
  ];
}

export function emptyProjectDB(): AppDB {
  return {
    users: testUsers(),
    projects: [],
    members: [],
    tasks: [],
    pullRequests: [],
    contributions: [],
    evaluations: [],
    auditLogs: [],
  };
}

export function pullRequestFixture(prNumber: number): PullRequestInput {
  return {
    githubPrId: '19000000' + String(prNumber),
    githubPrNumber: prNumber,
    repository: 'buildshare-demo/ai-arbitration-escrow',
    authorGithubId: '1002',
    title: '[BUILD-001] Implement escrow',
    description: 'Implements the escrow program.',
    url: 'https://github.com/buildshare-demo/ai-arbitration-escrow/pull/' + prNumber,
    baseBranch: 'main',
    headBranch: 'feature/escrow-' + prNumber,
    additions: 100,
    deletions: 5,
    changedFiles: 4,
    mergeCommitSha: 'a'.repeat(39) + String(prNumber % 10),
    openedAt: '2026-01-02T00:00:00.000Z',
    mergedAt: '2026-01-03T00:00:00.000Z',
  };
}

export function verificationFixture(overrides: Partial<{ overallScore: number; recommendation: 'APPROVE' | 'REVIEW' | 'REJECT' }> = {}) {
  return {
    model: 'test-verifier',
    promptVersion: 'buildshare-ai-v1',
    requirementScore: 95,
    qualityScore: 90,
    testScore: 92,
    securityScore: 90,
    overallScore: overrides.overallScore !== undefined ? overrides.overallScore : 93,
    recommendation: overrides.recommendation || ('APPROVE' as const),
    reason: 'All acceptance criteria implemented.',
    codeSummary: '4 files changed.',
    rawResponse: '{"recommendation":"APPROVE"}',
    evaluationHash: 'b'.repeat(64),
  };
}

export function expectDomainError(fn: () => unknown, code: DomainErrorCode): DomainError {
  try {
    fn();
  } catch (e) {
    assert.ok(e instanceof DomainError, 'expected a DomainError, got ' + String(e));
    assert.equal((e as DomainError).code, code);
    return e as DomainError;
  }
  throw new assert.AssertionError({ message: 'expected a DomainError with code ' + code + ', but nothing was thrown' });
}

export async function expectDomainErrorAsync(
  fn: () => Promise<unknown>,
  code: DomainErrorCode,
): Promise<DomainError> {
  try {
    await fn();
  } catch (e) {
    assert.ok(e instanceof DomainError, 'expected a DomainError, got ' + String(e));
    assert.equal((e as DomainError).code, code);
    return e as DomainError;
  }
  throw new assert.AssertionError({ message: 'expected a DomainError with code ' + code + ', but nothing was thrown' });
}
