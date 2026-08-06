# Player-projection implementation handoff

This handoff makes the repository ready to receive the final Deep Research Report without repeating repository discovery. It does **not** select the final statistical architecture or authorize production implementation. Work must stop at this boundary until the report arrives with an explicit **“Done, proceed.”**

## Architecture summary

| Layer | Current owner | Handoff interpretation |
| --- | --- | --- |
| Raw NHL evidence | `web/lib/projections/ingest/`, normalized game/PBP/shift tables, `nhl_api_game_payloads_raw` | Reuse append-only raw payloads, hashes, snapshot heads, exact materialization receipts, locks and transactional replacement. |
| Provider and forecast-time state | WGO/NST rolling inputs, `games`, rosters, line combinations, statuses and goalie starts | Refactor to immutable revisions with `observed_at`/`available_at`; current/event dates alone are not forecast vintages. |
| Identity | FHFH identity/external mapping/alias/history family plus NHL IDs | Adopt time-valid FHFH identity as the durable player contract while preserving NHL IDs for provider/API compatibility. |
| Player features | Rolling metrics, sustainability, xG aggregates, lineup/schedule/team context | Extract pure transformations; rebuild a versioned cutoff-safe feature pipeline after the research feature set is approved. |
| Player inference | FORGE, sustainability upcoming and sKO | Preserve adapters and behavior during migration; replace or build statistical cores by subsystem. None is valid final architecture evidence. |
| Persistence | FORGE run/output tables, sKO model keys/run manifests, game-prediction snapshots | Refactor to immutable issued vintages, source/feature/model/artifact identities and explicit conditional/distribution semantics. |
| Evaluation/governance | FORGE accuracy, xG registry, team game-prediction snapshots/backtests/promotion | Extract xG/game patterns; build a comprehensive player target/vintage scorer rather than extending FORGE fantasy/latest-run evaluation blindly. |
| Serving/product | Canonical FORGE APIs, deprecated aliases, Start Chart, FORGE dashboard, draft/Top Adds | Migrate through additive adapters. Keep raw hockey outputs upstream and fantasy/product scoring downstream. |
| Operations | Vercel cron, pg_cron, leases, audit and 240-second functions | Retain bounded/idempotent orchestration. Select a separate bounded training/large-repair runtime if research compute exceeds request limits. |
| Schema authority | `supabase/migrations/` | All future SQL must extend a clean replay of the active baseline/deltas. Other SQL trees are evidence, not automatic migration authority. |

## Reusable foundations

| Foundation | Relevant paths/objects | Reuse boundary |
| --- | --- | --- |
| Immutable NHL raw payloads | `web/lib/projections/ingest/rawSnapshotPersistence.ts`, `nhl_api_game_payloads_raw` | Reuse hashes/raw JSON/fetch times and append-only behavior. Extend the pattern to every forecast-relevant provider. |
| Deterministic materialization | `web/lib/projections/derived/`, `20260720105524_add_projection_materialization_transactions.sql` | Reuse parser/materializer versions, counts, fingerprints, receipts, advisory locks and transactions. |
| Stable identity family | FHFH player identities, external IDs, aliases, review queue, organization history | Reuse as identity authority after live resolution/coverage audit; do not rely only on current `players.team_id`. |
| Run lifecycle and atomic persistence | `forge_runs`, FORGE output tables, `replace_forge_projection_results_atomic` | Reuse run state, transactions and failure semantics. Add immutable vintage/model/snapshot/distribution identities. |
| Lease/CAS/idempotency patterns | FORGE stages, xG execution leases, sKO run manifests, projection materialization RPCs | Reuse for inference and backfills; avoid a single long HTTP request. |
| Forecast-cutoff snapshots | `web/lib/game-predictions/`, `game_prediction_feature_snapshots` | Generalize the manifest/feature cutoff pattern to player forecasts; do not couple player targets to team schemas. |
| Registry/artifact governance | `nhl_xg_model_registry`, release artifact/checksum utilities, game model versions/promotion RPC | Extract lifecycle, checksum, fingerprint, champion uniqueness and rollback patterns. |
| Evaluation primitives | xG calibration/benchmarking; game-prediction chronological scoring/accountability | Reuse proper-score, calibration and immutable evaluation patterns after player targets are frozen. |
| Compatibility adapters | `/api/v1/forge/*`, deprecated `/api/v1/projections/*`, `compatibilityInventory.ts`, Start Chart normalization | Use additive versioning/shadow migration to protect current consumers. |
| Pure domain utilities | chronological rolling/rate/unit helpers, xG residuals, schedule/rest/travel, reconciliation invariants, fantasy scoring | Extract only after characterization proves semantics; inclusion in a final feature/model remains an empirical decision. |

