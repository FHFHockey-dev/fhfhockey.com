# SKO Ownership and Runtime Contract

Date: 2026-07-22

Status: Reconciliation complete; no SKO score family is promoted as a canonical supported product contract.

## Decision hierarchy

1. Current runtime code, tracked schema, active callers, and explicit quarantine registries are implementation truth.
2. `prd-sko-charts.md` remains the governing requirements document for any future SKO promotion, but its GameScore/characteristic-value formula is not the current writer implementation.
3. `prd-sko.md` is superseded research input. Its residual-P/60 model belongs only in Sustainability/Trends research unless separately promoted.
4. `sko-modeling-notes.md` and the old modeling sections of `prd-sko-charts.md` are historical plans: the referenced `web/scripts/modeling/*` executables were deliberately deleted by commit `abbc01e8c5dc99e1544594e0c72bdecd0a013ea8`.
5. `dead-code-cleanup/burn-down-plan.md` is an unimplemented historical alternative, not an approved v2 runtime. No tracked `predictions_next_game` table or generated type exists.

## Ownership matrix

| Surface / artifact                                                           | Current owner and behavior                                                                                                                                              | Classification                                                 | Promotion or closure requirement                                                             |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `/trends`                                                                    | Supported movement surface using rolling metrics plus canonical FORGE/goalie-start runway; explicitly defers prediction-vs-actual and candlesticks                      | Canonical supported product                                    | Keep SKO out until a score/data contract passes promotion gates                              |
| `/trends/player/[playerId]`                                                  | Reads complete paginated `rolling_player_game_metrics` history and player identity directly; does not consume `predictions_sko`                                         | Canonical supported detail                                     | Preserve its rolling-data ownership unless a reviewed API replacement is introduced          |
| Sustainability APIs and `web/lib/sustainability/*`                           | Separate versioned TypeScript sustainability score family already mapped by B-SUST-AUD                                                                                  | Canonical adjacent model                                       | Residual-P/60 research may enter only through that initiative's formula/version gates        |
| `/skoCharts`                                                                 | Static noindex quarantine notice; executes no SKO calculations or data joins                                                                                            | Quarantined lineage route                                      | Remove only through the later checkpointed burn-down task                                    |
| `calculateGameScore` plus characteristic/statistics helpers                  | Legacy weighted GameScore, capped squared-z characteristic value, rolling average, empirical thresholds, and smooth confidence helper; no tracked supported-page import | Quarantined formula family                                     | Re-derive and validate before any product reuse; do not label it current production behavior |
| `/api/v1/ml/update-predictions-sko`                                          | Active scheduled/admin writer; recent points blend × points-standard-deviation multiplier, persisted as `baseline-moving-average` `v0.2`                                | Operational compatibility/research writer, not canonical model | Fail-closed auth, then resolve NEW 9.2 and model-promotion evidence                          |
| `predictions_sko`                                                            | Grain `(player_id, as_of_date, horizon_games)`; stores prediction, multiplier, score, nullable `top_features`, model name/version, timestamps                           | Quarantined serving table                                      | Define freshness, history, model identity, coverage, and promoted consumer contract          |
| `/api/v1/ml/get-predictions-sko`                                             | Public server-side table reader with filters and a capped response                                                                                                      | Quarantined read API                                           | Pagination/partial/freshness contract plus an approved consumer before promotion             |
| `PredictionsLeaderboard`, `usePredictionsSko`, `InfoPopover`, `SkoExplainer` | No tracked page import; reads through the quarantined API when mounted                                                                                                  | Orphaned quarantine bundle                                     | Deliberate reintegration or checkpointed removal under NEW 9.4                               |
| `/api/v1/db/update-sko-stats`                                                | Active scheduled source-ingest writer for `sko_skater_stats`; current broad service-role implementation                                                                 | Operational legacy source writer                               | Fail-closed auth, then schema/pagination/completeness verification under Phase 2             |
| `sko_skater_stats`, `sko_skater_years`, `sko_trends`                         | Public-read legacy/research tables; primary grains are player/date/season, player/season, and player/date                                                               | Legacy/research data                                           | Reconcile live schema, freshness, and actual consumers before retention/promotion claims     |
| `predictions_sko_metrics`                                                    | Named throughout requirements and modeling notes but absent from the tracked production baseline and generated types                                                    | Missing planned data contract                                  | Schema/ownership decision under Phase 2 before UI accuracy-history work                      |
| `web/scripts/output/sko_*`                                                   | Retained parquet/CSV/JSON artifacts after executable pipeline deletion                                                                                                  | Generated historical evidence                                  | Prove intentional retention/version/checksum or remove through burn-down controls            |
| `functions/lib/sko_pipeline.py`                                              | HTTP orchestrator for external `backfill`, `train`, `score`, and `upload` stages configured by endpoint/secret                                                          | External-stage compatibility orchestrator                      | Identify the actual endpoint owner/stages or retire; it is not a local model implementation  |
| Deleted `web/scripts/modeling/*`                                             | Historical ElasticNet/GBRT/feature/score/upload implementation removed by the burn-down commit                                                                          | Deleted historical implementation                              | Do not assign current tasks to these paths without an explicit restoration decision          |
| `predictions_next_game` v2 proposal                                          | Described only in the historical burn-down plan                                                                                                                         | Unimplemented proposal                                         | Requires an explicit strategy checkpoint; no migration/scaffold work is inferred             |

