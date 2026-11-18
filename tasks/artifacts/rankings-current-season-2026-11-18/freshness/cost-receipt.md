# Daily publication cost qualification

An 800-skater local dispatch used **624 of 1,000 database requests** including its terminal ledger write. The dispatcher recorded 623 requests immediately before that final write. **376 requests remained.** Each of the four windows stored 13,600 rows for 17 metrics. The cohort also produced 800 season composites and five complete markers at the pinned November 17 cutoff. The readback checked the complete player ID set separately in each of the 68 metric/window combinations.

| Database operation | Requests | Rows sent or returned |
| --- | ---: | --- |
| Claim, readiness twice, two progress records, cutoff readback, terminal record | 7 | Two readiness receipts with 800 source identities each |
| WGO appearances | 17 | 16,000 returned across 16 full pages and one empty final page |
| Latest rolling metrics and window support | 32 | 800 rolling and 800 support rows, in groups of 50 |
| Player and team metadata | 3 | 800 players and 32 teams |
| Rankings row writes | 544 | 54,400 sent in 100-row batches |
| Rankings physical counts and exact ID reads | 8 | Four count-only responses and 3,200 IDs |
| Marker upserts and reads | 11 | Ten marker rows sent over seven upserts, four read back |
| Composite upsert and physical count | 2 | 800 sent in one atomic write, one count-only response |

Uncompressed request bodies totaled **81,123,910 bytes**, including 70,001,748 bytes across the Rankings upserts and **11,112,153 bytes in the single composite upsert**. Response bodies totaled **6,866,250 bytes**. A deployment custodian can use the composite request size to qualify the production database gateway. Header, URL, TLS and compression costs were outside the measurement. [Full operation counts and body bytes](cost-sample.json)

## Method and limits

The actual daily dispatcher, two real pair builders and writers, budgeted Supabase client, and PostgREST serializer ran on Node 22.23.4. The input represented 32 teams, 20 appearances per player and five different latest game dates. Every request went through the candidate's transport budget and an in-process fetch implementation restricted to a synthetic hostname. That implementation served the readiness and ledger RPC contracts, filtered and projected table reads, applied the 1,000-row response cap, and upserted by each emitted conflict key using a hash index. The cutoff RPC consulted materialized fixture rows. Its independent checks required the correct distinct keys, ID sets, cutoff, row counts, non-null MCM values and marker states.

The local dispatch took **1,041 ms**, including 574 ms in the building stage and 451 ms in publishing and readback. Node’s measured peak RSS was **424 MiB** for the combined application, fixture, JSON transport and materialized store. This single sample qualifies the request and row envelope. Hosted latency, SQL readiness cost, Postgres I/O/WAL, network transfer billing, function memory, billed CPU and production execution within the deadline remain unmeasured. [Runner](cost-run.mjs) · [Fixture and assertions](cost-fixture.ts)

The exact freshness candidate was `aed6b4b0837010bc47164dc1b5b3dec7e4de5e40`. Its 42-file runtime digest was `c3cbea296910991d335f30c787e64b73960e00d44c3c28c5aa9032c76c450087`. The runner compared the included application files to their Git blobs. Reproduce from the repository root with `node tasks/artifacts/rankings-current-season-2026-11-18/freshness/cost-run.mjs <release-export-directory> aed6b4b0837010bc47164dc1b5b3dec7e4de5e40`, using a Git archive of that commit and the existing web dependencies. Without arguments the runner measures the current working copy.
