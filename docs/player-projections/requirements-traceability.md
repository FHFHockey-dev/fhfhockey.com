# Deep Research Plan requirements traceability

The 40-row matrix below preserves the original repository-audit baseline against
the externally supplied `projectionModel.md` requirements. It is historical
evidence, not the current Player Forecasts readiness state.

## Implemented successor status (August 2026)

The neutral Player Forecasts implementation now supplies the missing system
without changing FORGE. Its current local release is checksum-bound
`advanced-v5`; production activation and champion promotion remain separate
owner decisions.

| Capability | Current status | Authoritative implementation/evidence |
| --- | --- | --- |
| H1–H10 game forecasts and revision accountability | supported | Immutable forecast runs/outputs, queue watermarks, puck-drop cutoff enforcement, player candles, and settlement contracts under `web/lib/player-forecasts/` and `/api/v1/player-forecasts` |
| Opening, current full-season, and ROS forecasts | supported | Every remaining game is evaluated independently and aggregated under `modeling/player_forecasts/season.py`; public immutable releases are served by `/api/v1/fantasy-projections` |
| Availability, role, and goalie mixtures | supported | Separate play/start probabilities, conditional event rates, unconditional aggregation, role probabilities, and EV/PP/PK/goalie deployment |
| 2026–27 roster and schedule integrity | supported locally | 32 teams, 1,344 games, 84 games per team, append-only roster/transaction observations, conflict review, zero unresolved identities, scoped dirty jobs, and an opt-in daily roster/landing/official-transaction reconciliation Cron |
| Rookie and prospect projections | supported | Learned league-to-NHL transition model, separate roster/GP/deployment/rate layers, source coverage, wider intervals, and prior fallback in `modeling/player_forecasts/rookies.py` |
| Established-player context | supported with validation gates | Position/age, home/away, and back-to-back contextual challengers are trained inside rolling-origin folds and served only on chronological lift; line continuity, peer quality, and cutoff-safe NHL EDGE snapshots remain prospective/descriptive context until independently validated |
| Target-specific model tournament | supported | Population and empirical-Bayes baselines compete with regularized Poisson, negative-binomial, zero-heavy hurdle, and contextual challengers; sub-threshold lift falls back to the strongest baseline |
| Reconciled predictive distributions | supported | Portable seeded v5 copula simulation covers all v4/v5 primitives, reconciles arithmetic identities per draw, and produces deterministic aggregate tails in both Python batch and TypeScript incremental serving |
| Fantasy-facing v4 metrics | supported | Raw primitive targets, strength-state A1/A2, derived identities, provider scoring normalization, and client-side customizable scoring |
| Advanced v5 metrics | supported locally | Player/team shot attempts, unblocked attempts, xG/xA, danger/rush/rebound, on-ice shares, goalie xGA/GSAx/danger results, passing 50-target evaluation receipt, and cutoff-safe v5 settlement |
| Reproducibility and model governance | supported | Checksum-bound contracts/artifacts/receipts, chronological target policies, golden-vector replay, immutable release history, atomic active pointers, rollback, editor-only opening publication, and lineage-preserving long-lived assumption inheritance |
| Public and owner UX | supported locally | Compact summary API, 100-row pagination, global filters/sorting/scoring, role-specific columns, CSV, detail drawer, team ratings/lines, and sole-owner editor |
| Free operation | supported | Offline Python training, deterministic TypeScript incremental evaluation, Supabase trigger/queue/Cron design, and no new paid runtime or provider |

Final local acceptance uses healthy advanced-v5 current release 12 and ROS
release 9, each with 1,468 players and zero publication issues. Opening release
6 remains immutable. The active v5 checksum is
`1d2fb9fe4c4e9933158871231e471564a7424fe162e7f5e6b401ac81377df523`;
the v5 receipt passed all 50 targets and byte-identical golden-vector replay.
The learned rookie model now covers every NHL-mapped player in the active pool;
verified offseason-roster omissions remain in scope until positive evidence
changes their lifecycle.

The consumed 2025–26 lockbox is validation/training evidence, not new blind
evidence. Untouched 2026–27 prospective scoring is necessarily accumulated as
games occur and is the remaining promotion evidence, not an implementation
blocker for the private beta.

