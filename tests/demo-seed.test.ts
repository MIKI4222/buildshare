import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createDemoDB, emptyDB } from '../src/data/demo-seed';
import { poolBreakdown } from '../src/domain/bps';
import { assertPoolInvariants } from '../src/domain/bps';

describe('demo seed', () => {
  it('starts empty with three users and no project', () => {
    const db = emptyDB();
    assert.equal(db.users.length, 3);
    assert.equal(db.projects.length, 0);
    assert.equal(db.auditLogs.length, 0);
  });

  it('builds the AI Arbitration Escrow project with a 40/60 split', async () => {
    const db = await createDemoDB();
    assert.equal(db.projects.length, 1);
    const project = db.projects[0];
    assert.equal(project.founderBps, 4000);
    assert.equal(project.devPoolBps, 6000);
  });

  it('creates four tasks reserving 2600 bps', async () => {
    const db = await createDemoDB();
    assert.equal(db.tasks.length, 4);
    const pool = poolBreakdown(db.projects[0]);
    assert.equal(pool.committedBps, 2600);
    assert.equal(pool.allocatedBps, 0);
    assert.equal(pool.remainingBps, 3400);
  });

  it('satisfies the pool invariants', async () => {
    const db = await createDemoDB();
    assertPoolInvariants(db.projects[0]);
  });

  it('leaves the verified contribution waiting for founder approval', async () => {
    const db = await createDemoDB();
    assert.equal(db.contributions.length, 1);
    assert.equal(db.contributions[0].status, 'PENDING_APPROVAL');
    assert.equal(db.contributions[0].aiScore, 94);
  });

  it('never contains an ONCHAIN status in demo data', async () => {
    const db = await createDemoDB();
    const statuses = db.tasks.map((t) => t.status).concat(db.contributions.map((c) => c.status));
    assert.equal(statuses.indexOf('ONCHAIN'), -1);
    assert.equal(statuses.indexOf('PENDING_ONCHAIN'), -1);
  });

  it('never contains a settlement or signature in demo data', async () => {
    const db = await createDemoDB();
    assert.equal(db.contributions.every((c) => c.settlement === null), true);
    assert.equal(db.auditLogs.every((l) => l.signature === null), true);
  });

  it('records two claimed tasks with frozen commitments', async () => {
    const db = await createDemoDB();
    const claimed = db.tasks.filter((t) => t.commitment !== null);
    assert.equal(claimed.length, 2);
    for (const task of claimed) {
      assert.match(String(task.commitment ? task.commitment.commitmentHash : ''), /^[0-9a-f]{64}$/);
      assert.ok(task.commitment ? task.commitment.claimExpiresAt : null);
    }
  });

  it('is deterministic across two builds', async () => {
    const a = await createDemoDB();
    const b = await createDemoDB();
    assert.equal(JSON.stringify(a), JSON.stringify(b));
  });

  it('writes an audit trail for every demo step', async () => {
    const db = await createDemoDB();
    const types = db.auditLogs.map((l) => l.eventType).sort();
    for (const expected of ['PROJECT_CREATED', 'TASK_CREATED', 'TASK_CLAIMED', 'CONTRIBUTION_SUBMITTED', 'AI_VERIFIED']) {
      assert.ok(types.indexOf(expected) !== -1, 'missing audit event ' + expected);
    }
  });
});
