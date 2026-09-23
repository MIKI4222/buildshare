// P1 STEP 5 - full BuildShare lifecycle on Solana Devnet.
//
// Run with:
//   ANCHOR_PROVIDER_URL=https://api.devnet.solana.com \
//   ANCHOR_WALLET=$HOME/.config/solana/id.json \
//   npx tsx scripts/devnet-lifecycle.mts
//
// The contributor is funded by a transfer from the founder wallet, not by
// requestAirdrop: the public devnet faucet is rate limited.

import * as anchor from '@anchor-lang/core';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';

/* eslint-disable @typescript-eslint/no-explicit-any */

const FOUNDER_BPS = 4_000;
const DEV_POOL_BPS = 6_000;
const REWARD_BPS = 1_000;
const TASK_ID = 1;
const ATTEMPT = 1;

function hash(label: string): number[] {
  return Array.from(createHash('sha256').update(label).digest());
}

function u64le(value: number): Buffer {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(value));
  return buf;
}

const steps: Array<{ n: number; ix: string; sig: string }> = [];

function record(n: number, ix: string, sig: string): void {
  steps.push({ n, ix, sig });
  console.log('  step ' + n + '  ' + ix + '  ->  ' + sig);
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
  console.log('founder    :', founder.publicKey.toBase58());
  console.log('project_id :', projectId);

  const projectPda = web3.PublicKey.findProgramAddressSync(
    [Buffer.from('project'), founder.publicKey.toBuffer(), u64le(projectId)],
    program.programId,
  )[0];
  const taskPda = web3.PublicKey.findProgramAddressSync(
    [Buffer.from('task'), projectPda.toBuffer(), u64le(TASK_ID)],
    program.programId,
  )[0];

  // 0. Fund a fresh contributor from the founder wallet.
  const contributor = web3.Keypair.generate();
  const fundTx = new web3.Transaction().add(
    web3.SystemProgram.transfer({
      fromPubkey: founder.publicKey,
      toPubkey: contributor.publicKey,
      lamports: 50_000_000,
    }),
  );
  const fundSig = await provider.sendAndConfirm(fundTx);
  console.log('contributor:', contributor.publicKey.toBase58());
  record(0, 'fund_contributor (system transfer)', fundSig);

  const contributionPda = web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from('contribution'),
      taskPda.toBuffer(),
      contributor.publicKey.toBuffer(),
      Buffer.from([ATTEMPT]),
    ],
    program.programId,
  )[0];
  const memberPda = web3.PublicKey.findProgramAddressSync(
    [Buffer.from('member'), projectPda.toBuffer(), contributor.publicKey.toBuffer()],
    program.programId,
  )[0];

  // 1. initialize_project
  record(1, 'initialize_project', await program.methods
    .initializeProject(new anchor.BN(projectId), FOUNDER_BPS, DEV_POOL_BPS)
    .accounts({ founder: founder.publicKey, project: projectPda })
    .rpc());

  // 2. create_task
  record(2, 'create_task', await program.methods
    .createTask(new anchor.BN(TASK_ID), REWARD_BPS, hash('criteria:devnet'), hash('repo:devnet'))
    .accounts({ founder: founder.publicKey, project: projectPda, task: taskPda })
    .rpc());

  // 3. create_member (permissionless, paid by the founder)
  record(3, 'create_member', await program.methods
    .createMember()
    .accounts({
      payer: founder.publicKey,
      project: projectPda,
      member: memberPda,
      wallet: contributor.publicKey,
    })
    .rpc());

  // 4. claim_task (contributor signs; reserves the reward exactly once)
  record(4, 'claim_task', await program.methods
    .claimTask(hash('commitment:' + taskPda.toBase58() + contributor.publicKey.toBase58()))
    .accounts({ contributor: contributor.publicKey, project: projectPda, task: taskPda })
    .signers([contributor])
    .rpc());

  // 5. submit_contribution (evidence is mandatory; no project account here)
  record(5, 'submit_contribution', await program.methods
    .submitContribution(ATTEMPT, hash('evidence:' + contributionPda.toBase58()))
    .accounts({
      contributor: contributor.publicKey,
      task: taskPda,
      contribution: contributionPda,
    })
    .signers([contributor])
    .rpc());

  // 6. approve_contribution (human decision; must not move accounting)
  record(6, 'approve_contribution', await program.methods
    .approveContribution()
    .accounts({
      founder: founder.publicKey,
      project: projectPda,
      task: taskPda,
      contribution: contributionPda,
    })
    .rpc());

  const beforeAlloc = await program.account.project.fetch(projectPda);
  console.log('before allocation: committed=' + beforeAlloc.committedBps +
    ' allocated=' + beforeAlloc.allocatedBps);

  // 7. allocate_ownership
  record(7, 'allocate_ownership', await program.methods
    .allocateOwnership()
    .accounts({
      founder: founder.publicKey,
      project: projectPda,
      task: taskPda,
      contribution: contributionPda,
      member: memberPda,
    })
    .rpc());

  // Final on-chain state.
  const project = await program.account.project.fetch(projectPda);
  const member = await program.account.member.fetch(memberPda);
  const contribution = await program.account.contribution.fetch(contributionPda);
  const task = await program.account.task.fetch(taskPda);

  const status = (a: any): string => Object.keys(a.status)[0];

  console.log();
  console.log('=== final on-chain state ===');
  console.log('project.founder_bps    :', project.founderBps);
  console.log('project.dev_pool_bps   :', project.devPoolBps);
  console.log('project.committed_bps  :', project.committedBps);
  console.log('project.allocated_bps  :', project.allocatedBps);
  console.log('member.ownership_bps   :', member.ownershipBps);
  console.log('member.allocation_count:', member.allocationCount);
  console.log('contribution.status    :', status(contribution));
  console.log('contribution.allocated :', contribution.allocated);
  console.log('task.status            :', status(task));

  const ok =
    project.committedBps === 0 &&
    project.allocatedBps === REWARD_BPS &&
    member.ownershipBps === REWARD_BPS &&
    member.allocationCount === 1 &&
    status(contribution) === 'settled' &&
    project.founderBps + project.devPoolBps === 10_000;

  const url = (s: string): string =>
    'https://explorer.solana.com/tx/' + s + '?cluster=devnet';

  let md = '# BuildShare - Devnet lifecycle proof\n\n';
  md += 'Cluster: Solana Devnet\n\n';
  md += 'Program ID: `' + program.programId.toBase58() + '`\n\n';
  md += 'Founder wallet: `' + founder.publicKey.toBase58() + '`\n\n';
  md += 'Contributor wallet: `' + contributor.publicKey.toBase58() + '`\n\n';
  md += 'project_id: `' + projectId + '`\n\n';
  md += '## Accounts\n\n';
  md += '| Account | Address |\n| --- | --- |\n';
  md += '| Project PDA | `' + projectPda.toBase58() + '` |\n';
  md += '| Task PDA | `' + taskPda.toBase58() + '` |\n';
  md += '| Contribution PDA | `' + contributionPda.toBase58() + '` |\n';
  md += '| Member PDA | `' + memberPda.toBase58() + '` |\n\n';
  md += '## Transaction signatures\n\n';
  md += '| # | Instruction | Signature |\n| --- | --- | --- |\n';
  for (const s of steps) {
    md += '| ' + s.n + ' | `' + s.ix + '` | [' + s.sig + '](' + url(s.sig) + ') |\n';
  }
  md += '\n## Final on-chain state\n\n';
  md += '| Field | Value |\n| --- | --- |\n';
  md += '| project.founder_bps | ' + project.founderBps + ' |\n';
  md += '| project.dev_pool_bps | ' + project.devPoolBps + ' |\n';
  md += '| project.committed_bps | ' + project.committedBps + ' |\n';
  md += '| project.allocated_bps | ' + project.allocatedBps + ' |\n';
  md += '| member.ownership_bps | ' + member.ownershipBps + ' |\n';
  md += '| member.allocation_count | ' + member.allocationCount + ' |\n';
  md += '| contribution.status | ' + status(contribution) + ' |\n';
  md += '| task.status | ' + status(task) + ' |\n';
  md += '\nInvariant check: ' + (ok ? 'PASS' : 'FAIL') + '\n';

  writeFileSync('DEVNET-PROOF.md', md);
  console.log();
  console.log('invariant check :', ok ? 'PASS' : 'FAIL');
  console.log('written         : DEVNET-PROOF.md');
  if (!ok) process.exitCode = 1;
}

main().catch((e) => {
  console.error('LIFECYCLE FAILED:', e);
  process.exitCode = 1;
});
