# Audit packet: Team ratings / power / CTPI / SOS

Master entries M-TEAM-001 to M-TEAM-056 (56 of 56 in this family). Built from the merged Opus and Codex inventories; see [../MASTER.md](../MASTER.md) and [../MERGE-NOTES.md](../MERGE-NOTES.md).

How to read: each entry gives both inventories' descriptions side by side. **Conflicts** are places where the two descriptions disagree; they are unresolved. **Leads** are Opus red flags and Codex unknowns: observations to check, not audited findings. Tags are keyword heuristics. Line numbers were valid when each inventory was written on 2026-11-10 (Opus at d31dcb33f, Codex at 11e4192d3); re-check against the current checkout.

| ID | Name | Match | Conflicts | Leads |
|---|---|---|---:|---:|
| M-TEAM-001 | matview team_power_ratings_daily__new (sql/001) | Both | 0 | 4 |
| M-TEAM-002 | view nhl_team_data | Both | 0 | 3 |
| M-TEAM-003 | views nst_avg_all / nst_avg_5v5 / nst_avg_pk / nst_avg_pp | Both | 0 | 6 |
| M-TEAM-004 | view nst_league_averages | Both | 0 | 2 |
| M-TEAM-005 | view nst_att_def_scores | Both | 0 | 3 |
| M-TEAM-006 | view nst_team_scores_all_strengths | Both | 0 | 3 |
| M-TEAM-007 | view power_rankings | Both | 0 | 3 |
| M-TEAM-008 | views vw_team_strength_state_daily / vw_team_strength_state_daily_norm | Both | 0 | 2 |
| M-TEAM-009 | trigger fn update_team_discipline_stats (+ populate script) | Both | 0 | 3 |
| M-TEAM-010 | view combined_sos | Both | 0 | 3 |
| M-TEAM-011 | Team power ratings daily writer (PP/PK tiers and carry-forward) | Both | 0 | 4 |
| M-TEAM-012 | CTPI delta and spark series | Both | 0 | 2 |
| M-TEAM-013 | CTPI recent-form inputs (linear-weighted last 10 games) | Both | 0 | 5 |
| M-TEAM-014 | CTPI composite (Current Team Performance Index) and 0-100 mapping | Both | 0 | 11 |
| M-TEAM-015 | Recent Team Form v2 candidate (bounded, coverage-aware CTPI) | Both | 0 | 2 |
| M-TEAM-016 | Top Adds candidate score | Both | 0 | 2 |
| M-TEAM-017 | Legacy SQL team power ratings materialized view | Both | 0 | 3 |
| M-TEAM-018 | Team power score and matchup edge | Both | 0 | 7 |
| M-TEAM-019 | Power ratings: EWMA of team rates (half-life 10, 25-game window) | Both | 0 | 4 |
| M-TEAM-020 | Power ratings: league distribution, early-season blend, z-scores | Both | 0 | 5 |
| M-TEAM-021 | Power ratings: offense / defense / pace ratings (100 + 15z) | Both | 0 | 11 |
| M-TEAM-022 | Power ratings: finishing, goalie, danger, special, discipline ratings… | Both | 0 | 7 |
| M-TEAM-023 | Legacy power rankings store (season/L10 aggregates, ranks, SOS) | Both | 0 | 6 |
| M-TEAM-024 | Team form context: power-score trend delta and PDO variance | Both | 0 | 2 |
| M-TEAM-025 | Power ratings: PP/PK tiers (tertiles) and trend10 | Both | 0 | 5 |
| M-TEAM-026 | SOS ratings (win% of opponents; combined sosScore) | Both | 0 | 5 |
| M-TEAM-027 | Descriptive SOS contract (direct and indirect, as-known-then) | Both | 0 | 2 |
| M-TEAM-028 | Game-by-game performance score (GameByGameTimeline) | Both | 0 | 2 |
| M-TEAM-029 | Team standings chart rolling averages | Both | 0 | 3 |
| M-TEAM-030 | Team trend category percentiles (offense/defense/PP/PK by game number) | Both | 0 | 3 |
| M-TEAM-031 | Trend utilities: percentile, winsorize, pearson, regression, hot/cold… | Both | 0 | 5 |
| M-TEAM-032 | Player trend records (cumulative mean, rolling 3/5/10, variance) | Both | 0 | 47 |
| M-TEAM-033 | views nst_{all,5v5,pk,pp}_team_per_game | Opus only | 0 | 2 |
| M-TEAM-034 | views nst_{all,5v5,pk,pp}_team_differentials | Opus only | 0 | 1 |
| M-TEAM-035 | Team power card trend and matchup tone thresholds | Opus only | 0 | 1 |
| M-TEAM-036 | Underlying stats team rating bar width (70–130 window) | Opus only | 0 | 1 |
| M-TEAM-037 | Opponent record strength-of-schedule tally | Opus only | 0 | 4 |
| M-TEAM-038 | Underlying-stats landing popover component z-scores and special-teams… | Opus only | 0 | 3 |
| M-TEAM-039 | CTPI audit re-derivation (single-date reconciliation) | Opus only | 0 | 3 |
| M-TEAM-040 | CTPI forward-association test (predictive validity) | Opus only | 0 | 1 |
| M-TEAM-041 | CTPI multiseason audit: legacy vs recent-team-form v2 candidate | Opus only | 0 | 2 |
| M-TEAM-042 | Dashboard freshness thresholds and insight tone bands | Opus only | 0 | 0 |
| M-TEAM-043 | Top Adds schedule context (games and off-nights remaining) | Opus only | 0 | 1 |
| M-TEAM-044 | Power ratings: per-60 game log assembly (all and 5v5) | Opus only | 0 | 2 |
| M-TEAM-045 | Power ratings: carry-forward for teams without a game | Opus only | 0 | 0 |
| M-TEAM-046 | Legacy SOS standings loader (sosStandings.js) | Opus only | 0 | 1 |
| M-TEAM-047 | Opponent strength band (strong/average/weak tertiles) | Opus only | 0 | 0 |
| M-TEAM-048 | SOS writer: opponents' current W/L/OTL totals (past and future) | Opus only | 0 | 4 |
| M-TEAM-049 | Score-state shot share averages (GameStateAnalysis) | Opus only | 0 | 1 |
| M-TEAM-050 | Team L10 metrics and L5-vs-L10 trends (AdvancedL10Metrics) | Opus only | 0 | 1 |
| M-TEAM-051 | Team dashboard season aggregates, goalie totals and league ranks | Opus only | 0 | 2 |
| M-TEAM-052 | Team leaders BSH (blocks + shots + hits) | Opus only | 0 | 1 |
| M-TEAM-053 | Team share aggregation (CF%, xGF%, HDCF%, SCF%, SH%, SV%, PDO) | Opus only | 0 | 1 |
| M-TEAM-054 | Goalie trend confidence and volatility | Opus only | 0 | 1 |
| M-TEAM-055 | As-of rating snapshot selection | Codex only | 0 | 1 |
| M-TEAM-056 | Game and displayed-window goal differential | Codex only | 0 | 1 |

## M-TEAM-001 matview team_power_ratings_daily__new (sql/001)

- **Match:** Both; Opus TEAM-001; Codex sql-team-ewma
- **Purpose:** Daily team offense/defense/pace ratings via EWMA, shrinkage and z-scores, plus finishing/goalie/danger/special/discipline components
- **Where:** `sql/001_team_power_ratings.sql:4 (team_power_ratings_daily__new)`; `supabase/migrations/20260716112908_production_schema_baseline.sql:3086 (refresh_team_power_ratings stub: 'team_power_ratings_daily is a table now')`; `sql/001_team_power_ratings.sql:4 team_power_ratings_daily__new; :87 team_games; :94 ewma_metrics; :142 blended_metrics; :166 z_scored; :178 raw_scores; :195 ratings_raw.`
- **Tags (heuristic):** denominators: per 60, 5v5 only, all strengths; generation: legacy, current
- **Opus view (TEAM-001):**
  - Method: params lookback 25 games, half-life 10 games, mode setting team_power_mode (all\|5v5). pace = (CF60+CA60)/2. EWMA weight 0.5^(age/10) over last 25 games in season. Shrink: w = min(1, gp_to_date/10); metric = w*EWMA + (1-w)*league daily avg. z = (metric - daily league mean)/daily league stddev_samp. off_raw = 0.7 z_xGF + 0.2 z_SF + 0.1 z_GF; def_raw = 0.7(-z_xGA) + 0.2(-z_SA) + 0.1(-z_GA); ratings = 100 + 15*z-standardized raw. PP/PK tiers via percentile_cont 0.33/0.67 per date. trend = AVG(off_rating) prior 10 rows. extras (single-game, per date): finishing = GF60-xGF60, goaltending = xGA60-GA60, danger = HDCF/(HDCF+HDCA), PP xGF60, PK xGA60, discipline diff, PDO; each z per date; component rating = 100+15*z; special = 100+15*(0.20 z_pp_off + 0.20(-z_pk_def)); variance_flag if \|z_pdo\|>=1.
  - Inputs/units: per-60 and seconds; sources: nst_team_gamelogs_as_rates, nst_team_5v5, nst_team_gamelogs_pp_rates, nst_team_gamelogs_pk_rates, wgo_team_stats
  - Output scale: 100-centred, SD-15 ratings; tiers 1-3; writes: team_power_ratings_daily__new (matview, now a table in production)
  - Status: legacy/dead — repo SQL file not in a migration tree; writer route update-team-power-ratings-new returns 'DO NOT RUN'; canonical team_power_ratings_daily is written by TS
  - Consumers: web/pages/api/v1/db/update-team-power-ratings-new.ts (disabled stub)
- **Codex view (sql-team-ewma, calculation, location; Codex family 'SQL holistic team ratings'):** team_power_ratings_daily rates and off/def/pace ratings
  - Purpose: Build recency-weighted daily team ability ratings.
  - Inputs/units: NST all-strength per60 or configured5v5 counts converted with seconds; date/season and game order
  - Output scale: 25-game lookback,10-game half-life normalized exponential weights; early GP shrinkage=min(1,GP/10) toward daily league means; z-scores. off_raw=.7z(xGF60)+.2z(SF60)+.1z(GF60); defense same negative allowed; pace=(CF60+CA60)/2 z. Ratings=100+15×daily raw standardized score.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
- **Audit context:**
  - Intent (Opus): sql/001_team_power_ratings.sql inline comments ('Build NEW MV with NO DATA'); sql/refresh_example.sql
  - Intended contract (Codex sql-team-ewma): Materialized view comment calls holistic daily team power with subratings. SQL is standalone build/swap script; not evidence it ran.
  - External references: Elo/SRS-style team ratings; EWMA; empirical-Bayes shrinkage
  - Fixtures/test data: none listed
  - Tests: `web/__tests__/pages/api/v1/db/update-team-power-ratings-new.test.ts`; `{"discovered_not_run": []}`
- **Leads (not audited):**
  - (opus) extras z-scores use single-game values among only teams that played that date (tiny, noisy cross-sections)
  - (opus) special_rating weights 0.20+0.20 shrink the scale vs other components
  - (opus) in 5v5 mode toi_seconds and HD columns NULL so danger rating defaults to 100
  - (codex:sql-team-ewma) Definition exists locally; applied migration/live view shape, data freshness and runtime consumer use unknown.

## M-TEAM-002 view nhl_team_data

- **Match:** Both; Opus TEAM-002; Codex sql-team-latest-per-game
- **Purpose:** Latest-standings team per-game GF/GA plus NST season xGF/xGA/SF/SA per game
- **Where:** `supabase/migrations/20260716112908_production_schema_baseline.sql:14118 (nhl_team_data)`; `supabase/migrations/20260716112908_production_schema_baseline.sql:14118 nhl_team_data; :14206 derived CASE expressions`
- **Tags (heuristic):** denominators: per game; generation: current
- **Opus view (TEAM-002):**
  - Method: latest standings date only; GF/game = goal_for/games_played; GA/game; xGF/game = xgf/gp; xGA/game; SF/game; SA/game (0 when gp=0); passes cf_pct, sf_pct.
  - Inputs/units: season counts; sources: nhl_standings_details, nst_team_stats
  - Output scale: per-game rates; writes: —
  - Status: live — read by FORGE team-context-queries.ts
  - Consumers: web/lib/projections/queries/team-context-queries.ts (FORGE); web/scripts/audit-nhl-game-prediction-sources.ts
- **Codex view (sql-team-latest-per-game, calculation, location; Codex family 'SQL team aggregates'):** nhl_team_data goal/xG/shot per-game fields
  - Purpose: Join latest standings and NST team statistics for normalized display.
  - Inputs/units: Latest-date NHL standings totals and GP; NST team totals and GP
  - Output scale: goal_for_per_game=GF/standingsGP, goal_against_per_game=GA/standingsGP; xgf/xga/sf/sa_per_game=NST total/NST GP; zero fallback for nonpositive GP.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex sql-team-latest-per-game): SQL expressions are implementation evidence; win/point percentages and other source columns are passed through.
  - External references: none suggested
  - Fixtures/test data: `web/scripts/fixtures/native-player-offline-synthetic.json`
  - Tests: `web/lib/projections/run-forge-projections.local-attempt.test.ts`; `web/lib/rosterScheduleData/forgeDailyBridge.test.ts`; `{"discovered_not_run": []}`
- **Leads (not audited):**
  - (opus) nst_team_stats joined on team_abbreviation only (no season key) - stale/other-season rows can join
  - (opus) uses global MAX(date) of standings, not per season
  - (codex:sql-team-latest-per-game) Applied/deployed state and current consumer execution unknown; not tested or audited.

## M-TEAM-003 views nst_avg_all / nst_avg_5v5 / nst_avg_pk / nst_avg_pp

- **Match:** Both; Opus TEAM-003; Codex sql-team-baseline-5v5, sql-team-baseline-all, sql-team-baseline-pk, sql-team-baseline-pp
- **Purpose:** Team totals from NST team game rows by strength
- **Where:** `supabase/migrations/20260716112908_production_schema_baseline.sql:15206 (nst_avg_all)`; `supabase/migrations/20260716112908_production_schema_baseline.sql:15349 (nst_avg_5v5)`; `supabase/migrations/20260716112908_production_schema_baseline.sql:15446 (nst_avg_pk)`; `supabase/migrations/20260716112908_production_schema_baseline.sql:15543 (nst_avg_pp)`; `supabase/migrations/20260716112908_production_schema_baseline.sql:15349 nst_avg_5v5; supabase/migrations/20260716112908_production_schema_baseline.sql:15993 nst_5v5_team_per_game; supabase/migrations/20260716112908_production_schema_baseline.sql:15908 nst_5v5_team_differentials`; `supabase/migrations/20260716112908_production_schema_baseline.sql:15206 nst_avg_all; supabase/migrations/20260716112908_production_schema_baseline.sql:15253 nst_all_team_per_game; supabase/migrations/20260716112908_production_schema_baseline.sql:16039 nst_all_team_differentials`; `supabase/migrations/20260716112908_production_schema_baseline.sql:15446 nst_avg_pk; supabase/migrations/20260716112908_production_schema_baseline.sql:16124 nst_pk_team_per_game; supabase/migrations/20260716112908_production_schema_baseline.sql:19955 nst_pk_team_differentials`; `supabase/migrations/20260716112908_production_schema_baseline.sql:15543 nst_avg_pp; supabase/migrations/20260716112908_production_schema_baseline.sql:16170 nst_pp_team_per_game; supabase/migrations/20260716112908_production_schema_baseline.sql:20040 nst_pp_team_differentials`
- **Tags (heuristic):** denominators: per game; generation: legacy, current
- **Opus view (TEAM-003):**
  - Method: GROUP BY team: SUM(gp, toi, w, l, otl, points, cf, ca, ff, fa, sf, sa, gf, ga, xgf, xga, scf, sca, hdcf, hdca, hdsf, hdsa, hdgf, hdga ...); AVG(cf_pct, ff_pct, sf_pct, gf_pct, xgf_pct, scf_pct, hdcf_pct, hdsf_pct, hdgf_pct, sh_pct, sv_pct, pdo).
  - Inputs/units: NST team toi (unit unverified: seconds vs minutes); sources: nst_team_all, nst_team_5v5, nst_team_pk, nst_team_pp
  - Output scale: multi-season totals; avg of percents; writes: —
  - Status: unknown — only consumed by downstream nst_* team views (nst_league_averages/nst_att_def_scores used by legacy update-game-goal-projections)
  - Consumers: nst_*_team_per_game, nst_league_averages
- **Codex view (sql-team-baseline-5v5, calculation, location; Codex family 'SQL team aggregates'):** nst_avg_5v5 / nst_5v5_team_per_game / nst_5v5_team_differentials
  - Purpose: Create team accumulated, per-game and relative-to-league differential metrics.
  - Inputs/units: NST team snapshot counts, rate percentages, team GP and corresponding league averages
  - Output scale: nst_avg sums counts and averages supplied percentages/PDO; per_game divides count totals by GP; differentials compare team per-game metrics/percent fields to league means using relative percent expressions. Derived field names: gp, toi_per_game, w_per_game, l_per_game, otl_per_game, points_per_game, cf_per_game, ca_per_game, ff_per_game, fa_per_game, sf_per_game, sa_per_game, gf_per_game, ga_per_game, xgf_per_game, xga_per_game, scf_per_game, sca_per_game, hdcf_per_game, hdca_per_game, hdsf_per_game, hdsa_per_game, hdgf_per_game, hdga_per_game; toi_per_game_diff, cf_per_game_diff, ca_per_game…
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
- **Codex view (sql-team-baseline-all, calculation, location; Codex family 'SQL team aggregates'):** nst_avg_all / nst_all_team_per_game / nst_all_team_differentials
  - Purpose: Create team accumulated, per-game and relative-to-league differential metrics.
  - Inputs/units: NST team snapshot counts, rate percentages, team GP and corresponding league averages
  - Output scale: nst_avg sums counts and averages supplied percentages/PDO; per_game divides count totals by GP; differentials compare team per-game metrics/percent fields to league means using relative percent expressions. Derived field names: gp, toi_per_game, w_per_game, l_per_game, otl_per_game, points_per_game, cf_per_game, ca_per_game, ff_per_game, fa_per_game, sf_per_game, sa_per_game, gf_per_game, ga_per_game, xgf_per_game, xga_per_game, scf_per_game, sca_per_game, hdcf_per_game, hdca_per_game, hdsf_per_game, hdsa_per_game, hdgf_per_game, hdga_per_game; toi_per_game_diff, cf_per_game_diff, ca_per_game…
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
- **Codex view (sql-team-baseline-pk, calculation, location; Codex family 'SQL team aggregates'):** nst_avg_pk / nst_pk_team_per_game / nst_pk_team_differentials
  - Purpose: Create team accumulated, per-game and relative-to-league differential metrics.
  - Inputs/units: NST team snapshot counts, rate percentages, team GP and corresponding league averages
  - Output scale: nst_avg sums counts and averages supplied percentages/PDO; per_game divides count totals by GP; differentials compare team per-game metrics/percent fields to league means using relative percent expressions. Derived field names: gp, toi_per_game, w_per_game, l_per_game, otl_per_game, points_per_game, cf_per_game, ca_per_game, ff_per_game, fa_per_game, sf_per_game, sa_per_game, gf_per_game, ga_per_game, xgf_per_game, xga_per_game, scf_per_game, sca_per_game, hdcf_per_game, hdca_per_game, hdsf_per_game, hdsa_per_game, hdgf_per_game, hdga_per_game; toi_per_game_diff, cf_per_game_diff, ca_per_game…
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
- **Codex view (sql-team-baseline-pp, calculation, location; Codex family 'SQL team aggregates'):** nst_avg_pp / nst_pp_team_per_game / nst_pp_team_differentials
  - Purpose: Create team accumulated, per-game and relative-to-league differential metrics.
  - Inputs/units: NST team snapshot counts, rate percentages, team GP and corresponding league averages
  - Output scale: nst_avg sums counts and averages supplied percentages/PDO; per_game divides count totals by GP; differentials compare team per-game metrics/percent fields to league means using relative percent expressions. Derived field names: gp, toi_per_game, w_per_game, l_per_game, otl_per_game, points_per_game, cf_per_game, ca_per_game, ff_per_game, fa_per_game, sf_per_game, sa_per_game, gf_per_game, ga_per_game, xgf_per_game, xga_per_game, scf_per_game, sca_per_game, hdcf_per_game, hdca_per_game, hdsf_per_game, hdsa_per_game, hdgf_per_game, hdga_per_game; toi_per_game_diff, cf_per_game_diff, ca_per_game…
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex sql-team-baseline-5v5): View expressions define arithmetic; dates/season grouping retained in sources. No independent normalized scale contract found.
  - Intended contract (Codex sql-team-baseline-all): View expressions define arithmetic; dates/season grouping retained in sources. No independent normalized scale contract found.
  - Intended contract (Codex sql-team-baseline-pk): View expressions define arithmetic; dates/season grouping retained in sources. No independent normalized scale contract found.
  - Intended contract (Codex sql-team-baseline-pp): View expressions define arithmetic; dates/season grouping retained in sources. No independent normalized scale contract found.
  - External references: NST team percentages = sum(for)/(sum(for)+sum(against))
  - Fixtures/test data: none listed
  - Tests: `{"discovered_not_run": []}`
- **Leads (not audited):**
  - (opus) grouped by team only - no season filter, so totals span every season stored (PK team_abbreviation,date)
  - (opus) percentages are unweighted AVG of per-game percentages, not recomputed from sums
  - (codex:sql-team-baseline-5v5) Definition exists locally; applied migration/live view shape, data freshness and runtime consumer use unknown.
  - (codex:sql-team-baseline-all) Definition exists locally; applied migration/live view shape, data freshness and runtime consumer use unknown.
  - (codex:sql-team-baseline-pk) Definition exists locally; applied migration/live view shape, data freshness and runtime consumer use unknown.
  - (codex:sql-team-baseline-pp) Definition exists locally; applied migration/live view shape, data freshness and runtime consumer use unknown.

## M-TEAM-004 view nst_league_averages

- **Match:** Both; Opus TEAM-005; Codex sql-team-league-baselines
- **Purpose:** League average team totals and per-game values by strength
- **Where:** `supabase/migrations/20260716112908_production_schema_baseline.sql:15590 (nst_league_averages)`; `supabase/migrations/20260716112908_production_schema_baseline.sql:15590 nst_league_averages`
- **Tags (heuristic):** denominators: per game, 5v5 only; generation: legacy, current
- **Opus view (TEAM-005):**
  - Method: 8 UNION rows: '{pp,pk,5v5,all}_avg' = AVG over teams of totals; '{..}_per_game' = AVG(total)/AVG(gp) for counts, AVG(pct) for percentages.
  - Inputs/units: totals; sources: nst_avg_all, nst_avg_5v5, nst_avg_pk, nst_avg_pp
  - Output scale: per-game / averaged percentages; writes: —
  - Status: live? — read by web/lib/gameGoalProjections/fetchData.ts used by legacy route web/pages/api/v1/db/update-game-goal-projections (classified legacy_team_strength_goal_projection)
  - Consumers: web/lib/gameGoalProjections/fetchData.ts; nst_att_def_scores; nst_*_team_differentials
- **Codex view (sql-team-league-baselines, calculation, location; Codex family 'SQL team aggregates'):** nst_league_averages
  - Purpose: Average team aggregate rows into strength-level league baselines.
  - Inputs/units: nst_avg_pp/pk/5v5/all rows
  - Output scale: Arithmetic means of GP, TOI, W/L/OTL/points, count totals, possession/danger shares, SH/SV/PDO grouped into strength labels
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex sql-team-league-baselines): Implementation grouping and AVG functions.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `{"discovered_not_run": []}`
- **Leads (not audited):**
  - (opus) inherits multi-season totals from nst_avg_*; league sh%/sv% = mean of team means of game percentages
  - (codex:sql-team-league-baselines) Definition exists locally; applied migration/live view shape, data freshness and runtime consumer use unknown.

## M-TEAM-005 view nst_att_def_scores

- **Match:** Both; Opus TEAM-007; Codex sql-team-advantage
- **Purpose:** Team attack/defense advantage scores by strength vs league per-game averages
- **Where:** `supabase/migrations/20260716112908_production_schema_baseline.sql:16216 (nst_att_def_scores)`; `supabase/migrations/20260716112908_production_schema_baseline.sql:16216 nst_att_def_scores`
- **Tags (heuristic):** percent scale: 0-100; denominators: per game, 5v5 only; generation: legacy, current
- **Opus view (TEAM-007):**
  - Method: att_advantage_X = round(((1.0*(xgf/lg-1) + 1.0*(sh%/lg-1) + 0.75*(sf/lg-1) + 0.75*(scf/lg-1) + 0.5*(cf/lg-1) + 0.5*(ff/lg-1) + 0.25*(hdcf/lg-1) + 0.25*(hdsf/lg-1) + 0.25*(hdgf/lg-1)) / 5)*100, 3). def_advantage_X = same weights on lg/team for xga, sa, sca, fa, ca, hdca, hdsa, hdga plus 1.0*(team sv%/lg sv% - 1), /5*100, round 2. For pp, pk, all, 5v5.
  - Inputs/units: per-game; sources: nst_pp_team_per_game, nst_pk_team_per_game, nst_all_team_per_game, nst_5v5_team_per_game, nst_league_averages
  - Output scale: percent-like advantage (0 = league average); writes: —
  - Status: live? — read by legacy route web/pages/api/v1/db/update-game-goal-projections via fetchData.ts
  - Consumers: web/lib/gameGoalProjections/fetchData.ts
