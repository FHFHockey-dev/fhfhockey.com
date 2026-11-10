# Audit packet: Misc / other

Master entries M-MISC-001 to M-MISC-052 (52 of 52 in this family). Built from the merged Opus and Codex inventories; see [../MASTER.md](../MASTER.md) and [../MERGE-NOTES.md](../MERGE-NOTES.md).

How to read: each entry gives both inventories' descriptions side by side. **Conflicts** are places where the two descriptions disagree; they are unresolved. **Leads** are Opus red flags and Codex unknowns: observations to check, not audited findings. Tags are keyword heuristics. Line numbers were valid when each inventory was written on 2026-11-10 (Opus at d31dcb33f, Codex at 11e4192d3); re-check against the current checkout.

| ID | Name | Match | Conflicts | Leads |
|---|---|---|---:|---:|
| M-MISC-001 | fn safe_z | Both | 0 | 2 |
| M-MISC-002 | view gameOutcomes | Both | 0 | 2 |
| M-MISC-003 | Metrics timeline point % and delta | Both | 0 | 1 |
| M-MISC-004 | Player stats page aggregation, percentiles, per-game index, performan… | Both | 1 | 5 |
| M-MISC-005 | Percentile rank hook (season average stats) | Both | 0 | 2 |
| M-MISC-006 | Tweet swipe trainer confidence score (0-100) and name-match confidence | Both | 0 | 2 |
| M-MISC-007 | NST career / 3-year averages (counts and rates) with multi-team TOT r… | Both | 0 | 6 |
| M-MISC-008 | Odds implied probability (ingestion and Game Preview) | Both | 0 | 2 |
| M-MISC-009 | Opponent DEF percentile, easiest schedules, streaming nights (perfect… | Both | 0 | 3 |
| M-MISC-010 | BSH board, Nightly Floor, Role Watch, What Changed, Last Night's Stan… | Both | 0 | 2 |
| M-MISC-011 | Multi-cat percentile composite (Multi Cat Monsters / Points-First) an… | Both | 0 | 2 |
| M-MISC-012 | Goalie share cards: GSAx, Crease Shift, Busy/Quiet, Rescue, Ratio Imp… | Both | 0 | 5 |
| M-MISC-013 | Social share L5 player score: L5 fantasy points per game x opportunit… | Both | 0 | 3 |
| M-MISC-014 | Ownership / ADP trend movement (risers/fallers) | Both | 0 | 2 |
| M-MISC-015 | Game Grid opportunity trend label (first vs last week) | Opus only | 0 | 1 |
| M-MISC-016 | Player bio unit conversions (age, height, weight) | Opus only | 0 | 2 |
| M-MISC-017 | Social share card tone encodings (changeTone, workload alpha, goalie … | Opus only | 0 | 2 |
| M-MISC-018 | Social share Week Score five-tier colour band (tierOf) | Opus only | 0 | 2 |
| M-MISC-019 | Social share recent-form line: L5 SV% and TOI delta vs season | Opus only | 0 | 2 |
| M-MISC-020 | Social share gold-glow availability strength (goldGlow) | Opus only | 0 | 1 |
| M-MISC-021 | Social share pickup ownership band chip (bandChip) | Opus only | 0 | 2 |
| M-MISC-022 | Team Games Played (completed team games per team, competition ranked,… | Opus only | 0 | 1 |
| M-MISC-023 | Yahoo-NHL fuzzy name match confidence | Opus only | 0 | 0 |
| M-MISC-024 | CSV player-name fuzzy match (Levenshtein similarity) | Opus only | 0 | 1 |
| M-MISC-025 | Goals correlation analysis | Opus only | 0 | 1 |
| M-MISC-026 | Top scorers relationship analysis (points percentile, point-biserial,… | Opus only | 0 | 2 |
| M-MISC-027 | Dashboard source-date alignment gap (recency state) | Opus only | 0 | 2 |
| M-MISC-028 | Date Range Matrix TOI shares and goalie ratios | Opus only | 0 | 0 |
| M-MISC-029 | FORGE command center: momentum/trust and power-score deltas | Opus only | 0 | 1 |
| M-MISC-030 | Player pickup table percentile composite | Opus only | 0 | 2 |
| M-MISC-031 | Poisson score distribution chart (game page) | Opus only | 0 | 2 |
| M-MISC-032 | Team schedule calendar game rating and standings tiers | Opus only | 0 | 1 |
| M-MISC-033 | Skater variance: production proxy and game volatility | Opus only | 0 | 1 |
| M-MISC-034 | NST rate-limit plan assessment | Opus only | 0 | 2 |
| M-MISC-035 | X poller health thresholds (coverage, read success, fail streak) | Opus only | 0 | 0 |
| M-MISC-036 | Homepage game analytics: shots on goal sum and xG attach | Opus only | 0 | 1 |
| M-MISC-037 | Homepage pulse: model-vs-market edge series | Opus only | 0 | 1 |
| M-MISC-038 | Weekly/matchup-week fantasy points from game logs | Opus only | 0 | 1 |
| M-MISC-039 | Tweet identity candidates (bounded edit distance) and news phrase / m… | Opus only | 0 | 0 |
| M-MISC-040 | Goalie weekly league averages (pages/goalies.js) | Opus only | 0 | 0 |
| M-MISC-041 | Trends pages: percentile smoothing and hot/cold team selection | Opus only | 0 | 1 |
| M-MISC-042 | Week Score callers: Off-Night Edge, schedule tiers, Monday grid, Team… | Opus only | 0 | 2 |
| M-MISC-043 | Hot/cold streak rules | Opus only | 0 | 0 |
| M-MISC-044 | WiGO util fallbacks: derived per-60, PP per-60, PTS1%, percentile sta… | Opus only | 0 | 1 |
| M-MISC-045 | Team Stream per-game metrics, HOT and peripheral score | Codex only | 0 | 1 |
| M-MISC-046 | above/below/tied/unavailable/better/worse/compared and cellTone | Codex only | 0 | 1 |
| M-MISC-047 | Above/below/tied/unavailable and better/worse category outcomes | Codex only | 0 | 1 |
| M-MISC-048 | Category totals, pooled SV%/GAA and comparison precision | Codex only | 0 | 1 |
| M-MISC-049 | Week/month/custom/season cell assignment and inclusive day counts | Codex only | 0 | 1 |
| M-MISC-050 | gameNet, weekNet, betterRate and period category counts | Codex only | 0 | 1 |
| M-MISC-051 | Category Counts eligible/rank/worstRank | Codex only | 0 | 1 |
| M-MISC-052 | Official-start pool, game/week cells and relief accounting | Codex only | 0 | 1 |

## M-MISC-001 fn safe_z

- **Match:** Both; Opus MISC-001; Codex sql-safe-z
- **Purpose:** Null/zero-safe z-score helper
- **Where:** `supabase/migrations/20260716112908_production_schema_baseline.sql:4360 (safe_z)`; `supabase/migrations/20260716112908_production_schema_baseline.sql:4360 safe_z`
- **Tags (heuristic):** generation: legacy, current
- **Opus view (MISC-001):**
  - Method: NULL if val or sigma null or sigma=0, else (val-mu)/sigma.
  - Inputs/units: any; sources: —
  - Output scale: z-score; writes: —
  - Status: legacy/dead — rg found no callers in web/, functions/ or later SQL
  - Consumers: no repo SQL or code caller found
- **Codex view (sql-safe-z, calculation, location; Codex family 'SQL numeric helper'):** safe_z
  - Purpose: Standardize one value.
  - Inputs/units: Value, mean and SD in same input units
  - Output scale: (value−mean)/sigma; null when value/sigma absent or sigma=0; dimensionless z
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex sql-safe-z): IMMUTABLE SQL helper definition.
  - External references: standard z-score
  - Fixtures/test data: none listed
  - Tests: `{"discovered_not_run": []}`
- **Leads (not audited):**
  - (opus) no callers found in repo SQL or web/functions; likely dead
  - (codex:sql-safe-z) Definition exists locally; applied migration/live view shape, data freshness and runtime consumer use unknown.

## M-MISC-002 view gameOutcomes

- **Match:** Both; Opus MISC-002; Codex sql-game-outcome
- **Purpose:** WIN/LOSS/TIE label per team-game from scores
- **Where:** `supabase/migrations/20260716112908_production_schema_baseline.sql:8685 (gameOutcomes)`; `supabase/migrations/20260716112908_production_schema_baseline.sql:8685 gameOutcomes`
- **Tags (heuristic):** generation: current
- **Opus view (MISC-002):**
  - Method: Self-join on gameId; WIN if score > opponent, LOSS if <, else TIE.
  - Inputs/units: goals; sources: teamGameStats
  - Output scale: categorical; writes: —
  - Status: live — read by web/lib/splits/splitsServer.ts
  - Consumers: web/lib/splits/splitsServer.ts; web/components/LineCombinations/utilities.ts; web/lib/supabase/Upserts/fetchPowerRankings.js
- **Codex view (sql-game-outcome, calculation, location; Codex family 'SQL game classification'):** gameOutcomes.outcome
  - Purpose: Classify team result against paired opponent score.
  - Inputs/units: Same-game paired teamGameStats scores
  - Output scale: WIN if team score greater; LOSS if smaller; otherwise TIE.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex sql-game-outcome): Exact CASE in view.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `{"discovered_not_run": []}`
- **Leads (not audited):**
  - (opus) no OT/SO distinction; shootout winners counted only via final score
  - (codex:sql-game-outcome) Applied/deployed state and current consumer execution unknown; not tested or audited.

## M-MISC-003 Metrics timeline point % and delta

- **Match:** Both; Opus MISC-018; Codex core-368
- **Purpose:** Team metrics timeline points.
- **Where:** `web/components/MetricsTimeline/metricsTimelineData.ts:83-86 (pointPct)`; `web/components/MetricsTimeline/metricsTimelineData.ts:98 (calculateTimelineDelta)`; `web/components/MetricsTimeline/metricsTimelineData.ts:98 calculateTimelineDelta`; `web/components/MetricsTimeline/metricsTimelineData.ts:43 buildMetricsTimelineRows`
- **Tags (heuristic):** percent scale: fraction 0-1; generation: current
- **Opus view (MISC-018):**
  - Method: pointPct = points/(2*GP).
  - Inputs/units: counts; sources: team wgo stats, team xg aggregates
  - Output scale: fraction 0-1; writes: —
  - Status: live
  - Consumers: MetricsTimeline
- **Codex view (core-368, calculation, location; Codex family 'timeline display'):** Metric timeline point percentage and lookback change
  - Formula: Filter rows with numeric selected metric; subtract value lookback observed rows earlier. buildMetricsTimelineRows computes points/(2*games).
  - Purpose: Provide metric timeline point percentage and lookback change for the identified consumer.
  - Inputs/units: Chronological observed metric rows; lookback default 5; standings points and GP for pointPct.
  - Output scale: Signed latest-minus-lookback delta rounded to three decimals; pointPct fraction.
  - Version/status: Local working tree on octoberBranch, read on 2026-11-10. HEAD changed during the inventory from d31dcb33f72d4c9d69b507874c388f0cd549fe2f to 11e4192d36ecc4ac4b338f9ab48e529c7049c618. This is a non-atomic local scan; deployment and persisted-data state are not verified. Referenced implementation files had no tracked/untracked status entry at the final status check.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex core-368): Function signature and comments at web/components/MetricsTimeline/metricsTimelineData.ts:98 calculateTimelineDelta; independent product specification not verified.
  - External references: NHL points percentage
  - Fixtures/test data: none listed
  - Tests: `Located only; not run for this inventory.`; `web/components/MetricsTimeline/metricsTimelineData.test.ts`
- **Leads (not audited):**
  - (codex:core-368) ["Calculation inventory only; no correctness or model-quality verdict."]

## M-MISC-004 Player stats page aggregation, percentiles, per-game index, performance heat levels

- **Match:** Both; Opus MISC-020; Codex core-369, core-372
- **Purpose:** Aggregate game logs and rank a player on the player stats page.
- **Where:** `web/components/PlayerStats/playerStatsContract.ts:238 (aggregateSummaryStat)`; `web/components/PlayerStats/playerStatsContract.ts:192 (summarizeQualityStarts)`; `web/components/PlayerStats/playerStatsContract.ts:142 (computeAvailability)`; `web/components/PlayerStats/PlayerRadarChart.tsx:417-428 (rankAgainst)`; `web/components/PlayerStats/PlayerStatsChart.tsx:276 (5-game index vs season)`; `web/components/PlayerStats/PlayerPerformanceHeatmap.tsx:43 (calculatePercentile), :119 (calculatePerformanceLevel)`; `web/components/PlayerStats/PlayerContextualStats.tsx:133-397`; `web/components/PlayerStats/PlayerPerformanceHeatmap.tsx:43 calculatePercentile`; `web/components/PlayerStats/PlayerRadarChart.tsx:417 rankAgainst`
- **Tags (heuristic):** percent scale: 0-100; denominators: per 60, per game, shots on goal; generation: current
- **Opus view (MISC-020):**
  - Method: Goalie SV% = sum saves/sum SA; GAA = sum GA*3600/sum TOI s; S% = sum G/sum SOG; percentage stats = GP-weighted mean; per-60 and per-game stats = SIMPLE mean across games; counts summed. QS rate = QS/starts (null if any unclassified). Radar percentile = round(worse/n*100) vs season cohort (filtered by position). Relative chart: 5-game avg / season avg *100. Heatmap: fixed league thresholds p90..p10 per stat mapped to 95/85/60/35/15/5, weighted (points 2.0, goals 1.8, ... ) average -> elite >=90 ... Contextual: playoff PPG vs season (>1.1x / <0.8x), recent vs full (x1.2).
  - Inputs/units: TOI seconds; fractions vs percentage points (FRACTION_PERCENT_STATS); sources: wgo_skater_stats, wgo_skater_stats_per_game, wgo_goalie_stats, nst per-game tables
  - Output scale: 0-100 / index 100; writes: —
  - Status: live
  - Consumers: pages/stats/player/[playerId].tsx
- **Codex view (core-369, calculation, location; Codex family 'player performance UI'):** Fixed-threshold performance percentile proxy
  - Formula: Compare against fixed p90/p75/p50/p25/p10 thresholds, reversing inequalities for giveaways. This is a threshold lookup, not an empirical cohort percentile.
  - Purpose: Provide fixed-threshold performance percentile proxy for the identified consumer.
  - Inputs/units: Per-game metric, percentage-point value or TOI in minutes; hardcoded stat threshold table.
  - Output scale: Step scores 95, 85, 60, 35, 15 or 5; unknown stat 50.
  - Version/status: Local working tree on octoberBranch, read on 2026-11-10. HEAD changed during the inventory from d31dcb33f72d4c9d69b507874c388f0cd549fe2f to 11e4192d36ecc4ac4b338f9ab48e529c7049c618. This is a non-atomic local scan; deployment and persisted-data state are not verified. Referenced implementation files had no tracked/untracked status entry at the final status check.
- **Codex view (core-372, calculation, location; Codex family 'player performance UI'):** Radar strict percentile and competition rank
  - Formula: Percentile = round(100 * count strictly worse / cohort size); rank = 1 + count strictly better.
  - Purpose: Provide radar strict percentile and competition rank for the identified consumer.
  - Inputs/units: Player stat and eligible comparison-cohort values; preferred direction.
  - Output scale: Rounded percentile 0–100 and one-based competition rank.
  - Version/status: Local working tree on octoberBranch, read on 2026-11-10. HEAD changed during the inventory from d31dcb33f72d4c9d69b507874c388f0cd549fe2f to 11e4192d36ecc4ac4b338f9ab48e529c7049c618. This is a non-atomic local scan; deployment and persisted-data state are not verified. Referenced implementation files had no tracked/untracked status entry at the final status check.
- **CONFLICTS (unresolved, for the auditor):**
  - [units] vs core-369: Opus says TOI seconds; fractions vs percentage points (FRACTION_PERCENT_STATS) / Codex says Per-game metric, percentage-point value or TOI in minutes; hardcoded stat threshold table. — check mechanical rule: TOI seconds vs minutes
- **Audit context:**
  - Intent (Opus): web/components/PlayerStats/playerStatsContract.ts:229-236 'Ratios rebuilt from summed components rather than averaged per game... Missing values are skipped, never counted as zero'
  - Intended contract (Codex core-369): Function signature and comments at web/components/PlayerStats/PlayerPerformanceHeatmap.tsx:43 calculatePercentile; independent product specification not verified.
  - Intended contract (Codex core-372): Function signature and comments at web/components/PlayerStats/PlayerRadarChart.tsx:417 rankAgainst; independent product specification not verified.
  - External references: NST per-60 TOI-weighting convention
  - Fixtures/test data: none listed
  - Tests: `Located only; not run for this inventory.`; `No dedicated test located in the bounded scan; no tests run.`; `web/__tests__/pages/stats/player/playerId.test.ts`; `web/components/PlayerStats/PlayerContextualStats.test.tsx`; `web/components/PlayerStats/PlayerRadarChart.test.tsx`; `web/components/PlayerStats/PlayerStatsChart.test.tsx`; `web/components/PlayerStats/playerStatsContract.test.ts`
- **Leads (not audited):**
  - (opus) per-60 stats averaged as unweighted mean across games (should be TOI-weighted: sum count / sum TOI *3600)
  - (opus) heatmap single-game thresholds hard-coded and position-agnostic (D vs F share thresholds)
  - (opus) radar percentile ignores ties (strictly worse count)
  - (codex:core-369) ["Calculation inventory only; no correctness or model-quality verdict.", "The comments say thresholds are based on NHL data; provenance and calibration of the constants are not established by this inventory."]
  - (codex:core-372) ["Calculation inventory only; no correctness or model-quality verdict."]

## M-MISC-005 Percentile rank hook (season average stats)

- **Match:** Both; Opus MISC-028; Codex roster-radar-percentiles
- **Purpose:** Percentile of a player's per-game averages among all players.
- **Where:** `web/hooks/usePercentileRank.ts:51 (getSinglePercentileRank)`; `web/hooks/usePercentileRank.ts:51 getSinglePercentileRank`; `web/hooks/usePercentileRank.ts:120 [inline calculation: Eight-stat skater radar percentiles]`
- **Tags (heuristic):** percent scale: 0-100; denominators: per game; generation: current
- **Opus view (MISC-028):**
  - Method: calculateRankingResult (utils/calculatePercentiles, other lane) higher-is-better *100; null if any stat missing.
  - Inputs/units: per game; sources: player average stats view
  - Output scale: 0-100; writes: —
  - Status: live
  - Consumers: components/CategoryCoverageChart
- **Codex view (roster-radar-percentiles, calculation, location; Codex family 'Shared ranking and display'):** Eight-stat skater radar percentiles
  - Purpose: Ranks finite per-game goals, assists, plus/minus, PIM, hits, blocks, PP points and shots against skaters with>=5 games while always retaining selected player. Delegates higher-is-better midrank and multiplies by100; withholds radar when required output missing.
  - Inputs/units: get_skaters_avg_stats RPC averages for selected time window, cohort numgames and selected ID.
  - Output scale: Eight percentiles0..100 or unavailable; higher numeric value treated as higher percentile for all eight.
  - Version/status: Current hook source only; no independent statistical model version. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex roster-radar-percentiles): RADAR_MIN_GAMES=5 and comments specify common cached full pagination cohort; source aggregate definition owned by SQL inventory. Source: web/hooks/usePercentileRank.ts:51 getSinglePercentileRank.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/components/CategoryCoverageChart/CategoryCoverageChart.test.tsx`; `web/hooks/usePercentileRank.test.tsx`; `{"discovered_not_run": ["web/hooks/usePercentileRank.test.tsx", "web/components/CategoryCoverageChart/CategoryCoverageChart.test.tsx"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (opus) PIM and plus-minus treated higher-is-better
  - (codex:roster-radar-percentiles) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-MISC-006 Tweet swipe trainer confidence score (0-100) and name-match confidence

- **Match:** Both; Opus MISC-031; Codex OPS-TRAINER
- **Purpose:** Score how trustworthy a parsed lineup/news tweet card is.
- **Where:** `web/lib/sources/tweetSwipeTrainer.ts:50-64 (MATCH_BASIS_CONFIDENCE, POSITION_MISMATCH_PENALTY, CONFIDENCE_BANDS)`; `web/lib/sources/tweetSwipeTrainer.ts:290 (scoredMatch)`; `web/lib/sources/tweetSwipeTrainer.ts:548 (scoreTrainerConfidence)`; `web/lib/sources/tweetSwipeTrainer.ts:1077 (ratio)`; `web/lib/sources/tweetSwipeTrainer.ts:547 scoreTrainerConfidence`
- **Tags (heuristic):** percent scale: 0-100; generation: current
- **Opus view (MISC-031):**
  - Method: Match base: full_name 100, alias 90, initial 85, surname 75, ambiguous 40, conflicting 30, missing 0; -40 if position contradicts slot. Card: start 100; -10 unknown publish time; phrase rule missing/review -10, support-only -20; conflicting auto types -10; lineup: no complete unit -15; PP: -(2-units)/2*40; ES: -(7-units)/7*40; no matched player -30; unresolved -min(40, 8 each); unplaced -min(25, 5 each); unmatched goalie line -10 each; goalie count mismatch -10; -(100-mean match)*0.3; cap at weakest match+20; cap 15 if filter rejected or image-only. Bands high >=85, mid >=60. Accuracy = correct/total rounded to 0.1%.
  - Inputs/units: counts; sources: tweet review rows (tweetSwipeTrainerServer)
  - Output scale: 0-100; writes: —
  - Status: live
  - Consumers: components/TweetSwipeTrainer; cron report backlog
- **Codex view (OPS-TRAINER, calculation, location; Codex family 'Operational calculation helpers'):** Tweet parser confidence penalty score
  - Purpose: Summarize parsing completeness and ambiguity for review.
  - Inputs/units: Parsed type, rule tier, matched-name confidence, complete lines/pairs, unresolved names and filter status.
  - Output scale: 0–100 penalty score with category/cap rules and signal explanations.
  - Version/status: Operational parser heuristic, not calibrated probability. Production deployment/active database state not checked.
- **Audit context:**
  - Intent (Opus): web/lib/sources/tweetSwipeTrainer.ts:543-547 'Card confidence (0-100), after the audit's proposal: start at 100, subtract named penalties, then apply caps.' (tasks/artifacts/tweet-parsing-audit-2026-11-06.md section 5)
  - Intended contract (Codex OPS-TRAINER): Starts at100; publication/rules/completeness/name penalties; mean name confidence penalty; weakest-match+20 and rejected/image-only caps.
  - External references: none suggested
  - Fixtures/test data: `web/lib/sources/fixtures/tweetClassificationLabels.json`; `web/lib/sources/fixtures/october11TroublesomeTweets.json`
  - Tests: `web/components/TweetSwipeTrainer/TweetSwipeTrainer.test.tsx`; `web/lib/sources/tweetSwipeTrainer.test.ts`
- **Leads (not audited):**
  - (opus) hand-set penalty weights (version trainer-2026-11-06.4)
  - (codex:OPS-TRAINER) No mathematical accuracy or fitness assessment performed. Tests listed, not run.

## M-MISC-007 NST career / 3-year averages (counts and rates) with multi-team TOT rows

- **Match:** Both; Opus MISC-032; Codex legacy-rate-averages, legacy-season-averages
- **Purpose:** Three-year and career averages of NST individual + on-ice stats.
- **Where:** `web/lib/api/averages/statsService.ts:18 (getAggregatedCountsData)`; `web/lib/api/averages/statsService.ts:152-174 (counts TOT derived)`; `web/lib/api/averages/statsService.ts:300-360 (counts derived)`; `web/lib/api/averages/statsService.ts:371 (getAggregatedRatesData)`; `web/lib/api/averages/statsService.ts:482-520 (rates TOT recompute)`; `web/lib/api/averages/statsService.ts:584-590 (rate averaging)`; `web/lib/api/averages/helpers.ts:61 (addTotalRows), :121 (parseTime)`; `web/lib/api/averages/statsService.ts:371 getAggregatedRatesData; :437 addTotalRows callback`; `web/lib/api/averages/statsService.ts:18 getAggregatedCountsData; :154 TOT derived fields; :250 aggregate counts; web/lib/api/averages/helpers.ts:61 addTotalRows; :121 parseTime`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: per 60, shots on goal; generation: current
- **Opus view (MISC-032):**
  - Method: parseTime: TOI float minutes -> seconds. Multi-team seasons: sum aggregateKeys into TOT then recompute derived. Counts TOT: S%=G/SOG, secA%=A2/A, oZS%=oZS/(oZS+dZS), SOG/60 = SOG/TOI*60, oiSH%=oiGF/SF, IPP=(G+A)/oiGF, GF%/CF%/FF%/SF%/SCF%/xGF% = F/(F+A). Seasons = last 3 excluding current (3-year; error if <3) or all (career); counts summed and divided by 3 or N seasons; derived recomputed from averaged counts. Rates TOT: per-60 values SUMMED across teams then (sum / TOI_seconds)*3600; rate averages = simple mean of season per-60 values (divisor 3 or N); percentages from averaged rates.
  - Inputs/units: NST TOI float minutes -> seconds; counts; NST per-60; percentages /100 to fractions; sources: Natural Stat Trick HTML (via lib/nst/client cache)
  - Output scale: per-season averages; fractions 0-1; per-60 (buggy); writes: —
  - Status: unknown — only consumer found is pages/api/Averages/[playerId].ts; no client caller found
  - Consumers: pages/api/Averages/[playerId].ts
- **Codex view (legacy-rate-averages, calculation, location; Codex family 'Legacy averages API'):** Three-year/career rate averages and TOT rate reconstruction
  - Purpose: Produce prior-season averages of rate rows.
  - Inputs/units: Yearly source /60 rate fields, TOI seconds, prior-season rows
  - Output scale: TOT /60 fields transformed sum(field)/TOT TOI×3600; possession shares recomputed from paired rates; selected rate fields averaged across prior seasons. Enumerated rates: CF/CA,iSCF,PTS,SOG,A,G,GF/GA,A1/A2,SF/SA,SCF/SCA,iCF/iFF,FF/FA,ixG,xGF/xGA,HDCF/HDGF,MDCF/MDGF,LDCF/LDGF,PIM,HIT,BLK per60.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
- **Codex view (legacy-season-averages, calculation, location; Codex family 'Legacy averages API'):** Three-year/career count averages and derived fractions
  - Purpose: Produce prior-season averaged stats from scraped yearly tables.
  - Inputs/units: NST individual/on-ice yearly rows; minute-like TOI converted to seconds; prior season sets
  - Output scale: TOT sums for traded-player season; raw stat sums divided by 3 or available prior-season count; derived IPP,S%,xS%,oZS%,oiSH%,secA%,CF%,FF%,SF%,GF%,SCF%,xGF%; SOG/60 implemented as SOG/TOI×60.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
- **Audit context:**
  - Intent (Opus): web/lib/api/averages/statsService.ts:14-16 'Gets three-year or career aggregated counting data and averages.'
  - Intended contract (Codex legacy-rate-averages): Function comments and callback implementation; not the rolling weighted-rate contract.
  - Intended contract (Codex legacy-season-averages): Function comments explicitly describe three-year or career aggregated counts/averages; excludes latest season and requires sufficient historical seasons. No independent unit specification for SOG/60 beyond code.
  - External references: NST per-60 convention: rate = count / TOI_minutes * 60; multi-season rates should be TOI-weighted
  - Fixtures/test data: none listed
  - Tests: `web/__tests__/pages/api/Averages/helpers.test.ts`; `web/lib/nst/callerLifecycle.test.ts`; `{"discovered_not_run": []}`
- **Leads (not audited):**
  - (opus) TOI is stored in SECONDS (parseTime) but SOG/60 = SOG/TOI*60 (should be *3600) at statsService.ts:158 and :319 - per-60 understated 60x
  - (opus) TOT rates sum per-60 RATES across teams then divide by TOI seconds *3600 (statsService.ts:487-489) - mixes rates and counts; result is not a per-60
  - (opus) multi-season rate averages are unweighted means of seasonal per-60s (not TOI-weighted)
  - (opus) no in-repo page/component consumer found besides pages/api/Averages route (possibly legacy)
  - (codex:legacy-rate-averages) No adjacent direct test discovered in averages directory; not executed.
  - (codex:legacy-season-averages) Historical source-data provenance and downstream unit interpretation were not verified.

## M-MISC-008 Odds implied probability (ingestion and Game Preview)

- **Match:** Both; Opus MISC-033; Codex core-353
- **Purpose:** Convert sportsbook prices to implied probabilities.
- **Where:** `web/lib/sources/oddsSourceIngestion.ts:270 (americanPriceToImpliedProbability)`; `web/components/GamePreview/GamePreview.tsx:74 (getImpliedProbability)`; `web/components/GamePreview/GamePreview.tsx:210-226 (two-way normalization)`; `web/lib/sources/oddsSourceIngestion.ts:270 americanPriceToImpliedProbability`
- **Tags (heuristic):** percent scale: both/ambiguous; generation: current
- **Opus view (MISC-033):**
  - Method: American: +p -> 100/(p+100); -p -> p/(p+100). Decimal d>1 -> 1/d. Game Preview removes vig by proportional normalization away/(away+home). Ingestion stores raw implied_probability (vig included).
  - Inputs/units: American odds or decimal odds; sources: odds provider feed (market prices), NHL gamecenter odds offers (provider 9 then 8)
  - Output scale: probability 0-1 / percent 0-100; writes: market price rows (implied_probability column)
  - Status: live
  - Consumers: homepage pulse (uses separate home_market_no_vig_probability); GamePreview
- **Codex view (core-353, calculation, location; Codex family 'game prediction market'):** Source American price implied probability
  - Formula: Positive price: 100/(price+100). Negative price: -price/(-price+100).
  - Purpose: Provide source American price implied probability for the identified consumer.
  - Inputs/units: Signed American price.
  - Output scale: Probability fraction, or null for zero/nonfinite/missing price.
  - Version/status: Local working tree on octoberBranch, read on 2026-11-10. HEAD changed during the inventory from d31dcb33f72d4c9d69b507874c388f0cd549fe2f to 11e4192d36ecc4ac4b338f9ab48e529c7049c618. This is a non-atomic local scan; deployment and persisted-data state are not verified. Referenced implementation files had no tracked/untracked status entry at the final status check.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex core-353): Function signature and comments at web/lib/sources/oddsSourceIngestion.ts:270 americanPriceToImpliedProbability; independent product specification not verified.
  - External references: Standard American-odds conversion; proportional (multiplicative) de-vig; Shin / power methods as alternatives
  - Fixtures/test data: none listed
  - Tests: `Located only; not run for this inventory.`; `web/__tests__/pages/api/v1/db/update-market-prices.test.ts`; `web/components/GamePreview/GamePreview.test.tsx`; `web/lib/sources/oddsSourceIngestion.test.ts`
- **Leads (not audited):**
  - (opus) stored implied_probability includes overround; consumers must not treat it as fair probability
  - (codex:core-353) ["Calculation inventory only; no correctness or model-quality verdict."]

## M-MISC-009 Opponent DEF percentile, easiest schedules, streaming nights (perfect storm tilts)

- **Match:** Both; Opus MISC-036; Codex SOC-TARGET
- **Purpose:** Schedule/matchup softness for streaming cards.
- **Where:** `web/lib/socialShare/matchups.ts:49 (opponentDefense)`; `web/lib/socialShare/matchups.ts:80 (easiestSchedules)`; `web/lib/socialShare/matchups.ts:116 (rateRanks)`; `web/lib/socialShare/matchups.ts:130 (streamEvidence)`; `web/lib/socialShare/matchups.ts:151 (streamingNights)`; `web/lib/socialShare/targets.ts:24-43 (target picks)`; `web/lib/socialShare/targets.ts:37 targetRoles`; `web/lib/socialShare/targets.ts:48 targetCandidates`
- **Tags (heuristic):** percent scale: 0-100; denominators: per game, shots on goal; generation: current
- **Opus view (MISC-036):**
  - Method: DEF = 100 - percentile(xGA/GP) via GameGrid percentileMap. Easiest schedule DEF = 100 - percentile(mean opponent xGA/GP over counted games) among teams with games; floor min(3, max remaining). Rate ranks by per-game GF/GA/SF/SA; top third = rank <= ceil(n/3). Storms: goals (team GF/GP & opp GA/GP top third), shots (SF vs SA), blocks (team SA & opp SF). Tired = opponent played yesterday and team did not. Streaming nights: Week Score rank <=16, DEF<=33 or goals/shots storm; sort by flags, off-night, DEF, rank. Targets: scorer G/GP, shooter SOG/GP, blocker BLK/GP, rostered <50%.
  - Inputs/units: season totals / gp; sources: nst_team_stats
  - Output scale: percentile 0-100; ranks; writes: —
  - Status: live
  - Consumers: SocialShare cards (Easiest, Stream, Targeted Matchups)
- **Codex view (SOC-TARGET, calculation, location; Codex family 'Social-share calculations'):** Streaming target roles and season-rate selection
  - Purpose: Select low-ownership skaters suited to favorable game-category pairings.
  - Inputs/units: Team/opponent rank and cohort size; storm flags; player goals/SOG/blocks and GP.
  - Output scale: Role selection via summed normalized rank; candidates by G/GP, SOG/GP or BLK/GP.
  - Version/status: Local recommendation heuristic. Production deployment/active database state not checked.
- **Audit context:**
  - Intent (Opus): web/lib/socialShare/matchups.ts:48 'Single-opponent Game Grid DEF: 100 - percentile of that team's xGA/GP. Higher = stronger defense.'
  - Intended contract (Codex SOC-TARGET): Storm categories take precedence; ownership ceiling and uniqueness applied by selector.
  - External references: Schedule strength via opponent xGA/60 (Evolving-Hockey/MoneyPuck team xG rates)
  - Fixtures/test data: none listed
  - Tests: `web/e2e/social-share.spec.ts`; `web/lib/socialShare/matchups.test.ts`; `web/lib/socialShare/targets.test.ts`
- **Leads (not audited):**
  - (opus) assumes nst_team_stats xga/gf/sf are season TOTALS (divides by gp); if columns are per-60 rates the per-GP values are wrong
  - (opus) strength of schedule ignores home/away and score effects
  - (codex:SOC-TARGET) No mathematical accuracy or fitness assessment performed. Tests listed, not run.

## M-MISC-010 BSH board, Nightly Floor, Role Watch, What Changed, Last Night's Standouts: window vs baseline deltas

- **Match:** Both; Opus MISC-037; Codex SOC-CHANGE, SOC-STANDOUT
- **Purpose:** Skater window metrics and changes vs baseline windows.
- **Where:** `web/lib/socialShare/modules/bshBoard.ts:139 (bshTotals), :152 (bshBar), :84 (rangeMinGp), :162 (baselineOf)`; `web/lib/socialShare/modules/nightlyFloor.ts:88-94 (floorAverage, floorAdmitted)`; `web/lib/socialShare/modules/roleWatch.ts:38-43 (meanSeconds, roleChange)`; `web/lib/socialShare/modules/whatChanged.ts:71 (coverageAdmits), :95 (metricChange), :152 (gameValue per-60)`; `web/lib/socialShare/modules/lastNightsStandouts.ts:45 (baselineOf), :59 (percentChange), :90 (averageChange)`; `web/lib/socialShare/modules/roleWatch.ts:40 roleChange`; `web/lib/socialShare/modules/whatChanged.ts:74 metricWindow`; `web/lib/socialShare/modules/whatChanged.ts:95 metricChange`; `web/lib/socialShare/modules/lastNightsStandouts.ts:45 baselineOf`; `web/lib/socialShare/modules/lastNightsStandouts.ts:59 percentChange`; `web/lib/socialShare/modules/lastNightsStandouts.ts:90 averageChange`; `web/lib/socialShare/modules/lastNightsStandouts.ts:158 goalieStats`
- **Tags (heuristic):** denominators: per 60, per game, per appearance, shots on goal; generation: current
- **Opus view (MISC-037):**
  - Method: BSH = blocks+shots+hits totals and per game; bar shares = component/sum. Range min GP = min(5, max(1, ceil(mostGames/2))). Nightly floor: share of appearances meeting a threshold (whole-number thresholds as X+1), admitted if known >= minCoverage%. Role Watch: mean TOI/PP TOI seconds per appearance recent vs baseline; qualifies if \|change\| >= minimum. What Changed: per-60 = value/TOI_seconds*3600, xGF% pooled; NST admitted if observed*100 >= minCoverage*expected. Standouts: % change = (last - baseline)*100/baseline; Avg = mean of changes capped +/-200% across stats whose baseline >= floors (SOG 0.75, TOI 600 s, iCF 2, iSCF 0.75, xG 0.05, xG% 35, PPTOI 30 s), needing >= 4 stats.
  - Inputs/units: counts; TOI seconds; sources: wgo_skater_stats, nst game logs (counts / on-ice)
  - Output scale: per game / per 60 / percent; writes: —
  - Status: live
  - Consumers: share cards
- **Codex view (SOC-CHANGE, calculation, location; Codex family 'Social-share calculations'):** Role Watch and What Changed window deltas
  - Purpose: Describe opportunity and performance changes across selected windows.
  - Inputs/units: Appearance event totals, TOI/PP seconds, for/against counts, configured windows/coverage.
  - Output scale: TOI mean seconds and difference; rates per game/per60; pooled share percent; current−baseline deltas and competition ranks.
  - Version/status: Local retrospective calculations. Production deployment/active database state not checked.
- **Codex view (SOC-STANDOUT, calculation, location; Codex family 'Social-share calculations'):** Last Night Standouts and baseline deviations
  - Purpose: Compare one-game skater/goalie outputs against prior appearances.
  - Inputs/units: Last game counts/ratios; historical per-game baselines, pooled SV/GAA, NST GSAx.
  - Output scale: Relative percent change for counts; absolute SV/GAA/GSAx changes; average admitted skater-stat changes.
  - Version/status: Retrospective share-card layer. Production deployment/active database state not checked.
- **Audit context:**
  - Intent (Opus): web/lib/socialShare/modules/lastNightsStandouts.ts:80-86 (average rule); bshBoard.ts:82 'Half the most games anyone played there, rounded up, and never above the season default of 5.'
  - Intended contract (Codex SOC-CHANGE): WGO requires complete coverage; NST configurable minimum. Role change must be nonzero and absolute delta at least selected minimum.
  - Intended contract (Codex SOC-STANDOUT): Minimum prior games/coverage and minimum included stats gate output; NST GSAx=xGA−GA.
  - External references: NST per-60 conventions
  - Fixtures/test data: none listed
  - Tests: `web/lib/socialShare/modules/bshBoard.test.ts`; `web/lib/socialShare/modules/lastNightsStandouts.test.ts`; `web/lib/socialShare/modules/nightlyFloor.test.ts`; `web/lib/socialShare/modules/roleWatch.test.ts`; `web/lib/socialShare/modules/whatChanged.test.ts`
- **Leads (not audited):**
  - (codex:SOC-CHANGE) No mathematical accuracy or fitness assessment performed. Tests listed, not run.
  - (codex:SOC-STANDOUT) No mathematical accuracy or fitness assessment performed. Tests listed, not run.

## M-MISC-011 Multi-cat percentile composite (Multi Cat Monsters / Points-First) and Multi-Cat Stars raw sum

- **Match:** Both; Opus MISC-038; Codex SOC-CAT
- **Purpose:** Rank skaters across points/shots/hits/blocks.
- **Where:** `web/lib/socialShare/modules/categoryBlueprint.ts:49-66 (categoryPercentiles, multiCatScore)`; `web/lib/socialShare/modules/categoryBlueprint.ts:22-28 (WEIGHTS, POINTS_FIRST_FLOOR)`; `web/lib/socialShare/modules/multiCatStars.ts:32, :64 (multiCatScore raw sum)`; `web/lib/socialShare/modules/multiCatStars.ts:73-85 (radar percentiles via calculateRankingResult)`; `web/lib/socialShare/modules/categoryBlueprint.ts:53 categoryPercentiles`; `web/lib/socialShare/modules/categoryBlueprint.ts:63 multiCatScore`
- **Tags (heuristic):** percent scale: 0-100; denominators: per game, shots on goal; generation: current
- **Opus view (MISC-038):**
  - Method: Blueprint: percentile = (below + ties/2)*100/(n-1) among known skaters (lone = 50); score = weighted mean (standard 1,1,1,1; points-first 2,1,1,1), any missing -> null; points-first requires points percentile >= 85. Stars: score = w*points + blocks + shots + hits (w 1 standard / 2 pointsFirst), total or per game; radar percentiles = (below + half equal)/cohort.
  - Inputs/units: per-game counts; sources: wgo_skater_stats game rows
  - Output scale: 0-100 percentile; raw count sum; writes: —
  - Status: live
  - Consumers: Multi Cat cards
- **Codex view (SOC-CAT, calculation, location; Codex family 'Social-share calculations'):** Category Blueprint multi-category percentile score
  - Purpose: Rank four-category contributions on equal or points-first weighting.
  - Inputs/units: Per-game points, SOG, hits and blocks for eligible cohort.
  - Output scale: 0–100 percentiles counting other-player ties as half; lone player=50; weighted mean score 0–100, 6 decimals.
  - Version/status: Local implemented share-card metric. Production deployment/active database state not checked.
- **Audit context:**
  - Intent (Opus): web/lib/socialShare/modules/categoryBlueprint.ts:18 'TJ's decision: this card alone ranks on a combined score'; :49-52
  - Intended contract (Codex SOC-CAT): Standard mean of four categories; points-first (2*PTS+SOG+HITS+BLK)/5; any missing category leaves score null.
  - External references: Percentile-rank composites
  - Fixtures/test data: none listed
  - Tests: `web/e2e/social-share-multi-cat-stars.spec.ts`; `web/lib/socialShare/modules/categoryBlueprint.test.ts`; `web/lib/socialShare/modules/multiCatStars.test.ts`
- **Leads (not audited):**
  - (opus) multiCatStars ranks on a RAW SUM of counts (hits/shots dominate points), while categoryBlueprint ranks on percentiles - two 'multi-cat' definitions on similar cards
  - (codex:SOC-CAT) No mathematical accuracy or fitness assessment performed. Tests listed, not run.

## M-MISC-012 Goalie share cards: GSAx, Crease Shift, Busy/Quiet, Rescue, Ratio Impact, Category Counts, Goalie Period ADP, Risky Starts

- **Match:** Both; Opus MISC-039; Codex SOC-RATIO, SOC-STARTER, category-counts-baselines
- **Purpose:** Goalie workload/performance metrics for share cards.
- **Where:** `web/lib/socialShare/modules/goalieGsax.ts:106-114 (GSAx, per-60)`; `web/lib/socialShare/modules/creaseShift.ts:81 (shareChange), :100-133`; `web/lib/socialShare/modules/busyQuiet.ts:12-21 (bases, NST_MIN_COVERAGE 0.9)`; `web/lib/socialShare/modules/goalieRescue.ts:140-147 (goodness tone)`; `web/lib/socialShare/modules/ratioImpact.ts:38-77 (pooled SV%/GAA, sensitivity)`; `web/lib/socialShare/modules/shared/categoryCounts.ts:40-73 (roundedRatio, baselines)`; `web/lib/socialShare/modules/goaliePeriod.ts:113-147 (ADP mean, undrafted value)`; `web/lib/socialShare/modules/riskyStarts.ts:35 (likelyStarter), :76 (riskyPairs)`; `web/lib/socialShare/modules/ratioImpact.ts:40 lineTotals`; `web/lib/socialShare/modules/ratioImpact.ts:58 ratioImpact`; `web/lib/socialShare/modules/riskyStarts.ts:35 likelyStarter`; `web/lib/socialShare/modules/riskyStarts.ts:43 goalieRoles` …
- **Tags (heuristic):** percent scale: both/ambiguous; denominators: per 60, per game, per team game; generation: current
- **Opus view (MISC-039):**
  - Method: GSAx = sum xGA - sum GA over covered window games (NST toi minutes*60 -> seconds); magnitude per 60 = \|GSAx\|/TOI*3600; admitted if appearances >= min and coverage% >= min. Crease share = starts/completed team games; change pp = (s*Bg - Bs*g)*100/(g*Bg). Busy/Quiet: workload per start/appearance/per 60. Rescue colour goodness = (v-min)/(max-min) (inverted for GAA). Ratio impact: pooled SV% = sum saves/sum SA, GAA = sum GA*3600/sum TOI s. Category Counts: count baseline = sum/known members, rates pooled, half-up integer rounding. Period ADP: mean Yahoo average pick; undrafted = ceil(max pick/10)*10. Risky starts: top/bottom-third flags (opp SF/GP & team SA/GP, xGF/xGA, SCF/SCA, PP% vs PK%, GF/GA, GD/GP); likely starter = most starts in last 10.
  - Inputs/units: NST TOI minutes; WGO TOI seconds; counts; sources: nst goalie game logs, wgo_goalie_stats, nst_team_stats / team rate views, yahoo_players, yahoo_nhl_player_map_read, goalie_weekly_aggregates, league_weekly_goalie_averages
  - Output scale: goals, per 60, percentage points, fractions; writes: —
  - Status: live
  - Consumers: goalie share cards
- **Codex view (SOC-RATIO, calculation, location; Codex family 'Social-share calculations'):** Goalie ratio impact and sensitivity
  - Purpose: Calculate pooled fantasy ratio effects from a hypothetical goalie line.
  - Inputs/units: Base and scenario shots/GA counts; minutes converted once to seconds.
  - Output scale: Saves=shots−GA; pooled SV fraction and GAA per60; after−before deltas; goals-range sensitivity.
  - Version/status: Local scenario calculator. Production deployment/active database state not checked.
- **Codex view (SOC-STARTER, calculation, location; Codex family 'Social-share calculations'):** Unconfirmed goalie likely-starter tie-break
  - Purpose: Choose a probable starter from recent workload and opponent record.
  - Inputs/units: L10 starts, recent trend starts, opponent wins/losses/OT losses, confirmations/B2B context.
  - Output scale: Likely starter/backup or split label; opponent win fraction W/(W+L+OTL).
  - Version/status: Local descriptive selection rule. Production deployment/active database state not checked.
- **Codex view (category-counts-baselines, calculation, location; Codex family 'Goalie Category Counts'):** Category game/week baselines and known/excluded counts
  - Purpose: Provide a comparison baseline without treating missing values as zero.
  - Inputs/units: CategoryParts members representing official starts (game baseline) or pool goalies (week baseline); category-specific numerator/denominator presence.
  - Output scale: Count baseline=SUM(known member values)/known members. Rate baseline=measure over summed known numerator/denominator components, not mean of member rates. Returns value and comparison value plus known/excluded metadata; no available baseline yields null value/comparable. A real zero count baseline remains valid.
  - Version/status: Supplement inspected 2026-11-10 on octoberBranch with observed HEAD 11e4192d36ecc4ac4b338f9ab48e529c7049c618. Earlier inventory was read at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; the checkout changed during the broader inventory and files may be live-mutating. Observed categoryCounts.ts SHA-256 92a4e82037e4a793e29f342dbc49d448ccf605b502d0e6152330ba6c36a6e890. This is not a frozen release snaps…
- **Audit context:**
  - Intent (Opus): web/lib/socialShare/modules/ratioImpact.ts:5-7 'Rates always come from summed saves/SA and GA/TOI seconds, never a mean of percentages.'; categoryCounts.ts:4-6; goalieGsax.ts:12-15
  - Intended contract (Codex SOC-RATIO): Scenario is arithmetic only, not a projected outcome distribution. Missing required base parts propagate.
  - Intended contract (Codex SOC-STARTER): Source-confirmed role precedes heuristic; L10 starts then shorter trend then opponent win share; unresolved ties stay split.
  - Intended contract (Codex category-counts-baselines): Explicit comment :62: count denominator is starts for game baseline, pool goalies for week baseline; rates pooled, never averaged. Adjacent tests :76–126 cover pooling, denominators, missing/zero and real-zero baseline.
  - External references: GSAx (MoneyPuck / Evolving-Hockey; NST xG model as source)
  - Fixtures/test data: none listed
  - Tests: `web/lib/socialShare/modules/busyQuiet.test.ts`; `web/lib/socialShare/modules/creaseShift.test.ts`; `web/lib/socialShare/modules/goalieGsax.test.ts`; `web/lib/socialShare/modules/goaliePeriod.test.ts`; `web/lib/socialShare/modules/goalieRescue.test.ts`; `web/lib/socialShare/modules/ratioImpact.test.ts`; `web/lib/socialShare/modules/riskyStarts.test.ts`; `{"discovered_not_run": ["web/lib/socialShare/modules/shared/categoryCounts.test.ts", "web/lib/socialShare/modules/goaliePeriod.test.ts"]}`
- **Leads (not audited):**
  - (opus) GSAx uses NST's xG model (not FHFH's own xG) - kept separate from TGV per comment
  - (opus) undrafted goalies imputed as max pick rounded up to 10 (any season row) inflates 'Avg ADP'
  - (codex:SOC-RATIO) No mathematical accuracy or fitness assessment performed. Tests listed, not run.
  - (codex:SOC-STARTER) No mathematical accuracy or fitness assessment performed. Tests listed, not run.
  - (codex:category-counts-baselines) Imported pooledSavePct, pooledGaa and competitionRanks implementations were not reopened in this bounded single-file supplement. Tests and source comments were inspected, not executed; external CONTRACT §3 document was not independently read.

