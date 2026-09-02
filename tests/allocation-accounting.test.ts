// P1 STEP 3 - P0 <-> on-chain accounting parity.
//
// These tests run against the P0 reducers (no validator needed) and assert the
// exact numbers that programs/buildshare/src/allocation.rs produces, so a
// divergence between the client model and the program shows up in `npm test`.
//
// KNOWN, DOCUMENTED DIFFERENCE: P0 reserves the reward when the task is
// CREATED, the program reserves it when the task is CLAIMED
// (`Task.reserved_committed`). Both reserve exactly ONCE per task, and both end
// at committed = 0 / allocated = reward after allocation. Only the moment the
// reservation appears differs; that is what the client adapter bridges.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import * as domain from '../src/domain/reducers';
import type { AppDB, Settlement } from '../src/domain/types';
import {
  emptyProjectDB,
  IDS,
  makeDeps,
  pullRequestFixture,
  verificationFixture,
  WALLETS,
  type TestDeps,
} from './helpers';

interface Ctx {
  db: AppDB;
  deps: TestDeps;
  projectId: string;
}

function newProject(): Ctx {
  const deps = makeDeps();
  const result = domain.createProject(
    emptyProjectDB(),
    {
      name: 'AI Arbitration Escrow',
      slug: 'ai-arbitration-escrow',
      description: 'Escrow with AI-assisted arbitration.',
      ownerUserId: IDS.founder,
      founderWallet: WALLETS.founder,
      founderBps: 4000,
      devPoolBps: 6000,
      category: 'Web3',
      githubRepo: 'buildshare-demo/ai-arbitration-escrow',
    },
    deps,
  );
  return { db: result.db, deps, projectId: result.project.id };
}

