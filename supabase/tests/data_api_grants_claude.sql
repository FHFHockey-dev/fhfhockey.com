-- D4 operational grant assertions (Claude). ISOLATED disposable canonical replay ONLY.
-- Complements Codex's data_api_grants*.sql catalog checks by exercising real statements
-- under SET ROLE anon / authenticated / service_role. Requires pgTAP (or the D4 shim) and
-- migrations 20261020224500 + 20261020224600. Every fixture rolls back.
BEGIN;
SET LOCAL search_path = public, extensions, pg_temp;
SELECT no_plan();

-- Synthetic fixtures, created as the migration role.
INSERT INTO auth.users(id) VALUES
 ('d4c1a0de-0000-4000-8000-00000000000a'),
 ('d4c1a0de-0000-4000-8000-00000000000b');
INSERT INTO public.connected_accounts(id, user_id, provider, provider_user_id) VALUES
 ('d4c1a0de-1111-4000-8000-00000000000a', 'd4c1a0de-0000-4000-8000-00000000000a', 'yahoo', 'd4-yahoo-a'),
 ('d4c1a0de-1111-4000-8000-00000000000b', 'd4c1a0de-0000-4000-8000-00000000000b', 'yahoo', 'd4-yahoo-b');
INSERT INTO public.teams(id, name, abbreviation) VALUES (32001, 'D4 home', 'DHA'), (32002, 'D4 away', 'DAW');
INSERT INTO public.player_forecast_source_observations(id, provider, dataset_key, entity_kind, entity_key,
  observed_at, available_at, payload_hash, payload)
SELECT ('d4c1a0de-2222-4000-8000-00000000000' || n)::uuid, 'fhfh', 'native-catalog-selection-v1',
  'catalog_selection', '20262027', now() - interval '1 hour', now() - interval '1 hour', repeat(n, 64),
  jsonb_build_object('version', 'native-catalog-selection-v1', 'seasonId', 20262027,
    'issuedAt', to_jsonb(now() - interval '1 hour'), 'expiresAt', to_jsonb(now() + interval '1 day'))
FROM unnest(ARRAY['1', '2']) n;

-- Native catalog head: CAS is the only write path, and only for service_role.
SET LOCAL ROLE service_role;
SELECT results_eq($q$SELECT revision FROM public.cas_native_forecast_catalog_head(
  'd4c1a0de-3333-4000-8000-000000000001', 20262027, 0, NULL,
  'd4c1a0de-2222-4000-8000-000000000001', repeat('1', 64))$q$,
  ARRAY[1::bigint], 'service CAS creates head revision 1');
SELECT results_eq($q$SELECT revision FROM public.cas_native_forecast_catalog_head(
  'd4c1a0de-3333-4000-8000-000000000001', 20262027, 1, repeat('1', 64),
  'd4c1a0de-2222-4000-8000-000000000002', repeat('2', 64))$q$,
  ARRAY[2::bigint], 'service CAS advances head 1 -> 2 with the expected hash');
SELECT throws_ok($q$SELECT * FROM public.cas_native_forecast_catalog_head(
  'd4c1a0de-3333-4000-8000-000000000001', 20262027, 1, repeat('1', 64),
  'd4c1a0de-2222-4000-8000-000000000001', repeat('1', 64))$q$,
  '40001', NULL, 'stale expected revision is a CAS conflict');
SELECT results_eq($q$SELECT revision::text || ':' || payload_hash FROM public.native_forecast_catalog_heads
  WHERE id = 'd4c1a0de-3333-4000-8000-000000000001'$q$,
  ARRAY['2:' || repeat('2', 64)], 'service reads the head directly (SELECT only)');
SELECT throws_ok($q$UPDATE public.native_forecast_catalog_heads SET revision = 99$q$,
  '42501', NULL, 'service cannot bypass CAS with a direct UPDATE');
SELECT throws_ok($q$INSERT INTO public.native_forecast_catalog_heads(id, season_id, revision, observation_id, payload_hash)
  VALUES ('d4c1a0de-3333-4000-8000-000000000002', 20262027, 1, 'd4c1a0de-2222-4000-8000-000000000001', repeat('1', 64))$q$,
  '42501', NULL, 'service cannot bypass CAS with a direct INSERT');
SELECT throws_ok($q$DELETE FROM public.native_forecast_catalog_heads$q$,
  '42501', NULL, 'service cannot delete heads');
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT throws_ok($q$SELECT * FROM public.cas_native_forecast_catalog_head(
  'd4c1a0de-3333-4000-8000-000000000001', 20262027, 2, repeat('2', 64),
  'd4c1a0de-2222-4000-8000-000000000001', repeat('1', 64))$q$,
  '42501', NULL, 'authenticated cannot execute native CAS');
SELECT throws_ok($q$SELECT * FROM public.native_forecast_catalog_heads$q$,
  '42501', NULL, 'authenticated cannot read native heads');
RESET ROLE;
SET LOCAL ROLE anon;
SELECT throws_ok($q$SELECT * FROM public.cas_native_forecast_catalog_head(
  'd4c1a0de-3333-4000-8000-000000000001', 20262027, 2, repeat('2', 64),
  'd4c1a0de-2222-4000-8000-000000000001', repeat('1', 64))$q$,
  '42501', NULL, 'anon cannot execute native CAS');
