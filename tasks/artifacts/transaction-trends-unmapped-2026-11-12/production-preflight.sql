BEGIN READ ONLY;
SET LOCAL statement_timeout = '3s';
SET LOCAL lock_timeout = '1s';
WITH target_tables AS (
  SELECT oid, relname, relrowsecurity, relforcerowsecurity FROM pg_class
  WHERE oid IN ('public.yahoo_players'::regclass, 'public.fhfh_player_external_identities'::regclass)
)
SELECT jsonb_build_object(
  'observed_at', clock_timestamp(), 'database', current_database(), 'role', current_user,
  'full_visibility', (SELECT rolsuper OR (rolbypassrls AND pg_has_role(current_user, 'pg_read_all_stats', 'USAGE')) FROM pg_roles WHERE rolname = current_user),
  'update_privileges', has_table_privilege(current_user, 'public.yahoo_players', 'UPDATE') AND has_table_privilege(current_user, 'public.fhfh_player_external_identities', 'UPDATE'),
  'activity', (SELECT jsonb_build_object(
    'active_clients', count(*) FILTER (WHERE state = 'active'),
    'active_over_5s', count(*) FILTER (WHERE state = 'active' AND now() - query_start > interval '5 seconds'),
    'io_or_lock_waits', count(*) FILTER (WHERE wait_event_type IN ('Lock', 'IO')),
    'normalization_queries', count(*) FILTER (WHERE state = 'active' AND query ILIKE '%persist_nhl_api_gamecenter_normalized%'),
    'idle_transactions', count(*) FILTER (WHERE state LIKE 'idle in transaction%')
  ) FROM pg_stat_activity WHERE pid <> pg_backend_pid() AND backend_type = 'client backend'),
  'triggers', (SELECT coalesce(jsonb_agg(jsonb_build_object(
    'name', t.tgname, 'table', c.relname, 'enabled', t.tgenabled,
    'internal', t.tgisinternal, 'definition', pg_get_triggerdef(t.oid),
    'function_md5', CASE WHEN t.tgisinternal THEN NULL ELSE md5(pg_get_functiondef(t.tgfoid)) END
  )), '[]'::jsonb) FROM pg_trigger t JOIN target_tables c ON c.oid = t.tgrelid),
  'constraints', (SELECT coalesce(jsonb_agg(jsonb_build_object('name', conname, 'type', contype,
    'table', c.relname, 'definition', pg_get_constraintdef(p.oid))), '[]'::jsonb)
    FROM pg_constraint p JOIN target_tables c ON c.oid = p.conrelid),
  'indexes', (SELECT coalesce(jsonb_agg(jsonb_build_object('name', indexname, 'table', tablename, 'definition', indexdef)), '[]'::jsonb)
    FROM pg_indexes WHERE schemaname = 'public' AND tablename IN ('yahoo_players', 'fhfh_player_external_identities')),
  'rules', (SELECT coalesce(jsonb_agg(jsonb_build_object('name', r.rulename, 'table', c.relname, 'definition', pg_get_ruledef(r.oid))), '[]'::jsonb)
    FROM pg_rewrite r JOIN target_tables c ON c.oid = r.ev_class),
  'tables', (SELECT jsonb_agg(jsonb_build_object('table', relname, 'rls', relrowsecurity, 'force_rls', relforcerowsecurity)) FROM target_tables),
  'reader_md5', md5(pg_get_functiondef('public.verified_yahoo_player_identities_read()'::regprocedure)),
  'view_md5', md5(pg_get_viewdef('public.yahoo_nhl_player_map_read'::regclass, true))
);
COMMIT;
