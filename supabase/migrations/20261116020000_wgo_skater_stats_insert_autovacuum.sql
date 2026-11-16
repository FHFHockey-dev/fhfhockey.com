-- NOT APPLIED. FORGE pregame capture lane (Claude Chef), 2026-11-16. Successor tuning to 20261021172444 (order 93,
-- applied). Apply only with TJ's pop-up approval, then record schema_migrations and migration-authority.json (order 156).
--
-- Problem: wgo_skater_stats is written insert-only by the daily WGO job (update-wgo-skaters, action=all, from the day
-- after its latest date). Order 93 set the dead-tuple and analyze triggers but not the insert trigger, so autovacuum
-- waits for 1000 + 0.2 x reltuples (about 452,000) inserted rows, which a season (about 47,000 rows) never reaches.
-- Pages of new rows therefore stay not-all-visible, and the index-only scan of forge_league_skater_physical_totals
-- (order 155, idx_wgo_skater_stats_gp1_physical) must visit the heap for them: 9,592 heap fetches and about 3,550 cold
-- page reads on 2026-11-16, a number that grows through the season.
-- Fix: vacuum after every 1,000 inserted rows (insert threshold 1000, insert scale factor 0), about every three to four
-- game days, so the visibility map stays current. Each such vacuum reads only the newly written pages. Nothing else
-- changes: ALTER ... SET merges with the order 93 options (autovacuum_analyze_scale_factor 0.002,
-- autovacuum_vacuum_scale_factor 0.01).
-- Lock: ALTER TABLE ... SET (reloptions) takes SHARE UPDATE EXCLUSIVE briefly; it does not block reads or writes.
-- Companion (not part of this file, needs its own approval): a one-off VACUUM (VERBOSE) public.wgo_skater_stats by
-- hand, outside a transaction, so the pages written so far this season become all-visible now.
-- READBACK: select reloptions from pg_class where oid = 'public.wgo_skater_stats'::regclass;
--   expect {autovacuum_analyze_scale_factor=0.002,autovacuum_vacuum_scale_factor=0.01,
--           autovacuum_vacuum_insert_threshold=1000,autovacuum_vacuum_insert_scale_factor=0}
-- Rollback: alter table public.wgo_skater_stats reset (autovacuum_vacuum_insert_threshold,
--   autovacuum_vacuum_insert_scale_factor); and remove the ledger row.
set local lock_timeout = '5s';

alter table public.wgo_skater_stats
  set (autovacuum_vacuum_insert_threshold = 1000, autovacuum_vacuum_insert_scale_factor = 0);
