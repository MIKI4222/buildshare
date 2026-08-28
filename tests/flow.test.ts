import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import * as domain from '../src/domain/reducers';
import { poolBreakdown, remainingDevPoolBps } from '../src/domain/bps';
import { canTransitionContribution, canTransitionTask } from '../src/domain/state-machine';
import { DomainError } from '../src/domain/errors';
import type { AppDB, Settlement } from '../src/domain/types';
import {
  emptyProjectDB,
  expectDomainError,
  expectDomainErrorAsync,
  IDS,
  makeDeps,
  pullRequestFixture,
  VALID_SIGNATURE_SHAPE,
  verificationFixture,
  WALLETS,
  type TestDeps,
} from './helpers';

interface Ctx {
  db: AppDB;
  deps: TestDeps;
  projectId: string;
}

function newProject(founderBps = 4000, devPoolBps = 6000): Ctx {
  const deps = makeDeps();
  const result = domain.createProject(
    emptyProjectDB(),
    {
      name: 'AI Arbitration Escrow',
      slug: 'ai-arbitration-escrow',
      description: 'Escrow with AI-assisted arbitration.',
      ownerUserId: IDS.founder,
      founderWallet: WALLETS.founder,
      founderBps,
      devPoolBps,
      category: 'Web3',
      githubRepo: 'buildshare-demo/ai-arbitration-escrow',
    },
    deps,
  );
  return { db: result.db, deps, projectId: result.project.id };
}

function addTask(ctx: Ctx, rewardBps: number, title = 'Implement escrow') {
  const result = domain.createTask(
    ctx.db,
    {
      projectId: ctx.projectId,
      actorUserId: IDS.founder,
      title,
      description: 'Description',
      acceptanceCriteria: 'Criterion one\nCriterion two',
      rewardBps,
      difficulty: 'advanced',
      deadline: null,
      githubIssueNumber: null,
    },
    ctx.deps,
  );
  ctx.db = result.db;
  return result.task;
}

// Drives a task from OPEN to PENDING_APPROVAL for the given contributor.
async function toPendingApproval(ctx: Ctx, taskId: string, userId: string, prNumber = 17) {
  const claimed = await domain.claimTask(ctx.db, { taskId, userId }, ctx.deps);
  ctx.db = claimed.db;
  const submitted = domain.submitContribution(
    ctx.db,
    { taskId, userId, pullRequest: pullRequestFixture(prNumber) },
    ctx.deps,
  );
  ctx.db = submitted.db;
  const verified = domain.recordVerification(
    ctx.db,
    { contributionId: submitted.contribution.id, verification: verificationFixture() },
    ctx.deps,
  );
  ctx.db = verified.db;
  return verified.contribution;
}

async function demoAllocate(ctx: Ctx, contributionId: string) {
  const approved = await domain.approveContribution(
    ctx.db,
    { contributionId, approverUserId: IDS.founder },
    ctx.deps,
  );
  ctx.db = approved.db;
  const settlement: Settlement = {
    kind: 'demo',
    allocatedAt: ctx.deps.current(),
    pda: 'DEMO:abcdef',
  };
  const settled = domain.settleAllocation(ctx.db, { contributionId, settlement }, ctx.deps);
  ctx.db = settled.db;
  return settled.contribution;
}

describe('project creation and ownership accounting (P0.10)', () => {
  it('rejects a split that does not sum to 10000 bps', () => {
    expectDomainError(
      () =>
        domain.createProject(emptyProjectDB(), {
          name: 'X',
          slug: 'x',
          description: '',
          ownerUserId: IDS.founder,
          founderWallet: WALLETS.founder,
          founderBps: 4000,
          devPoolBps: 5000,
          category: 'Web3',
        }),
      'INVALID_SPLIT',
    );
  });

  it('starts with committed 0 and allocated 0', () => {
    const ctx = newProject();
    const pool = domain.projectPool(ctx.db, ctx.projectId);
    assert.equal(pool.committedBps, 0);
    assert.equal(pool.allocatedBps, 0);
  });

  it('computes remainingBps rather than storing it', () => {
    const ctx = newProject();
    const project = domain.requireProject(ctx.db, ctx.projectId);
    assert.equal('remainingBps' in project, false);
    assert.equal(poolBreakdown(project).remainingBps, 6000);
  });

  it('gives the founder their bps as member ownership', () => {
    const ctx = newProject();
    const member = ctx.db.members.find((m) => m.userId === IDS.founder);
    assert.equal(member ? member.ownershipBps : 0, 4000);
  });

  it('reserves the reward when a task is created', () => {
    const ctx = newProject();
    addTask(ctx, 1000);
    const pool = domain.projectPool(ctx.db, ctx.projectId);
    assert.equal(pool.committedBps, 1000);
    assert.equal(pool.allocatedBps, 0);
    assert.equal(pool.remainingBps, 5000);
  });

  it('accumulates reservations across tasks', () => {
    const ctx = newProject();
    addTask(ctx, 1000);
    addTask(ctx, 800);
    addTask(ctx, 500);
    assert.equal(domain.projectPool(ctx.db, ctx.projectId).committedBps, 2300);
    assert.equal(domain.projectPool(ctx.db, ctx.projectId).remainingBps, 3700);
  });

  it('keeps founderBps + allocatedBps as the total owned', () => {
    const ctx = newProject();
    assert.equal(domain.projectPool(ctx.db, ctx.projectId).totalOwnedBps, 4000);
  });
});

