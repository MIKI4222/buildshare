# BuildShare — Engineering Handoff (P1)

Written for a new engineering agent taking over mid-project. Read this file
completely before touching anything.

Repository: https://github.com/MIKI4222/buildshare
Default and working branch: `feature/p0-hardening` (this is intentional; do not
switch or rename it)
State of this document: current as of commit `835302a`.

---

## 0. Bootstrap prompt — paste this into the new chat

> I am continuing an existing Solana engineering project called BuildShare.
> The repository is https://github.com/MIKI4222/buildshare on branch
> feature/p0-hardening, checked out locally at ~/projects/buildshare inside
> WSL Ubuntu. Read HANDOFF-P1.md in the repository root first, then README.md,
> DEVNET-PROOF.md and DEVNET-PROOF-BRANCHES.md.
>
> Rules: do not redesign the architecture, do not rewrite working code, do not
> change PDA seeds, account layouts, instruction names, error codes, event
> names, the state machine or the accounting semantics. I run every command
> myself in my terminal and paste the output back — you never have shell
> access, so give me one copy-pasteable block at a time and always say whether
> it is WSL or PowerShell. Never commit, push, deploy or send a real
> transaction without my explicit GO. Never claim a test or a deployment
> passed unless you have seen the output. Always answer me in Russian.
>
> Start with: git status, git log --oneline -5, npm test, and
> npx tsc --noEmit -p tsconfig.app.json.

---

## 1. What BuildShare is

A Solana-native contribution and project-ownership protocol. A founder creates
a project and tasks that carry ownership rewards in basis points. A contributor
claims a task and receives an immutable task commitment, does the work, submits
evidence, the contribution is reviewed, a human approves it, and the approved
work is converted into project ownership recorded on Solana.

It is not a generic bounty or payment platform. Nothing here transfers tokens
to contributors; it allocates ownership.

---

## 2. Honesty ledger — the single most important section

Never claim more than this list. Every line was verified from real command
output.

| Fact | Status |
| --- | --- |
| Anchor program compiles (`anchor build`) | PASS |
| Rust unit tests (`cargo test`) | PASS, 31/31 |
| Anchor integration tests | PASS, 29/29, **on a local validator, not Devnet** |
| TypeScript tests (`npm test`) | PASS, 244/244, 35 suites |
| `npx tsc --noEmit -p tsconfig.app.json` | exit 0 |
| `npm run build` | PASS |
| Program deployed to Devnet | DONE, slot 492442102 |
| Full lifecycle executed on Devnet by script | DONE, 2 runs, 24 public signatures |
| Web client reads live on-chain state | DONE |
| Web client writes on-chain state | **PARTIAL — `initialize_project` and `create_task` have been signed in Phantom and finalised on Devnet, see DEVNET-PROOF-BROWSER.md. `allocate_ownership` is implemented and tested but has never been sent from a browser. Claiming a task exists in local state only.** |
| Mainnet | NOT DONE |
| Real users | NONE |
| `expire_claim` proven | NO — needs a 7-day claim window to elapse; will not be faked |
| `update_task` proven | Localnet only |

Total test count across three layers: 304 = 244 TypeScript + 31 Rust + 29 Anchor.

`npm test` does **not** glob `tests/anchor/`. Those run separately via
`npm run test:anchor` and need a validator.

Forbidden phrasings: "deployed to production", "used by contributors",
"transactions from the app", "Anchor tests passed" without attached output.

---

## 3. Environment

WSL Ubuntu on host DESKTOP-7KOHBD4, user `dmytro`, repo at
`/home/dmytro/projects/buildshare`. Windows profile is at `/mnt/c/Users/User/`.
`unzip` is not installed; use `python3 -m zipfile -e`.

The owner pastes commands into a terminal manually. A bare PowerShell window
opens in `C:\WINDOWS\system32`, where heredocs fail and `npx` must never be
allowed to install anything. State WSL vs PowerShell with every block.

Installed: rustc/cargo 1.98.0, rustup 1.29.0, solana-cli 3.1.10 (Agave),
solana-test-validator 3.1.10, anchor-cli 1.1.2, avm 1.1.2, node v24.20.0,
npm 11.19.0, python3 3.14.4, git 2.53.0.

**`surfpool` is NOT installed**, so plain `anchor test` cannot start. Work
around it by launching `solana-test-validator` manually from `/tmp/tv` and
running `npm run test:anchor` against `http://127.0.0.1:8899`.

