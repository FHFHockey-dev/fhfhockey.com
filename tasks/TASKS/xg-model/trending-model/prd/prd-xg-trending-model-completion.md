# PRD: NHL xG Trending Model Completion and Hardening

## Introduction/Overview

This initiative completes and hardens FHFH's in-house NHL expected-goals platform: normalized shot features, approved/calibrated shot-goal and rebound-creation predictions, derived player/team/goalie aggregates, leakage-safe model contracts, model registry and deployment metadata, operational backfills, controlled tracking research, and an internal xG exploration surface.

The implementation foundation is substantial and evidence-backed. Current task history records completed backfills for normalized-data-ready 2025–26 games, approved artifact scoring, idempotent feature/prediction persistence, rebound-creation modeling, aggregate builders, QoT/QoC, adjusted impact, travel/fatigue, starter mixtures, NHL EDGE contracts, model leakage validation, a read-only xG lab, controlled replay ingestion, and interactive API optimization. Remaining work is the Deep Research hardening tail: calibration segmentation, benchmark taxonomies, challenger models, flurry adjustment, residual-skill layers, richer rebound heads, controlled tracking audits, durable execution locks/queues, and operations monitoring.

This PRD was derived from `tasks/TASKS/xg-model/trending-model/tasks-xg-trending-model-completion.md`, the xG baseline/foundation contracts, and current implementation because the initiative previously had no dedicated PRD.

## Goals

1. Maintain a reproducible, leakage-safe, calibrated shot-goal xG model with immutable feature and artifact contracts.
2. Keep shot-goal and rebound-creation prediction tasks separate and reject artifact/task mismatches.
3. Provide idempotent, coverage-audited feature, prediction, and aggregate materialization for every normalized-data-ready game.
4. Produce distinct player/team/goalie analytical outputs for shooting, creation, rebound behavior, adjusted impact, context, and rolling trends.
5. Validate calibration and model quality across rink, season phase, strength state, score state, and stable benchmark universes.
6. Compare challenger models under the same frozen contracts without changing production serving until promotion gates pass.
7. Make long-running xG jobs concurrency-safe, observable, diagnosable, and recoverable.
8. Expose internal exploration and operations surfaces while keeping sparse or research-grade outputs clearly labeled.

## User Stories

- As a model maintainer, I want every artifact tied to its exact feature manifest, calibration, training splits, approval evidence, and checksum so incompatible scoring fails closed.
- As an analyst, I want raw, flurry-adjusted, created, rebound, and contextual xG views separated clearly so different concepts are not conflated.
- As an operator, I want coverage, null-rate, calibration-drift, aggregate-reconciliation, and job-lock visibility before stale or partial outputs reach consumers.
- As a product developer, I want typed, provenance-aware aggregate contracts that can be adopted by rankings and underlying-stat surfaces without recomputing raw events per request.
- As a reviewer, I want external-model disagreements investigated as taxonomy/universe differences before they are labeled model defects.

## Functional Requirements

1. Shot features must be persisted with stable feature, parser, and strength versions and an idempotent `(feature_version, game_id, event_id)` identity.
2. Prediction rows must be persisted by model version, prediction type, game, and event and must contain raw and calibrated probabilities plus explicit approval/model metadata.
3. Coverage audits must reconcile eligible games, normalized PBP/shifts, feature rows, prediction rows, versions, game types, and documented future/unavailable exclusions.
4. Potentially large Supabase reads must paginate until a short page or use a verified aggregate/bounded query; arbitrary large limits are not completeness evidence.
5. Production scoring must resolve an approved artifact from the configured artifact path or registry alias and fail closed on missing, invalid, unapproved, or task-mismatched artifacts.
6. Artifact validation must enforce selected-feature presence, encoded feature count, categorical vocabulary compatibility, feature-manifest parity, calibration serialization, and missingness policy.
7. Approval must consider feature coverage/null rates, scoring drift thresholds, unknown categorical levels, split sizes, positive-label support, probability quality, calibration, and task-specific baselines.
8. The model registry must retain immutable artifact checksum, feature-manifest hash, calibration fingerprint, training/validation/test date ranges, approval status, deployment alias, and active/champion state.
9. Training must support multi-season inputs with grouped-by-game chronological inner validation and true out-of-time outer holdouts; no shot from the same game may cross split ownership.
10. `shot_goal` must use the approved unblocked/Fenwick shot universe and goal label; `rebound_creation` must use its approved source universe and rebound label. One artifact must never score the other task.
11. Rink/arena, playoff, strength-state, and score-state calibration audits must report sample sizes, event rates, calibration error, Brier/log loss, and confidence/insufficiency warnings.
12. Internal benchmark surfaces must separate all-situations unblocked xG from 5v5 non-empty-net unblocked xG and document their exact event, strength, empty-net, and score-state filters.
13. External comparisons with NST, MoneyPuck, or Evolving-Hockey must first map event universe, strength, venue/rink adjustment, flurry treatment, rebounds, empty nets, and calibration taxonomy; disagreement alone is not a failure finding.
14. Challenger LightGBM, CatBoost, XGBoost, and state-partitioned candidates must train and evaluate under the same frozen feature/split/approval contracts as the champion.
15. Production promotion requires held-out probability-quality improvement without material calibration damage, unexplained segment regression, leakage violation, or contract drift; the prior champion must remain recoverable.
16. Flurry-adjusted xG must be additive and parallel to raw xG. It must not overwrite event-level calibrated raw xG or obscure reconciliation back to source predictions.
17. Shooter finishing and goalie save effects must be estimated as lagged, regularized residual-skill layers separate from baseline shot quality, with minimum-sample and as-of safeguards.
18. Rebound modeling must distinguish rebound creation, rebound danger/second-chance quality, goalie freeze/control, and downstream second-chance xG rather than compressing all outcomes into one label.
19. Created-xG, transition, shot-assist, QoT/QoC, adjusted-impact, travel/fatigue, starter-mixture, and rebound-control outputs must remain typed, versioned, and provenance-aware.
20. Adjusted-impact and other postgame descriptive outputs must never enter pregame feature builders without explicit registry approval and as-of-safe materialization.
21. Controlled NHL replay/tracking work may discover and fetch only explicit public replay URLs provided by NHL data; blind event-ID probing is prohibited.
22. Tracking features may influence model training only after stable event-to-frame alignment, coordinate/identity QA, coverage reporting, and leakage classification are proven. Goal-only sprite coverage must not be represented as full tracking.
23. Long-running feature backfills, prediction scoring, and aggregate jobs must use database advisory locks, durable queue semantics, or an equivalent cross-instance lease with idempotent retry and stale-lock recovery.
24. Concurrent executions must not duplicate rows, promote conflicting artifacts, or exhaust shared upstream/database budgets silently.
25. The xG operations surface must report at least feature null-rate drift, categorical unknown-rate drift, eligible-game and prediction coverage, calibration drift, aggregate reconciliation, registry/artifact mismatch, job state, last success, and actionable failure context.
26. The xG lab and downstream read APIs must use bounded interactive previews while preserving exact/full coverage counts through separate aggregate queries.
27. UI and API responses must communicate loading, empty, sparse supplemental coverage, stale data, partial failure, model/version mismatch, and unavailable migration/table states honestly.
28. Automated tests must cover non-trivial feature derivation, split assignment, artifact/coverage gates, scoring task mismatch, calibration segmentation, aggregate reconciliation, lock/lease behavior, and fallback/failure branches.
29. Schema or production model changes must follow the super-goal checkpoint protocol when they are destructive, breaking, provider/account-facing, or promote a new production champion.

