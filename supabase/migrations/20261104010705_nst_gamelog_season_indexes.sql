-- WiGO P-1 (tasks/artifacts/wigo-charts-overhaul-2026-11-01/P1-P2-MIGRATIONS.md): the ES, PP and PK percentile
-- views (nst_percentile_{es,pp,pk}_{offense,defense}) took 4.9-7.6 s for one 500-row page of 20262027 and hit the
-- anon 3 s statement timeout (57014), so WiGO ratings never loaded. EXPLAIN ANALYZE on 2026-11-03 showed two causes:
--   1. The planner estimated 1 row for season = 20262027, because the new season is not in the column statistics
--      (about 2-3% of each ~230k-row table; daily inserts never reach the default 10% autoanalyze threshold). With
--      that estimate it chose a nested loop that re-aggregated the on-ice game log once per player (500 loops).
--   2. No index leads with season; the only candidates are (player_id, date_scraped, season), which the planner
--      walks end to end (1.2-1.4 s for the outer side alone).
-- Fix: a (season, player_id) index on each source game log (also gives player_id order for the grouping and the
-- order by), per-table analyze thresholds like 20261021172444, and an ANALYZE now so the fix is immediate.
-- The views themselves are unchanged. The AS game logs are handled in the P-2 migration.
-- Each CREATE INDEX briefly blocks writes to its table (no reads); run outside the NST game log ingest.
set local lock_timeout = '5s';

create index if not exists nst_gamelog_es_counts_season_player_idx
  on public.nst_gamelog_es_counts (season, player_id);
create index if not exists nst_gamelog_es_counts_oi_season_player_idx
  on public.nst_gamelog_es_counts_oi (season, player_id);
create index if not exists nst_gamelog_pp_counts_season_player_idx
  on public.nst_gamelog_pp_counts (season, player_id);
create index if not exists nst_gamelog_pp_counts_oi_season_player_idx
  on public.nst_gamelog_pp_counts_oi (season, player_id);
create index if not exists nst_gamelog_pk_counts_season_player_idx
  on public.nst_gamelog_pk_counts (season, player_id);
create index if not exists nst_gamelog_pk_counts_oi_season_player_idx
  on public.nst_gamelog_pk_counts_oi (season, player_id);

-- About 0.2% of ~140-230k rows: re-analyzed after roughly one night of games, so a new season enters the stats
-- within days instead of mid-season.
alter table public.nst_gamelog_es_counts set (autovacuum_analyze_scale_factor = 0.002);
alter table public.nst_gamelog_es_counts_oi set (autovacuum_analyze_scale_factor = 0.002);
alter table public.nst_gamelog_pp_counts set (autovacuum_analyze_scale_factor = 0.002);
alter table public.nst_gamelog_pp_counts_oi set (autovacuum_analyze_scale_factor = 0.002);
alter table public.nst_gamelog_pk_counts set (autovacuum_analyze_scale_factor = 0.002);
alter table public.nst_gamelog_pk_counts_oi set (autovacuum_analyze_scale_factor = 0.002);

analyze public.nst_gamelog_es_counts;
analyze public.nst_gamelog_es_counts_oi;
analyze public.nst_gamelog_pp_counts;
analyze public.nst_gamelog_pp_counts_oi;
analyze public.nst_gamelog_pk_counts;
analyze public.nst_gamelog_pk_counts_oi;