describe('pool validation (P0.11, P0.12)', () => {
  it('refuses a task larger than the remaining pool', () => {
    const ctx = newProject();
    expectDomainError(() => addTask(ctx, 6001), 'POOL_EXCEEDED');
  });

  it('refuses a task that would exhaust the pool beyond its limit', () => {
    const ctx = newProject();
    addTask(ctx, 5500);
    expectDomainError(() => addTask(ctx, 501), 'POOL_EXCEEDED');
  });

  it('allows a task that exactly consumes the remaining pool', () => {
    const ctx = newProject();
    addTask(ctx, 6000);
    assert.equal(domain.projectPool(ctx.db, ctx.projectId).remainingBps, 0);
  });

  it('refuses a zero reward task', () => {
    const ctx = newProject();
    expectDomainError(() => addTask(ctx, 0), 'INVALID_BPS');
  });

  it('refuses a negative reward task', () => {
    const ctx = newProject();
    expectDomainError(() => addTask(ctx, -100), 'INVALID_BPS');
  });

  it('refuses a non integer reward', () => {
    const ctx = newProject();
    expectDomainError(() => addTask(ctx, 10.5), 'INVALID_BPS');
  });

  it('refuses a task created by someone who is not the founder', () => {
    const ctx = newProject();
    expectDomainError(
      () =>
        domain.createTask(
          ctx.db,
          {
            projectId: ctx.projectId,
            actorUserId: IDS.alice,
            title: 'T',
            description: '',
            acceptanceCriteria: 'C',
            rewardBps: 100,
            difficulty: 'beginner',
            deadline: null,
            githubIssueNumber: null,
          },
          ctx.deps,
        ),
      'NOT_AUTHORIZED',
    );
  });

  it('detects a corrupted pool through the invariant check', () => {
    const ctx = newProject();
    const project = domain.requireProject(ctx.db, ctx.projectId);
    assert.throws(
      () => remainingDevPoolBps({ ...project, committedBps: 5000, allocatedBps: 2000 }),
      (e: unknown) => e instanceof DomainError && e.code === 'INVARIANT_VIOLATION',
    );
  });

  it('releases the reservation when a task is cancelled', () => {
    const ctx = newProject();
    const task = addTask(ctx, 1000);
    const result = domain.cancelTask(ctx.db, { taskId: task.id, actorUserId: IDS.founder }, ctx.deps);
    assert.equal(domain.projectPool(result.db, ctx.projectId).committedBps, 0);
  });
});

describe('immutable commitment (P0.14, P0.15)', () => {
  it('creates a commitment hash at claim time', async () => {
    const ctx = newProject();
    const task = addTask(ctx, 1000);
    const claimed = await domain.claimTask(ctx.db, { taskId: task.id, userId: IDS.alice }, ctx.deps);
    const commitment = claimed.task.commitment;
    assert.ok(commitment);
    assert.match(commitment ? commitment.commitmentHash : '', /^[0-9a-f]{64}$/);
  });

  it('sets claimExpiresAt seven days after the claim', async () => {
    const ctx = newProject();
    const task = addTask(ctx, 1000);
    const claimed = await domain.claimTask(ctx.db, { taskId: task.id, userId: IDS.alice }, ctx.deps);
    const commitment = claimed.task.commitment;
    assert.ok(commitment);
    if (commitment) {
      const delta = Date.parse(commitment.claimExpiresAt) - Date.parse(commitment.claimedAt);
      assert.equal(delta, 7 * 24 * 60 * 60 * 1000);
    }
  });

  it('does not reserve ownership again at claim time', async () => {
    const ctx = newProject();
    const task = addTask(ctx, 1000);
    const claimed = await domain.claimTask(ctx.db, { taskId: task.id, userId: IDS.alice }, ctx.deps);
    assert.equal(domain.projectPool(claimed.db, ctx.projectId).committedBps, 1000);
  });

  it('locks a second contributor out of a claimed task', async () => {
    const ctx = newProject();
    const task = addTask(ctx, 1000);
    const claimed = await domain.claimTask(ctx.db, { taskId: task.id, userId: IDS.alice }, ctx.deps);
    await expectDomainErrorAsync(
      () => domain.claimTask(claimed.db, { taskId: task.id, userId: IDS.bob }, ctx.deps),
      'NOT_CLAIMABLE',
    );
  });

  it('refuses to change rewardBps after the claim', async () => {
    const ctx = newProject();
    const task = addTask(ctx, 1000);
    const claimed = await domain.claimTask(ctx.db, { taskId: task.id, userId: IDS.alice }, ctx.deps);
    expectDomainError(
      () =>
        domain.updateTask(
          claimed.db,
          { taskId: task.id, actorUserId: IDS.founder, patch: { rewardBps: 500 } },
          ctx.deps,
        ),
      'IMMUTABLE_AFTER_CLAIM',
    );
  });

  it('refuses to change the acceptance criteria after the claim', async () => {
    const ctx = newProject();
    const task = addTask(ctx, 1000);
    const claimed = await domain.claimTask(ctx.db, { taskId: task.id, userId: IDS.alice }, ctx.deps);
    expectDomainError(
      () =>
        domain.updateTask(
          claimed.db,
          { taskId: task.id, actorUserId: IDS.founder, patch: { acceptanceCriteria: 'Something else' } },
          ctx.deps,
        ),
      'IMMUTABLE_AFTER_CLAIM',
    );
  });

  it('refuses to change the repository or base branch after the claim', async () => {
    const ctx = newProject();
    const task = addTask(ctx, 1000);
    const claimed = await domain.claimTask(ctx.db, { taskId: task.id, userId: IDS.alice }, ctx.deps);
    expectDomainError(
      () =>
        domain.updateTask(
          claimed.db,
          { taskId: task.id, actorUserId: IDS.founder, patch: { baseBranch: 'develop' } },
          ctx.deps,
        ),
      'IMMUTABLE_AFTER_CLAIM',
    );
  });

  it('still allows editing the title after the claim', async () => {
    const ctx = newProject();
    const task = addTask(ctx, 1000);
    const claimed = await domain.claimTask(ctx.db, { taskId: task.id, userId: IDS.alice }, ctx.deps);
    const updated = domain.updateTask(
      claimed.db,
      { taskId: task.id, actorUserId: IDS.founder, patch: { title: 'Clearer title' } },
      ctx.deps,
    );
    assert.equal(updated.task.title, 'Clearer title');
  });

  it('allows changing the reward while the task is still OPEN', () => {
    const ctx = newProject();
    const task = addTask(ctx, 1000);
    const updated = domain.updateTask(
      ctx.db,
      { taskId: task.id, actorUserId: IDS.founder, patch: { rewardBps: 1500 } },
      ctx.deps,
    );
    assert.equal(updated.task.rewardBps, 1500);
    assert.equal(domain.projectPool(updated.db, ctx.projectId).committedBps, 1500);
  });

  it('refuses an OPEN reward increase beyond the pool', () => {
    const ctx = newProject();
    const task = addTask(ctx, 1000);
    addTask(ctx, 5000);
    expectDomainError(
      () =>
        domain.updateTask(
          ctx.db,
          { taskId: task.id, actorUserId: IDS.founder, patch: { rewardBps: 1500 } },
          ctx.deps,
        ),
      'POOL_EXCEEDED',
    );
  });
});

