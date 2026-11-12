# Audit packet: Player forecasts (season) (part 2 of 5)

Master entries M-PFC-061 to M-PFC-120 (60 of 264 in this family).

Slim copy (Chef, 2026-11-11): boilerplate status lines, generic leads, tags and duplicate locations removed. Full packet: `../packets/player-forecasts-season-part2.md`. Leads are hypotheses; line numbers date from 2026-11-10, so re-locate by symbol.

| ID | Name | Match | Conflicts | Leads |
|---|---|---|---:|---:|
| M-PFC-061 | Rookie model validation (Brier and point-rate MAE) | Both | 0 | 2 |
| M-PFC-062 | Rookie projection profile (rookie flag, expected games, uncertainty m… | Both | 0 | 4 |
| M-PFC-063 | Rookie translated rates into season artifact | Both | 0 | 3 |
| M-PFC-064 | Contribution resolver: detailed/baseline blend and unconditional mean | Both | 0 | 4 |
| M-PFC-065 | Contribution coverage summary | Both | 0 | 1 |
| M-PFC-066 | Forecast scoring per output (abs/squared error, Brier, log loss, 80% … | Both | 0 | 4 |
| M-PFC-067 | Team contexts: offense/defense/pace multipliers, schedule-neutral goa… | Both | 0 | 5 |
| M-PFC-068 | Venue scorer effects (rink counting bias) | Both | 0 | 2 |
| M-PFC-069 | Roster-adjusted team contexts | Both | 0 | 3 |
| M-PFC-070 | Hierarchical hits (Poisson-Gamma partial pooling) | Both | 0 | 5 |
| M-PFC-071 | Challenger context OLS and assist routing tournament | Both | 0 | 7 |
| M-PFC-072 | Historical-core candidate tournament, distribution fit and calibration | Both | 0 | 8 |
| M-PFC-073 | Recency-decayed weighted summary (per-player mean/variance and popula… | Both | 0 | 3 |
| M-PFC-074 | v4 exposure-based serving rates (TOI per GP, scoring per TOI) and str… | Both | 0 | 4 |
| M-PFC-075 | Empirical-Bayes shrinkage rate | Both | 0 | 4 |
| M-PFC-076 | Penalized log-link rate GLM (Poisson IRLS with ridge) | Both | 0 | 8 |
| M-PFC-077 | Regularized negative-binomial GLM | Both | 0 | 4 |
| M-PFC-078 | Decay/shrinkage grid search by chronological MAE | Both | 0 | 3 |
| M-PFC-079 | Season model tournament and minimum-lift rule | Both | 0 | 3 |
| M-PFC-080 | Regularized hurdle GLM (logistic positive-probability x log-link posi… | Both | 0 | 4 |
| M-PFC-081 | FORGE walk-forward blocked-shots pilot: methods A/B/C and bands | Both | 0 | 4 |
| M-PFC-082 | FORGE walk-forward selection, pair regret and cluster bootstrap | Both | 0 | 4 |
| M-PFC-083 | Player forecast validation inference context (rest days, home indicat… | Opus only | 0 | 2 |
| M-PFC-084 | Fantasy projections page confidence tiers and stale/conflict badges | Opus only | 0 | 1 |
| M-PFC-085 | Season fantasy projection settlement scoring (model vs published) | Opus only | 0 | 1 |
| M-PFC-086 | On-ice shot attempts, unblocked attempts and xG for/against (SQL) | Opus only | 0 | 3 |
| M-PFC-087 | Projection row normalization (goalie SA = SV + GA) | Opus only | 0 | 2 |
| M-PFC-088 | Boxscore target extraction and TOI parsing | Opus only | 0 | 2 |
| M-PFC-089 | Native daily means capture planning (lookback windows and bounds) | Opus only | 0 | 1 |
| M-PFC-090 | Starter Board daily run (FORGE forecast export, candidate capture, ba… | Opus only | 0 | 1 |
| M-PFC-091 | Daily-board history normalization and strength accounting audit | Opus only | 0 | 1 |
| M-PFC-092 | Daily-board official settlement normalization | Opus only | 0 | 0 |
| M-PFC-093 | Historical qualification cohort classification (early-season target) | Opus only | 0 | 2 |
| M-PFC-094 | Forecast candles and accountability candles (OHLC of revisions/skill) | Opus only | 0 | 1 |
| M-PFC-095 | Game forecast contract consistency checks | Opus only | 0 | 0 |
| M-PFC-096 | Market implied mean from de-vigged props and moneyline team win | Opus only | 0 | 2 |
| M-PFC-097 | Served-forecast ledger naive controls (last-N and season means, goali… | Opus only | 0 | 3 |
| M-PFC-098 | Horizon vintages (issue-time reconstruction) | Opus only | 0 | 2 |
| M-PFC-099 | Season settlement finality rule | Opus only | 0 | 1 |
| M-PFC-100 | Fantasy metric source eligibility coverage gate | Opus only | 0 | 1 |
| M-PFC-101 | On-ice chances/goals against per player-game (defense history SQL) | Opus only | 0 | 3 |
| M-PFC-102 | Rest-day / back-to-back derivation | Opus only | 0 | 2 |
| M-PFC-103 | Native baseline cadence (08:00 NY / T-15 publication slots) | Opus only | 0 | 1 |
| M-PFC-104 | Native baseline publication validation (bounded plan admission) | Opus only | 0 | 0 |
| M-PFC-105 | Native cadence output preparation (re-issuance of means and participa… | Opus only | 0 | 1 |
| M-PFC-106 | FORGE daily v1 composition: schedule bindings and daily issuance expi… | Opus only | 0 | 2 |
| M-PFC-107 | FORGE daily v2 composition gates (method switch, universe, means cove… | Opus only | 0 | 3 |
| M-PFC-108 | Native input materialization (bounded immutable input packing and man… | Opus only | 0 | 1 |
| M-PFC-109 | Goalie start-basis compatibility and modeled start metadata mass check | Opus only | 0 | 0 |
| M-PFC-110 | Challenger freeze assist labels from legacy pbp_plays | Opus only | 0 | 1 |
| M-PFC-111 | Season skater game-label construction (TOI split, assists, strength s… | Opus only | 0 | 3 |
| M-PFC-112 | Season-total exposure labels and identity audit | Opus only | 0 | 2 |
| M-PFC-113 | Season goalie game labels (starter, decisions, shutout, quality start) | Opus only | 0 | 3 |
| M-PFC-114 | Assist label audit and official Gamecenter correction | Opus only | 0 | 2 |
| M-PFC-115 | Native participation frame accounting (P/Z/O/K/U dispositions) | Opus only | 0 | 2 |
| M-PFC-116 | Lineup/goalie text classification and lineup completeness | Opus only | 0 | 2 |
| M-PFC-117 | PP evidence packet consistency checks | Opus only | 0 | 0 |
| M-PFC-118 | Season projection draft validation gates | Opus only | 0 | 3 |
| M-PFC-119 | Season roster consensus and roster_confidence ladder | Opus only | 0 | 5 |
| M-PFC-120 | Baseline/goalie contribution bundle assembly and unit labeling | Opus only | 0 | 1 |

## M-PFC-061 Rookie model validation (Brier and point-rate MAE)

- **Match:** Both; Opus PFC-097; Codex modeling-player-forecasts-rookies-evaluate-rookie-transition-model
- **Purpose:** Scores one held-out source season vs global baselines to gate serving
- **Where:** `modeling/player_forecasts/rookies.py:517 (evaluate_rookie_transition_model)`; `modeling/player_forecasts/rookies.py:517 evaluate_rookie_transition_model`
- **Opus view (PFC-097):**
  - Method: Brier of predicted roster probability vs global prior; MAE of (G+A)/GP vs global NHL rate; eligible if >=20 samples, >=10 NHL rate samples and both improve
  - Inputs/units: probabilities 0-1; points per game; sources: player landing
  - Output scale: Brier; MAE (points per game); boolean; writes: validation report JSON
  - Status: unknown — manual CLI season-rookie-freeze (modeling/player_forecasts/__main__.py:121) feeding v4 season-train; serving only when validation eligibleForServing
  - Consumers: train_season_artifact rookie_translation_eligible; evaluate_fantasy_batch
- **Codex view (modeling-player-forecasts-rookies-evaluate-rookie-transition-model, symbol_candidate, location; Codex family 'Python forecast research and season models'):** Evaluate rookie transition model (evaluate_rookie_transition_model)
  - Purpose: Score one untouched source season against a model fit to earlier transitions.
  - Inputs/units: Parameter/type declaration excerpt: def evaluate_rookie_transition_model( captures: list[dict[str, Any]], *, validation_source_season: int = 20242025, ) -> dict[str, Any]: """Score one untouched source season against a model fit to earlier transitions.""" training_model = learn_rookie_transition_model( captures, training … (full text in the original packet)
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
- **Audit context:**
  - Intent (Opus): rookies.py:522 docstring ('Score one untouched source season...')
  - Intended contract (Codex modeling-player-forecasts-rookies-evaluate-rookie-transition-model): {"source": "modeling/player_forecasts/rookies.py:517", "explicit_comment": "Score one untouched source season against a model fit to earlier transitions.", "arithmetic_locations": ["modeling/player_forecasts/rookies.py:546 sum(", "modeling/player_forecasts/rookies.py:547 (sample[\"predictedProbability\"] - sample[\"madeNhl\"]) ** 2", "modeling/player_forecasts/rookies.py:549 ) / len(samples)", "modeling/player_forecasts/rookies.py:553 sum((roster_prior - sample[\"madeNhl\"]) ** 2 for sample in samples)", "modeling/player_forecasts/rookies.py:554 / len(samples)", "modeling/player_forecasts/rookies.py:566 ) / games", "modeling/player_forecasts/rookies.py:578 sum(model_point_errors) / len(model_point_errors)", "modeling/player_forecasts/rookies.py:582 sum(baseline_point_errors) / len(baseline_point_errors)"]}
  - External references: Brier score
  - Fixtures/test data: `modeling/player_forecasts/tests/test_harness.py`
  - Tests: `modeling/player_forecasts/tests/test_harness.py`; `{"status": "Discovered only; not run", "references": ["modeling/player_forecasts/tests/test_harness.py:2390"]}`
- **Leads (not audited):**
  - (opus) one season, tiny thresholds (20/10) and same survivor-selected sample
  - (codex:modeling-player-forecasts-rookies-evaluate-rookie-transition-model) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-PFC-062 Rookie projection profile (rookie flag, expected games, uncertainty multiplier)

- **Match:** Both; Opus PFC-098; Codex modeling-player-forecasts-rookies-rookie-projection-profile
- **Purpose:** Produces per-rookie roster probability, expected NHL games and variance inflation
- **Where:** `modeling/player_forecasts/rookies.py:619 (rookie_projection_profile)`; `modeling/player_forecasts/rookies.py:619 rookie_projection_profile`
- **Opus view (PFC-098):**
  - Method: rookie if career NHL GP < 25 and a source exists; expected games = min(84, p * conditional games (default 32)); uncertainty multiplier = 1.5 + 20/max(20, source GP) + 10/max(10, transition support)
  - Inputs/units: career NHL GP; source GP; sources: player landing
  - Output scale: probability; expected games 0-84; multiplier; writes: season-artifact.json rookieProfile
  - Status: unknown — manual CLI season-rookie-freeze (modeling/player_forecasts/__main__.py:121) feeding v4 season-train; serving only when validation eligibleForServing
  - Consumers: train_season_artifact play probability (expectedNhlGames/84)
- **Codex view (modeling-player-forecasts-rookies-rookie-projection-profile, symbol_candidate, location; Codex family 'Python forecast research and season models'):** Rookie projection profile (rookie_projection_profile)
  - Purpose: Rookie projection profile for python forecast research and season models. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: def rookie_projection_profile( capture: dict[str, Any], transition_model: dict[str, Any], ) -> dict[str, Any]: totals = capture.get("seasonTotals") or [] career_nhl_games = sum( int(row["gamesPlayed"]) for row in totals if row["league"] == NHL_LEAGUE and int(row["season"]) <= LAST_COMP … (full text in the original packet)
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
- **Audit context:**
  - Intent (Opus): fallbackPolicy 'retain_generic_prior_with_wider_uncertainty' (rookies.py evaluate_rookie_transition_model)
  - Intended contract (Codex modeling-player-forecasts-rookies-rookie-projection-profile): {"source": "modeling/player_forecasts/rookies.py:619", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["modeling/player_forecasts/rookies.py:624 career_nhl_games = sum(", "modeling/player_forecasts/rookies.py:644 expected_games = min(84.0, roster_probability * conditional_games)", "modeling/player_forecasts/rookies.py:663 1.5 + 20 / max(20, sample) + 10 / max(10, transition_support),"]}
  - External references: NHL Calder eligibility (<=25 prior-season GP, <=6 in each of two prior seasons, age < 26)
  - Fixtures/test data: `modeling/player_forecasts/tests/test_harness.py`
  - Tests: `modeling/player_forecasts/tests/test_harness.py`; `{"status": "Discovered only; not run", "references": ["modeling/player_forecasts/tests/test_harness.py:2393"]}`
- **Leads (not audited):**
  - (opus) '<25 career games' differs from Calder rookie definition
  - (opus) 84-game cap/denominator vs 82 elsewhere
  - (opus) magic constants 32 default games and 1.5/20/10 uncertainty formula
  - (codex:modeling-player-forecasts-rookies-rookie-projection-profile) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-PFC-063 Rookie translated rates into season artifact

- **Match:** Both; Opus PFC-099; Codex modeling-player-forecasts-season-train-season-artifact
- **Purpose:** Overwrites rookie goals, assists and PIM with league-translated rates and widens variance
- **Where:** `modeling/player_forecasts/season.py:3415 (train_season_artifact rookie block)`; `modeling/player_forecasts/season.py:2965 train_season_artifact`
- **Opus view (PFC-099):**
  - Method: GOALS, PENALTY_MINUTES = translated; ASSISTS split into A1/A2 by the player's current share or population share (else 0.5); variance = max(var,\|rate\|,0.01) * uncertaintyMultiplier (default 2.25); only when validation eligibleForServing
  - Inputs/units: source-league per-game rates; sources: rookie source freeze (NHL player landing)
  - Output scale: per-NHL-game conditional rates; variance multiplier; writes: season-artifact.json
  - Status: unknown — manual CLI season-rookie-freeze (modeling/player_forecasts/__main__.py:121) feeding v4 season-train; serving only when validation eligibleForServing
  - Consumers: evaluate_season_game
- **Codex view (modeling-player-forecasts-season-train-season-artifact, symbol_candidate, location; Codex family 'Python forecast research and season models'):** Train season artifact (train_season_artifact)
  - Purpose: Train season artifact for python forecast research and season models. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: def train_season_artifact( freeze: Path, output: Path, *, contract_version: str = SEASON_CONTRACT_VERSION, rookie_freeze: Path \| None = None, ) -> dict[str, Any]: manifest = read_json(freeze / "manifest.json") if manifest.get("contractChecksum") != SEASON_CONTRACT_SHA256: raise Runtim … (full text in the original packet)
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
- **Audit context:**
  - Intent (Opus): method 'historical_league_transition_empirical_bayes_v1'; docs/player-projections/research-contract-v4-season-fantasy.json rookieModel
  - Intended contract (Codex modeling-player-forecasts-season-train-season-artifact): {"source": "modeling/player_forecasts/season.py:2965", "explicit_comment": "modeling/player_forecasts/season.py:3373 Context profiles are fitted from game-level fields. Once a", "arithmetic_locations": ["modeling/player_forecasts/season.py:2972 manifest = read_json(freeze / \"manifest.json\")", "modeling/player_forecasts/season.py:2997 audit_path = (freeze / str(assist_policy.get(\"auditPath\") or \"\")).resolve()", "modeling/player_forecasts/season.py:3022 freeze / str(metric_policy.get(\"auditPath\") or \"\")", "modeling/player_forecasts/season.py:3048 freeze / str(season_total_policy.get(\"auditPath\") or \"\")", "modeling/player_forecasts/season.py:3056 season_total_path = freeze / \"skater_season_totals.jsonl\"", "modeling/player_forecasts/season.py:3073 skaters = [row for row in read_jsonl(freeze / \"skaters.jsonl\") if int(row[\"season_id\"]) <= TRAINING_CUTOFF_SEASON]", "modeling/player_forecasts/season.py:3074 goalies = [row for row in read_jsonl(freeze / \"goalies.jsonl\") if int(row[\"season_id\"]) <= TRAINING_CUTOFF_SEASON]", "modeling/player_forecasts/season.py:3075 pool = read_json(freeze / \"player-pool.json\")"]}
  - External references: NHLe translation (Desjardins; Bader)
  - Fixtures/test data: `modeling/player_forecasts/tests/test_harness.py`
  - Tests: `modeling/player_forecasts/tests/test_harness.py`; `{"status": "Discovered only; not run", "references": ["No direct symbol/module test reference found in bounded search."]}`
- **Leads (not audited):**
  - (opus) translated rates are per source-league game but used as per-NHL-game conditional rates without TOI/role adjustment
  - (opus) SOG, PP, TOI and other targets for rookies stay on the generic population prior, so goals and shots become inconsistent
  - (codex:modeling-player-forecasts-season-train-season-artifact) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-PFC-064 Contribution resolver: detailed/baseline blend and unconditional mean

- **Match:** Both; Opus PFC-103; Codex web-lib-player-forecasts-contributions-resolvecontribution
- **Purpose:** Pick or blend detailed (FORGE) and baseline rates per player-game-target and multiply by participation probability.
- **Where:** `web/lib/player-forecasts/contributions.ts:267 (resolveContribution)`; `web/lib/player-forecasts/contributions.ts:307 (blend weight)`; `web/lib/player-forecasts/contributions.ts:332 (unconditionalMean)`; `web/lib/player-forecasts/contributions.ts:146 (assessSource)`; `web/lib/player-forecasts/contributions.ts:9 (forecastCalen … (full text in the original packet)
- **Opus view (PFC-103):**
  - Method: lead = UTC-day difference (game - now). Detailed excluded if lead >= horizon. If both valid and compatible (same unit/basis/integration): w = clamp((horizonDays - lead)/7, 0, 1); mean = w*detailed + (1-w)*baseline (so detailed only for lead <= horizon-7, linear fade over last 7 days). unconditionalMean = conditionalMean * participationProbability (1 if participationIntegrated). Falls back to baseline when detailed lacks participation. Exclusion reasons: stale, future_input, identity_conflict, outside_horizon, use_not_approved, etc.
  - Inputs/units: per-appearance/per-start means (count or minutes); probability 0-1; calendar days; sources: —
  - Output scale: expected count/minutes per game (unconditional) and conditional mean; blend weight 0-1; writes: —
  - Status: live — via resolvePlanningContributions in lib/rosterScheduleOptimizer/planning.ts, /api/v1/start-chart, /api/v1/forge/forecasts
  - Consumers: planningContributions.resolvePlanningContributions; RSO planning.ts; gameExpectations; calendarCoverage
- **Codex view (web-lib-player-forecasts-contributions-resolvecontribution, calculation, location; Codex family 'Native player forecasts and contribution serving'):** Detailed/baseline overlap and participation (resolveContribution)
  - Purpose: Compatible conditional means blend with clamped (horizonDays-lead)/overlapDays; multiply eligible probability once; admission/use gates preserved.
  - Inputs/units: Named model/observation inputs at cited declaration; Conditional/unconditional per-game contribution, blend weight, allowed-use flags. Input count/rate units follow the corresponding named outcome; cutoff timestamps and identity are required where declared.
  - Output scale: Conditional/unconditional per-game contribution, blend weight, allowed-use flags.
- **Audit context:**
  - Intent (Opus): contributions.ts:266 'Resolve one player/game/target. Source records must already be sanitized and release checked'; contributions.ts:6 'Calendar coverage/overlap policy'
  - Intended contract (Codex web-lib-player-forecasts-contributions-resolvecontribution): {"source": "web/lib/player-forecasts/contributions.ts:267", "explicit_comment": "Resolve one player/game/target. Source records must already be sanitized and release checked by the loader.", "arithmetic_locations": ["web/lib/player-forecasts/contributions.ts:307 const weight = Math.min(1, Math.max(0, (horizonDays - lead) / calendarPolicy!.overlapDays));", "web/lib/player-forecasts/contributions.ts:311 mean = weight * detailed.mean + (1 - weight) * baseline.mean;", "web/lib/player-forecasts/contributions.ts:332 const unconditionalMean = mean != null && probability != null ? mean * probability : null;", "web/lib/player-forecasts/contributions.ts:386 /** The caller supplies every required opportunity, including competing bench players. */"]}
  - External references: Forecast combination / horizon-dependent blending
  - Tests: `web/__tests__/components/RosterScheduleOptimizer/RosterScheduleOptimizer.test.tsx`; `web/lib/player-forecasts/contributions.test.ts`; `web/lib/player-forecasts/currentSeasonSogContribution.test.ts`; `web/lib/player-forecasts/planComparison.test.ts`; `{"status": "Discovered only; not run", "references": ["web/__tests__/componen … (full text in the original packet)
- **Leads (not audited):**
  - (opus) blend weight is a fixed linear ramp on calendar days, not tuned to measured skill
  - (opus) lead computed on UTC days, so late-evening ET games shift a day
  - (opus) E[X]=p*E[X\|play] assumes count independent of participation; fine for means, not variance
  - (codex:web-lib-player-forecasts-contributions-resolvecontribution) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested."]

## M-PFC-065 Contribution coverage summary

- **Match:** Both; Opus PFC-104; Codex web-lib-player-forecasts-contributions-summarizecontributioncoverage
- **Purpose:** Count required player-game-targets that are assignment/totals/comparison eligible.
- **Where:** `web/lib/player-forecasts/contributions.ts:387 (summarizeContributionCoverage)`; `web/lib/player-forecasts/contributions.ts:387 summarizeContributionCoverage`
- **Opus view (PFC-104):**
  - Method: Counts per use flag over unique requirement keys; exclusions list items lacking comparison permission.
  - Inputs/units: counts; sources: —
  - Output scale: integer counts; writes: —
  - Status: live — lib/rosterScheduleOptimizer/planning.ts
  - Consumers: lib/rosterScheduleOptimizer/planning.ts
- **Codex view (web-lib-player-forecasts-contributions-summarizecontributioncoverage, symbol_candidate, location; Codex family 'Native player forecasts and contribution serving'):** Summarize contribution coverage (summarizeContributionCoverage)
  - Purpose: The caller supplies every required opportunity, including competing bench players.
  - Inputs/units: Parameter/type declaration excerpt: export function summarizeContributionCoverage(requirements: ContributionRequirement[], resolved: ResolvedContribution[]): ContributionCoverage { const key = (game: ContributionGame, targetKey: string) => [game.seasonId, game.gameId, game.playerId, targetKey].join(":"); const requiredKe … (full text in the original packet)
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
- **Audit context:**
  - Intent (Opus): contributions.ts:386 'The caller supplies every required opportunity, including competing bench players.'
  - Intended contract (Codex web-lib-player-forecasts-contributions-summarizecontributioncoverage): {"source": "web/lib/player-forecasts/contributions.ts:387", "explicit_comment": "The caller supplies every required opportunity, including competing bench players.", "arithmetic_locations": []}
  - Tests: `web/lib/player-forecasts/contributions.test.ts`; `{"status": "Discovered only; not run", "references": ["web/lib/player-forecasts/contributions.test.ts:15"]}`
- **Leads (not audited):**
  - (codex:web-lib-player-forecasts-contributions-summarizecontributioncoverage) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-PFC-066 Forecast scoring per output (abs/squared error, Brier, log loss, 80% interval, composite skill score)

- **Match:** Both; Opus PFC-111; Codex web-lib-player-forecasts-settlement-scoreforecast
- **Purpose:** Per-forecast metrics written at settlement time, including a 0-100 skill score vs baseline.
- **Where:** `web/lib/player-forecasts/settlement.ts:144 (scoreForecast)`; `web/lib/player-forecasts/settlement.ts:180 (compositeSkillScore)`; `web/lib/player-forecasts/settlement.ts:322 (settlePlayerForecasts)`; `web/lib/player-forecasts/settlement.ts:420 (finality)`; `web/lib/player-forecasts/settlement.ts:5 (PROVISIONAL_DELAY_MS etc.)` … (full text in the original packet)
- **Opus view (PFC-111):**
  - Method: absoluteError, squaredError; probability: brier=(p-y)^2, logLoss with clamp 1e-15; interval80Covered = p10 <= a <= p90. compositeSkillScore = clamp(50 + 50*(baselineAE - AE)/max(baselineAE, 1e-9), 0, 100). Settlement waits 8 h after start, default lookback 7 days, max window 30 days; finality provisional until start+48h then final; changed value -> corrected.
  - Inputs/units: forecast and actual in target units; probability 0-1; sources: games, player_forecast_outputs, nhl_api_game_payloads_raw, player_forecast_outcome_revisions
  - Output scale: abs/squared error in target units; Brier 0-1; log loss nats; compositeSkillScore 0-100 (50 = equal to baseline); writes: player_forecast_outcome_revisions, player_forecast_evaluation_revisions
  - Status: unknown — /api/v1/player-forecasts/jobs/settle route exists, no vercel.json cron found; writes player_forecast_evaluation_revisions
  - Consumers: pages/api/v1/player-forecasts/jobs/settle.ts; dashboard accountability
- **Codex view (web-lib-player-forecasts-settlement-scoreforecast, symbol_candidate, location; Codex family 'Native player forecasts and contribution serving'):** Score forecast (scoreForecast)
  - Purpose: Score forecast for native player forecasts and contribution serving. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: export function scoreForecast(args: { actual: number; pointEstimate: number \| null; probability: number \| null; conditioning: string; quantiles?: Record<string, unknown> \| null; baselinePointEstimate?: number \| null; }) { const isProbability = args.conditioning === "playing_probabi … (full text in the original packet)
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED for the 0-100 skill formula (scoring version label PLAYER_FORECAST_SCORING_VERSION 'player-forecast-skill-v1', researchContract.ts:13)
  - Intended contract (Codex web-lib-player-forecasts-settlement-scoreforecast): {"source": "web/lib/player-forecasts/settlement.ts:144", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["web/lib/player-forecasts/settlement.ts:160 squaredError: error * error,", "web/lib/player-forecasts/settlement.ts:164 metrics.brier = error * error;", "web/lib/player-forecasts/settlement.ts:165 metrics.logLoss = -(args.actual * Math.log(probability) + (1 - args.actual) * Math.log(1 - probability));", "web/lib/player-forecasts/settlement.ts:178 baselineMetrics.squaredError = (baseline - args.actual) ** 2;", "web/lib/player-forecasts/settlement.ts:180 compositeSkillScore = Math.max(0, Math.min(100, 50 + 50 * ((baselineAbsoluteError - Math.abs(error)) / denominator)));"]}
  - External references: Skill score SS = 1 - err/err_ref; Brier/log loss conventions
  - Fixtures/test data: `web/scripts/seed-player-forecast-fixtures.ts`
  - Tests: `web/lib/player-forecasts/playerForecasts.test.ts`; `{"status": "Discovered only; not run", "references": ["web/lib/player-forecasts/playerForecasts.test.ts:18"]}`
- **Leads (not audited):**
  - (opus) per-forecast skill is unstable: baseline AE of 0 (common for low counts) gives denominator 1e-9 and pins score to 0 or 100
  - (opus) log-loss epsilon 1e-15 here vs 1e-6 in servedForecastLedger (inconsistent)
  - (opus) accountability composite_skill_score aggregation is computed outside this slice (read from player_forecast_accountability_revisions)
  - (codex:web-lib-player-forecasts-settlement-scoreforecast) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-PFC-067 Team contexts: offense/defense/pace multipliers, schedule-neutral goal differential, team ratings

- **Match:** Both; Opus PFC-112; Codex modeling-player-forecasts-season-percentile, modeling-player-forecasts-season-team-contexts
- **Purpose:** Derives team strength multipliers and percentile ratings from last-season team game stats
- **Where:** `modeling/player_forecasts/season.py:2554 (_team_contexts)`; `modeling/player_forecasts/season.py:569 (TEAM_HISTORY_QUERY)`; `modeling/player_forecasts/season.py:4882 (team rating confidence)`; `modeling/player_forecasts/season.py:2546 _percentile`; `modeling/player_forecasts/season.py:2554 _team_contexts`
- **Opus view (PFC-112):**
  - Method: offense = clip(GF/league GF, 0.65..1.35); defense = clip(league GF/GA, 0.65..1.35); pace = clip((SF+SA)/league, 0.75..1.25); save% = 1 - GA/SA; PP% = PPG/opps; PK% = 1 - PPGA/opps; schedule-neutral GD: 20 iterations of GD + mean opponent rating, centered, damped 0.5; ratings = percentiles; confidence = min(1, games/82)
  - Inputs/units: per-game goals and shots; PP 'goals/opps' strings; sources: teamGameStats, games
  - Output scale: multipliers 0.65-1.35 / 0.75-1.25; goals per game; percentile 0-100; writes: season-artifact.json teams, player_forecast_season_team_aggregates via importer
  - Status: unknown — run manually via `python -m modeling.player_forecasts season-train/season-project` (modeling/player_forecasts/__main__.py:112,130; docs/player-projections/player-forecasts-runbook.md:512-531); bundles imported by web/scripts/import-player-forecast-season.ts (npm import:player-forecast-season) into player_forecast_sea … (full text in the original packet)
  - Consumers: _target_multiplier; project_season_release team aggregates
- **Codex view (modeling-player-forecasts-season-percentile, symbol_candidate, location; Codex family 'Python forecast research and season models'):** Percentile (_percentile)
  - Purpose: Percentile for python forecast research and season models. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: def _percentile(values: list[float], value: float) -> float: if not values: return 50.0 less = sum(1 for item in values if item < value) equal = sum(1 for item in values if item == value) return 100.0 * (less + 0.5 * equal) / len(values)
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
- **Codex view (modeling-player-forecasts-season-team-contexts, symbol_candidate, location; Codex family 'Python forecast research and season models'):** Team contexts (_team_contexts)
  - Purpose: Team contexts for python forecast research and season models. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: def _team_contexts(team_rows: list[dict[str, Any]], teams: list[dict[str, Any]]) -> dict[str, Any]: recent = [row for row in team_rows if int(row["season_id"]) == TRAINING_CUTOFF_SEASON] league_gf = sum(float(row["goals_for"]) for row in recent) / max(1, len(recent)) league_shots = sum … (full text in the original packet)
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED; docs/player-projections/research-contract-v3-season.json
  - Intended contract (Codex modeling-player-forecasts-season-percentile): {"source": "modeling/player_forecasts/season.py:2546", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["modeling/player_forecasts/season.py:2549 less = sum(1 for item in values if item < value)", "modeling/player_forecasts/season.py:2550 equal = sum(1 for item in values if item == value)", "modeling/player_forecasts/season.py:2551 return 100.0 * (less + 0.5 * equal) / len(values)"]}
  - Intended contract (Codex modeling-player-forecasts-season-team-contexts): {"source": "modeling/player_forecasts/season.py:2554", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["modeling/player_forecasts/season.py:2556 league_gf = sum(float(row[\"goals_for\"]) for row in recent) / max(1, len(recent))", "modeling/player_forecasts/season.py:2557 league_shots = sum(float(row[\"shots_for\"]) + float(row[\"shots_against\"]) for row in recent) / max(1, len(recent))", "modeling/player_forecasts/season.py:2566 gf = sum(float(row[\"goals_for\"]) for row in rows) / games", "modeling/player_forecasts/season.py:2567 ga = sum(float(row[\"goals_against\"]) for row in rows) / games", "modeling/player_forecasts/season.py:2568 pace = sum(float(row[\"shots_for\"]) + float(row[\"shots_against\"]) for row in rows) / games", "modeling/player_forecasts/season.py:2569 pp_goals = sum(float(row[\"pp_goals\"]) for row in rows)", "modeling/player_forecasts/season.py:2570 pp_opportunities = sum(float(row[\"pp_opportunities\"]) for row in rows)", "modeling/player_forecasts/season.py:2571 pk_ga = sum(float(row[\"pk_goals_against\"]) for row in rows)"]}
  - External references: Simple Rating System (Sports-Reference SRS); team GF%/xGF%
  - Fixtures/test data: `modeling/player_forecasts/tests/test_harness.py`
  - Tests: `modeling/player_forecasts/tests/test_harness.py`; `{"status": "Discovered only; not run", "references": ["No direct symbol/module test reference found in bounded search."]}`; `{"status": "Discovered only; not run", "references": ["modeling/player_forecasts/tests/test_harness.py:2382"]}`
- **Leads (not audited):**
  - (opus) uses only one prior season with no regression to the mean for multipliers
  - (opus) GA/save% include empty-net goals and shootout handling is unclear
  - (opus) damped SRS iteration (0.5) for a fixed 20 iterations may not converge
  - (codex:modeling-player-forecasts-season-percentile) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:modeling-player-forecasts-season-team-contexts) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-PFC-068 Venue scorer effects (rink counting bias)

- **Match:** Both; Opus PFC-113; Codex modeling-player-forecasts-season-venue-scorer-effects
- **Purpose:** Estimates home-rink multipliers for hits, blocks, takeaways, giveaways
- **Where:** `modeling/player_forecasts/season.py:2630 (_venue_scorer_effects)`; `modeling/player_forecasts/season.py:2630 _venue_scorer_effects`
- **Opus view (PFC-113):**
  - Method: venue rate = (sum values + 500*league rate)/(n + 500); multiplier = clip(venue/league, 0.7..1.3) for HITS, BLOCKED_SHOTS, TAKEAWAYS, GIVEAWAYS
  - Inputs/units: per-game counts; sources: season freeze skaters.jsonl
  - Output scale: multiplier 0.7-1.3; writes: season-artifact.json teams
  - Status: unknown — run manually via `python -m modeling.player_forecasts season-train/season-project` (modeling/player_forecasts/__main__.py:112,130; docs/player-projections/player-forecasts-runbook.md:512-531); bundles imported by web/scripts/import-player-forecast-season.ts (npm import:player-forecast-season) into player_forecast_sea … (full text in the original packet)
  - Consumers: _target_multiplier
- **Codex view (modeling-player-forecasts-season-venue-scorer-effects, symbol_candidate, location; Codex family 'Python forecast research and season models'):** Venue scorer effects (_venue_scorer_effects)
  - Purpose: Venue scorer effects for python forecast research and season models. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: def _venue_scorer_effects(rows: list[dict[str, Any]]) -> dict[int, dict[str, float]]: targets = ("HITS", "BLOCKED_SHOTS", "TAKEAWAYS", "GIVEAWAYS") recent = [ row for row in rows if int(row["season_id"]) == TRAINING_CUTOFF_SEASON and row.get("home_team_id") is not None ] league: dict[s … (full text in the original packet)
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex modeling-player-forecasts-season-venue-scorer-effects): {"source": "modeling/player_forecasts/season.py:2630", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["modeling/player_forecasts/season.py:2640 league[target] = (sum(values) / len(values) if values else 0.0, len(values))", "modeling/player_forecasts/season.py:2657 sum(values) + shrinkage * league_rate", "modeling/player_forecasts/season.py:2658 ) / (len(values) + shrinkage)", "modeling/player_forecasts/season.py:2659 multiplier = max(0.7, min(1.3, venue_rate / league_rate))"]}
  - External references: Rink-bias adjustment (Schuckers; Evolving-Hockey home/away scorer adjustments)
  - Tests: `{"status": "Discovered only; not run", "references": ["No direct symbol/module test reference found in bounded search."]}`
- **Leads (not audited):**
  - (opus) venue rate mixes home and visiting players and is not adjusted for the home team's own style (a physical home team looks like a generous scorer)
  - (codex:modeling-player-forecasts-season-venue-scorer-effects) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-PFC-069 Roster-adjusted team contexts

- **Match:** Both; Opus PFC-114; Codex modeling-player-forecasts-season-roster-adjusted-team-contexts
- **Purpose:** Recomputes team offense/defense/goaltending from projected rosters
- **Where:** `modeling/player_forecasts/season.py:2664 (_roster_adjusted_team_contexts)`; `modeling/player_forecasts/season.py:2664 _roster_adjusted_team_contexts`
- **Opus view (PFC-114):**
  - Method: roster goals = sum p*GOALS; scaled so league mean equals mean projectedGoalsFor; PP = sum p*(PPG+PPA); defense suppression = sum p*supp60*TOI/3600; goalie GA = start-weighted GA; GA = max(0.5, goalieGa - (suppression - league)); multipliers clip 0.65..1.35; ratings percentiles
  - Inputs/units: per-game player rates; probabilities 0-1; per-60 suppression x TOI seconds/3600; sources: season artifact players
  - Output scale: multipliers 0.65-1.35; percentiles 0-100; goals per game; writes: season-artifact.json teams
  - Status: unknown — run manually via `python -m modeling.player_forecasts season-train/season-project` (modeling/player_forecasts/__main__.py:112,130; docs/player-projections/player-forecasts-runbook.md:512-531); bundles imported by web/scripts/import-player-forecast-season.ts (npm import:player-forecast-season) into player_forecast_sea … (full text in the original packet)
  - Consumers: evaluate_season_game multipliers (via golden vectors and release)
- **Codex view (modeling-player-forecasts-season-roster-adjusted-team-contexts, symbol_candidate, location; Codex family 'Python forecast research and season models'):** Roster adjusted team contexts (_roster_adjusted_team_contexts)
  - Purpose: Roster adjusted team contexts for python forecast research and season models. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: def _roster_adjusted_team_contexts( contexts: dict[str, Any], players: dict[str, Any], ) -> dict[str, Any]: by_team: dict[int, list[dict[str, Any]]] = defaultdict(list) for player in players.values(): if player.get("teamId") is not None and player.get("poolStatus") != "excluded": by_te … (full text in the original packet)
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex modeling-player-forecasts-season-roster-adjusted-team-contexts): {"source": "modeling/player_forecasts/season.py:2664", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["modeling/player_forecasts/season.py:2678 roster_goals = sum(", "modeling/player_forecasts/season.py:2683 power_play = sum(", "modeling/player_forecasts/season.py:2691 defense_suppression = sum(", "modeling/player_forecasts/season.py:2695 / 3600.0", "modeling/player_forecasts/season.py:2698 pk_suppression = sum(", "modeling/player_forecasts/season.py:2702 / 3600.0", "modeling/player_forecasts/season.py:2705 start_weight = sum(float(player.get(\"startProbability\") or 0.0) for player in goalies)", "modeling/player_forecasts/season.py:2707 sum("]}
  - Fixtures/test data: `modeling/player_forecasts/tests/test_harness.py`
  - Tests: `modeling/player_forecasts/tests/test_harness.py`; `{"status": "Discovered only; not run", "references": ["modeling/player_forecasts/tests/test_harness.py:2374"]}`
- **Leads (not audited):**
  - (opus) run after player rates are final; offense multiplier then rescales player scoring by roster quality that already came from those players (double counting of team strength into opponent adjustments)
  - (opus) goalie GA is per goalie game, suppression is per-player-game sum - units differ
  - (codex:modeling-player-forecasts-season-roster-adjusted-team-contexts) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-PFC-070 Hierarchical hits (Poisson-Gamma partial pooling)

- **Match:** Both; Opus PFC-115; Codex modeling-player-forecasts-challenger-math-fit-hierarchical-hits, modeling-player-forecasts-challenger-math-hierarchical-hits-prediction, modeling-player-forecasts-challenger-model-fit-line
- **Purpose:** Predicts hits per game using a per-position Gamma prior on hits per TOI second
- **Where:** `modeling/player_forecasts/challenger_math.py:67 (fit_hierarchical_hits)`; `modeling/player_forecasts/challenger_math.py:103 (hierarchical_hits_prediction)`; `modeling/player_forecasts/challenger_model.py:139 (_hits_artifact)`; `modeling/player_forecasts/challenger_math.py:63 fit_hierarchical_hits`; `modeling/player_forecasts … (full text in the original packet)
- **Opus view (PFC-115):**
  - Method: player rate = hits/TOI; position mean and variance of unweighted player rates; Gamma alpha = mean^2/var, beta = mean/var (seconds); posterior rate = (hits + alpha)/(TOI + beta); prediction = rate * projected TOI
  - Inputs/units: hits per TOI second; sources: skaters.jsonl (challenger freeze)
  - Output scale: hits per game; writes: validation-challenger-artifact.json finalDevelopmentHitsArtifact
  - Status: draft — validation-only challenger (CLI build-validation-features/train-validation-challenger, __main__.py:62-67); promotionEligible False; consumed only by the functions inference worker, which is flagged off
  - Consumers: challenger tournament (hits)
- **Codex view (modeling-player-forecasts-challenger-math-fit-hierarchical-hits, symbol_candidate, location; Codex family 'Python forecast research and season models'):** Fit hierarchical hits (fit_hierarchical_hits)
  - Purpose: Fit hierarchical hits for python forecast research and season models. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: def fit_hierarchical_hits(records: Iterable[dict[str, Any]]) -> dict[str, Any]: by_position_player: dict[tuple[str, int], list[float]] = defaultdict(lambda: [0.0, 0.0]) for record in records: exposure = float(record["time_on_ice_seconds"]) if exposure <= 0: continue key = (str(record[" … (full text in the original packet)
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
- **Codex view (modeling-player-forecasts-challenger-math-hierarchical-hits-prediction, symbol_candidate, location; Codex family 'Python forecast research and season models'):** Hierarchical hits prediction (hierarchical_hits_prediction)
  - Purpose: Hierarchical hits prediction for python forecast research and season models. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: def hierarchical_hits_prediction( artifact: dict[str, Any], *, position: str, prior_hits: float, prior_time_on_ice_seconds: float, projected_time_on_ice_seconds: float, ) -> float: prior = artifact.get("priors", {}).get(position) if not prior: raise ValueError("position prior is missin … (full text in the original packet)
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
- **Codex view (modeling-player-forecasts-challenger-model-fit-line, symbol_candidate, location; Codex family 'Python forecast research and season models'):** Fit line (_fit_line)
  - Purpose: Fit line for python forecast research and season models. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: def _fit_line(stats: list[float]) -> tuple[float, float]: count, sum_x, sum_y, sum_xx, sum_xy = stats denominator = count * sum_xx - sum_x * sum_x if count < 2 or abs(denominator) < 1e-12: return 0.0, sum_y / count if count else 0.0 slope = (count * sum_xy - sum_x * sum_y) / denominato … (full text in the original packet)
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
- **Audit context:**
  - Intent (Opus): docs/player-projections/validation-challenger-evidence-2026-08-04.md 'Hits decision' (:81)
  - Intended contract (Codex modeling-player-forecasts-challenger-math-fit-hierarchical-hits): {"source": "modeling/player_forecasts/challenger_math.py:63", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["modeling/player_forecasts/challenger_math.py:74 by_position[position].append((events / exposure, exposure))", "modeling/player_forecasts/challenger_math.py:78 mean = sum(rates) / len(rates)", "modeling/player_forecasts/challenger_math.py:79 variance = sum((rate - mean) ** 2 for rate in rates) / max(1, len(rates) - 1)", "modeling/player_forecasts/challenger_math.py:80 if mean > 0 and variance > 0:", "modeling/player_forecasts/challenger_math.py:81 alpha = mean * mean / variance", "modeling/player_forecasts/challenger_math.py:82 beta = mean / variance"]}
  - Intended contract (Codex modeling-player-forecasts-challenger-math-hierarchical-hits-prediction): {"source": "modeling/player_forecasts/challenger_math.py:99", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["modeling/player_forecasts/challenger_math.py:115 rate = (max(0.0, prior_hits) + float(alpha)) / (", "modeling/player_forecasts/challenger_math.py:118 return rate * max(0.0, projected_time_on_ice_seconds)"]}
  - Intended contract (Codex modeling-player-forecasts-challenger-model-fit-line): {"source": "modeling/player_forecasts/challenger_model.py:132", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["modeling/player_forecasts/challenger_model.py:134 denominator = count * sum_xx - sum_x * sum_x", "modeling/player_forecasts/challenger_model.py:136 return 0.0, sum_y / count if count else 0.0", "modeling/player_forecasts/challenger_model.py:137 slope = (count * sum_xy - sum_x * sum_y) / denominator", "modeling/player_forecasts/challenger_model.py:138 intercept = (sum_y - slope * sum_x) / count"]}
  - External references: Gamma-Poisson conjugate empirical Bayes
  - Fixtures/test data: `modeling/player_forecasts/tests/test_harness.py`
  - Tests: `modeling/player_forecasts/tests/test_harness.py`; `{"status": "Discovered only; not run", "references": ["No direct symbol/module test reference found in bounded search."]}`; `{"status": "Discovered only; not run", "references": ["modeling/player_forecasts/tests/test_harness.py:2345"]}`; `{"status": "Discovered only; not run", … (full text in the original packet)
- **Leads (not audited):**
  - (opus) method-of-moments variance uses unweighted per-player rates, so low-TOI players inflate the variance and weaken the prior (should subtract Poisson noise / weight by exposure)
  - (opus) prior spans all seasons in freeze up to cutoff, mixing eras/rinks
  - (codex:modeling-player-forecasts-challenger-math-fit-hierarchical-hits) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:modeling-player-forecasts-challenger-math-hierarchical-hits-prediction) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:modeling-player-forecasts-challenger-model-fit-line) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-PFC-071 Challenger context OLS and assist routing tournament

- **Match:** Both; Opus PFC-116; Codex modeling-player-forecasts-challenger-model-context-vector, modeling-player-forecasts-challenger-model-fit-line, modeling-player-forecasts-challenger-model-solve-linear, modeling-player-forecasts-challenger-model-train-validation-challenger
- **Purpose:** Fits per-fold linear context models and assist/hits challenger variants, selects winners by MAE
- **Where:** `modeling/player_forecasts/challenger_model.py:37 (_context_vector)`; `modeling/player_forecasts/challenger_model.py:73 (_solve_linear)`; `modeling/player_forecasts/challenger_model.py:131 (_fit_line)`; `modeling/player_forecasts/challenger_model.py:167 (train_validation_challenger)`; `modeling/player_forecasts/challenger_mod … (full text in the original packet)
- **Opus view (PFC-116):**
  - Method: OLS (no ridge) on [1, base, team rate, opponent rate, home, rest_days] fit on horizon-1 rows before fold start; simple linear calibration of play-driver signals; independent A1/A2 component winners; history-adaptive routing (sparse <10 games vs established); winner = min MAE across all candidates over folds; per-horizon losses tracked
  - Inputs/units: per-game rates; home 0/1; rest days; sources: validation-features.jsonl, skaters.jsonl
  - Output scale: per-game expected count; writes: file: validation-challenger-artifact.json
  - Status: draft — validation-only challenger (CLI build-validation-features/train-validation-challenger, __main__.py:62-67); promotionEligible False; consumed only by the functions inference worker, which is flagged off
  - Consumers: challenger_inference.infer_conditional_game; functions/lib/player_forecasts/runtime.py
- **Codex view (modeling-player-forecasts-challenger-model-context-vector, symbol_candidate, codex_part_of_opus; Codex family 'Python forecast research and season models'):** Context vector (_context_vector)
  - Purpose: Context vector for python forecast research and season models. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: def _context_vector(row: dict[str, Any], base_candidate: str) -> list[float] \| None: base = _value(row, base_candidate) position_prior = _value(row, "position_prior") if base is None or position_prior is None: return None features = row["features"] team_rate = features.get("team_posit … (full text in the original packet)
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
- **Codex view (modeling-player-forecasts-challenger-model-fit-line, symbol_candidate, codex_part_of_opus; Codex family 'Python forecast research and season models'):** Fit line (_fit_line)
  - Purpose: Fit line for python forecast research and season models. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: def _fit_line(stats: list[float]) -> tuple[float, float]: count, sum_x, sum_y, sum_xx, sum_xy = stats denominator = count * sum_xx - sum_x * sum_x if count < 2 or abs(denominator) < 1e-12: return 0.0, sum_y / count if count else 0.0 slope = (count * sum_xy - sum_x * sum_y) / denominato … (full text in the original packet)
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
- **Codex view (modeling-player-forecasts-challenger-model-solve-linear, symbol_candidate, codex_part_of_opus; Codex family 'Python forecast research and season models'):** Solve linear (_solve_linear)
  - Purpose: Solve linear for python forecast research and season models. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: def _solve_linear(stats: dict[str, Any]) -> list[float] \| None: if stats["rows"] < CONTEXT_DIMENSIONS: return None matrix = [row[:] + [stats["xty"][index]] for index, row in enumerate(stats["xtx"])] for column in range(CONTEXT_DIMENSIONS): pivot = max(range(column, CONTEXT_DIMENSIONS) … (full text in the original packet)
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
- **Codex view (modeling-player-forecasts-challenger-model-train-validation-challenger, symbol_candidate, codex_part_of_opus; Codex family 'Python forecast research and season models'):** Train validation challenger (train_validation_challenger)
  - Purpose: Train validation challenger for python forecast research and season models. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: def train_validation_challenger(freeze: Path) -> dict[str, Any]: manifest = read_json(freeze / "manifest.json") if manifest.get("contractChecksum") != VALIDATION_CONTRACT_SHA256: raise RuntimeError("validation freeze contract checksum mismatch") feature_path = freeze / str(manifest["va … (full text in the original packet)
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
- **Audit context:**
  - Intent (Opus): docs/player-projections/validation-challenger-evidence-2026-08-04.md 'Development results' (:35)
  - Intended contract (Codex modeling-player-forecasts-challenger-model-context-vector): {"source": "modeling/player_forecasts/challenger_model.py:37", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": []}
  - Intended contract (Codex modeling-player-forecasts-challenger-model-fit-line): {"source": "modeling/player_forecasts/challenger_model.py:132", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["modeling/player_forecasts/challenger_model.py:134 denominator = count * sum_xx - sum_x * sum_x", "modeling/player_forecasts/challenger_model.py:136 return 0.0, sum_y / count if count else 0.0", "modeling/player_forecasts/challenger_model.py:137 slope = (count * sum_xy - sum_x * sum_y) / denominator", "modeling/player_forecasts/challenger_model.py:138 intercept = (sum_y - slope * sum_x) / count"]}
  - Intended contract (Codex modeling-player-forecasts-challenger-model-solve-linear): {"source": "modeling/player_forecasts/challenger_model.py:72", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["modeling/player_forecasts/challenger_model.py:82 matrix[column] = [value / divisor for value in matrix[column]]", "modeling/player_forecasts/challenger_model.py:88 value - factor * pivot_value"]}
  - Intended contract (Codex modeling-player-forecasts-challenger-model-train-validation-challenger): {"source": "modeling/player_forecasts/challenger_model.py:172", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["modeling/player_forecasts/challenger_model.py:173 manifest = read_json(freeze / \"manifest.json\")", "modeling/player_forecasts/challenger_model.py:176 feature_path = freeze / str(manifest[\"validationFeatures\"][\"path\"])", "modeling/player_forecasts/challenger_model.py:179 line_stats: dict[tuple[int, str, str], list[float]] = defaultdict(lambda: [0.0] * 5)", "modeling/player_forecasts/challenger_model.py:237 stats[3] += x * x", "modeling/player_forecasts/challenger_model.py:238 stats[4] += x * y", "modeling/player_forecasts/challenger_model.py:258 choices.append((candidate_stats[0] / candidate_stats[1], candidate))", "modeling/player_forecasts/challenger_model.py:270 (stats[0] / stats[1], candidate)", "modeling/player_forecasts/challenger_model.py:341 record(assists, \"assists\", f\"calibrated_{candidate}\", max(0.0, slope * float(signal) + intercept))"]}
  - Tests: `{"status": "Discovered only; not run", "references": ["No direct symbol/module test reference found in bounded search."]}`
- **Leads (not audited):**
  - (opus) rest_days enters linearly (raw days) rather than as a B2B indicator
  - (opus) unregularized OLS on count outcomes with collinear rate features; predictions clipped at 0
  - (opus) context models trained on horizon-1 rows but applied to horizons 1..10
  - (codex:modeling-player-forecasts-challenger-model-context-vector) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:modeling-player-forecasts-challenger-model-fit-line) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:modeling-player-forecasts-challenger-model-solve-linear) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:modeling-player-forecasts-challenger-model-train-validation-challenger) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-PFC-072 Historical-core candidate tournament, distribution fit and calibration

- **Match:** Both; Opus PFC-117; Codex modeling-player-forecasts-model-calibration, modeling-player-forecasts-model-distribution, modeling-player-forecasts-model-prediction, modeling-player-forecasts-model-quantile, modeling-player-forecasts-model-train-baseline
- **Purpose:** Selects the lowest-MAE feature per population x target and describes its residual distribution
- **Where:** `modeling/player_forecasts/model.py:39 (prediction)`; `modeling/player_forecasts/model.py:57 (_distribution)`; `modeling/player_forecasts/model.py:93 (_calibration)`; `modeling/player_forecasts/model.py:150 (train_baseline)`; `modeling/player_forecasts/model.py:93 _calibration`; `modeling/player_forecasts/model.py:57 _distrib … (full text in the original packet)
- **Opus view (PFC-117):**
  - Method: MAE per candidate (14 candidates); missing candidate falls back to position_prior; distribution: TOI gamma (shape=mean^2/var, scale=var/mean), PIM hurdle zero share, others NB dispersion=mean^2/(var-mean); residual quantile offsets p10..p90 (linear interpolation); coverage of estimate+offsets; calibration OLS slope/intercept of outcome on estimate
  - Inputs/units: per-game outcomes; sources: features.jsonl
  - Output scale: candidate label; MAE; distribution params; writes: file: model-artifact.json
  - Status: draft — historical-core research lockbox pipeline (CLI freeze/seal-for-lockbox/evaluate-lockbox, modeling/player_forecasts/__main__.py:54-94); artifact promotionEligible False (model.py:279)
  - Consumers: scoring.py; lockbox.py; functions/lib/player_forecasts/runtime.py
- **Codex view (modeling-player-forecasts-model-calibration, symbol_candidate, codex_part_of_opus; Codex family 'Python forecast research and season models'):** Calibration (_calibration)
  - Purpose: Calibration for python forecast research and season models. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: def _calibration(pairs: list[tuple[float, float]]) -> dict[str, float \| int \| None]: estimates = [estimate for estimate, _ in pairs] outcomes = [outcome for _, outcome in pairs] estimate_mean = sum(estimates) / len(estimates) outcome_mean = sum(outcomes) / len(outcomes) denominator = … (full text in the original packet)
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
- **Codex view (modeling-player-forecasts-model-distribution, symbol_candidate, codex_part_of_opus; Codex family 'Python forecast research and season models'):** Distribution (_distribution)
  - Purpose: Distribution for python forecast research and season models. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: def _distribution(target: str, pairs: list[tuple[float, float]]) -> dict[str, Any]: estimates = [estimate for estimate, _ in pairs] outcomes = [outcome for _, outcome in pairs] residuals = [outcome - estimate for estimate, outcome in pairs] mean = sum(outcomes) / len(outcomes) variance … (full text in the original packet)
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
- **Codex view (modeling-player-forecasts-model-prediction, symbol_candidate, codex_part_of_opus; Codex family 'Python forecast research and season models'):** Prediction (prediction)
  - Purpose: Prediction for python forecast research and season models. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: def prediction(row: dict[str, Any], candidate: str) -> float \| None: value = row["features"].get(candidate) if value is None and candidate != "position_prior": value = row["features"].get("position_prior") return None if value is None else max(0.0, float(value))
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
- **Codex view (modeling-player-forecasts-model-quantile, symbol_candidate, codex_part_of_opus; Codex family 'Python forecast research and season models'):** Quantile (_quantile)
  - Purpose: Quantile for python forecast research and season models. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: def _quantile(values: list[float], probability: float) -> float \| None: if not values: return None ordered = sorted(values) position = probability * (len(ordered) - 1) lower = math.floor(position) upper = math.ceil(position) if lower == upper: return ordered[lower] weight = position - … (full text in the original packet)
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
- **Codex view (modeling-player-forecasts-model-train-baseline, symbol_candidate, codex_part_of_opus; Codex family 'Python forecast research and season models'):** Train baseline (train_baseline)
  - Purpose: Train baseline for python forecast research and season models. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: def train_baseline(freeze: Path) -> dict[str, Any]: manifest = read_json(freeze / "manifest.json") if manifest.get("contractChecksum") != CONTRACT_SHA256: raise RuntimeError("freeze contract checksum mismatch") losses: dict[tuple[str, str, str], list[float]] = defaultdict(list) fold_lo … (full text in the original packet)
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
- **Audit context:**
  - Intent (Opus): selectionPolicy 'rolling_origin_validation_within_development_window' (model.py); docs/player-projections/development-evidence-2025-26.md
  - Intended contract (Codex modeling-player-forecasts-model-calibration): {"source": "modeling/player_forecasts/model.py:93", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["modeling/player_forecasts/model.py:96 estimate_mean = sum(estimates) / len(estimates)", "modeling/player_forecasts/model.py:97 outcome_mean = sum(outcomes) / len(outcomes)", "modeling/player_forecasts/model.py:98 denominator = sum((value - estimate_mean) ** 2 for value in estimates)", "modeling/player_forecasts/model.py:100 sum((estimate - estimate_mean) * (outcome - outcome_mean) for estimate, outcome in pairs) / denominator", "modeling/player_forecasts/model.py:103 intercept = outcome_mean - slope * estimate_mean if slope is not None else None"]}
  - Intended contract (Codex modeling-player-forecasts-model-distribution): {"source": "modeling/player_forecasts/model.py:57", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["modeling/player_forecasts/model.py:61 mean = sum(outcomes) / len(outcomes)", "modeling/player_forecasts/model.py:62 variance = sum((value - mean) ** 2 for value in outcomes) / max(1, len(outcomes) - 1)", "modeling/player_forecasts/model.py:65 shape = (mean * mean / variance) if variance > 0 else None", "modeling/player_forecasts/model.py:66 parameters = {\"shape\": shape, \"scale\": (variance / mean) if mean > 0 else None}", "modeling/player_forecasts/model.py:70 parameters = {\"zeroProbability\": 1 - len(positive) / len(outcomes)}", "modeling/player_forecasts/model.py:73 dispersion = (mean * mean / (variance - mean)) if variance > mean else None", "modeling/player_forecasts/model.py:76 f\"p{int(probability * 100)}\": _quantile(residuals, probability)", "modeling/player_forecasts/model.py:79 coverage = sum("]}
  - Intended contract (Codex modeling-player-forecasts-model-prediction): {"source": "modeling/player_forecasts/model.py:37", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": []}
  - Intended contract (Codex modeling-player-forecasts-model-quantile): {"source": "modeling/player_forecasts/model.py:44", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["modeling/player_forecasts/model.py:48 position = probability * (len(ordered) - 1)", "modeling/player_forecasts/model.py:54 return ordered[lower] * (1 - weight) + ordered[upper] * weight"]}
  - Intended contract (Codex modeling-player-forecasts-model-train-baseline): {"source": "modeling/player_forecasts/model.py:145", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["modeling/player_forecasts/model.py:146 manifest = read_json(freeze / \"manifest.json\")", "modeling/player_forecasts/model.py:153 for row in read_jsonl(freeze / \"features.jsonl\"):", "modeling/player_forecasts/model.py:174 choices.append((sum(values) / len(values), candidate, len(values)))", "modeling/player_forecasts/model.py:193 sparse_mae = (sum(abs(outcome - estimate) for estimate, outcome in sparse_pairs) / len(sparse_pairs)) if sparse_pairs else None", "modeling/player_forecasts/model.py:195 sum(abs(outcome - estimate) for estimate, outcome in sparse_baseline_pairs) / len(sparse_baseline_pairs)", "modeling/player_forecasts/model.py:210 (sparse_mae - sparse_baseline_mae) / max(abs(sparse_baseline_mae), 1e-12)", "modeling/player_forecasts/model.py:221 \"mae\": (sum(values) / len(values)) if values else None,", "modeling/player_forecasts/model.py:235 winners[target] = {**details, \"defaultPopulation\": population}"]}
  - External references: NB/gamma moment estimators; residual-quantile (empirical) intervals
  - Fixtures/test data: `modeling/player_forecasts/tests/test_harness.py`
  - Tests: `functions/tests/test_player_forecast_inference.py`; `modeling/player_forecasts/tests/test_harness.py`; `{"status": "Discovered only; not run", "references": ["No direct symbol/module test reference found in bounded search."]}`; `{"status": "Discovered only; not run", "references": ["modeling/player_forecasts/tests/test_harness … (full text in the original packet)
- **Leads (not audited):**
  - (opus) NB/gamma parameters fit to marginal outcome distribution, not conditional on prediction
  - (opus) residual offsets and coverage computed on the same pairs - in-sample 80% coverage by construction
  - (opus) folds are not true rolling-origin (features are already leakage-safe but selection uses all folds jointly)
  - (codex:modeling-player-forecasts-model-calibration) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:modeling-player-forecasts-model-distribution) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:modeling-player-forecasts-model-prediction) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:modeling-player-forecasts-model-quantile) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:modeling-player-forecasts-model-train-baseline) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-PFC-073 Recency-decayed weighted summary (per-player mean/variance and population prior)

- **Match:** Both; Opus PFC-118; Codex modeling-player-forecasts-season-weighted-summary
- **Purpose:** Computes recency-weighted per-game means, weights and variances per player and the population prior for a target
- **Where:** `modeling/player_forecasts/season.py:1591 (_season_age)`; `modeling/player_forecasts/season.py:1595 (_weighted_summary)`; `modeling/player_forecasts/season.py:1595 _weighted_summary`
- **Opus view (PFC-118):**
  - Method: weight = decay^(seasons before 2025-26); player mean = sum(w*x)/sum(w); support = sum(w) (weighted games); variance = max(0, E_w[x^2]-mean^2); prior = population weighted mean; rows on/after cutoff excluded; decay chosen from {0.5,0.7,0.85,1.0}
  - Inputs/units: per-game values; season ids; sources: season freeze skaters.jsonl/goalies.jsonl
  - Output scale: per-game mean, weighted games, variance; writes: —
  - Status: unknown — run manually via `python -m modeling.player_forecasts season-train/season-project` (modeling/player_forecasts/__main__.py:112,130; docs/player-projections/player-forecasts-runbook.md:512-531); bundles imported by web/scripts/import-player-forecast-season.ts (npm import:player-forecast-season) into player_forecast_sea … (full text in the original packet)
  - Consumers: _eb_rate; _select_rate_policy; GLM fits; train_season_artifact
- **Codex view (modeling-player-forecasts-season-weighted-summary, symbol_candidate, location; Codex family 'Python forecast research and season models'):** Weighted summary (_weighted_summary)
  - Purpose: Weighted summary for python forecast research and season models. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: def _weighted_summary( rows: Iterable[dict[str, Any]], target: str, decay: float, cutoff_date: str \| None = None, ) -> tuple[dict[int, tuple[float, float, float]], tuple[float, float]]: players: dict[int, list[float]] = defaultdict(lambda: [0.0, 0.0, 0.0]) total = weighted_total = 0.0 … (full text in the original packet)
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED in code; decay grid in docs/player-projections/research-contract-v3-season.json
  - Intended contract (Codex modeling-player-forecasts-season-weighted-summary): {"source": "modeling/player_forecasts/season.py:1595", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["modeling/player_forecasts/season.py:1610 weight = decay ** _season_age(TRAINING_CUTOFF_SEASON, int(row[\"season_id\"]))", "modeling/player_forecasts/season.py:1612 player[0] += value * weight", "modeling/player_forecasts/season.py:1614 player[2] += value * value * weight", "modeling/player_forecasts/season.py:1615 weighted_total += value * weight", "modeling/player_forecasts/season.py:1618 prior = weighted_total / weight_sum if weight_sum else 0.0", "modeling/player_forecasts/season.py:1620 player_id: (values[0] / values[1], values[1], max(0.0, values[2] / values[1] - (values[0] / values[1]) ** 2))"]}
  - External references: Marcel projections (season weights 5/4/3, i.e. ~0.8/0.6 decay); exponential recency weighting
  - Tests: `{"status": "Discovered only; not run", "references": ["No direct symbol/module test reference found in bounded search."]}`
- **Leads (not audited):**
  - (opus) season age is measured against the fixed TRAINING_CUTOFF_SEASON (20252026), not the fold cutoff; within the validation folds 2025-26 rows all get weight 1
  - (opus) weighting is per-game and per-season only - no within-season recency
  - (codex:modeling-player-forecasts-season-weighted-summary) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-PFC-074 v4 exposure-based serving rates (TOI per GP, scoring per TOI) and strength TOI rescale

- **Match:** Both; Opus PFC-119; Codex modeling-player-forecasts-season-weighted-exposure-summary
- **Purpose:** Replaces skater TOI and scoring rates with recency-weighted EB rates from audited season totals
- **Where:** `modeling/player_forecasts/season.py:1625 (_weighted_exposure_summary)`; `modeling/player_forecasts/season.py:3343 (apply_exposure_rate)`; `modeling/player_forecasts/season.py:3388 (TOI rescale and scoring exposures)`; `modeling/player_forecasts/season.py:62 (SKATER_SCORING_EXPOSURES)`; `modeling/player_forecasts/season.py:16 … (full text in the original packet)
- **Opus view (PFC-119):**
  - Method: rate per exposure unit = sum(w*numerator)/sum(w*exposure); support = weighted GP; EB shrink with the target's k (in weighted GP) toward population rate; TOI targets per GP; EV/PP/PK rescaled by TOTAL_TOI/(EV+PP+PK); G/A1/A2 per TOTAL_TOI second, PP G/A per PP_TOI second, SH G/A per PK_TOI second, ENG per GP, times projected exposure; PP_ASSISTS=PP_A1+PP_A2; variance scaled by (new/old)^2 clipped [0.25,4]
  - Inputs/units: season totals; TOI seconds; per-GP and per-TOI-second rates; sources: wgo_skater_stats_totals
  - Output scale: per-game counts and TOI seconds; writes: season-artifact.json
  - Status: unknown — run manually via `python -m modeling.player_forecasts season-train/season-project` (modeling/player_forecasts/__main__.py:112,130; docs/player-projections/player-forecasts-runbook.md:512-531); bundles imported by web/scripts/import-player-forecast-season.ts (npm import:player-forecast-season) into player_forecast_sea … (full text in the original packet)
  - Consumers: evaluate_season_game
- **Codex view (modeling-player-forecasts-season-weighted-exposure-summary, symbol_candidate, location; Codex family 'Python forecast research and season models'):** Weighted exposure summary (_weighted_exposure_summary)
  - Purpose: Weighted exposure summary for python forecast research and season models. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: def _weighted_exposure_summary( rows: Iterable[dict[str, Any]], target: str, exposure_target: str, decay: float, ) -> tuple[dict[int, tuple[float, float, float]], tuple[float, int]]: players: dict[int, list[float]] = defaultdict(lambda: [0.0, 0.0, 0.0]) total_numerator = 0.0 total_expo … (full text in the original packet)
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
- **Audit context:**
  - Intent (Opus): season.py:3373 comment (exposure model authoritative, context disabled); docs/player-projections/season-scoring-model-audit-2026-08-28.md 'Repaired model path' (:42) and 'Strength-state reconciliation' (:76)
  - Intended contract (Codex modeling-player-forecasts-season-weighted-exposure-summary): {"source": "modeling/player_forecasts/season.py:1625", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["modeling/player_forecasts/season.py:1641 weight = decay ** _season_age(", "modeling/player_forecasts/season.py:1647 player[0] += numerator * weight", "modeling/player_forecasts/season.py:1648 player[1] += exposure * weight", "modeling/player_forecasts/season.py:1649 player[2] += float(row.get(\"GAMES_PLAYED\") or 0) * weight", "modeling/player_forecasts/season.py:1650 total_numerator += numerator * weight", "modeling/player_forecasts/season.py:1651 total_exposure += exposure * weight", "modeling/player_forecasts/season.py:1653 prior = total_numerator / total_exposure if total_exposure else 0.0", "modeling/player_forecasts/season.py:1656 values[0] / values[1],"]}
  - External references: NST per-60 rate x projected TOI convention; Marcel
  - Fixtures/test data: `modeling/player_forecasts/tests/test_harness.py`
  - Tests: `modeling/player_forecasts/tests/test_harness.py`; `{"status": "Discovered only; not run", "references": ["modeling/player_forecasts/tests/test_harness.py:2384"]}`
- **Leads (not audited):**
  - (opus) shrinkage k is measured in games but applied to a per-second rate, so a player's support is games while the prior rate is per-second - units mix in the EB weighting
  - (opus) context profile disabled for these targets, so age/rest/venue effects vanish for the main scoring stats in v4
  - (opus) third tuple element is labelled variance in the shared type but holds max(numerator per GP, 0.01)
  - (codex:modeling-player-forecasts-season-weighted-exposure-summary) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-PFC-075 Empirical-Bayes shrinkage rate

- **Match:** Both; Opus PFC-120; Codex modeling-player-forecasts-season-eb-rate, modeling-player-forecasts-season-select-rate-policy, modeling-player-forecasts-season-train-season-artifact
- **Purpose:** Shrinks a player's weighted mean toward the population prior
- **Where:** `modeling/player_forecasts/season.py:1900 (_eb_rate)`; `modeling/player_forecasts/season.py:3251 (train_season_artifact inline)`; `modeling/player_forecasts/season.py:2201 (_select_rate_policy inline)`; `modeling/player_forecasts/season.py:1900 _eb_rate`; `modeling/player_forecasts/season.py:2185 _select_rate_policy`; `modeli … (full text in the original packet)
- **Opus view (PFC-120):**
  - Method: rate = (support*player_mean + k*prior)/(support + k), k chosen from {5,10,20,40} weighted games by chronological MAE (fallback k=20); unseen player gets prior
  - Inputs/units: per-game mean; weighted game counts; sources: —
  - Output scale: per-game rate; writes: —
  - Status: unknown — run manually via `python -m modeling.player_forecasts season-train/season-project` (modeling/player_forecasts/__main__.py:112,130; docs/player-projections/player-forecasts-runbook.md:512-531); bundles imported by web/scripts/import-player-forecast-season.ts (npm import:player-forecast-season) into player_forecast_sea … (full text in the original packet)
  - Consumers: all season rate families; GLM features; exposure model
- **Codex view (modeling-player-forecasts-season-eb-rate, symbol_candidate, location; Codex family 'Python forecast research and season models'):** Eb rate (_eb_rate)
  - Purpose: Eb rate for python forecast research and season models. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: def _eb_rate( summaries: dict[int, tuple[float, float, float]], player_id: int, prior: float, shrinkage: float, ) -> tuple[float, float, float]: player_mean, support, variance = summaries.get( player_id, (prior, 0.0, max(abs(prior), 0.01)), ) return ( (support * player_mean + shrinkage … (full text in the original packet)
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
- **Codex view (modeling-player-forecasts-season-select-rate-policy, symbol_candidate, location; Codex family 'Python forecast research and season models'):** Select rate policy (_select_rate_policy)
  - Purpose: Select rate policy for python forecast research and season models. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: def _select_rate_policy( rows: list[dict[str, Any]], target: str, birth_dates: dict[int, str \| None] \| None = None, ) -> dict[str, Any]: birth_dates = birth_dates or {} best: tuple[float, float, float, int] \| None = None for decay in DECAY_CANDIDATES: for shrink in SHRINK_CANDIDATES … (full text in the original packet)
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
- **Codex view (modeling-player-forecasts-season-train-season-artifact, symbol_candidate, location; Codex family 'Python forecast research and season models'):** Train season artifact (train_season_artifact)
  - Purpose: Train season artifact for python forecast research and season models. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: def train_season_artifact( freeze: Path, output: Path, *, contract_version: str = SEASON_CONTRACT_VERSION, rookie_freeze: Path \| None = None, ) -> dict[str, Any]: manifest = read_json(freeze / "manifest.json") if manifest.get("contractChecksum") != SEASON_CONTRACT_SHA256: raise Runtim … (full text in the original packet)
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED (selection evidence 'empirical_bayes_rate'); docs/player-projections/research-contract-v3-season.json
  - Intended contract (Codex modeling-player-forecasts-season-eb-rate): {"source": "modeling/player_forecasts/season.py:1900", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["modeling/player_forecasts/season.py:1906 player_mean, support, variance = summaries.get(", "modeling/player_forecasts/season.py:1911 (support * player_mean + shrinkage * prior) / (support + shrinkage),", "modeling/player_forecasts/season.py:1913 variance,"]}
  - Intended contract (Codex modeling-player-forecasts-season-select-rate-policy): {"source": "modeling/player_forecasts/season.py:2185", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["modeling/player_forecasts/season.py:2204 estimate = (support * player_mean + shrink * prior) / (support + shrink)", "modeling/player_forecasts/season.py:2206 mae = sum(absolute_errors) / len(absolute_errors) if absolute_errors else math.inf", "modeling/player_forecasts/season.py:2298 glm_mae = sum(glm_errors) / len(glm_errors) if glm_errors else None", "modeling/player_forecasts/season.py:2300 sum(negative_binomial_errors) / len(negative_binomial_errors)", "modeling/player_forecasts/season.py:2303 hurdle_mae = sum(hurdle_errors) / len(hurdle_errors) if hurdle_errors else None", "modeling/player_forecasts/season.py:2320 estimate = (support * player_mean + best[2] * prior) / (support + best[2])", "modeling/player_forecasts/season.py:2324 sum(contextual_errors) / len(contextual_errors)", "modeling/player_forecasts/season.py:2339 sum(baseline_errors) / len(baseline_errors) if baseline_errors else None"]}
  - Intended contract (Codex modeling-player-forecasts-season-train-season-artifact): {"source": "modeling/player_forecasts/season.py:2965", "explicit_comment": "modeling/player_forecasts/season.py:3373 Context profiles are fitted from game-level fields. Once a", "arithmetic_locations": ["modeling/player_forecasts/season.py:2972 manifest = read_json(freeze / \"manifest.json\")", "modeling/player_forecasts/season.py:2997 audit_path = (freeze / str(assist_policy.get(\"auditPath\") or \"\")).resolve()", "modeling/player_forecasts/season.py:3022 freeze / str(metric_policy.get(\"auditPath\") or \"\")", "modeling/player_forecasts/season.py:3048 freeze / str(season_total_policy.get(\"auditPath\") or \"\")", "modeling/player_forecasts/season.py:3056 season_total_path = freeze / \"skater_season_totals.jsonl\"", "modeling/player_forecasts/season.py:3073 skaters = [row for row in read_jsonl(freeze / \"skaters.jsonl\") if int(row[\"season_id\"]) <= TRAINING_CUTOFF_SEASON]", "modeling/player_forecasts/season.py:3074 goalies = [row for row in read_jsonl(freeze / \"goalies.jsonl\") if int(row[\"season_id\"]) <= TRAINING_CUTOFF_SEASON]", "modeling/player_forecasts/season.py:3075 pool = read_json(freeze / \"player-pool.json\")"]}
  - External references: Tango regression to the mean r = n/(n+k); Marcel regression (~1200 PA)
  - Tests: `{"status": "Discovered only; not run", "references": ["No direct symbol/module test reference found in bounded search."]}`; `{"status": "Discovered only; not run", "references": ["modeling/player_forecasts/tests/test_harness.py:2381"]}`
- **Leads (not audited):**
  - (opus) k is a single constant across all players per target and is not tied to the target's between-player variance (no stabilization-point estimate)
  - (codex:modeling-player-forecasts-season-eb-rate) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:modeling-player-forecasts-season-select-rate-policy) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:modeling-player-forecasts-season-train-season-artifact) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-PFC-076 Penalized log-link rate GLM (Poisson IRLS with ridge)

- **Match:** Both; Opus PFC-121; Codex modeling-player-forecasts-season-fit-log-link-ridge, modeling-player-forecasts-season-fit-penalized-rate-glm, modeling-player-forecasts-season-glm-features, modeling-player-forecasts-season-glm-prediction, modeling-player-forecasts-season-solve-ridge-system
- **Purpose:** Challenger that maps EB rate and TOI rate to a per-game mean
- **Where:** `modeling/player_forecasts/season.py:1917 (_glm_features)`; `modeling/player_forecasts/season.py:1927 (_glm_prediction)`; `modeling/player_forecasts/season.py:1942 (_fit_log_link_ridge)`; `modeling/player_forecasts/season.py:1867 (_solve_ridge_system)`; `modeling/player_forecasts/season.py:1994 (_fit_penalized_rate_glm)`; `mo … (full text in the original packet)
- **Opus view (PFC-121):**
  - Method: Features [1, log(eb_rate+1e-6), log1p(toi_rate)] (PLUS_MINUS: [1, eb_rate, log1p(toi)] with weighted least squares); one point per player weighted by support; IRLS up to 12 iterations, working response log(mu)+(y-mu)/mu-log(exposure), weight mu; ridge penalty 10 on non-intercept terms; Gauss-Jordan solve; prediction exp(clamped linear to [-20,20]); needs >=10 players
  - Inputs/units: log per-game rate; log1p TOI seconds per game; sources: season freeze
  - Output scale: per-game expected count (exp link); writes: season-artifact.json selectionEvidence
  - Status: unknown — run manually via `python -m modeling.player_forecasts season-train/season-project` (modeling/player_forecasts/__main__.py:112,130; docs/player-projections/player-forecasts-runbook.md:512-531); bundles imported by web/scripts/import-player-forecast-season.ts (npm import:player-forecast-season) into player_forecast_sea … (full text in the original packet)
  - Consumers: train_season_artifact when modelFamily=penalized_glm
- **Codex view (modeling-player-forecasts-season-fit-log-link-ridge, symbol_candidate, location; Codex family 'Python forecast research and season models'):** Fit log link ridge (_fit_log_link_ridge)
  - Purpose: Fit log link ridge for python forecast research and season models. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: def _fit_log_link_ridge( points: list[tuple[list[float], float, float]], prior: float, variance_family: str = "poisson", ) -> list[float] \| None: if len(points) < 10: return None dimensions = len(points[0][0]) coefficients = [math.log(max(1e-6, prior)), 0.0, 0.0] for _ in range(12): p … (full text in the original packet)
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
- **Codex view (modeling-player-forecasts-season-fit-penalized-rate-glm, symbol_candidate, location; Codex family 'Python forecast research and season models'):** Fit penalized rate glm (_fit_penalized_rate_glm)
  - Purpose: Fit penalized rate glm for python forecast research and season models. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: def _fit_penalized_rate_glm( rows: list[dict[str, Any]], target: str, decay: float, shrinkage: float, cutoff_date: str \| None, ) -> list[float] \| None: summaries, (prior, _) = _weighted_summary(rows, target, decay, cutoff_date) toi_summaries, (toi_prior, _) = _weighted_summary( rows, … (full text in the original packet)
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
- **Codex view (modeling-player-forecasts-season-glm-features, symbol_candidate, codex_part_of_opus; Codex family 'Python forecast research and season models'):** Glm features (_glm_features)
  - Purpose: Glm features for python forecast research and season models. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: def _glm_features(eb_rate: float, toi_rate: float, target: str) -> list[float]: if target == "PLUS_MINUS": return [1.0, eb_rate, math.log1p(max(0.0, toi_rate))] return [ 1.0, math.log(max(1e-6, eb_rate + 1e-6)), math.log1p(max(0.0, toi_rate)), ]
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
- **Codex view (modeling-player-forecasts-season-glm-prediction, symbol_candidate, codex_part_of_opus; Codex family 'Python forecast research and season models'):** Glm prediction (_glm_prediction)
  - Purpose: Glm prediction for python forecast research and season models. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: def _glm_prediction( coefficients: list[float], eb_rate: float, toi_rate: float, target: str, ) -> float: linear = sum( coefficient * feature for coefficient, feature in zip(coefficients, _glm_features(eb_rate, toi_rate, target)) ) if target == "PLUS_MINUS": return linear return math.e … (full text in the original packet)
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
- **Codex view (modeling-player-forecasts-season-solve-ridge-system, symbol_candidate, codex_part_of_opus; Codex family 'Python forecast research and season models'):** Solve ridge system (_solve_ridge_system)
  - Purpose: Solve ridge system for python forecast research and season models. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: def _solve_ridge_system( matrix: list[list[float]], vector: list[float], penalty: float, ) -> list[float] \| None: size = len(vector) augmented = [ [ float(matrix[row][column]) + ( penalty if row == column and column > 0 else 0.0 ) for column in range(size) ] + [float(vector[row])] for … (full text in the original packet)
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED (family name only); docs/player-projections/research-contract-v3-season.json
  - Intended contract (Codex modeling-player-forecasts-season-fit-log-link-ridge): {"source": "modeling/player_forecasts/season.py:1942", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["modeling/player_forecasts/season.py:1954 predicted_rate = math.exp(max(-20.0, min(20.0, sum(", "modeling/player_forecasts/season.py:1955 coefficient * feature", "modeling/player_forecasts/season.py:1964 mean = max(1e-6, exposure * predicted_rate)", "modeling/player_forecasts/season.py:1965 observed = max(0.0, exposure * observed_rate)", "modeling/player_forecasts/season.py:1966 numerator += max(0.0, (observed - mean) ** 2 - mean)", "modeling/player_forecasts/season.py:1967 denominator += mean * mean", "modeling/player_forecasts/season.py:1968 dispersion = max(1e-6, min(10.0, numerator / denominator)) if denominator else 1e-6", "modeling/player_forecasts/season.py:1969 matrix = [[0.0] * dimensions for _ in range(dimensions)]"]}
  - Intended contract (Codex modeling-player-forecasts-season-fit-penalized-rate-glm): {"source": "modeling/player_forecasts/season.py:1994", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["modeling/player_forecasts/season.py:2020 matrix = [[0.0] * dimensions for _ in range(dimensions)]", "modeling/player_forecasts/season.py:2021 vector = [0.0] * dimensions", "modeling/player_forecasts/season.py:2024 vector[left] += weight * features[left] * observed_rate", "modeling/player_forecasts/season.py:2026 matrix[left][right] += weight * features[left] * features[right]"]}
  - Intended contract (Codex modeling-player-forecasts-season-glm-features): {"source": "modeling/player_forecasts/season.py:1917", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": []}
  - Intended contract (Codex modeling-player-forecasts-season-glm-prediction): {"source": "modeling/player_forecasts/season.py:1927", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["modeling/player_forecasts/season.py:1933 linear = sum(", "modeling/player_forecasts/season.py:1934 coefficient * feature"]}
  - Intended contract (Codex modeling-player-forecasts-season-solve-ridge-system): {"source": "modeling/player_forecasts/season.py:1867", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["modeling/player_forecasts/season.py:1888 augmented[column] = [value / divisor for value in augmented[column]]", "modeling/player_forecasts/season.py:1894 augmented[row][index] - factor * augmented[column][index]"]}
  - External references: Poisson GLM via IRLS; ridge GLM conventions (standardized features before penalization)
  - Fixtures/test data: `modeling/player_forecasts/tests/test_harness.py`
  - Tests: `modeling/player_forecasts/tests/test_harness.py`; `{"status": "Discovered only; not run", "references": ["No direct symbol/module test reference found in bounded search."]}`; `{"status": "Discovered only; not run", "references": ["modeling/player_forecasts/tests/test_harness.py:2367"]}`; `{"status": "Discovered only; not run", … (full text in the original packet)
- **Leads (not audited):**
  - (opus) features include the EB-shrunk version of the same player mean that is the response (fit in-sample on the same rows), a circular regression
  - (opus) ridge penalty 10 applied to unstandardized log features, so effective shrinkage depends on feature scale
  - (opus) working response subtracts log(exposure) although mean already = exposure*rate - check the offset algebra
  - (codex:modeling-player-forecasts-season-fit-log-link-ridge) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:modeling-player-forecasts-season-fit-penalized-rate-glm) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:modeling-player-forecasts-season-glm-features) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:modeling-player-forecasts-season-glm-prediction) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:modeling-player-forecasts-season-solve-ridge-system) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-PFC-077 Regularized negative-binomial GLM

- **Match:** Both; Opus PFC-122; Codex modeling-player-forecasts-season-fit-log-link-ridge, modeling-player-forecasts-season-fit-penalized-negative-binomial-glm
- **Purpose:** Over-dispersed challenger for count targets
- **Where:** `modeling/player_forecasts/season.py:2031 (_fit_penalized_negative_binomial_glm)`; `modeling/player_forecasts/season.py:1957 (_fit_log_link_ridge negative_binomial branch)`; `modeling/player_forecasts/season.py:1942 _fit_log_link_ridge`; `modeling/player_forecasts/season.py:2031 _fit_penalized_negative_binomial_glm`
- **Opus view (PFC-122):**
  - Method: Same IRLS but per-iteration method-of-moments dispersion alpha = sum(max(0,(y-mu)^2-mu))/sum(mu^2) clipped [1e-6,10]; IRLS weight mu/(1+alpha*mu); targets = nonnegative counts excluding GP/GS/TOI
  - Inputs/units: same as Poisson GLM; sources: season freeze
  - Output scale: per-game expected count; dispersion 1e-6..10; writes: season-artifact.json
  - Status: unknown — run manually via `python -m modeling.player_forecasts season-train/season-project` (modeling/player_forecasts/__main__.py:112,130; docs/player-projections/player-forecasts-runbook.md:512-531); bundles imported by web/scripts/import-player-forecast-season.ts (npm import:player-forecast-season) into player_forecast_sea … (full text in the original packet)
  - Consumers: train_season_artifact
- **Codex view (modeling-player-forecasts-season-fit-log-link-ridge, symbol_candidate, location; Codex family 'Python forecast research and season models'):** Fit log link ridge (_fit_log_link_ridge)
  - Purpose: Fit log link ridge for python forecast research and season models. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: def _fit_log_link_ridge( points: list[tuple[list[float], float, float]], prior: float, variance_family: str = "poisson", ) -> list[float] \| None: if len(points) < 10: return None dimensions = len(points[0][0]) coefficients = [math.log(max(1e-6, prior)), 0.0, 0.0] for _ in range(12): p … (full text in the original packet)
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
- **Codex view (modeling-player-forecasts-season-fit-penalized-negative-binomial-glm, symbol_candidate, location; Codex family 'Python forecast research and season models'):** Fit penalized negative binomial glm (_fit_penalized_negative_binomial_glm)
  - Purpose: Fit penalized negative binomial glm for python forecast research and season models. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: def _fit_penalized_negative_binomial_glm( rows: list[dict[str, Any]], target: str, decay: float, shrinkage: float, cutoff_date: str \| None, ) -> list[float] \| None: if target not in NEGATIVE_BINOMIAL_TARGETS: return None summaries, (prior, _) = _weighted_summary(rows, target, decay, … (full text in the original packet)
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED; docs/player-projections/research-contract-v4-season-fantasy.json modeling
  - Intended contract (Codex modeling-player-forecasts-season-fit-log-link-ridge): {"source": "modeling/player_forecasts/season.py:1942", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["modeling/player_forecasts/season.py:1954 predicted_rate = math.exp(max(-20.0, min(20.0, sum(", "modeling/player_forecasts/season.py:1955 coefficient * feature", "modeling/player_forecasts/season.py:1964 mean = max(1e-6, exposure * predicted_rate)", "modeling/player_forecasts/season.py:1965 observed = max(0.0, exposure * observed_rate)", "modeling/player_forecasts/season.py:1966 numerator += max(0.0, (observed - mean) ** 2 - mean)", "modeling/player_forecasts/season.py:1967 denominator += mean * mean", "modeling/player_forecasts/season.py:1968 dispersion = max(1e-6, min(10.0, numerator / denominator)) if denominator else 1e-6", "modeling/player_forecasts/season.py:1969 matrix = [[0.0] * dimensions for _ in range(dimensions)]"]}
  - Intended contract (Codex modeling-player-forecasts-season-fit-penalized-negative-binomial-glm): {"source": "modeling/player_forecasts/season.py:2031", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": []}
  - External references: NB2 GLM (Cameron-Trivedi moment estimator)
  - Fixtures/test data: `modeling/player_forecasts/tests/test_harness.py`
  - Tests: `modeling/player_forecasts/tests/test_harness.py`; `{"status": "Discovered only; not run", "references": ["No direct symbol/module test reference found in bounded search."]}`; `{"status": "Discovered only; not run", "references": ["modeling/player_forecasts/tests/test_harness.py:2366"]}`
- **Leads (not audited):**
  - (opus) dispersion estimated on player-level aggregated means times support rather than per-game counts, so alpha mixes between-player and within-player variance
  - (opus) selection is still by MAE, so NB's distributional advantage is not what is scored
  - (codex:modeling-player-forecasts-season-fit-log-link-ridge) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:modeling-player-forecasts-season-fit-penalized-negative-binomial-glm) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-PFC-078 Decay/shrinkage grid search by chronological MAE

- **Match:** Both; Opus PFC-123; Codex modeling-player-forecasts-season-select-rate-policy
- **Purpose:** Selects decay and shrinkage per population x target
- **Where:** `modeling/player_forecasts/season.py:2185 (_select_rate_policy)`; `modeling/player_forecasts/season.py:74 (DECAY_CANDIDATES, SHRINK_CANDIDATES, VALIDATION_FOLDS)`; `modeling/player_forecasts/season.py:2185 _select_rate_policy`
- **Opus view (PFC-123):**
  - Method: For 4 decays x 4 shrinkages: for each of 3 folds (2025-11-01..12-15, 12-16..02-15, 02-16..04-16) fit summaries on rows before fold start, predict each 2025-26 game row in fold with EB rate, collect absolute errors; pick lexicographic min (MAE, decay, shrink)
  - Inputs/units: per-game absolute errors; sources: season freeze
  - Output scale: decay 0-1; shrinkage in weighted games; MAE in target units; writes: selectionEvidence in season-artifact.json
  - Status: unknown — run manually via `python -m modeling.player_forecasts season-train/season-project` (modeling/player_forecasts/__main__.py:112,130; docs/player-projections/player-forecasts-runbook.md:512-531); bundles imported by web/scripts/import-player-forecast-season.ts (npm import:player-forecast-season) into player_forecast_sea … (full text in the original packet)
  - Consumers: train_season_artifact
- **Codex view (modeling-player-forecasts-season-select-rate-policy, symbol_candidate, location; Codex family 'Python forecast research and season models'):** Select rate policy (_select_rate_policy)
  - Purpose: Select rate policy for python forecast research and season models. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: def _select_rate_policy( rows: list[dict[str, Any]], target: str, birth_dates: dict[int, str \| None] \| None = None, ) -> dict[str, Any]: birth_dates = birth_dates or {} best: tuple[float, float, float, int] \| None = None for decay in DECAY_CANDIDATES: for shrink in SHRINK_CANDIDATES … (full text in the original packet)
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
- **Audit context:**
  - Intent (Opus): VALIDATION_FOLDS / chronological selection: docs/player-projections/research-contract-v3-season.json; limitation '2025-26 is training and validation evidence, not a new blind test' (season.py:3894)
  - Intended contract (Codex modeling-player-forecasts-season-select-rate-policy): {"source": "modeling/player_forecasts/season.py:2185", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["modeling/player_forecasts/season.py:2204 estimate = (support * player_mean + shrink * prior) / (support + shrink)", "modeling/player_forecasts/season.py:2206 mae = sum(absolute_errors) / len(absolute_errors) if absolute_errors else math.inf", "modeling/player_forecasts/season.py:2298 glm_mae = sum(glm_errors) / len(glm_errors) if glm_errors else None", "modeling/player_forecasts/season.py:2300 sum(negative_binomial_errors) / len(negative_binomial_errors)", "modeling/player_forecasts/season.py:2303 hurdle_mae = sum(hurdle_errors) / len(hurdle_errors) if hurdle_errors else None", "modeling/player_forecasts/season.py:2320 estimate = (support * player_mean + best[2] * prior) / (support + best[2])", "modeling/player_forecasts/season.py:2324 sum(contextual_errors) / len(contextual_errors)", "modeling/player_forecasts/season.py:2339 sum(baseline_errors) / len(baseline_errors) if baseline_errors else None"]}
  - External references: rolling-origin time-series cross-validation
  - Fixtures/test data: `modeling/player_forecasts/tests/test_harness.py`
  - Tests: `modeling/player_forecasts/tests/test_harness.py`; `{"status": "Discovered only; not run", "references": ["modeling/player_forecasts/tests/test_harness.py:2381"]}`
- **Leads (not audited):**
  - (opus) MAE on zero-heavy count targets is minimized by the median, which biases selection toward heavier shrinkage/lower means for goals, PIM, etc.; a proper scoring rule for means (MSE/Poisson deviance) would be standard
  - (opus) the same folds are used for hyperparameter search, model selection and reported validationMae - reported loss is optimistic
  - (codex:modeling-player-forecasts-season-select-rate-policy) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-PFC-079 Season model tournament and minimum-lift rule

- **Match:** Both; Opus PFC-124; Codex modeling-player-forecasts-season-select-rate-policy
- **Purpose:** Chooses among population_rate, empirical_bayes_rate, penalized_glm, NB GLM, hurdle GLM and contextual EB per target
- **Where:** `modeling/player_forecasts/season.py:2341 (_select_rate_policy candidate selection)`; `modeling/player_forecasts/season.py:76 (MINIMUM_CHALLENGER_LIFT)`; `modeling/player_forecasts/season.py:2185 _select_rate_policy`
- **Opus view (PFC-124):**
  - Method: population baseline MAE uses decay 1.0 prior; challenger accepted only if it has the same row count as EB; pick min MAE; if a non-baseline wins but 1 - MAE/baseline_MAE < 0.001, revert to best baseline; chronologicalLift = 1 - selected/baseline; final coefficients refit on all rows (cutoff None)
  - Inputs/units: MAE in target units; sources: season freeze
  - Output scale: model family label; lift fraction; writes: season-artifact.json selectionEvidence, training-report.json
  - Status: unknown — run manually via `python -m modeling.player_forecasts season-train/season-project` (modeling/player_forecasts/__main__.py:112,130; docs/player-projections/player-forecasts-runbook.md:512-531); bundles imported by web/scripts/import-player-forecast-season.ts (npm import:player-forecast-season) into player_forecast_sea … (full text in the original packet)
  - Consumers: train_season_artifact; evaluate_fantasy_batch
- **Codex view (modeling-player-forecasts-season-select-rate-policy, symbol_candidate, location; Codex family 'Python forecast research and season models'):** Select rate policy (_select_rate_policy)
  - Purpose: Select rate policy for python forecast research and season models. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: def _select_rate_policy( rows: list[dict[str, Any]], target: str, birth_dates: dict[int, str \| None] \| None = None, ) -> dict[str, Any]: birth_dates = birth_dates or {} best: tuple[float, float, float, int] \| None = None for decay in DECAY_CANDIDATES: for shrink in SHRINK_CANDIDATES … (full text in the original packet)
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
- **Audit context:**
  - Intent (Opus): artifact review challengerFallbackPolicy 'baseline_is_served_when_no_valid_challenger_exists' (season.py:3765); docs/player-projections/research-contract-v4-season-fantasy.json evaluation
  - Intended contract (Codex modeling-player-forecasts-season-select-rate-policy): {"source": "modeling/player_forecasts/season.py:2185", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["modeling/player_forecasts/season.py:2204 estimate = (support * player_mean + shrink * prior) / (support + shrink)", "modeling/player_forecasts/season.py:2206 mae = sum(absolute_errors) / len(absolute_errors) if absolute_errors else math.inf", "modeling/player_forecasts/season.py:2298 glm_mae = sum(glm_errors) / len(glm_errors) if glm_errors else None", "modeling/player_forecasts/season.py:2300 sum(negative_binomial_errors) / len(negative_binomial_errors)", "modeling/player_forecasts/season.py:2303 hurdle_mae = sum(hurdle_errors) / len(hurdle_errors) if hurdle_errors else None", "modeling/player_forecasts/season.py:2320 estimate = (support * player_mean + best[2] * prior) / (support + best[2])", "modeling/player_forecasts/season.py:2324 sum(contextual_errors) / len(contextual_errors)", "modeling/player_forecasts/season.py:2339 sum(baseline_errors) / len(baseline_errors) if baseline_errors else None"]}
  - Fixtures/test data: `modeling/player_forecasts/tests/test_harness.py`
  - Tests: `modeling/player_forecasts/tests/test_harness.py`; `{"status": "Discovered only; not run", "references": ["modeling/player_forecasts/tests/test_harness.py:2381"]}`
- **Leads (not audited):**
  - (opus) 0.1% minimum lift is tiny relative to fold noise; no paired significance test
  - (opus) 2025-26 data is both selection and validation evidence (acknowledged in limitations)
  - (codex:modeling-player-forecasts-season-select-rate-policy) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-PFC-080 Regularized hurdle GLM (logistic positive-probability x log-link positive mean)

- **Match:** Both; Opus PFC-127; Codex modeling-player-forecasts-season-fit-regularized-hurdle-glm, modeling-player-forecasts-season-hurdle-prediction
- **Purpose:** Zero-inflated challenger for sparse targets (PIM, penalties, GWG, OTG, ENG, SH points, shutouts, quality starts)
- **Where:** `modeling/player_forecasts/season.py:57 (HURDLE_TARGETS)`; `modeling/player_forecasts/season.py:2061 (_sigmoid)`; `modeling/player_forecasts/season.py:2066 (_hurdle_prediction)`; `modeling/player_forecasts/season.py:2084 (_fit_regularized_hurdle_glm)`; `modeling/player_forecasts/season.py:2084 _fit_regularized_hurdle_glm`; `m … (full text in the original packet)
- **Opus view (PFC-127):**
  - Method: P(y>0) via weighted logistic IRLS (12 iters, ridge 10, init logit of population share, weight exposure*p(1-p)); positive mean via _fit_log_link_ridge on players with positives; prediction = sigmoid(...) * exp(...)
  - Inputs/units: per-game counts; positive-game share 0-1; sources: season freeze
  - Output scale: per-game expected count = P(>0) x positive mean; writes: season-artifact.json
  - Status: unknown — run manually via `python -m modeling.player_forecasts season-train/season-project` (modeling/player_forecasts/__main__.py:112,130; docs/player-projections/player-forecasts-runbook.md:512-531); bundles imported by web/scripts/import-player-forecast-season.ts (npm import:player-forecast-season) into player_forecast_sea … (full text in the original packet)
  - Consumers: train_season_artifact
- **Codex view (modeling-player-forecasts-season-fit-regularized-hurdle-glm, symbol_candidate, location; Codex family 'Python forecast research and season models'):** Fit regularized hurdle glm (_fit_regularized_hurdle_glm)
  - Purpose: Fit regularized hurdle glm for python forecast research and season models. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: def _fit_regularized_hurdle_glm( rows: list[dict[str, Any]], target: str, decay: float, shrinkage: float, cutoff_date: str \| None, ) -> dict[str, list[float]] \| None: if target not in HURDLE_TARGETS: return None summaries, (prior, _) = _weighted_summary(rows, target, decay, cutoff_da … (full text in the original packet)
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
- **Codex view (modeling-player-forecasts-season-hurdle-prediction, symbol_candidate, location; Codex family 'Python forecast research and season models'):** Hurdle prediction (_hurdle_prediction)
  - Purpose: Hurdle prediction for python forecast research and season models. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: def _hurdle_prediction( coefficients: dict[str, list[float]], eb_rate: float, toi_rate: float, target: str, ) -> float: features = _glm_features(eb_rate, toi_rate, target) positive_probability = _sigmoid(sum( coefficient * feature for coefficient, feature in zip(coefficients["probabili … (full text in the original packet)
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED; HURDLE_TARGETS season.py:57; docs/player-projections/research-contract-v4-season-fantasy.json
  - Intended contract (Codex modeling-player-forecasts-season-fit-regularized-hurdle-glm): {"source": "modeling/player_forecasts/season.py:2084", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["modeling/player_forecasts/season.py:2107 weight = decay ** _season_age(TRAINING_CUTOFF_SEASON, int(row[\"season_id\"]))", "modeling/player_forecasts/season.py:2112 outcomes[player_id][2] += weight * value", "modeling/player_forecasts/season.py:2114 total_weight = sum(values[0] for values in outcomes.values())", "modeling/player_forecasts/season.py:2115 positive_weight = sum(values[1] for values in outcomes.values())", "modeling/player_forecasts/season.py:2116 population_probability = positive_weight / total_weight if total_weight else 0.01", "modeling/player_forecasts/season.py:2118 sum(values[2] for values in outcomes.values()) / positive_weight", "modeling/player_forecasts/season.py:2129 positives / exposure,", "modeling/player_forecasts/season.py:2130 positive_total / positives if positives else population_positive_mean,"]}
  - Intended contract (Codex modeling-player-forecasts-season-hurdle-prediction): {"source": "modeling/player_forecasts/season.py:2066", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["modeling/player_forecasts/season.py:2073 positive_probability = _sigmoid(sum(", "modeling/player_forecasts/season.py:2074 coefficient * feature", "modeling/player_forecasts/season.py:2077 positive_mean = math.exp(max(-20.0, min(20.0, sum(", "modeling/player_forecasts/season.py:2078 coefficient * feature", "modeling/player_forecasts/season.py:2081 return positive_probability * positive_mean"]}
  - External references: hurdle Poisson/NB models (Mullahy 1986)
  - Fixtures/test data: `modeling/player_forecasts/tests/test_harness.py`
  - Tests: `modeling/player_forecasts/tests/test_harness.py`; `{"status": "Discovered only; not run", "references": ["modeling/player_forecasts/tests/test_harness.py:2368"]}`; `{"status": "Discovered only; not run", "references": ["modeling/player_forecasts/tests/test_harness.py:2370"]}`
- **Leads (not audited):**
  - (opus) QUALITY_STARTS_GOALIE and SHUTOUTS are binary per game; a hurdle positive-mean component is redundant
  - (opus) same in-sample circular features as the Poisson GLM
  - (codex:modeling-player-forecasts-season-fit-regularized-hurdle-glm) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:modeling-player-forecasts-season-hurdle-prediction) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-PFC-081 FORGE walk-forward blocked-shots pilot: methods A/B/C and bands

- **Match:** Both; Opus PFC-129; Codex modeling-player-forecasts-forge-walk-forward-native-estimates, modeling-player-forecasts-forge-walk-forward-predict
- **Purpose:** Prospective per-game blocked-shots forecasts comparing native FORGE (A), all-history mean (B) and last-5 mean (C)
- **Where:** `modeling/player_forecasts/forge_walk_forward.py:275 (eligible_history)`; `modeling/player_forecasts/forge_walk_forward.py:302 (native_estimates)`; `modeling/player_forecasts/forge_walk_forward.py:335 (quantile)`; `modeling/player_forecasts/forge_walk_forward.py:341 (predict)`; `modeling/player_forecasts/forge_walk_forward.py … (full text in the original packet)
- **Opus view (PFC-129):**
  - Method: A = native FORGE mean (policy: previous 82 appearances, recent 20, decay 0.9, prior weight 20); B = mean of all eligible history; C = mean of last 5; no history -> pooled mean; bands = nearest-rank P10/P90 of individual values (pooled if N<5); season inferred from cutoff date (< 2026-07-01 -> 2025-26)
  - Inputs/units: BLK counts per positive-TOI game; Eastern dates; sources: NHL boxscore captures (private root /Users/tim/Documents/FHFH-private/...)
  - Output scale: per-game BLK mean; nearest-rank p10/p90; writes: file: predictions/*.json in private root
  - Status: draft — finite private pilot (modeling/player_forecasts/forge_walk_forward.py:1 'No database, serving, or production integration'); readout 2026-10-28; promotionEligible False; own CLI main() at :1022
  - Consumers: select_method; final_report
- **Codex view (modeling-player-forecasts-forge-walk-forward-native-estimates, symbol_candidate, location; Codex family 'Python forecast research and season models'):** Native estimates (native_estimates)
  - Purpose: Native estimates for python forecast research and season models. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: def native_estimates(history: list[dict], candidates: list[dict], cutoff_at: str, mode: str) -> dict[int, dict]: if not candidates: return {} groups = defaultdict(list) for row in history: groups[row["playerId"]].append(row["appearance"]) players = [{"playerId": c["playerId"], "nhlPlay … (full text in the original packet)
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
- **Codex view (modeling-player-forecasts-forge-walk-forward-predict, symbol_candidate, location; Codex family 'Python forecast research and season models'):** Predict (predict)
  - Purpose: Predict for python forecast research and season models. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: def predict(history: list[dict], candidates: list[dict], cutoff_at: str, *, mode="prospective", methods=METHODS, native: Callable = native_estimates, maximum_day: str \| None = None) -> list[dict]: if not methods or any(m not in METHODS for m in methods) or len(set(methods)) != len(met … (full text in the original packet)
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
- **Audit context:**
  - Intent (Opus): forge_walk_forward.py:1 docstring and POLICY (:47); tasks/prd-forge-daily-pipeline.md
  - Intended contract (Codex modeling-player-forecasts-forge-walk-forward-native-estimates): {"source": "modeling/player_forecasts/forge_walk_forward.py:302", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": []}
  - Intended contract (Codex modeling-player-forecasts-forge-walk-forward-predict): {"source": "modeling/player_forecasts/forge_walk_forward.py:341", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["modeling/player_forecasts/forge_walk_forward.py:360 sum(row[\"value\"] for row in support) / len(support) if support else None)", "modeling/player_forecasts/forge_walk_forward.py:363 mean = sum(pooled) / len(pooled) if pooled else None", "modeling/player_forecasts/forge_walk_forward.py:373 current_n = sum(row[\"seasonId\"] == season for row in individual)", "modeling/player_forecasts/forge_walk_forward.py:375 result.append({**candidate, \"cutoffAt\": cutoff_at, \"mode\": mode, \"estimates\": estimates,"]}
  - External references: walk-forward (prospective) evaluation
  - Fixtures/test data: `modeling/player_forecasts/tests/test_harness.py`
  - Tests: `modeling/player_forecasts/tests/test_harness.py`; `{"status": "Discovered only; not run", "references": ["No direct symbol/module test reference found in bounded search."]}`; `{"status": "Discovered only; not run", "references": ["modeling/player_forecasts/tests/test_harness.py:4185", "web/__tests__/pages/api/v1/ml/update-pred … (full text in the original packet)
- **Leads (not audited):**
  - (opus) hard-coded private absolute path, cohort IDs and dates
  - (opus) bands are descriptive and uncalibrated (acknowledged)
  - (codex:modeling-player-forecasts-forge-walk-forward-native-estimates) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:modeling-player-forecasts-forge-walk-forward-predict) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-PFC-082 FORGE walk-forward selection, pair regret and cluster bootstrap

- **Match:** Both; Opus PFC-130; Codex modeling-player-forecasts-forge-walk-forward-cluster-difference, modeling-player-forecasts-forge-walk-forward-metrics, modeling-player-forecasts-forge-walk-forward-select-method
- **Purpose:** Selects a method by adaptive MAE and reports paired improvements
- **Where:** `modeling/player_forecasts/forge_walk_forward.py:384 (metrics)`; `modeling/player_forecasts/forge_walk_forward.py:392 (select_method)`; `modeling/player_forecasts/forge_walk_forward.py:718 (freeze_pairs)`; `modeling/player_forecasts/forge_walk_forward.py:876 (cluster_difference)`; `modeling/player_forecasts/forge_walk_forward … (full text in the original packet)
- **Opus view (PFC-130):**
  - Method: MAE, RMSE, bias (prediction - observation); select min MAE with A-covered rows, ties A,B,C; same-position pairs: choose higher predicted, regret = max observed - chosen observed; cluster bootstrap by game or slate, 1000 draws seed 20261014, 95% interval of mean loss reduction; descriptive band coverage
  - Inputs/units: BLK prediction/outcome pairs; sources: private walk-forward root
  - Output scale: MAE/RMSE/bias in blocks; regret in blocks; 95% bootstrap bounds; writes: file: reports/final-report.json
  - Status: draft — finite private pilot (modeling/player_forecasts/forge_walk_forward.py:1 'No database, serving, or production integration'); readout 2026-10-28; promotionEligible False; own CLI main() at :1022
  - Consumers: research review
- **Codex view (modeling-player-forecasts-forge-walk-forward-cluster-difference, symbol_candidate, location; Codex family 'Python forecast research and season models'):** Cluster difference (cluster_difference)
  - Purpose: Cluster difference for python forecast research and season models. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: def cluster_difference(rows: list[tuple[str, int, float]], unit: str) -> dict: groups = defaultdict(list) for day, game, difference in rows: groups[day if unit == "slate" else (day, game)].append(difference) if len(groups) < 2: return {"units": len(groups), "interval": None, "reason": … (full text in the original packet)
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
- **Codex view (modeling-player-forecasts-forge-walk-forward-metrics, symbol_candidate, location; Codex family 'Python forecast research and season models'):** Metrics (metrics)
  - Purpose: Metrics for python forecast research and season models. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: def metrics(pairs: list[tuple[float, float]]) -> dict: if not pairs: return {"rows": 0, "mae": None, "rmse": None, "bias": None} errors = [p - y for p, y in pairs] return {"rows": len(errors), "mae": sum(abs(e) for e in errors) / len(errors), "rmse": math.sqrt(sum(e * e for e in errors … (full text in the original packet)
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
- **Codex view (modeling-player-forecasts-forge-walk-forward-select-method, symbol_candidate, location; Codex family 'Python forecast research and season models'):** Select method (select_method)
  - Purpose: Select method for python forecast research and season models. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: def select_method(rows: list[dict], labels: list[dict], cutoff_at: str) -> dict: cutoff = stamp(cutoff_at) indexed, seen = {}, set() for label in labels: key = label["playerId"], label["gameId"] if key in seen: raise ValueError("duplicate selection outcome") seen.add(key) if ("2026-10- … (full text in the original packet)
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
- **Audit context:**
  - Intent (Opus): POLICY selection/pairs/clusterBootstrap (forge_walk_forward.py:47-60)
  - Intended contract (Codex modeling-player-forecasts-forge-walk-forward-cluster-difference): {"source": "modeling/player_forecasts/forge_walk_forward.py:876", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["modeling/player_forecasts/forge_walk_forward.py:887 samples.append(sum(sum(v) for v in sampled) / sum(len(v) for v in sampled))", "modeling/player_forecasts/forge_walk_forward.py:888 return {\"units\": len(values), \"meanLossReduction\": sum(sum(v) for v in values) / sum(len(v) for v in values),"]}
  - Intended contract (Codex modeling-player-forecasts-forge-walk-forward-metrics): {"source": "modeling/player_forecasts/forge_walk_forward.py:384", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["modeling/player_forecasts/forge_walk_forward.py:388 return {\"rows\": len(errors), \"mae\": sum(abs(e) for e in errors) / len(errors),", "modeling/player_forecasts/forge_walk_forward.py:389 \"rmse\": math.sqrt(sum(e * e for e in errors) / len(errors)), \"bias\": sum(errors) / len(errors)}"]}
  - Intended contract (Codex modeling-player-forecasts-forge-walk-forward-select-method): {"source": "modeling/player_forecasts/forge_walk_forward.py:392", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["modeling/player_forecasts/forge_walk_forward.py:417 missing = sum(row[\"estimates\"].get(method, {}).get(\"mean\") is None for row, _ in eligible)", "modeling/player_forecasts/forge_walk_forward.py:420 reports[method] = {**metrics(pairs if missing == 0 else []), \"eligible\": missing == 0,"]}
  - External references: cluster bootstrap; pairwise ranking regret
  - Fixtures/test data: `modeling/player_forecasts/tests/test_harness.py`
  - Tests: `modeling/player_forecasts/tests/test_harness.py`; `{"status": "Discovered only; not run", "references": ["modeling/player_forecasts/tests/test_harness.py:2686", "web/__tests__/components/CronReportEmail/CronAuditEmail.test.tsx:107", "web/__tests__/components/DraftDashboard/ProjectionsTable.test.tsx:210", "web/__tests__/compone … (full text in the original packet)
- **Leads (not audited):**
  - (opus) 17 players, two windows - very small dependent sample (acknowledged)
  - (codex:modeling-player-forecasts-forge-walk-forward-cluster-difference) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:modeling-player-forecasts-forge-walk-forward-metrics) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]
  - (codex:modeling-player-forecasts-forge-walk-forward-select-method) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-PFC-083 Player forecast validation inference context (rest days, home indicator)

- **Match:** Opus only; Opus PFC-002; Codex —
- **Purpose:** Derive rest days and home/away indicator for a target game when building validation-contract feature snapshots.
- **Where:** `web/lib/player-forecasts/serving.ts:314 (homeIndicator)`; `web/lib/player-forecasts/serving.ts:327 (restDays)`; `web/lib/player-forecasts/serving.ts:288 (loadPlayerForecastInferenceInputs)`
- **Opus view (PFC-002):**
  - Method: homeIndicator = 1 if team is home else 0. restDays = max(0, round((game date - previous regular-season game date in same season)/1 day) - 1); 0 when no previous game. Passed to ensureValidationFeatureSnapshots.
  - Inputs/units: dates (UTC day difference); sources: games, player_forecast_feature_snapshots
  - Output scale: integer days; 0/1; writes: player_forecast_feature_snapshots (fallback_flags, features)
  - Status: live — only on the validation contract path (PLAYER_FORECAST_VALIDATION_CONTRACT_VERSION)
  - Consumers: web/lib/player-forecasts/orchestration.ts
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Tests: none listed
- **Leads (not audited):**
  - (opus) duplicate implementation of rest-days feature (XG-026 restDaysBetween, PFC-044 servedForecastLedger restDays)
  - (opus) first game of a season gets restDays = 0, the same value as a back-to-back

## M-PFC-084 Fantasy projections page confidence tiers and stale/conflict badges

- **Match:** Opus only; Opus PFC-003; Codex —
- **Purpose:** Turn the season forecast's numeric confidence into High/Medium/Low labels and flag stale or conflicting player rows.
- **Where:** `web/pages/fantasy-projections.tsx:236 (confidenceLabel)`; `web/pages/fantasy-projections.tsx:572 (playerBadges: Conflict, Stale data > 7 days)`
- **Opus view (PFC-003):**
  - Method: confidence >= 0.8 High, >= 0.55 Medium, else Low (players and team cards). 'Stale data' when now - sourceFreshAt > 7 days; 'Conflict' when roster unresolved + review_required or any fallback flag contains 'conflict'.
  - Inputs/units: confidence fraction 0-1; timestamps; sources: player forecast season API payload (/api/v1/player-forecasts/*)
  - Output scale: categorical High/Medium/Low; badge strings; writes: —
  - Status: live — /fantasy-projections
  - Consumers: /fantasy-projections player table, team cards, drawer
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Tests: `web/__tests__/pages/fantasy-projections.test.tsx`
- **Leads (not audited):**
  - (opus) 0.8/0.55 cutoffs are page-local magic numbers; not traced to the model's confidence calibration in modeling/player_forecasts

## M-PFC-085 Season fantasy projection settlement scoring (model vs published)

- **Match:** Opus only; Opus PFC-004; Codex —
- **Purpose:** Score released season forecasts against settled per-game outcomes
- **Where:** `web/scripts/import-player-forecast-season-settlement.ts:305 (evaluation loop)`
- **Opus view (PFC-004):**
  - Method: for each completed game: GAMES_PLAYED/GAMES_STARTED targets scored as probabilities; other targets use unconditional means; published forecast = lib allocateSeasonTotalAdjustment(modelGameForecast, modelRemainingTotal=base_values[target], adjustmentDelta, remainingGames=max(1, base GAMES_PLAYED)); losses via lib scoreSeasonPrimitive with baseline and p10/p90; missing actual or forecast default to 0
  - Inputs/units: per-game counts; probabilities 0-1; sources: player_forecast_season_game_outputs, player_forecast_season_releases, player_forecast_season_schedule_games, player_forecast_season_schedule_snapshots, player_forecast_season_outcome_revisions
  - Output scale: loss values per target; writes: player_forecast_season_outcome_revisions (insert), player_forecast_season_evaluation_revisions (upsert on release_id,outcome_revision_id,scoring_version)
  - Status: live — local import script for season settlement
  - Consumers: season projection accuracy reporting
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED in script
  - External references: interval coverage / pinball loss; Brier for probabilities
  - Tests: `web/lib/fantasy-projections/fantasyProjections.test.ts`
- **Leads (not audited):**
  - (opus) missing actual primitive values and missing forecasts are coerced to 0 rather than excluded

## M-PFC-086 On-ice shot attempts, unblocked attempts and xG for/against (SQL)

- **Match:** Opus only; Opus PFC-009; Codex —
- **Purpose:** Computes per-player-game on-ice CF/CA, FF/FA and xGF/xGA from xG shot features and the champion xG model
- **Where:** `modeling/player_forecasts/advanced.py:76 (PLAYER_ON_ICE_QUERY)`
- **Opus view (PFC-009):**
  - Method: champion = approved shot_goal model ordered by is_champion, is_active, registered_at; event on ice if same period and start<=t<=end; counts filter by owner team; xG sum with missing prediction = 0; excludes penalty shots and shootout
  - Inputs/units: period seconds; xG probability 0-1 per shot; sources: nhl_xg_model_registry, nhl_xg_shot_features, nhl_xg_shot_predictions, nhl_api_shift_rows
  - Output scale: counts and xG sums per player-game; writes: file: player_on_ice.jsonl
  - Status: unknown — manual CLI season-advanced-train/-evaluate/-project (modeling/player_forecasts/__main__.py:163-175, docs/player-projections/player-forecasts-runbook.md advanced-v5 section); output imported with the season bundle; no scheduler found
  - Consumers: _build_advanced_observations
- **Audit context:**
  - Intent (Opus): docs/player-projections/research-contract-v5-season-advanced.json (targets)
  - External references: NST/Evolving-Hockey on-ice CF/FF/xGF (normally 5v5 or all-situations with shift-change handling)
  - Tests: none listed
- **Leads (not audited):**
  - (opus) inclusive end boundary credits events at shift changes to both outgoing and incoming players (season.py uses exclusive end)
  - (opus) coalesce(xg,0) treats unscored shots as zero xG, biasing xGF/xGA down when predictions are missing
  - (opus) all strengths mixed, including empty-net

## M-PFC-087 Projection row normalization (goalie SA = SV + GA)

- **Match:** Opus only; Opus PFC-020; Codex —
- **Purpose:** Map external projection rows into totals per target and derive goalie shots against.
- **Where:** `web/lib/player-forecasts/baselineSourceLineage.ts:275 (baselineProjectionFromRow)`; `web/lib/player-forecasts/baselineSourceLineage.ts:284 (SHOTS_AGAINST_GOALIE)`; `web/lib/player-forecasts/baselinePolicy.ts:26 (skipTargets)`; `web/lib/player-forecasts/baselinePolicy.ts:40 (legacyColumns)`
- **Opus view (PFC-020):**
  - Method: Rows with Games_Played <= 0 dropped; totals mapped per source schema; goalie SHOTS_AGAINST = SAVES + GA when both >= 0; dtz_goalies legacy columns Ga/Sa remapped.
  - Inputs/units: projection table season totals (counts) and Games_Played/Games_Started_Goalie; sources: PROJECTIONS_{season}_{SOURCE} tables (ag, cullen, dtz, 5v5 skaters; cullen, dtz, 5v5 goalies)
  - Output scale: season totals per source (counts); writes: —
  - Status: legacy/dead — only feeds legacy projection-blend baselines, not the approved native methods
  - Consumers: buildSkaterBaselineRates; buildGoalieBaselineRates
- **Audit context:**
  - Intent (Opus): baselinePolicy.ts:39 'These legacy schemas were checked against hosted metadata; absent columns stay unsupported.'
  - Tests: `web/lib/player-forecasts/goalieBaseline.test.ts`
- **Leads (not audited):**
  - (opus) projection source SA overwritten by SV+GA even if source supplies its own SA
  - (opus) legacy season 20252026 table names and column lists hard-coded

## M-PFC-088 Boxscore target extraction and TOI parsing

- **Match:** Opus only; Opus PFC-021; Codex —
- **Purpose:** Derive per-game skater/goalie count targets and minutes from raw NHL boxscore rows.
- **Where:** `web/lib/player-forecasts/baselineSourceLineage.ts:294 (baselineSkaterTargets)`; `web/lib/player-forecasts/baselineSourceLineage.ts:318 (baselineGoalieComponents)`; `web/lib/player-forecasts/baselineSourceLineage.ts:341 (baselineAppearanceFromBoxscore)`; `web/lib/player-forecasts/settlement.ts:48 (parseTimeOnIceSeconds)`
- **Opus view (PFC-021):**
  - Method: POINTS = points or goals+assists (conflict throws); SOG = sog ?? shots (conflict throws); FACEOFFS from 'won/total' regex (note: second number stored as FACEOFFS_LOST although NHL string is won/total); goalie saves/SA parsed from 'S/SA', SA must equal SV+GA; toiMinutes = seconds/60; zero-TOI appearance returns null (excluded).
  - Inputs/units: NHL boxscore strings: toi 'MM:SS', faceoffs 'W/x', saveShotsAgainst 'SV/SA'; integer counts; sources: nhl_api_game_payloads_raw (endpoint boxscore), games
  - Output scale: integer counts per game; toiMinutes in minutes; appearanceSeconds in seconds; writes: —
  - Status: live — used by every native rate builder and settlement
  - Consumers: all baseline rate builders; currentSeasonSogBaseline; nativePowerPlayPoints
- **Audit context:**
  - Intent (Opus): baselineSourceLineage.ts:293 'Missing raw components remain missing; percentage fields cannot reconstruct counts.'
  - External references: NHL API boxscore field conventions
  - Tests: `web/lib/player-forecasts/goalieBaseline.test.ts`; `web/lib/player-forecasts/nativeGoalieOutcomes.test.ts`; `web/lib/player-forecasts/playerForecasts.test.ts`
- **Leads (not audited):**
  - (opus) FACEOFFS_LOST = second number of 'x/y' faceoff string; if the API string is won/taken this is total, not lost
  - (opus) skater appearance requires positive TOI, so penalty-only zero-minute games are dropped from all rates

## M-PFC-089 Native daily means capture planning (lookback windows and bounds)

- **Match:** Opus only; Opus PFC-023; Codex —
- **Purpose:** Choose how many club games and prior appearances to capture so each player reaches the appearance targets.
- **Where:** `web/lib/player-forecasts/nativeDailyMeansCapture.ts:30 (NATIVE_MEANS_BOUNDS)`; `web/lib/player-forecasts/nativeDailyMeansCapture.ts:173 (planNativeMeansCapture)`; `web/lib/player-forecasts/nativeDailyMeansCapture.ts:415 (assembleNativeDailyMeans)`; `web/lib/player-forecasts/nativeDailyMeansCapture.ts:467 (current-first policy selection)`
- **Opus view (PFC-023):**
  - Method: Start with 20 club games, extend by per-player appearance deficit up to 40; prior: 20 appearances from 40 candidates; goalie summary days 60. Policy per player: current-appearance policy if any current observation, else prior-appearance policy; goalies get win/summary-win/volume/shutout policies.
  - Inputs/units: HTTP receipts; game counts; days; sources: api-web.nhle.com schedule/boxscore/landing, NHL goalie summary, player_forecast_source_observations
  - Output scale: capture plan (requests, bytes); per-player target coverage; writes: player_forecast_source_observations
  - Status: live — scripts/native-means-capture.ts, scripts/native-means-replay.ts, scripts/forge-daily-v2.ts
  - Consumers: scripts/native-means-capture.ts; scripts/native-means-replay.ts; nativeDailyPipelineV2
- **Audit context:**
  - Intent (Opus): nativeDailyMeansCapture.ts:1 'FORGE v2 daily means stage... an unknown never becomes zero'; tasks/prd-forge-daily-pipeline.md
  - Fixtures/test data: `web/lib/player-forecasts/yahooUniverse.fixtures.ts`
  - Tests: `web/lib/player-forecasts/nativeDailyMeansCapture.test.ts`
- **Leads (not audited):**
  - (opus) hard switch from prior to current policy at first current appearance (no blending) produces large rate jumps early season

## M-PFC-090 Starter Board daily run (FORGE forecast export, candidate capture, baseline issuance, settlement)

- **Match:** Opus only; Opus PFC-026; Codex —
- **Purpose:** Orchestrates one slate: exports frozen FORGE forecasts via TS, captures candidates, issues baselines and settles outcomes
- **Where:** `modeling/player_forecasts/daily_board_daily.py:44 (_export_forecasts)`; `modeling/player_forecasts/daily_board_daily.py:170 (_settle_game)`; `modeling/player_forecasts/daily_board_daily.py:238 (run_daily)`
- **Opus view (PFC-026):**
  - Method: modes settle (slate within last 2 Eastern days), capture-candidates and capture-baselines (today..+7 days); at most 16 games, two workers; per-game artifacts built and verified; no numeric transformation beyond calling settlement/baseline functions
  - Inputs/units: dates (America/New_York); timestamps; sources: FORGE served forecasts (via web/scripts/export-starter-board-forecasts.ts), NHL schedule/boxscore APIs
  - Output scale: artifact bundles (no new metric); writes: file: private slate root (outside repo)
  - Status: draft — invoked by modeling/player_forecasts/daily_board_daily.run_daily (bounded private capture/settle; 'scheduler activation is separate', daily_board_daily.py:1); no cron found in web/vercel.json or .github/workflows
  - Consumers: daily_board_goalies.train_goalie_calibration; daily_board.evaluate_daily_board
- **Audit context:**
  - Intent (Opus): daily_board_daily.py:1 docstring; docs/start-chart/launch-validation.md
  - Fixtures/test data: `modeling/player_forecasts/tests/test_harness.py`
  - Tests: `modeling/player_forecasts/tests/test_harness.py`
- **Leads (not audited):**
  - (opus) FORGE forecast values come from a TS export outside this slice; joins assume issued_at/cutoff checks done there

## M-PFC-091 Daily-board history normalization and strength accounting audit

- **Match:** Opus only; Opus PFC-027; Codex —
- **Purpose:** Normalizes skater/goalie game outcomes and verifies EV/PP/PK TOI and G/A/SOG splits
- **Where:** `modeling/player_forecasts/daily_board_data.py:22 (HISTORY_QUERY)`; `modeling/player_forecasts/daily_board_data.py:78 (_minutes)`; `modeling/player_forecasts/daily_board_data.py:92 (_strength_outcomes)`; `modeling/player_forecasts/daily_board_data.py:160 (normalize_history)`
- **Opus view (PFC-027):**
  - Method: TOI minutes = mm + ss/60; usage verified when derived strength seconds equal shift-chart minutes*60 and sum within 1 s of box TOI; rates verified when strength G/A/SOG sum to box totals, PP G+A = box PP points, no events with zero strength TOI, G<=SOG per strength; goalie TOI = toi_seconds/60; excludes lockbox dates 2026-01-03..04-16
  - Inputs/units: TOI 'mm:ss' to minutes; strength TOI seconds; goalie TOI seconds/60; sources: games, gameOutcomes, nhl_api_shift_rows, forge_player_game_strength, shift_charts, skatersGameStats, forge_goalie_game
  - Output scale: minutes; counts; verified/unavailable status; writes: file: history.jsonl
  - Status: draft — Starter Board research CLI (module main()); promotionEligible False, servingDecision retain_FORGE; challenger and scheduler activation default off (docs/start-chart/launch-validation.md:20)
  - Consumers: historical_baselines; strength_baselines; context_features
- **Audit context:**
  - Intent (Opus): daily_board_data.py:93 docstring and :165 comment; docs/start-chart/launch-validation.md (:170)
  - External references: NHL shift-chart strength TOI
  - Fixtures/test data: `modeling/player_forecasts/tests/test_harness.py`
  - Tests: `modeling/player_forecasts/tests/test_harness.py`
- **Leads (not audited):**
  - (opus) explicitly treats skatersGameStats PP/SH TOI as unreliable placeholders - contradicts season.py usage of the same columns

## M-PFC-092 Daily-board official settlement normalization

- **Match:** Opus only; Opus PFC-032; Codex —
- **Purpose:** Converts official boxscore/summary into settled outcomes and joins to forecasts
- **Where:** `modeling/player_forecasts/daily_board_settlement.py:38 (normalize_settlement)`; `modeling/player_forecasts/daily_board_settlement.py:127 (attach_official_outcomes)`; `modeling/player_forecasts/daily_board_candidates.py:129 (candidate_label_rows)`
- **Opus view (PFC-032):**
  - Method: TOI minutes = timeOnIce seconds/60 (must equal box toi within 0.01 s); goalie saves+GA = SA enforced; starter flag exactly one per team; PP_POINTS from summary; conditional outcomes nulled when player did not play/start; participation labels from appearances and explicit scratches
  - Inputs/units: TOI seconds to minutes; counts; sources: api-web.nhle.com boxscore, api.nhle.com stats summaries
  - Output scale: settled per-player outcomes; labels 0/1; writes: file: settlement bundles
  - Status: draft — invoked by modeling/player_forecasts/daily_board_daily.run_daily (bounded private capture/settle; 'scheduler activation is separate', daily_board_daily.py:1); no cron found in web/vercel.json or .github/workflows
  - Consumers: daily_board evaluation; goalie calibration
- **Audit context:**
  - Intent (Opus): daily_board_settlement.py:1 and :128 docstrings
  - External references: NHL official stats
  - Fixtures/test data: `modeling/player_forecasts/tests/test_harness.py`
  - Tests: `modeling/player_forecasts/tests/test_harness.py`

## M-PFC-093 Historical qualification cohort classification (early-season target)

- **Match:** Opus only; Opus PFC-038; Codex —
- **Purpose:** Classify paired games into evaluation populations by completed-game history coverage.
- **Where:** `web/lib/forecast-diagnostics/historicalQualification.ts:67 (qualifyHistoricalFeatures)`; `web/lib/forecast-diagnostics/historicalQualification.ts:122 (buildHistoricalQualificationCohort)`; `web/lib/forecast-diagnostics/historicalQualification.ts:148 (diagnostic exclusions)`
- **Opus view (PFC-038):**
  - Method: Population: diagnostic_exclusion for games 2026020053/2026020055; zero_history_coverage if any team has 0 games; early_season_target if any team has 1-3 completed games; else outside_early_season_target. Evaluable only if early-season target with retained/reconstructable issuance and available forecast.
  - Inputs/units: completed game counts; sources: —
  - Output scale: categorical population label; evaluable boolean; writes: —
  - Status: legacy/dead — no non-test consumers found
  - Consumers: none outside module found
- **Audit context:**
  - Intent (Opus): historicalQualification.ts:121 'One row per paired game, including failures and unknown early-season eligibility. No outcomes are consumed.'
  - Tests: `web/lib/forecast-diagnostics/historicalQualification.test.ts`
- **Leads (not audited):**
  - (opus) hard-coded game IDs 2026020053, 2026020055
  - (opus) no non-test consumers found

## M-PFC-094 Forecast candles and accountability candles (OHLC of revisions/skill)

- **Match:** Opus only; Opus PFC-040; Codex —
- **Purpose:** Summarize forecast revision paths and slate skill-score checkpoints as open/high/low/close.
- **Where:** `web/lib/player-forecasts/accountability.ts:20 (buildPlayerForecastCandles)`; `web/lib/player-forecasts/accountability.ts:92 (buildAccountabilityCandles)`; `web/lib/player-forecasts/dashboard.ts:173 (checkpoints)`
- **Opus view (PFC-040):**
  - Method: Group by game/player/target/conditioning/model; open=first, close=last, high=max, low=min of values ordered by issuedAt; accountability grouped by slate/model/scoring version ordered by checkpointOrder.
  - Inputs/units: forecast values (point or probability); skill score 0-100; sources: player_forecast_outputs, player_forecast_runs, player_forecast_outcome_revisions, player_forecast_accountability_revisions, player_forecast_model_artifacts
  - Output scale: OHLC of same units; writes: —
  - Status: live — /api/v1/player-forecasts/dashboard and /accountability used by pages/player-forecasts.tsx
  - Consumers: pages/api/v1/player-forecasts/dashboard.ts; pages/player-forecasts.tsx; accountability/history APIs
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Fixtures/test data: `web/scripts/seed-player-forecast-fixtures.ts`
  - Tests: `web/lib/player-forecasts/playerForecasts.test.ts`
- **Leads (not audited):**
  - (opus) mixes pointEstimate and probability via '??' in one value stream if a revision has both

## M-PFC-095 Game forecast contract consistency checks

- **Match:** Opus only; Opus PFC-042; Codex —
- **Purpose:** Validate count identities and participation integration of research game forecasts.
- **Where:** `web/lib/player-forecasts/gameContract.ts:141 (checkMeans)`; `web/lib/player-forecasts/gameContract.ts:245 (mean = exposure * conditional)`; `web/lib/player-forecasts/gameContract.ts:264 (TOTAL_TOI exposure bound)`
- **Opus view (PFC-042):**
  - Method: Totals must equal sum of parts within 1e-8 relative; parts <= total; goals minus non-shot goals <= SOG; SA = SV + GA - nonShotGA; unconditional mean = exposure * conditional; TOTAL_TOI <= 65*60*pGamePlayed*pPositiveMinutes.
  - Inputs/units: means in counts; TOTAL_TOI seconds (65*60 bound); probabilities 0-1; sources: —
  - Output scale: validation issues (pass/fail); writes: —
  - Status: draft — schema exercised only by gameContract.fixtures.ts and its test; no runtime caller found
  - Consumers: research game forecast artifacts
- **Audit context:**
  - Intent (Opus): gameContract.ts:243 'Every unsupported mean is null with a reason; a supported zero is not missing data.'; :247 'Unconditional means must integrate game occurrence and declared participation exactly once.'
  - Fixtures/test data: `web/lib/player-forecasts/gameContract.fixtures.ts`
  - Tests: `web/lib/player-forecasts/gameContract.test.ts`

## M-PFC-096 Market implied mean from de-vigged props and moneyline team win

- **Match:** Opus only; Opus PFC-043; Codex —
- **Purpose:** Derive market-implied stat means and team win probabilities for comparison with served forecasts.
- **Where:** `web/lib/player-forecasts/servedForecastLedger.ts:193 (impliedMeanFromMarket)`; `web/lib/player-forecasts/servedForecastLedger.ts:204 (buildMarketLedgerRows)`; `web/lib/player-forecasts/servedForecastLedger.ts:243 (devigTwoWayAmerican, median)`
- **Opus view (PFC-043):**
  - Method: Implied mean = bisection (60 iterations, bracket [0, max(1, 4*line+10)]) for the mean whose model P(over \| no push) equals de-vigged market P(over), using FORGE fitted count distribution by position (Poisson fallback). Team win = median across books of two-way de-vigged fair probability. Quotes must be observed before snapshot and puck drop. Head preference e.g. goals: player_goals then anytime scorer.
  - Inputs/units: American odds (price_american); prop line in stat units; sources: prop_market_prices_daily, market_prices_daily
  - Output scale: market P(over) 0-1; implied mean in stat units; team win probability 0-1; writes: forge_served_forecast_ledger (source market, market_lines)
  - Status: live — LEDGER_MARKET_ENABLED = true (servedForecastLedger.ts:169); snapshot cron
  - Consumers: scoreMarketLedger; scorePairedLedger (market reference)
- **Audit context:**
  - Intent (Opus): servedForecastLedger.ts:192 'Mean whose P(over \| no push) at line equals the market's, under the same distribution the model is scored with.'; :167 migration 99 note
  - External references: Sportsbook de-vig (multiplicative/power/Shin); Poisson/negative-binomial prop pricing
  - Tests: `web/lib/player-forecasts/servedForecastLedger.test.ts`
- **Leads (not audited):**
  - (opus) implied mean depends on FORGE's own distribution assumption, so 'market mean' is model-dependent
  - (opus) de-vig method and distribution live in lib/projections/utils (outside slice)

## M-PFC-097 Served-forecast ledger naive controls (last-N and season means, goalie start share)

- **Match:** Opus only; Opus PFC-046; Codex —
- **Purpose:** Naive baseline forecasts stored next to served FORGE/native forecasts for comparison.
- **Where:** `web/lib/player-forecasts/servedForecastLedger.ts:86 (buildLedgerRows)`; `web/lib/player-forecasts/servedForecastLedger.ts:94 (restDays)`; `web/lib/player-forecasts/servedForecastLedger.ts:143 (skater naive)`; `web/lib/player-forecasts/servedForecastLedger.ts:149 (goalie naive)`
- **Opus view (PFC-046):**
  - Method: Skater naive_last5 = mean of last 5 games (any season); naive_season = mean of current-season games; participation 1. Goalie: start share = min(1, own starts in team games / team games) over last 10 team games (naive_last5) or season; exp SV/GA/SA = share * mean per start; win = share * teamWin (default 0.5); shutout = share * mean(min(1, SO)). Rest days = round(day diff to previous team game). Values rounded to 4 dp.
  - Inputs/units: WGO per-game counts; games_started; team win probability 0-1; dates; sources: wgo_skater_stats, wgo_goalie_stats, games, forge_runs
  - Output scale: expected counts per game; start share 0-1; win/shutout probability 0-1; rest days (integer days); writes: forge_served_forecast_ledger
  - Status: live — cron /api/v1/db/forge-served-forecast-snapshot '30 12 * * *' (web/vercel.json)
  - Consumers: pages/api/v1/db/forge-served-forecast-snapshot.ts; pages/api/v1/forge/scoreboard.ts
- **Audit context:**
  - Intent (Opus): servedForecastLedger.ts:8 'what the RSO was shown per player-game, beside naive controls'; tasks/prd-forge-accountability-table.md
  - External references: Persistence / climatology baselines in forecast verification
  - Tests: `web/__tests__/pages/api/v1/db/forge-served-forecast-snapshot.test.ts`; `web/lib/player-forecasts/servedForecastLedger.test.ts`
- **Leads (not audited):**
  - (opus) goalie 'naive_last5' actually uses last 10 starts and last 10 team games (slice(0,10)/slice(-10))
  - (opus) skater naive_last5 spans previous season games; naive participation fixed at 1
  - (opus) missing team win probability silently defaults to 0.5

## M-PFC-098 Horizon vintages (issue-time reconstruction)

- **Match:** Opus only; Opus PFC-051; Codex —
- **Purpose:** Reconstructs forecast issue times 1..10 team games before each target game
- **Where:** `modeling/player_forecasts/horizons.py:14 (_canonical_issue)`; `modeling/player_forecasts/horizons.py:44 (reconstructed_vintages)`
- **Opus view (PFC-051):**
  - Method: issued_at = 10:00 UTC on the day after the (index-h)-th previous game (or season open); horizon up to 10; final_pregame at 10:00 UTC on game day; rest_days = max(0, days-1)
  - Inputs/units: calendar dates; UTC timestamps; sources: games.jsonl
  - Output scale: vintages with horizon 1-10; writes: —
  - Status: draft — validation-only challenger (CLI build-validation-features/train-validation-challenger, __main__.py:62-67); promotionEligible False; consumed only by the functions inference worker, which is flagged off
  - Consumers: challenger_features.build_validation_features
- **Audit context:**
  - Intent (Opus): scheduleSemantics 'final_schedule_reconstructed_validation'; docs/player-projections/validation-challenger-evidence-2026-08-04.md 'Horizon uncertainty' (:96)
  - Fixtures/test data: `modeling/player_forecasts/tests/test_harness.py`
  - Tests: `modeling/player_forecasts/tests/test_harness.py`
- **Leads (not audited):**
  - (opus) rest_days convention differs from season.py (B2B = 0 here vs 1 there)
  - (opus) fixed 10:00 UTC (5-6 am ET) issue time assumes all prior-night results are available

## M-PFC-099 Season settlement finality rule

- **Match:** Opus only; Opus PFC-055; Codex —
- **Purpose:** Marks settled outcomes final vs provisional
- **Where:** `modeling/player_forecasts/season.py:4577 (build_season_settlement_bundle)`
- **Opus view (PFC-055):**
  - Method: final if cutoff >= start + 48h else provisional; outcome values copied from primitive targets
  - Inputs/units: timestamps (hours); sources: season freeze
  - Output scale: label final/provisional; writes: file: outcomes.jsonl -> web/scripts/import-player-forecast-season-settlement.ts
  - Status: unknown — run manually via `python -m modeling.player_forecasts season-settle` (modeling/player_forecasts/__main__.py:138; docs/player-projections/player-forecasts-runbook.md:512-531); bundles imported by web/scripts/import-player-forecast-season.ts (npm import:player-forecast-season) into player_forecast_season_* read by page … (full text in the original packet)
  - Consumers: season settlement import
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED (48 h)
  - Tests: none listed
- **Leads (not audited):**
  - (opus) 48 h finality ignores later official stat corrections

## M-PFC-100 Fantasy metric source eligibility coverage gate

- **Match:** Opus only; Opus PFC-056; Codex —
- **Purpose:** Decides whether each v4 fantasy target has enough observed label coverage to train
- **Where:** `modeling/player_forecasts/season.py:82 (FANTASY_SOURCE_ELIGIBILITY_POLICY)`; `modeling/player_forecasts/season.py:907 (_fantasy_metric_source_audit)`
- **Opus view (PFC-056):**
  - Method: coverage = observed rows / rows per season and per validation fold; eligible if observed rows >= 10000 skater / 1000 goalie, season coverage >= 0.75 in >=1 season, fold rows >= 1000/100 and fold coverage >= 0.75 in >=2 of 3 folds
  - Inputs/units: row counts; coverage fraction 0-1; sources: season freeze files
  - Output scale: boolean eligibility per target; coverage 0-1; writes: file: fantasy-metric-source-audit.json
  - Status: unknown — run manually via `python -m modeling.player_forecasts season-freeze` (modeling/player_forecasts/__main__.py:102; docs/player-projections/player-forecasts-runbook.md:512-531); bundles imported by web/scripts/import-player-forecast-season.ts (npm import:player-forecast-season) into player_forecast_season_* read by page … (full text in the original packet)
  - Consumers: train_season_artifact v4 gate; evaluate_fantasy_batch
- **Audit context:**
  - Intent (Opus): season.py:82 FANTASY_SOURCE_ELIGIBILITY_POLICY text (availabilityScope/fallback); docs/player-projections/research-contract-v4-season-fantasy.json
  - Tests: none listed
- **Leads (not audited):**
  - (opus) policy text says failing targets fall back individually, but train_season_artifact raises if eligibleForV4Training is false for any target (all-or-nothing)

## M-PFC-101 On-ice chances/goals against per player-game (defense history SQL)

- **Match:** Opus only; Opus PFC-059; Codex —
- **Purpose:** Counts opponent shot-like events and goals while a skater is on ice, plus team totals, as input to defensive ratings
- **Where:** `modeling/player_forecasts/season.py:130 (DEFENSE_HISTORY_QUERY)`
- **Opus view (PFC-059):**
  - Method: toi_seconds = sum(shift duration); chances_against = count distinct opponent is_shot_like events with start<=t<end; goals_against likewise for is_goal; team_chances_against/goals_against = count of all opponent events per game
  - Inputs/units: period seconds elapsed; shift seconds; event counts; sources: nhl_api_shift_rows, nhl_api_pbp_events, players, games
  - Output scale: counts per player-game; TOI seconds; writes: file: defense_history.jsonl
  - Status: unknown — run manually via `python -m modeling.player_forecasts season-freeze` (modeling/player_forecasts/__main__.py:102; docs/player-projections/player-forecasts-runbook.md:512-531); bundles imported by web/scripts/import-player-forecast-season.ts (npm import:player-forecast-season) into player_forecast_season_* read by page … (full text in the original packet)
  - Consumers: _adjusted_defense_ratings
- **Audit context:**
  - Intent (Opus): season.py:3900 limitation text: 'regularized on-ice shot-attempt and goal suppression adjusted for team and opponent'
  - External references: NST/Evolving-Hockey on-ice CA/GA (usually 5v5 only, score-and-venue adjusted)
  - Tests: none listed
- **Leads (not audited):**
  - (opus) all strengths are mixed (PK time inflates chances against, EN goals included)
  - (opus) shift window is start<=t<end here but start<=t<=end in advanced.py PLAYER_ON_ICE_QUERY - inconsistent boundary handling between modules
  - (opus) team_against uses count(event_id) without distinct while player exposure uses count(distinct)

## M-PFC-102 Rest-day / back-to-back derivation

- **Match:** Opus only; Opus PFC-060; Codex —
- **Purpose:** Computes days since a team's previous game and a back-to-back flag
- **Where:** `modeling/player_forecasts/season.py:1665 (_annotate_rest_context)`; `modeling/player_forecasts/season.py:4140 (_schedule_contexts_by_team)`; `modeling/player_forecasts/horizons.py:44 (reconstructed_vintages)`
- **Opus view (PFC-060):**
  - Method: season.py: rest_days = (date - previous date).days, B2B when rest_days == 1; training uses game_date, serving uses UTC date of scheduled_start_at; horizons.py: rest_days = max(0, days - 1) so B2B = 0
  - Inputs/units: calendar days (season.py from local game_date in training, UTC date in serving; horizons.py days-1); sources: games, schedule.json
  - Output scale: integer rest days; boolean B2B; writes: —
  - Status: unknown — run manually via `python -m modeling.player_forecasts season-train/season-project` (modeling/player_forecasts/__main__.py:112,130; docs/player-projections/player-forecasts-runbook.md:512-531); bundles imported by web/scripts/import-player-forecast-season.ts (npm import:player-forecast-season) into player_forecast_sea … (full text in the original packet)
  - Consumers: _fit_context_profile; _target_multiplier; challenger_features rest_days feature
- **Audit context:**
  - Intent (Opus): season.py:4121 comment on context; UNDOCUMENTED definition of rest days
  - External references: NHL schedule-rest convention (B2B = consecutive calendar days, local date)
  - Fixtures/test data: `modeling/player_forecasts/tests/test_harness.py`
  - Tests: `modeling/player_forecasts/tests/test_harness.py`
- **Leads (not audited):**
  - (opus) two incompatible rest_days definitions (season.py: B2B=1; horizons.py: B2B=0)
  - (opus) serving converts scheduled_start_at to a UTC date, so late North American starts (after 8 pm ET) fall on the next UTC day and can mis-flag back-to-backs; training uses local game_date

## M-PFC-103 Native baseline cadence (08:00 NY / T-15 publication slots)

- **Match:** Opus only; Opus PFC-061; Codex —
- **Purpose:** Decide whether a publication slot acts or holds and run the journaled, deduplicated publication stage.
- **Where:** `web/lib/player-forecasts/nativeBaselineCadence.ts:12 (NATIVE_BASELINE_CADENCE_LIMITS)`; `web/lib/player-forecasts/nativeBaselineCadence.ts:53 (publishNativeBaselineCadence)`; `web/lib/player-forecasts/nativeBaselineCadence.ts:149 (publishJournaledNativeBaselineCadence)`; `web/lib/player-forecasts/nativeBaselineCadence.ts:283 … (full text in the original packet)
- **Opus view (PFC-061):**
  - Method: Slot decision from prepareForecastCadence (outside slice); hold if slot action is hold or plan season != seasonForDate(date) (July rollover); bounds 32 sources, 128 previous, 64 KiB metadata; validates plan then publishes; deterministic journal IDs make claims atomic.
  - Inputs/units: timestamps; counts; sources: player_forecast_source_observations
  - Output scale: held/published status; writes: player_forecast_source_observations
  - Status: live — (manual) scripts/native-baseline-cadence.ts; no vercel.json cron
  - Consumers: scripts/native-baseline-cadence.ts
- **Audit context:**
  - Intent (Opus): nativeBaselineCadence.ts:49 'Native publication stage for one explicit 08:00-NY or T-15 decision... No legacy detailed worker or scheduler is invoked by this adapter.'
  - Tests: `web/lib/player-forecasts/nativeBaselinePublication.test.ts`
- **Leads (not audited):**
  - (opus) slot timing math lives in lib/fantasy-projections/seasonJobs.ts (not traced here)

## M-PFC-104 Native baseline publication validation (bounded plan admission)

- **Match:** Opus only; Opus PFC-062; Codex —
- **Purpose:** Validate a publication plan's rows, hashes, clocks and approvals before an exact write.
- **Where:** `web/lib/player-forecasts/nativeBaselinePublication.ts:15 (PUBLICATION_LIMITS)`; `web/lib/player-forecasts/nativeBaselinePublication.ts:53 (validateNativeBaselinePublication)`; `web/lib/player-forecasts/nativeBaselinePublication.ts:113 (publishNativeBaselinePlan)`
- **Opus view (PFC-062):**
  - Method: Rows <= 320, each <= 8 MiB, total <= 48 MiB; payload_hash must equal hash(payload); observed <= available_at <= now; every referenced policy/review present and no unreferenced approvals; participation entries with non-null probability must map to admitted participation; existing admission contracts rerun locally.
  - Inputs/units: bytes; microsecond timestamps; sources: player_forecast_source_observations
  - Output scale: pass/fail; writes: player_forecast_source_observations
  - Status: live — (manual) via nativeBaselineCadence / scripts/native-baseline-cadence.ts
  - Consumers: nativeBaselineCadence; scripts/native-baseline-cadence.ts
- **Audit context:**
  - Intent (Opus): nativeBaselinePublication.ts:39 'Existing admission contracts run over exact local rows'; :112 'No automatic activation or retries. Reconcile uncertain writes only by exact ID readback.'
  - Tests: `web/lib/player-forecasts/nativeBaselinePublication.test.ts`

## M-PFC-105 Native cadence output preparation (re-issuance of means and participation bundles)

- **Match:** Opus only; Opus PFC-063; Codex —
- **Purpose:** Issue same-method outputs from a closed materialization with new issuance/expiry; build participation bundles from fresh inputs.
- **Where:** `web/lib/player-forecasts/nativeCadenceOutputPreparation.ts:63 (DAILY_PARTICIPATION_BUNDLE_BYTES 7 MiB)`; `web/lib/player-forecasts/nativeCadenceOutputPreparation.ts:67 (prepareNativeCadenceOutputs)`; `web/lib/player-forecasts/nativeCadenceOutputPreparation.ts:98 (expiry <= issuedAt + 12 h)`
- **Opus view (PFC-063):**
  - Method: Reproduces reviewed plan means, identities and nulls exactly; only issuance changes. Daily: new expiry must be > issuedAt and <= issuedAt + 12 h; fresh means get a new bundle and policy row under the standing approval scoped to that day's candidate input hash; policies whose bundles shrank get new policy rows; empty policies not issued. Participation bundles built from proof inputs (rolling or roster-observation receipts) capped at 7 MiB.
  - Inputs/units: ISO timestamps; bytes; sources: player_forecast_source_observations
  - Output scale: plan rows; writes: player_forecast_source_observations (via publication)
  - Status: live — (manual) scripts/forge-daily-v2.ts and scripts/native-baseline-cadence.ts
  - Consumers: scripts/forge-daily.ts; scripts/forge-daily-v2.ts; scripts/native-baseline-cadence.ts
- **Audit context:**
  - Intent (Opus): nativeCadenceOutputPreparation.ts:18 'Offline issuance of later same-method outputs from one closed materialization. It reproduces the reviewed plan's means, identities, expiries and nulls exactly; only issuance changes.'
  - Tests: `web/lib/player-forecasts/nativeBaselinePublication.test.ts`; `web/lib/player-forecasts/nativeDailyPipelineV2.test.ts`
- **Leads (not audited):**
  - (opus) standing approval auto-scopes new policy rows to each day's input hash; reviews come back pending, so serving depends on a separate review step

## M-PFC-106 FORGE daily v1 composition: schedule bindings and daily issuance expiry

- **Match:** Opus only; Opus PFC-064; Codex —
- **Purpose:** Re-bind frozen native means and participation history to fresh rosters/schedule and set one expiry for the daily issuance.
- **Where:** `web/lib/player-forecasts/nativeDailyPipeline.ts:18 (NATIVE_DAILY_HORIZON=20)`; `web/lib/player-forecasts/nativeDailyPipeline.ts:35 (dailyScheduleBindings)`; `web/lib/player-forecasts/nativeDailyPipeline.ts:79 (reobserveHistoryWindow)`; `web/lib/player-forecasts/nativeDailyPipeline.ts:179 (excludeMeansOnlyNatives)`; `web/lib/ … (full text in the original packet)
- **Opus view (PFC-064):**
  - Method: Schedule: next regular-season games per club after cutoff, status must be 'scheduled', normalized to America/New_York planning games; overlapping weekly bodies must agree on id/start/home/away/state. Frozen history window re-observed: club frames must list identical games or the run stops. Means-only players (no participation target) dropped. Expiry = min(issuedAt + 12 h, first remaining universe/league game start - 1 ms).
  - Inputs/units: ISO timestamps; HTTP receipts; sources: api-web.nhle.com schedule/roster receipts, player_forecast_source_observations
  - Output scale: schedule rows; expiry timestamp; writes: —
  - Status: legacy/dead — legacy (v1) superseded by v2 composition but its helpers (dailyScheduleBindings, dailyExpiresAt) are imported by scripts/forge-daily-v2.ts
  - Consumers: scripts/forge-daily.ts; scripts/forge-daily-v2.ts; nativeCadenceOutputPreparation
- **Audit context:**
  - Intent (Opus): nativeDailyPipeline.ts:14 'v1 daily FORGE run: frozen native means and frozen participation history, re-bound to fresh official club rosters and a fresh schedule.'; tasks/prd-forge-daily-pipeline.md
  - Fixtures/test data: `web/lib/player-forecasts/yahooUniverse.fixtures.ts`
  - Tests: `web/lib/player-forecasts/nativeDailyPipeline.test.ts`
- **Leads (not audited):**
  - (opus) v1 re-issues the frozen Oct 16 native means (tasks/prd-forge-daily-pipeline.md:38-47), so served means do not update unless v2 freshMeans is used
  - (opus) 12 h expiry cap means a missed morning run leaves evening slates without issuance

## M-PFC-107 FORGE daily v2 composition gates (method switch, universe, means coverage, null participation)

- **Match:** Opus only; Opus PFC-065; Codex —
- **Purpose:** Compose Yahoo universe, fresh native means and participation into one run, with approval and count gates.
- **Where:** `web/lib/player-forecasts/nativeDailyPipelineV2.ts:18 (NATIVE_DAILY_V2_FLAGS)`; `web/lib/player-forecasts/nativeDailyPipelineV2.ts:35 (NATIVE_DAILY_APPROVED_METHODS)`; `web/lib/player-forecasts/nativeDailyPipelineV2.ts:75 (nativeDailyParticipationMethod)`; `web/lib/player-forecasts/nativeDailyPipelineV2.ts:81 (nativeDailyUniv … (full text in the original packet)
- **Opus view (PFC-065):**
  - Method: Participation method = frozen_window if cutoff <= 2026-10-27T04:00Z else rolling_14d (requires flag rollingFirstIssuance). Universe: owned must be complete; unresolved = unmapped+ambiguous+membershipUnresolved+excluded; fail if unresolved > 5 or added > 10 when universeThresholds flag on (default off, report only). Means must cover every universe member except an approved uncovered ceiling. Null-participation count = entries with probability null (optionally excluding known_current_roster_conflict); compared to --max-null-participation. Approved policy definition hashes and terms pinned for season 20262027.
  - Inputs/units: counts; ISO timestamps; sources: Yahoo league rosters (captured), player_forecast_source_observations
  - Output scale: gate pass/fail; integer counts; writes: —
  - Status: live — (manual) scripts/forge-daily-v2.ts (local operator run, not a vercel.json cron); flags default off
  - Consumers: scripts/forge-daily-v2.ts; scripts/native-means-capture.ts
- **Audit context:**
  - Intent (Opus): nativeDailyPipelineV2.ts:1 'FORGE v2 daily composition... Everything still awaiting TJ sits behind NativeDailyV2Flags, all off by default.'; tasks/prd-forge-daily-pipeline.md
  - Fixtures/test data: `web/lib/player-forecasts/yahooUniverse.fixtures.ts`
  - Tests: `web/lib/player-forecasts/nativeDailyPipelineV2.test.ts`
- **Leads (not audited):**
  - (opus) all four v2 flags default false; behaviour of live runs depends on an external --flags file not in the repo
  - (opus) approved methods hard-coded to seasonId 20262027; next season fails closed
  - (opus) null-participation threshold is a CLI argument, not a versioned constant

## M-PFC-108 Native input materialization (bounded immutable input packing and manifest)

- **Match:** Opus only; Opus PFC-066; Codex —
- **Purpose:** Pack acquired original receipts and derived participation/means inputs into bounded immutable source observations and verify closure.
- **Where:** `web/lib/player-forecasts/nativeInputMaterialization.ts:41 (MAX_BYTES 64 MiB)`; `web/lib/player-forecasts/nativeInputMaterialization.ts:43 (NATIVE_MATERIALIZATION_MAX_PARTICIPATION_INPUTS=1500)`; `web/lib/player-forecasts/nativeInputMaterialization.ts:59 (nativeInputManifest)`; `web/lib/player-forecasts/nativeInputMaterializa … (full text in the original packet)
- **Opus view (PFC-066):**
  - Method: Greedy grouping of items into rows under 8 MiB - 4096 bytes each, total <= 64 MiB; originals <= 1 MiB body, parents <= 2 MiB; closure available_at = latest captured instant in group; manifest hash over key/hash/availableAt; verification reproduces from durable originals (180 s deadline, 8 s per read). Re-runs native snapshot builders (buildNativeSkaterBaselineSnapshot) to check derived inputs.
  - Inputs/units: bytes; microsecond timestamps; sources: player_forecast_source_observations
  - Output scale: row groups; SHA-256 manifests; writes: player_forecast_source_observations
  - Status: live — (manual) scripts/native-baseline-cadence.ts
  - Consumers: scripts/native-baseline-cadence.ts; scripts/native-means-replay.ts; nativeBaselineCadence; nativeDailyPipelineV2
- **Audit context:**
  - Intent (Opus): nativeInputMaterialization.ts:66 'Pure producer over an explicit acquisition packet. No collection or public-use grant.'; :283 'Reproduce from durable originals and standalone inputs, rather than trusting counts.'
  - Tests: `web/lib/player-forecasts/nativeBaselinePublication.test.ts`; `web/lib/player-forecasts/nativeDailyMeansCapture.test.ts`; `web/lib/player-forecasts/nativeDailyPipelineV2.test.ts`
- **Leads (not audited):**
  - (opus) size bounds are packing limits, not data-completeness checks; 1500 participation-input cap forces skater/goalie split days (A-14)

## M-PFC-109 Goalie start-basis compatibility and modeled start metadata mass check

- **Match:** Opus only; Opus PFC-072; Codex —
- **Purpose:** Null appearance-basis goalie volume heads when another head is start-basis; withhold modeled start metadata when team mass > 1.
- **Where:** `web/lib/player-forecasts/resolvedPlanningForecast.ts:19 (forecastFromContributions)`; `web/lib/player-forecasts/resolvedPlanningForecast.ts:100 (applyModeledStartMetadata)`; `web/lib/player-forecasts/resolvedPlanningForecast.ts:126 (mass > 1.000001)`
- **Opus view (PFC-072):**
  - Method: If any of SV/GA/SA/minutes uses non-appearance basis, appearance-basis baseline heads get unconditionalMean=null (incompatible_component_basis). Team-game start mass (confirmed=1) > 1.000001 removes start metadata.
  - Inputs/units: probabilities 0-1; per-appearance vs per-start means; sources: —
  - Output scale: probabilities 0-1; nulls on incompatible heads; writes: —
  - Status: live — called from resolvePlanningContributions
  - Consumers: planningContributions; gameExpectations
- **Audit context:**
  - Intent (Opus): resolvedPlanningForecast.ts:18 'Rebuild every displayed value and timestamp from the same selected target inputs'; :98 'Conflicting start metadata is withheld without reweighting'
  - Tests: `web/__tests__/components/RosterScheduleOptimizer/RosterScheduleOptimizer.test.tsx`; `web/lib/player-forecasts/planningContributions.test.ts`

## M-PFC-110 Challenger freeze assist labels from legacy pbp_plays

- **Match:** Opus only; Opus PFC-076; Codex —
- **Purpose:** Derives A1/A2 per player-game and decomposition completeness for the validation challenger
- **Where:** `modeling/player_forecasts/challenger_freeze.py:18 (CHALLENGER_SKATER_QUERY)`
- **Opus view (PFC-076):**
  - Method: A1 = count goals with assist1 = player; A2 likewise; complete when A1+A2 = boxscore assists; team = roster team else shift-chart team (min)
  - Inputs/units: counts; sources: pbp_plays, skatersGameStats, nhl_api_game_roster_spots, shift_charts, games, players
  - Output scale: A1/A2 counts per player-game; writes: file: challenger skaters.jsonl
  - Status: draft — validation-only challenger (CLI freeze-validation-challenger, __main__.py:57); promotionEligible False; consumed only by the functions inference worker, which is flagged off
  - Consumers: challenger_features
- **Audit context:**
  - Intent (Opus): docs/player-projections/validation-challenger-evidence-2026-08-04.md 'Source audit' (:23)
  - External references: NHL official scoring
  - Tests: none listed
- **Leads (not audited):**
  - (opus) uses legacy pbp_plays, while season.py uses nhl_api_pbp_events + WGO + Gamecenter resolution - two inconsistent A1/A2 label sources

## M-PFC-111 Season skater game-label construction (TOI split, assists, strength splits)

- **Match:** Opus only; Opus PFC-077; Codex —
- **Purpose:** Builds per-player-game training labels for 37 skater targets from boxscore, normalized PBP and WGO rows
- **Where:** `modeling/player_forecasts/season.py:186 (SKATER_QUERY)`
- **Opus view (PFC-077):**
  - Method: TOTAL_TOI=mm*60+ss; EV_TOI=greatest(0,TOI-PP_TOI-SH_TOI); PP/PK TOI parsed from boxscore mm:ss; FACEOFFS_WON/LOST from 'won/taken' string (lost=taken-won); pbp_complete when PBP goal count equals boxscore goal count; assist label priority: source_conflict->null, PBP complete->PBP A1/A2, WGO (if wgo assists=A1+A2)->WGO, boxscore 0->0, else null; PP/SH goals fall back to WGO else 0; EV/PP/SH/EN goal+assist splits only when PBP complete; OVERTIME/EMPTY_NET goals PBP else WGO; EMPTY_NET_POINTS=EN G+EN A1+EN A2; ASSIST_LABEL_BOX_SCORE_DELTA=(A1+A2)-boxscore assists; team via min(shift.team_id)
  - Inputs/units: TOI as 'mm:ss' strings converted to seconds; counts per game; sources: skatersGameStats, games, nhl_api_shift_rows, nhl_api_pbp_events, nhl_api_game_payloads_raw, wgo_skater_stats
  - Output scale: per-player-game counts and seconds; writes: file: season freeze skaters.jsonl
  - Status: unknown — run manually via `python -m modeling.player_forecasts season-freeze` (modeling/player_forecasts/__main__.py:102; docs/player-projections/player-forecasts-runbook.md:512-531); bundles imported by web/scripts/import-player-forecast-season.ts (npm import:player-forecast-season) into player_forecast_season_* read by page … (full text in the original packet)
  - Consumers: _select_rate_policy / train_season_artifact (season.py); _assist_label_audit; _fantasy_metric_source_audit
- **Audit context:**
  - Intent (Opus): Assist label policy and source precedence: docs/player-projections/research-contract-v3-season.json / docs/player-projections/research-contract-v4-season-fantasy.json; docs/player-projections/player-forecasts-runbook.md '2026–27 season projection workflow' (:454)
  - External references: NHL official boxscore/Gamecenter definitions; NST per-strength TOI convention (EV=5v5+4v4+3v3)
  - Fixtures/test data: `modeling/player_forecasts/tests/test_harness.py`; `generated (not in repo): <season artifact dir>/season-artifact.json goldenVectors built at modeling/player_forecasts/season.py:3850`
  - Tests: `modeling/player_forecasts/tests/test_harness.py`
- **Leads (not audited):**
  - (opus) daily_board_data.py:165 states skatersGameStats powerPlayToi/shorthandedToi are ingestion placeholders (often 00:00) and refuses to derive EV by subtraction, yet this query derives PP_TOI, PK_TOI and EV_TOI from exactly those columns
  - (opus) PP_GOALS/SH_GOALS fall back to 0 when neither PBP nor WGO exists, while assists fall back to null - inconsistent missing-data semantics
  - (opus) team assignment uses min(team_id) from shifts; traded-in-game or data errors silently pick lower id

## M-PFC-112 Season-total exposure labels and identity audit

- **Match:** Opus only; Opus PFC-078; Codex —
- **Purpose:** Loads WGO season totals as exposure-model outcomes and audits A=A1+A2, P=G+A, TOI=EV+PP+PK
- **Where:** `modeling/player_forecasts/season.py:471 (SKATER_SEASON_TOTALS_QUERY)`; `modeling/player_forecasts/season.py:1013 (_season_total_outcome_audit)`
- **Opus view (PFC-078):**
  - Method: TOTAL_TOI = toi_per_game * games_played; EV/PP/PK TOI taken as stored totals; audit flags rows where \|A1+A2-A\|>1e-6, \|G+A-P\|>1e-6 or \|TOTAL_TOI-(EV+PP+PK)\|>2.0 seconds; any invalid row makes the whole source ineligible
  - Inputs/units: WGO toi_per_game and strength TOI assumed seconds; season totals; sources: wgo_skater_stats_totals
  - Output scale: per-player-season totals; audit counts; writes: file: skater_season_totals.jsonl, file: season-total-outcome-audit.json
  - Status: unknown — run manually via `python -m modeling.player_forecasts season-freeze` (modeling/player_forecasts/__main__.py:102; docs/player-projections/player-forecasts-runbook.md:512-531); bundles imported by web/scripts/import-player-forecast-season.ts (npm import:player-forecast-season) into player_forecast_season_* read by page … (full text in the original packet)
  - Consumers: _weighted_exposure_summary / apply_exposure_rate (v4 serving rates)
- **Audit context:**
  - Intent (Opus): docs/player-projections/season-scoring-model-audit-2026-08-28.md 'Repaired model path' (:42) - season totals as exposure-model outcomes
  - External references: NHL.com/WGO season summary definitions
  - Tests: none listed
- **Leads (not audited):**
  - (opus) TOTAL_TOI multiplies toi_per_game by GP while EV/PP/PK use stored totals; the 2-second tolerance assumes both are seconds and that rounding of toi_per_game is negligible over 82 games
  - (opus) a single bad row blocks the whole exposure model (all-or-nothing gate)

## M-PFC-113 Season goalie game labels (starter, decisions, shutout, quality start)

- **Match:** Opus only; Opus PFC-079; Codex —
- **Purpose:** Derives goalie per-game targets including wins/losses/OTL, shutouts and quality starts
- **Where:** `modeling/player_forecasts/season.py:501 (GOALIE_QUERY)`
- **Opus view (PFC-079):**
  - Method: goalie_order = row_number by TOI desc per team-game; GAMES_STARTED=1 for order 1 with TOI>0; WINS for order 1 when team outcome WIN; LOSSES when LOSS and no OT/SO period; OTL when LOSS and any OT/SO period; SHOTS_AGAINST = denominator of 'saves/shots'; SHUTOUTS when GA=0, order 1 and TOI>=3540s; QUALITY_STARTS when order 1, TOI>=3540s and (GA<=2 or SV%>=0.917)
  - Inputs/units: TOI seconds; 'saves/shots' string; SV% as fraction 0-1 (0.917); sources: goaliesGameStats, games, gameOutcomes, nhl_api_shift_rows, nhl_api_pbp_events, nhl_api_game_payloads_raw
  - Output scale: 0/1 per game indicators; counts; seconds; writes: file: season freeze goalies.jsonl
  - Status: unknown — run manually via `python -m modeling.player_forecasts season-freeze` (modeling/player_forecasts/__main__.py:102; docs/player-projections/player-forecasts-runbook.md:512-531); bundles imported by web/scripts/import-player-forecast-season.ts (npm import:player-forecast-season) into player_forecast_season_* read by page … (full text in the original packet)
  - Consumers: season goalie rate policies; evaluate_season_game
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED (QS rule not explained in code; see docs/player-projections/research-contract-v4-season-fantasy.json targets)
  - External references: NHL decision rules (win/loss credited to goalie in net for the deciding goal, not the max-TOI goalie); Vollman quality start (SV% >= league average ~.913, or >= .885 with <=20 shots)
  - Tests: none listed
- **Leads (not audited):**
  - (opus) starter is defined as max-TOI goalie, and W/L/OTL are credited to that goalie, which mislabels games where the relief goalie got the decision
  - (opus) quality start uses an ad-hoc 'GA<=2 OR SV%>=.917' rule, not Vollman's definition and not a named fantasy-platform rule
  - (opus) shutout requires 59 minutes, so shared shutouts and relief appearances are excluded; GA includes empty-net goals only if boxscore includes them

## M-PFC-114 Assist label audit and official Gamecenter correction

- **Match:** Opus only; Opus PFC-080; Codex —
- **Purpose:** Audits assist label provenance and overwrites unresolved/disagreeing rows with official Gamecenter landing assists
- **Where:** `modeling/player_forecasts/season.py:842 (_assist_label_audit)`; `modeling/player_forecasts/season.py:1067 (_official_landing_assist_labels)`; `modeling/player_forecasts/season.py:1105 (_resolve_unresolved_assist_labels)`
- **Opus view (PFC-080):**
  - Method: Per goal: first listed assist = primary, second = secondary; strength 'pp'/'sh' increments PP/SH assist and PP/SH goal counts; rows unresolved or disagreeing with boxscore are rewritten with official primary/secondary/PP/SH values and ASSIST_LABEL_BOX_SCORE_DELTA recomputed; audit checks label vs boxscore with abs_tol 1e-9
  - Inputs/units: assist counts per goal; strength strings 'pp'/'sh'; sources: NHL api-web gamecenter landing (network), season freeze skaters.jsonl
  - Output scale: integer assist/PP/SH counts per player-game; writes: file: skaters.jsonl (rewritten), file: assist-label-audit.json
  - Status: unknown — run manually via `python -m modeling.player_forecasts season-freeze` (modeling/player_forecasts/__main__.py:102; docs/player-projections/player-forecasts-runbook.md:512-531); bundles imported by web/scripts/import-player-forecast-season.ts (npm import:player-forecast-season) into player_forecast_season_* read by page … (full text in the original packet)
  - Consumers: train_season_artifact gate (unresolvedRows must be 0)
- **Audit context:**
  - Intent (Opus): WGO used only as settled outcome labels, never predictive (season.py review wgoSettledOutcomeLabelsUsed); docs/player-projections/season-scoring-model-audit-2026-08-28.md 'Audited evidence' (:25)
  - External references: NHL official scoring summary
  - Fixtures/test data: `modeling/player_forecasts/tests/test_harness.py`
  - Tests: `modeling/player_forecasts/tests/test_harness.py`
- **Leads (not audited):**
  - (opus) correction rewrites PP_ASSISTS/SH_ASSISTS but not the v4 split columns PP_PRIMARY_ASSISTS, PP_SECONDARY_ASSISTS, SH_*, EV_*, EN_* - corrected rows can violate PP_ASSISTS = PP_A1 + PP_A2
  - (opus) EN/EV strength not derived from official landing, so EMPTY_NET_POINTS stays on the pre-correction source

## M-PFC-115 Native participation frame accounting (P/Z/O/K/U dispositions)

- **Match:** Opus only; Opus PFC-083; Codex —
- **Purpose:** Historical frame accounting of cohort players across opportunities into positive/zero/other/no-occurrence/unknown.
- **Where:** `web/lib/player-forecasts/nativeParticipationFrame.ts:3 (nativeParticipationWindow)`; `web/lib/player-forecasts/nativeParticipationFrame.ts:7 (nativeParticipationCohortIds)`; `web/lib/player-forecasts/nativeParticipationFrame.ts:81 (validateNativeParticipationFrame)`; `web/lib/player-forecasts/nativeParticipationFrame.ts:180 … (full text in the original packet)
- **Opus view (PFC-083):**
  - Method: Decision cutoff = scheduled start - 1 hour; dispositions P (toi>0), Z (toi=0), O (not listed for either club), K (did not occur), U_frame/U_label (unknown). Admitted counts X=P, N=P+Z only if no frame issues/unknowns.
  - Inputs/units: toiSeconds (seconds); microsecond clocks; sources: —
  - Output scale: disposition counts; X (positive) and N (positive+zero); writes: —
  - Status: legacy/dead — no non-test callers found
  - Consumers: none outside tests found
- **Audit context:**
  - Intent (Opus): nativeParticipationFrame.ts:80 'Pure historical frame accounting. No probabilities, acquisition, fitting or issuance.'
  - Tests: `web/lib/player-forecasts/nativeParticipationFrame.test.ts`
- **Leads (not audited):**
  - (opus) hard-coded season 20262027, window to 2026-10-13T05:00Z and 17 cohort player IDs
  - (opus) no non-test consumers found (possible dead code)

## M-PFC-116 Lineup/goalie text classification and lineup completeness

- **Match:** Opus only; Opus PFC-085; Codex —
- **Purpose:** Classify goalie-start and injury text and compute lineup snapshot completeness.
- **Where:** `web/lib/player-forecasts/sourceObservations.ts:94 (goalieObservationStatus)`; `web/lib/player-forecasts/sourceObservations.ts:108 (injuryObservationStatus)`; `web/lib/player-forecasts/sourceObservations.ts:439 (completeness denominator)`
- **Opus view (PFC-085):**
  - Method: Regex keyword precedence: could/might/may/if -> projected; ruled out/not starting -> ruled_out; confirmed/will start/gets the start -> confirmed; likely/probable -> likely; projected/expected -> projected; else unconfirmed. Completeness = min(1, assignments/20) for lineup/practice_lines/power_play; injury uses max(1, n).
  - Inputs/units: free text; assignment counts; sources: line/goalie source rows (tweets, lines sites)
  - Output scale: categorical status; completeness 0-1; writes: player_forecast_lineup_snapshots, player_forecast_lineup_assignments, player_forecast_goalie_start_observations, player_forecast_observation_conflicts
  - Status: unknown — /api/v1/db/update-line-sources and lib/sources/tweetProjectionStorage.ts; no vercel.json cron found; capture gated by starterBoardFlags().capture
  - Consumers: Starter Board capture RPCs; readiness
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Tests: `web/__tests__/pages/api/v1/db/update-line-sources.test.ts`; `web/lib/player-forecasts/playerForecasts.test.ts`
- **Leads (not audited):**
  - (opus) power_play completeness denominator is 20 although PP units list ~10 players, so a full PP report scores ~0.5
  - (opus) 'if'/'may' anywhere demotes an explicit 'confirmed' text to projected

## M-PFC-117 PP evidence packet consistency checks

- **Match:** Opus only; Opus PFC-086; Codex —
- **Purpose:** Validates PP window exposure sums and outcome accounting in captured evidence
- **Where:** `modeling/player_forecasts/pp_evidence_capture.py:466 (_window)`; `modeling/player_forecasts/pp_evidence_capture.py:575 (_outcomes)`; `modeling/player_forecasts/pp_evidence_capture.py:629 (_coverage)`
- **Opus view (PFC-086):**
  - Method: sum(member pp_seconds) must equal cumulative window seconds (abs_tol 1e-6); PP shots <= total shots; shots>0 requires seconds>0; zeros need source-zero proof; coverage counts recomputed
  - Inputs/units: PP seconds; shot counts; sources: captured FORGE snapshots (rolling_player_game_metrics reads)
  - Output scale: pass/fail; writes: file: evidence packet
  - Status: draft — explicitly invoked evidence recorder (modeling/player_forecasts/pp_evidence_capture.py:1); no forecasting or serving
  - Consumers: pp_shot_support evaluation
- **Audit context:**
  - Intent (Opus): pp_evidence_capture.py:1 docstring; docs/player-projections/forge-pp-shot-evidence-packet.md
  - Fixtures/test data: `modeling/player_forecasts/tests/test_harness.py`
  - Tests: `modeling/player_forecasts/tests/test_harness.py`

## M-PFC-118 Season projection draft validation gates

- **Match:** Opus only; Opus PFC-092; Codex —
- **Possible related records (low-confidence location link, unconfirmed):** season-derived-assists, season-derived-empty_net_points, season-derived-ev_assists, season-derived-ev_points, season-derived-expected_assists, season-derived-faceoff_percentage, season-derived-goals_against_average, season-derived-goals_saved_above_expected, season-derived-high_danger_save_percentage_goalie, season-derived-high_danger_saves_goalie, season-derived-long_range_save_percentage_goalie, season-derived-long_range_saves_goalie, season-derived-mid_range_save_percentage_goalie, season-derived-mid_range_saves_goalie, season-derived-on_ice_cf_percentage, season-derived-on_ice_ff_percentage, season-derived-on_ice_xgf_percentage, season-derived-points, season-derived-points_per_game, season-derived-pp_assists …
- **Purpose:** Block a season projection release whose schedule shape, rosters, expected games/starts, derived stat identities, quantiles or role probabilities are invalid.
- **Where:** `web/lib/fantasy-projections/validation.ts:41 (validateSeasonDraft)`; `web/lib/fantasy-projections/validation.ts:37 (nearlyEqual)`; `web/lib/fantasy-projections/contracts.ts:457 (reconcileProjectionValues, used for identities)`; `web/lib/fantasy-projections/admin.ts:1086 (caller)`
- **Opus view (PFC-092):**
  - Method: Contract checksum must match the supported contract. Schedule must have exactly 1344 games, 32 teams with 84 games each. Each non-waived team needs at least 12 F, 6 D and 2 G. expectedGames must be in [0,84], and goalie expectedStarts in [0, expectedGames]. The required primitive targets for the contract (v4 fantasy / v5 advanced batches) must be finite. Each published value must equal its reconciled identity (e.g. SAVES = SA − GA, SV% = saves/SA, GAA = 3600·GA/TOI_seconds) within a relative tolerance of 1e-6·max(1,\|a\|,\|b\|). p10 <= p50 <= p90 for every target. Each role-probability family must have values in [0,1] that sum to 1 within the same tolerance.
  - Inputs/units: season totals; TOI in seconds (GAA uses 3600); probabilities 0-1; sources: season draft artifacts assembled by fantasy-projections admin/seasonJobs
  - Output scale: list of issue codes (pass/fail gate); writes: —
  - Status: live — called from fantasy-projections admin release flow
  - Consumers: fantasy-projections admin release/publish path (admin.ts:1086)
- **Audit context:**
  - Intent (Opus): validation.ts:57 message: the runtime must match an approved season research contract; schedule/roster rules are UNDOCUMENTED beyond messages
  - Fixtures/test data: `web/lib/fantasy-projections/fantasyProjections.test.ts`
  - Tests: `web/lib/fantasy-projections/fantasyProjections.test.ts`
- **Leads (not audited):**
  - (opus) NHL season shape is hard-coded (1344 games, 32 teams, 84 games); any schedule change or expansion fails every release
  - (opus) identity check uses publishedValues[target] ?? expected, so a missing derived target passes silently (only primitives are checked for presence)
  - (opus) reconcileProjectionValues coerces non-finite inputs to 0 before deriving identities

## M-PFC-119 Season roster consensus and roster_confidence ladder

- **Match:** Opus only; Opus PFC-100; Codex —
- **Purpose:** Decide a player's organization and roster status from official observations (two-source agreement) and assign the roster_confidence that feeds the season projection model.
- **Where:** `web/lib/fantasy-projections/rosterIntegrity.ts:76 (resolveSeasonRosterConsensus)`; `web/lib/fantasy-projections/rosterIntegrity.ts:39 (finiteConfidence)`; `web/lib/fantasy-projections/rosterReconciliation.ts:214 (pool-status default 0.7/0.4)`; `web/lib/fantasy-projections/rosterReconciliation.ts:472-474 (observation confiden … (full text in the original packet)
- **Opus view (PFC-100):**
  - Method: Take the latest non-superseded observation per kind. Fewer than 2 official kinds → review_required, confidence = that single source's confidence (or 0). Distinct teams, or unsigned plus a team → review_required, confidence = max. Automatic only when roster+landing agree on a team, or landing+transaction agree (team, or both unsigned); then confidence = min of the agreeing pair, with roster status from the pair (disagreement → review, max). Observation confidence bands: official transaction = clamp(conf, 0.9, 1), default 0.95; other evidence = clamp(conf, 0, 0.89), default 0.75. roster_confidence = consensus.confidence when automatic, 1 when manually resolved, otherwise the prior value or 0.4. Pool-status default is 0.7 if verified_active, else 0.4. Roster and transaction data count as stale after 36 h.
  - Inputs/units: confidence fraction 0-1; timestamps ISO; sources: player_forecast_season_roster_observations (latest_player_forecast_season_roster_observations RPC), player_forecast_season_roster_snapshots, IFTTT/X transaction events (normalized evidence)
  - Output scale: confidence 0-1; categorical resolution; writes: player_forecast_season_roster_observations (confidence), player_forecast_season_roster_conflicts / _conflict_members / _conflict_resolutions, player_forecast_season_roster_snapshots members (roster_confidence), player_forecast_season_player_pool_review
  - Status: live — player-forecasts season roster reconciliation jobs (rosterReconciliation.ts → seasonJobs.ts)
  - Consumers: web/lib/fantasy-projections/seasonJobs.ts:912 (rosterAdjustedPrior.rosterConfidence); modeling/player_forecasts/season.py:3625 (rating confidence = max(historical*0.75, evidence) * roster_confidence); web/pages/fantasy-projections.tsx:236 (confidenceLabel High >= 0.8, Medium >= 0.55, else Low; confidence filter); web/lib/fa … (full text in the original packet)
- **Audit context:**
  - Intent (Opus): web/lib/fantasy-projections/rosterIntegrity.ts:103/151 summaries: an automatic roster change needs two current official sources (an approved roster+landing or landing+transaction pair); otherwise UNDOCUMENTED
  - Fixtures/test data: `web/lib/fantasy-projections/fantasyProjections.test.ts`
  - Tests: `web/lib/fantasy-projections/fantasyProjections.test.ts`
- **Leads (not audited):**
  - (opus) three unrelated default confidence ladders: TS pool status 0.7/0.4 (rosterReconciliation.ts:214), Python 0.85/0.55/0.4 (season.py:1490), and observation bands 0.95/0.75 capped at 0.89 for non-official sources
  - (opus) roster_confidence multiplies the season model's rating confidence, so roster-bookkeeping heuristics change projection confidence
  - (opus) review_required conflict cases still report the MAX confidence of the disagreeing sources, so a conflicted player can look highly confident
  - (opus) manual resolution sets confidence to 1, the highest possible
  - (opus) transaction coverage windowStart is hard-coded to 2026-06-16T00:00:00Z (readiness.ts) and staleness to 36 h

## M-PFC-120 Baseline/goalie contribution bundle assembly and unit labeling

- **Match:** Opus only; Opus PFC-101; Codex —
- **Purpose:** Turn rate snapshots into ContributionSource rows (mean, unit, basis) with checksums.
- **Where:** `web/lib/player-forecasts/baselineGeneration.ts:52 (buildBaselineContributionBundle)`; `web/lib/player-forecasts/baselineGeneration.ts:97 (unit assignment)`; `web/lib/player-forecasts/goalieBaselineRates.ts:310 (buildGoalieContributionBundle)`
- **Opus view (PFC-101):**
  - Method: mean = ratePerAppearance; unit 'minutes' for PENALTY_MINUTES and native TIME_ON_ICE_PER_GAME, GOALIE_MINUTES; else count. Validation rejects negative rates (except PLUS_MINUS), per-start or native W/SO rates > 1, bundles > 20 goalie snapshots.
  - Inputs/units: rates per appearance/start; sources: —
  - Output scale: ContributionSource.mean in count or minutes units; writes: player_forecast_source_observations (via contributionStore)
  - Status: live — buildBaselineContributionBundle called by nativeCadenceOutputPreparation (daily pipeline)
  - Consumers: planningContributions; nativeCadenceOutputPreparation
- **Audit context:**
  - Intent (Opus): baselineGeneration.ts:51 'Build an unreleased bundle from immutable, cutoff-stamped rate snapshots.'
  - Tests: `web/lib/player-forecasts/contributions.test.ts`; `web/lib/player-forecasts/goalieBaseline.test.ts`; `web/lib/player-forecasts/nativeBaselinePublication.test.ts`; `web/lib/player-forecasts/nativeContributionAdmission.test.ts`
- **Leads (not audited):**
  - (opus) PENALTY_MINUTES labeled unit 'minutes' here but gameExpectations.ts:89/202 fallback labels it 'count' when no contribution row exists; mixed rows can yield 'incompatible_units' totals

