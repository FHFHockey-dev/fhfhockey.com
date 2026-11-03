-- PREPARED ONLY. Run after an explicitly approved successful install.
-- Bounded SELECTs only; never invoke nst_admit_attempt_v1 as verification.
select statement_timestamp() as checked_at,current_database() as database_name,current_user as execution_role,
 (select jsonb_build_object('owner',pg_get_userbyid(c.relowner),'rls',c.relrowsecurity,'acl',c.relacl)
  from pg_class c where c.oid='public.nst_request_admission_state'::regclass) as relation,
 (select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) from (
  select singleton,cardinality(attempts) as attempt_count,last_spacing_ms
  from public.nst_request_admission_state order by singleton limit 2
 ) r) as seed,
 (select jsonb_build_object('owner',pg_get_userbyid(p.proowner),'security_definer',p.prosecdef,
   'config',p.proconfig,'acl',p.proacl,'body',p.prosrc,'definition',pg_get_functiondef(p.oid))
  from pg_proc p where p.oid='public.nst_admit_attempt_v1(boolean,integer)'::regprocedure) as routine,
 (select jsonb_agg(jsonb_build_object('role',r.name,
   'select',has_table_privilege(r.name,'public.nst_request_admission_state','SELECT'),
   'update',has_table_privilege(r.name,'public.nst_request_admission_state','UPDATE'),
   'insert',has_table_privilege(r.name,'public.nst_request_admission_state','INSERT'),
   'delete',has_table_privilege(r.name,'public.nst_request_admission_state','DELETE'),
   'truncate',has_table_privilege(r.name,'public.nst_request_admission_state','TRUNCATE'),
   'execute',has_function_privilege(r.name,'public.nst_admit_attempt_v1(boolean,integer)','EXECUTE')))
  from (values ('anon'),('authenticated'),('service_role')) r(name)) as effective_privileges,
 (select coalesce(jsonb_agg(jsonb_build_object('version',version,'name',to_jsonb(m)->>'name')),'[]'::jsonb)
  from (select * from supabase_migrations.schema_migrations where to_jsonb(schema_migrations)->>'name'='nst_shared_admission_v1'
    order by version desc limit 2) m) as history,
 to_regclass('public.nst_goalie_control')::text as goalie_control,
 to_regclass('public.nst_job_control')::text as job_control;
-- Expect one true singleton, zero attempts and spacing22000 if unused;
-- any attempts mean a consumer used it: preserve state and investigate, never reset.
-- Expect service_role SELECT/UPDATE/EXECUTE only; anon/authenticated all false;
-- additionally inspect raw ACLs for no PUBLIC grant. Both future controls absent.
-- Compare prosrc byte-for-byte with accepted AS $$ body; pg_get_functiondef
-- formatting need not equal source-file formatting. Record generated history version.
