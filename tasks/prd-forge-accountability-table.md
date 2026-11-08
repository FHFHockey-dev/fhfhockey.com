# FORGE accountability table — plan

Status: plan only (2026-10-27). Nothing built, migrated, written or deployed. Read-only Supabase sizing queries ran with TJ's OK.

## Goal

A standalone public page, separate from RSO, that keeps FORGE accountable and transparent. TJ, 2026-10-27: "It would show overall model accuracy, and keep us accountable and transparent."

- **Lead:** overall model accuracy. Error and bias summaries, the trend over time, and calibration.
- **Drill-down:** the per-player projection-vs-actual table. Date filter, per-game vs totals, variance, and the projection drift as each game approached.

## TJ's decisions (pop-ups, 2026-10-27)

| Question | Answer |
| --- | --- |
| Which projection is graded | **What RSO showed**: the game-day row in `forge_served_forecast_ledger` |
| Scoring | **TJ's default league**: `DEFAULT_SKATER/GOALIE_FANTASY_POINTS`, as the ledger already scores |
| Audience | **Public page** |
| Drift capture | **4 checkpoints**: 6 days, 3 days and 1 day out, plus game day |
| History before 2026-10-22 | **Start at Oct 22**: no archive tab |
| Projected but didn't dress | **Separate count**: out of MAE and variance; phantom count shown |
| Naive baseline | **Show it**: `naive_last5` column plus a "FORGE vs baseline" tile |

## What the data actually holds (measured 2026-10-27)

| Table | Rows | Size | Notes |
| --- | --- | --- | --- |
| `forge_served_forecast_ledger` | 3,899 | 2.5 MB | Starts **2026-10-22**. PK `(served_date, player_id, game_id, source)`. Per-stat `exp_*` and `act_*`, `exp/act_fantasy_points`, `dressed`, `started`, `settled_at`. Sources so far: `bridge_exact` 1,129, `bridge_reaimed` 14, `naive_last5` 1,378, `naive_season` 1,378. About 1,000 settled per source. |
| `forge_player_projections` | 37,194 | 100 MB | PK `(run_id, game_id, player_id, horizon_games)`. 99.8% `horizon_games = 1`. **Exactly one issue date per game**: FORGE only projects games on game day (20 rows were issued earlier). |
| `forge_goalie_projections` | ~2.3k | 4.9 MB | Same shape. |
| `forge_runs` | 442 (419 succeeded) | 2 MB | Only 214 runs still have player rows; 105 run dates have no rows left. Multi-run dates mostly keep only one run's rows. |
| `forge_game_revisions` | 1 | — | The intraday revision chain is not in use. |
| `forge_projection_results` | 8,263 | 2 MB | Legacy grades 2025-10-08 → 2026-10-23 (latest run per date, horizon 1). Not used (TJ: start at Oct 22). |
| `wgo_skater_stats` / `wgo_goalie_stats` | 1.9M / 140k | 2.8 GB / 54 MB | Actuals. The page does **not** read them: the settle cron already copies actuals into the ledger. |

What this means:

1. **Per-game, totals and variance can ship on existing data.** The ledger already holds projection, actual and fantasy points per player-game for what RSO showed.
2. **Drift doesn't exist yet.** Each game was only ever recorded once (`avg served_dates per player-game = 1.00`), and FORGE itself issues only on game day. RSO's numbers for future games are FORGE's latest run, re-aimed at that game (`loadForgeDailyBridgeForecasts`, `lib/rosterScheduleData/forgeDailyBridge.ts:733`, 7 days ahead). To show drift, the snapshot cron must also record upcoming games. Nothing can be backfilled: past re-aimed numbers were never stored.
3. Same-day re-runs (84 games this season, median 12.6 h apart) are partly lost (see point 4 of the open items) and are out of scope for v1.

## Data sources and join

