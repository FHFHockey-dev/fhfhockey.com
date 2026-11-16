# Independent BLSH capture correction review

Successor verdict: **both original P1 findings closed; no remaining findings established in the bounded follow-up.** This is a bounded independent review of the local correction, not permission to execute capture or accept its evidence.

## Successor follow-up

- Runner SHA256: `5ef3a631cdc4abb8a6a8f5a2f3a379c75640fa82fb7b563a0feb9444c94099eb`.
- Test SHA256: `bfb68aac3aff5d5d2882a34138d42d7602fec5d3c0051a3bbfe0a80526d95b0b`.
- Both successor pins independently confirmed. Original source pins/findings below are retained as review history.
- Finding 1 **closed**: clocks begin at function entry (`nativeProcessCaptureRunner.ts:134`), before validation and source reads; the explicit post-snapshot check at line 145 refuses spent budgets. New snapshot-read regression injects monotonic expiry and asserts zero dispatches.
- Finding 2 **closed**: publication checks the original budget after final directory sync and temporary-name unlink (lines 355–358). `completionLinked` becomes true only after this invocation's successful link; the failure path removes that marker and syncs its directory, preserving payloads. It does not remove an existing marker when link creation fails. If removal/durability is unavailable, failure evidence records `completionMarkerUncertain: true`; no success is returned.
- New tests cover snapshot-read expiry, post-link directory-sync expiry, post-link fsync failure, and marker-removal failure. The existing collision test still requires preservation of the pre-existing completion marker.
- Reused `REVIEW-REGRESSIONS-BEFORE.log`: all four new cases failed before the successor fix (83 skipped; two recorded expected-rejection assertion errors).
- Reused `FINAL-RUNNER-TESTS.log`: **116 tests passed** (87 runner, 29 actual-adapter mocked-transport tests). Scoped lint log is empty; Chef reports it passed. Typecheck completion/status remains Chef-owned; this review does not claim a typecheck exit status from a log alone.
- No follow-up probes, suites, external calls, or source edits. One review pass plus the single allowed follow-up are complete.

Synchronous OS calls remain non-preemptible. The successor refuses late dispatch/success when control returns; this review makes no claim that it can interrupt a blocked filesystem call or guarantee a hard process-return time during OS stalls. Cleanup failure can leave an uncertain marker and is explicitly reported as such.

## Scope and identity

- Canonical checkout: `/Users/tim/Code/fhfhockey.com`, `octoberBranch`; preserved the dirty checkout.
- Runner SHA256: `3d6b00ff6bcab78810b218c42f42ee7f5f8a9313d1c3638b782aa46affb864de`.
- Test SHA256: `c3e29252a3d6f08aeb09ed88b0897daf0535ab738095e4a4b059a80fa16f2d9d`.
- Pins confirmed before review and after reproduction. Reviewed diff against HEAD, runner, adjacent regression tests, actual adapter, and relevant pinned client/lifecycle paths.
- Actual model and effort metadata are not exposed to this worker; no assignment settings inferred. No delegation.

## Original findings (closed by successor above)

### P1 — Start the absolute clock before source snapshot disk work

`web/scripts/blsh/nativeProcessCaptureRunner.ts:139–140` calls `sourceSnapshot` before initializing wall/monotonic start and deadline. Its synchronous `lstatSync`/`readFileSync`/hashing work is excluded from the 120-second budget. If a source read stalls past 120 seconds, the runner creates a fresh 120-second budget afterward and can issue the first remote request after the intended absolute work deadline.

Offline reproduction injected 121,000 ms into both clocks during the runner-source read, without any actual long wait. The synthetic schedule action was invoked at **121,074.956 ms from function invocation**. It deliberately rejected to stop the probe. No completion manifest was created. The injected read returned its exact original bytes and all source pins still matched.

