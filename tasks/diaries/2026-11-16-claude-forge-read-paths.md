# 2026-11-16 · Claude · FORGE read paths (H3, H5, H6, L3, O1)

## Scope
Fix read-path findings H3, H5, H6, L3, O1 from `tasks/artifacts/forge-projection-audit-2026-11-16/blind/AUDIT.md`.
Lane started by the Chef (local_e8064f61). Owned files: externalInputProof.ts, releasedRunFence.ts, start-chart.ts,
forgeDailyBridge.ts, forge/players.ts, forge/goalies.ts, forge/accuracy.ts, runs/latest.ts, and their tests.

## Where
- Checkout `/Users/tim/Code/fhfhockey.com`, branch `octoberBranch`, started at `b296d52af` (HEAD moved to `114494bf7`
  via other lanes meanwhile; none touched my files).

## State
- 17:10Z: read audit sections, owned code, consumers. Leases: FORGE-RESERVE lease (10-26, session idle since 10-26) lists
  forgeDailyBridge.ts; treated as stale. SS-EXPANSION lists start-chart.ts read-only. Codex reservation on
  start-chart.ts (11-04, no active workers) judged stale.
- Producer closure INCLUDES `lib/projections/releasedRunFence.ts`: frozen, imported only, unchanged. No other owned file
  is in the closure. The closure hash moved 9944628e… → a6a3bb7a… during the day from other lanes' commits; no closure
  module differs between my working tree and HEAD.
- TJ pop-up (H6): remove cross-slate fallback from forge/players and forge/goalies. Scheduled date with no proven run:
  200, empty list, requested date, reason `no_proven_run_for_date`, message. Verified off-day: reason `no_games`. Never
  call it an off-day when schedule data is missing. Drop O1 (fallback scans removed). Report /trends empty-state copy
  needs rather than editing it.
- Done:
  - H3: `forgeRunScopedGameIds`, `selectRunsByGame`, `selectProvenRunsByGame`, `keepRowsOfServingRun` in
    externalInputProof.ts. `requireLatestExternalInputProvenRun` returns the newest proven full-slate run as `runId`
    plus `runsByGame` (newer proven selected_games reruns). players/goalies read both and keep each game's rows from its
    serving run; start-chart reads older runs only when the newest proven run is a rerun; the bridge keeps per date the
    slate run plus newer reruns and build() filters rows per date the same way.
  - H5: rosters and projection rows read with `pages()` (planningInputs), key [playerId, teamId].
  - H6: fallback removed in both routes; reasons `no_games` / `no_proven_run_for_date` / `proven_run_has_no_rows`.
  - L3: ET default dates (players, goalies, accuracy, players error path); players passes `horizonGames` and probes the
    h1 run for the blocked "missing horizon" response; runs/latest applies `excludeOffReleaseRuns`.
- Commits: `43a512348` (all findings + tests), `dcca667fb` (blocking signal for a scheduled slate with no rows;
  tighter H5 mock cap and bridge withheld-count test). Explicit pathspecs; no other lane touched these files.
- Checks (final): focused Vitest 17 files, 622 passed / 1 skipped (incl. untouched externalInputProof,
  verifiedForgeReleases, apiHelpers.runAdmission, releasedRunFence, projections/*, db pipeline route tests);
  `npm run typecheck` exit 0 at dcca667fb's tree; eslint on touched source files 0. Broad related run earlier:
  173 files, 1 load timeout in rosterScheduleOptimizer/planning.test.ts (another lane's file; 182/182 alone).
- 18:22Z Chef relay (audit L2, ships with pipeline dd1f73575): start-chart no longer bounds goalie_start_projections
  by updated_at <= target date's UTC end (rows upserted in place; the bound could only hide goalies). Commit
  `72b02e867`; test fails with the old bound, passes without; start-chart 118 passed / 1 skipped; typecheck 0.
- Closure: no owned file in the producer closure except releasedRunFence.ts (unchanged). Closure at HEAD a6a3bb7a…
  (moved by other lanes' commits).

## Next
- Chef: release. Relay item (bridge reserve pass-through for Out players) not received; FORGE_RESERVE_PASS_ENABLED untouched.

## Open for Chef
- /trends shows its own empty state for a no-run date (no copy explains why); not edited (outside my files).
- The accuracy job's `requireLatestSucceededRunId` (apiHelpers, producer side) still picks by created_at: H3 there is
  out of this lane.
- Legacy routes projections/players|goalies|teams now get the slate run as `runId` (not a newer single-game rerun); they
  do not overlay reruns.
- Third empty reason `proven_run_has_no_rows` (a proven run of the date that wrote no rows) was not named by TJ.
- forge/goalies still accepts `fallbackToLatestWithData` but ignores it (GoalieRiskCard and dataFetchers still send it).
- Consumer pages: empty payloads (runId null, data []) pass normalizeGoalieResponse and match dataFetchers' empty
  default; /forge/player/[id] shows "not found in the current FORGE opportunity set" on a no-run date.

## Gotchas
- 22:15Z–03:00Z: Chef capture window; focused Vitest only.
- `/tmp/fhfh-heavy.lock` is shared: `lockf -t 0` fails with exit 75 while another lane typechecks.
