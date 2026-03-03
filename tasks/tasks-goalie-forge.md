## Relevant Files

- `tasks/goalie-forge.md` - Source PRD for goalie modeling requirements, standards, and release phases.
- `tasks/goalie-forge-operator-runbook.md` - Manual operator runbook for refresh/backfill order, timeout bypass usage, and validation checklist.
- `web/lib/projections/run-forge-projections.ts` - Main FORGE projection orchestrator where goalie starter and projection logic runs.
- `web/lib/projections/runProjectionV2.test.ts` - Unit tests for starter candidate filtering and probability edge-cases (B2B, stale goalies, legacy team leakage).
- `web/lib/projections/goalieModel.ts` - Goalie-specific modeling logic for priors, volatility, risk, and recommendations.
- `web/lib/projections/goalieModel.test.ts` - Unit tests for goalie model behavior and regression/volatility rules.
- `web/lib/projections/uncertainty.ts` - Quantile simulation helpers for goalie uncertainty output.
- `web/lib/projections/derived/buildGoalieGameV2.ts` - Builder for `forge_goalie_game` derived inputs used by goalie modeling.
- `web/pages/api/v1/db/ingest-projection-inputs.ts` - Ingestion job for PbP + shifts inputs required before derived and projection runs.
- `web/pages/api/v1/db/build-projection-derived-v2.ts` - Derived table build job for player/team/goalie game-strength inputs.
- `web/pages/api/v1/db/update-goalie-projections-v2.ts` - Goalie start prior generator (`goalie_start_projections`).
- `web/pages/api/v1/db/run-projection-v2.ts` - Endpoint to execute FORGE projection runs by date/range.
- `web/pages/api/v1/db/cron-report.ts` - Cron observability report aggregator, now parsing goalie-specific warning signals from audit payloads.
- `web/components/CronReportEmail/CronReportEmail.tsx` - Cron report email renderer with goalie row and goalie warning visibility.
- `web/pages/api/v1/db/run-projection-accuracy.ts` - Accuracy scoring pipeline and calibration metrics persistence.
- `web/pages/api/v1/forge/goalies.ts` - Goalie FORGE read endpoint and diagnostics output.
- `web/pages/api/v1/forge/goalies.test.ts` - Regression test for goalie API response shape, model/scenario metadata, and calibration hints snapshot.
- `web/pages/api/v1/forge/accuracy.ts` - Accuracy-series endpoint used by FORGE UI.
- `web/pages/api/v1/forge/players.ts` - Skater FORGE read endpoint; includes fallback to latest run with data when requested date has no succeeded run.
- `web/pages/FORGE.tsx` - FORGE UI surface for skater/goalie projections and uncertainty display.
- `web/pages/FORGE.test.tsx` - Regression test for goalie-view UI rendering states including disclosure and starter-confidence blocks.
- `web/styles/Forge.module.scss` - Styling for goalie cards, labels, and mode-specific UI controls.

### Notes

- Unit tests should be added next to code files they validate (e.g., `goalieModel.ts` and `goalieModel.test.ts`).
- Use `cd web && npm test -- <file>` for targeted tests and `cd web && npm exec tsc -- -p tsconfig.json --noEmit` for type safety checks.
- For long manual backfills, use `bypassMaxDuration=true` on ingestion/derived endpoints.

## Tasks

- [x] 1.0 Harden goalie starter probability modeling and candidate hygiene
  - [x] 1.1 Add strict candidate filtering to current-team active goalies (`players.team_id` + `position='G'`) with explicit override exceptions.
  - [x] 1.2 Add recency controls (`last_played_date`) with soft penalty after 30 days and near-elimination/hard exclusion for stale goalies.
  - [x] 1.3 Cap and rank candidate sets (target: max 2-3) using last-10 starts, recency, and confirmed/likely starter events.
  - [x] 1.4 Add back-to-back starter suppression logic with stronger penalties for game-1 starter in game-2 of B2B.
  - [x] 1.5 Add team-strength matchup heuristic (weaker team on B2B more likely backup, weak-opponent rest spot for starter).
  - [x] 1.6 Persist starter-selection diagnostics in uncertainty metadata (`source`, candidate list, l10_starts, recency fields).
  - [x] 1.7 Add unit tests for starter probability edge cases (B2B, stale goalies, legacy team goalie contamination).
