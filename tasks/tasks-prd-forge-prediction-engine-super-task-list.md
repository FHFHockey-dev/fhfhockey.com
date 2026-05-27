# FORGE Prediction Engine Super Task List

## Purpose

This file consolidates the overlapping prediction, sustainability, trend, goalie, lineup, SoS, sKO, dashboard, and game-prediction task lists into one operating plan.

The shared trunk is:

1. Ingest reliable player, team, goalie, schedule, lineup, and market context.
2. Convert historical performance into rolling features and sustainable baselines.
3. Apply current-state context: lines, injuries, roster vacancies, PP units, goalies, opponent strength, rest, and schedule.
4. Project individual player and goalie outcomes.
5. Reconcile player projections into team outputs.
6. Use team/player/goalie aggregates to predict games.
7. Backtest, calibrate, explain, serve, and monitor the system.

This consolidation intentionally does not force every task into the same model. Some branches are serving, observability, UI, or research layers. They remain in this file because they are necessary to make the prediction system usable and trustworthy.

## Relevant Files

- `web/lib/projections/run-forge-projections.ts` - Canonical FORGE skater, goalie, and team projection runner.
- `web/lib/game-predictions/featureBuilder.ts` - Game-prediction feature construction, source cutoffs, roster/SoS context, and fallback warnings.
- `web/lib/game-predictions/baselineModel.ts` - Game-prediction model contract, feature vector, output payload, probability floors, and explainability factors.
- `web/lib/sustainability/score.ts` - Canonical TypeScript sustainability score builder.
- `web/lib/sustainability/backtest.ts` - Sustainability baseline comparison helper.
- `web/lib/sustainability/guardrails.ts` - Sustainability score/dashboard guardrails.
- `web/lib/projections/rosterEvents.ts` - Canonical `forge_roster_events` mapping and preflight helpers.
- `web/pages/api/v1/db/run-projection-v2.ts` - Projection execution route and freshness preflight gate surface.
- `web/pages/api/v1/runs/[runId].ts` - Projection run detail API.
- `web/pages/api/v1/forge/roster-events.ts` - Admin CRUD API for curated roster events.
- `web/pages/api/v1/sustainability/trends.ts` - Sustainability dashboard serving endpoint with guarded output.
- `web/components/forge-dashboard/SustainabilityCard.tsx` - Dashboard sustainability card.
- `web/lib/predictions/contracts.ts` - Shared prediction metadata and source freshness contracts.
- `web/lib/predictions/rollingWindows.ts` - Canonical persisted rolling-window and sustainability-window definitions.
- `web/lib/predictions/sourceOwnership.ts` - Source/stage ownership map and sKO quarantine decision.
- `web/lib/predictions/legacyQuarantine.ts` - Legacy/adjacent artifact quarantine inventory.
- `web/lib/predictions/pipelineCronAlignment.ts` - Cron-versus-pipeline dependency alignment report helper.
- `web/lib/predictions/sourceProvenance.ts` - Game-prediction source provenance row builder and upsert helper.
- `tasks/artifacts/forge-prediction-operator-runbook.md` - Operator runbook for reruns, triage, and rollback.

### Notes

- Treat this file as the active implementation plan; the 11 merged source files remain historical traceability inputs.
- sKO is quarantined unless it gains persisted feature importances, validation metrics, freshness metadata, and promotion gates.
- Lineup, goalie, injury, and roster-event work is prediction context, not isolated UI work.

## Source Map




- A: `tasks/PRD/prd-projection-model.md` - FORGE player/team/goalie projection engine.
- B: `tasks/PRD/prd-sko-charts.md` - sKO player evaluation/prediction charts and model transparency.
- C: `tasks/PRD/prd-rolling-player-averages.md` - rolling player metric foundation.
- D: `tasks/TASKS/tasks-forge-dashboard-component-remediation.md` - FORGE dashboard trust, freshness, ownership, and component remediation.
- E: `tasks/TASKS/tasks-prd-forge-trends-combo-project.md` - combined FORGE/Trends dashboard.
- F: `tasks/TASKS/tasks-prd-sustainability-barometer.md` - sustainability barometer pipeline and UI.
- G: `tasks/TASKS/tasks-prd-sustainability-model.md` - sustainability feature/model/API layer.
- H: `tasks/TASKS/tasks-skater-forge.md` - skater-specific FORGE projection improvement.
- I: `tasks/sustainability-trends-plan.md` - volatility/elasticity trend bands.
- J: `tasks/tasks-prd-nhl-game-prediction-model.md` - NHL game prediction model, serving, scoring, health.
- K: `tasks/tasks-prd-nhl-game-prediction-roster-sos-model.md` - roster-adjusted and SoS-adjusted game prediction improvements.