## M-MISC-013 Social share L5 player score: L5 fantasy points per game x opportunity multiplier

- **Match:** Both; Opus MISC-041; Codex MISC-SHARE
- **Purpose:** Rank players on share cards (pickups, specialists, tiers).
- **Where:** `web/lib/socialShare/score.ts:21 (fantasyPointsPerGame)`; `web/lib/socialShare/score.ts:36 (opportunityMultiplier)`; `web/lib/socialShare/score.ts:46 (playerScore)`; `web/lib/socialShare/players.ts:212-260 (L5 / pre-L5 inputs)`; `web/lib/socialShare/score.ts:9 OPPORTUNITY`; `web/lib/socialShare/score.ts:25 fantasyPointsPerGame`; `web/lib/socialShare/score.ts:42 opportunityMultiplier`; `web/lib/socialShare/score.ts:52 playerScore`
- **Tags (heuristic):** denominators: per game, shots on goal; generation: current
- **Opus view (MISC-041):**
  - Method: FP/GP = (G*3 + A*2 + PPP*1 + SOG*0.2 + (HIT/GP*0.2 + BLK/GP*0.25)*games)/games; goalies (W*4 + SV*0.2 + GA*-1 + SO*3)/games. Multiplier = 1 + line bonus (L1 .15, L2 .10, L3 .05, P1 .10, P2 .05) + PP bonus (PP1 .10, PP2 .05) + clamp(+/-0.10, 0.02 per minute of L5 TOI vs 16:00 F / 20:00 D). Score = FP/GP * multiplier; season rate breaks ties.
  - Inputs/units: counts per game; TOI seconds; sources: wgo_skater_stats / rolling player last5 columns, line combination sources
  - Output scale: fantasy points per game (scaled); writes: —
  - Status: live — social share studio
  - Consumers: share cards (players.ts, tiers.ts, offNightEdge, teamStream)
