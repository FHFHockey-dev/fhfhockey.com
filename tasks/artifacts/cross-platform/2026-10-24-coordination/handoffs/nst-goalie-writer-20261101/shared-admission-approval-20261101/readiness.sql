-- Bounded read-only readiness check. No admission RPC call or table creation.
select statement_timestamp() as checked_at,current_database() as database_name,current_user as execution_role,
 to_regclass('public.nst_request_admission_state')::text as admission_relation,
 to_regclass('public.nst_goalie_control')::text as goalie_control_relation,
 to_regclass('public.nst_job_control')::text as job_control_relation,
 (select coalesce(jsonb_agg(to_jsonb(p)),'[]'::jsonb) from (
  select oid::regprocedure::text as signature,pg_get_userbyid(proowner) as owner
  from pg_proc where pronamespace='public'::regnamespace
   and proname in ('nst_admit_attempt_v1','nst_admit_attempt_budget_v1','nst_admit_job_attempt_v1')
  order by proname,oid limit 10
 ) p) as admission_routines,
 (select coalesce(jsonb_agg(to_jsonb(d)),'[]'::jsonb) from (
  select coalesce(n.nspname,'GLOBAL') as schema_name,a.defaclobjtype,a.defaclacl
  from pg_default_acl a left join pg_namespace n on n.oid=a.defaclnamespace
  where a.defaclrole='postgres'::regrole and (a.defaclnamespace=0 or n.nspname='public')
  order by schema_name,a.defaclobjtype limit 10
 ) d) as postgres_defaults,
 has_schema_privilege('service_role','public','USAGE') as service_schema_usage,
 exists(select 1 from pg_language where lanname='plpgsql') as plpgsql_available,
 (select coalesce(jsonb_agg(jsonb_build_object('version',m.version,'name',to_jsonb(m)->>'name')),'[]'::jsonb)
  from (select * from supabase_migrations.schema_migrations
    where version='20261101183548' or to_jsonb(schema_migrations)->>'name' in ('nst_shared_admission_v1','data_api_explicit_default_privileges')
    order by version limit 10) m) as matching_history;