## Current Repo Wiring Audit

- FORGE already has a real pipeline trunk in `web/lib/rollingForgePipeline.ts`: core entities -> NST/WGO skater sources -> contextual builders -> rolling metrics -> projection input ingest -> derived projection tables -> projection execution -> accuracy/monitoring.
- FORGE execution exists in `web/lib/projections/run-forge-projections.ts`, with skater rolling rows, team context, line combinations, goalie model inputs, uncertainty, and reconciliation.
- FORGE route gates exist in `web/pages/api/v1/db/run-projection-v2.ts`, including checks for line combinations, projection ingest, derived rows, goalie start priors, stale goalie rows, and goalie roster drift.
- Projection-derived builders exist in `web/pages/api/v1/db/build-projection-derived-v2.ts` and `web/lib/projections/derived/*`, writing `forge_player_game_strength`, `forge_team_game_strength`, and `forge_goalie_game`.
- Goalie projection logic exists in `web/lib/projections/goalieModel.ts`, `web/lib/projections/calculators/goalie-starter.ts`, and `web/pages/api/v1/db/update-goalie-projections-v2.ts`.
- Line-combination evidence is already consumed by FORGE in `web/lib/projections/queries/line-combo-queries.ts` and by game predictions in `web/lib/game-predictions/featureBuilder.ts`.
- Game prediction scaffolding is substantial: `web/lib/game-predictions/featureBuilder.ts`, `baselineModel.ts`, `workflow.ts`, `evaluation.ts`, `adminHealth.ts`, and API routes under `web/pages/api/v1/game-predictions/*`.
- Game prediction features already use team power, standings, WGO/NST team form, goalie starts, line combinations, accepted CCC goalie rows, goalie quality, rest, and source cutoffs.
- Sustainability has two overlapping implementations: TypeScript modules in `web/lib/sustainability/*` and Python modules in `functions/lib/sustainability/*`. These should be reconciled before new model work expands.
- sKO currently has serving/UI and a baseline endpoint at `web/pages/api/v1/ml/update-predictions-sko.ts`, but the richer PRD-mentioned `web/scripts/modeling/train.py`, `score.py`, and `upload_predictions.py` path is not present as active files. The current endpoint uses a moving-average baseline and writes `top_features: null`.
- SoS currently exists as simple latest-row opponent win percentage logic in `web/lib/trends/strengthOfSchedule.ts`, plus update and trend routes. The roster/SoS PRD wants as-of, opponent-adjusted, and backtestable features.
- Cron sequencing already includes the combined system in `web/rules/context/cron-schedule.md`: rolling metrics, line combos, goalie projections, FORGE projections, sustainability baselines/priors/window-z/score/bands, sKO, game-prediction snapshots, game-prediction scoring, and cron report.
- Some source docs have stale paths. Example: `tasks/PRD/prd-projection-model.md` references `web/rules/forge-tables.md`; the actual current file is `web/rules/context/forge-tables.md`.

## Consolidation Decision

Use one trunk and five branches.

- Trunk: data freshness, source contracts, rolling metrics, sustainability baselines, lineup/goalie context, FORGE projection execution, reconciliation, accuracy.
- Branch 1, Player projection: skater and goalie projection outputs for fantasy/user-facing player decisions.
- Branch 2, Game prediction: team aggregation, roster-adjusted matchup features, SoS, win probabilities, candlestick snapshots, scoring.
- Branch 3, Sustainability/trends: sustainable baseline, volatility bands, hot/cold/unsustainable flags, model explanations.
- Branch 4, sKO: keep only if it becomes a reusable player-stability/prediction/explainability layer; otherwise quarantine as legacy/adjacent.
- Branch 5, Serving/ops: FORGE dashboard, Trends combo dashboard, public predictions page, health checks, cron reports, route continuity.

## Pairwise Round-Robin Findings