## Historical audit baseline

This matrix did not select a final model architecture; that selection is now
governed by the checksum-bound v3/v4/v5 research contracts.

Status values are the audit's required vocabulary: **supported**, **partially supported**, **present but unsafe**, **absent**, **duplicated**, **unknown pending data inspection**, and **intentionally deferred**.

| # | Requirement | Status | Repository evidence | Gap or interpretation |
| ---: | --- | --- | --- | --- |
| 1 | Next-game forecasts | supported | `web/lib/projections/run-forge-projections.ts`; `forge_player_projections`; `forge_goalie_projections`; `/api/v1/forge/*` | FORGE's daily path defaults to one scheduled game. Statistical validity is separate from functional support. |
| 2 | Next five scheduled team games | partially supported | FORGE accepts `horizon_games` 1–10; weekly horizon-5 ownership is retained by `supabase/migrations/20260730091500_consolidate_scheduler_ownership.sql`; `predictions_sko` defaults to five | FORGE aggregates a first-game context with schedule/rest scalars instead of recomputing opponent, lineup and opportunity per game; sKO is quarantined. |
| 3 | Next ten scheduled team games | partially supported | FORGE schema and runner support horizons through 10; `web/lib/sustainability/recompute.ts` exposes 10 | No scheduled horizon-10 owner was found; FORGE's aggregate-horizon semantics are not a game-by-game forecast. |
| 4 | Rest-of-season projections | absent | No canonical ROS writer, table or scheduled route found | Annual external projections are uploaded season totals, not a live ROS model. |
| 5 | Projected final full-season totals | partially supported | `PROJECTIONS_20252026_*`; `web/hooks/useProcessedProjectionsData.tsx`; `web/lib/projectionsConfig/proration.ts` | Third-party/current annual totals and per-82 transforms exist, but no canonical continuously updated internal final-total forecast exists. |
| 6 | Explicit forecast vintages | partially supported | `forge_runs.as_of_date`; run-scoped FORGE outputs; `predictions_sko.as_of_date`; game-prediction cutoff contracts; `web/lib/predictions/contracts.ts` | Player forecasts lack an issued-at cutoff instant and complete immutable source/feature manifest; same-date reruns can overwrite evaluation identity. |
| 7 | Raw hockey outcomes before fantasy scoring | supported | FORGE persists goals, assists, shots, strength-state TOI, hits, blocks and goalie shots/saves/GA before Start Chart/fantasy helpers | Some skater outputs such as PK events, PIM and plus/minus are null or incomplete, but fantasy scoring is downstream. |
| 8 | Probability of playing | partially supported | `goalie_start_projections.start_probability`; FORGE roster-event availability multipliers; rolling GP percentages | Goalies have a heuristic start probability. Skaters do not have a trained, calibrated play/scratch probability. |
| 9 | Opportunity and deployment forecasting | partially supported | FORGE role scenarios, line/PP context and TOI outputs; rolling line/PP fields; `web/lib/projections/stages/skater-stage.ts` | Current-state and hand-bounded role logic exists; no separately trained opportunity transition/TOI model. |
| 10 | Strength-state ice time | partially supported | `forge_player_projections.proj_toi_es_seconds`, `proj_toi_pp_seconds`, `proj_toi_pk_seconds`; strength-specific rolling tables | ES/PP are modeled; PK and several downstream strength outputs are incomplete. |
| 11 | Forward-specific treatment | partially supported | FORGE line-role grouping; TypeScript sustainability F priors; `web/lib/projections/stages/skater-stage.ts`; `web/lib/sustainability/priors.ts` | Forwards share the same event-generation formulas with defensemen; separation is mainly role/bounds/peer groups. |
| 12 | Defenseman-specific treatment | partially supported | FORGE defense-pair role tags and bounds; sustainability D priors; contextual-ranking D peer groups | No independent defenseman event-generation core or validated defense-specific target behavior. |
| 13 | Completely separate goalie treatment | supported | `web/lib/projections/goalieModel.ts`; goalie stage/query/calculator modules; `forge_goalie_projections`; separate goalie APIs/tests | The goalie branch is structurally separate from skaters, although its current heuristic semantics need replacement. |
| 14 | Conditional-on-start goalie projections | partially supported | Backup/top-starter branches inside FORGE uncertainty metadata; `web/lib/projections/goalieStarterMixtures.ts` | Conditional branches are not first-class canonical rows, and the separate mixture tables are absent from the active migration chain. |
| 15 | Unconditional goalie projections | partially supported | Persisted top-goalie row blends starter scenarios and carries `starter_probability`; FORGE goalie API | One row mixes selected-goalie identity with team-level blended outcomes, making conditional versus unconditional meaning inconsistent. |
| 16 | Game and opponent context | supported | Game/team/opponent IDs on FORGE rows; team, goalie, rest and opponent adjustment query/calculator modules | Current formulas are heuristic and some historical fallbacks can read later/current state. |
| 17 | Schedule context | partially supported | Scheduled game selection, rest/B2B scalars, Top Adds schedule context and team SoS utilities | Multi-game inference does not rebuild full context for every scheduled game; historical schedule revisions are not retained. |
| 18 | Lineup context | partially supported | `lineCombinations`, line-source snapshots, PP combinations, roster events and FORGE role scenarios | Prospective archive start/continuity is unknown; current roster/lineup state can leak into historical inference. |
| 19 | Player-specific partial pooling or adaptation | partially supported | Sustainability player Beta priors; FORGE small-sample shrinkage; goalie save-percentage shrinkage | Existing priors/weights are not jointly trained or validated against the required forecast targets. |
| 20 | Rookies and sparse-history players | partially supported | Sustainability `rookie_status`; FORGE small-sample/call-up fallbacks and pool recovery | No evaluated rookie/cold-start model or cohort-specific uncertainty calibration. |
| 21 | Injury returns | partially supported | `player_status_history`; `forge_roster_events` with `RETURN`; current status view | Prospective status collection is not clearly scheduled and historical coverage is unknown. |
| 22 | Trades | partially supported | FHFH organization history; roster effective intervals; player/team mapping code | Current `players.team_id` and roster flags still drive several historical queries; complete time-valid trade state is not enforced. |
| 23 | Abrupt deployment changes | partially supported | Line/PP changes, FORGE roster events, role scenarios and trend adjustments | Hand-coded response exists; no trained state-transition/opportunity model or complete pregame archive. |
| 24 | Predictive distributions | partially supported | FORGE `uncertainty` P10/P50/P90 simulations; sustainability 50/80 bands and distribution summaries; goalie scenario mixtures | Distributions are fixed Normal/Poisson approximations and scenario metadata, not a consistently versioned output contract. |
| 25 | Calibrated uncertainty | present but unsafe | `forge_projection_calibration_daily`; interval helpers; xG/game-prediction calibration infrastructure | Player intervals use hand-set noise and are not empirically calibrated; goalie launch-gate windows are mislabelled. |
| 26 | Sustainability classification | supported | Canonical `web/lib/sustainability/*`; daily score/window/band jobs; `sustainability_scores` | This is a descriptive/expectation score, not proof of future outcome lift. Historical rebuild leakage must be fixed before model use. |
| 27 | Hot/cold classification | duplicated | Sustainability luck-pressure ordering; ±8% trend page threshold; analytics sKO flags; sandbox `combineSKO` | Definitions have different meanings and hard-coded thresholds. No canonical calibrated hot/cold forecast exists. |
| 28 | Schedule-aware multi-game simulation | present but unsafe | FORGE seeded simulation and horizon rest scalars in `web/lib/projections/uncertainty.ts` and runner | One first-game context is scaled across the horizon; future opponents, lineups, opportunity and goalie distributions are not simulated per game. |
| 29 | Team/player reconciliation | partially supported | `web/lib/projections/reconcile.ts`; scenario blending; team TOI/shot targets and validation | Reconciliation covers selected opportunity/shot totals, not a complete independently modeled team goal/assist distribution. |
| 30 | Immutable as-of feature snapshots | partially supported | NHL raw snapshot heads/materialization receipts; game-prediction feature snapshots; xG feature/artifact versions | No player-forecast feature snapshot binds rolling, WGO/NST, lineup, roster and schedule state to each prediction. |
| 31 | Model and feature versioning | partially supported | Input parser/materializer versions; sustainability model/config identity; sKO model/version key; xG and game registries; FORGE Git SHA | FORGE statistical logic and player feature set have no complete top-level version/artifact identity on outputs. |
| 32 | Chronological backtesting | present but unsafe | xG/game-prediction chronological tooling; sustainability harness; FORGE “holdout” helpers; retired sKO artifacts | Player evidence is contaminated or incomplete: sustainability source leakage, sKO target leakage, and FORGE same-row comparisons are not honest walk-forward validation. |
| 33 | Automated outcome scoring | partially supported | FORGE result/accuracy routes and tables; game-prediction scoring/accountability; xG evaluation | FORGE scores latest-run fantasy aggregates, skips important goalie misses, and does not comprehensively score every raw target/vintage. Daily cron disables accuracy. |
| 34 | Calibration tracking | partially supported | FORGE calibration table; xG calibration audits; game-prediction metrics/accountability | Strong adjacent patterns exist, but player distributions/probabilities are not governed by them. |
| 35 | Champion–challenger comparison | partially supported | xG registry/challenger tooling; game-prediction model versions; FORGE skater rollout candidate helpers | No player-model registry or honest player challenger tournament drives production selection. |
| 36 | Promotion and rollback | partially supported | Atomic game-model promotion RPC; xG lifecycle states; FORGE promotion-gate helpers | No canonical player champion pointer, atomic promotion transaction or rollback history. |
| 37 | Data-quality monitoring | partially supported | Materialization receipts/counts; `cron_job_audit`; cron report; xG/game/SKO health; rolling diagnostics | No unified player source-revision, feature-snapshot, drift, scoring and calibration monitor. Several prospective sources are unscheduled. |
| 38 | Supabase/PostgreSQL persistence | supported | Active Supabase baseline/deltas; run/output/snapshot/registry tables; atomic RPC patterns | Schema authority is strong but includes legacy overlaps and must be clean-replayed before new migrations. |
| 39 | Vectorized batch inference | partially supported | Batched/paged cron routes and atomic bulk writers; FORGE per-slate runner | Several paths loop per player/request and long repairs exceed the 240-second serverless limit; no dedicated training/batch worker. |
| 40 | Stable Next.js serving contracts | supported | Canonical `/api/v1/forge/*`; compatibility `/api/v1/projections/*`; Start Chart adapter; metadata/fallback contracts | Future intervals/distributions need additive contracts and adapter migration; legacy aliases should remain only through an explicit compatibility window. |