- **Codex view (sql-team-advantage, calculation, location; Codex family 'SQL team composites'):** nst_att_def_scores
  - Purpose: Summarize team offensive/defensive advantages versus league averages.
  - Inputs/units: Team per-game count metrics and percentages versus league averages, split all/5v5/PP/PK
  - Output scale: Simple att_score splits=team GF/game / league GF/game and def_score splits=team GA/game / league GA/game, rounded3; TOI percent deviations; advantage outputs = weighted sums of team/league−1 (offense) and league/team−1 (defensive allowed metrics), /5×100; offense rounded3, defense rounded2. Weights xG1, S/SC .75, C/F .5, high-danger .25, SH/SV1. Named aliases retained in source.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex sql-team-advantage): Code-as-contract only; weights source is SQL expression.
  - External references: Dixon-Coles / Poisson attack-defense strength ratios (team rate / league rate)
  - Fixtures/test data: none listed
  - Tests: `{"discovered_not_run": []}`
- **Leads (not audited):**
  - (opus) weights sum to 5.25 but divided by 5
  - (opus) mixes ratio-of-rates (lg/team for defense) with additive averaging; inherits multi-season nst_avg_* totals
  - (codex:sql-team-advantage) Definition exists locally; applied migration/live view shape, data freshness and runtime consumer use unknown.

## M-TEAM-006 view nst_team_scores_all_strengths

- **Match:** Both; Opus TEAM-008; Codex sql-team-weighted-differentials
- **Purpose:** Weighted offense/defense score per strength from % differentials
- **Where:** `supabase/migrations/20260716112908_production_schema_baseline.sql:21930 (nst_team_scores_all_strengths)`; `supabase/migrations/20260716112908_production_schema_baseline.sql:21930 nst_team_scores_all_strengths`
- **Tags (heuristic):** denominators: 5v5 only; generation: legacy, current
- **Opus view (TEAM-008):**
  - Method: offense = sum(diff/100 * w): cf 0.5, ff 0.5, sf 1.25, gf 2, xgf 1 (all) / 0.75 (5v5,pp,pk), scf 0.5, hdcf ... ; defense = same weights on negated ca, fa, sa, ga, xga(0.75), sca, hdca ...; per strength all/5v5/pp/pk.
  - Inputs/units: percent differences; sources: nst_all_team_differentials, nst_5v5_team_differentials, nst_pp_team_differentials, nst_pk_team_differentials
  - Output scale: weighted unbounded score; writes: —
  - Status: legacy/dead — no reader in web/ or functions/
  - Consumers: no reader found
- **Codex view (sql-team-weighted-differentials, calculation, location; Codex family 'SQL team composites'):** nst_team_scores_all_strengths
  - Purpose: Blend percent differential metrics into offense and defense scores by strength.
  - Inputs/units: nst_*_team_differentials percent outputs
  - Output scale: att_score_all/5v5/pp/pk and def_score_all/5v5/pp/pk; weighted differential/100 sums; negative signs for defensive allowed metrics; weights CF/FF .5, SF1.25, GF2, xGF .75 or all1, SC .5, danger varying .25–.5, SH/SV1. Unbounded score.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex sql-team-weighted-differentials): Implementation SQL weights and split distinctions.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `{"discovered_not_run": []}`
- **Leads (not audited):**
  - (opus) xgf weight 1.0 for all-strength but 0.75 elsewhere (inconsistent)
  - (opus) COALESCE missing diffs to 0
  - (codex:sql-team-weighted-differentials) Definition exists locally; applied migration/live view shape, data freshness and runtime consumer use unknown.

## M-TEAM-007 view power_rankings

- **Match:** Both; Opus TEAM-009; Codex sql-power-legacy
- **Purpose:** Legacy weighted team power score from averaged rolling league-to-date stats
- **Where:** `supabase/migrations/20260716112908_production_schema_baseline.sql:23554 (power_rankings)`; `supabase/migrations/20260716112908_production_schema_baseline.sql:23554 power_rankings`
- **Tags (heuristic):** denominators: per game; generation: legacy, current
- **Opus view (TEAM-009):**
  - Method: power_score = 10*AVG(ltg_point_pct) + 6*AVG(ltg_goals_for) - 4*AVG(ltg_goals_against) + 2*AVG(ltg_shots_for_per_game) - 2*AVG(ltg_shots_against_per_game) + 10*AVG(ltg_power_play_pct) - 2*AVG(ltg_penalty_kill_pct) + 4*AVG(ltg_pp_opportunities) + 1*AVG(ltg_hits) + 1*AVG(ltg_blocked_shots) + 1*AVG(ltg_pim); ordered desc.
  - Inputs/units: fractions and per-game counts mixed; sources: rolling_games, teams
  - Output scale: unbounded score; writes: —
  - Status: legacy — read only by web/pages/statsPlaceholder.tsx; loader route update-power-rankings returns 410 'DO NOT RUN'
  - Consumers: web/pages/statsPlaceholder.tsx
- **Codex view (sql-power-legacy, calculation, location; Codex family 'Legacy SQL team power'):** power_rankings.power_score
  - Purpose: Compute simple weighted ranking of team rolling metrics.
  - Inputs/units: Team-average rollingGames last-ten stats
  - Output scale: 10×pointPct +6×GF −4×GA +2×SF −2×SA +10×PP% −2×PK% +4×PP opportunities +hits+blocks+PIM; descending sort. Unbounded.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex sql-power-legacy): Exact baseline formula; no independent prose specification found.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/__tests__/pages/api/v1/db/update-power-rankings.test.ts`; `{"discovered_not_run": []}`
- **Leads (not audited):**
  - (opus) penalty-kill % is SUBTRACTED (better PK lowers score) and PIM ADDS to score
  - (opus) averages league-to-date values over all rolling_games rows (all seasons) with no season filter; magic weights mixing fractions and counts
  - (codex:sql-power-legacy) Definition exists locally; applied migration/live view shape, data freshness and runtime consumer use unknown.

## M-TEAM-008 views vw_team_strength_state_daily / vw_team_strength_state_daily_norm

- **Match:** Both; Opus TEAM-010; Codex sql-strength-rates
- **Purpose:** Per team-date per-60 rates by strength state (5v5/PP/PK)
- **Where:** `supabase/migrations/20260716112908_production_schema_baseline.sql:26567 (vw_team_strength_state_daily)`; `supabase/migrations/20260716112908_production_schema_baseline.sql:26618 (vw_team_strength_state_daily_norm)`; `supabase/migrations/20260716112908_production_schema_baseline.sql:26567 vw_team_strength_state_daily; supabase/migrations/20260716112908_production_schema_baseline.sql:26618 vw_team_strength_state_daily_norm`
- **Tags (heuristic):** denominators: per 60, 5v5 only; generation: legacy, current
- **Opus view (TEAM-010):**
  - Method: x60 = x*3600/toi for xgf, xga, cf, ca, scf, sca, hdcf, hdca, sf, sa; _norm version adds abbreviation normalization and source-table label.
  - Inputs/units: toi seconds (assumed); sources: nst_team_5v5, nst_team_pp, nst_team_pk
  - Output scale: per-60; writes: —
  - Status: legacy/dead — no reader in web/ or functions/
  - Consumers: no reader found
- **Codex view (sql-strength-rates, calculation, location; Codex family 'SQL team strength context'):** vw_team_strength_state_daily / vw_team_strength_state_daily_norm
  - Purpose: Provide per60 team strength metrics and canonical abbreviations.
  - Inputs/units: NST 5v5/PP/PK counts and TOI seconds
  - Output scale: xGF60,xGA60,CF60,CA60,SCF60,SCA60,HDCF60,HDCA60,SF60,SA60=count×3600/TOI; null0 denominator; normalized view resolves team map and latest source.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex sql-strength-rates): SQL implementation source.
  - External references: NST per-60
  - Fixtures/test data: none listed
  - Tests: `{"discovered_not_run": []}`
- **Leads (not audited):**
  - (opus) assumes nst_team_* toi in seconds (unit unverified)
  - (codex:sql-strength-rates) Definition exists locally; applied migration/live view shape, data freshness and runtime consumer use unknown.

## M-TEAM-009 trigger fn update_team_discipline_stats (+ populate script)

- **Match:** Both; Opus TEAM-011; Codex sql-team-discipline
- **Purpose:** Per team-game discipline metrics incl. opponent hits/blocks as 'taken' per 60
- **Where:** `supabase/migrations/20260716112908_production_schema_baseline.sql:5182 (update_team_discipline_stats)`; `supabase/migrations/20260716112908_production_schema_baseline.sql:37371 (trigger trigger_update_team_discipline_stats on wgo_team_stats)`; `migrations/20251126_trigger_team_discipline_stats.sql:2 (original)`; `migrations/20251126_populate_team_discipline_stats.sql:4 (one-off backfill INSERT...SELECT)`; `migrations/20251126_trigger_team_discipline_stats.sql:2 update_team_discipline_stats; supabase/migrations/20260716112908_production_schema_baseline.sql:5182 update_team_discipline_stats`
- **Tags (heuristic):** denominators: per 60, per game; generation: current
- **Opus view (TEAM-011):**
  - Method: times_shorthanded_per_60 := COALESCE(times_shorthanded_per_game, times_shorthanded); times_powerplay_per_60 := COALESCE(pp_opportunities_per_game, pp_opportunities); penalties_taken/drawn_per_60 copied; toi_shorthanded_per_game := toi_shorthanded; hits_taken_per_60 := opponent hits_per_60; shots_blocked_by_opponent_per_60 := opponent blocked_shots_per_60. Upserts both teams.
  - Inputs/units: per-game counts mixed with WGO per-60 values; sources: wgo_team_stats (self-join on game_id for opponent)
  - Output scale: mixed per-game and per-60 under per-60 names; writes: team_discipline_stats
  - Status: unknown — trigger fires on wgo_team_stats writes but no reader of team_discipline_stats found in web/ or functions/
  - Consumers: no repo reader found for team_discipline_stats
- **Codex view (sql-team-discipline, calculation, location; Codex family 'SQL opponent-derived stats'):** update_team_discipline_stats
  - Purpose: Attach opposing-team physical rates and discipline context to team-date rows.
  - Inputs/units: Paired WGO rows by game_id and unequal team_id; supplied discipline rates and opportunity totals/pergame
  - Output scale: hits_taken_per_60=opponent hits_per_60; shots_blocked_by_opponent_per_60=opponent blocks_per_60; times_shorthanded/times_powerplay fields coalesce pergame then counts; TOI short-handed passed through.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
- **Audit context:**
  - Intent (Opus): migrations/20251126_populate_team_discipline_stats.sql:1-2 'Populate team_discipline_stats ... self-join ... to get opponent metrics'
  - Intended contract (Codex sql-team-discipline): Comment explicitly says update both teams because hits taken depends on opponent row.
  - External references: NST/NHL per-60 convention (count*3600/TOI seconds)
  - Fixtures/test data: none listed
  - Tests: `{"discovered_not_run": []}`
- **Leads (not audited):**
  - (opus) columns named *_per_60 are filled with per-game counts (times_shorthanded, pp_opportunities) - unit mismatch
  - (opus) populate script comments show the per-60 conversion was left unresolved
  - (codex:sql-team-discipline) Definition exists locally; applied migration/live view shape, data freshness and runtime consumer use unknown.

## M-TEAM-010 view combined_sos

- **Match:** Both; Opus TEAM-012; Codex sql-sos-simple
- **Purpose:** Past/future strength of schedule = mean ltg_point_pct over last/next 10 rows
- **Where:** `supabase/migrations/20260716112908_production_schema_baseline.sql:7205 (combined_sos)`; `supabase/migrations/20260716112908_production_schema_baseline.sql:7205 combined_sos`
- **Tags (heuristic):** percent scale: fraction 0-1; generation: legacy, current
- **Opus view (TEAM-012):**
  - Method: past_sos = AVG(ltg_point_pct) of the team's 10 most recent rolling_games rows before CURRENT_DATE; future_sos = AVG of next 10 rows on/after CURRENT_DATE; COALESCE 0.
  - Inputs/units: point% fraction; sources: teams, rolling_games
  - Output scale: point% fraction 0-1; writes: —
  - Status: legacy/dead — no reader in web/ or functions/; rolling_games loader web/lib/supabase/Upserts/fetchRollingGames.js is legacy
  - Consumers: no repo reader found
- **Codex view (sql-sos-simple, calculation, location; Codex family 'Legacy SQL SoS'):** combined_sos.past_sos / future_sos
  - Purpose: Summarize opponent strength over previous/next ten games.
  - Inputs/units: teams and scheduled games joined opponent rollingGames.ltg_point_pct
  - Output scale: AVG selected opponent point-pct over last/next10 games; missing mean coalesces0.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex sql-sos-simple): SQL implementation uses last10/next10, not two-hop method.
  - External references: SOS = mean opponent points% (opponent's, not own)
  - Fixtures/test data: none listed
  - Tests: `{"discovered_not_run": []}`
- **Leads (not audited):**
  - (opus) filters rolling_games by rg.team_id = t.id, i.e. the team's own rows; unless ltg_point_pct stores the OPPONENT's league-to-date point% this is the team's own form, not schedule strength
  - (opus) CURRENT_DATE anchor; missing data becomes 0
  - (codex:sql-sos-simple) Definition exists locally; applied migration/live view shape, data freshness and runtime consumer use unknown.

## M-TEAM-011 Team power ratings daily writer (PP/PK tiers and carry-forward)

- **Match:** Both; Opus TEAM-015; Codex core-339
- **Purpose:** Orchestrate daily team power ratings and add special-teams tiers; carry forward the last rating for teams without fresh games.
- **Where:** `web/pages/api/v1/db/update-team-power-ratings.ts:69 (handler)`; `web/pages/api/v1/db/update-team-power-ratings.ts:281 (getPercentile)`; `web/pages/api/v1/db/update-team-power-ratings.ts:292 (getTier)`; `web/pages/api/v1/db/update-team-power-ratings.ts:292 getTier`
- **Tags (heuristic):** generation: legacy, current
- **Opus view (TEAM-015):**
  - Method: Delegates EWMA -> league metrics -> z-scores -> raw scores -> distribution -> final rating to lib/power-ratings. Inline: PP and PK tiers from nearest-rank percentiles p33/p67 over teams (index floor(n*p)); tier 1 if >= p67, 2 if >= p33, else 3; missing value -> tier 3. Teams with no new games copy their latest rating fields (off/def/pace/xgf60/... ) forward. trend10 from lib/teamRatingsTrend overrides or prior row.
  - Inputs/units: PP%/PK% as stored by WGO (fraction or percent not verified); sources: team_power_ratings_daily, WGO team stats via lib/power-ratings fetchWgoStats, team game logs via fetchGameLogs
  - Output scale: tiers 1-3; ratings per lib; writes: team_power_ratings_daily
  - Status: live — route ledger calls=2; canonical writer (update-team-power-ratings-new is a quarantined stub)
  - Consumers: web/lib/underlying-stats/teamLandingRatings.ts; web/lib/game-predictions/featureBuilder.ts; web/components/TeamScheduleCalendar/TeamScheduleCalendar.tsx; start-chart (via lib/teamRatingsService xga60)
- **Codex view (core-339, calculation, location; Codex family 'team power'):** PP/PK percentile tiers
  - Formula: Order-statistic cuts at floor(.33*N), floor(.67*N); >=p67 tier 1; >=p33 tier 2; else 3; missing 3.
  - Purpose: Calculate pp/pk percentile tiers.
  - Inputs/units: Available team PP% and PK% cross-section.
  - Output scale: Tier 1, 2, 3 (higher percentage better).
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f.  Deployment not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final status check.
- **Audit context:**
  - Intent (Opus): Comment at update-team-power-ratings.ts:160 (shared trend lookback keeps last played-game snapshots in offseason); version constant line 29
  - Intended contract (Codex core-339): Source types and implementation in web/pages/api/v1/db/update-team-power-ratings.ts:292; separate acceptance not verified.
  - External references: Tercile tiering; EWMA/z-score composite (see lib/power-ratings audit)
  - Fixtures/test data: none listed
  - Tests: `Located only; not run for this inventory.`; `web/__tests__/pages/api/v1/db/update-team-power-ratings.test.ts`
- **Leads (not audited):**
  - (opus) a missing PP/PK% assigns the WORST tier (3) instead of unknown
  - (opus) carried-forward rows keep the old source_through_date but get the new date, so stale ratings look current by date
  - (opus) PK percentile uses higher = better which is right for PK%, but both tiers use season-to-date WGO, not the EWMA window used for the rating
  - (codex:core-339) ["Inventory only; no correctness verdict."]

## M-TEAM-012 CTPI delta and spark series

- **Match:** Both; Opus TEAM-021; Codex core-349, core-350
- **Purpose:** CTPI change over the displayed window.
- **Where:** `web/lib/dashboard/teamContext.ts:42 (computeCtpiDelta)`; `web/pages/api/v1/trends/team-ctpi.ts:148-150 (sparkSeries last 10)`; `web/lib/dashboard/teamContext.ts:34 computeTeamPowerScore`; `web/lib/dashboard/teamContext.ts:52 buildSlateMatchupEdgeMap`; `web/lib/dashboard/teamContext.ts:72 getGamePowerEdge`; `web/lib/dashboard/teamContext.ts:42 computeCtpiDelta`
- **Tags (heuristic):** generation: legacy
- **Opus view (TEAM-021):**
  - Method: delta = last - first of last 10 stored ctpi_0_to_100 values.
  - Inputs/units: CTPI; sources: —
  - Output scale: CTPI points; writes: —
  - Status: flagged off — writer /api/v1/db/update-team-ctpi-daily runs, but every row is publicationStatus 'legacy_unapproved' (ctpi.ts:310) and readers (team-ctpi API, game predictions) accept only 'approved' rows
  - Consumers: FORGE dashboard
- **Codex view (core-349, calculation, location; Codex family 'team power'):** Dashboard team power and matchup edge
  - Formula: Mean of offense, defense and pace, null rating treated as zero, plus 1.5*(3-PP tier) + 1.5*(3-PK tier). Invalid tier defaults to 2. Edge is the difference of these scores.
  - Purpose: Provide dashboard team power and matchup edge for the identified consumer.
  - Inputs/units: Offense, defense and pace ratings; PP/PK tiers 1–3.
  - Output scale: Rating points and home-minus-away or team-minus-opponent edge.
  - Version/status: Local working tree on octoberBranch, read on 2026-11-10. HEAD changed during the inventory from d31dcb33f72d4c9d69b507874c388f0cd549fe2f to 11e4192d36ecc4ac4b338f9ab48e529c7049c618. This is a non-atomic local scan; deployment and persisted-data state are not verified. Referenced implementation files had no tracked/untracked status entry at the final status check.
- **Codex view (core-350, calculation, location; Codex family 'team power'):** Dashboard CTPI sparkline change
  - Formula: Last sparkline value minus first value.
  - Purpose: Provide dashboard CTPI sparkline change for the identified consumer.
  - Inputs/units: First and last sparkline values; current CTPI fallback.
  - Output scale: Signed rating-point change or null with fewer than two points.
  - Version/status: Local working tree on octoberBranch, read on 2026-11-10. HEAD changed during the inventory from d31dcb33f72d4c9d69b507874c388f0cd549fe2f to 11e4192d36ecc4ac4b338f9ab48e529c7049c618. This is a non-atomic local scan; deployment and persisted-data state are not verified. Referenced implementation files had no tracked/untracked status entry at the final status check.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex core-349): Function signature and comments at web/lib/dashboard/teamContext.ts:34 computeTeamPowerScore; independent product specification not verified.
  - Intended contract (Codex core-350): Function signature and comments at web/lib/dashboard/teamContext.ts:42 computeCtpiDelta; independent product specification not verified.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `Located only; not run for this inventory.`; `web/__tests__/pages/api/v1/db/update-team-ctpi-daily.test.ts`; `web/__tests__/pages/api/v1/trends/team-ctpi.test.ts`; `web/lib/dashboard/teamContext.test.ts`; `web/lib/trends/ctpi.test.ts`
- **Leads (not audited):**
  - (codex:core-349) ["Calculation inventory only; no correctness or model-quality verdict."]
  - (codex:core-350) ["Calculation inventory only; no correctness or model-quality verdict."]

## M-TEAM-013 CTPI recent-form inputs (linear-weighted last 10 games)

- **Match:** Both; Opus TEAM-022; Codex core-137
- **Purpose:** Per-team recent metrics feeding CTPI.
- **Where:** `web/lib/trends/ctpi.ts:121 (buildLinearWeights)`; `web/lib/trends/ctpi.ts:110 (wma)`; `web/lib/trends/ctpi.ts:131 (computeTrendMetricsWithSourceGrain)`; `web/lib/trends/ctpi.ts:230 (computeTrendMetrics)`; `web/lib/trends/ctpi.ts:230 computeTrendMetrics`
- **Tags (heuristic):** denominators: per 60, per game; generation: legacy
- **Opus view (TEAM-022):**
  - Method: Only gp=1 rows; last 10 games weights 1.0, 0.9, ..., 0.1 (newest first); weighted mean of per-60 values; PP xGF/60 and PK xGA/60 = weighted mean of per-game (x/toi*3600); GSAx/60 season = sum(xGA-GA)*3600/sum(toi) over all fetched rows; GSAx/60 last10 weighted; PDO weighted, scaled x100 if < 2.
  - Inputs/units: per 60; seconds; sources: nst_team_gamelogs_as_rates, nst_team_gamelogs_as_counts, nst_team_gamelogs_pp_counts, nst_team_gamelogs_pk_counts
  - Output scale: per 60; PDO ~100; writes: —
  - Status: flagged off — writer /api/v1/db/update-team-ctpi-daily runs, but every row is publicationStatus 'legacy_unapproved' (ctpi.ts:310) and readers (team-ctpi API, game predictions) accept only 'approved' rows
  - Consumers: computeCtpi
- **Codex view (core-137, calculation, location; Codex family 'CTPI'):** Recent team weighted rates and season GSAx
  - Formula: Latest 10 linear weights 1, .9, ..., .1; PPxGF60=3600*PPxGF/PP seconds; PK analogue; seasonGSAx60=3600*sum(xGA-GA)/sum(TOI).
  - Purpose: Calculate recent team weighted rates and season gsax.
  - Inputs/units: GP=1 rows, per 60 rates, total xGA/GA, TOI seconds, PDO.
  - Output scale: Recent offense/defense/PP/PK rates, season and recent GSAx60, PDO.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f. ctpi-formula-v1; ctpi-one-game-input-v2; function returns legacy_unapproved publication status. Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracke…
- **Audit context:**
  - Intent (Opus): CTPI should track/predict next-N goal and xG differential (web/scripts/audit-ctpi-formula.ts:352-409 correlates CTPI with next{N}GoalDifferential); reviews in tasks/artifacts/ctpi-independent-review-2026-10-22
  - Intended contract (Codex core-137): Source types and implementation in web/lib/trends/ctpi.ts:230; separate acceptance not verified.
  - External references: Linearly weighted moving average
  - Fixtures/test data: none listed
  - Tests: `Located only; not run for this inventory.`; `web/__tests__/pages/api/v1/db/update-team-ctpi-daily.test.ts`; `web/__tests__/pages/api/v1/trends/team-ctpi.test.ts`; `web/lib/trends/ctpi.test.ts`
- **Leads (not audited):**
  - (opus) wma returns 0 when no valid values, so missing data becomes 0 per 60 and a very negative z
  - (opus) ratio metrics averaged per game (mean of ratios), not ratio of sums
  - (opus) 'GSAx' is team xGA - GA, not goalie-attributed
  - (opus) _weightDecay parameter ignored
  - (codex:core-137) ["Inventory only, not validation of the formula, source semantics or model quality."]

## M-TEAM-014 CTPI composite (Current Team Performance Index) and 0-100 mapping

- **Match:** Both; Opus TEAM-023; Codex core-138, core-139, core-140, core-141, core-142, core-143, core-144
- **Purpose:** Team recent-form index.
- **Where:** `web/lib/trends/ctpi.ts:246 (computeCtpi)`; `web/pages/api/v1/db/update-team-ctpi-daily.ts:288-320`; `web/lib/trends/ctpi.ts:239 computeLegacyTrendMetricsForAuditOnly`; `web/lib/trends/ctpi.ts:246 computeCtpi`
- **Tags (heuristic):** percent scale: 0-100; generation: legacy, current
- **Opus view (TEAM-023):**
  - Method: z vs league (population SD) per metric; offense = 0.5 z_xGF + 0.3 z_HDCF + 0.2 z_GF; defense = -(0.5 z_xGA + 0.3 z_HDCA + 0.2 z_CA); specialTeams = 0.55 z_PPxGF - 0.45 z_PKxGA; goaltending = 0.4 z_GSAxSeason + 0.6 z_GSAxLast10; luck = z_PDO; raw = 0.35 off + 0.30 def + 0.20 goal + 0.15 ST + 0.10 luck; ctpi_0_to_100 = 50 + 15*raw. Computed daily for each date in season with games <= date.
  - Inputs/units: z-scores; sources: —
  - Output scale: nominal 0-100 (unbounded), center 50; writes: team_ctpi_daily
  - Status: flagged off — writer /api/v1/db/update-team-ctpi-daily runs, but every row is publicationStatus 'legacy_unapproved' (ctpi.ts:310) and readers (team-ctpi API, game predictions) accept only 'approved' rows
  - Consumers: /api/v1/trends/team-ctpi (approved rows only); game prediction homeMinusAwayCtpi (approved only); dashboard computeCtpiDelta
- **Codex view (core-138, calculation, codex_part_of_opus; Codex family 'CTPI'):** Legacy mixed-grain trend reproduction
  - Formula: Same weighting without GP=1 filter.
  - Purpose: Calculate legacy mixed-grain trend reproduction.
  - Inputs/units: Historical mixed-grain rows.
  - Output scale: Same metric vector as CTPI inputs.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f. Explicit read-only legacy reproduction, not approved current input contract. Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at t…
- **Codex view (core-139, calculation, codex_part_of_opus; Codex family 'CTPI'):** CTPI offense
  - Formula: .5*zXGF+.3*zHDCF+.2*zGF.
  - Purpose: Calculate ctpi offense.
  - Inputs/units: Cross-team standardized recent metrics; population SD.
  - Output scale: Raw unbounded; composite display centered 50, scale 15, not clamped.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f. ctpi-formula-v1; ctpi-one-game-input-v2; function returns legacy_unapproved publication status. Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracke…
- **Codex view (core-140, calculation, codex_part_of_opus; Codex family 'CTPI'):** CTPI defense
  - Formula: -.5*zXGA-.3*zHDCA-.2*zCA.
  - Purpose: Calculate ctpi defense.
  - Inputs/units: Cross-team standardized recent metrics; population SD.
  - Output scale: Raw unbounded; composite display centered 50, scale 15, not clamped.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f. ctpi-formula-v1; ctpi-one-game-input-v2; function returns legacy_unapproved publication status. Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracke…
- **Codex view (core-141, calculation, codex_part_of_opus; Codex family 'CTPI'):** CTPI special teams
  - Formula: .55*zPPxGF-.45*zPKxGA.
  - Purpose: Calculate ctpi special teams.
  - Inputs/units: Cross-team standardized recent metrics; population SD.
  - Output scale: Raw unbounded; composite display centered 50, scale 15, not clamped.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f. ctpi-formula-v1; ctpi-one-game-input-v2; function returns legacy_unapproved publication status. Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracke…
- **Codex view (core-142, calculation, codex_part_of_opus; Codex family 'CTPI'):** CTPI goaltending
  - Formula: .4*zSeasonGSAx+.6*zLast10GSAx.
  - Purpose: Calculate ctpi goaltending.
  - Inputs/units: Cross-team standardized recent metrics; population SD.
  - Output scale: Raw unbounded; composite display centered 50, scale 15, not clamped.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f. ctpi-formula-v1; ctpi-one-game-input-v2; function returns legacy_unapproved publication status. Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracke…
- **Codex view (core-143, calculation, codex_part_of_opus; Codex family 'CTPI'):** CTPI luck context
  - Formula: PDO cross-team z.
  - Purpose: Calculate ctpi luck context.
  - Inputs/units: Cross-team standardized recent metrics; population SD.
  - Output scale: Raw unbounded; composite display centered 50, scale 15, not clamped.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f. ctpi-formula-v1; ctpi-one-game-input-v2; function returns legacy_unapproved publication status. Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracke…
- **Codex view (core-144, calculation, location; Codex family 'CTPI'):** CTPI composite
  - Formula: .35*off+.30*def+.20*goalie+.15*special+.10*luck; display=50+15*raw.
  - Purpose: Calculate ctpi composite.
  - Inputs/units: Cross-team standardized recent metrics; population SD.
  - Output scale: Raw unbounded; composite display centered 50, scale 15, not clamped.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f. ctpi-formula-v1; ctpi-one-game-input-v2; function returns legacy_unapproved publication status. Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracke…
- **Audit context:**
  - Intent (Opus): CTPI should track/predict next-N goal and xG differential (web/scripts/audit-ctpi-formula.ts:352-409 correlates CTPI with next{N}GoalDifferential); reviews in tasks/artifacts/ctpi-independent-review-2026-10-22
  - Intended contract (Codex core-138): Source types and implementation in web/lib/trends/ctpi.ts:239; separate acceptance not verified.
  - Intended contract (Codex core-139): Source types and implementation in web/lib/trends/ctpi.ts:246; separate acceptance not verified.
  - Intended contract (Codex core-140): Source types and implementation in web/lib/trends/ctpi.ts:246; separate acceptance not verified.
  - Intended contract (Codex core-141): Source types and implementation in web/lib/trends/ctpi.ts:246; separate acceptance not verified.
  - Intended contract (Codex core-142): Source types and implementation in web/lib/trends/ctpi.ts:246; separate acceptance not verified.
  - Intended contract (Codex core-143): Source types and implementation in web/lib/trends/ctpi.ts:246; separate acceptance not verified.
  - Intended contract (Codex core-144): Source types and implementation in web/lib/trends/ctpi.ts:246; separate acceptance not verified.
  - External references: Composite power indices; PDO regresses to 1.000 (should not be rewarded)
  - Fixtures/test data: `tasks/artifacts/ctpi-duplicate-upsert-audit-2026-10-22`; `tasks/artifacts/ctpi-independent-review-2026-10-22`
  - Tests: `Located only; not run for this inventory.`; `web/__tests__/pages/api/v1/db/update-team-ctpi-daily.test.ts`; `web/__tests__/pages/api/v1/trends/team-ctpi.test.ts`; `web/lib/trends/ctpi.test.ts`
- **Leads (not audited):**
  - (opus) weights sum to 1.10
  - (opus) PDO 'luck' ADDS to the index although high PDO is unsustainable
  - (opus) '0-100' is unbounded (50 + 15*raw)
  - (opus) always written as legacy_unapproved, so public and model consumers drop every row
  - (codex:core-138) ["Inventory only, not validation of the formula, source semantics or model quality."]
  - (codex:core-139) ["Inventory only, not validation of the formula, source semantics or model quality."]
  - (codex:core-140) ["Inventory only, not validation of the formula, source semantics or model quality."]
  - (codex:core-141) ["Inventory only, not validation of the formula, source semantics or model quality."]
  - (codex:core-142) ["Inventory only, not validation of the formula, source semantics or model quality."]
  - (codex:core-143) ["Inventory only, not validation of the formula, source semantics or model quality."]
  - (codex:core-144) ["Inventory only, not validation of the formula, source semantics or model quality."]

## M-TEAM-015 Recent Team Form v2 candidate (bounded, coverage-aware CTPI)

- **Match:** Both; Opus TEAM-024; Codex core-145, core-146
- **Purpose:** Candidate replacement for CTPI without luck and with confidence.
- **Where:** `web/lib/trends/recentTeamFormV2.ts:171 (computeRecentTeamFormCandidateMetrics)`; `web/lib/trends/recentTeamFormV2.ts:334 (computeRecentTeamFormCandidateV2)`; `web/lib/trends/recentTeamFormV2.ts:165 (effectiveSampleSize)`; `web/lib/trends/recentTeamFormV2.ts:320 (boundedScore)`; `web/lib/trends/recentTeamFormV2.ts:171 computeRecentTeamFormCandidateMetrics`; `web/lib/trends/recentTeamFormV2.ts:334 computeRecentTeamFormCandidateV2`
- **Tags (heuristic):** percent scale: 0-100; denominators: per 60; generation: development
- **Opus view (TEAM-024):**
  - Method: Same linear weights and component weights (0.35/0.30/0.20/0.15) with coverage-renormalized combine; PDO excluded (context only); null z if < 2 teams; raw requires component weight coverage >= 0.65 and >= 5 recent games; score = 100/(1+exp(-0.6*raw)); confidence = min(1, games/10) * metric weight coverage (high >= 0.9, medium >= 0.65); ESS = (sum w)^2/sum w^2.
  - Inputs/units: per 60; sources: —
  - Output scale: 0-100 bounded; writes: —
  - Status: draft — candidate, only scripts/tests
  - Consumers: scripts/audit-ctpi-*.ts; materialization helpers
- **Codex view (core-145, calculation, location; Codex family 'recent team form candidate'):** Candidate weighted metrics and effective sample size
  - Formula: Metric-specific weighted means/ratios; effectiveN=(sum w)^2/sum(w²).
  - Purpose: Calculate candidate weighted metrics and effective sample size.
  - Inputs/units: Verified game rows and counts/exposures.
  - Output scale: Recent metric means/pooled rates, coverage, effective sample size.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f. Recent team form V2 candidate formula/input constants; candidate status, not assumed promoted. Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked…
- **Codex view (core-146, calculation, location; Codex family 'recent team form candidate'):** Missing-aware bounded form score and confidence
  - Formula: Same offense/defense/goalie/special component weights as CTPI; omit missing and renormalize; component coverage>=.65 and>=5 games required; confidence=min(games/10, 1)*metricWeightCoverage; boundedScore helper. boundedScore=100/(1+exp(-.6*raw)); confidence tiers high>=.9, medium>=.65.
  - Purpose: Calculate missing-aware bounded form score and confidence.
  - Inputs/units: Observed candidate metrics across teams.
  - Output scale: Bounded score, raw components, coverage/confidence, status, PDO context.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f. Recent team form V2 candidate formula/input constants; candidate status, not assumed promoted. Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked…
- **Audit context:**
  - Intent (Opus): CTPI should track/predict next-N goal and xG differential (web/scripts/audit-ctpi-formula.ts:352-409 correlates CTPI with next{N}GoalDifferential); reviews in tasks/artifacts/ctpi-independent-review-2026-10-22
  - Intended contract (Codex core-145): Source types and implementation in web/lib/trends/recentTeamFormV2.ts:171; separate acceptance not verified.
  - Intended contract (Codex core-146): Source types and implementation in web/lib/trends/recentTeamFormV2.ts:334; separate acceptance not verified.
  - External references: Kish effective sample size; logistic squashing
  - Fixtures/test data: none listed
  - Tests: `No directly named test located; tests not run.`; `web/__tests__/pages/api/v1/db/update-team-ctpi-daily.test.ts`; `web/__tests__/pages/api/v1/trends/team-ctpi.test.ts`; `web/lib/trends/ctpi.test.ts`
- **Leads (not audited):**
  - (codex:core-145) ["Inventory only, not validation of the formula, source semantics or model quality."]
  - (codex:core-146) ["Inventory only, not validation of the formula, source semantics or model quality."]

## M-TEAM-016 Top Adds candidate score

- **Match:** Both; Opus TEAM-026; Codex MISC-TOPADDS
- **Purpose:** Ranks waiver adds on the FORGE dashboard.
- **Where:** `web/lib/dashboard/topAddsRanking.ts:64 (scoreTopAddsCandidate)`; `web/lib/dashboard/topAddsRanking.ts:98 (rankTopAddsCandidates)`; `web/lib/dashboard/topAddsRanking.ts:64 scoreTopAddsCandidate`
- **Tags (heuristic):** denominators: shots on goal; generation: current
- **Opus view (TEAM-026):**
  - Method: total = 5*delta + 8*(100-own)/100 + (2.25*proj + 0.85*PPP + 0.35*SOG + 0.12*(HIT+BLK)) + [week mode: 1.5*gamesRemaining + 1.25*offNights] - 1.5*uncertainty; tie-break delta, lower ownership, projection.
  - Inputs/units: percent 0-100; projected counts; sources: —
  - Output scale: unbounded score; writes: —
  - Status: live — FORGE dashboard
  - Consumers: TopAddsRail; TopAddsWatchlist
- **Codex view (MISC-TOPADDS, calculation, location; Codex family 'Other product calculations'):** Top Adds opportunity ranking
  - Purpose: Rank waiver candidates using ownership momentum and projection support.
  - Inputs/units: Ownership/delta percentage points; projected points, PPP/SOG/hits/blocks; remaining/off-night games; uncertainty.
  - Output scale: Unbounded heuristic total and five components, rounded 2dp.
  - Version/status: day/week modes. Production deployment/active database state not checked.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex MISC-TOPADDS): 5*delta+8*(100−ownership)/100+2.25*points+.85*PPP+.35*SOG+.12*(hits+blocks)+weekly schedule−1.5*uncertainty.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/components/forge-dashboard/TopAddsRail.test.tsx`; `web/lib/dashboard/topAddsRanking.test.ts`
