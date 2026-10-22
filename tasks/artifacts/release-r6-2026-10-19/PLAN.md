# Release R6 plan (2026-10-19, Chef)

The bundle that was asked for (RSO commits, per-game resume, schedule-refresh cron, team-strength fixes) cannot ship as one release tonight without breaking production Start Chart. The plan therefore splits it in two.

## R6a: FORGE resume and team-context fixes (ready for TJ's go)

- **Candidate:** `3755308fa2ef70e43b386d54d6b32914cdb56c26`, parent `origin/master` `bb21d5942` (R5), tree `8dc1b5f5e9`. Local ref `chef/release-r6a-candidate`, not pushed.
- **Built with:** a temp `GIT_INDEX_FILE` and `commit-tree`; no merge of octoberBranch.
- **Size:** 12 files, +1211/−73. Per-file blobs are listed below.

| File | Blob | vs master | Source |
|---|---|---|---|
| `web/lib/projections/queries/run-lifecycle-queries.ts` | c6604d9f39 | +293/−33 | worktree (resume) |
| `web/pages/api/v1/db/run-projection-v2.ts` | 0d3de3a4a4 | +124/−4 | worktree (resume) |
| `web/pages/api/v1/db/run-rolling-forge-pipeline.ts` | 797c2ffd37 | +25/−3 | worktree (resume) |
| `web/__tests__/pages/api/v1/db/run-projection-v2.test.ts` | 01dc0091e5 | +75/−0 | worktree (resume) |
| `web/__tests__/pages/api/v1/db/run-rolling-forge-pipeline.test.ts` | 366840fca1 | +56/−3 | worktree (resume) |
| `web/lib/projections/run-forge-projections.resume.test.ts` | d8bdf12720 | new | worktree, plus a candidate-only edit (below) |
| `web/lib/projections/run-forge-projections.ts` | 3947bd2260 | +122/−10 | master + worktree-vs-HEAD hunks (resume) |
| `web/lib/projections/types/run-forge-projections.types.ts` | 54f00720f9 | +18/−0 | master + worktree-vs-HEAD hunks (resume `resume?`, team-context `rowSelection?`) |
| `web/lib/projections/calculators/team-context-adjustments.ts` | 864abda298 | +1/−1 | worktree (sign fix) |
| `web/lib/projections/queries/team-context-queries.ts` | f33a400584 | +68/−18 | worktree (row choice) |
| `web/lib/projections/queries/team-context-queries.test.ts` | 10afea1366 | +63/−1 | worktree |
| `web/lib/projections/runProjectionV2.test.ts` | 5ee9795510 | +34/−0 | master + worktree-vs-HEAD hunks |

**Candidate-only edit.** In the resume test, `buildForgeInputProvenance({ externalFantasyInputsExcluded: true })` becomes `buildForgeInputProvenance()` (3 lines). Master's function takes no argument; the label belongs to the unreleased external-fantasy contract that R5 also dropped. On octoberBranch the test keeps the label.

**Not shipped:** octoberBranch's unreleased `run-forge-projections.ts` provenance-label hunks (`0de97e77d3`), aligned-count types (`6e14053ff5`), `rollingPlayerCountSupport.ts`.

### Gate (export of the candidate tree, throwaway `git init`, no GIT_DIR; heavy jobs under the lock)
- `tsc --noEmit -p .` (8 GB heap): **passed**, exit 0.
- Focused Vitest (resume, run-projection-v2, rolling pipeline, team-context-queries, runProjectionV2): **passed**, 5 files, 134/134.
- ESLint on the 12 files: **passed**, no output.
- Full Vitest, compared with a pristine `bb21d5942` export run at the same time:
  - Master: 16 failed / 8301 passed / 11 skipped, 6 failed files.
  - Candidate: 16 failed / 8317 passed / 11 skipped, 5 failed files.
  - The failing tests are identical; nothing new fails. Master's extra failed file is `ArticleReader/related.server.test.ts`, a file-level load flake.

