# Lane D: WiGO page load performance audit (2026-11-01)

Report path: `tasks/artifacts/wigo-charts-overhaul-2026-11-01/audits/D.md`. Screenshots (1440x900, full page, one per load): `audits/screens/L1-star-cold.png` to `L6-star-focus.png`. Load log: `audits/PROD-READ-LEDGER.md`, lines `D-L1` to `D-L6`. No application files, tests, configs or git state were touched.

## How this was measured

- **Server:** one isolated `next dev` (`PLAYWRIGHT_ISOLATED_NEXT=1`, `.next-playwright`, 127.0.0.1:3217) in `web/`, against production Supabase. Nobody else was using `.next-playwright`. It was stopped by exact PID (52889 and its `npm exec` parent 52866) and the planning thread was told. TJ's :3000 server was never touched.
- **Driver:** a Playwright script (headless Chromium, 1440x900, no throttling, fresh browser context per load, no clicks) in my scratchpad (`capture.js`). It records every request: URL, table or RPC, rows, encoded and decoded bytes, start and duration relative to navigation start, and for HTTP errors the PostgREST error body. Panel paint time comes from a DOM poll on the `data-coverage` containers: a panel counts as painted when it has 25+ characters of text, no "Loading"/"Select a player" text, and a canvas, svg, table, image or digit. That is a heuristic. No keys or env values were printed or stored.
- **Six loads used (the whole budget):**

| Load | Player | Notes |
|---|---|---|
| L1 | McDavid 8478402 (star) | cold dev server, includes route compile; quiet window was too short (3 s), so the ratings retries were cut off |
| L2 | McDavid | warm; waited for 12 s of quiet (81 s total) to capture the whole ratings retry storm |
| L3 | Imama 8478147 (depth) | warm; wait capped at 25 s on purpose (see D-01) |
| L4 | Bystedt 8483428 (rookie, 2 GP) | warm; capped at 25 s |
| L5 | Mercer 8482110 (traded) | warm; capped at 25 s |
| L6 | McDavid | warm; capped at 25 s, then a synthetic focus test that turned out **invalid** (see D-12) |

- **Dev-mode caveat (applies to every ms and KB figure below):** dev timings include unminified JS and dev overhead. Network and query time is reported separately from JS time. Supabase round trips are real production latency from this machine. Treat JS sizes as relative, not as production sizes. No production build was run.
- **Current season from the data:** 20262027 (all current-season reads use `seasonId=eq.20262027`; `/api/v1/season` returned it).

## Worst findings first

### D-01 (P2, but the largest single cost; also makes a panel unusable) The ratings cohort times out on the database and retries 12 times, 48 failed reads per page view
- **Where:** `web/components/WiGO/PlayerRatingsDisplay.tsx:64-69` (`useQuery`, no `retry` option, default 3 retries); `web/utils/fetchWigoRatingStats.ts:48-61`; `web/utils/fetchWigoPlayerStats.ts:697-722` (`fetchPaginatedData`: 3 attempts, delay `2^attempt` seconds); tables are `nst_percentile_{es,pp,pk}_offense` and `_defense` selected for season 20262027.
- **What happens (production read, L2):** four of the eight cohort reads (`es_offense`, `es_defense`, `pp_offense`, `pk_defense`) return HTTP 500 `{"code":"57014","message":"canceling statement due to statement timeout"}` after about 3.05 to 3.28 s each. Each failure is retried by `fetchPaginatedData` (3 attempts) inside each React Query attempt (4 attempts), so one page view produced **12 waves x 4 = 48 failed requests**, plus 7 successful empty `as` reads, over 66 s. The failed requests alone are about 148 s of database statement time (sum of durations, L2) for a single page view. The panel shows "Loading ratings…" for about 66 s, then "Unable to calculate ratings right now." (final screenshot `L2-star-warm.png`).
- **Same on every player:** L3 (20 failures in 25 s), L4 (16), L5 (20), L6 (24), L1 (8, cut short). Not player specific.
- **Cause (code reading plus migration reading; not confirmed with EXPLAIN, which is outside the approved scope):** `nst_percentile_es_*`, `_pp_*`, `_pk_*` are views, not tables. In the baseline migration `20260716112908_production_schema_baseline.sql`, `nst_percentile_es_offense` (lines 18959-19004) joins `nst_seasonlong_es_rates` and `nst_seasonlong_es_rates_oi`, which are views over `nst_seasonlong_es_counts` and `_oi`, which are `GROUP BY player_id, season` over the full game-log tables `nst_gamelog_es_counts` and `_oi` (lines 18678-18715). The only indexes on those game-log tables are `(player_id, date_scraped, season)` (lines 36811-36874), with `season` last, so a `season = 20262027` filter cannot use them to start. Only the `as` tables (`nst_percentile_as_offense`, `_defense`) are physical tables, and they return 0 rows for 20262027.
- **Second problem in the same panel:** even if the three views were fast, `nst_percentile_as_*` has no rows for 20262027 (L2: 0 rows, 2 bytes, repeated 7 times), so the "Overall All" ratings still cannot compute. That is a data-pipeline issue (NST, Codex lane); I did not investigate it.
- **Why the load capped waits matter:** L3 to L6 were capped at 25 s so I did not repeat another 48-request storm four times against production. Each capped load still produced 16 to 24 timeouts.
- **Verified:** `production read`, L1 and L2 plus L3 to L6 in the ledger. Not verified: that the ES/PP/PK strength buttons of the rate-percentile panel hit the same views and time out the same way (not clicked, budget), and the root cause with EXPLAIN.