## Historical readiness by layer

| Layer | Current readiness | Interpretation |
| --- | --- | --- |
| Raw NHL ingestion and game materialization | strong | Reuse the exact snapshot, hashing, receipt, locking and normalization patterns. |
| Provider history and forecast-time state | weak to partial | WGO/NST/schedule/roster/goalie rows need true availability and revision history. |
| Stable identity | partial to strong | FHFH identity tables are the right foundation; application outputs have not fully adopted them. |
| Feature transformations | broad but ungoverned | Many useful calculations exist, but definitions are duplicated and player snapshots are mutable/unversioned. |
| Statistical player forecast | unsafe for promotion | FORGE and sKO are heuristic; sustainability is descriptive; retained offline evidence is leaked or incomplete. |
| Persistence and serving | partial to strong | Run-scoped tables, atomic writers and compatibility APIs are reusable after vintage/version semantics are expanded. |
| Evaluation and model governance | strong adjacent examples, weak player implementation | Extract xG/game-prediction patterns; do not treat current FORGE accuracy as adequate. |
| Operations | partial to strong | Daily orchestration, leases and health exist; training/large repair needs a bounded worker strategy and scheduler reconciliation. |

## Current gate conclusion

The original architecture/research gate has been satisfied for local private
beta serving by the checksum-bound season contracts and their evaluation
receipts. The current system may generate, edit, validate, publish, and roll
back local opening/current/ROS releases while FORGE remains unchanged. The
opening release requires an editor-authored event at both the application and
database boundaries; system publication is limited to `current` and `ros`.

Hosted migrations, Cron registration, production release pointers, and public
activation are intentionally not implied by this document and still require
explicit owner authorization. Champion promotion also requires untouched
prospective 2026–27 evidence; no historical replay can substitute for that
calendar-dependent gate.