### Behaviour changes TJ approves with the go
1. **Resume:** uncaptured live `run-projection-v2` runs checkpoint per game. A timeout returns 207 `resume_required` and a later call finishes the same `run_id`. Readers still serve the last `succeeded` run. No migration; the state lives in `forge_runs.metrics.resume`.
2. **Team context (model change):** `teamGoalsForPctAdjustment` sign corrected; it affects goalie win context only, by at most ±4.8% × sampleWeight. The team-strength prior picks the `nhl_team_data` row matching current games played, or no prior. Projections change from the next FORGE run.

### Push and deploy (once TJ says go)
- **Pre-push:** re-check all 4 Vercel projects (`fhfhockey` web, `fhfhockey.com` root `.`, `cms-fhfhockey` cms, `functions-fhfhockey` functions): previews disabled, production branch `master`. Also check that no deployment of `3755308fa` exists yet.
- **Push:** `git push origin 3755308fa2ef70e43b386d54d6b32914cdb56c26:refs/heads/master` (a fast-forward from `bb21d5942`).
- **Expected Vercel entries:** 1 web build plus 3 CANCELED. R5 left cms and functions READY at `bb21d5942`, so their ignoreCommand can resolve the previous SHA this time. If either builds anyway, record it; the ignoreCommand fix is still an open TJ item.
- **Timing:** not during the rolling pipeline window, 10:05–10:55Z. Tonight is clear.
- **Smoke test:** at most 3 sequential read-only GETs (`/`, `/start-chart`, `/api/v1/forge/players?date=<today>`), stopping on the first non-200.
- **Then:** sync octoberBranch from the released master. At the sync, commit the resume and team-context worktree files on octoberBranch, with each owner's OK (`local_9ebe4f4f` resume, `local_a05ab423` team-context). This keeps the label hunks octoberBranch already has.

## R6b: RSO and the schedule-refresh cron (not ready; after the 2026-10-20 17:00Z freeze)

Covers `67e50ee4e` and `317375364`, plus `update-roster-optimizer-schedule-daily` and the witness reader in `planningInputs.ts`.

**Why not tonight.** The two RSO commits sit on unreleased octoberBranch work. Import closure against `origin/master`:
- 62 extra files: 34 changed and 28 new.
- 11 of them are frozen native FORGE files: modeled participation and its stores, `targetRosterObservation`, `contributionStore`, `baseline*`, `goalieBaselineRates`, `sourceSnapshot`, `nativeCatalogHead`.
- Also the S-1 serving source.

Two gates of a candidate (`master + R6a + RSO closure`) show why it cannot be trimmed:
- **With octoberBranch contract files:** `tsc` fails, because `skater-adjustments` needs `rollingPlayerCountSupport` and aligned counts. More importantly, it would ship `consumerRevisionAdmission.ts` with its new rule: reject any FORGE run lacking `external_fantasy_input_contract` (`use_not_approved`). Production `pages/api/v1/start-chart.ts` imports that module, and no production run carries the label. **Start Chart would admit no games** until labeled runs exist. `issuedContext.ts` also changes the schedule-revision hash (ISO-normalised start), which invalidates stored issued revisions.
- **With master's contract files:** `tsc` fails in `planning.test.ts` (`FORGE_EXTERNAL_FANTASY_INPUT_CONTRACT`), and 23 of the 574 RSO tests fail (the native and issued-forecast boundary). The bridge, UI, BenchDays, SlotWeekGrid, lineupGaps and cron tests pass.

**Path (for TJ to choose):**
- **(1) Recommended:** ship R6b with the FORGE v2 / native rollout after the freeze, in this order:
  1. Writer first: `run-forge-projections` stamps the label.
  2. One dated FORGE run produces labeled runs.
  3. Readers and admission (contract files, S-1, RSO) ship in the same or the next release.
  4. Smoke-test Start Chart.

  The schedule cron line (`52 8,14 * * *` in `web/vercel.json`) ships here too, with TJ's approval. Before that, check it against `combinedCronInventory.test.ts`.
