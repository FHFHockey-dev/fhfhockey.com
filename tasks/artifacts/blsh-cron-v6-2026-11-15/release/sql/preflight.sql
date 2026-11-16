-- BLSH v6 migrations 153/154: read-only preflight. One line, '|'-separated. Run immediately before each apply.
-- Fields: active | longest_s | lock_waits | cron_running | ledger_153 | ledger_154 | blsh_tables | blsh_functions |
--         request_context_fn | bucket | storage_bucket_cols | storage_object_cols | can_insert_bucket | can_read_objects |
--         dependency_cols | roles | superuser | ledger_cols
begin read only;
set local statement_timeout = '5s';
select
  (select count(*) from pg_stat_activity where state = 'active' and pid <> pg_backend_pid()),
  (select coalesce(ceil(max(extract(epoch from clock_timestamp() - query_start))), 0)::int from pg_stat_activity where state = 'active' and pid <> pg_backend_pid()),
  (select count(*) from pg_stat_activity where wait_event_type = 'Lock'),
  (select count(*) from cron.job_run_details where status in ('running', 'starting') and start_time > now() - interval '2 hours'),
  (select count(*) from supabase_migrations.schema_migrations where version = '20261116000000'),
  (select count(*) from supabase_migrations.schema_migrations where version = '20261116000100'),
  (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and c.relname like 'blsh\_capture\_%'),
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'blsh\_capture\_%'),
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'blsh_request_context_v1'),
  coalesce((select b.public::text || ',' || b.file_size_limit || ',' || b.allowed_mime_types::text from storage.buckets b where b.id = 'blsh-native-packets'), 'absent'),
  (select count(*) from information_schema.columns where table_schema = 'storage' and table_name = 'buckets' and column_name in ('id', 'name', 'public', 'file_size_limit', 'allowed_mime_types')),
  (select count(*) from information_schema.columns where table_schema = 'storage' and table_name = 'objects' and column_name in ('bucket_id', 'name', 'metadata')),
  has_table_privilege(current_user, 'storage.buckets', 'INSERT') and has_table_privilege(current_user, 'storage.buckets', 'SELECT'),
  has_table_privilege(current_user, 'storage.objects', 'SELECT'),
  (select count(*) from information_schema.columns where table_schema = 'public' and (
     (table_name = 'games' and column_name in ('id', 'seasonId', 'date', 'type'))
     or (table_name = 'wgo_skater_stats' and column_name in ('id', 'player_id', 'game_id', 'season_id', 'date', 'player_name', 'team_abbrev', 'position_code', 'games_played',
       'toi_per_game', 'es_toi_per_game', 'pp_toi_per_game', 'goals', 'assists', 'pp_points', 'shots', 'hits', 'blocked_shots', 'total_primary_assists',
       'total_secondary_assists', 'penalties_drawn', 'penalties', 'total_fow', 'total_fol', 'sat_for', 'sat_against', 'es_goals_for', 'pp_goals_for',
       'sh_goals_for', 'es_goals_against', 'pp_goals_against', 'sh_goals_against', 'points'))
     or (table_name = 'nst_gamelog_as_counts' and column_name in ('id', 'player_id', 'season', 'date_scraped', 'gp', 'toi', 'ixg', 'goals', 'shots'))
     or (table_name = 'nst_gamelog_as_counts_oi' and column_name in ('id', 'player_id', 'season', 'date_scraped', 'gp', 'toi', 'xgf', 'xga')))),
  (select count(*) from pg_roles where rolname in ('service_role', 'anon', 'authenticated')),
  (select rolsuper from pg_roles where rolname = current_user),
  (select string_agg(column_name, ',' order by column_name) from information_schema.columns where table_schema = 'supabase_migrations' and table_name = 'schema_migrations' and column_name in ('version', 'name'));
-- Storage policies on storage.objects (review L6, PROBE-LIST 13): listed for review, not part of the line above.
select policyname, cmd, roles::text, coalesce(qual, '') from pg_policies where schemaname = 'storage' and tablename = 'objects' order by policyname;
rollback;
