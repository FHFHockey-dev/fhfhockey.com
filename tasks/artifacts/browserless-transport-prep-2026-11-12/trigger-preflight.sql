-- PLAN ONLY. One catalog-only transaction after Scout/Claude coordinate the window.
-- No table rows, trigger arguments, function bodies, credentials or HTTP requests returned.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '5s';
WITH snapshot AS (
  select coalesce(jsonb_agg(jsonb_build_object(
    'oid', t.oid, 'name', t.tgname, 'enabled', t.tgenabled,
    'table_oid', t.tgrelid, 'function_oid', t.tgfoid,
    'function_schema', n.nspname, 'function_name', f.proname,
    'type', t.tgtype, 'internal', t.tgisinternal, 'args_count', t.tgnargs,
    'definition_hash', md5(pg_get_triggerdef(t.oid)),
    'function_hash', md5(pg_get_functiondef(t.tgfoid))
  ) order by t.tgname), '[]'::jsonb) AS triggers
  FROM pg_catalog.pg_trigger t
  JOIN pg_catalog.pg_proc f ON f.oid = t.tgfoid
  JOIN pg_catalog.pg_namespace n ON n.oid = f.pronamespace
  WHERE t.tgrelid = 'public."lineCombinations"'::regclass
)
SELECT current_setting('server_version_num') AS server_version_num,
       c.oid AS table_oid, c.relkind AS table_kind,
       (SELECT count(*) FROM pg_catalog.pg_inherits WHERE inhparent=c.oid) AS child_count,
       (SELECT count(*) FROM pg_catalog.pg_inherits WHERE inhrelid=c.oid) AS parent_count,
       triggers, md5(triggers::text) AS fingerprint
FROM snapshot CROSS JOIN pg_catalog.pg_class c
WHERE c.oid = 'public."lineCombinations"'::regclass;
ROLLBACK;
