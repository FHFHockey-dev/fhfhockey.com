-- PREPARED ONLY. NOT EXECUTED. Batch2 requires its own direct TJ approval.
-- Never run this whole file. Run Q1 alone, inspect aggregate hygiene, then Q2..Q7
-- one block at a time, concurrency1/no retries. STOP on active_others>5,
-- max_active_seconds>10, visibility_unknown>0, any error/timeout/missing object,
-- wrong kind or returned row-limit sentinel. Do not page/raise limits/rerun.
-- ROLLBACK an aborted transaction, then stop. These are catalog SELECTs only.
-- No application/user rows, RPC invocation, cron.job, query text, credentials,
-- refresh, EXPLAIN, dynamic SQL, DDL, migration ledger writes or env reads.
-- Target source:89da739cb45d7d572ed59bfa0b209c79c5d99299; actual DB target is Chef-confirmed.

-- Q1: load hygiene; exactly one row; excludes this backend. STOP rules above.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '5s';
SET LOCAL lock_timeout = '1s';
SET LOCAL idle_in_transaction_session_timeout = '15s';
SELECT
  count(*) FILTER (WHERE state = 'active') AS active_others,
  coalesce(max(greatest(0::numeric, extract(epoch FROM (statement_timestamp() - query_start))))
    FILTER (WHERE state = 'active'), 0) AS max_active_seconds,
  count(*) FILTER (WHERE (state IS NULL AND (backend_type IN ('client backend','parallel worker') OR backend_type IS NULL))
    OR (state = 'active' AND query_start IS NULL)) AS visibility_unknown
FROM pg_catalog.pg_stat_activity
WHERE pid <> pg_catalog.pg_backend_pid();
COMMIT;

-- Q2: 24 exact relations (21 scoped +3 index parents): identity, view definition, ACL/RLS. Limit25 sentinel.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '5s';
SET LOCAL lock_timeout = '1s';
SET LOCAL idle_in_transaction_session_timeout = '15s';
WITH allowed(schema_name, object_name) AS (VALUES
  ('public', 'forge_player_game_strength'),
  ('public', 'forge_reserve_projections'),
  ('public', 'forge_served_forecast_ledger'),
  ('public', 'forge_served_forecast_universe'),
  ('public', 'forge_team_game_strength'),
  ('public', 'games'),
  ('public', 'goalie_totals_unified'),
  ('public', 'goaliesGameStats'),
  ('public', 'line_source_snapshots'),
  ('public', 'lines_ccc'),
  ('public', 'nst_seasonlong_5v5_counts'),
  ('public', 'nst_seasonlong_5v5_counts_oi'),
  ('public', 'nst_seasonlong_5v5_rates'),
  ('public', 'player_forecast_accountability_revisions'),
  ('public', 'player_forecast_season_player_aggregates'),
  ('public', 'player_forecast_season_release_players'),
  ('public', 'powerPlayCombinations'),
  ('public', 'pp_team_game_clock'),
  ('public', 'predictions_sko_vdp'),
  ('public', 'sos_standings'),
  ('public', 'teamGameStats'),
  ('public', 'team_ctpi_daily'),
  ('public', 'team_sos_daily'),
  ('public', 'wgo_skater_stats')
), relations AS (
  SELECT a.*, c.oid, c.relkind, c.relowner, c.relrowsecurity, c.relforcerowsecurity, c.reloptions, c.relacl
  FROM allowed a LEFT JOIN pg_catalog.pg_namespace n ON n.nspname=a.schema_name
  LEFT JOIN pg_catalog.pg_class c ON c.relnamespace=n.oid AND c.relname=a.object_name
)
SELECT schema_name, object_name, oid IS NOT NULL AS found, relkind,
  pg_catalog.pg_get_userbyid(relowner) AS owner_role, relrowsecurity, relforcerowsecurity,
  reloptions, relacl::text AS raw_acl,
  CASE WHEN relkind IN ('v','m') THEN pg_catalog.pg_get_viewdef(oid, false) END AS view_definition
FROM relations ORDER BY schema_name, object_name LIMIT 25;
COMMIT;

-- Q3: 6 exact function signatures; definitions only, NEVER invoke. Limit7 sentinel.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '5s';
SET LOCAL lock_timeout = '1s';
SET LOCAL idle_in_transaction_session_timeout = '15s';
WITH allowed(signature) AS (VALUES
  ('fhfh_internal.reject_ctpi_v1_write()'),
  ('fhfh_internal.reject_sos_v1_write()'),
  ('public.forge_league_skater_physical_totals(integer,date)'),
  ('public.persist_projection_game_derived_v1(bigint,text,bigint,text,text,jsonb,jsonb,jsonb,integer,integer,integer,text,text)'),
  ('public.persist_projection_game_derived_v2(bigint,text,bigint,text,text,jsonb,jsonb,jsonb,integer,integer,integer,text,text)'),
  ('public.replace_power_play_game_v1(bigint,text,timestamp with time zone,jsonb,jsonb)')
), functions AS (SELECT a.signature, p.* FROM allowed a
  LEFT JOIN pg_catalog.pg_proc p ON p.oid=pg_catalog.to_regprocedure(a.signature))