## Unsafe foundations

| Unsafe assumption or component | Evidence | Required treatment |
| --- | --- | --- |
| Event date equals information availability | WGO/NST/current aggregate upserts; date-only FORGE cutoffs | Store source observation/availability and immutable revisions before walk-forward use. |
| Current roster/team/goalie state can reconstruct history | `players.team_id`, `rosters.is_current`, mutable `goalie_start_projections` and current-source fallbacks | Replace historical joins with time-valid organization/roster/status/lineup observations. |
| Existing player forecasts are statistically validated | FORGE/sustainability/sKO run and have tests, but coefficients/targets/evidence are heuristic, descriptive or leaked | Treat them as baselines/compatibility behavior only. Rebuild validation chronologically. |
| Current goalie prior/evaluation is safe | Target-date-inclusive prior query; selected-goalie/team-mixture semantics; missed starter can be skipped | Freeze historical start evidence, make conditional/unconditional outputs explicit and score every candidate/vintage. |
| FORGE multi-horizon output is schedule simulation | First-game context is scaled with aggregate rest/schedule factors | Recompute or simulate each scheduled game under the research-approved state/context process. |
| FORGE uncertainty is calibrated | Fixed Normal/Poisson assumptions and 400 seeded draws | Replace distribution core and validate calibration/coverage by target, horizon and population. |
| Sustainability backtests prove persistence | Historical snapshots can reuse full-season totals | Rebuild datasets from immutable cutoffs; retain score only as a candidate feature/baseline. |
| sKO artifacts prove holdout quality | Next-5 target window contains four already-known/current games | Reject retained metrics as promotion evidence; rebuild targets from first principles. |
| “Variance”/rank/trend/pace are forecast distributions | Variance pages use sample SD; rankings/trends/WiGO are descriptive | Preserve product labels/contracts but keep them outside the model evidence layer. |
| Historical/design SQL exists in production | Multiple SQL/migration trees; goalie-mixture objects are absent active authority | Verify live state read-only and use only `supabase/migrations/` for changes. |
| Serverless request runtime is a training platform | Next/Python functions are capped at 240 seconds; no dedicated worker found | Keep online inference bounded; select durable worker/object storage only after compute/artifact requirements are known. |

## Logical migrations required after research approval

These are contract-level requirements, not proposed table names or DDL. Exact grains, keys, columns, retention and partitioning depend on target/vintage/model decisions and the live data audit.

| Order | Logical migration | Minimum invariant | Depends on |
| ---: | --- | --- | --- |
| 1 | Source-observation revision history | Provider object, provider revision/hash, `observed_at`, `available_at`, payload/reference and immutable supersession; never infer knowledge time from event date | Live source/license/coverage audit |
| 2 | Schedule and game-state revisions | Every forecast can resolve the schedule, start time, home/away and postponement knowledge available at its cutoff | Historical schedule source feasibility |
| 3 | Lineup/roster/status/goalie-start observations | Time-valid team membership and prospective evidence with source, confidence, expiry and observation time | Product cutoff/source-precedence rules |
| 4 | Player feature snapshot and source manifest | Stable player/game/horizon/cutoff identity, schema/feature version, source revision references, missingness/fallback flags and content hash | Approved target grain and feature eligibility |
| 5 | Player model/artifact registry | Population/target/horizon applicability, model/feature/calibration fingerprints, artifact URI/checksum, lifecycle, training cutoff and code version | Approved model families and artifact runtime |
| 6 | Immutable prediction runs and outputs | Issued-at instant, forecast cutoff, model/artifact/feature snapshot IDs, conditional semantics, point/distribution parameters or quantiles, raw hockey units and append-only vintage | Approved output/distribution contract |
| 7 | Outcome labels and scoring records | Deterministic target construction version; every eligible output joined once to completed outcomes with proper scores and failure/missing reasons | Target definitions and observation finality |
| 8 | Backtest/calibration/comparison records | Chronological folds, frozen candidate/baseline evidence, subgroup/horizon metrics, calibration and reproducible manifest | Evaluation design and baselines |
| 9 | Champion pointer, promotion and rollback | Atomic one-champion constraint per applicability scope, approval evidence, rollback history and serving resolution | Promotion governance/product owner |
| 10 | Compatibility views/adapters and retirement migrations | Existing consumers retain behavior until a measured migration window ends; old writers stop before objects are removed | Consumer telemetry and archive policy |