- **Codex view (MISC-SHARE, calculation, location; Codex family 'Other product calculations'):** Social-share L5 fantasy-opportunity score
  - Purpose: Rank share-card players from recent fantasy rate and usage.
  - Inputs/units: L5 fantasy points/GP, EV line/pair, PP unit, L5 TOI; season rate tie-break.
  - Output scale: Fantasy points/game × opportunity multiplier; ordering.
  - Version/status: Local social-share score. Production deployment/active database state not checked.
- **Audit context:**
  - Intent (Opus): web/lib/socialShare/score.ts:4-8 'L5 ranking for every player card (TJ, ticket 15): fantasy points per game over the last five games... times an opportunity multiplier...'
  - Intended contract (Codex MISC-SHARE): Comment references TJ ticket 15; default scoring configuration, read-only; opportunity constants in module.
  - External references: Fantasy points per game; deployment-adjusted streaming ranks
  - Fixtures/test data: `web/lib/socialShare/pickupsFixture.ts`; `web/lib/socialShare/fixtures.ts`
  - Tests: `web/e2e/social-share.spec.ts`; `web/lib/socialShare/score.test.ts`
- **Leads (not audited):**
  - (opus) default league scoring hard-wired (not user league)
  - (opus) TOI baselines 16:00/20:00 fixed
  - (codex:MISC-SHARE) No mathematical accuracy or fitness assessment performed. Tests listed, not run.

