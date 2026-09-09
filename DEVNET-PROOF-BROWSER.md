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

## 3. Local state versus chain state

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

## 4. What this does NOT prove

- `allocate_ownership` is implemented, tested and reachable from the UI, but no browser
  has ever sent it.
- `claim_task`, `submit_contribution`, `approve_contribution` and `reject_contribution`
  have no browser path at all. The task in this proof is CLAIMED in local state and OPEN
  on chain; local state deliberately runs ahead of the chain for instructions the UI does
  not send yet.
- Nothing here was executed on Mainnet.
- The upgrade authority is still a local development keypair.
- There are no real users and no real contributions.