### D-02 (P2) First useful paint is gated by a chain of serial round trips, not by payload size
Warm L2 critical path (dev; network timings are real):
```
0 ms      navigation start (TTFB 348 ms, DCL 766 ms, FCP 780 ms)
800       /api/v1/season starts        -> 247 ms          (every season-keyed read waits for this)
915       players select *             -> 201 ms          (team_id: needed by schedule + team drivers)
1062      wigo_career, wigo_recent, wgo_skater_stats_totals   (after season)
1125      /api/cors schedule (after players) -> 91 ms
1139-1148 17 more reads start together (RPC, cohorts, game logs, drivers page 1)
1428      games page 2        (after games page 1, 270 ms)
1520      two "latest date" probes (after games page 2)
1615      two team-driver data reads (after probes)  -> team drivers painted 1940
2015-2227 percentile fallback cohort, 2 stages (after the empty 20262027 read) -> percentiles painted 2331
```
- Team drivers (`web/components/WiGO/fetchTeamDriverSnapshots.ts:6-37`): 4 sequential stages (games page 1, games page 2, latest-date probes, data reads), 6 requests, about 207 KB decoded.
- Rate percentiles (`web/utils/fetchWigoPercentiles.ts:238-325`): empty current-season read, then a fallback cohort read (page 1, page 2). The previous-season fallback cannot start until the current-season result is evaluated.
- Season: `fetchPlayerAggregatedStats` is held back until `/api/v1/season` returns (`useWigoPlayerDashboard.ts:164-169`), so it adds one full round trip to the front of everything.
- **Panel paint times (ms from navigation start, warm L2, dev):** header and charts shell 1139; schedule 1222; comparison matrix 828 (table) and 1281 (game-log chart); per-game table 1425; ratings never; consistency 1309; team drivers 1940; category radar 1950; rate percentiles 2331. Other loads: percentile panel painted at 1719 (L5), 1947 (L6), and **never** for Imama (L3, no previous-season cohort row) and Bystedt (L4).
- **Verified:** `production read` (L2 to L6); `code` for the dependency edges.

### D-03 (P2) Every page view downloads league-wide cohorts to rank one player
Warm L2, successful requests only:

| Read | Rows | Decoded | Used for |
|---|---|---|---|
| `get_skaters_avg_stats` RPC (`hooks/usePercentileRank.ts:84-98`) | 740 | 235 KB (24 KB encoded) | 8 radar percentiles of one player |
| `nst_percentile_as_offense` fallback 20252026, 2 pages | 500 + 133 | 283 KB + 74 KB | rate-percentile bars |
| `nst_percentile_as_defense` fallback, 2 pages | 500 + 133 | 34 KB + 9 KB | only `gp` and `toi_seconds` (C-09, still true) |
| games for the season (team drivers) | 1000 + 344 | 72 KB + 25 KB | team-driver expected games, league-wide |
| `nst_team_5v5` + `wgo_team_stats` (season to date) | 452 + 452 | 39 KB + 67 KB | team drivers |

