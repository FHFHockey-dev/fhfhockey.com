# Projection audit trace notes

Repository paths and line numbers below refer to the audited checkout; `evidence/source/` preserves key files. `source-hashes.json` records scanned code identity. See `REPORT.md` for conclusions and `inventory.tsv` for every discovered relevant mention and broad-family screening result.

## 1. Actual table/configuration inventory

Current provider config `web/lib/projectionsConfig/projectionSourcesConfig.ts`:

| Line | Table | Default behavior |
|---|---|---|
| 69 | `PROJECTIONS_20262027_AG_SKATERS` | Aggregate A&G source |
| 81 | `PROJECTIONS_20262027_BLAKE_AG_SKATERS` | Component, `defaultSelected: false` |
| 94 | `PROJECTIONS_20262027_NATE_AG_SKATERS` | Component, `defaultSelected: false` |
| 107 | `PROJECTIONS_20262027_CULLEN_SKATERS` | Skater source |
| 119 | `PROJECTIONS_20262027_CULLEN_GOALIES` | Goalie source |
| 131 | `PROJECTIONS_20262027_DTZ_SKATERS` | Skater source |
| 143 | `PROJECTIONS_20262027_DTZ_GOALIES` | Goalie source |
| 155 | `PROJECTIONS_20262027_5V5_SKATERS` | Skater source |
| 167 | `PROJECTIONS_20262027_5V5_GOALIES` | Goalie source |

Baseline `supabase/migrations/20260716112908_production_schema_baseline.sql` defines the following 2025–26 tables. Generated type definitions are `web/lib/supabase/database-generated.types.ts` at the listed lines. Names including `FHFH` are still within TJ's external-table policy; a label does not establish model ownership.

| Suffix after `PROJECTIONS_20252026_` | CREATE line | Type line |
|---|---|---|
| AG_SKATERS | 6613 | 24141 |
| CULLEN_GOALIES | 6636 | 24203 |
| CULLEN_SKATERS | 6653 | 24247 |
| DFO_GOALIES | 6676 | 24309 |
| DFO_SKATERS | 6699 | 24371 |
| DTZ_GOALIES | 6726 | 24445 |
| DTZ_Skaters | 6757 | 24531 |
| FHFH_SKATERS | 6801 | 24656 |
| KUBOTA_SKATERS | 6830 | 24736 |
| LAIDLAW_SKATERS | 6860 | 24819 |

No 2026–27 target-family DDL or generated table declarations were found. Config references are not proof that corresponding live relations exist or are absent.

## 2. Allowed consumers and misleading shared names

`web/pages/projections/index.tsx:630,649` and `web/components/DraftDashboard/DraftDashboard.tsx:1376,1393` invoke `useProcessedProjectionsData`. The hook's active configs feed `sourceConfig.tableName` into Supabase SELECT at `web/hooks/useProcessedProjectionsData.tsx:586,1867`. Config selection, custom sources, row selection, proration, ranking, VORP and recommendation helpers operate within these allowed surfaces. Custom imported sources are not target-family database tables.

`web/pages/draft-dashboard.tsx:20` mounts DraftDashboard. That component imports `useRosterScheduleOptimizer` at line 70 and calls it at 2371. This older schedule tool consumes processed draft data on the allowed page. Its type import of ProcessedPlayer (`web/hooks/useRosterScheduleOptimizer.ts:3`) does not make the standalone `/roster-schedule-optimizer` product a caller of the provider-fetch hook. Many additional `ProcessedPlayer` imports are explicitly type-only; non-explicit type imports also erase under TypeScript transpilation. The inventory retains them without calling them table reads.

The standalone RSO product is `web/pages/roster-schedule-optimizer.tsx:19` → `components/RosterScheduleOptimizer`. Its data API uses `rosterScheduleData/planning.ts`, not `useProcessedProjectionsData`.

## 3. Current FORGE writer, dynamic sites and upstream SQL

The syntactic value-import closure from `web/lib/projections/run-forge-projections.ts` contains 66 modules. It contains no provider-config import and no literal target-family query. All five nonliteral database/RPC sites were resolved:

| Site | Resolution |
|---|---|
| `dailyBoardEvidence.ts:156` (`table`) | Local `read` calls at 180–186 use `player_forecast_lineup_snapshots`, `player_forecast_goalie_start_observations`, `player_forecast_observation_conflicts`, `player_forecast_lineup_assignments`, and `player_forecast_conflict_resolutions`. |
| `queries/run-lifecycle-queries.ts:503` (`table`) | Loop at 497–500 deletes only the three native FORGE output tables for a claimed run/game scope. |
| `queries/skater-queries.ts:270` (`LATEST_ROLLING_ROWS_RPC`) | Constant at 182 is `forge_latest_rolling_rows`; SQL migration `20261021182129_forge_latest_rolling_rows.sql:83,90` reads rolling metrics/support payloads. |
| `queries/skater-queries.ts:414` (`ROLLING_PLAYER_SUPPORT_PAYLOAD_TABLE`) | Constant in `web/lib/supabase/Upserts/rollingPlayerSupportPayload.ts:3` is `rolling_player_metric_support_payloads`. |
| `seasonBootstrap.ts:149` (population ternary) | Only `skatersGameStats` / `goaliesGameStats`; no provider fallback. |

`forge_league_skater_physical_totals` SQL (`supabase/migrations/20261020211500_forge_league_skater_physical_totals.sql:33`) reads `wgo_skater_stats`. The `player_stats_unified` materialized view is defined in baseline SQL at 22793; goalie unified views at 10419/10734 are native statistics joins. No source-family SQL read/join was found in these or elsewhere in the scanned SQL. The full-family search across SQL yielded only the historical target table definitions and associated schema statements. Catalog/admin metadata and general SQL interfaces cannot prove absence of database objects installed outside repository definitions.

Current live writer flow:

`run-forge-projections.ts:480` (bootstrap flag) → skater stage `1559,1713` / goalie stage `180` → history-only `loadSeasonBootstrap` → skater blend `2809` → native persistence stage (`stages/persistence-stage.ts:12`). `seasonBootstrap.ts:84–87` fixes disclosure `fantasyWeight: 0`, `sourceIds: []`.

`isFantasyProjectionSource` (`run-forge-projections.ts:424`) matches `/^projections_/i`. `readsExcludeExternalFantasy` at 429 requires every captured source to be audited and non-fantasy, including failed read attempts. `inputProvenance` at 565 receives this claim; run-start metrics at 699 do not. Boundary tests are `nativeInputEligibility.test.ts` and `run-forge-projections.external-inputs.test.ts`; this audit additionally executed isolated source checks, not the repository Vitest runner.

## 4. Historical FORGE ingestion is confirmed in source history

Read-only `git show 7007a0527^:web/lib/projections/seasonBootstrap.ts` establishes:

- imports provider config at 2 and current season contract at 3;
- at 171–172, chooses default-selected config entries only when `allowCurrentFantasy` and the current season match;
- at 190, reads `db.from(source.tableName)`;
- at 30, converts full-season provider totals per projected appearance;
- at 95–113, blends them into skater stats with a fantasy share fading over 20 current-season games;
- both old skater callsites passed true; goalie passed false.

The four skater sources were AG, Cullen, DTZ, and 5v5. A&G components were default-excluded. Their values could enter goals, assists, SOG, PP points, hits and blocks in `forge_player_projections` when the old live bootstrap conditions were met. Prior source is preserved at `evidence/historical/seasonBootstrap.before-7007a0527.ts`. This proves prior code behavior, not production flag state or persisted data contents. No equivalent external-prior path was established for goalie or team projections; their native relation names should not be treated as evidence of contamination.

## 5. RSO indirect legacy exposure and protected paths

Entrypoints:

- `web/pages/api/v1/roster-schedule-optimizer/data.ts:22`;
- `web/pages/api/v1/roster-schedule-optimizer/yahoo-current-data.ts:26`;
- `web/lib/integrations/yahoo/rosterPlanning.ts:331`.

