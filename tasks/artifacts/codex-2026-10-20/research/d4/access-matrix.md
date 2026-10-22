# D4 reviewed candidate object/role/operation matrix

Status: **PROPOSED**, source-bound desired ACL. Not live effective permissions. Each row denies every privilege outside its allow set within the seven Postgres 15 table privileges. Owner grants, memberships, PUBLIC, column grants, RLS and caller identity require runtime checks.

| Table (`public`) | anon allow | authenticated allow | service_role allow | Source / qualification |
| --- | --- | --- | --- | --- |
| `connected_accounts` | none | SELECT (owner RLS) | SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER | `supabase/migrations/20261019052934_restrict_provider_linkage_browser_writes.sql:15-28`; Authenticated owner SELECT; preserve baseline service ALL pending separate operation review |
| `draft_pro_access_code_attempts` | none | none | SELECT, INSERT, UPDATE, DELETE | `supabase/migrations/20260909120000_draft_pro_complimentary_access_codes.sql`; Service API only; revoke PUBLIC too; narrow baseline extras in proposal |
| `draft_pro_access_codes` | none | none | SELECT, INSERT, UPDATE, DELETE | `supabase/migrations/20260909120000_draft_pro_complimentary_access_codes.sql`; Service API only; revoke PUBLIC too; narrow baseline extras in proposal |
| `draft_pro_drafts` | none | none | SELECT, INSERT, UPDATE, DELETE | `supabase/migrations/20260907143356_draft_pro_foundation.sql`; Service API only; revoke PUBLIC too; narrow baseline extras in proposal |
| `draft_pro_private_import_blobs` | none | none | SELECT, INSERT, UPDATE, DELETE | `supabase/migrations/20260907182507_draft_pro_saved_drafts_transactions.sql`; Service API only; revoke PUBLIC too; narrow baseline extras in proposal |
| `draft_pro_private_import_uploads` | none | none | SELECT, INSERT, UPDATE, DELETE | `supabase/migrations/20260907182507_draft_pro_saved_drafts_transactions.sql`; Service API only; revoke PUBLIC too; narrow baseline extras in proposal |
| `draft_pro_private_imports` | none | none | SELECT, INSERT, UPDATE, DELETE | `supabase/migrations/20260907143356_draft_pro_foundation.sql`; Service API only; revoke PUBLIC too; narrow baseline extras in proposal |
| `draft_pro_provider_events` | none | none | SELECT, INSERT, UPDATE, DELETE | `supabase/migrations/20260907143356_draft_pro_foundation.sql`; Service API only; revoke PUBLIC too; narrow baseline extras in proposal |
| `draft_pro_purchases` | none | none | SELECT, INSERT, UPDATE, DELETE | `supabase/migrations/20260907143356_draft_pro_foundation.sql`; Service API only; revoke PUBLIC too; narrow baseline extras in proposal |
| `draft_pro_refund_requests` | none | none | SELECT, INSERT, UPDATE, DELETE | `supabase/migrations/20260907143356_draft_pro_foundation.sql`; Service API only; revoke PUBLIC too; narrow baseline extras in proposal |
| `draft_pro_reports` | none | none | SELECT, INSERT, UPDATE, DELETE | `supabase/migrations/20260907143356_draft_pro_foundation.sql`; Service API only; revoke PUBLIC too; narrow baseline extras in proposal |
| `draft_pro_save_sessions` | none | none | SELECT, INSERT, UPDATE, DELETE | `supabase/migrations/20260907182507_draft_pro_saved_drafts_transactions.sql`; Service API only; revoke PUBLIC too; narrow baseline extras in proposal |
| `draft_pro_scenarios` | none | none | SELECT, INSERT, UPDATE, DELETE | `supabase/migrations/20260907143356_draft_pro_foundation.sql`; Service API only; revoke PUBLIC too; narrow baseline extras in proposal |
| `external_leagues` | none | SELECT (owner RLS) | SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER | `supabase/migrations/20261019052934_restrict_provider_linkage_browser_writes.sql:15-28`; Authenticated owner SELECT; preserve baseline service ALL pending separate operation review |
| `external_teams` | none | SELECT (owner RLS) | SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER | `supabase/migrations/20261019052934_restrict_provider_linkage_browser_writes.sql:15-28`; Authenticated owner SELECT; preserve baseline service ALL pending separate operation review |
| `forge_board_dispatch_observations` | none | none | SELECT, INSERT | `supabase/migrations/20260916023000_starter_board_release_control.sql:48-51`; PROPOSED narrow service ACL: baseline defaults may retain extra service privileges |
| `forge_board_news_events` | none | none | SELECT, INSERT | `supabase/migrations/20260916023000_starter_board_release_control.sql:48-51`; PROPOSED narrow service ACL: baseline defaults may retain extra service privileges |
| `forge_board_visibility_observations` | none | none | SELECT, INSERT | `supabase/migrations/20260916023000_starter_board_release_control.sql:48-51`; PROPOSED narrow service ACL: baseline defaults may retain extra service privileges |
| `forge_final_pregame_revisions` | none | none | SELECT, INSERT | `supabase/migrations/20260916023000_starter_board_release_control.sql:48-51`; PROPOSED narrow service ACL: baseline defaults may retain extra service privileges |
| `forge_game_revisions` | none | none | SELECT, INSERT | `supabase/migrations/20260916012353_starter_board_game_revisions.sql:20-22`; PROPOSED narrow service ACL: baseline defaults may retain extra service privileges |
| `forge_game_selection_events` | none | none | SELECT, INSERT | `supabase/migrations/20260916023000_starter_board_release_control.sql:48-51`; PROPOSED narrow service ACL: baseline defaults may retain extra service privileges |
| `in_season_grants` | none | none | SELECT, INSERT, UPDATE, DELETE | `supabase/migrations/20260927104934_in_season_access_workspace.sql`; Service API only; revoke PUBLIC too; narrow baseline extras in proposal |
| `in_season_workspaces` | none | none | SELECT, INSERT, UPDATE, DELETE | `supabase/migrations/20260927104934_in_season_access_workspace.sql`; Service API only; revoke PUBLIC too; narrow baseline extras in proposal |
| `line_claim_relations` | none | none | SELECT, INSERT | `supabase/migrations/20261002134400_game_line_snapshots.sql:73-80`; Append-only; service UPDATE/DELETE/TRUNCATE denied |
| `line_claim_revisions` | none | none | SELECT, INSERT | `supabase/migrations/20261002134400_game_line_snapshots.sql:73-80`; Append-only; service UPDATE/DELETE/TRUNCATE denied |
| `line_entry_revisions` | none | none | SELECT, INSERT | `supabase/migrations/20261002134400_game_line_snapshots.sql:73-80`; Append-only; service UPDATE/DELETE/TRUNCATE denied |
| `line_game_state_observations` | none | none | SELECT, INSERT | `supabase/migrations/20261002134400_game_line_snapshots.sql:73-80`; Append-only; service UPDATE/DELETE/TRUNCATE denied |
| `line_pp_decisions` | none | none | SELECT, INSERT | `supabase/migrations/20261002134400_game_line_snapshots.sql:73-80`; Append-only; service UPDATE/DELETE/TRUNCATE denied |
| `line_source_captures` | none | none | SELECT, INSERT | `supabase/migrations/20261002134400_game_line_snapshots.sql:73-80`; Append-only; service UPDATE/DELETE/TRUNCATE denied |
| `native_forecast_catalog_heads` | none | none | SELECT | `supabase/migrations/20261017183611_native_forecast_catalog_heads.sql:17-20`; RLS forced; writes only through service-only SECURITY DEFINER CAS |
| `player_forecast_accountability_revisions` | none | none | SELECT, INSERT | `supabase/migrations/20260802163747_add_player_forecast_foundation.sql:762`; Explicit service grant; effective ACL requires replay |
| `player_forecast_champion_history` | none | none | SELECT, INSERT | `supabase/migrations/20260802163747_add_player_forecast_foundation.sql:762`; Explicit service grant; effective ACL requires replay |
| `player_forecast_conflict_members` | none | none | SELECT, INSERT | `supabase/migrations/20260802163747_add_player_forecast_foundation.sql:762`; Explicit service grant; effective ACL requires replay |
| `player_forecast_conflict_resolutions` | none | none | SELECT, INSERT | `supabase/migrations/20260802163747_add_player_forecast_foundation.sql:762`; Explicit service grant; effective ACL requires replay |
| `player_forecast_evaluation_revisions` | none | none | SELECT, INSERT | `supabase/migrations/20260802163747_add_player_forecast_foundation.sql:762`; Explicit service grant; effective ACL requires replay |
| `player_forecast_feature_snapshots` | none | none | SELECT, INSERT | `supabase/migrations/20260802163747_add_player_forecast_foundation.sql:762`; Explicit service grant; effective ACL requires replay |
| `player_forecast_goalie_start_observations` | none | none | SELECT, INSERT | `supabase/migrations/20260802163747_add_player_forecast_foundation.sql:762`; Explicit service grant; effective ACL requires replay |
| `player_forecast_inference_queue` | none | none | SELECT, INSERT, UPDATE | `supabase/migrations/20260802163747_add_player_forecast_foundation.sql:780`; Explicit service grant; effective ACL requires replay |
| `player_forecast_lineup_assignments` | none | none | SELECT, INSERT | `supabase/migrations/20260802163747_add_player_forecast_foundation.sql:762`; Explicit service grant; effective ACL requires replay |
| `player_forecast_lineup_snapshots` | none | none | SELECT, INSERT | `supabase/migrations/20260802163747_add_player_forecast_foundation.sql:762`; Explicit service grant; effective ACL requires replay |
| `player_forecast_model_artifacts` | none | none | SELECT, INSERT | `supabase/migrations/20260802163747_add_player_forecast_foundation.sql:762`; Explicit service grant; effective ACL requires replay |
| `player_forecast_observation_conflicts` | none | none | SELECT, INSERT | `supabase/migrations/20260802163747_add_player_forecast_foundation.sql:762`; Explicit service grant; effective ACL requires replay |
| `player_forecast_outcome_revisions` | none | none | SELECT, INSERT | `supabase/migrations/20260802163747_add_player_forecast_foundation.sql:762`; Explicit service grant; effective ACL requires replay |
| `player_forecast_outputs` | none | none | SELECT, INSERT | `supabase/migrations/20260802163747_add_player_forecast_foundation.sql:762`; Explicit service grant; effective ACL requires replay |
| `player_forecast_rest_of_season_outputs` | none | none | SELECT, INSERT | `supabase/migrations/20260805001038_add_player_forecast_rest_of_season_outputs.sql:51`; Explicit service grant; effective ACL requires replay |
| `player_forecast_runs` | none | none | SELECT, INSERT, UPDATE | `supabase/migrations/20260802163747_add_player_forecast_foundation.sql:780`; Explicit service grant; effective ACL requires replay |
| `player_forecast_schedule_revisions` | none | none | SELECT, INSERT | `supabase/migrations/20260802163747_add_player_forecast_foundation.sql:762`; Explicit service grant; effective ACL requires replay |
| `player_forecast_season_active_releases` | none | none | SELECT, INSERT, UPDATE | `supabase/migrations/20260813001304_player_forecast_season_v3.sql:1430`; Explicit service grant; effective ACL requires replay |
| `player_forecast_season_artifacts` | none | none | SELECT, INSERT | `supabase/migrations/20260813001304_player_forecast_season_v3.sql:1408`; Explicit service grant; effective ACL requires replay |
| `player_forecast_season_completeness_waivers` | none | none | SELECT, INSERT | `supabase/migrations/20260813001304_player_forecast_season_v3.sql:1408`; Explicit service grant; effective ACL requires replay |
| `player_forecast_season_deployment_assignments` | none | none | SELECT, INSERT | `supabase/migrations/20260813001304_player_forecast_season_v3.sql:1408`; Explicit service grant; effective ACL requires replay |
| `player_forecast_season_deployment_snapshots` | none | none | SELECT, INSERT | `supabase/migrations/20260813001304_player_forecast_season_v3.sql:1408`; Explicit service grant; effective ACL requires replay |
| `player_forecast_season_evaluation_revisions` | none | none | SELECT, INSERT | `supabase/migrations/20260813001304_player_forecast_season_v3.sql:1408`; Explicit service grant; effective ACL requires replay |
| `player_forecast_season_game_outputs` | none | none | SELECT, INSERT | `supabase/migrations/20260813001304_player_forecast_season_v3.sql:1408`; Explicit service grant; effective ACL requires replay |
| `player_forecast_season_outcome_revisions` | none | none | SELECT, INSERT | `supabase/migrations/20260813001304_player_forecast_season_v3.sql:1408`; Explicit service grant; effective ACL requires replay |
| `player_forecast_season_overrides` | none | none | SELECT, INSERT | `supabase/migrations/20260813001304_player_forecast_season_v3.sql:1408`; Explicit service grant; effective ACL requires replay |
| `player_forecast_season_player_aggregates` | none | none | SELECT, INSERT | `supabase/migrations/20260813001304_player_forecast_season_v3.sql:1408`; Explicit service grant; effective ACL requires replay |
| `player_forecast_season_player_pool_review` | none | none | SELECT, INSERT | `supabase/migrations/20260813001304_player_forecast_season_v3.sql:1408`; Explicit service grant; effective ACL requires replay |
| `player_forecast_season_queue` | none | none | SELECT, INSERT, UPDATE | `supabase/migrations/20260813001304_player_forecast_season_v3.sql:1430`; Explicit service grant; effective ACL requires replay |
| `player_forecast_season_release_events` | none | none | SELECT, INSERT | `supabase/migrations/20260813001304_player_forecast_season_v3.sql:1408`; Explicit service grant; effective ACL requires replay |
| `player_forecast_season_release_players` | none | none | SELECT, INSERT | `supabase/migrations/20260813001304_player_forecast_season_v3.sql:1408`; Explicit service grant; effective ACL requires replay |
| `player_forecast_season_release_teams` | none | none | SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER | `supabase/migrations/20260820050000_player_forecast_v5_team_metrics.sql:109`; Explicit service grant; effective ACL requires replay |
| `player_forecast_season_releases` | none | none | SELECT, INSERT | `supabase/migrations/20260813001304_player_forecast_season_v3.sql:1408`; Explicit service grant; effective ACL requires replay |
| `player_forecast_season_roster_conflict_members` | none | none | SELECT, INSERT | `supabase/migrations/20260818150256_player_forecast_season_v4_integrity.sql:1032`; Explicit service grant; effective ACL requires replay |
| `player_forecast_season_roster_conflict_resolutions` | none | none | SELECT, INSERT | `supabase/migrations/20260818150256_player_forecast_season_v4_integrity.sql:1032`; Explicit service grant; effective ACL requires replay |
| `player_forecast_season_roster_conflicts` | none | none | SELECT, INSERT | `supabase/migrations/20260818150256_player_forecast_season_v4_integrity.sql:1032`; Explicit service grant; effective ACL requires replay |
| `player_forecast_season_roster_members` | none | none | SELECT, INSERT | `supabase/migrations/20260813001304_player_forecast_season_v3.sql:1408`; Explicit service grant; effective ACL requires replay |
| `player_forecast_season_roster_observations` | none | none | SELECT, INSERT | `supabase/migrations/20260818150256_player_forecast_season_v4_integrity.sql:1032`; Explicit service grant; effective ACL requires replay |
| `player_forecast_season_roster_snapshots` | none | none | SELECT, INSERT | `supabase/migrations/20260813001304_player_forecast_season_v3.sql:1408`; Explicit service grant; effective ACL requires replay |
| `player_forecast_season_runs` | none | none | SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER | `supabase/migrations/20260820052000_player_forecast_copy_on_write_runs.sql:79`; Explicit service grant; effective ACL requires replay |
| `player_forecast_season_schedule_games` | none | none | SELECT, INSERT | `supabase/migrations/20260813001304_player_forecast_season_v3.sql:1408`; Explicit service grant; effective ACL requires replay |
| `player_forecast_season_schedule_snapshots` | none | none | SELECT, INSERT | `supabase/migrations/20260813001304_player_forecast_season_v3.sql:1408`; Explicit service grant; effective ACL requires replay |
| `player_forecast_season_team_aggregates` | none | none | SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER | `supabase/migrations/20260820050000_player_forecast_v5_team_metrics.sql:108`; Explicit service grant; effective ACL requires replay |
| `player_forecast_source_observations` | none | none | SELECT, INSERT | `supabase/migrations/20260802163747_add_player_forecast_foundation.sql:762`; Explicit service grant; effective ACL requires replay |
| `provider_sync_runs` | none | SELECT (owner RLS) | SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER | `supabase/migrations/20261019052934_restrict_provider_linkage_browser_writes.sql:15-28`; Authenticated owner SELECT; preserve baseline service ALL pending separate operation review |
| `roster_optimizer_team_games` | SELECT | SELECT | SELECT, INSERT, UPDATE, DELETE | `supabase/migrations/20260829161013_add_roster_optimizer_team_game_schedule.sql:78-97`; Public SELECT RLS policy; identity sequence service USAGE/SELECT only |