function addTask(ctx: Ctx, rewardBps: number, title: string) {
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

async function toPendingApproval(ctx: Ctx, taskId: string, userId: string, prNumber: number) {
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

async function allocate(ctx: Ctx, contributionId: string) {
  const approved = await domain.approveContribution(
    ctx.db,
    { contributionId, approverUserId: IDS.founder },
    ctx.deps,
  );
  ctx.db = approved.db;
  const settlement: Settlement = {
    kind: 'demo',
    allocatedAt: ctx.deps.current(),
    pda: 'DEMO:allocation',
  };
  const settled = domain.settleAllocation(ctx.db, { contributionId, settlement }, ctx.deps);
  ctx.db = settled.db;
  return settled.contribution;
}

function pool(ctx: Ctx) {
  return domain.projectPool(ctx.db, ctx.projectId);
}

describe('P1 STEP 3 accounting parity with allocation.rs', () => {
  // Mirrors allocation.rs::a_basic_allocation_moves_committed_into_allocated
  it('A. allocation moves the reward from committed to allocated', async () => {
    const ctx = newProject();
    const task = addTask(ctx, 1000, 'Implement escrow');
    assert.equal(pool(ctx).committedBps, 1000);

    const contribution = await toPendingApproval(ctx, task.id, IDS.alice, 17);
    assert.equal(pool(ctx).committedBps, 1000, 'approval must not move accounting');

    await allocate(ctx, contribution.id);

    const after = pool(ctx);
    assert.equal(after.committedBps, 0);
    assert.equal(after.allocatedBps, 1000);
    assert.equal(after.remainingBps, 5000);
    assert.equal(after.committedBps + after.allocatedBps + after.remainingBps, 6000);
  });

  // Mirrors allocation.rs::c_retry_after_rejection_never_double_reserves
  it('C. a rejected attempt followed by a retry never doubles committed', async () => {
    const ctx = newProject();
    const task = addTask(ctx, 1000, 'Implement escrow');

    const first = await toPendingApproval(ctx, task.id, IDS.alice, 17);
    ctx.db = domain.rejectContribution(
      ctx.db,
      {
        contributionId: first.id,
        actorUserId: IDS.founder,
        reason: 'Missing tests for the escrow instruction.',
      },
      ctx.deps,
    ).db;
    assert.equal(pool(ctx).committedBps, 1000, 'rejection keeps exactly one reservation');

    const second = await toPendingApproval(ctx, task.id, IDS.alice, 18);
    assert.equal(pool(ctx).committedBps, 1000, 'retry must never reserve 2000');

    await allocate(ctx, second.id);

    const after = pool(ctx);
    assert.equal(after.committedBps, 0);
    assert.equal(after.allocatedBps, 1000);
  });

  // Mirrors allocation.rs::b_second_allocation_fails_and_leaves_accounting_untouched
  it('B/J. a second allocation of the same contribution is refused', async () => {
    const ctx = newProject();
    const task = addTask(ctx, 1000, 'Implement escrow');
    const contribution = await toPendingApproval(ctx, task.id, IDS.alice, 17);
    await allocate(ctx, contribution.id);

    const before = pool(ctx);
    const settlement: Settlement = {
      kind: 'demo',
      allocatedAt: ctx.deps.current(),
      pda: 'DEMO:allocation',
    };
    assert.throws(() =>
      domain.settleAllocation(ctx.db, { contributionId: contribution.id, settlement }, ctx.deps),
    );

    const after = pool(ctx);
    assert.equal(after.committedBps, before.committedBps);
    assert.equal(after.allocatedBps, before.allocatedBps);
  });

  // Mirrors allocation.rs::d_member_ownership_accumulates_across_tasks
  it('D. two tasks for one contributor accumulate to 1500 bps', async () => {
    const ctx = newProject();
    const taskOne = addTask(ctx, 1000, 'Implement escrow');
    const taskTwo = addTask(ctx, 500, 'Add tests');
    assert.equal(pool(ctx).committedBps, 1500);

    const first = await toPendingApproval(ctx, taskOne.id, IDS.alice, 17);
    await allocate(ctx, first.id);
    const second = await toPendingApproval(ctx, taskTwo.id, IDS.alice, 18);
    await allocate(ctx, second.id);

    const after = pool(ctx);
    assert.equal(after.committedBps, 0);
    assert.equal(after.allocatedBps, 1500);
    assert.equal(after.remainingBps, 4500);
  });

  // Mirrors allocation.rs::e_different_contributors_get_separate_ownership
  it('E. two contributors are accounted separately', async () => {
    const ctx = newProject();
    const taskA = addTask(ctx, 1000, 'Implement escrow');
    const taskB = addTask(ctx, 500, 'Add tests');

    const a = await toPendingApproval(ctx, taskA.id, IDS.alice, 17);
    await allocate(ctx, a.id);
    const b = await toPendingApproval(ctx, taskB.id, IDS.bob, 18);
    await allocate(ctx, b.id);

    assert.equal(pool(ctx).allocatedBps, 1500);
    assert.equal(pool(ctx).committedBps, 0);
  });

  // Mirrors allocation.rs::l_pool_invariant_holds_across_a_series
  it('L. the pool invariant holds across the full demo series', async () => {
    const ctx = newProject();
    const rewards = [1000, 800, 500, 300];
    const tasks = rewards.map((r, i) => addTask(ctx, r, 'Task ' + String(i + 1)));
    assert.equal(pool(ctx).committedBps, 2600);

    let allocated = 0;
    for (let i = 0; i < tasks.length; i += 1) {
      const contribution = await toPendingApproval(ctx, tasks[i].id, IDS.alice, 20 + i);
      await allocate(ctx, contribution.id);
      allocated += rewards[i];

      const p = pool(ctx);
      assert.equal(p.allocatedBps, allocated);
      assert.ok(p.committedBps + p.allocatedBps <= 6000);
      assert.equal(p.committedBps + p.allocatedBps + p.remainingBps, 6000);
    }

    const end = pool(ctx);
    assert.equal(end.committedBps, 0);
    assert.equal(end.allocatedBps, 2600);
    assert.equal(end.remainingBps, 3400);
  });
});
