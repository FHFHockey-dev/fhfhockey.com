-- FORGE projection audit 2026-10-21, Q4: the rolling and WGO source tables had never been analyzed or
-- vacuumed by autovacuum (the planner estimated rolling_player_game_metrics at ~2,370 rows; it holds ~891k),
-- because the default 10-20% scale factors are never reached by a daily ~10k-row write pattern on tables
-- this size. Per-table thresholds keep statistics and dead tuples current. A one-time ANALYZE of the same
-- three tables was run alongside this migration (2026-10-21 17:23Z).
set local lock_timeout = '5s';

alter table public.rolling_player_game_metrics
  set (autovacuum_analyze_scale_factor = 0.002, autovacuum_vacuum_scale_factor = 0.01);
alter table public.wgo_skater_stats
  set (autovacuum_analyze_scale_factor = 0.002, autovacuum_vacuum_scale_factor = 0.01);
alter table public.rolling_player_metric_support_payloads
  set (autovacuum_analyze_scale_factor = 0.002, autovacuum_vacuum_scale_factor = 0.01);
