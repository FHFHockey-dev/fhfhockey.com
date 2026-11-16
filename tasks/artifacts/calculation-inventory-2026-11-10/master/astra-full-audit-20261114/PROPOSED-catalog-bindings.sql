-- PROPOSAL ONLY. Not approved or executed. Project fyhftlxokyjtpndbkfse.
-- Run Q1 alone and inspect it, then one block at a time. Concurrency 1, no retries.
-- Stop if active_others >5, max_active_seconds >10, visibility_unknown >0,
-- any error, missing expected object or row-limit sentinel. Roll back an aborted
-- transaction then stop. No app data, query text, RPC execution or writes.
-- Q1: one hygiene row.
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

-- Q2: 27 rules; limit28 sentinel.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '5s';
SET LOCAL lock_timeout = '1s';
SET LOCAL idle_in_transaction_session_timeout = '15s';
WITH wanted(name) AS (VALUES
    ('gameOutcomes'),
    ('goalie_totals_unified'),
    ('goalie_weekly_aggregates'),
    ('league_weekly_goalie_averages'),
    ('nhl_team_data'),
    ('nst_seasonlong_5v5_counts'),
    ('nst_seasonlong_5v5_counts_oi'),
    ('nst_seasonlong_5v5_rates'),
    ('nst_seasonlong_as_counts'),
    ('nst_seasonlong_as_counts_oi'),
    ('nst_seasonlong_as_rates'),
    ('nst_seasonlong_as_rates_oi'),
    ('nst_seasonlong_es_counts'),
    ('nst_seasonlong_es_counts_oi'),
    ('nst_seasonlong_es_rates'),
    ('nst_seasonlong_es_rates_oi'),
    ('nst_seasonlong_pk_counts'),
    ('nst_seasonlong_pk_counts_oi'),
    ('nst_seasonlong_pk_rates'),
    ('nst_seasonlong_pk_rates_oi'),
    ('nst_seasonlong_pp_counts'),
    ('nst_seasonlong_pp_counts_oi'),
    ('nst_seasonlong_pp_rates'),
    ('nst_seasonlong_pp_rates_oi'),
    ('predictions_sko_vdp'),
    ('wgo_goalie_stats_per_game'),
    ('wgo_skater_stats_per_game')
), targets AS (SELECT c.oid,c.relname FROM wanted w LEFT JOIN pg_catalog.pg_class c ON c.relnamespace='public'::regnamespace AND c.relname=w.name)
SELECT t.relname,t.oid,r.ev_action::text AS compiled_rule,pg_catalog.pg_get_viewdef(t.oid,true) AS definition FROM targets t LEFT JOIN pg_catalog.pg_rewrite r ON r.ev_class=t.oid AND r.rulename='_RETURN' ORDER BY t.relname LIMIT 28;
COMMIT;

-- Q3: dependencies; limit2001 sentinel.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '5s';
SET LOCAL lock_timeout = '1s';
SET LOCAL idle_in_transaction_session_timeout = '15s';
WITH wanted(name) AS (VALUES
    ('gameOutcomes'),
    ('goalie_totals_unified'),
    ('goalie_weekly_aggregates'),
    ('league_weekly_goalie_averages'),
    ('nhl_team_data'),
    ('nst_seasonlong_5v5_counts'),
    ('nst_seasonlong_5v5_counts_oi'),
    ('nst_seasonlong_5v5_rates'),
    ('nst_seasonlong_as_counts'),
    ('nst_seasonlong_as_counts_oi'),
    ('nst_seasonlong_as_rates'),
    ('nst_seasonlong_as_rates_oi'),
    ('nst_seasonlong_es_counts'),
    ('nst_seasonlong_es_counts_oi'),
    ('nst_seasonlong_es_rates'),
    ('nst_seasonlong_es_rates_oi'),
    ('nst_seasonlong_pk_counts'),
    ('nst_seasonlong_pk_counts_oi'),
    ('nst_seasonlong_pk_rates'),
    ('nst_seasonlong_pk_rates_oi'),
    ('nst_seasonlong_pp_counts'),
    ('nst_seasonlong_pp_counts_oi'),
    ('nst_seasonlong_pp_rates'),
    ('nst_seasonlong_pp_rates_oi'),
    ('predictions_sko_vdp'),
    ('wgo_goalie_stats_per_game'),
    ('wgo_skater_stats_per_game')
), targets AS (SELECT c.oid,c.relname FROM wanted w LEFT JOIN pg_catalog.pg_class c ON c.relnamespace='public'::regnamespace AND c.relname=w.name)
SELECT t.relname,d.refclassid,d.refobjid,d.refobjsubid,d.deptype,pg_catalog.pg_describe_object(d.refclassid,d.refobjid,d.refobjsubid) AS dependency FROM targets t JOIN pg_catalog.pg_rewrite r ON r.ev_class=t.oid AND r.rulename='_RETURN' JOIN pg_catalog.pg_depend d ON d.classid='pg_catalog.pg_rewrite'::regclass AND d.objid=r.oid ORDER BY t.relname,d.refclassid,d.refobjid,d.refobjsubid LIMIT 2001;
COMMIT;

-- Q4: referenced relation columns; limit2001 sentinel.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '5s';
SET LOCAL lock_timeout = '1s';
SET LOCAL idle_in_transaction_session_timeout = '15s';
WITH wanted(name) AS (VALUES
    ('gameOutcomes'),
    ('goalie_totals_unified'),
    ('goalie_weekly_aggregates'),
    ('league_weekly_goalie_averages'),
    ('nhl_team_data'),
    ('nst_seasonlong_5v5_counts'),
    ('nst_seasonlong_5v5_counts_oi'),
    ('nst_seasonlong_5v5_rates'),
    ('nst_seasonlong_as_counts'),
    ('nst_seasonlong_as_counts_oi'),
    ('nst_seasonlong_as_rates'),
    ('nst_seasonlong_as_rates_oi'),
    ('nst_seasonlong_es_counts'),
    ('nst_seasonlong_es_counts_oi'),
    ('nst_seasonlong_es_rates'),
    ('nst_seasonlong_es_rates_oi'),
    ('nst_seasonlong_pk_counts'),
    ('nst_seasonlong_pk_counts_oi'),
    ('nst_seasonlong_pk_rates'),
    ('nst_seasonlong_pk_rates_oi'),
    ('nst_seasonlong_pp_counts'),
    ('nst_seasonlong_pp_counts_oi'),
    ('nst_seasonlong_pp_rates'),
    ('nst_seasonlong_pp_rates_oi'),
    ('predictions_sko_vdp'),
    ('wgo_goalie_stats_per_game'),
    ('wgo_skater_stats_per_game')
), targets AS (SELECT c.oid,c.relname FROM wanted w LEFT JOIN pg_catalog.pg_class c ON c.relnamespace='public'::regnamespace AND c.relname=w.name)
SELECT DISTINCT n.nspname,c.relname,a.attnum,a.attname,a.atttypid,a.atttypmod,pg_catalog.format_type(a.atttypid,a.atttypmod) AS type FROM targets t JOIN pg_catalog.pg_rewrite r ON r.ev_class=t.oid AND r.rulename='_RETURN' JOIN pg_catalog.pg_depend d ON d.classid='pg_catalog.pg_rewrite'::regclass AND d.objid=r.oid AND d.refclassid='pg_catalog.pg_class'::regclass JOIN pg_catalog.pg_class c ON c.oid=d.refobjid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace JOIN pg_catalog.pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped ORDER BY n.nspname,c.relname,a.attnum LIMIT 2001;
COMMIT;