describe('claim expiry (P0.15)', () => {
  it('does not expire a fresh claim', async () => {
    const ctx = newProject();
    const task = addTask(ctx, 1000);
    ctx.db = (await domain.claimTask(ctx.db, { taskId: task.id, userId: IDS.alice }, ctx.deps)).db;
    const result = domain.expireClaims(ctx.db, ctx.deps);
    assert.equal(result.expired.length, 0);
  });

  it('expires a claim after the window and clears the assignee', async () => {
    const ctx = newProject();
    const task = addTask(ctx, 1000);
    ctx.db = (await domain.claimTask(ctx.db, { taskId: task.id, userId: IDS.alice }, ctx.deps)).db;
    ctx.deps.advanceDays(8);
    const result = domain.expireClaims(ctx.db, ctx.deps);
    assert.deepEqual(result.expired, [task.id]);
    const expiredTask = domain.requireTask(result.db, task.id);
    assert.equal(expiredTask.status, 'EXPIRED');
    assert.equal(expiredTask.assignedUserId, null);
    assert.equal(expiredTask.commitment, null);
  });

  it('keeps the reservation when a claim expires', async () => {
    const ctx = newProject();
    const task = addTask(ctx, 1000);
    ctx.db = (await domain.claimTask(ctx.db, { taskId: task.id, userId: IDS.alice }, ctx.deps)).db;
    ctx.deps.advanceDays(8);
    const result = domain.expireClaims(ctx.db, ctx.deps);
    assert.equal(domain.projectPool(result.db, ctx.projectId).committedBps, 1000);
  });

  it('writes an audit event when a claim expires', async () => {
    const ctx = newProject();
    const task = addTask(ctx, 1000);
    ctx.db = (await domain.claimTask(ctx.db, { taskId: task.id, userId: IDS.alice }, ctx.deps)).db;
    ctx.deps.advanceDays(8);
    const result = domain.expireClaims(ctx.db, ctx.deps);
    assert.ok(result.db.auditLogs.some((l) => l.eventType === 'TASK_CLAIM_EXPIRED'));
  });

  it('refuses a submission on an expired claim', async () => {
    const ctx = newProject();
    const task = addTask(ctx, 1000);
    ctx.db = (await domain.claimTask(ctx.db, { taskId: task.id, userId: IDS.alice }, ctx.deps)).db;
    ctx.deps.advanceDays(8);
    expectDomainError(
      () =>
        domain.submitContribution(
          ctx.db,
          { taskId: task.id, userId: IDS.alice, pullRequest: pullRequestFixture(17) },
          ctx.deps,
        ),
      'CLAIM_EXPIRED',
    );
  });

  it('allows re-opening an expired task for a new claim', async () => {
    const ctx = newProject();
    const task = addTask(ctx, 1000);
    ctx.db = (await domain.claimTask(ctx.db, { taskId: task.id, userId: IDS.alice }, ctx.deps)).db;
    ctx.deps.advanceDays(8);
    ctx.db = domain.expireClaims(ctx.db, ctx.deps).db;
    ctx.db = domain.releaseClaim(ctx.db, { taskId: task.id }, ctx.deps).db;
    const reclaimed = await domain.claimTask(ctx.db, { taskId: task.id, userId: IDS.bob }, ctx.deps);
    assert.equal(reclaimed.task.status, 'CLAIMED');
    assert.equal(domain.projectPool(reclaimed.db, ctx.projectId).committedBps, 1000);
  });
});

