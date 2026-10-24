-- D4 replay 2026-10-23 supplementary checks. Disposable local cluster ONLY; never run on a hosted
-- project. Runs after the whole 99-entry chain and the pgTAP shim. Every probe rolls back.
-- 1 default privileges after 89; 2 objects created after the whole chain; 3 in-season narrowing;
-- 4 post-D4 suffix objects match the hosted readback recorded in migration-authority.json.
BEGIN;
SET LOCAL search_path = public, extensions, pg_temp;
SELECT no_plan();

-- 1. Default privileges.
SELECT ok(NOT EXISTS (
  SELECT 1 FROM pg_default_acl d CROSS JOIN LATERAL aclexplode(d.defaclacl) a
  WHERE d.defaclrole = 'postgres'::regrole AND d.defaclnamespace = 'public'::regnamespace
    AND a.grantee IN ('anon'::regrole, 'authenticated'::regrole, 'service_role'::regrole)),
  'default ACL: postgres in public grants nothing to anon, authenticated or service_role');
SELECT ok(EXISTS (
  SELECT 1 FROM pg_default_acl d
  WHERE d.defaclrole = 'postgres'::regrole AND d.defaclnamespace = 0 AND d.defaclobjtype = 'f'
    AND NOT EXISTS (SELECT 1 FROM aclexplode(d.defaclacl) a WHERE a.grantee = 0)),
  'default ACL: postgres global function default exists without PUBLIC EXECUTE');

-- 2. Objects created now, after 91-99, as the migration role.
CREATE TABLE public.d4r_probe_serial (id bigserial PRIMARY KEY, v text);
CREATE TABLE public.d4r_probe_identity (id bigint GENERATED ALWAYS AS IDENTITY, v text);
CREATE SEQUENCE public.d4r_probe_seq;
CREATE VIEW public.d4r_probe_view AS SELECT id, v FROM public.d4r_probe_serial;
CREATE MATERIALIZED VIEW public.d4r_probe_mv AS SELECT 1 AS one;
CREATE FUNCTION public.d4r_probe_fn() RETURNS integer LANGUAGE sql AS 'SELECT 1';
CREATE SCHEMA d4r_probe_schema;
CREATE FUNCTION d4r_probe_schema.fn() RETURNS integer LANGUAGE sql AS 'SELECT 1';

SELECT ok(NOT has_table_privilege(r.role, o.obj, p.op), format('new %s: %s denied %s', o.obj, r.role, p.op))
FROM (VALUES ('anon'), ('authenticated'), ('service_role')) r(role)
CROSS JOIN (VALUES ('public.d4r_probe_serial'), ('public.d4r_probe_identity'), ('public.d4r_probe_view'),
                   ('public.d4r_probe_mv')) o(obj)
CROSS JOIN (VALUES ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) p(op);
SELECT ok(NOT has_sequence_privilege(r.role, o.obj, p.op), format('new %s: %s denied %s', o.obj, r.role, p.op))
FROM (VALUES ('anon'), ('authenticated'), ('service_role')) r(role)
CROSS JOIN (VALUES ('public.d4r_probe_serial_id_seq'), ('public.d4r_probe_identity_id_seq'),
                   ('public.d4r_probe_seq')) o(obj)
CROSS JOIN (VALUES ('USAGE'), ('SELECT'), ('UPDATE')) p(op);
SELECT ok(NOT has_function_privilege(r.role, f.fn, 'EXECUTE'), format('new %s: %s denied EXECUTE', f.fn, r.role))
FROM (VALUES ('anon'), ('authenticated'), ('service_role')) r(role)
CROSS JOIN (VALUES ('public.d4r_probe_fn()'), ('d4r_probe_schema.fn()')) f(fn);
SELECT ok(NOT EXISTS (
  SELECT 1 FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
  WHERE p.oid = f.fn::regprocedure AND a.grantee = 0), format('new %s: no PUBLIC EXECUTE', f.fn))
