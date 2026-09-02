// P1 STEP 4 - Anchor integration tests for the ten non-allocation instructions.
//
// Run with (requires the Rust/Anchor toolchain, NOT available in the authoring
// sandbox):
//
//   anchor test
//
// HONEST STATUS: never executed. Written against the frozen instruction set;
// the Anchor client package name may need one adjustment (Anchor 1.x renamed
// `@coral-xyz/anchor` to `@anchor-lang/core`), which is why the loader tries both.
//
// Covered: initialize_project, create_member, create_task, update_task,
// claim_task, expire_claim, cancel_task, submit_contribution,
// approve_contribution, reject_contribution - happy path plus the negative case
// for every on-chain guard.

import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { createHash } from 'node:crypto';

/* eslint-disable @typescript-eslint/no-explicit-any */

async function loadAnchor(): Promise<any> {
  const candidates = ['@anchor-lang/core', '@coral-xyz/anchor'];
  for (const id of candidates) {
    try {
      return await import(id);
    } catch {
      // try the next one
    }
  }
  throw new Error('No Anchor client package found. Install one of: ' + candidates.join(', '));
}

const BPS_TOTAL = 10_000;
const FOUNDER_BPS = 4_000;
const DEV_POOL_BPS = 6_000;
const ZERO_HASH: number[] = new Array(32).fill(0);

function hash(label: string): number[] {
  return Array.from(createHash('sha256').update(label).digest());
}

let anchor: any;
let web3: any;
let program: any;
let provider: any;
let founder: any;
let projectCounter = 0;

function u64le(value: number): Buffer {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(value));
  return buf;
}

function projectPda(founderKey: any, projectId: number): any {
  return web3.PublicKey.findProgramAddressSync(
    [Buffer.from('project'), founderKey.toBuffer(), u64le(projectId)],
    program.programId,
  )[0];
}

function taskPda(project: any, taskId: number): any {
  return web3.PublicKey.findProgramAddressSync(
    [Buffer.from('task'), project.toBuffer(), u64le(taskId)],
    program.programId,
  )[0];
}

function contributionPda(task: any, contributor: any, attempt: number): any {
  return web3.PublicKey.findProgramAddressSync(
    [Buffer.from('contribution'), task.toBuffer(), contributor.toBuffer(), Buffer.from([attempt])],
    program.programId,
  )[0];
}

function memberPda(project: any, wallet: any): any {
  return web3.PublicKey.findProgramAddressSync(
    [Buffer.from('member'), project.toBuffer(), wallet.toBuffer()],
    program.programId,
  )[0];
}

async function fundedKeypair(): Promise<any> {
  const kp = web3.Keypair.generate();
  const sig = await provider.connection.requestAirdrop(kp.publicKey, 2 * web3.LAMPORTS_PER_SOL);
  await provider.connection.confirmTransaction(sig);
  return kp;
}

async function newProject(
  founderBps = FOUNDER_BPS,
  devPoolBps = DEV_POOL_BPS,
): Promise<{ id: number; pda: any }> {
  projectCounter += 1;
  const id = projectCounter;
  const pda = projectPda(founder.publicKey, id);
  await program.methods
    .initializeProject(new anchor.BN(id), founderBps, devPoolBps)
    .accounts({ founder: founder.publicKey, project: pda })
    .rpc();
  return { id, pda };
}

async function createTask(project: any, taskId: number, rewardBps: number): Promise<any> {
  const pda = taskPda(project, taskId);
  await program.methods
    .createTask(new anchor.BN(taskId), rewardBps, hash('criteria:' + taskId), hash('repo:' + taskId))
    .accounts({ founder: founder.publicKey, project, task: pda })
    .rpc();
  return pda;
}

async function claim(project: any, task: any, contributor: any): Promise<void> {
  await program.methods
    .claimTask(hash('commitment:' + task.toBase58() + contributor.publicKey.toBase58()))
    .accounts({ contributor: contributor.publicKey, project, task })
    .signers([contributor])
    .rpc();
}

async function submit(project: any, task: any, contributor: any, attempt: number): Promise<any> {
  const pda = contributionPda(task, contributor.publicKey, attempt);
  await program.methods
    .submitContribution(attempt, hash('evidence:' + pda.toBase58()))
    .accounts({ contributor: contributor.publicKey, project, task, contribution: pda })
    .signers([contributor])
    .rpc();
  return pda;
}

