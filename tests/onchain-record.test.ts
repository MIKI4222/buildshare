// Recording confirmed on-chain facts on local entities.
//
// These reducers are the only way onchainProjectId/solanaProjectPda and
// onchainTaskId ever get a value. The tests pin the two properties that matter:
// recording the same fact twice is harmless, recording a different fact is
// refused instead of silently overwriting.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createProject,
  createTask,
  recordOnchainProject,
  recordOnchainTask,
  nextOnchainTaskIdCandidate,
} from '../src/domain/reducers';
import { emptyProjectDB, expectDomainError, IDS, makeDeps, WALLETS } from './helpers';

const PDA_A = 'E8UyjRSsDU37jfSXdFCj94iUn4Rriqm3uJ3ienbALffm';
const PDA_B = '86HrAtuw4BUtQ2Jd747mXu1rUhaeczyz2i9TevV99BRX';

function seed() {
  const deps = makeDeps();
  const created = createProject(
    emptyProjectDB(),
    {
      name: 'BuildShare',
      description: 'Ownership protocol.',
      ownerUserId: IDS.founder,
      founderWallet: WALLETS.founder,
      founderBps: 4000,
      devPoolBps: 6000,
      category: 'infrastructure',
    },
    deps,
  );
  const withTask = createTask(
    created.db,
    {
      projectId: created.project.id,
      actorUserId: IDS.founder,
      title: 'Implement escrow',
      description: 'Escrow program.',
      acceptanceCriteria: 'All tests pass.',
      rewardBps: 1000,
      githubIssueNumber: 1,
      difficulty: 'medium',
      deadline: null,
    },
    deps,
  );
  // The project snapshot must be taken AFTER createTask: creating a task
  // reserves the reward, so created.project still shows committedBps 0 while
  // the stored project already shows 1000. Comparing against the stale copy
  // would test the reservation, not the recorder.
  return { deps, db: withTask.db, project: withTask.db.projects[0], task: withTask.task };
}

describe('recordOnchainProject', () => {
  it('writes the pda and leaves accounting untouched', () => {
    const { db, project, deps } = seed();
    const out = recordOnchainProject(db, project.id, { pda: PDA_A, onchainProjectId: 1 }, deps);
    assert.equal(out.project.solanaProjectPda, PDA_A);
    assert.equal(out.project.founderBps, project.founderBps);
    assert.equal(out.project.devPoolBps, project.devPoolBps);
    assert.equal(out.project.committedBps, project.committedBps);
    assert.equal(out.project.allocatedBps, project.allocatedBps);
    assert.equal(out.project.status, project.status);
  });

  it('appends exactly one audit event', () => {
    const { db, project, deps } = seed();
    const before = db.auditLogs.length;
    const out = recordOnchainProject(db, project.id, { pda: PDA_A, onchainProjectId: 1 }, deps);
    assert.equal(out.db.auditLogs.length, before + 1);
    assert.equal(out.db.auditLogs[0].eventType, 'ONCHAIN_PROJECT_RECORDED');
    assert.equal(out.db.auditLogs[0].metadata.pda, PDA_A);
    // No signature is claimed here: the reducer records a fact, not a transaction.
    assert.equal(out.db.auditLogs[0].signature, null);
  });

  it('is idempotent for the identical fact and does not duplicate the audit', () => {
    const { db, project, deps } = seed();
    const first = recordOnchainProject(db, project.id, { pda: PDA_A, onchainProjectId: 1 }, deps);
    const second = recordOnchainProject(first.db, project.id, { pda: PDA_A, onchainProjectId: 1 }, deps);
    assert.equal(second.project.solanaProjectPda, PDA_A);
    assert.equal(second.db.auditLogs.length, first.db.auditLogs.length);
  });

  it('refuses to overwrite an already recorded pda', () => {
    const { db, project, deps } = seed();
    const first = recordOnchainProject(db, project.id, { pda: PDA_A, onchainProjectId: 1 }, deps);
    expectDomainError(
      () => recordOnchainProject(first.db, project.id, { pda: PDA_B, onchainProjectId: 1 }, deps),
      'INVARIANT_VIOLATION',
    );
    // The stored value is unchanged after the refusal.
    assert.equal(first.db.projects[0].solanaProjectPda, PDA_A);
  });

  it('refuses an id that contradicts the founder-scoped counter', () => {
    const { db, project, deps } = seed();
    expectDomainError(
      () => recordOnchainProject(db, project.id, { pda: PDA_A, onchainProjectId: 7 }, deps),
      'INVARIANT_VIOLATION',
    );
  });

  it('refuses a non-base58 pda and a non-positive id', () => {
    const { db, project, deps } = seed();
    expectDomainError(
      () => recordOnchainProject(db, project.id, { pda: 'demo-pda-not-real', onchainProjectId: 1 }, deps),
      'INVARIANT_VIOLATION',
    );
    expectDomainError(
      () => recordOnchainProject(db, project.id, { pda: PDA_A, onchainProjectId: 0 }, deps),
      'INVARIANT_VIOLATION',
    );
  });

  it('refuses an unknown project', () => {
    const { db, deps } = seed();
    expectDomainError(
      () => recordOnchainProject(db, 'prj_missing', { pda: PDA_A, onchainProjectId: 1 }, deps),
      'PROJECT_NOT_FOUND',
    );
  });
});

