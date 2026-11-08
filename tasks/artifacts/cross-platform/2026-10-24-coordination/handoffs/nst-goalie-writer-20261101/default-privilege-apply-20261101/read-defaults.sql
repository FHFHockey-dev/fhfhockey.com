select statement_timestamp() as checked_at,current_database() as database_name,current_user as execution_role,session_user,
 (select coalesce(jsonb_agg(to_jsonb(d)),'[]'::jsonb) from (
  select pg_get_userbyid(a.defaclrole) as creator_role,coalesce(n.nspname,'GLOBAL') as schema_name,
   a.defaclobjtype,a.defaclacl from pg_default_acl a left join pg_namespace n on n.oid=a.defaclnamespace
  where a.defaclnamespace=0 or n.nspname='public'
  order by creator_role,schema_name,a.defaclobjtype limit 100
 ) d) as defaults,
 (select jsonb_build_object('count',count(*),'acl_fingerprint',md5(string_agg(x.object_key||':'||x.acl,'|' order by x.object_key)))
  from (
   select 'relation:'||c.oid::text as object_key,coalesce(c.relacl::text,'NULL') as acl from pg_class c where c.relnamespace='public'::regnamespace
   union all
   select 'routine:'||p.oid::text,coalesce(p.proacl::text,'NULL') from pg_proc p where p.pronamespace='public'::regnamespace
  ) x) as existing_public_object_acls,
 (select coalesce(jsonb_agg(jsonb_build_object('version',m.version,'name',to_jsonb(m)->>'name')),'[]'::jsonb)
   from (select * from supabase_migrations.schema_migrations where version='20261020224500'
    or to_jsonb(schema_migrations)->>'name'='data_api_explicit_default_privileges' order by version limit 10) m) as matching_history,
 (select jsonb_agg(jsonb_build_object('name',name,'relation',to_regclass('public.'||name)::text))
  from (values ('nst_request_admission_state'),('nst_goalie_control'),('nst_job_control')) v(name)) as nst_controls;