## Non-Goals (Out of Scope)

- Treating old task checkmarks or sampled rows as proof of complete historical coverage.
- Replacing the approved champion merely because a more complex model exists.
- Combining shot quality, finishing skill, save skill, rebound creation, and rebound control into one opaque score.
- Using current/future data in historical features or postgame outputs in pregame models.
- Claiming goal-replay sprite frames represent full-game tracking.
- Overwriting raw xG with flurry-adjusted values.
- Publishing sparse research outputs as production-grade rankings without coverage and confidence gates.
- Creating parallel JSON-only model contracts when typed persisted contracts already exist.

## Design Considerations

- Internal xG surfaces must label scope, prediction task, model version, date/season, strength universe, calibration status, and coverage quality prominently.
- Raw and adjusted variants must be visually distinct and explainable.
- Sparse or unavailable supplemental metrics need visible warnings rather than zeros that resemble real values.
- Operations views should prioritize actionable drift, coverage, reconciliation, and failed-job states over decorative model metrics.
- Downstream product adoption should reuse FHFH table/chart patterns and preserve responsive, accessible loading/error/empty states.

## Technical Considerations

- Current persistence and scoring code lives primarily under `web/lib/xg/`, xG API routes, training scripts, and migrations dated 2026-05/06.
- Daily ordering is schedule/identity → normalized PBP/shifts → shot features → predictions → dependent aggregates; downstream jobs must gate on same-scope freshness.
- Model-critical joins require explicit grain, version, source-as-of, and leakage classification.
- Reconciliation should prove event predictions sum into player/team/goalie aggregates within documented exclusions and rounding tolerance.
- Exact count queries may preserve coverage while row fetches remain bounded for interactive endpoints.
- Advisory locks/queues must work across serverless instances; in-memory mutexes alone are insufficient.
- Current local multi-season data coverage may be incomplete, so model-training verification must distinguish contract tests from live multi-season evidence.

## Success Metrics

- Every normalized-data-ready eligible game has version-matched feature and approved prediction coverage or an explicit upstream exclusion.
- Artifact health and registry checks fail closed on feature, calibration, checksum, task, or approval mismatches.
- Segment calibration reports exist for rink/arena, playoff, strength, and score state with minimum-sample warnings.
- Benchmark universes reconcile internally and external taxonomy differences are documented before remediation decisions.
- At least the specified challenger families are evaluated under identical frozen contracts; promotion occurs only through recorded gates.
- Raw and flurry-adjusted xG reconcile, and residual skill/rebound heads remain separate and explainable.
- Long-running jobs reject or coordinate overlapping executions and expose recoverable state.
- The operations dashboard identifies coverage, drift, reconciliation, artifact, and job failures with current timestamps and remediation context.
- Focused tests, type checks, route/API checks, and coverage audits pass for the final implementation.

## Open Questions

1. The minimum sample thresholds and alert tolerances for each calibration segment should be derived from current season/multi-season coverage and recorded with the audit implementation.
2. Challenger-model dependencies must be evaluated against the existing Node/runtime/deployment footprint before adding packages; versions must be pinned and lockfiles committed if adopted.
3. The durable execution mechanism should prefer existing repository/platform infrastructure; a new queue or workflow product is a strategy checkpoint if it materially changes cost or ownership.
4. External benchmark data access may require licensed/provider actions; taxonomy research can proceed from documented public contracts, but production/provider access uses the pause protocol.
