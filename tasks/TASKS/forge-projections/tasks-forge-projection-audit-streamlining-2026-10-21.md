# Tasks: FORGE projection audit, streamlining and speed (2026-10-21)

Source: `tasks/artifacts/forge-projection-audit-2026-10-21/REPORT.md` (findings 7, 8, 12; proposals Q10–Q13, S-F, S-G) and its worker evidence `workers/w2-rolling.md` (§1–6) and `workers/w4-orchestration.md` (§2, §3d, §5 P8–P12).

Scope (TJ, 2026-10-21): the "Streamlining and speed" section — unread rolling columns (S-G), the sidecar payload (Q11), FORGE over-reading (S-F), duplicate cron work (Q12, Q13). Q10 (rolling-writer correctness) is included because it edits the same file. Q9, Q14, S-B, Q7 and Q8 belong to the audit session (`local_f4058d3f`) and are out of scope here.

## Relevant Files

- `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts` - Rolling writer: sidecar split (`isSupportPayloadScalar` :436, `splitRollingUpsertRowForDurableStorage` :462), wide upsert body, history read options (:3031-3035, :2963), `expected_sh_pct` numerator (:1362-1369).
- `web/lib/supabase/Upserts/fetchRollingPlayerAverages.test.ts` - Writer tests: sidecar keys, upsert body, season/history and xG fixtures.
- `web/lib/projections/queries/skater-queries.ts` - FORGE reader `fetchRollingRows` (:179-318) and `ROLLING_ROW_SELECT_CLAUSE` (:82-133).
- `web/lib/projections/queries/skater-queries.test.ts` - Reader tests: latest-row selection, sidecar keys, coverage proofs, PGRST202 fallback, capture/replay.
- `web/lib/projections/queryCaptureHook.ts`, `web/lib/projections/inputCapture.ts` - Browser-safe read-only reconstruction probe; the reader skips the RPC there.
- `web/scripts/run-forge-local.ts`, `web/lib/projections/run-forge-projections.local-attempt.test.ts` - Local FORGE transport allows the read-only RPC by GET; fixture answers it.
- `supabase/migrations/20261021182129_forge_latest_rolling_rows.sql` - `forge_latest_rolling_rows(bigint[], text, date, text[])`; applied 2026-10-21 as ledger order 95.
- `web/pages/api/v1/db/run-rolling-forge-pipeline.ts` - Pipeline: goalie step (:919-926), projection stage cursor, effective `stopOnFailure` (:1489-1495).
- `web/__tests__/pages/api/v1/db/run-rolling-forge-pipeline.test.ts` - Pipeline tests: goalie step once per run.
- `web/pages/api/v1/db/run-projection-v2.ts` - Route preflight skipped on a resumed claim (`hasPausedResumableRun`, `preflightSkipped: "resumed_run"`).
- `web/__tests__/pages/api/v1/db/run-projection-v2.test.ts` - Resumed-claim preflight test.
- `supabase/migrations/` - New migrations: latest-rolling-row RPC, unread-column drop.
- `tasks/TASKS/repository-audit-remediation/migration-authority.json` - Migration ledger records.
- `web/lib/supabase/supportedBaselineMigration.test.ts` - Ledger counts.
- `web/lib/supabase/database-generated.types.ts` - The 491 dropped keys removed from the `rolling_player_game_metrics` Row/Insert/Update blocks (1,473 lines).
- `web/lib/supabase/Upserts/rollingDroppedColumns.ts` - `ROLLING_DROPPED_COLUMNS` (491) and `isRollingDroppedColumn`.
- `web/lib/supabase/Upserts/rollingPlayerValidationPayload.ts` (+ test), `web/scripts/check-rolling-player-{family-reconstruction,disputed-metrics,optional-additions}.ts` - Skip dropped columns.
- `supabase/migrations/20261021185034_drop_unread_rolling_columns.sql` - The 491-column drop; applied 2026-10-21 as ledger order 96.
- `tasks/TASKS/cron-operations/cron-schedule.md` - pg_cron inventory (jobs 278, 79, 329); 278 weekly and 329 at 09:15Z recorded 2026-10-21.
- `web/lib/cron/nstCoordination.ts` - NST cron start table, kept in step with the inventory by `nstCoordination.test.ts` (329 moved to 09:15).
- `web/lib/cron/combinedCronInventory.test.ts`, `web/__tests__/pages/api/v1/db/cron-audit-wrappers.test.ts` - Frozen cron counts.
- `tasks/artifacts/forge-projection-audit-2026-10-21/rolling-column-inventory.json` - Reviewed droppable/unread column and sidecar-key lists (the one durable artifact for this list).

