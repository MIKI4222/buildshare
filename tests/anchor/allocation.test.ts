// P1 STEP 3 - Anchor integration tests for allocate_ownership.
//
// Run with (requires the Rust/Anchor toolchain, NOT available in the authoring
// sandbox):
//
//   anchor test
//   # or, against an already running validator / surfpool:
//   npx tsx --test tests/anchor/*.test.ts
//
// HONEST STATUS: this file has never been executed. It is written against the
// Anchor client API and the frozen instruction set; import name and provider
// bootstrap may need one adjustment depending on which Anchor client package
// the workspace resolves (Anchor 1.x renamed `@coral-xyz/anchor` to
// `@anchor-lang/core`), which is why the loader below tries both.
//
// Matrix covered: A basic, B double allocation, C retry after rejection,
// D member accumulation, E different contributors, F wrong contributor,
// G wrong founder, H wrong attempt, I unapproved, J already allocated,
// K insufficient committed (documented as unreachable), L pool invariant.

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
  throw new Error(
    'No Anchor client package found. Install one of: ' + candidates.join(', '),
  );
}

const BPS_TOTAL = 10_000;
const FOUNDER_BPS = 4_000;
const DEV_POOL_BPS = 6_000;

function hash(label: string): number[] {
  return Array.from(createHash('sha256').update(label).digest());
}

let anchor: any;
let web3: any;
let program: any;
let provider: any;
let founder: any; // the provider wallet, founder of every project below
// Each test process needs its own project_id namespace: the Project PDA is
// ["project", founder, project_id] and every test file shares the same
// provider wallet as founder. Fixed counters made the two files derive
// identical PDAs (System Program: "already in use"), and made reruns collide
// with state left on a persistent validator ledger.
const PROJECT_ID_BASE = Math.floor(Math.random() * 2 ** 40);
let projectCounter = PROJECT_ID_BASE;

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
  const sig = await provider.connection.requestAirdrop(
    kp.publicKey,
    2 * web3.LAMPORTS_PER_SOL,
  );
  await provider.connection.confirmTransaction(sig);
  return kp;
}

/** A fresh project owned by the provider wallet. */
async function newProject(): Promise<{ id: number; pda: any }> {
  projectCounter += 1;
  const id = projectCounter;
  const pda = projectPda(founder.publicKey, id);
  await program.methods
    .initializeProject(new anchor.BN(id), FOUNDER_BPS, DEV_POOL_BPS)
    .accounts({ founder: founder.publicKey, project: pda })
    .rpc();
  return { id, pda };
}

