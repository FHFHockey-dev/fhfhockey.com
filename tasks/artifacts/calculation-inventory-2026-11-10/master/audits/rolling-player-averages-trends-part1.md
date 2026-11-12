# Audit: Rolling player averages and trends, part 1 (M-ROLL-001 to M-ROLL-060)

Wave 1, pass W1-3. Audited 2026-11-10 against `octoberBranch` at `c093e8d79` plus the dirty working tree. No code was changed. Line numbers are from the current checkout. Paths are relative to the repo root.

**How this was done.** I read the live core myself: the trend calculator and its rebuild route, the skater and goalie percentile routes, the rolling writer (metric definitions, the derive loop, availability, the ratio engine, the TOI, PP-share and source contracts), the social-share trend layer and the player trend page. Two read-only research agents covered (a) every downstream reader of the two tables and (b) the legacy, sandbox and script entries; I re-read their top claims in code before using them, and the ones I did not re-read are listed in section 7.

**Database reads.** Read-only and bounded: catalog reads, the small `games` table, and rows fetched by player id and/or game date. `pg_stat_activity` showed 0 other active queries at the start and again mid-way. No NST, NHL or Yahoo calls.

**Two tables, two designs.** They share names but not methods, and most of the confusion in this family comes from that.

| | `rolling_player_game_metrics` (+ sidecar `rolling_player_metric_support_payloads`) | `player_trend_metrics` |
|---|---|---|
| Writer | `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts` | `web/lib/trends/playerTrendCalculator.ts` |
| Rates and percentages | Pooled: sum of events ÷ sum of exposure | Simple mean of per-game values |
| History | Whole stored career; windows never reset | Current season only (`web/pages/api/v1/trends/player-trends.ts:370-384`) |
| Readers | Rankings, FORGE, social share, player trend page | `/api/v1/trends/skater-power` and `goalie-power` (dashboard Hot/Cold card, trends pages) |

## 1. Summary

| Verdict | Count | Entries |
|---|---:|---|
| Sound | 32 | 011, 012, 013, 014, 015, 020, 022, 023, 024, 025, 026, 031, 032, 033, 035, 041, 044, 046–060 |
| Mis-specified | 15 | 001, 002, 003, 006, 008, 009, 017, 019, 027, 030, 034, 036, 040, 042, 045 |
| Wrong | 13 | 004, 005, 007, 010, 016, 018, 021, 028, 029, 037, 038, 039, 043 |
| Undetermined | 0 | (open sub-questions are in section 7) |

The pooled engine in the rolling writer is good. For five players I recomputed 18 season columns each from the NST and NHL source rows. Every per-60, percentage and average matched the stored value, with one systematic exception (expected SH%, below). The problems are at the edges: availability, PP share, the trend table's fallback and units, and above all **readers that misread what a column holds**.

### Top 5 findings by user impact

1. **Shots/60 is 60 times too low for every player's newest game, every day (M-ROLL-018, triage C39 confirmed and sized, P0).** When the NST rate is missing, the fallback divides shots by `toi_per_game` and multiplies by 60, but the regular-season value is seconds. The trend job runs at 12:00 UTC before NST data reaches the unified view, so the newest game always takes the fallback. On 2026-11-09 all 108 skater rows were affected (mean stored value 0.086 against about 5.5 on other days). McDavid: 4 shots in 1,474 s is 9.77 per 60; stored 0.163. His 5-game average, which the dashboard Hot/Cold card requests, reads 6.51 where 8.43 is right. Rows are repaired the next day when NST lands, so the error moves with the calendar.
2. **The rankings "results luck" index subtracts a per-60 rate from a season count (root cause M-ROLL-040, P0).** For per-60 metrics the writer stores the pooled rate under both `_avg_` and `_total_`. `web/lib/rankings/resultsLuckSources.ts:105-123` reads `goals_per_60_total_last20` as a goal count. McDavid's all-strength row for 2026-11-05: the column holds 1.39 (a rate); his real last-20 total is 11.0 goals on 8.5 ixG. For the last-20 window, "goals above expected" is computed as +0.32 against a "baseline" of +2.0, where the real last-20 figure is +2.5 and no non-overlapping baseline exists (his last 20 games reach into last season). That component's index comes out near 16 on a 0–200 scale centred on 100.
3. **The player trend page shows fractions and PDO as percentages, and three of its four quick views can never show data (M-ROLL-028, P0).** `web/pages/trends/player/[playerId].tsx:582-590` appends "%" to any `_pct` key, `ipp` and `pdo`. Expected SH% 0.167 prints as "0.2%", PP share 0.82 as "0.8%", PDO 1.09 as "1.1%". The L7, L14 and L30 views read `row[metric.key]` (`:527`), a column the page never selects and the table does not have, so they always report no sample.
4. **FORGE's "sample size" weight uses seconds per game, not seconds played (reader of M-ROLL-027, P0 for the FORGE audit to size).** `web/lib/projections/stages/skater-stage.ts:2150` passes `toi_seconds_avg_all`, a career per-game average, into `evidenceToiSeconds / (evidenceToiSeconds + 900)` (`web/lib/projections/calculators/skater-adjustments.ts:436`). The term is about 0.45 to 0.6 for everyone and does not grow with games played. A veteran's total weight tops out near 0.75, so projected TOI is permanently pulled about 25% of the way to his career per-game average.
5. **Stored availability and PP share are badly wrong, though nothing live reads them yet (M-ROLL-004, 043, 016, P1).** Availability counts preseason games as team games (a player who played all 17 games shows 81%), re-adds a new team's whole season after a trade (a twice-traded player shows 60 games out of 169 "available", 35.5%, where 64 is right), and clamps career availability to 100% for every veteran. PP share leaves out team power-play time in games where the player got none, so part-time PP players read about double (one player: 11.1% stored, about 5.6% if his team's PP time was similar in the eight games he got none).

