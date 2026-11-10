# Audit packet: Sustainability (part 1 of 2)

Master entries M-SUS-001 to M-SUS-060 (60 of 75 in this family). Built from the merged Opus and Codex inventories; see [../MASTER.md](../MASTER.md) and [../MERGE-NOTES.md](../MERGE-NOTES.md).

How to read: each entry gives both inventories' descriptions side by side. **Conflicts** are places where the two descriptions disagree; they are unresolved. **Leads** are Opus red flags and Codex unknowns: observations to check, not audited findings. Tags are keyword heuristics. Line numbers were valid when each inventory was written on 2026-11-10 (Opus at d31dcb33f, Codex at 11e4192d3); re-check against the current checkout.

| ID | Name | Match | Conflicts | Leads |
|---|---|---|---:|---:|
| M-SUS-001 | matview player_baselines_3yr | Both | 0 | 3 |
| M-SUS-002 | view sustainability_trends_v | Both | 0 | 2 |
| M-SUS-003 | Rolling window baselines L3/L5/L10/L20 (mu, sigma per metric) | Both | 0 | 34 |
| M-SUS-004 | 3-year blended and career baselines | Both | 0 | 8 |
| M-SUS-005 | Power-play share controls (smoothed PP share, PP1 hysteresis, band wi… | Both | 0 | 4 |
| M-SUS-006 | Trend-band baselines (3-season weighted per-60 / percentage / normal) | Both | 0 | 6 |
| M-SUS-007 | Trend-band comparison deltas vs L5/L10/L20/season/career | Both | 0 | 4 |
| M-SUS-008 | Sustainability backtest metrics (MAE/RMSE/bias, Brier, band hit rate) | Both | 0 | 5 |
| M-SUS-009 | Feature helpers: per-60, per-game, z-score, window weights, weighted … | Both | 0 | 5 |
| M-SUS-010 | Usage and context deltas (TOI, PDO, on-ice SH%, OZS%) | Both | 0 | 3 |
| M-SUS-011 | Python finishing residuals (goals - ixG) | Both | 0 | 3 |
| M-SUS-012 | Finishing residuals in baselines (goals - ixG) | Both | 0 | 4 |
| M-SUS-013 | Python player multi-season posterior | Both | 0 | 3 |
| M-SUS-014 | Python league Beta priors | Both | 0 | 3 |
| M-SUS-015 | Empirical-Bayes linear shrinkage (gamma / beta) for features | Both | 0 | 3 |
| M-SUS-016 | Rookie / low-trial prior strengthening fallback | Both | 0 | 2 |
| M-SUS-017 | Player 3-season blended Beta posterior (player priors) | Both | 0 | 6 |
| M-SUS-018 | League Beta priors per position (shp, oishp, ipp, ppshp) | Both | 0 | 5 |
| M-SUS-019 | Opponent adjustment factors (defense score, rate multipliers) | Both | 0 | 5 |
| M-SUS-020 | Count projections (Poisson / NB normal-approx bands, 5/10-game horizo… | Both | 0 | 5 |
| M-SUS-021 | Faceoff win% projection bands | Both | 0 | 2 |
| M-SUS-022 | Python reliability, soft clipping and contributions | Both | 0 | 4 |
| M-SUS-023 | Python logistic scoring, components and quintiles | Both | 0 | 5 |
| M-SUS-024 | Score distribution snapshot and quintile assignment (TS) | Both | 0 | 4 |
| M-SUS-025 | Score guardrails (z clamp, s_raw clamp, exact 0/100 check, luck press… | Both | 0 | 2 |
| M-SUS-026 | Hot/normal/cold labelling and calibrated logistic probability model | Both | 0 | 6 |
| M-SUS-027 | Composite sustainability score (probability edge) and performance fla… | Both | 0 | 3 |
| M-SUS-028 | Sustainability process-support score s_raw / s_100 (canonical v3) | Both | 0 | 5 |
| M-SUS-029 | Gamma / Beta / Normal trend band (value, CI, z, percentile) | Both | 1 | 8 |
| M-SUS-030 | Half-life EWMA weights and prior blend | Both | 0 | 3 |
| M-SUS-031 | Beta and Gamma posterior credible intervals (incomplete beta/gamma, b… | Both | 0 | 5 |
| M-SUS-032 | Trend-band metric spec table (half-lives, prior strengths, distributi… | Both | 0 | 10 |
| M-SUS-033 | Python rolling windows GAME/G5/G10/STD | Both | 0 | 3 |
| M-SUS-034 | Python z-scores vs posterior with fixed SD constants | Both | 0 | 4 |
| M-SUS-035 | Reliability weight sqrt(n/(n+k)) and tanh soft clip (TS port) | Both | 0 | 4 |
| M-SUS-036 | Beta-binomial empirical-Bayes window z (eb_z) | Both | 0 | 4 |
| M-SUS-037 | seed sustainability_sigma_constants + model_sustainability_config v1 | Opus only | 0 | 2 |
| M-SUS-038 | fn finalize_sustainability_score_snapshot | Opus only | 0 | 2 |
| M-SUS-039 | view vw_entity_sustainability_scores | Opus only | 0 | 1 |
| M-SUS-040 | Legacy NST career averages (unweighted mean of season rows) | Opus only | 0 | 5 |
| M-SUS-041 | Legacy NST date-window sustainability stats (single player row) | Opus only | 0 | 2 |
| M-SUS-042 | Sustainability luck pressure (served) | Opus only | 0 | 3 |
| M-SUS-043 | trendsDebug sustainability-model feature engineering (recent-vs-caree… | Opus only | 0 | 4 |
| M-SUS-044 | Sustainability Sandbox band-status streaks, streak intensity and baro… | Opus only | 0 | 3 |
| M-SUS-045 | Python synthetic benchmark data generator | Opus only | 0 | 2 |
| M-SUS-046 | Joined feature row as-of selection | Opus only | 0 | 1 |
| M-SUS-047 | Legacy NST sustainability stats (S%, xS%, IPP, oiSH%, secA%, SOG/60, … | Opus only | 0 | 2 |
| M-SUS-048 | Sandbox tier labels (durable / balanced / volatile terciles) | Opus only | 0 | 1 |
| M-SUS-049 | Sustainability vs career colour rules | Opus only | 0 | 2 |
| M-SUS-050 | Reason highlights from score components | Opus only | 0 | 2 |
| M-SUS-051 | Recompute verification and distribution drift | Opus only | 0 | 1 |
| M-SUS-052 | Sustainability leaderboard filters and rookie flag | Opus only | 0 | 1 |
| M-SUS-053 | Config identity hashes (TS FNV-1a / Python SHA-256) | Opus only | 0 | 1 |
| M-SUS-054 | Luck pressure (trends sort key) | Opus only | 0 | 2 |
| M-SUS-055 | Trend-band per-game samples (gamma/beta/normal collectors) | Opus only | 0 | 3 |
| M-SUS-056 | Skill window per-60 rates | Opus only | 0 | 2 |
| M-SUS-057 | Window rolling counts (l3/l5/l10/l20) for luck stats | Opus only | 0 | 2 |
| M-SUS-058 | Skill stabilizer league reference (mu, sigma of per-60) | Opus only | 0 | 3 |
| M-SUS-059 | Count distribution approximation | Codex only | 0 | 1 |
| M-SUS-060 | Multi-game count aggregation | Codex only | 0 | 1 |

## M-SUS-001 matview player_baselines_3yr

- **Match:** Both; Opus SUS-001; Codex sql-player-baseline-sample
- **Purpose:** Sample 3-season weighted ixG/TOI blend and career totals per player
- **Where:** `migrations/20250930_add_baseline_3yr_career.sql:8 (player_baselines_3yr)`; `migrations/20250930_add_baseline_3yr_career.sql:8 player_baselines_3yr`
- **Tags (heuristic):** generation: development, current
- **Opus view (SUS-001):**
  - Method: blended_nst_ixg = 0.6*latest + 0.3*previous + 0.1*third season (by season_id desc, missing = 0); same for nst_toi; career sums of ixg and toi.
  - Inputs/units: season totals; toi seconds; sources: player_totals_unified
  - Output scale: weighted totals; writes: player_baselines_3yr
  - Status: draft — file says 'Sample migration ... illustrative'; not present in production baseline; no readers
  - Consumers: none found
- **Codex view (sql-player-baseline-sample, calculation, location; Codex family 'Illustrative SQL baseline'):** player_baselines_3yr
  - Purpose: Demonstrate latest-three weighted ixG/TOI and career sums.
  - Inputs/units: player_totals_unified season ixG and TOI; newest seasons
  - Output scale: blended_nst_ixg and blended_nst_toi with .6/.3/.1 weights; missing seasons coalesce0; career sums of ixG and TOI.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
- **Audit context:**
  - Intent (Opus): migrations/20250930_add_baseline_3yr_career.sql:1-3 'Sample migration to compute 3yr blended and career aggregates for player_baselines'
  - Intended contract (Codex sql-player-baseline-sample): File explicitly says sample/illustrative migration and demonstration, not production writer.
  - External references: Marcel-style 3-year weighting (5/4/3)
  - Fixtures/test data: none listed
  - Tests: `{"discovered_not_run": []}`
- **Leads (not audited):**
  - (opus) weights not renormalized when fewer than 3 seasons (missing = 0), deflating totals for young players
  - (opus) latest season may be partial current season
  - (codex:sql-player-baseline-sample) Definition exists locally; applied migration/live view shape, data freshness and runtime consumer use unknown.

## M-SUS-002 view sustainability_trends_v

- **Match:** Both; Opus SUS-003; Codex sql-sustainability-view
- **Purpose:** Luck pressure and absolute luck from stored sustainability component z-scores
- **Where:** `supabase/migrations/20260716112908_production_schema_baseline.sql:25682 (sustainability_trends_v)`; `supabase/migrations/20260716112908_production_schema_baseline.sql:25682 sustainability_trends_v; supabase/migrations/20260730233451_reconstruct_hosted_analytics_schema.sql:131`
- **Tags (heuristic):** generation: legacy, current
- **Opus view (SUS-003):**
  - Method: luck_pressure = -(w_shp*z_shp + w_oishp*z_oishp + w_ipp*z_ipp + w_ppshp*z_ppshp) using weights stored in components JSON; abs_luck = \|z_shp\|+\|z_oishp\|+\|z_ipp\|+\|z_ppshp\|.
  - Inputs/units: z-scores; sources: sustainability_scores, player_baselines
  - Output scale: weighted z-sum; writes: —
  - Status: legacy/dead — no web/ reader (web/scripts/audit-sustainability-trends-dependencies.mjs audits dependencies)
  - Consumers: no reader found in web/ (audit script only)
- **Codex view (sql-sustainability-view, calculation, location; Codex family 'Sustainability SQL cross-reference'):** sustainability_trends_v / analytics.vw_entity_sustainability_scores
  - Purpose: Expose stored sustainability scores and derived luck descriptors.
  - Inputs/units: Stored sustainability score components containing weights.luck and z_shp/z_oishp/z_ipp/z_ppshp; s_raw.
  - Output scale: luck_pressure = negative weighted sum of the four luck z-scores; abs_luck = sum of their absolute values. analytics.vw_entity_sustainability_scores classifies skater s_raw >=.75 as overperforming, <=−.75 underperforming, else stable, and unions entity rows.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex sql-sustainability-view): Baseline view formula plus analytics reconstruction threshold CASE are implementation evidence; no independent design specification found.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `{"discovered_not_run": []}`
- **Leads (not audited):**
  - (opus) join to player_baselines on exact snapshot_date may drop names
  - (codex:sql-sustainability-view) Definition exists locally; applied migration/live view shape, data freshness and runtime consumer use unknown.

## M-SUS-003 Rolling window baselines L3/L5/L10/L20 (mu, sigma per metric)

- **Match:** Both; Opus SUS-011; Codex baseline-window-goals_per_60, baseline-window-nst_hdcf_per_60, baseline-window-nst_icf_per_60, baseline-window-nst_ipp, baseline-window-nst_ixg, baseline-window-nst_ixg_per_60, baseline-window-nst_oi_cf_pct, baseline-window-nst_oi_pdo, baseline-window-nst_oi_save_pct, baseline-window-nst_oi_scf_pct, baseline-window-nst_oi_shooting_pct, baseline-window-nst_oi_xgf_pct, baseline-window-nst_shots_per_60, baseline-window-points_per_60, baseline-window-points_per_60_5v5, baseline-window-pp_goals_per_60, baseline-window-pp_points_per_60, baseline-window-pp_shooting_percentage, baseline-window-pp_shots_per_60, baseline-window-shooting_percentage, baseline-window-shooting_percentage_5v5, baseline-window-shots, web-lib-baselines-aggregations-buildbaselinepayload, web-lib-baselines-aggregations-buildwindowpayload, web-lib-baselines-aggregations-computeresiduals, web-lib-baselines-aggregations-pct, web-lib-baselines-aggregations-per60, web-lib-baselines-aggregations-samplestats, web-lib-baselines-aggregations-winsorize01
- **Purpose:** Per-player sample mean and SD of per-game metric values over the last N games.
- **Where:** `web/lib/baselines/aggregations.ts:23 (per60)`; `web/lib/baselines/aggregations.ts:28 (pct)`; `web/lib/baselines/aggregations.ts:33 (sampleStats)`; `web/lib/baselines/aggregations.ts:47 (winsorize01)`; `web/lib/baselines/aggregations.ts:67 (buildWindowPayload)`; `web/lib/baselines/aggregations.ts:517 (buildBaselinePayload win_l3..l20)`; `web/lib/baselines/aggregations.ts:92 buildWindowPayload`; `web/lib/baselines/aggregations.ts:89 buildWindowPayload`; `web/lib/baselines/aggregations.ts:88 buildWindowPayload`; `web/lib/baselines/aggregations.ts:84 buildWindowPayload`; `web/lib/baselines/aggregations.ts:85 buildWindowPayload`; `web/lib/baselines/aggregations.ts:87 buildWindowPayload` …
- **Tags (heuristic):** percent scale: both/ambiguous; denominators: per 60, per game, 5v5 only; generation: current
- **Opus view (SUS-011):**
  - Method: For each of 21 metrics compute one value per game: percentages via pct(s,t) (0 if t=0) winsorised to [0,1]; per-60 via 3600*x/toi_seconds (0 if toi 0); PDO=oiSH%+oiSV%; on-ice shares CF/(CF+CA) etc. mu=mean of per-game values; sigma=sample SD (n-1) floored 1e-6. Also stores numer/denom sums for sh%, pp sh%, oiSH%, oiSV%, per-60 metrics.
  - Inputs/units: toi seconds; counts; sources: player_stats_unified
  - Output scale: metric units; percentages fraction 0-1; writes: player_baselines (win_l3, win_l5, win_l10, win_l20)
  - Status: unknown — /api/v1/db/sustainability/rebuild-baselines listed in web/pages/api/v1/db/cron-report.ts:82 but not in web/vercel.json; player_baselines read by windows.loadPlayersForSnapshot and entitySurfaceServer
  - Consumers: entitySurfaceServer comparisons; dataJoins; loadPlayersForSnapshot (player list)
- **Codex view (baseline-window-goals_per_60, calculation, codex_part_of_opus; Codex family 'Baseline observed metric windows'):** goals_per_60 window statistics
  - Purpose: For each game, 3600*goals/total_TOI_seconds; then arithmetic mean and sample SD floored at SIGMA_MIN. Numeric missing values route through safeNumber to0 in this implementation.
  - Inputs/units: Per-game observed counts/time/source rate fields; time denominators seconds unless specified.
  - Output scale: mu and sigma in goals/60 minutes, n games; some branches also retain summed numerator/denominator.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "source_state": "Assigned source paths remained clean at final git-status inspection.", "deployment": "Unknown; no live verification."}
- **Codex view (baseline-window-nst_hdcf_per_60, calculation, codex_part_of_opus; Codex family 'Baseline observed metric windows'):** nst_hdcf_per_60 window statistics
  - Purpose: For each game, 3600*nst_hdcf/nst_toi_seconds; then arithmetic mean and sample SD floored at SIGMA_MIN. Numeric missing values route through safeNumber to0 in this implementation.
  - Inputs/units: Per-game observed counts/time/source rate fields; time denominators seconds unless specified.
  - Output scale: mu and sigma in high-danger attempts/60 minutes, n games; some branches also retain summed numerator/denominator.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "source_state": "Assigned source paths remained clean at final git-status inspection.", "deployment": "Unknown; no live verification."}
- **Codex view (baseline-window-nst_icf_per_60, calculation, codex_part_of_opus; Codex family 'Baseline observed metric windows'):** nst_icf_per_60 window statistics
  - Purpose: For each game, 3600*nst_icf/nst_toi_seconds; then arithmetic mean and sample SD floored at SIGMA_MIN. Numeric missing values route through safeNumber to0 in this implementation.
  - Inputs/units: Per-game observed counts/time/source rate fields; time denominators seconds unless specified.
  - Output scale: mu and sigma in shot attempts/60 minutes, n games; some branches also retain summed numerator/denominator.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "source_state": "Assigned source paths remained clean at final git-status inspection.", "deployment": "Unknown; no live verification."}
- **Codex view (baseline-window-nst_ipp, calculation, codex_part_of_opus; Codex family 'Baseline observed metric windows'):** nst_ipp window statistics
  - Purpose: For each game, numeric supplied individual point percentage values; then arithmetic mean and sample SD floored at SIGMA_MIN. Numeric missing values route through safeNumber to0 in this implementation.
  - Inputs/units: Per-game observed counts/time/source rate fields; time denominators seconds unless specified.
  - Output scale: mu and sigma in source IPP scale; source not renormalized in this branch, n games; some branches also retain summed numerator/denominator.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "source_state": "Assigned source paths remained clean at final git-status inspection.", "deployment": "Unknown; no live verification."}
- **Codex view (baseline-window-nst_ixg, calculation, codex_part_of_opus; Codex family 'Baseline observed metric windows'):** nst_ixg window statistics
  - Purpose: For each game, numeric supplied individual expected goals; then arithmetic mean and sample SD floored at SIGMA_MIN. Numeric missing values route through safeNumber to0 in this implementation.
  - Inputs/units: Per-game observed counts/time/source rate fields; time denominators seconds unless specified.
  - Output scale: mu and sigma in expected goals, n games; some branches also retain summed numerator/denominator.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "source_state": "Assigned source paths remained clean at final git-status inspection.", "deployment": "Unknown; no live verification."}
- **Codex view (baseline-window-nst_ixg_per_60, calculation, codex_part_of_opus; Codex family 'Baseline observed metric windows'):** nst_ixg_per_60 window statistics
  - Purpose: For each game, 3600*nst_ixg/nst_toi_seconds; then arithmetic mean and sample SD floored at SIGMA_MIN. Numeric missing values route through safeNumber to0 in this implementation.
  - Inputs/units: Per-game observed counts/time/source rate fields; time denominators seconds unless specified.
  - Output scale: mu and sigma in expected goals/60 minutes, n games; some branches also retain summed numerator/denominator.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "source_state": "Assigned source paths remained clean at final git-status inspection.", "deployment": "Unknown; no live verification."}
- **Codex view (baseline-window-nst_oi_cf_pct, calculation, codex_part_of_opus; Codex family 'Baseline observed metric windows'):** nst_oi_cf_pct window statistics
  - Purpose: For each game, on-ice CF/(CF+CA), clamped[0,1]; then arithmetic mean and sample SD floored at SIGMA_MIN. Numeric missing values route through safeNumber to0 in this implementation.
  - Inputs/units: Per-game observed counts/time/source rate fields; time denominators seconds unless specified.
  - Output scale: mu and sigma in fraction, n games; some branches also retain summed numerator/denominator.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "source_state": "Assigned source paths remained clean at final git-status inspection.", "deployment": "Unknown; no live verification."}
- **Codex view (baseline-window-nst_oi_pdo, calculation, codex_part_of_opus; Codex family 'Baseline observed metric windows'):** nst_oi_pdo window statistics
  - Purpose: For each game, on-ice shooting fraction + on-ice save fraction; then arithmetic mean and sample SD floored at SIGMA_MIN. Numeric missing values route through safeNumber to0 in this implementation.
  - Inputs/units: Per-game observed counts/time/source rate fields; time denominators seconds unless specified.
  - Output scale: mu and sigma in PDO sum on fraction scale, n games; some branches also retain summed numerator/denominator.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "source_state": "Assigned source paths remained clean at final git-status inspection.", "deployment": "Unknown; no live verification."}
- **Codex view (baseline-window-nst_oi_save_pct, calculation, codex_part_of_opus; Codex family 'Baseline observed metric windows'):** nst_oi_save_pct window statistics
  - Purpose: For each game, (on-ice SA-on-ice GA)/on-ice SA clamped[0,1]; then arithmetic mean and sample SD floored at SIGMA_MIN. Numeric missing values route through safeNumber to0 in this implementation.
  - Inputs/units: Per-game observed counts/time/source rate fields; time denominators seconds unless specified.
  - Output scale: mu and sigma in fraction, n games; some branches also retain summed numerator/denominator.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "source_state": "Assigned source paths remained clean at final git-status inspection.", "deployment": "Unknown; no live verification."}
- **Codex view (baseline-window-nst_oi_scf_pct, calculation, codex_part_of_opus; Codex family 'Baseline observed metric windows'):** nst_oi_scf_pct window statistics
  - Purpose: For each game, on-ice SCF/(SCF+SCA), clamped[0,1]; then arithmetic mean and sample SD floored at SIGMA_MIN. Numeric missing values route through safeNumber to0 in this implementation.
  - Inputs/units: Per-game observed counts/time/source rate fields; time denominators seconds unless specified.
  - Output scale: mu and sigma in fraction, n games; some branches also retain summed numerator/denominator.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "source_state": "Assigned source paths remained clean at final git-status inspection.", "deployment": "Unknown; no live verification."}
- **Codex view (baseline-window-nst_oi_shooting_pct, calculation, codex_part_of_opus; Codex family 'Baseline observed metric windows'):** nst_oi_shooting_pct window statistics
  - Purpose: For each game, on-ice GF/on-ice shots for clamped[0,1]; then arithmetic mean and sample SD floored at SIGMA_MIN. Numeric missing values route through safeNumber to0 in this implementation.
  - Inputs/units: Per-game observed counts/time/source rate fields; time denominators seconds unless specified.
  - Output scale: mu and sigma in fraction, n games; some branches also retain summed numerator/denominator.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "source_state": "Assigned source paths remained clean at final git-status inspection.", "deployment": "Unknown; no live verification."}
- **Codex view (baseline-window-nst_oi_xgf_pct, calculation, codex_part_of_opus; Codex family 'Baseline observed metric windows'):** nst_oi_xgf_pct window statistics
  - Purpose: For each game, on-ice xGF/(xGF+xGA), clamped[0,1]; then arithmetic mean and sample SD floored at SIGMA_MIN. Numeric missing values route through safeNumber to0 in this implementation.
  - Inputs/units: Per-game observed counts/time/source rate fields; time denominators seconds unless specified.
  - Output scale: mu and sigma in fraction, n games; some branches also retain summed numerator/denominator.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "source_state": "Assigned source paths remained clean at final git-status inspection.", "deployment": "Unknown; no live verification."}
- **Codex view (baseline-window-nst_shots_per_60, calculation, codex_part_of_opus; Codex family 'Baseline observed metric windows'):** nst_shots_per_60 window statistics
  - Purpose: For each game, supplied NST shots-per60 (no recomputation); then arithmetic mean and sample SD floored at SIGMA_MIN. Numeric missing values route through safeNumber to0 in this implementation.
  - Inputs/units: Per-game observed counts/time/source rate fields; time denominators seconds unless specified.
  - Output scale: mu and sigma in shots/60 minutes, n games; some branches also retain summed numerator/denominator.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "source_state": "Assigned source paths remained clean at final git-status inspection.", "deployment": "Unknown; no live verification."}
- **Codex view (baseline-window-points_per_60, calculation, codex_part_of_opus; Codex family 'Baseline observed metric windows'):** points_per_60 window statistics
  - Purpose: For each game, 3600*points/total_TOI_seconds; then arithmetic mean and sample SD floored at SIGMA_MIN. Numeric missing values route through safeNumber to0 in this implementation.
  - Inputs/units: Per-game observed counts/time/source rate fields; time denominators seconds unless specified.
  - Output scale: mu and sigma in points/60 minutes, n games; some branches also retain summed numerator/denominator.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "source_state": "Assigned source paths remained clean at final git-status inspection.", "deployment": "Unknown; no live verification."}
- **Codex view (baseline-window-points_per_60_5v5, calculation, codex_part_of_opus; Codex family 'Baseline observed metric windows'):** points_per_60_5v5 window statistics
  - Purpose: For each game, 3600*points_5v5/5v5_TOI_seconds; then arithmetic mean and sample SD floored at SIGMA_MIN. Numeric missing values route through safeNumber to0 in this implementation.
  - Inputs/units: Per-game observed counts/time/source rate fields; time denominators seconds unless specified.
  - Output scale: mu and sigma in points/60 minutes, n games; some branches also retain summed numerator/denominator.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "source_state": "Assigned source paths remained clean at final git-status inspection.", "deployment": "Unknown; no live verification."}
- **Codex view (baseline-window-pp_goals_per_60, calculation, codex_part_of_opus; Codex family 'Baseline observed metric windows'):** pp_goals_per_60 window statistics
  - Purpose: For each game, 3600*pp_goals/pp_toi_seconds; then arithmetic mean and sample SD floored at SIGMA_MIN. Numeric missing values route through safeNumber to0 in this implementation.
  - Inputs/units: Per-game observed counts/time/source rate fields; time denominators seconds unless specified.
  - Output scale: mu and sigma in PP goals/60 minutes, n games; some branches also retain summed numerator/denominator.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "source_state": "Assigned source paths remained clean at final git-status inspection.", "deployment": "Unknown; no live verification."}
- **Codex view (baseline-window-pp_points_per_60, calculation, codex_part_of_opus; Codex family 'Baseline observed metric windows'):** pp_points_per_60 window statistics
  - Purpose: For each game, 3600*pp_points/pp_toi_seconds; then arithmetic mean and sample SD floored at SIGMA_MIN. Numeric missing values route through safeNumber to0 in this implementation.
  - Inputs/units: Per-game observed counts/time/source rate fields; time denominators seconds unless specified.
  - Output scale: mu and sigma in PP points/60 minutes, n games; some branches also retain summed numerator/denominator.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "source_state": "Assigned source paths remained clean at final git-status inspection.", "deployment": "Unknown; no live verification."}