| Pair | Relationship | Consolidation Decision |
| --- | --- | --- |
| A+B | FORGE and sKO both predict player value from historical performance. sKO is narrower and currently less wired. | Fuse only the useful sKO concepts: feature importances, stability multipliers, prediction transparency. Do not make sKO a second projection engine. |
| A+C | Rolling player averages feed FORGE skater usage/rates. | Fuse directly into trunk. C is a required upstream stage for A. |
| A+D | Dashboard remediation validates whether FORGE outputs are fresh/truthful. | Keep D as serving/observability branch downstream of A. |
| A+E | Combined dashboard is the product surface for FORGE + Trends. | Keep E downstream of A after contracts stabilize. |
| A+F | Sustainability barometer can supply regression/stability context to FORGE. | Fuse as baseline/stability feature layer, not as a separate prediction engine. |
| A+G | Sustainability model overlaps with FORGE rate priors and uncertainty. | Fuse into the baseline/volatility layer used by A. |
| A+H | Skater FORGE is a specialized branch of A. | Fully merge H into A's player-projection phase. |
| A+I | Trend bands quantify volatility around recent performance, useful for FORGE uncertainty. | Fuse into sustainability/uncertainty features. |
| A+J | FORGE projects players/teams; game prediction consumes team/player/goalie aggregates. | Keep J downstream of A, with optional FORGE features in game predictions. |
| A+K | Roster/SoS game-prediction features depend on FORGE-like player and goalie priors. | Fuse K as the matchup/game-prediction feature extension after A is trustworthy. |
| B+C | sKO uses rolling/recent player performance. | C is reusable upstream; B should consume C-derived features if retained. |
| B+D | sKO dashboard trust issues overlap with FORGE component remediation only at serving/health level. | Keep shared health/freshness conventions, not shared model code. |
| B+E | sKO may become a panel in the combined dashboard. | Defer until B is either promoted or quarantined. |
| B+F | sKO stability and sustainability barometer both describe stable vs volatile production. | Fuse concepts, but pick one canonical stability score contract. |
| B+G | Both define predictive player stability features. | Reconcile into one feature dictionary before modeling. |
| B+H | sKO skater prediction overlaps with Skater FORGE. | Fold useful sKO driver/top-feature UI into Skater FORGE; avoid duplicate skater predictions. |
| B+I | sKO sparkline/driver ideas overlap with trend-band visualization. | Reuse visualization ideas; keep trend bands as canonical volatility source. |
| B+J | sKO is player-level; game prediction is team-level. | Only connect through aggregated player impact if sKO is validated. |
| B+K | Roster impact could use sKO-like player priors. | Potential opaque connection; only fuse after sKO feature validity is proven. |
| C+D | Dashboard freshness depends on rolling metrics being current. | Add rolling freshness checks to dashboard remediation. |
| C+E | Combined dashboard needs one loading/cache layer for rolling-derived data. | Fuse through shared data-fetch and freshness contracts. |
| C+F | Barometer windows and rolling averages duplicate concepts. | Reconcile window definitions and canonical source tables. |
| C+G | Sustainability model explicitly depends on rolling windows. | Fuse C as upstream input to G. |
| C+H | Skater FORGE consumes rolling skater metrics. | Fuse C as required preflight gate for H. |
| C+I | Trend bands compute 1/3/5/10 windows; rolling metrics compute similar windows. | Use one canonical rolling-window provider. |
| C+J | Game prediction uses team form more than player rolling metrics today. | Connect via roster-adjusted player priors after individual player model stabilizes. |
| C+K | Roster priors need player rolling performance with team movement support. | Fuse C into K's player-impact-prior phase. |
| D+E | Both are dashboard/product-surface consolidation. | Fuse as one serving/route/UX phase. |
| D+F | Dashboard needs truthful sustainability freshness and degraded states. | Connect through serving health, not model math. |
| D+G | Same as D+F, with API/model outputs. | Add API freshness and score plausibility checks. |
| D+H | Dashboard must explain skater projection confidence. | Add Skater FORGE diagnostics to serving phase. |
| D+I | Trend-band staleness and volatility need correct UI labels. | Add band recency and fallback warnings to dashboard phase. |
| D+J | Game-prediction health page shares freshness/model-health concerns. | Reuse health-report patterns and cron audit conventions. |
| D+K | Roster/SoS warnings must be visible, not hidden in model metadata. | Add source warnings and factor explanations to serving phase. |
| E+F | Combined dashboard should surface sustainability outputs. | Attach barometer cards after F/G contracts are stable. |
| E+G | Combined dashboard needs sustainability APIs with stable response contracts. | Defer UI merge until API/freshness contract is proven. |
| E+H | Combined dashboard should include player/goalie projections and confidence drivers. | Merge after H player projection metadata exists. |
| E+I | Trend charts and volatility bands belong in the combined dashboard. | Add as trend branch in product phase. |
| E+J | Public game predictions may be a sibling or panel, not necessarily same dashboard. | Keep route separate unless IA explicitly merges it. |
| E+K | SoS/team matchup context belongs in the dashboard and prediction explainers. | Fuse into team-context/matchup panels. |
| F+G | Barometer and sustainability model are the same conceptual branch in two implementation styles. | Reconcile into one canonical sustainability model and one implementation owner. |
| F+H | Skater projections can use sustainability score/bands as regression and confidence context. | Feed F outputs into H after score validity is audited. |
| F+I | Barometer and trend-band plan are tightly coupled. | Fuse into one sustainability/volatility phase. |
| F+J | Game prediction can use sustainability only if aggregated reliably into team/roster features. | Defer direct J consumption until player-level evidence is validated. |
| F+K | Roster priors can use sustainability-adjusted player impact. | Fuse after F/G outputs have stable as-of semantics. |
| G+H | Sustainability model supplies skater feature engineering, priors, flags, and bands. | Fuse as skater-projection feature layer. |
| G+I | Trend bands are a persistence/visualization form of sustainability features. | Fuse. |
| G+J | Sustainability can influence game predictions via roster aggregation. | Use as optional feature set with ablation gates. |
| G+K | Sustainability-adjusted roster priors are a natural K feature. | Fuse after validation. |
| H+I | Skater FORGE needs volatility bands for uncertainty/floor/ceiling. | Fuse trend bands into skater uncertainty metadata. |
| H+J | Player projections aggregate into team/game predictions. | Make FORGE outputs optional but testable game-prediction inputs. |
| H+K | Skater priors and roster movement are central to K. | Fuse K's player-impact priors with H's skater model. |
| I+J | Volatility bands are not directly game-level today. | Connect only through aggregate player/roster volatility later. |
| I+K | Volatility can adjust roster-impact confidence. | Fuse as confidence modifier after core roster priors exist. |
| J+K | K is the next feature-generation phase for J. | Fully merge K into J as the model-improvement branch. |