- Total successful decoded data per load is about **1.0 MB** (about 180 KB encoded) on the star and traded players; **614 KB** on the rookie (no fallback cohort). About 85% of it is league cohort data, not the selected player's data.
- The RPC took 2.84 s (cold L1), 0.80 s (L2), 0.32 s (L3), 0.61 s (L4). It was in the September timeout list.
- **Verified:** `production read` (L1 to L6); `code` for the consumers.

### D-04 (P2) Query cache defaults refetch on focus and re-download cohorts after 60 s
- `web/pages/_app.tsx:20` is still `const queryClient = new QueryClient();` (staleTime 0, `refetchOnWindowFocus` true). `useWigoPlayerDashboard.ts:158-169` sets no `staleTime` on player details or the aggregate query. The cohort and driver queries use `staleTime: 60_000` (`TeamPerformanceDrivers.tsx:34`, `PlayerRatingsDisplay.tsx:68`, `RateStatPercentiles.tsx:228`, `fetchWigoPercentiles.ts:250,258,266`) while their sources change once a day (cron).
- So one refocus after more than a minute asks for: players (+ NHL landing if no image), career, recent, totals (4 requests), plus drivers (6 requests, 207 KB), percentile cohort (4+ requests, 391 KB), ratings (the 48-request storm again), 4 game logs and the schedule. Roughly **25 or more requests and about 0.7 MB** per refocus, on top of D-01.
- **Not runtime-verified.** My synthetic focus event in L6 was invalid: I dispatched a non-bubbling `visibilitychange` on `document`, while React Query listens on `window`. The 4 requests seen after it were ratings retries, not focus refetches. The budget of 6 loads is spent, so this is `code` only. This continues A-07 / B-15.

### D-05 (P2, Vercel runtime cost) Two function invocations per page view, plus a poll every 5 minutes
- `/api/v1/season` (`web/pages/api/v1/season.ts:44,49`): `Cache-Control: max-age=86400` is browser-only (no `s-maxage`), so each new visitor invokes the function once per load.
- `/api/cors` (`web/lib/cors-fetch.ts`, `web/pages/api/cors/index.ts`): no `Cache-Control` header is set anywhere in the handler (only `Allow`). The browser path of `Fetch` goes through it. Schedule payload: 88 games, 15 KB encoded, 176 KB decoded, 91 to 533 ms.
- `OpponentGamelog.tsx:95-96`: `refetchInterval` is 30 s when a game is LIVE/CRIT, **300 s otherwise, always**. That is 12 invocations per hour per open focused tab with no game, including the offseason, each downloading the full season schedule from the NHL. Verified in code (A-09 is unchanged).
- Verified at runtime for the first request only (one `/api/cors` per load). The 5-minute poll was not observed (loads were 25 to 81 s).