- **Codex view (baseline-window-pp_shooting_percentage, calculation, codex_part_of_opus; Codex family 'Baseline observed metric windows'):** pp_shooting_percentage window statistics
  - Purpose: For each game, pp_goals/pp_shots clamped[0,1]; then arithmetic mean and sample SD floored at SIGMA_MIN. Numeric missing values route through safeNumber to0 in this implementation.
  - Inputs/units: Per-game observed counts/time/source rate fields; time denominators seconds unless specified.
  - Output scale: mu and sigma in fraction, n games; some branches also retain summed numerator/denominator.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "source_state": "Assigned source paths remained clean at final git-status inspection.", "deployment": "Unknown; no live verification."}
- **Codex view (baseline-window-pp_shots_per_60, calculation, codex_part_of_opus; Codex family 'Baseline observed metric windows'):** pp_shots_per_60 window statistics
  - Purpose: For each game, 3600*pp_shots/pp_toi_seconds; then arithmetic mean and sample SD floored at SIGMA_MIN. Numeric missing values route through safeNumber to0 in this implementation.
  - Inputs/units: Per-game observed counts/time/source rate fields; time denominators seconds unless specified.
  - Output scale: mu and sigma in PP shots/60 minutes, n games; some branches also retain summed numerator/denominator.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "source_state": "Assigned source paths remained clean at final git-status inspection.", "deployment": "Unknown; no live verification."}
- **Codex view (baseline-window-shooting_percentage, calculation, codex_part_of_opus; Codex family 'Baseline observed metric windows'):** shooting_percentage window statistics
  - Purpose: For each game, goals/shots using goals_5v5 fallback, clamped[0,1]; then arithmetic mean and sample SD floored at SIGMA_MIN. Numeric missing values route through safeNumber to0 in this implementation.
  - Inputs/units: Per-game observed counts/time/source rate fields; time denominators seconds unless specified.
  - Output scale: mu and sigma in fraction, n games; some branches also retain summed numerator/denominator.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "source_state": "Assigned source paths remained clean at final git-status inspection.", "deployment": "Unknown; no live verification."}
- **Codex view (baseline-window-shooting_percentage_5v5, calculation, codex_part_of_opus; Codex family 'Baseline observed metric windows'):** shooting_percentage_5v5 window statistics
  - Purpose: For each game, supplied shooting_percentage_5v5 clamped[0,1]; then arithmetic mean and sample SD floored at SIGMA_MIN. Numeric missing values route through safeNumber to0 in this implementation.
  - Inputs/units: Per-game observed counts/time/source rate fields; time denominators seconds unless specified.
  - Output scale: mu and sigma in fraction, n games; some branches also retain summed numerator/denominator.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "source_state": "Assigned source paths remained clean at final git-status inspection.", "deployment": "Unknown; no live verification."}
- **Codex view (baseline-window-shots, calculation, codex_part_of_opus; Codex family 'Baseline observed metric windows'):** shots window statistics
  - Purpose: For each game, numeric shots per game; then arithmetic mean and sample SD floored at SIGMA_MIN. Numeric missing values route through safeNumber to0 in this implementation.
  - Inputs/units: Per-game observed counts/time/source rate fields; time denominators seconds unless specified.
  - Output scale: mu and sigma in shots, n games; some branches also retain summed numerator/denominator.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "source_state": "Assigned source paths remained clean at final git-status inspection.", "deployment": "Unknown; no live verification."}
- **Codex view (web-lib-baselines-aggregations-buildbaselinepayload, symbol_candidate, codex_part_of_opus; Codex family 'Statistical baseline windows'):** Build baseline payload (buildBaselinePayload)
  - Purpose: Build baseline payload for statistical baseline windows. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: export function buildBaselinePayload(params: { player_id: string; season_id?: number \| null; snapshot_date: string; position_code?: string \| null; player_name?: string \| null; rows_all: GameRow[]; // all game logs newest->oldest last_season_totals?: Record<string, any> \| null; seasonTotals?: Record<string, any>[]; // per-player season totals, newest first }) { const { rows_all, last_season_totals, seasonTotals } = params; const win_l3 = buildWinFromRows(rows_all.slice(0, 3)); const win_l5 = buildWinFromRows(rows_all.slice(0, 5)); const win_l10 = buildWinFromRows(rows_all.slice(0, 10)); const win_l20 = buildWinFromRows(rows_all.slice(0, 20)); // season prev: copy last season totals but ensure fields exist and placeholders for stats
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (web-lib-baselines-aggregations-buildwindowpayload, symbol_candidate, codex_part_of_opus; Codex family 'Statistical baseline windows'):** Build window payload (buildWindowPayload)
  - Purpose: Build window payload for statistical baseline windows. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: export function buildWindowPayload(rows: GameRow[]): WindowPayload { // rows are ordered newest -> oldest or any; we treat as set const payload: WindowPayload = {}; // Helper to compute per-game or per-60 metrics // For metrics that require per-60, we need numerators and toi_seconds // example metrics mapping const metrics = [ // percentages "shooting_percentage", "shooting_percentage_5v5", "pp_shooting_percentage", // nst on-ice "nst_oi_shooting_pct", "nst_oi_save_pct", "nst_oi_pdo", "nst_ipp",
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (web-lib-baselines-aggregations-computeresiduals, calculation, codex_part_of_opus; Codex family 'Statistical baseline windows'):** Finishing residuals (computeResiduals)
  - Purpose: fin_res_level=goals-NST iXG; fin_res_rate_5v5=goals_per_60_5v5-NST iXG_per_60.
  - Inputs/units: Named model/observation inputs at cited declaration; Signed goals and goals/60 residuals. Input count/rate units follow the corresponding named outcome; cutoff timestamps and identity are required where declared.
  - Output scale: Signed goals and goals/60 residuals.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (web-lib-baselines-aggregations-pct, calculation, codex_part_of_opus; Codex family 'Statistical baseline windows'):** Success fraction (pct)
  - Purpose: success/trials, zero when nonpositive trials.
  - Inputs/units: Named model/observation inputs at cited declaration; Fraction, not ×100. Input count/rate units follow the corresponding named outcome; cutoff timestamps and identity are required where declared.
  - Output scale: Fraction, not ×100.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (web-lib-baselines-aggregations-per60, calculation, codex_part_of_opus; Codex family 'Statistical baseline windows'):** Per-60 rate (per60)
  - Purpose: 3600*numerator/TOI_seconds, zero when nonpositive denominator.
  - Inputs/units: Named model/observation inputs at cited declaration; Events per 60 minutes. Input count/rate units follow the corresponding named outcome; cutoff timestamps and identity are required where declared.
  - Output scale: Events per 60 minutes.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (web-lib-baselines-aggregations-samplestats, calculation, codex_part_of_opus; Codex family 'Statistical baseline windows'):** Window mean and sample deviation (sampleStats)
  - Purpose: Arithmetic mean; sample variance /(n-1); sigma floored at SIGMA_MIN.
  - Inputs/units: Named model/observation inputs at cited declaration; mu in metric units, sigma same units, n count. Input count/rate units follow the corresponding named outcome; cutoff timestamps and identity are required where declared.
  - Output scale: mu in metric units, sigma same units, n count.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (web-lib-baselines-aggregations-winsorize01, symbol_candidate, codex_part_of_opus; Codex family 'Statistical baseline windows'):** Winsorize01 (winsorize01)
  - Purpose: Winsorize01 for statistical baseline windows. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: export function winsorize01(x: number) { if (x === null \|\| x === undefined \|\| Number.isNaN(x)) return 0; return Math.max(0, Math.min(1, x)); }
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): Comment aggregations.ts:71-72; migration note 20250930_add_baseline_3yr_career.sql
  - Intended contract (Codex baseline-window-goals_per_60): {"source": "web/lib/baselines/aggregations.ts:92", "statement": "For each game, 3600*goals/total_TOI_seconds; then arithmetic mean and sample SD floored at SIGMA_MIN. Numeric missing values route through safeNumber to0 in this implementation."}
  - Intended contract (Codex baseline-window-nst_hdcf_per_60): {"source": "web/lib/baselines/aggregations.ts:89", "statement": "For each game, 3600*nst_hdcf/nst_toi_seconds; then arithmetic mean and sample SD floored at SIGMA_MIN. Numeric missing values route through safeNumber to0 in this implementation."}
  - Intended contract (Codex baseline-window-nst_icf_per_60): {"source": "web/lib/baselines/aggregations.ts:88", "statement": "For each game, 3600*nst_icf/nst_toi_seconds; then arithmetic mean and sample SD floored at SIGMA_MIN. Numeric missing values route through safeNumber to0 in this implementation."}
  - Intended contract (Codex baseline-window-nst_ipp): {"source": "web/lib/baselines/aggregations.ts:84", "statement": "For each game, numeric supplied individual point percentage values; then arithmetic mean and sample SD floored at SIGMA_MIN. Numeric missing values route through safeNumber to0 in this implementation."}
  - Intended contract (Codex baseline-window-nst_ixg): {"source": "web/lib/baselines/aggregations.ts:85", "statement": "For each game, numeric supplied individual expected goals; then arithmetic mean and sample SD floored at SIGMA_MIN. Numeric missing values route through safeNumber to0 in this implementation."}
  - Intended contract (Codex baseline-window-nst_ixg_per_60): {"source": "web/lib/baselines/aggregations.ts:87", "statement": "For each game, 3600*nst_ixg/nst_toi_seconds; then arithmetic mean and sample SD floored at SIGMA_MIN. Numeric missing values route through safeNumber to0 in this implementation."}
  - Intended contract (Codex baseline-window-nst_oi_cf_pct): {"source": "web/lib/baselines/aggregations.ts:97", "statement": "For each game, on-ice CF/(CF+CA), clamped[0,1]; then arithmetic mean and sample SD floored at SIGMA_MIN. Numeric missing values route through safeNumber to0 in this implementation."}
  - Intended contract (Codex baseline-window-nst_oi_pdo): {"source": "web/lib/baselines/aggregations.ts:83", "statement": "For each game, on-ice shooting fraction + on-ice save fraction; then arithmetic mean and sample SD floored at SIGMA_MIN. Numeric missing values route through safeNumber to0 in this implementation."}
  - Intended contract (Codex baseline-window-nst_oi_save_pct): {"source": "web/lib/baselines/aggregations.ts:82", "statement": "For each game, (on-ice SA-on-ice GA)/on-ice SA clamped[0,1]; then arithmetic mean and sample SD floored at SIGMA_MIN. Numeric missing values route through safeNumber to0 in this implementation."}
  - Intended contract (Codex baseline-window-nst_oi_scf_pct): {"source": "web/lib/baselines/aggregations.ts:98", "statement": "For each game, on-ice SCF/(SCF+SCA), clamped[0,1]; then arithmetic mean and sample SD floored at SIGMA_MIN. Numeric missing values route through safeNumber to0 in this implementation."}
  - Intended contract (Codex baseline-window-nst_oi_shooting_pct): {"source": "web/lib/baselines/aggregations.ts:81", "statement": "For each game, on-ice GF/on-ice shots for clamped[0,1]; then arithmetic mean and sample SD floored at SIGMA_MIN. Numeric missing values route through safeNumber to0 in this implementation."}
  - Intended contract (Codex baseline-window-nst_oi_xgf_pct): {"source": "web/lib/baselines/aggregations.ts:96", "statement": "For each game, on-ice xGF/(xGF+xGA), clamped[0,1]; then arithmetic mean and sample SD floored at SIGMA_MIN. Numeric missing values route through safeNumber to0 in this implementation."}
  - Intended contract (Codex baseline-window-nst_shots_per_60): {"source": "web/lib/baselines/aggregations.ts:100", "statement": "For each game, supplied NST shots-per60 (no recomputation); then arithmetic mean and sample SD floored at SIGMA_MIN. Numeric missing values route through safeNumber to0 in this implementation."}
  - Intended contract (Codex baseline-window-points_per_60): {"source": "web/lib/baselines/aggregations.ts:91", "statement": "For each game, 3600*points/total_TOI_seconds; then arithmetic mean and sample SD floored at SIGMA_MIN. Numeric missing values route through safeNumber to0 in this implementation."}
  - Intended contract (Codex baseline-window-points_per_60_5v5): {"source": "web/lib/baselines/aggregations.ts:90", "statement": "For each game, 3600*points_5v5/5v5_TOI_seconds; then arithmetic mean and sample SD floored at SIGMA_MIN. Numeric missing values route through safeNumber to0 in this implementation."}
  - Intended contract (Codex baseline-window-pp_goals_per_60): {"source": "web/lib/baselines/aggregations.ts:94", "statement": "For each game, 3600*pp_goals/pp_toi_seconds; then arithmetic mean and sample SD floored at SIGMA_MIN. Numeric missing values route through safeNumber to0 in this implementation."}
  - Intended contract (Codex baseline-window-pp_points_per_60): {"source": "web/lib/baselines/aggregations.ts:93", "statement": "For each game, 3600*pp_points/pp_toi_seconds; then arithmetic mean and sample SD floored at SIGMA_MIN. Numeric missing values route through safeNumber to0 in this implementation."}
  - Intended contract (Codex baseline-window-pp_shooting_percentage): {"source": "web/lib/baselines/aggregations.ts:79", "statement": "For each game, pp_goals/pp_shots clamped[0,1]; then arithmetic mean and sample SD floored at SIGMA_MIN. Numeric missing values route through safeNumber to0 in this implementation."}
  - Intended contract (Codex baseline-window-pp_shots_per_60): {"source": "web/lib/baselines/aggregations.ts:95", "statement": "For each game, 3600*pp_shots/pp_toi_seconds; then arithmetic mean and sample SD floored at SIGMA_MIN. Numeric missing values route through safeNumber to0 in this implementation."}
  - Intended contract (Codex baseline-window-shooting_percentage): {"source": "web/lib/baselines/aggregations.ts:77", "statement": "For each game, goals/shots using goals_5v5 fallback, clamped[0,1]; then arithmetic mean and sample SD floored at SIGMA_MIN. Numeric missing values route through safeNumber to0 in this implementation."}
  - Intended contract (Codex baseline-window-shooting_percentage_5v5): {"source": "web/lib/baselines/aggregations.ts:78", "statement": "For each game, supplied shooting_percentage_5v5 clamped[0,1]; then arithmetic mean and sample SD floored at SIGMA_MIN. Numeric missing values route through safeNumber to0 in this implementation."}
  - Intended contract (Codex baseline-window-shots): {"source": "web/lib/baselines/aggregations.ts:99", "statement": "For each game, numeric shots per game; then arithmetic mean and sample SD floored at SIGMA_MIN. Numeric missing values route through safeNumber to0 in this implementation."}
  - Intended contract (Codex web-lib-baselines-aggregations-buildbaselinepayload): {"source": "web/lib/baselines/aggregations.ts:517", "explicit_comment": "web/lib/baselines/aggregations.ts:534 season prev: copy last season totals but ensure fields exist and placeholders for stats", "arithmetic_locations": ["web/lib/baselines/aggregations.ts:588 ? (3600 * blend.numer) / Math.max(blend.denom, 1)", "web/lib/baselines/aggregations.ts:613 ? (3600 * careerNumer) / Math.max(careerDenom, 1)", "web/lib/baselines/aggregations.ts:615 ? careerNumer / careerDenom", "web/lib/baselines/aggregations.ts:636 s + safeNumber(r[m] ?? 0) * safeNumber(r.games_played ?? 0),", "web/lib/baselines/aggregations.ts:644 careerGames > 0 ? careerWeightedNumer / careerGames : 0;", "web/lib/baselines/aggregations.ts:679 ? (3600 * blend.numer) / Math.max(blend.denom, 1)", "web/lib/baselines/aggregations.ts:702 ? (3600 * careerNumer) / Math.max(careerDenom, 1)", "web/lib/baselines/aggregations.ts:704 ? careerNumer / careerDenom"]}
  - Intended contract (Codex web-lib-baselines-aggregations-buildwindowpayload): {"source": "web/lib/baselines/aggregations.ts:67", "explicit_comment": "web/lib/baselines/aggregations.ts:68 rows are ordered newest -> oldest or any; we treat as set", "arithmetic_locations": []}
  - Intended contract (Codex web-lib-baselines-aggregations-computeresiduals): {"source": "web/lib/baselines/aggregations.ts:52", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": []}
  - Intended contract (Codex web-lib-baselines-aggregations-pct): {"source": "web/lib/baselines/aggregations.ts:28", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["web/lib/baselines/aggregations.ts:30 return success / trials;"]}
  - Intended contract (Codex web-lib-baselines-aggregations-per60): {"source": "web/lib/baselines/aggregations.ts:23", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["web/lib/baselines/aggregations.ts:25 return (3600 * numer) / toi_seconds;"]}
  - Intended contract (Codex web-lib-baselines-aggregations-samplestats): {"source": "web/lib/baselines/aggregations.ts:33", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["web/lib/baselines/aggregations.ts:40 const mu = values.reduce((a, b) => a + b, 0) / n;", "web/lib/baselines/aggregations.ts:42 const variance = values.reduce((s, x) => s + (x - mu) ** 2, 0) / (n - 1);", "web/lib/baselines/aggregations.ts:43 const sigma = Math.max(Math.sqrt(variance), SIGMA_MIN);"]}
  - Intended contract (Codex web-lib-baselines-aggregations-winsorize01): {"source": "web/lib/baselines/aggregations.ts:47", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": []}
  - External references: NST rate conventions; ratio-of-sums vs mean-of-ratios
  - Fixtures/test data: none listed
  - Tests: `web/__tests__/baselines.aggregations.test.ts`; `web/__tests__/pages/api/v1/db/sustainability/rebuild-baselines.test.ts`; `{"status": "Discovered only; not run", "references": ["No direct symbol/module test reference found in bounded search."]}`; `{"status": "Discovered only; not run", "references": ["web/__tests__/baselines.aggregations.test.ts:4"]}`; `{"status": "Discovered only; not run", "references": ["web/__tests__/pages/rankings.test.tsx:1911", "web/components/SocialShare/SocialShare.test.tsx:194", "web/lib/projections/module-imports.test.ts:12", "web/lib/rosterScheduleOptimizer/planning.test.ts:875", "web/lib/socialShare/modules/goalieRescue.test.ts:27", "web/lib/socialShare/modules/lastNightsStandouts.test.ts:272", "web/lib/socialShare/modules/nightlyFloor.test.ts:20", "web/lib/socialShare/modules/offNightEdge.test.ts:34", "web/lib/socialShare/modules/shared/definitions.test.ts:6", "web/lib/socialShare/modules/teamStream.test.ts:38", "web/lib/socialShare/trends.test.ts:237", "web/lib/supabase/Upserts/rollingMetricScaleContract.test.ts:6"]}`; `{"status": "Discovered only; not run", "references": ["web/components/underlying-stats/teamStatsColumns.test.ts:392", "web/lib/buyLowSellHigh/currentWindows.test.ts:207", "web/lib/buyLowSellHigh/forecastEvaluation.test.ts:92", "web/lib/buyLowSellHigh/productionReference.test.ts:240", "web/lib/player-cards/analysisSnapshot.test.ts:21", "web/lib/projections/research/skater-candidates/accounting.test.ts:69", "web/lib/socialShare/modules/busyQuiet.test.ts:36", "web/lib/socialShare/modules/shared/definitions.test.ts:2", "web/lib/socialShare/modules/whatChanged.test.ts:62", "web/lib/underlying-stats/playerStatsFormatting.test.ts:65", "web/scripts/blsh/baselineEvaluation.test.ts:34"]}`; `{"status": "Discovered, not run", "references": ["No dedicated test source identified."]}`
- **Leads (not audited):**
  - (opus) mu is a mean of per-game ratios; games with 0 shots/TOI contribute 0 (not skipped), biasing sh%/per-60 means downward
  - (opus) shooting_percentage falls back to goals_5v5 when goals null; shooting_percentage_5v5 taken as stored rate
  - (opus) points_per_60/goals_per_60 divide by toi_per_game assumed seconds (WGO unit risk)
  - (opus) toi_sum override uses nst_toi \|\| toi_per_game (mixed sources)
  - (opus) rebuild-baselines.ts:248-256 fetches ALL game rows per player with no date<=snapshot_date filter, so a backfilled historical snapshot uses future games (look-ahead)
  - (codex:baseline-window-goals_per_60) ["No correctness/quality judgment. Active runtime and deployed version unknown."]
  - (codex:baseline-window-nst_hdcf_per_60) ["No correctness/quality judgment. Active runtime and deployed version unknown."]
  - (codex:baseline-window-nst_icf_per_60) ["No correctness/quality judgment. Active runtime and deployed version unknown."]
  - (codex:baseline-window-nst_ipp) ["No correctness/quality judgment. Active runtime and deployed version unknown."]
  - (codex:baseline-window-nst_ixg) ["No correctness/quality judgment. Active runtime and deployed version unknown."]
  - (codex:baseline-window-nst_ixg_per_60) ["No correctness/quality judgment. Active runtime and deployed version unknown."]
  - (codex:baseline-window-nst_oi_cf_pct) ["No correctness/quality judgment. Active runtime and deployed version unknown."]
  - (codex:baseline-window-nst_oi_pdo) ["No correctness/quality judgment. Active runtime and deployed version unknown."]
  - (codex:baseline-window-nst_oi_save_pct) ["No correctness/quality judgment. Active runtime and deployed version unknown."]
  - (codex:baseline-window-nst_oi_scf_pct) ["No correctness/quality judgment. Active runtime and deployed version unknown."]
  - (codex:baseline-window-nst_oi_shooting_pct) ["No correctness/quality judgment. Active runtime and deployed version unknown."]
  - (codex:baseline-window-nst_oi_xgf_pct) ["No correctness/quality judgment. Active runtime and deployed version unknown."]
  - (codex:baseline-window-nst_shots_per_60) ["No correctness/quality judgment. Active runtime and deployed version unknown."]
  - (codex:baseline-window-points_per_60) ["No correctness/quality judgment. Active runtime and deployed version unknown."]
  - (codex:baseline-window-points_per_60_5v5) ["No correctness/quality judgment. Active runtime and deployed version unknown."]
  - (codex:baseline-window-pp_goals_per_60) ["No correctness/quality judgment. Active runtime and deployed version unknown."]
  - (codex:baseline-window-pp_points_per_60) ["No correctness/quality judgment. Active runtime and deployed version unknown."]
  - (codex:baseline-window-pp_shooting_percentage) ["No correctness/quality judgment. Active runtime and deployed version unknown."]
  - (codex:baseline-window-pp_shots_per_60) ["No correctness/quality judgment. Active runtime and deployed version unknown."]
  - (codex:baseline-window-shooting_percentage) ["No correctness/quality judgment. Active runtime and deployed version unknown."]
  - (codex:baseline-window-shooting_percentage_5v5) ["No correctness/quality judgment. Active runtime and deployed version unknown."]
  - (codex:baseline-window-shots) ["No correctness/quality judgment. Active runtime and deployed version unknown."]
  - (codex:web-lib-baselines-aggregations-buildbaselinepayload) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:web-lib-baselines-aggregations-buildwindowpayload) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:web-lib-baselines-aggregations-computeresiduals) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested."]
  - (codex:web-lib-baselines-aggregations-pct) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested."]
  - (codex:web-lib-baselines-aggregations-per60) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested."]
  - (codex:web-lib-baselines-aggregations-samplestats) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested."]
  - (codex:web-lib-baselines-aggregations-winsorize01) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-SUS-004 3-year blended and career baselines

- **Match:** Both; Opus SUS-012; Codex sql-player-baseline-sample, web-lib-baselines-aggregations-buildbaselinepayload, web-lib-baselines-aggregations-computeblendfromseasons
- **Purpose:** Per-player 3-season weighted rate and career aggregate per metric.
- **Where:** `web/lib/baselines/aggregations.ts:462 (computeBlendFromSeasons)`; `web/lib/baselines/aggregations.ts:517 (buildBaselinePayload win_3yr/win_career/win_season_prev)`; `web/lib/baselines/config.ts:23 (metricAllowlist)`; `migrations/20250930_add_baseline_3yr_career.sql:6 (player_baselines_3yr MV)`; `migrations/20250930_add_baseline_3yr_career.sql:8 player_baselines_3yr`; `web/lib/baselines/aggregations.ts:517 buildBaselinePayload`; `web/lib/baselines/aggregations.ts:462 computeBlendFromSeasons`
- **Tags (heuristic):** generation: current
- **Opus view (SUS-012):**
  - Method: Top-3 seasons weights 0.6/0.3/0.1 (not renormalised). With numer/denom keys: blended=Σw*num/Σw*den; time denominators -> 3600*num/den. Career=Σnum/Σden. Without denom key: numer=Σw*rate, denom=Σw*games_played, result=numer/denom; career=Σ(rate*GP)/ΣGP. sigma set to SIGMA_MIN placeholder. win_season_prev = copy of newest season totals. SQL MV computes the same 0.6/0.3/0.1 blend for nst_ixg/nst_toi plus career sums.
  - Inputs/units: season totals; toi seconds; sources: player_totals_unified
  - Output scale: metric units; writes: player_baselines (win_3yr, win_career, win_season_prev), player_baselines_3yr (materialized view, illustrative)
  - Status: unknown — /api/v1/db/sustainability/rebuild-baselines listed in web/pages/api/v1/db/cron-report.ts:82 but not in web/vercel.json; player_baselines read by windows.loadPlayersForSnapshot and entitySurfaceServer
  - Consumers: entitySurfaceServer career comparisons; dataJoins
- **Codex view (sql-player-baseline-sample, calculation, location; Codex family 'Illustrative SQL baseline'):** player_baselines_3yr
  - Purpose: Demonstrate latest-three weighted ixG/TOI and career sums.
  - Inputs/units: player_totals_unified season ixG and TOI; newest seasons
  - Output scale: blended_nst_ixg and blended_nst_toi with .6/.3/.1 weights; missing seasons coalesce0; career sums of ixG and TOI.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
- **Codex view (web-lib-baselines-aggregations-buildbaselinepayload, symbol_candidate, location; Codex family 'Statistical baseline windows'):** Build baseline payload (buildBaselinePayload)
  - Purpose: Build baseline payload for statistical baseline windows. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: export function buildBaselinePayload(params: { player_id: string; season_id?: number \| null; snapshot_date: string; position_code?: string \| null; player_name?: string \| null; rows_all: GameRow[]; // all game logs newest->oldest last_season_totals?: Record<string, any> \| null; seasonTotals?: Record<string, any>[]; // per-player season totals, newest first }) { const { rows_all, last_season_totals, seasonTotals } = params; const win_l3 = buildWinFromRows(rows_all.slice(0, 3)); const win_l5 = buildWinFromRows(rows_all.slice(0, 5)); const win_l10 = buildWinFromRows(rows_all.slice(0, 10)); const win_l20 = buildWinFromRows(rows_all.slice(0, 20)); // season prev: copy last season totals but ensure fields exist and placeholders for stats
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (web-lib-baselines-aggregations-computeblendfromseasons, calculation, location; Codex family 'Statistical baseline windows'):** Three-season numerator/exposure blend (computeBlendFromSeasons)
  - Purpose: Weights .6/.3/.1 on newest three season numerator and denominator; rate=weighted numerator/weighted denominator.
  - Inputs/units: Named model/observation inputs at cited declaration; Blended numerator, denominator, rate. Input count/rate units follow the corresponding named outcome; cutoff timestamps and identity are required where declared.
  - Output scale: Blended numerator, denominator, rate.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): Migration header 20250930_add_baseline_3yr_career.sql:1-4 ('sample migration ... illustrative')
  - Intended contract (Codex sql-player-baseline-sample): File explicitly says sample/illustrative migration and demonstration, not production writer.
  - Intended contract (Codex web-lib-baselines-aggregations-buildbaselinepayload): {"source": "web/lib/baselines/aggregations.ts:517", "explicit_comment": "web/lib/baselines/aggregations.ts:534 season prev: copy last season totals but ensure fields exist and placeholders for stats", "arithmetic_locations": ["web/lib/baselines/aggregations.ts:588 ? (3600 * blend.numer) / Math.max(blend.denom, 1)", "web/lib/baselines/aggregations.ts:613 ? (3600 * careerNumer) / Math.max(careerDenom, 1)", "web/lib/baselines/aggregations.ts:615 ? careerNumer / careerDenom", "web/lib/baselines/aggregations.ts:636 s + safeNumber(r[m] ?? 0) * safeNumber(r.games_played ?? 0),", "web/lib/baselines/aggregations.ts:644 careerGames > 0 ? careerWeightedNumer / careerGames : 0;", "web/lib/baselines/aggregations.ts:679 ? (3600 * blend.numer) / Math.max(blend.denom, 1)", "web/lib/baselines/aggregations.ts:702 ? (3600 * careerNumer) / Math.max(careerDenom, 1)", "web/lib/baselines/aggregations.ts:704 ? careerNumer / careerDenom"]}
  - Intended contract (Codex web-lib-baselines-aggregations-computeblendfromseasons): {"source": "web/lib/baselines/aggregations.ts:462", "explicit_comment": "web/lib/baselines/aggregations.ts:467 seasons: array of season-level totals (newest first or any order)", "arithmetic_locations": ["web/lib/baselines/aggregations.ts:503 blendedNumer += w * numer;", "web/lib/baselines/aggregations.ts:504 blendedDenom += w * denom;", "web/lib/baselines/aggregations.ts:509 ? blendedNumer / blendedDenom", "web/lib/baselines/aggregations.ts:512 ? blendedNumer / blendedDenom"]}
  - External references: Marcel weighted multi-season baselines
  - Fixtures/test data: none listed
  - Tests: `web/__tests__/baselines.aggregations.test.ts`; `web/__tests__/pages/api/v1/db/sustainability/rebuild-baselines.test.ts`; `{"discovered_not_run": []}`; `{"status": "Discovered only; not run", "references": ["web/__tests__/baselines.aggregations.test.ts:3"]}`; `{"status": "Discovered only; not run", "references": ["web/__tests__/baselines.aggregations.test.ts:4"]}`
- **Leads (not audited):**
  - (opus) no-denominator fallback divides a weighted RATE by weighted games played (result = rate/GP), e.g. nst_ipp/oiPDO/xGF% 3yr values are scaled wrong
  - (opus) seasonTotals[0] is the CURRENT season, so 'season_prev' and the 0.6 weight both point at the in-progress season; career includes current season
  - (opus) shooting_percentage_5v5 map uses goals_5v5/shots (all-situations shots); nst_shots_per_60 uses WGO shots / NST toi — mixed sources
  - (opus) 3yr/career sigma is a 1e-6 placeholder, so any z against these would explode
  - (opus) unused curr/last/prev2 sums (dead code); SQL MV is illustrative (comment) and snapshot_date=now()
  - (codex:sql-player-baseline-sample) Definition exists locally; applied migration/live view shape, data freshness and runtime consumer use unknown.
  - (codex:web-lib-baselines-aggregations-buildbaselinepayload) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:web-lib-baselines-aggregations-computeblendfromseasons) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested."]

## M-SUS-005 Power-play share controls (smoothed PP share, PP1 hysteresis, band widen)

- **Match:** Both; Opus SUS-013; Codex web-lib-baselines-aggregations-computeppcontrols
- **Purpose:** Detect PP deployment shifts to widen bands.
- **Where:** `web/lib/baselines/config.ts:1 (deploymentElasticity)`; `web/lib/baselines/aggregations.ts:391 (computePPControls)`; `web/pages/api/v1/db/sustainability/rebuild-baselines.ts:315 (ppRefShare)`; `web/lib/baselines/aggregations.ts:391 computePPControls`
- **Tags (heuristic):** percent scale: fraction 0-1; generation: current
- **Opus view (SUS-013):**
  - Method: teamPP seconds = pp_toi/share; drop games with team PP<90s (fallback keep all). share_sm=0.6*mean(L10)+0.3*mean(L20)+0.1*ref; delta=sm-ref; rel=clamp(delta/max(ref,1e-6),±1); PP1 hysteresis enter .62 / exit .58 (threshold .65); band_widen=1+0.75*\|rel\|.
  - Inputs/units: share fraction; seconds; sources: player_stats_unified, player_totals_unified
  - Output scale: share 0-1; factor >=1; writes: player_baselines (pp_* columns)
  - Status: unknown — /api/v1/db/sustainability/rebuild-baselines listed in web/pages/api/v1/db/cron-report.ts:82 but not in web/vercel.json; player_baselines read by windows.loadPlayersForSnapshot and entitySurfaceServer
  - Consumers: (no downstream reader of band_widen_factor found)
- **Codex view (web-lib-baselines-aggregations-computeppcontrols, calculation, location; Codex family 'Statistical baseline windows'):** PP-share smoothing and uncertainty controls (computePPControls)
  - Purpose: Smooth L10/L20/prior PP share, relative change capped; PP1 hysteresis and 1+varianceAlpha*abs(relative change) band multiplier.
  - Inputs/units: Named model/observation inputs at cited declaration; pp_share_sm/ref/delta/rel, PP1 flags, dimensionless band_widen_factor. Input count/rate units follow the corresponding named outcome; cutoff timestamps and identity are required where declared.
  - Output scale: pp_share_sm/ref/delta/rel, PP1 flags, dimensionless band_widen_factor.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): Comments aggregations.ts:395-446
  - Intended contract (Codex web-lib-baselines-aggregations-computeppcontrols): {"source": "web/lib/baselines/aggregations.ts:391", "explicit_comment": "web/lib/baselines/aggregations.ts:395 recentRows ordered newest->oldest", "arithmetic_locations": ["web/lib/baselines/aggregations.ts:400 return share > 0 ? ppTOI / Math.max(share, 1e-6) : 0;", "web/lib/baselines/aggregations.ts:411 arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;", "web/lib/baselines/aggregations.ts:420 const meanL10 = mean(l10_vals);", "web/lib/baselines/aggregations.ts:421 const meanL20 = mean(l20_vals);", "web/lib/baselines/aggregations.ts:429 const pp_share_sm = w10 * meanL10 + w20 * meanL20 + wLast * ref;", "web/lib/baselines/aggregations.ts:436 pp_share_delta / Math.max(pp_share_ref, 1e-6)", "web/lib/baselines/aggregations.ts:449 1 + deploymentElasticity.varianceAlpha * Math.abs(pp_share_rel);"]}
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/__tests__/baselines.aggregations.test.ts`; `web/__tests__/pages/api/v1/db/sustainability/rebuild-baselines.test.ts`; `{"status": "Discovered only; not run", "references": ["No direct symbol/module test reference found in bounded search."]}`
- **Leads (not audited):**
  - (opus) ref share = current newest season's pp_toi_pct_of_team (scale 0-1 vs 0-100 unverified) while game shares are winsorised to [0,1]
  - (opus) triggerRelChange/triggerAbsDelta/meanBeta/varianceOnly config unused
  - (opus) hysteresis uses ref as previous state rather than stored prior PP1 flag
  - (codex:web-lib-baselines-aggregations-computeppcontrols) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested."]

## M-SUS-006 Trend-band baselines (3-season weighted per-60 / percentage / normal)

- **Match:** Both; Opus SUS-014; Codex core-072
- **Purpose:** Player baseline per metric from up to 4 most recent season totals with 0.6/0.3/0.1 weights.
- **Where:** `web/lib/sustainability/bandCalculator.ts:79 (SEASON_WEIGHTS)`; `web/lib/sustainability/bandCalculator.ts:109 (getSeasonWeights)`; `web/lib/sustainability/bandCalculator.ts:122 (computeBaselinePer60)`; `web/lib/sustainability/bandCalculator.ts:145 (computeBaselinePercentage)`; `web/lib/sustainability/bandCalculator.ts:168 (computeBaselineNormal)`; `web/lib/sustainability/bandCalculator.ts:373 (baselineForMetric)`; `web/lib/sustainability/bandService.ts:146 (fetchSeasonTotals limit 4)`; `web/lib/sustainability/bandCalculator.ts:373 baselineForMetric`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: per 60, per game; generation: current
- **Opus view (SUS-014):**
  - Method: Seasons sorted desc; weights [0.6,0.3,0.1,0] renormalised to sum 1 over available rows. Per-60: 60*sum(w*count)/sum(w*minutes). Percentage: sum(w*succ)/sum(w*trials) (ipp trials nst_oi_gf fallback es_goals_for; sv%=(SA-GA)/SA). Normal pp_toi_pct exposure-weighted by games. PDO baseline fixed 1.0. fantasy_score baseline=weighted mean of per-game FP (FHFH skater default config).
  - Inputs/units: TOI seconds in totals (/60 to minutes); percentages fraction or 0-100 normalised if >1; sources: player_totals_unified
  - Output scale: baseline in metric units; writes: —
  - Status: live — vercel.json cron rebuild-trend-bands (limit 250, offsets 0-750); read by /api/v1/sustainability/trend-bands, entity-bands, pages/trendsSandbox.tsx
  - Consumers: computeTrendBandsForPlayer
- **Codex view (core-072, calculation, location; Codex family 'sustainability bands'):** Three-season rate/percentage/normal baselines
  - Formula: Recency season weights; pooled weighted counts/exposure for rates; normal weighted means; metric fallback rules.
  - Purpose: Calculate three-season rate/percentage/normal baselines.
  - Inputs/units: Player season totals with metric-specific denominators.
  - Output scale: Per 60, fraction, or native baseline.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f; sustainability_trend_bands_v2. Deployment/data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final status check.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex core-072): Implementation/type declarations and adjacent comments in web/lib/sustainability/bandCalculator.ts:373; approval beyond source not established.
  - External references: Marcel-style weighted multi-season baseline
  - Fixtures/test data: none listed
  - Tests: `Located only; not run for this inventory.`; `web/__tests__/pages/api/v1/sustainability/rebuild-trend-bands.test.ts`; `web/__tests__/pages/api/v1/sustainability/trend-bands.test.ts`; `web/lib/sustainability/bandCalculator.test.ts`
- **Leads (not audited):**
  - (opus) fetchSeasonTotals takes the latest 4 seasons INCLUDING the current season, which gets weight 0.6 — the baseline contains the games being compared (leakage), and history mode uses future seasons for past snapshots
  - (opus) shots/hits/blocks per60 baseline uses toi_all_situations while window samples use nst_toi (fallback toi_per_game*60) — mixed TOI sources
  - (opus) ipp trials fallback es_goals_for (team even-strength GF?) differs from nst_oi_gf
  - (opus) PDO baseline hard-coded 1.0 but nst_oi_pdo may be on a 100 scale -> value≫baseline
  - (opus) 4th season has weight 0 (fetched but unused)
  - (codex:core-072) ["Inventory only; no correctness or calibration verdict."]

## M-SUS-007 Trend-band comparison deltas vs L5/L10/L20/season/career

- **Match:** Both; Opus SUS-015; Codex MISC-SURFACEDELTA
- **Purpose:** Percent difference of current band value against rolling/season/career references for the sandbox.
- **Where:** `web/lib/sustainability/entitySurfaceServer.ts:276 (computeDeltaPct)`; `web/lib/sustainability/entitySurfaceServer.ts:289 (SKATER_BASELINE_METRIC_KEYS)`; `web/lib/sustainability/entitySurfaceServer.ts:366 (resolveBaselineBucketValue)`; `web/lib/sustainability/entitySurfaceServer.ts:399 (buildBandHistoryComparisonLookup)`; `web/lib/sustainability/entitySurfaceServer.ts:424 (buildBandComparisons)`; `web/lib/sustainability/entitySurfaceServer.ts:276 computeDeltaPct`
- **Tags (heuristic):** denominators: 5v5 only; generation: current
- **Opus view (SUS-015):**
  - Method: deltaPct=100*(current-ref)/\|ref\| (null if ref 0). Skater refs from player_baselines buckets (mu) with candidate column lists (e.g. sh_pct -> shooting_percentage then shooting_percentage_5v5); fallback = simple average of the last 5/10/20 stored band values; season = average of all stored band values.
  - Inputs/units: metric units; sources: player_baselines, sustainability_trend_bands, entity_sustainability_bands_daily
  - Output scale: percent delta; writes: —
  - Status: live — /api/v1/sustainability/entity-bands used by pages/trendsSandbox.tsx
  - Consumers: /api/v1/sustainability/entity-bands; trendsSandbox
- **Codex view (MISC-SURFACEDELTA, calculation, location; Codex family 'Other product calculations'):** Sustainability surface comparison delta
  - Purpose: Express signed relative movement from a comparison value.
  - Inputs/units: Finite current and nonzero comparison scalar in same units.
  - Output scale: 100*(current−comparison)/abs(comparison), percent; unavailable for invalid/zero comparison.
  - Version/status: Surface helper. Production deployment/active database state not checked.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex MISC-SURFACEDELTA): Absolute denominator preserves signed movement when baseline is negative.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/sustainability/entitySurfaceServer.test.ts`
- **Leads (not audited):**
  - (opus) history averages are averages of already-smoothed band values (average of EWMAs), not raw L-n rates
  - (opus) sh_pct band (fraction) vs baseline shooting_percentage (fraction from aggregations) OK, but falls back to shooting_percentage_5v5 — mixed strength
  - (opus) on_ice_sv_pct/pdo baselines keyed to nst_oi_save_pct/nst_oi_pdo; pdo baseline in player_baselines is sh+sv (≈1.0 scale) while band may be 100-scale
  - (codex:MISC-SURFACEDELTA) No mathematical accuracy or fitness assessment performed. Tests listed, not run.

## M-SUS-008 Sustainability backtest metrics (MAE/RMSE/bias, Brier, band hit rate)

- **Match:** Both; Opus SUS-017; Codex core-066, core-109, core-110
- **Purpose:** Score projections against actuals and naive baselines.
- **Where:** `web/lib/sustainability/backtest.ts:72 (resolveNaivePrediction)`; `web/lib/sustainability/backtest.ts:95 (runSustainabilityBaselineBacktest)`; `web/lib/sustainability/backtest.ts:179 (runSustainabilityProbabilityBacktest)`; `web/lib/sustainability/features.ts:859 (evaluateBandCalibration)`; `web/lib/sustainability/backtestHarness.ts:56 (runHistoricalSustainabilityBacktest)`; `web/lib/sustainability/features.ts:859 evaluateBandCalibration`; `web/lib/sustainability/backtest.ts:95 runSustainabilityBaselineBacktest`; `web/lib/sustainability/backtest.ts:179 runSustainabilityProbabilityBacktest`
- **Tags (heuristic):** generation: development
- **Opus view (SUS-017):**
  - Method: Variants sustainability_score, career_only, season_only, recent_only, naive_blend(mean of available career/season/recent). MAE, RMSE, bias=mean(pred-actual). bestByMae. Brier over 3 classes summed (Σ_k (p_k-y_k)^2 per example) vs uniform 1/3. Band hit rates 50%/80%.
  - Inputs/units: metric units; sources: sustainability_projections (projection_type=snapshot)
  - Output scale: error metrics; writes: —
  - Status: draft — harness only, no caller beyond tests
  - Consumers: (no route found)
- **Codex view (core-066, calculation, location; Codex family 'sustainability features'):** Band empirical coverage
  - Formula: Fraction actuals within inclusive bounds.
  - Purpose: Calculate band empirical coverage.
  - Inputs/units: Forecast intervals and actuals.
  - Output scale: Sample counts, 50% and 80% hit proportions.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f; TypeScript sustainability family; canonical runtime per functions/lib/sustainability/README.md. Deployment/data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry…
- **Codex view (core-109, calculation, location; Codex family 'sustainability evaluation'):** Baseline projection comparison
  - Formula: Aggregate residual absolute/square/signed errors on comparable rows.
  - Purpose: Calculate baseline projection comparison.
  - Inputs/units: Actuals and current, naive, rolling baseline predictions.
  - Output scale: Per-model MAE/RMSE/bias and sample counts.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f; TypeScript sustainability family; canonical runtime per functions/lib/sustainability/README.md. Deployment/data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry…
- **Codex view (core-110, calculation, location; Codex family 'sustainability evaluation'):** Multiclass Brier backtest
  - Formula: Mean over examples of sum across cold/normal/hot classes of (probability-oneHotOutcome)^2; uniform probability 1/3.
  - Purpose: Compare class-probability forecasts with a uniform baseline.
  - Inputs/units: Three-class probabilities and actual class.
  - Output scale: Brier score and sample count for model and uniform predictions.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f; TypeScript sustainability family; canonical runtime per functions/lib/sustainability/README.md. Deployment/data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry…
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex core-066): Implementation/type declarations and adjacent comments in web/lib/sustainability/features.ts:859; approval beyond source not established.
  - Intended contract (Codex core-109): Implementation/type declarations and adjacent comments in web/lib/sustainability/backtest.ts:95; approval beyond source not established.
  - Intended contract (Codex core-110): Implementation/type declarations and adjacent comments in web/lib/sustainability/backtest.ts:179; approval beyond source not established.
  - External references: Forecast verification (MAE/RMSE, Brier score, interval coverage)
  - Fixtures/test data: none listed
  - Tests: `Located only; not run for this inventory.`; `web/lib/sustainability/backtest.test.ts`; `web/lib/sustainability/backtestHarness.test.ts`; `web/lib/sustainability/features.test.ts`
