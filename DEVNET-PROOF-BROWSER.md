# Devnet proof — the browser write path

Every transaction the BuildShare web client has ever signed. Each one was signed in
Phantom by a human clicking a button in the UI, not by a script and not by the CLI
keypair. All are finalised on Solana Devnet and can be verified by anyone.

Eight of the eleven program instructions appear here: `initialize_project`,
`create_task`, `claim_task`, `expire_claim`, `submit_contribution`, `create_member`,
`approve_contribution` and `allocate_ownership`. `update_task`, `cancel_task` and
`reject_contribution` have never been sent from a browser and are not claimed below.

Program: `6CeFTzDPHrZqcWJ5WLvJCTTz1c2n6vSUGRvEPGgJjw3G`
Signer: `53EeLHJLSaxwiCckBFWm7Soo79xuRRn3atVQ3SJq3EjG` (Phantom, Devnet)
Dates: 9, 10 and 17 September 2026. Sections 1-4 record the state as it stood on those
first two days; section 5 records the rest of the lifecycle on 17 September and
supersedes the task state shown in section 3.

## 1. initialize_project

| Field | Value |
| --- | --- |
| Signature | `3Y8Tv44ax1AkQzvUUcbLw2eQimhhmxMT1KqNV2maEbGXLyvhPDb11GLcRc6tsLra53KmSAZXXbjaoEvu37Vi52p8` |
| Status | Finalized |
| Project PDA | `4qdEjGgBHhXeUAbBbSZ94XLRjDsyqDd6cejkZaVo6LSN` |
| Account owner | `6CeFTzDPHrZqcWJ5WLvJCTTz1c2n6vSUGRvEPGgJjw3G` |
| Account size | 101 bytes, rent 0.00116332 SOL |

Explorer: https://explorer.solana.com/tx/3Y8Tv44ax1AkQzvUUcbLw2eQimhhmxMT1KqNV2maEbGXLyvhPDb11GLcRc6tsLra53KmSAZXXbjaoEvu37Vi52p8?cluster=devnet

Decoded Project account after both transactions:

| Field | Value |
| --- | --- |
| `project_id` | 1 |
| `founder_bps` | 4000 |
| `dev_pool_bps` | 6000 |
| `committed_bps` | 0 |
| `allocated_bps` | 0 |
| `task_count` | 1 |
| `member_count` | 0 |
| `bump` | 254 |
| `reserved` | all zero |

Invariant I1, `founder_bps + dev_pool_bps == 10000`: holds.
Invariant I2, `committed_bps + allocated_bps <= dev_pool_bps`: holds.

## 2. create_task

| Field | Value |
| --- | --- |
| Signature | `2WuPRcte3yWtQkZXZpvasoibbRhupvs8YQWNvqNrpWTCNqw4Jkjus5axPiLYdGCB1PHTTi91YU3xwZCNQQTnuCEU` |
| Status | Finalized |
| Task PDA | `BGH55HaFHGijm7PNo9PGWPCChjcMerjojzTcvxiZLkkX` |
| Program log | `Instruction: CreateTask`, 9589 compute units, success |
| Account size | 199 bytes, rent 0.00166116 SOL |

Explorer: https://explorer.solana.com/tx/2WuPRcte3yWtQkZXZpvasoibbRhupvs8YQWNvqNrpWTCNqw4Jkjus5axPiLYdGCB1PHTTi91YU3xwZCNQQTnuCEU?cluster=devnet

Decoded Task account:

| Field | Value |
| --- | --- |
| discriminator | `[79, 34, 229, 55, 88, 90, 55, 84]` |
| `task_id` | 0 |
| `status` | OPEN |
| `reward_bps` | 1800 |
| `attempt` | 0 |
| `contributor` | None (Borsh tag 0) |
| `claimed_at` | 0 |
| `claim_expires_at` | 0 |
| `acceptance_criteria_hash` | `cbc48a78401ffc5a33af65e8b15668e3274707c69e128318095a6edfe18cdff5` |
| `repo_ref_hash` | `003e3cf1499ded4349abff49752a6f4a1892bf7d493b68e9578e141a957f10b2` |
| `commitment_hash` | all zero |
| `reserved_committed` | false |

## 3. claim_task

The first claim ever signed in a browser. Task `Second browser task, real wallet claim`,
reward 500 bps, created and claimed in one session on 10 Sep 2026.

```
create_task  3K94XqD8UanPFCh2oAYggqcJaNS5Vj26Wg5kJWP3oNWTEbKCgWbScD4Y7wpV9g8iPytgXBVKFUDvatnTQ6kDKrE9
claim_task   5Qcbn8HKbTebS2sSHNtdi4DGEJ1KZqpvcx1K9MqNzKx2k6BpuJY5haNP3J2HDvYyEFn9sdeLNnVes11pHBQdE66E
Task PDA     HCzZ63bGUF583WVo1yr3pcvYL7kJGNDp831gWH7u2UYV
```

