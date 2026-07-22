# Sustainability / Trends Audit Report

> **Status: ACTIVE — NOT COMPLETE.** This is the canonical working artifact for `tasks-prd-sustainability-trends-audit.md`. A row is evidence-complete only when its repository paths, runtime role, data dependencies, and validation result are recorded here.

## Execution order and dependencies

1. Define the worksheet and glossary used by every family (`1.1`, `1.7`).
2. Build the tracked-file inventory, group it, and classify current status (`1.2`–`1.4`).
3. Trace page → API → helper/job → read/write table dependencies and classify table ownership (`1.5`, `1.6`).
4. Audit and validate each family in order: trends/sustainability (`2.x`), team power/underlying (`3.x`), start-chart/rolling/legacy (`4.x`), and FORGE (`5.1`–`5.6`).
5. Build the cross-family overlap matrix and consolidation recommendation only after the family evidence is complete (`5.7`, `5.8`).

This preserves the PRD's requested family order. Within a family, static ownership and formula review precede production or rebuild traces so a trace never runs against an unclassified writer.

## Reusable surface worksheet

Complete one row for every page, API, helper, job, SQL asset, and test selected by the inventory. Use `none` when a field is proven inapplicable and `unknown` when evidence is still missing.

| Field                 | Required evidence                                                                              |
| --------------------- | ---------------------------------------------------------------------------------------------- |
| Stable audit ID       | Family prefix plus durable ordinal; do not use a line number                                   |
| Repository path       | Exact tracked path and whether it currently exists                                             |
| Surface kind          | Page, API, helper, job, SQL/RPC, test, or documentation                                        |
| Runtime status        | Current production, active experiment, legacy, adjacent dependency, or unclear                 |
| Purpose               | What the surface measures, computes, persists, or displays                                     |
| User-facing outputs   | Exact visible metric/label names, or `none`                                                    |
| HTTP/trigger contract | Method, inputs, auth, schedule/caller, bounds, and retry identity, or `none`                   |
| Direct dependencies   | Imported helpers/modules and direct database calls                                             |
| Indirect dependencies | API/helper/job chain required to reach sources and targets                                     |
| Reads                 | Exact tables, views, RPCs, files, or external providers read                                   |
| Writes                | Exact tables, views, RPCs, files, or external providers mutated                                |
| Freshness/fallback    | Snapshot/date rules, fallback dates/tables, cache behavior, and stale handling                 |
| Formula/window        | Formula owner, units, strength state, sample window, and ordering                              |
| Validation procedure  | Repeatable SQL/API/test/browser steps with bounded inputs                                      |
| Validation result     | Correct, ambiguous, inconsistent, unverifiable, or pending, with evidence                      |
| Overlap/findings      | Duplicate concepts, naming drift, hidden assumptions, and linked `NEW` tasks                   |
| Future recommendation | Keep, shared-helper refactor, merge into unified engine, UI-only wrapper, deprecate, or delete |

## Reusable terminology sheet

Complete one row per system family and add metric-level rows whenever one family uses the same word for materially different calculations.

| Term                 | Required definition                                                                                                                                |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Trend                | Direction/magnitude being measured, formula, sample window, comparison baseline, and whether descriptive, comparative, predictive, or blended      |
| Baseline             | Population/entity reference, seasons included, weighting/shrinkage, update cadence, and whether it is prior, career, season, recent, or contextual |
| Projection           | Forecast target, horizon, model/formula version, context adjustments, uncertainty representation, and evaluation source                            |
| Typical performance  | Exact center/reference statistic and the population/window from which it is derived                                                                |
| Window               | Game/date/season scope, ordering, minimum samples, strength state, and missing-game behavior                                                       |
| Snapshot             | As-of meaning, time zone, immutable/replaceable behavior, and fallback-date policy                                                                 |
| Sustainability       | Score/band/expectation semantics, source features, version/config provenance, and whether it describes regression pressure or predicts outcomes    |
| Power                | Entity, metric bundle, scaling/ranking method, opponent/venue adjustments, and whether it is descriptive or predictive                             |
| Accuracy/calibration | Outcome source, leakage boundary, metric, evaluation window, sample size, and promotion threshold                                                  |

## Family worksheet index

