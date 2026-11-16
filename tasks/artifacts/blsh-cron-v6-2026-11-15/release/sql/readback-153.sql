-- Migration 153 readback (read-only). One '|'-separated line; expected value in PREFLIGHT-AND-APPLY.md.
-- Fields: ledger | rls_tables | guard_triggers | svc_table_privs | other_table_privs | public_table_grants | functions |
--         secdef_empty_path | svc_execute | anon_auth_execute | public_execute | bucket | kill_switch | rows
begin read only;
set local statement_timeout = '5s';
with t as (select c.oid, c.relname, c.relacl, c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relkind = 'r' and c.relname in ('blsh_capture_control', 'blsh_capture_runs', 'blsh_capture_objects')),
     f as (select p.oid, p.proname, p.prosecdef, p.proconfig, p.proacl from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname like 'blsh\_capture\_%'),
     privs as (select unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) as p)
select
  (select count(*) from supabase_migrations.schema_migrations where version = '20261116000000' and name = 'blsh_native_capture_v6'),
  (select count(*) from t where relrowsecurity),
  (select count(*) from pg_trigger g join t on t.oid = g.tgrelid where g.tgname in ('blsh_capture_runs_guard', 'blsh_capture_objects_guard') and g.tgenabled = 'O'),
  (select string_agg(t.relname || ':' || privs.p, ',' order by t.relname, privs.p) from t cross join privs where has_table_privilege('service_role', t.oid, privs.p)),
  (select count(*) from t cross join privs cross join (values ('anon'), ('authenticated')) r(role) where has_table_privilege(r.role, t.oid, privs.p)),
  (select count(*) from t where exists (select 1 from aclexplode(t.relacl) a where a.grantee = 0)),
  (select count(*) from f),
  (select count(*) from f where prosecdef and proconfig = array['search_path=""']),
  (select string_agg(proname, ',' order by proname) from f where has_function_privilege('service_role', oid, 'EXECUTE')),
  (select count(*) from f cross join (values ('anon'), ('authenticated')) r(role) where has_function_privilege(r.role, f.oid, 'EXECUTE')),
  (select count(*) from f where exists (select 1 from aclexplode(f.proacl) a where a.grantee = 0)),
  coalesce((select b.public::text || ',' || b.file_size_limit || ',' || b.allowed_mime_types::text from storage.buckets b where b.id = 'blsh-native-packets'), 'absent'),
  (select enabled from public.blsh_capture_control where singleton),
  (select count(*) from public.blsh_capture_runs) + (select count(*) from public.blsh_capture_objects);
rollback;