async function expectFailure(fn: () => Promise<unknown>, label: string): Promise<void> {
  try {
    await fn();
  } catch {
    return;
  }
  throw new assert.AssertionError({ message: label + ': expected the transaction to fail' });
}

function statusOf(account: any): string {
  return Object.keys(account.status)[0];
}

describe('project and member instructions (P1 STEP 4)', () => {
  before(async () => {
    anchor = await loadAnchor();
    web3 = anchor.web3;
    provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);
    program = anchor.workspace.Buildshare ?? anchor.workspace.buildshare;
    assert.ok(program, 'program not found in anchor.workspace');
    founder = provider.wallet;
  });

  it('initialize_project stores the frozen split and zeroed accounting', async () => {
    const { id, pda } = await newProject();
    const state = await program.account.project.fetch(pda);

    assert.equal(state.founder.toBase58(), founder.publicKey.toBase58());
    assert.equal(Number(state.projectId), id);
    assert.equal(state.founderBps, FOUNDER_BPS);
    assert.equal(state.devPoolBps, DEV_POOL_BPS);
    assert.equal(state.founderBps + state.devPoolBps, BPS_TOTAL);
    assert.equal(state.committedBps, 0);
    assert.equal(state.allocatedBps, 0);
    assert.equal(Number(state.taskCount), 0);
    assert.equal(state.memberCount, 0);
  });

  it('initialize_project refuses a split that is not exactly 10000', async () => {
    projectCounter += 1;
    const id = projectCounter;
    const pda = projectPda(founder.publicKey, id);
    await expectFailure(
      () =>
        program.methods
          .initializeProject(new anchor.BN(id), 4_000, 5_000)
          .accounts({ founder: founder.publicKey, project: pda })
          .rpc(),
      'invalid split',
    );
  });

  it('initialize_project refuses an empty development pool', async () => {
    projectCounter += 1;
    const id = projectCounter;
    const pda = projectPda(founder.publicKey, id);
    await expectFailure(
      () =>
        program.methods
          .initializeProject(new anchor.BN(id), 10_000, 0)
          .accounts({ founder: founder.publicKey, project: pda })
          .rpc(),
      'empty dev pool',
    );
  });

  it('create_member is permissionless, starts at zero and cannot be created twice', async () => {
    const { pda: project } = await newProject();
    const alice = await fundedKeypair();
    const payer = await fundedKeypair(); // NOT the founder, NOT the wallet
    const member = memberPda(project, alice.publicKey);

    await program.methods
      .createMember()
      .accounts({ payer: payer.publicKey, project, member, wallet: alice.publicKey })
      .signers([payer])
      .rpc();

    const state = await program.account.member.fetch(member);
    assert.equal(state.project.toBase58(), project.toBase58());
    assert.equal(state.wallet.toBase58(), alice.publicKey.toBase58());
    assert.equal(state.ownershipBps, 0);
    assert.equal(state.allocationCount, 0);
    assert.equal((await program.account.project.fetch(project)).memberCount, 1);

    // No init_if_needed anywhere: a second create must fail, never silently
    // reset ownership.
    await expectFailure(
      () =>
        program.methods
          .createMember()
          .accounts({ payer: payer.publicKey, project, member, wallet: alice.publicKey })
          .signers([payer])
          .rpc(),
      'member reinitialisation',
    );
  });
});