### D-06 (P2) Duplicate and overlapping reads
Same 14-row `wgo_skater_stats` player-season, read separately by two panels with different columns (L2):
- `select game_id,date,points,shots,hits,blocked_shots ... games_played=eq.1` (Points, Consistency, Game Score through `useWigoGameLog`).
- `select date,toi_per_game,pp_toi_per_game,pp_toi_pct_per_game ...` without the `games_played` filter (TOI chart, `ToiLineChart.tsx:66-70`, C-07 still open).
- Plus the Game Score RPC (`get_skater_game_scores_for_season`) returning the same dates (C-08: the calendar is now shared, but the RPC is still a third read and the join is still by date).
- `wgo_skater_stats_totals` is read **four times** per load with three shapes: `fetchPlayerAggregatedStats` (no season filter, latest season, `limit 1`), `fetchPlayerPerGameTotals`, `fetchCanonicalPlayerGp`, `fetchCanonicalSeasonMaxGp` (`fetchWigoPlayerStats.ts:640-648, 732-761`; `fetchWigoPercentiles.ts:90-118`). The first two return the same player row.
- `nst_percentile_as_offense` and `_defense` for 20262027 are requested by **both** the ratings query and the percentile query (different selects), and again on every ratings retry: 7 times in L2, 5 in L3, 3 in L4, all returning 0 rows. These are the only exact-URL duplicates among successful requests (they are the ratings query's empty `as` reads, repeated once per React Query attempt: 4 times in L2, 2 in L3).
- `games` is paged twice (1000 + 344) because the page size is 1000 and the season has 1344 regular-season games.
- Unranged reads (no `range`/`limit` on a possibly unbounded result): the per-player game-log reads (`order=date.asc`, bounded by one player-season, 14 rows) and `wigo_career`/`wigo_recent` (`select *`, 1 row, 2 to 4 KB each, wider than needed). The cohort reads are paged. No unbounded table scans from the page itself.
- **Verified:** `production read` (L1 to L6).

### D-07 (P2) Both chart libraries are in the page chunk; the zoom plugin is bundled into three async chunks
- Dev chunk sizes served by the isolated server (encoded transfer, relative only): `pages/wigoCharts.js` 2,977 KB, `_app.js` 1,409 KB, `main.js` 1,810 KB (6.6 MB of JS in 13 script requests). The three dynamic chart chunks `ToiLineChart`, `PpgLineChart`, `GameScoreSection` are about 105 to 111 KB each; `ConsistencyChart` 21 KB.
- By module text in the dev page chunk (inflated by dev source text): `recharts` 2.6 MB, `chart.js` 1.4 MB, `lodash` 0.6 MB (a recharts dependency), `d3-*`, `react-smooth` and others; `date-fns` 3.3 MB (dev barrel inflation; the code uses named imports `format, isToday, isTomorrow`, which a production build tree-shakes, so I do not count it as a finding).
- **Why recharts and chart.js are static:** `StatsTable.tsx:5` and `WigoComparisonMatrix.tsx:13` import `StatsTableRowChart` (recharts) statically; `RateStatPercentiles.tsx:3,15` (`Bar`, datalabels) and `CategoryCoverageChart.tsx:3` (`Radar`) import chart.js statically. Only Toi, Ppg, GameScore and Consistency are `dynamic(... ssr:false)` (`WigoDashboardSections.tsx:28-49`).
- **Zoom plugin duplication:** each of the three chunks carries its own copy of `hammerjs` (194 KB dev text) and `chartjs-plugin-zoom` (89 KB dev text). A production build usually hoists shared modules into a shared chunk; I did **not** verify that and did not run `next build`.
- No lazy-loading below the fold applies: the settled no-scroll layout shows every panel on one screen.
- **Verified:** `dev chunks` measured; production sizes not measured.

### D-08 (P3 for load, P2 for responsiveness) Ratings regression is O(n²) per stat on the main thread
`calculateWigoRatings.ts:148-172`: for a low-GP target, `cohortPercentiles` calls `calculateRankingResult(comparisonRows, row.player_id, ...)` for every cohort row, and each call does a `find` plus a full scan (`calculatePercentiles.ts:22-45`). With n of about 500 to 700 that is about 0.5 to 1 million comparisons per stat, and the ratings use 44 stat entries. `PlayerRatingsDisplay.tsx:71-76` recomputes the whole thing on every `minGp` change. **Not measured**: no load ever reached the calculation (D-01). A low-GP player such as Bystedt is the case that triggers it. This continues B-17. Fix: rank each stat once with a sort (O(n log n)).

### D-09 (P2) Chart options are rebuilt on every render (C-11)
`ToiLineChart.tsx:321-322` and `PpgLineChart.tsx:271` call `getChartData()` and `getChartOptions()` in the render body with no `useMemo`; `GameScoreLineChart` builds options and passes them to `RollingAverageChart`. `WigoTrendsSection` and `WigoCharts` are not memoized, and the page re-renders on every timeframe change and every window resize step (`wigoCharts.tsx:40-49`). New `options` object identity per render is passed to react-chartjs-2. I measured only that two long tasks of about 105 to 125 ms each happen at hydration (total 214 to 246 ms of main-thread time per load in dev). I did **not** test resize or compare-dropdown re-render or zoom reset at runtime.

### D-10 (P3) Third-party and asset requests per load (site-wide, not WiGO-specific)
Per load (L2): 10 `fonts.googleapis.com` CSS requests, 5 `fonts.gstatic.com` font files, 1 `img.buymeacoffee.com` button, the NHL headshot (`assets.nhle.com/mugs/...png`, 104 KB, shown at about 40 to 90 px) and a 31 KB team-logo PNG. In L1 one fonts CSS request took 4.5 s. In production `next/image` optimization is on (`unoptimized: !isProd`), which is a Vercel Image Optimization cost I did not measure.

## Waterfall tables

All times are ms from navigation start (dev; network timings are real). "dec" is decoded bytes. Failed requests are the HTTP 500 statement timeouts of D-01.

### L2: McDavid, warm (the baseline), successful data requests before the first ratings retry

| Start | Dur | Request | Rows | Dec | Note |
|---|---|---|---|---|---|
| 800 | 247 | `/api/v1/season` | 1 | 0.3 KB | Vercel function |
| 915 | 201 | `players?id=eq.8478402` `select=*` | 1 | 0.4 KB | |
| 1062 | 135 | `wigo_career` `select=*` | 1 | 3.9 KB | after season |
| 1062 | 133 | `wigo_recent` `select=*` | 1 | 2.1 KB | |
| 1062 | 114 | `wgo_skater_stats_totals` latest season `limit 1` | 1 | 0.2 KB | 1 of 4 totals reads |
| 1125 | 91 | `/api/cors` NHL club schedule | 88 | 172 KB | Vercel function |
| 1139 | 798 | RPC `get_skaters_avg_stats` | 740 | 230 KB | radar |
| 1145 | 271 | `wgo_skater_stats_totals` per-game totals | 1 | 0.3 KB | |
| 1145 | 271 / 124 | `nst_percentile_as_offense` / `_defense` 20262027 (percentiles) | 0 | 2 B | empty |
| 1145 | 3172 to 3280 | `nst_percentile_{es,pp}_offense`, `{es,pk}_defense` | n/a | 0 | **500 x4, retried 11 more times** |
| 1146 | 270 | `games` page 1 | 1000 | 72 KB | team drivers |
| 1146 | 132 | `nst_gamelog_as_rates` (matrix metric SOG/60) | 14 | 0.7 KB | |
| 1146 | 269 | `wgo_skater_stats` (TOI) | 14 | 1.3 KB | |
| 1146 | 154 | `wgo_skater_stats` (points/consistency, `games_played=1`) | 14 | 1.3 KB | |
| 1146 | 270 | RPC `get_skater_game_scores_for_season` | 14 | 0.7 KB | |
| 1147 | 269 / 127 | `nst_percentile_as_offense` / `_defense` 20262027 (ratings) | 0 | 2 B | empty, repeated on every retry |
| 1148 | 163 / 865 | `wgo_skater_stats_totals` player GP / season max GP | 1 / 1 | 21 B | percentile staleness check |
| 1428 | 92 | `games` page 2 | 344 | 25 KB | |
| 1520 | 94 / 95 | `nst_team_5v5` / `wgo_team_stats` latest-date probes | 1 / 1 | 23 B | |
| 1615 | 117 / 321 | `nst_team_5v5` / `wgo_team_stats` season data | 452 / 452 | 39 / 67 KB | |
| 2015 | 211 / 119 | fallback cohort 20252026 `as` offense / defense, page 1 | 500 / 500 | 283 / 34 KB | |
| 2134 / 2227 | 86 / 98 | fallback cohort page 2, defense / offense | 133 / 133 | 9 / 74 KB | |

L1 (cold, same player): same requests, with the page and API routes compiling. TTFB 4,074 ms, DCL 8,860 ms, first data request 8,911 ms (`/api/v1/season` took 502 ms), RPC 2,838 ms, last non-ratings data at 12,837 ms. Dev compile cost dominates the first load and should be ignored for tuning.

### Totals per player (one load each; all warm except L1)

| Load | Player | Data requests | OK / failed (500) | OK decoded | OK encoded | League cohort part of OK decoded | Last non-ratings data done | Last panel painted (ms) |
|---|---|---|---|---|---|---|---|---|
| L1 cold | McDavid | 36 (cut off early) | 28 / 8 | 1,003 KB | 176 KB | 391 KB fallback + 230 KB RPC | 12,837 | 14,114 (dev, cold) |
| L2 | McDavid | 82 | 34 / 48 | 1,003 KB | 182 KB | same | 2,013 | 2,331 |
| L3 | Imama | 50 | 30 / 20 | 999 KB | 176 KB | same | 1,965 | 1,972 (percentile panel never painted) |
| L4 | Bystedt | 46 | 26 / 16 | 614 KB | 78 KB | 230 KB RPC only | 1,879 | 1,889 (percentile panel never painted) |
| L5 | Mercer | 50 | 30 / 20 | 1,000 KB | 177 KB | same | 1,659 | 1,719 |
| L6 | McDavid | 54 | 30 / 24 | 1,003 KB | 178 KB | same | 1,552 | 1,947 |

L3 to L6 were capped at 25 s of waiting by design, so their failed-request counts are lower bounds (D-01). The "successful requests" count a working page would still make (ratings fixed) is about 30 per player, about 20 of them in the first 1.2 s.

JS timing per load (dev): 13 script requests, 6.6 MB encoded, 28 MB decoded; 2 long tasks totalling 214 to 246 ms; heap 125 to 141 MB. No data request starts before about 0.7 to 0.8 s (hydration plus the season call).

## Ranked savings

"Req" is requests per cold page view. Time estimates are dev-mode wall time on this machine, rounded, and apply to the warm baseline L2 unless noted. "Ask-first" means a migration, a production setting, or a cron/NST-lane item that needs TJ or Codex before it is touched.

| # | Saving | Est. saved per page view | Files touched | Risk | Migration / ask-first? |
|---|---|---|---|---|---|
| 1 | **Stop retrying statement timeouts:** set the ratings query `retry` to 0 or 1 (or retry only network errors) and drop the inner `fetchPaginatedData` retry for 4xx/5xx PostgREST errors with code 57014. | 44 of 48 failed requests; about 140 s of database time per view; the "Loading ratings…" wait drops from about 66 s to about 3 s | `PlayerRatingsDisplay.tsx`, `fetchWigoPlayerStats.ts` (`fetchPaginatedData`) | Low; unit tests exist for the fetch utils | No |
| 2 | **Make the ES/PP/PK cohort reads cheap:** materialize `nst_percentile_{es,pp,pk}_*` (or add season-leading indexes on `nst_gamelog_*_counts{,_oi}`), or serve ratings from one RPC that returns only the target player's weighted ratings. | The remaining 4 failed reads and the ratings panel becoming usable at all; a ratings read of about 1 s instead of timing out | SQL migration; if RPC, `PlayerRatingsDisplay.tsx` | Medium; EXPLAIN not run | **Yes: migration, production DB, NST data lane (Codex)**. Also needs `nst_percentile_as_*` rows for 20262027 or the ratings stay empty |
| 3 | **Fix the data-dependency chain:** start the aggregate reads without waiting for `/api/v1/season` (season is already known from the `/season` result cached 1 h, or embed it at SSR); start the team-driver probes in parallel with `games`; start the previous-season fallback cohort in parallel with the current-season one when canonical GP indicates a stale season. | about 250 ms (season) + about 450 ms (drivers chain) + about 500 ms (percentile fallback) off the slowest path; last panel 2.3 s to about 1.4 s warm | `useWigoPlayerDashboard.ts`, `fetchTeamDriverSnapshots.ts`, `fetchWigoPercentiles.ts` | Medium (correctness of the stale-season rule and of the drivers cutoff must be kept) | No |
| 4 | **Server-side aggregation of league cohorts** into small results: one RPC for the radar (replace the 740-row RPC with the target player's 8 percentiles), one RPC or materialized view of the team-driver snapshot (about 32 rows instead of about 207 KB and 6 requests), one RPC for the rate-percentile bars (target player plus league distribution summary). | about 730 KB decoded and 12 requests per view (RPC 235 KB, percentile cohort 391 KB, drivers 207 KB), 0.3 to 2.8 s on the RPC | new SQL; `usePercentileRank.ts`, `fetchTeamDriverSnapshots.ts`, `fetchWigoPercentiles.ts`, `RateStatPercentiles.tsx` | Medium to high (logic moves to SQL; tests must pin parity) | **Yes: migrations on production** |
| 5 | **Query defaults:** a longer `staleTime` for the WiGO queries (aggregates, details, cohorts, drivers: 10 minutes to 1 hour), `refetchOnWindowFocus: false` for them, `gcTime` to match. Scope in the WiGO hooks and components, not `_app.tsx`, to avoid changing other pages. | about 25 requests and about 0.7 MB per refocus; zero on first load | `useWigoPlayerDashboard.ts`, the cohort/driver `useQuery` calls | Low | No (if scoped to WiGO); a global `_app.tsx` default is **ask-first** because it affects every page |
| 6 | **Schedule polling and function calls:** poll only when a game is today (PRE, LIVE or CRIT), otherwise `refetchInterval: false` and staleTime of 30 minutes; add `s-maxage` on `/api/cors` for NHL schedule URLs and on `/api/v1/season`. | up to 12 `/api/cors` invocations per hour per open tab; one `/api/v1/season` invocation per visitor if CDN-cached | `OpponentGamelog.tsx`; `pages/api/cors/index.ts`, `pages/api/v1/season.ts` | Low (polling); medium (proxy headers change production caching) | Polling change: No. **Proxy/season headers: ask-first** (Vercel runtime behaviour). No cron or route was called |
| 7 | **Merge game-log reads:** one `wgo_skater_stats` read for date, game_id, points, shots, hits, blocked shots, TOI columns; serve TOI, Points, Consistency and Game Score from it; reduce the four `wgo_skater_stats_totals` reads to two (totals and season max GP); drop the defense `as` read that only supplies `gp` and `toi_seconds`. | 7 requests (1 game log, 2 totals, 2 defense page reads, plus 2 repeated `as` probes), about 45 KB decoded; little wall time (they run in parallel) | `ToiLineChart.tsx`, `useWigoGameLog.ts`, `fetchWigoPlayerStats.ts`, `fetchWigoPercentiles.ts` | Low to medium (TOI filter differs: no `games_played=1`; confirm which games TOI should include) | No |
| 8 | **Lazy-load chart libraries off the critical path:** `dynamic()` for `StatsTableRowChart` (recharts), `RateStatPercentiles` and `CategoryCoverageChart` (chart.js); check that the zoom plugin and hammerjs land in one shared chunk. | production JS savings not measured (dev: recharts and chart.js are about 4 MB of 13.7 MB dev page chunk text); expected to move chart-library parse time after the table paints | `WigoDashboardSections.tsx`, `WigoComparisonMatrix.tsx` | Low | No. A bundle analysis needs a production build, which AGENTS.md says to avoid unless necessary |
| 9 | **Memoize chart options and sections (C-11):** `useMemo` for chart data and options, `React.memo` on the trend sections. | 0 requests; avoids chart rebuilds on each timeframe change and resize step (not measured) | `ToiLineChart.tsx`, `PpgLineChart.tsx`, `GameScoreLineChart/index.tsx`, `WigoDashboardSections.tsx` | Low | No |
| 10 | **Linear-time ratings regression (B-17):** rank each stat once by sorting; compute regression targets from that. | not measured; removes about 0.5 to 1 million comparisons per stat on a `minGp` change | `calculateWigoRatings.ts`, `calculatePercentiles.ts` | Low (tests exist) | No |
| 11 | **Trim `select *`:** `players` (404 B decoded), `wigo_career` (3.9 KB), `wigo_recent` (2.1 KB) to the columns the page uses. | about 5 KB per view | `useWigoPlayerDashboard.ts`, `fetchWigoPlayerStats.ts` | Low | No |

Suggested order for the implementation thread: 1 (no ask, immediate), 5 and 6 (polling part), 3, 7, 9, 10, 8; then ask TJ about 2, 4 and the proxy headers.

## Missing indexes visible in the migrations

I read `supabase/migrations/20260716112908_production_schema_baseline.sql` only. Later migrations I did not read for these tables. I ran no EXPLAIN.

| Table / view | What the page filters on | Index found | Verdict |
|---|---|---|---|
| `nst_gamelog_{es,pp,pk}_counts` and `_oi` (under the percentile views) | `season`, grouped by `player_id, season` | `(player_id, date_scraped, season)` only | **Likely cause of D-01**: no season-leading index |
| `nst_percentile_as_offense`, `_defense` | `season = x order by player_id` | no index or key found in the baseline | Fine at 633 rows; add `(season, player_id)` if the table grows |
| `games` | `seasonId = x and type = 2 order by id` | `games_pkey (id)` and `idx_games_date (date)` | Works (about 100 to 270 ms for 1,000 rows); a `(seasonId, type, id)` index would remove the sort |
| `wgo_skater_stats` | `player_id, season_id, games_played = 1 order by date` | several (`(player_id, date, season_id)`, partial `games_played = 1`) | Fine (4 to 270 ms) |
| `wgo_skater_stats_totals` | `player_id`, `season` | `(player_id, season)` primary key and unique index | Fine. The `order by games_played desc limit 1` per season has no index and took 865 ms in L2 and 3.4 s in L1 (cold): the **season-max-GP probe** is a seq scan; a `(season, games_played desc)` index or deriving it from the cohort would fix it |
| `wigo_career`, `wigo_recent` | `player_id` | primary key on `player_id` | Fine |
| `nst_team_5v5` | `date between`, order by date | primary key `(team_abbreviation, date)` | Date-range reads have no date-leading index; small table, low priority |
| `wgo_team_stats` | `season_id`, `date` range | `(season_id, date)` | Fine |

## What I did not check (plainly)

- **Phone layout.** All loads used 1440x900. The mobile tab layout, its `StatsTable` path and mobile-only requests were not loaded.
- **Production build.** No `next build`; bundle sizes are dev-chunk module text, not minified or gzipped sizes. Chunk splitting and shared-chunk hoisting in production are unverified.
- **Refetch-on-focus, window resize, compare-dropdown change, zoom reset and the 5-minute schedule poll** were not observed at runtime. The one focus experiment I ran was invalid (D-04), and the load budget is spent.
- **ES/PP/PK strength buttons** of the rate-percentile panel, the player search typeahead request, a player switch inside a session, and a goalie (goalies are excluded from search) were not exercised.
- **EXPLAIN plans, database settings (statement timeout), and Vercel usage or logs.** None were read; "3 s" is the observed time-to-failure, and the view-over-view cause is from the migration text.
- **Why `nst_percentile_as_*` has no 20262027 rows** and why the fallback percentile bars show 50% and rank "1st" with "Player GP: 3" for McDavid (see `L1-star-cold.png`): this looks like a data or logic issue for lanes B and C. I only observed it.
- Paint times come from a DOM heuristic and are within about one frame (16 ms) at best; the ratings panel's "Loading ratings…" text counts as not painted.
- The server-side cost of `get_skaters_avg_stats` beyond its observed 0.3 to 2.8 s was not examined.

## Re-verified old items

| Old ID | Item | Status now | Evidence |
|---|---|---|---|
| A-07 / B-15 | Bare `new QueryClient()`, no staleTime on details and aggregates, refetch on focus | **Still open** (code). Runtime not verified | `_app.tsx:20`; `useWigoPlayerDashboard.ts:158-169` (D-04) |
| A-08 | `wigo_rates` read and duplicate totals read | **Partly fixed**: the `wigo_rates` read is gone; the season-less totals read in the aggregate fetch remains (4 totals reads per load) | `fetchWigoPlayerStats.ts:629-649`; L1 to L6 |
| A-09 | Schedule polls the uncached `/api/cors` every 5 minutes, even offseason | **Still open** | `OpponentGamelog.tsx:95-96`; no cache header in `pages/api/cors/index.ts` |
| A-10 | Team-driver dataset refetched after 60 s; 3 sequential steps | **Still open** (6 requests, 4 stages, 60 s staleTime) | `TeamPerformanceDrivers.tsx:34`; `fetchTeamDriverSnapshots.ts`; L2 waterfall |
| B-16 | Ratings cohort 60 s staleTime, not shared with percentile panel | **Still open**; percentile cohorts are now shared through `queryClient.fetchQuery` keys, but the ratings and percentile cohorts remain separate downloads | `PlayerRatingsDisplay.tsx:64-69`; `fetchWigoPercentiles.ts:245-269` |
| C-09 | Rate-percentile cohorts refetched after 60 s; defense read nearly useless | **Still open** | `RateStatPercentiles.tsx:228`; defense read returns only `gp` and `toi_seconds` (L2) |
| C-07 | TOI keeps its own game-log read | **Still open** | `ToiLineChart.tsx:66-70`; L2 shows two separate `wgo_skater_stats` reads |
| C-08 | Game Score needs two reads plus a date join | **Partly fixed**: the calendar now comes from the shared `useWigoGameLog`; the RPC is still a separate read joined by date | `GameScoreLineChart/index.tsx:36-110` |
| C-11 | Chart options rebuilt every render | **Still open** (code); runtime effect unverified | `ToiLineChart.tsx:321-322`; `PpgLineChart.tsx:271` |
| B-17 | Low-GP regression is O(n²) | **Still open** (code); timing never measured | `calculateWigoRatings.ts:148-172`; `calculatePercentiles.ts:22-45` |