Git identity is repo-local: `MIKI4222` /
`101790029+MIKI4222@users.noreply.github.com`. Keep the noreply address so the
personal e-mail never enters history.

---

## 4. Solana identifiers

| Item | Value |
| --- | --- |
| Program ID | `6CeFTzDPHrZqcWJ5WLvJCTTz1c2n6vSUGRvEPGgJjw3G` |
| ProgramData | `EgBRC3xMmQ8Wq1LbjQkXGFUuiERUJsv5ZvP7DUWeQVbs` |
| On-chain IDL account | `7Ma8wFyspf3DagR1ibzjzoUPTXbJ1yiy9bgSKeZH1XhX` |
| Founder / upgrade-authority wallet | `6gVmCQJcrHMCAiESGfYdwNCUkE4Qr92WkmygrqD256JH` |
| Keypair location | `~/.config/solana/id.json` (devnet only, never committed) |
| Balance at handoff | 0.379539186 SOL |
| Devnet RPC | https://api.devnet.solana.com |

The Program ID was generated manually because `anchor keys sync` failed with
`Invalid Base58 string`. Never regenerate it: the deployed program, the IDL
account and both proof documents all reference it.

Public RPC returns HTTP 429 under load. That is rate limiting, not a bug.

---

## 5. Design Freeze v1.2 — do not change

Frozen: PDA seeds, account layouts, instruction names, error codes, event
names, status names, accounting semantics, commitment semantics, evidence
requirements, the retry model, approval semantics, ownership allocation
semantics.

If the implementation appears to contradict the freeze: **STOP** and report the
exact conflict, the exact file, the exact frozen rule, and a minimal proposed
resolution. Do not silently fix the architecture.

### PDA seeds

```
project      ["project",      founder_wallet, project_id.to_le_bytes()]
task         ["task",         project_pda,    task_id.to_le_bytes()]
contribution ["contribution", task_pda,       contributor_wallet, attempt]
member       ["member",       project_pda,    contributor_wallet]
```

`attempt` is `u8` and therefore contributes exactly one byte. No frozen seed
tuple contains a `u16`.

### Eleven on-chain instructions

`initialize_project`, `create_member`, `create_task`, `update_task`,
`claim_task`, `expire_claim`, `cancel_task`, `submit_contribution`,
`approve_contribution`, `reject_contribution`, `allocate_ownership`.

There is no `retry_allocation` instruction and no `AllocationFailed` event.
Retry is an off-chain state transition only.

### Accounting

Basis points, `BPS_TOTAL = 10000`. Invariants: `allocated <= dev_pool`,
`committed + allocated <= dev_pool`, `founder_bps + dev_pool_bps == BPS_TOTAL`.
`checked_add` / `checked_sub` are mandatory; `assert_invariants()` runs after
every accounting mutation. Claim reserves once. Allocation moves committed to
allocated and raises member ownership by the reward. Cancellation is the only
path that releases a reservation. A rejected contribution does not release it.
Approval does not change accounting.

### Authority

Founder-only: `create_task`, `update_task`, `cancel_task`,
`approve_contribution`, `reject_contribution`, `allocate_ownership`.
Contributor signs: `claim_task`, `submit_contribution`.
Permissionless: `create_member`, `expire_claim`.
`CLAIM_WINDOW_SECS = 604800` (7 days).

### 24 error codes, 6000-6023

InvalidSplit, InvalidBps, PoolExceeded, InvalidTaskTransition,
InvalidContributionTransition, CommitmentImmutable, NotClaimable, ClaimExpired,
ClaimStillActive, NoCommitment, **DoubleAllocation (6010 = 0x176A)**,
RejectReasonRequired, NotAuthorized, InvalidProject, InvalidTask,
InvalidContribution, InvalidMember, InvalidContributor, InvalidAttempt,
AttemptOverflow, EmptyHash, ArithmeticOverflow, ArithmeticUnderflow,
InvariantViolation.

### 10 events

ProjectInitialized, TaskCreated, TaskClaimed, ClaimExpired, TaskCancelled,
ContributionSubmitted, ContributionApproved, ContributionRejected,
MemberCreated, OwnershipAllocated.

### Task state machine (`src/domain/state-machine.ts`)

