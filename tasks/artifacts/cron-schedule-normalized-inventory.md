# Cron Schedule Normalized Inventory

## Summary

- Source: `web/rules/cron-schedule.md`
- Parsed scheduled blocks: `52`
- Normalization fields captured for each entry:
  - dependency position
  - UTC slot
  - cron expression
  - job name
  - method
  - URL or SQL body
  - execution-shape classification
  - notes
- This inventory reflects only scheduled `cron.schedule(...)` blocks.
- The `NEED TO ADD` appendix is intentionally excluded because those entries are not scheduled yet.

## Notes

- Dependency position is the file-order execution position, not a functional dependency graph.
- Duplicate time slots are preserved in file order.
- SQL jobs are normalized into their executed SQL body rather than a URL.
- Existing in-file operational notes were preserved where they affect the normalized entry, such as `STATUS: 404 NOT FOUND` and `NOT WORKING`.
- Classification rules used in this pass:
  - `HTTP route`: scheduled through `net.http_get` or `net.http_post` and not already marked broken in the schedule.
  - `SQL-only`: scheduled as direct SQL or materialized-view refresh, with no HTTP route target.
  - `wrapper-dependent`: reserved for jobs that cannot be run directly as plain HTTP or SQL and require an extra orchestrator/wrapper layer. No current scheduled entries landed in this bucket.
  - `currently non-runnable in local/dev`: entries explicitly marked broken or not working in the schedule file.

## Classification Summary

- `HTTP route`: `45`
- `SQL-only`: `5`
- `wrapper-dependent`: `0`
- `currently non-runnable in local/dev`: `2`

## NST Touch Summary

- `Direct remote NST fetch`: `7`
- `Indirect NST-derived data`: `19`
- `NST touch unknown`: `1`
- `No NST touch observed`: `25`

## NST Classification Notes

- `Direct remote NST fetch` means the scheduled job constructs requests to `naturalstattrick.com` or delegates to a route that does so.
- `Indirect NST-derived data` means the job does not hit NST over the network during execution, but it reads NST-backed tables or views such as `nst_*`, `player_stats_unified`, `player_totals_unified`, or `goalie_stats_unified`.
- `NST touch unknown` is reserved for broken or missing implementations where the scheduled target cannot be inspected cleanly.
- For later cron-spacing work, only `Direct remote NST fetch` jobs should consume the strict NST request budget and preferred 15-minute spacing. Indirect jobs do not call NST during the cron run.

## Direct Remote NST Fetches

- `02` `update-nst-gamelog`
  Evidence: [update-nst-gamelog.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-nst-gamelog.ts) defines `BASE_URL = "https://www.naturalstattrick.com/playerteams.php"` and an explicit NST rate limiter.
- `12` `update-nst-tables-all`
  Evidence: [nst-team-stats.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/Teams/nst-team-stats.ts) uses `teamtable.php` plus `NST_INTER_REQUEST_DELAY_MS = 21_000`.
- `16` `update-nst-goalies`
  Evidence: [update-nst-goalies.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-nst-goalies.ts) defines `BASE_URL = "https://www.naturalstattrick.com/playerteams.php"` and rate-limit handling.
- `18` `update-nst-current-season`
  Evidence: [update-nst-current-season.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-nst-current-season.ts) defines `BASE_URL_ALL_PLAYERS = "https://www.naturalstattrick.com/playerteams.php"` and documents NST rate limits.
- `32` `update-nst-team-daily`
  Evidence: [update-nst-team-daily.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-nst-team-daily.ts) defines `NST_BASE_URL = "https://www.naturalstattrick.com/teamtable.php"` and sends NST-style headers.
- `47` `update-nst-team-daily-incremental`
  Evidence: same implementation as dependency `32`; it is the same route with a different scheduled slot.
- `48` `update-nst-team-stats-all`
  Evidence: same implementation family as dependency `12`; scheduled route points to [nst-team-stats.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/Teams/nst-team-stats.ts).

## Indirect NST-Derived Jobs

- `07` `update-rolling-player-averages`
  Evidence: [fetchRollingPlayerAverages.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts) reads `nst_gamelog_*` tables.
- `08` `daily-refresh-player-unified-matview`
  Evidence: [create-materialized-view.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/ml/create-materialized-view.ts) and repo view docs show `player_stats_unified` carries `nst_*` fields and flags.
- `15` `update-expected-goals`
  Evidence: [fetchData.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-expected-goals/fetchData.ts) reads `nst_league_averages` and `nst_att_def_scores`.
