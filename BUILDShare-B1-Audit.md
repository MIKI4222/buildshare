# BuildShare — B1 Patch Audit Report

**Scope:** P0 patch B1 (DESIGN FREEZE v1.2 §1 B1, §9), applied to close STOP-2.
**Date of audit run:** 2026-09-02
**Environment:** Amazon Linux 2023 sandbox, node v24.14.1, npm 11.11.0. No network access. No Rust/Solana/Anchor toolchain.

> Every claim below is backed by a command that was actually executed in this environment. Checks that could not be executed are labelled **NOT RUN** with the blocking reason. Nothing in this report asserts a deployment, an on-chain transaction, or a successful Rust/Anchor compilation, because none of those were performed.

---

## 1. Files changed

Six files. The diff was produced by comparing the working tree against a pristine re-extraction of the delivered archive (`buildshare-p1-step4-d1-d2 (2).zip`), because the archive contains no `.git` directory.

| File | Change |
| --- | --- |
| `src/domain/types.ts` | `Project.onchainProjectId: number`; `Task.onchainTaskId: number \| null` |
| `src/domain/reducers.ts` | `createProject` computes a founder-scoped `onchainProjectId`; `createTask` sets `onchainTaskId: null` |
| `src/providers/solana/types.ts` | re-export of `u64le`; `deriveProjectPda` signature becomes `(onchainProjectId: number, founderWallet: string)` |
| `src/providers/solana/demo.ts` | signature aligned; demo PDA input uses `String(onchainProjectId)` |
| `src/providers/solana/live.ts` | `TextEncoder` project-id encoding removed; delegates to frozen `projectSeeds()` |
| `src/data/demo-seed.ts` | demo tasks receive fixed on-chain ids 0–3 after creation |

Verified unchanged: `Anchor.toml`, `Cargo.toml`, `package.json`, `tsconfig.app.json`, and every file under `programs/` and `tests/`.

**No Rust file was modified. No seed, layout, discriminant, error, event, accounting rule, state-machine transition, contribution transition, or retry-model rule was modified. The Design Freeze document was not modified.**

---

## 2. Exact B1 changes and why the freeze requires them

### 2.1 `src/domain/types.ts`

Added two fields:

```ts
export interface Project {
  id: string;
  onchainProjectId: number;   // NEW
  ...
}

export interface Task {
  id: string;
  projectId: string;
  onchainTaskId: number | null;  // NEW
  ...
}
```

**Required by:** Freeze §1 B1 — "`Project.onchainProjectId: number` and `Task.onchainTaskId: number | null` added to P0; all integer seeds are 8-byte little-endian on both sides."

**Why semantics are unaffected:** both additions are new fields. No existing field was renamed, retyped, or removed. No accounting field (`committedBps`, `allocatedBps`, `devPoolBps`, `founderBps`, `rewardBps`) was touched.

### 2.2 `src/domain/reducers.ts`

```ts
const onchainProjectId =
  db.projects.filter((p) => p.founderWallet === input.founderWallet).length + 1;
```
and `onchainTaskId: null` in the `createTask` task literal.

**Required by:** Freeze §9 — "`createProject` assigns `onchainProjectId`; `createTask` sets `onchainTaskId: null`."

**Choice of allocator:** a deterministic founder-scoped counter. Freeze §9 offers `Date.now()` or "a founder-scoped counter" as alternatives; the counter was selected on explicit instruction so that PDAs are reproducible across runs. `Date.now()` is **not** used for on-chain ids.

**Why semantics are unaffected:** the counter is computed from existing state and written to a new field only. `assertValidSplit`, `assertPoolInvariants`, the audit-trail append, and the member creation path are unchanged. The 13 other `Project`/`Task` construction sites in this file are spread updates (`{ ...task, ... }`) and therefore propagate the new fields without modification.

### 2.3 `src/providers/solana/types.ts`

```ts
export { u64le } from '../../lib/solana/pda';
...
deriveProjectPda(onchainProjectId: number, founderWallet: string): Promise<string>;
```

**Required by:** Freeze §9 — "export `u64le(value: number): Uint8Array`" and the new `deriveProjectPda` signature.

**Implementation note:** this is a **re-export**, not a second implementation. `src/lib/solana/pda.ts` remains the single source of truth for seed bytes, so the encoding cannot drift between two copies.

### 2.4 `src/providers/solana/demo.ts`

Signature aligned to the interface; the demo hash input became `String(onchainProjectId)`.

