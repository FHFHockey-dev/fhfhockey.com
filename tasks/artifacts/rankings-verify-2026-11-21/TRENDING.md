# Trending in production: speed and parity · Nov 21 2026

**No regression.** Production serves the released Trending code. Its live output matches the pre-optimization parent exactly on today's data, and the optimized path is faster cold and unchanged warm.

## What is deployed

`fhfhockey.com` → `dpl_9YQAY1gpwwe8XBa1qWDExzaGzevP` (READY, production) → **`f47905d28718f6910d7acfa1471517c0235775de`**. Source: Vercel `get_alias` and `list_deployments`; GitHub's deployment entry for the same SHA is `success` at Nov 20 19:07 UTC.

- At that SHA, `rankingQueries.ts` and `rollingWindowCountSupportReader.ts` are blobs `cf1b5731` / `79cb162d`. These are the measured Nov 18 candidate blobs, released in `50dea27b84`.
- esbuild import closures of the `trending`, `matrix` and `comparison` routes and `pages/rankings.tsx` include none of the 113 web source files changed between `50dea27b84` and `f47905d28`.
- Master did change the rolling writer (`fetchRollingPlayerAverages.ts`), which changes Trending's source rows, not its reader.

## Live production (6 approved GETs, sequential)

| # | Request (UTC) | Status | Total s | TTFB s | Bytes | `x-vercel-cache` |
|---|---|---|---:|---:|---:|---|
| 1 | matrix 17:33:25 | 200 | 3.89 | 3.82 | 224,766 | MISS |
| 2 | Trending cold 17:33:29 | 200 | **8.10** | 8.06 | 88,020 | MISS |
| 3 | Trending warm (+0 s) | 200 | **0.83** | 0.79 | 88,020 | MISS |
| 4 | comparison 17:33:38 | 200 | 3.82 | 3.77 | 108,344 | MISS |
| 5 | Trending cold after 90 s idle | 200 | **5.44** | 5.40 | 88,020 | MISS |
| 6 | Trending warm (+0 s) | 200 | **0.67** | 0.63 | 88,020 | MISS |

- Responses use `cache-control: public, max-age=0, must-revalidate`, so every sample is server work.
- "Warm" means a repeat request inside the 30 s in-process cache (`ROLLING_SNAPSHOT_CACHE_TTL_MS`, reader date/marker caches).
- "Cold" means the first request, or one made after more than 30 s idle. Fluid Compute may still reuse a warm instance, so the 90 s idle sample can include warm connections.
- All four Trending bodies are identical apart from `generatedAt` (stable SHA-256 prefix `f61671584837c68a`).

Against the retained production samples (single, unmatched: different data, time and instance):

| Sample | Trending cold | Matrix | Comparison |
|---|---:|---:|---:|
| Nov 15, pre-optimization deployed | 19.86 s | — | — |
| Nov 18, right after release | 10.03 s | 8.50 s | 6.28 s |
| **Nov 21, this check** | **8.10 s / 5.44 s** | 3.89 s | 3.82 s |

## Matched before/after on production data (local, 3 interleaved rounds)

A production before/after would require deploying the parent, which is out of scope. Instead, the parent `83750b4abd` and deployed `f47905d28` Trending handlers ran from clean `git archive` exports on this Mac, against production Supabase (read-only). Each round ran one fresh Node process per version, in the order P→D, D→P, P→D. Each process made one cold call (fresh caches) and an immediate warm call. Both used the same live query, with the as-of date defaulting to today (UTC 2026-11-21, the same day as the live GETs). A fetch wrapper counted PostgREST requests and response bytes. Actual load: 585 requests and about 404 MB decoded, above the approved estimate of ~550 requests / ≤300 MB (the parent's cold run alone pulled 95.7 MB).

| Version | Cold ms (r1, r2, r3) | Cold median | Warm median | Cold reads | Cold response bytes | Warm reads / bytes |
|---|---|---:|---:|---:|---:|---:|
| Parent 83750b4 | 11,006 · 8,816 · 7,815 | 8,816 | 567 | 78 | 95,688,805 | 20 / 454,708 |
| Deployed f47905d | 6,275 · 6,096 · 6,179 | **6,179** | 503 | 77 | **38,190,613 (−60.1%)** | 20 / 454,708 |

Cold is about **22% faster best-vs-best (7,815 → 6,096 ms) and 30% by median**. With n = 3, the parent ran first in round 1, and its samples fell 11.0 → 8.8 → 7.8 s, so treat the speed figure as approximate. The −60% bytes figure is deterministic. Timings include Mac→us-east-1 network latency, so they show the relative change, not Vercel's absolute times. Byte and read counts are deterministic and were identical in every round.

## Parity

- The stable payload (all 25 rows plus meta, minus `generatedAt`) hashed the same in all 12 local calls (6 cold, 6 warm, both versions) and in the live production response. Parent rows deep-equal live rows, including order.
- All four Trending windows report **2026-11-19** (`snapshotDates`, `latestAvailableSnapshotDate`).
- Visible signals: `replay.mjs` rendered the deployed page code in Chromium from the captured live responses, with zero production requests (10 external NHL headshot requests were blocked by design). Results:
  - 25 Trending rows in API order, with names matching.
  - Every signal explanation (36 badges) equals the API evidence, capped at 3 per row.
  - The "Dataset snapshot" label read **Nov 14, 2026**.
  - All six default comparison subjects (MacKinnon, Hagel, Dubois, Jarvis, McDavid, Anderson) are outside the Trending top 25. Each correctly shows "No live opportunity-change signal in the current trending sample", the same state as on Nov 18. [Receipt](replay-receipt.json)

## Still unverified

- Production browser-visible interaction timing: the Chromium replay was local and untimed.
- A production `EXPLAIN` of the support queries.
- Absolute Vercel cold-start behaviour across instances: n = 2 cold samples.

## Observation, not a regression

The default Rankings view pairs the **Nov 14** Rankings/composite cutoff with **Nov 19** Trending signals in the comparison drawer. This happens because the pair is stale (see [CUTOFF.md](CUTOFF.md)). It will resolve once the pair catches up.

## Reproduce

- Live GETs: `live/requests.jsonl`, response bodies and headers in `live/`.
- Local rounds: `local/round*.json`. The runner exported each SHA's `web/lib` + routes, bundled `runner.ts` with esbuild, and ran it with `node --env-file=web/.env.local`.
- Replay: `node tasks/artifacts/rankings-verify-2026-11-21/replay.mjs` from the repository root.