## M-MISC-014 Ownership / ADP trend movement (risers/fallers)

- **Match:** Both; Opus MISC-043; Codex MISC-OWNERSHIP
- **Purpose:** Delta used by TopMovers and Transaction Trends.
- **Where:** `web/pages/api/v1/transactions/ownership-trends.ts:154 (calculateTrendMovement)`; `web/components/TopMovers/TopMovers.tsx:15-18 (bar)`; `web/components/TransactionTrends/OwnershipSparkline.tsx:50`; `web/pages/api/v1/transactions/ownership-trends.ts:154 calculateTrendMovement`
- **Tags (heuristic):** percent scale: 0-100; generation: current
- **Opus view (MISC-043):**
  - Method: Ownership: delta = latest - previous (percentage points), deltaPct = delta. ADP: delta = previous - latest (positive = rising), deltaPct = delta/previous*100. Bars: base min(\|d\|,100) + lap overflow.
  - Inputs/units: percent 0-100 ownership; ADP picks; sources: yahoo ownership/ADP history
  - Output scale: pp or %; writes: —
  - Status: live
  - Consumers: TopMovers; TransactionTrends; forge-dashboard TopAddsRail
- **Codex view (MISC-OWNERSHIP, calculation, location; Codex family 'Other product calculations'):** Ownership and ADP trend movement
  - Purpose: Convert adjacent source snapshots into direction-aware movement.
  - Inputs/units: Latest/previous ownership percent or positive ADP draft position.
  - Output scale: Ownership delta percentage points; ADP previous−latest and relative percent versus previous; 2-decimal rounding.
  - Version/status: Local API helper. Production deployment/active database state not checked.
- **Audit context:**
  - Intent (Opus): web/components/TransactionTrends/TransactionTrends.tsx:517-518 ('Δ = relative change in Yahoo! average draft pick...'; 'Δ = change in Yahoo! percent ownership (percentage points)')
  - Intended contract (Codex MISC-OWNERSHIP): ADP improvement reverses sign; ownership deltaPct equals raw percentage-point delta.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `No adjacent test located; broader suites not exhaustively traced.`; `web/components/TransactionTrends/TransactionTrends.test.tsx`; `web/components/forge-dashboard/TopAddsRail.test.tsx`
- **Leads (not audited):**
  - (opus) for ownership, 'deltaPct' equals the pp delta (not a percent change) - naming inconsistency
  - (codex:MISC-OWNERSHIP) No mathematical accuracy or fitness assessment performed. Tests listed, not run.

## M-MISC-015 Game Grid opportunity trend label (first vs last week)

