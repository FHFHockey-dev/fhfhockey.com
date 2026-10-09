-- PREPARED TRANSPORT ADAPTER: requires separate transport review before production use.
-- Plain SQL equivalent of the reviewed psql wrapper; no helper-function invocation.
begin;
-- PREPARED ONLY. Requires explicit action-time approval for the exact production
-- project, migration hash, ACL change AND ledger insertion. Never auto-run.
-- Use psql -X --single-transaction -v ON_ERROR_STOP=1 -f this-file
-- after the runbook's catalog/hash/connection preflight. Do not use db push.
set local lock_timeout = '5s';
-- Serialize this receipt with other ledger writers; do not overwrite a receipt.
lock table supabase_migrations.schema_migrations in share row exclusive mode;
do $$
begin
  if exists (select 1 from supabase_migrations.schema_migrations
             where version = '20260820013120') then
    raise exception 'Task #1 migration already recorded; stop and inspect ACL';
  end if;
end;
$$;

-- `public.execute_sql(text)` is an operator-only maintenance boundary.  It is
-- SECURITY DEFINER and accepts arbitrary SQL, so browser roles must never be
-- able to invoke it.  Keep the evidenced server-side service-role consumers.

revoke execute on function public.execute_sql(text)
from public, anon, authenticated;

grant execute on function public.execute_sql(text)
to service_role;

do $$
declare target oid := 'public.execute_sql(text)'::regprocedure;
begin
  if has_function_privilege('anon', target, 'EXECUTE')
     or has_function_privilege('authenticated', target, 'EXECUTE')
     or not has_function_privilege('service_role', target, 'EXECUTE')
     or not has_function_privilege('postgres', target, 'EXECUTE')
     or exists (
       select 1 from pg_proc p,
         lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
       where p.oid = target and a.grantee = 0 and a.privilege_type = 'EXECUTE'
     ) then
    raise exception 'Task #1 privilege postcondition failed; rollback required';
  end if;
end;
$$;

insert into supabase_migrations.schema_migrations(version, name, statements)
values (
  '20260820013120',
  'revoke_execute_sql_browser_roles',
  array[
    E'revoke execute on function public.execute_sql(text)\nfrom public, anon, authenticated;',
    E'grant execute on function public.execute_sql(text)\nto service_role;'
  ]
);
commit;