- **Projection** = ledger row, `source in ('bridge_exact','bridge_reaimed')`. **Graded row** = the game-day checkpoint (`served_date` = the game's ET date).
- **Actual** = the same ledger row's `act_*` fields, filled by `/api/v1/db/forge-served-forecast-settle` (cron 11:00 UTC) from `wgo_skater_stats` and `goalie_stats_unified`. Only rows with `settled_at is not null` are graded.
- **Baseline** = the `naive_last5` row with the same `(served_date, player_id, game_id)`.
- **Scoring** = `exp_fantasy_points` / `act_fantasy_points` as stored (`ledgerFantasyPoints`, default weights; scores G, A, PPP, SOG, HIT, BLK; W, SV, GA, SO). It deliberately does not use `recentForm.ts` columns (PIM, +/-, FOW, GWG, SHP): FORGE doesn't project them.
- **Names and positions** = join `players` on `player_id` (NHL id), and teams by `team_id`.
- **Population** = `dressed = true` for all accuracy figures. `dressed = false` rows are counted as phantoms. `dressed is null` (not settled yet) is shown as pending.
- **Never read** the draft-dashboard `PROJECTIONS_*` tables (standing rule).

Query shapes:

```sql
-- Per-game (graded checkpoint), one date window
select l.served_date, l.game_id, l.player_id, l.player_class, l.team_id, l.opponent_team_id, l.source,
       l.exp_fantasy_points, l.act_fantasy_points,
       l.exp_fantasy_points - l.act_fantasy_points as variance,
       abs(l.exp_fantasy_points - l.act_fantasy_points) as abs_error,
       b.exp_fantasy_points as baseline_fp, l.dressed, l.started, <per-stat exp_/act_ columns>
from forge_served_forecast_ledger l
left join forge_served_forecast_ledger b
  on b.served_date = l.served_date and b.player_id = l.player_id and b.game_id = l.game_id and b.source = 'naive_last5'
where l.source in ('bridge_exact','bridge_reaimed') and l.settled_at is not null
  and l.served_date = (l.scheduled_at at time zone 'America/New_York')::date
  and l.served_date between $start and $end;

-- Totals: group the same rows by player (games, Σproj, Σact, Σvariance, MAE, bias, RMSE, phantoms)
-- Drift: all checkpoints for one (player_id, game_id), ordered by served_date, plus the act_fantasy_points
```

## Row bounds

- Graded rows today: ~230 bridge rows per slate day; about **45k per season**, plus as many baseline rows.
- With 4 drift checkpoints, ledger growth goes from ~1.1k rows/day (all sources) to ~2.0k (only bridge sources at the 3 early checkpoints). That is about **170k bridge rows, ~110 MB per season** at the measured ~650 B/row with indexes.
- Request caps: per-game view at most 31 days (≈7k graded rows, paged at 1,000); totals and the season view through SQL aggregation (below), never by paging every row into a function; drift is one player-game (≤4 rows).

## Schema work (one migration; needs approval)

No materialized view is needed at ≤300k rows/season. Revisit above ~1M.

1. Index `forge_served_forecast_ledger (player_id, game_id)` for drift lookups and player filters. The existing indexes are `(served_date, source)` and `(game_id)`.
2. A `security invoker` view `forge_accountability_graded_v` with the graded-row filter, variance columns and the baseline join above. It stays service-role only, like the ledger.
3. A `stable` SQL function `forge_accountability_totals(p_start date, p_end date, p_class text)` that returns per-player aggregates (games, Σproj, Σact, MAE, bias, RMSE, phantoms, baseline MAE), plus a per-day variant for the slate trend. It runs as service role from the API route only.

The public page never touches tables directly; table grants are unchanged.

## Capture change for drift (snapshot cron)

`/api/v1/db/forge-served-forecast-snapshot` (cron `30 12 * * *`) records only today's games. Change it to record checkpoints **D+0, D+1, D+3, D+6** in the same single invocation:

- The route already takes `date` and refuses started games. `buildLedgerRows` already keys by `served_date`, so a future game's row is `served_date = today`, `game_id` = the future game. No PK change.
- Load the season inputs (schedule, WGO history, runs) once, then build each checkpoint date's games from them. Don't run the whole route four times: it has a 45 s deadline per call.
- Write only the bridge sources at D+1/D+3/D+6. Naive rows stay game-day only, to hold growth to ~2×, not 4×.
- Settle already finds rows by game. Check that it settles early-checkpoint rows, whose `served_date` is before the game date.
- Drift needs ~6 days of capture before the first complete line appears.

## UI outline (`/forge/accountability`, standalone public page, not part of RSO)

Follow `pages/forge/*` styling; page max width 90%, centred. The page reads top-down: overall accuracy first, the per-player drill-down below.

**Section 1: Overall accuracy (the lead)**

- **Header copy:** what is graded and how. "Every FORGE projection the Roster Schedule Optimizer showed on game day, graded against the real result. Scored with FHFH default league points. Players who didn't dress are counted separately." Add a "Since 2026-10-22" note and a minimum-sample label while n is small.
- **Scope controls:** skater/goalie/all and a period (7d / 30d / Season). Applies to sections 1 and 2.
- **Summary tiles:** graded player-games, MAE, bias (mean projected − actual, with an over/under label), RMSE, FORGE vs baseline (paired MAE on the same player-games; "beats last-5 average by X FP/game" or "trails"), phantoms (projected but didn't dress).
- **Trend over time:** a daily MAE and bias line with a 7-day rolling mean and the baseline MAE as a reference line, split by skater and goalie. Source: the existing `forge_served_forecast_scoreboard_daily` view (MAE/bias per `served_date × source × player_class`), so no new aggregation is needed for v1. A small per-stat table (G, A, PPP, SOG, HIT, BLK; SV, GA, W, SO) shows MAE and bias per stat for the period, from the same view.
- **Calibration:** mean actual FP per projected-FP decile, against the y = x line (`scoreLedger` already computes `expectedFpDeciles`), plus a histogram of variance (projected − actual).
- **Drift summary** (once checkpoints exist): MAE at 6d / 3d / 1d / game day out. Does the projection get better as the game approaches?

**Section 2: Player drill-down**

- **Filter bar:** date range (default last 7 days; quick picks Yesterday / 7d / 30d / Season), team, position, player search, and a **Per game ↔ Totals** toggle.
- **Per-game table:** date, player, team vs opponent, projected FP, actual FP, variance (signed, coloured), |error|, baseline FP, and a row expander with per-stat projected vs actual. Rows are sortable and paged at 100.
- **Totals table:** player, games, Σprojected, Σactual, Σvariance, MAE, bias, RMSE, baseline MAE, phantoms.
- **Drift (per row, drawer):** projected FP at 6d / 3d / 1d / game day as a step line, with the actual as a dot and the checkpoint values listed. Shows "Not captured" for games before the capture change shipped.
- **Methodology footnote:** sources, the scoring weights, the dressed-only rule, and that early-checkpoint numbers are FORGE's latest run re-aimed at the game.

## API

`GET /api/v1/forge/accountability?view=overview|games|totals|drift&start&end&class&team&player&game`. `overview` returns the section 1 tiles, the daily trend, per-stat MAE/bias and calibration deciles from `forge_served_forecast_scoreboard_daily` plus one paired baseline pass, and is the most-hit, longest-cached call. The route uses `zod` validation like `scoreboard.ts` and the service-role server client, and returns aggregates and rows only. Leave out `market_lines`, `run_id` and `source_watermark`, and don't publish third-party market prices.

## Cost / Vercel impact

- **Reads:** one function per page view, cached at the CDN. Data changes once a day after the 11:00 UTC settle, so use `Cache-Control: s-maxage=3600, stale-while-revalidate=86400`. Drift drawers are the same, keyed by player and game. Expect a few hundred to low thousands of invocations a day at public traffic; each is a ≤7k-row query or one RPC.
- **Snapshot cron:** no new cron and no schedule change. One run does about 4× the build work but loads the inputs once. Check the current `durationMs` in existing cron logs before choosing the in-run design (don't call the route to measure).
- **Database:** +~110 MB/season ledger growth, one index, one view, one function.
- **Builds:** none during planning. The implementation ships as one release candidate through Chef: local checks, then one approved push. No previews.

## Delivery order

1. **Read-only page (no migration):** section 1 overall accuracy (tiles, daily trend from the existing scoreboard view, calibration, per-stat table), then the drill-down: per-game and totals within a 31-day window, with the baseline column. It reads the ledger through the new route. Tests: Vitest for variance, totals and phantom maths on fixtures; a Playwright spec on fixtures.
2. **Migration + capture (approval):** index, view and totals function; snapshot checkpoints D+1/D+3/D+6; settle check. Tests extend `servedForecastLedger.test.ts` and the snapshot tests.
3. **Drift drawer and season totals,** once ≥6 days of checkpoints exist.

## Open items (not blocking v1)

1. The ledger is young: 5 slate days at planning time. Public tiles need a minimum-sample label (e.g. "n < 500 graded games").
2. `bridge_reaimed` is rare on game day (14 rows). It becomes the majority at early checkpoints. The drift view should label re-aimed vs exact.
3. Public exposure of player-level misses: the content is FORGE's own numbers and NHL stats, so it is safe to publish. Confirm the page isn't linked from nav until the sample is meaningful.
4. `forge_served_forecast_scoreboard_daily` groups by `served_date` and doesn't know about checkpoints. Once phase 2 writes early-checkpoint rows, the overview trend has to filter to game-day rows: through the new graded view, or a `checkpoint` column. Otherwise 6-day-out projections mix into the trend. Its MAE also counts only rows where both fantasy-point values are present; check that this matches the dressed-only rule.
5. Lost run rows: 105 succeeded run dates have no player rows, and no delete path was found in `web/lib/projections/stages`. This doesn't affect the ledger-based page. Worth its own investigation if the same-day re-run history is ever wanted.