- [x] 2.0 Upgrade goalie projection quality (SA, SV%, GA) with context-aware features and calibration
  - [x] 2.1 Add team defensive environment features (rolling SA/CA proxies, xGA proxies if available) into goalie SA estimation.
  - [x] 2.2 Add opponent offense/context features (rolling GF/shot generation, home/away split, rest) to GA/SV% modeling inputs.
  - [x] 2.3 Add workload/fatigue features (starts in last 7/14 days, B2B flags, travel proxy if available).
  - [x] 2.4 Rework save% prior blending to weight multi-season baseline + current-season signal + recency with sample-size-dependent shrinkage.
  - [x] 2.5 Add guardrails for small samples (stronger regression and confidence downgrades for low-shot windows).
  - [x] 2.6 Validate uplift with holdout comparisons against current baseline (MAE/RMSE on saves/GA).
- [x] 3.0 Implement multi-scenario (top-2) goalie forecasting and distribution blending for next-5 outputs
  - [x] 3.1 Generate top-2 goalie starter scenarios per team/game with normalized probabilities.
  - [x] 3.2 Compute scenario-level goalie projections (SA, saves, GA, win/shutout) independently per candidate.
  - [x] 3.3 Blend scenario outputs into final projections using starter probabilities instead of hard top-1 only.
  - [x] 3.4 Extend uncertainty simulation to scenario mixtures so p10/p50/p90 reflect starter uncertainty.
  - [x] 3.5 Add horizon=5 support (or scaffold) with sequential schedule application and widening uncertainty bands.
  - [x] 3.6 Persist scenario metadata in `uncertainty.model` for explainability and debugging.
- [x] 4.0 Strengthen goalie accuracy measurement, diagnostics, and calibration feedback loops
  - [x] 4.1 Expand goalie stat-level diagnostics in accuracy pipeline (`saves`, `GA`, `win_prob`, `shutout_prob`) with daily and rolling aggregates.
  - [x] 4.2 Add probability calibration outputs (Brier score + reliability bins) for starter, win, and shutout probabilities.
  - [x] 4.3 Add interval coverage diagnostics for goalie uncertainty bands (`p10/p90` hit rates).
  - [x] 4.4 Store calibration snapshots in run metadata and/or dedicated tables for trend monitoring.
  - [x] 4.5 Add endpoint-level diagnostics payload to identify whether misses are driven by starter, SA, or SV% components.
  - [x] 4.6 Define acceptance thresholds for launch gates (minimum calibration + error targets over last 30 days).
- [x] 5.0 Improve data pipeline reliability and freshness guarantees for goalie FORGE dependencies
  - [x] 5.1 Codify refresh order and dependency checks (games/teams/players → line combos → ingest → derived → goalie starts → projection run → accuracy run).
  - [x] 5.2 Add preflight checks in run endpoint for required upstream freshness windows (with actionable errors).
  - [x] 5.3 Add backfill-friendly range chunking and resumable behavior for ingestion/derived/projection jobs.
  - [x] 5.4 Add stale-data detectors (e.g., missing recent goalie game rows, outdated players team assignments).
  - [x] 5.5 Add cron/job observability for goalie-specific rows processed and data quality warnings.
  - [x] 5.6 Document manual operator runbook with timeout bypass usage and validation checklist.
