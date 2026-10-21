# Tasks: FORGE projection audit, streamlining and speed (2026-10-21)

Source: `tasks/artifacts/forge-projection-audit-2026-10-21/REPORT.md` (findings 7, 8, 12; proposals Q10–Q13, S-F, S-G) and its worker evidence `workers/w2-rolling.md` (§1–6) and `workers/w4-orchestration.md` (§2, §3d, §5 P8–P12).

Scope (TJ, 2026-10-21): the "Streamlining and speed" section — unread rolling columns (S-G), the sidecar payload (Q11), FORGE over-reading (S-F), duplicate cron work (Q12, Q13). Q10 (rolling-writer correctness) is included because it edits the same file. Q9, Q14, S-B, Q7 and Q8 belong to the audit session (`local_f4058d3f`) and are out of scope here.

## Relevant Files

- `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts` - Rolling writer: sidecar split (`isSupportPayloadScalar` :436, `splitRollingUpsertRowForDurableStorage` :462), wide upsert body, history read options (:3031-3035, :2963), `expected_sh_pct` numerator (:1362-1369).
- `web/lib/supabase/Upserts/fetchRollingPlayerAverages.test.ts` - Writer tests: sidecar keys, upsert body, season/history and xG fixtures.
- `web/lib/projections/queries/skater-queries.ts` - FORGE reader `fetchRollingRows` (:179-318) and `ROLLING_ROW_SELECT_CLAUSE` (:82-133).
- `web/lib/projections/queries/skater-queries.test.ts` - Reader tests: latest-row selection, sidecar keys, coverage proofs.
- `web/pages/api/v1/db/run-rolling-forge-pipeline.ts` - Pipeline: goalie step (:919-926), projection stage cursor, effective `stopOnFailure` (:1489-1495).
- `web/__tests__/pages/api/v1/db/run-rolling-forge-pipeline.test.ts` - Pipeline tests: goalie step once per run.
- `web/pages/api/v1/db/run-projection-v2.ts` - Route preflight on a resumed claim (:1154).
- `supabase/migrations/` - New migrations: latest-rolling-row RPC, unread-column drop.
- `tasks/TASKS/repository-audit-remediation/migration-authority.json` - Migration ledger records.
- `web/lib/supabase/supportedBaselineMigration.test.ts` - Ledger counts.
- `web/lib/supabase/database-generated.types.ts` - Regenerated after the column drop.
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
  - [ ] 1.3 Re-derive the unread column set at HEAD, adding the dynamic readers the audit flagged as unconfirmed (rankings select fields, trends player page builders, `skaterWindowAggregation`, entity-metric rankings, `trendsDebug`, `web/scripts/*`, `rollingPlayerValidationPayload` `select("*")`). Write the reviewed lists to `rolling-column-inventory.json`: wide-unread, wide-diagnostic-only, sidecar-unread and sidecar-read keys.
  - [ ] 1.4 Decide with TJ which diagnostic-only columns (`trendsDebug`, scripts) to keep.

