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

## First dependency and data-object ownership map

The generated map at `sustainability-trends-dependency-map.json` is produced by `web/scripts/audit-sustainability-trends-dependencies.mjs` from the immutable inventory. It records direct local imports, literal `/api` route references, literal Supabase `.from()`/`.rpc()` references, and SQL `CREATE TABLE/VIEW` declarations. Each mapped surface retains its inventory ID and status so family audits can trace page → API → helper/job → data-object paths without losing provenance.

- **Determinism:** two consecutive runs produce the same summary and SHA-256 `3614e6e55913b6f12b9f7a4f4f9a4401742eb0e627bd4e64b5b067bd68da5375`.
- **Dependency coverage:** 753 surfaces expose at least one dependency/data edge or are page/API entry points; the map contains 1,872 local dependency edges and 263 literal API edges. Of those API edges, 245 resolve directly to tracked route files and 18 remain unresolved literals for family review.
- **Data-object evidence:** 395 tables, views, or RPCs retain exact reader, writer, declaration, invocation, and evidence-origin arrays. Static evidence finds reads for 95 objects, writes for 45, declarations for 380, and 14 RPC names; these counts overlap.
- **Ownership classes:** 107 raw sources, 11 derived aggregates, 33 snapshots, 1 cached output, 10 presentation outputs, and 233 unknown/mixed objects. `unknown_mixed` is a complete classification, not a correctness claim; it prevents silent ownership assumptions until the relevant family trace proves semantics.
- **Dynamic boundary:** 52 dynamic `.from()`/`.rpc()` references across 31 files are counted at their call sites but not assigned an object name. Dynamic imports, constructed API paths, and runtime dispatch likewise remain family-audit work.

This closes the first cross-system map only. It does not close family-specific formula, freshness, validation, consolidation, or deletion rows.

## Trends family static audit (`2.1`–`2.3`)

### Page and consumer surfaces

| Surface                                  | Status and user-facing purpose                                                                                                                                                                                                | Direct dependencies and overlap                                                                                                                                                                                                                                   | Audit result                                                                                                                                                                                                                |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `web/pages/trends/index.tsx`             | Canonical linked `/trends` movement hub for team/skater/goalie percentiles, risers/fallers, player search, projection/start runway, sustainability hot/cold context, and goalie workload.                                     | `useDashboardData` → `loadTrendsDashboardData` concurrently reads team ratings, five Trends APIs, FORGE players/goalies, Start Chart, and two Sustainability leaderboard directions. It links to Underlying Stats, the Sandbox, and active player detail.         | Current user-facing owner. It intentionally defers deeper team diagnosis, prediction-vs-actual, candlesticks, and experimental sustainability semantics. One aggregate request fails as a unit when any dependency rejects. |
| `web/pages/trends/placeholder.tsx`       | Older alternate dashboard with team CTPI/SOS/power, player search, and team/skater chart tabs; explicitly links users back to the unified dashboard.                                                                          | Direct browser Supabase player search plus `team-power`, `team-ctpi`, `team-sos`, and `skater-power`; duplicates much of `/trends` without the canonical aggregate loader.                                                                                        | Legacy/alternate surface, not a source of truth. Retain until consolidation decision; do not infer deletion from filename alone.                                                                                            |
| `web/pages/trendsSandbox.tsx`            | Linked experimental Sustainability Lab for skater/team/goalie entity scores, bands/history, raw season history, metric cards, explanation panels, and brush/zoom charts.                                                      | Direct browser reads of `players`, `wgo_skater_stats`, `nst_gamelog_as_counts`, and `nst_gamelog_as_counts_oi`, plus Sustainability entity option/score/band/history APIs and `lib/trends/utils`. URL query state owns entity/date/window/metric/chart selection. | Active experiment. It intentionally overlaps player detail and Sustainability reads but is not canonical for persistence or formula authority.                                                                              |
| `web/pages/trendsTestingGrounds.tsx`     | Unlinked manual GET/rebuild workbench for `player_trend_metrics`, including arbitrary player/metric/limit and rebuild start date.                                                                                             | Direct browser GET/POST to `/api/v1/trends/player-trends`; metric options come from `PLAYER_TREND_METRICS`.                                                                                                                                                       | Unsafe operational experiment: its direct POST dependency is the P0 NEW 1 breaking-contract boundary.                                                                                                                       |
| `web/pages/trends/player/[playerId].tsx` | Active linked player drill-down for surface/rate/finishing/usage/chance groups, rolling 3/5/10/20/cumulative comparisons, season/3-year/career/cumulative baselines, quick views, streak summaries, and FORGE return context. | Direct browser reads of `players` and deterministically paginated `rolling_player_game_metrics`; URL state owns baseline/window/view/group/metric selection. Consumed from Trends, FORGE, transactions, predictions, and dashboard cards.                         | Current player-detail owner. It does not read `player_trend_metrics`, so the persisted trend-rebuild family and the visible player trend page are parallel implementations with different keys/windows.                     |

### API contract map

