// P1 STEP 5b - rejection, retry and cancellation on Solana Devnet.
//
//   ANCHOR_PROVIDER_URL=https://api.devnet.solana.com \
//   ANCHOR_WALLET=$HOME/.config/solana/id.json \
//   npx tsx scripts/devnet-branches.mts
//
// Proves three frozen rules on a public chain:
//   1. Rejection is terminal for the attempt but KEEPS the reservation.
//   2. Re-claiming after rejection does NOT reserve a second time.
//   3. Cancellation is the unique path that releases a reservation.

import * as anchor from '@anchor-lang/core';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';

/* eslint-disable @typescript-eslint/no-explicit-any */

const FOUNDER_BPS = 4_000;
const DEV_POOL_BPS = 6_000;
const REWARD_BPS = 1_000;

function hash(label: string): number[] {
  return Array.from(createHash('sha256').update(label).digest());
}

function u64le(value: number): Buffer {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(value));
  return buf;
}

const steps: Array<{ n: number; ix: string; sig: string }> = [];
const checks: Array<{ label: string; expected: string; actual: string; ok: boolean }> = [];
let counter = 0;

function record(ix: string, sig: string): void {
  counter += 1;
  steps.push({ n: counter, ix, sig });
  console.log('  step ' + counter + '  ' + ix + '  ->  ' + sig);
}

function check(label: string, expected: any, actual: any): void {
  const ok = String(expected) === String(actual);
  checks.push({ label, expected: String(expected), actual: String(actual), ok });
  console.log('  ' + (ok ? 'PASS' : 'FAIL') + '  ' + label +
    '  expected=' + expected + ' actual=' + actual);
}

