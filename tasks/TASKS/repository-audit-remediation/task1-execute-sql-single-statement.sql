-- PREPARED ONLY: single-statement adapter; requires transport review before use.
-- No internal COMMIT, exception suppression, helper invocation or other migration.
do $task1_acl$
declare target oid;
begin
  set local lock_timeout = '5s';
  lock table supabase_migrations.schema_migrations in share row exclusive mode;
  if exists (select 1 from supabase_migrations.schema_migrations
             where version = '20260820013120') then
    raise exception 'Task #1 migration already recorded; stop and inspect ACL';
  end if;

  revoke execute on function public.execute_sql(text)
  from public, anon, authenticated;

  grant execute on function public.execute_sql(text)
  to service_role;

  target := 'public.execute_sql(text)'::regprocedure;
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

  insert into supabase_migrations.schema_migrations(version, name, statements)
  values (
    '20260820013120',
    'revoke_execute_sql_browser_roles',
    array[
      E'revoke execute on function public.execute_sql(text)\nfrom public, anon, authenticated;',
      E'grant execute on function public.execute_sql(text)\nto service_role;'
    ]
  );
end;
$task1_acl$;
