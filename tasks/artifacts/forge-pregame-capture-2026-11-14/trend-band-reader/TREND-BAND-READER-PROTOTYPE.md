# Trend-band reader prototype (offline), 2026-11-15

**Status:** offline only. Nothing has been applied, deployed or wired in.
- `skater-queries.ts` and `skater-stage.ts` are unedited and wait on Astra/Scout (mailbox `cb42e6c12`).
- No production write, index, ANALYZE, timeout change or capture retry.
- Read-only actions taken: two Supabase edge-log queries (section 1).

## 1. The old endpoint's effective row cap
- **Production edge logs** (read-only, the 0326 window):
  - At 14:40:24Z the reader's GET sent `limit=12000` and got `Content-Range: 0-999/*` (origin 2,553 ms).
  - Team 2's identical GET ran 8,050 ms and returned 500 (57014).
  - So `max_rows = 1000` in production too.
- **Effect:** the old reader only ever saw the newest 1,000 rows by `snapshot_date`. Rows tied on the boundary date are cut in an unspecified order, because the GET orders by date only.
- **Retained run** (`tasks/artifacts/goalie-h1-2026-11-13/READBACK.json`, 2 teams):
  - `trend_adjustment_rows_eligible = 2000`, cap-saturated;
  - 15 players with rows and 21 missing.

## 2. Prototype
- **Candidate SQL:** `sql/forge_latest_trend_bands.sql`. It is not in `supabase/migrations`, so nothing can push it by accident.
  - Returns one row per requested (player, metric, window): the newest row on or before the as-of date, via `ORDER BY snapshot_date DESC LIMIT 1`, or nulls when there is none.
  - Output is ordered by player, metric, window in byte order.
  - Refuses null or empty input and more than 1,000 keys; PostgREST would otherwise truncate silently.
  - STABLE, SECURITY INVOKER, so it can be called by GET. Execute is granted to service_role only.
  - Local proof 12/12: `results/function-proof.txt`.
- **TypeScript:** `web/lib/projections/queries/trendBandLatest.ts`.
  - One GET RPC call per team.
  - Coverage proof: count, key order, no orphan values, no row after the as-of date.
  - Uses the old reader's selection helpers (newest date, then metric priority, then window priority) and the same failure contract (`fetchFailed`, the writer continues).
  - No 21-day floor and no rate change; the reader stays inert.
- **Tests:** `trendBandLatest.test.ts`, 13/13. They run the **unchanged old reader** on the rows the old SQL returned and compare it with the new code on the rows the function returned. Both come from the same local table.

## 3. Local data (disposable PG15, scratchpad only)
- **Size:** 10.5M rows, 4.6 GB heap. Production has 11.0M rows and a 4.2 GB heap. Same columns, primary key and both indexes.
- **Shape follows the writer:**
  - one season of history, written per player;
  - the daily cron (`snapshot_date = today` for about 750 players, written per date);
  - 15 metrics × 4 windows, with skipped windows and absent metrics;
  - history re-upserts, daily re-runs, then VACUUM.
- **Teams:**
  - 3 typical teams: 9 cron players, 6 history-only players and 3 without rows, like the readback;
  - an all-cron team;
  - two worst cases: l5 missing on the reader's metrics for 60 days, and l5 never present;
  - an edge team: ties, hard-stale, soft-stale, missing, future rows, and one player placed on the cap boundary date.

## 4. Old vs new on the same rows (`results/old-vs-new-comparison.json`)
| team | in-cap: identical | beyond cap | boundary | no rows | eligibleRows | with rows | missing | hard-stale |
|---|---|---|---|---|---|---|---|---|
| typical a/b/c | 9 / 9 | 6 | 0 | 3 | 1000 → 116–120 | 9 → 15 | 9 → 3 | 0 → 6 |
| all cron | 18 / 18 | 0 | 0 | 0 | 1000 → 144 | 18 | 0 | 0 |
| worst (l5 gap / never) | 18 / 18 | 0 | 0 | 0 | 1000 → 142 / 70 | 18 | 0 | 0 |
| edge | 14 / 14 | 2 | 1 (unstable) | 1 | 1000 → 136 | 14 → 17 | 4 → 1 | 0 → 1 (soft 0 → 2) |

- **In-cap players:** the selected band and the whole adjustment object are identical for 95 of 95. This is the only class where parity holds.
- **Beyond the cap:** these players' newest rows are older than the boundary. The old reader reports them missing; the new reader returns the stale row with its date, so it is not counted as missing. Counters and per-player `trendAdjustment` metadata change for them. Rates do not, because the reader is inert and a hard-stale weight is 0.
- **Boundary:** the old statement as executed dropped all 8 of the edge player's boundary-date rows. The two explicit tie orders the statement equally allows kept 7. So the old result depends on the plan's tie order. The new read always returns every key.
- **`eligibleRows`:** this counted the rows the capped GET returned, which is 1,000 per full team. It now counts the latest candidates (70–144 per team). That is an explicit counter change and needs approval. Byte parity of `data_quality` is not claimed.

