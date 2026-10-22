-- D4 desired-posture regression tests. ISOLATED DB ONLY. No hosted execution.
-- Requires pgTAP and the canonical chain through the reviewed migrations 89–90.
-- Expected operations match the caller-reviewed narrowing in migration 90; no failure exemptions.
-- This does not grant application privileges or create missing app objects. Failures are evidence.
BEGIN;
SET LOCAL search_path = public, extensions, pg_temp;
SELECT no_plan();

CREATE TEMP TABLE d4_tables(name text PRIMARY KEY, service_ops text[], anon_ops text[], authenticated_ops text[]);
INSERT INTO d4_tables VALUES
  ('public.connected_accounts',ARRAY['SELECT','INSERT','UPDATE','DELETE']::text[],ARRAY[]::text[],ARRAY['SELECT']::text[]),
  ('public.draft_pro_access_code_attempts',ARRAY['SELECT']::text[],ARRAY[]::text[],ARRAY[]::text[]),
  ('public.draft_pro_access_codes',ARRAY['SELECT']::text[],ARRAY[]::text[],ARRAY[]::text[]),
  ('public.draft_pro_drafts',ARRAY['SELECT']::text[],ARRAY[]::text[],ARRAY[]::text[]),
  ('public.draft_pro_private_import_blobs',ARRAY[]::text[],ARRAY[]::text[],ARRAY[]::text[]),
  ('public.draft_pro_private_import_uploads',ARRAY[]::text[],ARRAY[]::text[],ARRAY[]::text[]),
  ('public.draft_pro_private_imports',ARRAY['SELECT','UPDATE']::text[],ARRAY[]::text[],ARRAY[]::text[]),
  ('public.draft_pro_provider_events',ARRAY['SELECT','INSERT','UPDATE']::text[],ARRAY[]::text[],ARRAY[]::text[]),
  ('public.draft_pro_purchases',ARRAY['SELECT','UPDATE']::text[],ARRAY[]::text[],ARRAY[]::text[]),
  ('public.draft_pro_refund_requests',ARRAY['SELECT','INSERT','UPDATE']::text[],ARRAY[]::text[],ARRAY[]::text[]),
  ('public.draft_pro_reports',ARRAY['SELECT','INSERT']::text[],ARRAY[]::text[],ARRAY[]::text[]),
  ('public.draft_pro_save_sessions',ARRAY[]::text[],ARRAY[]::text[],ARRAY[]::text[]),
  ('public.draft_pro_scenarios',ARRAY['SELECT','INSERT']::text[],ARRAY[]::text[],ARRAY[]::text[]),
  ('public.external_leagues',ARRAY['SELECT','INSERT','UPDATE','DELETE']::text[],ARRAY[]::text[],ARRAY['SELECT']::text[]),
  ('public.external_teams',ARRAY['SELECT','INSERT','UPDATE','DELETE']::text[],ARRAY[]::text[],ARRAY['SELECT']::text[]),
  ('public.forge_board_dispatch_observations',ARRAY['SELECT','INSERT']::text[],ARRAY[]::text[],ARRAY[]::text[]),
  ('public.forge_board_news_events',ARRAY['SELECT','INSERT']::text[],ARRAY[]::text[],ARRAY[]::text[]),
  ('public.forge_board_visibility_observations',ARRAY['SELECT','INSERT']::text[],ARRAY[]::text[],ARRAY[]::text[]),
  ('public.forge_final_pregame_revisions',ARRAY['SELECT','INSERT']::text[],ARRAY[]::text[],ARRAY[]::text[]),
  ('public.forge_game_revisions',ARRAY['SELECT','INSERT']::text[],ARRAY[]::text[],ARRAY[]::text[]),
  ('public.forge_game_selection_events',ARRAY['SELECT','INSERT']::text[],ARRAY[]::text[],ARRAY[]::text[]),
  ('public.in_season_grants',ARRAY['SELECT']::text[],ARRAY[]::text[],ARRAY[]::text[]),
  ('public.in_season_workspaces',ARRAY['SELECT','INSERT','UPDATE']::text[],ARRAY[]::text[],ARRAY[]::text[]),
  ('public.line_claim_relations',ARRAY['SELECT','INSERT']::text[],ARRAY[]::text[],ARRAY[]::text[]),
  ('public.line_claim_revisions',ARRAY['SELECT','INSERT']::text[],ARRAY[]::text[],ARRAY[]::text[]),
  ('public.line_entry_revisions',ARRAY['SELECT','INSERT']::text[],ARRAY[]::text[],ARRAY[]::text[]),
  ('public.line_game_state_observations',ARRAY['SELECT','INSERT']::text[],ARRAY[]::text[],ARRAY[]::text[]),
  ('public.line_pp_decisions',ARRAY['SELECT','INSERT']::text[],ARRAY[]::text[],ARRAY[]::text[]),
  ('public.line_source_captures',ARRAY['SELECT','INSERT']::text[],ARRAY[]::text[],ARRAY[]::text[]),
  ('public.native_forecast_catalog_heads',ARRAY['SELECT']::text[],ARRAY[]::text[],ARRAY[]::text[]),
  ('public.player_forecast_accountability_revisions',ARRAY['SELECT','INSERT']::text[],ARRAY[]::text[],ARRAY[]::text[]),
  ('public.player_forecast_champion_history',ARRAY['SELECT']::text[],ARRAY[]::text[],ARRAY[]::text[]),
  ('public.player_forecast_conflict_members',ARRAY['SELECT','INSERT']::text[],ARRAY[]::text[],ARRAY[]::text[]),
  ('public.player_forecast_conflict_resolutions',ARRAY['SELECT','INSERT']::text[],ARRAY[]::text[],ARRAY[]::text[]),
  ('public.player_forecast_evaluation_revisions',ARRAY['SELECT','INSERT']::text[],ARRAY[]::text[],ARRAY[]::text[]),
  ('public.player_forecast_feature_snapshots',ARRAY['SELECT','INSERT']::text[],ARRAY[]::text[],ARRAY[]::text[]),
  ('public.player_forecast_goalie_start_observations',ARRAY['SELECT','INSERT']::text[],ARRAY[]::text[],ARRAY[]::text[]),
  ('public.player_forecast_inference_queue',ARRAY['SELECT','INSERT','UPDATE']::text[],ARRAY[]::text[],ARRAY[]::text[]),
  ('public.player_forecast_lineup_assignments',ARRAY['SELECT','INSERT']::text[],ARRAY[]::text[],ARRAY[]::text[]),
  ('public.player_forecast_lineup_snapshots',ARRAY['SELECT','INSERT']::text[],ARRAY[]::text[],ARRAY[]::text[]),
  ('public.player_forecast_model_artifacts',ARRAY['SELECT','INSERT']::text[],ARRAY[]::text[],ARRAY[]::text[]),
  ('public.player_forecast_observation_conflicts',ARRAY['SELECT','INSERT']::text[],ARRAY[]::text[],ARRAY[]::text[]),
  ('public.player_forecast_outcome_revisions',ARRAY['SELECT','INSERT']::text[],ARRAY[]::text[],ARRAY[]::text[]),
  ('public.player_forecast_outputs',ARRAY['SELECT','INSERT']::text[],ARRAY[]::text[],ARRAY[]::text[]),
  ('public.player_forecast_rest_of_season_outputs',ARRAY['SELECT','INSERT']::text[],ARRAY[]::text[],ARRAY[]::text[]),
  ('public.player_forecast_runs',ARRAY['SELECT','INSERT','UPDATE']::text[],ARRAY[]::text[],ARRAY[]::text[]),
  ('public.player_forecast_schedule_revisions',ARRAY['SELECT','INSERT']::text[],ARRAY[]::text[],ARRAY[]::text[]),
  ('public.player_forecast_season_active_releases',ARRAY['SELECT','INSERT','UPDATE']::text[],ARRAY[]::text[],ARRAY[]::text[]),
  ('public.player_forecast_season_artifacts',ARRAY['SELECT','INSERT']::text[],ARRAY[]::text[],ARRAY[]::text[]),
  ('public.player_forecast_season_completeness_waivers',ARRAY['SELECT']::text[],ARRAY[]::text[],ARRAY[]::text[]),
  ('public.player_forecast_season_deployment_assignments',ARRAY['SELECT','INSERT']::text[],ARRAY[]::text[],ARRAY[]::text[]),
  ('public.player_forecast_season_deployment_snapshots',ARRAY['SELECT','INSERT']::text[],ARRAY[]::text[],ARRAY[]::text[]),
  ('public.player_forecast_season_evaluation_revisions',ARRAY['SELECT','INSERT']::text[],ARRAY[]::text[],ARRAY[]::text[]),
  ('public.player_forecast_season_game_outputs',ARRAY['SELECT','INSERT']::text[],ARRAY[]::text[],ARRAY[]::text[]),
  ('public.player_forecast_season_outcome_revisions',ARRAY['SELECT','INSERT']::text[],ARRAY[]::text[],ARRAY[]::text[]),
  ('public.player_forecast_season_overrides',ARRAY['SELECT','INSERT']::text[],ARRAY[]::text[],ARRAY[]::text[]),
  ('public.player_forecast_season_player_aggregates',ARRAY['SELECT','INSERT']::text[],ARRAY[]::text[],ARRAY[]::text[]),
  ('public.player_forecast_season_player_pool_review',ARRAY['SELECT','INSERT']::text[],ARRAY[]::text[],ARRAY[]::text[]),
  ('public.player_forecast_season_queue',ARRAY['SELECT','INSERT','UPDATE']::text[],ARRAY[]::text[],ARRAY[]::text[]),
  ('public.player_forecast_season_release_events',ARRAY['SELECT','INSERT']::text[],ARRAY[]::text[],ARRAY[]::text[]),
  ('public.player_forecast_season_release_players',ARRAY['SELECT','INSERT']::text[],ARRAY[]::text[],ARRAY[]::text[]),
  ('public.player_forecast_season_release_teams',ARRAY['SELECT','INSERT']::text[],ARRAY[]::text[],ARRAY[]::text[]),
  ('public.player_forecast_season_releases',ARRAY['SELECT','INSERT']::text[],ARRAY[]::text[],ARRAY[]::text[]),
  ('public.player_forecast_season_roster_conflict_members',ARRAY['SELECT','INSERT']::text[],ARRAY[]::text[],ARRAY[]::text[]),
  ('public.player_forecast_season_roster_conflict_resolutions',ARRAY['SELECT','INSERT']::text[],ARRAY[]::text[],ARRAY[]::text[]),
  ('public.player_forecast_season_roster_conflicts',ARRAY['SELECT','INSERT']::text[],ARRAY[]::text[],ARRAY[]::text[]),
  ('public.player_forecast_season_roster_members',ARRAY['SELECT','INSERT']::text[],ARRAY[]::text[],ARRAY[]::text[]),
  ('public.player_forecast_season_roster_observations',ARRAY['SELECT','INSERT']::text[],ARRAY[]::text[],ARRAY[]::text[]),
  ('public.player_forecast_season_roster_snapshots',ARRAY['SELECT','INSERT']::text[],ARRAY[]::text[],ARRAY[]::text[]),
  ('public.player_forecast_season_runs',ARRAY['SELECT','INSERT','UPDATE']::text[],ARRAY[]::text[],ARRAY[]::text[]),
  ('public.player_forecast_season_schedule_games',ARRAY['SELECT','INSERT']::text[],ARRAY[]::text[],ARRAY[]::text[]),
  ('public.player_forecast_season_schedule_snapshots',ARRAY['SELECT','INSERT']::text[],ARRAY[]::text[],ARRAY[]::text[]),
  ('public.player_forecast_season_team_aggregates',ARRAY['SELECT','INSERT']::text[],ARRAY[]::text[],ARRAY[]::text[]),
  ('public.player_forecast_source_observations',ARRAY['SELECT','INSERT']::text[],ARRAY[]::text[],ARRAY[]::text[]),
  ('public.provider_sync_runs',ARRAY['SELECT','INSERT','UPDATE']::text[],ARRAY[]::text[],ARRAY['SELECT']::text[]),
  ('public.roster_optimizer_team_games',ARRAY['SELECT','INSERT','UPDATE','DELETE']::text[],ARRAY['SELECT']::text[],ARRAY['SELECT']::text[]);

