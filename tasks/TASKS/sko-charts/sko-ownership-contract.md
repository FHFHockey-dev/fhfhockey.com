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
| `/api/v1/ml/get-predictions-sko`                                             | Public read-only table reader with strict filters, deterministic bounded pages, complete model/update identity, and explicit page freshness/coverage                     | Quarantined read API                                           | Approved consumer plus remaining source-warning/model-promotion contract before promotion    |
| `PredictionsLeaderboard`, `usePredictionsSko`, `InfoPopover`, `SkoExplainer` | No tracked page import; reads through the quarantined API when mounted                                                                                                  | Orphaned quarantine bundle                                     | Deliberate reintegration or checkpointed removal under NEW 9.4                               |
| `/api/v1/db/update-sko-stats`                                                | Active scheduled source-ingest writer for `sko_skater_stats`; current broad service-role implementation                                                                 | Operational legacy source writer                               | Fail-closed auth, then schema/pagination/completeness verification under Phase 2             |
| `sko_skater_stats`, `sko_skater_years`, `sko_trends`                         | Public-read legacy/research tables; primary grains are player/date/season, player/season, and player/date                                                               | Legacy/research data                                           | Reconcile live schema, freshness, and actual consumers before retention/promotion claims     |
| `predictions_sko_metrics`                                                    | Named throughout requirements and modeling notes but absent from the tracked production baseline and generated types                                                    | Missing planned data contract                                  | Schema/ownership decision under Phase 2 before UI accuracy-history work                      |
| `web/scripts/output/sko_*`                                                   | Retained parquet/CSV/JSON artifacts after executable pipeline deletion                                                                                                  | Generated historical evidence                                  | Prove intentional retention/version/checksum or remove through burn-down controls            |
| `web/web/scripts/output/sko_*`                                               | Four older nested generated copies; no runtime/docs consumer, three nonidentical parquet pairs, one identical one-byte CSV pair                                          | Unowned archive/removal candidates                              | Resolve NEW 9.12 with B-DEAD plus 8.4 retention/version provenance before any deletion        |
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

## Prediction persistence evidence

- The live table and active writer both use `(player_id, as_of_date, horizon_games)` as the sole identity/conflict target. `model_name` and `model_version` are required payload fields but not key fields, so a second model identity at the same player/date/horizon overwrites the first. NEW 9.7 keeps the canonical grain and any migration/backfill decision open.
- Production currently contains only `baseline-moving-average` `v0.2`: 6,328 rows across 303 players from 2025-10-16 through 2026-07-22. This single observed identity does not prove the current key can preserve future challenger or version history.
- The writer now paginates ordered discovery rows until a short page, deduplicates/sorts the complete player set, and applies an optional player limit only afterward with `partial=true` when selection is intentionally bounded. Per-player queries select the latest 60 rows descending and restore chronological model input. The stable response reports model identity, discovery/selection/processing/skips, source rows/cutoff/lag, series lengths, and attempted/completed write progress. The focused route/helper suite passes 6/6 and full TypeScript passes; exact checkpoint `c6bf60821d17e3065cfa95063f12aefc20140fcf` publishes NEW 9.8 without changing data, schema, schedule, or model semantics.
- The 2026-07-22 daily run wrote 107 rows stamped `as_of_date=2026-07-22`, while the newest qualifying `player_stats_unified` source date is 2026-04-16. NEW 9.9 keeps the product/operations freshness policy open; no existing evidence authorizes an offseason lag threshold or data rewrite.
- The public reader now uses only the existing read-only server client under live public SELECT RLS. Service-role resolution, JWT inspection, credential-source warnings, and key-prefix logs are absent; NEW 9.10 is complete.
- Strict real-date/range/id/order/page validation precedes data work. Exact-count ranges use stable as-of/player/horizon ordering, cap page size at 2,000 for compatibility with the dormant sparkline caller, include model name/version and both timestamps, and return page-scoped freshness plus coverage/has-more/partial metadata. The direct reader suite passes 8/8, the combined reader/writer group passes 2 files/14 tests, and full TypeScript passes; exact checkpoint `531b35476436fd221efad83b79c6870fda6db516` publishes base 5.2 and NEW 9.10/9.11 while 5.3/5.5 retain source-warning and broader empty/stale/consumer evidence.
- The reader's generic catch currently returns and logs the database client's raw error message. P2 NEW 9.15 owns a stable public 500 contract, sanitized server diagnostics, and empty/error-state regressions before API error/test rows can close.