- `19` `update-wigo-table-stats`
  Evidence: [calculate-wigo-stats.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/calculate-wigo-stats.ts) reads `nst_seasonal_*` and `nst_gamelog_*` tables.
- `21` `update-rolling-player-averages`
  Evidence: same implementation as dependency `07`; POST version of the same NST-derived route.
- `22` `daily-refresh-goalie-unified-matview`
  Evidence: [goalie-tables.md](/Users/tim/Code/fhfhockey.com/web/rules/goalie-tables.md) shows `goalie_stats_unified` includes extensive `nst_*` fields.
- `23` `update-team-ctpi-daily`
  Evidence: [update-team-ctpi-daily.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-team-ctpi-daily.ts) reads `nst_team_gamelogs_as_rates`, `nst_team_gamelogs_as_counts`, `nst_team_gamelogs_pp_counts`, and `nst_team_gamelogs_pk_counts`.
- `25` `update-team-power-ratings`
  Evidence: [power-ratings.ts](/Users/tim/Code/fhfhockey.com/web/lib/power-ratings.ts) reads `nst_team_gamelogs_as_rates`, `nst_team_5v5`, `nst_team_gamelogs_pp_rates`, and `nst_team_gamelogs_pk_rates`.
- `26` `update-team-power-ratings-new`
  Evidence: same helper path as dependency `25`, via [power-ratings.ts](/Users/tim/Code/fhfhockey.com/web/lib/power-ratings.ts).
- `35` `refresh-team-power-ratings-daily`
  Evidence: inferred indirect NST-derived refresh, because it refreshes the same team power ratings domain as dependencies `25` and `26`, which are built from NST team gamelog tables.
- `39` `update-wgo-averages`
  Evidence: [update-wgo-averages.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-wgo-averages.ts) reads `nst_seasonal_individual_counts` and `nst_seasonal_on_ice_counts`.
- `40` `rebuild-sustainability-baselines`
  Evidence: [rebuild-baselines.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/sustainability/rebuild-baselines.ts) fetches from `player_stats_unified` and `player_totals_unified`.
- `41` `daily-refresh-player-totals-unified-matview`
  Evidence: [supabase-views.md](/Users/tim/Code/fhfhockey.com/web/rules/supabase-views.md) defines `player_totals_unified` as a materialized view built from `player_stats_unified`.
- `42` `rebuild-sustainability-priors`
  Evidence: [priors.ts](/Users/tim/Code/fhfhockey.com/web/lib/sustainability/priors.ts) reads `player_totals_unified` `nst_oi_*` fields.
- `43` `rebuild-sustainability-window-z`
  Evidence: [windows.ts](/Users/tim/Code/fhfhockey.com/web/lib/sustainability/windows.ts) reads `player_stats_unified` `nst_oi_*` fields.
- `44` `rebuild-sustainability-score`
  Evidence: [score.ts](/Users/tim/Code/fhfhockey.com/web/lib/sustainability/score.ts) reads `player_totals_unified` and `player_stats_unified` `nst_*` fields.
- `45` `update-predictions-sko`
  Evidence: [update-predictions-sko.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/ml/update-predictions-sko.ts) queries `player_stats_unified`.
- `46` `rebuild-sustainability-trend-bands`
  Evidence: [bandService.ts](/Users/tim/Code/fhfhockey.com/web/lib/sustainability/bandService.ts) reads `player_stats_unified` and `player_totals_unified` `nst_*` fields.
- `50` `run-projection-accuracy`
  Evidence: [run-projection-accuracy.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/run-projection-accuracy.ts) queries `goalie_stats_unified`, which is NST-backed per repo view docs.

## NST Touch Unknown

- `06` `update-shift-charts`
  Evidence: the scheduled target is already marked `STATUS: 404 NOT FOUND` in [cron-schedule.md](/Users/tim/Code/fhfhockey.com/web/rules/cron-schedule.md), and the scheduled `/api/v1/db/update-shifts` target does not have a matching working implementation in the current repo surface.

## No NST Touch Observed

- Dependencies: `01`, `03`, `04`, `05`, `09`, `10`, `11`, `13`, `14`, `17`, `20`, `24`, `27`, `28`, `29`, `30`, `31`, `33`, `34`, `36`, `37`, `38`, `49`, `51`, `52`
- Basis:
  - no `naturalstattrick.com` fetch path in the inspected route/helper implementation
  - no direct reads of `nst_*` tables in the inspected route/helper implementation
  - where applicable, the job uses NHL API, Yahoo, WGO, Supabase-only data, or downstream projection tables instead