| Family                                          | Scope                                                                                                  | Inventory                        | Dependency map                    | Validation                     | Consolidation status              |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------- | --------------------------------- | ------------------------------ | --------------------------------- |
| Trends / skater trend metrics                   | Pages, trend APIs, calculators, percentile/config utilities, `player_trend_metrics`                    | Complete; 99 family memberships  | Pending `1.5`–`1.6` / `2.1`–`2.6` | Pending `2.7`                  | Pending `2.8` / `5.7`–`5.8`       |
| Sustainability / baselines / bands / scores     | Score/prior/window/band readers and writers, baseline rebuilds, public/internal APIs                   | Complete; 230 family memberships | Pending `1.5`–`1.6` / `2.4`–`2.6` | Pending `2.7`                  | Pending `2.8` / `5.7`–`5.8`       |
| Team power / underlying / matchup               | Underlying pages, power writers, service/math helpers, CTPI/SOS                                        | Complete; 38 family memberships  | Pending `3.1`–`3.4`               | Pending `3.5`                  | Pending `3.6`–`3.7` / `5.7`–`5.8` |
| Start-chart / rolling metrics / legacy averages | Start chart, rolling builders, player/goalie projections, WIGO/nearby average systems                  | Complete; 102 family memberships | Pending `4.1`–`4.5`               | Pending `4.6`                  | Pending `4.7` / `5.7`–`5.8`       |
| FORGE projections / accuracy                    | FORGE UI/read APIs, run pipeline, goalie stages, result/accuracy/calibration tables                    | Complete; 191 family memberships | Pending `5.1`–`5.5`               | Pending `5.6`                  | Pending `5.7`–`5.8`               |
| Legacy / adjacent systems                       | Tracked experiments, alternate pages, archived schema evidence, tests, and SQL that overlap materially | Complete; 412 family memberships | Pending per owning family         | Pending where still executable | Pending `5.7`–`5.8`               |

## Tracked inventory and classification

The generated manifest at `sustainability-trends-inventory.json` is produced by `web/scripts/audit-sustainability-trends-inventory.mjs`. It starts from explicit PRD surfaces, adds relevant tracked path and SQL-content matches, follows recursive local imports, and includes directly related tests and stories. Every record carries a stable audit ID, exact repository path, surface kind, one or more family memberships, runtime status, and inclusion evidence.

- **Determinism:** two consecutive runs produced 1,052 records and SHA-256 `dc7fa2f3a95444a04f2a30b9fefc8b228257d80f54824c8ca138da7e7bb859b4`.
- **Surface kinds:** 73 APIs/jobs, 117 components, 2 documentation files, 323 helpers/data modules, 27 pages, 59 scripts, 89 SQL/migrations, 1 story, 53 styles, and 308 tests.
- **Runtime status:** 5 current production, 7 active experiment, 78 legacy, 815 adjacent dependency, and 147 unclear.
- **Classification boundary:** current-production status requires direct scheduled-route evidence from `web/vercel.json`; names and imports alone never prove ownership. The 147 unresolved entries remain `unclear` until their owning family audit supplies dependency/runtime evidence.
- **Family semantics:** memberships overlap intentionally because shared helpers, schemas, and tests can serve multiple systems. The family totals therefore are not expected to sum to 1,052.

## Finding register

| Finding                                | Severity | Scope | Status | Required decision/evidence                                                                                                |
| -------------------------------------- | -------- | ----- | ------ | ------------------------------------------------------------------------------------------------------------------------- |
| None registered by this initiative yet | —        | —     | —      | Inventory and family audits must append every discovery as a source/master `NEW` row before remediation or recommendation |

## Validation evidence register

| Trace ID           | Entity/date scope | Raw inputs | Rebuild/read path | Persisted/API/UI comparison | Result          |
| ------------------ | ----------------- | ---------- | ----------------- | --------------------------- | --------------- |
| None completed yet | —                 | —          | —                 | —                           | Pending Phase 4 |

## Consolidation decision register

No keep/merge/refactor/deprecate/delete decision is final until the owning family has a complete dependency map and at least one required validation trace. B-SUST-BAR NEW 13–15 remain explicit upstream strategy boundaries for score format, API/window taxonomy, and first-class version/config provenance.