- [ ] 2.0 Sidecar payload diet (Q11)
  - [ ] 2.1 In `splitRollingUpsertRowForDurableStorage`, stop writing null-valued keys into `support_payload`. (Audit session's W-B has this done, uncommitted; it owns the file until it commits.)
  - [ ] 2.2 Write only the sidecar keys in the read list from 1.3 (an explicit allowlist), dropping the unread ones.
  - [ ] 2.3 Extend `fetchRollingPlayerAverages.test.ts`: a payload with nulls and unread keys produces the reduced payload, and the reader merge (`mergeRollingSupportPayloadFields`, `skater-queries` hydrate) returns identical values with and without them.
  - [ ] 2.4 Run the writer and reader test files and lint.

- [ ] 3.0 FORGE rolling read diet (S-F)
  - [x] 3.1 Decide with TJ: latest row per player × strength via (a) a new RPC with `DISTINCT ON (player_id)` (one round trip per team-game, needs a migration and grants), or (b) one `order by game_date desc limit 1` query per player id (no migration, about 60 small queries per team-game).
  - [ ] 3.2 Implement the chosen latest-row read in `fetchRollingRows`, keeping the strict coverage proofs (`skater-queries.ts:216-249`) for the new shape. This removes the 365-day window and the 5,000-row cap.
  - [ ] 3.3 Read only the sidecar keys FORGE uses (`historicalCompatibility`, `alignedCountSupport`) through a JSON-path select instead of the whole `support_payload`.
  - [ ] 3.4 Drop the per-page `count: "exact"`.
  - [ ] 3.5 Extend `skater-queries.test.ts`: the latest-row result matches the old path's `pickLatestByPlayer` output on a multi-game fixture, coverage failures still raise, and the sidecar keys hydrate identically.
  - [ ] 3.6 If (a) was chosen: write the RPC migration, apply it with TJ's approval and record it in the ledger.

- [ ] 4.0 Pipeline: no repeated per-invocation work (Q12). Owned by the audit session's W-C (`run-rolling-forge-pipeline.ts`, `run-projection-v2.ts`); this list only tracks it.
  - [ ] 4.1 Run the goalie step once per run: only when the projection stage starts its first date (`datesDone === 0`) and the step has not succeeded in this run (a marker in the stage state).
  - [ ] 4.2 Skip the route-level preflight in `run-projection-v2` when it resumes an already-claimed run (the stage preflight still runs).
  - [ ] 4.3 Report the effective `stopOnFailure` in the pipeline response instead of echoing the query value.
  - [ ] 4.4 Extend the pipeline tests: the goalie step runs on the first projection invocation and not on resumed ones, and a failed goalie step is retried on the next invocation. Add a resumed-claim preflight test in the `run-projection-v2` tests.
  - [ ] 4.5 Write a cross-platform note asking Codex to alert on `attempts_exhausted` and `stage_killed` in the daily cron report.

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
  - [ ] 7.1 Stop writing the confirmed wide-unread columns (from 1.3) in the writer's upsert body, and omit the always-null pruned keys if Q4 shows no pre-pruning values that a reader would still see.
  - [ ] 7.2 Release the writer change (8.0), so nothing writes the columns before they are dropped.
  - [ ] 7.3 Decide with TJ how to reclaim space after the drop:
    - (a) `DROP COLUMN` only: instant, but the space returns only as rows are rewritten.
    - (b) `VACUUM FULL` in a maintenance window: locks the table for the duration.
    - (c) `pg_repack`, if available on the project: online. (TJ chose (c), falling back to (a) if unavailable.)
  - [ ] 7.4 Write the drop-column migration, apply it with TJ's approval, record it in the ledger, and regenerate `database-generated.types.ts`.
  - [ ] 7.5 Verify: a row-identical recompute for 20 players × 5 strengths, plus the rankings and trends tests.

- [ ] 8.0 Release and record
  - [ ] 8.1 For each finished set: commit on octoberBranch with explicit paths, build a master candidate in a temporary index, gate it in a clean export (tests, lint, type check), push with TJ's approval and the Vercel check, smoke-test, and sync octoberBranch.
  - [ ] 8.2 Keep the migration ledger and `cron-schedule.md` in step with every production change.

- [ ] 9.0 Rolling-writer correctness (Q10; same file as 2.0 and 7.1). Owned by the audit session's W-B (done, uncommitted); this list only tracks it.
  - [ ] 9.1 `season=` runs must not truncate history: drop `season` from `buildPlayerHistoryReadOptions` (:3031-3035), so the WGO and NST reads span full history, and use `season` only for the write window.
  - [ ] 9.2 `expected_sh_pct`: skip a game's entry when the xG numerator is null instead of adding its shots with 0 xG (:1362-1369).
  - [ ] 9.3 Fixtures: a season run and an unscoped run produce identical rows, and WGO shots without NST ixG contribute nothing.

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