- **Leads (not audited):**
  - (opus) projection counts and ownership delta on unrelated scales with hand-set weights
  - (codex:MISC-TOPADDS) No mathematical accuracy or fitness assessment performed. Tests listed, not run.

## M-TEAM-017 Legacy SQL team power ratings materialized view

- **Match:** Both; Opus TEAM-028; Codex sql-team-ewma, sql-team-rating-extras
- **Purpose:** Earlier SQL implementation of the same rating pipeline.
- **Where:** `sql/001_team_power_ratings.sql:4 (team_power_ratings_daily__new)`; `sql/001_team_power_ratings.sql:94-120 (ewma)`; `sql/001_team_power_ratings.sql:155-202 (blend, z, ratings)`; `sql/001_team_power_ratings.sql:278-281 (pp/pk percentile_cont)`; `sql/001_team_power_ratings.sql:364-367 (trend10)`; `sql/001_team_power_ratings.sql:385-430 (extras)`; `sql/001_team_power_ratings.sql:4 team_power_ratings_daily__new; :87 team_games; :94 ewma_metrics; :142 blended_metrics; :166 z_scored; :178 raw_scores; :195 ratings_raw.`; `sql/001_team_power_ratings.sql:275 wgo_percentiles; :285 wgo_tiers; :361 with_trend; :383 extras; :400 extras_z; :429 components.`
- **Tags (heuristic):** denominators: per 60, 5v5 only, all strengths; generation: legacy, current
- **Opus view (TEAM-028):**
  - Method: Same 0.5^(rn/10) EWMA but over ALL prior games in season (no 25-game cap), one data mode (team_power_mode setting), season-partitioned gp_to_date; z/raw/100+15 identical; tiers via percentile_cont 0.33/0.67; trend10 = off - avg(prev 10 rows); extras z-scores from SINGLE-GAME values per date (not EWMA); COALESCE ratings to 100.
  - Inputs/units: per 60; sources: —
  - Output scale: rating ~100; writes: team_power_ratings_daily (matview swap)
  - Status: legacy/dead — replaced by TS writer; update-team-power-ratings-new is a 'DO NOT RUN' stub
  - Consumers: superseded by TS writer
- **Codex view (sql-team-ewma, calculation, location; Codex family 'SQL holistic team ratings'):** team_power_ratings_daily rates and off/def/pace ratings
  - Purpose: Build recency-weighted daily team ability ratings.
  - Inputs/units: NST all-strength per60 or configured5v5 counts converted with seconds; date/season and game order
  - Output scale: 25-game lookback,10-game half-life normalized exponential weights; early GP shrinkage=min(1,GP/10) toward daily league means; z-scores. off_raw=.7z(xGF60)+.2z(SF60)+.1z(GF60); defense same negative allowed; pace=(CF60+CA60)/2 z. Ratings=100+15×daily raw standardized score.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