Also worth knowing: about six weeks of stored rows from March and April 2026 are window-truncated ("season" is one game), the trend leaderboards rank each player against others' Nth game rather than as of a date, and goalie "Save %" and "GAA" trends are means of per-game ratios.

### Answers to the brief's questions

**Where do FORGE, rankings and sustainability read a per-game average as a total?**

| Reader | Location | What it reads | What it assumes |
|---|---|---|---|
| Rankings, results luck | `web/lib/rankings/resultsLuckSources.ts:105-123`, `:177-189` | `goals_per_60_total_lastN`, `ixg_per_60_total_lastN`, `shot_attempts_per_60_total_lastN` (pooled rates) | Counts, subtracted from season counts |
| Rankings, window aggregate | `web/lib/rankings/skaterWindowAggregation.ts:314-321` | Same three columns | Counts for last-N "goals above expected"; the season branch (`:304-311`) uses real counts, so one metric has two units |
| Rankings, season TOI gate | `web/lib/rankings/skaterWindowAggregation.ts:310`, `:273-274` | `toi_seconds_avg_season` (seconds per game) | Season total seconds for the 600 s sample gate on `xga_per_60` (agent-traced; I confirmed `:310` only) |
| FORGE | `web/lib/projections/stages/skater-stage.ts:2150-2151`; `web/lib/projections/reserveProjections.ts:64` | `toi_seconds_avg_all` (career seconds per game) | Total evidence seconds |
| Sustainability | `web/lib/sustainability/featureDictionary.ts:26-90` | Queries neither table. The feature dictionary names `rolling_player_game_metrics` as a primary source, but the code reads `player_stats_unified` and `wgo_skater_stats` (`windows.ts:81`, `recompute.ts:96`, `incremental.ts:162`). | A documentation mismatch for the sustainability audit, not a unit error |

FORGE is otherwise consistent on units: TOI as seconds per game, IPP as 0–100 (`skater-adjustments.ts:600`), and counts with seconds for hits and blocks.

**Are traded players' denominators right?** No. See D5. The rate and percentage columns are right for traded players, because they pool the player's own events and ice time and do not depend on team.

**Do last-N windows cross seasons on purpose?** In the current writer, yes: windows are queues that are never reset (`fetchRollingPlayerAverages.ts:2618-2637`, `rollingMetricAggregation.ts:263-304`), and the full career is always read (`:3046-3051`). McDavid's 17th game this season stores `points_total_last20 = 49`, which includes three games from 2025-26. Three things make this a trap:

- The window contract says "last N chronological appearances" and does not mention seasons (`rollingWindowContract.ts:52-85`).
- Rows written by the March 2026 rebuild were season-scoped (his first game of 2025-26 stores `points_total_last20 = 2`). Stored rows therefore carry two different meanings depending on when they were written.
- Several readers assume the window sits inside the season: `web/lib/rankings/playerMatrix.ts:660-668` divides a last-N TOI total by `min(season GP, N)`, `web/lib/socialShare/players.ts:254` labels last-5 totals with `min(5, season GP)`, and results luck subtracts the window from the season. The social-share trend layer is the one reader that guards against it (`web/lib/socialShare/trends.ts:186-190`).

`player_trend_metrics` does not cross seasons.

## 2. Column dictionary

### 2.1 `rolling_player_game_metrics`

One row per player, game date and `strength_state`. 623 columns in production.

**Strength states.** `all`; `ev` (NST even strength, which includes 4v4 and 3v3); `5v5`; `pp`; `pk`. Each reads its own NST tables. NHL (WGO) values fill gaps at `all` only, plus PP goals at `pp`.

**Scope suffixes.**

| Suffix | Meaning in the current writer |
|---|---|
| `_last3`, `_last5`, `_last10`, `_last20` | The player's last N appearances, across season boundaries. Counts: last N games that have a value. Rates and percentages: last N appearances (at split strengths, games with ice time in that state); a game with missing parts keeps its slot and adds nothing. |
| `_season` | Games in the row's season up to this date. |
| `_3ya` | This season plus the two before it. Early in a season it is mostly old data. |
| `_career` | Every game in the stored NHL game log. |
| `_all` | Every game read so far. Equal to `_career` in current rows (McDavid: `sog_per_60_all` = `sog_per_60_career` = 9.3235). In rows written by the March 2026 rebuild it was season to date. |

**Name forms.** `<metric>_total_<scope>`, `<metric>_avg_<scope>`, plain `<metric>_<scope>` (rates and percentages only), and support pairs `<metric>_<component>_<scope>` such as `sog_per_60_shots_season` and `sog_per_60_toi_seconds_season`.

**Storage.** Only a keep-list survives in the wide row (`fetchRollingPlayerAverages.ts:399-421`). Most `_avg_`, `_all`, `_last3`, `_3ya` and `_career` values are null there and live in the sidecar's `historicalCompatibility` object. A wide-only read of, say, `hits_avg_last5` gets null.

