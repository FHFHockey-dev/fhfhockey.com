# Baseline and reproducible measurements, 2026-10-17

## Repository state at audit start

| Item | Value |
| --- | --- |
| Checkout / branch / HEAD | `/Users/tim/Code/fhfhockey.com`, `octoberBranch`, `ceceb407a29b45f2e5b0c090ecfcff0c27e15d4c` ("Add v1 daily FORGE pipeline driver") |
| Uncommitted changes from other sessions (not touched) | M `web/__tests__/fixtures/consumerGameRevision.ts`, `web/__tests__/pages/api/v1/start-chart.test.ts`, `web/lib/in-season/workspaceSchema.ts`, `web/lib/player-forecasts/currentSeasonSogContribution.ts`, `web/lib/rosterScheduleOptimizer/planningReproducibility.test.ts`; untracked `tasks/artifacts/forge-continuation-2026-10-17/`, `tasks/master-reconciliation-2026-10-17/` |
| Toolchain | Node 22.11.0 (`web/.nvmrc` 22.11.0), npm 10.9.0, Next 15.5.22, React ^18.3.1, TypeScript 5.7.3, Vitest ^3.2.6, Playwright ^1.60.0, esbuild 0.25.12 (vitest dependency) |
| Manifest | `web/package.json`: 80 dependencies, 33 devDependencies, 72 scripts. `web/package-lock.json`: 817,718 bytes. No root manifest. |
| Machine | Apple M4 Max, 16 cores, 64 GB RAM, macOS (Darwin 27.0.0) |
| Running processes | TJ's `next dev -p 3000` (PID 20003/20004, up about 2 days, writes `web/.next`), plus VS Code, Codex and Claude helpers. No tsc, vitest, Playwright or build process was running when the build started. |
| Surface counts | 81 non-API page files (79 routes in the build manifest), 355 API route files (94 wrapped in `withCronJobAudit`), 799 non-test `lib` files, 522 `lib` test files, 240 `__tests__` files, 381 component files, 64 hooks, 21 E2E specs, 126 top-level scripts, 83 `supabase/migrations` and 72 root `migrations/`. `webhooks/` (named in AGENTS.md) does not exist in this checkout. |
| Schedulers | 27 Vercel crons (`web/vercel.json`); pg_cron per the 2026-10-04 snapshot (`tasks/TASKS/cron-operations/cron-schedule.md`: 69 jobs, 59 active) with selected rows rechecked live (data/db-readonly-reads.md, R5); no GitHub scheduled workflows. |

## M1. Client JavaScript per route

**One isolated compile-only build** produced this measurement. Compile mode skips type checking, page-data collection and prerendering, so no page module executed and no production request was made. The webpack cache under `.next-playwright/cache` was **warm** from a 2026-10-15 run. The build ran once: wall 59.46 s, user 86.88 s, max RSS 3.61 GB, exit 0. The tracked `next-env.d.ts` and `tsconfig.json` were checksummed before and after and are unchanged. Side effect: ignored `web/.next-playwright` grew from 107 MB to about 1.06 GiB, which is regenerable (see CLEANUP-MANIFEST).

```bash
cd /Users/tim/Code/fhfhockey.com/web && PLAYWRIGHT_ISOLATED_NEXT=1 PRESERVE_NEXT_DIST=1 NEXT_TELEMETRY_DISABLED=1 NODE_OPTIONS=--max-old-space-size=6144 /usr/bin/time -l ./node_modules/.bin/next build --experimental-build-mode=compile --no-lint
```

```bash
python3 -I /Users/tim/Code/fhfhockey.com/tasks/artifacts/independent-audit-2026-10-17/data/first_load.py /Users/tim/Code/fhfhockey.com/web/.next-playwright
```

