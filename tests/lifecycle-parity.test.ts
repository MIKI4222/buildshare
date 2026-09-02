// P1 STEP 4 - lifecycle parity between the P0 reducers and the frozen on-chain
// instruction set (claim / expire / cancel / update / retry).
//
// Runnable without a validator: these assertions pin down the reservation
// semantics that programs/buildshare/src/instructions/*.rs must reproduce, so a
// drift between the two layers fails `npm test`.
//
// DOCUMENTED DIFFERENCES (adapter level, no architecture changed here):
//  1. P0 reserves at task CREATION, the program reserves at CLAIM
//     (`Task.reserved_committed`). Both reserve exactly once per task.
//  2. P0 requires OPEN or REJECTED to claim and uses `releaseClaim` to bring an
//     EXPIRED task back to OPEN. The program allows Open | Expired | Rejected
//     directly, so the extra P0 step has no on-chain counterpart.
//  3. P0 cancellation status is BLOCKED, the on-chain status is Cancelled.
//     Both release the reservation exactly once.
//  5. D2 RESOLVED (variant 1): EXPIRED -> BLOCKED and REJECTED -> BLOCKED were
//     added to TASK_TRANSITIONS, so cancellation is now allowed from exactly the
//     three on-chain states (Open | Expired | Rejected).
//  4. D1 RESOLVED (variant 1): CLAIMED -> BLOCKED was removed from
//     TASK_TRANSITIONS, so P0 now refuses to cancel a CLAIMED task exactly like
//     the on-chain `cancel_task` (Open | Expired | Rejected only).

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import * as domain from '../src/domain/reducers';
import { canTransitionTask, TASK_TRANSITIONS } from '../src/domain/state-machine';
import type { AppDB } from '../src/domain/types';
import {
  emptyProjectDB,
  expectDomainError,
  expectDomainErrorAsync,
  IDS,
  makeDeps,
  pullRequestFixture,
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

function addTask(ctx: Ctx, rewardBps: number) {
  const result = domain.createTask(
    ctx.db,
    {
      projectId: ctx.projectId,
      actorUserId: IDS.founder,
      title: 'Implement escrow',
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

function pool(ctx: Ctx) {
  return domain.projectPool(ctx.db, ctx.projectId);
}

function taskOf(ctx: Ctx, taskId: string) {
  return domain.requireTask(ctx.db, taskId);
}

describe('P1 STEP 4 lifecycle parity (claim / expire / cancel / update)', () => {
  it('an expired claim keeps the reservation and the task becomes claimable again', async () => {
    const ctx = newProject();
    const task = addTask(ctx, 1000);

    const claimed = await domain.claimTask(ctx.db, { taskId: task.id, userId: IDS.alice }, ctx.deps);
    ctx.db = claimed.db;
    assert.equal(pool(ctx).committedBps, 1000);

    ctx.deps.advanceDays(8); // past the 7-day claim window
    const expired = domain.expireClaims(ctx.db, ctx.deps);
    ctx.db = expired.db;

    assert.deepEqual(expired.expired, [task.id]);
    assert.equal(taskOf(ctx, task.id).status, 'EXPIRED');
    assert.equal(taskOf(ctx, task.id).assignedUserId, null);
    assert.equal(
      pool(ctx).committedBps,
      1000,
      'expiry must NOT release the reservation: it belongs to the task',
    );

    // Second claim, after the P0 release step, still reserves nothing extra.
    ctx.db = domain.releaseClaim(ctx.db, { taskId: task.id }, ctx.deps).db;
    const reclaimed = await domain.claimTask(
      ctx.db,
      { taskId: task.id, userId: IDS.bob },
      ctx.deps,
    );
    ctx.db = reclaimed.db;
    assert.equal(pool(ctx).committedBps, 1000, 'claim #2 must never reserve twice');
    assert.equal(taskOf(ctx, task.id).status, 'CLAIMED');
  });

  it('cancellation releases the reservation exactly once', () => {
    const ctx = newProject();
    const task = addTask(ctx, 1000);
    assert.equal(pool(ctx).committedBps, 1000);

    ctx.db = domain.cancelTask(ctx.db, { taskId: task.id, actorUserId: IDS.founder }, ctx.deps).db;

    const after = pool(ctx);
    assert.equal(taskOf(ctx, task.id).status, 'BLOCKED');
    assert.equal(after.committedBps, 0);
    assert.equal(after.allocatedBps, 0);
    assert.equal(after.remainingBps, 6000);

    // BLOCKED -> BLOCKED is not a legal transition, so the release can never
    // run twice and drive committed_bps negative.
    expectDomainError(
      () => domain.cancelTask(ctx.db, { taskId: task.id, actorUserId: IDS.founder }, ctx.deps),
      'INVALID_TRANSITION',
    );
    assert.equal(pool(ctx).committedBps, 0);
  });

  it('D1: a CLAIMED task cannot be cancelled, on chain or in P0', async () => {
    const ctx = newProject();
    const task = addTask(ctx, 1000);
    ctx.db = (await domain.claimTask(ctx.db, { taskId: task.id, userId: IDS.alice }, ctx.deps)).db;

    // CLAIMED -> BLOCKED is not a legal task transition any more.
    expectDomainError(
      () => domain.cancelTask(ctx.db, { taskId: task.id, actorUserId: IDS.founder }, ctx.deps),
      'INVALID_TRANSITION',
    );

    assert.equal(taskOf(ctx, task.id).status, 'CLAIMED', 'the claim survives the refused cancel');
    assert.equal(taskOf(ctx, task.id).assignedUserId, IDS.alice);
    assert.equal(pool(ctx).committedBps, 1000, 'a refused cancel releases nothing');
  });

  it('D1: the transition table refuses cancellation of a CLAIMED task', () => {
    assert.equal(canTransitionTask('CLAIMED', 'BLOCKED'), false, 'D1: removed transition');
    assert.equal(canTransitionTask('OPEN', 'BLOCKED'), true);

    // The rest of the CLAIMED row is untouched.
    assert.deepEqual(TASK_TRANSITIONS.CLAIMED, ['SUBMITTED', 'EXPIRED', 'OPEN']);

    // The other rows of the table are untouched by D1.
    assert.deepEqual(TASK_TRANSITIONS.OPEN, ['CLAIMED', 'BLOCKED']);
    assert.deepEqual(TASK_TRANSITIONS.EXPIRED, ['OPEN', 'BLOCKED']);
    assert.deepEqual(TASK_TRANSITIONS.REJECTED, ['CLAIMED', 'OPEN', 'BLOCKED']);
  });

  it('D2: cancellation is allowed from exactly the three on-chain states', () => {
    // Updated expectation: these two were false before D2 was resolved.
    assert.equal(canTransitionTask('EXPIRED', 'BLOCKED'), true);
    assert.equal(canTransitionTask('REJECTED', 'BLOCKED'), true);

    assert.equal(canTransitionTask('OPEN', 'BLOCKED'), true);
    assert.equal(canTransitionTask('CLAIMED', 'BLOCKED'), false, 'D1 must stay closed');
  });

  it('D2: EXPIRED task can be cancelled and reservation is released', async () => {
    const ctx = newProject();
    const task = addTask(ctx, 1000);

    ctx.db = (await domain.claimTask(ctx.db, { taskId: task.id, userId: IDS.alice }, ctx.deps)).db;
    ctx.deps.advanceDays(8);
    ctx.db = domain.expireClaims(ctx.db, ctx.deps).db;

    assert.equal(taskOf(ctx, task.id).status, 'EXPIRED');
    assert.equal(pool(ctx).committedBps, 1000, 'expiry keeps the reservation');
    assert.equal(pool(ctx).allocatedBps, 0);

    ctx.db = domain.cancelTask(ctx.db, { taskId: task.id, actorUserId: IDS.founder }, ctx.deps).db;

    const after = pool(ctx);
    assert.equal(taskOf(ctx, task.id).status, 'BLOCKED');
    assert.equal(after.committedBps, 0, 'released exactly once');
    assert.equal(after.allocatedBps, 0, 'cancellation never allocates');
    assert.equal(after.remainingBps, 6000);

    expectDomainError(
      () => domain.cancelTask(ctx.db, { taskId: task.id, actorUserId: IDS.founder }, ctx.deps),
      'INVALID_TRANSITION',
    );
    assert.equal(pool(ctx).committedBps, 0, 'a second cancel cannot go negative');
    assert.equal(pool(ctx).allocatedBps, 0);
  });

  it('D2: REJECTED task can be cancelled and reservation is released', async () => {
    const ctx = newProject();
    const task = addTask(ctx, 1000);

    ctx.db = (await domain.claimTask(ctx.db, { taskId: task.id, userId: IDS.alice }, ctx.deps)).db;
    const submitted = domain.submitContribution(
      ctx.db,
      { taskId: task.id, userId: IDS.alice, pullRequest: pullRequestFixture(41) },
      ctx.deps,
    );
    ctx.db = submitted.db;
    ctx.db = domain.rejectContribution(
      ctx.db,
      {
        contributionId: submitted.contribution.id,
        actorUserId: IDS.founder,
        reason: 'Acceptance criteria two is not covered by any test.',
      },
      ctx.deps,
    ).db;

    assert.equal(taskOf(ctx, task.id).status, 'REJECTED');
    assert.equal(pool(ctx).committedBps, 1000, 'rejection keeps the reservation');
    assert.equal(pool(ctx).allocatedBps, 0);

    ctx.db = domain.cancelTask(ctx.db, { taskId: task.id, actorUserId: IDS.founder }, ctx.deps).db;

    const after = pool(ctx);
    assert.equal(taskOf(ctx, task.id).status, 'BLOCKED');
    assert.equal(after.committedBps, 0, 'released exactly once');
    assert.equal(after.allocatedBps, 0, 'cancellation never allocates');
    assert.equal(after.remainingBps, 6000);

    expectDomainError(
      () => domain.cancelTask(ctx.db, { taskId: task.id, actorUserId: IDS.founder }, ctx.deps),
      'INVALID_TRANSITION',
    );
    assert.equal(pool(ctx).committedBps, 0, 'a second cancel cannot go negative');
    assert.equal(pool(ctx).allocatedBps, 0);
  });

  it('a non-founder can neither cancel nor edit a task', async () => {
    const ctx = newProject();
    const task = addTask(ctx, 1000);

    expectDomainError(
      () => domain.cancelTask(ctx.db, { taskId: task.id, actorUserId: IDS.alice }, ctx.deps),
      'NOT_AUTHORIZED',
    );
    expectDomainError(
      () =>
        domain.updateTask(
          ctx.db,
          { taskId: task.id, actorUserId: IDS.alice, patch: { rewardBps: 2000 } },
          ctx.deps,
        ),
      'NOT_AUTHORIZED',
    );
    assert.equal(pool(ctx).committedBps, 1000);
    assert.equal(taskOf(ctx, task.id).rewardBps, 1000);
  });

  it('the reward is editable while OPEN and frozen after CLAIMED', async () => {
    const ctx = newProject();
    const task = addTask(ctx, 1000);

    const updated = domain.updateTask(
      ctx.db,
      { taskId: task.id, actorUserId: IDS.founder, patch: { rewardBps: 1500 } },
      ctx.deps,
    );
    ctx.db = updated.db;
    assert.equal(pool(ctx).committedBps, 1500, 'the reservation follows the reward while OPEN');

    ctx.db = (await domain.claimTask(ctx.db, { taskId: task.id, userId: IDS.alice }, ctx.deps)).db;

    expectDomainError(
      () =>
        domain.updateTask(
          ctx.db,
          { taskId: task.id, actorUserId: IDS.founder, patch: { rewardBps: 2000 } },
          ctx.deps,
        ),
      'IMMUTABLE_AFTER_CLAIM',
    );
    assert.equal(pool(ctx).committedBps, 1500, 'a refused update must change no accounting');
  });

  it('a claimed task locks every other contributor out', async () => {
    const ctx = newProject();
    const task = addTask(ctx, 1000);
    ctx.db = (await domain.claimTask(ctx.db, { taskId: task.id, userId: IDS.alice }, ctx.deps)).db;

    await expectDomainErrorAsync(
      () => domain.claimTask(ctx.db, { taskId: task.id, userId: IDS.bob }, ctx.deps),
      'NOT_CLAIMABLE',
    );
    assert.equal(pool(ctx).committedBps, 1000);
  });

  it('a submission after the claim window is refused', async () => {
    const ctx = newProject();
    const task = addTask(ctx, 1000);
    ctx.db = (await domain.claimTask(ctx.db, { taskId: task.id, userId: IDS.alice }, ctx.deps)).db;

    ctx.deps.advanceDays(8);
    expectDomainError(
      () =>
        domain.submitContribution(
          ctx.db,
          { taskId: task.id, userId: IDS.alice, pullRequest: pullRequestFixture(31) },
          ctx.deps,
        ),
      'CLAIM_EXPIRED',
    );
    assert.equal(pool(ctx).committedBps, 1000);
  });

  it('a task reward can never exceed the remaining development pool', () => {
    const ctx = newProject();
    addTask(ctx, 5000);
    expectDomainError(() => addTask(ctx, 1500), 'POOL_EXCEEDED');
    assert.equal(pool(ctx).committedBps, 5000);
    assert.equal(pool(ctx).remainingBps, 1000);
  });
});
