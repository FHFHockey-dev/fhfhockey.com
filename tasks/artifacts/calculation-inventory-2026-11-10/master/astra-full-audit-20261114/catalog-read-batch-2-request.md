# Prepared catalog batch 2 — approval pending, not executed

Exact SQL SHA-256: **a52f2f7f8023aea676e507c739b6908b1b6f6eaa15a9b4e4b1fcc88f936079a8**.

Review [catalog-read-batch-2.sql](catalog-read-batch-2.sql) and [catalog-read-batch-2-source-manifest.json](catalog-read-batch-2-source-manifest.json). Source target is immutable **89da739cb45d7d572ed59bfa0b209c79c5d99299**. **Do not execute the file as a whole.** Chef must confirm the same exact production project/database used for batch 1, review this digest and obtain separate direct TJ approval. No production connection, connector action, application request, environment-value read or credential access occurred in preparation.

Suggested request, after Chef inserts the confirmed project identity:

> Approve catalog batch 2 against the same confirmed FHFH production database: seven sequential read-only queries from the linked SQL file, concurrency one, no retries? The first checks aggregate database load and stops above five other active backends, an active query over ten seconds, or insufficient visibility. The rest inspect only 21 remaining named relations, three exact indexes and their parent identities, six exact function signatures, and two schema grants. Each SELECT has a five-second statement timeout and one-second lock timeout. No application records, RPC calls, cron commands, environment values or writes are included.

Batch 1's approval does not authorize batch 2. No project identifier is invented here; Chef retains the verified identity.

## Query budget and stop rules

| Block | Exact scope | Expected / hard returned-row limit |
|---|---|---:|
| Q1 | pg_catalog.pg_stat_activity aggregate excluding own backend; no query text | 1 |
| Q2 | 24 exact identities: 21 remaining relations plus three index-only parent tables; kind, owner, ACL/RLS/options and five view definitions | 24 / 25 sentinel |
| Q3 | Six exact function signatures; body/deparse, language, arguments/results, config/security/ACL | 6 / 7 sentinel |
| Q4 | Columns/types/defaults/column ACL for the 21 remaining relations; excludes three index-only parents | ≤1,000 / 1,001 sentinel |
| Q5 | Constraints, indexes, triggers and RLS policies on those 21 relations, plus exactly three named older indexes | ≤512 / 513 sentinel |
| Q6 | Effective privileges for three known roles on 21 relations + six functions | 81 / 82 sentinel |
| Q7 | public and fhfh_internal schema owner/ACL and USAGE/CREATE for those three roles | 6 / 7 sentinel |

Seven top-level read SELECTs plus 35 transaction/session-control statements (BEGIN READ ONLY, three SET LOCALs, COMMIT per block): **42 SQL statements** total. Combined hard returned-row cap **1,636**, including sentinels. Catalog helpers such as pg_get_functiondef inspect metadata; they never invoke the application function being inspected.

Run Q1 alone. Stop if active_others >5, max_active_seconds >10, visibility_unknown >0, any error/timeout or invalid result. Hidden/null client/parallel states and active backends lacking start times count as unknown visibility; normal background processes with null state do not automatically count. This matches batch 1's conservative cluster-visible hygiene gate.

After a pass, run Q2–Q7 individually and sequentially. Stop on any error/timeout, missing expected relation/function/schema/role, unexpected kind, sentinel, missing required index/trigger/column/constraint, or index on the wrong parent/invalid/not ready. Preserve discrepancies; never repair them in this batch. A permissions difference is review evidence, not grant-change authority.

Each block is its own read-only transaction: **5 s statement timeout, 1 s lock timeout, 15 s idle-in-transaction timeout**. On transaction error, issue only ROLLBACK to release it, then stop. No retries, polling, paging, raised limits or broader names. Execute promptly after hygiene; a lengthy pause requires Chef to reconsider the bound rather than silently adding a load query.