```
OPEN            -> CLAIMED, BLOCKED
CLAIMED         -> SUBMITTED, EXPIRED, OPEN        (decision D1, closed)
EXPIRED         -> OPEN, BLOCKED                   (decision D2, closed)
REJECTED        -> CLAIMED, OPEN, BLOCKED          (decision D2, closed)
APPROVED        -> PENDING_ONCHAIN, DEMO_ALLOCATED
PENDING_ONCHAIN -> ONCHAIN, ONCHAIN_FAILED
ONCHAIN_FAILED  -> PENDING_ONCHAIN
BLOCKED         -> OPEN
ONCHAIN         -> (terminal)
DEMO_ALLOCATED  -> (terminal)
```

Do not reintroduce `CLAIMED -> BLOCKED`.

---

## 6. Decisions already made — treat as binding

**STOP-6.** The domain may record a confirmed on-chain fact through
`recordOnchainProject(db, projectId, { pda, onchainProjectId })` and
`recordOnchainTask(db, taskId, { onchainTaskId })`. These only record; they
never touch status, accounting or business rules, never compute the ids
themselves, always write an audit event, and refuse a silent overwrite with a
different value while treating an identical re-record as idempotent.

**STOP-7.** `onchainProjectId` comes from a deterministic founder-scoped local
counter, never `Date.now()`. Before `initialize_project` the live provider must
derive the Project PDA with the frozen helper, read it from Devnet, and if the
account exists, stop with an explanatory error: do not increment the id, do not
try another id, do not send a transaction. No silent retries. The demo provider
performs no cluster reads.

**STOP-8.** `task_id` is chosen by the client, not by the chain. The chain
increments `task_count` as a count of created tasks; it does **not** allocate
`task_id`, and `create_task` has no `require!` on it. The only reuse protection
is `init` on the PDA. Algorithm: take confirmed local `onchainTaskId` values,
candidate = max + 1, or 0 when none exist; derive the Task PDA for that
candidate; read Devnet; if occupied, **STOP** — an occupied PDA means local
state has drifted from the chain, not an invitation to invent the next id.
**Automatic id enumeration is forbidden anywhere.** After a successful
`create_task`: wait for confirmation, derive the PDA from the candidate that
was actually sent, read the Task account, verify `task.task_id === candidate`
and `task.project === expected Project PDA`, and only then call
`recordOnchainTask`.

**STOP-9.** Publishing a project on chain is a separate explicit action on the
project page, not part of the create-project form. The local project must exist
first (STOP-6), and a rejected wallet prompt must not discard typed input.
`ProjectNewPage.tsx`, `createProject` and `createTask` signatures stay
untouched.
**STOP-10.** `acceptance_criteria_hash` reuses `hashAcceptanceCriteria` from
`src/domain/commitment.ts`. `repo_ref_hash` had no client formula at all, so
`src/domain/repo-ref.ts` defines one: `sha256Text` over
`'buildshare-repo-ref-v1'`, the lowercased repository full name and the base
branch. The chain never cross-checks `repo_ref_hash`, so this is a client
convention, but it is now written down and tested rather than improvised.

**STOP-11.** The task list row carries the Create on chain button
(`src/components/OnchainTaskButton.tsx`), not a full panel per task, because a
panel would mean one RPC read per row and the public Devnet RPC already
answers 429. The whole card is wrapped in a react-router `Link`, so the button
calls `preventDefault` and `stopPropagation` before anything is signed.


---

## 7. Code map

```
programs/buildshare/src/         Anchor program (11 instructions, frozen)
target/idl/buildshare.json       generated IDL — the source of truth for
                                 discriminators, account order and writability
src/domain/                      reducers.ts, types.ts, state-machine.ts,
                                 errors.ts (19 codes), hash.ts, commitment.ts,
                                 evidence.ts, bps.ts
src/lib/solana/pda.ts            frozen seed builders, u64le, u16le, u8byte
src/lib/solana/decode.ts         base58Encode, decodeProjectAccount,
                                 projectInvariantsHold
src/lib/solana/wallet.ts         injected wallet detection, real Ed25519
                                 signature verification, fails closed
src/providers/solana/types.ts    SolanaProvider interface + input types
src/providers/solana/demo.ts     deterministic demo provider
src/providers/solana/live.ts     real Devnet provider (read + write paths)
src/store/app-context.tsx        React context, all app actions
src/components/OnchainProjectPanel.tsx  reads chain state, one Publish button
src/components/OnchainTaskButton.tsx    one Create on chain button per task row
tests/                           35 TS suites, 244 tests
tests/anchor/                    4 integration suites, 29 tests, need a validator
scripts/devnet-lifecycle.mts     end-to-end Devnet run (proof #1)
scripts/devnet-branches.mts      reject / re-claim / cancel branches (proof #2)
```