## Tasks

- [x] 0.0 Establish the canonical prediction-engine contract
  - [x] 0.1 Treat this file as the active meta task list and freeze the 11 source files as historical inputs unless a source-specific task is intentionally revived.
  - [x] 0.2 Update stale source references, especially `web/rules/forge-tables.md` -> `web/rules/context/forge-tables.md`.
  - [x] 0.3 Create a source-to-stage ownership map for every table used by FORGE, sustainability, sKO, trends, SoS, and game predictions.
  - [x] 0.4 Decide canonical ownership for duplicate sustainability implementations: TypeScript `web/lib/sustainability/*`, Python `functions/lib/sustainability/*`, or an explicit split by runtime.
  - [x] 0.5 Decide canonical ownership for sKO: promote into the prediction trunk as feature importance/stability tooling, or quarantine as legacy/adjacent.
  - [x] 0.6 Define one shared model metadata contract: `modelName`, `modelVersion`, `featureSetVersion`, `asOfDate`, `sourceCutoffs`, `warnings`, `topFactors`, `calibration`, and `fallbackFlags`.
  - [x] 0.7 Define one shared freshness contract for all prediction surfaces: source date, requested date, effective date, stale threshold, fallback reason, and degraded-state label.
  - [x] 0.8 Add a document section or artifact that maps A-K tasks to this consolidated file so no source-list work is silently dropped.