Initialize both clocks at function entry before validation/snapshot work and retain that same origin throughout the run. Add a regression delaying a `sourceSnapshot` read (not a later snapshot-file write) and assert zero dispatches once 120 seconds have elapsed. Existing slow-initialization tests inject during `source-ratePolicy.ts` output fsync, after clock initialization, so they cannot detect this gap.

### P1 — Reject deadline overrun during the final publication directory sync

`web/scripts/blsh/nativeProcessCaptureRunner.ts:350–354` checks the deadline before `linkSync`, then synchronously fsyncs the final manifest's directory and unlinks the temporary name without another check. If the final directory sync crosses the deadline, timers cannot execute until this stack returns; the function returns `packet_complete_pending_review` and clears the timers in `finally`. A manifest therefore remains marked complete despite final publication finishing outside the absolute work budget.

Offline reproduction injected 121,000 ms into both clocks during the output-directory fsync after `MANIFEST.json` exists. The run returned **`packet_complete_pending_review` at 143,174.103 ms from invocation**, with `MANIFEST.json` present and `operationCount: 5`. All responses were synthetic; no provider was contacted. This specifically exercises the post-link sync, whereas the current `.MANIFEST.json.tmp` regression exercises the earlier file sync.

Recheck the original budget after the final publication operations, with fail-closed handling for a completion name already linked when durability fails or the deadline expires. Add a regression for the final output-directory fsync that asserts rejection and the intended incomplete-packet marker semantics. Synchronous disk calls cannot be forcibly interrupted by JavaScript timers; the implementation must at least reject the overrun once the call returns, and any stronger hard elapsed-time guarantee needs an explicit execution-boundary design.

## Verified correction behavior and regression quality

The parent-directory fsync precedes remote dispatch, and every operation STARTED file is followed by an output-directory fsync before action execution. Lifecycle STARTED records include the job token. Dispatch rechecks both operation and run deadlines and both permit clocks after durability. NST spacing now uses monotonic dispatch timestamps and monotonic waits. The actual adapter routes schedule, admission, provider, and lifecycle operations through these dispatch hooks; client body consumption occurs inside the hook, with redacted parser text attached to its existing witness afterward.

The correction preserves the operation budgets/order, original response completion witnesses, no-follow-up guards, exact parser-input retention, and pending-review evidence labels on the inspected paths. No additional findings were established within this one-pass review. This statement is bounded to the inspected source and saved tests; it does not establish runtime TLS, real service, crash/power-loss, or evidence acceptance properties.

The new tests meaningfully exercise directory fsync ordering/failure across all eight operation kinds, permit/deadline fences, forward/backward wall adjustments, monotonic retention expiry, cleanup bounds, and timeout clamping. Missing boundary coverage is described in the two findings.

## Evidence and checks

- Reused `REGRESSIONS-BEFORE.log`: 20 new regressions fail against the prior implementation (63 skipped); its recorded expected-rejection assertion failures also produce 10 unhandled-rejection reports.
- Reused `REGRESSIONS-AFTER.log`: 83 runner tests passed.
- Reused `CORRECTION-TESTS.log`: 117 tests passed across adapter (29), comparison (22), and interpretation (66).
- Did not rerun suites, builds, lint, or type checks.
- Ran one targeted offline reproduction script, `/tmp/blsh-correction-review.cjs`, covering the two concrete gaps. It uses the real runner with a synthetic adapter, exact source pins, temporary packets under `/tmp`, blocked fetch/http/https/net/tls, and injected clocks. The 22-second synthetic pacing wait advances clocks through a scheduled callback; no real 121-second sleep occurs.
- Reproduction output: `networkAttempts: 0`, `realLedgerOperations: 0`. No credentials read, provider/database/network/ledger calls, captures, forecasts, deployments, migrations, branch/worktree/staging mutations, or source edits.

## Remaining acceptance gates

Both deadline gaps and their focused regressions are addressed in the successor. Chef must inspect the final source, finish the outstanding typecheck assessment, and review recorded evidence before accepting the local correction. Remote capture remains separately gated by the production re-normalization restriction and explicit execution authorization; this review grants none.