- **Match:** Opus only; Opus MISC-003; Codex —
- **Purpose:** Labels a team's 4-week schedule opportunity as Rising/Falling/Flat.
- **Where:** `web/components/GameGrid/OpportunitySparkline.tsx:14 (getTrend)`; `web/components/GameGrid/OpportunitySparkline.tsx:87 (y scale)`
- **Tags (heuristic):** generation: current
- **Opus view (MISC-003):**
  - Method: Rising if last > first, Falling if last < first, Flat if equal; null if either missing. Sparkline clips values above shared scale.
  - Inputs/units: opportunity score; sources: scheduleOpportunity (GameGrid utils)
  - Output scale: 3-level label; writes: —
  - Status: live — Game Grid
  - Consumers: GameGrid DesktopMasterTable, FourWeekGrid
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/components/GameGrid/OpportunitySparkline.test.tsx`
- **Leads (not audited):**
  - (opus) no tolerance — any tiny difference is labelled Rising/Falling; middle weeks ignored

## M-MISC-016 Player bio unit conversions (age, height, weight)

- **Match:** Opus only; Opus MISC-004; Codex —
- **Purpose:** Derives age and imperial height/weight for player bios.
- **Where:** `web/components/RosterMatrix/RosterMatrixWrapper.tsx:502 (age)`; `web/components/RosterMatrix/RosterMatrixWrapper.tsx:510 (heightStr)`; `web/components/RosterMatrix/RosterMatrixWrapper.tsx:517 (weightLbs)`; `web/components/WiGO/playerBiography.ts:1 (formatHeight, formatWeight)`
- **Tags (heuristic):** generation: current
- **Opus view (MISC-004):**
  - Method: Roster matrix: age = floor((now - birth)/(365.25 days)); height feet = floor(cm/30.48), inches = round((cm % 30.48)/2.54); lbs = round(kg*2.20462). WiGO: inches = round(cm/2.54), feet = floor(in/12), rem = in%12; lbs same.
  - Inputs/units: cm, kg, date; sources: players
  - Output scale: years, ft/in, lbs; writes: —
  - Status: live
  - Consumers: TeamTabNavigation roster tab; WiGO player biography
- **Audit context:**
  - Intent (Opus): playerBiography.ts:12 comment on age at midnight UTC
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: none listed
- **Leads (not audited):**
  - (opus) roster-matrix height can print 12 inches (e.g. 182.5 cm -> 5'12"); WiGO formula rounds first and is correct — inconsistent definitions
  - (opus) roster age uses 365.25-day years, WiGO age advances at UTC midnight with Feb-29 rule

## M-MISC-017 Social share card tone encodings (changeTone, workload alpha, goalie spark scale)

- **Match:** Opus only; Opus MISC-005; Codex —
- **Purpose:** Small numeric-to-colour rules on share-card modules.
- **Where:** `web/components/SocialShare/modules/LastNightsStandoutsCard.tsx:13 (changeTone)`; `web/components/SocialShare/modules/BusyQuietCard.tsx:33 (workload alpha)`; `web/components/SocialShare/modules/GoaliePeriodCard.tsx:13 (POINTS_LOW/POINTS_HIGH)`
- **Tags (heuristic):** percent scale: fraction 0-1; generation: current
- **Opus view (MISC-005):**
  - Method: changeTone: neutral if null or round(change)==0, else good if >0, bad if <0. BusyQuiet tint alpha = round2(0.14 + 0.66*level), level = (v-low)/(high-low) (0.5 when flat). GoaliePeriod sparkline y-scale fixed to 1..20 points (values outside clip).
  - Inputs/units: mixed (deltas, shots, fantasy points); sources: lib/socialShare/modules/* outputs
  - Output scale: tone enum / 0-1 alpha; writes: —
  - Status: live — share studio modules
  - Consumers: pages/social-share studio modules
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: none listed
- **Leads (not audited):**
  - (opus) changeTone rounding means \|change\|<0.5 reads neutral regardless of metric scale
  - (opus) fixed POINTS_LOW=1/POINTS_HIGH=20 sparkline domain ignores scoring settings

## M-MISC-018 Social share Week Score five-tier colour band (tierOf)

- **Match:** Opus only; Opus MISC-006; Codex —
- **Purpose:** Colours each team on the Monday logo grid by its Week Score rank quintile.
- **Where:** `web/components/SocialShare/SocialShare.tsx:124 (SCORE_TIERS)`; `web/components/SocialShare/SocialShare.tsx:125 (tierOf)`; `web/components/SocialShare/SocialShare.tsx:130 (scoreTier, competition rank)`
- **Tags (heuristic):** generation: current
- **Opus view (MISC-006):**
  - Method: Competition rank = 1 + index of first ranked row with the same score (ties share rank). tier index = min(4, floor((rank-1)*5 / max(1,N))) -> tierBest/tierGood/tierAverage/tierBelow/tierWorst.
  - Inputs/units: rank ordinal; sources: social share snapshot (lib/socialShare mondayGridRows)
  - Output scale: 5-level ordinal colour band; writes: —
  - Status: live — rendered by pages/social-share/[format].tsx
  - Consumers: pages/social-share/[format].tsx (Monday grid PNG)
- **Audit context:**
  - Intent (Opus): SocialShare.tsx:123 comment: five Week Score tiers by rank among ranked teams, best (green) to worst (red); equal scores share a tier
  - External references: none suggested
  - Fixtures/test data: `web/components/SocialShare/SocialShare.test.tsx`
  - Tests: none listed
- **Leads (not audited):**
  - (opus) rank-quintile bands are relative, so a flat week still paints green-to-red extremes
  - (opus) implemented inline in the component, not in lib/socialShare like other share tiers (editionCountTiers)

## M-MISC-019 Social share recent-form line: L5 SV% and TOI delta vs season

- **Match:** Opus only; Opus MISC-007; Codex —
- **Purpose:** Builds the one-line recent form text for player spotlight cards.
- **Where:** `web/components/SocialShare/SocialShare.tsx:322 (recentLine)`; `web/components/SocialShare/SocialShare.tsx:329 (goalie SV%)`; `web/components/SocialShare/SocialShare.tsx:334 (TOI delta)`
- **Tags (heuristic):** percent scale: fraction 0-1; generation: current
- **Opus view (MISC-007):**
  - Method: Goalie: SV% = saves/shotsAgainst (3 dp, leading 0 stripped; '—' if SA=0); record = wins-(games-wins) (OTL folded into losses). Skater: delta = L5 TOI - season TOI (seconds); suppressed when \|delta\|<1 s; shown as signed m:ss.
  - Inputs/units: counts; TOI seconds; sources: social share player layer (recent form)
  - Output scale: SV% fraction 0-1; seconds; writes: —
  - Status: live — player spotlight
  - Consumers: pages/social-share/[format].tsx player spotlight
- **Audit context:**
  - Intent (Opus): SocialShare.tsx:333 comment: Relative TOI (ticket 15): L5 ice time against season average
  - External references: NHL SV% convention
  - Fixtures/test data: none listed
  - Tests: none listed
- **Leads (not audited):**
  - (opus) goalie record games-wins counts OT/SO losses and no-decisions as losses
  - (opus) 1-second delta threshold effectively shows any change

## M-MISC-020 Social share gold-glow availability strength (goldGlow)

- **Match:** Opus only; Opus MISC-008; Codex —
- **Purpose:** Glow intensity for widely available (low-rostered) players on Tuesday trend tiles.
- **Where:** `web/components/SocialShare/SocialShare.tsx:416 (goldGlow)`; `web/components/SocialShare/SocialShare.tsx:506 (trendColumns meta)`
- **Tags (heuristic):** percent scale: fraction 0-1; generation: current
- **Opus view (MISC-008):**
  - Method: glow = round2(clamp((50 - rostered)/25, 0, 1)); 0 at >=50% rostered or missing, 1 at <=25%.
  - Inputs/units: percent 0-100; sources: Yahoo ownership layer in social share snapshot
  - Output scale: 0-1 intensity; writes: —
  - Status: live — Tuesday trend tiles
  - Consumers: pages/social-share/[format].tsx Tuesday trends
- **Audit context:**
  - Intent (Opus): SocialShare.tsx:415 comment TT-16 (TJ): 0 at 50% rostered or more, 1 at 25% or less
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/components/SocialShare/SocialShare.test.tsx`
- **Leads (not audited):**
  - (opus) missing ownership treated as 0 glow (no availability signal), consistent with comment

## M-MISC-021 Social share pickup ownership band chip (bandChip)

- **Match:** Opus only; Opus MISC-009; Codex —
- **Purpose:** Labels a tier-list player with his Yahoo rostered band.
- **Where:** `web/components/SocialShare/SocialShare.tsx:678 (bandChip)`
- **Tags (heuristic):** generation: current
- **Opus view (MISC-009):**
  - Method: <20 -> '<20%'; <30 -> '20–29%'; else '30–49%'.
  - Inputs/units: percent 0-100; sources: Yahoo ownership layer
  - Output scale: 3-level ordinal label; writes: —
  - Status: live — tier list graphics
  - Consumers: pages/social-share/[format].tsx tier lists
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: none suggested
  - Fixtures/test data: `web/lib/socialShare/players.test.ts`
  - Tests: none listed
- **Leads (not audited):**
  - (opus) duplicate implementation of PICKUP_BANDS (web/lib/socialShare/players.ts:155)
  - (opus) no upper bound — any ownership >=50% is labelled '30–49%' (lib bands exclude >=50)

## M-MISC-022 Team Games Played (completed team games per team, competition ranked, coverage)

- **Match:** Opus only; Opus MISC-010; Codex —
- **Purpose:** Count completed games per team over a window, rank them, and report coverage against the schedule.
- **Where:** `web/lib/socialShare/modules/teamGames.ts:45 (buildTeamGames)`
- **Tags (heuristic):** generation: current
- **Opus view (MISC-010):**
  - Method: Window cut at the last fully reported night (completeThrough). games per team = distinct game ids; expected = scheduled games * 2; missing = max(0, expected - observed); ready only if missing = 0. Teams ranked by games with competitionRanks (ties share rank).
  - Inputs/units: game counts; sources: wgo_team_stats, games
  - Output scale: integer counts and ranks; writes: —
  - Status: live — share module team-games
  - Consumers: web/components/SocialShare/modules/TeamGamesCard
- **Audit context:**
  - Intent (Opus): web/lib/socialShare/modules/teamGames.ts:40-43 comment
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/socialShare/modules/teamGames.test.ts`
- **Leads (not audited):**
  - (opus) count of games played, not remaining games (unlike Week Score / off-night posts)

## M-MISC-023 Yahoo-NHL fuzzy name match confidence

- **Match:** Opus only; Opus MISC-011; Codex —
- **Purpose:** Threshold and score fuzzy name matches when mapping Yahoo players to NHL IDs
- **Where:** `web/lib/supabase/Upserts/Yahoo/player_name_matcher.py:92 (score_name_parts)`; `web/lib/supabase/Upserts/Yahoo/player_name_matcher.py:108 (best_qualified_name_match), :174 (best_qualified_player_match)`; `web/lib/supabase/Upserts/Yahoo/populate_yahoo_nhl_mapping.py:264`; `web/lib/supabase/Upserts/Yahoo/populate_yahoo_nhl_mapping.py:412`
- **Tags (heuristic):** percent scale: 0-100; generation: current
- **Opus view (MISC-011):**
  - Method: fuzzywuzzy ratio on last and first name separately; require last>=90 and first>=50; combined = 0.7*last + 0.3*first; ties left unresolved
  - Inputs/units: 0-100 fuzz ratios; sources: yahoo_players, players
  - Output scale: 0-100 confidence; writes: yahoo_nhl_player_map
  - Status: live — mapping maintenance scripts
  - Consumers: Yahoo ownership joins (yahoo_player_ownership_daily) used by ownership/BLSH/RSO surfaces
- **Audit context:**
  - Intent (Opus): module docstring player_name_matcher.py:1 ('Deterministic name normalization and thresholded fuzzy player matching')
  - External references: none suggested
  - Fixtures/test data: `web/lib/supabase/Upserts/Yahoo/player_name_normalization_spec.json`; `web/lib/supabase/Upserts/Yahoo/name_mapping_todo.json`
  - Tests: `web/lib/supabase/Upserts/Yahoo/test_player_name_matcher.py`; `web/lib/supabase/Upserts/Yahoo/test_yahoo_identity_promotion.py`

## M-MISC-024 CSV player-name fuzzy match (Levenshtein similarity)

- **Match:** Opus only; Opus MISC-012; Codex —
- **Purpose:** Match uploaded CSV player names to players.id.
- **Where:** `web/pages/api/v1/db/upsert-csv.ts:38 (similarityRatio)`; `web/pages/api/v1/db/upsert-csv.ts:77 (firstNameSimilar)`; `web/pages/api/v1/db/upsert-csv.ts:183 (threshold)`
- **Tags (heuristic):** percent scale: fraction 0-1
- **Opus view (MISC-012):**
  - Method: similarity = (maxLen - LevenshteinDistance)/maxLen on normalized names, accept >= 0.9; first names also match on common-prefix ratio >= 0.5 or alias table (josh/jake/mike...).
  - Inputs/units: —; sources: players
  - Output scale: similarity 0-1; writes: dynamic CSV upload table with player_id FK
  - Status: unknown — route ledger calls=1
  - Consumers: admin CSV import
- **Audit context:**
  - Intent (Opus): Comment upsert-csv.ts:37 'Simple normalized similarity ratio using Levenshtein distance'
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: none listed
- **Leads (not audited):**
  - (opus) prefix ratio >= 0.5 makes 'Alex' ~ 'Alexis' style first-name matches; false merges possible

## M-MISC-025 Goals correlation analysis

- **Match:** Opus only; Opus MISC-013; Codex —
- **Purpose:** Correlate per-game stats with goals scored
- **Where:** `web/scripts/goals_correlation_analysis.py:151 (clean_data)`; `web/scripts/goals_correlation_analysis.py:184 (calculate_correlations)`
- **Tags (heuristic):** denominators: per 60, per game; generation: legacy, research
- **Opus view (MISC-013):**
  - Method: Pearson corrwith goals over player-game rows, goal-derived columns excluded, sorted by \|r\|
  - Inputs/units: per-game counts and per-60 rates; sources: player_stats_unified (REST, season 20242025)
  - Output scale: r -1..1; writes: —
  - Status: legacy/dead — research script
  - Consumers: none (research)
- **Audit context:**
  - Intent (Opus): module docstring web/scripts/goals_correlation_analysis.py:2-13
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: none listed
- **Leads (not audited):**
  - (opus) per-game rows pool all players and positions; r dominated by TOI/role differences

## M-MISC-026 Top scorers relationship analysis (points percentile, point-biserial, Cohen's d)

- **Match:** Opus only; Opus MISC-014; Codex —
- **Purpose:** Find season-total metrics associated with high point totals by forwards vs defense
- **Where:** `web/scripts/top_scorers_relationship_analysis.py:120 (load_wgo_totals)`; `web/scripts/top_scorers_relationship_analysis.py:286 (compute_correlations)`; `web/scripts/top_scorers_relationship_analysis.py:377 (analyze_percentile_buckets)`; `web/scripts/top_scorers_relationship_analysis.py:505 (top5_vs_rest)`; `web/scripts/top_scorers_relationship_analysis.py:561 (compute_correlations_zscore)`
- **Tags (heuristic):** percent scale: 0-100; generation: legacy, research
- **Opus view (MISC-014):**
  - Method: points percentile = rank(pct)*100 within F or D pooled across all seasons; buckets 0-5,5-10,10-20,20-50,50-80,80-90,90-95,95-100; Pearson vs percentile; top-5% indicator point-biserial r; Cohen's d with pooled SD (ddof 1); z-scored (ddof 1) correlations and bucket means
  - Inputs/units: season totals; sources: wgo_skater_stats_totals, player_totals_unified (seasons 20222023-20242025)
  - Output scale: percentile 0-100, r, Cohen's d; writes: local CSV/PNG files
  - Status: legacy/dead — research script
  - Consumers: none (research)
- **Audit context:**
  - Intent (Opus): module docstring web/scripts/top_scorers_relationship_analysis.py:2-23
  - External references: Cohen's d; point-biserial correlation
  - Fixtures/test data: none listed
  - Tests: none listed
- **Leads (not audited):**
  - (opus) correlations of z-scored features are identical to raw Pearson r (linear transform), so the zscore outputs are redundant
  - (opus) season point totals not normalized by games played, so injury-shortened seasons fall to low percentiles

## M-MISC-027 Dashboard source-date alignment gap (recency state)

- **Match:** Opus only; Opus MISC-015; Codex —
- **Purpose:** Classify whether the trends/dashboard feeds come from the same date and warn when projection/start context mixes dates.
- **Where:** `web/lib/dashboard/dataFetchers.ts:340 (buildDashboardRecencyState)`; `web/lib/dashboard/dataFetchers.ts:374 (gapDays)`; `web/lib/dashboard/dataFetchers.ts:559 (samplePolicy minimumGames 3, seriesGames 40, lowSamplePercentiles shrink_to_neutral defaults)`
- **Tags (heuristic):** generation: current
- **Opus view (MISC-015):**
  - Method: Keep feeds with a YYYY-MM-DD date. Fewer than 2 → insufficient. gapDays = round((max − min)/86,400,000). gapDays <= 3 → aligned; otherwise mixed, with the warning that projection and start context is downgraded until feeds converge.
  - Inputs/units: dates (UTC midnight); sources: dashboard API payloads (trends, CTPI, SOS, FORGE, start chart)
  - Output scale: days (integer); categorical status; writes: —
  - Status: live — trends page dashboard fetch
  - Consumers: web/pages/trends/index.tsx:1212 (warning banner with gap); web/pages/trends/index.tsx:1709 ('Context downgraded' label on Projections panel)
- **Audit context:**
  - Intent (Opus): dataFetchers.ts:383 warning text: source dates are not safely aligned; projection and start context is downgraded until the feeds converge
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: none listed
- **Leads (not audited):**
  - (opus) the warning says context is 'downgraded' but the observed consumers only render a label; no numeric down-weighting was found
  - (opus) a 3-day tolerance lets FORGE projections and start chart from different slates show as aligned

## M-MISC-028 Date Range Matrix TOI shares and goalie ratios

- **Match:** Opus only; Opus MISC-016; Codex —
- **Purpose:** Line/pair shared TOI percentages and goalie ratios over a date range.
- **Where:** `web/components/DateRangeMatrix/fetchAggregatedData.ts:724-725 (SV%, GAA)`; `web/components/DateRangeMatrix/fetchAggregatedData.ts:1210-1236 (TOI shares)`; `web/components/DateRangeMatrix/useTOIData.tsx:795-842`; `web/components/DateRangeMatrix/utilities.ts:86`
- **Tags (heuristic):** generation: current
- **Opus view (MISC-016):**
  - Method: share% = pair seconds / player total TOI *100 (or / total game length); avg TOI = total/games; SV% = saves/SA; GAA = GA*3600/TOI s.
  - Inputs/units: seconds; sources: shift charts / game TOI tables
  - Output scale: percent; writes: —
  - Status: live
  - Consumers: pages/drm
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/__tests__/pages/drm.test.tsx`; `web/components/DateRangeMatrix/fetchAggregatedData.test.ts`; `web/components/DateRangeMatrix/useTOIData.test.ts`