- **Leads (not audited):**
  - (opus) each variant scored on its own non-null subset — bestByMae compares different samples
  - (opus) resolveExample (actual) supplied by caller; no production wiring found
  - (codex:core-066) ["Inventory only; no correctness or calibration verdict."]
  - (codex:core-109) ["Inventory only; no correctness or calibration verdict."]
  - (codex:core-110) ["Inventory only; no correctness or calibration verdict."]

## M-SUS-009 Feature helpers: per-60, per-game, z-score, window weights, weighted rate

- **Match:** Both; Opus SUS-019; Codex core-052, core-053, core-054, core-055
- **Purpose:** Generic rate and standardisation helpers for the sustainability feature layer.
- **Where:** `web/lib/sustainability/features.ts:248 (calculatePer60Rate)`; `web/lib/sustainability/features.ts:259 (calculatePerGameRate)`; `web/lib/sustainability/features.ts:298 (calculateZScore)`; `web/lib/sustainability/features.ts:375 (normalizeWindowWeights)`; `web/lib/sustainability/features.ts:401 (getDefaultWindowWeights)`; `web/lib/sustainability/features.ts:411 (calculateWeightedRate)`; `web/lib/sustainability/features.ts:248 calculatePer60Rate`; `web/lib/sustainability/features.ts:298 calculateZScore`; `web/lib/sustainability/features.ts:375 normalizeWindowWeights`; `web/lib/sustainability/features.ts:411 calculateWeightedRate`
- **Tags (heuristic):** denominators: per 60, per game; generation: legacy
- **Opus view (SUS-019):**
  - Method: per60=total*3600/toiSeconds; perGame=total/GP; z=(raw-baseline)/max(sd,sdFloor 1e-6), optional clip; default window weights l3 1, l5 0.8, l10 0.55, l20 0.35 normalised (last entry gets remainder); weighted rate=Σrate*w/Σw.
  - Inputs/units: TOI seconds; counts; sources: —
  - Output scale: per-60 / per-game / z; writes: —
  - Status: legacy/dead — only pages/trendsDebug.tsx and tests import model/features exports (rg)
  - Consumers: model.ts (feature engineering); trendsDebug page
- **Codex view (core-052, calculation, codex_part_of_opus; Codex family 'sustainability features'):** Per60 and per-game rates
  - Formula: 3600*total/seconds or total/games; nonpositive exposure null.
  - Purpose: Calculate per 60 and per-game rates.
  - Inputs/units: Counts, TOI seconds or games.
  - Output scale: Count per 60 minutes or count/game.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f; TypeScript sustainability family; canonical runtime per functions/lib/sustainability/README.md. Deployment/data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry…
- **Codex view (core-053, calculation, codex_part_of_opus; Codex family 'sustainability features'):** Generic standardized deviation
  - Formula: delta=raw-baseline; z=delta/max(SD, 1e-6); optional symmetric clip.
  - Purpose: Calculate generic standardized deviation.
  - Inputs/units: Raw, baseline, SD same units; floor and optional clip.
  - Output scale: Native delta; dimensionless z.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f; TypeScript sustainability family; canonical runtime per functions/lib/sustainability/README.md. Deployment/data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry…
- **Codex view (core-054, calculation, codex_part_of_opus; Codex family 'sustainability features'):** Window weight normalization
  - Formula: Normalize positive finite weights; last allocation = 1 - prior allocations.
  - Purpose: Calculate window weight normalization.
  - Inputs/units: Positive window weights.
  - Output scale: Weights sum 1, 6 decimals.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f; TypeScript sustainability family; canonical runtime per functions/lib/sustainability/README.md. Deployment/data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry…
- **Codex view (core-055, calculation, location; Codex family 'sustainability features'):** Weighted window rate
  - Formula: sum(rate*weight)/sum(valid weights).
  - Purpose: Calculate weighted window rate.
  - Inputs/units: Rates by window and positive weights.
  - Output scale: Same-unit blended rate; applied weight.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f; TypeScript sustainability family; canonical runtime per functions/lib/sustainability/README.md. Deployment/data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry…
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex core-052): Implementation/type declarations and adjacent comments in web/lib/sustainability/features.ts:248; approval beyond source not established.
  - Intended contract (Codex core-053): Implementation/type declarations and adjacent comments in web/lib/sustainability/features.ts:298; approval beyond source not established.
  - Intended contract (Codex core-054): Implementation/type declarations and adjacent comments in web/lib/sustainability/features.ts:375; approval beyond source not established.
  - Intended contract (Codex core-055): Implementation/type declarations and adjacent comments in web/lib/sustainability/features.ts:411; approval beyond source not established.
  - External references: NST per-60 convention
  - Fixtures/test data: none listed
  - Tests: `Located only; not run for this inventory.`; `web/lib/sustainability/features.test.ts`
- **Leads (not audited):**
  - (opus) no production caller found for window weights / weighted rate (only tests and debug page)
  - (codex:core-052) ["Inventory only; no correctness or calibration verdict."]
  - (codex:core-053) ["Inventory only; no correctness or calibration verdict."]
  - (codex:core-054) ["Inventory only; no correctness or calibration verdict."]
  - (codex:core-055) ["Inventory only; no correctness or calibration verdict."]

## M-SUS-010 Usage and context deltas (TOI, PDO, on-ice SH%, OZS%)

- **Match:** Both; Opus SUS-020; Codex core-060, core-061
- **Purpose:** Absolute and percent change of recent vs baseline usage/context metrics.
- **Where:** `web/lib/sustainability/features.ts:603 (calculateUsageDelta)`; `web/lib/sustainability/features.ts:633 (calculateUsageDeltas)`; `web/lib/sustainability/features.ts:655 (calculateContextDelta)`; `web/lib/sustainability/features.ts:694 (calculateContextFeatures)`; `web/lib/sustainability/features.ts:603 calculateUsageDelta`; `web/lib/sustainability/features.ts:694 calculateContextFeatures`
- **Tags (heuristic):** generation: legacy
- **Opus view (SUS-020):**
  - Method: abs=recent-baseline; pct=100*abs/\|baseline\| (null if 0); percentages >1 divided by 100 when normalizePercent (on_ice_sh_pct, ozs_pct; not pdo).
  - Inputs/units: fraction or percent; sources: —
  - Output scale: delta / percent; writes: —
  - Status: legacy/dead — debug page only
  - Consumers: (debug page only)
- **Codex view (core-060, calculation, location; Codex family 'sustainability features'):** TOI and PP usage deltas
  - Formula: recent-baseline; 100*delta/abs(baseline); 0 baseline percentage null.
  - Purpose: Calculate toi and pp usage deltas.
  - Inputs/units: Recent/baseline usage same units.
  - Output scale: Absolute and percentage change.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f; TypeScript sustainability family; canonical runtime per functions/lib/sustainability/README.md. Deployment/data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry…
- **Codex view (core-061, calculation, location; Codex family 'sustainability features'):** PDO/on-iceSH/OZ-start context deltas
  - Formula: Normalize percentage-like fields; recent-baseline; 100delta/abs(base).
  - Purpose: Calculate pdo/on-icesh/oz-start context deltas.
  - Inputs/units: Recent/baseline PDO and percentages.
  - Output scale: Native delta and relative percent.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f; TypeScript sustainability family; canonical runtime per functions/lib/sustainability/README.md. Deployment/data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry…
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex core-060): Implementation/type declarations and adjacent comments in web/lib/sustainability/features.ts:603; approval beyond source not established.
  - Intended contract (Codex core-061): Implementation/type declarations and adjacent comments in web/lib/sustainability/features.ts:694; approval beyond source not established.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `Located only; not run for this inventory.`; `web/lib/sustainability/features.test.ts`
- **Leads (not audited):**
  - (opus) >1 heuristic to detect 0-100 scale misclassifies 1% values (0.01 vs 1)
  - (codex:core-060) ["Inventory only; no correctness or calibration verdict."]
  - (codex:core-061) ["Inventory only; no correctness or calibration verdict."]

## M-SUS-011 Python finishing residuals (goals - ixG)

- **Match:** Both; Opus SUS-021; Codex core-117
- **Purpose:** Offline count and per-shot finishing residual with SD standardisation.
- **Where:** `functions/lib/sustainability/finishing.py:40 (annotate_finishing_residuals)`; `functions/lib/sustainability/finishing.py:40 annotate_finishing_residuals`
- **Tags (heuristic):** generation: legacy, research
- **Opus view (SUS-021):**
  - Method: finish_res_cnt=goals-ixg; finish_res_rate=(goals-ixg)/shots; expectation 0; z=res/SD (cnt F 1.5 D 1.25; rate F .20 D .18); r=1 if z present.
  - Inputs/units: counts; sources: —
  - Output scale: goals; z; writes: —
  - Status: legacy/dead (offline research only) — functions/lib/sustainability/README.md: 'offline-only and non-canonical'; persistence raises OfflinePersistenceDisabledError
  - Consumers: run_full_scoring_pipeline (toggle use_finishing_residuals)
