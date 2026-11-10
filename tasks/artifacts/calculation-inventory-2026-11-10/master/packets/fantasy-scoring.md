# Audit packet: Fantasy scoring

Master entries M-FSC-001 to M-FSC-053 (53 of 53 in this family). Built from the merged Opus and Codex inventories; see [../MASTER.md](../MASTER.md) and [../MERGE-NOTES.md](../MERGE-NOTES.md).

How to read: each entry gives both inventories' descriptions side by side. **Conflicts** are places where the two descriptions disagree; they are unresolved. **Leads** are Opus red flags and Codex unknowns: observations to check, not audited findings. Tags are keyword heuristics. Line numbers were valid when each inventory was written on 2026-11-10 (Opus at d31dcb33f, Codex at 11e4192d3); re-check against the current checkout.

| ID | Name | Match | Conflicts | Leads |
|---|---|---|---:|---:|
| M-FSC-001 | Starter Board default fantasy points | Both | 0 | 3 |
| M-FSC-002 | Joint fantasy samples from scenario draws | Both | 0 | 1 |
| M-FSC-003 | Paired fantasy decision evaluation (opportunity loss) | Both | 0 | 2 |
| M-FSC-004 | Plan comparison and +/-20% sensitivity scoring | Both | 0 | 4 |
| M-FSC-005 | Ledger fantasy points (default league weights) | Both | 0 | 3 |
| M-FSC-006 | Game forecast points (expected and if-starts) | Both | 0 | 2 |
| M-FSC-007 | Swap category gain/sacrifice breakdown | Both | 0 | 1 |
| M-FSC-008 | Candidate horizon/active points (unused export) | Both | 0 | 4 |
| M-FSC-009 | Per-game fantasy point value of a play (points leagues) | Both | 0 | 2 |
| M-FSC-010 | Category values, opponent totals and matchup result | Both | 0 | 4 |
| M-FSC-011 | Recent form totals and recent FPts per game | Both | 0 | 3 |
| M-FSC-012 | Fantasy points percentile & correlation analysis (per game) | Both | 0 | 4 |
| M-FSC-013 | Category z-score value (calculateCategoryScores) | Both | 0 | 6 |
| M-FSC-014 | Start Chart today value, Hungarian lineup and stream gain | Both | 0 | 4 |
| M-FSC-015 | Ownership / ADP trend movement | Both | 0 | 4 |
| M-FSC-016 | Roster Autopsy retained recent points per game | Both | 0 | 2 |
| M-FSC-017 | Selected-period opponent point pct (pickup context) | Both | 0 | 2 |
| M-FSC-018 | Week Score matchup bonus | Both | 0 | 3 |
| M-FSC-019 | weekScore (Game Grid Week Score) | Both | 0 | 5 |
| M-FSC-020 | Week Score slate crowding adjustment | Both | 0 | 3 |
| M-FSC-021 | Win odds list with back-to-back penalty | Both | 0 | 4 |
| M-FSC-022 | Tertile favourability bands and top/bottom-10 ranks | Both | 0 | 2 |
| M-FSC-023 | Team games and off-night counts (Game Grid helper) | Both | 0 | 3 |
| M-FSC-024 | Weighted off-nights (calcWeightedOffNights) | Both | 0 | 3 |
| M-FSC-025 | Poisson score matrix with 'tie-breaker' (PDHC heat map) | Both | 0 | 5 |
| M-FSC-026 | Opponent atk/def percentile rating | Both | 0 | 3 |
| M-FSC-027 | Four-week opportunity score (GP + 0.25*ON) | Both | 0 | 4 |
| M-FSC-028 | Four-week averages and OPP score | Both | 0 | 3 |
| M-FSC-029 | Team-vs-player forecast reconciliation residual and team game-expecta… | Both | 0 | 2 |
| M-FSC-030 | Team forecast category subtotal (Game Grid TeamDetails) | Both | 0 | 2 |
| M-FSC-031 | Stat applicability (skater vs goalie key routing) | Opus only | 0 | 1 |
| M-FSC-032 | Sustainability Sandbox skater fantasy score (hard-coded weights) | Opus only | 0 | 1 |
| M-FSC-033 | True Goalie Value default goalie fantasy point settings | Opus only | 0 | 1 |
| M-FSC-034 | NHL Edge snapshot freshness gate | Opus only | 0 | 1 |
| M-FSC-035 | NHL schedule derived game type and daily counts | Opus only | 0 | 1 |
| M-FSC-036 | Goalie qualification minimum games (stats page) | Opus only | 0 | 1 |
| M-FSC-037 | NHL TOI share and team PP time (legacy statsapi) | Opus only | 0 | 4 |
| M-FSC-038 | Ownership freshness and threshold filter | Opus only | 0 | 0 |
| M-FSC-039 | Pickup GP% (player games / team games) | Opus only | 0 | 1 |
| M-FSC-040 | Pickup table metric percentiles | Opus only | 0 | 4 |
| M-FSC-041 | Pickup composite / display score | Opus only | 0 | 2 |
| M-FSC-042 | Pickup team boost from Week Score | Opus only | 0 | 2 |
| M-FSC-043 | Yahoo credited goalie appearances (goalie minimum progress) | Opus only | 0 | 1 |
| M-FSC-044 | Yahoo past-lineup actual fantasy points | Opus only | 0 | 1 |
| M-FSC-045 | Default fantasy points and category weights | Opus only | 0 | 2 |
| M-FSC-046 | ESPN league scoring mapping | Opus only | 0 | 1 |
| M-FSC-047 | Fantrax league scoring mapping | Opus only | 0 | 1 |
| M-FSC-048 | Yahoo league scoring adaptation | Opus only | 0 | 1 |
| M-FSC-049 | Date-range grid counts (off-nights, back-to-backs, home/away) | Opus only | 0 | 1 |
| M-FSC-050 | League daily totals row (calcTotalGP / calcTotalOffNights) | Opus only | 0 | 1 |
| M-FSC-051 | Opponent category effect sign map | Opus only | 0 | 2 |
| M-FSC-052 | Four-week per-week Week Score | Opus only | 0 | 1 |
| M-FSC-053 | Opponent metric averages (xGF, xGA, GF, GA, SF, SA, PTS%) | Opus only | 0 | 3 |

## M-FSC-001 Starter Board default fantasy points

- **Match:** Both; Opus FSC-001; Codex modeling-player-forecasts-daily-board-context-predict-context
- **Purpose:** Scores skater categories into a single default fantasy-point total for evaluation
- **Where:** `modeling/player_forecasts/daily_board_training.py:17 (WEIGHTS)`; `modeling/player_forecasts/daily_board_training.py:19 (_flat)`; `modeling/player_forecasts/daily_board_context.py:166 (predict_context DEFAULT_FANTASY_POINTS)`; `modeling/player_forecasts/daily_board_baseline_issuance.py:97 (FANTASY_POINTS)`; `modeling/player_forecasts/daily_board_settlement.py:159 (attach_official_outcomes FANTASY_POINTS)`; `modeling/player_forecasts/daily_board_context.py:166 predict_context`
- **Tags (heuristic):** denominators: per game, shots on goal; generation: research, development, current
- **Opus view (FSC-001):**
  - Method: FP = 3*G + 2*A + 1*PPP + 0.2*SOG + 0.2*HIT + 0.25*BLK; applied to estimates per model and to outcomes
  - Inputs/units: per-game category counts; sources: daily-board history / official settlement
  - Output scale: fantasy points per game; writes: daily-board evaluation files
  - Status: draft — Starter Board research CLI (module main()); promotionEligible False, servingDecision retain_FORGE; challenger and scheduler activation default off (docs/start-chart/launch-validation.md:20)
  - Consumers: baseline grid selection; context evaluation; settlement