- [x] 6.0 Expand API/UI transparency for goalie risk, confidence, and model explainability
  - [x] 6.1 Extend `/api/v1/forge/goalies` response schema with explicit model version, scenario count, and calibration hints.
  - [x] 6.2 Add API diagnostics for empty results (requested date/run vs fallback date/run, games scheduled, run metrics).
  - [x] 6.3 Add UI display blocks for starter confidence drivers (recency, l10 starts, B2B, opponent strength).
  - [x] 6.4 Add visual indicators for confidence tier and volatility/risk classes with tooltips for definitions.
  - [x] 6.5 Add disclosure panel in FORGE goalie view for model limitations and data source caveats.
  - [x] 6.6 Add regression tests/snapshots for API response shape and key UI rendering states.
- [x] 7.0 Integrate additional Supabase goalie/team context signals discovered during schema audit
  - [x] 7.1 Add goalie rest-split performance features from `wgo_goalie_stats` (`save_pct_days_rest_*`, `games_played_days_rest_*`) into save% adjustments.
  - [x] 7.2 Add goalie quality-start stability features (`quality_starts`, `quality_starts_pct`) into volatility and confidence modeling.
  - [x] 7.3 Add team strength priors from `nhl_team_data` (`xga`, `xga_per_game`, `xgf_per_game`) to shots-against and win context.
  - [x] 7.4 Add team 5v5 environment features from `wgo_team_stats` (`save_pct_5v5`, `shooting_plus_save_pct_5v5`) to goalie context blending.
  - [x] 7.5 Add NST team expected-goals context (`nst_team_stats` / `nst_team_all`: `xga`, `xga_per_60`) to opponent shot-danger adjustments.
  - [x] 7.6 Add recency-weighted `lineCombinations.goalies` prior as a soft candidate boost (never hard-include stale/non-roster goalies).
- [x] 8.0 Additional FORGE polish and probability consistency updates
  - [x] 8.1 Add a game ticker above `.goalieDisclosure` showing all games for the selected day, modeled after `.gameStrip` in `web/pages/start-chart.tsx`.
  - [x] 8.2 Ensure opposing goalies' likely-starter `proj_win_prob` sums to 100% per game (or explicitly allocate residual starter mass to backup scenarios).
  - [x] 8.3 Rename uncertainty label text from `(Low/Typical/High)` to `(Floor/Typical/Ceiling)` in goalie and skater uncertainty blocks.

## Progress Snapshot (For Next Codex Chat)

- Completed: `1.0`, `2.0`, `3.0`, `4.0`, `5.1`, `5.2`, `5.3`, `5.4`, `5.5`, `5.6`, `6.1`, `6.2`, `6.3`, `6.4`, `6.5`, `6.6`, `7.0`, `8.0`.
- Next sub-task to execute: `none`.
- In-progress uncommitted work currently includes:
- `web/pages/api/v1/db/run-projection-v2.ts`
- `web/pages/api/v1/db/ingest-projection-inputs.ts`
- `web/pages/api/v1/db/build-projection-derived-v2.ts`
- `web/lib/projections/goaliePipeline.ts`
- `web/lib/projections/goaliePipeline.test.ts`
- Also locally modified (do not overwrite blindly):
- `tasks/goalie-forge.md`
- `web/lib/supabase/database-generated.types.ts`

## Process Rules (Use `process-task-list.mdc`)

- In the next chat, explicitly follow `web/rules/process-task-list.mdc`.
- Execute one unchecked sub-task at a time.
- After each sub-task:
- update this checklist file;
- run relevant lint/tests/typecheck;
- report exactly what changed and what validated;
- stop and wait for user confirmation before moving to the next sub-task.
- When all sub-tasks of a parent task are complete:
- run full test suite (`cd web && npm test`);
- commit completed parent-task changes with a conventional commit message;
- mark parent task `[x]`;
- then wait for confirmation to continue.

## Comprehensive FORGE Freshness Itinerary (Goalies + Skaters)

Run these API endpoints in this order for a given processing date/range.

1. Core schedule + roster freshness:
`/api/v1/db/update-games`
`/api/v1/db/update-teams`
`/api/v1/db/update-players`

2. Team usage context:
`/api/v1/db/update-line-combinations`
`/api/v1/db/update-rolling-player-averages`

