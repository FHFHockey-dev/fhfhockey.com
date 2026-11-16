# Prepared catalog read: approval pending, no execution

Exact SQL SHA-256: `d705830f0b1d826eb256adb16b1a7b7265b91ab4055b2b85aae15d47eacf1900`.

Chef review package: `catalog-read-batch-1.sql` and `catalog-read-batch-1-source-manifest.json`. The SQL is **not a whole-file execution script**: execute one numbered block at a time, sequentially. No remote command or connection was made preparing it. No direct TJ approval has been received by this worker. Chef must identify the actual production project/database through the approved connection without printing credentials, review the exact file digest, then request direct approval before executing. An approval of source audit or this preparation is not production-read authority.

Suggested direct request after Chef verifies the project target:

> Approve the first production catalog check for the named FHFH Supabase production project: six sequential read-only queries in the linked exact SQL file, limited to the 24 relations and four function signatures affected by authority125–134? The first reads only aggregate load counts/duration and stops above five other active backends, any active query above10seconds, or insufficient visibility. The remaining queries read definitions and schema/security metadata only; no application records or RPC execution. Each SELECT has a5second timeout and1second lock timeout; no retries. Remaining migration groups require later batches.

The request intentionally contains no invented project identifier. Root owns confirming the already-known target before presenting it; worker did not discover credentials or query any remote service.

## Exact bounds and stopping rules

|Block|Scope|Expected/hard maximum returned rows|
|---|---|---:|
|Q1|`pg_stat_activity` aggregate; excludes current backend; no query text|1|
|Q2|22views+2tables, allowlisted names; view deparse, ACL, RLS/owner/options|24 /25sentinel|
|Q3|4exact function signatures; body, deparse, configs, security, ACL|4 /5sentinel|
|Q4|columns/types/default expressions/columnACL for those24relations|≤2000 /2001sentinel|
|Q5|constraints/indexes/triggers/policies for those24relations|≤512 /513sentinel|
|Q6|effective privileges for anon/authenticated/service_role on28objects|84 /85sentinel|

Six top-level read SELECTs total, with30transaction/session-control statements (BEGIN READ ONLY, three SET LOCALs, COMMIT per block):36SQL statements if all blocks execute. Hard returned-row cap2630 including sentinels; a sentinel is a truncation alarm, not permission to page further. Stop on any error, timeout, missing object/role, unexpected relation kind, or returned sentinel. Do not retry or broaden. Roll back an aborted transaction to release it, then stop. Each block runs in its own short transaction;15second idle-in-transaction timeout. No application-row count, payload, invocation of an application function, materialized-view refresh, EXPLAIN/ANALYZE, index creation or migration operation appears in the SQL.

Q1 stop if `active_others > 5`, `max_active_seconds > 10`, or `visibility_unknown > 0`. Counts include other active backends across the visible cluster, a conservative boundary; normal inactive background processes with nullstate are not mistaken for hidden client sessions. Hidden/null client/parallel states or active rows lacking a start time require stop. The check is a one-time snapshot, not a guarantee against later load. Execute the remaining blocks promptly and sequentially; a lengthy pause or need to rerun requires Chef to reconsider the approved bound, not silently add polling.

Cost is unknown but expected small: indexed catalog lookups for24relations/4functions, privilege evaluation for84object-role pairs, and one backend-status aggregate. No table/page/JSONapplication payload scans.5seconds per SELECT bounds database work to at most30seconds across sixqueries, excluding connection/transport/setup latency; response bytes are not hard-capped because complete definitions are necessary, and the28exactobjects bound scope. A timeout ends the batch rather than raising the limit. These are estimates and limits, not measured hosted cost or latency.

## Inventory and source comparison

The JSON manifest records the object inventory derived from **all29authority migrations**, keeping their source paths/authority rows. First batch scope is exactly the24relations and4function signatures derived from125–134. Later135–149 and older88/101/123/124 objects are inventory only and are not queried here.

Terminal source replacements matter: both WGO per-game views introduced in133 compare against143, and persist_complete_game_stats_v1 introduced in134 compares against147. Do not report these later accepted definitions as production drift from133/134. The manifest has26terminal definition entries (22views+4functions), with source migrationSHA256, extracted statementSHA256, exact source statement, and for each function raw bodyMD5/SHA256 plus newline-normalized/trimmed bodySHA256. The two altered tables use their migration source and current full column/constraint/index/trigger/ACL metadata, not a fabricated whole-table expected hash.

Comparison procedure after approved reads:

1. Retain exact result/error/elapsed-time evidence for each block and the SQL fileSHA256. Require Q2/Q3 expected names/kinds/signatures andQ6roles before comparison; omissions failclosed.
2. Match functionQ3 `prosrc` to the dollar-quoted source body. Exact rawbodyMD5/SHA256 equality is strong body identity evidence. If only newlines/outer whitespace differ, compare the explicit normalized digest as a secondary signal; retain raw differences. Function body match does **not** prove signature/default/result/language/security/search_path/volatility/strictness/parallel/ACL equivalence; compare those separately fromQ3andQ6.
3. `pg_get_viewdef`/`pg_get_functiondef` are server deparses. **Never compare their hash with a migration-file hash and call it equality or drift.** Views may change formatting, qualification, casts, parentheses, aliases and keyword case. Source has no locally verified server-normal-form hash because PG startup is blocked. Retain servertext, compare the source statement semantically (projection order/type, joins, predicates, scopes, NULL/denominator behavior) with Q4shape; flag uncertainty instead of aggressive text-normalization. Removing comments or whitespace inside strings is not safe canonicalization.
4. Compare132addedcolumns and134nullablecolumns, with147terminalRPC behavior, toQ4; Q5 captures validation/readiness/triggers and policyexpressions; Q2/Q3rawACL capturesPUBLIC/default semantics andQ6effective privileges includes role inheritance. Q6roleOIDs map namedroles to policyroleOIDs; policyrole0 meansPUBLIC. Cataloggrant evidence still does not substitute for a role-executed runtime test or application-data RLS test, neither approved here.
5. Any unaccounted difference is review evidence. Do not applySQL, executeRPCs or rebuild data to resolve it. Remaining19authorityrows require later coherent catalog batches, separately proposed/approved.

## Local verification

Generated from the already-read source inventory using a standard-library-only local script; no database module imported. Reviewed the fullSQL file after generation. Static checks passed: six bounded blocks,24relations/4functions, all29authorityrows inventoried, terminal143/147 selected, source/query digests matched, noapplication FROM/JOIN, clean whitespace. Actual SQL parse/execution is **not run** because no local/remote DB access is allowed. Query compatibility and privileges remain to be established in the separately approved run; any error stops rather than prompting a silent retry.