Expected cost is catalog lookup/deparse work, not application-table scanning. Seven SELECT timeouts bound aggregate SELECT runtime to at most **35 seconds**, excluding connection, transport and session-control latency. Complete definition bytes are not hard-capped: six exact functions, including the long derived-v2 RPC, and five views bound that scope. Hosted latency/cost is unknown, not measured. Timeouts end the batch.

## Scope and terminal source authority

The manifest pins 19 remaining source migrations from required authorities 88/101/123–149, with immutable target/authority SHA-256, exact schema statements and line pointers. All 29 required authority IDs are recorded without repeating previously inspected objects remotely.

| Authority | Batch 2 treatment |
|---|---|
| 88 → 137 | forge_league_skater_physical_totals(integer,date), terminal 137; 88 lineage only |
| 101 | forge_reserve_projections full columns/checks/PK/FKs, two indexes, RLS/policy/grants |
| 123 | idx_wgo_skater_stats_team_date plus parent identity; definition/parent/validity/readiness/uniqueness |
| 124 | line_source_snapshots_observed_at_idx and lines_ccc_observed_at_idx, corresponding parent identities |
| 135 → 141 | goalie_totals_unified, terminal regular-season 141 |
| 136 | nst_seasonlong_5v5_counts, counts_oi and rates views, shapes/grants |
| 138 | Ledger forecast_basis column; served_forecast_universe columns/checks/PK/RLS/grants and set_updated_at trigger |
| 139 | expected_games nullability on both season aggregate/release-player tables |
| 140 | predictions_sko_vdp definition, shape and grants |
| 142 | Accountability revisions v2_skill/check; existing append-only/security metadata as context |
| 143 | Both terminal WGO views already captured in batch 1; **no repeat** |
| 144 | team_ctpi_daily versioned PK/checks/component nullability, freeze trigger and reject_ctpi_v1_write() |
| 145 | team_sos_daily full schema/security; sos_standings freeze trigger and reject_sos_v1_write() |
| 146 | games state/schedule-state/observation columns and coherence checks |
| 147 | Team PP clock and four goalie shot-ratio nullability changes. Terminal persist_complete_game_stats_v1 body already matched in batch 1; **not repeated** |
| 148 | Player/team strength PS columns/checks; exact v1/v2 derived RPC signatures/attributes/grants |
| 149 | PP-combination provenance pair; pp_team_game_clock full schema/security; replace_power_play_game_v1 |

Q2 expects five ordinary views and 19 ordinary tables, individually listed in JSON. Q4–Q6 exclude the three index-only parents to avoid their unrelated column/index/trigger/policy inventories and effective grants. Q5's three exact-index rows preserve missing-object sentinels and compare actual parent OIDs. The two reserve indexes are covered through the new table.

Three required user triggers are named in the manifest. Q5 records each trigger's resolved function schema/name. Authority 138 references existing public.update_updated_at_column(): its target identity is checked, but this helper body is not redefined by the required authority set and has no source-body certification here. Both freeze-function bodies are in Q3.

Q7 covers exactly two schemas × anon/authenticated/service_role. It reads no role passwords or arbitrary role inventory. Raw ACLs retain PUBLIC/default semantics; effective privileges include inheritance; role OIDs map policies (OID 0 means PUBLIC). Metadata does not substitute for a role-executed RLS/runtime test.

## Comparison procedure and limits

1. Retain the SQL digest, exact result/error and elapsed time per block. Check identities, expected kinds, completeness and sentinels first. Stop rather than report a truncated pass.
2. Compare six prosrc bodies directly with the manifest's dollar-quoted source bodies. Raw MD5/SHA-256 and explicit newline-normalized/trimmed SHA-256 remain separate. Also compare signature/default/result/language/security/search_path/volatility/strictness/parallel/ACL fields: matching a body alone is insufficient.
3. Server deparse hashes are **not migration-file hashes**. Five terminal view statements are pinned, but no independently verified server-normal-form digest exists. Preserve identifier/literal/operator/parenthesis/type/NULL/join/projection differences and semantic uncertainty. Batch 1's lossy token normalization did not establish strict view equivalence; this batch neither erases that limitation nor repeats those views.
4. Compare Q4/Q5 with pinned CREATE/ALTER statements. Existing metadata outside changed columns is context, not a whole-table source baseline. Ordinary versus CONCURRENTLY index creation is an execution-mode distinction; compare resulting definition/readiness.
5. Matching source can preserve an audited source defect, including the nullable-clock CHECK issue. No application-row prevalence or malformed-value probe is allowed. Metadata does not prove mathematical correctness, backfill completion or reader behavior.
6. No migration-history rows, refresh, EXPLAIN ANALYZE, data count, dynamic SQL, app-function invocation or DDL. Source/server metadata does not authenticate historical approval, migration order, deployed app SHA or natural-run success.