3. Projection input ingestion (PbP + shifts):
`/api/v1/db/ingest-projection-inputs?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`

4. Derived projection features:
`/api/v1/db/build-projection-derived-v2?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`

5. Goalie starter priors:
`/api/v1/db/update-goalie-projections-v2?date=YYYY-MM-DD`

6. Projection run (skaters + goalies):
`/api/v1/db/run-projection-v2?date=YYYY-MM-DD&horizonGames=1`

7. Accuracy + calibration refresh:
`/api/v1/db/run-projection-accuracy?date=YYYY-MM-DD`

Operational notes for long ranges/backfills:

1. Use `chunkDays` + `resumeFromDate` on:
`/api/v1/db/ingest-projection-inputs`
`/api/v1/db/build-projection-derived-v2`
`/api/v1/db/run-projection-v2`

2. Use `bypassMaxDuration=true` for manual long-running ingest/derived runs when needed.

3. `run-projection-v2` now has preflight dependency/freshness gates:
- Use default enforced mode in production.
- Use `bypassPreflight=true` only for controlled manual overrides.

4. For incremental daily operations, a practical default is:
- same-day refresh for steps `1` through `6`;
- next-day (after games finalize) for step `7`.

## Handoff Prompt (Copy/Paste Into Next Codex Chat)

```md
Continue this project from `tasks/tasks-goalie-forge.md` using `web/rules/process-task-list.mdc`.

Requirements:
- Execute one sub-task at a time.
- Start from the next unchecked task (`7.2`).
- After each sub-task: update checklist, run relevant lint/tests/typecheck, summarize concrete file changes, and pause for my confirmation.
- When all sub-tasks under a parent are complete: run `cd web && npm test`, commit with conventional commit message, mark parent complete, then pause.
- Do not revert unrelated local changes.

Current status context:
- Completed: `1.0`, `2.0`, `3.0`, `4.0`, `5.1`, `5.2`, `5.3`, `5.4`, `5.5`, `5.6`, `6.1`, `6.2`, `6.3`, `6.4`, `6.5`, `6.6`, `7.1`.
- Pending: `7.2-7.6`, `8.x`.
- Existing local modifications include:
  - `tasks/goalie-forge.md`
  - `web/lib/supabase/database-generated.types.ts`
- Recently touched pipeline files include:
  - `web/pages/api/v1/db/run-projection-v2.ts`
  - `web/pages/api/v1/db/ingest-projection-inputs.ts`
  - `web/pages/api/v1/db/build-projection-derived-v2.ts`
  - `web/lib/projections/goaliePipeline.ts`
  - `web/lib/projections/goaliePipeline.test.ts`

Primary objective now:
- Complete `7.2` (add goalie quality-start stability features), then proceed sequentially.
```


### Cron Job List as of // 2025-02-07 2000 EST

- Cron Jobs are commented out intentionally, the M.O. is to un-comment one cron job, run the job, then re-comment it out. 
- New Cron Jobs are to be added at 5 minute intervals, or midway through a gap in the flor of 5 minute intervals. 
- New Cron jobs are to be uncommented - for visibility. 