**Why semantics are unaffected:** the demo provider still returns `{ kind: 'demo', pda, network }` with the `DEMO:` prefix, still performs no network call, and still cannot carry a signature or explorer URL. Only the string fed into the demo hash changed.

### 2.5 `src/providers/solana/live.ts` — the STOP-2 fix

Before:
```ts
[encoder.encode('project'), founder.toBuffer(), encoder.encode(projectId)]
```
After:
```ts
projectSeeds(founder.toBuffer(), onchainProjectId)
```

**Required by:** Freeze §0.2 and §8 — the Project seed tuple is `b"project"`, `founder`, `project_id.to_le_bytes()` = 7 + 32 + 8 = **47 bytes**. The previous code encoded the project id as UTF-8 text of a variable-length string, which produces a different PDA than the on-chain program and would have made every Live-mode transaction address the wrong account. This was blocker B1 in the Foundation Audit.

**Why semantics are unaffected:** `allocateOwnership` still throws `NOT_IMPLEMENTED`, `assertProgramId` still rejects a missing or System-Program id, `isRealSignature` still refuses fake signatures, and there is still no demo fallback.

### 2.6 `src/data/demo-seed.ts`

After the task-creation loop, the i-th task of the project receives `onchainTaskId = i`, giving 0, 1, 2, 3.

**Required by:** Freeze §9 — "fixed demo ids (`onchainProjectId: 1`, tasks 0–3) so PDA tests are deterministic."

**Why semantics are unaffected:** the seed is still produced by running the real reducers. No status, reward, claim, submission, verification, or accounting value in the seed was altered. The demo project receives `onchainProjectId = 1` from the founder-scoped counter without any special-casing, because it is the first project of that founder.

---

## 3. Test results

### 3.1 `npm test` — **PASS**

```
NPM_TEST_EXIT:0
tests 182 | suites 24 | pass 182 | fail 0 | cancelled 0 | skipped 0 | todo 0
```

Identical to the pre-B1 baseline of 182 passed / 0 failed. No test file was modified.

### 3.2 Targeted suites — **PASS**

| Suite | Result |
| --- | --- |
| `tests/pda.test.ts` | 10 tests / 10 pass / 0 fail |
| `tests/lifecycle-parity.test.ts` | 12 tests / 12 pass / 0 fail |
| `tests/demo-seed.test.ts` | 10 tests / 10 pass / 0 fail |
| `tests/providers.test.ts` | 34 tests / 5 suites / 34 pass / 0 fail |

### 3.3 `tests/anchor/*.test.ts` — **FAIL, pre-existing, environment-caused**

```
tests 29 | suites 4 | pass 0 | fail 14
Error: No Anchor client package found. Install one of: @anchor-lang/core, @coral-xyz/anchor
```

Two facts establish that B1 did not cause this:

1. The identical run against the untouched archive baseline produces the identical result (29 tests, 0 pass, 14 fail, same error).
2. These files are **not** part of the `npm test` glob. `package.json` runs `node --import tsx --test tests/*.test.ts`, which does not match `tests/anchor/`. They are run by `Anchor.toml [scripts] test = "npx tsx --test tests/anchor/*.test.ts"`.

**Consequence that must be stated honestly:** the headline figure of 182 passing tests does **not** include the 29 Anchor parity tests. Those have never been executed successfully in any environment so far, because no Anchor client package is installed.

---

## 4. TypeScript result — **PASS (verified on the developer machine)**

```
npx tsc --noEmit -p tsconfig.app.json
TSC exit: 0
```

Environment: WSL Ubuntu on `DESKTOP-7KOHBD4`, repository `/home/dmytro/projects/buildshare`, `node_modules` present locally. Zero errors, no output.

**Scope of this verdict:** it covers the full transferred working tree — P1 STEP 2–4 plus B1 — in the real Git clone, not the analysis sandbox. In the sandbox this check was `NOT RUN` because `node_modules` was absent and `npm install` could not reach `registry.npmjs.org`; the partial signal recorded there (no error line mentioned `onchainProjectId`, `onchainTaskId`, `projectSeeds`, or `u64le`) is now superseded by the clean exit above.

**What this does not prove:** a clean TypeScript typecheck says nothing about Rust or Anchor correctness. Those remain NOT RUN — see §12.

---

## 5. PDA parity result — **PASS**

Static comparison of `src/lib/solana/pda.ts`, `src/providers/solana/live.ts`, and `programs/buildshare/src/pda.rs`:

| Property | Rust | TypeScript | Match |
| --- | --- | --- | --- |
| Project seed prefix | `SEED_PROJECT: &[u8] = b"project"`, asserted `len() == 7` | `SEED_PROJECT = 'project'` via `asciiSeed` | ✅ |
| Founder bytes | `founder.as_ref()` (32 B) | `founder.toBuffer()` (32 B) | ✅ |
| Project id encoding | `&project_id.to_le_bytes()` | `u64le(onchainProjectId)` | ✅ |
| u64 little-endian | `to_le_bytes()`; unit test asserts `1u64 -> [1,0,0,0,0,0,0,0]` | `DataView.setBigUint64(0, big, true)` | ✅ |
| Project seed tuple size | 7 + 32 + 8 = 47 | test asserts `total(projectSeeds(key(1), 1)) === 7 + 32 + 8` | ✅ |
| Task seed encoding | `[SEED_TASK, project.as_ref(), &task_id.to_le_bytes()]`, `b"task"` len 4 | `taskSeeds`, test asserts 4 + 32 + 8 | ✅ |

Runtime confirmation through the frozen helper:

```
project seed lengths = [7,32,8] total=47
project seed hex = 70726f6a656374|07..07|0100000000000000
```

`70726f6a656374` is ASCII `project`; `0100000000000000` is u64 `1` little-endian. The live provider now consumes exactly these bytes.

---

## 6. STOP-2 result — **CLOSED**

Repository-wide search for a Project PDA derivation that encodes the project id as UTF-8/string:

```
grep -rn "encode('project')" src/   ->  NONE
```

Remaining `TextEncoder` occurrences, both legitimate and unrelated to project ids:

| Location | Purpose |
| --- | --- |
| `src/domain/hash.ts:41` | encoding text for SHA-256 |
| `src/lib/solana/pda.ts:27` | `asciiSeed`, the frozen ASCII seed **prefix** |

All three `deriveProjectPda` signatures now take a numeric id:

```
src/providers/solana/demo.ts:39   (onchainProjectId: number, founderWallet: string)
src/providers/solana/live.ts:108  (onchainProjectId: number, founderWallet: string)
src/providers/solana/types.ts:49  (onchainProjectId: number, founderWallet: string)
```

No call site passes a string project id; there are currently no call sites outside these declarations.

---

## 7. D1 result — **PASS**

`src/domain/state-machine.ts`:

```ts
CLAIMED: ['SUBMITTED', 'EXPIRED', 'OPEN'],
```

`CLAIMED -> BLOCKED` is absent, therefore forbidden. This mirrors the on-chain `cancel_task` guard. Covered by passing tests `D1: a CLAIMED task cannot be cancelled, on chain or in P0` and `D1: the transition table refuses cancellation of a CLAIMED task`.

---

## 8. D2 result — **PASS**

| Transition | Table entry | Allowed |
| --- | --- | --- |
| `OPEN -> BLOCKED` | `OPEN: ['CLAIMED', 'BLOCKED']` | ✅ |
| `EXPIRED -> BLOCKED` | `EXPIRED: ['OPEN', 'BLOCKED']` | ✅ |
| `REJECTED -> BLOCKED` | `REJECTED: ['CLAIMED', 'OPEN', 'BLOCKED']` | ✅ |

This matches the frozen on-chain guard in `programs/buildshare/src/instructions/cancel_task.rs`:

```rust
TaskStatus::Open | TaskStatus::Expired | TaskStatus::Rejected
```

**Reservation released exactly once**, on both layers:

* On chain: the release is guarded by `if task.reserved_committed`, subtracts from `project.committed_bps`, then sets `task.reserved_committed = false`, so a second cancel releases nothing.
* In P0: `cancelTask` asserts the transition to `BLOCKED`, applies `checkedSubBps(project.committedBps, task.rewardBps, 'committedBps')`, and then runs `assertPoolInvariants`.
* Covered by the passing test `cancellation releases the reservation exactly once`.

---

## 9. ID model result — **PASS (verified at runtime, not by inspection alone)**

Observed output of a probe script executing the real demo seed and the real reducers:

```
projects:
  id=prj_demo_0001 onchainProjectId=1 typeof=number
tasks (db order):
  BUILD-001 onchainTaskId=0 typeof=number status=PENDING_APPROVAL
  BUILD-002 onchainTaskId=1 typeof=number status=CLAIMED
  BUILD-003 onchainTaskId=2 typeof=number status=OPEN
  BUILD-004 onchainTaskId=3 typeof=number status=OPEN
demo onchainTaskIds = [0,1,2,3]
freshly created task onchainTaskId = null
2nd project, same founder, onchainProjectId = 2
repeat run, onchainProjectId = 2   (deterministic)
different founder, onchainProjectId = 1   (founder-scoped)
```

