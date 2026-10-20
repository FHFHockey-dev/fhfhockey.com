-- D4: explicit least-privilege grants for the reviewed Data API object set.
--
-- Each object's ACL is reset for PUBLIC, anon, authenticated and service_role and then
-- granted exactly the operations a real caller performs. Callers were traced in web/,
-- functions/ and cms/ (2026-10-20). SECURITY DEFINER functions owned by postgres
-- (all draft_pro_* RPCs, the *_secure token RPCs, the native catalog CAS and
-- build_player_forecast_runtime_features) write without the caller's table grants;
-- SECURITY INVOKER functions need the caller's grants and are counted as callers.
-- PostgREST upserts with ignoreDuplicates need INSERT only; ON CONFLICT DO UPDATE also
-- needs UPDATE. Nothing here uses TRUNCATE, REFERENCES or TRIGGER, and TRUNCATE would
-- bypass the reject-mutation row triggers on the append-only tables.
--
-- Supersedes the broader grants in 20260820050000 (ALL on release_teams and
-- team_aggregates), 20260820052000 (ALL on season_runs) and the SELECT/INSERT/UPDATE/
-- DELETE blocks of the Draft Pro and in-season migrations. No RLS, policy, ownership,
-- schema or function-body change. Rollback: re-run the superseded GRANT statements.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- Provider linkage. The signed-in account page reads all four through owner-only
-- SELECT policies (AccountSettingsPage, RosterScheduleOptimizer); every write is server
-- code or a SECURITY DEFINER RPC. provider_sync_runs is never deleted directly.
revoke all on table
  public.connected_accounts, public.external_leagues, public.external_teams, public.provider_sync_runs
from public, anon, authenticated, service_role;
grant select on table
  public.connected_accounts, public.external_leagues, public.external_teams, public.provider_sync_runs
to authenticated;
grant select, insert, update, delete on table
  public.connected_accounts, public.external_leagues, public.external_teams
to service_role;
grant select, insert, update on table public.provider_sync_runs to service_role;

-- Draft Pro: server routes only. Saved drafts, imports, uploads, checkout and access
-- codes are written through SECURITY DEFINER RPCs; the access-code tables are read only
-- by the verify runners, and private_imports.deleted_at is patched by the scenarios runner.
revoke all on table
  public.draft_pro_access_code_attempts, public.draft_pro_access_codes, public.draft_pro_drafts,
  public.draft_pro_private_import_blobs, public.draft_pro_private_import_uploads,
  public.draft_pro_private_imports, public.draft_pro_provider_events, public.draft_pro_purchases,
  public.draft_pro_refund_requests, public.draft_pro_reports, public.draft_pro_save_sessions,
  public.draft_pro_scenarios
from public, anon, authenticated, service_role;
grant select on table
  public.draft_pro_access_code_attempts, public.draft_pro_access_codes, public.draft_pro_drafts
to service_role;
grant select, update on table public.draft_pro_private_imports, public.draft_pro_purchases to service_role;
grant select, insert, update on table public.draft_pro_provider_events, public.draft_pro_refund_requests to service_role;
grant select, insert on table public.draft_pro_reports, public.draft_pro_scenarios to service_role;

-- RSO saved plans: no browser access at all; the authenticated workspace API filters by
-- the server-derived user_id, context and lock_version. Grants are managed outside the app.
revoke all on table public.in_season_grants, public.in_season_workspaces
from public, anon, authenticated, service_role;
grant select on table public.in_season_grants to service_role;
grant select, insert, update on table public.in_season_workspaces to service_role;

-- RSO team schedule: service upserts (ON CONFLICT DO UPDATE) and prunes rows without an
-- id, so it draws from the identity sequence. Browser SELECT is the deliberate public-read
-- grant and policy from 20260829161013, kept unchanged.
revoke all on table public.roster_optimizer_team_games from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.roster_optimizer_team_games to service_role;
grant select on table public.roster_optimizer_team_games to anon, authenticated;
revoke all on sequence public.roster_optimizer_team_games_id_seq from public, anon, authenticated, service_role;
grant usage on sequence public.roster_optimizer_team_games_id_seq to service_role;

-- FORGE and line evidence: append-only, server only. Inserts are direct, ON CONFLICT DO
-- NOTHING, or through SECURITY INVOKER publish/capture/append functions and triggers.
revoke all on table
  public.forge_board_dispatch_observations, public.forge_board_news_events,
  public.forge_board_visibility_observations, public.forge_final_pregame_revisions,
  public.forge_game_revisions, public.forge_game_selection_events,
  public.line_claim_relations, public.line_claim_revisions, public.line_entry_revisions,
  public.line_game_state_observations, public.line_pp_decisions, public.line_source_captures