## Functional Dependency Order

- This section captures functional dependency order, not just file-order schedule position.
- The important distinction for later schedule redesign is whether a job is a hard prerequisite, a soft freshness dependency, or an independent downstream consumer.

### Projection Input And FORGE Execution Chain

- `10 update-line-combinations-all`
  Role: supplies recent `lineCombinations`, which are a hard preflight gate for [run-projection-v2.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/run-projection-v2.ts) and a direct input for [update-start-chart-projections.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-start-chart-projections.ts).
- `30 ingest-projection-inputs`
  Role: populates `pbp_games` and `shift_charts` for the recent game window used by the projection pipeline.
- `31 build-forge-derived-v2`
  Depends on: `30 ingest-projection-inputs`
  Reason: [run-projection-v2.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/run-projection-v2.ts) preflight requires fresh rows in `forge_player_game_strength`, `forge_team_game_strength`, and `forge_goalie_game`, and [build-projection-derived-v2.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/build-projection-derived-v2.ts) is the builder for those tables.
- `27 update-goalie-projections-v2`
  Independent branch: produces `goalie_start_projections` from game schedule plus NHL goalie logs.
  Downstream consumers: hard preflight gate for `34 run-forge-projection-v2`; direct input for `29 update-start-chart-projections`.
- `34 run-forge-projection-v2`
  Depends on:
  - `10 update-line-combinations-all`
  - `30 ingest-projection-inputs`
  - `31 build-forge-derived-v2`
  - `27 update-goalie-projections-v2`
  - current roster/schedule freshness from `update-games`, `update-teams`, and `update-players`
  Reason: [run-projection-v2.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/run-projection-v2.ts) explicitly gates on `lineCombinations`, `pbp_games`, `shift_charts`, `forge_*_game_strength`, `forge_goalie_game`, `goalie_start_projections`, and valid `players.team_id` assignments.

### Start Chart Projection Consumer Chain

- `07` or `21 update-rolling-player-averages`
  Role: feeds `rolling_player_game_metrics`, which [update-start-chart-projections.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-start-chart-projections.ts) reads for player-level rates.
- `25 update-team-power-ratings` and `26 update-team-power-ratings-new`
  Role: feed `team_power_ratings_daily`, which start-chart uses for matchup multipliers.
- `10 update-line-combinations-all`
  Role: determines which skaters are projected for each team.
- `27 update-goalie-projections-v2`
  Role: provides `goalie_start_projections`, which start-chart uses for goalie suppression.
- `29 update-start-chart-projections`
  Depends on:
  - `07` or `21 update-rolling-player-averages`
  - `10 update-line-combinations-all`
  - `25`/`26` team power ratings
  - `27 update-goalie-projections-v2`
  Note: this is a downstream projection consumer, but it does not depend on `30`, `31`, or `34`. Its current schedule position before `30` and `31` is acceptable for its own inputs.

### Unified View Refresh And Sustainability Chain

- `08 daily-refresh-player-unified-matview`
  Role: refreshes `player_stats_unified`, a hard source for sustainability baselines, window-z, scores, and trend bands.
- `39 update-wgo-averages`
  Soft freshness dependency: updates WGO-derived fields that contribute to the unified sustainability inputs.
- `41 daily-refresh-player-totals-unified-matview`
  Depends on: fresh `player_stats_unified`
  Role: refreshes `player_totals_unified`, which [rebuild-priors.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/sustainability/rebuild-priors.ts) and [rebuild-baselines.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/sustainability/rebuild-baselines.ts) both read.
- `40 rebuild-sustainability-baselines`
  Depends on:
  - `08 daily-refresh-player-unified-matview`
  - `41 daily-refresh-player-totals-unified-matview`
  Reason: [rebuild-baselines.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/sustainability/rebuild-baselines.ts) reads both `player_stats_unified` and `player_totals_unified`.
  Current schedule issue: dependency order is inverted in `cron-schedule.md`; baselines currently run before `player_totals_unified` refresh.
- `42 rebuild-sustainability-priors`
  Depends on: `41 daily-refresh-player-totals-unified-matview`
  Reason: [priors.ts](/Users/tim/Code/fhfhockey.com/web/lib/sustainability/priors.ts) reads `player_totals_unified` and writes `sustainability_priors`.