- [x] 1.0 Stabilize upstream source freshness and pipeline health
  - [x] 1.1 Verify the active cron order in `web/rules/context/cron-schedule.md` against the real dependency graph in `web/lib/rollingForgePipeline.ts`.
  - [x] 1.2 Ensure core entities refresh before downstream stages: games, teams, players, rosters, standings, seasons.
  - [x] 1.3 Ensure NST/WGO skater, goalie, team, and totals sources complete before rolling metrics, sustainability, FORGE, sKO, and game predictions run.
  - [x] 1.4 Ensure line combinations and power-play combinations complete before rolling metrics and FORGE projection execution.
  - [x] 1.5 Ensure goalie projections, accepted lineup/goaltender tweet sources, and line combinations have consistent as-of semantics before game prediction snapshots.
  - [x] 1.6 Add or update source provenance rows for team power, CTPI, SoS, rolling metrics, sustainability, goalie starts, lineups, FORGE outputs, and game predictions.
  - [x] 1.7 Repair dashboard/source freshness issues from D: mixed effective dates, request-time timestamps, stale sustainability fallbacks, stale goalie coverage, stale CTPI/team power.
  - [x] 1.8 Re-run cron health and admin health checks until stale-source warnings are either fixed or explicitly classified.

- [x] 2.0 Make rolling player/team/goalie features the canonical historical performance foundation
  - [x] 2.1 Finish validation/logging for `update-rolling-player-averages` and confirm the cron route is the canonical source for player rolling windows.
  - [x] 2.2 Reconcile rolling-window definitions across C, F, G, H, and I: 1/3/5/10/20/25/50 game windows, cumulative season, career, and three-year baselines.
  - [x] 2.3 Document every player metric source and unit: TOI, ES/PP/PK splits, shots, iCF, iSCF, iHDCF, iXG, goals, assists, points, hits, blocks, IPP, PDO, on-ice shooting, zone starts, PP share.
  - [x] 2.4 Add validation payloads for rolling metrics so `trendsDebug.tsx` or replacement tooling can inspect metric-by-metric values.
  - [x] 2.5 Build team rolling/context features from team power, NST team logs, WGO team rows, CTPI, and SoS with as-of filtering.
  - [x] 2.6 Build goalie rolling/context features from `forge_goalie_game`, goalie unified views, WGO goalie stats, rest, workload, quality starts, and starter history.
  - [x] 2.7 Add source warnings when rolling rows are stale, sparse, compatibility-derived, or from fallback columns.

- [x] 3.0 Consolidate sustainability, volatility, and unsustainable-performance detection
  - [x] 3.1 Decide the canonical sustainability runtime and retire or document the non-canonical path.
  - [x] 3.2 Build one feature dictionary for sustainable production: recent rate, baseline rate, z-score, percentile, usage delta, context delta, opponent adjustment, reliability, and sample weight.
  - [x] 3.3 Finish data joins/windows from G against WGO, NST, rolling metrics, career baselines, and season totals.
  - [x] 3.4 Finish priors/posteriors from F/G: league priors, player priors, empirical Bayes shrinkage, reliability weighting, and soft clipping.
  - [x] 3.5 Finish volatility/elasticity bands from I: metric/window snapshots, confidence intervals, percentiles, and trend-band history.
  - [x] 3.6 Persist sustainability scores/bands with as-of metadata, model version, config hash, components JSON, and stale/fallback warnings.
  - [x] 3.7 Add rebuild endpoints for baselines, priors, window z-scores, scores, and trend bands with bounded batch/runtime controls.
  - [x] 3.8 Add backtests comparing sustainability outputs against career-only, season-only, recent-only, and naive baselines.
  - [x] 3.9 Add guardrails so impossible values or tiny-sample explosions cannot reach dashboard cards as ordinary predictions.

- [x] 4.0 Formalize lineup, injury, goalie, and roster-event state as prediction inputs
  - [x] 4.1 Treat confirmed goalies, likely goalies, injuries, lineup vacancies, callups, senddowns, line changes, and PP-unit changes as structured events, not UI-only annotations.
  - [x] 4.2 Use `forge_roster_events` as the canonical manual/curated override table unless a better table already owns the same concept.
  - [x] 4.3 Connect accepted tweet pattern review outputs and line-source ingestion into roster/lineup/goalie event writing with author/source provenance.
  - [x] 4.4 Normalize source priority for goalies: confirmed accepted tweet rows, explicit goalie projections, current line combinations, recent usage, fallback.
  - [x] 4.5 Add injury/absence logic that reduces or removes player projection opportunity and redistributes opportunity to plausible replacements.
  - [x] 4.6 Add line/PP-unit logic that adjusts TOI share, PP share, teammate assist coupling, and role scenario metadata.
  - [x] 4.7 Add preflight gates for stale lineups, missing current line combos, missing goalie priors, stale roster assignments, and unsupported fallback states.
  - [x] 4.8 Add tests proving confirmed goalies override probabilistic rows and stale/current-only lineup sources do not leak into historical backtests.

