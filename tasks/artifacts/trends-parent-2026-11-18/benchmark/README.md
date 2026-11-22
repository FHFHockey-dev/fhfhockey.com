# Homepage Transaction Trends benchmark

Run from the repository root using the installed Node version in `web/.nvmrc`. PostgreSQL 15 and a locally installed Chromium are required. Override `TREND_PG_BIN` or `CHROME_PATH` to select local binaries.

```sh
TREND_LOCAL_PG=1 node tasks/artifacts/trends-parent-2026-11-18/benchmark/run.cjs before 5
TREND_LOCAL_PG=1 node tasks/artifacts/trends-parent-2026-11-18/benchmark/run.cjs after 5
```

The commands write `before.json` and `after.json`. The candidate command checks every measured API payload against the original. Set `RECEIPT` to redirect a result file. The original application modules come from Git object `789713fb5bc12a2bb1c62ab6bea676d4c30cf6a6` using `git show`. The candidate reads the current checkout. The benchmark creates and removes a temporary PostgreSQL cluster and bundle. PostgreSQL listens on a private Unix socket. Browser and server fetches are restricted to a loopback HTTP server.

## What is measured

- The actual ownership-trends handler uses Supabase JS. A local HTTP adapter translates its emitted PostgREST requests into parameterized SQL against the seeded PG15 database, including the original normalized ownership view and candidate migration. The identity-map relation is an indexed fixture table. SQL service timing covers request-body receipt, SQL execution, PostgreSQL JSON construction and driver decoding. Stage byte counts measure uncompressed JSON response bodies sent by the HTTP adapter. They exclude request bodies, URLs, headers and TLS.
- Direct HTTP timings start before the API GET and end when the entire body is available. Handler timings end at JSON serialization before the socket write. Cold samples clear the handler's application cache. The database is initialized and analyzed before the first observation, and OS and PostgreSQL page caches are allowed to stay warm. Module loading, compilation, provider transport and platform cold starts are outside this measurement.
- Browser runs load the real `web/pages/index.tsx`, `ClientOnly`, Transaction Trends, status panel, sparkline, and styles in production-mode React. The browser receives predetermined homepage props. Unrelated home modules, Next navigation wrappers and external data sources are isolated. Each repetition starts a fresh Chromium context and clears the handler cache. The browser timer starts at navigation start or the captured control click and ends on the first animation frame with the correct displayed rows and pager in both visible desktop tables. It checks names, links, row order, rank, signed movement, latest value, requested window, totals, and page. It excludes Playwright click preparation.
- The sequence is default ownership (3D, all), D, 5D, next page, previous page, then a fresh offseason homepage with Draft Ranker enabled and a click on the Transaction Trends tab for ADP. The position, window and page requests retain the server cache. Previous returns to a visited client request. The ADP dataset has a distinct cache key. Frequency and bytes under `browser.requests` refer to the Trends endpoint and downstream reads, excluding the fixture document and bundle. Public-host conditions, unrelated homepage SSR, Next hydration, CDN, and vendor network latency are outside this benchmark.
- API-only scenarios additionally cover a missing-season fallback and a two-ID lookup with one resolvable player. All fields in each response participate in a SHA-256 hash over canonical JSON with sorted object keys and original array order. The candidate must preserve the original field digest after removing only the additive per-player movement dates. The harness independently derives both observation dates from the fixture and verifies them alongside latest and previous values, including ADP's different date anchor.
- `fixture.cjs` creates 4,438 player-season rows, 2,373 mappings, 74,332 normalized ownership observations and 4,410 ADP observations. Histories include mapped and unmapped movers, flat and missing series, ties, short series, and 190-observation histories across two seasons. At the pinned time of 2026-11-18 12:00 UTC, the 3D ownership result has 89 risers and 200 fallers. Source data ends November 17. These are synthetic distributions and dates.

## Fresh-process first request