- **Codex view (sql-team-rating-extras, calculation, location; Codex family 'SQL holistic team ratings'):** Finishing/goaltending/danger/special/discipline ratings, tiers, trend10, variance_flag
  - Purpose: Expose interpretable team-power components.
  - Inputs/units: GF60−xGF60, xGA60−GA60, HDCF/(HDCF+HDCA), PP xGF60, PK xGA60, penalties drawn−taken60, PDO, PP%/PK% and daily rating history
  - Output scale: Extras standardized across date; ratings100+15z; special100+15(.2zPP−.2zPK); variance flag abs(PDO z)≥1; PP/PK tiers at33rd/67th quantiles; trend10=current off_rating−mean preceding10 filled rows.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex sql-team-ewma): Materialized view comment calls holistic daily team power with subratings. SQL is standalone build/swap script; not evidence it ran.
  - Intended contract (Codex sql-team-rating-extras): Standalone SQL implementation and holistic MV comment; no applied/deployed claim.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/__tests__/pages/api/v1/db/update-team-power-ratings-new.test.ts`; `{"discovered_not_run": []}`
- **Leads (not audited):**
  - (opus) differs from TS writer (window cap, mode mixing, extras from single games), so historical rows may come from two definitions; calculation_version distinguishes
  - (codex:sql-team-ewma) Definition exists locally; applied migration/live view shape, data freshness and runtime consumer use unknown.
  - (codex:sql-team-rating-extras) Definition exists locally; applied migration/live view shape, data freshness and runtime consumer use unknown.

## M-TEAM-018 Team power score and matchup edge

- **Match:** Both; Opus TEAM-029; Codex core-133, core-349, core-350
- **Purpose:** Single team strength number for dashboards and slate edges.
- **Where:** `web/lib/dashboard/teamContext.ts:34 (computeTeamPowerScore)`; `web/lib/dashboard/teamContext.ts:52 (buildSlateMatchupEdgeMap)`; `web/lib/dashboard/teamContext.ts:72 (getGamePowerEdge)`; `web/lib/teamRatingsTrend.ts:47 (computeBasePowerScore)`; `web/lib/teamRatingsTrend.ts:48 computeBasePowerScore`; `web/lib/dashboard/teamContext.ts:34 computeTeamPowerScore`; `web/lib/dashboard/teamContext.ts:52 buildSlateMatchupEdgeMap`; `web/lib/dashboard/teamContext.ts:72 getGamePowerEdge`; `web/lib/dashboard/teamContext.ts:42 computeCtpiDelta`
- **Tags (heuristic):** generation: current
- **Opus view (TEAM-029):**
  - Method: base = (off + def + pace)/3 (nulls as 0); +1.5*(3 - ppTier) + 1.5*(3 - pkTier) (tier null -> 2); edge = homePower - awayPower. teamRatingsTrend powerScore omits tier bonus.
  - Inputs/units: ratings ~100; tiers 1-3; sources: team_power_ratings_daily
  - Output scale: ~100 + up to 6 bonus; writes: —
  - Status: live — FORGE dashboard / command center
  - Consumers: TeamPowerCard; TeamPowerTerminal; FocusedSlateContext; SlateStripCard 'Home edge'; UnderlyingStatsDashboard; buildDatedOpponentStrengthIndex
- **Codex view (core-133, calculation, location; Codex family 'team power'):** Team form base power
  - Formula: (off+def+pace)/3.
  - Purpose: Calculate team form base power.
  - Inputs/units: Offense, defense, pace ratings.
  - Output scale: Rating points, 2 decimals.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f. Writer constant team-power-v2-final-source-observed-pdo. Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final status chec…
- **Codex view (core-349, calculation, location; Codex family 'team power'):** Dashboard team power and matchup edge
  - Formula: Mean of offense, defense and pace, null rating treated as zero, plus 1.5*(3-PP tier) + 1.5*(3-PK tier). Invalid tier defaults to 2. Edge is the difference of these scores.
  - Purpose: Provide dashboard team power and matchup edge for the identified consumer.
  - Inputs/units: Offense, defense and pace ratings; PP/PK tiers 1–3.
  - Output scale: Rating points and home-minus-away or team-minus-opponent edge.
  - Version/status: Local working tree on octoberBranch, read on 2026-11-10. HEAD changed during the inventory from d31dcb33f72d4c9d69b507874c388f0cd549fe2f to 11e4192d36ecc4ac4b338f9ab48e529c7049c618. This is a non-atomic local scan; deployment and persisted-data state are not verified. Referenced implementation files had no tracked/untracked status entry at the final status check.
- **Codex view (core-350, calculation, location; Codex family 'team power'):** Dashboard CTPI sparkline change
  - Formula: Last sparkline value minus first value.
  - Purpose: Provide dashboard CTPI sparkline change for the identified consumer.
  - Inputs/units: First and last sparkline values; current CTPI fallback.
  - Output scale: Signed rating-point change or null with fewer than two points.
  - Version/status: Local working tree on octoberBranch, read on 2026-11-10. HEAD changed during the inventory from d31dcb33f72d4c9d69b507874c388f0cd549fe2f to 11e4192d36ecc4ac4b338f9ab48e529c7049c618. This is a non-atomic local scan; deployment and persisted-data state are not verified. Referenced implementation files had no tracked/untracked status entry at the final status check.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex core-133): Source types and implementation in web/lib/teamRatingsTrend.ts:48; separate acceptance not verified.
  - Intended contract (Codex core-349): Function signature and comments at web/lib/dashboard/teamContext.ts:34 computeTeamPowerScore; independent product specification not verified.
  - Intended contract (Codex core-350): Function signature and comments at web/lib/dashboard/teamContext.ts:42 computeCtpiDelta; independent product specification not verified.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `Located only; not run for this inventory.`; `No directly named test located; tests not run.`; `web/lib/dashboard/teamContext.test.ts`
- **Leads (not audited):**
  - (opus) pace included as a third of 'power'
  - (opus) null ratings -> 0 drags the average to ~67
  - (opus) no home-ice term in the edge
  - (opus) two powerScore definitions (with and without tier bonus)
  - (codex:core-133) ["Inventory only, not validation of the formula, source semantics or model quality."]
  - (codex:core-349) ["Calculation inventory only; no correctness or model-quality verdict."]
  - (codex:core-350) ["Calculation inventory only; no correctness or model-quality verdict."]

## M-TEAM-019 Power ratings: EWMA of team rates (half-life 10, 25-game window)

- **Match:** Both; Opus TEAM-031; Codex core-121
- **Purpose:** Recency-weighted team rates as of a target date.
- **Where:** `web/lib/power-ratings.ts:317 (calculateEwma)`; `web/lib/power-ratings.ts:3-4 (LOOKBACK_GAMES 25, HALF_LIFE_GAMES 10)`; `web/pages/api/v1/db/update-team-power-ratings.ts:178-205 (grouping, gp_to_date)`; `web/lib/power-ratings.ts:317 calculateEwma`
- **Tags (heuristic):** denominators: per 60, per team game; generation: current
- **Opus view (TEAM-031):**
  - Method: Only if the team's newest row is ON targetDate; window = 25 most recent rows; weight_i = 0.5^(i/10); EWMA of xGF60, GF60, SF60, xGA60, GA60, SA60, pace, HDCF60, HDCA60, PP xGF60, PK xGA60, discipline diff (drawn - taken per 60); PDO EWMA over non-null only. Nulls count as 0 for all other metrics.
  - Inputs/units: per 60; sources: —
  - Output scale: per 60; writes: —
  - Status: live — /api/v1/db/update-team-power-ratings (withCronJobAudit; pg_cron schedule not in repo)
  - Consumers: calculateLeagueMetrics; calculateZScores
- **Codex view (core-121, calculation, location; Codex family 'team power'):** Recency-weighted team metrics
  - Formula: Weight=.5^(gamesAgo/10); weighted mean; PDO uses only observed values; pace fallback=(CF60+CA60)/2.
  - Purpose: Calculate recency-weighted team metrics.
  - Inputs/units: Up to 25 final-source team game logs; per 60 rates, observed PDO; half-life 10 games.
  - Output scale: EWMA xGF60, GF60, SF60, xGA60, GA60, SA60, pace60, HDCF60, HDCA60, PDO, PPxGF60, PKxGA60, penalty differential per 60.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f. Writer constant team-power-v2-final-source-observed-pdo. Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final status chec…
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex core-121): Source types and implementation in web/lib/power-ratings.ts:317; separate acceptance not verified.
  - External references: Exponentially weighted moving average (half-life parametrization)
  - Fixtures/test data: none listed
  - Tests: `Located only; not run for this inventory.`; `web/__tests__/pages/api/v1/db/update-team-power-ratings.test.ts`; `web/lib/power-ratings.test.ts`
- **Leads (not audited):**
  - (opus) the writer passes BOTH 'all' and '5v5' rows to calculateEwma (only teamRatingsTrend filters data_mode='all'), so each game appears twice: effective window ~12.5 games, half-life ~5 games, all-situation and 5v5 rates averaged together, 5v5 rows contribute 0 for pace/HD/PP/PK
  - (opus) gp_to_date counts rows (doubled) across the 150-day window and across seasons
  - (opus) missing values become 0 in the weighted sums
  - (codex:core-121) ["Inventory only, not validation of the formula, source semantics or model quality."]

## M-TEAM-020 Power ratings: league distribution, early-season blend, z-scores

- **Match:** Both; Opus TEAM-032; Codex core-122, core-123
- **Purpose:** Standardizes each team's EWMA rates against the league for the date.
- **Where:** `web/lib/power-ratings.ts:405 (calculateLeagueMetrics)`; `web/lib/power-ratings.ts:503 (calculateZScores)`; `web/lib/power-ratings.ts:405 calculateLeagueMetrics`; `web/lib/power-ratings.ts:503 calculateZScores`
- **Tags (heuristic):** denominators: per 60; generation: current
- **Opus view (TEAM-032):**
  - Method: league avg and sample SD (n-1) per metric; gpWeight = clamp(gp_to_date/10,0,1); blended = gpWeight*ewma + (1-gpWeight)*leagueAvg for xGF/GF/SF/xGA/GA/SA/pace; z = (blended - avg)/sd (0 if sd=0). Derived: finishing = GF60 - xGF60, goalie = xGA60 - GA60, danger = HDCF/(HDCF+HDCA) (0.5 if 0), ppOff, pkDef, discipline, pdo (pdo_z 0 if null).
  - Inputs/units: per 60; sources: —
  - Output scale: z-scores; writes: —
  - Status: live — /api/v1/db/update-team-power-ratings (withCronJobAudit; pg_cron schedule not in repo)
  - Consumers: calculateRawScores; calculateFinalRating
- **Codex view (core-122, calculation, location; Codex family 'team power'):** League team-rate moments
  - Formula: Mean and n-1 variance; finishing=GF60-xGF60; goalie=xGA60-GA60; danger=HDCF/(HDCF+HDCA); other moments from PP, PK, discipline, PDO.
  - Purpose: Calculate league team-rate moments.
  - Inputs/units: Team EWMAs for snapshot cohort.
  - Output scale: Mean and sample SD per base/derived metric.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f. Writer constant team-power-v2-final-source-observed-pdo. Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final status chec…
- **Codex view (core-123, calculation, location; Codex family 'team power'):** Early-season blending and team z-scores
  - Formula: w=clamp(GP/10, 0, 1); base rates=w*team+(1-w)*league; z=(rate-mean)/SD; derived metrics standardized; missing PDO z0 plus flag.
  - Purpose: Calculate early-season blending and team z-scores.
  - Inputs/units: Team EWMA, league moments, games played.
  - Output scale: Blended per 60 rates and dimensionless z for base/derived metrics.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f. Writer constant team-power-v2-final-source-observed-pdo. Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final status chec…
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex core-122): Source types and implementation in web/lib/power-ratings.ts:405; separate acceptance not verified.
  - Intended contract (Codex core-123): Source types and implementation in web/lib/power-ratings.ts:503; separate acceptance not verified.
  - External references: Z-score standardization; Bayesian shrinkage to league mean
  - Fixtures/test data: none listed
  - Tests: `Located only; not run for this inventory.`; `web/__tests__/pages/api/v1/db/update-team-power-ratings.test.ts`; `web/lib/power-ratings.test.ts`
- **Leads (not audited):**
  - (opus) league distribution uses only teams that played on targetDate (calculateEwma returns null otherwise), so the reference set is ~half the league and changes daily
  - (opus) z of the shrunk value is taken against the unshrunk distribution's SD
  - (opus) finishing/goalie/danger/special/discipline are not shrunk by gpWeight
  - (codex:core-122) ["Inventory only, not validation of the formula, source semantics or model quality."]
  - (codex:core-123) ["Inventory only, not validation of the formula, source semantics or model quality."]

## M-TEAM-021 Power ratings: offense / defense / pace ratings (100 + 15z)

- **Match:** Both; Opus TEAM-033; Codex core-124, core-125, core-126, core-127, core-128, core-129, core-130, core-131, core-132
- **Purpose:** Headline team off/def/pace ratings.
- **Where:** `web/lib/power-ratings.ts:581 (calculateRawScores)`; `web/lib/power-ratings.ts:604 (calculateRawDistribution)`; `web/lib/power-ratings.ts:652 (calculateFinalRating)`; `web/lib/power-ratings.ts:581 calculateRawScores`; `web/lib/power-ratings.ts:604 calculateRawDistribution`; `web/lib/power-ratings.ts:652 calculateFinalRating`
- **Tags (heuristic):** generation: current
- **Opus view (TEAM-033):**
  - Method: off_raw = 0.7 xGF60_z + 0.2 SF60_z + 0.1 GF60_z; def_raw = 0.7(-xGA60_z) + 0.2(-SA60_z) + 0.1(-GA60_z); pace_raw = pace60_z; each re-standardized across teams (sample SD) and mapped rating = 100 + 15*z.
  - Inputs/units: z-scores; sources: —
  - Output scale: rating centered 100, SD 15; writes: team_power_ratings_daily
  - Status: live — /api/v1/db/update-team-power-ratings (withCronJobAudit; pg_cron schedule not in repo)
  - Consumers: game prediction features; team-ratings API; computeTeamPowerScore; Team dashboards
- **Codex view (core-124, calculation, location; Codex family 'team power'):** Offense raw power
  - Formula: .7*xGF60_z+.2*SF60_z+.1*GF60_z.
  - Purpose: Calculate offense raw power.
  - Inputs/units: Standardized team rates.
  - Output scale: Unbounded signed raw score.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f. Writer constant team-power-v2-final-source-observed-pdo. Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final status chec…
- **Codex view (core-125, calculation, location; Codex family 'team power'):** Defense raw power
  - Formula: -.7*xGA60_z-.2*SA60_z-.1*GA60_z.
  - Purpose: Calculate defense raw power.
  - Inputs/units: Standardized team rates.
  - Output scale: Unbounded signed raw score.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f. Writer constant team-power-v2-final-source-observed-pdo. Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final status chec…
- **Codex view (core-126, calculation, location; Codex family 'team power'):** Pace raw power
  - Formula: pace60_z.
  - Purpose: Calculate pace raw power.
  - Inputs/units: Standardized team rates.
  - Output scale: Unbounded signed raw score.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f. Writer constant team-power-v2-final-source-observed-pdo. Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final status chec…
- **Codex view (core-127, calculation, codex_part_of_opus; Codex family 'team power'):** Raw power score distribution
  - Formula: Arithmetic means; variance divisor n-1.
  - Purpose: Calculate raw power score distribution.
  - Inputs/units: Team offense/defense/pace raw scores.
  - Output scale: Means and sample SDs.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f. Writer constant team-power-v2-final-source-observed-pdo. Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final status chec…
- **Codex view (core-128, calculation, location; Codex family 'team power'):** Final offense/defense/pace ratings
  - Formula: 100+15*(raw-rawPopulationMean)/rawPopulationSD.
  - Purpose: Calculate final offense/defense/pace ratings.
  - Inputs/units: Raw score distributions and component z-scores.
  - Output scale: Rating centered on 100 with scale 15; no hard range clamp.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f. Writer constant team-power-v2-final-source-observed-pdo. Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final status chec…
- **Codex view (core-129, calculation, codex_part_of_opus; Codex family 'team power'):** Finishing, goalie and danger ratings
  - Formula: 100+15*corresponding z.
  - Purpose: Calculate finishing, goalie and danger ratings.
  - Inputs/units: Raw score distributions and component z-scores.
  - Output scale: Rating centered on 100 with scale 15; no hard range clamp.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f. Writer constant team-power-v2-final-source-observed-pdo. Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final status chec…
- **Codex view (core-130, calculation, codex_part_of_opus; Codex family 'team power'):** Special-teams rating
  - Formula: 100+15*(.2*PPoff_z-.2*PKdef_z).
  - Purpose: Calculate special-teams rating.
  - Inputs/units: Raw score distributions and component z-scores.
  - Output scale: Rating centered on 100 with scale 15; no hard range clamp.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f. Writer constant team-power-v2-final-source-observed-pdo. Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final status chec…
- **Codex view (core-131, calculation, codex_part_of_opus; Codex family 'team power'):** Discipline rating
  - Formula: 100+15*discipline_z.
  - Purpose: Calculate discipline rating.
  - Inputs/units: Raw score distributions and component z-scores.
  - Output scale: Rating centered on 100 with scale 15; no hard range clamp.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f. Writer constant team-power-v2-final-source-observed-pdo. Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final status chec…
- **Codex view (core-132, calculation, codex_part_of_opus; Codex family 'team power'):** PDO variance flag
  - Formula: 1 if abs(PDO_z)>=1, otherwise 0.
  - Purpose: Calculate pdo variance flag.
  - Inputs/units: Raw score distributions and component z-scores.
  - Output scale: Binary variance flag: 0 or 1.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f. Writer constant team-power-v2-final-source-observed-pdo. Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final status chec…
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex core-124): Source types and implementation in web/lib/power-ratings.ts:581; separate acceptance not verified.
  - Intended contract (Codex core-125): Source types and implementation in web/lib/power-ratings.ts:581; separate acceptance not verified.
  - Intended contract (Codex core-126): Source types and implementation in web/lib/power-ratings.ts:581; separate acceptance not verified.
  - Intended contract (Codex core-127): Source types and implementation in web/lib/power-ratings.ts:604; separate acceptance not verified.
  - Intended contract (Codex core-128): Source types and implementation in web/lib/power-ratings.ts:652; separate acceptance not verified.
  - Intended contract (Codex core-129): Source types and implementation in web/lib/power-ratings.ts:652; separate acceptance not verified.
  - Intended contract (Codex core-130): Source types and implementation in web/lib/power-ratings.ts:652; separate acceptance not verified.
  - Intended contract (Codex core-131): Source types and implementation in web/lib/power-ratings.ts:652; separate acceptance not verified.
  - Intended contract (Codex core-132): Source types and implementation in web/lib/power-ratings.ts:652; separate acceptance not verified.
  - External references: IQ-style 100/15 scaling; xG-weighted team ratings (MoneyPuck/Evolving-Hockey team xGF/60)
  - Fixtures/test data: none listed
  - Tests: `Located only; not run for this inventory.`; `web/__tests__/pages/api/v1/db/update-team-power-ratings.test.ts`; `web/lib/power-ratings.test.ts`
- **Leads (not audited):**
  - (opus) pace (event volume) is treated as a rating and later averaged into the power score as if it were quality
  - (opus) ratings re-standardized per date across the subset of teams playing that day
  - (codex:core-124) ["Inventory only, not validation of the formula, source semantics or model quality."]
  - (codex:core-125) ["Inventory only, not validation of the formula, source semantics or model quality."]
  - (codex:core-126) ["Inventory only, not validation of the formula, source semantics or model quality."]
  - (codex:core-127) ["Inventory only, not validation of the formula, source semantics or model quality."]
  - (codex:core-128) ["Inventory only, not validation of the formula, source semantics or model quality."]
  - (codex:core-129) ["Inventory only, not validation of the formula, source semantics or model quality."]
  - (codex:core-130) ["Inventory only, not validation of the formula, source semantics or model quality."]
  - (codex:core-131) ["Inventory only, not validation of the formula, source semantics or model quality."]
  - (codex:core-132) ["Inventory only, not validation of the formula, source semantics or model quality."]

## M-TEAM-022 Power ratings: finishing, goalie, danger, special, discipline ratings and variance flag

- **Match:** Both; Opus TEAM-034; Codex core-128, core-129, core-130, core-131, core-132
- **Purpose:** Sub-ratings stored with the team power row.
- **Where:** `web/lib/power-ratings.ts:652 (calculateFinalRating)`; `web/lib/power-ratings.ts:652 calculateFinalRating`
- **Tags (heuristic):** generation: current
- **Opus view (TEAM-034):**
  - Method: rating = 100 + 15*z for finishing, goalie, danger, discipline; special = 100 + 15*(0.2*pp_off_z - 0.2*pk_def_z); variance_flag = 1 if \|pdo_z\| >= 1.
  - Inputs/units: z-scores; sources: —
  - Output scale: rating centered 100; writes: team_power_ratings_daily
  - Status: live — /api/v1/db/update-team-power-ratings (withCronJobAudit; pg_cron schedule not in repo)
  - Consumers: game prediction goalie/special diffs; teamPowerComposite; team-ratings API
- **Codex view (core-128, calculation, codex_part_of_opus; Codex family 'team power'):** Final offense/defense/pace ratings
  - Formula: 100+15*(raw-rawPopulationMean)/rawPopulationSD.
  - Purpose: Calculate final offense/defense/pace ratings.
  - Inputs/units: Raw score distributions and component z-scores.
  - Output scale: Rating centered on 100 with scale 15; no hard range clamp.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f. Writer constant team-power-v2-final-source-observed-pdo. Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final status chec…
- **Codex view (core-129, calculation, location; Codex family 'team power'):** Finishing, goalie and danger ratings
  - Formula: 100+15*corresponding z.
  - Purpose: Calculate finishing, goalie and danger ratings.
  - Inputs/units: Raw score distributions and component z-scores.
  - Output scale: Rating centered on 100 with scale 15; no hard range clamp.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f. Writer constant team-power-v2-final-source-observed-pdo. Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final status chec…
- **Codex view (core-130, calculation, codex_part_of_opus; Codex family 'team power'):** Special-teams rating
  - Formula: 100+15*(.2*PPoff_z-.2*PKdef_z).
  - Purpose: Calculate special-teams rating.
  - Inputs/units: Raw score distributions and component z-scores.
  - Output scale: Rating centered on 100 with scale 15; no hard range clamp.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f. Writer constant team-power-v2-final-source-observed-pdo. Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final status chec…
- **Codex view (core-131, calculation, codex_part_of_opus; Codex family 'team power'):** Discipline rating
  - Formula: 100+15*discipline_z.
  - Purpose: Calculate discipline rating.
  - Inputs/units: Raw score distributions and component z-scores.
  - Output scale: Rating centered on 100 with scale 15; no hard range clamp.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f. Writer constant team-power-v2-final-source-observed-pdo. Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final status chec…
- **Codex view (core-132, calculation, location; Codex family 'team power'):** PDO variance flag
  - Formula: 1 if abs(PDO_z)>=1, otherwise 0.
  - Purpose: Calculate pdo variance flag.
  - Inputs/units: Raw score distributions and component z-scores.
  - Output scale: Binary variance flag: 0 or 1.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f. Writer constant team-power-v2-final-source-observed-pdo. Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final status chec…
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex core-128): Source types and implementation in web/lib/power-ratings.ts:652; separate acceptance not verified.
  - Intended contract (Codex core-129): Source types and implementation in web/lib/power-ratings.ts:652; separate acceptance not verified.
  - Intended contract (Codex core-130): Source types and implementation in web/lib/power-ratings.ts:652; separate acceptance not verified.
  - Intended contract (Codex core-131): Source types and implementation in web/lib/power-ratings.ts:652; separate acceptance not verified.
  - Intended contract (Codex core-132): Source types and implementation in web/lib/power-ratings.ts:652; separate acceptance not verified.
  - External references: GSAx (team) for goalie; PDO regression
  - Fixtures/test data: none listed
  - Tests: `Located only; not run for this inventory.`; `web/__tests__/pages/api/v1/db/update-team-power-ratings.test.ts`; `web/lib/power-ratings.test.ts`
- **Leads (not audited):**
  - (opus) special_rating scaled by 0.2, so its spread is ~4-6 points vs 15 for other ratings, yet game predictions and SOS composite average it with them
  - (opus) goalie_rating = team xGA - GA (all skaters' defence + goalie), not goalie-specific
  - (codex:core-128) ["Inventory only, not validation of the formula, source semantics or model quality."]
  - (codex:core-129) ["Inventory only, not validation of the formula, source semantics or model quality."]
  - (codex:core-130) ["Inventory only, not validation of the formula, source semantics or model quality."]
  - (codex:core-131) ["Inventory only, not validation of the formula, source semantics or model quality."]
  - (codex:core-132) ["Inventory only, not validation of the formula, source semantics or model quality."]

## M-TEAM-023 Legacy power rankings store (season/L10 aggregates, ranks, SOS)

- **Match:** Both; Opus TEAM-035; Codex core-354, core-355, core-356
- **Purpose:** Old power_rankings_store loader.
- **Where:** `web/lib/supabase/Upserts/fetchPowerRankings.js:74 (calculateAggregatedStats)`; `web/lib/supabase/Upserts/fetchPowerRankings.js:791 (calculateRanks)`; `web/lib/supabase/Upserts/fetchPowerRankings.js:849 (calculateSoSForTeam)`; `web/lib/supabase/Upserts/fetchPowerRankings.js:74 calculateAggregatedStats`; `web/lib/supabase/Upserts/fetchPowerRankings.js:791 calculateRanks`; `web/lib/supabase/Upserts/fetchPowerRankings.js:849 calculateSoSForTeam`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: per game; generation: legacy
- **Opus view (TEAM-035):**
  - Method: point_pct, PP%, PK%, SF/G = mean of per-game values; 'goals_for_pct' = GF/GA ratio; ranks = position after sorting ALL stored rows (all dates <= date) desc; SOS past/future = mean l_ten_pts_pct over stored rows of past/future opponents (future rows use date >= current).
  - Inputs/units: per game; fractions; sources: wgo_team_stats, games, power_rankings_store, standings
  - Output scale: ranks; fractions; writes: power_rankings_store
  - Status: legacy/dead — /api/v1/db/update-power-rankings returns 410 'DO NOT RUN'
  - Consumers: none (route returns 410)
- **Codex view (core-354, calculation, location; Codex family 'legacy team aggregation'):** Stored team aggregate totals and rates
  - Formula: Sum PIM, hits, blocks, PP opportunities, GF and GA. Mean point percentage, shots/game, PP% and PK%. goals_for_pct = summed GF / summed GA, or zero when GA is zero.
  - Purpose: Provide stored team aggregate totals and rates for the identified consumer.
  - Inputs/units: wgo_team_stats rows, counts and existing rate fields.
  - Output scale: Summed counts; arithmetic mean rate fields; goals_for_pct ratio.
  - Version/status: Local working tree on octoberBranch, read on 2026-11-10. HEAD changed during the inventory from d31dcb33f72d4c9d69b507874c388f0cd549fe2f to 11e4192d36ecc4ac4b338f9ab48e529c7049c618. This is a non-atomic local scan; deployment and persisted-data state are not verified. Referenced implementation files had no tracked/untracked status entry at the final status check.
- **Codex view (core-355, calculation, location; Codex family 'legacy team aggregation'):** Stored power rank ordinals
  - Formula: Sort available rows descending by each metric and return first matching team position.
  - Purpose: Provide stored power rank ordinals for the identified consumer.
  - Inputs/units: Selected stored metric rows through cutoff date.
  - Output scale: One-based descending ordinal for each requested metric.
  - Version/status: Local working tree on octoberBranch, read on 2026-11-10. HEAD changed during the inventory from d31dcb33f72d4c9d69b507874c388f0cd549fe2f to 11e4192d36ecc4ac4b338f9ab48e529c7049c618. This is a non-atomic local scan; deployment and persisted-data state are not verified. Referenced implementation files had no tracked/untracked status entry at the final status check.
- **Codex view (core-356, calculation, location; Codex family 'legacy team aggregation'):** Stored last-ten opponent SOS
  - Formula: Arithmetic mean of returned opponent l_ten_pts_pct rows, with missing values zero-filled; no rows gives zero.
  - Purpose: Provide stored last-ten opponent SOS for the identified consumer.
  - Inputs/units: Past/future opponent sets and stored l_ten_pts_pct rows filtered by date.
  - Output scale: Past and future SOS strings to three decimals.
  - Version/status: Local working tree on octoberBranch, read on 2026-11-10. HEAD changed during the inventory from d31dcb33f72d4c9d69b507874c388f0cd549fe2f to 11e4192d36ecc4ac4b338f9ab48e529c7049c618. This is a non-atomic local scan; deployment and persisted-data state are not verified. Referenced implementation files had no tracked/untracked status entry at the final status check.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex core-354): Function signature and comments at web/lib/supabase/Upserts/fetchPowerRankings.js:74 calculateAggregatedStats; independent product specification not verified.
  - Intended contract (Codex core-355): Function signature and comments at web/lib/supabase/Upserts/fetchPowerRankings.js:791 calculateRanks; independent product specification not verified.
  - Intended contract (Codex core-356): Function signature and comments at web/lib/supabase/Upserts/fetchPowerRankings.js:849 calculateSoSForTeam; independent product specification not verified.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `No dedicated test located in the bounded scan; no tests run.`; `web/__tests__/pages/api/v1/db/update-power-rankings.test.ts`
- **Leads (not audited):**
  - (opus) goals_for_pct is GF/GA not GF/(GF+GA)
  - (opus) ranks computed over every historical row, not one row per team
  - (opus) future SOS reads snapshots dated after the current date (leakage)
  - (codex:core-354) ["Calculation inventory only; no correctness or model-quality verdict."]
  - (codex:core-355) ["Calculation inventory only; no correctness or model-quality verdict."]
  - (codex:core-356) ["Calculation inventory only; no correctness or model-quality verdict."]

## M-TEAM-024 Team form context: power-score trend delta and PDO variance

- **Match:** Both; Opus TEAM-036; Codex core-135
- **Purpose:** Trend sparkline and luck flag for team landing pages.
- **Where:** `web/lib/teamRatingsTrend.ts:141 (buildFormHistoryByTeam)`; `web/lib/teamRatingsTrend.ts:258 (computeTeamFormContextFromHistory)`; `web/lib/teamRatingsTrend.ts:317 (deriveTeamFormContextForDate)`; `web/lib/teamRatingsTrend.ts:258 computeTeamFormContextFromHistory`
- **Tags (heuristic):** generation: current
- **Opus view (TEAM-036):**
  - Method: trendDelta = current powerScore - mean(previous 10 snapshots); trendSeries last 10 powerScores; varianceFlag = \|pdo_z\| >= 1; varianceSeries PDO (null -> 100).
  - Inputs/units: rating; PDO; sources: —
  - Output scale: rating delta; writes: —
  - Status: live — underlying-stats team landing
  - Consumers: lib/underlying-stats/teamLandingRatings.ts
- **Codex view (core-135, calculation, location; Codex family 'team power'):** Power trend and PDO context
  - Formula: Current mean(off, def, pace) minus previous 10 mean; abs(currentPDOz)>=1 flag.
  - Purpose: Calculate power trend and pdo context.
  - Inputs/units: Power/PDO snapshot history.
  - Output scale: Power change; 10-point trend and PDO series; variance flag.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f. Writer constant team-power-v2-final-source-observed-pdo. Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final status chec…
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex core-135): Source types and implementation in web/lib/teamRatingsTrend.ts:258; separate acceptance not verified.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `No directly named test located; tests not run.`; `web/__tests__/pages/api/v1/db/update-team-power-ratings.test.ts`; `web/lib/power-ratings.test.ts`
- **Leads (not audited):**
  - (opus) PDO fallback 100 mixes scales if NST pdo is ~1.0
  - (codex:core-135) ["Inventory only, not validation of the formula, source semantics or model quality."]

## M-TEAM-025 Power ratings: PP/PK tiers (tertiles) and trend10

- **Match:** Both; Opus TEAM-037; Codex core-134, core-339
- **Purpose:** Special-teams tiers and offensive-rating trend stored with ratings.
- **Where:** `web/pages/api/v1/db/update-team-power-ratings.ts:281-305 (getPercentile, getTier)`; `web/lib/teamRatingsTrend.ts:218 (computeTrendOverridesFromHistory)`; `web/pages/api/v1/db/update-team-power-ratings.ts:308 (trend10)`; `web/lib/teamRatingsTrend.ts:218 computeTrendOverridesFromHistory`; `web/pages/api/v1/db/update-team-power-ratings.ts:292 getTier`
- **Tags (heuristic):** generation: current
- **Opus view (TEAM-037):**
  - Method: p33/p67 = values[floor(n*p)]; tier 1 if >= p67, 2 if >= p33, else 3 (null -> 3). trend10 = current off_rating - mean(previous 10 snapshots) from recomputed EWMA history (all-mode only), else stored trend10.
  - Inputs/units: PP%/PK% (fraction or percent per WGO); sources: wgo_team_stats, team_power_ratings_daily
  - Output scale: tier 1-3; rating points; writes: team_power_ratings_daily
  - Status: live — /api/v1/db/update-team-power-ratings (withCronJobAudit; pg_cron schedule not in repo)
  - Consumers: computeTeamPowerScore; dashboards
- **Codex view (core-134, calculation, location; Codex family 'team power'):** 10-snapshot offense trend
  - Formula: Current offense minus preceding 10 mean; no baseline gives 0.
  - Purpose: Calculate 10-snapshot offense trend.
  - Inputs/units: Current offense rating and previous up to 10 snapshots.
  - Output scale: Signed rating-point change.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f. Writer constant team-power-v2-final-source-observed-pdo. Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final status chec…
- **Codex view (core-339, calculation, location; Codex family 'team power'):** PP/PK percentile tiers
  - Formula: Order-statistic cuts at floor(.33*N), floor(.67*N); >=p67 tier 1; >=p33 tier 2; else 3; missing 3.
  - Purpose: Calculate pp/pk percentile tiers.
  - Inputs/units: Available team PP% and PK% cross-section.
  - Output scale: Tier 1, 2, 3 (higher percentage better).
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f.  Deployment not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final status check.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex core-134): Source types and implementation in web/lib/teamRatingsTrend.ts:218; separate acceptance not verified.
  - Intended contract (Codex core-339): Source types and implementation in web/pages/api/v1/db/update-team-power-ratings.ts:292; separate acceptance not verified.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `Located only; not run for this inventory.`; `No directly named test located; tests not run.`; `web/__tests__/pages/api/v1/db/update-team-power-ratings.test.ts`; `web/lib/power-ratings.test.ts`
- **Leads (not audited):**
  - (opus) WGO latest row holds a single game's PP%/PK% (TeamDashboard.tsx:512 comment), so tiers rank one game, not the season
  - (opus) missing value -> worst tier 3
  - (opus) trend10 recomputes ratings from 'all' rows only while stored off_rating mixes all+5v5
  - (codex:core-134) ["Inventory only, not validation of the formula, source semantics or model quality."]
  - (codex:core-339) ["Inventory only; no correctness verdict."]

## M-TEAM-026 SOS ratings (win% of opponents; combined sosScore)

- **Match:** Both; Opus TEAM-041; Codex core-147, core-148
- **Purpose:** Turns opponent totals into past/future/combined SOS.
- **Where:** `web/lib/trends/strengthOfSchedule.ts:53 (pct)`; `web/lib/trends/strengthOfSchedule.ts:62 (computeSosRatings)`; `web/lib/trends/strengthOfSchedule.ts:117 (buildCanonicalSosRankings)`; `web/pages/api/v1/trends/team-sos.ts:89-150`; `web/lib/trends/strengthOfSchedule.ts:62 computeSosRatings`; `web/lib/trends/strengthOfSchedule.ts:117 buildCanonicalSosRankings`
- **Tags (heuristic):** percent scale: both/ambiguous; generation: current
- **Opus view (TEAM-041):**
  - Method: winPct = W/(W+L+OTL) (OTL counted as non-wins); combined = (pastPct*pastGames + futurePct*futureGames)/(pastGames+futureGames) where games are opponent game totals; sosScore = combined*100; canonical rankings use latest row with nonzero totals, sos rounded 3 dp, sorted desc.
  - Inputs/units: counts; sources: sos_standings
  - Output scale: fraction 0-1; sosScore 0-100; writes: —
  - Status: live — /api/v1/trends/team-sos
  - Consumers: /api/v1/trends/team-sos; UnderlyingStats / trends pages
- **Codex view (core-147, calculation, location; Codex family 'strength of schedule'):** Opponent-record schedule difficulty
  - Formula: W/(W+L+OTL); combine past/future fractions weighted by respective total games; round 100*combined to 2 decimals.
  - Purpose: Calculate opponent-record schedule difficulty.
  - Inputs/units: Past/future opponents cumulative wins, losses, OT losses.
  - Output scale: Win fractions and combined SOS 0..100.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f.  Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final status check.
- **Codex view (core-148, calculation, location; Codex family 'strength of schedule'):** Canonical past/future SOS rankings
  - Formula: Select latest nonempty record; W/(W+L+OTL).
  - Purpose: Calculate canonical past/future sos rankings.
  - Inputs/units: Latest valid records for current-team IDs.
  - Output scale: Separate descending rankings; fractional SOS 3 decimals.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f.  Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final status check.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex core-147): Source explicitly uses straight win percentage, not half-credit for OTL.
  - Intended contract (Codex core-148): Source types and implementation in web/lib/trends/strengthOfSchedule.ts:117; separate acceptance not verified.
  - External references: RPI-style OWP/OOWP; points% SOS
  - Fixtures/test data: none listed
  - Tests: `Located only; not run for this inventory.`; `web/__tests__/pages/api/v1/trends/team-sos.test.ts`; `web/lib/trends/strengthOfSchedule.test.ts`
- **Leads (not audited):**
  - (opus) no opponents-of-opponents term despite RPI reference
  - (opus) combined weights by opponents' games played, not by number of meetings
  - (opus) win% excludes OT losses entirely (comment strengthOfSchedule.ts:56-58) while NHL standings use points%
  - (codex:core-147) ["Inventory only, not validation of the formula, source semantics or model quality."]
  - (codex:core-148) ["Inventory only, not validation of the formula, source semantics or model quality."]

## M-TEAM-027 Descriptive SOS contract (direct and indirect, as-known-then)

- **Match:** Both; Opus TEAM-042; Codex core-351, core-352
- **Purpose:** Event-level, leakage-safe SOS research contract.
- **Where:** `web/lib/trends/strengthOfScheduleContract.ts:21 (recordPercentage)`; `web/lib/trends/strengthOfScheduleContract.ts:60 (computeDescriptiveSos)`; `web/lib/trends/strengthOfScheduleContract.ts:21 recordPercentage`; `web/lib/trends/strengthOfScheduleContract.ts:60 computeDescriptiveSos`
- **Tags (heuristic):** percent scale: fraction 0-1; generation: development, current
- **Opus view (TEAM-042):**
  - Method: recordPercentage win-pct = W/G or points-pct = (2W + OTL)/(2G); direct = opponent's record excluding games vs team (RPI OWP) at fixture start (past-as-known-then) or cutoff; indirect = mean of opponent's opponents' records excluding team and opponent (OOWP); team SOS = equal-weight mean over fixtures; null if any observation missing.
  - Inputs/units: counts; ISO timestamps; sources: —
  - Output scale: fraction 0-1; writes: —
  - Status: draft — DESCRIPTIVE_SOS_VERSION 'descriptive-sos-v1', no production caller
  - Consumers: none in production found (research contract)
- **Codex view (core-351, calculation, location; Codex family 'strength of schedule'):** Descriptive record percentage
  - Formula: Win percentage = W/(W+L+OTL); points percentage = (2W+OTL)/(2*(W+L+OTL)).
  - Purpose: Provide descriptive record percentage for the identified consumer.
  - Inputs/units: Nonnegative integer wins, regulation losses and overtime losses; metric selector.
  - Output scale: Win fraction or standings points fraction; null for invalid or empty records.
  - Version/status: Local working tree on octoberBranch, read on 2026-11-10. HEAD changed during the inventory from d31dcb33f72d4c9d69b507874c388f0cd549fe2f to 11e4192d36ecc4ac4b338f9ab48e529c7049c618. This is a non-atomic local scan; deployment and persisted-data state are not verified. Referenced implementation files had no tracked/untracked status entry at the final status check.
- **Codex view (core-352, calculation, location; Codex family 'strength of schedule'):** Time-aware direct and indirect schedule difficulty
  - Formula: Direct = mean opponent record percentage excluding games against the subject team. Indirect = mean historical opponents-of-opponents records excluding the subject and immediate opponent, then mean across fixture slots. Complete values required; cutoff applies to completion, knowledge and schedule availability.
  - Purpose: Provide time-aware direct and indirect schedule difficulty for the identified consumer.
  - Inputs/units: Fixtures and known completed results with timestamps; cutoff; future, past or past-as-known-then view.
  - Output scale: Direct and indirect difficulty fractions, supported-fixture counts and per-fixture evidence.
  - Version/status: Local working tree on octoberBranch, read on 2026-11-10. HEAD changed during the inventory from d31dcb33f72d4c9d69b507874c388f0cd549fe2f to 11e4192d36ecc4ac4b338f9ab48e529c7049c618. This is a non-atomic local scan; deployment and persisted-data state are not verified. Referenced implementation files had no tracked/untracked status entry at the final status check.
- **Audit context:**
  - Intent (Opus): 'Event-level research contract. Legacy aggregate snapshots cannot satisfy it.' (strengthOfScheduleContract.ts:1)
  - Intended contract (Codex core-351): DESCRIPTIVE_SOS_VERSION and source types distinguish win-pct from point-pct; time-aware descriptive contract, not a forecast.
  - Intended contract (Codex core-352): Function signature and comments at web/lib/trends/strengthOfScheduleContract.ts:60 computeDescriptiveSos; independent product specification not verified.
  - External references: NCAA RPI OWP/OOWP
  - Fixtures/test data: `tasks/artifacts/sos-candidate-2026-10-23`
  - Tests: `No dedicated test located in the bounded scan; no tests run.`; `web/__tests__/pages/api/v1/trends/team-sos.test.ts`; `web/lib/trends/strengthOfSchedule.test.ts`
- **Leads (not audited):**
  - (codex:core-351) ["Calculation inventory only; no correctness or model-quality verdict."]
  - (codex:core-352) ["Calculation inventory only; no correctness or model-quality verdict."]

## M-TEAM-028 Game-by-game performance score (GameByGameTimeline)

- **Match:** Both; Opus TEAM-046; Codex core-373
- **Purpose:** Colour score for each recent game card.
- **Where:** `web/components/TeamDashboard/GameByGameTimeline.tsx:336 (getPerformanceScore)`; `web/components/TeamDashboard/GameByGameTimeline.tsx:183-195 (L10 record)`; `web/components/TeamDashboard/GameByGameTimeline.tsx:336 getPerformanceScore`
- **Tags (heuristic):** denominators: per team game; generation: current
- **Opus view (TEAM-046):**
  - Method: score = 2*GD + 0.1*shotDiff + 1 if PP% > 0.2 + 1 if PK% > 0.8 + 0.5 if FO% > 0.5; class >= 2 excellent, >= 0 good, >= -2 poor, else terrible; bar width = clamp((score+4)/8, 10%, 100%). Shootout winner credited +1 goal.
  - Inputs/units: counts; fractions; sources: wgo_team_stats, games
  - Output scale: unbounded score; writes: —
  - Status: live
  - Consumers: TeamDashboard timeline
- **Codex view (core-373, calculation, location; Codex family 'team performance UI'):** Game performance score and grade
  - Formula: 2*(GF-GA) + 0.1*(SF-SA) + 1 if PP% > .2 + 1 if PK% > .8 + .5 if FO% > .5. Grade cuts at 2, 0 and -2.
  - Purpose: Provide game performance score and grade for the identified consumer.
  - Inputs/units: GF, GA, SF, SA, PP/PK and faceoff fractions for a team game.
  - Output scale: Signed heuristic points; excellent/good/poor/terrible.
  - Version/status: Local working tree on octoberBranch, read on 2026-11-10. HEAD changed during the inventory from d31dcb33f72d4c9d69b507874c388f0cd549fe2f to 11e4192d36ecc4ac4b338f9ab48e529c7049c618. This is a non-atomic local scan; deployment and persisted-data state are not verified. Referenced implementation files had no tracked/untracked status entry at the final status check.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex core-373): Function signature and comments at web/components/TeamDashboard/GameByGameTimeline.tsx:336 getPerformanceScore; independent product specification not verified.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `Located only; not run for this inventory.`; `web/components/TeamDashboard/GameByGameTimeline.test.tsx`
- **Leads (not audited):**
  - (opus) PP%>0.2 bonus fires on 1-for-1 single-game samples; magic constants
  - (codex:core-373) ["Calculation inventory only; no correctness or model-quality verdict."]

## M-TEAM-029 Team standings chart rolling averages

- **Match:** Both; Opus TEAM-049; Codex core-322
- **Purpose:** Rolling 5/10-game GF/GA per game and rolling PP%/PK%/point%.
- **Where:** `web/components/TeamStandingsChart/TeamStandingsChart.tsx:69 (computeRollingForGoals)`; `web/components/TeamStandingsChart/TeamStandingsChart.tsx:93 (computeRollingAverageFiltered)`; `web/components/TeamStandingsChart/metricUtils.ts:28 (getMetricValue)`; `web/components/TeamStandingsChart/metricUtils.ts:28 getMetricValue`
- **Tags (heuristic):** denominators: per game; generation: current
- **Opus view (TEAM-049):**
  - Method: GF/game over window W = (cumGF[i] - cumGF[i-W])/W; other metrics: d3.mean of the metric over the last W entries; pointPct x100.
  - Inputs/units: cumulative counts; fractions; sources: NHL standings API (daily)
  - Output scale: per game; percent; writes: —
  - Status: live
  - Consumers: TeamStandingsChart
- **Codex view (core-322, calculation, location; Codex family 'standings display'):** Percentage display conversion and chart domains
  - Formula: pointPct*100; other values unchanged; getYDomainMax uses 100 for percentages, 10 goals/game, 50 shots/game.
  - Purpose: Calculate percentage display conversion and chart domains.
  - Inputs/units: Standing pointPct fraction or other metric values.
  - Output scale: Point percentage 0..100; fixed chart domain maximum.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f.  Deployment not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final status check.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex core-322): Source types and implementation in web/components/TeamStandingsChart/metricUtils.ts:28; separate acceptance not verified.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `Located only; not run for this inventory.`; `web/components/TeamStandingsChart/TeamStandingsChart.test.tsx`; `web/components/TeamStandingsChart/chartUtils.test.ts`; `web/components/TeamStandingsChart/metricUtils.test.ts`
- **Leads (not audited):**
  - (opus) PP%/PK%/point% in standings are season-cumulative, so averaging them over W entries is a smoothed cumulative rate, not a last-W-games rate
  - (opus) GF window assumes each kept entry is exactly one game
  - (codex:core-322) ["Inventory only; no correctness verdict."]

## M-TEAM-030 Team trend category percentiles (offense/defense/PP/PK by game number)

- **Match:** Both; Opus TEAM-051; Codex core-200
- **Purpose:** Weighted percentile score per category for the team-power trends view.
- **Where:** `web/lib/trends/teamPercentiles.ts:174 (computeCategoryResults)`; `web/lib/trends/teamMetricConfig.ts:22-28 (weights HIGH 5 .. LOW 1)`; `web/lib/trends/teamPercentiles.ts:174 computeCategoryResults`
- **Tags (heuristic):** percent scale: 0-100; denominators: per game; generation: current
- **Opus view (TEAM-051):**
  - Method: For each game number gp (1..max), rank teams' gp-th game value per metric: percentile = idx/(n-1)*100 (inverted if lower is better); category = weighted mean of metric percentiles with weights 5/4/3/2/1 (e.g. offense GF 5, xGF 4, SF 3, CF 2, SCF 3, HDSF 2, HDGF 3, SH% 2, PP opp 1); rankings from latest point, delta = previous rank - rank.
  - Inputs/units: per-game counts/percent; sources: nst_team_gamelogs_* (as, pp, pk), wgo_team_stats
  - Output scale: percentile 0-100; writes: —
  - Status: live — /api/v1/trends/team-power
  - Consumers: /api/v1/trends/team-power
- **Codex view (core-200, calculation, location; Codex family 'team percentile trends'):** Cross-team category percentile averages
  - Formula: At each game-number snapshot, sort each metric and assign 100*index/(n-1), inverted for lower-is-better; singleton 50. Weighted mean available metric percentiles, then descending rank; rank movement=previous-current.
  - Purpose: Calculate cross-team category percentile averages.
  - Inputs/units: Team metric snapshots, metric direction, category weights.
  - Output scale: Metric percentiles, category series and rankings.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f. No explicit version located. Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final status check.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex core-200): teamMetricConfig definitions and teamPercentiles implementation; detailed missing-metric weighting deferred to Fable.
  - External references: Percentile ranks
  - Fixtures/test data: none listed
  - Tests: `No directly named test located; tests not run.`; `web/__tests__/pages/api/v1/trends/team-power.test.ts`
- **Leads (not audited):**
  - (opus) compares teams' Nth games (different dates/opponents), single-game values, not cumulative or rate-adjusted
  - (opus) ties broken by sort order, not averaged ranks
  - (codex:core-200) ["Inventory only, not validation of the formula, source semantics or model quality."]

## M-TEAM-031 Trend utilities: percentile, winsorize, pearson, regression, hot/cold streaks

- **Match:** Both; Opus TEAM-052; Codex core-194, core-195, core-199
- **Purpose:** Shared stats helpers for trends pages.
- **Where:** `web/lib/trends/utils.ts:29 (percentile)`; `web/lib/trends/utils.ts:37 (winsorize)`; `web/lib/trends/utils.ts:45 (pearson)`; `web/lib/trends/utils.ts:66 (summarizePairedCorrelation)`; `web/lib/trends/utils.ts:112 (linearRegression)`; `web/lib/trends/utils.ts:215 (rollingAverage)`; `web/lib/trends/utils.ts:240 (buildTrendData)`; `web/lib/trends/utils.ts:29 percentile`; `web/lib/trends/utils.ts:37 winsorize`; `web/lib/trends/utils.ts:240 buildTrendData`
- **Tags (heuristic):** generation: current
- **Opus view (TEAM-052):**
  - Method: percentile = index of first value >= x /(n-1)*100; winsorize at 1%/99%; Pearson r (n<3 -> 0); OLS slope/intercept; trailing rolling mean (partial windows); streaks: hot/cold when value vs baseline for >= 2 consecutive games, non-finite -> 0.
  - Inputs/units: —; sources: —
  - Output scale: —; writes: —
  - Status: live (trendsSandbox)
  - Consumers: pages/trendsSandbox.tsx; trendsSurface
- **Codex view (core-194, calculation, location; Codex family 'trends utilities'):** Descriptive statistics and index-based percentile
  - Formula: Percentile uses first sorted index with x<=value, or last index, divided by n-1 and multiplied by 100; empty population returns 50. This is distinct from midrank helpers elsewhere.
  - Purpose: Provide shared mean, population SD, z-score and percentile helpers.
  - Inputs/units: Numeric arrays/value.
  - Output scale: Mean, population SD, z, percentile.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f.  Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final status check.
- **Codex view (core-195, calculation, location; Codex family 'trends utilities'):** Winsorization, correlation and regression
  - Formula: Clamp to order-statistic limits; centered covariance correlation; linearRegression least squares.
  - Purpose: Calculate winsorization, correlation and regression.
  - Inputs/units: Paired numeric series and trim fraction.
  - Output scale: Winsorized data, Pearson r/r², OLS slope/intercept.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f.  Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final status check.
- **Codex view (core-199, calculation, location; Codex family 'trends utilities'):** Trend rolling average and hot/cold streaks
  - Formula: Consecutive above/below baseline; minimum 2 points for label; intensity=min(1, .25+.18*length).
  - Purpose: Calculate trend rolling average and hot/cold streaks.
  - Inputs/units: Dates, point values, baseline, window.
  - Output scale: Rolling mean, streak direction, length, intensity 0..1.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f.  Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final status check.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex core-194): Source types and implementation in web/lib/trends/utils.ts:29; separate acceptance not verified.
  - Intended contract (Codex core-195): Source types and implementation in web/lib/trends/utils.ts:37; separate acceptance not verified.
  - Intended contract (Codex core-199): Source types and implementation in web/lib/trends/utils.ts:240; separate acceptance not verified.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `No directly named test located; tests not run.`; `web/lib/trends/trendsSurface.test.ts`
- **Leads (not audited):**
  - (opus) percentile helper returns NaN for single-element arrays (division by 0)
  - (opus) buildTrendData turns missing values into 0 points
  - (codex:core-194) ["Inventory only, not validation of the formula, source semantics or model quality."]
  - (codex:core-195) ["Inventory only, not validation of the formula, source semantics or model quality."]
  - (codex:core-199) ["Inventory only, not validation of the formula, source semantics or model quality."]

## M-TEAM-032 Player trend records (cumulative mean, rolling 3/5/10, variance)

- **Match:** Both; Opus TEAM-054; Codex core-149, core-150, core-151, core-152, core-153, core-154, core-155, core-156, core-157, core-158, core-159, core-160, core-161, core-162, core-163, core-164, core-165, core-166, core-167, core-168, core-169, core-170, core-171, core-172, core-173, core-174, core-175, core-176, core-177, core-178, core-179, core-180, core-181, core-182, core-183, core-184, core-185, core-186, core-187, core-188, core-189, core-190, core-191, core-192, core-193
- **Purpose:** Per-player per-game trend rows for skater/goalie metrics.
- **Where:** `web/lib/trends/playerTrendCalculator.ts:132 (computeRollingAverage)`; `web/lib/trends/playerTrendCalculator.ts:141 (computeSampleVariance)`; `web/lib/trends/playerTrendCalculator.ts:160 (processMetric)`; `web/lib/trends/playerTrendCalculator.ts:238 (SKATER_TREND_METRICS)`; `web/lib/trends/playerTrendCalculator.ts:652 (buildPlayerTrendRecords)`; `web/lib/trends/playerTrendCalculator.ts:240 shots_per_60`; `web/lib/trends/playerTrendCalculator.ts:160 processMetric`; `web/lib/trends/playerTrendCalculator.ts:259 ixg_per_60`; `web/lib/trends/playerTrendCalculator.ts:278 shooting_percentage`; `web/lib/trends/playerTrendCalculator.ts:285 ixg_total`; `web/lib/trends/playerTrendCalculator.ts:292 primary_points_pct`; `web/lib/trends/playerTrendCalculator.ts:307 expected_shooting_pct` …
- **Tags (heuristic):** denominators: per 60, per game, unblocked attempts; generation: current
- **Opus view (TEAM-054):**
  - Method: Per metric: running mean, sample variance via sum/sumSquares (n-1), rolling means over full 3/5/10 windows (null until filled). Accessors: shots/60 = NST or shots/TOI*60; ixG/60 likewise; primary points% = (G + A1)/P; expected SH% = ixG/iFF*100; IPP from NST.
  - Inputs/units: per game; minutes; sources: player game logs (WGO/NST)
  - Output scale: per 60; percent; writes: —
  - Status: live — /api/v1/trends/player-trends
  - Consumers: /api/v1/trends/player-trends
- **Codex view (core-149, calculation, codex_part_of_opus; Codex family 'player trend metric'):** Skater Shots on Goal / 60
  - Formula: Use NST shots/60 when available, else 60*shots/TOI minutes. Shared processMetric uses cumulative sum/count, n-1 sample variance and trailing 3/5/10 means.
  - Purpose: Summarize observed skater shots on goal / 60 over cumulative and rolling game windows.
  - Inputs/units: Source metric shots_per_60 per admitted game; missing observations omitted from accumulator. Raw units: count per 60 minutes.
  - Output scale: Raw value; cumulative mean/sample variance/SD; complete 3/5/10-observation rolling means; sample size.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f. PLAYER_TREND_CALCULATION_VERSION=player-trend-v2-full-history-source-units Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the…
- **Codex view (core-150, calculation, codex_part_of_opus; Codex family 'player trend metric'):** Skater ixG / 60
  - Formula: Use NST ixG/60 when available, else 60*ixG/TOI minutes. Shared processMetric uses cumulative sum/count, n-1 sample variance and trailing 3/5/10 means.
  - Purpose: Summarize observed skater ixg / 60 over cumulative and rolling game windows.
  - Inputs/units: Source metric ixg_per_60 per admitted game; missing observations omitted from accumulator. Raw units: count per 60 minutes.
  - Output scale: Raw value; cumulative mean/sample variance/SD; complete 3/5/10-observation rolling means; sample size.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f. PLAYER_TREND_CALCULATION_VERSION=player-trend-v2-full-history-source-units Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the…
- **Codex view (core-151, calculation, codex_part_of_opus; Codex family 'player trend metric'):** Skater Shooting Percentage
  - Formula: Read measured source metric; no new raw-value formula in this accessor. Shared processMetric uses cumulative sum/count, n-1 sample variance and trailing 3/5/10 means.
  - Purpose: Summarize observed skater shooting percentage over cumulative and rolling game windows.
  - Inputs/units: Source metric shooting_percentage per admitted game; missing observations omitted from accumulator. Raw units: source ratio/percentage scale; exact fraction-versus-percentage feed scale is not established by this accessor alone.
  - Output scale: Raw value; cumulative mean/sample variance/SD; complete 3/5/10-observation rolling means; sample size.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f. PLAYER_TREND_CALCULATION_VERSION=player-trend-v2-full-history-source-units Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the…
- **Codex view (core-152, calculation, codex_part_of_opus; Codex family 'player trend metric'):** Skater ixG
  - Formula: Read measured source metric; no new raw-value formula in this accessor. Shared processMetric uses cumulative sum/count, n-1 sample variance and trailing 3/5/10 means.
  - Purpose: Summarize observed skater ixg over cumulative and rolling game windows.
  - Inputs/units: Source metric ixg_total per admitted game; missing observations omitted from accumulator. Raw units: expected-goal total.
  - Output scale: Raw value; cumulative mean/sample variance/SD; complete 3/5/10-observation rolling means; sample size.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f. PLAYER_TREND_CALCULATION_VERSION=player-trend-v2-full-history-source-units Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the…
- **Codex view (core-153, calculation, codex_part_of_opus; Codex family 'player trend metric'):** Skater Primary Points %
  - Formula: (goals+primary assists)/points. Shared processMetric uses cumulative sum/count, n-1 sample variance and trailing 3/5/10 means.
  - Purpose: Summarize observed skater primary points % over cumulative and rolling game windows.
  - Inputs/units: Source metric primary_points_pct per admitted game; missing observations omitted from accumulator. Raw units: source ratio/percentage scale; exact fraction-versus-percentage feed scale is not established by this accessor alone.
  - Output scale: Raw value; cumulative mean/sample variance/SD; complete 3/5/10-observation rolling means; sample size.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f. PLAYER_TREND_CALCULATION_VERSION=player-trend-v2-full-history-source-units Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the…
- **Codex view (core-154, calculation, codex_part_of_opus; Codex family 'player trend metric'):** Skater Expected Shooting %
  - Formula: 100*ixG/individual unblocked attempts; not ordinary shots-on-net SH%. Shared processMetric uses cumulative sum/count, n-1 sample variance and trailing 3/5/10 means.
  - Purpose: Summarize observed skater expected shooting % over cumulative and rolling game windows.
  - Inputs/units: Source metric expected_shooting_pct per admitted game; missing observations omitted from accumulator. Raw units: source ratio/percentage scale; exact fraction-versus-percentage feed scale is not established by this accessor alone.
  - Output scale: Raw value; cumulative mean/sample variance/SD; complete 3/5/10-observation rolling means; sample size.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f. PLAYER_TREND_CALCULATION_VERSION=player-trend-v2-full-history-source-units Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the…
- **Codex view (core-155, calculation, codex_part_of_opus; Codex family 'player trend metric'):** Skater IPP
  - Formula: Read measured source metric; no new raw-value formula in this accessor. Shared processMetric uses cumulative sum/count, n-1 sample variance and trailing 3/5/10 means.
  - Purpose: Summarize observed skater ipp over cumulative and rolling game windows.
  - Inputs/units: Source metric ipp per admitted game; missing observations omitted from accumulator. Raw units: source ratio/percentage scale; exact fraction-versus-percentage feed scale is not established by this accessor alone.
  - Output scale: Raw value; cumulative mean/sample variance/SD; complete 3/5/10-observation rolling means; sample size.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f. PLAYER_TREND_CALCULATION_VERSION=player-trend-v2-full-history-source-units Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the…
- **Codex view (core-156, calculation, codex_part_of_opus; Codex family 'player trend metric'):** Skater iSCF / 60
  - Formula: Read measured source metric; no new raw-value formula in this accessor. Shared processMetric uses cumulative sum/count, n-1 sample variance and trailing 3/5/10 means.
  - Purpose: Summarize observed skater iscf / 60 over cumulative and rolling game windows.
  - Inputs/units: Source metric iscf_per_60 per admitted game; missing observations omitted from accumulator. Raw units: count per 60 minutes.
  - Output scale: Raw value; cumulative mean/sample variance/SD; complete 3/5/10-observation rolling means; sample size.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f. PLAYER_TREND_CALCULATION_VERSION=player-trend-v2-full-history-source-units Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the…
- **Codex view (core-157, calculation, codex_part_of_opus; Codex family 'player trend metric'):** Skater iHDCF / 60
  - Formula: Read measured source metric; no new raw-value formula in this accessor. Shared processMetric uses cumulative sum/count, n-1 sample variance and trailing 3/5/10 means.
  - Purpose: Summarize observed skater ihdcf / 60 over cumulative and rolling game windows.
  - Inputs/units: Source metric ihdcf_per_60 per admitted game; missing observations omitted from accumulator. Raw units: count per 60 minutes.
  - Output scale: Raw value; cumulative mean/sample variance/SD; complete 3/5/10-observation rolling means; sample size.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f. PLAYER_TREND_CALCULATION_VERSION=player-trend-v2-full-history-source-units Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the…
- **Codex view (core-158, calculation, codex_part_of_opus; Codex family 'player trend metric'):** Skater Time on Ice
  - Formula: Read measured source metric; no new raw-value formula in this accessor. Shared processMetric uses cumulative sum/count, n-1 sample variance and trailing 3/5/10 means.
  - Purpose: Summarize observed skater time on ice over cumulative and rolling game windows.
  - Inputs/units: Source metric toi per admitted game; missing observations omitted from accumulator. Raw units: time as supplied by the game-log adapter; accessor alone does not establish all upstream units.
  - Output scale: Raw value; cumulative mean/sample variance/SD; complete 3/5/10-observation rolling means; sample size.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f. PLAYER_TREND_CALCULATION_VERSION=player-trend-v2-full-history-source-units Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the…
- **Codex view (core-159, calculation, codex_part_of_opus; Codex family 'player trend metric'):** Skater Power Play TOI
  - Formula: Read measured source metric; no new raw-value formula in this accessor. Shared processMetric uses cumulative sum/count, n-1 sample variance and trailing 3/5/10 means.
  - Purpose: Summarize observed skater power play toi over cumulative and rolling game windows.
  - Inputs/units: Source metric pp_toi per admitted game; missing observations omitted from accumulator. Raw units: time as supplied by the game-log adapter; accessor alone does not establish all upstream units.
  - Output scale: Raw value; cumulative mean/sample variance/SD; complete 3/5/10-observation rolling means; sample size.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f. PLAYER_TREND_CALCULATION_VERSION=player-trend-v2-full-history-source-units Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the…
- **Codex view (core-160, calculation, codex_part_of_opus; Codex family 'player trend metric'):** Skater Power Play TOI %
  - Formula: Read measured source metric; no new raw-value formula in this accessor. Shared processMetric uses cumulative sum/count, n-1 sample variance and trailing 3/5/10 means.
  - Purpose: Summarize observed skater power play toi % over cumulative and rolling game windows.
  - Inputs/units: Source metric pp_toi_pct per admitted game; missing observations omitted from accumulator. Raw units: source ratio/percentage scale; exact fraction-versus-percentage feed scale is not established by this accessor alone.
  - Output scale: Raw value; cumulative mean/sample variance/SD; complete 3/5/10-observation rolling means; sample size.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f. PLAYER_TREND_CALCULATION_VERSION=player-trend-v2-full-history-source-units Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the…
- **Codex view (core-161, calculation, codex_part_of_opus; Codex family 'player trend metric'):** Skater On-Ice Shooting %
  - Formula: Read measured source metric; no new raw-value formula in this accessor. Shared processMetric uses cumulative sum/count, n-1 sample variance and trailing 3/5/10 means.
  - Purpose: Summarize observed skater on-ice shooting % over cumulative and rolling game windows.
  - Inputs/units: Source metric on_ice_shooting_pct per admitted game; missing observations omitted from accumulator. Raw units: source ratio/percentage scale; exact fraction-versus-percentage feed scale is not established by this accessor alone.
  - Output scale: Raw value; cumulative mean/sample variance/SD; complete 3/5/10-observation rolling means; sample size.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f. PLAYER_TREND_CALCULATION_VERSION=player-trend-v2-full-history-source-units Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the…
- **Codex view (core-162, calculation, codex_part_of_opus; Codex family 'player trend metric'):** Skater PDO
  - Formula: Read measured source metric; no new raw-value formula in this accessor. Shared processMetric uses cumulative sum/count, n-1 sample variance and trailing 3/5/10 means.
  - Purpose: Summarize observed skater pdo over cumulative and rolling game windows.
  - Inputs/units: Source metric pdo per admitted game; missing observations omitted from accumulator. Raw units: source ratio/percentage scale; exact fraction-versus-percentage feed scale is not established by this accessor alone.
  - Output scale: Raw value; cumulative mean/sample variance/SD; complete 3/5/10-observation rolling means; sample size.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f. PLAYER_TREND_CALCULATION_VERSION=player-trend-v2-full-history-source-units Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the…
- **Codex view (core-163, calculation, codex_part_of_opus; Codex family 'player trend metric'):** Skater CF
  - Formula: Read measured source metric; no new raw-value formula in this accessor. Shared processMetric uses cumulative sum/count, n-1 sample variance and trailing 3/5/10 means.
  - Purpose: Summarize observed skater cf over cumulative and rolling game windows.
  - Inputs/units: Source metric cf per admitted game; missing observations omitted from accumulator. Raw units: event count.
  - Output scale: Raw value; cumulative mean/sample variance/SD; complete 3/5/10-observation rolling means; sample size.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f. PLAYER_TREND_CALCULATION_VERSION=player-trend-v2-full-history-source-units Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the…
- **Codex view (core-164, calculation, codex_part_of_opus; Codex family 'player trend metric'):** Skater FF
  - Formula: Read measured source metric; no new raw-value formula in this accessor. Shared processMetric uses cumulative sum/count, n-1 sample variance and trailing 3/5/10 means.
  - Purpose: Summarize observed skater ff over cumulative and rolling game windows.
  - Inputs/units: Source metric ff per admitted game; missing observations omitted from accumulator. Raw units: event count.
  - Output scale: Raw value; cumulative mean/sample variance/SD; complete 3/5/10-observation rolling means; sample size.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f. PLAYER_TREND_CALCULATION_VERSION=player-trend-v2-full-history-source-units Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the…
- **Codex view (core-165, calculation, codex_part_of_opus; Codex family 'player trend metric'):** Skater CF / 60
  - Formula: Read measured source metric; no new raw-value formula in this accessor. Shared processMetric uses cumulative sum/count, n-1 sample variance and trailing 3/5/10 means.
  - Purpose: Summarize observed skater cf / 60 over cumulative and rolling game windows.
  - Inputs/units: Source metric cf_per_60 per admitted game; missing observations omitted from accumulator. Raw units: count per 60 minutes.
  - Output scale: Raw value; cumulative mean/sample variance/SD; complete 3/5/10-observation rolling means; sample size.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f. PLAYER_TREND_CALCULATION_VERSION=player-trend-v2-full-history-source-units Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the…
- **Codex view (core-166, calculation, codex_part_of_opus; Codex family 'player trend metric'):** Skater FF / 60
  - Formula: Read measured source metric; no new raw-value formula in this accessor. Shared processMetric uses cumulative sum/count, n-1 sample variance and trailing 3/5/10 means.
  - Purpose: Summarize observed skater ff / 60 over cumulative and rolling game windows.
  - Inputs/units: Source metric ff_per_60 per admitted game; missing observations omitted from accumulator. Raw units: count per 60 minutes.
  - Output scale: Raw value; cumulative mean/sample variance/SD; complete 3/5/10-observation rolling means; sample size.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f. PLAYER_TREND_CALCULATION_VERSION=player-trend-v2-full-history-source-units Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the…
- **Codex view (core-167, calculation, codex_part_of_opus; Codex family 'player trend metric'):** Skater CF %
  - Formula: Use source counts percentage, otherwise rates percentage. Shared processMetric uses cumulative sum/count, n-1 sample variance and trailing 3/5/10 means.
  - Purpose: Summarize observed skater cf % over cumulative and rolling game windows.
  - Inputs/units: Source metric cf_pct per admitted game; missing observations omitted from accumulator. Raw units: source ratio/percentage scale; exact fraction-versus-percentage feed scale is not established by this accessor alone.
  - Output scale: Raw value; cumulative mean/sample variance/SD; complete 3/5/10-observation rolling means; sample size.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f. PLAYER_TREND_CALCULATION_VERSION=player-trend-v2-full-history-source-units Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the…
- **Codex view (core-168, calculation, codex_part_of_opus; Codex family 'player trend metric'):** Skater FF %
  - Formula: Use source counts percentage, otherwise rates percentage. Shared processMetric uses cumulative sum/count, n-1 sample variance and trailing 3/5/10 means.
  - Purpose: Summarize observed skater ff % over cumulative and rolling game windows.
  - Inputs/units: Source metric ff_pct per admitted game; missing observations omitted from accumulator. Raw units: source ratio/percentage scale; exact fraction-versus-percentage feed scale is not established by this accessor alone.
  - Output scale: Raw value; cumulative mean/sample variance/SD; complete 3/5/10-observation rolling means; sample size.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f. PLAYER_TREND_CALCULATION_VERSION=player-trend-v2-full-history-source-units Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the…
- **Codex view (core-169, calculation, codex_part_of_opus; Codex family 'player trend metric'):** Skater Goals
  - Formula: Read measured source metric; no new raw-value formula in this accessor. Shared processMetric uses cumulative sum/count, n-1 sample variance and trailing 3/5/10 means.
  - Purpose: Summarize observed skater goals over cumulative and rolling game windows.
  - Inputs/units: Source metric goals per admitted game; missing observations omitted from accumulator. Raw units: event count.
  - Output scale: Raw value; cumulative mean/sample variance/SD; complete 3/5/10-observation rolling means; sample size.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f. PLAYER_TREND_CALCULATION_VERSION=player-trend-v2-full-history-source-units Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the…
- **Codex view (core-170, calculation, codex_part_of_opus; Codex family 'player trend metric'):** Skater Assists
  - Formula: Read measured source metric; no new raw-value formula in this accessor. Shared processMetric uses cumulative sum/count, n-1 sample variance and trailing 3/5/10 means.
  - Purpose: Summarize observed skater assists over cumulative and rolling game windows.
  - Inputs/units: Source metric assists per admitted game; missing observations omitted from accumulator. Raw units: event count.
  - Output scale: Raw value; cumulative mean/sample variance/SD; complete 3/5/10-observation rolling means; sample size.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f. PLAYER_TREND_CALCULATION_VERSION=player-trend-v2-full-history-source-units Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the…
- **Codex view (core-171, calculation, codex_part_of_opus; Codex family 'player trend metric'):** Skater Hits
  - Formula: Read measured source metric; no new raw-value formula in this accessor. Shared processMetric uses cumulative sum/count, n-1 sample variance and trailing 3/5/10 means.
  - Purpose: Summarize observed skater hits over cumulative and rolling game windows.
  - Inputs/units: Source metric hits per admitted game; missing observations omitted from accumulator. Raw units: event count.
  - Output scale: Raw value; cumulative mean/sample variance/SD; complete 3/5/10-observation rolling means; sample size.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f. PLAYER_TREND_CALCULATION_VERSION=player-trend-v2-full-history-source-units Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the…
- **Codex view (core-172, calculation, codex_part_of_opus; Codex family 'player trend metric'):** Skater Blocked Shots
  - Formula: Read measured source metric; no new raw-value formula in this accessor. Shared processMetric uses cumulative sum/count, n-1 sample variance and trailing 3/5/10 means.
  - Purpose: Summarize observed skater blocked shots over cumulative and rolling game windows.
  - Inputs/units: Source metric blocked_shots per admitted game; missing observations omitted from accumulator. Raw units: event count.
  - Output scale: Raw value; cumulative mean/sample variance/SD; complete 3/5/10-observation rolling means; sample size.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f. PLAYER_TREND_CALCULATION_VERSION=player-trend-v2-full-history-source-units Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the…
- **Codex view (core-173, calculation, codex_part_of_opus; Codex family 'player trend metric'):** Skater Power Play Goals
  - Formula: Read measured source metric; no new raw-value formula in this accessor. Shared processMetric uses cumulative sum/count, n-1 sample variance and trailing 3/5/10 means.
  - Purpose: Summarize observed skater power play goals over cumulative and rolling game windows.
  - Inputs/units: Source metric pp_goals per admitted game; missing observations omitted from accumulator. Raw units: event count.
  - Output scale: Raw value; cumulative mean/sample variance/SD; complete 3/5/10-observation rolling means; sample size.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f. PLAYER_TREND_CALCULATION_VERSION=player-trend-v2-full-history-source-units Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the…
- **Codex view (core-174, calculation, codex_part_of_opus; Codex family 'player trend metric'):** Skater Power Play Assists
  - Formula: Read measured source metric; no new raw-value formula in this accessor. Shared processMetric uses cumulative sum/count, n-1 sample variance and trailing 3/5/10 means.
  - Purpose: Summarize observed skater power play assists over cumulative and rolling game windows.
  - Inputs/units: Source metric pp_assists per admitted game; missing observations omitted from accumulator. Raw units: event count.
  - Output scale: Raw value; cumulative mean/sample variance/SD; complete 3/5/10-observation rolling means; sample size.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f. PLAYER_TREND_CALCULATION_VERSION=player-trend-v2-full-history-source-units Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the…
- **Codex view (core-175, calculation, codex_part_of_opus; Codex family 'player trend metric'):** Skater Games Played
  - Formula: Read measured source metric; no new raw-value formula in this accessor. Shared processMetric uses cumulative sum/count, n-1 sample variance and trailing 3/5/10 means.
  - Purpose: Summarize observed skater games played over cumulative and rolling game windows.
  - Inputs/units: Source metric games_played per admitted game; missing observations omitted from accumulator. Raw units: event count.
  - Output scale: Raw value; cumulative mean/sample variance/SD; complete 3/5/10-observation rolling means; sample size.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f. PLAYER_TREND_CALCULATION_VERSION=player-trend-v2-full-history-source-units Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the…
- **Codex view (core-176, calculation, codex_part_of_opus; Codex family 'player trend metric'):** Goalie Games Played
  - Formula: Read measured source metric; no new raw-value formula in this accessor. Shared processMetric uses cumulative sum/count, n-1 sample variance and trailing 3/5/10 means.
  - Purpose: Summarize observed goalie games played over cumulative and rolling game windows.
  - Inputs/units: Source metric games_played per admitted game; missing observations omitted from accumulator. Raw units: event count.
  - Output scale: Raw value; cumulative mean/sample variance/SD; complete 3/5/10-observation rolling means; sample size.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f. PLAYER_TREND_CALCULATION_VERSION=player-trend-v2-full-history-source-units Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the…
- **Codex view (core-177, calculation, codex_part_of_opus; Codex family 'player trend metric'):** Goalie Games Started
  - Formula: Read measured source metric; no new raw-value formula in this accessor. Shared processMetric uses cumulative sum/count, n-1 sample variance and trailing 3/5/10 means.
  - Purpose: Summarize observed goalie games started over cumulative and rolling game windows.
  - Inputs/units: Source metric games_started per admitted game; missing observations omitted from accumulator. Raw units: event count.
  - Output scale: Raw value; cumulative mean/sample variance/SD; complete 3/5/10-observation rolling means; sample size.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f. PLAYER_TREND_CALCULATION_VERSION=player-trend-v2-full-history-source-units Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the…
- **Codex view (core-178, calculation, codex_part_of_opus; Codex family 'player trend metric'):** Goalie Wins
  - Formula: Read measured source metric; no new raw-value formula in this accessor. Shared processMetric uses cumulative sum/count, n-1 sample variance and trailing 3/5/10 means.
  - Purpose: Summarize observed goalie wins over cumulative and rolling game windows.
  - Inputs/units: Source metric wins per admitted game; missing observations omitted from accumulator. Raw units: event count.
  - Output scale: Raw value; cumulative mean/sample variance/SD; complete 3/5/10-observation rolling means; sample size.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f. PLAYER_TREND_CALCULATION_VERSION=player-trend-v2-full-history-source-units Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the…
- **Codex view (core-179, calculation, codex_part_of_opus; Codex family 'player trend metric'):** Goalie Losses
  - Formula: Read measured source metric; no new raw-value formula in this accessor. Shared processMetric uses cumulative sum/count, n-1 sample variance and trailing 3/5/10 means.
  - Purpose: Summarize observed goalie losses over cumulative and rolling game windows.
  - Inputs/units: Source metric losses per admitted game; missing observations omitted from accumulator. Raw units: event count.
  - Output scale: Raw value; cumulative mean/sample variance/SD; complete 3/5/10-observation rolling means; sample size.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f. PLAYER_TREND_CALCULATION_VERSION=player-trend-v2-full-history-source-units Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the…
- **Codex view (core-180, calculation, codex_part_of_opus; Codex family 'player trend metric'):** Goalie OT Losses
  - Formula: Read measured source metric; no new raw-value formula in this accessor. Shared processMetric uses cumulative sum/count, n-1 sample variance and trailing 3/5/10 means.
  - Purpose: Summarize observed goalie ot losses over cumulative and rolling game windows.
  - Inputs/units: Source metric ot_losses per admitted game; missing observations omitted from accumulator. Raw units: event count.
  - Output scale: Raw value; cumulative mean/sample variance/SD; complete 3/5/10-observation rolling means; sample size.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f. PLAYER_TREND_CALCULATION_VERSION=player-trend-v2-full-history-source-units Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the…
- **Codex view (core-181, calculation, codex_part_of_opus; Codex family 'player trend metric'):** Goalie Save Percentage
  - Formula: Read measured source metric; no new raw-value formula in this accessor. Shared processMetric uses cumulative sum/count, n-1 sample variance and trailing 3/5/10 means.
  - Purpose: Summarize observed goalie save percentage over cumulative and rolling game windows.
  - Inputs/units: Source metric save_pct per admitted game; missing observations omitted from accumulator. Raw units: source ratio/percentage scale; exact fraction-versus-percentage feed scale is not established by this accessor alone.
  - Output scale: Raw value; cumulative mean/sample variance/SD; complete 3/5/10-observation rolling means; sample size.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f. PLAYER_TREND_CALCULATION_VERSION=player-trend-v2-full-history-source-units Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the…
- **Codex view (core-182, calculation, codex_part_of_opus; Codex family 'player trend metric'):** Goalie Saves
  - Formula: Read measured source metric; no new raw-value formula in this accessor. Shared processMetric uses cumulative sum/count, n-1 sample variance and trailing 3/5/10 means.
  - Purpose: Summarize observed goalie saves over cumulative and rolling game windows.
  - Inputs/units: Source metric saves per admitted game; missing observations omitted from accumulator. Raw units: event count.
  - Output scale: Raw value; cumulative mean/sample variance/SD; complete 3/5/10-observation rolling means; sample size.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f. PLAYER_TREND_CALCULATION_VERSION=player-trend-v2-full-history-source-units Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the…
- **Codex view (core-183, calculation, codex_part_of_opus; Codex family 'player trend metric'):** Goalie Goals Against
  - Formula: Read measured source metric; no new raw-value formula in this accessor. Shared processMetric uses cumulative sum/count, n-1 sample variance and trailing 3/5/10 means.
  - Purpose: Summarize observed goalie goals against over cumulative and rolling game windows.
  - Inputs/units: Source metric goals_against per admitted game; missing observations omitted from accumulator. Raw units: event count.
  - Output scale: Raw value; cumulative mean/sample variance/SD; complete 3/5/10-observation rolling means; sample size.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f. PLAYER_TREND_CALCULATION_VERSION=player-trend-v2-full-history-source-units Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the…
- **Codex view (core-184, calculation, codex_part_of_opus; Codex family 'player trend metric'):** Goalie Goals Against Avg
  - Formula: Read measured source metric; no new raw-value formula in this accessor. Shared processMetric uses cumulative sum/count, n-1 sample variance and trailing 3/5/10 means.
  - Purpose: Summarize observed goalie goals against avg over cumulative and rolling game windows.
  - Inputs/units: Source metric goals_against_avg per admitted game; missing observations omitted from accumulator. Raw units: goals against per 60 minutes.
  - Output scale: Raw value; cumulative mean/sample variance/SD; complete 3/5/10-observation rolling means; sample size.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f. PLAYER_TREND_CALCULATION_VERSION=player-trend-v2-full-history-source-units Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the…
- **Codex view (core-185, calculation, codex_part_of_opus; Codex family 'player trend metric'):** Goalie Shots Against
  - Formula: Read measured source metric; no new raw-value formula in this accessor. Shared processMetric uses cumulative sum/count, n-1 sample variance and trailing 3/5/10 means.
  - Purpose: Summarize observed goalie shots against over cumulative and rolling game windows.
  - Inputs/units: Source metric shots_against per admitted game; missing observations omitted from accumulator. Raw units: event count.
  - Output scale: Raw value; cumulative mean/sample variance/SD; complete 3/5/10-observation rolling means; sample size.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f. PLAYER_TREND_CALCULATION_VERSION=player-trend-v2-full-history-source-units Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the…
- **Codex view (core-186, calculation, codex_part_of_opus; Codex family 'player trend metric'):** Goalie Time on Ice
  - Formula: Read measured source metric; no new raw-value formula in this accessor. Shared processMetric uses cumulative sum/count, n-1 sample variance and trailing 3/5/10 means.
  - Purpose: Summarize observed goalie time on ice over cumulative and rolling game windows.
  - Inputs/units: Source metric time_on_ice per admitted game; missing observations omitted from accumulator. Raw units: time as supplied by the game-log adapter; accessor alone does not establish all upstream units.
  - Output scale: Raw value; cumulative mean/sample variance/SD; complete 3/5/10-observation rolling means; sample size.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f. PLAYER_TREND_CALCULATION_VERSION=player-trend-v2-full-history-source-units Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the…
- **Codex view (core-187, calculation, codex_part_of_opus; Codex family 'player trend metric'):** Goalie Shutouts
  - Formula: Read measured source metric; no new raw-value formula in this accessor. Shared processMetric uses cumulative sum/count, n-1 sample variance and trailing 3/5/10 means.
  - Purpose: Summarize observed goalie shutouts over cumulative and rolling game windows.
  - Inputs/units: Source metric shutouts per admitted game; missing observations omitted from accumulator. Raw units: event count.
  - Output scale: Raw value; cumulative mean/sample variance/SD; complete 3/5/10-observation rolling means; sample size.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f. PLAYER_TREND_CALCULATION_VERSION=player-trend-v2-full-history-source-units Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the…
- **Codex view (core-188, calculation, codex_part_of_opus; Codex family 'player trend metric'):** Goalie Complete Game %
  - Formula: Read measured source metric; no new raw-value formula in this accessor. Shared processMetric uses cumulative sum/count, n-1 sample variance and trailing 3/5/10 means.
  - Purpose: Summarize observed goalie complete game % over cumulative and rolling game windows.
  - Inputs/units: Source metric complete_game_pct per admitted game; missing observations omitted from accumulator. Raw units: source ratio/percentage scale; exact fraction-versus-percentage feed scale is not established by this accessor alone.
  - Output scale: Raw value; cumulative mean/sample variance/SD; complete 3/5/10-observation rolling means; sample size.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f. PLAYER_TREND_CALCULATION_VERSION=player-trend-v2-full-history-source-units Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the…
- **Codex view (core-189, calculation, codex_part_of_opus; Codex family 'player trend metric'):** Goalie Quality Starts
  - Formula: Read measured source metric; no new raw-value formula in this accessor. Shared processMetric uses cumulative sum/count, n-1 sample variance and trailing 3/5/10 means.
  - Purpose: Summarize observed goalie quality starts over cumulative and rolling game windows.
  - Inputs/units: Source metric quality_start per admitted game; missing observations omitted from accumulator. Raw units: event count.
  - Output scale: Raw value; cumulative mean/sample variance/SD; complete 3/5/10-observation rolling means; sample size.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f. PLAYER_TREND_CALCULATION_VERSION=player-trend-v2-full-history-source-units Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the…
- **Codex view (core-190, calculation, codex_part_of_opus; Codex family 'player trend metric'):** Goalie Quality Starts %
  - Formula: Read measured source metric; no new raw-value formula in this accessor. Shared processMetric uses cumulative sum/count, n-1 sample variance and trailing 3/5/10 means.
  - Purpose: Summarize observed goalie quality starts % over cumulative and rolling game windows.
  - Inputs/units: Source metric quality_starts_pct per admitted game; missing observations omitted from accumulator. Raw units: source ratio/percentage scale; exact fraction-versus-percentage feed scale is not established by this accessor alone.
  - Output scale: Raw value; cumulative mean/sample variance/SD; complete 3/5/10-observation rolling means; sample size.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f. PLAYER_TREND_CALCULATION_VERSION=player-trend-v2-full-history-source-units Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the…
- **Codex view (core-191, calculation, codex_part_of_opus; Codex family 'player trend metric'):** Goalie Shots Against / 60
  - Formula: Read measured source metric; no new raw-value formula in this accessor. Shared processMetric uses cumulative sum/count, n-1 sample variance and trailing 3/5/10 means.
  - Purpose: Summarize observed goalie shots against / 60 over cumulative and rolling game windows.
  - Inputs/units: Source metric shots_against_per_60 per admitted game; missing observations omitted from accumulator. Raw units: count per 60 minutes.
  - Output scale: Raw value; cumulative mean/sample variance/SD; complete 3/5/10-observation rolling means; sample size.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f. PLAYER_TREND_CALCULATION_VERSION=player-trend-v2-full-history-source-units Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the…
- **Codex view (core-192, calculation, codex_part_of_opus; Codex family 'player trend metric'):** Goalie Goals
  - Formula: Read measured source metric; no new raw-value formula in this accessor. Shared processMetric uses cumulative sum/count, n-1 sample variance and trailing 3/5/10 means.
  - Purpose: Summarize observed goalie goals over cumulative and rolling game windows.
  - Inputs/units: Source metric goals per admitted game; missing observations omitted from accumulator. Raw units: event count.
  - Output scale: Raw value; cumulative mean/sample variance/SD; complete 3/5/10-observation rolling means; sample size.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f. PLAYER_TREND_CALCULATION_VERSION=player-trend-v2-full-history-source-units Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the…
- **Codex view (core-193, calculation, codex_part_of_opus; Codex family 'player trend metric'):** Goalie Assists
  - Formula: Read measured source metric; no new raw-value formula in this accessor. Shared processMetric uses cumulative sum/count, n-1 sample variance and trailing 3/5/10 means.
  - Purpose: Summarize observed goalie assists over cumulative and rolling game windows.
  - Inputs/units: Source metric assists per admitted game; missing observations omitted from accumulator. Raw units: event count.
  - Output scale: Raw value; cumulative mean/sample variance/SD; complete 3/5/10-observation rolling means; sample size.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f. PLAYER_TREND_CALCULATION_VERSION=player-trend-v2-full-history-source-units Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the…
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex core-149): The accessor and processMetric are the executable contract. Source-valued metrics remain distinguished from in-house rolling summaries.
  - Intended contract (Codex core-150): The accessor and processMetric are the executable contract. Source-valued metrics remain distinguished from in-house rolling summaries.
  - Intended contract (Codex core-151): The accessor and processMetric are the executable contract. Source-valued metrics remain distinguished from in-house rolling summaries.
  - Intended contract (Codex core-152): The accessor and processMetric are the executable contract. Source-valued metrics remain distinguished from in-house rolling summaries.
  - Intended contract (Codex core-153): The accessor and processMetric are the executable contract. Source-valued metrics remain distinguished from in-house rolling summaries.
  - Intended contract (Codex core-154): The accessor and processMetric are the executable contract. Source-valued metrics remain distinguished from in-house rolling summaries.
  - Intended contract (Codex core-155): The accessor and processMetric are the executable contract. Source-valued metrics remain distinguished from in-house rolling summaries.
  - Intended contract (Codex core-156): The accessor and processMetric are the executable contract. Source-valued metrics remain distinguished from in-house rolling summaries.
  - Intended contract (Codex core-157): The accessor and processMetric are the executable contract. Source-valued metrics remain distinguished from in-house rolling summaries.
  - Intended contract (Codex core-158): The accessor and processMetric are the executable contract. Source-valued metrics remain distinguished from in-house rolling summaries.
  - Intended contract (Codex core-159): The accessor and processMetric are the executable contract. Source-valued metrics remain distinguished from in-house rolling summaries.
  - Intended contract (Codex core-160): The accessor and processMetric are the executable contract. Source-valued metrics remain distinguished from in-house rolling summaries.
  - Intended contract (Codex core-161): The accessor and processMetric are the executable contract. Source-valued metrics remain distinguished from in-house rolling summaries.
  - Intended contract (Codex core-162): The accessor and processMetric are the executable contract. Source-valued metrics remain distinguished from in-house rolling summaries.
  - Intended contract (Codex core-163): The accessor and processMetric are the executable contract. Source-valued metrics remain distinguished from in-house rolling summaries.
  - Intended contract (Codex core-164): The accessor and processMetric are the executable contract. Source-valued metrics remain distinguished from in-house rolling summaries.
  - Intended contract (Codex core-165): The accessor and processMetric are the executable contract. Source-valued metrics remain distinguished from in-house rolling summaries.
  - Intended contract (Codex core-166): The accessor and processMetric are the executable contract. Source-valued metrics remain distinguished from in-house rolling summaries.
  - Intended contract (Codex core-167): The accessor and processMetric are the executable contract. Source-valued metrics remain distinguished from in-house rolling summaries.
  - Intended contract (Codex core-168): The accessor and processMetric are the executable contract. Source-valued metrics remain distinguished from in-house rolling summaries.
  - Intended contract (Codex core-169): The accessor and processMetric are the executable contract. Source-valued metrics remain distinguished from in-house rolling summaries.
  - Intended contract (Codex core-170): The accessor and processMetric are the executable contract. Source-valued metrics remain distinguished from in-house rolling summaries.
  - Intended contract (Codex core-171): The accessor and processMetric are the executable contract. Source-valued metrics remain distinguished from in-house rolling summaries.
  - Intended contract (Codex core-172): The accessor and processMetric are the executable contract. Source-valued metrics remain distinguished from in-house rolling summaries.
  - Intended contract (Codex core-173): The accessor and processMetric are the executable contract. Source-valued metrics remain distinguished from in-house rolling summaries.
  - Intended contract (Codex core-174): The accessor and processMetric are the executable contract. Source-valued metrics remain distinguished from in-house rolling summaries.
  - Intended contract (Codex core-175): The accessor and processMetric are the executable contract. Source-valued metrics remain distinguished from in-house rolling summaries.
  - Intended contract (Codex core-176): The accessor and processMetric are the executable contract. Source-valued metrics remain distinguished from in-house rolling summaries.
  - Intended contract (Codex core-177): The accessor and processMetric are the executable contract. Source-valued metrics remain distinguished from in-house rolling summaries.
  - Intended contract (Codex core-178): The accessor and processMetric are the executable contract. Source-valued metrics remain distinguished from in-house rolling summaries.
  - Intended contract (Codex core-179): The accessor and processMetric are the executable contract. Source-valued metrics remain distinguished from in-house rolling summaries.
  - Intended contract (Codex core-180): The accessor and processMetric are the executable contract. Source-valued metrics remain distinguished from in-house rolling summaries.
  - Intended contract (Codex core-181): The accessor and processMetric are the executable contract. Source-valued metrics remain distinguished from in-house rolling summaries.
  - Intended contract (Codex core-182): The accessor and processMetric are the executable contract. Source-valued metrics remain distinguished from in-house rolling summaries.
  - Intended contract (Codex core-183): The accessor and processMetric are the executable contract. Source-valued metrics remain distinguished from in-house rolling summaries.
  - Intended contract (Codex core-184): The accessor and processMetric are the executable contract. Source-valued metrics remain distinguished from in-house rolling summaries.
  - Intended contract (Codex core-185): The accessor and processMetric are the executable contract. Source-valued metrics remain distinguished from in-house rolling summaries.
  - Intended contract (Codex core-186): The accessor and processMetric are the executable contract. Source-valued metrics remain distinguished from in-house rolling summaries.
  - Intended contract (Codex core-187): The accessor and processMetric are the executable contract. Source-valued metrics remain distinguished from in-house rolling summaries.
  - Intended contract (Codex core-188): The accessor and processMetric are the executable contract. Source-valued metrics remain distinguished from in-house rolling summaries.
  - Intended contract (Codex core-189): The accessor and processMetric are the executable contract. Source-valued metrics remain distinguished from in-house rolling summaries.
  - Intended contract (Codex core-190): The accessor and processMetric are the executable contract. Source-valued metrics remain distinguished from in-house rolling summaries.
  - Intended contract (Codex core-191): The accessor and processMetric are the executable contract. Source-valued metrics remain distinguished from in-house rolling summaries.
  - Intended contract (Codex core-192): The accessor and processMetric are the executable contract. Source-valued metrics remain distinguished from in-house rolling summaries.
  - Intended contract (Codex core-193): The accessor and processMetric are the executable contract. Source-valued metrics remain distinguished from in-house rolling summaries.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `Located only; not run for this inventory.`; `web/__tests__/pages/api/v1/trends/player-trends.test.ts`; `web/lib/trends/playerTrendCalculator.test.ts`
- **Leads (not audited):**
  - (opus) averages of per-game ratios (SH%, per-60) rather than ratio of sums
  - (opus) toi_per_game assumed minutes in shots/toi*60
  - (codex:core-149) ["Inventory only, not validation of the formula, source semantics or model quality."]
  - (codex:core-150) ["Inventory only, not validation of the formula, source semantics or model quality."]
  - (codex:core-151) ["Inventory only, not validation of the formula, source semantics or model quality."]
  - (codex:core-152) ["Inventory only, not validation of the formula, source semantics or model quality."]
  - (codex:core-153) ["Inventory only, not validation of the formula, source semantics or model quality."]
  - (codex:core-154) ["Inventory only, not validation of the formula, source semantics or model quality."]
  - (codex:core-155) ["Inventory only, not validation of the formula, source semantics or model quality."]
  - (codex:core-156) ["Inventory only, not validation of the formula, source semantics or model quality."]
  - (codex:core-157) ["Inventory only, not validation of the formula, source semantics or model quality."]
  - (codex:core-158) ["Inventory only, not validation of the formula, source semantics or model quality."]
  - (codex:core-159) ["Inventory only, not validation of the formula, source semantics or model quality."]
  - (codex:core-160) ["Inventory only, not validation of the formula, source semantics or model quality."]
  - (codex:core-161) ["Inventory only, not validation of the formula, source semantics or model quality."]
  - (codex:core-162) ["Inventory only, not validation of the formula, source semantics or model quality."]
  - (codex:core-163) ["Inventory only, not validation of the formula, source semantics or model quality."]
  - (codex:core-164) ["Inventory only, not validation of the formula, source semantics or model quality."]
  - (codex:core-165) ["Inventory only, not validation of the formula, source semantics or model quality."]
  - (codex:core-166) ["Inventory only, not validation of the formula, source semantics or model quality."]
  - (codex:core-167) ["Inventory only, not validation of the formula, source semantics or model quality."]
  - (codex:core-168) ["Inventory only, not validation of the formula, source semantics or model quality."]
  - (codex:core-169) ["Inventory only, not validation of the formula, source semantics or model quality."]
  - (codex:core-170) ["Inventory only, not validation of the formula, source semantics or model quality."]
  - (codex:core-171) ["Inventory only, not validation of the formula, source semantics or model quality."]
  - (codex:core-172) ["Inventory only, not validation of the formula, source semantics or model quality."]
  - (codex:core-173) ["Inventory only, not validation of the formula, source semantics or model quality."]
  - (codex:core-174) ["Inventory only, not validation of the formula, source semantics or model quality."]
  - (codex:core-175) ["Inventory only, not validation of the formula, source semantics or model quality."]
  - (codex:core-176) ["Inventory only, not validation of the formula, source semantics or model quality."]
  - (codex:core-177) ["Inventory only, not validation of the formula, source semantics or model quality."]
  - (codex:core-178) ["Inventory only, not validation of the formula, source semantics or model quality."]
  - (codex:core-179) ["Inventory only, not validation of the formula, source semantics or model quality."]
  - (codex:core-180) ["Inventory only, not validation of the formula, source semantics or model quality."]
  - (codex:core-181) ["Inventory only, not validation of the formula, source semantics or model quality."]
  - (codex:core-182) ["Inventory only, not validation of the formula, source semantics or model quality."]
  - (codex:core-183) ["Inventory only, not validation of the formula, source semantics or model quality."]
  - (codex:core-184) ["Inventory only, not validation of the formula, source semantics or model quality."]
  - (codex:core-185) ["Inventory only, not validation of the formula, source semantics or model quality."]
  - (codex:core-186) ["Inventory only, not validation of the formula, source semantics or model quality."]
  - (codex:core-187) ["Inventory only, not validation of the formula, source semantics or model quality."]
  - (codex:core-188) ["Inventory only, not validation of the formula, source semantics or model quality."]
  - (codex:core-189) ["Inventory only, not validation of the formula, source semantics or model quality."]
  - (codex:core-190) ["Inventory only, not validation of the formula, source semantics or model quality."]
  - (codex:core-191) ["Inventory only, not validation of the formula, source semantics or model quality."]
  - (codex:core-192) ["Inventory only, not validation of the formula, source semantics or model quality."]
  - (codex:core-193) ["Inventory only, not validation of the formula, source semantics or model quality."]

## M-TEAM-033 views nst_{all,5v5,pk,pp}_team_per_game

- **Match:** Opus only; Opus TEAM-004; Codex —
- **Purpose:** Per-game team rates from nst_avg_* totals
- **Where:** `supabase/migrations/20260716112908_production_schema_baseline.sql:15253 (nst_all_team_per_game)`; `supabase/migrations/20260716112908_production_schema_baseline.sql:15993 (nst_5v5_team_per_game)`; `supabase/migrations/20260716112908_production_schema_baseline.sql:16124 (nst_pk_team_per_game)`; `supabase/migrations/20260716112908_production_schema_baseline.sql:16170 (nst_pp_team_per_game)`
- **Tags (heuristic):** denominators: per game; generation: legacy
- **Opus view (TEAM-004):**
  - Method: x_per_game = total / gp for toi, w, l, otl, points, cf, ca, ff, fa, sf, sa, gf, ga, xgf, xga, scf, sca, hdcf, hdca, hdsf, hdsa, hdgf, hdga; percentages passed through.
  - Inputs/units: totals; sources: nst_avg_all, nst_avg_5v5, nst_avg_pk, nst_avg_pp
  - Output scale: per-game; writes: —
  - Status: unknown — feeds nst_att_def_scores (legacy goal projection route)
  - Consumers: nst_*_team_differentials; nst_att_def_scores
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: none listed
- **Leads (not audited):**
  - (opus) divides by gp without NULLIF - division by zero if gp=0
  - (opus) per-game (not per-60) so PP/PK rates depend on penalty volume

## M-TEAM-034 views nst_{all,5v5,pk,pp}_team_differentials

- **Match:** Opus only; Opus TEAM-006; Codex —
- **Purpose:** Team per-game metric % difference vs league per-game average
- **Where:** `supabase/migrations/20260716112908_production_schema_baseline.sql:15908 (nst_5v5_team_differentials)`; `supabase/migrations/20260716112908_production_schema_baseline.sql:16039 (nst_all_team_differentials)`; `supabase/migrations/20260716112908_production_schema_baseline.sql:19955 (nst_pk_team_differentials)`; `supabase/migrations/20260716112908_production_schema_baseline.sql:20040 (nst_pp_team_differentials)`
- **Tags (heuristic):** denominators: per game; generation: legacy
- **Opus view (TEAM-006):**
  - Method: diff = (team_per_game - league_per_game)/league_per_game * 100 for toi, cf, ca, ff, fa, sf, sa, gf, ga, xgf, xga, scf, sca, hdcf, hdca, hdsf, hdsa, hdgf, hdga ...
  - Inputs/units: per-game; sources: nst_*_team_per_game, nst_league_averages
  - Output scale: percent difference; writes: —
  - Status: legacy/dead — only nst_team_scores_all_strengths reads them; no web/ reader
  - Consumers: nst_team_scores_all_strengths
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: none listed
- **Leads (not audited):**
  - (opus) relative % differences of per-game counts; no strength-time normalization

## M-TEAM-035 Team power card trend and matchup tone thresholds

- **Match:** Opus only; Opus TEAM-013; Codex —
- **Purpose:** Colours team trend and tonight's matchup edge chips on the FORGE dashboard power card.
- **Where:** `web/components/forge-dashboard/TeamPowerCard.tsx:247 (allTrendsFlat)`; `web/components/forge-dashboard/TeamPowerCard.tsx:382 (matchupClass)`; `web/components/forge-dashboard/TeamPowerCard.tsx:477 (trendClass)`
- **Tags (heuristic):** generation: legacy
- **Opus view (TEAM-013):**
  - Method: trend up if trend10 > 0.5, down if < -0.5, else flat; all-flat warning if every \|trend10\| < 0.01; matchup edge up if > 1, down if < -1; spark rise if ctpiDelta >= 0.
  - Inputs/units: rating points; sources: team power ratings, /api/v1/trends/team-ctpi
  - Output scale: 3-level tone; writes: —
  - Status: legacy/dead — no importers of TeamPowerCard found
  - Consumers: none found (no importers)
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: none listed
- **Leads (not audited):**
  - (opus) fixed ±0.5 / ±1 cutoffs not tied to rating SD

## M-TEAM-036 Underlying stats team rating bar width (70–130 window)

- **Match:** Opus only; Opus TEAM-014; Codex —
- **Purpose:** Maps team offense/defense ratings onto a bar.
- **Where:** `web/components/underlying-stats/UnderlyingStatsDashboard.tsx:56 (ratingBarWidth)`
- **Tags (heuristic):** denominators: per 60; generation: current
- **Opus view (TEAM-014):**
  - Method: width% = clamp(((rating-70)/60)*100, 4, 100).
  - Inputs/units: rating (100 = league avg); sources: team power ratings (TEAM-030)
  - Output scale: percent 4-100; writes: —
  - Status: live — underlying stats dashboard
  - Consumers: pages/underlying-stats/index.tsx
- **Audit context:**
  - Intent (Opus): UnderlyingStatsDashboard.tsx:55 comment: league-average ratings sit at 100; map roughly 70-130
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: none listed
- **Leads (not audited):**
  - (opus) with ratings = 100+15z the window is ±2 SD; values beyond clip, and min 4% hides very low ratings' magnitude

## M-TEAM-037 Opponent record strength-of-schedule tally

- **Match:** Opus only; Opus TEAM-016; Codex —
- **Purpose:** Daily per-team snapshot of own point%/win% and the summed W/L/OTL of past and future regular-season opponents.
- **Where:** `web/pages/api/v1/db/update-team-sos.ts:187 (handler, loop at 240-310)`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: per game; generation: current
- **Opus view (TEAM-016):**
  - Method: team_point_pct = points/(GP*2) (points fallback wins*2+OTL); team_win_pct = wins/GP. For each scheduled game: opponent's CURRENT-DATE standings W/L/OTL summed into past (gameDate <= date) or future buckets; opponents listed with dates. Downstream lib computeSosRatings turns these into win%.
  - Inputs/units: standings counts; sources: NHL api-web standings/{date}, NHL club schedule-season API
  - Output scale: fractions 0-1; summed W/L/OTL counts; writes: sos_standings
  - Status: live — route ledger calls=1; read by trends/team-sos (dashboard)
  - Consumers: web/pages/api/v1/trends/team-sos.ts (computeSosRatings in lib); web/lib/underlying-stats/teamScheduleStrength.ts; web/lib/supabase/sosStandings.js; web/pages/statsPlaceholder.tsx
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: RPI/OWP: opponents' winning percentage excluding games against the team; NHL points% convention
  - Fixtures/test data: none listed
  - Tests: `web/__tests__/pages/api/v1/db/cron-audit-wrappers.test.ts (wrapper only)`; `web/__tests__/pages/api/v1/trends/team-sos.test.ts (reader)`
- **Leads (not audited):**
  - (opus) opponent records do not exclude games played against this team (standard OWP excludes head-to-head)
  - (opus) past opponents use their record as of the snapshot date, not as of the game date; repeated opponents are counted once per game
  - (opus) same-day games count as 'past' (gameDate <= currentDate) even before puck drop
  - (opus) OTL counted separately; downstream win% treatment of OTL not verified here

## M-TEAM-038 Underlying-stats landing popover component z-scores and special-teams bonus (client-side)

- **Match:** Opus only; Opus TEAM-017; Codex —
- **Purpose:** Explain each team's offense/defense/pace rating in popovers by showing each component vs the league mean as a z-score and the PP/PK tier bonus.
- **Where:** `web/pages/underlying-stats/index.tsx:226 (average)`; `web/pages/underlying-stats/index.tsx:229 (standardDeviation, sample n-1)`; `web/pages/underlying-stats/index.tsx:487 (componentStats over xgf60/sf60/gf60/xga60/sa60/ga60/pace60/luckPdo)`; `web/pages/underlying-stats/index.tsx:827 (renderPowerPopover special-teams bonus = power - mean(off,def,pace))`; `web/pages/underlying-stats/index.tsx:856 (renderOffensePopover xgfZ/sfZ/gfZ)`; `web/pages/underlying-stats/index.tsx:949 (renderPacePopover paceZ)`
- **Tags (heuristic):** denominators: per 60; generation: current
- **Opus view (TEAM-017):**
  - Method: For the teams in the selected snapshot: mean and sample SD (divide by n-1); z = (team value - mean)/SD, 0 when SD=0; shown as signed z beside 'Formula: 70% xGF/60, 20% SF/60, 10% GF/60' (offense) or flipped inputs (defense). Special-teams bonus shown = computeTeamPowerScore(team) - (off+def+pace)/3. PDO summary computed for display only.
  - Inputs/units: per-60 team rates; PDO as ratio or x100 per source; sources: /api/underlying-stats/team-ratings snapshot (team_power_ratings_daily via lib/teamRatingsService)
  - Output scale: z-score (signed, 2 dp display); rating points for the bonus; writes: —
  - Status: live — /underlying-stats landing page
  - Consumers: /underlying-stats team power rankings page popovers
- **Audit context:**
  - Intent (Opus): In-page copy: 'Power Score averages offense, defense, and pace, then adds a small PP/PK tier bonus' (web/pages/underlying-stats/index.tsx:836)
  - External references: none suggested
  - Fixtures/test data: `web/__tests__/pages/underlying-stats/index.test.tsx (asserts 'xGF/60: 3.10 vs league 3.10')`
  - Tests: `web/__tests__/pages/underlying-stats/index.test.tsx`
- **Leads (not audited):**
  - (opus) duplicate implementation of TEAM-029 'Power ratings: league distribution, early-season blend, z-scores' (web/lib/power-ratings.ts calculateLeagueMetrics) — the page recomputes z from snapshot component values instead of the stored league_*_stddev, so it ignores the early-season blend used to build the actual rating
  - (opus) popover text hard-codes '70% xGF/60, 20% SF/60, 10% GF/60'; not cross-checked against TEAM-030 weights
  - (opus) if a snapshot has fewer than 32 teams the displayed league mean/z shift accordingly

## M-TEAM-039 CTPI audit re-derivation (single-date reconciliation)

- **Match:** Opus only; Opus TEAM-018; Codex —
- **Purpose:** Recompute CTPI from corrected per-game NST inputs and compare to persisted team_ctpi rows
- **Where:** `web/scripts/audit-ctpi-formula.ts:218 (assembleTeamRows)`; `web/scripts/audit-ctpi-formula.ts:276 (scoreAsOf)`; `web/scripts/audit-ctpi-formula.ts:205 (rankByScore)`; `web/scripts/audit-ctpi-formula.ts:417 (main reconciliation; formulaContract at :640)`
- **Tags (heuristic):** percent scale: 0-100; denominators: per 60, per game; generation: current
- **Opus view (TEAM-018):**
  - Method: audit re-derivation: calls lib/trends/ctpi computeTrendMetrics (or computeLegacyTrendMetricsForAuditOnly) + computeCtpi on rows filtered to gp===1 (exact games), optionally GSAx from count table. Documented contract: recency linear weights 1.0..0.1 over latest 10 rows; offense 0.50 z(xGF/60)+0.30 z(HDCF/60)+0.20 z(GF/60); defense 0.50 -z(xGA/60)+0.30 -z(HDCA/60)+0.20 -z(CA/60); goaltending 0.40 z(season GSAx/60)+0.60 z(last-10 GSAx/60); ST 0.55 z(PP xGF/60)+0.45 -z(PK xGA/60); luck z(PDO); raw 0.35/0.30/0.20/0.15/0.10; displayed 50+15*raw unclipped. Reports \|corrected-persisted\| score delta and rank shift summaries and counts same-day leakage (persisted rows built from gp>1 aggregates)
  - Inputs/units: per-60 rates (NST), TOI seconds, counts per game, PDO NST scale (~100), CF% NST percent; sources: nst_team_gamelogs_as_rates, nst_team_gamelogs_as_counts, nst_team_gamelogs_pp_counts, nst_team_gamelogs_pk_counts, team_ctpi
  - Output scale: 0-100-ish display score (unclipped), components in z units; writes: —
  - Status: live — read-only audit script run manually (no callers); audits live team_ctpi
  - Consumers: CTPI repair decisions for team_ctpi / update-team-ctpi-daily
- **Audit context:**
  - Intent (Opus): formulaContract object in web/scripts/audit-ctpi-formula.ts:640-650 and notes 'read-only CTPI audit'
  - External references: z-score composite team power ratings; compare against lib/trends/ctpi
  - Fixtures/test data: none listed
  - Tests: `web/__tests__/pages/api/v1/db/update-team-ctpi-daily.test.ts`; `web/lib/trends/ctpi.test.ts`
- **Leads (not audited):**
  - (opus) documented top-level weight total is 1.1 (0.35+0.30+0.20+0.15+0.10), so raw is not a weighted mean
  - (opus) display 50+15*raw is unclipped and can leave 0-100
  - (opus) persisted rows mix cumulative (gp>1) and per-game grain; flagged as same-day leakage

## M-TEAM-040 CTPI forward-association test (predictive validity)

- **Match:** Opus only; Opus TEAM-019; Codex —
- **Purpose:** Correlate pre-game CTPI variants with next-N-game goal and xG differential
- **Where:** `web/scripts/audit-ctpi-formula.ts:310 (buildForwardAssociation)`; `web/scripts/audit-ctpi-formula.ts:168 (pearson)`; `web/scripts/audit-ctpi-formula.ts:142 (quantile), :151 (summarize)`
- **Tags (heuristic):** denominators: per game, per team game; generation: current
- **Opus view (TEAM-019):**
  - Method: for team game index>=10, score as of previous day; predictors: persisted CTPI, corrected full, corrected no-luck = 50+15*(0.35 off+0.30 def+0.20 goal+0.15 ST), last-10 mean GD, last-10 mean xGD; outcomes next 1/3/5/10 mean GD and xGD; Pearson r; quantiles by linear interpolation; population SD
  - Inputs/units: goals and xG counts per game; sources: nst_team_gamelogs_as_counts, nst_team_gamelogs_as_rates, team_ctpi
  - Output scale: Pearson r -1..1; writes: —
  - Status: live — manual read-only audit, no callers
  - Consumers: CTPI formula review
- **Audit context:**
  - Intent (Opus): output note at web/scripts/audit-ctpi-formula.ts:758 ('unadjusted descriptive diagnostics')
  - External references: out-of-sample predictive validity of team strength metrics
  - Fixtures/test data: none listed
  - Tests: none listed
- **Leads (not audited):**
  - (opus) overlapping repeated team observations make Pearson samples non-independent (acknowledged in output notes)

## M-TEAM-041 CTPI multiseason audit: legacy vs recent-team-form v2 candidate

- **Match:** Opus only; Opus TEAM-020; Codex —
- **Purpose:** Compare legacy CTPI with the v2 candidate across seasons using NST team game logs
- **Where:** `web/scripts/audit-ctpi-multiseason.ts:230 (parseProviderTable)`; `web/scripts/audit-ctpi-multiseason.ts:443 (scoresBeforeDate)`; `web/scripts/audit-ctpi-multiseason.ts:473 (perGameGsax)`; `web/scripts/audit-ctpi-multiseason.ts:482 (specialTeamsNet)`; `web/scripts/audit-ctpi-multiseason.ts:494 (buildSamples)`; `web/scripts/audit-ctpi-multiseason.ts:182 (pearson + Fisher CI)`; `web/scripts/audit-ctpi-multiseason.ts:631 (correlationSummary)`; `web/scripts/audit-ctpi-multiseason.ts:691 (scoreBands)`; `web/scripts/audit-ctpi-multiseason.ts:732 (rankStability)`
- **Tags (heuristic):** percent scale: 0-100; denominators: per 60, per game; generation: current
- **Opus view (TEAM-020):**
  - Method: audit re-derivation: teams need >=10 prior games; legacy = computeTrendMetrics+computeCtpi (only recent_game_count==10), candidate = computeRecentTeamFormCandidateMetrics/V2 (pre-specified no-PDO weights, missingness renormalization, bounded logistic display); per-game GSAx/60 = (xGA-GA)*3600/TOI; ST net = PP xGF*3600/PPTOI - PK xGA*3600/SHTOI; Pearson with Fisher-z 95% CI (1.96/sqrt(n-3), r clipped ±0.999999); score bands <35,35-45,45-55,55-65,>=65 with monotonicity check on recent and next-5 xGD; rank stability = correlation of consecutive-date ranks plus \|rank change\|
  - Inputs/units: TOI mm:ss parsed to seconds; per-60 rates; counts; sources: Natural Stat Trick team games table (live HTML via lib/nst/client under NST job lifecycle)
  - Output scale: 0-100 candidate score; r -1..1; writes: —
  - Status: live — manual read-only audit, no callers; output note says it fits no weights and writes nothing
  - Consumers: CTPI v2 candidate decision
- **Audit context:**
  - Intent (Opus): web/scripts/audit-ctpi-multiseason.ts:847-894 method descriptions
  - External references: Fisher z CI; Spearman rank correlation
  - Fixtures/test data: none listed
  - Tests: `web/lib/nst/callerLifecycle.test.ts (NST caller registration only)`
- **Leads (not audited):**
  - (opus) rankStability runs Pearson on rank integers and labels it spearman (only equal without ties)
  - (opus) script fetches NST live; must respect NST rate windows

## M-TEAM-042 Dashboard freshness thresholds and insight tone bands

- **Match:** Opus only; Opus TEAM-025; Codex —
- **Purpose:** Stale-data checks and luck-pressure tone labels.
- **Where:** `web/lib/dashboard/freshness.ts:326-343 (DASHBOARD_FRESHNESS_POLICY)`; `web/lib/dashboard/playerInsightContext.ts:6 (resolveInsightTone)`
- **Tags (heuristic):** generation: current
- **Opus view (TEAM-025):**
  - Method: error if team-ratings/forge/start-chart/ownership > 30 h old; warn if CTPI/skater-power/sustainability/ownership-trends > 72 h; tone \|x\| >= 1.25 risk, >= 0.75 watch, else stable.
  - Inputs/units: hours; z-like; sources: —
  - Output scale: labels; writes: —
  - Status: live
  - Consumers: FORGE dashboard
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/dashboard/freshness.test.ts`

