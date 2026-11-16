# Migration 155 apply receipt: step 1 kept, step 2 applied and rolled back by the smoke rule

- **Approval:** TJ's pop-ups, 2026-11-16: "Now, tonight", and for a failed smoke "Yes, roll back (Recommended)". Packet: `MIGRATION-155-APPLY-PACKET.md`.
- **File:** `supabase/migrations/20261116010000_forge_physical_totals_covering_index.sql`, SHA-256 `7835a06d…87f`; rollback file SHA-256 `f121c9c4…042c`. Both hashes were checked by the script on every run.
- **Script:** `operator/apply-migration-155.sh`, attended. It ran psql 15 to the IPv4 session pooler as `postgres` (not superuser, with `pg_read_all_stats`). Private outputs are in `~/forge-pilot/migration-155-20261116T011654Z/`; copies of the plans are in `results/m155-*`.

## Timeline (database clock, UTC)
| Time | Step | Result |
| --- | --- | --- |
| 01:16:55 | preflight | active 1, longest 1 s, lock waits 0, cron 0, old transactions 0; no index, 137 body, no ledger row |
| 01:17:02–01:17:43 | **step 1**, `create index concurrently` | **Valid**, exact definition, **58 MB**, 41 s. **Kept.** |
| 01:18:02 | step 2 plan gate (plain EXPLAIN, generic) | `Index Only Scan using idx_wgo_skater_stats_gp1_physical` with the date range as `Index Cond` |
| 01:18:03.282 | **step 2**, function + ledger row + notify | Committed. Readback exact: md5 `5b67ecb4…`, STABLE, invoker, `search_path=""`, service_role only, index valid. |
| 01:18:10 | smoke 1/3: function as service_role | 4 rows, **2,873 ms** (pages: 1,410 hit + 3,550 read; 1,226 temp read). **Over the 2,000 ms limit, so FAIL.** |
| 01:18:36.526 | **rollback-function** (pre-approved for a failed smoke) | 137 body restored, ledger row removed, notify. State: body 137, ledger 0, index valid. |
| 01:18:49 | smoke 2/3: new body's generic plan, `EXPLAIN (ANALYZE, BUFFERS)`, prepared, read-only | Index Only Scan, **327 ms** warm, all 4,950 pages hits, **Heap Fetches 9,592**, external sort 4.9 MB on disk |

Smoke 3/3 (the PostgREST GET) was not run, because the function was already rolled back.

## Reading
- **Pages:** the fix does what the bench said. The read is about 4,950 pages, against the bench's 5,064; today's function read about 54k locally.
- **Cold time:** 2.9 s, against 7.4–8.0 s before. That is about a 2.6× improvement, but not under the 2 s limit set in the packet.
- **Warm time:** 0.33 s.
- **Cold cost:**
  - about 3,550 pages read from disk, mostly **heap fetches**: 9,592 rows on pages not marked all-visible, about the current season's rows (to_date has 11,699 player-games), which the daily WGO upserts keep touching;
  - a small sort spill (`work_mem` 3.5 MB; 106k rows sorted for the 4-key join).
- **The 4 rows match** between the new function's call and the body plan's row count (106,153 player-games: 31,745 + 62,709 + 3,952 + 7,747). An exact comparison with the 137 body's live answer was not made, to avoid a second 7.5 s read. The local 121-call proof covers equivalence.

## Production state now
- **Index:** `idx_wgo_skater_stats_gp1_physical` is present and valid (58 MB).
  - Today's 137 body does not need it.
  - Its generic plan may now use it inside its BitmapOr (bench: 36k against 54k pages). That is unverified in production.
  - Write cost: updates to the included columns are no longer HOT.
- **Function:** the 137 body (md5 `0eec9782…`); no ledger row for 155.
- **Authority row 155:** stays `pending`, with this receipt as evidence. Step 1 is applied by hand, without a ledger row, the same way 123's index was applied.

## Not done
- No retry of step 2 and no other setting, VACUUM or timeout change.
- No push or deploy.
- Re-applying step 2 needs a new approval, with a different smoke limit or an improved body.
