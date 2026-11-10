# Audit packet: WiGO

Master entries M-WIGO-001 to M-WIGO-015 (15 of 15 in this family). Built from the merged Opus and Codex inventories; see [../MASTER.md](../MASTER.md) and [../MERGE-NOTES.md](../MERGE-NOTES.md).

How to read: each entry gives both inventories' descriptions side by side. **Conflicts** are places where the two descriptions disagree; they are unresolved. **Leads** are Opus red flags and Codex unknowns: observations to check, not audited findings. Tags are keyword heuristics. Line numbers were valid when each inventory was written on 2026-11-10 (Opus at d31dcb33f, Codex at 11e4192d3); re-check against the current checkout.

| ID | Name | Match | Conflicts | Leads |
|---|---|---|---:|---:|
| M-WIGO-001 | views nst_percentile_{es,pk,pp,as}_{offense,defense} (rate sources) | Both | 0 | 2 |
| M-WIGO-002 | WiGO points-per-game, PPG rolling, game mean and consistency distribu… | Both | 0 | 2 |
| M-WIGO-003 | Skater Game Score (per game) + 5/10-game rolling averages | Both | 0 | 3 |
| M-WIGO-004 | WiGO midrank percentile | Both | 0 | 2 |
| M-WIGO-005 | WiGO player ratings (offense/defense/overall by strength) | Both | 0 | 8 |
| M-WIGO-006 | Team performance drivers (5v5 generation/suppression/finishing, speci… | Both | 0 | 5 |
| M-WIGO-007 | Draft-round performance tiers (tierUtils) | Both | 0 | 3 |
| M-WIGO-008 | WiGO game-log chart reference averages and nice ticks | Opus only | 0 | 2 |
| M-WIGO-009 | WiGO career and recent stat builder (STD/LY/3YA/CA, L5/L10/L20) | Opus only | 0 | 3 |
| M-WIGO-010 | WiGO comparison DIFF (% change between timeframes) | Opus only | 0 | 1 |
| M-WIGO-011 | WiGO career/recent aggregates writer (STD/LY/3YA/CA, L5/L10/L20) | Opus only | 0 | 4 |
| M-WIGO-012 | WiGO aggregate table assembly + per-60 fallback derivation | Opus only | 0 | 1 |
| M-WIGO-013 | WiGO game-log series (per-game stat, PTS1%, PTS1/60, PP per-60) | Opus only | 0 | 2 |
| M-WIGO-014 | WiGO rate-stat percentile panel (cohort, min-GP, season fallback) | Opus only | 0 | 2 |
| M-WIGO-015 | WiGO dead percentile loader (fetchPercentilePlayerData) | Opus only | 0 | 1 |

## M-WIGO-001 views nst_percentile_{es,pk,pp,as}_{offense,defense} (rate sources)

- **Match:** Both; Opus WIGO-001; Codex sql-as-percentile-view
- **Purpose:** Per-player season per-60 rate rows that the WiGO client turns into percentiles
- **Where:** `supabase/migrations/20260716112908_production_schema_baseline.sql:18857 (nst_percentile_es_defense)`; `supabase/migrations/20260716112908_production_schema_baseline.sql:18959 (es_offense)`; `supabase/migrations/20260716112908_production_schema_baseline.sql:19287 (pk_defense)`; `supabase/migrations/20260716112908_production_schema_baseline.sql:19397 (pk_offense)`; `supabase/migrations/20260716112908_production_schema_baseline.sql:19711 (pp_defense)`; `supabase/migrations/20260716112908_production_schema_baseline.sql:19821 (pp_offense)`; `supabase/migrations/20261104011002_nst_percentile_as_from_gamelogs.sql:24 (nst_percentile_as_offense)`; `supabase/migrations/20261104011002_nst_percentile_as_from_gamelogs.sql:71 (nst_percentile_as_defense)`; `supabase/migrations/20261104011002_nst_percentile_as_from_gamelogs.sql:23 offense; :70 defense`
- **Tags (heuristic):** denominators: per 60; generation: current
- **Opus view (WIGO-001):**
  - Method: Pass-through LEFT JOIN of individual rates and on-ice rates by (player_id, season); no ranking in SQL despite the name. AS views (2026-11-04) replaced stale snapshot tables (renamed *_legacy).
  - Inputs/units: per-60; sources: nst_seasonlong_*_rates, nst_seasonlong_*_rates_oi
  - Output scale: per-60 rates; writes: —
  - Status: live — WiGO fetchers read them
  - Consumers: web/utils/fetchWigoPlayerStats.ts; web/utils/fetchWigoRatingStats.ts; web/utils/fetchWigoPercentiles.ts; web/components/WiGO/types.ts
- **Codex view (sql-as-percentile-view, calculation, location; Codex family 'SQL player metric adapters'):** nst_percentile_as_offense / nst_percentile_as_defense
  - Purpose: Expose all-strength season rate inputs under legacy percentile-table names.
  - Inputs/units: nst_seasonlong_as_rates and _rates_oi
  - Output scale: No new ranking calculation in these views: select named individual/on-ice season metrics and aliases (e.g. i_hdcf_per_60, oi_hdcf_per_60).
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
- **Audit context:**
  - Intent (Opus): supabase/migrations/20261104011002_nst_percentile_as_from_gamelogs.sql:1-7 (WiGO P-2: views over AS game logs, same shape as ES/PP/PK)
  - Intended contract (Codex sql-as-percentile-view): Migration comments explicitly replace one-off snapshots with live AS game-log-derived views of same shape. Application not verified.
  - External references: none suggested
  - Fixtures/test data: `web/e2e/fixtures/wigo/schema.json`
  - Tests: `web/utils/fetchWigoPlayerStats.test.ts`; `web/utils/fetchWigoRatingStats.test.ts`; `{"discovered_not_run": []}`
- **Leads (not audited):**
  - (opus) named 'percentile' but contain raw per-60 values; percentile math happens client-side (outside this slice)
  - (codex:sql-as-percentile-view) Definition exists locally; applied migration/live view shape, data freshness and runtime consumer use unknown.

## M-WIGO-002 WiGO points-per-game, PPG rolling, game mean and consistency distribution

- **Match:** Both; Opus WIGO-007; Codex core-363
- **Purpose:** Season PPG line, 5/10-game rolling points, unweighted game mean, and share of games by point total including 'cardio' games.
- **Where:** `web/components/WiGO/PpgLineChart.tsx:62`; `web/components/WiGO/PpgLineChart.tsx:83`; `web/components/WiGO/gameLogMean.ts:12 (gameLogMean)`; `web/components/WiGO/ConsistencyChart.tsx:49`; `web/components/WiGO/ToiLineChart.tsx:77`; `web/components/WiGO/gameLogMean.ts:12 gameLogMean`
- **Tags (heuristic):** denominators: per game, shots on goal; generation: current
- **Opus view (WIGO-007):**
  - Method: averagePpg = totals.points/games_played; rolling 5/10 via calculateRollingAverage; gameLogMean = unweighted mean of plotted games; consistency share = games with k points / total; cardio = games with 0 P, 0 SOG, 0 HIT, 0 BLK; PP TOI % x100.
  - Inputs/units: counts; seconds; fractions; sources: wgo_skater_stats, wgo_skater_stats_totals
  - Output scale: per game; percent; writes: —
  - Status: live — WiGO page
  - Consumers: WiGO dashboard
- **Codex view (core-363, calculation, location; Codex family 'WiGO ratings'):** Observed game-log mean
  - Formula: Sum numeric observations divided by their count.
  - Purpose: Provide observed game-log mean for the identified consumer.
  - Inputs/units: Game-log numeric values in the selected stat units.
  - Output scale: Arithmetic game mean or null for no numeric values.
  - Version/status: Local working tree on octoberBranch, read on 2026-11-10. HEAD changed during the inventory from d31dcb33f72d4c9d69b507874c388f0cd549fe2f to 11e4192d36ecc4ac4b338f9ab48e529c7049c618. This is a non-atomic local scan; deployment and persisted-data state are not verified. Referenced implementation files had no tracked/untracked status entry at the final status check.
- **Audit context:**
  - Intent (Opus): web/components/WiGO/gameLogMean.ts:9-11 comment
  - Intended contract (Codex core-363): Function signature and comments at web/components/WiGO/gameLogMean.ts:12 gameLogMean; independent product specification not verified.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `No dedicated test located in the bounded scan; no tests run.`; `web/components/WiGO/ConsistencyChart.test.tsx`; `web/components/WiGO/StatsTableRowChart.test.tsx`; `web/components/WiGO/ToiLineChart.test.tsx`
- **Leads (not audited):**
  - (opus) gameLogMean is an unweighted per-game mean, labelled as such (differs from pooled STD)
  - (codex:core-363) ["Calculation inventory only; no correctness or model-quality verdict."]

## M-WIGO-003 Skater Game Score (per game) + 5/10-game rolling averages

- **Match:** Both; Opus WIGO-009; Codex sql-skater-game-score
- **Purpose:** Per-game Game Score for a skater and its rolling means.
- **Where:** `supabase/migrations/20260716112908_production_schema_baseline.sql:1342 (get_skater_game_scores_for_season)`; `web/utils/formattingUtils.ts:146 (calculateRollingAverage)`; `web/components/WiGO/GameScoreLineChart/index.tsx:124`; `supabase/migrations/20260716112908_production_schema_baseline.sql:1342 get_skater_game_scores_for_season`
- **Tags (heuristic):** denominators: per game, shots on goal; generation: current
- **Opus view (WIGO-009):**
  - Method: GS = 0.75 G + 0.7 A1 + 0.55 A2 + 0.075 SOG + 0.05 BLK + 0.15 PD - 0.15 PT + 0.01 FOW - 0.01 FOL + 0.05 CF - 0.05 CA + 0.15 GF - 0.15 GA (GF/GA = ES+PP+SH on-ice). Rolling mean over windows 5 and 10, null if any game in window missing; games matched to calendar by date (ambiguous dates -> gap).
  - Inputs/units: counts per game; sources: wgo_skater_stats
  - Output scale: Game Score points (~-1..5); writes: —
  - Status: live — WiGO page
  - Consumers: GameScoreLineChart (WiGO)
- **Codex view (sql-skater-game-score, calculation, location; Codex family 'Legacy SQL Game Score'):** get_skater_game_scores_for_season.game_score
  - Purpose: Return weighted per-game performance score for season charts.
  - Inputs/units: WGO per-game goals, A1/A2, shots, blocks, penalties drawn/taken, FOW/FOL, shot attempts for/against, strength-summed goals for/against
  - Output scale: 0.75G+0.7A1+0.55A2+0.075S+0.05BLK+0.15PD−0.15PEN+0.01FOW−0.01FOL+0.05SATF−0.05SATA+0.15oiGF−0.15oiGA; unbounded numeric score
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
- **Audit context:**
  - Intent (Opus): baseline SQL comment 'existing game_score calculation remains unchanged' (no source cited)
  - Intended contract (Codex sql-skater-game-score): No separate written contract located in this bounded pass. SQL expression and aliases are implementation evidence, not an independently verified intended specification.
  - External references: Dom Luszczyszyn Game Score (2016): CF/CA and GF/GA are 5v5 on-ice
  - Fixtures/test data: none listed
  - Tests: `web/components/WiGO/GameScoreLineChart/index.test.tsx`; `web/components/WiGO/GameScoreSection.test.tsx`; `web/utils/formattingUtils.test.ts`; `{"discovered_not_run": []}`
- **Leads (not audited):**
  - (opus) CF/CA from sat_for/sat_against (likely all-situation) and GF/GA include PP/SH goals - Luszczyszyn uses 5v5; inflates PP players
  - (opus) 'penalties' may count all penalties not just minors taken
  - (codex:sql-skater-game-score) Definition exists locally; applied migration/live view shape, data freshness and runtime consumer use unknown.

## M-WIGO-004 WiGO midrank percentile

- **Match:** Both; Opus WIGO-011; Codex core-201, roster-generic-midrank
- **Purpose:** Percentile rank of a player's stat within a cohort with half-credit ties.
- **Where:** `web/utils/calculatePercentiles.ts:13 (calculateRankingResult)`; `web/utils/calculatePercentiles.ts:64 (buildPercentileLookup)`; `web/utils/calculatePercentiles.ts:99 (calculatePercentileRank)`; `web/utils/calculatePercentiles.ts:13 calculateRankingResult`; `web/utils/calculatePercentiles.ts:64 buildPercentileLookup`; `web/utils/calculatePercentiles.ts:99 calculatePercentileRank`; `web/utils/calculatePercentiles.ts:121 calculatePlayerRank`
- **Tags (heuristic):** percent scale: fraction 0-1; generation: current
- **Opus view (WIGO-011):**
  - Method: percentile = (worse + 0.5*equal)/n (target included in n), clamped 0-1; rank = better+1; lookup version binary-searches sorted values.
  - Inputs/units: stat units; sources: nst_percentile_* tables (via callers)
  - Output scale: fraction 0-1; rank 1..N; writes: —
  - Status: live — WiGO page
  - Consumers: calculatePlayerRatings; RateStatPercentiles
- **Codex view (core-201, calculation, location; Codex family 'WiGO ratings'):** Direction-aware rank and midrank percentile
  - Formula: (worse+.5*equal)/n; rank=better+1; binary-search buildPercentileLookup equivalent.
  - Purpose: Calculate direction-aware rank and midrank percentile.
  - Inputs/units: Finite cohort values, targetID, higherIsBetter.
  - Output scale: Percentile 0..1; competition rank>=1.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f.  Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final status check.
- **Codex view (roster-generic-midrank, calculation, location; Codex family 'Shared ranking and display'):** Generic directional competition rank and midrank percentile
  - Purpose: Counts better/worse/equal according to higherIsBetter. Percentile=(worse+.5*equal)/N, clamped0..1; rank=better+1. Cached lookup sorts once and binary-searches equal boundaries for repeated queries.
  - Inputs/units: Finite prefiltered numeric cohort values, playerID or target value and direction.
  - Output scale: Percentile fraction0..1 and ordinal competition rank1..N; selected-player API returns null for missing/empty cohort.
  - Version/status: No explicit algorithm version; comments identify S7/D-08 lookup optimization. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Audit context:**
  - Intent (Opus): web/utils/calculatePercentiles.ts:89-98 docblock
  - Intended contract (Codex core-201): Source types and implementation in web/utils/calculatePercentiles.ts:13; separate acceptance not verified.
  - Intended contract (Codex roster-generic-midrank): Function comments require nulls prefiltered; helper makes no cohort completeness/source claim. Source: web/utils/calculatePercentiles.ts:13 calculateRankingResult.
  - External references: Midrank / Hazen percentile rank
  - Fixtures/test data: none listed
  - Tests: `Located only; not run for this inventory.`; `web/utils/calculatePercentiles.test.ts`; `{"discovered_not_run": ["web/utils/calculatePercentiles.test.ts"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (codex:core-201) ["Inventory only, not validation of the formula, source semantics or model quality."]
  - (codex:roster-generic-midrank) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-WIGO-005 WiGO player ratings (offense/defense/overall by strength)

- **Match:** Both; Opus WIGO-013; Codex core-202, core-203, core-338
- **Purpose:** Weighted composite of stat percentiles per strength (AS/ES/PP/PK) into 0-100 offense, defense and overall ratings.
- **Where:** `web/utils/calculateWigoRatings.ts:71 (calculatePlayerRatings)`; `web/utils/calculateWigoRatings.ts:22 (applyRegression)`; `web/components/WiGO/ratingWeights.ts:11 (RATING_WEIGHTS)`; `web/components/WiGO/ratingWeights.ts:95 (REGRESSION_CONFIG)`; `web/utils/fetchWigoRatingStats.ts:41 (fetchRawStatsForAllStrengths)`; `web/components/WiGO/PlayerRatingsDisplay.tsx:76`; `web/utils/calculateWigoRatings.ts:22 applyRegression`; `web/utils/calculateWigoRatings.ts:71 calculatePlayerRatings`; `web/components/WiGO/ratingWeights.ts:11 RATING_WEIGHTS`
- **Tags (heuristic):** percent scale: 0-100; denominators: per 60, all strengths, shots on goal; generation: current
- **Opus view (WIGO-013):**
  - Method: Per stat percentile (x100) vs cohort with gp >= cohortMinGp; withheld if < 20 peers (WIGO_RATING_MIN_COHORT_PEERS). If player GP < 10 at that strength: regressed = (GP*pct + (10-GP)*mean pct of peers with GP>=10)/10, clamped 0-100. Offense weights AS/ES: P/60 25, ixG/60 20, SOG/60 15, iSCF/60 10, iHDCF/60 10, xGF% 10, CF% 5, PEND/60 5; defense AS/ES: xGA/60 30, SCA/60 20, HDCA/60 15, BLK/60 10, TK/60 10, minor pen/60 5, GV/60 10 (lower better where noted); PP offense: GF/60 25, xGF/60 20, P/60 15, SCF/60 10, SOG/60 15, HDGF/60 10, PEND/60 5; PK defense: GA/60 25, xGA/60 20, SCA/60 15, SA/60 10, HDCA/60 10, BLK/60 10, TK/60 5. Rating = weighted mean of available percentiles. overall.as/es = mean(off,def); overall.st = PP-off and PK-def weighted by PP/PK TOI; final = mean(as, es, st).
  - Inputs/units: per-60 rates; percent fields as stored by NST import; sources: nst_percentile_as/es/pp/pk_offense, nst_percentile_as/es/pk_defense
  - Output scale: 0-100 rating; writes: —
  - Status: live — WiGO charts page (/wigoCharts)
  - Consumers: web/components/WiGO/PlayerRatingsDisplay.tsx (wigoCharts page)
- **Codex view (core-202, calculation, location; Codex family 'WiGO ratings'):** Low-game percentile regression
  - Formula: (GP*percentile+(threshold-GP)*mean)/threshold, clamped.
  - Purpose: Calculate low-game percentile regression.
  - Inputs/units: Percentile 0..100, GP, minimum GP threshold, cohort percentile mean.
  - Output scale: Regressed percentile 0..100.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f.  Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final status check.
- **Codex view (core-203, calculation, location; Codex family 'WiGO ratings'):** Strength-specific offense/defense/overall ratings
  - Formula: Weighted means of available regressed percentiles; AS/ES mean off/def; ST PPoff/PKdef TOI-weighted; final average available AS/ES/ST.
  - Purpose: Calculate strength-specific offense/defense/overall ratings.
  - Inputs/units: AS/ES/PP/PK finite metric cohorts, metric weights/directions, GP threshold, TOI seconds.
  - Output scale: Offense/defense ratings by strength; all-situations, even-strength, special-teams and final ratings on a 0–100 scale.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f. WIGO_RATING_MIN_COHORT_PEERS=20 constant; callers choose cohort gates. Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the fin…
- **Codex view (core-338, calculation, location; Codex family 'WiGO ratings'):** Metric weight configuration
  - Formula: AS/ES offense: points60=25, ixG60=20, shots60=15, iSCF60=10, iHDCF60=10, xGF%=10, CF%=5, penaltiesDrawn60=5. AS/ES defense: xGA60=30, SCA60=20, HDCA60=15, blocks60=10, takeaways60=10, minorPenalties60=5, giveaways60=10. PP and PK weights separately declared in source.
  - Purpose: Calculate metric weight configuration.
  - Inputs/units: AS/ES/PP/PK metric percentiles.
  - Output scale: Weighted offense/defense rating inputs.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f.  Deployment not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final status check.
- **Audit context:**
  - Intent (Opus): web/utils/calculateWigoRatings.ts:28 formula comment M' = (GP*M + (P-GP)*mM)/P; ratingWeights.ts:96 comment; calculateWigoRatings.ts:66-67 (min 20 peers)
  - Intended contract (Codex core-202): Source types and implementation in web/utils/calculateWigoRatings.ts:22; separate acceptance not verified.
  - Intended contract (Codex core-203): Weights are in web/components/WiGO/ratingWeights.ts; missing metrics omitted and available weights renormalized.
  - Intended contract (Codex core-338): RATING_WEIGHTS declares each stat, direction, weight; regression default enabled with10-game threshold.
  - External references: Percentile composite ratings (e.g. Evolving-Hockey RAPM/GAR as stronger alternative); Tango regression to the mean
  - Fixtures/test data: `web/e2e/fixtures/wigo/wigoFixtures.ts`
  - Tests: `Located only; not run for this inventory.`; `No directly named test located; tests not run.`; `web/components/WiGO/PlayerRatingsDisplay.test.tsx`; `web/utils/calculateWigoRatings.test.ts`; `web/utils/fetchWigoRatingStats.test.ts`
- **Leads (not audited):**
  - (opus) overall.final averages AS, ES and ST although AS already contains ES and ST time - ES is double weighted
  - (opus) regression shrinks the percentile (not the rate) toward the mean percentile of >=10 GP peers (~50); GP is a poor reliability proxy vs TOI
  - (opus) on-ice CF%/xGF% are not relative-to-team; defense mixes on-ice suppression with individual counts (takeaways, giveaways) that are rink-biased
  - (opus) PK defense weights sum to 95 (normalized away)
  - (opus) higher-is-better TK/60 and BLK/60 placed in defense while GV/60 lower-is-better; blocks are fantasy-relevant but weak defensive signal
  - (codex:core-202) ["Inventory only, not validation of the formula, source semantics or model quality."]
  - (codex:core-203) ["Inventory only, not validation of the formula, source semantics or model quality."]
  - (codex:core-338) ["Inventory only; no correctness verdict."]

## M-WIGO-006 Team performance drivers (5v5 generation/suppression/finishing, special teams percentiles)

- **Match:** Both; Opus WIGO-014; Codex core-335, core-336, core-337
- **Purpose:** League percentile and strength/neutral/concern status for team xGF/GP, xGA/GP, GF/xGF and PP%/PK%.
- **Where:** `web/components/WiGO/teamPerformanceDriverModel.ts:25 (aggregateTeamFiveOnFive)`; `web/components/WiGO/teamPerformanceDriverModel.ts:84 (aggregateTeamSpecialTeams)`; `web/components/WiGO/teamPerformanceDriverModel.ts:184 (buildTeamPerformanceDrivers)`; `web/components/WiGO/fetchTeamDriverSnapshots.ts:7`; `web/components/WiGO/teamPerformanceDriverModel.ts:25 aggregateTeamFiveOnFive`; `web/components/WiGO/teamPerformanceDriverModel.ts:84 aggregateTeamSpecialTeams`; `web/components/WiGO/teamPerformanceDriverModel.ts:184 buildTeamPerformanceDrivers`
- **Tags (heuristic):** percent scale: 0-100; denominators: per game, 5v5 only; generation: current
- **Opus view (WIGO-014):**
  - Method: Coverage required >= 90% of expected games; league sample >= 24 teams. generation = xGF/GP, suppression = xGA/GP (lower better), finishing = GF/xGF; PP% = 100*PPG/PPO, PK% = 100*(1 - PPGA/TSH); percentile = (below + 0.5*equal)/n*100; special teams percentile = mean(PP pct, PK pct); status >=67 strength, <=33 concern.
  - Inputs/units: counts per team; sources: nst_team_5v5, wgo_team_stats, games
  - Output scale: percentile 0-100; writes: —
  - Status: live — WiGO page
  - Consumers: TeamPerformanceDrivers (WiGO)
- **Codex view (core-335, calculation, location; Codex family 'team performance drivers'):** Covered five-on-five team aggregation
  - Formula: Require>=90% expected games; sum only valid rows; no zero-fill missing games.
  - Purpose: Calculate covered five-on-five team aggregation.
  - Inputs/units: Expected team-date game counts and measured xGF, xGA, GF.
  - Output scale: Covered totals and game count.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f.  Deployment not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final status check.
- **Codex view (core-336, calculation, location; Codex family 'team performance drivers'):** Pooled PP and PK percentages
  - Formula: PP%=100*sumPPG/sumPPOpp; PK%=100*(1-sumPPGA/sumTSH); require>=90% games.
  - Purpose: Calculate pooled pp and pk percentages.
  - Inputs/units: PP goals/opportunities and PP goals against/times short-handed.
  - Output scale: Percentage points and coverage.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f.  Deployment not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final status check.
- **Codex view (core-337, calculation, location; Codex family 'team performance drivers'):** Team generation/suppression/finishing/special-teams drivers
  - Formula: Generation=xGF/GP; suppression=xGA/GP lower better; finishing=GF/xGF; special percentile=mean(PP and PK percentiles); thresholds 67/33.
  - Purpose: Calculate team generation/suppression/finishing/special-teams drivers.
  - Inputs/units: Covered 5v5 and special-team snapshots; at least 24 teams per metric.
  - Output scale: Raw rates, midrank percentile 0..100 and strength/neutral/concern.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f.  Deployment not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final status check.
- **Audit context:**
  - Intent (Opus): web/components/WiGO/teamPerformanceDriverModel.ts:42, 98 comments
  - Intended contract (Codex core-335): Source cites2026-10-25 decision: show>=90% game coverage with label; rates only use covered games.
  - Intended contract (Codex core-336): Source cites2026-10-25 decision: show>=90% game coverage with label; rates only use covered games.
  - Intended contract (Codex core-337): Source cites2026-10-25 decision: show>=90% game coverage with label; rates only use covered games.
  - External references: NST team 5v5 xGF/60, xGA/60; standard PP%/PK%
  - Fixtures/test data: none listed
  - Tests: `No directly named test located; tests not run.`; `web/components/WiGO/TeamPerformanceDrivers.test.tsx`; `web/components/WiGO/teamPerformanceDrivers.test.ts`
- **Leads (not audited):**
  - (opus) per-game rather than per-60 rates (5v5 TOI varies by team)
  - (opus) PK% here counts PP goals against only (SH goals for ignored, as standard)
  - (codex:core-335) ["Inventory only; no correctness verdict."]
  - (codex:core-336) ["Inventory only; no correctness verdict."]
  - (codex:core-337) ["Inventory only; no correctness verdict."]

## M-WIGO-007 Draft-round performance tiers (tierUtils)

- **Match:** Both; Opus WIGO-015; Codex roster-round-performance-tiers
- **Purpose:** Fantasy-points tier bands from average per-game production by draft round.
- **Where:** `web/utils/tierUtils.ts:28 (calculateTierThresholds)`; `web/utils/tierUtils.ts:28 calculateTierThresholds`; `web/utils/tierUtils.ts:12 getRoundAvg`
- **Tags (heuristic):** denominators: per game; generation: current
- **Opus view (WIGO-015):**
  - Method: Tier1 >= avgR1; Tier2 [avgR2,avgR1); Tier3 [avgR3,avgR2); Strong [avgR6,avgR3); Mid [avgR9,avgR6); Average [avgR13,avgR9); Replacement [0, avgR13 or lowest bound); fallback single all-levels tier.
  - Inputs/units: fantasy points per game; sources: RoundSummaryContext (projections page)
  - Output scale: FP/game bands; writes: —
  - Status: live — projections page
  - Consumers: web/pages/projections/index.tsx; web/components/Projections/PlayerMatchupWeekPerformanceChart.tsx
- **Codex view (roster-round-performance-tiers, calculation, location; Codex family 'Shared ranking and display'):** Round-average performance-tier boundaries
  - Purpose: Uses actual fantasy-points/game means for draft rounds1,2,3,6,9,13 as descending Tier1/Tier2/Tier3/Strong/Mid/Average boundaries where ordered. Replacement Level=[0,round13 mean), or lowest valid boundary. No averages gives All Performance Levels[0,infinity).
  - Inputs/units: RoundSummaryValue round numbers and actualPerGame fantasy-points/game values.
  - Output scale: Named min-inclusive/max-exclusive FP/game bands with display colors.
  - Version/status: No explicit formula version. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex roster-round-performance-tiers): Source comments define interval inclusivity and fallback; derived visual reference tiers, not positional projection clustering. Source: web/utils/tierUtils.ts:28 calculateTierThresholds.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `{"discovered_not_run": [], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (opus) not used by WiGO despite name; round anchors 1/2/3/6/9/13 are magic
  - (opus) no tests found
  - (codex:roster-round-performance-tiers) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-WIGO-008 WiGO game-log chart reference averages and nice ticks

- **Match:** Opus only; Opus WIGO-002; Codex —
- **Purpose:** Converts timeframe averages into chart reference lines/buttons and builds y-axis ticks.
- **Where:** `web/components/WiGO/StatsTableRowChart.tsx:78 (niceGameLogTicks)`; `web/components/WiGO/StatsTableRowChart.tsx:125 (TOI s->min)`; `web/components/WiGO/StatsTableRowChart.tsx:218 (valueForButton = avg/gp)`; `web/components/WiGO/StatsTableRowChart.tsx:345 (referenceValue)`
- **Tags (heuristic):** denominators: per 60, per game; generation: current
- **Opus view (WIGO-002):**
  - Method: If shouldUseGpForDiff(stat) and gp>0: reference = timeframe total / gp; TOI stats: seconds/60; RATES/percent: as-is. Ticks: step = smallest of {1,2,2.5,5,10}x10^floor(log10(max/4)) >= max/4 (integer step for counts).
  - Inputs/units: totals vs per-game; TOI seconds; sources: fetchPlayerGameLogForStat / WiGO aggregates
  - Output scale: per-game or minutes; writes: —
  - Status: live — WiGO game log chart
  - Consumers: WigoComparisonMatrix / WiGO dashboard
- **Audit context:**
  - Intent (Opus): StatsTableRowChart.tsx:75 comment: round ticks from zero, about four steps
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: none listed
- **Leads (not audited):**
  - (opus) per-GP conversion logic duplicates shouldUseGpForDiff branch of WIGO-003 computeDiffColumn
  - (opus) count stats lacking GP get null reference silently

## M-WIGO-009 WiGO career and recent stat builder (STD/LY/3YA/CA, L5/L10/L20)

- **Match:** Opus only; Opus WIGO-003; Codex —
- **Purpose:** Compute WiGO period rows: per-season averages, ATOI, PP share, shooting, IPP, oiSH%, OZS% and per-60s for season periods and last 5/10/20 games.
- **Where:** `web/pages/api/v1/db/calculate-wigo-stats.ts:144 (safeDivide)`; `web/pages/api/v1/db/calculate-wigo-stats.ts:153 (calculatePer60)`; `web/pages/api/v1/db/calculate-wigo-stats.ts:160 (calculatePer60FromSeconds)`; `web/pages/api/v1/db/calculate-wigo-stats.ts:607 (writePeriod)`; `web/pages/api/v1/db/calculate-wigo-stats.ts:784-990 (recent intervals)`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: per 60, per game, shots on goal; generation: current
- **Opus view (WIGO-003):**
  - Method: Periods: STD=current season, LY=last season, 3YA=3 prior seasons, CA=all but current. Counts = per-season mean (sum/seasons). ATOI = sum TOI min / sum GP (WGO TOI, NST fallback). pp_pct GP-weighted mean of pp_toi_pct. pts1_pct = (G+A1)/PTS; s_pct = G/SOG; ipp = PTS/on-ice GF (NST); oi_sh_pct = GF/SF; ozs_pct = OZS/(OZS+DZS). Per-60 = count/(TOI_min/60); PP per-60 uses PP seconds. Recent L5/L10/L20: totals over last N games, ATOI = sum seconds/60/gp, pp_pct = unweighted mean of per-game pp_toi_pct, per-60 from seconds; metrics nulled when any game lacks TOI or the source field.
  - Inputs/units: WGO TOI seconds (game) / minutes (season-converted); NST TOI minutes (seasonal) and seconds (gamelog); sources: wgo_skater_stats_totals, wgo_skater_stats, nst_seasonal_individual_counts, nst_seasonal_on_ice_counts, nst_gamelog_as_counts, nst_gamelog_as_counts_oi, players
  - Output scale: per-season averages, fractions 0-1, per-60 rates, ATOI minutes; writes: wigo_career, wigo_recent
  - Status: live — route ledger calls=2; utils/fetchWigoPlayerStats.ts reads outputs
  - Consumers: web/utils/fetchWigoPlayerStats.ts (WiGO charts)
- **Audit context:**
  - Intent (Opus): Comments calculate-wigo-stats.ts:601-606 (one builder per period, numerator and denominator from same seasons, absent source gives null not 0; references C-21, C-25, C-30, C-31, B-06)
  - External references: NST per-60; IPP = points / on-ice GF
  - Fixtures/test data: none listed
  - Tests: `web/__tests__/pages/api/v1/db/calculate-wigo-stats.test.ts`
- **Leads (not audited):**
  - (opus) recent pp_pct is an unweighted mean of per-game PP shares while season pp_pct is GP-weighted (and neither is PP-TOI-weighted)
  - (opus) IPP mixes WGO points (all situations) with NST on-ice GF; strength match not verified
  - (opus) season counts are per-season averages for 3YA/CA but raw totals for L5/L10/L20 in the same UI family

## M-WIGO-010 WiGO comparison DIFF (% change between timeframes)

- **Match:** Opus only; Opus WIGO-004; Codex —
- **Purpose:** Percent change between two timeframe columns, per-game for counts.
- **Where:** `web/components/WiGO/tableUtils.ts:15 (computeDiffColumn)`
- **Tags (heuristic):** generation: current
- **Opus view (WIGO-004):**
  - Method: For perGameCount stats: (L/GP_L - R/GP_R)/\|R/GP_R\|*100; else (L-R)/\|R\|*100; undefined when base 0 or GP invalid.
  - Inputs/units: mixed; sources: —
  - Output scale: percent change; writes: —
  - Status: live — WiGO page
  - Consumers: WigoComparisonMatrix; TimeframeComparison
- **Audit context:**
  - Intent (Opus): web/components/WiGO/tableUtils.ts:11-14 docblock
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/components/WiGO/WigoComparisonBand.test.tsx`; `web/components/WiGO/tableUtils.test.ts`
- **Leads (not audited):**
  - (opus) percentage change on percentages (e.g. S% 10 -> 12 = +20%) rather than percentage-point change

## M-WIGO-011 WiGO career/recent aggregates writer (STD/LY/3YA/CA, L5/L10/L20)

- **Match:** Opus only; Opus WIGO-005; Codex —
- **Purpose:** Nightly build of per-player season-window and recent-game aggregates and per-60 rates.
- **Where:** `web/pages/api/v1/db/calculate-wigo-stats.ts:153 (calculatePer60)`; `web/pages/api/v1/db/calculate-wigo-stats.ts:160 (calculatePer60FromSeconds)`; `web/pages/api/v1/db/calculate-wigo-stats.ts:607 (writePeriod)`; `web/pages/api/v1/db/calculate-wigo-stats.ts:767 (recent intervals)`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: per 60, per game, shots on goal; generation: current
- **Opus view (WIGO-005):**
  - Method: Windows: STD=current season, LY=last season, 3YA=3 seasons before current (current excluded), CA=all seasons except current. Per window: gp and counts = per-season averages (sum/number of seasons); atoi = sum TOI min / sum GP; pptoi = PP seconds / GP; pp_pct GP-weighted mean of WGO PP%; pts1_pct=(G+A1)/P; s_pct=G/SOG; ipp=P/on-ice GF; oi_sh_pct=GF/SF; ozs_pct=OZS/(OZS+DZS); per-60 = count*60/TOI minutes (WGO counts on WGO TOI, NST counts on NST TOI, PP counts on PP seconds). Recent L5/L10/L20: last N games, totals (not averages), atoi = toi/gp, pp_pct = unweighted mean of per-game PP%, per-60 from seconds; nulls if any game lacks TOI.
  - Inputs/units: TOI minutes (season) and seconds (game); counts; sources: wgo_skater_stats_totals, nst_seasonal_individual_counts, nst_seasonal_on_ice_counts, wgo_skater_stats, nst_gamelog_as_counts, nst_gamelog_as_counts_oi
  - Output scale: per-60 rates; fractions 0-1; minutes; seconds; writes: wigo_career, wigo_recent
  - Status: live — pg_cron update-wigo-table-stats 08:50 UTC (/api/v1/db/calculate-wigo-stats)
  - Consumers: fetchWigoPlayerStats.buildPlayerAggregatedStats; WigoComparisonMatrix; PerGameStatsTable; TimeframeComparison
- **Audit context:**
  - Intent (Opus): web/pages/api/v1/db/calculate-wigo-stats.ts:600-605 comment (C-21, C-31: numerator and denominator from same seasons)
  - External references: NST per-60 convention (count / TOI minutes * 60); pooled ratio estimators
  - Fixtures/test data: none listed
  - Tests: `web/__tests__/pages/api/v1/db/calculate-wigo-stats.test.ts`
- **Leads (not audited):**
  - (opus) 3YA/CA counts are per-season averages while STD/LY are single-season totals and L5-L20 are window totals - mixed scales shown side by side (DIFF divides by GP to compensate)
  - (opus) recent pp_pct is an unweighted mean of per-game PP% while career pp_pct is GP-weighted
  - (opus) IPP numerator WGO points (all strengths) over NST on-ice GF (all strengths) - two providers
  - (opus) 3YA year arithmetic hard-codes the YYYYYYYY season id shape

## M-WIGO-012 WiGO aggregate table assembly + per-60 fallback derivation

- **Match:** Opus only; Opus WIGO-006; Codex —
- **Purpose:** Assemble WiGO comparison rows, override with rate table values, derive missing per-60 from counts, normalize units.
- **Where:** `web/utils/fetchWigoPlayerStats.ts:242 (buildPlayerAggregatedStats)`; `web/utils/fetchWigoPlayerStats.ts:443 (getWigoAggregateFreshness)`; `web/components/WiGO/statMetadata.ts:340 (normalizeWigoAggregateValue)`
- **Tags (heuristic):** percent scale: 0-100; denominators: per 60, per game; generation: current
- **Opus view (WIGO-006):**
  - Method: Missing per-60 = count*60/(atoi*gp); STD counts fall back to season totals when null and the totals season matches; recent per-60 nulled if TOI/GP missing; ATOI minutes x60 -> seconds; fraction stats x100 -> percent; stdStale flags STD GP vs totals GP mismatch.
  - Inputs/units: minutes (atoi), seconds (pptoi), fractions; sources: wigo_career, wigo_recent, wgo_skater_stats_totals
  - Output scale: per-60; seconds; percent 0-100; writes: —
  - Status: live — WiGO page
  - Consumers: WigoComparisonMatrix; PerGameStatsTable; StatsTableRowChart
- **Audit context:**
  - Intent (Opus): web/utils/fetchWigoPlayerStats.ts:247-248 comment; statMetadata normalization metadata
  - External references: NST per-60 convention
  - Fixtures/test data: `web/e2e/fixtures/wigo/wigoFixtures.ts`
  - Tests: `web/components/WiGO/statMetadata.test.ts`; `web/utils/fetchWigoPlayerStats.test.ts`
- **Leads (not audited):**
  - (opus) STD count fallback uses season totals while 3YA/CA cells are per-season averages - consistent only for single-season columns

## M-WIGO-013 WiGO game-log series (per-game stat, PTS1%, PTS1/60, PP per-60)

- **Match:** Opus only; Opus WIGO-008; Codex —
- **Purpose:** Per-game values for the selected stat chart, including derived PTS1%, PTS1/60 and PP per 60 PP minutes.
- **Where:** `web/utils/fetchWigoPlayerStats.ts:468 (fetchPlayerGameLogForStat)`
- **Tags (heuristic):** percent scale: 0-100; denominators: per 60, per game; generation: current
- **Opus view (WIGO-008):**
  - Method: PTS1% = (G + primary A)/P*100 (null if P=0); PTS1/60 = NST g/60 + a1/60; PP stat/60 = count*3600/pp_toi_seconds (null if no PP time); WGO fractions x100; NST percent columns left as stored.
  - Inputs/units: per-60; seconds; fractions; sources: wgo_skater_stats, nst_gamelog_as_rates, nst_gamelog_as_rates_oi, nst_gamelog_as_counts
  - Output scale: per-game values; percent 0-100; writes: —
  - Status: live — WiGO page
  - Consumers: StatsTableRowChart; gameLogMean
- **Audit context:**
  - Intent (Opus): inline comments fetchWigoPlayerStats.ts:92-93, 151, 507-508
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/utils/fetchWigoPlayerStats.test.ts`
- **Leads (not audited):**
  - (opus) game-log PTS1/60 uses NST rates while aggregate PTS1/60 uses WGO counts/WGO TOI - different sources for the same label
  - (opus) code comment admits NST percentage scale is unverified (fetchWigoPlayerStats.ts:610)

## M-WIGO-014 WiGO rate-stat percentile panel (cohort, min-GP, season fallback)

- **Match:** Opus only; Opus WIGO-010; Codex —
- **Purpose:** Percentiles of 10 rate stats plus TOI/GP for a player against a min-GP cohort, with stale-season fallback to last season.
- **Where:** `web/components/WiGO/RateStatPercentiles.tsx:300`; `web/utils/fetchWigoPercentiles.ts:125 (isPercentileSeasonIncomplete)`; `web/utils/fetchWigoPercentiles.ts:158 (sanitizePercentileCohortGp)`; `web/utils/fetchWigoPercentiles.ts:216 (fetchPercentileCohortForPlayer)`
- **Tags (heuristic):** percent scale: both/ambiguous; denominators: per 60, per game; generation: current
- **Opus view (WIGO-010):**
  - Method: Cohort = players with gp >= minGp (target always included); TOI/GP = toi/gp; percentile via calculateRankingResult. Season incomplete if (canonical player GP >= 10 and NST GP <= max(4, floor(0.35*canonical))) or (canonical season max GP >= 20 and NST max GP <= max(10, floor(0.35*canonical max))); then fall back to previous season if that player and cohort have >= 10 GP. NST GP > canonical max -> GP nulled (player capped to canonical).
  - Inputs/units: per-60; seconds; sources: nst_percentile_{as,es,pp,pk}_offense, wgo_skater_stats_totals
  - Output scale: fraction 0-1 (displayed 0-100%); writes: —
  - Status: live — WiGO page
  - Consumers: RateStatPercentiles (wigoCharts)
- **Audit context:**
  - Intent (Opus): web/utils/fetchWigoPercentiles.ts:152-157 docblock
  - External references: NST player card percentiles
  - Fixtures/test data: `web/e2e/fixtures/wigo/wigoFixtures.ts`
  - Tests: `web/components/WiGO/RateStatPercentiles.test.tsx`; `web/utils/fetchWigoPercentiles.test.ts`
- **Leads (not audited):**
  - (opus) fallback shows last season's values under the current-season label context (disclosed in chip)
  - (opus) 0.35 staleness ratio and 10/20 GP floors are magic numbers

## M-WIGO-015 WiGO dead percentile loader (fetchPercentilePlayerData)

- **Match:** Opus only; Opus WIGO-012; Codex —
- **Purpose:** Loads NST percentile tables for all strengths (no callers).
- **Where:** `web/utils/fetchWigoPlayerStats.ts:986 (fetchPercentilePlayerData)`
- **Tags (heuristic):** generation: legacy
- **Opus view (WIGO-012):**
  - Method: Concatenates strength-tagged rows; no transformation beyond tagging.
  - Inputs/units: —; sources: nst_percentile_as/es/pp/pk_*
  - Output scale: —; writes: —
  - Status: legacy/dead — no callers (rg)
  - Consumers: —
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: none listed
- **Leads (not audited):**
  - (opus) no callers found - dead code