describe('submission and verification', () => {
  it('refuses a submission from a different user', async () => {
    const ctx = newProject();
    const task = addTask(ctx, 1000);
    ctx.db = (await domain.claimTask(ctx.db, { taskId: task.id, userId: IDS.alice }, ctx.deps)).db;
    expectDomainError(
      () =>
        domain.submitContribution(
          ctx.db,
          { taskId: task.id, userId: IDS.bob, pullRequest: pullRequestFixture(18) },
          ctx.deps,
        ),
      'NOT_AUTHORIZED',
    );
  });

  it('refuses a submission on an unclaimed task', () => {
    const ctx = newProject();
    const task = addTask(ctx, 1000);
    expectDomainError(
      () =>
        domain.submitContribution(
          ctx.db,
          { taskId: task.id, userId: IDS.alice, pullRequest: pullRequestFixture(18) },
          ctx.deps,
        ),
      'NO_COMMITMENT',
    );
  });

  it('binds the contribution to the commitment hash and attempt', async () => {
    const ctx = newProject();
    const task = addTask(ctx, 1000);
    const claimed = await domain.claimTask(ctx.db, { taskId: task.id, userId: IDS.alice }, ctx.deps);
    ctx.db = claimed.db;
    const submitted = domain.submitContribution(
      ctx.db,
      { taskId: task.id, userId: IDS.alice, pullRequest: pullRequestFixture(17) },
      ctx.deps,
    );
    const commitment = claimed.task.commitment;
    assert.equal(submitted.contribution.commitmentHash, commitment ? commitment.commitmentHash : null);
    assert.equal(submitted.contribution.attempt, 1);
    assert.equal(submitted.contribution.rewardBps, 1000);
  });

  it('records the AI verification as advisory and moves to PENDING_APPROVAL', async () => {
    const ctx = newProject();
    const task = addTask(ctx, 1000);
    const contribution = await toPendingApproval(ctx, task.id, IDS.alice);
    assert.equal(contribution.status, 'PENDING_APPROVAL');
    assert.equal(contribution.aiScore, 93);
    assert.equal(domain.requireTask(ctx.db, task.id).status, 'PENDING_APPROVAL');
  });

  it('does not allocate ownership on verification alone', async () => {
    const ctx = newProject();
    const task = addTask(ctx, 1000);
    await toPendingApproval(ctx, task.id, IDS.alice);
    const pool = domain.projectPool(ctx.db, ctx.projectId);
    assert.equal(pool.allocatedBps, 0);
    assert.equal(pool.committedBps, 1000);
  });

  it('stores the evidence hash only at founder approval', async () => {
    const ctx = newProject();
    const task = addTask(ctx, 1000);
    const contribution = await toPendingApproval(ctx, task.id, IDS.alice);
    assert.equal(contribution.evidenceHash, null);
    const approved = await domain.approveContribution(
      ctx.db,
      { contributionId: contribution.id, approverUserId: IDS.founder },
      ctx.deps,
    );
    assert.match(String(approved.contribution.evidenceHash), /^[0-9a-f]{64}$/);
  });

  it('refuses approval by a non founder', async () => {
    const ctx = newProject();
    const task = addTask(ctx, 1000);
    const contribution = await toPendingApproval(ctx, task.id, IDS.alice);
    await expectDomainErrorAsync(
      () =>
        domain.approveContribution(
          ctx.db,
          { contributionId: contribution.id, approverUserId: IDS.bob },
          ctx.deps,
        ),
      'NOT_AUTHORIZED',
    );
  });
});