- **Codex view (core-117, calculation, location; Codex family 'sustainability Python legacy'):** Finishing count/rate residuals
  - Formula: Subtract xG; divide by shots if positive; expectation 0; z=residual/sigma.
  - Purpose: Calculate finishing count/rate residuals.
  - Inputs/units: Goals, individual xG, shots, position SD.
  - Output scale: G-ixG count; (G-ixG)/shot; z; reliability.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f; Offline-only and noncanonical per functions/lib/sustainability/README.md; persistence/orchestration fail closed. Deployment/data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untra…
- **Audit context:**
  - Intent (Opus): finishing.py docstring:1-31
  - Intended contract (Codex core-117): Implementation/type declarations and adjacent comments in functions/lib/sustainability/finishing.py:40; approval beyond source not established.
  - External references: Goals above expected vs MoneyPuck/Evolving-Hockey xG
  - Fixtures/test data: none listed
  - Tests: `Located only; not run for this inventory.`; `functions/tests/test_finishing.py`
- **Leads (not audited):**
  - (opus) count residual SD fixed regardless of window length (GAME vs STD)
  - (opus) reliability forced to 1
  - (codex:core-117) ["Inventory only; no correctness or calibration verdict."]

## M-SUS-012 Finishing residuals in baselines (goals - ixG)

- **Match:** Both; Opus SUS-022; Codex web-lib-baselines-aggregations-computeresiduals, web-lib-baselines-aggregations-winsorize01
- **Purpose:** Per-game finishing over/under expectation.
- **Where:** `web/lib/baselines/aggregations.ts:52 (computeResiduals)`; `web/lib/baselines/aggregations.ts:52 computeResiduals`; `web/lib/baselines/aggregations.ts:47 winsorize01`
- **Tags (heuristic):** denominators: per 60, per game, 5v5 only; generation: current
- **Opus view (SUS-022):**
  - Method: fin_res_level = goals - nst_ixg per game; fin_res_rate_5v5 = goals_per_60_5v5 - nst_ixg_per_60; window mu/sigma via sampleStats.
  - Inputs/units: counts; per-60; sources: player_stats_unified
  - Output scale: goals or goals/60; writes: player_baselines
  - Status: unknown — /api/v1/db/sustainability/rebuild-baselines listed in web/pages/api/v1/db/cron-report.ts:82 but not in web/vercel.json; player_baselines read by windows.loadPlayersForSnapshot and entitySurfaceServer
  - Consumers: (metricAllowlist hi; no 3yr numer/denom map)
- **Codex view (web-lib-baselines-aggregations-computeresiduals, calculation, location; Codex family 'Statistical baseline windows'):** Finishing residuals (computeResiduals)
  - Purpose: fin_res_level=goals-NST iXG; fin_res_rate_5v5=goals_per_60_5v5-NST iXG_per_60.
  - Inputs/units: Named model/observation inputs at cited declaration; Signed goals and goals/60 residuals. Input count/rate units follow the corresponding named outcome; cutoff timestamps and identity are required where declared.
  - Output scale: Signed goals and goals/60 residuals.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (web-lib-baselines-aggregations-winsorize01, symbol_candidate, location; Codex family 'Statistical baseline windows'):** Winsorize01 (winsorize01)
  - Purpose: Winsorize01 for statistical baseline windows. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: export function winsorize01(x: number) { if (x === null \|\| x === undefined \|\| Number.isNaN(x)) return 0; return Math.max(0, Math.min(1, x)); }
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex web-lib-baselines-aggregations-computeresiduals): {"source": "web/lib/baselines/aggregations.ts:52", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": []}
  - Intended contract (Codex web-lib-baselines-aggregations-winsorize01): {"source": "web/lib/baselines/aggregations.ts:47", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": []}
  - External references: Goals above expected (GAx) vs MoneyPuck/Evolving-Hockey xG
  - Fixtures/test data: none listed
  - Tests: `web/__tests__/baselines.aggregations.test.ts`; `web/__tests__/pages/api/v1/db/sustainability/rebuild-baselines.test.ts`; `{"status": "Discovered only; not run", "references": ["No direct symbol/module test reference found in bounded search."]}`
- **Leads (not audited):**
  - (opus) fin_res_rate_5v5 subtracts a (likely all-situations) NST ixG/60 from a 5v5 goals/60 — mixed strengths
  - (opus) missing values coerced to 0, so a game without NST ixG counts as goals above expected
  - (codex:web-lib-baselines-aggregations-computeresiduals) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested."]
  - (codex:web-lib-baselines-aggregations-winsorize01) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-SUS-013 Python player multi-season posterior

- **Match:** Both; Opus SUS-024; Codex core-113
- **Purpose:** Offline 0.6/0.3/0.1 blended player posterior mean.
- **Where:** `functions/lib/sustainability/player_priors.py:76 (compute_player_posteriors)`; `functions/lib/sustainability/player_priors.py:76 compute_player_posteriors`
- **Tags (heuristic):** percent scale: fraction 0-1; generation: legacy, research
- **Opus view (SUS-024):**
  - Method: Seasons target, target-1, target-2 (integer subtraction on season id) weighted 0.6/0.3/0.1 renormalised over available; alpha_post=alpha0+Σw s, beta_post=beta0+max(Σw t-Σw s,0); post_mean. Rookie if no earlier season.
  - Inputs/units: counts; sources: —
  - Output scale: fraction 0-1; writes: —
  - Status: legacy/dead (offline research only) — functions/lib/sustainability/README.md: 'offline-only and non-canonical'; persistence raises OfflinePersistenceDisabledError
  - Consumers: annotate_zscores
- **Codex view (core-113, calculation, location; Codex family 'sustainability Python legacy'):** Player prior-season Beta posterior
  - Formula: Normalize available-season weights; blend counts; alpha0+s, beta0+max(n-s, 0).
  - Purpose: Calculate player prior-season beta posterior.
  - Inputs/units: Target season plus two prior seasons; recency weights 0.6/0.3/0.1; league Beta prior.
  - Output scale: Posterior mean and rookie flag.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f; Offline-only and noncanonical per functions/lib/sustainability/README.md; persistence/orchestration fail closed. Deployment/data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untra…
- **Audit context:**
  - Intent (Opus): functions/lib/sustainability/README.md (offline, non-canonical; TS is canonical)
  - Intended contract (Codex core-113): Implementation/type declarations and adjacent comments in functions/lib/sustainability/player_priors.py:76; approval beyond source not established.
  - External references: Beta-binomial EB / Marcel
  - Fixtures/test data: none listed
  - Tests: `Located only; not run for this inventory.`; `functions/tests/test_player_priors.py`
- **Leads (not audited):**
  - (opus) includes the TARGET season itself in the blend (TS uses only completed prior seasons)
  - (opus) season ids decremented by 1 (target_season-1) — wrong for NHL 8-digit ids like 20252026 (should be -10001)
  - (codex:core-113) ["Inventory only; no correctness or calibration verdict."]

## M-SUS-014 Python league Beta priors

- **Match:** Both; Opus SUS-025; Codex core-112
- **Purpose:** Offline league Beta prior per season/position/metric.
- **Where:** `functions/lib/sustainability/priors.py:85 (compute_league_beta_priors)`; `functions/lib/sustainability/priors.py:85 compute_league_beta_priors`
- **Tags (heuristic):** percent scale: fraction 0-1; generation: legacy, research
- **Opus view (SUS-025):**
  - Method: mu=s/t; if s>t (IPP) set t=s; clamp mu [0,1]; alpha0=mu*k, beta0=(1-mu)*k with k=cfg.k_r[metric] (default config sh_pct 50, oish_pct 150, ipp 30); non-positive alpha/beta -> 0.5; t=0 -> Beta(1,1), mu 0.
  - Inputs/units: counts; sources: (db_client.fetch_league_aggregates stub)
  - Output scale: Beta params; writes: —
  - Status: legacy/dead (offline research only) — functions/lib/sustainability/README.md: 'offline-only and non-canonical'; persistence raises OfflinePersistenceDisabledError
  - Consumers: compute_player_posteriors
- **Codex view (core-112, calculation, location; Codex family 'sustainability Python legacy'):** League Beta priors
  - Formula: mu=s/n; alpha=mu*k, beta=(1-mu)*k; boundary fallback .5; zero trials use Beta(1, 1).
  - Purpose: Calculate league beta priors.
  - Inputs/units: Position aggregate successes/trials and configured k.
  - Output scale: alpha, beta, league fraction.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f; Offline-only and noncanonical per functions/lib/sustainability/README.md; persistence/orchestration fail closed. Deployment/data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untra…
- **Audit context:**
  - Intent (Opus): functions/lib/sustainability/README.md (offline, non-canonical; TS is canonical); docstring priors.py:1-27
  - Intended contract (Codex core-112): Implementation/type declarations and adjacent comments in functions/lib/sustainability/priors.py:85; approval beyond source not established.
  - External references: Beta-binomial EB
  - Fixtures/test data: none listed
  - Tests: `Located only; not run for this inventory.`; `functions/tests/test_priors.py`
- **Leads (not audited):**
  - (opus) k_r 50/150/30 vs TS route k 200/800/60 — two incompatible prior strengths for the same metrics
  - (opus) k reused as both prior strength and reliability constant (docstring says harmonised by design)
  - (codex:core-112) ["Inventory only; no correctness or calibration verdict."]

## M-SUS-015 Empirical-Bayes linear shrinkage (gamma / beta) for features

- **Match:** Both; Opus SUS-026; Codex core-056, core-057
- **Purpose:** Shrink observed per-60 or proportion toward a prior mean by exposure.
- **Where:** `web/lib/sustainability/features.ts:160 (DEFAULT_EB_PRIOR_STRENGTH)`; `web/lib/sustainability/features.ts:442 (empiricalBayesGammaShrink)`; `web/lib/sustainability/features.ts:479 (empiricalBayesBetaShrink)`; `web/lib/sustainability/features.ts:516 (empiricalBayesShrinkForMetric)`; `web/lib/sustainability/features.ts:442 empiricalBayesGammaShrink`; `web/lib/sustainability/features.ts:479 empiricalBayesBetaShrink`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: per 60; generation: legacy
- **Opus view (SUS-026):**
  - Method: observed=count/exposure*60 (gamma) or s/n (beta); sampleWeight=exposure/(exposure+k); shrunk=sw*observed+(1-sw)*prior. Default k: goals60 180, assists60 220, shots60/ixg60 360, scf60/hdcf60 360, ipp 50.
  - Inputs/units: minutes (gamma) / trials (beta); sources: —
  - Output scale: shrunk rate; writes: —
  - Status: legacy/dead — no non-test caller found
  - Consumers: (no production caller)
- **Codex view (core-056, calculation, location; Codex family 'sustainability features'):** Gamma-style empirical-Bayes rate shrinkage
  - Formula: observed=60*count/exposure; weight=exposure/(exposure+prior strength); blend.
  - Purpose: Calculate gamma-style empirical-bayes rate shrinkage.
  - Inputs/units: Count, exposure minutes, prior mean per 60, prior strength minutes.
  - Output scale: Observed/shrunk per 60; sample weight 0..1.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f; TypeScript sustainability family; canonical runtime per functions/lib/sustainability/README.md. Deployment/data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry…
- **Codex view (core-057, calculation, location; Codex family 'sustainability features'):** Beta-style empirical-Bayes rate shrinkage
  - Formula: weight=n/(n+k); shrunk=weight*s/n+(1-weight)*prior.
  - Purpose: Calculate beta-style empirical-bayes rate shrinkage.
  - Inputs/units: Successes/trials, prior fraction and pseudo-trials.
  - Output scale: Observed/shrunk fraction; sample weight 0..1.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f; TypeScript sustainability family; canonical runtime per functions/lib/sustainability/README.md. Deployment/data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry…
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex core-056): Implementation/type declarations and adjacent comments in web/lib/sustainability/features.ts:442; approval beyond source not established.
  - Intended contract (Codex core-057): Implementation/type declarations and adjacent comments in web/lib/sustainability/features.ts:479; approval beyond source not established.
  - External references: Tango regression to mean; Beta-binomial EB
  - Fixtures/test data: none listed
  - Tests: `Located only; not run for this inventory.`; `web/lib/sustainability/features.test.ts`
- **Leads (not audited):**
  - (opus) gamma variant treats exposure as minutes (×60) while calculatePer60Rate uses seconds — unit convention differs within same file
  - (codex:core-056) ["Inventory only; no correctness or calibration verdict."]
  - (codex:core-057) ["Inventory only; no correctness or calibration verdict."]

## M-SUS-016 Rookie / low-trial prior strengthening fallback

- **Match:** Both; Opus SUS-027; Codex core-048
- **Purpose:** Inflate prior strength for players with few historical trials so they lean further on the position league mean.
- **Where:** `web/lib/sustainability/priors.ts:22 (ROOKIE_FALLBACK_MIN_TRIALS)`; `web/lib/sustainability/priors.ts:351 (applyPositionLeagueFallback)`; `web/lib/sustainability/priors.ts:351 applyPositionLeagueFallback`
- **Tags (heuristic):** generation: current
- **Opus view (SUS-027):**
  - Method: Threshold T per stat: shp 100, oishp 150, ipp 40, ppshp 25 trials. If n<T: missingShare=(T-n)/T; boostedK=(alpha0+beta0)*(1+missingShare) (max 2x); keep mu=alpha0/K; re-derive alpha0,beta0 via betaFromMuK.
  - Inputs/units: trials (shots / on-ice shots / on-ice GF / PP shots); sources: sustainability_priors
  - Output scale: Beta parameters; writes: —
  - Status: live — vercel.json cron 10:42-10:4x UTC daily (rebuild-priors 42 10, rebuild-window-z 43 10, rebuild-score ...); read by /api/v1/sustainability/trends used on pages/FORGE.tsx and components/forge-dashboard/SustainabilityCard.tsx
  - Consumers: upsertPlayerPosteriors
- **Codex view (core-048, calculation, location; Codex family 'sustainability priors'):** Sparse-history position fallback strength
  - Formula: missingShare=(threshold-max(n, 0))/threshold; kBoost=k*(1+missingShare); preserve mean.
  - Purpose: Calculate sparse-history position fallback strength.
  - Inputs/units: Prior, stat-specific minTrials, actual trials.
  - Output scale: Boosted pseudo-trials, fallback weight 0..1.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f; TypeScript sustainability family; canonical runtime per functions/lib/sustainability/README.md. Deployment/data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry…
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED (name suggests position-league fallback for rookies)
  - Intended contract (Codex core-048): Implementation/type declarations and adjacent comments in web/lib/sustainability/priors.ts:351; approval beyond source not established.
  - External references: Credibility theory / Tango regression (prior weight vs sample)
  - Fixtures/test data: none listed
  - Tests: `Located only; not run for this inventory.`; `web/lib/sustainability/priors.test.ts`
- **Leads (not audited):**
  - (opus) magic thresholds 100/150/40/25 undocumented; fallback_weight/adjusted_k computed but not persisted
  - (codex:core-048) ["Inventory only; no correctness or calibration verdict."]

## M-SUS-017 Player 3-season blended Beta posterior (player priors)

- **Match:** Both; Opus SUS-028; Codex core-046, core-047
- **Purpose:** Shrink each current-season player's own last-three-completed-season rates to the league Beta prior to get a personal baseline.
- **Where:** `web/lib/sustainability/priors.ts:49 (getHistorySeasonIds)`; `web/lib/sustainability/priors.ts:125 (fetchPlayerSeasonCounts)`; `web/lib/sustainability/priors.ts:295 (blendCounts)`; `web/lib/sustainability/priors.ts:324 (betaPosterior)`; `web/lib/sustainability/priors.ts:425 (upsertPlayerPosteriors)`; `web/lib/sustainability/priors.ts:295 blendCounts`; `web/lib/sustainability/priors.ts:324 betaPosterior`
- **Tags (heuristic):** percent scale: fraction 0-1; generation: current
- **Opus view (SUS-028):**
  - Method: History seasons = three completed seasons before current (seasonId-10001 offsets). blendCounts: s_blend=sum(w_i*s_i), n_blend=sum(w_i*n_i) with fixed w=[0.6,0.3,0.1] most-recent first, NOT renormalised when seasons missing. Rookie fallback applied first (see separate entry). Posterior alpha=alpha0+s, beta=beta0+(n-s); post_mean=alpha/(alpha+beta); post_var=ab/((a+b)^2(a+b+1)). If n<=0 returns prior. Mixed-position players forced to F.
  - Inputs/units: counts; sources: player_totals_unified, sustainability_priors
  - Output scale: Beta posterior; post_mean fraction 0-1; writes: sustainability_player_priors (player_id, season_id, position_group, stat_code, ...)
  - Status: live — vercel.json cron 10:42-10:4x UTC daily (rebuild-priors 42 10, rebuild-window-z 43 10, rebuild-score ...); read by /api/v1/sustainability/trends used on pages/FORGE.tsx and components/forge-dashboard/SustainabilityCard.tsx (same rebuild-priors call)
  - Consumers: fetchPlayerPosteriors -> rebuildBetaWindowZForSnapshot (own-history baseline)
- **Codex view (core-046, calculation, location; Codex family 'sustainability priors'):** Prior-season blended binomial counts
  - Formula: .6 recent+.3 previous+.1 oldest; unnormalized missing seasons.
  - Purpose: Calculate prior-season blended binomial counts.
  - Inputs/units: Success/trial totals SH%, on-ice SH%, IPP, PP SH% over 3 previous seasons.
  - Output scale: Weighted success/trial counts.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f; TypeScript sustainability family; canonical runtime per functions/lib/sustainability/README.md. Deployment/data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry…
- **Codex view (core-047, calculation, location; Codex family 'sustainability priors'):** Personal Beta posterior mean and variance
  - Formula: alpha=alpha0+s; beta=beta0+n-s; mean=a/(a+b); var=ab/((a+b)^2(a+b+1)).
  - Purpose: Calculate personal beta posterior mean and variance.
  - Inputs/units: Prior alpha/beta and blended successes/trials.
  - Output scale: Posterior alpha, beta, mean fraction, variance.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f; TypeScript sustainability family; canonical runtime per functions/lib/sustainability/README.md. Deployment/data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry…
- **Audit context:**
  - Intent (Opus): Comment windows.ts:127 'Each player's pre-season Beta posterior per stat (their last three completed seasons, shrunk to the league prior)'; PRD tasks/TASKS/three-pillars-analytics/sustainability/prd/prd-sustainability-model.md
  - Intended contract (Codex core-046): Implementation/type declarations and adjacent comments in web/lib/sustainability/priors.ts:295; approval beyond source not established.
  - Intended contract (Codex core-047): Implementation/type declarations and adjacent comments in web/lib/sustainability/priors.ts:324; approval beyond source not established.
  - External references: Beta-binomial empirical Bayes; Marcel-style 5/4/3 season weighting (here 6/3/1)
  - Fixtures/test data: none listed
  - Tests: `Located only; not run for this inventory.`; `web/__tests__/pages/api/v1/sustainability/rebuild-priors.test.ts`; `web/lib/sustainability/priors.test.ts`
- **Leads (not audited):**
  - (opus) weights not renormalised when a season is missing (Python player_priors.py renormalises) — missing seasons silently shrink harder
  - (opus) n_effective written = blended trials, not an effective sample size
  - (opus) posterior from history seasons is shrunk to a league prior computed from the CURRENT season (season mismatch)
  - (opus) inline __sanity() at priors.ts:511 runs at import time (side effect)
  - (codex:core-046) ["Inventory only; no correctness or calibration verdict."]
  - (codex:core-047) ["Inventory only; no correctness or calibration verdict."]

## M-SUS-018 League Beta priors per position (shp, oishp, ipp, ppshp)

- **Match:** Both; Opus SUS-029; Codex core-045
- **Purpose:** Build league-level Beta(alpha0,beta0) priors for luck-type rate stats by position group.
- **Where:** `web/lib/sustainability/priors.ts:54 (fetchLeagueMeans)`; `web/lib/sustainability/priors.ts:110 (betaFromMuK)`; `web/lib/sustainability/priors.ts:383 (upsertLeaguePriors)`; `web/pages/api/v1/sustainability/rebuild-priors.ts:47 (k defaults)`; `web/lib/sustainability/priors.ts:110 betaFromMuK`
- **Tags (heuristic):** percent scale: fraction 0-1; generation: current
- **Opus view (SUS-029):**
  - Method: Pooled league means over all F (C/L/R/LW/RW) or D rows of ONE season: shp=sum(goals)/sum(shots); oishp=sum(nst_oi_gf)/sum(nst_oi_sf); ipp=sum(points)/sum(nst_oi_gf); ppshp=sum(pp_goals)/sum(pp_shots) (0 if denominator 0). alpha0=max(mu*k,1e-9), beta0=max((1-mu)*k,1e-9). Route defaults k: shp 200, oishp 800, ipp 60; ppshp falls back to 80 inside upsertLeaguePriors (function default 200 for others).
  - Inputs/units: counts (season totals); rates as fraction 0-1; sources: player_totals_unified
  - Output scale: Beta parameters; league_mu fraction 0-1; writes: sustainability_priors (season_id, position_group, stat_code, k, league_mu, alpha0, beta0)
  - Status: live — vercel.json cron 10:42-10:4x UTC daily (rebuild-priors 42 10, rebuild-window-z 43 10, rebuild-score ...); read by /api/v1/sustainability/trends used on pages/FORGE.tsx and components/forge-dashboard/SustainabilityCard.tsx (rebuild-priors?season=current&limit=2000 at 42 10 * * *)
  - Consumers: upsertPlayerPosteriors; rebuildBetaWindowZForSnapshot (fallback prior); rebuild-window-z route
- **Codex view (core-045, calculation, location; Codex family 'sustainability priors'):** Position league Beta priors
  - Formula: alpha=max(mu*k, EPS); beta=max((1-mu)*k, EPS); fallback at nonpositive k.
  - Purpose: Calculate position league beta priors.
  - Inputs/units: League fraction mu; prior pseudo-trial strength k.
  - Output scale: Positive alpha0, beta0.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f; TypeScript sustainability family; canonical runtime per functions/lib/sustainability/README.md. Deployment/data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry…
- **Audit context:**
  - Intent (Opus): Comment priors.ts:53 'aggregate league means (pooled) for a season + position group'; PRD tasks/TASKS/three-pillars-analytics/sustainability/prd/prd-sustainability-model.md
  - Intended contract (Codex core-045): Implementation/type declarations and adjacent comments in web/lib/sustainability/priors.ts:110; approval beyond source not established.
  - External references: Beta-binomial empirical Bayes; Tango regression-to-mean (k = league-average stabilization constant, e.g. sh% ~ 375 shots in community estimates)
  - Fixtures/test data: none listed
  - Tests: `Located only; not run for this inventory.`; `web/__tests__/pages/api/v1/sustainability/rebuild-priors.test.ts`; `web/lib/sustainability/priors.test.ts`
- **Leads (not audited):**
  - (opus) league mean is computed from the CURRENT season passed in (season=current in cron), so early-season priors rest on a few weeks of data and include the windows later compared against them
  - (opus) IPP mu = points/on-ice GF can exceed 1 if points include games without NST on-ice rows; betaFromMuK then floors beta0 at 1e-9 (no Python-style guard expanding trials)
  - (opus) k values (200/800/60/80) are hand-set in the route; Python config uses k_r 50/150/30 — inconsistent definitions
  - (opus) mixed sources — WGO goals/shots/points vs NST on-ice GF/SF; strength scope of nst_oi_* columns assumed all-situations
  - (codex:core-045) ["Inventory only; no correctness or calibration verdict."]

## M-SUS-019 Opponent adjustment factors (defense score, rate multipliers)

- **Match:** Both; Opus SUS-030; Codex core-062
- **Purpose:** Scale a player's per-60 rate for the opponent's defensive strength.
- **Where:** `web/lib/sustainability/features.ts:170 (OPPONENT_BASELINES)`; `web/lib/sustainability/features.ts:726 (deriveOpponentAdjustmentFactors)`; `web/lib/sustainability/data.ts:106 (per60)`; `web/lib/sustainability/data.ts:113 (mapOpponentStrengthRecord)`; `web/lib/sustainability/data.ts:151 (getOpponentStrengths)`; `web/lib/sustainability/features.ts:726 deriveOpponentAdjustmentFactors`
- **Tags (heuristic):** denominators: per 60; generation: current
- **Opus view (SUS-030):**
  - Method: per60=total*60/toi (toi in minutes). sampleWeight=GP/(GP+25). Edges vs baselines xGA60 2.6, CA60 55, HDCA60 10, sv% .905, pkTier 16: xgaEdge=clamp((x-2.6)/2.6,±.25), caEdge ±.2, hdcaEdge ±.25, saveEdge=clamp((.905-sv)/.905,±.04), pkEdge=clamp((16-tier)/16,±1). defenseScore=sw*(.35xga+.15ca+.25hdca+1.4save+.08pk). shotMult=clamp(1+sw*(.18xga+.14ca),.85,1.15); goalMult=clamp(1+sw*(.16xga+.22hdca+1.8save+.05pk),.8,1.2); assistMult=clamp(1+sw*(.12xga+.08ca+.04pk),.85,1.15).
  - Inputs/units: team totals; toi minutes; sv fraction; pk tier; sources: nst_team_all (situation=all), nst_team_stats (fallback), team_power_ratings_daily (pk_tier)
  - Output scale: multipliers ~0.8-1.2; defenseScore small signed; writes: —
  - Status: live — used by /api/v1/sustainability/recompute projection rows (cron status not confirmed in vercel.json)
  - Consumers: projectCountMetric; recompute.buildProjectionRows (opponent_game rows)
- **Codex view (core-062, calculation, location; Codex family 'sustainability features'):** Opponent defense/shot/goal/assist adjustment
  - Formula: w=GP/(GP+25); weighted capped deviations from OPPONENT_BASELINES; exact coefficients in source lines 726–780.
  - Purpose: Calculate opponent defense/shot/goal/assist adjustment.
  - Inputs/units: Opponent games, xGA60, CA60, HDCA60, SV fraction, PK tier.
  - Output scale: Sample weight, defenseScore; shot/assist multipliers .85..1.15; goal .8..1.2.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f; TypeScript sustainability family; canonical runtime per functions/lib/sustainability/README.md. Deployment/data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry…
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex core-062): Implementation/type declarations and adjacent comments in web/lib/sustainability/features.ts:726; approval beyond source not established.
  - External references: Opponent-adjusted projections (e.g. Evolving-Hockey/NST team-defence adjustments)
  - Fixtures/test data: none listed
  - Tests: `Located only; not run for this inventory.`; `web/lib/sustainability/data.test.ts`; `web/lib/sustainability/features.test.ts`
