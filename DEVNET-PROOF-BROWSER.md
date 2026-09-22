# Devnet proof — the browser write path

All 18 transactions recorded by the BuildShare web client were signed in
Phantom by a human clicking a button in the UI, not by a script and not by the CLI
keypair. All are finalised on Solana Devnet and can be verified by anyone.

All eleven program instructions now appear here: `initialize_project`,
`create_task`, `update_task`, `claim_task`, `expire_claim`, `cancel_task`,
`submit_contribution`, `create_member`, `approve_contribution`,
`reject_contribution` and `allocate_ownership`.

Program: `6CeFTzDPHrZqcWJ5WLvJCTTz1c2n6vSUGRvEPGgJjw3G`
Founder signer: `53EeLHJLSaxwiCckBFWm7Soo79xuRRn3atVQ3SJq3EjG` (Phantom, Devnet)
Contributor signer: `FJ5iHeEoiXMYshDxUsVDQW7Kv89HjSpWA2fRxsedB7Y5` (Phantom, Devnet)
Dates: 9, 10, 17, 20 and 22 September 2026. Sections 1-4 record the first
two days, section 5 records the first ownership lifecycle, sections 6-7 record
cancellation and update, section 8 records Submission Evidence v2 plus browser
rejection, and section 9 records the distinct-signer ownership lifecycle.

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

The contributor in this historical run was the founder: one Phantom account signed both
roles. The chain does not forbid that arrangement. Section 9 later proves the same lifecycle
with a distinct contributor signer address.

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

## 6. 20 Sep 2026 — founder cancellation of an OPEN task

BUILD-003 (`Cancel path browser proof`) was created locally with a 100 bps reward. The
browser then sent two Phantom-signed Devnet transactions:

| Instruction | Signature | Slot | CU | Size |
| --- | --- | --- | --- | --- |
| `create_task` | `wPm6oZTgPNTgevuXMRJUkq6nhHFkg4yXv2EkosS2vQoLxHVMpTUsDZPQpx2vgLiWWNUNnrXa9HnpDBgBJKKQeGz` | 501,266,766 | 11,389 | 403 B |
| `cancel_task` | `3BGPqdU2hCgvBM9hQtL84VKwE4bbUbJhtqB35AS8bbywN8XbHmN7VeRabPuAAqyffBy6thex8fLfhy3WXpBPW2TS` | 501,268,264 | 5,049 | 296 B |

Both finalised. `create_task` carried task id 2, reward 100 bps and discriminator
`[194,80,6,180,232,127,48,171]`. It created Task PDA
`8eM4AxHPZYCKzkteZWwzPzXzMYjkVMdabeDpvfhHRmfz`.

Before cancellation:

- Task status `0 OPEN`, attempt 0, contributor `None`;
- `reserved_committed = false`;
- Project `committed_bps = 0`, `allocated_bps = 500`, task count 3, member count 1.

The cancellation payload was exactly `[69,228,134,187,134,105,238,48]`, with no
arguments. The program log named `Instruction: CancelTask`.

After confirmation and read-back:

- Task status moved `0 OPEN -> 6 CANCELLED`;
- contributor remained `None`;
- `reserved_committed` remained false;
- Project accounting and counts were unchanged.

This proves the zero-release branch: an OPEN on-chain task owns no reservation yet.
App-context applied local cancellation only after chain verification. BUILD-003 became
`BLOCKED`, local committed ownership returned from 1900 to 1800, and audit metadata
recorded `releasedBps: 100`.

The repeated `create_task` does not increase instruction coverage. `cancel_task` is the
ninth distinct instruction proven from the browser.

## 7. 20 Sep 2026 — founder update of an OPEN task

BUILD-004 (`Update path browser proof`) was created locally with a 100 bps
reward and then created on Devnet as task id 3. The same browser session
updated it while it was still OPEN.

| Instruction | Signature | Slot | CU | Size |
| --- | --- | --- | --- | --- |
| `create_task` | `37JPct1ezKTHrtrFX3ByHmz4iG1ZJbAgiKpyHBcFiDvqQwRrnGFugeMimjQEzAh8rAv5hq5fMYhHvrxGqCouxpPL` | 501,280,012 | 12,889 | 403 B |
| `update_task` | `3zD2FDSNwreXkEWPk2bRm4AEFsuMdrTqQ7EKTRqFzRPVSsue9BdixNYy7mQAdJK4Fr4D7NaWTe9m85yu44y9Zmzi` | 501,281,921 | 3,755 | 362 B |

Both transactions were signed in Phantom by
`53EeLHJLSaxwiCckBFWm7Soo79xuRRn3atVQ3SJq3EjG` and finalised on Devnet.
`create_task` created Task PDA
`14aowUvvmVUNgbfsKzRNfrmQw3zaPkCmowrBfSzc285z` with task id 3.

Before `update_task`:

- status was `0 OPEN`;
- reward was 100 bps;
- attempt was 0 and contributor was `None`;
- `reserved_committed` was false;
- acceptance hash was
  `0358521641d39f5c816afd66e0cb41e9c7bd422a925023bc54f92340a7938419`;
- repository hash was
  `003e3cf1499ded4349abff49752a6f4a1892bf7d493b68e9578e141a957f10b2`.

The update payload was exactly 74 bytes. It began with discriminator
`[100,51,124,168,211,208,42,228]`, followed by little-endian reward
`[200,0]`, the 32-byte acceptance hash and the 32-byte repository hash.
The program log named `Instruction: UpdateTask`.

Read-back after finalisation proved:

- reward moved `100 -> 200` bps;
- acceptance hash became
  `fba1fcadd6eaf880d0e227f3b4363d44f26b773a12de99039bfe2d9d9f0a6eba`,
  exactly the client hash of the submitted Version 2 criteria;
- status remained `OPEN`;
- attempt, contributor, reservation, commitment hash and repository hash
  were unchanged;
- every other Task account byte was unchanged;
- the Project account was byte-identical before and after:
  committed 0, allocated 500, task count 4 and member count 1.

Only after this account read-back did app-context persist the local update.
BUILD-004 remained `OPEN`, moved from 100 to 200 bps and stored the exact
Version 2 criteria. Local project accounting moved committed ownership from
1900 to 2000 bps, while allocated ownership stayed 500 and remaining ownership
became 3500. Audit event `TASK_UPDATED` recorded the fields
`rewardBps,acceptanceCriteria` at `2026-09-20T07:56:23.420Z`.

The repeated `create_task` does not increase instruction coverage.
`update_task` is the tenth distinct instruction proven from the browser.

## 8. 20 Sep 2026 — Submission Evidence v2 and browser rejection

BUILD-005 (`Evidence v2 rejection browser proof`) exercised the corrected
chain-first path. The contributor created the on-chain Contribution account at
submission time with Submission Evidence v2. The founder then rejected that
same attempt from the browser with a canonical Reject Reason v1 hash.

| Instruction | Signature | Slot | CU | Size |
| --- | --- | --- | --- | --- |
| `create_task` | `LhqMXoPDVjrK1afGoZbwb656DsbgSS5EWXxmbFCtFWThUWgd2TbHB5p2bnnXCQXP8RwhoqesaNTs842GQs2DKmJ` | 501,460,759 | 12,889 | 403 B |
| `claim_task` | `4NG735wc8URVR4hiWHBsujENuU5JFsgCeXEJMyAP5PqL8VDR7HxEUoLuJ5EmE6DruHtA41PaBZ29vD1iABNMoj7y` | 501,461,749 | 5,423 | 328 B |
| `submit_contribution` | `2R6JFXpWhbW4vVH1tBWLnh6zCvGxQxJiiHairH7uwMZDhUoA4i8r73QGPm3gShjWxhSKfa31j21kDfsngXjTCHrS` | 501,464,206 | 12,563 | 395 B |
| `reject_contribution` | `4Q9Hpc74LzbLAQ643MvY7VyrM4D6BJCykMuARJ7Ux2dpQgtK99hXCCTWYKBo653y4UwGWTgtpcNGHerwZAfzrDvc` | 501,466,908 | 6,072 | 361 B |

All four transactions were signed in Phantom by
`53EeLHJLSaxwiCckBFWm7Soo79xuRRn3atVQ3SJq3EjG` and finalised on Devnet.

Derived accounts:

- Task PDA: `6SFBubjFQC5rwHYE4sXcHy5cc2NbBk2jG268CXMYG7no`;
- Contribution PDA: `3GakL89NLA1vfdYaHcoxMyDkRqnAJY7q82z22E74zyFM`;
- on-chain task id: `4`;
- attempt: `1`;
- reward: `100` bps.

Independent finalised RPC read-back after rejection proved:

- Task status `REJECTED`, contributor `None`, attempt `1`;
- Task reservation remained committed;
- Contribution status `REJECTED` and `allocated == false`;
- `approved_at == 0` and `rejected_at == 1789921597`;
- Task and Contribution commitment hashes both equal
  `574a5cbfbaace711c074a99007ebdd976b1959c442446b5ec0c6b5c54db513d8`;
- Submission Evidence v2 hash equals
  `d3b3afd654c13f8540cd552d8f11aeef58baff03fa49fc65de078919f6a0f04c`;
- Reject Reason v1 hash equals
  `f1d0055a3f57c2adb7ca2a7c2575d01a4a92a059184714f90544d90204c07281`;
- Project remained at committed `100`, allocated `500`, task count `5` and
  member count `1`.

The Live provider compared the complete Project account byte array before and
after `reject_contribution` and returned success only after proving it was
byte-identical. It also checked the exact Task and Contribution transition
before app-context persisted the local rejection.

This is the eleventh distinct instruction proven from the browser. The browser
write surface is now 11/11.

## 9. 22 Sep 2026 — distinct-signer ownership lifecycle

