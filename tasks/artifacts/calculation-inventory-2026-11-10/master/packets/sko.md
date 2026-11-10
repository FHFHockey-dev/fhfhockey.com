# Audit packet: sKO

Master entries M-SKO-001 to M-SKO-029 (29 of 29 in this family). Built from the merged Opus and Codex inventories; see [../MASTER.md](../MASTER.md) and [../MERGE-NOTES.md](../MERGE-NOTES.md).

How to read: each entry gives both inventories' descriptions side by side. **Conflicts** are places where the two descriptions disagree; they are unresolved. **Leads** are Opus red flags and Codex unknowns: observations to check, not audited findings. Tags are keyword heuristics. Line numbers were valid when each inventory was written on 2026-11-10 (Opus at d31dcb33f, Codex at 11e4192d3); re-check against the current checkout.

| ID | Name | Match | Conflicts | Leads |
|---|---|---|---:|---:|
| M-SKO-001 | matview analytics.mv_sko_skater_moments | Both | 0 | 3 |
| M-SKO-002 | view analytics.vw_sko_skater_zscores | Both | 0 | 3 |
| M-SKO-003 | view analytics.vw_sko_skater_scores | Both | 0 | 2 |
| M-SKO-004 | sKO points prediction (moving-average blend with volatility penalty) | Both | 0 | 5 |
| M-SKO-005 | Sko Element: sustainability gap D and direction (Rebound/Cooling) | Both | 0 | 2 |
| M-SKO-006 | Sko Element: IPP observed vs class reference | Both | 0 | 2 |
| M-SKO-007 | Sko Element: weighted league-points gap | Both | 0 | 1 |
| M-SKO-008 | Sko Element: opportunity change classification (TOI / PP TOI) | Both | 0 | 2 |
| M-SKO-009 | sKO gap helpers: sustainabilityGap, displayScore (tanh), rateFromTota… | Both | 0 | 5 |
| M-SKO-010 | Legacy sKO stat weights (inverse ratings) | Both | 0 | 2 |
| M-SKO-011 | Legacy sKO confidence multiplier and empirical thresholds | Both | 0 | 4 |
| M-SKO-012 | Legacy sKO characteristic-game classification (weighted squared z) | Both | 0 | 4 |
| M-SKO-013 | Legacy sKO Game Score | Both | 0 | 5 |
| M-SKO-014 | sKO prediction: recent points blend (pred_points) | Both | 0 | 3 |
| M-SKO-015 | combineSKO / computeLuck (trends utils) | Both | 0 | 5 |
| M-SKO-016 | fn analytics.rpc_sko_player_series (+ public wrapper) | Opus only | 0 | 2 |
| M-SKO-017 | sKO skater stats row derivations (IPP, SOG/60) | Opus only | 0 | 2 |
| M-SKO-018 | Sko Element: personal reference block change and outlook change | Opus only | 0 | 0 |
| M-SKO-019 | Sko Element: observed per-team-game and per-appearance rates | Opus only | 0 | 0 |
| M-SKO-020 | Sko Element: observed variability (sample SD) | Opus only | 0 | 1 |
| M-SKO-021 | Sko Element: FORGE expected per scheduled team game and conditional p… | Opus only | 0 | 0 |
| M-SKO-022 | sKO skater stat ingestion derived fields (IPP, SOG/60) | Opus only | 0 | 1 |
| M-SKO-023 | sKO leaderboard overall accuracy (sample-weighted hit rate) | Opus only | 0 | 1 |
| M-SKO-024 | sKO stability statistic (stability_cv) | Opus only | 0 | 1 |
| M-SKO-025 | sKO stability multiplier (smoothstep 0.8-1.0) | Opus only | 0 | 2 |
| M-SKO-026 | sKO score (pred_points x stability) | Opus only | 0 | 1 |
| M-SKO-027 | Observed and prior-block category rates | Codex only | 0 | 1 |
| M-SKO-028 | FORGE expectation and descriptive category gap | Codex only | 0 | 1 |
| M-SKO-029 | Observed category variability and outlook change | Codex only | 0 | 1 |

## M-SKO-001 matview analytics.mv_sko_skater_moments

- **Match:** Both; Opus SKO-001; Codex sql-sko-analytics
- **Purpose:** Per-player and per-position robust medians and MADs of sKO input features
- **Where:** `supabase/migrations/20260730233451_reconstruct_hosted_analytics_schema.sql:502 (analytics.mv_sko_skater_moments, WITH NO DATA)`; `supabase/migrations/20260730233451_reconstruct_hosted_analytics_schema.sql:502 mv_sko_skater_moments; :638 vw_sko_skater_zscores; :733 vw_sko_skater_scores; :751 rpc_sko_player_series`
- **Tags (heuristic):** denominators: per game; generation: legacy, research, current
- **Opus view (SKO-001):**
  - Method: player: percentile_cont(0.5) median and MAD = 1.4826*median(\|x - median\|) over ALL the player's games; league: same by position_code (on-ice SH% and SH% with 0 -> NULL for league only). n_games = count of non-null shots.
  - Inputs/units: per-game WGO values; TOI per game (seconds?); sources: analytics.vw_sko_skater_base
  - Output scale: medians/MADs in input units; writes: analytics.mv_sko_skater_moments
  - Status: legacy/dead — sKO DB objects quarantined ('Legacy research SQL', web/lib/predictions/legacyQuarantine.ts:125-130); created WITH NO DATA
  - Consumers: analytics.vw_sko_skater_zscores
- **Codex view (sql-sko-analytics, calculation, location; Codex family 'sKO SQL cross-reference'):** mv_sko_skater_moments / vw_sko_skater_zscores / vw_sko_skater_scores / rpc_sko_player_series
  - Purpose: Expose SQL sKO moment, standardized, scoring and time-series calculations.
  - Inputs/units: analytics.vw_sko_skater_base and performance history
  - Output scale: Moments/zscore/score/time-series output families; exact weights and recurrence inventoried in the sKO inventory.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
- **Audit context:**
  - Intent (Opus): tasks/TASKS/sko-charts/sko-ownership-contract.md (per legacyQuarantine.ts:18)
  - Intended contract (Codex sql-sko-analytics): Schema reconstruction SQL definitions retained as local evidence only.
  - External references: robust z (median/MAD, 1.4826 consistency constant)
  - Fixtures/test data: none listed
  - Tests: `web/lib/supabase/supportedBaselineMigration.test.ts`; `{"discovered_not_run": []}`
- **Leads (not audited):**
  - (opus) player moments span all seasons including future games relative to any date (look-ahead leakage in historical z-scores)
  - (opus) zero SH% nulled for league stats but not for player stats
  - (codex:sql-sko-analytics) Definition exists locally; applied migration/live view shape, data freshness and runtime consumer use unknown.

## M-SKO-002 view analytics.vw_sko_skater_zscores

- **Match:** Both; Opus SKO-002; Codex core-023
- **Purpose:** Empirical-Bayes shrunk robust z-scores per skater-game
- **Where:** `supabase/migrations/20260730233451_reconstruct_hosted_analytics_schema.sql:638 (analytics.vw_sko_skater_zscores)`; `web/sql/views/analytics.vw_sko_skater_zscores.sql:4 (repo source)`; `web/sql/views/analytics.vw_sko_skater_zscores.sql:4 CREATE OR REPLACE VIEW`
- **Tags (heuristic):** denominators: per game; generation: legacy, research
- **Opus view (SKO-002):**
  - Method: kappa = 30; w_player = n/(n+30), w_league = 30/(n+30); z = (x - (w_p*player_med + w_l*league_med)) / (w_p*player_mad + w_l*league_mad) for shots, ixg, ixg_per_60, toi, pp_toi, ozfo%, on-ice SH%, SH%; game_id falls back to row_number.
  - Inputs/units: per-game values; sources: analytics.vw_sko_skater_base, analytics.mv_sko_skater_moments
  - Output scale: robust z-score; writes: —
  - Status: legacy/dead — quarantined (web/lib/predictions/legacyQuarantine.ts:130)
  - Consumers: analytics.vw_sko_skater_scores
- **Codex view (core-023, calculation, location; Codex family 'legacy SKO SQL'):** Legacy SQL empirical-Bayes z-scores
  - Formula: kappa = 30; playerWeight=n/(n+30); subtract blended median and divide by blended MAD.
  - Purpose: Retain SQL research variant distinct from JS characteristic score.
  - Inputs/units: Player and league medians/MADs; n_games; shots, ixG, ixG60, TOI, PPTOI, OZFO, on-ice SH%, SH%.
  - Output scale: Eight dimensionless z fields.
  - Version/status: Local octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f (2026-11-10). Legacy research SQL; installed DB version unknown. Deployment and persisted-data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final s…
- **Audit context:**
  - Intent (Opus): web/sql/views/analytics.vw_sko_skater_zscores.sql:2 'EB z-score view ... with shrinkage for ixG metrics'
  - Intended contract (Codex core-023): Research SQL, no runtime TS caller; classification open per legacyQuarantine.ts:125–130.
  - External references: empirical Bayes shrinkage (kappa pseudo-games)
  - Fixtures/test data: `web/sql/tests/sko_trends_validation.sql`
  - Tests: `Located only; not run for this inventory.`; `web/lib/supabase/supportedBaselineMigration.test.ts`; `web/sql/tests/sko_trends_validation.sql`
