# Audit packet: FORGE projections (part 1 of 4)

Master entries M-FRG-001 to M-FRG-060 (60 of 186 in this family). Built from the merged Opus and Codex inventories; see [../MASTER.md](../MASTER.md) and [../MERGE-NOTES.md](../MERGE-NOTES.md).

How to read: each entry gives both inventories' descriptions side by side. **Conflicts** are places where the two descriptions disagree; they are unresolved. **Leads** are Opus red flags and Codex unknowns: observations to check, not audited findings. Tags are keyword heuristics. Line numbers were valid when each inventory was written on 2026-11-10 (Opus at d31dcb33f, Codex at 11e4192d3); re-check against the current checkout.

| ID | Name | Match | Conflicts | Leads |
|---|---|---|---:|---:|
| M-FRG-001 | matview opponent_skater_allowed_by_position | Both | 0 | 3 |
| M-FRG-002 | fn forge_league_skater_physical_totals | Both | 0 | 3 |
| M-FRG-003 | view forge_served_forecast_scoreboard_daily | Both | 0 | 2 |
| M-FRG-004 | Legacy game goal projections (att x def x league) | Both | 0 | 6 |
| M-FRG-005 | Legacy / test-only skater and goalie helpers | Both | 0 | 6 |
| M-FRG-006 | Completed game length | Both | 0 | 1 |
| M-FRG-007 | Reserve (if-dressed / if-starts) projections | Both | 0 | 4 |
| M-FRG-008 | Season-opening bootstrap blend | Both | 0 | 8 |
| M-FRG-009 | Horizon per-game scalars | Both | 0 | 5 |
| M-FRG-010 | Projections table proration and global ranks | Both | 0 | 7 |
| M-FRG-011 | FORGE goalie matchup win-probability normalization | Both | 0 | 4 |
| M-FRG-012 | FORGE counterfactual PP usage re-allocation | Both | 0 | 4 |
| M-FRG-013 | FORGE skater counterfactual: conversion rates, used-rate clamps, boot… | Both | 0 | 6 |
| M-FRG-014 | Served ledger scoring (MAE/bias/RMSE, Mincer-Zarnowitz, Brier, paired… | Both | 0 | 3 |
| M-FRG-015 | Fantasy points scoring (FORGE defaults and board) | Both | 0 | 5 |
| M-FRG-016 | Projection accuracy score, MAE/RMSE aggregates and interval coverage | Both | 0 | 6 |
| M-FRG-017 | Promotion gates and holdout comparison | Both | 0 | 2 |
| M-FRG-018 | Skater holdout baselines (current and naive prior) | Both | 0 | 4 |
| M-FRG-019 | FORGE backtest accuracy metrics: MAE/bias/RMSE, paired game-cluster b… | Both | 0 | 3 |
| M-FRG-020 | FORGE goalie backtest scoring: Brier, log loss, reliability bins, pai… | Both | 0 | 7 |
| M-FRG-021 | FORGE skater candidate ablation (fantasy-point head, Mincer-Zarnowitz) | Both | 0 | 5 |
| M-FRG-022 | FORGE v2 refresh cadence and material-event coalescing | Both | 0 | 2 |
| M-FRG-023 | Goalie starter probability (FORGE logit/softmax) | Both | 0 | 5 |
| M-FRG-024 | Goalie starter-scenario blend and horizon scaling | Both | 0 | 4 |
| M-FRG-025 | Team context adjustments for goalie (team strength, 5v5, NST danger) | Both | 0 | 6 |
| M-FRG-026 | Goalie game table (shots against, goals allowed) | Both | 0 | 2 |
| M-FRG-027 | Goalie shutout probability | Both | 0 | 2 |
| M-FRG-028 | Modeled save percentage (beta-binomial) with context shifts | Both | 0 | 7 |
| M-FRG-029 | Team win probability (Poisson race) and goalie win populations | Both | 0 | 7 |
| M-FRG-030 | Season-current league save percentage | Both | 0 | 4 |
| M-FRG-031 | Goalie profile tiers (volatility, blowup risk, confidence, quality, r… | Both | 0 | 7 |
| M-FRG-032 | Goalie workload context | Both | 0 | 2 |
| M-FRG-033 | Goalie evidence aggregation | Both | 0 | 5 |
| M-FRG-034 | Goalie start projections route (L10 share, GSAA/60) | Both | 0 | 7 |
| M-FRG-035 | FORGE goalie line backtest: legacy vs new save%/win/shutout model | Both | 0 | 6 |
| M-FRG-036 | Fantasy-projections season evaluator and settlement | Both | 0 | 5 |
| M-FRG-037 | Served forecast ledger build and settlement | Both | 0 | 3 |
| M-FRG-038 | Native goal accounting (team expected goals) | Both | 0 | 4 |
| M-FRG-039 | Native coverage, interval reconciliation and direct conditional count… | Both | 0 | 3 |
| M-FRG-040 | Sportsbook de-vig | Both | 0 | 10 |
| M-FRG-041 | Model vs market prop comparison | Both | 0 | 6 |
| M-FRG-042 | On-ice context adjustment | Both | 0 | 5 |
| M-FRG-043 | Team-level skater context adjustment | Both | 0 | 6 |
| M-FRG-044 | Opponent goalie quality adjustment for skaters | Both | 0 | 2 |
| M-FRG-045 | Skater rest / schedule adjustment | Both | 0 | 3 |
| M-FRG-046 | Small-sample shrinkage weight | Both | 0 | 3 |
| M-FRG-047 | Hits and blocks per 60 (physical rates) | Both | 0 | 3 |
| M-FRG-048 | Assist share and team assist allocation | Both | 0 | 5 |
| M-FRG-049 | Skater shot rate per 60 (shrunk) | Both | 0 | 5 |
| M-FRG-050 | Goal conversion (goals per shot) by strength | Both | 0 | 5 |
| M-FRG-051 | Shot-quality adjustment | Both | 0 | 4 |
| M-FRG-052 | Research goal kernels and skater-candidate accounting (offline) | Both | 0 | 1 |
| M-FRG-053 | Teammate assist coupling | Both | 0 | 2 |
| M-FRG-054 | Skater role scenarios and horizon scenario blend | Both | 0 | 5 |
| M-FRG-055 | Skater recency multiplier and active-pool filter | Both | 0 | 3 |
| M-FRG-056 | Sustainability trend-band adjustment | Both | 0 | 5 |
| M-FRG-057 | Player and team game strength tables | Both | 0 | 4 |
| M-FRG-058 | Strength-state classification and shift strength TOI | Both | 0 | 5 |
| M-FRG-059 | Team-to-player reconciliation (TOI and shots) | Both | 0 | 6 |
| M-FRG-060 | Role-specific usage bounds | Both | 0 | 3 |

## M-FRG-001 matview opponent_skater_allowed_by_position

- **Match:** Both; Opus FRG-001; Codex roster-bridge-position-allowed
- **Purpose:** Per opponent and position group (F/D) goals/assists/points/shots allowed (RSO FORGE bridge positional tilt)
- **Where:** `supabase/migrations/20261019211444_opponent_skater_allowed_by_position.sql:7 (opponent_skater_allowed_by_position)`; `supabase/migrations/20261019211444_opponent_skater_allowed_by_position.sql:34 (register_opponent_allowed_refresh_cron, 09:42 UTC daily)`; `supabase/migrations/20261019211444_opponent_skater_allowed_by_position.sql:7 [inline calculation: Opponent goals/assists/points/shots allowed by F/D]`
- **Tags (heuristic):** denominators: per game; generation: current
- **Opus view (FRG-001):**
  - Method: Regular season, date >= current_date-500; GROUP BY season, opponent, position_group (D vs C/L/R=F): count distinct games, player_games, SUM goals/assists/points/shots, max date. Consumer computes share vs league share.
  - Inputs/units: per-game counts; sources: wgo_skater_stats, games
  - Output scale: season totals; writes: opponent_skater_allowed_by_position (refresh concurrently)
  - Status: live — read by web/lib/rosterScheduleData/forgeDailyBridge.ts (optional read); cron registration is a separate approval
  - Consumers: web/lib/rosterScheduleData/forgeDailyBridge.ts
- **Codex view (roster-bridge-position-allowed, calculation, location; Codex family 'roster-forecast-bridge'):** Opponent goals/assists/points/shots allowed by F/D
  - Purpose: Aggregate WGO regular-season skater rows over last 500 days, grouped season/opponent and D vs F: distinct games, player-games, sums of goals/assists/points/shots.
  - Inputs/units: Per-game WGO counts joined games type=2; server current_date.
  - Output scale: Integer count totals and game denominators.
  - Version/status: Checked-in migration 20261019211444 Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Audit context:**
  - Intent (Opus): supabase/migrations/20261019211444_opponent_skater_allowed_by_position.sql:1-5
  - Intended contract (Codex roster-bridge-position-allowed): SQL materialized view supports positional tilt; no live refresh or database contents inspected. Source: supabase/migrations/20261019211444_opponent_skater_allowed_by_position.sql:7.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `{"discovered_not_run": [], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (opus) 500-day window truncates the earlier season inconsistently across refresh dates
  - (opus) totals not normalized by games until the TS consumer
  - (codex:roster-bridge-position-allowed) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-FRG-002 fn forge_league_skater_physical_totals

- **Match:** Both; Opus FRG-002; Codex forge-league-physical-totals, sql-forge-physical-totals
- **Purpose:** League hits/blocks/TOI by position group, season-to-date and prior-2 seasons, for FORGE physical-rate rescaling
- **Where:** `supabase/migrations/20261020211500_forge_league_skater_physical_totals.sql:10 (forge_league_skater_physical_totals)`; `supabase/migrations/20261020211500_forge_league_skater_physical_totals.sql:10 forge_league_skater_physical_totals`; `supabase/migrations/20261020211500_forge_league_skater_physical_totals.sql:10`
- **Tags (heuristic):** denominators: per 60; generation: current
- **Opus view (FRG-002):**
  - Method: Rows with games_played=1 and toi_per_game>0; scope 'to_date' = this season, date in [Sep 1 y, min(cutoff, Sep 1 y+1)); 'prior2' = two prior seasons dated [Sep 1 y-2, Sep 1 y); sums player_games, hits, blocks, toi seconds per (scope, F/D). FORGE rescales prior-season events by to_date/prior2.
  - Inputs/units: TOI seconds; sources: wgo_skater_stats
  - Output scale: league totals; writes: —
  - Status: live — called by run-forge-projections.ts
  - Consumers: web/lib/projections/run-forge-projections.ts; web/lib/projections/queries/skater-queries.ts
- **Codex view (forge-league-physical-totals, calculation, location; Codex family 'FORGE SQL physical-event exposure'):** League physical-event totals
  - Purpose: Aggregate native per-position hits, blocked shots and TOI for league-rate shrinkage/rescaling.
  - Inputs/units: Season ID, cutoff, WGO skater counts and time exposure.
  - Output scale: Position totals; downstream converts to per-60 rates.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "deployment": "Unknown; source inspection only."}
- **Codex view (sql-forge-physical-totals, calculation, location; Codex family 'FORGE SQL cross-reference'):** forge_league_skater_physical_totals
  - Purpose: Supply league physical-event denominators for FORGE rescaling.
  - Inputs/units: WGO hits/blocks/TOI seconds, season and cutoff, D versus F position group
  - Output scale: Four scope×position rows for current to-date and pooled prior2 seasons: player_games, sum hits, sum blocks, sum TOI seconds.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
- **Audit context:**
  - Intent (Opus): supabase/migrations/20261020211500_forge_league_skater_physical_totals.sql:1-6
  - Intended contract (Codex forge-league-physical-totals): Function definition is checked in; application of migration unverified.
  - Intended contract (Codex sql-forge-physical-totals): Migration top comment explicitly states rescaling by to_date/prior2 and cutoff/date fences.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/projections/queries/skater-queries.test.ts`; `{"discovered_not_run": []}`; `{"status": "Discovered; not run", "references": ["No dedicated test linkage resolved in this bounded pass."]}`
- **Leads (not audited):**
  - (opus) date bounds added because WGO rows dated 2010-2017 carry season 20242025 (data defect noted in header)
  - (codex:forge-league-physical-totals) ["Deployment and runtime behavior not verified; calculation listed without correctness assessment."]
  - (codex:sql-forge-physical-totals) Definition exists locally; applied migration/live view shape, data freshness and runtime consumer use unknown.

## M-FRG-003 view forge_served_forecast_scoreboard_daily

- **Match:** Both; Opus FRG-003; Codex sql-forge-scoreboard
- **Purpose:** Projection accuracy: MAE and bias per served date x source x player class
- **Where:** `supabase/migrations/20261021230025_forge_served_forecast_ledger.sql:78 (forge_served_forecast_scoreboard_daily)`; `supabase/migrations/20261021230025_forge_served_forecast_ledger.sql:78`
- **Tags (heuristic):** generation: current
- **Opus view (FRG-003):**
  - Method: Settled rows only; n, dressed, covered, phantoms (dressed=false); for fantasy points, goals, assists, PPP, shots, hits, blocks, saves, GA, SA: MAE = AVG\|exp-act\|, bias = AVG(exp-act); win and shutout: AVG\|p - outcome\| (absolute error of probability, not Brier) and bias.
  - Inputs/units: fantasy points, counts, probabilities 0-1; sources: forge_served_forecast_ledger
  - Output scale: MAE/bias in native units; writes: —
  - Status: unknown — header says 'No R19 code reads this view'
  - Consumers: no R19 reader (scoreboard route scores table directly)
- **Codex view (sql-forge-scoreboard, calculation, location; Codex family 'FORGE SQL validation cross-reference'):** forge_served_forecast_scoreboard_daily
  - Purpose: Aggregate settled served forecast outcomes for reporting.
  - Inputs/units: Settled ledger predicted/actual goals, assists, PPP, shots, hits, blocks, saves, GA, SA, win, shutout, fantasy points
  - Output scale: n/dressed/covered/phantoms counts; n_fantasy_points; MAE=AVG(abs(exp−act)); bias=AVG(exp−act) by date/source/player_class for every named head.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
- **Audit context:**
  - Intent (Opus): supabase/migrations/20261021230025_forge_served_forecast_ledger.sql:70-73 and COMMENT at :108
  - Intended contract (Codex sql-forge-scoreboard): SQL view comment explicitly specifies settled served-forecast ledger aggregate grain.
  - External references: MAE/bias; Brier score / log loss for probabilities
  - Fixtures/test data: none listed
  - Tests: `{"discovered_not_run": []}`
- **Leads (not audited):**
  - (opus) probability heads scored by mean absolute error instead of Brier/log loss
  - (codex:sql-forge-scoreboard) Definition exists locally; applied migration/live view shape, data freshness and runtime consumer use unknown.

## M-FRG-004 Legacy game goal projections (att x def x league)

- **Match:** Both; Opus FRG-006; Codex core-208, core-209, core-210, core-211
- **Possible related records (low-confidence location link, unconfirmed):** core-213
- **Purpose:** Team expected goals and win odds from NST attack/defence scores
- **Where:** `web/lib/gameGoalProjections/calculations.ts:32 (calculateProjectedGoals)`; `web/lib/gameGoalProjections/calculations.ts:43 (generatePoissonProbabilityMatrix)`; `web/lib/gameGoalProjections/calculations.ts:77 (calculateWinOdds)`; `web/lib/gameGoalProjections/calculations.ts:113 (convertAmericanOddsToPercentage)`; `web/lib/gameGoalProjections/utils.ts:8 (poissonProbability)`; `web/pages/api/v1/db/update-game-goal-projections/index.ts`; `web/lib/gameGoalProjections/calculations.ts:32 calculateProjectedGoals`; `web/lib/gameGoalProjections/calculations.ts:43 generatePoissonProbabilityMatrix`; `web/lib/gameGoalProjections/calculations.ts:77 calculateWinOdds`; `web/lib/gameGoalProjections/calculations.ts:113 convertAmericanOddsToPercentage`
- **Tags (heuristic):** percent scale: both/ambiguous; denominators: per game; generation: legacy
- **Opus view (FRG-006):**
  - Method: lambda_home = homeAtt x awayDef x leagueAvg (and vice versa); independent Poisson matrix 0..10 normalised; win% = P(win) + P(draw)/2, renormalised; API odds converted to implied % and averaged (no de-vig).
  - Inputs/units: goals per game; American odds strings; sources: nst_att_def_scores, nst_league_averages, NHL schedule API
  - Output scale: goals; win odds 0-100%; writes: game goal projections table (update-game-goal-projections route)
  - Status: legacy/dead? — route exists (update-game-goal-projections), file header 'Legacy'
  - Consumers: legacy game pages
- **Codex view (core-208, calculation, codex_part_of_opus; Codex family 'legacy game goals'):** Legacy projected team goals
  - Formula: attack*opponentDefense*leagueAverageGoals.
  - Purpose: Calculate legacy projected team goals.
  - Inputs/units: Team attack multiplier, opponent defense multiplier, league average goals/game.
  - Output scale: Expected team goals/game.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f. Source explicitly calls this legacy; not shot-level xG. Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final status check.
- **Codex view (core-209, calculation, codex_part_of_opus; Codex family 'legacy game goals'):** Independent Poisson score matrix
  - Formula: Poisson(home goals)*Poisson(away goals); renormalize truncated mass if difference exceeds 1e-6.
  - Purpose: Calculate independent poisson score matrix.
  - Inputs/units: Home/away expected goals, maximum goals default 10.
  - Output scale: Joint probabilities on 0..10 by 0..10 score grid.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f. Source explicitly calls this legacy; not shot-level xG. Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final status check.
- **Codex view (core-210, calculation, codex_part_of_opus; Codex family 'legacy game goals'):** Legacy win odds with half-draw allocation
  - Formula: Sum strict-win cells plus half diagonal; normalize sum to 100.
  - Purpose: Calculate legacy win odds with half-draw allocation.
  - Inputs/units: Joint score matrix.
  - Output scale: Home and away win percentages rounded 2 decimals.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f. Source explicitly calls this legacy; not shot-level xG. Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final status check.
- **Codex view (core-211, calculation, codex_part_of_opus; Codex family 'legacy game goals'):** American odds to implied probability
  - Formula: Positive:10000/(odds+100); otherwise 100*(-odds)/(-odds+100).
  - Purpose: Calculate american odds to implied probability.
  - Inputs/units: Signed American odds string.
  - Output scale: Implied probability percent.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f. Source explicitly calls this legacy; not shot-level xG. Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final status check.
- **Audit context:**
  - Intent (Opus): calculations.ts:1 'Legacy game-goal projection calculations'; 24-28 docstring
  - Intended contract (Codex core-208): Source types and implementation in web/lib/gameGoalProjections/calculations.ts:32; separate acceptance not verified.
  - Intended contract (Codex core-209): Source types and implementation in web/lib/gameGoalProjections/calculations.ts:43; separate acceptance not verified.
  - Intended contract (Codex core-210): Source types and implementation in web/lib/gameGoalProjections/calculations.ts:77; separate acceptance not verified.
  - Intended contract (Codex core-211): Source types and implementation in web/lib/gameGoalProjections/calculations.ts:113; separate acceptance not verified.
  - External references: Dixon-Coles / Maher Poisson model
  - Fixtures/test data: none listed
  - Tests: `No directly named test located; tests not run.`
- **Leads (not audited):**
  - (opus) observation: no home-ice term; ties split 50/50 instead of OT model
  - (opus) observation: market odds not de-vigged (sum >100%)
  - (codex:core-208) ["Inventory only, not validation of the formula, source semantics or model quality."]
  - (codex:core-209) ["Inventory only, not validation of the formula, source semantics or model quality."]
  - (codex:core-210) ["Inventory only, not validation of the formula, source semantics or model quality."]
  - (codex:core-211) ["Inventory only, not validation of the formula, source semantics or model quality."]

## M-FRG-005 Legacy / test-only skater and goalie helpers

- **Match:** Both; Opus FRG-007; Codex web-lib-projections-calculators-skater-adjustments-allocateteamassists, web-lib-projections-calculators-skater-adjustments-applysupportedskaterconversionheads, web-lib-projections-calculators-skater-adjustments-computesupportedstrengthsplitconversionrates, web-lib-projections-calculators-skater-adjustments-resolveskaterconversionrates
- **Possible related records (low-confidence location link, unconfirmed):** web-lib-projections-calculators-goalie-save-pct-context-computeworkloadsavepctpenalty, web-lib-projections-calculators-scenario-blending-blendskaterscenariostatlines
- **Purpose:** Calculations present in FORGE modules but with no production caller
- **Where:** `web/lib/projections/calculators/skater-adjustments.ts:788 (resolveSkaterConversionRates)`; `web/lib/projections/calculators/skater-adjustments.ts:822 (computeSupportedStrengthSplitConversionRates)`; `web/lib/projections/calculators/skater-adjustments.ts:868 (applySupportedSkaterConversionHeads)`; `web/lib/projections/calculators/skater-adjustments.ts:612 (allocateTeamAssists)`; `web/lib/projections/stages/skater-stage.ts:1075 (clampSkaterAssistRate)`; `web/lib/projections/calculators/scenario-blending.ts:71 (blendSkaterScenarioStatLines)`; `web/lib/projections/calculators/goalie-save-pct-context.ts:15 (computeWorkloadSavePctPenalty)`; `web/lib/projections/constants/projection-weights.ts:31-33`; `web/lib/projections/calculators/skater-adjustments.ts:612 allocateTeamAssists`; `web/lib/projections/calculators/skater-adjustments.ts:868 applySupportedSkaterConversionHeads`; `web/lib/projections/calculators/skater-adjustments.ts:822 computeSupportedStrengthSplitConversionRates`; `web/lib/projections/calculators/skater-adjustments.ts:788 resolveSkaterConversionRates`
- **Tags (heuristic):** generation: legacy, research, current
- **Opus view (FRG-007):**
  - Method: resolveSkaterConversionRates: legacy small-sample shrink vs Bayes rate; aligned count support (pairs) for conversion; assist rate clamps per scale ([0.4,3.4] ES per goal etc.); computeWorkloadSavePctPenalty: 0.04 if >=6 starts in 14 days, 0.025 if >=5, +0.03 B2B (sv% points).
  - Inputs/units: —; sources: —
  - Output scale: —; writes: —
  - Status: legacy/dead — no production call sites found (rg); used by tests and web/scripts/forge-counterfactual-backtest.ts
  - Consumers: web/scripts/forge-counterfactual-backtest.ts (resolve/aligned helpers); tests
- **Codex view (web-lib-projections-calculators-skater-adjustments-allocateteamassists, calculation, codex_part_of_opus; Codex family 'FORGE staged projection math'):** Team-goal-constrained assist allocation (allocateTeamAssists)
  - Purpose: Raw player assists=teamGoals*5*playerTOI/teamTOI*assistShare; rescale team sum to 1.65 ES or1.91 PP assists per goal.
  - Inputs/units: Player ES/PP TOI in consistent units, projected goals, assist shares.
  - Output scale: ES/PP expected assist counts per player.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (web-lib-projections-calculators-skater-adjustments-applysupportedskaterconversionheads, symbol_candidate, codex_part_of_opus; Codex family 'FORGE staged projection math'):** Apply supported skater conversion heads (applySupportedSkaterConversionHeads)
  - Purpose: Withhold unsupported learned heads and their derived bands/scenarios together.
  - Inputs/units: Parameter/type declaration excerpt: export function applySupportedSkaterConversionHeads<T extends { proj_goals_es: number \| null; proj_goals_pp: number \| null; proj_assists_es: number \| null; proj_assists_pp: number \| null; uncertainty: unknown; }>(row: T, rates: ReturnType<typeof computeSupportedStrengthSplitConversionRates>) { const available = { goals_es: rates.goalRateEs !== null, goals_pp: rates.goalRatePp !== null, assists_es: rates.goalRateEs !== null && rates.assistRateEs !== null, assists_pp: rates.goalRatePp !== null && rates.assistRatePp !== null, }; const uncertainty = structuredClone(row.uncertainty) as Record<string, unknown>; const record = (value: unknown): Record<string, unknown> \| null => value && typeof value === "object" && !Array.isArray(value) ? value as Record<…
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (web-lib-projections-calculators-skater-adjustments-computesupportedstrengthsplitconversionrates, symbol_candidate, codex_part_of_opus; Codex family 'FORGE staged projection math'):** Compute supported strength split conversion rates (computeSupportedStrengthSplitConversionRates)
  - Purpose: Conversion learning consumes paired observations, never legacy independent scalar windows.
  - Inputs/units: Parameter/type declaration excerpt: export function computeSupportedStrengthSplitConversionRates(args: { ev: RollingRow \| undefined; pp: RollingRow \| undefined; goalRateMultiplier: number; assistRateMultiplier: number; assistDenominator?: SkaterAssistDenominatorOption; position?: string \| null; }) { const support = (row: RollingRow \| undefined, strengthState: "ev" \| "pp") => row ? readAlignedCountSupport(row.aligned_count_support, { playerId: row.player_id, strengthState, anchor: { gameId: row.game_id, gameDate: row.game_date, seasonId: row.season }, }) : null; const ev = support(args.ev, "ev"), pp = support(args.pp, "pp"); // Each call uses its own pair's common frame. Zero placeholders belong only // to unused calculations; absent pairs are withheld below, never observations. const…
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (web-lib-projections-calculators-skater-adjustments-resolveskaterconversionrates, symbol_candidate, codex_part_of_opus; Codex family 'FORGE staged projection math'):** Resolve skater conversion rates (resolveSkaterConversionRates)
  - Purpose: Supported split rates are already shrunk toward an adaptive prior, so they are used directly (clamped). Only an unsupported head falls back to the fixed prior via the small-sample blend, which reduces to the prior. `conversionShrink` keeps the pre-shrink Bayes rate and the value the former second shrink would have produced, so a backtest can score both from stored rows. /
  - Inputs/units: Parameter/type declaration excerpt: export function resolveSkaterConversionRates(args: { splitRates: { goalRateEs: number \| null; goalRatePp: number \| null; assistRateEs: number \| null; assistRatePp: number \| null }; sampleWeight: number; assistDenominator?: SkaterAssistDenominatorOption; /** * With a position (task 4), goal heads use the F/D prior and keep the small-sample shrink toward * it: it also damps the context goal multipliers, which compound to about 1.3 for some skaters * until task 9 sizes them (dropping it raised forward goals per shot to 0.154 in the 10-13 pilot). */ position?: string \| null; }) { const { priors: fixedPriors, bounds } = skaterConversionPriorsAndBounds(resolveAssistDenominators(args.assistDenominator)); const positionPriors = args.position === undefined …
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): calculators/skater-adjustments.ts:782-787 docstring
  - Intended contract (Codex web-lib-projections-calculators-skater-adjustments-allocateteamassists): {"source": "web/lib/projections/calculators/skater-adjustments.ts:612", "explicit_comment": "Assists come from the goals scored while a skater is on the ice: team goals at each strength x his share of the five skater slots x his assist share, scaled so the team's assists per goal match the league's at that strength. Returns per-player ES and PP assists in input order. /", "arithmetic_locations": ["web/lib/projections/calculators/skater-adjustments.ts:616 const team = { goalsEs: sum(p => p.goalsEs), goalsPp: sum(p => p.goalsPp), toiEs: sum(p => p.toiEs), toiPp: sum(p => p.toiPp) };", "web/lib/projections/calculators/skater-adjustments.ts:617 const onIceEs = (toi: number) => (team.toiEs > 0 ? (team.goalsEs * 5 * toi) / team.toiEs : 0);", "web/lib/projections/calculators/skater-adjustments.ts:618 const onIcePp = (toi: number) => (team.toiPp > 0 ? (team.goalsPp * 5 * toi) / team.toiPp : 0);", "web/lib/projections/calculators/skater-adjustments.ts:619 const rawEs = sum(p => onIceEs(p.toiEs) * p.assistShareEs);", "web/lib/projections/calculators/skater-adjustments.ts:620 const rawPp = sum(p => onIcePp(p.toiPp) * p.assistSharePp);", "web/lib/projections/calculators/skater-adjustments.ts:…
  - Intended contract (Codex web-lib-projections-calculators-skater-adjustments-applysupportedskaterconversionheads): {"source": "web/lib/projections/calculators/skater-adjustments.ts:868", "explicit_comment": "Withhold unsupported learned heads and their derived bands/scenarios together.", "arithmetic_locations": []}
  - Intended contract (Codex web-lib-projections-calculators-skater-adjustments-computesupportedstrengthsplitconversionrates): {"source": "web/lib/projections/calculators/skater-adjustments.ts:822", "explicit_comment": "Conversion learning consumes paired observations, never legacy independent scalar windows.", "arithmetic_locations": ["web/lib/projections/calculators/skater-adjustments.ts:867 /** Withhold unsupported learned heads and their derived bands/scenarios together. */"]}
  - Intended contract (Codex web-lib-projections-calculators-skater-adjustments-resolveskaterconversionrates): {"source": "web/lib/projections/calculators/skater-adjustments.ts:788", "explicit_comment": "Supported split rates are already shrunk toward an adaptive prior, so they are used directly (clamped). Only an unsupported head falls back to the fixed prior via the small-sample blend, which reduces to the prior. `conversionShrink` keeps the pre-shrink Bayes rate and the value the former second shrink would have produced, so a backtest can score both from stored rows. /", "arithmetic_locations": ["web/lib/projections/calculators/skater-adjustments.ts:792 /**", "web/lib/projections/calculators/skater-adjustments.ts:808 const legacy = clamp((bayes ?? prior) * args.sampleWeight + (1 - args.sampleWeight) * prior, min, max);", "web/lib/projections/calculators/skater-adjustments.ts:821 /** Conversion learning consumes paired observations, never legacy independent scalar windows. */"]}
  - External references: none suggested
  - Fixtures/test data: `web/scripts/fixtures/forge-counterfactual-backtest/`; `web/scripts/fixtures/forge-reconstruction-backtest/`
  - Tests: `web/lib/projections/runProjectionV2.alignedConversion.test.ts`; `web/lib/projections/runProjectionV2.test.ts`; `web/scripts/forge-counterfactual-backtest.test.ts`; `{"status": "Discovered only; not run", "references": ["web/lib/projections/nativeGoalAccounting.test.ts:3", "web/lib/projections/runProjectionV2.alignedConversion.test.ts:4"]}`; `{"status": "Discovered only; not run", "references": ["web/lib/projections/runProjectionV2.alignedConversion.test.ts:4", "web/lib/projections/runProjectionV2.test.ts:49", "web/scripts/forge-counterfactual-backtest.test.ts:10"]}`; `{"status": "Discovered only; not run", "references": ["web/lib/projections/runProjectionV2.test.ts:49"]}`
- **Leads (not audited):**
  - (opus) observation: GOALIE_HEAVY/VERY_HEAVY/B2B penalties (0.025/0.04/0.03 sv%) are 10x the fitted values used live (-0.002/-0.003) — dead but importable
  - (opus) observation: imports of computeWorkloadSavePctPenalty remain in skater-stage.ts and run-forge-projections.ts
  - (codex:web-lib-projections-calculators-skater-adjustments-allocateteamassists) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested."]
  - (codex:web-lib-projections-calculators-skater-adjustments-applysupportedskaterconversionheads) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:web-lib-projections-calculators-skater-adjustments-computesupportedstrengthsplitconversionrates) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:web-lib-projections-calculators-skater-adjustments-resolveskaterconversionrates) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-FRG-006 Completed game length

- **Match:** Both; Opus FRG-008; Codex web-lib-projections-gamelength-calculatecompletedgamelengthseconds
- **Purpose:** Game length in seconds from final period and clock
- **Where:** `web/lib/projections/gameLength.ts:33 (calculateCompletedGameLengthSeconds)`; `web/lib/projections/gameLength.ts:33 calculateCompletedGameLengthSeconds`
- **Tags (heuristic):** generation: current
- **Opus view (FRG-008):**
  - Method: REG = 3600; SO = 3900; OT: 3600 + completed OT periods x (300 regular / 1200 playoff) + elapsed of last OT.
  - Inputs/units: mm:ss clock; sources: pbp payload
  - Output scale: seconds; writes: —
  - Status: live
  - Consumers: start chart/accounting
- **Codex view (web-lib-projections-gamelength-calculatecompletedgamelengthseconds, symbol_candidate, location; Codex family 'FORGE staged projection math'):** Calculate completed game length seconds (calculateCompletedGameLengthSeconds)
  - Purpose: Calculate completed game length seconds for forge staged projection math. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: export function calculateCompletedGameLengthSeconds( source: CompletedGameLengthSource, ): number { const gameType = Number(normalizeNhlGameType(source.gameType)); const periodNumber = source.periodDescriptor?.number; const lastPeriodType = source.gameOutcome?.lastPeriodType; if (!Number.isSafeInteger(periodNumber) \|\| (periodNumber ?? 0) <= 0) { throw new Error("Invalid final period number"); } if (periodNumber === 3 && lastPeriodType === "REG") return 60 * 60; if (periodNumber === 5 && lastPeriodType === "SO") { if (gameType === 3) throw new Error("Playoff games cannot end in a shootout"); return 65 * 60; }
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex web-lib-projections-gamelength-calculatecompletedgamelengthseconds): {"source": "web/lib/projections/gameLength.ts:33", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["web/lib/projections/gameLength.ts:44 if (periodNumber === 3 && lastPeriodType === \"REG\") return 60 * 60;", "web/lib/projections/gameLength.ts:49 return 65 * 60;", "web/lib/projections/gameLength.ts:53 const overtimePeriodSeconds = gameType === 3 ? 20 * 60 : 5 * 60;", "web/lib/projections/gameLength.ts:60 60 * 60 +", "web/lib/projections/gameLength.ts:61 completedOvertimePeriods * overtimePeriodSeconds +"]}
  - External references: NHL OT rules
  - Fixtures/test data: none listed
  - Tests: `web/lib/projections/gameLength.test.ts`; `{"status": "Discovered only; not run", "references": ["web/lib/projections/gameLength.test.ts:4"]}`
- **Leads (not audited):**
  - (codex:web-lib-projections-gamelength-calculatecompletedgamelengthseconds) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-FRG-007 Reserve (if-dressed / if-starts) projections

- **Match:** Both; Opus FRG-009; Codex web-lib-projections-reserveprojections-buildreservegoalierow, web-lib-projections-reserveprojections-buildreserveskaterline
- **Purpose:** Per-game lines for roster players outside the lineup and backup goalies
- **Where:** `web/lib/projections/reserveProjections.ts:52 (buildReserveSkaterLine)`; `web/lib/projections/reserveProjections.ts:103 (selectReserveSkaters)`; `web/lib/projections/reserveProjections.ts:144 (buildReserveGoalieRow)`; `web/lib/projections/stages/goalie-stage.ts:833 (reserve goalies)`; `web/lib/projections/reserveProjections.ts:144 buildReserveGoalieRow`; `web/lib/projections/reserveProjections.ts:52 buildReserveSkaterLine`
- **Tags (heuristic):** denominators: per 60, per game; generation: current
- **Opus view (FRG-009):**
  - Method: Skater TOI = last5 avg else season avg else role default (F 620 s, D 900 s ES; PP 0) x rest TOI mult; same shot-rate, conversion (sample-weight shrink), assist-share and physical functions as lineup; assists use the lineup's on-ice goals and assist scale; not reconciled. Goalie: computeGoalieProjectionModel with starterProbability 1 on lineup shots against. Rows x horizon scalar (shutout probability not scaled).
  - Inputs/units: seconds; counts; sources: rolling_player_game_metrics, rosters, players
  - Output scale: counts per game x horizon; writes: forge_reserve_projections
  - Status: flagged off — FORGE_RESERVE_PASS_ENABLED must be 'true' (reserveProjections.ts:23)
  - Consumers: RSO bridge (reads reserve rows)
- **Codex view (web-lib-projections-reserveprojections-buildreservegoalierow, symbol_candidate, location; Codex family 'FORGE staged projection math'):** Build reserve goalie row (buildReserveGoalieRow)
  - Purpose: forge_reserve_projections row for a goalie other than the selected starter: his own line if he starts.
  - Inputs/units: Parameter/type declaration excerpt: export function buildReserveGoalieRow(scope: RowScope & { reason: ReserveReason; horizonScalar: number; model: { shotsAgainst: number; projectedSaves: number; projectedGoalsAllowed: number; shutoutProbability: number; modeledSavePct: number } }) { const { model, horizonScalar: k } = scope; return { run_id: scope.runId, as_of_date: scope.asOfDate, horizon_games: scope.horizonGames, game_id: scope.gameId, player_id: scope.playerId, team_id: scope.teamId, opponent_team_id: scope.opponentTeamId, player_class: "goalie" as const, conditioning: "if_starts" as const, reserve_reason: scope.reason, model_version: FORGE_RESERVE_MODEL_VERSION, proj_toi_es_seconds: null, proj_toi_pp_seconds: null, proj_shots_es: null, proj_shots_pp: null, proj_goals_es: null, proj_g…
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": ["forge-reserve-v1"], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (web-lib-projections-reserveprojections-buildreserveskaterline, symbol_candidate, location; Codex family 'FORGE staged projection math'):** Build reserve skater line (buildReserveSkaterLine)
  - Purpose: One skater's per-game line if he dresses: the lineup pass's rate model on his own recent usage. Null without any even-strength or power-play rolling row (no NHL usage to project from).
  - Inputs/units: Parameter/type declaration excerpt: export function buildReserveSkaterLine(args: { position: string \| null; ev: RollingRow \| undefined; pp: RollingRow \| undefined; all: RollingRow \| undefined; currentSeasonId: number; league: LeaguePhysicalTotals \| null; context: ReserveGameContext; team: ReserveTeamEnvironment; }): ReserveSkaterLine \| null { const { position, ev, pp, all, context, team } = args; if (!ev && !pp) return null; const group = position === "D" ? "D" : "F"; const esToi = pick(ev?.toi_seconds_avg_last5, ev?.toi_seconds_avg_all); const ppToi = pick(pp?.toi_seconds_avg_last5, pp?.toi_seconds_avg_all); const toiEs = clamp((esToi?.value ?? RESERVE_ROLE_DEFAULT_TOI_ES_SECONDS[group]) * context.toiMultiplier, 0, 2600); const toiPp = clamp((ppToi?.value ?? 0) * context.toiMultipl…
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": ["forge-reserve-v1"], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): reserveProjections.ts:13-19 docstring; tasks/artifacts/forge-week-coverage-2026-10-26/DIAGNOSIS.md
  - Intended contract (Codex web-lib-projections-reserveprojections-buildreservegoalierow): {"source": "web/lib/projections/reserveProjections.ts:144", "explicit_comment": "forge_reserve_projections row for a goalie other than the selected starter: his own line if he starts.", "arithmetic_locations": ["web/lib/projections/reserveProjections.ts:153 proj_shots_against: fixed(model.shotsAgainst * k), proj_saves: fixed(model.projectedSaves * k),", "web/lib/projections/reserveProjections.ts:154 proj_goals_allowed: fixed(model.projectedGoalsAllowed * k), proj_shutout_prob: fixed(model.shutoutProbability, 4),"]}
  - Intended contract (Codex web-lib-projections-reserveprojections-buildreserveskaterline): {"source": "web/lib/projections/reserveProjections.ts:52", "explicit_comment": "One skater's per-game line if he dresses: the lineup pass's rate model on his own recent usage. Null without any even-strength or power-play rolling row (no NHL usage to project from).", "arithmetic_locations": ["web/lib/projections/reserveProjections.ts:61 const toiEs = clamp((esToi?.value ?? RESERVE_ROLE_DEFAULT_TOI_ES_SECONDS[group]) * context.toiMultiplier, 0, 2600);", "web/lib/projections/reserveProjections.ts:62 const toiPp = clamp((ppToi?.value ?? 0) * context.toiMultiplier, 0, 1300);", "web/lib/projections/reserveProjections.ts:69 shotsRecent: ev?.shots_total_last5, toiRecentSeconds: ev?.toi_seconds_total_last5 }) * context.shotRateMultiplier, 1.5, 20);", "web/lib/projections/reserveProjections.ts:72 shotsRecent: pp?.shots_total_last5, toiRecentSeconds: pp?.toi_seconds_total_last5 }) * context.shotRateMultiplier, 2, 28);", "web/lib/projections/reserveProjections.ts:83 const goalRateEs = clamp(split.goalRateEs * w + (1 - w) * prior.es.perShot, 0.025, 0.3);", "web/lib/projections/reserveProjections.ts:84 const goalRatePp = clamp(split.goalRatePp * w + (1 - w) * prior.pp.perShot, 0.04, 0.45);", "w…
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/projections/reserveProjections.test.ts`; `{"status": "Discovered only; not run", "references": ["web/lib/projections/reserveProjections.test.ts:6"]}`
- **Leads (not audited):**
  - (opus) observation: reserve TOI is unreconciled raw last-5 (no deployment prior blend, no role bounds)
  - (opus) observation: reserve goalie shutout prob not multiplied by horizon while lineup goalie shutout is
  - (codex:web-lib-projections-reserveprojections-buildreservegoalierow) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:web-lib-projections-reserveprojections-buildreserveskaterline) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-FRG-008 Season-opening bootstrap blend

- **Match:** Both; Opus FRG-011; Codex web-lib-projections-seasonbootstrap-averagebootstrapstats, web-lib-projections-seasonbootstrap-blendseasonbootstrap, web-lib-projections-seasonbootstrap-bootstrapgoalieline, web-lib-projections-seasonbootstrap-bootstrapskaterline, web-lib-projections-seasonbootstrap-buildseasonhistory
- **Purpose:** Blend early-season organic projections with previous-season per-appearance history
- **Where:** `web/lib/projections/seasonBootstrap.ts:39 (buildSeasonHistory)`; `web/lib/projections/seasonBootstrap.ts:70 (blendSeasonBootstrap)`; `web/lib/projections/seasonBootstrap.ts:91 (bootstrapSkaterLine)`; `web/lib/projections/seasonBootstrap.ts:129 (bootstrapGoalieLine)`; `web/lib/projections/seasonBootstrap.ts:142 (loadSeasonBootstrap)`; `web/lib/projections/seasonBootstrap.ts:32 averageBootstrapStats`; `web/lib/projections/seasonBootstrap.ts:70 blendSeasonBootstrap`; `web/lib/projections/seasonBootstrap.ts:129 bootstrapGoalieLine`; `web/lib/projections/seasonBootstrap.ts:91 bootstrapSkaterLine`; `web/lib/projections/seasonBootstrap.ts:39 buildSeasonHistory`
- **Tags (heuristic):** denominators: per game, per appearance; generation: current
- **Opus view (FRG-011):**
  - Method: History = equal-weight mean of last 20 previous-season appearances. progress = min(1, currentGames/20); historyWeight = (1-progress)*0.4; stat = (organic*progress + history*historyWeight)/(progress+historyWeight). Skater history is multiplied by context (goal/assist/shot multipliers, PPP by mean of goal/assist, PP usage = projected PP TOI / previous PP TOI clamped 0-2). Goalie: blended sv rate applied to today's organic shots. Only when seasonBootstrap (horizon 1, no decisionAsOf, compute flag).
  - Inputs/units: counts per appearance; minutes mm:ss parsed; sources: skatersGameStats, goaliesGameStats, games
  - Output scale: counts per game; writes: forge_player_projections (values), uncertainty.season_bootstrap
  - Status: flagged off — requires seasonBootstrap (STARTER_BOARD_COMPUTE_ENABLED compute flag, horizon 1)
  - Consumers: skater and goalie stages
- **Codex view (web-lib-projections-seasonbootstrap-averagebootstrapstats, calculation, location; Codex family 'FORGE staged projection math'):** Previous-season appearance means (averageBootstrapStats)
  - Purpose: Equal-weight average of finite available observations per category, keeping missing category null.
  - Inputs/units: Count or minute values per historical appearance.
  - Output scale: Category mean in same units.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (web-lib-projections-seasonbootstrap-blendseasonbootstrap, calculation, location; Codex family 'FORGE staged projection math'):** Season-opening native-history transition (blendSeasonBootstrap)
  - Purpose: progress=clamp(currentGames/20); historyWeight=(1-progress)*.4; renormalize available organic weight=progress and history weight per category. Fantasy source weight always zero.
  - Inputs/units: Organic per-game category means and prior-season appearance means/counts.
  - Output scale: Blended category counts/minutes and disclosure; unvalidated bootstrap.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (web-lib-projections-seasonbootstrap-bootstrapgoalieline, symbol_candidate, codex_part_of_opus; Codex family 'FORGE staged projection math'):** Bootstrap goalie line (bootstrapGoalieLine)
  - Purpose: Keep today's opponent-driven shot volume while shrinking goalie performance.
  - Inputs/units: Parameter/type declaration excerpt: export function bootstrapGoalieLine(organic: BoardStats, prior: SeasonBootstrap) { const result = blendSeasonBootstrap(organic, prior); const saves = result.stats.SAVES_GOALIE, ga = result.stats.GOALS_AGAINST_GOALIE; const shots = organic.SHOTS_AGAINST_GOALIE; if (shots != null && saves != null && ga != null && saves + ga > 0) { result.stats.SAVES_GOALIE = shots * saves / (saves + ga); result.stats.GOALS_AGAINST_GOALIE = shots - result.stats.SAVES_GOALIE; result.stats.SHOTS_AGAINST_GOALIE = shots; } return result; } /** These reads participate in the existing immutable FORGE input transcript. */
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (web-lib-projections-seasonbootstrap-bootstrapskaterline, symbol_candidate, codex_part_of_opus; Codex family 'FORGE staged projection math'):** Bootstrap skater line (bootstrapSkaterLine)
  - Purpose: Bootstrap skater line for forge staged projection math. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: export function bootstrapSkaterLine(organic: { goalsEs: number; goalsPp: number; assistsEs: number; assistsPp: number; shotsEs: number; shotsPp: number; hits: number; blocks: number }, prior: SeasonBootstrap, context: { goals: number; assists: number; shots: number; ppUsage: number }) { const contextualize = (stats: BoardStats): BoardStats => { const next = { ...stats }; for (const [key, factor] of Object.entries({ GOALS: context.goals, PP_GOALS: context.goals, ASSISTS: context.assists, SHOTS_ON_GOAL: context.shots, PP_POINTS: (context.goals + context.assists) / 2 })) { if (next[key] != null) next[key] = next[key]! * factor; } const ppPoints = next.PP_POINTS; if (ppPoints != null) { const totalPoints = (next.GOALS ?? 0) + (next.ASSISTS ?? 0); const ppGo…
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (web-lib-projections-seasonbootstrap-buildseasonhistory, symbol_candidate, codex_part_of_opus; Codex family 'FORGE staged projection math'):** Build season history (buildSeasonHistory)
  - Purpose: Build season history for forge staged projection math. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: export function buildSeasonHistory(rows: any[], seasonId: number, cutoffDate: string, population: "skater" \| "goalie", windowGames = SEASON_BOOTSTRAP_POLICY.historyGames) { if (!Number.isInteger(windowGames) \|\| windowGames < 1 \|\| windowGames > 84) throw new Error("Invalid season history window"); const previousSeason = seasonId - 10001; const seen = new Set<number>(); const eligible = rows.filter((row) => { const game = row.games; const playedMinutes = minutes(row.toi) ?? (population === "goalie" ? nonnegative(row.toi_seconds) : null); if (!game \|\| Number(game.type) !== 2 \|\| game.date >= cutoffDate \|\| ![seasonId, previousSeason].includes(Number(game.seasonId)) \|\| !playedMinutes \|\| seen.has(Number(game.id))) return false; seen.add(Number(g…
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): seasonBootstrap.ts:4-8 comment and SEASON_BOOTSTRAP_POLICY
  - Intended contract (Codex web-lib-projections-seasonbootstrap-averagebootstrapstats): {"source": "web/lib/projections/seasonBootstrap.ts:32", "explicit_comment": "Missing categories stay missing; each available row has equal weight.", "arithmetic_locations": ["web/lib/projections/seasonBootstrap.ts:35 return [key, values.length ? values.reduce((a, b) => a + b, 0) / values.length : null];"]}
  - Intended contract (Codex web-lib-projections-seasonbootstrap-blendseasonbootstrap): {"source": "web/lib/projections/seasonBootstrap.ts:70", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["web/lib/projections/seasonBootstrap.ts:71 const progress = Math.min(1, Math.max(0, prior.currentSeasonGames) / SEASON_BOOTSTRAP_POLICY.transitionGames);", "web/lib/projections/seasonBootstrap.ts:72 const historyWeight = (1 - progress) * SEASON_BOOTSTRAP_POLICY.historyShare;", "web/lib/projections/seasonBootstrap.ts:78 stats[key] = weight ? parts.reduce((sum, [value, w]) => sum + value * w, 0) / weight : organic[key] ?? null;"]}
  - Intended contract (Codex web-lib-projections-seasonbootstrap-bootstrapgoalieline): {"source": "web/lib/projections/seasonBootstrap.ts:129", "explicit_comment": "Keep today's opponent-driven shot volume while shrinking goalie performance.", "arithmetic_locations": ["web/lib/projections/seasonBootstrap.ts:134 result.stats.SAVES_GOALIE = shots * saves / (saves + ga);", "web/lib/projections/seasonBootstrap.ts:141 /** These reads participate in the existing immutable FORGE input transcript. */"]}
  - Intended contract (Codex web-lib-projections-seasonbootstrap-bootstrapskaterline): {"source": "web/lib/projections/seasonBootstrap.ts:91", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["web/lib/projections/seasonBootstrap.ts:97 ASSISTS: context.assists, SHOTS_ON_GOAL: context.shots, PP_POINTS: (context.goals + context.assists) / 2 })) {", "web/lib/projections/seasonBootstrap.ts:98 if (next[key] != null) next[key] = next[key]! * factor;", "web/lib/projections/seasonBootstrap.ts:103 const ppGoals = Math.min(ppPoints, next.PP_GOALS ?? (totalPoints ? ppPoints * (next.GOALS ?? 0) / totalPoints : 0));", "web/lib/projections/seasonBootstrap.ts:104 if (next.GOALS != null) next.GOALS = Math.max(0, next.GOALS + ppGoals * (context.ppUsage - 1));", "web/lib/projections/seasonBootstrap.ts:105 if (next.ASSISTS != null) next.ASSISTS = Math.max(0, next.ASSISTS + (ppPoints - ppGoals) * (context.ppUsage - 1));", "web/lib/projections/seasonBootstrap.ts:106 next.PP_POINTS = ppPoints * context.ppUsage;", "web/lib/projections/seasonBootstrap.ts:107 next.PP_GOALS = ppGoals * context.ppUsage;", "web/lib/projections/seasonBootstrap.ts:122 const ppShotShare = organic.shotsEs + organic.shotsPp > 0 ? organic.shotsPp / …
  - Intended contract (Codex web-lib-projections-seasonbootstrap-buildseasonhistory): {"source": "web/lib/projections/seasonBootstrap.ts:39", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": []}
  - External references: Marcel-style prior-season regression
  - Fixtures/test data: none listed
  - Tests: `{"status": "Discovered only; not run", "references": ["web/lib/projections/nativeGoalAccounting.test.ts:73", "web/lib/projections/nativeInputEligibility.test.ts:23", "web/lib/projections/startChartPipeline.test.ts:8"]}`; `{"status": "Discovered only; not run", "references": ["web/lib/projections/nativeInputEligibility.test.ts:23", "web/lib/projections/startChartPipeline.test.ts:8"]}`; `{"status": "Discovered only; not run", "references": ["web/lib/projections/startChartPipeline.test.ts:8"]}`; `{"status": "Discovered only; not run", "references": ["web/lib/projections/startChartPipeline.test.ts:9"]}`
- **Leads (not audited):**
  - (opus) observation: at 0 current games weights are progress=0 and history=0.4, so the result is 100% history (weights normalised)
  - (opus) observation: history weight 0.4 marked 'unvalidated'
  - (opus) observation: no age/aging adjustment
  - (codex:web-lib-projections-seasonbootstrap-averagebootstrapstats) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested."]
  - (codex:web-lib-projections-seasonbootstrap-blendseasonbootstrap) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested."]
  - (codex:web-lib-projections-seasonbootstrap-bootstrapgoalieline) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:web-lib-projections-seasonbootstrap-bootstrapskaterline) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:web-lib-projections-seasonbootstrap-buildseasonhistory) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-FRG-009 Horizon per-game scalars

- **Match:** Both; Opus FRG-012; Codex web-lib-projections-utils-date-utils-buildsequentialhorizonscalarsfromdates
- **Purpose:** Scale per-game projections across a multi-game horizon with decay and rest penalties
- **Where:** `web/lib/projections/utils/date-utils.ts:41 (buildSequentialHorizonScalarsFromDates)`; `web/lib/projections/stages/skater-stage.ts:1272 (fetchTeamHorizonScalars)`; `web/lib/projections/stages/goalie-stage.ts:719 (goalieHorizonScalars)`; `web/lib/projections/constants/projection-weights.ts:46`; `web/lib/projections/utils/date-utils.ts:41 buildSequentialHorizonScalarsFromDates`
- **Tags (heuristic):** denominators: per game; generation: current
- **Opus view (FRG-012):**
  - Method: Horizon clamped 1..10 (MAX_SUPPORTED_HORIZON_GAMES). Game i scalar = 1 - 0.015*i (HORIZON_DECAY_PER_GAME); -0.12 if 0 rest days, -0.08 if back-to-back (rest 1), +0.03 if rest>=3; clamp [0.75,1.08]. Projections stored = per-game value x sum(scalars). Goalie horizon scalar = mean of own and opponent team scalars per index.
  - Inputs/units: dates YYYY-MM-DD; rest in days; sources: games
  - Output scale: dimensionless multiplier 0.75-1.08 per game; sum ~ horizon; writes: forge_player_projections.proj_* (scaled), forge_team_projections, forge_goalie_projections
  - Status: live — every run; horizon=1 returns [1]
  - Consumers: skater stage; goalie stage; uncertainty sims
- **Codex view (web-lib-projections-utils-date-utils-buildsequentialhorizonscalarsfromdates, symbol_candidate, location; Codex family 'FORGE staged projection math'):** Build sequential horizon scalars from dates (buildSequentialHorizonScalarsFromDates)
  - Purpose: Build sequential horizon scalars from dates for forge staged projection math. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: export function buildSequentialHorizonScalarsFromDates( gameDates: string[], horizonGames: number ): number[] { const horizon = clampHorizonGames(horizonGames); const uniqueSortedDates = Array.from( new Set(gameDates.filter((d) => typeof d === "string" && d.length >= 10)) ) .map((d) => d.slice(0, 10)) .sort((a, b) => a.localeCompare(b)); const scalars: number[] = []; let previousDate: string \| null = null; for (let i = 0; i < horizon; i += 1) { const date = uniqueSortedDates[i] ?? null; const restDays = previousDate && date ? Math.max(0, daysBetweenDates(date, previousDate)) : null; let scalar = 1 - i * HORIZON_DECAY_PER_GAME;
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex web-lib-projections-utils-date-utils-buildsequentialhorizonscalarsfromdates): {"source": "web/lib/projections/utils/date-utils.ts:41", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["web/lib/projections/utils/date-utils.ts:58 let scalar = 1 - i * HORIZON_DECAY_PER_GAME;"]}
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/projections/runProjectionV2.test.ts`; `{"status": "Discovered only; not run", "references": ["web/lib/projections/module-imports.test.ts:7", "web/lib/projections/nativeGoalAccounting.test.ts:11", "web/lib/projections/runProjectionV2.test.ts:10"]}`
- **Leads (not audited):**
  - (opus) observation: expected production decays 1.5%/game with horizon index (a mean shift, not uncertainty)
  - (opus) observation: first game never gets a B2B penalty because the previous game before asOfDate is not in the date list
  - (opus) observation: goalie uses average of own and today's opponent scalars, but future games have different opponents
  - (opus) observation: games query uses date >= asOfDate (includes today's game) with no game-type filter
  - (codex:web-lib-projections-utils-date-utils-buildsequentialhorizonscalarsfromdates) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-FRG-010 Projections table proration and global ranks

- **Match:** Both; Opus FRG-014; Codex core-204, roster-skater-season-proration, web-lib-projectionsconfig-proration-computeproratedfantasypoints, web-lib-projectionsconfig-proration-getproratedstat
- **Purpose:** Prorate counting stats to 84 games and rank players by projected/actual FP
- **Where:** `web/lib/projectionsConfig/proration.ts:62 (getProratedStat)`; `web/lib/projectionsConfig/proration.ts:83 (computeProratedFantasyPoints)`; `web/utils/projectionsRanking.ts:8 (assignGlobalRanks)`; `web/utils/projectionsRanking.ts:8 assignGlobalRanks`; `web/lib/projectionsConfig/proration.ts:62 getProratedStat`; `web/lib/projectionsConfig/proration.ts:83 computeProratedFantasyPoints`
- **Tags (heuristic):** denominators: per game; generation: current
- **Opus view (FRG-014):**
  - Method: prorated = raw/GP x 84 (NHL_REGULAR_SEASON_GAMES); FP = sum(prorated x weight) with defaults merged; ranks by descending FP (nulls as 0) across skaters+goalies.
  - Inputs/units: season totals; sources: projection source tables (draft dashboard)
  - Output scale: fantasy points; rank 1..N; writes: —
  - Status: live
  - Consumers: pages/projections/index.tsx; draft dashboard playerValues
- **Codex view (core-204, calculation, location; Codex family 'projection display'):** Global projected/actual fantasy ranks
  - Formula: Sort descending projected then actual, missing 0; assign index+1 independently.
  - Purpose: Calculate global projected/actual fantasy ranks.
  - Inputs/units: Skater/goalie projected and actual fantasy points.
  - Output scale: Ordinal rank 1..N for each.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f.  Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final status check.
- **Codex view (roster-skater-season-proration, calculation, codex_part_of_opus; Codex family 'draft-projections'):** 84-game skater pace and prorated fantasy points
  - Purpose: Eligible counting stat→raw/GP×84; exclude goalie, +/- and time/rate stats. Re-score prorated supported counts with authoritative or merged scoring map.
  - Inputs/units: Projected count stats, projected GP, scoring points/stat and enabled flag.
  - Output scale: Projected 84-game counting pace and fantasy points.
  - Version/status: No formula version declared in inspected file. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Codex view (web-lib-projectionsconfig-proration-computeproratedfantasypoints, calculation, codex_part_of_opus; Codex family 'Fantasy scoring and display pacing'):** Prorated fantasy total (computeProratedFantasyPoints)
  - Purpose: Sum optionally paced category × resolved default/custom/position-specific weight; omitted authoritative categories zero.
  - Inputs/units: Named model/observation inputs at cited declaration; Fantasy points or null. Input count/rate units follow the corresponding named outcome; cutoff timestamps and identity are required where declared.
  - Output scale: Fantasy points or null.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (web-lib-projectionsconfig-proration-getproratedstat, calculation, codex_part_of_opus; Codex family 'Fantasy scoring and display pacing'):** 84-game skater proration (getProratedStat)
  - Purpose: Eligible projected counting stat / projected GP ×84; bypass goalie/rate/noneligible stats.
  - Inputs/units: Named model/observation inputs at cited declaration; 84-game paced counting stat; original source unchanged. Input count/rate units follow the corresponding named outcome; cutoff timestamps and identity are required where declared.
  - Output scale: 84-game paced counting stat; original source unchanged.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): proration.ts:1-4 header
  - Intended contract (Codex core-204): Source types and implementation in web/utils/projectionsRanking.ts:8; separate acceptance not verified.
  - Intended contract (Codex roster-skater-season-proration): Optional comparison value transformation; preserves original projections. NHL_REGULAR_SEASON_GAMES=84. Source: web/lib/projectionsConfig/proration.ts:62 getProratedStat.
  - Intended contract (Codex web-lib-projectionsconfig-proration-computeproratedfantasypoints): {"source": "web/lib/projectionsConfig/proration.ts:83", "explicit_comment": "Compute fantasy points total using (optionally) prorated counting stats.", "arithmetic_locations": ["web/lib/projectionsConfig/proration.ts:112 total += val * weight;"]}
  - Intended contract (Codex web-lib-projectionsconfig-proration-getproratedstat): {"source": "web/lib/projectionsConfig/proration.ts:62", "explicit_comment": "Return (raw / GP) * season games for eligible skater counting stats.", "arithmetic_locations": ["web/lib/projectionsConfig/proration.ts:79 return (raw / gp) * NHL_REGULAR_SEASON_GAMES;", "web/lib/projectionsConfig/proration.ts:82 /** Compute fantasy points total using (optionally) prorated counting stats. */"]}
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `No directly named test located; tests not run.`; `web/lib/draftDashboard/fantasyPointRecalculation.test.ts`; `{"discovered_not_run": ["web/lib/draftDashboard/fantasyPointRecalculation.test.ts"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`; `{"status": "Discovered only; not run", "references": ["No direct symbol/module test reference found in bounded search."]}`; `{"status": "Discovered only; not run", "references": ["web/lib/draftDashboard/fantasyPointRecalculation.test.ts:3"]}`
- **Leads (not audited):**
  - (opus) observation: 84-game season hard-coded
  - (opus) observation: null FP ranked as 0
  - (opus) observation: mixed skater/goalie ranking on one FP scale
  - (codex:core-204) ["Inventory only, not validation of the formula, source semantics or model quality."]
  - (codex:roster-skater-season-proration) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.
  - (codex:web-lib-projectionsconfig-proration-computeproratedfantasypoints) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested."]
  - (codex:web-lib-projectionsconfig-proration-getproratedstat) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested."]

## M-FRG-011 FORGE goalie matchup win-probability normalization

- **Match:** Both; Opus FRG-020; Codex goalie-reader-win-normalization
- **Purpose:** Rescale projected goalie win probabilities in a matchup so they sum to 100%.
- **Where:** `web/pages/api/v1/forge/goalies.ts:151 (normalizeLikelyStarterWinProbabilities)`; `web/pages/api/v1/forge/goalies.ts:151 normalizeLikelyStarterWinProbabilities`
- **Tags (heuristic):** percent scale: fraction 0-1; generation: current
- **Opus view (FRG-020):**
  - Method: Group rows by unordered team pair. Skip if any proj_win_prob is null. denominator = sum(max(0,win_prob)) else sum(starter_probability) else equal split 1/n. Each row = value/denominator rounded 4 dp; last row = 1 - running sum.
  - Inputs/units: probabilities 0-1; sources: forge_goalie_projections, forge_runs, forge_projection_calibration_daily
  - Output scale: probability 0-1; writes: —
  - Status: live — GoalieRiskCard; route ledger calls=13
  - Consumers: web/components/forge-dashboard/GoalieRiskCard.tsx; web/lib/dashboard/dataFetchers.ts
- **Codex view (goalie-reader-win-normalization, calculation, location; Codex family 'Goalie reader arithmetic'):** Likely-starter display win normalization
  - Purpose: Within matchup normalize nonnegative projected W mass, fallback to starter mass or equal weights; last value absorbs remainder after four-decimal rounding. Any unknown W in matchup prevents normalization.
  - Inputs/units: Selected likely-starter rows, proj_win_prob and starter_probability fractions.
  - Output scale: Normalized proj_win_prob per displayed row and adjusted-matchup count.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "source_state": "Assigned source paths remained clean at final git-status inspection.", "deployment": "Unknown; no live verification."}
- **Audit context:**
  - Intent (Opus): Comment forge/goalies.ts:173-174 (null win probability stays unknown); response note 'Normalized likely-starter win probabilities ... to total 100%' (line ~547)
  - Intended contract (Codex goalie-reader-win-normalization): {"source": "web/pages/api/v1/forge/goalies.ts:151", "statement": "Within matchup normalize nonnegative projected W mass, fallback to starter mass or equal weights; last value absorbs remainder after four-decimal rounding. Any unknown W in matchup prevents normalization."}
  - External references: Team win probabilities P(home)+P(away)=1; goalie-level win prob = P(start)*P(win\|start)
  - Fixtures/test data: `web/__tests__/pages/api/v1/forge/__snapshots__/goalies.test.ts.snap`
  - Tests: `web/__tests__/pages/api/v1/forge/goalies.test.ts`; `{"status": "Discovered, not run", "references": ["web/__tests__/pages/api/v1/forge/goalies.test.ts"]}`
- **Leads (not audited):**
  - (opus) every goalie row of both teams in the matchup (not just one likely starter per team) is normalized to sum to 1, so with two goalies per team team-level win probability is split, not preserved
  - (opus) run query filters run_id/as_of_date/horizon only; no starter filter before normalization
  - (opus) last-row remainder absorbs rounding, so ordering affects values
  - (codex:goalie-reader-win-normalization) ["No correctness/quality judgment. Active runtime and deployed version unknown."]

## M-FRG-012 FORGE counterfactual PP usage re-allocation

- **Match:** Both; Opus FRG-022; Codex research-script-allocatePpToi-forge-counterfactual-backtest, research-script-applyPpUsage-forge-counterfactual-backtest, research-script-scalePpLine-forge-counterfactual-backtest
- **Purpose:** Test replacing FORGE PP TOI targets with official per-player PP TOI history
- **Where:** `web/scripts/forge-counterfactual-backtest.ts:425 (allocatePpToi)`; `web/scripts/forge-counterfactual-backtest.ts:435 (scalePpLine)`; `web/scripts/forge-counterfactual-backtest.ts:448 (buildOfficialPp)`; `web/scripts/forge-counterfactual-backtest.ts:479 (applyPpUsage)`; `web/scripts/forge-counterfactual-backtest.ts:425 allocatePpToi`; `web/scripts/forge-counterfactual-backtest.ts:479 applyPpUsage`; `web/scripts/forge-counterfactual-backtest.ts:435 scalePpLine`
- **Tags (heuristic):** denominators: per game; generation: research, development
- **Opus view (FRG-022):**
  - Method: team PP TOI target = mean over the team's last 10 regular-season games (gameType 2 or gameId digits 5-6 == '02') of summed player PP TOI; player weight = his mean PP TOI over those games he appeared in; allocate rest = target - fallback-seconds of unweighted players pro-rata by weight; scale PP line by newTOI/oldTOI (shots per PP second and per-shot conversion constant); zero old TOI uses group rates shotsPerSecond, goalsPerShot, assistsPerShot; agreement check \|pp_toi diff\|<=1 s
  - Inputs/units: PP TOI seconds; sources: local JSON exports (wgo_pp, team_strength, pp_usage, pp_actuals)
  - Output scale: PP TOI seconds and expected PP counts per game; writes: --output file only
  - Status: draft — optional flags --pp-actuals/--pp-usage/--wgo-pp/--team-strength on offline backtest
  - Consumers: FORGE PP usage methodology
- **Codex view (research-script-allocatePpToi-forge-counterfactual-backtest, symbol_candidate, location; Codex family 'Projection fitting and backtest scripts'):** allocatePpToi
  - Purpose: Counterfactual projection arithmetic or paired diagnostic on retained inputs; no model promotion implied.
  - Inputs/units: Frozen model/projection rows, official labels, rates or exposures per declaration; evaluation units follow target.
  - Output scale: Diagnostic/model quantities returned by named function; see formula evidence.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "deployment": "Unknown; source inspection only."}
- **Codex view (research-script-applyPpUsage-forge-counterfactual-backtest, symbol_candidate, location; Codex family 'Projection fitting and backtest scripts'):** applyPpUsage
  - Purpose: Counterfactual projection arithmetic or paired diagnostic on retained inputs; no model promotion implied.
  - Inputs/units: Frozen model/projection rows, official labels, rates or exposures per declaration; evaluation units follow target.
  - Output scale: Diagnostic/model quantities returned by named function; see formula evidence.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "deployment": "Unknown; source inspection only."}
- **Codex view (research-script-scalePpLine-forge-counterfactual-backtest, symbol_candidate, location; Codex family 'Projection fitting and backtest scripts'):** scalePpLine
  - Purpose: Counterfactual projection arithmetic or paired diagnostic on retained inputs; no model promotion implied.
  - Inputs/units: Frozen model/projection rows, official labels, rates or exposures per declaration; evaluation units follow target.
  - Output scale: Diagnostic/model quantities returned by named function; see formula evidence.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "deployment": "Unknown; source inspection only."}
- **Audit context:**
  - Intent (Opus): doc comments web/scripts/forge-counterfactual-backtest.ts:424,434,443-446
  - Intended contract (Codex research-script-allocatePpToi-forge-counterfactual-backtest): {"source": "web/scripts/forge-counterfactual-backtest.ts:425", "arithmetic_locations": ["web/scripts/forge-counterfactual-backtest.ts:430 if (totalW > 0) for (const p of players) if (p.weight != null) out.set(p.playerId, (rest * p.weight) / totalW);", "web/scripts/forge-counterfactual-backtest.ts:434 /** PP shots keep shots per PP second and PP goals/assists keep conversion per shot; zero old TOI uses group rates. */"]}
  - Intended contract (Codex research-script-applyPpUsage-forge-counterfactual-backtest): {"source": "web/scripts/forge-counterfactual-backtest.ts:479", "arithmetic_locations": ["web/scripts/forge-counterfactual-backtest.ts:504 return { playerId: Number(u.player_id), weight, fallbackSeconds: (num(obj(u.pp_opportunity).allocated_player_pp_share) ?? 0) * oldTarget };", "web/scripts/forge-counterfactual-backtest.ts:519 return { shotsPerSecond: toi > 0 ? shots / toi : 0, goalsPerShot: shots > 0 ? sum((r) => r.ppBase!.gPp ?? 0) / shots : 0,", "web/scripts/forge-counterfactual-backtest.ts:520 assistsPerShot: shots > 0 ? sum((r) => (r.ppBase!.aPp ?? 0) + (pp2 ? r.ppBase!.ppAssistDelta : 0)) / shots : 0 };", "web/scripts/forge-counterfactual-backtest.ts:542 .filter(([a, b]) => a != null && b != null && b > 0).map(([a, b]) => a! / b!);", "web/scripts/forge-counterfactual-backtest.ts:547 `S8 toi_pp_seconds / summed S7 per team-game: mean ${f(mean(s8Ratios), 3)} over ${s8Ratios.length} team-games; S7 rows with no team mapping: ${official.unmappedRows}.`,"]}
  - Intended contract (Codex research-script-scalePpLine-forge-counterfactual-backtest): {"source": "web/scripts/forge-counterfactual-backtest.ts:435", "arithmetic_locations": ["web/scripts/forge-counterfactual-backtest.ts:437 const k = newToi / old.PP_TOI;", "web/scripts/forge-counterfactual-backtest.ts:438 return { PP_TOI: newToi, PP_SHOTS: old.PP_SHOTS * k, PP_GOALS: old.PP_GOALS * k, PP_ASSISTS: old.PP_ASSISTS * k };", "web/scripts/forge-counterfactual-backtest.ts:440 const shots = newToi * groupRate.shotsPerSecond;", "web/scripts/forge-counterfactual-backtest.ts:441 return { PP_TOI: newToi, PP_SHOTS: shots, PP_GOALS: shots * groupRate.goalsPerShot, PP_ASSISTS: shots * groupRate.assistsPerShot };", "web/scripts/forge-counterfactual-backtest.ts:444 /**", "web/scripts/forge-counterfactual-backtest.ts:445 * Official per-player PP TOI (S7), regular season only. Team target = mean over the team's last 10 regular-season games"]}
  - External references: none suggested
  - Fixtures/test data: `web/scripts/fixtures/forge-counterfactual-backtest/wgo_pp.json`; `web/scripts/fixtures/forge-counterfactual-backtest/pp_usage.json`
  - Tests: `web/scripts/forge-counterfactual-backtest.test.ts`; `{"status": "Discovered; not run", "references": ["web/scripts/forge-counterfactual-backtest.test.ts"]}`
- **Leads (not audited):**
  - (opus) players are mapped to a single team (playerTeam map) so traded players' history is attributed to current team
  - (codex:research-script-allocatePpToi-forge-counterfactual-backtest) ["Deployment and runtime behavior not verified; calculation listed without correctness assessment.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:research-script-applyPpUsage-forge-counterfactual-backtest) ["Deployment and runtime behavior not verified; calculation listed without correctness assessment.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:research-script-scalePpLine-forge-counterfactual-backtest) ["Deployment and runtime behavior not verified; calculation listed without correctness assessment.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-FRG-013 FORGE skater counterfactual: conversion rates, used-rate clamps, bootstrap blend inversion

- **Match:** Both; Opus FRG-023; Codex research-script-bayesSplitRates-forge-counterfactual-backtest, research-script-bootstrapWeights-forge-counterfactual-backtest, research-script-counterfactualHeads-forge-counterfactual-backtest, research-script-usedRates-forge-counterfactual-backtest
- **Purpose:** Re-derive FORGE skater G/A/PPP projections under alternative rules (Q7 no second shrink, Q8 B2B rest tiers, assist-denominator refits) from stored support counts
- **Where:** `web/scripts/forge-counterfactual-backtest.ts:54 (bayesSplitRates)`; `web/scripts/forge-counterfactual-backtest.ts:89 (usedRates)`; `web/scripts/forge-counterfactual-backtest.ts:112 (bootstrapWeights)`; `web/scripts/forge-counterfactual-backtest.ts:124 (counterfactualHeads)`; `web/scripts/forge-counterfactual-backtest.ts:171 (evaluateRow)`; `web/scripts/forge-counterfactual-backtest.ts:28 (VARIANTS)`; `web/scripts/forge-counterfactual-backtest.ts:54 bayesSplitRates`; `web/scripts/forge-counterfactual-backtest.ts:112 bootstrapWeights`; `web/scripts/forge-counterfactual-backtest.ts:124 counterfactualHeads`; `web/scripts/forge-counterfactual-backtest.ts:89 usedRates`
- **Tags (heuristic):** denominators: per game; generation: research, development
- **Opus view (FRG-023):**
  - Method: audit re-derivation mirroring lib/projections/calculators/skater-adjustments: split conversion rates from ev/pp numerators/denominators (all + last5); goal rate clamps ES [0.025,0.30], PP [0.04,0.45]; assist trend clamps ES [0.2,1.7] / PP [0.3,2.0] (per-goal scale ES [0.4,3.4] / PP [0.6,4.0]); outer coupling clamps ES [0.2,1.8] / PP [0.3,2.1] (wideCoupling 3.0/3.5; per-goal 3.6/4.2); bootstrap organic share p = min(1, currentSeasonGames/(transitionGames\|\|20)), W = p + historyWeight(if history) + fantasyWeight(if sources); inversion residual R = W*final - p*organic, counterfactual = (p*organic' + restScale*R)/W; organic' scales goals by rg'/rg and assists by (rg'/rg)(ra'/ra); PPP optionally capped at G+A; tolerances rate 5e-4, rest 1.5e-4, residual 1e-3 drop mismatched rows
  - Inputs/units: counts per player (goals, shots, assists), rates per shot/per goal, multipliers unitless; sources: local JSON exports of forecast runs, forge projections (S2), actuals (S3), games (S4)
  - Output scale: expected counts per game (G, A, PPP); writes: --output markdown/JSON file only
  - Status: draft — offline research backtest, run manually on local exports
  - Consumers: FORGE methodology decisions (Q7/Q8, assist denominator R18); forge-skater-candidate-ablation.ts imports summarize/clusterBootstrap
- **Codex view (research-script-bayesSplitRates-forge-counterfactual-backtest, symbol_candidate, codex_part_of_opus; Codex family 'Projection fitting and backtest scripts'):** bayesSplitRates
  - Purpose: Counterfactual projection arithmetic or paired diagnostic on retained inputs; no model promotion implied.
  - Inputs/units: Frozen model/projection rows, official labels, rates or exposures per declaration; evaluation units follow target.
  - Output scale: Diagnostic/model quantities returned by named function; see formula evidence.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "deployment": "Unknown; source inspection only."}
- **Codex view (research-script-bootstrapWeights-forge-counterfactual-backtest, symbol_candidate, codex_part_of_opus; Codex family 'Projection fitting and backtest scripts'):** bootstrapWeights
  - Purpose: Counterfactual projection arithmetic or paired diagnostic on retained inputs; no model promotion implied.
  - Inputs/units: Frozen model/projection rows, official labels, rates or exposures per declaration; evaluation units follow target.
  - Output scale: Diagnostic/model quantities returned by named function; see formula evidence.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "deployment": "Unknown; source inspection only."}
- **Codex view (research-script-counterfactualHeads-forge-counterfactual-backtest, symbol_candidate, codex_part_of_opus; Codex family 'Projection fitting and backtest scripts'):** counterfactualHeads
  - Purpose: Counterfactual projection arithmetic or paired diagnostic on retained inputs; no model promotion implied.
  - Inputs/units: Frozen model/projection rows, official labels, rates or exposures per declaration; evaluation units follow target.
  - Output scale: Diagnostic/model quantities returned by named function; see formula evidence.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "deployment": "Unknown; source inspection only."}
- **Codex view (research-script-usedRates-forge-counterfactual-backtest, symbol_candidate, codex_part_of_opus; Codex family 'Projection fitting and backtest scripts'):** usedRates
  - Purpose: Counterfactual projection arithmetic or paired diagnostic on retained inputs; no model promotion implied.
  - Inputs/units: Frozen model/projection rows, official labels, rates or exposures per declaration; evaluation units follow target.
  - Output scale: Diagnostic/model quantities returned by named function; see formula evidence.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "deployment": "Unknown; source inspection only."}
- **Audit context:**
  - Intent (Opus): header comment web/scripts/forge-counterfactual-backtest.ts:11-14 ('Offline frozen-cohort backtest of Q7 ... and Q8 ...') and variant doc :24-28
  - Intended contract (Codex research-script-bayesSplitRates-forge-counterfactual-backtest): {"source": "web/scripts/forge-counterfactual-backtest.ts:54", "arithmetic_locations": ["web/scripts/forge-counterfactual-backtest.ts:85 /**", "web/scripts/forge-counterfactual-backtest.ts:86 * Used rates as persisted: (Q7 Bayes value \| legacy second shrink) x trend, then teammate coupling for assists.", "web/scripts/forge-counterfactual-backtest.ts:87 * `coupled` is the assist rate after coupling but before the outer clamp (for clamp-binding diagnostics)."]}
  - Intended contract (Codex research-script-bootstrapWeights-forge-counterfactual-backtest): {"source": "web/scripts/forge-counterfactual-backtest.ts:112", "arithmetic_locations": ["web/scripts/forge-counterfactual-backtest.ts:114 const p = Math.min(1, Math.max(0, num(sb.currentSeasonGames)!) / (num(sb.transitionGames) \|\| 20));", "web/scripts/forge-counterfactual-backtest.ts:120 /**", "web/scripts/forge-counterfactual-backtest.ts:121 * final_K = (p*org_K + R_K)/W  =>  R_K = W*final_K - p*org_K;  final_K' = (p*org_K' + s_K*R_K)/W.", "web/scripts/forge-counterfactual-backtest.ts:122 * org_g' = base_g * rg'/rg ; org_a' = base_a * (rg'/rg) * (ra'/ra), per ES/PP."]}
  - Intended contract (Codex research-script-counterfactualHeads-forge-counterfactual-backtest): {"source": "web/scripts/forge-counterfactual-backtest.ts:124", "arithmetic_locations": ["web/scripts/forge-counterfactual-backtest.ts:127 const gEs = base.ges * q.ges / r.ges, gPp = base.gpp * q.gpp / r.gpp;", "web/scripts/forge-counterfactual-backtest.ts:128 const aEs = base.aes * (q.ges / r.ges) * (q.aes / r.aes), aPp = base.app * (q.gpp / r.gpp) * (q.app / r.app);", "web/scripts/forge-counterfactual-backtest.ts:133 residual[k] = W * final[k] - p * org[k];", "web/scripts/forge-counterfactual-backtest.ts:134 pred[k] = (p * orgPrime[k] + args.restScale[k] * residual[k]) / W;", "web/scripts/forge-counterfactual-backtest.ts:142 /** Counterfactual organic (pre-bootstrap) assists per strength, per variant. */", "web/scripts/forge-counterfactual-backtest.ts:144 /** Stored columns and the PP-per-goal assist delta, used by the optional PP-usage counterfactual. */"]}
  - Intended contract (Codex research-script-usedRates-forge-counterfactual-backtest): {"source": "web/scripts/forge-counterfactual-backtest.ts:89", "arithmetic_locations": ["web/scripts/forge-counterfactual-backtest.ts:99 es: clamp(pick(assistOn, r.assistRateEs, \"assist_es\") * trend.a, esTrend[0], esTrend[1]) * teammate.es,", "web/scripts/forge-counterfactual-backtest.ts:100 pp: clamp(pick(assistOn, r.assistRatePp, \"assist_pp\") * trend.a, ppTrend[0], ppTrend[1]) * teammate.pp,", "web/scripts/forge-counterfactual-backtest.ts:105 ges: clamp(pick(q7, r.goalRateEs, \"goal_es\") * trend.g, 0.025, 0.3),", "web/scripts/forge-counterfactual-backtest.ts:106 gpp: clamp(pick(q7, r.goalRatePp, \"goal_pp\") * trend.g, 0.04, 0.45),", "web/scripts/forge-counterfactual-backtest.ts:107 aes: clamp(coupled.es, esMin, esMax) * (opts.assistScale ?? 1), app: clamp(coupled.pp, ppMin, ppMax) * (opts.assistScale ?? 1), coupled,", "web/scripts/forge-counterfactual-backtest.ts:111 /** Season-bootstrap weights: organic weight p and total weight W (null bootstrap = organic only). */"]}
  - External references: empirical-Bayes rate shrinkage; held-out MAE/RMSE comparison
  - Fixtures/test data: `web/scripts/fixtures/forge-counterfactual-backtest/ (runs, projections, actuals, games, pp_actuals, pp_usage, wgo_pp, team_strength JSON)`
  - Tests: `web/scripts/forge-counterfactual-backtest.test.ts`; `{"status": "Discovered; not run", "references": ["web/scripts/forge-counterfactual-backtest.test.ts"]}`
- **Leads (not audited):**
  - (opus) per-goal clamps copied by hand from skater-stage.ts (comment says not imported) so can drift
  - (opus) assist denominator 'per_two_goals' (assists per 2 goals) is the stored legacy scale; calculators' omitted default is 'mixed' per code comment
  - (codex:research-script-bayesSplitRates-forge-counterfactual-backtest) ["Deployment and runtime behavior not verified; calculation listed without correctness assessment.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:research-script-bootstrapWeights-forge-counterfactual-backtest) ["Deployment and runtime behavior not verified; calculation listed without correctness assessment.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:research-script-counterfactualHeads-forge-counterfactual-backtest) ["Deployment and runtime behavior not verified; calculation listed without correctness assessment.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:research-script-usedRates-forge-counterfactual-backtest) ["Deployment and runtime behavior not verified; calculation listed without correctness assessment.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-FRG-014 Served ledger scoring (MAE/bias/RMSE, Mincer-Zarnowitz, Brier, paired RMSE skill)

- **Match:** Both; Opus FRG-025; Codex served-ledger-paired-scoring, served-ledger-source-scoring
- **Purpose:** Score each served source and paired comparisons
- **Where:** `web/lib/player-forecasts/servedForecastLedger.ts:332 (errorStat)`; `web/lib/player-forecasts/servedForecastLedger.ts:345 (binaryScore)`; `web/lib/player-forecasts/servedForecastLedger.ts:396 (scoreLedger)`; `web/lib/player-forecasts/servedForecastLedger.ts:460 (pairedError)`; `web/lib/player-forecasts/servedForecastLedger.ts:473 (scorePairedLedger)`; `web/pages/api/v1/forge/scoreboard.ts`; `web/lib/player-forecasts/servedForecastLedger.ts:473 scorePairedLedger`; `web/lib/player-forecasts/servedForecastLedger.ts:460 pairedError`; `web/lib/player-forecasts/servedForecastLedger.ts:447 comparableValues`; `web/lib/player-forecasts/servedForecastLedger.ts:332 errorStat`; `web/lib/player-forecasts/servedForecastLedger.ts:345 binaryScore`; `web/lib/player-forecasts/servedForecastLedger.ts:380 fpBins` …
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: shots on goal; generation: current
- **Opus view (FRG-025):**
  - Method: Per head and FP: n, MAE, bias=(sumE-sumA)/n, RMSE, expected/actual ratio, MZ slope = cov(e,a)/var(e) and intercept; Brier and 10-bin reliability for win/shutout/start; expected-FP deciles; B2B subset; paired rmseSkill = 1 - sqrt(SSE_source/SSE_reference) on shared dressed player-games.
  - Inputs/units: counts; probabilities; sources: forge_served_forecast_ledger
  - Output scale: MAE/RMSE in stat units; Brier 0-1; skill <=1; writes: —
  - Status: live
  - Consumers: FORGE scoreboard API/page
- **Codex view (served-ledger-paired-scoring, calculation, location; Codex family 'Served forecast ledger evaluation'):** Matched-source error and RMSE skill comparisons (scorePairedLedger)
  - Purpose: Pair sources on season_id, served_date, player_class, player_id and game_id, then evaluate each head on the exact same known outcomes. Reuse per-source MAE/bias/RMSE/totals/ratio/MZ summaries and compute RMSE skill=1-sqrt(source SSE/reference SSE) from unrounded same-cohort squared errors. Also produce matched goalie binary Brier/reliability summaries, tied source-expected-FP deciles and exclusion/pairing counts.
  - Inputs/units: Two settled source records per same identity/date/player-game, category count or fantasy-point predictions, equal known category actuals, matching participation labels; goalie probabilities [0,1] and equal known binary start/win/shutout outcomes. Optional fantasy weights are points per category event.
  - Output scale: Head-specific paired n and exclusions are counts. Underlying MAE/bias/RMSE/intercept retain category count or FP units; slopes/ratios are dimensionless. RMSE skill is dimensionless <=1 with no finite lower bound, positive for lower source error, null when reference SSE=0 or no valid pair. Binary Brier and reliability means are [0,1]. Rounded to 4 decimals; paired/no_shared_player_games and scored/no_valid_pairs statuses are separate.
  - Version/status: Checked-in local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f. LEDGER_SOURCES includes bridge_exact, bridge_reaimed, native, naive_last5, naive_season, market; source names are not evidence of live/deployed population. LEDGER_MARKET_ENABLED is true in source only. Inspected source files clean; no tests or execution.
- **Codex view (served-ledger-source-scoring, calculation, location; Codex family 'Served forecast ledger evaluation'):** Per-source count, fantasy-point and goalie-event scoring (scoreLedger)
  - Purpose: Summarize each source on its own settled observed sample. For finite forecast/actual pairs compute MAE=mean(abs(forecast-actual)), signed bias=mean(forecast-actual), RMSE=sqrt(mean((forecast-actual)^2)), expected and actual sums, actual/expected total ratio, and Mincer–Zarnowitz regression actual=intercept+slope*forecast. Slope is covariance sum/forecast centered-squares sum; intercept=actual mean-slope*forecast mean. Separately compute goalie start/win/shutout Brier scores and ten probability-bin means. Report independent-universe coverage, phantoms, expected-FP decile and back-to-back slices.
  - Inputs/units: Settled source/player-game ledger predictions and actuals: skater G/A/PPP/SOG/HIT/BLK counts, goalie SV/GA/SA counts, fantasy points, goalie start/win/shutout probabilities [0,1] and known binary outcomes. Optional fantasy weights are points per category event; optional independent player-game universe contains known/unknown dressed membership. Rest days are calendar-day gaps.
  - Output scale: Per source and player class: n/covered/dressed/phantoms and cohort sizes are counts. MAE, bias, RMSE and MZ intercept have head count or fantasy-point units; expected/actual are cohort totals. MZ slope and actual/expected ratio are dimensionless and not bounded. Probability scores and reliability predicted/observed fractions are [0,1]. Coverage is covered/dressed when known nonzero denominator, otherwise null. Deciles are labels 1..10 and probability bins 0..9. Floating summaries rounded to 4 decimals.
  - Version/status: Checked-in local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f. LEDGER_SOURCES includes bridge_exact, bridge_reaimed, native, naive_last5, naive_season, market; source names are not evidence of live/deployed population. LEDGER_MARKET_ENABLED is true in source only. Inspected source files clean; no tests or execution.
- **Audit context:**
  - Intent (Opus): servedForecastLedger.ts:394-395 comment
  - Intended contract (Codex served-ledger-paired-scoring): web/lib/player-forecasts/servedForecastLedger.ts:469-472: never compare unrelated source-level averages; require both forecasts and equal known actuals; ambiguous duplicate source keys excluded. Comparisons follow pair order in LEDGER_SOURCES. Count/FP population requires both dressed; goalie binary population permits known nonstarts on participation-consistent pairs. Missing prediction, missing outcome and conflicting actuals counted separately for each head. Source expected-FP rank defines decile membership; optional weight recomputation preserves missing contributing heads. Definitions returned explicitly at :508-512.
  - Intended contract (Codex served-ledger-source-scoring): web/lib/player-forecasts/servedForecastLedger.ts:394-395 expressly distinguishes own-source observed samples from paired model comparison. Count/FP errors use dressed===true; goalie binary scores use all valid settled known events, including proven nonstarts. Identity-invalid and duplicate-source-key rows excluded. No finite pairs => null errors; constant forecast or n<2 => null MZ; zero forecast total => null ratio. Coverage requires independently captured, fully settled membership, not forecast rows. fpBins uses tied expected-FP midpoint rank only (no actuals), so deciles may be empty; B2B is team_rest_days===1. Missing nonzero-weight heads withhold recomputed FP.
  - External references: Mincer-Zarnowitz regression; Brier; RMSE skill score
  - Fixtures/test data: none listed
  - Tests: `web/lib/player-forecasts/servedForecastLedger.test.ts`; `web/lib/player-forecasts/servedForecastLedger.test.ts:164 scoreLedger suite: signed bias/MAE, coverage/phantoms, tied FP, B2B, goalie reliability and independent no-history universe. Discovered, not run.`; `web/lib/player-forecasts/servedForecastLedger.test.ts:209 paired suite covers same-cohort RMSE skill and MZ intercept, dates/seasons/games, duplicates and malformed identities, head-specific missing/conflicting actuals, DNPs, FP bins and weights, zero reference error, and valid/invalid binary events. Discovered, not run.`; `web/lib/player-forecasts/servedForecastLedger.test.ts:238 duplicate/invalid-key behavior; :265 expected-FP deciles; :291 known nonstart binary scoring. Discovered, not run.`; `web/lib/player-forecasts/servedForecastLedger.test.ts:392 market-implied mean paired reference. Discovered, not run.`
- **Leads (not audited):**
  - (opus) observation: per-source errors use each source's own sample (not paired) — documented
  - (codex:served-ledger-paired-scoring) ["Deployed ledger version, persisted population, active capture, independent universe availability and live coverage not verified.", "These are descriptive evaluation summaries, not predictive qualification, as explicitly stated in LEDGER_SCORING_LIMITATIONS."]
  - (codex:served-ledger-source-scoring) ["Deployed ledger version, persisted population, active capture, independent universe availability and live coverage not verified.", "These are descriptive evaluation summaries, not predictive qualification, as explicitly stated in LEDGER_SCORING_LIMITATIONS.", "Skater F/D position and expected/actual TOI and PP-TOI are absent from persisted scoring contract; no opportunity/rate decomposition is produced."]

## M-FRG-015 Fantasy points scoring (FORGE defaults and board)

- **Match:** Both; Opus FRG-026; Codex web-lib-projections-accuracy-fantasypoints-computegoaliefantasypoints, web-lib-projections-accuracy-fantasypoints-computeskaterfantasypoints, web-lib-projections-accuracy-fantasypoints-tonumber, web-lib-projections-starterboardscoring-scoreboardstats
- **Possible related records (low-confidence location link, unconfirmed):** web-lib-forge-v2-identity-scoremeans, web-lib-forge-v2-identity-scoringprofile, web-lib-projections-startchartfantasyscoring-computestartchartfantasypoints, web-lib-projections-starterboardscoring-integrateboardparticipation
- **Purpose:** Linear fantasy points from projected or actual stat lines
- **Where:** `web/lib/projections/accuracy/fantasyPoints.ts:24 (computeSkaterFantasyPoints)`; `web/lib/projections/accuracy/fantasyPoints.ts:39 (computeGoalieFantasyPoints)`; `web/lib/projections/startChartFantasyScoring.ts:114 (computeStartChartFantasyPoints)`; `web/lib/projections/starterBoardScoring.ts:63 (scoreBoardStats)`; `web/lib/projections/starterBoardScoring.ts:72 (integrateBoardParticipation)`; `web/lib/projectionsConfig/fantasyPointsConfig.ts:6`; `web/lib/forge-v2/identity.ts:28 (DEFAULT_SCORING)`; `web/lib/projections/accuracy/fantasyPoints.ts:42 computeGoalieFantasyPoints`; `web/lib/projections/accuracy/fantasyPoints.ts:28 computeSkaterFantasyPoints`; `web/lib/projections/accuracy/fantasyPoints.ts:24 toNumber`; `web/lib/projections/starterBoardScoring.ts:50 scoreBoardStats`
- **Tags (heuristic):** conditionality: conditional; denominators: per game, shots on goal; generation: current
- **Opus view (FRG-026):**
  - Method: Skater: G 3, A 2, PPP 1, SOG 0.2, HIT 0.2, BLK 0.25. Goalie: SV 0.2, GA -1, W 4, SO 3. Board: points = sum(value*weight), null if any weighted category missing; expected = conditional x participation probability. Position ranks: competition ranking per position.
  - Inputs/units: counts; sources: —
  - Output scale: fantasy points; writes: forge_projection_results.predicted_fp/actual_fp
  - Status: live
  - Consumers: accuracy; start chart; starter board; served ledger; forge-v2
- **Codex view (web-lib-projections-accuracy-fantasypoints-computegoaliefantasypoints, symbol_candidate, location; Codex family 'FORGE staged projection math'):** Compute goalie fantasy points (computeGoalieFantasyPoints)
  - Purpose: Compute goalie fantasy points for forge staged projection math. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: export function computeGoalieFantasyPoints( stats: GoalieStatLine, config: FantasyPointsConfig = DEFAULT_GOALIE_FANTASY_POINTS ): number { return ( toNumber(config.SAVES_GOALIE) * toNumber(stats.saves) + toNumber(config.GOALS_AGAINST_GOALIE) * toNumber(stats.goalsAgainst) + toNumber(config.WINS_GOALIE) * toNumber(stats.wins) + toNumber(config.SHUTOUTS_GOALIE) * toNumber(stats.shutouts) ); }
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (web-lib-projections-accuracy-fantasypoints-computeskaterfantasypoints, symbol_candidate, location; Codex family 'FORGE staged projection math'):** Compute skater fantasy points (computeSkaterFantasyPoints)
  - Purpose: Compute skater fantasy points for forge staged projection math. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: export function computeSkaterFantasyPoints( stats: SkaterStatLine, config: FantasyPointsConfig = DEFAULT_SKATER_FANTASY_POINTS ): number { return ( toNumber(config.GOALS) * toNumber(stats.goals) + toNumber(config.ASSISTS) * toNumber(stats.assists) + toNumber(config.PP_POINTS) * toNumber(stats.ppPoints) + toNumber(config.SHOTS_ON_GOAL) * toNumber(stats.shots) + toNumber(config.HITS) * toNumber(stats.hits) + toNumber(config.BLOCKED_SHOTS) * toNumber(stats.blockedShots) ); }
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (web-lib-projections-accuracy-fantasypoints-tonumber, symbol_candidate, codex_part_of_opus; Codex family 'FORGE staged projection math'):** To number (toNumber)
  - Purpose: To number for forge staged projection math. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: function toNumber(value: unknown): number { return typeof value === "number" && Number.isFinite(value) ? value : 0; }
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (web-lib-projections-starterboardscoring-scoreboardstats, calculation, location; Codex family 'FORGE staged projection math'):** Starter-board custom fantasy score (scoreBoardStats)
  - Purpose: Linear sum of nonzero category weights times compatible mean values; required missing category withholds.
  - Inputs/units: Per-game category counts/minutes and points-per-unit weights.
  - Output scale: Fantasy points or unavailable.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): web/lib/projectionsConfig/fantasyPointsConfig.ts:1-5 docstring
  - Intended contract (Codex web-lib-projections-accuracy-fantasypoints-computegoaliefantasypoints): {"source": "web/lib/projections/accuracy/fantasyPoints.ts:42", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["web/lib/projections/accuracy/fantasyPoints.ts:47 toNumber(config.SAVES_GOALIE) * toNumber(stats.saves) +", "web/lib/projections/accuracy/fantasyPoints.ts:48 toNumber(config.GOALS_AGAINST_GOALIE) * toNumber(stats.goalsAgainst) +", "web/lib/projections/accuracy/fantasyPoints.ts:49 toNumber(config.WINS_GOALIE) * toNumber(stats.wins) +", "web/lib/projections/accuracy/fantasyPoints.ts:50 toNumber(config.SHUTOUTS_GOALIE) * toNumber(stats.shutouts)"]}
  - Intended contract (Codex web-lib-projections-accuracy-fantasypoints-computeskaterfantasypoints): {"source": "web/lib/projections/accuracy/fantasyPoints.ts:28", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["web/lib/projections/accuracy/fantasyPoints.ts:33 toNumber(config.GOALS) * toNumber(stats.goals) +", "web/lib/projections/accuracy/fantasyPoints.ts:34 toNumber(config.ASSISTS) * toNumber(stats.assists) +", "web/lib/projections/accuracy/fantasyPoints.ts:35 toNumber(config.PP_POINTS) * toNumber(stats.ppPoints) +", "web/lib/projections/accuracy/fantasyPoints.ts:36 toNumber(config.SHOTS_ON_GOAL) * toNumber(stats.shots) +", "web/lib/projections/accuracy/fantasyPoints.ts:37 toNumber(config.HITS) * toNumber(stats.hits) +", "web/lib/projections/accuracy/fantasyPoints.ts:38 toNumber(config.BLOCKED_SHOTS) * toNumber(stats.blockedShots)"]}
  - Intended contract (Codex web-lib-projections-accuracy-fantasypoints-tonumber): {"source": "web/lib/projections/accuracy/fantasyPoints.ts:24", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": []}
  - Intended contract (Codex web-lib-projections-starterboardscoring-scoreboardstats): {"source": "web/lib/projections/starterBoardScoring.ts:50", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["web/lib/projections/starterBoardScoring.ts:57 else points += value * weight;"]}
  - External references: Standard points-league scoring
  - Fixtures/test data: none listed
  - Tests: `web/__tests__/pages/api/v1/db/run-projection-accuracy.test.ts`; `web/lib/projections/startChartPipeline.test.ts`; `{"status": "Discovered only; not run", "references": ["No direct symbol/module test reference found in bounded search."]}`; `{"status": "Discovered only; not run", "references": ["web/__tests__/pages/api/v1/db/run-projection-accuracy.test.ts:57"]}`; `{"status": "Discovered only; not run", "references": ["web/lib/projections/startChartPipeline.test.ts:13"]}`
- **Leads (not audited):**
  - (opus) observation: PPP counted in addition to G/A (PP points score twice) by design of league settings
  - (codex:web-lib-projections-accuracy-fantasypoints-computegoaliefantasypoints) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:web-lib-projections-accuracy-fantasypoints-computeskaterfantasypoints) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:web-lib-projections-accuracy-fantasypoints-tonumber) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:web-lib-projections-starterboardscoring-scoreboardstats) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested."]

## M-FRG-016 Projection accuracy score, MAE/RMSE aggregates and interval coverage

- **Match:** Both; Opus FRG-027; Codex web-lib-projections-accuracy-fantasypoints-computeaccuracyscore, web-lib-projections-accuracy-fantasypoints-computegoaliefantasypoints
- **Purpose:** Daily FORGE accuracy for skater and goalie fantasy points and per-stat errors
- **Where:** `web/lib/projections/accuracy/fantasyPoints.ts:50 (computeAccuracyScore)`; `web/pages/api/v1/db/run-projection-accuracy.ts:508 (computeAggregate)`; `web/pages/api/v1/db/run-projection-accuracy.ts:535 (updateStatAggregate)`; `web/pages/api/v1/db/run-projection-accuracy.ts:795 (updateCoverage)`; `web/pages/api/v1/db/run-projection-accuracy.ts:1145 (aggregateRollingWindow)`; `web/pages/api/v1/db/run-projection-accuracy.ts:1111 (finalizeMetricComparison)`; `web/pages/api/v1/db/run-projection-accuracy.ts:603 (inferRoleBuckets)`; `web/pages/api/v1/db/run-projection-accuracy.ts:1676 (runAccuracyForDate)`; `web/lib/projections/accuracy/fantasyPoints.ts:54 computeAccuracyScore`; `web/lib/projections/accuracy/fantasyPoints.ts:42 computeGoalieFantasyPoints`
- **Tags (heuristic):** percent scale: fraction 0-1; generation: current
- **Opus view (FRG-027):**
  - Method: accuracy = 1 - min(1, \|pred-act\| / max(1,\|act\|,\|pred\|)); MAE, RMSE, per-stat and per-role-bucket aggregates; rolling 7/14/30-day windows (sum abs / sum count); p10-p90 inclusive coverage hit rate; goalie baseline = projected SA x (1-0.900); actual TOI <=80 treated as minutes.
  - Inputs/units: counts; TOI seconds or minutes (heuristic); sources: forge_player_projections, forge_goalie_projections, wgo_skater_stats, wgo_goalie_stats, forge_goalie_game (fallback), games
  - Output scale: accuracy 0-1 (served x100 as %); MAE in FP; writes: forge_projection_results, forge_projection_accuracy_daily, forge_projection_accuracy_player, forge_projection_accuracy_stat_daily
  - Status: live — rolling-forge stage downstream_projection_consumers
  - Consumers: /api/v1/forge/accuracy; FORGE dashboards; promotion gates
- **Codex view (web-lib-projections-accuracy-fantasypoints-computeaccuracyscore, symbol_candidate, location; Codex family 'FORGE staged projection math'):** Compute accuracy score (computeAccuracyScore)
  - Purpose: Compute accuracy score for forge staged projection math. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: export function computeAccuracyScore( predicted: number, actual: number ): number { const denom = Math.max(1, Math.abs(actual), Math.abs(predicted)); const error = Math.abs(predicted - actual); const score = 1 - Math.min(1, error / denom); return Number.isFinite(score) ? score : 0; }
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (web-lib-projections-accuracy-fantasypoints-computegoaliefantasypoints, symbol_candidate, location; Codex family 'FORGE staged projection math'):** Compute goalie fantasy points (computeGoalieFantasyPoints)
  - Purpose: Compute goalie fantasy points for forge staged projection math. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: export function computeGoalieFantasyPoints( stats: GoalieStatLine, config: FantasyPointsConfig = DEFAULT_GOALIE_FANTASY_POINTS ): number { return ( toNumber(config.SAVES_GOALIE) * toNumber(stats.saves) + toNumber(config.GOALS_AGAINST_GOALIE) * toNumber(stats.goalsAgainst) + toNumber(config.WINS_GOALIE) * toNumber(stats.wins) + toNumber(config.SHUTOUTS_GOALIE) * toNumber(stats.shutouts) ); }
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED (route); rollingForgePipeline.ts:170-181 stage contract
  - Intended contract (Codex web-lib-projections-accuracy-fantasypoints-computeaccuracyscore): {"source": "web/lib/projections/accuracy/fantasyPoints.ts:54", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["web/lib/projections/accuracy/fantasyPoints.ts:60 const score = 1 - Math.min(1, error / denom);"]}
  - Intended contract (Codex web-lib-projections-accuracy-fantasypoints-computegoaliefantasypoints): {"source": "web/lib/projections/accuracy/fantasyPoints.ts:42", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["web/lib/projections/accuracy/fantasyPoints.ts:47 toNumber(config.SAVES_GOALIE) * toNumber(stats.saves) +", "web/lib/projections/accuracy/fantasyPoints.ts:48 toNumber(config.GOALS_AGAINST_GOALIE) * toNumber(stats.goalsAgainst) +", "web/lib/projections/accuracy/fantasyPoints.ts:49 toNumber(config.WINS_GOALIE) * toNumber(stats.wins) +", "web/lib/projections/accuracy/fantasyPoints.ts:50 toNumber(config.SHUTOUTS_GOALIE) * toNumber(stats.shutouts)"]}
  - External references: MAE/RMSE; interval coverage; CRPS would be the proper scoring rule
  - Fixtures/test data: none listed
  - Tests: `web/__tests__/pages/api/v1/db/run-projection-accuracy.test.ts`; `{"status": "Discovered only; not run", "references": ["No direct symbol/module test reference found in bounded search."]}`
- **Leads (not audited):**
  - (opus) observation: computeAccuracyScore is a bespoke bounded relative error, not a proper scoring rule
  - (opus) observation: updateStatAggregate/updateErrorStats coerce non-finite predicted/actual to 0
  - (opus) observation: p10-p90 inclusive bounds on discrete counts inflate coverage vs nominal 80%
  - (opus) observation: goalie model compared with actual of the goalie who appeared while projection is start-weighted
  - (codex:web-lib-projections-accuracy-fantasypoints-computeaccuracyscore) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:web-lib-projections-accuracy-fantasypoints-computegoaliefantasypoints) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-FRG-017 Promotion gates and holdout comparison

- **Match:** Both; Opus FRG-028; Codex promotion-shadow-improvement
- **Purpose:** Gate checks and MAE/RMSE comparison of candidate vs current baseline and naive prior
- **Where:** `web/lib/projections/promotionGates.ts:58 (evaluateProjectionPromotionGates)`; `web/lib/projections/promotionGates.ts:88 (evaluateShadowModeImprovement)`; `web/lib/projections/promotionGates.ts:200 (buildHoldoutComparisonReport)`; `web/lib/projections/promotionGates.ts:87 evaluateShadowModeImprovement`
- **Tags (heuristic):** generation: current
- **Opus view (FRG-028):**
  - Method: Gate pass/warn/fail by thresholds; improvement% = (baseMAE-candMAE)/baseMAE*100 (fail if <0); holdout MAE/RMSE per comparator, min 30 samples.
  - Inputs/units: FP errors; sources: forge_projection_results
  - Output scale: percent improvement; writes: —
  - Status: live (holdout report in accuracy route); gates library
  - Consumers: run-projection-accuracy; skater rollout governance
- **Codex view (promotion-shadow-improvement, calculation, location; Codex family 'Projection evaluation'):** Shadow MAE improvement percentage
  - Purpose: 100*(baselineMAE-candidateMAE)/baselineMAE; compare zero and configured improvement target; invalid baseline fails.
  - Inputs/units: Baseline/candidate MAE and minimum improvement %.
  - Output scale: Signed percent improvement and pass/warn/fail.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "source_state": "Assigned source paths remained clean at final git-status inspection.", "deployment": "Unknown; no live verification."}
- **Audit context:**
  - Intent (Opus): skaterRollout.ts:41-55 SKATER_ROLLOUT_GOVERNANCE
  - Intended contract (Codex promotion-shadow-improvement): {"source": "web/lib/projections/promotionGates.ts:87", "statement": "100*(baselineMAE-candidateMAE)/baselineMAE; compare zero and configured improvement target; invalid baseline fails."}
  - External references: Diebold-Mariano style paired tests would be the standard
  - Fixtures/test data: none listed
  - Tests: `web/lib/projections/promotionGates.test.ts`; `{"status": "Discovered, not run", "references": ["web/lib/projections/promotionGates.test.ts"]}`
- **Leads (not audited):**
  - (opus) observation: no significance test or paired dependence handling
  - (codex:promotion-shadow-improvement) ["No correctness/quality judgment. Active runtime and deployed version unknown."]

## M-FRG-018 Skater holdout baselines (current and naive prior)

- **Match:** Both; Opus FRG-029; Codex web-lib-projections-calculators-skater-adjustments-skaterconversionpriorsandbounds, web-lib-projections-stages-skater-stage-buildskaternaivepriorbaseline
- **Purpose:** Comparison baselines stored with each skater row for holdout scoring
- **Where:** `web/lib/projections/stages/skater-stage.ts:2823 (naivePrior inline)`; `web/lib/projections/stages/skater-stage.ts:1087 (buildSkaterNaivePriorBaseline, unused)`; `web/lib/projections/calculators/skater-adjustments.ts:777 (skaterConversionPriorsAndBounds)`; `web/lib/projections/calculators/skater-adjustments.ts:774 skaterConversionPriorsAndBounds`; `web/lib/projections/stages/skater-stage.ts:1087 buildSkaterNaivePriorBaseline`
- **Tags (heuristic):** denominators: per game; generation: current
- **Opus view (FRG-029):**
  - Method: current_baseline = scenario-free model on reconciled opportunities. naive_prior goals = shots x 0.095 (ES) / 0.145 (PP); assists = goals x 1.44 (ES) / 0.95 (PP); hits/blocks copied from model.
  - Inputs/units: counts; sources: —
  - Output scale: counts per game; writes: forge_player_projections.uncertainty.model.holdout_baselines
  - Status: live (inline); buildSkaterNaivePriorBaseline is test-only
  - Consumers: run-projection-accuracy buildHoldoutComparisonReport
- **Codex view (web-lib-projections-calculators-skater-adjustments-skaterconversionpriorsandbounds, symbol_candidate, location; Codex family 'FORGE staged projection math'):** Skater conversion priors and bounds (skaterConversionPriorsAndBounds)
  - Purpose: Skater conversion priors and bounds for forge staged projection math. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: export const skaterConversionPriorsAndBounds = (denominators: SkaterAssistDenominators) => { const ev = SKATER_ASSIST_SCALE[denominators.es].ev, pp = SKATER_ASSIST_SCALE[denominators.pp].pp; return { priors: { goalRateEs: 0.095, goalRatePp: 0.145, assistRateEs: ev.fallback, assistRatePp: pp.fallback }, bounds: { goalRateEs: [0.025, 0.3], goalRatePp: [0.04, 0.45], assistRateEs: ev.out, assistRatePp: pp.out }, } as const; }; /** * Supported split rates are already shrunk toward an adaptive prior, so they are used directly * (clamped). Only an unsupported head falls back to the fixed prior via the small-sample blend, * which reduces to the prior. `conversionShrink` keeps the pre-shrink Bayes rate and the value * the former second shrink would have produced…
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (web-lib-projections-stages-skater-stage-buildskaternaivepriorbaseline, symbol_candidate, location; Codex family 'FORGE staged projection math'):** Build skater naive prior baseline (buildSkaterNaivePriorBaseline)
  - Purpose: Holdout benchmark: fixed league conversion priors on the live per-strength assist scales.
  - Inputs/units: Parameter/type declaration excerpt: export function buildSkaterNaivePriorBaseline(args: { shotsEs: number; shotsPp: number; }) { const { priors } = skaterConversionPriorsAndBounds( SKATER_ASSIST_DENOMINATOR_DEFAULT, ); const goalsEs = args.shotsEs * priors.goalRateEs; const goalsPp = args.shotsPp * priors.goalRatePp; return { goal_rate_es: priors.goalRateEs, goal_rate_pp: priors.goalRatePp, assist_per_goal_es: priors.assistRateEs, assist_per_goal_pp: priors.assistRatePp, goals_es: goalsEs, goals_pp: goalsPp, assists_es: goalsEs * priors.assistRateEs, assists_pp: goalsPp * priors.assistRatePp,
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex web-lib-projections-calculators-skater-adjustments-skaterconversionpriorsandbounds): {"source": "web/lib/projections/calculators/skater-adjustments.ts:774", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["web/lib/projections/calculators/skater-adjustments.ts:782 /**"]}
  - Intended contract (Codex web-lib-projections-stages-skater-stage-buildskaternaivepriorbaseline): {"source": "web/lib/projections/stages/skater-stage.ts:1087", "explicit_comment": "Holdout benchmark: fixed league conversion priors on the live per-strength assist scales.", "arithmetic_locations": ["web/lib/projections/stages/skater-stage.ts:1094 const goalsEs = args.shotsEs * priors.goalRateEs;", "web/lib/projections/stages/skater-stage.ts:1095 const goalsPp = args.shotsPp * priors.goalRatePp;", "web/lib/projections/stages/skater-stage.ts:1103 assists_es: goalsEs * priors.assistRateEs,", "web/lib/projections/stages/skater-stage.ts:1104 assists_pp: goalsPp * priors.assistRatePp,"]}
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/projections/promotionGates.test.ts`; `web/lib/projections/runProjectionV2.alignedConversion.test.ts`; `{"status": "Discovered only; not run", "references": ["No direct symbol/module test reference found in bounded search."]}`; `{"status": "Discovered only; not run", "references": ["web/lib/projections/runProjectionV2.alignedConversion.test.ts:6"]}`
- **Leads (not audited):**
  - (opus) observation: inline naive constants 0.095/0.145/1.44/0.95 differ from SKATER_GOAL_CONVERSION_PRIORS and SKATER_TEAM_ASSISTS_PER_GOAL (1.65/1.91); PP 0.95 assists per PP goal is far below league ~1.9
  - (opus) observation: naive baseline shares the model's shots/hits/blocks so it only tests conversion
  - (codex:web-lib-projections-calculators-skater-adjustments-skaterconversionpriorsandbounds) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:web-lib-projections-stages-skater-stage-buildskaternaivepriorbaseline) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-FRG-019 FORGE backtest accuracy metrics: MAE/bias/RMSE, paired game-cluster bootstrap, top decile, calibration bins

- **Match:** Both; Opus FRG-032; Codex research-script-clusterBootstrap-forge-counterfactual-backtest, research-script-summarize-forge-counterfactual-backtest, research-script-topDecile-forge-counterfactual-backtest
- **Purpose:** Score FORGE variants against actuals with uncertainty
- **Where:** `web/scripts/forge-counterfactual-backtest.ts:276 (summarize)`; `web/scripts/forge-counterfactual-backtest.ts:284 (mulberry32)`; `web/scripts/forge-counterfactual-backtest.ts:295 (clusterBootstrap)`; `web/scripts/forge-counterfactual-backtest.ts:322 (topDecile)`; `web/scripts/forge-counterfactual-backtest.ts:348 (decileTable)`; `web/scripts/forge-reconstruction-backtest.ts:106 (metrics/pairs/calibration tables)`; `web/scripts/forge-counterfactual-backtest.ts:295 clusterBootstrap`; `web/scripts/forge-counterfactual-backtest.ts:276 summarize`; `web/scripts/forge-counterfactual-backtest.ts:322 topDecile`
- **Tags (heuristic):** denominators: per game; generation: research, development
- **Opus view (FRG-032):**
  - Method: error = pred - actual; MAE, bias (mean error), RMSE; paired cluster bootstrap by game_id, 2000 reps, mulberry32 seed, deltas vs baseline for MAE/bias/RMSE, 95% CI from sorted reps at floor(0.025(n-1)) / ceil(0.975(n-1)); top decile by predicted G; calibration bins report sum(actual)/sum(pred)
  - Inputs/units: per-game counts; sources: local JSON exports
  - Output scale: count-error units; writes: --output file only
  - Status: draft — offline research scripts
  - Consumers: forge-reconstruction-backtest.ts; forge-skater-candidate-ablation.ts
- **Codex view (research-script-clusterBootstrap-forge-counterfactual-backtest, symbol_candidate, location; Codex family 'Projection fitting and backtest scripts'):** clusterBootstrap
  - Purpose: Counterfactual projection arithmetic or paired diagnostic on retained inputs; no model promotion implied.
  - Inputs/units: Frozen model/projection rows, official labels, rates or exposures per declaration; evaluation units follow target.
  - Output scale: Diagnostic/model quantities returned by named function; see formula evidence.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "deployment": "Unknown; source inspection only."}
- **Codex view (research-script-summarize-forge-counterfactual-backtest, symbol_candidate, location; Codex family 'Projection fitting and backtest scripts'):** summarize
  - Purpose: Counterfactual projection arithmetic or paired diagnostic on retained inputs; no model promotion implied.
  - Inputs/units: Frozen model/projection rows, official labels, rates or exposures per declaration; evaluation units follow target.
  - Output scale: Diagnostic/model quantities returned by named function; see formula evidence.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "deployment": "Unknown; source inspection only."}
- **Codex view (research-script-topDecile-forge-counterfactual-backtest, symbol_candidate, location; Codex family 'Projection fitting and backtest scripts'):** topDecile
  - Purpose: Counterfactual projection arithmetic or paired diagnostic on retained inputs; no model promotion implied.
  - Inputs/units: Frozen model/projection rows, official labels, rates or exposures per declaration; evaluation units follow target.
  - Output scale: Diagnostic/model quantities returned by named function; see formula evidence.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "deployment": "Unknown; source inspection only."}
- **Audit context:**
  - Intent (Opus): doc comment web/scripts/forge-counterfactual-backtest.ts:294 ('Paired cluster bootstrap by game_id')
  - Intended contract (Codex research-script-clusterBootstrap-forge-counterfactual-backtest): {"source": "web/scripts/forge-counterfactual-backtest.ts:295", "arithmetic_locations": ["web/scripts/forge-counterfactual-backtest.ts:302 c.n += 1; c.dAbs += Math.abs(e1) - Math.abs(e0); c.dErr += e1 - e0; c.sse0 += e0 * e0; c.sse1 += e1 * e1;", "web/scripts/forge-counterfactual-backtest.ts:308 const dRmse = (t: Cluster) => Math.sqrt(t.sse1 / t.n) - Math.sqrt(t.sse0 / t.n);", "web/scripts/forge-counterfactual-backtest.ts:313 for (let j = 0; j < list.length; j++) t = add(t, list[Math.floor(rand() * list.length)]);", "web/scripts/forge-counterfactual-backtest.ts:314 if (t.n) { mae.push(t.dAbs / t.n); bias.push(t.dErr / t.n); rmse.push(dRmse(t)); }", "web/scripts/forge-counterfactual-backtest.ts:317 return s.length ? [s[Math.floor(0.025 * (s.length - 1))], s[Math.ceil(0.975 * (s.length - 1))]] : [NaN, NaN]; };", "web/scripts/forge-counterfactual-backtest.ts:318 return { clusters: list.length, dMae: total.n ? total.dAbs / total.n : NaN, dMaeCi: ci(mae),"]}
  - Intended contract (Codex research-script-summarize-forge-counterfactual-backtest): {"source": "web/scripts/forge-counterfactual-backtest.ts:276", "arithmetic_locations": ["web/scripts/forge-counterfactual-backtest.ts:280 return { n, mae: n ? sum(err.map(Math.abs)) / n : NaN, bias: n ? sum(err) / n : NaN, rmse: n ? Math.sqrt(sum(err.map((e) => e * e)) / n) : NaN,"]}
  - Intended contract (Codex research-script-topDecile-forge-counterfactual-backtest): {"source": "web/scripts/forge-counterfactual-backtest.ts:322", "arithmetic_locations": ["web/scripts/forge-counterfactual-backtest.ts:324 return g.slice(0, Math.ceil(g.length / 10));"]}
  - External references: cluster bootstrap CIs; forecast verification (MAE/RMSE)
  - Fixtures/test data: `web/scripts/fixtures/forge-reconstruction-backtest/ (actuals.json, hits_blocks.json, recon/a,b,a0,b0 captures)`
  - Tests: `web/scripts/forge-counterfactual-backtest.test.ts`; `web/scripts/forge-reconstruction-backtest.test.ts`; `{"status": "Discovered; not run", "references": ["web/scripts/forge-counterfactual-backtest.test.ts"]}`
- **Leads (not audited):**
  - (codex:research-script-clusterBootstrap-forge-counterfactual-backtest) ["Deployment and runtime behavior not verified; calculation listed without correctness assessment.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:research-script-summarize-forge-counterfactual-backtest) ["Deployment and runtime behavior not verified; calculation listed without correctness assessment.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:research-script-topDecile-forge-counterfactual-backtest) ["Deployment and runtime behavior not verified; calculation listed without correctness assessment.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-FRG-020 FORGE goalie backtest scoring: Brier, log loss, reliability bins, paired win sums, clustered bootstrap

- **Match:** Both; Opus FRG-033; Codex research-script-biasRmse-forge-goalie-backtest, research-script-brierScore-forge-goalie-backtest, research-script-clusteredBootstrapDiff-forge-goalie-backtest, research-script-logLoss-forge-goalie-backtest, research-script-pairedWinSums-forge-goalie-backtest, research-script-reliabilityBins-forge-goalie-backtest
- **Purpose:** Probability scoring helpers for goalie W/shutout/team-win
- **Where:** `web/scripts/forge-goalie-backtest.ts:145 (biasRmse)`; `web/scripts/forge-goalie-backtest.ts:157 (brierScore)`; `web/scripts/forge-goalie-backtest.ts:163 (logLoss)`; `web/scripts/forge-goalie-backtest.ts:173 (reliabilityBins)`; `web/scripts/forge-goalie-backtest.ts:189 (pairedWinSums)`; `web/scripts/forge-goalie-backtest.ts:213 (clusteredBootstrapDiff)`; `web/scripts/forge-goalie-backtest.ts:145 biasRmse`; `web/scripts/forge-goalie-backtest.ts:157 brierScore`; `web/scripts/forge-goalie-backtest.ts:213 clusteredBootstrapDiff`; `web/scripts/forge-goalie-backtest.ts:163 logLoss`; `web/scripts/forge-goalie-backtest.ts:189 pairedWinSums`; `web/scripts/forge-goalie-backtest.ts:173 reliabilityBins`
- **Tags (heuristic):** percent scale: fraction 0-1; generation: research, development
- **Opus view (FRG-033):**
  - Method: Brier mean (p-y)^2; log loss with clip 1e-9; 5 equal-count reliability bins by sorted probability; paired home+away team-win sums (should be ~1); clustered bootstrap 2000 reps seed 7 by gameKey, CI from means at floor(0.025*reps)/floor(0.975*reps)
  - Inputs/units: probabilities 0-1; sources: —
  - Output scale: Brier 0-1, log loss nats; writes: —
  - Status: draft — offline
  - Consumers: forge-goalie-backtest main
- **Codex view (research-script-biasRmse-forge-goalie-backtest, symbol_candidate, codex_part_of_opus; Codex family 'Projection fitting and backtest scripts'):** biasRmse
  - Purpose: Goalie backtest calculation; same-name declaration implements the local diagnostic, preserving separate legacy/new and team/credited-win populations.
  - Inputs/units: Frozen model/projection rows, official labels, rates or exposures per declaration; evaluation units follow target.
  - Output scale: Diagnostic/model quantities returned by named function; see formula evidence.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "deployment": "Unknown; source inspection only."}
- **Codex view (research-script-brierScore-forge-goalie-backtest, symbol_candidate, codex_part_of_opus; Codex family 'Projection fitting and backtest scripts'):** brierScore
  - Purpose: Goalie backtest calculation; same-name declaration implements the local diagnostic, preserving separate legacy/new and team/credited-win populations.
  - Inputs/units: Frozen model/projection rows, official labels, rates or exposures per declaration; evaluation units follow target.
  - Output scale: Diagnostic/model quantities returned by named function; see formula evidence.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "deployment": "Unknown; source inspection only."}
- **Codex view (research-script-clusteredBootstrapDiff-forge-goalie-backtest, symbol_candidate, codex_part_of_opus; Codex family 'Projection fitting and backtest scripts'):** clusteredBootstrapDiff
  - Purpose: Goalie backtest calculation; same-name declaration implements the local diagnostic, preserving separate legacy/new and team/credited-win populations.
  - Inputs/units: Frozen model/projection rows, official labels, rates or exposures per declaration; evaluation units follow target.
  - Output scale: Diagnostic/model quantities returned by named function; see formula evidence.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "deployment": "Unknown; source inspection only."}
- **Codex view (research-script-logLoss-forge-goalie-backtest, symbol_candidate, codex_part_of_opus; Codex family 'Projection fitting and backtest scripts'):** logLoss
  - Purpose: Goalie backtest calculation; same-name declaration implements the local diagnostic, preserving separate legacy/new and team/credited-win populations.
  - Inputs/units: Frozen model/projection rows, official labels, rates or exposures per declaration; evaluation units follow target.
  - Output scale: Diagnostic/model quantities returned by named function; see formula evidence.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "deployment": "Unknown; source inspection only."}
- **Codex view (research-script-pairedWinSums-forge-goalie-backtest, symbol_candidate, location; Codex family 'Projection fitting and backtest scripts'):** pairedWinSums
  - Purpose: Goalie backtest calculation; same-name declaration implements the local diagnostic, preserving separate legacy/new and team/credited-win populations.
  - Inputs/units: Frozen model/projection rows, official labels, rates or exposures per declaration; evaluation units follow target.
  - Output scale: Diagnostic/model quantities returned by named function; see formula evidence.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "deployment": "Unknown; source inspection only."}
- **Codex view (research-script-reliabilityBins-forge-goalie-backtest, symbol_candidate, codex_part_of_opus; Codex family 'Projection fitting and backtest scripts'):** reliabilityBins
  - Purpose: Goalie backtest calculation; same-name declaration implements the local diagnostic, preserving separate legacy/new and team/credited-win populations.
  - Inputs/units: Frozen model/projection rows, official labels, rates or exposures per declaration; evaluation units follow target.
  - Output scale: Diagnostic/model quantities returned by named function; see formula evidence.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "deployment": "Unknown; source inspection only."}
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex research-script-biasRmse-forge-goalie-backtest): {"source": "web/scripts/forge-goalie-backtest.ts:145", "arithmetic_locations": ["web/scripts/forge-goalie-backtest.ts:152 sumSq += e * e;", "web/scripts/forge-goalie-backtest.ts:154 return { n, bias: n ? sum / n : NaN, rmse: n ? Math.sqrt(sumSq / n) : NaN };"]}
  - Intended contract (Codex research-script-brierScore-forge-goalie-backtest): {"source": "web/scripts/forge-goalie-backtest.ts:157", "arithmetic_locations": ["web/scripts/forge-goalie-backtest.ts:159 for (let i = 0; i < probabilities.length; i += 1) sum += (probabilities[i] - outcomes[i]) ** 2;", "web/scripts/forge-goalie-backtest.ts:160 return probabilities.length ? sum / probabilities.length : NaN;"]}
  - Intended contract (Codex research-script-clusteredBootstrapDiff-forge-goalie-backtest): {"source": "web/scripts/forge-goalie-backtest.ts:213", "arithmetic_locations": ["web/scripts/forge-goalie-backtest.ts:223 const c = clusters[Math.floor(rand() * clusters.length)];", "web/scripts/forge-goalie-backtest.ts:226 means.push(sum / n);", "web/scripts/forge-goalie-backtest.ts:229 const point = rows.reduce((s, row) => s + rowDiff(row), 0) / rows.length;", "web/scripts/forge-goalie-backtest.ts:230 return { point, lo: means[Math.floor(0.025 * reps)], hi: means[Math.floor(0.975 * reps)] };"]}
  - Intended contract (Codex research-script-logLoss-forge-goalie-backtest): {"source": "web/scripts/forge-goalie-backtest.ts:163", "arithmetic_locations": ["web/scripts/forge-goalie-backtest.ts:167 sum -= outcomes[i] ? Math.log(p) : Math.log(1 - p);", "web/scripts/forge-goalie-backtest.ts:169 return probabilities.length ? sum / probabilities.length : NaN;", "web/scripts/forge-goalie-backtest.ts:172 /** Equal-count bins ordered by predicted probability: mean prediction vs observed rate. */"]}
  - Intended contract (Codex research-script-pairedWinSums-forge-goalie-backtest): {"source": "web/scripts/forge-goalie-backtest.ts:189", "arithmetic_locations": ["web/scripts/forge-goalie-backtest.ts:195 mean: sums.reduce((s, v) => s + v, 0) / (sums.length \|\| 1),"]}
  - Intended contract (Codex research-script-reliabilityBins-forge-goalie-backtest): {"source": "web/scripts/forge-goalie-backtest.ts:173", "arithmetic_locations": ["web/scripts/forge-goalie-backtest.ts:177 const slice = order.slice(Math.floor((b * order.length) / bins), Math.floor(((b + 1) * order.length) / bins));", "web/scripts/forge-goalie-backtest.ts:181 meanPredicted: slice.reduce((s, [p]) => s + p, 0) / slice.length,", "web/scripts/forge-goalie-backtest.ts:182 observed: slice.reduce((s, [, y]) => s + y, 0) / slice.length,", "web/scripts/forge-goalie-backtest.ts:188 /** Per game with both starters: the sum of the two teams' win probabilities. */"]}
  - External references: proper scoring rules
  - Fixtures/test data: none listed
  - Tests: `web/scripts/forge-goalie-backtest.test.ts`; `{"status": "Discovered; not run", "references": ["web/scripts/forge-goalie-backtest.test.ts"]}`
- **Leads (not audited):**
  - (opus) CI indices here use reps (not reps-1) unlike forge-counterfactual-backtest; minor inconsistency
  - (codex:research-script-biasRmse-forge-goalie-backtest) ["Deployment and runtime behavior not verified; calculation listed without correctness assessment.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:research-script-brierScore-forge-goalie-backtest) ["Deployment and runtime behavior not verified; calculation listed without correctness assessment.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:research-script-clusteredBootstrapDiff-forge-goalie-backtest) ["Deployment and runtime behavior not verified; calculation listed without correctness assessment.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:research-script-logLoss-forge-goalie-backtest) ["Deployment and runtime behavior not verified; calculation listed without correctness assessment.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:research-script-pairedWinSums-forge-goalie-backtest) ["Deployment and runtime behavior not verified; calculation listed without correctness assessment.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:research-script-reliabilityBins-forge-goalie-backtest) ["Deployment and runtime behavior not verified; calculation listed without correctness assessment.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-FRG-021 FORGE skater candidate ablation (fantasy-point head, Mincer-Zarnowitz)

- **Match:** Both; Opus FRG-035; Codex research-script-deciles-forge-skater-candidate-ablation, research-script-fp-forge-skater-candidate-ablation, research-script-metrics-forge-skater-candidate-ablation, research-script-scoreCandidateCohort-forge-skater-candidate-ablation
- **Purpose:** Compare candidate skater variants including a fantasy-point composite head
- **Where:** `web/scripts/forge-skater-candidate-ablation.ts:21 (fp)`; `web/scripts/forge-skater-candidate-ablation.ts:32 (pairCandidateCohort)`; `web/scripts/forge-skater-candidate-ablation.ts:64 (metrics)`; `web/scripts/forge-skater-candidate-ablation.ts:79 (deciles)`; `web/scripts/forge-skater-candidate-ablation.ts:79 deciles`; `web/scripts/forge-skater-candidate-ablation.ts:21 fp`; `web/scripts/forge-skater-candidate-ablation.ts:64 metrics`; `web/scripts/forge-skater-candidate-ablation.ts:85 scoreCandidateCohort`
- **Tags (heuristic):** denominators: per game; generation: research, development
- **Opus view (FRG-035):**
  - Method: FP = sum(head value * fpWeight) (null if any weighted head missing); rows with dressed!==true excluded; bias, RMSE, sum actual / sum predicted, Mincer-Zarnowitz OLS slope = cov(pred,actual)/var(pred) and intercept; deciles by baseline forecast; cluster bootstrap reused
  - Inputs/units: per-game counts; FP weights per stat; sources: local cohort JSON (synthetic \| historical_reconstruction \| frozen_holdout)
  - Output scale: counts and fantasy points per game; writes: --output file only
  - Status: draft — offline
  - Consumers: FORGE model selection
- **Codex view (research-script-deciles-forge-skater-candidate-ablation, symbol_candidate, codex_part_of_opus; Codex family 'Projection fitting and backtest scripts'):** deciles
  - Purpose: Matched-cohort candidate fantasy/stat loss or rank diagnostic on fixed candidate outputs.
  - Inputs/units: Frozen model/projection rows, official labels, rates or exposures per declaration; evaluation units follow target.
  - Output scale: Diagnostic/model quantities returned by named function; see formula evidence.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "deployment": "Unknown; source inspection only."}
- **Codex view (research-script-fp-forge-skater-candidate-ablation, symbol_candidate, codex_part_of_opus; Codex family 'Projection fitting and backtest scripts'):** fp
  - Purpose: Matched-cohort candidate fantasy/stat loss or rank diagnostic on fixed candidate outputs.
  - Inputs/units: Frozen model/projection rows, official labels, rates or exposures per declaration; evaluation units follow target.
  - Output scale: Diagnostic/model quantities returned by named function; see formula evidence.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "deployment": "Unknown; source inspection only."}
- **Codex view (research-script-metrics-forge-skater-candidate-ablation, symbol_candidate, codex_part_of_opus; Codex family 'Projection fitting and backtest scripts'):** metrics
  - Purpose: Matched-cohort candidate fantasy/stat loss or rank diagnostic on fixed candidate outputs.
  - Inputs/units: Frozen model/projection rows, official labels, rates or exposures per declaration; evaluation units follow target.
  - Output scale: Diagnostic/model quantities returned by named function; see formula evidence.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "deployment": "Unknown; source inspection only."}
- **Codex view (research-script-scoreCandidateCohort-forge-skater-candidate-ablation, symbol_candidate, codex_part_of_opus; Codex family 'Projection fitting and backtest scripts'):** scoreCandidateCohort
  - Purpose: Matched-cohort candidate fantasy/stat loss or rank diagnostic on fixed candidate outputs.
  - Inputs/units: Frozen model/projection rows, official labels, rates or exposures per declaration; evaluation units follow target.
  - Output scale: Diagnostic/model quantities returned by named function; see formula evidence.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "deployment": "Unknown; source inspection only."}
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED (type comments only)
  - Intended contract (Codex research-script-deciles-forge-skater-candidate-ablation): {"source": "web/scripts/forge-skater-candidate-ablation.ts:79", "arithmetic_locations": ["web/scripts/forge-skater-candidate-ablation.ts:82 return Array.from({ length: 10 }, (_, bin) => sorted.filter((_, i) => Math.ceil((i + 1) * 10 / sorted.length) === bin + 1));"]}
  - Intended contract (Codex research-script-fp-forge-skater-candidate-ablation): {"source": "web/scripts/forge-skater-candidate-ablation.ts:21", "arithmetic_locations": ["web/scripts/forge-skater-candidate-ablation.ts:26 result += line[head]! * weight;", "web/scripts/forge-skater-candidate-ablation.ts:31 /** Paired support per head across ALL variants, with explicit missingness counts. */"]}
  - Intended contract (Codex research-script-metrics-forge-skater-candidate-ablation): {"source": "web/scripts/forge-skater-candidate-ablation.ts:64", "arithmetic_locations": ["web/scripts/forge-skater-candidate-ablation.ts:67 const xMean = summary.n ? summary.sumPred / summary.n : 0;", "web/scripts/forge-skater-candidate-ablation.ts:68 const yMean = summary.n ? summary.sumActual / summary.n : 0;", "web/scripts/forge-skater-candidate-ablation.ts:69 const variance = use.reduce((sum, row) => sum + (row.preds[variant][head] - xMean) ** 2, 0);", "web/scripts/forge-skater-candidate-ablation.ts:70 const covariance = use.reduce((sum, row) => sum + (row.preds[variant][head] - xMean) * (row.actual[head] - yMean), 0);", "web/scripts/forge-skater-candidate-ablation.ts:71 const slope = use.length >= 2 && variance > 0 ? covariance / variance : null;", "web/scripts/forge-skater-candidate-ablation.ts:74 actualOverPredicted: summary.sumPred > 0 ? summary.sumActual / summary.sumPred : null,"]}
  - Intended contract (Codex research-script-scoreCandidateCohort-forge-skater-candidate-ablation): {"source": "web/scripts/forge-skater-candidate-ablation.ts:85", "arithmetic_locations": ["web/scripts/forge-skater-candidate-ablation.ts:115 /** Adapter for the exact recorded dressed-only audit extract; never fit on these actuals. */"]}
  - External references: Mincer-Zarnowitz forecast efficiency regression
  - Fixtures/test data: none listed
  - Tests: `web/scripts/forge-skater-candidate-ablation.test.ts`; `{"status": "Discovered; not run", "references": ["web/scripts/forge-skater-candidate-ablation.test.ts"]}`
- **Leads (not audited):**
  - (opus) fpWeights supplied per cohort file, not tied to a league scoring config
  - (codex:research-script-deciles-forge-skater-candidate-ablation) ["Deployment and runtime behavior not verified; calculation listed without correctness assessment.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:research-script-fp-forge-skater-candidate-ablation) ["Deployment and runtime behavior not verified; calculation listed without correctness assessment.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:research-script-metrics-forge-skater-candidate-ablation) ["Deployment and runtime behavior not verified; calculation listed without correctness assessment.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:research-script-scoreCandidateCohort-forge-skater-candidate-ablation) ["Deployment and runtime behavior not verified; calculation listed without correctness assessment.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-FRG-022 FORGE v2 refresh cadence and material-event coalescing

- **Match:** Both; Opus FRG-039; Codex web-lib-forge-v2-schedule-observehorizonepisodes
- **Purpose:** Plan when FORGE v2 player-game forecasts are reissued (daily, pregame, material events), capped at game lock, and track horizon episodes.
- **Where:** `web/lib/forge-v2/refresh.ts:126 (easternDailyDeadline)`; `web/lib/forge-v2/refresh.ts:137 (planScheduledRefresh)`; `web/lib/forge-v2/refresh.ts:251 (enqueueMaterialEvent)`; `web/lib/forge-v2/refresh.ts:298 (claimRefreshBatch)`; `web/lib/forge-v2/schedule.ts:94 (observeHorizonEpisodes)`; `web/lib/forge-v2/schedule.ts:120 (advanceLock)`; `web/lib/forge-v2/schedule.ts:94 observeHorizonEpisodes`
- **Tags (heuristic):** generation: development, current
- **Opus view (FRG-039):**
  - Method: lock = min(scheduled start, accepted lock). Daily job: deadline = min(08:00 America/New_York, found DST-safely as 12:00 or 13:00 UTC, lock), ready = min(now, deadline). Pregame: ready = deadline = min(start − 30 min, lock). Material event: ready = min(received + 5 min, deadline, lock − 1 ms), deadline = min(received + 15 min, lock). Pending unissued material jobs for the same target are coalesced, taking the minimum of lock/deadline/ready (≤1000 events). Scopes are capped at 100,000. Claim slots = min(batchSize, concurrency − running). A horizon episode number increments when a player-game re-enters the same horizon; episodes close when the horizon changes.
  - Inputs/units: ISO instants; minutes; sources: FORGE v2 refresh queue state and schedule observations (isolated persistence)
  - Output scale: timestamps; writes: FORGE v2 refresh queue state, horizon episode / lock ledger
  - Status: draft — FORGE v2 local implementation; hosted operation gated (PRD 13.2/14.x)
  - Consumers: FORGE v2 pipeline runPreparedQueueBatch; operations summary (due/on-time/late)
- **Codex view (web-lib-forge-v2-schedule-observehorizonepisodes, symbol_candidate, location; Codex family 'FORGE v2 development kernel and ledger'):** Observe horizon episodes (observeHorizonEpisodes)
  - Purpose: Returns a new ledger; closing an episode never changes its entry or prior ordinal.
  - Inputs/units: Parameter/type declaration excerpt: export function observeHorizonEpisodes(history: readonly HorizonEpisode[], current: readonly Opportunity[], observedAt: Instant): HorizonEpisode[] { const at = instant(observedAt); const ledger = structuredClone([...history]); if (ledger.some(row => instant(row.enteredAt) > at \|\| (row.exitedAt !== null && instant(row.exitedAt) > at))) throw new Error("Observation must be chronological"); const scopes = new Map(current.map(row => [targetKey(row), row])); if (scopes.size !== current.length \|\| current.some(row => row.observedAt !== observedAt)) throw new Error("Invalid contemporaneous opportunities"); const activeKeys = new Set<string>(); for (const row of ledger.filter(episode => episode.exitedAt === null)) { const key = targetKey(row); if (activeKeys…
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): tasks/tasks-prd-forge-v2-skater-game-forecasts.md 5.1 (daily by 8 a.m. America/New_York, T−30 attempt), 5.2 (coalesce at most five minutes), 5.4 (15-minute target from evidence receipt)
  - Intended contract (Codex web-lib-forge-v2-schedule-observehorizonepisodes): {"source": "web/lib/forge-v2/schedule.ts:94", "explicit_comment": "Returns a new ledger; closing an episode never changes its entry or prior ordinal.", "arithmetic_locations": ["web/lib/forge-v2/schedule.ts:119 /** Call with the authoritative accepted schedule observation, not wall-clock guesses. */"]}
  - External references: none suggested
  - Fixtures/test data: `web/lib/forge-v2/fixtureHarness.server.ts`
  - Tests: `web/lib/forge-v2/history.test.ts`; `web/lib/forge-v2/lifecycle.test.ts`; `web/lib/forge-v2/refresh.test.ts`; `web/lib/forge-v2/schedule.test.ts`; `{"status": "Discovered only; not run", "references": ["web/lib/forge-v2/lifecycle.test.ts:12", "web/lib/forge-v2/pipeline.test.ts:17", "web/lib/forge-v2/refresh.test.ts:7", "web/lib/forge-v2/schedule.test.ts:3"]}`
- **Leads (not audited):**
  - (opus) when start − 30 min has already passed, the pregame ready/deadline time is in the past, which relies on downstream lateness handling
  - (codex:web-lib-forge-v2-schedule-observehorizonepisodes) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-FRG-023 Goalie starter probability (FORGE logit/softmax)

- **Match:** Both; Opus FRG-041; Codex web-lib-projections-calculators-goalie-starter-computestarterprobabilities
- **Purpose:** Probability each candidate goalie starts
- **Where:** `web/lib/projections/calculators/goalie-starter.ts:126 (computeStarterProbabilities)`; `web/lib/projections/calculators/goalie-starter.ts:76 (selectStarterCandidateGoalieIds)`; `web/lib/projections/queries/goalie-queries.ts:86 (fetchTeamGoalieStarterContext)`; `web/lib/projections/queries/goalie-queries.ts:21 (fetchTeamLineComboGoaliePrior)`; `web/lib/projections/constants/projection-weights.ts:11-25`; `web/lib/projections/calculators/goalie-starter.ts:126 computeStarterProbabilities`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: per 60; generation: current
- **Opus view (FRG-041):**
  - Method: Starter per team date = goalie row with max toi_seconds; L10 share = starts/10. score = 2.4(l10-0.5) + 0.7 logit(prior) + 0.45 logit(lineComboPrior; decay 0.82^i over 12 combos) + 0.5*clamp(GSAA60,±0.6) + 0.28(seasonPct-0.5)*gw + 0.2*gw (gw=GP/(GP+10)); -2.75 if played yesterday on B2B, +0.65 other goalie on B2B; weaker-team B2B -1.1 primary/+0.45 backup (gap 0.35 goals); weak opponent (<=2.6 GF) -0.7 primary/+0.3 backup; staleness -6 (>75 d), -3 (>30 d), -0.8 (>14 d), +0.2 (<=7 d). 2 candidates: sigmoid(diff) clamp 0.02-0.98; >2: softmax then each clamp 0.01-0.98; 1 candidate = 1. Candidate ranking score: override 100, confirmed 25, prior*10, starts*1.5, -min(days,120)/30, limit 3.
  - Inputs/units: counts; probabilities; GSAA per 60; sources: forge_goalie_game, games, goalie_start_projections, lineCombinations, players
  - Output scale: probability 0-1; writes: forge_goalie_projections.starter_probability
  - Status: live
  - Consumers: goalie projections; win populations; accuracy starter Brier
- **Codex view (web-lib-projections-calculators-goalie-starter-computestarterprobabilities, calculation, location; Codex family 'FORGE staged projection math'):** Heuristic goalie-start probability distribution (computeStarterProbabilities)
  - Purpose: Score combines recent start share, prior/lineup logits, GSAA, season usage, rest, opponent/team context and staleness. Two candidates use bounded sigmoid score difference; >2 use shifted softmax then individual bounds.
  - Inputs/units: Candidate identities; counts/start shares; GSAA/60; dates/rest; team goal means.
  - Output scale: Per-candidate P(start); single candidate=1; two sum exactly1; >2 post-clamp mass not separately inferred here.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex web-lib-projections-calculators-goalie-starter-computestarterprobabilities): {"source": "web/lib/projections/calculators/goalie-starter.ts:126", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["web/lib/projections/calculators/goalie-starter.ts:168 const l10Share = l10Starts / totalGames;", "web/lib/projections/calculators/goalie-starter.ts:182 const seasonGamesWeight = clamp(seasonGamesPlayed / (seasonGamesPlayed + 10), 0, 1);", "web/lib/projections/calculators/goalie-starter.ts:190 score += 2.4 * (l10Share - 0.5);", "web/lib/projections/calculators/goalie-starter.ts:191 score += 0.7 * Math.log(priorProb / (1 - priorProb));", "web/lib/projections/calculators/goalie-starter.ts:192 score += LINE_COMBO_PRIOR_LOGIT_WEIGHT * Math.log(lineComboPrior / (1 - lineComboPrior));", "web/lib/projections/calculators/goalie-starter.ts:193 score += GOALIE_GSAA_PRIOR_WEIGHT * projectedGsaaPer60;", "web/lib/projections/calculators/goalie-starter.ts:198 score += GOALIE_SEASON_GAMES_PLAYED_WEIGHT * seasonGamesWeight;", "web/lib/projections/calculators/goalie-starter.ts:237 const exps = scores.map((s) => Math.exp(s.score - maxScore));"]}
  - External references: Logistic starter models; Brier
  - Fixtures/test data: none listed
  - Tests: `web/lib/projections/goaliePipeline.test.ts`; `web/lib/projections/runProjectionV2.test.ts`; `{"status": "Discovered only; not run", "references": ["web/lib/projections/module-imports.test.ts:11", "web/lib/projections/runProjectionV2.test.ts:44"]}`
- **Leads (not audited):**
  - (opus) observation: forge_goalie_game.toi_seconds is always null (buildGoalieGameV2.ts:138), so the 'starter' per date is whichever goalie row comes first — relief appearances can be counted as starts
  - (opus) observation: prior start probability from goalie_start_projections is itself the L10 start share, so L10 usage enters twice
  - (opus) observation: softmax then per-candidate clamp means probabilities need not sum to 1
  - (opus) observation: all weights hand-set
  - (codex:web-lib-projections-calculators-goalie-starter-computestarterprobabilities) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested."]

## M-FRG-024 Goalie starter-scenario blend and horizon scaling

- **Match:** Both; Opus FRG-042; Codex web-lib-projections-calculators-goalie-starter-blendtopstarterscenariooutputs, web-lib-projections-calculators-goalie-starter-buildtopstarterscenarios
- **Purpose:** Start-probability-weighted goalie stat line for the team's goalie slot
- **Where:** `web/lib/projections/calculators/goalie-starter.ts:27 (blendTopStarterScenarioOutputs)`; `web/lib/projections/calculators/goalie-starter.ts:245 (buildTopStarterScenarios)`; `web/lib/projections/stages/goalie-stage.ts:808-826 (goalieUpsert)`; `web/lib/projections/calculators/goalie-starter.ts:27 blendTopStarterScenarioOutputs`; `web/lib/projections/calculators/goalie-starter.ts:245 buildTopStarterScenarios`
- **Tags (heuristic):** percent scale: fraction 0-1; conditionality: conditional; denominators: per game; generation: current
- **Opus view (FRG-042):**
  - Method: blended = sum(p_raw*scenario) + residualMass*fallback (residual = 1 - clamp(sum p)). Stored proj_* = blended x goalie horizon scalar sum, including proj_win_prob and proj_shutout_prob.
  - Inputs/units: counts; probabilities; sources: —
  - Output scale: counts per game x horizon; writes: forge_goalie_projections
  - Status: live
  - Consumers: goalie accuracy; market saves comparison; start chart
- **Codex view (web-lib-projections-calculators-goalie-starter-blendtopstarterscenariooutputs, calculation, location; Codex family 'FORGE staged projection math'):** Starter-scenario mean mixture (blendTopStarterScenarioOutputs)
  - Purpose: Probability-weight scenario stat lines; add residual probability mass times fallback stat line. Preserve unavailable win means.
  - Inputs/units: Scenario probability, SA/SV/GA counts, save fractions and W/SO probabilities.
  - Output scale: Blended conditional stats/probabilities plus modeled/residual probability mass.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (web-lib-projections-calculators-goalie-starter-buildtopstarterscenarios, symbol_candidate, location; Codex family 'FORGE staged projection math'):** Build top starter scenarios (buildTopStarterScenarios)
  - Purpose: Build top starter scenarios for forge staged projection math. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: export function buildTopStarterScenarios(opts: { probabilitiesByGoalieId: Map<number, number>; maxScenarios?: number; }): StarterScenario[] { const maxScenarios = Number.isFinite(opts.maxScenarios) ? Math.max(1, Number(opts.maxScenarios)) : 2; const ranked = Array.from(opts.probabilitiesByGoalieId.entries()) .filter(([goalieId, probability]) => Number.isFinite(goalieId) && Number.isFinite(probability)) .sort((a, b) => b[1] - a[1]) .slice(0, maxScenarios); if (ranked.length === 0) return []; const rawMass = ranked.reduce((sum, [, probability]) => sum + Math.max(0, probability), 0); const denom = rawMass > 0 ? rawMass : ranked.length; return ranked.map(([goalieId, rawProbability], idx) => ({ goalieId, rawProbability,
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): stages/goalie-stage.ts:771-772 comment
  - Intended contract (Codex web-lib-projections-calculators-goalie-starter-blendtopstarterscenariooutputs): {"source": "web/lib/projections/calculators/goalie-starter.ts:27", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["web/lib/projections/calculators/goalie-starter.ts:47 weighted.proj_shots_against += w * s.proj_shots_against;", "web/lib/projections/calculators/goalie-starter.ts:48 weighted.proj_saves += w * s.proj_saves;", "web/lib/projections/calculators/goalie-starter.ts:49 weighted.proj_goals_allowed += w * s.proj_goals_allowed;", "web/lib/projections/calculators/goalie-starter.ts:51 else if (s.proj_win_prob !== null) weighted.proj_win_prob += w * s.proj_win_prob;", "web/lib/projections/calculators/goalie-starter.ts:52 weighted.proj_shutout_prob += w * s.proj_shutout_prob;", "web/lib/projections/calculators/goalie-starter.ts:53 weighted.modeled_save_pct += w * s.modeled_save_pct;", "web/lib/projections/calculators/goalie-starter.ts:63 weighted.proj_shots_against + residualMass * fallback.proj_shots_against,", "web/lib/projections/calculators/goalie-starter.ts:64 proj_saves: weighted.proj_saves + residualMass * fallback.proj_saves,"]}
  - Intended contract (Codex web-lib-projections-calculators-goalie-starter-buildtopstarterscenarios): {"source": "web/lib/projections/calculators/goalie-starter.ts:245", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["web/lib/projections/calculators/goalie-starter.ts:263 probability: clamp(Math.max(0, rawProbability) / denom, 0, 1),"]}
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/projections/runProjectionV2.test.ts`; `{"status": "Discovered only; not run", "references": ["web/lib/projections/runProjectionV2.alignedConversion.test.ts:5", "web/lib/projections/runProjectionV2.test.ts:11"]}`; `{"status": "Discovered only; not run", "references": ["web/lib/projections/runProjectionV2.test.ts:12"]}`
- **Leads (not audited):**
  - (opus) observation: proj_saves is start-weighted (expected slot value) but accuracy compares it to the actual line of the goalie who appeared, and the market comparison uses it against single-goalie saves lines
  - (opus) observation: residual mass is assigned to the selected goalie's full-start line
  - (codex:web-lib-projections-calculators-goalie-starter-blendtopstarterscenariooutputs) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested."]
  - (codex:web-lib-projections-calculators-goalie-starter-buildtopstarterscenarios) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-FRG-025 Team context adjustments for goalie (team strength, 5v5, NST danger)

- **Match:** Both; Opus FRG-043; Codex web-lib-projections-calculators-team-context-adjustments-computenstopponentdangeradjustment, web-lib-projections-calculators-team-context-adjustments-computeteamfiveonfivecontextadjustment, web-lib-projections-calculators-team-context-adjustments-computeteamstrengthcontextadjustment
- **Purpose:** Percent adjustments to shots against, team goals for and save% from team xG, 5v5 sv%/PDO and NST xGA/60
- **Where:** `web/lib/projections/calculators/team-context-adjustments.ts:30 (computeTeamStrengthContextAdjustment)`; `web/lib/projections/calculators/team-context-adjustments.ts:103 (computeTeamFiveOnFiveContextAdjustment)`; `web/lib/projections/calculators/team-context-adjustments.ts:170 (computeNstOpponentDangerAdjustment)`; `web/lib/projections/queries/team-context-queries.ts:228 (buildTeamStrengthPriorFromNhlTeamDataRows)`; `web/lib/projections/queries/team-context-queries.ts:198 (buildTeamStrengthPriorFromInHouseXgAggregateRow)`; `web/lib/projections/calculators/team-context-adjustments.ts:170 computeNstOpponentDangerAdjustment`; `web/lib/projections/calculators/team-context-adjustments.ts:103 computeTeamFiveOnFiveContextAdjustment`; `web/lib/projections/calculators/team-context-adjustments.ts:30 computeTeamStrengthContextAdjustment`
- **Tags (heuristic):** denominators: per 60, per game, 5v5 only; generation: current
- **Opus view (FRG-043):**
  - Method: Strength: w = min(1,(xgaDef+xgaOpp)/280); edges clamp ±0.2 vs 2.95 xG/g; SA pct = clamp((0.32*defLiab+0.36*oppOff)*w,±0.09); teamGF pct = clamp((0.3*teamOff+0.24*oppDefLiab)*w,±0.1); oppGF pct = clamp((0.28*oppOff+0.22*defLiab)*w,±0.1). 5v5: w = G/(G+8); saveEdge=clamp(sv-0.922,±0.03); pdo edges clamp ±0.08; leagueSvAdj = clamp((0.75*saveEdge+0.2*defPdo)*w,±0.01); contextPct = clamp((-0.45*saveEdge+0.2*oppPdo)*w,±0.035). NST: w = G/(G+30); dangerEdge clamp((defXGA60-2.5)/2.5,±0.25), pace clamp ±0.2 on opp xGA60; contextPct = clamp((0.32*danger+0.12*pace)*w,±0.05). In-house prior: xga/games_count over 10-game window; nhl_team_data row chosen where xga/xga_per_game matches standings GP within 1.5.
  - Inputs/units: xG per game; per-60; sv fraction or percent; sources: nhl_xg_team_rolling_aggregates, nhl_team_data, wgo_team_stats, nst_team_all, nst_team_stats
  - Output scale: percent adjustments ±0.01..±0.1; writes: —
  - Status: live
  - Consumers: goalie shots against; starter logic; save% shift; RSO forgeDailyBridge
- **Codex view (web-lib-projections-calculators-team-context-adjustments-computenstopponentdangeradjustment, symbol_candidate, location; Codex family 'FORGE staged projection math'):** Compute nst opponent danger adjustment (computeNstOpponentDangerAdjustment)
  - Purpose: Compute nst opponent danger adjustment for forge staged projection math. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: export function computeNstOpponentDangerAdjustment(args: { defendingTeamProfile: TeamNstExpectedGoalsProfile \| null; opponentTeamProfile: TeamNstExpectedGoalsProfile \| null; }): { sampleWeight: number; contextPctAdjustment: number } { const defending = args.defendingTeamProfile; const opponent = args.opponentTeamProfile; if (!defending && !opponent) { return { sampleWeight: 0, contextPctAdjustment: 0 }; } const defendingXgaPer60 = defending?.xgaPer60 ?? TEAM_NST_XGA_PER60_BASELINE; const opponentXgaPer60 = opponent?.xgaPer60 ?? TEAM_NST_XGA_PER60_BASELINE; const defendingGames = Math.max(0, defending?.gamesPlayed ?? 0); const opponentGames = Math.max(0, opponent?.gamesPlayed ?? 0); const sampleWeight = clamp( (defendingGames + opponentGames) / (defend…
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (web-lib-projections-calculators-team-context-adjustments-computeteamfiveonfivecontextadjustment, symbol_candidate, location; Codex family 'FORGE staged projection math'):** Compute team five on five context adjustment (computeTeamFiveOnFiveContextAdjustment)
  - Purpose: Compute team five on five context adjustment for forge staged projection math. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: export function computeTeamFiveOnFiveContextAdjustment(args: { defendingTeamProfile: TeamFiveOnFiveProfile \| null; opponentTeamProfile: TeamFiveOnFiveProfile \| null; }): { sampleWeight: number; leagueSavePctAdjustment: number; contextPctAdjustment: number; } { const defending = args.defendingTeamProfile; const opponent = args.opponentTeamProfile; if (!defending && !opponent) { return { sampleWeight: 0, leagueSavePctAdjustment: 0, contextPctAdjustment: 0 }; }
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (web-lib-projections-calculators-team-context-adjustments-computeteamstrengthcontextadjustment, symbol_candidate, location; Codex family 'FORGE staged projection math'):** Compute team strength context adjustment (computeTeamStrengthContextAdjustment)
  - Purpose: Compute team strength context adjustment for forge staged projection math. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: export function computeTeamStrengthContextAdjustment(args: { defendingTeamPrior: TeamStrengthPrior \| null; opponentTeamPrior: TeamStrengthPrior \| null; }): { shotsAgainstPctAdjustment: number; teamGoalsForPctAdjustment: number; opponentGoalsForPctAdjustment: number; sampleWeight: number; } { const defending = args.defendingTeamPrior; const opponent = args.opponentTeamPrior; if (!defending && !opponent) { return { shotsAgainstPctAdjustment: 0, teamGoalsForPctAdjustment: 0, opponentGoalsForPctAdjustment: 0, sampleWeight: 0 };
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): queries/team-context-queries.ts:221-224 comment (nhl_team_data row selection)
  - Intended contract (Codex web-lib-projections-calculators-team-context-adjustments-computenstopponentdangeradjustment): {"source": "web/lib/projections/calculators/team-context-adjustments.ts:170", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["web/lib/projections/calculators/team-context-adjustments.ts:186 (defendingGames + opponentGames) / (defendingGames + opponentGames + 30),", "web/lib/projections/calculators/team-context-adjustments.ts:205 (defendingDangerEdge * 0.32 + paceProxyEdge * 0.12) * sampleWeight,"]}
  - Intended contract (Codex web-lib-projections-calculators-team-context-adjustments-computeteamfiveonfivecontextadjustment): {"source": "web/lib/projections/calculators/team-context-adjustments.ts:103", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["web/lib/projections/calculators/team-context-adjustments.ts:153 (saveEdge * 0.75 + defendingPdoEdge * 0.2) * sampleWeight,", "web/lib/projections/calculators/team-context-adjustments.ts:158 (-saveEdge * 0.45 + opponentPdoEdge * 0.2) * sampleWeight,"]}
  - Intended contract (Codex web-lib-projections-calculators-team-context-adjustments-computeteamstrengthcontextadjustment): {"source": "web/lib/projections/calculators/team-context-adjustments.ts:30", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["web/lib/projections/calculators/team-context-adjustments.ts:56 const sampleWeight = clamp((defendingXgaRaw + opponentXgaRaw) / 280, 0, 1);", "web/lib/projections/calculators/team-context-adjustments.ts:59 (defendingXgaPerGame - TEAM_XG_BASELINE_PER_GAME) / TEAM_XG_BASELINE_PER_GAME,", "web/lib/projections/calculators/team-context-adjustments.ts:64 (opponentXgfPerGame - TEAM_XG_BASELINE_PER_GAME) / TEAM_XG_BASELINE_PER_GAME,", "web/lib/projections/calculators/team-context-adjustments.ts:69 (defendingXgfPerGame - TEAM_XG_BASELINE_PER_GAME) / TEAM_XG_BASELINE_PER_GAME,", "web/lib/projections/calculators/team-context-adjustments.ts:74 (opponentXgaPerGame - TEAM_XG_BASELINE_PER_GAME) / TEAM_XG_BASELINE_PER_GAME,", "web/lib/projections/calculators/team-context-adjustments.ts:80 (defenseLiabilityEdge * 0.32 + opponentOffenseEdge * 0.36) * sampleWeight,", "web/lib/projections/calculators/team-context-adjustments.ts:85 (teamOffenseEdge * 0.3 + opponentDefenseEdge * 0.24) * sampleWeight,", "web/lib…
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/projections/queries/team-context-queries.test.ts`; `web/lib/projections/runProjectionV2.test.ts`; `{"status": "Discovered only; not run", "references": ["web/lib/projections/module-imports.test.ts:14", "web/lib/projections/runProjectionV2.test.ts:16"]}`; `{"status": "Discovered only; not run", "references": ["web/lib/projections/runProjectionV2.test.ts:14"]}`; `{"status": "Discovered only; not run", "references": ["web/lib/projections/runProjectionV2.test.ts:15"]}`
- **Leads (not audited):**
  - (opus) observation: normalizeRateOrPercent threshold here is >2 (vs >1 in skater-adjustments) — inconsistent percent detection
  - (opus) observation: NST fallback reads latest nst_team_stats season <= current (can be prior season)
  - (opus) observation: in-house 10-game xGA (~30) vs season xGA (~200) gives very different sample weights for the same /280 scale
  - (codex:web-lib-projections-calculators-team-context-adjustments-computenstopponentdangeradjustment) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:web-lib-projections-calculators-team-context-adjustments-computeteamfiveonfivecontextadjustment) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:web-lib-projections-calculators-team-context-adjustments-computeteamstrengthcontextadjustment) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-FRG-026 Goalie game table (shots against, goals allowed)

- **Match:** Both; Opus FRG-044; Codex web-lib-projections-derived-buildgoaliegamev2-preparegoaliegamev2
- **Purpose:** Per-goalie per-game SA/GA/saves from PBP
- **Where:** `web/lib/projections/derived/buildGoalieGameV2.ts:63 (prepareGoalieGameV2)`; `web/lib/projections/derived/buildGoalieGameV2.ts:63 prepareGoalieGameV2`
- **Tags (heuristic):** denominators: per game; generation: current
- **Opus view (FRG-044):**
  - Method: Count shot-on-goal + goal events against the goalie in net (empty-net events excluded; shootout excluded); saves = SA - GA; toi_seconds = null.
  - Inputs/units: counts; sources: pbp_plays
  - Output scale: counts per game; writes: forge_goalie_game
  - Status: live
  - Consumers: league sv%; goalie evidence; starter context; workload; accuracy fallback
- **Codex view (web-lib-projections-derived-buildgoaliegamev2-preparegoaliegamev2, calculation, location; Codex family 'FORGE staged projection math'):** Native goalie game count derivation (prepareGoalieGameV2)
  - Purpose: Attribute non-shootout shot-on-goal/goal events to verified in-net goalie, keeping uncertain goalie state distinct.
  - Inputs/units: PBP shot/goal events and defending-goalie evidence.
  - Output scale: Goalie shots against, goals allowed and saves in counts.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): buildGoalieGameV2.ts:74 comment
  - Intended contract (Codex web-lib-projections-derived-buildgoaliegamev2-preparegoaliegamev2): {"source": "web/lib/projections/derived/buildGoalieGameV2.ts:63", "explicit_comment": "Prepares the complete goalie scope for one game without mutating storage. A zero-row result is only valid when every countable event is explicitly an empty-net event (or the completed PBP contains no countable shot events). /", "arithmetic_locations": []}
  - External references: NHL goalie stats (SA excludes EN)
  - Fixtures/test data: none listed
  - Tests: `web/lib/projections/derived/buildGoalieGameV2.test.ts`; `{"status": "Discovered only; not run", "references": ["web/__tests__/pages/api/v1/db/build-projection-derived-v2.test.ts:36", "web/lib/projections/derived/buildGoalieGameV2.test.ts:3"]}`
- **Leads (not audited):**
  - (opus) observation: toi_seconds is always null, but fetchTeamGoalieStarterContext picks the starter by max toi_seconds (all ties)
  - (codex:web-lib-projections-derived-buildgoaliegamev2-preparegoaliegamev2) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested."]

## M-FRG-027 Goalie shutout probability

- **Match:** Both; Opus FRG-045; Codex web-lib-projections-goalie-goalieoutcomes-shutoutprobability
- **Purpose:** P(credited shutout) from NB shots-against mixture and binomial goals
- **Where:** `web/lib/projections/goalie/goalieOutcomes.ts:176 (shutoutProbability)`; `web/lib/projections/goalieModel.ts:206`; `web/lib/projections/goalie/goalieOutcomes.ts:176 shutoutProbability`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: per game; generation: current
- **Opus view (FRG-045):**
  - Method: Shots ~ NB(size 68) around expectation; P(0 GA) = sum_n P(n)*sv^n; x 0.927 (full-game credit share); x starter probability.
  - Inputs/units: shots per game; save fraction; sources: —
  - Output scale: probability 0-1; writes: forge_goalie_projections.proj_shutout_prob
  - Status: live
  - Consumers: fantasy points; accuracy shutout Brier
- **Codex view (web-lib-projections-goalie-goalieoutcomes-shutoutprobability, calculation, location; Codex family 'FORGE staged projection math'):** Credited shutout probability if starting (shutoutProbability)
  - Purpose: Integrate savePct^shots over NB shots (size 68 default) then multiply .927 full-game credit probability.
  - Inputs/units: Named model/observation inputs at cited declaration; SO probability conditional on start; caller applies P(start). Input count/rate units follow the corresponding named outcome; cutoff timestamps and identity are required where declared.
  - Output scale: SO probability conditional on start; caller applies P(start).
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): goalie/goalieOutcomes.ts:34-43 comments
  - Intended contract (Codex web-lib-projections-goalie-goalieoutcomes-shutoutprobability): {"source": "web/lib/projections/goalie/goalieOutcomes.ts:176", "explicit_comment": "P(no goals against over a full game) from a shots-against mixture: shots ~ negative binomial around the expectation (size Infinity = Poisson), goals \| shots ~ Binomial(shots, 1 - save %), times P(the starter is credited with the full game \| clean sheet). Multiply by P(start) outside. /", "arithmetic_locations": ["web/lib/projections/goalie/goalieOutcomes.ts:188 const variance = finiteSize ? mu + (mu * mu) / r : mu;", "web/lib/projections/goalie/goalieOutcomes.ts:189 const maxShots = Math.ceil(mu + 12 * Math.sqrt(variance) + 20);", "web/lib/projections/goalie/goalieOutcomes.ts:190 let pShots = finiteSize ? Math.pow(r / (r + mu), r) : Math.exp(-mu);", "web/lib/projections/goalie/goalieOutcomes.ts:194 total += pShots * pSaveAll;", "web/lib/projections/goalie/goalieOutcomes.ts:195 pShots *= finiteSize ? ((n + r) / (n + 1)) * (mu / (r + mu)) : mu / (n + 1);", "web/lib/projections/goalie/goalieOutcomes.ts:198 return clamp(total * fullGame, 0, 1);", "web/lib/projections/goalie/goalieOutcomes.ts:201 /**", "web/lib/projections/goalie/goalieOutcomes.ts:212 /** P(this goalie starts); the candidates' values …
  - External references: Binomial save model
  - Fixtures/test data: none listed
  - Tests: `web/lib/projections/goalie/goalieOutcomes.test.ts`; `{"status": "Discovered only; not run", "references": ["web/lib/projections/goalie/goalieOutcomes.test.ts:12", "web/lib/projections/goalieModel.test.ts:6", "web/lib/projections/reserveProjections.test.ts:72"]}`
- **Leads (not audited):**
  - (opus) observation: horizon-scaled shutout 'probability' can exceed 1 for horizon>1
  - (codex:web-lib-projections-goalie-goalieoutcomes-shutoutprobability) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested."]

## M-FRG-028 Modeled save percentage (beta-binomial) with context shifts

- **Match:** Both; Opus FRG-046; Codex web-lib-projections-goalie-goalieoutcomes-goalierestsavepctadjustment, web-lib-projections-goalie-goalieoutcomes-posteriorsavepct, web-lib-projections-goaliemodel-computemodeledsavepct
- **Possible related records (low-confidence location link, unconfirmed):** web-lib-projections-calculators-goalie-save-pct-context-computegoalierestsplitsavepctadjustment
- **Purpose:** Goalie save% posterior plus fitted rest/workload and damped context shifts
- **Where:** `web/lib/projections/goalie/goalieOutcomes.ts:56 (posteriorSavePct)`; `web/lib/projections/goalieModel.ts:127 (computeModeledSavePct)`; `web/lib/projections/goalie/goalieOutcomes.ts:69 (goalieRestSavePctAdjustment)`; `web/lib/projections/stages/goalie-stage.ts:535 (savePctAdjustment)`; `web/lib/projections/stages/goalie-stage.ts:369 (contextSavePctShift)`; `web/lib/projections/calculators/goalie-save-pct-context.ts:41 (computeGoalieRestSplitSavePctAdjustment)`; `web/lib/projections/goalie/goalieOutcomes.ts:69 goalieRestSavePctAdjustment`; `web/lib/projections/goalie/goalieOutcomes.ts:56 posteriorSavePct`; `web/lib/projections/goalieModel.ts:127 computeModeledSavePct`
- **Tags (heuristic):** percent scale: fraction 0-1; generation: current
- **Opus view (FRG-046):**
  - Method: posterior = (saves + 6000*league)/(shots + 6000) using baseline window if baseline shots >= season shots else season. Adjustment = rest term (-0.003 if goalie B2B else -0.002 if >=5 starts in 14 days) + 0.25 x (contextShift + restSplit). contextShift = clamp(-0.04*contextPct + teamFiveOnFive.leagueSavePctAdjustment, ±0.02). restSplit = clamp((bucketSv - games-weighted mean sv)*g/(g+6), ±0.012), min 2 games. final clamp 0.85-0.94; GA = SA*(1-sv); saves = SA-GA.
  - Inputs/units: counts; save fraction; sources: forge_goalie_game, wgo_goalie_stats, wgo_team_stats
  - Output scale: save fraction 0.85-0.94; writes: forge_goalie_projections.proj_goals_allowed/proj_saves
  - Status: live
  - Consumers: win/shutout probabilities; fantasy points; accuracy
- **Codex view (web-lib-projections-goalie-goalieoutcomes-goalierestsavepctadjustment, symbol_candidate, codex_part_of_opus; Codex family 'FORGE staged projection math'):** Goalie rest save pct adjustment (goalieRestSavePctAdjustment)
  - Purpose: Goalie rest save pct adjustment for forge staged projection math. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: export function goalieRestSavePctAdjustment(workload: { isGoalieBackToBack: boolean; startsLast14Days: number; }): number { if (workload.isGoalieBackToBack) return GOALIE_B2B_SAVE_PCT_ADJUSTMENT; if (workload.startsLast14Days >= GOALIE_HEAVY_WORKLOAD_MIN_STARTS_14D) { return GOALIE_HEAVY_WORKLOAD_SAVE_PCT_ADJUSTMENT; } return 0; }
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (web-lib-projections-goalie-goalieoutcomes-posteriorsavepct, calculation, location; Codex family 'FORGE staged projection math'):** Beta-binomial goalie save-percentage mean (posteriorSavePct)
  - Purpose: (shots-goals+k*leagueSavePct)/(shots+k), default k=6000 shots.
  - Inputs/units: Named model/observation inputs at cited declaration; Save fraction [0,1]. Input count/rate units follow the corresponding named outcome; cutoff timestamps and identity are required where declared.
  - Output scale: Save fraction [0,1].
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (web-lib-projections-goaliemodel-computemodeledsavepct, calculation, location; Codex family 'FORGE staged projection math'):** Context-adjusted goalie save percentage (computeModeledSavePct)
  - Purpose: Use baseline window once if at least season volume, otherwise season; beta posterior plus supplied adjustment; clamp .85-.94.
  - Inputs/units: Named model/observation inputs at cited declaration; Projected save fraction. Input count/rate units follow the corresponding named outcome; cutoff timestamps and identity are required where declared.
  - Output scale: Projected save fraction.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): goalie/goalieOutcomes.ts:14-29 comments (k=6000 fit, B2B/workload fits, pass-through 0.25)
  - Intended contract (Codex web-lib-projections-goalie-goalieoutcomes-goalierestsavepctadjustment): {"source": "web/lib/projections/goalie/goalieOutcomes.ts:69", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": []}
  - Intended contract (Codex web-lib-projections-goalie-goalieoutcomes-posteriorsavepct): {"source": "web/lib/projections/goalie/goalieOutcomes.ts:56", "explicit_comment": "One beta-binomial: all of a goalie's evidence shrunk toward the league mean with k shots.", "arithmetic_locations": ["web/lib/projections/goalie/goalieOutcomes.ts:66 return (shots - goals + k * args.priorMean) / (shots + k);"]}
  - Intended contract (Codex web-lib-projections-goaliemodel-computemodeledsavepct): {"source": "web/lib/projections/goalieModel.ts:127", "explicit_comment": "web/lib/projections/goalieModel.ts:135 The baseline window (last 200 GP) contains the season and recent windows: use it once.", "arithmetic_locations": []}
  - External references: Beta-binomial save% shrinkage (k ~3,000-11,000 shots in literature); GSAx
  - Fixtures/test data: `web/scripts/forge-goalie-backtest.ts`
  - Tests: `web/lib/projections/goalie/goalieOutcomes.test.ts`; `web/lib/projections/goalieModel.test.ts`; `{"status": "Discovered only; not run", "references": ["web/lib/projections/goalie/goalieOutcomes.test.ts:11"]}`; `{"status": "Discovered only; not run", "references": ["web/lib/projections/goalie/goalieOutcomes.test.ts:8"]}`; `{"status": "Discovered only; not run", "references": ["web/lib/projections/goalieModel.test.ts:8"]}`
- **Leads (not audited):**
  - (opus) observation: no shot-quality (xG) adjustment; raw sv%
  - (opus) observation: team 5v5 save% (largely this goalie's own) feeds back in as a context shift (double counting)
  - (opus) observation: rest-split adjustment chases WGO days-rest splits (known noise) with k=6 games
  - (opus) observation: 'workload' counts appearances (relief included) from forge_goalie_game
  - (codex:web-lib-projections-goalie-goalieoutcomes-goalierestsavepctadjustment) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:web-lib-projections-goalie-goalieoutcomes-posteriorsavepct) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested."]
  - (codex:web-lib-projections-goaliemodel-computemodeledsavepct) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested."]

## M-FRG-029 Team win probability (Poisson race) and goalie win populations

- **Match:** Both; Opus FRG-047; Codex web-lib-projections-goalie-goalieoutcomes-goalieconditionalwinprobability, web-lib-projections-goalie-goalieoutcomes-goaliewinpopulations, web-lib-projections-goalie-goalieoutcomes-marketteamwinprobability, web-lib-projections-goalie-goalieoutcomes-teamwinprobability
- **Purpose:** P(team wins incl. OT/SO), goalie-conditional win, credited goalie W including relief
- **Where:** `web/lib/projections/goalie/goalieOutcomes.ts:92 (teamWinProbability)`; `web/lib/projections/goalie/goalieOutcomes.ts:130 (marketTeamWinProbability)`; `web/lib/projections/goalie/goalieOutcomes.ts:157 (goalieConditionalWinProbability)`; `web/lib/projections/goalie/goalieOutcomes.ts:235 (goalieWinPopulations)`; `web/lib/projections/stages/goalie-stage.ts:382 (teamWinProb)`; `web/lib/projections/stages/goalie-stage.ts:564 (teamGoalsPerShot)`; `web/lib/projections/goalie/goalieOutcomes.ts:157 goalieConditionalWinProbability`; `web/lib/projections/goalie/goalieOutcomes.ts:235 goalieWinPopulations`; `web/lib/projections/goalie/goalieOutcomes.ts:130 marketTeamWinProbability`; `web/lib/projections/goalie/goalieOutcomes.ts:92 teamWinProbability`
- **Tags (heuristic):** percent scale: fraction 0-1; conditionality: unconditional; denominators: per game, per team game; generation: current
- **Opus view (FRG-047):**
  - Method: Shrink expected goals toward their mean by 0.75 (Brier optimum 0.5 on trailing-10 inputs); independent Poisson regulation; ties x1.33 (cap 0.95); regulation win = W/(W+L)*(1-tie); OT share f/(f+a). Market: de-vigged proportional h2h if book sum in [0.98,1.35]. Goalie-conditional: team prob + [P(λf, λa*ratio) - P(λf, λa)], ratio = goalie GA/shot over start-weighted team GA/shot, clamp 0.01-0.99. Credited W = P(start) x P(win\|start) x 0.984 + relief share (1-0.984) distributed by start probability.
  - Inputs/units: expected goals per game; American odds or implied prob; sources: forge_player_projections (summed), market_prices_daily
  - Output scale: probability 0-1 (or expected wins for horizon>1); writes: forge_goalie_projections.proj_win_prob, uncertainty.win_populations
  - Status: live
  - Consumers: goalie fantasy points; accuracy win Brier; forge/goalies API
- **Codex view (web-lib-projections-goalie-goalieoutcomes-goalieconditionalwinprobability, calculation, location; Codex family 'FORGE staged projection math'):** Starter-conditional team win probability (goalieConditionalWinProbability)
  - Purpose: Move paired team probability by Poisson win-model delta after opponent goals scale by goalie relative GA-per-shot.
  - Inputs/units: Named model/observation inputs at cited declaration; P(team wins \| goalie starts), clamped .01-.99 except identity case. Input count/rate units follow the corresponding named outcome; cutoff timestamps and identity are required where declared.
  - Output scale: P(team wins \| goalie starts), clamped .01-.99 except identity case.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (web-lib-projections-goalie-goalieoutcomes-goaliewinpopulations, calculation, location; Codex family 'FORGE staged projection math'):** Starter and relief credited-win populations (goalieWinPopulations)
  - Purpose: StarterWin=pStart*pTeamWin*.984; allocate other starters’ relief-win mass across alternative candidates proportional to their start probabilities.
  - Inputs/units: Named model/observation inputs at cited declaration; Credited W if starts, starterWin, reliefWin, unconditionalWin; team start-weighted win and probability mass. Input count/rate units follow the corresponding named outcome; cutoff timestamps and identity are required where declared.
  - Output scale: Credited W if starts, starterWin, reliefWin, unconditionalWin; team start-weighted win and probability mass.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (web-lib-projections-goalie-goalieoutcomes-marketteamwinprobability, symbol_candidate, location; Codex family 'FORGE staged projection math'):** Market team win probability (marketTeamWinProbability)
  - Purpose: De-vigged moneyline P(team wins) from a stored h2h summary (outcome keys `team:<ABBR>`), by proportional normalisation of the two implied probabilities (utils/devig). Null when either side is missing or the pair does not look like a real book (e.g. decimal odds stored as American). /
  - Inputs/units: Parameter/type declaration excerpt: export function marketTeamWinProbability( h2h: MarketTypeSummary \| null \| undefined, teamAbbrev: string \| null, opponentAbbrev: string \| null ): number \| null { if (!h2h \|\| !teamAbbrev \|\| !opponentAbbrev) return null; const implied = (abbrev: string) => { const outcome = h2h.outcomes.find((o) => o.outcomeKey === `team:${abbrev}`); if (!outcome) return null; const direct = outcome.averageImpliedProbability; return direct != null && Number.isFinite(direct) && direct > 0 && direct < 1 ? direct : americanToImpliedProbability(outcome.averagePriceAmerican); }; const team = implied(teamAbbrev); const opponent = implied(opponentAbbrev); if (team == null \|\| opponent == null) return null; const bookSum = team + opponent;
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (web-lib-projections-goalie-goalieoutcomes-teamwinprobability, calculation, location; Codex family 'FORGE staged projection math'):** Paired team win probability (teamWinProbability)
  - Purpose: Independent Poisson goal race after symmetric spread shrink .75; tie probability inflated ×1.33; OT/SO win share proportional to expected scoring.
  - Inputs/units: Named model/observation inputs at cited declaration; Team-game win probability [0,1]; reversed team pair sums to 1. Input count/rate units follow the corresponding named outcome; cutoff timestamps and identity are required where declared.
  - Output scale: Team-game win probability [0,1]; reversed team pair sums to 1.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): goalie/goalieOutcomes.ts:30-49 comments (fits on 2018-19..2024-25)
  - Intended contract (Codex web-lib-projections-goalie-goalieoutcomes-goalieconditionalwinprobability): {"source": "web/lib/projections/goalie/goalieOutcomes.ts:157", "explicit_comment": "P(team wins \| this goalie starts): the team-level (paired) probability moved by the change in the model win probability when the opponent's expected goals scale with this goalie's goals per shot relative to the team's start-weighted expectation. A ratio of 1 returns the team value. /", "arithmetic_locations": ["web/lib/projections/goalie/goalieOutcomes.ts:166 teamWinProbability(args.lambdaFor, args.lambdaAgainst * ratio) -", "web/lib/projections/goalie/goalieOutcomes.ts:171 /**"]}
  - Intended contract (Codex web-lib-projections-goalie-goalieoutcomes-goaliewinpopulations): {"source": "web/lib/projections/goalie/goalieOutcomes.ts:235", "explicit_comment": "Per-candidate unconditional W. Relief wins (1 - decision share of the team's wins when h starts) go to the other candidates in proportion to their start probabilities, i.e. the dressed backup is the likelier non-starter. With start probabilities summing to 1 the candidates' unconditional W sums to the start-weighted team win probability. /", "arithmetic_locations": ["web/lib/projections/goalie/goalieOutcomes.ts:251 reliefWin += h.startProbability * h.teamWinIfStarts * (1 - decisionShare) * (g.startProbability / others);", "web/lib/projections/goalie/goalieOutcomes.ts:253 const creditedWinIfStarts = g.teamWinIfStarts * decisionShare;", "web/lib/projections/goalie/goalieOutcomes.ts:254 const starterWin = g.startProbability * creditedWinIfStarts;", "web/lib/projections/goalie/goalieOutcomes.ts:258 ? cleaned.reduce((sum, c) => sum + c.startProbability * c.teamWinIfStarts, 0) / mass"]}
  - Intended contract (Codex web-lib-projections-goalie-goalieoutcomes-marketteamwinprobability): {"source": "web/lib/projections/goalie/goalieOutcomes.ts:130", "explicit_comment": "De-vigged moneyline P(team wins) from a stored h2h summary (outcome keys `team:<ABBR>`), by proportional normalisation of the two implied probabilities (utils/devig). Null when either side is missing or the pair does not look like a real book (e.g. decimal odds stored as American). /", "arithmetic_locations": ["web/lib/projections/goalie/goalieOutcomes.ts:152 /**"]}
  - Intended contract (Codex web-lib-projections-goalie-goalieoutcomes-teamwinprobability): {"source": "web/lib/projections/goalie/goalieOutcomes.ts:92", "explicit_comment": "P(team wins, including OT/SO) from both teams' expected goals. The two teams' values sum to exactly 1: regulation is an independent Poisson race with inflated ties, and OT/SO goes to the team with the larger share of scoring. /", "arithmetic_locations": ["web/lib/projections/goalie/goalieOutcomes.ts:102 const mean = (lambdaFor + lambdaAgainst) / 2;", "web/lib/projections/goalie/goalieOutcomes.ts:103 const f = Math.max(0, mean + (shrink * (lambdaFor - lambdaAgainst)) / 2);", "web/lib/projections/goalie/goalieOutcomes.ts:104 const a = Math.max(0, mean - (shrink * (lambdaFor - lambdaAgainst)) / 2);", "web/lib/projections/goalie/goalieOutcomes.ts:112 const p = pf[i] * pa[j];", "web/lib/projections/goalie/goalieOutcomes.ts:119 const inflatedTie = clamp(tie * tieInflation, 0, 0.95);", "web/lib/projections/goalie/goalieOutcomes.ts:120 const regulationWin = (win + loss > 0 ? win / (win + loss) : 0.5) * (1 - inflatedTie);", "web/lib/projections/goalie/goalieOutcomes.ts:121 const overtimeShare = f + a > 0 ? f / (f + a) : 0.5;", "web/lib/projections/goalie/goalieOutcomes.ts:122 return clamp(regulationWin + inf…
  - External references: Poisson/Skellam goal models; de-vigged moneyline
  - Fixtures/test data: `web/scripts/forge-goalie-backtest.ts`
  - Tests: `web/lib/projections/goalie/goalieOutcomes.test.ts`; `web/lib/projections/goalieModel.test.ts`; `{"status": "Discovered only; not run", "references": ["web/lib/projections/goalie/goalieOutcomes.test.ts:10"]}`; `{"status": "Discovered only; not run", "references": ["web/lib/projections/goalie/goalieOutcomes.test.ts:13", "web/lib/rosterScheduleData/forgeDailyBridge.test.ts:8", "web/scripts/forge-goalie-backtest.test.ts:24"]}`; `{"status": "Discovered only; not run", "references": ["web/lib/projections/goalie/goalieOutcomes.test.ts:7"]}`; `{"status": "Discovered only; not run", "references": ["web/lib/projections/goalie/goalieOutcomes.test.ts:9"]}`
- **Leads (not audited):**
  - (opus) observation: lambdas come from teamGoalsByTeamId = sum of horizon-scaled ES+PP player goals; for horizon >1 a multi-game total is used as a single-game Poisson mean
  - (opus) observation: ES+PP only (no SH, empty-net, OT goals), so lambdas are biased low
  - (opus) observation: proj_win_prob is multiplied by the horizon scalar sum (goalie-stage.ts:820) so it can exceed 1
  - (codex:web-lib-projections-goalie-goalieoutcomes-goalieconditionalwinprobability) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested."]
  - (codex:web-lib-projections-goalie-goalieoutcomes-goaliewinpopulations) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested."]
  - (codex:web-lib-projections-goalie-goalieoutcomes-marketteamwinprobability) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:web-lib-projections-goalie-goalieoutcomes-teamwinprobability) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested."]

## M-FRG-030 Season-current league save percentage

- **Match:** Both; Opus FRG-048; Codex web-lib-projections-goalie-leaguesavepct-blendseasonleaguesavepct, web-lib-projections-goalie-leaguesavepct-seasonstartdate
- **Purpose:** Beta-prior mean for goalie save% (current season blended with last season)
- **Where:** `web/lib/projections/goalie/leagueSavePct.ts:28 (blendSeasonLeagueSavePct)`; `web/lib/projections/goalie/leagueSavePct.ts:42 (loadSeasonLeagueSavePct)`; `web/lib/projections/goalie/goalieOutcomes.ts:19 (LEAGUE_SAVE_PCT_FALLBACK)`; `web/lib/projections/goalie/leagueSavePct.ts:28 blendSeasonLeagueSavePct`; `web/lib/projections/goalie/leagueSavePct.ts:22 seasonStartDate`
- **Tags (heuristic):** percent scale: fraction 0-1; generation: current
- **Opus view (FRG-048):**
  - Method: Season starts July 1. prior = last season sv% if last-season shots >= 20,000 else 0.8955. sv = (curShots - curGoals + 20000*prior)/(curShots + 20000). Paged read max 12 x 1000 rows.
  - Inputs/units: counts; sources: forge_goalie_game
  - Output scale: save fraction 0-1; writes: —
  - Status: live
  - Consumers: computeModeledSavePct
- **Codex view (web-lib-projections-goalie-leaguesavepct-blendseasonleaguesavepct, calculation, location; Codex family 'FORGE staged projection math'):** Season-current league save fraction prior (blendSeasonLeagueSavePct)
  - Purpose: (currentShots-currentGoals+k*previousSavePct)/(currentShots+k); previous rate available only at carryover support threshold, else fitted fallback.
  - Inputs/units: Current/previous league shots and goals, carryover pseudo-shots constant.
  - Output scale: League save fraction and optional previous-season save fraction.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (web-lib-projections-goalie-leaguesavepct-seasonstartdate, symbol_candidate, location; Codex family 'FORGE staged projection math'):** Season start date (seasonStartDate)
  - Purpose: Season start date for forge staged projection math. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: function seasonStartDate(asOfDate: string, yearsBack = 0): string { const [year, month] = asOfDate.split("-").map(Number); const startYear = (month >= 7 ? year : year - 1) - yearsBack; return `${startYear}-07-01`; }
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): goalie/leagueSavePct.ts:5-7 comment
  - Intended contract (Codex web-lib-projections-goalie-leaguesavepct-blendseasonleaguesavepct): {"source": "web/lib/projections/goalie/leagueSavePct.ts:28", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["web/lib/projections/goalie/leagueSavePct.ts:35 ? 1 - args.previousGoals / args.previousShots : null;", "web/lib/projections/goalie/leagueSavePct.ts:37 const savePct = (args.currentShots - args.currentGoals + LEAGUE_SAVE_PCT_CARRYOVER_SHOTS * prior) /"]}
  - Intended contract (Codex web-lib-projections-goalie-leaguesavepct-seasonstartdate): {"source": "web/lib/projections/goalie/leagueSavePct.ts:22", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": []}
  - External references: League sv% (NHL ~0.900-0.905)
  - Fixtures/test data: none listed
  - Tests: `web/lib/projections/goalie/leagueSavePct.test.ts`; `{"status": "Discovered only; not run", "references": ["web/__tests__/pages/api/v1/db/update-nst-gamelog.test.ts:1423", "web/__tests__/pages/api/v1/db/update-sko-stats.test.ts:26", "web/lib/nst/goalieCatchup.server.test.ts:13", "web/lib/nst/goalieCatchup.test.ts:16", "web/lib/nst/goalieFreshness.test.ts:8", "web/lib/projections/goalie/leagueSavePct.test.ts (module test)", "web/lib/routeRunner/core.test.ts:442"]}`; `{"status": "Discovered only; not run", "references": ["web/lib/projections/goalie/goalieOutcomes.test.ts:15", "web/lib/projections/goalie/leagueSavePct.test.ts (module test)"]}`
- **Leads (not audited):**
  - (opus) observation: forge_goalie_game excludes empty-net events and has no game-type filter here (playoffs/preseason in previous-season window)
  - (opus) observation: hard-coded fallback 0.8955 and July-1 season boundary
  - (codex:web-lib-projections-goalie-leaguesavepct-blendseasonleaguesavepct) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested."]
  - (codex:web-lib-projections-goalie-leaguesavepct-seasonstartdate) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-FRG-031 Goalie profile tiers (volatility, blowup risk, confidence, quality, recommendation)

- **Match:** Both; Opus FRG-049; Codex web-lib-projections-goaliemodel-computegoalieprojectionmodel, web-lib-projections-goaliemodel-computemodeledsavepct, web-lib-projections-goaliemodel-qualityfromsavepctdelta, web-lib-projections-goaliemodel-recommendationfromprofile, web-lib-projections-goaliemodel-reliabilityfromvolatility, web-lib-projections-goaliemodel-tierfromconfidence
- **Purpose:** Descriptive goalie risk tiers and START/SIT recommendation
- **Where:** `web/lib/projections/goalieModel.ts:146 (computeGoalieProjectionModel)`; `web/lib/projections/goalieModel.ts:88-125 (tier helpers)`; `web/lib/projections/goalieModel.ts:146 computeGoalieProjectionModel`; `web/lib/projections/goalieModel.ts:127 computeModeledSavePct`; `web/lib/projections/goalieModel.ts:94 qualityFromSavePctDelta`; `web/lib/projections/goalieModel.ts:107 recommendationFromProfile`; `web/lib/projections/goalieModel.ts:101 reliabilityFromVolatility`; `web/lib/projections/goalieModel.ts:88 tierFromConfidence`
- **Tags (heuristic):** percent scale: fraction 0-1; generation: current
- **Opus view (FRG-049):**
  - Method: qsW = QS/(QS+16); qsDelta = clamp(QS%-0.53,±0.25)*qsW; volatility = clamp(resSD/1.2 - 1.25*qsDelta,0,2); blowup = P(GA>=4 \| λ=GA*(1+0.35*vol))*pStart. confidence = clamp(0.18+0.4*min(base/1400,1)+0.25*min(season/900,1)+0.17*min(recent/300,1) - 0.35*vol/2 - 0.22*smallSample + clamp(0.4qsDelta,±0.06)); tiers HIGH>=0.72, MEDIUM>=0.45. quality ELITE >=+0.012, ABOVE >=+0.004, AVERAGE >=-0.006. Recommendation: AVOID if pStart<0.42; START if elite+stable or (pStart>=0.62 & blowup<=0.32); SIT if blowup>=0.42 & volatile; STREAM if pStart>=0.5 and above-average.
  - Inputs/units: goals; shots; percent/fraction; sources: forge_goalie_game, wgo_goalie_stats
  - Output scale: categorical tiers; probability; writes: forge_goalie_projections.uncertainty (model meta)
  - Status: live
  - Consumers: goalie UI
- **Codex view (web-lib-projections-goaliemodel-computegoalieprojectionmodel, calculation, codex_part_of_opus; Codex family 'FORGE staged projection math'):** Goalie saves, GA, wins, shutouts and recommendation (computeGoalieProjectionModel)
  - Purpose: GA=SA*(1-savePct), SV=SA-GA; credited wins=startP*teamWinIfStarts*.984; SO from shot mixture; blowup=Pr(Poisson(adjusted GA)≥4)*startP. Sample/volatility heuristics yield tiers.
  - Inputs/units: Named model/observation inputs at cited declaration; Saves and GA counts; W/SO/blowup probabilities; volatility index 0-2; confidence/quality/reliability tiers; START/SIT/STREAM_TARGET/AVOID. Input count/rate units follow the corresponding named outcome; cutoff timestamps and identity are required where declared.
  - Output scale: Saves and GA counts; W/SO/blowup probabilities; volatility index 0-2; confidence/quality/reliability tiers; START/SIT/STREAM_TARGET/AVOID.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (web-lib-projections-goaliemodel-computemodeledsavepct, calculation, codex_part_of_opus; Codex family 'FORGE staged projection math'):** Context-adjusted goalie save percentage (computeModeledSavePct)
  - Purpose: Use baseline window once if at least season volume, otherwise season; beta posterior plus supplied adjustment; clamp .85-.94.
  - Inputs/units: Named model/observation inputs at cited declaration; Projected save fraction. Input count/rate units follow the corresponding named outcome; cutoff timestamps and identity are required where declared.
  - Output scale: Projected save fraction.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (web-lib-projections-goaliemodel-qualityfromsavepctdelta, symbol_candidate, codex_part_of_opus; Codex family 'FORGE staged projection math'):** Quality from save pct delta (qualityFromSavePctDelta)
  - Purpose: Quality from save pct delta for forge staged projection math. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: function qualityFromSavePctDelta(delta: number): QualityTier { if (delta >= 0.012) return "ELITE"; if (delta >= 0.004) return "ABOVE_AVERAGE"; if (delta >= -0.006) return "AVERAGE"; return "BELOW_AVERAGE"; }
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (web-lib-projections-goaliemodel-recommendationfromprofile, symbol_candidate, location; Codex family 'FORGE staged projection math'):** Recommendation from profile (recommendationFromProfile)
  - Purpose: Recommendation from profile for forge staged projection math. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: function recommendationFromProfile(args: { starterProbability: number; blowupRisk: number; qualityTier: QualityTier; reliabilityTier: ReliabilityTier; }): GoalieRecommendation { const { starterProbability, blowupRisk, qualityTier, reliabilityTier } = args; if (starterProbability < 0.42) return "AVOID"; if (qualityTier === "ELITE" && reliabilityTier === "STABLE") return "START"; if (blowupRisk >= 0.42 && reliabilityTier === "VOLATILE") return "SIT"; if (starterProbability >= 0.62 && blowupRisk <= 0.32) return "START"; if ( starterProbability >= 0.5 && (qualityTier === "ELITE" \|\| qualityTier === "ABOVE_AVERAGE") ) { return "STREAM_TARGET"; } return "SIT";
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (web-lib-projections-goaliemodel-reliabilityfromvolatility, symbol_candidate, codex_part_of_opus; Codex family 'FORGE staged projection math'):** Reliability from volatility (reliabilityFromVolatility)
  - Purpose: Reliability from volatility for forge staged projection math. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: function reliabilityFromVolatility(volatilityIndex: number): ReliabilityTier { if (volatilityIndex <= 0.55) return "STABLE"; if (volatilityIndex <= 1.1) return "AVERAGE"; return "VOLATILE"; }
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (web-lib-projections-goaliemodel-tierfromconfidence, symbol_candidate, codex_part_of_opus; Codex family 'FORGE staged projection math'):** Tier from confidence (tierFromConfidence)
  - Purpose: Tier from confidence for forge staged projection math. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: function tierFromConfidence(score: number): ConfidenceTier { if (score >= 0.72) return "HIGH"; if (score >= 0.45) return "MEDIUM"; return "LOW"; }
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex web-lib-projections-goaliemodel-computegoalieprojectionmodel): {"source": "web/lib/projections/goalieModel.ts:146", "explicit_comment": "web/lib/projections/goalieModel.ts:172 One beta-binomial over all evidence toward the season-current league mean (no recency layer).", "arithmetic_locations": ["web/lib/projections/goalieModel.ts:164 const lowRecentSamplePenalty = clamp((140 - recentShots) / 140, 0, 1);", "web/lib/projections/goalieModel.ts:165 const lowSeasonSamplePenalty = clamp((420 - seasonShots) / 420, 0, 1);", "web/lib/projections/goalieModel.ts:167 lowRecentSamplePenalty * 0.6 + lowSeasonSamplePenalty * 0.4,", "web/lib/projections/goalieModel.ts:179 const projectedGoalsAllowed = projectedShotsAgainst * (1 - modeledSavePct);", "web/lib/projections/goalieModel.ts:184 const qualityStartsWeight = clamp(qualityStarts / (qualityStarts + 16), 0, 1);", "web/lib/projections/goalieModel.ts:188 : clamp(qualityStartsPct - 0.53, -0.25, 0.25) * qualityStartsWeight;", "web/lib/projections/goalieModel.ts:190 input.evidence.residualStdDev / 1.2 - qualityStabilityDelta * 1.25,", "web/lib/projections/goalieModel.ts:194 const blowupLambda = projectedGoalsAllowed * (1 + 0.35 * volatilityIndex);"]}
  - Intended contract (Codex web-lib-projections-goaliemodel-computemodeledsavepct): {"source": "web/lib/projections/goalieModel.ts:127", "explicit_comment": "web/lib/projections/goalieModel.ts:135 The baseline window (last 200 GP) contains the season and recent windows: use it once.", "arithmetic_locations": []}
  - Intended contract (Codex web-lib-projections-goaliemodel-qualityfromsavepctdelta): {"source": "web/lib/projections/goalieModel.ts:94", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": []}
  - Intended contract (Codex web-lib-projections-goaliemodel-recommendationfromprofile): {"source": "web/lib/projections/goalieModel.ts:107", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": []}
  - Intended contract (Codex web-lib-projections-goaliemodel-reliabilityfromvolatility): {"source": "web/lib/projections/goalieModel.ts:101", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": []}
  - Intended contract (Codex web-lib-projections-goaliemodel-tierfromconfidence): {"source": "web/lib/projections/goalieModel.ts:88", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": []}
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/projections/goalieModel.test.ts`; `{"status": "Discovered only; not run", "references": ["web/lib/projections/goalieModel.test.ts (module test)"]}`; `{"status": "Discovered only; not run", "references": ["web/lib/projections/goalieModel.test.ts:8"]}`
- **Leads (not audited):**
  - (opus) observation: all thresholds hand-set; quality tier is just shrunk sv% minus league (largely prior-driven with k=6000)
  - (codex:web-lib-projections-goaliemodel-computegoalieprojectionmodel) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested."]
  - (codex:web-lib-projections-goaliemodel-computemodeledsavepct) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested."]
  - (codex:web-lib-projections-goaliemodel-qualityfromsavepctdelta) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:web-lib-projections-goaliemodel-recommendationfromprofile) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:web-lib-projections-goaliemodel-reliabilityfromvolatility) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:web-lib-projections-goaliemodel-tierfromconfidence) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-FRG-032 Goalie workload context

- **Match:** Both; Opus FRG-051; Codex web-lib-projections-calculators-goalie-save-pct-context-togoalierestsplitbucket
- **Purpose:** Appearances in last 7/14 days, days since last appearance, B2B flag
- **Where:** `web/lib/projections/queries/goalie-queries.ts:174 (fetchGoalieWorkloadContext)`; `web/lib/projections/queries/goalie-queries.ts:214 (fetchGoalieRestSplitProfile)`; `web/lib/projections/calculators/goalie-save-pct-context.ts:30 (toGoalieRestSplitBucket)`; `web/lib/projections/calculators/goalie-save-pct-context.ts:30 toGoalieRestSplitBucket`
- **Tags (heuristic):** generation: current
- **Opus view (FRG-051):**
  - Method: startsLast7/14 = distinct appearance dates within 7/14 days; daysSinceLastStart = days to latest; B2B if 1. Rest bucket 0/1/2/3/4+.
  - Inputs/units: days; sources: forge_goalie_game, wgo_goalie_stats
  - Output scale: counts; writes: —
  - Status: live
  - Consumers: save% adjustment; starter metadata
- **Codex view (web-lib-projections-calculators-goalie-save-pct-context-togoalierestsplitbucket, symbol_candidate, location; Codex family 'FORGE staged projection math'):** To goalie rest split bucket (toGoalieRestSplitBucket)
  - Purpose: To goalie rest split bucket for forge staged projection math. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: export function toGoalieRestSplitBucket( daysSinceLastStart: number \| null ): GoalieRestSplitBucket { if (daysSinceLastStart == null) return "4_plus"; if (daysSinceLastStart <= 0) return "0"; if (daysSinceLastStart === 1) return "1"; if (daysSinceLastStart === 2) return "2"; if (daysSinceLastStart === 3) return "3"; return "4_plus"; }
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex web-lib-projections-calculators-goalie-save-pct-context-togoalierestsplitbucket): {"source": "web/lib/projections/calculators/goalie-save-pct-context.ts:30", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": []}
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/projections/goalieModel.test.ts`; `{"status": "Discovered only; not run", "references": ["web/lib/projections/runProjectionV2.test.ts:46"]}`
- **Leads (not audited):**
  - (opus) observation: 'starts' are appearances (relief included)
  - (codex:web-lib-projections-calculators-goalie-save-pct-context-togoalierestsplitbucket) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-FRG-033 Goalie evidence aggregation

- **Match:** Both; Opus FRG-052; Codex web-lib-projections-utils-number-utils-safestddev, web-lib-projections-utils-number-utils-sigmoid
- **Purpose:** Recent/season/baseline shots and goals allowed plus residual SD and quality starts
- **Where:** `web/lib/projections/queries/goalie-queries.ts:251 (fetchGoalieEvidence)`; `web/lib/projections/utils/number-utils.ts:62 (safeStdDev)`; `web/lib/projections/utils/number-utils.ts:62 safeStdDev`; `web/lib/projections/utils/number-utils.ts:70 sigmoid`
- **Tags (heuristic):** percent scale: fraction 0-1; generation: current
- **Opus view (FRG-052):**
  - Method: recent = last 20 appearances; season = since July 1 (<=120); baseline = last 200 appearances (any season, any game type). residual_g = GA - shots*(1-0.9); residualStdDev = sample SD over recent 20.
  - Inputs/units: counts; percent or fraction for QS%; sources: forge_goalie_game, wgo_goalie_stats
  - Output scale: counts; goals SD; writes: —
  - Status: live
  - Consumers: computeModeledSavePct; volatility/confidence tiers
- **Codex view (web-lib-projections-utils-number-utils-safestddev, calculation, location; Codex family 'FORGE staged projection math'):** Sample standard deviation (safeStdDev)
  - Purpose: sqrt(sum((x-mean)^2)/(n-1)); zero for ≤1 row.
  - Inputs/units: Numeric observations in same units.
  - Output scale: SD in observation units.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (web-lib-projections-utils-number-utils-sigmoid, calculation, location; Codex family 'FORGE staged projection math'):** Logistic transform (sigmoid)
  - Purpose: 1/(1+exp(-x)).
  - Inputs/units: Dimensionless logit.
  - Output scale: Probability (0,1).
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex web-lib-projections-utils-number-utils-safestddev): {"source": "web/lib/projections/utils/number-utils.ts:62", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["web/lib/projections/utils/number-utils.ts:64 const mean = values.reduce((acc, n) => acc + n, 0) / values.length;", "web/lib/projections/utils/number-utils.ts:65 const variance =", "web/lib/projections/utils/number-utils.ts:66 values.reduce((acc, n) => acc + (n - mean) ** 2, 0) / (values.length - 1);", "web/lib/projections/utils/number-utils.ts:67 return Math.sqrt(Math.max(variance, 0));"]}
  - Intended contract (Codex web-lib-projections-utils-number-utils-sigmoid): {"source": "web/lib/projections/utils/number-utils.ts:70", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["web/lib/projections/utils/number-utils.ts:71 return 1 / (1 + Math.exp(-x));"]}
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/projections/goalieModel.test.ts`; `{"status": "Discovered only; not run", "references": ["No direct symbol/module test reference found in bounded search."]}`
- **Leads (not audited):**
  - (opus) observation: residuals use a fixed 0.900 sv%, not the season league mean, and are in goals (scale with shot volume)
  - (opus) observation: baseline window has no time decay (Marcel-style weighting absent)
  - (opus) observation: wgo_goalie_stats read with lte asOfDate (same-day row possible)
  - (codex:web-lib-projections-utils-number-utils-safestddev) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested."]
  - (codex:web-lib-projections-utils-number-utils-sigmoid) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested."]

## M-FRG-034 Goalie start projections route (L10 share, GSAA/60)

- **Match:** Both; Opus FRG-054; Codex goalie-api-l10_start_pct, goalie-api-projected_gsaa_per_60, goalie-api-season_start_pct
- **Purpose:** Writes start probability and GSAA/60 priors per goalie per game
- **Where:** `web/pages/api/v1/db/update-goalie-projections-v2.ts:351 (game loop)`; `web/pages/api/v1/db/update-goalie-projections-v2.ts:425 (seasonPct/l10Pct/gsaa)`; `web/pages/api/v1/db/update-goalie-projections-v2.ts:426 handler`; `web/pages/api/v1/db/update-goalie-projections-v2.ts:432 handler`; `web/pages/api/v1/db/update-goalie-projections-v2.ts:424 handler`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: per 60, per team game; generation: current
- **Opus view (FRG-054):**
  - Method: Logs filtered gameDate <= game.date (includes the game itself). seasonPct = starts/team games; l10Pct = starts in last 10 team dates/10; start_probability = l10Pct. GSAA = saves - shots*0.900; GSAA/60 = GSAA/minutes*60 (minutes = TOI/60).
  - Inputs/units: TOI seconds; counts; sources: goalie game logs (NHL API via route), rosters, games
  - Output scale: probability 0-1; GSAA per 60; writes: goalie_start_projections
  - Status: live — rolling-forge stage projection_execution
  - Consumers: FORGE starter logit prior; opponent goalie adjustment; goalie starter mixtures; start chart
- **Codex view (goalie-api-l10_start_pct, calculation, location; Codex family 'Goalie prior API arithmetic'):** l10_start_pct / start_probability
  - Purpose: starts in latest 10 unique dates / number of selected dates
  - Inputs/units: NHL goalie logs; actual source filter is gameDate <= target date; timeOnIce seconds /60.
  - Output scale: Source fraction.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "deployment": "Unknown; source inspection only."}
- **Codex view (goalie-api-projected_gsaa_per_60, calculation, location; Codex family 'Goalie prior API arithmetic'):** projected_gsaa_per_60
  - Purpose: (saves-shots*.900)/minutes*60
  - Inputs/units: NHL goalie logs; actual source filter is gameDate <= target date; timeOnIce seconds /60.
  - Output scale: Source goals saved above fixed league baseline per 60 minutes.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "deployment": "Unknown; source inspection only."}
- **Codex view (goalie-api-season_start_pct, calculation, location; Codex family 'Goalie prior API arithmetic'):** season_start_pct
  - Purpose: seasonStarts / number of unique team game dates
  - Inputs/units: NHL goalie logs; actual source filter is gameDate <= target date; timeOnIce seconds /60.
  - Output scale: Source fraction.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "deployment": "Unknown; source inspection only."}
- **Audit context:**
  - Intent (Opus): update-goalie-projections-v2.ts:356-362 inline comment
  - Intended contract (Codex goalie-api-l10_start_pct): {"source": "web/pages/api/v1/db/update-goalie-projections-v2.ts:363", "statement": "Comments explicitly preserve rolling-tally inclusion through game date; distinguish from pregame cutoff-safe models."}
  - Intended contract (Codex goalie-api-projected_gsaa_per_60): {"source": "web/pages/api/v1/db/update-goalie-projections-v2.ts:363", "statement": "Comments explicitly preserve rolling-tally inclusion through game date; distinguish from pregame cutoff-safe models."}
  - Intended contract (Codex goalie-api-season_start_pct): {"source": "web/pages/api/v1/db/update-goalie-projections-v2.ts:363", "statement": "Comments explicitly preserve rolling-tally inclusion through game date; distinguish from pregame cutoff-safe models."}
  - External references: Save% above expected (GSAx uses xG)
  - Fixtures/test data: none listed
  - Tests: `web/__tests__/pages/api/v1/db/update-goalie-projections-v2.test.ts`; `{"status": "Discovered; not run", "references": ["No dedicated test linkage resolved in this bounded pass."]}`
- **Leads (not audited):**
  - (opus) observation: includes the current game in historical rows (comment acknowledges 'peeking') — leakage for backfills/accuracy
  - (opus) observation: start probability ignores rest/B2B/confirmations
  - (opus) observation: GSAA uses fixed 0.900 and is unshrunk; 'projected' is purely historical
  - (opus) observation: TOI unit assumed seconds (/60 -> minutes)
  - (codex:goalie-api-l10_start_pct) ["Deployment and runtime behavior not verified; calculation listed without correctness assessment."]
  - (codex:goalie-api-projected_gsaa_per_60) ["Deployment and runtime behavior not verified; calculation listed without correctness assessment."]
  - (codex:goalie-api-season_start_pct) ["Deployment and runtime behavior not verified; calculation listed without correctness assessment."]

## M-FRG-035 FORGE goalie line backtest: legacy vs new save%/win/shutout model

- **Match:** Both; Opus FRG-056; Codex research-script-predictLegacy-forge-goalie-backtest, research-script-predictNew-forge-goalie-backtest, research-script-scoreModels-forge-goalie-backtest, research-script-scoreWinPopulations-forge-goalie-backtest
- **Purpose:** Score the old and new FORGE goalie projections on starting-goalie rows
- **Where:** `web/scripts/forge-goalie-backtest.ts:103 (predictLegacy)`; `web/scripts/forge-goalie-backtest.ts:123 (predictNew)`; `web/scripts/forge-goalie-backtest.ts:233 (rest)`; `web/scripts/forge-goalie-backtest.ts:300 (scoreWinPopulations)`; `web/scripts/forge-goalie-backtest.ts:372 (scoreModels)`; `web/scripts/forge-goalie-backtest.ts:103 predictLegacy`; `web/scripts/forge-goalie-backtest.ts:123 predictNew`; `web/scripts/forge-goalie-backtest.ts:372 scoreModels`; `web/scripts/forge-goalie-backtest.ts:300 scoreWinPopulations`
- **Tags (heuristic):** percent scale: fraction 0-1; conditionality: conditional; generation: research, development
- **Opus view (FRG-056):**
  - Method: legacy (audit re-derivation): GA = SA*(1-sv%), win = logistic((lambdaFor - GA)/1.25), shutout = exp(-GA). New: sv% = clamp(posteriorSavePct(shots, goals, prior league sv%, priorShots 6000) + rest adjustment, 0.85, 0.94); team win from teamWinProbability(lambdaFor, lambdaAgainst, spreadShrink); optional goalie-adjusted conditional win via goalsAgainstRatio=(1-sv)/(1-league sv); goalie W = P(win\|start)*0.984 (STARTER_DECISION_SHARE); shutout via negative-binomial shot model (nbSize, fullGameProbability); rest flag bits: b2b=1, >=5 GP in 14d=2, >=6 GP=4; candidate populations weight goals-per-shot reference by start probability
  - Inputs/units: save% fraction 0-1 (fixture x1e4), shots x10, lambdas x100 goals; sources: fixture text rows (no DB)
  - Output scale: probabilities 0-1, expected counts; writes: —
  - Status: draft — offline backtest
  - Consumers: FORGE goalie model change review (tasks 7.1/7.2/7.4)
- **Codex view (research-script-predictLegacy-forge-goalie-backtest, symbol_candidate, codex_part_of_opus; Codex family 'Projection fitting and backtest scripts'):** predictLegacy
  - Purpose: Goalie backtest calculation; same-name declaration implements the local diagnostic, preserving separate legacy/new and team/credited-win populations.
  - Inputs/units: Frozen model/projection rows, official labels, rates or exposures per declaration; evaluation units follow target.
  - Output scale: Diagnostic/model quantities returned by named function; see formula evidence.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "deployment": "Unknown; source inspection only."}
- **Codex view (research-script-predictNew-forge-goalie-backtest, symbol_candidate, codex_part_of_opus; Codex family 'Projection fitting and backtest scripts'):** predictNew
  - Purpose: Goalie backtest calculation; same-name declaration implements the local diagnostic, preserving separate legacy/new and team/credited-win populations.
  - Inputs/units: Frozen model/projection rows, official labels, rates or exposures per declaration; evaluation units follow target.
  - Output scale: Diagnostic/model quantities returned by named function; see formula evidence.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "deployment": "Unknown; source inspection only."}
- **Codex view (research-script-scoreModels-forge-goalie-backtest, symbol_candidate, codex_part_of_opus; Codex family 'Projection fitting and backtest scripts'):** scoreModels
  - Purpose: Goalie backtest calculation; same-name declaration implements the local diagnostic, preserving separate legacy/new and team/credited-win populations.
  - Inputs/units: Frozen model/projection rows, official labels, rates or exposures per declaration; evaluation units follow target.
  - Output scale: Diagnostic/model quantities returned by named function; see formula evidence.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "deployment": "Unknown; source inspection only."}
- **Codex view (research-script-scoreWinPopulations-forge-goalie-backtest, symbol_candidate, codex_part_of_opus; Codex family 'Projection fitting and backtest scripts'):** scoreWinPopulations
  - Purpose: Goalie backtest calculation; same-name declaration implements the local diagnostic, preserving separate legacy/new and team/credited-win populations.
  - Inputs/units: Frozen model/projection rows, official labels, rates or exposures per declaration; evaluation units follow target.
  - Output scale: Diagnostic/model quantities returned by named function; see formula evidence.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "deployment": "Unknown; source inspection only."}
- **Audit context:**
  - Intent (Opus): header comment web/scripts/forge-goalie-backtest.ts:1-23
  - Intended contract (Codex research-script-predictLegacy-forge-goalie-backtest): {"source": "web/scripts/forge-goalie-backtest.ts:103", "arithmetic_locations": ["web/scripts/forge-goalie-backtest.ts:104 const goalsAgainst = row.projectedShotsAgainst * (1 - row.legacySavePct);", "web/scripts/forge-goalie-backtest.ts:109 winProbability: 1 / (1 + Math.exp(-(row.lambdaFor - goalsAgainst) / 1.25)),"]}
  - Intended contract (Codex research-script-predictNew-forge-goalie-backtest): {"source": "web/scripts/forge-goalie-backtest.ts:123", "arithmetic_locations": ["web/scripts/forge-goalie-backtest.ts:128 const goalsAgainst = row.projectedShotsAgainst * (1 - savePct);", "web/scripts/forge-goalie-backtest.ts:132 lambdaAgainst: row.lambdaAgainst, goalsAgainstRatio: (1 - savePct) / (1 - row.leagueSavePct) })", "web/scripts/forge-goalie-backtest.ts:138 winProbability: ifStarts * STARTER_DECISION_SHARE,"]}
  - Intended contract (Codex research-script-scoreModels-forge-goalie-backtest): {"source": "web/scripts/forge-goalie-backtest.ts:372", "arithmetic_locations": ["web/scripts/forge-goalie-backtest.ts:383 goalsAgainstOnActualShots: biasRmse(preds.map((p, i) => rows[i].shotsAgainst * (1 - p.savePct)), ga),", "web/scripts/forge-goalie-backtest.ts:388 winMean: preds.reduce((s, p) => s + p.winProbability, 0) / preds.length,", "web/scripts/forge-goalie-backtest.ts:391 shutoutMean: preds.reduce((s, p) => s + p.shutoutProbability, 0) / preds.length,", "web/scripts/forge-goalie-backtest.ts:396 observed: { winRate: w.reduce((s, v) => s + v, 0) / rows.length, shutoutRate: so.reduce((s, v) => s + v, 0) / rows.length,", "web/scripts/forge-goalie-backtest.ts:397 goalsAgainst: ga.reduce((s, v) => s + v, 0) / rows.length },", "web/scripts/forge-goalie-backtest.ts:404 (predictNew(r, options).winProbability - r.win) ** 2 - (predictLegacy(r).winProbability - r.win) ** 2),"]}
  - Intended contract (Codex research-script-scoreWinPopulations-forge-goalie-backtest): {"source": "web/scripts/forge-goalie-backtest.ts:300", "arithmetic_locations": ["web/scripts/forge-goalie-backtest.ts:328 ? group.reduce((s, row, i) => s + Math.max(0, row.startProbability) * (1 - savePcts[i]), 0) / mass", "web/scripts/forge-goalie-backtest.ts:334 lambdaAgainst: row.lambdaAgainst, goalsAgainstRatio: (1 - savePcts[i]) / referenceGoalsPerShot }),"]}
  - External references: Beta-binomial save% shrinkage; Poisson/Skellam win probability
  - Fixtures/test data: none listed
  - Tests: `web/lib/projections/goalie/goalieOutcomes.test.ts`; `web/scripts/forge-goalie-backtest.test.ts`; `{"status": "Discovered; not run", "references": ["web/scripts/forge-goalie-backtest.test.ts"]}`
- **Leads (not audited):**
  - (opus) legacy win uses a logistic of (lambdaFor - goalie GA) with scale 1.25, i.e., mixes team-level goals for with goalie-level goals against
  - (opus) new save% hard-clamped to [0.85, 0.94]
  - (codex:research-script-predictLegacy-forge-goalie-backtest) ["Deployment and runtime behavior not verified; calculation listed without correctness assessment.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:research-script-predictNew-forge-goalie-backtest) ["Deployment and runtime behavior not verified; calculation listed without correctness assessment.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:research-script-scoreModels-forge-goalie-backtest) ["Deployment and runtime behavior not verified; calculation listed without correctness assessment.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:research-script-scoreWinPopulations-forge-goalie-backtest) ["Deployment and runtime behavior not verified; calculation listed without correctness assessment.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-FRG-036 Fantasy-projections season evaluator and settlement

- **Match:** Both; Opus FRG-057; Codex web-lib-fantasy-projections-evaluator-quantiles, web-lib-fantasy-projections-evaluator-targetmultiplier
- **Possible related records (low-confidence location link, unconfirmed):** season-derived-goals_against_average, season-derived-goals_saved_above_expected, season-derived-relief_appearances_goalie, season-derived-save_percentage, season-derived-saves_goalie, season-derived-start_percentage_goalie, season-derived-win_percentage_goalie, web-lib-fantasy-projections-settlement-allocateseasontotaladjustment, web-lib-fantasy-projections-settlement-scoreseasonprimitive, web-lib-fantasy-projections-settlement-seasonskillindex
- **Purpose:** Season artifact per-game means/variances with context multipliers, quantiles and skill index
- **Where:** `web/lib/fantasy-projections/evaluator.ts:281 (targetMultiplier)`; `web/lib/fantasy-projections/evaluator.ts:355 (quantiles)`; `web/lib/fantasy-projections/evaluator.ts:230 (advanced artifact variance)`; `web/lib/fantasy-projections/seasonJobs.ts:98 (quantile)`; `web/lib/fantasy-projections/seasonJobs.ts:200-250 (runtime newcomer prior)`; `web/lib/fantasy-projections/settlement.ts:13 (seasonSkillIndex)`; `web/lib/fantasy-projections/settlement.ts:21 (scoreSeasonPrimitive)`; `web/lib/fantasy-projections/settlement.ts:66 (allocateSeasonTotalAdjustment)`; `web/lib/fantasy-projections/contracts.ts:468-545 (derived goalie/strength totals)`; `web/lib/fantasy-projections/admin.ts:374 (override delta shift of quantiles)`; `web/lib/fantasy-projections/evaluator.ts:355 quantiles`; `web/lib/fantasy-projections/evaluator.ts:281 targetMultiplier`
- **Tags (heuristic):** percent scale: 0-100; denominators: per game; generation: current
- **Opus view (FRG-057):**
  - Method: pace = sqrt(teamPace x oppPace) (each >=0.5); scoring targets x context x pace x venue / oppDefense; goalie SA/GA x context x pace x oppOffense; TOI only context. Quantiles = mean ± 1.2816 sd (floored at 0 except +/-). Newcomer prior = cohort median rates, variance = max(\|rate\|, median var) x 2.25, play prob = cohort 25th pct. Skill index = clamp(50+50*(baseLoss-modelLoss)/baseLoss, 0,100); Brier/log loss with clip 1e-15; 80% interval coverage. Admin overrides shift p10/p50/p90 by the delta.
  - Inputs/units: per-game counts; seconds; sources: player forecast season artifact tables (lib/fantasy-projections/queries.ts)
  - Output scale: counts; quantiles; skill 0-100; writes: player forecast season tables (via seasonJobs/admin)
  - Status: live — player-forecasts season jobs routes
  - Consumers: /api/v1/fantasy-projections/*; /api/v1/player-forecasts/jobs/*
- **Codex view (web-lib-fantasy-projections-evaluator-quantiles, symbol_candidate, codex_part_of_opus; Codex family 'Portable season fantasy projections'):** Quantiles (quantiles)
  - Purpose: Quantiles for portable season fantasy projections. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: function quantiles( means: ProjectionValues, variances: ProjectionValues, population: FantasyProjectionPopulation, maximumGames?: number, ): SeasonGameEvaluation["quantiles"] { const p10: ProjectionValues = {}; const p50: ProjectionValues = {}; const p90: ProjectionValues = {}; for (const [target, mean] of Object.entries(means)) { const deviation = Math.sqrt(Math.max(0, variances[target] ?? 0)); const allowNegative = target === "PLUS_MINUS"; p10[target] = round( allowNegative ? mean - P10_Z * deviation : Math.max(0, mean - P10_Z * deviation), ); p50[target] = round(mean); p90[target] = round(Math.max(p10[target], mean + P10_Z * deviation)); }
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (web-lib-fantasy-projections-evaluator-targetmultiplier, symbol_candidate, codex_part_of_opus; Codex family 'Portable season fantasy projections'):** Target multiplier (targetMultiplier)
  - Purpose: Target multiplier for portable season fantasy projections. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: function targetMultiplier( target: string, population: FantasyProjectionPopulation, team: PortableTeamContext \| undefined, opponent: PortableTeamContext \| undefined, venue?: PortableTeamContext, game?: SeasonGameContext, contextEffect?: NonNullable<PortablePlayerPrior["contextEffects"]>[string], ): number { if ( (population === "goalie" ? GOALIE_ADVANCED_V5_PRIMITIVE_TARGETS : SKATER_ADVANCED_V5_PRIMITIVE_TARGETS ).includes(target as never) ) { return 1; } const pace = Math.sqrt(
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): settlement.ts:1 FANTASY_PROJECTION_SCORING_VERSION; UNDOCUMENTED formulas
  - Intended contract (Codex web-lib-fantasy-projections-evaluator-quantiles): {"source": "web/lib/fantasy-projections/evaluator.ts:355", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["web/lib/fantasy-projections/evaluator.ts:365 const deviation = Math.sqrt(Math.max(0, variances[target] ?? 0));", "web/lib/fantasy-projections/evaluator.ts:368 allowNegative ? mean - P10_Z * deviation : Math.max(0, mean - P10_Z * deviation),", "web/lib/fantasy-projections/evaluator.ts:371 p90[target] = round(Math.max(p10[target], mean + P10_Z * deviation));"]}
  - Intended contract (Codex web-lib-fantasy-projections-evaluator-targetmultiplier): {"source": "web/lib/fantasy-projections/evaluator.ts:281", "explicit_comment": "web/lib/fantasy-projections/evaluator.ts:313 Pace affects event opportunity, not the fixed pool of regulation", "arithmetic_locations": ["web/lib/fantasy-projections/evaluator.ts:298 const pace = Math.sqrt(", "web/lib/fantasy-projections/evaluator.ts:311 const contextualMultiplier = restMultiplier * homeAwayMultiplier;", "web/lib/fantasy-projections/evaluator.ts:321 return contextualMultiplier * pace * Math.max(0.5, opponent?.offenseMultiplier ?? 1);", "web/lib/fantasy-projections/evaluator.ts:350 return (contextualMultiplier * pace * venueMultiplier) / opposingDefense;", "web/lib/fantasy-projections/evaluator.ts:352 return contextualMultiplier * pace * venueMultiplier;"]}
  - External references: Normal approximation intervals; skill scores
  - Fixtures/test data: none listed
  - Tests: `web/lib/fantasy-projections/fantasyProjections.test.ts`; `web/lib/fantasy-projections/scoringSettings.test.ts`; `{"status": "Discovered only; not run", "references": ["No direct symbol/module test reference found in bounded search."]}`; `{"status": "Discovered only; not run", "references": ["modeling/player_forecasts/tests/test_harness.py:3435", "web/lib/fantasy-projections/fantasyProjections.test.ts:553", "web/lib/player-forecasts/evaluation.test.ts:38", "web/lib/player-forecasts/playerForecasts.test.ts:84", "web/lib/projections/uncertainty.test.ts:50", "web/scripts/blsh/currentDryRun.test.ts:35"]}`
- **Leads (not audited):**
  - (opus) observation: skaters divide by opponent defenseMultiplier while goalies multiply by opponent offenseMultiplier — sign convention of multipliers should be verified
  - (opus) observation: advanced-artifact variance mixture algebra reduces to the source variance (net no-op)
  - (opus) observation: Normal quantiles on counts
  - (codex:web-lib-fantasy-projections-evaluator-quantiles) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:web-lib-fantasy-projections-evaluator-targetmultiplier) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-FRG-037 Served forecast ledger build and settlement

- **Match:** Both; Opus FRG-058; Codex served-ledger-source-scoring
- **Purpose:** Record served forecasts with naive controls and market rows, then settle against actuals
- **Where:** `web/lib/player-forecasts/servedForecastLedger.ts:86 (buildLedgerRows)`; `web/lib/player-forecasts/servedForecastLedger.ts:60 (ledgerFantasyPoints)`; `web/lib/player-forecasts/servedForecastLedger.ts:193 (impliedMeanFromMarket)`; `web/lib/player-forecasts/servedForecastLedger.ts:291 (settleLedgerRows)`; `web/pages/api/v1/db/forge-served-forecast-snapshot.ts`; `web/pages/api/v1/db/forge-served-forecast-settle.ts`; `web/lib/player-forecasts/servedForecastLedger.ts:396 scoreLedger`; `web/lib/player-forecasts/servedForecastLedger.ts:332 errorStat`; `web/lib/player-forecasts/servedForecastLedger.ts:345 binaryScore`; `web/lib/player-forecasts/servedForecastLedger.ts:380 fpBins`; `web/lib/player-forecasts/servedForecastLedger.ts:360 scoringRows`; `web/lib/player-forecasts/servedForecastLedger.ts:60 ledgerFantasyPoints`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: per game, per team game, shots on goal; generation: current
- **Opus view (FRG-058):**
  - Method: Sources: bridge_exact, bridge_reaimed, native, naive_last5, naive_season, market. Naive skater = mean of last 5 / season games; naive goalie = start share (team games) x mean saves/GA/SA, win = share x team win chance (0.5 if absent), shutout = share x mean(min(1,SO)). Market implied mean = bisection mean whose P(over\|no push) equals de-vigged market p (60 iterations). Settlement window: served dates D-2..D; dressed = actual row exists.
  - Inputs/units: counts; probabilities; sources: wgo_skater_stats, wgo_goalie_stats, games, forge_runs, prop_market_prices_daily, market_prices_daily
  - Output scale: counts per game; FP; writes: forge_served_forecast_ledger
  - Status: live — snapshot and settle cron routes
  - Consumers: /api/v1/forge/scoreboard; web/scripts/forge-ledger-evaluate.ts
- **Codex view (served-ledger-source-scoring, calculation, location; Codex family 'Served forecast ledger evaluation'):** Per-source count, fantasy-point and goalie-event scoring (scoreLedger)
  - Purpose: Summarize each source on its own settled observed sample. For finite forecast/actual pairs compute MAE=mean(abs(forecast-actual)), signed bias=mean(forecast-actual), RMSE=sqrt(mean((forecast-actual)^2)), expected and actual sums, actual/expected total ratio, and Mincer–Zarnowitz regression actual=intercept+slope*forecast. Slope is covariance sum/forecast centered-squares sum; intercept=actual mean-slope*forecast mean. Separately compute goalie start/win/shutout Brier scores and ten probability-bin means. Report independent-universe coverage, phantoms, expected-FP decile and back-to-back slices.
  - Inputs/units: Settled source/player-game ledger predictions and actuals: skater G/A/PPP/SOG/HIT/BLK counts, goalie SV/GA/SA counts, fantasy points, goalie start/win/shutout probabilities [0,1] and known binary outcomes. Optional fantasy weights are points per category event; optional independent player-game universe contains known/unknown dressed membership. Rest days are calendar-day gaps.
  - Output scale: Per source and player class: n/covered/dressed/phantoms and cohort sizes are counts. MAE, bias, RMSE and MZ intercept have head count or fantasy-point units; expected/actual are cohort totals. MZ slope and actual/expected ratio are dimensionless and not bounded. Probability scores and reliability predicted/observed fractions are [0,1]. Coverage is covered/dressed when known nonzero denominator, otherwise null. Deciles are labels 1..10 and probability bins 0..9. Floating summaries rounded to 4 decimals.
  - Version/status: Checked-in local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f. LEDGER_SOURCES includes bridge_exact, bridge_reaimed, native, naive_last5, naive_season, market; source names are not evidence of live/deployed population. LEDGER_MARKET_ENABLED is true in source only. Inspected source files clean; no tests or execution.
- **Audit context:**
  - Intent (Opus): servedForecastLedger.ts:7 docstring; LEDGER_SCORING_LIMITATIONS
  - Intended contract (Codex served-ledger-source-scoring): web/lib/player-forecasts/servedForecastLedger.ts:394-395 expressly distinguishes own-source observed samples from paired model comparison. Count/FP errors use dressed===true; goalie binary scores use all valid settled known events, including proven nonstarts. Identity-invalid and duplicate-source-key rows excluded. No finite pairs => null errors; constant forecast or n<2 => null MZ; zero forecast total => null ratio. Coverage requires independently captured, fully settled membership, not forecast rows. fpBins uses tied expected-FP midpoint rank only (no actuals), so deciles may be empty; B2B is team_rest_days===1. Missing nonzero-weight heads withhold recomputed FP.
  - External references: Naive persistence baselines; market-implied means
  - Fixtures/test data: none listed
  - Tests: `web/__tests__/pages/api/v1/db/forge-served-forecast-settle.test.ts`; `web/__tests__/pages/api/v1/db/forge-served-forecast-snapshot.test.ts`; `web/lib/player-forecasts/servedForecastLedger.test.ts`; `web/lib/player-forecasts/servedForecastLedger.test.ts:164 scoreLedger suite: signed bias/MAE, coverage/phantoms, tied FP, B2B, goalie reliability and independent no-history universe. Discovered, not run.`; `web/lib/player-forecasts/servedForecastLedger.test.ts:238 duplicate/invalid-key behavior; :265 expected-FP deciles; :291 known nonstart binary scoring. Discovered, not run.`
- **Leads (not audited):**
  - (opus) observation: rest days computed by noon-UTC date difference
  - (opus) observation: 'dressed' inferred from WGO row presence
  - (codex:served-ledger-source-scoring) ["Deployed ledger version, persisted population, active capture, independent universe availability and live coverage not verified.", "These are descriptive evaluation summaries, not predictive qualification, as explicitly stated in LEDGER_SCORING_LIMITATIONS.", "Skater F/D position and expected/actual TOI and PP-TOI are absent from persisted scoring contract; no opportunity/rate decomposition is produced."]

## M-FRG-038 Native goal accounting (team expected goals)

- **Match:** Both; Opus FRG-059; Codex web-lib-projections-nativegoalaccounting-buildnativeplayergoalaccounting, web-lib-projections-nativegoalaccounting-buildnativeteamgoalaccounting
- **Purpose:** Team ES+PP expected goals from serialized player rows, with endpoint-gap disclosure
- **Where:** `web/lib/projections/nativeGoalAccounting.ts:172 (buildNativePlayerGoalAccounting)`; `web/lib/projections/nativeGoalAccounting.ts:223 (buildNativeTeamGoalAccounting)`; `web/lib/projections/stages/skater-stage.ts:3270 (teamGoalAccounting)`; `web/lib/projections/nativeGoalAccounting.ts:172 buildNativePlayerGoalAccounting`; `web/lib/projections/nativeGoalAccounting.ts:223 buildNativeTeamGoalAccounting`
- **Tags (heuristic):** conditionality: conditional; generation: current
- **Opus view (FRG-059):**
  - Method: reportedEsPpMean = sum of serialized 3-dp ES+PP goal means; components for PK, OT, empty-net, shootout left null with reasons; participation integrated only for confirmed 0/1 evidence at horizon 1.
  - Inputs/units: expected goals (3-dp); sources: forge_player_projections rows (in memory)
  - Output scale: expected goal count; writes: forge_team_projections.proj_goals_es/pp, uncertainty.native_goal_accounting
  - Status: live
  - Consumers: teamGoalsByTeamId -> win probability, starter logic, game totals/spread
- **Codex view (web-lib-projections-nativegoalaccounting-buildnativeplayergoalaccounting, symbol_candidate, location; Codex family 'FORGE staged projection math'):** Build native player goal accounting (buildNativePlayerGoalAccounting)
  - Purpose: Integrate only the existing confirmed 0/1 evidence branch, once, for one game. This is given the game is played; native production supplies no pGamePlayed. Legacy availability multipliers and a sum of horizon scalars are not that branch. /
  - Inputs/units: Parameter/type declaration excerpt: export function buildNativePlayerGoalAccounting(row: NativeSkaterGoalRow) { assertScope(row); if (!Number.isSafeInteger(row.player_id) \|\| row.player_id <= 0 \|\| row.proj_goals_pk !== null) { throw new Error("Invalid native player goal identity or unsupported PK output"); } const reportedEsPpMean = sumAvailableReportedMeans([row.proj_goals_es, row.proj_goals_pp]); const selection = row.uncertainty?.model?.skater_selection; // Only EV/availability conflicts affect skater appearance, matching the evidence helper. // Keep the complete conflicts in the stored selection; scope only this participation calculation. const sameDay = selection?.same_day_evidence as { conflicts?: Array<{ dimension?: string }> } \| undefined; const uncertainty = sameDay ? { ...ro…
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (web-lib-projections-nativegoalaccounting-buildnativeteamgoalaccounting, symbol_candidate, location; Codex family 'FORGE staged projection math'):** Build native team goal accounting (buildNativeTeamGoalAccounting)
  - Purpose: Reconcile the serialized contributor rows, never a separately rounded raw sum. A sum of individual conditional means is not a joint team conditional mean. /
  - Inputs/units: Parameter/type declaration excerpt: export function buildNativeTeamGoalAccounting(args: { gameId: number; teamId: number; asOfDate: string; horizonGames: number; currentRosterPlayerIds: readonly number[]; playerRows: readonly NativeSkaterGoalRow[]; }) { assertScope({ game_id: args.gameId, team_id: args.teamId, horizon_games: args.horizonGames, as_of_date: args.asOfDate }); const ids = args.playerRows.map(row => row.player_id); if (new Set(ids).size !== ids.length \|\| args.playerRows.some(row => row.game_id !== args.gameId \|\| row.team_id !== args.teamId \|\| row.horizon_games !== args.horizonGames \|\| row.as_of_date !== args.asOfDate) \|\| new Set(args.currentRosterPlayerIds).size !== args.currentRosterPlayerIds.length \|\| args.currentRosterPlayerIds.some(id => !Number.isSafeInteger(i…
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): nativeGoalAccounting.ts:1 and 168-171 docstrings
  - Intended contract (Codex web-lib-projections-nativegoalaccounting-buildnativeplayergoalaccounting): {"source": "web/lib/projections/nativeGoalAccounting.ts:172", "explicit_comment": "Integrate only the existing confirmed 0/1 evidence branch, once, for one game. This is given the game is played; native production supplies no pGamePlayed. Legacy availability multipliers and a sum of horizon scalars are not that branch. /", "arithmetic_locations": ["web/lib/projections/nativeGoalAccounting.ts:220 /** Reconcile the serialized contributor rows, never a separately rounded raw sum."]}
  - Intended contract (Codex web-lib-projections-nativegoalaccounting-buildnativeteamgoalaccounting): {"source": "web/lib/projections/nativeGoalAccounting.ts:223", "explicit_comment": "Reconcile the serialized contributor rows, never a separately rounded raw sum. A sum of individual conditional means is not a joint team conditional mean. /", "arithmetic_locations": []}
  - External references: Team goal models (full-game incl. EN/OT)
  - Fixtures/test data: none listed
  - Tests: `web/lib/projections/nativeGoalAccounting.test.ts`; `{"status": "Discovered only; not run", "references": ["web/lib/projections/nativeGoalAccounting.test.ts:4"]}`
- **Leads (not audited):**
  - (opus) observation: horizon-scaled sum is then used as a per-game lambda downstream
  - (opus) observation: excludes SH/EN/OT goals (documented as unproved components)
  - (codex:web-lib-projections-nativegoalaccounting-buildnativeplayergoalaccounting) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:web-lib-projections-nativegoalaccounting-buildnativeteamgoalaccounting) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-FRG-039 Native coverage, interval reconciliation and direct conditional count kernels

- **Match:** Both; Opus FRG-060; Codex native-coverage-kernel, web-lib-projections-nativedirectconditionalcounts-reducenativedirectconditionalcounts, web-lib-projections-nativeintervalreconciliation-reconcilenativeintervalgame
- **Possible related records (low-confidence location link, unconfirmed):** web-lib-projections-nativeskaterparticipationresearch-fixedkernelsensitivity
- **Purpose:** Offline proof/validation arithmetic for native player coverage and box-score reconciliation
- **Where:** `web/lib/projections/nativePlayerCoverageKernel.ts:114 (calculateNativePlayerCoverageKernel)`; `web/lib/projections/nativePlayerCoverage.ts:442 (validateNativePlayerCoverage)`; `web/lib/projections/nativeDirectConditionalCounts.ts:54 (reduceNativeDirectConditionalCounts)`; `web/lib/projections/nativeIntervalReconciliation.ts:72 (reconcileNativeIntervalGame)`; `web/lib/projections/nativeGoalLedgerAudit.ts:95 (auditNativeGoalLedger)`; `web/lib/projections/nativeSkaterParticipationResearch.ts:31 (fixedKernelSensitivity)`; `web/lib/projections/nativePlayerCoverageKernel.ts:114 calculateNativePlayerCoverageKernel`; `web/lib/projections/nativeDirectConditionalCounts.ts:54 reduceNativeDirectConditionalCounts`; `web/lib/projections/nativeIntervalReconciliation.ts:72 reconcileNativeIntervalGame`
- **Tags (heuristic):** percent scale: fraction 0-1; conditionality: unconditional; denominators: shots on goal; generation: research, development, current
- **Opus view (FRG-060):**
  - Method: Weighted mixtures must sum to 1 (tol 1e-8); hit exposure guard credit*seconds <= 3900*P(minutes>0); goalie stats = SA x conversion, GA = SA(1-conv)+nonShot; unconditional = g x mass x conditional; rational (BigInt) means over 20 games; interval union seconds and skater-seconds by state; fraction bound sensitivity.
  - Inputs/units: seconds; counts; sources: captured NHL payloads
  - Output scale: validation results; writes: —
  - Status: draft — 'disconnected' offline kernels (file docstrings)
  - Consumers: offline qualification scripts
- **Codex view (native-coverage-kernel, calculation, codex_part_of_opus; Codex family 'Native coverage research'):** Native HIT / goalie scenario coverage arithmetic
  - Purpose: Compute supplied weighted conditional HIT means/rates and goalie start/relief/no-appearance interval means; multiply conditional HIT by game-occurrence and credit probabilities; aggregate goalie/team interval exposures and counts. Gates specification/identity/proof consistency; estimator approval remains not_established.
  - Inputs/units: Caller-bound specification, observed integer HIT/time history, goalie interval scenario weights, conversion probabilities and p(game played)/p(credit).
  - Output scale: HIT counts, seconds, hits/second; goalie start/relief/no-appearance probabilities; conditional/unconditional SA/SV/GA/nonshot-GA/seconds and team guarded/empty-net totals.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "source_state": "Assigned source paths remained clean at final git-status inspection.", "deployment": "Unknown; no live verification."}
- **Codex view (web-lib-projections-nativedirectconditionalcounts-reducenativedirectconditionalcounts, calculation, location; Codex family 'FORGE staged projection math'):** Exact conditional native count means (reduceNativeDirectConditionalCounts)
  - Purpose: Exact integer sums represented as rational strings: 20 credited skater HIT games; goalie SV/GA across classified starts within supplied 20-game frame.
  - Inputs/units: Named model/observation inputs at cited declaration; HIT per credited player-game; SV/GA per start. Research only, no uncertainty or quality assessment. Input count/rate units follow the corresponding named outcome; cutoff timestamps and identity are required where declared.
  - Output scale: HIT per credited player-game; SV/GA per start. Research only, no uncertainty or quality assessment.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": ["native-direct-conditional-count-baseline-v1"], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (web-lib-projections-nativeintervalreconciliation-reconcilenativeintervalgame, symbol_candidate, location; Codex family 'FORGE staged projection math'):** Reconcile native interval game (reconcileNativeIntervalGame)
  - Purpose: Deterministic mechanics for one historical game, conditional on its retained source records.
  - Inputs/units: Parameter/type declaration excerpt: export function reconcileNativeIntervalGame(input: { playByPlay: any; boxscore: any; shiftPages: { revisionId: string; rows: any[] }[]; }) { const pbp = input.playByPlay, box = input.boxscore, gameId = pbp.id; if (!positiveId(gameId) \|\| gameId !== box.id \|\| pbp.season !== box.season \|\| pbp.gameType !== box.gameType \|\| !["OFF", "FINAL"].includes(pbp.gameState) \|\| !["OFF", "FINAL"].includes(box.gameState) \|\| pbp.startTimeUTC !== box.startTimeUTC \|\| !same(pbp.periodDescriptor, box.periodDescriptor) \|\| !positiveId(pbp.homeTeam?.id) \|\| !positiveId(pbp.awayTeam?.id) \|\| pbp.homeTeam.id === pbp.awayTeam.id \|\| !Array.isArray(pbp.plays) \|\| !Array.isArray(pbp.rosterSpots)) throw new Error("Historical PBP/boxscore identity or final state mis…
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": ["native-interval-reconciliation-v1"], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): nativePlayerCoverageKernel.ts:1 docstring
  - Intended contract (Codex native-coverage-kernel): {"source": "web/lib/projections/nativePlayerCoverageKernel.ts:114", "statement": "Compute supplied weighted conditional HIT means/rates and goalie start/relief/no-appearance interval means; multiply conditional HIT by game-occurrence and credit probabilities; aggregate goalie/team interval exposures and counts. Gates specification/identity/proof consistency; estimator approval remains not_established."}
  - Intended contract (Codex web-lib-projections-nativedirectconditionalcounts-reducenativedirectconditionalcounts): {"source": "web/lib/projections/nativeDirectConditionalCounts.ts:54", "explicit_comment": "No selection, exposure transfer, probability multiplication, fitting or qualified C2 admission.", "arithmetic_locations": []}
  - Intended contract (Codex web-lib-projections-nativeintervalreconciliation-reconcilenativeintervalgame): {"source": "web/lib/projections/nativeIntervalReconciliation.ts:72", "explicit_comment": "Deterministic mechanics for one historical game, conditional on its retained source records.", "arithmetic_locations": ["web/lib/projections/nativeIntervalReconciliation.ts:241 total.clockSeconds += span.end - span.start; total.skaterSeconds += (span.end - span.start) * ownSkaters.length; cells.set(key, total);"]}
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/projections/nativeDirectConditionalCounts.test.ts`; `web/lib/projections/nativeGoalLedgerAudit.test.ts`; `web/lib/projections/nativeIntervalReconciliation.test.ts`; `web/lib/projections/nativePlayerCoverage.test.ts`; `web/lib/projections/nativePlayerCoverageKernel.test.ts`; `web/lib/projections/nativeSkaterParticipationResearch.test.ts`; `{"status": "Discovered only; not run", "references": ["web/lib/projections/nativeDirectConditionalCounts.test.ts:3"]}`; `{"status": "Discovered only; not run", "references": ["web/lib/projections/nativeIntervalReconciliation.test.ts:9"]}`; `{"status": "Discovered, not run", "references": ["web/lib/projections/nativePlayerCoverageKernel.test.ts"]}`
- **Leads (not audited):**
  - (codex:native-coverage-kernel) ["No correctness/quality judgment. Active runtime and deployed version unknown."]
  - (codex:web-lib-projections-nativedirectconditionalcounts-reducenativedirectconditionalcounts) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested."]
  - (codex:web-lib-projections-nativeintervalreconciliation-reconcilenativeintervalgame) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-FRG-040 Sportsbook de-vig

- **Match:** Both; Opus FRG-062; Codex web-lib-projections-utils-devig-americantodecimal, web-lib-projections-utils-devig-americantoimpliedprobability, web-lib-projections-utils-devig-devigequalmargin, web-lib-projections-utils-devig-devigproportional, web-lib-projections-utils-devig-devigshin, web-lib-projections-utils-devig-devigtwowayamerican, web-lib-projections-utils-devig-devigyesonly, web-lib-projections-utils-devig-expectedvalueatamericanprice, web-lib-projections-utils-devig-shinprobability
- **Purpose:** Convert American odds to implied probability and remove margin
- **Where:** `web/lib/projections/utils/devig.ts:77 (americanToDecimal)`; `web/lib/projections/utils/devig.ts:106 (devigShin)`; `web/lib/projections/utils/devig.ts:140 (devigProportional)`; `web/lib/projections/utils/devig.ts:150 (devigEqualMargin)`; `web/lib/projections/utils/devig.ts:183 (devigTwoWayAmerican)`; `web/lib/projections/utils/devig.ts:220 (devigYesOnly)`; `web/lib/projections/utils/devig.ts:246 (expectedValueAtAmericanPrice)`; `web/lib/projections/utils/devig.ts:77 americanToDecimal`; `web/lib/projections/utils/devig.ts:82 americanToImpliedProbability`; `web/lib/projections/utils/devig.ts:150 devigEqualMargin`; `web/lib/projections/utils/devig.ts:140 devigProportional`; `web/lib/projections/utils/devig.ts:106 devigShin` …
- **Tags (heuristic):** percent scale: fraction 0-1; generation: current
- **Opus view (FRG-062):**
  - Method: decimal = 1+p/100 (p>0) or 1+100/\|p\|; implied = 1/decimal; invalid in (-100,100). Shin: bisection on insider share z; proportional p/sum; equal-margin subtract (sum-1)/n (fallback proportional if <=0). Valid two-way book sum 0.98-1.35. Yes-only: estimate = implied - overround/2 (default 0.08, env FORGE_YES_ONLY_OVERROUND, max 0.3). EV = p*(decimal-1) - (1-p).
  - Inputs/units: American odds; sources: prop_market_prices_daily, market_prices_daily
  - Output scale: probability 0-1; writes: —
  - Status: live
  - Consumers: compareModelWithMarket; marketTeamWinProbability; served ledger market rows
- **Codex view (web-lib-projections-utils-devig-americantodecimal, symbol_candidate, codex_part_of_opus; Codex family 'FORGE staged projection math'):** American to decimal (americanToDecimal)
  - Purpose: American to decimal for forge staged projection math. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: export function americanToDecimal(price: number \| null \| undefined): number \| null { if (!isValidAmericanPrice(price)) return null; return price > 0 ? 1 + price / 100 : 1 + 100 / -price; }
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (web-lib-projections-utils-devig-americantoimpliedprobability, symbol_candidate, codex_part_of_opus; Codex family 'FORGE staged projection math'):** American to implied probability (americanToImpliedProbability)
  - Purpose: American to implied probability for forge staged projection math. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: export function americanToImpliedProbability( price: number \| null \| undefined, ): number \| null { const decimal = americanToDecimal(price); return decimal == null ? null : 1 / decimal; }
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (web-lib-projections-utils-devig-devigequalmargin, symbol_candidate, codex_part_of_opus; Codex family 'FORGE staged projection math'):** Devig equal margin (devigEqualMargin)
  - Purpose: Devig equal margin for forge staged projection math. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: export function devigEqualMargin(implied: number[]): DevigResult \| null { if (implied.length < 2 \|\| !implied.every(isProbability)) return null; const total = implied.reduce((sum, p) => sum + p, 0); const share = (total - 1) / implied.length; const shifted = implied.map((p) => p - share); // A heavy longshot can go non-positive under additive removal; fall back to proportional. if (!shifted.every((p) => p > 0)) return devigProportional(implied); return { probabilities: shifted, overround: total - 1, method: "equal-margin", }; }
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (web-lib-projections-utils-devig-devigproportional, symbol_candidate, codex_part_of_opus; Codex family 'FORGE staged projection math'):** Devig proportional (devigProportional)
  - Purpose: Devig proportional for forge staged projection math. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: export function devigProportional(implied: number[]): DevigResult \| null { if (implied.length < 2 \|\| !implied.every(isProbability)) return null; const total = implied.reduce((sum, p) => sum + p, 0); return { probabilities: implied.map((p) => p / total), overround: total - 1, method: "proportional", }; }
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (web-lib-projections-utils-devig-devigshin, symbol_candidate, codex_part_of_opus; Codex family 'FORGE staged projection math'):** Devig shin (devigShin)
  - Purpose: Devig shin for forge staged projection math. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: export function devigShin(implied: number[]): DevigResult \| null { if (implied.length < 2 \|\| !implied.every(isProbability)) return null; const total = implied.reduce((sum, p) => sum + p, 0); const overround = total - 1; if (overround <= 0) { // No margin (or an arbitrage): Shin has no positive insider share; normalise. return { probabilities: implied.map((p) => p / total), overround, method: "shin", shinZ: 0, }; } // Sum of Shin probabilities decreases monotonically in z; bisection on [0, 1). const sumAt = (z: number) => implied.reduce((sum, p) => sum + shinProbability(p, total, z), 0); let lo = 0; let hi = 0.999;
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (web-lib-projections-utils-devig-devigtwowayamerican, symbol_candidate, codex_part_of_opus; Codex family 'FORGE staged projection math'):** Devig two way american (devigTwoWayAmerican)
  - Purpose: De-vig a two-way market from its two American prices. Returns null when a price is invalid or the book sum is outside [MIN_VALID_BOOK_SUM, MAX_VALID_BOOK_SUM]. /
  - Inputs/units: Parameter/type declaration excerpt: export function devigTwoWayAmerican( priceA: number \| null \| undefined, priceB: number \| null \| undefined, method: DevigMethod = "shin", ): (DevigResult & { fairA: number; fairB: number }) \| null { const a = americanToImpliedProbability(priceA); const b = americanToImpliedProbability(priceB); if (a == null \|\| b == null) return null; const total = a + b; if (total < MIN_VALID_BOOK_SUM \|\| total > MAX_VALID_BOOK_SUM) return null; const result = devig([a, b], method); if (!result) return null; return { ...result, fairA: result.probabilities[0], fairB: result.probabilities[1], }; }
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (web-lib-projections-utils-devig-devigyesonly, symbol_candidate, codex_part_of_opus; Codex family 'FORGE staged projection math'):** Devig yes only (devigYesOnly)
  - Purpose: Assumption-based P(yes) for a "Yes"-only price under an assumed total overround. "equal-margin" (default): implied - overround / 2, i.e. the price an additive (= two-way Shin) de-vig would give if the hidden "No" side carried the other half of the margin. "proportional": implied / (1 + overround). Equal-margin results at or below zero (extreme longshots) fall back to proportional. /
  - Inputs/units: Parameter/type declaration excerpt: export function devigYesOnly( price: number \| null \| undefined, options: { overround?: number \| null; method?: "equal-margin" \| "proportional"; env?: Record<string, string \| undefined>; } = {}, ): YesOnlyEstimate \| null { const implied = americanToImpliedProbability(price); if (implied == null) return null; const assumption = resolveYesOnlyOverround(options.overround, options.env); if (!assumption) return null; const { overround, source: overroundSource } = assumption; const base = { implied, overround, overroundSource, basis: "assumed-overround" as const }; const proportional = implied / (1 + overround); if (options.method === "proportional") { return { ...base, probability: proportional, method: "proportional" }; }
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (web-lib-projections-utils-devig-expectedvalueatamericanprice, symbol_candidate, codex_part_of_opus; Codex family 'FORGE staged projection math'):** Expected value at american price (expectedValueAtAmericanPrice)
  - Purpose: Expected profit per 1 unit staked at an American price, given a win probability.
  - Inputs/units: Parameter/type declaration excerpt: export function expectedValueAtAmericanPrice( probability: number, price: number \| null \| undefined, ): number \| null { const decimal = americanToDecimal(price); if (decimal == null \|\| !Number.isFinite(probability)) return null; return probability * decimal - 1; }
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (web-lib-projections-utils-devig-shinprobability, symbol_candidate, codex_part_of_opus; Codex family 'FORGE staged projection math'):** Shin probability (shinProbability)
  - Purpose: Shin probability for forge staged projection math. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: function shinProbability(pi: number, total: number, z: number): number { return (Math.sqrt(z * z + (4 * (1 - z) * pi * pi) / total) - z) / (2 * (1 - z)); }
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): utils/devig.ts:1-23 docstring
  - Intended contract (Codex web-lib-projections-utils-devig-americantodecimal): {"source": "web/lib/projections/utils/devig.ts:77", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["web/lib/projections/utils/devig.ts:79 return price > 0 ? 1 + price / 100 : 1 + 100 / -price;"]}
  - Intended contract (Codex web-lib-projections-utils-devig-americantoimpliedprobability): {"source": "web/lib/projections/utils/devig.ts:82", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["web/lib/projections/utils/devig.ts:86 return decimal == null ? null : 1 / decimal;"]}
  - Intended contract (Codex web-lib-projections-utils-devig-devigequalmargin): {"source": "web/lib/projections/utils/devig.ts:150", "explicit_comment": "web/lib/projections/utils/devig.ts:155 A heavy longshot can go non-positive under additive removal; fall back to proportional.", "arithmetic_locations": ["web/lib/projections/utils/devig.ts:153 const share = (total - 1) / implied.length;"]}
  - Intended contract (Codex web-lib-projections-utils-devig-devigproportional): {"source": "web/lib/projections/utils/devig.ts:140", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["web/lib/projections/utils/devig.ts:144 probabilities: implied.map((p) => p / total),"]}
  - Intended contract (Codex web-lib-projections-utils-devig-devigshin): {"source": "web/lib/projections/utils/devig.ts:106", "explicit_comment": "web/lib/projections/utils/devig.ts:111 No margin (or an arbitrage): Shin has no positive insider share; normalise.", "arithmetic_locations": ["web/lib/projections/utils/devig.ts:113 probabilities: implied.map((p) => p / total),", "web/lib/projections/utils/devig.ts:125 const mid = (lo + hi) / 2;", "web/lib/projections/utils/devig.ts:129 const z = (lo + hi) / 2;", "web/lib/projections/utils/devig.ts:133 probabilities: raw.map((p) => p / rawSum),"]}
  - Intended contract (Codex web-lib-projections-utils-devig-devigtwowayamerican): {"source": "web/lib/projections/utils/devig.ts:183", "explicit_comment": "De-vig a two-way market from its two American prices. Returns null when a price is invalid or the book sum is outside [MIN_VALID_BOOK_SUM, MAX_VALID_BOOK_SUM]. /", "arithmetic_locations": ["web/lib/projections/utils/devig.ts:203 /** Assumption-based estimate of P(yes); not an identified fair probability. */", "web/lib/projections/utils/devig.ts:205 /** Raw implied probability of the Yes price (the overround-0 upper bound). */", "web/lib/projections/utils/devig.ts:213 /**"]}
  - Intended contract (Codex web-lib-projections-utils-devig-devigyesonly): {"source": "web/lib/projections/utils/devig.ts:220", "explicit_comment": "Assumption-based P(yes) for a \"Yes\"-only price under an assumed total overround. \"equal-margin\" (default): implied - overround / 2, i.e. the price an additive (= two-way Shin) de-vig would give if the hidden \"No\" side carried the other half of the margin. \"proportional\": implied / (1 + overround). Equal-margin results at or below zero (extreme longshots) fall back to proportional. /", "arithmetic_locations": ["web/lib/projections/utils/devig.ts:234 const proportional = implied / (1 + overround);", "web/lib/projections/utils/devig.ts:238 const equalMargin = implied - overround / 2;", "web/lib/projections/utils/devig.ts:245 /** Expected profit per 1 unit staked at an American price, given a win probability. */"]}
  - Intended contract (Codex web-lib-projections-utils-devig-expectedvalueatamericanprice): {"source": "web/lib/projections/utils/devig.ts:246", "explicit_comment": "Expected profit per 1 unit staked at an American price, given a win probability.", "arithmetic_locations": ["web/lib/projections/utils/devig.ts:252 return probability * decimal - 1;"]}
  - Intended contract (Codex web-lib-projections-utils-devig-shinprobability): {"source": "web/lib/projections/utils/devig.ts:102", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["web/lib/projections/utils/devig.ts:103 return (Math.sqrt(z * z + (4 * (1 - z) * pi * pi) / total) - z) / (2 * (1 - z));"]}
  - External references: Shin (1993); standard de-vig methods
  - Fixtures/test data: none listed
  - Tests: `web/lib/projections/utils/devig.test.ts`; `{"status": "Discovered only; not run", "references": ["web/lib/player-forecasts/servedForecastLedger.test.ts:4", "web/lib/projections/utils/devig.test.ts:10"]}`; `{"status": "Discovered only; not run", "references": ["web/lib/player-forecasts/servedForecastLedger.test.ts:4", "web/lib/projections/utils/devig.test.ts:9"]}`; `{"status": "Discovered only; not run", "references": ["web/lib/projections/utils/devig.test.ts (module test)"]}`; `{"status": "Discovered only; not run", "references": ["web/lib/projections/utils/devig.test.ts:11"]}`; `{"status": "Discovered only; not run", "references": ["web/lib/projections/utils/devig.test.ts:5"]}`; `{"status": "Discovered only; not run", "references": ["web/lib/projections/utils/devig.test.ts:6"]}`; `{"status": "Discovered only; not run", "references": ["web/lib/projections/utils/devig.test.ts:8"]}`
- **Leads (not audited):**
  - (opus) observation: legacy gameGoalProjections averages raw implied odds without de-vig (separate entry)
  - (codex:web-lib-projections-utils-devig-americantodecimal) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:web-lib-projections-utils-devig-americantoimpliedprobability) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:web-lib-projections-utils-devig-devigequalmargin) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:web-lib-projections-utils-devig-devigproportional) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:web-lib-projections-utils-devig-devigshin) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:web-lib-projections-utils-devig-devigtwowayamerican) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:web-lib-projections-utils-devig-devigyesonly) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:web-lib-projections-utils-devig-expectedvalueatamericanprice) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:web-lib-projections-utils-devig-shinprobability) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-FRG-041 Model vs market prop comparison

- **Match:** Both; Opus FRG-063; Codex web-lib-projections-utils-market-output-builders-comparemodelwithmarket, web-lib-projections-utils-market-output-builders-forgepropoverprobability, web-lib-projections-utils-market-output-builders-getmodellineprobabilities, web-lib-projections-utils-market-output-builders-poissonoverprobability
- **Purpose:** Probability-space edge between FORGE count distribution and de-vigged prop prices
- **Where:** `web/lib/projections/utils/market-output-builders.ts:385 (compareModelWithMarket)`; `web/lib/projections/utils/market-output-builders.ts:206 (getModelLineProbabilities)`; `web/lib/projections/utils/market-output-builders.ts:187 (forgePropOverProbability)`; `web/lib/projections/utils/market-output-builders.ts:159 (poissonOverProbability)`; `web/lib/projections/utils/market-output-builders.ts:33 (getProjectionValueForPropMarket)`; `web/lib/projections/queries/market-queries.ts:62 (summary averaging)`; `web/lib/projections/utils/market-output-builders.ts:385 compareModelWithMarket`; `web/lib/projections/utils/market-output-builders.ts:187 forgePropOverProbability`; `web/lib/projections/utils/market-output-builders.ts:206 getModelLineProbabilities`; `web/lib/projections/utils/market-output-builders.ts:159 poissonOverProbability`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: shots on goal; generation: current
- **Opus view (FRG-063):**
  - Method: P(over) from fitted NB (SOG/hits/blocks/saves) else Poisson; push at integer lines = P(X>line-0.5)-P(X>line); overGivenNoPush. Consensus line = most-quoted (ties lower); per-book de-vig (Shin) or Yes-only estimate; market p = median; edge = model - market; flag if \|edge\| >= 0.05 (no model_under when no under offered); EV at best price. Mean-vs-line thresholds: SOG 0.5, G 0.2, A 0.25, PTS 0.35, PPP 0.15, BLK 0.4, saves 1.5.
  - Inputs/units: counts; American odds; sources: prop_market_prices_daily, market_prices_daily
  - Output scale: probability 0-1; edges; writes: player_prediction_outputs, model_market_flags_daily
  - Status: live
  - Consumers: market flag pages; served ledger
- **Codex view (web-lib-projections-utils-market-output-builders-comparemodelwithmarket, symbol_candidate, location; Codex family 'FORGE staged projection math'):** Compare model with market (compareModelWithMarket)
  - Purpose: Compare the model with the market in probability space. Combining books: quotes are grouped by line; the consensus line is the one quoted by the most books (ties go to the lower line). Each two-way book is de-vigged on its own over/under pair (Shin by default); a book with only "yes"/"over" gets devigYesOnly's assumption-based estimate (overround from `yesOnlyOverround`, else FORGE_YES_ONLY_OVERROUND, else the default). The market probability is the median of the per-book values, and the expected value uses the best price on each side. Lines are never averaged across books. No "model_under" flag fires when no book at the line offers an under. /
  - Inputs/units: Parameter/type declaration excerpt: export function compareModelWithMarket(args: { marketType: string; expectedValue: number; quotes: MarketPriceQuote[]; overProbability?: OverProbabilityFn; devigMethod?: DevigMethod; threshold?: number; yesOnlyOverround?: number; }): MarketProbabilityComparison \| null { if (!Number.isFinite(args.expectedValue)) return null; const method = args.devigMethod ?? "shin"; const threshold = args.threshold ?? DEFAULT_PROBABILITY_EDGE_THRESHOLD; type BookSides = { over?: number; under?: number; yes?: number }; const byLine = new Map<number, Map<string, BookSides>>(); for (const quote of args.quotes) { const side = sideOf(quote.outcome_key); if (!side \|\| americanToDecimal(quote.price_american) == null) continue;
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": ["market-context-v1"], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (web-lib-projections-utils-market-output-builders-forgepropoverprobability, symbol_candidate, codex_part_of_opus; Codex family 'FORGE staged projection math'):** Forge prop over probability (forgePropOverProbability)
  - Purpose: P(X > line) from FORGE's fitted count distribution for a player of this position.
  - Inputs/units: Parameter/type declaration excerpt: export function forgePropOverProbability(position: string \| null \| undefined): OverProbabilityFn { return ({ marketType, mean, line }) => { const stat = PROP_MARKET_STATS[marketType]; return stat ? probabilityOverLine(stat, position, mean, line) : poissonOverProbability(mean, line); }; } export type ModelLineProbabilities = { over: number; under: number; push: number; /** P(over \| no push): comparable with de-vigged two-way prices, which refund pushes. */ overGivenNoPush: number; }; /** * Over / under / push probabilities at a line from an injected distribution. * Integer lines can push; push = P(X > line - 0.5) - P(X > line).
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": ["market-context-v1"], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (web-lib-projections-utils-market-output-builders-getmodellineprobabilities, symbol_candidate, codex_part_of_opus; Codex family 'FORGE staged projection math'):** Get model line probabilities (getModelLineProbabilities)
  - Purpose: Over / under / push probabilities at a line from an injected distribution. Integer lines can push; push = P(X > line - 0.5) - P(X > line). /
  - Inputs/units: Parameter/type declaration excerpt: export function getModelLineProbabilities(args: { marketType: string; mean: number; line: number; overProbability?: OverProbabilityFn; }): ModelLineProbabilities \| null { const fn = args.overProbability ?? defaultOverProbability; const over = fn({ marketType: args.marketType, mean: args.mean, line: args.line }); if (over == null \|\| !Number.isFinite(over)) return null; let push = 0; if (Number.isInteger(args.line)) { const atLeast = fn({ marketType: args.marketType, mean: args.mean, line: args.line - 0.5, }); if (atLeast == null \|\| !Number.isFinite(atLeast)) return null; push = Math.max(0, atLeast - over);
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": ["market-context-v1"], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (web-lib-projections-utils-market-output-builders-poissonoverprobability, symbol_candidate, codex_part_of_opus; Codex family 'FORGE staged projection math'):** Poisson over probability (poissonOverProbability)
  - Purpose: Poisson P(X > line) = 1 - CDF(floor(line)).
  - Inputs/units: Parameter/type declaration excerpt: export function poissonOverProbability(mean: number, line: number): number \| null { if (!Number.isFinite(mean) \|\| mean < 0 \|\| !Number.isFinite(line)) return null; if (line < 0) return 1; const k = Math.floor(line); let term = Math.exp(-mean); let cdf = term; for (let i = 1; i <= k; i += 1) { term *= mean / i; cdf += term; } return Math.min(1, Math.max(0, 1 - cdf)); }
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": ["market-context-v1"], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): utils/market-output-builders.ts:136-142 and 373-384 comments
  - Intended contract (Codex web-lib-projections-utils-market-output-builders-comparemodelwithmarket): {"source": "web/lib/projections/utils/market-output-builders.ts:385", "explicit_comment": "Compare the model with the market in probability space. Combining books: quotes are grouped by line; the consensus line is the one quoted by the most books (ties go to the lower line). Each two-way book is de-vigged on its own over/under pair (Shin by default); a book with only \"yes\"/\"over\" gets devigYesOnly's assumption-based estimate (overround from `yesOnlyOverround`, else FORGE_YES_ONLY_OVERROUND, else the default). The market probability is the median of the per-book values, and the expected value uses the best price on each side. Lines are never averaged across books. No \"model_under\" flag fires when no book at the line offers an under. /", "arithmetic_locations": []}
  - Intended contract (Codex web-lib-projections-utils-market-output-builders-forgepropoverprobability): {"source": "web/lib/projections/utils/market-output-builders.ts:187", "explicit_comment": "P(X > line) from FORGE's fitted count distribution for a player of this position.", "arithmetic_locations": ["web/lib/projections/utils/market-output-builders.ts:198 /** P(over \| no push): comparable with de-vigged two-way prices, which refund pushes. */", "web/lib/projections/utils/market-output-builders.ts:202 /**"]}
  - Intended contract (Codex web-lib-projections-utils-market-output-builders-getmodellineprobabilities): {"source": "web/lib/projections/utils/market-output-builders.ts:206", "explicit_comment": "Over / under / push probabilities at a line from an injected distribution. Integer lines can push; push = P(X > line - 0.5) - P(X > line). /", "arithmetic_locations": ["web/lib/projections/utils/market-output-builders.ts:231 overGivenNoPush: decided > 0 ? over / decided : 0,", "web/lib/projections/utils/market-output-builders.ts:235 /** One sportsbook quote; the shape matches rows of (prop_)market_prices_daily. */"]}
  - Intended contract (Codex web-lib-projections-utils-market-output-builders-poissonoverprobability): {"source": "web/lib/projections/utils/market-output-builders.ts:159", "explicit_comment": "Poisson P(X > line) = 1 - CDF(floor(line)).", "arithmetic_locations": ["web/lib/projections/utils/market-output-builders.ts:163 let term = Math.exp(-mean);", "web/lib/projections/utils/market-output-builders.ts:166 term *= mean / i;"]}
  - External references: De-vigged market probability comparison
  - Fixtures/test data: none listed
  - Tests: `web/lib/projections/queries/market-queries.test.ts`; `web/lib/projections/utils/market-output-builders.test.ts`; `{"status": "Discovered only; not run", "references": ["web/lib/player-forecasts/servedForecastLedger.test.ts:5", "web/lib/projections/utils/market-output-builders.test.ts:8"]}`; `{"status": "Discovered only; not run", "references": ["web/lib/projections/utils/market-output-builders.test.ts (module test)"]}`; `{"status": "Discovered only; not run", "references": ["web/lib/projections/utils/market-output-builders.test.ts:6"]}`; `{"status": "Discovered only; not run", "references": ["web/lib/projections/utils/market-output-builders.test.ts:9"]}`
- **Leads (not audited):**
  - (opus) observation: goalie saves expected value is the start-weighted slot value compared with a single-goalie saves line
  - (opus) observation: points/PPP use Poisson on a sum of independent goals and assists
  - (codex:web-lib-projections-utils-market-output-builders-comparemodelwithmarket) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:web-lib-projections-utils-market-output-builders-forgepropoverprobability) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:web-lib-projections-utils-market-output-builders-getmodellineprobabilities) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:web-lib-projections-utils-market-output-builders-poissonoverprobability) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-FRG-042 On-ice context adjustment

- **Match:** Both; Opus FRG-065; Codex web-lib-projections-calculators-skater-adjustments-computeskateronicecontextadjustments, web-lib-projections-calculators-skater-adjustments-computeskatershotqualityadjustments
- **Purpose:** Shot/goal/assist environment multipliers from on-ice xGF/xGA per 60 and CF%
- **Where:** `web/lib/projections/calculators/skater-adjustments.ts:150 (computeSkaterOnIceContextAdjustments)`; `web/lib/projections/calculators/skater-adjustments.ts:74 (normalizeRateOrPercent)`; `web/lib/projections/calculators/skater-adjustments.ts:150 computeSkaterOnIceContextAdjustments`; `web/lib/projections/calculators/skater-adjustments.ts:82 computeSkaterShotQualityAdjustments`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: per 60; generation: current
- **Opus view (FRG-065):**
  - Method: w = (xGF60+xGA60)/(that+2.5). offenseEdge = clamp((xGF60-2.45)/2.45,±0.3); defenseDrag same on xGA60; possessionEdge = clamp((CF-0.5)/0.5,±0.25). shot = clamp(1+w(0.14o+0.10p-0.05d),0.86,1.16); goal = clamp(1+w(0.18o+0.07p-0.06d),0.84,1.2); assist = clamp(1+w(0.20o+0.13p-0.04d),0.82,1.22).
  - Inputs/units: per-60; CF% 0-1 or 0-100 (heuristic); sources: player_stats_unified
  - Output scale: multipliers ~0.82-1.22; writes: —
  - Status: live
  - Consumers: shot rate; goal conversion
- **Codex view (web-lib-projections-calculators-skater-adjustments-computeskateronicecontextadjustments, calculation, location; Codex family 'FORGE staged projection math'):** Skater on-ice environment multipliers (computeSkaterOnIceContextAdjustments)
  - Purpose: Bounded relative offense/defense/possession edges from on-ice xGF/xGA/CF; sample weight=(xGF60+xGA60)/(sum+2.5); weighted sums produce shot/goal/assist multipliers.
  - Inputs/units: On-ice xGF/xGA per60 and possession percentage or fraction (normalized).
  - Output scale: Dimensionless shot/goal/assist environment multipliers; possession fraction; sample weight.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (web-lib-projections-calculators-skater-adjustments-computeskatershotqualityadjustments, calculation, location; Codex family 'FORGE staged projection math'):** Skater shot-quality context multipliers (computeSkaterShotQualityAdjustments)
  - Purpose: Quality=iXG_per60/shots_per60; rush+rebound per60; bounded edges relative to .09 and 1.1; sample weight=shotsPer60/(shotsPer60+5); weighted edge sums adjust shot and goal rates.
  - Inputs/units: NST iXG/shots/rush attempts/rebounds created per 60 minutes.
  - Output scale: qualityPerShot expected goals/shot; rushReboundPer60 events/60; sampleWeight [0,1]; dimensionless shot/goal multipliers.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex web-lib-projections-calculators-skater-adjustments-computeskateronicecontextadjustments): {"source": "web/lib/projections/calculators/skater-adjustments.ts:150", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["web/lib/projections/calculators/skater-adjustments.ts:176 const sampleWeight = clamp(xgSignal / (xgSignal + 2.5), 0, 1);", "web/lib/projections/calculators/skater-adjustments.ts:207 1 + sampleWeight * (offenseEdge * 0.14 + possessionEdge * 0.1 - defenseDrag * 0.05),", "web/lib/projections/calculators/skater-adjustments.ts:212 1 + sampleWeight * (offenseEdge * 0.18 + possessionEdge * 0.07 - defenseDrag * 0.06),", "web/lib/projections/calculators/skater-adjustments.ts:217 1 + sampleWeight * (offenseEdge * 0.2 + possessionEdge * 0.13 - defenseDrag * 0.04),"]}
  - Intended contract (Codex web-lib-projections-calculators-skater-adjustments-computeskatershotqualityadjustments): {"source": "web/lib/projections/calculators/skater-adjustments.ts:82", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["web/lib/projections/calculators/skater-adjustments.ts:108 ? ixgPer60 / shotsPer60", "web/lib/projections/calculators/skater-adjustments.ts:113 const sampleWeight = clamp(shotsSignal / (shotsSignal + 5), 0, 1);", "web/lib/projections/calculators/skater-adjustments.ts:131 1 + sampleWeight * (qualityEdge * 0.05 + rushReboundEdge * 0.08),", "web/lib/projections/calculators/skater-adjustments.ts:136 1 + sampleWeight * (qualityEdge * 0.26 + rushReboundEdge * 0.07),"]}
  - External references: NST on-ice per-60 convention
  - Fixtures/test data: none listed
  - Tests: `web/lib/projections/runProjectionV2.test.ts`; `{"status": "Discovered only; not run", "references": ["web/lib/projections/module-imports.test.ts:10", "web/lib/projections/runProjectionV2.test.ts:21"]}`; `{"status": "Discovered only; not run", "references": ["web/lib/projections/runProjectionV2.test.ts:22"]}`
- **Leads (not audited):**
  - (opus) observation: single latest game row (one-game on-ice rates)
  - (opus) observation: assistEnvironmentMultiplier is computed and stored but the assist model (share x on-ice goals, rescaled to league A/G) does not use it
  - (opus) observation: sampleWeight built from rates, not TOI
  - (codex:web-lib-projections-calculators-skater-adjustments-computeskateronicecontextadjustments) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested."]
  - (codex:web-lib-projections-calculators-skater-adjustments-computeskatershotqualityadjustments) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested."]

## M-FRG-043 Team-level skater context adjustment

- **Match:** Both; Opus FRG-066; Codex context-nst-xga60, web-lib-projections-calculators-skater-adjustments-computeskaterteamlevelcontextadjustments
- **Purpose:** Matchup multipliers for shots/goals/assists from team xG, PDO, opponent 5v5 save% and NST xGA pace
- **Where:** `web/lib/projections/calculators/skater-adjustments.ts:231 (computeSkaterTeamLevelContextAdjustments)`; `web/lib/projections/queries/team-context-queries.ts:339 (fetchTeamStrengthPrior)`; `web/lib/projections/queries/team-context-queries.ts:384 (fetchTeamFiveOnFiveProfile)`; `web/lib/projections/queries/team-context-queries.ts:415 (fetchTeamNstExpectedGoalsProfile)`; `web/lib/projections/queries/team-context-queries.ts:422 calcPer60`; `web/lib/projections/calculators/skater-adjustments.ts:231 computeSkaterTeamLevelContextAdjustments`
- **Tags (heuristic):** denominators: per 60, per game, 5v5 only; generation: current
- **Opus view (FRG-066):**
  - Method: w = clamp(0.35*X/(X+260) + 0.3*G/(G+18) + 0.35*N/(N+40)) with X=sum xGA, G/N games. offenseEdge=clamp((xGF/g-2.95)/2.95,±0.22); defenseLiability same on opp xGA/g; pace=clamp(((teamXGA60+oppXGA60)/2-2.5)/2.5,±0.2); pdoEdge=clamp(PDO-1,±0.08); oppSaveEdge=clamp(0.922-oppSv,±0.03). shot=clamp(1+w(0.14o+0.18d+0.2pace+0.06pdo),0.86,1.18); goal=clamp(1+w(0.16o+0.22d+2.3*oppSave+0.08pace),0.82,1.2); assist=clamp(1+w(0.18o+0.16d+0.12pace+0.08pdo),0.84,1.2).
  - Inputs/units: xG per game; per-60; PDO fraction or percent; sources: nhl_xg_team_rolling_aggregates, nhl_team_data, wgo_team_stats, nst_team_all, nst_team_stats
  - Output scale: multipliers 0.82-1.2; writes: —
  - Status: live
  - Consumers: skater shots/goals; reserve lines; season bootstrap
- **Codex view (context-nst-xga60, calculation, location; Codex family 'FORGE context aggregation'):** NST team xGA per60
  - Purpose: xGA*60/TOI rounded4; unavailable/nonpositive exposure yields null.
  - Inputs/units: NST xGA goals and TOI minutes (formula multiplies by60).
  - Output scale: Expected goals against per60 minutes.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "source_state": "Assigned source paths remained clean at final git-status inspection.", "deployment": "Unknown; no live verification."}
- **Codex view (web-lib-projections-calculators-skater-adjustments-computeskaterteamlevelcontextadjustments, calculation, location; Codex family 'FORGE staged projection math'):** Team/opponent skater context multipliers (computeSkaterTeamLevelContextAdjustments)
  - Purpose: Combine team offense, opponent defensive liability, NST pace proxy, PDO and opponent save-percent edges with three source-support weights and bounded linear effects.
  - Inputs/units: Team/opponent xGF/xGA per game, raw xGA support, 5v5 save/PDO fractions, NST xGA/60 and games.
  - Output scale: Dimensionless shot/goal/assist multipliers, pace/defense edges and [0,1] sample weight.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex context-nst-xga60): {"source": "web/lib/projections/queries/team-context-queries.ts:422", "statement": "xGA*60/TOI rounded4; unavailable/nonpositive exposure yields null."}
  - Intended contract (Codex web-lib-projections-calculators-skater-adjustments-computeskaterteamlevelcontextadjustments): {"source": "web/lib/projections/calculators/skater-adjustments.ts:231", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["web/lib/projections/calculators/skater-adjustments.ts:263 const nstPaceProxy = (teamNstXgaPer60 + opponentNstXgaPer60) / 2;", "web/lib/projections/calculators/skater-adjustments.ts:269 strengthSampleRaw / (strengthSampleRaw + 260) * 0.35 +", "web/lib/projections/calculators/skater-adjustments.ts:270 fiveOnFiveSampleRaw / (fiveOnFiveSampleRaw + 18) * 0.3 +", "web/lib/projections/calculators/skater-adjustments.ts:271 nstSampleRaw / (nstSampleRaw + 40) * 0.35,", "web/lib/projections/calculators/skater-adjustments.ts:276 const offenseEdge = clamp((teamXgfPerGame - TEAM_XG_BASELINE_PER_GAME) / TEAM_XG_BASELINE_PER_GAME, -0.22, 0.22);", "web/lib/projections/calculators/skater-adjustments.ts:277 const defenseLiabilityEdge = clamp((opponentXgaPerGame - TEAM_XG_BASELINE_PER_GAME) / TEAM_XG_BASELINE_PER_GAME, -0.22, 0.22);", "web/lib/projections/calculators/skater-adjustments.ts:278 const paceEdge = clamp((nstPaceProxy - TEAM_NST_XGA_PER60_BASELINE) / TEAM_NST_XGA_PER60_BASELINE, -0.2, 0.2);", "web/lib/…
  - External references: Opponent-adjusted rates (log5 / multiplicative att x def models)
  - Fixtures/test data: none listed
  - Tests: `web/lib/projections/queries/team-context-queries.test.ts`; `web/lib/projections/runProjectionV2.test.ts`; `{"status": "Discovered only; not run", "references": ["web/lib/projections/runProjectionV2.test.ts:23"]}`; `{"status": "Discovered, not run", "references": ["web/lib/projections/queries/team-context-queries.test.ts"]}`
- **Leads (not audited):**
  - (opus) observation: normalizeRateOrPercent here divides any value >1 by 100, so a PDO stored as a fraction (e.g. 1.012) becomes 0.0101 and pdoEdge clamps to -0.08 (team-context-adjustments.ts uses a >2 threshold instead — inconsistent)
  - (opus) observation: team shot multiplier is cancelled by team shot reconciliation to the team's own last-10 shot average
  - (opus) observation: 'pace' uses the team's own xGA, not its xGF
  - (opus) observation: sample weight depends on source window (10-game aggregate xGA ~30 vs season-to-date ~200)
  - (codex:context-nst-xga60) ["No correctness/quality judgment. Active runtime and deployed version unknown."]
  - (codex:web-lib-projections-calculators-skater-adjustments-computeskaterteamlevelcontextadjustments) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested."]

## M-FRG-044 Opponent goalie quality adjustment for skaters

- **Match:** Both; Opus FRG-067; Codex web-lib-projections-calculators-skater-adjustments-computeskateropponentgoaliecontextadjustments
- **Purpose:** Goal/assist multipliers from the opponent's start-weighted projected GSAA/60
- **Where:** `web/lib/projections/calculators/skater-adjustments.ts:308 (computeSkaterOpponentGoalieContextAdjustments)`; `web/lib/projections/queries/goalie-queries.ts:360 (fetchOpponentGoalieContextForGame)`; `web/lib/projections/calculators/skater-adjustments.ts:308 computeSkaterOpponentGoalieContextAdjustments`
- **Tags (heuristic):** denominators: per 60; generation: current
- **Opus view (FRG-067):**
  - Method: Top 3 candidates; weighted GSAA/60 = sum(p*gsaa)/sum(p); certainty = 1 if confirmed else top p; w = mass*(0.45+0.55*certainty); edge = clamp(gsaa/0.6,±1); goal = clamp(1 - 0.18*w*edge, 0.82,1.22); assist = clamp(1-0.11*w*edge, 0.86,1.18). Confirmed override forces p=1.
  - Inputs/units: GSAA per 60 minutes; probabilities 0-1; sources: goalie_start_projections
  - Output scale: multipliers 0.82-1.22; writes: —
  - Status: live
  - Consumers: skater goals; reserve lines; bootstrap context
- **Codex view (web-lib-projections-calculators-skater-adjustments-computeskateropponentgoaliecontextadjustments, calculation, location; Codex family 'FORGE staged projection math'):** Opponent-goalie skater conversion adjustments (computeSkaterOpponentGoalieContextAdjustments)
  - Purpose: Certainty-weight projected GSAA/60 quality edge; goal multiplier=1-.18*sampleWeight*edge; assist=1-.11*sampleWeight*edge, with bounds.
  - Inputs/units: Opponent start probability/mass, confirmation flag and GSAA per60.
  - Output scale: Dimensionless goal/assist multipliers, starter certainty, weighted GSAA/60.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex web-lib-projections-calculators-skater-adjustments-computeskateropponentgoaliecontextadjustments): {"source": "web/lib/projections/calculators/skater-adjustments.ts:308", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["web/lib/projections/calculators/skater-adjustments.ts:331 const sampleWeight = clamp(probabilityMass * (0.45 + 0.55 * starterCertainty), 0, 1);", "web/lib/projections/calculators/skater-adjustments.ts:332 const qualityEdge = weightedGsaa != null ? clamp(weightedGsaa / GOALIE_GSAA_PRIOR_MAX_ABS, -1, 1) : 0;", "web/lib/projections/calculators/skater-adjustments.ts:335 1 + sampleWeight * (-qualityEdge * 0.18),", "web/lib/projections/calculators/skater-adjustments.ts:340 1 + sampleWeight * (-qualityEdge * 0.11),"]}
  - External references: GSAx (xG-based) per 60
  - Fixtures/test data: none listed
  - Tests: `web/lib/projections/runProjectionV2.test.ts`; `{"status": "Discovered only; not run", "references": ["web/lib/projections/runProjectionV2.test.ts:24"]}`
- **Leads (not audited):**
  - (opus) observation: GSAA input comes from update-goalie-projections-v2 = saves - shots*0.900 (fixed league sv%, no shot quality, unshrunk, includes current game for historical rows)
  - (codex:web-lib-projections-calculators-skater-adjustments-computeskateropponentgoaliecontextadjustments) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested."]

## M-FRG-045 Skater rest / schedule adjustment

- **Match:** Both; Opus FRG-068; Codex web-lib-projections-calculators-skater-adjustments-computeskaterrestscheduleadjustments
- **Purpose:** TOI, shot, goal and assist multipliers from team and opponent rest days and home ice
- **Where:** `web/lib/projections/calculators/skater-adjustments.ts:354 (computeSkaterRestScheduleAdjustments)`; `web/lib/projections/queries/team-context-queries.ts:559 (fetchTeamRestDays)`; `web/lib/projections/stages/skater-stage.ts:1945 (buckets: 'legacy')`; `web/lib/projections/calculators/skater-adjustments.ts:354 computeSkaterRestScheduleAdjustments`
- **Tags (heuristic):** generation: legacy, current
- **Opus view (FRG-068):**
  - Method: Rest days = days since previous game (B2B=1). Legacy buckets add +1 (production passes buckets:'legacy'). Missing side = 2. restDelta=clamp((team-opp)/3,±1); teamFatigue 0.11 if <=1, 0.035 if 2; recovery 0.03 if >=4, 0.012 if 3; oppFatigue 0.055/0.018; home +0.012 / away -0.004. toi=clamp(1-tf+rb+0.03Δ+0.6h,0.88,1.1); shot=clamp(1+of-0.35tf+0.045Δ+0.45h,0.86,1.14); goal=clamp(1+0.72of-0.25tf+0.035Δ+0.8h,0.85,1.16); assist=clamp(1+0.5of-0.2tf+0.04Δ+0.55h,0.86,1.15).
  - Inputs/units: days; sources: games
  - Output scale: multipliers 0.85-1.16; writes: —
  - Status: live (legacy bucket mode)
  - Consumers: skater TOI/shots/goals; reserve lines
- **Codex view (web-lib-projections-calculators-skater-adjustments-computeskaterrestscheduleadjustments, calculation, location; Codex family 'FORGE staged projection math'):** Skater rest and venue adjustments (computeSkaterRestScheduleAdjustments)
  - Purpose: Days-since-prior-game buckets: 1 is B2B; combine fatigue/recovery, opponent fatigue, relative rest and home edge into bounded TOI/shot/goal/assist multipliers. Legacy shifted buckets retained for offline backtests.
  - Inputs/units: Team/opponent days since previous game; home flag.
  - Output scale: TOI, shot, goal and assist multipliers; restDelta [-1,1]; sample weight 0 or1.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): calculators/skater-adjustments.ts:358 and 377-380 comments; skater-stage.ts:1944 'Q8 tiers remain unqualified'
  - Intended contract (Codex web-lib-projections-calculators-skater-adjustments-computeskaterrestscheduleadjustments): {"source": "web/lib/projections/calculators/skater-adjustments.ts:354", "explicit_comment": "web/lib/projections/calculators/skater-adjustments.ts:377 Rest days are days since the previous game (fetchTeamRestDays), so a back-to-back is 1,", "arithmetic_locations": ["web/lib/projections/calculators/skater-adjustments.ts:358 /** \"legacy\" reproduces the pre-Q8 buckets (B2B read as 0) for offline backtests only. */", "web/lib/projections/calculators/skater-adjustments.ts:384 const restDelta = clamp((teamRest - oppRest) / 3, -1, 1);", "web/lib/projections/calculators/skater-adjustments.ts:391 1 - teamFatiguePenalty + teamRecoveryBoost + restDelta * 0.03 + homeIceEdge * 0.6,", "web/lib/projections/calculators/skater-adjustments.ts:396 1 + opponentFatigueBoost - teamFatiguePenalty * 0.35 + restDelta * 0.045 + homeIceEdge * 0.45,", "web/lib/projections/calculators/skater-adjustments.ts:401 1 + opponentFatigueBoost * 0.72 - teamFatiguePenalty * 0.25 + restDelta * 0.035 + homeIceEdge * 0.8,", "web/lib/projections/calculators/skater-adjustments.ts:406 1 + opponentFatigueBoost * 0.5 - teamFatiguePenalty * 0.2 + restDelta * 0.04 + homeIceEdge * 0.55,"]}
  - External references: Published B2B effects (~-0.1 to -0.2 goals/team-game)
  - Fixtures/test data: none listed
  - Tests: `web/lib/projections/runProjectionV2.test.ts`; `{"status": "Discovered only; not run", "references": ["web/lib/projections/runProjectionV2.test.ts:25", "web/scripts/forge-counterfactual-backtest.test.ts:10"]}`
- **Leads (not audited):**
  - (opus) observation: production passes buckets:'legacy', which per the code comment is 'for offline backtests only'; in legacy a B2B (rest 1) is read as 2 (mild fatigue 0.035 not 0.11)
  - (opus) observation: TOI multiplier and shot multiplier are both renormalised away by team reconciliation
  - (codex:web-lib-projections-calculators-skater-adjustments-computeskaterrestscheduleadjustments) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested."]

## M-FRG-046 Small-sample shrinkage weight

- **Match:** Both; Opus FRG-069; Codex web-lib-projections-calculators-skater-adjustments-computeskatersampleshrinkageadjustments
- **Purpose:** Evidence weight used to shrink TOI and goal conversion toward priors for thin samples
- **Where:** `web/lib/projections/calculators/skater-adjustments.ts:423 (computeSkaterSampleShrinkageAdjustments)`; `web/lib/projections/stages/skater-stage.ts:2163 (shrunkToiEs/Pp)`; `web/lib/projections/stages/skater-stage.ts:2297 (goalRateEs shrink)`; `web/lib/projections/reserveProjections.ts:63`; `web/lib/projections/calculators/skater-adjustments.ts:423 computeSkaterSampleShrinkageAdjustments`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: per game; generation: current
- **Opus view (FRG-069):**
  - Method: toiW = T/(T+900) with T = ev+pp TOI (SKATER_SMALL_SAMPLE_TOI_SECONDS_SCALE=900); shotW = S/(S+45); sampleWeight = 0.58*toiW + 0.42*shotW. isLowSample <0.45, callup fallback <0.22. Shrunk TOI = w*adjustedTOI + (1-w)*season avg TOI; goal rate = w*splitRate + (1-w)*F/D prior.
  - Inputs/units: seconds (per-game average) and shot counts (cumulative); sources: rolling_player_game_metrics
  - Output scale: weight 0-1; writes: —
  - Status: live
  - Consumers: skater TOI; goal conversion; reserve lines; uncertainty metadata
- **Codex view (web-lib-projections-calculators-skater-adjustments-computeskatersampleshrinkageadjustments, calculation, location; Codex family 'FORGE staged projection math'):** Small-sample confidence/shrinkage weight (computeSkaterSampleShrinkageAdjustments)
  - Purpose: sampleWeight=.58*TOI/(TOI+900)+.42*shots/(shots+45), bounded and rounded; low-sample below .45, callup fallback below .22.
  - Inputs/units: EV+PP historical seconds and shot counts.
  - Output scale: [0,1] evidence weight, low-sample/callup flags, evidence seconds/shots.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): stages/skater-stage.ts:2289-2293 comment (task 4 / task 9)
  - Intended contract (Codex web-lib-projections-calculators-skater-adjustments-computeskatersampleshrinkageadjustments): {"source": "web/lib/projections/calculators/skater-adjustments.ts:423", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["web/lib/projections/calculators/skater-adjustments.ts:437 evidenceToiSeconds / (evidenceToiSeconds + SKATER_SMALL_SAMPLE_TOI_SECONDS_SCALE),", "web/lib/projections/calculators/skater-adjustments.ts:442 evidenceShots / (evidenceShots + SKATER_SMALL_SAMPLE_SHOTS_SCALE),", "web/lib/projections/calculators/skater-adjustments.ts:446 const sampleWeight = Number(clamp(toiEvidenceWeight * 0.58 + shotEvidenceWeight * 0.42, 0, 1).toFixed(4));", "web/lib/projections/calculators/skater-adjustments.ts:457 /**"]}
  - External references: Tango regression to the mean (k = exposure where reliability = 0.5)
  - Fixtures/test data: none listed
  - Tests: `web/lib/projections/reserveProjections.test.ts`; `web/lib/projections/runProjectionV2.test.ts`; `{"status": "Discovered only; not run", "references": ["web/lib/projections/runProjectionV2.test.ts:26"]}`
- **Leads (not audited):**
  - (opus) observation: TOI evidence uses toi_seconds_avg_all (a per-game AVERAGE, ~800-1200 s) against a 900 s scale, so toiW is ~0.5 for nearly every player regardless of games played (likely unit mismatch: average vs cumulative)
  - (opus) observation: goal rate is shrunk twice (prior-strength k in blendOnlineRate, then this weight) — acknowledged in comment at skater-stage.ts:2292
  - (codex:web-lib-projections-calculators-skater-adjustments-computeskatersampleshrinkageadjustments) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested."]

## M-FRG-047 Hits and blocks per 60 (physical rates)

- **Match:** Both; Opus FRG-070; Codex web-lib-projections-calculators-skater-adjustments-computeskaterphysicaleventrates
- **Purpose:** All-situation hits/blocks per 60 blended recent vs three-season baseline shrunk to position prior with league rescale
- **Where:** `web/lib/projections/calculators/skater-adjustments.ts:467 (computeSkaterPhysicalEventRates)`; `web/lib/projections/constants/projection-weights.ts:93-109`; `web/lib/projections/queries/skater-queries.ts:448 (fetchLeaguePhysicalTotals)`; `web/lib/projections/stages/skater-stage.ts:2807`; `web/lib/projections/calculators/skater-adjustments.ts:467 computeSkaterPhysicalEventRates`
- **Tags (heuristic):** denominators: per 60, per game; generation: current
- **Opus view (FRG-070):**
  - Method: Position priors: F hits 4.9, blocks 2.1; D hits 3.2, blocks 4.4 per 60. League per60 = (60*events + prior60*S)/(minutes + S), S=9000 (F)/5750 (D) minutes; scale = clamp(per60/prior60,0.7,1.3). Baseline = (seasonEvents + 0.5*scale*(events3y - seasonEvents))*60 + priorMin*ref) / (seasonMin + 0.5*(min3y-seasonMin) + priorMin), priorMin hits 50 / blocks 300. Recent weight = m5/(m5+240) hits, m5/(m5+1000) blocks. Projected = rate x (ES+PP TOI x clamp(allTOI5/esPpTOI,1,1.3))/3600.
  - Inputs/units: per-60; seconds; event counts; sources: rolling_player_game_metrics (all strength), rpc forge_league_skater_physical_totals
  - Output scale: hits/blocks per game; writes: forge_player_projections.proj_hits/proj_blocks
  - Status: live
  - Consumers: fantasy points; uncertainty; market (blocked shots)
- **Codex view (web-lib-projections-calculators-skater-adjustments-computeskaterphysicaleventrates, calculation, location; Codex family 'FORGE staged projection math'):** All-situation hits and blocks rates (computeSkaterPhysicalEventRates)
  - Purpose: Blend recent L5 rates with current+half-weight prior-two-season baseline, position pseudo-minutes, and bounded league-rate rescaling; restore unmodeled PK exposure via all-TOI/(ES+PP TOI) capped1.3.
  - Inputs/units: Historical hits/blocks, TOI seconds, current-season split, position F/D and league totals.
  - Output scale: hitsPer60,blocksPer60; recent weights [0,1]; league scale [.7,1.3]; TOI multiplier[1,1.3].
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): constants/projection-weights.ts:87-109 comments (fit by Poisson deviance on games 2-30)
  - Intended contract (Codex web-lib-projections-calculators-skater-adjustments-computeskaterphysicaleventrates): {"source": "web/lib/projections/calculators/skater-adjustments.ts:467", "explicit_comment": "All-situation hits and blocks per 60 from the all-strength rolling row, which falls back to official NHL counts where NST logs are missing. The last-5 rate is blended toward a baseline of this season plus the two prior seasons at half weight, shrunk to a position prior, so a thin window of zeros lowers a line instead of zeroing it. Prior-season events are rescaled to this season's league rate to date (shrunk toward the prior two seasons' and bounded), because league hit and block rates drift between seasons. Without league totals the constant position priors stand in and nothing is rescaled. /", "arithmetic_locations": ["web/lib/projections/calculators/skater-adjustments.ts:487 const recentMinutes = nonNegative(row?.toi_seconds_total_last5) / 60;", "web/lib/projections/calculators/skater-adjustments.ts:488 const hitsRecentWeight = recentMinutes / (recentMinutes + SKATER_PHYSICAL_RECENT_SHRINK_MINUTES.hits);", "web/lib/projections/calculators/skater-adjustments.ts:489 const blocksRecentWeight = recentMinutes / (recentMinutes + SKATER_PHYSICAL_RECENT_SHRINK_MINUTES.blocks);", "web/lib/projec…
  - External references: Marcel-style weighting; Poisson deviance fit (code comment)
  - Fixtures/test data: `web/scripts/fixtures/forge-counterfactual-backtest/`; `web/scripts/fixtures/forge-reconstruction-backtest/`
  - Tests: `web/lib/projections/runProjectionV2.test.ts`; `{"status": "Discovered only; not run", "references": ["web/lib/projections/queries/skater-queries.test.ts:35", "web/lib/projections/runProjectionV2.test.ts:49"]}`
- **Leads (not audited):**
  - (opus) observation: PK time is not projected; physical TOI uses ES+PP x recent all-situation ratio capped 1.3
  - (opus) observation: hit/block counts are rink-scorer dependent; no venue adjustment here (fantasy-projections evaluator has venue multipliers)
  - (codex:web-lib-projections-calculators-skater-adjustments-computeskaterphysicaleventrates) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested."]

## M-FRG-048 Assist share and team assist allocation

- **Match:** Both; Opus FRG-071; Codex web-lib-projections-calculators-skater-adjustments-allocateteamassists, web-lib-projections-calculators-skater-adjustments-computeskaterassistshare
- **Purpose:** Assists = on-ice team goals x assist share, scaled so team assists per goal match league
- **Where:** `web/lib/projections/calculators/skater-adjustments.ts:586 (computeSkaterAssistShare)`; `web/lib/projections/stages/skater-stage.ts:2753 (assistTeam)`; `web/lib/projections/stages/skater-stage.ts:2766 (assistScaleEs/Pp)`; `web/lib/projections/calculators/skater-adjustments.ts:612 (allocateTeamAssists, test-only)`; `web/lib/projections/constants/projection-weights.ts:113`; `web/lib/projections/calculators/skater-adjustments.ts:612 allocateTeamAssists`; `web/lib/projections/calculators/skater-adjustments.ts:586 computeSkaterAssistShare`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: per game; generation: current
- **Opus view (FRG-071):**
  - Method: onIceGoalsHist = (G+A)/(IPP/100); share = (A + k*prior)/(onIceGoals + k): F es 0.3747 k=258, F pp 0.3554 k=58, D es 0.2782 k=309, D pp 0.4838 k=84; clamp 0.02-0.9; x trend and teammate coupling multipliers. Team goals = sum(shots x goalRate). onIce_i = teamGoals*5*toi_i/teamToi. raw = sum(onIce*share); scale = 1.65 (ES) or 1.91 (PP) x teamGoals / raw; assists_i = onIce_i*share_i*scale.
  - Inputs/units: counts; IPP percent; sources: rolling_player_game_metrics
  - Output scale: assists per game; writes: forge_player_projections.proj_assists_es/pp
  - Status: live
  - Consumers: points; PPP; fantasy points; reserve lines
- **Codex view (web-lib-projections-calculators-skater-adjustments-allocateteamassists, calculation, location; Codex family 'FORGE staged projection math'):** Team-goal-constrained assist allocation (allocateTeamAssists)
  - Purpose: Raw player assists=teamGoals*5*playerTOI/teamTOI*assistShare; rescale team sum to 1.65 ES or1.91 PP assists per goal.
  - Inputs/units: Player ES/PP TOI in consistent units, projected goals, assist shares.
  - Output scale: ES/PP expected assist counts per player.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (web-lib-projections-calculators-skater-adjustments-computeskaterassistshare, calculation, location; Codex family 'FORGE staged projection math'):** On-ice assist share (computeSkaterAssistShare)
  - Purpose: Infer onIceGoals=(goals+assists)/(IPP_percent/100); shrink assisted goals to position/strength prior: (assisted+k*share)/(onIceGoals+k), clamp .02-.9.
  - Inputs/units: Goals, assists counts; IPP 0-100 percentage; F/D position and ES/PP strength.
  - Output scale: Assist share fraction and inferred historical on-ice-goal count.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): stages/skater-stage.ts:2749-2751 and skater-adjustments.ts:580 comments
  - Intended contract (Codex web-lib-projections-calculators-skater-adjustments-allocateteamassists): {"source": "web/lib/projections/calculators/skater-adjustments.ts:612", "explicit_comment": "Assists come from the goals scored while a skater is on the ice: team goals at each strength x his share of the five skater slots x his assist share, scaled so the team's assists per goal match the league's at that strength. Returns per-player ES and PP assists in input order. /", "arithmetic_locations": ["web/lib/projections/calculators/skater-adjustments.ts:616 const team = { goalsEs: sum(p => p.goalsEs), goalsPp: sum(p => p.goalsPp), toiEs: sum(p => p.toiEs), toiPp: sum(p => p.toiPp) };", "web/lib/projections/calculators/skater-adjustments.ts:617 const onIceEs = (toi: number) => (team.toiEs > 0 ? (team.goalsEs * 5 * toi) / team.toiEs : 0);", "web/lib/projections/calculators/skater-adjustments.ts:618 const onIcePp = (toi: number) => (team.toiPp > 0 ? (team.goalsPp * 5 * toi) / team.toiPp : 0);", "web/lib/projections/calculators/skater-adjustments.ts:619 const rawEs = sum(p => onIceEs(p.toiEs) * p.assistShareEs);", "web/lib/projections/calculators/skater-adjustments.ts:620 const rawPp = sum(p => onIcePp(p.toiPp) * p.assistSharePp);", "web/lib/projections/calculators/skater-adjustments.ts:…
  - Intended contract (Codex web-lib-projections-calculators-skater-adjustments-computeskaterassistshare): {"source": "web/lib/projections/calculators/skater-adjustments.ts:586", "explicit_comment": "The share of a skater's on-ice goals he assists, shrunk to the F/D prior for that strength. History is the rolling all-window: goals plus assists over IPP (a percentage) gives his on-ice goals. Missing or non-positive IPP leaves the prior. /", "arithmetic_locations": ["web/lib/projections/calculators/skater-adjustments.ts:600 onIceGoals = (goals + assists) / (ipp / 100);", "web/lib/projections/calculators/skater-adjustments.ts:603 const share = (assisted + prior.k * prior.share) / (onIceGoals + prior.k);", "web/lib/projections/calculators/skater-adjustments.ts:607 /**"]}
  - External references: IPP / on-ice point shares; NHL ~1.7 assists per goal
  - Fixtures/test data: `tasks/artifacts/forge-priors-2026-10-22`
  - Tests: `web/lib/projections/runProjectionV2.test.ts`; `{"status": "Discovered only; not run", "references": ["web/lib/projections/runProjectionV2.test.ts:49"]}`
- **Leads (not audited):**
  - (opus) observation: IPP assumed to be a percent (0-100); a fraction-stored IPP would inflate onIceGoals 100x
  - (opus) observation: team scale cancels any uniform multiplier, so team-level/opp-goalie/rest assist multipliers (passed as assistRateMultiplier) have no effect on lineup assists
  - (opus) observation: computeStrengthSplitConversionRates still computes assist-per-goal rates that are unused by the lineup path
  - (codex:web-lib-projections-calculators-skater-adjustments-allocateteamassists) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested."]
  - (codex:web-lib-projections-calculators-skater-adjustments-computeskaterassistshare) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested."]

## M-FRG-049 Skater shot rate per 60 (shrunk)

- **Match:** Both; Opus FRG-072; Codex web-lib-projections-calculators-skater-adjustments-computeskatershotrateper60, web-lib-projections-utils-number-utils-computerate, web-lib-projections-utils-number-utils-computeshotsfromrate
- **Purpose:** Per-strength shots on goal per 60 shrunk to F/D priors by measured hours
- **Where:** `web/lib/projections/calculators/skater-adjustments.ts:634 (computeSkaterShotRatePer60)`; `web/lib/projections/constants/projection-weights.ts:127 (SKATER_SHOT_RATE_PRIORS)`; `web/lib/projections/stages/skater-stage.ts:2194`; `web/lib/projections/utils/number-utils.ts:18 (computeShotsFromRate)`; `web/lib/projections/calculators/skater-adjustments.ts:634 computeSkaterShotRatePer60`; `web/lib/projections/utils/number-utils.ts:26 computeRate`; `web/lib/projections/utils/number-utils.ts:18 computeShotsFromRate`
- **Tags (heuristic):** denominators: per 60, per game; generation: current
- **Opus view (FRG-072):**
  - Method: Priors (2023-24..2025-26 NST logs, k from split halves): F es 6.62/60 k=8.4 h, F pp 11.23 k=10.3 h; D es 4.11 k=12.3 h, D pp 8.39 k=5 h. hoursAll = shotsAll/ratePer60All. base = (shotsAll + k*prior)/(hoursAll + k). Recent: w = h5/(h5+k); rate = base + w*(shots5/h5 - base). Then x product of shot-quality, on-ice, team-level and rest multipliers; clamp ES 1.5-20, PP 2-28; role bounds. Shots = rate/60 * TOI minutes.
  - Inputs/units: shots counts; per-60 rates; TOI seconds; sources: rolling_player_game_metrics
  - Output scale: shots per 60, shots per game; writes: —
  - Status: live
  - Consumers: reconciliation; uncertainty; market comparisons
- **Codex view (web-lib-projections-calculators-skater-adjustments-computeskatershotrateper60, calculation, location; Codex family 'FORGE staged projection math'):** Position/strength shot-rate shrinkage (computeSkaterShotRatePer60)
  - Purpose: All-window shots shrunk to per60 prior with kHours; blend recent rate using recentHours/(recentHours+kHours).
  - Inputs/units: F/D position, ES/PP; shots counts, existing per60 rate, recent TOI seconds.
  - Output scale: Projected shots per60.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (web-lib-projections-utils-number-utils-computerate, calculation, location; Codex family 'FORGE staged projection math'):** Safe numerator/exposure ratio (computeRate)
  - Purpose: numerator/denominator when finite and denominator>0; otherwise provided fallback.
  - Inputs/units: Numerator count/value and compatible denominator.
  - Output scale: Rate in numerator units per denominator unit.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (web-lib-projections-utils-number-utils-computeshotsfromrate, calculation, location; Codex family 'FORGE staged projection math'):** TOI-to-shot expectation (computeShotsFromRate)
  - Purpose: TOI_seconds*sogPer60/3600.
  - Inputs/units: Projected TOI seconds; shots per60 minutes.
  - Output scale: Expected shots.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): constants/projection-weights.ts:121-122 comment; tasks/artifacts/forge-priors-2026-10-22
  - Intended contract (Codex web-lib-projections-calculators-skater-adjustments-computeskatershotrateper60): {"source": "web/lib/projections/calculators/skater-adjustments.ts:634", "explicit_comment": "Shots per 60 at one strength: the all-window rate shrunk to the F/D prior by its hours, then the last five games blended in by their own hours against the same prior strength. Exposure comes from shots over rate (all) and summed TOI (last five); a window without exposure adds nothing. /", "arithmetic_locations": ["web/lib/projections/calculators/skater-adjustments.ts:644 const hoursAll = shotsAll != null && shotsAll > 0 && rateAll != null && rateAll > 0 ? shotsAll / rateAll : 0;", "web/lib/projections/calculators/skater-adjustments.ts:645 const base = ((hoursAll > 0 ? shotsAll! : 0) + prior.kHours * prior.per60) / (hoursAll + prior.kHours);", "web/lib/projections/calculators/skater-adjustments.ts:648 const hoursRecent = toiRecent / 3600;", "web/lib/projections/calculators/skater-adjustments.ts:649 const weight = hoursRecent / (hoursRecent + prior.kHours);", "web/lib/projections/calculators/skater-adjustments.ts:650 return base + weight * (shotsRecent / hoursRecent - base);"]}
  - Intended contract (Codex web-lib-projections-utils-number-utils-computerate): {"source": "web/lib/projections/utils/number-utils.ts:26", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["web/lib/projections/utils/number-utils.ts:34 return numerator / denom;"]}
  - Intended contract (Codex web-lib-projections-utils-number-utils-computeshotsfromrate): {"source": "web/lib/projections/utils/number-utils.ts:18", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["web/lib/projections/utils/number-utils.ts:22 const toiMinutes = toiSeconds / 60;", "web/lib/projections/utils/number-utils.ts:23 return (sogPer60 / 60) * toiMinutes;"]}
  - External references: Tango regression to mean; NST per-60 convention
  - Fixtures/test data: `tasks/artifacts/forge-priors-2026-10-22`
  - Tests: `web/lib/projections/runProjectionV2.test.ts`; `{"status": "Discovered only; not run", "references": ["No direct symbol/module test reference found in bounded search."]}`; `{"status": "Discovered only; not run", "references": ["web/lib/projections/nativeGoalAccounting.test.ts:7"]}`; `{"status": "Discovered only; not run", "references": ["web/lib/projections/runProjectionV2.test.ts:49"]}`
- **Leads (not audited):**
  - (opus) observation: last-5 games are inside the all-window and are blended in again (double counting recent games)
  - (opus) observation: hoursAll is implied from shots/rate, undefined when shots=0 (falls back to prior only)
  - (codex:web-lib-projections-calculators-skater-adjustments-computeskatershotrateper60) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested."]
  - (codex:web-lib-projections-utils-number-utils-computerate) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested."]
  - (codex:web-lib-projections-utils-number-utils-computeshotsfromrate) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested."]

## M-FRG-050 Goal conversion (goals per shot) by strength

- **Match:** Both; Opus FRG-073; Codex web-lib-projections-calculators-skater-adjustments-computestrengthsplitconversionrates, web-lib-projections-utils-number-utils-blendonlinerate
- **Purpose:** Shrunk ES/PP goals-per-shot with recent blend and context multipliers
- **Where:** `web/lib/projections/calculators/skater-adjustments.ts:653 (computeStrengthSplitConversionRates)`; `web/lib/projections/utils/number-utils.ts:37 (blendOnlineRate)`; `web/lib/projections/constants/projection-weights.ts:123 (SKATER_GOAL_CONVERSION_PRIORS)`; `web/lib/projections/stages/skater-stage.ts:2297`; `web/lib/projections/calculators/skater-adjustments.ts:653 computeStrengthSplitConversionRates`; `web/lib/projections/utils/number-utils.ts:37 blendOnlineRate`
- **Tags (heuristic):** generation: current
- **Opus view (FRG-073):**
  - Method: Priors: F es 0.1181 k=423 shots, F pp 0.1589 k=155; D es 0.0537 k=704, D pp 0.0862 k=73. base=(goalsAll+k*prior)/(shotsAll+k); recent weight = shots5/(shots5+k); blended clamp ES 0.025-0.24, PP 0.04-0.36; x (shotQuality x onIce x teamLevel x oppGoalie x rest) goal multipliers, clamp ES 0.02-0.3 PP 0.03-0.45. Then skater-stage re-shrinks: rate = w*rate + (1-w)*prior (w = sample weight), clamp ES 0.025-0.3 PP 0.04-0.45, x trend multiplier. Goals = shots x rate.
  - Inputs/units: goal and shot counts; sources: rolling_player_game_metrics
  - Output scale: goals per shot 0.02-0.45; writes: forge_player_projections.proj_goals_es/pp
  - Status: live
  - Consumers: assist allocation; team goals; uncertainty; accuracy
- **Codex view (web-lib-projections-calculators-skater-adjustments-computestrengthsplitconversionrates, calculation, location; Codex family 'FORGE staged projection math'):** ES/PP goal and assist conversion rates (computeStrengthSplitConversionRates)
  - Purpose: Shrink goals/shots and assists/(goals*declared denominator) with positional or adaptive pseudo-counts, apply supplied multipliers and clamps. Explicit per_goal versus per_two_goals legacy scales remain separate.
  - Inputs/units: Recent/all ES/PP goals, shots, assists; dimensionless context multipliers; F/D and denominator mode.
  - Output scale: goalRateEs/Pp goals/shot; assistRateEs/Pp assists per declared goal denominator.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (web-lib-projections-utils-number-utils-blendonlinerate, calculation, location; Codex family 'FORGE staged projection math'):** Prior-shrunk recent rate (blendOnlineRate)
  - Purpose: base=(baseNumerator+fallback*k)/(baseDenom+k); recent=nRecent/dRecent; blend with weight=dRecent/(dRecent+k); clamp bounds.
  - Inputs/units: Recent/baseline numerators/exposures, fallback rate, prior pseudo-exposure, rate bounds.
  - Output scale: Rate in numerator per denominator unit.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): calculators/skater-adjustments.ts:647 docstring; constants/projection-weights.ts:121
  - Intended contract (Codex web-lib-projections-calculators-skater-adjustments-computestrengthsplitconversionrates): {"source": "web/lib/projections/calculators/skater-adjustments.ts:653", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["web/lib/projections/calculators/skater-adjustments.ts:669 /** With a position, goals per shot shrink to the F/D prior by its measured shots (task 4). */", "web/lib/projections/calculators/skater-adjustments.ts:685 const shrinkFactor = opts.evidenceScale / (denom + opts.evidenceScale);", "web/lib/projections/calculators/skater-adjustments.ts:686 const scaled = opts.baseStrength * (0.35 + 1.35 * shrinkFactor);", "web/lib/projections/calculators/skater-adjustments.ts:712 evidenceDenom: Math.max(0, args.evGoalsAll * evPerDenominator) + Math.max(0, args.evGoalsRecent * evPerDenominator),", "web/lib/projections/calculators/skater-adjustments.ts:719 evidenceDenom: Math.max(0, args.ppGoalsAll * ppPerDenominator) + Math.max(0, args.ppGoalsRecent * ppPerDenominator),", "web/lib/projections/calculators/skater-adjustments.ts:747 recentDenom: args.evGoalsRecent * evPerDenominator,", "web/lib/projections/calculators/skater-adjustments.ts:749 baseDenom: args.evGoalsAll * evPerDenominator,", "web/lib/projecti…
  - Intended contract (Codex web-lib-projections-utils-number-utils-blendonlinerate): {"source": "web/lib/projections/utils/number-utils.ts:37", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["web/lib/projections/utils/number-utils.ts:48 opts.baseNumerator + opts.fallback * opts.priorStrength,", "web/lib/projections/utils/number-utils.ts:54 opts.recentDenom / (opts.recentDenom + opts.priorStrength),", "web/lib/projections/utils/number-utils.ts:58 const blended = baseRate + weight * (recentRate - baseRate);"]}
  - External references: Tango regression to mean; shooting% reliability (~375-400 shots for forwards)
  - Fixtures/test data: `tasks/artifacts/forge-priors-2026-10-22`; `web/scripts/fixtures/forge-counterfactual-backtest/`; `web/scripts/fixtures/forge-reconstruction-backtest/`
  - Tests: `web/lib/projections/runProjectionV2.alignedConversion.test.ts`; `web/lib/projections/runProjectionV2.test.ts`; `{"status": "Discovered only; not run", "references": ["No direct symbol/module test reference found in bounded search."]}`; `{"status": "Discovered only; not run", "references": ["web/lib/projections/runProjectionV2.alignedConversion.test.ts:5", "web/lib/projections/runProjectionV2.test.ts:27"]}`
- **Leads (not audited):**
  - (opus) observation: recent last-5 shots counted in both base and recent blend
  - (opus) observation: up to five multiplicative context goal multipliers compound (code notes ~1.3 for some skaters)
  - (opus) observation: second shrink with a weight that is ~0.5 for everyone (see small-sample entry)
  - (codex:web-lib-projections-calculators-skater-adjustments-computestrengthsplitconversionrates) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested."]
  - (codex:web-lib-projections-utils-number-utils-blendonlinerate) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested."]

## M-FRG-051 Shot-quality adjustment

- **Match:** Both; Opus FRG-074; Codex web-lib-projections-calculators-skater-adjustments-computeskatershotqualityadjustments
- **Purpose:** Shot-rate and goal-rate multipliers from ixG per shot and rush+rebound rates
- **Where:** `web/lib/projections/calculators/skater-adjustments.ts:82 (computeSkaterShotQualityAdjustments)`; `web/lib/projections/queries/skater-queries.ts:550 (fetchLatestSkaterContextProfiles)`; `web/lib/projections/calculators/skater-adjustments.ts:82 computeSkaterShotQualityAdjustments`
- **Tags (heuristic):** denominators: per 60; generation: current
- **Opus view (FRG-074):**
  - Method: qualityPerShot = ixG60/shots60; sampleWeight = shots60/(shots60+5); qualityEdge = clamp((q-0.09)/0.09, ±0.35); rushReboundEdge = clamp((rush60+reb60-1.1)/1.1, ±0.5). shot mult = clamp(1+w*(0.05*qE+0.08*rrE), 0.82,1.2); goal mult = clamp(1+w*(0.26*qE+0.07*rrE), 0.78,1.3).
  - Inputs/units: per-60 rates; sources: player_stats_unified
  - Output scale: multipliers 0.82-1.2 / 0.78-1.3; writes: —
  - Status: live
  - Consumers: shot rate; goal conversion
- **Codex view (web-lib-projections-calculators-skater-adjustments-computeskatershotqualityadjustments, calculation, location; Codex family 'FORGE staged projection math'):** Skater shot-quality context multipliers (computeSkaterShotQualityAdjustments)
  - Purpose: Quality=iXG_per60/shots_per60; rush+rebound per60; bounded edges relative to .09 and 1.1; sample weight=shotsPer60/(shotsPer60+5); weighted edge sums adjust shot and goal rates.
  - Inputs/units: NST iXG/shots/rush attempts/rebounds created per 60 minutes.
  - Output scale: qualityPerShot expected goals/shot; rushReboundPer60 events/60; sampleWeight [0,1]; dimensionless shot/goal multipliers.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex web-lib-projections-calculators-skater-adjustments-computeskatershotqualityadjustments): {"source": "web/lib/projections/calculators/skater-adjustments.ts:82", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["web/lib/projections/calculators/skater-adjustments.ts:108 ? ixgPer60 / shotsPer60", "web/lib/projections/calculators/skater-adjustments.ts:113 const sampleWeight = clamp(shotsSignal / (shotsSignal + 5), 0, 1);", "web/lib/projections/calculators/skater-adjustments.ts:131 1 + sampleWeight * (qualityEdge * 0.05 + rushReboundEdge * 0.08),", "web/lib/projections/calculators/skater-adjustments.ts:136 1 + sampleWeight * (qualityEdge * 0.26 + rushReboundEdge * 0.07),"]}
  - External references: MoneyPuck/Evolving-Hockey ixG per shot
  - Fixtures/test data: none listed
  - Tests: `web/lib/projections/queries/skater-queries.test.ts`; `web/lib/projections/runProjectionV2.test.ts`; `{"status": "Discovered only; not run", "references": ["web/lib/projections/module-imports.test.ts:10", "web/lib/projections/runProjectionV2.test.ts:21"]}`
- **Leads (not audited):**
  - (opus) observation: profile is the single latest player_stats_unified row (one game's per-60 values, comment 'per-game actuals'), so the multiplier is driven by one game
  - (opus) observation: sampleWeight uses a per-60 rate as if it were a sample size
  - (opus) observation: baseline 0.09 ixG/shot not position-specific
  - (codex:web-lib-projections-calculators-skater-adjustments-computeskatershotqualityadjustments) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested."]

## M-FRG-052 Research goal kernels and skater-candidate accounting (offline)

- **Match:** Both; Opus FRG-075; Codex web-lib-projections-researchgamegoals-calibratedappearanceprobabilities
- **Possible related records (low-confidence location link, unconfirmed):** web-lib-projections-research-skater-candidates-accounting-nonnegative, web-lib-projections-research-skater-candidates-accounting-reconcileteamassists, web-lib-projections-research-skater-candidates-accounting-shrinkrate, web-lib-projections-research-skater-candidates-context-ablatecontexts, web-lib-projections-research-skater-candidates-context-opportunitycountmoments, web-lib-projections-research-skater-candidates-context-projectcontext, web-lib-projections-research-skater-candidates-priors-estimatepositionprior, web-lib-projections-research-skater-candidates-priors-fitsplithalfk, web-lib-projections-researchgoalbaseline-estimateresearchplayergoals
- **Purpose:** Offline research estimators for per-appearance goals, appearance probabilities, priors and context ablation
- **Where:** `web/lib/projections/researchGameGoals.ts:9 (RESEARCH_GAME_GOALS_PARAMETERS)`; `web/lib/projections/researchGameGoals.ts:165 (calibratedAppearanceProbabilities)`; `web/lib/projections/researchGoalBaseline.ts:27 (estimateResearchPlayerGoals)`; `web/lib/projections/research/skater-candidates/priors.ts:54 (estimatePositionPrior)`; `web/lib/projections/research/skater-candidates/priors.ts:67 (fitSplitHalfK)`; `web/lib/projections/research/skater-candidates/accounting.ts:13 (shrinkRate)`; `web/lib/projections/research/skater-candidates/accounting.ts:73 (reconcileTeamAssists)`; `web/lib/projections/research/skater-candidates/context.ts:12 (projectContext)`; `web/lib/projections/research/skater-candidates/context.ts:43 (opportunityCountMoments)`; `web/lib/projections/researchGameGoals.ts:164 calibratedAppearanceProbabilities`
- **Tags (heuristic):** conditionality: conditional; denominators: per appearance; generation: research, development, current
- **Opus view (FRG-075):**
  - Method: Goal cells (24 disjoint REG/OT x net-state x skater-state); smoothed appearance p = (n+0.5)/(N+1); conditional means shrink with 1 pseudo-appearance to population; logit-shift calibration so sum p = expected roster count (bisection ±40); own/opponent blend 0.5/0.5. Split-half k fit minimising RMSE. shrinkRate = (events + mean*k)/(exposure + k). Capped proportional assist allocation with capacity = onIceGoals - goals. opportunity moments var = mean + r^2 Var(T).
  - Inputs/units: counts; seconds; sources: captured official revisions (research manifests)
  - Output scale: counts per appearance; writes: —
  - Status: draft — offline research only
  - Consumers: web/scripts/evaluate-research-game-goals.ts; web/scripts/forge-skater-candidate-ablation.ts; lib/forecast-diagnostics/frozenResearchPair.ts
- **Codex view (web-lib-projections-researchgamegoals-calibratedappearanceprobabilities, symbol_candidate, codex_part_of_opus; Codex family 'FORGE staged projection math'):** Calibrated appearance probabilities (calibratedAppearanceProbabilities)
  - Purpose: Calibrated appearance probabilities for forge staged projection math. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: function calibratedAppearanceProbabilities(probabilities: number[], expectedCount: number) { if (expectedCount <= 0) return probabilities.map(() => 0); if (expectedCount >= probabilities.length) return probabilities.map(() => 1); const shifted = (offset: number) => probabilities.map(p => 1 / (1 + Math.exp(-(Math.log(p / (1 - p)) + offset)))); let low = -40, high = 40; for (let i = 0; i < 70; i++) { const middle = (low + high) / 2; if (sum(shifted(middle)) < expectedCount) low = middle; else high = middle; } return shifted((low + high) / 2); }
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": ["research-recent-window-game-goals-v1"], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): accounting.ts:1 'Offline candidates only'; context.ts:1
  - Intended contract (Codex web-lib-projections-researchgamegoals-calibratedappearanceprobabilities): {"source": "web/lib/projections/researchGameGoals.ts:164", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["web/lib/projections/researchGameGoals.ts:167 const shifted = (offset: number) => probabilities.map(p => 1 / (1 + Math.exp(-(Math.log(p / (1 - p)) + offset))));", "web/lib/projections/researchGameGoals.ts:170 const middle = (low + high) / 2;", "web/lib/projections/researchGameGoals.ts:171 if (sum(shifted(middle)) < expectedCount) low = middle; else high = middle;", "web/lib/projections/researchGameGoals.ts:173 return shifted((low + high) / 2);"]}
  - External references: Empirical Bayes; split-half reliability
  - Fixtures/test data: none listed
  - Tests: `web/lib/projections/research/skater-candidates/accounting.test.ts`; `web/lib/projections/research/skater-candidates/context.test.ts`; `web/lib/projections/research/skater-candidates/priors.test.ts`; `web/lib/projections/researchGameGoals.test.ts`; `web/lib/projections/researchGoalBaseline.test.ts`; `{"status": "Discovered only; not run", "references": ["web/lib/projections/researchGameGoals.test.ts (module test)"]}`
- **Leads (not audited):**
  - (codex:web-lib-projections-researchgamegoals-calibratedappearanceprobabilities) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-FRG-053 Teammate assist coupling

- **Match:** Both; Opus FRG-077; Codex web-lib-projections-stages-skater-stage-computeteammateassistcoupling
- **Purpose:** Assist-share multiplier from linemate shot share and PP share
- **Where:** `web/lib/projections/stages/skater-stage.ts:1108 (computeTeammateAssistCoupling)`; `web/lib/projections/stages/skater-stage.ts:1108 computeTeammateAssistCoupling`
- **Tags (heuristic):** generation: current
- **Opus view (FRG-077):**
  - Method: playerShare=clamp(ps/team,0,0.5); lineShare=clamp(group/team,0,0.85); mateShare=clamp(line-player,0,0.75); tierW TOP 1, MIDDLE 0.72, else 0.48; lineDep=clamp(1.65*mate*tierW,0,0.5); ppDep=clamp(ppShare*(0.9+0.35tierW),0,0.65); ES mult=clamp(1+0.62(lineDep-0.14),0.82,1.2); PP mult=clamp(1+0.75(ppDep-0.18),0.8,1.24).
  - Inputs/units: shot counts; shares 0-1; sources: —
  - Output scale: multipliers 0.8-1.24; writes: —
  - Status: live
  - Consumers: assist share
- **Codex view (web-lib-projections-stages-skater-stage-computeteammateassistcoupling, symbol_candidate, location; Codex family 'FORGE staged projection math'):** Compute teammate assist coupling (computeTeammateAssistCoupling)
  - Purpose: Compute teammate assist coupling for forge staged projection math. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: export function computeTeammateAssistCoupling(args: { roleTag: SkaterRoleTag \| null; playerShotsEs: number; lineGroupShotsEs: number; teamShotsEs: number; playerPpShare: number; }): SkaterTeammateAssistCoupling { const roleTag = args.roleTag; const teamShotsEs = Math.max(0, args.teamShotsEs); const playerShotsEs = Math.max(0, args.playerShotsEs); const lineGroupShotsEs = Math.max(0, args.lineGroupShotsEs); const playerPpShare = clamp(args.playerPpShare, 0, 1); if (teamShotsEs <= 0) { return { assistRateEsMultiplier: 1, assistRatePpMultiplier: 1, dependencyScore: 0,
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex web-lib-projections-stages-skater-stage-computeteammateassistcoupling): {"source": "web/lib/projections/stages/skater-stage.ts:1108", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["web/lib/projections/stages/skater-stage.ts:1129 const playerEsShare = clamp(playerShotsEs / teamShotsEs, 0, 0.5);", "web/lib/projections/stages/skater-stage.ts:1130 const lineShare = clamp(lineGroupShotsEs / teamShotsEs, 0, 0.85);", "web/lib/projections/stages/skater-stage.ts:1138 const lineDependency = clamp(lineMateShare * 1.65 * tierWeight, 0, 0.5);", "web/lib/projections/stages/skater-stage.ts:1140 playerPpShare * (0.9 + 0.35 * tierWeight),", "web/lib/projections/stages/skater-stage.ts:1145 lineDependency * 0.6 + ppDependency * 0.4,", "web/lib/projections/stages/skater-stage.ts:1151 1 + (lineDependency - 0.14) * 0.62,", "web/lib/projections/stages/skater-stage.ts:1156 1 + (ppDependency - 0.18) * 0.75,"]}
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/projections/runProjectionV2.test.ts`; `{"status": "Discovered only; not run", "references": ["web/lib/projections/runProjectionV2.test.ts:29"]}`
- **Leads (not audited):**
  - (opus) observation: line group key is role string (L1..), so 'linemates' are whoever shares the role label
  - (codex:web-lib-projections-stages-skater-stage-computeteammateassistcoupling) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-FRG-054 Skater role scenarios and horizon scenario blend

- **Match:** Both; Opus FRG-078; Codex web-lib-projections-calculators-scenario-blending-blendskaterscenariostatlinesacrosshorizon, web-lib-projections-calculators-scenario-blending-scenariorolescoringmultiplier, web-lib-projections-stages-skater-stage-buildskaterrolescenarios
- **Purpose:** Mixture of current/adjacent/depth role scenarios that scales goals and assists
- **Where:** `web/lib/projections/stages/skater-stage.ts:821 (buildSkaterRoleScenarios)`; `web/lib/projections/calculators/scenario-blending.ts:45 (scenarioRoleScoringMultiplier)`; `web/lib/projections/calculators/scenario-blending.ts:134 (blendSkaterScenarioStatLinesAcrossHorizon)`; `web/lib/projections/skaterRollout.ts:12 (resolveSkaterRolloutConfig)`; `web/lib/projections/calculators/scenario-blending.ts:134 blendSkaterScenarioStatLinesAcrossHorizon`; `web/lib/projections/calculators/scenario-blending.ts:45 scenarioRoleScoringMultiplier`; `web/lib/projections/stages/skater-stage.ts:821 buildSkaterRoleScenarios`
- **Tags (heuristic):** denominators: per game; generation: current
- **Opus view (FRG-078):**
  - Method: P(current)=clamp(0.55+0.3*share-0.2*vol,0.45,0.9); P(adjacent)=clamp(0.28-0.12*share+0.18*vol,0.08,0.42); P(depth)=clamp(1-cur-adj,0.03,0.25); merge duplicates, normalise. Scenario multiplier: same family delta=currentRank-scenarioRank: goal=clamp(1+0.07*delta,0.82,1.2), assist=clamp(1+0.09*delta,0.8,1.24); cross-family 0.97. Per horizon game, reversion toward uniform = clamp(0.18*i + 0.12*vol, 0, 0.75). Blended stat = sum over games and scenarios of (scalar/sumScalars)*p*base*mult. Used only when FORGE_SKATER_MODEL_MODE=candidate; baseline mode keeps base lines (scenario mixture also feeds uncertainty only in candidate).
  - Inputs/units: probabilities 0-1; goal/assist counts; sources: —
  - Output scale: goal/assist counts per game; writes: forge_player_projections.uncertainty.model.skater_selection.role_scenarios
  - Status: flagged off — FORGE_SKATER_MODEL_MODE must equal 'candidate' (skaterRollout.ts:12); default 'baseline'
  - Consumers: skater stat line (candidate mode); buildPlayerUncertainty mixture
- **Codex view (web-lib-projections-calculators-scenario-blending-blendskaterscenariostatlinesacrosshorizon, symbol_candidate, location; Codex family 'FORGE staged projection math'):** Blend skater scenario stat lines across horizon (blendSkaterScenarioStatLinesAcrossHorizon)
  - Purpose: Blend skater scenario stat lines across horizon for forge staged projection math. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: export function blendSkaterScenarioStatLinesAcrossHorizon(args: { currentRole: string \| null; scenarios: SkaterRoleScenario[]; baseGoalsEs: number; baseGoalsPp: number; baseAssistsEs: number; baseAssistsPp: number; horizonScalars: number[]; roleContinuity: RoleContinuitySummary \| null; }): SkaterScenarioHorizonBlendResult { const scalars = args.horizonScalars.length > 0 ? args.horizonScalars : [1]; const scenarioSeed = args.scenarios.length > 0 ? args.scenarios : [ { role: args.currentRole ?? "L4", probability: 1,
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (web-lib-projections-calculators-scenario-blending-scenariorolescoringmultiplier, symbol_candidate, location; Codex family 'FORGE staged projection math'):** Scenario role scoring multiplier (scenarioRoleScoringMultiplier)
  - Purpose: Scenario role scoring multiplier for forge staged projection math. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: function scenarioRoleScoringMultiplier( currentRole: string \| null, scenarioRole: string ): { goal: number; assist: number; } { const current = currentRole ? parseRoleRank(currentRole) : { family: null, rank: null }; const scenario = parseRoleRank(scenarioRole); if ( current.family == null \|\| scenario.family == null \|\| current.rank == null \|\| scenario.rank == null \|\| current.family !== scenario.family ) {
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (web-lib-projections-stages-skater-stage-buildskaterrolescenarios, symbol_candidate, location; Codex family 'FORGE staged projection math'):** Build skater role scenarios (buildSkaterRoleScenarios)
  - Purpose: Build skater role scenarios for forge staged projection math. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: export function buildSkaterRoleScenarios(args: { roleTag: SkaterRoleTag \| null; roleContinuity: SkaterRoleContinuitySummary \| null; maxScenarios?: number; }): SkaterRoleScenario[] { const maxScenarios = Number.isFinite(args.maxScenarios) ? Math.max(1, Math.floor(Number(args.maxScenarios))) : 3; const currentRole = args.roleTag?.esRole ?? "L4"; const continuityShare = args.roleContinuity?.continuityShare ?? 0.55; const volatility = args.roleContinuity?.volatilityIndex ?? 0.4; const currentProb = clamp( 0.55 + continuityShare * 0.3 - volatility * 0.2, 0.45, 0.9, ); const adjacentProb = clamp(
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): skaterRollout.ts:41 SKATER_ROLLOUT_GOVERNANCE acceptance criteria
  - Intended contract (Codex web-lib-projections-calculators-scenario-blending-blendskaterscenariostatlinesacrosshorizon): {"source": "web/lib/projections/calculators/scenario-blending.ts:134", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["web/lib/projections/calculators/scenario-blending.ts:163 ? clamp(s.probability / baseNormDenom, 0, 1)", "web/lib/projections/calculators/scenario-blending.ts:164 : 1 / scenarioSeed.length", "web/lib/projections/calculators/scenario-blending.ts:166 const baseUniformProb = 1 / baseNorm.length;", "web/lib/projections/calculators/scenario-blending.ts:184 gameIndex * ROLE_SCENARIO_REVERSION_PER_GAME +", "web/lib/projections/calculators/scenario-blending.ts:185 volatility * ROLE_SCENARIO_VOLATILE_REVERSION_BONUS,", "web/lib/projections/calculators/scenario-blending.ts:192 (1 - reversion) * s.probability + reversion * baseUniformProb,", "web/lib/projections/calculators/scenario-blending.ts:201 probability: s.probability / gameProbDenom", "web/lib/projections/calculators/scenario-blending.ts:218 const goalsEs = args.baseGoalsEs * mult.goal;"]}
  - Intended contract (Codex web-lib-projections-calculators-scenario-blending-scenariorolescoringmultiplier): {"source": "web/lib/projections/calculators/scenario-blending.ts:45", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["web/lib/projections/calculators/scenario-blending.ts:66 const goal = clamp(1 + delta * 0.07, 0.82, 1.2);", "web/lib/projections/calculators/scenario-blending.ts:67 const assist = clamp(1 + delta * 0.09, 0.8, 1.24);"]}
  - Intended contract (Codex web-lib-projections-stages-skater-stage-buildskaterrolescenarios): {"source": "web/lib/projections/stages/skater-stage.ts:821", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["web/lib/projections/stages/skater-stage.ts:834 0.55 + continuityShare * 0.3 - volatility * 0.2,", "web/lib/projections/stages/skater-stage.ts:839 0.28 - continuityShare * 0.12 + volatility * 0.18,", "web/lib/projections/stages/skater-stage.ts:879 (sum > 0 ? s.probability / sum : 1 / normalized.length).toFixed(4),"]}
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/projections/runProjectionV2.test.ts`; `web/lib/projections/skaterRollout.test.ts`; `{"status": "Discovered only; not run", "references": ["No direct symbol/module test reference found in bounded search."]}`; `{"status": "Discovered only; not run", "references": ["web/lib/projections/runProjectionV2.test.ts:36"]}`; `{"status": "Discovered only; not run", "references": ["web/lib/projections/runProjectionV2.test.ts:38"]}`
- **Leads (not audited):**
  - (opus) observation: all non-current scenarios have multipliers <1 (adjacent role is always lower rank, depth fallback lower), so candidate mode biases goals/assists downward
  - (opus) observation: reversion is toward a uniform scenario distribution, not toward the current role
  - (codex:web-lib-projections-calculators-scenario-blending-blendskaterscenariostatlinesacrosshorizon) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:web-lib-projections-calculators-scenario-blending-scenariorolescoringmultiplier) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:web-lib-projections-stages-skater-stage-buildskaterrolescenarios) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-FRG-055 Skater recency multiplier and active-pool filter

- **Match:** Both; Opus FRG-079; Codex web-lib-projections-stages-skater-stage-computeskaterrecencymultiplier, web-lib-projections-utils-season-recency-regularseasonrecencydays
- **Purpose:** Down-weight or drop skaters whose latest metric is stale, measured in regular-season days
- **Where:** `web/lib/projections/stages/skater-stage.ts:884 (computeSkaterRecencyMultiplier)`; `web/lib/projections/stages/skater-stage.ts:900 (filterActiveSkaterCandidateIds)`; `web/lib/projections/utils/season-recency.ts:13 (regularSeasonRecencyDays)`; `web/lib/projections/stages/skater-stage.ts:884 computeSkaterRecencyMultiplier`; `web/lib/projections/utils/season-recency.ts:13 regularSeasonRecencyDays`
- **Tags (heuristic):** generation: current
- **Opus view (FRG-079):**
  - Method: Regular-season days between last game and cutoff (only days inside regular-season intervals count). <=21 days ->1; >45 -> 0 (excluded); linear between to minimum 0.15. Multiplies TOI and shots. Pool target 18, min valid 15, supplemental fetch 24; emergency inclusion when <15.
  - Inputs/units: days; sources: rolling_player_game_metrics, games, seasons
  - Output scale: multiplier 0.15-1 (0 = excluded); writes: —
  - Status: live
  - Consumers: skater stage
- **Codex view (web-lib-projections-stages-skater-stage-computeskaterrecencymultiplier, symbol_candidate, location; Codex family 'FORGE staged projection math'):** Compute skater recency multiplier (computeSkaterRecencyMultiplier)
  - Purpose: Compute skater recency multiplier for forge staged projection math. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: function computeSkaterRecencyMultiplier(daysSinceLastMetric: number): number { if (daysSinceLastMetric <= SKATER_STALE_SOFT_DAYS) return 1; if (daysSinceLastMetric > SKATER_STALE_HARD_DAYS) return 0; const span = Math.max(1, SKATER_STALE_HARD_DAYS - SKATER_STALE_SOFT_DAYS); const progress = clamp( (daysSinceLastMetric - SKATER_STALE_SOFT_DAYS) / span, 0, 1, ); return clamp( 1 - progress * (1 - SKATER_SOFT_STALE_MIN_MULTIPLIER), SKATER_SOFT_STALE_MIN_MULTIPLIER, 1, ); }
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (web-lib-projections-utils-season-recency-regularseasonrecencydays, symbol_candidate, location; Codex family 'FORGE staged projection math'):** Regular season recency days (regularSeasonRecencyDays)
  - Purpose: Event dates remain unchanged. Only authoritative regular-season intervals age evidence.
  - Inputs/units: Parameter/type declaration excerpt: export function regularSeasonRecencyDays(args: { eventDate: string; eventSeasonId: number; eventGameType: number; asOfDate: string; currentSeasonId: number; seasons: readonly SeasonDetails[]; }): number \| null { const event = dateMs(args.eventDate), cutoff = dateMs(args.asOfDate); if (event === null \|\| cutoff === null \|\| event >= cutoff \|\| args.seasons.length === 0) return null; const seasons = [...args.seasons].sort((a, b) => a.id - b.id); const intervals: Array<{ id: number; start: number; end: number; seasonEnd: number }> = []; for (const season of seasons) { const year = Math.floor(season.id / 10000); const start = dateMs(season.startDate), end = dateMs(season.regularSeasonEndDate), seasonEnd = dateMs(season.endDate); const previous = interva…
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): utils/season-recency.ts:12 comment
  - Intended contract (Codex web-lib-projections-stages-skater-stage-computeskaterrecencymultiplier): {"source": "web/lib/projections/stages/skater-stage.ts:884", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["web/lib/projections/stages/skater-stage.ts:889 (daysSinceLastMetric - SKATER_STALE_SOFT_DAYS) / span,", "web/lib/projections/stages/skater-stage.ts:894 1 - progress * (1 - SKATER_SOFT_STALE_MIN_MULTIPLIER),"]}
  - Intended contract (Codex web-lib-projections-utils-season-recency-regularseasonrecencydays): {"source": "web/lib/projections/utils/season-recency.ts:13", "explicit_comment": "Event dates remain unchanged. Only authoritative regular-season intervals age evidence.", "arithmetic_locations": ["web/lib/projections/utils/season-recency.ts:26 const year = Math.floor(season.id / 10000);", "web/lib/projections/utils/season-recency.ts:29 if (!Number.isSafeInteger(season.id) \|\| season.id !== year * 10000 + year + 1", "web/lib/projections/utils/season-recency.ts:38 return intervals.reduce((days, s) => days + Math.max(0, Math.min(cutoff, s.end) - Math.max(event, s.start)) / DAY_MS, 0);", "web/lib/projections/utils/season-recency.ts:41 /** Resolve every intervening season through the existing native server reader. */"]}
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/projections/runProjectionV2.test.ts`; `web/lib/projections/utils/season-recency.test.ts`; `{"status": "Discovered only; not run", "references": ["No direct symbol/module test reference found in bounded search."]}`; `{"status": "Discovered only; not run", "references": ["web/lib/projections/utils/season-recency.test.ts:2"]}`
- **Leads (not audited):**
  - (opus) observation: a soft-stale player keeps as little as 15% TOI before reconciliation rescales the team
  - (codex:web-lib-projections-stages-skater-stage-computeskaterrecencymultiplier) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:web-lib-projections-utils-season-recency-regularseasonrecencydays) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-FRG-056 Sustainability trend-band adjustment

- **Match:** Both; Opus FRG-080; Codex web-lib-projections-utils-trend-adjustments-computeskatertrendadjustment, web-lib-projections-utils-trend-adjustments-computetrendadjustmentrecencyweight
- **Purpose:** Shot/goal/assist multipliers and uncertainty widening from a player's sustainability trend band
- **Where:** `web/lib/projections/utils/trend-adjustments.ts:57 (computeSkaterTrendAdjustment)`; `web/lib/projections/utils/trend-adjustments.ts:27 (computeTrendAdjustmentRecencyWeight)`; `web/lib/projections/queries/skater-queries.ts:616 (fetchLatestSkaterTrendAdjustments)`; `web/lib/projections/constants/projection-weights.ts:163`; `web/lib/projections/utils/trend-adjustments.ts:57 computeSkaterTrendAdjustment`; `web/lib/projections/utils/trend-adjustments.ts:27 computeTrendAdjustmentRecencyWeight`
- **Tags (heuristic):** denominators: 5v5 only; generation: current
- **Opus view (FRG-080):**
  - Method: Pick freshest row by metric priority fantasy_score > ixg_per_60 > shots_per_60 > points_per_60_5v5. signedDistance = (value-upper)/width if above, -(lower-value)/width if below, else 0; clamp ±2. nEffWeight = clamp(n_eff/8,0.35,1) (0.6 if null); recency = 1 if age<=3 days, 0 if >=21, linear between. signal = dist*nEffW*recency. shot mult = clamp(1+0.08s,0.88,1.12); goal = clamp(1+0.10s,0.86,1.14); assist = clamp(1+0.08s,0.88,1.12); volatility = 1+clamp(0.45\|s\|,0,0.55).
  - Inputs/units: metric units vary by metric_key; sources: sustainability_trend_bands
  - Output scale: multipliers 0.86-1.14; volatility 1-1.55; writes: —
  - Status: live
  - Consumers: skater shots/goals/assist share; buildPlayerUncertainty widening
- **Codex view (web-lib-projections-utils-trend-adjustments-computeskatertrendadjustment, symbol_candidate, location; Codex family 'FORGE staged projection math'):** Compute skater trend adjustment (computeSkaterTrendAdjustment)
  - Purpose: Compute skater trend adjustment for forge staged projection math. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: export function computeSkaterTrendAdjustment(args: { row: SustainabilityTrendBandRow; asOfDate: string; }): SkaterTrendAdjustment \| null { const value = finiteOrNull(args.row.value); const ciLower = finiteOrNull(args.row.ci_lower); const ciUpper = finiteOrNull(args.row.ci_upper); const snapshotDate = parseDateOnly(args.row.snapshot_date); if (value == null \|\| ciLower == null \|\| ciUpper == null \|\| !snapshotDate) { return null; } const lower = Math.min(ciLower, ciUpper); const upper = Math.max(ciLower, ciUpper); const bandWidth = Math.max(upper - lower, 1e-4); let signedDistance = 0; if (value > upper) { signedDistance = (value - upper) / bandWidth;
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (web-lib-projections-utils-trend-adjustments-computetrendadjustmentrecencyweight, symbol_candidate, location; Codex family 'FORGE staged projection math'):** Compute trend adjustment recency weight (computeTrendAdjustmentRecencyWeight)
  - Purpose: Compute trend adjustment recency weight for forge staged projection math. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: export function computeTrendAdjustmentRecencyWeight(ageDays: number): number { if (ageDays <= 3) return 1; if (ageDays >= 21) return 0; return clamp(1 - ((ageDays - 3) / 18), 0, 1); }
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex web-lib-projections-utils-trend-adjustments-computeskatertrendadjustment): {"source": "web/lib/projections/utils/trend-adjustments.ts:57", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["web/lib/projections/utils/trend-adjustments.ts:74 signedDistance = (value - upper) / bandWidth;", "web/lib/projections/utils/trend-adjustments.ts:76 signedDistance = -((lower - value) / bandWidth);", "web/lib/projections/utils/trend-adjustments.ts:81 const nEffWeight = nEff == null ? 0.6 : clamp(nEff / 8, 0.35, 1);", "web/lib/projections/utils/trend-adjustments.ts:85 const confidence = clamp(nEffWeight * recencyWeight, 0, 1);", "web/lib/projections/utils/trend-adjustments.ts:113 const weightedSignal = boundedDistance * confidence;", "web/lib/projections/utils/trend-adjustments.ts:128 shotRateMultiplier: Number(clamp(1 + weightedSignal * 0.08, 0.88, 1.12).toFixed(4)),", "web/lib/projections/utils/trend-adjustments.ts:129 goalRateMultiplier: Number(clamp(1 + weightedSignal * 0.1, 0.86, 1.14).toFixed(4)),", "web/lib/projections/utils/trend-adjustments.ts:130 assistRateMultiplier: Number(clamp(1 + weightedSignal * 0.08, 0.88, 1.12).toFixed(4)),"]}
  - Intended contract (Codex web-lib-projections-utils-trend-adjustments-computetrendadjustmentrecencyweight): {"source": "web/lib/projections/utils/trend-adjustments.ts:27", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["web/lib/projections/utils/trend-adjustments.ts:30 return clamp(1 - ((ageDays - 3) / 18), 0, 1);"]}
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/projections/utils/trend-adjustments.test.ts`; `{"status": "Discovered only; not run", "references": ["web/lib/projections/utils/trend-adjustments.test.ts:6"]}`; `{"status": "Discovered only; not run", "references": ["web/lib/projections/utils/trend-adjustments.test.ts:7"]}`
- **Leads (not audited):**
  - (opus) observation: same mapping regardless of which metric was chosen (a fantasy_score band moves shot, goal and assist rates identically)
  - (opus) observation: direction: value above band increases rates (momentum, not regression)
  - (opus) observation: snapshot_date <= asOfDate allows same-day rows
  - (codex:web-lib-projections-utils-trend-adjustments-computeskatertrendadjustment) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:web-lib-projections-utils-trend-adjustments-computetrendadjustmentrecencyweight) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-FRG-057 Player and team game strength tables

- **Match:** Both; Opus FRG-081; Codex web-lib-projections-derived-buildstrengthtablesv2-prepareplayergamestrengthv2, web-lib-projections-derived-buildstrengthtablesv2-prepareteamgamestrengthv2
- **Purpose:** Per-game ES/PP/PK TOI, shots (SOG+goals), goals, assists per player and team
- **Where:** `web/lib/projections/derived/buildStrengthTablesV2.ts:220 (preparePlayerGameStrengthV2)`; `web/lib/projections/derived/buildStrengthTablesV2.ts:348 (prepareTeamGameStrengthV2)`; `web/lib/projections/derived/buildStrengthTablesV2.ts:220 preparePlayerGameStrengthV2`; `web/lib/projections/derived/buildStrengthTablesV2.ts:348 prepareTeamGameStrengthV2`
- **Tags (heuristic):** denominators: per game, shots on goal; generation: current
- **Opus view (FRG-081):**
  - Method: Shots = shot-on-goal + goal events attributed to shootingplayerid (scorer for goals); goals to scorer; assists to assist1/assist2; split by strengthForTeam; shootout excluded. Team row = sum of player rows (skater-seconds, so ~18,000 s per game total).
  - Inputs/units: seconds; counts; sources: shift_charts, pbp_games, pbp_plays
  - Output scale: counts and seconds per game; writes: forge_player_game_strength, forge_team_game_strength
  - Status: live — /api/v1/db/build-projection-derived-v2
  - Consumers: team strength averages; offense environment; PP share; rolling metrics?
- **Codex view (web-lib-projections-derived-buildstrengthtablesv2-prepareplayergamestrengthv2, calculation, location; Codex family 'FORGE staged projection math'):** Native player strength splits (preparePlayerGameStrengthV2)
  - Purpose: Derive player ES/PP/PK TOI intervals and shot/goal/assist event counts from complete stored PBP and shift evidence; excludes shootout play.
  - Inputs/units: PBP identities/strength/scores and shift start/end clocks.
  - Output scale: TOI seconds and integer SOG/G/A by ES/PP/PK; unsupported HIT/BLK/PIM/plus-minus null.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (web-lib-projections-derived-buildstrengthtablesv2-prepareteamgamestrengthv2, calculation, location; Codex family 'FORGE staged projection math'):** Native team strength splits (prepareTeamGameStrengthV2)
  - Purpose: Aggregate game strength intervals and scoring-team shot/goal events by ES/PP/PK from native inputs.
  - Inputs/units: Complete game/PBP/shift/situation inputs.
  - Output scale: Team ES/PP/PK TOI seconds, shots and goals.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex web-lib-projections-derived-buildstrengthtablesv2-prepareplayergamestrengthv2): {"source": "web/lib/projections/derived/buildStrengthTablesV2.ts:220", "explicit_comment": "web/lib/projections/derived/buildStrengthTablesV2.ts:275 Shootout attempts are not NHL shots, goals or assists.", "arithmetic_locations": []}
  - Intended contract (Codex web-lib-projections-derived-buildstrengthtablesv2-prepareteamgamestrengthv2): {"source": "web/lib/projections/derived/buildStrengthTablesV2.ts:348", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": []}
  - External references: NHL boxscore counting
  - Fixtures/test data: none listed
  - Tests: `web/lib/projections/derived/buildStrengthTablesV2.test.ts`; `{"status": "Discovered only; not run", "references": ["web/__tests__/pages/api/v1/db/build-projection-derived-v2.test.ts:31", "web/lib/projections/derived/buildStrengthTablesV2.test.ts:65"]}`; `{"status": "Discovered only; not run", "references": ["web/__tests__/pages/api/v1/db/build-projection-derived-v2.test.ts:32", "web/lib/projections/derived/buildStrengthTablesV2.test.ts:66"]}`
- **Leads (not audited):**
  - (opus) observation: hits/blocks/pim are written null in these tables
  - (opus) observation: team TOI fields are summed skater-seconds, not clock time
  - (codex:web-lib-projections-derived-buildstrengthtablesv2-prepareplayergamestrengthv2) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested."]
  - (codex:web-lib-projections-derived-buildstrengthtablesv2-prepareteamgamestrengthv2) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested."]

## M-FRG-058 Strength-state classification and shift strength TOI

- **Match:** Both; Opus FRG-082; Codex web-lib-projections-derived-situation-isshootoutplay, web-lib-projections-derived-situation-parsesituationdigits, web-lib-projections-derived-situation-strengthforteam
- **Purpose:** Classify PBP events and shift seconds as ES/PP/PK from situationCode
- **Where:** `web/lib/projections/derived/situation.ts:10 (parseSituationDigits)`; `web/lib/projections/derived/situation.ts:38 (strengthForTeam)`; `web/lib/projections/derived/situation.ts:67 (isShootoutPlay)`; `web/lib/projections/ingest/shifts.ts:596 (buildShiftStrengthUpserts)`; `web/lib/projections/ingest/shifts.ts:320 (overlapSeconds)`; `web/lib/projections/derived/situation.ts:67 isShootoutPlay`; `web/lib/projections/derived/situation.ts:10 parseSituationDigits`; `web/lib/projections/derived/situation.ts:38 strengthForTeam`
- **Tags (heuristic):** denominators: 5v5 only; generation: current
- **Opus view (FRG-082):**
  - Method: Effective skaters = skaters - 1 if own goalie pulled; more -> pp, fewer -> pk, equal -> es (3v3/4v4/6v5 EA count as ES). Shootout = periodType SO or period >=5 in preseason/regular season. Situation timeline per period from successive PBP situation codes; each shift's seconds split by overlap with timeline segments; must cover duration exactly.
  - Inputs/units: seconds (mm:ss clocks); sources: pbp_plays, pbp_games, NHL shift chart API
  - Output scale: seconds by strength; writes: shift_charts
  - Status: live — /api/v1/db/shift-charts
  - Consumers: forge_player_game_strength; forge_team_game_strength; PP share
- **Codex view (web-lib-projections-derived-situation-isshootoutplay, symbol_candidate, location; Codex family 'FORGE staged projection math'):** Is shootout play (isShootoutPlay)
  - Purpose: Shootout attempts are not goals, shots or assists in NHL scoring, so every strength bucket must skip them. Preseason and regular-season games go to a shootout after one overtime period (period 5); playoff period 5 is overtime. /
  - Inputs/units: Parameter/type declaration excerpt: export function isShootoutPlay(play: { gameid: number; periodnumber: number \| null; periodtype: string \| null; }): boolean { if (play.periodtype === "SO") return true; const gameType = gameTypeFromGameId(play.gameid); return ( (gameType === 1 \|\| gameType === 2) && play.periodnumber != null && play.periodnumber >= 5 ); }
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (web-lib-projections-derived-situation-parsesituationdigits, symbol_candidate, location; Codex family 'FORGE staged projection math'):** Parse situation digits (parseSituationDigits)
  - Purpose: Parse situation digits for forge staged projection math. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: export function parseSituationDigits( situationCode: string \| null \| undefined, ): SituationDigits \| null { if (!situationCode) return null; const s = situationCode.trim(); if (!/^[01][0-6][0-6][01]$/.test(s)) return null; // NHL "situationCode" format: A G / A S / H S / H G // Examples: // - "1551" => away goalie=1, away skaters=5, home skaters=5, home goalie=1 (5v5) // - "1541" => away on PP (5v4), home on PK (4v5) const awayGoalie = Number(s[0]); const awaySkaters = Number(s[1]); const homeSkaters = Number(s[2]); const homeGoalie = Number(s[3]); return { awayGoalie, awaySkaters, homeSkaters, homeGoalie }; } /**
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (web-lib-projections-derived-situation-strengthforteam, symbol_candidate, location; Codex family 'FORGE staged projection math'):** Strength for team (strengthForTeam)
  - Purpose: Strength from the scoring/shooting team's point of view. A pulled goalie is replaced by an extra attacker, so each side's skater count is reduced by one when its goalie digit is 0 before comparing. That keeps the NHL convention: a 6v5 extra-attacker goal is even strength, a 6v4 goal scored during a 5v4 penalty is still a power-play goal, and a goal into a shorthanded team's empty net (5v5 on the clock, opponent goalie pulled) is a power-play goal. Shootout events are not strength events at all; callers must drop them with `isShootoutPlay` before calling this. /
  - Inputs/units: Parameter/type declaration excerpt: export function strengthForTeam( digits: SituationDigits, teamId: number, homeTeamId: number, awayTeamId: number, ): Strength { if (teamId !== homeTeamId && teamId !== awayTeamId) { throw new Error("Situation team is not part of the scheduled game"); } const isHome = teamId === homeTeamId; const homeEffective = digits.homeSkaters - (digits.homeGoalie === 1 ? 0 : 1); const awayEffective = digits.awaySkaters - (digits.awayGoalie === 1 ? 0 : 1); const mySkaters = isHome ? homeEffective : awayEffective; const oppSkaters = isHome ? awayEffective : homeEffective; if (mySkaters > oppSkaters) return "pp"; if (mySkaters < oppSkaters) return "pk"; return "es"; }
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): derived/situation.ts:27-37 docstring
  - Intended contract (Codex web-lib-projections-derived-situation-isshootoutplay): {"source": "web/lib/projections/derived/situation.ts:67", "explicit_comment": "Shootout attempts are not goals, shots or assists in NHL scoring, so every strength bucket must skip them. Preseason and regular-season games go to a shootout after one overtime period (period 5); playoff period 5 is overtime. /", "arithmetic_locations": []}
  - Intended contract (Codex web-lib-projections-derived-situation-parsesituationdigits): {"source": "web/lib/projections/derived/situation.ts:10", "explicit_comment": "web/lib/projections/derived/situation.ts:16 NHL \"situationCode\" format: A G / A S / H S / H G", "arithmetic_locations": ["web/lib/projections/derived/situation.ts:27 /**"]}
  - Intended contract (Codex web-lib-projections-derived-situation-strengthforteam): {"source": "web/lib/projections/derived/situation.ts:38", "explicit_comment": "Strength from the scoring/shooting team's point of view. A pulled goalie is replaced by an extra attacker, so each side's skater count is reduced by one when its goalie digit is 0 before comparing. That keeps the NHL convention: a 6v5 extra-attacker goal is even strength, a 6v4 goal scored during a 5v4 penalty is still a power-play goal, and a goal into a shorthanded team's empty net (5v5 on the clock, opponent goalie pulled) is a power-play goal. Shootout events are not strength events at all; callers must drop them with `isShootoutPlay` before calling this. /", "arithmetic_locations": ["web/lib/projections/derived/situation.ts:57 /** NHL game id digits 5-6: 01 preseason, 02 regular season, 03 playoffs. */"]}
  - External references: NHL official strength conventions; NST strength splits
  - Fixtures/test data: none listed
  - Tests: `web/lib/projections/derived/situation.test.ts`; `web/lib/projections/ingest/shifts.test.ts`; `{"status": "Discovered only; not run", "references": ["web/lib/projections/derived/situation.test.ts:3"]}`; `{"status": "Discovered only; not run", "references": ["web/lib/projections/derived/situation.test.ts:4"]}`; `{"status": "Discovered only; not run", "references": ["web/lib/projections/derived/situation.test.ts:5"]}`
- **Leads (not audited):**
  - (opus) observation: situation changes are only observed at PBP events, so penalty expiries between events are attributed late (PP/PK seconds approximate)
  - (opus) observation: OT 3v3 counted as ES
  - (codex:web-lib-projections-derived-situation-isshootoutplay) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:web-lib-projections-derived-situation-parsesituationdigits) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:web-lib-projections-derived-situation-strengthforteam) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-FRG-059 Team-to-player reconciliation (TOI and shots)

- **Match:** Both; Opus FRG-083; Codex web-lib-projections-reconcile-reconcilefloattotalbyweight, web-lib-projections-reconcile-reconcileintegertotalbyweight, web-lib-projections-reconcile-reconcileteamtoplayers
- **Purpose:** Force player TOI and shots to sum to team targets, with a guard against one player taking too much
- **Where:** `web/lib/projections/reconcile.ts:97 (reconcileTeamToPlayers)`; `web/lib/projections/reconcile.ts:34 (reconcileIntegerTotalByWeight)`; `web/lib/projections/reconcile.ts:66 (reconcileFloatTotalByWeight)`; `web/lib/projections/calculators/scenario-blending.ts:296 (validateReconciledPlayerDistribution)`; `web/lib/projections/queries/team-context-queries.ts:40 (fetchTeamStrengthAverages)`; `web/lib/projections/reconcile.ts:66 reconcileFloatTotalByWeight`; `web/lib/projections/reconcile.ts:34 reconcileIntegerTotalByWeight`; `web/lib/projections/reconcile.ts:97 reconcileTeamToPlayers`
- **Tags (heuristic):** denominators: per game; generation: current
- **Opus view (FRG-083):**
  - Method: TOI: largest-remainder integer apportionment proportional to player TOI to ES/PP targets. Shots: proportional scaling to ES target = team last-10 mean shots_es; PP target = official last-10 PP shots (else strength-table mean). If any player's ES share >0.24 or PP share >0.58, blend 60% reconciled + 40% pre-reconciliation and renormalise to targets.
  - Inputs/units: seconds; shot counts; sources: forge_team_game_strength (last 10 games), wgo_skater_stats (PP shots)
  - Output scale: seconds and shots per game; writes: forge_player_projections.proj_toi_*, proj_shots_*
  - Status: live
  - Consumers: goals (shots x rate); assists; goalie shots against (opponent)
- **Codex view (web-lib-projections-reconcile-reconcilefloattotalbyweight, symbol_candidate, location; Codex family 'FORGE staged projection math'):** Reconcile float total by weight (reconcileFloatTotalByWeight)
  - Purpose: Reconcile float total by weight for forge staged projection math. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: function reconcileFloatTotalByWeight(opts: { targetTotal: number; values: Array<{ key: number; value: number }>; fallbackWeights: Array<{ key: number; weight: number }>; }): { reconciled: Map<number, number>; scaleApplied: number \| null } { const targetTotal = clampNonNegative(opts.targetTotal); const values = opts.values.map((v) => ({ key: v.key, value: clampNonNegative(v.value) })); if (values.length === 0) return { reconciled: new Map(), scaleApplied: null }; const currentTotal = sum(values.map((v) => v.value)); if (currentTotal > 0) { const scale = targetTotal / currentTotal; const out = new Map<number, number>(); for (const v of values) out.set(v.key, v.value * scale); return { reconciled: out, scaleApplied: scale }; }
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (web-lib-projections-reconcile-reconcileintegertotalbyweight, symbol_candidate, location; Codex family 'FORGE staged projection math'):** Reconcile integer total by weight (reconcileIntegerTotalByWeight)
  - Purpose: Reconcile integer total by weight for forge staged projection math. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: function reconcileIntegerTotalByWeight(opts: { targetTotal: number; weights: Array<{ key: number; weight: number }>; }): Map<number, number> { const targetTotal = Math.round(clampNonNegative(opts.targetTotal)); const weights = opts.weights.map((w) => ({ key: w.key, weight: clampNonNegative(w.weight) })); const totalWeight = sum(weights.map((w) => w.weight)); if (weights.length === 0) return new Map(); const scaled = weights.map((w) => { const raw = totalWeight > 0 ? (w.weight / totalWeight) * targetTotal : targetTotal / weights.length; const floored = Math.floor(raw); return { key: w.key, raw, floored, frac: raw - floored }; });
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (web-lib-projections-reconcile-reconcileteamtoplayers, calculation, location; Codex family 'FORGE staged projection math'):** Team-to-player reconciliation (reconcileTeamToPlayers)
  - Purpose: Allocate fixed team totals by player weights; integer largest-remainder and floating rescaling helpers.
  - Inputs/units: Named model/observation inputs at cited declaration; Reconciled player TOI/shots/goals totals; inspect per-field units in parameter types. Input count/rate units follow the corresponding named outcome; cutoff timestamps and identity are required where declared.
  - Output scale: Reconciled player TOI/shots/goals totals; inspect per-field units in parameter types.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): stages/skater-stage.ts:2457 comment 'Task 3.6 reconciliation: hard constraints'
  - Intended contract (Codex web-lib-projections-reconcile-reconcilefloattotalbyweight): {"source": "web/lib/projections/reconcile.ts:66", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["web/lib/projections/reconcile.ts:76 const currentTotal = sum(values.map((v) => v.value));", "web/lib/projections/reconcile.ts:78 const scale = targetTotal / currentTotal;", "web/lib/projections/reconcile.ts:80 for (const v of values) out.set(v.key, v.value * scale);", "web/lib/projections/reconcile.ts:85 const totalWeight = sum(weights.map((w) => w.weight));", "web/lib/projections/reconcile.ts:90 const share = totalWeight > 0 ? w / totalWeight : 1 / values.length;", "web/lib/projections/reconcile.ts:91 out.set(v.key, share * targetTotal);"]}
  - Intended contract (Codex web-lib-projections-reconcile-reconcileintegertotalbyweight): {"source": "web/lib/projections/reconcile.ts:34", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["web/lib/projections/reconcile.ts:44 const totalWeight = sum(weights.map((w) => w.weight));", "web/lib/projections/reconcile.ts:48 const raw = totalWeight > 0 ? (w.weight / totalWeight) * targetTotal : targetTotal / weights.length;", "web/lib/projections/reconcile.ts:53 let remainder = targetTotal - sum(scaled.map((s) => s.floored));"]}
  - Intended contract (Codex web-lib-projections-reconcile-reconcileteamtoplayers): {"source": "web/lib/projections/reconcile.ts:97", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["web/lib/projections/reconcile.ts:109 const toiEsBefore = sum(players.map((p) => p.toiEsSeconds));", "web/lib/projections/reconcile.ts:110 const toiPpBefore = sum(players.map((p) => p.toiPpSeconds));", "web/lib/projections/reconcile.ts:111 const shotsEsBefore = sum(players.map((p) => p.shotsEs));", "web/lib/projections/reconcile.ts:112 const shotsPpBefore = sum(players.map((p) => p.shotsPp));", "web/lib/projections/reconcile.ts:149 const toiEsAfter = sum(players.map((p) => p.toiEsSeconds));", "web/lib/projections/reconcile.ts:150 const toiPpAfter = sum(players.map((p) => p.toiPpSeconds));", "web/lib/projections/reconcile.ts:151 const shotsEsAfter = sum(players.map((p) => p.shotsEs));", "web/lib/projections/reconcile.ts:152 const shotsPpAfter = sum(players.map((p) => p.shotsPp));"]}
  - External references: Top-down team-total constraints
  - Fixtures/test data: none listed
  - Tests: `web/lib/projections/reconcile.test.ts`; `web/lib/projections/runProjectionV2.test.ts`; `{"status": "Discovered only; not run", "references": ["web/lib/projections/reconcile.test.ts (module test)"]}`; `{"status": "Discovered only; not run", "references": ["web/lib/projections/reconcile.test.ts:4"]}`
- **Leads (not audited):**
  - (opus) observation: team shot totals are pinned to the team's own last-10 average, so opponent, pace, rest, trend and shot-quality multipliers only redistribute shots among teammates and never change team volume
  - (opus) observation: availability/recency/role-stability TOI reductions are undone by rescaling to 18,000 s
  - (opus) observation: last-10 strength averages have no game-type filter
  - (codex:web-lib-projections-reconcile-reconcilefloattotalbyweight) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:web-lib-projections-reconcile-reconcileintegertotalbyweight) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:web-lib-projections-reconcile-reconcileteamtoplayers) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested."]

## M-FRG-060 Role-specific usage bounds

- **Match:** Both; Opus FRG-084; Codex web-lib-projections-stages-skater-stage-applyrolespecificusagebounds
- **Purpose:** Clamp TOI and shot rates to tier-specific ranges
- **Where:** `web/lib/projections/stages/skater-stage.ts:1168 (applyRoleSpecificUsageBounds)`; `web/lib/projections/constants/projection-weights.ts:135-152`; `web/lib/projections/stages/skater-stage.ts:1168 applyRoleSpecificUsageBounds`
- **Tags (heuristic):** denominators: per 60, per game, shots on goal; generation: current
- **Opus view (FRG-084):**
  - Method: TOP: ES 780-1500 s, PP 120-560 s, SOG/60 max ES 15 PP 21; MIDDLE: ES 560-1180, PP 40-360, max 11.5/17; DEPTH: ES 260-940, PP 0-190, max 8.2/13. SOG/60 floors 1.2 ES, 1.5 PP. PP minimum waived when no PP unit. PP role from PP_UNIT_CHANGE event bounds PP separately.
  - Inputs/units: seconds; per-60; sources: —
  - Output scale: seconds per game; shots per 60; writes: —
  - Status: live
  - Consumers: skater stage
- **Codex view (web-lib-projections-stages-skater-stage-applyrolespecificusagebounds, symbol_candidate, location; Codex family 'FORGE staged projection math'):** Apply role specific usage bounds (applyRoleSpecificUsageBounds)
  - Purpose: Apply role specific usage bounds for forge staged projection math. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: export function applyRoleSpecificUsageBounds(args: { roleTag: SkaterRoleTag \| null; toiEsSeconds: number; toiPpSeconds: number; sogPer60Es: number; sogPer60Pp: number; /** Without a PP unit the role PP minimum does not apply. */ hasPpUnit?: boolean; }): SkaterRoleBoundedUsage { const tier = args.roleTag?.unitTier ?? "DEPTH"; const limits = tier === "TOP" ? { toiEsMin: SKATER_ROLE_TOP_TOI_ES_MIN, toiEsMax: SKATER_ROLE_TOP_TOI_ES_MAX, toiPpMin: SKATER_ROLE_TOP_TOI_PP_MIN, toiPpMax: SKATER_ROLE_TOP_TOI_PP_MAX, sogEsMax: SKATER_ROLE_TOP_SOG_ES_MAX,
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex web-lib-projections-stages-skater-stage-applyrolespecificusagebounds): {"source": "web/lib/projections/stages/skater-stage.ts:1168", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["web/lib/projections/stages/skater-stage.ts:1174 /** Without a PP unit the role PP minimum does not apply. */", "web/lib/projections/stages/skater-stage.ts:1233 /**"]}
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/projections/runProjectionV2.test.ts`; `{"status": "Discovered only; not run", "references": ["web/lib/projections/runProjectionV2.test.ts:30"]}`
- **Leads (not audited):**
  - (opus) observation: per-60 caps by tier can truncate genuine elite shooters on lower lines
  - (opus) observation: hard-coded seconds ranges
  - (codex:web-lib-projections-stages-skater-stage-applyrolespecificusagebounds) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