from public, anon, authenticated, service_role;
grant select, insert on table
  public.forge_board_dispatch_observations, public.forge_board_news_events,
  public.forge_board_visibility_observations, public.forge_final_pregame_revisions,
  public.forge_game_revisions, public.forge_game_selection_events,
  public.line_claim_relations, public.line_claim_revisions, public.line_entry_revisions,
  public.line_game_state_observations, public.line_pp_decisions, public.line_source_captures
to service_role;

-- Native catalog head: service reads it directly and writes only through the CAS RPC.
revoke all on table public.native_forecast_catalog_heads from public, anon, authenticated, service_role;
grant select on table public.native_forecast_catalog_heads to service_role;

-- Player forecasts: server only. Queues, runs and the active-release pointer are updated;
-- everything else is append-only. champion_history is written only by
-- promote_player_forecast_model_atomic and completeness_waivers is only read, so neither
-- gets INSERT until a caller exists.
revoke all on table
  public.player_forecast_accountability_revisions, public.player_forecast_champion_history,
  public.player_forecast_conflict_members, public.player_forecast_conflict_resolutions,
  public.player_forecast_evaluation_revisions, public.player_forecast_feature_snapshots,
  public.player_forecast_goalie_start_observations, public.player_forecast_inference_queue,
  public.player_forecast_lineup_assignments, public.player_forecast_lineup_snapshots,
  public.player_forecast_model_artifacts, public.player_forecast_observation_conflicts,
  public.player_forecast_outcome_revisions, public.player_forecast_outputs,
  public.player_forecast_rest_of_season_outputs, public.player_forecast_runs,
  public.player_forecast_schedule_revisions, public.player_forecast_source_observations,
  public.player_forecast_season_active_releases, public.player_forecast_season_artifacts,
  public.player_forecast_season_completeness_waivers, public.player_forecast_season_deployment_assignments,
  public.player_forecast_season_deployment_snapshots, public.player_forecast_season_evaluation_revisions,
  public.player_forecast_season_game_outputs, public.player_forecast_season_outcome_revisions,
  public.player_forecast_season_overrides, public.player_forecast_season_player_aggregates,
  public.player_forecast_season_player_pool_review, public.player_forecast_season_queue,
  public.player_forecast_season_release_events, public.player_forecast_season_release_players,
  public.player_forecast_season_release_teams, public.player_forecast_season_releases,
  public.player_forecast_season_roster_conflict_members, public.player_forecast_season_roster_conflict_resolutions,
  public.player_forecast_season_roster_conflicts, public.player_forecast_season_roster_members,
  public.player_forecast_season_roster_observations, public.player_forecast_season_roster_snapshots,
  public.player_forecast_season_runs, public.player_forecast_season_schedule_games,
  public.player_forecast_season_schedule_snapshots, public.player_forecast_season_team_aggregates
from public, anon, authenticated, service_role;
grant select on table
  public.player_forecast_champion_history, public.player_forecast_season_completeness_waivers
to service_role;
grant select, insert, update on table
  public.player_forecast_inference_queue, public.player_forecast_runs,
  public.player_forecast_season_active_releases, public.player_forecast_season_queue,
  public.player_forecast_season_runs
to service_role;
grant select, insert on table
  public.player_forecast_accountability_revisions, public.player_forecast_conflict_members,
  public.player_forecast_conflict_resolutions, public.player_forecast_evaluation_revisions,
  public.player_forecast_feature_snapshots, public.player_forecast_goalie_start_observations,
  public.player_forecast_lineup_assignments, public.player_forecast_lineup_snapshots,
  public.player_forecast_model_artifacts, public.player_forecast_observation_conflicts,
  public.player_forecast_outcome_revisions, public.player_forecast_outputs,
  public.player_forecast_rest_of_season_outputs, public.player_forecast_schedule_revisions,
  public.player_forecast_source_observations, public.player_forecast_season_artifacts,
  public.player_forecast_season_deployment_assignments, public.player_forecast_season_deployment_snapshots,
  public.player_forecast_season_evaluation_revisions, public.player_forecast_season_game_outputs,
  public.player_forecast_season_outcome_revisions, public.player_forecast_season_overrides,
  public.player_forecast_season_player_aggregates, public.player_forecast_season_player_pool_review,
  public.player_forecast_season_release_events, public.player_forecast_season_release_players,
  public.player_forecast_season_release_teams, public.player_forecast_season_releases,
  public.player_forecast_season_roster_conflict_members, public.player_forecast_season_roster_conflict_resolutions,
  public.player_forecast_season_roster_conflicts, public.player_forecast_season_roster_members,
  public.player_forecast_season_roster_observations, public.player_forecast_season_roster_snapshots,
  public.player_forecast_season_schedule_games, public.player_forecast_season_schedule_snapshots,
  public.player_forecast_season_team_aggregates