- **Leads (not audited):**
  - (opus) pk_tier in team_power_ratings_daily is a 1-3 tier (dashboard/invariants.ts:47) but baseline is 16 (rank scale) — pkEdge always ~+0.8-0.94, so every opponent looks like a weak PK
  - (opus) sv_pct scale unchecked (0-1 vs 0-100); a 0-100 value would pin saveEdge at -0.04
  - (opus) all coefficients and caps are magic numbers; league baselines (2.6 xGA60, 55 CA60) hard-coded rather than season-derived
  - (opus) data.ts season fallback uses month>=7 rule while entitySurfaceServer uses month>=8 (Sept) — inconsistent season boundaries
  - (codex:core-062) ["Inventory only; no correctness or calibration verdict."]

## M-SUS-020 Count projections (Poisson / NB normal-approx bands, 5/10-game horizons)

- **Match:** Both; Opus SUS-031; Codex core-103
- **Possible related records (low-confidence location link, unconfirmed):** core-063, core-064, core-065
- **Purpose:** Project per-game and multi-game totals for goals, assists, points, shots, PPP, hits, blocks.
- **Where:** `web/lib/sustainability/model.ts:740 (projectCountMetric)`; `web/lib/sustainability/features.ts:782 (buildCountDistribution)`; `web/lib/sustainability/features.ts:813 (aggregateCountDistributions)`; `web/lib/sustainability/features.ts:848 (emitForecastBands)`; `web/lib/sustainability/recompute.ts:58 (normalizeToiSeconds)`; `web/lib/sustainability/recompute.ts:109 (buildProjectionRows)`; `web/lib/sustainability/model.ts:740 projectCountMetric`
- **Tags (heuristic):** denominators: per 60, per game; generation: current
- **Opus view (SUS-031):**
  - Method: toiSeconds = toi_per_game if >180 else ×60. ratePer60 = perGame*3600/toi; adjusted rate = rate × opponent multiplier; expectedPerGame = rate*toi/3600. Poisson: var=mean, p10/p90 = mean ∓1.2816*sqrt(mean) floored 0. NB: var=mean+disp*mean^2. Horizon h: totalMean=h*mean; bands 50% (±0.6745 sd) and 80% (±1.2816 sd) normal approximation, floored 0. Horizons 5,10 (snapshot) and 1 per upcoming game (≤10).
  - Inputs/units: toi seconds (heuristic); per-game rates; sources: wgo_skater_stats, rosters, players, schedule (getUpcomingOpponents)
  - Output scale: counts per horizon; bands; writes: sustainability_projections
  - Status: live — /api/v1/sustainability/recompute (process-recompute-queue); cron schedule not found in vercel.json
  - Consumers: /api/v1/sustainability/player/[playerId]; /api/v1/sustainability/upcoming/[playerId]; backtestHarness
- **Codex view (core-103, calculation, codex_part_of_opus; Codex family 'sustainability model utilities'):** Opponent-adjusted count projection
  - Formula: Adjustedrate=rate*opponentmultiplier; expected=adjustedrate*seconds/3600; aggregate count distributions.
  - Purpose: Calculate opponent-adjusted count projection.
  - Inputs/units: Rate per 60, TOI seconds, opponent context, distribution, horizon of 5 or 10 games by default.
  - Output scale: Expected per game and horizon counts/bands.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f; Separate helper model from canonical buildScoreForPlayerWindow logistic-score writer; runtime activation of trained probabilities not verified. Deployment/data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementa…
- **Audit context:**
  - Intent (Opus): SQL check constraints web/sql/sustainability/001_create_sustainability_projections.sql:43-66 (horizon 1-10, band ordering)
  - Intended contract (Codex core-103): Implementation/type declarations and adjacent comments in web/lib/sustainability/model.ts:740; approval beyond source not established.
  - External references: Poisson goal/point models; negative binomial overdispersion
  - Fixtures/test data: none listed
  - Tests: `Located only; not run for this inventory.`; `web/__tests__/pages/api/v1/sustainability/recompute.test.ts`; `web/lib/sustainability/model.test.ts`; `web/lib/sustainability/recompute.test.ts`
- **Leads (not audited):**
  - (opus) rate is derived from per-game and converted back with the same TOI, so the snapshot projection is just season-to-date per-game × horizon (no sustainability adjustment)
  - (opus) 'Poisson quantiles' are normal approximations — poor for small means (e.g. goals ~0.3/game)
  - (opus) toi>180 heuristic to guess seconds vs minutes
  - (opus) pp_points/GP uses season pp_points from same cumulative row
  - (codex:core-103) ["Inventory only; no correctness or calibration verdict."]

## M-SUS-021 Faceoff win% projection bands

- **Match:** Both; Opus SUS-032; Codex core-104
- **Purpose:** Binomial normal-approx bands on faceoff win% over horizons.
- **Where:** `web/lib/sustainability/model.ts:807 (projectFaceoffWinPct)`; `web/lib/sustainability/model.ts:807 projectFaceoffWinPct`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: per game; generation: legacy
- **Opus view (SUS-032):**
  - Method: wins/game=p*attempts; var=p(1-p)/(attempts*h); band50 ±0.6745 sd, band80 ±1.2816 sd, clamped [0,1].
  - Inputs/units: fraction 0-1; attempts; sources: —
  - Output scale: fraction 0-1; writes: —
  - Status: legacy/dead — debug page only
  - Consumers: pages/trendsDebug.tsx
- **Codex view (core-104, calculation, location; Codex family 'sustainability model utilities'):** Faceoff win percentage projection
  - Formula: Expected wins=p*attempts; rate variance=p*(1-p)/attempts; horizon attempts=games*attemptsPerGame.
  - Purpose: Calculate faceoff win percentage projection.
  - Inputs/units: Win probability fraction, faceoff attempts per game, and horizon in games.
  - Output scale: Expected wins, win probability fraction, and 50%/80% rate intervals.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f; Separate helper model from canonical buildScoreForPlayerWindow logistic-score writer; runtime activation of trained probabilities not verified. Deployment/data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementa…
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex core-104): Implementation/type declarations and adjacent comments in web/lib/sustainability/model.ts:807; approval beyond source not established.
  - External references: Binomial proportion CI (Wald)
  - Fixtures/test data: none listed
  - Tests: `Located only; not run for this inventory.`; `web/lib/sustainability/model.test.ts`
- **Leads (not audited):**
  - (opus) Wald interval with no shrinkage
  - (codex:core-104) ["Inventory only; no correctness or calibration verdict."]

## M-SUS-022 Python reliability, soft clipping and contributions

- **Match:** Both; Opus SUS-033; Codex core-115, core-116, core-118
- **Purpose:** Offline r=sqrt(n/(n+k)), tanh clipping, weighted contribution sum.
- **Where:** `functions/lib/sustainability/reliability.py:28 (compute_reliability)`; `functions/lib/sustainability/clipping.py:20 (apply_soft_clipping)`; `functions/lib/sustainability/contributions.py:18 (compute_contributions)`; `functions/lib/sustainability/reliability.py:28 compute_reliability`; `functions/lib/sustainability/clipping.py:20 apply_soft_clipping`; `functions/lib/sustainability/contributions.py:18 compute_contributions`
- **Tags (heuristic):** denominators: per 60; generation: legacy, research
- **Opus view (SUS-033):**
  - Method: r=sqrt(n/(n+k_r)); zc=tanh(z/c), c=3; contrib_m=w_m*r_m*zc_m; contrib_total=Σ. Default weights sh_pct -1.2, oish_pct -1.0, oisv_pct -0.8, ipp -0.8, finish_res_rate -0.6, finish_res_cnt -0.4, ixg_per60 0.9, icf_per60 0.7, hdcf_per60 0.6.
  - Inputs/units: trials; z; sources: —
  - Output scale: contrib (dimensionless); writes: —
  - Status: legacy/dead (offline research only) — functions/lib/sustainability/README.md: 'offline-only and non-canonical'; persistence raises OfflinePersistenceDisabledError
  - Consumers: apply_logistic_scoring
- **Codex view (core-115, calculation, location; Codex family 'sustainability Python legacy'):** Reliability factor
  - Formula: sqrt(n/(n+k)); missing/negative n becomes 0.
  - Purpose: Calculate reliability factor.
  - Inputs/units: Trials n and metric calibration k.
  - Output scale: r in [0,1].
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f; Offline-only and noncanonical per functions/lib/sustainability/README.md; persistence/orchestration fail closed. Deployment/data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untra…
- **Codex view (core-116, calculation, location; Codex family 'sustainability Python legacy'):** Soft clipped z
  - Formula: tanh(z/c).
  - Purpose: Calculate soft clipped z.
  - Inputs/units: z and positive c, default 3.
  - Output scale: zc (-1, 1).
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f; Offline-only and noncanonical per functions/lib/sustainability/README.md; persistence/orchestration fail closed. Deployment/data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untra…
- **Codex view (core-118, calculation, location; Codex family 'sustainability Python legacy'):** Weighted contributions
  - Formula: weight*r*zSource; sum available contributions.
  - Purpose: Calculate weighted contributions.
  - Inputs/units: Metric weights, reliability, clipped/raw z.
  - Output scale: Per-metric and total contribution.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f; Offline-only and noncanonical per functions/lib/sustainability/README.md; persistence/orchestration fail closed. Deployment/data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untra…
- **Audit context:**
  - Intent (Opus): functions/lib/sustainability/README.md (offline, non-canonical; TS is canonical); reliability.py docstring
  - Intended contract (Codex core-115): Implementation/type declarations and adjacent comments in functions/lib/sustainability/reliability.py:28; approval beyond source not established.
  - Intended contract (Codex core-116): Implementation/type declarations and adjacent comments in functions/lib/sustainability/clipping.py:20; approval beyond source not established.
  - Intended contract (Codex core-118): Implementation/type declarations and adjacent comments in functions/lib/sustainability/contributions.py:18; approval beyond source not established.
  - External references: Spearman-Brown reliability; Tango
  - Fixtures/test data: none listed
  - Tests: `Located only; not run for this inventory.`; `functions/tests/test_clipping.py`; `functions/tests/test_contributions.py`; `functions/tests/test_reliability.py`
- **Leads (not audited):**
  - (opus) tanh(z/3) compresses z to (-1,1) so contribution scale is ~1/3 of TS hard-clip version
  - (codex:core-115) ["Inventory only; no correctness or calibration verdict."]
  - (codex:core-116) ["Inventory only; no correctness or calibration verdict."]
  - (codex:core-118) ["Inventory only; no correctness or calibration verdict."]

## M-SUS-023 Python logistic scoring, components and quintiles

- **Match:** Both; Opus SUS-034; Codex core-119, core-120
- **Purpose:** Offline 0-100 score and quintile tiers.
- **Where:** `functions/lib/sustainability/scoring.py:23 (logistic)`; `functions/lib/sustainability/scoring.py:36 (apply_logistic_scoring)`; `functions/lib/sustainability/scoring.py:74 (build_components_json)`; `functions/lib/sustainability/distribution.py:51 (_percentile)`; `functions/lib/sustainability/distribution.py:62 (build_distribution_snapshot)`; `functions/lib/sustainability/distribution.py:87 (assign_quintiles)`; `functions/lib/sustainability/pipeline.py:107 (run_full_scoring_pipeline)`; `functions/lib/sustainability/scoring.py:36 apply_logistic_scoring`; `functions/lib/sustainability/distribution.py:62 build_distribution_snapshot`
- **Tags (heuristic):** percent scale: both/ambiguous; denominators: per 60; generation: legacy, research
- **Opus view (SUS-034):**
  - Method: p=logistic(contrib); p_g=lower+(upper-lower)*p; score=round(100*p_g). Extreme flag \|z\|>=4. Snapshot cut points at 20/40/60/80% via nearest-rank index round((n-1)p); quintile 1 = score>=t80 (top) .. 5 bottom; GAME window only.
  - Inputs/units: contrib; sources: —
  - Output scale: score 0-100 int; quintile 1-5; writes: —
  - Status: legacy/dead (offline research only) — functions/lib/sustainability/README.md: 'offline-only and non-canonical'; persistence raises OfflinePersistenceDisabledError
  - Consumers: orchestrate_full_run; run_performance_benchmark
- **Codex view (core-119, calculation, location; Codex family 'sustainability Python legacy'):** Logistic sustainability score
  - Formula: p=sigmoid(total); pGuard=.01+.98p; round(100*pGuard).
  - Purpose: Calculate logistic sustainability score.
  - Inputs/units: Contribution total, guardrails default .01/.99.
  - Output scale: Probability-like 0..1 and integer 0..100.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f; Offline-only and noncanonical per functions/lib/sustainability/README.md; persistence/orchestration fail closed. Deployment/data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untra…
- **Codex view (core-120, calculation, location; Codex family 'sustainability Python legacy'):** Offline score distribution/quintiles
  - Formula: Sorted percentiles; separate assign_quintiles function.
  - Purpose: Calculate offline score distribution/quintiles.
  - Inputs/units: Population scores.
  - Output scale: Summary quantiles and quintile 0..4.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f; Offline-only and noncanonical per functions/lib/sustainability/README.md; persistence/orchestration fail closed. Deployment/data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untra…
- **Audit context:**
  - Intent (Opus): functions/lib/sustainability/README.md (offline, non-canonical; TS is canonical); scoring.py docstring
  - Intended contract (Codex core-119): Implementation/type declarations and adjacent comments in functions/lib/sustainability/scoring.py:36; approval beyond source not established.
  - Intended contract (Codex core-120): Implementation/type declarations and adjacent comments in functions/lib/sustainability/distribution.py:62; approval beyond source not established.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `Located only; not run for this inventory.`; `functions/tests/test_distribution.py`; `functions/tests/test_full_scoring_pipeline.py`; `functions/tests/test_orchestrator.py`; `functions/tests/test_pipeline.py`; `functions/tests/test_scoring.py`; `functions/tests/test_scoring_edge_cases.py`
- **Leads (not audited):**
  - (opus) pipeline passes guardrails=cfg.constants but lower_raw/upper_raw live under constants['guardrails'], so defaults 0.01/0.99 are used instead of configured 0.005/0.995
  - (opus) extreme threshold 4 here vs 5 in TS observability.ts
  - (opus) quintile 1=top here vs TS quintile 4=top
  - (codex:core-119) ["Inventory only; no correctness or calibration verdict."]
  - (codex:core-120) ["Inventory only; no correctness or calibration verdict."]

## M-SUS-024 Score distribution snapshot and quintile assignment (TS)

- **Match:** Both; Opus SUS-037; Codex core-107, core-108
- **Purpose:** Per-window summary stats/percentiles of s_100 and equal-count quintile buckets.
- **Where:** `web/lib/sustainability/distribution.ts:55 (percentile)`; `web/lib/sustainability/distribution.ts:64 (buildSustainabilityDistributionSnapshot)`; `web/lib/sustainability/distribution.ts:92 (assignSustainabilityQuintiles)`; `web/pages/api/v1/sustainability/rebuild-score.ts:160`; `web/lib/sustainability/distribution.ts:64 buildSustainabilityDistributionSnapshot`; `web/lib/sustainability/distribution.ts:92 assignSustainabilityQuintiles`
- **Tags (heuristic):** denominators: per 60; generation: current
- **Opus view (SUS-037):**
  - Method: Mean, population SD, min/max, linear-interpolated percentiles p10/20/25/40/50/60/75/80/90 (4dp). Quintiles: sort ascending by s_100 then player_id; split into 5 equal-count buckets (first n%5 buckets get +1); quintile index 0 (lowest) .. 4 (highest).
  - Inputs/units: s_100 0-100; sources: sustainability_scores (batch rows)
  - Output scale: quintile 0-4; percentiles in score units; writes: sustainability_distribution_snapshots
  - Status: live — vercel.json cron 10:42-10:4x UTC daily (rebuild-priors 42 10, rebuild-window-z 43 10, rebuild-score ...); read by /api/v1/sustainability/trends used on pages/FORGE.tsx and components/forge-dashboard/SustainabilityCard.tsx
  - Consumers: rebuild-score route
- **Codex view (core-107, calculation, location; Codex family 'sustainability distribution'):** Population score distribution
  - Formula: Sorted linear-interpolated quantiles; variance divided by n.
  - Purpose: Calculate population score distribution.
  - Inputs/units: Finite s100 population.
  - Output scale: Count, min/max, mean, population SD; p10/20/25/40/50/60/75/80/90.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f; TypeScript sustainability family; canonical runtime per functions/lib/sustainability/README.md. Deployment/data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry…
- **Codex view (core-108, calculation, location; Codex family 'sustainability distribution'):** Balanced quintile assignment
  - Formula: Sort score ascending, tie by player ID; balanced bucket sizes floor(n/5), earliest buckets get the remainder.
  - Purpose: Calculate balanced quintile assignment.
  - Inputs/units: Scores per window and player IDs.
  - Output scale: Quintile integer 0..4 or null.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f; TypeScript sustainability family; canonical runtime per functions/lib/sustainability/README.md. Deployment/data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry…
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex core-107): Implementation/type declarations and adjacent comments in web/lib/sustainability/distribution.ts:64; approval beyond source not established.
  - Intended contract (Codex core-108): Implementation/type declarations and adjacent comments in web/lib/sustainability/distribution.ts:92; approval beyond source not established.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `Located only; not run for this inventory.`; `web/lib/sustainability/distribution.test.ts`
- **Leads (not audited):**
  - (opus) quintile 0=lowest score in TS vs Python distribution.py quintile 1=TOP — opposite conventions
  - (opus) quintiles computed per batch (limit 250 offset slices) — buckets depend on batch composition, not whole population
  - (codex:core-107) ["Inventory only; no correctness or calibration verdict."]
  - (codex:core-108) ["Inventory only; no correctness or calibration verdict."]

## M-SUS-025 Score guardrails (z clamp, s_raw clamp, exact 0/100 check, luck pressure clamp)

- **Match:** Both; Opus SUS-039; Codex core-051
- **Purpose:** Bound z-scores and scores and classify rows ok/degraded/blocked.
- **Where:** `web/lib/sustainability/guardrails.ts:50 (clampSustainabilityZScore)`; `web/lib/sustainability/guardrails.ts:66 (applySustainabilityScoreGuardrails)`; `web/lib/sustainability/guardrails.ts:139 (guardSustainabilityDashboardRow)`; `web/lib/sustainability/runtimeContract.ts:7 (EXACT thresholds)`; `web/lib/sustainability/guardrails.ts:66 applySustainabilityScoreGuardrails`
- **Tags (heuristic):** percent scale: 0-100; generation: current
- **Opus view (SUS-039):**
  - Method: Z_SCORE_LIMIT=3, SCORE_RAW_LIMIT=8, LUCK_PRESSURE_LIMIT=12. Non-finite -> 0 + blocked. Recompute s100=100*sigmoid(sRaw) unless recomputeScore=false; then stored s100 clamped [0,100] and exact 100 rejected if sigmoid<0.995 / exact 0 rejected if >0.005. State degraded if any warning or \|sRaw\|>=8.
  - Inputs/units: z-scores; sources: —
  - Output scale: s100 0-100; state enum; writes: —
  - Status: live — vercel.json cron 10:42-10:4x UTC daily (rebuild-priors 42 10, rebuild-window-z 43 10, rebuild-score ...); read by /api/v1/sustainability/trends used on pages/FORGE.tsx and components/forge-dashboard/SustainabilityCard.tsx
  - Consumers: buildScoreForPlayerWindow; trends route
- **Codex view (core-051, calculation, location; Codex family 'sustainability window score'):** Sustainability score guardrails and logistic map
  - Formula: Clamp raw score to[-8, 8] and luck z terms to[-3, 3]; 100*sigmoid(raw); validate exact 0/100 against runtime thresholds and retain blocked/degraded flags.
  - Purpose: Calculate sustainability score guardrails and logistic map.
  - Inputs/units: Raw signed score, optional stored score, components.
  - Output scale: Raw score clipped to [-8,8]; score on a 0–100 display scale; ok/degraded/blocked status.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f; TypeScript sustainability family; canonical runtime per functions/lib/sustainability/README.md. Deployment/data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry…
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED beyond code (runtimeContract constants)
  - Intended contract (Codex core-051): Implementation/type declarations and adjacent comments in web/lib/sustainability/guardrails.ts:66; approval beyond source not established.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `Located only; not run for this inventory.`; `web/lib/sustainability/guardrails.test.ts`
- **Leads (not audited):**
  - (opus) with seed weights max \|sRaw\| = 3*5.6 = 16.8, so the ±8 clamp can bind (s_100 floor/ceiling ~0.03/99.97) and marks the row degraded
  - (codex:core-051) ["Inventory only; no correctness or calibration verdict."]

## M-SUS-026 Hot/normal/cold labelling and calibrated logistic probability model

- **Match:** Both; Opus SUS-040; Codex core-099, core-100, core-101, core-102
- **Purpose:** Label training targets by z or quantile and fit one-vs-rest logistic models with Platt scaling and softmax.
- **Where:** `web/lib/sustainability/model.ts:446 (deriveSustainabilityLabel)`; `web/lib/sustainability/model.ts:318 (fitBinaryLogisticModel)`; `web/lib/sustainability/model.ts:362 (fitPlattScaler)`; `web/lib/sustainability/model.ts:510 (trainSustainabilityProbabilityModel)`; `web/lib/sustainability/model.ts:544 (predictSustainabilityProbabilities)`; `web/lib/sustainability/model.ts:589 (extractFeatureImportance)`; `web/lib/sustainability/model.ts:649 (generateExplanationBullets)`; `web/lib/sustainability/model.ts:446 deriveSustainabilityLabel`; `web/lib/sustainability/model.ts:510 trainSustainabilityProbabilityModel`; `web/lib/sustainability/model.ts:544 predictSustainabilityProbabilities`; `web/lib/sustainability/model.ts:589 extractFeatureImportance`
- **Tags (heuristic):** percent scale: fraction 0-1; generation: legacy
- **Opus view (SUS-040):**
  - Method: Labels: z>=1 hot, <=-1 cold; quantile >=0.8 hot, <=0.2 cold. Batch gradient descent 600 iters, lr 0.1, L2 0.0005 (bias unpenalised); Platt slope/intercept fitted by GD 250 iters on the SAME training logits; probabilities = softmax(log(calibrated p_k)) = normalised calibrated p. Importance = feature*weight of predicted class.
  - Inputs/units: z-scores / quantile 0-1; sources: —
  - Output scale: probabilities 0-1; writes: —
  - Status: legacy/dead — debug page only
  - Consumers: pages/trendsDebug.tsx (DEMO_MODEL)
- **Codex view (core-099, calculation, location; Codex family 'sustainability model utilities'):** Hot/normal/cold training target
  - Formula: Default z thresholds±1; quantile thresholds.2/.8; inclusive.
  - Purpose: Calculate hot/normal/cold training target.
  - Inputs/units: Performance z or quantile.
  - Output scale: Class cold/normal/hot.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f; Separate helper model from canonical buildScoreForPlayerWindow logistic-score writer; runtime activation of trained probabilities not verified. Deployment/data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementa…
- **Codex view (core-100, calculation, codex_part_of_opus; Codex family 'sustainability model utilities'):** Three-class probability fitting
  - Formula: Gradient descent L2 binary logits; fit Platt slope/intercept per class.
  - Purpose: Calculate three-class probability fitting.
  - Inputs/units: Feature vectors and labeled examples.
  - Output scale: One-vs-rest logistic models with Platt scalers.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f; Separate helper model from canonical buildScoreForPlayerWindow logistic-score writer; runtime activation of trained probabilities not verified. Deployment/data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementa…
- **Codex view (core-101, calculation, codex_part_of_opus; Codex family 'sustainability model utilities'):** Calibrated class probabilities
  - Formula: sigmoid(slope*rawLogit+intercept); log probabilities then softmax.
  - Purpose: Calculate calibrated class probabilities.
  - Inputs/units: Model and feature vector.
  - Output scale: Cold/normal/hot probabilities summing 1; argmax label.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f; Separate helper model from canonical buildScoreForPlayerWindow logistic-score writer; runtime activation of trained probabilities not verified. Deployment/data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementa…
- **Codex view (core-102, calculation, codex_part_of_opus; Codex family 'sustainability model utilities'):** Probability feature attribution
  - Formula: Coefficient/feature contribution ranking; full logic source.
  - Purpose: Calculate probability feature attribution.
  - Inputs/units: Features and fitted model.
  - Output scale: Ranked weighted contributions.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f; Separate helper model from canonical buildScoreForPlayerWindow logistic-score writer; runtime activation of trained probabilities not verified. Deployment/data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementa…
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex core-099): Implementation/type declarations and adjacent comments in web/lib/sustainability/model.ts:446; approval beyond source not established.
  - Intended contract (Codex core-100): Implementation/type declarations and adjacent comments in web/lib/sustainability/model.ts:510; approval beyond source not established.
  - Intended contract (Codex core-101): Implementation/type declarations and adjacent comments in web/lib/sustainability/model.ts:544; approval beyond source not established.
  - Intended contract (Codex core-102): Implementation/type declarations and adjacent comments in web/lib/sustainability/model.ts:589; approval beyond source not established.
  - External references: Platt scaling; multinomial logistic
  - Fixtures/test data: none listed
  - Tests: `Located only; not run for this inventory.`; `web/lib/sustainability/model.test.ts`
- **Leads (not audited):**
  - (opus) Platt calibration fitted in-sample on training logits (no holdout)
  - (opus) only a demo model in debug page; no persisted model
  - (codex:core-099) ["Inventory only; no correctness or calibration verdict."]
  - (codex:core-100) ["Inventory only; no correctness or calibration verdict."]
  - (codex:core-101) ["Inventory only; no correctness or calibration verdict."]
  - (codex:core-102) ["Inventory only; no correctness or calibration verdict."]

## M-SUS-027 Composite sustainability score (probability edge) and performance flags

- **Match:** Both; Opus SUS-041; Codex core-105, core-106
- **Purpose:** Alternative 0-100 score from hot/cold probability edge plus deltas, and over/under-performing flags.
- **Where:** `web/lib/sustainability/model.ts:860 (buildSustainabilityScore)`; `web/lib/sustainability/model.ts:935 (derivePerformanceFlags)`; `web/lib/sustainability/model.ts:860 buildSustainabilityScore`; `web/lib/sustainability/model.ts:935 derivePerformanceFlags`
- **Tags (heuristic):** percent scale: 0-100; generation: legacy
- **Opus view (SUS-041):**
  - Method: raw=50+30*(Phot-Pcold)+8*clamp(delta,±1)+10*clamp(z,±2)/2+6*clamp(usage,±.75)+5*clamp(opp,±.75); clamp 0-100. Overperforming: score>=60 & Phot>=.45 & \|z\|>=.75; underperforming: score<=40 & Pcold>=.45 & \|z\|>=.75.
  - Inputs/units: probabilities, z, deltas; sources: —
  - Output scale: 0-100; writes: —
  - Status: legacy/dead — debug page only
  - Consumers: pages/trendsDebug.tsx