| Sequence | anon | authenticated | service_role |
| --- | --- | --- | --- |
| `public.roster_optimizer_team_games_id_seq` | none | none | USAGE, SELECT; UPDATE denied |

Every function below: anon EXECUTE **deny**; authenticated EXECUTE **deny**; PUBLIC EXECUTE **deny**; service_role EXECUTE **allow**. Exact signatures include both overloaded type identity and array types.

| Exact function signature | Source |
| --- | --- |
| `public.append_line_decisions(bigint,bigint,text,jsonb,jsonb)` | `supabase/migrations/20261002134400_game_line_snapshots.sql:114-115` |
| `public.apply_player_forecast_season_roster_snapshot(bigint,text,timestamptz,timestamptz,numeric,text,jsonb,jsonb,jsonb)` | `supabase/migrations/20260818150256_player_forecast_season_v4_integrity.sql:1042` |
| `public.attach_draft_pro_stripe_checkout_session(uuid,text,timestamptz)` | `supabase/migrations/20260907145602_draft_pro_stripe_fulfillment.sql:231` |
| `public.begin_draft_pro_private_import_upload(uuid,uuid,uuid,integer,text,text,jsonb)` | `supabase/migrations/20260907182507_draft_pro_saved_drafts_transactions.sql:389` |
| `public.begin_draft_pro_save_session(uuid,uuid,integer,text)` | `supabase/migrations/20260907182507_draft_pro_saved_drafts_transactions.sql:389` |
| `public.begin_draft_pro_stripe_checkout_attempt(uuid)` | `supabase/migrations/20260907145602_draft_pro_stripe_fulfillment.sql:230` |
| `public.build_player_forecast_runtime_features(bigint,bigint,bigint,timestamptz)` | `supabase/migrations/20260805003121_add_player_forecast_runtime_context_rates.sql:183` |
| `public.cas_native_forecast_catalog_head(uuid,integer,bigint,text,uuid,text)` | `supabase/migrations/20261017183611_native_forecast_catalog_heads.sql:62-63` |
| `public.claim_draft_pro_private_import_cleanup(uuid,integer)` | `supabase/migrations/20260907182507_draft_pro_saved_drafts_transactions.sql:389` |
| `public.claim_draft_pro_private_import_upload_cleanup(uuid,integer)` | `supabase/migrations/20260907182507_draft_pro_saved_drafts_transactions.sql:389` |
| `public.claim_player_forecast_jobs(uuid,integer,integer)` | `supabase/migrations/20260802163747_add_player_forecast_foundation.sql:791` |
| `public.claim_player_forecast_season_jobs(uuid,integer,integer)` | `supabase/migrations/20260813001304_player_forecast_season_v3.sql:1442` |
| `public.clone_player_forecast_season_run(uuid,text)` | `supabase/migrations/20260813001304_player_forecast_season_v3.sql:1450` |
| `public.clone_player_forecast_season_run_with_assumptions(uuid,text,boolean)` | `supabase/migrations/20260826133000_inherit_player_forecast_season_assumptions.sql:222` |
| `public.commit_draft_pro_save_session(uuid,uuid,text,jsonb,integer,uuid[])` | `supabase/migrations/20260907182507_draft_pro_saved_drafts_transactions.sql:389` |
| `public.compact_player_forecast_season_queue(bigint,text,integer)` | `supabase/migrations/20260820014700_player_forecast_season_queue_compaction.sql:100` |
| `public.confirm_draft_pro_private_import_cleanup(uuid,uuid[],uuid)` | `supabase/migrations/20260907182507_draft_pro_saved_drafts_transactions.sql:389` |
| `public.confirm_draft_pro_private_import_upload_cleanup(uuid,uuid[])` | `supabase/migrations/20260907182507_draft_pro_saved_drafts_transactions.sql:389` |
| `public.create_player_forecast_season_event_run(uuid,uuid,uuid,timestamptz,timestamptz,text,bigint[],smallint[])` | `supabase/migrations/20260818150256_player_forecast_season_v4_integrity.sql:1052` |
| `public.create_player_forecast_season_event_run_with_assumptions(uuid,uuid,uuid,timestamptz,timestamptz,text,bigint[],smallint[],uuid[])` | `supabase/migrations/20260826133000_inherit_player_forecast_season_assumptions.sql:228` |
| `public.delete_draft_pro_saved_draft(uuid,uuid,integer)` | `supabase/migrations/20260907182507_draft_pro_saved_drafts_transactions.sql:389` |
| `public.duplicate_draft_pro_saved_draft(uuid,uuid,integer,text)` | `supabase/migrations/20260907182507_draft_pro_saved_drafts_transactions.sql:389` |
| `public.enqueue_player_forecast_job(text,bigint,bigint,smallint,text,timestamptz,timestamptz,jsonb)` | `supabase/migrations/20260802163747_add_player_forecast_foundation.sql:787` |
| `public.enqueue_player_forecast_season_job(text,bigint,text,smallint,smallint,bigint,text,timestamptz,timestamptz,jsonb)` | `supabase/migrations/20260813001304_player_forecast_season_v3.sql:1438` |
| `public.finish_player_forecast_job(uuid,uuid,boolean,text)` | `supabase/migrations/20260802163747_add_player_forecast_foundation.sql:795` |
| `public.finish_player_forecast_season_job(uuid,uuid,boolean,text,text)` | `supabase/migrations/20260813001304_player_forecast_season_v3.sql:1446` |
| `public.get_connected_account_tokens_secure(uuid,uuid)` | `supabase/migrations/20260716112908_production_schema_baseline.sql:43418-43419` |
| `public.inherit_player_forecast_season_assumptions(uuid,uuid,uuid[],boolean)` | `supabase/migrations/20260826133000_inherit_player_forecast_season_assumptions.sql:217` |
| `public.issue_draft_pro_access_code(uuid,uuid,text,text,timestamptz)` | `supabase/migrations/20260909120000_draft_pro_complimentary_access_codes.sql:85` |
| `public.latest_player_forecast_season_roster_observations(bigint)` | `supabase/migrations/20260818150256_player_forecast_season_v4_integrity.sql:1047` |
| `public.list_draft_pro_saved_drafts(uuid)` | `supabase/migrations/20260907182507_draft_pro_saved_drafts_transactions.sql:389` |
| `public.promote_player_forecast_model_atomic(text,uuid,uuid,text,jsonb,timestamptz)` | `supabase/migrations/20260802163747_add_player_forecast_foundation.sql:799` |
| `public.publish_forge_game_revisions(uuid,uuid)` | `supabase/migrations/20260916012353_starter_board_game_revisions.sql:96-99` |
| `public.publish_player_forecast_season_release_atomic(uuid,text,text,jsonb,jsonb,jsonb,text,uuid,text)` | `supabase/migrations/20260813001304_player_forecast_season_v3.sql:1454` |
| `public.read_draft_pro_private_import_blob(uuid,uuid,uuid)` | `supabase/migrations/20260907182507_draft_pro_saved_drafts_transactions.sql:389` |
| `public.read_draft_pro_private_import_upload(uuid,uuid)` | `supabase/migrations/20260907182507_draft_pro_saved_drafts_transactions.sql:389` |
| `public.read_draft_pro_snapshot(uuid,uuid)` | `supabase/migrations/20260907182507_draft_pro_saved_drafts_transactions.sql:389` |
| `public.read_forge_game_revisions(date)` | `supabase/migrations/20260916012353_starter_board_game_revisions.sql:99` |
| `public.record_draft_pro_stripe_event(text,text,timestamptz,text,text,uuid,uuid,text,boolean,text,text,jsonb)` | `supabase/migrations/20260907145602_draft_pro_stripe_fulfillment.sql:232` |
| `public.redeem_draft_pro_access_code(uuid,text)` | `supabase/migrations/20260909120000_draft_pro_complimentary_access_codes.sql:85` |
| `public.rename_draft_pro_saved_draft(uuid,uuid,integer,text)` | `supabase/migrations/20260907182507_draft_pro_saved_drafts_transactions.sql:389` |
| `public.resolve_player_forecast_season_identity(uuid,uuid,text,text,bigint,text,jsonb)` | `supabase/migrations/20260813144701_player_forecast_season_identity_resolution.sql:456` |
| `public.revoke_draft_pro_access_code(uuid,uuid,text)` | `supabase/migrations/20260909120000_draft_pro_complimentary_access_codes.sql:85` |
| `public.rollback_player_forecast_season_release_atomic(uuid,uuid,text)` | `supabase/migrations/20260813001304_player_forecast_season_v3.sql:1458` |
| `public.stage_draft_pro_private_import_upload(uuid,uuid,text[],integer,integer,text)` | `supabase/migrations/20260907182507_draft_pro_saved_drafts_transactions.sql:389` |
| `public.upsert_connected_account_tokens_secure(uuid,uuid,text,text,text,text,jsonb,text,timestamptz,timestamptz,timestamptz,jsonb)` | `supabase/migrations/20260716112908_production_schema_baseline.sql:43514-43515` |

Schema `public` USAGE is already source-granted to all three roles (`baseline:43378-43381`); proposal adds no schema grant. `fhfh_internal` USAGE remains denied to these roles. Internal trigger functions are not public RPC grants. Unlisted objects are UNREVIEWED, never implicitly approved.