## M-TEAM-043 Top Adds schedule context (games and off-nights remaining)

- **Match:** Opus only; Opus TEAM-027; Codex —
- **Purpose:** Remaining weekly games and light-slate nights per team.
- **Where:** `web/lib/dashboard/topAddsScheduleContext.ts:16 (OFF_NIGHT_GAME_THRESHOLD)`; `web/lib/dashboard/topAddsScheduleContext.ts:62 (buildTopAddsScheduleContextMap)`; `web/lib/dashboard/topAddsScheduleContext.ts:20 (OFF_NIGHT_GAME_THRESHOLD)`
- **Tags (heuristic):** generation: current
- **Opus view (TEAM-027):**
  - Method: Count team's games from selected weekday to Sunday; off-night if league games that day <= 8.
  - Inputs/units: games; sources: —
  - Output scale: counts; writes: —
  - Status: live
  - Consumers: Top Adds score
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: Fantasy off-night convention (<= 8 games)
  - Fixtures/test data: none listed
  - Tests: `web/lib/dashboard/topAddsScheduleContext.test.ts`
- **Leads (not audited):**
  - (opus) threshold 8 games is hard-coded (assumes 32 teams)

## M-TEAM-044 Power ratings: per-60 game log assembly (all and 5v5)

- **Match:** Opus only; Opus TEAM-030; Codex —
- **Purpose:** Builds per-game team rate rows feeding the EWMA.
- **Where:** `web/lib/power-ratings.ts:131 (fetchGameLogs)`
- **Tags (heuristic):** denominators: per 60, 5v5 only; generation: current
- **Opus view (TEAM-030):**
  - Method: all rows: copy *_per_60, pace = (CF60 + CA60)/2. 5v5 rows: rate = count*3600/toi (toi seconds); pace/hd null; season_id falls back to 20242025. Both modes appended to the same array tagged data_mode.
  - Inputs/units: per 60; TOI seconds; sources: nst_team_gamelogs_as_rates (situation all), nst_team_5v5, nst_team_gamelogs_pp_rates, nst_team_gamelogs_pk_rates, wgo_team_stats, teams
  - Output scale: per 60; writes: —
  - Status: live — /api/v1/db/update-team-power-ratings (withCronJobAudit; pg_cron schedule not in repo)
  - Consumers: update-team-power-ratings; teamRatingsTrend (filters data_mode='all'); update-nst-team-daily
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: NST per-60 convention (count*3600/TOI seconds)
  - Fixtures/test data: none listed
  - Tests: `web/__tests__/pages/api/v1/db/update-team-power-ratings.test.ts`; `web/lib/power-ratings.test.ts`