## M-MISC-029 FORGE command center: momentum/trust and power-score deltas

- **Match:** Opus only; Opus MISC-017; Codex —
- **Purpose:** Momentum quadrant and team power terminal summaries.
- **Where:** `web/components/forge-command-center/PlayerInsightCore.tsx:113-176 (momentumRows)`; `web/components/forge-command-center/TeamPowerTerminal.tsx:73-95`
- **Opus view (MISC-017):**
  - Method: trust = mean percentile across categories; momentum = mean rank delta; hot >=1.5, cold <=-1.5, warm trust>=60 else sliding; top 7 by \|momentum\|. Team: league average power score; delta vs league; fallback sparkline [score-\|trend10\|, score-trend10/2, score] when spark missing.
  - Inputs/units: percentiles 0-100; ranks; sources: trends API (skaterTrends), team power API
  - Output scale: labels; writes: —
  - Status: unknown — no tests found
  - Consumers: FORGE command center
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: none listed
- **Leads (not audited):**
  - (opus) fallback sparkline is synthesized from trend10, not observed history

## M-MISC-030 Player pickup table percentile composite

- **Match:** Opus only; Opus MISC-019; Codex —
- **Purpose:** Rank free agents by mean percentile across selected stats.
- **Where:** `web/components/PlayerPickupTable/PlayerPickupTable.tsx:2543 (computePercentile)`; `web/components/PlayerPickupTable/PlayerPickupTable.tsx:2564 (computeInvertedPercentile)`; `web/components/PlayerPickupTable/PlayerPickupTable.tsx:2588 (assignPercentiles)`; `web/components/PlayerPickupTable/PlayerPickupTable.tsx:2698 (display score modes)`
- **Tags (heuristic):** percent scale: 0-100; generation: current
- **Opus view (MISC-019):**
  - Method: Percentile = (below + 0.5*equal)/count*100 (lone = 50; inverted for GAA only). Composite = mean percentile over non-null metrics. Single-metric mode sorts by that metric and displays mean of the others; multiple mode = mean of selected.
  - Inputs/units: season totals; sources: yahoo/wgo unified player data
  - Output scale: 0-100; writes: —
  - Status: live
  - Consumers: pages/player-pickup / PlayerPickupTable
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: Percentile rank (mid-rank ties)
  - Fixtures/test data: none listed
  - Tests: `web/components/PlayerPickupTable/PlayerPickupTable.test.ts`; `web/e2e/player-pickup.spec.ts`
- **Leads (not audited):**
  - (opus) percentiles on season TOTALS (not per game) - rewards games played; GP% also included in composite
  - (opus) SA (shots against) treated higher-is-better

## M-MISC-031 Poisson score distribution chart (game page)

- **Match:** Opus only; Opus MISC-021; Codex —
- **Purpose:** Show scoreline probabilities and win split for a game.
- **Where:** `web/components/PoissonDistributionChart.jsx:9-17 (poissonProbability, factorial)`; `web/components/PoissonDistributionChart.jsx:86-145 (grid, normalization, adjusted win %)`; `web/pages/game/[gameId].tsx:607, 627 (lambda inputs)`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: per game; generation: current
- **Opus view (MISC-021):**
  - Method: Independent Poisson P(i,j) = Pois(i;lh)*Pois(j;la) for 0..10 goals; renormalize if total off by >1%; adjusted win% = homeWins/(homeWins+awayWins)*100 (draws reallocated proportionally).
  - Inputs/units: goals per game; sources: team season stats (goalsForPerGame)
  - Output scale: probability %; writes: —
  - Status: live — game page
  - Consumers: pages/game/[gameId].tsx
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: Poisson / bivariate Poisson goal models (Maher 1982, Dixon-Coles)
  - Fixtures/test data: none listed
  - Tests: `web/__tests__/pages/game.test.tsx`
- **Leads (not audited):**
  - (opus) lambda = team's own GF/GP only - ignores opponent GA, home ice, goalie (code comment 'Assuming this is the intended value')
  - (opus) ties split proportionally rather than via OT/shootout model

## M-MISC-032 Team schedule calendar game rating and standings tiers

- **Match:** Opus only; Opus MISC-022; Codex —
- **Purpose:** Colour team games and standings positions.
- **Where:** `web/components/TeamScheduleCalendar/TeamScheduleCalendar.tsx:416 (calculateGameRating)`; `web/components/TeamScheduleCalendar/TeamScheduleCalendar.tsx:762-870 (home/away averages)`; `web/components/TeamScheduleCalendar/TeamScheduleCalendar.tsx:2210-2250 (class helpers)`
- **Tags (heuristic):** generation: current
- **Opus view (MISC-022):**
  - Method: Score: W +3, OTL +1; opponent strong +1 / weak -1; GD >2 +1 / <-2 -1; shot diff >5 +0.5 / <-5 -0.5; >=4 excellent, >=2.5 good, >=1 average. Points >=100/90/80; pct >=60/50/40; last-10 win rate >=.7/.6/.4/.3; rank percentile <=15/35/65/85.
  - Inputs/units: counts; sources: team schedule + game stats
  - Output scale: labels; writes: —
  - Status: live
  - Consumers: team pages
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/components/TeamScheduleCalendar/TeamScheduleCalendar.test.tsx`
- **Leads (not audited):**
  - (opus) magic thresholds; points thresholds assume full-season totals

## M-MISC-033 Skater variance: production proxy and game volatility

- **Match:** Opus only; Opus MISC-023; Codex —
- **Purpose:** Rank skaters by production and per-game volatility.
- **Where:** `web/components/Variance/skaterVariance.ts:33 (standardDeviation)`; `web/components/Variance/skaterVariance.ts:46 (calculateSkaterProductionProxy)`; `web/components/Variance/skaterVariance.ts:48 (buildSkaterVarianceRows)`
- **Tags (heuristic):** denominators: per game; generation: current
- **Opus view (MISC-023):**
  - Method: proxy = points + 0.1*shots per game; volatility = POPULATION sd (divide by n) of proxies; TOI/G = sum toi_per_game / GP.
  - Inputs/units: counts per game; sources: wgo_skater_stats
  - Output scale: proxy points; sd; writes: —
  - Status: live
  - Consumers: pages/variance/skaters.tsx
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/components/Variance/skaterVariance.test.ts`
- **Leads (not audited):**
  - (opus) 0.1 shot weight arbitrary; population vs sample sd differs from lib/scoring sample sd

## M-MISC-034 NST rate-limit plan assessment

- **Match:** Opus only; Opus MISC-024; Codex —
- **Purpose:** Check that a planned NST request cadence fits all rolling windows.
- **Where:** `web/lib/cron/nstRateLimitPolicy.ts:74 (assessNstRequestPlan)`; `web/lib/cron/nstRateLimitPolicy.ts:60 (getProjectedRequestsInWindow)`; `web/lib/cron/nstRateLimitPolicy.ts:100-130 (canBurst, semi-burst, selectNstSafeInterval)`; `web/lib/cron/nstCoordination.ts:17-51 (cron burst gaps)`
- **Tags (heuristic):** generation: current
- **Opus view (MISC-024):**
  - Method: Projected requests per window = min(count, floor(window/interval)+1) (all at once if interval 0); windows 1m<=39, 5m<=80, 15m<=100, 1h<=180; compliant also requires count<=39 or interval>=21 s. Semi-burst eligible if <=78 (two 39-waves). Token constants: 10 tokens/page, 1800 standard cap, 150 refresh, 800 burst cap. Cron jobs spaced >=10 min (NST_MIN_CRON_BURST_GAP_MS).
  - Inputs/units: ms, request counts; sources: —
  - Output scale: boolean + projected counts; writes: —
  - Status: live
  - Consumers: NST cron jobs / burst plans (lib/cron/nstBurstPlans.ts)
- **Audit context:**
  - Intent (Opus): web/lib/cron/nstRateLimitPolicy.ts:26-28 'All four unique-URL windows apply across participating jobs. Only a complete job below40 URLs may burst.'
  - External references: AGENTS.md / memory NST limits: 40/1m, 80/5m, 100/15m, 180/h
  - Fixtures/test data: none listed
  - Tests: `web/lib/cron/nstRateLimitPolicy.test.ts`
- **Leads (not audited):**
  - (opus) legacy token-bucket constants (1800/150/800) coexist with the 4-window model - possibly dead or inconsistent
  - (opus) assessment is per-plan, not across concurrent jobs (comment defers to ledger)

## M-MISC-035 X poller health thresholds (coverage, read success, fail streak)

- **Match:** Opus only; Opus MISC-025; Codex —
- **Purpose:** Classify each X/Twitter source account's poller health.
- **Where:** `web/lib/cron/xPollerHealth.ts:21-31 (thresholds)`; `web/lib/cron/xPollerHealth.ts:120-185 (read streaks, gaps)`; `web/lib/cron/xPollerHealth.ts:188 (accountStatus)`; `web/lib/cron/reportMetrics.ts:69 (isNearRepositoryLimit)`
- **Tags (heuristic):** generation: current
- **Opus view (MISC-025):**
  - Method: coverage = (beforeSwitch - missed)/beforeSwitch (grace 10 min); healthy >= 0.98, critical < 0.90 with >1 miss; read success rate warning < 0.8, critical < 0.5; fail streak >= 8 runs (~16 min) alert; stale feed 20 min; worst status wins. Cron near limit: duration >= 0.9 * maxDuration.
  - Inputs/units: rates 0-1; minutes; sources: x_timeline_poll_runs, x_timeline_poll_job_runs, x_timeline_alert_state, IFTTT receipts
  - Output scale: status enum; writes: —
  - Status: live — cron report
  - Consumers: CronReportEmail PollerHealthSection
- **Audit context:**
  - Intent (Opus): web/lib/cron/xPollerHealth.ts:21 'The cutover bar from the IFTTT-TO-FXTWITTER-CUTOVER debrief: coverage of at least 98%.'
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/__tests__/pages/api/v1/db/cron-report.test.ts`; `web/lib/cron/reportMetrics.test.ts`; `web/lib/cron/xPollerHealth.test.ts`

## M-MISC-036 Homepage game analytics: shots on goal sum and xG attach

- **Match:** Opus only; Opus MISC-026; Codex —
- **Purpose:** Attach per-game xG and SOG to homepage game cards.
- **Where:** `web/lib/homepageGameAnalytics.ts:255-300`
- **Tags (heuristic):** denominators: shots on goal; generation: current
- **Opus view (MISC-026):**
  - Method: SOG = shots_es + shots_pp + shots_pk (finite parts); xG = xg_for by team; pregame score age limit 48 h.
  - Inputs/units: counts, xG goals; sources: team game xG table, team game strength stats
  - Output scale: counts; writes: —
  - Status: live
  - Consumers: HomepageGamesSection
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/homepageGameAnalytics.test.ts`
- **Leads (not audited):**
  - (opus) SOG sum omits other strengths (e.g. 4v4/3v3 OT, empty-net) if not included in es/pp/pk buckets

## M-MISC-037 Homepage pulse: model-vs-market edge series

- **Match:** Opus only; Opus MISC-027; Codex —
- **Purpose:** Sparkline of absolute model-vs-market win-probability edge.
- **Where:** `web/lib/homepagePulse.ts:50 (embeddedMarketEdge)`; `web/lib/homepagePulse.ts:76 (bucketObservations)`; `web/lib/homepagePulse.ts:109-152 (snapshot edges)`; `web/lib/homepagePulse.ts:155 (buildHomepagePulsePoints)`
- **Tags (heuristic):** percent scale: fraction 0-1; generation: current
- **Opus view (MISC-027):**
  - Method: edge = \|model home win prob - no-vig market prob\| using the latest prediction computed before capture (and before puck drop) or embedded edge; bucket max per 15 min; downsample to MAX_PULSE_POINTS. Fallback when <2 market observations: \|p - 0.5\|.
  - Inputs/units: probability 0-1; sources: game_prediction_history, market snapshot table
  - Output scale: absolute probability difference 0-0.5; writes: —
  - Status: live — homepage
  - Consumers: components/HomePage/HomepagePulse.tsx