## Cron schedules — separate request if needed

Schedule/active state requires cron.job, **outside pg_catalog**. No cron query or command field appears in batch 2.

A later separately reviewed proposal could project only jobid/jobname/schedule/active for exact queue-named IDs **283, 305, 327, 364, 388, 392**, expected six / sentinel seven, same hygiene/timeouts/concurrency/no-retry rules. Exclude command, connection fields, execution history, vault/secret access and invocation. Retained pointers: PRODUCTION-QUEUE.md:162–164 (305), :27 (327), :283 (283), :361–370 (364), :457/:480–485 (388); FORGE-INPUTS-PLAN-2026-11-13.md:36–38 (392). Recheck identities/purposes from those records before presenting a separate request. This is candidate scope, not executable or approved SQL. F19 and Vercel schedules need their own exact identity/source review.

## Environment and code flags — evidence gaps only

No .env files, process environment values, secret stores, hosting configuration or remote environment APIs were read. The manifest pins only these source expressions at the immutable target:

| Flag | Source-local fact | Retained production attribution | Exact missing evidence |
|---|---|---|---|
| PP_STORED_CALCULATION_WRITES_ENABLED | update-power-play-combinations/[gameId].ts:37 requires exact "true" | Queue:432–448 writes-off release then writes-on redeploy; :449–455 refresh | Current production deployment identity plus redacted boolean-only config provenance for this one flag; listing a key alone proves no value |
| PP_SHARE_SERVING_ENABLED | web/lib/ppShare/serving.ts:17 requires exact "true" | Queue:466–479 serving-on redeploy/readers | Current deployment/config boolean provenance; old response is historical evidence |
| FORGE_RESERVE_PASS_ENABLED | web/lib/projections/reserveProjections.ts:26 requires exact "true" | Queue:229 says TJ set it before #433 | Current deployment/config boolean provenance; separately retained first-reserve/consumer evidence |
| LEDGER_BASIS_SCHEMA_ENABLED | web/lib/player-forecasts/servedForecastLedger.ts:23 code constant **true** | Initial queue:30/84 pending prose is stale | No environment lookup needed. Confirm deployed artifact contains audited code; actual writer/reader use remains separate |
| DEFAULT_FORECAST_CALENDAR_VERSION | web/lib/player-forecasts/contributions.ts:15 code constant **forecast-calendar-v2** | Initial queue:31/84 pending prose is stale | No environment lookup needed. Confirm deployment mapping and issued-version behavior; old issued artifacts keep their version |

For the three environment flags, minimum additional evidence is an already-approved retained deployment/config receipt containing only flag name, boolean state, environment, deployment identity and timestamp. Never request full environment dumps or access tokens. If unavailable, Chef must propose a separate narrow configuration read; catalog batch 2 cannot answer it. No new API/page request is proposed here.

## Local verification

Standard-library-only generator and exact local git-show reads; 19 target migration hashes match authority pins, 11 terminal definitions and five code-flag expressions pinned. Comment/string/dollar-quote-aware lexical checking confirms seven SELECT blocks / 42 statements, seven timeout sets, finite allowlists, no mutating commands and clean whitespace. Full generated SQL read after generation.

PostgreSQL parse/execution: **not run**. No PG bootstrap, connector, database driver or production command. Any approved-run syntax/privilege/compatibility error stops without retry. Prepared artifacts await Chef review; worker waits for further assignment.
