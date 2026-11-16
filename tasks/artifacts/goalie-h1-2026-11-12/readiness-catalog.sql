-- Read-only readiness inspection; not an H1 execution or migration.
begin;
set transaction read only;
set local statement_timeout = '5s';
set local lock_timeout = '1s';
select jsonb_build_object(
  'checkedAt', clock_timestamp(),
  'functions', coalesce((select jsonb_agg(jsonb_build_object(
    'schema', n.nspname, 'name', p.proname,
    'arguments', pg_get_function_identity_arguments(p.oid),
    'sourceMd5', md5(p.prosrc), 'securityDefiner', p.prosecdef,
    'configuration', p.proconfig,
    'serviceRoleExecute', has_function_privilege('service_role', p.oid, 'EXECUTE')
  ) order by n.nspname, p.proname)
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where (n.nspname = 'forge_execution_internal' and p.proname in
    ('lock_forge_execution_scope', 'active_forge_local_execution', 'guard_forge_local_reservation', 'guard_forge_local_publication'))
    or (n.nspname = 'public' and p.proname in ('begin_forge_local_run', 'inspect_forge_local_attempt'))), '[]'::jsonb),
  'triggers', coalesce((select jsonb_agg(jsonb_build_object(
    'name', t.tgname, 'table', c.relname, 'enabled', t.tgenabled,
    'definition', pg_get_triggerdef(t.oid)) order by t.tgname)
  from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname in ('forge_runs', 'forge_game_revisions')
    and t.tgname in ('forge_local_reservation_guard', 'forge_local_publication_guard')), '[]'::jsonb),
  'indexes', coalesce((select jsonb_agg(jsonb_build_object(
    'name', c.relname, 'valid', i.indisvalid, 'ready', i.indisready,
    'definition', pg_get_indexdef(c.oid)) order by c.relname)
  from pg_class c join pg_namespace n on n.oid = c.relnamespace join pg_index i on i.indexrelid = c.oid
  where n.nspname = 'public' and c.relname in ('forge_local_attempt_run_idx', 'forge_local_attempt_game_idx')), '[]'::jsonb),
  'proposedGame', (select to_jsonb(g) from (
    select id, date, "startTime", "seasonId", type, "homeTeamId", "awayTeamId"
    from public.games
    where date between '2026-11-12' and '2026-11-14'
      and "seasonId" = 20262027 and type = 2
      and "startTime" > clock_timestamp() + interval '90 minutes'
    order by "startTime", id limit 1
  ) g)
) as readiness;
commit;
