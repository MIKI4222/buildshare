// The contributor wallet used by a claim comes from the session, not from the
// user record. On chain claim_task is signed by the contributor, so the wallet
// baked into the commitment hash must be the one that will actually sign.
//
// The fallback to user.walletAddress is kept on purpose: demo mode and every
// existing test rely on it. These tests pin both paths.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import * as domain from '../src/domain/reducers';
import { emptyProjectDB, expectDomainErrorAsync, IDS, makeDeps, WALLETS } from './helpers';

// A real devnet address, to make it obvious this is a session wallet and not a
// fixture from the seed.
const CONNECTED = '53EeLHJLSaxwiCckBFWm7Soo79xuRRn3atVQ3SJq3EjG';

function seed() {
  const deps = makeDeps();
  const created = domain.createProject(
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
  const withTask = domain.createTask(
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
  return { deps, db: withTask.db, taskId: withTask.task.id };
}

describe('claimTask contributor wallet', () => {
  it('uses the wallet supplied by the caller instead of the user record', async () => {
    const { db, taskId, deps } = seed();
    const claimed = await domain.claimTask(
      db,
      { taskId, userId: IDS.alice, contributorWallet: CONNECTED },
      deps,
    );
    assert.equal(claimed.task.commitment.contributorWallet, CONNECTED);
    // The user record is untouched: the wallet belongs to the session.
    assert.equal(claimed.db.users.filter((u) => u.id === IDS.alice)[0].walletAddress, WALLETS.alice);
  });

  it('falls back to the user record when no wallet is supplied', async () => {
    const { db, taskId, deps } = seed();
    const claimed = await domain.claimTask(db, { taskId, userId: IDS.alice }, deps);
    assert.equal(claimed.task.commitment.contributorWallet, WALLETS.alice);
  });

  it('bakes the wallet into the commitment hash', async () => {
    const a = seed();
    const withConnected = await domain.claimTask(
      a.db,
      { taskId: a.taskId, userId: IDS.alice, contributorWallet: CONNECTED },
      a.deps,
    );
    const b = seed();
    const withFallback = await domain.claimTask(b.db, { taskId: b.taskId, userId: IDS.alice }, b.deps);
    // Same task, same attempt, different wallet: the hashes must differ, or the
    // wallet is being dropped somewhere between the input and the hash.
    assert.notEqual(
      withConnected.task.commitment.commitmentHash,
      withFallback.task.commitment.commitmentHash,
    );
  });

  it('trims the supplied wallet', async () => {
    const { db, taskId, deps } = seed();
    const claimed = await domain.claimTask(
      db,
      { taskId, userId: IDS.alice, contributorWallet: '  ' + CONNECTED + '  ' },
      deps,
    );
    assert.equal(claimed.task.commitment.contributorWallet, CONNECTED);
  });

  it('refuses a blank wallet instead of hashing an empty string', async () => {
    const { db, taskId, deps } = seed();
    await expectDomainErrorAsync(
      () => domain.claimTask(db, { taskId, userId: IDS.alice, contributorWallet: '   ' }, deps),
      'NOT_CLAIMABLE',
    );
  });
});
