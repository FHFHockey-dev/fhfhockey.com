# Production read-only database reads (2026-10-17)

Project `fyhftlxokyjtpndbkfse` through the Supabase MCP `execute_sql` connector. Six statements, run sequentially between about 19:40 and 20:10 UTC. Each began with `set statement_timeout = '8s'`. None used EXPLAIN ANALYZE, none wrote anything, and the cancelled statistics query from the earlier DB audit was not retried. Five of the six read only catalog or statistics views, or used block sampling or an indexed equality. The sixth read the tiny `cron.job` table.

Results are single point-in-time readings, not repeated measurements. Block sampling (`TABLESAMPLE SYSTEM`) samples whole pages, so rows inserted together cluster together. Treat sampled shares as estimates.

## R1. Size and indexes of `cron_job_audit`

```sql
select c.reltuples::bigint as est_rows, pg_total_relation_size(c.oid) as total_bytes,
       pg_relation_size(c.oid) as heap_bytes,
       (select count(*) from pg_index i where i.indrelid = c.oid) as index_count
from pg_class c where c.oid = 'public.cron_job_audit'::regclass;
```

| est_rows | total_bytes | heap_bytes | index_count |
| ---: | ---: | ---: | ---: |
| 174,719 | 320,839,680 | 309,043,200 | 0 |

## R2. 2% block sample of `cron_job_audit` by job

```sql
select job_name, count(*) as sampled_rows,
       count(*) filter (where run_time > now() - interval '7 days') as sampled_last_7d,
       min(run_time)::date as first_seen, max(run_time) as last_seen,
       round(avg(octet_length(details::text))) as avg_details_bytes
from public.cron_job_audit tablesample system (2) repeatable (17)
group by job_name order by sampled_rows desc limit 20;
```

| job_name | sampled | sampled last 7 d | avg details bytes |
| --- | ---: | ---: | ---: |
| /api/v1/db/update-line-sources | 2,048 | 707 | 1,975 |
| /api/v1/db/update-lines-ccc | 742 | 244 | 1,305 |
| /api/v1/db/update-line-combinations | 320 | 13 | 679 |
| /api/v1/db/cron/update-stats-cron | 313 | 18 | 564 |
| /api/v1/db/auto-news-feed-items | 123 | 6 | 4,470 |
| the 15 other jobs listed | ≤33 each | ≤3 each | — |

In the last 7 days, the two line-source processors account for 951 of about 1,000 sampled rows, roughly 95%.

## R3. Insert, delete and scan counters

```sql
select s.n_tup_ins, s.n_tup_del, s.n_live_tup, s.n_dead_tup, s.last_autovacuum, s.seq_scan, s.seq_tup_read, d.stats_reset
from pg_stat_user_tables s, pg_stat_database d
where s.relid = 'public.cron_job_audit'::regclass and d.datname = current_database();
```

| n_tup_ins | n_tup_del | n_live_tup | seq_scan | seq_tup_read | stats_reset |
| ---: | ---: | ---: | ---: | ---: | --- |
| 78,844 | 0 | 189,160 | 1,078 | 128,208,054 | null |

## R4. Postmaster start time and recent idle processor runs

`pg_postmaster_start_time()` = **2026-10-05 01:04:58 UTC**. That gives 12.78 days of counters, so 78,844 / 12.78 ≈ **6,170 inserts/day** and 1,078 / 12.78 ≈ **84 full scans/day**.

Recent sampled `update-line-sources` rows were all `success`, took 133–176 ms, and reported `"teamsLoaded":0` with 14 scheduled games, meaning there were no events to process.

## R5. Live pg_cron state and sustainability population

Command URLs were reduced to their `/api/...` path with a regex, so no headers or secrets were read.

| job | schedule (UTC) | active | path |
| --- | --- | --- | --- |
| 234 daily-cron-report | 15 21 * * * | **false** | /api/v1/db/cron-report |
| 308 run-forge-projection-v2 | 05 10 * * * | false | /api/v1/db/run-projection-v2 |
| 326 rebuild-sustainability-baselines | 40 10 * * * | true | /api/v1/db/sustainability/rebuild-baselines |
| 370 / 371 / 372 / 376 sustainability window-z / score / trend-bands / priors (runAll) | 10:42–10:46 | false | /api/v1/sustainability/... |
| 383 / 384 / 385 forecast h7 / h3 / h1 | 11:35 / 11:36 / 11:37 | true | /api/v1/game-predictions/forecast?... |
| **386 forecast-h0** | **38 11 * * *** | **true** | /api/v1/game-predictions/forecast?fromOffsetDays=0&toOffsetDays=0&limit=16&maxRuntimeMs=240000 |
| 393 run-forge-projection-v2-weekly | 12 10 * * * | true | /api/v1/db/run-projection-v2?horizonGames=5 |

`player_baselines` latest `snapshot_date` = 2026-10-17. 400 rows had position codes in (C, L, R, LW, RW, F, D). `toPosGroup` admits only C, LW, RW and D, so the F/D population is **at most 400**.

## R6. `player_baselines` indexes

| index | bytes | idx_scan | definition |
| --- | ---: | ---: | --- |
| player_baselines_pkey | 6,471,680 | 12,001 | UNIQUE (player_id, snapshot_date) |
| idx_baselines_player_date | 6,635,520 | 18,504 | (player_id, snapshot_date), duplicating the primary key |
| idx_baselines_date | 1,867,776 | 488 | (snapshot_date) |