- **Leads (not audited):**
  - (opus) shrinks the MAD as well as the median by the same weights
  - (opus) base view joins NST rows on date_scraped = game date (scrape date vs game date)
  - (codex:core-023) ["Calculation inventory only; formulas and inputs have not been vetted."]

## M-SKO-003 view analytics.vw_sko_skater_scores

- **Match:** Both; Opus SKO-003; Codex core-024
- **Purpose:** sKO per-game score = ridge-weighted z-sum bounded by tanh
- **Where:** `supabase/migrations/20260730233451_reconstruct_hosted_analytics_schema.sql:733 (analytics.vw_sko_skater_scores)`; `web/sql/views/analytics.vw_sko_skater_scores.sql:4 (repo source)`; `web/sql/views/analytics.vw_sko_skater_scores.sql:4 CREATE OR REPLACE VIEW`
- **Tags (heuristic):** generation: legacy, research
- **Opus view (SKO-003):**
  - Method: sko_raw = -0.03 + 0.24 shots_z + 0.28 ixg_z + 0.13 ixg_per_60_z + 0.09 toi_z + 0.07 pp_toi_z + 0.09 ozfo_z - 0.06 onice_sh_z - 0.05 shooting_pct_z (NULL z -> 0); sko = tanh(sko_raw).
  - Inputs/units: z-scores; sources: analytics.vw_sko_skater_zscores
  - Output scale: sko in (-1,1); writes: —
  - Status: legacy/dead — quarantined (legacyQuarantine.ts:129)
  - Consumers: analytics.rpc_sko_player_series
- **Codex view (core-024, calculation, location; Codex family 'legacy SKO SQL'):** Legacy SQL ridge/tanh SKO
  - Formula: -.03+.24shotsZ+.28ixgZ+.13ixg60Z+.09toiZ+.07ppToiZ+.09ozfoZ-.06oniceShZ-.05shZ; tanh(raw).
  - Purpose: Retain SQL research variant distinct from JS characteristic score.
  - Inputs/units: Eight SQL z fields.
  - Output scale: sko_raw unbounded; sko (-1, 1).
  - Version/status: Local octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f (2026-11-10). Legacy research SQL; installed DB version unknown. Deployment and persisted-data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final s…
- **Audit context:**
  - Intent (Opus): web/sql/views/analytics.vw_sko_skater_scores.sql:2 'Applies ridge weights to z-scores and bounds via tanh'
  - Intended contract (Codex core-024): Research SQL, no runtime TS caller; classification open per legacyQuarantine.ts:125–130.
  - External references: none suggested
  - Fixtures/test data: `web/sql/tests/sko_trends_validation.sql`
  - Tests: `Located only; not run for this inventory.`; `web/lib/supabase/supportedBaselineMigration.test.ts`; `web/sql/tests/sko_trends_validation.sql`
- **Leads (not audited):**
  - (opus) hard-coded coefficients in view; analytics.sko_model_v1 table holds weights/mu/sigma but the view does not read it
  - (codex:core-024) ["Calculation inventory only; formulas and inputs have not been vetted."]

## M-SKO-004 sKO points prediction (moving-average blend with volatility penalty)

- **Match:** Both; Opus SKO-006; Codex core-311
- **Purpose:** Predict a skater's points over the next N games and a sKO score penalised for recent volatility.
- **Where:** `web/pages/api/v1/ml/update-predictions-sko.ts:106 (mean)`; `web/pages/api/v1/ml/update-predictions-sko.ts:112 (stddev)`; `web/pages/api/v1/ml/update-predictions-sko.ts:120 (smoothstepMultiplier)`; `web/pages/api/v1/ml/update-predictions-sko.ts:305 (buildPredictionRecord)`; `web/pages/api/v1/ml/update-predictions-sko.ts:305 buildPredictionRecord`
- **Tags (heuristic):** denominators: per game; generation: legacy, current
- **Opus view (SKO-006):**
  - Method: avg5 = mean(last 5), avg10 = mean(last 10); recentBlend = 0.6*avg10 + 0.4*avg5; pred_points = recentBlend*horizon. stdevShort = population SD of last stabilityWindow games; stdevLong = SD of last 20; t1 = 0.8*stdevLong, t2 = max(t1+1e-6, 1.2*stdevLong); ratio = clamp((stdevShort-t1)/(t2-t1)); smooth = 3r^2-2r^3; multiplier = 0.8 + 0.2*(1-smooth) in [0.8,1]; sko = pred_points*multiplier. MODEL_VERSION v0.3.
  - Inputs/units: points per game; sources: player_stats_unified
  - Output scale: projected points over horizon (default 5 games); multiplier 0.8-1.0; writes: predictions_sko
  - Status: flagged off — quarantined per web/lib/predictions/legacyQuarantine.ts (disposition 'quarantined', historical-only decision 2026-07-28); docs RET-005 notes an active retained pg_cron
  - Consumers: web/pages/api/v1/ml/get-predictions-sko.ts; web/components/Predictions/PredictionsLeaderboard.tsx; web/lib/hooks/useQuarantinedPredictionsSko.ts
- **Codex view (core-311, calculation, location; Codex family 'legacy SKO prediction'):** Recent points blend and stability-adjusted SKO
  - Formula: RecentBlend=.6*mean(last10)+.4*mean(last5); prediction=blend*horizon; SDshort versus thresholds .8*SDlast20 and 1.2*SDlast20; smoothstep stability multiplier; sko=prediction*multiplier.
  - Purpose: Calculate recent points blend and stability-adjusted sko.
  - Inputs/units: Ordered NHL points series; horizon games; stability window.
  - Output scale: pred_points total, per-game rate, stability_cv (actually SD), multiplier .8..1, sko.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f. Compatibility-only quarantine per legacyQuarantine.ts; model constants in route. Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry …
- **Audit context:**
  - Intent (Opus): Comment update-predictions-sko.ts:316-317 (0 average is a real scoreless stretch, no fallback to longer window, v0.2 did); docs/player-projections/duplicate-retirement-ledger.md RET-005; tasks/TASKS/sko-charts/sko-ownership-contract.md
  - Intended contract (Codex core-311): Source types and implementation in web/pages/api/v1/ml/update-predictions-sko.ts:305; separate acceptance not verified.
  - External references: Weighted moving average baseline; Marcel-style regression would add a league prior
  - Fixtures/test data: none listed
  - Tests: `Located only; not run for this inventory.`; `web/__tests__/pages/api/v1/ml/update-predictions-sko.test.ts`
- **Leads (not audited):**
  - (opus) stability_cv stores a standard deviation, not a coefficient of variation
  - (opus) with default stabilityWindow=10 the short SD is last-10 vs long last-20, overlapping windows
  - (opus) no regression to a league/career prior and no TOI, opponent or schedule terms; points from player_stats_unified only
  - (opus) magic constants 0.6/0.4, 0.8/1.2, floor 0.8
  - (codex:core-311) ["Inventory only, not validation of the formula, source semantics or model quality."]

## M-SKO-005 Sko Element: sustainability gap D and direction (Rebound/Cooling)

- **Match:** Both; Opus SKO-008; Codex core-012
- **Purpose:** Expected minus recent observed rate, the core sKO signal.
- **Where:** `web/lib/skoElement/interpret.ts:252-255 (gap)`; `web/lib/skoElement/interpret.ts:108 (direction)`; `web/lib/skoElement/interpret.ts:111 interpretOpportunity`
- **Tags (heuristic):** denominators: per appearance, per team game; generation: development, current
- **Opus view (SKO-008):**
  - Method: D = expected - observed (per team game); withheld unless evidenceAgeHours <= config.maxEvidenceAgeHours; direction rebound if D > 1e-9, cooling if D < -1e-9, else level.
  - Inputs/units: count per team game; sources: —
  - Output scale: count per team game (signed); writes: —
  - Status: draft — fixture stage (contract 'sko-interpretation-v0.2'); used by lib/skoElement/fixtures.ts -> /sko-element/preview and lib/buyLowSellHigh/market.ts; preview 404s in production per tasks/artifacts/blsh-sko-vudu-audit-2026-11-04.md
  - Consumers: BLSH ranking (market.ts); explanations
- **Codex view (core-012, calculation, location; Codex family 'Sko Element'):** Opportunity block and TOI/PP changes
  - Formula: Recent mean minutes-prior mean; compare configured total/PP thresholds after minimum appearances.
  - Purpose: Read-only interpretation of observed evidence and FORGE forecast; no learned SKO weights.
  - Inputs/units: Total and PP TOI minutes per appearance; disjoint recent/prior blocks; rule thresholds.
  - Output scale: Minute deltas; rising/falling/steady/mixed/unclassified.
  - Version/status: Local octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f (2026-11-10). Sko Element new-contract fixture/interpretation core; config acceptance is caller-supplied. Deployment and persisted-data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no trac…