Guards: never use the default `.next` (because `cleanDistDir` would wipe TJ's dev output) or `.next-player-forecasts`. Use `PRESERVE_NEXT_DIST=1` so existing files are not removed. Do not run `npm run build`, whose `postbuild` runs `next-sitemap` and writes into `public/`. Do not run during 2026-10-20 07:00–13:00 ET.

| Metric | Value |
| --- | ---: |
| Shared JS on every page (webpack runtime + framework 44.8 + main 39.7 + `_app` 176 kB gz) | **263.2 kB gz** (Next prints 293 kB including 28.9 kB CSS) |
| `_app` chunk alone | 588,539 bytes raw / 176 kB gz |
| Page routes | 79 |
| Median First Load JS | 305 kB gz |
| Routes ≥ 400 kB / ≥ 500 kB | 14 / 4 |

Top routes (full list in `data/first-load-by-route.tsv`):

| Route | First Load JS (gz kB) | Route-only JS (gz kB / raw kB) |
| --- | ---: | ---: |
| /draft-dashboard | 648 | 385 / 1,284 |
| /wigoCharts | 540 | 276 / 915 |
| /stats/team/[teamAbbreviation] | 504 | 240 / 864 |
| /trends | 502 | 239 / 814 |
| / (homepage) | 461 | 198 / **1,243** |
| /projections | 447 | 183 / 610 |
| /drm | 434 | 170 / 618 |
| /start-chart | 430 | 167 / 596 |
| /roster-schedule-optimizer | 393 | 130 / 461 |
| /game-grid/[mode] | 395 | 132 / 449 |

Library signatures found in route chunks:

- Homepage: a **moment-timezone zone-data chunk of 725 kB raw / 33 kB gz** and a 59 kB raw / 19 kB gz moment core chunk.
- A framer-motion chunk of 112 kB raw / 36 kB gz on the homepage. It is also used by `/draft-dashboard` and `/trends` and is not shared.
- The chart.js chunk (52 kB gz) is shared by 8 routes. The recharts and d3 chunk (73 kB gz) is shared by 8 routes.

## M2. What `_app` contains, and the measured effect of scoping two providers

esbuild bundles `web/pages/_app.tsx` (minified, browser, ESM) with react, react-dom and next marked external. esbuild is a different bundler from Next's webpack, so the absolute size is approximate: 543,193 bytes raw against Next's 588,539. The deltas are deterministic, since each variant was run once and the outputs are byte-stable. Attribution is in `data/app-chunk-attribution.txt`.

```bash
/Users/tim/Code/fhfhockey.com/tasks/artifacts/independent-audit-2026-10-17/data/app-deltas.sh /Users/tim/Code/fhfhockey.com/web /private/tmp/fhfh-app-deltas
```

| Variant | raw bytes | gzip bytes | Δ gzip |
| --- | ---: | ---: | ---: |
| current `_app` | 543,193 | 160,773 | — |
| without @apollo/client and graphql | 382,070 | 111,887 | −48.9 kB |
| without notistack (which pulls @mui/material and @emotion) | 414,464 | 117,452 | −43.3 kB |
| without both | 253,114 | 69,956 | −90.8 kB |
| **Patch 01 applied to a scratch copy** | **252,599** | **69,671** | **−91.1 kB (−290.6 kB raw)** |

Signature check: the Next `_app` chunk contains `MuiCollapse` ×12, `InMemoryCache` ×4 and `go.apollo.dev` ×1. The patched esbuild bundle contains 0 of each. supabase-js (auth, realtime, storage, postgrest; about 165 kB raw) stays in `_app` because every page uses auth.

## M3. Serverless function weight (output file traces)

```bash
python3 -I /Users/tim/Code/fhfhockey.com/tasks/artifacts/independent-audit-2026-10-17/data/function_traces.py /Users/tim/Code/fhfhockey.com/web/.next-playwright/server
```

There are 437 traces (355 API routes plus pages). The median traced size is **6.9 MB**, and no route reaches 50 MB. The largest is `api/internal/sync-yahoo-players-to-sheet` at 40.1 MB, 32 MB of it googleapis. Only `api/v1/db/cron-report` traces a file under `tasks/`, the intended `cron-schedule.md`. Output is in `data/api-trace-sizes.txt`.

## M4. Committed repository weight

```bash
cd /Users/tim/Code/fhfhockey.com && git ls-files -z | xargs -0 stat -f '%z %N' > /private/tmp/fhfh-tracked-sizes.txt
```

| Path | Tracked files | Bytes |
| --- | ---: | ---: |
| whole tip | 10,767 | 718,357,361 |
| tasks/ | 6,341 | 340,660,468 |
| tasks/artifacts/ | 2,438 | 188,693,189 |
| tasks/ifttt-integration-2026-10-16/ | 3,411 | 126,760,012 |
| web/ | 3,666 | 207,633,435 (113.7 MB of it in `web/scripts/output/`) |
| docs/ | 105 | 86,580,764 |
| output/ | 244 | 77,937,781 (47.7 MB of it in 17 Playwright `trace.zip` files) |
| `.git` | — | 1.2 GB on disk (packs 1.03 GiB; 6,354 prune-packable loose objects, 39.5 MiB) |

## M5. Scheduled work and audit-table cost (production, read-only)

Six bounded reads are recorded with their SQL in `data/db-readonly-reads.md`. Headline numbers:

- `cron_job_audit` has **0 indexes**, 189,160 live rows and 320.8 MB total. It has had **0 deletes** since 2026-10-05.
- It took **≈6,170 inserts/day** (78,844 in 12.78 days) and **≈84 full sequential scans/day** (1,078 scans, 128.2 M tuples read).
- In a 2% block sample of the last 7 days, about **95%** of rows came from `update-line-sources` and `update-lines-ccc`. The sampled recent runs were idle (`teamsLoaded: 0`, 133–176 ms).
- pg_cron `386 forecast-h0` (11:38 UTC) is active, and Vercel also runs the same window at 11:45 UTC. `234 daily-cron-report` is **inactive**.
- The sustainability F/D population on 2026-10-17 is ≤ 400. Vercel's window-z and score jobs cover 750 ids, and trend-bands covers 1,000.

## Not measured

- Browser timings: LCP, INP, CLS, request waterfalls and real network bytes.
- API latency and response sizes.
- Vercel invocation counts, durations and billing.
- Per-query plans.
- The full Vitest suite.
- The page audit's accessibility findings.

These need either a browser session against a local production-like server or Vercel usage data. Neither was used here: no dev server or browser was started, and TJ's port 3000 server was not exercised.