Before migration 1, clean-replay the active migration chain against the pinned Postgres 15 configuration. Do not copy historical goalie-mixture or analytics-sKO SQL into the active chain without a current need and threat/ownership review.

## Recommended implementation boundaries

| Boundary | Responsibility | Must not own |
| --- | --- | --- |
| Source adapters | Fetch raw provider state and persist immutable observations/revisions | Hockey target construction or model coefficients |
| Identity resolver | Resolve provider identities to time-valid FHFH/NHL identities with reviewable conflicts | Current-team shortcuts |
| Snapshot builder | At a single cutoff, resolve eligible source revisions and produce a hashed feature/source manifest | Training split decisions or serving latest rows |
| Target builder | Produce versioned future labels from completed outcomes for exact population/horizon/conditioning | Feature data that was unavailable at forecast time |
| Research dataset builder | Join snapshot and target identities; create chronological folds and baselines | Production promotion or mutable source reads |
| Population model core | Fit/infer the approved forward, defenseman, skater availability/opportunity and goalie components | API formatting, fantasy scoring or database access |
| Schedule simulation/reconciliation | Advance game-by-game state/context and enforce approved team/player identities | Hand-selected statistical distributions outside the approved report |
| Prediction repository | Atomically append runs/outputs and resolve champion/latest pointers | Silent overwrites or response-time normalization that differs from stored/evaluated values |
| Evaluator/calibrator | Join every vintage to outcomes, calculate proper scores/calibration and freeze comparison evidence | Selective scoring of favorable rows or model promotion side effects |
| Registry/promoter | Register artifacts, enforce applicability and atomically promote/rollback after approval | Training or ad hoc UI thresholds |
| Serving adapters | Expose additive raw hockey/distribution contracts and preserve legacy responses during migration | Statistical inference or fantasy scoring upstream of raw output |
| Product transforms | Fantasy scoring, Top Adds, rankings and display labels | Claims of statistical calibration unless evaluated separately |
| Orchestrator/worker | Bound jobs, leases, retries, manifests and health | Statistical logic or unbounded full-history work in one request |

## Compatibility constraints

| Consumer/contract | Current expectation | Migration requirement |
| --- | --- | --- |
| `/api/v1/forge/players` | Raw skater counts/TOI plus nested metadata for a date/horizon | Add version/distribution fields; preserve existing fields until all clients opt in. |
| `/api/v1/forge/goalies` | One goalie row with start probability and blended outcome semantics | Introduce explicit conditional-on-start and unconditional/team-mixture contracts without silently changing old rows. |
| `/api/v1/projections/players` and `/goalies` | Deprecated FORGE-compatible response | Keep through telemetry/deprecation window, then retire separately from annual projection API. |
| `/api/v1/projections/teams` | Legacy team response with limited metadata | Add a canonical version before retirement. |
| `/api/v1/projections.ts` and projections page | External annual provider tables and user-weighted consensus | Do not conflate with FORGE aliases; retain as product input/benchmark unless product decides otherwise. |
| Start Chart | Skaters from FORGE; goalies from mutable `goalie_start_projections`; downstream fantasy scoring | Migrate behind its adapter, preserving fantasy settings and freshness/fallback disclosure. |
| FORGE dashboard/command center | Latest deterministic summaries, freshness/degraded context and uncertainty metadata | Preserve latest UX while adding explicit vintage/model/conditional semantics. |
| Top Adds | Deterministic recommendation formula over projection/ownership/schedule/risk | Keep as a downstream product score; validate separately after projection migration. |
| Sustainability/trends/rankings | Descriptive score/labels and current snapshot semantics | Avoid silently replacing these with probabilities; migrate only where product meaning is explicitly approved. |
| Draft dashboard/ranker | Annual consensus, Yahoo identity/ADP and snapshot/expiry behavior | Preserve external-provider and fantasy-ranking semantics; optionally use final projections only as a new versioned source. |
| Historical FORGE/sKO rows | Partial run/as-of history | Define archive and reproducibility policy before changing keys, overwriting or deleting. |