FROM (VALUES ('public.d4r_probe_fn()'), ('d4r_probe_schema.fn()')) f(fn);

SET LOCAL ROLE anon;
SELECT throws_ok($q$SELECT * FROM public.d4r_probe_serial$q$, '42501', NULL, 'anon SELECT on a new table raises 42501');
SELECT throws_ok($q$SELECT public.d4r_probe_fn()$q$, '42501', NULL, 'anon EXECUTE on a new function raises 42501');
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT throws_ok($q$INSERT INTO public.d4r_probe_serial(v) VALUES ('x')$q$, '42501', NULL,
  'authenticated INSERT on a new table raises 42501');
RESET ROLE;
SET LOCAL ROLE service_role;
SELECT throws_ok($q$SELECT * FROM public.d4r_probe_view$q$, '42501', NULL, 'service_role SELECT on a new view raises 42501');
SELECT throws_ok($q$SELECT public.d4r_probe_fn()$q$, '42501', NULL, 'service_role EXECUTE on a new function raises 42501');
RESET ROLE;

GRANT SELECT, INSERT ON public.d4r_probe_serial TO service_role;
GRANT USAGE ON SEQUENCE public.d4r_probe_serial_id_seq TO service_role;
GRANT EXECUTE ON FUNCTION public.d4r_probe_fn() TO service_role;
SET LOCAL ROLE service_role;
SELECT lives_ok($q$INSERT INTO public.d4r_probe_serial(v) VALUES ('granted')$q$,
  'explicit SELECT, INSERT and sequence USAGE let service_role insert into a new serial table');
SELECT throws_ok($q$UPDATE public.d4r_probe_serial SET v = 'x'$q$, '42501', NULL,
  'explicit grant restores only what was granted (UPDATE still denied)');
SELECT results_eq($q$SELECT public.d4r_probe_fn()$q$, ARRAY[1], 'explicit EXECUTE lets service_role call a new function');
RESET ROLE;
SELECT ok(NOT has_table_privilege('anon', 'public.d4r_probe_serial', 'SELECT'),
  'explicit service_role grant leaves anon denied');

-- 3. In-season saved plans: service_role SELECT on grants; SELECT, INSERT, UPDATE on workspaces.
SELECT ok(has_table_privilege(r.role, t.obj, p.op) = (r.role = 'service_role' AND p.op = ANY (t.ops)),
  format('%s %s on %s is %s', r.role, p.op, t.obj,
         CASE WHEN r.role = 'service_role' AND p.op = ANY (t.ops) THEN 'granted' ELSE 'denied' END))
FROM (VALUES ('public.in_season_grants', ARRAY['SELECT']),
             ('public.in_season_workspaces', ARRAY['SELECT', 'INSERT', 'UPDATE'])) t(obj, ops)
CROSS JOIN (VALUES ('anon'), ('authenticated'), ('service_role')) r(role)
CROSS JOIN (VALUES ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) p(op);
SELECT ok(NOT EXISTS (
  SELECT 1 FROM pg_class c CROSS JOIN LATERAL aclexplode(c.relacl) a
  WHERE c.oid = t.obj::regclass AND a.grantee = 0), format('%s has no PUBLIC entry', t.obj))
FROM (VALUES ('public.in_season_grants'), ('public.in_season_workspaces')) t(obj);

INSERT INTO auth.users(id) VALUES ('d4202623-0000-4000-8000-000000000001');
SET LOCAL ROLE service_role;
SELECT lives_ok($q$SELECT count(*) FROM public.in_season_grants$q$, 'service_role can read in_season_grants');
SELECT throws_ok($q$INSERT INTO public.in_season_grants(user_id, source, source_reference, status, effective_from, effective_to)
  VALUES ('d4202623-0000-4000-8000-000000000001', 'grandfather', 'd4r', 'active', now(), now() + interval '1 day')$q$,
  '42501', NULL, 'service_role INSERT on in_season_grants raises 42501');
