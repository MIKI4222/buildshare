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

This repository is at **P1: Solana on-chain MVP**. The on-chain program is written; it has not yet been compiled or
deployed. The table below is the honest state of verification as of the latest commit.

| Item | Status | Evidence |
| --- | --- | --- |
| Off-chain domain model, ownership accounting, state machines | **PASS** | `npm test` — 182 tests, 24 suites, 0 failures |
| TypeScript typecheck | **PASS** | `npx tsc --noEmit -p tsconfig.app.json` — exit 0 |
| PDA seed parity between Rust and TypeScript | **PASS** | `tests/pda.test.ts` |
| Lifecycle parity between Rust handlers and off-chain reducers | **PASS** | `tests/lifecycle-parity.test.ts` |
| Allocation accounting parity | **PASS** | `tests/allocation-accounting.test.ts` |
| Anchor program source (11 instructions) | **WRITTEN, NOT COMPILED** | `programs/buildshare/src/` |
| `cargo check` / `cargo test` | **NOT RUN** | Rust toolchain not available in the development environment |
| `anchor build` / `anchor test` | **NOT RUN** | Anchor and Solana CLI not available |
| `tests/anchor/*.test.ts` | **PRESENT, BLOCKED** | requires an Anchor client package; excluded from `npm test` |
| Program ID | **NOT GENERATED** | `Anchor.toml` and `declare_id!` hold placeholders |
| Devnet deployment | **NOT DONE** | no transaction signatures exist yet |
| Mainnet | **NOT DONE** | out of scope for P1 |

The headline figure of 182 passing tests covers TypeScript only. It does not imply that the Rust program compiles
or behaves correctly on a validator. Verifying that is the next milestone.

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

P1 STEP 5, the next milestone, is entirely about turning written code into verifiable execution. These are
**targets, not achievements**:

1. Compile the Anchor program and run its tests.
2. Generate a Program ID and deploy to Solana Devnet.
3. Execute the full lifecycle on Devnet: project, task, claim, evidence, approval, ownership allocation.
4. Publish transaction signatures that anyone can verify in Solana Explorer.

The project's key metric is the number of contributor ownership allocations settled on Solana Devnet with
publicly verifiable transaction signatures. That count is currently **zero**.
