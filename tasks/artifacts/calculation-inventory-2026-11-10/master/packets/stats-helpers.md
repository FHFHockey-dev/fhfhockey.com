# Audit packet: Stats helpers

Master entries M-HLP-001 to M-HLP-008 (8 of 8 in this family). Built from the merged Opus and Codex inventories; see [../MASTER.md](../MASTER.md) and [../MERGE-NOTES.md](../MERGE-NOTES.md).

How to read: each entry gives both inventories' descriptions side by side. **Conflicts** are places where the two descriptions disagree; they are unresolved. **Leads** are Opus red flags and Codex unknowns: observations to check, not audited findings. Tags are keyword heuristics. Line numbers were valid when each inventory was written on 2026-11-10 (Opus at d31dcb33f, Codex at 11e4192d3); re-check against the current checkout.

| ID | Name | Match | Conflicts | Leads |
|---|---|---|---:|---:|
| M-HLP-001 | Generic projection math primitives (decayBlend, ewsd, slope, shrinkag… | Both | 0 | 10 |
| M-HLP-002 | Team power EWMA and z-score helpers (pointer) | Both | 0 | 4 |
| M-HLP-003 | Mid-rank percentile helpers (calculateRankingResult / buildPercentile… | Both | 0 | 4 |
| M-HLP-004 | WiGO player ratings (regressed percentile composite by strength) | Both | 0 | 7 |
| M-HLP-005 | Projections page global projected/actual ranks | Both | 0 | 3 |
| M-HLP-006 | Draft-round fantasy point tier thresholds | Both | 0 | 3 |
| M-HLP-007 | Social share shared definitions (per-60, pooled SV%/GAA, BSH, competi… | Opus only | 0 | 2 |
| M-HLP-008 | Percent-unit conversion & exposure-correct share aggregation (NST/WGO… | Opus only | 0 | 2 |

## M-HLP-001 Generic projection math primitives (decayBlend, ewsd, slope, shrinkage, poissonMeanFromRate, selectCountDistribution, clip, goalieFinishMult)

- **Match:** Both; Opus HLP-001; Codex math-clip, math-decayBlend, math-ewsd, math-goalieFinishMult, math-poissonMeanFromRate, math-selectCountDistribution, math-shrinkage, math-slope
- **Purpose:** Reusable EWMA/shrinkage/Poisson-NB/clip helpers for projections.
- **Where:** `web/lib/math/utils.ts:39 (decayBlend)`; `web/lib/math/utils.ts:106 (ewsd)`; `web/lib/math/utils.ts:140 (slope)`; `web/lib/math/utils.ts:169 (shrinkage)`; `web/lib/math/utils.ts:198 (poissonMeanFromRate)`; `web/lib/math/utils.ts:223 (selectCountDistribution)`; `web/lib/math/utils.ts:282 (clip)`; `web/lib/math/utils.ts:296 (goalieFinishMult)`; `web/lib/math/utils.ts:1 clip`; `web/lib/math/utils.ts:39 decayBlend`; `web/lib/math/utils.ts:106 ewsd`; `web/lib/math/utils.ts:296 goalieFinishMult` …
- **Tags (heuristic):** denominators: per 60; generation: legacy
- **Opus view (HLP-001):**
  - Method: decayBlend: weights exp(-daysAgo/tau) x optional multiplier; mean = sum(w v)/sum w; nEff = (sum w)^2/sum w^2. ewsd: weighted population SD. slope: OLS slope vs observation index. shrinkage: nEff/(nEff+k)*recent + k/(nEff+k)*prior. poissonMean = rate/60 * TOI minutes * multiplier. selectCountDistribution: NB if Fano = var/mean > 1.25 with r = mean^2/(var-mean), else Poisson. goalieFinishMult = clip(1 - (svProj - leagueSv)/0.070, 0.80, 1.20).
  - Inputs/units: days; per-60 rate with TOI in MINUTES (poissonMeanFromRate) — differs from rankings code which uses seconds; sources: —
  - Output scale: same units as input; multiplier 0.8-1.2; writes: —
  - Status: legacy/dead — only web/lib/math/utils.test.ts references
  - Consumers: no TypeScript callers found outside tests (rg on each function name)
- **Codex view (math-clip, calculation, codex_part_of_opus; Codex family 'Shared projection math'):** Order-agnostic numerical clipping
  - Purpose: Clamp x to finite min/max bounds; nonfinite handling is explicit.
  - Inputs/units: Numeric value and lower/upper bounds in same units.
  - Output scale: Bounded numeric value.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "deployment": "Unknown; source inspection only."}
- **Codex view (math-decayBlend, calculation, codex_part_of_opus; Codex family 'Shared projection math'):** Exponential decay weighted mean and effective sample size
  - Purpose: w=exp(-max(daysAgo,0)/tau)*optionalWeight; mean=sum(w*x)/sum(w); effective n=(sum w)^2/sum(w²).
  - Inputs/units: Observations in metric units; daysAgo and tauDays days; optional dimensionless nonnegative weight.
  - Output scale: mean same units or null; totalWeight, effectiveSampleSize and sampleCount.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "deployment": "Unknown; source inspection only."}
- **Codex view (math-ewsd, calculation, codex_part_of_opus; Codex family 'Shared projection math'):** Exponentially weighted population deviation
  - Purpose: sqrt(sum(w*(x-weightedMean)^2)/sum w), same decay as decayBlend.
  - Inputs/units: Same samples/time decay as decayBlend.
  - Output scale: Population SD in observation units or null.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "deployment": "Unknown; source inspection only."}
- **Codex view (math-goalieFinishMult, calculation, codex_part_of_opus; Codex family 'Shared projection math'):** Opponent-goalie finishing multiplier
  - Purpose: clip(1-(projectedSv-leagueSv)/.070,.80,1.20); unavailable save fractions yield 1.
  - Inputs/units: Projected and league save fractions [0,1].
  - Output scale: Dimensionless multiplier [.8,1.2].
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "deployment": "Unknown; source inspection only."}
- **Codex view (math-poissonMeanFromRate, calculation, codex_part_of_opus; Codex family 'Shared projection math'):** Per-60 rate to Poisson mean
  - Purpose: ratePer60/60*toiMinutes*contextMultiplier.
  - Inputs/units: Event rate per 60 minutes, TOI minutes, optional dimensionless context.
  - Output scale: Nonnegative expected count or null.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "deployment": "Unknown; source inspection only."}
