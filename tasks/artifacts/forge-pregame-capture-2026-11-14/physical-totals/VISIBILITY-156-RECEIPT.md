# wgo_skater_stats visibility receipt: one-off VACUUM + migration 156

- **Approval:** TJ's pop-up, 2026-11-16: "Both, vacuum first (Recommended)".
- **Script:** `operator/apply-visibility-156.sh`, attended (self-test 14/14, then 17/17 with `--index-cleanup`). It ran psql 15 to the IPv4 session pooler as `postgres` (table owner, not superuser). Private outputs are in `~/forge-pilot/visibility-156-20261116T015026Z/`; copies are in `results/vacuum-20261116T015028Z.txt` and `results/body-plan-after-vacuum-20261116T015030Z.txt`.

## 1. One-off `VACUUM (VERBOSE) public.wgo_skater_stats`
- **Gate (01:50:27Z):** active 1, longest 1 s, lock waits 0, cron 0, no vacuum running; 97.57% of pages all-visible.
- **Ran:** 01:50:28.307–01:50:30.248Z (elapsed 1.86 s); exit 0.
- **Work:** scanned 19,786 of 278,574 pages (7.10%); 138 tuples removed, 0 dead but not yet removable; 83 MB/s read.
- **Index cleanup was bypassed by Postgres itself.** Only 3,814 pages (1.37%, under the 2% bypass threshold) had dead item identifiers (7,426, left by upserts). Pages that keep dead items stay not-all-visible.
- **After (01:50:31Z):** 98.63% of pages all-visible.
- **The capture read** (155 body, generic plan, read-only `EXPLAIN ANALYZE` as service_role): Index Only Scan, **Heap Fetches 3,270** (before: 9,592), 2,055 pages (before: 4,950), of which **1,572 were read from disk**, so this is close to a cold read: **1,537 ms** (the cold call at 01:18Z was 2,873 ms).

## 2. Migration 156: `20261116020000_wgo_skater_stats_insert_autovacuum.sql`
- **File:** SHA-256 `3d48946e…3b77` (checked on the applied copy).
- **Gate (01:50:52Z):** quiet; no ledger row; reloptions exactly order 93's.
- **Applied at 01:50:53.061Z** in one transaction: `lock_timeout 5s`, `ALTER TABLE ... SET (autovacuum_vacuum_insert_threshold = 1000, autovacuum_vacuum_insert_scale_factor = 0)`, ledger row. Committed.
- **Readback:** ledger row present; reloptions `{autovacuum_analyze_scale_factor=0.002,autovacuum_vacuum_scale_factor=0.01,autovacuum_vacuum_insert_threshold=1000,autovacuum_vacuum_insert_scale_factor=0}`.
- **Effect:** autovacuum now visits the table after every 1,000 inserted rows, counted from now; the stats counters had read 0.
- **Rollback:** rehearsed, not run: `apply-visibility-156.sh --rollback-reloptions --confirm 20261116020000`.

## 3. `VACUUM (VERBOSE, INDEX_CLEANUP ON) public.wgo_skater_stats`
- **Approval:** TJ's pop-up "Run it now". Script switch `--index-cleanup`; self-test 17/17.
- **Gate (01:52:35Z):** quiet; no vacuum running; 98.63% of pages all-visible.
- **Ran:** finished 01:52:43.921Z (elapsed 7.46 s); exit 0. It cleaned the table's indexes (copy in `results/vacuum-index-cleanup-20261116T015236Z.txt`).
- **After (01:52:45Z):** **100.00%** of pages all-visible.
- **The capture read:** Index Only Scan, **Heap Fetches 0**, **337 ms** (`results/body-plan-after-index-cleanup-20261116T015244Z.txt`).

## What is left
- **New rows:** the daily WGO inserts make new pages not-all-visible again. Migration 156 has autovacuum visit after every 1,000 inserted rows.
- **Upserts:** their dead items can again sit under the 2% index-cleanup bypass, so heap fetches may creep back between index-cleaning vacuums. The pre-capture timed read is what catches it.
- **Cold time of the capture read:** not measured in a fully cold state; it was 1,537 ms near cold after the first VACUUM. The next capture's go/no-go is `apply-migration-155.sh --timed-read` at ≤ 4,000 ms.
