-- Draft regression tests for the two pending table migrations.
-- ISOLATED DISPOSABLE DATABASE ONLY. Do not run against a hosted or shared database.
-- Requires pgTAP and both candidate migrations to have been staged locally.
-- Tests metadata and zero-row reads only; it does not create or modify fixture data.
-- The FORGE service-role excess-privilege checks intentionally expose legacy
-- defaults unless the migration or its creator-role defaults are narrowed.
BEGIN;
SET LOCAL search_path = public, extensions, pg_temp;
SELECT no_plan();

SELECT ok(to_regclass('public.rso_yahoo_past_lineups') IS NOT NULL,
  'staged RSO past-lineup table exists');
SELECT ok(to_regclass('public.forge_reserve_projections') IS NOT NULL,
  'staged FORGE reserve table exists');
SELECT ok(to_regprocedure('public.purge_rso_yahoo_past_lineups(integer)') IS NOT NULL,
  'staged RSO purge function exists');

SELECT ok(COALESCE((SELECT c.relrowsecurity FROM pg_class c
  WHERE c.oid = to_regclass(t.name)), false), t.name || ' has RLS enabled')
FROM (VALUES ('public.rso_yahoo_past_lineups'),
             ('public.forge_reserve_projections')) t(name);

-- Test effective role privileges, including privileges inherited through PUBLIC.
SELECT ok(
  COALESCE(has_table_privilege(r.role, to_regclass(t.name), p.op), false) =
    CASE
      WHEN r.role = 'service_role' AND p.op IN ('SELECT','INSERT','UPDATE','DELETE') THEN true
      WHEN t.name = 'public.forge_reserve_projections'
        AND r.role IN ('anon','authenticated') AND p.op = 'SELECT' THEN true
      ELSE false
    END,
  format('%s %s on %s matches proposed least-privilege matrix', r.role, p.op, t.name)
)
FROM (VALUES ('public.rso_yahoo_past_lineups'),
             ('public.forge_reserve_projections')) t(name)
CROSS JOIN (VALUES ('anon'), ('authenticated'), ('service_role')) r(role)
CROSS JOIN (VALUES ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'),
                   ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) p(op)
ORDER BY t.name, r.role, p.op;

SELECT ok(
  COALESCE(has_function_privilege(r.role,
    to_regprocedure('public.purge_rso_yahoo_past_lineups(integer)'), 'EXECUTE'), false)
      = (r.role = 'service_role'),
  r.role || ' has intended purge-function EXECUTE privilege'
)
FROM (VALUES ('anon'), ('authenticated'), ('service_role')) r(role);

SET LOCAL ROLE anon;
SELECT lives_ok('SELECT 1 FROM public.forge_reserve_projections LIMIT 0',
  'anon can issue the intended public reserve read');
SELECT throws_ok('SELECT 1 FROM public.rso_yahoo_past_lineups LIMIT 0',
  '42501', NULL, 'anon cannot read private past lineups');
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT lives_ok('SELECT 1 FROM public.forge_reserve_projections LIMIT 0',
  'authenticated can issue the intended public reserve read');
SELECT throws_ok('SELECT 1 FROM public.rso_yahoo_past_lineups LIMIT 0',
  '42501', NULL, 'authenticated cannot read private past lineups');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
