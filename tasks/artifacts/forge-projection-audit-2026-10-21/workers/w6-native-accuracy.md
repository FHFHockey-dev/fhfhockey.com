# W6 — Native FORGE v2 serving vs daily bridge; accuracy measurement (read-only audit, 2026-10-21)

Repo: `/Users/tim/Code/fhfhockey.com` (`web/` paths below are relative to it). All line numbers are from the working tree on `octoberBranch` at audit time (uncommitted edits present in other files; the files cited here were read as-is). Nothing was run, written or queried.

Evidence labels: **code** (read), **reported** (from a handoff/artifact, not re-checked), **inferred**.

---

## 1. Native v2 vs daily bridge

### 1.1 What the RSO is served today

Production RSO reads forecasts through `loadPlanningData(..., { forgeDailyBridge: true })` (`web/lib/integrations/yahoo/rosterPlanning.ts:320`). The bridge engages only when the serving source is `legacy`, no admitted game revisions exist and no native baseline sources were loaded (`web/lib/rosterScheduleData/planning.ts:181-184`). `selectForecastServingSource` returns `legacy` whenever `PLAYER_FORECAST_NATIVE_CATALOG_HEAD_ID` is unset (`web/lib/player-forecasts/forecastServingSource.ts:22-26`), which is production today (reported, checkpoints §B). So **the bridge is the only RSO forecast source in production**.

### 1.2 Side-by-side

| Dimension | Bridge (`web/lib/rosterScheduleData/forgeDailyBridge.ts`) | Native v2 (`web/lib/player-forecasts/nativeDailyPipelineV2.ts` + v1 pipeline) |
|---|---|---|
| Unit of output | One `GameForecast` per (player, upcoming game) with a full per-game `stats` line (`emit`, :335-346); `sourceKind: "detailed"`, `conditioning: "unconditional"` | Season/rolling **mean rates** per target (contribution-bundle) plus **participation probabilities** per (player, game); the per-game expectation is composed at read time by `resolvePlanningContributions` (`planningContributions.ts:130-237`) |
| Source rows | `forge_player_projections` / `forge_goalie_projections` with `horizon_games = 1` only (:277-278, :481-484), from `forge_runs` `status='succeeded'` in the last 7 days, off-release runs fenced (`FORGE_DAILY_BRIDGE_LOOKBACK_DAYS = 7`, :20; `excludeOffReleaseRuns`, :468) | Original NHL receipts (schedule, roster, boxscore, goalie summaries) bound into `player_forecast_source_observations`; policies `current-appearance-skater-rates-v1` (last 20 appearances, decay 0.9; `baselineRates.ts:14-18`), `native-prior-appearance-skater-rates-v1` (prior season, ≤82 appearances), goalie win/volume/shutout/summary-win policies (`goalieBaselineRates.ts:13-30`); approved hashes pinned at `nativeDailyPipelineV2.ts:31-50` |
| Skater heads | G/A/SOG = ES+PP (PK null → 0) via `buildSkaterModeledHeadTotals` (`modeledHeadTotals.ts:7-58`); HIT/BLK direct; PPP = PP goals + PP assists; PIM/+/- from `wgo_skater_stats_totals` season rates (:489) | GOALS, ASSISTS, POINTS, PP_POINTS, SHOTS_ON_GOAL, HITS, BLOCKED_SHOTS, PENALTY_MINUTES, TIME_ON_ICE_PER_GAME (`gameExpectations.ts:11`) |
| Goalies | Per-start line from the goalie's latest FORGE line (or the team's), re-targeted for opponent/venue/rest; start chance from `goalie_start_projections` last-10/season share, FORGE `starter_probability` for an exact game, IFTTT news floors (:380-432). Win chance estimated from team xG priors when FORGE's `proj_win_prob` is null (:427-428). Served `stats` are already multiplied by start probability (:431), `conditionalStats` = per-start | SAVES, GA, SA, GOALIE_MINUTES, WINS, SHUTOUTS per appearance/start (`gameExpectations.ts:12`); participation via `goalie-roster-observation-*` / `goalie-rolling-14d-*` methods; shutout rate withheld unless credited receipts exist (`goalieBaselineRates.ts:19`) |
| Player coverage | Every identified roster skater whose team's **latest** run includes him; a skater missing from his team's latest run is treated as scratched/injured and dropped (`staleSkaters`, :360-361). Effectively: players who played in the last projected game | Yahoo universe (`nativeDailyUniverse`, :82-96) — owned players must all resolve (U3 gate); U4/U5 thresholds report-only until flagged. After TJ's option (a) 10-19: **only players with participation targets** are served; means-only players are excluded (reported, §E) |
| Game coverage | Each upcoming game in the planning window; `expiresAt = min(game start, run issued + 8 days)` (`VALID_DAYS = 8`, :37, :336) | `NATIVE_DAILY_HORIZON = 20` team games (`nativeDailyPipeline.ts:19`); whole issuance expires at `min(issued+12h, first league puck drop − 1 ms)` (`dailyExpiresAt`, `nativeDailyPipeline.ts:212-217`) → native serving empties every evening (serving plan C-4, reported) |
| Re-aiming | "Exact" line (a run that projected that very game) beats a re-aimed line (:280-281, :364-367); otherwise the latest line is scaled by opponent goals-for ratio, rest model and position tilt (`retargetSkater`, :369-375) | None: participation × rate per game; opponent not modeled |
| Cadence | Passive: whatever `run-projection-v2` wrote. Scheduled h1 run via `run-rolling-forge-pipeline` 10:05–10:55Z (`web/vercel.json:31`); pg_cron h5 run ~10:12Z writes `horizon_games=5` rows the bridge ignores (reported, forge-pipeline-repair note) | Active daily issuance (`scripts/forge-daily.ts`): universe → means capture → participation → materialize (split skater/goalie, A-14) → publish plan → independent-reviewer approval of plan hash → CAS head advance (`nativeBaselineCadence.ts:291-292`, reported in serving plan C-1) |
| Gates | None beyond run status/fence; byte budgets 2.5 MB wire / expanded (:22-25) | Frozen-window method only through `FROZEN_PARTICIPATION_LAST_CUTOFF = 2026-10-27T04:00Z` (:28, :74-77); `rollingFirstIssuance` flag off (:14-22); U3 always; means coverage must equal universe (`assertFreshMeansBinding`, :99-111); participation inputs ≤ `NATIVE_MATERIALIZATION_MAX_PARTICIPATION_INPUTS` per class (:115-121); publication limits 320 rows / 48 MB (`nativeBaselinePublication.ts:15-16`); catalog head validity (`nativeCatalogHead.ts:26-43`); native admission refuses unlabeled sources (`nativeContributionAdmission.ts:75-103`) |
| Activation blockers | n/a (live) | Env `PLAYER_FORECAST_NATIVE_CATALOG_HEAD_ID` unset; patches 01–06 unapplied, 02 fails `git apply --check` (reported §E); two clean consecutive issuances on one head required; decisions D-3..D-7, A-14/15/17/18 open; expiry-at-puck-drop (D-6) means native alone cannot cover evenings; v1 standing approval ends 2026-10-27 04:00Z and the rolling method's first issuance is unapproved (`nativeDailyParticipationMethod` throws `rolling_first_issuance_not_approved`, :74-77) |

