# Recovery evidence upgrade: actual exported functions

2026-10-20, Node v22.11.0. Two deterministic offline cases passed. This closes the gap between a handwritten protocol model and the current persistence/lifecycle plumbing. It does **not** validate PostgreSQL isolation, a whole projection invocation, reader admission or a production incident.

## What ran

`recovery_actual_harness.cjs` imports the unchanged application modules directly:

- `web/lib/projections/stages/persistence-stage.ts`
- `web/lib/projections/queries/run-lifecycle-queries.ts`

A controlled CommonJS require hook injects only `lib/supabase/server`, supplying a deferred, in-memory query client. Installed ts-node transpiles the actual TypeScript exports without generating application files. The real server client is asserted never loaded. Fixed clock and explicitly released promises determine ordering, without sleeps or database calls. The required preload blocks socket/TLS/global fetch; an assertion verifies fetch is blocked.

No persistence or lifecycle implementation is copied into the harness. The stand-in does implement filtering, conflict-key matching and injected acknowledgement behavior, which limits the evidence accordingly. Source SHA-256 values are recorded before execution and asserted unchanged afterward.

Reproduce from `web/`:

```sh
set -o pipefail
/workspace/shared/fhfh-audit-runtime/node-v22.11.0-linux-x64/bin/node \
  --require=/tmp/fhfh-scan-no-network.cjs \
  /workspace/shared/fhfh-research-2026-10-20/recovery_actual_harness.cjs
```

Results: `recovery-actual-results.json` includes query order, filters, conflict keys and snapshots; `recovery-actual-results.txt` contains the execution summary. All artifacts are outside the repository. No application, Git, package, database or production changes were made.

## Case 1: rejected metadata, accepted late projection

Actual exports used: persistForgePlayerProjectionRows, claimResumableRun, clearRunGameRows, writeClaimedRun.

1. A begins an upsert for one player at 0.1; its client response/commit is deferred.
2. B uses the real claim function to take over the expired same-run lease.
3. A’s metadata write is rejected with RUN_LEASE_LOST **while B is still running**, proving the owner predicate is exercised, not only terminal status.
4. B runs real cleanup, writes 0.9 and records succeeded using the real metadata function.
5. A’s deferred upsert commits. The projection becomes 0.1; run status stays succeeded. A’s subsequent metadata CAS is rejected again.

Actual query evidence matches the model: projection upsert has conflict key `run_id,game_id,player_id,horizon_games` and no ownership/status filters (`persistence-stage.ts:3–12`). Cleanup filters only run/game (`run-lifecycle-queries.ts:381–395`). Metadata has run/status/owner predicates (`:360–377`). A failed metadata CAS does not revert a prior output mutation.

## Case 2: fresh run ID does not isolate sidecar deletion

Actual exports used: persistPerGameAnalyticsOutputs, writeClaimedRun, createRun, finalizeRun.

1. Old R1 starts its player-sidecar delete; that database-client operation is deferred.
2. R1 is marked failed through the real claimed-run writer. A distinct R2 is created through createRun.
3. R2 completes real sidecar persistence and is finalized succeeded. Its player row contains metadata.run_id=R2.
4. The old delete commits, then returns an injected lost-acknowledgment error. The real persistence function throws before its old upsert, so the experiment observes deletion without conflating a later overwrite.
5. R2 remains succeeded, but player sidecar rows drop from one to zero; its game sidecar remains present. R1’s metadata CAS rejects.

The actual old delete filters snapshot_date/game_id/model_name/model_version/prediction_scope, not run_id (`persistence-stage.ts:48–65`). Metadata.run_id on the replacement row is not part of isolation. This is an explicit injected uncertain-write boundary, not a claim that a particular production timeout committed.

## Actual versus modeled, and next bounded gap

The exported-function cases confirm the model’s crucial plumbing assumptions: shared same-run projection keys, globally scoped sidecar deletion, independent data requests, and narrower metadata CAS protection. The driver deliberately coordinates replacement calls; it does not invoke runProjectionV2ForDate or reproduce route-level scheduling. Neither “succeeded” fixture establishes that the replacement would pass actual reader admission/scorability.

Next regression checkpoint: extend the existing `run-forge-projections.resume.test.ts` pattern so the **actual runner** is invoked twice, with deferred fake stages that call real persistence exports instead of directly editing table arrays. Pause A before a persistence acknowledgement, advance the fake clock past its lease, let B finish, then release A. Assert all final rows, sidecars, status and completed IDs, not only response shape. That establishes orchestration behavior, still not SQL behavior.

Any future claim that server-side fencing fixes the race additionally needs an isolated-database test of the concrete shared serialization authority, including cleanup and sidecars. That remains separately scoped/authorized. No new migration or service is recommended merely because this harness passes; the clean-quiescent-handoff alternative remains the bounded no-new-table option described in `recovery-deep.md`.