- **Leads (not audited):**
  - (opus) hard-coded season_id fallback 20242025 for 5v5 rows
  - (opus) Number(null) -> 0 for missing rate fields in 'all' rows

## M-TEAM-045 Power ratings: carry-forward for teams without a game

- **Match:** Opus only; Opus TEAM-038; Codex —
- **Purpose:** Fills daily rows for idle teams.
- **Where:** `web/pages/api/v1/db/update-team-power-ratings.ts:324-354`
- **Tags (heuristic):** generation: current
- **Opus view (TEAM-038):**
  - Method: If no calculated rating for the date, copy the latest prior row's ratings with new trend10/pp_tier/pk_tier and the old source_through_date.
  - Inputs/units: —; sources: team_power_ratings_daily
  - Output scale: —; writes: team_power_ratings_daily
  - Status: live — /api/v1/db/update-team-power-ratings (withCronJobAudit; pg_cron schedule not in repo)
  - Consumers: all readers
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/__tests__/pages/api/v1/db/update-team-power-ratings.test.ts`; `web/lib/power-ratings.test.ts`

## M-TEAM-046 Legacy SOS standings loader (sosStandings.js)

- **Match:** Opus only; Opus TEAM-039; Codex —
- **Purpose:** Older script building past/future opponent records.
- **Where:** `web/lib/supabase/sosStandings.js:391 (updateStandingsWithOpponents)`; `web/lib/supabase/sosStandings.js:549-735 (totals)`
- **Tags (heuristic):** generation: legacy
- **Opus view (TEAM-039):**
  - Method: Past = games on/before row date, future = after; each opponent's W/L/OTL as of the row date (0 if missing); totals summed.
  - Inputs/units: counts; sources: raw_standings_sos, NHL API
  - Output scale: counts; writes: sos_standings
  - Status: legacy/dead — replaced by /api/v1/db/update-team-sos
  - Consumers: superseded by update-team-sos
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: none listed
- **Leads (not audited):**
  - (opus) missing opponent standings silently become 0-0-0, deflating totals

## M-TEAM-047 Opponent strength band (strong/average/weak tertiles)

- **Match:** Opus only; Opus TEAM-040; Codex —
- **Purpose:** Classifies each opponent by dated power score for the schedule calendar.
- **Where:** `web/lib/teamOpponentStrength.ts:19 (buildDatedOpponentStrengthIndex)`
- **Tags (heuristic):** generation: current
- **Opus view (TEAM-040):**
  - Method: Per date with >= 30 teams: sort by computeTeamPowerScore desc; top ceil(n/3) strong, bottom ceil(n/3) weak, rest average.
  - Inputs/units: power score; sources: —
  - Output scale: 3 bands; writes: —
  - Status: live — TeamScheduleCalendar
  - Consumers: components/TeamScheduleCalendar
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/teamOpponentStrength.test.ts`

