# Audit packet: FORGE projections (part 2 of 4)

Master entries M-FRG-061 to M-FRG-120 (60 of 186 in this family). Built from the merged Opus and Codex inventories; see [../MASTER.md](../MASTER.md) and [../MERGE-NOTES.md](../MERGE-NOTES.md).

How to read: each entry gives both inventories' descriptions side by side. **Conflicts** are places where the two descriptions disagree; they are unresolved. **Leads** are Opus red flags and Codex unknowns: observations to check, not audited findings. Tags are keyword heuristics. Line numbers were valid when each inventory was written on 2026-11-10 (Opus at d31dcb33f, Codex at 11e4192d3); re-check against the current checkout.

| ID | Name | Match | Conflicts | Leads |
|---|---|---|---:|---:|
| M-FRG-061 | Team PP share and PP TOI allocation | Both | 0 | 4 |
| M-FRG-062 | Team TOI target with undersized-pool guard | Both | 0 | 2 |
| M-FRG-063 | WGO TOI normalization and deployment-prior TOI blend | Both | 0 | 4 |
| M-FRG-064 | Role continuity and stability multiplier | Both | 0 | 4 |
| M-FRG-065 | Count distribution helpers and fitted dispersion | Both | 0 | 5 |
| M-FRG-066 | Player uncertainty Monte Carlo (p10/p50/p90) | Both | 0 | 9 |
| M-FRG-067 | Team uncertainty Monte Carlo | Both | 0 | 3 |
| M-FRG-068 | Goalie uncertainty Monte Carlo | Both | 0 | 3 |
| M-FRG-069 | FORGE count dispersion fit (NB2 method of moments) and holdout scoring | Both | 0 | 4 |
| M-FRG-070 | FORGE v2 evaluation scoring (CRPS, log score, interval score, block b… | Both | 0 | 4 |
| M-FRG-071 | FORGE v2 kernel-means model and participation | Both | 0 | 12 |
| M-FRG-072 | FORGE v2 research baselines (half-life pooled rates) | Both | 0 | 1 |
| M-FRG-073 | FORGE v2 joint distribution and interval calibration | Both | 0 | 4 |
| M-FRG-074 | FORGE dashboard client aggregates (hot/cold, trust/momentum, power tr… | Opus only | 0 | 0 |
| M-FRG-075 | FORGE v2 forecast revision traversal spans | Opus only | 0 | 1 |
| M-FRG-076 | Roster event confidence and TTL from reviewed tweets (+ preflight sta… | Opus only | 0 | 3 |
| M-FRG-077 | FORGE goalie starter metadata: top-2 probability mass and horizon-sca… | Opus only | 0 | 1 |
| M-FRG-078 | FORGE pipeline stage map | Opus only | 0 | 3 |
| M-FRG-079 | FORGE projection miss attribution (skater TOI/shot-rate/conversion; g… | Opus only | 0 | 2 |
| M-FRG-080 | FORGE projection accuracy metrics (MAE/RMSE/accuracy, Brier, interval… | Opus only | 0 | 4 |
| M-FRG-081 | FORGE accuracy role buckets (ES line role and PP unit by projected PP… | Opus only | 0 | 1 |
| M-FRG-082 | FORGE projection run preflight gates | Opus only | 0 | 1 |
| M-FRG-083 | Start-chart projected TOI normalization | Opus only | 0 | 1 |
| M-FRG-084 | Projection source accuracy analysis (client) | Opus only | 0 | 2 |
| M-FRG-085 | Probability calibration and goalie launch gates | Opus only | 0 | 2 |
| M-FRG-086 | Skater fantasy-point miss attribution | Opus only | 0 | 1 |
| M-FRG-087 | FORGE retained ledger validity checks | Opus only | 0 | 1 |
| M-FRG-088 | FORGE v2 issuance: joint-distribution coherence gate and category sup… | Opus only | 0 | 2 |
| M-FRG-089 | FORGE v2 operational health summary and alarms | Opus only | 0 | 2 |
| M-FRG-090 | FORGE v2 qualification gate (serving eligibility of means and partici… | Opus only | 0 | 1 |
| M-FRG-091 | Goalie share, save% and GAA by team window | Opus only | 0 | 0 |
| M-FRG-092 | Goalie starter mixtures | Opus only | 0 | 1 |
| M-FRG-093 | Goalie shots-against projection | Opus only | 0 | 4 |
| M-FRG-094 | FORGE goalies API win-probability normalisation | Opus only | 0 | 1 |
| M-FRG-095 | Game totals and spread market flags | Opus only | 0 | 3 |
| M-FRG-096 | Start chart opponent defence grade and TOI normalisation | Opus only | 0 | 0 |
| M-FRG-097 | Availability multiplier from roster events | Opus only | 0 | 1 |
| M-FRG-098 | Line-combination recency, role tags and fallback ranking | Opus only | 0 | 2 |
| M-FRG-099 | Team-context finite mean | Codex only | 0 | 1 |
| M-FRG-100 | Team and player PP opportunity means | Codex only | 0 | 1 |
| M-FRG-101 | Holdout comparator deltas and improvement | Codex only | 0 | 1 |
| M-FRG-102 | Holdout MAE and RMSE | Codex only | 0 | 1 |
| M-FRG-103 | proj_assists_es | Codex only | 0 | 1 |
| M-FRG-104 | proj_assists_pp | Codex only | 0 | 1 |
| M-FRG-105 | proj_blocks | Codex only | 0 | 1 |
| M-FRG-106 | proj_goals_es | Codex only | 0 | 1 |
| M-FRG-107 | proj_goals_pp | Codex only | 0 | 1 |
| M-FRG-108 | proj_hits | Codex only | 0 | 1 |
| M-FRG-109 | proj_shots_es | Codex only | 0 | 1 |
| M-FRG-110 | proj_shots_pp | Codex only | 0 | 1 |
| M-FRG-111 | proj_toi_es_seconds | Codex only | 0 | 1 |
| M-FRG-112 | proj_toi_pp_seconds | Codex only | 0 | 1 |
| M-FRG-113 | Build accountability (buildAccountability) | Codex only | 0 | 1 |
| M-FRG-114 | Errors (errors) | Codex only | 0 | 1 |
| M-FRG-115 | Settle evaluation (settleEvaluation) | Codex only | 0 | 1 |
| M-FRG-116 | Summarize accountability (summarizeAccountability) | Codex only | 0 | 1 |
| M-FRG-117 | Summarize horizon evaluations (summarizeHorizonEvaluations) | Codex only | 0 | 1 |
| M-FRG-118 | Totals (totals) | Codex only | 0 | 1 |
| M-FRG-119 | Seven-category linear fantasy points (scoreMeans) | Codex only | 0 | 1 |
| M-FRG-120 | Scoring profile (scoringProfile) | Codex only | 0 | 1 |

## M-FRG-061 Team PP share and PP TOI allocation

- **Match:** Both; Opus FRG-085; Codex web-lib-projections-stages-skater-stage-allocatepptoibyteamopportunity, web-lib-projections-stages-skater-stage-computeteamppshare
- **Purpose:** Team PP opportunity share and its distribution across skaters
- **Where:** `web/lib/projections/stages/skater-stage.ts:1238 (computeTeamPpShare)`; `web/lib/projections/stages/skater-stage.ts:1008 (allocatePpToiByTeamOpportunity)`; `web/lib/projections/queries/team-context-queries.ts:101 (fetchTeamOfficialPpUsage)`; `web/lib/projections/stages/skater-stage.ts:2543`; `web/lib/projections/stages/skater-stage.ts:1008 allocatePpToiByTeamOpportunity`; `web/lib/projections/stages/skater-stage.ts:1238 computeTeamPpShare`
- **Tags (heuristic):** denominators: per game, per team game, all strengths; generation: current
- **Opus view (FRG-085):**
  - Method: Official: ppShare = mean PP skater-seconds / mean all-situation skater-seconds over last 10 regular-season games (min 3); team-game rows with summed TOI <3600 treated as minutes (x60). Fallback: PP/(ES+PP+PK) from strength table; legacy share PP/(ES+PP) kept for ledger. PP target = round(clamp(share,0,0.5) x team target seconds); ES target = target - PP. Allocation proportional to official last-10 PP TOI avg (else pre-allocation PP TOI), clamp 0-1400 s per player; shots PP scaled by clamp(new/old,0.25,4).
  - Inputs/units: seconds (or minutes, heuristic); sources: wgo_skater_stats, games, teams, forge_team_game_strength
  - Output scale: seconds per game; share 0-0.5; writes: —
  - Status: live
  - Consumers: reconciliation targets; PP shots target (officialPpUsage.ppShotsAvg)
- **Codex view (web-lib-projections-stages-skater-stage-allocatepptoibyteamopportunity, symbol_candidate, location; Codex family 'FORGE staged projection math'):** Allocate pp toi by team opportunity (allocatePpToiByTeamOpportunity)
  - Purpose: Allocate pp toi by team opportunity for forge staged projection math. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: export function allocatePpToiByTeamOpportunity(args: { projectedByPlayer: Map< number, { toiPp: number; roleTag: SkaterRoleTag \| null; officialPpToiAvgSec?: number \| null; } >; targetTeamPpSeconds: number; }): SkaterPpOpportunityAllocation { const players = Array.from(args.projectedByPlayer.entries()); if (players.length === 0 \|\| args.targetTeamPpSeconds <= 0) { return { perPlayerPpToiSeconds: new Map<number, number>(), playersReweighted: 0, }; }
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (web-lib-projections-stages-skater-stage-computeteamppshare, symbol_candidate, location; Codex family 'FORGE staged projection math'):** Compute team pp share (computeTeamPpShare)
  - Purpose: Team PP share of skater time. Official WGO usage (PP over all-situation skater TOI) when present; otherwise the strength table with PK time in the denominator, then the pre-allocation split. `legacyPpShare` is the former ES+PP-denominator share, kept for the ledger. /
  - Inputs/units: Parameter/type declaration excerpt: export function computeTeamPpShare(args: { official: TeamOfficialPpUsage \| null; strengthAverages: TeamStrengthAverages; preAllocationToiEs: number; preAllocationToiPp: number; }): { ppShare: number; legacyPpShare: number; source: "official_wgo" \| "strength_table_pk_denominator"; } { const avgToiPp = safeNumber(args.strengthAverages.toiPpSecondsAvg, 0); const esPpDenom = safeNumber(args.strengthAverages.toiEsSecondsAvg, 0) + avgToiPp; const allDenom = esPpDenom + safeNumber(args.strengthAverages.toiPkSecondsAvg, 0); const fallbackDenom = args.preAllocationToiEs + args.preAllocationToiPp; const fallbackShare = fallbackDenom > 0 ? args.preAllocationToiPp / fallbackDenom : 0.1;
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): stages/skater-stage.ts:1233-1237 docstring
  - Intended contract (Codex web-lib-projections-stages-skater-stage-allocatepptoibyteamopportunity): {"source": "web/lib/projections/stages/skater-stage.ts:1008", "explicit_comment": "web/lib/projections/stages/skater-stage.ts:1027 Proportional to official last-10 PP TOI per game when known, else the pre-allocation PP TOI;", "arithmetic_locations": ["web/lib/projections/stages/skater-stage.ts:1046 const allocated = (row.weight / weightSum) * args.targetTeamPpSeconds;"]}
  - Intended contract (Codex web-lib-projections-stages-skater-stage-computeteamppshare): {"source": "web/lib/projections/stages/skater-stage.ts:1238", "explicit_comment": "Team PP share of skater time. Official WGO usage (PP over all-situation skater TOI) when present; otherwise the strength table with PK time in the denominator, then the pre-allocation split. `legacyPpShare` is the former ES+PP-denominator share, kept for the ledger. /", "arithmetic_locations": ["web/lib/projections/stages/skater-stage.ts:1255 fallbackDenom > 0 ? args.preAllocationToiPp / fallbackDenom : 0.1;", "web/lib/projections/stages/skater-stage.ts:1256 const legacyPpShare = esPpDenom > 0 ? avgToiPp / esPpDenom : fallbackShare;", "web/lib/projections/stages/skater-stage.ts:1260 ppShare: official.ppToiSkaterSecondsAvg / official.totalToiSkaterSecondsAvg,", "web/lib/projections/stages/skater-stage.ts:1266 ppShare: allDenom > 0 ? avgToiPp / allDenom : fallbackShare,"]}
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/projections/queries/team-context-queries.test.ts`; `web/lib/projections/runProjectionV2.test.ts`; `{"status": "Discovered only; not run", "references": ["web/lib/projections/runProjectionV2.test.ts:28", "web/lib/projections/startChartPipeline.test.ts:12"]}`; `{"status": "Discovered only; not run", "references": ["web/lib/projections/runProjectionV2.test.ts:51"]}`
- **Leads (not audited):**
  - (opus) observation: share uses a PK-inclusive denominator but is applied to a target that has no PK component, so PK skater-seconds end up inside the ES target
  - (opus) observation: unit heuristic on summed TOI <3600
  - (codex:web-lib-projections-stages-skater-stage-allocatepptoibyteamopportunity) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:web-lib-projections-stages-skater-stage-computeteamppshare) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-FRG-062 Team TOI target with undersized-pool guard

- **Match:** Both; Opus FRG-086; Codex web-lib-projections-calculators-scenario-blending-computeskaterteamtoitargetwithpoolguard
- **Purpose:** Team skater-seconds target (5 x 3600) capped when too few skaters are projected
- **Where:** `web/lib/projections/stages/skater-stage.ts:2459 (targetSkaterSecondsCanonical)`; `web/lib/projections/calculators/scenario-blending.ts:421 (computeSkaterTeamToiTargetWithPoolGuard)`; `web/lib/projections/calculators/scenario-blending.ts:421 computeSkaterTeamToiTargetWithPoolGuard`
- **Tags (heuristic):** denominators: per game; generation: current
- **Opus view (FRG-086):**
  - Method: Canonical 18,000 skater-seconds. If projected count < 15: blendedTopShare = 0.24*(1-pp)+0.58*pp; cap = max(1800, min(floor(2100/blendedTopShare), count x 1200)); target = min(18000, cap).
  - Inputs/units: seconds; sources: —
  - Output scale: skater-seconds per game; writes: —
  - Status: live
  - Consumers: reconciliation
- **Codex view (web-lib-projections-calculators-scenario-blending-computeskaterteamtoitargetwithpoolguard, symbol_candidate, location; Codex family 'FORGE staged projection math'):** Compute skater team toi target with pool guard (computeSkaterTeamToiTargetWithPoolGuard)
  - Purpose: Compute skater team toi target with pool guard for forge staged projection math. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: export function computeSkaterTeamToiTargetWithPoolGuard(args: { canonicalTargetSeconds: number; projectedSkaterCount: number; ppShare: number; minValidSkaterCount?: number; maxSingleSkaterToiSeconds?: number; maxAvgToiPerProjectedSkaterSeconds?: number; }): { targetSeconds: number; wasCapped: boolean; capReason: "undersized_projected_pool" \| null; } { const canonicalTarget = Math.max( 0, Math.floor(Number(args.canonicalTargetSeconds) \|\| 0) ); const projectedSkaterCount = Math.max( 0,
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex web-lib-projections-calculators-scenario-blending-computeskaterteamtoitargetwithpoolguard): {"source": "web/lib/projections/calculators/scenario-blending.ts:421", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["web/lib/projections/calculators/scenario-blending.ts:463 RECON_TOP_ES_SHARE_MAX * (1 - ppShare) + RECON_TOP_PP_SHARE_MAX * ppShare;", "web/lib/projections/calculators/scenario-blending.ts:466 ? Math.floor(maxSingleSkaterToiSeconds / blendedTopShare)", "web/lib/projections/calculators/scenario-blending.ts:470 ? projectedSkaterCount * maxAvgToiPerProjectedSkaterSeconds"]}
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/projections/runProjectionV2.test.ts`; `{"status": "Discovered only; not run", "references": ["web/lib/projections/runProjectionV2.test.ts:34"]}`
- **Leads (not audited):**
  - (opus) observation: target ignores OT/4v4/3v3 and PK (4 skaters) so team skater-seconds are fixed at 18,000 per game
  - (codex:web-lib-projections-calculators-scenario-blending-computeskaterteamtoitargetwithpoolguard) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-FRG-063 WGO TOI normalization and deployment-prior TOI blend

- **Match:** Both; Opus FRG-087; Codex web-lib-projections-stages-skater-stage-blendtoisecondswithdeploymentprior
- **Purpose:** Convert WGO TOI fields to seconds and blend rolling TOI with WGO deployment prior
- **Where:** `web/lib/projections/stages/skater-stage.ts:333 (normalizeWgoToiToSeconds)`; `web/lib/projections/stages/skater-stage.ts:344 (blendToiSecondsWithDeploymentPrior)`; `web/lib/projections/queries/skater-queries.ts:497 (fetchLatestWgoSkaterDeploymentProfiles)`; `web/lib/projections/stages/skater-stage.ts:2122 (in-stage TOI blend)`; `web/lib/projections/stages/skater-stage.ts:344 blendToiSecondsWithDeploymentPrior`
- **Tags (heuristic):** denominators: per game; generation: current
- **Opus view (FRG-087):**
  - Method: WGO value <=60 treated as minutes (x60), <=3600 as seconds, else capped 3600. PP prior clamp 0-1200 s, ES 0-2400 s (ES = total - PP if missing). Rolling TOI = last5 avg else all-window avg else defaults 700 s ES / 120 s PP. Blend = w*rolling + (1-w)*WGO latest-game prior, w=0.8 if rolling row exists else 0.45. Then x rest toiMultiplier, clamp ES 0-2600, PP 0-1300.
  - Inputs/units: seconds (rolling); minutes or seconds (WGO, heuristically detected); sources: rolling_player_game_metrics, wgo_skater_stats
  - Output scale: seconds per game; writes: —
  - Status: live
  - Consumers: skater stage TOI; reconciliation
- **Codex view (web-lib-projections-stages-skater-stage-blendtoisecondswithdeploymentprior, symbol_candidate, location; Codex family 'FORGE staged projection math'):** Blend toi seconds with deployment prior (blendToiSecondsWithDeploymentPrior)
  - Purpose: Blend toi seconds with deployment prior for forge staged projection math. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: export function blendToiSecondsWithDeploymentPrior(args: { rollingSeconds: number \| null; deploymentPriorSeconds: number \| null; rollingWeight: number; }): number \| null { const rolling = finiteOrNull(args.rollingSeconds); const prior = finiteOrNull(args.deploymentPriorSeconds); const rollingWeight = clamp(args.rollingWeight, 0, 1); if (rolling == null && prior == null) return null; if (rolling == null) return prior; if (prior == null) return rolling; return Number( (rollingWeight * rolling + (1 - rollingWeight) * prior).toFixed(3), ); }
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): stages/skater-stage.ts:338 comment: WGO TOI/game fields are typically in minutes
  - Intended contract (Codex web-lib-projections-stages-skater-stage-blendtoisecondswithdeploymentprior): {"source": "web/lib/projections/stages/skater-stage.ts:344", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["web/lib/projections/stages/skater-stage.ts:356 (rollingWeight * rolling + (1 - rollingWeight) * prior).toFixed(3),"]}
  - External references: NST/WGO per-game TOI conventions
  - Fixtures/test data: none listed
  - Tests: `web/lib/projections/runProjectionV2.test.ts`; `{"status": "Discovered only; not run", "references": ["web/lib/projections/runProjectionV2.test.ts:20"]}`
- **Leads (not audited):**
  - (opus) observation: WGO 'prior' is the single latest WGO game row within 365 days, not a season average
  - (opus) observation: unit heuristic: value 59 seconds would be read as 59 minutes
  - (opus) observation: fixed 700/120 s defaults for missing rows
  - (codex:web-lib-projections-stages-skater-stage-blendtoisecondswithdeploymentprior) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-FRG-064 Role continuity and stability multiplier

- **Match:** Both; Opus FRG-089; Codex web-lib-projections-stages-skater-stage-computeskaterrolestabilitymultiplier, web-lib-projections-stages-skater-stage-summarizeskaterrolecontinuity
- **Purpose:** Penalise or boost a skater's TOI/shots by how stable his recent role is
- **Where:** `web/lib/projections/stages/skater-stage.ts:747 (summarizeSkaterRoleContinuity)`; `web/lib/projections/stages/skater-stage.ts:788 (computeSkaterRoleStabilityMultiplier)`; `web/lib/projections/stages/skater-stage.ts:2347 (availabilityMultiplier product)`; `web/lib/projections/stages/skater-stage.ts:788 computeSkaterRoleStabilityMultiplier`; `web/lib/projections/stages/skater-stage.ts:747 summarizeSkaterRoleContinuity`
- **Tags (heuristic):** generation: current
- **Opus view (FRG-089):**
  - Method: Window 10 games. continuityShare = games in current role / tracked; roleChangeRate = changes/(n-1); volatility = distinct roles/n. penalty = (0.6-share)*0.35 if share<0.6 + changeRate*0.12 + (vol-0.5)*0.2 if vol>0.5; bonus = min(0.05,(share-0.75)*0.2) if n>=4 and share>=0.75. multiplier = clamp(1-penalty+bonus, 0.7, 1.05). Multiplies TOI and shots (with recency and availability multipliers) before reconciliation.
  - Inputs/units: game counts; sources: lineCombinations (role history)
  - Output scale: multiplier 0.70-1.05; writes: —
  - Status: live
  - Consumers: projected TOI/shots; uncertainty metadata
- **Codex view (web-lib-projections-stages-skater-stage-computeskaterrolestabilitymultiplier, symbol_candidate, location; Codex family 'FORGE staged projection math'):** Compute skater role stability multiplier (computeSkaterRoleStabilityMultiplier)
  - Purpose: Compute skater role stability multiplier for forge staged projection math. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: export function computeSkaterRoleStabilityMultiplier( summary: SkaterRoleContinuitySummary, ): number { if (summary.appearancesTracked <= 1) return 1; let penalty = 0; let bonus = 0; if (summary.continuityShare < 0.6) { penalty += (0.6 - summary.continuityShare) * 0.35; } penalty += summary.roleChangeRate * 0.12; if (summary.volatilityIndex > 0.5) { penalty += (summary.volatilityIndex - 0.5) * 0.2; } if (summary.appearancesTracked >= 4 && summary.continuityShare >= 0.75) { bonus += Math.min(0.05, (summary.continuityShare - 0.75) * 0.2); }
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (web-lib-projections-stages-skater-stage-summarizeskaterrolecontinuity, symbol_candidate, location; Codex family 'FORGE staged projection math'):** Summarize skater role continuity (summarizeSkaterRoleContinuity)
  - Purpose: Summarize skater role continuity for forge staged projection math. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: export function summarizeSkaterRoleContinuity(args: { currentRole: string; recentRoles: string[]; windowGames?: number; }): SkaterRoleContinuitySummary { const windowGames = Number.isFinite(args.windowGames) ? Math.max(1, Math.floor(Number(args.windowGames))) : SKATER_ROLE_HISTORY_WINDOW_GAMES; const roles = args.recentRoles.slice(0, windowGames); const appearancesTracked = roles.length; if (appearancesTracked === 0) { return { windowGames, appearancesTracked: 0, gamesInCurrentRole: 0, continuityShare: 0, roleChangeRate: 0, volatilityIndex: 0,
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex web-lib-projections-stages-skater-stage-computeskaterrolestabilitymultiplier): {"source": "web/lib/projections/stages/skater-stage.ts:788", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["web/lib/projections/stages/skater-stage.ts:796 penalty += (0.6 - summary.continuityShare) * 0.35;", "web/lib/projections/stages/skater-stage.ts:798 penalty += summary.roleChangeRate * 0.12;", "web/lib/projections/stages/skater-stage.ts:800 penalty += (summary.volatilityIndex - 0.5) * 0.2;", "web/lib/projections/stages/skater-stage.ts:803 bonus += Math.min(0.05, (summary.continuityShare - 0.75) * 0.2);"]}
  - Intended contract (Codex web-lib-projections-stages-skater-stage-summarizeskaterrolecontinuity): {"source": "web/lib/projections/stages/skater-stage.ts:747", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["web/lib/projections/stages/skater-stage.ts:769 const continuityShare = gamesInCurrentRole / appearancesTracked;", "web/lib/projections/stages/skater-stage.ts:775 appearancesTracked > 1 ? roleChanges / (appearancesTracked - 1) : 0;", "web/lib/projections/stages/skater-stage.ts:776 const volatilityIndex = new Set(roles).size / appearancesTracked;"]}
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/projections/runProjectionV2.test.ts`; `{"status": "Discovered only; not run", "references": ["web/lib/projections/runProjectionV2.test.ts:40"]}`; `{"status": "Discovered only; not run", "references": ["web/lib/projections/runProjectionV2.test.ts:41"]}`
- **Leads (not audited):**
  - (opus) observation: role volatility lowers expected TOI (a mean change for an uncertainty signal); team reconciliation then rescales TOI back to the 18,000 s target, redistributing it
  - (opus) observation: magic constants, no fit evidence
  - (codex:web-lib-projections-stages-skater-stage-computeskaterrolestabilitymultiplier) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:web-lib-projections-stages-skater-stage-summarizeskaterrolecontinuity) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-FRG-065 Count distribution helpers and fitted dispersion

- **Match:** Both; Opus FRG-090; Codex web-lib-projections-dispersion-compoundtoidispersion, web-lib-projections-dispersion-resolvedispersionalpha, web-lib-projections-uncertainty-summarizecountdistribution
- **Possible related records (low-confidence location link, unconfirmed):** web-lib-projections-uncertainty-countpmf, web-lib-projections-uncertainty-overunderpushprobabilities, web-lib-projections-uncertainty-playertoicv, web-lib-projections-uncertainty-probabilityoverline
- **Purpose:** NB/Poisson pmf, cdf, quantiles, over/under/push probabilities with fitted alpha(mu)
- **Where:** `web/lib/projections/dispersion.ts:59 (FORGE_DISPERSION)`; `web/lib/projections/dispersion.ts:131 (compoundToiDispersion)`; `web/lib/projections/dispersion.ts:155 (resolveDispersionAlpha)`; `web/lib/projections/uncertainty.ts:782 (countPmf)`; `web/lib/projections/uncertainty.ts:850 (summarizeCountDistribution)`; `web/lib/projections/uncertainty.ts:918 (overUnderPushProbabilities)`; `web/lib/projections/uncertainty.ts:944 (probabilityOverLine)`; `web/lib/projections/uncertainty.ts:955 (playerToiCv)`; `web/lib/projections/dispersion.ts:131 compoundToiDispersion`; `web/lib/projections/dispersion.ts:155 resolveDispersionAlpha`; `web/lib/projections/uncertainty.ts:850 summarizeCountDistribution`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: per game, shots on goal; generation: current
- **Opus view (FRG-090):**
  - Method: Var = mu + b*mu + a*mu^2; alpha(mu) = a/H + b/mu. Fitted: SOG F a=0.0012 b=0.0983 (cond a=0,b=0.0458), SOG D 0.0211/0.0345, HIT F 0.0069/0.1842, HIT D 0.0162/0.1728, BLK F 0.0952/0.0111, BLK D 0.0306/0.0547, SV G a=0.0401, SA G a=0.0291; goals and assists Poisson (negative fitted alpha). TOI compounding: a' = a(1+c^2)+c^2. pmf via log recursion truncated at tail <1e-12. Over = 1-CDF(floor(line)); push at integer lines.
  - Inputs/units: counts per game; sources: (fit) wgo_skater_stats, wgo_goalie_stats 2023-24/2024-25 via web/scripts/fit-forge-dispersion.ts
  - Output scale: probabilities 0-1; integer quantiles; writes: —
  - Status: live
  - Consumers: market comparisons (forgePropOverProbability); served ledger implied means; uncertainty sims
- **Codex view (web-lib-projections-dispersion-compoundtoidispersion, calculation, codex_part_of_opus; Codex family 'FORGE staged projection math'):** TOI-compounded dispersion (compoundToiDispersion)
  - Purpose: a_out=a*(1+CV²)+CV²; b_out=b.
  - Inputs/units: Named model/observation inputs at cited declaration; NB quadratic/linear dispersion coefficients, dimensionless. Input count/rate units follow the corresponding named outcome; cutoff timestamps and identity are required where declared.
  - Output scale: NB quadratic/linear dispersion coefficients, dimensionless.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (web-lib-projections-dispersion-resolvedispersionalpha, calculation, codex_part_of_opus; Codex family 'FORGE staged projection math'):** Per-stat horizon dispersion (resolveDispersionAlpha)
  - Purpose: Var=μ(1+b)+aμ²/H; NB alpha=a/H+b/μ; optionally compound TOI CV first.
  - Inputs/units: Named model/observation inputs at cited declaration; Nonnegative NB alpha or null meaning unfitted. Input count/rate units follow the corresponding named outcome; cutoff timestamps and identity are required where declared.
  - Output scale: Nonnegative NB alpha or null meaning unfitted.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (web-lib-projections-uncertainty-summarizecountdistribution, calculation, location; Codex family 'FORGE staged projection math'):** Count-distribution summary (summarizeCountDistribution)
  - Purpose: Mean, μ+alpha μ² variance, CDF-derived P(X≥k), p10/p50/p90 and distribution label.
  - Inputs/units: Nonnegative mean count, alpha, requested threshold integers.
  - Output scale: Count mean/quantiles; count² variance; threshold probabilities.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": ["goalie-shots-binomial-ga-v1"], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): dispersion.ts:1-30 docstring (fit method, data, holdout)
  - Intended contract (Codex web-lib-projections-dispersion-compoundtoidispersion): {"source": "web/lib/projections/dispersion.ts:131", "explicit_comment": "Compound TOI-conditional dispersion with independent per-game TOI noise of coefficient of variation `toiCv` (counts scale with TOI): Var = E[Var(X\|T)] + Var(E[X\|T]) = mu(1+b) + a mu^2 (1+c^2) + c^2 mu^2. /", "arithmetic_locations": ["web/lib/projections/dispersion.ts:135 const c2 = Number.isFinite(toiCv) ? Math.max(0, toiCv) ** 2 : 0;", "web/lib/projections/dispersion.ts:137 a: Math.max(0, coefficients.a) * (1 + c2) + c2,", "web/lib/projections/dispersion.ts:143 /** Per-game TOI CV carried by the projection; switches to the TOI-conditional fit compounded with it. */", "web/lib/projections/dispersion.ts:145 /** Number of iid games summed into `mean` (sum of NB with shared p stays NB). */", "web/lib/projections/dispersion.ts:149 /**"]}
  - Intended contract (Codex web-lib-projections-dispersion-resolvedispersionalpha): {"source": "web/lib/projections/dispersion.ts:155", "explicit_comment": "NB alpha for a projected total `mean` of `stat` for `position`, or null when no fit exists (callers fall back to Poisson). With horizonGames = H and a total mean M = H * m, the summed variance is M(1+b) + a M^2 / H, so alpha = a / H + b / M. /", "arithmetic_locations": ["web/lib/projections/dispersion.ts:169 const alpha = Math.max(0, coefficients.a) / horizon + Math.max(0, coefficients.b) / mean;"]}
  - Intended contract (Codex web-lib-projections-uncertainty-summarizecountdistribution): {"source": "web/lib/projections/uncertainty.ts:850", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["web/lib/projections/uncertainty.ts:875 variance: round3(countVariance(mu, a)),"]}
  - External references: Negative binomial NB2/NB1; log score, RPS, PIT (holdout described in comment)
  - Fixtures/test data: `web/scripts/fit-forge-dispersion.ts`
  - Tests: `web/lib/projections/dispersion.test.ts`; `web/lib/projections/uncertainty.test.ts`; `{"status": "Discovered only; not run", "references": ["web/lib/projections/dispersion.test.ts:5"]}`; `{"status": "Discovered only; not run", "references": ["web/lib/projections/dispersion.test.ts:8"]}`; `{"status": "Discovered only; not run", "references": ["web/lib/projections/uncertainty.test.ts:14"]}`
- **Leads (not audited):**
  - (opus) observation: fit excludes between-player rate uncertainty by design; predictive use adds model error not captured
  - (opus) observation: goalie a,b not separately identified (comment)
  - (codex:web-lib-projections-dispersion-compoundtoidispersion) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested."]
  - (codex:web-lib-projections-dispersion-resolvedispersionalpha) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested."]
  - (codex:web-lib-projections-uncertainty-summarizecountdistribution) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested."]

## M-FRG-066 Player uncertainty Monte Carlo (p10/p50/p90)

- **Match:** Both; Opus FRG-091; Codex web-lib-projections-uncertainty-buildplayeruncertainty, web-lib-projections-uncertainty-quantilesfromsamples, web-lib-projections-uncertainty-samplegammameanone, web-lib-projections-uncertainty-samplenormal, web-lib-projections-uncertainty-samplepoisson, web-lib-projections-uncertainty-widenquantiles
- **Purpose:** Simulated quantiles for skater TOI, shots, goals, assists, points, PPP, hits, blocks
- **Where:** `web/lib/projections/uncertainty.ts:153 (buildPlayerUncertainty)`; `web/lib/projections/uncertainty.ts:63 (samplePoisson)`; `web/lib/projections/uncertainty.ts:969 (sampleGammaMeanOne)`; `web/lib/projections/uncertainty.ts:762 (simulationAlpha)`; `web/lib/projections/uncertainty.ts:102 (widenQuantiles)`; `web/lib/projections/uncertainty.ts:80 (quantilesFromSamples)`; `web/lib/projections/uncertainty.ts:153 buildPlayerUncertainty`; `web/lib/projections/uncertainty.ts:80 quantilesFromSamples`; `web/lib/projections/uncertainty.ts:969 sampleGammaMeanOne`; `web/lib/projections/uncertainty.ts:55 sampleNormal`; `web/lib/projections/uncertainty.ts:63 samplePoisson`; `web/lib/projections/uncertainty.ts:102 widenQuantiles`
- **Tags (heuristic):** conditionality: conditional; denominators: per game, shots on goal; generation: current
- **Opus view (FRG-091):**
  - Method: 400 samples, deterministic FNV-seeded RNG. Per game: TOI ~ Normal(mean, 10% ES / 15% PP SD), toiScale = drawn/base; shots ~ Poisson(mean*toiScale*Gamma(1/alpha)) with NB alpha from dispersion fit (TOI-conditional compounded with residual TOI CV); goals ~ Poisson(goal mean*toiScale) independent of drawn shots; assists ~ Poisson independent of goals; hits/blocks NB. Totals summed over horizon; quantiles at floor(p*(n-1)); spreads widened by trend volatility (0.75-1.8). Poisson >=30 uses rounded normal approx.
  - Inputs/units: seconds; counts per game; sources: —
  - Output scale: count quantiles over horizon; writes: forge_player_projections.uncertainty
  - Status: live (negativeBinomial:true passed from skater stage)
  - Consumers: accuracy interval coverage; start chart; FORGE player pages
- **Codex view (web-lib-projections-uncertainty-buildplayeruncertainty, calculation, codex_part_of_opus; Codex family 'FORGE staged projection math'):** Skater horizon predictive quantiles (buildPlayerUncertainty)
  - Purpose: 400 seeded samples: role scenario, game-specific TOI noise and horizon scalars; Poisson conversions; optional fitted NB SOG/HIT/BLK; aggregate draws then volatility-adjust p10/p50/p90.
  - Inputs/units: Per-game ES/PP seconds, shots/goals/assists, hits/blocks; horizon games/scalars; optional scenario weights and count model.
  - Output scale: p10/p50/p90 for toi_es_seconds,toi_pp_seconds,shots_es/pp,goals_es/pp,assists_es/pp,HIT,BLK,G,A,PTS,SOG,PPP in corresponding units.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": ["goalie-shots-binomial-ga-v1"], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (web-lib-projections-uncertainty-quantilesfromsamples, symbol_candidate, codex_part_of_opus; Codex family 'FORGE staged projection math'):** Quantiles from samples (quantilesFromSamples)
  - Purpose: Quantiles from samples for forge staged projection math. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: function quantilesFromSamples(samples: number[]): { p10: number; p50: number; p90: number; } { if (samples.length === 0) return { p10: 0, p50: 0, p90: 0 }; const sorted = [...samples].sort((a, b) => a - b); const idx = (p: number) => Math.max(0, Math.min(sorted.length - 1, Math.floor(p * (sorted.length - 1)))); return { p10: round3(sorted[idx(0.1)]), p50: round3(sorted[idx(0.5)]), p90: round3(sorted[idx(0.9)]) }; } type QuantileTriple = { p10: number;
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": ["goalie-shots-binomial-ga-v1"], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (web-lib-projections-uncertainty-samplegammameanone, symbol_candidate, codex_part_of_opus; Codex family 'FORGE staged projection math'):** Sample gamma mean one (sampleGammaMeanOne)
  - Purpose: Gamma(shape, scale = 1/shape) multiplier with mean 1 and variance 1/shape (Marsaglia-Tsang).
  - Inputs/units: Parameter/type declaration excerpt: function sampleGammaMeanOne(shape: number, rand: () => number): number { if (!Number.isFinite(shape) \|\| shape <= 0) return 1; if (shape < 1) { const u = Math.max(rand(), 1e-12); return sampleGammaMeanOne(shape + 1, rand) * ((shape + 1) / shape) * u ** (1 / shape); } const d = shape - 1 / 3; const c = 1 / Math.sqrt(9 * d); for (let i = 0; i < 100; i += 1) { const x = sampleNormal(0, 1, rand); const v = (1 + c * x) ** 3; if (v <= 0) continue; const u = Math.max(rand(), 1e-12); if (Math.log(u) < 0.5 * x * x + d - d * v + d * Math.log(v)) return (d * v) / shape; } return 1; }
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": ["goalie-shots-binomial-ga-v1"], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (web-lib-projections-uncertainty-samplenormal, symbol_candidate, codex_part_of_opus; Codex family 'FORGE staged projection math'):** Sample normal (sampleNormal)
  - Purpose: Sample normal for forge staged projection math. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: function sampleNormal(mean: number, sd: number, rand: () => number): number { if (!Number.isFinite(mean) \|\| !Number.isFinite(sd) \|\| sd <= 0) return mean; const u = Math.max(rand(), 1e-12); const v = Math.max(rand(), 1e-12); const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); return mean + z * sd; }
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": ["goalie-shots-binomial-ga-v1"], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (web-lib-projections-uncertainty-samplepoisson, symbol_candidate, codex_part_of_opus; Codex family 'FORGE staged projection math'):** Sample poisson (samplePoisson)
  - Purpose: Sample poisson for forge staged projection math. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: function samplePoisson(lambda: number, rand: () => number): number { const l = clampNonNegative(lambda); if (l === 0) return 0; if (l < 30) { const L = Math.exp(-l); let k = 0; let p = 1; do { k += 1; p *= rand(); } while (p > L); return k - 1; } const normal = sampleNormal(l, Math.sqrt(l), rand); return Math.max(0, Math.round(normal)); }
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": ["goalie-shots-binomial-ga-v1"], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (web-lib-projections-uncertainty-widenquantiles, symbol_candidate, codex_part_of_opus; Codex family 'FORGE staged projection math'):** Widen quantiles (widenQuantiles)
  - Purpose: Widen quantiles for forge staged projection math. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: function widenQuantiles(q: QuantileTriple, spreadMultiplier: number): QuantileTriple { const mult = Math.max(0.75, Math.min(1.8, spreadMultiplier)); if (Math.abs(mult - 1) < 1e-6) return q; const lowSpread = Math.max(0, q.p50 - q.p10); const highSpread = Math.max(0, q.p90 - q.p50); const p10 = clampNonNegative(q.p50 - lowSpread * mult); const p90 = Math.max(q.p50, q.p50 + highSpread * mult); return { p10: round3(p10), p50: round3(q.p50), p90: round3(p90) }; } // Cheap approximation for Poisson quantiles (good enough for MVP uncertainty scaffolding).
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": ["goalie-shots-binomial-ga-v1"], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): uncertainty.ts:11-23 UNCERTAINTY_CONFIG comments
  - Intended contract (Codex web-lib-projections-uncertainty-buildplayeruncertainty): {"source": "web/lib/projections/uncertainty.ts:153", "explicit_comment": "web/lib/projections/uncertainty.ts:371 NB: one gamma multiplier shared by ES and PP shots keeps total SOG NB(mu, alpha).", "arithmetic_locations": ["web/lib/projections/uncertainty.ts:188 u.toiEsSeconds * totalScalar,", "web/lib/projections/uncertainty.ts:191 Math.sqrt(totalScalar)", "web/lib/projections/uncertainty.ts:196 u.toiPpSeconds * totalScalar,", "web/lib/projections/uncertainty.ts:199 Math.sqrt(totalScalar)", "web/lib/projections/uncertainty.ts:202 shots_es: applyVolatility(poissonQuantilesApprox(u.shotsEs * totalScalar)),", "web/lib/projections/uncertainty.ts:203 shots_pp: applyVolatility(poissonQuantilesApprox(u.shotsPp * totalScalar)),", "web/lib/projections/uncertainty.ts:204 goals_es: applyVolatility(poissonQuantilesApprox(u.goalsEs * totalScalar)),", "web/lib/projections/uncertainty.ts:205 goals_pp: applyVolatility(poissonQuantilesApprox(u.goalsPp * totalScalar)),"]}
  - Intended contract (Codex web-lib-projections-uncertainty-quantilesfromsamples): {"source": "web/lib/projections/uncertainty.ts:80", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["web/lib/projections/uncertainty.ts:88 Math.max(0, Math.min(sorted.length - 1, Math.floor(p * (sorted.length - 1))));"]}
  - Intended contract (Codex web-lib-projections-uncertainty-samplegammameanone): {"source": "web/lib/projections/uncertainty.ts:969", "explicit_comment": "Gamma(shape, scale = 1/shape) multiplier with mean 1 and variance 1/shape (Marsaglia-Tsang).", "arithmetic_locations": ["web/lib/projections/uncertainty.ts:973 return sampleGammaMeanOne(shape + 1, rand) * ((shape + 1) / shape) * u ** (1 / shape);", "web/lib/projections/uncertainty.ts:975 const d = shape - 1 / 3;", "web/lib/projections/uncertainty.ts:976 const c = 1 / Math.sqrt(9 * d);", "web/lib/projections/uncertainty.ts:979 const v = (1 + c * x) ** 3;", "web/lib/projections/uncertainty.ts:982 if (Math.log(u) < 0.5 * x * x + d - d * v + d * Math.log(v)) return (d * v) / shape;", "web/lib/projections/uncertainty.ts:987 /** Gamma-Poisson draw: X ~ NB(mean, alpha); alpha 0/null draws Poisson. */"]}
  - Intended contract (Codex web-lib-projections-uncertainty-samplenormal): {"source": "web/lib/projections/uncertainty.ts:55", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["web/lib/projections/uncertainty.ts:59 const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);", "web/lib/projections/uncertainty.ts:60 return mean + z * sd;"]}
  - Intended contract (Codex web-lib-projections-uncertainty-samplepoisson): {"source": "web/lib/projections/uncertainty.ts:63", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["web/lib/projections/uncertainty.ts:67 const L = Math.exp(-l);", "web/lib/projections/uncertainty.ts:76 const normal = sampleNormal(l, Math.sqrt(l), rand);"]}
  - Intended contract (Codex web-lib-projections-uncertainty-widenquantiles): {"source": "web/lib/projections/uncertainty.ts:102", "explicit_comment": "web/lib/projections/uncertainty.ts:116 Cheap approximation for Poisson quantiles (good enough for MVP uncertainty scaffolding).", "arithmetic_locations": ["web/lib/projections/uncertainty.ts:107 const p10 = clampNonNegative(q.p50 - lowSpread * mult);", "web/lib/projections/uncertainty.ts:108 const p90 = Math.max(q.p50, q.p50 + highSpread * mult);"]}
  - External references: NB2 count models; predictive intervals
  - Fixtures/test data: none listed
  - Tests: `web/lib/projections/uncertainty.test.ts`; `{"status": "Discovered only; not run", "references": ["web/lib/projections/uncertainty.test.ts (module test)"]}`; `{"status": "Discovered only; not run", "references": ["web/lib/projections/uncertainty.test.ts:5"]}`
- **Leads (not audited):**
  - (opus) observation: goals are not conditioned on simulated shots (gamma shot multiplier not propagated), assists independent of goals, so points/PPP spreads ignore G-A correlation
  - (opus) observation: no parameter uncertainty in rates; dispersion fit uses within-player-season variance, so bands may be too narrow
  - (opus) observation: p10/p90 of discrete counts with inclusive coverage scoring
  - (codex:web-lib-projections-uncertainty-buildplayeruncertainty) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested."]
  - (codex:web-lib-projections-uncertainty-quantilesfromsamples) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:web-lib-projections-uncertainty-samplegammameanone) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:web-lib-projections-uncertainty-samplenormal) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:web-lib-projections-uncertainty-samplepoisson) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:web-lib-projections-uncertainty-widenquantiles) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-FRG-067 Team uncertainty Monte Carlo

- **Match:** Both; Opus FRG-092; Codex web-lib-projections-uncertainty-buildteamuncertainty
- **Purpose:** Quantiles for team TOI, shots and goals
- **Where:** `web/lib/projections/uncertainty.ts:456 (buildTeamUncertainty)`; `web/lib/projections/uncertainty.ts:456 buildTeamUncertainty`
- **Tags (heuristic):** generation: current
- **Opus view (FRG-092):**
  - Method: 400 samples. TOI Normal SD 3% (ES) / 8% (PP); shots Poisson x toiScale; goals Poisson scaled by shots ratio (mean only). No NB.
  - Inputs/units: seconds; counts; sources: —
  - Output scale: count quantiles; writes: forge_team_projections.uncertainty
  - Status: live
  - Consumers: team pages
- **Codex view (web-lib-projections-uncertainty-buildteamuncertainty, calculation, location; Codex family 'FORGE staged projection math'):** Team horizon predictive quantiles (buildTeamUncertainty)
  - Purpose: Seeded TOI noise and Poisson ES/PP shots/goals for every horizon game; aggregate draws and empirical p10/p50/p90.
  - Inputs/units: Team ES/PP TOI seconds and count means; game horizon/scalars.
  - Output scale: Quantiles for team ES/PP seconds, shots and goals.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": ["goalie-shots-binomial-ga-v1"], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex web-lib-projections-uncertainty-buildteamuncertainty): {"source": "web/lib/projections/uncertainty.ts:456", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["web/lib/projections/uncertainty.ts:478 u.toiEsSeconds * totalScalar,", "web/lib/projections/uncertainty.ts:481 Math.sqrt(totalScalar)", "web/lib/projections/uncertainty.ts:484 u.toiPpSeconds * totalScalar,", "web/lib/projections/uncertainty.ts:487 Math.sqrt(totalScalar)", "web/lib/projections/uncertainty.ts:489 shots_es: poissonQuantilesApprox(u.shotsEs * totalScalar),", "web/lib/projections/uncertainty.ts:490 shots_pp: poissonQuantilesApprox(u.shotsPp * totalScalar),", "web/lib/projections/uncertainty.ts:491 goals_es: poissonQuantilesApprox(u.goalsEs * totalScalar),", "web/lib/projections/uncertainty.ts:492 goals_pp: poissonQuantilesApprox(u.goalsPp * totalScalar)"]}
  - External references: Poisson team goal models
  - Fixtures/test data: none listed
  - Tests: `web/lib/projections/uncertainty.test.ts`; `{"status": "Discovered only; not run", "references": ["web/lib/projections/uncertainty.test.ts (module test)"]}`
- **Leads (not audited):**
  - (opus) observation: sums of player Poisson means treated as a single Poisson (no between-player correlation, no overdispersion)
  - (opus) observation: team TOI is a hard constraint yet given 3-8% noise
  - (codex:web-lib-projections-uncertainty-buildteamuncertainty) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested."]

## M-FRG-068 Goalie uncertainty Monte Carlo

- **Match:** Both; Opus FRG-093; Codex web-lib-projections-uncertainty-buildgoalieuncertainty, web-lib-projections-uncertainty-samplegoalieshotcounts
- **Purpose:** Quantiles for shots against, goals allowed and saves
- **Where:** `web/lib/projections/uncertainty.ts:600 (buildGoalieUncertainty)`; `web/lib/projections/uncertainty.ts:591 (sampleGoalieShotCounts)`; `web/lib/projections/uncertainty.ts:600 buildGoalieUncertainty`; `web/lib/projections/uncertainty.ts:591 sampleGoalieShotCounts`
- **Tags (heuristic):** generation: development, current
- **Opus view (FRG-093):**
  - Method: 400 samples; scenario drawn by starter probability (plus residual mass). Shots ~ NB(alpha('sa','G')) or Poisson; GA ~ Poisson(GA mean x drawn/expected shots), or Binomial(shots, GA/SA) when jointGoalieCounts; saves = shots - GA.
  - Inputs/units: counts; sources: —
  - Output scale: count quantiles; writes: forge_goalie_projections.uncertainty
  - Status: live (Poisson GA path); joint path draft
  - Consumers: accuracy coverage gates (0.72-0.90)
- **Codex view (web-lib-projections-uncertainty-buildgoalieuncertainty, calculation, location; Codex family 'FORGE staged projection math'):** Goalie horizon predictive quantiles (buildGoalieUncertainty)
  - Purpose: Mixture scenario, Poisson or NB shots; legacy Poisson GA or optional conditional-binomial GA; saves=max(0,shots-GA); aggregate seeded draws.
  - Inputs/units: SA/GA/SV means; scenario weights; horizon; count options.
  - Output scale: SA,GA,SV p10/p50/p90; optional goalie-shots-binomial-ga-v1 identity.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": ["goalie-shots-binomial-ga-v1"], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (web-lib-projections-uncertainty-samplegoalieshotcounts, calculation, location; Codex family 'FORGE staged projection math'):** Coherent conditional goalie count sample (sampleGoalieShotCounts)
  - Purpose: Sample goals given integer shots and goals-per-shot probability; saves=shots-goals.
  - Inputs/units: Shots count, per-shot goal probability, RNG.
  - Output scale: Integer GA and SV, coherent with SA.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": ["goalie-shots-binomial-ga-v1"], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): uncertainty.ts:579-590, 712-722 comments
  - Intended contract (Codex web-lib-projections-uncertainty-buildgoalieuncertainty): {"source": "web/lib/projections/uncertainty.ts:600", "explicit_comment": "web/lib/projections/uncertainty.ts:620 Existing projection means are rounded to three decimal places.", "arithmetic_locations": ["web/lib/projections/uncertainty.ts:634 shots_against: poissonQuantilesApprox(u.shotsAgainst * totalScalar),", "web/lib/projections/uncertainty.ts:635 goals_allowed: poissonQuantilesApprox(u.goalsAllowed * totalScalar),", "web/lib/projections/uncertainty.ts:636 saves: poissonQuantilesApprox(u.saves * totalScalar)", "web/lib/projections/uncertainty.ts:670 weight: s.weight / mixtureWeightTotal", "web/lib/projections/uncertainty.ts:698 const shotsMean = scenarioShots * scalar;", "web/lib/projections/uncertainty.ts:707 const baseShotsScaled = scenarioShots * scalar;", "web/lib/projections/uncertainty.ts:710 ? scenarioGoals * scalar * (shots / baseShotsScaled)", "web/lib/projections/uncertainty.ts:711 : scenarioGoals * scalar;"]}
  - Intended contract (Codex web-lib-projections-uncertainty-samplegoalieshotcounts): {"source": "web/lib/projections/uncertainty.ts:591", "explicit_comment": "Conditional shot accounting. Kept separate so final draws can be independently validated.", "arithmetic_locations": []}
  - External references: Binomial GA\|SA; NB shots
  - Fixtures/test data: none listed
  - Tests: `web/lib/projections/uncertainty.test.ts`; `{"status": "Discovered only; not run", "references": ["web/lib/projections/uncertainty.test.ts:12"]}`; `{"status": "Discovered only; not run", "references": ["web/lib/projections/uncertainty.test.ts:4"]}`
- **Leads (not audited):**
  - (opus) observation: joint binomial path (goalie-shots-binomial-ga-v1) is opt-in and not passed by goalie-stage; live path draws GA Poisson
  - (codex:web-lib-projections-uncertainty-buildgoalieuncertainty) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested."]
  - (codex:web-lib-projections-uncertainty-samplegoalieshotcounts) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested."]

## M-FRG-069 FORGE count dispersion fit (NB2 method of moments) and holdout scoring

- **Match:** Both; Opus FRG-094; Codex research-script-fitQuadraticLinear-fit-forge-dispersion, research-script-scoreCells-fit-forge-dispersion
- **Purpose:** Fit Var = mu + a*mu^2 + b*mu overdispersion for SOG/hits/blocks/G/A/saves and score on 2025-26 holdout
- **Where:** `web/scripts/fit-forge-dispersion.ts:35 (FIT_SQL)`; `web/scripts/fit-forge-dispersion.ts:78 (HOLDOUT_SQL)`; `web/scripts/fit-forge-dispersion.ts:177 (fitQuadraticLinear)`; `web/scripts/fit-forge-dispersion.ts:210 (scoreCells)`; `web/scripts/fit-forge-dispersion.ts:251 (runFit)`; `web/scripts/fit-forge-dispersion.ts:177 fitQuadraticLinear`; `web/scripts/fit-forge-dispersion.ts:210 scoreCells`
- **Tags (heuristic):** conditionality: unconditional; denominators: per game; generation: research, development, current
- **Opus view (FRG-094):**
  - Method: fit seasons 2023-24 & 2024-25, date Oct 1-Apr 30, games_played=1, player-seasons with >=20 games; within player-season moments binned by mean; unconditional nu=sum n(s^2-m), du=sum n(m^2 - s^2/n); TOI-conditional mu_g = player-season count per second * game TOI; NNLS through origin of (Var-mu) on mu^2 and mu (fallback single-term by SSE); holdout = 2025-26 games, predictive mean = player's prior up-to-40-game mean (>=10 prior games, crosses seasons), 20 ntile bins of mu by stat/pos; score with lib countPmf: mean negative log score, ranked probability score, randomized PIT 10-bin total variation
  - Inputs/units: per-game counts; TOI seconds (toi_per_game, time_on_ice); sources: wgo_skater_stats, wgo_goalie_stats (via saved SQL output JSON)
  - Output scale: dispersion coefficients a (per mu^2) and b (per mu); scores; writes: --json file only (constants then hand-copied to lib/projections/dispersion FORGE_DISPERSION)
  - Status: draft — offline fitter; results live in FORGE_DISPERSION constants
  - Consumers: lib/projections/dispersion.ts FORGE_DISPERSION; lib/projections/uncertainty countPmf
- **Codex view (research-script-fitQuadraticLinear-fit-forge-dispersion, calculation, location; Codex family 'Projection fitting and backtest scripts'):** Nonnegative quadratic-linear dispersion fit
  - Purpose: Solve 2-variable least squares Var-mu=a*mu²+b*mu; if unconstrained pair negative/infeasible, choose best nonnegative one-axis fit.
  - Inputs/units: Frozen model/projection rows, official labels, rates or exposures per declaration; evaluation units follow target.
  - Output scale: Diagnostic/model quantities returned by named function; see formula evidence.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "deployment": "Unknown; source inspection only."}
- **Codex view (research-script-scoreCells-fit-forge-dispersion, calculation, location; Codex family 'Projection fitting and backtest scripts'):** Count likelihood/RPS/PIT diagnostics
  - Purpose: Mean negative log mass; ranked probability score sum_k(F(k)-1[y≤k])²; randomized-PIT bin mass and TV from uniform.
  - Inputs/units: Frozen model/projection rows, official labels, rates or exposures per declaration; evaluation units follow target.
  - Output scale: Diagnostic/model quantities returned by named function; see formula evidence.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "deployment": "Unknown; source inspection only."}
- **Audit context:**
  - Intent (Opus): header comment web/scripts/fit-forge-dispersion.ts:1-24 (tasks 8.1/8.2)
  - Intended contract (Codex research-script-fitQuadraticLinear-fit-forge-dispersion): {"source": "web/scripts/fit-forge-dispersion.ts:177", "arithmetic_locations": ["web/scripts/fit-forge-dispersion.ts:180 x1x1: acc.x1x1 + r.x1 * r.x1,", "web/scripts/fit-forge-dispersion.ts:181 x2x2: acc.x2x2 + r.x2 * r.x2,", "web/scripts/fit-forge-dispersion.ts:182 x1x2: acc.x1x2 + r.x1 * r.x2,", "web/scripts/fit-forge-dispersion.ts:183 x1y: acc.x1y + r.x1 * r.y,", "web/scripts/fit-forge-dispersion.ts:184 x2y: acc.x2y + r.x2 * r.y", "web/scripts/fit-forge-dispersion.ts:188 const det = s.x1x1 * s.x2x2 - s.x1x2 * s.x1x2;"]}
  - Intended contract (Codex research-script-scoreCells-fit-forge-dispersion): {"source": "web/scripts/fit-forge-dispersion.ts:210", "arithmetic_locations": ["web/scripts/fit-forge-dispersion.ts:226 logScore -= c * Math.log(px);", "web/scripts/fit-forge-dispersion.ts:228 for (let k = 0; k < Math.max(cdf.length, x + 1); k += 1) r += (F(k) - (x <= k ? 1 : 0)) ** 2;", "web/scripts/fit-forge-dispersion.ts:229 rps += c * r;", "web/scripts/fit-forge-dispersion.ts:233 const overlap = Math.max(0, Math.min(hi, (j + 1) / 10) - Math.max(lo, j / 10));", "web/scripts/fit-forge-dispersion.ts:234 pit[j] += hi > lo ? (c * overlap) / (hi - lo) : j === Math.min(9, Math.floor(lo * 10)) ? c : 0;", "web/scripts/fit-forge-dispersion.ts:238 const freq = pit.map((v) => v / n);"]}
  - External references: negative binomial (NB2) overdispersion; RPS and PIT for count forecasts
  - Fixtures/test data: none listed
  - Tests: `web/lib/projections/dispersion.test.ts`; `{"status": "Discovered; not run", "references": ["No dedicated test linkage resolved in this bounded pass."]}`
- **Leads (not audited):**
  - (opus) regular season approximated by date window Oct 1-Apr 30 rather than game type
  - (opus) holdout prior-40 window not partitioned by season, so early-season predictions use prior-season games
  - (codex:research-script-fitQuadraticLinear-fit-forge-dispersion) ["Deployment and runtime behavior not verified; calculation listed without correctness assessment."]
  - (codex:research-script-scoreCells-fit-forge-dispersion) ["Deployment and runtime behavior not verified; calculation listed without correctness assessment."]

## M-FRG-070 FORGE v2 evaluation scoring (CRPS, log score, interval score, block bootstrap)

- **Match:** Both; Opus FRG-095; Codex web-lib-forge-v2-horizonevaluation-evaluatehorizon, web-lib-forge-v2-horizonevaluation-pairedcalendarblocks, web-lib-forge-v2-horizonevaluation-participationmixturemoments, web-lib-forge-v2-horizonevaluation-scoredistribution
- **Possible related records (low-confidence location link, unconfirmed):** web-lib-forge-v2-evaluation-errors, web-lib-forge-v2-evaluation-summarizeaccountability
- **Purpose:** Score frozen forecasts and summarise accountability
- **Where:** `web/lib/forge-v2/horizonEvaluation.ts:146 (scoreDistribution)`; `web/lib/forge-v2/horizonEvaluation.ts:134 (participationMixtureMoments)`; `web/lib/forge-v2/horizonEvaluation.ts:182 (evaluateHorizon)`; `web/lib/forge-v2/horizonEvaluation.ts:295 (pairedCalendarBlocks)`; `web/lib/forge-v2/evaluation.ts:183 (errors)`; `web/lib/forge-v2/evaluation.ts:186 (summarizeAccountability)`; `web/lib/forge-v2/horizonEvaluation.ts:182 evaluateHorizon`; `web/lib/forge-v2/horizonEvaluation.ts:295 pairedCalendarBlocks`; `web/lib/forge-v2/horizonEvaluation.ts:134 participationMixtureMoments`; `web/lib/forge-v2/horizonEvaluation.ts:146 scoreDistribution`
- **Tags (heuristic):** conditionality: unconditional; generation: development, current
- **Opus view (FRG-095):**
  - Method: CRPS = E\|X-y\| - 0.5E\|X-X'\| via sorted pairwise sum; log score -ln P(actual) for counts; interval score = width + 2/alpha*miss; Brier, log loss, 10-bin reliability; MAE/MSE/RMSE/bias; mixture moments mean=p*mu, var=p*v+p(1-p)mu^2; SV% and GAA as ratio of expected counts; paired block bootstrap (LCG seed) 95% CI of score differences with blocks >= max target span.
  - Inputs/units: counts; probabilities; sources: —
  - Output scale: proper scores; writes: —
  - Status: draft — scripts/forge-horizon-evaluate.ts
  - Consumers: forge-horizon-evaluate script; accountability API
- **Codex view (web-lib-forge-v2-horizonevaluation-evaluatehorizon, symbol_candidate, codex_part_of_opus; Codex family 'FORGE v2 development kernel and ledger'):** Evaluate horizon (evaluateHorizon)
  - Purpose: Evaluate horizon for forge v2 development kernel and ledger. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: export function evaluateHorizon(frozen: FrozenForecast, label: HorizonLabel, asOf: string) { validateFrozenForecast(frozen); const f = frozen.forecast, window = f.windows.find(w => w.horizon === label.horizon); if (!window \|\| label.playerId !== f.playerId \|\| label.endAt !== window.endAt) throw new Error("Label target/window mismatch"); const missing = (reason: string) => ({ state: "unavailable" as const, reason, horizon: label.horizon }); if (window.originGameIds.length !== window.horizon) return missing("incomplete_origin_schedule"); if (!label.coverageComplete) return missing("incomplete_outcome_coverage"); if (instant(label.coverageAvailableAt) <= instant(window.endAt) \|\| instant(label.coverageAvailableAt) > instant(asOf)) return missing("immat…
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": ["forge-frozen-calendar-evaluation-v1"], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (web-lib-forge-v2-horizonevaluation-pairedcalendarblocks, calculation, codex_part_of_opus; Codex family 'FORGE v2 development kernel and ledger'):** Paired calendar-block CRPS improvement (pairedCalendarBlocks)
  - Purpose: Bootstrap entire origin-calendar blocks; improvement=baseline CRPS-candidate CRPS; empirical 2.5/97.5 percentiles.
  - Inputs/units: Named model/observation inputs at cited declaration; Mean improvement and approximate 95% interval; blocks must span longest target window. Input count/rate units follow the corresponding named outcome; cutoff timestamps and identity are required where declared.
  - Output scale: Mean improvement and approximate 95% interval; blocks must span longest target window.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": ["forge-frozen-calendar-evaluation-v1"], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (web-lib-forge-v2-horizonevaluation-participationmixturemoments, calculation, codex_part_of_opus; Codex family 'FORGE v2 development kernel and ledger'):** Participation-mixture moments (participationMixtureMoments)
  - Purpose: E[X]=pμ; Var[X]=pσ²+p(1-p)μ².
  - Inputs/units: Named model/observation inputs at cited declaration; Unconditional mean and variance in category units / squared units. Input count/rate units follow the corresponding named outcome; cutoff timestamps and identity are required where declared.
  - Output scale: Unconditional mean and variance in category units / squared units.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": ["forge-frozen-calendar-evaluation-v1"], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (web-lib-forge-v2-horizonevaluation-scoredistribution, calculation, codex_part_of_opus; Codex family 'FORGE v2 development kernel and ledger'):** Empirical predictive-distribution scores (scoreDistribution)
  - Purpose: Weighted mean/variance, absolute and squared error, CRPS=E\|X-y\|-0.5E\|X-X′\|, count negative log mass, equal-tail interval score.
  - Inputs/units: Named model/observation inputs at cited declaration; CRPS/error in target units, squared error/variance in squared units; log score; 50/80/95% intervals. Input count/rate units follow the corresponding named outcome; cutoff timestamps and identity are required where declared.
  - Output scale: CRPS/error in target units, squared error/variance in squared units; log score; 50/80/95% intervals.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": ["forge-frozen-calendar-evaluation-v1"], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): horizonEvaluation.ts:5 version; evaluation.ts
  - Intended contract (Codex web-lib-forge-v2-horizonevaluation-evaluatehorizon): {"source": "web/lib/forge-v2/horizonEvaluation.ts:182", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["web/lib/forge-v2/horizonEvaluation.ts:212 const values = valid.map(s => ({ value: s.values[key]!, probability: s.probability / mass }));", "web/lib/forge-v2/horizonEvaluation.ts:215 const denominatorMean = samples.reduce((sum, s) => sum + s.probability * (s.values[denominator] ?? 0), 0);", "web/lib/forge-v2/horizonEvaluation.ts:216 const numeratorMean = samples.reduce((sum, s) => sum + s.probability * (s.values[numerator!] ?? 0), 0);", "web/lib/forge-v2/horizonEvaluation.ts:218 noExposureBrier: pZero === null \|\| actual[denominator] === null ? null : (pZero - Number(actual[denominator] === 0)) ** 2,", "web/lib/forge-v2/horizonEvaluation.ts:219 expectedRealized: missingInput \|\| !mass ? null : values.reduce((sum, s) => sum + s.probability * s.value, 0),", "web/lib/forge-v2/horizonEvaluation.ts:220 ratioOfExpectedCounts: missingInput \|\| denominatorMean === 0 ? null : (key === \"GAA\" ? 60 : 1) * numeratorMean / denominatorMean };", "web/lib/forge-v2/horizonEvaluation.ts:226 const probability = samples.reduc…
  - Intended contract (Codex web-lib-forge-v2-horizonevaluation-pairedcalendarblocks): {"source": "web/lib/forge-v2/horizonEvaluation.ts:295", "explicit_comment": "Paired calendar-block bootstrap; every player at an origin stays in the same block. Block length must cover the longest actual frozen target span. This remains an approximate dependence diagnostic; report block-length sensitivity and do not interpret tiny block counts.", "arithmetic_locations": ["web/lib/forge-v2/horizonEvaluation.ts:299 .filter(window => window.horizon === horizon).map(window => (instant(window.endAt) - instant(entry.candidate.forecast.issuedAt)) / dayMs)));", "web/lib/forge-v2/horizonEvaluation.ts:312 const key = Math.floor((instant(report.issuedAt) - origin) / (dayMs * blockDays));", "web/lib/forge-v2/horizonEvaluation.ts:316 const improvement = count ? blocks.flat().reduce((sum, value) => sum + value, 0) / count : null;", "web/lib/forge-v2/horizonEvaluation.ts:321 const draw = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };", "web/lib/forge-v2/horizonEvaluation.ts:324 for (let i = 0; i < blocks.length; i++) { const block = blocks[Math.floor(draw() * blocks.length)]; sum += block.reduce((a, b) => a + b, 0); n += block.length; }", "web/lib/f…
  - Intended contract (Codex web-lib-forge-v2-horizonevaluation-participationmixturemoments): {"source": "web/lib/forge-v2/horizonEvaluation.ts:134", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["web/lib/forge-v2/horizonEvaluation.ts:136 return { mean: p * conditionalMean, variance: p * conditionalVariance + p * (1 - p) * conditionalMean ** 2 };"]}
  - Intended contract (Codex web-lib-forge-v2-horizonevaluation-scoredistribution): {"source": "web/lib/forge-v2/horizonEvaluation.ts:146", "explicit_comment": "CRPS of the FINAL empirical distribution, including all structural zero mass.", "arithmetic_locations": ["web/lib/forge-v2/horizonEvaluation.ts:152 const mean = rows.reduce((sum, row) => sum + row.probability * row.value, 0);", "web/lib/forge-v2/horizonEvaluation.ts:155 halfPairDistance += row.probability * (row.value * cumulativeMass - cumulativeValue);", "web/lib/forge-v2/horizonEvaluation.ts:156 cumulativeMass += row.probability; cumulativeValue += row.probability * row.value;", "web/lib/forge-v2/horizonEvaluation.ts:159 return { mean, variance: rows.reduce((sum, row) => sum + row.probability * (row.value - mean) ** 2, 0),", "web/lib/forge-v2/horizonEvaluation.ts:160 absoluteError: Math.abs(mean - actual), squaredError: (mean - actual) ** 2,", "web/lib/forge-v2/horizonEvaluation.ts:161 crps: Math.max(0, rows.reduce((sum, row) => sum + row.probability * Math.abs(row.value - actual), 0) - halfPairDistance),", "web/lib/forge-v2/horizonEvaluation.ts:162 logScore: count && actualMass > 0 ? -Math.log(actualMass) : null,", "web/lib/forge-v2/horizonEvaluation.ts:165 const lower = quantile(rows, (1 - level) / 2…
  - External references: CRPS (Gneiting & Raftery 2007); interval score; Brier; block bootstrap
  - Fixtures/test data: `web/lib/forge-v2/horizonEvaluation.fixtures.ts`
  - Tests: `web/lib/forge-v2/evaluation.test.ts`; `web/lib/forge-v2/horizonEvaluation.test.ts`; `{"status": "Discovered only; not run", "references": ["web/lib/forge-v2/horizonEvaluation.test.ts:2"]}`; `{"status": "Discovered only; not run", "references": ["web/lib/forge-v2/horizonEvaluation.test.ts:3"]}`
- **Leads (not audited):**
  - (codex:web-lib-forge-v2-horizonevaluation-evaluatehorizon) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:web-lib-forge-v2-horizonevaluation-pairedcalendarblocks) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested."]
  - (codex:web-lib-forge-v2-horizonevaluation-participationmixturemoments) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested."]
  - (codex:web-lib-forge-v2-horizonevaluation-scoredistribution) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested."]

## M-FRG-071 FORGE v2 kernel-means model and participation

- **Match:** Both; Opus FRG-096; Codex forge-v2-head-a, forge-v2-head-blk, forge-v2-head-g, forge-v2-head-hit, forge-v2-head-pim, forge-v2-head-ppp, forge-v2-head-sog, web-lib-forge-v2-model-buildbaselines, web-lib-forge-v2-model-fitcandidate, web-lib-forge-v2-model-predictconditional, web-lib-forge-v2-model-predictrecipe
- **Possible related records (low-confidence location link, unconfirmed):** web-lib-forge-v2-participation-fitparticipation, web-lib-forge-v2-participation-rawprobability
- **Purpose:** Gaussian-kernel weighted means of per-appearance category counts and calibrated appearance probability
- **Where:** `web/lib/forge-v2/model.ts:106 (predictRecipe)`; `web/lib/forge-v2/model.ts:140 (fitCandidate)`; `web/lib/forge-v2/model.ts:161 (buildBaselines)`; `web/lib/forge-v2/participation.ts:22 (rawProbability)`; `web/lib/forge-v2/participation.ts:45 (fitParticipation)`; `web/lib/forge-v2/model.ts:106 predictRecipe`; `web/lib/forge-v2/model.ts:161 buildBaselines`; `web/lib/forge-v2/model.ts:140 fitCandidate`; `web/lib/forge-v2/model.ts:135 predictConditional`
- **Tags (heuristic):** percent scale: fraction 0-1; conditionality: conditional; denominators: per appearance, shots on goal; generation: research, development, current
- **Opus view (FRG-096):**
  - Method: weight = exp(-sum(((x_i - x_ctx)/bandwidth)^2)/2); category mean = weighted mean over examples with available values; PPP capped at G+A. Recipe selected by development MSE over predeclared recipes; time-partitioned train/development/calibration. Baselines: last-5 mean and season mean. Participation: kernel-weighted appearance rate, calibrated by binning raw probabilities (binCount, minimumBinSupport) on the calibration split.
  - Inputs/units: counts per appearance; feature units as supplied; sources: forge-v2 prepared artifacts (preparation.server.ts)
  - Output scale: counts per appearance; probability 0-1; writes: forge-v2 artifacts
  - Status: draft — research pipeline (pipeline.server.ts), qualification-gated
  - Consumers: ForgeV2 ForecastExplorer; /api forge v2
- **Codex view (forge-v2-head-a, calculation, codex_part_of_opus; Codex family 'FORGE v2 conditional head'):** A conditional mean
  - Purpose: Category-specific Gaussian-kernel weighted official-appearance outcome mean; category support required. PPP additionally constrained by G+A.
  - Inputs/units: Admissible historical A counts; context features, bandwidth, minimum support.
  - Output scale: Expected count per official appearance; unavailable not imputed zero.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "deployment": "Unknown; source inspection only."}
- **Codex view (forge-v2-head-blk, calculation, codex_part_of_opus; Codex family 'FORGE v2 conditional head'):** BLK conditional mean
  - Purpose: Category-specific Gaussian-kernel weighted official-appearance outcome mean; category support required. PPP additionally constrained by G+A.
  - Inputs/units: Admissible historical BLK counts; context features, bandwidth, minimum support.
  - Output scale: Expected count per official appearance; unavailable not imputed zero.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "deployment": "Unknown; source inspection only."}
- **Codex view (forge-v2-head-g, calculation, codex_part_of_opus; Codex family 'FORGE v2 conditional head'):** G conditional mean
  - Purpose: Category-specific Gaussian-kernel weighted official-appearance outcome mean; category support required. PPP additionally constrained by G+A.
  - Inputs/units: Admissible historical G counts; context features, bandwidth, minimum support.
  - Output scale: Expected count per official appearance; unavailable not imputed zero.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "deployment": "Unknown; source inspection only."}
- **Codex view (forge-v2-head-hit, calculation, codex_part_of_opus; Codex family 'FORGE v2 conditional head'):** HIT conditional mean
  - Purpose: Category-specific Gaussian-kernel weighted official-appearance outcome mean; category support required. PPP additionally constrained by G+A.
  - Inputs/units: Admissible historical HIT counts; context features, bandwidth, minimum support.
  - Output scale: Expected count per official appearance; unavailable not imputed zero.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "deployment": "Unknown; source inspection only."}
- **Codex view (forge-v2-head-pim, calculation, codex_part_of_opus; Codex family 'FORGE v2 conditional head'):** PIM conditional mean
  - Purpose: Category-specific Gaussian-kernel weighted official-appearance outcome mean; category support required. PPP additionally constrained by G+A.
  - Inputs/units: Admissible historical PIM counts; context features, bandwidth, minimum support.
  - Output scale: Expected penalty minutes per official appearance; unavailable not imputed zero.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "deployment": "Unknown; source inspection only."}
- **Codex view (forge-v2-head-ppp, calculation, codex_part_of_opus; Codex family 'FORGE v2 conditional head'):** PPP conditional mean
  - Purpose: Category-specific Gaussian-kernel weighted official-appearance outcome mean; category support required. PPP additionally constrained by G+A.
  - Inputs/units: Admissible historical PPP counts; context features, bandwidth, minimum support.
  - Output scale: Expected count per official appearance; unavailable not imputed zero.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "deployment": "Unknown; source inspection only."}
- **Codex view (forge-v2-head-sog, calculation, codex_part_of_opus; Codex family 'FORGE v2 conditional head'):** SOG conditional mean
  - Purpose: Category-specific Gaussian-kernel weighted official-appearance outcome mean; category support required. PPP additionally constrained by G+A.
  - Inputs/units: Admissible historical SOG counts; context features, bandwidth, minimum support.
  - Output scale: Expected count per official appearance; unavailable not imputed zero.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "deployment": "Unknown; source inspection only."}
- **Codex view (web-lib-forge-v2-model-buildbaselines, symbol_candidate, codex_part_of_opus; Codex family 'FORGE v2 development kernel and ledger'):** Build baselines (buildBaselines)
  - Purpose: Build baselines for forge v2 development kernel and ledger. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: export function buildBaselines(history: ModelExample[], context: ModelContext): { lastFive: CategoryMeans; seasonRate: CategoryMeans; appearances: number } { assertTarget(context); instant(context.inputCutoffAt); const rows = history.filter(r => r.playerId === context.playerId && r.gameId !== context.gameId && r.appearance === "official_appearance" && instant(r.outcomeAvailableAt) < instant(context.inputCutoffAt)); rows.forEach(validateExample); if (new Set(rows.map(targetKey)).size !== rows.length) throw new Error("Baseline requires one settled revision per target"); rows.sort((a, b) => instant(b.gameStartAt) - instant(a.gameStartAt) \|\| a.gameId - b.gameId); const average = (selected: ModelExample[], required: number): CategoryMeans => Object.fromEnt…
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": ["official-appearance-kernel-means-v1"], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (web-lib-forge-v2-model-fitcandidate, calculation, codex_part_of_opus; Codex family 'FORGE v2 development kernel and ledger'):** Registered recipe selection (fitCandidate)
  - Purpose: Choose minimum development fantasy-point MSE among predeclared recipes with complete matched support.
  - Inputs/units: Named model/observation inputs at cited declaration; Selected development-only model and recipe trial MSE/paired/requested counts. Input count/rate units follow the corresponding named outcome; cutoff timestamps and identity are required where declared.
  - Output scale: Selected development-only model and recipe trial MSE/paired/requested counts.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": ["official-appearance-kernel-means-v1"], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (web-lib-forge-v2-model-predictconditional, symbol_candidate, codex_part_of_opus; Codex family 'FORGE v2 development kernel and ledger'):** Predict conditional (predictConditional)
  - Purpose: Fitted-model inference enforces availability of selection and all fitted dependencies.
  - Inputs/units: Parameter/type declaration excerpt: export function predictConditional(model: CandidateModel, context: ModelContext): ReturnType<typeof predictRecipe> { if (!modelAvailableAtCutoff(model, context.inputCutoffAt) \|\| model.training.some(row => instant(row.outcomeAvailableAt) > instant(model.dependencyAvailableAt))) return { means: emptyMeans("model_not_available_at_cutoff"), support: Object.fromEntries(CATEGORIES.map(c => [c, 0])) as Categories<number>, limitations: [...context.limitations, "model_not_available_at_cutoff"] }; return predictRecipe(model, context); }
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": ["official-appearance-kernel-means-v1"], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (web-lib-forge-v2-model-predictrecipe, calculation, location; Codex family 'FORGE v2 development kernel and ledger'):** Kernel conditional category means (predictRecipe)
  - Purpose: Gaussian kernel weights exp(-0.5 sum(((training feature-context feature)/bandwidth)^2)); weighted category means over admissible official appearances. PPP capped at G+A.
  - Inputs/units: Named model/observation inputs at cited declaration; G,A,PPP,SOG,HIT,BLK,PIM: nonnegative counts per official appearance; category support counts. Input count/rate units follow the corresponding named outcome; cutoff timestamps and identity are required where declared.
  - Output scale: G,A,PPP,SOG,HIT,BLK,PIM: nonnegative counts per official appearance; category support counts.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": ["official-appearance-kernel-means-v1"], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): model.ts:5 MODEL_ALGORITHM; contracts.ts
  - Intended contract (Codex forge-v2-head-a): {"source": "web/lib/forge-v2/model.ts:106", "statement": "Category-specific Gaussian-kernel weighted official-appearance outcome mean; category support required. PPP additionally constrained by G+A."}
  - Intended contract (Codex forge-v2-head-blk): {"source": "web/lib/forge-v2/model.ts:106", "statement": "Category-specific Gaussian-kernel weighted official-appearance outcome mean; category support required. PPP additionally constrained by G+A."}
  - Intended contract (Codex forge-v2-head-g): {"source": "web/lib/forge-v2/model.ts:106", "statement": "Category-specific Gaussian-kernel weighted official-appearance outcome mean; category support required. PPP additionally constrained by G+A."}
  - Intended contract (Codex forge-v2-head-hit): {"source": "web/lib/forge-v2/model.ts:106", "statement": "Category-specific Gaussian-kernel weighted official-appearance outcome mean; category support required. PPP additionally constrained by G+A."}
  - Intended contract (Codex forge-v2-head-pim): {"source": "web/lib/forge-v2/model.ts:106", "statement": "Category-specific Gaussian-kernel weighted official-appearance outcome mean; category support required. PPP additionally constrained by G+A."}
  - Intended contract (Codex forge-v2-head-ppp): {"source": "web/lib/forge-v2/model.ts:106", "statement": "Category-specific Gaussian-kernel weighted official-appearance outcome mean; category support required. PPP additionally constrained by G+A."}
  - Intended contract (Codex forge-v2-head-sog): {"source": "web/lib/forge-v2/model.ts:106", "statement": "Category-specific Gaussian-kernel weighted official-appearance outcome mean; category support required. PPP additionally constrained by G+A."}
  - Intended contract (Codex web-lib-forge-v2-model-buildbaselines): {"source": "web/lib/forge-v2/model.ts:161", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["web/lib/forge-v2/model.ts:170 return [category, available(selected.reduce((sum, r) => sum + (r.values[category] as { value: number }).value, 0) / selected.length)];"]}
  - Intended contract (Codex web-lib-forge-v2-model-fitcandidate): {"source": "web/lib/forge-v2/model.ts:140", "explicit_comment": "web/lib/forge-v2/model.ts:148 Every recipe was frozen before these cutoffs. Replay scores recipe arithmetic;", "arithmetic_locations": ["web/lib/forge-v2/model.ts:152 const mse = usable.length ? available(usable.reduce((sum, p) => sum + ((p.actual as { value: number }).value - (p.predicted as { value: number }).value) ** 2, 0) / usable.length) : unavailable(\"no_paired_development_support\");"]}
  - Intended contract (Codex web-lib-forge-v2-model-predictconditional): {"source": "web/lib/forge-v2/model.ts:135", "explicit_comment": "Fitted-model inference enforces availability of selection and all fitted dependencies.", "arithmetic_locations": []}
  - Intended contract (Codex web-lib-forge-v2-model-predictrecipe): {"source": "web/lib/forge-v2/model.ts:106", "explicit_comment": "Arithmetic for predeclared recipe replay; it is not an as-issued fitted model.", "arithmetic_locations": ["web/lib/forge-v2/model.ts:118 const weighted = eligible.map(row => ({ row, weight: Math.exp(-names.reduce((sum, name) => sum + (((row.features[name] as { value: number }).value - (context.features[name] as { value: number }).value) / model.recipe.bandwidth) ** 2, 0) / 2) })).filter(row => row.weight > 0);", "web/lib/forge-v2/model.ts:124 return [category, available(usable.reduce((sum, r) => sum + r.weight * (r.row.values[category] as { value: number }).value, 0) / mass)];", "web/lib/forge-v2/model.ts:134 /** Fitted-model inference enforces availability of selection and all fitted dependencies. */"]}
  - External references: Nadaraya-Watson kernel regression; histogram calibration
  - Fixtures/test data: `web/lib/forge-v2/fixtures.ts`
  - Tests: `web/lib/forge-v2/lifecycle.test.ts`; `web/lib/forge-v2/model.test.ts`; `{"status": "Discovered only; not run", "references": ["web/lib/forge-v2/lifecycle.test.ts:13", "web/lib/forge-v2/model.test.ts:4", "web/lib/forge-v2/pipeline.test.ts:13"]}`; `{"status": "Discovered only; not run", "references": ["web/lib/forge-v2/lifecycle.test.ts:13", "web/lib/forge-v2/model.test.ts:4"]}`; `{"status": "Discovered only; not run", "references": ["web/lib/forge-v2/model.test.ts (module test)"]}`; `{"status": "Discovered only; not run", "references": ["web/lib/forge-v2/model.test.ts:4"]}`; `{"status": "Discovered; not run", "references": ["web/lib/forge-v2/model.test.ts"]}`
- **Leads (not audited):**
  - (opus) observation: single global bandwidth across unscaled features
  - (codex:forge-v2-head-a) ["Deployment and runtime behavior not verified; calculation listed without correctness assessment."]
  - (codex:forge-v2-head-blk) ["Deployment and runtime behavior not verified; calculation listed without correctness assessment."]
  - (codex:forge-v2-head-g) ["Deployment and runtime behavior not verified; calculation listed without correctness assessment."]
  - (codex:forge-v2-head-hit) ["Deployment and runtime behavior not verified; calculation listed without correctness assessment."]
  - (codex:forge-v2-head-pim) ["Deployment and runtime behavior not verified; calculation listed without correctness assessment."]
  - (codex:forge-v2-head-ppp) ["Deployment and runtime behavior not verified; calculation listed without correctness assessment."]
  - (codex:forge-v2-head-sog) ["Deployment and runtime behavior not verified; calculation listed without correctness assessment."]
  - (codex:web-lib-forge-v2-model-buildbaselines) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:web-lib-forge-v2-model-fitcandidate) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested."]
  - (codex:web-lib-forge-v2-model-predictconditional) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:web-lib-forge-v2-model-predictrecipe) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested."]

## M-FRG-072 FORGE v2 research baselines (half-life pooled rates)

- **Match:** Both; Opus FRG-097; Codex web-lib-forge-v2-researchbaselines-buildpriorbaselines
- **Purpose:** Transparent B0/B1/B2 point baselines with exponential decay and pooled prior
- **Where:** `web/lib/forge-v2/researchBaselines.ts:41 (buildPriorBaselines)`; `web/lib/forge-v2/researchBaselines.ts:41 buildPriorBaselines`
- **Tags (heuristic):** conditionality: unconditional; denominators: per appearance, shots on goal; generation: development, current
- **Opus view (FRG-097):**
  - Method: w = 1 (B0) or 2^(-age/halfLife). Rate = (own weighted events + prior*pool mean)/(own weighted exposure + prior); expected = rate x expected games or minutes (W/SO per appearance).
  - Inputs/units: counts; minutes; sources: —
  - Output scale: counts per horizon; writes: —
  - Status: draft
  - Consumers: forge-v2 comparisons
- **Codex view (web-lib-forge-v2-researchbaselines-buildpriorbaselines, calculation, location; Codex family 'FORGE v2 development kernel and ledger'):** Prior-only B0/B1/B2 reference forecasts (buildPriorBaselines)
  - Purpose: Construct transparent prior-only point baselines from appearance/strength-rate histories and fixed independently supplied exposure; no fitted public qualification claim.
  - Inputs/units: Prior regular-season counts and minutes, cutoff-safe pins, expected games and unconditional expected minutes by strength.
  - Output scale: Skater G/A/PPP/SOG/HIT/BLK/PIM or goalie SV/GA/SA/W/SO projected counts; exposure held fixed across baselines.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": ["forge-prior-only-baselines-v1"], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): researchBaselines.ts:5,23 comments
  - Intended contract (Codex web-lib-forge-v2-researchbaselines-buildpriorbaselines): {"source": "web/lib/forge-v2/researchBaselines.ts:41", "explicit_comment": "web/lib/forge-v2/researchBaselines.ts:85 Missing population support is unknown. A rookie with no personal rows can use a real pooled prior.", "arithmetic_locations": ["web/lib/forge-v2/researchBaselines.ts:75 const weight = (r: PriorObservation, b: string) => b === \"B0\" ? 1 : 2 ** (-(instant(cutoffAt) - instant(r.gameStartAt)) / (p.halfLifeDays * 86400000));", "web/lib/forge-v2/researchBaselines.ts:82 return { numerator: a.numerator + w * counts[head]!, denominator: a.denominator + w * (strength ? r.strengths[strength]!.minutes! : 1) };", "web/lib/forge-v2/researchBaselines.ts:84 const own = sum(true), pool = sum(false), prior = strength ? p.priorMinutes : p.priorAppearances;", "web/lib/forge-v2/researchBaselines.ts:86 const value = pool.denominator > 0 ? (own.numerator + prior * pool.numerator / pool.denominator) / (own.denominator + prior) : null;", "web/lib/forge-v2/researchBaselines.ts:100 expected[head] = r.value === null \|\| exposure.value.expectedGames === null ? null : r.value * exposure.value.expectedGames;", "web/lib/forge-v2/researchBaselines.ts:108 else if (total !== null) total += r.value *…
  - External references: Marcel-style decay; empirical Bayes pooling
  - Fixtures/test data: none listed
  - Tests: `{"status": "Discovered only; not run", "references": ["web/lib/forge-v2/model.test.ts:9"]}`
- **Leads (not audited):**
  - (codex:web-lib-forge-v2-researchbaselines-buildpriorbaselines) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested."]

## M-FRG-073 FORGE v2 joint distribution and interval calibration

- **Match:** Both; Opus FRG-098; Codex web-lib-forge-v2-uncertainty-fitintervalcalibration, web-lib-forge-v2-uncertainty-predictjoint, web-lib-forge-v2-uncertainty-quantile, web-lib-forge-v2-uncertainty-scorejoint
- **Purpose:** Empirical kernel joint over category outcomes; fantasy-point intervals with conformal-style tail padding
- **Where:** `web/lib/forge-v2/uncertainty.ts:49 (predictJoint)`; `web/lib/forge-v2/uncertainty.ts:84 (scoreJoint)`; `web/lib/forge-v2/uncertainty.ts:101 (fitIntervalCalibration)`; `web/lib/forge-v2/uncertainty.ts:101 fitIntervalCalibration`; `web/lib/forge-v2/uncertainty.ts:49 predictJoint`; `web/lib/forge-v2/uncertainty.ts:76 quantile`; `web/lib/forge-v2/uncertainty.ts:84 scoreJoint`
- **Tags (heuristic):** percent scale: fraction 0-1; generation: development, current
- **Opus view (FRG-098):**
  - Method: Joint = training outcomes with probability weight/mass; FP value = sum(weights x counts); mean and 50%/90% equal-tail intervals via weighted left-CDF quantile. Calibration: rank = ceil((n+1)q); lower/upper padding = rank-th largest under/overshoot (split-conformal style).
  - Inputs/units: counts; sources: —
  - Output scale: fantasy points; interval bounds; writes: —
  - Status: draft
  - Consumers: ForecastExplorer
- **Codex view (web-lib-forge-v2-uncertainty-fitintervalcalibration, calculation, codex_part_of_opus; Codex family 'FORGE v2 development kernel and ledger'):** Finite-sample interval tail padding (fitIntervalCalibration)
  - Purpose: Use ceil((n+1)*(1+level)/2) rank of lower/upper noncoverage residuals, for levels .5 and .9.
  - Inputs/units: Named model/observation inputs at cited declaration; Nonnegative tail padding in fantasy points or unavailable if sparse tail support. Input count/rate units follow the corresponding named outcome; cutoff timestamps and identity are required where declared.
  - Output scale: Nonnegative tail padding in fantasy points or unavailable if sparse tail support.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": ["empirical-kernel-joint-v1", "weighted-joint-counts-v1"], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (web-lib-forge-v2-uncertainty-predictjoint, calculation, location; Codex family 'FORGE v2 development kernel and ledger'):** Empirical joint outcome distribution (predictJoint)
  - Purpose: Gaussian-weight complete observed category vectors and normalize weights, retaining empirical dependence.
  - Inputs/units: Named model/observation inputs at cited declaration; Finite probability mass over integer outcome vectors, sum=1; PPP≤G+A. Input count/rate units follow the corresponding named outcome; cutoff timestamps and identity are required where declared.
  - Output scale: Finite probability mass over integer outcome vectors, sum=1; PPP≤G+A.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": ["empirical-kernel-joint-v1", "weighted-joint-counts-v1"], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (web-lib-forge-v2-uncertainty-quantile, symbol_candidate, codex_part_of_opus; Codex family 'FORGE v2 development kernel and ledger'):** Quantile (quantile)
  - Purpose: Left-continuous inverse CDF convention is pinned, including ties and discrete outcomes.
  - Inputs/units: Parameter/type declaration excerpt: function quantile(rows: Array<{ value: number; probability: number }>, q: number): number { const ordered = [...rows].sort((a, b) => a.value - b.value); let mass = 0; for (const row of ordered) { mass += row.probability; if (mass + 1e-12 >= q) return row.value; } return ordered[ordered.length - 1].value; } /** Arithmetic only: empirical bands are never presented as calibrated without qualification. */
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": ["empirical-kernel-joint-v1", "weighted-joint-counts-v1"], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (web-lib-forge-v2-uncertainty-scorejoint, calculation, location; Codex family 'FORGE v2 development kernel and ledger'):** Joint fantasy distribution and intervals (scoreJoint)
  - Purpose: Linear score every joint outcome; weighted expectation and left-CDF 50%/90% equal-tail bands.
  - Inputs/units: Named model/observation inputs at cited declaration; Fantasy points mean and raw empirical intervals; not automatically calibrated. Input count/rate units follow the corresponding named outcome; cutoff timestamps and identity are required where declared.
  - Output scale: Fantasy points mean and raw empirical intervals; not automatically calibrated.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": ["empirical-kernel-joint-v1", "weighted-joint-counts-v1"], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): uncertainty.ts:7-10 version constants
  - Intended contract (Codex web-lib-forge-v2-uncertainty-fitintervalcalibration): {"source": "web/lib/forge-v2/uncertainty.ts:101", "explicit_comment": "Fits finite-sample tail padding on supplied chronological calibration observations only. No iid/exchangeability or public calibration claim is made by this development artifact.", "arithmetic_locations": ["web/lib/forge-v2/uncertainty.ts:111 const q = (1 + level) / 2;", "web/lib/forge-v2/uncertainty.ts:113 const rank = Math.ceil((rows.length + 1) * q);"]}
  - Intended contract (Codex web-lib-forge-v2-uncertainty-predictjoint): {"source": "web/lib/forge-v2/uncertainty.ts:49", "explicit_comment": "Resample entire observed outcome vectors, preserving their empirical dependence.", "arithmetic_locations": ["web/lib/forge-v2/uncertainty.ts:54 const weighted = rows.map(row => ({ row, weight: Math.exp(-model.recipe.featureNames.reduce((sum, name) => sum + (((row.features[name] as { value: number }).value - (context.features[name] as { value: number }).value) / model.recipe.bandwidth) ** 2, 0) / 2) })).filter(r => Number.isFinite(r.weight) && r.weight > 0);", "web/lib/forge-v2/uncertainty.ts:57 const joint: JointDistribution = { playerId: context.playerId, gameId: context.gameId, seasonId: context.seasonId, targetVersion: context.targetVersion, conditioning: context.conditioning, schemaVersion: JOINT_SCHEMA, inputCutoffAt: context.inputCutoffAt, modelVersion: model.version, modelArtifactHash: contentHash(model), algorithmVersion: JOINT_ALGORITHM, categories, outcomes: weighted.map(({ row, weight }) => ({ probability: weight / mass, values: Object.fromEntries(categories.map(c => [c, (row.values[c] as { value: number }).value])) })) };"]}
  - Intended contract (Codex web-lib-forge-v2-uncertainty-quantile): {"source": "web/lib/forge-v2/uncertainty.ts:76", "explicit_comment": "Left-continuous inverse CDF convention is pinned, including ties and discrete outcomes.", "arithmetic_locations": ["web/lib/forge-v2/uncertainty.ts:83 /** Arithmetic only: empirical bands are never presented as calibrated without qualification. */"]}
  - Intended contract (Codex web-lib-forge-v2-uncertainty-scorejoint): {"source": "web/lib/forge-v2/uncertainty.ts:84", "explicit_comment": "Arithmetic only: empirical bands are never presented as calibrated without qualification.", "arithmetic_locations": ["web/lib/forge-v2/uncertainty.ts:88 const rows = joint.outcomes.map(row => ({ probability: row.probability, value: CATEGORIES.reduce((sum, c) => sum + (profile.weights[c] === 0 ? 0 : profile.weights[c] * row.values[c]!), 0) }));", "web/lib/forge-v2/uncertainty.ts:90 return available({ mean: rows.reduce((sum, row) => sum + row.probability * row.value, 0), intervals: ([0.5, 0.9] as const).map(level => ({ level, lower: quantile(rows, (1 - level) / 2), upper: quantile(rows, (1 + level) / 2) })) });", "web/lib/forge-v2/uncertainty.ts:99 /** Fits finite-sample tail padding on supplied chronological calibration observations only."]}
  - External references: Split conformal prediction
  - Fixtures/test data: `web/lib/forge-v2/fixtures.ts`
  - Tests: `web/lib/forge-v2/uncertainty.test.ts`; `{"status": "Discovered only; not run", "references": ["web/lib/forge-v2/lifecycle.test.ts:15", "web/lib/forge-v2/model.test.ts:6", "web/lib/forge-v2/uncertainty.test.ts (module test)"]}`; `{"status": "Discovered only; not run", "references": ["web/lib/forge-v2/lifecycle.test.ts:15", "web/lib/forge-v2/model.test.ts:6", "web/lib/forge-v2/uncertainty.test.ts:7"]}`; `{"status": "Discovered only; not run", "references": ["web/lib/forge-v2/uncertainty.test.ts (module test)", "web/lib/sustainability/model.test.ts:24", "web/scripts/blsh/baselineEvaluation.test.ts:54", "web/scripts/blsh/currentDryRun.test.ts:35"]}`; `{"status": "Discovered only; not run", "references": ["web/lib/forge-v2/uncertainty.test.ts:7"]}`
- **Leads (not audited):**
  - (codex:web-lib-forge-v2-uncertainty-fitintervalcalibration) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested."]
  - (codex:web-lib-forge-v2-uncertainty-predictjoint) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested."]
  - (codex:web-lib-forge-v2-uncertainty-quantile) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:web-lib-forge-v2-uncertainty-scorejoint) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested."]

## M-FRG-074 FORGE dashboard client aggregates (hot/cold, trust/momentum, power trend)

- **Match:** Opus only; Opus FRG-004; Codex —
- **Purpose:** Client-side summaries over percentile rankings and team power
- **Where:** `web/components/forge-dashboard/HotColdCard.tsx:243-298`; `web/components/forge-command-center/PlayerInsightCore.tsx:149-200`; `web/components/forge-command-center/TeamPowerTerminal.tsx:76-130`
- **Tags (heuristic):** generation: current
- **Opus view (FRG-004):**
  - Method: Hot/cold driver = max \|percentile-50\| and max \|delta\|, averaged per player; trust = mean percentile, momentum = mean delta, plotted at 50+14*momentum; team average power; trend gauge = max(0, 50 + 5*trend10).
  - Inputs/units: percentiles 0-100; sources: upstream FORGE/trend APIs
  - Output scale: display scores; writes: —
  - Status: live (client display)
  - Consumers: /forge dashboard and command center
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/__tests__/pages/forge/command-center.test.tsx`; `web/__tests__/pages/forge/dashboard.test.tsx`

## M-FRG-075 FORGE v2 forecast revision traversal spans

- **Match:** Opus only; Opus FRG-005; Codex —
- **Purpose:** Shades value ranges a forecast crossed between consecutive pregame revisions.
- **Where:** `web/components/ForgeV2/ForecastExplorer.tsx:17 (buildRevisionSpans)`; `web/components/ForgeV2/ForecastExplorer.tsx:58 (chart scale)`
- **Tags (heuristic):** percent scale: fraction 0-1; generation: current
- **Opus view (FRG-005):**
  - Method: For consecutive eligible revisions with non-null different values and no gap event between them, +1 at min, -1 at max (sweep line). Spans between sorted breakpoints with running count >0 get traversals n and opacity 1-0.75^n.
  - Inputs/units: forecast value units; sources: FORGE v2 revision history API
  - Output scale: count; opacity 0-1; writes: —
  - Status: live — /forge/v2
  - Consumers: pages/forge/v2/index.tsx via ConnectedForecastExplorer
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/components/ForgeV2/ForecastExplorer.test.tsx`
- **Leads (not audited):**
  - (opus) revisions across a failed/missing refresh are dropped, so large jumps after outages are not shaded

## M-FRG-076 Roster event confidence and TTL from reviewed tweets (+ preflight staleness gates)

- **Match:** Opus only; Opus FRG-010; Codex —
- **Purpose:** Convert reviewed tweet categories into FORGE roster events with fixed confidence and a 30 h validity window; gate a slate on stale lineups/goalie sources.
- **Where:** `web/lib/projections/rosterEvents.ts:106 (confidenceForEventType)`; `web/lib/projections/rosterEvents.ts:111 (buildRosterEventsFromReviewedTweet)`; `web/lib/projections/rosterEvents.ts:77 (resolveEventType)`; `web/lib/projections/rosterEvents.ts:182 (evaluateRosterEventPreflight)`; `web/lib/projections/rosterEvents.ts:47-50 (staleness constants)`
- **Tags (heuristic):** percent scale: fraction 0-1; generation: legacy, current
- **Opus view (FRG-010):**
  - Method: Category map: GOALIE START -> CONFIRMED or LIKELY; INJURY -> INJURY_OUT (OUT/NON PARTICIPANT), RETURN, else DTD; SCRATCHES -> INJURY_OUT; TRANSACTION -> SENDDOWN/CALLUP; LINEUP/LINE COMBINATION -> PP_UNIT_CHANGE or LINE_CHANGE. Confidence: 0.95 for GOALIE_START_CONFIRMED and INJURY_OUT, 0.75 for GOALIE_START_LIKELY and DTD, 0.70 otherwise (clamped 0-1). effective_to = effective_from + 30 h (defaultTtlHours). Preflight: block if lineups missing, goalie priors missing, or lineup age > 3 days; warn if lineup age > 1 day, roster assignments > 3 days, accepted goalie source > 18 h.
  - Inputs/units: categories; hours/days; sources: tweet pattern review rows
  - Output scale: confidence 0-1; timestamps; writes: forge_roster_events (via tweet-pattern-review route)
  - Status: live — buildRosterEventsFromReviewedTweet called by /api/v1/db/tweet-pattern-review; preflight gate legacy/dead (tests only)
  - Consumers: web/pages/api/v1/db/tweet-pattern-review.ts:1085; FORGE availability multiplier (FRG-069) uses confidence c
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: none suggested
  - Fixtures/test data: `web/lib/projections/rosterEvents.test.ts`
  - Tests: `web/lib/projections/rosterEvents.test.ts`
- **Leads (not audited):**
  - (opus) SCRATCHES mapped to INJURY_OUT (availability multiplier 0) rather than the SCRATCH type that FRG-069 handles
  - (opus) fixed confidences are magic numbers, not calibrated against outcomes
  - (opus) evaluateRosterEventPreflight has no non-test caller (legacy/dead)

## M-FRG-077 FORGE goalie starter metadata: top-2 probability mass and horizon-scaled blended projection

- **Match:** Opus only; Opus FRG-013; Codex —
- **Purpose:** Record starter-scenario diagnostics and horizon-scaled goalie totals in FORGE projection metadata.
- **Where:** `web/lib/projections/utils/projection-metadata-builders.ts:297 (top2_probability_mass)`; `web/lib/projections/utils/projection-metadata-builders.ts:436-462 (augmentStarterModelMetaWithScenarioProjections blended_projection)`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: per game; generation: current
- **Opus view (FRG-013):**
  - Method: top2 mass = sum of raw starter probabilities of the top-2 scenarios (4 dp). Blended projection metadata = per-game blended values x goalieHorizonTotalScalar (sum of horizon scalars): SA, saves, GA (3 dp), win prob and shutout prob (4 dp); modeled SV% unscaled.
  - Inputs/units: probabilities 0-1; per-game counts; sources: (in-memory FORGE goalie stage)
  - Output scale: horizon totals; 'probabilities' that can exceed 1; writes: forge goalie projection rows (metadata json)
  - Status: live — imported by run-forge-projections and goalie/skater stages
  - Consumers: web/lib/projections/stages/goalie-stage.ts; web/lib/projections/stages/skater-stage.ts
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/projections/module-imports.test.ts`
- **Leads (not audited):**
  - (opus) duplicate implementation of the horizon scaling in FRG-035/FRG-040 (goalie-stage); same issue: proj_win_prob and proj_shutout_prob multiplied by the horizon scalar sum can exceed 1 while still named *_prob

## M-FRG-078 FORGE pipeline stage map

- **Match:** Opus only; Opus FRG-015; Codex —
- **Purpose:** Ordered map of every FORGE stage from raw inputs to served/settled forecasts
- **Where:** `web/lib/rollingForgePipeline.ts:48 (ROLLING_FORGE_PIPELINE_ORDER)`; `web/lib/projections/run-forge-projections.ts:459 (runProjectionV2ForDate)`; `web/lib/projections/run-forge-projections.ts:806 (preflight)`; `web/lib/projections/run-forge-projections.ts:962 (skater stage call)`; `web/lib/projections/run-forge-projections.ts:1011 (goalie stage call)`; `web/lib/projections/run-forge-projections.ts:1049 (game totals/spread)`; `web/lib/projections/stages/persistence-stage.ts:7`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: per 60, per game; generation: current
- **Opus view (FRG-015):**
  - Method: Stage order (rolling-forge-pipeline-v4): (1) core_entity_freshness: update-games/update-teams/update-players -> games, teams, players. (2) upstream_skater_sources: update-nst-gamelog, update-wgo-skaters, update-wgo-totals -> nst_gamelog_*, wgo_skater_stats(_totals). (3) contextual_builders: update-line-combinations, update-power-play-combinations -> lineCombinations/PP combos. (4) rolling_player_recompute: /api/v1/db/update-rolling-player-averages -> rolling_player_game_metrics (+support payloads). (5) projection_input_ingest: /api/v1/db/ingest-projection-inputs -> pbp_games, pbp_plays, raw shift snapshots (ingest/pbp.ts:208, ingest/shifts.ts). (6) projection_relationship_build: /api/v1/db/shift-charts -> shift_charts per-player ES/PP/PK TOI (ingest/shifts.ts:596 buildShiftStrengthUpserts using derived/situation.ts:38 strengthForTeam). (7) projection_derived_build: /api/v1/db/build-projection-derived-v2 -> forge_player_game_strength, forge_team_game_strength (derived/buildStrengthTablesV2.ts:220,348), forge_goalie_game (derived/buildGoalieGameV2.ts:63). (8) projection_execution: /api/v1/db/update-goalie-projections-v2 -> goalie_start_projections (L10 start share, GSAA/60); /api/v1/db/run-projection-v2 -> runProjectionV2ForDate: preflight (stages/preflight-stage.ts: games, availability multipliers, goalie overrides, market context) -> per game: skater stage (stages/skater-stage.ts:1331: lineup/role, TOI blend, shot rate, conversion, assists, physical, PP allocation, reconciliation, uncertainty, reserve lines, goalie candidates) -> goalie stage (stages/goalie-stage.ts: shots against, starter probs, save%, win/shutout, uncertainty, reserve goalies) -> game totals/spread market flags -> persistence (forge_player_projections, forge_team_projections, forge_goalie_projections, forge_reserve_projections, player_prediction_outputs, game_prediction_outputs, model_market_flags_daily) -> run finalization (forge_runs metrics). (9) downstream_projection_consumers: /api/v1/db/run-projection-accuracy -> forge_projection_results, forge_projection_accuracy_daily/_player/_stat_daily, forge_projection_calibration_daily (horizon_games=1 only). (10) served forecast ledger: /api/v1/db/forge-served-forecast-snapshot (buildLedgerRows, naive controls, market rows) -> forge_served_forecast_ledger; /api/v1/db/forge-served-forecast-settle (settleLedgerRows vs wgo_skater_stats/wgo_goalie_stats) ; /api/v1/forge/scoreboard (scoreLedger/scorePairedLedger). (11) monitoring: cron-report. Parallel experimental track: lib/forge-v2 (kernel means + joint + interval calibration + CRPS evaluation) and lib/fantasy-projections season artifacts.
  - Inputs/units: mixed: TOI seconds in forge_* tables; per-60 in rolling metrics; minutes in some WGO fields; sources: games, teams, players, rosters, nst_gamelog_*, wgo_skater_stats, lineCombinations, pbp_games, pbp_plays, shift_charts, rolling_player_game_metrics, forge_team_game_strength, forge_goalie_game, goalie_start_projections, roster events, prop/market price tables
  - Output scale: stage outputs: counts per game x horizon scalar sum; probabilities 0-1; writes: games..forge_projection_calibration_daily, forge_served_forecast_ledger
  - Status: live — cron via run-rolling-forge-pipeline (pages/api/v1/db/run-rolling-forge-pipeline.ts) and route list in rollingForgePipeline.ts
  - Consumers: /forge pages; /start-chart; RSO bridge (lib/rosterScheduleData/forgeDailyBridge.ts); /api/v1/forge/*; /api/v1/projections/*
- **Audit context:**
  - Intent (Opus): rollingForgePipeline.ts:219-251 dependency requirements text; tasks/TASKS/forge-projections/tasks-forge-projection-improvements-2026-10-22.md
  - External references: none suggested
  - Fixtures/test data: `web/scripts/fixtures/forge-counterfactual-backtest/`; `web/scripts/fixtures/forge-reconstruction-backtest/`; `web/lib/projections/externalInputProof.fixtures.ts`
  - Tests: `web/__tests__/pages/api/v1/db/run-projection-v2.test.ts`; `web/__tests__/pages/api/v1/db/run-rolling-forge-pipeline.test.ts`; `web/lib/projections/runProjectionV2.test.ts`
- **Leads (not audited):**
  - (opus) observation: horizon>1 rows are written but accuracy only scores horizon_games=1
  - (opus) observation: goalie start priors (stage 8a) are computed in a separate route from different inputs (wgo goalie logs, includes current game) than FORGE's own starter context (forge_goalie_game)
  - (opus) observation: forge_goalie_game.toi_seconds is always null yet starter context picks the starter by max TOI

## M-FRG-079 FORGE projection miss attribution (skater TOI/shot-rate/conversion; goalie starter/SA/SV%)

- **Match:** Opus only; Opus FRG-016; Codex —
- **Purpose:** Attribute absolute fantasy-point misses to component drivers for diagnostics.
- **Where:** `web/pages/api/v1/db/run-projection-accuracy.ts:1960-2016 (skater loop)`; `web/pages/api/v1/db/run-projection-accuracy.ts:922 (finalizeSkaterMissAttributionDiagnostics)`; `web/pages/api/v1/db/run-projection-accuracy.ts:2236-2262 (goalie loop)`; `web/pages/api/v1/db/run-projection-accuracy.ts:862 (finalizeMissAttributionDiagnostics)`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: shots on goal; generation: current
- **Opus view (FRG-016):**
  - Method: Skater: FP = TOI * shotRate * FPperShot, with FPperShot = SOG weight + scoringFP/max(0.1,shots). Sequential substitution: TOI effect = \|FP(actTOI) - FP(pred)\|, shot-rate effect = \|FP(actTOI,actRate) - FP(actTOI)\|, conversion effect = \|FP(all actual) - FP(actTOI,actRate)\|. Goalie: starter = (1 - starterProb)*\|GA error\|; SA = \|(predSA-actSA)*(1-modeledSv)\|; SV% = \|actSA*(modeledSv-actSv)\|. Shares of explainable sum; primary driver = max share, 'MIXED' if another within 0.05.
  - Inputs/units: TOI seconds; counts; fantasy points; sources: forge_player_projections, forge_goalie_projections, wgo_skater_stats, goalie_stats_unified
  - Output scale: shares 0-1; writes: forge_projection_calibration_daily (metrics json, via accuracy run)
  - Status: live — part of run-projection-accuracy
  - Consumers: FORGE diagnostics / cron report
- **Audit context:**
  - Intent (Opus): Comment run-projection-accuracy.ts:~2250 (unknown starter probability attributes nothing to the starter call)
  - External references: Shapley-style or variance decomposition; sequential substitution is order-dependent
  - Fixtures/test data: none listed
  - Tests: `web/__tests__/pages/api/v1/db/run-projection-accuracy.test.ts`
- **Leads (not audited):**
  - (opus) decomposition order (TOI, then rate, then conversion) changes attributions; hits/blocks fantasy points excluded from FP model here
  - (opus) modeled save% falls back to 0.9 when unknown

## M-FRG-080 FORGE projection accuracy metrics (MAE/RMSE/accuracy, Brier, interval coverage, holdout baselines)

- **Match:** Opus only; Opus FRG-017; Codex —
- **Purpose:** Score settled FORGE skater and goalie projections against actuals and persist daily accuracy, calibration and launch-gate diagnostics.
- **Where:** `web/pages/api/v1/db/run-projection-accuracy.ts:508 (computeAggregate)`; `web/pages/api/v1/db/run-projection-accuracy.ts:795 (updateCoverage)`; `web/pages/api/v1/db/run-projection-accuracy.ts:968 (buildGoalieLaunchGates)`; `web/pages/api/v1/db/run-projection-accuracy.ts:1111 (finalizeMetricComparison)`; `web/pages/api/v1/db/run-projection-accuracy.ts:1185 (updateCalibrationAccumulator)`; `web/pages/api/v1/db/run-projection-accuracy.ts:2119 (goalie baseline)`
- **Tags (heuristic):** percent scale: fraction 0-1; generation: current
- **Opus view (FRG-017):**
  - Method: Fantasy points via lib/projections/accuracy/fantasyPoints (computeSkaterFantasyPoints/computeGoalieFantasyPoints/computeAccuracyScore). MAE = mean\|pred-act\|, RMSE = sqrt(mean sq). Per-stat MAE/RMSE daily and rolling windows (30d). Probability calibration: clamp p and outcome to [0,1], Brier = mean (p-o)^2, 10 equal-width bins. Interval hit-rate = share of actuals within [p10,p90]. Model vs baseline compared on identical rows (deltas). Goalie baseline: GA = projected SA*(1-0.900), saves = SA-GA. Launch gates: saves MAE30 <= 4.5, GA MAE30 <= 1.4, starter Brier <= 0.20, win Brier <= 0.22, shutout Brier <= 0.08, saves and GA p10-p90 hit rate in [0.72, 0.90].
  - Inputs/units: fantasy points; stat counts; probabilities 0-1; TOI seconds or minutes (inferred); sources: forge_player_projections, forge_goalie_projections, forge_runs, wgo_skater_stats, goalie_stats_unified, forge_goalie_game, games, forge_projection_calibration_daily
  - Output scale: MAE/RMSE in fantasy points or stat units; Brier 0-1; hit rate 0-1; writes: forge_projection_accuracy_daily, forge_projection_accuracy_player, forge_projection_accuracy_stat_daily, forge_projection_calibration_daily
  - Status: live — final stage of /api/v1/db/run-rolling-forge-pipeline (vercel.json cron); route ledger calls=8
  - Consumers: web/pages/api/v1/forge/accuracy.ts; web/pages/api/v1/forge/goalies.ts (calibration hints); web/lib/rollingForgePipeline.ts; web/lib/projections/goaliePipeline.ts
- **Audit context:**
  - Intent (Opus): Comment run-projection-accuracy.ts:107 (unknown stats left out of MAE/RMSE and interval diagnostics); baseline_definition 'fixed_save_pct_0.900_using_projected_shots_against' (line ~2500)
  - External references: Brier score and reliability diagrams; nominal 80% interval coverage for p10-p90; MAE/RMSE vs naive baseline
  - Fixtures/test data: none listed
  - Tests: `web/__tests__/pages/api/v1/db/run-projection-accuracy.test.ts`; `web/__tests__/pages/api/v1/db/run-rolling-forge-pipeline.test.ts`
- **Leads (not audited):**
  - (opus) actual TOI unit inferred by magnitude (<= 80 treated as minutes, else seconds)
  - (opus) p10-p90 should cover 80% nominally; gate band [0.72,0.90] is asymmetric
  - (opus) goalie baseline uses a fixed 0.900 save% (same magic constant as goalie-projections-v2)
  - (opus) predictions and outcomes are clamped to [0,1] before Brier, hiding out-of-range model output

## M-FRG-081 FORGE accuracy role buckets (ES line role and PP unit by projected PP TOI)

- **Match:** Opus only; Opus FRG-018; Codex —
- **Purpose:** Bucket skaters into TOP_LINE/MIDDLE_SIX/DEPTH/D-pairs and PP1/PP2/depth for per-role error and interval calibration.
- **Where:** `web/pages/api/v1/db/run-projection-accuracy.ts:571 (buildPpUnitBucketByPlayer)`; `web/pages/api/v1/db/run-projection-accuracy.ts:603 (inferRoleBuckets)`
- **Tags (heuristic):** generation: current
- **Opus view (FRG-018):**
  - Method: Within each game+team sort by projected PP seconds desc: ranks 1-5 PP1, 6-10 PP2, rest PP_UNIT_DEPTH (including 0 PP TOI). ES role L1 -> TOP_LINE, L2/L3 -> MIDDLE_SIX, L4 -> DEPTH_FORWARD, D1-D3 -> pairs; else UNKNOWN.
  - Inputs/units: seconds; sources: forge_player_projections
  - Output scale: categorical; writes: —
  - Status: live
  - Consumers: role_bucket_interval_calibration_daily diagnostics
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/__tests__/pages/api/v1/db/run-projection-accuracy.test.ts`
- **Leads (not audited):**
  - (opus) players with zero projected PP TOI can still be labelled PP1/PP2 if fewer than 5/10 players have PP time

## M-FRG-082 FORGE projection run preflight gates

- **Match:** Opus only; Opus FRG-019; Codex —
- **Purpose:** Block or warn a FORGE projection run when line combinations or derived strength rows are missing or stale.
- **Where:** `web/pages/api/v1/db/run-projection-v2.ts:200 (summarizeSkaterFreshnessCoverage)`; `web/pages/api/v1/db/run-projection-v2.ts:554 (runProjectionPreflightChecks)`
- **Tags (heuristic):** generation: current
- **Opus view (FRG-019):**
  - Method: Per scheduled team: ageDays = anchor - latest line-combo game date; > hard days -> hard stale (FAIL), > soft days -> soft stale; < 12 distinct F+D role players -> insufficient; no derived rows in [anchor-7d, anchor) -> missing. Projection math itself delegated to lib/projections/run-forge-projections.
  - Inputs/units: days; counts; sources: lineCombinations, games, forge_player_game_strength, goalie_start_projections, rosters
  - Output scale: PASS/FAIL gates; writes: forge_runs (via lib), forge_player_projections / forge_goalie_projections / forge_team_projections (via lib)
  - Status: live — run by run-rolling-forge-pipeline (vercel.json cron) and route-runner
  - Consumers: run-rolling-forge-pipeline; run-projection-accuracy (imports runProjectionPreflightChecks)
- **Audit context:**
  - Intent (Opus): Gate action strings in run-projection-v2.ts:665-690
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/__tests__/pages/api/v1/db/run-projection-v2.test.ts`
- **Leads (not audited):**
  - (opus) role coverage threshold 12 is a fixed magic number (teams dress 12F+6D=18)

## M-FRG-083 Start-chart projected TOI normalization

- **Match:** Opus only; Opus FRG-021; Codex —
- **Purpose:** Sum projected strength-split TOI seconds into minutes, rejecting impossible values.
- **Where:** `web/pages/api/v1/start-chart.ts:749 (normalizeProjectedToiMinutes)`
- **Tags (heuristic):** denominators: per 60; generation: current
- **Opus view (FRG-021):**
  - Method: All null -> null; any negative/non-finite -> null; sum seconds; > 65*60 s -> null; else minutes = sum/60 rounded 2 dp.
  - Inputs/units: seconds; sources: forge_player_projections
  - Output scale: minutes; writes: —
  - Status: live
  - Consumers: web/pages/start-chart.tsx
- **Audit context:**
  - Intent (Opus): Constant MAX_ONE_GAME_SKATER_TOI_SECONDS = 65*60 (start-chart.ts:747)
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/__tests__/pages/api/v1/start-chart.test.ts`
- **Leads (not audited):**
  - (opus) a partially-null split is summed as 0 for missing parts, under-stating TOI

## M-FRG-084 Projection source accuracy analysis (client)

- **Match:** Opus only; Opus FRG-024; Codex —
- **Purpose:** Client-side accuracy of external projection sources vs actuals in the projections page
- **Where:** `web/components/Projections/ProjectionSourceAnalysis.tsx:91 (median)`; `web/components/Projections/ProjectionSourceAnalysis.tsx:233-326 (accuracy, within10/20, source score)`
- **Tags (heuristic):** denominators: per game; generation: current
- **Opus view (FRG-024):**
  - Method: accuracy% = (1 - \|err\|/\|proj\|)*100; within 10%/20% of projection; bias = mean error; source score = within20% x100 - 0.5*\|bias\| (total and per-game variants); round = ceil(ADP/12).
  - Inputs/units: season counts and per-game; sources: projection source tables (draft dashboard data)
  - Output scale: percent; score; writes: —
  - Status: live (client)
  - Consumers: Projections page / draft dashboard
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: MAE; MAPE
  - Fixtures/test data: none listed
  - Tests: `web/__tests__/components/DraftDashboard/ProjectionSourceAccuracy.test.tsx`
- **Leads (not audited):**
  - (opus) observation: relative error divides by projection (MAPE-like, unstable near 0)
  - (opus) observation: score mixes a percentage and a bias in stat units

## M-FRG-085 Probability calibration and goalie launch gates

- **Match:** Opus only; Opus FRG-030; Codex —
- **Purpose:** Brier score and 10-bin reliability for starter/win/shutout probabilities with pass/fail gates
- **Where:** `web/pages/api/v1/db/run-projection-accuracy.ts:1173 (initCalibrationAccumulator)`; `web/pages/api/v1/db/run-projection-accuracy.ts:1185 (updateCalibrationAccumulator)`; `web/pages/api/v1/db/run-projection-accuracy.ts:968 (buildGoalieLaunchGates)`; `web/pages/api/v1/db/run-projection-accuracy.ts:418 (GOALIE_LAUNCH_GATE_THRESHOLDS)`
- **Tags (heuristic):** percent scale: fraction 0-1; generation: current
- **Opus view (FRG-030):**
  - Method: Brier = mean (p-o)^2; bins floor(p*10). Starter outcome = 1 if the goalie has any actual row. Gates (30 d): n>=100, saves MAE<=4.5, GA MAE<=1.4, starter Brier<=0.2, win Brier<=0.22, shutout Brier<=0.08, saves and GA interval hit rate in [0.72,0.90].
  - Inputs/units: probabilities 0-1; sources: forge_goalie_projections, wgo_goalie_stats
  - Output scale: Brier 0-1; writes: forge_projection_calibration_daily
  - Status: live
  - Consumers: goalie launch readiness
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: Brier score; reliability diagrams
  - Fixtures/test data: none listed
  - Tests: `web/__tests__/pages/api/v1/db/run-projection-accuracy.test.ts`
- **Leads (not audited):**
  - (opus) observation: 'started' = appeared (relief appearances count as starts)
  - (opus) observation: win calibration uses proj_win_prob, which already includes P(start) and decision share, against W among appearances

## M-FRG-086 Skater fantasy-point miss attribution

- **Match:** Opus only; Opus FRG-031; Codex —
- **Purpose:** Decompose skater FP error into TOI, shot-rate and conversion contributions
- **Where:** `web/pages/api/v1/db/run-projection-accuracy.ts:1945-2000`; `web/pages/api/v1/db/run-projection-accuracy.ts:922 (finalizeSkaterMissAttributionDiagnostics)`; `web/pages/api/v1/db/run-projection-accuracy.ts:862 (goalie finalizeMissAttributionDiagnostics)`
- **Tags (heuristic):** generation: current
- **Opus view (FRG-031):**
  - Method: FP = TOI x shotRate x FPperShot with FPperShot = 0.2 + scoringFP/max(0.1,shots). Sequential substitution: TOI then shot rate then conversion; contributions = \|differences\|; shares of explainable error.
  - Inputs/units: seconds; counts; sources: forge_player_projections, wgo_skater_stats
  - Output scale: FP contributions; writes: forge_projection_accuracy_daily (diagnostics)
  - Status: live
  - Consumers: accuracy dashboards
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: Sequential (Shapley-like) error attribution
  - Fixtures/test data: none listed
  - Tests: `web/__tests__/pages/api/v1/db/run-projection-accuracy.test.ts`
- **Leads (not audited):**
  - (opus) observation: order-dependent sequential decomposition; hits/blocks ignored

## M-FRG-087 FORGE retained ledger validity checks

- **Match:** Opus only; Opus FRG-034; Codex —
- **Purpose:** Validate retained forecast/settlement ledger rows before paired scoring
- **Where:** `web/scripts/forge-ledger-evaluate.ts:15 (invalidCounts)`; `web/scripts/forge-ledger-evaluate.ts:25 (invalidPrediction)`; `web/scripts/forge-ledger-evaluate.ts:42 (evaluateRetainedLedger)`
- **Tags (heuristic):** denominators: per game; generation: development
- **Opus view (FRG-034):**
  - Method: reject negative/non-finite means, probabilities outside [0,1]; PPP <= G + A (tolerance 0.00015 for three 4-dp rounded values); SA = saves + GA within tolerance; actual PPP <= G+A, SA == saves+GA, win/shutout <= 1; pregame ordering cutoff<=issued<=created<scheduled; scoring delegated to lib scorePairedLedger vs naive_last5 (5 skater apps / 10 goalie starts) and naive_season references
  - Inputs/units: per-game counts, probabilities 0-1; sources: local retained ledger export
  - Output scale: pass/fail + scores; writes: —
  - Status: draft — read-only adapter
  - Consumers: FORGE accuracy review
- **Audit context:**
  - Intent (Opus): doc comment web/scripts/forge-ledger-evaluate.ts:7-8
  - External references: naive persistence baselines
  - Fixtures/test data: none listed
  - Tests: none listed
- **Leads (not audited):**
  - (opus) naive_last5 means 5 skater appearances but 10 goalie starts (noted in output)

## M-FRG-088 FORGE v2 issuance: joint-distribution coherence gate and category support

- **Match:** Opus only; Opus FRG-036; Codex —
- **Purpose:** Before publishing a vintage, pick the categories the joint distribution must cover and refuse joints whose implied means disagree with the conditional means.
- **Where:** `web/lib/forge-v2/pipeline.server.ts:236 (runPreparedIssuance)`; `web/lib/forge-v2/pipeline.server.ts:262-276 (support, coherent, joint retry)`; `web/lib/forge-v2/pipeline.server.ts:285 (generation_crossed_lock)`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: per game; generation: research, development
- **Opus view (FRG-036):**
  - Method: Support = categories with a non-zero weight in any selected profile; if PPP is included, G and A are added. Coherent iff every support category's mean equals Σ outcome.probability × outcome.value within an absolute 1e-10. If incoherent and more than one profile, retry with only the issued profile's categories; otherwise the distribution is unavailable ('joint_mean_mismatch'). profileIds keep only profiles whose non-zero categories are all supported. Vintage refused if generatedAt >= lockAt. Means are flagged 'private_development_unqualified'.
  - Inputs/units: per-game category counts; sources: FORGE v2 prepared ledger / artifacts store (forge-v2 isolated persistence)
  - Output scale: probability-weighted category counts; categorical availability; writes: FORGE v2 artifacts store (joint distribution, calibration), FORGE v2 vintage ledger
  - Status: draft — FORGE v2 research pipeline; unqualified, private (PRD open gates 7.x/14.x)
  - Consumers: FORGE v2 read API /api/v2/forge/[operation] via qualification; interval/score evaluation (horizonEvaluation)
- **Audit context:**
  - Intent (Opus): pipeline.server.ts:272 comment: a broader optional profile must not discard support needed by the issued profile; tasks/tasks-prd-forge-v2-skater-game-forecasts.md (joint-distribution coverage)
  - External references: none suggested
  - Fixtures/test data: `web/lib/forge-v2/fixtureHarness.server.ts`
  - Tests: `web/lib/forge-v2/lifecycle.test.ts`; `web/lib/forge-v2/pipeline.test.ts`
- **Leads (not audited):**
  - (opus) 1e-10 absolute tolerance on means does not scale with the size of the totals; float summation over large outcome tables could fail coherence by itself
  - (opus) the PPP → G and A coupling is hard-coded and does not include PP-specific components

## M-FRG-089 FORGE v2 operational health summary and alarms

- **Match:** Opus only; Opus FRG-037; Codex —
- **Purpose:** Summarize FORGE v2 operations (latency, source age, missingness, queue, outcome lag, qualification drift) against approved limits and estimate retention size.
- **Where:** `web/lib/forge-v2/operations.ts:22 (summarizeOperations)`; `web/lib/forge-v2/operations.ts:18-19 (maximum, average)`; `web/lib/forge-v2/operations.ts:140 (estimateRetention)`
- **Tags (heuristic):** generation: development
- **Opus view (FRG-037):**
  - Method: Alarms: limits missing; source age (now − observedAt) > maximumSourceAgeMs; pending > maximumQueued; retries = Σ max(0, attempts − 1) > maximumRetries; outcome lag ((settled ? recordedAt : now) − endedAt) > maximumOutcomeLagMs; qualification drift (decision unavailable or scope hash changed); integrity incidents. Publication latency is reported as mean and maximum. Missingness = count of unavailable means per category, plus opportunities without a publication. health = blocked if any alarm; readyForActivation is always false. Retention estimate: rows = scopes × dailyRevisions × days; bytes = rows × canonical-JSON bytes of a sample.
  - Inputs/units: milliseconds; counts; bytes; sources: FORGE v2 queue/publication/settlement records (supplied)
  - Output scale: ms, counts, bytes; categorical health; writes: —
  - Status: draft — no runtime caller (tests only)
  - Consumers: FORGE v2 release transitions (transitionRelease); lifecycle rehearsal tests
- **Audit context:**
  - Intent (Opus): tasks/tasks-prd-forge-v2-skater-game-forecasts.md 13.3: measure due/published counts, latency, source age, missingness, queue/retry, artifact integrity, outcome lag and qualification drift
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/forge-v2/lifecycle.test.ts`
- **Leads (not audited):**
  - (opus) summarizeOperations is only called from lifecycle.test.ts; no runtime caller was found
  - (opus) latency is summarized as mean/max only (no percentiles), and the retention estimate is uncompressed JSON, not a storage bill

## M-FRG-090 FORGE v2 qualification gate (serving eligibility of means and participation)

- **Match:** Opus only; Opus FRG-038; Codex —
- **Purpose:** Decide whether a vintage's category means and participation probability can be served publicly under a qualified manifest.
- **Where:** `web/lib/forge-v2/qualification.ts:28 (qualificationScope)`; `web/lib/forge-v2/qualification.ts:43 (assessQualification)`; `web/lib/forge-v2/qualification.ts:75 (qualifiedMeans)`; `web/lib/forge-v2/qualification.ts:80 (qualifiedParticipation)`
- **Tags (heuristic):** percent scale: fraction 0-1; generation: development
- **Opus view (FRG-038):**
  - Method: Scope: horizons must be contiguous 1..k with k <= 10. Categories must be valid and include every non-zero DEFAULT_SCORING category. The default profile, participationQualified, and interval levels 0.5 and 0.9 are required, as is a hashed joint generator. Scope is full_v2 iff 10 horizons and all 7 categories, else contiguous_subset. Vintage must be public_serving, share target/conditioning/model/feature/code versions with the manifest, have a supported horizon and cohort, and use scoring rule 'linear-seven-v1'. Every contributing category must be available. Four evidence records must have matching hashes and scope digest, be approved, passed and independent with author != reviewer, and be in chronological order. The final evaluation must be untouched, with a sample manifest different from the prospective one, and review issued after both evaluations. qualifiedMeans masks unqualified categories; participation must be a finite value in [0,1].
  - Inputs/units: horizon index 1..10; probabilities 0-1; sources: FORGE v2 qualification manifests/evidence (trusted read layer)
  - Output scale: categorical decision; participation probability 0-1; writes: —
  - Status: draft — fail-closed gate on /api/v2/forge/[operation]; no qualified evidence yet
  - Consumers: web/lib/forge-v2/api.server.ts (public read); web/lib/forge-v2/operations.ts (qualification drift, release transitions); uncertainty.ts / participation.ts / integration.ts
- **Audit context:**
  - Intent (Opus): tasks/tasks-prd-forge-v2-skater-game-forecasts.md: fail-closed qualification/adapter, explicit H1-H10 evaluation rule, task 2.5 frozen protocol
  - External references: Pre-registered evaluation / holdout discipline
  - Fixtures/test data: `web/lib/forge-v2/fixtureHarness.server.ts`
  - Tests: `web/lib/forge-v2/integration.test.ts`; `web/lib/forge-v2/lifecycle.test.ts`; `web/lib/forge-v2/uncertainty.test.ts`
- **Leads (not audited):**
  - (opus) no qualified manifest exists yet (PRD gates 2.5, 13.4, 14.x open), so every public read fails closed to unavailable

## M-FRG-091 Goalie share, save% and GAA by team window

- **Match:** Opus only; Opus FRG-040; Codex —
- **Purpose:** Appearance share, starts, sv% and GAA per goalie over L10/L20/L30/season
- **Where:** `web/lib/goalieWorkload.ts:61 (buildGoalieShareByTeam)`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: per 60, per team game; generation: current
- **Opus view (FRG-040):**
  - Method: Window = last N distinct team games; gamesStarted only if every window game has exactly one labeled starter; sv% = saves/SA; GAA = GA*3600/TOI seconds.
  - Inputs/units: TOI seconds; sources: NHL goalie summaries (caller)
  - Output scale: fractions; goals per 60; writes: —
  - Status: live
  - Consumers: components/GoalieShareChart
- **Audit context:**
  - Intent (Opus): goalieWorkload.ts:3-4 docstring
  - External references: NHL sv%/GAA
  - Fixtures/test data: none listed
  - Tests: `web/components/GoalieShareChart/GoalieShareChart.test.ts`

## M-FRG-092 Goalie starter mixtures

- **Match:** Opus only; Opus FRG-050; Codex —
- **Purpose:** Normalised starter mixture rows with confirmation, override, B2B and staleness handling
- **Where:** `web/lib/projections/goalieStarterMixtures.ts:111 (buildGoalieStarterMixtureRows)`; `web/lib/projections/goalieStarterMixtures.ts:238 (mixtureRowsToStarterScenarios)`; `web/lib/projections/goalieStarterMixtures.ts:254 (buildGoalieStarterBranchProjectionRows)`
- **Tags (heuristic):** percent scale: fraction 0-1; generation: current
- **Opus view (FRG-050):**
  - Method: Override -> 1/0; conflicting evidence (multiple confirmed, duplicate ids, sum >1) -> 0; confirmed -> 1/nConfirmed; B2B repeat starter x0.65. normalised = adjusted/max(1, mass) (missing mass kept as residual). Confidence low if stale >=36 h, medium >=12 h. Branch rows scale stats by probability.
  - Inputs/units: probabilities; hours; sources: goalie_start_projections
  - Output scale: probability 0-1; writes: goalie_starter_mixtures (via route)
  - Status: live — /api/v1/db/update-goalie-starter-mixtures and start-chart
  - Consumers: start chart; update-goalie-starter-mixtures route
- **Audit context:**
  - Intent (Opus): goalieStarterMixtures.ts:166-167 comment (missing mass)
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/projections/goalieStarterMixtures.test.ts`
- **Leads (not audited):**
  - (opus) observation: B2B factor 0.65 differs from FORGE logit B2B penalty (-2.75 logit)

## M-FRG-093 Goalie shots-against projection

- **Match:** Opus only; Opus FRG-053; Codex —
- **Purpose:** Expected shots against from opponent skater shots, team defence history, trends, rest and venue
- **Where:** `web/lib/projections/stages/goalie-stage.ts:296 (trendAdj)`; `web/lib/projections/stages/goalie-stage.ts:300 (blendedShotsAgainst)`; `web/lib/projections/stages/goalie-stage.ts:351 (contextPct)`; `web/lib/projections/queries/team-context-queries.ts:481 (fetchTeamDefensiveEnvironment)`; `web/lib/projections/queries/team-context-queries.ts:523 (fetchTeamOffenseEnvironment)`; `web/lib/projections/constants/projection-weights.ts:26-30`
- **Tags (heuristic):** denominators: per game, 5v5 only; generation: current
- **Opus view (FRG-053):**
  - Method: blended = 0.65*oppProjShots + 0.35*teamSA10 + clamp(0.25*(SA5-SA10),±3); base = blended*(1+teamStrength.shotsAgainstPct). contextPct = 0.45*clamp((oppShots5-base)/base,-0.12,0.18) + 0.35*clamp((oppG5-oppG10)/oppG10,-0.1,0.15) + 0.03 if opp rest>=2 - 0.04 if opp B2B + 0.02 if defending B2B + 0.02 opp home / -0.01 opp away + 5v5 context + NST danger; clamp -0.15..0.2. SA = base*(1+contextPct).
  - Inputs/units: shots per game; rest days; sources: forge_goalie_game, forge_team_game_strength, games
  - Output scale: shots against per game; writes: forge_goalie_projections.proj_shots_against
  - Status: live
  - Consumers: saves/GA; shutout; goalie uncertainty
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: Team shot-suppression models; home/rest effects
  - Fixtures/test data: none listed
  - Tests: `web/lib/projections/runProjectionV2.test.ts`
- **Leads (not audited):**
  - (opus) observation: opponent projected shots are already pinned to the opponent's own last-10 shots-for average, then blended again with defence history and opponent recent shots (trend counted twice)
  - (opus) observation: opponent goals trend moves shots against
  - (opus) observation: asymmetric clamps
  - (opus) observation: rest effects here are independent of the skater rest model (no shared definition)

## M-FRG-094 FORGE goalies API win-probability normalisation

- **Match:** Opus only; Opus FRG-055; Codex —
- **Purpose:** Rescale goalie proj_win_prob across a game so the matchup sums to 1
- **Where:** `web/pages/api/v1/forge/goalies.ts:165-215`
- **Tags (heuristic):** percent scale: fraction 0-1; generation: current
- **Opus view (FRG-055):**
  - Method: If all win probs known: normalised = value / sum over the game's goalie rows (last row gets 1 - running); if sum 0 use starter probability; else equal split.
  - Inputs/units: probabilities; sources: forge_goalie_projections
  - Output scale: probability 0-1; writes: —
  - Status: live
  - Consumers: /api/v1/forge/goalies consumers (FORGE goalie pages)
- **Audit context:**
  - Intent (Opus): goalies.ts:173-174 comment
  - External references: none suggested
  - Fixtures/test data: `web/__tests__/pages/api/v1/forge/__snapshots__/goalies.test.ts.snap`
  - Tests: `web/__tests__/pages/api/v1/forge/goalies.test.ts`
- **Leads (not audited):**
  - (opus) observation: proj_win_prob is a credited-goalie W = P(start) x P(win\|start) x 0.984 (and horizon-scaled), so forcing the game's rows to sum to 1 inflates it and mixes populations the goalie stage keeps apart

## M-FRG-095 Game totals and spread market flags

- **Match:** Opus only; Opus FRG-061; Codex —
- **Purpose:** Flag model-vs-market edges on game totals and spreads
- **Where:** `web/lib/projections/run-forge-projections.ts:1049-1130`
- **Tags (heuristic):** percent scale: 0-100; generation: current
- **Opus view (FRG-061):**
  - Method: total = homeEG + awayEG; spread = homeEG - awayEG. totals edge = total - line; flag if \|edge\| >= 0.4. spread edge = spread - homeSpreadLine; flag if \|edge\| >= 0.5 (model_home_cover if >0). Confidence = min(100, \|edge\|/threshold*50).
  - Inputs/units: goals; line values; sources: market summaries (preflight)
  - Output scale: goal edge; confidence 0-100; writes: model_market_flags_daily, game_prediction_outputs
  - Status: live
  - Consumers: market flag readers
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: Sportsbook totals/spread conventions
  - Fixtures/test data: none listed
  - Tests: `web/lib/projections/utils/market-output-builders.test.ts`
- **Leads (not audited):**
  - (opus) observation: spread sign: a home favourite line is negative (e.g. -1.5), so spread - line adds instead of subtracting (2 goals edge for a 0.5-goal projection); likely should be spread + line
  - (opus) observation: expected goals exclude EN/OT/SH goals, biasing totals edges toward 'under'
  - (opus) observation: for horizon>1, horizon-scaled totals compared to single-game lines

## M-FRG-096 Start chart opponent defence grade and TOI normalisation

- **Match:** Opus only; Opus FRG-064; Codex —
- **Purpose:** Percentile grade of opponent xGA/60 and projected TOI minutes for the start chart
- **Where:** `web/pages/api/v1/start-chart.ts:715-745 (xga60 grade)`; `web/pages/api/v1/start-chart.ts:749 (normalizeProjectedToiMinutes)`
- **Tags (heuristic):** percent scale: 0-100; denominators: per 60; generation: current
- **Opus view (FRG-064):**
  - Method: Sort teams by xGA/60 ascending; tied rows get average rank; grade = avgRank/(n-1)*100 (0 = best defence). TOI minutes = sum seconds/60, null if >65 min.
  - Inputs/units: per-60; seconds; sources: team ratings source, forge_player_projections
  - Output scale: 0-100 grade; minutes; writes: —
  - Status: live
  - Consumers: /start-chart page
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: Percentile rank
  - Fixtures/test data: none listed
  - Tests: `web/lib/projections/startChartPipeline.test.ts`

## M-FRG-097 Availability multiplier from roster events

- **Match:** Opus only; Opus FRG-076; Codex —
- **Purpose:** Convert injury/scratch/benching events to a production multiplier
- **Where:** `web/lib/projections/stages/preflight-stage.ts:41 (availabilityMultiplierForEvent)`; `web/lib/projections/stages/preflight-stage.ts:176 (confidence default)`; `web/lib/projections/stages/skater-stage.ts:2335 (starter-board binarisation)`
- **Tags (heuristic):** percent scale: fraction 0-1; generation: current
- **Opus view (FRG-076):**
  - Method: OUT/IR/LTIR/SUSPENSION/NON_ROSTER/SENDDOWN -> 0; DTD -> clamp(1-0.6c,0.2,1); BENCHING -> clamp(1-0.45c,0.35,1); SCRATCH -> clamp(1-0.8c,0.05,1); RETURN/CALLUP -> 1. Confidence default clamp(conf ?? 0.75, 0.5, 1). When STARTER_BOARD_COMPUTE_ENABLED, multiplier collapses to 0/1 (production conditional on playing).
  - Inputs/units: confidence 0-1; sources: roster events (forge roster events table)
  - Output scale: multiplier 0-1; writes: —
  - Status: live (behaviour depends on STARTER_BOARD_COMPUTE_ENABLED / START_CHART_GAME_REVISIONS)
  - Consumers: skater TOI/shots; reserve selection
- **Audit context:**
  - Intent (Opus): stages/skater-stage.ts:2333-2334 comment
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/projections/rosterEvents.test.ts`; `web/lib/projections/runProjectionV2.test.ts`
- **Leads (not audited):**
  - (opus) observation: comment at skater-stage.ts:2333 says legacy DTD/benched multipliers are not calibrated participation probabilities; when flag off they still multiply expected counts

## M-FRG-098 Line-combination recency, role tags and fallback ranking

- **Match:** Opus only; Opus FRG-088; Codex —
- **Purpose:** Assign each skater an ES role (L1-L4, D1-D3) and unit tier from line combos, roster events or TOI rank
- **Where:** `web/lib/projections/stages/skater-stage.ts:555 (assessLineCombinationRecency)`; `web/lib/projections/stages/skater-stage.ts:595 (roleTagFromRosterEvent)`; `web/lib/projections/stages/skater-stage.ts:649 (buildSkaterRoleTags)`; `web/lib/projections/stages/skater-stage.ts:394 (fetchFallbackSkaterIdsForTeam)`; `web/lib/projections/stages/skater-stage.ts:480 (fetchTeamSkaterRoleHistory)`
- **Tags (heuristic):** generation: current
- **Opus view (FRG-088):**
  - Method: Line combo soft-stale >10 days, hard-stale >21 days (missing = hard). Forwards chunked by 3 -> L1..L4, D by 2 -> D1..D3; non-F/D positions -> L4. Tier: L1/D1 TOP, L2/D2 MIDDLE, else DEPTH. Roster event LINE_CHANGE lineNumber (default 3) clamp 1-4; PP_UNIT_CHANGE ppUnit (default 2) clamp 1-3. Fallback ranks by rolling TOI over 120-day lookback, 18 players (24 for pool recovery).
  - Inputs/units: days; ordinal positions; sources: lineCombinations, roster events, rolling_player_game_metrics, players
  - Output scale: categorical role and rank; writes: —
  - Status: live
  - Consumers: usage bounds; teammate coupling; role scenarios; accuracy role buckets
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/projections/runProjectionV2.test.ts`
- **Leads (not audited):**
  - (opus) observation: tiers ignore whether a 'line' of 3 is actually a line (order of array assumed)
  - (opus) observation: L3 forwards counted DEPTH tier for usage bounds but MIDDLE_SIX bucket in accuracy (run-projection-accuracy.ts:603)

## M-FRG-099 Team-context finite mean

- **Match:** Codex only; Opus —; Codex context-mean
- **Purpose:** Average finite observations; return null when no valid values.
- **Where:** `web/lib/projections/queries/team-context-queries.ts:24 meanOrNull`
- **Tags (heuristic):** generation: current
- **Codex view (context-mean, calculation; Codex family 'FORGE context aggregation'):** Team-context finite mean
  - Purpose: Average finite observations; return null when no valid values.
  - Inputs/units: Same-unit team/strength observations.
  - Output scale: Mean in same units or null.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "source_state": "Assigned source paths remained clean at final git-status inspection.", "deployment": "Unknown; no live verification."}
  - Consumers: ["Same module/cited projection family; runtime invocation unverified."]
- **Audit context:**
  - Intended contract (Codex context-mean): {"source": "web/lib/projections/queries/team-context-queries.ts:24", "statement": "Average finite observations; return null when no valid values."}
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `{"status": "Discovered, not run", "references": ["web/lib/projections/queries/team-context-queries.test.ts"]}`
- **Leads (not audited):**
  - (codex:context-mean) ["No correctness/quality judgment. Active runtime and deployed version unknown."]

## M-FRG-100 Team and player PP opportunity means

- **Match:** Codex only; Opus —; Codex context-pp-usage-mean
- **Purpose:** Arithmetic means of per-game team PP skater seconds, PP shots, total skater seconds and each player’s PP seconds.
- **Where:** `web/lib/projections/queries/team-context-queries.ts:161 mean`
- **Tags (heuristic):** denominators: per game; generation: current
- **Codex view (context-pp-usage-mean, calculation; Codex family 'FORGE context aggregation'):** Team and player PP opportunity means
  - Purpose: Arithmetic means of per-game team PP skater seconds, PP shots, total skater seconds and each player’s PP seconds.
  - Inputs/units: Per-game native team/player strength totals.
  - Output scale: ppToiSkaterSecondsAvg,totalToiSkaterSecondsAvg,perPlayerPpToiAvgSec seconds; ppShotsAvg counts/game.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "source_state": "Assigned source paths remained clean at final git-status inspection.", "deployment": "Unknown; no live verification."}
  - Consumers: ["Same module/cited projection family; runtime invocation unverified."]
- **Audit context:**
  - Intended contract (Codex context-pp-usage-mean): {"source": "web/lib/projections/queries/team-context-queries.ts:161", "statement": "Arithmetic means of per-game team PP skater seconds, PP shots, total skater seconds and each player\u2019s PP seconds."}
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `{"status": "Discovered, not run", "references": ["web/lib/projections/queries/team-context-queries.test.ts"]}`
- **Leads (not audited):**
  - (codex:context-pp-usage-mean) ["No correctness/quality judgment. Active runtime and deployed version unknown."]

## M-FRG-101 Holdout comparator deltas and improvement

- **Match:** Codex only; Opus —; Codex promotion-comparator-improvement
- **Purpose:** Use finite matched rows; candidate-minus-baseline MAE/RMSE differences and 100*(baselineMAE-candidateMAE)/baselineMAE after minimum support.
- **Where:** `web/lib/projections/promotionGates.ts:149 buildComparatorReport`
- **Tags (heuristic):** generation: current
- **Codex view (promotion-comparator-improvement, calculation; Codex family 'Projection evaluation'):** Holdout comparator deltas and improvement
  - Purpose: Use finite matched rows; candidate-minus-baseline MAE/RMSE differences and 100*(baselineMAE-candidateMAE)/baselineMAE after minimum support.
  - Inputs/units: Matched forecasts, labels and comparator, minimum sample count.
  - Output scale: Signed MAE/RMSE deltas, percent improvement, ready/insufficient-data.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "source_state": "Assigned source paths remained clean at final git-status inspection.", "deployment": "Unknown; no live verification."}
  - Consumers: ["Same module/cited projection family; runtime invocation unverified."]
- **Audit context:**
  - Intended contract (Codex promotion-comparator-improvement): {"source": "web/lib/projections/promotionGates.ts:149", "statement": "Use finite matched rows; candidate-minus-baseline MAE/RMSE differences and 100*(baselineMAE-candidateMAE)/baselineMAE after minimum support."}
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `{"status": "Discovered, not run", "references": ["web/lib/projections/promotionGates.test.ts"]}`
- **Leads (not audited):**
  - (codex:promotion-comparator-improvement) ["No correctness/quality judgment. Active runtime and deployed version unknown."]

## M-FRG-102 Holdout MAE and RMSE

- **Match:** Codex only; Opus —; Codex promotion-holdout-errors
- **Purpose:** MAE=mean(abs(predicted-actual)); RMSE=sqrt(mean((predicted-actual)^2)); round4; empty sample returns null.
- **Where:** `web/lib/projections/promotionGates.ts:127 summarizeHoldoutMetric`
- **Tags (heuristic):** generation: current
- **Codex view (promotion-holdout-errors, calculation; Codex family 'Projection evaluation'):** Holdout MAE and RMSE
  - Purpose: MAE=mean(abs(predicted-actual)); RMSE=sqrt(mean((predicted-actual)^2)); round4; empty sample returns null.
  - Inputs/units: Matched forecast/actual values in same target units.
  - Output scale: Sample count, MAE and RMSE in target units.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "source_state": "Assigned source paths remained clean at final git-status inspection.", "deployment": "Unknown; no live verification."}
  - Consumers: ["Same module/cited projection family; runtime invocation unverified."]
- **Audit context:**
  - Intended contract (Codex promotion-holdout-errors): {"source": "web/lib/projections/promotionGates.ts:127", "statement": "MAE=mean(abs(predicted-actual)); RMSE=sqrt(mean((predicted-actual)^2)); round4; empty sample returns null."}
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `{"status": "Discovered, not run", "references": ["web/lib/projections/promotionGates.test.ts"]}`
- **Leads (not audited):**
  - (codex:promotion-holdout-errors) ["No correctness/quality judgment. Active runtime and deployed version unknown."]

## M-FRG-103 proj_assists_es

- **Match:** Codex only; Opus —; Codex staged-head-proj_assists_es
- **Purpose:** ES expected on-ice team goals × player assist share × team assist scaling, with scenario/bootstrap and horizon scaling
- **Where:** `web/lib/projections/stages/skater-stage.ts:3222 runPerGameSkaterStage / proj_assists_es`
- **Tags (heuristic):** denominators: per 60
- **Codex view (staged-head-proj_assists_es, calculation; Codex family 'FORGE staged output metric'):** proj_assists_es
  - Purpose: ES expected on-ice team goals × player assist share × team assist scaling, with scenario/bootstrap and horizon scaling
  - Inputs/units: Projected strength usage in seconds; rates per60, goal-per-shot conversion or assist shares; team opportunity and horizon scalars.
  - Output scale: Expected assists over requested horizon; integer rounding only for TOI fields.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "deployment": "Unknown"}
  - Consumers: ["forge player/team projection persistence and /api/v1/forge readers; static source evidence only."]
- **Audit context:**
  - Intended contract (Codex staged-head-proj_assists_es): {"source": "web/lib/projections/stages/skater-stage.ts:3222", "statement": "Declared persisted staged output; source metadata/participation basis must accompany values. Do not silently equate ES+PP-only goals with full-game all-strength goals."}
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `{"status": "Discovered; not run", "references": ["web/lib/projections/runProjectionV2.test.ts", "web/lib/projections/nativeGoalAccounting.test.ts"]}`
- **Leads (not audited):**
  - (codex:staged-head-proj_assists_es) ["Active rollout/flags and live input completeness unknown."]

## M-FRG-104 proj_assists_pp

- **Match:** Codex only; Opus —; Codex staged-head-proj_assists_pp
- **Purpose:** PP expected on-ice team goals × player assist share × team assist scaling, with scenario/bootstrap and horizon scaling
- **Where:** `web/lib/projections/stages/skater-stage.ts:3225 runPerGameSkaterStage / proj_assists_pp`
- **Tags (heuristic):** denominators: per 60
- **Codex view (staged-head-proj_assists_pp, calculation; Codex family 'FORGE staged output metric'):** proj_assists_pp
  - Purpose: PP expected on-ice team goals × player assist share × team assist scaling, with scenario/bootstrap and horizon scaling
  - Inputs/units: Projected strength usage in seconds; rates per60, goal-per-shot conversion or assist shares; team opportunity and horizon scalars.
  - Output scale: Expected assists over requested horizon; integer rounding only for TOI fields.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "deployment": "Unknown"}
  - Consumers: ["forge player/team projection persistence and /api/v1/forge readers; static source evidence only."]
- **Audit context:**
  - Intended contract (Codex staged-head-proj_assists_pp): {"source": "web/lib/projections/stages/skater-stage.ts:3225", "statement": "Declared persisted staged output; source metadata/participation basis must accompany values. Do not silently equate ES+PP-only goals with full-game all-strength goals."}
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `{"status": "Discovered; not run", "references": ["web/lib/projections/runProjectionV2.test.ts", "web/lib/projections/nativeGoalAccounting.test.ts"]}`
- **Leads (not audited):**
  - (codex:staged-head-proj_assists_pp) ["Active rollout/flags and live input completeness unknown."]

## M-FRG-105 proj_blocks

- **Match:** Codex only; Opus —; Codex staged-head-proj_blocks
- **Purpose:** All-situation physical TOI minutes × shrunken blocks/60 ÷60, bootstrap and horizon scaling
- **Where:** `web/lib/projections/stages/skater-stage.ts:3230 runPerGameSkaterStage / proj_blocks`
- **Tags (heuristic):** denominators: per 60
- **Codex view (staged-head-proj_blocks, calculation; Codex family 'FORGE staged output metric'):** proj_blocks
  - Purpose: All-situation physical TOI minutes × shrunken blocks/60 ÷60, bootstrap and horizon scaling
  - Inputs/units: Projected strength usage in seconds; rates per60, goal-per-shot conversion or assist shares; team opportunity and horizon scalars.
  - Output scale: Expected blocked shots over requested horizon; integer rounding only for TOI fields.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "deployment": "Unknown"}
  - Consumers: ["forge player/team projection persistence and /api/v1/forge readers; static source evidence only."]
- **Audit context:**
  - Intended contract (Codex staged-head-proj_blocks): {"source": "web/lib/projections/stages/skater-stage.ts:3230", "statement": "Declared persisted staged output; source metadata/participation basis must accompany values. Do not silently equate ES+PP-only goals with full-game all-strength goals."}
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `{"status": "Discovered; not run", "references": ["web/lib/projections/runProjectionV2.test.ts", "web/lib/projections/nativeGoalAccounting.test.ts"]}`
- **Leads (not audited):**
  - (codex:staged-head-proj_blocks) ["Active rollout/flags and live input completeness unknown."]

## M-FRG-106 proj_goals_es

- **Match:** Codex only; Opus —; Codex staged-head-proj_goals_es
- **Purpose:** ES projected shots × shrunken/context-adjusted ES goal conversion, with scenario/bootstrap selection and horizon scaling
- **Where:** `web/lib/projections/stages/skater-stage.ts:3219 runPerGameSkaterStage / proj_goals_es`
- **Tags (heuristic):** denominators: per 60
- **Codex view (staged-head-proj_goals_es, calculation; Codex family 'FORGE staged output metric'):** proj_goals_es
  - Purpose: ES projected shots × shrunken/context-adjusted ES goal conversion, with scenario/bootstrap selection and horizon scaling
  - Inputs/units: Projected strength usage in seconds; rates per60, goal-per-shot conversion or assist shares; team opportunity and horizon scalars.
  - Output scale: Expected goals over requested horizon; integer rounding only for TOI fields.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "deployment": "Unknown"}
  - Consumers: ["forge player/team projection persistence and /api/v1/forge readers; static source evidence only."]
- **Audit context:**
  - Intended contract (Codex staged-head-proj_goals_es): {"source": "web/lib/projections/stages/skater-stage.ts:3219", "statement": "Declared persisted staged output; source metadata/participation basis must accompany values. Do not silently equate ES+PP-only goals with full-game all-strength goals."}
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `{"status": "Discovered; not run", "references": ["web/lib/projections/runProjectionV2.test.ts", "web/lib/projections/nativeGoalAccounting.test.ts"]}`
- **Leads (not audited):**
  - (codex:staged-head-proj_goals_es) ["Active rollout/flags and live input completeness unknown."]

## M-FRG-107 proj_goals_pp

- **Match:** Codex only; Opus —; Codex staged-head-proj_goals_pp
- **Purpose:** PP projected shots × shrunken/context-adjusted PP goal conversion, with scenario/bootstrap selection and horizon scaling
- **Where:** `web/lib/projections/stages/skater-stage.ts:3220 runPerGameSkaterStage / proj_goals_pp`
- **Tags (heuristic):** denominators: per 60
- **Codex view (staged-head-proj_goals_pp, calculation; Codex family 'FORGE staged output metric'):** proj_goals_pp
  - Purpose: PP projected shots × shrunken/context-adjusted PP goal conversion, with scenario/bootstrap selection and horizon scaling
  - Inputs/units: Projected strength usage in seconds; rates per60, goal-per-shot conversion or assist shares; team opportunity and horizon scalars.
  - Output scale: Expected goals over requested horizon; integer rounding only for TOI fields.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "deployment": "Unknown"}
  - Consumers: ["forge player/team projection persistence and /api/v1/forge readers; static source evidence only."]
- **Audit context:**
  - Intended contract (Codex staged-head-proj_goals_pp): {"source": "web/lib/projections/stages/skater-stage.ts:3220", "statement": "Declared persisted staged output; source metadata/participation basis must accompany values. Do not silently equate ES+PP-only goals with full-game all-strength goals."}
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `{"status": "Discovered; not run", "references": ["web/lib/projections/runProjectionV2.test.ts", "web/lib/projections/nativeGoalAccounting.test.ts"]}`
- **Leads (not audited):**
  - (codex:staged-head-proj_goals_pp) ["Active rollout/flags and live input completeness unknown."]

## M-FRG-108 proj_hits

- **Match:** Codex only; Opus —; Codex staged-head-proj_hits
- **Purpose:** All-situation physical TOI minutes × shrunken hits/60 ÷60, bootstrap and horizon scaling
- **Where:** `web/lib/projections/stages/skater-stage.ts:3229 runPerGameSkaterStage / proj_hits`
- **Tags (heuristic):** denominators: per 60
- **Codex view (staged-head-proj_hits, calculation; Codex family 'FORGE staged output metric'):** proj_hits
  - Purpose: All-situation physical TOI minutes × shrunken hits/60 ÷60, bootstrap and horizon scaling
  - Inputs/units: Projected strength usage in seconds; rates per60, goal-per-shot conversion or assist shares; team opportunity and horizon scalars.
  - Output scale: Expected hits over requested horizon; integer rounding only for TOI fields.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "deployment": "Unknown"}
  - Consumers: ["forge player/team projection persistence and /api/v1/forge readers; static source evidence only."]
- **Audit context:**
  - Intended contract (Codex staged-head-proj_hits): {"source": "web/lib/projections/stages/skater-stage.ts:3229", "statement": "Declared persisted staged output; source metadata/participation basis must accompany values. Do not silently equate ES+PP-only goals with full-game all-strength goals."}
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `{"status": "Discovered; not run", "references": ["web/lib/projections/runProjectionV2.test.ts", "web/lib/projections/nativeGoalAccounting.test.ts"]}`
- **Leads (not audited):**
  - (codex:staged-head-proj_hits) ["Active rollout/flags and live input completeness unknown."]

## M-FRG-109 proj_shots_es

- **Match:** Codex only; Opus —; Codex staged-head-proj_shots_es
- **Purpose:** ES usage seconds × ES SOG/60 ÷3600, after context/reconciliation/bootstrap, horizon-scaled
- **Where:** `web/lib/projections/stages/skater-stage.ts:3216 runPerGameSkaterStage / proj_shots_es`
- **Tags (heuristic):** denominators: per 60
- **Codex view (staged-head-proj_shots_es, calculation; Codex family 'FORGE staged output metric'):** proj_shots_es
  - Purpose: ES usage seconds × ES SOG/60 ÷3600, after context/reconciliation/bootstrap, horizon-scaled
  - Inputs/units: Projected strength usage in seconds; rates per60, goal-per-shot conversion or assist shares; team opportunity and horizon scalars.
  - Output scale: Expected shots over requested horizon; integer rounding only for TOI fields.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "deployment": "Unknown"}
  - Consumers: ["forge player/team projection persistence and /api/v1/forge readers; static source evidence only."]
- **Audit context:**
  - Intended contract (Codex staged-head-proj_shots_es): {"source": "web/lib/projections/stages/skater-stage.ts:3216", "statement": "Declared persisted staged output; source metadata/participation basis must accompany values. Do not silently equate ES+PP-only goals with full-game all-strength goals."}
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `{"status": "Discovered; not run", "references": ["web/lib/projections/runProjectionV2.test.ts", "web/lib/projections/nativeGoalAccounting.test.ts"]}`
- **Leads (not audited):**
  - (codex:staged-head-proj_shots_es) ["Active rollout/flags and live input completeness unknown."]

## M-FRG-110 proj_shots_pp

- **Match:** Codex only; Opus —; Codex staged-head-proj_shots_pp
- **Purpose:** PP usage seconds × PP SOG/60 ÷3600, after context/reconciliation/bootstrap, horizon-scaled
- **Where:** `web/lib/projections/stages/skater-stage.ts:3217 runPerGameSkaterStage / proj_shots_pp`
- **Tags (heuristic):** denominators: per 60
- **Codex view (staged-head-proj_shots_pp, calculation; Codex family 'FORGE staged output metric'):** proj_shots_pp
  - Purpose: PP usage seconds × PP SOG/60 ÷3600, after context/reconciliation/bootstrap, horizon-scaled
  - Inputs/units: Projected strength usage in seconds; rates per60, goal-per-shot conversion or assist shares; team opportunity and horizon scalars.
  - Output scale: Expected shots over requested horizon; integer rounding only for TOI fields.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "deployment": "Unknown"}
  - Consumers: ["forge player/team projection persistence and /api/v1/forge readers; static source evidence only."]
- **Audit context:**
  - Intended contract (Codex staged-head-proj_shots_pp): {"source": "web/lib/projections/stages/skater-stage.ts:3217", "statement": "Declared persisted staged output; source metadata/participation basis must accompany values. Do not silently equate ES+PP-only goals with full-game all-strength goals."}
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `{"status": "Discovered; not run", "references": ["web/lib/projections/runProjectionV2.test.ts", "web/lib/projections/nativeGoalAccounting.test.ts"]}`
- **Leads (not audited):**
  - (codex:staged-head-proj_shots_pp) ["Active rollout/flags and live input completeness unknown."]

## M-FRG-111 proj_toi_es_seconds

- **Match:** Codex only; Opus —; Codex staged-head-proj_toi_es_seconds
- **Purpose:** Horizon-scaled reconciled ES usage, rounded to integer seconds
- **Where:** `web/lib/projections/stages/skater-stage.ts:3213 runPerGameSkaterStage / proj_toi_es_seconds`
- **Tags (heuristic):** denominators: per 60
- **Codex view (staged-head-proj_toi_es_seconds, calculation; Codex family 'FORGE staged output metric'):** proj_toi_es_seconds
  - Purpose: Horizon-scaled reconciled ES usage, rounded to integer seconds
  - Inputs/units: Projected strength usage in seconds; rates per60, goal-per-shot conversion or assist shares; team opportunity and horizon scalars.
  - Output scale: Expected seconds over requested horizon; integer rounding only for TOI fields.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "deployment": "Unknown"}
  - Consumers: ["forge player/team projection persistence and /api/v1/forge readers; static source evidence only."]
- **Audit context:**
  - Intended contract (Codex staged-head-proj_toi_es_seconds): {"source": "web/lib/projections/stages/skater-stage.ts:3213", "statement": "Declared persisted staged output; source metadata/participation basis must accompany values. Do not silently equate ES+PP-only goals with full-game all-strength goals."}
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `{"status": "Discovered; not run", "references": ["web/lib/projections/runProjectionV2.test.ts", "web/lib/projections/nativeGoalAccounting.test.ts"]}`
- **Leads (not audited):**
  - (codex:staged-head-proj_toi_es_seconds) ["Active rollout/flags and live input completeness unknown."]

## M-FRG-112 proj_toi_pp_seconds

- **Match:** Codex only; Opus —; Codex staged-head-proj_toi_pp_seconds
- **Purpose:** Horizon-scaled reconciled PP usage, rounded to integer seconds
- **Where:** `web/lib/projections/stages/skater-stage.ts:3214 runPerGameSkaterStage / proj_toi_pp_seconds`
- **Tags (heuristic):** denominators: per 60
- **Codex view (staged-head-proj_toi_pp_seconds, calculation; Codex family 'FORGE staged output metric'):** proj_toi_pp_seconds
  - Purpose: Horizon-scaled reconciled PP usage, rounded to integer seconds
  - Inputs/units: Projected strength usage in seconds; rates per60, goal-per-shot conversion or assist shares; team opportunity and horizon scalars.
  - Output scale: Expected seconds over requested horizon; integer rounding only for TOI fields.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "deployment": "Unknown"}
  - Consumers: ["forge player/team projection persistence and /api/v1/forge readers; static source evidence only."]
- **Audit context:**
  - Intended contract (Codex staged-head-proj_toi_pp_seconds): {"source": "web/lib/projections/stages/skater-stage.ts:3214", "statement": "Declared persisted staged output; source metadata/participation basis must accompany values. Do not silently equate ES+PP-only goals with full-game all-strength goals."}
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `{"status": "Discovered; not run", "references": ["web/lib/projections/runProjectionV2.test.ts", "web/lib/projections/nativeGoalAccounting.test.ts"]}`
- **Leads (not audited):**
  - (codex:staged-head-proj_toi_pp_seconds) ["Active rollout/flags and live input completeness unknown."]

## M-FRG-113 Build accountability (buildAccountability)

- **Match:** Codex only; Opus —; Codex web-lib-forge-v2-evaluation-buildaccountability
- **Purpose:** Exact-profile public projection. Internal observation IDs/dependence manifests never leave this boundary.
- **Where:** `web/lib/forge-v2/evaluation.ts:230 buildAccountability`
- **Tags (heuristic):** generation: current
- **Codex view (web-lib-forge-v2-evaluation-buildaccountability, symbol_candidate; Codex family 'FORGE v2 development kernel and ledger'):** Build accountability (buildAccountability)
  - Purpose: Exact-profile public projection. Internal observation IDs/dependence manifests never leave this boundary.
  - Inputs/units: Parameter/type declaration excerpt: export function buildAccountability(input: { evaluations: readonly EvaluationRevision[]; publications: readonly PublishedVintage[]; baselines?: readonly MatchedBaseline[]; profile: ScoringProfile; evidenceClass: EvidenceClass }): PublicAccountability { const rows = input.evaluations.filter(row => row.profile.id === input.profile.id && row.selection.evidenceClass === input.evidenceClass); if (rows.some(row => contentHash(row.profile.weights) !== contentHash(input.profile.weights))) throw new Error("Accountability profile identity conflict"); const reports = summarizeAccountability(rows, input.publications, input.baselines); // Overall point accuracy is FP only: combining category units would mislead. const fp = rows.filter(row => row.valueKind === "FP");…
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
  - Consumers: ["web/lib/forge-v2/preparation.server.ts:7"]
- **Audit context:**
  - Intended contract (Codex web-lib-forge-v2-evaluation-buildaccountability): {"source": "web/lib/forge-v2/evaluation.ts:230", "explicit_comment": "Exact-profile public projection. Internal observation IDs/dependence manifests never leave this boundary.", "arithmetic_locations": ["web/lib/forge-v2/evaluation.ts:243 /** Whitelist the public metric DTO, including nested fields, and refuse cross-profile reuse. */"]}
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `{"status": "Discovered only; not run", "references": ["web/lib/forge-v2/evaluation.test.ts:6"]}`
- **Leads (not audited):**
  - (codex:web-lib-forge-v2-evaluation-buildaccountability) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-FRG-114 Errors (errors)

- **Match:** Codex only; Opus —; Codex web-lib-forge-v2-evaluation-errors
- **Possible related records (low-confidence location link, unconfirmed):** FRG-095
- **Purpose:** Errors for forge v2 development kernel and ledger. Exact arithmetic locations are recorded below; no correctness judgment is made.
- **Where:** `web/lib/forge-v2/evaluation.ts:183 errors`
- **Tags (heuristic):** generation: current
- **Codex view (web-lib-forge-v2-evaluation-errors, symbol_candidate; Codex family 'FORGE v2 development kernel and ledger'):** Errors (errors)
  - Purpose: Errors for forge v2 development kernel and ledger. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: function errors(values: number[]) { return { count: values.length, mae: mean(values.map(Math.abs)), mse: mean(values.map(value => value * value)), rmse: values.length ? Math.sqrt(mean(values.map(value => value * value))!) : null, bias: mean(values) }; } /** Caller supplies one settled revision per checkpoint; mixing revisions is rejected. No IID uncertainty is claimed. */
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
  - Consumers: ["modeling/player_forecasts/daily_board.py:74", "modeling/player_forecasts/forge_walk_forward.py:387", "modeling/player_forecasts/scoring.py:14", "web/components/CommentForm/CommentForm.tsx:94", "web/components/CronReportEmail/CronReportEmail.tsx:316", "web/components/DraftDashboard/DraftDashboard.tsx:3035", "web/components/DraftDashboard/DraftSettingsShell.tsx:96", "web/components/DraftDashboard…
- **Audit context:**
  - Intended contract (Codex web-lib-forge-v2-evaluation-errors): {"source": "web/lib/forge-v2/evaluation.ts:183", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["web/lib/forge-v2/evaluation.ts:183 function errors(values: number[]) { return { count: values.length, mae: mean(values.map(Math.abs)), mse: mean(values.map(value => value * value)), rmse: values.length ? Math.sqrt(mean(values.map(value => value * value))!) : null, bias: mean(values) }; }", "web/lib/forge-v2/evaluation.ts:185 /** Caller supplies one settled revision per checkpoint; mixing revisions is rejected. No IID uncertainty is claimed. */"]}
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `{"status": "Discovered only; not run", "references": ["web/__tests__/components/DraftDashboard/DraftSettingsShell.test.tsx:55", "web/__tests__/components/DraftDashboard/ImportCsvModal.test.tsx:23", "web/__tests__/components/DraftDashboard/KeeperWorkflow.test.tsx:248", "web/__tests__/components/DraftDashboard/YahooLiveDraftPanel.test.tsx:85", "web/__tests__/components/RosterScheduleOptimizer/RosterScheduleOptimizer.test.tsx:1415", "web/__tests__/pages/api/internal/yahoo-live-draft.test.ts:114", "web/__tests__/pages/api/v1/account/patreon/routes.test.ts:137", "web/__tests__/pages/api/v1/account/yahoo/team-roster.test.ts:114", "web/__tests__/pages/api/v1/db/backfill-player-underlying-season.test.ts:165", "web/__tests__/pages/api/v1/db/cron-auth-boundaries.test.ts:472", "web/__tests__/pages/api/v1/db/cron-report.test.ts:587", "web/__tests__/pages/api/v1/db/ingest-projection-inputs.test.ts:548"]}`
- **Leads (not audited):**
  - (codex:web-lib-forge-v2-evaluation-errors) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-FRG-115 Settle evaluation (settleEvaluation)

- **Match:** Codex only; Opus —; Codex web-lib-forge-v2-evaluation-settleevaluation
- **Purpose:** Settle evaluation for forge v2 development kernel and ledger. Exact arithmetic locations are recorded below; no correctness judgment is made.
- **Where:** `web/lib/forge-v2/evaluation.ts:157 settleEvaluation`
- **Tags (heuristic):** generation: current
- **Codex view (web-lib-forge-v2-evaluation-settleevaluation, symbol_candidate; Codex family 'FORGE v2 development kernel and ledger'):** Settle evaluation (settleEvaluation)
  - Purpose: Settle evaluation for forge v2 development kernel and ledger. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: export function settleEvaluation(input: { id: string; selection: Selection; publication: PublishedVintage \| null; outcome: OutcomeRevision \| null; profile: ScoringProfile; valueKind: EvaluationRevision["valueKind"]; recordedAt: Instant; period: string; rescheduled: boolean; intervals?: Component<Interval[]>; prior?: EvaluationRevision; selectionRevision?: SelectionRevision; priorSelectionRevision?: SelectionRevision; correctionReason?: string; label?: EvaluationRevision["label"] }): EvaluationRevision { const { selection, publication, outcome, profile } = input; instant(input.recordedAt); assertTarget(selection); if (outcome) { assertSource(outcome.source, input.recordedAt); assertObservedCounts(outcome.values); } if (publication && (publication.vinta…
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
  - Consumers: ["web/lib/forge-v2/preparation.server.ts:7"]
- **Audit context:**
  - Intended contract (Codex web-lib-forge-v2-evaluation-settleevaluation): {"source": "web/lib/forge-v2/evaluation.ts:157", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["web/lib/forge-v2/evaluation.ts:178 return { id: input.id, predecessorId: input.prior?.id ?? null, recordedAt: input.recordedAt, selection: structuredClone(selection), outcomeId: outcome?.id ?? null, appearance: outcome?.appearance ?? \"pending\", status: outcome?.status ?? \"pending\", profile: structuredClone(profile), valueKind: input.valueKind, forecast: structuredClone(forecast), actual: structuredClone(actual), error, probability: v && selection.state === \"selected\" ? structuredClone(v.participation.probability) : unavailable(\"forecast_missing\"), participationActual, interval: structuredClone(input.intervals ?? unavailable(\"interval_unavailable\")), modelVersion: v?.modelVersion ?? null, cohort: v?.cohort ?? \"unresolved\", period: input.period, leadHours: v ? (instant(v.scheduledStartAt) - instant(publication!.receipt.confirmedAt)) / 3600000 : null, rescheduled: input.rescheduled, dependence: { player: String(selection.playerId), game: String(selection.gameId), slate: v?.sourceGameDate ?? \"unknown\", tim…
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `{"status": "Discovered only; not run", "references": ["web/lib/forge-v2/evaluation.test.ts:6", "web/lib/forge-v2/lifecycle.test.ts:19"]}`
- **Leads (not audited):**
  - (codex:web-lib-forge-v2-evaluation-settleevaluation) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-FRG-116 Summarize accountability (summarizeAccountability)

- **Match:** Codex only; Opus —; Codex web-lib-forge-v2-evaluation-summarizeaccountability
- **Possible related records (low-confidence location link, unconfirmed):** FRG-095
- **Purpose:** Caller supplies one settled revision per checkpoint; mixing revisions is rejected. No IID uncertainty is claimed.
- **Where:** `web/lib/forge-v2/evaluation.ts:186 summarizeAccountability`
- **Tags (heuristic):** generation: current
- **Codex view (web-lib-forge-v2-evaluation-summarizeaccountability, symbol_candidate; Codex family 'FORGE v2 development kernel and ledger'):** Summarize accountability (summarizeAccountability)
  - Purpose: Caller supplies one settled revision per checkpoint; mixing revisions is rejected. No IID uncertainty is claimed.
  - Inputs/units: Parameter/type declaration excerpt: export function summarizeAccountability(rows: readonly EvaluationRevision[], publications: readonly PublishedVintage[], baselines: readonly MatchedBaseline[] = []) { const seen = new Set<string>(); const strata = new Map<string, EvaluationRevision[]>(); for (const row of rows) { const s = row.selection; const key = [targetKey(s), s.series, s.horizon, s.evidenceClass, row.profile.id, row.valueKind].join("\|"); if (seen.has(key)) throw new Error("Duplicate primary observation or evaluation revision"); seen.add(key); const stratum = [s.evidenceClass, s.series, s.horizon ?? "final", row.modelVersion ?? "unavailable", row.cohort, row.period, row.profile.id, row.valueKind, row.label].join("\|"); const group = strata.get(stratum) ?? []; group.push(row); strata…
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
  - Consumers: ["No external static symbol reference found in bounded source search; may be module-internal or indirect."]
- **Audit context:**
  - Intended contract (Codex web-lib-forge-v2-evaluation-summarizeaccountability): {"source": "web/lib/forge-v2/evaluation.ts:186", "explicit_comment": "Caller supplies one settled revision per checkpoint; mixing revisions is rejected. No IID uncertainty is claimed.", "arithmetic_locations": ["web/lib/forge-v2/evaluation.ts:204 return [{ covered: Number(y >= band.lower && y <= band.upper), width: band.upper - band.lower, score: band.upper - band.lower + 2 / alpha * Math.max(0, band.lower - y, y - band.upper) }];", "web/lib/forge-v2/evaluation.ts:206 return { level, count: evaluated.length, missing: group.length - evaluated.length, coverage: mean(evaluated.map(row => row.covered)), width: mean(evaluated.map(row => row.width)), intervalScore: mean(evaluated.map(row => row.score)) };", "web/lib/forge-v2/evaluation.ts:223 return { name, requested: group.length, paired: pairs.length, coverage: pairs.length / group.length, candidate, baseline, mseImprovement: candidate.mse === null \|\| baseline.mse === null ? null : baseline.mse - candidate.mse };", "web/lib/forge-v2/evaluation.ts:225 return { stratum, dimensions: { evidenceClass: group[0].selection.evidenceClass, series: group[0].selection.series, horizon: group[0].selection.horizon, modelVersion: group[0].modelVers…
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `{"status": "Discovered only; not run", "references": ["web/lib/forge-v2/evaluation.test.ts:6"]}`
- **Leads (not audited):**
  - (codex:web-lib-forge-v2-evaluation-summarizeaccountability) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-FRG-117 Summarize horizon evaluations (summarizeHorizonEvaluations)

- **Match:** Codex only; Opus —; Codex web-lib-forge-v2-horizonevaluation-summarizehorizonevaluations
- **Purpose:** Separate horizon summaries; undefined ratios and unavailable heads have explicit denominators.
- **Where:** `web/lib/forge-v2/horizonEvaluation.ts:240 summarizeHorizonEvaluations`
- **Tags (heuristic):** generation: current
- **Codex view (web-lib-forge-v2-horizonevaluation-summarizehorizonevaluations, symbol_candidate; Codex family 'FORGE v2 development kernel and ledger'):** Summarize horizon evaluations (summarizeHorizonEvaluations)
  - Purpose: Separate horizon summaries; undefined ratios and unavailable heads have explicit denominators.
  - Inputs/units: Parameter/type declaration excerpt: export function summarizeHorizonEvaluations(rows: Array<ReturnType<typeof evaluateHorizon>>) { const average = (values: number[]) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null; return ([1, 10, 20] as const).map(horizon => { const requested = rows.filter(row => row.horizon === horizon); const graded = requested.filter(row => row.state === "evaluated"); if (new Set(graded.map(row => row.evidenceClass)).size > 1) throw new Error("Mixed evaluation evidence classes"); const heads = [...new Set(graded.flatMap(row => Object.keys(row.scores)))]; const probabilities = graded.flatMap(row => row.participation ? [row.participation] : []); return { horizon, requested: requested.length, evaluated: graded.length, unavailable: requested.fl…
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": ["forge-frozen-calendar-evaluation-v1"], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
  - Consumers: ["web/scripts/forge-horizon-evaluate.ts:4"]
- **Audit context:**
  - Intended contract (Codex web-lib-forge-v2-horizonevaluation-summarizehorizonevaluations): {"source": "web/lib/forge-v2/horizonEvaluation.ts:240", "explicit_comment": "Separate horizon summaries; undefined ratios and unavailable heads have explicit denominators.", "arithmetic_locations": ["web/lib/forge-v2/horizonEvaluation.ts:241 const average = (values: number[]) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;", "web/lib/forge-v2/horizonEvaluation.ts:254 mae: average(scores.map(score => score.absoluteError)), rmse: scores.length ? Math.sqrt(average(scores.map(score => score.squaredError))!) : null,", "web/lib/forge-v2/horizonEvaluation.ts:266 const members = probabilities.filter(row => Math.min(9, Math.floor(row.probability * 10)) === bin);", "web/lib/forge-v2/horizonEvaluation.ts:272 /** Frozen artifacts only: no fit, network, consumer writes, or candidate promotion occurs here. */"]}
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `{"status": "Discovered only; not run", "references": ["web/lib/forge-v2/horizonEvaluation.test.ts (module test)"]}`
- **Leads (not audited):**
  - (codex:web-lib-forge-v2-horizonevaluation-summarizehorizonevaluations) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-FRG-118 Totals (totals)

- **Match:** Codex only; Opus —; Codex web-lib-forge-v2-horizonevaluation-totals
- **Purpose:** Includes all declared player contributions in the frozen calendar, even >H games after a trade.
- **Where:** `web/lib/forge-v2/horizonEvaluation.ts:123 totals`
- **Tags (heuristic):** generation: current
- **Codex view (web-lib-forge-v2-horizonevaluation-totals, symbol_candidate; Codex family 'FORGE v2 development kernel and ledger'):** Totals (totals)
  - Purpose: Includes all declared player contributions in the frozen calendar, even >H games after a trade.
  - Inputs/units: Parameter/type declaration excerpt: function totals(games: CalendarGame[], kind: FrozenHorizonForecast["kind"], start: string, end: string): OutcomeCounts { const included = games.filter(game => instant(game.startsAt) > instant(start) && instant(game.startsAt) <= instant(end)); const sums = Object.fromEntries(keys(kind).map(key => [key, included.some(game => game.counts[key] === null) ? null : included.reduce((sum, game) => sum + game.counts[key]!, 0)])) as OutcomeCounts; if (kind === "goalie") { sums.SV_PCT = sums.SA !== null && sums.SA > 0 && sums.SV !== null ? sums.SV / sums.SA : null; sums.GAA = sums.MIN !== null && sums.MIN > 0 && sums.GA !== null ? 60 * sums.GA / sums.MIN : null; } return sums; }
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": ["forge-frozen-calendar-evaluation-v1"], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
  - Consumers: ["modeling/player_forecasts/advanced.py:382", "modeling/player_forecasts/daily_board_context.py:230", "modeling/player_forecasts/daily_board_data.py:93", "modeling/player_forecasts/pp_evidence_capture.py:603", "modeling/player_forecasts/rookies.py:264", "web/components/CronReportEmail/CronAuditEmail.tsx:183", "web/components/DateRangeMatrix/fetchAggregatedData.ts:666", "web/components/DraftDashbo…
- **Audit context:**
  - Intended contract (Codex web-lib-forge-v2-horizonevaluation-totals): {"source": "web/lib/forge-v2/horizonEvaluation.ts:123", "explicit_comment": "Includes all declared player contributions in the frozen calendar, even >H games after a trade.", "arithmetic_locations": ["web/lib/forge-v2/horizonEvaluation.ts:128 sums.SV_PCT = sums.SA !== null && sums.SA > 0 && sums.SV !== null ? sums.SV / sums.SA : null;", "web/lib/forge-v2/horizonEvaluation.ts:129 sums.GAA = sums.MIN !== null && sums.MIN > 0 && sums.GA !== null ? 60 * sums.GA / sums.MIN : null;"]}
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `{"status": "Discovered only; not run", "references": ["modeling/player_forecasts/tests/test_harness.py:395", "web/__tests__/components/CronReportEmail/CronAuditEmail.test.tsx:169", "web/__tests__/components/DraftDashboard/LeagueStandings.test.tsx:7", "web/__tests__/components/DraftDashboard/ProjectionsTable.test.tsx:462", "web/__tests__/components/RosterScheduleOptimizer/CategoryGains.test.tsx:32", "web/__tests__/components/RosterScheduleOptimizer/RosterScheduleOptimizer.test.tsx:350", "web/__tests__/components/RosterScheduleOptimizer/StreamingItinerary.test.tsx:37", "web/__tests__/lib/cron/wgoIngestion.test.ts:66", "web/__tests__/pages/api/Teams/nst-team-stats.route.test.ts:207", "web/__tests__/pages/api/v1/db/calculate-wigo-stats.test.ts:61", "web/__tests__/pages/api/v1/db/cron-audit-wrappers.test.ts:51", "web/__tests__/pages/api/v1/db/cron-report.test.ts:245"]}`
- **Leads (not audited):**
  - (codex:web-lib-forge-v2-horizonevaluation-totals) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-FRG-119 Seven-category linear fantasy points (scoreMeans)

- **Match:** Codex only; Opus —; Codex web-lib-forge-v2-identity-scoremeans
- **Possible related records (low-confidence location link, unconfirmed):** FRG-026
- **Purpose:** Sum category mean × profile weight; missing contributing head withholds score. Defaults G=3,A=2,PPP=1,SOG=.2,HIT=.2,BLK=.25,PIM=0.
- **Where:** `web/lib/forge-v2/identity.ts:31 scoreMeans`
- **Tags (heuristic):** generation: current
- **Codex view (web-lib-forge-v2-identity-scoremeans, calculation; Codex family 'FORGE v2 development kernel and ledger'):** Seven-category linear fantasy points (scoreMeans)
  - Purpose: Sum category mean × profile weight; missing contributing head withholds score. Defaults G=3,A=2,PPP=1,SOG=.2,HIT=.2,BLK=.25,PIM=0.
  - Inputs/units: Named model/observation inputs at cited declaration; Fantasy points per modeled appearance. Input count/rate units follow the corresponding named outcome; cutoff timestamps and identity are required where declared.
  - Output scale: Fantasy points per modeled appearance.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
  - Consumers: ["web/lib/forge-v2/api.server.ts:3", "web/lib/forge-v2/evaluation.ts:3", "web/lib/forge-v2/model.ts:2", "web/lib/forge-v2/preparation.server.ts:6"]
- **Audit context:**
  - Intended contract (Codex web-lib-forge-v2-identity-scoremeans): {"source": "web/lib/forge-v2/identity.ts:31", "explicit_comment": "Arithmetic only. Serving must separately enforce qualification for contributing categories.", "arithmetic_locations": ["web/lib/forge-v2/identity.ts:41 result += weight * mean.value;"]}
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `{"status": "Discovered only; not run", "references": ["web/lib/forge-v2/contracts.test.ts:3", "web/lib/forge-v2/lifecycle.test.ts:10"]}`
- **Leads (not audited):**
  - (codex:web-lib-forge-v2-identity-scoremeans) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested."]

## M-FRG-120 Scoring profile (scoringProfile)

- **Match:** Codex only; Opus —; Codex web-lib-forge-v2-identity-scoringprofile
- **Possible related records (low-confidence location link, unconfirmed):** FRG-026
- **Purpose:** Scoring profile for forge v2 development kernel and ledger. Exact arithmetic locations are recorded below; no correctness judgment is made.
- **Where:** `web/lib/forge-v2/identity.ts:22 scoringProfile`
- **Tags (heuristic):** denominators: shots on goal; generation: current
- **Codex view (web-lib-forge-v2-identity-scoringprofile, symbol_candidate; Codex family 'FORGE v2 development kernel and ledger'):** Scoring profile (scoringProfile)
  - Purpose: Scoring profile for forge v2 development kernel and ledger. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: export function scoringProfile(weights: Categories<number>): ScoringProfile { if (Object.keys(weights).length !== CATEGORIES.length \|\| CATEGORIES.some(c => !Object.hasOwn(weights, c) \|\| !Number.isFinite(weights[c]))) throw new Error("Exactly seven finite scoring weights required"); const normalized = Object.fromEntries(CATEGORIES.map(c => [c, Object.is(weights[c], -0) ? 0 : weights[c]])) as Categories<number>; return { id: `linear-seven-v1:${CATEGORIES.map(c => `${c}=${normalized[c]}`).join(";")}`, ruleVersion: "linear-seven-v1", weights: normalized }; } export const DEFAULT_SCORING = scoringProfile({ G: 3, A: 2, PPP: 1, SOG: 0.2, HIT: 0.2, BLK: 0.25, PIM: 0 }); /** Arithmetic only. Serving must separately enforce qualification for contributing cate…
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
  - Consumers: ["web/components/ForgeV2/ForecastExplorer.tsx:4", "web/components/buyLowSellHigh/BuyLowSellHighPreview.tsx:48", "web/lib/buyLowSellHigh/__fixtures__/syntheticSnapshots.ts:32", "web/lib/buyLowSellHigh/researchSnapshot.ts:67", "web/lib/draft-ranker/contracts.ts:26", "web/lib/draft-ranker/export.ts:59", "web/lib/draft-ranker/exportServer.ts:346", "web/lib/draft-ranker/server.ts:722", "web/lib/forge-…
- **Audit context:**
  - Intended contract (Codex web-lib-forge-v2-identity-scoringprofile): {"source": "web/lib/forge-v2/identity.ts:22", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["web/lib/forge-v2/identity.ts:30 /** Arithmetic only. Serving must separately enforce qualification for contributing categories. */"]}
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `{"status": "Discovered only; not run", "references": ["web/__tests__/pages/api/v1/draft-ranker/export.test.ts:54", "web/__tests__/pages/api/v1/draft-ranker/initialize.test.ts:66", "web/__tests__/pages/api/v1/start-chart.test.ts:1484", "web/__tests__/pages/underlying-stats/xg/operations.test.tsx:19", "web/components/ForgeV2/ForecastExplorer.test.tsx:5", "web/lib/draft-ranker/export.test.ts:21", "web/lib/draft-ranker/server.test.ts:274", "web/lib/forge-v2/api.test.ts:6", "web/lib/forge-v2/contracts.test.ts:3", "web/lib/forge-v2/evaluation.test.ts:4", "web/lib/forge-v2/integration.test.ts:5", "web/lib/forge-v2/lifecycle.test.ts:10"]}`
- **Leads (not audited):**
  - (codex:web-lib-forge-v2-identity-scoringprofile) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