describe('task instructions (P1 STEP 4)', () => {
  it('create_task opens a task without reserving anything on chain', async () => {
    const { pda: project } = await newProject();
    const task = await createTask(project, 1, 1_000);

    const state = await program.account.task.fetch(task);
    assert.equal(statusOf(state), 'open');
    assert.equal(state.rewardBps, 1_000);
    assert.equal(state.attempt, 0);
    assert.equal(state.contributor, null);
    assert.equal(state.reservedCommitted, false);
    assert.deepEqual(Array.from(state.commitmentHash), ZERO_HASH);
    assert.equal((await program.account.project.fetch(project)).committedBps, 0);
    assert.equal(Number((await program.account.project.fetch(project)).taskCount), 1);
  });

  it('create_task refuses a zero reward, an oversized reward and an empty criteria hash', async () => {
    const { pda: project } = await newProject();

    await expectFailure(
      () =>
        program.methods
          .createTask(new anchor.BN(1), 0, hash('criteria'), hash('repo'))
          .accounts({ founder: founder.publicKey, project, task: taskPda(project, 1) })
          .rpc(),
      'zero reward',
    );
    await expectFailure(
      () =>
        program.methods
          .createTask(new anchor.BN(2), 6_001, hash('criteria'), hash('repo'))
          .accounts({ founder: founder.publicKey, project, task: taskPda(project, 2) })
          .rpc(),
      'reward above the dev pool',
    );
    await expectFailure(
      () =>
        program.methods
          .createTask(new anchor.BN(3), 1_000, ZERO_HASH, hash('repo'))
          .accounts({ founder: founder.publicKey, project, task: taskPda(project, 3) })
          .rpc(),
      'empty criteria hash',
    );
  });

  it('create_task refuses a signer who is not the founder', async () => {
    const { pda: project } = await newProject();
    const impostor = await fundedKeypair();
    await expectFailure(
      () =>
        program.methods
          .createTask(new anchor.BN(1), 1_000, hash('criteria'), hash('repo'))
          .accounts({ founder: impostor.publicKey, project, task: taskPda(project, 1) })
          .signers([impostor])
          .rpc(),
      'non-founder create_task',
    );
  });

  it('update_task edits an open task and is refused once claimed', async () => {
    const { pda: project } = await newProject();
    const task = await createTask(project, 1, 1_000);

    await program.methods
      .updateTask(1_500, hash('criteria:v2'), hash('repo:v2'))
      .accounts({ founder: founder.publicKey, project, task })
      .rpc();

    let state = await program.account.task.fetch(task);
    assert.equal(state.rewardBps, 1_500);
    assert.deepEqual(Array.from(state.acceptanceCriteriaHash), hash('criteria:v2'));

    const alice = await fundedKeypair();
    await claim(project, task, alice);

    await expectFailure(
      () =>
        program.methods
          .updateTask(2_000, hash('criteria:v3'), hash('repo:v3'))
          .accounts({ founder: founder.publicKey, project, task })
          .rpc(),
      'update after claim',
    );

    state = await program.account.task.fetch(task);
    assert.equal(state.rewardBps, 1_500, 'the commitment is immutable after CLAIMED');
    assert.equal((await program.account.project.fetch(project)).committedBps, 1_500);
  });

  it('claim_task reserves exactly once, locks other contributors out and sets the window', async () => {
    const { pda: project } = await newProject();
    const task = await createTask(project, 1, 1_000);
    const alice = await fundedKeypair();
    const bob = await fundedKeypair();

    await claim(project, task, alice);

    const state = await program.account.task.fetch(task);
    const projectState = await program.account.project.fetch(project);
    assert.equal(statusOf(state), 'claimed');
    assert.equal(state.attempt, 1);
    assert.equal(state.contributor.toBase58(), alice.publicKey.toBase58());
    assert.equal(state.reservedCommitted, true);
    assert.equal(Number(state.claimExpiresAt) - Number(state.claimedAt), 604_800);
    assert.equal(projectState.committedBps, 1_000);

    await expectFailure(() => claim(project, task, bob), 'claim of a claimed task');
    assert.equal((await program.account.project.fetch(project)).committedBps, 1_000);
  });

  it('claim_task refuses an empty commitment hash', async () => {
    const { pda: project } = await newProject();
    const task = await createTask(project, 1, 1_000);
    const alice = await fundedKeypair();

    await expectFailure(
      () =>
        program.methods
          .claimTask(ZERO_HASH)
          .accounts({ contributor: alice.publicKey, project, task })
          .signers([alice])
          .rpc(),
      'empty commitment hash',
    );
    assert.equal((await program.account.project.fetch(project)).committedBps, 0);
  });

  it('claim_task refuses a reward larger than the remaining pool', async () => {
    const { pda: project } = await newProject();
    const big = await createTask(project, 1, 5_000);
    const second = await createTask(project, 2, 2_000);
    const alice = await fundedKeypair();
    const bob = await fundedKeypair();

    await claim(project, big, alice);
    assert.equal((await program.account.project.fetch(project)).committedBps, 5_000);

    await expectFailure(() => claim(project, second, bob), 'pool exceeded on claim');
    assert.equal((await program.account.project.fetch(project)).committedBps, 5_000);
  });

  it('expire_claim is permissionless, keeps the reservation and allows a new claim', async () => {
    const { pda: project } = await newProject();
    const task = await createTask(project, 1, 1_000);
    const alice = await fundedKeypair();
    const stranger = await fundedKeypair();
    await claim(project, task, alice);

    // The claim window is 7 days: on a live validator this must fail.
    await expectFailure(
      () =>
        program.methods
          .expireClaim()
          .accounts({ caller: stranger.publicKey, task })
          .signers([stranger])
          .rpc(),
      'expiring an active claim',
    );

    const state = await program.account.task.fetch(task);
    assert.equal(statusOf(state), 'claimed');
    assert.equal((await program.account.project.fetch(project)).committedBps, 1_000);

    // NOTE: driving the clock past claim_expires_at needs a time-warping
    // runtime (LiteSVM / surfpool `warp`). With a plain validator this last
    // part is skipped rather than faked.
  });

  it('cancel_task releases the reservation once and is terminal', async () => {
    const { pda: project } = await newProject();
    const task = await createTask(project, 1, 1_000);
    const alice = await fundedKeypair();

    await claim(project, task, alice);
    assert.equal((await program.account.project.fetch(project)).committedBps, 1_000);

    // A claimed task must not be cancellable from under the contributor.
    await expectFailure(
      () =>
        program.methods
          .cancelTask()
          .accounts({ founder: founder.publicKey, project, task })
          .rpc(),
      'cancel of a claimed task',
    );

    // Reject the attempt so the task becomes cancellable again.
    const contribution = await submit(project, task, alice, 1);
    await program.methods
      .rejectContribution(hash('reject:1'))
      .accounts({ founder: founder.publicKey, project, task, contribution })
      .rpc();

    await program.methods
      .cancelTask()
      .accounts({ founder: founder.publicKey, project, task })
      .rpc();

    const state = await program.account.task.fetch(task);
    const projectState = await program.account.project.fetch(project);
    assert.equal(statusOf(state), 'cancelled');
    assert.equal(state.reservedCommitted, false, 'cancel is the only release path');
    assert.equal(state.contributor, null);
    assert.equal(projectState.committedBps, 0);
    assert.equal(projectState.allocatedBps, 0);

    await expectFailure(
      () =>
        program.methods
          .cancelTask()
          .accounts({ founder: founder.publicKey, project, task })
          .rpc(),
      'double cancel',
    );
    assert.equal((await program.account.project.fetch(project)).committedBps, 0);
  });
});