- **Audit context:**
  - Intent (Opus): Diagnostic-first interpretation: FORGE expectations passed through unchanged, no normalized SKO score (web/lib/skoElement/contract.ts:1-9)
  - Intended contract (Codex core-012): Source limitations at interpret.ts:314: descriptive, not probability/trade instruction; expected values unchanged; no predictive-spread model. VuDu gap awaits accepted goalie adapter.
  - External references: Regression-to-expectation diagnostics (actual vs expected)
  - Fixtures/test data: `web/lib/skoElement/fixtures.ts`; `tasks/artifacts/blsh-sko-vudu-audit-2026-11-04.md`
  - Tests: `Located only; not run for this inventory.`; `web/components/skoElement/SkoElementPreview.test.tsx`; `web/lib/skoElement/interpret.test.ts`
- **Leads (not audited):**
  - (opus) zero threshold (1e-9) means any tiny gap is labelled rebound/cooling; no noise band (watchLabel threshold exists only in gap.ts)
  - (codex:core-012) ["Calculation inventory only; formulas and inputs have not been vetted."]

## M-SKO-006 Sko Element: IPP observed vs class reference

- **Match:** Both; Opus SKO-009; Codex core-013
- **Purpose:** Individual points percentage deviation from F or D reference.
- **Where:** `web/lib/skoElement/interpret.ts:272-289 (ipp)`; `web/lib/skoElement/interpret.ts:212 interpretPlayer`
- **Tags (heuristic):** percent scale: fraction 0-1; generation: development, current
- **Opus view (SKO-009):**
  - Method: IPP = sum(points)/sum(onIceGF) over appeared games (null if GF=0 or points > GF); deviation = IPP - reference.
  - Inputs/units: counts; sources: —
  - Output scale: fraction 0-1; writes: —
  - Status: draft — fixture stage (contract 'sko-interpretation-v0.2'); used by lib/skoElement/fixtures.ts -> /sko-element/preview and lib/buyLowSellHigh/market.ts; preview 404s in production per tasks/artifacts/blsh-sko-vudu-audit-2026-11-04.md
  - Consumers: explanations
- **Codex view (core-013, calculation, name+file; Codex family 'Sko Element'):** IPP observed/reference deviation
  - Formula: sum(points)/sum(onIceGF); subtract model-class reference; inconsistent counts withheld.
  - Purpose: Read-only interpretation of observed evidence and FORGE forecast; no learned SKO weights.
  - Inputs/units: Points and on-ice goals for over appearances; F/D reference fraction.
  - Output scale: IPP fraction and signed reference deviation.
  - Version/status: Local octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f (2026-11-10). Sko Element new-contract fixture/interpretation core; config acceptance is caller-supplied. Deployment and persisted-data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no trac…
- **Audit context:**
  - Intent (Opus): Diagnostic-first interpretation: FORGE expectations passed through unchanged, no normalized SKO score (web/lib/skoElement/contract.ts:1-9)
  - Intended contract (Codex core-013): Source limitations at interpret.ts:314: descriptive, not probability/trade instruction; expected values unchanged; no predictive-spread model. VuDu gap awaits accepted goalie adapter.
  - External references: NST IPP; position IPP norms (~70% F, ~40% D at 5v5)
  - Fixtures/test data: `web/lib/skoElement/fixtures.ts`; `tasks/artifacts/blsh-sko-vudu-audit-2026-11-04.md`
  - Tests: `Located only; not run for this inventory.`; `web/components/skoElement/SkoElementPreview.test.tsx`; `web/lib/skoElement/interpret.test.ts`
- **Leads (not audited):**
  - (opus) reference values are 'fixture_illustrative' status in fixtures
  - (codex:core-013) ["Calculation inventory only; formulas and inputs have not been vetted."]

## M-SKO-007 Sko Element: weighted league-points gap

- **Match:** Both; Opus SKO-011; Codex core-015
- **Purpose:** Combines category gaps into a league-scoring points gap for BLSH.
- **Where:** `web/lib/skoElement/interpret.ts:367 (weightedPointsGap)`; `web/lib/buyLowSellHigh/market.ts:32 (caller)`; `web/lib/skoElement/interpret.ts:367 weightedPointsGap`
- **Tags (heuristic):** denominators: per team game; generation: development, current
- **Opus view (SKO-011):**
  - Method: observed = sum(w_t * observed_t); expected = sum(w_t * expected_t); gap = expected - observed (withheld if evidence not fresh or any weighted target missing).
  - Inputs/units: counts per team game; fantasy weights; sources: —
  - Output scale: fantasy points per team game; writes: —
  - Status: draft — fixture stage (contract 'sko-interpretation-v0.2'); used by lib/skoElement/fixtures.ts -> /sko-element/preview and lib/buyLowSellHigh/market.ts; preview 404s in production per tasks/artifacts/blsh-sko-vudu-audit-2026-11-04.md
  - Consumers: lib/buyLowSellHigh/market.ts ranking
- **Codex view (core-015, calculation, location; Codex family 'Sko Element'):** League-weighted points gap
  - Formula: Sum categoryRate*weight separately for observed/expected then subtract.
  - Purpose: Read-only interpretation of observed evidence and FORGE forecast; no learned SKO weights.
  - Inputs/units: Compatible category per-team-game rates and explicit league weights.
  - Output scale: Fantasy points/team game; expected-observed.
  - Version/status: Local octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f (2026-11-10). Sko Element new-contract fixture/interpretation core; config acceptance is caller-supplied. Deployment and persisted-data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no trac…
- **Audit context:**
  - Intent (Opus): Diagnostic-first interpretation: FORGE expectations passed through unchanged, no normalized SKO score (web/lib/skoElement/contract.ts:1-9)
  - Intended contract (Codex core-015): Source limitations at interpret.ts:314: descriptive, not probability/trade instruction; expected values unchanged; no predictive-spread model. VuDu gap awaits accepted goalie adapter.
  - External references: none suggested
  - Fixtures/test data: `web/lib/skoElement/fixtures.ts`; `tasks/artifacts/blsh-sko-vudu-audit-2026-11-04.md`
  - Tests: `Located only; not run for this inventory.`; `web/components/skoElement/SkoElementPreview.test.tsx`; `web/lib/buyLowSellHigh/market.test.ts`; `web/lib/skoElement/interpret.test.ts`
- **Leads (not audited):**
  - (codex:core-015) ["Calculation inventory only; formulas and inputs have not been vetted."]

## M-SKO-008 Sko Element: opportunity change classification (TOI / PP TOI)

- **Match:** Both; Opus SKO-012; Codex core-012
- **Purpose:** Labels role opportunity rising/falling between blocks.
- **Where:** `web/lib/skoElement/interpret.ts:60 (opportunityBlock)`; `web/lib/skoElement/interpret.ts:111 (interpretOpportunity)`; `web/lib/skoElement/interpret.ts:111 interpretOpportunity`
- **Tags (heuristic):** denominators: per appearance; generation: development, current
- **Opus view (SKO-012):**
  - Method: toiChange = mean TOI/appearance recent - prior; rising if toiChange >= minToiChangeMinutes or ppChange >= minPpToiChangeMinutes; falling symmetric; mixed if both; requires minAppearancesEachBlock; no rule -> unclassified.
  - Inputs/units: minutes; sources: —
  - Output scale: labels; minutes; writes: —
  - Status: draft — fixture stage (contract 'sko-interpretation-v0.2'); used by lib/skoElement/fixtures.ts -> /sko-element/preview and lib/buyLowSellHigh/market.ts; preview 404s in production per tasks/artifacts/blsh-sko-vudu-audit-2026-11-04.md
  - Consumers: BLSH opportunity label
- **Codex view (core-012, calculation, location; Codex family 'Sko Element'):** Opportunity block and TOI/PP changes
  - Formula: Recent mean minutes-prior mean; compare configured total/PP thresholds after minimum appearances.
  - Purpose: Read-only interpretation of observed evidence and FORGE forecast; no learned SKO weights.
  - Inputs/units: Total and PP TOI minutes per appearance; disjoint recent/prior blocks; rule thresholds.
  - Output scale: Minute deltas; rising/falling/steady/mixed/unclassified.
  - Version/status: Local octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f (2026-11-10). Sko Element new-contract fixture/interpretation core; config acceptance is caller-supplied. Deployment and persisted-data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no trac…
- **Audit context:**
  - Intent (Opus): Diagnostic-first interpretation: FORGE expectations passed through unchanged, no normalized SKO score (web/lib/skoElement/contract.ts:1-9)
  - Intended contract (Codex core-012): Source limitations at interpret.ts:314: descriptive, not probability/trade instruction; expected values unchanged; no predictive-spread model. VuDu gap awaits accepted goalie adapter.
  - External references: none suggested
  - Fixtures/test data: `web/lib/skoElement/fixtures.ts`; `tasks/artifacts/blsh-sko-vudu-audit-2026-11-04.md`
  - Tests: `Located only; not run for this inventory.`; `web/components/skoElement/SkoElementPreview.test.tsx`; `web/lib/skoElement/interpret.test.ts`
- **Leads (not audited):**
  - (opus) rule thresholds are 'provisional_fixture' only
  - (codex:core-012) ["Calculation inventory only; formulas and inputs have not been vetted."]

## M-SKO-009 sKO gap helpers: sustainabilityGap, displayScore (tanh), rateFromTotals, watchLabel

