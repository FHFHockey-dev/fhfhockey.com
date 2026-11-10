# Audit packet: Sustainability (part 2 of 2)

Master entries M-SUS-061 to M-SUS-075 (15 of 75 in this family). Built from the merged Opus and Codex inventories; see [../MASTER.md](../MASTER.md) and [../MERGE-NOTES.md](../MERGE-NOTES.md).

How to read: each entry gives both inventories' descriptions side by side. **Conflicts** are places where the two descriptions disagree; they are unresolved. **Leads** are Opus red flags and Codex unknowns: observations to check, not audited findings. Tags are keyword heuristics. Line numbers were valid when each inventory was written on 2026-11-10 (Opus at d31dcb33f, Codex at 11e4192d3); re-check against the current checkout.

| ID | Name | Match | Conflicts | Leads |
|---|---|---|---:|---:|
| M-SUS-061 | 50%/80% forecast bands | Codex only | 0 | 1 |
| M-SUS-062 | HDCF% | Codex only | 0 | 1 |
| M-SUS-063 | IPP | Codex only | 0 | 1 |
| M-SUS-064 | SH% | Codex only | 0 | 1 |
| M-SUS-065 | SH% (5v5) | Codex only | 0 | 1 |
| M-SUS-066 | PP SH% | Codex only | 0 | 1 |
| M-SUS-067 | On-Ice SH% | Codex only | 0 | 1 |
| M-SUS-068 | On-Ice SV% | Codex only | 0 | 1 |
| M-SUS-069 | PDO | Codex only | 0 | 1 |
| M-SUS-070 | Points / 60 (5v5) | Codex only | 0 | 1 |
| M-SUS-071 | PP Goals / 60 | Codex only | 0 | 1 |
| M-SUS-072 | PP Points / 60 | Codex only | 0 | 1 |
| M-SUS-073 | Hits / 60 | Codex only | 0 | 1 |
| M-SUS-074 | Blocks / 60 | Codex only | 0 | 1 |
| M-SUS-075 | Fantasy Score | Codex only | 0 | 1 |

## M-SUS-061 50%/80% forecast bands

- **Match:** Codex only; Opus —; Codex core-065
- **Possible related records (low-confidence location link, unconfirmed):** SUS-031
- **Purpose:** Calculate 50%/80% forecast bands.
- **Where:** `web/lib/sustainability/features.ts:848 emitForecastBands`
- **Codex view (core-065, calculation; Codex family 'sustainability features'):** 50%/80% forecast bands
  - Formula: Symmetric normal bands with z=.67448975 and 1.28155157; nonnegative limits.
  - Purpose: Calculate 50%/80% forecast bands.
  - Inputs/units: Mean and variance.
  - Output scale: Count lower/upper intervals.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f; TypeScript sustainability family; canonical runtime per functions/lib/sustainability/README.md. Deployment/data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry…
  - Consumers: ["Other sustainability helpers and rebuild/read API routes; exact runtime activation not established."]
- **Audit context:**
  - Intended contract (Codex core-065): Implementation/type declarations and adjacent comments in web/lib/sustainability/features.ts:848; approval beyond source not established.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/sustainability/features.test.ts`; `Located only; not run for this inventory.`
- **Leads (not audited):**
  - (codex:core-065) ["Inventory only; no correctness or calibration verdict."]

## M-SUS-062 HDCF%

- **Match:** Codex only; Opus —; Codex core-085
- **Possible related records (low-confidence location link, unconfirmed):** SUS-048
- **Purpose:** Named persisted metric hdcf_pct.
- **Where:** `web/lib/sustainability/bands.ts:16 hdcf_pct`; `web/lib/sustainability/bandCalculator.ts:655 computeTrendBandsForPlayer`
- **Tags (heuristic):** denominators: per game
- **Codex view (core-085, calculation; Codex family 'sustainability band metric'):** HDCF%
  - Formula: Uses beta trend-band engine; spec controls halfLifeGames, priorStrength, windows.
  - Purpose: Named persisted metric hdcf_pct.
  - Inputs/units: Metric counts/values and onIceShotsFor exposure; per-game history and season totals.
  - Output scale: Metric-specific mean, EWMA, baseline, CI, n_eff, z/percentile for l3/l5/l10/l20.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f; sustainability_trend_bands_v2. Deployment/data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final status check.
  - Consumers: ["web/lib/sustainability/bandCalculator.ts:computeTrendBandsForPlayer"]
- **Audit context:**
  - Intended contract (Codex core-085): METRIC_SPECS and corresponding collectors in web/lib/sustainability/bandCalculator.ts.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/sustainability/bandCalculator.test.ts`; `Located only; not run for this inventory.`
