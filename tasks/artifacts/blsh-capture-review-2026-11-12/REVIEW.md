# BLSH corrected capture review — November 12, 2026

Historical pre-correction review. The successor corrections, final pins, current sKO reconciliation and independent follow-up are in [CORRECTION-HANDOFF.md](CORRECTION-HANDOFF.md). The findings below are preserved as original evidence, not the current successor verdict.

**Verdict: review completed; not cleared for live capture.** The corrected November 9 dispatch boundary works in the inspected cases and the current 92-test suite passes. Three additional correctness gaps remain in the runner. No runtime source was changed. All execution in this review used synthetic responses and a mocked/in-memory local budget; no provider, database, production ledger, forecast, deployment or migration operation occurred.

## Recovered candidate and current status

The latest implementing-lane handoff is [REVIEW-AND-RUNTIME.md](../blsh-lane-readiness-2026-11-08/REVIEW-AND-RUNTIME.md), with its original [ADAPTER-CHECKS.json](../blsh-lane-readiness-2026-11-08/ADAPTER-CHECKS.json). It supersedes runner `c8474d7…` with:

- Runner `web/scripts/blsh/nativeProcessCaptureRunner.ts`: `f0cad82ee881c9b7c9900527910410c83311017a57479a8df76cbe50813ed8a8`.
- Runner test: `c98006c5a66b27ef705380945a683f18d72d49273216940d273297ffb6721624`.
- Adapter `web/scripts/blsh/nativeProcessCaptureAdapter.ts`: `0162fb52fe3df0b3c1b70f11b0739792a5b0f32b8dbd35b92255597a506c5368`.
- Adapter test: `1d46be8304247ebe397324323dc95d3cdf902e122ba78375918f4d269720d030`.

[SOURCE-CHECK.json](SOURCE-CHECK.json) records current local hashes at `24b1cb4d3048a3dba8234cf92c62e8f2b72f877f` on `octoberBranch`. All nine capture runtime source pins match. All 29 entries in the enclosing artifact manifest match. **13/16 combined source/test pins match**: `web/lib/skoElement/contract.ts`, `interpret.ts`, and `fixtures.ts` have changed. Those three files are outside this capture runtime import graph; the older combined UI/goalie evidence must be qualified separately against their successor pins. The inspected 16 files match their current local HEAD versions. This establishes local source state, not deployment state.

The November 9 handoff reported independent review pending. This is a separate review context from implementation and returns a blocking verdict. No additional reviewer was delegated. Runtime staffing/model settings are not exposed here; this report does not invent staffing verification or execution approval.

## Findings

### R1 — P1: Sync operation journal directory entries before dispatch

Location: `web/scripts/blsh/nativeProcessCaptureRunner.ts:145–159,205–226`.

`write()` flushes the newly created file descriptor, but `dispatch()` proceeds from writing `operation-N-STARTED.json` to transport without flushing the containing directory. The initial directory flush predates these new entries. For lifecycle begin, the operation file is also the only retained copy of the new job token before the remote mutation. File-data fsync alone does not establish crash durability of a new directory entry; interruption can leave remote occupancy without the promised durable local token/attempt record. The newly created packet directory's parent is not explicitly flushed either.

Evidence: [REPRO.json](REPRO.json), `journal_before_begin`, observes actual adapter `nst_job_begin_v1` dispatch with `startedFileFsynced: true` and `packetDirectoryFsyncedAfterStartedFile: false`. The same ordering appears at all sampled operations. This is a syscall-ordering reproduction; it does **not** claim an actual power-loss experiment or observed data loss.

Required correction: establish the private output directory durably, then fsync the packet directory after creating each STARTED record and before dispatch. Keep the corrected permit/deadline recheck **after all durability work**. A durability failure must stop the operation before any HTTP attempt.

Regression gate: trace file and directory fsync order for schedule/begin/admission/provider/finish/hold; inject a directory-fsync failure at each pre-dispatch barrier and assert no corresponding transport dispatch. Retain the job token and prior successful pages on later failures.

### R2 — P2: Measure the 22-second provider spacing with a monotonic clock

Location: `web/scripts/blsh/nativeProcessCaptureRunner.ts:163,195,223–224,313–316`.

`lastNstStart`, the wait calculation and both spacing checks use `Date.now()` only. Advancing the wall clock after first-page retention lets the second NST call pass the runner's spacing gate immediately. The per-operation monotonic checks introduced November 9 do not cover elapsed time between operations.

Evidence: `forward_clock_spacing` uses the actual client, admission/lifecycle modules and actual `withNstRequestBudget` algorithm with an in-memory store. A +22,000 ms wall-clock fixture jump yields two mocked provider dispatches **37.346 ms apart by the monotonic clock**, while wall-clock receipts show 22,038 ms. The shared admission responses are synthetic allows. This proves the local gate fails to enforce its stated pacing; it does not establish that the production global ledger would allow these calls or that any production rate window was breached.

Required correction: retain monotonic dispatch time alongside UTC/wall time and use monotonic elapsed time for the local minimum-spacing wait and final guard. Preserve all existing shared/local controls and operation caps.

Regression gate: a forward wall-clock jump must neither dispatch the second provider early nor bypass the 22-second elapsed minimum. Cover backward adjustment without indefinite waits, preserving the whole-run deadline and one-admission-per-page limit.

### R3 — P2: Anchor the entire run's elapsed deadline before synchronous retention