Account sizes, needed for any decoder: Project data 93 bytes, account 101.
Task data 191 bytes, account 199. Discriminator is 8 bytes.
Account discriminators: Project `[205,168,189,202,181,247,142,19]`,
Task `[79,34,229,55,88,90,55,84]`.

Verified instruction discriminators, each proven to equal
`sha256("global:<name>")[0..8]` rather than trusted from the IDL:

```
initialize_project    [69,126,215,37,20,60,73,235]
create_member         [49,46,45,241,122,143,136,73]
create_task           [194,80,6,180,232,127,48,171]
claim_task            [49,222,219,238,155,68,221,136]
submit_contribution   [123,132,230,253,141,22,214,91]
approve_contribution  [202,161,21,234,88,85,197,7]
allocate_ownership    [152,131,229,179,134,177,241,221]
```

`create_task` args: `task_id u64`, `reward_bps u16`,
`acceptance_criteria_hash [u8;32]`, `repo_ref_hash [u8;32]`.
Accounts: `founder` signer+writable, `project` writable, `task` writable,
`system_program` read-only.

---

## 8. The write-path template

Every browser write path must copy `allocateOwnership` in
`src/providers/solana/live.ts`, which is the reviewed reference:

1. refuse when `typeof window === 'undefined'`;
2. refuse when no injected wallet can `signTransaction`;
3. refuse with `NOT_AUTHORIZED` when the connected address is not the expected
   signer;
4. run any PDA-availability guard **inside** the method, before building
   anything, so no caller can skip it;
5. take account order and writability from the IDL, never from memory;
6. build instruction data with the proven discriminator and explicit little-
   endian encoders;
7. `getLatestBlockhash('confirmed')`, sign, `sendRawTransaction` with
   `skipPreflight: false`, `confirmTransaction`;
8. **read the account back and compare it with what was requested**; a mismatch
   or a missing account raises `INVARIANT_VIOLATION` and nothing is recorded
   locally. A confirmed signature proves a transaction landed, not that it
   stored what was intended;
9. only then record the fact in the domain.

The demo provider must **refuse** any operation whose result would later be
recorded as a confirmed chain fact, instead of returning a plausible fake.

---

## 9. Remaining work, in order

1. DONE in `d1b36b2`. `decodeTaskAccount` in `src/lib/solana/decode.ts` verifies
   `task.task_id` and `task.project` after `create_task`.
2. DONE in `7bcc419` (write path) and the commit that follows it (row button).
   Browser `create_task`: candidate selection, PDA guard, encoder,
   post-confirmation verification, `recordOnchainTask`.
3. Browser `claim_task`, `submit_contribution`, `approve_contribution`.
4. Extend `tests/discriminator.test.ts` to every instruction used from the
   browser.
5. **Prove the write path for real.** Run `npm run dev`, switch to Live, connect
   a fresh Phantom devnet wallet, create a project through the form so that
   `founderWallet` equals the Phantom address, fund that address from the CLI
   wallet, press Publish, and then the per-row Create on chain button on a
   task. Capture every signature and Explorer URL.
   Only then flip the README row `Web client writes on-chain state` and add
   `DEVNET-PROOF-BROWSER.md`. Do **not** import `~/.config/solana/id.json` into
   a browser wallet.
6. Update the README test counts to 244 TS / 304 total.
7. Optional: `update_task` on Devnet; several independent contributor wallets;
   an external accounting review; code-splitting the 624 kB bundle; a dedicated
   RPC endpoint; silencing the ambiguous glob re-export warning in
   `programs/buildshare/src/instructions/mod.rs`.
8. `expire_claim` cannot be proven before roughly 10 Sep 2026 because of the
   7-day claim window. It will not be faked.

---

### Blockers found during the first real browser run

1. `env()` in `src/providers/solana/live.ts` used to read `import.meta.env` through an
   alias. Vite substitutes the literal text `import.meta.env` at transform time, so the
   alias produced `undefined` in the browser, `PROGRAM_ID` resolved to an empty string,
   `liveAvailability()` reported the mode unavailable and the app silently fell back to
   demo. Under Node the `process.env` branch hid the defect, so all tests stayed green.
   Fixed in this commit. Never read `import.meta.env` through an intermediate variable.