- **Leads (not audited):**
  - (codex:core-085) ["Inventory only; no correctness or calibration verdict."]

## M-SUS-063 IPP

- **Match:** Codex only; Opus —; Codex core-086
- **Possible related records (low-confidence location link, unconfirmed):** SUS-048
- **Purpose:** Named persisted metric ipp.
- **Where:** `web/lib/sustainability/bands.ts:17 ipp`; `web/lib/sustainability/bandCalculator.ts:655 computeTrendBandsForPlayer`
- **Tags (heuristic):** denominators: per game
- **Codex view (core-086, calculation; Codex family 'sustainability band metric'):** IPP
  - Formula: Uses beta trend-band engine; spec controls halfLifeGames, priorStrength, windows.
  - Purpose: Named persisted metric ipp.
  - Inputs/units: Metric counts/values and onIceGoalsFor exposure; per-game history and season totals.
  - Output scale: Metric-specific mean, EWMA, baseline, CI, n_eff, z/percentile for l3/l5/l10/l20.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f; sustainability_trend_bands_v2. Deployment/data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final status check.
  - Consumers: ["web/lib/sustainability/bandCalculator.ts:computeTrendBandsForPlayer"]
- **Audit context:**
  - Intended contract (Codex core-086): METRIC_SPECS and corresponding collectors in web/lib/sustainability/bandCalculator.ts.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/sustainability/bandCalculator.test.ts`; `Located only; not run for this inventory.`
- **Leads (not audited):**
  - (codex:core-086) ["Inventory only; no correctness or calibration verdict."]

## M-SUS-064 SH%

- **Match:** Codex only; Opus —; Codex core-087
- **Possible related records (low-confidence location link, unconfirmed):** SUS-048
- **Purpose:** Named persisted metric sh_pct.
- **Where:** `web/lib/sustainability/bands.ts:18 sh_pct`; `web/lib/sustainability/bandCalculator.ts:655 computeTrendBandsForPlayer`
- **Tags (heuristic):** denominators: per game
- **Codex view (core-087, calculation; Codex family 'sustainability band metric'):** SH%
  - Formula: Uses beta trend-band engine; spec controls halfLifeGames, priorStrength, windows.
  - Purpose: Named persisted metric sh_pct.
  - Inputs/units: Metric counts/values and shots exposure; per-game history and season totals.
  - Output scale: Metric-specific mean, EWMA, baseline, CI, n_eff, z/percentile for l3/l5/l10/l20.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f; sustainability_trend_bands_v2. Deployment/data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final status check.
  - Consumers: ["web/lib/sustainability/bandCalculator.ts:computeTrendBandsForPlayer"]
- **Audit context:**
  - Intended contract (Codex core-087): METRIC_SPECS and corresponding collectors in web/lib/sustainability/bandCalculator.ts.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/sustainability/bandCalculator.test.ts`; `Located only; not run for this inventory.`
- **Leads (not audited):**
  - (codex:core-087) ["Inventory only; no correctness or calibration verdict."]

## M-SUS-065 SH% (5v5)