- `43 rebuild-sustainability-window-z`
  Depends on:
  - `40 rebuild-sustainability-baselines`
  - `42 rebuild-sustainability-priors`
  Reason: [windows.ts](/Users/tim/Code/fhfhockey.com/web/lib/sustainability/windows.ts) loads player IDs from `player_baselines` and priors from `sustainability_priors`, then writes `sustainability_window_z`.
- `44 rebuild-sustainability-score`
  Depends on:
  - `40 rebuild-sustainability-baselines`
  - `43 rebuild-sustainability-window-z`
  - fresh unified views
  Reason: [rebuild-score.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/sustainability/rebuild-score.ts) loads players through `loadPlayersForSnapshot(snapshot)` and [score.ts](/Users/tim/Code/fhfhockey.com/web/lib/sustainability/score.ts) reads `sustainability_window_z`, `player_stats_unified`, and `player_totals_unified`, then writes `sustainability_scores`.
- `46 rebuild-sustainability-trend-bands`
  Depends on: fresh unified views
  Likely ordering: after `08` and `41`
  Note: this job is in the same sustainability family, but it does not require `sustainability_priors` or `sustainability_window_z` on the inspected path. It can run independently of `42` to `44` once the unified sources are fresh.

### Reporting Chain

- `51 daily-cron-report`
  Depends on: completion of all scheduled jobs that should appear in the audit and job summary for the day.
  Reason: [cron-report.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/cron-report.ts) reads `cron_job_audit` plus cron run records and is purely a reporting consumer. It should be scheduled after all audited jobs have had time to write their final rows.

### First-Pass Ordering Summary

- Hard dependency chain for FORGE:
  `update-line-combinations` -> `ingest-projection-inputs` -> `build-projection-derived-v2` -> `run-projection-v2`
- Parallel hard dependency for slate goalie priors:
  `update-goalie-projections-v2` -> `run-projection-v2`
- Independent downstream consumer chain for Start Chart:
  `update-rolling-player-averages` + `update-line-combinations` + `update-team-power-ratings` + `update-goalie-projections-v2` -> `update-start-chart-projections`
- Hard dependency chain for sustainability:
  `player_stats_unified refresh` + `player_totals_unified refresh` -> `rebuild-baselines`
  `player_totals_unified refresh` -> `rebuild-priors`
  `rebuild-baselines` + `rebuild-priors` -> `rebuild-window-z`
  `rebuild-baselines` + `rebuild-window-z` + fresh unified views -> `rebuild-score`
  `fresh unified views` -> `rebuild-trend-bands`
- Final reporting:
  `all daily jobs complete` -> `cron-report`

## Existing Timing And JSON Surfaces

- Scheduled HTTP routes: `45`
- Scheduled SQL-only jobs: `5`
- Broken/non-runnable scheduled jobs: `2`
- Resolved scheduled HTTP route files inspected for this pass: all `45`
- JSON response support: all `45` scheduled HTTP routes return JSON responses on their primary success/error paths.

### Existing Duration Sources

- `withCronJobAudit` route-audit timing:
  `32` scheduled HTTP routes are wrapped with [withCronJobAudit.ts](/Users/tim/Code/fhfhockey.com/web/lib/cron/withCronJobAudit.ts), which records `details.durationMs` in `cron_job_audit`.
- Route-native duration in JSON response:
  `14` scheduled HTTP entries already expose duration-like fields directly in their payloads.
  Dependencies: `03`, `04`, `05`, `07`, `21`, `30`, `31`, `32`, `34`, `42`, `43`, `44`, `47`, `50`
- Scheduler-derived duration:
  [cron-report.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/cron-report.ts) computes `RunRow.durationMs` from `cron_job_report.scheduled_time` and `end_time`, so pg_cron executions can still have coarse run-time data even when the route itself does not expose timing.

### Route-Level Timing Gaps

- SQL-only jobs with no route-level JSON timing surface:
  Dependencies: `08`, `22`, `33`, `35`, `41`
- Broken/non-runnable jobs:
  Dependencies: `06`, `52`
- HTTP JSON routes with neither `withCronJobAudit` nor self-reported duration:
  Dependencies: `02`, `12`, `20`, `45`, `46`, `48`, `51`

### Notes

