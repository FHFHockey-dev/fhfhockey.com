-- Migration 154 readback (read-only). One '|'-separated line; expected value in PREFLIGHT-AND-APPLY.md.
-- Fields: ledger | functions | volatility | secdef | config | owner_is_current_user | svc_execute | anon_execute | auth_execute | public_execute
begin read only;
set local statement_timeout = '5s';
select
  (select count(*) from supabase_migrations.schema_migrations where version = '20261116000100' and name = 'blsh_request_context_v1'),
  count(*), max(p.provolatile), bool_and(p.prosecdef), max(p.proconfig::text), bool_and(p.proowner = (select oid from pg_roles where rolname = current_user)),
  bool_and(has_function_privilege('service_role', p.oid, 'EXECUTE')), bool_or(has_function_privilege('anon', p.oid, 'EXECUTE')),
  bool_or(has_function_privilege('authenticated', p.oid, 'EXECUTE')), bool_or(exists (select 1 from aclexplode(p.proacl) a where a.grantee = 0))
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'blsh_request_context_v1' and p.oid::regprocedure::text = 'blsh_request_context_v1(date,date)';
rollback;
