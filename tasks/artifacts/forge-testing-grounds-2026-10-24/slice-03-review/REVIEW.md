# CHANGES REQUIRED — frozen slice 03 local runner

One **P2 finding, S03-R1**: repeated pending-outcome checks consume the execution budget and then reclassify an unresolved evaluation unit as failed. All other inspected/tested bounded reference behaviors passed. This verdict concerns the in-memory reference slice only; it does not qualify a durable runner or the dashboard.

## S03-R1 — execution-budget stop fabricates failed evaluation coverage

`web/lib/forge-testing-grounds/memoryRunStore.ts:81`–82 unconditionally sets `failedUnit` when an execution budget is reached. Every claim increments execution count at line 87, including claims that return only `pending_outcomes`. Progress at lines 158–160 then turns that identifier into failed coverage and removes it from pending coverage.

Finite independent reproduction, using one declared evaluation unit, maxExecutionsPerUnit=2, maxFailuresPerUnit=1 and retryDelayMs=2:

1. Accept at 10000; claim and finish `{ kind: "pending_outcomes" }` at 10000.
2. Claim and finish the same pending result at 10002. Neither attempt fails or supplies an outcome/output.
3. Claim at 10004 returns null because the execution budget is exhausted.
4. Observed evaluation counts are `{ successful: 0, failed: 1, pending: 0 }`; expected `{ successful: 0, failed: 0, pending: 1 }` for the still-unavailable outcome.

The failed assertion is preserved in [boundaries.test.ts](boundaries.test.ts), final `[S03-R1]` control, and original [boundaries.log](boundaries.log). The source also computes 100% processed evaluation work from that failed-unit accounting; the run remains failed, so this is not a false successful-run claim or a fabricated metric value. It is a false failure/coverage classification of pending outcomes, contrary to PRD 7.6/8.5 and the stated pending-outcome semantics.

An adjacent independent positive control reaches the run deadline while outcomes are pending and correctly retains failed=0/pending=1. Preserve that distinction for an execution-budget stop too. A bounded operational stop may retain a clear resource-budget reason; it must not manufacture unavailable-outcome failures. Do not solve this with unlimited polling, removed execution limits or a broader runner redesign. Owner correction/new pins and focused regression review are required. No source repair or retry was performed here.

## Exact reviewed pins

Canonical `octoberBranch` HEAD `2a5092d37cb863ec92a2a4e609999cf226bfa4a5`; five new uncommitted files. All **62/62** candidate/dependency/reference/protected/artifact pins match at start and end, without drift. The additional owner EVIDENCE hash is unchanged. See [PINS.start.json](PINS.start.json) and [PINS.end.json](PINS.end.json).

| File under `web/lib/forge-testing-grounds/` | SHA-256 |
| --- | --- |
| `runnerContracts.ts` | `ef89705e25178ec2f0670d27904829c1fdfb1f45cb74521b886267c0e746e23d` |
| `runStore.ts` | `07f197bf59d44187a8d93c98488b711e0e28edd6ba7db80f12962a6c5628fa8c` |
| `memoryRunStore.ts` | `85dbf24a1110c619f58d3a7e56b99661a55b3328132607c6d7a6c15cc2d8b9c0` |
| `boundedWorker.ts` | `9395c902111a38f2eae4723cb4b9401f4fba53f989d17a041552f9dd9b4e85ac` |
| `boundedWorker.test.ts` | `960ee0ffa1457f21281179af325518f315eb56840096d9a7ae1187b456715363` |

OWNERSHIP, HANDOFF, OPERATING-PLAN, EVIDENCE and all five complete files were inspected. The approved requirements/prior review context was reused rather than commissioning another architecture study. C3 findings were completed and reported before this queued review began.

## Independent controls that passed

- Lease expiry/takeover increases the fence. Old completed, checkpoint, failed and pending results cannot alter the newer checkpoint/progress. A delayed old worker promise after takeover/new completion is stale and does not overwrite current output.
- Concurrent conflicting completions within the one instance accept one logical output, reject the conflicting payload and count it once. Identical lost acknowledgements return already_accepted without rewriting progress/revision. This also holds for an older accepted prefix after cancellation.
- Invalid/unsettled/oversized/extra-field completions produce no partial accepted progress; the valid still-current lease can subsequently accept exactly one output.
- Checkpoint contents are detached/frozen. After a later worker crashes, takeover resumes the last accepted checkpoint and rejects the crashed worker's late checkpoint.
- Cancellation during a later unit preserves accepted-prefix counts, discards the cancellation-boundary checkpoint, remains terminal on later claims and withholds results/reveal.
- Caller changes to nested settings, input references, work and limits cannot alter the accepted plan. Changed content under the same idempotency key conflicts; claimed configuration is frozen.
- Operational projection does not expose test payload/checkpoint markers. Another owner cannot read/reveal the run. Synthetic results stay sealed until completion and the frozen time; both original-snapshot and reconstructed-history fixtures remain sealed even after those conditions.
- A run deadline can stop a pending evaluation without relabeling its unavailable outcomes as failed, providing the positive comparison for S03-R1.