SELECT throws_ok($q$SELECT * FROM public.native_forecast_catalog_heads$q$,
  '42501', NULL, 'anon cannot read native heads');
RESET ROLE;

-- Provider linkage: authenticated owner-only SELECT (RLS), no browser writes, no anon.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"d4c1a0de-0000-4000-8000-00000000000a","role":"authenticated"}';
SELECT results_eq($q$SELECT provider_user_id FROM public.connected_accounts WHERE provider_user_id LIKE 'd4-%' ORDER BY 1$q$,
  ARRAY['d4-yahoo-a'], 'user A sees only own connected account');
SELECT results_eq($q$SELECT count(*) FROM public.connected_accounts WHERE user_id = 'd4c1a0de-0000-4000-8000-00000000000b'$q$,
  ARRAY[0::bigint], 'user A filtering by B''s id gets no rows');
SELECT throws_ok($q$INSERT INTO public.connected_accounts(user_id, provider, provider_user_id)
  VALUES ('d4c1a0de-0000-4000-8000-00000000000b', 'yahoo', 'd4-forged')$q$,
  '42501', NULL, 'user A cannot insert a connected account');
SELECT throws_ok($q$UPDATE public.connected_accounts SET account_label = 'x'$q$,
  '42501', NULL, 'user A cannot update connected accounts');
SELECT throws_ok($q$DELETE FROM public.external_leagues$q$,
  '42501', NULL, 'user A cannot delete external leagues');
SELECT throws_ok($q$SELECT * FROM public.get_connected_account_tokens_secure(
  'd4c1a0de-1111-4000-8000-00000000000a', 'd4c1a0de-0000-4000-8000-00000000000a')$q$,
  '42501', NULL, 'user A cannot call the token reader RPC');
RESET ROLE;
SET LOCAL ROLE anon;
SELECT throws_ok($q$SELECT * FROM public.connected_accounts$q$,
  '42501', NULL, 'anon cannot read connected accounts');
SELECT throws_ok($q$SELECT * FROM public.provider_sync_runs$q$,
  '42501', NULL, 'anon cannot read provider sync runs');
RESET ROLE;

-- RSO team schedule: browser read, service write through the identity column.
SET LOCAL ROLE service_role;
SELECT lives_ok($q$INSERT INTO public.roster_optimizer_team_games(game_key, season, source_game_id, source_season_id,
  game_date, game_type, game_status, schedule_status, mapping_status, team_id, team_abbreviation,
  opponent_team_id, opponent_abbreviation, home_away, source_url, fetched_at)
  SELECT 'd4', '2026', 990000001, 20262027, '2026-10-21', 2, 'FUT', 'scheduled', 'unmapped',
    a.id, a.abbreviation, b.id, b.abbreviation, 'home', 'https://example.invalid/d4', now()
  FROM public.teams a, public.teams b WHERE a.id = 32001 AND b.id = 32002$q$,
  'service inserts a schedule row (identity default)');
SELECT throws_ok($q$SELECT setval('public.roster_optimizer_team_games_id_seq', 1)$q$,
  '42501', NULL, 'service cannot reset the schedule identity sequence');
RESET ROLE;
SET LOCAL ROLE anon;
SELECT results_eq($q$SELECT count(*) FROM public.roster_optimizer_team_games WHERE game_key = 'd4'$q$,
  ARRAY[1::bigint], 'anon reads the schedule row');
SELECT throws_ok($q$DELETE FROM public.roster_optimizer_team_games$q$,
  '42501', NULL, 'anon cannot delete schedule rows');
SELECT throws_ok($q$SELECT nextval('public.roster_optimizer_team_games_id_seq')$q$,
  '42501', NULL, 'anon cannot draw from the schedule sequence');
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT lives_ok($q$SELECT count(*) FROM public.roster_optimizer_team_games$q$, 'authenticated reads the schedule');
SELECT throws_ok($q$UPDATE public.roster_optimizer_team_games SET game_status = 'x'$q$,
  '42501', NULL, 'authenticated cannot update schedule rows');
RESET ROLE;

-- FORGE append-only history: service may append and read, never rewrite.
SET LOCAL ROLE service_role;
SELECT throws_ok($q$UPDATE public.forge_game_revisions SET payload = '{}'::jsonb$q$,
  '42501', NULL, 'service cannot update FORGE game revisions');
SELECT throws_ok($q$TRUNCATE public.forge_board_news_events$q$,
  '42501', NULL, 'service cannot truncate FORGE board events');
SELECT throws_ok($q$TRUNCATE public.draft_pro_purchases$q$,
  '42501', NULL, 'service cannot truncate Draft Pro purchases');
SELECT throws_ok($q$TRUNCATE public.in_season_workspaces$q$,
  '42501', NULL, 'service cannot truncate saved RSO plans');
RESET ROLE;