- **Match:** Both; Opus SKO-015; Codex core-004, core-005, core-006, core-008
- **Purpose:** Phase-0 descriptive gap math with basis checking and a bounded display score.
- **Where:** `web/lib/sko/gap.ts:24 (sustainabilityGap)`; `web/lib/sko/gap.ts:48 (displayScore)`; `web/lib/sko/gap.ts:56 (rateFromTotals)`; `web/lib/sko/gap.ts:106 (watchLabel)`; `web/lib/sko/gap.ts:23 sustainabilityGap`; `web/lib/sko/gap.ts:48 displayScore`; `web/lib/sko/gap.ts:56 rateFromTotals`; `web/lib/sko/gap.ts:104 watchLabel`
- **Tags (heuristic):** denominators: per team game; generation: legacy, development
- **Opus view (SKO-015):**
  - Method: gap = expected - recent (orientedGap negated if lowerIsBetter); display = 100*tanh(orientedGap/scale); rate = sum numerator / sum denominator (never mean of ratios); watch: orientedGap >= threshold 'Rebound watch', <= -threshold 'Cooling watch', 0 never.
  - Inputs/units: per RateBasis; sources: —
  - Output scale: display -100..100; writes: —
  - Status: draft — only tests call it
  - Consumers: tests only (legacyQuarantine.ts:120 'no legacy model or product wiring')
- **Codex view (core-004, calculation, codex_part_of_opus; Codex family 'SKO/VuDu'):** Sustainability gap
  - Formula: expected-recent; negate if lowerIsBetter.
  - Purpose: Describe expected versus observed performance without predicting quality or market value.
  - Inputs/units: Expected and recent compatible rates; basis per scheduled team game, appearance, 60 or 100 on-net shots.
  - Output scale: Native signed gap and higher-is-better oriented gap.
  - Version/status: Local octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f (2026-11-10). Pure Phase0 contract; distinct from legacy sKO. Deployment and persisted-data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final stat…
- **Codex view (core-005, calculation, location; Codex family 'SKO/VuDu'):** Bounded gap display score
  - Formula: 100*tanh(gap/scale).
  - Purpose: Describe expected versus observed performance without predicting quality or market value.
  - Inputs/units: Oriented native gap and positive fixed scale.
  - Output scale: (-100, 100) display score.
  - Version/status: Local octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f (2026-11-10). Pure Phase0 contract; distinct from legacy sKO. Deployment and persisted-data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final stat…
- **Codex view (core-006, calculation, codex_part_of_opus; Codex family 'SKO/VuDu'):** Pooled rate
  - Formula: numerator/denominator; no average of individual ratios.
  - Purpose: Describe expected versus observed performance without predicting quality or market value.
  - Inputs/units: Summed numerator and nonnegative denominator.
  - Output scale: Native count/exposure rate or null.
  - Version/status: Local octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f (2026-11-10). Pure Phase0 contract; distinct from legacy sKO. Deployment and persisted-data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final stat…
- **Codex view (core-008, calculation, location; Codex family 'SKO/VuDu'):** Gap watch label
  - Formula: Positive >=threshold rebound; negative <=-threshold cooling; zero never watch.
  - Purpose: Describe expected versus observed performance without predicting quality or market value.
  - Inputs/units: Oriented native gap; nonnegative inclusive threshold.
  - Output scale: Rebound watch, Cooling watch, or null.
  - Version/status: Local octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f (2026-11-10). Pure Phase0 contract; distinct from legacy sKO. Deployment and persisted-data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final stat…
- **Audit context:**
  - Intent (Opus): 'Pure SKO/VuDu Phase 0 descriptive gap math (new contract)' (web/lib/predictions/legacyQuarantine.ts:120)
  - Intended contract (Codex core-004): Same target, horizon and strength state required; gap.ts comments. Pure Phase0 math, no legacy product wiring: web/lib/predictions/legacyQuarantine.ts:120.
  - Intended contract (Codex core-005): Same target, horizon and strength state required; gap.ts comments. Pure Phase0 math, no legacy product wiring: web/lib/predictions/legacyQuarantine.ts:120.
  - Intended contract (Codex core-006): Same target, horizon and strength state required; gap.ts comments. Pure Phase0 math, no legacy product wiring: web/lib/predictions/legacyQuarantine.ts:120.
  - Intended contract (Codex core-008): Same target, horizon and strength state required; gap.ts comments. Pure Phase0 math, no legacy product wiring: web/lib/predictions/legacyQuarantine.ts:120.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `Located only; not run for this inventory.`; `web/lib/sko/gap.test.ts`
- **Leads (not audited):**
  - (opus) no production caller; scale/threshold per target undefined
  - (codex:core-004) ["Calculation inventory only; formulas and inputs have not been vetted."]
  - (codex:core-005) ["Calculation inventory only; formulas and inputs have not been vetted."]
  - (codex:core-006) ["Calculation inventory only; formulas and inputs have not been vetted."]
  - (codex:core-008) ["Calculation inventory only; formulas and inputs have not been vetted."]

## M-SKO-010 Legacy sKO stat weights (inverse ratings)

- **Match:** Both; Opus SKO-016; Codex core-022
- **Purpose:** Weights for the characteristic-game score.
- **Where:** `web/lib/supabase/utils/constants.ts:111 (STAT_WEIGHTS)`; `web/lib/supabase/utils/constants.ts:47 (RATED_STAT_FIELDS)`; `web/lib/supabase/utils/constants.ts:111 STAT_WEIGHTS`
- **Tags (heuristic):** generation: legacy
- **Opus view (SKO-016):**
  - Method: w_i = (1/rating_i)/sum(1/rating_j) (weights sum to 1).
  - Inputs/units: —; sources: —
  - Output scale: weights summing to 1; writes: —
  - Status: legacy/dead
  - Consumers: computeCharacteristicResults
- **Codex view (core-022, calculation, location; Codex family 'legacy SKO'):** Legacy normalized inverse-importance weights
  - Formula: (1/rating)/sum(1/rating).
  - Purpose: Weight 8 characteristic stats.
  - Inputs/units: Importance ratings for SH%, IPP, on-ice SH%, zone starts, TOI, PA/SA, SOG60, PPTOI%.
  - Output scale: Weights sum 1.
  - Version/status: Local octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f (2026-11-10). Explicit quarantined legacy lineage; historical-only decision2026-07-28 in legacyQuarantine.ts. Deployment and persisted-data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no …
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex core-022): Implementation and adjacent source comments in web/lib/supabase/utils/constants.ts:111; no separate approved specification identified.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `Located only; not run for this inventory.`; `No directly named test identified; no tests executed.`; `web/lib/supabase/utils/legacySko.test.ts`
- **Leads (not audited):**
  - (opus) rating constants undocumented
  - (codex:core-022) ["Calculation inventory only; formulas and inputs have not been vetted."]

## M-SKO-011 Legacy sKO confidence multiplier and empirical thresholds

- **Match:** Both; Opus SKO-017; Codex core-019, core-020, core-021
- **Purpose:** Maps rolling 'CV' to a confidence multiplier; derives T1/T2 from quantiles.
- **Where:** `web/lib/supabase/utils/statistics.ts:200 (computeConfidenceMultiplierSmooth)`; `web/lib/supabase/utils/statistics.ts:227 (computeEmpiricalThresholds)`; `web/lib/supabase/utils/statistics.ts:178 (computeRollingAverage)`; `web/lib/supabase/utils/statistics.ts:178 computeRollingAverage`; `web/lib/supabase/utils/statistics.ts:200 computeConfidenceMultiplierSmooth`; `web/lib/supabase/utils/statistics.ts:227 computeEmpiricalThresholds`
- **Tags (heuristic):** generation: legacy
- **Opus view (SKO-017):**
  - Method: x = clamp((cv - T1)/(T2 - T1)); mult = min + (max-min)*(1 - (3x^2 - 2x^3)), default 0.8-1.0; empirical T1/T2 = floor(p*n) order statistic at p 0.5 / 0.9; rolling mean over window.
  - Inputs/units: —; sources: —
  - Output scale: 0.8-1.0; writes: —
  - Status: legacy/dead
  - Consumers: none found
- **Codex view (core-019, calculation, location; Codex family 'legacy SKO'):** Legacy rolling characteristic average
  - Formula: Mean of prefix/trailing window; nonfinite terms 0.
  - Purpose: Retain historical calculation lineage for later review.
  - Inputs/units: Numeric history and window count.
  - Output scale: Same-unit rolling average.
  - Version/status: Local octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f (2026-11-10). Explicit quarantined legacy lineage; historical-only decision2026-07-28 in legacyQuarantine.ts. Deployment and persisted-data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no …
- **Codex view (core-020, calculation, location; Codex family 'legacy SKO'):** Legacy confidence multiplier
  - Formula: x=clamp((rollingCV-T1)/(T2-T1), 0, 1); min+(max-min)*(1-3x²+2x³).
  - Purpose: Retain historical calculation lineage for later review.
  - Inputs/units: rollingCV (legacy naming), T1, T2, min=.8, max=1.
  - Output scale: Multiplier .8..1 by default.
  - Version/status: Local octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f (2026-11-10). Explicit quarantined legacy lineage; historical-only decision2026-07-28 in legacyQuarantine.ts. Deployment and persisted-data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no …