- **Match:** Codex only; Opus —; Codex core-088
- **Possible related records (low-confidence location link, unconfirmed):** SUS-048
- **Purpose:** Named persisted metric sh_pct_5v5.
- **Where:** `web/lib/sustainability/bands.ts:19 sh_pct_5v5`; `web/lib/sustainability/bandCalculator.ts:655 computeTrendBandsForPlayer`
- **Tags (heuristic):** denominators: per game
- **Codex view (core-088, calculation; Codex family 'sustainability band metric'):** SH% (5v5)
  - Formula: Uses beta trend-band engine; spec controls halfLifeGames, priorStrength, windows.
  - Purpose: Named persisted metric sh_pct_5v5.
  - Inputs/units: Metric counts/values and shots exposure; per-game history and season totals.
  - Output scale: Metric-specific mean, EWMA, baseline, CI, n_eff, z/percentile for l3/l5/l10/l20.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f; sustainability_trend_bands_v2. Deployment/data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final status check.
  - Consumers: ["web/lib/sustainability/bandCalculator.ts:computeTrendBandsForPlayer"]
- **Audit context:**
  - Intended contract (Codex core-088): METRIC_SPECS and corresponding collectors in web/lib/sustainability/bandCalculator.ts.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/sustainability/bandCalculator.test.ts`; `Located only; not run for this inventory.`
- **Leads (not audited):**
  - (codex:core-088) ["Inventory only; no correctness or calibration verdict."]

## M-SUS-066 PP SH%

- **Match:** Codex only; Opus —; Codex core-089
- **Possible related records (low-confidence location link, unconfirmed):** SUS-048
- **Purpose:** Named persisted metric pp_sh_pct.
- **Where:** `web/lib/sustainability/bands.ts:20 pp_sh_pct`; `web/lib/sustainability/bandCalculator.ts:655 computeTrendBandsForPlayer`
- **Tags (heuristic):** denominators: per game
- **Codex view (core-089, calculation; Codex family 'sustainability band metric'):** PP SH%
  - Formula: Uses beta trend-band engine; spec controls halfLifeGames, priorStrength, windows.
  - Purpose: Named persisted metric pp_sh_pct.
  - Inputs/units: Metric counts/values and shots exposure; per-game history and season totals.
  - Output scale: Metric-specific mean, EWMA, baseline, CI, n_eff, z/percentile for l3/l5/l10/l20.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f; sustainability_trend_bands_v2. Deployment/data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final status check.
  - Consumers: ["web/lib/sustainability/bandCalculator.ts:computeTrendBandsForPlayer"]
- **Audit context:**
  - Intended contract (Codex core-089): METRIC_SPECS and corresponding collectors in web/lib/sustainability/bandCalculator.ts.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/sustainability/bandCalculator.test.ts`; `Located only; not run for this inventory.`
- **Leads (not audited):**
  - (codex:core-089) ["Inventory only; no correctness or calibration verdict."]

## M-SUS-067 On-Ice SH%

- **Match:** Codex only; Opus —; Codex core-090
- **Possible related records (low-confidence location link, unconfirmed):** SUS-048
- **Purpose:** Named persisted metric on_ice_sh_pct.
- **Where:** `web/lib/sustainability/bands.ts:21 on_ice_sh_pct`; `web/lib/sustainability/bandCalculator.ts:655 computeTrendBandsForPlayer`
- **Tags (heuristic):** denominators: per game
- **Codex view (core-090, calculation; Codex family 'sustainability band metric'):** On-Ice SH%
  - Formula: Uses beta trend-band engine; spec controls halfLifeGames, priorStrength, windows.
  - Purpose: Named persisted metric on_ice_sh_pct.
  - Inputs/units: Metric counts/values and onIceShotsFor exposure; per-game history and season totals.
  - Output scale: Metric-specific mean, EWMA, baseline, CI, n_eff, z/percentile for l3/l5/l10/l20.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f; sustainability_trend_bands_v2. Deployment/data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final status check.
  - Consumers: ["web/lib/sustainability/bandCalculator.ts:computeTrendBandsForPlayer"]
