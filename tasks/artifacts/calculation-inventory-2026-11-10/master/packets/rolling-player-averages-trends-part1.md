# Audit packet: Rolling player averages & trends (part 1 of 2)

Master entries M-ROLL-001 to M-ROLL-060 (60 of 75 in this family). Built from the merged Opus and Codex inventories; see [../MASTER.md](../MASTER.md) and [../MERGE-NOTES.md](../MERGE-NOTES.md).

How to read: each entry gives both inventories' descriptions side by side. **Conflicts** are places where the two descriptions disagree; they are unresolved. **Leads** are Opus red flags and Codex unknowns: observations to check, not audited findings. Tags are keyword heuristics. Line numbers were valid when each inventory was written on 2026-11-10 (Opus at d31dcb33f, Codex at 11e4192d3); re-check against the current checkout.

| ID | Name | Match | Conflicts | Leads |
|---|---|---|---:|---:|
| M-ROLL-001 | Player trend rolling averages, running mean and variance | Both | 0 | 49 |
| M-ROLL-002 | Goalie trend percentile series | Both | 0 | 4 |
| M-ROLL-003 | Skater trend percentile series with low-sample shrink | Both | 0 | 6 |
| M-ROLL-004 | GP% / availability and split-strength participation | Both | 0 | 5 |
| M-ROLL-005 | Finishing ratios: shooting %, expected shooting %, primary points % | Both | 0 | 7 |
| M-ROLL-006 | Goalie trend metric definitions | Both | 0 | 4 |
| M-ROLL-007 | Legacy trailing simple rolling average | Both | 0 | 3 |
| M-ROLL-008 | Legacy smoothstep confidence multiplier | Both | 0 | 3 |
| M-ROLL-009 | Legacy empirical score thresholds (quantiles) | Both | 0 | 3 |
| M-ROLL-010 | Legacy sKO characteristic-game classifier (z-scores, weighted chi-squ… | Both | 0 | 8 |
| M-ROLL-011 | Individual points percentage (IPP) | Both | 0 | 3 |
| M-ROLL-012 | On-ice shooting %, on-ice save %, PDO | Both | 0 | 5 |
| M-ROLL-013 | Possession and zone-start shares (CF%, FF%, OZ start %) | Both | 0 | 7 |
| M-ROLL-014 | Per-60 weighted rate metrics | Both | 0 | 9 |
| M-ROLL-015 | Individual expected goals (ixG) source resolution and ixG/60 | Both | 0 | 2 |
| M-ROLL-016 | PP TOI and team PP share (pp_share_pct) | Both | 0 | 4 |
| M-ROLL-017 | Power-play unit usage metrics | Both | 0 | 3 |
| M-ROLL-018 | Skater trend metric definitions (per-60 fallbacks, primary points %, … | Both | 0 | 14 |
| M-ROLL-019 | SKO luck deltas, sustainability composite and role classifier | Both | 0 | 6 |
| M-ROLL-020 | Trend rolling average and hot/cold streak detection | Both | 0 | 3 |
| M-ROLL-021 | Team rolling STD and last-10 (LTG) averages | Both | 0 | 5 |
| M-ROLL-022 | Trends sandbox statistics helpers (mean, SD, z-score, percentile, win… | Both | 0 | 4 |
| M-ROLL-023 | Ratio support-component outputs | Both | 0 | 2 |
| M-ROLL-024 | Social share Hot/Cold Recent Form (recent-form-v1-early) | Opus only | 0 | 3 |
| M-ROLL-025 | Social share per-60 rate standouts (L5 vs season) | Opus only | 0 | 3 |
| M-ROLL-026 | Social share per-game series reconstruction from cumulative and windo… | Opus only | 0 | 2 |
| M-ROLL-027 | Additive metric rolling sums/means and historical per-game averages | Opus only | 0 | 3 |
| M-ROLL-028 | Player trend page: rolling-vs-baseline delta %, hot/cold streak and L… | Opus only | 0 | 4 |
| M-ROLL-029 | Player trend / team power / rolling-player repair reconciliation audi… | Opus only | 0 | 2 |
| M-ROLL-030 | Rolling-window stat averages, std, OLS trend slope and form features … | Opus only | 0 | 3 |
| M-ROLL-031 | Trend window/limit constants and category direction | Opus only | 0 | 2 |
| M-ROLL-032 | Line combination slot/group and PP unit context labels | Opus only | 0 | 1 |
| M-ROLL-033 | Aligned count support pairs (goals per shot, assists per goal) | Opus only | 0 | 2 |
| M-ROLL-034 | SKO inputs: IPP and SOG/60 | Opus only | 0 | 3 |
| M-ROLL-035 | Additive metric source precedence (NST counts vs WGO) | Opus only | 0 | 3 |
| M-ROLL-036 | Trend surface leader selection | Opus only | 0 | 2 |
| M-ROLL-037 | Team rolling opponent-record strength of schedule | Opus only | 0 | 3 |
| M-ROLL-038 | TOI resolution, trust tiers and WGO minutes/seconds normalization | Opus only | 0 | 3 |
| M-ROLL-039 | Playoff skater TOI normalisation | Opus only | 0 | 1 |
| M-ROLL-040 | Legacy GP and _avg_/_total_ alias outputs and compatibility resolution | Opus only | 0 | 2 |
| M-ROLL-041 | Pipeline diagnostics: scale bounds, ratio re-check, source tail lag | Opus only | 0 | 1 |
| M-ROLL-042 | Validation recompute comparison and reconstruction helpers | Opus only | 0 | 3 |
| M-ROLL-043 | Team game ledger, season-id derivation and appearance anchor | Opus only | 0 | 2 |
| M-ROLL-044 | Ratio-of-sums rolling/historical aggregation engine | Opus only | 0 | 4 |
| M-ROLL-045 | Rolling window contracts and metric-to-family map | Opus only | 0 | 2 |
| M-ROLL-046 | assists | Codex only | 0 | 1 |
| M-ROLL-047 | blocks | Codex only | 0 | 1 |
| M-ROLL-048 | cf | Codex only | 0 | 1 |
| M-ROLL-049 | dz_starts | Codex only | 0 | 1 |
| M-ROLL-050 | ff | Codex only | 0 | 1 |
| M-ROLL-051 | goals | Codex only | 0 | 1 |
| M-ROLL-052 | hits | Codex only | 0 | 1 |
| M-ROLL-053 | ihdcf | Codex only | 0 | 1 |
| M-ROLL-054 | iscf | Codex only | 0 | 1 |
| M-ROLL-055 | ixg | Codex only | 0 | 1 |
| M-ROLL-056 | nz_starts | Codex only | 0 | 1 |
| M-ROLL-057 | oi_ga | Codex only | 0 | 1 |
| M-ROLL-058 | oi_gf | Codex only | 0 | 1 |
| M-ROLL-059 | oi_sa | Codex only | 0 | 1 |
| M-ROLL-060 | oi_sf | Codex only | 0 | 1 |

## M-ROLL-001 Player trend rolling averages, running mean and variance

- **Match:** Both; Opus ROLL-005; Codex core-149, core-150, core-151, core-152, core-153, core-154, core-155, core-156, core-157, core-158, core-159, core-160, core-161, core-162, core-163, core-164, core-165, core-166, core-167, core-168, core-169, core-170, core-171, core-172, core-173, core-174, core-175, core-176, core-177, core-178, core-179, core-180, core-181, core-182, core-183, core-184, core-185, core-186, core-187, core-188, core-189, core-190, core-191, core-192, core-193
- **Purpose:** Per player per metric per game: raw value, cumulative mean, L3/L5/L10 rolling mean, sample variance and SD
- **Where:** `web/lib/trends/playerTrendCalculator.ts:160 (processMetric)`; `web/lib/trends/playerTrendCalculator.ts:132 (computeRollingAverage)`; `web/lib/trends/playerTrendCalculator.ts:141 (computeSampleVariance)`; `web/lib/trends/playerTrendCalculator.ts:652 (buildPlayerTrendRecords)`; `web/lib/trends/playerTrendCalculator.ts:240 shots_per_60`; `web/lib/trends/playerTrendCalculator.ts:160 processMetric`; `web/lib/trends/playerTrendCalculator.ts:259 ixg_per_60`; `web/lib/trends/playerTrendCalculator.ts:278 shooting_percentage`; `web/lib/trends/playerTrendCalculator.ts:285 ixg_total`; `web/lib/trends/playerTrendCalculator.ts:292 primary_points_pct`; `web/lib/trends/playerTrendCalculator.ts:307 expected_shooting_pct`; `web/lib/trends/playerTrendCalculator.ts:325 ipp` …
- **Tags (heuristic):** denominators: per 60, per game, unblocked attempts; generation: current
- **Opus view (ROLL-005):**
  - Method: Accumulator per player+metric across ALL supplied history (no season reset; version 'full-history'). Null values skipped (not zero). average = sum/count; rolling_avg_k = simple mean of last k non-null values, null until k values; variance = (sumSq - sum^2/n)/(n-1), clamped >=0, null if n<2; SD = sqrt. Records emitted only from emitFromDate (7-day repair window).
  - Inputs/units: per-game metric values in source units (see skater/goalie definitions); one row per player-date; sources: player_stats_unified, goalie_stats_unified, wgo_skater_stats_playoffs
  - Output scale: same units as input; rolling L3/L5/L10 simple means of non-null values; sample variance/SD; sample_size count; writes: player_trend_metrics
  - Status: live — cron job update-player-trend-metrics (web/lib/cron/cronInventory.ts:54; tasks/TASKS/cron-operations/cron-schedule.md:752 '0 12 * * *' POST /api/v1/db/update-player-trend-metrics -> rebuildPlayerTrends in pages/api/v1/trends/player-trends.ts); read by pages/api/v1/trends/skater-power.ts:571 and goalie-power.ts:436
  - Consumers: pages/api/v1/trends/player-trends.ts; skater-power and goalie-power trends APIs; trends pages; scripts/audit-player-trend-*
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
  - Intent (Opus): web/lib/trends/playerTrendCalculator.ts:15-16 version 'player-trend-v2-full-history-source-units'; web/lib/trends/playerTrendRebuildScope.ts:1 7-day repair window; scripts/audit-player-trend-playoff-repair.ts:349
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
  - External references: Simple moving average over last N games; ratio-of-sums vs mean-of-ratios convention
  - Fixtures/test data: `web/scripts/audit-player-trend-playoff-repair.ts`; `web/scripts/audit-player-trend-expected-shooting.ts`; `web/lib/trends/playerTrendCalculator.test.ts (inline rows)`
  - Tests: `Located only; not run for this inventory.`; `web/__tests__/pages/api/v1/trends/player-trends.test.ts`; `web/lib/trends/playerTrendCalculator.test.ts`
- **Leads (not audited):**
  - (opus) rolling and season averages of rate/percent metrics (SH%, PDO, CF%, per-60s, save%, GAA) are means of per-game ratios, not ratio-of-sums (unweighted by shots/TOI)
  - (opus) cumulative average and variance span seasons and regular+playoff rows (no season reset)
  - (opus) rolling windows count only non-null games, so L10 can span more than 10 games when a metric is missing
  - (opus) running sumSquares variance formula is numerically unstable for large totals (mitigated by clamp)
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

## M-ROLL-002 Goalie trend percentile series

- **Match:** Both; Opus ROLL-006; Codex core-360, core-361
- **Purpose:** Same percentile-by-game-number ranking for goalie trend categories.
- **Where:** `web/pages/api/v1/trends/goalie-power.ts:199 (computeTrailingAverage)`; `web/pages/api/v1/trends/goalie-power.ts:216 (computePercentiles)`; `web/pages/api/v1/trends/goalie-power.ts:238 (buildCategoryResult)`; `web/pages/api/v1/trends/goalie-power.ts:216 computePercentiles`; `web/pages/api/v1/trends/goalie-power.ts:199 computeTrailingAverage`
- **Tags (heuristic):** percent scale: 0-100; denominators: per game; generation: current
- **Opus view (ROLL-006):**
  - Method: Identical to skater version (idx/(n-1)*100, trailing means), but WITHOUT the 10-game shrink toward 50.
  - Inputs/units: per-game goalie metric values; sources: player_trend_metrics, players
  - Output scale: percentile 0-100; rank 1..N; writes: —
  - Status: live — lib/dashboard/dataFetchers.ts; route ledger calls=1
  - Consumers: web/lib/dashboard/dataFetchers.ts
- **Codex view (core-360, calculation, location; Codex family 'player power trends'):** Goalie category ordinal percentiles
  - Formula: Sort values ascending; percentile = 100*index/(n-1), inverted for lower-is-better. Equal values retain separate sorted positions.
  - Purpose: Provide goalie category ordinal percentiles for the identified consumer.
  - Inputs/units: Finite per-player metric or trailing-average values; metric direction.
  - Output scale: Percentile on 0–100; singleton 50.
  - Version/status: Local working tree on octoberBranch, read on 2026-11-10. HEAD changed during the inventory from d31dcb33f72d4c9d69b507874c388f0cd549fe2f to 11e4192d36ecc4ac4b338f9ab48e529c7049c618. This is a non-atomic local scan; deployment and persisted-data state are not verified. Referenced implementation files had no tracked/untracked status entry at the final status check.
- **Codex view (core-361, calculation, location; Codex family 'player power trends'):** Goalie trailing metric means
  - Formula: Mean finite values in the last up-to-sampleSize positions ending at index.
  - Purpose: Provide goalie trailing metric means for the identified consumer.
  - Inputs/units: Ordered category points, selected index and trailing sample size.
  - Output scale: Native-unit mean or null.
  - Version/status: Local working tree on octoberBranch, read on 2026-11-10. HEAD changed during the inventory from d31dcb33f72d4c9d69b507874c388f0cd549fe2f to 11e4192d36ecc4ac4b338f9ab48e529c7049c618. This is a non-atomic local scan; deployment and persisted-data state are not verified. Referenced implementation files had no tracked/untracked status entry at the final status check.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex core-360): Function signature and comments at web/pages/api/v1/trends/goalie-power.ts:216 computePercentiles; independent product specification not verified.
  - Intended contract (Codex core-361): Function signature and comments at web/pages/api/v1/trends/goalie-power.ts:199 computeTrailingAverage; independent product specification not verified.
  - External references: Percentile rank; goalie samples need heavier regression (save% stabilizes slowly)
  - Fixtures/test data: none listed
  - Tests: `Located only; not run for this inventory.`; `web/__tests__/pages/api/v1/trends/goalie-power.test.ts`
- **Leads (not audited):**
  - (opus) no low-sample stabilization for goalies although skaters get one, and goalie metrics are noisier
  - (opus) same gp-index alignment and tie handling as skater version
  - (codex:core-360) ["Calculation inventory only; no correctness or model-quality verdict."]
  - (codex:core-361) ["Calculation inventory only; no correctness or model-quality verdict."]

## M-ROLL-003 Skater trend percentile series with low-sample shrink

- **Match:** Both; Opus ROLL-007; Codex core-358, core-359, core-362
- **Purpose:** Rank skaters per trend category by percentile of their windowed value at each game number and compute rank movement.
- **Where:** `web/pages/api/v1/trends/skater-power.ts:278 (computeTrailingAverage)`; `web/pages/api/v1/trends/skater-power.ts:295 (computePercentiles)`; `web/pages/api/v1/trends/skater-power.ts:317 (stabilizePercentileForSample)`; `web/pages/api/v1/trends/skater-power.ts:336 (buildCategoryResult)`; `web/pages/api/v1/trends/skater-power.ts:295 computePercentiles`; `web/pages/api/v1/trends/skater-power.ts:278 computeTrailingAverage`; `web/pages/api/v1/trends/skater-power.ts:317 stabilizePercentileForSample`
- **Tags (heuristic):** percent scale: 0-100; denominators: per game; generation: current
- **Opus view (ROLL-007):**
  - Method: Value per player game index gp: stored rolling avg (3/5/10) else trailing mean of last N raw values; window 20 always trailing mean; window 1 raw. At each gp, players are sorted and percentile = idx/(n-1)*100 (inverted if lower is better; single player = 50). If gp < MIN_TREND_SAMPLE_GAMES=10, percentile shrunk toward 50: 50 + (raw-50)*gp/10. Rank by latest percentile; delta = previous qualified rank - current rank; low-sample rows get delta 0.
  - Inputs/units: per-game metric values as stored in player_trend_metrics; sources: player_trend_metrics, players
  - Output scale: percentile 0-100; rank 1..N; writes: —
  - Status: live — HotColdCard on FORGE dashboard; route ledger calls=7
  - Consumers: web/components/forge-dashboard/HotColdCard.tsx; web/lib/dashboard/dataFetchers.ts; web/lib/dashboard/commandCenterData.ts; web/pages/trends/placeholder.tsx
- **Codex view (core-358, calculation, location; Codex family 'player power trends'):** Skater category ordinal percentiles
  - Formula: Sort values ascending; percentile = 100*index/(n-1), inverted for lower-is-better. Equal values retain separate sorted positions.
  - Purpose: Provide skater category ordinal percentiles for the identified consumer.
  - Inputs/units: Finite per-player metric or trailing-average values; metric direction.
  - Output scale: Percentile on 0–100; singleton 50.
  - Version/status: Local working tree on octoberBranch, read on 2026-11-10. HEAD changed during the inventory from d31dcb33f72d4c9d69b507874c388f0cd549fe2f to 11e4192d36ecc4ac4b338f9ab48e529c7049c618. This is a non-atomic local scan; deployment and persisted-data state are not verified. Referenced implementation files had no tracked/untracked status entry at the final status check.
- **Codex view (core-359, calculation, location; Codex family 'player power trends'):** Skater trailing metric means
  - Formula: Mean finite values in the last up-to-sampleSize positions ending at index.
  - Purpose: Provide skater trailing metric means for the identified consumer.
  - Inputs/units: Ordered category points, selected index and trailing sample size.
  - Output scale: Native-unit mean or null.
  - Version/status: Local working tree on octoberBranch, read on 2026-11-10. HEAD changed during the inventory from d31dcb33f72d4c9d69b507874c388f0cd549fe2f to 11e4192d36ecc4ac4b338f9ab48e529c7049c618. This is a non-atomic local scan; deployment and persisted-data state are not verified. Referenced implementation files had no tracked/untracked status entry at the final status check.
- **Codex view (core-362, calculation, location; Codex family 'player power trends'):** Small-sample skater percentile stabilization
  - Formula: For fewer than 10 games: 50 + (raw percentile - 50)*clamp(games/10,0,1). At least 10 games keeps raw percentile.
  - Purpose: Provide small-sample skater percentile stabilization for the identified consumer.
  - Inputs/units: Raw percentile 0–100 and games played.
  - Output scale: Shrunk percentile rounded to two decimals; low/qualified sample confidence.
  - Version/status: Local working tree on octoberBranch, read on 2026-11-10. HEAD changed during the inventory from d31dcb33f72d4c9d69b507874c388f0cd549fe2f to 11e4192d36ecc4ac4b338f9ab48e529c7049c618. This is a non-atomic local scan; deployment and persisted-data state are not verified. Referenced implementation files had no tracked/untracked status entry at the final status check.
- **Audit context:**
  - Intent (Opus): Constants MIN_TREND_SAMPLE_GAMES=10 at web/pages/api/v1/trends/skater-power.ts:131; sampleConfidence 'low'/'qualified' contract; otherwise UNDOCUMENTED
  - Intended contract (Codex core-358): Function signature and comments at web/pages/api/v1/trends/skater-power.ts:295 computePercentiles; independent product specification not verified.
  - Intended contract (Codex core-359): Function signature and comments at web/pages/api/v1/trends/skater-power.ts:278 computeTrailingAverage; independent product specification not verified.
  - Intended contract (Codex core-362): Function signature and comments at web/pages/api/v1/trends/skater-power.ts:317 stabilizePercentileForSample; independent product specification not verified.
  - External references: Percentile rank with average ranks for ties; regression toward the mean by sample size (Tango-style k)
  - Fixtures/test data: none listed
  - Tests: `Located only; not run for this inventory.`; `web/__tests__/pages/api/v1/trends/skater-power.test.ts`; `web/hooks/useDashboardData.test.tsx`
- **Leads (not audited):**
  - (opus) players are aligned by their Nth game (gp index), not by calendar date, so a player's 20th game is compared with others' 20th games played weeks apart
  - (opus) tied values receive different percentiles (no tie averaging)
  - (opus) shrink is linear in games up to 10 with no stat-specific reliability constant
  - (codex:core-358) ["Calculation inventory only; no correctness or model-quality verdict."]
  - (codex:core-359) ["Calculation inventory only; no correctness or model-quality verdict."]
  - (codex:core-362) ["Calculation inventory only; no correctness or model-quality verdict."]

## M-ROLL-004 GP% / availability and split-strength participation

- **Match:** Both; Opus ROLL-011; Codex rolling-availability
- **Purpose:** Games played over team games available for season, 3YA, career and last N team games; split strengths report positive-TOI participation.
- **Where:** `web/lib/supabase/Upserts/rollingHistoricalAverages.ts:142 (updateHistoricalGpPctAccumulator)`; `web/lib/supabase/Upserts/rollingHistoricalAverages.ts:189 (getHistoricalGpPctSnapshot)`; `web/lib/supabase/Upserts/rollingHistoricalAverages.ts:231 (getRollingGpPctSnapshot)`; `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:2667 (didPlayerCountAsAppearance)`; `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:2755 (applyGpOutputs)`; `web/lib/supabase/Upserts/rollingPlayerAvailabilityContract.ts:79 (ROLLING_PLAYER_AVAILABILITY_CONTRACT)`; `web/lib/supabase/Upserts/rollingHistoricalAverages.ts:142 updateHistoricalGpPctAccumulator; :189 getHistoricalGpPctSnapshot; :231 getRollingGpPctSnapshot; web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:2755 applyGpOutputs`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: per team game, all strengths; generation: current
- **Opus view (ROLL-011):**
  - Method: Per season-team bucket: playerGames += 1 when played; teamGames = max(previous, team cumulative games through this date); increases add to season and career team-game totals. Ratio = min(1, playerGames/teamGames), null if teamGames 0. 3YA = seasons startYear in [current-2, current]. Rolling last N: teamGames = min(N, current team games), playerGames = player appearances for the current team with team-game index in the last N. All-strength writes *_availability_pct; split strengths write *_participation_* and null availability fields.
  - Inputs/units: game counts (player appearances, team games through date); sources: games, wgo_skater_stats
  - Output scale: fraction 0-1, clamped at 1; writes: rolling_player_game_metrics
  - Status: live — written by /api/v1/db/update-rolling-player-averages, invoked by /api/v1/db/run-rolling-forge-pipeline (web/vercel.json cron '5,10,15,20,30,35,40,45,55 10 * * *' UTC, mode=daily_incremental; lib/rollingForgePipeline.ts:102)
  - Consumers: lib/rankings/*; FORGE availability; pages/trends/player/[playerId].tsx
- **Codex view (rolling-availability, calculation, location; Codex family 'Rolling player metrics'):** availability_pct / gp_pct compatibility / strength participation
  - Purpose: Measure appearances relative to team games across rolling and historical scopes.
  - Inputs/units: Player played flag; cumulative team-game counter; season/team identity; current team and current game index
  - Output scale: min(1, player games/team games), null without denominator. Last3/5/10/20 use current-team last N team games; historical scopes sum cross-stint player/team counters.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
- **Audit context:**
  - Intent (Opus): ROLLING_PLAYER_AVAILABILITY_CONTRACT intendedReplacement: availability = team games appeared / team games available, season scope all stints (web/lib/supabase/Upserts/rollingPlayerAvailabilityContract.ts:75-116); fetchRollingPlayerAverages.ts:2921 'should not collapse to the current team only after a trade'. Note: rollingHistoricalAverages.test.ts:145 encodes the trade case with team 2's counter restarting at 3, whereas the live ledger supplies team 2's full cumulative count
  - Intended contract (Codex rolling-availability): web/lib/supabase/Upserts/rollingPlayerAvailabilityContract.ts and rollingHistoricalAverages.ts:74 HISTORICAL_GP_PCT_CONTRACT explicitly distinguish player-centered historical availability and strength participation. Contract file distinguishes currentImplementation from intendedReplacement and explicitly marks gp_pct_avg fields deprecated aliases, not real averages.
  - External references: GP / team GP (availability rate)
  - Fixtures/test data: `web/lib/supabase/Upserts/fixtures/rollingColumnInventory.json`; `tasks/artifacts/forge-projection-audit-2026-10-21/rolling-column-inventory.json`; `tasks/artifacts/rolling-validation-5v5-recheck-2026-10-28/ (RESULTS.json, snapshot/)`; `tasks/artifacts/forge-rolling-participation-2026-10-17/`
  - Tests: `web/lib/supabase/Upserts/fetchRollingPlayerAverages.test.ts`; `web/lib/supabase/Upserts/rollingHistoricalAverages.test.ts`; `web/lib/supabase/Upserts/rollingPlayerPipelineDiagnostics.test.ts`; `{"discovered_not_run": ["web/lib/supabase/Upserts/rollingHistoricalAverages.test.ts", "web/lib/supabase/Upserts/rollingPlayerHelperContracts.test.ts"]}`
- **Leads (not audited):**
  - (opus) after a trade the new team's bucket starts at 0 and jumps to that team's cumulative game count (e.g. 41), so season_team_games_available can exceed 82 (40 + 82) and understate a traded player's season availability; the min(1, ...) clamp hides the reverse case
  - (opus) rolling last-N uses only the current team, so a player traded within the last N team games shows the new team's partial history
  - (opus) team games are counted from every row in 'games' for the seasonId; if that table holds preseason or playoff games the denominators inflate (not verified)
  - (opus) teamId comes from wgo team_abbrev via teamsInfo; abbreviations missing from teamsInfo (relocated/defunct teams) give teamId null -> 0 team games -> null availability
  - (codex:rolling-availability) No runtime verification or correctness assessment performed.

## M-ROLL-005 Finishing ratios: shooting %, expected shooting %, primary points %

- **Match:** Both; Opus ROLL-014; Codex rolling-expected_sh_pct, rolling-penalties_taken, rolling-primary_points_pct, rolling-shooting_pct
- **Purpose:** Shooting efficiency and point quality over each scope.
- **Where:** `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:1317 (shooting_pct)`; `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:1364 (expected_sh_pct)`; `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:1348 (primary_points_pct)`; `web/lib/supabase/Upserts/rollingMetricScaleContract.ts:27 (ROLLING_METRIC_SCALE_CONTRACTS)`; `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:1364 METRICS[expected_sh_pct]; web/lib/supabase/Upserts/rollingMetricAggregation.ts:136 computeRatioValue; web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:2828 deriveOutputs. SUM(ixg) / SUM(shots); no denominator => null`; `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:1342 METRICS[penalties_taken]; web/lib/supabase/Upserts/rollingMetricAggregation.ts:136 computeRatioValue; web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:2828 deriveOutputs. Sums of observed values; legacy *_avg_* fields divide sum by observed count. Season/3YA/career averages use HistoricalAverageAccumulator.`; `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:1348 METRICS[primary_points_pct]; web/lib/supabase/Upserts/rollingMetricAggregation.ts:136 computeRatioValue; web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:2828 deriveOutputs. SUM(goals + first_assists) / SUM(total_points); no denominator => 0`; `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:1317 METRICS[shooting_pct]; web/lib/supabase/Upserts/rollingMetricAggregation.ts:136 computeRatioValue; web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:2828 deriveOutputs. SUM(goals) / SUM(shots) * 100; no denominator => 0`
- **Tags (heuristic):** percent scale: both/ambiguous; denominators: per game, shots on goal; generation: current
- **Opus view (ROLL-014):**
  - Method: shooting_pct = sum(goals)/sum(shots)*100, no shots -> 0. expected_sh_pct = sum(ixG)/sum(shots) as a 0-1 fraction; games with no ixG return null components (slot kept) so WGO-only shots are not counted as zero-xG shots; no denominator -> null. primary_points_pct = sum(goals + first_assists)/sum(total_points), 0-1 fraction, NST counts only (missing goals/first_assists treated as 0), no points -> 0.
  - Inputs/units: goals, shots on goal, ixG, first assists, total points (per-game counts); sources: nst_gamelog_*_counts, wgo_skater_stats
  - Output scale: shooting_pct percent 0-100; expected_sh_pct fraction 0-1; primary_points_pct fraction 0-1 (rollingMetricScaleContract.ts:33-35); ratio of sums; writes: rolling_player_game_metrics, rolling_player_metric_support_payloads
  - Status: live — written by /api/v1/db/update-rolling-player-averages, invoked by /api/v1/db/run-rolling-forge-pipeline (web/vercel.json cron '5,10,15,20,30,35,40,45,55 10 * * *' UTC, mode=daily_incremental; lib/rollingForgePipeline.ts:102)
  - Consumers: lib/rankings/* (results luck, sustainability); pages/trends/player/[playerId].tsx; FORGE
- **Codex view (rolling-expected_sh_pct, calculation, codex_part_of_opus; Codex family 'Rolling player metrics'):** expected_sh_pct
  - Purpose: Summarize player performance at strength and selected rolling/historical scope.
  - Inputs/units: Individual expected goals and shots, counts; missing ixG leaves an appearance slot without components
  - Output scale: fraction 0–1 contract Scopes all, last3/5/10/20, season, 3YA, career; ratio values rounded to 6 decimals.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
- **Codex view (rolling-penalties_taken, calculation, codex_part_of_opus; Codex family 'Rolling player metrics'):** penalties_taken
  - Purpose: Summarize player performance at strength and selected rolling/historical scope.
  - Inputs/units: penalties_taken counts (expected-goal quantity for ixG fields)
  - Output scale: Totals in counts (expected-goal quantity for ixG fields); averages in counts (expected-goal quantity for ixG fields) per observed entry. Scopes all, last3/5/10/20, season, 3YA, career; ratio values rounded to 6 decimals.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
- **Codex view (rolling-primary_points_pct, calculation, location; Codex family 'Rolling player metrics'):** primary_points_pct
  - Purpose: Summarize player performance at strength and selected rolling/historical scope.
  - Inputs/units: Goals, primary assists and points, counts
  - Output scale: fraction 0–1 contract Scopes all, last3/5/10/20, season, 3YA, career; ratio values rounded to 6 decimals.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
- **Codex view (rolling-shooting_pct, calculation, codex_part_of_opus; Codex family 'Rolling player metrics'):** shooting_pct
  - Purpose: Summarize player performance at strength and selected rolling/historical scope.
  - Inputs/units: Goals and shots, counts
  - Output scale: percent, 0–100 contract Scopes all, last3/5/10/20, season, 3YA, career; ratio values rounded to 6 decimals.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
- **Audit context:**
  - Intent (Opus): Scale contract web/lib/supabase/Upserts/rollingMetricScaleContract.ts:27; formula strings rollingPlayerValidationPayload.ts:490-503; no written rationale for 0-on-empty-denominator choice (UNDOCUMENTED)
  - Intended contract (Codex rolling-expected_sh_pct): web/lib/supabase/Upserts/rollingWindowContract.ts; web/lib/supabase/Upserts/rollingMetricSourceUnitContract.ts:18; web/lib/supabase/Upserts/rollingMetricScaleContract.ts:27. Explicit contract: ratios use aggregated raw components, not averaged per-game rates; appearance windows govern ratio/rate performance.
  - Intended contract (Codex rolling-penalties_taken): web/lib/supabase/Upserts/rollingWindowContract.ts; web/lib/supabase/Upserts/rollingMetricSourceUnitContract.ts:18; web/lib/supabase/Upserts/rollingMetricScaleContract.ts:27. Explicit contract: ratios use aggregated raw components, not averaged per-game rates; appearance windows govern ratio/rate performance.
  - Intended contract (Codex rolling-primary_points_pct): web/lib/supabase/Upserts/rollingWindowContract.ts; web/lib/supabase/Upserts/rollingMetricSourceUnitContract.ts:18; web/lib/supabase/Upserts/rollingMetricScaleContract.ts:27. Explicit contract: ratios use aggregated raw components, not averaged per-game rates; appearance windows govern ratio/rate performance.
  - Intended contract (Codex rolling-shooting_pct): web/lib/supabase/Upserts/rollingWindowContract.ts; web/lib/supabase/Upserts/rollingMetricSourceUnitContract.ts:18; web/lib/supabase/Upserts/rollingMetricScaleContract.ts:27. Explicit contract: ratios use aggregated raw components, not averaged per-game rates; appearance windows govern ratio/rate performance.
  - External references: NST SH% = G/SOG*100; xSH% (ixG/SOG); primary points share
  - Fixtures/test data: `web/lib/supabase/Upserts/fixtures/rollingColumnInventory.json`; `tasks/artifacts/forge-projection-audit-2026-10-21/rolling-column-inventory.json`; `tasks/artifacts/rolling-validation-5v5-recheck-2026-10-28/ (RESULTS.json, snapshot/)`; `web/scripts/check-rolling-player-family-reconstruction.ts`; `web/scripts/check-rolling-player-disputed-metrics.ts`
  - Tests: `web/lib/supabase/Upserts/fetchRollingPlayerAverages.test.ts`; `web/lib/supabase/Upserts/rollingMetricAggregation.test.ts`; `web/lib/supabase/Upserts/rollingMetricScaleContract.test.ts`; `{"discovered_not_run": ["web/lib/supabase/Upserts/fetchRollingPlayerAverages.test.ts", "web/lib/supabase/Upserts/rollingMetricAggregation.test.ts", "web/lib/supabase/Upserts/rollingMetricScaleContract.test.ts", "web/lib/supabase/Upserts/rollingMetricSourceUnitContract.test.ts", "web/lib/supabase/Upserts/rollingMetricWindowContractCases.test.ts"]}`
- **Leads (not audited):**
  - (opus) shooting_pct and primary_points_pct return 0 (not null) when the denominator is 0, so a player with 0 shots shows 0.0% instead of no value
  - (opus) unit mismatch between siblings - shooting_pct is 0-100 while expected_sh_pct and primary_points_pct are 0-1 fractions; any sh% minus xsh% comparison must rescale
  - (opus) shooting_pct support pairs for season/3ya/career come from the separate 'goals'/'shots' additive accumulators, not from the ratio components, so support totals can differ from the components that produced the stored percentage
  - (codex:rolling-expected_sh_pct) Exact deployed columns and reader variants not verified. Source snippets are local contracts, not evidence of applied remediation.
  - (codex:rolling-penalties_taken) Exact deployed columns and reader variants not verified. Source snippets are local contracts, not evidence of applied remediation.
  - (codex:rolling-primary_points_pct) Exact deployed columns and reader variants not verified. Source snippets are local contracts, not evidence of applied remediation.
  - (codex:rolling-shooting_pct) Exact deployed columns and reader variants not verified. Source snippets are local contracts, not evidence of applied remediation.

## M-ROLL-006 Goalie trend metric definitions

- **Match:** Both; Opus ROLL-016; Codex core-175, core-176
- **Purpose:** Per-game goalie trend inputs
- **Where:** `web/lib/trends/playerTrendCalculator.ts:487 (GOALIE_TREND_METRICS)`; `web/lib/trends/playerTrendCalculator.ts:479 games_played`; `web/lib/trends/playerTrendCalculator.ts:160 processMetric`
- **Tags (heuristic):** denominators: per 60, per game; generation: current
- **Opus view (ROLL-016):**
  - Method: Pass-through accessors fed to the shared rolling/mean/variance accumulator.
  - Inputs/units: per-game goalie values: save_pct fraction 0-1 (likely), GAA per 60, time_on_ice seconds (likely, unverified), counts; sources: goalie_stats_unified
  - Output scale: same as input; trend means; writes: player_trend_metrics
  - Status: live — cron update-player-trend-metrics; read by /api/v1/trends/goalie-power
  - Consumers: pages/api/v1/trends/goalie-power.ts; GOALIE_TREND_CATEGORIES
- **Codex view (core-175, calculation, location; Codex family 'player trend metric'):** Skater Games Played
  - Formula: Read measured source metric; no new raw-value formula in this accessor. Shared processMetric uses cumulative sum/count, n-1 sample variance and trailing 3/5/10 means.
  - Purpose: Summarize observed skater games played over cumulative and rolling game windows.
  - Inputs/units: Source metric games_played per admitted game; missing observations omitted from accumulator. Raw units: event count.
  - Output scale: Raw value; cumulative mean/sample variance/SD; complete 3/5/10-observation rolling means; sample size.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f. PLAYER_TREND_CALCULATION_VERSION=player-trend-v2-full-history-source-units Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the…
- **Codex view (core-176, calculation, location; Codex family 'player trend metric'):** Goalie Games Played
  - Formula: Read measured source metric; no new raw-value formula in this accessor. Shared processMetric uses cumulative sum/count, n-1 sample variance and trailing 3/5/10 means.
  - Purpose: Summarize observed goalie games played over cumulative and rolling game windows.
  - Inputs/units: Source metric games_played per admitted game; missing observations omitted from accumulator. Raw units: event count.
  - Output scale: Raw value; cumulative mean/sample variance/SD; complete 3/5/10-observation rolling means; sample size.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f. PLAYER_TREND_CALCULATION_VERSION=player-trend-v2-full-history-source-units Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the…
- **Audit context:**
  - Intent (Opus): web/lib/trends/goalieMetricConfig.ts:15-44 category descriptions
  - Intended contract (Codex core-175): The accessor and processMetric are the executable contract. Source-valued metrics remain distinguished from in-house rolling summaries.
  - Intended contract (Codex core-176): The accessor and processMetric are the executable contract. Source-valued metrics remain distinguished from in-house rolling summaries.
  - External references: NHL.com SV%, GAA; Quality Start (Hockey-Reference: SV% > league avg or >= .885 with <=20 SA)
  - Fixtures/test data: none listed
  - Tests: `Located only; not run for this inventory.`; `web/__tests__/pages/api/v1/trends/goalie-power.test.ts`; `web/lib/trends/playerTrendCalculator.test.ts`
- **Leads (not audited):**
  - (opus) rolling save% and GAA are unweighted means of per-game ratios (a 10-shot relief game counts equal to a 40-shot start)
  - (opus) QS definition is taken from source column; not verified here
  - (codex:core-175) ["Inventory only, not validation of the formula, source semantics or model quality."]
  - (codex:core-176) ["Inventory only, not validation of the formula, source semantics or model quality."]

## M-ROLL-007 Legacy trailing simple rolling average

- **Match:** Both; Opus ROLL-017; Codex core-019
- **Purpose:** Trailing simple moving average of a numeric series.
- **Where:** `web/lib/supabase/utils/statistics.ts:178 (computeRollingAverage)`; `web/lib/supabase/utils/statistics.ts:178 computeRollingAverage`
- **Tags (heuristic):** generation: legacy
- **Opus view (ROLL-017):**
  - Method: For each i, mean of values[max(0,i-window+1)..i]; partial windows at the start; non-finite values contribute 0 but still count in the denominator.
  - Inputs/units: any numeric series (unitless); sources: —
  - Output scale: same units as input; writes: —
  - Status: legacy/dead — no importer of web/lib/supabase/utils/statistics.ts outside tests; quarantined (legacyQuarantine.ts:64)
  - Consumers: none found; a separate copy exists at web/lib/trends/playerTrendCalculator.ts:132
- **Codex view (core-019, calculation, location; Codex family 'legacy SKO'):** Legacy rolling characteristic average
  - Formula: Mean of prefix/trailing window; nonfinite terms 0.
  - Purpose: Retain historical calculation lineage for later review.
  - Inputs/units: Numeric history and window count.
  - Output scale: Same-unit rolling average.
  - Version/status: Local octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f (2026-11-10). Explicit quarantined legacy lineage; historical-only decision2026-07-28 in legacyQuarantine.ts. Deployment and persisted-data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no …
- **Audit context:**
  - Intent (Opus): web/lib/supabase/utils/statistics.ts:175-177 ('Computes a simple rolling average for a numeric series')
  - Intended contract (Codex core-019): Implementation and adjacent source comments in web/lib/supabase/utils/statistics.ts:178; no separate approved specification identified.
  - External references: Simple moving average
  - Fixtures/test data: none listed
  - Tests: `Located only; not run for this inventory.`; `web/lib/supabase/utils/legacySko.test.ts`
- **Leads (not audited):**
  - (opus) non-finite values treated as 0 yet counted, biasing averages down
  - (opus) duplicate implementation in lib/trends/playerTrendCalculator.ts
  - (codex:core-019) ["Calculation inventory only; formulas and inputs have not been vetted."]

## M-ROLL-008 Legacy smoothstep confidence multiplier

- **Match:** Both; Opus ROLL-018; Codex core-020
- **Purpose:** Map a 'rolling CV' value to a confidence multiplier between min and max.
- **Where:** `web/lib/supabase/utils/statistics.ts:200 (computeConfidenceMultiplierSmooth)`; `web/lib/supabase/utils/statistics.ts:200 computeConfidenceMultiplierSmooth`
- **Tags (heuristic):** generation: legacy
- **Opus view (ROLL-018):**
  - Method: x = clamp((cv - T1)/(T2 - T1), 0, 1); multiplier = min + (max-min)*(1 - (3x^2 - 2x^3)); defaults min 0.8, max 1.0; returns 1 on invalid input or T2 <= T1.
  - Inputs/units: score on the weighted squared-z scale (named rollingCV); sources: —
  - Output scale: multiplier 0.8-1.0 (default); 1 on invalid input; writes: —
  - Status: legacy/dead — no callers found; quarantined (legacyQuarantine.ts:64)
  - Consumers: none found
- **Codex view (core-020, calculation, location; Codex family 'legacy SKO'):** Legacy confidence multiplier
  - Formula: x=clamp((rollingCV-T1)/(T2-T1), 0, 1); min+(max-min)*(1-3x²+2x³).
  - Purpose: Retain historical calculation lineage for later review.
  - Inputs/units: rollingCV (legacy naming), T1, T2, min=.8, max=1.
  - Output scale: Multiplier .8..1 by default.
  - Version/status: Local octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f (2026-11-10). Explicit quarantined legacy lineage; historical-only decision2026-07-28 in legacyQuarantine.ts. Deployment and persisted-data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no …
- **Audit context:**
  - Intent (Opus): web/lib/supabase/utils/statistics.ts:194-199 (smoothstep mapping description)
  - Intended contract (Codex core-020): Implementation and adjacent source comments in web/lib/supabase/utils/statistics.ts:200; no separate approved specification identified.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `Located only; not run for this inventory.`; `web/lib/supabase/utils/legacySko.test.ts`
- **Leads (not audited):**
  - (opus) named 'rollingCV' but T1/T2 come from the weighted squared-z score scale; file header says naming is a legacy assumption
  - (opus) dead code
  - (codex:core-020) ["Calculation inventory only; formulas and inputs have not been vetted."]

## M-ROLL-009 Legacy empirical score thresholds (quantiles)

- **Match:** Both; Opus ROLL-019; Codex core-021
- **Purpose:** Derive T1/T2 thresholds from the empirical distribution of characteristic scores.
- **Where:** `web/lib/supabase/utils/statistics.ts:227 (computeEmpiricalThresholds)`; `web/lib/supabase/utils/statistics.ts:227 computeEmpiricalThresholds`
- **Tags (heuristic):** generation: legacy
- **Opus view (ROLL-019):**
  - Method: Sort finite scores; quantile = vals[min(n-1, floor(p*n))]; defaults median and 90th percentile; empty -> {0,0}.
  - Inputs/units: weighted squared-z scores; sources: —
  - Output scale: score thresholds on the same scale; writes: —
  - Status: legacy/dead — no callers found; quarantined (legacyQuarantine.ts:64)
  - Consumers: none found
- **Codex view (core-021, calculation, location; Codex family 'legacy SKO'):** Legacy empirical characteristic thresholds
  - Formula: Sorted order statistic at floor(p*n), clipped index.
  - Purpose: Retain historical calculation lineage for later review.
  - Inputs/units: Finite squared-z scores and quantiles default .5, .9.
  - Output scale: Native-score T1/T2.
  - Version/status: Local octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f (2026-11-10). Explicit quarantined legacy lineage; historical-only decision2026-07-28 in legacyQuarantine.ts. Deployment and persisted-data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no …
- **Audit context:**
  - Intent (Opus): web/lib/supabase/utils/statistics.ts:224-226 ('Derive empirical thresholds (e.g., med/90th)')
  - Intended contract (Codex core-021): Implementation and adjacent source comments in web/lib/supabase/utils/statistics.ts:227; no separate approved specification identified.
  - External references: Nearest-rank quantile
  - Fixtures/test data: none listed
  - Tests: `Located only; not run for this inventory.`; `web/lib/supabase/utils/legacySko.test.ts`
- **Leads (not audited):**
  - (opus) floor(p*n) index is an upper nearest-rank quantile (no interpolation)
  - (opus) dead code
  - (codex:core-021) ["Calculation inventory only; formulas and inputs have not been vetted."]

## M-ROLL-010 Legacy sKO characteristic-game classifier (z-scores, weighted chi-square thresholds, stat weights)

- **Match:** Both; Opus ROLL-020; Codex core-017, core-018, core-022
- **Purpose:** Label each game as Highly/Moderately/Uncharacteristic versus the player's prior games.
- **Where:** `web/lib/supabase/utils/statistics.ts:26 (computeStatSummaries)`; `web/lib/supabase/utils/statistics.ts:72 (computeCharacteristicResults)`; `web/lib/supabase/utils/constants.ts:47 (RATED_STAT_FIELDS)`; `web/lib/supabase/utils/constants.ts:111 (STAT_WEIGHTS)`; `web/lib/supabase/utils/statistics.ts:26 computeStatSummaries`; `web/lib/supabase/utils/statistics.ts:72 computeCharacteristicResults`; `web/lib/supabase/utils/constants.ts:111 STAT_WEIGHTS`
- **Tags (heuristic):** denominators: per 60, per game, shots on goal; generation: legacy
- **Opus view (ROLL-020):**
  - Method: Weights = normalized inverse of importance ratings (SH% 4.0625, IPP 4.8125, oiSH% 6.263, ZS% 6.583, TOI 4.692, PA/SA 6.571, SOG/60 4.0625, PPTOI% 4.667) -> sum to 1. For game i, baseline = mean and population SD (divide by n) over games 0..i-1; SD 0 -> 1. z capped at +/-5; per-stat label \|z\|<=1 Highly, <=2 Moderately, else Uncharacteristic. Score = sum w*z^2; T1 = sum w (=1), T2 = T1 + 2*sqrt(2*sum w^2) (chi-square-1 mean/variance approximation). PA/SA ratio: current game capped at 10 (SA=0 & PA>0 -> 10); prior games recomputed with Infinity for SA=0, then non-finite values filtered out of mean/SD. First game -> 'Insufficient History'.
  - Inputs/units: per-game values: shooting_percentage, ipp, on_ice_shooting_pct, zone_start_pct (percent units undeclared), time_on_ice (units undeclared, WGO usually seconds), sog_per_60 (per-60), pp_toi_pct_per_game, PA/SA ratio; sources: wgo_skater_stats + sko_skater_stats game logs
  - Output scale: z-scores capped +/-5; weighted sum of squared z (>=0); T1=1, T2=1+2*sqrt(2*sum w^2); categorical labels; writes: —
  - Status: legacy/dead — no importer outside tests; quarantined in web/lib/predictions/legacyQuarantine.ts:64
  - Consumers: none found (quarantined in web/lib/predictions/legacyQuarantine.ts:64)
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
- **Codex view (core-022, calculation, location; Codex family 'legacy SKO'):** Legacy normalized inverse-importance weights
  - Formula: (1/rating)/sum(1/rating).
  - Purpose: Weight 8 characteristic stats.
  - Inputs/units: Importance ratings for SH%, IPP, on-ice SH%, zone starts, TOI, PA/SA, SOG60, PPTOI%.
  - Output scale: Weights sum 1.
  - Version/status: Local octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f (2026-11-10). Explicit quarantined legacy lineage; historical-only decision2026-07-28 in legacyQuarantine.ts. Deployment and persisted-data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no …
- **Audit context:**
  - Intent (Opus): web/lib/supabase/utils/statistics.ts:3-7 (legacy, 'not approved FORGE signal definitions') and :66-71 (score each game against prior games only)
  - Intended contract (Codex core-017): Implementation and adjacent source comments in web/lib/supabase/utils/statistics.ts:26; no separate approved specification identified.
  - Intended contract (Codex core-018): Implementation and adjacent source comments in web/lib/supabase/utils/statistics.ts:72; no separate approved specification identified.
  - Intended contract (Codex core-022): Implementation and adjacent source comments in web/lib/supabase/utils/constants.ts:111; no separate approved specification identified.
  - External references: Standard z-score / chi-square approximation; weighted sum of squared z assumes independent normals
  - Fixtures/test data: `web/lib/supabase/utils/legacySko.test.ts`
  - Tests: `Located only; not run for this inventory.`; `No directly named test identified; no tests executed.`; `web/lib/supabase/utils/legacySko.test.ts`
- **Leads (not audited):**
  - (opus) PA/SA ratio handled inconsistently - current game capped at 10, priors set to Infinity and then dropped from baseline, biasing the baseline low
  - (opus) with one prior game SD=0 -> 1, so z equals the raw difference in native units (e.g. TOI seconds) and immediately caps at 5
  - (opus) chi-square thresholds assume independent unit-normal z; stats are correlated and z is capped, so T1/T2 are not calibrated
  - (opus) percent fields (SH%, IPP, oiSH%, ZS%) units not declared (0-1 vs 0-100)
  - (opus) dead/quarantined code
  - (codex:core-017) ["Calculation inventory only; formulas and inputs have not been vetted."]
  - (codex:core-018) ["Calculation inventory only; formulas and inputs have not been vetted."]
  - (codex:core-022) ["Calculation inventory only; formulas and inputs have not been vetted."]

## M-ROLL-011 Individual points percentage (IPP)

- **Match:** Both; Opus ROLL-021; Codex rolling-ipp
- **Purpose:** Share of on-ice goals for in which the player recorded a point.
- **Where:** `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:1384 (ipp)`; `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:2149 (applyRatioSupportOutputs ipp)`; `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:1384 METRICS[ipp]; web/lib/supabase/Upserts/rollingMetricAggregation.ts:136 computeRatioValue; web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:2828 deriveOutputs. SUM(points) / SUM(on-ice GF) * 100; no denominator => 0`
- **Tags (heuristic):** percent scale: 0-100; generation: current
- **Opus view (ROLL-021):**
  - Method: ipp = sum(points)/sum(on-ice GF)*100 per scope; no GF -> 0. Stored 0-100.
  - Inputs/units: player points (count), on-ice goals for (count); sources: nst_gamelog_*_counts, nst_gamelog_*_counts_oi, wgo_skater_stats
  - Output scale: percent 0-100 (rollingMetricScaleContract.ts:36); ratio of sums; writes: rolling_player_game_metrics, rolling_player_metric_support_payloads
  - Status: live — written by /api/v1/db/update-rolling-player-averages, invoked by /api/v1/db/run-rolling-forge-pipeline (web/vercel.json cron '5,10,15,20,30,35,40,45,55 10 * * *' UTC, mode=daily_incremental; lib/rollingForgePipeline.ts:102)
  - Consumers: rankings / results-luck; trends player page
- **Codex view (rolling-ipp, calculation, location; Codex family 'Rolling player metrics'):** ipp
  - Purpose: Summarize player performance at strength and selected rolling/historical scope.
  - Inputs/units: Individual points and on-ice goals for, counts
  - Output scale: percent 0–100 contract Scopes all, last3/5/10/20, season, 3YA, career; ratio values rounded to 6 decimals.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
- **Audit context:**
  - Intent (Opus): 'Individual points percentage, aggregated from raw point and on-ice goal components' (web/lib/supabase/Upserts/rollingMetricSourceUnitContract.ts:118)
  - Intended contract (Codex rolling-ipp): web/lib/supabase/Upserts/rollingWindowContract.ts; web/lib/supabase/Upserts/rollingMetricSourceUnitContract.ts:18; web/lib/supabase/Upserts/rollingMetricScaleContract.ts:27. Explicit contract: ratios use aggregated raw components, not averaged per-game rates; appearance windows govern ratio/rate performance.
  - External references: NST IPP = points / on-ice GF * 100
  - Fixtures/test data: `web/lib/supabase/Upserts/fixtures/rollingColumnInventory.json`; `tasks/artifacts/forge-projection-audit-2026-10-21/rolling-column-inventory.json`; `tasks/artifacts/rolling-validation-5v5-recheck-2026-10-28/ (RESULTS.json, snapshot/)`; `web/scripts/check-rolling-player-family-reconstruction.ts`; `web/scripts/check-rolling-player-disputed-metrics.ts`
  - Tests: `web/lib/supabase/Upserts/fetchRollingPlayerAverages.test.ts`; `web/lib/supabase/Upserts/rollingPlayerPipelineDiagnostics.test.ts`; `{"discovered_not_run": ["web/lib/supabase/Upserts/fetchRollingPlayerAverages.test.ts", "web/lib/supabase/Upserts/rollingMetricAggregation.test.ts", "web/lib/supabase/Upserts/rollingMetricScaleContract.test.ts", "web/lib/supabase/Upserts/rollingMetricSourceUnitContract.test.ts", "web/lib/supabase/Upserts/rollingMetricWindowContractCases.test.ts"]}`
- **Leads (not audited):**
  - (opus) numerator may come from WGO points (all strength, NST counts missing) while the denominator always comes from NST on-ice GF - mixed sources within one ratio
  - (opus) 0 on-ice GF yields IPP 0 instead of undefined
  - (codex:rolling-ipp) Exact deployed columns and reader variants not verified. Source snippets are local contracts, not evidence of applied remediation.

## M-ROLL-012 On-ice shooting %, on-ice save %, PDO

- **Match:** Both; Opus ROLL-022; Codex rolling-on_ice_sh_pct, rolling-on_ice_sv_pct, rolling-pdo
- **Purpose:** On-ice percentages and luck index over each scope.
- **Where:** `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:1527 (on_ice_sh_pct)`; `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:1540 (on_ice_sv_pct)`; `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:1556 (pdo)`; `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:2051 (getDerivedGoalsAgainstValue)`; `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:1527 METRICS[on_ice_sh_pct]; web/lib/supabase/Upserts/rollingMetricAggregation.ts:136 computeRatioValue; web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:2828 deriveOutputs. SUM(GF) / SUM(SF) * 100`; `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:1540 METRICS[on_ice_sv_pct]; web/lib/supabase/Upserts/rollingMetricAggregation.ts:136 computeRatioValue; web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:2828 deriveOutputs. SUM(SA - GA) / SUM(SA) * 100`; `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:1556 METRICS[pdo]; web/lib/supabase/Upserts/rollingMetricAggregation.ts:136 computeRatioValue; web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:2828 deriveOutputs. SUM(GF)/SUM(SF) + SUM(SA-GA)/SUM(SA), implemented as sum of 100-scale rates × 0.01`
- **Tags (heuristic):** percent scale: 0-100; denominators: shots on goal; generation: current
- **Opus view (ROLL-022):**
  - Method: oiSH% = sum(GF)/sum(SF)*100. oiSV% = sum(SA-GA)/sum(SA)*100. PDO = ((sum GF/sum SF)*100 + (sum(SA-GA)/sum SA)*100) * 0.01, stored as ~1.0 index (scale contract 0-2); null if either denominator is 0. Support GA derived as SA - (SA-GA).
  - Inputs/units: on-ice GF, SF, GA, SA counts (shots on goal); sources: nst_gamelog_*_counts_oi
  - Output scale: on_ice_sh_pct and on_ice_sv_pct percent 0-100; PDO index ~1.0 (contract 0-2); ratio of sums; writes: rolling_player_game_metrics, rolling_player_metric_support_payloads
  - Status: live — written by /api/v1/db/update-rolling-player-averages, invoked by /api/v1/db/run-rolling-forge-pipeline (web/vercel.json cron '5,10,15,20,30,35,40,45,55 10 * * *' UTC, mode=daily_incremental; lib/rollingForgePipeline.ts:102)
  - Consumers: lib/rankings/resultsLuckSources.ts; trends player page; FORGE
- **Codex view (rolling-on_ice_sh_pct, calculation, location; Codex family 'Rolling player metrics'):** on_ice_sh_pct
  - Purpose: Summarize player performance at strength and selected rolling/historical scope.
  - Inputs/units: On-ice goals for and shots for, counts
  - Output scale: percent 0–100 contract Scopes all, last3/5/10/20, season, 3YA, career; ratio values rounded to 6 decimals.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
- **Codex view (rolling-on_ice_sv_pct, calculation, location; Codex family 'Rolling player metrics'):** on_ice_sv_pct
  - Purpose: Summarize player performance at strength and selected rolling/historical scope.
  - Inputs/units: On-ice shots against and goals against, counts
  - Output scale: percent 0–100 contract Scopes all, last3/5/10/20, season, 3YA, career; ratio values rounded to 6 decimals.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
- **Codex view (rolling-pdo, calculation, location; Codex family 'Rolling player metrics'):** pdo
  - Purpose: Summarize player performance at strength and selected rolling/historical scope.
  - Inputs/units: On-ice GF, SF, SA, GA counts
  - Output scale: index 0–2 contract Scopes all, last3/5/10/20, season, 3YA, career; ratio values rounded to 6 decimals.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
- **Audit context:**
  - Intent (Opus): 'On-ice shooting percentage plus save percentage, stored as a 0-2 index' (web/lib/supabase/Upserts/rollingMetricSourceUnitContract.ts:124); oiSH% note at :130
  - Intended contract (Codex rolling-on_ice_sh_pct): web/lib/supabase/Upserts/rollingWindowContract.ts; web/lib/supabase/Upserts/rollingMetricSourceUnitContract.ts:18; web/lib/supabase/Upserts/rollingMetricScaleContract.ts:27. Explicit contract: ratios use aggregated raw components, not averaged per-game rates; appearance windows govern ratio/rate performance.
  - Intended contract (Codex rolling-on_ice_sv_pct): web/lib/supabase/Upserts/rollingWindowContract.ts; web/lib/supabase/Upserts/rollingMetricSourceUnitContract.ts:18; web/lib/supabase/Upserts/rollingMetricScaleContract.ts:27. Explicit contract: ratios use aggregated raw components, not averaged per-game rates; appearance windows govern ratio/rate performance.
  - Intended contract (Codex rolling-pdo): web/lib/supabase/Upserts/rollingWindowContract.ts; web/lib/supabase/Upserts/rollingMetricSourceUnitContract.ts:18; web/lib/supabase/Upserts/rollingMetricScaleContract.ts:27. Explicit contract: ratios use aggregated raw components, not averaged per-game rates; appearance windows govern ratio/rate performance.
  - External references: NST on-ice SH%/SV%/PDO (shots on goal based); PDO convention 1.000 or 100
  - Fixtures/test data: `web/lib/supabase/Upserts/fixtures/rollingColumnInventory.json`; `tasks/artifacts/forge-projection-audit-2026-10-21/rolling-column-inventory.json`; `tasks/artifacts/rolling-validation-5v5-recheck-2026-10-28/ (RESULTS.json, snapshot/)`; `web/scripts/check-rolling-player-family-reconstruction.ts`; `web/scripts/check-rolling-player-disputed-metrics.ts`
  - Tests: `web/lib/supabase/Upserts/fetchRollingPlayerAverages.test.ts`; `web/lib/supabase/Upserts/rollingMetricAggregation.test.ts`; `web/lib/supabase/Upserts/rollingPlayerPipelineDiagnostics.test.ts`; `{"discovered_not_run": ["web/lib/supabase/Upserts/fetchRollingPlayerAverages.test.ts", "web/lib/supabase/Upserts/rollingMetricAggregation.test.ts", "web/lib/supabase/Upserts/rollingMetricScaleContract.test.ts", "web/lib/supabase/Upserts/rollingMetricSourceUnitContract.test.ts", "web/lib/supabase/Upserts/rollingMetricWindowContractCases.test.ts"]}`
- **Leads (not audited):**
  - (opus) PDO stored as ~1.0 index while on_ice_sh_pct/on_ice_sv_pct are 0-100; consumers mixing PDO with NST's own pdo column need to confirm NST's scale
  - (opus) on_ice_sv_pct is emitted but not in ROLLING_METRIC_WINDOW_FAMILIES and has no support-component columns
  - (codex:rolling-on_ice_sh_pct) Exact deployed columns and reader variants not verified. Source snippets are local contracts, not evidence of applied remediation.
  - (codex:rolling-on_ice_sv_pct) Exact deployed columns and reader variants not verified. Source snippets are local contracts, not evidence of applied remediation.
  - (codex:rolling-pdo) Exact deployed columns and reader variants not verified. Source snippets are local contracts, not evidence of applied remediation.

## M-ROLL-013 Possession and zone-start shares (CF%, FF%, OZ start %)

- **Match:** Both; Opus ROLL-023; Codex rolling-ca, rolling-cf_pct, rolling-fa, rolling-ff_pct, rolling-oz_start_pct
- **Purpose:** Shot-attempt and zone-start shares over each scope.
- **Where:** `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:1589 (cf_pct)`; `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:1614 (ff_pct)`; `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:1503 (oz_start_pct)`; `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:2245 (applyRatioSupportOutputs oz_start_pct)`; `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:1583 METRICS[ca]; web/lib/supabase/Upserts/rollingMetricAggregation.ts:136 computeRatioValue; web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:2828 deriveOutputs. Sums of observed values; legacy *_avg_* fields divide sum by observed count. Season/3YA/career averages use HistoricalAverageAccumulator.`; `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:1589 METRICS[cf_pct]; web/lib/supabase/Upserts/rollingMetricAggregation.ts:136 computeRatioValue; web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:2828 deriveOutputs. SUM(CF) / SUM(CF + CA) * 100`; `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:1608 METRICS[fa]; web/lib/supabase/Upserts/rollingMetricAggregation.ts:136 computeRatioValue; web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:2828 deriveOutputs. Sums of observed values; legacy *_avg_* fields divide sum by observed count. Season/3YA/career averages use HistoricalAverageAccumulator.`; `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:1614 METRICS[ff_pct]; web/lib/supabase/Upserts/rollingMetricAggregation.ts:136 computeRatioValue; web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:2828 deriveOutputs. SUM(FF) / SUM(FF + FA) * 100`; `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:1503 METRICS[oz_start_pct]; web/lib/supabase/Upserts/rollingMetricAggregation.ts:136 computeRatioValue; web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:2828 deriveOutputs. SUM(OZ starts) / SUM(OZ + DZ starts) * 100; neutral excluded`
- **Tags (heuristic):** percent scale: 0-100; denominators: unblocked attempts; generation: current
- **Opus view (ROLL-023):**
  - Method: CF% = sum(CF)/sum(CF+CA)*100; FF% = sum(FF)/sum(FF+FA)*100; OZS% = sum(OZS)/sum(OZS+DZS)*100 excluding neutral-zone starts; null when denominator 0. DZ support = denominator - numerator; NZ support from a separate additive accumulator.
  - Inputs/units: on-ice CF, CA, FF, FA, zone-start counts; sources: nst_gamelog_*_counts_oi
  - Output scale: percent 0-100; ratio of sums; writes: rolling_player_game_metrics, rolling_player_metric_support_payloads
  - Status: live — written by /api/v1/db/update-rolling-player-averages, invoked by /api/v1/db/run-rolling-forge-pipeline (web/vercel.json cron '5,10,15,20,30,35,40,45,55 10 * * *' UTC, mode=daily_incremental; lib/rollingForgePipeline.ts:102)
  - Consumers: lib/rankings/* (deployment, defensive composite); trends player page
- **Codex view (rolling-ca, calculation, codex_part_of_opus; Codex family 'Rolling player metrics'):** ca
  - Purpose: Summarize player performance at strength and selected rolling/historical scope.
  - Inputs/units: ca counts (expected-goal quantity for ixG fields)
  - Output scale: Totals in counts (expected-goal quantity for ixG fields); averages in counts (expected-goal quantity for ixG fields) per observed entry. Scopes all, last3/5/10/20, season, 3YA, career; ratio values rounded to 6 decimals.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
- **Codex view (rolling-cf_pct, calculation, codex_part_of_opus; Codex family 'Rolling player metrics'):** cf_pct
  - Purpose: Summarize player performance at strength and selected rolling/historical scope.
  - Inputs/units: On-ice shot attempts for and against, counts
  - Output scale: percent 0–100 contract Scopes all, last3/5/10/20, season, 3YA, career; ratio values rounded to 6 decimals.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
- **Codex view (rolling-fa, calculation, codex_part_of_opus; Codex family 'Rolling player metrics'):** fa
  - Purpose: Summarize player performance at strength and selected rolling/historical scope.
  - Inputs/units: fa counts (expected-goal quantity for ixG fields)
  - Output scale: Totals in counts (expected-goal quantity for ixG fields); averages in counts (expected-goal quantity for ixG fields) per observed entry. Scopes all, last3/5/10/20, season, 3YA, career; ratio values rounded to 6 decimals.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
- **Codex view (rolling-ff_pct, calculation, codex_part_of_opus; Codex family 'Rolling player metrics'):** ff_pct
  - Purpose: Summarize player performance at strength and selected rolling/historical scope.
  - Inputs/units: On-ice unblocked attempts for and against, counts
  - Output scale: percent 0–100 contract Scopes all, last3/5/10/20, season, 3YA, career; ratio values rounded to 6 decimals.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
- **Codex view (rolling-oz_start_pct, calculation, location; Codex family 'Rolling player metrics'):** oz_start_pct
  - Purpose: Summarize player performance at strength and selected rolling/historical scope.
  - Inputs/units: On-ice OZ and DZ starts, counts
  - Output scale: percent 0–100 contract Scopes all, last3/5/10/20, season, 3YA, career; ratio values rounded to 6 decimals.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
- **Audit context:**
  - Intent (Opus): 'Offensive-zone start share excluding neutral-zone starts' (web/lib/supabase/Upserts/rollingMetricSourceUnitContract.ts:136); CF%/FF% UNDOCUMENTED beyond formula strings (rollingPlayerValidationPayload.ts:507-508)
  - Intended contract (Codex rolling-ca): web/lib/supabase/Upserts/rollingWindowContract.ts; web/lib/supabase/Upserts/rollingMetricSourceUnitContract.ts:18; web/lib/supabase/Upserts/rollingMetricScaleContract.ts:27. Explicit contract: ratios use aggregated raw components, not averaged per-game rates; appearance windows govern ratio/rate performance.
  - Intended contract (Codex rolling-cf_pct): web/lib/supabase/Upserts/rollingWindowContract.ts; web/lib/supabase/Upserts/rollingMetricSourceUnitContract.ts:18; web/lib/supabase/Upserts/rollingMetricScaleContract.ts:27. Explicit contract: ratios use aggregated raw components, not averaged per-game rates; appearance windows govern ratio/rate performance.
  - Intended contract (Codex rolling-fa): web/lib/supabase/Upserts/rollingWindowContract.ts; web/lib/supabase/Upserts/rollingMetricSourceUnitContract.ts:18; web/lib/supabase/Upserts/rollingMetricScaleContract.ts:27. Explicit contract: ratios use aggregated raw components, not averaged per-game rates; appearance windows govern ratio/rate performance.
  - Intended contract (Codex rolling-ff_pct): web/lib/supabase/Upserts/rollingWindowContract.ts; web/lib/supabase/Upserts/rollingMetricSourceUnitContract.ts:18; web/lib/supabase/Upserts/rollingMetricScaleContract.ts:27. Explicit contract: ratios use aggregated raw components, not averaged per-game rates; appearance windows govern ratio/rate performance.
  - Intended contract (Codex rolling-oz_start_pct): web/lib/supabase/Upserts/rollingWindowContract.ts; web/lib/supabase/Upserts/rollingMetricSourceUnitContract.ts:18; web/lib/supabase/Upserts/rollingMetricScaleContract.ts:27. Explicit contract: ratios use aggregated raw components, not averaged per-game rates; appearance windows govern ratio/rate performance.
  - External references: NST CF%/FF%/Off. Zone Start % (neutral excluded)
  - Fixtures/test data: `web/lib/supabase/Upserts/fixtures/rollingColumnInventory.json`; `tasks/artifacts/forge-projection-audit-2026-10-21/rolling-column-inventory.json`; `tasks/artifacts/rolling-validation-5v5-recheck-2026-10-28/ (RESULTS.json, snapshot/)`
  - Tests: `web/lib/supabase/Upserts/fetchRollingPlayerAverages.test.ts`; `web/lib/supabase/Upserts/rollingMetricScaleContract.test.ts`; `{"discovered_not_run": ["web/lib/supabase/Upserts/fetchRollingPlayerAverages.test.ts", "web/lib/supabase/Upserts/rollingMetricAggregation.test.ts", "web/lib/supabase/Upserts/rollingMetricScaleContract.test.ts", "web/lib/supabase/Upserts/rollingMetricSourceUnitContract.test.ts", "web/lib/supabase/Upserts/rollingMetricWindowContractCases.test.ts"]}`
- **Leads (not audited):**
  - (opus) no xGF% is computed even though oi_xgf/oi_xga are summed; any xGF% shown elsewhere is derived outside this pipeline
  - (opus) oz_start_pct_neutral_zone_starts_lastN comes from a valid-observation additive window while the OZ/DZ parts come from the appearance-anchored ratio window, so the three support counts can cover different games
  - (codex:rolling-ca) Exact deployed columns and reader variants not verified. Source snippets are local contracts, not evidence of applied remediation.
  - (codex:rolling-cf_pct) Exact deployed columns and reader variants not verified. Source snippets are local contracts, not evidence of applied remediation.
  - (codex:rolling-fa) Exact deployed columns and reader variants not verified. Source snippets are local contracts, not evidence of applied remediation.
  - (codex:rolling-ff_pct) Exact deployed columns and reader variants not verified. Source snippets are local contracts, not evidence of applied remediation.
  - (codex:rolling-oz_start_pct) Exact deployed columns and reader variants not verified. Source snippets are local contracts, not evidence of applied remediation.

## M-ROLL-014 Per-60 weighted rate metrics

- **Match:** Both; Opus ROLL-024; Codex rolling-assists_per_60, rolling-blocks_per_60, rolling-component-reconstruction, rolling-goals_per_60, rolling-hits_per_60, rolling-sog_per_60
- **Possible related records (low-confidence location link, unconfirmed):** rolling-penalties_drawn_per_60, rolling-penalties_taken_per_60, rolling-pp_toi_seconds, rolling-primary_assists_per_60, rolling-secondary_assists, rolling-secondary_assists_per_60, rolling-shot_attempts_per_60
- **Purpose:** Event rates per 60 minutes over each scope from summed raw events and summed TOI seconds.
- **Where:** `web/lib/supabase/Upserts/rollingPlayerMetricMath.ts:3 (resolvePer60Components)`; `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:1175 (sog_per_60)`; `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:1207 (shot_attempts_per_60)`; `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:1221 (goals_per_60)`; `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:1148 (getGoalsPer60ToiSeconds)`; `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:1235 (assists_per_60)`; `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:1249 (penalties_drawn_per_60)`; `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:1263 (penalties_taken_per_60)`; `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:1289 (primary_assists_per_60)`; `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:1303 (secondary_assists_per_60)`; `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:1475 (hits_per_60)`; `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:1489 (blocks_per_60)` …
- **Tags (heuristic):** denominators: per 60, per game, all strengths, shots on goal; generation: current
- **Opus view (ROLL-024):**
  - Method: Per game components = {num: raw events, den: TOI seconds}; if raw missing but a per-60 rate exists (sog/ixg only), num = rate * TOI / 3600. Scope value = sum(num)/sum(den) * 3600 (seconds -> per 60 min). No TOI -> component null (slot kept, nothing added). goals_per_60 at PP uses its own TOI chain counts.toi -> countsOi.toi -> rates.toi_per_gp -> PP TOI (builder PPTOI, else WGO pp_toi). Numerators: sog/hits/blocks/goals/penalties use NST counts with WGO all-strength fallback; assists_per_60, primary/secondary_assists_per_60, shot_attempts_per_60 use NST counts only.
  - Inputs/units: raw event counts per game; TOI in seconds (NST mm:ss parsed to seconds); NST rates shots_per_60/ixg_per_60 are per-60 rates; sources: nst_gamelog_*_counts (shots, icf, goals, total_assists, first_assists, second_assists, penalties_drawn, total_penalties, hits, shots_blocked), nst_gamelog_*_rates, wgo_skater_stats
  - Output scale: per-60 rate (events per 60 minutes) = sum(events)/sum(TOI s)*3600; ratio of sums; writes: rolling_player_game_metrics, rolling_player_metric_support_payloads
  - Status: live — written by /api/v1/db/update-rolling-player-averages, invoked by /api/v1/db/run-rolling-forge-pipeline (web/vercel.json cron '5,10,15,20,30,35,40,45,55 10 * * *' UTC, mode=daily_incremental; lib/rollingForgePipeline.ts:102)
  - Consumers: lib/rankings/*; FORGE skater projections (lib/projections); pages/trends/player/[playerId].tsx
- **Codex view (rolling-assists_per_60, calculation, location; Codex family 'Rolling player metrics'):** assists_per_60
  - Purpose: Summarize player performance at strength and selected rolling/historical scope.
  - Inputs/units: assists counts and TOI seconds, source contracts below
  - Output scale: Events per 60 minutes, not arithmetic mean of game rates. Scopes all, last3/5/10/20, season, 3YA, career; ratio values rounded to 6 decimals.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
- **Codex view (rolling-blocks_per_60, calculation, location; Codex family 'Rolling player metrics'):** blocks_per_60
  - Purpose: Summarize player performance at strength and selected rolling/historical scope.
  - Inputs/units: blocks counts and TOI seconds, source contracts below
  - Output scale: Events per 60 minutes, not arithmetic mean of game rates. Scopes all, last3/5/10/20, season, 3YA, career; ratio values rounded to 6 decimals.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
- **Codex view (rolling-component-reconstruction, calculation, codex_part_of_opus; Codex family 'Rolling input math'):** Per-60 count and share denominator reconstruction
  - Purpose: Recover additive components from rate/share inputs before aggregation.
  - Inputs/units: Raw counts, positive TOI seconds, optional per60 rate; numerator and positive fractional share; strength
  - Output scale: Reconstructed count = rate × seconds / 3600. Share denominator = numerator/share. ixG preference counts, then all-strength WGO, then per60 reconstruction; unavailable => null.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
- **Codex view (rolling-goals_per_60, calculation, location; Codex family 'Rolling player metrics'):** goals_per_60
  - Purpose: Summarize player performance at strength and selected rolling/historical scope.
  - Inputs/units: goals counts and TOI seconds, source contracts below; PP denominator preference counts.toi, countsOi.toi, rates.toi_per_gp, then player PP TOI (fetchRollingPlayerAverages.ts:1148 getGoalsPer60ToiSeconds).
  - Output scale: Events per 60 minutes, not arithmetic mean of game rates. Scopes all, last3/5/10/20, season, 3YA, career; ratio values rounded to 6 decimals.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
- **Codex view (rolling-hits_per_60, calculation, location; Codex family 'Rolling player metrics'):** hits_per_60
  - Purpose: Summarize player performance at strength and selected rolling/historical scope.
  - Inputs/units: hits counts and TOI seconds, source contracts below
  - Output scale: Events per 60 minutes, not arithmetic mean of game rates. Scopes all, last3/5/10/20, season, 3YA, career; ratio values rounded to 6 decimals.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
- **Codex view (rolling-sog_per_60, calculation, location; Codex family 'Rolling player metrics'):** sog_per_60
  - Purpose: Summarize player performance at strength and selected rolling/historical scope.
  - Inputs/units: shots counts and TOI seconds, source contracts below
  - Output scale: Events per 60 minutes, not arithmetic mean of game rates. Scopes all, last3/5/10/20, season, 3YA, career; ratio values rounded to 6 decimals.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
- **Audit context:**
  - Intent (Opus): '/60 families are stored as weighted rate snapshots derived from raw event totals and TOI over the selected scope. We never average per-game rates.' (web/lib/supabase/Upserts/rollingPlayerMetricMath.ts:8); NST rates are supplementary only (fetchRollingPlayerAverages.ts:1072-1084)
  - Intended contract (Codex rolling-assists_per_60): web/lib/supabase/Upserts/rollingWindowContract.ts; web/lib/supabase/Upserts/rollingMetricSourceUnitContract.ts:18; web/lib/supabase/Upserts/rollingMetricScaleContract.ts:27. Explicit contract: ratios use aggregated raw components, not averaged per-game rates; appearance windows govern ratio/rate performance.
  - Intended contract (Codex rolling-blocks_per_60): web/lib/supabase/Upserts/rollingWindowContract.ts; web/lib/supabase/Upserts/rollingMetricSourceUnitContract.ts:18; web/lib/supabase/Upserts/rollingMetricScaleContract.ts:27. Explicit contract: ratios use aggregated raw components, not averaged per-game rates; appearance windows govern ratio/rate performance.
  - Intended contract (Codex rolling-component-reconstruction): web/lib/supabase/Upserts/rollingPlayerMetricMath.ts:8 comment explicitly mandates weighted snapshots derived from totals and TOI.
  - Intended contract (Codex rolling-goals_per_60): web/lib/supabase/Upserts/rollingWindowContract.ts; web/lib/supabase/Upserts/rollingMetricSourceUnitContract.ts:18; web/lib/supabase/Upserts/rollingMetricScaleContract.ts:27. Explicit contract: ratios use aggregated raw components, not averaged per-game rates; appearance windows govern ratio/rate performance.
  - Intended contract (Codex rolling-hits_per_60): web/lib/supabase/Upserts/rollingWindowContract.ts; web/lib/supabase/Upserts/rollingMetricSourceUnitContract.ts:18; web/lib/supabase/Upserts/rollingMetricScaleContract.ts:27. Explicit contract: ratios use aggregated raw components, not averaged per-game rates; appearance windows govern ratio/rate performance.
  - Intended contract (Codex rolling-sog_per_60): web/lib/supabase/Upserts/rollingWindowContract.ts; web/lib/supabase/Upserts/rollingMetricSourceUnitContract.ts:18; web/lib/supabase/Upserts/rollingMetricScaleContract.ts:27. Explicit contract: ratios use aggregated raw components, not averaged per-game rates; appearance windows govern ratio/rate performance.
  - External references: NST per-60 convention: sum(events) / sum(TOI minutes) * 60
  - Fixtures/test data: `web/lib/supabase/Upserts/fixtures/rollingColumnInventory.json`; `tasks/artifacts/forge-projection-audit-2026-10-21/rolling-column-inventory.json`; `tasks/artifacts/rolling-validation-5v5-recheck-2026-10-28/ (RESULTS.json, snapshot/)`; `web/scripts/check-rolling-player-family-reconstruction.ts`; `web/scripts/check-rolling-player-disputed-metrics.ts`
  - Tests: `web/lib/supabase/Upserts/fetchRollingPlayerAverages.test.ts`; `web/lib/supabase/Upserts/rollingMetricWindowContractCases.test.ts`; `web/lib/supabase/Upserts/rollingPlayerMetricMath.test.ts`; `{"discovered_not_run": ["web/lib/supabase/Upserts/fetchRollingPlayerAverages.test.ts", "web/lib/supabase/Upserts/rollingMetricAggregation.test.ts", "web/lib/supabase/Upserts/rollingMetricScaleContract.test.ts", "web/lib/supabase/Upserts/rollingMetricSourceUnitContract.test.ts", "web/lib/supabase/Upserts/rollingMetricWindowContractCases.test.ts"]}`; `{"discovered_not_run": ["web/lib/supabase/Upserts/rollingPlayerMetricMath.test.ts"]}`
- **Leads (not audited):**
  - (opus) goals_per_60 at PP takes TOI from a separate chain that bypasses the TOI sanity checks (no 4000 s cap, no non-positive rejection) and differs from the TOI used by every other per-60 on the same PP row
  - (opus) assists_per_60 numerator is NST total_assists only, while the 'assists' additive metric falls back to WGO; games without NST rows add nothing to assists_per_60 (slot kept) but do add to assists
  - (opus) sog_per_60 and ixg_per_60 may rebuild numerators from NST rate * TOI where TOI itself came from a different source (WGO), mixing sources inside one component
  - (codex:rolling-assists_per_60) Exact deployed columns and reader variants not verified. Source snippets are local contracts, not evidence of applied remediation.
  - (codex:rolling-blocks_per_60) Exact deployed columns and reader variants not verified. Source snippets are local contracts, not evidence of applied remediation.
  - (codex:rolling-component-reconstruction) No runtime verification or correctness assessment performed.
  - (codex:rolling-goals_per_60) Exact deployed columns and reader variants not verified. Source snippets are local contracts, not evidence of applied remediation.
  - (codex:rolling-hits_per_60) Exact deployed columns and reader variants not verified. Source snippets are local contracts, not evidence of applied remediation.
  - (codex:rolling-sog_per_60) Exact deployed columns and reader variants not verified. Source snippets are local contracts, not evidence of applied remediation.

## M-ROLL-015 Individual expected goals (ixG) source resolution and ixG/60

- **Match:** Both; Opus ROLL-025; Codex rolling-ixg_per_60
- **Purpose:** Pick ixG per game and build ixG per 60 components with a recorded source.
- **Where:** `web/lib/supabase/Upserts/rollingPlayerMetricMath.ts:74 (resolveIxgValue)`; `web/lib/supabase/Upserts/rollingPlayerMetricMath.ts:96 (resolveIxgPer60Components)`; `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:1190 (ixg_per_60)`; `web/lib/supabase/Upserts/rollingPlayerSourceSelection.ts:155 (getIxgValue)`; `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:1190 METRICS[ixg_per_60]; web/lib/supabase/Upserts/rollingMetricAggregation.ts:136 computeRatioValue; web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:2828 deriveOutputs. 3600 × SUM(ixg) / SUM(TOI seconds); missing/nonpositive denominator => null.`
- **Tags (heuristic):** denominators: per 60, per game; generation: legacy, current
- **Opus view (ROLL-025):**
  - Method: ixG = NST counts ixg; else WGO ixg only for strength 'all'; else for ixg_per_60 reconstruct numerator = ixg_per_60 * TOI / 3600. Source tagged counts_raw / wgo_raw / rate_reconstruction / unavailable. ixg (additive) summed/averaged; ixg_per_60 = sum(ixG)/sum(TOI s)*3600.
  - Inputs/units: ixG in expected goals per game (NST xG model); ixg_per_60 per-60 rate; TOI seconds; sources: nst_gamelog_*_counts, nst_gamelog_*_rates, wgo_skater_stats
  - Output scale: ixg_* totals/per-game means; ixg_per_60_* per-60 rate; writes: rolling_player_game_metrics
  - Status: live — written by /api/v1/db/update-rolling-player-averages, invoked by /api/v1/db/run-rolling-forge-pipeline (web/vercel.json cron '5,10,15,20,30,35,40,45,55 10 * * *' UTC, mode=daily_incremental; lib/rollingForgePipeline.ts:102); WGO ixG fallback is effectively dead (no ixg column selected at fetchRollingPlayerAverages.ts:2966)
  - Consumers: expected_sh_pct; rankings; FORGE
- **Codex view (rolling-ixg_per_60, calculation, location; Codex family 'Rolling player metrics'):** ixg_per_60
  - Purpose: Summarize player performance at strength and selected rolling/historical scope.
  - Inputs/units: ixg counts and TOI seconds, source contracts below
  - Output scale: Events per 60 minutes, not arithmetic mean of game rates. Scopes all, last3/5/10/20, season, 3YA, career; ratio values rounded to 6 decimals.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
- **Audit context:**
  - Intent (Opus): 'WGO supplies shots but no xG, so a game without an NST row must not count as zero-xG shots' (web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:1377); source contract rollingMetricSourceUnitContract.ts:53-66
  - Intended contract (Codex rolling-ixg_per_60): web/lib/supabase/Upserts/rollingWindowContract.ts; web/lib/supabase/Upserts/rollingMetricSourceUnitContract.ts:18; web/lib/supabase/Upserts/rollingMetricScaleContract.ts:27. Explicit contract: ratios use aggregated raw components, not averaged per-game rates; appearance windows govern ratio/rate performance.
  - External references: NST ixG (NST xG model)
  - Fixtures/test data: `web/lib/supabase/Upserts/fixtures/rollingColumnInventory.json`; `tasks/artifacts/forge-projection-audit-2026-10-21/rolling-column-inventory.json`; `tasks/artifacts/rolling-validation-5v5-recheck-2026-10-28/ (RESULTS.json, snapshot/)`
  - Tests: `web/lib/supabase/Upserts/rollingPlayerMetricMath.test.ts`; `web/lib/supabase/Upserts/rollingPlayerSourceSelection.test.ts`; `{"discovered_not_run": ["web/lib/supabase/Upserts/fetchRollingPlayerAverages.test.ts", "web/lib/supabase/Upserts/rollingMetricAggregation.test.ts", "web/lib/supabase/Upserts/rollingMetricScaleContract.test.ts", "web/lib/supabase/Upserts/rollingMetricSourceUnitContract.test.ts", "web/lib/supabase/Upserts/rollingMetricWindowContractCases.test.ts"]}`
- **Leads (not audited):**
  - (opus) the WGO select in fetchWgoRowsForPlayer (fetchRollingPlayerAverages.ts:2966) does not request an ixg column, so the WGO ixG fallback (getWgoNumber(game, 'ixg')) appears to be always null - dead fallback path
  - (codex:rolling-ixg_per_60) Exact deployed columns and reader variants not verified. Source snippets are local contracts, not evidence of applied remediation.

## M-ROLL-016 PP TOI and team PP share (pp_share_pct)

- **Match:** Both; Opus ROLL-026; Codex rolling-pp_share_pct
- **Purpose:** Player share of total team power-play TOI over each scope, plus raw PP TOI.
- **Where:** `web/lib/supabase/Upserts/rollingPlayerPpShareContract.ts:65 (resolvePpShareComponents)`; `web/lib/supabase/Upserts/rollingPlayerPpShareContract.ts:84 (resolvePlayerPpToiSeconds)`; `web/lib/supabase/Upserts/rollingPlayerMetricMath.ts:35 (resolveShareComponents)`; `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:1130 (getPpShareComponents)`; `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:1517 (pp_share_pct)`; `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:4031 (null pp_share for ev/pk/5v5)`; `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:1517 METRICS[pp_share_pct]; web/lib/supabase/Upserts/rollingMetricAggregation.ts:136 computeRatioValue; web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:2828 deriveOutputs. SUM(player PP seconds) / SUM(reconstructed team PP seconds)`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: per game; generation: current
- **Opus view (ROLL-026):**
  - Method: Per game: numerator = player PP TOI s, denominator = player PP TOI / share (implied team PP TOI). Builder pair preferred, else WGO pair; requires share > 0. pp_share_pct = sum(player PP TOI)/sum(implied team PP TOI) (0-1), i.e. TOI-weighted share. Only 'all' and 'pp' rows; other strengths nulled. pp_toi_seconds additive = builder PPTOI else WGO pp_toi. Unit-relative builder fields (pp_unit_usage_index, pp_unit_relative_toi, pp_vs_unit_avg) are copied through as context, not used in math.
  - Inputs/units: player PP TOI seconds (builder PPTOI, WGO pp_toi); share fraction 0-1 (pp_share_of_team, WGO ppTimeOnIcePctPerGame); sources: powerPlayCombinations, wgo_skater_stats
  - Output scale: pp_share_pct fraction 0-1 (TOI-weighted ratio of sums); pp_toi_seconds seconds; writes: rolling_player_game_metrics, rolling_player_metric_support_payloads
  - Status: live — written by /api/v1/db/update-rolling-player-averages, invoked by /api/v1/db/run-rolling-forge-pipeline (web/vercel.json cron '5,10,15,20,30,35,40,45,55 10 * * *' UTC, mode=daily_incremental; lib/rollingForgePipeline.ts:102); only all/pp rows
  - Consumers: lib/rankings/* (deployment); FORGE skater stage; lib/socialShare/modules/roleWatch.ts
- **Codex view (rolling-pp_share_pct, calculation, location; Codex family 'Rolling player metrics'):** pp_share_pct
  - Purpose: Summarize player performance at strength and selected rolling/historical scope.
  - Inputs/units: PPTOI seconds and team-share fraction; preferred powerPlayCombinations, fallback WGO
  - Output scale: fraction 0–1 contract Scopes all, last3/5/10/20, season, 3YA, career; ratio values rounded to 6 decimals.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
- **Audit context:**
  - Intent (Opus): ROLLING_PLAYER_PP_SHARE_CONTRACT 'Player share of total team power-play TOI over the selected scope' (web/lib/supabase/Upserts/rollingPlayerPpShareContract.ts:22-48, rationale :71-75)
  - Intended contract (Codex rolling-pp_share_pct): web/lib/supabase/Upserts/rollingWindowContract.ts; web/lib/supabase/Upserts/rollingMetricSourceUnitContract.ts:18; web/lib/supabase/Upserts/rollingMetricScaleContract.ts:27. Explicit contract: ratios use aggregated raw components, not averaged per-game rates; appearance windows govern ratio/rate performance. rollingPlayerPpShareContract.ts:22 ROLLING_PLAYER_PP_SHARE_CONTRACT explicitly excludes percentageOfPP and unit-relative fields as substitutes.
  - External references: PP TOI share of team PP TOI (NHL.com ppTimeOnIcePctPerGame)
  - Fixtures/test data: `web/lib/supabase/Upserts/fixtures/rollingColumnInventory.json`; `tasks/artifacts/forge-projection-audit-2026-10-21/rolling-column-inventory.json`; `tasks/artifacts/rolling-validation-5v5-recheck-2026-10-28/ (RESULTS.json, snapshot/)`; `tasks/artifacts/forge-projection-audit-2026-10-21/release-pp-usage/`
  - Tests: `web/lib/supabase/Upserts/fetchRollingPlayerAverages.test.ts`; `web/lib/supabase/Upserts/rollingPlayerMetricMath.test.ts`; `web/lib/supabase/Upserts/rollingPlayerPpShareContract.test.ts`; `web/lib/supabase/Upserts/rollingPlayerPpUnitContract.test.ts`; `{"discovered_not_run": ["web/lib/supabase/Upserts/fetchRollingPlayerAverages.test.ts", "web/lib/supabase/Upserts/rollingMetricAggregation.test.ts", "web/lib/supabase/Upserts/rollingMetricScaleContract.test.ts", "web/lib/supabase/Upserts/rollingMetricSourceUnitContract.test.ts", "web/lib/supabase/Upserts/rollingMetricWindowContractCases.test.ts"]}`
- **Leads (not audited):**
  - (opus) a game where the player had 0 PP TOI contributes nothing (share>0 required and numerator 0 gives 0/0), so pp_share_pct reflects share only in games with PP usage plus slots without components, rather than share of all team PP time in the window
  - (opus) team PP TOI is reconstructed from a rounded pp_share_of_team, adding rounding error to the denominator
  - (opus) a window can mix builder- and WGO-derived components (validation flags mixedSourceWindow)
  - (codex:rolling-pp_share_pct) Exact deployed columns and reader variants not verified. Source snippets are local contracts, not evidence of applied remediation.

## M-ROLL-017 Power-play unit usage metrics

- **Match:** Both; Opus ROLL-027; Codex pp-team-share, pp-unit-usage
- **Purpose:** Per-player PP unit usage index, relative TOI and share of team PP TOI.
- **Where:** `web/lib/supabase/Upserts/powerPlayCombinationMetrics.ts:25 (buildUnitUsageRows)`; `web/lib/supabase/Upserts/powerPlayCombinationMetrics.ts:46 (buildPowerPlayCombinationRows)`; `web/lib/supabase/Upserts/powerPlayCombinationMetrics.ts:46 buildPowerPlayCombinationRows`; `web/lib/supabase/Upserts/powerPlayCombinationMetrics.ts:25 buildUnitUsageRows`
- **Tags (heuristic):** percent scale: fraction 0-1; generation: current
- **Opus view (ROLL-027):**
  - Method: usageIndex = playerPPTOI / unitAvgPPTOI (0 if avg<=0); relativeToi = playerPPTOI - unitAvg (rounded s); vsUnitAvg = usageIndex - 1; pp_share_of_team = playerPPTOI / teamPPTOI (null if missing). Rounded to 6 dp. Units formed upstream as top-5/next-5/rest by PP TOI.
  - Inputs/units: PP TOI in seconds; sources: computed by update-power-play-combinations route from shift data
  - Output scale: ratio ~1.0 (usage index), seconds (relative TOI), fraction 0-1 (pp_share_of_team); writes: powerPlayCombinations
  - Status: live — pg_cron update-power-play-combinations 08:05 UTC active=true (tasks/TASKS/cron-operations/cron-schedule.md:209) -> pages/api/v1/db/update-power-play-combinations/[gameId].ts
  - Consumers: pages/api/v1/db/update-power-play-combinations/[gameId].ts; rolling player averages (pp share inputs)
- **Codex view (pp-team-share, calculation, location; Codex family 'Power-play usage'):** pp_share_of_team
  - Purpose: Keep team-relative PP participation distinct from unit-relative usage.
  - Inputs/units: Player PP seconds, team PP seconds
  - Output scale: player PPTOI / team PPTOI, rounded 6 decimals; missing/nonpositive team denominator => null
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
- **Codex view (pp-unit-usage, calculation, location; Codex family 'Power-play usage'):** PPTOI, pp_unit_usage_index, percentageOfPP, pp_unit_relative_toi, pp_vs_unit_avg
  - Purpose: Describe each player relative to their unit average.
  - Inputs/units: Player PP TOI seconds; average unit TOI seconds
  - Output scale: usage_index = player/avg or 0; legacy percentageOfPP aliases index; relative_toi = player-avg rounded to seconds; vs_unit_avg = index-1; other outputs rounded 6 decimals. Index is not bounded at 1.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
- **Audit context:**
  - Intent (Opus): web/lib/supabase/Upserts/powerPlayCombinationMetrics.ts:59 (comment: team-share semantics stored separately from unit-relative usage so downstream pp_share_pct uses a consistent denominator)
  - Intended contract (Codex pp-team-share): web/lib/supabase/Upserts/powerPlayCombinationMetrics.ts:60 team-share comment; web/lib/supabase/Upserts/rollingMetricSourceUnitContract.ts pp_share_pct contract.
  - Intended contract (Codex pp-unit-usage): web/lib/supabase/Upserts/powerPlayCombinationMetrics.ts:60 comment separates unit-relative context from team-share semantics.
  - External references: NHL.com ppTimeOnIcePctPerGame (player PP TOI / team PP TOI)
  - Fixtures/test data: `inline fixtures in web/lib/supabase/Upserts/powerPlayCombinationMetrics.test.ts`
  - Tests: `web/lib/supabase/Upserts/powerPlayCombinationMetrics.test.ts`; `web/lib/supabase/Upserts/rollingPlayerHelperContracts.test.ts`; `{"discovered_not_run": ["web/lib/supabase/Upserts/powerPlayCombinationMetrics.test.ts", "web/lib/supabase/Upserts/rollingPlayerPpShareContract.test.ts"]}`; `{"discovered_not_run": ["web/lib/supabase/Upserts/powerPlayCombinationMetrics.test.ts", "web/lib/supabase/Upserts/rollingPlayerPpUnitContract.test.ts"]}`
- **Leads (not audited):**
  - (opus) column 'percentageOfPP' holds the unit-relative usage index (ratio to unit average, ~1.0), not a percent of team PP - misleading name; true share is pp_share_of_team (0-1)
  - (codex:pp-team-share) No runtime verification or correctness assessment performed.
  - (codex:pp-unit-usage) No runtime verification or correctness assessment performed.

## M-ROLL-018 Skater trend metric definitions (per-60 fallbacks, primary points %, expected SH%)

- **Match:** Both; Opus ROLL-028; Codex core-149, core-150, core-153, core-154, core-158, core-169, core-170, core-192, core-193
- **Purpose:** Per-game skater trend inputs
- **Where:** `web/lib/trends/playerTrendCalculator.ts:238 (SKATER_TREND_METRICS)`; `web/lib/trends/playerTrendCalculator.ts:244 (shots_per_60 accessor)`; `web/lib/trends/playerTrendCalculator.ts:263 (ixg_per_60 accessor)`; `web/lib/trends/playerTrendCalculator.ts:296 (primary_points_pct)`; `web/lib/trends/playerTrendCalculator.ts:311 (expected_shooting_pct)`; `web/lib/trends/playerTrendCalculator.ts:240 shots_per_60`; `web/lib/trends/playerTrendCalculator.ts:160 processMetric`; `web/lib/trends/playerTrendCalculator.ts:259 ixg_per_60`; `web/lib/trends/playerTrendCalculator.ts:292 primary_points_pct`; `web/lib/trends/playerTrendCalculator.ts:307 expected_shooting_pct`; `web/lib/trends/playerTrendCalculator.ts:251 toi`; `web/lib/trends/playerTrendCalculator.ts:297 goals` …
- **Tags (heuristic):** percent scale: both/ambiguous; denominators: per 60, per game, unblocked attempts; generation: current
- **Opus view (ROLL-028):**
  - Method: shots_per_60 = nst_shots_per_60 else shots/toi_per_game*60; ixg_per_60 = nst_ixg_per_60 else nst_ixg/toi*60; primary_points_pct = (goals + first assists)/points (0-1); expected_shooting_pct = ixG/iFF*100 (0-100); cf_pct = nst_oi_cf_pct else nst_oi_cf_pct_rates; others pass-through.
  - Inputs/units: toi_per_game passed through in SOURCE units (WGO-derived player_stats_unified; likely seconds, unverified) while playoff rows are converted to minutes; NST *_per_60 already per-60; counts per game; NST percentages pass-through (likely 0-100); sources: player_stats_unified, wgo_skater_stats_playoffs
  - Output scale: per-60 rates (NST primary) or (count/toi)*60 fallback (correct only if toi is minutes); primary_points_pct 0-1; expected_shooting_pct 0-100; toi/pp_toi in source units; writes: player_trend_metrics
  - Status: live — same cron as rolling trends; skater categories shots_per_60, ixg_per_60, toi, pp_toi surfaced via /api/v1/trends/skater-power (HotColdCard, trends pages)
  - Consumers: trends skater views (SKATER_TREND_CATEGORIES)
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
- **Codex view (core-153, calculation, location; Codex family 'player trend metric'):** Skater Primary Points %
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
- **Codex view (core-158, calculation, codex_part_of_opus; Codex family 'player trend metric'):** Skater Time on Ice
  - Formula: Read measured source metric; no new raw-value formula in this accessor. Shared processMetric uses cumulative sum/count, n-1 sample variance and trailing 3/5/10 means.
  - Purpose: Summarize observed skater time on ice over cumulative and rolling game windows.
  - Inputs/units: Source metric toi per admitted game; missing observations omitted from accumulator. Raw units: time as supplied by the game-log adapter; accessor alone does not establish all upstream units.
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
  - Intent (Opus): web/lib/trends/playerTrendCalculator.ts:15-16 'source-units' version tag; web/lib/trends/skaterMetricConfig.ts:19 'Individual shot volume rate at all strengths'
  - Intended contract (Codex core-149): The accessor and processMetric are the executable contract. Source-valued metrics remain distinguished from in-house rolling summaries.
  - Intended contract (Codex core-150): The accessor and processMetric are the executable contract. Source-valued metrics remain distinguished from in-house rolling summaries.
  - Intended contract (Codex core-153): The accessor and processMetric are the executable contract. Source-valued metrics remain distinguished from in-house rolling summaries.
  - Intended contract (Codex core-154): The accessor and processMetric are the executable contract. Source-valued metrics remain distinguished from in-house rolling summaries.
  - Intended contract (Codex core-158): The accessor and processMetric are the executable contract. Source-valued metrics remain distinguished from in-house rolling summaries.
  - Intended contract (Codex core-169): The accessor and processMetric are the executable contract. Source-valued metrics remain distinguished from in-house rolling summaries.
  - Intended contract (Codex core-170): The accessor and processMetric are the executable contract. Source-valued metrics remain distinguished from in-house rolling summaries.
  - Intended contract (Codex core-192): The accessor and processMetric are the executable contract. Source-valued metrics remain distinguished from in-house rolling summaries.
  - Intended contract (Codex core-193): The accessor and processMetric are the executable contract. Source-valued metrics remain distinguished from in-house rolling summaries.
  - External references: NST individual per-60 definitions; expected SH% = ixG/iFF (MoneyPuck/NST style)
  - Fixtures/test data: `web/scripts/audit-player-trend-expected-shooting.ts`; `web/scripts/audit-player-trend-playoff-repair.ts`
  - Tests: `Located only; not run for this inventory.`; `web/lib/trends/playerTrendCalculator.test.ts`; `web/scripts/audit-player-trend-expected-shooting.ts (audit script, not test)`
- **Leads (not audited):**
  - (opus) per-60 fallback multiplies by 60, i.e. assumes toi_per_game in minutes; WGO-sourced toi_per_game elsewhere is seconds (trendsSurface says 'TOI fields arrive as seconds'), which would make the fallback 60x too small
  - (opus) playoff rows are converted seconds->minutes (normalizePlayoffSkaterTrendRow) while regular-season toi_per_game passes through unchanged; regular and playoff 'toi' may be in different units in the same accumulator
  - (opus) 'ihdcf_per_60' reads nst_hdcf_per_60 (may be on-ice HDCF rather than individual iHDCF)
  - (opus) percent units mixed: primary_points_pct 0-1, expected_shooting_pct 0-100, shooting_percentage/ipp/pdo pass-through source units
  - (opus) primary_points_pct treats missing goals/first assists as 0
  - (codex:core-149) ["Inventory only, not validation of the formula, source semantics or model quality."]
  - (codex:core-150) ["Inventory only, not validation of the formula, source semantics or model quality."]
  - (codex:core-153) ["Inventory only, not validation of the formula, source semantics or model quality."]
  - (codex:core-154) ["Inventory only, not validation of the formula, source semantics or model quality."]
  - (codex:core-158) ["Inventory only, not validation of the formula, source semantics or model quality."]
  - (codex:core-169) ["Inventory only, not validation of the formula, source semantics or model quality."]
  - (codex:core-170) ["Inventory only, not validation of the formula, source semantics or model quality."]
  - (codex:core-192) ["Inventory only, not validation of the formula, source semantics or model quality."]
  - (codex:core-193) ["Inventory only, not validation of the formula, source semantics or model quality."]

## M-ROLL-019 SKO luck deltas, sustainability composite and role classifier

- **Match:** Both; Opus ROLL-030; Codex core-196, core-197, core-198
- **Purpose:** Luck components and a 0-100 sustainability score
- **Where:** `web/lib/trends/utils.ts:140 (computeLuck)`; `web/lib/trends/utils.ts:163 (combineSKO)`; `web/lib/trends/utils.ts:192 (classifyRole)`; `web/lib/trends/utils.ts:140 computeLuck`; `web/lib/trends/utils.ts:163 combineSKO`; `web/lib/trends/utils.ts:192 classifyRole`
- **Tags (heuristic):** percent scale: 0-100; generation: legacy
- **Opus view (ROLL-030):**
  - Method: xG_minus_G = xg-goals; onIceSH_delta = onIceSH-0.08; PDO_delta = pdo-1.0; IPP_delta = ipp-baseline. sustainability = clamp01(0.45*off + 0.25*def + 0.30*onIce - 0.35*luck)*100. Role: Two-Way if def>0.8 and (driver>0.6 or maker>0.6); driver-maker>0.25 Play Driver; maker-driver>0.25 Play Maker; def>0.8 Defensive Specialist; else Balanced.
  - Inputs/units: goals and xG counts; onIceSH and PDO assumed fractions (0.08, 1.0 baselines); signals 0-1 or z; sources: —
  - Output scale: deltas in input units; component scores 0-100; role label; writes: —
  - Status: legacy/dead — no importers of computeLuck/combineSKO/classifyRole outside web/lib/trends/utils.ts (rg)
  - Consumers: pages/trendsSandbox.tsx (no production consumers found by rg)
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
  - Intent (Opus): web/lib/trends/utils.ts:139 comment 'signs chosen so higher = more luck / less sustainable'; current SKO intent lives in tasks/TASKS/prd-sko-element.md:12-22 (new sustainability core, not this helper)
  - Intended contract (Codex core-196): Source types and implementation in web/lib/trends/utils.ts:140; separate acceptance not verified.
  - Intended contract (Codex core-197): Source types and implementation in web/lib/trends/utils.ts:163; separate acceptance not verified.
  - Intended contract (Codex core-198): Source types and implementation in web/lib/trends/utils.ts:192; separate acceptance not verified.
  - External references: PDO regression to 1.000; league oiSH% ~8% at ES
  - Fixtures/test data: none listed
  - Tests: `No directly named test located; tests not run.`
- **Leads (not audited):**
  - (opus) hard-coded 8% on-ice SH baseline and PDO 1.0 assume 0-1 units; NST sources often store percentages 0-100
  - (opus) weights sum to 1.0 before subtracting luck so max sustainability <1 unless luck=0
  - (opus) appears to be sandbox/dead code (combineSKO, computeLuck, classifyRole not imported outside utils)
  - (codex:core-196) ["Inventory only, not validation of the formula, source semantics or model quality."]
  - (codex:core-197) ["Inventory only, not validation of the formula, source semantics or model quality."]
  - (codex:core-198) ["Inventory only, not validation of the formula, source semantics or model quality."]

## M-ROLL-020 Trend rolling average and hot/cold streak detection

- **Match:** Both; Opus ROLL-032; Codex core-199
- **Purpose:** Chart rolling average and label hot/cold streaks vs baseline
- **Where:** `web/lib/trends/utils.ts:215 (rollingAverage)`; `web/lib/trends/utils.ts:235 (streakIntensity)`; `web/lib/trends/utils.ts:240 (buildTrendData)`; `web/lib/trends/utils.ts:240 buildTrendData`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: per game; generation: current
- **Opus view (ROLL-032):**
  - Method: Rolling mean over available values (partial windows allowed at start). Non-finite values coerced to 0. Hot if value>baseline, cold if <; streak requires >=2 consecutive games; intensity = min(1, 0.25 + 0.18*length).
  - Inputs/units: per-game points counts; sources: —
  - Output scale: rolling mean in points; streak intensity 0-1; writes: —
  - Status: live but sandbox — pages/trendsSandbox.tsx:2278,2341
  - Consumers: pages/trendsSandbox.tsx:2278
- **Codex view (core-199, calculation, location; Codex family 'trends utilities'):** Trend rolling average and hot/cold streaks
  - Formula: Consecutive above/below baseline; minimum 2 points for label; intensity=min(1, .25+.18*length).
  - Purpose: Calculate trend rolling average and hot/cold streaks.
  - Inputs/units: Dates, point values, baseline, window.
  - Output scale: Rolling mean, streak direction, length, intensity 0..1.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f.  Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final status check.
- **Audit context:**
  - Intent (Opus): web/lib/trends/utils.ts:309 comment 'Per-point streak labeling requires at least 2 consecutive games'
  - Intended contract (Codex core-199): Source types and implementation in web/lib/trends/utils.ts:240; separate acceptance not verified.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `No directly named test located; tests not run.`
- **Leads (not audited):**
  - (opus) partial early windows differ from playerTrendCalculator rolling (null until full window)
  - (opus) missing values become 0 (counted as cold games)
  - (codex:core-199) ["Inventory only, not validation of the formula, source semantics or model quality."]

## M-ROLL-021 Team rolling STD and last-10 (LTG) averages

- **Match:** Both; Opus ROLL-035; Codex core-357
- **Purpose:** Season-to-date and last-10-game team rate averages and count sums per game in rolling_games.
- **Where:** `web/lib/supabase/Upserts/fetchRollingGames.js:514 (calculateOpponentAndLtgStats)`; `web/lib/supabase/Upserts/fetchRollingGames.js:676 (std averages)`; `web/lib/supabase/Upserts/fetchRollingGames.js:749 (ltg window)`; `web/lib/supabase/Upserts/fetchRollingGames.js:514 calculateOpponentAndLtgStats`
- **Tags (heuristic):** denominators: per 60, per game; generation: legacy, current
- **Opus view (ROLL-035):**
  - Method: Ordered by game_date per team. STD: rate columns = simple mean of per-game values over games 1..i; counts = running sums. LTG: window games[max(0,i-9)..i] (last 10 games), same mean-of-rates and sums. Also date ranges and arrays of game ids/opponents/home_road.
  - Inputs/units: per-game NHL REST values: pct fields as returned (NHL stats REST uses 0-1 fractions), per-60s, per-game shots, TOI seconds; sources: rolling_games (from NHL stats REST team summary/realtime/powerplay/penalties, isGame=true), standings
  - Output scale: means of per-game rates (mean-of-ratios) and summed counts; writes: rolling_games
  - Status: legacy/dead — pages/api/v1/db/update-rolling-games.ts returns 410 'Legacy rolling-games loader has been disabled' (replacement /api/v1/db/update-rolling-player-averages); pg_cron update-rolling-games-recent active=false (cron-schedule.md:504)
  - Consumers: pages/api/v1/db/update-rolling-games.ts; cron-report
- **Codex view (core-357, calculation, location; Codex family 'legacy team aggregation'):** Cumulative and last-ten team and opponent aggregates
  - Formula: Sum count fields and opponent record counts; arithmetic mean existing rate fields over cumulative rows or last up to 10 rows. Source includes recent-mode baselines.
  - Purpose: Provide cumulative and last-ten team and opponent aggregates for the identified consumer.
  - Inputs/units: Chronological rolling_games rows and matched opponent standings.
  - Output scale: STD and LTG counts, rate means and opponent W/L/OTL totals.
  - Version/status: Local working tree on octoberBranch, read on 2026-11-10. HEAD changed during the inventory from d31dcb33f72d4c9d69b507874c388f0cd549fe2f to 11e4192d36ecc4ac4b338f9ab48e529c7049c618. This is a non-atomic local scan; deployment and persisted-data state are not verified. Referenced implementation files had no tracked/untracked status entry at the final status check.
- **Audit context:**
  - Intent (Opus): web/lib/supabase/Upserts/fetchRollingGames.js:357-359 (comment: recent mode processes games >= baseline and seeds cumulative values from last game before baseline)
  - Intended contract (Codex core-357): Function signature and comments at web/lib/supabase/Upserts/fetchRollingGames.js:514 calculateOpponentAndLtgStats; independent product specification not verified.
  - External references: Ratio-of-sums convention (e.g. PP% = PPG/PPO over window; SAT% = SATF/(SATF+SATA))
  - Fixtures/test data: none listed
  - Tests: `No dedicated test located in the bounded scan; no tests run.`
- **Leads (not audited):**
  - (opus) mean-of-ratios for PP%, PK%, FO%, SAT%, point_pct and per-60s; single games with 0 PP opportunities give null/0 that pollutes the average (null + number -> NaN in JS)
  - (opus) rolling_games is fetched across all seasons with no season filter, so STD/LTG and game_number span seasons in 'all' mode
  - (opus) in 'recent' mode games are filtered to >= baseline before computing, so STD restarts at the baseline and LTG windows lose earlier games
  - (opus) source pages are joined per page while endpoints are sorted differently (summary by date, powerplay by PP%, penalties by PIM), so games can be dropped as 'not found' across pages
  - (codex:core-357) ["Calculation inventory only; no correctness or model-quality verdict.", "Grouped family entry: payload fields are explicit in the source; not expanded into one entry per stored alias."]

## M-ROLL-022 Trends sandbox statistics helpers (mean, SD, z-score, percentile, winsorize, Pearson, regression)

- **Match:** Both; Opus ROLL-038; Codex core-194, core-195
- **Purpose:** Generic stats for the trends sandbox page
- **Where:** `web/lib/trends/utils.ts:12 (mean)`; `web/lib/trends/utils.ts:17 (std)`; `web/lib/trends/utils.ts:24 (zscore)`; `web/lib/trends/utils.ts:29 (percentile)`; `web/lib/trends/utils.ts:37 (winsorize)`; `web/lib/trends/utils.ts:45 (pearson)`; `web/lib/trends/utils.ts:66 (summarizePairedCorrelation)`; `web/lib/trends/utils.ts:112 (linearRegression)`; `web/lib/trends/utils.ts:130 (scale01)`; `web/lib/trends/utils.ts:29 percentile`; `web/lib/trends/utils.ts:37 winsorize`
- **Tags (heuristic):** percent scale: 0-100; generation: current
- **Opus view (ROLL-038):**
  - Method: std = population SD (divide by n), 0 if n<2; zscore 0 when s=0; percentile = index of first value >= x divided by (n-1) *100 (returns 50 for empty, NaN for n=1); winsorize at p=1%; Pearson r (0 if n<3); OLS slope/intercept with r2 from pearson(y,yhat).
  - Inputs/units: unitless numeric arrays; sources: —
  - Output scale: mean/SD in input units; z-score; percentile 0-100; r in -1..1; writes: —
  - Status: live but sandbox — pages/trendsSandbox.tsx (linked from pages/trends/index.tsx:1680); lib/gameGoalProjections/calculations.ts imports trends utils
  - Consumers: pages/trendsSandbox.tsx; lib/gameGoalProjections/calculations.ts (imports from trends utils)
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
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex core-194): Source types and implementation in web/lib/trends/utils.ts:29; separate acceptance not verified.
  - Intended contract (Codex core-195): Source types and implementation in web/lib/trends/utils.ts:37; separate acceptance not verified.
  - External references: Standard textbook definitions
  - Fixtures/test data: none listed
  - Tests: `No directly named test located; tests not run.`
- **Leads (not audited):**
  - (opus) percentile() divides by (n-1) so n=1 gives 0/0 = NaN; ties take the lowest index (not midrank) - inconsistent with player-card and goalie midrank percentiles
  - (opus) mean([]) returns 0 rather than null
  - (codex:core-194) ["Inventory only, not validation of the formula, source semantics or model quality."]
  - (codex:core-195) ["Inventory only, not validation of the formula, source semantics or model quality."]

## M-ROLL-023 Ratio support-component outputs

- **Match:** Both; Opus ROLL-039; Codex rolling-points
- **Purpose:** Writes numerator/denominator totals beside each ratio so values can be re-derived.
- **Where:** `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:2064 (applyRatioSupportOutputs)`; `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:2001 (applyCanonicalScopedSnapshotOutputs)`; `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:1670 (SUPPORT_METRICS)`; `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:1663 METRICS[points]; web/lib/supabase/Upserts/rollingMetricAggregation.ts:136 computeRatioValue; web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:2828 deriveOutputs. Sums of observed values; legacy *_avg_* fields divide sum by observed count. Season/3YA/career averages use HistoricalAverageAccumulator.`
- **Tags (heuristic):** denominators: per 60; generation: current
- **Opus view (ROLL-039):**
  - Method: Window and season/3YA/career component totals from the ratio accumulator for primary_points_pct, ipp, on_ice_sh_pct, pp_share_pct, pdo, oz_start_pct. For shooting_pct, expected_sh_pct, cf_pct, ff_pct and all per-60s, season/3ya/career numerator/denominator are taken from the separate additive accumulators (e.g. goals, shots, toi_seconds) or support accumulators.
  - Inputs/units: component totals (counts, TOI seconds); sources: —
  - Output scale: raw totals (counts, seconds) per scope; writes: rolling_player_game_metrics, rolling_player_metric_support_payloads
  - Status: live — written by /api/v1/db/update-rolling-player-averages, invoked by /api/v1/db/run-rolling-forge-pipeline (web/vercel.json cron '5,10,15,20,30,35,40,45,55 10 * * *' UTC, mode=daily_incremental; lib/rollingForgePipeline.ts:102); most scopes pruned to rolling_player_metric_support_payloads by isPrunableRollingStorageField
  - Consumers: rollingPlayerPipelineDiagnostics summarizeDerivedWindowDiagnostics; rollingPlayerValidationPayload; pages/trendsDebug.tsx
- **Codex view (rolling-points, calculation, location; Codex family 'Rolling player metrics'):** points
  - Purpose: Summarize player performance at strength and selected rolling/historical scope.
  - Inputs/units: points counts (expected-goal quantity for ixG fields)
  - Output scale: Totals in counts (expected-goal quantity for ixG fields); averages in counts (expected-goal quantity for ixG fields) per observed entry. Scopes all, last3/5/10/20, season, 3YA, career; ratio values rounded to 6 decimals.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED (no comment stating support columns must reproduce the ratio; audit evidence in tasks/artifacts/forge-projection-audit-2026-10-21/rolling-column-inventory.json)
  - Intended contract (Codex rolling-points): web/lib/supabase/Upserts/rollingWindowContract.ts; web/lib/supabase/Upserts/rollingMetricSourceUnitContract.ts:18; web/lib/supabase/Upserts/rollingMetricScaleContract.ts:27. Explicit contract: ratios use aggregated raw components, not averaged per-game rates; appearance windows govern ratio/rate performance.
  - External references: none suggested
  - Fixtures/test data: `web/lib/supabase/Upserts/fixtures/rollingColumnInventory.json`; `tasks/artifacts/forge-projection-audit-2026-10-21/rolling-column-inventory.json`; `tasks/artifacts/rolling-validation-5v5-recheck-2026-10-28/ (RESULTS.json, snapshot/)`; `web/scripts/check-rolling-player-family-reconstruction.ts`; `web/scripts/check-rolling-player-disputed-metrics.ts`
  - Tests: `web/lib/supabase/Upserts/fetchRollingPlayerAverages.test.ts`; `web/lib/supabase/Upserts/rollingPlayerPipelineDiagnostics.test.ts`; `web/lib/supabase/Upserts/rollingPlayerValidationPayload.test.ts`; `{"discovered_not_run": ["web/lib/supabase/Upserts/fetchRollingPlayerAverages.test.ts", "web/lib/supabase/Upserts/rollingMetricAggregation.test.ts", "web/lib/supabase/Upserts/rollingMetricScaleContract.test.ts", "web/lib/supabase/Upserts/rollingMetricSourceUnitContract.test.ts", "web/lib/supabase/Upserts/rollingMetricWindowContractCases.test.ts"]}`
- **Leads (not audited):**
  - (opus) for per-60s and shooting/xsh/cf/ff, the stored season/3ya/career support numerator/denominator come from additive accumulators with different inclusion rules and sources (e.g. toi_seconds includes games whose numerator was missing; assists includes WGO fallback but assists_per_60 does not; goals_per_60 PP uses a different TOI), so support / support * 3600 may not reproduce the stored rate
  - (codex:rolling-points) Exact deployed columns and reader variants not verified. Source snippets are local contracts, not evidence of applied remediation.

## M-ROLL-024 Social share Hot/Cold Recent Form (recent-form-v1-early)

- **Match:** Opus only; Opus ROLL-001; Codex —
- **Purpose:** Rank skaters whose points per game over their last 5 appearances rose or fell most versus the 5 appearances before.
- **Where:** `web/lib/socialShare/trends.ts:185 (trendShortlists form)`; `web/lib/socialShare/trends.ts:118 (activeSkaters)`; `web/lib/socialShare/trends.ts:64-72 (TREND_WINDOW_GAMES, RECENT_FORM_GAMES, MIN_TREND_SEASON_GAMES, TREND_MAX_GAME_AGE_DAYS)`; `web/lib/socialShare/trends.ts:175 (hotOrder)`
- **Tags (heuristic):** denominators: per game; generation: current
- **Opus view (ROLL-001):**
  - Method: Active skater = strength 'all' row from this season with latest game within 7 days of the New York edition date and a known team; whole layer stale if newest row update > 72 h (PLAYER_STATS_MAX_AGE_MS). Qualifier: GP >= 10 and season points proven whole (\|points_avg_season*GP - round\| <= 0.01 and last10 <= season points). recent = last5/5, preceding = (last10-last5)/5 (both rounded 2 dp), delta = recent - preceding. Hot = delta>0 sorted delta desc, then recent desc, then id; Cold = delta<0 mirror. List 5 (+5 slack before name filter).
  - Inputs/units: points counts; windows in appearances; sources: rolling_player_game_metrics
  - Output scale: points per game (2 dp) and delta in P/GP; writes: —
  - Status: live — built into every social-share edition by lib/socialShare/server.ts via buildTrendLayer
  - Consumers: web/lib/socialShare/server.ts (Tuesday trend layer of the social-share edition); web/components/SocialShare/SocialShare.tsx (Hot/Cold, Deployment, Rate, Movers cards)
- **Audit context:**
  - Intent (Opus): web/lib/socialShare/trends.ts:181-184 comment (two non-overlapping 5-appearance windows, all 10 in season; unproven left out, never read as zero); trendDefinitions at trends.ts:478
  - External references: Simple recent-vs-prior form split; compare with hot/cold streak rules (MISC-033) and trends hot/cold (ROLL-028)
  - Fixtures/test data: `web/lib/socialShare/trendsFixture.ts (deterministic synthetic rolling rows)`
  - Tests: `web/components/SocialShare/SocialShare.test.tsx`; `web/e2e/social-share.spec.ts`; `web/lib/socialShare/trendSources.test.ts`; `web/lib/socialShare/trends.test.ts`
- **Leads (not audited):**
  - (opus) 5-game windows of points are very noisy; no regression to the mean or TOI normalisation
  - (opus) third distinct hot/cold definition in the repo (MISC-033 streakOf, ROLL-028 streakIntensity, this) with different windows
  - (opus) the 'season points proven whole' check uses a rounded avg*GP heuristic (0.01 tolerance) to infer no missing games

## M-ROLL-025 Social share per-60 rate standouts (L5 vs season)

- **Match:** Opus only; Opus ROLL-002; Codex —
- **Purpose:** List skaters whose last-5 SOG/60, iCF/60 or ixG/60 most exceed their season rate.
- **Where:** `web/lib/socialShare/trends.ts:195 (trendShortlists rates)`; `web/lib/socialShare/trends.ts:69-70 (MIN_RATE_TOI_SECONDS_LAST5=3000)`; `web/lib/socialShare/trends.ts:91-96 (RATE_METRICS, RATE_COLUMNS, RATE_DIGITS)`
- **Tags (heuristic):** denominators: per 60, shots on goal; generation: current
- **Opus view (ROLL-002):**
  - Method: Qualifier GP >= 10 and L5 TOI >= 3000 s (50 min). Read writer's L5 and season per-60 columns, round (SOG/iCF 1 dp, ixG 2 dp), delta = l5 - season (rounded). Keep delta > 0 only; sort delta desc, l5 desc, id. 3 rows per metric (+5 slack). Shows l5Minutes = floor(L5 TOI/60).
  - Inputs/units: per-60 rates; TOI seconds; sources: rolling_player_game_metrics
  - Output scale: per-60 rate and per-60 delta; writes: —
  - Status: live — social-share edition trend layer (rates section)
  - Consumers: web/lib/socialShare/server.ts (Tuesday trend layer of the social-share edition); web/components/SocialShare/SocialShare.tsx (Hot/Cold, Deployment, Rate, Movers cards)
- **Audit context:**
  - Intent (Opus): web/lib/socialShare/trends.ts:69 comment (L5 per-60 needs at least 50 minutes); trendDefinitions trends.ts:481
  - External references: NST per-60 convention (count*3600/TOI seconds)
  - Fixtures/test data: `web/lib/socialShare/trendsFixture.ts`
  - Tests: `web/components/SocialShare/SocialShare.test.tsx`; `web/e2e/social-share.spec.ts`; `web/lib/socialShare/trendSources.test.ts`; `web/lib/socialShare/trends.test.ts`
- **Leads (not audited):**
  - (opus) only risers are listed (delta>0); no falling-rate list
  - (opus) L5 window overlaps the season window, so the season baseline includes the recent games
  - (opus) ixG per 60 is NST-sourced ixG via the rolling writer, not the in-house xG model

## M-ROLL-026 Social share per-game series reconstruction from cumulative and window sums (sparklines)

- **Match:** Opus only; Opus ROLL-003; Codex —
- **Purpose:** Solve each of a skater's last 10 per-game values exactly from stored season-to-date totals and last-N window totals, then check them against the row's own L5.
- **Where:** `web/lib/socialShare/trends.ts:301 (gameSeries)`; `web/lib/socialShare/trends.ts:407 (pointsSeries)`; `web/lib/socialShare/trends.ts:415 (toiSeries)`; `web/lib/socialShare/trends.ts:424 (rateSeries)`; `web/lib/socialShare/trends.ts:77-78 (SERIES_GAMES=10, SERIES_LOOKBACK_DAYS=35)`
- **Tags (heuristic):** denominators: per 60, per game; generation: current
- **Opus view (ROLL-003):**
  - Method: Ranges: season totals (games 1..n, total = avg_season*GP; points must round to an integer within 0.01) plus writer windows (n-N+1..n). Nested ranges sharing a start or end are subtracted into new ranges (<= 12 rounds, <= 400 ranges); a range with one unknown game solves it; points ranges with total 0 set all games 0. Points series rejected unless sums of last 5/10 equal stored totals; TOI series rejected if \|mean of last 5 - toi_avg_last5\| > 2 s; rate series per game = count/TOI*3600 and rejected if pooled L5 rate differs from stored L5 by > max(2% of L5, 0.05).
  - Inputs/units: seconds TOI; counts; per-60 parts; sources: rolling_player_game_metrics
  - Output scale: per-game values (points, TOI seconds, per-60); writes: —
  - Status: live — sparklines on trend cards
  - Consumers: web/lib/socialShare/server.ts (Tuesday trend layer of the social-share edition); web/components/SocialShare/SocialShare.tsx (Hot/Cold, Deployment, Rate, Movers cards)
- **Audit context:**
  - Intent (Opus): web/lib/socialShare/trends.ts:290-300 comment (TT-17: solved exactly from sums, never interpolated)
  - External references: none suggested
  - Fixtures/test data: `web/lib/socialShare/trendsFixture.ts`
  - Tests: `web/lib/socialShare/trends.test.ts`
- **Leads (not audited):**
  - (opus) per-game values are back-solved from averages*GP, so float error in stored averages propagates (TOI rounded to whole seconds)
  - (opus) per-game per-60 sparklines from single games are extremely noisy

## M-ROLL-027 Additive metric rolling sums/means and historical per-game averages

- **Match:** Opus only; Opus ROLL-004; Codex —
- **Purpose:** Rolling totals and per-game averages for count metrics (goals, assists, shots, hits, blocks, points, pp_points, ixg, iscf, ihdcf, penalties, on-ice counts, zone starts, TOI).
- **Where:** `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:2618 (updateAccumulator)`; `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:2900 (deriveOutputs simple branch)`; `web/lib/supabase/Upserts/rollingHistoricalAverages.ts:85 (updateHistoricalAverageAccumulator)`; `web/lib/supabase/Upserts/rollingHistoricalAverages.ts:104 (getHistoricalAverageSnapshot)`; `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:1972 (getHistoricalSimpleTotalSnapshot)`
- **Tags (heuristic):** denominators: per 60, per game; generation: current
- **Opus view (ROLL-004):**
  - Method: Each non-null value pushes into windows 3/5/10/20 (FIFO). _total_lastN = window sum; _avg_lastN = sum / count of defined values; _total_all / _avg_all over every value read; _avg_season / _avg_3ya / _avg_career = mean per game over season buckets (3YA = current and 2 prior seasons). Metrics: primary_assists, secondary_assists, ixg, penalties_drawn, penalties_taken, iscf, ihdcf, oz_starts, dz_starts, nz_starts, oi_gf, oi_ga, oi_xgf, oi_xga, oi_sf, oi_sa, toi_seconds, pp_toi_seconds, cf, ca, ff, fa, goals, assists, shots, hits, blocks, pp_points, points. Support accumulators: oz_start_neutral_zone_starts, primary/secondary assists raw, shot attempts (icf).
  - Inputs/units: per-game counts; toi_seconds and pp_toi_seconds in seconds; ixg in expected goals; sources: nst_gamelog_{as,es,5v5,pp,pk}_counts, nst_gamelog_*_counts_oi, wgo_skater_stats
  - Output scale: _total_* = sums (counts or seconds); _avg_* = per-game mean (counts/game or seconds/game); not per-60; writes: rolling_player_game_metrics (non-pruned columns e.g. *_avg_last5 kept only if in ROLLING_RANKING_SELECT_FIELDS), rolling_player_metric_support_payloads.support_payload.historicalCompatibility (pruned _all/_last3/_3ya/_career/_avg_ columns)
  - Status: live — written by /api/v1/db/update-rolling-player-averages, invoked by /api/v1/db/run-rolling-forge-pipeline (web/vercel.json cron '5,10,15,20,30,35,40,45,55 10 * * *' UTC, mode=daily_incremental; lib/rollingForgePipeline.ts:102)
  - Consumers: lib/rankings/* (skaterWindowAggregation, trending, metricDefinitions); lib/projections/queries/skater-queries.ts (FORGE); pages/trends/player/[playerId].tsx; lib/socialShare/*; lib/dashboard/commandCenterData.ts
- **Audit context:**
  - Intent (Opus): additive_performance contract 'Last N means the player's last N chronological appearances in the relevant strength state' (rollingWindowContract.ts:59); history read must include earlier games for _all/_3ya/_career (fetchRollingPlayerAverages.ts:3044)
  - External references: Simple per-game mean over last N games played
  - Fixtures/test data: `web/lib/supabase/Upserts/fixtures/rollingColumnInventory.json`; `tasks/artifacts/forge-projection-audit-2026-10-21/rolling-column-inventory.json`; `tasks/artifacts/rolling-validation-5v5-recheck-2026-10-28/ (RESULTS.json, snapshot/)`
  - Tests: `web/lib/supabase/Upserts/fetchRollingPlayerAverages.test.ts`; `web/lib/supabase/Upserts/rollingHistoricalAverages.test.ts`; `web/lib/supabase/Upserts/rollingMetricWindowContractCases.test.ts`
- **Leads (not audited):**
  - (opus) for split strengths (ev/pp/pk/5v5) a game with an NST row of zeros, or a WGO PP-goals fallback of 0, enters additive windows even when the player had 0 TOI in that state, while ratio windows skip it
  - (opus) toi_seconds at split strengths accepts 0 (allowZero) so toi_seconds_avg_lastN at PP averages in zero-PP-TOI games
  - (opus) 'career' only spans wgo_skater_stats coverage for the player, not a true career

## M-ROLL-028 Player trend page: rolling-vs-baseline delta %, hot/cold streak and L7/L14/L30 quick cards

- **Match:** Opus only; Opus ROLL-008; Codex —
- **Purpose:** Client-side comparison of a player's rolling window value against a chosen baseline, streak labelling, and calendar-day recent averages on /trends/player/[playerId].
- **Where:** `web/pages/trends/player/[playerId].tsx:842 (rechartsData: _absolute and _delta per metric)`; `web/pages/trends/player/[playerId].tsx:869 (streakSummaries)`; `web/pages/trends/player/[playerId].tsx:894 (hot/cold threshold +/-8%)`; `web/pages/trends/player/[playerId].tsx:533 (averageMetricByRecentDays)`; `web/pages/trends/player/[playerId].tsx:924 (quickComparisonCards)`
- **Tags (heuristic):** denominators: per 60, per game; generation: current
- **Opus view (ROLL-008):**
  - Method: absolute = rolling - baseline; delta% = (rolling - baseline)/\|baseline\|*100 (null when baseline 0). Streak: latest delta >= +8 -> hot, <= -8 -> cold, else steady; streak length = consecutive most-recent games with delta >= 0 (hot) or <= 0 (cold), a sign test rather than the 8% threshold; averageDelta = mean of all deltas; metrics sorted by \|latestDelta\|. Quick cards: Rolling10 uses the last10 field; L7/L14/L30 = unweighted mean of raw per-game values with game_date in [latest-(days-1), latest] (calendar days anchored to the player's last game, not today), then delta% vs baseline. Metric families: additive_average (goals, assists, points, shots, hits, blocks, pp_points) and weighted_rate per-60 metrics.
  - Inputs/units: per-game counts (additive_average) and per-60 rates (weighted_rate); TOI-average metrics in seconds; sources: rolling_player_game_metrics (wide row + support_payload->historicalCompatibility sidecar)
  - Output scale: delta in percent (unbounded, signed); streak length in games; recent value in source metric units; writes: —
  - Status: live — /trends/player/[playerId] page, linked from FORGE dashboard handoff (forgeOrigin)
  - Consumers: /trends/player/[playerId] page (chart, streak chips 'N straight games above baseline', quick comparison cards)
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED (only in-code labels such as 'straight games above baseline'; web/lib/navigation/analyticsSurfaceOwnership.ts lists 'Rolling-average directionality and hot/cold scanning' as the trends surface remit)
  - External references: none suggested
  - Fixtures/test data: `web/__tests__/pages/trends/player/[playerId].test.tsx (inline rolling rows with *_avg_career / *_avg_last10)`
  - Tests: `web/__tests__/pages/trends/player/[playerId].test.tsx`
- **Leads (not audited):**
  - (opus) L7/L14/L30 averages of per-60 metrics are simple means of per-game rates (not TOI-weighted sum/sum), inconsistent with the weighted_rate contract used by the rolling writer
  - (opus) resolveRawMetricValue reads row[metric.key] (e.g. goals_per_60) as a per-game value; whether that raw column exists/means a single-game rate in rolling_player_game_metrics was not verified
  - (opus) hot/cold label uses an 8% threshold but streak length counts any same-sign delta, so a 'hot' streak may include games only +0.1% above baseline
  - (opus) delta% on near-zero baselines produces very large swings; magic threshold 8 undocumented

## M-ROLL-029 Player trend / team power / rolling-player repair reconciliation audits

- **Match:** Opus only; Opus ROLL-009; Codex —
- **Purpose:** Recompute candidate rows with lib calculators and diff against persisted rows to size repairs
- **Where:** `web/scripts/audit-player-trend-playoff-repair.ts:264 (shots_per_60 60x detection)`; `web/scripts/audit-player-trend-expected-shooting.ts:141 (numericEqual)`; `web/scripts/audit-team-power-repair.ts:105 (numericEqual)`; `web/scripts/audit-rolling-player-repair.ts`; `web/scripts/check-rolling-player-family-reconstruction.ts:105 (weighted_per60 family)`; `web/scripts/check-rolling-player-disputed-metrics.ts:205`; `web/scripts/check-rolling-player-optional-additions.ts:115`; `web/scripts/audit-team-underlying-vs-nhl.ts:59 (compareMetric)`
- **Tags (heuristic):** denominators: per 60; generation: current
- **Opus view (ROLL-009):**
  - Method: audit re-derivation: lib playerTrendCalculator / power-ratings / fetchRollingPlayerAverages recompute candidates; numeric equality tolerance 1e-9 (trend/power) or NUMERIC_TOLERANCE (rolling); counts inserts/updates/deletes; flags shots_per_60 rows where candidate/persisted ratio == 60 within 0.001 (persisted value 60x too low, per-minute vs per-60 bug); team underlying vs NHL flags \|delta\|>0.5 on GP, W, L, OTL, points, GF, GA, SF, SA, CF, CA, FF, FA
  - Inputs/units: per-60 rates, counts, TOI seconds; sources: player_trend_metrics, team_power_ratings_daily, rolling player metrics tables, NHL stats API (team summary, standings, shooting)
  - Output scale: diff counts; writes: —
  - Status: live — manual repair audits
  - Consumers: data repair decisions
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED beyond variable names
  - External references: NHL official team stats; NST per-60 convention
  - Fixtures/test data: none listed
  - Tests: `web/lib/trends/playerTrendCalculator.test.ts`
- **Leads (not audited):**
  - (opus) persisted player_trend_metrics shots_per_60 contained values 60x too low (audit explicitly counts repairedSixtyTimesLowShots)
  - (opus) team-vs-NHL tolerance 0.5 is absolute for every metric regardless of scale

## M-ROLL-030 Rolling-window stat averages, std, OLS trend slope and form features (python research)

- **Match:** Opus only; Opus ROLL-010; Codex —
- **Purpose:** Feature builder for the research predictor: rolling means/std/slopes and consistency ratios
- **Where:** `web/scripts/performance_prediction.py:858 (calculate_rolling_averages)`; `web/scripts/performance_prediction.py:938 (calculate_derived_features)`
- **Tags (heuristic):** denominators: per 60, per game, shots on goal; generation: legacy, research
- **Opus view (ROLL-010):**
  - Method: windows 5/10/15/20 (min_periods min(3,window)): rolling mean, rolling std (window>=5), rolling np.polyfit slope over index; fantasy_points_est = 6 G + 4 A + 0.9 SOG + 0.6 HIT + 0.6 BLK (falls back to blocks_per_60); goals/assists last-3/5 sums; points consistency = std/(mean+0.001); points_per_toi = points/(toi+0.001); shot_quality = goals/(shots+0.001); form_vs_season = rolling5 mean - expanding season mean
  - Inputs/units: mixed per-game counts, per-60 rates, percents; sources: wgo_skater_stats
  - Output scale: same units as inputs; slopes per game; writes: —
  - Status: legacy/dead — research only
  - Consumers: performance_prediction.py only
- **Audit context:**
  - Intent (Opus): docstrings at web/scripts/performance_prediction.py:859,939
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: none listed
- **Leads (not audited):**
  - (opus) rolling averages of rate fields (per-60, percentages) are unweighted by TOI/shots
  - (opus) form_vs_season subtracts series with different groupby indexes (player+season vs player) via .values, alignment relies on sort order
  - (opus) may substitute blocks_per_60 for blocked_shots count in FP estimate (unit mismatch)

## M-ROLL-031 Trend window/limit constants and category direction

- **Match:** Opus only; Opus ROLL-012; Codex —
- **Purpose:** Window options and higher-is-better flags for player trend leaderboards
- **Where:** `web/lib/trends/skaterMetricConfig.ts:15 (SKATER_TREND_CATEGORIES)`; `web/lib/trends/skaterMetricConfig.ts:46 (SKATER_WINDOW_OPTIONS)`; `web/lib/trends/goalieMetricConfig.ts:15 (GOALIE_TREND_CATEGORIES)`; `web/lib/trends/goalieMetricConfig.ts:46 (GOALIE_WINDOW_OPTIONS)`; `web/lib/trends/playerTrendRebuildScope.ts:3 (resolvePlayerTrendWriteFromDate)`
- **Tags (heuristic):** generation: current
- **Opus view (ROLL-012):**
  - Method: Skater windows 1/3/5/10/20 GP (default 1), goalie 1/3/5/10 (default 3); GAA lower-is-better; forward positions C/LW/RW/F/L/R; repair window 7 days back.
  - Inputs/units: games played windows; days; sources: —
  - Output scale: config constants; writes: —
  - Status: live — imported by skater-power/goalie-power APIs and trendsSurface
  - Consumers: skater-power/goalie-power APIs; trendsSurface
- **Audit context:**
  - Intent (Opus): web/lib/trends/skaterMetricConfig.ts:15-44 and goalieMetricConfig.ts:15-44 category descriptions
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/__tests__/pages/api/v1/trends/skater-power.test.ts`; `web/lib/trends/goalieMetricConfig.test.ts`
- **Leads (not audited):**
  - (opus) skater window 20 offered but playerTrendCalculator only stores rolling 3/5/10; window 20 must be computed elsewhere
  - (opus) shots/60 description says 'at all strengths' while metric may come from NST all-situations per-60 or WGO fallback

## M-ROLL-032 Line combination slot/group and PP unit context labels

- **Match:** Opus only; Opus ROLL-013; Codex —
- **Purpose:** Derive the player's line number and position group and trusted PP unit label per game.
- **Where:** `web/lib/supabase/Upserts/rollingPlayerLineContextContract.ts:35 (resolveTrustedLineAssignment)`; `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:3402 (resolveLineCombo)`; `web/lib/supabase/Upserts/rollingPlayerPpUnitContract.ts:33 (resolvePpUnitLabel)`
- **Tags (heuristic):** generation: current
- **Opus view (ROLL-013):**
  - Method: Slot = floor(index in list / group size) + 1 with group size 3 for forwards, 2 for defense, 1 for goalies, checked in that order. PP unit kept only when the original game id is a number and unit is a positive integer.
  - Inputs/units: ordered player-id arrays; PP unit integer; sources: lineCombinations, powerPlayCombinations
  - Output scale: slot integer 1..n; group label; pp_unit positive integer; writes: rolling_player_game_metrics
  - Status: live — written by /api/v1/db/update-rolling-player-averages, invoked by /api/v1/db/run-rolling-forge-pipeline (web/vercel.json cron '5,10,15,20,30,35,40,45,55 10 * * *' UTC, mode=daily_incremental; lib/rollingForgePipeline.ts:102)
  - Consumers: lib/rankings/skaterDeploymentAggregation.ts; roleWatch social module; trends player page
- **Audit context:**
  - Intent (Opus): ROLLING_PLAYER_LINE_CONTEXT_CONTRACT and ROLLING_PLAYER_PP_UNIT_CONTRACT: contextual labels, not rolling metrics (web/lib/supabase/Upserts/rollingPlayerLineContextContract.ts:14-33; rollingPlayerPpUnitContract.ts:1-19)
  - External references: none suggested
  - Fixtures/test data: `web/scripts/check-rolling-player-context-labels.ts`
  - Tests: `web/lib/supabase/Upserts/rollingPlayerLineContextContract.test.ts`; `web/lib/supabase/Upserts/rollingPlayerPpUnitContract.test.ts`
- **Leads (not audited):**
  - (opus) slot assumes the builder lists forwards strictly in groups of 3 and defense in pairs; an incomplete line (e.g. 11 forwards) shifts every later slot

## M-ROLL-033 Aligned count support pairs (goals per shot, assists per goal)

- **Match:** Opus only; Opus ROLL-015; Codex —
- **Purpose:** Hash-verified cumulative and last-5 count frames for EV and PP rows used by FORGE adjustments.
- **Where:** `web/lib/rollingPlayerCountSupport.ts:33 (createAlignedCountSupportBuilder)`; `web/lib/rollingPlayerCountSupport.ts:97 (readAlignedCountSupport)`; `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:3925 (builder wiring)`
- **Tags (heuristic):** denominators: per game, shots on goal; generation: current
- **Opus view (ROLL-015):**
  - Method: For each WGO game matching a canonical game (same date and season) with exactly one NST row: goalPerShot frame = goals/shots (requires goals <= shots), assistPerGoal frame = total_assists/goals. Keeps all-to-date sums (observations, numerator, denominator) and last 5 observed frames with SHA-256 frame hashes; missing rows excluded and counted.
  - Inputs/units: per-game integer counts (goals, shots on goal, total assists) at EV/PP; sources: nst_gamelog_es_counts, nst_gamelog_pp_counts, games, wgo_skater_stats
  - Output scale: raw numerator/denominator sums (all-to-date and last 5 observed frames); no ratio stored; writes: rolling_player_metric_support_payloads.support_payload.alignedCountSupport
  - Status: live — built on ev/pp rows on the cron path and read by FORGE (lib/projections/queries/skater-queries.ts, calculators/skater-adjustments.ts)
  - Consumers: lib/projections/calculators/skater-adjustments.ts; lib/projections/queries/skater-queries.ts
- **Audit context:**
  - Intent (Opus): 'The WGO event must agree with the canonical game. A source date join remains explicitly declared, not independent NST event proof.' (web/lib/rollingPlayerCountSupport.ts:32); legacy scalar totals never establish a frame (:96)
  - External references: Ratio-of-sums finishing (G/SOG) and assists per goal
  - Fixtures/test data: `tasks/artifacts/forge-projection-audit-2026-10-21/release-es-assist-refit/`
  - Tests: `web/lib/projections/queries/skater-queries.test.ts`; `web/lib/projections/runProjectionV2.alignedConversion.test.ts`; `web/lib/rollingPlayerCountSupport.test.ts`
- **Leads (not audited):**
  - (opus) assistPerGoal uses the player's own goals as denominator (assists / own goals), not on-ice goals; meaning should be checked against the FORGE consumer
  - (opus) 'all' spans from the player's first WGO row in the read (career), with last5 = last 5 observed pairs, not last 5 games

## M-ROLL-034 SKO inputs: IPP and SOG/60

- **Match:** Opus only; Opus ROLL-029; Codex —
- **Purpose:** Compute per-game and per-season skater IPP and shots-on-goal per 60 for sKO stats.
- **Where:** `web/lib/supabase/Upserts/fetchSKOskaterStats.js:264 (totalOnIceGoalsFor, ipp, sogPer60)`; `web/lib/supabase/Upserts/fetchSKOyears.js:156 (totalOnIceGoalsFor, ipp, sogPer60)`
- **Tags (heuristic):** percent scale: 0-100; denominators: per 60, shots on goal; generation: legacy, current
- **Opus view (ROLL-029):**
  - Method: onIceGF = ES GF + PP GF + SH GF; IPP = points / onIceGF * 100 (null if 0). TOI minutes = timeOnIce/60; SOG/60 = shots / TOI minutes * 60. Other columns (shooting %, oiSH%, zone start %, PP TOI %) copied.
  - Inputs/units: points/goals counts; timeOnIce in SECONDS converted to minutes; sources: NHL stats REST skater summary/goalsForAgainst/timeonice/puckPossessions/powerplay (daily isGame=true aggregate; season isGame=false)
  - Output scale: IPP percent 0-100; SOG per 60; writes: sko_skater_stats, sko_skater_years
  - Status: legacy/dead — web/lib/predictions/legacyQuarantine.ts:122-123 marks both JS files as legacy manual source-ingest scripts; live equivalent is pages/api/v1/db/update-sko-stats.ts:156-195 (pg_cron update-sko-stats-full-season active=true, cron-schedule.md:514)
  - Consumers: pages/api/v1/db/update-sko-stats.ts; lib/supabase/utils/dataFetching.ts
- **Audit context:**
  - Intent (Opus): web/lib/supabase/Upserts/fetchSKOskaterStats.js:263 (comment: 'Calculate fields'); fetchSKOyears.js:161 (comment: Individual Points Percentage) — no contract on percent units
  - External references: NST IPP (points / on-ice GF) and per-60 convention
  - Fixtures/test data: none listed
  - Tests: `web/__tests__/pages/api/v1/db/update-sko-stats.route.test.ts`; `web/__tests__/pages/api/v1/db/update-sko-stats.test.ts (tests the live route reimplementation, not these JS files)`
- **Leads (not audited):**
  - (opus) IPP is 0-100 while copied shooting_percentage / on_ice_shooting_pct from NHL API are 0-1 fractions - mixed percent units in one row
  - (opus) daily rows are single-game IPP/SOG60; any rolling use must recompute ratio-of-sums
  - (opus) fetchSKOyears treats shots=0 as null SOG/60 (truthy check) whereas fetchSKOskaterStats returns 0

## M-ROLL-035 Additive metric source precedence (NST counts vs WGO)

- **Match:** Opus only; Opus ROLL-031; Codex —
- **Purpose:** Chooses the per-game value for each count metric by strength.
- **Where:** `web/lib/supabase/Upserts/rollingPlayerSourceSelection.ts:46 (getPointsValue)`; `web/lib/supabase/Upserts/rollingPlayerSourceSelection.ts:66 (getGoalsValue)`; `web/lib/supabase/Upserts/rollingPlayerSourceSelection.ts:145 (getPpPointsValue)`; `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:1072 (source precedence contract comment)`; `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:3567 (buildGameRecords)`
- **Tags (heuristic):** denominators: per game; generation: current
- **Opus view (ROLL-031):**
  - Method: WGO rows are the appearance spine (one rolling row per WGO game). NST counts win when non-null. WGO fills only at strength 'all' for points, shots, goals, assists, primary/secondary assists, hits, blocks; goals at 'pp' fall back to WGO pp_goals. penalties drawn/taken are NST-only. pp_points: 'pp' strength = NST PP counts total_points; 'all' = WGO pp_points only; other strengths null.
  - Inputs/units: per-game counts from NST and WGO; sources: wgo_skater_stats (row spine), nst_gamelog_{as,es,5v5,pp,pk}_counts
  - Output scale: per-game counts (no scaling); writes: —
  - Status: live — written by /api/v1/db/update-rolling-player-averages, invoked by /api/v1/db/run-rolling-forge-pipeline (web/vercel.json cron '5,10,15,20,30,35,40,45,55 10 * * *' UTC, mode=daily_incremental; lib/rollingForgePipeline.ts:102)
  - Consumers: all rolling metrics
- **Audit context:**
  - Intent (Opus): Source precedence contract (web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:1072-1089): WGO is the appearance spine; NST counts authoritative; WGO fills only all-strength gaps
  - External references: none suggested
  - Fixtures/test data: `web/lib/supabase/Upserts/fixtures/rollingColumnInventory.json`; `tasks/artifacts/forge-projection-audit-2026-10-21/rolling-column-inventory.json`; `tasks/artifacts/rolling-validation-5v5-recheck-2026-10-28/ (RESULTS.json, snapshot/)`; `web/__tests__/fixtures/nst/oct1-identity-source.json`
  - Tests: `web/lib/supabase/Upserts/fetchRollingPlayerAverages.test.ts`; `web/lib/supabase/Upserts/rollingPlayerSourceSelection.test.ts`
- **Leads (not audited):**
  - (opus) pp_points at all strength ignores NST entirely (WGO only), unlike every other all-strength count
  - (opus) NST rows are matched to WGO games purely by calendar date; a WGO row whose date differs from NST date_scraped silently loses NST coverage
  - (opus) 'ev' rows read nst_gamelog_es_* while '5v5' reads nst_gamelog_5v5_*; ES (all even strength incl. 4v4/3v3) and 5v5 are distinct and both written

## M-ROLL-036 Trend surface leader selection

- **Match:** Opus only; Opus ROLL-033; Codex —
- **Purpose:** Pick top-3 leaders per skater trend category
- **Where:** `web/lib/trends/trendsSurface.ts:173 (buildSkaterRecentSummaryCards)`; `web/lib/trends/trendsSurface.ts:40 (PLAYER_QUICK_VIEWS)`
- **Tags (heuristic):** denominators: per game; generation: current
- **Opus view (ROLL-033):**
  - Method: Sort by percentile desc then latestValue desc; take 3. Quick views: L7/L14/L30 calendar-day averages and rolling 10-game value.
  - Inputs/units: percentile 0-100; latestValue in metric units (TOI assumed seconds per game, trendsSurface.ts:121-122); sources: —
  - Output scale: top-3 leader list; writes: —
  - Status: live — pages/trends/index.tsx
  - Consumers: trends pages
- **Audit context:**
  - Intent (Opus): web/lib/trends/trendsSurface.ts:121-122 'headline figure is the stat itself... TOI fields arrive as seconds per game'; :214 tie-break comment
  - External references: none suggested
  - Fixtures/test data: `web/lib/socialShare/trendsFixture.ts`
  - Tests: `web/lib/trends/trendsSurface.test.ts`
- **Leads (not audited):**
  - (opus) L7/L14/L30 are calendar-day windows while other views are last-N-games windows
  - (opus) comment says TOI arrives as seconds per game, conflicting with minutes produced by playoff normalisation

## M-ROLL-037 Team rolling opponent-record strength of schedule

- **Match:** Opus only; Opus ROLL-034; Codex —
- **Purpose:** Accumulate opponents' W/L/OTL at game time and game_number per team.
- **Where:** `web/lib/supabase/Upserts/fetchRollingGames.js:173 (findLatestStandings)`; `web/lib/supabase/Upserts/fetchRollingGames.js:361 (calculateAndUpdateCumulativeStats)`; `web/lib/supabase/Upserts/fetchRollingGames.js:475 (cumulative opponent sums)`; `web/lib/supabase/Upserts/fetchRollingGames.js:599 (per-game opponent record)`
- **Tags (heuristic):** denominators: per game; generation: legacy
- **Opus view (ROLL-034):**
  - Method: Binary search the opponent's standings row on or before game date; game_number increments per team; cumulative opponent wins/losses/OTL = running sum of the opponent's season-to-date record at each game. Second pass writes per-game opponent_wins (overwriting the cumulative values) plus std_opponent_* running sums and ltg_opponent_* sums over last 10.
  - Inputs/units: standings W/L/OTL counts; sources: rolling_games, standings
  - Output scale: cumulative and per-game opponent record counts; writes: rolling_games
  - Status: legacy/dead — same 410 quarantine stub as rolling games (pages/api/v1/db/update-rolling-games.ts)
  - Consumers: update-rolling-games route
- **Audit context:**
  - Intent (Opus): web/lib/supabase/Upserts/fetchRollingGames.js:405 (comment: seed cumulative values from last game before baseline); SoS intent otherwise UNDOCUMENTED
  - External references: Opponent win% SoS (NHL/hockey-reference style), opponent records as of game date exclusive
  - Fixtures/test data: none listed
  - Tests: none listed
- **Leads (not audited):**
  - (opus) opponent_wins is first written as cumulative then overwritten with the per-game value by calculateOpponentAndLtgStats - two definitions for one column
  - (opus) standings 'on or before game date' includes same-day standings, which may already include that game's result (leakage)
  - (opus) summing season-to-date records across games weights later games more; no conversion to a win% SoS

## M-ROLL-038 TOI resolution, trust tiers and WGO minutes/seconds normalization

- **Match:** Opus only; Opus ROLL-036; Codex —
- **Purpose:** Resolve per-game TOI seconds for each strength with source priority and sanity bounds.
- **Where:** `web/lib/supabase/Upserts/rollingPlayerToiContract.ts:39 (inspectToiSeconds)`; `web/lib/supabase/Upserts/rollingPlayerToiContract.ts:66 (normalizeWgoToiPerGame)`; `web/lib/supabase/Upserts/rollingPlayerToiContract.ts:112 (resolveFallbackToiSeed)`; `web/lib/supabase/Upserts/rollingPlayerToiContract.ts:175 (resolveRollingPlayerToiContext)`; `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:1788 (getWgoToiForStrength)`; `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:1854 (getToiSeconds)`
- **Tags (heuristic):** denominators: per game, all strengths; generation: current
- **Opus view (ROLL-036):**
  - Method: Priority counts (authoritative) -> counts_oi (authoritative) -> rates toi_per_gp (supplementary) -> fallback seed (counts/counts_oi/WGO) -> WGO (fallback). Rejected if non-finite, <0 (or 0 for all strength; 0 allowed for split strengths) or >= 4000 s. WGO all-strength value > 200 is treated as seconds, otherwise minutes*60 (rounded); split-strength WGO fields are always treated as seconds.
  - Inputs/units: NST toi and toi_per_gp in seconds; WGO all-strength toi_per_game seconds or minutes (guessed: >200 = seconds); WGO strength-specific fields treated as seconds; sources: nst_gamelog_*_counts, nst_gamelog_*_counts_oi, nst_gamelog_*_rates, wgo_skater_stats
  - Output scale: TOI seconds per game, valid range (0 or >0) to <4000 s; writes: rolling_player_game_metrics (toi_seconds_*)
  - Status: live — written by /api/v1/db/update-rolling-player-averages, invoked by /api/v1/db/run-rolling-forge-pipeline (web/vercel.json cron '5,10,15,20,30,35,40,45,55 10 * * *' UTC, mode=daily_incremental; lib/rollingForgePipeline.ts:102)
  - Consumers: all per-60 metrics; split-strength appearance anchor (TOI>0); toi_seconds_avg_last5 / toi_seconds_avg_all read by FORGE
- **Audit context:**
  - Intent (Opus): 'NHL strength-specific report fields are seconds, including short/zero usage' (web/lib/supabase/Upserts/rollingPlayerToiContract.ts:94); TOI source priority summary rollingPlayerValidationPayload.ts:1122-1128; toi_seconds contract rollingMetricSourceUnitContract.ts:30
  - External references: NST TOI in seconds; NHL API timeOnIce seconds
  - Fixtures/test data: `web/lib/supabase/Upserts/fixtures/rollingColumnInventory.json`; `tasks/artifacts/forge-projection-audit-2026-10-21/rolling-column-inventory.json`; `tasks/artifacts/rolling-validation-5v5-recheck-2026-10-28/ (RESULTS.json, snapshot/)`; `tasks/TASKS/wigo-charts-audit/16-time-on-ice.md`
  - Tests: `web/lib/supabase/Upserts/fetchRollingPlayerAverages.test.ts`; `web/lib/supabase/Upserts/rollingPlayerToiContract.test.ts`
- **Leads (not audited):**
  - (opus) the >200 heuristic misreads an all-strength WGO value that is really seconds but below 200 (e.g. 150 s) as minutes -> 9000 s -> rejected as above_max, so very short games lose TOI
  - (opus) 4000 s cap (66:40) can reject legitimate multi-overtime all-strength TOI
  - (opus) the fallback seed re-runs the same counts/counts_oi candidates already tried, so the 'fallback' tier is effectively just WGO

## M-ROLL-039 Playoff skater TOI normalisation

- **Match:** Opus only; Opus ROLL-037; Codex —
- **Purpose:** Convert playoff toi_per_game seconds to minutes before trend calc
- **Where:** `web/lib/trends/playerTrendCalculator.ts:18 (normalizePlayoffSkaterTrendRow)`
- **Tags (heuristic):** denominators: per 60, per game; generation: current
- **Opus view (ROLL-037):**
  - Method: toi_per_game = raw/60.
  - Inputs/units: wgo_skater_stats_playoffs.toi_per_game seconds; sources: wgo_skater_stats_playoffs
  - Output scale: minutes per game; writes: player_trend_metrics (indirect)
  - Status: live — pages/api/v1/trends/player-trends.ts:195 during cron rebuild
  - Consumers: pages/api/v1/trends/player-trends.ts:195; scripts/audit-player-trend-playoff-repair.ts
- **Audit context:**
  - Intent (Opus): web/scripts/audit-player-trend-playoff-repair.ts:349 'normalize playoff TOI seconds to minutes'
  - External references: none suggested
  - Fixtures/test data: `web/scripts/audit-player-trend-playoff-repair.ts`
  - Tests: `web/__tests__/pages/api/v1/trends/player-trends.test.ts`
- **Leads (not audited):**
  - (opus) see unit-consistency flag vs regular-season player_stats_unified toi_per_game

## M-ROLL-040 Legacy GP and _avg_/_total_ alias outputs and compatibility resolution

- **Match:** Opus only; Opus ROLL-040; Codex —
- **Purpose:** Keeps legacy column names populated and decides canonical vs legacy precedence for readers.
- **Where:** `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:2718 (applyLegacyGpAliases)`; `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:2860 (deriveOutputs ratio _avg_/_total_ aliases)`; `web/lib/rollingPlayerMetricCompatibility.ts:132 (resolveFiniteCompatibilityValue)`; `web/lib/rollingPlayerMetricCompatibility.ts:166 (interpretLegacyGpSemanticType)`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: per 60, per game; generation: legacy, current
- **Opus view (ROLL-040):**
  - Method: For ratio and per-60 metrics, _avg_lastN and _total_lastN both equal the ratio-of-sums value (not a mean of per-game ratios). gp_pct_total_* and gp_pct_avg_* mirror the availability/participation ratios. Readers prefer canonical first for ratio/weighted_rate/availability families and legacy first for additive/TOI families.
  - Inputs/units: canonical outputs (same units as source metric); sources: —
  - Output scale: same as canonical metric (fraction 0-1 for gp_pct; percent/per-60 per metric); writes: rolling_player_game_metrics, rolling_player_metric_support_payloads.deprecatedCompatibility (gp_pct_*)
  - Status: live (compatibility) — still written on cron path; gp_pct_* routed to deprecatedCompatibility; many legacy columns dropped per web/lib/supabase/Upserts/rollingDroppedColumns.ts:1
  - Consumers: lib/rankings/*; FORGE; trends pages
- **Audit context:**
  - Intent (Opus): Compatibility inventory comment (web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:2687); legacyFieldPolicy gpPctAvgFields 'deprecated_aliases_not_real_averages' (rollingPlayerAvailabilityContract.ts:122)
  - External references: none suggested
  - Fixtures/test data: `web/lib/supabase/Upserts/fixtures/rollingColumnInventory.json`; `tasks/artifacts/forge-projection-audit-2026-10-21/rolling-column-inventory.json`; `tasks/artifacts/rolling-validation-5v5-recheck-2026-10-28/ (RESULTS.json, snapshot/)`
  - Tests: `web/lib/rollingPlayerMetricCompatibility.test.ts`; `web/lib/supabase/Upserts/fetchRollingPlayerAverages.test.ts`
- **Leads (not audited):**
  - (opus) '_avg_' on ratio/per-60 columns is a ratio of sums, while '_avg_' on additive columns is a per-game mean - same suffix, different meaning
  - (opus) gp_pct_avg_* are labelled deprecated aliases 'not real averages' but are still written

## M-ROLL-041 Pipeline diagnostics: scale bounds, ratio re-check, source tail lag

- **Match:** Opus only; Opus ROLL-041; Codex —
- **Purpose:** Flag out-of-range outputs, GP ratio mismatches and stale source tails.
- **Where:** `web/lib/supabase/Upserts/rollingPlayerPipelineDiagnostics.ts:699 (summarizeSuspiciousOutputs)`; `web/lib/supabase/Upserts/rollingPlayerPipelineDiagnostics.ts:512 (summarizeDerivedWindowDiagnostics)`; `web/lib/supabase/Upserts/rollingPlayerPipelineDiagnostics.ts:316 (summarizeSourceTailFreshness)`; `web/lib/supabase/Upserts/rollingPlayerPipelineDiagnostics.ts:155 (summarizeCoverage)`; `web/lib/supabase/Upserts/rollingMetricScaleContract.ts:27 (ROLLING_METRIC_SCALE_CONTRACTS)`
- **Tags (heuristic):** generation: current
- **Opus view (ROLL-041):**
  - Method: Bounds: fractions 0-1 (gp_pct, availability_pct, primary_points_pct, expected_sh_pct, pp_share_pct), percents 0-100 (shooting_pct, ipp, oz_start_pct, on_ice_sh_pct, on_ice_sv_pct, cf_pct, ff_pct), PDO 0-2. GP checks: numerator <= denominator and \|min(1, num/den) - stored\| <= 1e-6. Tail lag = count of expected WGO dates (all) or split-source dates after the latest date in each NST table; PP lag counts WGO games with pp_toi > 0 after the latest builder game id; line lag counts WGO game ids after the latest line row.
  - Inputs/units: derived row values in their stored scales; dates; game ids; sources: nst_gamelog_*, wgo_skater_stats, powerPlayCombinations, lineCombinations
  - Output scale: warning counts and lag counts (integers); writes: —
  - Status: live but skipped on cron profiles — skipDiagnostics=true for daily_incremental/overnight/targeted_repair (web/lib/rollingPlayerOperationalPolicy.ts:19-36); summarizeSourceTailFreshness still runs every time
  - Consumers: fetchRollingPlayerAverages run summary; rollingPlayerValidationPayload readiness
- **Audit context:**
  - Intent (Opus): Scale bounds from ROLLING_METRIC_SCALE_CONTRACTS (web/lib/supabase/Upserts/rollingMetricScaleContract.ts:27); tail freshness UNDOCUMENTED beyond code
  - External references: none suggested
  - Fixtures/test data: `web/scripts/check-rolling-player-coverage.ts`; `web/scripts/check-rolling-player-validation-freshness.ts`
  - Tests: `web/lib/supabase/Upserts/rollingMetricScaleContract.test.ts`; `web/lib/supabase/Upserts/rollingPlayerPipelineDiagnostics.test.ts`
- **Leads (not audited):**
  - (opus) tail-lag compares game ids numerically ('latest id'), which assumes game ids increase with date across seasons/game types

## M-ROLL-042 Validation recompute comparison and reconstruction helpers

- **Match:** Opus only; Opus ROLL-042; Codex —
- **Purpose:** Compare stored rows with a fresh recompute and reconstruct missing support values for the debug page.
- **Where:** `web/lib/supabase/Upserts/rollingPlayerValidationPayload.ts:606 (compareValues)`; `web/lib/supabase/Upserts/rollingPlayerValidationPayload.ts:968 (resolveWeightedRateSupportFieldValue)`; `web/lib/supabase/Upserts/rollingPlayerValidationPayload.ts:1580 (buildToiTraceRows)`; `web/lib/supabase/Upserts/rollingPlayerValidationPayload.ts:1652 (inferTeamPpToi)`; `web/lib/supabase/Upserts/rollingPlayerValidationPayload.ts:1178 (buildAvailabilityWindowMembership)`; `web/lib/supabase/Upserts/rollingPlayerValidationPayload.ts:1285 (inferMismatchCauseBucket)`; `web/lib/supabase/Upserts/rollingPlayerValidationPayload.ts:1772 (buildReadiness)`; `web/lib/supabase/Upserts/rollingPlayerValidationPayload.ts:490 (METRIC_FORMULAS)`
- **Tags (heuristic):** percent scale: 0-100; denominators: per 60, per team game; generation: current
- **Opus view (ROLL-042):**
  - Method: Diff = stored - recomputed; match if \|diff\| <= 1e-6; percentDiff = diff/\|recomputed\|*100. Missing per-60 numerator support for _total_ scopes rebuilt as rate * toi_seconds / 3600. Team PP TOI inferred = player PP TOI / share. Availability membership = last N team games of the focused team in the requested season; other metrics = last N stored rows. Readiness BLOCKED on any source tail lag or unknown game ids; mismatch cause bucket stale source / stale target / logic defect. Formula strings documented in METRIC_FORMULAS.
  - Inputs/units: stored and recomputed row values (same scales as writer); TOI seconds; share fraction 0-1; sources: rolling_player_game_metrics, rolling_player_metric_support_payloads, games, wgo_skater_stats, nst_gamelog_*, powerPlayCombinations, lineCombinations, players
  - Output scale: absolute diff, percent diff (0-100), readiness label; writes: —
  - Status: live (debug) — /api/v1/debug/rolling-player-metrics used by pages/trendsDebug.tsx; not on the cron path
  - Consumers: pages/api/v1/debug/rolling-player-metrics.ts; pages/trendsDebug.tsx
- **Audit context:**
  - Intent (Opus): METRIC_FORMULAS reconstruction strings (web/lib/supabase/Upserts/rollingPlayerValidationPayload.ts:490); readiness rules :1772
  - External references: none suggested
  - Fixtures/test data: `web/scripts/check-rolling-player-family-reconstruction.ts`; `web/scripts/check-rolling-player-disputed-metrics.ts`; `tasks/artifacts/rolling-validation-5v5-recheck-2026-10-28/ (RESULTS.json, recheck.cjs)`
  - Tests: `web/__tests__/pages/api/v1/debug/rolling-player-metrics.test.ts`; `web/lib/supabase/Upserts/rollingPlayerValidationPayload.test.ts`
- **Leads (not audited):**
  - (opus) buildToiTraceRows always passes wgo.toi_per_game and omits strengthSpecific, so the TOI trace for ev/pp/pk/5v5 rows differs from the writer, which uses the strength-specific WGO field treated as seconds
  - (opus) METRIC_FORMULAS says assists_per_60 = sum(assists)/sum(toi)*3600 but the writer's numerator is NST total_assists only (no WGO fallback)
  - (opus) appearance window membership slices stored rows, which for split strengths includes zero-TOI rows the writer's anchored ratio windows skip

## M-ROLL-043 Team game ledger, season-id derivation and appearance anchor

- **Match:** Opus only; Opus ROLL-043; Codex —
- **Purpose:** Per-team cumulative game index by date and per-row season assignment.
- **Where:** `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:1883 (buildTeamGameLedger)`; `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:1911 (getTeamGamesPlayed)`; `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:3369 (getSeasonIdForGameDate)`; `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:3379 (resolveSeasonValue)`; `web/lib/supabase/Upserts/rollingHistoricalAverages.ts:12 (getSeasonWindowKey)`
- **Tags (heuristic):** denominators: per team game; generation: current
- **Opus view (ROLL-043):**
  - Method: Ledger: per team+season, sort games by date and number them 1..n; binary search gives games played through a date. Season: if WGO season_id disagrees with the date-derived season (startYear = year if month >= 9 else year-1; id = startYear*10001+1, e.g. 2024 -> 20242025) the date wins (fixes mislabelled 2010-2017 rows); else WGO season_id, NST counts season, rates season, or 0. Season window key = floor(season/10000).
  - Inputs/units: ISO dates; season ids YYYYYYYY; sources: games, wgo_skater_stats, nst_gamelog_*
  - Output scale: team game index 1..n; season id; writes: rolling_player_game_metrics (season, team_id)
  - Status: live — written by /api/v1/db/update-rolling-player-averages, invoked by /api/v1/db/run-rolling-forge-pipeline (web/vercel.json cron '5,10,15,20,30,35,40,45,55 10 * * *' UTC, mode=daily_incremental; lib/rollingForgePipeline.ts:102)
  - Consumers: GP%/availability; historical season/3YA/career buckets
- **Audit context:**
  - Intent (Opus): 'Seasons run September through August, so the game date fixes the season' and the WGO season_id leak fix (web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:3368, :3385)
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/supabase/Upserts/fetchRollingPlayerAverages.test.ts`
- **Leads (not audited):**
  - (opus) September-start cut-off assigns any August game to the prior season (fine for 2020 bubble) but any September regular-season or preseason game to the next season
  - (opus) season 0 fallback ('missing') puts rows in their own bucket outside 3YA windows

## M-ROLL-044 Ratio-of-sums rolling/historical aggregation engine

- **Match:** Opus only; Opus ROLL-044; Codex —
- **Purpose:** Shared accumulator that computes every ratio and per-60 metric from summed numerator/denominator components over last-N, all-processed, season, 3-year and career scopes.
- **Where:** `web/lib/supabase/Upserts/rollingMetricAggregation.ts:136 (computeRatioValue)`; `web/lib/supabase/Upserts/rollingMetricAggregation.ts:223 (normalizeRatioWindowEntry)`; `web/lib/supabase/Upserts/rollingMetricAggregation.ts:263 (updateRatioRollingAccumulator)`; `web/lib/supabase/Upserts/rollingMetricAggregation.ts:309 (getRatioRollingSnapshot)`; `web/lib/supabase/Upserts/rollingMetricAggregation.ts:355 (updateHistoricalRatioAccumulator)`; `web/lib/supabase/Upserts/rollingMetricAggregation.ts:381 (getHistoricalRatioSnapshot)`; `web/lib/supabase/Upserts/rollingMetricAggregation.ts:210 (getRatioRollingWindowModeForFamily)`; `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:3943 (processPlayer derive loop: anchor = didPlayerCountAsAppearance)`
- **Tags (heuristic):** percent scale: both/ambiguous; denominators: per 60, per game, all strengths; generation: current
- **Opus view (ROLL-044):**
  - Method: Value = (sum num / sum den) * scale, optionally + (sum num2 / sum den2) * scale ('sum' combine, used by PDO), then * outputScale, rounded to 6 dp. Never averages per-game ratios. Windows 3/5/10/20 (CANONICAL_ROLLING_GAME_WINDOWS) are FIFO queues of the last N slots. For ratio_performance and weighted_rate_performance families the window mode is 'appearance': a slot is consumed only when anchor=true (all-strength: every WGO row; split strengths: TOI>0), and a slot with missing/invalid components still occupies the slot but adds nothing. A missing numerator beside a present denominator drops the components (explicit 0 still counts). No denominator -> null or 0 per spec. Historical buckets are keyed by season and are NOT anchor-gated; 3YA = seasons with startYear in [current-2, current]; career = every season bucket read.
  - Inputs/units: raw component totals (counts, TOI seconds, on-ice counts); season ids like 20242025; sources: —
  - Output scale: depends on spec: scale 3600 -> per-60 rate; scale 100 -> percent 0-100; scale 1 -> fraction 0-1; PDO sum*0.01 -> index ~1.0 (0-2). Ratio of sums, never mean of ratios; rounded 6 dp; writes: —
  - Status: live — written by /api/v1/db/update-rolling-player-averages, invoked by /api/v1/db/run-rolling-forge-pipeline (web/vercel.json cron '5,10,15,20,30,35,40,45,55 10 * * *' UTC, mode=daily_incremental; lib/rollingForgePipeline.ts:102)
  - Consumers: fetchRollingPlayerAverages deriveOutputs; rollingPlayerValidationPayload recompute
- **Audit context:**
  - Intent (Opus): Ratio families always computed from aggregated raw components, never averaged per-entry ratios (web/lib/supabase/Upserts/rollingMetricAggregation.ts:140); missing numerator is a missing observation not a zero (rollingMetricAggregation.ts:118); window contracts in rollingWindowContract.ts:35
  - External references: Ratio-of-sums convention (NST/Evolving-Hockey aggregate rates as sum(events)/sum(TOI)); last-N-games windows
  - Fixtures/test data: `web/lib/supabase/Upserts/fixtures/rollingColumnInventory.json`; `tasks/artifacts/forge-projection-audit-2026-10-21/rolling-column-inventory.json`; `tasks/artifacts/rolling-validation-5v5-recheck-2026-10-28/ (RESULTS.json, snapshot/)`
  - Tests: `web/lib/supabase/Upserts/fetchRollingPlayerAverages.test.ts`; `web/lib/supabase/Upserts/rollingMetricAggregation.test.ts`; `web/lib/supabase/Upserts/rollingMetricWindowContractCases.test.ts`
- **Leads (not audited):**
  - (opus) rolling windows are anchor-gated but historical season/3YA/career buckets are not, so split-strength _season can include zero-TOI games' components that the _lastN windows skip
  - (opus) '_all' is computed from the rolling accumulator totals over every row read (full player history, since buildPlayerHistoryReadOptions drops season/startDate) so it is effectively career-to-date, not season-to-date, and is anchor-gated unlike _career
  - (opus) 3YA includes the current partial season plus the two prior seasons, so early-season 3YA is mostly prior-season data
  - (opus) appearance-mode windows keep slots for games with missing NST components, so an L5 on-ice ratio can rest on fewer than 5 games of real data without any count exposed on the value itself

## M-ROLL-045 Rolling window contracts and metric-to-family map

- **Match:** Opus only; Opus ROLL-045; Codex —
- **Purpose:** Declares what 'last N' means and which aggregation each metric family uses.
- **Where:** `web/lib/supabase/Upserts/rollingWindowContract.ts:35 (CANONICAL_ROLLING_WINDOW_CONTRACTS)`; `web/lib/supabase/Upserts/rollingWindowContract.ts:127 (ROLLING_METRIC_WINDOW_FAMILIES)`; `web/lib/predictions/rollingWindows.ts:1 (CANONICAL_ROLLING_GAME_WINDOWS)`
- **Tags (heuristic):** denominators: per 60, per team game; generation: current
- **Opus view (ROLL-045):**
  - Method: Four families: availability (current team's last N chronological team games), additive_performance (sum and mean over the player's last N appearances with a defined value), ratio_performance (ratio of aggregated components over last N appearances in the strength state), weighted_rate_performance (sum events / sum TOI over last N appearances). Windows fixed at 3, 5, 10, 20. Mapping: per-60s -> weighted_rate; shooting_pct, primary_points_pct, expected_sh_pct, ipp, oz_start_pct, pp_share_pct, on_ice_sh_pct, pdo, cf_pct, ff_pct -> ratio; counts, ixg, iscf, ihdcf, toi_seconds, pp_toi_seconds -> additive.
  - Inputs/units: metric key; windows in games (3/5/10/20); sources: —
  - Output scale: categorical family label; writes: —
  - Status: live — imported by rollingMetricAggregation.ts and fetchRollingPlayerAverages.ts on the cron path; ROLLING_METRIC_WINDOW_FAMILIES also read by rollingPlayerValidationPayload.ts
  - Consumers: rollingMetricAggregation; rollingPlayerValidationPayload (inferWindowFamily)
- **Audit context:**
  - Intent (Opus): contractSummary strings in web/lib/supabase/Upserts/rollingWindowContract.ts:48-85 (e.g. 'Last N means the player's last N chronological appearances in the relevant strength state')
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/supabase/Upserts/rollingMetricWindowContractCases.test.ts`; `web/lib/supabase/Upserts/rollingWindowContract.test.ts`
- **Leads (not audited):**
  - (opus) ROLLING_METRIC_WINDOW_FAMILIES omits metrics the writer emits (goals_per_60, assists_per_60, primary/secondary_assists_per_60, shot_attempts_per_60, on_ice_sv_pct, oi_* and zone-start counts), so validation inferWindowFamily returns null for them
  - (opus) additive metrics use 'valid observation' windows (a slot only when a value exists) while ratio metrics use appearance windows, so two columns on the same row with suffix _last5 can cover different games

## M-ROLL-046 assists

- **Match:** Codex only; Opus —; Codex rolling-assists
- **Purpose:** Summarize player performance at strength and selected rolling/historical scope.
- **Where:** `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:1633 METRICS[assists]; web/lib/supabase/Upserts/rollingMetricAggregation.ts:136 computeRatioValue; web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:2828 deriveOutputs. Sums of observed values; legacy *_avg_* fields divide sum by observed count. Season/3YA/career averages use HistoricalAverageAccumulator.`
- **Tags (heuristic):** generation: current
- **Codex view (rolling-assists, calculation; Codex family 'Rolling player metrics'):** assists
  - Purpose: Summarize player performance at strength and selected rolling/historical scope.
  - Inputs/units: assists counts (expected-goal quantity for ixG fields)
  - Output scale: Totals in counts (expected-goal quantity for ixG fields); averages in counts (expected-goal quantity for ixG fields) per observed entry. Scopes all, last3/5/10/20, season, 3YA, career; ratio values rounded to 6 decimals.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
  - Consumers: web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts writes rolling_player_game_metrics and durable support payloads; consumed by rankings/FORGE and player statistics readers.
- **Audit context:**
  - Intended contract (Codex rolling-assists): web/lib/supabase/Upserts/rollingWindowContract.ts; web/lib/supabase/Upserts/rollingMetricSourceUnitContract.ts:18; web/lib/supabase/Upserts/rollingMetricScaleContract.ts:27. Explicit contract: ratios use aggregated raw components, not averaged per-game rates; appearance windows govern ratio/rate performance.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `{"discovered_not_run": ["web/lib/supabase/Upserts/fetchRollingPlayerAverages.test.ts", "web/lib/supabase/Upserts/rollingMetricAggregation.test.ts", "web/lib/supabase/Upserts/rollingMetricScaleContract.test.ts", "web/lib/supabase/Upserts/rollingMetricSourceUnitContract.test.ts", "web/lib/supabase/Upserts/rollingMetricWindowContractCases.test.ts"]}`
- **Leads (not audited):**
  - (codex:rolling-assists) Exact deployed columns and reader variants not verified. Source snippets are local contracts, not evidence of applied remediation.

## M-ROLL-047 blocks

- **Match:** Codex only; Opus —; Codex rolling-blocks
- **Purpose:** Summarize player performance at strength and selected rolling/historical scope.
- **Where:** `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:1651 METRICS[blocks]; web/lib/supabase/Upserts/rollingMetricAggregation.ts:136 computeRatioValue; web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:2828 deriveOutputs. Sums of observed values; legacy *_avg_* fields divide sum by observed count. Season/3YA/career averages use HistoricalAverageAccumulator.`
- **Tags (heuristic):** generation: current
- **Codex view (rolling-blocks, calculation; Codex family 'Rolling player metrics'):** blocks
  - Purpose: Summarize player performance at strength and selected rolling/historical scope.
  - Inputs/units: blocks counts (expected-goal quantity for ixG fields)
  - Output scale: Totals in counts (expected-goal quantity for ixG fields); averages in counts (expected-goal quantity for ixG fields) per observed entry. Scopes all, last3/5/10/20, season, 3YA, career; ratio values rounded to 6 decimals.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
  - Consumers: web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts writes rolling_player_game_metrics and durable support payloads; consumed by rankings/FORGE and player statistics readers.
- **Audit context:**
  - Intended contract (Codex rolling-blocks): web/lib/supabase/Upserts/rollingWindowContract.ts; web/lib/supabase/Upserts/rollingMetricSourceUnitContract.ts:18; web/lib/supabase/Upserts/rollingMetricScaleContract.ts:27. Explicit contract: ratios use aggregated raw components, not averaged per-game rates; appearance windows govern ratio/rate performance.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `{"discovered_not_run": ["web/lib/supabase/Upserts/fetchRollingPlayerAverages.test.ts", "web/lib/supabase/Upserts/rollingMetricAggregation.test.ts", "web/lib/supabase/Upserts/rollingMetricScaleContract.test.ts", "web/lib/supabase/Upserts/rollingMetricSourceUnitContract.test.ts", "web/lib/supabase/Upserts/rollingMetricWindowContractCases.test.ts"]}`
- **Leads (not audited):**
  - (codex:rolling-blocks) Exact deployed columns and reader variants not verified. Source snippets are local contracts, not evidence of applied remediation.

## M-ROLL-048 cf

- **Match:** Codex only; Opus —; Codex rolling-cf
- **Purpose:** Summarize player performance at strength and selected rolling/historical scope.
- **Where:** `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:1577 METRICS[cf]; web/lib/supabase/Upserts/rollingMetricAggregation.ts:136 computeRatioValue; web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:2828 deriveOutputs. Sums of observed values; legacy *_avg_* fields divide sum by observed count. Season/3YA/career averages use HistoricalAverageAccumulator.`
- **Tags (heuristic):** generation: current
- **Codex view (rolling-cf, calculation; Codex family 'Rolling player metrics'):** cf
  - Purpose: Summarize player performance at strength and selected rolling/historical scope.
  - Inputs/units: cf counts (expected-goal quantity for ixG fields)
  - Output scale: Totals in counts (expected-goal quantity for ixG fields); averages in counts (expected-goal quantity for ixG fields) per observed entry. Scopes all, last3/5/10/20, season, 3YA, career; ratio values rounded to 6 decimals.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
  - Consumers: web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts writes rolling_player_game_metrics and durable support payloads; consumed by rankings/FORGE and player statistics readers.
- **Audit context:**
  - Intended contract (Codex rolling-cf): web/lib/supabase/Upserts/rollingWindowContract.ts; web/lib/supabase/Upserts/rollingMetricSourceUnitContract.ts:18; web/lib/supabase/Upserts/rollingMetricScaleContract.ts:27. Explicit contract: ratios use aggregated raw components, not averaged per-game rates; appearance windows govern ratio/rate performance.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `{"discovered_not_run": ["web/lib/supabase/Upserts/fetchRollingPlayerAverages.test.ts", "web/lib/supabase/Upserts/rollingMetricAggregation.test.ts", "web/lib/supabase/Upserts/rollingMetricScaleContract.test.ts", "web/lib/supabase/Upserts/rollingMetricSourceUnitContract.test.ts", "web/lib/supabase/Upserts/rollingMetricWindowContractCases.test.ts"]}`
- **Leads (not audited):**
  - (codex:rolling-cf) Exact deployed columns and reader variants not verified. Source snippets are local contracts, not evidence of applied remediation.

## M-ROLL-049 dz_starts

- **Match:** Codex only; Opus —; Codex rolling-dz_starts
- **Purpose:** Summarize player performance at strength and selected rolling/historical scope.
- **Where:** `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:1415 METRICS[dz_starts]; web/lib/supabase/Upserts/rollingMetricAggregation.ts:136 computeRatioValue; web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:2828 deriveOutputs. Sums of observed values; legacy *_avg_* fields divide sum by observed count. Season/3YA/career averages use HistoricalAverageAccumulator.`
- **Tags (heuristic):** generation: current
- **Codex view (rolling-dz_starts, calculation; Codex family 'Rolling player metrics'):** dz_starts
  - Purpose: Summarize player performance at strength and selected rolling/historical scope.
  - Inputs/units: dz_starts counts (expected-goal quantity for ixG fields)
  - Output scale: Totals in counts (expected-goal quantity for ixG fields); averages in counts (expected-goal quantity for ixG fields) per observed entry. Scopes all, last3/5/10/20, season, 3YA, career; ratio values rounded to 6 decimals.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
  - Consumers: web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts writes rolling_player_game_metrics and durable support payloads; consumed by rankings/FORGE and player statistics readers.
- **Audit context:**
  - Intended contract (Codex rolling-dz_starts): web/lib/supabase/Upserts/rollingWindowContract.ts; web/lib/supabase/Upserts/rollingMetricSourceUnitContract.ts:18; web/lib/supabase/Upserts/rollingMetricScaleContract.ts:27. Explicit contract: ratios use aggregated raw components, not averaged per-game rates; appearance windows govern ratio/rate performance.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `{"discovered_not_run": ["web/lib/supabase/Upserts/fetchRollingPlayerAverages.test.ts", "web/lib/supabase/Upserts/rollingMetricAggregation.test.ts", "web/lib/supabase/Upserts/rollingMetricScaleContract.test.ts", "web/lib/supabase/Upserts/rollingMetricSourceUnitContract.test.ts", "web/lib/supabase/Upserts/rollingMetricWindowContractCases.test.ts"]}`
- **Leads (not audited):**
  - (codex:rolling-dz_starts) Exact deployed columns and reader variants not verified. Source snippets are local contracts, not evidence of applied remediation.

## M-ROLL-050 ff

- **Match:** Codex only; Opus —; Codex rolling-ff
- **Purpose:** Summarize player performance at strength and selected rolling/historical scope.
- **Where:** `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:1602 METRICS[ff]; web/lib/supabase/Upserts/rollingMetricAggregation.ts:136 computeRatioValue; web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:2828 deriveOutputs. Sums of observed values; legacy *_avg_* fields divide sum by observed count. Season/3YA/career averages use HistoricalAverageAccumulator.`
- **Tags (heuristic):** generation: current
- **Codex view (rolling-ff, calculation; Codex family 'Rolling player metrics'):** ff
  - Purpose: Summarize player performance at strength and selected rolling/historical scope.
  - Inputs/units: ff counts (expected-goal quantity for ixG fields)
  - Output scale: Totals in counts (expected-goal quantity for ixG fields); averages in counts (expected-goal quantity for ixG fields) per observed entry. Scopes all, last3/5/10/20, season, 3YA, career; ratio values rounded to 6 decimals.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
  - Consumers: web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts writes rolling_player_game_metrics and durable support payloads; consumed by rankings/FORGE and player statistics readers.
- **Audit context:**
  - Intended contract (Codex rolling-ff): web/lib/supabase/Upserts/rollingWindowContract.ts; web/lib/supabase/Upserts/rollingMetricSourceUnitContract.ts:18; web/lib/supabase/Upserts/rollingMetricScaleContract.ts:27. Explicit contract: ratios use aggregated raw components, not averaged per-game rates; appearance windows govern ratio/rate performance.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `{"discovered_not_run": ["web/lib/supabase/Upserts/fetchRollingPlayerAverages.test.ts", "web/lib/supabase/Upserts/rollingMetricAggregation.test.ts", "web/lib/supabase/Upserts/rollingMetricScaleContract.test.ts", "web/lib/supabase/Upserts/rollingMetricSourceUnitContract.test.ts", "web/lib/supabase/Upserts/rollingMetricWindowContractCases.test.ts"]}`
- **Leads (not audited):**
  - (codex:rolling-ff) Exact deployed columns and reader variants not verified. Source snippets are local contracts, not evidence of applied remediation.

## M-ROLL-051 goals

- **Match:** Codex only; Opus —; Codex rolling-goals
- **Purpose:** Summarize player performance at strength and selected rolling/historical scope.
- **Where:** `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:1627 METRICS[goals]; web/lib/supabase/Upserts/rollingMetricAggregation.ts:136 computeRatioValue; web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:2828 deriveOutputs. Sums of observed values; legacy *_avg_* fields divide sum by observed count. Season/3YA/career averages use HistoricalAverageAccumulator.`
- **Tags (heuristic):** generation: current
- **Codex view (rolling-goals, calculation; Codex family 'Rolling player metrics'):** goals
  - Purpose: Summarize player performance at strength and selected rolling/historical scope.
  - Inputs/units: goals counts (expected-goal quantity for ixG fields)
  - Output scale: Totals in counts (expected-goal quantity for ixG fields); averages in counts (expected-goal quantity for ixG fields) per observed entry. Scopes all, last3/5/10/20, season, 3YA, career; ratio values rounded to 6 decimals.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
  - Consumers: web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts writes rolling_player_game_metrics and durable support payloads; consumed by rankings/FORGE and player statistics readers.
- **Audit context:**
  - Intended contract (Codex rolling-goals): web/lib/supabase/Upserts/rollingWindowContract.ts; web/lib/supabase/Upserts/rollingMetricSourceUnitContract.ts:18; web/lib/supabase/Upserts/rollingMetricScaleContract.ts:27. Explicit contract: ratios use aggregated raw components, not averaged per-game rates; appearance windows govern ratio/rate performance.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `{"discovered_not_run": ["web/lib/supabase/Upserts/fetchRollingPlayerAverages.test.ts", "web/lib/supabase/Upserts/rollingMetricAggregation.test.ts", "web/lib/supabase/Upserts/rollingMetricScaleContract.test.ts", "web/lib/supabase/Upserts/rollingMetricSourceUnitContract.test.ts", "web/lib/supabase/Upserts/rollingMetricWindowContractCases.test.ts"]}`
- **Leads (not audited):**
  - (codex:rolling-goals) Exact deployed columns and reader variants not verified. Source snippets are local contracts, not evidence of applied remediation.

## M-ROLL-052 hits

- **Match:** Codex only; Opus —; Codex rolling-hits
- **Purpose:** Summarize player performance at strength and selected rolling/historical scope.
- **Where:** `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:1645 METRICS[hits]; web/lib/supabase/Upserts/rollingMetricAggregation.ts:136 computeRatioValue; web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:2828 deriveOutputs. Sums of observed values; legacy *_avg_* fields divide sum by observed count. Season/3YA/career averages use HistoricalAverageAccumulator.`
- **Tags (heuristic):** generation: current
- **Codex view (rolling-hits, calculation; Codex family 'Rolling player metrics'):** hits
  - Purpose: Summarize player performance at strength and selected rolling/historical scope.
  - Inputs/units: hits counts (expected-goal quantity for ixG fields)
  - Output scale: Totals in counts (expected-goal quantity for ixG fields); averages in counts (expected-goal quantity for ixG fields) per observed entry. Scopes all, last3/5/10/20, season, 3YA, career; ratio values rounded to 6 decimals.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
  - Consumers: web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts writes rolling_player_game_metrics and durable support payloads; consumed by rankings/FORGE and player statistics readers.
- **Audit context:**
  - Intended contract (Codex rolling-hits): web/lib/supabase/Upserts/rollingWindowContract.ts; web/lib/supabase/Upserts/rollingMetricSourceUnitContract.ts:18; web/lib/supabase/Upserts/rollingMetricScaleContract.ts:27. Explicit contract: ratios use aggregated raw components, not averaged per-game rates; appearance windows govern ratio/rate performance.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `{"discovered_not_run": ["web/lib/supabase/Upserts/fetchRollingPlayerAverages.test.ts", "web/lib/supabase/Upserts/rollingMetricAggregation.test.ts", "web/lib/supabase/Upserts/rollingMetricScaleContract.test.ts", "web/lib/supabase/Upserts/rollingMetricSourceUnitContract.test.ts", "web/lib/supabase/Upserts/rollingMetricWindowContractCases.test.ts"]}`
- **Leads (not audited):**
  - (codex:rolling-hits) Exact deployed columns and reader variants not verified. Source snippets are local contracts, not evidence of applied remediation.

## M-ROLL-053 ihdcf

- **Match:** Codex only; Opus —; Codex rolling-ihdcf
- **Purpose:** Summarize player performance at strength and selected rolling/historical scope.
- **Where:** `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:1403 METRICS[ihdcf]; web/lib/supabase/Upserts/rollingMetricAggregation.ts:136 computeRatioValue; web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:2828 deriveOutputs. Sums of observed values; legacy *_avg_* fields divide sum by observed count. Season/3YA/career averages use HistoricalAverageAccumulator.`
- **Tags (heuristic):** generation: current
- **Codex view (rolling-ihdcf, calculation; Codex family 'Rolling player metrics'):** ihdcf
  - Purpose: Summarize player performance at strength and selected rolling/historical scope.
  - Inputs/units: ihdcf counts (expected-goal quantity for ixG fields)
  - Output scale: Totals in counts (expected-goal quantity for ixG fields); averages in counts (expected-goal quantity for ixG fields) per observed entry. Scopes all, last3/5/10/20, season, 3YA, career; ratio values rounded to 6 decimals.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
  - Consumers: web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts writes rolling_player_game_metrics and durable support payloads; consumed by rankings/FORGE and player statistics readers.
- **Audit context:**
  - Intended contract (Codex rolling-ihdcf): web/lib/supabase/Upserts/rollingWindowContract.ts; web/lib/supabase/Upserts/rollingMetricSourceUnitContract.ts:18; web/lib/supabase/Upserts/rollingMetricScaleContract.ts:27. Explicit contract: ratios use aggregated raw components, not averaged per-game rates; appearance windows govern ratio/rate performance.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `{"discovered_not_run": ["web/lib/supabase/Upserts/fetchRollingPlayerAverages.test.ts", "web/lib/supabase/Upserts/rollingMetricAggregation.test.ts", "web/lib/supabase/Upserts/rollingMetricScaleContract.test.ts", "web/lib/supabase/Upserts/rollingMetricSourceUnitContract.test.ts", "web/lib/supabase/Upserts/rollingMetricWindowContractCases.test.ts"]}`
- **Leads (not audited):**
  - (codex:rolling-ihdcf) Exact deployed columns and reader variants not verified. Source snippets are local contracts, not evidence of applied remediation.

## M-ROLL-054 iscf

- **Match:** Codex only; Opus —; Codex rolling-iscf
- **Purpose:** Summarize player performance at strength and selected rolling/historical scope.
- **Where:** `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:1397 METRICS[iscf]; web/lib/supabase/Upserts/rollingMetricAggregation.ts:136 computeRatioValue; web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:2828 deriveOutputs. Sums of observed values; legacy *_avg_* fields divide sum by observed count. Season/3YA/career averages use HistoricalAverageAccumulator.`
- **Tags (heuristic):** generation: current
- **Codex view (rolling-iscf, calculation; Codex family 'Rolling player metrics'):** iscf
  - Purpose: Summarize player performance at strength and selected rolling/historical scope.
  - Inputs/units: iscf counts (expected-goal quantity for ixG fields)
  - Output scale: Totals in counts (expected-goal quantity for ixG fields); averages in counts (expected-goal quantity for ixG fields) per observed entry. Scopes all, last3/5/10/20, season, 3YA, career; ratio values rounded to 6 decimals.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
  - Consumers: web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts writes rolling_player_game_metrics and durable support payloads; consumed by rankings/FORGE and player statistics readers.
- **Audit context:**
  - Intended contract (Codex rolling-iscf): web/lib/supabase/Upserts/rollingWindowContract.ts; web/lib/supabase/Upserts/rollingMetricSourceUnitContract.ts:18; web/lib/supabase/Upserts/rollingMetricScaleContract.ts:27. Explicit contract: ratios use aggregated raw components, not averaged per-game rates; appearance windows govern ratio/rate performance.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `{"discovered_not_run": ["web/lib/supabase/Upserts/fetchRollingPlayerAverages.test.ts", "web/lib/supabase/Upserts/rollingMetricAggregation.test.ts", "web/lib/supabase/Upserts/rollingMetricScaleContract.test.ts", "web/lib/supabase/Upserts/rollingMetricSourceUnitContract.test.ts", "web/lib/supabase/Upserts/rollingMetricWindowContractCases.test.ts"]}`
- **Leads (not audited):**
  - (codex:rolling-iscf) Exact deployed columns and reader variants not verified. Source snippets are local contracts, not evidence of applied remediation.

## M-ROLL-055 ixg

- **Match:** Codex only; Opus —; Codex rolling-ixg
- **Purpose:** Summarize player performance at strength and selected rolling/historical scope.
- **Where:** `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:1330 METRICS[ixg]; web/lib/supabase/Upserts/rollingMetricAggregation.ts:136 computeRatioValue; web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:2828 deriveOutputs. Sums of observed values; legacy *_avg_* fields divide sum by observed count. Season/3YA/career averages use HistoricalAverageAccumulator.`
- **Tags (heuristic):** generation: current
- **Codex view (rolling-ixg, calculation; Codex family 'Rolling player metrics'):** ixg
  - Purpose: Summarize player performance at strength and selected rolling/historical scope.
  - Inputs/units: ixg counts (expected-goal quantity for ixG fields)
  - Output scale: Totals in counts (expected-goal quantity for ixG fields); averages in counts (expected-goal quantity for ixG fields) per observed entry. Scopes all, last3/5/10/20, season, 3YA, career; ratio values rounded to 6 decimals.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
  - Consumers: web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts writes rolling_player_game_metrics and durable support payloads; consumed by rankings/FORGE and player statistics readers.
- **Audit context:**
  - Intended contract (Codex rolling-ixg): web/lib/supabase/Upserts/rollingWindowContract.ts; web/lib/supabase/Upserts/rollingMetricSourceUnitContract.ts:18; web/lib/supabase/Upserts/rollingMetricScaleContract.ts:27. Explicit contract: ratios use aggregated raw components, not averaged per-game rates; appearance windows govern ratio/rate performance.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `{"discovered_not_run": ["web/lib/supabase/Upserts/fetchRollingPlayerAverages.test.ts", "web/lib/supabase/Upserts/rollingMetricAggregation.test.ts", "web/lib/supabase/Upserts/rollingMetricScaleContract.test.ts", "web/lib/supabase/Upserts/rollingMetricSourceUnitContract.test.ts", "web/lib/supabase/Upserts/rollingMetricWindowContractCases.test.ts"]}`
- **Leads (not audited):**
  - (codex:rolling-ixg) Exact deployed columns and reader variants not verified. Source snippets are local contracts, not evidence of applied remediation.

## M-ROLL-056 nz_starts

- **Match:** Codex only; Opus —; Codex rolling-nz_starts
- **Purpose:** Summarize player performance at strength and selected rolling/historical scope.
- **Where:** `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:1421 METRICS[nz_starts]; web/lib/supabase/Upserts/rollingMetricAggregation.ts:136 computeRatioValue; web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:2828 deriveOutputs. Sums of observed values; legacy *_avg_* fields divide sum by observed count. Season/3YA/career averages use HistoricalAverageAccumulator.`
- **Tags (heuristic):** generation: current
- **Codex view (rolling-nz_starts, calculation; Codex family 'Rolling player metrics'):** nz_starts
  - Purpose: Summarize player performance at strength and selected rolling/historical scope.
  - Inputs/units: nz_starts counts (expected-goal quantity for ixG fields)
  - Output scale: Totals in counts (expected-goal quantity for ixG fields); averages in counts (expected-goal quantity for ixG fields) per observed entry. Scopes all, last3/5/10/20, season, 3YA, career; ratio values rounded to 6 decimals.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
  - Consumers: web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts writes rolling_player_game_metrics and durable support payloads; consumed by rankings/FORGE and player statistics readers.
- **Audit context:**
  - Intended contract (Codex rolling-nz_starts): web/lib/supabase/Upserts/rollingWindowContract.ts; web/lib/supabase/Upserts/rollingMetricSourceUnitContract.ts:18; web/lib/supabase/Upserts/rollingMetricScaleContract.ts:27. Explicit contract: ratios use aggregated raw components, not averaged per-game rates; appearance windows govern ratio/rate performance.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `{"discovered_not_run": ["web/lib/supabase/Upserts/fetchRollingPlayerAverages.test.ts", "web/lib/supabase/Upserts/rollingMetricAggregation.test.ts", "web/lib/supabase/Upserts/rollingMetricScaleContract.test.ts", "web/lib/supabase/Upserts/rollingMetricSourceUnitContract.test.ts", "web/lib/supabase/Upserts/rollingMetricWindowContractCases.test.ts"]}`
- **Leads (not audited):**
  - (codex:rolling-nz_starts) Exact deployed columns and reader variants not verified. Source snippets are local contracts, not evidence of applied remediation.

## M-ROLL-057 oi_ga

- **Match:** Codex only; Opus —; Codex rolling-oi_ga
- **Purpose:** Summarize player performance at strength and selected rolling/historical scope.
- **Where:** `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:1433 METRICS[oi_ga]; web/lib/supabase/Upserts/rollingMetricAggregation.ts:136 computeRatioValue; web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:2828 deriveOutputs. Sums of observed values; legacy *_avg_* fields divide sum by observed count. Season/3YA/career averages use HistoricalAverageAccumulator.`
- **Tags (heuristic):** generation: current
- **Codex view (rolling-oi_ga, calculation; Codex family 'Rolling player metrics'):** oi_ga
  - Purpose: Summarize player performance at strength and selected rolling/historical scope.
  - Inputs/units: oi_ga counts (expected-goal quantity for ixG fields)
  - Output scale: Totals in counts (expected-goal quantity for ixG fields); averages in counts (expected-goal quantity for ixG fields) per observed entry. Scopes all, last3/5/10/20, season, 3YA, career; ratio values rounded to 6 decimals.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
  - Consumers: web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts writes rolling_player_game_metrics and durable support payloads; consumed by rankings/FORGE and player statistics readers.
- **Audit context:**
  - Intended contract (Codex rolling-oi_ga): web/lib/supabase/Upserts/rollingWindowContract.ts; web/lib/supabase/Upserts/rollingMetricSourceUnitContract.ts:18; web/lib/supabase/Upserts/rollingMetricScaleContract.ts:27. Explicit contract: ratios use aggregated raw components, not averaged per-game rates; appearance windows govern ratio/rate performance.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `{"discovered_not_run": ["web/lib/supabase/Upserts/fetchRollingPlayerAverages.test.ts", "web/lib/supabase/Upserts/rollingMetricAggregation.test.ts", "web/lib/supabase/Upserts/rollingMetricScaleContract.test.ts", "web/lib/supabase/Upserts/rollingMetricSourceUnitContract.test.ts", "web/lib/supabase/Upserts/rollingMetricWindowContractCases.test.ts"]}`
- **Leads (not audited):**
  - (codex:rolling-oi_ga) Exact deployed columns and reader variants not verified. Source snippets are local contracts, not evidence of applied remediation.

## M-ROLL-058 oi_gf

- **Match:** Codex only; Opus —; Codex rolling-oi_gf
- **Purpose:** Summarize player performance at strength and selected rolling/historical scope.
- **Where:** `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:1427 METRICS[oi_gf]; web/lib/supabase/Upserts/rollingMetricAggregation.ts:136 computeRatioValue; web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:2828 deriveOutputs. Sums of observed values; legacy *_avg_* fields divide sum by observed count. Season/3YA/career averages use HistoricalAverageAccumulator.`
- **Tags (heuristic):** generation: current
- **Codex view (rolling-oi_gf, calculation; Codex family 'Rolling player metrics'):** oi_gf
  - Purpose: Summarize player performance at strength and selected rolling/historical scope.
  - Inputs/units: oi_gf counts (expected-goal quantity for ixG fields)
  - Output scale: Totals in counts (expected-goal quantity for ixG fields); averages in counts (expected-goal quantity for ixG fields) per observed entry. Scopes all, last3/5/10/20, season, 3YA, career; ratio values rounded to 6 decimals.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
  - Consumers: web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts writes rolling_player_game_metrics and durable support payloads; consumed by rankings/FORGE and player statistics readers.
- **Audit context:**
  - Intended contract (Codex rolling-oi_gf): web/lib/supabase/Upserts/rollingWindowContract.ts; web/lib/supabase/Upserts/rollingMetricSourceUnitContract.ts:18; web/lib/supabase/Upserts/rollingMetricScaleContract.ts:27. Explicit contract: ratios use aggregated raw components, not averaged per-game rates; appearance windows govern ratio/rate performance.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `{"discovered_not_run": ["web/lib/supabase/Upserts/fetchRollingPlayerAverages.test.ts", "web/lib/supabase/Upserts/rollingMetricAggregation.test.ts", "web/lib/supabase/Upserts/rollingMetricScaleContract.test.ts", "web/lib/supabase/Upserts/rollingMetricSourceUnitContract.test.ts", "web/lib/supabase/Upserts/rollingMetricWindowContractCases.test.ts"]}`
- **Leads (not audited):**
  - (codex:rolling-oi_gf) Exact deployed columns and reader variants not verified. Source snippets are local contracts, not evidence of applied remediation.

## M-ROLL-059 oi_sa

- **Match:** Codex only; Opus —; Codex rolling-oi_sa
- **Purpose:** Summarize player performance at strength and selected rolling/historical scope.
- **Where:** `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:1457 METRICS[oi_sa]; web/lib/supabase/Upserts/rollingMetricAggregation.ts:136 computeRatioValue; web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:2828 deriveOutputs. Sums of observed values; legacy *_avg_* fields divide sum by observed count. Season/3YA/career averages use HistoricalAverageAccumulator.`
- **Tags (heuristic):** generation: current
- **Codex view (rolling-oi_sa, calculation; Codex family 'Rolling player metrics'):** oi_sa
  - Purpose: Summarize player performance at strength and selected rolling/historical scope.
  - Inputs/units: oi_sa counts (expected-goal quantity for ixG fields)
  - Output scale: Totals in counts (expected-goal quantity for ixG fields); averages in counts (expected-goal quantity for ixG fields) per observed entry. Scopes all, last3/5/10/20, season, 3YA, career; ratio values rounded to 6 decimals.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
  - Consumers: web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts writes rolling_player_game_metrics and durable support payloads; consumed by rankings/FORGE and player statistics readers.
- **Audit context:**
  - Intended contract (Codex rolling-oi_sa): web/lib/supabase/Upserts/rollingWindowContract.ts; web/lib/supabase/Upserts/rollingMetricSourceUnitContract.ts:18; web/lib/supabase/Upserts/rollingMetricScaleContract.ts:27. Explicit contract: ratios use aggregated raw components, not averaged per-game rates; appearance windows govern ratio/rate performance.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `{"discovered_not_run": ["web/lib/supabase/Upserts/fetchRollingPlayerAverages.test.ts", "web/lib/supabase/Upserts/rollingMetricAggregation.test.ts", "web/lib/supabase/Upserts/rollingMetricScaleContract.test.ts", "web/lib/supabase/Upserts/rollingMetricSourceUnitContract.test.ts", "web/lib/supabase/Upserts/rollingMetricWindowContractCases.test.ts"]}`
- **Leads (not audited):**
  - (codex:rolling-oi_sa) Exact deployed columns and reader variants not verified. Source snippets are local contracts, not evidence of applied remediation.

## M-ROLL-060 oi_sf

- **Match:** Codex only; Opus —; Codex rolling-oi_sf
- **Purpose:** Summarize player performance at strength and selected rolling/historical scope.
- **Where:** `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:1451 METRICS[oi_sf]; web/lib/supabase/Upserts/rollingMetricAggregation.ts:136 computeRatioValue; web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:2828 deriveOutputs. Sums of observed values; legacy *_avg_* fields divide sum by observed count. Season/3YA/career averages use HistoricalAverageAccumulator.`
- **Tags (heuristic):** generation: current
- **Codex view (rolling-oi_sf, calculation; Codex family 'Rolling player metrics'):** oi_sf
  - Purpose: Summarize player performance at strength and selected rolling/historical scope.
  - Inputs/units: oi_sf counts (expected-goal quantity for ixG fields)
  - Output scale: Totals in counts (expected-goal quantity for ixG fields); averages in counts (expected-goal quantity for ixG fields) per observed entry. Scopes all, last3/5/10/20, season, 3YA, career; ratio values rounded to 6 decimals.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
  - Consumers: web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts writes rolling_player_game_metrics and durable support payloads; consumed by rankings/FORGE and player statistics readers.
- **Audit context:**
  - Intended contract (Codex rolling-oi_sf): web/lib/supabase/Upserts/rollingWindowContract.ts; web/lib/supabase/Upserts/rollingMetricSourceUnitContract.ts:18; web/lib/supabase/Upserts/rollingMetricScaleContract.ts:27. Explicit contract: ratios use aggregated raw components, not averaged per-game rates; appearance windows govern ratio/rate performance.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `{"discovered_not_run": ["web/lib/supabase/Upserts/fetchRollingPlayerAverages.test.ts", "web/lib/supabase/Upserts/rollingMetricAggregation.test.ts", "web/lib/supabase/Upserts/rollingMetricScaleContract.test.ts", "web/lib/supabase/Upserts/rollingMetricSourceUnitContract.test.ts", "web/lib/supabase/Upserts/rollingMetricWindowContractCases.test.ts"]}`
- **Leads (not audited):**
  - (codex:rolling-oi_sf) Exact deployed columns and reader variants not verified. Source snippets are local contracts, not evidence of applied remediation.

