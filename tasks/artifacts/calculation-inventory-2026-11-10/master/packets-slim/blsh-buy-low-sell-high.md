# Audit packet: BLSH (Buy Low / Sell High)

Master entries M-BLSH-001 to M-BLSH-016 (16 of 16 in this family).

Slim copy (Chef, 2026-11-11): boilerplate status lines, generic leads, tags and duplicate locations removed. Full packet: `../packets/blsh-buy-low-sell-high.md`. Leads are hypotheses; line numbers date from 2026-11-10, so re-locate by symbol.

| ID | Name | Match | Conflicts | Leads |
|---|---|---|---:|---:|
| M-BLSH-001 | BLSH forecast development comparison (arms P0-P3, gamma transfer, clu… | Both | 0 | 8 |
| M-BLSH-002 | BLSH / Sko watchlists (rebound / cooling by gap sign) and market-refe… | Both | 0 | 4 |
| M-BLSH-003 | BLSH opportunity split (per-game vs PP/non-PP-rate-adjusted compariso… | Both | 0 | 5 |
| M-BLSH-004 | BLSH stage 1: per-game production tracks (FHFH FP, G+A, WiGO Game Sco… | Both | 0 | 4 |
| M-BLSH-005 | BLSH stage 2b: position cohort production prior (donor moments, signa… | Both | 0 | 4 |
| M-BLSH-006 | BLSH stage 2a: recency-weighted personal baseline (arm C) | Both | 0 | 3 |
| M-BLSH-007 | BLSH stage 2c: shrunk personal reference rate | Both | 0 | 2 |
| M-BLSH-008 | BLSH stage 3: production gap (normalised expected minus observed, ind… | Both | 0 | 3 |
| M-BLSH-009 | BLSH stage 4b: conditional process delta (imputation of missing compo… | Both | 0 | 2 |
| M-BLSH-010 | BLSH stage 4c: support-conditioned gap score, status and BL/SH list a… | Both | 0 | 3 |
| M-BLSH-011 | BLSH stage 5: list gates and ranking (BL/SH top 25, ≥20 personal game… | Both | 0 | 4 |
| M-BLSH-012 | BLSH explanation layer (finishing, on-ice finishing, assist share, sh… | Both | 0 | 2 |
| M-BLSH-013 | BLSH stage 4a: process-support sensitivity model (within-player beta,… | Both | 0 | 5 |
| M-BLSH-014 | BLSH current-input qualification gates | Opus only | 0 | 1 |
| M-BLSH-015 | BLSH research state label and window-age text | Opus only | 0 | 0 |
| M-BLSH-016 | Covariance validation/eigendecomposition | Codex only | 0 | 1 |

## M-BLSH-001 BLSH forecast development comparison (arms P0-P3, gamma transfer, cluster bootstrap)

- **Match:** Both; Opus BLSH-002; Codex core-306, core-307, core-308, core-309, core-310
- **Purpose:** Exploratory test of whether BLSH references predict next-5-game production.
- **Where:** `web/lib/buyLowSellHigh/forecastEvaluation.ts:25 (DEFAULT_CONFIG)`; `web/lib/buyLowSellHigh/forecastEvaluation.ts:66 (priorSeasonMean)`; `web/lib/buyLowSellHigh/forecastEvaluation.ts:108 (fitGamma)`; `web/lib/buyLowSellHigh/forecastEvaluation.ts:125 (shifted)`; `web/lib/buyLowSellHigh/forecastEvaluation.ts:137 (buildOrigins)` … (full text in the original packet)
- **Opus view (BLSH-002):**
  - Method: Origins: 5-game window + next 5 games in same season, gaps ≤30 days, no team change. P0 = mean of previous season's last 50 games; P1 = shrunk reference rate × window TOI/game; P1_H = rate × history TOI/game; P2_transfer = (rate + delta·beta/3600)·tau; P2 = rate shifted by gamma (no-intercept WLS of 3600·(next5 rate − reference rate) on ΔX, equal weight per player, ×0.5); P3 = window mean. FP/G+A floored 0. Composite weights a_t=(1/3)/sd_t/sqrt(w'Rw) from training targets. Paired MAE/RMSE differences with player cluster bootstrap (2000 draws, mulberry32 seed 20261029), 95% percentile CI. Decision: FP P2<P0 CI below 0, P2<P1 point, G+A and GS not worse.
  - Inputs/units: per-appearance totals; seconds; sources: development history export
  - Output scale: MAE/RMSE differences; writes: —
  - Status: draft — offline research harness (forecastDevRun.test.ts); result in tasks/artifacts/blsh-independent-review-2026-10-28/forecast-dev-v2
  - Consumers: web/scripts/blsh/forecastDevRun.test.ts (offline run)
- **Codex view (core-306, calculation, codex_part_of_opus; Codex family 'BLSH forecast research'):** Prior-season50-game benchmark
  - Formula: Mean over exactly 50 complete game slots.
  - Purpose: Calculate prior-season 50-game benchmark.
  - Inputs/units: Immediately preceding season final 50 complete appearances.
  - Output scale: Three-track per-game mean and TOI/game.
- **Codex view (core-307, calculation, codex_part_of_opus; Codex family 'BLSH forecast research'):** Forward process sensitivity fit
  - Formula: No-intercept weighted least squares of3600*(futureRate-referenceRate) on deltaX; equal total player weight; apply GAMMA_SHRINK.
  - Purpose: Calculate forward process sensitivity fit.
  - Inputs/units: Training origins, future 5-game target rates, reference rates, process deltas and target TOI.
  - Output scale: 3x3 gamma coefficients and unshrunk sensitivity.
- **Codex view (core-308, calculation, codex_part_of_opus; Codex family 'BLSH forecast research'):** Training-only normalized composite weights
  - Formula: Equal 1/3 weights standardized by target SD and correlation-normalized aggregate variance.
  - Purpose: Calculate training-only normalized composite weights.
  - Inputs/units: Three target tracks across training origins.
  - Output scale: Three normalization weights.
- **Codex view (core-309, calculation, codex_part_of_opus; Codex family 'BLSH forecast research'):** Forecast-arm MAE/RMSE and bootstrap contrasts
  - Formula: A-B errors; bootstrap clusters with deterministic seeded PRNG; compare paired origins.
  - Purpose: Calculate forecast-arm mae/rmse and bootstrap contrasts.
  - Inputs/units: Arm predictions/actuals by origin, chosen track, cluster IDs.
  - Output scale: MAE/RMSE differences and 95% cluster-bootstrap intervals.
- **Codex view (core-310, calculation, codex_part_of_opus; Codex family 'BLSH forecast research'):** Exploratory forward-promise rule
  - Formula: FP P2-P0 MAE interval below 0; P2-P1 FP point difference<0; G+A and GS no worse than P0.
  - Purpose: Calculate exploratory forward-promise rule.
  - Inputs/units: Primary P2-vs-P0/P1 contrasts.
  - Output scale: Boolean forwardPromise and condition diagnostics.
- **Audit context:**
  - Intent (Opus): forecastEvaluation.ts:1-6 header; tasks/artifacts/blsh-independent-review-2026-10-28/FORECAST-PROPOSAL-v2.md
  - Intended contract (Codex core-306): Source types and implementation in web/lib/buyLowSellHigh/forecastEvaluation.ts:66; separate acceptance not verified.
  - Intended contract (Codex core-307): Source types and implementation in web/lib/buyLowSellHigh/forecastEvaluation.ts:108; separate acceptance not verified.
  - Intended contract (Codex core-308): Source types and implementation in web/lib/buyLowSellHigh/forecastEvaluation.ts:225; separate acceptance not verified.
  - Intended contract (Codex core-309): Source types and implementation in web/lib/buyLowSellHigh/forecastEvaluation.ts:248; separate acceptance not verified.
  - Intended contract (Codex core-310): Source types and implementation in web/lib/buyLowSellHigh/forecastEvaluation.ts:279; separate acceptance not verified.
  - External references: Forecast verification; paired cluster bootstrap
  - Fixtures/test data: `tasks/artifacts/blsh-independent-review-2026-10-28/forecast-dev-v2/ORIGINS.jsonl`; `tasks/artifacts/blsh-independent-review-2026-10-28/forecast-dev-v2/RESULTS.json`; `tasks/artifacts/blsh-independent-review-2026-10-28/forecast-dev-v2/FORECAST-DEV-V2-REPORT.md`
  - Tests: `web/lib/buyLowSellHigh/forecastEvaluation.test.ts`; `web/scripts/blsh/forecastDevRun.test.ts`
- **Leads (not audited):**
  - (opus) training 2022-23 / evaluation 2023-24 fixed in DEFAULT_CONFIG
  - (opus) overlapping sliding origins within a player (clustered by player in bootstrap)
  - (opus) percentile index floor(0.025*(B-1)) — approximate quantile
  - (codex:core-306) ["Inventory only, not validation of the formula, source semantics or model quality."]
  - (codex:core-307) ["Inventory only, not validation of the formula, source semantics or model quality."]
  - (codex:core-308) ["Inventory only, not validation of the formula, source semantics or model quality."]
  - (codex:core-309) ["Inventory only, not validation of the formula, source semantics or model quality."]
  - (codex:core-310) ["Inventory only, not validation of the formula, source semantics or model quality."]

## M-BLSH-002 BLSH / Sko watchlists (rebound / cooling by gap sign) and market-reference gap

- **Match:** Both; Opus BLSH-003; Codex core-015, core-025, core-026
- **Purpose:** Group interpretation records by sign of forecast-minus-recent gap and compare an expectation with a manager-entered market reference.
- **Where:** `web/lib/buyLowSellHigh/market.ts:21 (rowFor)`; `web/lib/buyLowSellHigh/market.ts:48 (buildWatchlists)`; `web/lib/buyLowSellHigh/market.ts:91 (compareMarketReference)`; `web/lib/skoElement/interpret.ts:367 (weightedPointsGap, other slice)`; `web/lib/skoElement/interpret.ts:367 weightedPointsGap`; `web/lib/buyLowSellHigh/marke … (full text in the original packet)
- **Opus view (BLSH-003):**
  - Method: Rebound = gap>0 sorted desc, cooling = gap<0 sorted asc, level, unranked (goalies pending). LEAGUE_POINTS uses weightedPointsGap. Market gap = expected − reference only if unit, horizon, scoring basis match and capture age ≤ maxAgeHours.
  - Inputs/units: per-team-game rates; fantasy points; sources: Sko Element interpretation records (FORGE forecasts)
  - Output scale: gap in points; writes: —
  - Status: unknown — exported; rg found tests only for buildWatchlists
  - Consumers: pages/buy-low-sell-high (local watchlist); BlshTradeComparison
- **Codex view (core-015, calculation, location; Codex family 'Sko Element'):** League-weighted points gap
  - Formula: Sum categoryRate*weight separately for observed/expected then subtract.
  - Purpose: Read-only interpretation of observed evidence and FORGE forecast; no learned SKO weights.
  - Inputs/units: Compatible category per-team-game rates and explicit league weights.
  - Output scale: Fantasy points/team game; expected-observed.
- **Codex view (core-025, calculation, location; Codex family 'BLSH interpretation'):** Rebound/cooling watchlists
  - Formula: Positive gaps descending; negative ascending; ties name/id; unavailable separate.
  - Purpose: Sort descriptive gaps into directional lists.
  - Inputs/units: Sko Element records, target, league weights.
  - Output scale: Ordered rebound, cooling, level, unranked lists.
- **Codex view (core-026, calculation, location; Codex family 'BLSH interpretation'):** Comparable market-reference gap
  - Formula: expected-reference only when all comparability checks pass.
  - Purpose: Compare forecast with explicit manager/external reference.
  - Inputs/units: Expected total and reference matching unit, horizon, scoring basis, source, freshness.
  - Output scale: Expected minus reference in fantasy points/count over horizon.
- **Audit context:**
  - Intent (Opus): market.ts:1-5 and :44-47 comments
  - Intended contract (Codex core-015): Source limitations at interpret.ts:314: descriptive, not probability/trade instruction; expected values unchanged; no predictive-spread model. VuDu gap awaits accepted goalie adapter.
  - Intended contract (Codex core-025): Inclusion by sign only; alert magnitude, duration, hysteresis undecided.
  - Intended contract (Codex core-026): Ownership/popularity not accepted as market value; source comments.
  - Tests: `web/lib/buyLowSellHigh/market.test.ts`; `web/lib/skoElement/interpret.test.ts`
- **Leads (not audited):**
  - (opus) inclusion by sign only, no magnitude threshold or hysteresis (comment says undecided)

## M-BLSH-003 BLSH opportunity split (per-game vs PP/non-PP-rate-adjusted comparison)

- **Match:** Both; Opus BLSH-004; Codex core-041, core-042, core-043
- **Purpose:** Tell whether a production gap is explained by ice-time / power-play role change.
- **Where:** `web/lib/buyLowSellHigh/opportunity.ts:32 (OPPORTUNITY_DEFAULTS)`; `web/lib/buyLowSellHigh/opportunity.ts:88 (summarizeOpportunityHistory)`; `web/lib/buyLowSellHigh/opportunity.ts:148 (pooledCohort)`; `web/lib/buyLowSellHigh/opportunity.ts:157 (compareTo)`; `web/lib/buyLowSellHigh/opportunity.ts:169 (assess)`; `web/lib/buyLow … (full text in the original packet)
- **Opus view (BLSH-004):**
  - Method: Weights normalised to Kish effective games n_eff; perGame mean and weighted SD. Split: PP point value = 3+goalShare for FP, 1 for G+A (GS not split); nonPpRate=(perGame*n_eff - value*PPP)/nonPP seconds; ppRate shrunk to cohort with pseudo-exposure k=3600 s ((value*PPP + k*cohortRate)/(pp+k)); personal-only if pp≥1800 s. (a) per-game: expected=n*perGame, scale=SD*sqrt(n); (b) adjusted: expected=r0*nonPP+r1*PP, scale=sqrt(n*residualSD^2 + PP^2*value*r1/ppExposure). z=gap/scale, \|z\|<0.5 balanced, z>0 sell_high, z<0 buy_low. Assessment matrix (agree/explains/withheld). Opportunity effect = (b)-(a) or ratePerSecond*ΔTOI. minGames 20.
  - Inputs/units: seconds; counts; sources: —
  - Output scale: z; direction enum; writes: —
  - Status: live (frozen) — runs offline via web/scripts/blsh/currentDryRun.test.ts; output frozen JSON web/lib/buyLowSellHigh/research-snapshots/2026-10-28.arm-a-canonical-repaired.v2.json served by pages/buy-low-sell-high/preview.tsx (attached as provisional context)
  - Consumers: display profile opportunity section (does not change lists)
- **Codex view (core-041, calculation, location; Codex family 'BLSH research'):** Opportunity history and cohort PP rates
  - Formula: EffectiveN=(sum w)^2/sum w²; PP FP point value 3 + goalShare; shrink PP rate to cohort with 3600 pseudo-seconds by default.
  - Purpose: Separate role/opportunity changes from retrospective conversion evidence.
  - Inputs/units: Pre-window FP, G+A, GameScore; total/PP seconds; G, A, PPP; nonnegative recency weights.
  - Output scale: Weighted per-game means/SD, total/PPTOI, nonPP/PP rates.
- **Codex view (core-042, calculation, location; Codex family 'BLSH research'):** Pooled PP cohort
  - Formula: Pooled PPP/PP seconds; FP PP value=(3+G/(G+A))*PPP/PP seconds.
  - Purpose: Separate role/opportunity changes from retrospective conversion evidence.
  - Inputs/units: Donor PP points, PP seconds, G, A.
  - Output scale: PP FP/sec and G+A/sec; goalShare.
- **Codex view (core-043, calculation, location; Codex family 'BLSH research'):** Per-game versus opportunity-adjusted comparison
  - Formula: A expected=n*personalPerGame; scale=SDsqrt(n).B expected=nonPPrate*nonPP seconds+PPrate*PP seconds; scale includes residual variance and PP-rate uncertainty; balanced \|z\|<.5.
  - Purpose: Separate role/opportunity changes from retrospective conversion evidence.
  - Inputs/units: History and current total/PP seconds, appearances, 3 observed tracks.
  - Output scale: Observed-expected gap, z, direction, TOI/PP impact, qualified assessment.
- **Audit context:**
  - Intent (Opus): opportunity.ts:33 PERSISTENCE_NOTE; tasks/artifacts/blsh-opportunity-2026-11-04/REPORT.md
  - Intended contract (Codex core-041): No role persistence inferred; GameScore has no strength split; opportunity is context and does not change list membership.
  - Intended contract (Codex core-042): No role persistence inferred; GameScore has no strength split; opportunity is context and does not change list membership.
  - Intended contract (Codex core-043): No role persistence inferred; GameScore has no strength split; opportunity is context and does not change list membership.
  - External references: Usage-adjusted production (per-60 × TOI); credibility shrinkage of PP rates
  - Fixtures/test data: `web/lib/buyLowSellHigh/research-snapshots/2026-10-28.arm-a-canonical-repaired.v2.json`; `web/lib/buyLowSellHigh/research-snapshots/2026-10-26.arm-a-official-overlay.v2.json`; `web/lib/buyLowSellHigh/research-snapshots/2024-04-18.v1.json`; `web/lib/buyLowSellHigh/__fixtures__/display-profiles.jsonl`; `tasks/artifacts/blsh-independent-review-2026-10-28/dry-run-v4/PROFILES-A_development_reference__official_receipt_overlay.jsonl`; `tasks/artifacts/blsh-independent-review-2026-10-28/dry-run-v4/SUMMARY.json`
  - Tests: `web/lib/buyLowSellHigh/opportunity.test.ts`
- **Leads (not audited):**
  - (opus) band 0.5 z and k=3600 PP pseudo-seconds hand-set; provisional, not used for list membership
  - (opus) FP PP value 3+goalShare assumes every PPP is a goal or primary-type point worth 3G/2A+1PPP — ignores SOG/HIT/BLK component of FP on PP

## M-BLSH-004 BLSH stage 1: per-game production tracks (FHFH FP, G+A, WiGO Game Score)

- **Match:** Both; Opus BLSH-005; Codex core-028
- **Purpose:** Turn one game's box score into the three production outcomes BLSH compares.
- **Where:** `web/lib/buyLowSellHigh/productionReference.ts:10 (FHFH_WEIGHTS)`; `web/lib/buyLowSellHigh/productionReference.ts:44 (outcomes)`; `web/lib/buyLowSellHigh/currentWindows.ts:84 (devSlot)`; `web/lib/buyLowSellHigh/currentWindows.ts:103 (currentSlot)`; `web/lib/buyLowSellHigh/productionReference.ts:44 outcomes`
- **Opus view (BLSH-005):**
  - Method: FP = 3G + 2A + 1PPP + 0.2SOG + 0.2HIT + 0.25BLK. G+A = goals+assists (null if != points). Game Score = 0.75G + 0.7A1 + 0.55A2 + 0.075SOG + 0.05BLK + 0.15(PD-PT) + 0.01(FOW-FOL) + 0.05(SATF-SATA) + 0.15(GF-GA) with GF/GA = ES+PP+SH on-ice goals. Missing input -> null track (never 0); negative counts -> null.
  - Inputs/units: per-game counts; sources: WGO game rows (development export 2022-24 / current wgo_skater_stats capture)
  - Output scale: fantasy points / points / game score per game; writes: —
  - Status: live (frozen) — runs offline via web/scripts/blsh/currentDryRun.test.ts; output frozen JSON web/lib/buyLowSellHigh/research-snapshots/2026-10-28.arm-a-canonical-repaired.v2.json served by pages/buy-low-sell-high/preview.tsx
  - Consumers: BLSH stage 2-5; opportunity; forecastEvaluation
- **Codex view (core-028, calculation, location; Codex family 'BLSH research'):** Three production tracks
  - Formula: FP=3G+2A+PPP+.2SOG+.2HIT+.25BLK; points=G+A; GS weighted hockey counts. WiGO GS uses SAT for/against (not the USAT fields in quarantined calculateGameScore).
  - Purpose: Compute per-game inputs to research production reference.
  - Inputs/units: Game counts for fantasy scoring and WiGO GameScore fields.
  - Output scale: FHFH Standard fantasy points; G+A; WiGO GameScore.
- **Audit context:**
  - Intent (Opus): productionReference.ts:1-6 header; FHFH Standard comment productionReference.ts:9
  - Intended contract (Codex core-028): Missing/invalid input leaves that track null; source top-level contract.
  - External references: Dom Luszczyszyn Game Score (2016) — standard uses 5v5 on-ice GF/GA; Yahoo/ESPN points scoring
  - Fixtures/test data: `web/lib/buyLowSellHigh/research-snapshots/2026-10-28.arm-a-canonical-repaired.v2.json`; `web/lib/buyLowSellHigh/research-snapshots/2026-10-26.arm-a-official-overlay.v2.json`; `web/lib/buyLowSellHigh/research-snapshots/2024-04-18.v1.json`; `web/lib/buyLowSellHigh/__fixtures__/display-profiles.jsonl`; `tasks/artifacts/blsh-independent-review-2026-10-28/dry-run-v4/PROFILES-A_development_reference__official_receipt_overlay.jsonl`; `tasks/artifacts/blsh-independent-review-2026-10-28/dry-run-v4/SUMMARY.json`
  - Tests: `web/lib/buyLowSellHigh/currentWindows.test.ts`; `web/lib/buyLowSellHigh/productionReference.test.ts`
- **Leads (not audited):**
  - (opus) Game Score GF/GA term uses all-situations (ES+PP+SH) on-ice goals; Luszczyszyn's definition uses even-strength/5v5 GF-GA
  - (opus) track name 'raw_points' in PRODUCTION_TRACKS vs 'goals_plus_assists' elsewhere (same quantity, two labels)
  - (opus) FHFH weights hard-coded (duplicated in trade.ts FHFH_STANDARD_SCORING via import, consistent)

## M-BLSH-005 BLSH stage 2b: position cohort production prior (donor moments, signal/noise covariance)

- **Match:** Both; Opus BLSH-006; Codex core-029, core-031
- **Purpose:** Estimate between-player signal covariance and per-second noise covariance of the 3 tracks from 50-game donor histories.
- **Where:** `web/lib/buyLowSellHigh/productionReference.ts:122 (summarizeHistory)`; `web/lib/buyLowSellHigh/productionReference.ts:230 (fitProductionPrior)`; `web/lib/buyLowSellHigh/productionReference.ts:100 (asPsd)`; `web/lib/buyLowSellHigh/productionReference.ts:107 (metricInverse)`; `web/lib/buyLowSellHigh/currentWindows.ts:192 (dono … (full text in the original packet)
- **Opus view (BLSH-006):**
  - Method: Donors: same position, exactly 50 prior games, single position, excluding target. Per donor rate=Σy/Σt; residual cov from ten 5-game blocks Σ e_i e_j / t_b / 9. mu=mean donor rate; observedCov (n-1); omega=mean residual cov; noise=mean(omega/seconds); base=observedCov+noise; signal = PSD projection (eigen-clip) of (observedCov-noise) in standardised units; metric = pseudo-inverse of base (correlation eigen, tol eps). Needs ≥2 donors.
  - Inputs/units: per-second rates; sources: development history export
  - Output scale: covariance matrices; writes: —
  - Status: live (frozen) — runs offline via web/scripts/blsh/currentDryRun.test.ts; output frozen JSON web/lib/buyLowSellHigh/research-snapshots/2026-10-28.arm-a-canonical-repaired.v2.json served by pages/buy-low-sell-high/preview.tsx
  - Consumers: BLSH stage 2c
- **Codex view (core-029, calculation, location; Codex family 'BLSH research'):** Personal history rate and covariance
  - Formula: Summed outcomes/summed seconds; within-history residual covariance scaled by exposure.
  - Purpose: Build descriptive production-versus-personal-reference evidence.
  - Inputs/units: Ordered pre-window production vectors and TOI seconds.
  - Output scale: 3-vector per-second rates; covariance/exposure.
- **Codex view (core-031, calculation, location; Codex family 'BLSH research'):** Position-cohort production prior
  - Formula: Estimate between-player variation after within-player uncertainty; PSD geometry.
  - Purpose: Build descriptive production-versus-personal-reference evidence.
  - Inputs/units: Same-position donor history summaries excluding target, cutoff.
  - Output scale: Cohort mean, covariance, within-player covariance.
- **Audit context:**
  - Intent (Opus): productionReference.ts:1-6 (port of frozen research estimator position-exposure-reference-gap-v1)
  - Intended contract (Codex core-029): Frozen research port; source comments identify research origin and provisional2026-11-03 decisions.
  - Intended contract (Codex core-031): Frozen research port; source comments identify research origin and provisional2026-11-03 decisions.
  - External references: Empirical Bayes / random-effects method-of-moments (multivariate Tango regression)
  - Fixtures/test data: `web/lib/buyLowSellHigh/research-snapshots/2026-10-28.arm-a-canonical-repaired.v2.json`; `web/lib/buyLowSellHigh/research-snapshots/2026-10-26.arm-a-official-overlay.v2.json`; `web/lib/buyLowSellHigh/research-snapshots/2024-04-18.v1.json`; `web/lib/buyLowSellHigh/__fixtures__/display-profiles.jsonl`; `tasks/artifacts/blsh-independent-review-2026-10-28/dry-run-v4/PROFILES-A_development_reference__official_receipt_overlay.jsonl`; `tasks/artifacts/blsh-independent-review-2026-10-28/dry-run-v4/SUMMARY.json`
  - Tests: `web/lib/buyLowSellHigh/productionReference.test.ts`
- **Leads (not audited):**
  - (opus) donor cutoff date '2026-07-01' hard-coded in currentWindows.ts:199
  - (opus) donors restricted to complete 50-game runs (survivor/role bias toward regulars)

## M-BLSH-006 BLSH stage 2a: recency-weighted personal baseline (arm C)

- **Match:** Both; Opus BLSH-007; Codex core-030
- **Purpose:** Personal per-game and per-60 baseline from three prior seasons (0.6/0.3/0.1) plus current-season pre-window games (1.0).
- **Where:** `web/lib/buyLowSellHigh/productionReference.ts:157 (PRIOR_SEASON_WEIGHTS, CURRENT_SEASON_WEIGHT, INSUFFICIENT_HISTORY_GAMES)`; `web/lib/buyLowSellHigh/productionReference.ts:180 (gameWeight)`; `web/lib/buyLowSellHigh/productionReference.ts:186 (weightedBaseline)`; `web/lib/buyLowSellHigh/productionReference.ts:221 (weightedHi … (full text in the original packet)
- **Opus view (BLSH-007):**
  - Method: Only games before the window. Per-game weight w by season distance: current 1.0, -1 0.6, -2 0.3, -3 0.1. Usable game = GP 1, seconds>0, FP finite. perGame_j=Σw*y/Σw; per60_j=3600*Σw*y/Σw*t. Effective seconds (Kish) = (Σw t)^2/Σw^2 t. Status personal / confirmed_none / unknown; insufficient if <20 usable games. Arms A/B: last 50 games unweighted.
  - Inputs/units: seconds TOI; per-game counts; sources: development history export, current-season capture
  - Output scale: per-game and per-60 rates; writes: —
  - Status: live (frozen) — runs offline via web/scripts/blsh/currentDryRun.test.ts; output frozen JSON web/lib/buyLowSellHigh/research-snapshots/2026-10-28.arm-a-canonical-repaired.v2.json served by pages/buy-low-sell-high/preview.tsx
  - Consumers: BLSH stage 2b; opportunity history; display lists gate
- **Codex view (core-030, calculation, location; Codex family 'BLSH research'):** Recency-weighted personal baseline
  - Formula: Exposure-weighted season counts; effective sample/exposure retained; only dates strictly before window.
  - Purpose: Build descriptive production-versus-personal-reference evidence.
  - Inputs/units: Current plus 3 prior seasons, per-game counts and seconds, weights 1, .6, .3, .1.
  - Output scale: Per-game/per 60 production, effective games/seconds, track availability.
- **Audit context:**
  - Intent (Opus): productionReference.ts:141-155 comment (TJ decision 1); tasks/artifacts/blsh-baseline-2026-11-04/REPORT.md
  - Intended contract (Codex core-030): Frozen research port; source comments identify research origin and provisional2026-11-03 decisions.
  - External references: Marcel-style season weighting; Kish effective sample size
  - Fixtures/test data: `web/lib/buyLowSellHigh/research-snapshots/2026-10-28.arm-a-canonical-repaired.v2.json`; `web/lib/buyLowSellHigh/research-snapshots/2026-10-26.arm-a-official-overlay.v2.json`; `web/lib/buyLowSellHigh/research-snapshots/2024-04-18.v1.json`; `web/lib/buyLowSellHigh/__fixtures__/display-profiles.jsonl`; `tasks/artifacts/blsh-independent-review-2026-10-28/dry-run-v4/PROFILES-A_development_reference__official_receipt_overlay.jsonl`; `tasks/artifacts/blsh-independent-review-2026-10-28/dry-run-v4/SUMMARY.json`
  - Tests: `web/lib/buyLowSellHigh/productionReference.test.ts`; `web/scripts/blsh/baselineEvaluation.test.ts`
- **Leads (not audited):**
  - (opus) weights provisional (TJ decision 1, frozen 2026-11-04); current-season 1.0 vs prior 0.6 chosen on 2023-24/24-25 dev data
  - (opus) current snapshot uses arm A (development 2022-24 reference), so the published reference is stale (stated in limits)

## M-BLSH-007 BLSH stage 2c: shrunk personal reference rate

- **Match:** Both; Opus BLSH-008; Codex core-032
- **Purpose:** Blend personal rates with cohort mean using a scalar signal/(signal+noise) weight.
- **Where:** `web/lib/buyLowSellHigh/productionReference.ts:250 (personalReference)`; `web/lib/buyLowSellHigh/productionReference.ts:250 personalReference`
- **Opus view (BLSH-008):**
  - Method: No personal: rate=mu, cov=signal+mean_cov. Else signal=tr(M·S), noise=tr(M·Omega)/seconds, weight=signal/(signal+noise); rate=w*personal+(1-w)*mu; cov=(1-w)^2(S+mean_cov)+w^2*Omega/seconds.
  - Inputs/units: per-second rates; sources: —
  - Output scale: per-second rate + covariance; writes: —
  - Status: live (frozen) — runs offline via web/scripts/blsh/currentDryRun.test.ts; output frozen JSON web/lib/buyLowSellHigh/research-snapshots/2026-10-28.arm-a-canonical-repaired.v2.json served by pages/buy-low-sell-high/preview.tsx
  - Consumers: BLSH stage 3
- **Codex view (core-032, calculation, location; Codex family 'BLSH research'):** Personal/cohort empirical-Bayes reference
  - Formula: Multivariate covariance-weighted personal shrinkage toward cohort.
  - Purpose: Build descriptive production-versus-personal-reference evidence.
  - Inputs/units: Prior mean/covariance plus personal summary.
  - Output scale: Posterior rate vector and covariance; personal weights.
- **Audit context:**
  - Intent (Opus): productionReference.ts:1-6
  - Intended contract (Codex core-032): Frozen research port; source comments identify research origin and provisional2026-11-03 decisions.
  - External references: James-Stein / Tango regression to the mean (multivariate, trace-scalarised)
  - Fixtures/test data: `web/lib/buyLowSellHigh/research-snapshots/2026-10-28.arm-a-canonical-repaired.v2.json`; `web/lib/buyLowSellHigh/research-snapshots/2026-10-26.arm-a-official-overlay.v2.json`; `web/lib/buyLowSellHigh/research-snapshots/2024-04-18.v1.json`; `web/lib/buyLowSellHigh/__fixtures__/display-profiles.jsonl`; `tasks/artifacts/blsh-independent-review-2026-10-28/dry-run-v4/PROFILES-A_development_reference__official_receipt_overlay.jsonl`; `tasks/artifacts/blsh-independent-review-2026-10-28/dry-run-v4/SUMMARY.json`
  - Tests: `web/lib/buyLowSellHigh/productionReference.test.ts`
- **Leads (not audited):**
  - (opus) single scalar weight for all three tracks (trace collapse) rather than per-track shrinkage

## M-BLSH-008 BLSH stage 3: production gap (normalised expected minus observed, index)

- **Match:** Both; Opus BLSH-009; Codex core-033
- **Purpose:** Standardised aggregate gap between reference-expected and recorded production over the 5-game window.
- **Where:** `web/lib/buyLowSellHigh/productionReference.ts:266 (productionGap)`; `web/lib/buyLowSellHigh/productionReference.ts:301 (scoreProduction)`; `web/lib/buyLowSellHigh/currentWindows.ts:209 (window = last 5 current games)`; `web/lib/buyLowSellHigh/productionReference.ts:266 productionGap`
- **Opus view (BLSH-009):**
  - Method: expected=rate*T; V=cov*T^2+omega*T; delta=expected-observed; sd_i=sqrt(V_ii); R=corr(V); a_i=(1/3)/sd_i/sqrt(w'Rw), w=(1/3,1/3,1/3); d=a·delta; index value=100*d/(1+\|d\|) in (-100,100). Direction (only with personal history): d>0 buy_low_evidence, d<0 sell_high_evidence. Tier cohort_reference / sparse_personal_shrunk (<50) / full_personal_shrunk.
  - Inputs/units: totals over window; seconds; sources: —
  - Output scale: index -100..100; d unbounded; writes: —
  - Status: live (frozen) — runs offline via web/scripts/blsh/currentDryRun.test.ts; output frozen JSON web/lib/buyLowSellHigh/research-snapshots/2026-10-28.arm-a-canonical-repaired.v2.json served by pages/buy-low-sell-high/preview.tsx
  - Consumers: BLSH stage 4 supportGap.score
- **Codex view (core-033, calculation, location; Codex family 'BLSH research'):** Production reference gap
  - Formula: Expected=rate*seconds; V=referenceCov*seconds²+omega*seconds; equal-track correlation-normalized d; 100*d/(1+abs(d)).
  - Purpose: Build descriptive production-versus-personal-reference evidence.
  - Inputs/units: Reference rates/covariance, observed 3 tracks, current seconds.
  - Output scale: Normalized signed gap and score (-100, 100).
- **Audit context:**
  - Intent (Opus): productionReference.ts:1-6 ('joint moments are working descriptive uncertainty, not calibrated probabilities')
  - Intended contract (Codex core-033): Frozen research port; source comments identify research origin and provisional2026-11-03 decisions.
  - External references: Standardised residual / z-score of observed vs expected (uncalibrated)
  - Fixtures/test data: `web/lib/buyLowSellHigh/research-snapshots/2026-10-28.arm-a-canonical-repaired.v2.json`; `web/lib/buyLowSellHigh/research-snapshots/2026-10-26.arm-a-official-overlay.v2.json`; `web/lib/buyLowSellHigh/research-snapshots/2024-04-18.v1.json`; `web/lib/buyLowSellHigh/__fixtures__/display-profiles.jsonl`; `tasks/artifacts/blsh-independent-review-2026-10-28/dry-run-v4/PROFILES-A_development_reference__official_receipt_overlay.jsonl`; `tasks/artifacts/blsh-independent-review-2026-10-28/dry-run-v4/SUMMARY.json`
  - Tests: `web/lib/buyLowSellHigh/currentWindows.test.ts`; `web/lib/buyLowSellHigh/productionReference.test.ts`
- **Leads (not audited):**
  - (opus) equal 1/3 track weights fixed, not validated (snapshot says combined index is not the headline)
  - (opus) 100*d/(1+\|d\|) squashing is monotone but not a probability

## M-BLSH-009 BLSH stage 4b: conditional process delta (imputation of missing components)

- **Match:** Both; Opus BLSH-011; Codex core-037
- **Purpose:** Current-minus-reference process delta, imputing missing components from the observed ones.
- **Where:** `web/lib/buyLowSellHigh/supportGap.ts:200 (conditionalDelta)`; `web/lib/buyLowSellHigh/currentWindows.ts:170 (weightedProcess)`; `web/lib/buyLowSellHigh/supportGap.ts:200 conditionalDelta`
- **Opus view (BLSH-011):**
  - Method: delta_j = current_j - reference_j (reference cohortX if missing). Missing current components: delta_m = Cmo Coo^-1 delta_o, conditional covariance from Cholesky-like root. Flags outsidePriorSpan (residual off projector) and outsidePriorComponentRange (delta outside training deviations). Arm C reference process = weighted per-60 if qualified games carry ≥50% of weighted TOI.
  - Inputs/units: per-60; sources: —
  - Output scale: per-60 deltas; writes: —
  - Status: live (frozen) — runs offline via web/scripts/blsh/currentDryRun.test.ts; output frozen JSON web/lib/buyLowSellHigh/research-snapshots/2026-10-28.arm-a-canonical-repaired.v2.json served by pages/buy-low-sell-high/preview.tsx
  - Consumers: BLSH stage 4c
- **Codex view (core-037, calculation, location; Codex family 'BLSH research'):** Conditional process deltas
  - Formula: Observed current-reference; missing delta via C_mo*C_oo_inverse*observedDelta; conditional residual covariance.
  - Purpose: Explain retrospective production supported by recorded process.
  - Inputs/units: Current/reference process vector, missing flags, Cxx.
  - Output scale: Observed/imputed deltas; missing covariance; extrapolation flags.
- **Audit context:**
  - Intent (Opus): supportGap.ts:199 comment 'Missing delta components get a labelled linear estimate, never a zero fill'
  - Intended contract (Codex core-037): No probability, causal-luck, market-value, predictive claim; trustedListEligible always false; source module header.
  - External references: Gaussian conditional expectation
  - Fixtures/test data: `web/lib/buyLowSellHigh/research-snapshots/2026-10-28.arm-a-canonical-repaired.v2.json`; `web/lib/buyLowSellHigh/research-snapshots/2026-10-26.arm-a-official-overlay.v2.json`; `web/lib/buyLowSellHigh/research-snapshots/2024-04-18.v1.json`; `web/lib/buyLowSellHigh/__fixtures__/display-profiles.jsonl`; `tasks/artifacts/blsh-independent-review-2026-10-28/dry-run-v4/PROFILES-A_development_reference__official_receipt_overlay.jsonl`; `tasks/artifacts/blsh-independent-review-2026-10-28/dry-run-v4/SUMMARY.json`
  - Tests: `web/lib/buyLowSellHigh/currentWindows.test.ts`; `web/lib/buyLowSellHigh/supportGap.test.ts`
- **Leads (not audited):**
  - (opus) 50% qualified-TOI rule is provisional (comment)

## M-BLSH-010 BLSH stage 4c: support-conditioned gap score, status and BL/SH list assignment

- **Match:** Both; Opus BLSH-012; Codex core-038
- **Purpose:** Adjust expected production by the process change and re-standardise; assign Buy-Low or Sell-High research list.
- **Where:** `web/lib/buyLowSellHigh/supportGap.ts:245 (score)`; `web/lib/buyLowSellHigh/supportGap.ts:415 (scoreAndAttribute)`; `web/lib/buyLowSellHigh/supportGap.ts:245 score`
- **Opus view (BLSH-012):**
  - Method: adjustment = (T/3600)·(delta·beta); support = expected+adjustment, FP and G+A floored at 0. Same a-weights as stage 3: d=a·(support-actual), originalD=a·(expected-actual). value=100d/(1+\|d\|). Status: balanced (d=0), support_direction_without_baseline_concordance, conflicting (sign differs), concordant_research_candidate. evidenceTier measured only if no imputation, personal reference, no floors, inside prior span/range. researchList = BL if fresh & concordant & d>0, SH if d<0. fresh = last game ≤7 days before eventThrough.
  - Inputs/units: totals; seconds; sources: —
  - Output scale: index -100..100; list BL/SH/null; writes: —
  - Status: live (frozen) — runs offline via web/scripts/blsh/currentDryRun.test.ts; output frozen JSON web/lib/buyLowSellHigh/research-snapshots/2026-10-28.arm-a-canonical-repaired.v2.json served by pages/buy-low-sell-high/preview.tsx
  - Consumers: rankTwoLists; display lists; BlshCandidateLists; player cards
- **Codex view (core-038, calculation, location; Codex family 'BLSH research'):** Support-conditioned production gap
  - Formula: Support=baseline+hours*deltaX*beta; floor FP and G+A at 0; normalized 3-track gap d using baseline covariance; 100d/(1+\|d\|).
  - Purpose: Explain retrospective production supported by recorded process.
  - Inputs/units: Production axis baseline, process deltas, sensitivity, current TOI.
  - Output scale: (-100, 100) support score, direction, concordance, list eligibility.
- **Audit context:**
  - Intent (Opus): supportGap.ts:244 'One current support-conditioned gap; never a trusted or automatic trade flag'; tasks/artifacts/blsh-independent-review-2026-10-28/INDEPENDENT-ASSESSMENT.md
  - Intended contract (Codex core-038): No probability, causal-luck, market-value, predictive claim; trustedListEligible always false; source module header.
  - Fixtures/test data: `web/lib/buyLowSellHigh/research-snapshots/2026-10-28.arm-a-canonical-repaired.v2.json`; `web/lib/buyLowSellHigh/research-snapshots/2026-10-26.arm-a-official-overlay.v2.json`; `web/lib/buyLowSellHigh/research-snapshots/2024-04-18.v1.json`; `web/lib/buyLowSellHigh/__fixtures__/display-profiles.jsonl`; `tasks/artifacts/blsh-independent-review-2026-10-28/dry-run-v4/PROFILES-A_development_reference__official_receipt_overlay.jsonl`; `tasks/artifacts/blsh-independent-review-2026-10-28/dry-run-v4/SUMMARY.json`
  - Tests: `web/lib/buyLowSellHigh/supportGap.test.ts`
- **Leads (not audited):**
  - (opus) freshness window 7 days hard-coded (currentWindows.ts fresh = lastAge<=7)
  - (opus) development forecast test found support adjustment added almost nothing beyond the production reference (stated in snapshot predictiveResearch note)

## M-BLSH-011 BLSH stage 5: list gates and ranking (BL/SH top 25, ≥20 personal games, 5-game window, FP-gap ordering)

- **Match:** Both; Opus BLSH-013; Codex core-039, core-044
- **Purpose:** Gate and order the Buy-Low and Sell-High lists shown to users.
- **Where:** `web/lib/buyLowSellHigh/supportGap.ts:300 (rankTwoLists)`; `web/lib/buyLowSellHigh/displayProfile.ts:21 (BLSH_MIN_PERSONAL_GAMES, BLSH_LIST_WINDOW_GAMES, BLSH_LIST_TOP_N)`; `web/lib/buyLowSellHigh/displayProfile.ts:233 (personalHistoryReason)`; `web/lib/buyLowSellHigh/displayProfile.ts:249 (listWithheldReason)`; `web/lib/buyL … (full text in the original packet)
- **Opus view (BLSH-013):**
  - Method: rankTwoLists: concordant fresh members, sort measured tier first, then \|value\| desc. Gates (first failing wins): personal history n≥20 (else withheld, unknown vs confirmed-none kept apart), window ≥5 appearances, FHFH FP track gap (support-conditioned expected − observed) sign agrees with list (BL gap>0, SH gap<0). Final rank: by directed FP gap desc then playerId; positionRank within F/D; top 25 per side and position lead the display.
  - Inputs/units: fantasy points gap; sources: —
  - Output scale: rank 1..N; writes: —
  - Status: live (frozen) — runs offline via web/scripts/blsh/currentDryRun.test.ts; output frozen JSON web/lib/buyLowSellHigh/research-snapshots/2026-10-28.arm-a-canonical-repaired.v2.json served by pages/buy-low-sell-high/preview.tsx
  - Consumers: pages/buy-low-sell-high/preview.tsx -> BlshCandidateLists; player-cards retainedBlsh
- **Codex view (core-039, calculation, location; Codex family 'BLSH research'):** Directional research list ranking
  - Formula: Measured-personal tier first, then descending abs(score), playerId, date.
  - Purpose: Explain retrospective production supported by recorded process.
  - Inputs/units: Fresh concordant scored origins.
  - Output scale: Separate BL/SH order.
- **Codex view (core-044, calculation, location; Codex family 'BLSH research'):** Research list display eligibility
  - Formula: Require 20 personal games, 5-game window and FP headline sign concordance; missing histories separate.
  - Purpose: Gate displayed research lists without recomputing score.
  - Inputs/units: Saved research score, history length, window length, headline FP sign.
  - Output scale: List membership/rank; top 25 in each direction.
- **Audit context:**
  - Intent (Opus): displayProfile.ts:246-248 comment; tasks/artifacts/blsh-list-gating-2026-11-03, tasks/artifacts/blsh-lists-2026-11-04
  - Intended contract (Codex core-039): No probability, causal-luck, market-value, predictive claim; trustedListEligible always false; source module header.
  - Intended contract (Codex core-044): Display contract v2; mapper v3; opportunity result provisional and does not affect lists.
  - Fixtures/test data: `web/lib/buyLowSellHigh/research-snapshots/2026-10-28.arm-a-canonical-repaired.v2.json`; `web/lib/buyLowSellHigh/research-snapshots/2026-10-26.arm-a-official-overlay.v2.json`; `web/lib/buyLowSellHigh/research-snapshots/2024-04-18.v1.json`; `web/lib/buyLowSellHigh/__fixtures__/display-profiles.jsonl`; `tasks/artifacts/blsh-independent-review-2026-10-28/dry-run-v4/PROFILES-A_development_reference__official_receipt_overlay.jsonl`; `tasks/artifacts/blsh-independent-review-2026-10-28/dry-run-v4/SUMMARY.json`
  - Tests: `web/components/buyLowSellHigh/BlshCandidateLists.test.tsx`; `web/lib/buyLowSellHigh/displayProfile.test.ts`; `web/lib/buyLowSellHigh/researchSnapshot.test.ts`; `web/lib/buyLowSellHigh/supportGap.test.ts`
- **Leads (not audited):**
  - (opus) two different orderings — rankTwoLists (tier, \|combined value\|) is overridden by FP-gap ordering for displayed ranks
  - (opus) thresholds 20 games / 5 games / top 25 are provisional (flagged in snapshot)

## M-BLSH-012 BLSH explanation layer (finishing, on-ice finishing, assist share, shots, TOI comparisons)

- **Match:** Both; Opus BLSH-014; Codex core-040
- **Purpose:** Context signals that explain a scored gap without changing it.
- **Where:** `web/lib/buyLowSellHigh/supportGap.ts:477 (exposure)`; `web/lib/buyLowSellHigh/supportGap.ts:484 (perGame)`; `web/lib/buyLowSellHigh/supportGap.ts:491 (scopedPer60)`; `web/lib/buyLowSellHigh/supportGap.ts:519 (teammateGoalAssistRate)`; `web/lib/buyLowSellHigh/supportGap.ts:543 (explainSupportGap)`; `web/lib/buyLowSellHigh/cur … (full text in the original packet)
- **Opus view (BLSH-014):**
  - Method: Per-track normalised contribution weights_t*gap. TOI/ES TOI/PP TOI per game. (goals - ixG)/60 with Poisson noise scale 3600*sqrt(ixG)/seconds; (onIceGF - onIceXGF)/60; assists/(onIceGF - own goals); shots/60. Deltas only when scope, provider, field and revision match.
  - Inputs/units: seconds; counts; sources: —
  - Output scale: per-60 and per-game deltas; writes: —
  - Status: live (frozen) — runs offline via web/scripts/blsh/currentDryRun.test.ts; output frozen JSON web/lib/buyLowSellHigh/research-snapshots/2026-10-28.arm-a-canonical-repaired.v2.json served by pages/buy-low-sell-high/preview.tsx
  - Consumers: display profiles; BlshPlayerDetail
- **Codex view (core-040, calculation, location; Codex family 'BLSH research'):** Support attribution and context metrics
  - Formula: Decompose baseline gap + each sensitivity delta + floor; contextual rate differences use declared strength exposure. Finishing spread uses sqrt(xG), when positive.
  - Purpose: Explain retrospective production supported by recorded process.
  - Inputs/units: Frozen score attribution and identity/provenance-matched windows.
  - Output scale: Track gap components; TOI/game, ES/PPTOI/game; G-ixG/60; on-ice G-xGF/60; assists per teammate goal; shots60.
- **Audit context:**
  - Intent (Opus): supportGap.ts:319-337 comment block (explanation layer v3)
  - Intended contract (Codex core-040): No probability, causal-luck, market-value, predictive claim; trustedListEligible always false; source module header.
  - External references: Goals above expected; IPP-like secondary assist share; PDO-style on-ice sh% regression
  - Fixtures/test data: `web/lib/buyLowSellHigh/research-snapshots/2026-10-28.arm-a-canonical-repaired.v2.json`; `web/lib/buyLowSellHigh/research-snapshots/2026-10-26.arm-a-official-overlay.v2.json`; `web/lib/buyLowSellHigh/research-snapshots/2024-04-18.v1.json`; `web/lib/buyLowSellHigh/__fixtures__/display-profiles.jsonl`; `tasks/artifacts/blsh-independent-review-2026-10-28/dry-run-v4/PROFILES-A_development_reference__official_receipt_overlay.jsonl`; `tasks/artifacts/blsh-independent-review-2026-10-28/dry-run-v4/SUMMARY.json`
  - Tests: `web/lib/buyLowSellHigh/supportGap.test.ts`
- **Leads (not audited):**
  - (opus) reference context totals are unweighted over baseline games while score uses weighted baseline (coverage note says so)

## M-BLSH-013 BLSH stage 4a: process-support sensitivity model (within-player beta, SHRINK 0.5)

- **Match:** Both; Opus BLSH-015; Codex core-035, core-036
- **Purpose:** Fit how 5-game changes in process (ixG/60, on-ice xGF/60, xGA/60) move production, on disjoint training blocks.
- **Where:** `web/lib/buyLowSellHigh/supportGap.ts:7 (PROCESS, SHRINK, SEASONS)`; `web/lib/buyLowSellHigh/supportGap.ts:101 (covarianceGeometry)`; `web/lib/buyLowSellHigh/supportGap.ts:131 (fitPrior)`; `web/lib/buyLowSellHigh/supportGap.ts:101 covarianceGeometry`; `web/lib/buyLowSellHigh/supportGap.ts:131 fitPrior`
- **Opus view (BLSH-015):**
  - Method: Exclude target player, other positions, unqualified blocks, blocks with team/position change. Group by player-season (≥2 blocks). Exposure-weighted within-player-season deviations dx, dy; weights q/(players*seasonsPerPlayer). Cxx=Σ w dx dx', Cxy=Σ w dx dy'. beta = 0.5 × pinv(Cxx)·Cxy (eigen pseudo-inverse in correlation units). cohortX=weighted mean process; deltaMin/Max = observed deviation range.
  - Inputs/units: process per-60 (NST all-situations); Y per-hour; sources: development history export 2022-23, 2023-24
  - Output scale: beta: production per hour per unit process/60; writes: —
  - Status: live (frozen) — runs offline via web/scripts/blsh/currentDryRun.test.ts; output frozen JSON web/lib/buyLowSellHigh/research-snapshots/2026-10-28.arm-a-canonical-repaired.v2.json served by pages/buy-low-sell-high/preview.tsx
  - Consumers: BLSH stage 4b/4c; forecastEvaluation P2_transfer
- **Codex view (core-035, calculation, location; Codex family 'BLSH research'):** Covariance geometry
  - Formula: Scale to correlation; Jacobi eigendecomposition; retain positive numerical-rank eigenvalues.
  - Purpose: Explain retrospective production supported by recorded process.
  - Inputs/units: PSD covariance matrix.
  - Output scale: Inverse, root, projector, scales, rank.
- **Codex view (core-036, calculation, location; Codex family 'BLSH research'):** Support sensitivity prior
  - Formula: Within-player/season exposure-weighted Cxx, Cxy; equal donor-player weighting; beta=.5*Cxx_inverse*Cxy; leave target out.
  - Purpose: Explain retrospective production supported by recorded process.
  - Inputs/units: Qualified disjoint 5-game blocks; ixG60, on-ice xGF60, xGA60 X; 3 outcome rates Y; F/D.
  - Output scale: Coefficient 3×3 matrix and covariance.
- **Audit context:**
  - Intent (Opus): supportGap.ts:1-5 header (port of frozen research scorer support-conditioned-production-gap-v1)
  - Intended contract (Codex core-035): No probability, causal-luck, market-value, predictive claim; trustedListEligible always false; source module header.
  - Intended contract (Codex core-036): No probability, causal-luck, market-value, predictive claim; trustedListEligible always false; source module header.
  - External references: Fixed-effects (within) regression with ridge-like shrinkage
  - Fixtures/test data: `web/lib/buyLowSellHigh/research-snapshots/2026-10-28.arm-a-canonical-repaired.v2.json`; `web/lib/buyLowSellHigh/research-snapshots/2026-10-26.arm-a-official-overlay.v2.json`; `web/lib/buyLowSellHigh/research-snapshots/2024-04-18.v1.json`; `web/lib/buyLowSellHigh/__fixtures__/display-profiles.jsonl`; `tasks/artifacts/blsh-independent-review-2026-10-28/dry-run-v4/PROFILES-A_development_reference__official_receipt_overlay.jsonl`; `tasks/artifacts/blsh-independent-review-2026-10-28/dry-run-v4/SUMMARY.json`
  - Tests: `web/lib/buyLowSellHigh/supportGap.test.ts`
- **Leads (not audited):**
  - (opus) training seasons hard-coded [20222023, 20232024]; fitPrior throws on any other season
  - (opus) SHRINK=0.5 fixed constant; coefficient uncertainty flagged uncalibrated
  - (opus) on-ice xGA60 enters as a 'process' feature with a learned sign (no a-priori constraint)

## M-BLSH-014 BLSH current-input qualification gates

- **Match:** Opus only; Opus BLSH-001; Codex —
- **Purpose:** Admit current-season game rows and NST process rows only when identity, exposure and capture age check out.
- **Where:** `web/lib/buyLowSellHigh/currentInput.ts:3 (CURRENT_INPUT_SEASON)`; `web/lib/buyLowSellHigh/currentInput.ts:130 (qualifyCurrentResearchInputs)`; `web/lib/buyLowSellHigh/currentInput.ts:210 (processCheck)`; `web/lib/buyLowSellHigh/currentInput.ts:227 (qualifyCurrentInputs)`; `web/lib/buyLowSellHigh/currentProcessEvidence.server … (full text in the original packet)
- **Opus view (BLSH-001):**
  - Method: Process TOI must equal WGO toi_per_game (seconds) exactly; GP=1; regular-season game id check (floor(id/1e6)=2026, type 02); capture age hours = (asOf − retrieved)/3.6e6; evidence age max over receipts.
  - Inputs/units: seconds; hours; sources: wgo_skater_stats capture, nst process feeds
  - Output scale: boolean gates; writes: —
  - Status: live (frozen) — runs offline via web/scripts/blsh/currentDryRun.test.ts; output frozen JSON web/lib/buyLowSellHigh/research-snapshots/2026-10-28.arm-a-canonical-repaired.v2.json served by pages/buy-low-sell-high/preview.tsx
  - Consumers: currentSlot (stage 1)
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED beyond reason codes (tasks/diaries/2026-10-27-codex-blsh-current-input.md)
  - Tests: `web/lib/buyLowSellHigh/currentInput.test.ts`; `web/lib/buyLowSellHigh/currentProcessEvidence.server.test.ts`
- **Leads (not audited):**
  - (opus) season 20262027 and game-id year 2026 hard-coded (currentInput.ts:3, :243) — needs edit each season

## M-BLSH-015 BLSH research state label and window-age text

- **Match:** Opus only; Opus BLSH-010; Codex —
- **Purpose:** Human labels for snapshot profiles.
- **Where:** `web/lib/buyLowSellHigh/researchSnapshot.ts:330 (currentStateLabel)`; `web/lib/buyLowSellHigh/researchSnapshot.ts:335 (currentWindowAgeText)`; `web/lib/buyLowSellHigh/researchSnapshot.ts:348 (stateLabel)`
- **Opus view (BLSH-010):**
  - Method: Window-age within limit if age<=7 days. Historical label: conflicting / insufficient / stale / balanced (value 0) / personal-reference vs provisional.
  - Inputs/units: days; sources: —
  - Output scale: text label; writes: —
  - Status: live (frozen) — runs offline via web/scripts/blsh/currentDryRun.test.ts; output frozen JSON web/lib/buyLowSellHigh/research-snapshots/2026-10-28.arm-a-canonical-repaired.v2.json served by pages/buy-low-sell-high/preview.tsx
  - Consumers: BuyLowSellHighPreview; BlshPlayerDetail
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Fixtures/test data: `web/lib/buyLowSellHigh/research-snapshots/2026-10-28.arm-a-canonical-repaired.v2.json`; `web/lib/buyLowSellHigh/research-snapshots/2026-10-26.arm-a-official-overlay.v2.json`; `web/lib/buyLowSellHigh/research-snapshots/2024-04-18.v1.json`; `web/lib/buyLowSellHigh/__fixtures__/display-profiles.jsonl`; `tasks/artifacts/blsh-independent-review-2026-10-28/dry-run-v4/PROFILES-A_development_reference__official_receipt_overlay.jsonl`; `tasks/artifacts/blsh-independent-review-2026-10-28/dry-run-v4/SUMMARY.json`
  - Tests: `web/lib/buyLowSellHigh/researchSnapshot.test.ts`

## M-BLSH-016 Covariance validation/eigendecomposition

- **Match:** Codex only; Opus —; Codex core-034
- **Purpose:** Build descriptive production-versus-personal-reference evidence.
- **Where:** `web/lib/buyLowSellHigh/productionReference.ts:86 validCovariance`
- **Codex view (core-034, calculation; Codex family 'BLSH research'):** Covariance validation/eigendecomposition
  - Formula: Dimensionless Jacobi decomposition, PSD check; no arbitrary variance floor.
  - Purpose: Build descriptive production-versus-personal-reference evidence.
  - Inputs/units: Small symmetric covariance matrix.
  - Output scale: PSD validity, eigenbasis/inverse downstream.
  - Consumers: ["web/lib/buyLowSellHigh/currentWindows.ts", "web/lib/buyLowSellHigh/forecastEvaluation.ts"]
- **Audit context:**
  - Intended contract (Codex core-034): Frozen research port; source comments identify research origin and provisional2026-11-03 decisions.
  - Tests: `web/lib/buyLowSellHigh/productionReference.test.ts`; 

