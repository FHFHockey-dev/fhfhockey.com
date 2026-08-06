# Player-projection repository audit

## Outcome

The likely implementation is **hybrid**.

- **Refactor or extract:** raw ingestion/materialization, stable identity, orchestration, atomic persistence, serving adapters, reconciliation primitives, evaluation patterns and model registry/promotion patterns.
- **Replace the statistical core:** existing FORGE skater/goalie formulas, sustainability prior/state logic where used predictively, multi-horizon uncertainty and player evaluation.
- **Build greenfield subsystems:** immutable player feature snapshots, calibrated skater probability-of-playing and a defense-specific event model.
- **Retire after migration:** quarantined/stale sKO variants, Python sustainability, orphan goalie mixtures, legacy projection objects/adapters and invalid experiments—only after live caller/data/telemetry gates.

No existing player system is selected as the final architecture. FORGE is a functioning production heuristic, TypeScript sustainability is primarily descriptive, sKO is quarantined or stale, and external annual projections are product inputs/benchmarks. The NHL xG and team game-prediction systems provide strong adjacent governance patterns but are not evidence that their statistical methods transfer to player forecasting.

Production prediction behavior was not changed. This audit adds documentation and a machine-readable inventory only.

## Strongest reusable foundation

The strongest foundation is the combination of:

1. append-only NHL Gamecenter raw payloads with hashes and fetch timestamps;
2. parser/materializer/relationship/derived versions, exact row-count/fingerprint receipts, advisory locks and transactional replacement;
3. the FHFH identity/external-ID/alias/history family;
4. FORGE run lifecycle, leases and atomic output persistence;
5. xG registry/checksum/artifact/calibration patterns; and
6. team game-prediction feature-cutoff snapshots, chronological evaluation and atomic promotion/rollback.

These patterns should become the skeleton of the new system. They do not make the current player coefficients, targets or distributions valid.

## Most serious risks

The largest cross-cutting risk is **forecast-time irreproducibility**: WGO/NST aggregates, schedules, current rosters/teams, lineup/goalie state and some strength fallbacks are mutable or lack exact availability/revision timestamps. A historical run can therefore use information that was unknown at the nominal forecast date.

The most concrete model-evidence failures are:

- the FORGE goalie prior can include the target game and current-state fallbacks;
- FORGE multi-game output scales first-game context instead of rebuilding each future game;
- FORGE uncertainty uses fixed, uncalibrated Normal/Poisson assumptions;
- sustainability historical rebuilds can reuse full-season totals;
- retained offline sKO “next five” targets include four already-known/current games and only one future game; and
- `performance_prediction.py` retains other future target columns as features and fits preprocessing on the full dataset.

Operationally, the orphan goalie-mixture route targets tables absent from the active migration chain and lacks the normal admin-only wrapper; analytics sKO retains an orphan SECURITY DEFINER browser RPC; stale scheduler evidence references a 410 route; and no dedicated long-running training/repair worker exists.

## Existing systems found

The inventory classifies 31 systems covering:

- NHL projection input ingestion/materialization and rolling features;
- FORGE skater/team/goalie formulas, uncertainty, reconciliation, persistence, serving and scoring;
- TypeScript and Python sustainability implementations;
- active, source-ingest, offline-artifact and analytics-SQL sKO variants;
- contextual rankings, trends, WiGO, variance, Top Adds and team context/power formulas;
- external annual projection consensus and Draft Ranker;
- NHL xG and team game-prediction adjacent systems;
- legacy team goal Poisson, Buy Low/Sell High, True Goalie Value, goalie mixtures, projection tables/APIs/tombstones; and
- leaky or descriptive Python experiments and generated artifacts.

Every system is separately classified as a trained model, weighted/heuristic formula, simulation, feature/rolling pipeline, sustainability/ranking/display transform, serving/evaluation layer or unused experiment.

## Deliverables