```sql
----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  07:20 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  02:20 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-yahoo-matchup-dates',
--     '20 7 * * *', -- 08:55 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/db/update-yahoo-weeks?game_key=nhl',
--             headers := '{"Authorization": "Bearer fhfh-cron-mima-233", "Content-Type": "application/json"}'::jsonb,
--             timeout_milliseconds := 240000 -- 4 mins
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  07:25 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  02:25 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||   16 URLs   |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- WORKING 1/6/26
-- SELECT cron.schedule(
--     'update-nst-gamelog',
--     '25 7 * * *', -- 07:25 UTC

--     $$
--         SELECT net.http_get(url:= 'https://fhfhockey.com/api/v1/db/update-nst-gamelog', 
--         headers := '{"Authorization": "Bearer fhfh-cron-mima-233"}'::jsonb,
--         timeout_milliseconds := 240000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  07:30 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  02:30 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-all-wgo-skaters',
--     '30 7 * * *', -- 07:30 UTC
--     $$
--         SELECT net.http_get(url:= 'https://fhfhockey.com/api/v1/db/update-wgo-skaters?action=all', 
--         headers := '{"Authorization": "Bearer fhfh-cron-mima-233"}'::jsonb,
--         timeout_milliseconds := 100000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  07:35 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  02:35 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-all-wgo-goalies',
--     '35 7 * * *', -- 07:35 UTC
--     $$
--         SELECT net.http_get(url:= 'https://fhfhockey.com/api/v1/db/update-wgo-goalies?action=all', 
--         headers := '{"Authorization": "Bearer fhfh-cron-mima-233"}'::jsonb,
--         timeout_milliseconds := 100000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  07:40 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  02:40 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-all-wgo-skater-totals',
--     '40 7 * * *', -- 07:40 UTC
--     $$
--         SELECT net.http_get(url:= 'https://fhfhockey.com/api/v1/db/update-wgo-totals?season=current', 
--         headers := '{"Authorization": "Bearer fhfh-cron-mima-233"}'::jsonb,
--         timeout_milliseconds := 100000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  07:45 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  02:45 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- STATUS: 404 NOT FOUND

-- SELECT cron.schedule(
--     'update-shift-charts',
--     '45 7 * * *', -- 07:45 UTC
--     $$
--         SELECT net.http_get(url:= 'https://fhfhockey.com/api/v1/db/update-shifts?action=all',
--         headers := '{"Authorization": "Bearer fhfh-cron-mima-233"}'::jsonb,
--         timeout_milliseconds := 100000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  07:45 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  02:45 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-rolling-player-averages',
--     '45 7 * * *', -- 07:45 UTC
--     $$
--         SELECT net.http_get(url:= 'https://fhfhockey.com/api/v1/db/update-rolling-player-averages',
--         headers := '{"Authorization": "Bearer fhfh-cron-mima-233"}'::jsonb,
--         timeout_milliseconds := 100000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  07:50 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  02:50 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'daily-refresh-player-unified-matview',
--     '50 7 * * *', -- 07:50 UTC
--     'REFRESH MATERIALIZED VIEW player_stats_unified;'
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  07:55 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  02:55 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-power-play-timeframes',
--     '55 7 * * *', -- 07:55 UTC
--     $$
--         SELECT net.http_get(url:= 'https://fhfhockey.com/api/v1/db/powerPlayTimeFrame?gameId=all', 
--         headers := '{"Authorization": "Bearer fhfh-cron-mima-233"}'::jsonb,
--         timeout_milliseconds := 100000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  08:00 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  03:00 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-line-combinations-all',
--     '00 8 * * *', -- 08:00 UTC
--     $$
--         SELECT net.http_get(url:= 'https://fhfhockey.com/api/v1/db/update-line-combinations', 
--         headers := '{"Authorization": "Bearer fhfh-cron-mima-233"}'::jsonb,
--         timeout_milliseconds := 100000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  08:05 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  03:05 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||    1 URL    |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-team-yearly-summary',
--     '05 08 * * *', -- 10:00 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/db/update-team-yearly-summary',
--             headers := '{"Authorization": "Bearer fhfh-cron-mima-233", "Content-Type": "application/json"}'::jsonb,
--             timeout_milliseconds := 240000 -- 4 mins
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  08:10 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  03:10 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||    4 URLs   |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-nst-tables-all',
--     '10 8 * * *', -- 08:10 UTC
--     $$
--         SELECT net.http_get(url:= 'https://fhfhockey.com/api/Teams/nst-team-stats?date=all', 
--         headers := '{"Authorization": "Bearer fhfh-cron-mima-233"}'::jsonb,
--         timeout_milliseconds := 100000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  08:15 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  03:15 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-standings-details',
--     '15 8 * * *', -- 08:15 UTC
--     $$
--         SELECT net.http_get(url:= 'https://fhfhockey.com/api/v1/db/update-standings-details?date=all', 
--         headers := '{"Authorization": "Bearer fhfh-cron-mima-233"}'::jsonb,
--         timeout_milliseconds := 100000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  08:20 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  03:20 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-all-wgo-goalie-totals',
--     '20 8 * * *', -- 08:20 UTC
--     $$
--         SELECT net.http_get(url:= 'https://fhfhockey.com/api/v1/db/update-wgo-goalie-totals', 
--         headers := '{"Authorization": "Bearer fhfh-cron-mima-233"}'::jsonb,
--         timeout_milliseconds := 100000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  08:25 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  03:25 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-expected-goals',
--     '25 8 * * *', -- 08:25 UTC
--     $$
--         SELECT net.http_get(url:= 'https://fhfhockey.com/api/v1/db/update-expected-goals?date=all', 
--         headers := '{"Authorization": "Bearer fhfh-cron-mima-233"}'::jsonb,
--         timeout_milliseconds := 100000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  08:30 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  03:30 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||   10 URLs   |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-nst-goalies',
--     '30 8 * * *', -- 08:30 UTC
--     $$
--         SELECT net.http_get(url:= 'https://fhfhockey.com/api/v1/db/update-nst-goalies', 
--         headers := '{"Authorization": "Bearer fhfh-cron-mima-233"}'::jsonb,
--         timeout_milliseconds := 100000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  08:35 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  03:35 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-pbp',
--     '51 20 * * *', -- 08:35 UTC
--     $$
--         SELECT net.http_get(url:= 'https://fhfhockey.com/api/v1/db/update-PbP?gameId=recent',
--         headers := '{"Authorization": "Bearer fhfh-cron-mima-233"}'::jsonb,
--         timeout_milliseconds := 100000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  08:40 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  03:40 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-yahoo-players',
--     '40 08 * * *', -- 08:40 UTC
--     $$
--         SELECT net.http_get(
--         url := 'https://fhfhockey.com/api/v1/db/update-yahoo-players?gameId=465',
--         headers := '{"Authorization": "Bearer fhfh-cron-mima-233"}'::jsonb,
--         timeout_milliseconds := 100000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  08:45 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  03:45 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||    4 URLs   |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-nst-current-season',
--     '45 8 * * *', -- 08:45 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/db/update-nst-current-season',
--             headers := '{"Authorization": "Bearer fhfh-cron-mima-233", "Content-Type": "application/json"}'::jsonb,
--             timeout_milliseconds := 240000 -- 4 mins
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  08:50 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  03:50 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-wigo-table-stats',
--     '50 8 * * *', -- 08:50 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/db/calculate-wigo-stats',
--             headers := '{"Authorization": "Bearer fhfh-cron-mima-233", "Content-Type": "application/json"}'::jsonb,
--             timeout_milliseconds := 240000 -- 4 mins
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  08:55 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  03:55 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'sync-yahoo-players-to-sheet',
--     '55 08 * * *', -- 08:55 UTC
--     $$  
--         SELECT net.http_get(
--         url := 'https://fhfhockey.com/api/internal/sync-yahoo-players-to-sheet?gameId=465',
--         headers := '{"Authorization":"Bearer fhfh-cron-mima-233"}'::jsonb,
--         timeout_milliseconds := 300000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  09:00 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  04:00 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-rolling-player-averages',
--     '00 9 * * *', -- 09:00 UTC
--     $$
--         SELECT net.http_post(
--             url := 'https://fhfhockey.com/api/v1/db/update-rolling-player-averages',
--             body := '{}'::jsonb,
--             headers := '{"Authorization": "Bearer fhfh-cron-mima-233", "Content-Type": "application/json"}'::jsonb,
--             timeout_milliseconds := 300000 -- 5 mins
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  09:05 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  04:05 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'daily-refresh-goalie-unified-matview',
--     '05 9 * * *', -- 09:05 UTC
--     'REFRESH MATERIALIZED VIEW goalie_stats_unified;'
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  09:10 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  04:10 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-team-ctpi-daily',
--     '10 9 * * *', -- 09:10 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/db/update-team-ctpi-daily',
--             headers := '{"Authorization": "Bearer fhfh-cron-mima-233"}'::jsonb,
--             timeout_milliseconds := 100000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  09:15 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  04:15 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-team-power-ratings',
--     '15 9 * * *', -- 09:15 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/db/update-team-power-ratings',
--             headers := '{"Authorization": "Bearer fhfh-cron-mima-233"}'::jsonb,
--             timeout_milliseconds := 300000 -- 5 mins
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  09:20 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  04:20 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-team-power-ratings-new',
--     '20 9 * * *', -- 09:20 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/db/update-team-power-ratings-new',
--             headers := '{"Authorization": "Bearer fhfh-cron-mima-233"}'::jsonb,
--             timeout_milliseconds := 300000 -- 5 mins
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  09:30 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  04:30 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-goalie-projections-v2',
--     '30 9 * * *', -- 09:30 UTC
--     $$
--         SELECT net.http_post(
--             url := 'https://fhfhockey.com/api/v1/db/update-goalie-projections-v2',
--             body := '{}'::jsonb,
--             headers := '{"Authorization": "Bearer fhfh-cron-mima-233", "Content-Type": "application/json"}'::jsonb,
--             timeout_milliseconds := 100000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  09:35 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  04:35 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-wgo-teams',
--     '35 9 * * *', -- 09:35 UTC
--     $$
--         SELECT net.http_get(url:= 'https://fhfhockey.com/api/v1/db/run-fetch-wgo-data', 
--         headers := '{"Authorization": "Bearer fhfh-cron-mima-233"}'::jsonb,
--         timeout_milliseconds := 100000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  09:40 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  04:40 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-start-chart-projections',
--     '40 9 * * *', -- 09:40 UTC
--     $$
--         SELECT net.http_post(
--             url := 'https://fhfhockey.com/api/v1/db/update-start-chart-projections',
--             body := '{}'::jsonb,
--             headers := '{"Authorization": "Bearer fhfh-cron-mima-233", "Content-Type": "application/json"}'::jsonb,
--             timeout_milliseconds := 300000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  09:50 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  04:50 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- 09:50 UTC  (after rolling averages + goalie starts)
-- SELECT cron.schedule(
--     'build-forge-derived-v2',
--     '50 09 * * *',
--     $$
--         SELECT net.http_post(
--             url := 'https://fhfhockey.com/api/v1/db/build-projection-derived-v2',
--             body := '{}'::jsonb,
--             headers := '{"Authorization": "Bearer fhfh-cron-mima-233", "Content-Type": "application/json"}'::jsonb,
--             timeout_milliseconds := 300000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  10:05 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  05:05 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- -- 10:05 UTC  (after derived tables are built)
-- SELECT cron.schedule(
--     'run-forge-projection-v2',
--     '05 10 * * *',
--     $$
--         SELECT net.http_post(
--             url := 'https://fhfhockey.com/api/v1/db/run-projection-v2',
--             body := '{}'::jsonb,
--             headers := '{"Authorization": "Bearer fhfh-cron-mima-233", "Content-Type": "application/json"}'::jsonb,
--             timeout_milliseconds := 300000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  09:55 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  04:55 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||    8 URLs   |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'update-nst-team-daily',
--     '55 9 * * *', -- 09:55 UTC
--     $$
--         SELECT net.http_get(
--             url := 'https://fhfhockey.com/api/v1/db/update-nst-team-daily',
--             headers := '{"Authorization": "Bearer fhfh-cron-mima-233"}'::jsonb,
--             timeout_milliseconds := 100000
--         );
--     $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  10:00 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  05:00 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--     'daily-refresh-matview',
--     '0 10 * * *', -- 10:00 UTC
--     'REFRESH MATERIALIZED VIEW yahoo_nhl_player_map_mat;'
-- );



----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  10:15 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  05:15 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--   'refresh-team-power-ratings-daily',
--   '15 10 * * *', -- 10:15 UTC
--   $$
--     WITH s AS (
--       SELECT *
--       FROM public.seasons
--       ORDER BY id DESC
--       LIMIT 1
--     )
--     SELECT public.refresh_team_power_ratings(
--       (SELECT startDate FROM s),
--       LEAST(
--         (now() AT TIME ZONE 'America/New_York')::date,
--         (SELECT regularSeasonEndDate FROM s)
--       )
--     );
--   $$
-- );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  13:00 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  08:00 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

-- SELECT cron.schedule(
--    'daily-cron-report',
--    '00 13 * * *',  -- 13:00 UTC
--    $$
--      SELECT net.http_get(
--        url       := 'https://fhfhockey.com/api/v1/db/cron-report',
--        headers   := '{"Authorization":"Bearer fhfh-cron-mima-233"}'::jsonb,
--        timeout_milliseconds := 240000
--      );
--    $$
--  );

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  11:20 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  06:20 EST  |||||||||||||||||||||||||||||||||
-- ||||||||||||||||||||||||||||||||| FORGE START |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

SELECT cron.schedule(
    'update-rolling-player-averages-forge',
    '20 11 * * *', -- 11:20 UTC
    $$
        SELECT net.http_get(
            url := 'https://fhfhockey.com/api/v1/db/update-rolling-player-averages',
            headers := '{"Authorization": "Bearer fhfh-cron-mima-233"}'::jsonb,
            timeout_milliseconds := 300000
        );
    $$
);

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  11:25 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  06:25 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

SELECT cron.schedule(
    'ingest-projection-inputs',
    '25 11 * * *', -- 11:25 UTC
    $$
        SELECT net.http_get(
            url := 'https://fhfhockey.com/api/v1/db/ingest-projection-inputs',
            headers := '{"Authorization": "Bearer fhfh-cron-mima-233"}'::jsonb,
            timeout_milliseconds := 600000
        );
    $$
);

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  11:30 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  06:30 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

SELECT cron.schedule(
    'build-projection-derived-v2',
    '30 11 * * *', -- 11:30 UTC
    $$
        SELECT net.http_get(
            url := 'https://fhfhockey.com/api/v1/db/build-projection-derived-v2',
            headers := '{"Authorization": "Bearer fhfh-cron-mima-233"}'::jsonb,
            timeout_milliseconds := 600000
        );
    $$
);

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  11:35 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  06:35 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

SELECT cron.schedule(
    'update-goalie-projections-v2',
    '35 11 * * *', -- 11:35 UTC
    $$
        SELECT net.http_get(
            url := 'https://fhfhockey.com/api/v1/db/update-goalie-projections-v2',
            headers := '{"Authorization": "Bearer fhfh-cron-mima-233"}'::jsonb,
            timeout_milliseconds := 300000
        );
    $$
);

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  11:40 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  06:40 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

SELECT cron.schedule(
    'run-projection-v2',
    '40 11 * * *', -- 11:40 UTC
    $$
        SELECT net.http_get(
            url := 'https://fhfhockey.com/api/v1/db/run-projection-v2?horizonGames=1',
            headers := '{"Authorization": "Bearer fhfh-cron-mima-233"}'::jsonb,
            timeout_milliseconds := 600000
        );
    $$
);

----------------------------------------------------------------------------------
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  11:45 UTC  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||  06:45 EST  |||||||||||||||||||||||||||||||||
-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

SELECT cron.schedule(
    'run-projection-accuracy',
    '45 11 * * *', -- 11:45 UTC
    $$
        SELECT net.http_get(
            url := 'https://fhfhockey.com/api/v1/db/run-projection-accuracy',
            headers := '{"Authorization": "Bearer fhfh-cron-mima-233"}'::jsonb,
            timeout_milliseconds := 300000
        );
    $$
);
```