describe('demo allocation (P0.3, P0.4)', () => {
  it('ends in DEMO_ALLOCATED, never ONCHAIN', async () => {
    const ctx = newProject();
    const task = addTask(ctx, 1000);
    const contribution = await toPendingApproval(ctx, task.id, IDS.alice);
    const settled = await demoAllocate(ctx, contribution.id);
    assert.equal(settled.status, 'DEMO_ALLOCATED');
    assert.equal(domain.requireTask(ctx.db, task.id).status, 'DEMO_ALLOCATED');
  });

  it('stores a demo settlement without a signature', async () => {
    const ctx = newProject();
    const task = addTask(ctx, 1000);
    const contribution = await toPendingApproval(ctx, task.id, IDS.alice);
    const settled = await demoAllocate(ctx, contribution.id);
    assert.ok(settled.settlement);
    if (settled.settlement) {
      assert.equal(settled.settlement.kind, 'demo');
      assert.equal('signature' in settled.settlement, false);
    }
  });

  it('moves the reward from committed to allocated', async () => {
    const ctx = newProject();
    const task = addTask(ctx, 1000);
    const contribution = await toPendingApproval(ctx, task.id, IDS.alice);
    await demoAllocate(ctx, contribution.id);
    const pool = domain.projectPool(ctx.db, ctx.projectId);
    assert.equal(pool.committedBps, 0);
    assert.equal(pool.allocatedBps, 1000);
    assert.equal(pool.remainingBps, 5000);
  });

  it('creates the contributor as a member with the allocated ownership', async () => {
    const ctx = newProject();
    const task = addTask(ctx, 1000);
    const contribution = await toPendingApproval(ctx, task.id, IDS.alice);
    await demoAllocate(ctx, contribution.id);
    const member = ctx.db.members.find((m) => m.userId === IDS.alice);
    assert.equal(member ? member.ownershipBps : 0, 1000);
    assert.equal(member ? member.allocationCount : 0, 1);
  });

  it('keeps founder plus contributor ownership at 5000 bps', async () => {
    const ctx = newProject();
    const task = addTask(ctx, 1000);
    const contribution = await toPendingApproval(ctx, task.id, IDS.alice);
    await demoAllocate(ctx, contribution.id);
    const total = ctx.db.members.reduce((sum, m) => sum + m.ownershipBps, 0);
    assert.equal(total, 5000);
    assert.equal(domain.projectPool(ctx.db, ctx.projectId).totalOwnedBps, 5000);
  });

  it('never records a signature in the audit trail for a demo allocation', async () => {
    const ctx = newProject();
    const task = addTask(ctx, 1000);
    const contribution = await toPendingApproval(ctx, task.id, IDS.alice);
    await demoAllocate(ctx, contribution.id);
    const log = ctx.db.auditLogs.find((l) => l.eventType === 'OWNERSHIP_ALLOCATED');
    assert.ok(log);
    assert.equal(log ? log.signature : 'x', null);
    assert.equal(log ? log.network : 'x', null);
  });

  it('accumulates a second allocation for the same contributor', async () => {
    const ctx = newProject();
    const first = addTask(ctx, 1000);
    const second = addTask(ctx, 800, 'Second task');
    const c1 = await toPendingApproval(ctx, first.id, IDS.alice, 17);
    await demoAllocate(ctx, c1.id);
    const c2 = await toPendingApproval(ctx, second.id, IDS.alice, 18);
    await demoAllocate(ctx, c2.id);
    const member = ctx.db.members.find((m) => m.userId === IDS.alice);
    assert.equal(member ? member.ownershipBps : 0, 1800);
    assert.equal(member ? member.allocationCount : 0, 2);
    assert.equal(domain.projectPool(ctx.db, ctx.projectId).allocatedBps, 1800);
  });
});

describe('double allocation (P0.6 security)', () => {
  it('refuses to settle the same contribution twice', async () => {
    const ctx = newProject();
    const task = addTask(ctx, 1000);
    const contribution = await toPendingApproval(ctx, task.id, IDS.alice);
    await demoAllocate(ctx, contribution.id);
    expectDomainError(
      () =>
        domain.settleAllocation(
          ctx.db,
          {
            contributionId: contribution.id,
            settlement: { kind: 'demo', allocatedAt: ctx.deps.current(), pda: 'DEMO:again' },
          },
          ctx.deps,
        ),
      'DOUBLE_ALLOCATION',
    );
  });

  it('refuses a second approval of a settled contribution', async () => {
    const ctx = newProject();
    const task = addTask(ctx, 1000);
    const contribution = await toPendingApproval(ctx, task.id, IDS.alice);
    await demoAllocate(ctx, contribution.id);
    await expectDomainErrorAsync(
      () =>
        domain.approveContribution(
          ctx.db,
          { contributionId: contribution.id, approverUserId: IDS.founder },
          ctx.deps,
        ),
      'INVALID_TRANSITION',
    );
  });

  it('leaves the pool untouched after a refused double allocation', async () => {
    const ctx = newProject();
    const task = addTask(ctx, 1000);
    const contribution = await toPendingApproval(ctx, task.id, IDS.alice);
    await demoAllocate(ctx, contribution.id);
    try {
      domain.settleAllocation(
        ctx.db,
        {
          contributionId: contribution.id,
          settlement: { kind: 'demo', allocatedAt: ctx.deps.current(), pda: 'DEMO:again' },
        },
        ctx.deps,
      );
    } catch {
      /* expected */
    }
    assert.equal(domain.projectPool(ctx.db, ctx.projectId).allocatedBps, 1000);
  });
});

describe('state machine (P0.13)', () => {
  it('allows the approved task path', () => {
    assert.equal(canTransitionTask('OPEN', 'CLAIMED'), true);
    assert.equal(canTransitionTask('CLAIMED', 'SUBMITTED'), true);
    assert.equal(canTransitionTask('PENDING_APPROVAL', 'APPROVED'), true);
  });

  it('forbids skipping from OPEN to APPROVED', () => {
    assert.equal(canTransitionTask('OPEN', 'APPROVED'), false);
  });

  it('treats task REJECTED as non terminal', () => {
    assert.equal(canTransitionTask('REJECTED', 'CLAIMED'), true);
  });

  it('treats contribution REJECTED as terminal', () => {
    assert.equal(canTransitionContribution('REJECTED', 'CLAIMED'), false);
    assert.equal(canTransitionContribution('REJECTED', 'AI_REVIEW'), false);
  });

  it('forbids leaving ONCHAIN or DEMO_ALLOCATED', () => {
    assert.equal(canTransitionTask('ONCHAIN', 'OPEN'), false);
    assert.equal(canTransitionContribution('DEMO_ALLOCATED', 'PENDING_ONCHAIN'), false);
  });

  it('allows retrying a failed on-chain allocation', () => {
    assert.equal(canTransitionContribution('ONCHAIN_FAILED', 'PENDING_ONCHAIN'), true);
  });

  it('refuses an invalid transition at the reducer level', () => {
    const ctx = newProject();
    const task = addTask(ctx, 1000);
    expectDomainError(
      () => domain.releaseClaim(ctx.db, { taskId: task.id }, ctx.deps),
      'INVALID_TRANSITION',
    );
  });

  it('refuses to verify a contribution that is not SUBMITTED', async () => {
    const ctx = newProject();
    const task = addTask(ctx, 1000);
    const contribution = await toPendingApproval(ctx, task.id, IDS.alice);
    expectDomainError(
      () =>
        domain.recordVerification(
          ctx.db,
          { contributionId: contribution.id, verification: verificationFixture() },
          ctx.deps,
        ),
      'INVALID_TRANSITION',
    );
  });
});