| Family | Keys | Unit and scale | Source (fallback) | Aggregation | When there is no denominator |
|---|---|---|---|---|---|
| Counts | goals, assists, points, shots, hits, blocks, primary_assists, secondary_assists | Events | NST individual counts (NHL at `all`; NHL PP goals at `pp`) | `_total_` = sum; `_avg_` = mean per game with a value | null when no game has a value |
| Counts, NST only | ixg, iscf, ihdcf, penalties_drawn, penalties_taken | Events; ixG in goals | NST individual counts | Same | null |
| PP points | pp_points | Events | `pp`: NST PP points; `all`: NHL only | Same | null |
| On-ice counts | cf, ca, ff, fa, oi_gf, oi_ga, oi_sf, oi_sa, oi_xgf, oi_xga, oz_starts, dz_starts, nz_starts | Events; xG in goals | NST on-ice counts | Same | null |
| Ice time | toi_seconds | Seconds (`_avg_` = seconds per game) | NST counts → NST on-ice → NST rates → NHL | Same; split strengths include zero-TOI games | null |
| PP ice time | pp_toi_seconds (`all`, `pp` only) | Seconds | PP builder `PPTOI` → NHL `pp_toi` | Same | null |
| Per 60 | sog, ixg, shot_attempts (NST iCF, blocked included), goals, assists, primary_assists, secondary_assists, hits, blocks, penalties_drawn, penalties_taken, each `_per_60` | Events per 60 minutes | Count ÷ TOI seconds; SOG and ixG can be rebuilt from an NST rate | Σ events ÷ Σ seconds × 3600. **`_total_` and `_avg_` both hold this rate.** | null |
| Percent, 0–100 | shooting_pct (G ÷ SOG), ipp (points ÷ on-ice GF), on_ice_sh_pct (GF ÷ SF), on_ice_sv_pct ((SA − GA) ÷ SA), cf_pct, ff_pct, oz_start_pct (OZ ÷ (OZ + DZ)) | Percent | NST | Ratio of sums | shooting_pct and ipp: **0**; the rest: null |
| Fraction, 0–1 | expected_sh_pct (ixG ÷ SOG), primary_points_pct ((G + A1) ÷ points), pp_share_pct | Fraction | NST; PP builder or NHL for share | Ratio of sums | primary_points_pct: **0**; the rest: null |
| Index | pdo | About 1.000 (on-ice SH% + SV%) ÷ 100 | NST on-ice | Sum of two pooled ratios | null |
| Availability, `all` rows | games_played, team_games_played, season_games_played, season_team_games_available, three_year_*, career_*, games_played_lastN_team_games, team_games_available_lastN, season_availability_pct, three_year_availability_pct, career_availability_pct, availability_pct_lastN_team_games, legacy gp_pct_* aliases | Games; fraction 0–1 clamped at 1 | NHL game log, `games` table | Player games ÷ team games. Last N = the current team's last N team games. | null when team games are 0 |
| Participation, split rows | season_participation_games, season_participation_pct, participation_*_lastN | Games with ice time in the state; fraction 0–1 | Same | Same | null |
| Context | line_combo_slot, line_combo_group, pp_unit; pp_share_of_team (one game, 0–1); pp_unit_usage_index (ratio near 1.0); pp_unit_relative_toi (seconds); pp_vs_unit_avg (index − 1) | As shown | Line and PP builders | Copied, not aggregated | null |

Verified scales come from `rollingMetricScaleContract.ts:31-43` and from stored rows.

### 2.2 `player_trend_metrics`

One row per player, game date and `metric_key`. `raw_value` is the game's value; `average_value` and `rolling_avg_3/5/10` are simple means of non-null game values within the current season. Units below were read from stored rows.

| Metric key | Unit as stored | Source |
|---|---|---|
| shots_per_60, ixg_per_60, iscf_per_60, ihdcf_per_60, cf_per_60, ff_per_60 | Per 60 minutes, single game | NST rates; shots and ixG have the broken fallback (D1) |
| shooting_percentage, on_ice_shooting_pct, pp_toi_pct | **Fraction 0–1** | NHL |
| expected_shooting_pct | **Percent 0–100**, ixG ÷ unblocked attempts | NST |
| ipp, cf_pct, ff_pct | Percent 0–100 | NST |
| primary_points_pct | Fraction 0–1 | Computed |
| pdo | About 1.000 | NST |
| toi, pp_toi | Seconds (regular season). Playoff `toi` is converted to minutes (D8). | NHL |
| Counts (goals, assists, hits, …) | Events | NHL / NST |
| Goalie: save_pct | Fraction 0–1, single game | NHL |
| Goalie: goals_against_avg, shots_against_per_60 | Per 60, single game | NHL |
| Goalie: time_on_ice | Seconds | NHL |
| Goalie: quality_starts_pct, complete_game_pct | 0 or 1 per game | NHL |

## 3. Hand recomputation

Season scope, all strengths, 2026-27. The 18 columns are SOG, goals, ixG, assists, shot attempts and hits per 60; shooting %, expected SH%, IPP, primary points %; on-ice SH%, on-ice SV%, PDO, CF%, OZ start %; and TOI, PP TOI and points per game. Source sums come from `nst_gamelog_as_counts`, `nst_gamelog_as_counts_oi` and `wgo_skater_stats`; "stored" is the rolling row on the date shown.

| Player | Through | Checked | Result |
|---|---|---|---|
| 8478402 (EDM), full-time PP | 11-05 | 18 columns | All match. Example: 46 shots in 24,046 s = 6.8868 per 60; IPP 44 ÷ 53 = 83.019; PDO (53 ÷ 237 + 127 ÷ 146) = 1.093492. |
| 8475167 (TBL), PP time in 8 of 16 games | 11-08 | 18 columns | 17 match, including the game with no NST row (NHL shots and TOI used; ixG and assists per 60 leave that game out of both parts). **Expected SH% stored 0.0456; pooled 0.98 ÷ 18 = 0.0544.** |
| 8475166 (TOR), 9 games | 11-08 | 18 columns | 17 match. Expected SH% stored 0.1733; pooled 0.1820. |
| 8474151 (TBL), PP time in 4 of 17 games | 11-08 | 18 columns | 17 match. Expected SH% stored 0.0833; pooled 0.0942. |
| 8475343 (VGK), 5 shots in 19 games | 11-08 | 18 columns | 17 match. Expected SH% stored 0.074; pooled 1.38 ÷ 5 = 0.276. |
| 8476967, traded EDM → PIT → COL in 2025-26 | 2026-03-06 | Availability | Stored 60 ÷ 169 = 0.355. The 169 is exactly 39 + 63 + 67, each team's ledger count (preseason included) at the end of his stint. Regular-season team games during his stints: 31 + 27 + 6 = 64. |
| Same player, PP share last 5 | 2026-02-28 | PP share | Stored 0.013876 = (7 + 3) ÷ (7 ÷ 0.058 + 3 ÷ 0.005). Only the two games with PP time count; the three without add nothing. |

The expected SH% gap has one cause: a game with ixG but no shot on goal is dropped whole (D7).