SELECT ok(has_table_privilege(r.role, t.name, p.op) = (p.op = ANY(CASE r.role WHEN 'service_role' THEN t.service_ops WHEN 'anon' THEN t.anon_ops ELSE t.authenticated_ops END)),
  format('%s %s %s matches reviewed allow/deny matrix',r.role,p.op,t.name))
FROM d4_tables t CROSS JOIN (VALUES ('anon'),('authenticated'),('service_role')) r(role)
CROSS JOIN (VALUES ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER')) p(op)
ORDER BY t.name,r.role,p.op;

SELECT ok(c.relrowsecurity, t.name || ' has RLS enabled') FROM d4_tables t JOIN pg_class c ON c.oid=t.name::regclass ORDER BY t.name;

CREATE TEMP TABLE d4_functions(signature text PRIMARY KEY, service_execute boolean NOT NULL DEFAULT true);
INSERT INTO d4_functions(signature) VALUES
  ('public.get_connected_account_tokens_secure(uuid,uuid)'),
  ('public.upsert_connected_account_tokens_secure(uuid,uuid,text,text,text,text,jsonb,text,timestamptz,timestamptz,timestamptz,jsonb)'),
  ('public.append_line_decisions(bigint,bigint,text,jsonb,jsonb)'),
  ('public.apply_player_forecast_season_roster_snapshot(bigint,text,timestamptz,timestamptz,numeric,text,jsonb,jsonb,jsonb)'),
  ('public.attach_draft_pro_stripe_checkout_session(uuid,text,timestamptz)'),
  ('public.begin_draft_pro_private_import_upload(uuid,uuid,uuid,integer,text,text,jsonb)'),
  ('public.begin_draft_pro_save_session(uuid,uuid,integer,text)'),
  ('public.begin_draft_pro_stripe_checkout_attempt(uuid)'),
  ('public.build_player_forecast_runtime_features(bigint,bigint,bigint,timestamptz)'),
  ('public.cas_native_forecast_catalog_head(uuid,integer,bigint,text,uuid,text)'),
  ('public.claim_draft_pro_private_import_cleanup(uuid,integer)'),
  ('public.claim_draft_pro_private_import_upload_cleanup(uuid,integer)'),
  ('public.claim_player_forecast_jobs(uuid,integer,integer)'),
  ('public.claim_player_forecast_season_jobs(uuid,integer,integer)'),
  ('public.clone_player_forecast_season_run(uuid,text)'),
  ('public.clone_player_forecast_season_run_with_assumptions(uuid,text,boolean)'),
  ('public.commit_draft_pro_save_session(uuid,uuid,text,jsonb,integer,uuid[])'),
  ('public.compact_player_forecast_season_queue(bigint,text,integer)'),
  ('public.confirm_draft_pro_private_import_cleanup(uuid,uuid[],uuid)'),
  ('public.confirm_draft_pro_private_import_upload_cleanup(uuid,uuid[])'),
  ('public.create_player_forecast_season_event_run(uuid,uuid,uuid,timestamptz,timestamptz,text,bigint[],smallint[])'),
  ('public.create_player_forecast_season_event_run_with_assumptions(uuid,uuid,uuid,timestamptz,timestamptz,text,bigint[],smallint[],uuid[])'),
  ('public.delete_draft_pro_saved_draft(uuid,uuid,integer)'),
  ('public.duplicate_draft_pro_saved_draft(uuid,uuid,integer,text)'),
  ('public.enqueue_player_forecast_job(text,bigint,bigint,smallint,text,timestamptz,timestamptz,jsonb)'),
  ('public.enqueue_player_forecast_season_job(text,bigint,text,smallint,smallint,bigint,text,timestamptz,timestamptz,jsonb)'),
  ('public.finish_player_forecast_job(uuid,uuid,boolean,text)'),
  ('public.finish_player_forecast_season_job(uuid,uuid,boolean,text,text)'),
  ('public.inherit_player_forecast_season_assumptions(uuid,uuid,uuid[],boolean)'),
  ('public.issue_draft_pro_access_code(uuid,uuid,text,text,timestamptz)'),
  ('public.latest_player_forecast_season_roster_observations(bigint)'),
  ('public.list_draft_pro_saved_drafts(uuid)'),
  ('public.promote_player_forecast_model_atomic(text,uuid,uuid,text,jsonb,timestamptz)'),
  ('public.publish_forge_game_revisions(uuid,uuid)'),
  ('public.publish_player_forecast_season_release_atomic(uuid,text,text,jsonb,jsonb,jsonb,text,uuid,text)'),
  ('public.read_draft_pro_private_import_blob(uuid,uuid,uuid)'),
  ('public.read_draft_pro_private_import_upload(uuid,uuid)'),
  ('public.read_draft_pro_snapshot(uuid,uuid)'),
  ('public.read_forge_game_revisions(date)'),
  ('public.record_draft_pro_stripe_event(text,text,timestamptz,text,text,uuid,uuid,text,boolean,text,text,jsonb)'),
  ('public.redeem_draft_pro_access_code(uuid,text)'),
  ('public.rename_draft_pro_saved_draft(uuid,uuid,integer,text)'),
  ('public.resolve_player_forecast_season_identity(uuid,uuid,text,text,bigint,text,jsonb)'),
  ('public.revoke_draft_pro_access_code(uuid,uuid,text)'),
  ('public.rollback_player_forecast_season_release_atomic(uuid,uuid,text)'),
  ('public.stage_draft_pro_private_import_upload(uuid,uuid,text[],integer,integer,text)');

-- The uncalled model-promotion RPC intentionally has no Data API role grant.
UPDATE d4_functions SET service_execute=false
WHERE signature='public.promote_player_forecast_model_atomic(text,uuid,uuid,text,jsonb,timestamptz)';

SELECT ok(has_function_privilege(r.role,f.signature,'EXECUTE')=(r.role='service_role' AND f.service_execute), format('%s EXECUTE %s',r.role,f.signature))
FROM d4_functions f CROSS JOIN (VALUES ('anon'),('authenticated'),('service_role')) r(role) ORDER BY f.signature,r.role;

SELECT ok(NOT EXISTS(SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE a.grantee=0 AND a.privilege_type='EXECUTE'), f.signature || ' has no inherited PUBLIC EXECUTE')
FROM d4_functions f JOIN pg_proc p ON p.oid=f.signature::regprocedure ORDER BY f.signature;

SELECT ok(has_sequence_privilege(r.role,'public.roster_optimizer_team_games_id_seq',p.op)=(r.role='service_role' AND p.op='USAGE'), format('%s sequence %s',r.role,p.op))
FROM (VALUES ('anon'),('authenticated'),('service_role')) r(role) CROSS JOIN (VALUES ('USAGE'),('SELECT'),('UPDATE')) p(op) ORDER BY r.role,p.op;

SELECT ok(NOT has_schema_privilege(r.role,'fhfh_internal','USAGE'), r.role || ' cannot unlock private schema') FROM (VALUES ('anon'),('authenticated'),('service_role')) r(role);

SELECT ok(NOT prosecdef, 'FORGE reader remains SECURITY INVOKER') FROM pg_proc WHERE oid='public.read_forge_game_revisions(date)'::regprocedure;
SELECT ok(prosecdef, 'native catalog CAS retains reviewed SECURITY DEFINER boundary') FROM pg_proc WHERE oid='public.cas_native_forecast_catalog_head(uuid,integer,bigint,text,uuid,text)'::regprocedure;

SELECT * FROM finish();
ROLLBACK;
