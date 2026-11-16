# Pilot 1 diagnosis: `sustainability_trend_bands` HTTP 500 (TJ-approved, read-only)

**Scope:** Supabase logs for 14:40:09–14:40:45Z (connector, read-only), plus two READ ONLY psql sessions with a 5 s timeout. Load hygiene before them: 0 active, 0 lock waits. No writes, no ANALYZE, no reruns.

## Evidence
- **Edge logs.** The writer's per-team trend-bands read ran twice:
  - Team 1, 18 players: **200** (logged 14:40:24.534Z).
  - Team 2, 18 players: **500** (logged 14:40:31.140Z).
  - Postgres logged `canceling statement due to statement timeout` at 14:40:39.153Z, so the 500 is a **statement timeout** (57014 → PostgREST 500).
- **Timeouts.** `authenticator` has `statement_timeout=8s`, and PostgREST requests inherit it; `service_role` sets none of its own. (`anon` 3 s, `authenticated` 8 s.)
- **Table.** About **11.0 M rows** (`reltuples` 11,010,810), **5.9 GB** total (4.2 GB heap).
  - Indexes: PK `(player_id, snapshot_date, metric_key, window_code)`, `idx_stb_player_metric (player_id, metric_key, snapshot_date DESC)`, `idx_stb_snapshot (snapshot_date DESC)`.
  - `pg_stat_user_tables` reports `n_live_tup 16,292` with **no analyze on record**, so the statistics look stale.
- **Plan** (EXPLAIN without ANALYZE, team 2's exact ids and lists):
  - an index scan on `idx_stb_player_metric` for 18 players × 4 metrics, reading **every snapshot up to the slate date**;
  - `window_code` is filtered after the scan;
  - then a sort by `snapshot_date DESC` and a limit of 12,000; estimated 29,699 rows.
  - The trend adjustment uses only the latest snapshots, so most of that I/O is wasted. On a cold cache it lands near or over 8 s.
- **Live writer history:** 15 `forge_runs` in the last 7 days (11-09 and 11-13). All have `data_quality.trend_adjustment_fetch_failures = 0`. The read is **borderline**, not always failing; team 1's identical query succeeded seconds earlier.

## Cause
An unbounded-history read on a large, apparently un-analyzed table, at the edge of PostgREST's 8 s statement timeout. When it times out, the live writer silently drops trend adjustments. The capture correctly refuses that as `source_failed`.

## Fix owner and options (not this lane)
The owner is Astra/Scout (`web/lib/projections/queries/skater-queries.ts`, the sustainability tables). Any fix must keep the writer and the capture reading the same thing, and keep parity.
1. **Bound the history read:** `snapshot_date >= slate − N days`, with N from what the trend adjustment actually uses; or read latest-per-key (`DISTINCT ON` through an approved GET RPC).
2. **Index for the access path:** `(player_id, metric_key, window_code, snapshot_date DESC)`. Needs a migration and approval.
3. **ANALYZE** `sustainability_trend_bands` so the planner has real statistics. A production maintenance action; needs approval.

## Capture-lane follow-up (offline, this lane)
Refusals should keep the bounded PostgREST error code and message (for example `500:57014:canceling statement…`) as metadata, so the next failure is diagnosable from the receipt without a log query.