describe('rejection and retry (P0.16, P0.17, retry accounting)', () => {
  it('requires a rejection reason', async () => {
    const ctx = newProject();
    const task = addTask(ctx, 1000);
    const contribution = await toPendingApproval(ctx, task.id, IDS.alice);
    expectDomainError(
      () =>
        domain.rejectContribution(
          ctx.db,
          { contributionId: contribution.id, actorUserId: IDS.founder, reason: 'no' },
          ctx.deps,
        ),
      'REJECT_REASON_REQUIRED',
    );
  });

  it('records reason, author and timestamp on rejection', async () => {
    const ctx = newProject();
    const task = addTask(ctx, 1000);
    const contribution = await toPendingApproval(ctx, task.id, IDS.alice);
    const rejected = domain.rejectContribution(
      ctx.db,
      { contributionId: contribution.id, actorUserId: IDS.founder, reason: 'Tests are missing for the unauthorized path.' },
      ctx.deps,
    );
    assert.equal(rejected.contribution.status, 'REJECTED');
    assert.match(String(rejected.contribution.rejectReason), /Tests are missing/);
    assert.equal(rejected.contribution.rejectedBy, IDS.founder);
    assert.ok(rejected.contribution.rejectedAt);
  });

  it('does not destroy the contribution record', async () => {
    const ctx = newProject();
    const task = addTask(ctx, 1000);
    const contribution = await toPendingApproval(ctx, task.id, IDS.alice);
    ctx.db = domain.rejectContribution(
      ctx.db,
      { contributionId: contribution.id, actorUserId: IDS.founder, reason: 'Acceptance criteria not met at all.' },
      ctx.deps,
    ).db;
    assert.ok(ctx.db.contributions.find((c) => c.id === contribution.id));
    assert.equal(ctx.db.contributions.length, 1);
  });

  it('keeps the reservation after a rejection', async () => {
    const ctx = newProject();
    const task = addTask(ctx, 1000);
    const contribution = await toPendingApproval(ctx, task.id, IDS.alice);
    ctx.db = domain.rejectContribution(
      ctx.db,
      { contributionId: contribution.id, actorUserId: IDS.founder, reason: 'Acceptance criteria not met at all.' },
      ctx.deps,
    ).db;
    assert.equal(domain.projectPool(ctx.db, ctx.projectId).committedBps, 1000);
    assert.equal(domain.projectPool(ctx.db, ctx.projectId).allocatedBps, 0);
  });

  it('writes a rejection audit event with the reason', async () => {
    const ctx = newProject();
    const task = addTask(ctx, 1000);
    const contribution = await toPendingApproval(ctx, task.id, IDS.alice);
    ctx.db = domain.rejectContribution(
      ctx.db,
      { contributionId: contribution.id, actorUserId: IDS.founder, reason: 'Acceptance criteria not met at all.' },
      ctx.deps,
    ).db;
    const log = ctx.db.auditLogs.find((l) => l.eventType === 'CONTRIBUTION_REJECTED');
    assert.ok(log);
    assert.equal(log ? log.metadata.rejectedBy : null, IDS.founder);
    assert.match(String(log ? log.metadata.rejectReason : ''), /Acceptance criteria/);
  });

  it('does NOT re-reserve the reward on a retry claim', async () => {
    const ctx = newProject();
    const task = addTask(ctx, 1000);
    const contribution = await toPendingApproval(ctx, task.id, IDS.alice);
    ctx.db = domain.rejectContribution(
      ctx.db,
      { contributionId: contribution.id, actorUserId: IDS.founder, reason: 'Acceptance criteria not met at all.' },
      ctx.deps,
    ).db;
    const reclaimed = await domain.claimTask(ctx.db, { taskId: task.id, userId: IDS.alice }, ctx.deps);
    ctx.db = reclaimed.db;
    // Reservation belongs to the task: still 1000, never 2000.
    assert.equal(domain.projectPool(ctx.db, ctx.projectId).committedBps, 1000);
  });

  it('gives the retry its own attempt number and commitment hash', async () => {
    const ctx = newProject();
    const task = addTask(ctx, 1000);
    const first = await toPendingApproval(ctx, task.id, IDS.alice);
    const firstHash = first.commitmentHash;
    ctx.db = domain.rejectContribution(
      ctx.db,
      { contributionId: first.id, actorUserId: IDS.founder, reason: 'Acceptance criteria not met at all.' },
      ctx.deps,
    ).db;
    const reclaimed = await domain.claimTask(ctx.db, { taskId: task.id, userId: IDS.alice }, ctx.deps);
    ctx.db = reclaimed.db;
    assert.equal(reclaimed.task.attempt, 2);
    const commitment = reclaimed.task.commitment;
    assert.notEqual(commitment ? commitment.commitmentHash : firstHash, firstHash);
  });

  it('creates a separate contribution attempt with its own evidence', async () => {
    const ctx = newProject();
    const task = addTask(ctx, 1000);
    const first = await toPendingApproval(ctx, task.id, IDS.alice, 17);
    ctx.db = domain.rejectContribution(
      ctx.db,
      { contributionId: first.id, actorUserId: IDS.founder, reason: 'Acceptance criteria not met at all.' },
      ctx.deps,
    ).db;
    const second = await toPendingApproval(ctx, task.id, IDS.alice, 18);
    assert.equal(second.attempt, 2);
    assert.equal(ctx.db.contributions.length, 2);
    const settled = await demoAllocate(ctx, second.id);
    assert.match(String(settled.evidenceHash), /^[0-9a-f]{64}$/);
    assert.notEqual(settled.evidenceHash, first.evidenceHash);
  });

  it('allocates exactly 1000 bps once after a retry', async () => {
    const ctx = newProject();
    const task = addTask(ctx, 1000);
    const first = await toPendingApproval(ctx, task.id, IDS.alice, 17);
    ctx.db = domain.rejectContribution(
      ctx.db,
      { contributionId: first.id, actorUserId: IDS.founder, reason: 'Acceptance criteria not met at all.' },
      ctx.deps,
    ).db;
    const second = await toPendingApproval(ctx, task.id, IDS.alice, 18);
    await demoAllocate(ctx, second.id);
    const pool = domain.projectPool(ctx.db, ctx.projectId);
    assert.equal(pool.committedBps, 0);
    assert.equal(pool.allocatedBps, 1000);
  });

  it('refuses to reuse a rejected contribution attempt', async () => {
    const ctx = newProject();
    const task = addTask(ctx, 1000);
    const first = await toPendingApproval(ctx, task.id, IDS.alice);
    ctx.db = domain.rejectContribution(
      ctx.db,
      { contributionId: first.id, actorUserId: IDS.founder, reason: 'Acceptance criteria not met at all.' },
      ctx.deps,
    ).db;
    await expectDomainErrorAsync(
      () =>
        domain.approveContribution(
          ctx.db,
          { contributionId: first.id, approverUserId: IDS.founder },
          ctx.deps,
        ),
      'INVALID_TRANSITION',
    );
  });
});