- **(2) Alternative:** the RSO owner (`local_08a0bf1c`) ports the two RSO commits onto master's contracts, keeping only the legacy and bridge path. That is real rework, and the native path stays off in production anyway (`PLAYER_FORECAST_NATIVE_CATALOG_HEAD_ID` is not set in Vercel production, checked by name only).

**Bridge until then:** the witness stamps from 10-19 expire around 10-21 08:00Z, but only octoberBranch checks witnesses, so production RSO is unaffected. Production RSO stays on R5 code.

## Not in R6
FORGE 7-patch set plus patch 06 (after 10-20 17:00Z), HTML-fallback flag, B2 V2 DDL, nhl_team_data view migration, ignoreCommand fix, IFTTT.

## R6c: RSO port onto master (Chef gate passed; awaiting TJ's go)

- **Candidate:** `707f60e8331e22c9d851a5592aa06528e359b7fe`, parent `3755308fa` (R6a), tree `97a44fd865`. Local ref `chef/release-r6c-candidate`, built by `local_08a0bf1c`. Its record is `R6C-CANDIDATE.md`.
- **Size:** 85 web files (51 new, 34 changed), +9434/−389.
- **Shape checks (Chef):**
  - No FORGE contract, native or forecast-serving files.
  - No `planningInputs`/`source`/`recurring`/cron/`vercel.json`/`supabase` changes.
  - Outside the RSO directories: `hooks/useCandidateMetrics`, `useYahooEligibility`, `in-season/workspaceSchema`, `integrations/yahoo/{liveDraft,rosterPlanning}` (+ tests).
  - Shared `planningTypes.ts` changes are all optional fields. `normalize.ts` adds one optional `scheduleCoverage`. `liveDraft.ts` reads the goalie minimum from `min_games_played`. The data route now passes `forgeDailyBridge: true`.
- **Production reads:** the bridge's 9 tables/views all exist with `service_role` SELECT (catalog read only): `forge_runs`, `forge_player_projections`, `forge_goalie_projections`, `games`, `goalie_start_projections`, `nhl_team_data` (view), `nst_team_stats`, `opponent_skater_allowed_by_position` (matview), `wgo_skater_stats_totals`.
- **Chef gate** (exports of the candidate and `3755308fa`, throwaway `git init`, no GIT_DIR, under the lock):
  - `tsc`: **passed**, 0 errors.
  - ESLint, 79 files: **passed**, 0 errors and 6 warnings.
  - CSS pure-mode check, 6 scss files: **passed**.
  - Focused Vitest, 35 files: **passed**, 887/887.
  - Full Vitest, back to back:
    - Master `3755308fa`: 16 failed / 8315 passed (6 files).
    - Candidate: 10 failed / 8774 passed (3 files).
    - One failure is new, `TeamStandingsChart` compact controls. It is a known load flake: the file isn't touched, and it passes alone (1/1). Master's extra failures are RSO tests the port fixes (`planningReproducibility` ×5, `CategoryGains`, `RosterScheduleOptimizer` compact) plus the `related.server` flake.
- **Expected Vercel entries:** 1 web build plus 3 CANCELED.
- **Smoke test (at most 3 sequential GETs):**
  1. `/roster-schedule-optimizer`
  2. `/api/v1/roster-schedule-optimizer/data?seasonId=20262027&startDate=2026-10-19&endDate=2026-10-25` (expect 200, with forecasts)
  3. `/start-chart`

  Stop on the first non-200.

## R6d: three octoberBranch fixes (Chef gate passed; awaiting TJ's SHA confirmation)

- **Candidate:** `ccfe5e57b3c7b248309fe1eff07e9002af9a18c8`, parent master `707f60e83` (R6c), tree `89c4c33d56`. Local ref `chef/release-r6d-candidate`. Requested by `local_08a0bf1c`.
- **Size:** 6 files, +198/−6.

