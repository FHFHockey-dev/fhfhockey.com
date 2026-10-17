# Hosted publication preflight receipt

Root reports the approved four queries ran once in 41.274 seconds, with no SQL retry or sentinel: 26/9/3/432 rows, 470 total. This independent follow-up used only the retained metadata results and local source; no new query, network call, credential read or write occurred.

The source-observation table has all expected publisher columns. `id` defaults to `gen_random_uuid()`, `created_at` to `now()`, and metadata to `{}`. Owner is postgres; RLS and FORCE RLS are true. Actual explicit service_role grants are SELECT and INSERT only, with bypass-RLS true; no anon/authenticated/PUBLIC grants or RLS policy rows were returned. The unique key is `(provider,dataset_key,entity_key,payload_hash)`, plus primary key id; entity_kind is not part of natural uniqueness. The existing planned-ID exact collision readback remains necessary.

There are three enabled noninternal triggers. Both BEFORE INSERT functions return NEW immediately for provider other than `forge-evidence`, before effectful branches. For this publisher's exact provider `fhfh`, no INSERT fanout was found. The third trigger rejects UPDATE/DELETE. All returned index definitions are valid/ready; special forge/forge-evidence partial indexes do not match fhfh. This establishes the reviewed insert behavior, not publication approval.

The schedule result contains exactly 432 unique sides for 216 games. All 380 owned-player target bindings exist once, with matching canonical club and retained roster revision. Prepared versus hosted normalized date/status/home/opponent agree; all hosted states are FUT/OK/countable.

Three material schedule issues remain:

- Every hosted fetched_at is older than the consumer's 36-hour freshness limit. At reconciliation 2026-10-16T05:38:29.472Z, ages span 53.426–1139.686 hours; newest fetch is October 14T00:12:54.911Z, oldest August 29T17:57:18.391Z.
- All 432 rows lack `scheduleCoverage`; the normal whole-day completeness witness is unavailable. The four projected metadata fields were adapted beneath source_metadata.scheduleCoverage only for the existing offline normalizer, without inventing a witness.
- Two game starts genuinely differ by one hour, affecting three owned bindings: game 2026020280 is prepared November 8T23:00Z versus hosted November 9T00:00Z; game 2026020341 is prepared November 18T00:00Z versus hosted 01:00Z.

All 380 raw scheduleRevision hashes differ, but 377 differences disappear when equivalent start instants are canonicalized to ISO before the existing hash recipe. SQL transport supplied strings such as `2026-10-17 23:00:00+00`; prepared rows use ISO `.000Z`. This is a representation-sensitive hash diagnostic, not 380 changed game times. SQL serialization is also not proof of the application's PostgREST serialization. No source timestamp or issued revision was rewritten. The three remaining mismatches correspond to the real two-game start changes above.

The current hosted schedule therefore does not establish fresh matching normal-consumer coverage for the prepared participation receipts. Resolve schedule freshness/witness/real-start differences and representation-stable revision binding explicitly before claiming genuine shared-consumer readback. No additional scan or mutation is authorized by this receipt.

Private detailed receipt: `publication-hosted-preflight-results-v1/preflight-receipt.json`, SHA256 `1ccc7678f387ba22e423ac81c9e6d2a20c1f9ebb14ec46bbf68478b1d79607ef`. Per-binding comparison: `schedule-reconciliation.json`, SHA256 `083e1167b45119f1d8ee9f6ab724c1ed7855ef44df8f17bf4895f6544220a92f`, under `/Users/tim/Documents/FHFH-private/forge-rso-completion-20261016-v1/`. Both retain original input hashes; no source payloads or scoring outcomes were inspected.
