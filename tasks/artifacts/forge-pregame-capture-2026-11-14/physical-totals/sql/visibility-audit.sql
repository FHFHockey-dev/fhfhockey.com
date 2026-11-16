-- Read-only audit (TJ 2026-11-16 "Check, then propose"): autovacuum reach on wgo_skater_stats and API statement
-- timeouts. Catalog and statistics views only; rolled back.
begin read only;
set local statement_timeout = '5s';
select name, setting, unit from pg_settings
where name in ('autovacuum', 'autovacuum_naptime', 'autovacuum_max_workers', 'autovacuum_vacuum_threshold',
  'autovacuum_vacuum_scale_factor', 'autovacuum_vacuum_insert_threshold', 'autovacuum_vacuum_insert_scale_factor',
  'autovacuum_analyze_threshold', 'autovacuum_analyze_scale_factor', 'track_counts', 'statement_timeout',
  'vacuum_cost_limit', 'autovacuum_vacuum_cost_limit', 'autovacuum_vacuum_cost_delay')
order by name;
select c.reloptions, c.reltuples::bigint, c.relpages, c.relallvisible,
  round(100.0 * c.relallvisible / nullif(c.relpages, 0), 2) as pct_all_visible
from pg_class c where c.oid = 'public.wgo_skater_stats'::regclass;
select n_live_tup, n_dead_tup, n_mod_since_analyze, n_ins_since_vacuum, n_tup_ins, n_tup_upd, n_tup_hot_upd, n_tup_del,
  last_vacuum, last_autovacuum, last_analyze, last_autoanalyze, vacuum_count, autovacuum_count, analyze_count,
  autoanalyze_count
from pg_stat_user_tables where relid = 'public.wgo_skater_stats'::regclass;
select datname, stats_reset from pg_stat_database where datname = current_database();
select r.rolname, r.rolconfig, s.setconfig as db_role_config
from pg_roles r left join pg_db_role_setting s on s.setrole = r.oid and s.setdatabase = (select oid from pg_database where datname = current_database())
where r.rolname in ('authenticator', 'anon', 'authenticated', 'service_role', 'postgres')
order by r.rolname;
select count(*) as vacuums_running from pg_stat_progress_vacuum;
rollback;