2. Claiming a task writes `commitment.contributorWallet` from the user record, which in
   the seeded data is the demo constant `FounderWallet1111111111111111111111111111`, not
   the connected wallet. On chain `claim_task` is signed by the contributor, so the
   browser claim path must take the address from the connected wallet. This blocks the
   next write path and must be resolved before `claim_task` is wired to the UI.

3. `attempt` is owned by the chain: `create_task` leaves it at 0 and `claim_task`
   increments it, while `submit_contribution` enforces `task.attempt == attempt`. The
   client must read the value from the Task account and never compute it locally,
   because it is one byte of the Contribution PDA seed.

## 10. Working rules that were learned the hard way

- Always read the real file before patching it. Never patch from memory.
- Guard every scripted replacement with an exact match count and abort when it
  is not 1. Prefer multi-line anchors: single-line anchors have silently
  matched twice.
- Put the file write last in a patch script, so an abort leaves no partial file.
- Detect helper arity and existing names from the source instead of guessing.
- After a pipe use `${PIPESTATUS[0]}`, never `$?`.
- No template literals or backticks in generated TS/TSX from a shell heredoc.
- Read discriminators, account writability and PDA seeds from the IDL or the
  Rust source, never from memory.
- If a test contradicts the frozen design or a verified fact, fix the test, not
  the production code.
- Fix only what a compiler or a test genuinely blocks.
- Devnet only. Never mainnet. Never paste a private key or seed phrase into a
  chat. `target/`, `.anchor/`, `test-ledger/`, `*.so`, `**/*-keypair.json`,
  `id.json` and `.env` are gitignored and must stay that way.
- Forbidden without an explicit separate GO: `git reset`, `git clean`,
  `git checkout`, switching branches, any mainnet operation, commit, push,
  deploy, and any real transaction.
- `.agents/` and `skills-lock.json` are permanently untracked. Leave them alone.

---

## 11. Proof artefacts already in the repository

- `README.md` — honest status table; keep it honest.
- `DEVNET-PROOF.md` — Devnet run #1, project_id 649825720450, 8 signatures,
  final state founder 4000 / pool 6000 / committed 0 / allocated 1000 /
  member 1000.
- `DEVNET-PROOF-BRANCHES.md` — Devnet run #2, project_id 62077453940,
  16 signatures covering reject, re-claim, approve, allocate and cancel,
  16/16 branch assertions.
- `BUILDShare-B1-Audit.md` — earlier audit; carries a banner marking the stale
  parts. Read the banner before quoting it.
- `codex-session.jsonl` — agentic development session log.

Explorer patterns:
`https://explorer.solana.com/tx/<signature>?cluster=devnet`
`https://explorer.solana.com/address/<pubkey>?cluster=devnet`

---

`DEVNET-PROOF-BROWSER.md` — the first two transactions ever signed from the browser UI,
with both signatures, both account addresses, the decoded account fields and the
local-versus-chain parity checks.

## 12. Commit history of this phase

```
(this commit)  docs: prove the browser write path on Devnet             <- HEAD
3aca4a6        feat: create a task on chain from the task list button
7bcc419  feat: create a task on chain from the browser
d1b36b2  feat: decode Task accounts, and hand the project over in writing
835302a  feat: create a project on chain from the browser
9ff6b2b  feat: record confirmed on-chain ids and guard PDA collisions
ef7299b  feat: sign allocate_ownership from the browser
77ff961  npm scripts + README verification section
84ff3ff  on-chain project panel
36e2208  project account decoder and live read path
2ca03d1  staleness banner on the old audit report
78df62a  Devnet proof #2: reject / re-claim / cancel branches
edbf504  Devnet deploy + full lifecycle proof #1
8e6fb87  Anchor integration tests green on a local validator
c0588f3  anchor build fixed, cargo tests green, IDL matches the freeze
56f2431  honest README
b3d0118  P1 client-side alignment with the frozen design
b5efb49  P0 baseline
```

A dropped pre-amend commit `6a2d407` exists in reflog only; ignore it.

The former Superteam grant (200 USDG) was **cancelled**. Ignore any grant,
KPI or Crowdedness wording still present in older documents. The honesty rules
it introduced remain in force because they are correct regardless.