### 1.3 Designed coverage/accuracy differences

- **Coverage.** Bridge covers roster skaters who appeared in the team's latest projected game and all identified goalies with a share; it silently drops skaters absent from the latest run (:360-361) and everything older than 7 days. Native covers only players with participation targets; goalie start probabilities are appearance-frequency estimates, uncalibrated by design (`modeledSkaterParticipation.ts:34-36` marks `probabilityStatus: "uncalibrated_model"`).
- **Accuracy mechanics.** Bridge inherits FORGE v2 per-game modeling (opponent, line, PP unit, rest) but then **copies one line across up to 8 days** with a multiplicative opponent/rest/tilt re-aim; its error for day N+k is dominated by lineup/role drift. Native is a shrinkage-free recent-appearance mean (20 appearances, decay 0.9) times participation; no opponent adjustment, so its per-game error is roughly a season-mean baseline's. Goalie wins: bridge uses team-xG win chance when FORGE lacks one (:427-428); native uses the goalie's own appearance win rate.
- **Participation.** Bridge skaters get `startProbability: null` and no appearance probability (emit with `null`, :367, :375) — the line is unconditional. Native carries explicit appearance/start probability with revision ids.

### 1.4 Shared contract for an offline comparison

Yes. Both end up as `GameForecast` rows (`web/lib/rosterScheduleOptimizer/planningTypes.ts`) feeding `resolvePlanningContributions` → `GameExpectation.targets[target].expected` (`gameExpectations.ts:15-45`). The bridge's `sourceWatermark` is `forge-daily-bridge-vN:<run_id>` (:338) and native's `sourceIds`/`methodVersions` are carried per target (`gameExpectations.ts:18-19`), so a per-(player, game, target) ledger can record `expected`, `sourceKind`, `sourceWatermark`/`methodVersion`, `participation.probability`, `cutoffAt`, `issuedAt`, `expiresAt`. Nothing persists this view today: planning data is computed per request and not snapshotted (no snapshot table found in `planningDataTransport.ts` / `data.ts`).

