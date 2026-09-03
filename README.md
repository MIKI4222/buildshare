# BuildShare

**BuildShare turns verified GitHub contributions into transparent, programmable project ownership on Solana.**

A founder publishes a project with an ownership pool and a set of tasks, each carrying a reward denominated in
basis points of that pool. A contributor claims a task and receives an immutable on-chain commitment that freezes
the terms of the work. When the work is done, the contributor submits hashed evidence. A human founder — never an
automated reviewer — approves or rejects it. Approved work is converted into project ownership, and the allocation
is recorded on Solana.

BuildShare is not a bounty or payment platform. Nothing is paid out; ownership is allocated.

---

## Current status

This repository is at **P1: Solana on-chain MVP**. The on-chain program is compiled, deployed to Solana Devnet and
exercised end to end: one contributor ownership allocation has been settled on chain with publicly verifiable
transaction signatures. The table below is the honest state of verification as of the latest commit.

| Item | Status | Evidence |
| --- | --- | --- |
| Off-chain domain model, ownership accounting, state machines | **PASS** | `npm test` — 182 tests, 24 suites, 0 failures |
| TypeScript typecheck | **PASS** | `npx tsc --noEmit -p tsconfig.app.json` — exit 0 |
| PDA seed parity between Rust and TypeScript | **PASS** | `tests/pda.test.ts` |
| Lifecycle parity between Rust handlers and off-chain reducers | **PASS** | `tests/lifecycle-parity.test.ts` |
| Allocation accounting parity | **PASS** | `tests/allocation-accounting.test.ts` |
| Anchor program build (11 instructions) | **PASS** | `anchor build` — 0 errors, 310,832-byte program |
| Rust unit tests | **PASS** | `cargo test -p buildshare --lib` — 31 tests, 0 failures |
| Anchor integration tests | **PASS** | 29 tests, 4 suites, 0 failures, run against a validator |
| Generated IDL vs. Design Freeze v1.2 | **PASS** | 11 instructions, 4 accounts, 10 events, 24 error codes — exact match |
| Program ID | **GENERATED** | `6CeFTzDPHrZqcWJ5WLvJCTTz1c2n6vSUGRvEPGgJjw3G` |
| Devnet deployment | **DONE** | deployed in slot 492,442,102, IDL published on chain |
| Devnet lifecycle, ownership settled | **DONE** | 8 signatures in [`DEVNET-PROOF.md`](./DEVNET-PROOF.md) |
| Mainnet | **NOT DONE** | out of scope for P1 |

242 tests pass across three independent layers: 182 TypeScript domain tests, 31 Rust unit tests and 29 Anchor
integration tests executed against a validator with the program actually deployed. The integration tests run on a
local validator rather than Devnet, because each of them funds fresh participants by airdrop and the public faucet
is rate limited. The Devnet evidence is the lifecycle run recorded in [`DEVNET-PROOF.md`](./DEVNET-PROOF.md).

### Deployment

| Field | Value |
| --- | --- |
| Cluster | Solana Devnet |
| Program ID | `6CeFTzDPHrZqcWJ5WLvJCTTz1c2n6vSUGRvEPGgJjw3G` |
| Owner | `BPFLoaderUpgradeab1e11111111111111111111111` |
| ProgramData | `EgBRC3xMmQ8Wq1LbjQkXGFUuiERUJsv5ZvP7DUWeQVbs` |
| On-chain IDL | `7Ma8wFyspf3DagR1ibzjzoUPTXbJ1yiy9bgSKeZH1XhX` |
| Last deployed in slot | 492,442,102 |
| Data length | 310,832 bytes |

Explorer: <https://explorer.solana.com/address/6CeFTzDPHrZqcWJ5WLvJCTTz1c2n6vSUGRvEPGgJjw3G?cluster=devnet>

The upgrade authority is a development keypair held locally. This is a Devnet MVP, not a production deployment.

A detailed audit of the most recent change, including every check that was run and every check that was not, is in
[`BUILDShare-B1-Audit.md`](./BUILDShare-B1-Audit.md).

---

## Architecture

### On-chain program

`programs/buildshare/` is an Anchor program exposing 11 instructions:

| Instruction | Signer | Purpose |
| --- | --- | --- |
| `initialize_project` | founder | creates the project and its ownership split |
| `create_member` | permissionless | registers a member account |
| `create_task` | founder | opens a task and reserves its reward from the pool |
| `update_task` | founder | edits a task while it is still open |
| `claim_task` | contributor | claims a task and freezes the commitment |
| `expire_claim` | permissionless | releases a stale claim after the claim window |
| `cancel_task` | founder | cancels a task and releases its reservation |
| `submit_contribution` | contributor | submits hashed evidence |
| `approve_contribution` | founder | human approval gate |
| `reject_contribution` | founder | rejection with a hashed reason |
| `allocate_ownership` | founder | converts approved work into ownership |

There is deliberately no retry instruction. A retry is an off-chain state transition, never a second on-chain
allocation path.

### Accounting

Ownership is tracked in basis points, where `BPS_TOTAL = 10000`. Three invariants are asserted after every
mutation:

```
allocated <= dev_pool
committed + allocated <= dev_pool
founder_bps + dev_pool_bps == BPS_TOTAL
```

All arithmetic uses checked operations. Creating a task reserves its reward as `committed`. Allocation moves the
reward from `committed` to `allocated` exactly once and is idempotency-protected. Cancellation is the only path
that releases a reservation. Approval alone never changes accounting.

### PDA derivation

| Account | Seeds |
| --- | --- |
| Project | `b"project"`, founder wallet, `project_id` as u64 little-endian |
| Task | `b"task"`, project PDA, `task_id` as u64 little-endian |
| Contribution | `b"contribution"`, task PDA, contributor wallet, `attempt` as a single u8 byte |
| Member | `b"member"`, project PDA, member wallet |

Seed encoding is verified byte-for-byte against the Rust implementation in `tests/pda.test.ts`, including
little-endian ordering and exact seed lengths.

### Off-chain layer

The frontend is React with Vite and TypeScript. Solana access is split into two providers that never fall back to
one another: a **Demo** provider, which produces no signatures and can never emit an on-chain status, and a
**Live** provider, which refuses to start without a valid Program ID and refuses to wrap any signature that does
not pass base58 validation. This separation is enforced by tests so that demo data can never be mistaken for a
real settlement.

---

## Running locally

```bash
npm install
npm test        # 182 tests, 24 suites
npm run dev     # starts the app in demo mode
npx tsc --noEmit -p tsconfig.app.json
```

The Anchor parity tests under `tests/anchor/` are **not** part of `npm test`. They require an Anchor client
package and a local validator, neither of which is installed here, so they currently do not execute.

Building the on-chain program requires the Rust toolchain, the Solana CLI and Anchor. Those steps have not been
performed in this repository yet:

```bash
# not yet run
anchor keys sync
anchor build
anchor deploy --provider.cluster devnet
```

---

## Agentic development

BuildShare is built with an agent-driven workflow. Design decisions are frozen in a written specification before
implementation, and every change is audited against that freeze rather than accepted on trust. Conflicts between
implementation and the freeze stop the work instead of being silently resolved.

`codex-session.jsonl` in the repository root is an exported AI coding session, included as reproducible evidence
of how the code was produced.

---

## Roadmap

P1 STEP 5 is complete. Written code became verifiable execution:

1. [x] Compile the Anchor program and run its tests.
2. [x] Generate a Program ID and deploy to Solana Devnet.
3. [x] Execute the full lifecycle on Devnet: project, task, claim, evidence, approval, ownership allocation.
4. [x] Publish transaction signatures that anyone can verify in Solana Explorer.

Next, and these are **targets, not achievements**:

1. Point the web client at the deployed program and drive the same lifecycle from the UI.
2. Exercise the remaining branches on Devnet: claim expiry, task cancellation, rejection and retry.
3. Run the lifecycle with several independent contributor wallets in one project.
4. Have the on-chain accounting reviewed by someone other than its author.

The project's key metric is the number of contributor ownership allocations settled on Solana Devnet with
publicly verifiable transaction signatures. That count is currently **one**. The staged targets are 10 and 20.