These finite controls do not prove distributed races, live authentication, process durability or actual scientific settlement. They do establish the listed behavior for these exact in-memory pins.

## Actual commands/results

Cwd `web/`; Node 22.11.0/npm 10.9.0. Exact argv, durations and artifact-local npm cache/log overrides: [COMMANDS.json](COMMANDS.json).

```sh
npm test -- --run --config ../tasks/artifacts/forge-testing-grounds-2026-10-24/slice-03-review/review.vitest.config.mts --maxWorkers=1 --no-file-parallelism
```

**Failed, exit 1: 25 passed / 1 failed.** Owner tests 16/16 passed; independent controls 9/10 passed. One invocation; original S03-R1 failure preserved, no weakened test or self-repair. No full-suite repetition or previous timestamp/policy test rerun.

```sh
npx --no-install tsc --noEmit --strict --skipLibCheck --target es2015 --lib dom,dom.iterable,esnext --module esnext --moduleResolution bundler --esModuleInterop lib/forge-testing-grounds/runnerContracts.ts lib/forge-testing-grounds/runStore.ts lib/forge-testing-grounds/memoryRunStore.ts lib/forge-testing-grounds/boundedWorker.ts lib/forge-testing-grounds/boundedWorker.test.ts
npx --no-install eslint --report-unused-disable-directives-severity warn lib/forge-testing-grounds/runnerContracts.ts lib/forge-testing-grounds/runStore.ts lib/forge-testing-grounds/memoryRunStore.ts lib/forge-testing-grounds/boundedWorker.ts lib/forge-testing-grounds/boundedWorker.test.ts
```

**Passed, exit 0 each**, empty [scoped-ts.log](scoped-ts.log) / [scoped-lint.log](scoped-lint.log). Explicit-file static checks only, not application-wide verification.

## Remaining limits and handoff

The operating-plan disclosures are material and accurate for the examined implementation: memory_reference loses state on process exit; methods are synchronous atomic operations only inside one instance; there is no distributed transaction, durable adapter, scheduler/listing service, restart continuity across processes, mid-step heartbeat renewal or approved hosted operating plan. Counter uniqueness and checkpoint recovery tested here do not establish browser/laptop-independent execution.

The store trusts its supplied principal, worker ID and clock. It accepts syntactically valid owner UUIDs; it does not enforce TJ-only identity or actual session/worker authorization itself. Trusted server-policy integration, CSRF, durable owner-scoped storage/RLS and artifact access remain required. `claim` intentionally exposes sealed checkpoints to an internal worker and must never become an owner monitoring/download endpoint. Sealed `progress`/`results` checks are local projection tests, not validation of every future API/log/export channel.

Executor `settled` and `synthetic` labels are trusted contract inputs, not independent finality or dataset-authenticity evidence. Real-history reveal denial is conservative, not the implemented production reveal policy. Referenced model/input/report hashes do not prove those referenced contents or metric/source/candidate/refit contracts. No actual model or pilot was run.

AbortSignal/timers cannot forcibly stop synchronous CPU or an uncooperative executor; execution must remain side-effect-free until runtime isolation/deadline feasibility is qualified. Serialized retained-byte limits omit object/peak-process overhead, and whole-store retention/pruning is incomplete. Tiny fixture timings are not a fit benchmark, capacity or dollar estimate. TJ's runner-A direction is settled; no hosting/provider choice or paid/data access follows from it.

No owner/shared source, package/config/migration, coordination/master/ledger or Git/index/ref write; no server/browser/heavy suite, database/model/provider/production request, paid call or new worker. Only reviewer artifacts and the existing diary append changed. No check blocked, denied or left running. Preserve S03-R1 and return a separately frozen owner correction for a bounded re-review; Scout retains integration/full-product acceptance authority.