Both finalised. `create_task` consumed 9589 compute units, `claim_task` 5123. The claim
carries five accounts and no System Program, exactly as the IDL declares: a claim creates
nothing.

The Task account read back from Devnet:

```
task_id             1
status              1 CLAIMED
reward_bps          500
attempt             1
option tag          1
contributor         53EeLHJLSaxwiCckBFWm7Soo79xuRRn3atVQ3SJq3EjG
acceptance_criteria 4705c1d5376b4614eb2271ada732a30c0d138dc7d8aa9dd3460c84e52de3f63e
repo_ref            003e3cf1499ded4349abff49752a6f4a1892bf7d493b68e9578e141a957f10b2
commitment          8d324ea9be579f80219eccde750852a7bd4a36eb49cd08c5b827fb26cd50b317
reserved_committed  1
```

The commitment hash on chain is byte for byte the hash held in local state. The domain
built it, the provider only converted it. Nothing was recomputed on the way to the chain.

`attempt` moved from 0 to 1 because `claim_task` incremented it. The client never sent
that number as a value to store; it sent the attempt the hash was built for, and the
provider refused to send at all unless chain attempt + 1 matched it.

`repo_ref` equals the value from section 2, which is the same repository and branch
hashed by the same function.

Project accounting after the claim:

```
committed_bps  0 -> 500
allocated_bps  0
task_count     2
```

The reservation appears at claim time, not at creation time. Task 0 from section 2 is
still unclaimed on chain and contributes nothing to `committed_bps`. All three invariants
hold.

This run also proves the wallet fix from `bbc757f`. The task claimed yesterday carries
`FounderWallet1111111111111111111111111111` in its commitment, taken from the user record.
This one carries the connected wallet. Both records sit in the same local database, before
and after.

The contributor here is the founder: one Phantom account signs both roles because only one
wallet is funded. The chain does not forbid it, and no instruction assumes the two differ.
Genuine role separation with a second wallet is a separate step and has not been done.

## 4. Local state versus chain state

Every value the client chose was read back from the chain and compared.

| Check | Local | On chain | Match |
| --- | --- | --- | --- |
| Project PDA | `4qdEjGgB...6LSN` | account exists, owned by the program | yes |
| `onchainProjectId` | 1 | `project_id` 1 | yes |
| `onchainTaskId` | 0 | `task_id` 0 | yes |
| Reward | 1800 bps | `reward_bps` 1800 | yes |
| Acceptance criteria hash | `cbc48a78...dff5` | identical | yes |
| Repository reference hash | `hashRepoRef` output | identical | yes |
| Task count | one task created | `task_count` 1 | yes |

`task_id` is chosen by the caller and included in the Task PDA seed. The chain increments
`task_count` as the number of created tasks; it does not allocate `task_id`. The value 0
is what the STOP-8 candidate rule produces for a project with no on-chain tasks yet, and
the chain accepted it unchanged.

This run is also the first time the `None` branch of `decodeTaskAccount` executed against
real chain data. Until now that branch was only covered by synthetic fixtures.
## 5. 17 Sep 2026 — expiry, re-claim and the full ownership path

Everything in sections 1-4 describes state as it stood on 10 Sep 2026. On 17 Sep the same
task went through the rest of the lifecycle from the browser. Four transactions, all
finalised, all signed in Phantom by `53EeLHJLSaxwiCckBFWm7Soo79xuRRn3atVQ3SJq3EjG`.

| Instruction | Signature | Slot | CU | Size |
| --- | --- | --- | --- | --- |
| `expire_claim` | `4NpegSS667fMY1upkGtNKu8kJFLgFWSfk12GdK8kgKgP2sgf8A35Yyk3f7e5Z9ZcGwoshBtfsfAvjhWpiQ9tYgre` | 499,867,813 | 3,275 | 263 B |
| `claim_task` (attempt 2) | `eRtT7faycVymsgdkT19r6cETgL8nbWWkug82RM8SiTfB1ejPbUyK1P334nf43jetbmTUgG81FSceHNti87VqnR8` | 499,893,495 | 5,089 | 328 B |
| `submit_contribution` | `3bysPZU9dnQHmqyLdF7rhH5fUh2FLH2HTMhgaLsuNptEnotXftCB2Rg6rnXGs31YCPjZ7TUnyJ1Gh31qM38E3vRf` | 499,914,029 | 12,563 | - |
| `create_member` + `approve_contribution` + `allocate_ownership` | `5CxUfKm61VdkuEVncsdEhcPtRy5CfheydA9xUbGcHKirh6r7mavcvMLP76rfAqc9QugMHU47tyV96oSggWE9z6mT` | 499,914,060 | 24,936 | 425 B |

### 5.1 Expiry is permissionless and releases nothing