- **Codex view (core-105, calculation, location; Codex family 'sustainability model utilities'):** Model probability-derived sustainability score
  - Formula: 50+30*(Phot-Pcold)+8*clamp(delta, ±1)+10*clamp(z, ±2)/2+6*clamp(usage, ±.75)+5*clamp(opponent, ±.75); clamp to [0,100].
  - Purpose: Calculate model probability-derived sustainability score.
  - Inputs/units: Phot, Pcold, rateDelta, z, usageDelta, opponentDefense.
  - Output scale: Score 0..100 and components; over/under flags.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f; Separate helper model from canonical buildScoreForPlayerWindow logistic-score writer; runtime activation of trained probabilities not verified. Deployment/data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementa…
- **Codex view (core-106, calculation, location; Codex family 'sustainability model utilities'):** Performance flags
  - Formula: Conjunction of the score threshold, minimum class probability and minimum absolute z-score.
  - Purpose: Calculate performance flags.
  - Inputs/units: Score, hot/cold class probabilities, absolute recent z-score, and configurable thresholds.
  - Output scale: Overperforming/underperforming/stable.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f; Separate helper model from canonical buildScoreForPlayerWindow logistic-score writer; runtime activation of trained probabilities not verified. Deployment/data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementa…
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex core-105): Implementation/type declarations and adjacent comments in web/lib/sustainability/model.ts:860; approval beyond source not established.
  - Intended contract (Codex core-106): Implementation/type declarations and adjacent comments in web/lib/sustainability/model.ts:935; approval beyond source not established.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `Located only; not run for this inventory.`; `web/lib/sustainability/model.test.ts`
- **Leads (not audited):**
  - (opus) second, unrelated '0-100 sustainability score' definition coexisting with the canonical s_100 (score.ts)
  - (codex:core-105) ["Inventory only; no correctness or calibration verdict."]
  - (codex:core-106) ["Inventory only; no correctness or calibration verdict."]

## M-SUS-028 Sustainability process-support score s_raw / s_100 (canonical v3)

- **Match:** Both; Opus SUS-045; Codex core-050
- **Purpose:** Weighted sum of clipped luck and skill z-scores mapped through a logistic to a 0-100 index.
- **Where:** `web/lib/sustainability/score.ts:154 (zClip)`; `web/lib/sustainability/score.ts:165 (DEFAULT_WEIGHTS)`; `web/lib/sustainability/score.ts:175 (buildScoreForPlayerWindow)`; `web/lib/sustainability/config.ts:85 (canonicalSustainabilityConfigSeed)`; `web/pages/api/v1/sustainability/rebuild-score.ts:77 (windows)`; `web/lib/sustainability/score.ts:175 buildScoreForPlayerWindow`
- **Tags (heuristic):** percent scale: 0-100; generation: current
- **Opus view (SUS-045):**
  - Method: Luck z clipped to ±3 (missing -> 0, with warning). Skill z=(rate-mu)/max(sig,1e-6) clipped ±3 (missing -> 0). sRaw = -1.2*z_shp -1.0*z_oishp -0.8*z_ipp -0.4*z_ppshp +0.9*z_ixg60 +0.7*z_icf60 +0.6*z_hdcf60 (weights from active config; seed values shown). Guardrails clamp sRaw to ±8, s_100=round(100*sigmoid(sRaw),2). Windows l3/l5/l10/l20. No reliability factor or soft (tanh) clipping in TS (unlike Python).
  - Inputs/units: z-scores (dimensionless); sources: sustainability_window_z, player_stats_unified, player_totals_unified, model_sustainability_config
  - Output scale: s_raw clamped [-8,8]; s_100 0-100 (2dp); writes: sustainability_scores (player_id, snapshot_date, window_code, s_raw, s_100, components, model_version, config_hash)
  - Status: live — vercel.json cron 10:42-10:4x UTC daily (rebuild-priors 42 10, rebuild-window-z 43 10, rebuild-score ...); read by /api/v1/sustainability/trends used on pages/FORGE.tsx and components/forge-dashboard/SustainabilityCard.tsx (rebuild-score ×4 offsets)
  - Consumers: /api/v1/sustainability/trends; leaderboard; player/[playerId]; entity-scores; FORGE dashboard SustainabilityCard; trendsSandbox
- **Codex view (core-050, calculation, location; Codex family 'sustainability window score'):** Canonical signed sustainability raw score
  - Formula: -1.2*zSH-1*zOISH-.8*zIPP-.4*zPPSH+.9*zIXG60+.7*zICF60+.6*zHDCF60; configured weights may replace defaults; skill z clipped±3; missing terms 0+warnings.
  - Purpose: Calculate canonical signed sustainability raw score.
  - Inputs/units: Luck z: shp, oishp, ipp, ppshp; skill z: ixg60, icf60, hdcf60; weights and config.
  - Output scale: s_raw; guarded s_100; component diagnostics.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f; sustainability_score_v3; config hash/provenance in runtimeContract.ts; actual active DB config unknown. Deployment/data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked stat…
- **Audit context:**
  - Intent (Opus): entitySurfaceServer.ts provenance: 'process_support_index' that 'does not measure observed performance against an expectation'; PRD tasks/TASKS/three-pillars-analytics/sustainability/prd/prd-sustainability-barometer.md
  - Intended contract (Codex core-050): Implementation/type declarations and adjacent comments in web/lib/sustainability/score.ts:175; approval beyond source not established.
  - External references: Logistic composite index; compare against Tango regression and PDO regression literature
  - Fixtures/test data: none listed
  - Tests: `Located only; not run for this inventory.`; `web/__tests__/pages/api/v1/sustainability/rebuild-score.test.ts`; `web/lib/sustainability/config.test.ts`; `web/lib/sustainability/runtimeContract.test.ts`; `web/lib/sustainability/score.test.ts`
- **Leads (not audited):**
  - (opus) missing z values are imputed as 0 (= at baseline) inside sRaw, pulling missing-data players toward 50
  - (opus) luck z are beta-binomial-scaled while skill z use between-player season SD — different standardisation bases summed with fixed weights
  - (opus) no reliability weighting by sample size despite Python/features.ts having one; l3 windows get the same weights as l20
  - (opus) logistic mapping without calibration; s_100 is not a probability
  - (codex:core-050) ["Inventory only; no correctness or calibration verdict."]

## M-SUS-029 Gamma / Beta / Normal trend band (value, CI, z, percentile)

- **Match:** Both; Opus SUS-048; Codex core-073, core-074, core-075, core-076
- **Possible related records (low-confidence location link, unconfirmed):** core-077, core-078, core-079, core-080, core-081, core-082, core-083, core-084, core-085, core-086, core-087, core-088, core-089, core-090, core-091, core-092, core-093, core-094, core-095, core-096 …
- **Purpose:** Per player/metric/window: decayed EWMA, shrunk value, 80% band, pseudo-z and band percentile.
- **Where:** `web/lib/sustainability/bandCalculator.ts:524 (computeGammaBand)`; `web/lib/sustainability/bandCalculator.ts:567 (computeBetaBand)`; `web/lib/sustainability/bandCalculator.ts:608 (computeNormalBand)`; `web/lib/sustainability/bandCalculator.ts:88 (estimateZScoreFromBand)`; `web/lib/sustainability/bandCalculator.ts:100 (estimatePercentileFromBand)`; `web/lib/sustainability/bandCalculator.ts:655 (computeTrendBandsForPlayer)`; `web/lib/sustainability/bandCalculator.ts:524 computeGammaBand`; `web/lib/sustainability/bandCalculator.ts:567 computeBetaBand`; `web/lib/sustainability/bandCalculator.ts:608 computeNormalBand`; `web/lib/sustainability/bandCalculator.ts:88 estimateZScoreFromBand`
- **Tags (heuristic):** percent scale: both/ambiguous; denominators: per 60; generation: current
- **Opus view (SUS-048):**
  - Method: Take first N samples. Gamma: decayed counts/minutes, ewma=60*Σwc/Σwe; value=blend(ewma,baseline,nEff=Σwe minutes,k=prior); prior shape0=baseline/60*k+1e-3, rate0=k+1e-3; CI = gamma 10/90% quantiles*60. Beta: ewma=Σws/Σwt; value=blend(n=Σwt); alpha0=baseline*k+0.5, beta0=(1-baseline)*k+0.5; CI beta 10/90%. Normal: ewma=Σwv/Σw; var=max(Σwv²/Σw-ewma²,1e-4); margin=1.28155*sd/max(sqrt(Σw),1); value=blend. z=(value-baseline)/((upper-lower)/(2*1.28155)); percentile=clamp(10+80*(value-lower)/(upper-lower),0,100).
  - Inputs/units: rates per 60 (minutes exposure) or fraction 0-1; sources: player_stats_unified, player_totals_unified
  - Output scale: metric units; z dimensionless; percentile 0-100; writes: sustainability_trend_bands
  - Status: live — vercel.json cron rebuild-trend-bands (limit 250, offsets 0-750); read by /api/v1/sustainability/trend-bands, entity-bands, pages/trendsSandbox.tsx
  - Consumers: /api/v1/sustainability/trend-bands; entity-bands; trendsSandbox; entitySurfaceServer comparisons
- **Codex view (core-073, calculation, location; Codex family 'sustainability bands'):** Gamma trend band
  - Formula: Half-life weighted counts/exposure; Gamma posterior; quantiles*60.
  - Purpose: Calculate gamma trend band.
  - Inputs/units: Counts, minutes, game ages, prior baseline, metric prior strength.
  - Output scale: Per 60 EWMA/shrunk mean and 80% credible bounds.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f; sustainability_trend_bands_v2. Deployment/data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final status check.
- **Codex view (core-074, calculation, location; Codex family 'sustainability bands'):** Beta trend band
  - Formula: Weighted counts; alpha0=base*k+.5; beta0=(1-base)*k+.5; Beta posterior.
  - Purpose: Calculate beta trend band.
  - Inputs/units: Success/trial observations, game ages, prior baseline.
  - Output scale: Fraction EWMA/shrunk mean and 80% credible bounds.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f; sustainability_trend_bands_v2. Deployment/data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final status check.
- **Codex view (core-075, calculation, location; Codex family 'sustainability bands'):** Normal trend band
  - Formula: Weighted observation variance, floored at 1e-4; margin=1.28155*SD/max(sqrt(totalWeight),1); interval centered on the prior-blended mean.
  - Purpose: Calculate normal trend band.
  - Inputs/units: Numeric observations, ages, baseline, k.
  - Output scale: Native EWMA/shrunk mean and 80% band.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f; sustainability_trend_bands_v2. Deployment/data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final status check.
- **Codex view (core-076, calculation, location; Codex family 'sustainability bands'):** Band-relative z and percentile estimates
  - Formula: Derive SD from band width; clamped linear percentile interpolation via estimatePercentileFromBand.
  - Purpose: Calculate band-relative z and percentile estimates.
  - Inputs/units: Value and 80% bounds.
  - Output scale: Approximate z and percentile.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f; sustainability_trend_bands_v2. Deployment/data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final status check.
- **CONFLICTS (unresolved, for the auditor):**
  - [scale] vs core-074: Opus says metric units; z dimensionless; percentile 0-100 / Codex says Fraction EWMA/shrunk mean and 80% credible bounds. — check mechanical rule: one side 0-1 fraction, other 0-100
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED (trend-band model v2 constant runtimeContract.ts:5)
  - Intended contract (Codex core-073): Implementation/type declarations and adjacent comments in web/lib/sustainability/bandCalculator.ts:524; approval beyond source not established.
  - Intended contract (Codex core-074): Implementation/type declarations and adjacent comments in web/lib/sustainability/bandCalculator.ts:567; approval beyond source not established.
  - Intended contract (Codex core-075): Implementation/type declarations and adjacent comments in web/lib/sustainability/bandCalculator.ts:608; approval beyond source not established.
  - Intended contract (Codex core-076): Implementation/type declarations and adjacent comments in web/lib/sustainability/bandCalculator.ts:88; approval beyond source not established.
  - External references: Bayesian shrinkage bands; compare with NST rolling averages
  - Fixtures/test data: none listed
  - Tests: `Located only; not run for this inventory.`; `web/__tests__/pages/api/v1/sustainability/rebuild-trend-bands.test.ts`; `web/__tests__/pages/api/v1/sustainability/trend-bands.test.ts`; `web/lib/sustainability/bandCalculator.test.ts`
- **Leads (not audited):**
  - (opus) point value (linear credibility blend) and interval (conjugate posterior) come from two different estimators, so value may sit off-centre or outside its own band
  - (opus) z uses posterior band width, which shrinks with exposure, so z grows with sample size; not comparable to window_z
  - (opus) 'percentile' is a linear position within the 80% band, not a population percentile
  - (opus) normal-band SD from weighted second moment, margin divided by sqrt(sum of decay weights) — not a standard error of a decayed mean
  - (codex:core-073) ["Inventory only; no correctness or calibration verdict."]
  - (codex:core-074) ["Inventory only; no correctness or calibration verdict."]
  - (codex:core-075) ["Inventory only; no correctness or calibration verdict."]
  - (codex:core-076) ["Inventory only; no correctness or calibration verdict."]

## M-SUS-030 Half-life EWMA weights and prior blend

- **Match:** Both; Opus SUS-049; Codex core-067, core-068
- **Purpose:** Recency weights and linear credibility blend toward baseline.
- **Where:** `web/lib/sustainability/bands.ts:256 (halfLifeWeight)`; `web/lib/sustainability/bands.ts:264 (ewma)`; `web/lib/sustainability/bands.ts:278 (blendWithPrior)`; `web/lib/sustainability/bands.ts:256 halfLifeWeight`; `web/lib/sustainability/bands.ts:278 blendWithPrior`
- **Tags (heuristic):** percent scale: fraction 0-1; generation: current
- **Opus view (SUS-049):**
  - Method: w=exp(-ln2*gamesAgo/halfLife) (gamesAgo 0 -> 1). blend=(n*ewma + k*baseline)/(n+k); n=0 -> baseline; k=0 -> ewma.
  - Inputs/units: games; exposure units vary (minutes/trials/weight); sources: —
  - Output scale: weight 0-1; value in metric units; writes: —
  - Status: live — vercel.json cron rebuild-trend-bands (limit 250, offsets 0-750); read by /api/v1/sustainability/trend-bands, entity-bands, pages/trendsSandbox.tsx
  - Consumers: computeGamma/Beta/NormalBand
- **Codex view (core-067, calculation, location; Codex family 'sustainability bands'):** Half-life weights and EWMA
  - Formula: exp(-ln2*gamesAgo/halfLife); ewma=sum(w*x)/sum(w).
  - Purpose: Calculate half-life weights and ewma.
  - Inputs/units: Games ago, half-life games, weighted observations.
  - Output scale: Nonnegative weights; native weighted estimate.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f; TypeScript sustainability family; canonical runtime per functions/lib/sustainability/README.md. Deployment/data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry…
- **Codex view (core-068, calculation, location; Codex family 'sustainability bands'):** Effective-sample prior blending
  - Formula: (n*ewma+k*baseline)/(n+k).
  - Purpose: Calculate effective-sample prior blending.
  - Inputs/units: EWMA, baseline, effectiveN, prior strength.
  - Output scale: Native shrunk estimate.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f; TypeScript sustainability family; canonical runtime per functions/lib/sustainability/README.md. Deployment/data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry…
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex core-067): Implementation/type declarations and adjacent comments in web/lib/sustainability/bands.ts:256; approval beyond source not established.
  - Intended contract (Codex core-068): Implementation/type declarations and adjacent comments in web/lib/sustainability/bands.ts:278; approval beyond source not established.
  - External references: Exponential smoothing; credibility weighting n/(n+k)
  - Fixtures/test data: none listed
  - Tests: `No directly named test located; tests not run.`; `web/lib/sustainability/bandCalculator.test.ts`
- **Leads (not audited):**
  - (opus) ewma() helper ignores gamesAgo and uses sample.weight (default 1) — unweighted mean unless caller supplies weights; callers in bandCalculator compute weights inline instead
  - (codex:core-067) ["Inventory only; no correctness or calibration verdict."]
  - (codex:core-068) ["Inventory only; no correctness or calibration verdict."]

## M-SUS-031 Beta and Gamma posterior credible intervals (incomplete beta/gamma, bisection)

- **Match:** Both; Opus SUS-050; Codex core-069, core-070, core-071
- **Purpose:** 80% credible intervals for rate metrics.
- **Where:** `web/lib/sustainability/bands.ts:304 (betaPosterior)`; `web/lib/sustainability/bands.ts:315 (betaCredibleInterval)`; `web/lib/sustainability/bands.ts:330 (gammaPosterior)`; `web/lib/sustainability/bands.ts:341 (gammaCredibleInterval)`; `web/lib/sustainability/bands.ts:360 (betaQuantile)`; `web/lib/sustainability/bands.ts:376 (gammaQuantile)`; `web/lib/sustainability/bands.ts:389 (incompleteBeta)`; `web/lib/sustainability/bands.ts:472 (logGamma Lanczos)`; `web/lib/sustainability/bands.ts:315 betaCredibleInterval`; `web/lib/sustainability/bands.ts:341 gammaCredibleInterval`; `web/lib/sustainability/bands.ts:360 betaQuantile`
- **Tags (heuristic):** percent scale: fraction 0-1; generation: current
- **Opus view (SUS-050):**
  - Method: Beta: alpha=alpha0+s, beta=beta0+(n-s) floored 1e-6; quantiles by 40-step bisection on regularized incomplete beta (Numerical Recipes continued fraction). Gamma: shape=shape0+sum, rate=rate0+exposure; quantile bisection on [0, max(10, 10*mean)] with series/continued-fraction incomplete gamma; Lanczos logGamma (6 coeffs).
  - Inputs/units: counts/exposure (minutes for gamma); sources: —
  - Output scale: interval in rate units; writes: —
  - Status: live — vercel.json cron rebuild-trend-bands (limit 250, offsets 0-750); read by /api/v1/sustainability/trend-bands, entity-bands, pages/trendsSandbox.tsx
  - Consumers: computeGammaBand; computeBetaBand
- **Codex view (core-069, calculation, location; Codex family 'sustainability bands'):** Beta posterior credible bands
  - Formula: Posterior a0+s, b0+n-s; inverse incomplete Beta at tail probabilities.
  - Purpose: Calculate beta posterior credible bands.
  - Inputs/units: Prior alpha/beta, successes, trials, confidence default .8.
  - Output scale: Mean and fraction quantiles 0..1.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f; TypeScript sustainability family; canonical runtime per functions/lib/sustainability/README.md. Deployment/data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry…
- **Codex view (core-070, calculation, location; Codex family 'sustainability bands'):** Gamma posterior credible bands
  - Formula: Posterior shape0+count, rate0+exposure; inverse incomplete Gamma.
  - Purpose: Calculate gamma posterior credible bands.
  - Inputs/units: Shape/rate prior, count/exposure, confidence.
  - Output scale: Nonnegative rate mean and quantiles.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f; TypeScript sustainability family; canonical runtime per functions/lib/sustainability/README.md. Deployment/data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry…
- **Codex view (core-071, calculation, location; Codex family 'sustainability bands'):** Beta/Gamma inverse-CDF numeric helpers
  - Formula: 40-step binary search; incompleteBeta continued fraction; incompleteGamma series/continued fraction; Lanczos logGamma.
  - Purpose: Calculate beta/gamma inverse-cdf numeric helpers.
  - Inputs/units: Probability, positive shape parameters.
  - Output scale: Quantile.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f; TypeScript sustainability family; canonical runtime per functions/lib/sustainability/README.md. Deployment/data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry…
- **Audit context:**
  - Intent (Opus): Comment bands.ts:356-359
  - Intended contract (Codex core-069): Implementation/type declarations and adjacent comments in web/lib/sustainability/bands.ts:315; approval beyond source not established.
  - Intended contract (Codex core-070): Implementation/type declarations and adjacent comments in web/lib/sustainability/bands.ts:341; approval beyond source not established.
  - Intended contract (Codex core-071): Implementation/type declarations and adjacent comments in web/lib/sustainability/bands.ts:360; approval beyond source not established.
  - External references: Bayesian credible intervals (Beta/Gamma conjugate)
  - Fixtures/test data: none listed
  - Tests: `No directly named test located; tests not run.`; `web/lib/sustainability/bandCalculator.test.ts`
- **Leads (not audited):**
  - (opus) comment calls betaQuantile 'Clopper-Pearson' but it is a Bayesian posterior quantile
  - (opus) gamma upper search bound max(10,10*mean) may truncate very wide intervals
  - (codex:core-069) ["Inventory only; no correctness or calibration verdict."]
  - (codex:core-070) ["Inventory only; no correctness or calibration verdict."]
  - (codex:core-071) ["Inventory only; no correctness or calibration verdict."]

## M-SUS-032 Trend-band metric spec table (half-lives, prior strengths, distributions)

- **Match:** Both; Opus SUS-051; Codex core-077, core-078, core-079, core-080, core-081, core-082, core-083, core-084
- **Purpose:** Per-metric configuration driving EWMA decay, shrinkage and interval family.
- **Where:** `web/lib/sustainability/bands.ts:7 (SUSTAINABILITY_METRICS)`; `web/lib/sustainability/bands.ts:55 (METRIC_SPECS)`; `web/lib/sustainability/bands.ts:8 shots_per_60`; `web/lib/sustainability/bandCalculator.ts:655 computeTrendBandsForPlayer`; `web/lib/sustainability/bands.ts:9 icf_per_60`; `web/lib/sustainability/bands.ts:10 ixg_per_60`; `web/lib/sustainability/bands.ts:11 iscf_per_60`; `web/lib/sustainability/bands.ts:12 ihdcf_per_60`; `web/lib/sustainability/bands.ts:13 pp_toi_pct`; `web/lib/sustainability/bands.ts:14 xgf_pct`; `web/lib/sustainability/bands.ts:15 scf_pct`
- **Tags (heuristic):** denominators: per 60, per game, 5v5 only; generation: current
- **Opus view (SUS-051):**
  - Method: 22 metrics. Gamma (exposure minutes): shots/icf/ixg/iscf/ihdcf/hits/blocks per60 half-life 5 games, prior 360 min; points_per_60_5v5 HL 6, prior 320; pp_goals/pp_points per60 HL 6, prior 180 PP min. Beta: xgf/scf/hdcf % HL 7 prior 550; ipp HL 9 prior 50; sh_pct & sh_pct_5v5 HL 11 prior 100; pp_sh_pct HL 11 prior 90; on_ice_sh/sv pct HL 8 prior 300. Normal: pp_toi_pct HL 5 prior 15 games; pdo HL 8 prior 300; fantasy_score HL 5 prior 20.
  - Inputs/units: —; sources: —
  - Output scale: config; writes: —
  - Status: live — vercel.json cron rebuild-trend-bands (limit 250, offsets 0-750); read by /api/v1/sustainability/trend-bands, entity-bands, pages/trendsSandbox.tsx
  - Consumers: computeTrendBandsForPlayer; features.DEFAULT_EB_PRIOR_STRENGTH; model.toFeatureLabel
- **Codex view (core-077, calculation, codex_part_of_opus; Codex family 'sustainability band metric'):** Shots / 60
  - Formula: Uses gamma trend-band engine; spec controls halfLifeGames, priorStrength, windows.
  - Purpose: Named persisted metric shots_per_60.
  - Inputs/units: Metric counts/values and minutes exposure; per-game history and season totals.
  - Output scale: Metric-specific mean, EWMA, baseline, CI, n_eff, z/percentile for l3/l5/l10/l20.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f; sustainability_trend_bands_v2. Deployment/data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final status check.
- **Codex view (core-078, calculation, codex_part_of_opus; Codex family 'sustainability band metric'):** iCF / 60
  - Formula: Uses gamma trend-band engine; spec controls halfLifeGames, priorStrength, windows.
  - Purpose: Named persisted metric icf_per_60.
  - Inputs/units: Metric counts/values and minutes exposure; per-game history and season totals.
  - Output scale: Metric-specific mean, EWMA, baseline, CI, n_eff, z/percentile for l3/l5/l10/l20.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f; sustainability_trend_bands_v2. Deployment/data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final status check.
- **Codex view (core-079, calculation, codex_part_of_opus; Codex family 'sustainability band metric'):** ixG / 60
  - Formula: Uses gamma trend-band engine; spec controls halfLifeGames, priorStrength, windows.
  - Purpose: Named persisted metric ixg_per_60.
  - Inputs/units: Metric counts/values and minutes exposure; per-game history and season totals.
  - Output scale: Metric-specific mean, EWMA, baseline, CI, n_eff, z/percentile for l3/l5/l10/l20.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f; sustainability_trend_bands_v2. Deployment/data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final status check.
- **Codex view (core-080, calculation, codex_part_of_opus; Codex family 'sustainability band metric'):** iSCF / 60
  - Formula: Uses gamma trend-band engine; spec controls halfLifeGames, priorStrength, windows.
  - Purpose: Named persisted metric iscf_per_60.
  - Inputs/units: Metric counts/values and minutes exposure; per-game history and season totals.
  - Output scale: Metric-specific mean, EWMA, baseline, CI, n_eff, z/percentile for l3/l5/l10/l20.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f; sustainability_trend_bands_v2. Deployment/data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final status check.
- **Codex view (core-081, calculation, codex_part_of_opus; Codex family 'sustainability band metric'):** iHDCF / 60
  - Formula: Uses gamma trend-band engine; spec controls halfLifeGames, priorStrength, windows.
  - Purpose: Named persisted metric ihdcf_per_60.
  - Inputs/units: Metric counts/values and minutes exposure; per-game history and season totals.
  - Output scale: Metric-specific mean, EWMA, baseline, CI, n_eff, z/percentile for l3/l5/l10/l20.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f; sustainability_trend_bands_v2. Deployment/data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final status check.
- **Codex view (core-082, calculation, codex_part_of_opus; Codex family 'sustainability band metric'):** PP TOI %
  - Formula: Uses normal trend-band engine; spec controls halfLifeGames, priorStrength, windows.
  - Purpose: Named persisted metric pp_toi_pct.
  - Inputs/units: Metric counts/values and games exposure; per-game history and season totals.
  - Output scale: Metric-specific mean, EWMA, baseline, CI, n_eff, z/percentile for l3/l5/l10/l20.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f; sustainability_trend_bands_v2. Deployment/data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final status check.
- **Codex view (core-083, calculation, codex_part_of_opus; Codex family 'sustainability band metric'):** xGF%
  - Formula: Uses beta trend-band engine; spec controls halfLifeGames, priorStrength, windows.
  - Purpose: Named persisted metric xgf_pct.
  - Inputs/units: Metric counts/values and onIceShotsFor exposure; per-game history and season totals.
  - Output scale: Metric-specific mean, EWMA, baseline, CI, n_eff, z/percentile for l3/l5/l10/l20.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f; sustainability_trend_bands_v2. Deployment/data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final status check.
