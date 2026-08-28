// Demo seed for the "AI Arbitration Escrow" project.
//
// P0: the seed is produced by running the REAL domain reducers, so the demo
// data can never contain a state that the domain would reject (no fake
// ONCHAIN status, no signature, correct committed/allocated accounting).

import type { AppDB, User } from '../domain/types';
import type { Deps } from '../domain/reducers';
import * as domain from '../domain/reducers';

export const DEMO_REPO = 'buildshare-demo/ai-arbitration-escrow';
export const DEMO_FOUNDER_WALLET = 'FounderWallet1111111111111111111111111111';
export const DEMO_ALICE_WALLET = 'AliceWallet111111111111111111111111111111';
export const DEMO_BOB_WALLET = 'BobWallet11111111111111111111111111111111';

const T0 = '2026-01-05T09:00:00.000Z';

function demoUsers(): User[] {
  return [
    {
      id: 'usr_founder',
      walletAddress: DEMO_FOUNDER_WALLET,
      githubUsername: 'buildshare-founder',
      githubUserId: '20000001',
      avatarUrl: null,
      createdAt: T0,
    },
    {
      id: 'usr_alice',
      walletAddress: DEMO_ALICE_WALLET,
      githubUsername: 'alice',
      githubUserId: '20000002',
      avatarUrl: null,
      createdAt: T0,
    },
    {
      id: 'usr_bob',
      walletAddress: DEMO_BOB_WALLET,
      githubUsername: 'bob',
      githubUserId: '20000003',
      avatarUrl: null,
      createdAt: T0,
    },
  ];
}

export function emptyDB(): AppDB {
  return {
    users: demoUsers(),
    projects: [],
    members: [],
    tasks: [],
    pullRequests: [],
    contributions: [],
    evaluations: [],
    auditLogs: [],
  };
}

// Deterministic clock and ids so the demo is reproducible.
function seedDeps(): Deps {
  let ms = Date.parse(T0);
  let counter = 0;
  return {
    now: () => {
      const iso = new Date(ms).toISOString();
      ms += 60 * 60 * 1000;
      return iso;
    },
    newId: (prefix: string) => {
      counter += 1;
      return prefix + '_demo_' + String(counter).padStart(4, '0');
    },
  };
}

export async function createDemoDB(): Promise<AppDB> {
  const deps = seedDeps();
  let db = emptyDB();

  // 1. Founder creates the project: 40% founder / 60% development pool.
  const created = domain.createProject(
    db,
    {
      name: 'AI Arbitration Escrow',
      slug: 'ai-arbitration-escrow',
      description:
        'Solana escrow with AI-assisted arbitration. Contributors earn project ownership for verified, merged work.',
      ownerUserId: 'usr_founder',
      founderWallet: DEMO_FOUNDER_WALLET,
      founderBps: 4000,
      devPoolBps: 6000,
      category: 'Web3 Infrastructure',
      githubRepo: DEMO_REPO,
    },
    deps,
  );
  db = created.db;
  const projectId = created.project.id;

  // 2. Four tasks reserve 26% of the development pool.
  const taskSpecs = [
    {
      title: 'Implement Solana Escrow Program',
      rewardBps: 1000,
      difficulty: 'advanced' as const,
      description: 'Anchor program holding funds until arbitration completes.',
      acceptanceCriteria:
        'Escrow PDA derived deterministically\nDeposit and release instructions implemented\nChecked arithmetic everywhere\nUnit tests for the unauthorized release path',
      issue: 12,
    },
    {
      title: 'Build Dispute Resolution UI',
      rewardBps: 800,
      difficulty: 'intermediate' as const,
      description: 'Screens for opening, viewing, and resolving a dispute.',
      acceptanceCriteria:
        'Dispute list and detail views\nEvidence upload form with validation\nEmpty and error states\nNo layout shift on load',
      issue: 13,
    },
    {
      title: 'Write Integration Tests',
      rewardBps: 500,
      difficulty: 'intermediate' as const,
      description: 'End-to-end coverage of the escrow lifecycle.',
      acceptanceCriteria:
        'Happy path covered\nDouble release rejected\nExpired escrow covered',
      issue: 14,
    },
    {
      title: 'Documentation and Architecture Notes',
      rewardBps: 300,
      difficulty: 'beginner' as const,
      description: 'Document the escrow accounts and the arbitration flow.',
      acceptanceCriteria:
        'Account table documented\nSequence diagram included\nSecurity assumptions listed',
      issue: 15,
    },
  ];

  const taskIds: string[] = [];
  for (const spec of taskSpecs) {
    const result = domain.createTask(
      db,
      {
        projectId,
        actorUserId: 'usr_founder',
        title: spec.title,
        description: spec.description,
        acceptanceCriteria: spec.acceptanceCriteria,
        rewardBps: spec.rewardBps,
        difficulty: spec.difficulty,
        deadline: null,
        githubIssueNumber: spec.issue,
      },
      deps,
    );
    db = result.db;
    taskIds.push(result.task.id);
  }

  // 3. Alice claims the first task. The commitment is frozen and hashed.
  const claimed = await domain.claimTask(db, { taskId: taskIds[0], userId: 'usr_alice' }, deps);
  db = claimed.db;

  // 4. Alice submits her merged pull request as evidence.
  const submitted = domain.submitContribution(
    db,
    {
      taskId: taskIds[0],
      userId: 'usr_alice',
      pullRequest: {
        githubPrId: '1900000017',
        githubPrNumber: 17,
        repository: DEMO_REPO,
        authorGithubId: '20000002',
        title: '[BUILD-001] Implement Solana Escrow Program',
        description:
          'Adds the escrow Anchor program with deterministic PDAs, checked arithmetic, and tests for the unauthorized release path.',
        url: 'https://github.com/' + DEMO_REPO + '/pull/17',
        baseBranch: 'main',
        headBranch: 'feature/solana-escrow',
        additions: 486,
        deletions: 23,
        changedFiles: 9,
        mergeCommitSha: '4f1c2ab9d7e30516c8ba9f1d2e4c7a80b35d9e61',
        openedAt: '2026-01-08T12:00:00.000Z',
        mergedAt: '2026-01-10T15:30:00.000Z',
      },
    },
    deps,
  );
  db = submitted.db;

  // 5. The AI verification is advisory only: it moves the contribution to
  //    PENDING_APPROVAL and never allocates ownership by itself.
  const verified = domain.recordVerification(
    db,
    {
      contributionId: submitted.contribution.id,
      verification: {
        model: 'demo-verifier',
        promptVersion: 'buildshare-ai-v1',
        requirementScore: 96,
        qualityScore: 92,
        testScore: 94,
        securityScore: 90,
        overallScore: 94,
        recommendation: 'APPROVE',
        reason:
          'All four acceptance criteria are implemented. PDA derivation is deterministic, arithmetic is checked, and the unauthorized release path is covered by a test.',
        codeSummary: '9 files changed, 486 additions, 23 deletions.',
        rawResponse: '{"recommendation":"APPROVE","implementationScore":96}',
        evaluationHash: null,
      },
    },
    deps,
  );
  db = verified.db;

  // 6. Bob claims the second task and is still working on it.
  const bobClaim = await domain.claimTask(db, { taskId: taskIds[1], userId: 'usr_bob' }, deps);
  db = bobClaim.db;

  return db;
}
