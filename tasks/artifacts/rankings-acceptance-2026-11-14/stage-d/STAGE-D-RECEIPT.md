# Stage D — deployed timing, https://fhfhockey.com @ 89da739cb (dpl_8paYEhJ2hjQqDzyGyfw35jvahbAr), 2026-11-15 01:19:54–01:20:19 UTC
5 sequential GETs, concurrency 1, curl from TJ's Mac, 25 s cap; stop rule (>20 s or 5xx) not triggered. Raw: resp-d*.json, hdr-d*.txt, timings.log.
| # | route | HTTP | total s | bytes | x-vercel-cache | source / snapshot | total rows |
|---|---|---|---|---|---|---|---|
| d1 | skater matrix (same URL as 11-08 audit, page_size 10) | 200 | 3.32 | 211,095 | MISS | entity_metric_rankings / 11-11 | 740 |
| d2 | identical repeat | 200 | 0.24 | 211,095 | MISS | same (served from in-process 30 s cache) | 740 |
| d3 | goalies season | 200 | 1.27 | 38,462 | MISS | goalie_rankings_v5 / 11-13 | 76 |
| d4 | teams | 200 | 11.28 | 57,894 | MISS | team_rankings_v3 / power 11-14, style 11-13 (row-level 11-12) | 32 |
| d5 | snapshot McDavid + team=EDM | 200 | 9.00 | 17,241 | MISS | fallback rolling / 11-13 | — |
Single samples, not percentiles. d1 vs the 11-08 audit: 19.14 s → 3.32 s, because the durable 11-11 snapshot now exists. A cold function start is not separated from query time. Browser render was not measured.