describe('recordOnchainTask', () => {
  it('accepts zero, because on chain the first task id is task_count', () => {
    const { db, task, deps } = seed();
    const out = recordOnchainTask(db, task.id, { onchainTaskId: 0 }, deps);
    assert.equal(out.task.onchainTaskId, 0);
    assert.equal(out.task.status, task.status);
    assert.equal(out.task.rewardBps, task.rewardBps);
    assert.equal(out.db.auditLogs[0].eventType, 'ONCHAIN_TASK_RECORDED');
  });

  it('is idempotent for the identical id', () => {
    const { db, task, deps } = seed();
    const first = recordOnchainTask(db, task.id, { onchainTaskId: 3 }, deps);
    const second = recordOnchainTask(first.db, task.id, { onchainTaskId: 3 }, deps);
    assert.equal(second.task.onchainTaskId, 3);
    assert.equal(second.db.auditLogs.length, first.db.auditLogs.length);
  });

  it('refuses to change an already recorded id', () => {
    const { db, task, deps } = seed();
    const first = recordOnchainTask(db, task.id, { onchainTaskId: 3 }, deps);
    expectDomainError(
      () => recordOnchainTask(first.db, task.id, { onchainTaskId: 4 }, deps),
      'INVARIANT_VIOLATION',
    );
  });

  it('refuses a negative or fractional id and an unknown task', () => {
    const { db, task, deps } = seed();
    expectDomainError(() => recordOnchainTask(db, task.id, { onchainTaskId: -1 }, deps), 'INVARIANT_VIOLATION');
    expectDomainError(() => recordOnchainTask(db, task.id, { onchainTaskId: 1.5 }, deps), 'INVARIANT_VIOLATION');
    expectDomainError(() => recordOnchainTask(db, 'tsk_missing', { onchainTaskId: 1 }, deps), 'TASK_NOT_FOUND');
  });
});

describe('nextOnchainTaskIdCandidate (STOP-8)', () => {
  it('is 0 when nothing is recorded on chain yet', () => {
    const { db, project } = seed();
    assert.equal(nextOnchainTaskIdCandidate(db, project.id), 0);
  });

  it('is max + 1 once an id is recorded', () => {
    const { db, project, task, deps } = seed();
    const after = recordOnchainTask(db, task.id, { onchainTaskId: 0 }, deps);
    assert.equal(nextOnchainTaskIdCandidate(after.db, project.id), 1);
  });

  it('uses the maximum, not the count, so ids are never reused', () => {
    const { db, project, task, deps } = seed();
    // A task recorded with id 7 (for example created outside this client)
    // must push the candidate to 8, not to 1.
    const after = recordOnchainTask(db, task.id, { onchainTaskId: 7 }, deps);
    assert.equal(nextOnchainTaskIdCandidate(after.db, project.id), 8);
  });

  it('ignores tasks that have no confirmed id', () => {
    const { db, project } = seed();
    assert.equal(db.tasks[0].onchainTaskId, null);
    assert.equal(nextOnchainTaskIdCandidate(db, project.id), 0);
  });

  it('refuses an unknown project', () => {
    const { db } = seed();
    expectDomainError(() => nextOnchainTaskIdCandidate(db, 'prj_missing'), 'PROJECT_NOT_FOUND');
  });
});