- **Audit context:**
  - Intended contract (Codex core-090): METRIC_SPECS and corresponding collectors in web/lib/sustainability/bandCalculator.ts.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/sustainability/bandCalculator.test.ts`; `Located only; not run for this inventory.`
- **Leads (not audited):**
  - (codex:core-090) ["Inventory only; no correctness or calibration verdict."]

## M-SUS-068 On-Ice SV%

- **Match:** Codex only; Opus —; Codex core-091
- **Possible related records (low-confidence location link, unconfirmed):** SUS-048
- **Purpose:** Named persisted metric on_ice_sv_pct.
- **Where:** `web/lib/sustainability/bands.ts:22 on_ice_sv_pct`; `web/lib/sustainability/bandCalculator.ts:655 computeTrendBandsForPlayer`
- **Tags (heuristic):** denominators: per game
- **Codex view (core-091, calculation; Codex family 'sustainability band metric'):** On-Ice SV%
  - Formula: Uses beta trend-band engine; spec controls halfLifeGames, priorStrength, windows.
  - Purpose: Named persisted metric on_ice_sv_pct.
  - Inputs/units: Metric counts/values and onIceShotsAgainst exposure; per-game history and season totals.
  - Output scale: Metric-specific mean, EWMA, baseline, CI, n_eff, z/percentile for l3/l5/l10/l20.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f; sustainability_trend_bands_v2. Deployment/data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final status check.
  - Consumers: ["web/lib/sustainability/bandCalculator.ts:computeTrendBandsForPlayer"]
- **Audit context:**
  - Intended contract (Codex core-091): METRIC_SPECS and corresponding collectors in web/lib/sustainability/bandCalculator.ts.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/sustainability/bandCalculator.test.ts`; `Located only; not run for this inventory.`
- **Leads (not audited):**
  - (codex:core-091) ["Inventory only; no correctness or calibration verdict."]

## M-SUS-069 PDO

- **Match:** Codex only; Opus —; Codex core-092
- **Possible related records (low-confidence location link, unconfirmed):** SUS-048
- **Purpose:** Named persisted metric pdo.
- **Where:** `web/lib/sustainability/bands.ts:23 pdo`; `web/lib/sustainability/bandCalculator.ts:655 computeTrendBandsForPlayer`
- **Tags (heuristic):** denominators: per game
- **Codex view (core-092, calculation; Codex family 'sustainability band metric'):** PDO
  - Formula: Uses normal trend-band engine; spec controls halfLifeGames, priorStrength, windows.
  - Purpose: Named persisted metric pdo.
  - Inputs/units: Metric counts/values and onIceShotsFor exposure; per-game history and season totals.
  - Output scale: Metric-specific mean, EWMA, baseline, CI, n_eff, z/percentile for l3/l5/l10/l20.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f; sustainability_trend_bands_v2. Deployment/data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final status check.
  - Consumers: ["web/lib/sustainability/bandCalculator.ts:computeTrendBandsForPlayer"]
- **Audit context:**
  - Intended contract (Codex core-092): METRIC_SPECS and corresponding collectors in web/lib/sustainability/bandCalculator.ts.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/sustainability/bandCalculator.test.ts`; `Located only; not run for this inventory.`
- **Leads (not audited):**
  - (codex:core-092) ["Inventory only; no correctness or calibration verdict."]

## M-SUS-070 Points / 60 (5v5)

- **Match:** Codex only; Opus —; Codex core-093
- **Possible related records (low-confidence location link, unconfirmed):** SUS-048
- **Purpose:** Named persisted metric points_per_60_5v5.
- **Where:** `web/lib/sustainability/bands.ts:24 points_per_60_5v5`; `web/lib/sustainability/bandCalculator.ts:655 computeTrendBandsForPlayer`
- **Tags (heuristic):** denominators: per game
- **Codex view (core-093, calculation; Codex family 'sustainability band metric'):** Points / 60 (5v5)
  - Formula: Uses gamma trend-band engine; spec controls halfLifeGames, priorStrength, windows.
  - Purpose: Named persisted metric points_per_60_5v5.
  - Inputs/units: Metric counts/values and minutes exposure; per-game history and season totals.
  - Output scale: Metric-specific mean, EWMA, baseline, CI, n_eff, z/percentile for l3/l5/l10/l20.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f; sustainability_trend_bands_v2. Deployment/data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final status check.
  - Consumers: ["web/lib/sustainability/bandCalculator.ts:computeTrendBandsForPlayer"]
- **Audit context:**
  - Intended contract (Codex core-093): METRIC_SPECS and corresponding collectors in web/lib/sustainability/bandCalculator.ts.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/sustainability/bandCalculator.test.ts`; `Located only; not run for this inventory.`