| Artifact | Purpose |
| --- | --- |
| [`model-inventory.md`](./model-inventory.md) | Complete human-readable system/job/output/API/UI index and classification. |
| [`model-inventory.json`](./model-inventory.json) | Exhaustive machine-readable record with semantics, paths, data, runtime, governance, risks and disposition for 31 systems. |
| [`existing-system-data-flow.md`](./existing-system-data-flow.md) | End-to-end source → feature → inference → persistence → API/UI and scheduler/data dependency maps. |
| [`requirements-traceability.md`](./requirements-traceability.md) | All 40 Deep Research Plan requirements mapped to repository support, evidence and gaps. |
| [`subsystem-decisions.md`](./subsystem-decisions.md) | Separate retain/refactor/extract/replace/greenfield decisions for all 25 required subsystems. |
| [`duplicate-retirement-ledger.md`](./duplicate-retirement-ledger.md) | 31 duplicate, stale, dead, overlapping and retirement candidates with dependency gates; no deletion performed. |
| [`project-data-availability.md`](./project-data-availability.md) | Historical coverage evidence, identity, as-of reproducibility, leakage, live audit gate and schema-neutral source contract. |
| [`implementation-handoff.md`](./implementation-handoff.md) | Reusable/unsafe foundations, logical migrations, boundaries, compatibility, staged implementation and exact unresolved decisions. |

## Search and evidence coverage

The audit began from a candidate inventory and followed imports, callers, database references, cron ownership, APIs and UI consumers. It covered:

- TypeScript/JavaScript and React under `web/`, including API routes, hooks, components, pages, libraries and tests;
- Python under `functions/`, `web/pages/api/` and `web/scripts/`;
- active and historical/design SQL/migrations under `supabase/migrations/`, root `migrations/`, `web/sql/`, `web/supabase/migrations/` and the migration archive;
- Vercel and pg_cron ownership, runtime limits, leases, health/audit routes and stale routes;
- tracked JSON/Parquet/CSV/PNG model/research artifacts and test fixtures;
- targeted Git history only where the current tree showed removed/renamed projection or sKO lineage; and
- the complete objective plus `/Users/tim/Downloads/projectionModel.md` as the authoritative research plan.

Repository evidence was kept separate from live-data claims. No production database was queried or mutated, so live row counts, season continuity, provider revision history, identity resolution rates, scheduler activity, route traffic and manually deployed historical SQL remain explicit data gaps.

## Validation performed

- Targeted Vitest characterization across projection materialization, FORGE uncertainty/import boundaries, sustainability runtime ownership, active sKO behavior, Results Luck source exclusion, trends, Draft Ranker snapshots, team-game evaluation and xG registry: **20 test files / 105 tests passed**. Vitest also discovered mirror copies under the existing `.next-codex-reconcile` tree, so the intended ten source files ran alongside their mirrors.
- `jq empty docs/player-projections/model-inventory.json`: passed; inventory contains **31 systems**.
- Every filesystem path in the JSON inventory was checked for existence: passed.
- Markdown trailing-whitespace scan and `git diff --check`: passed.

No build, full test suite, model training, live Supabase query, remote build/deployment or cron/database mutation was run; none was justified for documentation-only changes.

## Unresolved blockers

1. The final Deep Research Report has not yet fixed targets, cutoffs/vintages, populations, horizon semantics, model families, distributions, evaluation design or promotion gates.
2. A read-only live data audit is required to establish actual season coverage, revisions/availability, nulls, identity conflicts, source freshness, job ownership, route traffic and artifact deployment.
3. Product decisions remain for conditional/unconditional goalie and skater outputs, default horizon, uncertainty UX, late-news/override policy, degraded forecasts, external-provider role/licensing, retention, SLOs and release authority.
4. The final compute/artifact requirements are needed before selecting a training/large-repair runtime.

## Decision gate

Stop here. Do not implement the final player projection architecture, add architecture-dependent schema, train a production model, replace forecasts or change schedules until the final Deep Research Report is supplied with an explicit **“Done, proceed.”**

Once that instruction arrives, begin by reconciling its decisions against the implementation crosswalk, then perform the read-only live coverage/reconstructability audit. Only after target, vintage and evaluation contracts survive that audit should schema and model implementation begin.