- **Codex view (core-021, calculation, location; Codex family 'legacy SKO'):** Legacy empirical characteristic thresholds
  - Formula: Sorted order statistic at floor(p*n), clipped index.
  - Purpose: Retain historical calculation lineage for later review.
  - Inputs/units: Finite squared-z scores and quantiles default .5, .9.
  - Output scale: Native-score T1/T2.
  - Version/status: Local octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f (2026-11-10). Explicit quarantined legacy lineage; historical-only decision2026-07-28 in legacyQuarantine.ts. Deployment and persisted-data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no …
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex core-019): Implementation and adjacent source comments in web/lib/supabase/utils/statistics.ts:178; no separate approved specification identified.
  - Intended contract (Codex core-020): Implementation and adjacent source comments in web/lib/supabase/utils/statistics.ts:200; no separate approved specification identified.
  - Intended contract (Codex core-021): Implementation and adjacent source comments in web/lib/supabase/utils/statistics.ts:227; no separate approved specification identified.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `Located only; not run for this inventory.`; `web/lib/supabase/utils/legacySko.test.ts`
- **Leads (not audited):**
  - (opus) no callers outside tests
  - (codex:core-019) ["Calculation inventory only; formulas and inputs have not been vetted."]
  - (codex:core-020) ["Calculation inventory only; formulas and inputs have not been vetted."]
  - (codex:core-021) ["Calculation inventory only; formulas and inputs have not been vetted."]

## M-SKO-012 Legacy sKO characteristic-game classification (weighted squared z)

- **Match:** Both; Opus SKO-018; Codex core-017, core-018
- **Purpose:** Labels each game as highly/moderately/un-characteristic versus the player's prior games.
- **Where:** `web/lib/supabase/utils/statistics.ts:26 (computeStatSummaries)`; `web/lib/supabase/utils/statistics.ts:72 (computeCharacteristicResults)`; `web/lib/supabase/utils/statistics.ts:26 computeStatSummaries`; `web/lib/supabase/utils/statistics.ts:72 computeCharacteristicResults`
- **Tags (heuristic):** denominators: per 60, per game; generation: legacy
- **Opus view (SKO-018):**
  - Method: Per game, mean/SD (population, SD 1 if 0) from PRIOR games only; z capped +-5; S = sum w_i z_i^2; T1 = sum w (=1), T2 = T1 + 2*sqrt(2*sum w^2); S <= T1 highly, <= T2 moderately, else uncharacteristic; per-stat \|z\|<=1/2 bands. PA/SA ratio capped at 10 (Infinity in summaries for 0 SA).
  - Inputs/units: mixed (percents, seconds, per 60); sources: sko_skater_stats, wgo_skater_stats
  - Output scale: weighted chi-square-like score; writes: —
  - Status: legacy/dead
  - Consumers: no live caller (skoCharts page is a stub)
- **Codex view (core-017, calculation, location; Codex family 'legacy SKO'):** Legacy per-stat mean/SD and assist ratio
  - Formula: PA/SA or infinity when PA>0, SA0; exclude nonfinite; finite mean/population variance.
  - Purpose: Retain historical calculation lineage for later review.
  - Inputs/units: Game stats including primary/secondary assists.
  - Output scale: Means, population SD; PA/SA ratio; SD fallback 1.
  - Version/status: Local octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f (2026-11-10). Explicit quarantined legacy lineage; historical-only decision2026-07-28 in legacyQuarantine.ts. Deployment and persisted-data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no …
- **Codex view (core-018, calculation, location; Codex family 'legacy SKO'):** Characteristic weighted squared z-score
  - Formula: Compare each game with strictly earlier history; z clamp ±5; sum(w*z²); T1=sum(w); T2=T1+2*sqrt(2sum(w²)); PA/SA capped at 10.
  - Purpose: Retain historical calculation lineage for later review.
  - Inputs/units: Ordered game logs; inverted normalized STAT_WEIGHTS.
  - Output scale: Weighted squared z sum; characteristic status; T1, T2.
  - Version/status: Local octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f (2026-11-10). Explicit quarantined legacy lineage; historical-only decision2026-07-28 in legacyQuarantine.ts. Deployment and persisted-data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no …
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex core-017): Implementation and adjacent source comments in web/lib/supabase/utils/statistics.ts:26; no separate approved specification identified.
  - Intended contract (Codex core-018): Implementation and adjacent source comments in web/lib/supabase/utils/statistics.ts:72; no separate approved specification identified.
  - External references: Chi-square-style weighted Mahalanobis distance
  - Fixtures/test data: none listed
  - Tests: `Located only; not run for this inventory.`; `web/lib/supabase/utils/legacySko.test.ts`
- **Leads (not audited):**
  - (opus) computeStatSummaries sets pa_to_sa_ratio = Infinity when SA=0, then filters non-finite values, so those games drop out of the ratio baseline
  - (opus) thresholds assume independent standard-normal z which capped small-sample z are not
  - (codex:core-017) ["Calculation inventory only; formulas and inputs have not been vetted."]
  - (codex:core-018) ["Calculation inventory only; formulas and inputs have not been vetted."]

## M-SKO-013 Legacy sKO Game Score

- **Match:** Both; Opus SKO-019; Codex core-016
- **Purpose:** Per-game Game Score for sKO charts.
- **Where:** `web/lib/supabase/utils/calculations.ts:10 (calculateGameScore)`; `web/lib/supabase/utils/calculations.ts:10 calculateGameScore`
- **Tags (heuristic):** denominators: all strengths, shots on goal; generation: legacy
- **Opus view (SKO-019):**
  - Method: 0.75G + 0.7A1 + 0.55A2 + 0.075SOG + 0.05BLK + 0.15PD - 0.15PT + 0.01FOW - 0.01FOL + 0.05CF - 0.05CA + 0.15GF - 0.15GA.
  - Inputs/units: counts; sources: wgo_skater_stats, sko_skater_stats
  - Output scale: Game Score points; writes: —
  - Status: legacy/dead — header 'lineage and quarantine-era reference only' (calculations.ts:1-6)
  - Consumers: none in live code (GameScoreChart displays quarantined predictedGameScore)
- **Codex view (core-016, calculation, location; Codex family 'legacy SKO'):** Legacy GameScore
  - Formula: .75G+.7A1+.55A2+.075SOG+.05BLK+.15PD-.15PT+.01FOW-.01FOL+.05CF-.05CA+.15GF-.15GA; missing 0.
  - Purpose: Weighted hockey game production score.
  - Inputs/units: G, A1, A2, SOG, BLK, PD, PT, FOW, FOL, CF/CA (usat), GF/GA all-strength counts.
  - Output scale: Signed score; no hard bounds.
  - Version/status: Local octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f (2026-11-10). Explicit quarantined legacy lineage; historical-only decision2026-07-28 in legacyQuarantine.ts. Deployment and persisted-data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no …
- **Audit context:**
  - Intent (Opus): web/lib/supabase/utils/calculations.ts:3-6 ('Legacy sKO-only game-score helper... remains for lineage and quarantine-era reference only')
  - Intended contract (Codex core-016): Implementation and adjacent source comments in web/lib/supabase/utils/calculations.ts:10; no separate approved specification identified.
  - External references: Dom Luszczyszyn Game Score (2016): same coefficients but CF/CA and GF/GA are 5v5 on-ice
  - Fixtures/test data: `web/lib/supabase/utils/legacySko.test.ts`
  - Tests: `Located only; not run for this inventory.`; `web/lib/supabase/utils/legacySko.test.ts`
- **Leads (not audited):**
  - (opus) GF/GA summed over all strengths (ES+PP+SH) and CF/CA from USAT all-situations, unlike 5v5 in the reference
  - (opus) no live caller (dead code kept for lineage)
  - (opus) GF/GA summed over all strengths and CF/CA from all-strength USAT, while reference Game Score uses 5v5 on-ice events
  - (opus) dead/quarantined code with no live importer
  - (codex:core-016) ["Calculation inventory only; formulas and inputs have not been vetted."]

## M-SKO-014 sKO prediction: recent points blend (pred_points)

- **Match:** Both; Opus SKO-024; Codex core-311
- **Purpose:** Baseline points forecast for the next N games.
- **Where:** `web/pages/api/v1/ml/update-predictions-sko.ts:305 (buildPredictionRecord)`; `web/pages/api/v1/ml/update-predictions-sko.ts:183 (fetchPlayerSeries)`; `web/pages/api/v1/ml/update-predictions-sko.ts:305 buildPredictionRecord`
- **Tags (heuristic):** denominators: per game; generation: legacy
- **Opus view (SKO-024):**
  - Method: avg5 = mean(last 5), avg10 = mean(last 10); recentBlend = 0.6*avg10 + 0.4*avg5; pred_points = recentBlend * horizon (default 5); pred_points_per_game = pred/horizon. No regression to career/league mean.
  - Inputs/units: points per game; sources: player_stats_unified
  - Output scale: points over horizon; writes: predictions_sko
  - Status: legacy/dead — quarantined in web/lib/predictions/legacyQuarantine.ts (sko_predictions, historicalOnly 2026-07-28); route still exists behind withPredictionsSkoRunControl
  - Consumers: /api/v1/ml/get-predictions-sko; PredictionsLeaderboard; useQuarantinedPredictionsSko