SELECT signature, oid IS NOT NULL AS found,
  pg_catalog.pg_get_userbyid(proowner) AS owner_role,
  prokind, (SELECT lanname FROM pg_catalog.pg_language WHERE oid=prolang) AS language,
  prosecdef, provolatile, proisstrict, proparallel, proconfig, proacl::text AS raw_acl,
  pg_catalog.pg_get_function_identity_arguments(oid) AS identity_arguments,
  pg_catalog.pg_get_function_result(oid) AS result_type,
  prosrc AS body_text, pg_catalog.md5(prosrc) AS raw_body_md5,
  pg_catalog.pg_get_functiondef(oid) AS full_definition
FROM functions ORDER BY signature LIMIT 7;
COMMIT;

-- Q4: columns/defaults/column ACL for21 scoped relations (exclude index-only parents); limit1001 sentinel.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '5s';
SET LOCAL lock_timeout = '1s';
SET LOCAL idle_in_transaction_session_timeout = '15s';
WITH allowed(schema_name, object_name) AS (VALUES
  ('public', 'forge_player_game_strength'),
  ('public', 'forge_reserve_projections'),
  ('public', 'forge_served_forecast_ledger'),
  ('public', 'forge_served_forecast_universe'),
  ('public', 'forge_team_game_strength'),
  ('public', 'games'),
  ('public', 'goalie_totals_unified'),
  ('public', 'goaliesGameStats'),
  ('public', 'nst_seasonlong_5v5_counts'),
  ('public', 'nst_seasonlong_5v5_counts_oi'),
  ('public', 'nst_seasonlong_5v5_rates'),
  ('public', 'player_forecast_accountability_revisions'),
  ('public', 'player_forecast_season_player_aggregates'),
  ('public', 'player_forecast_season_release_players'),
  ('public', 'powerPlayCombinations'),
  ('public', 'pp_team_game_clock'),
  ('public', 'predictions_sko_vdp'),
  ('public', 'sos_standings'),
  ('public', 'teamGameStats'),
  ('public', 'team_ctpi_daily'),
  ('public', 'team_sos_daily')
), relations AS (
  SELECT a.*, c.oid, c.relkind, c.relowner, c.relrowsecurity, c.relforcerowsecurity, c.reloptions, c.relacl
  FROM allowed a LEFT JOIN pg_catalog.pg_namespace n ON n.nspname=a.schema_name
  LEFT JOIN pg_catalog.pg_class c ON c.relnamespace=n.oid AND c.relname=a.object_name
)
SELECT r.schema_name, r.object_name, a.attnum, a.attname,
  pg_catalog.format_type(a.atttypid,a.atttypmod) AS column_type,
  a.attnotnull, a.attidentity, a.attgenerated, a.attacl::text AS column_acl,
  pg_catalog.pg_get_expr(d.adbin,d.adrelid,false) AS default_expression
FROM relations r JOIN pg_catalog.pg_attribute a ON a.attrelid=r.oid
LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
WHERE a.attnum>0 AND NOT a.attisdropped
ORDER BY r.schema_name,r.object_name,a.attnum LIMIT 1001;
COMMIT;