The claim window of attempt 1 ran out. `expire_claim` carries two accounts and no
arguments, exactly as the IDL declares. The Task account moved `1 Claimed` to `4 Expired`,
`contributor` returned to the Borsh `None` tag, and `reserved_committed` stayed `1`: the
reservation is deliberately NOT released, so the 500 bps could not be double spent while
the task waited for a new claim. The emitted `ClaimExpired` event decoded to 73 bytes -
task, contributor, attempt 1 - under discriminator `[224,96,139,90,26,10,65,93]`.

Before this instruction was sent, the same button was pressed against a task that was
already expired. The provider read the account first, saw `EXPIRED`, refused, and no
wallet prompt appeared. A refusal is part of the proof: read-before-write is enforced in
code, not assumed.

### 5.2 A second claim carries a different commitment

The re-claim moved the Task account to `1 Claimed` with `attempt 2`. The instruction data
is the `claim_task` discriminator followed by exactly the 32 bytes of the local commitment
hash:

​
attempt 1 commitment  8d324ea9be579f80219eccde750852a7bd4a36eb49cd08c5b827fb26cd50b317
attempt 2 commitment  3546287be7ac73ec6dcd0d0b65efb03aabf883ee0c7e288e4f29411179d768aa
acceptance criteria   4705c1d5376b4614eb2271ada732a30c0d138dc7d8aa9dd3460c84e52de3f63e  (unchanged)
repo_ref              003e3cf1499ded4349abff49752a6f4a1892bf7d493b68e9578e141a957f10b2  (unchanged)
claim_expires_at      1790266182  (7.0 days after the claim)

A new attempt produces a new commitment while the acceptance criteria and the repository
reference stay byte-identical. That is the point of the design: what is promised cannot
change between attempts, but each promise is bound to its own attempt.

### 5.3 Evidence reaches the chain unchanged

`submit_contribution` created the Contribution account at
`4F3BoqnxoemxKJCS31SFQrpSFzrjwRQQGKn1vii7ycNC`, 188 bytes, rent paid by the contributor.
Its instruction data is 41 bytes: discriminator, `attempt = 2`, then the evidence hash.

​
local evidenceHash        7934e62031f4d4e82aa74c8b6df2d42c4f23213eb964496341790e92fe25f7c6
instruction argument      identical
account bytes at 98..130  identical

The same 32 bytes exist in the browser database, in the transaction and in the account.
`tests/discriminator.test.ts` reproduces these exact bytes from the encoder.

The evidence hash commits to the repository state at the moment of signing: commit
`5d16f135b3b4f7aeab416c7acf169df8af9a6450`, which was the head of pull request #1 when the
transaction was sent. Later commits on `feature/p0-hardening` move the branch and the pull
request head forward; they do not and must not change this hash. If the head SHA shown on
GitHub differs from the one inside the hash, that is the design working, not a mismatch.

### 5.4 One approval, three instructions, and the accounting closes

The approval sent a single transaction containing `create_member`, `approve_contribution`
and `allocate_ownership`. `create_member` is added only when the Member account does not
exist yet, and `approve_contribution` only when the chain says the Contribution is still
Submitted; both conditions are read from Devnet before the transaction is built.

​
Project 4qdEjGgBHhXeUAbBbSZ94XLRjDsyqDd6cejkZaVo6LSN
committed_bps    500 -> 0
allocated_bps    0   -> 500
member_count     0   -> 1
founder / pool   4000 / 6000, remaining 5500
Task HCzZ63bGUF583WVo1yr3pcvYL7kJGNDp831gWH7u2UYV
status           1 Claimed -> 5 Completed, attempt 2
Contribution 4F3Boqnx...  status byte at offset 73 = 3 Settled
Member 8UvbArxUSjk789xmuBpb84hx2iUcnQUoj6dvV5YVKL7A  500 bps, 79 bytes

The reservation became an allocation with no basis point lost and no double allocation.
The 500 bps are recorded against the contributor wallet taken from the task commitment,
not from any user record.

## 6. What this run does NOT prove

- The AI verification was produced by `DemoAIProvider` / `buildshare-ai-v1`, a
  deterministic heuristic. No model was called, no API key exists in the repository, and
  the score is derived from the input strings. The evidence hash therefore commits to a
  heuristic verdict, and it names it.
- The reviewed diff was empty. The pull request record carries `changedFiles: 0` and
  `headBranch: task/BUILD-002`, both placeholders generated by the submit form; the real
  head branch is `feature/p0-hardening`. Neither value enters the evidence hash.
- Pull request #1 is a draft and unmerged, so `5d16f135b3b4f7aeab416c7acf169df8af9a6450`
  is its head commit, not a merge commit. It is opened against the `baseline` ref because
  `main` in this repository has no common ancestor with the working branch.
- Three of the eleven instructions have still never been signed from a browser:
  `update_task`, `cancel_task` and `reject_contribution`.
- Nothing here was executed on Mainnet.
- The upgrade authority is still a local development keypair.
- There are no real users and no real contributions. One wallet acted as both founder and
  contributor, so the founder-only authority checks were never exercised against a
  different signer from the browser.