SELECT throws_ok($q$UPDATE public.in_season_grants SET status = 'revoked'$q$, '42501', NULL,
  'service_role UPDATE on in_season_grants raises 42501');
SELECT throws_ok($q$DELETE FROM public.in_season_grants$q$, '42501', NULL,
  'service_role DELETE on in_season_grants raises 42501');
SELECT lives_ok($q$INSERT INTO public.in_season_workspaces(user_id, provider, league_id, team_id, season_id, start_date, end_date, workspace)
  VALUES ('d4202623-0000-4000-8000-000000000001', 'manual', 'd4r-league', 'd4r-team', 20262027, '2026-10-19', '2026-10-25', '{}')$q$,
  'service_role can insert a saved plan');
SELECT lives_ok($q$UPDATE public.in_season_workspaces SET workspace = '{"saved":true}'
  WHERE user_id = 'd4202623-0000-4000-8000-000000000001'$q$, 'service_role can update a saved plan');
SELECT throws_ok($q$DELETE FROM public.in_season_workspaces WHERE user_id = 'd4202623-0000-4000-8000-000000000001'$q$,
  '42501', NULL, 'service_role DELETE on in_season_workspaces raises 42501');
SELECT throws_ok($q$TRUNCATE public.in_season_grants$q$, '42501', NULL, 'service_role TRUNCATE on in_season_grants raises 42501');
RESET ROLE;

-- 4. Objects from orders 88 and 92-98 (created around D4) match their recorded grants.
SELECT ok(has_table_privilege(r.role, t.obj, p.op) = (r.role = 'service_role' AND p.op = ANY (t.ops)),
  format('%s %s on %s is %s', r.role, p.op, t.obj,
         CASE WHEN r.role = 'service_role' AND p.op = ANY (t.ops) THEN 'granted' ELSE 'denied' END))
FROM (VALUES ('public.forge_served_forecast_ledger', ARRAY['SELECT', 'INSERT', 'UPDATE']),
             ('public.forge_served_forecast_scoreboard_daily', ARRAY['SELECT']),
             ('public.route_runner_jobs', ARRAY['SELECT', 'INSERT', 'UPDATE']),
             ('public.route_runner_events', ARRAY['SELECT', 'INSERT', 'UPDATE'])) t(obj, ops)
CROSS JOIN (VALUES ('anon'), ('authenticated'), ('service_role')) r(role)
CROSS JOIN (VALUES ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) p(op);
SELECT ok(has_sequence_privilege(r.role, 'public.route_runner_events_id_seq', p.op) = (r.role = 'service_role' AND p.op = 'USAGE'),
  format('%s %s on public.route_runner_events_id_seq', r.role, p.op))
FROM (VALUES ('anon'), ('authenticated'), ('service_role')) r(role)
CROSS JOIN (VALUES ('USAGE'), ('SELECT'), ('UPDATE')) p(op);
SELECT ok(has_function_privilege(r.role, f.fn, 'EXECUTE') = (r.role = 'service_role'),
  format('%s EXECUTE on %s is %s', r.role, f.fn, CASE WHEN r.role = 'service_role' THEN 'granted' ELSE 'denied' END))
FROM (VALUES ('public.forge_league_skater_physical_totals(integer, date)'),
             ('public.forge_latest_rolling_rows(bigint[], text, date, text[])'),
             ('public.replace_forge_projection_results_atomic(date, date, uuid, jsonb)')) f(fn)
CROSS JOIN (VALUES ('anon'), ('authenticated'), ('service_role')) r(role);
SELECT ok(NOT EXISTS (
  SELECT 1 FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
  WHERE p.oid = f.fn::regprocedure AND a.grantee = 0), format('%s has no PUBLIC EXECUTE', f.fn))
FROM (VALUES ('public.forge_league_skater_physical_totals(integer, date)'),
             ('public.forge_latest_rolling_rows(bigint[], text, date, text[])'),
             ('public.replace_forge_projection_results_atomic(date, date, uuid, jsonb)')) f(fn);

SELECT * FROM finish();
ROLLBACK;