-- Q5: constraints/indexes/triggers/RLS policies for21 scoped relations plus3 exact indexes; limit513 sentinel.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '5s';
SET LOCAL lock_timeout = '1s';
SET LOCAL idle_in_transaction_session_timeout = '15s';
WITH allowed(schema_name, object_name) AS (VALUES
  ('public', 'forge_player_game_strength'),
  ('public', 'forge_reserve_projections'),
  ('public', 'forge_served_forecast_ledger'),
  ('public', 'forge_served_forecast_universe'),
  ('public', 'forge_team_game_strength'),
  ('public', 'games'),
  ('public', 'goalie_totals_unified'),
  ('public', 'goaliesGameStats'),
  ('public', 'nst_seasonlong_5v5_counts'),
  ('public', 'nst_seasonlong_5v5_counts_oi'),
  ('public', 'nst_seasonlong_5v5_rates'),
  ('public', 'player_forecast_accountability_revisions'),
  ('public', 'player_forecast_season_player_aggregates'),
  ('public', 'player_forecast_season_release_players'),
  ('public', 'powerPlayCombinations'),
  ('public', 'pp_team_game_clock'),
  ('public', 'predictions_sko_vdp'),
  ('public', 'sos_standings'),
  ('public', 'teamGameStats'),
  ('public', 'team_ctpi_daily'),
  ('public', 'team_sos_daily')
), relations AS (
  SELECT a.*, c.oid, c.relkind, c.relowner, c.relrowsecurity, c.relforcerowsecurity, c.reloptions, c.relacl
  FROM allowed a LEFT JOIN pg_catalog.pg_namespace n ON n.nspname=a.schema_name
  LEFT JOIN pg_catalog.pg_class c ON c.relnamespace=n.oid AND c.relname=a.object_name
)
, metadata AS (
  SELECT r.schema_name,r.object_name,'constraint'::text AS kind,c.conname::text AS name,
    pg_catalog.pg_get_constraintdef(c.oid,false) AS definition,
    ('validated='||c.convalidated::text||';deferrable='||c.condeferrable::text||';deferred='||c.condeferred::text) AS flags
  FROM relations r JOIN pg_catalog.pg_constraint c ON c.conrelid=r.oid
  UNION ALL
  SELECT r.schema_name,r.object_name,'index',x.relname::text,
    pg_catalog.pg_get_indexdef(i.indexrelid,0,false),
    ('valid='||i.indisvalid::text||';ready='||i.indisready::text||';unique='||i.indisunique::text)
  FROM relations r JOIN pg_catalog.pg_index i ON i.indrelid=r.oid JOIN pg_catalog.pg_class x ON x.oid=i.indexrelid
  UNION ALL
  SELECT r.schema_name,r.object_name,'trigger',t.tgname::text,
    pg_catalog.pg_get_triggerdef(t.oid,false),('enabled='||t.tgenabled::text||';internal='||t.tgisinternal::text||';function='||
      (SELECT n.nspname||'.'||p.proname FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE p.oid=t.tgfoid))
  FROM relations r JOIN pg_catalog.pg_trigger t ON t.tgrelid=r.oid
  UNION ALL
  SELECT r.schema_name,r.object_name,'policy',p.polname::text,
    ('USING ('||coalesce(pg_catalog.pg_get_expr(p.polqual,p.polrelid,false),'NULL')||') WITH CHECK ('||
      coalesce(pg_catalog.pg_get_expr(p.polwithcheck,p.polrelid,false),'NULL')||')'),
    ('command='||p.polcmd::text||';permissive='||p.polpermissive::text||';role_oids='||p.polroles::text)
  FROM relations r JOIN pg_catalog.pg_policy p ON p.polrelid=r.oid
)
, exact_indexes(schema_name,object_name,index_name) AS (VALUES
  ('public','line_source_snapshots','line_source_snapshots_observed_at_idx'),
  ('public','lines_ccc','lines_ccc_observed_at_idx'),
  ('public','wgo_skater_stats','idx_wgo_skater_stats_team_date')
), exact_index_metadata AS (
  SELECT a.schema_name,a.object_name,'index'::text AS kind,a.index_name::text AS name,
    CASE WHEN i.indexrelid IS NOT NULL THEN pg_catalog.pg_get_indexdef(i.indexrelid,0,false) END AS definition,
    ('found='||(i.indexrelid IS NOT NULL)::text||';parent_matches='||coalesce((i.indrelid=c.oid)::text,'false')||
      ';valid='||coalesce(i.indisvalid::text,'NULL')||';ready='||coalesce(i.indisready::text,'NULL')||';unique='||coalesce(i.indisunique::text,'NULL')) AS flags
  FROM exact_indexes a LEFT JOIN pg_catalog.pg_namespace n ON n.nspname=a.schema_name
  LEFT JOIN pg_catalog.pg_class c ON c.relnamespace=n.oid AND c.relname=a.object_name
  LEFT JOIN pg_catalog.pg_class x ON x.relnamespace=n.oid AND x.relname=a.index_name
  LEFT JOIN pg_catalog.pg_index i ON i.indexrelid=x.oid
), combined AS (SELECT * FROM metadata UNION ALL SELECT * FROM exact_index_metadata)
SELECT * FROM combined ORDER BY schema_name,object_name,kind,name LIMIT 513;
COMMIT;