BUILD-006 (`Independent contributor ownership proof`) exercised the complete
ownership lifecycle with two distinct Phantom signer addresses. The founder
created the task, the contributor claimed and submitted it, and the founder
approved and allocated ownership.

| Instruction(s) | Signer | Signature | Slot | CU |
| --- | --- | --- | --- | --- |
| `create_task` | founder | `2WQ214uaAZ8Hb9EbPdN97aR8qbYzgfDFj3H9paGz8GuG642Luh1RJLYsMTmsnDj93p6phKjuMNaGYtn4ZJSCUQY1` | 502,464,093 | 9,889 |
| `claim_task` | contributor | `pCmqN6DszT7CMtppx68x1HkECrFbypZBVBWXC4DCtX5So8Nq5HBnVhpjXgEoME6qBE2WNGNoENXKCvxceh7oUXg` | 502,467,113 | 5,423 |
| `submit_contribution` | contributor | `cqBiThumYY5KUQiBwwxdDR9pFDbGSNTSACMR1Be7kGpX176j9UuGH9EDoNfnb3DLuQdwaWBnYqha2ETcgfTFi2z` | 502,470,667 | 12,563 |
| `create_member` + `approve_contribution` + `allocate_ownership` | founder | `43kkcHVHb88pW9s3M4zCzxa6Q4xgTy2ygTA1AeCUxTSnE3ENxSPNP7RTBgqtwJ8KeWi9FLqribsqRJ5q9psw4em8` | 502,475,621 | 25,157 |

Signer roles:

- founder: `53EeLHJLSaxwiCckBFWm7Soo79xuRRn3atVQ3SJq3EjG`;
- contributor: `FJ5iHeEoiXMYshDxUsVDQW7Kv89HjSpWA2fRxsedB7Y5`.

Derived accounts:

- Task PDA: `G6AChRDE3Azh7MZccNy6T8ivRFriPXJmJj6ZVeDTiX5B`;
- Contribution PDA: `7UVyLz4RuGqKuzUKSXET4cTEvvKn4U7jDuHquHXhAcLQ`;
- Member PDA: `GwfmwkzwJx6i1i7NCDrUuBHwiugGMcd1coQMEDgSJRy`;
- on-chain task id: `5`;
- attempt: `1`;
- reward: `100` bps.

Submission Evidence v2 committed to draft pull request #1 using GitHub's API
merge ref at submission time,
`0364c68bcfa7655a1c4bcbdcfc4ace58eb48f67b`. This is evidence input, not a
claim that the pull request was merged.

Finalised read-back proved:

- Task status `COMPLETED`, attempt `1`, contributor equal to the second signer;
- Contribution status `SETTLED`, `allocated == true`, and `rejected_at == 0`;
- Task and Contribution commitment hashes both equal
  `0864022196e0ede53177259cca832410596a721985c6a6fa2bf310fe7db53f63`;
- Submission Evidence v2 hash equals
  `3b61004465dc964c41e64bce93ba46bc4daeac2f148762646b6573e5abcd8be4`;
- Member wallet equals the contributor signer, with `100` bps and one allocation;
- Project accounting closed at committed `100`, allocated `600`, remaining
  `5300`, task count `6`, and member count `2`;
- founder plus development pool remained exactly `10000` bps;
- every Task, Contribution, Member and Project assertion passed.

This proves signer separation at the Solana authorization layer. Both Phantom
accounts were operated by the same human during the controlled proof, so it
does not claim participation by an independent external contributor.

## 10. What these runs do NOT prove

- The AI verification was produced by `DemoAIProvider` / `buildshare-ai-v1`, a
  deterministic heuristic. No model was called, no API key exists in the repository, and
  the score is derived from the input strings. The evidence hash therefore commits to a
  heuristic verdict, and it names it.
- The reviewed diff was empty. The pull request record carries `changedFiles: 0` and
  `headBranch: task/BUILD-002`, both placeholders generated by the submit form; the real
  head branch is `feature/p0-hardening`. Neither value enters the evidence hash.
- Pull request #1 remains draft and unmerged. Commit
  `5d16f135b3b4f7aeab416c7acf169df8af9a6450` was the head used by the earlier
  BUILD-002 evidence; later evidence records its own submission-time GitHub API
  merge ref. The PR targets `baseline` because `main` has no common ancestor with
  the working branch.
- BUILD-005 used pull request #1, which remains open and intentionally draft.
  The submitted `mergeCommitSha` was GitHub's API merge ref at submission time,
  `eec1507babf980c920ba0a9725e94c06bb793180`, not a claim that the PR was merged.
- Submission Evidence v2 proves the browser submission and rejection path. It does
  not convert the draft pull request into accepted or merged work.
- Nothing here was executed on Mainnet.
- The upgrade authority is still a local development keypair.
- There are no external users and no production contributions. BUILD-006 exercised founder
  and contributor authorization with two distinct signer addresses, but both Phantom
  accounts were controlled by the same operator during the proof.