- **Codex view (math-selectCountDistribution, calculation, codex_part_of_opus; Codex family 'Shared projection math'):** Evidence-based Poisson/NB selection
  - Purpose: Fano=sampleVariance/sampleMean; choose NB only above threshold 1.25 and finite positive r=sampleMean²/(sampleVariance-sampleMean).
  - Inputs/units: Projected count mean, recent sample count mean and squared-count variance.
  - Output scale: Poisson or negative-binomial family; mean, Fano and NB size.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "deployment": "Unknown; source inspection only."}
- **Codex view (math-shrinkage, calculation, codex_part_of_opus; Codex family 'Shared projection math'):** Effective-sample-size shrinkage
  - Purpose: nEff/(nEff+k)*recent+k/(nEff+k)*prior; missing branch behavior explicit.
  - Inputs/units: Recent and prior same units; effective n and prior strength nonnegative pseudo-sample counts.
  - Output scale: Shrunk estimate in input units or null.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "deployment": "Unknown; source inspection only."}
- **Codex view (math-slope, calculation, codex_part_of_opus; Codex family 'Shared projection math'):** Observation-order OLS slope
  - Purpose: sum((index-meanIndex)*(x-meanX))/sum((index-meanIndex)^2); missing observations retain original indices.
  - Inputs/units: Ordered numeric observations.
  - Output scale: Observation units per index step or null.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "deployment": "Unknown; source inspection only."}