- **Codex view (core-311, calculation, location; Codex family 'legacy SKO prediction'):** Recent points blend and stability-adjusted SKO
  - Formula: RecentBlend=.6*mean(last10)+.4*mean(last5); prediction=blend*horizon; SDshort versus thresholds .8*SDlast20 and 1.2*SDlast20; smoothstep stability multiplier; sko=prediction*multiplier.
  - Purpose: Calculate recent points blend and stability-adjusted sko.
  - Inputs/units: Ordered NHL points series; horizon games; stability window.
  - Output scale: pred_points total, per-game rate, stability_cv (actually SD), multiplier .8..1, sko.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f. Compatibility-only quarantine per legacyQuarantine.ts; model constants in route. Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry …
- **Audit context:**
  - Intent (Opus): sKO = Prediction x Stability (web/components/Predictions/SkoExplainer.tsx:11)
  - Intended contract (Codex core-311): Source types and implementation in web/pages/api/v1/ml/update-predictions-sko.ts:305; separate acceptance not verified.
  - External references: Marcel-style weighted averages with regression to mean (Tango)
  - Fixtures/test data: none listed
  - Tests: `Located only; not run for this inventory.`; `web/__tests__/pages/api/v1/ml/get-predictions-sko.test.ts`; `web/__tests__/pages/api/v1/ml/update-predictions-sko.test.ts`
- **Leads (not audited):**
  - (opus) no shrinkage, so a 5-game hot streak is projected forward unregressed
  - (opus) MODEL_NAME 'baseline-moving-average' v0.3
  - (codex:core-311) ["Inventory only, not validation of the formula, source semantics or model quality."]

## M-SKO-015 combineSKO / computeLuck (trends utils)

- **Match:** Both; Opus SKO-026; Codex core-196, core-197, core-198
- **Purpose:** Alternative sKO sustainability composite and luck deltas.
- **Where:** `web/lib/trends/utils.ts:140 (computeLuck)`; `web/lib/trends/utils.ts:163 (combineSKO)`; `web/lib/trends/utils.ts:192 (classifyRole)`; `web/lib/trends/utils.ts:140 computeLuck`; `web/lib/trends/utils.ts:163 combineSKO`; `web/lib/trends/utils.ts:192 classifyRole`
- **Tags (heuristic):** percent scale: 0-100; generation: legacy
- **Opus view (SKO-026):**
  - Method: sustainability = clamp01(0.45*off + 0.25*def + 0.3*onIce - 0.35*luck) * 100; luck deltas xG-G, onIceSH-0.08, PDO-1.0, IPP-baseline; role: Two-Way if def>0.8 and (d>0.6 or m>0.6); Play Driver if d-m>0.25; Play Maker if m-d>0.25; Defensive Specialist if def>0.8; else Balanced.
  - Inputs/units: 0-1 scores; fractions; sources: —
  - Output scale: 0-100; writes: —
  - Status: legacy/dead — no callers found
  - Consumers: none found
- **Codex view (core-196, calculation, location; Codex family 'trends utilities'):** Luck proxy deltas
  - Formula: Native differences; these are proxy context, not causal findings.
  - Purpose: Calculate luck proxy deltas.
  - Inputs/units: Goals, xG, on-ice SH fraction, PDO fraction, IPP fraction/reference.
  - Output scale: xG-G; on-ice SH-.08; PDO-1; IPP-reference.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f.  Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final status check.
- **Codex view (core-197, calculation, location; Codex family 'trends utilities'):** SKO skill/on-ice/luck composite
  - Formula: clamp(.45*off+.25*def+.30*onice-.35*luck, 0, 1)*100.
  - Purpose: Calculate sko skill/on-ice/luck composite.
  - Inputs/units: Skill offense/defense, on-ice impact, luck normalized 0..1.
  - Output scale: Rounded 0..100 component/composite display.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f.  Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final status check.
- **Codex view (core-198, calculation, location; Codex family 'trends utilities'):** Role classification
  - Formula: Two-Way if defense>.8 and driver or maker>.6; difference>.25 selects driver/maker; def>.8 specialist.
  - Purpose: Calculate role classification.
  - Inputs/units: Driver, maker, defense signals.
  - Output scale: Play Driver/Play Maker/Balanced/Two-Way/Defensive Specialist.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f.  Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final status check.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex core-196): Source types and implementation in web/lib/trends/utils.ts:140; separate acceptance not verified.
  - Intended contract (Codex core-197): Source types and implementation in web/lib/trends/utils.ts:163; separate acceptance not verified.
  - Intended contract (Codex core-198): Source types and implementation in web/lib/trends/utils.ts:192; separate acceptance not verified.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `No directly named test located; tests not run.`
- **Leads (not audited):**
  - (opus) positive weights sum to 1.0 plus a 0.35 luck penalty; no callers
  - (opus) 8% on-ice SH baseline hard-coded
  - (codex:core-196) ["Inventory only, not validation of the formula, source semantics or model quality."]
  - (codex:core-197) ["Inventory only, not validation of the formula, source semantics or model quality."]
  - (codex:core-198) ["Inventory only, not validation of the formula, source semantics or model quality."]

## M-SKO-016 fn analytics.rpc_sko_player_series (+ public wrapper)

- **Match:** Opus only; Opus SKO-004; Codex —
- **Purpose:** Player sKO time series with EWMA and hot/cold streak flags vs training baseline
- **Where:** `supabase/migrations/20260730233451_reconstruct_hosted_analytics_schema.sql:751 (analytics.rpc_sko_player_series)`; `web/sql/functions/analytics.rpc_sko_player_series.sql:4 (repo source)`; `supabase/migrations/20260716112908_production_schema_baseline.sql:4342 (public.rpc_sko_player_series wrapper)`; `web/sql/functions/public.rpc_sko_player_series.sql:4`
- **Tags (heuristic):** generation: legacy, research
- **Opus view (SKO-004):**
  - Method: baseline mu0 = median sko over seasons 20212022-20232024; sigma0 = 1.4826*MAD. EWMA alpha = 2/(span+1) recursive by game order. hot_flag if ewma - mu0 >= 1.8*sigma0; cold if mu0 - ewma >= 1.6*sigma0; streak start when flag=1 and lag(flag, L-1)=1; streak ids = cumulative sum of starts.
  - Inputs/units: sko (-1,1); sources: analytics.vw_sko_skater_scores, analytics.vw_sko_skater_base
  - Output scale: EWMA in (-1,1); flags 0/1; writes: —
  - Status: legacy/dead — 'Legacy research SQL; no runtime TypeScript caller' (web/lib/predictions/legacyQuarantine.ts:125)
  - Consumers: no runtime caller (legacyQuarantine.ts:125)
- **Audit context:**
  - Intent (Opus): web/sql/functions/public.rpc_sko_player_series.sql:2 'Wrapper to expose analytics RPC'; contract tasks/TASKS/sko-charts/sko-ownership-contract.md
  - External references: EWMA control chart / CUSUM-like streak detection
  - Fixtures/test data: `web/sql/tests/sko_trends_validation.sql`
  - Tests: `web/lib/supabase/supportedBaselineMigration.test.ts`; `web/sql/tests/sko_trends_validation.sql`
- **Leads (not audited):**
  - (opus) training seasons hard-coded (2021-22..2023-24); players without them get sigma0=0 so every game flags
  - (opus) streak test checks only the flag L-1 games back, not all L consecutive games

## M-SKO-017 sKO skater stats row derivations (IPP, SOG/60)

- **Match:** Opus only; Opus SKO-005; Codex —
- **Purpose:** Build per-date sKO skater stat rows from WGO endpoints with derived IPP and SOG/60.
- **Where:** `web/pages/api/v1/db/update-sko-stats.ts:128 (buildSkoSkaterStatsRow)`
- **Tags (heuristic):** percent scale: 0-100; denominators: per 60; generation: current
- **Opus view (SKO-005):**
  - Method: ipp = points / (ES GF + PP GF + SH GF) * 100 (null when 0); sog_per_60 = shots / (timeOnIce seconds/60) * 60; everything else copied.
  - Inputs/units: TOI seconds; GF counts; sources: NHL stats REST (WGO) skater endpoints
  - Output scale: IPP percent 0-100; per-60; writes: sko_skater_stats
  - Status: live but disconnected — docs/player-projections/duplicate-retirement-ledger.md RET-006 'Active retained update-sko-stats-full-season pg_cron'
  - Consumers: legacy analytics SQL views (docs RET-006)
- **Audit context:**
  - Intent (Opus): docs/player-projections/duplicate-retirement-ledger.md RET-006
  - External references: IPP = points / on-ice GF
  - Fixtures/test data: none listed
  - Tests: `web/__tests__/pages/api/v1/db/update-sko-stats.test.ts`
- **Leads (not audited):**
  - (opus) IPP stored on 0-100 scale while most other IPP fields in the repo are 0-1
  - (opus) per docs RET-006 this pipeline does not feed the active sKO writer

## M-SKO-018 Sko Element: personal reference block change and outlook change