- **Audit context:**
  - Intent (Opus): web/lib/homepagePulse.ts:196-199 'Historical rows predate market-snapshot persistence. Their changing distance from 50% keeps the offseason pulse real until market capture resumes'
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/components/HomePage/HomepagePulse.test.tsx`; `web/lib/homepagePulse.test.ts`
- **Leads (not audited):**
  - (opus) fallback silently switches the plotted quantity from 'edge vs market' to 'distance from 50%' - same chart, different meaning

## M-MISC-038 Weekly/matchup-week fantasy points from game logs

- **Match:** Opus only; Opus MISC-029; Codex —
- **Purpose:** Per-game and per-matchup-week fantasy points for a player.
- **Where:** `web/hooks/usePlayerMatchupWeekStats.ts:121-165`; `web/hooks/usePlayerWeeklyStats.ts:114-135`
- **Tags (heuristic):** denominators: per game; generation: current
- **Opus view (MISC-029):**
  - Method: FP_game = sum stat*pointValue over mapped columns; week totals and avg FP/GP = totalFP/totalGP.
  - Inputs/units: counts; sources: wgo_skater_stats, yahoo_matchup_weeks
  - Output scale: fantasy points; writes: —
  - Status: live — usePlayerMatchupWeekStats used by components/Projections/PlayerMatchupWeekPerformanceChart.tsx; usePlayerWeeklyStats used by pages/projections/index.tsx
  - Consumers: components/Projections/PlayerMatchupWeekPerformanceChart.tsx; pages/projections/index.tsx
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: none listed
- **Leads (not audited):**
  - (opus) does not apply defense-specific HITS_D/BLOCKED_SHOTS_D values (draft dashboard does)

## M-MISC-039 Tweet identity candidates (bounded edit distance) and news phrase / mention scoring

- **Match:** Opus only; Opus MISC-030; Codex —
- **Purpose:** Rank candidate players for names in tweets and mine phrases.
- **Where:** `web/lib/sources/tweetIdentityCandidates.ts:22 (boundedDistance)`; `web/lib/sources/tweetIdentityCandidates.ts:60-90 (candidate ranking, limit 40/80)`; `web/lib/sources/tweetNewsAutomation.ts:480-494 (phrase score)`; `web/lib/sources/tweetNewsInference.ts:244-247 (mention score)`; `web/lib/sources/tweetLunaEvaluationScoring.ts:9 (scoreLunaEvaluation)`; `web/lib/sources/tweetDecisionReviewResults.ts:9-25 (probability validation)`
- **Tags (heuristic):** generation: current
- **Opus view (MISC-030):**
  - Method: Levenshtein with bound (transposition = 2 edits). Phrase score = n-gram size + 3*hockey words - stop words, kept if >1 (n=2..5). Mention score 2 full name, 1 last name. Luna decision relevance = probability > 0.5; choice distributions must sum to 1 +/- 0.001.
  - Inputs/units: strings; sources: player identity snapshot, tweet tables
  - Output scale: scores / booleans; writes: —
  - Status: live
  - Consumers: news automation / review tools
- **Audit context:**
  - Intent (Opus): web/lib/sources/tweetLunaEvaluationScoring.ts:5-8 'Compare with predeclared labels, never derive truth from validator acceptance.'
  - External references: none suggested
  - Fixtures/test data: `web/lib/sources/fixtures/tweetLunaEvaluation.ts`; `web/lib/sources/fixtures/tweetLunaAdjudicatedLibrary.json`; `web/lib/sources/fixtures/tweetIdentitySavedEvidence.json`
  - Tests: `web/lib/sources/tweetIdentityCandidates.test.ts`; `web/lib/sources/tweetLunaReview.test.ts`; `web/lib/sources/tweetNewsAutomation.test.ts`; `web/lib/sources/tweetNewsInference.test.ts`

## M-MISC-040 Goalie weekly league averages (pages/goalies.js)

- **Match:** Opus only; Opus MISC-034; Codex —
- **Purpose:** League weekly goalie averages for weekly ranking comparisons.
- **Where:** `web/pages/goalies.js:210 (buildLeagueWeeklyAverage)`; `web/pages/goalies.js:355-390 (summary sort keys)`
- **Tags (heuristic):** generation: current
- **Opus view (MISC-034):**
  - Method: Per week: counting stats / goalieCount; SV% = sum saves/sum SA; GAA = sum GA*3600/sum TOI (seconds).
  - Inputs/units: seconds; counts; sources: goalie weekly tables
  - Output scale: per-goalie averages; writes: —
  - Status: live
  - Consumers: goalies page (TGV-related)
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: none listed

## M-MISC-041 Trends pages: percentile smoothing and hot/cold team selection

- **Match:** Opus only; Opus MISC-035; Codex —
- **Purpose:** Smooth rolling percentile series and select movers.
- **Where:** `web/pages/trends/placeholder.tsx:355-380 (trailing moving average)`; `web/pages/trends/placeholder.tsx:295 (doc: weighted last-10 average 1.0..0.1)`; `web/pages/trends/index.tsx:690-735 (improved/degraded, hot/cold)`
- **Tags (heuristic):** percent scale: 0-100; generation: legacy, current
- **Opus view (MISC-035):**
  - Method: Trailing window mean of percentiles; hot = percentile>=70 or delta>=2; cold = percentile<=35 or delta<=-2.
  - Inputs/units: percentile 0-100; sources: trends API
  - Output scale: 0-100; writes: —
  - Status: live (trends/index) / legacy (placeholder)
  - Consumers: /trends
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: none listed
- **Leads (not audited):**
  - (opus) placeholder page text describes linear-weighted last-10 trend that the shown smoothing (simple mean) does not implement

## M-MISC-042 Week Score callers: Off-Night Edge, schedule tiers, Monday grid, Team Stream

- **Match:** Opus only; Opus MISC-040; Codex —
- **Purpose:** Rank teams/players for streaming by GameGrid calcWeekScore and off-nights.
- **Where:** `web/lib/socialShare/modules/offNightEdge.ts:135-152 (offNightSchedule -> calcWeekScore)`; `web/lib/socialShare/modules/offNightEdge.ts:190 (pickOrder), :199 (offNightPools)`; `web/lib/socialShare/tiers.ts:21-55 (GP/off-night pair tiers)`; `web/lib/socialShare/mondayGrid.ts:49-62 (count colouring)`; `web/lib/socialShare/modules/teamStream.ts:13-61`
- **Tags (heuristic):** denominators: per game; generation: current
- **Opus view (MISC-040):**
  - Method: Week Score from components/GameGrid/utils/calcWeekScore.ts (other lane) with off-night games and per-day league game counts; competition ranks rounded 1e-6. Off-night = <=16 teams playing (OFF_NIGHT_TEAMS). Picks: unflagged first, short sample (<5 games) last, HOT (L5 FP/GP >= 1.25x his earlier games in span (>=3 base games) and >= position median) first, then L5 score, then lower ownership. Tiers: group teams by exact (GP, off-nights) pair ordered by best Week Score; 3 tiers (Widen folds next pair). Monday grid colours distinct GP/off-night counts: highest green, second white, lowest red, rest yellow. Team Stream: L5 vs previous 5 deltas.
  - Inputs/units: games, dates, FP/GP; sources: NHL schedule snapshot, wgo_skater_stats, yahoo_players
  - Output scale: rank 1..N; tiers; writes: —
  - Status: live
  - Consumers: SocialShare studio cards
- **Audit context:**
  - Intent (Opus): web/lib/socialShare/tiers.ts:6-12 'Schedule-aware streaming tiers (TJ, ticket 13)...'; offNightEdge.ts:312 sample text defines HOT
  - External references: Off-night streaming conventions
  - Fixtures/test data: none listed
  - Tests: `web/lib/socialShare/modules/offNightEdge.test.ts`; `web/lib/socialShare/modules/teamStream.test.ts`; `web/lib/socialShare/mondayGrid.test.ts`; `web/lib/socialShare/tiers.test.ts`
- **Leads (not audited):**
  - (opus) OFF_NIGHT_TEAMS=16 (teams) vs draft scheduleMetrics <=8 games - same threshold expressed differently, consistent
  - (opus) calcWeekScore internals not reviewed here (GameGrid lane)

## M-MISC-043 Hot/cold streak rules

- **Match:** Opus only; Opus MISC-042; Codex —
- **Purpose:** Flag L5 hot/cold streaks on share cards.
- **Where:** `web/lib/socialShare/streak.ts:37 (streakOf)`; `web/lib/socialShare/streak.ts:15 (STREAK)`
- **Tags (heuristic):** denominators: per game, shots on goal; generation: current
- **Opus view (MISC-042):**
  - Method: Pre-L5 baseline = (season total - L5 total)/(GP-5). Hot: >=4/5 point games, >=0.85 P/GP, TOI >= +15% vs pre-L5 (>=3 pre games), PP TOI >= +35% (pre >= 30 s); specialists also HIT>2, BLK>2, SOG>2.5, PPP>0.5 per game. Cold mirrors (<=1/5, <=0.25 P/GP, -15%, -35%). Goalies hot QS>=4/5 or SV%>=.930; cold QS<=1 or SV%<=.870. Needs 5 recent games.
  - Inputs/units: counts; seconds; sources: wgo skater/goalie rolling stats
  - Output scale: category flag; writes: —
  - Status: live
  - Consumers: share cards
- **Audit context:**
  - Intent (Opus): web/lib/socialShare/streak.ts:3-14 (full rule text, TJ ticket 18)
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/socialShare/streak.test.ts`

## M-MISC-044 WiGO util fallbacks: derived per-60, PP per-60, PTS1%, percentile staleness, rolling average

- **Match:** Opus only; Opus MISC-044; Codex —
- **Purpose:** Fill missing NST per-60s and chart series for WiGO.
- **Where:** `web/utils/fetchWigoPlayerStats.ts:314-334 (derivePer60)`; `web/utils/fetchWigoPlayerStats.ts:505-517 (PTS1%)`; `web/utils/fetchWigoPlayerStats.ts:560-577 (PP per-60)`; `web/utils/fetchWigoPercentiles.ts:130-150 (stale cohort detection)`; `web/utils/formattingUtils.ts:146 (calculateRollingAverage)`
- **Tags (heuristic):** denominators: per 60; generation: current
- **Opus view (MISC-044):**
  - Method: per60 = count*60/(atoi_min*gp); PP per-60 = count*3600/pp_toi_seconds (null if no PP time); PTS1% = (G + A1)/P*100 (null if P=0); percentile data stale if player GP>=10 and percentile GP <= max(4, floor(0.35*GP)) or cohort max GP >=20 and percentile max <= max(10, floor(0.35*max)); rolling average = window mean, null if any missing.
  - Inputs/units: minutes, seconds, counts; sources: wgo_skater_stats, nst_percentile_* tables, career aggregate view
  - Output scale: per 60; percent; writes: —
  - Status: live
  - Consumers: WiGO charts (components/WiGO)
- **Audit context:**
  - Intent (Opus): web/utils/fetchWigoPlayerStats.ts:507-508 'A pointless game has no share... so it is a gap rather than 0'
  - External references: NST per-60 conventions
  - Fixtures/test data: none listed
  - Tests: `web/utils/fetchWigoPercentiles.test.ts`; `web/utils/fetchWigoPlayerStats.test.ts`; `web/utils/formattingUtils.test.ts`
- **Leads (not audited):**
  - (opus) derived per-60 uses all-situation ATOI though rate may be strength-specific

## M-MISC-045 Team Stream per-game metrics, HOT and peripheral score

- **Match:** Codex only; Opus —; Codex SOC-STREAM
- **Purpose:** Compare waiver candidates within a share edition.
- **Where:** `web/lib/socialShare/modules/teamStream.ts:145 metricValue`; `web/lib/socialShare/modules/teamStream.ts:190 finishCandidates`; `web/lib/socialShare/modules/teamStream.ts:126 teamStreamDelta`; `web/lib/socialShare/modules/teamStream.ts:116 teamStreamPicks`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: per game; generation: current
- **Codex view (SOC-STREAM, calculation; Codex family 'Social-share calculations'):** Team Stream per-game metrics, HOT and peripheral score
  - Purpose: Compare waiver candidates within a share edition.
  - Inputs/units: L5/prior5 event counts, seconds, fantasy rates, F/D cohort, ownership, injury/sample flags.
  - Output scale: Per-game rates; relative delta=(L5−prior)/prior; midrank fraction mean for peripherals; HOT flag; ordered picks.
  - Version/status: Local share-card layer. Production deployment/active database state not checked.
  - Consumers: Team Stream and Off-Night share cards.