## Sequenced implementation plan after “Done, proceed”

### Stage 0 — Reconcile research decisions

Map every report conclusion to the decision register below and to `subsystem-decisions.md`. Reject any conclusion that lacks a target/vintage/evaluation definition or relies on repository metrics already marked leaked.

### Stage 1 — Read-only live audit and replay gate

- Inventory live table sizes, season/date coverage, nulls, revisions, provider freshness, identity conflicts, scheduled jobs, route traffic and artifact locations.
- Confirm active migration chain replay on Postgres 15 and compare expected/live objects without mutating production.
- Measure prospective lineup/status/goalie observation continuity and historical schedule reconstructability.
- Produce dataset eligibility by target/horizon/cutoff; mark unknowns rather than imputing capability.

### Stage 2 — Freeze contracts and characterization

- Approve target taxonomy, populations, horizon schedule, issued vintage/cutoff, conditional goalie semantics and raw output/distribution contract.
- Extend existing characterization tests for the exact legacy fields each adapter must preserve.
- Freeze provider definitions, identity resolution and target-construction versions.

### Stage 3 — Build immutable data/snapshot foundation

- Implement logical migrations 1–4 through active Supabase migrations.
- Backfill only reconstructable observations with explicit provenance/limitations; never fabricate `available_at`.
- Add replay/hash checks and bounded data-quality monitors.

### Stage 4 — Build research and evaluation harness

- Create snapshot-to-target datasets and chronological walk-forward folds.
- Implement approved naive/current/external baselines and proper scores.
- Re-run all candidate feature/model evidence; do not reuse sKO or leaky sustainability metrics.

### Stage 5 — Implement selected model components

- Implement availability, opportunity, forward, defense, goalie, context and distribution components at the boundaries above.
- Reuse pure transforms only where characterization and out-of-time ablation justify them.
- Register artifacts/checksums/feature versions and make inference deterministic for a fixed manifest/seed.

### Stage 6 — Add schedule simulation, reconciliation and persistence

- Advance each scheduled game with its own context/state rather than scaling the first game.
- Persist immutable raw hockey distributions/vintages and every fallback/missingness reason.
- Verify conditional/unconditional goalie and player/team reconciliation identities.

### Stage 7 — Shadow inference and governed evaluation

- Run challenger outputs beside FORGE without changing existing responses.
- Score every target/vintage/population, including unavailable/scratched skaters and every goalie candidate as defined.
- Compare against frozen baselines with calibration, subgroup and operational evidence.

### Stage 8 — Promote and migrate consumers

- Use an atomic champion pointer and documented approval/rollback.
- Opt canonical APIs into additive fields/version; migrate Start Chart/dashboard consumers one at a time.
- Keep fantasy scoring and recommendation formulas downstream.

### Stage 9 — Retire duplicates

- Follow `duplicate-retirement-ledger.md`: capture telemetry/data, disable writers/jobs, observe, archive, then remove by explicit migration/code change.
- Never bulk-delete all “projection” or “sKO” paths; similarly named surfaces have different owners.

## Exact empirical decisions still required

| Decision | Required report evidence | Repository components unlocked |
| --- | --- | --- |
| Target taxonomy and observation finality | Exact raw outcomes, stat definitions, strength state, corrections and goalie labels | Target builder, outcome tables, evaluator, API fields |
| Forecast vintages/cutoffs | Issue cadence, pregame cutoff(s), late-news policy and historical reconstructability | Snapshot key, source resolver, run identity and backtest folds |
| Horizons | Next game, next 5/10 scheduled games, ROS and final-season definitions; cancellation/postponement handling | Schedule simulator, run/output grains and cron ownership |
| Conditional semantics | Skater conditional-on-playing vs unconditional; goalie conditional-on-start vs starter mixture/team output | Availability model, goalie rows, scoring and UI copy |
| Position structure | Forward subgroups, defense-specific core and permitted partial pooling | Model applicability registry and population modules |
| Opportunity decomposition | Whether play probability, ES/PP/PK TOI, line/PP role and event rate are separate targets | Availability/opportunity boundaries and reconciliation |
| Feature eligibility | Provider definitions, availability, licensing, missingness, historical coverage and ablation lift | Source adapters, snapshot schema and feature version |
| Prior/state design | Pooling levels, rookie/call-up/trade/injury-return handling, recency/decay and abrupt-role transitions | Prior/state modules and cold-start contracts |
| Model families | Baselines/candidates for count, rate, probability, opportunity, conversion, assists and goalie components | Training code, artifact runtime and inference interface |
| Distribution/dependence | Count/continuous/mixture families, zero inflation/overdispersion, cross-stat/game/player dependence | Output schema, simulator, reconciliation and calibration |
| Team/player identities | Which totals must reconcile and whether reconciliation preserves marginals | Reconciliation module and evaluation invariants |
| Evaluation design | Walk-forward folds, baselines, proper scores, calibration, subgroup/season tests and statistical uncertainty | Evaluator, comparison tables and release report |
| Promotion gates | Minimum evidence, operational SLOs, approval role, rollback triggers and retraining cadence | Registry lifecycle, atomic promotion and monitors |
| Champion/challenger scope | One champion per target/horizon/population or multi-component registry | Registry key and serving resolver |
| Continual learning | Retraining trigger/cadence, label delay, correction handling, drift and artifact retention | Worker/orchestrator, monitoring and archive policy |