- **Match:** Opus only; Opus SKO-007; Codex —
- **Purpose:** Compares the recent block with the player's preceding disjoint block, and the current with a prior FORGE issuance.
- **Where:** `web/lib/skoElement/interpret.ts:245-247 (personalReference)`; `web/lib/skoElement/interpret.ts:256-262 (outlook)`
- **Tags (heuristic):** denominators: per team game; generation: development, current
- **Opus view (SKO-007):**
  - Method: prior block = games[-2k, -k]; changePerTeamGame = recent - prior; outlook = expected(current forecast) - expected(prior forecast), prior must be earlier readAsOf.
  - Inputs/units: count per team game; sources: —
  - Output scale: signed difference; writes: —
  - Status: draft — fixture stage (contract 'sko-interpretation-v0.2'); used by lib/skoElement/fixtures.ts -> /sko-element/preview and lib/buyLowSellHigh/market.ts; preview 404s in production per tasks/artifacts/blsh-sko-vudu-audit-2026-11-04.md
  - Consumers: explanations (cooling-with-upgrade)
- **Audit context:**
  - Intent (Opus): Diagnostic-first interpretation: FORGE expectations passed through unchanged, no normalized SKO score (web/lib/skoElement/contract.ts:1-9)
  - External references: none suggested
  - Fixtures/test data: `web/lib/skoElement/fixtures.ts`; `tasks/artifacts/blsh-sko-vudu-audit-2026-11-04.md`
  - Tests: `web/components/skoElement/SkoElementPreview.test.tsx`; `web/lib/skoElement/interpret.test.ts`

## M-SKO-019 Sko Element: observed per-team-game and per-appearance rates

- **Match:** Opus only; Opus SKO-010; Codex —
- **Purpose:** Recent production rates over the last k completed team games.
- **Where:** `web/lib/skoElement/interpret.ts:32 (normalizeTeamGames)`; `web/lib/skoElement/interpret.ts:70 (perTeamGameValues)`; `web/lib/skoElement/interpret.ts:236-240 (observedPerTeamGame / observedPerAppearance)`
- **Tags (heuristic):** denominators: per game, per appearance, per team game, shots on goal; generation: development, current
- **Opus view (SKO-010):**
  - Method: recent window = last k (config.recentWindowTeamGames 5/10/20) completed team games available at asOf; per team game = mean with confirmed absences as 0, null if any unknown; per appearance = mean over appeared games; sparse if appearances < minAppearancesForRate. Targets POINTS, GOALS, ASSISTS, PP_POINTS, SOG, HITS, BLOCKS, PIM.
  - Inputs/units: counts per game; sources: —
  - Output scale: count per team game; writes: —
  - Status: draft — fixture stage (contract 'sko-interpretation-v0.2'); used by lib/skoElement/fixtures.ts -> /sko-element/preview and lib/buyLowSellHigh/market.ts; preview 404s in production per tasks/artifacts/blsh-sko-vudu-audit-2026-11-04.md
  - Consumers: gap; BLSH market (lib/buyLowSellHigh/market.ts); SkoElementPreview
- **Audit context:**
  - Intent (Opus): Diagnostic-first interpretation: FORGE expectations passed through unchanged, no normalized SKO score (web/lib/skoElement/contract.ts:1-9)
  - External references: none suggested
  - Fixtures/test data: `web/lib/skoElement/fixtures.ts`; `tasks/artifacts/blsh-sko-vudu-audit-2026-11-04.md`
  - Tests: `web/components/skoElement/SkoElementPreview.test.tsx`; `web/lib/skoElement/interpret.test.ts`

## M-SKO-020 Sko Element: observed variability (sample SD)

- **Match:** Opus only; Opus SKO-013; Codex —
- **Purpose:** Spread of per-team-game values in the recent window.
- **Where:** `web/lib/skoElement/interpret.ts:83 (sampleSd)`; `web/lib/skoElement/interpret.ts:267`
- **Tags (heuristic):** denominators: per team game; generation: development, current
- **Opus view (SKO-013):**
  - Method: sample SD with n-1; null if < 2 team games.
  - Inputs/units: count; sources: —
  - Output scale: SD; writes: —
  - Status: draft — fixture stage (contract 'sko-interpretation-v0.2'); used by lib/skoElement/fixtures.ts -> /sko-element/preview and lib/buyLowSellHigh/market.ts; preview 404s in production per tasks/artifacts/blsh-sko-vudu-audit-2026-11-04.md
  - Consumers: SkoElementPreview
- **Audit context:**
  - Intent (Opus): Diagnostic-first interpretation: FORGE expectations passed through unchanged, no normalized SKO score (web/lib/skoElement/contract.ts:1-9)
  - External references: none suggested
  - Fixtures/test data: `web/lib/skoElement/fixtures.ts`; `tasks/artifacts/blsh-sko-vudu-audit-2026-11-04.md`
  - Tests: `web/components/skoElement/SkoElementPreview.test.tsx`; `web/lib/skoElement/interpret.test.ts`
- **Leads (not audited):**
  - (opus) legacy sKO used population SD; element uses sample SD

## M-SKO-021 Sko Element: FORGE expected per scheduled team game and conditional per appearance

- **Match:** Opus only; Opus SKO-014; Codex —
- **Purpose:** Expected rate passed through from FORGE game expectations.
- **Where:** `web/lib/skoElement/interpret.ts:88 (expectedPerTeamGame)`; `web/lib/skoElement/interpret.ts:249 (conditional)`; `web/lib/skoElement/interpret.ts:100 (forecastExpiry)`
- **Tags (heuristic):** conditionality: conditional; denominators: per game, per team game; generation: development, current
- **Opus view (SKO-014):**
  - Method: expected = total.expected / requiredGames when horizon matches (5/10/20, default 10) and unit is count and not expired (earliest target expiresAt <= asOf); conditional = mean of per-game conditional values.
  - Inputs/units: counts over horizon; sources: FORGE forge-game-expectations-v1 player view
  - Output scale: count per team game; writes: —
  - Status: draft — fixture stage (contract 'sko-interpretation-v0.2'); used by lib/skoElement/fixtures.ts -> /sko-element/preview and lib/buyLowSellHigh/market.ts; preview 404s in production per tasks/artifacts/blsh-sko-vudu-audit-2026-11-04.md
  - Consumers: gap; BLSH
- **Audit context:**
  - Intent (Opus): Diagnostic-first interpretation: FORGE expectations passed through unchanged, no normalized SKO score (web/lib/skoElement/contract.ts:1-9)
  - External references: none suggested
  - Fixtures/test data: `web/lib/skoElement/fixtures.ts`; `tasks/artifacts/blsh-sko-vudu-audit-2026-11-04.md`
  - Tests: `web/components/skoElement/SkoElementPreview.test.tsx`; `web/lib/skoElement/interpret.test.ts`

## M-SKO-022 sKO skater stat ingestion derived fields (IPP, SOG/60)

- **Match:** Opus only; Opus SKO-020; Codex —
- **Purpose:** Derived per-day skater fields stored for sKO.
- **Where:** `web/pages/api/v1/db/update-sko-stats.ts:128 (buildSkoSkaterStatsRow)`; `web/lib/supabase/Upserts/fetchSKOyears.js:155-176`; `web/lib/supabase/Upserts/fetchSKOskaterStats.js`
- **Tags (heuristic):** percent scale: 0-100; denominators: per 60, shots on goal; generation: legacy, current
- **Opus view (SKO-020):**
  - Method: totalOnIceGF = ES GF + PP GF + SH GF; IPP = points/totalOnIceGF*100; SOG/60 = shots/(TOI seconds/60)*60; other fields copied.
  - Inputs/units: TOI seconds; counts; sources: NHL stats API (WGO reports)
  - Output scale: IPP percent 0-100; per 60; writes: sko_skater_stats
  - Status: live? — update-sko-stats cron-audited route (benchmarkNotes 'update-sko-stats-full-season'); fetchSKO*.js scripts legacy
  - Consumers: legacy sKO characteristic helpers; dataFetching.ts
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: NST IPP (individual points / on-ice GF, all situations)
  - Fixtures/test data: none listed
  - Tests: `web/__tests__/pages/api/v1/db/update-sko-stats.route.test.ts`; `web/__tests__/pages/api/v1/db/update-sko-stats.test.ts`
- **Leads (not audited):**
  - (opus) IPP is percent 0-100 here while skoElement IPP is a fraction 0-1

## M-SKO-023 sKO leaderboard overall accuracy (sample-weighted hit rate)

- **Match:** Opus only; Opus SKO-021; Codex —
- **Purpose:** Composite accuracy card across stat metrics.
- **Where:** `web/components/Predictions/MetricCards.tsx:34-37`
- **Tags (heuristic):** percent scale: fraction 0-1; generation: legacy
- **Opus view (SKO-021):**
  - Method: overall = sum(hitRate*sampleSize)/sum(sampleSize).
  - Inputs/units: fraction; sources: —
  - Output scale: fraction 0-1; writes: —
  - Status: legacy/dead — quarantined in web/lib/predictions/legacyQuarantine.ts (sko_predictions, historicalOnly 2026-07-28); route still exists behind withPredictionsSkoRunControl
  - Consumers: Predictions page
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: none listed
- **Leads (not audited):**
  - (opus) 'hit rate' definition comes from the API and is not visible here

## M-SKO-024 sKO stability statistic (stability_cv)

