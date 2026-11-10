# Homepage and Transaction Trends load diagnosis

## Observed 2026-11-10 UTC

The fresh browser tab started at about:blank; no page form input, filter changes or clicks were used.

- Existing 18:15 trace: homepage server request 29.912s, including 16.703s page compile and 4.798s nested season API compile; navigation to hydration 39.053s.
- Existing Trends request: 15.730s, including 3.731s compile; a second identical request took 10.856s with effectively no compile.
- Fresh-tab attempt at 18:18:46: browser navigation tool timed out at 10s before commit; server request completed in 12.664s, including 9.644s nested season API compilation. Tab remained blank. This is not a completed paint measurement.
- Warm anonymous HTTP GET /: 200, time to first byte 3.271799s, total 3.272565s, 320815 bytes.
- Warm browser retry in same untouched tab: navigation wall 3.071s; server handling 2.675s, navigation-to-hydration trace 3.141s.
- Trends after warm browser load: 21.193s first request (1.788s compile), another identical request starting ~20s later took 11.426s. Latest reply available ~31.4s after hydration. Loading state then populated with both tables; exact DOM-paint timestamp was not exposed.

Evidence: existing-route-timings.json and warm-browser-timings.json, derived from web/.next/trace. Ensure-page is compile/route availability, not full network or CPU attribution. Local dev timings must not be presented as production measurements.

## Causes in source

1. `web/pages/index.tsx:getServerSideProps` blocks sending HTML on a long sequential chain. `checkIsOffseason` and `fetchStandings` call `fetchCurrentSeason`, which on the server fetches this app's `/api/v1/season`. A cold/invalidated API route adds another compilation inside the homepage request. `getCurrentSeason` is also called separately. Independent injuries, standings, news, player count, pulse and enrichment work are serialized.
2. Transaction Trends lives under `ClientOnly` and requests after hydration. `TransactionTrends.tsx` uses raw effect fetch with no in-flight deduplication or response reuse. Development StrictMode is enabled. Repeated identical requests are observed, although their precise trigger is not proven by trace alone.
3. `ownership-trends.ts` loads all players from `yahoo_players_with_normalized_history` in sequential 1000-row pages, then every Yahoo-to-NHL mapping in 500-ID chunks, before slicing the results to 10 risers and 10 fallers. The compatibility view aggregates each player's entire history with no date bound (`20260725235646_add_normalized_yahoo_ownership_reader.sql`). ADP follows a separate paginated 14-day history path. No DB execution plan was taken, so the exact split among query processing, network and serialization is unmeasured.
4. `s-maxage` cache headers alone do not supply a local application cache. Warm trend reads still take ~11s. Development bundles also are large (on disk index.js 9.4MB and _app.js 6.2MB, not transfer sizes).

## Proposed focused correction

- Resolve the season once through a direct server helper, preserving offseason semantics, and reuse it instead of nested HTTP.
- Parallelize independent page reads; preserve fail-soft errors and data freshness. Consider bounded section loading/cached snapshots for true immediate first document response rather than claiming a client skeleton can render before HTML arrives.
- Deduplicate and reuse public trend requests using the existing client cache pattern, preserving useful errors and stale-response guards. A bounded server cache can share expensive reads across concurrent requests.
- Replace full-history aggregation with a bounded read/precomputed trend snapshot preserving the prior-point and source-date contract. Do not simply truncate dates without preserving baseline semantics.
- Run mocked homepage/season and trend component/API regressions, typecheck/lint, then bounded untouched-tab acceptance. No deployment needed for local verification.

No application source was changed. Existing RSO and Claude work were preserved. No server restart, production change, migration or deployment occurred.