async function main(): Promise<void> {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program: any = anchor.workspace.Buildshare ?? anchor.workspace.buildshare;
  if (!program) throw new Error('program not found in anchor.workspace');

  const web3 = anchor.web3;
  const founder = provider.wallet;
  const projectId = Math.floor(Math.random() * 2 ** 40);

  console.log('cluster    :', provider.connection.rpcEndpoint);
  console.log('program    :', program.programId.toBase58());
  console.log('project_id :', projectId);

  const pk = (seeds: any[]) =>
    web3.PublicKey.findProgramAddressSync(seeds, program.programId)[0];

  const project = pk([Buffer.from('project'), founder.publicKey.toBuffer(), u64le(projectId)]);
  const taskRetry = pk([Buffer.from('task'), project.toBuffer(), u64le(1)]);
  const taskCancel = pk([Buffer.from('task'), project.toBuffer(), u64le(2)]);

  const contributor = web3.Keypair.generate();
  record('fund_contributor (system transfer)', await provider.sendAndConfirm(
    new web3.Transaction().add(
      web3.SystemProgram.transfer({
        fromPubkey: founder.publicKey,
        toPubkey: contributor.publicKey,
        lamports: 60_000_000,
      }),
    ),
  ));
  console.log('contributor:', contributor.publicKey.toBase58());

  const member = pk([Buffer.from('member'), project.toBuffer(), contributor.publicKey.toBuffer()]);
  const contrib = (task: any, attempt: number) =>
    pk([
      Buffer.from('contribution'),
      task.toBuffer(),
      contributor.publicKey.toBuffer(),
      Buffer.from([attempt]),
    ]);

  const committed = async (): Promise<number> =>
    (await program.account.project.fetch(project)).committedBps;
  const taskStatus = async (task: any): Promise<string> =>
    Object.keys((await program.account.task.fetch(task)).status)[0];

  record('initialize_project', await program.methods
    .initializeProject(new anchor.BN(projectId), FOUNDER_BPS, DEV_POOL_BPS)
    .accounts({ founder: founder.publicKey, project })
    .rpc());

  record('create_member', await program.methods
    .createMember()
    .accounts({ payer: founder.publicKey, project, member, wallet: contributor.publicKey })
    .rpc());

  for (const [id, task] of [[1, taskRetry], [2, taskCancel]] as Array<[number, any]>) {
    record('create_task #' + id, await program.methods
      .createTask(new anchor.BN(id), REWARD_BPS, hash('criteria:' + id), hash('repo:' + id))
      .accounts({ founder: founder.publicKey, project, task })
      .rpc());
  }

  check('create_task reserves nothing', 0, await committed());

  console.log();
  console.log('--- branch A: rejection, retry, allocation ---');

  const claim = async (task: any) => program.methods
    .claimTask(hash('commitment:' + task.toBase58() + Date.now()))
    .accounts({ contributor: contributor.publicKey, project, task })
    .signers([contributor])
    .rpc();

  const submit = async (task: any, attempt: number) => program.methods
    .submitContribution(attempt, hash('evidence:' + contrib(task, attempt).toBase58()))
    .accounts({ contributor: contributor.publicKey, task, contribution: contrib(task, attempt) })
    .signers([contributor])
    .rpc();

  record('claim_task (attempt 1)', await claim(taskRetry));
  check('claim reserves exactly once', REWARD_BPS, await committed());

  record('submit_contribution (attempt 1)', await submit(taskRetry, 1));
  record('reject_contribution (attempt 1)', await program.methods
    .rejectContribution(hash('reject:not enough tests'))
    .accounts({
      founder: founder.publicKey,
      project,
      task: taskRetry,
      contribution: contrib(taskRetry, 1),
    })
    .rpc());
  check('rejection KEEPS the reservation', REWARD_BPS, await committed());
  check('rejected attempt status', 'rejected',
    Object.keys((await program.account.contribution.fetch(contrib(taskRetry, 1))).status)[0]);

  record('claim_task (attempt 2, after rejection)', await claim(taskRetry));
  check('re-claim does NOT reserve twice', REWARD_BPS, await committed());

  record('submit_contribution (attempt 2)', await submit(taskRetry, 2));
  record('approve_contribution (attempt 2)', await program.methods
    .approveContribution()
    .accounts({
      founder: founder.publicKey,
      project,
      task: taskRetry,
      contribution: contrib(taskRetry, 2),
    })
    .rpc());
  check('approval moves no accounting', REWARD_BPS, await committed());

  record('allocate_ownership (attempt 2)', await program.methods
    .allocateOwnership()
    .accounts({
      founder: founder.publicKey,
      project,
      task: taskRetry,
      contribution: contrib(taskRetry, 2),
      member,
    })
    .rpc());

  const afterAlloc = await program.account.project.fetch(project);
  const memberState = await program.account.member.fetch(member);
  check('allocation clears the reservation', 0, afterAlloc.committedBps);
  check('allocated_bps', REWARD_BPS, afterAlloc.allocatedBps);
  check('member ownership after retry', REWARD_BPS, memberState.ownershipBps);
  check('task completed', 'completed', await taskStatus(taskRetry));

  console.log();
  console.log('--- branch B: cancellation releases the reservation ---');

  record('claim_task (task 2)', await claim(taskCancel));
  check('reservation held', REWARD_BPS, await committed());

  record('submit_contribution (task 2)', await submit(taskCancel, 1));
  record('reject_contribution (task 2)', await program.methods
    .rejectContribution(hash('reject:abandoned'))
    .accounts({
      founder: founder.publicKey,
      project,
      task: taskCancel,
      contribution: contrib(taskCancel, 1),
    })
    .rpc());
  check('still reserved after rejection', REWARD_BPS, await committed());

  record('cancel_task (task 2)', await program.methods
    .cancelTask()
    .accounts({ founder: founder.publicKey, project, task: taskCancel })
    .rpc());
  check('cancellation releases the reservation', 0, await committed());
  check('task cancelled', 'cancelled', await taskStatus(taskCancel));

  const final = await program.account.project.fetch(project);
  check('founder + pool == 10000', 10_000, final.founderBps + final.devPoolBps);
  check('allocated never exceeds the pool', true, final.allocatedBps <= final.devPoolBps);

  const failed = checks.filter((c) => !c.ok);
  const url = (s: string) => 'https://explorer.solana.com/tx/' + s + '?cluster=devnet';

  let md = '# BuildShare - Devnet branch proof (rejection, retry, cancellation)\n\n';
  md += 'Cluster: Solana Devnet\n\n';
  md += 'Program ID: `' + program.programId.toBase58() + '`\n\n';
  md += 'project_id: `' + projectId + '`\n\n';
  md += 'Project PDA: `' + project.toBase58() + '`\n\n';
  md += 'Contributor: `' + contributor.publicKey.toBase58() + '`\n\n';
  md += '## Assertions verified on chain\n\n';
  md += '| Check | Expected | Actual | Result |\n| --- | --- | --- | --- |\n';
  for (const c of checks) {
    md += '| ' + c.label + ' | `' + c.expected + '` | `' + c.actual + '` | ' +
      (c.ok ? 'PASS' : 'FAIL') + ' |\n';
  }
  md += '\n## Transaction signatures\n\n';
  md += '| # | Instruction | Signature |\n| --- | --- | --- |\n';
  for (const s of steps) {
    md += '| ' + s.n + ' | `' + s.ix + '` | [' + s.sig + '](' + url(s.sig) + ') |\n';
  }
  md += '\nInstructions still unproven on Devnet: `expire_claim` requires the ';
  md += 'seven-day claim window to elapse, and `update_task` is not exercised here.\n';

  writeFileSync('DEVNET-PROOF-BRANCHES.md', md);
  console.log();
  console.log('checks passed :', checks.length - failed.length, '/', checks.length);
  console.log('written       : DEVNET-PROOF-BRANCHES.md');
  if (failed.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error('BRANCH RUN FAILED:', e);
  process.exitCode = 1;
});