- **Codex view (modeling-player-forecasts-daily-board-context-predict-context, symbol_candidate, location; Codex family 'Python forecast research and season models'):** Predict context (predict_context)
  - Purpose: Predict context for python forecast research and season models. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: def predict_context(row: dict, artifact: dict) -> dict: if artifact.get("policy") != POLICY: raise ValueError("context model policy mismatch") estimates = {c: {"recent_season": row["estimates"][c]["recent_season"]} for c in CATEGORIES} for category in CATEGORIES: for model, fitted in artifact["models"][category].items(): x = [1.0] + [(row["features"][category][n] - mean) / scale for n, mean, scale in zip(fitted["features"], fitted["means"], fitted["scales"])] estimates[category][model] = max(0.0, estimates[category]["recent_season"] + sum(a * b for a, b in zip(x, fitted["weights"]))) adjustments = Counter() for model in MODELS: for category, ceiling in (("GOALS", estimates["SHOTS_ON_GOAL"][model]), ("PP_POINTS", min(estimates["GOALS"][model], estimates[…
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): docs/start-chart/daily-board-contract-v1.json; docs/start-chart/launch-validation.md (scoring checks :95)
  - Intended contract (Codex modeling-player-forecasts-daily-board-context-predict-context): {"source": "modeling/player_forecasts/daily_board_context.py:166", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["modeling/player_forecasts/daily_board_context.py:172 x = [1.0] + [(row[\"features\"][category][n] - mean) / scale for n, mean, scale in zip(fitted[\"features\"], fitted[\"means\"], fitted[\"scales\"])]", "modeling/player_forecasts/daily_board_context.py:173 estimates[category][model] = max(0.0, estimates[category][\"recent_season\"] + sum(a * b for a, b in zip(x, fitted[\"weights\"])))", "modeling/player_forecasts/daily_board_context.py:181 estimates[\"DEFAULT_FANTASY_POINTS\"] = {m: sum(estimates[c][m] * w for c, w in WEIGHTS.items()) for m in MODELS}", "modeling/player_forecasts/daily_board_context.py:182 return {**row, \"estimates\": estimates, \"outcomes\": {**row[\"outcomes\"],", "modeling/player_forecasts/daily_board_context.py:183 \"DEFAULT_FANTASY_POINTS\": sum(row[\"outcomes\"][c] * w for c, w in WEIGHTS.items())}, \"reconciliationCounts\": dict(adjustments)}"]}
  - External references: Compare against the web app league scoring defaults and common platform point leagues (G/A/PPP/SOG/HIT/BLK weights vary by platform)
  - Fixtures/test data: `modeling/player_forecasts/tests/test_harness.py`
  - Tests: `modeling/player_forecasts/tests/test_harness.py`; `{"status": "Discovered only; not run", "references": ["modeling/player_forecasts/tests/test_harness.py:1685"]}`
- **Leads (not audited):**
  - (opus) weights are hard-coded and not shared with the web app's fantasy scoring settings - check consistency with web league scoring
  - (opus) no goalie scoring in default fantasy points
  - (codex:modeling-player-forecasts-daily-board-context-predict-context) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-FSC-002 Joint fantasy samples from scenario draws

- **Match:** Both; Opus FSC-002; Codex modeling-player-forecasts-daily-board-joint-fantasy-samples
- **Purpose:** Scores each joint simulation draw before taking percentiles
- **Where:** `modeling/player_forecasts/daily_board.py:51 (joint_fantasy_samples)`; `modeling/player_forecasts/daily_board.py:51 joint_fantasy_samples`
- **Tags (heuristic):** denominators: shots on goal; generation: research, development, current
- **Opus view (FSC-002):**
  - Method: per draw sum(category*weight) after checking saves+GA=SA and goals<=SOG
  - Inputs/units: per-draw category counts; sources: joint scenario output
  - Output scale: fantasy points per draw; writes: —
  - Status: draft — Starter Board research CLI (module main()); promotionEligible False, servingDecision retain_FORGE; challenger and scheduler activation default off (docs/start-chart/launch-validation.md:20)
  - Consumers: daily-board distribution evaluation
- **Codex view (modeling-player-forecasts-daily-board-joint-fantasy-samples, symbol_candidate, location; Codex family 'Python forecast research and season models'):** Joint fantasy samples (joint_fantasy_samples)
  - Purpose: Score each joint draw before taking percentiles; preserve covariance.
  - Inputs/units: Parameter/type declaration excerpt: def joint_fantasy_samples(draws: list[dict[str, float]], weights: dict[str, float]) -> list[float]: """Score each joint draw before taking percentiles; preserve covariance.""" if not all(_finite(value) for value in weights.values()): raise ValueError("nonfinite scoring weight") result = [] for draw in draws: if any(not _finite(value) or value < 0 for value in draw.values()): raise ValueError("joint category outcomes must be finite and nonnegative") if any(not _finite(draw.get(key)) for key, weight in weights.items() if weight): raise ValueError("missing or nonfinite scoring category in a joint draw") if all(key in draw for key in ("SAVES_GOALIE", "GOALS_AGAINST_GOALIE", "SHOTS_AGAINST_GOALIE")): if not math.isclose(draw["SAVES_GOALIE"] + draw["GOALS_AGA…
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": ["starter-board-evaluation-v1"], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): daily_board.py:52 docstring ('Score each joint draw before taking percentiles')
  - Intended contract (Codex modeling-player-forecasts-daily-board-joint-fantasy-samples): {"source": "modeling/player_forecasts/daily_board.py:51", "explicit_comment": "Score each joint draw before taking percentiles; preserve covariance.", "arithmetic_locations": ["modeling/player_forecasts/daily_board.py:66 result.append(sum(draw[key] * weight for key, weight in weights.items() if weight))"]}
  - External references: none suggested
  - Fixtures/test data: `modeling/player_forecasts/tests/test_harness.py`
  - Tests: `modeling/player_forecasts/tests/test_harness.py`; `{"status": "Discovered only; not run", "references": ["modeling/player_forecasts/tests/test_harness.py:1996"]}`
- **Leads (not audited):**
  - (codex:modeling-player-forecasts-daily-board-joint-fantasy-samples) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-FSC-003 Paired fantasy decision evaluation (opportunity loss)

- **Match:** Both; Opus FSC-003; Codex web-lib-player-forecasts-evaluation-evaluatepairedpointdecisions
- **Purpose:** Score candidate vs no-move vs AGP lineup plans on realized outcomes in points leagues.
- **Where:** `web/lib/player-forecasts/evaluation.ts:141 (evaluatePairedPointDecisions)`; `web/lib/player-forecasts/evaluation.ts:141 evaluatePairedPointDecisions`
- **Tags (heuristic):** generation: legacy, current
- **Opus view (FSC-003):**
  - Method: Plan score = sum over players and stats of value*weight; opportunityLoss = max(0, max(noMove, agp) - candidate); mean opportunity loss across decisions.
  - Inputs/units: realized stat counts; league scoring weights (points per unit); sources: —
  - Output scale: fantasy points; opportunity loss >= 0 in fantasy points; writes: —
  - Status: legacy/dead — no non-test callers
  - Consumers: none outside module found
- **Codex view (web-lib-player-forecasts-evaluation-evaluatepairedpointdecisions, symbol_candidate, location; Codex family 'Native player forecasts and contribution serving'):** Evaluate paired point decisions (evaluatePairedPointDecisions)
  - Purpose: Scores every plan against the same observed player/game values. Points leagues only.
  - Inputs/units: Parameter/type declaration excerpt: export function evaluatePairedPointDecisions(rows: PairedPointDecision[], asOf: string) { const evaluated: Array<{ id: string; candidate: number; noMove: number; agp: number; opportunityLoss: number }> = []; const excluded: Record<string, number> = {}; const exclude = (reason: string) => { excluded[reason] = (excluded[reason] ?? 0) + 1; }; const seen = new Set<string>(); for (const row of rows) { if (seen.has(row.id)) { exclude("duplicate_decision"); continue; } seen.add(row.id); if (protectedDate(row.gameDate)) { exclude("protected_holdout"); continue; } if (row.evidenceClass !== "captured_live") { exclude("non_prospective"); continue; } if (![row.issuedAt, row.lockAt, row.outcomeAvailableAt, asOf].every(validTime) \|\| Date.parse(row.issuedAt) >= Date…
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): evaluation.ts:140 'Scores every plan against the same observed player/game values. Points leagues only.'
  - Intended contract (Codex web-lib-player-forecasts-evaluation-evaluatepairedpointdecisions): {"source": "web/lib/player-forecasts/evaluation.ts:141", "explicit_comment": "Scores every plan against the same observed player/game values. Points leagues only.", "arithmetic_locations": ["web/lib/player-forecasts/evaluation.ts:167 total += value * weight;", "web/lib/player-forecasts/evaluation.ts:177 ? evaluated.reduce((sum, row) => sum + row.opportunityLoss, 0) / evaluated.length : null };"]}
  - External references: Regret / opportunity-loss evaluation of decisions
  - Fixtures/test data: none listed
  - Tests: `web/lib/player-forecasts/evaluation.test.ts`; `{"status": "Discovered only; not run", "references": ["web/lib/player-forecasts/evaluation.test.ts:4"]}`
- **Leads (not audited):**
  - (opus) no non-test callers found
  - (codex:web-lib-player-forecasts-evaluation-evaluatepairedpointdecisions) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-FSC-004 Plan comparison and +/-20% sensitivity scoring

- **Match:** Both; Opus FSC-004; Codex web-lib-player-forecasts-plancomparison-compareplanscenarios, web-lib-player-forecasts-plancomparison-compareplansensitivity
- **Purpose:** Compare baseline vs candidate RSO lineups under fixed stress scenarios in points or category leagues.
- **Where:** `web/lib/player-forecasts/planComparison.ts:80 (score)`; `web/lib/player-forecasts/planComparison.ts:111 (comparePlanScenarios)`; `web/lib/player-forecasts/planComparison.ts:149 (comparePlanSensitivity)`; `web/lib/player-forecasts/planComparison.ts:111 comparePlanScenarios`; `web/lib/player-forecasts/planComparison.ts:149 comparePlanSensitivity`
- **Tags (heuristic):** denominators: per game; generation: current
- **Opus view (FSC-004):**
  - Method: Points: sum(stat*weight). Categories: for each category, own vs opponent (realized+remaining) value (ratio numerator/denominator when defined), score += sign((own-other)*multiplier*direction). Scenarios substitute per-game draws; sensitivity scales counting stats by 0.8/1.0/1.2 except keys matching MINUTES\|TIME_ON_ICE\|PERCENTAGE\|AVERAGE. Direction = candidate/baseline/sensitive/equal.
  - Inputs/units: projected stat totals; league weights or category definitions; sources: —
  - Output scale: fantasy points (points leagues) or category win count (-N..N) (categories); writes: —
  - Status: live — components/RosterScheduleOptimizer/RosterScheduleOptimizer.tsx
  - Consumers: components/RosterScheduleOptimizer/RosterScheduleOptimizer.tsx
- **Codex view (web-lib-player-forecasts-plancomparison-compareplanscenarios, symbol_candidate, location; Codex family 'Native player forecasts and contribution serving'):** Compare plan scenarios (comparePlanScenarios)
  - Purpose: Compare fixed complete lineups, preserving shared-player/game dependence and issued inputs.
  - Inputs/units: Parameter/type declaration excerpt: export function comparePlanScenarios(snapshot: PlanningSnapshot, baseline: PlanEvaluation, candidate: PlanEvaluation, scenarios: PlanScenario[]): PairedPlanComparison { const inputs = comparisonInputs(snapshot, baseline, candidate); const targets = scoringTargets(snapshot); const evaluate = (plan: PlanEvaluation, scenario: Map<string, StatLine>) => { if (!inputs) return null; const stats = { ...plan.projectedStats }; for (const assignment of plan.assignments) { const key = keyOf(assignment); const original = inputs.get(key)?.stats, draw = scenario.get(key); if (!original \|\| !draw) return null; for (const stat of targets) { if (!Object.prototype.hasOwnProperty.call(original, stat)) continue; const value = original[stat]; if (!finite(stats[stat]) \|\| !…
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (web-lib-player-forecasts-plancomparison-compareplansensitivity, symbol_candidate, location; Codex family 'Native player forecasts and contribution serving'):** Compare plan sensitivity (comparePlanSensitivity)
  - Purpose: Explicit ±20% counting-stat stresses. No invented forecast distribution or probability.
  - Inputs/units: Parameter/type declaration excerpt: export function comparePlanSensitivity(snapshot: PlanningSnapshot, baseline: PlanEvaluation, candidate: PlanEvaluation): PairedPlanComparison { const inputs = comparisonInputs(snapshot, baseline, candidate); const scenarios = [0.8, 1, 1.2].map(factor => ({ id: `counting:${factor}`, label: factor === 1 ? "Resolved means" : `${factor < 1 ? "−" : "+"}20% counting contributions`, games: [...(inputs?.values() ?? [])].map(forecast => ({ playerId: forecast.playerId, gameId: forecast.gameId, stats: Object.fromEntries(Object.entries(forecast.stats).map(([key, value]) => [key, finite(value) && !/MINUTES\|TIME_ON_ICE\|PERCENTAGE\|AVERAGE/.test(key) ? value * factor : value])), })), })); return comparePlanScenarios(snapshot, baseline, candidate, scenarios); }
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): planComparison.ts:110 'Compare fixed complete lineups'; planComparison.ts:148 'Explicit ±20% counting-stat stresses. No invented forecast distribution or probability.'
  - Intended contract (Codex web-lib-player-forecasts-plancomparison-compareplanscenarios): {"source": "web/lib/player-forecasts/planComparison.ts:111", "explicit_comment": "Compare fixed complete lineups, preserving shared-player/game dependence and issued inputs.", "arithmetic_locations": ["web/lib/player-forecasts/planComparison.ts:148 /** Explicit \u00b120% counting-stat stresses. No invented forecast distribution or probability. */"]}
  - Intended contract (Codex web-lib-player-forecasts-plancomparison-compareplansensitivity): {"source": "web/lib/player-forecasts/planComparison.ts:149", "explicit_comment": "Explicit \u00b120% counting-stat stresses. No invented forecast distribution or probability.", "arithmetic_locations": ["web/lib/player-forecasts/planComparison.ts:155 finite(value) && !/MINUTES\|TIME_ON_ICE\|PERCENTAGE\|AVERAGE/.test(key) ? value * factor : value])),"]}
  - External references: H2H category win counting; scenario stress testing
  - Fixtures/test data: none listed
  - Tests: `web/lib/player-forecasts/planComparison.test.ts`; `web/lib/rosterScheduleOptimizer/planning.test.ts`; `{"status": "Discovered only; not run", "references": ["web/lib/player-forecasts/planComparison.test.ts:3", "web/lib/rosterScheduleOptimizer/planning.test.ts:4"]}`; `{"status": "Discovered only; not run", "references": ["web/lib/player-forecasts/planComparison.test.ts:3"]}`
- **Leads (not audited):**
  - (opus) PENALTY_MINUTES matches /MINUTES/ so PIM is not stressed though it is a counting category
  - (opus) category score uses sign only (ties count 0), no margin or probability of winning a category
  - (codex:web-lib-player-forecasts-plancomparison-compareplanscenarios) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:web-lib-player-forecasts-plancomparison-compareplansensitivity) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-FSC-005 Ledger fantasy points (default league weights)

- **Match:** Both; Opus FSC-005; Codex served-ledger-source-scoring
- **Purpose:** Convert expected and actual ledger heads into fantasy points.
- **Where:** `web/lib/player-forecasts/servedForecastLedger.ts:60 (ledgerFantasyPoints)`; `web/lib/projectionsConfig/fantasyPointsConfig.ts:8 (DEFAULT_SKATER_FANTASY_POINTS)`; `web/lib/projectionsConfig/fantasyPointsConfig.ts:25 (DEFAULT_GOALIE_FANTASY_POINTS)`; `web/lib/player-forecasts/servedForecastLedger.ts:396 scoreLedger`; `web/lib/player-forecasts/servedForecastLedger.ts:332 errorStat`; `web/lib/player-forecasts/servedForecastLedger.ts:345 binaryScore`; `web/lib/player-forecasts/servedForecastLedger.ts:380 fpBins`; `web/lib/player-forecasts/servedForecastLedger.ts:360 scoringRows`; `web/lib/player-forecasts/servedForecastLedger.ts:60 ledgerFantasyPoints`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: per game, shots on goal; generation: current
- **Opus view (FSC-005):**
  - Method: Skater FP = 3G + 2A + 1PPP + 0.2SOG + 0.2HIT + 0.25BLK; goalie FP = 0.2SV - 1GA + 4W + 3SO (defaults; custom weights accepted). Null if any non-zero-weighted head is null. Rounded 4 dp.
  - Inputs/units: per-game counts; probabilities for W/SO; sources: —
  - Output scale: fantasy points (default 3G/2A/1PPP/0.2SOG/0.2HIT/0.25BLK; 0.2SV/-1GA/4W/3SO); writes: forge_served_forecast_ledger
  - Status: live — snapshot and settle crons, /api/v1/forge/scoreboard
  - Consumers: scoreLedger; scorePairedLedger; forge scoreboard
- **Codex view (served-ledger-source-scoring, calculation, location; Codex family 'Served forecast ledger evaluation'):** Per-source count, fantasy-point and goalie-event scoring (scoreLedger)
  - Purpose: Summarize each source on its own settled observed sample. For finite forecast/actual pairs compute MAE=mean(abs(forecast-actual)), signed bias=mean(forecast-actual), RMSE=sqrt(mean((forecast-actual)^2)), expected and actual sums, actual/expected total ratio, and Mincer–Zarnowitz regression actual=intercept+slope*forecast. Slope is covariance sum/forecast centered-squares sum; intercept=actual mean-slope*forecast mean. Separately compute goalie start/win/shutout Brier scores and ten probability-bin means. Report independent-universe coverage, phantoms, expected-FP decile and back-to-back slices.
  - Inputs/units: Settled source/player-game ledger predictions and actuals: skater G/A/PPP/SOG/HIT/BLK counts, goalie SV/GA/SA counts, fantasy points, goalie start/win/shutout probabilities [0,1] and known binary outcomes. Optional fantasy weights are points per category event; optional independent player-game universe contains known/unknown dressed membership. Rest days are calendar-day gaps.
  - Output scale: Per source and player class: n/covered/dressed/phantoms and cohort sizes are counts. MAE, bias, RMSE and MZ intercept have head count or fantasy-point units; expected/actual are cohort totals. MZ slope and actual/expected ratio are dimensionless and not bounded. Probability scores and reliability predicted/observed fractions are [0,1]. Coverage is covered/dressed when known nonzero denominator, otherwise null. Deciles are labels 1..10 and probability bins 0..9. Floating summaries rounded to 4 decimals.
  - Version/status: Checked-in local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f. LEDGER_SOURCES includes bridge_exact, bridge_reaimed, native, naive_last5, naive_season, market; source names are not evidence of live/deployed population. LEDGER_MARKET_ENABLED is true in source only. Inspected source files clean; no tests or execution.
- **Audit context:**
  - Intent (Opus): servedForecastLedger.ts:59 'League-default (TJ's) fantasy points; null when any head with a non-zero weight is unknown (R15 accuracy rule).'
  - Intended contract (Codex served-ledger-source-scoring): web/lib/player-forecasts/servedForecastLedger.ts:394-395 expressly distinguishes own-source observed samples from paired model comparison. Count/FP errors use dressed===true; goalie binary scores use all valid settled known events, including proven nonstarts. Identity-invalid and duplicate-source-key rows excluded. No finite pairs => null errors; constant forecast or n<2 => null MZ; zero forecast total => null ratio. Coverage requires independently captured, fully settled membership, not forecast rows. fpBins uses tied expected-FP midpoint rank only (no actuals), so deciles may be empty; B2B is team_rest_days===1. Missing nonzero-weight heads withhold recomputed FP.
  - External references: Yahoo/ESPN points-league scoring conventions
  - Fixtures/test data: none listed
  - Tests: `web/lib/player-forecasts/servedForecastLedger.test.ts`; `web/lib/player-forecasts/servedForecastLedger.test.ts:164 scoreLedger suite: signed bias/MAE, coverage/phantoms, tied FP, B2B, goalie reliability and independent no-history universe. Discovered, not run.`; `web/lib/player-forecasts/servedForecastLedger.test.ts:238 duplicate/invalid-key behavior; :265 expected-FP deciles; :291 known nonstart binary scoring. Discovered, not run.`
- **Leads (not audited):**
  - (opus) custom weights on heads not in the ledger line (PIM, +/-, SHP, FOW) would be silently ignored rather than nulling FP
  - (opus) expected goalie W/SO are probabilities times share, so expected FP is unconditional while skater naive FP assumes participation 1
  - (codex:served-ledger-source-scoring) ["Deployed ledger version, persisted population, active capture, independent universe availability and live coverage not verified.", "These are descriptive evaluation summaries, not predictive qualification, as explicitly stated in LEDGER_SCORING_LIMITATIONS.", "Skater F/D position and expected/actual TOI and PP-TOI are absent from persisted scoring contract; no opportunity/rate decomposition is produced."]

## M-FSC-006 Game forecast points (expected and if-starts)

- **Match:** Both; Opus FSC-006; Codex roster-assigned-player-points, roster-forecast-game-points
- **Purpose:** Readback of a forecast's expected fantasy points and a goalie's per-start points.
- **Where:** `web/lib/rosterScheduleOptimizer/planning.ts:120 (gameForecastPoints)`; `web/lib/rosterScheduleOptimizer/planning.ts:150 (forecastPointsReader)`; `web/lib/rosterScheduleOptimizer/planning.ts:164 (playerAssignedPoints)`; `web/lib/rosterScheduleOptimizer/planning.ts:164 playerAssignedPoints`; `web/lib/rosterScheduleOptimizer/planning.ts:120 gameForecastPoints`; `web/lib/rosterScheduleOptimizer/planning.ts:150 forecastPointsReader`
- **Tags (heuristic):** denominators: per game; generation: current
- **Opus view (FSC-006):**
  - Method: expected = sum weight x stats[k] (stats already include participation; no further start-probability scaling). ifStarts (goalies) = sum weight x per-start conditionalMean (or conditionalStats). forecastPointsReader drops expired forecasts (expiresAt<=asOf). playerAssignedPoints sums expected points over a player's assigned games requiring totals+comparison permissions; null if any missing.
  - Inputs/units: stat counts per game (goals, assists, shots, hits, blocks, PIM, saves...), weights = league fantasy points per stat unit; goalie per-start conditional means; sources: FORGE bridge forecasts
  - Output scale: expected fantasy points per game; ifStarts fantasy points per start; writes: —
  - Status: live — pages/roster-schedule-optimizer.tsx -> components/RosterScheduleOptimizer/RosterScheduleOptimizer.tsx -> lib/rosterScheduleOptimizer/executionAdapter.ts (planRoster, candidatePlanMetrics, healthyReserves); also components/RosterScheduleOptimizer/ForecastPoints.tsx
  - Consumers: ForecastPoints.tsx; streamingChain points; noMoveDropOrder; contributionLedger; SlotWeekGrid
- **Codex view (roster-assigned-player-points, calculation, location; Codex family 'roster-planning'):** Player remaining assigned points
  - Purpose: Sum applicable approved forecast stat×weight only on that player’s selected assignments.
  - Inputs/units: Legal comparable evaluation, assigned forecasts, player eligibility and league scoring.
  - Output scale: Remaining fantasy points or null.
  - Version/status: No formula version declared in inspected file. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Codex view (roster-forecast-game-points, calculation, location; Codex family 'roster-planning'):** Expected and conditional-if-starts game fantasy points
  - Purpose: Sum applicable stat×league weight. Expected values already include participation. Goalie ifStarts uses qualified per-start conditional means.
  - Inputs/units: GameForecast stats in native stat units; league points/stat weights; player class and target-use permissions.
  - Output scale: Fantasy points per scheduled game and fantasy points conditional on starting, or null.
  - Version/status: No formula version declared in inspected file. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Audit context:**
  - Intent (Opus): planning.ts:139 comment ('stats already includes participation; multiplying or dividing by start probability changes its meaning') and :118
  - Intended contract (Codex roster-assigned-player-points): Excludes realized/banked totals and refuses missing/ambiguous forecast rows. Source: web/lib/rosterScheduleOptimizer/planning.ts:164 playerAssignedPoints.
  - Intended contract (Codex roster-forecast-game-points): Never multiply/divide unconditional stats by start probability again. Missing or disallowed weighted target withholds result. Source: web/lib/rosterScheduleOptimizer/planning.ts:120 gameForecastPoints.
  - External references: Expected fantasy points = sum E[stat] x weight
  - Fixtures/test data: `web/lib/rosterScheduleData/forgeReservePayload.fixture.ts`; `web/lib/player-forecasts/rsoUsePolicy.fixtures.ts`; `web/__tests__/fixtures/consumerGameRevision.ts`
  - Tests: `web/components/RosterScheduleOptimizer/ForecastPoints.test.tsx`; `web/lib/rosterScheduleData/forgeDailyBridge.test.ts`; `web/lib/rosterScheduleOptimizer/gameForecastPoints.test.ts`; `web/lib/rosterScheduleOptimizer/streamingChain.test.ts`; `{"discovered_not_run": ["web/__tests__/pages/start-chart.test.tsx", "web/e2e/social-share.spec.ts", "web/__tests__/fixtures/consumerGameRevision.ts", "web/components/RosterAutopsy/RosterAutopsy.test.tsx", "web/__tests__/pages/forge/forecasts.test.tsx", "web/e2e/roster-schedule-optimizer.spec.ts", "web/e2e/rso-continuity.spec.ts", "web/e2e/start-chart.spec.ts", "web/hooks/yahooPlanningReadBroker.test.ts", "web/hooks/useCandidateMetrics.test.tsx", "web/hooks/useRosterPlanning.test.tsx", "web/components/SocialShare/SocialShare.test.tsx", "web/__tests__/components/RosterScheduleOptimizer/CategoryGains.test.tsx", "web/__tests__/components/RosterScheduleOptimizer/RosterScheduleOptimizer.test.tsx", "web/__tests__/components/RosterScheduleOptimizer/AcquisitionRules.integration.test.tsx", "web/__tests__/components/RosterScheduleOptimizer/StreamingItinerary.test.tsx", "web/lib/socialShare/schedule.test.ts", "web/__tests__/pages/api/v1/start-chart.test.ts", "web/components/RosterScheduleOptimizer/CandidateCard.test.tsx", "web/components/RosterScheduleOptimizer/CompactSchedule.test.ts"], "additional_reference_tests": 18, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`; `{"discovered_not_run": ["web/__tests__/pages/start-chart.test.tsx", "web/e2e/social-share.spec.ts", "web/__tests__/fixtures/consumerGameRevision.ts", "web/components/RosterAutopsy/RosterAutopsy.test.tsx", "web/__tests__/pages/forge/forecasts.test.tsx", "web/e2e/roster-schedule-optimizer.spec.ts", "web/e2e/rso-continuity.spec.ts", "web/e2e/start-chart.spec.ts", "web/hooks/yahooPlanningReadBroker.test.ts", "web/hooks/useCandidateMetrics.test.tsx", "web/hooks/useRosterPlanning.test.tsx", "web/components/SocialShare/SocialShare.test.tsx", "web/__tests__/components/RosterScheduleOptimizer/CategoryGains.test.tsx", "web/__tests__/components/RosterScheduleOptimizer/RosterScheduleOptimizer.test.tsx", "web/__tests__/components/RosterScheduleOptimizer/AcquisitionRules.integration.test.tsx", "web/__tests__/components/RosterScheduleOptimizer/StreamingItinerary.test.tsx", "web/lib/socialShare/schedule.test.ts", "web/__tests__/pages/api/v1/start-chart.test.ts", "web/components/RosterScheduleOptimizer/CandidateCard.test.tsx", "web/components/RosterScheduleOptimizer/CompactSchedule.test.ts"], "additional_reference_tests": 19, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (codex:roster-assigned-player-points) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.
  - (codex:roster-forecast-game-points) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-FSC-007 Swap category gain/sacrifice breakdown

- **Match:** Both; Opus FSC-007; Codex roster-swap-category-breakdown
- **Purpose:** Explain a plan vs no-move lineup per category: delta, gains, sacrifices, ratio components.
- **Where:** `web/lib/rosterScheduleOptimizer/planning.ts:198 (swapCategoryBreakdown)`; `web/lib/rosterScheduleOptimizer/planning.ts:198 swapCategoryBreakdown`
- **Tags (heuristic):** generation: current
- **Opus view (FSC-007):**
  - Method: Per player summed stats in each plan; net per player = after - before. Counting categories: gain = sum max(0, net) x multiplier, sacrifice = sum max(0, -net) x multiplier; delta = plan own - baseline own. Ratio categories: net numerator and denominator components. Null when manifests differ, illegal, schedule stale, or goalie-category forfeiture risk.
  - Inputs/units: per-player stat totals (counts); multiplier; sources: —
  - Output scale: category units: delta, gain, sacrifice; ratio component nets; writes: —
  - Status: live — pages/roster-schedule-optimizer.tsx -> components/RosterScheduleOptimizer/RosterScheduleOptimizer.tsx -> lib/rosterScheduleOptimizer/executionAdapter.ts (planRoster, candidatePlanMetrics, healthyReserves); CategoryGains.tsx, CandidateCard.tsx
  - Consumers: CategoryGains.tsx; CandidateCard.tsx; candidatePlanMetrics categoryBreakdown
- **Codex view (roster-swap-category-breakdown, calculation, location; Codex family 'roster-planning'):** Whole-swap category gain, sacrifice and component delta
  - Purpose: Compare admitted before/after category totals and player assignments. Count-category gain/sacrifice reflects added/newly started and dropped/displaced contributors; ratios expose pooled numerator/denominator deltas.
  - Inputs/units: Comparable same-manifest plan evaluations and category definitions.
  - Output scale: Native-unit before/after/delta; count gain/sacrifice; ratio component deltas.
  - Version/status: No formula version declared in inspected file. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Audit context:**
  - Intent (Opus): planning.ts:195-197 (R8: whole-swap explanation, no new projection, no blended score)
  - Intended contract (Codex roster-swap-category-breakdown): Not subtraction of percentages as counts and not a blended score. Source: web/lib/rosterScheduleOptimizer/planning.ts:198 swapCategoryBreakdown.
  - External references: none suggested
  - Fixtures/test data: `web/e2e/roster-schedule-optimizer-fixtures.ts`; `web/e2e/fixtures/rso-acceptance/index.ts`; `web/e2e/fixtures/rso-continuity/index.ts`
  - Tests: `web/lib/rosterScheduleOptimizer/candidatePlanMetrics.test.ts`; `web/lib/rosterScheduleOptimizer/planning.test.ts`; `{"discovered_not_run": ["web/__tests__/pages/start-chart.test.tsx", "web/e2e/social-share.spec.ts", "web/__tests__/fixtures/consumerGameRevision.ts", "web/components/RosterAutopsy/RosterAutopsy.test.tsx", "web/__tests__/pages/forge/forecasts.test.tsx", "web/e2e/roster-schedule-optimizer.spec.ts", "web/e2e/rso-continuity.spec.ts", "web/e2e/start-chart.spec.ts", "web/hooks/yahooPlanningReadBroker.test.ts", "web/hooks/useCandidateMetrics.test.tsx", "web/hooks/useRosterPlanning.test.tsx", "web/components/SocialShare/SocialShare.test.tsx", "web/__tests__/components/RosterScheduleOptimizer/CategoryGains.test.tsx", "web/__tests__/components/RosterScheduleOptimizer/RosterScheduleOptimizer.test.tsx", "web/__tests__/components/RosterScheduleOptimizer/AcquisitionRules.integration.test.tsx", "web/__tests__/components/RosterScheduleOptimizer/StreamingItinerary.test.tsx", "web/lib/socialShare/schedule.test.ts", "web/__tests__/pages/api/v1/start-chart.test.ts", "web/components/RosterScheduleOptimizer/CandidateCard.test.tsx", "web/components/RosterScheduleOptimizer/CompactSchedule.test.ts"], "additional_reference_tests": 17, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (codex:roster-swap-category-breakdown) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-FSC-008 Candidate horizon/active points (unused export)

- **Match:** Both; Opus FSC-008; Codex roster-candidate-active-points, roster-horizon-points, roster-schedule-fits
- **Purpose:** Total projected points per candidate over the horizon and marginal points from one extra bench place.
- **Where:** `web/lib/rosterScheduleOptimizer/planning.ts:253 (candidateHorizonPoints)`; `web/lib/rosterScheduleOptimizer/planning.ts:281 (candidateActivePoints)`; `web/lib/rosterScheduleOptimizer/planning.ts:1580 (candidateMetrics)`; `web/lib/rosterScheduleOptimizer/planning.ts:281 candidateActivePoints`; `web/lib/rosterScheduleOptimizer/planning.ts:253 candidateHorizonPoints`; `web/lib/rosterScheduleOptimizer/planning.ts:1191 scheduleFits`; `web/lib/rosterScheduleOptimizer/planning.ts:1580 candidateMetrics`
- **Tags (heuristic):** conditionality: unconditional; denominators: per game; generation: legacy, current
- **Opus view (FSC-008):**
  - Method: Horizon = sum over scheduled eligible games of sum weight x stats (all must be unconditional+approved, else null). Active = projectedValue(roster + player on extra BN) - baseline projectedValue under outcome objective.
  - Inputs/units: stat counts per game (goals, assists, shots, hits, blocks, PIM, saves...), weights = league fantasy points per stat unit; sources: FORGE forecasts
  - Output scale: fantasy points per candidate (horizon) / marginal fantasy points; writes: —
  - Status: legacy/dead — (candidateMetrics, candidateActivePoints) no importer outside planning.ts and tests; candidateHorizonPoints live via candidatePlanMetrics.ts:125
  - Consumers: candidatePlanMetrics (horizonPoints for sort); candidateMetrics appears unreferenced outside planning.ts
- **Codex view (roster-candidate-active-points, calculation, location; Codex family 'roster-planning'):** Hypothetical candidate marginal active points
  - Purpose: Add candidate to an extra hypothetical bench place, evaluate outcome, subtract baseline complete-plan projected value.
  - Inputs/units: Baseline snapshot, intent and candidate horizon points.
  - Output scale: Signed marginal fantasy points or null.
  - Version/status: No formula version declared in inspected file. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Codex view (roster-horizon-points, calculation, location; Codex family 'roster-planning'):** Candidate full-horizon points
  - Purpose: Sum approved unconditional expected points over all scheduled eligible future team-games for each player.
  - Inputs/units: Planning snapshot, schedule, player class/eligibility, forecasts and points weights.
  - Output scale: Fantasy points across horizon or null.
  - Version/status: No formula version declared in inspected file. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Codex view (roster-schedule-fits, calculation, location; Codex family 'roster-planning'):** Candidate marginal active games by schedule fit
  - Purpose: Group by team/eligibility, add one hypothetical bench place and subtract no-move AGP. Return dates with greater assignment counts.
  - Inputs/units: Baseline planning evaluation, available players, schedule and slots.
  - Output scale: Added active games and improving dates; completeness/truncation flags.
  - Version/status: No formula version declared in inspected file. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Audit context:**
  - Intent (Opus): planning.ts:251-252, 279-280, 1579 docstrings
  - Intended contract (Codex roster-candidate-active-points): Extra roster place is hypothetical, not permission/legality for a real acquisition. Source: web/lib/rosterScheduleOptimizer/planning.ts:281 candidateActivePoints.
  - Intended contract (Codex roster-horizon-points): Not lineup-adjusted or an executable acquisition. Source: web/lib/rosterScheduleOptimizer/planning.ts:253 candidateHorizonPoints.
  - Intended contract (Codex roster-schedule-fits): Capacity benefit only; does not itself account for executable drop/acquisition constraints. Source: web/lib/rosterScheduleOptimizer/planning.ts:1191 scheduleFits.
  - External references: none suggested
  - Fixtures/test data: `web/lib/rosterScheduleData/forgeReservePayload.fixture.ts`
  - Tests: `web/lib/rosterScheduleData/forgeDailyBridge.test.ts`; `web/lib/rosterScheduleOptimizer/dailyDecisionReplay.test.ts`; `web/lib/rosterScheduleOptimizer/planning.test.ts`; `{"discovered_not_run": ["web/__tests__/pages/start-chart.test.tsx", "web/e2e/social-share.spec.ts", "web/__tests__/fixtures/consumerGameRevision.ts", "web/components/RosterAutopsy/RosterAutopsy.test.tsx", "web/__tests__/pages/forge/forecasts.test.tsx", "web/e2e/roster-schedule-optimizer.spec.ts", "web/e2e/rso-continuity.spec.ts", "web/e2e/start-chart.spec.ts", "web/hooks/yahooPlanningReadBroker.test.ts", "web/hooks/useCandidateMetrics.test.tsx", "web/hooks/useRosterPlanning.test.tsx", "web/components/SocialShare/SocialShare.test.tsx", "web/__tests__/components/RosterScheduleOptimizer/CategoryGains.test.tsx", "web/__tests__/components/RosterScheduleOptimizer/RosterScheduleOptimizer.test.tsx", "web/__tests__/components/RosterScheduleOptimizer/AcquisitionRules.integration.test.tsx", "web/__tests__/components/RosterScheduleOptimizer/StreamingItinerary.test.tsx", "web/lib/socialShare/schedule.test.ts", "web/__tests__/pages/api/v1/start-chart.test.ts", "web/components/RosterScheduleOptimizer/CandidateCard.test.tsx", "web/components/RosterScheduleOptimizer/CompactSchedule.test.ts"], "additional_reference_tests": 17, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`; `{"discovered_not_run": ["web/__tests__/pages/start-chart.test.tsx", "web/e2e/social-share.spec.ts", "web/__tests__/fixtures/consumerGameRevision.ts", "web/components/RosterAutopsy/RosterAutopsy.test.tsx", "web/__tests__/pages/forge/forecasts.test.tsx", "web/e2e/roster-schedule-optimizer.spec.ts", "web/e2e/rso-continuity.spec.ts", "web/e2e/start-chart.spec.ts", "web/hooks/yahooPlanningReadBroker.test.ts", "web/hooks/useCandidateMetrics.test.tsx", "web/hooks/useRosterPlanning.test.tsx", "web/components/SocialShare/SocialShare.test.tsx", "web/__tests__/components/RosterScheduleOptimizer/CategoryGains.test.tsx", "web/__tests__/components/RosterScheduleOptimizer/RosterScheduleOptimizer.test.tsx", "web/__tests__/components/RosterScheduleOptimizer/AcquisitionRules.integration.test.tsx", "web/__tests__/components/RosterScheduleOptimizer/StreamingItinerary.test.tsx", "web/lib/socialShare/schedule.test.ts", "web/__tests__/pages/api/v1/start-chart.test.ts", "web/components/RosterScheduleOptimizer/CandidateCard.test.tsx", "web/components/RosterScheduleOptimizer/CompactSchedule.test.ts"], "additional_reference_tests": 18, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`; `{"discovered_not_run": ["web/__tests__/pages/start-chart.test.tsx", "web/e2e/social-share.spec.ts", "web/__tests__/fixtures/consumerGameRevision.ts", "web/components/RosterAutopsy/RosterAutopsy.test.tsx", "web/__tests__/pages/forge/forecasts.test.tsx", "web/e2e/roster-schedule-optimizer.spec.ts", "web/e2e/rso-continuity.spec.ts", "web/e2e/start-chart.spec.ts", "web/hooks/yahooPlanningReadBroker.test.ts", "web/hooks/useCandidateMetrics.test.tsx", "web/hooks/useRosterPlanning.test.tsx", "web/components/SocialShare/SocialShare.test.tsx", "web/__tests__/components/RosterScheduleOptimizer/CategoryGains.test.tsx", "web/__tests__/components/RosterScheduleOptimizer/RosterScheduleOptimizer.test.tsx", "web/__tests__/components/RosterScheduleOptimizer/AcquisitionRules.integration.test.tsx", "web/__tests__/components/RosterScheduleOptimizer/StreamingItinerary.test.tsx", "web/lib/socialShare/schedule.test.ts", "web/__tests__/pages/api/v1/start-chart.test.ts", "web/components/RosterScheduleOptimizer/CandidateCard.test.tsx", "web/components/RosterScheduleOptimizer/CompactSchedule.test.ts"], "additional_reference_tests": 19, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (opus) dead code? candidateMetrics/candidateActivePoints have no importer outside planning.ts (rg)
  - (codex:roster-candidate-active-points) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.
  - (codex:roster-horizon-points) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.
  - (codex:roster-schedule-fits) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-FSC-009 Per-game fantasy point value of a play (points leagues)

- **Match:** Both; Opus FSC-009; Codex roster-forecast-game-points
- **Purpose:** Score one player-game for lineup assignment as weighted sum of projected stats.
- **Where:** `web/lib/rosterScheduleOptimizer/planning.ts:301 (playValue)`; `web/lib/rosterScheduleOptimizer/planning.ts:115 (assignmentStats)`; `web/lib/rosterScheduleOptimizer/planning.ts:120 gameForecastPoints`; `web/lib/rosterScheduleOptimizer/planning.ts:150 forecastPointsReader`
- **Tags (heuristic):** conditionality: unconditional; denominators: per game; generation: current
- **Opus view (FSC-009):**
  - Method: Points mode: sum_k weight_k x stat_k over non-zero weights that apply to the player's class; null if any required stat missing or assignment use not approved, or forecast not 'unconditional' or eligibility unverified. Category mode: returns 0 after checking every category numerator/denominator is finite (neutral capacity, no additive utility).
  - Inputs/units: stat counts per game (goals, assists, shots, hits, blocks, PIM, saves...), weights = league fantasy points per stat unit; sources: FORGE bridge forecasts (forge_player_projections, forge_goalie_projections) or native contributions
  - Output scale: fantasy points per player-game (points mode); 0 (category mode); writes: —
  - Status: live — pages/roster-schedule-optimizer.tsx -> components/RosterScheduleOptimizer/RosterScheduleOptimizer.tsx -> lib/rosterScheduleOptimizer/executionAdapter.ts (planRoster, candidatePlanMetrics, healthyReserves)
  - Consumers: assign(); bench exclusions; assignmentValue
- **Codex view (roster-forecast-game-points, calculation, location; Codex family 'roster-planning'):** Expected and conditional-if-starts game fantasy points
  - Purpose: Sum applicable stat×league weight. Expected values already include participation. Goalie ifStarts uses qualified per-start conditional means.
  - Inputs/units: GameForecast stats in native stat units; league points/stat weights; player class and target-use permissions.
  - Output scale: Fantasy points per scheduled game and fantasy points conditional on starting, or null.
  - Version/status: No formula version declared in inspected file. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Audit context:**
  - Intent (Opus): planning.ts:319-320 comment ('Category forecasts establish supported inputs, not an additive utility'); tasks/prd-roster-schedule-optimizer.md; tasks/tasks-prd-rso-consolidated-2026-10-09.md
  - Intended contract (Codex roster-forecast-game-points): Never multiply/divide unconditional stats by start probability again. Missing or disallowed weighted target withholds result. Source: web/lib/rosterScheduleOptimizer/planning.ts:120 gameForecastPoints.
  - External references: Yahoo points-league scoring (sum of stat x weight)
  - Fixtures/test data: `web/e2e/roster-schedule-optimizer-fixtures.ts`; `web/e2e/fixtures/rso-acceptance/index.ts`; `web/e2e/fixtures/rso-continuity/index.ts`
  - Tests: `web/lib/rosterScheduleOptimizer/dailyAcceptance.categories.test.ts`; `web/lib/rosterScheduleOptimizer/dailyAcceptance.manual.test.ts`; `web/lib/rosterScheduleOptimizer/gameForecastPoints.test.ts`; `web/lib/rosterScheduleOptimizer/planning.test.ts`; `{"discovered_not_run": ["web/__tests__/pages/start-chart.test.tsx", "web/e2e/social-share.spec.ts", "web/__tests__/fixtures/consumerGameRevision.ts", "web/components/RosterAutopsy/RosterAutopsy.test.tsx", "web/__tests__/pages/forge/forecasts.test.tsx", "web/e2e/roster-schedule-optimizer.spec.ts", "web/e2e/rso-continuity.spec.ts", "web/e2e/start-chart.spec.ts", "web/hooks/yahooPlanningReadBroker.test.ts", "web/hooks/useCandidateMetrics.test.tsx", "web/hooks/useRosterPlanning.test.tsx", "web/components/SocialShare/SocialShare.test.tsx", "web/__tests__/components/RosterScheduleOptimizer/CategoryGains.test.tsx", "web/__tests__/components/RosterScheduleOptimizer/RosterScheduleOptimizer.test.tsx", "web/__tests__/components/RosterScheduleOptimizer/AcquisitionRules.integration.test.tsx", "web/__tests__/components/RosterScheduleOptimizer/StreamingItinerary.test.tsx", "web/lib/socialShare/schedule.test.ts", "web/__tests__/pages/api/v1/start-chart.test.ts", "web/components/RosterScheduleOptimizer/CandidateCard.test.tsx", "web/components/RosterScheduleOptimizer/CompactSchedule.test.ts"], "additional_reference_tests": 19, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (opus) category leagues get value 0 for every play, so start/sit in category leagues is pure schedule capacity (no SGP/z-score valuation)
  - (codex:roster-forecast-game-points) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-FSC-010 Category values, opponent totals and matchup result

- **Match:** Both; Opus FSC-010; Codex roster-plan-category-values, roster-plan-points
- **Purpose:** Compute pooled category values (counting or ratio) and win/loss/tie vs the opponent.
- **Where:** `web/lib/rosterScheduleOptimizer/planning.ts:60 (categoryValue)`; `web/lib/rosterScheduleOptimizer/planning.ts:79 (opponentStats)`; `web/lib/rosterScheduleOptimizer/planning.ts:934 (categoryResults)`; `web/lib/rosterScheduleOptimizer/planning.ts:60 categoryValue`; `web/lib/rosterScheduleOptimizer/planning.ts:68 categoryRelation`; `web/lib/rosterScheduleOptimizer/planning.ts:934 [inline calculation: Pooled category values and matchup outcomes]`; `web/lib/rosterScheduleOptimizer/planning.ts:647 evaluatePlan`; `web/lib/rosterScheduleOptimizer/planning.ts:892 [inline calculation: Complete-plan projected fantasy points and assignment value]`; `web/lib/rosterScheduleOptimizer/planning.ts:939 [inline calculation: Complete-plan projected fantasy points and assignment value]`
- **Tags (heuristic):** generation: current
- **Opus view (FSC-010):**
  - Method: Counting: numerator x multiplier. Ratio: numerator/denominator x multiplier (null if denominator<=0). Opponent = realized + remaining per key (unknown if either missing). Result: own==opp tie, else win if (own-opp) x (+1 higher / -1 lower) > 0. Uses projected means only.
  - Inputs/units: stat totals (realized + projected remaining counts); ratio categories numerator/denominator; multiplier (e.g. 100 for %); sources: Yahoo matchup scoreboard (opponent), FORGE forecasts
  - Output scale: category value in league units; result win/loss/tie/unknown; writes: —
  - Status: live — pages/roster-schedule-optimizer.tsx -> components/RosterScheduleOptimizer/RosterScheduleOptimizer.tsx -> lib/rosterScheduleOptimizer/executionAdapter.ts (planRoster, candidatePlanMetrics, healthyReserves) (category leagues; weekly H2H matchup math)
  - Consumers: evaluatePreparedPlan; CategoryGains.tsx; compareCategoryEvaluations
- **Codex view (roster-plan-category-values, calculation, location; Codex family 'roster-planning'):** Pooled category values and matchup outcomes
  - Purpose: Counting numerator×multiplier or pooled numerator/denominator×multiplier; compare with opponent realized+remaining using higher/lower direction. Componentwise partial order marks better/worse/equal/tradeoff.
  - Inputs/units: Category definitions, own pooled stats, opponent pooled stats, directions and multipliers.
  - Output scale: Native-unit categories and win/loss/tie/unknown; no cross-category scalar.
  - Version/status: No formula version declared in inspected file. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Codex view (roster-plan-points, calculation, location; Codex family 'roster-planning'):** Complete-plan projected fantasy points and assignment value
  - Purpose: Sum approved future chosen-game stats into realized totals, then weight. assignmentValue sums lineup-selection values; projectedValue includes banked realized stats.
  - Inputs/units: Roster, slots, locks, transaction timeline, realized stats, future forecasts and scoring weights.
  - Output scale: Fantasy-point scalar, projected stat vector, legality/coverage flags; null when relevant coverage unknown.
  - Version/status: No formula version declared in inspected file. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Audit context:**
  - Intent (Opus): planning.ts:944-946 comment ('Category mode reports no scalar score (no fixed category blend, FR9-D2)'); planning.ts:82 (FR9-D1 missing component unknown); tasks/prd-roster-schedule-optimizer.md; tasks/tasks-prd-rso-consolidated-2026-10-09.md
  - Intended contract (Codex roster-plan-category-values): Category outcomes are provisional means, not calibrated joint probabilities. Incomparable tradeoffs require manager choice. Source: web/lib/rosterScheduleOptimizer/planning.ts:60 categoryValue.
  - Intended contract (Codex roster-plan-points): Comparison, assignment and totals permissions are distinct. A capacity-selected lineup may have known totals without being a quality recommendation. Source: web/lib/rosterScheduleOptimizer/planning.ts:647 evaluatePlan.
  - External references: H2H category win probability models (e.g. Normal/Poisson per category) / SGP
  - Fixtures/test data: `web/e2e/roster-schedule-optimizer-fixtures.ts`; `web/e2e/fixtures/rso-acceptance/index.ts`; `web/e2e/fixtures/rso-continuity/index.ts`
  - Tests: `web/__tests__/components/RosterScheduleOptimizer/CategoryGains.test.tsx`; `web/lib/rosterScheduleOptimizer/dailyAcceptance.categories.test.ts`; `web/lib/rosterScheduleOptimizer/planning.test.ts`; `{"discovered_not_run": ["web/__tests__/pages/start-chart.test.tsx", "web/e2e/social-share.spec.ts", "web/__tests__/fixtures/consumerGameRevision.ts", "web/components/RosterAutopsy/RosterAutopsy.test.tsx", "web/__tests__/pages/forge/forecasts.test.tsx", "web/e2e/roster-schedule-optimizer.spec.ts", "web/e2e/rso-continuity.spec.ts", "web/e2e/start-chart.spec.ts", "web/hooks/yahooPlanningReadBroker.test.ts", "web/hooks/useCandidateMetrics.test.tsx", "web/hooks/useRosterPlanning.test.tsx", "web/components/SocialShare/SocialShare.test.tsx", "web/__tests__/components/RosterScheduleOptimizer/CategoryGains.test.tsx", "web/__tests__/components/RosterScheduleOptimizer/RosterScheduleOptimizer.test.tsx", "web/__tests__/components/RosterScheduleOptimizer/AcquisitionRules.integration.test.tsx", "web/__tests__/components/RosterScheduleOptimizer/StreamingItinerary.test.tsx", "web/lib/socialShare/schedule.test.ts", "web/__tests__/pages/api/v1/start-chart.test.ts", "web/components/RosterScheduleOptimizer/CandidateCard.test.tsx", "web/components/RosterScheduleOptimizer/CompactSchedule.test.ts"], "additional_reference_tests": 17, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`; `{"discovered_not_run": ["web/__tests__/pages/start-chart.test.tsx", "web/e2e/social-share.spec.ts", "web/__tests__/fixtures/consumerGameRevision.ts", "web/components/RosterAutopsy/RosterAutopsy.test.tsx", "web/__tests__/pages/forge/forecasts.test.tsx", "web/e2e/roster-schedule-optimizer.spec.ts", "web/e2e/rso-continuity.spec.ts", "web/e2e/start-chart.spec.ts", "web/hooks/yahooPlanningReadBroker.test.ts", "web/hooks/useCandidateMetrics.test.tsx", "web/hooks/useRosterPlanning.test.tsx", "web/components/SocialShare/SocialShare.test.tsx", "web/__tests__/components/RosterScheduleOptimizer/CategoryGains.test.tsx", "web/__tests__/components/RosterScheduleOptimizer/RosterScheduleOptimizer.test.tsx", "web/__tests__/components/RosterScheduleOptimizer/AcquisitionRules.integration.test.tsx", "web/__tests__/components/RosterScheduleOptimizer/StreamingItinerary.test.tsx", "web/lib/socialShare/schedule.test.ts", "web/__tests__/pages/api/v1/start-chart.test.ts", "web/components/RosterScheduleOptimizer/CandidateCard.test.tsx", "web/components/RosterScheduleOptimizer/CompactSchedule.test.ts"], "additional_reference_tests": 31, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (opus) win/loss decided by comparing means, no variance or win probability; exact float equality defines a tie
  - (opus) limitation text itself says 'provisional means; calibrated joint probabilities unavailable'
  - (codex:roster-plan-category-values) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.
  - (codex:roster-plan-points) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-FSC-011 Recent form totals and recent FPts per game

- **Match:** Both; Opus FSC-012; Codex roster-recent-form
- **Purpose:** Sum last 10 (and last 5) played games and convert to league FPts/G.
- **Where:** `web/lib/rosterScheduleOptimizer/recentForm.ts:25 (recentTotals)`; `web/lib/rosterScheduleOptimizer/recentForm.ts:46 (lastFiveTotals)`; `web/lib/rosterScheduleOptimizer/recentForm.ts:51 (recentPointsPerGame)`; `web/components/RosterScheduleOptimizer/CandidateCard.tsx:30 (pooled SV%)`; `web/lib/rosterScheduleOptimizer/recentForm.ts:25 recentTotals`; `web/lib/rosterScheduleOptimizer/recentForm.ts:46 lastFiveTotals`; `web/lib/rosterScheduleOptimizer/recentForm.ts:51 recentPointsPerGame`
- **Tags (heuristic):** denominators: per game; generation: current
- **Opus view (FSC-012):**
  - Method: Sum mapped columns over last RECENT_GAMES=10 played games (missing value -> key null). FPts/G = sum weight x total / games, points mode only; null if any weighted key unmapped (ratio stats like GAA/SV% cannot be scored). Last-5 box score same over 5 games; SV% = saves/shots against pooled.
  - Inputs/units: WGO per-game box score counts (games_played=1 rows); scoring weights; sources: wgo_skater_stats, wgo_goalie_stats
  - Output scale: sums over <=10 / <=5 games; fantasy points per game; writes: —
  - Status: live — lib/rosterScheduleData/planning.ts:368-370 (unless skipRecentForm); also lib/rosterAutopsy/manual.ts
  - Consumers: streamingChain blended; StreamingItinerary; CandidateCard; rosterAutopsy/manual.ts
- **Codex view (roster-recent-form, calculation, location; Codex family 'roster-planning'):** Last-10/last-5 played-game totals and recent FP/G
  - Purpose: Take newest played rows up to N, sum mapped stats; score role-applicable count stats and divide by played games.
  - Inputs/units: WGO game counts; 10/5-game window; points/stat weights.
  - Output scale: Counting totals and recent fantasy points per game, null on missing applicable stat.
  - Version/status: No formula version declared in inspected file. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Audit context:**
  - Intent (Opus): recentForm.ts:3-5, 49-50 ('A hint only: never a projection input')
  - Intended contract (Codex roster-recent-form): Historical hint; not itself a projection input. lastFive goalie SV% display pools saves/shots. Source: web/lib/rosterScheduleOptimizer/recentForm.ts:25 recentTotals.
  - External references: none suggested
  - Fixtures/test data: `web/e2e/roster-schedule-optimizer-fixtures.ts`; `web/e2e/fixtures/rso-acceptance/index.ts`; `web/e2e/fixtures/rso-continuity/index.ts`
  - Tests: `web/components/RosterScheduleOptimizer/CandidateCard.test.tsx`; `web/lib/rosterAutopsy/manual.test.ts`; `web/lib/rosterScheduleData/planning.test.ts`; `web/lib/rosterScheduleOptimizer/recentForm.test.ts`; `{"discovered_not_run": ["web/components/RosterAutopsy/RosterAutopsy.test.tsx", "web/__tests__/components/RosterScheduleOptimizer/RosterScheduleOptimizer.test.tsx", "web/__tests__/components/RosterScheduleOptimizer/StreamingItinerary.test.tsx", "web/lib/rosterAutopsy/manual.test.ts", "web/lib/in-season/workspaceSchema.test.ts", "web/lib/rosterScheduleOptimizer/recentForm.test.ts", "web/lib/rosterScheduleOptimizer/streamingChain.test.ts", "web/lib/rosterScheduleData/planning.test.ts"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (opus) data read window is only 30 days (RECENT_FORM_DAYS) so 'last 10' may be fewer games after layoffs
  - (opus) recentPointsPerGame nulls the whole value when any weighted key is unmapped (e.g. a league scoring GAA), silently dropping form from the blend
  - (codex:roster-recent-form) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-FSC-012 Fantasy points percentile & correlation analysis (per game)

- **Match:** Both; Opus FSC-015; Codex roster-legacy-analysis-correlation, roster-legacy-analysis-percentiles, roster-legacy-analysis-points
- **Purpose:** Score each player-game in fantasy points, assign percentiles, and correlate non-scoring metrics
- **Where:** `web/scripts/fantasy_points_analysis.py:53 (fantasy_scoring)`; `web/scripts/fantasy_points_analysis.py:177 (calculate_fantasy_points)`; `web/scripts/fantasy_points_analysis.py:205 (calculate_percentiles)`; `web/scripts/fantasy_points_analysis.py:231 (analyze_high_fantasy_correlations)`; `web/scripts/fantasy_points_analysis.py:231 [inline calculation: Exploratory fantasy-percentile correlations and subgroup summaries]`; `web/scripts/fantasy_points_analysis.py:343 [inline calculation: Exploratory fantasy-percentile correlations and subgroup summaries]`; `web/scripts/fantasy_points_analysis.py:372 [inline calculation: Exploratory fantasy-percentile correlations and subgroup summaries]`; `web/scripts/fantasy_points_analysis.py:418 [inline calculation: Exploratory fantasy-percentile correlations and subgroup summaries]`; `web/scripts/fantasy_points_analysis.py:448 [inline calculation: Exploratory fantasy-percentile correlations and subgroup summaries]`; `web/scripts/fantasy_points_analysis.py:205 [inline calculation: Exploratory score percentile thresholds and tiers]`; `web/scripts/fantasy_points_analysis.py:177 [inline calculation: Exploratory per-game fantasy-point scoring]`; `web/scripts/fantasy_points_analysis.py:51 [inline calculation: Exploratory per-game fantasy-point scoring]`
- **Tags (heuristic):** percent scale: 0-100; denominators: per game, shots on goal; generation: legacy, research, current
- **Opus view (FSC-015):**
  - Method: FP = 3 G + 2 A + 1 PPP + 1 SHG + 1 SHP + 0.2 SOG + 0.2 HIT + 0.25 BLK; percentiles 5..99 via np.percentile; percentile rank = rank(pct)*100; tiers 0-25/25-50/50-75/75-90/90-100; Pearson corrwith fantasy percentile excluding scoring components
  - Inputs/units: per-game counts; sources: player_stats_unified (REST, season 20242025)
  - Output scale: fantasy points; percentile 0-100; r -1..1; writes: —
  - Status: legacy/dead — research script, hard-coded season 20242025
  - Consumers: none (research)
- **Codex view (roster-legacy-analysis-correlation, calculation, location; Codex family 'Offline fantasy analysis'):** Exploratory fantasy-percentile correlations and subgroup summaries
  - Purpose: Pandas corrwith computes Pearson correlation of retained numeric features against game fantasy percentile after explicit exclusions; drops NaN and sorts absolute correlation. Additional outputs means/counts/std by position, daily means and top-feature means by fantasy tier.
  - Inputs/units: Numeric per-game feature columns and fantasy rank percentile; explicit list of excluded scoring/derived/identity fields.
  - Output scale: Correlation coefficients[-1,1]; group means/sample SD/counts in feature units. Descriptive associations, not causality or validated forecasts.
  - Version/status: Standalone script, hardcoded20242025 loader; not run. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Codex view (roster-legacy-analysis-percentiles, calculation, location; Codex family 'Offline fantasy analysis'):** Exploratory score percentile thresholds and tiers
  - Purpose: Computes NumPy percentiles at5/10/25/50/75/90/95/99. Pandas average-tie percentile rank*100 assigns each game a score; pd.cut bins0/25/50/75/90/100 into performance tiers.
  - Inputs/units: Per-game script fantasy points across loaded season player-games.
  - Output scale: FP percentile thresholds, rank percentile0..100 and categorical tier labels.
  - Version/status: Standalone script, no formula version; not run. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Codex view (roster-legacy-analysis-points, calculation, location; Codex family 'Offline fantasy analysis'):** Exploratory per-game fantasy-point scoring
  - Purpose: Fills NaN0 in present scoring fields, sums configured metric*weight, rounds2 decimals. Defaults G3,A2,PPP1,SHG1,SHP1,SOG.2,HIT.2,BLK.25; missing columns omitted rather than invented.
  - Inputs/units: player_stats_unified skater game counts; script loader is hard-coded season20242025 and games_played1.
  - Output scale: Fantasy points/game under local script scoring, plus mean/min/max summaries.
  - Version/status: No formula version; checked-in standalone Python script. Not run and no source data requested. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed s…
- **Audit context:**
  - Intent (Opus): module docstring web/scripts/fantasy_points_analysis.py:2-15
  - Intended contract (Codex roster-legacy-analysis-correlation): Script calls these exploratory correlations; source comments use predictive language but no out-of-sample validation is established by inventory. Source: web/scripts/fantasy_points_analysis.py:231.
  - Intended contract (Codex roster-legacy-analysis-percentiles): Implementation uses library default interpolation/rank conventions; population is game observations, not individual player season ranks. Source: web/scripts/fantasy_points_analysis.py:205.
  - Intended contract (Codex roster-legacy-analysis-points): FantasyPointsAnalyzer docstring and fantasy_scoring dictionary; script is exploratory analysis, not shared league scoring source. Source: web/scripts/fantasy_points_analysis.py:177.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `{"discovered_not_run": [], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (opus) goal weight 3 conflicts with 6 in performance_prediction.py; comments call PP/SH 'bonus' though pp_points includes PP assists
  - (codex:roster-legacy-analysis-correlation) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.
  - (codex:roster-legacy-analysis-percentiles) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.
  - (codex:roster-legacy-analysis-points) Current usage, historical results and package/runtime versions not checked; hardcoded 20242025 scope observed. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-FSC-013 Category z-score value (calculateCategoryScores)

- **Match:** Both; Opus FSC-016; Codex roster-category-zscore, roster-goalie-rate-shrink
- **Purpose:** Weighted sum of per-category z-scores with goalie rate regression.
- **Where:** `web/lib/scoring/categoryScores.ts:84 (calculateCategoryScores)`; `web/lib/scoring/categoryScores.ts:67 (regressedGoalieRate)`; `web/lib/scoring/categoryScores.ts:35 (isInvertedCategory)`; `web/lib/scoring/categoryScores.ts:84 calculateCategoryScores`; `web/lib/scoring/categoryScores.ts:54 standardDeviation`; `web/lib/scoring/categoryScores.ts:67 regressedGoalieRate`
- **Tags (heuristic):** denominators: per 60, shots on goal; generation: development, current
- **Opus view (FSC-016):**
  - Method: Per role, mean and sample SD (n-1) of raw values; goalie SV% regressed: (SA*v + 1200*mean)/(SA+1200); GAA: (GS*v + 25*mean)/(GS+25); z = (v-mean)/sd, inverted for GAA, GA, Losses; score = sum weight*z (weight default 1). Default categories G,A,PPP,SOG,HIT,BLK when no weights.
  - Inputs/units: season totals for counts; SV% fraction; GAA goals/60; sources: caller-provided projections
  - Output scale: sum of z-scores (unbounded); writes: —
  - Status: live — /fantasy-projections page and draft-pro recommendations
  - Consumers: pages/fantasy-projections.tsx:1059; web/lib/draft-pro/recommendations.ts; draft-pro scenarios/reports (inversion helpers)
- **Codex view (roster-category-zscore, calculation, location; Codex family 'draft-scoring'):** Role-specific weighted category z-score sum
  - Purpose: Compute per-role/category mean and sample SD (n−1); directional z=(value−mean)/SD, reversed for GAA/GA/losses; sum category weight×z. Skip missing/zero-SD categories.
  - Inputs/units: Skater/goalie projected category values in native units, enabled category weights.
  - Output scale: Dimensionless weighted z-sum, unbounded signed.
  - Version/status: No formula version declared in inspected file. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Codex view (roster-goalie-rate-shrink, calculation, location; Codex family 'draft-scoring'):** Workload-regressed goalie SV% and GAA
  - Purpose: Regress SV% toward role population mean using 1200 prior shots, GAA using 25 prior starts: (workload×rate+prior×mean)/(workload+prior).
  - Inputs/units: Saves percentage fraction, goals/60 GAA, shots-against or starts counts, role mean.
  - Output scale: Same rate units as input; used inside category z-scoring.
  - Version/status: No formula version declared in inspected file. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex roster-category-zscore): Default six skater categories only when weight map empty; role applicability separates goalie/skater populations. Source: web/lib/scoring/categoryScores.ts:84 calculateCategoryScores.
  - Intended contract (Codex roster-goalie-rate-shrink): Raw population SD remains the normalization denominator; workload regression is applied only to goalie rate values. Source: web/lib/scoring/categoryScores.ts:67 regressedGoalieRate.
  - External references: Standard category z-score / SGP valuation (replacement-level-relative, rate stats weighted by volume, e.g., Razzball/FanGraphs z-scores)
  - Fixtures/test data: none listed
  - Tests: `web/lib/scoring/categoryScores.test.ts`; `{"discovered_not_run": ["web/lib/scoring/categoryScores.test.ts", "web/lib/sustainability/features.test.ts"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`; `{"discovered_not_run": ["web/lib/scoring/categoryScores.test.ts"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (opus) Goalie values regressed but mean/SD come from unregressed population: shrunk goalies get understated z
  - (opus) Rate stats (SV%, GAA) not volume-weighted (no 'impact' conversion), so a 5-start goalie with good SV% scores like a starter after only 1200-shot shrink
  - (opus) Population = all players passed (no replacement-level or rostered-pool cut)
  - (opus) OTL_GOALIE not inverted although losses are
  - (codex:roster-category-zscore) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.
  - (codex:roster-goalie-rate-shrink) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-FSC-014 Start Chart today value, Hungarian lineup and stream gain

- **Match:** Both; Opus FSC-017; Codex web-lib-projections-starterboardscoring-scoreboardstats
- **Purpose:** Today's expected fantasy value per Yahoo player, optimal lineup, and best add/drop gain.
- **Where:** `web/lib/integrations/yahoo/starterBoard.ts:237 (valueFor)`; `web/lib/projections/starterBoardScoring.ts:50 (scoreBoardStats)`; `web/lib/projections/starterBoardPersonalization.ts:37 (assign, Hungarian)`; `web/lib/projections/starterBoardPersonalization.ts:44 (optimizeToday)`; `web/lib/projections/starterBoardPersonalization.ts:83 (rankTodayStreams)`; `web/lib/projections/starterBoardScoring.ts:50 scoreBoardStats`
- **Tags (heuristic):** denominators: per game; generation: current
- **Opus view (FSC-017):**
  - Method: Points: sum(stat*weight) over goalie or skater weights (split by key endsWith '_GOALIE'), null if any stat missing. Categories: single selected category value (GA_GOALIE * -1). Lineup: rectangular Hungarian assignment maximising sum of values with zero-value empty option; locked players preserved. Stream gain = max over legal drops of (revised optimum - base optimum); first 100 Yahoo-ranked FAs.
  - Inputs/units: expected per-game stats; sources: FORGE starter board predictions, Yahoo roster/available players
  - Output scale: fantasy points or single-category units; writes: —
  - Status: live — pages/api/v1/account/yahoo/starter-board.ts
  - Consumers: /api/v1/account/yahoo/starter-board (Start Chart)
- **Codex view (web-lib-projections-starterboardscoring-scoreboardstats, calculation, location; Codex family 'FORGE staged projection math'):** Starter-board custom fantasy score (scoreBoardStats)
  - Purpose: Linear sum of nonzero category weights times compatible mean values; required missing category withholds.
  - Inputs/units: Per-game category counts/minutes and points-per-unit weights.
  - Output scale: Fantasy points or unavailable.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): web/lib/projections/starterBoardPersonalization.ts:3, :36
  - Intended contract (Codex web-lib-projections-starterboardscoring-scoreboardstats): {"source": "web/lib/projections/starterBoardScoring.ts:50", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["web/lib/projections/starterBoardScoring.ts:57 else points += value * weight;"]}
  - External references: ILP / Hungarian assignment for daily lineups (optimal vs greedy)
  - Fixtures/test data: none listed
  - Tests: `web/__tests__/pages/api/v1/start-chart.test.ts`; `web/e2e/start-chart.spec.ts`; `web/lib/projections/startChartPipeline.test.ts`; `{"status": "Discovered only; not run", "references": ["web/lib/projections/startChartPipeline.test.ts:13"]}`
- **Leads (not audited):**
  - (opus) GAMES_STARTED, SAVE_PERCENTAGE, GOALS_AGAINST_AVERAGE lack '_GOALIE' suffix so they would be applied to skaters and dropped from goalies
  - (opus) Category mode inverts only GOALS_AGAINST_GOALIE, not GAA/losses
  - (opus) Streaming limited to first 100 Yahoo-ranked available players
  - (codex:web-lib-projections-starterboardscoring-scoreboardstats) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested."]

## M-FSC-015 Ownership / ADP trend movement

- **Match:** Both; Opus FSC-023; Codex MISC-OWNERSHIP
- **Purpose:** Risers and fallers in Yahoo ownership % or ADP over a 1/3/5/10-day window.
- **Where:** `web/pages/api/v1/transactions/ownership-trends.ts:155 (calculateTrendMovement)`; `web/pages/api/v1/transactions/ownership-trends.ts:380-480`; `web/pages/api/v1/transactions/ownership-trends.ts:154 calculateTrendMovement`
- **Tags (heuristic):** percent scale: 0-100; generation: current
- **Opus view (FSC-023):**
  - Method: previous = timeline point on or before target date; ownership: target = today(UTC) - window, delta = latest - previous (pct points), deltaPct = delta; ADP: target = latest date - window, delta = previous - latest, deltaPct = delta/previous*100. Risers delta>0 sorted desc, fallers asc. Sparkline last max(12, window+2) points.
  - Inputs/units: ownership percent 0-100; ADP pick number; sources: yahoo_players_with_normalized_history, yahoo_player_draft_analysis_history, yahoo_nhl_player_map_read
  - Output scale: percentage points; ADP percent change; writes: —
  - Status: live — /api/v1/transactions/ownership-trends used by FORGE dashboard
  - Consumers: FORGE dashboard TopAddsRail; pages/FORGE.tsx; forge player page
- **Codex view (MISC-OWNERSHIP, calculation, location; Codex family 'Other product calculations'):** Ownership and ADP trend movement
  - Purpose: Convert adjacent source snapshots into direction-aware movement.
  - Inputs/units: Latest/previous ownership percent or positive ADP draft position.
  - Output scale: Ownership delta percentage points; ADP previous−latest and relative percent versus previous; 2-decimal rounding.
  - Version/status: Local API helper. Production deployment/active database state not checked.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex MISC-OWNERSHIP): ADP improvement reverses sign; ownership deltaPct equals raw percentage-point delta.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `No adjacent test located; broader suites not exhaustively traced.`; `web/__tests__/pages/api/v1/transactions/ownership-trends.test.ts`
- **Leads (not audited):**
  - (opus) Ownership window anchored at today but ADP at latest point: a stale ownership timeline compares an old latest value against an even older one
  - (opus) deltaPct for ownership is percentage points, not percent change (name mismatch)
  - (opus) No freshness check on latest point (contrast 3-day rule in PlayerPickupTable)
  - (codex:MISC-OWNERSHIP) No mathematical accuracy or fitness assessment performed. Tests listed, not run.

## M-FSC-016 Roster Autopsy retained recent points per game

- **Match:** Both; Opus FSC-030; Codex roster-autopsy-coverage
- **Purpose:** Historical points/game hint for imported RSO players.
- **Where:** `web/lib/rosterAutopsy/manual.ts:217 (retainedRecentPoints)`; `web/lib/rosterAutopsy/manual.ts:91 (recentTotals 1..10 games)`; `web/lib/rosterAutopsy/manual.ts:186 analyzeRoster`; `web/lib/rosterAutopsy/manual.ts:217 retainedRecentPoints`
- **Tags (heuristic):** denominators: per game; generation: current
- **Opus view (FSC-030):**
  - Method: Delegates to RSO recentPointsPerGame (sum stat*weight / games) when scoring supported and class matches.
  - Inputs/units: last-10 totals; sources: RSO workspace
  - Output scale: fantasy points per game; writes: —
  - Status: live
  - Consumers: RosterAutopsy.tsx:241
- **Codex view (roster-autopsy-coverage, calculation, location; Codex family 'Trade and roster autopsy'):** Roster autopsy structural slot coverage and recent-point hint
  - Purpose: Runs active-slot matcher using uniform player value1, diagnoses unfilled/covered eligible positions and unresolved eligibility. Recent point hint delegates retained historical recent-form scoring where complete.
  - Inputs/units: Manually entered roster eligibility, active slot counts, optional retained recent stats and point weights.
  - Output scale: Maximum fill counts, unfilled slots/diagnosis and optional recent fantasy-points hint.
  - Version/status: Local manual roster-autopsy workflow. Read from local octoberBranch during a non-atomic checkout inspection: began at d31dcb33f72d4c9d69b507874c388f0cd549fe2f; coordinator later observed HEAD 11e4192, whose commit delta comprised four Browserless diagnostic files. Existing dirty work was preserved. No single immutable snapshot or deployed status is claimed.
- **Audit context:**
  - Intent (Opus): web/lib/rosterAutopsy/manual.ts:216 ('historical hints; never player grades or forecasts')
  - Intended contract (Codex roster-autopsy-coverage): manual.ts and roster-autopsy diagnosis source distinguish structural evidence from schedule/projection analysis. Source: web/lib/rosterAutopsy/manual.ts:186 analyzeRoster.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/components/RosterAutopsy/RosterAutopsy.test.tsx`; `{"discovered_not_run": ["web/components/RosterAutopsy/RosterAutopsy.test.tsx", "web/lib/rosterAutopsy/diagnosis.test.ts", "web/lib/rosterAutopsy/manual.test.ts"], "additional_reference_tests": 0, "status": "Discovered by bounded filename/import/symbol reference only; not run and not proof of direct formula coverage."}`
- **Leads (not audited):**
  - (opus) Up to 10-game raw sample, no shrinkage (labelled a hint)
  - (codex:roster-autopsy-coverage) Runtime source contents, production configuration, release/admission, and deployed implementation were not verified. Consumer list is a bounded import/symbol-reference search and may include module-level or unrelated same-symbol references; it is not a complete or verified call graph. Listed tests are discovery candidates, not coverage or passing-test claims.

## M-FSC-017 Selected-period opponent point pct (pickup context)

- **Match:** Both; Opus FSC-036; Codex core-343
- **Purpose:** Average standings point % of a team's opponents in the selected week, passed to PlayerPickupTable.
- **Where:** `web/components/GameGrid/GameGrid.tsx:536-552 (selectedPeriodTeamData)`; `web/components/GameGrid/utils/scheduleSummary.ts:7 (getOpponentPointPct)`; `web/components/GameGrid/utils/scheduleSummary.ts:7 getOpponentPointPct`
- **Tags (heuristic):** percent scale: fraction 0-1; generation: legacy, current
- **Opus view (FSC-036):**
  - Method: Mean of known opponent point pct; GameGrid.tsx defaults to 0 when none known and averages partial coverage. getOpponentPointPct (null unless all known) has no callers.
  - Inputs/units: fraction 0-1; sources: standings summary (pointPct)
  - Output scale: fraction 0-1; writes: —
  - Status: live — GameGrid.tsx:538; getOpponentPointPct legacy/dead (no callers)
  - Consumers: PlayerPickupTable weekly data
- **Codex view (core-343, calculation, location; Codex family 'GameGrid'):** Complete-schedule opponent point percentage
  - Formula: Arithmetic mean only when every opponent has a finite fraction in [0,1]. Repeated opponents retain game-slot weight.
  - Purpose: Provide complete-schedule opponent point percentage for the identified consumer.
  - Inputs/units: Opponent point percentages as fractions, one opponent per included game.
  - Output scale: Mean fraction or null; known/expected coverage counts.
  - Version/status: Local working tree on octoberBranch, read on 2026-11-10. HEAD changed during the inventory from d31dcb33f72d4c9d69b507874c388f0cd549fe2f to 11e4192d36ecc4ac4b338f9ab48e529c7049c618. This is a non-atomic local scan; deployment and persisted-data state are not verified. Referenced implementation files had no tracked/untracked status entry at the final status check.
- **Audit context:**
  - Intent (Opus): web/components/GameGrid/utils/scheduleSummary.ts:6
  - Intended contract (Codex core-343): Function signature and comments at web/components/GameGrid/utils/scheduleSummary.ts:7 getOpponentPointPct; independent product specification not verified.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `Located only; not run for this inventory.`; `web/components/GameGrid/utils/scheduleSummary.test.ts`
- **Leads (not audited):**
  - (opus) Unknown opponents become 0 (looks like weakest schedule) in GameGrid.tsx:549, contradicting the null-on-partial rule in getOpponentPointPct (dead)
  - (codex:core-343) ["Calculation inventory only; no correctness or model-quality verdict."]

## M-FSC-018 Week Score matchup bonus

- **Match:** Both; Opus FSC-038; Codex core-002
- **Purpose:** Bounded win-odds nudge inside weekScore.
- **Where:** `web/components/GameGrid/utils/calcWeekScore.ts:27 (calculateMatchupBonus)`; `web/components/GameGrid/utils/calcWeekScore.ts:27 calculateMatchupBonus`
- **Tags (heuristic):** denominators: per team game; generation: current
- **Opus view (FSC-038):**
  - Method: sum over games of (clamp(odds,0,100)/100 - 0.5); unknown odds contribute 0; divide by totalTeamGames; clamp to [-0.5,0.5].
  - Inputs/units: percent 0-100; sources: expected_goals.home_win_odds/away_win_odds
  - Output scale: -0.5..+0.5; writes: —
  - Status: live — via calcWeekScore on /game-grid
  - Consumers: calcWeekScore; scoreDecomposition.matchup
- **Codex view (core-002, calculation, location; Codex family 'weekScore'):** Matchup bonus
  - Formula: clamp(sum(clamp(odds, 0, 100)/100-0.5)/allGames, -.5, .5); missing odds contribute zero.
  - Purpose: Add bounded win-odds contribution.
  - Inputs/units: Win odds 0..100 percent; all included team games.
  - Output scale: [-0.5, +0.5] points.
  - Version/status: Local octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f (2026-11-10). No explicit metric version identified. Deployment and persisted-data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final status check.
- **Audit context:**
  - Intent (Opus): web/components/GameGrid/utils/calcWeekScore.ts:26 ('Interim win-odds heuristic')
  - Intended contract (Codex core-002): Source labels this an interim heuristic.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `Located only; not run for this inventory.`; `web/components/GameGrid/utils/calcWeekScore.test.js`
- **Leads (not audited):**
  - (opus) Back-to-back adjusted odds (x0.75) can push a favoured team below 50% and turn the bonus negative; mixes a fatigue proxy into win odds
  - (opus) api (market) odds are fetched but ignored (see calculateBlendedWinOdds)
  - (codex:core-002) ["Calculation inventory only; formulas and inputs have not been vetted."]

## M-FSC-019 weekScore (Game Grid Week Score)

- **Match:** Both; Opus FSC-039; Codex core-001
- **Purpose:** Rank each team's selected week for streaming by games volume, off-night games, win odds and slate crowding.
- **Where:** `web/components/GameGrid/utils/calcWeekScore.ts:54 (calcWeekScore)`; `web/components/GameGrid/utils/scheduleSummary.ts:58 (getTeamScheduleSummary)`; `web/components/GameGrid/GameGrid.tsx:291 (filteredColumns)`; `web/components/GameGrid/GameGrid.tsx:418 (sortedByScoreDesc rank)`; `web/components/RosterScheduleOptimizer/TeamScheduleContext.tsx:37`; `web/lib/socialShare/modules/offNightEdge.ts:147`; `web/components/GameGrid/utils/calcWeekScore.ts:54 calcWeekScore`
- **Tags (heuristic):** denominators: per game, per team game; generation: current
- **Opus view (FSC-039):**
  - Method: If totalTeamGames==0 return sentinel -100. score = 6*(teamGames - leagueGames/16) + 4*offNights + matchupBonus(+-0.5) + slateCrowding(+-0.25). leagueGames/16 = average team appearances (2 per game / 32 teams). Version string 'schedule-v2-crowding-0.25'. Rank = sort desc, index+1.
  - Inputs/units: games (counts); win odds percent 0-100; sources: NHL api-web /schedule/{date}, expected_goals (home/away_win_odds)
  - Output scale: unbounded points around 0 (roughly -20..+30); -100 sentinel for no games; writes: —
  - Status: live — used by /game-grid page (pages/game-grid/[mode].tsx -> GameGrid.tsx:291) and RSO TeamScheduleContext
  - Consumers: /game-grid page (GameGrid TeamRow, sort, rank); PlayerPickupTable team boost; RSO TeamScheduleContext; socialShare offNightEdge
- **Codex view (core-001, calculation, location; Codex family 'weekScore'):** Schedule week score
  - Formula: 6*(teamGames-leagueGames/16)+4*offNights+matchupBonus+slateCrowding
  - Purpose: Prioritize team game volume and displayed off-night games.
  - Inputs/units: Included team games; league games counted once; integer off-night games; win odds percent; slate games 1..16.
  - Output scale: Unbounded schedule points; -100 for zero games; display one decimal.
  - Version/status: Local octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f (2026-11-10). WEEK_SCORE_VERSION=schedule-v2-crowding-0.25 Deployment and persisted-data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final status …
- **Audit context:**
  - Intent (Opus): web/components/GameGrid/utils/calcWeekScore.ts:44-53 docblock; user-facing formula text web/components/GameGrid/GameGrid.tsx:864-875 and :1586-1597 ('interim heuristic, not a calibrated fantasy projection')
  - Intended contract (Codex core-001): JSDoc lines 44–52: preserve two-point schedule advantage of 4GP/1ON over 3GP/2ON.
  - External references: Common fantasy 'games-per-week / off-night' streaming heuristics (e.g., Frozen Tools/Left Wing Lock off-night counts); no calibrated standard
  - Fixtures/test data: `web/e2e/fixtures/game-grid-previews/real-week-32.ts`; `web/e2e/fixtures/game-grid-previews/data.ts`
  - Tests: `Located only; not run for this inventory.`; `web/components/GameGrid/utils/calcWeekScore.test.js`; `web/components/GameGrid/utils/scheduleSummary.test.ts`; `web/components/RosterScheduleOptimizer/TeamScheduleContext.test.tsx`; `web/lib/socialShare/modules/offNightEdge.test.ts`
- **Leads (not audited):**
  - (opus) Hard-coded 32 teams (/16) and weights 6/4 with no calibration; doc string itself calls it an 'interim heuristic'
  - (opus) Sentinel -100 for no games leaks into PlayerPickupTable min/max normalisation (team boost)
  - (opus) offNights weight 4 on top of the games term double-counts: an off-night game earns 6 (game) + 4
  - (opus) Off-night threshold <=8 duplicated in at least 8 files (helper.ts, TotalGamesPerDayRow, DateRangeTeamGrid, useDateRangeTeamGrid, scheduleOpportunity, TransposedGrid, lib/draftDashboard/scheduleMetrics.ts)
  - (codex:core-001) ["Calculation inventory only; formulas and inputs have not been vetted."]

## M-FSC-020 Week Score slate crowding adjustment

- **Match:** Both; Opus FSC-040; Codex core-003
- **Purpose:** Reward teams whose games fall on lighter league slates.
- **Where:** `web/components/GameGrid/utils/calcWeekScore.ts:6 (calculateSlateCrowding)`; `web/components/GameGrid/utils/scheduleSummary.ts:71-74`; `web/components/GameGrid/utils/calcWeekScore.ts:6 calculateSlateCrowding`
- **Tags (heuristic):** denominators: per team game; generation: current
- **Opus view (FSC-040):**
  - Method: Only when every team game has a valid slate count 1..16 and schedule complete: meanGrade = mean((16-count)/15); adjustment = 0.25*(2*meanGrade-1). Otherwise 0.
  - Inputs/units: games per day; sources: NHL schedule
  - Output scale: -0.25..+0.25; writes: —
  - Status: live — /game-grid weekly view
  - Consumers: calcWeekScore
- **Codex view (core-003, calculation, location; Codex family 'weekScore'):** Slate crowding adjustment
  - Formula: mean((16-slateCount)/15); .25*(2*meanGrade-1).
  - Purpose: Reward games on lighter league slates.
  - Inputs/units: Slate counts integer 1..16, expected team games, completeness flag.
  - Output scale: meanGrade 0..1; adjustment [-.25, .25]; incomplete adjustment zero.
  - Version/status: Local octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f (2026-11-10). No explicit metric version identified. Deployment and persisted-data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final status check.
- **Audit context:**
  - Intent (Opus): web/components/GameGrid/utils/calcWeekScore.ts:5 ('One centered adjustment for the entire included horizon')
  - Intended contract (Codex core-003): One centered adjustment for whole horizon, not per game.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `Located only; not run for this inventory.`; `web/components/GameGrid/utils/calcWeekScore.test.js`; `web/components/GameGrid/utils/scheduleSummary.test.ts`
- **Leads (not audited):**
  - (opus) Linear grade assumes max 16 games/day; overlaps conceptually with the off-night term (also slate-size based)
  - (opus) Four-week per-week scores call getTeamScheduleSummary without coveredDays so crowding is always 0 there
  - (codex:core-003) ["Calculation inventory only; formulas and inputs have not been vetted."]

## M-FSC-021 Win odds list with back-to-back penalty

- **Match:** Both; Opus FSC-041; Codex core-316
- **Purpose:** Per-day win odds for a team, discounted on second night of back-to-back.
- **Where:** `web/components/GameGrid/utils/calcWinOdds.ts:35 (convertTeamRowToWinOddsList)`; `web/components/GameGrid/utils/calcWinOdds.ts:69 (isBackToBack)`; `web/components/GameGrid/utils/calcWinOdds.ts:6 (calculateBlendedWinOdds)`; `web/components/GameGrid/utils/calcWinOdds.ts:35 convertTeamRowToWinOddsList`
- **Tags (heuristic):** percent scale: 0-100; generation: current
- **Opus view (FSC-041):**
  - Method: For each regular-season game take own-side winOdds; 'blended' function returns winOdds in both branches (apiWinOdds ignored). If team also played previous calendar day (including excluded days), odds *= 0.75.
  - Inputs/units: percent 0-100; sources: expected_goals
  - Output scale: percent 0-100 (after x0.75 can be <50 for favourites); writes: —
  - Status: live — /game-grid
  - Consumers: calculateMatchupBonus; PoissonHeatMap display; TeamRow display
- **Codex view (core-316, calculation, location; Codex family 'GameGrid'):** Displayed matchup odds and back-to-back adjustment
  - Formula: calculateBlendedWinOdds currently passes model odds unchanged; second consecutive day multiplies by.75; excluded day still contributes schedule context.
  - Purpose: Calculate displayed matchup odds and back-to-back adjustment.
  - Inputs/units: Regular-season schedule, excluded days, team win odds in percent.
  - Output scale: Adjusted win odds per included day or null.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f.  Deployment not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final status check.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED (only function docstring at calcWinOdds.ts:29-33)
  - Intended contract (Codex core-316): Source types and implementation in web/components/GameGrid/utils/calcWinOdds.ts:35; separate acceptance not verified.
  - External references: Published back-to-back win% drop ~3-5 points (e.g. Evolving-Hockey/MoneyPuck rest effects), not a 25% multiplicative cut
  - Fixtures/test data: none listed
  - Tests: `Located only; not run for this inventory.`; `web/components/GameGrid/utils/calcWinOdds.test.js`
- **Leads (not audited):**
  - (opus) calculateBlendedWinOdds is a no-op blend: both branches return winOdds
  - (opus) 0.75 multiplier on a percentage is far larger than empirical B2B effects and makes odds no longer sum to 100 per game
  - (opus) TeamRow.tsx:38 comment says win odds are 'between -5 and 5' while DB column is numeric(5,2) percent
  - (codex:core-316) ["Inventory only; no correctness verdict."]

## M-FSC-022 Tertile favourability bands and top/bottom-10 ranks

- **Match:** Both; Opus FSC-042; Codex core-319, core-320
- **Purpose:** Classify teams' metrics into high/middle/low thirds and competition ranks for colouring.
- **Where:** `web/components/GameGrid/utils/fourWeekMetricBands.ts:4 (toFourWeekMetricBands)`; `web/components/GameGrid/utils/metricRanks.ts:4 (toRankMaps)`; `web/components/GameGrid/DesktopMasterTable.tsx:512-530`; `web/components/GameGrid/OpponentMetricsTable.tsx:166`; `web/components/GameGrid/utils/fourWeekMetricBands.ts:4 toFourWeekMetricBands`; `web/components/GameGrid/utils/metricRanks.ts:4 toRankMaps`
- **Tags (heuristic):** generation: current
- **Opus view (FSC-042):**
  - Method: Bands: tie-group midpoint percentile (first+last)/(2n); <=1/3 high, >=2/3 low. Ranks: competition ranks, band = min(10, floor(n/2)); best map if bestRank<=band and worstRank>band.
  - Inputs/units: any; sources: —
  - Output scale: categorical band; rank 1..10; writes: —
  - Status: live — DesktopMasterTable, OpponentMetricsTable
  - Consumers: Game Grid tables
- **Codex view (core-319, calculation, location; Codex family 'GameGrid'):** Four-week high/middle/low bands
  - Formula: Sort; tie-group midpoint percentile=(first+last)/(2*N); high<=1/3, low>=2/3.
  - Purpose: Calculate four-week high/middle/low bands.
  - Inputs/units: Known team values and preferred direction.
  - Output scale: Thirds: high, middle, low.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f.  Deployment not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final status check.
- **Codex view (core-320, calculation, location; Codex family 'GameGrid'):** Best/worst competition-rank bands
  - Formula: Equal values share first-position rank; band=min(10, floor(N/2)); overlapping ties excluded from both bands.
  - Purpose: Calculate best/worst competition-rank bands.
  - Inputs/units: Finite team values and preferred direction.
  - Output scale: Best/worst rank maps.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f.  Deployment not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final status check.
- **Audit context:**
  - Intent (Opus): web/components/GameGrid/utils/fourWeekMetricBands.ts:3; web/components/GameGrid/utils/metricRanks.ts:3
  - Intended contract (Codex core-319): Source types and implementation in web/components/GameGrid/utils/fourWeekMetricBands.ts:4; separate acceptance not verified.
  - Intended contract (Codex core-320): Source types and implementation in web/components/GameGrid/utils/metricRanks.ts:4; separate acceptance not verified.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `Located only; not run for this inventory.`; `web/components/GameGrid/utils/fourWeekMetricBands.test.ts`; `web/components/GameGrid/utils/metricRanks.test.ts`
- **Leads (not audited):**
  - (codex:core-319) ["Inventory only; no correctness verdict."]
  - (codex:core-320) ["Inventory only; no correctness verdict."]

## M-FSC-023 Team games and off-night counts (Game Grid helper)

- **Match:** Both; Opus FSC-043; Codex core-341
- **Purpose:** Count included regular-season team games and those on off-nights; league games per day.
- **Where:** `web/components/GameGrid/utils/helper.ts:12 (isRegularScheduleGame)`; `web/components/GameGrid/utils/helper.ts:19 (getTotalGamePlayed)`; `web/components/GameGrid/utils/helper.ts:39 (calcTotalOffNights)`; `web/components/GameGrid/utils/helper.ts:116 (getRegularGamesPerDay)`; `web/components/GameGrid/GameGrid.tsx:277`; `web/components/GameGrid/utils/helper.ts:19 getTotalGamePlayed`; `web/components/GameGrid/utils/helper.ts:39 calcTotalOffNights`; `web/components/GameGrid/utils/helper.ts:116 getRegularGamesPerDay`
- **Tags (heuristic):** generation: current
- **Opus view (FSC-043):**
  - Method: Regular game = gameType 2, id>0, not PPD/CNCL/POSTPONED/CANCELLED. Off-night = team plays on a day with <=8 league regular-season games. League games/day = distinct regular game ids per day.
  - Inputs/units: games; sources: NHL schedule
  - Output scale: integer counts; writes: —
  - Status: live — /game-grid
  - Consumers: weekScore; PlayerPickupTable (gamesPlayed/offNights); FourWeek grid; RSO TeamScheduleContext
- **Codex view (core-341, calculation, location; Codex family 'GameGrid'):** Included games and off-night counts
  - Formula: Count admitted games; an off-night has at most 8 league games. getRegularGamesPerDay deduplicates game IDs.
  - Purpose: Provide included games and off-night counts for the identified consumer.
  - Inputs/units: Regular-season schedule rows, selected days, excluded days and unique league game counts per day.
  - Output scale: Integer included games and off-night games.
  - Version/status: Local working tree on octoberBranch, read on 2026-11-10. HEAD changed during the inventory from d31dcb33f72d4c9d69b507874c388f0cd549fe2f to 11e4192d36ecc4ac4b338f9ab48e529c7049c618. This is a non-atomic local scan; deployment and persisted-data state are not verified. Referenced implementation files had no tracked/untracked status entry at the final status check.
- **Audit context:**
  - Intent (Opus): web/components/GameGrid/utils/helper.ts:11, :34-37
  - Intended contract (Codex core-341): Function signature and comments at web/components/GameGrid/utils/helper.ts:19 getTotalGamePlayed; independent product specification not verified.
  - External references: Community off-night definition: nights with fewer than half the league playing (<=8 games of 16 max)
  - Fixtures/test data: `web/e2e/fixtures/game-grid-previews/real-week-32.ts`
  - Tests: `Located only; not run for this inventory.`; `web/components/GameGrid/utils/scheduleSummary.test.ts`
- **Leads (not audited):**
  - (opus) Threshold <=8 hard-coded separately in many files; TotalGamesPerDayRow uses raw API numberOfGames (can include non-regular games) in some callers
  - (opus) Finals still count as 'opportunities' (comment helper.ts:11) so a past week counts already-played games
  - (codex:core-341) ["Calculation inventory only; no correctness or model-quality verdict."]

## M-FSC-024 Weighted off-nights (calcWeightedOffNights)

- **Match:** Both; Opus FSC-044; Codex core-342
- **Purpose:** Off-night games weighted more heavily on lighter slates.
- **Where:** `web/components/GameGrid/utils/helper.ts:71 (calcWeightedOffNights)`; `web/lib/socialShare/schedule.ts:104`; `web/components/GameGrid/utils/helper.ts:71 calcWeightedOffNights`
- **Tags (heuristic):** denominators: per team game; generation: current
- **Opus view (FSC-044):**
  - Method: For each team game on a day with g<=8 games: weight = (2/7) * (1 + max(0, 7/16 - g/16)); 7->0.2857, 6->0.3036, 5->0.3214; summed.
  - Inputs/units: games per day; sources: NHL schedule
  - Output scale: weighted count (~0.29 per off-night game); writes: —
  - Status: live — only via web/lib/socialShare/schedule.ts
  - Consumers: socialShare schedule module
- **Codex view (core-342, calculation, location; Codex family 'GameGrid'):** Weighted off-night total
  - Formula: For each game on a night with g <= 8, add (2/7) * (1 + max(0, (7-g)/16)).
  - Purpose: Provide weighted off-night total for the identified consumer.
  - Inputs/units: Admitted team games; league game count g for each selected night.
  - Output scale: Nonnegative weighted off-night units.
  - Version/status: Local working tree on octoberBranch, read on 2026-11-10. HEAD changed during the inventory from d31dcb33f72d4c9d69b507874c388f0cd549fe2f to 11e4192d36ecc4ac4b338f9ab48e529c7049c618. This is a non-atomic local scan; deployment and persisted-data state are not verified. Referenced implementation files had no tracked/untracked status entry at the final status check.
- **Audit context:**
  - Intent (Opus): web/components/GameGrid/utils/helper.ts:58-70 docblock
  - Intended contract (Codex core-342): JSDoc at helper.ts:58–70 explicitly preserves the 7-game baseline weight and increases it for lighter slates.
  - External references: none suggested
  - Fixtures/test data: `web/lib/socialShare/pickupsFixture.ts`
  - Tests: `No dedicated test located in the bounded scan; no tests run.`; `web/lib/socialShare/modules/offNightEdge.test.ts (indirect)`
- **Leads (not audited):**
  - (opus) BASELINE_WEIGHT_AT_7=(9-7)/7 is a legacy magic number preserved 'to avoid shifting baselines'
  - (opus) Not used by the Game Grid itself; only social share uses it, so two off-night definitions coexist
  - (codex:core-342) ["Calculation inventory only; no correctness or model-quality verdict."]

## M-FSC-025 Poisson score matrix with 'tie-breaker' (PDHC heat map)

- **Match:** Both; Opus FSC-046; Codex core-317, core-318
- **Purpose:** Exact-score probability grid from home/away expected goals.
- **Where:** `web/components/GameGrid/utils/poisson.ts:3 (poissonProbability)`; `web/components/GameGrid/utils/poissonHelpers.ts:6 (generateProbabilityMatrixWithTieBreaker)`; `web/components/GameGrid/PDHC/PoissonHeatMap.tsx:166`; `web/components/GameGrid/utils/poisson.ts:3 poissonProbability`; `web/components/GameGrid/utils/poissonHelpers.ts:6 generateProbabilityMatrixWithTieBreaker`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: per game; generation: current
- **Opus view (FSC-046):**
  - Method: Independent Poisson P(i)*P(j) for 0..10 goals each. Computes home/away/draw totals, then 'redistributes' each diagonal cell as p*homeRatio + p*awayRatio.
  - Inputs/units: expected goals per game; sources: expected_goals
  - Output scale: probability 0-1 per cell; writes: —
  - Status: live — PoissonHeatMap in Game Grid
  - Consumers: PoissonHeatMap tooltip on Game Grid
- **Codex view (core-317, calculation, location; Codex family 'GameGrid'):** Poisson probability helper
  - Formula: lambda^k*exp(-lambda)/k!; nonpositive lambda gives mass 1 at zero.
  - Purpose: Calculate poisson probability helper.
  - Inputs/units: Event count k and lambda.
  - Output scale: Probability.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f.  Deployment not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final status check.
- **Codex view (core-318, calculation, location; Codex family 'GameGrid'):** Poisson matrix tie-breaker helper
  - Formula: Multiply independent Poisson probabilities; calculate strict-win ratios; diagonal cell is reassigned both proportional shares within that same cell.
  - Purpose: Calculate poisson matrix tie-breaker helper.
  - Inputs/units: Home/away lambda; max goals 10 by default.
  - Output scale: Truncated joint matrix.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f.  Deployment not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final status check.
- **Audit context:**
  - Intent (Opus): web/components/GameGrid/utils/poissonHelpers.ts:5 ('with tie-breaker')
  - Intended contract (Codex core-317): Source types and implementation in web/components/GameGrid/utils/poisson.ts:3; separate acceptance not verified.
  - Intended contract (Codex core-318): Source types and implementation in web/components/GameGrid/utils/poissonHelpers.ts:6; separate acceptance not verified.
  - External references: Independent / bivariate Poisson (Maher 1982; Dixon-Coles low-score correction); NHL OT/SO resolution
  - Fixtures/test data: none listed
  - Tests: `No directly named test located; tests not run.`
- **Leads (not audited):**
  - (opus) Tie redistribution is a no-op: homeRatio+awayRatio=1 so diagonal cells are unchanged (poissonHelpers.ts:51-61)
  - (opus) Truncation at 10 goals not renormalised
  - (opus) Factorial memo uses truthiness check (fine) but recomputes for n=0..; duplicate Poisson implementations in components/PoissonDistributionChart.jsx and lib/gameGoalProjections/utils.ts
  - (codex:core-317) ["Inventory only; no correctness verdict."]
  - (codex:core-318) ["Inventory only; no correctness verdict."]

## M-FSC-026 Opponent atk/def percentile rating

- **Match:** Both; Opus FSC-047; Codex core-345
- **Purpose:** 0-100 percentile of opponents' xGF and inverted xGA per game.
- **Where:** `web/components/GameGrid/utils/scheduleOpportunity.ts:12 (percentileMap)`; `web/components/GameGrid/utils/scheduleOpportunity.ts:25 (buildOpponentRatings)`; `web/components/GameGrid/RatingMeter.tsx:22`; `web/components/GameGrid/OpponentMetricsTable.tsx:73`; `web/components/GameGrid/utils/scheduleOpportunity.ts:25 buildOpponentRatings`; `web/components/GameGrid/utils/scheduleOpportunity.ts:12 percentileMap`
- **Tags (heuristic):** percent scale: 0-100; denominators: per game; generation: current
- **Opus view (FSC-047):**
  - Method: Midrank percentile = 100*((first+end-1)/2)/(n-1) over valid teams (single team -> 50); def = 100 - xGA percentile; requires complete coverage. sampleMin/Max = opponents' GP range.
  - Inputs/units: xG per game; sources: nst_team_stats
  - Output scale: percentile 0-100; writes: —
  - Status: live — GameGrid.tsx:564, OpponentMetricsTable.tsx:73
  - Consumers: RatingMeter on Game Grid
- **Codex view (core-345, calculation, location; Codex family 'GameGrid'):** Schedule opponent attack and defense percentiles
  - Formula: Midrank percentile = 100 * mean tied zero-based rank / (n-1); singleton 50. Attack uses xGF percentile; defense uses 100 minus xGA percentile.
  - Purpose: Provide schedule opponent attack and defense percentiles for the identified consumer.
  - Inputs/units: Complete schedule coverage and mean opponent xGF/game and xGA/game.
  - Output scale: Attack and defense percentiles on 0–100; observed opponent sample range.
  - Version/status: Local working tree on octoberBranch, read on 2026-11-10. HEAD changed during the inventory from d31dcb33f72d4c9d69b507874c388f0cd549fe2f to 11e4192d36ecc4ac4b338f9ab48e529c7049c618. This is a non-atomic local scan; deployment and persisted-data state are not verified. Referenced implementation files had no tracked/untracked status entry at the final status check.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex core-345): Function signature and comments at web/components/GameGrid/utils/scheduleOpportunity.ts:25 buildOpponentRatings; independent product specification not verified.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `No dedicated test located in the bounded scan; no tests run.`; `web/components/GameGrid/OpponentMetricsTable.test.tsx`
- **Leads (not audited):**
  - (opus) Percentile of ~32 teams with no shrinkage early season
  - (opus) Version label 'xg-observed-percentile-v1'; provisional per reason string
  - (codex:core-345) ["Calculation inventory only; no correctness or model-quality verdict."]

## M-FSC-027 Four-week opportunity score (GP + 0.25*ON)

- **Match:** Both; Opus FSC-048; Codex core-346
- **Purpose:** Remaining four-week schedule opportunity per team and per week, with opponent xGF/xGA per game.
- **Where:** `web/components/GameGrid/utils/scheduleOpportunity.ts:71 (buildScheduleOpportunity)`; `web/components/GameGrid/utils/scheduleOpportunity.ts:40 (remainingEligibility)`; `web/components/GameGrid/utils/scheduleOpportunity.ts:140 (opportunityScale)`; `web/components/GameGrid/GameGrid.tsx:575-588`; `web/components/GameGrid/utils/scheduleOpportunity.ts:71 buildScheduleOpportunity`
- **Tags (heuristic):** denominators: per game; generation: current
- **Opus view (FSC-048):**
  - Method: Only games with state FUT/PRE, scheduleState OK and start > calculatedAt count. Per week: opportunity = GP + 0.25*ON (ON = slate <=8 games); null unless 7/7 days covered and no unknown games. Opponent xGF/gp and xGA/gp averaged per remaining game. Team total = sum of 4 weeks. avgOpponentPointPct = mean opponent standings point pct (null if any missing). League average score = mean of team totals. Week matchup label = tertile of opponent xGA/gp (high xGA -> 'easier').
  - Inputs/units: games; xG per game; sources: NHL schedule, nst_team_stats (situation=all), standings (teamPointPctMap)
  - Output scale: opportunity in game-equivalents (0..~20 over 4 weeks); writes: —
  - Status: live — /game-grid (OPPORTUNITY_VERSION remaining-utc-on-0.25-v1)
  - Consumers: Four-week grid, OpportunitySparkline; DesktopMasterTable bands
- **Codex view (core-346, calculation, location; Codex family 'GameGrid'):** Remaining four-week schedule opportunity
  - Formula: Opportunity = remaining games + 0.25 * remaining off-nights. Sum complete weekly scores. Opponent xG rates are per-game means with complete observations; matchup bands use opponent xGA.
  - Purpose: Provide remaining four-week schedule opportunity for the identified consumer.
  - Inputs/units: Future eligible regular-season games across four weeks, complete date coverage, off-night slate counts, opponent xGF/xGA totals and games.
  - Output scale: Weekly and four-week opportunity points; opponent mean xGF/game and xGA/game; coverage.
  - Version/status: Local working tree on octoberBranch, read on 2026-11-10. HEAD changed during the inventory from d31dcb33f72d4c9d69b507874c388f0cd549fe2f to 11e4192d36ecc4ac4b338f9ab48e529c7049c618. This is a non-atomic local scan; deployment and persisted-data state are not verified. Referenced implementation files had no tracked/untracked status entry at the final status check.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED (version constants only, scheduleOpportunity.ts:6-7)
  - Intended contract (Codex core-346): Function signature and comments at web/components/GameGrid/utils/scheduleOpportunity.ts:71 buildScheduleOpportunity; independent product specification not verified.
  - External references: none suggested
  - Fixtures/test data: `web/e2e/fixtures/opponent-four-week-metrics/App.tsx`
  - Tests: `No dedicated test located in the bounded scan; no tests run.`; `web/components/GameGrid/OpportunitySparkline.test.tsx`; `web/components/GameGrid/utils/scheduleSummary.test.ts`; `web/lib/socialShare/matchups.test.ts`
- **Leads (not audited):**
  - (opus) Off-night weight 0.25 here vs 4/6 ratio (0.67) in weekScore: two incompatible off-night valuations on the same page
  - (opus) Opponent xGF/xGA are season-to-date all-situation NST totals with unknown as-of time (acknowledged in opponentCategoryEffects.ts:79)
  - (opus) Mixed UTC date bucketing (shiftNhlDate) vs local-ET NHL game dates
  - (codex:core-346) ["Calculation inventory only; no correctness or model-quality verdict."]

## M-FSC-028 Four-week averages and OPP score

- **Match:** Both; Opus FSC-049; Codex core-344
- **Purpose:** League average GP/ON/opponent pts% over complete teams and a centred four-week score.
- **Where:** `web/components/GameGrid/utils/scheduleSummary.ts:21 (getFourWeekAverages)`; `web/components/GameGrid/utils/scheduleSummary.ts:35 (getFourWeekScore)`; `web/components/GameGrid/utils/fourWeekGridViews.ts:45 (buildFourWeekDetailAverages)`; `web/components/GameGrid/utils/FourWeekGrid.tsx:50 (scoreMean)`; `web/components/GameGrid/utils/scheduleSummary.ts:35 getFourWeekScore`; `web/components/GameGrid/utils/scheduleSummary.ts:21 getFourWeekAverages`
- **Tags (heuristic):** denominators: per team game; generation: legacy, current
- **Opus view (FSC-049):**
  - Method: Average over complete-coverage teams of gamesPlayed and offNights; avgOpponentPointPct mean. getFourWeekScore = (GP-avgGP)+(ON-avgON)+(avgOppPct - teamOppPct).
  - Inputs/units: games; point pct 0-1; sources: NHL schedule, standings
  - Output scale: game-equivalents; writes: —
  - Status: legacy/dead — getFourWeekScore has no production callers (only web/e2e/fixtures/opponent-four-week-metrics/App.tsx:40); getFourWeekAverages is live at GameGrid.tsx:580
  - Consumers: FourWeekGrid, DesktopMasterTable
- **Codex view (core-344, calculation, location; Codex family 'GameGrid'):** Four-week league baselines and schedule score
  - Formula: Score = team games - mean games + team off-nights - mean off-nights + mean opponent point percentage - team opponent point percentage. Missing opponent comparison contributes zero; getFourWeekAverages uses complete rows.
  - Purpose: Provide four-week league baselines and schedule score for the identified consumer.
  - Inputs/units: Team games and off-nights, complete-cohort averages and opponent point-percentage fractions.
  - Output scale: Signed schedule score, or null for incomplete schedule.
  - Version/status: Local working tree on octoberBranch, read on 2026-11-10. HEAD changed during the inventory from d31dcb33f72d4c9d69b507874c388f0cd549fe2f to 11e4192d36ecc4ac4b338f9ab48e529c7049c618. This is a non-atomic local scan; deployment and persisted-data state are not verified. Referenced implementation files had no tracked/untracked status entry at the final status check.
- **Audit context:**
  - Intent (Opus): web/components/GameGrid/utils/scheduleSummary.ts:20
  - Intended contract (Codex core-344): Function signature and comments at web/components/GameGrid/utils/scheduleSummary.ts:35 getFourWeekScore; independent product specification not verified.
  - External references: none suggested
  - Fixtures/test data: `web/e2e/fixtures/opponent-four-week-metrics/App.tsx`
  - Tests: `Located only; not run for this inventory.`; `web/components/GameGrid/utils/fourWeekGridViews.test.ts`; `web/components/GameGrid/utils/scheduleSummary.test.ts`
- **Leads (not audited):**
  - (opus) getFourWeekScore only called by e2e fixture (web/e2e/fixtures/opponent-four-week-metrics/App.tsx:40); live score is the opportunity score instead
  - (opus) Adds a 0-1 point-pct difference to game counts (unit mix; opponent term is ~100x smaller than a game)
  - (codex:core-344) ["Calculation inventory only; no correctness or model-quality verdict."]

## M-FSC-029 Team-vs-player forecast reconciliation residual and team game-expectation subtotal

- **Match:** Both; Opus FSC-050; Codex core-348
- **Purpose:** Compare a team category mean with the sum of its players' means; sum skater FORGE game expectations per team.
- **Where:** `web/components/GameGrid/utils/teamForecasts.ts:175 (reconcileTeamPlayerForecast)`; `web/components/GameGrid/utils/teamGameExpectations.ts:54 (summarizeTeamGameExpectations)`; `web/components/GameGrid/utils/teamGameExpectations.ts:12 (overlappingCategories)`; `web/components/GameGrid/utils/teamForecasts.ts:175 reconcileTeamPlayerForecast`
- **Tags (heuristic):** denominators: per game; generation: legacy
- **Opus view (FSC-050):**
  - Method: residual = team.mean - sum(admitted player means), no rescaling; team expectation subtotal = sum of admitted skater target.expected over games; G/A/PPP flagged as overlapping credits.
  - Inputs/units: per-game counts; sources: player-forecasts gameExpectations reader
  - Output scale: counts; writes: —
  - Status: legacy/dead — rg finds only test callers
  - Consumers: none in production (tests only)
- **Codex view (core-348, calculation, location; Codex family 'GameGrid'):** Team-to-player forecast reconciliation
  - Formula: Sum admitted declared-player means; residual = team mean - known player subtotal. No rescaling; incomplete roster remains partial.
  - Purpose: Provide team-to-player forecast reconciliation for the identified consumer.
  - Inputs/units: Matching team and declared-player category forecasts in the same game, model version, cutoff and lineage.
  - Output scale: Known player subtotal and team-minus-player residual in category units.
  - Version/status: Local working tree on octoberBranch, read on 2026-11-10. HEAD changed during the inventory from d31dcb33f72d4c9d69b507874c388f0cd549fe2f to 11e4192d36ecc4ac4b338f9ab48e529c7049c618. This is a non-atomic local scan; deployment and persisted-data state are not verified. Referenced implementation files had no tracked/untracked status entry at the final status check.
- **Audit context:**
  - Intent (Opus): web/components/GameGrid/utils/teamForecasts.ts:174; web/components/GameGrid/utils/teamGameExpectations.ts:49-53
  - Intended contract (Codex core-348): Function signature and comments at web/components/GameGrid/utils/teamForecasts.ts:175 reconcileTeamPlayerForecast; independent product specification not verified.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `Located only; not run for this inventory.`; `web/components/GameGrid/utils/teamForecasts.test.ts`; `web/components/GameGrid/utils/teamGameExpectations.test.ts`
- **Leads (not audited):**
  - (opus) No production callers for reconcileTeamPlayerForecast, summarizeTeamGameExpectations or overlappingCategories
  - (codex:core-348) ["Calculation inventory only; no correctness or model-quality verdict."]

## M-FSC-030 Team forecast category subtotal (Game Grid TeamDetails)

- **Match:** Both; Opus FSC-051; Codex core-347
- **Purpose:** Sum admitted per-game team category means (G,A,SOG,HIT,BLK,PPP,PIM) for a team's games.
- **Where:** `web/components/GameGrid/utils/teamForecasts.ts:79 (assessRecord)`; `web/components/GameGrid/utils/teamForecasts.ts:129 (summarizeTeamForecasts)`; `web/components/GameGrid/TeamDetails.tsx:119-150`; `web/components/GameGrid/utils/useTeamForecasts.ts`; `web/components/GameGrid/utils/teamForecasts.ts:129 summarizeTeamForecasts`
- **Tags (heuristic):** denominators: per game; generation: current
- **Opus view (FSC-051):**
  - Method: Admission gates (identity, future scheduled game, scope full_game_regulation_overtime, unit minutes for PIM else count, cutoff<=issued<=available<=now, not expired, mean>=0). Subtotal of admitted means; partial never rescaled. TeamDetails weekly total sums each game mean rounded to 0.1 and requires shared cutoff/model/lineage.
  - Inputs/units: per-game counts; PIM minutes; sources: shared FORGE team forecast reader (via useTeamForecasts)
  - Output scale: category count totals; writes: —
  - Status: live — TeamDetails.tsx:119
  - Consumers: Game Grid TeamDetails panel
- **Codex view (core-347, calculation, location; Codex family 'GameGrid'):** Admitted team forecast totals
  - Formula: Sum exactly one admitted record per distinct game and category; partial sums retain known/expected counts; no games gives zero.
  - Purpose: Provide admitted team forecast totals for the identified consumer.
  - Inputs/units: Per-game category forecast means with matching cutoff, model, roster, schedule and lineage.
  - Output scale: Category horizon total; available, partial, unavailable or no-games status.
  - Version/status: Local working tree on octoberBranch, read on 2026-11-10. HEAD changed during the inventory from d31dcb33f72d4c9d69b507874c388f0cd549fe2f to 11e4192d36ecc4ac4b338f9ab48e529c7049c618. This is a non-atomic local scan; deployment and persisted-data state are not verified. Referenced implementation files had no tracked/untracked status entry at the final status check.
- **Audit context:**
  - Intent (Opus): web/components/GameGrid/utils/teamForecasts.ts:6, :13, :36
  - Intended contract (Codex core-347): Function signature and comments at web/components/GameGrid/utils/teamForecasts.ts:129 summarizeTeamForecasts; independent product specification not verified.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `Located only; not run for this inventory.`; `web/components/GameGrid/TeamDetails.test.tsx`; `web/components/GameGrid/utils/teamForecasts.test.ts`; `web/components/GameGrid/utils/useTeamForecasts.test.tsx`
- **Leads (not audited):**
  - (opus) Weekly total sums rounded (toFixed(1)) per-game values (TeamDetails.tsx:144): rounding error up to 0.05*games, deliberate for display reconciliation
  - (codex:core-347) ["Calculation inventory only; no correctness or model-quality verdict."]

## M-FSC-031 Stat applicability (skater vs goalie key routing)

- **Match:** Opus only; Opus FSC-011; Codex —
- **Purpose:** Decide which scoring keys apply to skaters vs goalies.
- **Where:** `web/lib/rosterScheduleOptimizer/planning.ts:91 (GOALIE_STATS)`; `web/lib/rosterScheduleOptimizer/planning.ts:92 (statApplicability)`; `web/lib/rosterScheduleOptimizer/planning.ts:101 (applies)`
- **Tags (heuristic):** generation: current
- **Opus view (FSC-011):**
  - Method: Fixed goalie key set (SAVES_GOALIE, GOALS_AGAINST_GOALIE, WINS_GOALIE, ..., GAA, SV%); other keys apply to a class if any forecast of that class has the key finite, or if no forecast of either class has it.
  - Inputs/units: stat key names; sources: —
  - Output scale: boolean; writes: —
  - Status: live — pages/roster-schedule-optimizer.tsx -> components/RosterScheduleOptimizer/RosterScheduleOptimizer.tsx -> lib/rosterScheduleOptimizer/executionAdapter.ts (planRoster, candidatePlanMetrics, healthyReserves)
  - Consumers: all planning scoring paths
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: none suggested
  - Fixtures/test data: `web/e2e/roster-schedule-optimizer-fixtures.ts`; `web/e2e/fixtures/rso-acceptance/index.ts`; `web/e2e/fixtures/rso-continuity/index.ts`
  - Tests: `web/lib/rosterScheduleOptimizer/gameForecastPoints.test.ts`; `web/lib/rosterScheduleOptimizer/planning.test.ts`
- **Leads (not audited):**
  - (opus) applicability inferred from which forecasts happen to carry a key - a key missing from every forecast applies to both classes, so its absence makes totals unknown rather than zero

## M-FSC-032 Sustainability Sandbox skater fantasy score (hard-coded weights)

- **Match:** Opus only; Opus FSC-013; Codex —
- **Purpose:** Per-game fantasy score series for the Sustainability Sandbox skater trend chart.
- **Where:** `web/pages/trendsSandbox.tsx:200 (FANTASY_WEIGHTS)`; `web/pages/trendsSandbox.tsx:2006 (fantasyScore per WGO game row)`; `web/pages/trendsSandbox.tsx:356 (metric selector returns fantasyScore)`
- **Tags (heuristic):** denominators: per game, shots on goal; generation: current
- **Opus view (FSC-013):**
  - Method: fantasyScore = 3*G + 2*A + 1*PPP + 0.2*SOG + 0.2*HIT + 0.25*BLK (PPP is a bonus on top of G/A).
  - Inputs/units: per-game counts; sources: wgo_skater_stats (per-game rows)
  - Output scale: fantasy points per game; writes: —
  - Status: live — /trendsSandbox (Sustainability Sandbox, web/lib/navigation/analyticsSurfaceOwnership.ts:138)
  - Consumers: /trendsSandbox skater trend chart and fantasy series (web/pages/trendsSandbox.tsx:2336, 2394)
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/__tests__/pages/trendsSandbox.test.tsx`
- **Leads (not audited):**
  - (opus) duplicate implementation of DEFAULT_SKATER_FANTASY_POINTS (web/lib/projectionsConfig/fantasyPointsConfig.ts:8) / FSC-029 default weights — values currently match but are copied, not imported, and ignore user league settings

## M-FSC-033 True Goalie Value default goalie fantasy point settings

- **Match:** Opus only; Opus FSC-014; Codex —
- **Purpose:** Default per-stat goalie fantasy weights used by the legacy goalie value page before the user edits them.
- **Where:** `web/pages/trueGoalieValue.tsx:104 (DEFAULT_FANTASY_SETTINGS)`
- **Tags (heuristic):** denominators: per game; generation: legacy
- **Opus view (FSC-014):**
  - Method: goalAgainst -1, save 0.2, shutout 3, win 4; passed to calculateGoalieRankings / goalie fantasy point calculators.
  - Inputs/units: per-game goalie counts; sources: —
  - Output scale: fantasy points; writes: —
  - Status: legacy/dead — page renders LegacySurfaceNotice
  - Consumers: components/GoaliePage/goalieCalculations (UST-025..UST-028); lib/supabase/GoaliePage/calculateGoalieRanking (UST-030)
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/__tests__/pages/trueGoalieValue.test.tsx`
- **Leads (not audited):**
  - (opus) duplicate implementation of DEFAULT_GOALIE_FANTASY_POINTS (web/lib/projectionsConfig/fantasyPointsConfig.ts:26-29) — same values, copied rather than imported

## M-FSC-034 NHL Edge snapshot freshness gate

- **Match:** Opus only; Opus FSC-018; Codex —
- **Purpose:** Reject Edge feature snapshots older than 14 days.
- **Where:** `web/lib/NHL/edgeFeatureContract.ts:244 (validateNhlEdgeSnapshotFreshness)`
- **Tags (heuristic):** generation: legacy
- **Opus view (FSC-018):**
  - Method: ageDays = floor((asOf - snapshot)/86400000); fail if <0 or > maxAgeDays (default 14).
  - Inputs/units: dates; sources: —
  - Output scale: days; writes: —
  - Status: legacy/dead — only edgeFeatureContract.test.ts calls it
  - Consumers: none outside tests
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/NHL/edgeFeatureContract.test.ts`
- **Leads (not audited):**
  - (opus) No production callers

## M-FSC-035 NHL schedule derived game type and daily counts

- **Match:** Opus only; Opus FSC-019; Codex —
- **Purpose:** Derive gameType from game id and count games per day.
- **Where:** `web/lib/NHL/server/index.ts:461 (getSchedule)`; `web/lib/NHL/server/index.ts:530 (derivedGameType)`
- **Tags (heuristic):** generation: current
- **Opus view (FSC-019):**
  - Method: gameType = floor(id/10000) % 100 (02 regular season). numGamesPerDay = API numberOfGames (all game types). Odds attached from expected_goals.
  - Inputs/units: —; sources: NHL api-web /schedule, expected_goals win odds
  - Output scale: —; writes: —
  - Status: live
  - Consumers: Game Grid, four-week schedule, RSO TeamScheduleContext
- **Audit context:**
  - Intent (Opus): web/lib/NHL/server/index.ts:477, :494
  - External references: NHL game id format SSSSTTNNNN
  - Fixtures/test data: `web/e2e/fixtures/game-grid-previews/real-week-32.ts`
  - Tests: none listed
- **Leads (not audited):**
  - (opus) numGamesPerDay counts preseason/international games; Game Grid recomputes regular counts but TotalGamesPerDayRow callers may use raw counts

## M-FSC-036 Goalie qualification minimum games (stats page)

- **Match:** Opus only; Opus FSC-020; Codex —
- **Purpose:** Minimum GP for goalies to appear in leaderboards.
- **Where:** `web/lib/NHL/statsPageFetch.ts:239-250 (loadMinGamesThreshold)`
- **Tags (heuristic):** generation: current
- **Opus view (FSC-020):**
  - Method: avgGames = mean team GP; if avgGames > 10 threshold = floor(0.25*avgGames) else 0.
  - Inputs/units: games; sources: standings table (season_id, date, games_played)
  - Output scale: games; writes: —
  - Status: live — /stats
  - Consumers: pages/stats/index.tsx
- **Audit context:**
  - Intent (Opus): web/lib/NHL/statsPageFetch.ts:72 comment
  - External references: NHL goalie qualification (25 GP of 82 historically / GP-proportional)
  - Fixtures/test data: none listed
  - Tests: `web/lib/NHL/statsPageFetch.test.ts`
- **Leads (not audited):**
  - (opus) Threshold 0 for the first ~10 games of the season

## M-FSC-037 NHL TOI share and team PP time (legacy statsapi)

- **Match:** Opus only; Opus FSC-021; Codex —
- **Purpose:** Convert mm:ss TOI to minutes; TOI% of 60 and PP TOI share.
- **Where:** `web/lib/NHL/TOI.ts:82 (parseTime)`; `web/lib/NHL/TOI.ts:93 (fetchTOIData)`; `web/lib/NHL/TOI.ts:31 (fetchTotalPowerPlayTime)`
- **Tags (heuristic):** percent scale: 0-100; denominators: per 60; generation: legacy, current
- **Opus view (FSC-021):**
  - Method: minutes = mm + ss/60 (strings containing '.' returned as Number). TOI% = minutes*100/60. Team PP time = sum of roster players' PPTOI / 5. PP share = player PPTOI / team PP time *100.
  - Inputs/units: mm:ss strings; sources: statsapi.web.nhl.com (retired)
  - Output scale: minutes; percent 0-100; writes: —
  - Status: live — parseTime used by 3 API routes (SustainabilityStats, Teams, CareerAverages); fetchTOIData default export is legacy/dead (no callers)
  - Consumers: parseTime: pages/api/SustainabilityStats/[playerId].ts, pages/api/Teams/[teamAbbreviation].ts, pages/api/CareerAverages/[playerId].ts
- **Audit context:**
  - Intent (Opus): web/lib/NHL/TOI.ts:77-81
  - External references: NHL TOI share uses team TOI incl. OT; PP share uses team PP time from play-by-play
  - Fixtures/test data: none listed
  - Tests: none listed
- **Leads (not audited):**
  - (opus) fetchTOIData default export has no callers and hits the retired statsapi.web.nhl.com
  - (opus) TOI% divides by 60 (ignores OT)
  - (opus) Team PP time /5 assumes 5 skaters (wrong for 5v3, 4v3)
  - (opus) parseTime treats '12.5' as minutes but '12:30' parsing ignores hours

## M-FSC-038 Ownership freshness and threshold filter

- **Match:** Opus only; Opus FSC-022; Codex —
- **Purpose:** Use latest Yahoo ownership only if <=3 days old; filter pool to Own<=threshold.
- **Where:** `web/components/PlayerPickupTable/PlayerPickupTable.tsx:171-228 (getLatestOwnershipEvidence, currentPickupOwnership, resolvePickupOwnership)`; `web/components/PlayerPickupTable/PlayerPickupTable.tsx:293 (defaultOwnershipThreshold=50)`; `web/lib/integrations/yahoo/playerWriter.ts:92 (assessYahooPercentOwned)`
- **Tags (heuristic):** percent scale: 0-100; generation: current
- **Opus view (FSC-022):**
  - Method: Latest valid dated timeline point (0-100); fresh if age<=3 days, stale/unknown otherwise (value nulled). Default filter own<=50%, unknown included by default. Writer accepts only explicit 0-100 values.
  - Inputs/units: percent 0-100; sources: yahoo_players, yahoo_nhl_player_map_read
  - Output scale: percent 0-100 or null; writes: yahoo_players.percent_ownership / ownership history (writer)
  - Status: live
  - Consumers: PlayerPickupTable filter
- **Audit context:**
  - Intent (Opus): web/lib/integrations/yahoo/playerWriter.ts:91
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/components/PlayerPickupTable/PlayerPickupTable.test.ts`; `web/lib/integrations/yahoo/writerPermissions.test.ts`

## M-FSC-039 Pickup GP% (player games / team games)

- **Match:** Opus only; Opus FSC-024; Codex —
- **Purpose:** Share of team games the player has played.
- **Where:** `web/components/PlayerPickupTable/PlayerPickupTable.tsx:2464 (playersDataWithComputedGp)`
- **Tags (heuristic):** percent scale: fraction 0-1; generation: current
- **Opus view (FSC-024):**
  - Method: clamp(playerGP/teamGP, 0, 1), fallback to mapped percent_games.
  - Inputs/units: games; sources: wgo_skater_stats_totals, wgo_goalie_stats_totals, nhl_standings_details
  - Output scale: fraction 0-1; writes: —
  - Status: live
  - Consumers: percentiles, display
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/components/PlayerPickupTable/PlayerPickupTable.test.ts`
- **Leads (not audited):**
  - (opus) Traded players: team GP of current team, player GP across teams -> clamped at 1

## M-FSC-040 Pickup table metric percentiles

- **Match:** Opus only; Opus FSC-025; Codex —
- **Purpose:** Percentile of each player's season stat among the filtered pool, separately for skaters and goalies.
- **Where:** `web/components/PlayerPickupTable/PlayerPickupTable.tsx:2546 (computePercentile)`; `web/components/PlayerPickupTable/PlayerPickupTable.tsx:2568 (computeInvertedPercentile)`; `web/components/PlayerPickupTable/PlayerPickupTable.tsx:2588 (assignPercentiles)`; `web/components/PlayerPickupTable/PlayerPickupTable.tsx:111-134 (metric lists)`
- **Tags (heuristic):** percent scale: 0-100; denominators: per 60; generation: current
- **Opus view (FSC-025):**
  - Method: Midrank percentile = (numBelow + 0.5*numEqual)/n*100; n=1 -> 50; null value -> 0. Only goals_against_avg inverted. Pool = players after ownership/position/team filters.
  - Inputs/units: season totals; GAA goals/60; SV% fraction; GP% 0-1; sources: yahoo_nhl_player_map_read, yahoo_players (percent_ownership), wgo_skater_stats_totals, wgo_goalie_stats_totals
  - Output scale: percentile 0-100; writes: —
  - Status: live — PlayerPickupTable inside /game-grid
  - Consumers: composite/displayScore
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: Standard fantasy z-score / SGP valuation (rate per game and replacement level) — here raw season-total percentiles
  - Fixtures/test data: none listed
  - Tests: `web/components/PlayerPickupTable/PlayerPickupTable.test.ts`; `web/e2e/player-pickup.spec.ts`
- **Leads (not audited):**
  - (opus) Raw season totals (not per-game) so volume dominates; GP% included as its own metric double counts availability
  - (opus) Percentiles depend on the filtered pool (ownership threshold changes every score)
  - (opus) shots_against ranked higher-is-better
  - (opus) Null stat -> percentile 0 displayed

## M-FSC-041 Pickup composite / display score

- **Match:** Opus only; Opus FSC-026; Codex —
- **Purpose:** Average of metric percentiles driving the BPA (best players available) ranking.
- **Where:** `web/components/PlayerPickupTable/PlayerPickupTable.tsx:2627 (composite)`; `web/components/PlayerPickupTable/PlayerPickupTable.tsx:2654-2752 (playersWithScores)`
- **Tags (heuristic):** percent scale: 0-100; generation: current
- **Opus view (FSC-026):**
  - Method: composite = mean of percentiles for non-null metrics. Modes: all -> composite; multiple -> mean of selected; single -> displayScore = mean of the OTHER metrics while sort uses the selected metric percentile; none -> 0 / sort -1. Equal weights.
  - Inputs/units: percentile 0-100; sources: —
  - Output scale: 0-100 (x0.75..1.25 with team boost); writes: —
  - Status: live — /game-grid PlayerPickupTable
  - Consumers: Best Players Available table sort
- **Audit context:**
  - Intent (Opus): web/components/PlayerPickupTable/PlayerPickupTable.tsx:813 (BPA heading comment only); otherwise UNDOCUMENTED
  - External references: Category z-score sum with league weights (Yahoo-style H2H categories)
  - Fixtures/test data: none listed
  - Tests: `web/components/PlayerPickupTable/PlayerPickupTable.test.ts`
- **Leads (not audited):**
  - (opus) Equal weight per metric regardless of league scoring settings (not tied to user categoryWeights)
  - (opus) Single-metric mode shows a score that excludes the selected metric (confusing 'Other Avg')

## M-FSC-042 Pickup team boost from Week Score

- **Match:** Opus only; Opus FSC-027; Codex —
- **Purpose:** Scale player scores by team schedule strength this week.
- **Where:** `web/components/PlayerPickupTable/PlayerPickupTable.tsx:2756 (teamScoreMultiplierMap)`; `web/components/PlayerPickupTable/PlayerPickupTable.tsx:2782 (playersWithScoresBoosted)`
- **Tags (heuristic):** generation: current
- **Opus view (FSC-027):**
  - Method: norm = (weekScore - min)/(max-min) (0.5 if range 0); multiplier = 1 + 0.25*(2*norm-1) -> 0.75..1.25; displayScore and sortByValue multiplied when toggle on.
  - Inputs/units: weekScore; sources: Game Grid weekScore
  - Output scale: multiplier 0.75-1.25; writes: —
  - Status: live — toggle teamBoostEnabled
  - Consumers: BPA ranking
- **Audit context:**
  - Intent (Opus): web/components/PlayerPickupTable/PlayerPickupTable.tsx:2771 comment ('up to +-25% boost/dilution')
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/components/PlayerPickupTable/PlayerPickupTable.test.ts`
- **Leads (not audited):**
  - (opus) Min-max uses -100 no-games sentinel: one idle team compresses everyone else toward 1.25
  - (opus) Multiplying a percentile by a schedule factor mixes scales; sortByValue -1 for 'none' becomes -0.75..-1.25

## M-FSC-043 Yahoo credited goalie appearances (goalie minimum progress)

- **Match:** Opus only; Opus FSC-028; Codex —
- **Purpose:** Count goalie games already credited toward a weekly minimum.
- **Where:** `web/lib/integrations/yahoo/rosterPlanning.ts:104 (yahooCreditedGoalieAppearances)`
- **Tags (heuristic):** denominators: per team game; generation: current
- **Opus view (FSC-028):**
  - Method: For each elapsed day from periodStart, goalie in active G slot whose team game is final and goalie games_played>0 -> +1; any gap -> null.
  - Inputs/units: games; sources: wgo_goalie_stats.games_played
  - Output scale: count; writes: —
  - Status: live
  - Consumers: RSO goalieMinimum.credited
- **Audit context:**
  - Intent (Opus): web/lib/integrations/yahoo/rosterPlanning.ts:98-103
  - External references: Yahoo minimum goalie games played rule
  - Fixtures/test data: none listed
  - Tests: `web/lib/integrations/yahoo/rosterPlanning.test.ts`
- **Leads (not audited):**
  - (opus) Counts appearances; Yahoo minimum may be starts (acknowledged as unknown in rules)

## M-FSC-044 Yahoo past-lineup actual fantasy points

- **Match:** Opus only; Opus FSC-029; Codex —
- **Purpose:** Actual points each rostered player scored on elapsed days of the matchup.
- **Where:** `web/lib/integrations/yahoo/rosterPlanning.ts:43 (yahooPastLineupPoints)`
- **Tags (heuristic):** denominators: per game; generation: current
- **Opus view (FSC-029):**
  - Method: Points leagues only: sum(stat*weight) per WGO per-game column, rounded to 0.01; player with no row in a final game = 0; any unmapped weight, non-final game or missing row -> null.
  - Inputs/units: per-game counts; sources: wgo_skater_stats, wgo_goalie_stats, rso_yahoo_past_lineups
  - Output scale: fantasy points; writes: —
  - Status: live — RSO Yahoo planning
  - Consumers: RSO matchup progress
- **Audit context:**
  - Intent (Opus): web/lib/integrations/yahoo/rosterPlanning.ts:37-42
  - External references: Yahoo points scoring (Yahoo stat corrections may differ)
  - Fixtures/test data: none listed
  - Tests: `web/lib/integrations/yahoo/rosterPlanning.test.ts`
- **Leads (not audited):**
  - (opus) Goalie/skater split by key suffix list differs from starterBoard split (endsWith '_GOALIE' only)

## M-FSC-045 Default fantasy points and category weights

- **Match:** Opus only; Opus FSC-031; Codex —
- **Purpose:** Default league scoring used when no provider settings exist.
- **Where:** `web/lib/user-settings/defaults.ts:41 (DEFAULT_CATEGORY_WEIGHTS)`; `web/lib/user-settings/defaults.ts:80 (createDefaultUserLeagueSettings)`; `web/lib/projectionsConfig/fantasyPointsConfig.ts:8,25`; `web/lib/user-settings/mappers.ts:16 (coerceNumberMap)`
- **Tags (heuristic):** denominators: shots on goal; generation: current
- **Opus view (FSC-031):**
  - Method: Points: G 3, A 2, PPP 1, SOG 0.2, HIT 0.2, BLK 0.25; goalie GA -1, SV 0.2, SO 3, W 4. Categories weight 1 each for G,A,PPP,SOG,HIT,BLK,W,SV,SV%. Default 12 teams, roster C2 LW2 RW2 D4 G2 UTIL1 BN4. Stored maps merged over defaults unless preserveExact.
  - Inputs/units: points per stat event; sources: user league settings row (scoring_categories, goalie_scoring_categories, category_weights)
  - Output scale: fantasy points; writes: user settings table (via mappers)
  - Status: live
  - Consumers: fantasy-projections, draft tools, RSO manual scoring, socialShare score
- **Audit context:**
  - Intent (Opus): web/lib/projectionsConfig/fantasyPointsConfig.ts:15-31 comments
  - External references: Yahoo/ESPN default points-league scoring settings
  - Fixtures/test data: none listed
  - Tests: `web/__tests__/contexts/AuthProviderContext.test.tsx`; `web/lib/socialShare/score.test.ts`
- **Leads (not audited):**
  - (opus) PPP +1 on top of G/A double-credits PP points (intended in many leagues but undocumented)
  - (opus) coerceNumberMap merges defaults into stored maps unless preserveExact, so a league that dropped a category can silently regain it

## M-FSC-046 ESPN league scoring mapping

- **Match:** Opus only; Opus FSC-032; Codex —
- **Purpose:** Map ESPN scoringItems to points weights or signed category weights.
- **Where:** `web/lib/integrations/espn/normalize.ts:212 (scoringMapping)`; `web/lib/integrations/espn/normalize.ts:182 (leagueType)`
- **Tags (heuristic):** generation: current
- **Opus view (FSC-032):**
  - Method: H2H_POINTS/TOTAL_SEASON_POINTS -> points: weight = item.points. H2H_CATEGORY/MOST_CATEGORIES/ROTO -> categories: weight = 1 if isReverseItem matches FHFH inversion else -1. Per-position overrides unsupported.
  - Inputs/units: points per stat; sources: ESPN fantasy API league settings
  - Output scale: weights (+-1 for categories); writes: user league settings when applied
  - Status: live — ESPN import
  - Consumers: ESPN import -> user settings
- **Audit context:**
  - Intent (Opus): web/lib/integrations/espn/normalize.ts:274 warning text
  - External references: none suggested
  - Fixtures/test data: `web/lib/integrations/espn/__fixtures__/fhl-categories.json`; `web/lib/integrations/espn/__fixtures__/fhl-points.json`; `web/lib/integrations/espn/__fixtures__/fhl-season-points.json`
  - Tests: `web/lib/integrations/espn/normalize.test.ts`
- **Leads (not audited):**
  - (opus) A -1 category weight combined with calculateCategoryScores inversion flips direction twice in some paths; consumers must not re-invert

## M-FSC-047 Fantrax league scoring mapping

- **Match:** Opus only; Opus FSC-033; Codex —
- **Purpose:** Map Fantrax scoring rules to points weights and category weights.
- **Where:** `web/lib/integrations/fantrax/normalize.ts:484-660 (scoring rules loop)`; `web/lib/integrations/fantrax/normalize.ts:343 (league type)`
- **Tags (heuristic):** generation: current
- **Opus view (FSC-033):**
  - Method: Points: weight = config.points; conflicting duplicates dropped as unsupported; SPECIAL_TEAMS_POINTS added to both PP_POINTS and SH_POINTS. Categories: weight = config.weight ?? 1.
  - Inputs/units: points per stat; sources: Fantrax league API / manual import
  - Output scale: weights; writes: user league settings when applied
  - Status: live — Fantrax import
  - Consumers: Fantrax import
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: none suggested
  - Fixtures/test data: `web/lib/integrations/fantrax/__fixtures__/nhl-categories.json`; `web/lib/integrations/fantrax/__fixtures__/nhl-points.json`
  - Tests: `web/lib/integrations/fantrax/normalize.test.ts`
- **Leads (not audited):**
  - (opus) No lower-is-better handling for Fantrax categories (ESPN path handles reverse items)

## M-FSC-048 Yahoo league scoring adaptation

- **Match:** Opus only; Opus FSC-034; Codex —
- **Purpose:** Map Yahoo stat categories and stat_modifiers to FHFH points weights or category weights.
- **Where:** `web/lib/integrations/yahoo/liveDraft.ts:449 (adaptScoring)`; `web/lib/integrations/yahoo/liveDraft.ts:275 (YAHOO_STAT_KEY_BY_ID)`; `web/lib/integrations/yahoo/liveDraft.ts:518 (parseYahooBoardSettings)`
- **Tags (heuristic):** generation: current
- **Opus view (FSC-034):**
  - Method: points if scoring_type contains 'point' else categories. Label and id must agree. Points: weight = stat_modifier value (missing -> unsupported). Categories: weight 1 for every scored category; display-only skipped.
  - Inputs/units: Yahoo modifiers (points per stat); sources: Yahoo Fantasy API league settings
  - Output scale: weights; writes: user league settings when applied
  - Status: live
  - Consumers: Start Chart starter board; RSO planning rules; live draft
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: Yahoo H2H categories (equal weight per category)
  - Fixtures/test data: none listed
  - Tests: `web/lib/integrations/yahoo/rosterPlanning.test.ts`; `web/lib/integrations/yahoo/yahooDiet.test.ts`
- **Leads (not audited):**
  - (opus) Category direction (lower-is-better GAA/GA) not taken from Yahoo sort_order; relies on FHFH isInvertedCategory list

## M-FSC-049 Date-range grid counts (off-nights, back-to-backs, home/away)

- **Match:** Opus only; Opus FSC-035; Codex —
- **Purpose:** Per-team counts across an arbitrary date range.
- **Where:** `web/components/GameGrid/DateRangeTeamGrid.tsx:50 (computeBackToBacks)`; `web/components/GameGrid/DateRangeTeamGrid.tsx:123-145`; `web/components/GameGrid/utils/useDateRangeTeamGrid.ts:23-24,114-118`
- **Tags (heuristic):** generation: current
- **Opus view (FSC-035):**
  - Method: Off-night = regular game on a date with <=8 regular games; heavy night >=9. B2B = consecutive dates both with a game. Home/away counts.
  - Inputs/units: games; sources: NHL schedule
  - Output scale: counts; writes: —
  - Status: live — pages/game-grid/dateRange.tsx
  - Consumers: /game-grid/dateRange page
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/components/GameGrid/SortableHeaders.test.tsx`
- **Leads (not audited):**
  - (opus) computeBackToBacks counts any game type (not only gameType 2) unlike off-night count

## M-FSC-050 League daily totals row (calcTotalGP / calcTotalOffNights)

- **Match:** Opus only; Opus FSC-037; Codex —
- **Purpose:** Week total league games and number of off-night days for the header row.
- **Where:** `web/components/GameGrid/TotalGamesPerDayRow.tsx:90 (calcTotalGP)`; `web/components/GameGrid/TotalGamesPerDayRow.tsx:113 (calcTotalOffNights)`; `web/components/GameGrid/TotalGamesPerDayRow.tsx:17 (colour band)`
- **Tags (heuristic):** generation: current
- **Opus view (FSC-037):**
  - Method: Sum included days' game counts; count included days with <=8 games. Colour tiers by daily count (<=8 'medium-high').
  - Inputs/units: games; sources: NHL schedule
  - Output scale: counts; writes: —
  - Status: live — /game-grid
  - Consumers: Game Grid header row
- **Audit context:**
  - Intent (Opus): web/components/GameGrid/TotalGamesPerDayRow.tsx:84-111 docstrings
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/components/GameGrid/utils/scheduleSummary.test.ts`
- **Leads (not audited):**
  - (opus) Name collision: a second calcTotalOffNights with different semantics (league days vs team games) than helper.ts:39

## M-FSC-051 Opponent category effect sign map

- **Match:** Opus only; Opus FSC-045; Codex —
- **Purpose:** Declares which opponent metrics are favourable (asc/desc) per fantasy category and role; colours only agreeing signs.
- **Where:** `web/components/GameGrid/utils/opponentCategoryEffects.ts:30 (OPPONENT_CATEGORY_EFFECTS)`; `web/components/GameGrid/utils/opponentCategoryEffects.ts:60 (getOpponentViewDirections)`; `web/components/GameGrid/utils/opponentCategoryEffects.ts:85 (findDoubleCountedEffects)`; `web/components/GameGrid/utils/opponentCategoryEffects.ts:93 (assessOpponentFactor)`
- **Tags (heuristic):** generation: legacy, current
- **Opus view (FSC-045):**
  - Method: Static sign table (e.g., skater G: high opp xGA/GA favourable, low opp xGF/GF/SF/PTS% favourable; BLK: high opp SF). Metric coloured only when all categories in view agree. findDoubleCountedEffects/assessOpponentFactor are guards.
  - Inputs/units: —; sources: —
  - Output scale: asc/desc/null; writes: —
  - Status: live — getOpponentViewDirections; guards legacy/dead (tests only)
  - Consumers: DesktopMasterTable.tsx:492; OpponentMetricsTable.tsx:59
- **Audit context:**
  - Intent (Opus): web/components/GameGrid/utils/opponentCategoryEffects.ts:24-29, :72-75
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/components/GameGrid/utils/opponentCategoryEffects.test.ts`
- **Leads (not audited):**
  - (opus) findDoubleCountedEffects and assessOpponentFactor have no production callers (contract-only)
  - (opus) Treats low opponent PTS% as favourable for scoring; correlation, not a category factor (acknowledged)

## M-FSC-052 Four-week per-week Week Score

- **Match:** Opus only; Opus FSC-052; Codex —
- **Purpose:** Week Score for each of four upcoming weeks.
- **Where:** `web/components/GameGrid/utils/useFourWeekSchedule.ts:146 (getTeamScheduleSummary call)`; `web/components/GameGrid/utils/useFourWeekSchedule.ts:109-111 (includeOdds:false)`
- **Tags (heuristic):** generation: current
- **Opus view (FSC-052):**
  - Method: Same calcWeekScore but schedules fetched with includeOdds:false and no coveredDays argument, so matchup=0 and crowding=0: effectively 6*(GP-avg)+4*ON.
  - Inputs/units: games; sources: NHL schedule (no odds)
  - Output scale: same as weekScore; writes: —
  - Status: live — /game-grid four-week view
  - Consumers: Four-week grid views
- **Audit context:**
  - Intent (Opus): web/components/GameGrid/utils/useFourWeekSchedule.ts:108 ('Opportunity needs fixtures, not the additional win-odds database lookup')
  - External references: none suggested
  - Fixtures/test data: `web/e2e/fixtures/opponent-four-week-metrics/App.tsx`
  - Tests: `web/components/GameGrid/utils/scheduleSummary.test.ts`
- **Leads (not audited):**
  - (opus) Silent definition drift: the same 'Week Score' label omits two terms in the four-week path

## M-FSC-053 Opponent metric averages (xGF, xGA, GF, GA, SF, SA, PTS%)

- **Match:** Opus only; Opus FSC-053; Codex —
- **Purpose:** Per-game opponent strength averaged over a team's scheduled opponents.
- **Where:** `web/components/GameGrid/utils/useOpponentMetricsData.ts:77 (computeOpponentMetrics)`; `web/components/GameGrid/utils/useOpponentMetricsData.ts:111 (computeLeagueAverages)`; `web/components/GameGrid/utils/useOpponentMetricsData.ts:143 (loadCurrentSeasonStats)`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: per game; generation: current
- **Opus view (FSC-053):**
  - Method: perGame = value/gp; PTS% = points/(2*gp). Mean over opponents (repeats counted per game), null unless all opponents known. League average = mean over teams with values.
  - Inputs/units: season totals and GP; sources: nst_team_stats (season, situation='all')
  - Output scale: per-game rates; point pct 0-1; writes: —
  - Status: live — /game-grid opponent table
  - Consumers: OpponentMetricsTable; DesktopMasterTable; buildOpponentRatings
- **Audit context:**
  - Intent (Opus): web/components/GameGrid/utils/useOpponentMetricsData.ts:52, :105
  - External references: NST team stats per-game convention; standings point% = points/(2*GP)
  - Fixtures/test data: `web/__tests__/fixtures/nst`
  - Tests: `web/components/GameGrid/OpponentMetricsTable.test.tsx`; `web/components/GameGrid/utils/useOpponentMetricsData.test.ts`
- **Leads (not audited):**
  - (opus) All-situations totals, not 5v5 or score/venue adjusted
  - (opus) Field name avgWinPct actually holds point pct
  - (opus) No strength-of-schedule recursion; current-season only with no regression early in season