```sh
node tasks/artifacts/trends-parent-2026-11-18/benchmark/fresh.cjs
```

Run this after generating `before.json` and `after.json`. It starts ten isolated Node processes in five pairs, alternating which version runs first. Each child seeds a new PostgreSQL cluster, restarts PostgreSQL to empty shared buffers, starts a new Chromium process with a fresh context, and navigates to the real homepage. That browser initiates the first Trends request. Both handler and browser times come from that same request. Checked-in fixture expectations supply the expected visible values before navigation. Each full response hash must also match its corresponding multi-sample receipt. `fresh.json` records per-pair results and input hashes. Compilation, initial Node startup and cluster preparation occur before navigation. Filesystem caches remain under OS control.

## Local measurements

Each cell gives the median in milliseconds and the observed minimum–maximum across five samples. The desktop interaction sequence retained warm PostgreSQL buffers and cleared application caches at the start of each repetition.

| Desktop browser time to correct rows | Original | Candidate |
| --- | ---: | ---: |
| Default ownership navigation | 226.2 (208.7–229.6) | 130.2 (121.7–136.1) |
| Select D | 45.1 (44.0–55.3) | 31.6 (30.7–32.8) |
| Select 5D | 15.5 (14.6–16.4) | 16.4 (16.0–17.1) |
| Next page | 16.1 (15.8–16.2) | 16.3 (15.5–16.6) |
| Previous, client-cache hit | 7.0 (6.7–8.0) | 7.1 (6.9–7.4) |
| Open offseason ADP tab | 58.5 (56.9–59.3) | 58.8 (58.4–59.2) |

| Default read, application cache empty | Original | Candidate |
| --- | ---: | ---: |
| HTTP until full body, ms | 150.81 (148.64–208.96) | 74.91 (73.48–111.54) |
| Handler until serialized response, ms | 150.43 (148.29–197.86) | 74.35 (73.15–102.09) |
| Key-page calls / returned bytes | 5 / 128,707 | 0 / 0 |
| Ownership page calls / returned bytes | 9 / 3,692,566 | 5 / 2,668,581 |
| Mapping calls / returned bytes | 9 / 142,389 | 9 / 142,389 |
| Total source calls / returned bytes | 23 / 3,963,662 | 14 / 2,810,970 |
| API response bytes | 14,072 | 15,352 |

The candidate's five combined history-and-metadata queries took 41.14 ms in aggregate at the median. The original history reads took 104.01 ms plus 5.25 ms for separate key pages. The new API response includes two comparison-date strings per displayed player. All seven original-field payload hashes match. The default, filtered, alternate window, second page, ADP, fallback and selected-player receipts include their timing samples, source bytes and query counts.

Changing D, 5D and page generated one API call per action and zero database reads in both versions. Returning to the previously visited page generated zero API calls. Opening the previously unused ADP dataset generated 19 data reads in each version.

A separate delayed-response check held a real position request, confirmed that loading presented no stale rows, source date, counts or stale notice, switched back to cached D, then delivered the late response. The 20 D rows persisted. At 390 px, the mobile direction toggle displayed ten fallers, five of them marked as unlinked Yahoo listings. The final column ended at 368 px inside the section's 382 px right edge. The date was visible and fresh at 12:00 UTC. At 22:00 UTC the module correctly displayed the 18-hour stale warning for November 17 end-of-day. The two desktop receipts recorded zero attempted external page requests and zero uncaught page errors.

| First request from a fresh homepage, same observation for both timers | Original | Candidate |
| --- | ---: | ---: |
| Navigation to 20 usable rows, ms | 247.8 (243.8–250.7) | 163.7 (161.5–165.7) |
| API handler for that navigation, ms | 193.66 (189.23–203.11) | 113.94 (112.38–114.93) |

The fresh-process candidate reduced median time to usable rows by 84.1 ms (34%) on this machine and seeded dataset. Each process made one Trends API call, and its full response matched the corresponding original or candidate reference digest.
