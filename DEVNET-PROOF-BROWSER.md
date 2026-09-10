# Devnet proof — the browser write path

The first two transactions ever signed from the BuildShare web client. Both were signed
in Phantom by a human clicking a button in the UI, not by a script and not by the CLI
keypair. Both are finalised on Solana Devnet and can be verified by anyone.

Program: `6CeFTzDPHrZqcWJ5WLvJCTTz1c2n6vSUGRvEPGgJjw3G`
Signer: `53EeLHJLSaxwiCckBFWm7Soo79xuRRn3atVQ3SJq3EjG` (Phantom, Devnet)
Date: 9 September 2026

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

## 5. What this does NOT prove

- `allocate_ownership` is implemented, tested and reachable from the UI, but no browser
  has ever sent it.
- `submit_contribution`, `approve_contribution` and `reject_contribution` have no browser
path at all. Task 0 from section 2 remains CLAIMED in local state and OPEN on chain:
local state deliberately runs ahead of the chain for instructions the UI does not send.
- Nothing here was executed on Mainnet.
- The upgrade authority is still a local development keypair.
- There are no real users and no real contributions.