- **Audit context:**
  - Intent (Opus): header comment web/lib/math/utils.ts:1 and JSDoc per function
  - Intended contract (Codex math-clip): {"source": "web/lib/math/utils.ts:1", "statement": "Clamp x to finite min/max bounds; nonfinite handling is explicit."}
  - Intended contract (Codex math-decayBlend): {"source": "web/lib/math/utils.ts:39", "statement": "w=exp(-max(daysAgo,0)/tau)*optionalWeight; mean=sum(w*x)/sum(w); effective n=(sum w)^2/sum(w\u00b2)."}
  - Intended contract (Codex math-ewsd): {"source": "web/lib/math/utils.ts:106", "statement": "sqrt(sum(w*(x-weightedMean)^2)/sum w), same decay as decayBlend."}
  - Intended contract (Codex math-goalieFinishMult): {"source": "web/lib/math/utils.ts:296", "statement": "clip(1-(projectedSv-leagueSv)/.070,.80,1.20); unavailable save fractions yield 1."}
  - Intended contract (Codex math-poissonMeanFromRate): {"source": "web/lib/math/utils.ts:198", "statement": "ratePer60/60*toiMinutes*contextMultiplier."}
  - Intended contract (Codex math-selectCountDistribution): {"source": "web/lib/math/utils.ts:223", "statement": "Fano=sampleVariance/sampleMean; choose NB only above threshold 1.25 and finite positive r=sampleMean\u00b2/(sampleVariance-sampleMean)."}
  - Intended contract (Codex math-shrinkage): {"source": "web/lib/math/utils.ts:37", "statement": "nEff/(nEff+k)*recent+k/(nEff+k)*prior; missing branch behavior explicit."}
  - Intended contract (Codex math-slope): {"source": "web/lib/math/utils.ts:137", "statement": "sum((index-meanIndex)*(x-meanX))/sum((index-meanIndex)^2); missing observations retain original indices."}
  - External references: Tango regression to the mean (k = sample at r=0.5); Poisson/negative-binomial count models
  - Fixtures/test data: none listed
  - Tests: `web/lib/math/utils.test.ts`; `{"status": "Discovered; not run", "references": ["web/lib/math/utils.test.ts"]}`
- **Leads (not audited):**
  - (opus) legacy/dead — no non-test imports of lib/math/utils found
  - (opus) goalieFinishMult constant 0.070 SV% span and 0.8-1.2 clamp are magic numbers
  - (codex:math-clip) ["Deployment and runtime behavior not verified; calculation listed without correctness assessment."]
  - (codex:math-decayBlend) ["Deployment and runtime behavior not verified; calculation listed without correctness assessment."]
  - (codex:math-ewsd) ["Deployment and runtime behavior not verified; calculation listed without correctness assessment."]
  - (codex:math-goalieFinishMult) ["Deployment and runtime behavior not verified; calculation listed without correctness assessment."]
  - (codex:math-poissonMeanFromRate) ["Deployment and runtime behavior not verified; calculation listed without correctness assessment."]
  - (codex:math-selectCountDistribution) ["Deployment and runtime behavior not verified; calculation listed without correctness assessment."]
  - (codex:math-shrinkage) ["Deployment and runtime behavior not verified; calculation listed without correctness assessment."]
  - (codex:math-slope) ["Deployment and runtime behavior not verified; calculation listed without correctness assessment."]

## M-HLP-002 Team power EWMA and z-score helpers (pointer)