- `51 daily-cron-report` returns JSON and consumes duration data from prior jobs, but it does not expose its own runtime in the response.
- `42` to `44` sustainability rebuild routes self-report `duration_s`, but they are not currently wrapped with `withCronJobAudit`.
- `03` to `05` WGO routes self-report duration in their JSON responses, but they are not currently audited through `withCronJobAudit`.
- For later benchmark-runner work, the meaningful distinction is route-level timing availability, not just whether pg_cron can derive elapsed time after the fact.

## First-Pass Bottlenecks And Benchmark-Runner Risks

- This section is a first-pass risk triage based on code shape, external systems, resumability, and known stale-data sensitivity.
- These are likely risks, not measured runtime conclusions.

### Likely Bottlenecks

- `02 update-nst-gamelog`
  Why: direct NST scraper with a global `REQUEST_INTERVAL_MS = 25000`, multi-mode backfill paths, and season/date iteration. High risk of long runtime and unstable elapsed time depending on resume point.
- `07` and `21 update-rolling-player-averages`
  Why: broad rolling rebuild over many players with explicit runtime budgets, concurrency knobs, and optional full-refresh behavior. Strong candidate for over-4m30 runs on broad scopes.
- `12 update-nst-tables-all`
  Why: direct NST job with `MAX_DURATION_MS = 285000`, `NST_INTER_REQUEST_DELAY_MS = 21000`, and resumable one-date-per-run behavior on date-based work.
- `18 update-nst-current-season`
  Why: direct NST current-season scraper over active-player mappings with request pacing and pagination/offset loops.
- `27 update-goalie-projections-v2`
  Why: season-to-date NHL goalie log fetch across many teams, plus per-team batched remote calls. Runtime depends on how far behind `goalie_start_projections` currently is.
- `30 ingest-projection-inputs`
  Why: recent-game ingest of `pbp_games` plus `shift_charts`, with timeout budget and resumable chunking.
- `31 build-forge-derived-v2`
  Why: three derived-table builders in one request, guarded by a 4.5-minute budget.
- `34 run-forge-projection-v2`
  Why: preflight-gated downstream projection run with date-range support and timeout budget; runtime and success are both sensitive to upstream data freshness.
- `43 rebuild-sustainability-window-z`
  Why: `runAll=true` loops batches over all baseline player IDs and windows; strong candidate for benchmark special handling if full-run timing is not comfortably under the cron budget.
- `44 rebuild-sustainability-score`
  Why: `runAll=true` loops every baseline player and all windows, then upserts `sustainability_scores`; likely one of the heavier sustainability jobs.
- `46 rebuild-sustainability-trend-bands`
  Why: `runAll=true` loops players and can optionally compute history; likely variable runtime and memory use depending on player population and per-player row counts.
- `50 run-projection-accuracy`
  Why: broad post-hoc projection analytics route with large derived output surface and explicit duration reporting.

### Stale-Data-Sensitive Jobs

- FORGE preflight chain:
  Dependencies: `10`, `27`, `30`, `31`, `34`
  Why: [run-projection-v2.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/run-projection-v2.ts) fails or degrades when `lineCombinations`, `pbp_games`, `shift_charts`, derived strength tables, `forge_goalie_game`, or `goalie_start_projections` are stale.
- Start Chart freshness chain:
  Dependencies: `07`/`21`, `10`, `25`, `26`, `27`, `29`
  Why: [update-start-chart-projections.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-start-chart-projections.ts) directly reads rolling metrics, line combinations, team ratings, and goalie priors.
- Unified-view sustainability chain:
  Dependencies: `08`, `39`, `41`, `40`, `42`, `43`, `44`, `46`
  Why: the sustainability stack reads `player_stats_unified`, `player_totals_unified`, `player_baselines`, `sustainability_priors`, and `sustainability_window_z` in sequence.
- Team power and CTPI chain:
  Dependencies: `23`, `25`, `26`, `35`
  Why: dashboard-facing team rating surfaces depend on timely team-gamelog-derived tables and refreshes.
- Dashboard-visible or dashboard-adjacent stale surfaces:
  Dependencies: `27`, `29`, `34`, `40`, `42`, `43`, `44`
  Why: these jobs map directly to the FORGE dashboard areas that previously showed stale dates or hidden stale fallbacks.

### Jobs Requiring Special Handling In The Benchmark Runner

- Direct NST fetch jobs must be serialized and treated as externally rate-limited:
  Dependencies: `02`, `12`, `16`, `18`, `32`, `47`, `48`
  Reason: these make real `naturalstattrick.com` requests and should not be packed tightly or run concurrently in the audit workflow.