- **Codex view (core-084, calculation, codex_part_of_opus; Codex family 'sustainability band metric'):** SCF%
  - Formula: Uses beta trend-band engine; spec controls halfLifeGames, priorStrength, windows.
  - Purpose: Named persisted metric scf_pct.
  - Inputs/units: Metric counts/values and onIceShotsFor exposure; per-game history and season totals.
  - Output scale: Metric-specific mean, EWMA, baseline, CI, n_eff, z/percentile for l3/l5/l10/l20.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f; sustainability_trend_bands_v2. Deployment/data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final status check.
- **Audit context:**
  - Intent (Opus): Comment bands.ts:3-6 'Align with backend column names'
  - Intended contract (Codex core-077): METRIC_SPECS and corresponding collectors in web/lib/sustainability/bandCalculator.ts.
  - Intended contract (Codex core-078): METRIC_SPECS and corresponding collectors in web/lib/sustainability/bandCalculator.ts.
  - Intended contract (Codex core-079): METRIC_SPECS and corresponding collectors in web/lib/sustainability/bandCalculator.ts.
  - Intended contract (Codex core-080): METRIC_SPECS and corresponding collectors in web/lib/sustainability/bandCalculator.ts.
  - Intended contract (Codex core-081): METRIC_SPECS and corresponding collectors in web/lib/sustainability/bandCalculator.ts.
  - Intended contract (Codex core-082): METRIC_SPECS and corresponding collectors in web/lib/sustainability/bandCalculator.ts.
  - Intended contract (Codex core-083): METRIC_SPECS and corresponding collectors in web/lib/sustainability/bandCalculator.ts.
  - Intended contract (Codex core-084): METRIC_SPECS and corresponding collectors in web/lib/sustainability/bandCalculator.ts.
  - External references: Tango stabilization points per metric
  - Fixtures/test data: none listed
  - Tests: `Located only; not run for this inventory.`; `web/lib/sustainability/bandCalculator.test.ts`
- **Leads (not audited):**
  - (opus) iscf_per_60, ihdcf_per_60, xgf_pct, scf_pct, hdcf_pct, sh_pct_5v5, pp_sh_pct have specs but no sample collectors in bandCalculator — always skipped (dead config)
  - (opus) all half-lives/prior strengths are hand-set magic numbers
  - (codex:core-077) ["Inventory only; no correctness or calibration verdict."]
  - (codex:core-078) ["Inventory only; no correctness or calibration verdict."]
  - (codex:core-079) ["Inventory only; no correctness or calibration verdict."]
  - (codex:core-080) ["Inventory only; no correctness or calibration verdict."]
  - (codex:core-081) ["Inventory only; no correctness or calibration verdict."]
  - (codex:core-082) ["Inventory only; no correctness or calibration verdict."]
  - (codex:core-083) ["Inventory only; no correctness or calibration verdict."]
  - (codex:core-084) ["Inventory only; no correctness or calibration verdict."]

## M-SUS-033 Python rolling windows GAME/G5/G10/STD

- **Match:** Both; Opus SUS-052; Codex core-111
- **Purpose:** Offline window aggregates and rates.
- **Where:** `functions/lib/sustainability/windows.py:42 (_compute_rates)`; `functions/lib/sustainability/windows.py:80 (build_player_windows)`; `functions/lib/sustainability/windows.py:42 _compute_rates`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: per game; generation: legacy, research
- **Opus view (SUS-052):**
  - Method: Per game emit GAME, G5 (last ≤5), G10 (last ≤10), STD (season-to-date excluding games >45 days older than current = freshness_days). sh_pct=goals/shots, oish_pct=oiGF/oiSF, ipp=points/oiGF (None if denom 0).
  - Inputs/units: counts; sources: —
  - Output scale: fractions; writes: —
  - Status: legacy/dead (offline research only) — functions/lib/sustainability/README.md: 'offline-only and non-canonical'; persistence raises OfflinePersistenceDisabledError
  - Consumers: annotate_zscores; compute_reliability
- **Codex view (core-111, calculation, location; Codex family 'sustainability Python legacy'):** Window pooled shooting/IPP rates
  - Formula: G/S; on-ice GF/SF; points/on-ice GF.
  - Purpose: Calculate window pooled shooting/ipp rates.
  - Inputs/units: Goals, shots, on-ice GF/on-ice SF, points; GAME/G5/G10/STD windows.
  - Output scale: SH%, on-ice SH%, IPP fractions.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f; Offline-only and noncanonical per functions/lib/sustainability/README.md; persistence/orchestration fail closed. Deployment/data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untra…
- **Audit context:**
  - Intent (Opus): functions/lib/sustainability/README.md (offline, non-canonical; TS is canonical); docstring windows.py:1-23
  - Intended contract (Codex core-111): Implementation/type declarations and adjacent comments in functions/lib/sustainability/windows.py:42; approval beyond source not established.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `Located only; not run for this inventory.`; `functions/tests/test_windows.py`
- **Leads (not audited):**
  - (opus) windows G5/G10/STD differ from TS l3/l5/l10/l20
  - (opus) 'STD' with 45-day freshness is not season-to-date
  - (codex:core-111) ["Inventory only; no correctness or calibration verdict."]

## M-SUS-034 Python z-scores vs posterior with fixed SD constants

- **Match:** Both; Opus SUS-055; Codex core-114
- **Purpose:** Offline z of window rate vs player posterior mean using fixed SD per metric×position.
- **Where:** `functions/lib/sustainability/zscores.py:46 (annotate_zscores)`; `functions/lib/sustainability/constants.py:44 (FALLBACK_SD_CONSTANTS)`; `functions/lib/sustainability/constants.py:59 (load_sd_constants)`; `functions/lib/sustainability/zscores.py:46 annotate_zscores`
- **Tags (heuristic):** denominators: per 60; generation: legacy, research
- **Opus view (SUS-055):**
  - Method: z=(obs-post_mean)/sd. Fallback SD F/D: sh_pct .045/.040, oish_pct .035/.032, oisv_pct .025/.025, ipp .12/.10, finish_res_rate .20/.18, finish_res_cnt 1.50/1.25, ixg_per60 .70/.40, icf_per60 2.20/1.10, hdcf_per60 .90/.55.
  - Inputs/units: fractions; sources: sustainability_sigma_constants (optional)
  - Output scale: z-score; writes: —
  - Status: legacy/dead (offline research only) — functions/lib/sustainability/README.md: 'offline-only and non-canonical'; persistence raises OfflinePersistenceDisabledError
  - Consumers: compute_reliability; apply_soft_clipping
- **Codex view (core-114, calculation, location; Codex family 'sustainability Python legacy'):** Position-SD standardized deviations
  - Formula: (observed-expected)/position sigma; missing values are null.
  - Purpose: Calculate position-sd standardized deviations.
  - Inputs/units: Observed sh_pct, oish_pct, ipp; player posterior mean; position sigma.
  - Output scale: z, delta, expectation.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f; Offline-only and noncanonical per functions/lib/sustainability/README.md; persistence/orchestration fail closed. Deployment/data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untra…
- **Audit context:**
  - Intent (Opus): constants.py docstring: 'Values here are placeholders'
  - Intended contract (Codex core-114): Implementation/type declarations and adjacent comments in functions/lib/sustainability/zscores.py:46; approval beyond source not established.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `Located only; not run for this inventory.`; `functions/tests/test_zscores.py`
- **Leads (not audited):**
  - (opus) fixed SD ignores window sample size (a 1-game sh% and a season sh% get the same SD) — differs from TS beta-binomial variance
  - (opus) SD values are placeholders per docstring
  - (opus) only sh_pct/oish_pct/ipp get z; weighted skill metrics never get z so contribute nothing
  - (codex:core-114) ["Inventory only; no correctness or calibration verdict."]

## M-SUS-035 Reliability weight sqrt(n/(n+k)) and tanh soft clip (TS port)

- **Match:** Both; Opus SUS-056; Codex core-058, core-059
- **Purpose:** Port of Python reliability and soft-clipping.
- **Where:** `web/lib/sustainability/features.ts:563 (calculateReliabilityWeight)`; `web/lib/sustainability/features.ts:576 (applyReliabilityWeightToZScore)`; `web/lib/sustainability/features.ts:590 (softClipZScore)`; `web/lib/sustainability/features.ts:563 calculateReliabilityWeight`; `web/lib/sustainability/features.ts:590 softClipZScore`
- **Tags (heuristic):** generation: legacy
- **Opus view (SUS-056):**
  - Method: r=sqrt(n/(n+k)) (k<=0 -> 1 if n>0 else 0); weighted z=z*r; soft clip tanh(z/c), c=3 default.
  - Inputs/units: trials; sources: —
  - Output scale: r in [0,1]; clipped z in (-1,1); writes: —
  - Status: legacy/dead — no non-test caller found
  - Consumers: (no production caller)
- **Codex view (core-058, calculation, location; Codex family 'sustainability features'):** Reliability weighting
  - Formula: sqrt(n/(n+k)); applyReliabilityWeightToZScore multiplies z.
  - Purpose: Calculate reliability weighting.
  - Inputs/units: Sample count n, calibrationK; optional z.
  - Output scale: Reliability 0..1; weighted z.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f; TypeScript sustainability family; canonical runtime per functions/lib/sustainability/README.md. Deployment/data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry…
- **Codex view (core-059, calculation, location; Codex family 'sustainability features'):** Soft z clipping
  - Formula: tanh(z/c).
  - Purpose: Calculate soft z clipping.
  - Inputs/units: z and positive clipping constant c default 3.
  - Output scale: (-1, 1).
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f; TypeScript sustainability family; canonical runtime per functions/lib/sustainability/README.md. Deployment/data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry…
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED (mirrors functions/lib/sustainability/reliability.py docstring)
  - Intended contract (Codex core-058): Implementation/type declarations and adjacent comments in web/lib/sustainability/features.ts:563; approval beyond source not established.
  - Intended contract (Codex core-059): Implementation/type declarations and adjacent comments in web/lib/sustainability/features.ts:590; approval beyond source not established.
  - External references: Spearman-Brown / split-half reliability; Tango r=n/(n+k)
  - Fixtures/test data: none listed
  - Tests: `Located only; not run for this inventory.`; `web/lib/sustainability/features.test.ts`
- **Leads (not audited):**
  - (opus) sqrt(n/(n+k)) is the square root of the usual Tango/Spearman-Brown reliability n/(n+k)
  - (opus) canonical score.ts does not use these, so live scores have no reliability weighting
  - (codex:core-058) ["Inventory only; no correctness or calibration verdict."]
  - (codex:core-059) ["Inventory only; no correctness or calibration verdict."]

## M-SUS-036 Beta-binomial empirical-Bayes window z (eb_z)

- **Match:** Both; Opus SUS-058; Codex core-049
- **Purpose:** Standardise a window rate against the player's (or league) Beta baseline using beta-binomial predictive variance.
- **Where:** `web/lib/sustainability/windows.ts:161 (ebZ_generic)`; `web/lib/sustainability/windows.ts:187 (rebuildBetaWindowZForSnapshot)`; `web/lib/sustainability/windows.ts:129 (fetchPlayerPosteriors)`; `web/lib/sustainability/windows.ts:161 ebZ_generic`
- **Tags (heuristic):** percent scale: fraction 0-1; generation: current
- **Opus view (SUS-058):**
  - Method: strength=a+b; priorMean=a/strength; priorVar=ab/(strength^2(strength+1)); p_hat=s/n; shrink=strength/(strength+n); varMixed=priorMean(1-priorMean)(strength+n)/(n(strength+1)) [beta-binomial predictive variance of s/n]; z=(p_hat-priorMean)/max(sqrt(varMixed),sqrt(1e-9)). n=0 -> z=0. Non-finite outputs replaced by 0 before persist. Rounded z to 6dp.
  - Inputs/units: counts; rates fraction 0-1; sources: sustainability_player_priors, sustainability_priors, player_stats_unified, player_baselines (player list)
  - Output scale: z-score (unbounded here; clipped ±3 downstream); writes: sustainability_window_z
  - Status: live — vercel.json cron 10:42-10:4x UTC daily (rebuild-priors 42 10, rebuild-window-z 43 10, rebuild-score ...); read by /api/v1/sustainability/trends used on pages/FORGE.tsx and components/forge-dashboard/SustainabilityCard.tsx
  - Consumers: buildScoreForPlayerWindow (luck z); trends route z_* fields
- **Codex view (core-049, calculation, location; Codex family 'sustainability window score'):** Beta-binomial predictive window z
  - Formula: strength=a+b; mu=a/strength; varMixed=mu(1-mu)(strength+n)/(n(strength+1)); z=(s/n-mu)/sqrt(varMixed); n0 gives z=0.
  - Purpose: Compare each recent rate with uncertain personal baseline.
  - Inputs/units: Window successes/trials n; player posterior alpha0, beta0 for shp, oishp, ipp, ppshp.
  - Output scale: Observed fraction; baseline fraction/variance; shrink 0..1; unbounded z.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f; TypeScript sustainability family; canonical runtime per functions/lib/sustainability/README.md. Deployment/data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry…
- **Audit context:**
  - Intent (Opus): Comment windows.ts:157-160 'z of a window rate s/n against a Beta(alpha0, beta0) baseline, using the beta-binomial predictive spread'
  - Intended contract (Codex core-049): JSDoc explicitly beta-binomial predictive spread, not posterior-mean uncertainty.
  - External references: Beta-binomial predictive distribution; Tango regression to the mean
  - Fixtures/test data: none listed
  - Tests: `Located only; not run for this inventory.`; `web/__tests__/pages/api/v1/sustainability/rebuild-window-z.test.ts`; `web/lib/sustainability/windows.test.ts`
- **Leads (not audited):**
  - (opus) non-finite z coerced to 0 (indistinguishable from 'at baseline')
  - (opus) player list comes from player_baselines at the snapshot date, so players without a baseline row get no z
  - (opus) sequential per-player DB call per window (N×4 queries) — cost, not math
  - (codex:core-049) ["Inventory only; no correctness or calibration verdict."]

## M-SUS-037 seed sustainability_sigma_constants + model_sustainability_config v1

- **Match:** Opus only; Opus SUS-002; Codex —
- **Purpose:** Seeded fixed sigma per metric/position and v1 sustainability weights/constants
- **Where:** `migrations/sql/20250928_seed_sigma_constants.sql:13 (sigma seed)`; `migrations/sql/20250928_seed_sustainability_config.sql:11 (config seed)`
- **Tags (heuristic):** denominators: per 60
- **Opus view (SUS-002):**
  - Method: sigma (fraction units): sh_pct C .045 LW/RW .046 D .030; oish_pct .055/.056/.050; oisv_pct .015/.014; ipp .12/.13/.08; ixg_per60 .35/.36/.20; icf_per60 3.8/4.1/2.6; hdcf_per60 .90/.95/.60. Weights: sh_pct -1.2, oish_pct -1.0, oisv_pct -0.8, ipp -0.8, finish_res_rate -0.6, finish_res_cnt -0.4, ixg_per60 0.9, icf_per60 0.7, hdcf_per60 0.6. Constants c=3.0, k_r {sh_pct 50, oish_pct 150, ipp 30}, guardrails raw 0.005-0.995, quintiles dynamic, sd_mode fixed, freshness 45 days.
  - Inputs/units: fractions 0-1 and per-60; sources: —
  - Output scale: constants; writes: sustainability_sigma_constants, model_sustainability_config
  - Status: unknown — seeds may be superseded by later config revisions (20260725223034 adds score_model_version/config_hash)
  - Consumers: functions/lib/sustainability/constants.py; web/lib/sustainability/config.ts
- **Audit context:**
  - Intent (Opus): migrations/sql/20250928_seed_sigma_constants.sql:1-3 'placeholder baseline approximations'
  - External references: Tango regression to mean (k shrinkage constants)
  - Fixtures/test data: none listed
  - Tests: none listed
- **Leads (not audited):**
  - (opus) sigma file states 'Values are placeholder baseline approximations; replace with empirically derived' values
  - (opus) sigma in fraction units while NST views emit percent 0-100 - unit must be converted by callers

## M-SUS-038 fn finalize_sustainability_score_snapshot

- **Match:** Opus only; Opus SUS-004; Codex —
- **Purpose:** Assign sustainability quintiles and write distribution snapshot (mean, sd, percentiles)
- **Where:** `supabase/migrations/20260725223034_add_sustainability_version_provenance.sql:301 (finalize_sustainability_score_snapshot)`
- **Tags (heuristic):** generation: current
- **Opus view (SUS-004):**
  - Method: quintile = ntile(5) over (partition by window_code order by s_100, player_id) - 1 (0..4); distribution per window: count, min, max, avg, stddev_pop, percentile_cont at 0.10,0.20,0.25,0.40,0.50,0.60,0.75,0.80,0.90.
  - Inputs/units: s_100 0-100; sources: sustainability_scores
  - Output scale: quintile 0-4; distribution stats; writes: sustainability_scores.sustainability_quintile, sustainability_distribution_snapshots
  - Status: live — called by web/pages/api/v1/sustainability/process-recompute-queue.ts
  - Consumers: web/pages/api/v1/sustainability/process-recompute-queue.ts
- **Audit context:**
  - Intent (Opus): supabase/migrations/20260725223034_add_sustainability_version_provenance.sql:1-2 'Make the active TypeScript sustainability pipeline's model/config identity first-class'
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/supabase/sustainabilityVersionProvenanceMigration.test.ts`
- **Leads (not audited):**
  - (opus) quintiles pooled across positions (not partitioned by position_group)
  - (opus) UPDATE join matches player/date/window only, not model_version/config_hash, so rows of another model version on the same date can receive these quintiles

## M-SUS-039 view vw_entity_sustainability_scores

- **Match:** Opus only; Opus SUS-005; Codex —
- **Purpose:** Labels sustainability s_raw as over/under-performing
- **Where:** `supabase/migrations/20260730233451_reconstruct_hosted_analytics_schema.sql:131 (analytics.vw_entity_sustainability_scores)`; `web/sql/ratings/002_create_analytics_trends_predictions_and_provenance.sql:375 (source copy)`
- **Opus view (SUS-005):**
  - Method: label = 'overperforming' if s_raw >= 0.75, 'underperforming' if s_raw <= -0.75, else neutral.
  - Inputs/units: s_raw (z-like); sources: sustainability_scores
  - Output scale: categorical; writes: —
  - Status: unknown — no web/ reader; listed in supportedBaselineMigration.test.ts
  - Consumers: no web/ reader found
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/supabase/supportedBaselineMigration.test.ts`
- **Leads (not audited):**
  - (opus) fixed +/-0.75 threshold on s_raw independent of the dynamic quintiles

## M-SUS-040 Legacy NST career averages (unweighted mean of season rows)

- **Match:** Opus only; Opus SUS-006; Codex —
- **Purpose:** Return a player's career-average S%, xS%, IPP, oiSH%, secA%, A1, A2, points, SOG/60, oZS%, iHDCF, iSCF, ixG, xG%, CF%, goals for the sustainability-vs-career chart.
- **Where:** `web/pages/api/CareerAverages/[playerId].ts:78 (getStats)`; `web/pages/api/Teams/[teamAbbreviation].ts:89 (getStats, duplicate copy)`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: per 60, shots on goal; generation: legacy, current
- **Opus view (SUS-006):**
  - Method: Each metric = sum over every season row of the per-season value / number of rows (unweighted). xS% = mean of per-season ixG/Shots; secA% = mean of A2/A; SOG/60 = mean of Shots/parseTime(TOI)*60 using lib/NHL/TOI parseTime (minutes). Percent fields divided by 100 at the end (S%, IPP, oiSH%, oZS%).
  - Inputs/units: NST percentages 0-100; TOI minutes (mm:ss or decimal via lib/NHL/TOI parseTime); sources: Natural Stat Trick playerreport.php (scraped)
  - Output scale: fractions 0-1 for percentages; per-season mean counts; SOG/60 per-60; writes: —
  - Status: live (CareerAverages) — called by hooks/useCareerAveragesStats.ts; Teams/[teamAbbreviation] legacy/dead — no callers, route ledger incoming {}
  - Consumers: web/hooks/useCareerAveragesStats.ts; web/components/SustainabilityVSCareerChart/SustainabilityVSCareerChart.tsx
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED (only inline comments naming each stat)
  - External references: Career rates should pool totals (sum G / sum SOG), not average seasonal percentages; Tango regression references for sustainability baselines
  - Fixtures/test data: none listed
  - Tests: `web/lib/nst/callerLifecycle.test.ts (lifecycle only)`
- **Leads (not audited):**
  - (opus) reducers use prev + X \|\| 0, so one NaN season resets the running sum to 0 (precedence), silently dropping earlier seasons
  - (opus) unweighted mean of seasonal percentages (S%, IPP, oiSH%) rather than pooled totals; a tiny season weighs as much as a full one
  - (opus) includes every row in the NST table (current partial season and any TOT/team split rows), so traded seasons may be double counted
  - (opus) 'ixG' key on the output is on-ice xG% and 'iCF' pct is on-ice CF%, misleading names
  - (opus) Teams/[teamAbbreviation].ts reads req.query.playerId although the dynamic segment is teamAbbreviation, so it always returns 'Player Id is required' (dead duplicate)

## M-SUS-041 Legacy NST date-window sustainability stats (single player row)

- **Match:** Opus only; Opus SUS-007; Codex —
- **Purpose:** For a season and optional date window, return one player's S%, xS%, IPP, oiSH%, secA%, SOG/60, oZS% and individual chance counts.
- **Where:** `web/pages/api/SustainabilityStats/[playerId].ts:53 (getStats)`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: per 60, shots on goal; generation: current
- **Opus view (SUS-007):**
  - Method: Single-row reads; xS% = ixG/Shots; secA% = A2/Total Assists; SOG/60 = Shots / TOI minutes (lib/NHL/TOI parseTime) * 60; S%, IPP, oiSH%, oZS% divided by 100.
  - Inputs/units: NST percentages 0-100; TOI decimal minutes; sources: Natural Stat Trick playerteams.php (scraped), NHL player lookup via lib/NHL/server
  - Output scale: fractions 0-1; SOG/60 per-60; writes: —
  - Status: live — hooks/useSustainabilityStats.ts; route ledger calls=1
  - Consumers: web/hooks/useSustainabilityStats.ts
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: NST per-60 convention
  - Fixtures/test data: none listed
  - Tests: `web/__tests__/pages/api/SustainabilityStats/[playerId].test.ts`
- **Leads (not audited):**
  - (opus) NST team filter uses the player's CURRENT team, so a traded player's earlier-team games in the window are excluded
  - (opus) 'TOI' from NST with rate=n is decimal minutes; lib/NHL/TOI parseTime returns Number() for dotted strings, so correct, but the same helper name in ThreeYearAverages returns seconds

## M-SUS-042 Sustainability luck pressure (served)

- **Match:** Opus only; Opus SUS-008; Codex —
- **Purpose:** Rank hot/cold sustainability rows by a weighted luck z-sum.
- **Where:** `web/pages/api/v1/sustainability/trends.ts:196-247 (handler row map)`
- **Tags (heuristic):** generation: current
- **Opus view (SUS-008):**
  - Method: luck_pressure = -(w_shp*z_shp + w_oishp*z_oishp + w_ipp*z_ipp + w_ppshp*z_ppshp) (missing -> 0), passed through lib/sustainability/guardrails; component_breakdown contrib = z*w; sort desc for 'hot', asc for 'cold'.
  - Inputs/units: z-scores; weights from config; sources: sustainability_scores
  - Output scale: signed weighted z-sum; writes: —
  - Status: live — SustainabilityCard on FORGE dashboard; route ledger calls=8
  - Consumers: web/components/forge-dashboard/SustainabilityCard.tsx; web/pages/FORGE.tsx
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED in route; weights come from lib/sustainability config
  - External references: Shooting% / on-ice SH% / IPP regression to mean (Tango); PDO luck
  - Fixtures/test data: none listed
  - Tests: `web/__tests__/pages/api/v1/sustainability/trends.test.ts`; `web/hooks/useDashboardData.test.tsx`
- **Leads (not audited):**
  - (opus) luck_pressure is the NEGATED weighted sum but component_breakdown contrib is not negated, so components do not add up to the shown total
  - (opus) z_soft is set equal to z_raw and r/n are null (placeholder fields)
  - (opus) missing z values default to 0 (neutral) silently

## M-SUS-043 trendsDebug sustainability-model feature engineering (recent-vs-career z-like, aggregate delta, usage delta) and demo model

- **Match:** Opus only; Opus SUS-009; Codex —
- **Purpose:** Admin debug page derives features from a rolling-metric row and feeds lib/sustainability/model (probabilities, score, count projections) using an in-page demo-trained model.
- **Where:** `web/pages/trendsDebug.tsx:140 (DEMO_MODEL = trainSustainabilityProbabilityModel on 6 synthetic rows)`; `web/pages/trendsDebug.tsx:317 (normalizePercentLike: >1 -> /100)`; `web/pages/trendsDebug.tsx:322 (normalizePdo: >10 -> /1000, null -> 1)`; `web/pages/trendsDebug.tsx:332 (safePercentChange)`; `web/pages/trendsDebug.tsx:337 (toPer60 = count*3600/toiSeconds)`; `web/pages/trendsDebug.tsx:1229 (aggregateDelta)`; `web/pages/trendsDebug.tsx:1234 (zLike)`; `web/pages/trendsDebug.tsx:1332 (computed: predict, projectCountMetric, buildSustainabilityScore)`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: per 60, per game; generation: development
- **Opus view (SUS-009):**
  - Method: usageDelta = (toiRecent - toiCareer)/\|toiCareer\|; aggregateDelta = mean of pct-changes of shots/60, ixG/60, PP share (last5 vs career); zLike = mean of (shotsRecent-shotsCareer)/max(0.2*shotsCareer, 0.4) and (ixgRecent-ixgCareer)/max(0.2*ixgCareer, 0.08); recent per-60 for counts = avg per-game count (last5)*3600 / avg TOI seconds (last5), default TOI 900 s if missing. Features [shots/60, ixG/60, PP TOI pct, usageDelta, PDO] go to predictSustainabilityProbabilities(DEMO_MODEL); DEMO_MODEL trained in-page (900 iterations, lr 0.12, 350 calibration iterations) on 6 hand-written z-scale vectors (2 cold, 2 normal, 2 hot).
  - Inputs/units: per-60 rates, TOI seconds, PP share percent or fraction (auto-detected), PDO ratio or x1000 (auto-detected); sources: rolling_player_game_metrics (via rollingPlayerValidationPayload)
  - Output scale: z-like (unbounded), fractional deltas, per-60 rate; downstream probabilities 0-1; writes: —
  - Status: draft — admin-only debug page /trendsDebug
  - Consumers: /trendsDebug admin page (user.role === 'admin')
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED for the feature formulas (page is a validation/debug console for rolling metrics; recompute notes at web/pages/trendsDebug.tsx:229-239)
  - External references: none suggested
  - Fixtures/test data: `web/__tests__/pages/trendsDebug.test.tsx`
  - Tests: `web/__tests__/pages/trendsDebug.test.tsx`
