# Migration 155 apply receipt: applied (step 2 rolled back once by the smoke rule, then re-applied)

- **Approval:** TJ's pop-ups, 2026-11-16: "Now, tonight", and for a failed smoke "Yes, roll back (Recommended)". After the rollback: "Reapply step 2, audit, triage, fix", rollback pre-approved again, and "Check, then propose" for a read-only autovacuum check. Packet: `MIGRATION-155-APPLY-PACKET.md`.
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
- **Cold time:** 2.9 s. That is one sample, taken 27 s after the index build had read the whole heap, against three earlier calls at 7.4–8.0 s. It is not under the 2 s limit set in the packet.
- **Warm time:** 0.33 s.
- **Cold cost:**
  - about 3,550 pages read from disk, mostly **heap fetches**: 9,592 rows on pages not marked all-visible. These are inferred to be mostly recent rows (to_date has 11,699 player-games), but pages mix seasons at date correlation 0.39;
  - a small sort spill (`work_mem` 3.5 MB; 106k rows sorted for the 4-key join).
- **The 4 rows match** between the new function's call and the body plan's row count (106,153 player-games: 31,745 + 62,709 + 3,952 + 7,747). **Production equivalence, checked offline:** the qualified 0328 packet recorded the 137 body's live answer to the same call (`forge_league_skater_physical_totals(20262027, '2026-11-15')`, 2026-11-15 20:10Z). It is **identical on all four rows** (`prior2` and `to_date`; player_games, hits, blocks, toi_seconds) to the 155 body's PostgREST answer at 01:28Z (`smoke-http.json`).

## Re-apply (TJ: "Reapply step 2")
- **Smoke change first:** the smoke now gates on the plan, the 4 rows and recorded heap fetches, and refuses only at the 8 s statement timeout. A separate `--timed-read` is the cold go/no-go before a capture, at ≤ 4,000 ms. Self-test 30/30, commit `c3ccdfc0d`.

| Time (Z) | Step | Result |
| --- | --- | --- |
| 01:27:51 | preflight inside step 2 | quiet; index valid; 137 body; no ledger row |
| 01:27:51 | plan gate | `Index Only Scan using idx_wgo_skater_stats_gp1_physical` |
| 01:27:52.658 | **step 2** | Committed; readback exact (md5 `5b67ecb4…`, service_role only, index valid) |
| 01:28:00 | **smoke** | Body plan: Index Only Scan, Heap Fetches 9,592, all 4,950 pages hits. Function: **279 ms** (warm), the same 4 rows as at 01:18Z. PostgREST GET: HTTP 200, 4 rows, 0.62 s. **OK.** |

**Not measured:** the cold time. The pages were warm. The next capture's go/no-go is one `--timed-read` at ≤ 4,000 ms before it launches.

## Production state now
- **Applied:** `idx_wgo_skater_stats_gp1_physical` (valid, 58 MB) and the 155 function body. Ledger row `20261116010000` is present.
- **Authority row 155:** `applied`. Pins: 121 applied, 28 unknown, 6 pending; 21/21 pass.
- **Writes:** updates to the included columns are no longer HOT.

## Read-only audit (01:28:20Z; `results/visibility-audit-20261116T012820Z.txt`)
**API statement timeouts:**
- `authenticator` has `statement_timeout=8s` and `service_role` sets none, so service-role API calls get 8 s.
- `anon` 3 s, `authenticated` 8 s; the database default is 5 s.
- These are Supabase role settings.

**Autovacuum on `wgo_skater_stats`:**
- **Global:** autovacuum is on; insert trigger `1000 + 0.2 × reltuples` (about 452k inserts).
- **Table:** already has `autovacuum_vacuum_scale_factor=0.01` and `autovacuum_analyze_scale_factor=0.002`, but no insert setting.
- **Visibility:** 271,811 of 278,574 pages all-visible (97.57%).
- **Counters:** every `pg_stat_user_tables` counter reads 0, with no vacuum or analyze timestamps, and `stats_reset` is empty. That is consistent with statistics lost at a restart; the cause is unverified.
- **No vacuum is running.**

**Reading (inferred):**
- The WGO job (`update-wgo-skaters`, `action=all`) inserts each new day's rows.
- With the default insert trigger and counters that start from zero, autovacuum will not visit this table to set visibility for a long time.
- So the not-all-visible pages, and with them this read's heap fetches, are likely to grow through the season.

## Not done
- No VACUUM, setting or timeout change. The visibility fix comes back to TJ as its own decision.
- No push or deploy.
- The sort spill (4.9 MB external sort) is minor; a body change would need a new hash and proof.