## 5. Plan and headroom (cold shared buffers; `results/bench-summary.txt`, `bench-narrow-index.txt`)
The OS cache cannot be dropped without sudo, and local SSD is not Supabase storage, so the evidence is pages read, not milliseconds.

| case | old GET | new, analyzed | new, no statistics | new + narrow index |
|---|---|---|---|---|
| typical teams | 6,805–7,567 | 206–319 | 241–351 | 275–288 |
| all cron | 10,880–11,760 | 224–228 | 340 | 321–325 |
| l5 missing 60 days | 10,515–11,152 | 585–589 | **4,122** | 370–374 |
| l5 never present | 10,156–10,711 | 1,075–1,079 | **10,231** | 302–306 |

- **Calibration:** production ran the old read in 2,553 ms (team 1) and at least 8,050 ms (team 2). Locally the old read takes 6.8k–11.8k pages, which implies about 0.3–1.2 ms per page. At 1 ms per page, the new read costs about 0.2–0.35 s on normal teams.
- **Plan shape:** each key is a `Limit 1` over an ordered index scan, so the plan stops at the newest qualifying row.
  - **With statistics**, the probe uses a backward primary-key scan. Metric and window are filtered inside the index, so the worst case is about 1,080 pages (about 1 s).
  - **Without statistics**, it uses `idx_stb_player_metric`, with `window_code` checked on the heap. A key whose window is missing across a long stretch walks that history: 4,122–10,231 pages, the old cost.
- **Production's likely plan:** the 0326 EXPLAIN chose `idx_stb_player_metric` for the old read, which locally happens only without statistics. Production probably plans the probe the risky way.
- **The narrowest new index** (only if needed): `(player_id, metric_key, window_code, snapshot_date DESC)`. It reads 275–374 pages in every case, whatever the statistics. Locally it is 441 MB and built in 5.4 s; in production it would be `CREATE INDEX CONCURRENTLY`, with minutes of I/O.
- **Not shown offline:**
  - real latency on Supabase storage;
  - production's current plan choice;
  - how often long missing-window runs occur in production.

## 6. Replay and capture
- **Replay:** a read through an RPC is a different hash-matched operation from the table GET.
  - Retained writer snapshots (`player_forecast_source_observations`, `forge-run-inputs-v1`) replay only at the code version they recorded.
  - The capture fixture world needs an RPC handler.
  - The parity oracles' `data_quality` changes with the counter.
- **Capture:** `CAPTURE_RPCS` would need a third GET RPC; TJ allowed exactly two.
- **Retained real inputs:** these hold only the capped responses, so they could confirm only the in-cap class. Reading them is a production read, which was not done. Section 4 uses synthetic, production-shaped rows.

## 7. Decisions needed (none taken)
1. The counter change for `eligibleRows` (section 4).
2. The beyond-cap changes: stale rows reported as stale, not missing, plus their metadata.
3. One read-only production EXPLAIN (no ANALYZE) of the probe for 0326's team-2 players, generic plan. Its result decides between items 4a and 4b.
4. Then (a) the narrow index, built `CONCURRENTLY`, or (b) `ANALYZE sustainability_trend_bands`.
5. Later:
   - apply the function;
   - add the third GET RPC to the allowlist;
   - switch the reader in `skater-queries.ts` (after Astra/Scout acknowledge);
   - regenerate the oracles.

## Reproduce (offline)
```bash
export STB_BENCH_DIR=<scratch dir outside the repo>
LC_ALL=C /usr/local/bin/python3 -I tasks/artifacts/forge-pregame-capture-2026-11-14/trend-band-reader/bench/trend_band_bench.py init
LC_ALL=C /usr/local/bin/python3 -I tasks/artifacts/forge-pregame-capture-2026-11-14/trend-band-reader/bench/trend_band_bench.py bench
LC_ALL=C /usr/local/bin/python3 -I tasks/artifacts/forge-pregame-capture-2026-11-14/trend-band-reader/bench/trend_band_bench.py bench-index
LC_ALL=C /usr/local/bin/python3 -I tasks/artifacts/forge-pregame-capture-2026-11-14/trend-band-reader/bench/trend_band_bench.py proof
LC_ALL=C /usr/local/bin/python3 -I tasks/artifacts/forge-pregame-capture-2026-11-14/trend-band-reader/bench/trend_band_bench.py fixture
cd web && npx vitest run lib/projections/queries/trendBandLatest.test.ts
```
`bench` also writes `results/rows-by-team.json` and `bench-report.json` (full plans, about 6 MB). They are not committed; `fixture` packs the rows the test needs.