| API                            | Method / parameters                                                                                                                                                                     | Reads and writes                                                                                                                                                                                                                | Freshness, fallback, pagination, consumers                                                                                                                                                                                         |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | --- | --- | ---------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/api/v1/trends/player-trends` | Public GET accepts optional `playerId`, `metricKey`, `seasonId`, and limit 1–500. POST accepts `startDate` (default 2023-01-01), optional `seasonId`, `playerIds`, and `writeFromDate`. | GET reads `player_trend_metrics`. POST range-paginates `player_stats_unified`, `wgo_skater_stats_playoffs`, and `goalie_stats_unified`, calculates metrics, then service-role upserts `player_trend_metrics` in 500-row chunks. | GET sorts newest-first and caps rows. POST has no auth or bounded historical default; Testing Grounds calls it directly. Scheduled current-season writes instead enter through `/api/v1/db/update-player-trend-metrics`. P0 NEW 1. |
| `/api/v1/trends/skater-power`  | GET; `date`, `position=forward                                                                                                                                                          | defense                                                                                                                                                                                                                         | all`, `window=1                                                                                                                                                                                                                    | 3   | 5   | 10  | 20`, limit 1–50. | Range-paginates current-season `player_trend_metrics`; reads bounded player metadata. | Fifteen-minute server/client cache, in-flight dedupe, requested/resolved date contract, stale/degraded serving state, low-sample shrink-to-neutral and rank-delta suppression. Consumed by canonical and placeholder dashboards. |
| `/api/v1/trends/team-power`    | GET; no user filters; current season from `fetchCurrentSeason`.                                                                                                                         | Reads four dynamic source tables: all-strength, PP, and PK NST team gamelogs plus WGO team stats; computes four category percentile series in memory; no writes.                                                                | Fifteen-minute HTTP/client cache but no requested-date contract. Reads are ordered but not paginated and can truncate season rows; P1 NEW 3. Consumed by canonical and placeholder dashboards.                                     |
| `/api/v1/trends/team-ctpi`     | GET; optional `date`, default today.                                                                                                                                                    | Prefers paginated `team_ctpi_daily`; otherwise paginates current-season AS/PP/PK inputs and computes CTPI in memory.                                                                                                            | Requested/resolved date, fallback flag/strategy, source kind/date/computed-at/row-count, and 15-minute cache. Consumed by canonical and placeholder dashboards.                                                                    |
| `/api/v1/trends/team-sos`      | GET; optional `debug` adds distribution summaries.                                                                                                                                      | Reads latest current-season date then exact-date `sos_standings`; computes ratings in memory.                                                                                                                                   | Empty season returns HTTP 200 with message/empty teams; read errors inside the helper collapse to the same empty result, while thrown errors return 500. Fifteen-minute cache. Consumed by canonical and placeholder dashboards.   |

### Formula, window, and hidden-assumption map

- `playerTrendCalculator` sorts by player/date, accumulates finite non-null values, publishes cumulative mean plus sample variance/standard deviation, and publishes rolling 3/5/10 only after a complete window. State resets by player; the scheduled writer supplies an exact current season, while the public optional-season POST can span seasons. Skater metrics use canonical view fields with selected fallbacks; goalie metrics contain multiple `any` casts. `expected_shooting_pct` is not semantically compatible with the contextual ranking definition (P1 NEW 2).
- `teamPercentiles` ranks each metric by ordinal index `(index / (n-1)) * 100`, reverses lower-is-better metrics, assigns a one-team population 50, then takes the configured weighted mean of available metric percentiles. Missing metrics reduce the denominator rather than fail the category. Ties are not midpoint-ranked, so equal values can receive different percentiles according to stable input order.
- `teamMetricConfig` defines offense, defense, power-play, and penalty-kill bundles with fixed integer weights 1–5 across AS/PP/PK/WGO sources. Opportunity counts participate as positive offense and negative defense context; no normalization by games occurs in the percentile helper beyond whatever each source column already represents.
- `skaterMetricConfig` exposes shots/60, ixG/60, TOI, and PP TOI; all are marked higher-is-better. Allowed windows are 1/3/5/10/20, default 1; position cohorts are forwards, defense, or all; limit is 25 by default and 50 maximum.
- `lib/trends/utils` uses population standard deviation, a first-greater-or-equal percentile lookup, 1% default winsorization, ordinary least squares, fixed luck baselines (8% on-ice shooting and PDO 1.0), fixed SKO weights, and partial-window rolling averages. Sandbox hot/cold streaks compare raw points—not rolling values—to one caller-provided baseline and require two consecutive games; intensity is `min(1, 0.25 + 0.18 * length)`.

## Finding register

| Finding                                        | Severity | Scope                                          | Status                                          | Required decision/evidence                                                                                                                                       |
| ---------------------------------------------- | -------- | ---------------------------------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NEW 1 unauthenticated privileged trend rebuild | P0       | Player-trends POST / Testing Grounds           | Open — breaking contract                        | Select authenticated-admin/cron, local-only, or read-only Testing Grounds contract; require fail-closed auth, bounded inputs, regressions, and deployment proof. |
| NEW 2 expected-shooting identity/formula drift | P1       | `playerTrendCalculator` / persisted trend rows | Open — semantic/history decision                | Select canonical numerator, denominator, percent unit, key/version, and bounded historical repair policy before changing rows or labels.                         |
| NEW 3 team-power season truncation             | P1       | Team-power API                                 | Open — implementation-ready after P0 checkpoint | Add ordered pagination per dynamic source and prove multi-page category/ranking parity.                                                                          |

## Validation evidence register

| Trace ID           | Entity/date scope | Raw inputs | Rebuild/read path | Persisted/API/UI comparison | Result          |
| ------------------ | ----------------- | ---------- | ----------------- | --------------------------- | --------------- |
| None completed yet | —                 | —          | —                 | —                           | Pending Phase 4 |

## Consolidation decision register

No keep/merge/refactor/deprecate/delete decision is final until the owning family has a complete dependency map and at least one required validation trace. B-SUST-BAR NEW 13–15 remain explicit upstream strategy boundaries for score format, API/window taxonomy, and first-class version/config provenance.