## M-TEAM-048 SOS writer: opponents' current W/L/OTL totals (past and future)

- **Match:** Opus only; Opus TEAM-043; Codex —
- **Purpose:** Daily strength-of-schedule inputs per team.
- **Where:** `web/pages/api/v1/db/update-team-sos.ts:239-305`
- **Tags (heuristic):** denominators: per game; generation: current
- **Opus view (TEAM-043):**
  - Method: For each date: team point% = points/(2*GP), win% = wins/GP; for every scheduled regular-season opponent, add the opponent's record AS OF currentDate to past (gameDate <= currentDate) or future totals; one addition per meeting.
  - Inputs/units: W/L/OTL counts; sources: NHL web API standings/{date}, NHL club schedule API
  - Output scale: counts; writes: sos_standings
  - Status: live — /api/v1/db/update-team-sos
  - Consumers: computeSosRatings; buildCanonicalSosRankings; /api/v1/trends/team-sos
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: RPI OWP (opponents' win% excluding games vs the team) and OOWP
  - Fixtures/test data: none listed
  - Tests: none listed
- **Leads (not audited):**
  - (opus) opponents' records include their games against this team (RPI excludes them)
  - (opus) past opponents valued at today's record, not the record when played (retrospective)
  - (opus) games on currentDate counted as past
  - (opus) 250 ms sleep per date across 32 x NHL API calls

## M-TEAM-049 Score-state shot share averages (GameStateAnalysis)

- **Match:** Opus only; Opus TEAM-044; Codex —
- **Purpose:** Leading/tied/trailing/close SAT% and USAT% cards.
- **Where:** `web/components/GameStateAnalysis/GameStateAnalysis.tsx:92 (buildScoreStateCard)`; `web/components/GameStateAnalysis/GameStateAnalysis.tsx:245-275 (thresholds)`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: per game; generation: current
- **Opus view (TEAM-044):**
  - Method: Unweighted mean of per-game shares over games with values (no counts available); colour good >= 0.52, poor <= 0.48.
  - Inputs/units: fraction; sources: wgo_team_stats (score-state fields)
  - Output scale: fraction; writes: —
  - Status: live
  - Consumers: GameStateAnalysis
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: Score-state shot shares (ratio of sums preferred)
  - Fixtures/test data: none listed
  - Tests: `web/components/GameStateAnalysis/GameStateAnalysis.test.tsx`
- **Leads (not audited):**
  - (opus) mean of per-game ratios over-weights low-event games (acknowledged in comment :87-90)

## M-TEAM-050 Team L10 metrics and L5-vs-L10 trends (AdvancedL10Metrics)

- **Match:** Opus only; Opus TEAM-045; Codex —
- **Purpose:** Last-10 record, points%, shots, special teams and 5v5 shares.
- **Where:** `web/components/TeamDashboard/AdvancedL10Metrics.tsx:186-240`
- **Tags (heuristic):** percent scale: fraction 0-1; generation: current
- **Opus view (TEAM-045):**
  - Method: L10 points = 2W + OTL; points% = points/(2*GP); shares via aggregateWgoTeamGames / aggregateNstTeamCounts ratio of sums; trend = L5 vs L10 for SF/G, PP%, PK%, CF% when L5 has 5 games.
  - Inputs/units: counts; sources: nhl_standings_details, wgo_team_stats, nst_team_5v5
  - Output scale: fractions; writes: —
  - Status: live — team pages
  - Consumers: TeamDashboard
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/components/TeamDashboard/AdvancedL10Metrics.test.tsx`
- **Leads (not audited):**
  - (opus) CF%/xGF%/PDO from 5v5 rows shown beside all-situation shots/PP from WGO

## M-TEAM-051 Team dashboard season aggregates, goalie totals and league ranks

- **Match:** Opus only; Opus TEAM-047; Codex —
- **Purpose:** Season ratios, team goalie SV%/GAA, start share and league ranks on the team page.
- **Where:** `web/components/TeamDashboard/TeamDashboard.tsx:190-235 (season rows)`; `web/components/TeamDashboard/TeamDashboard.tsx:620 (start %)`; `web/components/TeamDashboard/TeamDashboard.tsx:664-668 (team SV%, GAA)`; `web/components/TeamDashboard/TeamDashboard.tsx:788-840 (rankings)`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: per 60, per game; generation: current
- **Opus view (TEAM-047):**
  - Method: Shares ratio of season sums; special teams ratio of summed counts; goalie start% = GS/completedGames*100; team SV% = saves/SA; GAA = GA*3600/TOIseconds; GF/GP rank (GP fallback 1); rank 0 = unranked sentinel.
  - Inputs/units: counts; seconds; sources: nst_team_5v5, wgo_team_stats, team_summary_years, NHL goalie API
  - Output scale: fractions; per 60; writes: —
  - Status: live — team pages
  - Consumers: TeamDashboard
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/components/TeamDashboard/TeamDashboard.test.tsx`
- **Leads (not audited):**
  - (opus) goals_saved_above_expected hard-coded 0 (TeamDashboard.tsx:678)
  - (opus) season date fallback Oct 1 - Apr 30 / Jun 30

## M-TEAM-052 Team leaders BSH (blocks + shots + hits)

- **Match:** Opus only; Opus TEAM-048; Codex —
- **Purpose:** Top-3 peripheral leaders.
- **Where:** `web/components/TeamDashboard/TeamLeaders.tsx:161-170`
- **Tags (heuristic):** denominators: shots on goal; generation: current
- **Opus view (TEAM-048):**
  - Method: bsh = BLK + SOG + HIT; top 3 by points, goals, BSH etc.
  - Inputs/units: counts; sources: wgo_skater_stats_totals
  - Output scale: count; writes: —
  - Status: live
  - Consumers: TeamLeaders
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/components/TeamDashboard/TeamLeaders.test.tsx`
- **Leads (not audited):**
  - (opus) season totals, not per game, so low-GP players disadvantaged

## M-TEAM-053 Team share aggregation (CF%, xGF%, HDCF%, SCF%, SH%, SV%, PDO)

- **Match:** Opus only; Opus TEAM-050; Codex —
- **Purpose:** Ratio-of-sums team possession and luck metrics for dashboards.
- **Where:** `web/lib/stats/percentUnits.ts:107 (aggregateNstTeamCounts)`; `web/components/GameStateAnalysis/GameStateAnalysis.tsx:60 (buildStrengthCard)`
- **Tags (heuristic):** percent scale: fraction 0-1; generation: current
- **Opus view (TEAM-050):**
  - Method: share = for/(for+against) of sums; SH% = GF/SF; SV% = 1 - GA/SA; PDO = SH% + SV% (fraction ~1.0); xGF/game = xgf/games.
  - Inputs/units: counts; toi seconds; sources: nst_team_* count tables
  - Output scale: fractions 0-1; PDO ~1; writes: —
  - Status: live
  - Consumers: GameStateAnalysis; AdvancedL10Metrics; TeamDashboard
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: NST ratio-of-sums; PDO = on-ice SH% + SV%
  - Fixtures/test data: none listed
  - Tests: `web/components/GameStateAnalysis/GameStateAnalysis.test.tsx`; `web/lib/stats/percentUnits.test.ts`
- **Leads (not audited):**
  - (opus) PDO here is ~1.0 scale while CTPI/power ratings PDO use NST ~100 scale

## M-TEAM-054 Goalie trend confidence and volatility

- **Match:** Opus only; Opus TEAM-053; Codex —
- **Purpose:** Confidence label for goalie trend percentiles.
- **Where:** `web/lib/trends/goalieMetricConfig.ts:55 (summarizeGoalieTrendConfidence)`
- **Tags (heuristic):** generation: current
- **Opus view (TEAM-053):**
  - Method: confidence high if 10 values, medium >= 5, else low; volatility = population SD of percentiles (1 dp).
  - Inputs/units: percentile; sources: —
  - Output scale: SD of percentiles; writes: —
  - Status: live
  - Consumers: goalie trends view
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/__tests__/pages/api/v1/trends/goalie-power.test.ts`; `web/lib/trends/goalieMetricConfig.test.ts`
- **Leads (not audited):**
  - (opus) population SD here vs sample SD in playerTrendCalculator and SkaterPage/GoaliePage

## M-TEAM-055 As-of rating snapshot selection

- **Match:** Codex only; Opus —; Codex core-136
- **Purpose:** Calculate as-of rating snapshot selection.
- **Where:** `web/lib/teamRatingsService.ts:223 fetchTeamRatingsAsOf`
- **Codex view (core-136, calculation; Codex family 'team power'):** As-of rating snapshot selection
  - Formula: Selection only; no reweighting or score recalculation.
  - Purpose: Calculate as-of rating snapshot selection.
  - Inputs/units: Requested date and team identity.
  - Output scale: Latest rating snapshot no later than requested date.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f. underlying-stats/teamRatingsService.ts:1 re-exports this module. Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final sta…
  - Consumers: ["Prediction and team-page consumers"]
- **Audit context:**
  - Intended contract (Codex core-136): JSDoc distinguishes this as-of path from fetchTeamRatings legacy absolute-latest fallback.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/teamRatingsService.test.ts`; `Located only; not run for this inventory.`
- **Leads (not audited):**
  - (codex:core-136) ["Inventory only, not validation of the formula, source semantics or model quality."]

## M-TEAM-056 Game and displayed-window goal differential

- **Match:** Codex only; Opus —; Codex core-374
- **Purpose:** Provide game and displayed-window goal differential for the identified consumer.
- **Where:** `web/components/TeamDashboard/GameByGameTimeline.tsx:38 GoalDifferentialTrend`
- **Tags (heuristic):** denominators: per game
- **Codex view (core-374, calculation; Codex family 'team performance UI'):** Game and displayed-window goal differential
  - Formula: Per game GF-GA; displayed total is their sum.
  - Purpose: Provide game and displayed-window goal differential for the identified consumer.
  - Inputs/units: GF and GA for each displayed game.
  - Output scale: Per-game goal differential and window total in goals.
  - Version/status: Local working tree on octoberBranch, read on 2026-11-10. HEAD changed during the inventory from d31dcb33f72d4c9d69b507874c388f0cd549fe2f to 11e4192d36ecc4ac4b338f9ab48e529c7049c618. This is a non-atomic local scan; deployment and persisted-data state are not verified. Referenced implementation files had no tracked/untracked status entry at the final status check.
  - Consumers: ["TeamDashboard goal differential trend"]
- **Audit context:**
  - Intended contract (Codex core-374): Function signature and comments at web/components/TeamDashboard/GameByGameTimeline.tsx:38 GoalDifferentialTrend; independent product specification not verified.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/components/TeamDashboard/GameByGameTimeline.test.tsx`; `Located only; not run for this inventory.`
- **Leads (not audited):**
  - (codex:core-374) ["Calculation inventory only; no correctness or model-quality verdict."]