describe('live allocation lifecycle (P0.5, P0.6)', () => {
  it('moves APPROVED to PENDING_ONCHAIN without allocating yet', async () => {
    const ctx = newProject();
    const task = addTask(ctx, 1000);
    const contribution = await toPendingApproval(ctx, task.id, IDS.alice);
    ctx.db = (
      await domain.approveContribution(
        ctx.db,
        { contributionId: contribution.id, approverUserId: IDS.founder },
        ctx.deps,
      )
    ).db;
    const started = domain.beginAllocation(ctx.db, { contributionId: contribution.id }, ctx.deps);
    ctx.db = started.db;
    assert.equal(started.contribution.status, 'PENDING_ONCHAIN');
    assert.equal(domain.projectPool(ctx.db, ctx.projectId).allocatedBps, 0);
  });

  it('records ONCHAIN_FAILED without allocating ownership', async () => {
    const ctx = newProject();
    const task = addTask(ctx, 1000);
    const contribution = await toPendingApproval(ctx, task.id, IDS.alice);
    ctx.db = (
      await domain.approveContribution(
        ctx.db,
        { contributionId: contribution.id, approverUserId: IDS.founder },
        ctx.deps,
      )
    ).db;
    ctx.db = domain.beginAllocation(ctx.db, { contributionId: contribution.id }, ctx.deps).db;
    const failed = domain.failAllocation(
      ctx.db,
      { contributionId: contribution.id, reason: 'RPC timeout' },
      ctx.deps,
    );
    ctx.db = failed.db;
    assert.equal(failed.contribution.status, 'ONCHAIN_FAILED');
    assert.equal(failed.contribution.settlement, null);
    assert.equal(domain.projectPool(ctx.db, ctx.projectId).allocatedBps, 0);
    assert.equal(domain.projectPool(ctx.db, ctx.projectId).committedBps, 1000);
  });

  it('allows a retry after a failed allocation and settles once', async () => {
    const ctx = newProject();
    const task = addTask(ctx, 1000);
    const contribution = await toPendingApproval(ctx, task.id, IDS.alice);
    ctx.db = (
      await domain.approveContribution(
        ctx.db,
        { contributionId: contribution.id, approverUserId: IDS.founder },
        ctx.deps,
      )
    ).db;
    ctx.db = domain.beginAllocation(ctx.db, { contributionId: contribution.id }, ctx.deps).db;
    ctx.db = domain.failAllocation(ctx.db, { contributionId: contribution.id, reason: 'RPC timeout' }, ctx.deps).db;
    ctx.db = domain.retryAllocation(ctx.db, { contributionId: contribution.id }, ctx.deps).db;
    const settlement: Settlement = {
      kind: 'onchain',
      allocatedAt: ctx.deps.current(),
      pda: 'RealPdaAddress1111111111111111111111111111',
      signature: VALID_SIGNATURE_SHAPE,
      network: 'devnet',
    };
    const settled = domain.settleAllocation(ctx.db, { contributionId: contribution.id, settlement }, ctx.deps);
    ctx.db = settled.db;
    assert.equal(settled.contribution.status, 'ONCHAIN');
    assert.equal(domain.projectPool(ctx.db, ctx.projectId).allocatedBps, 1000);
  });

  it('records the signature in the audit trail only for an on-chain settlement', async () => {
    const ctx = newProject();
    const task = addTask(ctx, 1000);
    const contribution = await toPendingApproval(ctx, task.id, IDS.alice);
    ctx.db = (
      await domain.approveContribution(
        ctx.db,
        { contributionId: contribution.id, approverUserId: IDS.founder },
        ctx.deps,
      )
    ).db;
    ctx.db = domain.beginAllocation(ctx.db, { contributionId: contribution.id }, ctx.deps).db;
    const settlement: Settlement = {
      kind: 'onchain',
      allocatedAt: ctx.deps.current(),
      pda: 'RealPdaAddress1111111111111111111111111111',
      signature: VALID_SIGNATURE_SHAPE,
      network: 'devnet',
    };
    ctx.db = domain.settleAllocation(ctx.db, { contributionId: contribution.id, settlement }, ctx.deps).db;
    const log = ctx.db.auditLogs.find((l) => l.eventType === 'OWNERSHIP_ALLOCATED');
    assert.equal(log ? log.signature : null, VALID_SIGNATURE_SHAPE);
    assert.equal(log ? log.network : null, 'devnet');
  });

  it('refuses to settle on-chain straight from APPROVED without PENDING_ONCHAIN', async () => {
    const ctx = newProject();
    const task = addTask(ctx, 1000);
    const contribution = await toPendingApproval(ctx, task.id, IDS.alice);
    ctx.db = (
      await domain.approveContribution(
        ctx.db,
        { contributionId: contribution.id, approverUserId: IDS.founder },
        ctx.deps,
      )
    ).db;
    expectDomainError(
      () =>
        domain.settleAllocation(
          ctx.db,
          {
            contributionId: contribution.id,
            settlement: {
              kind: 'onchain',
              allocatedAt: ctx.deps.current(),
              pda: 'RealPdaAddress1111111111111111111111111111',
              signature: VALID_SIGNATURE_SHAPE,
              network: 'devnet',
            },
          },
          ctx.deps,
        ),
      'INVALID_TRANSITION',
    );
  });
});

