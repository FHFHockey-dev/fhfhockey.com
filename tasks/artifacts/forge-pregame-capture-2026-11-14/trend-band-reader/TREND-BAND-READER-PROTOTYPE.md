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
  - Local proof 11/11: `results/function-proof.txt`.
- **TypeScript:** `web/lib/projections/queries/trendBandLatest.ts`.
  - One GET RPC call per team.
  - Coverage proof: count, key order, no orphan values, no row after the as-of date.
  - Uses the old reader's selection helpers (newest date, then metric priority, then window priority) and the same failure contract (`fetchFailed`, the writer continues).
  - No 21-day floor and no rate change; the reader stays inert.
- **Tests:** `trendBandLatest.test.ts`, 13/13. Projections audit, reader and capture suites: 243/243. They run the **unchanged old reader** on the rows the old SQL returned and compare it with the new code on the rows the function returned. Both come from the same local table.

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
- **Beyond the cap:** these players' newest rows are older than the boundary. The old reader reports them missing; the new reader returns the stale row with its date, so it is not counted as missing.
  - What changes for them:
    - the counters;
    - the per-player `trend_adjustment` output block (`skater-stage.ts` ~3493), which goes from `selected: false` to the stale row's details;
    - a team warning, "included N hard-stale rows" (~2067), which now fires.
  - **Rates do not change while the reader is inert.** The test asserts all four multipliers are 1 for every beyond-cap and boundary player. Hard-stale rows have recency weight 0.
  - **Once `regress_toward_band` ships**, a soft-stale row (8–20 days) gets a real multiplier. The new read would then move rates for soft-stale players that the old read reported as missing.
- **Boundary:** the old statement as executed dropped all 8 of the edge player's boundary-date rows. The two explicit tie orders the statement equally allows kept 7. So the old result depends on the plan's tie order. The new read always returns every key.
- **`eligibleRows`:** this counted the rows the capped GET returned, which is 1,000 per full team. The prototype counts the latest candidates instead (70–144 per team): an explicit counter change that needs approval.
  - **To preserve it exactly,** the function would also compute `count(*)` over `… LIMIT 1000`, which equals the old value, `min(history, 1000)`.
  - That extra count reads 48–94 pages locally, an index-only scan on the primary key. Production may need heap visits if the visibility map is stale.
  - `playersWithRows` and `playersMissingRows` cannot be preserved, because the old cut depends on the plan.
  - Byte parity of `data_quality` is not claimed either way.

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
- **Production's likely plan** (`results/bench-settings.txt`):
  - Production's 0326 EXPLAIN estimated 29,699 rows for the old read. That matches the analyzed local plans (16.9k–18.8k rows), not the no-statistics ones (63–409), so production has statistics.
  - With statistics and `random_page_cost = 1.1`, the old read switches to `idx_stb_player_metric`, as production's did. The probe stays on the backward primary-key scan under both cost settings.
  - **Confirmed in production** (TJ-approved read-only EXPLAIN, 2026-11-15T18:33:47Z; `results/production-explain-20261115T183347Z.txt`):
    - Both the generic and the custom plan use `Index Scan Backward using sustainability_trend_bands_pkey`, with player, date, metric and window all in `Index Cond` under `Limit 1`. That is the robust path, so **no new index and no ANALYZE are needed**.
    - Production settings: `random_page_cost` 1.1, `jit` off, statistics present (player_id n_distinct 1,293; snapshot_date 273), reltuples 11.0M.
  - Plan excerpts are in `results/plan-excerpts.txt`.
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
- **Capture:**
  - `CAPTURE_RPCS` would need a third GET RPC; TJ allowed exactly two.
  - **Two strict-refusal holes to close at integration:** an over-limit request refused in the client, and a coverage mismatch on an HTTP 200. Both surface only as `fetchFailed`. The transport never sees them, so a capture could still qualify. The capture must refuse on either.
- **Retained real inputs:** these hold only the capped responses, so they could confirm only the in-cap class. Reading them is a production read, which was not done. Section 4 uses synthetic, production-shaped rows.

## 7. Decisions
**TJ, 2026-11-15:**
- **Counter:** rename it. Integration writes `trend_adjustment_candidate_rows` (the latest candidate count) and drops `trend_adjustment_rows_eligible`.
- **Stale rows:** stale-not-missing is accepted. Counters, the per-player `trend_adjustment` block and the hard-stale warning change; rates are unchanged while the reader is inert.
- **Production EXPLAIN:** run once, read-only. Result: the primary-key path, so item 4 below is not needed.

The original list, kept for the record:
1. The counter change for `eligibleRows` (section 4).
2. The beyond-cap changes: stale rows reported as stale, not missing, plus their metadata.
3. One read-only production EXPLAIN (no ANALYZE), exactly as in `sql/production-explain-proposal.sql`:
   - a read-only transaction with a 5 s statement timeout and a 1 s lock timeout;
   - planner settings and `pg_stats` presence;
   - the probe for 0326's team-2 players, as both a generic and a custom plan;
   - then rollback.
4. Only if that EXPLAIN shows the `idx_stb_player_metric` filter path: (a) the narrow index, built `CONCURRENTLY`, or (b) `ANALYZE sustainability_trend_bands`.
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
LC_ALL=C /usr/local/bin/python3 -I tasks/artifacts/forge-pregame-capture-2026-11-14/trend-band-reader/bench/trend_band_bench.py bench-settings
LC_ALL=C /usr/local/bin/python3 -I tasks/artifacts/forge-pregame-capture-2026-11-14/trend-band-reader/bench/trend_band_bench.py proof
LC_ALL=C /usr/local/bin/python3 -I tasks/artifacts/forge-pregame-capture-2026-11-14/trend-band-reader/bench/trend_band_bench.py fixture
cd web && npx vitest run lib/projections/queries/trendBandLatest.test.ts
```
`bench` also writes `results/rows-by-team.json` and `bench-report.json` (full plans, about 6 MB). They are not committed; `fixture` packs the rows the test needs.
