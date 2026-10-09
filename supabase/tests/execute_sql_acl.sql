-- psql-only fixture. Run in a NEW, empty LOCAL database named
-- task1_execute_sql_acl_test, as a local superuser. Never use a Supabase DB.
-- No routine is invoked; this tests the exact migration against catalog ACLs.
\set ON_ERROR_STOP on
begin;
do $$
begin
  if current_database() <> 'task1_execute_sql_acl_test'
     or to_regprocedure('public.execute_sql(text)') is not null
     or exists (select 1 from pg_roles where rolname in
       ('anon', 'authenticated', 'service_role', 'task1_acl_owner')) then
    raise exception 'Requires empty isolated Task #1 database and fresh roles';
  end if;
end;
$$;

create role anon nologin;
create role authenticated nologin;
create role service_role nologin;
create role task1_acl_owner nologin bypassrls;
create function public.execute_sql(sql_statement text) returns void
language plpgsql security definer
set search_path = pg_catalog, public, extensions, pg_temp
as $$ begin raise exception 'Fixture must never be invoked'; end; $$;
alter function public.execute_sql(text) owner to task1_acl_owner;
grant execute on function public.execute_sql(text)
to public, anon, authenticated, service_role;

-- An unrelated function must retain its original grants.
create function public.task1_acl_sentinel() returns void language plpgsql
as $$ begin raise exception 'Fixture must never be invoked'; end; $$;
create temporary table task1_before as
select p.oid, p.proowner, p.prosecdef, p.proconfig, p.prosrc, p.proacl
from pg_proc p where p.oid in (
  'public.execute_sql(text)'::regprocedure,
  'public.task1_acl_sentinel()'::regprocedure
);

\ir ../migrations/20260820013120_revoke_execute_sql_browser_roles.sql
-- Reapplication must preserve the same postconditions (idempotent ACL SQL).
\ir ../migrations/20260820013120_revoke_execute_sql_browser_roles.sql

do $$
declare target oid := 'public.execute_sql(text)'::regprocedure;
begin
  if has_function_privilege('anon', target, 'EXECUTE')
     or has_function_privilege('authenticated', target, 'EXECUTE')
     or not has_function_privilege('service_role', target, 'EXECUTE')
     or not has_function_privilege('task1_acl_owner', target, 'EXECUTE') then
    raise exception 'Effective privilege postcondition failed';
  end if;
  if exists (
    select 1 from pg_proc p,
      lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
    where p.oid = target and a.privilege_type = 'EXECUTE'
      and (a.grantee = 0 or a.grantee in
        (select oid from pg_roles where rolname in ('anon', 'authenticated')))
  ) then
    raise exception 'PUBLIC or browser direct EXECUTE grant remains';
  end if;
  if exists (
    select 1 from task1_before b join pg_proc p on p.oid = b.oid
    where p.proowner is distinct from b.proowner
       or p.prosecdef is distinct from b.prosecdef
       or p.proconfig is distinct from b.proconfig
       or p.prosrc is distinct from b.prosrc
       or (p.oid <> target and p.proacl is distinct from b.proacl)
  ) then
    raise exception 'Function definition, ownership or unrelated ACL changed';
  end if;
end;
$$;
rollback;
\echo Task #1 ACL fixture passed; all fixtures rolled back; no RPC invoked.