| Requirement | Result |
| --- | --- |
| Every `Project` has `onchainProjectId` | ✅ one literal assigns it; 4 other sites are spreads |
| Every `Task` has `onchainTaskId` | ✅ one literal assigns it; 9 other sites are spreads |
| `createTask` initially uses `null` | ✅ observed `null` |
| Demo tasks become 0,1,2,3 | ✅ observed `[0,1,2,3]` |
| No `Date.now()` for on-chain ids | ✅ none |
| No random value for on-chain ids | ✅ none |

`Date.now()`/`Math.random()` do still appear at `src/domain/reducers.ts:68` inside `defaultDeps.newId`, which mints opaque **string** entity ids (`prj_…`, `tsk_…`), and in the demo GitHub/AI providers. Neither feeds an on-chain id or a PDA seed.

---

## 10. Program ID status — **NOT GENERATED**

| Location | Value |
| --- | --- |
| `Anchor.toml` `[programs.devnet]` | `buildshare = "BUILD_SHARE_PROGRAM_ID"` (placeholder, not valid base58) |
| `programs/buildshare/src/lib.rs` | `declare_id!("BUILDSHARE1111111111111111111111111111111111")` (placeholder) |
| `.env.example` | `VITE_PROGRAM_ID=` (empty) |
| `.env` | does not exist |

`anchor keys sync` was **not** run. No Program ID was generated. Live mode therefore remains correctly unavailable: `readLiveConfig()` rejects the empty/invalid id and `LiveSolanaProvider` refuses to construct.

---

## 11. Deployment status — **NOT PERFORMED**

No `anchor deploy`, no `solana program deploy`, no Devnet program, no accounts created, no transactions sent, no transaction signatures produced, no Solana Explorer links. Nothing was committed and nothing was pushed.

---

## 12. Checks still NOT RUN, with reasons

| Check | Status | Reason |
| --- | --- | --- |
| `cargo check` | NOT RUN | `cargo: command not found` (exit 127) |
| `cargo test` | NOT RUN | `cargo: command not found` (exit 127) |
| `anchor build` | NOT RUN | `anchor: command not found` (exit 127) |
| `anchor test` | NOT RUN | `anchor: command not found` (exit 127) |
| Toolchain installation | NOT ATTEMPTED / IMPOSSIBLE | DNS resolution fails for `static.rust-lang.org`, `release.anza.xyz`, `crates.io`, `registry.npmjs.org`; `dnf` has no `rust`/`cargo` package; no proxy configured |
| `npx tsc --noEmit` clean verdict | **PASS** | run on the developer machine, exit 0 — see §4 |
| `tests/anchor/*.test.ts` | FAIL (pre-existing) | no Anchor client package installed |
| `git status` / `git diff` / `git log` / `git branch` / `git remote` | NOT RUN | the delivered archive contains no `.git` directory |
| Branch `feature/p0-hardening` | UNVERIFIED | no git metadata in the archive |
| Baseline commit `b5efb49` | UNVERIFIED | no git metadata in the archive |
| GitHub repository visibility | NOT RUN | `github.com` does not resolve in this sandbox |

---

## 13. Open items

1. **Git history is not auditable from this archive.** Steps that depend on `git status`, `git diff --stat`, `git log`, and `git remote -v` cannot be executed here. Separating pre-existing STEP 2–4 changes from B1 changes was done instead by diffing against a pristine re-extraction of the archive: the six files listed in §1 are the only differences.
2. **WARNING — `tests/anchor/*.test.ts`: 29 tests, 0 pass / 14 fail.** The cause is a missing Anchor client package (`No Anchor client package found. Install one of: @anchor-lang/core, @coral-xyz/anchor`). **This is not related to B1**: the identical run against the untouched baseline produces the identical result. **These tests are not part of `npm test`**, whose glob is `tests/*.test.ts` and does not match `tests/anchor/`; they are run only via `Anchor.toml [scripts]`. Therefore the 182-test figure excludes these 29 Anchor parity tests, and any external communication must say "182 TypeScript tests passing" rather than implying full-stack coverage.
3. **Rust and Anchor correctness remains unverified.** The on-chain program has never been compiled in any environment reported so far.