-- Reviewed service_role matrix where the caller audit narrowed Codex's proposal.
CREATE TEMP TABLE d4_claude_service(name text PRIMARY KEY, ops text[]);
INSERT INTO d4_claude_service VALUES
  ('public.connected_accounts', ARRAY['SELECT','INSERT','UPDATE','DELETE']),
  ('public.external_leagues', ARRAY['SELECT','INSERT','UPDATE','DELETE']),
  ('public.external_teams', ARRAY['SELECT','INSERT','UPDATE','DELETE']),
  ('public.provider_sync_runs', ARRAY['SELECT','INSERT','UPDATE']),
  ('public.draft_pro_access_code_attempts', ARRAY['SELECT']),
  ('public.draft_pro_access_codes', ARRAY['SELECT']),
  ('public.draft_pro_drafts', ARRAY['SELECT']),
  ('public.draft_pro_private_import_blobs', ARRAY[]::text[]),
  ('public.draft_pro_private_import_uploads', ARRAY[]::text[]),
  ('public.draft_pro_private_imports', ARRAY['SELECT','UPDATE']),
  ('public.draft_pro_provider_events', ARRAY['SELECT','INSERT','UPDATE']),
  ('public.draft_pro_purchases', ARRAY['SELECT','UPDATE']),
  ('public.draft_pro_refund_requests', ARRAY['SELECT','INSERT','UPDATE']),
  ('public.draft_pro_reports', ARRAY['SELECT','INSERT']),
  ('public.draft_pro_save_sessions', ARRAY[]::text[]),
  ('public.draft_pro_scenarios', ARRAY['SELECT','INSERT']),
  ('public.in_season_grants', ARRAY['SELECT']),
  ('public.in_season_workspaces', ARRAY['SELECT','INSERT','UPDATE']),
  ('public.player_forecast_champion_history', ARRAY['SELECT']),
  ('public.player_forecast_season_completeness_waivers', ARRAY['SELECT']),
  ('public.player_forecast_season_release_teams', ARRAY['SELECT','INSERT']),
  ('public.player_forecast_season_runs', ARRAY['SELECT','INSERT','UPDATE']),
  ('public.player_forecast_season_team_aggregates', ARRAY['SELECT','INSERT']);
SELECT ok(has_table_privilege('service_role', t.name, p.op) = (p.op = ANY(t.ops)),
  format('service_role %s %s matches the caller audit', p.op, t.name))
FROM d4_claude_service t
CROSS JOIN (VALUES ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER')) p(op)
ORDER BY t.name, p.op;
SELECT ok(NOT has_function_privilege(r.role, 'public.promote_player_forecast_model_atomic(text,uuid,uuid,text,jsonb,timestamptz)', 'EXECUTE'),
  r.role || ' cannot execute the uncalled model-promotion RPC') FROM (VALUES ('anon'), ('authenticated'), ('service_role')) r(role);
SELECT ok(has_sequence_privilege('service_role', 'public.roster_optimizer_team_games_id_seq', 'USAGE')
  AND NOT has_sequence_privilege('service_role', 'public.roster_optimizer_team_games_id_seq', 'SELECT'),
  'service_role has USAGE but not SELECT on the schedule identity sequence');
SELECT ok(NOT EXISTS (SELECT 1 FROM pg_default_acl d, LATERAL aclexplode(d.defaclacl) a
  WHERE d.defaclrole = 'postgres'::regrole AND d.defaclnamespace = 'public'::regnamespace
    AND a.grantee IN ('anon'::regrole, 'authenticated'::regrole, 'service_role'::regrole)),
  'postgres public defaults grant nothing to the Data API roles');

-- Future objects after the default-privilege migration: nothing is exposed until granted.
CREATE TABLE public.d4_claude_probe(id serial PRIMARY KEY, note text);
CREATE SCHEMA d4_claude_probe_schema;
CREATE FUNCTION d4_claude_probe_schema.probe() RETURNS integer LANGUAGE sql AS 'SELECT 1';
SELECT ok(NOT has_table_privilege(r.role, 'public.d4_claude_probe', 'SELECT'),
  r.role || ' gets no SELECT on a new public table') FROM (VALUES ('anon'), ('authenticated'), ('service_role')) r(role);
SELECT ok(NOT has_sequence_privilege(r.role, 'public.d4_claude_probe_id_seq', 'USAGE'),
  r.role || ' gets no USAGE on a new serial sequence') FROM (VALUES ('anon'), ('authenticated'), ('service_role')) r(role);
SELECT ok(NOT EXISTS (SELECT 1 FROM pg_proc p, LATERAL aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
  WHERE p.oid = 'd4_claude_probe_schema.probe()'::regprocedure AND a.grantee = 0),
  'new postgres function outside public has no PUBLIC EXECUTE');
-- An explicit grant is what makes a new object reachable.
GRANT SELECT ON public.d4_claude_probe TO anon;
SET LOCAL ROLE anon;
SELECT lives_ok($q$SELECT count(*) FROM public.d4_claude_probe$q$, 'explicit grant restores anon SELECT');
SELECT throws_ok($q$INSERT INTO public.d4_claude_probe(note) VALUES ('x')$q$,
  '42501', NULL, 'SELECT grant does not imply INSERT');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