- **Match:** Both; Opus HLP-002; Codex core-121, core-123
- **Purpose:** Generic EWMA over last 25 team games and GP-blended z-scores feeding team_power_ratings_daily (consumed by the team matrix).
- **Where:** `web/lib/power-ratings.ts:317 (calculateEwma)`; `web/lib/power-ratings.ts:503 (calculateZScores)`; `web/lib/power-ratings.ts:317 calculateEwma`; `web/lib/power-ratings.ts:503 calculateZScores`
- **Tags (heuristic):** denominators: per 60, per team game; generation: current
- **Opus view (HLP-002):**
  - Method: EWMA over LOOKBACK_GAMES=25 most recent games; z = (val-avg)/sd (sd 0 -> 0); per-60 values blended toward league avg with weight min(1, GP/10).
  - Inputs/units: per-60 rates; sources: team game tables (see lib/power-ratings.ts)
  - Output scale: per-60 blended; z-scores; writes: team_power_ratings_daily (via update-team-power-ratings)
  - Status: live — update-team-power-ratings
  - Consumers: web/pages/api/v1/db/update-team-power-ratings.ts; web/lib/teamRatingsTrend.ts; web/scripts/audit-team-power-repair.ts; teamMatrix (off_rating, def_rating, pace_rating, special_rating, xgf60, xga60 passthrough)
- **Codex view (core-121, calculation, location; Codex family 'team power'):** Recency-weighted team metrics
  - Formula: Weight=.5^(gamesAgo/10); weighted mean; PDO uses only observed values; pace fallback=(CF60+CA60)/2.
  - Purpose: Calculate recency-weighted team metrics.
  - Inputs/units: Up to 25 final-source team game logs; per 60 rates, observed PDO; half-life 10 games.
  - Output scale: EWMA xGF60, GF60, SF60, xGA60, GA60, SA60, pace60, HDCF60, HDCA60, PDO, PPxGF60, PKxGA60, penalty differential per 60.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f. Writer constant team-power-v2-final-source-observed-pdo. Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final status chec…
- **Codex view (core-123, calculation, location; Codex family 'team power'):** Early-season blending and team z-scores
  - Formula: w=clamp(GP/10, 0, 1); base rates=w*team+(1-w)*league; z=(rate-mean)/SD; derived metrics standardized; missing PDO z0 plus flag.
  - Purpose: Calculate early-season blending and team z-scores.
  - Inputs/units: Team EWMA, league moments, games played.
  - Output scale: Blended per 60 rates and dimensionless z for base/derived metrics.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f. Writer constant team-power-v2-final-source-observed-pdo. Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final status chec…
- **Audit context:**
  - Intent (Opus): see lib/power-ratings.ts (not fully read in this slice)
  - Intended contract (Codex core-121): Source types and implementation in web/lib/power-ratings.ts:317; separate acceptance not verified.
  - Intended contract (Codex core-123): Source types and implementation in web/lib/power-ratings.ts:503; separate acceptance not verified.
  - External references: EWMA team form; z-score standardization
  - Fixtures/test data: none listed
  - Tests: `Located only; not run for this inventory.`; `web/lib/power-ratings.test.ts`
- **Leads (not audited):**
  - (opus) owned by the team power-ratings family — listed here only as a generic EWMA/z helper and because teamMatrix ranks its outputs
  - (opus) GP/10 linear blend to league average is a fixed 10-game prior
  - (codex:core-121) ["Inventory only, not validation of the formula, source semantics or model quality."]
  - (codex:core-123) ["Inventory only, not validation of the formula, source semantics or model quality."]

## M-HLP-003 Mid-rank percentile helpers (calculateRankingResult / buildPercentileLookup)

