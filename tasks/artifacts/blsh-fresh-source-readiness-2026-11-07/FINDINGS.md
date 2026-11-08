# BLSH fresh source readiness, November 7

## Result

**The stored current-season data has advanced; native provenance qualification has not.** This is not evidence of an ingestion outage. A new numerical capture alone cannot close the source gate, and the November 1 capture cannot be made current by relabeling its time.

Four bounded read-only Supabase calls on `fyhftlxokyjtpndbkfse` established the facts below at **2026-11-07 22:15 UTC**. No provider, ETL, cron, refresh, repair, migration, score, deployment, or holdout operation was performed. Only this new report directory was written. Existing source/capture files and the acceptance policy were not modified.

## Live stored rows versus accepted evidence

In the explicitly bounded November 1–7 query, latest stored event dates for all three sources reach **November 6**. Each date has identical WGO GP1 and NST individual/on-ice row counts:

| Date | WGO GP1 | NST individual | NST on-ice |
| --- | ---: | ---: | ---: |
| November 1 | 180 | 180 | 180 |
| November 2 | 144 | 144 | 144 |
| November 3 | 396 | 396 | 396 |
| November 4 | 144 | 144 | 144 |
| November 5 | 396 | 396 | 396 |
| November 6 | 108 | 108 | 108 |
| Total | 1,368 | 1,368 | 1,368 |

All 1,368 WGO player/date identities match both NST tables for season 20262027. All have GP1, positive WGO TOI and equal stored TOI across the three feeds. Individual goals and shots agree with WGO. None of the matched ixG/xGF/xGA cells is null. These are **stored structural/numeric checks**, not independently verified native identity, cell representation, upstream completeness, or scoring readiness. They are not a newly frozen BLSH input request, and do not replace the original 3,461-record/740-profile inventory.

Latest existing `update-nst-gamelog` audit within November 7: success at **10:05:41.085198 UTC**, 20 queued/processed/network attempts, 1,880 affected rows, 20 `rows_persisted` outcomes, no unresolved outcomes. Its state is explicitly `attempts_finished_coverage_unverified`, with `coverage: not_verified`. This operational audit does not bind the 1,368 selected rows to retained native bodies or establish when each exact row was first published. See `QUERY-3.json` and `QUERY-4.json`.

Exact historical discrepancy IDs remain unchanged in this live read:

- Crotty, WGO 5594296, player 8480075, game 2026020109, October 15: WGO 700 seconds; NST individual 806838 and on-ice 755036 both 702.
- Deslauriers, WGO 5599858, player 8475235, game 2026020206, October 29: WGO and NST individual 809478/on-ice 757676 all 445 seconds. The prior retained official 444-second evidence was not fetched again and remains a separate hold. Stored agreement is not a reason to clear it.

## Exact provenance break

1. Live schema for `wgo_skater_stats`, `nst_gamelog_as_counts`, and `nst_gamelog_as_counts_oi` contains no retrieval/update timestamp, native parser-input body/hash, HTTP/TLS receipt, producer/redactor version, or per-row native evidence reference. `date_scraped` is a date field, not a retrieval timestamp. Metadata and indexes are retained in `QUERY-2.json`.
2. The existing direct writer calls `nstGet` → `fetchNstTextByUrl`; it receives redacted parser-input text and HTTP status but does not durably retain that body or bind rows to its hash. The alternative cache is only process memory and is not the direct parser path. Code: `web/pages/api/v1/db/update-nst-gamelog.ts:276–286`; `web/lib/nst/client.ts:354–383`.
3. The parser preserves blank as null but converts dash placeholders to stored zero and parses TOI as MM:SS or rounded decimal minutes. Without native text, numeric agreement cannot distinguish literal zero from a placeholder or settle the Crotty/Deslauriers representation. Code: `update-nst-gamelog.ts:1400–1432`.
4. The existing provenance registry has only ESPN odds source groups in the bounded November 1–7 snapshot-date window, no NST source group. Recent NST audit metadata contains operational progress, not native body/transport bindings. This is absence in the inspected tables/window, **not** proof that no retained native artifact exists elsewhere.
5. `web/lib/buyLowSellHigh/currentProcessEvidence.server.ts:17` still has an empty acceptance array. The accepted review must bind exact request, bundle, native body/receipt, producer/redactor, definition and official-frame bytes, and exact WGO/NST row identities and hashes. The loader does not itself establish native HTML/model semantics. No real row was newly qualified by this investigation.

The source-client, gamelog-writer, and progress-module hashes still equal the previously reviewed November 1 lineage inventory, so no new body-retention implementation was found in these exact paths. Current hashes are in `SOURCE-PINS.json`.