-- Q6: effective grants for known app roles; raw PUBLIC/default ACLs are inQ2/Q3/Q4. Limit82 sentinel.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '5s';
SET LOCAL lock_timeout = '1s';
SET LOCAL idle_in_transaction_session_timeout = '15s';
WITH allowed(schema_name, object_name) AS (VALUES
  ('public', 'forge_player_game_strength'),
  ('public', 'forge_reserve_projections'),
  ('public', 'forge_served_forecast_ledger'),
  ('public', 'forge_served_forecast_universe'),
  ('public', 'forge_team_game_strength'),
  ('public', 'games'),
  ('public', 'goalie_totals_unified'),
  ('public', 'goaliesGameStats'),
  ('public', 'nst_seasonlong_5v5_counts'),
  ('public', 'nst_seasonlong_5v5_counts_oi'),
  ('public', 'nst_seasonlong_5v5_rates'),
  ('public', 'player_forecast_accountability_revisions'),
  ('public', 'player_forecast_season_player_aggregates'),
  ('public', 'player_forecast_season_release_players'),
  ('public', 'powerPlayCombinations'),
  ('public', 'pp_team_game_clock'),
  ('public', 'predictions_sko_vdp'),
  ('public', 'sos_standings'),
  ('public', 'teamGameStats'),
  ('public', 'team_ctpi_daily'),
  ('public', 'team_sos_daily')
), relations AS (
  SELECT a.*, c.oid, c.relkind, c.relowner, c.relrowsecurity, c.relforcerowsecurity, c.reloptions, c.relacl
  FROM allowed a LEFT JOIN pg_catalog.pg_namespace n ON n.nspname=a.schema_name
  LEFT JOIN pg_catalog.pg_class c ON c.relnamespace=n.oid AND c.relname=a.object_name
)
, role_names(role_name) AS (VALUES ('anon'),('authenticated'),('service_role')),
roles AS (SELECT n.role_name,r.oid AS role_oid,r.rolbypassrls FROM role_names n LEFT JOIN pg_catalog.pg_roles r ON r.rolname=n.role_name),
function_allowlist(signature) AS (VALUES
  ('fhfh_internal.reject_ctpi_v1_write()'),
  ('fhfh_internal.reject_sos_v1_write()'),
  ('public.forge_league_skater_physical_totals(integer,date)'),
  ('public.persist_projection_game_derived_v1(bigint,text,bigint,text,text,jsonb,jsonb,jsonb,integer,integer,integer,text,text)'),
  ('public.persist_projection_game_derived_v2(bigint,text,bigint,text,text,jsonb,jsonb,jsonb,integer,integer,integer,text,text)'),
  ('public.replace_power_play_game_v1(bigint,text,timestamp with time zone,jsonb,jsonb)')
), grants AS (
  SELECT r.schema_name||'.'||r.object_name AS object_identity,'relation'::text AS kind,
    z.role_name,z.role_oid,z.role_oid IS NOT NULL AS role_found,z.rolbypassrls,
    pg_catalog.has_table_privilege(z.role_oid,r.oid,'SELECT') AS can_select,
    pg_catalog.has_table_privilege(z.role_oid,r.oid,'INSERT') AS can_insert,
    pg_catalog.has_table_privilege(z.role_oid,r.oid,'UPDATE') AS can_update,
    pg_catalog.has_table_privilege(z.role_oid,r.oid,'DELETE') AS can_delete,
    pg_catalog.has_table_privilege(z.role_oid,r.oid,'TRUNCATE') AS can_truncate,
    pg_catalog.has_table_privilege(z.role_oid,r.oid,'REFERENCES') AS can_references,
    pg_catalog.has_table_privilege(z.role_oid,r.oid,'TRIGGER') AS can_trigger,
    NULL::boolean AS can_execute
  FROM relations r CROSS JOIN roles z
  UNION ALL
  SELECT f.signature,'function',z.role_name,z.role_oid,z.role_oid IS NOT NULL,z.rolbypassrls,
    NULL,NULL,NULL,NULL,NULL,NULL,NULL,
    pg_catalog.has_function_privilege(z.role_oid,pg_catalog.to_regprocedure(f.signature),'EXECUTE')
  FROM function_allowlist f CROSS JOIN roles z
)
SELECT * FROM grants ORDER BY object_identity,role_name LIMIT 82;
COMMIT;

-- Q7: two exact schemas x3 known roles; schema ACL/USAGE/CREATE only. Limit7 sentinel.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '5s';
SET LOCAL lock_timeout = '1s';
SET LOCAL idle_in_transaction_session_timeout = '15s';
WITH schema_names(schema_name) AS (VALUES ('public'),('fhfh_internal')),
role_names(role_name) AS (VALUES ('anon'),('authenticated'),('service_role'))
SELECT a.schema_name,n.oid IS NOT NULL AS schema_found,
  pg_catalog.pg_get_userbyid(n.nspowner) AS owner_role,n.nspacl::text AS raw_acl,
  z.role_name,r.oid AS role_oid,r.oid IS NOT NULL AS role_found,
  pg_catalog.has_schema_privilege(r.oid,n.oid,'USAGE') AS can_use,
  pg_catalog.has_schema_privilege(r.oid,n.oid,'CREATE') AS can_create
FROM schema_names a LEFT JOIN pg_catalog.pg_namespace n ON n.nspname=a.schema_name
CROSS JOIN role_names z LEFT JOIN pg_catalog.pg_roles r ON r.rolname=z.role_name
ORDER BY a.schema_name,z.role_name LIMIT 7;
COMMIT;