## Frozen boundary pending NEW work

- Do not call the moving-average v0.2 score, the legacy GameScore × characteristic multiplier, or the deleted offline ML × stability output the single canonical SKO model.
- Do not restore deleted modeling scripts, create `predictions_next_game`, promote prediction UI, reinterpret stored rows, or change schedules as part of reconciliation alone.
- Mutation endpoints must fail closed before any prerequisite/source query or service-role write.
- Keep Sustainability, current Trends, FORGE, and SKO names/outputs distinct until NEW 9.2 records a versioned product decision.

## Burn-down inventory and classification

- Bounded tracked-file, import, route, cron, script, function-entrypoint, schema/type, and Git-history searches re-verify every grouped SKO artifact in the ownership matrix. Exact checkpoint `eca9fee58e902625b3171427fc0b69d1b6619918` publishes base 7.1/7.2 closure on classification evidence, not deletion or promotion.
- The active writers, admin/cron caller, dependency check, and source-ownership registry remain operational compatibility controls. The public reader and prediction UI remain quarantined; current Trends/FORGE remain their supported replacement boundary.
- The nested `web/web/scripts/output/` directory contains four tracked, unreferenced artifacts totaling about 10.5 MB. Its three parquet hashes differ from the canonical-path copies; both timing CSVs share the empty-file hash. B-DEAD already recommends an archive decision. NEW 9.12 keeps all four intact pending intentional retention/version provenance under 8.4.

## External pipeline reachability and failure contract

- `functions/vercel.json` gives Python functions a 240-second/1,024-MB limit and maps `/sko/pipeline` to `/api/sko/pipeline/index.py`, which does not exist. The exact READY Production functions deployment `dpl_3mN6xSDiuWachTogRGbuEJbi71m6` at source `258cbcbc05b897a73db9e710b6fcb22c5f3a5a3b` serves `/api/healthz` as 200 but `/sko/pipeline` as Vercel 404. No pipeline request was sent.
- Local inbound/outbound code now requires a nonblank `SKO_PIPELINE_SECRET`, rejects missing/invalid bearers and unknown stages before work, and always forwards bearer auth for allowed requests. Six focused tests prove missing-secret/no-request, unknown-stage/no-request, valid sanitized/authenticated forwarding, inbound 401s, and placeholder behavior. Exact checkpoint `053f3558fdd1d99759aa087a60f369e21813fb64` is READY as branch deployment `dpl_EDiTZFRS1LASCS5iLFC4SWpqHQVm`; GET-only health is 200 and `/sko/pipeline` remains 404, so NEW 9.13 closes without route restoration or execution.
- The repository exposes no executable backfill/train/score/upload implementation after the deliberate modeling-script deletion. `/sko/pipeline-step` now returns honest 501 `implemented=false` after valid auth rather than accepted/success. NEW 9.14 is complete; Production remains untouched/404 and NEW 9.3 retains the restore/replace/historical-only decision.
- `sko-runbook.md` records environment names only, jobs 321/327, four named timeouts versus the platform cap, absent metric/cleanup/state owners, safe checks, forbidden operational calls, artifacts, failures, and rollback prerequisites. Exact checkpoint `053f3558fdd1d99759aa087a60f369e21813fb64` publishes base 4.1/8.1 closure on truthful inventory, not operability.

## Verification

- Complete reads of both SKO PRDs, modeling notes, the historical burn-down plan, the reconciled task list, current quarantine/ownership registries, route implementations, supported Trends consumers, schema baseline/types, and relevant Git deletion history.
- Targeted import/call search found no supported-page consumer of the SKO reader bundle and no supported-page import of the legacy score helpers.
- Read-only production cron query verified both active callers, schedules, Authorization-header presence, and Vault `cron_secret` references without returning commands or secret values.
- Authorization regressions cover missing and invalid GET/POST credentials before dependency/source work. Exact commit `d20296a3238d376061a1e5bda100cc499b6f61b3` is READY as branch deployment `dpl_41tmHEfL2f9yWnr3q8bhcLDcS6Rw`; missing GET and invalid POST return 401 for both routes, current-secret PUT reaches safe 405 method validation, and the bounded relevant runtime-error query is empty. This is not a Production-target deployment, so customer-production proof remains open.