Integration caveat: a non-test search under `web` found the gate definition but no production caller or separately populated acceptance policy. The installed default-closed boundary is not proof that application scoring or activation is wired. This report neither installs that integration nor grants source acceptance.

## Five separate readiness questions

- **Latest stored data:** current through November 6 in the queried November 1–7 interval; 1,368 matching appearances.
- **Native body/provenance coverage:** no newly found qualifying receipt in inspected live tables or named existing code/artifacts. The existing owner request remains the route to retained artifacts or explicit non-retention; owner/mailbox status was supplied by the parent and was not polled again here.
- **Source freshness:** the original four November 1 19:57:38 UTC feed captures are stale under the 24-hour capture policy. The current gate uses the oldest native/official/feed observation, not a later packaging time, and also checks seven-day event age. This investigation's SQL observation time cannot refresh those captures or prove current native-source retrieval.
- **Semantic qualification:** exact date/all-strength/count scope, native cell meanings, TOI conversion, identity/exposure, and xG/source/model definition review remain required. One sample proves only its own compatibility/coverage. For a current decision the gate allows original publication time to remain unknown; authenticated observation time is required. Do not invent first-publication evidence or backdate availability.
- **Empirical validation:** source checks do not choose an operational baseline or establish useful buy/sell predictions. Existing development evidence and the separate baseline/validation plan remain separate. Reserved 2025–26 holdout data was not read.

## Smallest safe resolution

1. Resolve the existing exact native-evidence request with the known source owner: a retained current-cohort body/receipt and its exact pins, or a precise statement of non-retention and the location that would own future capture. The request already identifies Deslauriers and asks for any useful current-cohort sample. No duplicate provider collection or broad audit is needed to ask this question. Existing request: `tasks/artifacts/cross-platform/2026-10-24-coordination/CODEX-TO-CLAUDE.md:3181`; owner `01a19780-b73c-7334-9e53-4b7fda61201c`.
2. If retained evidence exists, review one real date/group's format and literal cells offline first, then calculate its exact row coverage. Keep retrieval times and unknown model/revision facts intact. Old retained evidence may resolve parsing/provenance questions without being fresh enough for today's score.
3. If non-retention is confirmed, the smallest missing engineering piece is an explicit durable **redacted parser-input receipt boundary** at the existing source producer, not a full reload or lower gate. It must retain exact parser-input bytes/hash/length, safe URL and status/TLS/retrieval time, versioned producer/redactor and conversion semantics, and output-row bindings. Prepare and review it offline; do not assume a cache, job success or table timestamp is equivalent. The already reviewed proposed `nst_lineage.py` intake is reusable preparation, not native evidence or adoption authority.
4. Any necessary new collection is a distinct bounded operation outside this read-only task. Freeze the exact current date/group cohort first; a single recent completed date's individual and on-ice pages is a small compatibility pilot, not full-window qualification. Coordinate all callers and all four shared provider rolling limits, include attempts/retries/bytes/runtime/stop bounds, and avoid the obsolete 66-scope inventory as a fetch queue. Confirm the exact collection execution under the repository's production/provider policy before starting it. No such execution was attempted or denied here.
5. After qualifying native receipts and fresh official frames are available, freeze fresh exact feed bytes with truthful observation times, preserve discrepancies/unknowns, independently review the exact composition, and register only that reviewed acceptance. Do not refresh a timestamp on an old request or reuse a prior acceptance after row/request drift. Then run the separately frozen baseline/validation plan and review application activation. No new threshold judgment is needed merely to resolve the provenance request.

## Reproducible bounds and checks

- Four Supabase `execute_sql` calls, all SELECT-only. `QUERY-1.json` records a bounded schema/table-name discovery; that tool returned only the last statement. `QUERY-2.json` is the resulting single-statement metadata query for six exact tables, capped at 450 columns/100 indexes.
- `QUERY-3.json`: season 20262027, November 1–7 row-count groups; two exact WGO IDs and four exact NST IDs; at most 12 relevant audit rows in November 6–7; at most 50 provenance source groups for November 1–7. No full body/payload read.
- `QUERY-4.json`: joins only the 1,368 WGO GP1 appearances in that same seven-day interval to indexed NST player/date/season keys; aggregate outcomes plus at most 20 discrepant exposure rows (none); one latest matching November 7 audit. Date/season bounds, not output LIMIT alone, constrain source data reads.
- Relevant lookup indexes were confirmed. No unrestricted table dump, cross-season result scan, credential read, application endpoint, or provider call. No tests were run because this was evidence-only investigation, not a code change. Existing historical review results were reused rather than rerun.
- Only `tasks/artifacts/blsh-fresh-source-readiness-2026-11-07/` was added. No shared file edits or source-data changes. No user decision is required to read this result; fresh collection, deployment, source-model adoption and activation were not performed.