- [x] 5.0 Finish the FORGE player, goalie, and team projection engine
  - [x] 5.1 Validate `run-projection-v2` performance with batching/chunked upserts under nightly runtime constraints.
  - [x] 5.2 Implement or verify `/runs/{run_id}` detail API for run metadata, preflight gates, row counts, warnings, and metrics.
  - [x] 5.3 Implement admin endpoints for projection run triggers and `forge_roster_events` CRUD.
  - [x] 5.4 Complete skater rate modeling from H: team opportunities -> player shares -> conversion -> reconciliation.
  - [x] 5.5 Apply sustainability/band outputs to skater projection uncertainty, regression, floor/typical/ceiling, and confidence labels.
  - [x] 5.6 Improve goalie projections with scenario probabilities, save percentage context, workload/rest adjustments, quality/reliability tiers, and recommendations.
  - [x] 5.7 Ensure team projections reconcile from player/goalie outputs and expose team totals that equal player sums where hard constraints apply.
  - [x] 5.8 Add horizon support with clear decay/rest/schedule semantics and no unsupported future leakage.
  - [x] 5.9 Add launch gates: sample floors, MAE/RMSE, calibration/coverage bands, stale-data blockers, and rollback triggers.
  - [x] 5.10 Run shadow-mode comparisons for skater and goalie projections before changing defaults.

- [x] 6.0 Build roster-adjusted and SoS-adjusted game prediction features
  - [x] 6.1 Complete source-audit blockers from J before training/publishing any game prediction variant.
  - [x] 6.2 Promote or seed a production `game_prediction_model_versions` row only after documented backtest metrics exist.
  - [x] 6.3 Build player impact priors that survive roster movement using stable player IDs, team history, position, role, TOI share, and sustainability-adjusted recent form.
  - [x] 6.4 Aggregate expected roster into team features: skater offense, skater defense, goalie impact, special teams, PP context, injury/absence deltas.
  - [x] 6.5 Add confirmed/projected goalie starter handling with fallback to goalie-start probability or team-level goalie strength.
  - [x] 6.6 Build as-of SoS features from past opponent strength and future schedule difficulty without future leakage.
  - [x] 6.7 Adjust current form for opponent quality so weak-schedule runs do not inflate team strength.
  - [x] 6.8 Add time-dependent blend features: roster priors matter more early, current form matters more later, but injury/transaction context remains available.
  - [x] 6.9 Keep raw and adjusted forms side by side for ablations.
  - [x] 6.10 Add feature-source metadata and warnings for stale, incomplete, fallback, or current-only features.

- [x] 7.0 Train, backtest, calibrate, and promote models with evidence
  - [x] 7.1 Backtest FORGE player projections for the last 30 days and persist MAE, RMSE, interval coverage, and per-player/per-stat summaries.
  - [x] 7.2 Backtest game predictions with walk-forward or season-held-out validation and document acceptance criteria.
  - [x] 7.3 Add postgame scoring verification so metrics append/upsert without overwriting historical predictions.
  - [x] 7.4 Add game-prediction ablations: roster only, SoS only, roster+SoS, raw form vs adjusted form, per60 priors vs TOI-shrunk priors.
  - [x] 7.5 Add segment reporting for early season, mid season, late season, confirmed goalie, unconfirmed goalie, missing lineup, and stale-source cohorts.
  - [x] 7.6 Decide whether sKO should be replaced by the sustainability/FORGE feature layer, or rebuilt as a real model with feature importance.
  - [x] 7.7 If sKO is retained, implement a real model path with persisted `top_features`, feature importances, metrics, and nightly update controls.
  - [x] 7.8 Add calibration outputs and probability floors for all promoted game-prediction models.
  - [x] 7.9 Require model promotion gates before bumping `GAME_PREDICTION_FEATURE_SET_VERSION`, `BASELINE_MODEL_VERSION`, or FORGE model versions.

