# Local Rankings interaction timings, 18 November 2026

With a complete marked publication and 750 matching season composites, cold median time to six usable comparison opportunity rows fell from 1,368.4 to 1,071.5 ms (21.7%). Cold median time from selecting Trending to 25 usable rows fell from 865.3 to 582.6 ms (32.7%). Each warm-client tab return made zero requests.

The explicit Trending tab enables its SWR request on selection and passes its response to the Trending table. The default skater Rankings comparison uses a second SWR caller with the same URL. It passes `comparisonTrendingData.rows` as `opportunityRows`, matches the comparison subject by player ID and displays that player’s first opportunity signal. The change is confined to loading rolling support rows behind the endpoint. [Tab request](../../../../web/pages/rankings.tsx#L1333) · [Comparison request](../../../../web/pages/rankings.tsx#L1512) · [Opportunity match](../../../../web/components/Rankings/ComparisonSummaryPanel.tsx#L106) · [Query change](../../../../web/lib/rankings/rankingQueries.ts#L373)

## What was timed

| Interaction | Cache at interaction | App requests before / after | Median usable rows before / after, ms | Observed range before / after, ms | Median Trending handler before / after, ms |
|---|---|---:|---:|---|---:|
| Default Rankings mount and open Snapshot drawer | Cold client and server | 5 / 5 | 1,368.4 / 1,071.5 | 1,354.6–1,396.3 / 1,063.3–1,109.5 | 913.8 / 617.9 |
| Default Rankings mount and open Snapshot drawer | Fresh client, warm server | 5 / 5 | 123.3 / 122.9 | 115.2–124.7 / 116.0–128.3 | 96.0 / 96.6 |
| Return to Rankings from Trending | Warm SWR | 0 / 0 | 26.5 / 28.1 | 26.3–28.1 / 25.5–46.3 | Served by SWR |
| Select Trending from WAR | Cold client key and server | 1 / 1 | 865.3 / 582.6 | 859.9–867.2 / 574.4–595.3 | 854.0 / 567.5 |
| Select Trending from WAR | Fresh client key, warm server | 1 / 1 | 81.0 / 81.8 | 79.8–98.0 / 79.2–82.6 | 69.0 / 69.0 |
| Select Trending from settled Rankings | Warm SWR | 0 / 0 | 14.5 / 14.7 | 14.1–15.8 / 13.4–23.3 | Served by SWR |

Default Rankings fetched metadata, season, matrix, trending and comparison once each. On cold page entry the median matrix handler took 918.6 / 621.2 ms and the comparison handler 397.2 / 397.3 ms. Those companion handlers performed the same database work in each version. The local handlers share one Node event loop, so the default timing includes CPU contention. Deployment function isolation and network behavior can change which request finishes last. The isolated Trending click avoids companion-handler overlap.

## Query work on the Trending endpoint

| Measurement | Before | After |
|---|---:|---:|
| Cold database reads | 80 | 72 |
| Cold rows returned across tables | 25,232 | 15,292 |
| Cold JSON bytes from the database double | 66,115,665 | 48,565,006 |
| Window-support reads | 30 | 22 |
| Window-support rows | 10,690 | 750 |
| Window-support JSON bytes | 18,874,929 | 1,324,270 |
| Warm database reads / rows / bytes | 20 / 3,852 / 274,236 | 20 / 3,852 / 274,236 |

The candidate reads window support for each skater's chosen rolling row. This cut support bytes by 93.0%. Wide rolling-row reads remained 46,966,612 JSON bytes in both versions, including latest-date probes. Byte counts refer to uncompressed projected JSON from the double. They exclude HTTP overhead and compression.

## Database plan on the same fixture

A separate PostgreSQL 17.11 run loaded the fixture’s 10,690 support rows and their window payloads into a temporary table in an isolated local cluster. Its column types, player/date/strength primary key, snapshot B-tree and JSONB GIN index match the support table in the repository schema. After `ANALYZE`, `EXPLAIN (ANALYZE, BUFFERS)` exercised every date query before and after. It selected player, date, game and the JSONB window support with the actual season, strength and date predicates, player ordering and 1,000-row limit. The candidate also supplied each date’s selected player IDs. The cluster was shut down after inspection. [Schema and indexes](../../../../supabase/migrations/20260716112908_production_schema_baseline.sql#L24923)

| Support queries | Baseline | Candidate |
|---|---:|---:|
| Snapshot-index scan with player sort | 30 | 12 |
| Primary-key index scan in player order | 0 | 10 |
| Rows across all queries | 10,690 | 750 |
| Nov 17, latest date | 330, snapshot index | 330, snapshot index |
| Nov 1, older appearances | 363, snapshot index | 4, primary key |

On Nov 1 the four retained IDs were 8470672, 8470692, 8470712 and 8470732. The second plan used the same table pages immediately after the first plan on each date, so its timing is unsuitable for an independent cold-database comparison. This experiment establishes the query shapes, result cardinalities and local planner choices. Production statistics, buffer state, row sizes and the network still need a representative measurement. [Per-query plan results](support-plans.json)

## Fixture, clocks and cache policy

- The page, React Query, SWR, request URL builders, comparison drawer, Trending table and the local Next API handlers for Rankings are real. In-process fetch dispatch supplies an in-memory season response and routes generated URLs to their handlers. A deterministic Supabase client double supplies projected synthetic rows. Each database read incurs 6 ms plus response bytes at 40 MiB/s per read. Node encodes and decodes database JSON. No external request is needed.
- All skater filters use page defaults. Season resolves to 20262027, with the clock pinned at 23:00 UTC on 2026-11-17. The common Trending URL has 5v5 strength, all positions/deployments, minimum 10 GP and 300 seconds, descending order, and limit 25. The fixture has 750 skaters, 32 teams, 30 dates and 10,690 5v5 rows. Ninety skaters last appeared four to 23 candidate dates back.
- At the pinned cutoff the fixture has four complete durable Rankings markers (season, last 5, last 10, last 20) and a later complete season composites marker for the same 750 skaters. Marker keys use `all`; each composite row uses `all_skaters`. The cold matrix made two marker queries (five recent rows and one oldest row), one composite-date query, and two composite-ID queries returning all 750 players. The query double applied the requested projection, filters, ordering and row limits.
- Five timed repetitions per scenario per version followed one discarded repetition. Versions ran sequentially under Node 22.23.4. Cold cases reset the rolling, matrix and publication-reader caches and create new client caches. Fresh-client cases use the same server immediately after the cold action. Warm-tab returns keep both client caches and fall inside the page's 30-second SWR deduplication interval. JIT and fixture generation are warm during the recorded runs.
- The clock for comparison starts before mounting the default page and immediately opening the compact desktop drawer. Success requires the open state, six comparison subjects, and concrete labeled opportunity evidence. All six have a nonempty matching signal and the complete output is checked. The Trending clock starts on clicking the tab and ends once the table has 25 named rows. The WAR starting view keeps cold navigation free of a prior Trending prefetch. WAR setup requests finish before timing. Times measure committed DOM content in JSDOM, excluding browser layout, paint, and real transport.
- The baseline config reads the Rankings code from Git commit `57a90dfa7892ad8003fa6957c945457f4e0ce173`. The candidate changes only the two source-loading exceptions for this benchmark. Measured Git blob IDs are `cf1b573177d8aa21b9418ce49abe0327105c05df` for `rankingQueries.ts` and `79cb162d3450b75c98c30e0a0783fbc08fa6d9b3` for `rollingWindowCountSupportReader.ts`. The 19.86 s deployed measurement on 15 November was a separate single sample.

## Exact parity

The default matrix served `entity_metric_rankings` dated 2026-11-17 with 750 ranked rows in every run. The harness checked the matching date, v3 methodology and expected per-player MCM score for all ten displayed matrix rows and all six comparison subjects. The candidate matched every ordered API row, every displayed Trending cell and signal title, and the ordered comparison IDs and evidence strings. The first six IDs were 8470000–8470005, with TOI/G increases of 93, 120, 147, 174, 201 and 228 seconds. Two of the 25 Trending results, 8470672 and 8470706, belong to the less-active cohort. Both versions produced SHA-256 `245acd199f8edc9d5f5027ddf5d4e3c4040e64d811a6c213d6997391e1224d98` over the ordered DOM and API values. The harness compares complete rows directly.

[Ordered rows, values and displayed text](before-rows.json) · [Baseline samples and endpoint details](before-samples.json) · [Candidate samples and endpoint details](after-samples.json)

## Reproduce

From the repository's web directory, run the two commands in order. Each writes its receipt in this folder.

```sh
TRENDING_VERSION=before ./node_modules/.bin/vitest run --config ../tasks/artifacts/rankings-current-season-2026-11-18/trending/vitest.config.mjs
TRENDING_VERSION=after ./node_modules/.bin/vitest run --config ../tasks/artifacts/rankings-current-season-2026-11-18/trending/vitest.config.mjs
```

## Completion and owner

Local acceptance passed independently of the publication-cadence decision. The two-file query change and its regression test are pinned at the independent local release `50dea27b84a34b05a1aa6e67dc24d2774e5d3f24`. TJ owns the deployment decision. The outstanding production measurement is a matched cold and warm interaction on each surface at one published cutoff, with browser-visible timings, request counts and a representative database plan. The November timing sample supplies no production before/after comparison.

Focused ranking-query, Trending and API checks passed (37 tests). Targeted ESLint, the full web typecheck and the final scoped diff check passed.

The standalone release candidate and its exact parent also passed the six interaction cases in Chromium. The cold comparison and Trending medians fell 20.5% and 33.1% respectively, with exact output parity. A separate untimed browser replay verified the selected skater with a signal, the returned skater with no material signal, and the skater outside the top 25 on both commits. [Chromium release-candidate receipt](browser-receipt.md)