### Notes

- File ownership while the audit session runs: this list owns the files above. `skater-stage.ts`, `skater-adjustments.ts` and `forgeDailyBridge.ts` belong to the audit session; anything here that needs them waits for its commit.
- NST and WGO ingestion code is Codex's lane; `cron-report.ts` wording too. Those needs become notes in `tasks/artifacts/cross-platform/`.
- Production reads, pg_cron changes, migrations and reruns each need TJ's explicit approval at the time, asked as a pop-up. NST requests stay within 40/1 min, 80/5 min, 100/15 min and 180/h.
- Tests: `npm test -- <file>` from `web/`; full type check under `/private/tmp/fhfh-heavy.lock` with an 8–10 GB heap.
- Task numbers are IDs. 2.0, 3.0 and 4.0 touch disjoint files and can run in parallel after 1.0; 5.0 is DB/Ops; 7.0 depends on 1.0 and 2.0.

## Tasks

- [ ] 1.0 Measure and confirm the unread set before changing storage
  - [x] 1.1 Ask TJ to approve the read-only queries from `workers/w2-rolling.md` §5: Q1 (heap, TOAST and index sizes, dead tuples), Q2 (per-index use), Q3 with `pg_class.reltuples` instead of the full-table scan, and Q4 (null fractions by season on a 0.5% sample, including pre-pruning rows).
  - [x] 1.2 Run them once and record the results in the task list notes below.
  - [x] 1.3 Re-derive the unread column set at HEAD, adding the dynamic readers the audit flagged as unconfirmed (rankings select fields, trends player page builders, `skaterWindowAggregation`, entity-metric rankings, `trendsDebug`, `web/scripts/*`, `rollingPlayerValidationPayload` `select("*")`). Write the reviewed lists to `rolling-column-inventory.json`: wide-unread, wide-diagnostic-only, sidecar-unread and sidecar-read keys.
  - [x] 1.4 Decide with TJ which diagnostic-only columns (`trendsDebug`, scripts) to keep.