## 4. Per-entry table

"NST" means Natural Stat Trick's published definitions. "Pooled" means sum of events ÷ sum of exposure, the convention at NST, Evolving-Hockey and Hockey-Reference.

| ID | Verdict | Evidence | Reference standard | Magnitude | Downstream impact |
|---|---|---|---|---|---|
| 001 Trend running mean, variance, L3/L5/L10 | Mis-specified | `web/lib/trends/playerTrendCalculator.ts:132-158`, `:160-236`. The arithmetic is right (n − 1 variance, full windows only). Rates and percentages are averaged per game, not pooled. The lead "no season reset" does not hold: both callers pass the current season only (`web/pages/api/v1/trends/player-trends.ts:370-384`; `web/pages/api/v1/db/update-player-trend-metrics.ts:25-29`). | Pooled | McDavid through 11-05: mean of game SH% 26.6% against pooled 21.7%; PDO 1.117 against 1.093; CF% 63.2 against 63.6 | Trend leaderboards and cards. Labels say "Shooting Percentage", "PDO" |
| 002 Goalie percentile series | Mis-specified | `web/pages/api/v1/trends/goalie-power.ts:216-236`, `:238-330`, `:381`. Each goalie's Nth game is ranked against other goalies' Nth game, then everyone's latest percentile is sorted into one list. No low-sample handling. Ties get different percentiles. | None in the community; judged on internal sense | A backup's 2nd game is ranked in a pool from the season's first weeks | Dashboard goalie trend data |
| 003 Skater percentile series | Mis-specified | `web/pages/api/v1/trends/skater-power.ts:295-315`, `:336-432`, `:497`. Same game-index pools. The shrink toward 50 below 10 games (`:317-334`) is a fair guard. | Same | A player with 8 games is compared with everyone's 8th game; the list mixes pools. Inherits D1 at any window. | Hot/Cold card (`web/components/forge-dashboard/HotColdCard.tsx:179`, window 5), command centre, trends pages |
| 004 GP% and availability | **Wrong** | `web/lib/supabase/Upserts/rollingHistoricalAverages.ts:142-182`, `:184-187`, `:231-272`; `fetchRollingPlayerAverages.ts:3982-3993` | Games played ÷ team games while on the roster | Twice-traded player: 35.5% stored, about 94–97% true. Career: 811 ÷ 290, clamped to 1.000. First game after a trade: last-10 availability 0.10. | No runtime reader (`pages/trendsDebug.tsx` only). A trap for the first one. |
| 005 Shooting %, expected SH%, primary points % | **Wrong** (expected SH%) | `fetchRollingPlayerAverages.ts:1317-1328`, `:1348-1362`, `:1364-1382`; `rollingMetricAggregation.ts:246-254`, `:370-374` | NHL.com S% = G ÷ SOG. No single community formula for expected SH%. | Shooting % and primary points % match by hand. Expected SH% is low by 5% to 73% for 4 of 5 players (section 3). Triage C40 confirmed: 0–100 beside 0–1. | Player trend page. Rankings luck uses the per-60 columns instead. |
| 006 Goalie trend metric definitions | Mis-specified | `playerTrendCalculator.ts:487-614` (pass-through). Rolling "Save %" and "GAA" average per-game values. | Pooled: SV% = Σ saves ÷ Σ shots; GAA = Σ GA × 60 ÷ Σ minutes | Worked case: GAA 2.0 and 3.0 in two full starts plus 2 GA in 10 minutes of relief (12.0). Mean 5.67; pooled 3.23. | Goalie trend cards (default window 3) |
| 007 Legacy trailing average | **Wrong**, dead | `web/lib/supabase/utils/statistics.ts:178-190`: a non-finite value counts as 0 and stays in the denominator | — | Biases low | None. Only a test imports the file; quarantined at `web/lib/predictions/legacyQuarantine.ts:60-78` |
| 008 Legacy smoothstep multiplier | Mis-specified, dead | `statistics.ts:200-222`: parameter named `rollingCV`, thresholds on a weighted squared-z scale; returns 1 for NaN | — | — | None |
| 009 Legacy empirical thresholds | Mis-specified, dead | `statistics.ts:227-245`: `floor(p × n)`, so at n ≤ 10 the 90th percentile is the maximum | — | Nothing can exceed T2 in small samples | None |
| 010 Legacy sKO game classifier | **Wrong**, dead | `statistics.ts:26-170`; `web/lib/supabase/utils/constants.ts:111-136`. SD of 0 becomes 1; one stat at the ±5 cap adds at least 2.39 against T2 = 2.017; null game values become 0 | — | One capped stat alone gives "Uncharacteristic" | None |
| 011 IPP | Sound | `fetchRollingPlayerAverages.ts:1384-1395`. Points ÷ on-ice GF × 100, pooled. | NST IPP | Matches by hand for 5 players. Returns 0, not null, with no on-ice goals (D14). A point in a game with no on-ice row is dropped. | Rankings results luck (uses the count pair), trend page |
| 012 On-ice SH%, SV%, PDO | Sound | `:1527-1575` | NST: GF ÷ SF, 1 − GA ÷ SA, sum | Matches by hand. PDO stored near 1.000; parts stored 0–100. | Trend page prints PDO with "%" (D4) |
| 013 CF%, FF%, OZ start % | Sound | `:1503-1515`, `:1589-1625` | NST; OZ% excludes neutral-zone starts | Matches by hand | Rankings, trend page |
| 014 Per-60 rates | Sound | `web/lib/supabase/Upserts/rollingPlayerMetricMath.ts:3-33`; `fetchRollingPlayerAverages.ts:1175-1315`, `:1475-1501` | Pooled | Matches by hand, including games with no NST row. PP goals per 60 uses its own TOI chain (`:1148-1159`); no numeric difference found. | Rankings, FORGE, social share |
| 015 ixG source and ixG/60 | Sound | `rollingPlayerMetricMath.ts:74-141`. The NHL ixG fallback is dead: the select at `fetchRollingPlayerAverages.ts:2964-2966` has no `ixg` column. Harmless. | NST ixG | Matches by hand | Same |
| 016 PP share | **Wrong** | `rollingPlayerMetricMath.ts:35-52` (`share <= 0` returns null); `fetchRollingPlayerAverages.ts:1130-1138`, `:1517-1525` | NHL.com PP TOI share: player PP TOI ÷ team PP TOI | Share is over games with PP time only. 8475167: 11.1% stored; about 5.6% if team PP time was similar in his eight games without any (estimate). 8474151 last 5: 2.5% stored from 2 s of PP time; about 0.1% at a typical five minutes of team PP time a game (estimate). Full-time PP players are right. | Player trend page only |
| 017 PP unit usage metrics | Mis-specified | `web/lib/supabase/Upserts/powerPlayCombinationMetrics.ts:25-45`: `percentageOfPP` is the unit usage index (near 1.0), not a percentage | — | SQL view `vw_pp_unit_share_recent` divides values above 1 by 100, so 1.2 becomes 0.012 (agent-read; no code reader of the view found) | No TypeScript reader. `pp_share_of_team` is sound by construction; its accuracy against NHL PP time is open (section 7). |
| 018 Skater trend metric definitions | **Wrong** | `playerTrendCalculator.ts:244-256`, `:263-275`, `:311-322` | NHL.com and NST per 60 | D1: 108 of 108 rows on the newest date. Also two scales in one table, and "Expected Shooting %" is xG per unblocked attempt. | Hot/Cold card, command centre, trends pages |
| 019 SKO luck, sustainability composite, role | Mis-specified, dead | `web/lib/trends/utils.ts:140-213`. No importer. Comment says "higher = more luck" but `xg − goals` is positive when unlucky; maximum score is 100 − 35 × luck. | — | — | None |
| 020 Trend rolling average and streaks | Sound | `web/lib/trends/utils.ts:215-300`. Partial windows are averaged over what exists; the sandbox pre-filters non-finite values. | — | Streaks compare with a whole-season mean, a look-ahead baseline for a descriptive chart | `/trendsSandbox` only (noindex) |
| 021 Team rolling STD and last-10 | **Wrong** | `web/lib/supabase/Upserts/fetchRollingGames.js:641-692`, `:749-856`. Mean of per-game PP%, PK%, FO%. A null PP% counts as 0 (the lead's "NaN" does not hold). | Pooled | "Recent" mode restarts the season-to-date sums | Loader is dead (410 at `web/pages/api/v1/db/update-rolling-games.ts:22-36`), but views `power_rankings` and `combined_sos` still read the frozen `rolling_games` table and `web/pages/statsPlaceholder.tsx:350-357` renders it (agent-read) |
| 022 Sandbox statistics helpers | Sound (live subset) | `web/lib/trends/utils.ts:12-135`. Live: `mean`, `winsorize`, `summarizePairedCorrelation`. Dead `percentile` gives NaN at n = 1 and the lowest rank on ties. | — | — | Sandbox only. The inventory's claim that game-goal projections import these does not hold: `web/lib/gameGoalProjections/calculations.ts:3` imports its own `./utils`. |
| 023 Ratio support outputs | Sound | `fetchRollingPlayerAverages.ts:2064-2260` | — | Stored season pairs reproduce the stored rates for all 5 players | Social-share sparklines, rankings, debug page |
| 024 Social share Hot/Cold | Sound | `web/lib/socialShare/trends.ts:185-191` | No community formula; labelled "recent form" | Five games of points is noisy, but the rule is stated and guarded (10 season games, whole points) | Social share edition |
| 025 Social share rate standouts | Sound | `trends.ts:195-202`. Pooled last 5 against pooled season; gate on last-5 total seconds ≥ 3,000 | Pooled | Season baseline includes the last 5 | Same |
| 026 Social share sparklines | Sound | `trends.ts:301-333`, `:407-432`. Differences of season totals, each series checked against the stored last-5 value | — | A series that fails its check is dropped, not shown | Same |
| 027 Additive sums and means | Mis-specified | `fetchRollingPlayerAverages.ts:2618-2637`, `:2900-2920`; `rollingHistoricalAverages.ts:85-126` | — | Arithmetic is right. `_all` is career. Windows cross seasons. Count windows and rate windows on one row can cover different games. PP-row `toi_seconds_avg_*` averages in zero-PP games (8474151: 2.5 s per game). | FORGE (D3), rankings, social share |
| 028 Player trend page | **Wrong** | `web/pages/trends/player/[playerId].tsx:523-531`, `:582-590`, `:859-862`, `:894-906` | — | D4. Also: "hot" needs +8% but the streak length counts any non-negative game. | `/trends/player/[id]` |
| 029 Repair and reconciliation scripts | **Wrong** | `web/scripts/audit-team-underlying-vs-nhl.ts:288`, `:311`: page size 250, loop stops when a page has fewer than 1,000 rows, so only the first 250 games are summed. Seven of the eight scripts recompute with the library they check. | — | SF and SA deltas from that script are meaningless. The others can find stale rows, never a wrong formula. | Manual repair decisions |
| 030 Python research features | Mis-specified, dead | `web/scripts/performance_prediction.py:858-986` (agent-read) | — | — | None. Not invoked anywhere. |
| 031 Trend window constants | Sound | `web/lib/trends/skaterMetricConfig.ts:15-65`; `goalieMetricConfig.ts:15-51` | — | Window 20 is a trailing mean computed in the route (`skater-power.ts:409`) | — |
| 032 Line slot and PP unit labels | Sound | `web/lib/supabase/Upserts/rollingPlayerLineContextContract.ts:35-90` | — | Slot = position in the builder's list ÷ 3 (forwards) or 2 (defence) | Social share, rankings deployment |
| 033 Aligned count support pairs | Sound | `web/lib/rollingPlayerCountSupport.ts:33-97` | — | Sums of matched integer counts with hashes. "All" starts in 2023-24 for the player checked: his earlier NHL log rows have no game id. | FORGE (`skater-adjustments.ts:838-857`). Whether assists ÷ own goals is the right model input is a FORGE question. |
| 034 SKO inputs: IPP and SOG/60 | Mis-specified | `web/pages/api/v1/db/update-sko-stats.ts:156-201` (agent-read) | NST IPP | Formulas are right if `timeOnIce` is seconds. IPP is 0–100 beside NHL percentages stored 0–1 in the same row. | Only quarantined code reads `sko_skater_stats` |
| 035 Source precedence | Sound | `web/lib/supabase/Upserts/rollingPlayerSourceSelection.ts:46-161` | — | Documented. NST rows join to NHL rows by date alone. | All rolling metrics |
| 036 Trend surface leaders | Mis-specified | `web/lib/trends/trendsSurface.ts:173-230` (sort at `:219`). Sorted by percentile, then raw value. Each game-index pool has its own 100th percentile, so the "leaders" tie at 100 and the raw value decides. | — | — | `/trends` |
| 037 Team opponent-record SoS | **Wrong**, dead loader | `fetchRollingGames.js:479-484`, `:617-630`, `:670-672` (agent-read) | — | `std_opponent_*` is added twice per game: exactly 2× | Same frozen table as 021 |
| 038 TOI resolution | **Wrong** (small) | `web/lib/supabase/Upserts/rollingPlayerToiContract.ts:95-98` | — | NHL TOI is always seconds (1,494 rows for two players: 37 to 1,763). The "≤ 200 means minutes" branch turns a 37 s game into 2,220 s and rejects 67–200 s games. It applies only when NST has no row; 2 of 1,494 games are that short. | Per-60 rates in rare games |
| 039 Playoff TOI normalisation | **Wrong** (latent) | `playerTrendCalculator.ts:18-32` | — | D8. Playoff `toi` becomes minutes while regular-season `toi` is seconds, in one accumulator. | Trend TOI card every April to June |
| 040 `_avg_` and `_total_` aliases | Mis-specified | `fetchRollingPlayerAverages.ts:2860-2880`: for rates both names hold the pooled rate; `:2718-2752`: `gp_pct_avg_*` mirror the availability ratios | — | McDavid: `goals_per_60_total_last5` = 1.0508; `goals_total_last5` = 2 | D2. A test fixture pins the wrong reading (`web/lib/rankings/skaterWindowAggregation.test.ts:27-30`). |
| 041 Pipeline diagnostics | Sound | `web/lib/supabase/Upserts/rollingPlayerPipelineDiagnostics.ts:699-760` | — | Checks numerator ≤ denominator, so it cannot see inflated denominators (D5). Skipped on every cron profile (`web/lib/rollingPlayerOperationalPolicy.ts:19-36`). | Run summary |
| 042 Validation recompute | Mis-specified | `web/lib/supabase/Upserts/rollingPlayerValidationPayload.ts:1585-1600`: the TOI trace always passes all-strength NHL TOI. Formula text at `:513` says "sum(assists)"; the writer uses NST assists only. | — | It recomputes with the writer, so it proves freshness, not correctness | Debug page |
| 043 Team game ledger and season id | **Wrong** (ledger) | `fetchRollingPlayerAverages.ts:2928-2948` selects every game with no type filter; `:1883-1909` numbers them | Regular-season team games | D5: `games` holds preseason (type 1) and playoff (type 3) rows under the same season id. EDM through 11-05: 17 regular + 4 preseason. Season-id derivation (`:3369-3393`) is sound. | Availability |
| 044 Ratio-of-sums engine | Sound | `rollingMetricAggregation.ts:136-166`, `:263-304`, `:355-378` | Pooled | Never averages ratios; reproduces every hand value. Two notes: a zero-denominator game is dropped whole (the cause of D7), and `getHistoricalRatioComponentSnapshot` (`:415-438`) counts seasons, not games, in `count` (used only as a non-zero test). | Everything in the rolling table |
| 045 Window contracts | Mis-specified | `web/lib/supabase/Upserts/rollingWindowContract.ts:35-85`, `:127-181` | — | Silent on season boundaries. Says counts use "last N appearances" while the policy is "slot only with a value". The family map omits goals_per_60, assists_per_60 and the on-ice counts. | Readers that assume in-season windows |

**Codex-only count metrics (046–060).** All are sums and per-game means through the same accumulator (`fetchRollingPlayerAverages.ts:2618-2637`, `:2900-2920`). All sound, with the caveats of 027.

| ID | Key | Source at `all` | Fallback | Definition line |
|---|---|---|---|---|
| 046 | assists | NST `total_assists` | NHL assists | `:1633` |
| 047 | blocks | NST `shots_blocked` | NHL blocked shots | `:1651` |
| 048 | cf | NST on-ice | none | `:1577` |
| 049 | dz_starts | NST on-ice | none | `:1415` |
| 050 | ff | NST on-ice | none | `:1602` |
| 051 | goals | NST goals | NHL goals; at `pp`, NHL PP goals for every game, so PP goal windows can cover games with no PP time | `:1627` |
| 052 | hits | NST hits | NHL hits | `:1645` |
| 053 | ihdcf | NST individual `hdcf` | none | `:1403` |
| 054 | iscf | NST `iscfs` | none | `:1397` |
| 055 | ixg | NST ixG | none in practice | `:1330` |
| 056 | nz_starts | NST on-ice | none | `:1421` |
| 057 | oi_ga | NST on-ice | none | `:1433` |
| 058 | oi_gf | NST on-ice | none | `:1427` |
| 059 | oi_sa | NST on-ice | none | `:1457` |
| 060 | oi_sf | NST on-ice | none | `:1451` |

## 5. Defects

### P0: user-visible wrong numbers

**D1. Shots/60 and ixG/60 fallback divides by seconds (M-ROLL-018, 001; triage C39).**
- *Where.* `web/lib/trends/playerTrendCalculator.ts:250-255`, `:269-274`.
- *Size.* Every skater row on the newest game date: 108 of 108 on 2026-11-09, with 0 left on each of the 12 dates before it (repaired once NST arrives). Stored 2025-26 playoff rows are still 60× low (`calculation_version` null; McDavid 2026-04-30: 0.121).
- *Fix.* Treat `toi_per_game` as seconds for every row and compute `shots ÷ seconds × 3600`. Remove the playoff minutes conversion (D8) so one unit holds everywhere. Rebuild the current season and the 2025-26 playoff rows.
- *Test.* A regular-season row with 4 shots, 1,474 s and no NST rate must give 9.77. A row with both (McDavid 11-07: 3 shots, 1,515 s, NST 7.13) must agree with the fallback within 0.05. A stored-data check: no `shots_per_60` raw value between 0 and 1 exclusive.

**D2. Per-60 `_total_lastN` read as a count (M-ROLL-040; reader in the rankings packet).**
- *Where.* Written at `fetchRollingPlayerAverages.ts:2860-2880`. Read at `web/lib/rankings/resultsLuckSources.ts:105-123` and `web/lib/rankings/skaterWindowAggregation.ts:314-321`.
- *Size.* Any skater's last-N "goals above expected" is a per-60 difference, about one-eighth of the real figure over 20 games for a 23-minute player, and its baseline is a season count minus a rate. The result feeds `results_luck_index` in `skater_composite_ratings` (`web/lib/rankings/skaterCompositeWriter.ts:545-582`).
- *Fix.* Stop writing `_total_` for rate and percentage families. Store window component pairs the way season pairs are stored (`goals_per_60_goals_last20`, `…_toi_seconds_last20`) and have rankings read those. Refuse the season-minus-window baseline when season games played is below N.
- *Test.* From the McDavid 11-05 row: last-20 goals above expected must equal 11.0 − 8.5. Correct the fixture at `skaterWindowAggregation.test.ts:27-30`, which sets `goals_per_60_total_last5: 3` beside a rate of 2.4.

**D3. FORGE evidence weight reads seconds per game (reader of M-ROLL-027; FORGE packet).**
- *Where.* `web/lib/projections/stages/skater-stage.ts:2149-2173`; `web/lib/projections/calculators/skater-adjustments.ts:426-446`.
- *Size.* The TOI term is `T ÷ (T + 900)` with T about 700 to 1,300 s per game: 0.44 to 0.59 for everyone. With 58% weight on it, the total cannot pass about 0.76, and the call-up threshold of 0.22 is unreachable above 550 s per game. The pull target, `toi_seconds_avg_all`, is a career average, so a player whose role has grown is projected low.
- *Fix.* Feed total seconds (season or last three seasons). Choose the prior on purpose and label it.
- *Test.* At a fixed per-game TOI, the weight must rise with games played; a 3-game call-up must fall below the call-up threshold.

**D4. Player trend page formatting and dead quick views (M-ROLL-028).**
- *Where.* `web/pages/trends/player/[playerId].tsx:582-590`, `:523-531`, `:894-906`.
- *Size.* Every fraction-scale metric and PDO on the page. L7, L14 and L30 never show a value.
- *Fix.* Format from `ROLLING_METRIC_SCALE_CONTRACTS`: multiply fractions by 100, show PDO to three decimals with no "%". Build the calendar views from differences of season totals, or remove them. Make the streak length use the same threshold as the label.
- *Test.* A format table: 0.167 → "16.7%", 21.7 → "21.7%", 1.093 → "1.093". A quick view over a fixture must return a number.

### P1

**D5. Availability denominators (M-ROLL-004, 043).** Four separate faults.
- *Preseason and playoff games are team games.* `fetchGames` has no `type` filter. Every player is understated: 17 of 17 reads 0.81 in early November; a full 82-game season reads about 0.91.
- *A trade re-adds the new team's whole season.* `rollingHistoricalAverages.ts:173-178`: a new team bucket starts at the team's cumulative count. One trade at mid-season turns 82 into about 123, before preseason games are added.
- *Career is clamped.* NHL log rows before 2023-24 have no team abbreviation, so team games are 0 for those seasons while player games still count. McDavid: 811 ÷ 290, stored as 1.000.
- *After a trade the last-N window is the new team's last N games* (`:231-272`), so a player who has missed nothing shows 0.10.
- *Fix.* Filter the ledger to regular-season games. Count team games per stint from the player's first game with the team. Return null, never a clamp, where team games are unknown. Carry the previous stint into the last-N window.
- *Test.* The 31 + 27 + 6 fixture must give 64. A season with 4 preseason games must not change the denominator. A diagnostic that fails when `season_team_games_available` exceeds the season length.

**D6. PP share leaves out games with no PP time (M-ROLL-016).**
- *Fix.* Add team PP seconds for every game the player dressed, from a team-level value (any team-mate's builder pair, or a stored team total), not from the player's own share.
- *Test.* Five games, PP time in two: the share must use all five games' team PP seconds. Also note the NHL fallback share is rounded to three decimals, so 3 s at 0.005 implies 600 s of team PP time.

**D7. Expected SH% drops ixG from zero-shot games (M-ROLL-005, 044).**
- *Where.* `rollingMetricAggregation.ts:246-254`, `:370-374`.
- *Fix.* Let the numerator and denominator accumulate independently for this metric, or define it per unblocked attempt and say so. Pick one definition for both tables (the trend table uses ixG ÷ unblocked attempts × 100).
- *Test.* A game with 0 shots and 0.16 ixG must add 0.16 to the numerator.

**D8. Playoff TOI is minutes, regular season is seconds (M-ROLL-039).** Latent until April. A three-game average of 1,400 s, 1,450 s and 24.8 "minutes" is 958, shown by `formatClock` (`web/lib/trends/trendsSurface.ts:123-147`) as 15:58. Fix with D1. *Test:* a regular-season row followed by a playoff row must keep `toi` averages between 300 and 2,000.

**D9. Stored rows from 2026-03-08 to 2026-04-16 are window-truncated.** Written by the daily job of that period: `season_games_played` is 1 or 2, `points_total_last20` is one game's points. The player trend page loads all seasons and charts them. A skater whose last game fell in that span has one of these as his newest row. *Fix:* a bounded rebuild of those dates with owner approval, and a writer-version stamp on each row. *Test:* within a player-season, `season_games_played` must never fall.

**D10. Trend percentiles compare Nth games, not dates (M-ROLL-002, 003, 036).** *Fix:* rank each player's latest window value among players active near the snapshot date, with mid-rank ties, and give goalies the same low-sample guard as skaters. *Test:* two players with the same latest value and different games played must get the same percentile.

**D11. Trend rates are means of per-game ratios (M-ROLL-001, 006).** *Fix:* store the parts and pool (SV% from saves and shots, GAA from goals against and seconds), or relabel as "average game SV%". *Test:* the relief-appearance case in the table above.

**D12. Social share player cards read pruned columns.** `web/lib/socialShare/players.ts:255` reads `hits_avg_last5` and `blocks_avg_last5`, which are null in the wide row (confirmed on a stored row). Last-5 hits and blocks never show. `:254` labels last-5 totals with `min(5, season GP)`. *Fix:* read the sidecar or add the columns to the keep-list. *Test:* a contract test that every wide column a reader selects is in the keep-list.

**D13. Two more rankings readings (agent-traced; for the rankings audit).** The `xga_per_60` season gate takes a per-game TOI as a total (`skaterWindowAggregation.ts:310`, `:273-274`). `web/lib/rankings/playerMatrix.ts:660-668` divides a last-N total by season games when the season is shorter than N.

### P2

- **D14. Zero where the value is undefined, and two scales (triage C40).** `shooting_pct`, `ipp` and `primary_points_pct` return 0 with no denominator (`fetchRollingPlayerAverages.ts:1322`, `:1353`, `:1389`); their siblings return null. `shooting_pct` is 0–100 and `expected_sh_pct` is 0–1. Return null and pick one scale.
- **D15. NHL TOI minutes heuristic (M-ROLL-038).** Remove the minutes branch; the stored field is seconds.
- **D16. Trend table scales and label (M-ROLL-018).** `shooting_percentage` is 0–1 and `expected_shooting_pct` is 0–100 and not per shot on goal. Rename it or align it with D7.
- **D17. Names and contract text (M-ROLL-027, 045).** Say in the contract that windows cross seasons and that `_all` is career. Say that count windows and rate windows on one row may cover different games.
- **D18. `percentageOfPP` (M-ROLL-017).** Rename it, and fix or drop `vw_pp_unit_share_recent`.
- **D19. Frozen `rolling_games` (M-ROLL-021, 037).** Retire the two views and `/statsPlaceholder`, or rebuild the table from a sound loader.
- **D20. Audit scripts (M-ROLL-029).** Fix the paging in `audit-team-underlying-vs-nhl.ts`. Add at least one check that recomputes from source counts instead of calling the writer.
- **D21. Dead code (M-ROLL-007–010, 019, 030).** Delete `statistics.ts`, the unused helpers in `web/lib/trends/utils.ts` and the legacy SKO scripts, or leave them quarantined. No fix to the math is worth making.
- **D22. Validation payload (M-ROLL-042).** Pass the strength-specific TOI in the trace and correct the `assists_per_60` formula text.

## 6. Questions for the owner

1. Should last-N windows cross seasons? Today they do, and early-season L10 and L20 are partly last season.
2. Availability: is the intended denominator regular-season team games while the player was on that roster? For an injured player, should it be as of his last game (today's behaviour) or as of today?
3. Expected SH%: per shot on goal (rolling table) or per unblocked attempt (trend table)? One definition is needed.
4. PP share: confirm it should be the share of all team PP time in games the player dressed for.
5. Trend leaderboards: rank as of a date among active players, and pool the rates?
6. May the truncated March and April 2026 rows be rebuilt (a bounded write)? Do rows from earlier seasons matter to any page?
7. Is `_all` meant to be career to date? FORGE uses it as a prior.

## 7. Limits

- **Not run.** The rolling writer, the validation payload and the eight scripts all need wide database reads. I recomputed from source rows by hand instead, for five players and one traded player.
- **Small samples.** The 60× count covers 13 game dates. The NHL TOI unit check covers 1,494 rows for two players. The PP-share and expected-SH% sizes come from three to five players each.
- **Earlier writer versions.** I did not read the code that wrote the March and April 2026 rows; the truncation is inferred from stored values. I did not count how many rows or seasons are affected, because that needs a large scan. One player had no rolling rows at all for 2024-25.
- **Not traced.** Which rankings pages display `results_luck_index`; the size of the FORGE bias in projected TOI (needs a FORGE run); the unified view's SQL for `nst_hdcf_per_60` (the NST individual table's `hdcf` column is individual, so the "on-ice" lead is probably unfounded).
- **Open accuracy question.** `pp_share_of_team` divides by a simulated man-advantage clock. A repo comment records one game where that clock read 10:00 against 2:54 on NHL.com (`web/lib/socialShare/modules/lastNightsStandouts.ts:104-108`). Checking it needs NHL data I was not allowed to fetch.
- **Agent-read, not re-read by me.** `statistics.ts` details (007–010), `fetchRollingGames.js` and the SQL views (021, 037), the Python script (030), the SKO route (034), the PP builder caller (017), script tolerances (029 apart from the paging lines), and the rankings paths in D13.
- **Not part of the math, but it affects every reader.** On 2026-11-10 the rolling table had rows for 106 of 432 skaters who played on 11-07 and none of the 108 who played on 11-09. Readers that need the exact snapshot date or the newest row are working from gaps.
- **Goalie source columns.** Quality start and the other NHL goalie fields pass straight through; I did not check their definitions.