- [x] 8.0 Serve predictions, trends, and explanations through stable product surfaces
  - [x] 8.1 Consolidate FORGE and Trends data loading/cache strategy from E.
  - [x] 8.2 Repair dashboard component trust from D: freshness labels, mixed-date warnings, degraded states, ownership overlays, goalie coverage loss, and route continuity.
  - [x] 8.3 Add player projection explainers: role, PP share, line context, recent trend, sustainability state, matchup, rest, uncertainty, and fallback caveats.
  - [x] 8.4 Add goalie projection explainers: starter probability, confirmed status, workload/rest, modeled save percentage, quality/reliability tier, blowup risk.
  - [x] 8.5 Add game prediction explainers: top factors, roster deltas, goalie state, SoS adjustment, current form, source warnings, and prediction candlestick history.
  - [x] 8.6 Add sustainability UI: badges, sparklines, tooltips, volatility bands, hot/cold/unsustainable labels, and components tables.
  - [x] 8.7 Decide whether sKO charts remain a standalone route, become a panel, or are retired after feature parity exists elsewhere.
  - [x] 8.8 Verify empty/offseason/degraded states so missing data is never presented as neutral certainty.

- [x] 9.0 Operationalize the unified prediction pipeline
  - [x] 9.1 Add nightly scheduler wiring for any missing FORGE admin/run routes with `withCronJobAudit`.
  - [x] 9.2 Keep prediction work sliced under Vercel runtime ceilings with explicit limits, checkpoints, and resumable ranges.
  - [x] 9.3 Add run manifests for projection, sustainability, sKO, and game-prediction jobs.
  - [x] 9.4 Add cron report sections for stale sources, failed jobs, missing predictions, stale models, missing features, goalie warnings, and calibration drift.
  - [x] 9.5 Add health endpoints or extend existing health endpoints for FORGE, sustainability, sKO, and game predictions.
  - [x] 9.6 Add source-to-UI reconciliation checks for dashboard cards and public game-prediction pages.
  - [x] 9.7 Run targeted tests plus `tsc`, lint, and build after each trunk-stage change.
  - [x] 9.8 Maintain an operator runbook for reruns, backfills, stale-data triage, model rollback, and source outage handling.

- [x] 10.0 Consolidate or quarantine legacy/adjacent artifacts
  - [x] 10.1 Audit leftover sKO modeling artifacts and decide what belongs in the unified model tree.
  - [x] 10.2 Retire or isolate orphaned sKO chart/model paths that are not serving validated predictions.
  - [x] 10.3 Remove or document legacy start-chart materialization paths that duplicate FORGE outputs.
  - [x] 10.4 Remove dead dashboard routes/components only after replacement surfaces are validated.
  - [x] 10.5 Document any intentionally unmerged dots and why they remain separate.

## Logical Order Of Operations

1. Contract repair and ownership map.
2. Source freshness and cron dependency repair.
3. Rolling metric validation.
4. Sustainability/volatility consolidation.
5. Lineup, injury, goalie, and roster-event formalization.
6. FORGE player/goalie/team projection completion.
7. Game prediction roster/SoS feature completion.
8. Backtesting, calibration, promotion gates.
9. Product serving and dashboard consolidation.
10. Legacy quarantine/removal.

## Non-Shoehorned Dots

- sKO should not automatically become the core prediction model. It either contributes feature importance/stability UI or must be rebuilt and validated before promotion.
- Dashboard remediation and FORGE/Trends combo work are not model work. They are downstream trust and serving work.
- Sustainability should not remain two competing implementations. It must become one canonical feature/band layer or be clearly split by runtime responsibility.
- SoS is not only a dashboard stat. In the prediction tree it belongs as an as-of matchup adjustment with backtest evidence.
- Lineup and goalie confirmation work is not an isolated tweet-ingestion feature. It is current-state context for player projections, team aggregation, and game predictions.

## Definition Of Done For The Unified Tree

- A daily run can ingest/update source data, compute rolling features, rebuild sustainability/bands, ingest current lineup/goalie events, run FORGE projections, run game predictions, score completed outcomes, and emit a health report.
- Each prediction includes model version, feature set version, source cutoffs, warnings, top factors or explanations, and calibration/backtest metadata where applicable.
- Stale, missing, fallback, current-only, and degraded states are visible in APIs and UI.
- Player projections reconcile to team projections.
- Game predictions can explain how roster, goalie, SoS, current form, and team strength affected the output.
- Backtests show whether each promoted feature branch improves results versus simpler baselines.
- Any retained legacy/sKO/trend surfaces are explicitly connected to the trunk or quarantined.
