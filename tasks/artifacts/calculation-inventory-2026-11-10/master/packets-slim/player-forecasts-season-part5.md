# Audit packet: Player forecasts (season) (part 5 of 5)

Master entries M-PFC-241 to M-PFC-264 (24 of 264 in this family).

Slim copy (Chef, 2026-11-11): boilerplate status lines, generic leads, tags and duplicate locations removed. Full packet: `../packets/player-forecasts-season-part5.md`. Leads are hypotheses; line numbers date from 2026-11-10, so re-locate by symbol.

| ID | Name | Match | Conflicts | Leads |
|---|---|---|---:|---:|
| M-PFC-241 | TEAM_HIGH_DANGER_SHOTS_AGAINST forecast | Codex only | 0 | 1 |
| M-PFC-242 | TEAM_HIGH_DANGER_SHOTS_FOR forecast | Codex only | 0 | 1 |
| M-PFC-243 | TEAM_PACE forecast | Codex only | 0 | 1 |
| M-PFC-244 | TEAM_SHOT_ATTEMPTS_AGAINST forecast | Codex only | 0 | 1 |
| M-PFC-245 | TEAM_SHOT_ATTEMPTS_FOR forecast | Codex only | 0 | 1 |
| M-PFC-246 | TEAM_UNBLOCKED_ATTEMPTS_AGAINST forecast | Codex only | 0 | 1 |
| M-PFC-247 | TEAM_UNBLOCKED_ATTEMPTS_FOR forecast | Codex only | 0 | 1 |
| M-PFC-248 | Fantasy projection total (fantasyProjectionTotal) | Codex only | 0 | 1 |
| M-PFC-249 | Reconcile projection quantiles (reconcileProjectionQuantiles) | Codex only | 0 | 1 |
| M-PFC-250 | Reconcile projection values (reconcileProjectionValues) | Codex only | 0 | 1 |
| M-PFC-251 | Season game component aggregation (aggregateSeasonGames) | Codex only | 0 | 1 |
| M-PFC-252 | Advanced season correlated quantiles (correlatedAggregateQuantiles) | Codex only | 0 | 1 |
| M-PFC-253 | Portable season per-game evaluation (evaluatePortableSeasonGame) | Codex only | 0 | 1 |
| M-PFC-254 | Build runtime newcomer prior (buildRuntimeNewcomerPrior) | Codex only | 0 | 1 |
| M-PFC-255 | Runtime newcomer deployment (runtimeNewcomerDeployment) | Codex only | 0 | 1 |
| M-PFC-256 | Team deployment (teamDeployment) | Codex only | 0 | 1 |
| M-PFC-257 | Allocate editor total adjustment (allocateSeasonTotalAdjustment) | Codex only | 0 | 1 |
| M-PFC-258 | Score season primitive (scoreSeasonPrimitive) | Codex only | 0 | 1 |
| M-PFC-259 | Season forecast skill index (seasonSkillIndex) | Codex only | 0 | 1 |
| M-PFC-260 | Explicit game-set mean aggregation (aggregatePlayerGameMeans) | Codex only | 0 | 1 |
| M-PFC-261 | Goalie ratio-of-expectations statistics (goalieRatioOfExpectations) | Codex only | 0 | 1 |
| M-PFC-262 | Eligible-opportunity goalie appearance frequency (buildGoalieParticip… | Codex only | 0 | 1 |
| M-PFC-263 | Eligible-opportunity official starter frequency (buildGoalieStartKern… | Codex only | 0 | 1 |
| M-PFC-264 | Build roster observation goalie start receipt (buildRosterObservation… | Codex only | 0 | 1 |

## M-PFC-241 TEAM_HIGH_DANGER_SHOTS_AGAINST forecast

- **Match:** Codex only; Opus —; Codex season-head-team_advanced_v5_targets-team_high_danger_shots_against
- **Purpose:** Named in-house forecast head. Per-game conditional rate from fitted portable artifact, context-adjusted and participation-integrated by evaluator; aggregates sum game means. GAMES_PLAYED and GAMES_STARTED use conditional value 1 with play/start probability.
- **Where:** `web/lib/fantasy-projections/contracts.ts:136 TEAM_ADVANCED_V5_TARGETS`
- **Codex view (season-head-team_advanced_v5_targets-team_high_danger_shots_against, calculation; Codex family 'Season forecast primitive: team'):** TEAM_HIGH_DANGER_SHOTS_AGAINST forecast
  - Purpose: Named in-house forecast head. Per-game conditional rate from fitted portable artifact, context-adjusted and participation-integrated by evaluator; aggregates sum game means. GAMES_PLAYED and GAMES_STARTED use conditional value 1 with play/start probability.
  - Inputs/units: Fitted conditional rate/variance; player participation; team/opponent/venue/rest context. Input units: expected count.
  - Output scale: Per-game / season / ROS mean in expected count; associated variance and quantiles.
  - Consumers: ["web/lib/fantasy-projections/evaluator.ts", "modeling/player_forecasts/season.py", "modeling/player_forecasts/advanced.py"]
- **Audit context:**
  - Intended contract (Codex season-head-team_advanced_v5_targets-team_high_danger_shots_against): {"source": "web/lib/fantasy-projections/contracts.ts:136", "target_array": "TEAM_ADVANCED_V5_TARGETS", "implementation": "web/lib/fantasy-projections/evaluator.ts:394 evaluatePortableSeasonGame; :605 aggregateSeasonGames", "status": "Declared supported target, not proof of a loaded artifact or live coverage."}
  - Tests: `{"status": "Discovered; not run", "references": ["web/lib/fantasy-projections/fantasyProjections.test.ts", "modeling/player_forecasts/tests/test_harness.py"]}`
- **Leads (not audited):**
  - (codex:season-head-team_advanced_v5_targets-team_high_danger_shots_against) ["Deployment and runtime behavior not verified; calculation listed without correctness assessment."]

## M-PFC-242 TEAM_HIGH_DANGER_SHOTS_FOR forecast

- **Match:** Codex only; Opus —; Codex season-head-team_advanced_v5_targets-team_high_danger_shots_for
- **Purpose:** Named in-house forecast head. Per-game conditional rate from fitted portable artifact, context-adjusted and participation-integrated by evaluator; aggregates sum game means. GAMES_PLAYED and GAMES_STARTED use conditional value 1 with play/start probability.
- **Where:** `web/lib/fantasy-projections/contracts.ts:135 TEAM_ADVANCED_V5_TARGETS`
- **Codex view (season-head-team_advanced_v5_targets-team_high_danger_shots_for, calculation; Codex family 'Season forecast primitive: team'):** TEAM_HIGH_DANGER_SHOTS_FOR forecast
  - Purpose: Named in-house forecast head. Per-game conditional rate from fitted portable artifact, context-adjusted and participation-integrated by evaluator; aggregates sum game means. GAMES_PLAYED and GAMES_STARTED use conditional value 1 with play/start probability.
  - Inputs/units: Fitted conditional rate/variance; player participation; team/opponent/venue/rest context. Input units: expected count.
  - Output scale: Per-game / season / ROS mean in expected count; associated variance and quantiles.
  - Consumers: ["web/lib/fantasy-projections/evaluator.ts", "modeling/player_forecasts/season.py", "modeling/player_forecasts/advanced.py"]
- **Audit context:**
  - Intended contract (Codex season-head-team_advanced_v5_targets-team_high_danger_shots_for): {"source": "web/lib/fantasy-projections/contracts.ts:135", "target_array": "TEAM_ADVANCED_V5_TARGETS", "implementation": "web/lib/fantasy-projections/evaluator.ts:394 evaluatePortableSeasonGame; :605 aggregateSeasonGames", "status": "Declared supported target, not proof of a loaded artifact or live coverage."}
  - Tests: `{"status": "Discovered; not run", "references": ["web/lib/fantasy-projections/fantasyProjections.test.ts", "modeling/player_forecasts/tests/test_harness.py"]}`
- **Leads (not audited):**
  - (codex:season-head-team_advanced_v5_targets-team_high_danger_shots_for) ["Deployment and runtime behavior not verified; calculation listed without correctness assessment."]

## M-PFC-243 TEAM_PACE forecast

- **Match:** Codex only; Opus —; Codex season-head-team_advanced_v5_targets-team_pace
- **Purpose:** Named in-house forecast head. Per-game conditional rate from fitted portable artifact, context-adjusted and participation-integrated by evaluator; aggregates sum game means. GAMES_PLAYED and GAMES_STARTED use conditional value 1 with play/start probability.
- **Where:** `web/lib/fantasy-projections/contracts.ts:137 TEAM_ADVANCED_V5_TARGETS`
- **Codex view (season-head-team_advanced_v5_targets-team_pace, calculation; Codex family 'Season forecast primitive: team'):** TEAM_PACE forecast
  - Purpose: Named in-house forecast head. Per-game conditional rate from fitted portable artifact, context-adjusted and participation-integrated by evaluator; aggregates sum game means. GAMES_PLAYED and GAMES_STARTED use conditional value 1 with play/start probability.
  - Inputs/units: Fitted conditional rate/variance; player participation; team/opponent/venue/rest context. Input units: team-pace measure; exact unit follows advanced rate policy, not separately resolved here.
  - Output scale: Per-game / season / ROS mean in team-pace measure; exact unit follows advanced rate policy, not separately resolved here; associated variance and quantiles.
  - Consumers: ["web/lib/fantasy-projections/evaluator.ts", "modeling/player_forecasts/season.py", "modeling/player_forecasts/advanced.py"]
- **Audit context:**
  - Intended contract (Codex season-head-team_advanced_v5_targets-team_pace): {"source": "web/lib/fantasy-projections/contracts.ts:137", "target_array": "TEAM_ADVANCED_V5_TARGETS", "implementation": "web/lib/fantasy-projections/evaluator.ts:394 evaluatePortableSeasonGame; :605 aggregateSeasonGames", "status": "Declared supported target, not proof of a loaded artifact or live coverage."}
  - Tests: `{"status": "Discovered; not run", "references": ["web/lib/fantasy-projections/fantasyProjections.test.ts", "modeling/player_forecasts/tests/test_harness.py"]}`
- **Leads (not audited):**
  - (codex:season-head-team_advanced_v5_targets-team_pace) ["Deployment and runtime behavior not verified; calculation listed without correctness assessment."]

## M-PFC-244 TEAM_SHOT_ATTEMPTS_AGAINST forecast

- **Match:** Codex only; Opus —; Codex season-head-team_advanced_v5_targets-team_shot_attempts_against
- **Purpose:** Named in-house forecast head. Per-game conditional rate from fitted portable artifact, context-adjusted and participation-integrated by evaluator; aggregates sum game means. GAMES_PLAYED and GAMES_STARTED use conditional value 1 with play/start probability.
- **Where:** `web/lib/fantasy-projections/contracts.ts:130 TEAM_ADVANCED_V5_TARGETS`
- **Codex view (season-head-team_advanced_v5_targets-team_shot_attempts_against, calculation; Codex family 'Season forecast primitive: team'):** TEAM_SHOT_ATTEMPTS_AGAINST forecast
  - Purpose: Named in-house forecast head. Per-game conditional rate from fitted portable artifact, context-adjusted and participation-integrated by evaluator; aggregates sum game means. GAMES_PLAYED and GAMES_STARTED use conditional value 1 with play/start probability.
  - Inputs/units: Fitted conditional rate/variance; player participation; team/opponent/venue/rest context. Input units: expected count.
  - Output scale: Per-game / season / ROS mean in expected count; associated variance and quantiles.
  - Consumers: ["web/lib/fantasy-projections/evaluator.ts", "modeling/player_forecasts/season.py", "modeling/player_forecasts/advanced.py"]
- **Audit context:**
  - Intended contract (Codex season-head-team_advanced_v5_targets-team_shot_attempts_against): {"source": "web/lib/fantasy-projections/contracts.ts:130", "target_array": "TEAM_ADVANCED_V5_TARGETS", "implementation": "web/lib/fantasy-projections/evaluator.ts:394 evaluatePortableSeasonGame; :605 aggregateSeasonGames", "status": "Declared supported target, not proof of a loaded artifact or live coverage."}
  - Tests: `{"status": "Discovered; not run", "references": ["web/lib/fantasy-projections/fantasyProjections.test.ts", "modeling/player_forecasts/tests/test_harness.py"]}`
- **Leads (not audited):**
  - (codex:season-head-team_advanced_v5_targets-team_shot_attempts_against) ["Deployment and runtime behavior not verified; calculation listed without correctness assessment."]

## M-PFC-245 TEAM_SHOT_ATTEMPTS_FOR forecast

- **Match:** Codex only; Opus —; Codex season-head-team_advanced_v5_targets-team_shot_attempts_for
- **Purpose:** Named in-house forecast head. Per-game conditional rate from fitted portable artifact, context-adjusted and participation-integrated by evaluator; aggregates sum game means. GAMES_PLAYED and GAMES_STARTED use conditional value 1 with play/start probability.
- **Where:** `web/lib/fantasy-projections/contracts.ts:129 TEAM_ADVANCED_V5_TARGETS`
- **Codex view (season-head-team_advanced_v5_targets-team_shot_attempts_for, calculation; Codex family 'Season forecast primitive: team'):** TEAM_SHOT_ATTEMPTS_FOR forecast
  - Purpose: Named in-house forecast head. Per-game conditional rate from fitted portable artifact, context-adjusted and participation-integrated by evaluator; aggregates sum game means. GAMES_PLAYED and GAMES_STARTED use conditional value 1 with play/start probability.
  - Inputs/units: Fitted conditional rate/variance; player participation; team/opponent/venue/rest context. Input units: expected count.
  - Output scale: Per-game / season / ROS mean in expected count; associated variance and quantiles.
  - Consumers: ["web/lib/fantasy-projections/evaluator.ts", "modeling/player_forecasts/season.py", "modeling/player_forecasts/advanced.py"]
- **Audit context:**
  - Intended contract (Codex season-head-team_advanced_v5_targets-team_shot_attempts_for): {"source": "web/lib/fantasy-projections/contracts.ts:129", "target_array": "TEAM_ADVANCED_V5_TARGETS", "implementation": "web/lib/fantasy-projections/evaluator.ts:394 evaluatePortableSeasonGame; :605 aggregateSeasonGames", "status": "Declared supported target, not proof of a loaded artifact or live coverage."}
  - Tests: `{"status": "Discovered; not run", "references": ["web/lib/fantasy-projections/fantasyProjections.test.ts", "modeling/player_forecasts/tests/test_harness.py"]}`
- **Leads (not audited):**
  - (codex:season-head-team_advanced_v5_targets-team_shot_attempts_for) ["Deployment and runtime behavior not verified; calculation listed without correctness assessment."]

## M-PFC-246 TEAM_UNBLOCKED_ATTEMPTS_AGAINST forecast

- **Match:** Codex only; Opus —; Codex season-head-team_advanced_v5_targets-team_unblocked_attempts_against
- **Purpose:** Named in-house forecast head. Per-game conditional rate from fitted portable artifact, context-adjusted and participation-integrated by evaluator; aggregates sum game means. GAMES_PLAYED and GAMES_STARTED use conditional value 1 with play/start probability.
- **Where:** `web/lib/fantasy-projections/contracts.ts:132 TEAM_ADVANCED_V5_TARGETS`
- **Codex view (season-head-team_advanced_v5_targets-team_unblocked_attempts_against, calculation; Codex family 'Season forecast primitive: team'):** TEAM_UNBLOCKED_ATTEMPTS_AGAINST forecast
  - Purpose: Named in-house forecast head. Per-game conditional rate from fitted portable artifact, context-adjusted and participation-integrated by evaluator; aggregates sum game means. GAMES_PLAYED and GAMES_STARTED use conditional value 1 with play/start probability.
  - Inputs/units: Fitted conditional rate/variance; player participation; team/opponent/venue/rest context. Input units: expected count.
  - Output scale: Per-game / season / ROS mean in expected count; associated variance and quantiles.
  - Consumers: ["web/lib/fantasy-projections/evaluator.ts", "modeling/player_forecasts/season.py", "modeling/player_forecasts/advanced.py"]
- **Audit context:**
  - Intended contract (Codex season-head-team_advanced_v5_targets-team_unblocked_attempts_against): {"source": "web/lib/fantasy-projections/contracts.ts:132", "target_array": "TEAM_ADVANCED_V5_TARGETS", "implementation": "web/lib/fantasy-projections/evaluator.ts:394 evaluatePortableSeasonGame; :605 aggregateSeasonGames", "status": "Declared supported target, not proof of a loaded artifact or live coverage."}
  - Tests: `{"status": "Discovered; not run", "references": ["web/lib/fantasy-projections/fantasyProjections.test.ts", "modeling/player_forecasts/tests/test_harness.py"]}`
- **Leads (not audited):**
  - (codex:season-head-team_advanced_v5_targets-team_unblocked_attempts_against) ["Deployment and runtime behavior not verified; calculation listed without correctness assessment."]

## M-PFC-247 TEAM_UNBLOCKED_ATTEMPTS_FOR forecast

- **Match:** Codex only; Opus —; Codex season-head-team_advanced_v5_targets-team_unblocked_attempts_for
- **Purpose:** Named in-house forecast head. Per-game conditional rate from fitted portable artifact, context-adjusted and participation-integrated by evaluator; aggregates sum game means. GAMES_PLAYED and GAMES_STARTED use conditional value 1 with play/start probability.
- **Where:** `web/lib/fantasy-projections/contracts.ts:131 TEAM_ADVANCED_V5_TARGETS`
- **Codex view (season-head-team_advanced_v5_targets-team_unblocked_attempts_for, calculation; Codex family 'Season forecast primitive: team'):** TEAM_UNBLOCKED_ATTEMPTS_FOR forecast
  - Purpose: Named in-house forecast head. Per-game conditional rate from fitted portable artifact, context-adjusted and participation-integrated by evaluator; aggregates sum game means. GAMES_PLAYED and GAMES_STARTED use conditional value 1 with play/start probability.
  - Inputs/units: Fitted conditional rate/variance; player participation; team/opponent/venue/rest context. Input units: expected count.
  - Output scale: Per-game / season / ROS mean in expected count; associated variance and quantiles.
  - Consumers: ["web/lib/fantasy-projections/evaluator.ts", "modeling/player_forecasts/season.py", "modeling/player_forecasts/advanced.py"]
- **Audit context:**
  - Intended contract (Codex season-head-team_advanced_v5_targets-team_unblocked_attempts_for): {"source": "web/lib/fantasy-projections/contracts.ts:131", "target_array": "TEAM_ADVANCED_V5_TARGETS", "implementation": "web/lib/fantasy-projections/evaluator.ts:394 evaluatePortableSeasonGame; :605 aggregateSeasonGames", "status": "Declared supported target, not proof of a loaded artifact or live coverage."}
  - Tests: `{"status": "Discovered; not run", "references": ["web/lib/fantasy-projections/fantasyProjections.test.ts", "modeling/player_forecasts/tests/test_harness.py"]}`
- **Leads (not audited):**
  - (codex:season-head-team_advanced_v5_targets-team_unblocked_attempts_for) ["Deployment and runtime behavior not verified; calculation listed without correctness assessment."]

## M-PFC-248 Fantasy projection total (fantasyProjectionTotal)

- **Match:** Codex only; Opus —; Codex web-lib-fantasy-projections-contracts-fantasyprojectiontotal
- **Purpose:** Fantasy projection total for portable season fantasy projections. Exact arithmetic locations are recorded below; no correctness judgment is made.
- **Where:** `web/lib/fantasy-projections/contracts.ts:799 fantasyProjectionTotal`
- **Codex view (web-lib-fantasy-projections-contracts-fantasyprojectiontotal, symbol_candidate; Codex family 'Portable season fantasy projections'):** Fantasy projection total (fantasyProjectionTotal)
  - Purpose: Fantasy projection total for portable season fantasy projections. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: export function fantasyProjectionTotal( values: ProjectionValues, scoring: Record<string, number>, ): number { return Object.entries(scoring).reduce((total, [key, weight]) => { const value = Number(values[key] ?? 0); return total + (Number.isFinite(value) && Number.isFinite(weight) ? v … (full text in the original packet)
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Consumers: ["web/pages/fantasy-projections.tsx:15"]
- **Audit context:**
  - Intended contract (Codex web-lib-fantasy-projections-contracts-fantasyprojectiontotal): {"source": "web/lib/fantasy-projections/contracts.ts:799", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["web/lib/fantasy-projections/contracts.ts:805 return total + (Number.isFinite(value) && Number.isFinite(weight) ? value * weight : 0);"]}
  - Tests: `{"status": "Discovered only; not run", "references": ["web/lib/fantasy-projections/fantasyProjections.test.ts:20"]}`
- **Leads (not audited):**
  - (codex:web-lib-fantasy-projections-contracts-fantasyprojectiontotal) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-PFC-249 Reconcile projection quantiles (reconcileProjectionQuantiles)

- **Match:** Codex only; Opus —; Codex web-lib-fantasy-projections-contracts-reconcileprojectionquantiles
- **Purpose:** Reconcile projection quantiles for portable season fantasy projections. Exact arithmetic locations are recorded below; no correctness judgment is made.
- **Where:** `web/lib/fantasy-projections/contracts.ts:628 reconcileProjectionQuantiles`
- **Codex view (web-lib-fantasy-projections-contracts-reconcileprojectionquantiles, symbol_candidate; Codex family 'Portable season fantasy projections'):** Reconcile projection quantiles (reconcileProjectionQuantiles)
  - Purpose: Reconcile projection quantiles for portable season fantasy projections. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: export function reconcileProjectionQuantiles( rawQuantiles: { p10: ProjectionValues; p50: ProjectionValues; p90: ProjectionValues }, population: FantasyProjectionPopulation, ): { p10: ProjectionValues; p50: ProjectionValues; p90: ProjectionValues } { const p10 = reconcileProjectionValu … (full text in the original packet)
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Consumers: ["web/lib/fantasy-projections/admin.ts:13", "web/lib/fantasy-projections/evaluator.ts:10", "web/lib/fantasy-projections/seasonJobs.ts:11"]
- **Audit context:**
  - Intended contract (Codex web-lib-fantasy-projections-contracts-reconcileprojectionquantiles): {"source": "web/lib/fantasy-projections/contracts.ts:628", "explicit_comment": "web/lib/fantasy-projections/contracts.ts:777 NHL regular-season games cannot exceed 65 minutes, including overtime.", "arithmetic_locations": ["web/lib/fantasy-projections/contracts.ts:636 denominator > 0 ? numerator / denominator : fallback;", "web/lib/fantasy-projections/contracts.ts:712 ratio(3600 * (p10.GOALS_AGAINST_GOALIE ?? 0), p90.TOTAL_TOI ?? 0, 0),", "web/lib/fantasy-projections/contracts.ts:713 ratio(3600 * (p50.GOALS_AGAINST_GOALIE ?? 0), p50.TOTAL_TOI ?? 0, 0),", "web/lib/fantasy-projections/contracts.ts:715 3600 * (p90.GOALS_AGAINST_GOALIE ?? 0),", "web/lib/fantasy-projections/contracts.ts:780 ratioInterval(\"TOI_PER_GAME\", \"TOTAL_TOI\", \"GAMES_PLAYED\", 65 * 60);"]}
  - Tests: `{"status": "Discovered only; not run", "references": ["web/lib/fantasy-projections/fantasyProjections.test.ts:21"]}`
- **Leads (not audited):**
  - (codex:web-lib-fantasy-projections-contracts-reconcileprojectionquantiles) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-PFC-250 Reconcile projection values (reconcileProjectionValues)

- **Match:** Codex only; Opus —; Codex web-lib-fantasy-projections-contracts-reconcileprojectionvalues
- **Possible related records (low-confidence location link, unconfirmed):** PFC-092
- **Purpose:** Reconcile projection values for portable season fantasy projections. Exact arithmetic locations are recorded below; no correctness judgment is made.
- **Where:** `web/lib/fantasy-projections/contracts.ts:457 reconcileProjectionValues`
- **Codex view (web-lib-fantasy-projections-contracts-reconcileprojectionvalues, symbol_candidate; Codex family 'Portable season fantasy projections'):** Reconcile projection values (reconcileProjectionValues)
  - Purpose: Reconcile projection values for portable season fantasy projections. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: export function reconcileProjectionValues( rawValues: ProjectionValues, population: FantasyProjectionPopulation, ): ProjectionValues { const values = Object.fromEntries( Object.entries(rawValues).map(([key, value]) => [ key, Number.isFinite(value) ? Number(value) : 0, ]), ); if (popula … (full text in the original packet)
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Consumers: ["web/lib/fantasy-projections/admin.ts:14", "web/lib/fantasy-projections/evaluator.ts:11", "web/lib/fantasy-projections/seasonJobs.ts:12", "web/lib/fantasy-projections/validation.ts:8"]
- **Audit context:**
  - Intended contract (Codex web-lib-fantasy-projections-contracts-reconcileprojectionvalues): {"source": "web/lib/fantasy-projections/contracts.ts:457", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["web/lib/fantasy-projections/contracts.ts:475 ? projectionNumber(values.SAVES_GOALIE / values.SHOTS_AGAINST_GOALIE)", "web/lib/fantasy-projections/contracts.ts:480 (3600 * (values.GOALS_AGAINST_GOALIE ?? 0)) / values.TOTAL_TOI,", "web/lib/fantasy-projections/contracts.ts:489 ? projectionNumber((values.GAMES_STARTED ?? 0) / values.GAMES_PLAYED)", "web/lib/fantasy-projections/contracts.ts:493 ? projectionNumber((values.WINS_GOALIE ?? 0) / values.GAMES_STARTED)", "web/lib/fantasy-projections/contracts.ts:510 shots > 0 ? projectionNumber(saves / shots) : 0;", "web/lib/fantasy-projections/contracts.ts:541 const scale = authoritativeTotal / nonEvTotal;", "web/lib/fantasy-projections/contracts.ts:543 values[target] = projectionNumber(Math.max(0, values[target] ?? 0) * scale);", "web/lib/fantasy-projections/contracts.ts:592 ? projectionNumber((values.GOALS ?? 0) / values.SHOTS_ON_GOAL)"]}
  - Tests: `{"status": "Discovered only; not run", "references": ["web/lib/fantasy-projections/fantasyProjections.test.ts:22"]}`
- **Leads (not audited):**
  - (codex:web-lib-fantasy-projections-contracts-reconcileprojectionvalues) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-PFC-251 Season game component aggregation (aggregateSeasonGames)

- **Match:** Codex only; Opus —; Codex web-lib-fantasy-projections-evaluator-aggregateseasongames
- **Purpose:** Sum unconditional means and variances; recompute derived ratios; advanced-contract correlated draws else normal approximation.
- **Where:** `web/lib/fantasy-projections/evaluator.ts:605 aggregateSeasonGames`
- **Codex view (web-lib-fantasy-projections-evaluator-aggregateseasongames, calculation; Codex family 'Portable season fantasy projections'):** Season game component aggregation (aggregateSeasonGames)
  - Purpose: Sum unconditional means and variances; recompute derived ratios; advanced-contract correlated draws else normal approximation.
  - Inputs/units: Named model/observation inputs at cited declaration; Season/ROS means, variance and quantiles with component hashes. Input count/rate units follow the corresponding named outcome; cutoff timestamps and identity are required where declared.
  - Output scale: Season/ROS means, variance and quantiles with component hashes.
  - Consumers: ["web/lib/fantasy-projections/seasonJobs.ts:19"]
- **Audit context:**
  - Intended contract (Codex web-lib-fantasy-projections-evaluator-aggregateseasongames): {"source": "web/lib/fantasy-projections/evaluator.ts:605", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": []}
  - Tests: `{"status": "Discovered only; not run", "references": ["web/lib/fantasy-projections/fantasyProjections.test.ts:5"]}`
- **Leads (not audited):**
  - (codex:web-lib-fantasy-projections-evaluator-aggregateseasongames) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested."]

## M-PFC-252 Advanced season correlated quantiles (correlatedAggregateQuantiles)

- **Match:** Codex only; Opus —; Codex web-lib-fantasy-projections-evaluator-correlatedaggregatequantiles
- **Purpose:** 256 seeded normal draws with shared-factor loading .65 and sqrt(1-.65²) independent loading; reconcile physical constraints then empirical quantiles.
- **Where:** `web/lib/fantasy-projections/evaluator.ts:532 correlatedAggregateQuantiles`
- **Codex view (web-lib-fantasy-projections-evaluator-correlatedaggregatequantiles, calculation; Codex family 'Portable season fantasy projections'):** Advanced season correlated quantiles (correlatedAggregateQuantiles)
  - Purpose: 256 seeded normal draws with shared-factor loading .65 and sqrt(1-.65²) independent loading; reconcile physical constraints then empirical quantiles.
  - Inputs/units: Named model/observation inputs at cited declaration; p10/p50/p90 season target values. Input count/rate units follow the corresponding named outcome; cutoff timestamps and identity are required where declared.
  - Output scale: p10/p50/p90 season target values.
  - Consumers: ["No external static symbol reference found in bounded source search; may be module-internal or indirect."]
- **Audit context:**
  - Intended contract (Codex web-lib-fantasy-projections-evaluator-correlatedaggregatequantiles): {"source": "web/lib/fantasy-projections/evaluator.ts:532", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["web/lib/fantasy-projections/evaluator.ts:543 const first = (state + 0.5) / 4_294_967_296;", "web/lib/fantasy-projections/evaluator.ts:545 const second = (state + 0.5) / 4_294_967_296;", "web/lib/fantasy-projections/evaluator.ts:546 return Math.sqrt(-2 * Math.log(first)) * Math.cos(2 * Math.PI * second);", "web/lib/fantasy-projections/evaluator.ts:551 const independentWeight = Math.sqrt(1 - correlation * correlation);", "web/lib/fantasy-projections/evaluator.ts:556 const deviation = correlation * common + independentWeight * normal();", "web/lib/fantasy-projections/evaluator.ts:557 const value = (means[target] ?? 0) + Math.sqrt(Math.max(0, variances[target] ?? 0)) * deviation;"]}
  - Tests: `{"status": "Discovered only; not run", "references": ["No direct symbol/module test reference found in bounded search."]}`
- **Leads (not audited):**
  - (codex:web-lib-fantasy-projections-evaluator-correlatedaggregatequantiles) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested."]

## M-PFC-253 Portable season per-game evaluation (evaluatePortableSeasonGame)

- **Match:** Codex only; Opus —; Codex web-lib-fantasy-projections-evaluator-evaluateportableseasongame
- **Purpose:** Conditional rate × context multiplier; unconditional=p×conditional; mixture variance=pσ²+p(1-p)μ²; derived heads reconciled.
- **Where:** `web/lib/fantasy-projections/evaluator.ts:394 evaluatePortableSeasonGame`
- **Codex view (web-lib-fantasy-projections-evaluator-evaluateportableseasongame, calculation; Codex family 'Portable season fantasy projections'):** Portable season per-game evaluation (evaluatePortableSeasonGame)
  - Purpose: Conditional rate × context multiplier; unconditional=p×conditional; mixture variance=pσ²+p(1-p)μ²; derived heads reconciled.
  - Inputs/units: Named model/observation inputs at cited declaration; Conditional/unconditional primitive/derived means, variance, p10/p50/p90, play/start probability. Input count/rate units follow the corresponding named outcome; cutoff timestamps and identity are required where declared.
  - Output scale: Conditional/unconditional primitive/derived means, variance, p10/p50/p90, play/start probability.
  - Consumers: ["web/lib/fantasy-projections/seasonJobs.ts:22", "web/lib/player-forecasts/seasonGameContributions.ts:1"]
- **Audit context:**
  - Intended contract (Codex web-lib-fantasy-projections-evaluator-evaluateportableseasongame): {"source": "web/lib/fantasy-projections/evaluator.ts:394", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["web/lib/fantasy-projections/evaluator.ts:460 unconditionalMeans[target] = round(conditional * mixtureProbability);", "web/lib/fantasy-projections/evaluator.ts:474 baselineConditional * baselineProbability,", "web/lib/fantasy-projections/evaluator.ts:477 mixtureProbability * conditionalVariance +", "web/lib/fantasy-projections/evaluator.ts:478 mixtureProbability * (1 - mixtureProbability) * conditional * conditional,"]}
  - Tests: `{"status": "Discovered only; not run", "references": ["web/lib/fantasy-projections/fantasyProjections.test.ts:6"]}`
- **Leads (not audited):**
  - (codex:web-lib-fantasy-projections-evaluator-evaluateportableseasongame) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested."]

## M-PFC-254 Build runtime newcomer prior (buildRuntimeNewcomerPrior)

- **Match:** Codex only; Opus —; Codex web-lib-fantasy-projections-seasonjobs-buildruntimenewcomerprior
- **Purpose:** Build runtime newcomer prior for portable season fantasy projections. Exact arithmetic locations are recorded below; no correctness judgment is made.
- **Where:** `web/lib/fantasy-projections/seasonJobs.ts:158 buildRuntimeNewcomerPrior`
- **Codex view (web-lib-fantasy-projections-seasonjobs-buildruntimenewcomerprior, symbol_candidate; Codex family 'Portable season fantasy projections'):** Build runtime newcomer prior (buildRuntimeNewcomerPrior)
  - Purpose: Build runtime newcomer prior for portable season fantasy projections. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: export function buildRuntimeNewcomerPrior(args: { artifact: PortableSeasonArtifact; fhfhPlayerId: number; nhlPlayerId?: number \| null; playerName: string; position: "C" \| "L" \| "R" \| "D" \| "G"; teamId: number \| null; poolStatus: string; rosterStatus: string; rosterConfidence: num … (full text in the original packet)
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Consumers: ["No external static symbol reference found in bounded source search; may be module-internal or indirect."]
- **Audit context:**
  - Intended contract (Codex web-lib-fantasy-projections-seasonjobs-buildruntimenewcomerprior): {"source": "web/lib/fantasy-projections/seasonJobs.ts:158", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["web/lib/fantasy-projections/seasonJobs.ts:223 ) * 2.25,"]}
  - Tests: `{"status": "Discovered only; not run", "references": ["web/lib/fantasy-projections/fantasyProjections.test.ts:45"]}`
- **Leads (not audited):**
  - (codex:web-lib-fantasy-projections-seasonjobs-buildruntimenewcomerprior) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-PFC-255 Runtime newcomer deployment (runtimeNewcomerDeployment)

- **Match:** Codex only; Opus —; Codex web-lib-fantasy-projections-seasonjobs-runtimenewcomerdeployment
- **Purpose:** Runtime newcomer deployment for portable season fantasy projections. Exact arithmetic locations are recorded below; no correctness judgment is made.
- **Where:** `web/lib/fantasy-projections/seasonJobs.ts:109 runtimeNewcomerDeployment`
- **Codex view (web-lib-fantasy-projections-seasonjobs-runtimenewcomerdeployment, symbol_candidate; Codex family 'Portable season fantasy projections'):** Runtime newcomer deployment (runtimeNewcomerDeployment)
  - Purpose: Runtime newcomer deployment for portable season fantasy projections. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: function runtimeNewcomerDeployment( population: FantasyProjectionPopulation, rates: ProjectionValues, ): Record<string, unknown> { const base = { confidence: 0, expectedEvToi: rates.EV_TOI ?? 0, expectedPpToi: rates.PP_TOI ?? 0, expectedPkToi: rates.PK_TOI ?? 0, expectedTotalToi: rates … (full text in the original packet)
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Consumers: ["No external static symbol reference found in bounded source search; may be module-internal or indirect."]
- **Audit context:**
  - Intended contract (Codex web-lib-fantasy-projections-seasonjobs-runtimenewcomerdeployment): {"source": "web/lib/fantasy-projections/seasonJobs.ts:109", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": []}
  - Tests: `{"status": "Discovered only; not run", "references": ["No direct symbol/module test reference found in bounded search."]}`
- **Leads (not audited):**
  - (codex:web-lib-fantasy-projections-seasonjobs-runtimenewcomerdeployment) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-PFC-256 Team deployment (teamDeployment)

- **Match:** Codex only; Opus —; Codex web-lib-fantasy-projections-seasonjobs-teamdeployment
- **Purpose:** Team deployment for portable season fantasy projections. Exact arithmetic locations are recorded below; no correctness judgment is made.
- **Where:** `web/lib/fantasy-projections/seasonJobs.ts:428 teamDeployment`
- **Codex view (web-lib-fantasy-projections-seasonjobs-teamdeployment, symbol_candidate; Codex family 'Portable season fantasy projections'):** Team deployment (teamDeployment)
  - Purpose: Team deployment for portable season fantasy projections. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: function teamDeployment(players: PortablePlayerPrior[]): Record<string, unknown> { const byToi = (population: FantasyProjectionPopulation) => players .filter((player) => player.population === population) .sort( (left, right) => Number(right.conditionalRates.TOTAL_TOI ?? 0) - Number(lef … (full text in the original packet)
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Consumers: ["No external static symbol reference found in bounded source search; may be module-internal or indirect."]
- **Audit context:**
  - Intended contract (Codex web-lib-fantasy-projections-seasonjobs-teamdeployment): {"source": "web/lib/fantasy-projections/seasonJobs.ts:428", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": []}
  - Tests: `{"status": "Discovered only; not run", "references": ["No direct symbol/module test reference found in bounded search."]}`
- **Leads (not audited):**
  - (codex:web-lib-fantasy-projections-seasonjobs-teamdeployment) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-PFC-257 Allocate editor total adjustment (allocateSeasonTotalAdjustment)

- **Match:** Codex only; Opus —; Codex web-lib-fantasy-projections-settlement-allocateseasontotaladjustment
- **Possible related records (low-confidence location link, unconfirmed):** FRG-057
- **Purpose:** Add adjustmentDelta × modelGame/remainingTotal, or equal share if near-zero remaining total.
- **Where:** `web/lib/fantasy-projections/settlement.ts:66 allocateSeasonTotalAdjustment`
- **Codex view (web-lib-fantasy-projections-settlement-allocateseasontotaladjustment, calculation; Codex family 'Portable season fantasy projections'):** Allocate editor total adjustment (allocateSeasonTotalAdjustment)
  - Purpose: Add adjustmentDelta × modelGame/remainingTotal, or equal share if near-zero remaining total.
  - Inputs/units: Named model/observation inputs at cited declaration; Adjusted per-game target mean. Input count/rate units follow the corresponding named outcome; cutoff timestamps and identity are required where declared.
  - Output scale: Adjusted per-game target mean.
  - Consumers: ["web/scripts/import-player-forecast-season-settlement.ts:25"]
- **Audit context:**
  - Intended contract (Codex web-lib-fantasy-projections-settlement-allocateseasontotaladjustment): {"source": "web/lib/fantasy-projections/settlement.ts:66", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["web/lib/fantasy-projections/settlement.ts:76 ? args.modelGameForecast / args.modelRemainingTotal", "web/lib/fantasy-projections/settlement.ts:77 : 1 / Math.max(1, args.remainingGames);", "web/lib/fantasy-projections/settlement.ts:78 return args.modelGameForecast + args.adjustmentDelta * share;"]}
  - Tests: `{"status": "Discovered only; not run", "references": ["web/lib/fantasy-projections/fantasyProjections.test.ts:27"]}`
- **Leads (not audited):**
  - (codex:web-lib-fantasy-projections-settlement-allocateseasontotaladjustment) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested."]

## M-PFC-258 Score season primitive (scoreSeasonPrimitive)

- **Match:** Codex only; Opus —; Codex web-lib-fantasy-projections-settlement-scoreseasonprimitive
- **Possible related records (low-confidence location link, unconfirmed):** FRG-057
- **Purpose:** Score season primitive for portable season fantasy projections. Exact arithmetic locations are recorded below; no correctness judgment is made.
- **Where:** `web/lib/fantasy-projections/settlement.ts:21 scoreSeasonPrimitive`
- **Codex view (web-lib-fantasy-projections-settlement-scoreseasonprimitive, symbol_candidate; Codex family 'Portable season fantasy projections'):** Score season primitive (scoreSeasonPrimitive)
  - Purpose: Score season primitive for portable season fantasy projections. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: export function scoreSeasonPrimitive(args: { actual: number; forecast: number; baselineForecast: number; p10?: number \| null; p90?: number \| null; probability?: boolean; }) { const error = args.forecast - args.actual; const baselineError = args.baselineForecast - args.actual; const a … (full text in the original packet)
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Consumers: ["web/scripts/import-player-forecast-season-settlement.ts:27"]
- **Audit context:**
  - Intended contract (Codex web-lib-fantasy-projections-settlement-scoreseasonprimitive): {"source": "web/lib/fantasy-projections/settlement.ts:21", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["web/lib/fantasy-projections/settlement.ts:37 squaredError: error * error,", "web/lib/fantasy-projections/settlement.ts:40 baselineSquaredError: baselineError * baselineError,", "web/lib/fantasy-projections/settlement.ts:46 result.brier = error * error;", "web/lib/fantasy-projections/settlement.ts:48 args.actual * Math.log(probability) +", "web/lib/fantasy-projections/settlement.ts:49 (1 - args.actual) * Math.log(1 - probability)", "web/lib/fantasy-projections/settlement.ts:51 result.baselineBrier = baselineError * baselineError;", "web/lib/fantasy-projections/settlement.ts:53 args.actual * Math.log(baselineProbability) +", "web/lib/fantasy-projections/settlement.ts:54 (1 - args.actual) * Math.log(1 - baselineProbability)"]}
  - Tests: `{"status": "Discovered only; not run", "references": ["web/lib/fantasy-projections/fantasyProjections.test.ts:28"]}`
- **Leads (not audited):**
  - (codex:web-lib-fantasy-projections-settlement-scoreseasonprimitive) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-PFC-259 Season forecast skill index (seasonSkillIndex)

- **Match:** Codex only; Opus —; Codex web-lib-fantasy-projections-settlement-seasonskillindex
- **Possible related records (low-confidence location link, unconfirmed):** FRG-057
- **Purpose:** clip(50+50*(baselineLoss-modelLoss)/max(baselineLoss,1e-9),0,100).
- **Where:** `web/lib/fantasy-projections/settlement.ts:13 seasonSkillIndex`
- **Codex view (web-lib-fantasy-projections-settlement-seasonskillindex, calculation; Codex family 'Portable season fantasy projections'):** Season forecast skill index (seasonSkillIndex)
  - Purpose: clip(50+50*(baselineLoss-modelLoss)/max(baselineLoss,1e-9),0,100).
  - Inputs/units: Named model/observation inputs at cited declaration; 0-100 index; parity=50. Input count/rate units follow the corresponding named outcome; cutoff timestamps and identity are required where declared.
  - Output scale: 0-100 index; parity=50.
  - Consumers: ["No external static symbol reference found in bounded source search; may be module-internal or indirect."]
- **Audit context:**
  - Intended contract (Codex web-lib-fantasy-projections-settlement-seasonskillindex): {"source": "web/lib/fantasy-projections/settlement.ts:13", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["web/lib/fantasy-projections/settlement.ts:17 Math.min(100, 50 + 50 * ((baselineLoss - modelLoss) / denominator)),"]}
  - Tests: `{"status": "Discovered only; not run", "references": ["No direct symbol/module test reference found in bounded search."]}`
- **Leads (not audited):**
  - (codex:web-lib-fantasy-projections-settlement-seasonskillindex) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested."]

## M-PFC-260 Explicit game-set mean aggregation (aggregatePlayerGameMeans)

- **Match:** Codex only; Opus —; Codex web-lib-player-forecasts-gamecontract-aggregateplayergamemeans
- **Purpose:** Sum selected same-vintage unconditional game means; any missing component head stays null; recompute goalie ratios from count sums.
- **Where:** `web/lib/player-forecasts/gameContract.ts:435 aggregatePlayerGameMeans`
- **Codex view (web-lib-player-forecasts-gamecontract-aggregateplayergamemeans, calculation; Codex family 'Native player forecasts and contribution serving'):** Explicit game-set mean aggregation (aggregatePlayerGameMeans)
  - Purpose: Sum selected same-vintage unconditional game means; any missing component head stays null; recompute goalie ratios from count sums.
  - Inputs/units: Named model/observation inputs at cited declaration; Unconditional game-sum counts/seconds and ratio-of-expectations. Input count/rate units follow the corresponding named outcome; cutoff timestamps and identity are required where declared.
  - Output scale: Unconditional game-sum counts/seconds and ratio-of-expectations.
  - Consumers: ["No external static symbol reference found in bounded source search; may be module-internal or indirect."]
- **Audit context:**
  - Intended contract (Codex web-lib-player-forecasts-gamecontract-aggregateplayergamemeans): {"source": "web/lib/player-forecasts/gameContract.ts:435", "explicit_comment": "Explicit ordered remaining games only. No actuals, independence assumption or ratio averaging.", "arithmetic_locations": []}
  - Tests: `{"status": "Discovered only; not run", "references": ["web/lib/player-forecasts/gameContract.test.ts:3"]}`
- **Leads (not audited):**
  - (codex:web-lib-player-forecasts-gamecontract-aggregateplayergamemeans) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested."]

## M-PFC-261 Goalie ratio-of-expectations statistics (goalieRatioOfExpectations)

- **Match:** Codex only; Opus —; Codex web-lib-player-forecasts-gamecontract-goalieratioofexpectations
- **Purpose:** SV%=E[SV]/E[SA]; GAA=60*E[GA]/E[minutes]; seconds converted to minutes.
- **Where:** `web/lib/player-forecasts/gameContract.ts:415 goalieRatioOfExpectations`
- **Codex view (web-lib-player-forecasts-gamecontract-goalieratioofexpectations, calculation; Codex family 'Native player forecasts and contribution serving'):** Goalie ratio-of-expectations statistics (goalieRatioOfExpectations)
  - Purpose: SV%=E[SV]/E[SA]; GAA=60*E[GA]/E[minutes]; seconds converted to minutes.
  - Inputs/units: Named model/observation inputs at cited declaration; Save fraction and goals/60 minutes or null; explicitly not E[realized ratio]. Input count/rate units follow the corresponding named outcome; cutoff timestamps and identity are required where declared.
  - Output scale: Save fraction and goals/60 minutes or null; explicitly not E[realized ratio].
  - Consumers: ["No external static symbol reference found in bounded source search; may be module-internal or indirect."]
- **Audit context:**
  - Intended contract (Codex web-lib-player-forecasts-gamecontract-goalieratioofexpectations): {"source": "web/lib/player-forecasts/gameContract.ts:415", "explicit_comment": "web/lib/player-forecasts/gameContract.ts:419 Scale before multiplying large counts; divide first if a tiny denominator overflows the scale.", "arithmetic_locations": ["web/lib/player-forecasts/gameContract.ts:420 const scale = multiplier / denominatorMean;", "web/lib/player-forecasts/gameContract.ts:421 value = Number.isFinite(scale) ? numeratorMean * scale : numeratorMean / denominatorMean * multiplier;", "web/lib/player-forecasts/gameContract.ts:428 goalieMinutesMean: means.TOTAL_TOI === null ? null : means.TOTAL_TOI / 60,", "web/lib/player-forecasts/gameContract.ts:430 goalsAgainstAverage: ratio(means.GOALS_AGAINST_GOALIE, means.TOTAL_TOI === null ? null : means.TOTAL_TOI / 60, 60),", "web/lib/player-forecasts/gameContract.ts:434 /** Explicit ordered remaining games only. No actuals, independence assumption or ratio averaging. */"]}
  - Tests: `{"status": "Discovered only; not run", "references": ["web/lib/player-forecasts/gameContract.test.ts:3"]}`
- **Leads (not audited):**
  - (codex:web-lib-player-forecasts-gamecontract-goalieratioofexpectations) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested."]

## M-PFC-262 Eligible-opportunity goalie appearance frequency (buildGoalieParticipationReceipt)

- **Match:** Codex only; Opus —; Codex web-lib-player-forecasts-modeledgoalieparticipation-buildgoalieparticipationreceipt
- **Possible related records (low-confidence location link, unconfirmed):** PFC-081
- **Purpose:** Verified positive-minute goalie appearances, including relief, divided by observed eligible opportunities.
- **Where:** `web/lib/player-forecasts/modeledGoalieParticipation.ts:33 buildGoalieParticipationReceipt`
- **Codex view (web-lib-player-forecasts-modeledgoalieparticipation-buildgoalieparticipationreceipt, calculation; Codex family 'Native player forecasts and contribution serving'):** Eligible-opportunity goalie appearance frequency (buildGoalieParticipationReceipt)
  - Purpose: Verified positive-minute goalie appearances, including relief, divided by observed eligible opportunities.
  - Inputs/units: Goalie historical eligibility/opportunity/appearance evidence and cutoff.
  - Output scale: Experimental P(appearance), numerator/denominator; not start probability.
  - Consumers: ["web/lib/player-forecasts/modeledGoalieParticipationStore.ts:3"]
- **Audit context:**
  - Intended contract (Codex web-lib-player-forecasts-modeledgoalieparticipation-buildgoalieparticipationreceipt): {"source": "web/lib/player-forecasts/modeledGoalieParticipation.ts:33", "explicit_comment": "Reuses the finite opportunity validator, never starter probabilities. Authentic complete frames and dated labels still require independent publication review.", "arithmetic_locations": ["web/lib/player-forecasts/modeledGoalieParticipation.ts:81 /** Call only after exact bundle release admission, never as automatic publication. */"]}
  - Tests: `{"status": "Discovered only; not run", "references": ["web/lib/player-forecasts/modeledGoalieParticipation.test.ts:3", "web/lib/rosterScheduleData/planning.test.ts:14"]}`
- **Leads (not audited):**
  - (codex:web-lib-player-forecasts-modeledgoalieparticipation-buildgoalieparticipationreceipt) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested."]

## M-PFC-263 Eligible-opportunity official starter frequency (buildGoalieStartKernel)

- **Match:** Codex only; Opus —; Codex web-lib-player-forecasts-modeledgoalieparticipation-buildgoaliestartkernel
- **Purpose:** Count explicit verified true starter labels over same eligible opportunity denominator; missing starter/appearance evidence withholds.
- **Where:** `web/lib/player-forecasts/modeledGoalieParticipation.ts:145 buildGoalieStartKernel`
- **Codex view (web-lib-player-forecasts-modeledgoalieparticipation-buildgoaliestartkernel, calculation; Codex family 'Native player forecasts and contribution serving'):** Eligible-opportunity official starter frequency (buildGoalieStartKernel)
  - Purpose: Count explicit verified true starter labels over same eligible opportunity denominator; missing starter/appearance evidence withholds.
  - Inputs/units: Dated opportunity frame; historical original boolean starter labels and evidence.
  - Output scale: Experimental P(start), numerator/denominator; independent from per-appearance volume and W/SO means.
  - Consumers: ["web/lib/player-forecasts/rollingWindowParticipation.ts:3"]
- **Audit context:**
  - Intended contract (Codex web-lib-player-forecasts-modeledgoalieparticipation-buildgoaliestartkernel): {"source": "web/lib/player-forecasts/modeledGoalieParticipation.ts:145", "explicit_comment": "Official-starter event over an appearance receipt's selected opportunities; versions and limitations are the caller's.", "arithmetic_locations": ["web/lib/player-forecasts/modeledGoalieParticipation.ts:172 numerator, probability: reasons.length ? null : numerator / receipt.denominator, reasons: [...new Set(reasons)],"]}
  - Tests: `{"status": "Discovered only; not run", "references": ["web/lib/player-forecasts/modeledGoalieParticipation.test.ts (module test)"]}`
- **Leads (not audited):**
  - (codex:web-lib-player-forecasts-modeledgoalieparticipation-buildgoaliestartkernel) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested."]

## M-PFC-264 Build roster observation goalie start receipt (buildRosterObservationGoalieStartReceipt)

- **Match:** Codex only; Opus —; Codex web-lib-player-forecasts-modeledgoalieparticipation-buildrosterobservationgoaliestartreceipt
- **Purpose:** Build roster observation goalie start receipt for native player forecasts and contribution serving. Exact arithmetic locations are recorded below; no correctness judgment is made.
- **Where:** `web/lib/player-forecasts/modeledGoalieParticipation.ts:212 buildRosterObservationGoalieStartReceipt`
- **Codex view (web-lib-player-forecasts-modeledgoalieparticipation-buildrosterobservationgoaliestartreceipt, symbol_candidate; Codex family 'Native player forecasts and contribution serving'):** Build roster observation goalie start receipt (buildRosterObservationGoalieStartReceipt)
  - Purpose: Build roster observation goalie start receipt for native player forecasts and contribution serving. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: export function buildRosterObservationGoalieStartReceipt(input: RosterObservationGoalieStartInput, issuance: { issuedAt: string; expiresAt: string }): RosterObservationGoalieStartReceipt { if (input?.version !== "goalie-roster-observation-start-input-v1" \|\| input.playerClass !== "goa … (full text in the original packet)
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Consumers: ["web/lib/player-forecasts/modeledGoalieParticipationStore.ts:6", "web/lib/player-forecasts/nativeCadenceOutputPreparation.ts:8", "web/lib/player-forecasts/nativeDailyPipeline.ts:6", "web/lib/player-forecasts/nativeInputMaterialization.ts:11"]
- **Audit context:**
  - Intended contract (Codex web-lib-player-forecasts-modeledgoalieparticipation-buildrosterobservationgoaliestartreceipt): {"source": "web/lib/player-forecasts/modeledGoalieParticipation.ts:212", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": []}
  - Tests: `{"status": "Discovered only; not run", "references": ["web/lib/player-forecasts/modeledGoalieParticipation.test.ts:3", "web/lib/player-forecasts/rollingParticipationFrame.test.ts:6", "web/lib/player-forecasts/rollingWindowParticipation.test.ts:5", "web/lib/rosterScheduleData/planning.test.ts:14"]}`
- **Leads (not audited):**
  - (codex:web-lib-player-forecasts-modeledgoalieparticipation-buildrosterobservationgoaliestartreceipt) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