- **Match:** Opus only; Opus SKO-022; Codex —
- **Purpose:** Recent volatility of the player's points.
- **Where:** `web/pages/api/v1/ml/update-predictions-sko.ts:112 (stddev)`; `web/pages/api/v1/ml/update-predictions-sko.ts:323-326`
- **Tags (heuristic):** denominators: per game; generation: legacy
- **Opus view (SKO-022):**
  - Method: stdevShort = population SD of last stabilityWindow (default 10) games; stdevLong = population SD of last 20 games (0 if < 2 values).
  - Inputs/units: points per game; sources: player_stats_unified
  - Output scale: SD of points; writes: predictions_sko
  - Status: legacy/dead — quarantined in web/lib/predictions/legacyQuarantine.ts (sko_predictions, historicalOnly 2026-07-28); route still exists behind withPredictionsSkoRunControl
  - Consumers: stability multiplier
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: Coefficient of variation = SD/mean
  - Fixtures/test data: none listed
  - Tests: `web/__tests__/pages/api/v1/ml/get-predictions-sko.test.ts`; `web/__tests__/pages/api/v1/ml/update-predictions-sko.test.ts`
- **Leads (not audited):**
  - (opus) stored as 'stability_cv' but it is a standard deviation, not a coefficient of variation

## M-SKO-025 sKO stability multiplier (smoothstep 0.8-1.0)

- **Match:** Opus only; Opus SKO-023; Codex —
- **Purpose:** Discounts the prediction for players more volatile lately than usual.
- **Where:** `web/pages/api/v1/ml/update-predictions-sko.ts:120 (smoothstepMultiplier)`; `web/pages/api/v1/ml/update-predictions-sko.ts:327-329`
- **Tags (heuristic):** generation: legacy
- **Opus view (SKO-023):**
  - Method: t1 = max(0, 0.8*stdevLong); t2 = max(t1+1e-6, 1.2*stdevLong); x = clamp((stdevShort - t1)/(t2 - t1), 0, 1); mult = 0.8 + 0.2*(1 - (3x^2 - 2x^3)).
  - Inputs/units: SD of points; sources: —
  - Output scale: multiplier 0.8-1.0; writes: predictions_sko
  - Status: legacy/dead — quarantined in web/lib/predictions/legacyQuarantine.ts (sko_predictions, historicalOnly 2026-07-28); route still exists behind withPredictionsSkoRunControl
  - Consumers: sko
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/__tests__/pages/api/v1/ml/get-predictions-sko.test.ts`; `web/__tests__/pages/api/v1/ml/update-predictions-sko.test.ts`
- **Leads (not audited):**
  - (opus) when stdevLong=0 (e.g. scoreless 20 games) t1=0, t2=1e-6 so any variance yields 0.8
  - (opus) penalizes volatility symmetrically regardless of direction

## M-SKO-026 sKO score (pred_points x stability)

- **Match:** Opus only; Opus SKO-025; Codex —
- **Purpose:** Headline sKO value shown on the Predictions leaderboard.
- **Where:** `web/pages/api/v1/ml/update-predictions-sko.ts:330 (sko)`; `web/components/Predictions/PredictionsLeaderboard.tsx:100-130 (row selection)`
- **Tags (heuristic):** generation: legacy
- **Opus view (SKO-025):**
  - Method: sko = pred_points * stability_multiplier. Leaderboard picks per player/date the latest-created row with non-null sko, else highest pred_points.
  - Inputs/units: points; sources: —
  - Output scale: points over horizon (0.8-1.0 of pred); writes: predictions_sko
  - Status: legacy/dead — quarantined in web/lib/predictions/legacyQuarantine.ts (sko_predictions, historicalOnly 2026-07-28); route still exists behind withPredictionsSkoRunControl
  - Consumers: PredictionsLeaderboard sparkline; PlayerTable
- **Audit context:**
  - Intent (Opus): SkoExplainer.tsx:6-11 'Sustainability K-Value Outlook ... sKO = Prediction x Stability'
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/__tests__/pages/api/v1/ml/get-predictions-sko.test.ts`; `web/__tests__/pages/api/v1/ml/update-predictions-sko.test.ts`
- **Leads (not audited):**
  - (opus) 'sKO' name is reused for unrelated things: this legacy points x stability, the Sko Element interpretation contract, the sustainability_score model ('sKO score model v3', tasks/artifacts/sko-model-v3-2026-11-03/DEPLOY-SQL.md) and combineSKO in lib/trends/utils.ts

## M-SKO-027 Observed and prior-block category rates

- **Match:** Codex only; Opus —; Codex core-009
- **Purpose:** Read-only interpretation of observed evidence and FORGE forecast; no learned SKO weights.
- **Where:** `web/lib/skoElement/interpret.ts:212 interpretPlayer`
- **Tags (heuristic):** denominators: per appearance, per team game
- **Codex view (core-009, calculation; Codex family 'Sko Element'):** Observed and prior-block category rates
  - Formula: Recent mean includes confirmed absence zeros; prior mean uses preceding disjoint block; personal change=recent-prior.
  - Purpose: Read-only interpretation of observed evidence and FORGE forecast; no learned SKO weights.
  - Inputs/units: Completed team games with participation statuses; POINTS and other SKATER_TARGETS count stats.
  - Output scale: Count per scheduled team game and per appearance; null if unknown participation.
  - Version/status: Local octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f (2026-11-10). Sko Element new-contract fixture/interpretation core; config acceptance is caller-supplied. Deployment and persisted-data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no trac…
  - Consumers: ["web/components/skoElement/SkoElementPreview.tsx", "web/lib/buyLowSellHigh/market.ts", "web/lib/buyLowSellHigh/trade.ts"]
- **Audit context:**
  - Intended contract (Codex core-009): Source limitations at interpret.ts:314: descriptive, not probability/trade instruction; expected values unchanged; no predictive-spread model. VuDu gap awaits accepted goalie adapter.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/skoElement/interpret.test.ts`; `Located only; not run for this inventory.`
- **Leads (not audited):**
  - (codex:core-009) ["Calculation inventory only; formulas and inputs have not been vetted."]

## M-SKO-028 FORGE expectation and descriptive category gap

- **Match:** Codex only; Opus —; Codex core-010
- **Purpose:** Read-only interpretation of observed evidence and FORGE forecast; no learned SKO weights.
- **Where:** `web/lib/skoElement/interpret.ts:212 interpretPlayer`
- **Tags (heuristic):** conditionality: conditional; denominators: per team game
- **Codex view (core-010, calculation; Codex family 'Sko Element'):** FORGE expectation and descriptive category gap
  - Formula: Expected total/requiredGames minus observed/team game; conditional expectation averages supplied conditional game values.
  - Purpose: Read-only interpretation of observed evidence and FORGE forecast; no learned SKO weights.
  - Inputs/units: FORGE expected target totals, required games, next_n horizon, freshness.
  - Output scale: Expected count/team game; expected minus recent; rebound/cooling/level.
  - Version/status: Local octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f (2026-11-10). Sko Element new-contract fixture/interpretation core; config acceptance is caller-supplied. Deployment and persisted-data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no trac…
  - Consumers: ["web/components/skoElement/SkoElementPreview.tsx", "web/lib/buyLowSellHigh/market.ts", "web/lib/buyLowSellHigh/trade.ts"]
- **Audit context:**
  - Intended contract (Codex core-010): Source limitations at interpret.ts:314: descriptive, not probability/trade instruction; expected values unchanged; no predictive-spread model. VuDu gap awaits accepted goalie adapter.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/skoElement/interpret.test.ts`; `Located only; not run for this inventory.`
- **Leads (not audited):**
  - (codex:core-010) ["Calculation inventory only; formulas and inputs have not been vetted."]

## M-SKO-029 Observed category variability and outlook change

- **Match:** Codex only; Opus —; Codex core-011
- **Purpose:** Read-only interpretation of observed evidence and FORGE forecast; no learned SKO weights.
- **Where:** `web/lib/skoElement/interpret.ts:212 interpretPlayer`
- **Tags (heuristic):** denominators: per team game
- **Codex view (core-011, calculation; Codex family 'Sko Element'):** Observed category variability and outlook change
  - Formula: sqrt(sum((x-mean)^2)/(n-1)); current expected rate minus earlier forecast rate.
  - Purpose: Read-only interpretation of observed evidence and FORGE forecast; no learned SKO weights.
  - Inputs/units: Recent per-team-game values and current/prior FORGE forecast.
  - Output scale: Sample SD in counts/team game; expected-rate change.
  - Version/status: Local octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f (2026-11-10). Sko Element new-contract fixture/interpretation core; config acceptance is caller-supplied. Deployment and persisted-data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no trac…
  - Consumers: ["web/components/skoElement/SkoElementPreview.tsx", "web/lib/buyLowSellHigh/market.ts", "web/lib/buyLowSellHigh/trade.ts"]
- **Audit context:**
  - Intended contract (Codex core-011): Source limitations at interpret.ts:314: descriptive, not probability/trade instruction; expected values unchanged; no predictive-spread model. VuDu gap awaits accepted goalie adapter.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/skoElement/interpret.test.ts`; `Located only; not run for this inventory.`
- **Leads (not audited):**
  - (codex:core-011) ["Calculation inventory only; formulas and inputs have not been vetted."]

