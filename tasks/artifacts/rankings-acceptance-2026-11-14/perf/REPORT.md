# Rankings slow-path review (offline) — deployed `89da739cb` (#446)

Date: 2026-11-14. Author: Claude worker for the Rankings acceptance Chef.
Method: code reading, existing Vercel observability, and an offline micro-benchmark on synthetic data. **No production, app, DB or provider requests were made. No source edits.**

Code identity: `git diff --stat 89da739cb -- web/lib/rankings web/pages/api/v1/contextual-rankings web/pages/rankings.tsx web/components/Rankings` is empty against the working tree, so every `file:line` below is the deployed code.

## Findings on speed (input to the Chef's verdict)

- **Rolling-fallback path: two very different costs, depending on data coverage.**
  - **Common case**, where every default 5v5 column metric is calculable on the latest date: about **88 round trips / 25k wide rows** for a default page. About 77 MB of synthetic JSON comes from about 60 wide date reads.
  - **Full ladder**, where any default metric is never calculable (for example SAX% without L6 season totals): about **1,130 round trips / 396k rows**, serial depth about 170.
  - The bench cannot tell which case production hit on 11-08 (19.14 s) or hits now. GET 1 in §5 tells, from `meta.unavailableMetrics`.
  - Snapshot and comparison multiply either case by the number of 50-row pages scanned. A last-page snapshot is 1,066 RT in the common case and 4,516 RT on the full ladder.
- **Durable path (`entity_metric_rankings`): plausible but not proven.**
  - A default page is **77 round trips and about 26k rows**, serial depth about 9, offline compute about 50 ms.
  - The cost is **cohort × metric reads with no entity filter**, repeated for each peer surface.
  - Real latency depends on DB page time, which only a deployed GET can show.
- **Snapshot and comparison rebuild the whole matrix once per scanned page of 50**, even on the durable path:
  - an off-page (last-page) snapshot is about 860 round trips and 265k rows;
  - a six-way comparison of ids spread across the cohort is about 1,100 round trips and 344k rows;
  - the default-load comparison (top 6 ids) is one size-50 build.
- **Trending always uses the rolling fallback.** It never reads `entity_metric_rankings`, and the page fires it automatically on every skater Rankings load. In the common case it is 80 round trips and 26k rows.
- **Goalie and team matrices have no durable path.** They do whole-season reads on every cache miss: goalie about 20 round trips and about 15k rows, team about 9 + ⌈2.6·U⌉ round trips. These are estimates from code; I did not benchmark them.
- **Caching cannot rescue an interactive session.**
  - The caches are process-local, last 30 s, have no eviction, and are keyed by the full request including `page`, `search` and `selected_player`.
  - Only the rolling-row cache coalesces concurrent identical requests.
  - The page clears the matrix on every keystroke and on every skater row selection.
- **Which stage dominates** (inference from counts):
  - On the fallback path, **query paging and transfer** dominate. Compute is 0.1–0.2 s in the common case and about 1.8 s on the full ladder, against tens to hundreds of MB of wide rows moved.
  - On the durable path, query paging dominates: about 27 sequential 1,000-row pages per request.
  - Serialization is about 2 ms or less in every case.
  - Client rendering is bounded at 50 rows and is not the bottleneck. Client **request churn** is: no debounce, no abort, and the table blanks on each key change.

A production read is still needed to answer the questions in §5.

---

## 1. Server read paths per route

Legend:
- RT = DB round trips.
- Rows = rows returned.
- "Bench" numbers are offline counts from `bench-results.json`, using a synthetic cohort of 750 skaters, 32 teams and 60 game dates.

### 1.1 Shared machinery

| Item | Where | Behaviour |
|---|---|---|
| Matrix response cache | `web/lib/rankings/playerMatrix.ts:207,217-220,999-1002,1492-1494` | Key is `JSON.stringify(request)`, which includes page, pageSize, search, selectedPlayerId and sort. TTL is 30 s, **anchored at request start** (`now` at 999). No eviction (only the test clear at 223). **No coalescing.** |
| Durable snapshot-date cache | `entityMetricRankingReader.ts:39,62,184-225` | One cached `limit(1)` per metric × peer group. 30 s TTL anchored before the query. No eviction. No coalescing. |
| Rolling rows cache | `rankingQueries.ts:67-74,283-348` | Key is season:strength:snapshotDate:**every date ≤ snapshotDate**. 30 s TTL **anchored at completion** (331). **Has in-flight coalescing** (303-346). Team filtering happens after the cache, so it ignores team. |
| Goalie / team response caches | `goalieMatrix.ts:237-242,1604-1608,1903-1907`; `teamMatrix.ts:321-327,1366-1371,1710-1713` | `JSON.stringify(request)`, 30 s TTL from request start, no eviction, no coalescing. |
| HTTP caching | all routes `pages/api/v1/contextual-rankings/*.ts` | No `Cache-Control` is set anywhere. The 11-08 audit saw `public, max-age=0, must-revalidate` and `x-vercel-cache: MISS`. There is no CDN reuse. |
| Function limit | `web/vercel.json:4-8` | `maxDuration: 240` s for `pages/api/**/*.ts`. |
| PostgREST cap | local `supabase/config.toml:18` (`max_rows=1000`) | Reads without `.range` stop silently at 1,000 rows. That is local config; I did not verify production's value. |

### 1.2 Skater matrix — `GET /api/v1/contextual-rankings/matrix`