---

## 2. Accuracy measurement today

### 2.1 What `run-projection-accuracy` computes (`web/pages/api/v1/db/run-projection-accuracy.ts`)

- **Run selection:** `requireLatestSucceededRunId(projectionDate)` (`:1676`; `lib/projections/apiHelpers.ts:37-66`) = newest `forge_runs` row with `status='succeeded'`, `as_of_date = projectionDate`, off-release fence applied, and provenance stamp `external_fantasy_input_contract` required (422 otherwise). Then `evaluateForgeCalibrationEligibility` requires the rolling-history provenance too (`:1682-1692`) → 422 "excluded from calibration" for legacy/unstamped runs.
- **Horizon:** `projectionDate = actualDate − offsetDays`, default `DEFAULT_OFFSET_DAYS = 1` (`:329`, `:1675`); rows filtered to `horizon_games = 1` (`:1700-1701`, `:2013-2014`). So it scores the **h1 run issued the day before** only. The h5 pg_cron run is never scored (by design of the filter, but also: the latest-succeeded selector could pick the h5 run_id if it is newest for that `as_of_date`, and then the h1 filter yields zero rows — see defect D7).
- **Actuals:** skaters from `wgo_skater_stats` by `date = actualDate` keyed `game_id:player_id` (`:1540-1567`); goalies from `goalie_stats_unified` by `date` keyed on `player_id` only (`:1569-1588`), with fallback to `forge_goalie_game` where wins/shutouts are forced to 0 (`:2047-2056`). Projected `game_id`s are validated against `games.date = actualDate` (`:1709-1716`), so a rescheduled game is dropped as `wrongDateRows`.
- **Metrics:** per-row fantasy points via `computeSkaterFantasyPoints`/`computeGoalieFantasyPoints` with `DEFAULT_*_FANTASY_POINTS` (`lib/projections/accuracy/fantasyPoints.ts:28-52`; weights `fantasyPointsConfig.ts:8-30` = **G 3, A 2, PPP 1, SOG 0.2, HIT 0.2, BLK 0.25; GA −1, SV 0.2, SHO 3, W 4** — these are TJ's league weights), `error_abs`, `error_sq`, and an "accuracy" score `1 − min(1, |err| / max(1, |actual|, |pred|))` (`fantasyPoints.ts:54-62`). Per-stat MAE/RMSE per scope (`forge_projection_accuracy_stat_daily`), per-player (`forge_projection_accuracy_player`), daily + running totals (`forge_projection_accuracy_daily`), plus a big calibration blob (role buckets, coverage p10–p90, goalie Brier for starter/win/shutout, miss attribution, launch gates) written into `forge_runs.metrics` and `forge_projection_calibration_daily` (`:2380-2412`).
- **Null handling:** skater rows with a withheld ES/PP head are skipped (A-08, `:1757-1762`), but `proj_hits ?? 0`, `proj_blocks ?? 0` (`:1767-1768`) and every actual `?? 0` (`:1774-1917`). Goalie: null `proj_win_prob` skips the row (`:2065-2068`) but `proj_shutout_prob ?? 0` (`:2071`), `proj_saves ?? 0`, `proj_goals_allowed ?? 0` (`:2082-2083`), `starter_probability ?? 0` into Brier (`:2059`).
- **Baselines inside the route:** skater `holdout_baselines.current_baseline|naive_prior` read from `uncertainty.model` (`:402-430`, `:1919-1930`) into `buildHoldoutComparisonReport` (`promotionGates.ts:35-50`); goalie baseline = fixed .900 save% on projected shots against (`:2434`). No repo writer of `holdout_baselines` was found outside a test fixture (`runProjectionV2.alignedConversion.test.ts:55-61`), so in production the skater comparators are almost certainly `insufficient_data` (inferred).
- **Storage/write semantics:** `forge_projection_results` replaced atomically per (`as_of_date`, `actual_date`) via RPC (`supabase/migrations/20260723121407_replace_forge_projection_results_atomic.sql:112-114`); daily/player/stat tables upserted on their PKs `(date,scope)`, `(date,player_id,player_type)`, `(date,scope,stat_key)` (`supabase/migrations/20260716112908_production_schema_baseline.sql:30907-30927`). Running totals read the latest row `< date` (`:1620-1631`).
- **Surfacing:** `/api/v1/forge/accuracy` returns `accuracy_avg × 100` for the last N days from `forge_projection_accuracy_daily` and **500s when every value is 0 or there is no data** (`web/pages/api/v1/forge/accuracy.ts:40-61`). Also consumed by `pages/api/v1/forge/players.ts`, `goalies.ts`, `lib/rollingForgePipeline.ts`, and listed in `lib/projections/goaliePipeline.ts:87-98` as pipeline step 8. No dashboard component reads the stat/player tables directly (rg over `.tsx` found none).

### 2.2 Is accuracy computed on schedule?

**No.** The only cron entry is `run-rolling-forge-pipeline?...&includeAccuracy=false` (`web/vercel.json:31`); the pipeline then records the step as `skipped` ("Accuracy refresh disabled by request", `run-rolling-forge-pipeline.ts:1002-1011`) and the default control is `includeAccuracy: false` (`:1432`). No pg_cron migration in the repo schedules `run-projection-accuracy`. Any rows in the accuracy tables come from manual /db-runner calls.

### 2.3 Fantasy points under league weights / bridge scoring

- Raw FORGE h1 rows **are** scored under the league weights (default config = TJ's weights, §2.1). 
- **Nothing scores what the RSO was shown.** The bridge's re-aimed lines, its start-share goalie blends, its team-xG win chances and its 8-day carry-forward never touch `forge_projection_results`; `forecastServingSource` and `planningContributions` have no outcome join. `runForgeProspectiveEvaluation` (`web/lib/player-forecasts/evaluation.ts:306-431`) scores **frozen Starter Board revisions** (`forge_final_pregame_revisions`/`forge_game_revisions`) against raw boxscores by target, excludes fantasy-point totals, PPP and shutouts (`:421-423`), and requires `STARTER_BOARD_*` capture which is off in production (reported §B). `settlement.ts`/`accountability.ts` serve the research `player_forecast_*` tables (`readiness.ts:10-29`), not FORGE v2.

---

## 3. Naive baselines

- **No last-N or season-average per-game control exists in the serving or accuracy code.** `baselineRates.ts` `CURRENT_APPEARANCE_POLICY` (last 20 appearances, decay 0.9) and the prior-season policy are the **native prior itself**, not an evaluation control; they are not computed for bridge players.
- `promotionGates.ts` defines the `current_baseline`/`naive_prior` comparator shapes (`:35-50`, `:206-212`) but depends on a writer that does not exist in `run-forge-projections.ts` (rg: no `holdout_baselines` writer).
- Sustainability has `runSustainabilityBaselineBacktest` with `career_only|season_only|recent_only|naive` variants (`web/lib/sustainability/backtest.ts:4-9`) — metric-level, not fantasy points, and tied to `sustainability_projections` (`backtestHarness.ts:10-13`). Reusable as a pattern only.
- Python `modeling/player_forecasts/daily_board_baseline_issuance.py` issues "private conditional baseline means before games; never changes serving" (docstring :1) and `daily_board_settlement.py` joins outcomes to pre-puck-drop forecasts; `forge_walk_forward.py` is finite private research. These are the PRD's evaluator lineage but offline and private.
- Readily available raw material for a control: `wgo_skater_stats` per-game rows (already read by the accuracy route) → last-5 / season-to-date mean per stat; `goalie_stats_unified` for goalies; `goalie_start_projections.l10_start_pct` for a start-probability control (already read by the bridge, :485-486).

**Daily scoreboard requirements (per head):** MAE and signed bias for G, A, PPP, SOG, HIT, BLK, FP(skater); SV, GA, FP(goalie); Brier + reliability bins (10) for `appearance` (did he dress), `start`, `win`, `shutout`; coverage = roster player-games with a non-null forecast / roster player-games that occurred (and the inverse: forecasts for players who did not dress); split by team, by player class, and by **source** = `bridge-exact` (`own` branch, `forgeDailyBridge.ts:364-367`), `bridge-re-aimed` (:369-375), `native` (sourceKind from `GameExpectationTarget.sourceKind`), `naive-last5`, `naive-season`. All derivable if the served `GameExpectation` is snapshotted per (player, game, target) with source metadata before puck drop.

---

## 4. Known defects in the accuracy path (file:line)

| # | Defect | Evidence |
|---|---|---|
| D1 | Missing shutout probability scored as 0 (biases goalie FP and shutout Brier) | `run-projection-accuracy.ts:2071` |
| D2 | `proj_hits ?? 0`, `proj_blocks ?? 0` — null hits/blocks heads become zero predictions, inconsistent with the A-08 rule applied to G/A/SOG | `:1767-1768` vs `:1757-1762` |
| D3 | Every actual `?? 0`: a null `wgo_skater_stats` stat (e.g. hits missing) is scored as 0 actual | `:1774-1917`, `:2098-2164` |
| D4 | Goalie fallback actuals (`forge_goalie_game`) force `wins: 0, shutouts: 0` — a real win/shutout scored as miss | `:2047-2056` |
| D5 | `starter_probability ?? 0` enters Brier; goalie actuals matched on `player_id` only (no game_id) so a goalie with two team-dates collapses | `:2059`, `:1583` |
| D6 | Partial-head summing persists in game-prediction features: `sumModeledHeads(goalsEs, goalsPp)` at `featureBuilder.ts:1276-1277` (PK dropped; checkpoint cited :1233–1240 — line numbers drifted). `?? 0` remains in `FORGE.tsx`, `TopAddsRail.tsx`, `forge/player/[id].tsx` (reported §B) | `web/lib/game-predictions/featureBuilder.ts:1276-1277` |
| D7 | Horizon mixing in run selection: `requireLatestSucceededRunId` picks the newest succeeded run for the date irrespective of horizon (`apiHelpers.ts:41-48`); the 10:12Z pg_cron h5 run can be newest, then the `horizon_games = 1` filter yields 0 rows and the route writes an empty day | `apiHelpers.ts:37-66`, `run-projection-accuracy.ts:1700-1701`; h5 cron reported in `forge-pipeline-repair-2026-10-21.md` §4 |
| D8 | Fence mismatch: TS applies `excludeOffReleaseRuns` but the RPC requires `p_source_run_id` = newest succeeded run **without** the fence; when a local/unstamped run is newest (as on 10-18/10-19, reported), the write raises "must be the latest succeeded run" | `apiHelpers.ts:41-45` vs `20260723121407_replace_forge_projection_results_atomic.sql:22-30` |
| D9 | Re-runs: `forge_projection_results` is replaced per (as_of_date, actual_date) — OK; but `forge_projection_accuracy_daily.running_*` are recomputed from the latest row `< date`, so re-running an **earlier** date does not cascade to later dates' running totals | `:1620-1631`, `:2236-2243` |
| D10 | Game-date join: skater actuals keyed on `date = actualDate`; projections whose `games.date` moved (postponed/rescheduled) are dropped silently as `wrongDateRows`; postponed games with no actuals leave forecasts unscored (no "no-game" outcome) | `:1709-1716`, `:1540-1567`; no `postpone` handling in the route (rg) |
| D11 | Provenance gates make scheduled accuracy brittle: 422 whenever the day's newest run lacks both provenance stamps | `:1682-1692`, `apiHelpers.ts:59-64` |
| D12 | `forge/accuracy.ts` 500s on an all-zero or empty series, so an honest empty scoreboard renders as an API error | `web/pages/api/v1/forge/accuracy.ts:58-61` |
| D13 | Skater holdout comparators read `uncertainty.model.holdout_baselines` which no production writer populates → "insufficient_data" forever | `:402-430`; no writer (rg) |
| D14 | Accuracy not scheduled at all | `web/vercel.json:31` (`includeAccuracy=false`) |

---

## 5. Proposals

### Quick wins (Claude lane, local, ≤1 day each)

| # | Change | Files | Impact | Risk | Verification |
|---|---|---|---|---|---|
| Q1 | **Null-safe scoring:** treat null `proj_shutout_prob`, `proj_hits`, `proj_blocks`, null actuals as *unknown* → skip the stat (count in `unknownPredictionSkips`), never 0; drop the `forge_goalie_game` fallback's forced `wins:0/shutouts:0` (skip W/SHO when the row comes from fallback) | `run-projection-accuracy.ts:1767-1768, 2047-2056, 2059, 2071`, actual `?? 0` sites | Removes systematic goalie-FP bias and false hit/block errors | Low; fewer rows scored | Extend `__tests__/pages/api/v1/db/run-projection-accuracy.test.ts` with null-head fixtures |
| Q2 | **Horizon-aware run selection:** filter `forge_runs` to runs that wrote h1 rows (join on `forge_player_projections.horizon_games=1` or store horizon in `forge_runs.metrics`) and make the RPC's "latest succeeded" check apply the same off-release fence | `apiHelpers.ts:37-66`; new migration amending `replace_forge_projection_results_atomic` (ask-first DB change) | Fixes D7/D8 so scheduled runs don't write empty days or raise | Medium (migration) | Unit test for selector; dry SQL review of the RPC |
| Q3 | **Turn on scheduled accuracy** after Q1/Q2: either `includeAccuracy=true` on the existing cron entry (adds one step to the 10:xxZ pipeline, scoring yesterday's h1 run) or a separate 12:00Z cron `run-projection-accuracy` (default date = yesterday, `:2643`). Prefer the separate entry so pipeline failures don't block scoring | `web/vercel.json` | Produces a daily series for the first time | Low runtime (one route/day); requires TJ's deploy authorization | Watch `cron_job_audit` row + `forge_projection_accuracy_daily` row count after first run |
| Q4 | `forge/accuracy.ts`: return 200 with `data: []` and `empty: true` instead of 500 | `web/pages/api/v1/forge/accuracy.ts:58-61` | Dashboards show "no data" not an error | None | Existing `tests/api/dashboard-endpoints-4xx.test.ts` |

### Structural (Claude lane; design first, then ≤3 days)

| # | Change | Files | Impact | Risk | Verification |
|---|---|---|---|---|---|
| S1 | **Served-forecast ledger.** New table `forge_served_forecast_ledger` (one row per `served_date, player_id, game_id, target_key, source`): `expected numeric null`, `conditional numeric null`, `participation_probability`, `source` enum (`bridge_exact`, `bridge_reaimed`, `native`, `naive_last5`, `naive_season`), `source_watermark`, `method_version`, `cutoff_at`, `issued_at`, `expires_at`, `league_fp numeric null`; later filled by a settlement job with `actual numeric null`, `actual_fp`, `dressed boolean`, `started boolean`, `settled_at`, `outcome_source`. PK (`served_date, player_id, game_id, target_key, source`). Written once per day **before first puck drop** by a bounded job that calls `loadPlanningData` for the roster universe and `buildForgeDailyBridgeForecasts` + native `resolvePlanningContributions` (when a head exists) + the two naive controls, then persists the `GameExpectation` view | new `web/lib/player-forecasts/servedForecastLedger.ts`, migration, cron entry; reuse `gameExpectations.ts` types and `forgeDailyBridge.ts` `own` vs re-aimed distinction (needs the `emit` to tag `reaimed: boolean`) | Lets the scoreboard adjudicate bridge-exact vs bridge-re-aimed vs native vs naive on **identical player-games**, scored under league weights, without touching the serving path | Medium: new writer; must be snapshot-only (no serving change); bounded reads (same tables the RSO already reads) | Vitest on ledger builder with planning fixtures; one approved read-only SELECT after first scheduled write |
| S2 | **Naive controls in the ledger:** `naive_last5` = mean of the player's last 5 `wgo_skater_stats` rows per stat × 1 (unconditional, dressed assumed) and `naive_season` = season-to-date mean; goalies: last-10 start share × per-start season means; win = team-xG prior (same as bridge) or 0.5 | `servedForecastLedger.ts`; reads already used by the bridge (`forgeDailyBridge.ts:485-490`) | Honest floor; the PRD's "baseline plus two challengers" shape (tasks-prd-projection-model.md ~l.242, TJ 10-15: baseline + ≤2 challengers) maps to naive_season (baseline) + bridge + native | Low | Deterministic unit tests |
| S3 | **Scoreboard view/route:** a SQL view (or route) over the ledger giving per-day, per-source, per-head MAE/bias, Brier + 10-bin reliability for appearance/start/win/shutout, coverage %, by team; render on the FORGE dashboard in place of `accuracy_avg` | view migration; `pages/api/v1/forge/scoreboard.ts`; dashboard card | Replaces the opaque 0–1 "accuracy" metric | Low | Fixture-backed route test |
| S4 | **Frozen chronological cohort protocol** (PRD evaluator-consistent): freeze a cohort = all roster player-games from the first ledger date onward; evaluate only rows whose `issued_at < game start` and `settled_at` set; report per `calendarLeadDays` (0 = same-day run, 1–7 = carried bridge lines) using `evaluateIssuedObservations` (`evaluation.ts:51-139`) which already excludes the protected 2026-01-03..04-16 window and provides paired baseline MAE/Brier; feed it `IssuedObservation` rows built from the ledger (`baseline` = naive_season) | adapter `ledgerToIssuedObservations.ts`; reuse `evaluation.ts` | Honest horizon separation (bridge day-0 vs day-k); paired comparisons | Low; read-only over the ledger | Unit tests with synthetic ledger rows |
| S5 | **Baseline policy v2 window** (not accuracy, but flagged): `previousAppearanceWindow: 82` must become the prior season's `numberOfGames` before 2027-28 captures; changes definition hashes, keep v1 for replay (side note `forge-82-game-audit-2026-10-19.md`) | `baselinePolicy.ts:60,74`, `baselineRates.ts:126-127,205`, `goalieBaselineRates.ts:113-114` | Prevents throws for 83–84-game players next season | Medium (hash rotation) | Existing baseline tests + new per-season fixture |

### Read-only SQL for the Chef to request approval (NOT run)

```sql
-- Q-A: accuracy table summary, last 14 days (is anything being written? which scopes?)
select date, scope, player_count, round(accuracy_avg, 4) as acc, round(mae, 3) as mae, round(rmse, 3) as rmse, updated_at
from public.forge_projection_accuracy_daily
where date >= current_date - 14
order by date desc, scope;

-- Q-B: forge_runs horizon mix and fence state per as_of_date, last 14 days
select r.as_of_date, r.status, r.git_sha is null or r.git_sha like 'local:%' as off_release,
       coalesce(p.horizon_games, g.horizon_games) as horizon_games,
       count(distinct r.run_id) as runs, count(p.player_id) as skater_rows, count(g.goalie_id) as goalie_rows
from public.forge_runs r
left join public.forge_player_projections p on p.run_id = r.run_id
left join public.forge_goalie_projections g on g.run_id = r.run_id
where r.as_of_date >= current_date - 14
group by 1,2,3,4
order by r.as_of_date desc, horizon_games;

-- Q-C: scored vs unscored game-days, last 14 days (regular-season games vs forge_projection_results actual_dates)
select gm.date,
       count(distinct gm.id) as games,
       count(distinct fr.game_id) as scored_games,
       count(fr.player_id) filter (where fr.player_type = 'skater') as skater_rows,
       count(fr.player_id) filter (where fr.player_type = 'goalie') as goalie_rows
from public.games gm
left join public.forge_projection_results fr on fr.game_id = gm.id and fr.actual_date = gm.date
where gm.type = 2 and gm.date between current_date - 14 and current_date - 1
group by gm.date
order by gm.date desc;

-- Q-D: how many h1 skater rows per day carry null heads the accuracy route would skip or zero-fill
select p.as_of_date,
       count(*) as rows,
       count(*) filter (where p.proj_goals_es is null or p.proj_goals_pp is null) as withheld_goal_heads,
       count(*) filter (where p.proj_hits is null) as null_hits,
       count(*) filter (where p.proj_blocks is null) as null_blocks
from public.forge_player_projections p
join public.forge_runs r on r.run_id = p.run_id and r.status = 'succeeded'
where p.horizon_games = 1 and p.as_of_date >= current_date - 14
group by 1 order by 1 desc;
```

---

## 6. What I could not verify

- Production state of the accuracy tables, `forge_runs` horizon mix, pg_cron schedule and whether any `holdout_baselines` are present in `uncertainty` — no DB access (by instruction). The pg_cron h5 run and the 10-18/19 unstamped runs are **reported** in `forge-pipeline-repair-2026-10-21.md`, not re-checked.
- Whether `wgo_skater_stats.hits`/`blocked_shots` are ever null in production (D3 severity).
- The exact `featureBuilder.ts:1233–1240` cited in the checkpoint; current lines with partial-head sums are 1276–1277 (file has uncommitted edits).
- Whether the patch stack (01–06) still applies; only the README/handoff claim was skimmed.
- Any test behaviour: no tests, tsc or builds were run.