async function createMember(project: any, wallet: any): Promise<any> {
  const pda = memberPda(project, wallet);
  await program.methods
    .createMember()
    .accounts({ payer: founder.publicKey, project, member: pda, wallet })
    .rpc();
  return pda;
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

async function submit(task: any, contributor: any, attempt: number): Promise<any> {
  const pda = contributionPda(task, contributor.publicKey, attempt);
  await program.methods
    .submitContribution(attempt, hash('evidence:' + pda.toBase58()))
    .accounts({ contributor: contributor.publicKey, task, contribution: pda })
    .signers([contributor])
    .rpc();
  return pda;
}

async function approve(project: any, task: any, contribution: any): Promise<void> {
  await program.methods
    .approveContribution()
    .accounts({ founder: founder.publicKey, project, task, contribution })
    .rpc();
}

async function reject(project: any, task: any, contribution: any): Promise<void> {
  await program.methods
    .rejectContribution(hash('reject:' + contribution.toBase58()))
    .accounts({ founder: founder.publicKey, project, task, contribution })
    .rpc();
}

function allocateBuilder(project: any, task: any, contribution: any, member: any, signer?: any) {
  const builder = program.methods.allocateOwnership().accounts({
    founder: signer ? signer.publicKey : founder.publicKey,
    project,
    task,
    contribution,
    member,
  });
  return signer ? builder.signers([signer]) : builder;
}

async function expectFailure(fn: () => Promise<unknown>, label: string): Promise<void> {
  try {
    await fn();
  } catch {
    return;
  }
  throw new assert.AssertionError({ message: label + ': expected the transaction to fail' });
}

/** Drives one attempt all the way to an approved contribution. */
async function toApproved(
  project: any,
  task: any,
  contributor: any,
  attempt: number,
): Promise<any> {
  await claim(project, task, contributor);
  const contribution = await submit(task, contributor, attempt);
  await approve(project, task, contribution);
  return contribution;
}

describe('allocate_ownership (P1 STEP 3)', () => {
  before(async () => {
    anchor = await loadAnchor();
    web3 = anchor.web3;
    provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);
    program = anchor.workspace.Buildshare ?? anchor.workspace.buildshare;
    assert.ok(program, 'program not found in anchor.workspace');
    founder = provider.wallet;
  });

  // A. Basic allocation.
  it('A. allocates the reward and settles the contribution', async () => {
    const { pda: project } = await newProject();
    const alice = await fundedKeypair();
    const member = await createMember(project, alice.publicKey);
    const task = await createTask(project, 1, 1_000);

    const contribution = await toApproved(project, task, alice, 1);

    let projectState = await program.account.project.fetch(project);
    assert.equal(projectState.committedBps, 1_000, 'approval must not move accounting');
    assert.equal(projectState.allocatedBps, 0);

    await allocateBuilder(project, task, contribution, member).rpc();

    projectState = await program.account.project.fetch(project);
    const memberState = await program.account.member.fetch(member);
    const contributionState = await program.account.contribution.fetch(contribution);
    const taskState = await program.account.task.fetch(task);

    assert.equal(memberState.ownershipBps, 1_000);
    assert.equal(memberState.allocationCount, 1);
    assert.equal(projectState.committedBps, 0);
    assert.equal(projectState.allocatedBps, 1_000);
    assert.equal(Object.keys(contributionState.status)[0], 'settled');
    assert.equal(contributionState.allocated, true);
    assert.equal(Object.keys(taskState.status)[0], 'completed');
    assert.equal(taskState.reservedCommitted, true);
    assert.equal(projectState.founderBps + projectState.devPoolBps, BPS_TOTAL);
  });

  // B + J. Double allocation.
  it('B/J. refuses a second allocation and changes no accounting', async () => {
    const { pda: project } = await newProject();
    const alice = await fundedKeypair();
    const member = await createMember(project, alice.publicKey);
    const task = await createTask(project, 1, 1_000);
    const contribution = await toApproved(project, task, alice, 1);
    await allocateBuilder(project, task, contribution, member).rpc();

    const before = await program.account.project.fetch(project);
    await expectFailure(
      () => allocateBuilder(project, task, contribution, member).rpc(),
      'double allocation',
    );
    const after = await program.account.project.fetch(project);
    const memberState = await program.account.member.fetch(member);

    assert.equal(after.committedBps, before.committedBps);
    assert.equal(after.allocatedBps, before.allocatedBps);
    assert.equal(memberState.ownershipBps, 1_000);
  });

  // C. Retry after rejection.
  it('C. a retry after rejection never reserves twice', async () => {
    const { pda: project } = await newProject();
    const alice = await fundedKeypair();
    const member = await createMember(project, alice.publicKey);
    const task = await createTask(project, 1, 1_000);

    await claim(project, task, alice);
    const first = await submit(task, alice, 1);
    await reject(project, task, first);

    let projectState = await program.account.project.fetch(project);
    assert.equal(projectState.committedBps, 1_000, 'rejection keeps one reservation');

    const second = await toApproved(project, task, alice, 2);
    projectState = await program.account.project.fetch(project);
    assert.equal(projectState.committedBps, 1_000, 'retry must not make it 2000');

    await allocateBuilder(project, task, second, member).rpc();

    projectState = await program.account.project.fetch(project);
    const memberState = await program.account.member.fetch(member);
    assert.equal(projectState.committedBps, 0);
    assert.equal(projectState.allocatedBps, 1_000);
    assert.equal(memberState.ownershipBps, 1_000);

    // The rejected attempt keeps its own account and can never be allocated.
    const firstState = await program.account.contribution.fetch(first);
    assert.equal(Object.keys(firstState.status)[0], 'rejected');
    assert.equal(firstState.allocated, false);
  });

  // D. Member accumulation, 1000 + 500 = 1500, same Member PDA.
  it('D. accumulates ownership on the existing Member account', async () => {
    const { pda: project } = await newProject();
    const alice = await fundedKeypair();
    const member = await createMember(project, alice.publicKey);

    const taskOne = await createTask(project, 1, 1_000);
    const contributionOne = await toApproved(project, taskOne, alice, 1);
    await allocateBuilder(project, taskOne, contributionOne, member).rpc();

    const taskTwo = await createTask(project, 2, 500);
    const contributionTwo = await toApproved(project, taskTwo, alice, 1);
    await allocateBuilder(project, taskTwo, contributionTwo, member).rpc();

    const memberState = await program.account.member.fetch(member);
    const projectState = await program.account.project.fetch(project);
    assert.equal(memberState.ownershipBps, 1_500, 'ownership must accumulate, not reset');
    assert.equal(memberState.allocationCount, 2);
    assert.equal(projectState.committedBps, 0);
    assert.equal(projectState.allocatedBps, 1_500);

    // create_member is not init_if_needed: recreating must fail.
    await expectFailure(() => createMember(project, alice.publicKey), 'member reinitialisation');
    const stillThere = await program.account.member.fetch(member);
    assert.equal(stillThere.ownershipBps, 1_500);
  });

  // E. Different contributors.
  it('E. keeps two contributors separate', async () => {
    const { pda: project } = await newProject();
    const alice = await fundedKeypair();
    const bob = await fundedKeypair();
    const memberA = await createMember(project, alice.publicKey);
    const memberB = await createMember(project, bob.publicKey);

    const taskA = await createTask(project, 1, 1_000);
    const contributionA = await toApproved(project, taskA, alice, 1);
    await allocateBuilder(project, taskA, contributionA, memberA).rpc();

    const taskB = await createTask(project, 2, 500);
    const contributionB = await toApproved(project, taskB, bob, 1);
    await allocateBuilder(project, taskB, contributionB, memberB).rpc();

    assert.equal((await program.account.member.fetch(memberA)).ownershipBps, 1_000);
    assert.equal((await program.account.member.fetch(memberB)).ownershipBps, 500);
    assert.equal((await program.account.project.fetch(project)).allocatedBps, 1_500);
  });

  // F. Wrong contributor: somebody else's Member account.
  it('F. refuses a Member account that is not the contributor', async () => {
    const { pda: project } = await newProject();
    const alice = await fundedKeypair();
    const bob = await fundedKeypair();
    const memberA = await createMember(project, alice.publicKey);
    const memberB = await createMember(project, bob.publicKey);
    const task = await createTask(project, 1, 1_000);
    const contribution = await toApproved(project, task, alice, 1);

    await expectFailure(
      () => allocateBuilder(project, task, contribution, memberB).rpc(),
      'wrong member',
    );

    const projectState = await program.account.project.fetch(project);
    assert.equal(projectState.allocatedBps, 0);
    assert.equal(projectState.committedBps, 1_000);
    assert.equal((await program.account.member.fetch(memberA)).ownershipBps, 0);
    assert.equal((await program.account.member.fetch(memberB)).ownershipBps, 0);
  });

  // G. Wrong founder.
  it('G. refuses allocation signed by someone who is not the founder', async () => {
    const { pda: project } = await newProject();
    const alice = await fundedKeypair();
    const impostor = await fundedKeypair();
    const member = await createMember(project, alice.publicKey);
    const task = await createTask(project, 1, 1_000);
    const contribution = await toApproved(project, task, alice, 1);

    await expectFailure(
      () => allocateBuilder(project, task, contribution, member, impostor).rpc(),
      'wrong founder',
    );
    assert.equal((await program.account.project.fetch(project)).allocatedBps, 0);
  });

  // H. Wrong attempt: the stale attempt-1 contribution after a retry.
  it('H. refuses a contribution whose attempt does not match the task', async () => {
    const { pda: project } = await newProject();
    const alice = await fundedKeypair();
    const member = await createMember(project, alice.publicKey);
    const task = await createTask(project, 1, 1_000);

    await claim(project, task, alice);
    const stale = await submit(task, alice, 1);
    await reject(project, task, stale);
    await claim(project, task, alice); // task.attempt is now 2

    await expectFailure(
      () => allocateBuilder(project, task, stale, member).rpc(),
      'stale attempt',
    );
    assert.equal((await program.account.project.fetch(project)).allocatedBps, 0);
    assert.equal((await program.account.member.fetch(member)).ownershipBps, 0);
  });

  // I. Unapproved contribution.
  it('I. refuses allocation before approval', async () => {
    const { pda: project } = await newProject();
    const alice = await fundedKeypair();
    const member = await createMember(project, alice.publicKey);
    const task = await createTask(project, 1, 1_000);

    await claim(project, task, alice);
    const contribution = await submit(task, alice, 1);

    await expectFailure(
      () => allocateBuilder(project, task, contribution, member).rpc(),
      'unapproved contribution',
    );

    const projectState = await program.account.project.fetch(project);
    assert.equal(projectState.allocatedBps, 0);
    assert.equal(projectState.committedBps, 1_000);
    assert.equal((await program.account.member.fetch(member)).ownershipBps, 0);
    const contributionState = await program.account.contribution.fetch(contribution);
    assert.equal(Object.keys(contributionState.status)[0], 'submitted');
    assert.equal(contributionState.allocated, false);
  });

  // K. Insufficient committed.
  //
  // NOTE: this state is UNREACHABLE through the instruction set - a task can
  // only reach an approved contribution by being claimed, and claiming is what
  // reserves the reward. The guard (`checked_sub` -> ArithmeticUnderflow) is
  // therefore covered by the pure Rust unit test
  // `allocation::tests::k_insufficient_committed_underflows_safely`, which can
  // construct the state directly. The closest reachable integration check is a
  // task with no reservation at all, below.
  it('K. refuses allocation for a task that never reserved (unreserved guard)', async () => {
    const { pda: project } = await newProject();
    const alice = await fundedKeypair();
    const member = await createMember(project, alice.publicKey);
    const task = await createTask(project, 1, 1_000);

    const taskState = await program.account.task.fetch(task);
    assert.equal(taskState.reservedCommitted, false, 'creation must not reserve on chain');
    assert.equal((await program.account.project.fetch(project)).committedBps, 0);

    // No claim, so there is no contribution to allocate: the instruction cannot
    // even be assembled with a valid contribution account.
    const phantom = contributionPda(task, alice.publicKey, 1);
    await expectFailure(
      () => allocateBuilder(project, task, phantom, member).rpc(),
      'unreserved task',
    );
    assert.equal((await program.account.project.fetch(project)).allocatedBps, 0);
  });

  // L. Pool invariant across a series.
  it('L. keeps committed + allocated <= dev_pool across a series', async () => {
    const { pda: project } = await newProject();
    const alice = await fundedKeypair();
    const member = await createMember(project, alice.publicKey);
    const rewards = [1_000, 800, 500, 300];

    const tasks: any[] = [];
    for (let i = 0; i < rewards.length; i += 1) {
      tasks.push(await createTask(project, i + 1, rewards[i]));
    }

    let allocated = 0;
    for (let i = 0; i < tasks.length; i += 1) {
      const contribution = await toApproved(project, tasks[i], alice, 1);
      await allocateBuilder(project, tasks[i], contribution, member).rpc();
      allocated += rewards[i];

      const state = await program.account.project.fetch(project);
      assert.equal(state.allocatedBps, allocated);
      assert.ok(state.committedBps + state.allocatedBps <= DEV_POOL_BPS);
    }

    const end = await program.account.project.fetch(project);
    assert.equal(end.committedBps, 0);
    assert.equal(end.allocatedBps, 2_600);
    assert.equal(DEV_POOL_BPS - end.committedBps - end.allocatedBps, 3_400);
    assert.equal((await program.account.member.fetch(member)).ownershipBps, 2_600);
  });
});