- SQL-only jobs need a non-HTTP execution path:
  Dependencies: `08`, `22`, `33`, `35`, `41`
  Reason: no route invocation exists; the benchmark runner must execute or simulate the SQL body separately.
- Broken or intentionally non-runnable jobs should be skipped with an explicit note:
  Dependencies: `06`, `52`
  Reason: scheduled targets are already flagged broken in `cron-schedule.md`.
- External side-effect jobs should not run blindly in local/dev:
  Dependencies: `20`, `51`
  Reason:
  - `20 sync-yahoo-players-to-sheet` writes to Google Sheets.
  - `51 daily-cron-report` sends Resend email and is better handled in dry-run, mocked-email, or production-observation mode.
- Stateful/resumable jobs have non-deterministic runtime unless the runner captures their starting state:
  Dependencies: `02`, `12`, `18`, `27`, `30`, `31`, `34`
  Reason: these routes resume from existing database state, existing latest dates, or explicit timeout windows; benchmark results depend on where the data currently stands.
- Batch-loop sustainability jobs may need explicit audit mode rules:
  Dependencies: `43`, `44`, `46`
  Reason: if `runAll=true` is too slow for stable benchmarking, the runner may need offset-specific invocations or a separate optimized mode.

### First-Pass Weaknesses

- The schedule contains known broken entries (`06`, `52`) that will pollute benchmark completeness unless skipped cleanly.
- Several important cron routes still lack route-level timing despite returning JSON:
  Dependencies: `02`, `12`, `20`, `45`, `46`, `48`, `51`
- Some dashboard-critical chains depend on stateful freshness rather than fixed input size, which makes naive “run once and time it” measurements misleading.
- `27 update-goalie-projections-v2` is especially awkward for repair or benchmarking because it resumes from the latest existing `goalie_start_projections` date instead of accepting a direct target date window.
- The current sustainability schedule still has an ordering bug:
  `40 rebuild-sustainability-baselines` runs before `41 player_totals_unified refresh`, even though baselines read `player_totals_unified`.

## Inventory