- [ ] 2.0 Sidecar payload diet (Q11)
  - [x] 2.1 In `splitRollingUpsertRowForDurableStorage`, stop writing null-valued keys into `support_payload`. (Drafted by the audit session's W-B before the hand-over; verified here: test added, file tests green.)
  - [x] 2.2 Write only the sidecar keys in the read list from 1.3 (an explicit allowlist), dropping the unread ones.
  - [x] 2.3 Extend `fetchRollingPlayerAverages.test.ts`: a payload with nulls and unread keys produces the reduced payload, and the reader merge (`mergeRollingSupportPayloadFields`, `skater-queries` hydrate) returns identical values with and without them.
  - [x] 2.4 Run the writer and reader test files and lint.

- [ ] 3.0 FORGE rolling read diet (S-F)
  - [x] 3.1 Decide with TJ: latest row per player × strength via (a) a new RPC with `DISTINCT ON (player_id)` (one round trip per team-game, needs a migration and grants), or (b) one `order by game_date desc limit 1` query per player id (no migration, about 60 small queries per team-game).
  - [x] 3.2 Implement the chosen latest-row read in `fetchRollingRows`, keeping the strict coverage proofs (`skater-queries.ts:216-249`) for the new shape. This removes the 365-day window and the 5,000-row cap.
  - [x] 3.3 Read only the sidecar keys FORGE uses (`historicalCompatibility`, `alignedCountSupport`) through a JSON-path select instead of the whole `support_payload`.
  - [x] 3.4 Drop the per-page `count: "exact"`.
  - [x] 3.5 Extend `skater-queries.test.ts`: the latest-row result matches the old path's `pickLatestByPlayer` output on a multi-game fixture, coverage failures still raise, and the sidecar keys hydrate identically.
  - [x] 3.6 If (a) was chosen: write the RPC migration, apply it with TJ's approval and record it in the ledger.

- [x] 4.0 Pipeline: no repeated per-invocation work (Q12). Drafts by the audit session's W-C plus this list's worker were handed over 2026-10-21 and are verified here.
  - [x] 4.1 Run the goalie step once per run: only when the projection stage starts its first date (`datesDone === 0`) and the step has not succeeded in this run (a marker in the stage state).
  - [x] 4.2 Skip the route-level preflight in `run-projection-v2` when it resumes an already-claimed run (the stage preflight still runs).
  - [x] 4.3 Report the effective `stopOnFailure` in the pipeline response instead of echoing the query value.
  - [x] 4.4 Extend the pipeline tests: the goalie step runs on the first projection invocation and not on resumed ones, and a failed goalie step is retried on the next invocation. Add a resumed-claim preflight test in the `run-projection-v2` tests.
  - [x] 4.5 Write a cross-platform note asking Codex to alert on `attempts_exhausted` and `stage_killed` in the daily cron report. (The audit session's `tasks/artifacts/cross-platform/2026-10-21-claude-to-codex-forge-audit-followups.md` §5 covers it; the job 329 move is in `2026-10-21-claude-to-codex-nst-team-stats-schedule.md`.)

- [ ] 5.0 Cron schedule cleanup (Q13, DB/Ops)
  - [x] 5.1 With TJ's approval, read jobs 278, 79 and 329 (`cron.job`) and their last 7 days of `cron_job_audit` outcomes.
  - [x] 5.2 Decide with TJ on job 278 (08:15Z rolling, implicit 14-day window): (a) unschedule it, (b) narrow it to `startDate=endDate=run−1`, or (c) move it to a weekly run that still revisits late-arriving source days.
  - [x] 5.3 Apply the job 278 decision and record it in `cron-schedule.md`; update the frozen cron counts if the active set changes.
  - [x] 5.4 Move job 329 (`update-nst-team-stats-all`, 10:55Z) to before the 10:05Z pipeline, spaced from the 07:25, 08:30, 08:45 and 09:55 NST consumers within the NST limits. Get TJ's approval, apply, and record it.
  - [ ] 5.5 After 6.0 confirms the backfill, unschedule job 79 (the 07:25Z 6-URL NST job; the pipeline's NST step covers the previous day) with TJ's approval. Record it and write a cross-platform note to Codex as the route owner.

- [ ] 6.0 NST backfill follow-through (TJ is running the 10-07..10-18 backfill links)
  - [ ] 6.1 With TJ's approval, count NST rows per date × table for 10-07..10-18 and confirm the ES/PP/5v5 gaps are filled.
  - [ ] 6.2 Prepare the exact bounded rolling recompute for the affected window, per the bounds in `web/README.md`. TJ runs it.
  - [ ] 6.3 Confirm with a read-only count that rolling rows were rewritten for the window.

- [ ] 7.0 Wide-table unread columns (S-G)
  - [x] 7.1 Stop writing the confirmed wide-unread columns (from 1.3) in the writer's upsert body, and omit the always-null pruned keys if Q4 shows no pre-pruning values that a reader would still see.
  - [x] 7.2 Release the writer change (8.0), so nothing writes the columns before they are dropped.
  - [x] 7.3 Decide with TJ how to reclaim space after the drop:
    - (a) `DROP COLUMN` only: instant, but the space returns only as rows are rewritten.
    - (b) `VACUUM FULL` in a maintenance window: locks the table for the duration.
    - (c) `pg_repack`, if available on the project: online. (TJ chose (c), falling back to (a) if unavailable.)
  - [x] 7.4 Write the drop-column migration, apply it with TJ's approval, record it in the ledger, and regenerate `database-generated.types.ts`.
  - [ ] 7.5 Verify: a row-identical recompute for 20 players × 5 strengths, plus the rankings and trends tests.

- [ ] 8.0 Release and record
  - [ ] 8.1 For each finished set: commit on octoberBranch with explicit paths, build a master candidate in a temporary index, gate it in a clean export (tests, lint, type check), push with TJ's approval and the Vercel check, smoke-test, and sync octoberBranch.
  - [ ] 8.2 Keep the migration ledger and `cron-schedule.md` in step with every production change.

- [x] 9.0 Rolling-writer correctness (Q10; same file as 2.0 and 7.1). Drafted by the audit session's W-B, handed over 2026-10-21, verified here.
  - [x] 9.1 `season=` runs must not truncate history: drop `season` from `buildPlayerHistoryReadOptions` (:3031-3035), so the WGO and NST reads span full history, and use `season` only for the write window.
  - [x] 9.2 `expected_sh_pct`: skip a game's entry when the xG numerator is null instead of adding its shots with 0 xG (:1362-1369).
  - [x] 9.3 Fixtures: a season run and an unscoped run produce identical rows, and WGO shots without NST ixG contribute nothing.

## Results (2026-10-21)

### 1.2 Rolling tables (read-only, once each)

- `rolling_player_game_metrics`:
  - 936,941 rows (`reltuples` = `n_live_tup`), 0 dead tuples, 1,114 columns.
  - Size: heap 6,154 MB, TOAST 8 KB, indexes 172 MB, total 6,328 MB.
  - Autovacuum reloptions from migration 93 are live.
- `rolling_player_metric_support_payloads`:
  - 67,568 rows, 0 dead tuples.
  - Size: heap 7.9 MB, TOAST 594 MB, indexes 9 MB, total 611 MB.
  - Rows exist only for 2025-26 and 2026-27.
  - Stored payload averages 5.4–7.2 KB per row.
  - Top-level payload objects:
    - `historicalCompatibility`: about 725 keys, with 51 null in 2025-26 and 96 in 2026-27.
    - `deprecatedCompatibility`: 10 keys.
    - `diagnostics`: 3 keys.
    - `alignedCountSupport`: 9 keys, newer rows only.
- Index use since the last stats reset (`stats_reset` is null, so the window is unknown):
  - `pkey`: 15,973 scans.
  - `idx_rpgm_latest_snapshot_lookup` (45 MB), `idx_rolling_player_game_metrics_contextual_lookup` (42 MB) and `idx_rpgm_season_team_date` (15 MB): 0 scans.
  - `idx_rpgm_strength_date`: 2 scans. `contextual_role`: 1 scan.
  - Sidecar: `pkey` 14,108 scans; `snapshot` 0 scans.
  - Index drops are outside this list's scope.
- Null fractions, from a 0.5% page sample of about 4,400 rows:
  - Every season up to 2025-26 holds values in the pruned wide columns. These rows were written before pruning and rewritten 2026-03-09..06-19.
    - 2021-22 to 2023-24: about 350 non-null pruned-pattern columns per row.
    - 2025-26: 456 per row. 938 of its 1,189 sampled rows have `_last3`/`_3ya`/`_career` values.
  - 2026-27 rows hold none: 8 non-null pruned-pattern columns per row, which are kept fields.
  - Average row size by season:
    - 2026-27: 2.5 KB.
    - 2025-26: 5.7 KB.
    - 2021-22 to 2023-24: 3.7–4.1 KB.
    - Older seasons: 1.3–2.6 KB.
  - Wide-unread examples are well populated in 2026-27: `goals_total_last10` is non-null in 100% of rows and `pdo_goals_for_last5` in 72%.
- Consequences:
  - Readers of historical rows read pruned fields from the wide row. A pruned column counts as read if any reader reads it by either route.
  - 7.1 must keep writing NULL for pruned keys, never omit them: omitted columns keep stale pre-pruning values on conflict, and the wide value wins the reader merge.

### 5.1 Cron jobs (read-only)

- Job 278 `update-rolling-player-averages`:
  - Schedule `15 8 * * *`, active.
  - `cron.job_run_details` shows a daily dispatch (`net.http_get` queued).
  - No `cron_job_audit` row at 08:15Z on any of the last 7 days: the run never finishes inside the function limit.
- Job 329 `update-nst-team-stats-all` (`/api/Teams/nst-team-stats`):
  - Schedule `55 10 * * *`, active.
  - 7 of 7 successes, each 2.1–2.9 s.
  - Each run says it "processed 1 date(s) ... stopped before the Vercel timeout", with `complete: false`. It takes one date per day and never finishes the backlog, which is Codex's route.
- Job 79 `update-nst-gamelog`:
  - Schedule `25 7 * * *`, active.
  - Failed at 07:26Z every day 10-15..10-20.
  - The pipeline's NST step at 2026-10-21 10:05:59Z succeeded with 6,784 rows.
  - No backfill audit rows for 10-07..10-18 yet as of 17:56Z.
- Neighbouring NST jobs: 220 `update-nst-current-season` at `45 8 * * *`; 328 `update-nst-team-daily-incremental` at `55 9 * * *`.

### 5.3–5.4 Applied (2026-10-21 ~17:58Z, TJ approved in this session)

- `cron.alter_job(278, '15 8 * * 0')` and `cron.alter_job(329, '15 9 * * *')`; readback confirmed both.
- Recorded in `cron-schedule.md` (dated note, JSON inventory, timeline) and `nstCoordination.ts`.
- Checks: `lib/cron` and `__tests__/pages/api/Teams` passed (32 files, 289 tests), plus `cron-audit-wrappers` (39 tests).

### 2.1, 4.0 and 9.0 (handed over by the audit session 2026-10-21)

- Writer (`fetchRollingPlayerAverages.ts`):
  - Null pruned keys are left out of `support_payload`. `prunedFieldCount` still counts them, so a sidecar row is still written and replaces the old payload.
  - `expected_sh_pct` `getComponents` returns null without an ixG value.
  - `buildPlayerHistoryReadOptions` drops `season`; `isWithinRequestedWriteWindow` scopes writes by `game.season`.
  - Not changed: the `expected_sh_pct_{ixg,shots}_{season,3ya,career}` support pair still totals all shots. The w2 inventory lists those components as unread, so 7.0 takes them.
- Pipeline:
  - Goalie step: the companion row `projection_execution:goalie` is marked `complete` after a successful step. Resumed invocations skip it, and a failed step is retried. The key passes `projection_pipeline_key_check`.
  - Response: `stopOnFailureRequested`, and `failureSummary.terminalStop` set to `attempts_exhausted` or `stage_killed`.
- `run-projection-v2`: a read-only `forge_runs` lookup skips the route preflight when a running run with the same resume scope exists. The response says `preflightSkipped: "resumed_run"`.
- Checks: the writer, pipeline and RPV2 test files passed (66 + 43 + 17 = 126 tests); eslint on the changed files is clean.

### 1.3 and 3.0 (2026-10-21)

- **1.3 inventory** (`rolling-column-inventory.json`, at `ebdcfe6be`):
  - 15 identity, 177 wide_runtime, 168 wide_diagonly, 21 wide_unread, 404 pruned_runtime, 235 pruned_diagonly, 94 pruned_unread.
  - 376 of the diagnostic-only columns (155 wide, 221 pruned) are read only by three `select('*')` family sweeps: `check-rolling-player-family-reconstruction`, `-disputed-metrics` and `-optional-additions`. Without those scripts, 491 columns are unread.
  - Sidecar:
    - `historicalCompatibility` and `alignedCountSupport` are read at runtime.
    - `deprecatedCompatibility` is diagnostic-only, via the validation payload.
    - `diagnostics` is unread.
  - A sizing query over the candidate sets hit the statement timeout and was not retried.
- **3.0**: the reader makes one GET RPC per strength and returns one row per requested id.
  - Coverage is checked without `count: "exact"`: the row count must match the ids, ids must be strictly ascending, and only requested ids may appear.
  - The sidecar is trimmed to `historicalCompatibility` (selected keys only) and `alignedCountSupport`.
  - Fallback to the legacy window scan happens on PGRST202 (function not deployed; warns once), in read-only reconstruction (the probe means no RPC is attempted), and when replaying a snapshot captured on the old path.
  - The 365-day scope is kept, so outputs are unchanged.
  - The RPC uses a LATERAL top-1 per player on the primary key, not `DISTINCT ON`.
  - Checks:
    - `lib/projections` and `scripts/run-forge-local`: 57 files, 1,277 tests passed.
    - eslint is clean.
    - tsc's only errors are in the audit session's untracked `servedForecastLedger.ts`.
  - Pre-existing, not from this change: `scripts/qualify-native-players-offline.test.ts` fails 30 tests at HEAD (clean export). Commit `b8fe1072e` added `toi_seconds_total_last5` to `ROLLING_ROW_SELECT_CLAUSE` without the offline fixture column. Master doesn't have that commit.

### 3.6 Applied (2026-10-21 ~18:21Z, TJ approved in this session)

- Ledger version `20261021182129`; the file was renamed from its draft timestamp. Ledger: 95 records, 62 applied.
- EXPLAIN (no ANALYZE) of the body with 20 ids:
  - per player, a Limit over an Index Only Scan Backward on `rolling_player_game_metrics_pkey`;
  - then Memoize plus a sidecar primary-key lookup;
  - total cost about 17.

### 8.0 Release notes (2026-10-21)

- **R16** (TJ approved the narrowed scope):
  - Contents: Q10/Q11/Q12 (`ebdcfe6be`) plus the NST cron constant and the 278/329 note in `cron-schedule.md` (`321ed2626`).
  - The master merge of `cron-schedule.md` leaves out the unreleased job 393 note, so master's frozen cron counts still match.
  - Candidate: `d5283309829f34b0bc1d909da875ef5bc02b9c1a` on `42eb9fd80`.
- **S-F (`0ff219d25`) is not releasable alone.** Master's `skater-queries.ts` lacks six unreleased octoberBranch FORGE commits that it builds on:
  - `6767073ea3` sidecar hydration;
  - `6e14053ff5` aligned conversion counts;
  - `7f094c8e68`;
  - `b8fe1072ed`;
  - `34a5588db2` hit/block rescale;
  - `1988836396` whole-second TOI.

  S-F ships with that FORGE model release. The RPC (ledger 95) is live and unused until then.
- Before applying the S-G drop:
  - Check master's code as well as octoberBranch's for literal uses of the 491 names; production runs master.
  - Master's FORGE reader does not hydrate the sidecar, so it reads the wide row only.

### 1.4, 2.2 and 7.1 (2026-10-21)

- **TJ's decision:** drop all 491 columns (115 unread plus 376 read only by script sweeps) and narrow the three check scripts.
- **Writer:** `splitRollingUpsertRowForDurableStorage` deletes the dropped keys from the wide row and leaves them out of `historicalCompatibility`.
  - Dropped `gp_pct_*` keys that are also pruned still go to `deprecatedCompatibility`.
  - Kept pruned keys are unchanged.
- **Readers:** the validation payload and the three check scripts skip dropped columns.
- **Master code check** (it serves production): outside historical SQL migrations, the only literal dropped names are in `rollingPlayerPipelineDiagnostics.ts`, which classifies recomputed rows and doesn't read the table.
  - Master's trends page reads the same dynamically built names from the wide row only (no sidecar join).
  - All of those names are runtime columns, none dropped.
- **Checks:**
  - Upserts, rankings, trends, trendsDebug, the debug API tests and skater-queries: 76 files, 714 tests passed.
  - eslint is clean; the worker's tsc exited 0.
- **Order:** release the writer change (7.2, R17) before applying the drop (7.4); otherwise upserts that still send the keys fail.

### R16, R17 and the drop (2026-10-21)

- **R16:**
  - Candidate `1ed78ca5d`, pushed 18:29Z. `fhfhockey` READY; the other three projects CANCELED.
  - Smoke test: 3/3 pages returned 200.
  - octoberBranch synced with `-s ours` (`b55c22877`), pushed; the 10-minute watch saw no builds.
- **R17:**
  - Candidate `8b99c22d2`: S-G writer plus `b59070d92` plus Q9/Q14 `1bc536e8b`.
  - Gate: 13 failures, the same as master's baseline in the same 6 files; tsc and eslint 0.
  - Pushed 18:43Z; READY at 18:48Z; smoke test 3/3 returned 200.
- **7.4 drop applied:** about 18:50Z as ledger `20261021185034`. Readback: 623 live and 491 dropped attributes.
- **7.5 still open:**
  - space reclaim via pg_repack (TJ runs it);
  - the first production writer run after the drop is the 10:05Z pipeline.

### NST outage, pg_repack and R18 (2026-10-21 evening)

- **NST is down:**
  - Every fetch returns HTTP 521 (TJ suspects the PHP vulnerability).
  - The 10-07..10-18 backfill (`update-nst-gamelog?runMode=incremental&startDate=2026-10-07&endDate=2026-10-18&overwrite=yes`) is blocked at `nextIndex` 0. Re-open the same URL once NST is back.
  - The first manual call hung to a 504 (Codex note `dd9dde066`).
- **Pipeline degrade (`b22c8b55f`):**
  - An NST source shortfall (200, `success: false`, unresolved source outcomes) no longer blocks `upstream_skater_sources`.
  - The NST step is skipped with `degraded: "nst_source_unavailable"`; WGO, the rolling recompute and FORGE still run.
  - `failureSummary.degradedSteps` names the degraded step. Route errors still block.
- **pg_repack:** not usable. Supabase needs 1.5.2+ to repack without superuser; this project offers 1.5.0. The extension was not created.
  - TJ chose to run `VACUUM FULL` himself at a quiet hour.
- **R18:** candidate `56fb03fef` = `b22c8b55f` plus the audit session's even-strength assist patch (`946d8367e`, sha256 `bfdaab5c…`), which TJ approved in this session.
- **Pre-check for tomorrow:** master's FORGE select list (25 columns) and the rankings select list (126) contain none of the 491 dropped columns.
- **R18 shipped:**
  - `56fb03fef`, pushed 19:01Z and READY at 19:06Z.
  - Smoke test 3/3 returned 200.
  - Gate: master's 13 baseline failures, plus `TeamStandingsChart.test.tsx` failing under full-suite load only (it passes alone on both R18 and R17); tsc and eslint 0.
  - octoberBranch synced with `-s ours` (`2d62f390c`).

### R19 (2026-10-21 ~23:01Z)

- **Candidate:** `3929c6422`.
- **Contents:**
  - S-B: ledger lib, snapshot and settle routes, public scoreboard.
  - S-F-lite: the master-only one-call reader, no hydration.
  - F13: full-refresh safety.
  - S-B crons: settle 11:00Z, snapshot 12:30Z.
  - pp1: the audit session's power-play usage patch, TJ approved folding it in.
  - The offline qualification fixture gains `toi_pk_seconds`, with its pinned checksum updated.
- **Before the deploy:** migration 97 applied as ledger `20261021230025`.
- **Gate:**
  - tsc and eslint 0.
  - vitest: master's baseline failures only, the same files. The offline qualification file went back to master's 9 after the fixture fix.
- **Deploy and smoke:** READY 23:06Z; smoke 4/4 returned 200. The scoreboard is empty until the first snapshot and settle.
- **octoberBranch:**
  - synced with `-s ours`;
  - vercel crons and cron counts committed (`7099fa414`, `4aec56d65`, `e1cd41eeb`): 30 Vercel crons, 87 jobs, 21 routes, 17 audited.

### R20 (2026-10-22 ~00:04Z): NST gamelog hang fix

- **Candidate:** `248df9923`. Codex's `6ea6f3bdd` ported to master, along with the gamelog hunks of `7f094c8e6` and `e89dfdde5` it builds on.
- **Behaviour:**
  - a 220 s deadline on every NST, database and audit await;
  - no hidden client retries;
  - HTTP 520–527 returns 503 `source_down`, keeping the cursor;
  - explicit date ranges return a 207 with their resume query;
  - the pipeline treats a 503 `source_down` as an NST outage and degrades.
- **Unchanged:** other NST jobs keep master's client and burst plans.
- **Gate:** the full suite shows master's baseline failures only; tsc and eslint 0.
- **Deploy and smoke:** READY 00:09Z; smoke test 3/3.
- **octoberBranch:** pipeline and test changes in `c5b0012b5`, synced with `-s ours`.

### 2026-10-22 morning check (read-only)

- **NST jobs:**
  - Job 79 (07:26Z) still reports failure, but saved 1,612 rows. NST is reachable again.
  - Job 329 now runs at 09:15Z; it succeeded.
- **Pipeline:** its NST step at 10:05Z succeeded (1,276 rows).
  - First rolling writes after the column drop succeeded: 80 and 280 rows.
  - The run completed at 10:15Z: 0 failed steps, no degraded steps.
- **FORGE h1 runs, both on R20 (`248df9923`):**
  - 10-22: 427 skaters, 24 goalies.
  - 10-23: 72 skaters, 4 goalies.
  - No PGRST202, legacy-scan or rolling-read-incomplete messages in 10:00–10:20Z, so the S-F-lite RPC path was used.
- **S-B:** settle at 11:00Z (0 rows, nothing to settle yet); snapshot at 12:30Z (1,596 rows).
- **Accuracy run** at 11:32Z: 65 rows.