to service_role;

-- Server RPCs: EXECUTE for service_role only, never PUBLIC. clone/create season run and
-- inherit assumptions are called from the *_with_assumptions functions as INVOKER, so
-- service_role still needs EXECUTE on them. promote_player_forecast_model_atomic has no
-- caller and keeps no grant.
revoke all on function
  public.append_line_decisions(bigint, bigint, text, jsonb, jsonb),
  public.apply_player_forecast_season_roster_snapshot(bigint, text, timestamptz, timestamptz, numeric, text, jsonb, jsonb, jsonb),
  public.attach_draft_pro_stripe_checkout_session(uuid, text, timestamptz),
  public.begin_draft_pro_private_import_upload(uuid, uuid, uuid, integer, text, text, jsonb),
  public.begin_draft_pro_save_session(uuid, uuid, integer, text),
  public.begin_draft_pro_stripe_checkout_attempt(uuid),
  public.build_player_forecast_runtime_features(bigint, bigint, bigint, timestamptz),
  public.cas_native_forecast_catalog_head(uuid, integer, bigint, text, uuid, text),
  public.claim_draft_pro_private_import_cleanup(uuid, integer),
  public.claim_draft_pro_private_import_upload_cleanup(uuid, integer),
  public.claim_player_forecast_jobs(uuid, integer, integer),
  public.claim_player_forecast_season_jobs(uuid, integer, integer),
  public.clone_player_forecast_season_run(uuid, text),
  public.clone_player_forecast_season_run_with_assumptions(uuid, text, boolean),
  public.commit_draft_pro_save_session(uuid, uuid, text, jsonb, integer, uuid[]),
  public.compact_player_forecast_season_queue(bigint, text, integer),
  public.confirm_draft_pro_private_import_cleanup(uuid, uuid[], uuid),
  public.confirm_draft_pro_private_import_upload_cleanup(uuid, uuid[]),
  public.create_player_forecast_season_event_run(uuid, uuid, uuid, timestamptz, timestamptz, text, bigint[], smallint[]),
  public.create_player_forecast_season_event_run_with_assumptions(uuid, uuid, uuid, timestamptz, timestamptz, text, bigint[], smallint[], uuid[]),
  public.delete_draft_pro_saved_draft(uuid, uuid, integer),
  public.duplicate_draft_pro_saved_draft(uuid, uuid, integer, text),
  public.enqueue_player_forecast_job(text, bigint, bigint, smallint, text, timestamptz, timestamptz, jsonb),
  public.enqueue_player_forecast_season_job(text, bigint, text, smallint, smallint, bigint, text, timestamptz, timestamptz, jsonb),
  public.finish_player_forecast_job(uuid, uuid, boolean, text),
  public.finish_player_forecast_season_job(uuid, uuid, boolean, text, text),
  public.get_connected_account_tokens_secure(uuid, uuid),
  public.inherit_player_forecast_season_assumptions(uuid, uuid, uuid[], boolean),
  public.issue_draft_pro_access_code(uuid, uuid, text, text, timestamptz),
  public.latest_player_forecast_season_roster_observations(bigint),
  public.list_draft_pro_saved_drafts(uuid),
  public.promote_player_forecast_model_atomic(text, uuid, uuid, text, jsonb, timestamptz),
  public.publish_forge_game_revisions(uuid, uuid),
  public.publish_player_forecast_season_release_atomic(uuid, text, text, jsonb, jsonb, jsonb, text, uuid, text),
  public.read_draft_pro_private_import_blob(uuid, uuid, uuid),
  public.read_draft_pro_private_import_upload(uuid, uuid),
  public.read_draft_pro_snapshot(uuid, uuid),
  public.read_forge_game_revisions(date),
  public.record_draft_pro_stripe_event(text, text, timestamptz, text, text, uuid, uuid, text, boolean, text, text, jsonb),
  public.redeem_draft_pro_access_code(uuid, text),
  public.rename_draft_pro_saved_draft(uuid, uuid, integer, text),
  public.resolve_player_forecast_season_identity(uuid, uuid, text, text, bigint, text, jsonb),
  public.revoke_draft_pro_access_code(uuid, uuid, text),
  public.rollback_player_forecast_season_release_atomic(uuid, uuid, text),
  public.stage_draft_pro_private_import_upload(uuid, uuid, text[], integer, integer, text),
  public.upsert_connected_account_tokens_secure(uuid, uuid, text, text, text, text, jsonb, text, timestamptz, timestamptz, timestamptz, jsonb)
