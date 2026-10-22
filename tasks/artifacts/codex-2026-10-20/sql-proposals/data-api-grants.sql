-- PROPOSED ONLY / NOT A MIGRATION / NOT APPROVED / NOT APPLIED
-- Entire proposal is inside a block comment. Running this file executes no SQL.
-- Review D4.md before extracting into a separately authorized migration.
/*
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- Future objects: postgres is the only creator role confirmed by baseline source.
-- Repeat ONLY for additional confirmed object creator roles after catalog review.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM PUBLIC, anon, authenticated, service_role;
-- PostgreSQL global PUBLIC EXECUTE cannot be removed by a schema-local revoke.
-- This creator-scoped global default changes FUTURE functions in every schema.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
-- Defaults do not repair existing objects. Reconcile each reviewed ACL below.

-- supabase/migrations/20261019052934_restrict_provider_linkage_browser_writes.sql:15-28; Authenticated owner SELECT; preserve baseline service ALL pending separate operation review
REVOKE ALL ON TABLE public.connected_accounts FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.connected_accounts TO service_role;
GRANT SELECT ON TABLE public.connected_accounts TO authenticated;

-- supabase/migrations/20260909120000_draft_pro_complimentary_access_codes.sql; Service API only; revoke PUBLIC too; narrow baseline extras in proposal
REVOKE ALL ON TABLE public.draft_pro_access_code_attempts FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.draft_pro_access_code_attempts TO service_role;

-- supabase/migrations/20260909120000_draft_pro_complimentary_access_codes.sql; Service API only; revoke PUBLIC too; narrow baseline extras in proposal
REVOKE ALL ON TABLE public.draft_pro_access_codes FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.draft_pro_access_codes TO service_role;

-- supabase/migrations/20260907143356_draft_pro_foundation.sql; Service API only; revoke PUBLIC too; narrow baseline extras in proposal
REVOKE ALL ON TABLE public.draft_pro_drafts FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.draft_pro_drafts TO service_role;

-- supabase/migrations/20260907182507_draft_pro_saved_drafts_transactions.sql; Service API only; revoke PUBLIC too; narrow baseline extras in proposal
REVOKE ALL ON TABLE public.draft_pro_private_import_blobs FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.draft_pro_private_import_blobs TO service_role;

-- supabase/migrations/20260907182507_draft_pro_saved_drafts_transactions.sql; Service API only; revoke PUBLIC too; narrow baseline extras in proposal
REVOKE ALL ON TABLE public.draft_pro_private_import_uploads FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.draft_pro_private_import_uploads TO service_role;

-- supabase/migrations/20260907143356_draft_pro_foundation.sql; Service API only; revoke PUBLIC too; narrow baseline extras in proposal
REVOKE ALL ON TABLE public.draft_pro_private_imports FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.draft_pro_private_imports TO service_role;

-- supabase/migrations/20260907143356_draft_pro_foundation.sql; Service API only; revoke PUBLIC too; narrow baseline extras in proposal
REVOKE ALL ON TABLE public.draft_pro_provider_events FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.draft_pro_provider_events TO service_role;

-- supabase/migrations/20260907143356_draft_pro_foundation.sql; Service API only; revoke PUBLIC too; narrow baseline extras in proposal
REVOKE ALL ON TABLE public.draft_pro_purchases FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.draft_pro_purchases TO service_role;

-- supabase/migrations/20260907143356_draft_pro_foundation.sql; Service API only; revoke PUBLIC too; narrow baseline extras in proposal
REVOKE ALL ON TABLE public.draft_pro_refund_requests FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.draft_pro_refund_requests TO service_role;

-- supabase/migrations/20260907143356_draft_pro_foundation.sql; Service API only; revoke PUBLIC too; narrow baseline extras in proposal
REVOKE ALL ON TABLE public.draft_pro_reports FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.draft_pro_reports TO service_role;

-- supabase/migrations/20260907182507_draft_pro_saved_drafts_transactions.sql; Service API only; revoke PUBLIC too; narrow baseline extras in proposal
REVOKE ALL ON TABLE public.draft_pro_save_sessions FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.draft_pro_save_sessions TO service_role;

-- supabase/migrations/20260907143356_draft_pro_foundation.sql; Service API only; revoke PUBLIC too; narrow baseline extras in proposal
REVOKE ALL ON TABLE public.draft_pro_scenarios FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.draft_pro_scenarios TO service_role;

-- supabase/migrations/20261019052934_restrict_provider_linkage_browser_writes.sql:15-28; Authenticated owner SELECT; preserve baseline service ALL pending separate operation review
REVOKE ALL ON TABLE public.external_leagues FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.external_leagues TO service_role;
GRANT SELECT ON TABLE public.external_leagues TO authenticated;

-- supabase/migrations/20261019052934_restrict_provider_linkage_browser_writes.sql:15-28; Authenticated owner SELECT; preserve baseline service ALL pending separate operation review
REVOKE ALL ON TABLE public.external_teams FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.external_teams TO service_role;
GRANT SELECT ON TABLE public.external_teams TO authenticated;

-- supabase/migrations/20260916023000_starter_board_release_control.sql:48-51; PROPOSED narrow service ACL: baseline defaults may retain extra service privileges
REVOKE ALL ON TABLE public.forge_board_dispatch_observations FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON TABLE public.forge_board_dispatch_observations TO service_role;

-- supabase/migrations/20260916023000_starter_board_release_control.sql:48-51; PROPOSED narrow service ACL: baseline defaults may retain extra service privileges
REVOKE ALL ON TABLE public.forge_board_news_events FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON TABLE public.forge_board_news_events TO service_role;

-- supabase/migrations/20260916023000_starter_board_release_control.sql:48-51; PROPOSED narrow service ACL: baseline defaults may retain extra service privileges
REVOKE ALL ON TABLE public.forge_board_visibility_observations FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON TABLE public.forge_board_visibility_observations TO service_role;

-- supabase/migrations/20260916023000_starter_board_release_control.sql:48-51; PROPOSED narrow service ACL: baseline defaults may retain extra service privileges
REVOKE ALL ON TABLE public.forge_final_pregame_revisions FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON TABLE public.forge_final_pregame_revisions TO service_role;

-- supabase/migrations/20260916012353_starter_board_game_revisions.sql:20-22; PROPOSED narrow service ACL: baseline defaults may retain extra service privileges
REVOKE ALL ON TABLE public.forge_game_revisions FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON TABLE public.forge_game_revisions TO service_role;

-- supabase/migrations/20260916023000_starter_board_release_control.sql:48-51; PROPOSED narrow service ACL: baseline defaults may retain extra service privileges
REVOKE ALL ON TABLE public.forge_game_selection_events FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON TABLE public.forge_game_selection_events TO service_role;

-- supabase/migrations/20260927104934_in_season_access_workspace.sql; Service API only; revoke PUBLIC too; narrow baseline extras in proposal
REVOKE ALL ON TABLE public.in_season_grants FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.in_season_grants TO service_role;

-- supabase/migrations/20260927104934_in_season_access_workspace.sql; Service API only; revoke PUBLIC too; narrow baseline extras in proposal
REVOKE ALL ON TABLE public.in_season_workspaces FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.in_season_workspaces TO service_role;

-- supabase/migrations/20261002134400_game_line_snapshots.sql:73-80; Append-only; service UPDATE/DELETE/TRUNCATE denied
REVOKE ALL ON TABLE public.line_claim_relations FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON TABLE public.line_claim_relations TO service_role;

-- supabase/migrations/20261002134400_game_line_snapshots.sql:73-80; Append-only; service UPDATE/DELETE/TRUNCATE denied
REVOKE ALL ON TABLE public.line_claim_revisions FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON TABLE public.line_claim_revisions TO service_role;

-- supabase/migrations/20261002134400_game_line_snapshots.sql:73-80; Append-only; service UPDATE/DELETE/TRUNCATE denied
REVOKE ALL ON TABLE public.line_entry_revisions FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON TABLE public.line_entry_revisions TO service_role;

-- supabase/migrations/20261002134400_game_line_snapshots.sql:73-80; Append-only; service UPDATE/DELETE/TRUNCATE denied
REVOKE ALL ON TABLE public.line_game_state_observations FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON TABLE public.line_game_state_observations TO service_role;

-- supabase/migrations/20261002134400_game_line_snapshots.sql:73-80; Append-only; service UPDATE/DELETE/TRUNCATE denied
REVOKE ALL ON TABLE public.line_pp_decisions FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON TABLE public.line_pp_decisions TO service_role;

-- supabase/migrations/20261002134400_game_line_snapshots.sql:73-80; Append-only; service UPDATE/DELETE/TRUNCATE denied
REVOKE ALL ON TABLE public.line_source_captures FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON TABLE public.line_source_captures TO service_role;

-- supabase/migrations/20261017183611_native_forecast_catalog_heads.sql:17-20; RLS forced; writes only through service-only SECURITY DEFINER CAS
REVOKE ALL ON TABLE public.native_forecast_catalog_heads FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.native_forecast_catalog_heads TO service_role;

-- supabase/migrations/20260802163747_add_player_forecast_foundation.sql:762; Explicit service grant; effective ACL requires replay
REVOKE ALL ON TABLE public.player_forecast_accountability_revisions FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON TABLE public.player_forecast_accountability_revisions TO service_role;

-- supabase/migrations/20260802163747_add_player_forecast_foundation.sql:762; Explicit service grant; effective ACL requires replay
REVOKE ALL ON TABLE public.player_forecast_champion_history FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON TABLE public.player_forecast_champion_history TO service_role;

-- supabase/migrations/20260802163747_add_player_forecast_foundation.sql:762; Explicit service grant; effective ACL requires replay
REVOKE ALL ON TABLE public.player_forecast_conflict_members FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON TABLE public.player_forecast_conflict_members TO service_role;

-- supabase/migrations/20260802163747_add_player_forecast_foundation.sql:762; Explicit service grant; effective ACL requires replay
REVOKE ALL ON TABLE public.player_forecast_conflict_resolutions FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON TABLE public.player_forecast_conflict_resolutions TO service_role;

-- supabase/migrations/20260802163747_add_player_forecast_foundation.sql:762; Explicit service grant; effective ACL requires replay
REVOKE ALL ON TABLE public.player_forecast_evaluation_revisions FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON TABLE public.player_forecast_evaluation_revisions TO service_role;

-- supabase/migrations/20260802163747_add_player_forecast_foundation.sql:762; Explicit service grant; effective ACL requires replay
REVOKE ALL ON TABLE public.player_forecast_feature_snapshots FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON TABLE public.player_forecast_feature_snapshots TO service_role;

-- supabase/migrations/20260802163747_add_player_forecast_foundation.sql:762; Explicit service grant; effective ACL requires replay
REVOKE ALL ON TABLE public.player_forecast_goalie_start_observations FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON TABLE public.player_forecast_goalie_start_observations TO service_role;

-- supabase/migrations/20260802163747_add_player_forecast_foundation.sql:780; Explicit service grant; effective ACL requires replay
REVOKE ALL ON TABLE public.player_forecast_inference_queue FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.player_forecast_inference_queue TO service_role;

-- supabase/migrations/20260802163747_add_player_forecast_foundation.sql:762; Explicit service grant; effective ACL requires replay
REVOKE ALL ON TABLE public.player_forecast_lineup_assignments FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON TABLE public.player_forecast_lineup_assignments TO service_role;

-- supabase/migrations/20260802163747_add_player_forecast_foundation.sql:762; Explicit service grant; effective ACL requires replay
REVOKE ALL ON TABLE public.player_forecast_lineup_snapshots FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON TABLE public.player_forecast_lineup_snapshots TO service_role;

-- supabase/migrations/20260802163747_add_player_forecast_foundation.sql:762; Explicit service grant; effective ACL requires replay
REVOKE ALL ON TABLE public.player_forecast_model_artifacts FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON TABLE public.player_forecast_model_artifacts TO service_role;

-- supabase/migrations/20260802163747_add_player_forecast_foundation.sql:762; Explicit service grant; effective ACL requires replay
REVOKE ALL ON TABLE public.player_forecast_observation_conflicts FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON TABLE public.player_forecast_observation_conflicts TO service_role;

-- supabase/migrations/20260802163747_add_player_forecast_foundation.sql:762; Explicit service grant; effective ACL requires replay
REVOKE ALL ON TABLE public.player_forecast_outcome_revisions FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON TABLE public.player_forecast_outcome_revisions TO service_role;

-- supabase/migrations/20260802163747_add_player_forecast_foundation.sql:762; Explicit service grant; effective ACL requires replay
REVOKE ALL ON TABLE public.player_forecast_outputs FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON TABLE public.player_forecast_outputs TO service_role;

-- supabase/migrations/20260805001038_add_player_forecast_rest_of_season_outputs.sql:51; Explicit service grant; effective ACL requires replay
REVOKE ALL ON TABLE public.player_forecast_rest_of_season_outputs FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON TABLE public.player_forecast_rest_of_season_outputs TO service_role;

-- supabase/migrations/20260802163747_add_player_forecast_foundation.sql:780; Explicit service grant; effective ACL requires replay
REVOKE ALL ON TABLE public.player_forecast_runs FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.player_forecast_runs TO service_role;

-- supabase/migrations/20260802163747_add_player_forecast_foundation.sql:762; Explicit service grant; effective ACL requires replay
REVOKE ALL ON TABLE public.player_forecast_schedule_revisions FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON TABLE public.player_forecast_schedule_revisions TO service_role;

-- supabase/migrations/20260813001304_player_forecast_season_v3.sql:1430; Explicit service grant; effective ACL requires replay
REVOKE ALL ON TABLE public.player_forecast_season_active_releases FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.player_forecast_season_active_releases TO service_role;

-- supabase/migrations/20260813001304_player_forecast_season_v3.sql:1408; Explicit service grant; effective ACL requires replay
REVOKE ALL ON TABLE public.player_forecast_season_artifacts FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON TABLE public.player_forecast_season_artifacts TO service_role;

-- supabase/migrations/20260813001304_player_forecast_season_v3.sql:1408; Explicit service grant; effective ACL requires replay
REVOKE ALL ON TABLE public.player_forecast_season_completeness_waivers FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON TABLE public.player_forecast_season_completeness_waivers TO service_role;

-- supabase/migrations/20260813001304_player_forecast_season_v3.sql:1408; Explicit service grant; effective ACL requires replay
REVOKE ALL ON TABLE public.player_forecast_season_deployment_assignments FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON TABLE public.player_forecast_season_deployment_assignments TO service_role;

-- supabase/migrations/20260813001304_player_forecast_season_v3.sql:1408; Explicit service grant; effective ACL requires replay
REVOKE ALL ON TABLE public.player_forecast_season_deployment_snapshots FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON TABLE public.player_forecast_season_deployment_snapshots TO service_role;

-- supabase/migrations/20260813001304_player_forecast_season_v3.sql:1408; Explicit service grant; effective ACL requires replay
REVOKE ALL ON TABLE public.player_forecast_season_evaluation_revisions FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON TABLE public.player_forecast_season_evaluation_revisions TO service_role;

-- supabase/migrations/20260813001304_player_forecast_season_v3.sql:1408; Explicit service grant; effective ACL requires replay
REVOKE ALL ON TABLE public.player_forecast_season_game_outputs FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON TABLE public.player_forecast_season_game_outputs TO service_role;

-- supabase/migrations/20260813001304_player_forecast_season_v3.sql:1408; Explicit service grant; effective ACL requires replay
REVOKE ALL ON TABLE public.player_forecast_season_outcome_revisions FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON TABLE public.player_forecast_season_outcome_revisions TO service_role;

-- supabase/migrations/20260813001304_player_forecast_season_v3.sql:1408; Explicit service grant; effective ACL requires replay
REVOKE ALL ON TABLE public.player_forecast_season_overrides FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON TABLE public.player_forecast_season_overrides TO service_role;

-- supabase/migrations/20260813001304_player_forecast_season_v3.sql:1408; Explicit service grant; effective ACL requires replay
REVOKE ALL ON TABLE public.player_forecast_season_player_aggregates FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON TABLE public.player_forecast_season_player_aggregates TO service_role;

-- supabase/migrations/20260813001304_player_forecast_season_v3.sql:1408; Explicit service grant; effective ACL requires replay
REVOKE ALL ON TABLE public.player_forecast_season_player_pool_review FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON TABLE public.player_forecast_season_player_pool_review TO service_role;

-- supabase/migrations/20260813001304_player_forecast_season_v3.sql:1430; Explicit service grant; effective ACL requires replay
REVOKE ALL ON TABLE public.player_forecast_season_queue FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.player_forecast_season_queue TO service_role;

-- supabase/migrations/20260813001304_player_forecast_season_v3.sql:1408; Explicit service grant; effective ACL requires replay
REVOKE ALL ON TABLE public.player_forecast_season_release_events FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON TABLE public.player_forecast_season_release_events TO service_role;

-- supabase/migrations/20260813001304_player_forecast_season_v3.sql:1408; Explicit service grant; effective ACL requires replay
REVOKE ALL ON TABLE public.player_forecast_season_release_players FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON TABLE public.player_forecast_season_release_players TO service_role;

-- supabase/migrations/20260820050000_player_forecast_v5_team_metrics.sql:109; Explicit service grant; effective ACL requires replay
REVOKE ALL ON TABLE public.player_forecast_season_release_teams FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.player_forecast_season_release_teams TO service_role;

-- supabase/migrations/20260813001304_player_forecast_season_v3.sql:1408; Explicit service grant; effective ACL requires replay
REVOKE ALL ON TABLE public.player_forecast_season_releases FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON TABLE public.player_forecast_season_releases TO service_role;

-- supabase/migrations/20260818150256_player_forecast_season_v4_integrity.sql:1032; Explicit service grant; effective ACL requires replay
REVOKE ALL ON TABLE public.player_forecast_season_roster_conflict_members FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON TABLE public.player_forecast_season_roster_conflict_members TO service_role;

-- supabase/migrations/20260818150256_player_forecast_season_v4_integrity.sql:1032; Explicit service grant; effective ACL requires replay
REVOKE ALL ON TABLE public.player_forecast_season_roster_conflict_resolutions FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON TABLE public.player_forecast_season_roster_conflict_resolutions TO service_role;

-- supabase/migrations/20260818150256_player_forecast_season_v4_integrity.sql:1032; Explicit service grant; effective ACL requires replay
REVOKE ALL ON TABLE public.player_forecast_season_roster_conflicts FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON TABLE public.player_forecast_season_roster_conflicts TO service_role;

-- supabase/migrations/20260813001304_player_forecast_season_v3.sql:1408; Explicit service grant; effective ACL requires replay
REVOKE ALL ON TABLE public.player_forecast_season_roster_members FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON TABLE public.player_forecast_season_roster_members TO service_role;

-- supabase/migrations/20260818150256_player_forecast_season_v4_integrity.sql:1032; Explicit service grant; effective ACL requires replay
REVOKE ALL ON TABLE public.player_forecast_season_roster_observations FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON TABLE public.player_forecast_season_roster_observations TO service_role;

-- supabase/migrations/20260813001304_player_forecast_season_v3.sql:1408; Explicit service grant; effective ACL requires replay
REVOKE ALL ON TABLE public.player_forecast_season_roster_snapshots FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON TABLE public.player_forecast_season_roster_snapshots TO service_role;

-- supabase/migrations/20260820052000_player_forecast_copy_on_write_runs.sql:79; Explicit service grant; effective ACL requires replay
REVOKE ALL ON TABLE public.player_forecast_season_runs FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.player_forecast_season_runs TO service_role;

-- supabase/migrations/20260813001304_player_forecast_season_v3.sql:1408; Explicit service grant; effective ACL requires replay
REVOKE ALL ON TABLE public.player_forecast_season_schedule_games FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON TABLE public.player_forecast_season_schedule_games TO service_role;

-- supabase/migrations/20260813001304_player_forecast_season_v3.sql:1408; Explicit service grant; effective ACL requires replay
REVOKE ALL ON TABLE public.player_forecast_season_schedule_snapshots FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON TABLE public.player_forecast_season_schedule_snapshots TO service_role;

-- supabase/migrations/20260820050000_player_forecast_v5_team_metrics.sql:108; Explicit service grant; effective ACL requires replay
REVOKE ALL ON TABLE public.player_forecast_season_team_aggregates FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.player_forecast_season_team_aggregates TO service_role;

-- supabase/migrations/20260802163747_add_player_forecast_foundation.sql:762; Explicit service grant; effective ACL requires replay
REVOKE ALL ON TABLE public.player_forecast_source_observations FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON TABLE public.player_forecast_source_observations TO service_role;

-- supabase/migrations/20261019052934_restrict_provider_linkage_browser_writes.sql:15-28; Authenticated owner SELECT; preserve baseline service ALL pending separate operation review
REVOKE ALL ON TABLE public.provider_sync_runs FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.provider_sync_runs TO service_role;
GRANT SELECT ON TABLE public.provider_sync_runs TO authenticated;

-- supabase/migrations/20260829161013_add_roster_optimizer_team_game_schedule.sql:78-97; Public SELECT RLS policy; identity sequence service USAGE/SELECT only
REVOKE ALL ON TABLE public.roster_optimizer_team_games FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.roster_optimizer_team_games TO service_role;
GRANT SELECT ON TABLE public.roster_optimizer_team_games TO anon, authenticated;

REVOKE ALL ON SEQUENCE public.roster_optimizer_team_games_id_seq FROM PUBLIC, anon, authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE public.roster_optimizer_team_games_id_seq TO service_role;

-- supabase/migrations/20261002134400_game_line_snapshots.sql:114-115
REVOKE ALL ON FUNCTION public.append_line_decisions(bigint,bigint,text,jsonb,jsonb) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.append_line_decisions(bigint,bigint,text,jsonb,jsonb) TO service_role;
-- supabase/migrations/20260818150256_player_forecast_season_v4_integrity.sql:1042
REVOKE ALL ON FUNCTION public.apply_player_forecast_season_roster_snapshot(bigint,text,timestamptz,timestamptz,numeric,text,jsonb,jsonb,jsonb) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.apply_player_forecast_season_roster_snapshot(bigint,text,timestamptz,timestamptz,numeric,text,jsonb,jsonb,jsonb) TO service_role;
-- supabase/migrations/20260907145602_draft_pro_stripe_fulfillment.sql:231
REVOKE ALL ON FUNCTION public.attach_draft_pro_stripe_checkout_session(uuid,text,timestamptz) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.attach_draft_pro_stripe_checkout_session(uuid,text,timestamptz) TO service_role;
-- supabase/migrations/20260907182507_draft_pro_saved_drafts_transactions.sql:389
REVOKE ALL ON FUNCTION public.begin_draft_pro_private_import_upload(uuid,uuid,uuid,integer,text,text,jsonb) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.begin_draft_pro_private_import_upload(uuid,uuid,uuid,integer,text,text,jsonb) TO service_role;
-- supabase/migrations/20260907182507_draft_pro_saved_drafts_transactions.sql:389
REVOKE ALL ON FUNCTION public.begin_draft_pro_save_session(uuid,uuid,integer,text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.begin_draft_pro_save_session(uuid,uuid,integer,text) TO service_role;
-- supabase/migrations/20260907145602_draft_pro_stripe_fulfillment.sql:230
REVOKE ALL ON FUNCTION public.begin_draft_pro_stripe_checkout_attempt(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.begin_draft_pro_stripe_checkout_attempt(uuid) TO service_role;
-- supabase/migrations/20260805003121_add_player_forecast_runtime_context_rates.sql:183
REVOKE ALL ON FUNCTION public.build_player_forecast_runtime_features(bigint,bigint,bigint,timestamptz) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.build_player_forecast_runtime_features(bigint,bigint,bigint,timestamptz) TO service_role;
-- supabase/migrations/20261017183611_native_forecast_catalog_heads.sql:62-63
REVOKE ALL ON FUNCTION public.cas_native_forecast_catalog_head(uuid,integer,bigint,text,uuid,text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cas_native_forecast_catalog_head(uuid,integer,bigint,text,uuid,text) TO service_role;
-- supabase/migrations/20260907182507_draft_pro_saved_drafts_transactions.sql:389
REVOKE ALL ON FUNCTION public.claim_draft_pro_private_import_cleanup(uuid,integer) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.claim_draft_pro_private_import_cleanup(uuid,integer) TO service_role;
-- supabase/migrations/20260907182507_draft_pro_saved_drafts_transactions.sql:389
REVOKE ALL ON FUNCTION public.claim_draft_pro_private_import_upload_cleanup(uuid,integer) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.claim_draft_pro_private_import_upload_cleanup(uuid,integer) TO service_role;
-- supabase/migrations/20260802163747_add_player_forecast_foundation.sql:791
REVOKE ALL ON FUNCTION public.claim_player_forecast_jobs(uuid,integer,integer) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.claim_player_forecast_jobs(uuid,integer,integer) TO service_role;
-- supabase/migrations/20260813001304_player_forecast_season_v3.sql:1442
REVOKE ALL ON FUNCTION public.claim_player_forecast_season_jobs(uuid,integer,integer) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.claim_player_forecast_season_jobs(uuid,integer,integer) TO service_role;
-- supabase/migrations/20260813001304_player_forecast_season_v3.sql:1450
REVOKE ALL ON FUNCTION public.clone_player_forecast_season_run(uuid,text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.clone_player_forecast_season_run(uuid,text) TO service_role;
-- supabase/migrations/20260826133000_inherit_player_forecast_season_assumptions.sql:222
REVOKE ALL ON FUNCTION public.clone_player_forecast_season_run_with_assumptions(uuid,text,boolean) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.clone_player_forecast_season_run_with_assumptions(uuid,text,boolean) TO service_role;
-- supabase/migrations/20260907182507_draft_pro_saved_drafts_transactions.sql:389
REVOKE ALL ON FUNCTION public.commit_draft_pro_save_session(uuid,uuid,text,jsonb,integer,uuid[]) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.commit_draft_pro_save_session(uuid,uuid,text,jsonb,integer,uuid[]) TO service_role;
-- supabase/migrations/20260820014700_player_forecast_season_queue_compaction.sql:100
REVOKE ALL ON FUNCTION public.compact_player_forecast_season_queue(bigint,text,integer) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.compact_player_forecast_season_queue(bigint,text,integer) TO service_role;
-- supabase/migrations/20260907182507_draft_pro_saved_drafts_transactions.sql:389
REVOKE ALL ON FUNCTION public.confirm_draft_pro_private_import_cleanup(uuid,uuid[],uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.confirm_draft_pro_private_import_cleanup(uuid,uuid[],uuid) TO service_role;
-- supabase/migrations/20260907182507_draft_pro_saved_drafts_transactions.sql:389
REVOKE ALL ON FUNCTION public.confirm_draft_pro_private_import_upload_cleanup(uuid,uuid[]) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.confirm_draft_pro_private_import_upload_cleanup(uuid,uuid[]) TO service_role;
-- supabase/migrations/20260818150256_player_forecast_season_v4_integrity.sql:1052
REVOKE ALL ON FUNCTION public.create_player_forecast_season_event_run(uuid,uuid,uuid,timestamptz,timestamptz,text,bigint[],smallint[]) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_player_forecast_season_event_run(uuid,uuid,uuid,timestamptz,timestamptz,text,bigint[],smallint[]) TO service_role;
-- supabase/migrations/20260826133000_inherit_player_forecast_season_assumptions.sql:228
REVOKE ALL ON FUNCTION public.create_player_forecast_season_event_run_with_assumptions(uuid,uuid,uuid,timestamptz,timestamptz,text,bigint[],smallint[],uuid[]) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_player_forecast_season_event_run_with_assumptions(uuid,uuid,uuid,timestamptz,timestamptz,text,bigint[],smallint[],uuid[]) TO service_role;
-- supabase/migrations/20260907182507_draft_pro_saved_drafts_transactions.sql:389
REVOKE ALL ON FUNCTION public.delete_draft_pro_saved_draft(uuid,uuid,integer) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_draft_pro_saved_draft(uuid,uuid,integer) TO service_role;
-- supabase/migrations/20260907182507_draft_pro_saved_drafts_transactions.sql:389
REVOKE ALL ON FUNCTION public.duplicate_draft_pro_saved_draft(uuid,uuid,integer,text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.duplicate_draft_pro_saved_draft(uuid,uuid,integer,text) TO service_role;
-- supabase/migrations/20260802163747_add_player_forecast_foundation.sql:787
REVOKE ALL ON FUNCTION public.enqueue_player_forecast_job(text,bigint,bigint,smallint,text,timestamptz,timestamptz,jsonb) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.enqueue_player_forecast_job(text,bigint,bigint,smallint,text,timestamptz,timestamptz,jsonb) TO service_role;
-- supabase/migrations/20260813001304_player_forecast_season_v3.sql:1438
REVOKE ALL ON FUNCTION public.enqueue_player_forecast_season_job(text,bigint,text,smallint,smallint,bigint,text,timestamptz,timestamptz,jsonb) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.enqueue_player_forecast_season_job(text,bigint,text,smallint,smallint,bigint,text,timestamptz,timestamptz,jsonb) TO service_role;
-- supabase/migrations/20260802163747_add_player_forecast_foundation.sql:795
REVOKE ALL ON FUNCTION public.finish_player_forecast_job(uuid,uuid,boolean,text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.finish_player_forecast_job(uuid,uuid,boolean,text) TO service_role;
-- supabase/migrations/20260813001304_player_forecast_season_v3.sql:1446
REVOKE ALL ON FUNCTION public.finish_player_forecast_season_job(uuid,uuid,boolean,text,text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.finish_player_forecast_season_job(uuid,uuid,boolean,text,text) TO service_role;
-- supabase/migrations/20260826133000_inherit_player_forecast_season_assumptions.sql:217
REVOKE ALL ON FUNCTION public.inherit_player_forecast_season_assumptions(uuid,uuid,uuid[],boolean) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.inherit_player_forecast_season_assumptions(uuid,uuid,uuid[],boolean) TO service_role;
-- supabase/migrations/20260909120000_draft_pro_complimentary_access_codes.sql:85
REVOKE ALL ON FUNCTION public.issue_draft_pro_access_code(uuid,uuid,text,text,timestamptz) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.issue_draft_pro_access_code(uuid,uuid,text,text,timestamptz) TO service_role;
-- supabase/migrations/20260818150256_player_forecast_season_v4_integrity.sql:1047
REVOKE ALL ON FUNCTION public.latest_player_forecast_season_roster_observations(bigint) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.latest_player_forecast_season_roster_observations(bigint) TO service_role;
-- supabase/migrations/20260907182507_draft_pro_saved_drafts_transactions.sql:389
REVOKE ALL ON FUNCTION public.list_draft_pro_saved_drafts(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.list_draft_pro_saved_drafts(uuid) TO service_role;
-- supabase/migrations/20260802163747_add_player_forecast_foundation.sql:799
REVOKE ALL ON FUNCTION public.promote_player_forecast_model_atomic(text,uuid,uuid,text,jsonb,timestamptz) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.promote_player_forecast_model_atomic(text,uuid,uuid,text,jsonb,timestamptz) TO service_role;
-- supabase/migrations/20260916012353_starter_board_game_revisions.sql:96-99
REVOKE ALL ON FUNCTION public.publish_forge_game_revisions(uuid,uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.publish_forge_game_revisions(uuid,uuid) TO service_role;
-- supabase/migrations/20260813001304_player_forecast_season_v3.sql:1454
REVOKE ALL ON FUNCTION public.publish_player_forecast_season_release_atomic(uuid,text,text,jsonb,jsonb,jsonb,text,uuid,text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.publish_player_forecast_season_release_atomic(uuid,text,text,jsonb,jsonb,jsonb,text,uuid,text) TO service_role;
-- supabase/migrations/20260907182507_draft_pro_saved_drafts_transactions.sql:389
REVOKE ALL ON FUNCTION public.read_draft_pro_private_import_blob(uuid,uuid,uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.read_draft_pro_private_import_blob(uuid,uuid,uuid) TO service_role;
-- supabase/migrations/20260907182507_draft_pro_saved_drafts_transactions.sql:389
REVOKE ALL ON FUNCTION public.read_draft_pro_private_import_upload(uuid,uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.read_draft_pro_private_import_upload(uuid,uuid) TO service_role;
-- supabase/migrations/20260907182507_draft_pro_saved_drafts_transactions.sql:389
REVOKE ALL ON FUNCTION public.read_draft_pro_snapshot(uuid,uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.read_draft_pro_snapshot(uuid,uuid) TO service_role;
-- supabase/migrations/20260916012353_starter_board_game_revisions.sql:99
REVOKE ALL ON FUNCTION public.read_forge_game_revisions(date) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.read_forge_game_revisions(date) TO service_role;
-- supabase/migrations/20260907145602_draft_pro_stripe_fulfillment.sql:232
REVOKE ALL ON FUNCTION public.record_draft_pro_stripe_event(text,text,timestamptz,text,text,uuid,uuid,text,boolean,text,text,jsonb) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_draft_pro_stripe_event(text,text,timestamptz,text,text,uuid,uuid,text,boolean,text,text,jsonb) TO service_role;
-- supabase/migrations/20260909120000_draft_pro_complimentary_access_codes.sql:85
REVOKE ALL ON FUNCTION public.redeem_draft_pro_access_code(uuid,text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.redeem_draft_pro_access_code(uuid,text) TO service_role;
-- supabase/migrations/20260907182507_draft_pro_saved_drafts_transactions.sql:389
REVOKE ALL ON FUNCTION public.rename_draft_pro_saved_draft(uuid,uuid,integer,text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rename_draft_pro_saved_draft(uuid,uuid,integer,text) TO service_role;
-- supabase/migrations/20260813144701_player_forecast_season_identity_resolution.sql:456
REVOKE ALL ON FUNCTION public.resolve_player_forecast_season_identity(uuid,uuid,text,text,bigint,text,jsonb) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.resolve_player_forecast_season_identity(uuid,uuid,text,text,bigint,text,jsonb) TO service_role;
-- supabase/migrations/20260909120000_draft_pro_complimentary_access_codes.sql:85
REVOKE ALL ON FUNCTION public.revoke_draft_pro_access_code(uuid,uuid,text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.revoke_draft_pro_access_code(uuid,uuid,text) TO service_role;
-- supabase/migrations/20260813001304_player_forecast_season_v3.sql:1458
REVOKE ALL ON FUNCTION public.rollback_player_forecast_season_release_atomic(uuid,uuid,text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rollback_player_forecast_season_release_atomic(uuid,uuid,text) TO service_role;
-- supabase/migrations/20260907182507_draft_pro_saved_drafts_transactions.sql:389
REVOKE ALL ON FUNCTION public.stage_draft_pro_private_import_upload(uuid,uuid,text[],integer,integer,text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.stage_draft_pro_private_import_upload(uuid,uuid,text[],integer,integer,text) TO service_role;

-- supabase/migrations/20260716112908_production_schema_baseline.sql:43418-43419
REVOKE ALL ON FUNCTION public.get_connected_account_tokens_secure(uuid,uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_connected_account_tokens_secure(uuid,uuid) TO service_role;
-- supabase/migrations/20260716112908_production_schema_baseline.sql:43514-43515
REVOKE ALL ON FUNCTION public.upsert_connected_account_tokens_secure(uuid,uuid,text,text,text,text,jsonb,text,timestamptz,timestamptz,timestamptz,jsonb) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.upsert_connected_account_tokens_secure(uuid,uuid,text,text,text,text,jsonb,text,timestamptz,timestamptz,timestamptz,jsonb) TO service_role;

-- No grants for UNREVIEWED objects. No schema exposure, RLS, ownership, or scheduler changes.
COMMIT;
*/
