-- PROPOSAL ONLY. Line R2 (E2 pre-cutover and post-cutover readback). READ ONLY; catalog and session COUNTS only:
-- no query text, no secret values, no row data. BLSH Chef approves before it runs on production.
begin transaction read only;
set local statement_timeout = '15s';
-- 1. Who is connected right now (counts only). Run before E2 step 4 and again after step 5.
select 'session' as fact, coalesce(usename, '<none>') as usename, coalesce(nullif(application_name, ''), '<blank>') as application_name,
       coalesce(host(client_addr), '<local>') as client_addr, backend_type, count(*) as sessions,
       min(date_trunc('minute', backend_start)) as oldest_backend_start
  from pg_catalog.pg_stat_activity group by 2, 3, 4, 5 order by 2, 3, 4, 5;
-- 2. Privileges the app's service_role holds on the scheduler, pg_net and their tables (cron/net reach, DoS analysis).
select 'service_role_fn' as fact, f as function,
       case when pg_catalog.to_regprocedure(f) is null then null else pg_catalog.has_function_privilege('service_role', pg_catalog.to_regprocedure(f), 'execute') end as can_execute
  from unnest(array['cron.schedule(text,text,text)', 'cron.schedule(text,text)', 'cron.unschedule(bigint)', 'cron.unschedule(text)',
                    'cron.alter_job(bigint,text,text,text,text,boolean)', 'net.http_post(text,jsonb,jsonb,jsonb,integer)',
                    'net.http_get(text,jsonb,jsonb,integer)', 'public.execute_sql(text)']) f order by 2;
select 'service_role_rel' as fact, r as relation,
       case when pg_catalog.to_regclass(r) is null then null else pg_catalog.has_table_privilege('service_role', pg_catalog.to_regclass(r), 'select') end as can_select,
       case when pg_catalog.to_regclass(r) is null then null else pg_catalog.has_table_privilege('service_role', pg_catalog.to_regclass(r), 'insert,update,delete') end as can_write
  from unnest(array['cron.job', 'cron.job_run_details', 'net.http_request_queue', 'net._http_response']) r order by 2;
-- 3. pg_cron health in the last 60 minutes (status counts only; run before and after the reset).
select 'cron_runs_last_60m' as fact,
       case when pg_catalog.to_regclass('cron.job_run_details') is null then null
            else (xpath('/row/c/text()', query_to_xml($q$select string_agg(status || ':' || n, ',' order by status) as c
                   from (select status, count(*) n from cron.job_run_details where start_time > now() - interval '60 minutes' group by status) s$q$,
                   false, true, '')))[1]::text end as status_counts;
-- 4. Can the project owner end its own role's sessions (needed for E2 step 6)?
select 'terminate' as fact, pg_catalog.pg_has_role('postgres', 'pg_signal_backend', 'member') as postgres_has_pg_signal_backend,
       (select rolsuper from pg_catalog.pg_roles where rolname = 'postgres') as postgres_is_super;
rollback;