from public, anon, authenticated, service_role;
grant execute on function
  public.append_line_decisions(bigint, bigint, text, jsonb, jsonb),
  public.apply_player_forecast_season_roster_snapshot(bigint, text, timestamptz, timestamptz, numeric, text, jsonb, jsonb, jsonb),
  public.attach_draft_pro_stripe_checkout_session(uuid, text, timestamptz),
  public.begin_draft_pro_private_import_upload(uuid, uuid, uuid, integer, text, text, jsonb),
  public.begin_draft_pro_save_session(uuid, uuid, integer, text),
  public.begin_draft_pro_stripe_checkout_attempt(uuid),
  public.build_player_forecast_runtime_features(bigint, bigint, bigint, timestamptz),
  public.cas_native_forecast_catalog_head(uuid, integer, bigint, text, uuid, text),
  public.claim_draft_pro_private_import_cleanup(uuid, integer),
  public.claim_draft_pro_private_import_upload_cleanup(uuid, integer),
  public.claim_player_forecast_jobs(uuid, integer, integer),
  public.claim_player_forecast_season_jobs(uuid, integer, integer),
  public.clone_player_forecast_season_run(uuid, text),
  public.clone_player_forecast_season_run_with_assumptions(uuid, text, boolean),
  public.commit_draft_pro_save_session(uuid, uuid, text, jsonb, integer, uuid[]),
  public.compact_player_forecast_season_queue(bigint, text, integer),
  public.confirm_draft_pro_private_import_cleanup(uuid, uuid[], uuid),
  public.confirm_draft_pro_private_import_upload_cleanup(uuid, uuid[]),
  public.create_player_forecast_season_event_run(uuid, uuid, uuid, timestamptz, timestamptz, text, bigint[], smallint[]),
  public.create_player_forecast_season_event_run_with_assumptions(uuid, uuid, uuid, timestamptz, timestamptz, text, bigint[], smallint[], uuid[]),
  public.delete_draft_pro_saved_draft(uuid, uuid, integer),
  public.duplicate_draft_pro_saved_draft(uuid, uuid, integer, text),
  public.enqueue_player_forecast_job(text, bigint, bigint, smallint, text, timestamptz, timestamptz, jsonb),
  public.enqueue_player_forecast_season_job(text, bigint, text, smallint, smallint, bigint, text, timestamptz, timestamptz, jsonb),
  public.finish_player_forecast_job(uuid, uuid, boolean, text),
  public.finish_player_forecast_season_job(uuid, uuid, boolean, text, text),
  public.get_connected_account_tokens_secure(uuid, uuid),
  public.inherit_player_forecast_season_assumptions(uuid, uuid, uuid[], boolean),
  public.issue_draft_pro_access_code(uuid, uuid, text, text, timestamptz),
  public.latest_player_forecast_season_roster_observations(bigint),
  public.list_draft_pro_saved_drafts(uuid),
  public.publish_forge_game_revisions(uuid, uuid),
  public.publish_player_forecast_season_release_atomic(uuid, text, text, jsonb, jsonb, jsonb, text, uuid, text),
  public.read_draft_pro_private_import_blob(uuid, uuid, uuid),
  public.read_draft_pro_private_import_upload(uuid, uuid),
  public.read_draft_pro_snapshot(uuid, uuid),
  public.read_forge_game_revisions(date),
  public.record_draft_pro_stripe_event(text, text, timestamptz, text, text, uuid, uuid, text, boolean, text, text, jsonb),
  public.redeem_draft_pro_access_code(uuid, text),
  public.rename_draft_pro_saved_draft(uuid, uuid, integer, text),
  public.resolve_player_forecast_season_identity(uuid, uuid, text, text, bigint, text, jsonb),
  public.revoke_draft_pro_access_code(uuid, uuid, text),
  public.rollback_player_forecast_season_release_atomic(uuid, uuid, text),
  public.stage_draft_pro_private_import_upload(uuid, uuid, text[], integer, integer, text),
  public.upsert_connected_account_tokens_secure(uuid, uuid, text, text, text, text, jsonb, text, timestamptz, timestamptz, timestamptz, jsonb)
to service_role;

commit;