Route: `pages/api/v1/contextual-rankings/matrix.ts:21-23` calls `parsePlayerMatrixRequestWithResolvedTeam` and then `buildPlayerMatrixSurface`.
- The team token resolver reads all `teams` once when `team` is non-empty (`teamTokenResolver.ts:63-71`).
- The page always sends `ranking_source=entity_metric_rankings` (`rankingUrlState.ts:611-628`), so `prefersDurable` is true unless `window_scope=cross_season` is sent (`playerMatrix.ts:1047-1049`).

Build sequence (`playerMatrix.ts:996-1260`):

1. **Sort surface** for one metric over the whole cohort.
   - Durable: `buildEntityMetricRankingSurfaces` (1050-1055).
   - If that is empty or unavailable, it falls back to `buildContextualRankingsSurfaces` (1073-1076).
2. **Composite ratings** for the cohort: `skater_composite_ratings`, `.in` chunks of 500, paged by 1,000 (753-812). That is 2 RT for 750 players.
3. **Three peer surfaces** run concurrently (1171-1219):
   - current;
   - overall (reuses current when equal);
   - deployment.
   - Each covers all about 17 default 5v5 surface metrics, `entityIds` = page ids.
4. **All-strength TOI enrichment, a per-player N+1** (681-751).
   - One `rolling_player_game_metrics` `limit(1)` **per page player**, plus one `rolling_player_metric_support_payloads` read per player when `window ≠ season`.
   - Concurrency is 6, in sequential waves of 6.
   - Page size 10 means 10–20 RT in 2 waves. Size 50 means 50–100 RT in 9 waves.
5. Column assembly, then the cache write (1492).

**Durable path** (`entityMetricRankingReader.ts`):
- `fetchLatestSnapshotDate`: one `limit(1)` per metric per peer group, cached (184-225).
- `fetchEntityMetricRows` (227-260) reads **every entity for every requested metric**:
  - `.in("metric_key", keys)`, paged by 1,000, **no entity filter**.
  - It ranks the full cohort, then applies the page `entityIds` in memory (`:426-427`).
- Metadata is hydrated only for returned rows (563-575): 2 RT.

Bench results (durable):

| Scenario | RT | Rows | Of which `entity_metric_rankings` | Serial depth (est.) | In-process compute | Response |
|---|---|---|---|---|---|---|
| page 1, size 10 | 77 | 26,330 | 61 RT / 26,284 rows | about 9 | about 58 ms | 220 KB |
| page 1, size 50 | 117 | 26,484 | 61 / 26,284 | about 17 (TOI waves) | about 41 ms | 897 KB |
| repeat within 30 s, same instance | 0 | 0 | n/a | n/a | 0 | 220 KB |
| page 2 after page 1 (new key) | 43 | 26,294 | 27 / 26,250 | n/a | about 41 ms | 220 KB |

Upper bound, durable, page size P, cohort N, about 17 metrics M:
- RT ≈ 2 + 2·⌈N·M/1000⌉ + 2M + 2 + 2 + P·(1 or 2).
- Rows ≈ N + 2·N·M.
- For N = 750 that is about 26k rows. Rows grow linearly with cohort and with the number of metric columns.

**Rolling-fallback path** (`rankingQueries.ts`):
- `resolveRollingSnapshotDates` (240-277): 2 RT. These are the latest `rolling_player_game_metrics.game_date` and up to 200 `games` rows, giving up to **30** distinct dates.
- `resolveRankedSnapshotsForMetrics` (669-756) evaluates snapshot dates newest first. For date *i* it calls `buildRankedSnapshot` with `snapshotDates.slice(i)`. It stops only when **every** requested metric has a calculable value (750).
- Each evaluation (`fetchRollingRowsForSnapshot`, 279-348) reads **every date ≤ snapshotDate**.
  - Per date: a `rolling_player_game_metrics` page loop (352-378; 130 columns, 1,000 rows per page).
  - Plus a `rolling_player_metric_support_payloads` page loop (`rollingWindowCountSupportReader.ts:70-91`; a JSON payload per row).
  - Dates run in waves of 6 (`ROLLING_DATE_QUERY_CONCURRENCY`, 68, 305-319).
  - The cache key includes the date list, so evaluation *i+1* is a **new key and re-reads 29, 28, … dates**. That is the 30+29+…+1 = **465 date-read slots**.
- Each evaluation also hydrates `players` and `teams` for the **whole cohort** (424-427, 459-505): 3 RT.

Bench results (fallback). Two cases, because the bench **cannot tell which one production hits**:

| Scenario | RT | Rows | Synthetic bytes read | Serial depth (est.) | In-process compute | Response |
|---|---|---|---|---|---|---|
| **Common case**: every default metric calculable on the latest date (ladder stops at date 0), size 10 | **88** | **25,459** | about 77 MB | about 13 | about 0.23 s | 223 KB |
| Common case, size 50 | 128 | 25,499 | about 77 MB | about 26 | about 0.11 s | 910 KB |
| **Full ladder**: one default metric never calculable (SAX% without L6 season totals), size 10 | **1,130** | **396,283** | about 960 MB | about 170 | about 1.8 s | 222 KB |

Full-ladder breakdown at page size 10:

| Table | RT | Rows |
|---|---|---|
| `rolling_player_game_metrics` | 478 | 174k |
| `rolling_player_metric_support_payloads` | 465 | 174k |
| `players` | 120 | 45k |
| `teams` | 61 | |
| `games` | 3 | |