## Exact product and operational decisions still required

| Decision | Why it cannot be inferred from code |
| --- | --- |
| Default product horizon and vintage | Existing pages favor latest/h1, while research requires multiple horizons and issued vintages. |
| Interval/distribution UX | Current consumers mostly expect point values with nested metadata; product must choose displayed quantiles/probabilities and caveats. |
| Goalie confirmation/manual override policy | Source precedence, expiry and human override are product trust decisions. |
| Missing/degraded forecast behavior | Current fallbacks preserve availability but can violate historical validity; product must choose hide, flag, fallback baseline or abstain. |
| Fantasy-scoring ownership | Raw hockey outcomes should remain canonical; league/user scoring remains downstream, but compatibility behavior must be approved. |
| External projection role | Consensus may be benchmark, feature, challenger or product-only source; licensing and historical vintages constrain use. |
| Data retention and deletion | Raw source revisions, feature snapshots, predictions, outcomes and artifacts have cost/audit tradeoffs requiring policy. |
| Training/artifact runtime | No current dedicated worker/object store exists; compute size, security, recovery and cost drive the choice. |
| Freshness and latency SLOs | Late lineup/goalie news and game schedules require an explicit refresh/serving promise. |
| Release authority | Code does not establish who may approve champion promotion or emergency rollback. |
| Legacy compatibility window | Traffic and customer commitments, not repository imports alone, determine API/table retirement timing. |

## Research-to-repository crosswalk

| If the final report selects… | Start implementation at… | Preserve/migrate through… | Never inherit without revalidation… |
| --- | --- | --- | --- |
| Immutable walk-forward player datasets | PP-001/PP-002 patterns plus game-prediction snapshots | FHFH identity, raw hashes, materialization receipts | mutable WGO/NST/current roster/latest fallbacks |
| Hierarchical player priors/state | TS sustainability prior/math characterization | sustainability model/config provenance | fixed 0.6/0.3/0.1 blend and leaked backtests |
| Separate availability/opportunity/event models | FORGE role/status/query/output contracts | skater raw output and TOI reconciliation adapters | hand weights/bounds as fitted evidence |
| Defense-specific model | FORGE defense role/pair and ranking peer-group inputs | common raw output schema | shared F/D event formula by default |
| Conditional goalie model/mixtures | FORGE goalie candidate/confirmation adapters and PP-030 contract ideas | goalie API compatibility layer | target-date prior, mutable starts, selected-goalie/team-mixture row semantics |
| Game-by-game multi-horizon simulation | FORGE deterministic seeds/schedule helpers | horizon API fields | first-game context scaling |
| Player registry/promotion | xG registry + game prediction atomic promotion | FORGE run lifecycle | Git SHA alone as model identity |
| Proper scoring/calibration | xG/game evaluation patterns | FORGE accuracy tables only as compatibility/history | selective latest-run fantasy scoring |
| External consensus baseline | PP-019 tables/identity diagnostics | projections/draft product surfaces | current upload as historical vintage or unverified license |

## Immediate next step once the report arrives

Begin Stage 0 and the **read-only** portion of Stage 1: reconcile the report's explicit targets/vintages/evaluation design with this crosswalk, then measure live coverage and reconstructability before drafting schema. Architecture-dependent production code, database migrations, model training, cron changes and forecast replacement remain blocked until that reconciliation is complete.
