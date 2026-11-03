# Independent BLSH source-vintage review — 2026-11-01

**No correctness finding identified in the reviewed classification, joins, timing or claim boundaries.** All 103 selected field pairs reproduce the stated observation pattern. This verifies the finite comparison; it does not establish an ingestion defect, authorize repairs or requalify the original cutoff.

Reviewed the actual comparison/analyzer code, tests, frozen cohort/request contract, both WGO captures, prior discrepancy output, old/new raw box bodies, native summary/realtime bodies, receipts/dispatch records, retained mapper source and resulting JSON/CSV. All contract input, analysis, final-file and shared-source pins match actual bytes.

## Cohort and values

The classification contains exactly the original **103 unique `(source_id, field)` pairs / 99 rows / 25 games**, with no replacement or broadening. Field totals independently reconcile: **53 TOI, 2 goals, 4 assists, 23 shots, 15 hits, 6 blocks**. Row dates October 20–26 have counts **19, 14, 24, 3, 35, 2, 2**. All row aggregations, JSON and CSV agree.

For every selected field, independent extraction from raw sources confirms:

```
saved October 27 box = November 1 box = November 1 native report
                    ≠ October 28 WGO = October 29 WGO
```

All 103 output states are therefore `current_products_agree_box_unchanged_saved_WGO_differs`. None shows a box value change between these two box observations; none has a current native-report value matching saved WGO. All 99 rows retain unresolved differences. Six applicable **field pairs** from the earlier sealed repair manifest also match saved WGO; that manifest is not a general ingestion archive.

Confirmed the supplied Sasson/Bains goal/assist/shot examples, Brink's 825 versus 824 TOI and Roslovic's observed hit 1 versus 0 through the same exhaustive raw-value checks. No missing values were substituted with zeros.

## Identity and source binding

Every comparison preserves the WGO source ID, canonical player ID, game ID, season, date and team across the two WGO snapshots. The new requests have exact official endpoint paths and per-game query scope: nonaggregate/game-level reports, regular season, GP≥1, bounded complete results. No name-based join was used.

For all 25 old/new box pairs, checked exact game/date/season/type, finality, complete forward/defense lists, unique canonical skater IDs, matched official team and positive official TOI. Native reports contain complete bounded result lists with unique player IDs. Each selected player matches game/date/team/GP1 and, when supplied, opponent and home/road. Total `timeOnIcePerGame` is compared directly in seconds with GP exactly one; native values equal the parsed box TOI. Counts are finite nonnegative integers.

The analysis intentionally does not require WGO TOI equality to establish a player identity join, because those 53 differences are part of the question. It retains original exposure states/reasons and does not promote a discrepant row. Current mapper source indeed maps summary G/A/SOG/TOI directly and realtime HIT/BLK through the player/game key. Those pinned source copies do not establish the mapper, request payload or deployment that originally wrote these rows.

## Chronology and transport evidence

The saved WGO observations are timestamped **October 28, 03:49:19.148 UTC** and **October 29, 18:41:12.798646 UTC**. All new observations occur **November 1, 17:25:25.496407–17:28:16.830877 UTC**, strictly after the frozen cutoff. The analyzer and outputs correctly leave original-cutoff truth, ingestion fault, repair proposal and source publication time unresolved/false.

Independently authenticated **58 retained new bodies / 1,024,786 bytes**: 25 boxscore, 21 summary, 12 realtime. Matched each body hash/length, receipt hash, URL, item, successful HTTP/TLS flag, CA hash and dispatch/response ordering to the frozen plan. Rechecked the 25 old bodies and receipts against their prior pins. All new calls were sequential in the retained timestamps; the smallest dispatch spacing is **3.00081 seconds**. Byte and request counts remain within recorded bounds.

The initial run records exactly **one TLS issuer-verification failure, zero verified responses/body bytes, no saved body and a released lock**. The corrected run records 58 successes, no automatic retry/redirect and a released lock: **59 cumulative retained dispatch attempts**. The corrected collector explicitly enables hostname validation and CERT_REQUIRED using the pinned existing CA file; no TLS bypass is present in the reviewed source. This review did not execute a collector, change trust settings or make a network request. The detailed prior diagnosis of missing default trust roots was not independently re-executed; its pinned record and collector correction were inspected.

## Tests and limits

**13/13 focused tests newly run and passed.** Covered missing/invalid versus observed zero, fractional counts, absent/duplicate players, source identity drift, game/date/team/GP changes, optional opponent/venue conflict, truncated or duplicate reports, nonfinal/foreign box identity, receipt/TLS/hash/byte/CA/order conflicts and mixed field outcomes. Synthetic reserved-season rejection tests do not read holdout data.

Evidence: `source-vintage-review/tests.log`, `RESULTS.json` and `verify.py`. The independent verifier extracts raw values and derives the observed equality pattern without calling `classify()` or the analyzer's report extractor. Shared heavy lock acquired atomically and released. No unrelated application tests/build/browser checks were run.

The checkpoint's causal restraint is appropriate:

- Equality at two box observation times does not prove no intervening revision occurred.
- Two NHL endpoint products corroborate the observed values; they are not independent evidence of the historical ingestion payload or its cause.
- Retrieval/capture times are not publication, ingestion or write timestamps.
- Persistent saved WGO differences do not establish current database contents or justify overwriting a later capture from a different source observation.
- The cohort is discrepancy-selected; the result cannot measure whole-snapshot accuracy or general ingestion reliability.

Preserve the original **3,407 = 2,728 matching + 99 differing + 580 unavailable** partition and field-level holds. This sidecar does not resolve PPP, GameScore, NST strength/model/publication, stale snapshot or predictive-validation limitations. Original native ingestion payload/revision history plus the actual mapper/deployment and write timestamp would be needed to investigate cause; further provider requests are unnecessary to reproduce this report.

Only review artifacts and the required diary were written. No source, scores, captures or prior qualification outputs changed; no production/provider/database request, repair, holdout access, Git ref/index mutation or deployment. No pending/denied action, uncertain outcome or blocker to this scoped review handoff.