## Active consumer and caller trace

- Current supported Trends pages do not import `PredictionsLeaderboard`, `InfoPopover`, `SkoExplainer`, or `usePredictionsSko` and do not call either SKO API.
- The prediction reader bundle is internally API-backed rather than a direct-table browser consumer, but it is unmounted and remains quarantined.
- The admin `/db` action calls `update-predictions-sko` through `doPOST`, which supplies the signed-in session bearer token.
- Production pg_cron job 321 calls `update-sko-stats` at `30 10 * * *`; job 327 calls `update-predictions-sko` at `45 10 * * *`. Both are active and both use an Authorization header derived from Vault `cron_secret` without exposing its value.
- No tracked supported route consumes the legacy GameScore/characteristic helper family.

## Live schema reconciliation

Read-only production catalog evidence, `supabase/migrations/20260716112908_production_schema_baseline.sql`, generated TypeScript types, and current runtime references agree on this exact state:

| Relation                  | Live/baseline/type contract                                                                                                          | RLS/read policy                                     | Runtime disposition                                                  |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------- | -------------------------------------------------------------------- |
| `predictions_sko`         | 13 columns; primary key `(player_id, as_of_date, horizon_games)`; positive-horizon check; required model name/version and timestamps | RLS enabled; SELECT allowed to `anon,authenticated` | Active quarantined reader and protected compatibility writer         |
| `sko_skater_stats`        | 28 columns; primary key `(player_id, date, season_id)`                                                                               | RLS enabled; SELECT allowed to `anon,authenticated` | Active protected source-ingest writer plus legacy readers            |
| `sko_skater_years`        | 21 columns; primary key `(player_id, season)`                                                                                        | RLS enabled; SELECT allowed to `anon,authenticated` | Legacy updater/read helper only                                      |
| `predictions_sko_metrics` | Absent from live catalog, production baseline, generated types, and runtime code; named only in requirements/modeling notes          | Not applicable                                      | Missing planned contract; no migration is inferred by reconciliation |

No live relation, policy, migration, type, or runtime reference supports the historical `predictions_next_game` proposal.

## Source-ingest persistence contract

- The active `update-sko-stats` date path paginates all 16 NHL source families with the same explicit `start`/`limit` cursor and continues until every family returns a short page.
- Date windows pass their canonical season ID directly; date-only runs resolve the latest started canonical NHL season for the requested date. No historical `sko_skater_stats` preload participates in season identity or row construction.
- One typed mapper emits exactly the 28 live `sko_skater_stats` columns. It derives `time_on_ice`, `ipp`, and `sog_per_60`, preserves zero values, and maps the six supported 5v5 assist fields.
- One batch upsert is attempted per date. Any schema/write error fails closed; the writer no longer learns the schema by retrying and dropping server-rejected fields.
- Focused helper/route regressions pass 2 files/11 tests, including full/short-page continuation, the exact 28-key payload, derived-field arithmetic, one-attempt batching, schema-error propagation, and authorization/method boundaries. Full TypeScript passes.
- Exact implementation/control commit `77485503560498750a0f8e023e55fb646be98456` is published on `octoberBranch`; fresh fetch proves local/tracking/live equality.

## Frozen boundary pending NEW work

- Do not call the moving-average v0.2 score, the legacy GameScore × characteristic multiplier, or the deleted offline ML × stability output the single canonical SKO model.
- Do not restore deleted modeling scripts, create `predictions_next_game`, promote prediction UI, reinterpret stored rows, or change schedules as part of reconciliation alone.
- Mutation endpoints must fail closed before any prerequisite/source query or service-role write.
- Keep Sustainability, current Trends, FORGE, and SKO names/outputs distinct until NEW 9.2 records a versioned product decision.

## Verification

- Complete reads of both SKO PRDs, modeling notes, the historical burn-down plan, the reconciled task list, current quarantine/ownership registries, route implementations, supported Trends consumers, schema baseline/types, and relevant Git deletion history.
- Targeted import/call search found no supported-page consumer of the SKO reader bundle and no supported-page import of the legacy score helpers.
- Read-only production cron query verified both active callers, schedules, Authorization-header presence, and Vault `cron_secret` references without returning commands or secret values.
- Authorization regressions cover missing and invalid GET/POST credentials before dependency/source work. Exact commit `d20296a3238d376061a1e5bda100cc499b6f61b3` is READY as branch deployment `dpl_41tmHEfL2f9yWnr3q8bhcLDcS6Rw`; missing GET and invalid POST return 401 for both routes, current-secret PUT reaches safe 405 method validation, and the bounded relevant runtime-error query is empty. This is not a Production-target deployment, so customer-production proof remains open.