- **Leads (not audited):**
  - (codex:core-093) ["Inventory only; no correctness or calibration verdict."]

## M-SUS-071 PP Goals / 60

- **Match:** Codex only; Opus —; Codex core-094
- **Possible related records (low-confidence location link, unconfirmed):** SUS-048
- **Purpose:** Named persisted metric pp_goals_per_60.
- **Where:** `web/lib/sustainability/bands.ts:25 pp_goals_per_60`; `web/lib/sustainability/bandCalculator.ts:655 computeTrendBandsForPlayer`
- **Tags (heuristic):** denominators: per game
- **Codex view (core-094, calculation; Codex family 'sustainability band metric'):** PP Goals / 60
  - Formula: Uses gamma trend-band engine; spec controls halfLifeGames, priorStrength, windows.
  - Purpose: Named persisted metric pp_goals_per_60.
  - Inputs/units: Metric counts/values and ppMinutes exposure; per-game history and season totals.
  - Output scale: Metric-specific mean, EWMA, baseline, CI, n_eff, z/percentile for l3/l5/l10/l20.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f; sustainability_trend_bands_v2. Deployment/data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final status check.
  - Consumers: ["web/lib/sustainability/bandCalculator.ts:computeTrendBandsForPlayer"]
- **Audit context:**
  - Intended contract (Codex core-094): METRIC_SPECS and corresponding collectors in web/lib/sustainability/bandCalculator.ts.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/sustainability/bandCalculator.test.ts`; `Located only; not run for this inventory.`
- **Leads (not audited):**
  - (codex:core-094) ["Inventory only; no correctness or calibration verdict."]

## M-SUS-072 PP Points / 60

- **Match:** Codex only; Opus —; Codex core-095
- **Possible related records (low-confidence location link, unconfirmed):** SUS-048
- **Purpose:** Named persisted metric pp_points_per_60.
- **Where:** `web/lib/sustainability/bands.ts:26 pp_points_per_60`; `web/lib/sustainability/bandCalculator.ts:655 computeTrendBandsForPlayer`
- **Tags (heuristic):** denominators: per game
- **Codex view (core-095, calculation; Codex family 'sustainability band metric'):** PP Points / 60
  - Formula: Uses gamma trend-band engine; spec controls halfLifeGames, priorStrength, windows.
  - Purpose: Named persisted metric pp_points_per_60.
  - Inputs/units: Metric counts/values and ppMinutes exposure; per-game history and season totals.
  - Output scale: Metric-specific mean, EWMA, baseline, CI, n_eff, z/percentile for l3/l5/l10/l20.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f; sustainability_trend_bands_v2. Deployment/data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final status check.
  - Consumers: ["web/lib/sustainability/bandCalculator.ts:computeTrendBandsForPlayer"]
- **Audit context:**
  - Intended contract (Codex core-095): METRIC_SPECS and corresponding collectors in web/lib/sustainability/bandCalculator.ts.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/sustainability/bandCalculator.test.ts`; `Located only; not run for this inventory.`
- **Leads (not audited):**
  - (codex:core-095) ["Inventory only; no correctness or calibration verdict."]

## M-SUS-073 Hits / 60