- **Audit context:**
  - Intended contract (Codex SOC-STREAM): HOT uses declared ratio threshold and positional cohort median; priorities favor unflagged/full samples; overall selection retains one defenseman when available.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/socialShare/modules/teamStream.test.ts`; `web/lib/socialShare/modules/teamStream.test.ts`; `web/lib/socialShare/modules/teamStream.test.ts`; `web/lib/socialShare/modules/teamStream.test.ts`
- **Leads (not audited):**
  - (codex:SOC-STREAM) No mathematical accuracy or fitness assessment performed. Tests listed, not run.

## M-MISC-046 above/below/tied/unavailable/better/worse/compared and cellTone

- **Match:** Codex only; Opus —; Codex category-counts-cell-accounting
- **Purpose:** Summarize comparison results without folding ties or unavailable into losses.
- **Where:** `web/lib/socialShare/modules/shared/categoryCounts.ts:209 CellCounts; :211 countCells; :223 cellTone`
- **Tags (heuristic):** generation: current
- **Codex view (category-counts-cell-accounting, calculation; Codex family 'Goalie Category Counts'):** above/below/tied/unavailable/better/worse/compared and cellTone
  - Purpose: Summarize comparison results without folding ties or unavailable into losses.
  - Inputs/units: CategoryCell results and directional outcomes.
  - Output scale: Unavailable increments only unavailable. Each remaining cell increments above/below/tied and compared; better/worse increments from directional outcome. Tone none when compared0; better if 2×better>compared; worse if 2×worse>compared; else level. Nonnegative integer counters; categorical tone.
  - Version/status: Supplement inspected 2026-11-10 on octoberBranch with observed HEAD 11e4192d36ecc4ac4b338f9ab48e529c7049c618. Earlier inventory was read at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; the checkout changed during the broader inventory and files may be live-mutating. Observed categoryCounts.ts SHA-256 92a4e82037e4a793e29f342dbc49d448ccf605b502d0e6152330ba6c36a6e890. This is not a frozen release snaps…
  - Consumers: web/lib/socialShare/modules/goaliePeriod.ts imports calculation helpers; goaliePeriod.sources.ts imports week validation. Other direct imports use calendar helpers: goalieGsax.ts, multiCatStars.ts, offNightEdge.ts, shared/periodWindow.ts, shared/goalieInventory.sources.ts.
- **Audit context:**
  - Intended contract (Codex category-counts-cell-accounting): Comment :221 requires directional majority of compared cells for better/worse tone; countCells implementation keeps ties in compared.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `{"discovered_not_run": ["web/lib/socialShare/modules/shared/categoryCounts.test.ts", "web/lib/socialShare/modules/goaliePeriod.test.ts"]}`
- **Leads (not audited):**
  - (codex:category-counts-cell-accounting) Imported pooledSavePct, pooledGaa and competitionRanks implementations were not reopened in this bounded single-file supplement. Tests and source comments were inspected, not executed; external CONTRACT §3 document was not independently read.

## M-MISC-047 Above/below/tied/unavailable and better/worse category outcomes

- **Match:** Codex only; Opus —; Codex category-counts-comparison
- **Purpose:** Separate numeric comparisons from whether a result helps in that category.
- **Where:** `web/lib/socialShare/modules/shared/categoryCounts.ts:85 cellOutcome; :87 compareToBaseline`
- **Tags (heuristic):** generation: current
- **Codex view (category-counts-comparison, calculation; Codex family 'Goalie Category Counts'):** Above/below/tied/unavailable and better/worse category outcomes
  - Purpose: Separate numeric comparisons from whether a result helps in that category.
  - Inputs/units: Measured value/comparison precision, category baseline, direction higher/lower. Higher: W/SV/SV%/SO/QS. Lower: GAA/GA/L+OTL.
  - Output scale: Above/below/tied by comparing comparison values; unavailable if measure or baseline absent. Better iff numeric direction favors category; tied/unavailable remain distinct and neither better nor worse.
  - Version/status: Supplement inspected 2026-11-10 on octoberBranch with observed HEAD 11e4192d36ecc4ac4b338f9ab48e529c7049c618. Earlier inventory was read at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; the checkout changed during the broader inventory and files may be live-mutating. Observed categoryCounts.ts SHA-256 92a4e82037e4a793e29f342dbc49d448ccf605b502d0e6152330ba6c36a6e890. This is not a frozen release snaps…
  - Consumers: web/lib/socialShare/modules/goaliePeriod.ts imports calculation helpers; goaliePeriod.sources.ts imports week validation. Other direct imports use calendar helpers: goalieGsax.ts, multiCatStars.ts, offNightEdge.ts, shared/periodWindow.ts, shared/goalieInventory.sources.ts.
- **Audit context:**
  - Intended contract (Codex category-counts-comparison): Header :5 and comparison methods preserve ties and true-zero baselines; adjacent tests :15–36 and :61–126 document direction/precision behavior.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `{"discovered_not_run": ["web/lib/socialShare/modules/shared/categoryCounts.test.ts", "web/lib/socialShare/modules/goaliePeriod.test.ts"]}`
- **Leads (not audited):**
  - (codex:category-counts-comparison) Imported pooledSavePct, pooledGaa and competitionRanks implementations were not reopened in this bounded single-file supplement. Tests and source comments were inspected, not executed; external CONTRACT §3 document was not independently read.

## M-MISC-048 Category totals, pooled SV%/GAA and comparison precision

- **Match:** Codex only; Opus —; Codex category-counts-measures
- **Purpose:** Build category measures from one or more goalie appearances.
- **Where:** `web/lib/socialShare/modules/shared/categoryCounts.ts:12 CATEGORIES; :27 add; :28 partsOf; :41 roundedRatio; :43 measure`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: per 60; generation: current
- **Codex view (category-counts-measures, calculation; Codex family 'Goalie Category Counts'):** Category totals, pooled SV%/GAA and comparison precision
  - Purpose: Build category measures from one or more goalie appearances.
  - Inputs/units: GoalieAppearance wins/saves/SA/GA/SO/L/OTL/QS counts and TOI seconds; null indicates unavailable. Eight category IDs: wins, saves, svPct, gaa, shutouts, goalsAgainst, losses, qualityStarts.
  - Output scale: Additive parts sum across rows, with any null making that part null. losses=L+OTL. SV% value delegates pooledSavePct(saves,SA), fraction; GAA delegates pooledGaa(GA,TOI seconds), goals per60. Comparison integers use floor((2×10^d×numerator+denominator)/(2×denominator)), d=3 for saves/SA and d=2 for GA×3600/TOI. Counts retain original numeric value; missing/zero rate denominator unavailable.
  - Version/status: Supplement inspected 2026-11-10 on octoberBranch with observed HEAD 11e4192d36ecc4ac4b338f9ab48e529c7049c618. Earlier inventory was read at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; the checkout changed during the broader inventory and files may be live-mutating. Observed categoryCounts.ts SHA-256 92a4e82037e4a793e29f342dbc49d448ccf605b502d0e6152330ba6c36a6e890. This is not a frozen release snaps…
  - Consumers: web/lib/socialShare/modules/goaliePeriod.ts imports calculation helpers; goaliePeriod.sources.ts imports week validation. Other direct imports use calendar helpers: goalieGsax.ts, multiCatStars.ts, offNightEdge.ts, shared/periodWindow.ts, shared/goalieInventory.sources.ts.
- **Audit context:**
  - Intended contract (Codex category-counts-measures): Source comments :25 missing is never zero; :40 half-up comparison precision; :42 unavailable null/zero SA/TOI. Category definitions set defaults W/SV/SV%/GAA/SO and optional GA/L+OTL/QS; no workload category.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `{"discovered_not_run": ["web/lib/socialShare/modules/shared/categoryCounts.test.ts", "web/lib/socialShare/modules/goaliePeriod.test.ts"]}`
- **Leads (not audited):**
  - (codex:category-counts-measures) Imported pooledSavePct, pooledGaa and competitionRanks implementations were not reopened in this bounded single-file supplement. Tests and source comments were inspected, not executed; external CONTRACT §3 document was not independently read.

## M-MISC-049 Week/month/custom/season cell assignment and inclusive day counts

- **Match:** Codex only; Opus —; Codex category-counts-period-allocation
- **Purpose:** Assign performance cells to periods without changing the originating week baseline.
- **Where:** `web/lib/socialShare/modules/shared/categoryCounts.ts:96 toMatchupWeeks; :150 weekMonth; :170 weekPeriod; :174 monthPeriod; :183 spanDays; :185 rangeHoldsWeek; :190 rangePeriod; :195 seasonPeriod; :200 defaultWeek; :202 defaultMonth`
- **Tags (heuristic):** generation: current
- **Codex view (category-counts-period-allocation, calculation; Codex family 'Goalie Category Counts'):** Week/month/custom/season cell assignment and inclusive day counts
  - Purpose: Assign performance cells to periods without changing the originating week baseline.
  - Inputs/units: UTC ISO dates, validated matchup weeks, through-date cutoff; optional month or date range.
  - Output scale: spanDays=round((end-start)/86400000)+1. Month gets week with greatest day overlap, ties to later month; custom range gets week if >half its days inside, or exact half and range holds later edge. Game cells use dates; week cells use assigned weeks. Season includes started weeks. Defaults prefer last completed week/month with in-progress fallback. Overlapping/backward weeks throw; missing boundary rows omitted.
  - Version/status: Supplement inspected 2026-11-10 on octoberBranch with observed HEAD 11e4192d36ecc4ac4b338f9ab48e529c7049c618. Earlier inventory was read at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; the checkout changed during the broader inventory and files may be live-mutating. Observed categoryCounts.ts SHA-256 92a4e82037e4a793e29f342dbc49d448ccf605b502d0e6152330ba6c36a6e890. This is not a frozen release snaps…
  - Consumers: web/lib/socialShare/modules/goaliePeriod.ts imports calculation helpers; goaliePeriod.sources.ts imports week validation. Other direct imports use calendar helpers: goalieGsax.ts, multiCatStars.ts, offNightEdge.ts, shared/periodWindow.ts, shared/goalieInventory.sources.ts.
- **Audit context:**
  - Intended contract (Codex category-counts-period-allocation): Comments :95,:149,:182–201 state boundary/majority/tie rules. :236 says each game keeps own week baseline; calendar and week-cell scopes remain separate.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `{"discovered_not_run": ["web/lib/socialShare/modules/shared/categoryCounts.test.ts", "web/lib/socialShare/modules/goaliePeriod.test.ts"]}`
- **Leads (not audited):**
  - (codex:category-counts-period-allocation) Imported pooledSavePct, pooledGaa and competitionRanks implementations were not reopened in this bounded single-file supplement. Tests and source comments were inspected, not executed; external CONTRACT §3 document was not independently read.

## M-MISC-050 gameNet, weekNet, betterRate and period category counts

- **Match:** Codex only; Opus —; Codex category-counts-period-net
- **Purpose:** Aggregate eligible period cells into ranking inputs.
- **Where:** `web/lib/socialShare/modules/shared/categoryCounts.ts:235 dated; :237 periodGoalies; :265 result mapping`
- **Tags (heuristic):** percent scale: fraction 0-1; generation: current
- **Codex view (category-counts-period-net, calculation; Codex family 'Goalie Category Counts'):** gameNet, weekNet, betterRate and period category counts
  - Purpose: Aggregate eligible period cells into ranking inputs.
  - Inputs/units: Weekly ledgers, period date bounds/through cutoff, assigned week IDs and selected categories; start/relief game references and cells.
  - Output scale: Game and week CellCounts plus per-category counts. gameNet=game.better−game.worse; weekNet=week.better−week.worse (signed cell counts). betterRate=game.better/game.compared, fraction0–1 or null if no compared cells; ties contribute denominator. Starts/relief counts and reliefOnlyWeeks remain separate.
  - Version/status: Supplement inspected 2026-11-10 on octoberBranch with observed HEAD 11e4192d36ecc4ac4b338f9ab48e529c7049c618. Earlier inventory was read at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; the checkout changed during the broader inventory and files may be live-mutating. Observed categoryCounts.ts SHA-256 92a4e82037e4a793e29f342dbc49d448ccf605b502d0e6152330ba6c36a6e890. This is not a frozen release snaps…
  - Consumers: web/lib/socialShare/modules/goaliePeriod.ts imports calculation helpers; goaliePeriod.sources.ts imports week validation. Other direct imports use calendar helpers: goalieGsax.ts, multiCatStars.ts, offNightEdge.ts, shared/periodWindow.ts, shared/goalieInventory.sources.ts.
- **Audit context:**
  - Intended contract (Codex category-counts-period-net): Comments :226–236 distinguish official starts, relief and assigned weeks. Source :270 defines net/rate directly; each game retains its whole-week baseline.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `{"discovered_not_run": ["web/lib/socialShare/modules/shared/categoryCounts.test.ts", "web/lib/socialShare/modules/goaliePeriod.test.ts"]}`
- **Leads (not audited):**
  - (codex:category-counts-period-net) Imported pooledSavePct, pooledGaa and competitionRanks implementations were not reopened in this bounded single-file supplement. Tests and source comments were inspected, not executed; external CONTRACT §3 document was not independently read.

## M-MISC-051 Category Counts eligible/rank/worstRank

- **Match:** Codex only; Opus —; Codex category-counts-ranking
- **Purpose:** Rank period goalies using net category outcomes and explicit sample eligibility.
- **Where:** `web/lib/socialShare/modules/shared/categoryCounts.ts:275 rankPeriodGoalies`
- **Tags (heuristic):** generation: current
- **Codex view (category-counts-ranking, calculation; Codex family 'Goalie Category Counts'):** Category Counts eligible/rank/worstRank
  - Purpose: Rank period goalies using net category outcomes and explicit sample eligibility.
  - Inputs/units: Period goalie gameNet/weekNet/betterRate, starts count, compared game cells and minStarts threshold.
  - Output scale: Eligibility starts≥minStarts AND game.compared>0. Order lexicographically by gameNet, then weekNet, then betterRate; still-equal rows share rank. Imported competitionRanks applied high for best and low for worst. Ineligible ranks null. Final display order rank ascending, starts descending, goalieId ascending. Adjacent test expects best ranks1,1,3,4,4 and worst4,4,3,1,1 for tied extremes.
  - Version/status: Supplement inspected 2026-11-10 on octoberBranch with observed HEAD 11e4192d36ecc4ac4b338f9ab48e529c7049c618. Earlier inventory was read at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; the checkout changed during the broader inventory and files may be live-mutating. Observed categoryCounts.ts SHA-256 92a4e82037e4a793e29f342dbc49d448ccf605b502d0e6152330ba6c36a6e890. This is not a frozen release snaps…
  - Consumers: web/lib/socialShare/modules/goaliePeriod.ts imports calculation helpers; goaliePeriod.sources.ts imports week validation. Other direct imports use calendar helpers: goalieGsax.ts, multiCatStars.ts, offNightEdge.ts, shared/periodWindow.ts, shared/goalieInventory.sources.ts.
- **Audit context:**
  - Intended contract (Codex category-counts-ranking): Comment :274 spells priority and shared-rank contract; tests :226–255 cover net priority, week/rate tiebreaks, competition ties, minimum starts and no compared cells.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `{"discovered_not_run": ["web/lib/socialShare/modules/shared/categoryCounts.test.ts", "web/lib/socialShare/modules/goaliePeriod.test.ts"]}`
- **Leads (not audited):**
  - (codex:category-counts-ranking) Imported pooledSavePct, pooledGaa and competitionRanks implementations were not reopened in this bounded single-file supplement. Tests and source comments were inspected, not executed; external CONTRACT §3 document was not independently read.

## M-MISC-052 Official-start pool, game/week cells and relief accounting

- **Match:** Codex only; Opus —; Codex category-counts-week-pool
- **Purpose:** Build a week’s comparison cells using that week’s own starter pool.
- **Where:** `web/lib/socialShare/modules/shared/categoryCounts.ts:115 buildWeekLedger; :137 buildWeekLedgers`
- **Tags (heuristic):** generation: current
- **Codex view (category-counts-week-pool, calculation; Codex family 'Goalie Category Counts'):** Official-start pool, game/week cells and relief accounting
  - Purpose: Build a week’s comparison cells using that week’s own starter pool.
  - Inputs/units: Dated goalie appearances, started true/false/null, matchup-week boundaries, selected categories.
  - Output scale: Pool includes every goalie with ≥1 official start, including the goalie compared. Game baseline uses official-start appearance parts; week baseline uses pool goalie totals including their other appearances. Each official start has one cell/category; each pool goalie has one week cell/category. Relief-only goalies get no cells and are separate; unlabeled row count and outside-week unassigned count reported.
  - Version/status: Supplement inspected 2026-11-10 on octoberBranch with observed HEAD 11e4192d36ecc4ac4b338f9ab48e529c7049c618. Earlier inventory was read at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; the checkout changed during the broader inventory and files may be live-mutating. Observed categoryCounts.ts SHA-256 92a4e82037e4a793e29f342dbc49d448ccf605b502d0e6152330ba6c36a6e890. This is not a frozen release snaps…
  - Consumers: web/lib/socialShare/modules/goaliePeriod.ts imports calculation helpers; goaliePeriod.sources.ts imports week validation. Other direct imports use calendar helpers: goalieGsax.ts, multiCatStars.ts, offNightEdge.ts, shared/periodWindow.ts, shared/goalieInventory.sources.ts.
- **Audit context:**
  - Intended contract (Codex category-counts-week-pool): Comments :107–114 define relief/unlabeled and self-including official-start pool. :136 defines rows assigned to no week. buildWeekLedgers filters inclusive date boundaries.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `{"discovered_not_run": ["web/lib/socialShare/modules/shared/categoryCounts.test.ts", "web/lib/socialShare/modules/goaliePeriod.test.ts"]}`
- **Leads (not audited):**
  - (codex:category-counts-week-pool) Imported pooledSavePct, pooledGaa and competitionRanks implementations were not reopened in this bounded single-file supplement. Tests and source comments were inspected, not executed; external CONTRACT §3 document was not independently read.

