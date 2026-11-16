-- PREPARED ONLY. NOT EXECUTED. Requires direct TJ approval of this exact first batch.
-- Never run this file as a whole. Execute Q1 alone; review its one-row result and STOP
-- if active_others > 5, max_active_seconds > 10, visibility_unknown > 0, or any error.
-- Only then execute Q2..Q6 individually, sequentially, no retry. Any timeout/error,
-- missing object, unexpected kind or returned sentinel limit ends this batch.
-- No application rows, RPC invocation, refresh, EXPLAIN, application view execution,
-- query text, credentials, JSON payload, schema writes or migration application.
-- ROLLBACK an aborted transaction before stopping; do not retry the failed SELECT.

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

-- Q2: 24 exact relations: identity, view definition, ACL/RLS. Limit25 sentinel.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '5s';
SET LOCAL lock_timeout = '1s';
SET LOCAL idle_in_transaction_session_timeout = '15s';
WITH allowed(schema_name, object_name) AS (VALUES
  ('public', 'gameOutcomes'),
  ('public', 'goalie_weekly_aggregates'),
  ('public', 'league_weekly_goalie_averages'),
  ('public', 'nhl_team_data'),
  ('public', 'nst_seasonlong_as_counts'),
  ('public', 'nst_seasonlong_as_counts_oi'),
  ('public', 'nst_seasonlong_as_rates'),
  ('public', 'nst_seasonlong_as_rates_oi'),
  ('public', 'nst_seasonlong_es_counts'),
  ('public', 'nst_seasonlong_es_counts_oi'),
  ('public', 'nst_seasonlong_es_rates'),
  ('public', 'nst_seasonlong_es_rates_oi'),
  ('public', 'nst_seasonlong_pk_counts'),
  ('public', 'nst_seasonlong_pk_counts_oi'),
  ('public', 'nst_seasonlong_pk_rates'),
  ('public', 'nst_seasonlong_pk_rates_oi'),
  ('public', 'nst_seasonlong_pp_counts'),
  ('public', 'nst_seasonlong_pp_counts_oi'),
  ('public', 'nst_seasonlong_pp_rates'),
  ('public', 'nst_seasonlong_pp_rates_oi'),
  ('public', 'player_lineup_deployment_tallies'),
  ('public', 'skatersGameStats'),
  ('public', 'wgo_goalie_stats_per_game'),
  ('public', 'wgo_skater_stats_per_game')
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

-- Q3: 4 exact function signatures; definitions only, NEVER invoke. Limit5 sentinel.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '5s';
SET LOCAL lock_timeout = '1s';
SET LOCAL idle_in_transaction_session_timeout = '15s';
WITH allowed(signature) AS (VALUES
  ('public.get_skater_game_scores_for_season(integer,integer)'),
  ('public.get_skaters_avg_stats(date,date)'),
  ('public.refresh_player_lineup_deployment_tallies(integer,bigint)'),
  ('public.persist_complete_game_stats_v1(bigint,jsonb,jsonb,jsonb,integer,integer,integer)')
), functions AS (SELECT a.signature, p.* FROM allowed a
  LEFT JOIN pg_catalog.pg_proc p ON p.oid=pg_catalog.to_regprocedure(a.signature))
SELECT signature, oid IS NOT NULL AS found,
  pg_catalog.pg_get_userbyid(proowner) AS owner_role,
  prosecdef, provolatile, proisstrict, proparallel, proconfig, proacl::text AS raw_acl,
  pg_catalog.pg_get_function_identity_arguments(oid) AS identity_arguments,
  pg_catalog.pg_get_function_result(oid) AS result_type,
  prosrc AS body_text, pg_catalog.md5(prosrc) AS raw_body_md5,
  pg_catalog.pg_get_functiondef(oid) AS full_definition
FROM functions ORDER BY signature LIMIT 5;
COMMIT;

-- Q4: columns/defaults/column ACL for24 exact relations; limit2001 sentinel.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '5s';
SET LOCAL lock_timeout = '1s';
SET LOCAL idle_in_transaction_session_timeout = '15s';
WITH allowed(schema_name, object_name) AS (VALUES
  ('public', 'gameOutcomes'),
  ('public', 'goalie_weekly_aggregates'),
  ('public', 'league_weekly_goalie_averages'),
  ('public', 'nhl_team_data'),
  ('public', 'nst_seasonlong_as_counts'),
  ('public', 'nst_seasonlong_as_counts_oi'),
  ('public', 'nst_seasonlong_as_rates'),
  ('public', 'nst_seasonlong_as_rates_oi'),
  ('public', 'nst_seasonlong_es_counts'),
  ('public', 'nst_seasonlong_es_counts_oi'),
  ('public', 'nst_seasonlong_es_rates'),
  ('public', 'nst_seasonlong_es_rates_oi'),
  ('public', 'nst_seasonlong_pk_counts'),
  ('public', 'nst_seasonlong_pk_counts_oi'),
  ('public', 'nst_seasonlong_pk_rates'),
  ('public', 'nst_seasonlong_pk_rates_oi'),
  ('public', 'nst_seasonlong_pp_counts'),
  ('public', 'nst_seasonlong_pp_counts_oi'),
  ('public', 'nst_seasonlong_pp_rates'),
  ('public', 'nst_seasonlong_pp_rates_oi'),
  ('public', 'player_lineup_deployment_tallies'),
  ('public', 'skatersGameStats'),
  ('public', 'wgo_goalie_stats_per_game'),
  ('public', 'wgo_skater_stats_per_game')
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
ORDER BY r.schema_name,r.object_name,a.attnum LIMIT 2001;
COMMIT;

-- Q5: constraints/indexes/triggers/RLS policies for24 exact relations; limit513 sentinel.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '5s';
SET LOCAL lock_timeout = '1s';
SET LOCAL idle_in_transaction_session_timeout = '15s';
WITH allowed(schema_name, object_name) AS (VALUES
  ('public', 'gameOutcomes'),
  ('public', 'goalie_weekly_aggregates'),
  ('public', 'league_weekly_goalie_averages'),
  ('public', 'nhl_team_data'),
  ('public', 'nst_seasonlong_as_counts'),
  ('public', 'nst_seasonlong_as_counts_oi'),
  ('public', 'nst_seasonlong_as_rates'),
  ('public', 'nst_seasonlong_as_rates_oi'),
  ('public', 'nst_seasonlong_es_counts'),
  ('public', 'nst_seasonlong_es_counts_oi'),
  ('public', 'nst_seasonlong_es_rates'),
  ('public', 'nst_seasonlong_es_rates_oi'),
  ('public', 'nst_seasonlong_pk_counts'),
  ('public', 'nst_seasonlong_pk_counts_oi'),
  ('public', 'nst_seasonlong_pk_rates'),
  ('public', 'nst_seasonlong_pk_rates_oi'),
  ('public', 'nst_seasonlong_pp_counts'),
  ('public', 'nst_seasonlong_pp_counts_oi'),
  ('public', 'nst_seasonlong_pp_rates'),
  ('public', 'nst_seasonlong_pp_rates_oi'),
  ('public', 'player_lineup_deployment_tallies'),
  ('public', 'skatersGameStats'),
  ('public', 'wgo_goalie_stats_per_game'),
  ('public', 'wgo_skater_stats_per_game')
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
    pg_catalog.pg_get_triggerdef(t.oid,false),('enabled='||t.tgenabled::text||';internal='||t.tgisinternal::text)
  FROM relations r JOIN pg_catalog.pg_trigger t ON t.tgrelid=r.oid
  UNION ALL
  SELECT r.schema_name,r.object_name,'policy',p.polname::text,
    ('USING ('||coalesce(pg_catalog.pg_get_expr(p.polqual,p.polrelid,false),'NULL')||') WITH CHECK ('||
      coalesce(pg_catalog.pg_get_expr(p.polwithcheck,p.polrelid,false),'NULL')||')'),
    ('command='||p.polcmd::text||';permissive='||p.polpermissive::text||';role_oids='||p.polroles::text)
  FROM relations r JOIN pg_catalog.pg_policy p ON p.polrelid=r.oid
)
SELECT * FROM metadata ORDER BY schema_name,object_name,kind,name LIMIT 513;
COMMIT;

-- Q6: effective grants for known app roles; raw PUBLIC/default ACLs are inQ2/Q3/Q4. Limit85 sentinel.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '5s';
SET LOCAL lock_timeout = '1s';
SET LOCAL idle_in_transaction_session_timeout = '15s';
WITH allowed(schema_name, object_name) AS (VALUES
  ('public', 'gameOutcomes'),
  ('public', 'goalie_weekly_aggregates'),
  ('public', 'league_weekly_goalie_averages'),
  ('public', 'nhl_team_data'),
  ('public', 'nst_seasonlong_as_counts'),
  ('public', 'nst_seasonlong_as_counts_oi'),
  ('public', 'nst_seasonlong_as_rates'),
  ('public', 'nst_seasonlong_as_rates_oi'),
  ('public', 'nst_seasonlong_es_counts'),
  ('public', 'nst_seasonlong_es_counts_oi'),
  ('public', 'nst_seasonlong_es_rates'),
  ('public', 'nst_seasonlong_es_rates_oi'),
  ('public', 'nst_seasonlong_pk_counts'),
  ('public', 'nst_seasonlong_pk_counts_oi'),
  ('public', 'nst_seasonlong_pk_rates'),
  ('public', 'nst_seasonlong_pk_rates_oi'),
  ('public', 'nst_seasonlong_pp_counts'),
  ('public', 'nst_seasonlong_pp_counts_oi'),
  ('public', 'nst_seasonlong_pp_rates'),
  ('public', 'nst_seasonlong_pp_rates_oi'),
  ('public', 'player_lineup_deployment_tallies'),
  ('public', 'skatersGameStats'),
  ('public', 'wgo_goalie_stats_per_game'),
  ('public', 'wgo_skater_stats_per_game')
), relations AS (
  SELECT a.*, c.oid, c.relkind, c.relowner, c.relrowsecurity, c.relforcerowsecurity, c.reloptions, c.relacl
  FROM allowed a LEFT JOIN pg_catalog.pg_namespace n ON n.nspname=a.schema_name
  LEFT JOIN pg_catalog.pg_class c ON c.relnamespace=n.oid AND c.relname=a.object_name
)
, role_names(role_name) AS (VALUES ('anon'),('authenticated'),('service_role')),
roles AS (SELECT n.role_name,r.oid AS role_oid,r.rolbypassrls FROM role_names n LEFT JOIN pg_catalog.pg_roles r ON r.rolname=n.role_name),
function_allowlist(signature) AS (VALUES
  ('public.get_skater_game_scores_for_season(integer,integer)'),
  ('public.get_skaters_avg_stats(date,date)'),
  ('public.refresh_player_lineup_deployment_tallies(integer,bigint)'),
  ('public.persist_complete_game_stats_v1(bigint,jsonb,jsonb,jsonb,integer,integer,integer)')
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
SELECT * FROM grants ORDER BY object_identity,role_name LIMIT 85;
COMMIT;