- **Match:** Both; Opus HLP-005; Codex core-201, roster-generic-midrank
- **Purpose:** Generic player percentile rank with mid-rank tie handling, used by WiGO and social cards.
- **Where:** `web/utils/calculatePercentiles.ts:13 (calculateRankingResult)`; `web/utils/calculatePercentiles.ts:64 (buildPercentileLookup)`; `web/utils/calculatePercentiles.ts:99 (calculatePercentileRank)`; `web/utils/calculatePercentiles.ts:121 (calculatePlayerRank)`; `web/utils/calculatePercentiles.ts:13 calculateRankingResult`; `web/utils/calculatePercentiles.ts:64 buildPercentileLookup`; `web/utils/calculatePercentiles.ts:99 calculatePercentileRank`; `web/utils/calculatePercentiles.ts:121 calculatePlayerRank`
- **Tags (heuristic):** percent scale: fraction 0-1; generation: current
- **Opus view (HLP-005):**
  - Method: percentile = (worse + 0.5*equal)/N (target counted in equal), clamped 0-1; rank = betterCount + 1 (competition rank). Lookup variant does the same via binary search over a sorted copy.
  - Inputs/units: any metric; sources: —
  - Output scale: fraction 0-1; rank 1..N; writes: —
  - Status: live — WiGO percentiles, usePercentileRank, social share multiCatStars
  - Consumers: web/utils/calculateWigoRatings.ts; web/hooks/usePercentileRank.ts; web/components/WiGO/RateStatPercentiles.tsx; web/lib/socialShare/modules/multiCatStars.ts
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
  - Intent (Opus): JSDoc web/utils/calculatePercentiles.ts:59-63 and :89-97
  - Intended contract (Codex core-201): Source types and implementation in web/utils/calculatePercentiles.ts:13; separate acceptance not verified.
  - Intended contract (Codex roster-generic-midrank): Function comments require nulls prefiltered; helper makes no cohort completeness/source claim. Source: web/utils/calculatePercentiles.ts:13 calculateRankingResult.
  - External references: Mid-rank percentile rank (Hazen-style (i-0.5)/N family)
  - Fixtures/test data: none listed
  - Tests: `Located only; not run for this inventory.`; `web/utils/calculatePercentiles.test.ts`; `web/utils/calculateWigoRatings.test.ts`; `{"discovered_not_run": ["web/utils/calculatePercentiles.test.ts"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (opus) different percentile convention from rankings (strictly-worse/(N-1), dense rank) — same player can show different percentiles on WiGO vs Rankings
  - (opus) calculatePercentileRank and calculatePlayerRank have no non-test callers (dead wrappers)
  - (codex:core-201) ["Inventory only, not validation of the formula, source semantics or model quality."]
  - (codex:roster-generic-midrank) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-HLP-004 WiGO player ratings (regressed percentile composite by strength)

- **Match:** Both; Opus HLP-006; Codex core-202, core-203, core-338
- **Purpose:** Offense/defense/overall ratings per strength (AS/ES/PP/PK) from weighted, GP-regressed stat percentiles.
- **Where:** `web/utils/calculateWigoRatings.ts:22 (applyRegression)`; `web/utils/calculateWigoRatings.ts:38 (buildComparisonRows)`; `web/utils/calculateWigoRatings.ts:65 (calculatePlayerRatings)`; `web/components/WiGO/ratingWeights.ts:13 (RATING_WEIGHTS)`; `web/components/WiGO/ratingWeights.ts:96 (REGRESSION_CONFIG)`; `web/utils/calculateWigoRatings.ts:22 applyRegression`; `web/utils/calculateWigoRatings.ts:71 calculatePlayerRatings`; `web/components/WiGO/ratingWeights.ts:11 RATING_WEIGHTS`
- **Tags (heuristic):** percent scale: 0-100; denominators: per 60, all strengths, shots on goal; generation: current
- **Opus view (HLP-006):**
  - Method: Per stat: mid-rank percentile among cohort with gp>=cohortMinGp (needs >= minCohortPeers peers). If player GP < 10 at that strength: regressed = (GP*pct + (10-GP)*mean pct of >=10-GP players)/10, clamp 0-100. Offense/defense = weighted mean of available stat percentiles (AS/ES offense: P/60 25, ixG/60 20, SOG/60 15, iSCF/60 10, iHDCF/60 10, xGF% 10, CF% 5, PenD/60 5; defense: xGA/60 30, SCA/60 20, HDCA/60 15, blocks 10, TK 10, minors 5, GV 10; PP and PK sets differ). overall.as/es = mean(off, def); ST = PP-offense and PK-defense weighted by PP/PK TOI share; final = mean(as, es, st).
  - Inputs/units: per-60 rates, percentages, GP, TOI seconds; sources: nst_percentile_as_offense/defense, nst_percentile_es_*, nst_percentile_pp_*, nst_percentile_pk_*
  - Output scale: 0-100 weighted percentile scores; writes: —
  - Status: live — WiGO PlayerRatingsDisplay
  - Consumers: web/components/WiGO/PlayerRatingsDisplay.tsx
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
  - Intent (Opus): comments web/utils/calculateWigoRatings.ts:23 (formula M' = (GP*M + (P-GP)*mM)/P) and WIGO_RATING_MIN_COHORT_PEERS comment
  - Intended contract (Codex core-202): Source types and implementation in web/utils/calculateWigoRatings.ts:22; separate acceptance not verified.
  - Intended contract (Codex core-203): Weights are in web/components/WiGO/ratingWeights.ts; missing metrics omitted and available weights renormalized.
  - Intended contract (Codex core-338): RATING_WEIGHTS declares each stat, direction, weight; regression default enabled with10-game threshold.
  - External references: Tango regression to the mean (applied to rates, not percentiles)
  - Fixtures/test data: none listed
  - Tests: `Located only; not run for this inventory.`; `No directly named test located; tests not run.`; `web/utils/calculateWigoRatings.test.ts`
- **Leads (not audited):**
  - (opus) regression applied to percentiles rather than underlying rates; hard step at 10 GP (no regression at >=10 GP)
  - (opus) final averages AS and ES (ES is a subset of AS) — double-counts even strength
  - (opus) missing stat percentiles silently drop and renormalize weights
  - (opus) likely also inventoried by the WiGO family agent
  - (codex:core-202) ["Inventory only, not validation of the formula, source semantics or model quality."]
  - (codex:core-203) ["Inventory only, not validation of the formula, source semantics or model quality."]
  - (codex:core-338) ["Inventory only; no correctness verdict."]

## M-HLP-005 Projections page global projected/actual ranks

- **Match:** Both; Opus HLP-007; Codex core-204
- **Purpose:** Rank all skaters+goalies by projected and actual fantasy points.
- **Where:** `web/utils/projectionsRanking.ts:8 (assignGlobalRanks)`; `web/utils/projectionsRanking.ts:30 (injectRanks)`; `web/utils/projectionsRanking.ts:8 assignGlobalRanks`
- **Tags (heuristic):** generation: current
- **Opus view (HLP-007):**
  - Method: Sort desc (null -> 0) and assign ordinal rank i+1 for projected and actual separately; skaters and goalies pooled.
  - Inputs/units: fantasy points; sources: —
  - Output scale: rank 1..N; writes: —
  - Status: live — /projections page
  - Consumers: web/pages/projections/index.tsx
- **Codex view (core-204, calculation, location; Codex family 'projection display'):** Global projected/actual fantasy ranks
  - Formula: Sort descending projected then actual, missing 0; assign index+1 independently.
  - Purpose: Calculate global projected/actual fantasy ranks.
  - Inputs/units: Skater/goalie projected and actual fantasy points.
  - Output scale: Ordinal rank 1..N for each.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f.  Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final status check.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex core-204): Source types and implementation in web/utils/projectionsRanking.ts:8; separate acceptance not verified.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `No directly named test located; tests not run.`
- **Leads (not audited):**
  - (opus) null projections treated as 0 and ranked; ties get arbitrary sequential ranks
  - (opus) mutates input objects and sorts in place
  - (codex:core-204) ["Inventory only, not validation of the formula, source semantics or model quality."]

## M-HLP-006 Draft-round fantasy point tier thresholds

- **Match:** Both; Opus HLP-008; Codex roster-round-performance-tiers
- **Purpose:** Build performance tiers (Tier 1..Replacement Level) from per-round average actual FP/game.
- **Where:** `web/utils/tierUtils.ts:28 (calculateTierThresholds)`; `web/utils/tierUtils.ts:28 calculateTierThresholds`; `web/utils/tierUtils.ts:12 getRoundAvg`
- **Tags (heuristic):** denominators: per game; generation: legacy, current
- **Opus view (HLP-008):**
  - Method: Tier 1 >= avg R1; Tier 2 [R2,R1); Tier 3 [R3,R2); Strong [R6,R3); Mid [R9,R6); Average [R13,R9); Replacement [0, R13 or lowest bound). Tiers only added if strictly decreasing.
  - Inputs/units: fantasy points per game; sources: —
  - Output scale: FP/game bands; writes: —
  - Status: legacy/dead — no non-test callers found via rg
  - Consumers: no non-test callers found by rg (only utils/tierUtils.ts) — check RoundSummaryContext consumers
- **Codex view (roster-round-performance-tiers, calculation, location; Codex family 'Shared ranking and display'):** Round-average performance-tier boundaries
  - Purpose: Uses actual fantasy-points/game means for draft rounds1,2,3,6,9,13 as descending Tier1/Tier2/Tier3/Strong/Mid/Average boundaries where ordered. Replacement Level=[0,round13 mean), or lowest valid boundary. No averages gives All Performance Levels[0,infinity).
  - Inputs/units: RoundSummaryValue round numbers and actualPerGame fantasy-points/game values.
  - Output scale: Named min-inclusive/max-exclusive FP/game bands with display colors.
  - Version/status: No explicit formula version. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Audit context:**
  - Intent (Opus): inline comments web/utils/tierUtils.ts:40-122
  - Intended contract (Codex roster-round-performance-tiers): Source comments define interval inclusivity and fallback; derived visual reference tiers, not positional projection clustering. Source: web/utils/tierUtils.ts:28 calculateTierThresholds.
  - External references: Draft-round replacement level (VORP-style)
  - Fixtures/test data: none listed
  - Tests: `{"discovered_not_run": [], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (opus) possibly dead — no imports of calculateTierThresholds found
  - (opus) replacement level floor fixed at 0 FP
  - (codex:roster-round-performance-tiers) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-HLP-007 Social share shared definitions (per-60, pooled SV%/GAA, BSH, competition ranks, recent-vs-season windows)

- **Match:** Opus only; Opus HLP-003; Codex —
- **Purpose:** Single producer of rate, ratio, window and rank definitions imported by every social-share post module.
- **Where:** `web/lib/socialShare/modules/shared/definitions.ts:42 (per60)`; `web/lib/socialShare/modules/shared/definitions.ts:40 (pooledSavePct)`; `web/lib/socialShare/modules/shared/definitions.ts:41 (pooledGaa)`; `web/lib/socialShare/modules/shared/definitions.ts:35 (bsh)`; `web/lib/socialShare/modules/shared/definitions.ts:45 (competitionRanks)`; `web/lib/socialShare/modules/shared/definitions.ts:23-30 (lastN, previousN, versusSeason)`; `web/lib/socialShare/modules/shared/definitions.ts:33 (strictlyAbove)`; `web/lib/socialShare/modules/shared/definitions.ts:9 (ownershipOf)`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: per 60; generation: current
- **Opus view (HLP-003):**
  - Method: per60 = count*3600/toiSeconds (null if TOI <= 0 or count missing/negative). pooledSavePct = saves/SA (null if SA<=0 or saves>SA). pooledGaa = GA*3600/TOI s. BSH = blocks+shots+hits, null if any missing. competitionRanks: sort by value (high or low first), ties share rank (1,2,2,4), nulls unranked, id only orders ties. lastN = last n rows (short flag when fewer), previousN = n rows before the last `skip`, versusSeason = recent L-n plus season (overlap disclosed) and seasonExcludingRecent. strictlyAbove: value > x, null if missing. Ownership known only if 0..100.
  - Inputs/units: TOI seconds; counts; sources: —
  - Output scale: per-60 rate; fraction 0-1 SV%; goals per 60; integer ranks; writes: —
  - Status: live — imported by every social-share module
  - Consumers: web/lib/socialShare/modules/*.ts (bshBoard, nightlyFloor, roleWatch, whatChanged, lastNightsStandouts, goalieGsax, creaseShift, ratioImpact, categoryBlueprint, multiCatStars, playerVsPlayer, teamGames, goaliePeriod, offNightEdge); web/lib/socialShare/modules/shared/goalieInventory.sources.ts
- **Audit context:**
  - Intent (Opus): web/lib/socialShare/modules/shared/definitions.ts:4 ('Shared definitions (CONTRACT.md §2). The one producer of each; posts import these and never restate them')
  - External references: NST per-60 convention; pooled (ratio of sums) SV% and GAA = GA*60/TOI minutes
  - Fixtures/test data: `web/lib/socialShare/modules/shared/definitions.test.ts`
  - Tests: `web/lib/socialShare/modules/shared/definitions.test.ts`
- **Leads (not audited):**
  - (opus) duplicate implementation of Player-card competition rank (CARD-019 rankMetric) and per-60 helpers used elsewhere (CARD-016, RNK-037); kept separate by design for social share
  - (opus) lastN/versusSeason overlap means 'recent vs season' deltas are attenuated unless seasonExcludingRecent is used

## M-HLP-008 Percent-unit conversion & exposure-correct share aggregation (NST/WGO team rows)

- **Match:** Opus only; Opus HLP-004; Codex —
- **Purpose:** Declared-unit percentage conversion and ratio-of-sums team aggregates (CF%, xGF%, HDCF%, SCF%, Sh%, Sv%, PDO, PP%, PK%, FO%).
- **Where:** `web/lib/stats/percentUnits.ts:12 (toFraction)`; `web/lib/stats/percentUnits.ts:30 (ratio)`; `web/lib/stats/percentUnits.ts:40 (sumField)`; `web/lib/stats/percentUnits.ts:54 (shareOfSums)`; `web/lib/stats/percentUnits.ts:107 (aggregateNstTeamCounts)`; `web/lib/stats/percentUnits.ts:165 (aggregateWgoTeamGames)`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: per game; generation: current
- **Opus view (HLP-004):**
  - Method: Shares = for/(for+against) on summed counts (never mean of row %). Sh% = GF/SF; Sv% = 1 - GA/SA; PDO = Sh% + Sv% (1.000 scale); xGF/G, xGA/G = sums/games. WGO: shots/G from per-game x GP; PP% = PPGF/PP opps; PK% = 1 - PPGA/times shorthanded; FO% = W/(W+L). Any missing value in sample -> null.
  - Inputs/units: counts; TOI seconds; declared percent units; sources: nst team tables (per-date rows), wgo_team_stats
  - Output scale: fractions 0-1; PDO ~1.000; per-game; writes: —
  - Status: live — TeamDashboard / GameStateAnalysis
  - Consumers: components/GameStateAnalysis/GameStateAnalysis.tsx; components/TeamDashboard/TeamDashboard.tsx; components/TeamDashboard/AdvancedL10Metrics.tsx
- **Audit context:**
  - Intent (Opus): header and JSDoc web/lib/stats/percentUnits.ts:1-4, 101-106, 144-147
  - External references: NST team share definitions; NHL PP%/PK% (PK% here excludes SH-goal adjustment)
  - Fixtures/test data: none listed
  - Tests: `web/lib/stats/percentUnits.test.ts`; `web/lib/stats/teamCountConsumers.test.tsx`
- **Leads (not audited):**
  - (opus) strict 'any missing -> null' makes a single bad row null the whole window
  - (opus) comment confirms NST team rows are one regular-season date per row (supports teamMatrix NST fallback summing)