**What triggers the full ladder.**
- `ladder-probe-results.json` (no season totals in the fixture) shows one surface call over the 17 default 5v5 metrics reading all 465 date slots, because `sax_percentage` was never calculable.
- The season SAX% needs L6 `currentSeason.seasonTotals` (version `rolling-player-window-counts-current-season-v1`) for `expected_sh_pct` and `goals_per_60`, covering every season game (`skaterWindowAggregation.ts:427-438,667-693`).
- With those totals present, the same request costs 88 RT.
- **In production, the full ladder runs whenever any default column metric has no calculable value on the latest date and none on the 29 older dates.** A metric calculable only on an older date stops the ladder there.
- Whether that holds today is a DB question. GET 1 in §5 answers it from the response: `meta.unavailableMetrics[]` lists the metric with reason "Requested metric has no calculable values for the current filters." and its cells carry `rawValue: null`.
- The sort surface alone (points/60) resolves at date 0: 30 date slots.
- Bound per evaluated surface: 2 + Σ(pages over dates) + 3·(evaluations).

### 1.3 Goalie matrix — `GET /api/v1/contextual-rankings/goalies`

There is **no durable path** (no `entity_metric_rankings` read).

Wave 1, run concurrently (`goalieMatrix.ts:1611-1617`):
- `goalie_stats_unified`: unbounded page loop (1420-1473), about 2.9k rows.
- `wgo_goalie_stats`: ≤ 10 pages (1503-1517).
- `games`: unbounded, no `type` filter (1475-1492).
- `wgo_team_stats`: ≤ 5 pages (1519-1533).
- `teams` (1593-1600).

Wave 2 (1636-1642):
- `goalie_start_projections`: the **whole season, only to keep the latest row per goalie**, unbounded (1535-1576), about 5–8k rows (estimate).
- `players`: one `.in` call (1578-1591).

Totals:
- About 20 RT. The critical path is about 4 + 8 sequential pages. About 15k rows.
- No DB N+1.
- In memory: per-goalie league-baseline rescans, O(G·N) (1094 → 849), and per-team re-aggregation, O(T·N) (1316-1319).
- Everything is computed for the whole cohort before sort, filter and slice (1834-1862).
- The cache key includes `page`, so **each page change repeats every read**.

### 1.4 Team matrix — `GET /api/v1/contextual-rankings/teams`

No durable path. Four sequential stages (`teamMatrix.ts`):
1. `seasons` (1135-1139).
2. Latest power-ratings date (1169-1176).
3. Five concurrent reads (1382-1389):
   - power rows, about 32;
   - `teams`;
   - `wgo_team_stats`, about 3 pages;
   - `games`, about 2 pages;
   - `team_unit_toi`: latest snapshot date, then an unbounded page loop (1312-1354).
4. `nst_team_5v5`, about 3 pages (1231-1251). It waits for all of stage 3.

`team_unit_toi` probably dominates:
- It stores every even-strength combination per team-game (`teamUnitToiBuilder.ts:277-293`), but the matrix uses only forward line 1, defence pair 1 and PP1–2 (`teamMatrix.ts:965-981`).
- RT ≈ 9 + ⌈2,624·U/1000⌉, where U is unit rows per team-game. I did not query U.
- No N+1. Ranking 32 teams × 19 metrics is negligible.

### 1.5 Snapshot — `GET /api/v1/contextual-rankings/snapshot`

`snapshot.ts:166-181` is `scanPages`. It calls the **full matrix builder** for page 1, 2, … at `pageSize 50` until it finds the subject, up to **100 pages**.
- Skater: 314-326. Goalie: 232. Team: 278.
- Each page is a distinct matrix cache key, so it is a **full rebuild**: sort surface + three peer surfaces + 50-player TOI N+1.
- The request also differs from the page's own matrix request (`selected_player`, `page_size=50`), so it never reuses the table's cached response.

Bench:

| Scenario | Pages scanned | RT | Rows | Serial depth (est.) | Compute |
|---|---|---|---|---|---|
| Durable, last-page player | 15 | 864 | 264,536 | about 150 | about 0.4 s |
| Fallback common case, last-page player | 15 | 1,066 | 67,485 | about 300 | about 0.8 s |
| Fallback full ladder, last-page player | 15 | **4,516** | **1.06 M** | about 1,170 | about 13.5 s |

- Upper bound is ⌈N/50⌉ matrix builds; N = 750 gives 15.
- Goalie snapshot multiplies the about-20-RT season read by the pages scanned (2 for about 100 goalies).
- Team snapshot is 1 page.

### 1.6 Comparison — `GET /api/v1/contextual-rankings/comparison`

`comparison.ts:128-145` uses the same `scanPages` design, stopping when all wanted ids are found (100-page cap). Ids are capped at **6** on the server (`:249-251`, `:337-340`).