Location: `web/scripts/blsh/nativeProcessCaptureRunner.ts:140–159,170–175,201–203,298–301,325–338`.

The whole-run deadline is wall-clock-only. Monotonic deadlines start anew per operation, and the stop/terminal timers are installed after initial synchronous source/metadata retention. If that retention consumes elapsed time while wall time understates it, the first HTTP action can start after the proposed 120-second work cap. Later synchronous retention/publication also checks wall time only. Event-loop timers cannot provide a final boundary while synchronous work is executing.

Evidence: `whole_run_monotonic_expiry` injects +121,000 ms into the monotonic clock while flushing the initial source snapshot, leaving the wall clock almost unchanged. The actual adapter still dispatches the mocked schedule GET at **121,055 ms** relative to the harness's monotonic start. The probe start precedes runner entry; the injected interval itself occurs after the runner's `start` assignment, so it alone exceeds the 120-second cap. This is an injected elapsed-time fixture, not a real 121-second wait.

Required correction: anchor an absolute monotonic work deadline at run start and a bounded cleanup deadline at +125 seconds when enabled. Clamp each operation to both run and operation limits, and recheck the run deadline at dispatch, retention and publication. Reject after slow startup durability work before calling the adapter.

Regression gate: initial source fsync, between-operation retention and final publication must fail closed after the elapsed work cap even when wall time advances less or rolls back; a cleanup hold must never start past the elapsed cleanup cap.

## Verification and limits

- **Passed:** `npm test -- --run scripts/blsh/nativeProcessCaptureRunner.test.ts scripts/blsh/nativeProcessCaptureAdapter.test.ts` from `web/`, Node `v22.23.4`: **63 runner + 29 adapter = 92 tests**, 8.40 seconds. [TESTS.json](TESTS.json), [TESTS.log](TESTS.log).
- **Passed at the corrected boundary:** independent actual-module probes `corrected_permit_fence` and `corrected_work_fence` both retain failure receipts and dispatch **zero NST GETs** when expiration occurs during STARTED-file durability work.
- **Reproduced gaps:** the three findings above. The review harness uses actual frozen capture/NST modules and actual budget logic with an in-memory transaction store; all HTTP is synthetic and real socket entry points are blocked. It reported **0 real network attempts and 0 real ledger operations**. Synthetic temporary packets were removed. [REPRO.cjs](REPRO.cjs), [REPRO.json](REPRO.json).
- **Inspected:** accounting/sequence, one admission per page, first-failure stopping, 5/7/8 operation bounds, no redirects/retries/fallback, bounded schedule/NST/lifecycle body handling, exact returned parser text and original completion witness, redaction guards, private/exclusive retention, incomplete/uncertain receipts and default-closed acceptance metadata.
- **Not rerun:** full TypeScript, lint, UI/browser suites or builds. No source changed and the capture source pins match the earlier verified candidate; their November 9 checks remain historical, not new passes. No TLS sockets or provider requests were opened. The saved local TLS/import probes are evidence for that historical local runtime only.
- **Documented limitation, not a new finding:** canonical shared-admission `response.json()` still has no newly imposed byte cap; the proposal explicitly states this. Accepted decoded-body caps are not wire-byte ceilings. Do not promote them to stronger guarantees.

Reproduce the bounded review harness from `web/` in a shell without real capture credentials:

```sh
NODE_PATH=. node ../tasks/artifacts/blsh-capture-review-2026-11-12/REPRO.cjs
```

## Remaining gates and owners

1. **BLSH implementation owner:** fix R1–R3 in the runner/test files, re-run focused regressions and capture suite, refresh successor source pins and obtain review. Shared NST files remain with their custodian; these runner corrections do not require taking that ownership.
2. **Coordinating Chef:** reconcile the three changed sKO pins before relying on older combined trade/goalie acceptance. Keep this capture review distinct from current application, forecast and production-serving acceptance.
3. **Execution owner + NST custodian:** identify the actual invocation, public project, existing lifecycle mode, loader/dependency/runtime pins and TLS/redaction configuration using non-secret evidence. No capture CLI exists; the old preparation executor still throws. These are execution-readiness gates, not reasons to run a live preflight during this review.
4. **TJ:** only after corrections and runtime review, separately approve one exact bounded pilot: date/URLs/project, lifecycle mode, exact candidate pins, 5/7/8 ceilings and listed local/production admission-ledger writes. Coordinate around active production re-normalization. This review grants no such authority.
5. **Date/plan guard:** the proposal fixes November 7. Plans expire after 15 minutes; current preparation rejects the fixed date at `2026-11-15T00:00:00.000Z` (`now - eventMs < 8 days`). Recheck at any future approval. If expired, submit a revised date/URL candidate; do not silently advance the date.
6. **Evidence/serving owners:** a later authorized two-page pilot supplies new unverified observations only. Complete per-player/team-game membership, original official goalie evidence, source/method qualification and actual serving remain later gates. Missing historical bytes remain confirmed non-retention. Do not re-search or reconstruct them. Baseline weight 1.0 and closed acceptance remain unchanged.

The only writes made by this task are the exact review artifacts and diary in [OWNERSHIP.json](OWNERSHIP.json). No shared ownership register, mailbox, sprint receipt, migration authority, DateRangeMatrix/style file or servedForecastLedger file was edited. No commit, push, branch/worktree change, build, deployment, provider call, production read or write was performed.