- **Leads (not audited):**
  - (opus) DEMO_MODEL is trained on 6 synthetic vectors in roughly -2..+2 z units but scored on raw features (shots/60 ~ 5-12, PDO ~ 1.0, PP pct 0-1) — scale mismatch makes the displayed probabilities meaningless
  - (opus) 'zLike' is not a z-score; denominators of 20% of career with floors 0.4 / 0.08 are magic numbers
  - (opus) normalizePdo divides by 1000 whenever >10, so a 100-scale PDO (e.g. 101.2) becomes 0.1012
  - (opus) per-60 from ratio of averages (avg count / avg TOI) differs from the stored per-60 rolling fields used for shots/ixG in the same feature vector

## M-SUS-044 Sustainability Sandbox band-status streaks, streak intensity and barometer pointer

- **Match:** Opus only; Opus SUS-010; Codex —
- **Purpose:** Classify each snapshot as hot/cold/neutral against its trend band, build streak segments, and map the raw sustainability score onto a 0-100 barometer.
- **Where:** `web/pages/trendsSandbox.tsx:115 (BAROMETER_MIN=-3, BAROMETER_MAX=3)`; `web/pages/trendsSandbox.tsx:439 (buildStatusTrendBundle: streak segments, intensity, fallback rolling avg)`; `web/pages/trendsSandbox.tsx:593 (ElasticityBandChart status)`; `web/pages/trendsSandbox.tsx:2300 (fallbackBaseline)`; `web/pages/trendsSandbox.tsx:2318 (history status vs ciUpper/ciLower)`; `web/pages/trendsSandbox.tsx:2458 (barometerPointer)`; `web/pages/trendsSandbox.tsx:2961 (table status)`
- **Tags (heuristic):** percent scale: both/ambiguous; generation: current
- **Opus view (SUS-010):**
  - Method: status = hot if value > ciUpper, cold if value < ciLower, else neutral; consecutive same-status rows form a segment; segment intensity = min(1, 0.25 + 0.18*length); point opacity min(1, 0.4 + 0.12*streakLength); rolling line uses row.ewma, falling back to a client rollingAverage with window min(5, n); baseline = latest non-null band baseline else mean of values. Barometer = (clamp(rawScore, -3, 3) + 3)/6 * 100, 50 when missing.
  - Inputs/units: metric units of the band (rates, percentages); rawScore z-like; sources: sustainability trend bands / scores via /api/v1/sustainability/entity-bands, entity-history, entity-scores (lib/sustainability/entitySurface)
  - Output scale: categorical status; intensity 0-1; barometer 0-100; writes: —
  - Status: live — /trendsSandbox
  - Consumers: /trendsSandbox band chart, streak shading, barometer
- **Audit context:**
  - Intent (Opus): web/lib/navigation/analyticsSurfaceOwnership.ts:143 'comparing rolling output against baseline expectation bands and highlighting overperformance or underperformance'
  - External references: none suggested
  - Fixtures/test data: `web/__tests__/pages/trendsSandbox.test.tsx`
  - Tests: `web/__tests__/pages/trendsSandbox.test.tsx (barometerPointer presence)`
- **Leads (not audited):**
  - (opus) separate client streak logic from ROLL-028 (lib/trends/utils hot/cold streak detection) — two definitions of 'hot streak' on trend surfaces
  - (opus) barometer assumes rawScore is on a +/-3 z-like scale; values beyond are clipped silently
  - (opus) fallback baseline = mean of displayed history when no band baseline exists (mixes windows)

## M-SUS-045 Python synthetic benchmark data generator

- **Match:** Opus only; Opus SUS-016; Codex —
- **Purpose:** Synthetic per-game stats for pipeline timing.
- **Where:** `functions/lib/sustainability/benchmark.py:31 (_synthetic_games)`; `functions/lib/sustainability/benchmark.py:79 (run_performance_benchmark)`
- **Tags (heuristic):** generation: legacy, research
- **Opus view (SUS-016):**
  - Method: 70% F; shots ~ random.poisson(3.2) if available else int(gauss(3.2,1.2)); goals Binomial(shots,.11); oiSF=shots+int(gauss(15,4)); oiGF Binomial(oiSF,.08); points=goals; ixG=Σgoals U(.6,1.1)+Σmisses U(.05,.12); icf=shots+int(gauss(2,1)); hdcf=goals+gauss(1.2,.8).
  - Inputs/units: —; sources: —
  - Output scale: synthetic counts; writes: —
  - Status: legacy/dead (offline research only) — functions/lib/sustainability/README.md: 'offline-only and non-canonical'; persistence raises OfflinePersistenceDisabledError; benchmark only
  - Consumers: (benchmark only)
- **Audit context:**
  - Intent (Opus): benchmark.py docstring:1-19
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `functions/tests/test_benchmark.py`
- **Leads (not audited):**
  - (opus) Python stdlib random has no poisson, so the gauss fallback always runs (docstring claims Poisson)
  - (opus) n_games>=60 yields an invalid date (g_idx 59 -> '2025-02-29')

## M-SUS-046 Joined feature row as-of selection

- **Match:** Opus only; Opus SUS-018; Codex —
- **Purpose:** Pick latest-as-of rolling, baseline, season, WGO and NST rows for a player/date.
- **Where:** `web/lib/sustainability/dataJoins.ts:58 (latestAsOf)`; `web/lib/sustainability/dataJoins.ts:81 (buildSustainabilityJoinedFeatureRow)`
- **Tags (heuristic):** generation: legacy
- **Opus view (SUS-018):**
  - Method: Filter date<=snapshot, take latest; baseline buckets win_season_prev/win_3yr/win_career by metric key.
  - Inputs/units: —; sources: —
  - Output scale: —; writes: —
  - Status: legacy/dead — no non-test caller found
  - Consumers: (tests only)
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/sustainability/dataJoins.test.ts`
- **Leads (not audited):**
  - (opus) seasonTotal picks matching season or newest season if seasonId null

## M-SUS-047 Legacy NST sustainability stats (S%, xS%, IPP, oiSH%, secA%, SOG/60, oZS%)

- **Match:** Opus only; Opus SUS-023; Codex —
- **Purpose:** Scrape NST player page and derive sustainability rates for the legacy chart.
- **Where:** `web/pages/api/SustainabilityStats/[playerId].ts:53 (getStats)`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: per 60, shots on goal; generation: current
- **Opus view (SUS-023):**
  - Method: S%=SH%/100; xS%=ixG/Shots; IPP=IPP/100; oiSH%=On-Ice SH%/100; secA%=A2/A (0 on NaN); SOG/60=Shots/TOI_minutes*60; oZS%=OZS%/100; plus raw iHDCF, iSCF, ixG, goals. Player matched by full name within team.
  - Inputs/units: NST percent 0-100; TOI mm:ss -> minutes; sources: Natural Stat Trick playerteams.php (sit=all)
  - Output scale: fractions 0-1; SOG per 60; writes: —
  - Status: live — pages/charts.tsx renders SustainabilityVSCareerChart
  - Consumers: hooks/useSustainabilityStats -> components/SustainabilityVSCareerChart
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: NST definitions
  - Fixtures/test data: none listed
  - Tests: `web/__tests__/pages/api/SustainabilityStats/[playerId].test.ts`
- **Leads (not audited):**
  - (opus) NST request on each call (rate-limited source; cached by fetchNstTextWithCacheByUrl)
  - (opus) name-equality player match may fail on accents/duplicates; traded players filtered by current team only

## M-SUS-048 Sandbox tier labels (durable / balanced / volatile terciles)

- **Match:** Opus only; Opus SUS-035; Codex —
- **Purpose:** Classify a score into tiers using the tercile cutoffs of the displayed set.
- **Where:** `web/components/sustainability/formatting.ts:10 (quantile)`; `web/components/sustainability/formatting.ts:15 (buildSustainabilityThresholds)`; `web/components/sustainability/formatting.ts:25 (getSustainabilityTier)`
- **Tags (heuristic):** generation: current
- **Opus view (SUS-035):**
  - Method: Sorted scores; lower=sorted[floor((n-1)/3)], upper=sorted[floor((n-1)*2/3)] (empty -> 33.3/66.7). score>=upper durable, <=lower volatile, else balanced.
  - Inputs/units: s_100 0-100; sources: —
  - Output scale: tier enum; writes: —
  - Status: live — components/sustainability used by trends UI
  - Consumers: components/sustainability/SustainabilityBadge.tsx; components/sustainability/SustainabilityTooltip.tsx (sort by \|contrib\|); SustainabilitySparkline (min-max scaling)
- **Audit context:**
  - Intent (Opus): SustainabilityBadge.tsx title 'Descriptive process support index grouped by the supplied score thresholds'
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/components/sustainability/SustainabilityUi.test.tsx`
- **Leads (not audited):**
  - (opus) tiers relative to whatever rows are on screen, so the same score can change tier between views

## M-SUS-049 Sustainability vs career colour rules

- **Match:** Opus only; Opus SUS-036; Codex —
- **Purpose:** Flag a stat red when it is unsustainably above/below career average.
- **Where:** `web/components/SustainabilityVSCareerChart/SustainabilityVSCareerChart.tsx:29 (COLUMNS)`
- **Tags (heuristic):** denominators: per 60, shots on goal; generation: current
- **Opus view (SUS-036):**
  - Method: RED if: S% - career >= 0.02; career xS% - xS% >= 0.02; IPP - career >= 0.05; oiSH% - career >= 0.01; secA% >= career; SOG/60 <= career; career oZS% - oZS% >= 0.05; else BLUE.
  - Inputs/units: fractions 0-1; SOG/60; sources: /api/SustainabilityStats, /api/CareerAverages
  - Output scale: binary flag; writes: —
  - Status: live — pages/charts.tsx
  - Consumers: pages/charts.tsx
- **Audit context:**
  - Intent (Opus): Comment links GitHub issue #14 (SustainabilityVSCareerChart.tsx:27-28)
  - External references: PDO/sh% regression heuristics
  - Fixtures/test data: none listed
  - Tests: none listed
- **Leads (not audited):**
  - (opus) absolute percentage-point thresholds ignore sample size
  - (opus) CareerAverages route is outside this slice

## M-SUS-050 Reason highlights from score components

- **Match:** Opus only; Opus SUS-038; Codex —
- **Purpose:** Pick top numeric component values and phrase them as SD above/below baseline.
- **Where:** `web/lib/sustainability/entitySurface.ts:285 (extractReasonHighlights)`; `web/lib/sustainability/read.ts:29 (buildExplanations)`
- **Tags (heuristic):** generation: current
- **Opus view (SUS-038):**
  - Method: entitySurface: every finite numeric entry in components sorted by \|value\|, top 4, text 'running above/below baseline by \|v\| standard deviations'; fallback lists weights. read.ts: only keys starting z_, top 3 by \|z\|.
  - Inputs/units: z-scores; sources: sustainability_scores, entity_sustainability_scores_daily
  - Output scale: SD units text; writes: —
  - Status: live — trendsSandbox / player read route
  - Consumers: trendsSandbox; /api/v1/sustainability/player/[playerId]
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/sustainability/entitySurface.test.ts`; `web/lib/sustainability/read.test.ts`
- **Leads (not audited):**
  - (opus) entitySurface treats ANY numeric component (e.g. extremeThreshold=5) as a z-score and describes it in SD units — misleading text
  - (opus) clipped/imputed-zero z values shown as real signal

## M-SUS-051 Recompute verification and distribution drift

- **Match:** Opus only; Opus SUS-042; Codex —
- **Purpose:** Compare recomputed sample scores with stored ones and today's distribution with prior days.
- **Where:** `web/lib/sustainability/observability.ts:5 (buildSustainabilityExtremeMetadata)`; `web/lib/sustainability/observability.ts:40 (compareSustainabilityScoreSample)`; `web/lib/sustainability/observability.ts:76 (compareSustainabilityDistributionDrift)`
- **Tags (heuristic):** generation: current
- **Opus view (SUS-042):**
  - Method: Extreme flag \|z\|>5. Sample diff=max(\|Δs_raw\|,\|Δs_100\|) per player/window; alert if max>0.01. Drift: population mean/SD per day; baseline=average of prior-day means/SDs; alert if \|Δmean\|>5 or \|ΔSD\|>5 score points.
  - Inputs/units: s_raw logit units; s_100 0-100; sources: sustainability_scores
  - Output scale: diffs; ok/alert; writes: —
  - Status: live — vercel.json cron 10:42-10:4x UTC daily (rebuild-priors 42 10, rebuild-window-z 43 10, rebuild-score ...); read by /api/v1/sustainability/trends used on pages/FORGE.tsx and components/forge-dashboard/SustainabilityCard.tsx
  - Consumers: rebuild-score route response
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/sustainability/observability.test.ts`
- **Leads (not audited):**
  - (opus) max(\|Δs_raw\|,\|Δs_100\|) mixes units (logit vs 0-100)

## M-SUS-052 Sustainability leaderboard filters and rookie flag

- **Match:** Opus only; Opus SUS-043; Codex —
- **Purpose:** Rank scores by s_100 with min games, min score, rookie filters.
- **Where:** `web/lib/sustainability/read.ts:230 (shapeSustainabilityLeaderboardPayload)`; `web/lib/sustainability/read.ts:293 (getSustainabilityLeaderboardPayload)`
- **Tags (heuristic):** generation: current
- **Opus view (SUS-043):**
  - Method: rookie_status = has current-season totals and no prior-season row with games_played>0; filter games_played>=minGames and s_100>=minScore (in query); sort s_100 desc then player_id; page slice.
  - Inputs/units: s_100 0-100; sources: sustainability_scores, player_totals_unified
  - Output scale: rank order; writes: —
  - Status: live — /api/v1/sustainability/leaderboard (consumer pages not confirmed)
  - Consumers: /api/v1/sustainability/leaderboard
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/sustainability/read.test.ts`
- **Leads (not audited):**
  - (opus) rookie defined by presence in player_totals_unified history only (no NHL GP threshold)

## M-SUS-053 Config identity hashes (TS FNV-1a / Python SHA-256)

- **Match:** Opus only; Opus SUS-044; Codex —
- **Purpose:** Deterministic hash of model weights/constants for provenance.
- **Where:** `web/lib/sustainability/runtimeContract.ts:27 (buildSustainabilityConfigHash)`; `web/lib/sustainability/config.ts:118 (parseActiveSustainabilityConfig)`; `functions/lib/sustainability/config_loader.py:112 (compute_hash)`
- **Tags (heuristic):** generation: current
- **Opus view (SUS-044):**
  - Method: TS: stable key-sorted stringify, FNV-1a 32-bit -> 'fnv1a_xxxxxxxx'; active config must equal SUSTAINABILITY_SCORE_CONFIG_HASH fnv1a_e11d5c91 for seed. Python: sha256 of canonical JSON.
  - Inputs/units: —; sources: model_sustainability_config
  - Output scale: hash string; writes: —
  - Status: live (TS) — loadActiveSustainabilityConfig in rebuild-score
  - Consumers: rebuild-score, trend bands provenance
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/sustainability/config.test.ts`; `web/lib/sustainability/runtimeContract.test.ts`
- **Leads (not audited):**
  - (opus) two hash schemes for 'the same' config; not comparable across TS/Python

## M-SUS-054 Luck pressure (trends sort key)

- **Match:** Opus only; Opus SUS-046; Codex —
- **Purpose:** Signed luck-only contribution used to rank 'hot'/'cold' players on the trends feed.
- **Where:** `web/pages/api/v1/sustainability/trends.ts:202 (luckPressure)`; `web/components/forge-dashboard/SustainabilityCard.tsx:59 (confidenceLabel)`
- **Tags (heuristic):** generation: current
- **Opus view (SUS-046):**
  - Method: luckPressure = -(w_shp*z_shp + w_oishp*z_oishp + w_ipp*z_ipp + w_ppshp*z_ppshp); clamped ±12 by guardrails; sorted desc for direction=hot, asc for cold. Component breakdown contrib=z*w. Dashboard 'Trust' label: \|pressure\|>=1.25 High, >=0.75 Medium, else Low.
  - Inputs/units: z-scores × weights; sources: sustainability_scores
  - Output scale: signed luck pressure (approx ±12); writes: —
  - Status: live — pages/FORGE.tsx fetches /api/v1/sustainability/trends (l10, hot/cold, limit 3)
  - Consumers: pages/FORGE.tsx; components/forge-dashboard/SustainabilityCard.tsx
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED (dashboard copy)
  - External references: PDO / sh% regression literature
  - Fixtures/test data: none listed
  - Tests: `web/__tests__/pages/api/v1/sustainability/trends.test.ts`
- **Leads (not audited):**
  - (opus) 'Trust' High/Medium/Low thresholds 1.25/0.75 are magic numbers and not calibrated confidence
  - (opus) z_soft reported equal to z_raw (no soft clipping), r and n null in breakdown

## M-SUS-055 Trend-band per-game samples (gamma/beta/normal collectors)

- **Match:** Opus only; Opus SUS-047; Codex —
- **Purpose:** Turn game logs into count/exposure, success/trial or value samples per metric.
- **Where:** `web/lib/sustainability/bandCalculator.ts:190 (collectGammaSamples)`; `web/lib/sustainability/bandCalculator.ts:285 (collectBetaSamples)`; `web/lib/sustainability/bandCalculator.ts:329 (collectNormalSamples)`; `web/lib/sustainability/bandService.ts:98 (fetchPlayerGameRows limit 40)`
- **Tags (heuristic):** denominators: per 60, per game, shots on goal; generation: current
- **Opus view (SUS-047):**
  - Method: gamesAgo=row index (newest 0). Gamma exposure minutes = (nst_toi ?? toi_per_game*60)/60. Beta: ipp=points/nst_oi_gf; sh_pct=goals/shots; on_ice_sh=GF/SF; on_ice_sv=(SA-GA)/SA. Normal: pp_toi_pct value per game (exposure 1); pdo value with exposure max(SF+SA,1); fantasy_score = G*GOALS + A*ASSISTS + PPP*PP_POINTS + SOG*SHOTS_ON_GOAL + HIT*HITS + BLK*BLOCKED_SHOTS (default skater config).
  - Inputs/units: TOI seconds; counts; sources: player_stats_unified
  - Output scale: samples; writes: —
  - Status: live — vercel.json cron rebuild-trend-bands (limit 250, offsets 0-750); read by /api/v1/sustainability/trend-bands, entity-bands, pages/trendsSandbox.tsx
  - Consumers: computeGamma/Beta/NormalBand
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/sustainability/bandCalculator.test.ts`
- **Leads (not audited):**
  - (opus) toi_per_game*60 fallback assumes minutes; WGO toi_per_game elsewhere is treated as seconds (recompute.ts uses >180 heuristic) — possible 60x unit error
  - (opus) pdo exposure weight computed but normal band ignores sample exposure (uses decay weight only)
  - (opus) pp_toi_pct missing -> 0 rather than skipped

## M-SUS-056 Skill window per-60 rates

- **Match:** Opus only; Opus SUS-053; Codex —
- **Purpose:** Player ixG/60, iCF/60, HDCF/60 over last N games.
- **Where:** `web/lib/sustainability/score.ts:71 (fetchSkillWindowRates)`
- **Tags (heuristic):** denominators: per 60; generation: current
- **Opus view (SUS-053):**
  - Method: Last N rows date<=snapshot; skip games with null/<=0 nst_toi; rate=3600*sum(count)/sum(nst_toi seconds); null if toi 0.
  - Inputs/units: nst_toi in seconds; sources: player_stats_unified
  - Output scale: per-60 rate; writes: —
  - Status: live — vercel.json cron 10:42-10:4x UTC daily (rebuild-priors 42 10, rebuild-window-z 43 10, rebuild-score ...); read by /api/v1/sustainability/trends used on pages/FORGE.tsx and components/forge-dashboard/SustainabilityCard.tsx
  - Consumers: buildScoreForPlayerWindow
- **Audit context:**
  - Intent (Opus): Comment score.ts:70 'Window rates from game logs (sum counts / sum TOI -> per60)'
  - External references: NST per-60 convention
  - Fixtures/test data: none listed
  - Tests: `web/lib/sustainability/score.test.ts`
- **Leads (not audited):**
  - (opus) nst_hdcf is an on-ice (HDCF) count, compared to nst_hdcf_per_60 — individual vs on-ice semantics not confirmed; Python uses 'hdcf' too
  - (opus) no season filter on window

## M-SUS-057 Window rolling counts (l3/l5/l10/l20) for luck stats

- **Match:** Opus only; Opus SUS-054; Codex —
- **Purpose:** Sum successes/trials over a player's last N games up to the snapshot date.
- **Where:** `web/lib/sustainability/windows.ts:67 (fetchWindowCountsAll)`; `web/pages/api/v1/sustainability/rebuild-window-z.ts:46 (windows l3=3,l5=5,l10=10,l20=20)`
- **Tags (heuristic):** denominators: per game; generation: current
- **Opus view (SUS-054):**
  - Method: Last N rows by date desc with date<=snapshot (no season filter). shp=(sum goals, sum shots); oishp=(sum nst_oi_gf, sum nst_oi_sf); ipp=(sum points over games with non-null nst_oi_gf, sum nst_oi_gf); ppshp=(sum pp_goals, sum pp_shots).
  - Inputs/units: per-game counts; sources: player_stats_unified
  - Output scale: counts; writes: —
  - Status: live — vercel.json cron 10:42-10:4x UTC daily (rebuild-priors 42 10, rebuild-window-z 43 10, rebuild-score ...); read by /api/v1/sustainability/trends used on pages/FORGE.tsx and components/forge-dashboard/SustainabilityCard.tsx (rebuild-window-z ×4 offsets at 43 10)
  - Consumers: rebuildBetaWindowZForSnapshot
- **Audit context:**
  - Intent (Opus): Comment windows.ts:61-66 lists the per-stat successes/trials definitions
  - External references: NST rolling-window convention
  - Fixtures/test data: none listed
  - Tests: `web/__tests__/pages/api/v1/sustainability/rebuild-window-z.test.ts`; `web/lib/sustainability/windows.test.ts`
- **Leads (not audited):**
  - (opus) no season filter — l10/l20 windows early in a season include prior-season games
  - (opus) games are rows not appearances; a row with null shots counts as a game with 0 trials

## M-SUS-058 Skill stabilizer league reference (mu, sigma of per-60)

- **Match:** Opus only; Opus SUS-057; Codex —
- **Purpose:** League mean and SD of player season ixG/60, iCF/60, HDCF/60 by position for skill z-scores.
- **Where:** `web/lib/sustainability/score.ts:23 (fetchSkillLeagueRef)`
- **Tags (heuristic):** denominators: per 60; generation: current
- **Opus view (SUS-057):**
  - Method: Per position group for the requested season: mu=mean over players with non-null rate; sig=sample SD (n-1), floored 1e-6; empty -> mu 0, sig 1. Unweighted by TOI.
  - Inputs/units: per-60 rates (NST); sources: player_totals_unified
  - Output scale: mu/sigma in per-60 units; writes: —
  - Status: live — vercel.json cron 10:42-10:4x UTC daily (rebuild-priors 42 10, rebuild-window-z 43 10, rebuild-score ...); read by /api/v1/sustainability/trends used on pages/FORGE.tsx and components/forge-dashboard/SustainabilityCard.tsx (rebuild-score)
  - Consumers: buildScoreForPlayerWindow
- **Audit context:**
  - Intent (Opus): Comment score.ts:22 'League references (mu, sigma) for each stabilizer stat per season x position group'
  - External references: NST per-60 convention
  - Fixtures/test data: none listed
  - Tests: `web/lib/sustainability/score.test.ts`
- **Leads (not audited):**
  - (opus) unweighted across players regardless of TOI — low-TOI players inflate between-player SD
  - (opus) compares a short-window (3-20 game) individual rate against the between-player season distribution SD (mixes within-player noise and between-player spread)
  - (opus) current-season reference, thin early season; empty case sets sig=1 in per-60 units

## M-SUS-059 Count distribution approximation

- **Match:** Codex only; Opus —; Codex core-063
- **Possible related records (low-confidence location link, unconfirmed):** SUS-031
- **Purpose:** Calculate count distribution approximation.
- **Where:** `web/lib/sustainability/features.ts:782 buildCountDistribution`
- **Codex view (core-063, calculation; Codex family 'sustainability features'):** Count distribution approximation
  - Formula: Poisson variance=mean; overdispersed variance=mean+dispersion*mean²; normal-based quantile approximations.
  - Purpose: Calculate count distribution approximation.
  - Inputs/units: Nonnegative expected mean; Poisson or overdispersion.
  - Output scale: Count mean, variance, approximate quantiles.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f; TypeScript sustainability family; canonical runtime per functions/lib/sustainability/README.md. Deployment/data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry…
  - Consumers: ["Other sustainability helpers and rebuild/read API routes; exact runtime activation not established."]
- **Audit context:**
  - Intended contract (Codex core-063): Implementation/type declarations and adjacent comments in web/lib/sustainability/features.ts:782; approval beyond source not established.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/sustainability/features.test.ts`; `Located only; not run for this inventory.`
- **Leads (not audited):**
  - (codex:core-063) ["Inventory only; no correctness or calibration verdict."]

## M-SUS-060 Multi-game count aggregation

- **Match:** Codex only; Opus —; Codex core-064
- **Possible related records (low-confidence location link, unconfirmed):** SUS-031
- **Purpose:** Calculate multi-game count aggregation.
- **Where:** `web/lib/sustainability/features.ts:813 aggregateCountDistributions`
- **Tags (heuristic):** denominators: per game
- **Codex view (core-064, calculation; Codex family 'sustainability features'):** Multi-game count aggregation
  - Formula: Sum independent means/variances; Poisson sum of means; overdispersed sum(mu+dmu²).
  - Purpose: Calculate multi-game count aggregation.
  - Inputs/units: Per-game means and dispersion.
  - Output scale: Summed mean/variance and quantiles.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f; TypeScript sustainability family; canonical runtime per functions/lib/sustainability/README.md. Deployment/data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry…
  - Consumers: ["Other sustainability helpers and rebuild/read API routes; exact runtime activation not established."]
- **Audit context:**
  - Intended contract (Codex core-064): Implementation/type declarations and adjacent comments in web/lib/sustainability/features.ts:813; approval beyond source not established.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/sustainability/features.test.ts`; `Located only; not run for this inventory.`
- **Leads (not audited):**
  - (codex:core-064) ["Inventory only; no correctness or calibration verdict."]