What the page sends:
- The page sends the selected id plus the loaded row ids, de-duplicated and **sliced to 6** by `uniqueNumbers` (`rankings.tsx:1158-1166`, used at 1181 and 1230).
- So the server cap is never exceeded. (The bench's 10-id call returns 400 with 0 RT; that only checks the server cap.)
- On default load the 6 ids are the top of page 1, so the scan stops after **one 50-row matrix build** (`COMPARISON_DEFAULT` row below).
- Ids spread across the cohort (a user-built comparison) cost up to ⌈N/50⌉ builds.

| Scenario | RT | Rows | Serial depth (est.) |
|---|---|---|---|
| COMPARISON_DEFAULT, durable (top 6 ids, found on scan page 1) | 117 | 26,484 | about 18 |
| COMPARISON_DEFAULT, fallback common case (one size-50 build, same as `matrix.fallback.page1.size50.common`) | 128 | 25,499 | about 26 |
| Six-way, ids spread across the cohort, durable | 1,113 | 343,888 | about 200 |
| Ids spread across the cohort, fallback common case | 1,066 | 67,485 | about 320 |

Notes on the bench rows:
- The page's comparison URL carries no `ranking_source`, so the server defaults to `entity_metric_rankings` (`playerMatrix.ts:388-395`), the same source as the matrix.
- The bench row `comparison.fallback.default-load(top-6 ids).common` (1,066 RT) took its ids from the *durable* ordering and scanned the *fallback* ordering, so it actually measures the spread-ids case. It is listed as such above.

### 1.7 Trending — `GET /api/v1/contextual-rankings/trending`

`trending.ts:471-485` runs four windows (season, last20, last10, last5; `:26`) concurrently. Each calls **`buildContextualRankingsSurfaces`, the rolling fallback, always**.
- They share rolling rows through the in-flight map, because the key ignores the window.
- Each window still does its own 2-RT date resolution and 3-RT metadata per evaluation.

Bench: 80 RT, 26,432 rows, serial depth about 12, compute about 0.12 s.

The bound is the same 465-slot ladder if a trending metric is never calculable. The page's default is points/60, which resolves at date 0.

### 1.8 Metadata and available-filters

- `metadata.ts:5-16` builds static JSON (`buildContextualRankingsMetadataSurface`). **0 DB reads.**
- `available-filters.ts` is static. **0 DB reads, and the page does not call it.**

### 1.9 Summary table

| Route / view | Durable RT / rows (default) | Fallback RT / rows (default) | Paging loops | N+1 | Cache / coalescing |
|---|---|---|---|---|---|
| Skater matrix | 77 / 26k (size 10); 117 (size 50) | common 88 / 25k; full ladder 1,130 / 396k (≤ 465 date slots) | entity rows by 1,000 (`entityMetricRankingReader.ts:234`); rolling by 1,000 per date (`rankingQueries.ts:356`); support by 1,000 per date | TOI per page player, ×6 waves (`playerMatrix.ts:681-751`) | 30 s from start, no eviction, no coalescing (rolling rows coalesce) |
| Goalie matrix | n/a (no durable) | about 20 / about 15k (est.) | 3 unbounded + 2 capped loops | none in DB | 30 s from start, no eviction, no coalescing |
| Team matrix | n/a | about 9 + ⌈2.6U⌉ (est.) | 4 unbounded loops | none | same |
| Snapshot (skater) | 864 / 265k (last-page player) | common 1,066 / 67k; full ladder 4,516 / 1.06M | ≤ 100 matrix pages | via each page | none of its own |
| Comparison (skater, 6) | default load 117 / 26k; spread ids 1,113 / 344k | default load common 128 / 25k; spread ids 1,066 / 67k | ≤ 100 matrix pages | via each page | none of its own |
| Trending | always fallback | 80 / 26k (common); ladder bound | rolling + support per date | none | rolling rows only |
| Metadata / available-filters | 0 | 0 | none | none | n/a |

---

## 2. Page request fan-out (`web/pages/rankings.tsx`)

All Rankings data goes through SWR keyed by URL:
- `RANKINGS_SWR_OPTIONS`, `rankings.tsx:113-124`: `keepPreviousData:false`, `dedupingInterval:30_000`, `errorRetryCount:2`.
- View endpoints use `shouldRetryOnError:false`.
- The fetcher (90-111) uses a plain `fetch` with **no `AbortController`**.
- The page has no `getServerSideProps`. URL writes go through `router.replace(..., {shallow:true})` (1546-1564).

What SWR does and does not give:
- Stale responses cannot replace newer UI, because each key holds its own data.
- **Superseded requests are never aborted.** They run to completion on the server and occupy a function instance.

**Default load (skaters, Rankings tab):**
1. `/api/v1/season` (React Query) **and** `metadata` (1343; not gated) fire in parallel.
2. Once the season resolves: **matrix** (page_size 10) **and trending** (`comparisonOpportunityRequestPath`, 1510-1513) fire in parallel.
3. When the matrix returns: **comparison** with the selected id + top rows, sliced to 6 (`rankings.tsx:1158-1166`). That is one more full 50-row matrix build on the server (§1.6).

That is 4 contextual requests + 1 season. The critical chain is season → matrix → comparison.
- So a default skater load costs **about three matrix-sized server builds**: matrix (size 10), comparison (one size-50 build), and trending (rolling).
- **Goalies tab:** season + metadata → goalies → comparison (one 50-row goalie build, which repeats the whole-season reads).
- **Teams tab:** season + metadata → teams → comparison (6 teams, a 1-page scan).

**Interactions:**

| Interaction | Requests fired | Per keystroke? | Aborted? |
|---|---|---|---|
| Type in search (`RankingsFilters.tsx:404-417`) | matrix (or goalies/teams) for each new key; comparison; snapshot if a subject is selected. The table blanks each time (`keepPreviousData:false`). Trending does not include search. | **Yes, no debounce.** Each keystroke is a full cache-missing matrix build (search is in the server cache key). Also, `normalizeRankingsFilters` trims the controlled value (`rankingUrlState.ts:415`), so typed spaces are eaten. | No |
| Team filter (free text, `RankingsFilters.tsx:721-729`) | matrix/goalies, trending (team param), comparison, snapshot | **Yes** | No |
| Select a skater row (1964-1967) | **Full matrix refetch**, because `selected_player` is in the matrix key (`rankingUrlState.ts:638-640`). Then snapshot (a page scan), then comparison, first with 1 id and then the full id list. 3–4 requests. | n/a | No |
| Select a goalie or team row | snapshot; comparison if the order changes | n/a | No |
| Season field (`RankingsFilters.tsx:426-433`) | every view endpoint, once 8 digits are present; otherwise it snaps back | yes, gated by format only | No |
| Min GP / Min TOI / Min shots inputs | matrix etc. | **Yes** | No |

Client-side work:
- Column projection is client-only (`applyMatrixDisplayFilters`, 190-221), so every column is transferred.
- The table renders up to 50 rows × the visible columns with no virtualization.
- That is moderate, not the bottleneck.

---

## 3. Existing observability (Vercel MCP, read-only)

| Query | Result |
|---|---|
| `get_runtime_logs` grouped by path, deployment `dpl_8paYEhJ2hjQqDzyGyfw35jvahbAr`, since 7d | **Refused (400)**: the Pro plan retains runtime logs for 1 day. |
| `get_runtime_logs`, production, since 23h (window **2026-11-14T02:13:51Z → 2026-11-15T01:13:51Z**), grouped by `requestPath` | Top 25 paths only. They are `/api/v1/db/run-rolling-forge-pipeline` (772) and `/stats/player/*`; no Rankings path appears. |
| Same window, full-text query `contextual-rankings`, then `rankings`, then `/rankings` grouped | **No records.** |
| `get_runtime_errors`, 7 days, routes = all 8 contextual-rankings routes + `/rankings` | **No runtime errors.** |

Deployments live in that window (production):

| Release | Deployment | Live from |
|---|---|---|
| #443 | `dpl_CCekagbkDnQSh23XmKUaUqNdoGkL` | 2026-11-13T22:45Z |
| #444 | `dpl_HDGYmYBs23Kky4WvykaVDn6qGLg2` | 2026-11-14T02:57Z |
| #445 | `dpl_A29qcrcLg6cEDZjoqCvPfnTXKsja` | 2026-11-14T15:21Z |
| #446 | `dpl_8paYEhJ2hjQqDzyGyfw35jvahbAr` | 2026-11-14T16:18Z, about 9 h of the window |

**Interpretation: inconclusive, not "zero traffic".**
- Runtime logs hold only console output.
- The Rankings handlers log nothing on success. The only log is `console.error` on non-query failures (`apiErrorResponse.ts:21`).
- `query` is a full-text match on log text, not a path filter.
- The grouped view is capped at the top 25 paths.

What this means:
- **There are no Rankings request counts, status codes or durations to report.** The only safe conclusion is that no Rankings 5xx failure was logged in this window, and none appears in the 7-day error clusters.
- Timeout cutoff: **240 s** (`maxDuration`, `web/vercel.json:4-8`). There is no evidence of timeouts.
- I did not use the CLI fallback (`vercel logs`), per scope. Request-level records (status and duration) would need it, or Observability, with Chef/TJ approval.

---

## 4. Offline micro-benchmark

Files are in this folder:
- `rankings-perf.bench.test.ts` and `ladder-probe.bench.test.ts`: the benches.
- `vitest.perf.config.mjs`: root `web/`, explicitly allowing this folder.
- `bench-results.json`, `ladder-probe-results.json`, `bench-run.log`, `ladder-probe-run.log`.

Run from `web/` with no `GIT_DIR`:
```bash
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:9 SUPABASE_SERVICE_ROLE_KEY=dead npx vitest run --config ../tasks/artifacts/rankings-acceptance-2026-11-14/perf/vitest.perf.config.mjs
```

**Fail-closed:**
- `lib/supabase/server` is mocked by absolute path.
- Unknown tables and `rpc` throw.
- `globalThis.fetch` is stubbed to throw and count, and the Supabase URL points at a dead port.
- Result: `fetchCalls = 0` and 12 of 12 tests passed. All counts come from the mock counter.

**Labels and limits:**
- These are **offline, synthetic, not production latency**.
- "Compute" is wall time minus the mock's own row generation. It runs on this laptop in Node under Vitest.
- "Serial depth" is (time at 20 ms per RT − time at 0 ms) / 20, which is approximate.
- Byte figures are `JSON.stringify` sizes of synthetic rows. Real PostgREST payloads differ, but are of the same order: 130 numeric columns, plus a JSON support payload per row.
- Composite rows are empty, as observed in the 11-08 audit.
- The synthetic support payload includes L6 `currentSeason.seasonTotals` by default (the common case). The full-ladder scenarios and `ladder-probe` omit them.
- Goalie and team matrices were not benched.

**What the bench cannot say.**
- Per-round-trip time is not knowable offline. Rolling pages are wide: 130 numeric columns × up to 1,000 rows, plus a JSON support payload per row. A single page can be over 1 MB, so a flat "ms per round trip" understates them.
- The 19.14 s measured on 11-08 is compatible with **either** fallback case. The common case is 88 RT, but those RT move about 77 MB of synthetic JSON across about 60 wide date reads. The full ladder is 1,130 RT. **The bench cannot tell which case production hit or hits now.** GET 1 in §5 tells, from `meta.unavailableMetrics`.
- Durable-path reads are narrower: 19 columns, and `tags`/`explanation_items` are arrays. But a default page still pulls about 26k of them across about 27 sequential 1,000-row pages.
- Treat any seconds figure as unknown until a deployed GET is measured.

---

## 5. Proposed deployed-GET protocol (≤ 5 sequential GETs, concurrency 1) — NOT executed

Setup:
- Host: `https://fhfhockey.com` (52 references in `web/lib` and `web/pages`).
- Season `20262027`, from the audit's request and the page's season resolution. **Confirm the active season from an existing record before running.**
- For every GET, use `curl -sS --compressed -o body.json -w '%{http_code} %{time_starttransfer} %{time_total} %{size_download}\n' -D headers.txt`, with a **90 s client timeout**.
- Record `x-vercel-cache`, `x-vercel-id`, `age` and `cache-control`.
- A client abort does **not** stop server work, so never fire a request in parallel or retry one.

Expected DB load per GET comes from the offline bench (synthetic cohort of 750). Production cohort size and data shape change these, so treat them as order-of-magnitude bounds.

1. **Default matrix (cold), exactly what the page sends:**
   `GET /api/v1/contextual-rankings/matrix?entity=skaters&season=20262027&window=season&position=all&deployment=all&strength=5v5&min_gp=10&min_toi=300&sort_metric=points_per_60&sort_direction=desc&page=1&page_size=10&ranking_source=entity_metric_rankings`
   - Expected load: durable about 77 RT / 26k rows; fallback common about 88 RT / 25k rows; fallback full ladder about 1,130 RT / 396k rows.
   - **Read from the body:**
     - `meta.rankingSource` and `meta.rankingSourceFallbackReason`: is the durable path served?
     - `meta.snapshotDate`, `meta.latestAvailableSnapshotDate` and `meta.snapshotSelectionReason`.
     - `meta.unavailableMetrics[]`. An entry with reason "Requested metric has no calculable values for the current filters." (for example `sax_percentage`) means that metric made the fallback walk the **full 465-slot ladder**. The bench confirmed this field shape.
   - Also record cold end-to-end time and compressed bytes.
2. **Immediate repeat of GET 1**, only if GET 1 finished in **under 25 s**.
   - The response cache lasts 30 s **from request start** (`playerMatrix.ts:999,1493`). After a longer GET 1 the entry has already expired, and GET 2 would be a second full build. In that case skip GET 2.
   - Expected load: 0 RT if it hits the same instance (`x-vercel-id`), otherwise the same as GET 1.
   - It separates server build time from transfer.
3. **Trending default**, which fires on every skater page load:
   `GET /api/v1/contextual-rankings/trending?entity=skaters&season=20262027&position=all&deployment=all&strength=5v5&min_gp=10&min_toi=300&sort_direction=desc&limit=25`
   - Expected load: about 80 RT / 26k rows. The points/60 sort metric resolves at date 0 (30 date slots).
   - It always uses the rolling path, so it is the cleanest production timing of that path.
4. **Snapshot of a page-1 player**, durable path only. Skip it if GET 1 reported the fallback.
   `GET /api/v1/contextual-rankings/snapshot?entity=skaters&season=20262027&window=season&position=all&deployment=all&strength=5v5&min_gp=10&min_toi=300&sort_metric=points_per_60&sort_direction=desc&ranking_source=entity_metric_rankings&player_id=<id>`
   - Use the **10th row id from GET 1**. It is found on scan page 1, so this measures the **floor**: one full 50-row matrix build with 50 TOI reads, about 117 RT / 26k rows.
   - This is also about what the default-load comparison costs. The bench gives the last-page bound: 864 RT durable.
5. **Goalie matrix default**, which has no durable path:
   `GET /api/v1/contextual-rankings/goalies?season=20262027&window=season&strength=5v5&metric=save_percentage&role=all&sort_direction=desc&min_starts=5&min_shots=100&page=1&page_size=10`
   - Expected load (code estimate, not benched): about 20 RT / about 15k rows.
   - It gives the whole-season goalie read cost.

Stop conditions, in priority order:
- **Hard stop** on any non-200, any `time_total > 60 s`, or any client timeout. Do not retry or repeat a slow request.
- If GET 1 reports the fallback with a never-calculable metric (full ladder), stop after GET 1. The heavy case is already identified, and GET 3 adds nothing.
- If GET 1 reports the fallback without one, run GET 2 (subject to the 25 s rule) and GET 3. Skip GET 4.
- If GET 1 is durable, run GET 2 through GET 5 in order.
- The protocol is complete after GET 5, or after any stop above. The Chef compares the timings against the existing E2E thresholds (skater 8 s cold / 2 s warm, goalie 18/12 s, team 12/5 s) and its own acceptance bar.

Chef asks TJ before any of this runs.

---

## 6. Cross-lane notes (not fixed here)

1. Search input trims typed spaces on each keystroke (`rankingUrlState.ts:415`), so "Connor McDavid" becomes "ConnorMcDavid". Reported by the read-only page audit; I did not check it in a browser.
2. Selecting a skater row refetches the whole matrix (`selected_player` is in the matrix key).
3. Trending ignores the durable source entirely.
4. Goalie `games` and `wgo_team_stats` reads have no `type` filter, so they include preseason and playoffs (`goalieMatrix.ts:1475-1533`). A correctness question for R05.
5. The untracked `web/lib/rankings/__acceptance__/` folder belongs to the sibling correctness session, not to this bench. This bench wrote nothing under `web/`.

---

## 7. Team matrix cost (Chef follow-up, offline, code at HEAD)

**Trigger.** The deployed `GET /api/v1/contextual-rankings/teams?season=20262027&page=1&page_size=10` took **11.28 s cold**, the slowest production sample. Goalies took 1.27 s.

**Method.** The `teamMatrix.ts` and `teamUnitToi*` files are unchanged since `89da739cb` (`git diff --stat` is empty). Everything below comes from reading code; I made no new requests.

Symbols:
- **G** = regular-season games in the window.
- **T** ≈ 2G = team-games.
- **R** = `team_unit_toi` rows in the latest snapshot within the window.

### Build sequence (`teamMatrix.ts:1365-1420`), four sequential stages

| Stage | Source | Code | Round trips | Rows | Paging |
|---|---|---|---|---|---|
| 1 | `seasons` | 1132-1139 | 1 | 1 | `maybeSingle` |
| 2 | `team_power_ratings_daily` (latest date) | 1168-1176 | 1 | 1 | `limit(1)` |
| 3a | `team_power_ratings_daily` (rows on that date) | 1181-1212 | 1 | about 32 | none (no `.range`; PostgREST cap) |
| 3b | `teams` | 1215-1218 | 1 | all teams, unfiltered | none |
| 3c | `wgo_team_stats` | 1253-1287 | ⌈T/1000⌉ | T (about 460 now; 2,624 for a full season) | **unbounded** `for (;;)` at 1258 |
| 3d | `games` (type 2) | 1289-1310 | ⌈G/1000⌉ | G (about 230 now; 1,312 full) | **unbounded** at 1294 |
| 3e | `team_unit_toi` latest `snapshot_date` | 1312-1325 | 1 | 1 | `limit(1)` |
| 3e | `team_unit_toi` rows | 1327-1354 | **⌈R/1000⌉, sequential** | **R** | **unbounded** at 1337 |
| 4 | `nst_team_5v5` | 1231-1251 | ⌈T/1000⌉ | about T | **unbounded** at 1236; waits for all of stage 3 (1414-1418) although it only needs `powerRows` |

All five stage-3 reads run in one `Promise.all` (1382-1389). So the stage costs as much as its slowest branch, and that branch is `team_unit_toi`: one date lookup, then R/1000 pages one after another.

### Why `team_unit_toi` dominates

- **The latest snapshot holds the whole season.** Nightly upkeep "add[s] newly completed games to the season's CURRENT snapshot" and never starts a new one (`teamUnitToiNightly.ts:1-8`).
  - So R ≈ every current-season row, about **34.6k** per the 11-08 audit, and growing.
  - If production holds more than one snapshot, R is the latest snapshot's share of that. I did not check this.
- **Read size today:** about **35–36 sequential round trips** of 1,000 rows × 11 columns, including the `coverage_warnings` JSON (`TEAM_UNIT_TOI_SELECT`, 322-323).
- **The other sources together:** about 6 round trips and about 1.5k rows.
- **Estimated totals for one cold request now:**
  - about **42 round trips**;
  - about **36k rows**, of which about 96% are `team_unit_toi`;
  - a critical path of about **39 sequential round trips** (stage 1 + stage 2 + 1 + about 35 + stage 4).
- **Most of those rows are thrown away.** `aggregateTeamUnitToiRows` uses only:
  - `forward_line` with `unit_number = 1`;
  - `defense_pair` with `unit_number = 1`;
  - `power_play` rows: all of them for coverage status and pool seconds, units ≤ 2 for the share (`teamMatrix.ts:958-981`).
  - The builder stores **every** even-strength combination with TOI above 0, numbered by TOI (`teamUnitToiBuilder.ts:277-293`). Taking the 11-08 audit's row count over the games played by then, that is about 90 rows per team-game, of which about 5 are used.
- **Offset paging probably re-sorts the whole set for every page (inference).**
  - The query orders by `game_date DESC, id ASC` (1342-1343).
  - The only matching index is `idx_team_unit_toi_latest (season_id, snapshot_date DESC, unit_type, team_id, unit_number)` (`supabase/migrations/20260716112908_production_schema_baseline.sql:35992`), which does not provide that order.
  - So each `range(from, to)` likely makes Postgres collect and sort all R matching rows, then skip `from` rows. Database work then grows about pages × R, not R.
  - I have no `EXPLAIN` for this; it is offline inference.
- **Fit with 11.28 s (inference):** 11.28 s over about 39 sequential round trips is about 290 ms each. That is plausible for 1,000-row JSON pages that each repeat a sort of about 34.6k rows. The bench cannot confirm it.

The response cache, as in §1.1: 30 s from request start, keyed by the whole request, no eviction, no coalescing (321-327, 1368-1371, 1710-1713). Every page, sort or search change is a full rebuild.

### Smallest reader-side change (proposal; not edited)

Add one filter to the page query in `fetchTeamUnitToiRows` (`teamMatrix.ts:1338-1346`):

```ts
.or("unit_type.eq.power_play,unit_number.eq.1")
```

Why it preserves results exactly:
- Even-strength units are numbered 1..k by TOI within each team-game and unit type (`teamUnitToiBuilder.ts:279-293`). So whenever a team-game has any forward-line or defence-pair rows, it has unit 1 of that type.
- All `power_play` rows are kept, so pool seconds, PP1+PP2 seconds and every PP coverage status are unchanged.
- The set of team-games, and therefore `gamesCount` and the coverage denominators, is unchanged.
- The only rows dropped are those `aggregateTeamUnitToiRows` ignores. Their `coverage_warnings` are never read: warnings are collected only inside the three `if` branches.

Expected effect:
- R falls from about 90 to about 4–5 rows per team-game: about **2k rows and 2–3 pages** today instead of about 35, and about 12–13k rows at full season.
- The filter also lines up with `idx_team_unit_toi_latest` (`unit_type`, `unit_number`), so each page has a far smaller set to sort.

Test:
- Extend the nearest test, `teamMatrix.test.ts`, which already fixtures `team_unit_toi` rows with `unit_number` 1 and 2 (around 250-305 and 426-451).
- Assert that the query carries the filter, and that the aggregates are identical with and without non-top rows present.

Optional second, smaller, step: start the `nst_team_5v5` read as soon as `powerRows` resolves, inside stage 3, instead of after all five reads (1414-1418). That saves about one sequential round trip. It is not needed for the main gain.

Not proposed here: a server-side aggregate or RPC, or a new index. Those are larger changes; the filter alone removes about 90% of the dominant read.

### 7.1 Addendum: the statement timeout (Chef evidence, 2026-11-14)

**Evidence relayed by the Chef** (I did not observe it):
- `GET /api/v1/contextual-rankings/teams?season=20252026&metric=off_rating&sort_direction=desc&min_gp=5&page=1&page_size=10` returned 500 after 8.4 s with "Unable to load team unit-TOI rows: canceling statement due to statement timeout".
- A `group by snapshot_date` over `season_id=20262027 and snapshot_date >= '2026-11-01'` timed out at 5 s.
- The same grouping filtered by `game_date` returned fast.

**The query that times out.** It is the page query in `fetchTeamUnitToiRows`. That message is thrown only at `teamMatrix.ts:1348`. The snapshot-date lookup at 1312-1323 throws "…unit-TOI snapshot…" instead. Its shape (1338-1346), repeated with a growing offset:

```sql
select team_id,game_id,game_date,snapshot_date,unit_type,unit_number,unit_share,
       unit_toi_seconds,team_unit_pool_toi_seconds,coverage_status,coverage_warnings
from team_unit_toi
where season_id = $season and snapshot_date = $latest
  and game_date >= $seasonStart and game_date <= $latestPowerDate
order by game_date desc, id asc
offset $k*1000 limit 1000;
```

The log does not say which page timed out.

**Why it is slow (inference; no EXPLAIN available offline).**
- **Indexes exist in the schema.** The schema defines three indexes that lead with `(season_id, snapshot_date)`:
  - `idx_team_unit_toi_latest (season_id, snapshot_date DESC, unit_type, team_id, unit_number)`;
  - `idx_team_unit_toi_share`;
  - the `team_unit_toi_unique_context` unique key.

  Sources: `web/supabase/migrations/20260622150500_create_team_unit_toi.sql:47-72`, and the production baseline `supabase/migrations/20260716112908_production_schema_baseline.sql:35985-35999,32771-32775`. So "no index on snapshot_date" is unlikely unless production differs from the baseline dump.
- **The likely problem is heap access, not a missing index.**
  - Nothing indexes `game_date` or `(game_date, id)`. So every page must fetch **every row of the snapshot** from the heap through the snapshot index, apply the `game_date` filter, sort by `game_date desc, id`, and discard `offset` rows.
  - Nightly upkeep appends to the current snapshot (`teamUnitToiNightly.ts:1-8`), so a snapshot's rows are scattered across the heap and those fetches are random I/O.
  - That fits the Chef's evidence. A snapshot-range scan through the index is IOPS-bound and can exceed 5 s. A `game_date`-filtered query takes a different plan, probably a sequential or bitmap scan, and is fast.
- **Why 20252026 fails outright.** Its latest snapshot holds a full season: about 2,624 team-games × about 90 rows, roughly 236k rows if it matches the current season's density. That is about 236 pages, each re-reading and re-sorting about 236k rows. The current season (about 35k rows) is the same problem at about one-seventh the size, which fits the 11.28 s.
- **Not tested:**
  - whether production actually has these indexes;
  - row counts per (season, snapshot);
  - table bloat, dead tuples and the visibility map;
  - the role's `statement_timeout`.

  All need read-only catalog and `EXPLAIN` queries, which go in TJ's read packet.

**Smallest reader-side change (no schema): add the unit filter from §7 to that query.**

```ts
.or("unit_type.eq.power_play,unit_number.eq.1")
```

- **Same results:** this keeps exactly the rows the aggregator uses (§7 gives the argument).
- **Fits the existing index:** `unit_type` and `unit_number` are both columns of `idx_team_unit_toi_latest`. So Postgres can reject non-top rows inside the index scan, without fetching them from the heap. Heap fetches drop about 18×, and the rows to sort drop the same.
- **Effect on the offset multiplier:**
  - current season: about 2k rows and 2–3 pages instead of about 35;
  - 20252026: about 13k rows and about 13 pages instead of about 236.
  - Total fetched-row work falls by roughly two orders of magnitude for the current season and more for a full season.
- **Not enough on its own:**
  - Narrowing by `game_date`: the season matrix needs the whole season window.
  - Filtering by team: all 32 teams are ranked.
  - Selecting fewer columns: all 11 selected columns are used, and the wide columns (`player_ids`, `metadata`) are already not selected.

**Optional second reader-side step**, if a full past season is still slow after the filter:
- Remove the growing-offset multiplier by reading **per team**: 32 small queries, about 400 filtered rows each for a full season, run with bounded concurrency.
- Each fits in one page, so each row is fetched once.
- The aggregator does not depend on row order: warnings are de-duplicated and sorted, statuses are set-like, and per-game fields come from a single game.
- This is a larger diff than the filter. Measure the filter first.

**Is an index needed?**
- **Not for the filter fix.** It uses the existing `idx_team_unit_toi_latest`, provided production really has it. Confirm with a read-only `pg_indexes` check plus `EXPLAIN` of the filtered query, both in TJ's packet.
- If that check finds the index missing, recreating it is a schema change for TJ.
- An index on `(season_id, snapshot_date, game_date DESC, id)` would fix the unfiltered ORDER BY + OFFSET without code changes. It is still schema (TJ), and it is unnecessary if the filter ships.