| Dep | UTC Slot | Cron | Job | Method | Classification | Target | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 01 | 07:20 UTC | `20 7 * * *` | `update-yahoo-matchup-dates` | GET | `HTTP route` | `https://fhfhockey.com/api/v1/db/update-yahoo-weeks?game_key=nhl` |  |
| 02 | 07:25 UTC | `25 7 * * *` | `update-nst-gamelog` | GET | `HTTP route` | `https://fhfhockey.com/api/v1/db/update-nst-gamelog` |  |
| 03 | 07:30 UTC | `30 7 * * *` | `update-all-wgo-skaters` | GET | `HTTP route` | `https://fhfhockey.com/api/v1/db/update-wgo-skaters?action=all` |  |
| 04 | 07:35 UTC | `35 7 * * *` | `update-all-wgo-goalies` | GET | `HTTP route` | `https://fhfhockey.com/api/v1/db/update-wgo-goalies?action=all` |  |
| 05 | 07:40 UTC | `40 7 * * *` | `update-all-wgo-skater-totals` | GET | `HTTP route` | `https://fhfhockey.com/api/v1/db/update-wgo-totals?season=current` |  |
| 06 | 07:45 UTC | `45 7 * * *` | `update-shift-charts` | GET | `currently non-runnable in local/dev` | `https://fhfhockey.com/api/v1/db/update-shifts?action=all` | STATUS: 404 NOT FOUND |
| 07 | 07:45 UTC | `45 7 * * *` | `update-rolling-player-averages` | GET | `HTTP route` | `https://fhfhockey.com/api/v1/db/update-rolling-player-averages` |  |
| 08 | 07:50 UTC | `50 7 * * *` | `daily-refresh-player-unified-matview` | SQL | `SQL-only` | `REFRESH MATERIALIZED VIEW player_stats_unified;` |  |
| 09 | 07:55 UTC | `55 7 * * *` | `update-power-play-timeframes` | GET | `HTTP route` | `https://fhfhockey.com/api/v1/db/powerPlayTimeFrame?gameId=all` |  |
| 10 | 08:00 UTC | `00 8 * * *` | `update-line-combinations-all` | GET | `HTTP route` | `https://fhfhockey.com/api/v1/db/update-line-combinations` |  |
| 11 | 08:05 UTC | `05 8 * * *` | `update-team-yearly-summary` | GET | `HTTP route` | `https://fhfhockey.com/api/v1/db/update-team-yearly-summary` |  |
| 12 | 08:10 UTC | `10 8 * * *` | `update-nst-tables-all` | GET | `HTTP route` | `https://fhfhockey.com/api/Teams/nst-team-stats?date=all` |  |
| 13 | 08:15 UTC | `15 8 * * *` | `update-standings-details` | GET | `HTTP route` | `https://fhfhockey.com/api/v1/db/update-standings-details?date=all` |  |
| 14 | 08:20 UTC | `20 8 * * *` | `update-all-wgo-goalie-totals` | GET | `HTTP route` | `https://fhfhockey.com/api/v1/db/update-wgo-goalie-totals` |  |
| 15 | 08:25 UTC | `25 8 * * *` | `update-expected-goals` | GET | `HTTP route` | `https://fhfhockey.com/api/v1/db/update-expected-goals?date=all` |  |
| 16 | 08:30 UTC | `30 8 * * *` | `update-nst-goalies` | GET | `HTTP route` | `https://fhfhockey.com/api/v1/db/update-nst-goalies` |  |
| 17 | 08:40 UTC | `40 8 * * *` | `update-yahoo-players` | GET | `HTTP route` | `https://fhfhockey.com/api/v1/db/update-yahoo-players?gameId=465` |  |
| 18 | 08:45 UTC | `45 8 * * *` | `update-nst-current-season` | GET | `HTTP route` | `https://fhfhockey.com/api/v1/db/update-nst-current-season` |  |
| 19 | 08:50 UTC | `50 8 * * *` | `update-wigo-table-stats` | GET | `HTTP route` | `https://fhfhockey.com/api/v1/db/calculate-wigo-stats` |  |
| 20 | 08:55 UTC | `55 8 * * *` | `sync-yahoo-players-to-sheet` | GET | `HTTP route` | `https://fhfhockey.com/api/internal/sync-yahoo-players-to-sheet?gameId=465` |  |
| 21 | 09:00 UTC | `00 9 * * *` | `update-rolling-player-averages` | POST | `HTTP route` | `https://fhfhockey.com/api/v1/db/update-rolling-player-averages` | `body={}` |
| 22 | 09:05 UTC | `05 9 * * *` | `daily-refresh-goalie-unified-matview` | SQL | `SQL-only` | `REFRESH MATERIALIZED VIEW goalie_stats_unified;` |  |
| 23 | 09:10 UTC | `10 9 * * *` | `update-team-ctpi-daily` | GET | `HTTP route` | `https://fhfhockey.com/api/v1/db/update-team-ctpi-daily` |  |
| 24 | 09:12 UTC | `12 9 * * *` | `update-team-sos` | GET | `HTTP route` | `https://fhfhockey.com/api/v1/db/update-team-sos` |  |
| 25 | 09:15 UTC | `15 9 * * *` | `update-team-power-ratings` | GET | `HTTP route` | `https://fhfhockey.com/api/v1/db/update-team-power-ratings` |  |
| 26 | 09:20 UTC | `20 9 * * *` | `update-team-power-ratings-new` | GET | `HTTP route` | `https://fhfhockey.com/api/v1/db/update-team-power-ratings-new` |  |
| 27 | 09:30 UTC | `30 9 * * *` | `update-goalie-projections-v2` | POST | `HTTP route` | `https://fhfhockey.com/api/v1/db/update-goalie-projections-v2` | `body={}` |
| 28 | 09:35 UTC | `35 9 * * *` | `update-wgo-teams` | GET | `HTTP route` | `https://fhfhockey.com/api/v1/db/run-fetch-wgo-data` |  |
| 29 | 09:40 UTC | `40 9 * * *` | `update-start-chart-projections` | POST | `HTTP route` | `https://fhfhockey.com/api/v1/db/update-start-chart-projections` | `body={}` |
| 30 | 09:45 UTC | `45 9 * * *` | `ingest-projection-inputs` | POST | `HTTP route` | `https://fhfhockey.com/api/v1/db/ingest-projection-inputs` | `body={}` |
| 31 | 09:50 UTC | `50 9 * * *` | `build-forge-derived-v2` | POST | `HTTP route` | `https://fhfhockey.com/api/v1/db/build-projection-derived-v2` | `body={}` |
| 32 | 09:55 UTC | `55 9 * * *` | `update-nst-team-daily` | GET | `HTTP route` | `https://fhfhockey.com/api/v1/db/update-nst-team-daily` |  |
| 33 | 10:00 UTC | `0 10 * * *` | `daily-refresh-matview` | SQL | `SQL-only` | `REFRESH MATERIALIZED VIEW yahoo_nhl_player_map_mat;` |  |
| 34 | 10:05 UTC | `05 10 * * *` | `run-forge-projection-v2` | POST | `HTTP route` | `https://fhfhockey.com/api/v1/db/run-projection-v2` | `body={}` |
| 35 | 10:15 UTC | `15 10 * * *` | `refresh-team-power-ratings-daily` | SQL | `SQL-only` | `WITH s AS ( SELECT * FROM public.seasons ORDER BY id DESC LIMIT 1 ) SELECT public.refresh_team_power_ratings( (SELECT startDate FROM s), LEAST( (now() AT TIME ZONE 'America/New_York')::date, (SELECT regularSeasonEndDate FROM s) ) ...` |  |
| 36 | 10:20 UTC | `20 10 * * *` | `update-season-stats-current-season` | GET | `HTTP route` | `https://fhfhockey.com/api/v1/db/update-season-stats` |  |
| 37 | 10:25 UTC | `25 10 * * *` | `update-rolling-games-recent` | GET | `HTTP route` | `https://fhfhockey.com/api/v1/db/update-rolling-games?date=recent` |  |
| 38 | 10:30 UTC | `30 10 * * *` | `update-sko-stats-full-season` | GET | `HTTP route` | `https://fhfhockey.com/api/v1/db/update-sko-stats` |  |
| 39 | 10:35 UTC | `35 10 * * *` | `update-wgo-averages` | GET | `HTTP route` | `https://fhfhockey.com/api/v1/db/update-wgo-averages` |  |
| 40 | 10:40 UTC | `40 10 * * *` | `rebuild-sustainability-baselines` | GET | `HTTP route` | `https://fhfhockey.com/api/v1/db/sustainability/rebuild-baselines` |  |
| 41 | 10:41 UTC | `41 10 * * *` | `daily-refresh-player-totals-unified-matview` | SQL | `SQL-only` | `REFRESH MATERIALIZED VIEW player_totals_unified;` |  |
| 42 | 10:42 UTC | `42 10 * * *` | `rebuild-sustainability-priors` | GET | `HTTP route` | `https://fhfhockey.com/api/v1/sustainability/rebuild-priors?season=current` |  |
| 43 | 10:43 UTC | `43 10 * * *` | `rebuild-sustainability-window-z` | GET | `HTTP route` | `https://fhfhockey.com/api/v1/sustainability/rebuild-window-z?season=current&runAll=true` |  |
| 44 | 10:44 UTC | `44 10 * * *` | `rebuild-sustainability-score` | GET | `HTTP route` | `https://fhfhockey.com/api/v1/sustainability/rebuild-score?season=current&runAll=true` |  |
| 45 | 10:45 UTC | `45 10 * * *` | `update-predictions-sko` | GET | `HTTP route` | `https://fhfhockey.com/api/v1/ml/update-predictions-sko` |  |
| 46 | 10:46 UTC | `46 10 * * *` | `rebuild-sustainability-trend-bands` | GET | `HTTP route` | `https://fhfhockey.com/api/v1/sustainability/rebuild-trend-bands?runAll=true` |  |
| 47 | 10:50 UTC | `50 10 * * *` | `update-nst-team-daily-incremental` | GET | `HTTP route` | `https://fhfhockey.com/api/v1/db/update-nst-team-daily` |  |
| 48 | 10:55 UTC | `55 10 * * *` | `update-nst-team-stats-all` | GET | `HTTP route` | `https://fhfhockey.com/api/Teams/nst-team-stats` |  |
| 49 | 11:00 UTC | `00 11 * * *` | `update-power-rankings` | GET | `HTTP route` | `https://fhfhockey.com/api/v1/db/update-power-rankings` |  |
| 50 | 11:30 UTC | `30 11 * * *` | `run-projection-accuracy` | POST | `HTTP route` | `https://fhfhockey.com/api/v1/db/run-projection-accuracy?projectionOffsetDays=0` | `body={}` |
| 51 | 13:00 UTC | `00 13 * * *` | `daily-cron-report` | GET | `HTTP route` | `https://fhfhockey.com/api/v1/db/cron-report` |  |
| 52 | 20:51 UTC | `51 20 * * *` | `update-pbp` | GET | `currently non-runnable in local/dev` | `https://fhfhockey.com/api/v1/db/update-PbP?gameId=recent` | NOT WORKING |