- **Match:** Codex only; Opus —; Codex core-096
- **Possible related records (low-confidence location link, unconfirmed):** SUS-048
- **Purpose:** Named persisted metric hits_per_60.
- **Where:** `web/lib/sustainability/bands.ts:27 hits_per_60`; `web/lib/sustainability/bandCalculator.ts:655 computeTrendBandsForPlayer`
- **Tags (heuristic):** denominators: per game
- **Codex view (core-096, calculation; Codex family 'sustainability band metric'):** Hits / 60
  - Formula: Uses gamma trend-band engine; spec controls halfLifeGames, priorStrength, windows.
  - Purpose: Named persisted metric hits_per_60.
  - Inputs/units: Metric counts/values and minutes exposure; per-game history and season totals.
  - Output scale: Metric-specific mean, EWMA, baseline, CI, n_eff, z/percentile for l3/l5/l10/l20.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f; sustainability_trend_bands_v2. Deployment/data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final status check.
  - Consumers: ["web/lib/sustainability/bandCalculator.ts:computeTrendBandsForPlayer"]
- **Audit context:**
  - Intended contract (Codex core-096): METRIC_SPECS and corresponding collectors in web/lib/sustainability/bandCalculator.ts.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/sustainability/bandCalculator.test.ts`; `Located only; not run for this inventory.`
- **Leads (not audited):**
  - (codex:core-096) ["Inventory only; no correctness or calibration verdict."]

## M-SUS-074 Blocks / 60

- **Match:** Codex only; Opus —; Codex core-097
- **Possible related records (low-confidence location link, unconfirmed):** SUS-048
- **Purpose:** Named persisted metric blocks_per_60.
- **Where:** `web/lib/sustainability/bands.ts:28 blocks_per_60`; `web/lib/sustainability/bandCalculator.ts:655 computeTrendBandsForPlayer`
- **Tags (heuristic):** denominators: per game
- **Codex view (core-097, calculation; Codex family 'sustainability band metric'):** Blocks / 60
  - Formula: Uses gamma trend-band engine; spec controls halfLifeGames, priorStrength, windows.
  - Purpose: Named persisted metric blocks_per_60.
  - Inputs/units: Metric counts/values and minutes exposure; per-game history and season totals.
  - Output scale: Metric-specific mean, EWMA, baseline, CI, n_eff, z/percentile for l3/l5/l10/l20.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f; sustainability_trend_bands_v2. Deployment/data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final status check.
  - Consumers: ["web/lib/sustainability/bandCalculator.ts:computeTrendBandsForPlayer"]
- **Audit context:**
  - Intended contract (Codex core-097): METRIC_SPECS and corresponding collectors in web/lib/sustainability/bandCalculator.ts.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/sustainability/bandCalculator.test.ts`; `Located only; not run for this inventory.`
- **Leads (not audited):**
  - (codex:core-097) ["Inventory only; no correctness or calibration verdict."]

## M-SUS-075 Fantasy Score

- **Match:** Codex only; Opus —; Codex core-098
- **Possible related records (low-confidence location link, unconfirmed):** SUS-048
- **Purpose:** Named persisted metric fantasy_score.
- **Where:** `web/lib/sustainability/bands.ts:29 fantasy_score`; `web/lib/sustainability/bandCalculator.ts:655 computeTrendBandsForPlayer`
- **Tags (heuristic):** denominators: per game
- **Codex view (core-098, calculation; Codex family 'sustainability band metric'):** Fantasy Score
  - Formula: Uses normal trend-band engine; spec controls halfLifeGames, priorStrength, windows.
  - Purpose: Named persisted metric fantasy_score.
  - Inputs/units: Metric counts/values and games exposure; per-game history and season totals.
  - Output scale: Metric-specific mean, EWMA, baseline, CI, n_eff, z/percentile for l3/l5/l10/l20.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f; sustainability_trend_bands_v2. Deployment/data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final status check.
  - Consumers: ["web/lib/sustainability/bandCalculator.ts:computeTrendBandsForPlayer"]
- **Audit context:**
  - Intended contract (Codex core-098): METRIC_SPECS and corresponding collectors in web/lib/sustainability/bandCalculator.ts.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/sustainability/bandCalculator.test.ts`; `Located only; not run for this inventory.`
- **Leads (not audited):**
  - (codex:core-098) ["Inventory only; no correctness or calibration verdict."]