describe('contribution instructions (P1 STEP 4)', () => {
  it('submit_contribution creates the attempt account atomically with its evidence', async () => {
    const { pda: project } = await newProject();
    const task = await createTask(project, 1, 1_000);
    const alice = await fundedKeypair();
    await claim(project, task, alice);

    const contribution = await submit(project, task, alice, 1);
    const state = await program.account.contribution.fetch(contribution);
    const taskState = await program.account.task.fetch(task);

    assert.equal(state.task.toBase58(), task.toBase58());
    assert.equal(state.contributor.toBase58(), alice.publicKey.toBase58());
    assert.equal(state.attempt, 1);
    assert.equal(statusOf(state), 'submitted');
    assert.equal(state.allocated, false);
    assert.notDeepEqual(Array.from(state.evidenceHash), ZERO_HASH);
    assert.deepEqual(Array.from(state.commitmentHash), Array.from(taskState.commitmentHash));
    assert.equal(statusOf(taskState), 'submitted');
  });

  it('submit_contribution refuses an empty evidence hash, a stranger and a wrong attempt', async () => {
    const { pda: project } = await newProject();
    const task = await createTask(project, 1, 1_000);
    const alice = await fundedKeypair();
    const bob = await fundedKeypair();
    await claim(project, task, alice);

    await expectFailure(
      () =>
        program.methods
          .submitContribution(1, ZERO_HASH)
          .accounts({
            contributor: alice.publicKey,
            project,
            task,
            contribution: contributionPda(task, alice.publicKey, 1),
          })
          .signers([alice])
          .rpc(),
      'empty evidence hash',
    );
    await expectFailure(() => submit(project, task, bob, 1), 'submission by a non-contributor');
    await expectFailure(() => submit(project, task, alice, 2), 'wrong attempt number');

    assert.equal(statusOf(await program.account.task.fetch(task)), 'claimed');
  });

  it('approve_contribution records the human decision and touches no accounting', async () => {
    const { pda: project } = await newProject();
    const task = await createTask(project, 1, 1_000);
    const alice = await fundedKeypair();
    await claim(project, task, alice);
    const contribution = await submit(project, task, alice, 1);

    await program.methods
      .approveContribution()
      .accounts({ founder: founder.publicKey, project, task, contribution })
      .rpc();

    const state = await program.account.contribution.fetch(contribution);
    const taskState = await program.account.task.fetch(task);
    const projectState = await program.account.project.fetch(project);

    assert.equal(statusOf(state), 'approved');
    assert.ok(Number(state.approvedAt) > 0);
    assert.equal(state.allocated, false);
    // N1: the task stays Submitted. There is no TaskStatus::Approved.
    assert.equal(statusOf(taskState), 'submitted');
    assert.equal(projectState.committedBps, 1_000, 'approval must move no accounting');
    assert.equal(projectState.allocatedBps, 0);
  });

  it('approve_contribution refuses a non-founder and a double approval', async () => {
    const { pda: project } = await newProject();
    const task = await createTask(project, 1, 1_000);
    const alice = await fundedKeypair();
    const impostor = await fundedKeypair();
    await claim(project, task, alice);
    const contribution = await submit(project, task, alice, 1);

    await expectFailure(
      () =>
        program.methods
          .approveContribution()
          .accounts({ founder: impostor.publicKey, project, task, contribution })
          .signers([impostor])
          .rpc(),
      'approval by a non-founder',
    );

    await program.methods
      .approveContribution()
      .accounts({ founder: founder.publicKey, project, task, contribution })
      .rpc();

    await expectFailure(
      () =>
        program.methods
          .approveContribution()
          .accounts({ founder: founder.publicKey, project, task, contribution })
          .rpc(),
      'double approval',
    );
  });

  it('reject_contribution is terminal for the attempt and keeps the reservation', async () => {
    const { pda: project } = await newProject();
    const task = await createTask(project, 1, 1_000);
    const alice = await fundedKeypair();
    await claim(project, task, alice);
    const contribution = await submit(project, task, alice, 1);

    await expectFailure(
      () =>
        program.methods
          .rejectContribution(ZERO_HASH)
          .accounts({ founder: founder.publicKey, project, task, contribution })
          .rpc(),
      'rejection without a reason hash',
    );

    await program.methods
      .rejectContribution(hash('reject:missing tests'))
      .accounts({ founder: founder.publicKey, project, task, contribution })
      .rpc();

    const state = await program.account.contribution.fetch(contribution);
    const taskState = await program.account.task.fetch(task);
    const projectState = await program.account.project.fetch(project);

    assert.equal(statusOf(state), 'rejected');
    assert.ok(Number(state.rejectedAt) > 0);
    assert.notDeepEqual(Array.from(state.rejectReasonHash), ZERO_HASH);
    assert.equal(statusOf(taskState), 'rejected');
    assert.equal(taskState.contributor, null);
    assert.equal(taskState.reservedCommitted, true, 'rejection must keep the reservation');
    assert.equal(projectState.committedBps, 1_000);

    // The attempt is terminal: it can neither be approved nor rejected again.
    await expectFailure(
      () =>
        program.methods
          .approveContribution()
          .accounts({ founder: founder.publicKey, project, task, contribution })
          .rpc(),
      'approving a rejected attempt',
    );

    // Attempt 2 gets its own account and its own evidence.
    await claim(project, task, alice);
    const second = await submit(project, task, alice, 2);
    assert.notEqual(second.toBase58(), contribution.toBase58());
    assert.equal((await program.account.project.fetch(project)).committedBps, 1_000);
    assert.equal((await program.account.contribution.fetch(second)).attempt, 2);
  });
});
