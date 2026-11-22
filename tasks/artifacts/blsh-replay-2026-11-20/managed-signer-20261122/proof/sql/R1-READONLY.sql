-- PROPOSAL ONLY. Line R1: read-only facts that decide whether ANY Supabase-hosted approval can be independent of the Vercel app.
-- Run once by the operator path (as postgres), inside a READ ONLY transaction. Reads catalog metadata only: no secret values,
-- no row data. BLSH Chef must approve before it runs.
begin transaction read only;
set local statement_timeout = '15s';
-- 1. Who owns public.execute_sql(text) (SECURITY DEFINER, arbitrary SQL), and who may execute it.
select 'execute_sql' as fact, p.proowner::regrole::text as owner, p.prosecdef as security_definer,
       pg_catalog.has_function_privilege('service_role', p.oid, 'execute') as service_role_can_execute
  from pg_catalog.pg_proc p where p.oid = to_regprocedure('public.execute_sql(text)');
-- 2. Every other SECURITY DEFINER function service_role may execute whose body runs dynamic SQL.
select 'definer_dynamic_sql' as fact, p.oid::regprocedure::text as function, p.proowner::regrole::text as owner
  from pg_catalog.pg_proc p
 where p.prosecdef and pg_catalog.has_function_privilege('service_role', p.oid, 'execute')
   and p.prosrc ~* '\mexecute\M\s+(?!function|procedure)' order by 2;
-- 3. service_role's role memberships and attributes.
select 'service_role' as fact, r.rolsuper, r.rolcreaterole, r.rolbypassrls,
       (select string_agg(m.roleid::regrole::text, ',' order by 1) from pg_catalog.pg_auth_members m where m.member = r.oid) as member_of
  from pg_catalog.pg_roles r where r.rolname = 'service_role';
-- 4. Vault: grantor and privilege of every grant to service_role on vault relations.
select 'vault_grant' as fact, table_name, privilege_type, grantor
  from information_schema.role_table_grants where table_schema = 'vault' and grantee = 'service_role' order by 2, 3;
-- 5. fhfh_internal: owner, and whether service_role holds USAGE or default privileges there.
select 'fhfh_internal' as fact, n.nspowner::regrole::text as owner, pg_catalog.has_schema_privilege('service_role', n.oid, 'usage') as service_role_usage,
       (select count(*) from pg_catalog.pg_default_acl d where d.defaclnamespace = n.oid) as default_acl_entries
  from pg_catalog.pg_namespace n where n.nspname = 'fhfh_internal';
-- 6. Extension versions the design relies on.
select 'extension' as fact, extname, extversion from pg_catalog.pg_extension where extname in ('pg_cron', 'pg_net', 'supabase_vault', 'pgsodium') order by 2;
rollback;