| File | Blob | Source |
|---|---|---|
| `web/lib/rosterScheduleOptimizer/planning.ts` | 642c2e10c4 | `a855c9fe6` (same base as master) |
| `web/lib/rosterScheduleOptimizer/planning.test.ts` | 8c26666908 | `a855c9fe6` |
| `web/lib/rosterScheduleData/forgeDailyBridge.ts` | 5a03028241 | `79d3b792f` (same base as master) |
| `web/lib/rosterScheduleData/forgeDailyBridge.test.ts` | e09be4c369 | `79d3b792f` |
| `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts` | 59bfb7168b | master + the `5c3be7a0f` patch (offsets only; master's base differs) |
| `web/lib/supabase/Upserts/fetchRollingPlayerAverages.test.ts` | 3acad38bd5 | master + the `5c3be7a0f` patch |

- **Not shipped:** `a855c9fe6`'s change to `__tests__/pages/api/v1/roster-schedule-optimizer/data.test.ts`, which isn't on master.
- **Production read (rolling fix):** `wgo_skater_stats` has no rows from 2020-07-01 to 2020-10-31, so the September–August date rule can't misplace 2020 bubble playoff games.
- **Gate** (export, throwaway `git init`, no GIT_DIR, under the lock):
  - `tsc`: 0 errors.
  - ESLint on the 6 files: clean.
  - Focused Vitest (RSO optimizer/data, Upserts, RSO components, rolling route): 72 files, 1141/1141.
  - Full Vitest: 9 failed / 8778 passed, against master `707f60e83`'s 10 failed / 8774. One failure isn't on master's list: `related.server.test.ts`. It's environmental: the shared `node_modules` lacks `next-sanity/dist/next-sanity.esm.js`, and the test fails the same way on the master export.
- **Expected Vercel entries:** 1 web build plus 3 CANCELED.
- **After deploy:** tell `local_c39098ae`, which holds TJ's approval for the bounded rolling recompute.

## R6e (held, superseded) and R6f (Chef gate passed; awaiting TJ's confirmation in the Chef session)

- **R6e** (`2a74489af`, compact bridge wire): held, because its budget allowed about 8.8 MB of expanded rows inside account saves, past Vercel's 4.5 MB request limit.
- **R6f candidate:** `b630e0767d00d6c72506268282834151d78e7da1`, parent master `ccfe5e57b` (R6d), tree `706a2b55d1`. Local ref `chef/release-r6f-candidate`, built by `local_b3174028`.
- **Size:** 8 files, +256/−22: `bridgeForecastWire.ts` (new), `forgeDailyBridge.ts` + test, `data.ts`, `provider.ts`, `workspace.ts`, `RosterScheduleOptimizer.tsx`, `workspaceRoutes.test.ts`.
- **Fix:** bridge rows travel packed at every snapshot boundary:
  - the data and provider responses;
  - workspace PUT bodies (unpacked before schema validation);
  - every 200 workspace response;
  - the sessionStorage preservation journal.

  A snapshot is packed only if every row rebuilds exactly, and a partial rebuild throws. The DB stores complete snapshots. Expanded bridge bytes are now also capped at 4 MB, beside the 2.5 MB compact cap.
- **Chef gate** (export, throwaway `git init`, no GIT_DIR, under the lock):
  - `tsc`: 0 errors.
  - ESLint, 8 files: 0 errors and the 6 known warnings.
  - Focused Vitest (RSO, Yahoo, in-season, hooks): 79 files, 1264/1264.
  - Full Vitest: 9 failed / 8782 passed, the same failures as R6d; nothing new.
- **Offline round-trip on real data** (the saved R6d response for 10-20..10-26, 1,283 bridge rows): pack then unpack reproduces the save body byte for byte. The save body goes from 2,422,222 B unpacked to 1,005,041 B packed, with 0 rows left unpacked.
- **Known limit:** browser tabs opened before the deploy run the old bundle. They see workspace loads with packed snapshots (no bridge rows) until they reload.
- **Expected Vercel entries:** 1 web build plus 3 CANCELED.
- **Smoke test (at most 3 sequential GETs):**
  1. `/roster-schedule-optimizer`
  2. the RSO data route (expect `bridgeForecasts` present and `data.forecasts` small)
  3. `/start-chart`
- **octoberBranch:** the source commit `b401c5f53` is local and unpushed; pushing it needs TJ.