All pass `forgeDailyBridge: true, consumer: "rso"` to `loadPlanningData`. Bridge selection at `planning.ts:195` requires selected source kind `legacy`, no admitted revision forecasts, no native baseline sources, and `RSO_FORGE_DAILY_BRIDGE !== "off"`. This is an actual conditional runtime path; current production selection was not queried.

`forgeDailyBridge.ts:569` selects successful released horizon-one runs in a seven-day lookback; fields are run ID/date/creation/git SHA only. `releasedRunFence.ts:12,31` excludes null/local Git SHAs and wrong horizons, not externally blended runs. At 582 it loads native skater output rows. The pure builder at 275 accepts matching runs without exclusion proof, and reuses native heads for exact/future games. This audit's synthetic fixture returns one row with SOG 3.1 even though its run contains no provenance.

`planning.ts:218` applies detailed target review only to non-bridged output. It places bridge IDs in the current manifest at 216. `currentPlanningRead.ts:24` / its active scope near 121 bind current immutable bridge rows; `rsoUsePolicy.ts:104` authorizes those bound current rows. This is not merely a serialized-label bypass: it is a deliberately authorized current bridge whose reader has no provider-exclusion boundary. Solver scoring/totals use `web/lib/rosterScheduleOptimizer/planning.ts:108,227`.

Protected alternatives: detailed revision admission checks the external fantasy contract at `consumerRevisionAdmission.ts:88`; native contribution admission verifies original observations and rejects nonempty projection inputs at `nativeContributionAdmission.ts:42`. The baseline modules are imported through native helpers, but the capture functions are not invoked by these admission functions.

## 6. Start Chart, FORGE APIs and downstream consumers

Start Chart's legacy `fetchSlate` reads native skater outputs embedded in a released run (`start-chart.ts:841–899`), explicitly retains unlabelled externally blended runs at 907, and returns projections at 1032. Its revision branch (`935–1014`) uses strict consumer admission and clears rows if revisions cannot be admitted while serving is enabled. The legacy branch remains when serving is disabled. A confined extraction of the actual `fetchSlate` function retained a synthetic unlabelled source row.

At `1479` it evaluates provenance; at `1585` it only adds `unverified_projection_provenance`. At `1616–1643` values become fantasy scores and forecast objects. At `1748` filtering is by requested position. Therefore the warning does not prevent product consumption.

`web/lib/projections/apiHelpers.ts:41` similarly selects released successful runs without external-input proof. `web/pages/api/v1/forge/players.ts:251,285` serves them; fallback selection at `157–205` and reads at 310 are also unguarded. `web/pages/api/v1/projections/players.ts:64–70` rejects unproven **explicit** run IDs, but its default path at 72 uses the same unguarded latest helper. `run-projection-accuracy.ts:1724` does check eligibility before calibration; do not equate that protected job with the public player reader.

Downstream static consumers beyond Start Chart:

| Consumer | Evidence | What actually uses skater values |
|---|---|---|
| `/FORGE` | `web/pages/FORGE.tsx:230,238` | Start Chart supplies slate context; `/api/v1/forge/players` supplies top-add/trust player data (`312–384`). |
| `/trends` | `web/pages/trends/index.tsx:204,236,279` → `useDashboardData` → `dataFetchers.ts:432,438,739,747` | FORGE player rows are the default projection source; selectable legacy rows map Start Chart goals/assists/PPP/SOG/hits/blocks at 288–298. |
| `/forge/team/[teamId]` | `web/pages/forge/team/[teamId].tsx:130,172` | Calls Start Chart for slate/game context; this alone does not establish pundit skater-head use on that page. |
| Shared FORGE dashboard cards | `TeamPowerCard.tsx:129,163`; `SlateStripCard.tsx:161` | Start Chart context; retained as indirect API dependencies, not independently proved external skater-value consumption. |
| Command center source adapter | `web/lib/dashboard/commandCenterData.ts:272,333` | Reads/normalizes Start Chart. Requires its route/component to invoke the adapter; metadata alone is not observed execution. |
| Served forecast ledger cron | `web/pages/api/v1/db/forge-served-forecast-snapshot.ts:56,90,96`; `web/vercel.json:119` | Reads bridge forecasts, builds and upserts `forge_served_forecast_ledger`; can carry historical derived values if selected source rows contain them. |