describe('audit trail (P0.18)', () => {
  it('logs project creation', () => {
    const ctx = newProject();
    assert.ok(ctx.db.auditLogs.some((l) => l.eventType === 'PROJECT_CREATED'));
  });

  it('logs the full happy path in order', async () => {
    const ctx = newProject();
    const task = addTask(ctx, 1000);
    const contribution = await toPendingApproval(ctx, task.id, IDS.alice);
    await demoAllocate(ctx, contribution.id);
    const types = ctx.db.auditLogs.map((l) => l.eventType).reverse();
    assert.deepEqual(types, [
      'PROJECT_CREATED',
      'TASK_CREATED',
      'TASK_CLAIMED',
      'PR_MERGED',
      'CONTRIBUTION_SUBMITTED',
      'AI_VERIFIED',
      'CONTRIBUTION_APPROVED',
      'OWNERSHIP_ALLOCATED',
    ]);
  });

  it('records the commitment hash on the claim event', async () => {
    const ctx = newProject();
    const task = addTask(ctx, 1000);
    ctx.db = (await domain.claimTask(ctx.db, { taskId: task.id, userId: IDS.alice }, ctx.deps)).db;
    const log = ctx.db.auditLogs.find((l) => l.eventType === 'TASK_CLAIMED');
    assert.match(String(log ? log.metadata.commitmentHash : ''), /^[0-9a-f]{64}$/);
  });

  it('records the evidence hash on the approval event', async () => {
    const ctx = newProject();
    const task = addTask(ctx, 1000);
    const contribution = await toPendingApproval(ctx, task.id, IDS.alice);
    await demoAllocate(ctx, contribution.id);
    const log = ctx.db.auditLogs.find((l) => l.eventType === 'CONTRIBUTION_APPROVED');
    assert.match(String(log ? log.metadata.evidenceHash : ''), /^[0-9a-f]{64}$/);
  });

  it('marks the AI verification as advisory', async () => {
    const ctx = newProject();
    const task = addTask(ctx, 1000);
    await toPendingApproval(ctx, task.id, IDS.alice);
    const log = ctx.db.auditLogs.find((l) => l.eventType === 'AI_VERIFIED');
    assert.equal(log ? log.metadata.advisory : null, true);
  });

  it('never stores a signature on a non on-chain event', async () => {
    const ctx = newProject();
    const task = addTask(ctx, 1000);
    const contribution = await toPendingApproval(ctx, task.id, IDS.alice);
    await demoAllocate(ctx, contribution.id);
    assert.equal(ctx.db.auditLogs.every((l) => l.signature === null), true);
  });
});