The SQL publisher `replace_forge_projection_results_atomic` in migration `20261021165413...sql:55` requires rolling-history provenance but not the external-fantasy contract. Its normal accuracy caller checks stronger eligibility before calling. This is a weaker SQL defence-in-depth boundary, not a confirmed pundit-source query or observed production write. Existing stored result lineage remains unknown.

## 7. Draft discovery direct read and dormant baseline family

`discoveryServer.ts:242–269` iterates all nine configured sources. `exactCount:131–135` executes a head SELECT/count; it does not fetch player projection values. Metadata retains table name, display name and row count. Refresh handler `refresh-draft-ranker-discovery.ts:77` always builds this snapshot, including dry-run GETs; only explicit POST persistence at 84 writes. `discoveryServer.ts:638–651` passes health/consensus to `replace_draft_ranker_discovery_snapshot`. `discoveryReadServer.ts:105` serves health to `/api/v1/draft-ranker/discovery`, consumed by Draft Rankings discovery. No configured Vercel cron for this refresh was found. The consensus input is empty at 545, so it currently emits no projection consensus signals.

`baselinePolicy.ts:32` dynamically constructs `PROJECTIONS_{season}_${id.toUpperCase()}`. It supports current/future canonical seasons and a legacy schema map at 40–52. For 2025–26 only AG/Cullen skaters and Cullen/DTZ goalies have readable schema entries; legacy `DTZ_Skaters` exists in DDL but the helper deliberately marks that source unsupported. For 2026–27 it assembles AG/Cullen/DTZ/5v5 skaters and Cullen/DTZ/5v5 goalies. Blake/Nate are excluded from this candidate policy.

`baselineInputCapture.ts:45` performs those SELECTs. Skater capture calls it at 245; goalie capture at `goalieBaselineInputCapture.ts:72`. Global source search found function declarations, tests, and return-type references but no current product invocation of either capture function. Candidate-rate builders can blend supplied projections; native wrappers enforce `projections: []`. Native cadence/materialization also reject projection-bearing payloads (`nativeInputMaterialization.ts:158`). No direct provider table SELECT is caused by importing the candidate policy or using a pure schema hash.

Manual `audit-draft-projection-inclusion.ts:29` reads provider config tables. `/db/upsert-projections` builds an arbitrary tableName payload at 573; admin-only `upsert-csv.ts:298` validates names at 346, creates a table via `execute_sql` at 418/432 and inserts at 550. Exact target use depends on operator input, so classify as uncertain dynamic maintenance writer. No invocation occurred here.

## 8. Method and limits

Read root/global agent instructions, relevant local skill guidance and both coordination mailboxes/lease files before analysis. Claude owns the working source; this audit claimed no lease and wrote only under its separate workspace. Context diary was kept here because the user forbade repository writes.

Case-insensitive searches covered exact season prefixes, broad `projections_`, provider/config/season interpolation and import/call names. TypeScript AST scanning covered 4,155 code files and 2,969 query-call candidates, preserving 16,569 import edges. The scanner follows static imports, re-exports, require and literal dynamic imports. Non-explicit type imports can overstate module reachability. The 200 generic dynamic query candidates are retained separately; the relevant provider sites and all five current FORGE dynamic sites were resolved. Arbitrary request-selected relations, runtime-generated imports, runtime configuration and external SQL cannot be exhaustively proved absent from static source.

No live DB/env/deployment inspection was performed. Existing mailboxes mention deployment and smoke evidence; those statements were treated as coordination history, not independently verified current production facts. No broad test suite or build ran. Offline tests used actual source with mocked database interfaces and blocked real network/client loading; one initial harness run lacked TextEncoder, the harness was corrected, and the final 11 checks passed.
