# Other Tables And Views

Generated from live Supabase `information_schema` on 2026-05-22.

Tables/views documented: 207.

## Index

- `analytics.sko_model_v1` (table)
- `analytics.vw_entity_ratings_daily` (view)
- `analytics.vw_entity_sustainability_scores` (view)
- `auth.audit_log_entries` (table)
- `auth.custom_oauth_providers` (table)
- `auth.flow_state` (table)
- `auth.identities` (table)
- `auth.instances` (table)
- `auth.mfa_amr_claims` (table)
- `auth.mfa_challenges` (table)
- `auth.mfa_factors` (table)
- `auth.oauth_authorizations` (table)
- `auth.oauth_client_states` (table)
- `auth.oauth_clients` (table)
- `auth.oauth_consents` (table)
- `auth.one_time_tokens` (table)
- `auth.refresh_tokens` (table)
- `auth.saml_providers` (table)
- `auth.saml_relay_states` (table)
- `auth.schema_migrations` (table)
- `auth.sessions` (table)
- `auth.sso_domains` (table)
- `auth.sso_providers` (table)
- `auth.users` (table)
- `auth.webauthn_challenges` (table)
- `auth.webauthn_credentials` (table)
- `cron.job` (table)
- `cron.job_run_details` (table)
- `extensions.pg_stat_statements` (view)
- `extensions.pg_stat_statements_info` (view)
- `net._http_response` (table)
- `net.http_request_queue` (table)
- `pgsodium.decrypted_key` (view)
- `pgsodium.key` (table)
- `pgsodium.mask_columns` (view)
- `pgsodium.masking_rule` (view)
- `pgsodium.valid_key` (view)
- `private.connected_account_tokens` (table)
- `public._nhl_totals_current` (table)
- `public._yahoo_players_465_norm` (table)
- `public._yahoo_players_latest_norm` (table)
- `public.admin__column_catalog` (view)
- `public.admin__prd_requirements` (table)
- `public.admin__table_profile` (view)
- `public.admin__table_summary` (view)
- `public.connected_accounts` (table)
- `public.cron_job_audit` (table)
- `public.cron_job_report` (view)
- `public.entity_sustainability_bands_daily` (table)
- `public.entity_sustainability_scores_daily` (table)
- `public.entity_trend_snapshots_daily` (table)
- `public.expected_goals` (table)
- `public.external_leagues` (table)
- `public.forge_projection_accuracy_daily` (table)
- `public.forge_projection_accuracy_stat_daily` (table)
- `public.forge_projection_calibration_daily` (table)
- `public.forge_projection_results` (table)
- `public.forge_runs` (table)
- `public.gameOutcomes` (view)
- `public.game_prediction_accountability_daily` (table)
- `public.game_prediction_accountability_games` (table)
- `public.game_prediction_backtest_runs` (table)
- `public.game_prediction_feature_snapshots` (table)
- `public.game_prediction_history` (table)
- `public.game_prediction_model_metrics` (table)
- `public.game_prediction_model_versions` (table)
- `public.game_prediction_outputs` (table)
- `public.gamelog_game_map` (table)
- `public.games` (table)
- `public.job_locks` (table)
- `public.job_run_details` (view)
- `public.line_source_ifttt_events` (table)
- `public.line_source_snapshots` (table)
- `public.market_prices_daily` (table)
- `public.model_market_flags_daily` (table)
- `public.model_sustainability_config` (table)
- `public.news_feed_items` (table)
- `public.news_feed_keyword_phrases` (table)
- `public.nhl_api_game_payloads_raw` (table)
- `public.nhl_api_pbp_events` (table)
- `public.nhl_api_pbp_shot_events_v1` (view)
- `public.nhl_api_shift_rows` (table)
- `public.nhl_edge_stats_daily` (table)
- `public.nhl_names` (table)
- `public.nst_att_def_scores` (view)
- `public.nst_avg_5v5` (view)
- `public.nst_avg_all` (view)
- `public.nst_avg_pk` (view)
- `public.nst_avg_pp` (view)
- `public.nst_gamelog_as_counts` (table)
- `public.nst_gamelog_as_counts_oi` (table)
- `public.nst_gamelog_as_rates` (table)
- `public.nst_gamelog_as_rates_oi` (table)
- `public.nst_gamelog_es_counts` (table)
- `public.nst_gamelog_es_counts_oi` (table)
- `public.nst_gamelog_es_rates` (table)
- `public.nst_gamelog_es_rates_oi` (table)
- `public.nst_gamelog_pk_counts` (table)
- `public.nst_gamelog_pk_counts_oi` (table)
- `public.nst_gamelog_pk_rates` (table)
- `public.nst_gamelog_pk_rates_oi` (table)
- `public.nst_gamelog_pp_counts` (table)
- `public.nst_gamelog_pp_counts_oi` (table)
- `public.nst_gamelog_pp_rates` (table)
- `public.nst_gamelog_pp_rates_oi` (table)
- `public.nst_league_averages` (view)
- `public.nst_percentile_as_defense` (table)
- `public.nst_percentile_as_defense_filtered` (table)
- `public.nst_percentile_as_offense` (table)
- `public.nst_percentile_es_defense` (view)
- `public.nst_percentile_es_defense_filtered` (view)
- `public.nst_percentile_es_offense` (view)
- `public.nst_percentile_es_offense_filtered` (view)
- `public.nst_percentile_pk_defense` (view)
- `public.nst_percentile_pk_defense_filtered` (view)
- `public.nst_percentile_pk_offense` (view)
- `public.nst_percentile_pk_offense_filtered` (view)
- `public.nst_percentile_pp_defense` (view)
- `public.nst_percentile_pp_defense_filtered` (view)
- `public.nst_percentile_pp_offense` (view)
- `public.nst_percentile_pp_offense_filtered` (view)
- `public.nst_seasonal_individual_counts` (table)
- `public.nst_seasonal_individual_rates` (table)
- `public.nst_seasonal_on_ice_counts` (table)
- `public.nst_seasonal_on_ice_rates` (table)
- `public.nst_seasonlong_as_counts` (view)
- `public.nst_seasonlong_as_counts_oi` (view)
- `public.nst_seasonlong_as_rates` (view)
- `public.nst_seasonlong_as_rates_oi` (view)
- `public.nst_seasonlong_combined_es` (view)
- `public.nst_seasonlong_combined_pk` (view)
- `public.nst_seasonlong_combined_pp` (view)
- `public.nst_seasonlong_es_counts` (view)
- `public.nst_seasonlong_es_counts_oi` (view)
- `public.nst_seasonlong_es_rates` (view)
- `public.nst_seasonlong_es_rates_oi` (view)
- `public.nst_seasonlong_pk_counts` (view)
- `public.nst_seasonlong_pk_counts_oi` (view)
- `public.nst_seasonlong_pk_rates` (view)
- `public.nst_seasonlong_pk_rates_oi` (view)
- `public.nst_seasonlong_pp_counts` (view)
- `public.nst_seasonlong_pp_counts_oi` (view)
- `public.nst_seasonlong_pp_rates` (view)
- `public.nst_seasonlong_pp_rates_oi` (view)
- `public.pbp_games` (table)
- `public.pbp_plays` (table)
- `public.power_rankings` (view)
- `public.power_rankings_store` (table)
- `public.pp_timeframes` (table)
- `public.predictions_sko` (table)
- `public.prop_market_prices_daily` (table)
- `public.provider_sync_runs` (table)
- `public.rolling_games` (table)
- `public.seasons` (table)
- `public.shift_charts` (table)
- `public.shots_goals_by_coord` (table)
- `public.sko_pp_stats` (table)
- `public.sko_trends` (table)
- `public.source_provenance_snapshots` (table)
- `public.statsUpdateStatus` (table)
- `public.sustainability_priors` (table)
- `public.sustainability_projections` (table)
- `public.sustainability_scores` (table)
- `public.sustainability_trend_bands` (table)
- `public.sustainability_trends_v` (view)
- `public.sustainability_window_z` (table)
- `public.tweet_pattern_review_items` (table)
- `public.user_entitlements` (table)
- `public.user_profiles` (table)
- `public.user_provider_preferences` (table)
- `public.user_settings` (table)
- `public.users` (table)
- `public.vw_current_season` (view)
- `public.vw_season_game_dates` (view)
- `public.vw_slate_day` (view)
- `public.wgo_avg_career` (table)
- `public.wgo_avg_three_year` (table)
- `public.wgo_career_averages` (table)
- `public.wgo_three_year_averages` (table)
- `public.xfs_audit_log` (table)
- `public.yahoo_api_credentials` (table)
- `public.yahoo_game_keys` (table)
- `public.yahoo_matchup_weeks` (table)
- `public.yahoo_names` (table)
- `public.yahoo_nhl_player_map` (table)
- `public.yahoo_nhl_player_map_unmatched` (table)
- `public.yahoo_player_draft_analysis_history` (table)
- `public.yahoo_player_keys` (table)
- `public.yahoo_player_ownership_daily` (table)
- `public.yahoo_player_ownership_history` (table)
- `public.yahoo_players` (table)
- `public.yahoo_positions` (table)
- `realtime.messages` (table)
- `realtime.schema_migrations` (table)
- `realtime.subscription` (table)
- `storage.buckets` (table)
- `storage.buckets_analytics` (table)
- `storage.buckets_vectors` (table)
- `storage.migrations` (table)
- `storage.objects` (table)
- `storage.s3_multipart_uploads` (table)
- `storage.s3_multipart_uploads_parts` (table)
- `storage.vector_indexes` (table)
- `supabase_migrations.schema_migrations` (table)
- `vault.cron_secrets` (table)
- `vault.decrypted_secrets` (view)
- `vault.secrets` (table)

## `analytics.sko_model_v1`

Type: table

Primary key: `id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `id` | bigint | no | nextval('analytics.sko_model_v1_id_seq'::regclass) |
| `created_at` | timestamp with time zone | yes | now() |
| `description` | text | yes |  |
| `mu` | jsonb | no |  |
| `sigma` | jsonb | no |  |
| `weights` | jsonb | no |  |
| `intercept` | double precision | no |  |
| `sigma_residual` | double precision | no |  |
| `target` | text | no | 'p60'::text |

## `analytics.vw_entity_ratings_daily`

Type: view

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `entity_type` | text | yes |  |
| `entity_id` | bigint | yes |  |
| `team_id` | smallint | yes |  |
| `player_id` | bigint | yes |  |
| `snapshot_date` | date | yes |  |
| `season_id` | integer | yes |  |
| `team_abbrev` | text | yes |  |
| `offense_rating_0_to_100` | double precision | yes |  |
| `defense_rating_0_to_100` | double precision | yes |  |
| `goalie_rating_0_to_100` | double precision | yes |  |
| `overall_rating_0_to_100` | double precision | yes |  |
| `league_rank` | integer | yes |  |
| `percentile` | double precision | yes |  |
| `source_table` | text | yes |  |
| `components` | jsonb | yes |  |
| `provenance` | jsonb | yes |  |
| `computed_at` | timestamp with time zone | yes |  |

## `analytics.vw_entity_sustainability_scores`

Type: view

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `entity_type` | text | yes |  |
| `entity_id` | bigint | yes |  |
| `team_id` | smallint | yes |  |
| `player_id` | bigint | yes |  |
| `snapshot_date` | date | yes |  |
| `season_id` | integer | yes |  |
| `metric_scope` | text | yes |  |
| `window_code` | text | yes |  |
| `baseline_value` | double precision | yes |  |
| `recent_value` | double precision | yes |  |
| `expected_value` | double precision | yes |  |
| `z_score` | double precision | yes |  |
| `s_raw` | double precision | yes |  |
| `s_100` | double precision | yes |  |
| `expectation_state` | text | yes |  |
| `components` | jsonb | yes |  |
| `provenance` | jsonb | yes |  |
| `computed_at` | timestamp with time zone | yes |  |

## `auth.audit_log_entries`

Type: table

Managed Supabase schema. Documented for catalog completeness; application code should usually avoid direct writes here.

Primary key: `id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `instance_id` | uuid | yes |  |
| `id` | uuid | no |  |
| `payload` | json | yes |  |
| `created_at` | timestamp with time zone | yes |  |
| `ip_address` | character varying | no | ''::character varying |

## `auth.custom_oauth_providers`

Type: table

Managed Supabase schema. Documented for catalog completeness; application code should usually avoid direct writes here.

Primary key: `id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `id` | uuid | no | gen_random_uuid() |
| `provider_type` | text | no |  |
| `identifier` | text | no |  |
| `name` | text | no |  |
| `client_id` | text | no |  |
| `client_secret` | text | no |  |
| `acceptable_client_ids` | _text[] | no | '{}'::text[] |
| `scopes` | _text[] | no | '{}'::text[] |
| `pkce_enabled` | boolean | no | true |
| `attribute_mapping` | jsonb | no | '{}'::jsonb |
| `authorization_params` | jsonb | no | '{}'::jsonb |
| `enabled` | boolean | no | true |
| `email_optional` | boolean | no | false |
| `issuer` | text | yes |  |
| `discovery_url` | text | yes |  |
| `skip_nonce_check` | boolean | no | false |
| `cached_discovery` | jsonb | yes |  |
| `discovery_cached_at` | timestamp with time zone | yes |  |
| `authorization_url` | text | yes |  |
| `token_url` | text | yes |  |
| `userinfo_url` | text | yes |  |
| `jwks_uri` | text | yes |  |
| `created_at` | timestamp with time zone | no | now() |
| `updated_at` | timestamp with time zone | no | now() |

## `auth.flow_state`

Type: table

Managed Supabase schema. Documented for catalog completeness; application code should usually avoid direct writes here.

Primary key: `id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `id` | uuid | no |  |
| `user_id` | uuid | yes |  |
| `auth_code` | text | yes |  |
| `code_challenge_method` | code_challenge_method | yes |  |
| `code_challenge` | text | yes |  |
| `provider_type` | text | no |  |
| `provider_access_token` | text | yes |  |
| `provider_refresh_token` | text | yes |  |
| `created_at` | timestamp with time zone | yes |  |
| `updated_at` | timestamp with time zone | yes |  |
| `authentication_method` | text | no |  |
| `auth_code_issued_at` | timestamp with time zone | yes |  |
| `invite_token` | text | yes |  |
| `referrer` | text | yes |  |
| `oauth_client_state_id` | uuid | yes |  |
| `linking_target_id` | uuid | yes |  |
| `email_optional` | boolean | no | false |

## `auth.identities`

Type: table

Managed Supabase schema. Documented for catalog completeness; application code should usually avoid direct writes here.

Primary key: `id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `provider_id` | text | no |  |
| `user_id` | uuid | no |  |
| `identity_data` | jsonb | no |  |
| `provider` | text | no |  |
| `last_sign_in_at` | timestamp with time zone | yes |  |
| `created_at` | timestamp with time zone | yes |  |
| `updated_at` | timestamp with time zone | yes |  |
| `email` | text | yes |  |
| `id` | uuid | no | gen_random_uuid() |

## `auth.instances`

Type: table

Managed Supabase schema. Documented for catalog completeness; application code should usually avoid direct writes here.

Primary key: `id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `id` | uuid | no |  |
| `uuid` | uuid | yes |  |
| `raw_base_config` | text | yes |  |
| `created_at` | timestamp with time zone | yes |  |
| `updated_at` | timestamp with time zone | yes |  |

## `auth.mfa_amr_claims`

Type: table

Managed Supabase schema. Documented for catalog completeness; application code should usually avoid direct writes here.

Primary key: `id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `session_id` | uuid | no |  |
| `created_at` | timestamp with time zone | no |  |
| `updated_at` | timestamp with time zone | no |  |
| `authentication_method` | text | no |  |
| `id` | uuid | no |  |

## `auth.mfa_challenges`

Type: table

Managed Supabase schema. Documented for catalog completeness; application code should usually avoid direct writes here.

Primary key: `id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `id` | uuid | no |  |
| `factor_id` | uuid | no |  |
| `created_at` | timestamp with time zone | no |  |
| `verified_at` | timestamp with time zone | yes |  |
| `ip_address` | inet | no |  |
| `otp_code` | text | yes |  |
| `web_authn_session_data` | jsonb | yes |  |

## `auth.mfa_factors`

Type: table

Managed Supabase schema. Documented for catalog completeness; application code should usually avoid direct writes here.

Primary key: `id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `id` | uuid | no |  |
| `user_id` | uuid | no |  |
| `friendly_name` | text | yes |  |
| `factor_type` | factor_type | no |  |
| `status` | factor_status | no |  |
| `created_at` | timestamp with time zone | no |  |
| `updated_at` | timestamp with time zone | no |  |
| `secret` | text | yes |  |
| `phone` | text | yes |  |
| `last_challenged_at` | timestamp with time zone | yes |  |
| `web_authn_credential` | jsonb | yes |  |
| `web_authn_aaguid` | uuid | yes |  |
| `last_webauthn_challenge_data` | jsonb | yes |  |

## `auth.oauth_authorizations`

Type: table

Managed Supabase schema. Documented for catalog completeness; application code should usually avoid direct writes here.

Primary key: `id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `id` | uuid | no |  |
| `authorization_id` | text | no |  |
| `client_id` | uuid | no |  |
| `user_id` | uuid | yes |  |
| `redirect_uri` | text | no |  |
| `scope` | text | no |  |
| `state` | text | yes |  |
| `resource` | text | yes |  |
| `code_challenge` | text | yes |  |
| `code_challenge_method` | code_challenge_method | yes |  |
| `response_type` | oauth_response_type | no | 'code'::auth.oauth_response_type |
| `status` | oauth_authorization_status | no | 'pending'::auth.oauth_authorization_status |
| `authorization_code` | text | yes |  |
| `created_at` | timestamp with time zone | no | now() |
| `expires_at` | timestamp with time zone | no | (now() + '00:03:00'::interval) |
| `approved_at` | timestamp with time zone | yes |  |
| `nonce` | text | yes |  |

## `auth.oauth_client_states`

Type: table

Managed Supabase schema. Documented for catalog completeness; application code should usually avoid direct writes here.

Primary key: `id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `id` | uuid | no |  |
| `provider_type` | text | no |  |
| `code_verifier` | text | yes |  |
| `created_at` | timestamp with time zone | no |  |

## `auth.oauth_clients`

Type: table

Managed Supabase schema. Documented for catalog completeness; application code should usually avoid direct writes here.

Primary key: `id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `id` | uuid | no |  |
| `client_secret_hash` | text | yes |  |
| `registration_type` | oauth_registration_type | no |  |
| `redirect_uris` | text | no |  |
| `grant_types` | text | no |  |
| `client_name` | text | yes |  |
| `client_uri` | text | yes |  |
| `logo_uri` | text | yes |  |
| `created_at` | timestamp with time zone | no | now() |
| `updated_at` | timestamp with time zone | no | now() |
| `deleted_at` | timestamp with time zone | yes |  |
| `client_type` | oauth_client_type | no | 'confidential'::auth.oauth_client_type |
| `token_endpoint_auth_method` | text | no |  |

## `auth.oauth_consents`

Type: table

Managed Supabase schema. Documented for catalog completeness; application code should usually avoid direct writes here.

Primary key: `id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `id` | uuid | no |  |
| `user_id` | uuid | no |  |
| `client_id` | uuid | no |  |
| `scopes` | text | no |  |
| `granted_at` | timestamp with time zone | no | now() |
| `revoked_at` | timestamp with time zone | yes |  |

## `auth.one_time_tokens`

Type: table

Managed Supabase schema. Documented for catalog completeness; application code should usually avoid direct writes here.

Primary key: `id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `id` | uuid | no |  |
| `user_id` | uuid | no |  |
| `token_type` | one_time_token_type | no |  |
| `token_hash` | text | no |  |
| `relates_to` | text | no |  |
| `created_at` | timestamp without time zone | no | now() |
| `updated_at` | timestamp without time zone | no | now() |

## `auth.refresh_tokens`

Type: table

Managed Supabase schema. Documented for catalog completeness; application code should usually avoid direct writes here.

Primary key: `id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `instance_id` | uuid | yes |  |
| `id` | bigint | no | nextval('auth.refresh_tokens_id_seq'::regclass) |
| `token` | character varying | yes |  |
| `user_id` | character varying | yes |  |
| `revoked` | boolean | yes |  |
| `created_at` | timestamp with time zone | yes |  |
| `updated_at` | timestamp with time zone | yes |  |
| `parent` | character varying | yes |  |
| `session_id` | uuid | yes |  |

## `auth.saml_providers`

Type: table

Managed Supabase schema. Documented for catalog completeness; application code should usually avoid direct writes here.

Primary key: `id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `id` | uuid | no |  |
| `sso_provider_id` | uuid | no |  |
| `entity_id` | text | no |  |
| `metadata_xml` | text | no |  |
| `metadata_url` | text | yes |  |
| `attribute_mapping` | jsonb | yes |  |
| `created_at` | timestamp with time zone | yes |  |
| `updated_at` | timestamp with time zone | yes |  |
| `name_id_format` | text | yes |  |

## `auth.saml_relay_states`

Type: table

Managed Supabase schema. Documented for catalog completeness; application code should usually avoid direct writes here.

Primary key: `id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `id` | uuid | no |  |
| `sso_provider_id` | uuid | no |  |
| `request_id` | text | no |  |
| `for_email` | text | yes |  |
| `redirect_to` | text | yes |  |
| `created_at` | timestamp with time zone | yes |  |
| `updated_at` | timestamp with time zone | yes |  |
| `flow_state_id` | uuid | yes |  |

## `auth.schema_migrations`

Type: table

Managed Supabase schema. Documented for catalog completeness; application code should usually avoid direct writes here.

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `version` | character varying | no |  |

## `auth.sessions`

Type: table

Managed Supabase schema. Documented for catalog completeness; application code should usually avoid direct writes here.

Primary key: `id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `id` | uuid | no |  |
| `user_id` | uuid | no |  |
| `created_at` | timestamp with time zone | yes |  |
| `updated_at` | timestamp with time zone | yes |  |
| `factor_id` | uuid | yes |  |
| `aal` | aal_level | yes |  |
| `not_after` | timestamp with time zone | yes |  |
| `refreshed_at` | timestamp without time zone | yes |  |
| `user_agent` | text | yes |  |
| `ip` | inet | yes |  |
| `tag` | text | yes |  |
| `oauth_client_id` | uuid | yes |  |
| `refresh_token_hmac_key` | text | yes |  |
| `refresh_token_counter` | bigint | yes |  |
| `scopes` | text | yes |  |

## `auth.sso_domains`

Type: table

Managed Supabase schema. Documented for catalog completeness; application code should usually avoid direct writes here.

Primary key: `id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `id` | uuid | no |  |
| `sso_provider_id` | uuid | no |  |
| `domain` | text | no |  |
| `created_at` | timestamp with time zone | yes |  |
| `updated_at` | timestamp with time zone | yes |  |

## `auth.sso_providers`

Type: table

Managed Supabase schema. Documented for catalog completeness; application code should usually avoid direct writes here.

Primary key: `id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `id` | uuid | no |  |
| `resource_id` | text | yes |  |
| `created_at` | timestamp with time zone | yes |  |
| `updated_at` | timestamp with time zone | yes |  |
| `disabled` | boolean | yes |  |

## `auth.users`

Type: table

Managed Supabase schema. Documented for catalog completeness; application code should usually avoid direct writes here.

Primary key: `id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `instance_id` | uuid | yes |  |
| `id` | uuid | no |  |
| `aud` | character varying | yes |  |
| `role` | character varying | yes |  |
| `email` | character varying | yes |  |
| `encrypted_password` | character varying | yes |  |
| `email_confirmed_at` | timestamp with time zone | yes |  |
| `invited_at` | timestamp with time zone | yes |  |
| `confirmation_token` | character varying | yes |  |
| `confirmation_sent_at` | timestamp with time zone | yes |  |
| `recovery_token` | character varying | yes |  |
| `recovery_sent_at` | timestamp with time zone | yes |  |
| `email_change_token_new` | character varying | yes |  |
| `email_change` | character varying | yes |  |
| `email_change_sent_at` | timestamp with time zone | yes |  |
| `last_sign_in_at` | timestamp with time zone | yes |  |
| `raw_app_meta_data` | jsonb | yes |  |
| `raw_user_meta_data` | jsonb | yes |  |
| `is_super_admin` | boolean | yes |  |
| `created_at` | timestamp with time zone | yes |  |
| `updated_at` | timestamp with time zone | yes |  |
| `phone` | text | yes | NULL::character varying |
| `phone_confirmed_at` | timestamp with time zone | yes |  |
| `phone_change` | text | yes | ''::character varying |
| `phone_change_token` | character varying | yes | ''::character varying |
| `phone_change_sent_at` | timestamp with time zone | yes |  |
| `confirmed_at` | timestamp with time zone | yes |  |
| `email_change_token_current` | character varying | yes | ''::character varying |
| `email_change_confirm_status` | smallint | yes | 0 |
| `banned_until` | timestamp with time zone | yes |  |
| `reauthentication_token` | character varying | yes | ''::character varying |
| `reauthentication_sent_at` | timestamp with time zone | yes |  |
| `is_sso_user` | boolean | no | false |
| `deleted_at` | timestamp with time zone | yes |  |
| `is_anonymous` | boolean | no | false |

## `auth.webauthn_challenges`

Type: table

Managed Supabase schema. Documented for catalog completeness; application code should usually avoid direct writes here.

Primary key: `id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `id` | uuid | no | gen_random_uuid() |
| `user_id` | uuid | yes |  |
| `challenge_type` | text | no |  |
| `session_data` | jsonb | no |  |
| `created_at` | timestamp with time zone | no | now() |
| `expires_at` | timestamp with time zone | no |  |

## `auth.webauthn_credentials`

Type: table

Managed Supabase schema. Documented for catalog completeness; application code should usually avoid direct writes here.

Primary key: `id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `id` | uuid | no | gen_random_uuid() |
| `user_id` | uuid | no |  |
| `credential_id` | bytea | no |  |
| `public_key` | bytea | no |  |
| `attestation_type` | text | no | ''::text |
| `aaguid` | uuid | yes |  |
| `sign_count` | bigint | no | 0 |
| `transports` | jsonb | no | '[]'::jsonb |
| `backup_eligible` | boolean | no | false |
| `backed_up` | boolean | no | false |
| `friendly_name` | text | no | ''::text |
| `created_at` | timestamp with time zone | no | now() |
| `updated_at` | timestamp with time zone | no | now() |
| `last_used_at` | timestamp with time zone | yes |  |

## `cron.job`

Type: table

Managed Supabase schema. Documented for catalog completeness; application code should usually avoid direct writes here.

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `jobid` | bigint | no | nextval('cron.jobid_seq'::regclass) |
| `schedule` | text | no |  |
| `command` | text | no |  |
| `nodename` | text | no | 'localhost'::text |
| `nodeport` | integer | no | inet_server_port() |
| `database` | text | no | current_database() |
| `username` | text | no | CURRENT_USER |
| `active` | boolean | no | true |
| `jobname` | name | yes |  |

## `cron.job_run_details`

Type: table

Managed Supabase schema. Documented for catalog completeness; application code should usually avoid direct writes here.

Primary key: `runid`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `jobid` | bigint | yes |  |
| `runid` | bigint | no | nextval('cron.runid_seq'::regclass) |
| `job_pid` | integer | yes |  |
| `database` | text | yes |  |
| `username` | text | yes |  |
| `command` | text | yes |  |
| `status` | text | yes |  |
| `return_message` | text | yes |  |
| `start_time` | timestamp with time zone | yes |  |
| `end_time` | timestamp with time zone | yes |  |

## `extensions.pg_stat_statements`

Type: view

Managed Supabase schema. Documented for catalog completeness; application code should usually avoid direct writes here.

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `userid` | oid | yes |  |
| `dbid` | oid | yes |  |
| `toplevel` | boolean | yes |  |
| `queryid` | bigint | yes |  |
| `query` | text | yes |  |
| `plans` | bigint | yes |  |
| `total_plan_time` | double precision | yes |  |
| `min_plan_time` | double precision | yes |  |
| `max_plan_time` | double precision | yes |  |
| `mean_plan_time` | double precision | yes |  |
| `stddev_plan_time` | double precision | yes |  |
| `calls` | bigint | yes |  |
| `total_exec_time` | double precision | yes |  |
| `min_exec_time` | double precision | yes |  |
| `max_exec_time` | double precision | yes |  |
| `mean_exec_time` | double precision | yes |  |
| `stddev_exec_time` | double precision | yes |  |
| `rows` | bigint | yes |  |
| `shared_blks_hit` | bigint | yes |  |
| `shared_blks_read` | bigint | yes |  |
| `shared_blks_dirtied` | bigint | yes |  |
| `shared_blks_written` | bigint | yes |  |
| `local_blks_hit` | bigint | yes |  |
| `local_blks_read` | bigint | yes |  |
| `local_blks_dirtied` | bigint | yes |  |
| `local_blks_written` | bigint | yes |  |
| `temp_blks_read` | bigint | yes |  |
| `temp_blks_written` | bigint | yes |  |
| `blk_read_time` | double precision | yes |  |
| `blk_write_time` | double precision | yes |  |
| `temp_blk_read_time` | double precision | yes |  |
| `temp_blk_write_time` | double precision | yes |  |
| `wal_records` | bigint | yes |  |
| `wal_fpi` | bigint | yes |  |
| `wal_bytes` | numeric | yes |  |
| `jit_functions` | bigint | yes |  |
| `jit_generation_time` | double precision | yes |  |
| `jit_inlining_count` | bigint | yes |  |
| `jit_inlining_time` | double precision | yes |  |
| `jit_optimization_count` | bigint | yes |  |
| `jit_optimization_time` | double precision | yes |  |
| `jit_emission_count` | bigint | yes |  |
| `jit_emission_time` | double precision | yes |  |

## `extensions.pg_stat_statements_info`

Type: view

Managed Supabase schema. Documented for catalog completeness; application code should usually avoid direct writes here.

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `dealloc` | bigint | yes |  |
| `stats_reset` | timestamp with time zone | yes |  |

## `net._http_response`

Type: table

Managed Supabase schema. Documented for catalog completeness; application code should usually avoid direct writes here.

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `id` | bigint | yes |  |
| `status_code` | integer | yes |  |
| `content_type` | text | yes |  |
| `headers` | jsonb | yes |  |
| `content` | text | yes |  |
| `timed_out` | boolean | yes |  |
| `error_msg` | text | yes |  |
| `created` | timestamp with time zone | no | now() |

## `net.http_request_queue`

Type: table

Managed Supabase schema. Documented for catalog completeness; application code should usually avoid direct writes here.

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `id` | bigint | no | nextval('net.http_request_queue_id_seq'::regclass) |
| `method` | text | no |  |
| `url` | text | no |  |
| `headers` | jsonb | no |  |
| `body` | bytea | yes |  |
| `timeout_milliseconds` | integer | no |  |

## `pgsodium.decrypted_key`

Type: view

Managed Supabase schema. Documented for catalog completeness; application code should usually avoid direct writes here.

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `id` | uuid | yes |  |
| `status` | key_status | yes |  |
| `created` | timestamp with time zone | yes |  |
| `expires` | timestamp with time zone | yes |  |
| `key_type` | key_type | yes |  |
| `key_id` | bigint | yes |  |
| `key_context` | bytea | yes |  |
| `name` | text | yes |  |
| `associated_data` | text | yes |  |
| `raw_key` | bytea | yes |  |
| `decrypted_raw_key` | bytea | yes |  |
| `raw_key_nonce` | bytea | yes |  |
| `parent_key` | uuid | yes |  |
| `comment` | text | yes |  |

## `pgsodium.key`

Type: table

Managed Supabase schema. Documented for catalog completeness; application code should usually avoid direct writes here.

Primary key: `id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `id` | uuid | no | gen_random_uuid() |
| `status` | key_status | yes | 'valid'::pgsodium.key_status |
| `created` | timestamp with time zone | no | CURRENT_TIMESTAMP |
| `expires` | timestamp with time zone | yes |  |
| `key_type` | key_type | yes |  |
| `key_id` | bigint | yes | nextval('pgsodium.key_key_id_seq'::regclass) |
| `key_context` | bytea | yes | '\x7067736f6469756d'::bytea |
| `name` | text | yes |  |
| `associated_data` | text | yes | 'associated'::text |
| `raw_key` | bytea | yes |  |
| `raw_key_nonce` | bytea | yes |  |
| `parent_key` | uuid | yes |  |
| `comment` | text | yes |  |
| `user_data` | text | yes |  |

## `pgsodium.mask_columns`

Type: view

Managed Supabase schema. Documented for catalog completeness; application code should usually avoid direct writes here.

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `attname` | name | yes |  |
| `attrelid` | oid | yes |  |
| `key_id` | text | yes |  |
| `key_id_column` | text | yes |  |
| `associated_columns` | text | yes |  |
| `nonce_column` | text | yes |  |
| `format_type` | text | yes |  |

## `pgsodium.masking_rule`

Type: view

Managed Supabase schema. Documented for catalog completeness; application code should usually avoid direct writes here.

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `attrelid` | oid | yes |  |
| `attnum` | integer | yes |  |
| `relnamespace` | regnamespace | yes |  |
| `relname` | name | yes |  |
| `attname` | name | yes |  |
| `format_type` | text | yes |  |
| `col_description` | text | yes |  |
| `key_id_column` | text | yes |  |
| `key_id` | text | yes |  |
| `associated_columns` | text | yes |  |
| `nonce_column` | text | yes |  |
| `view_name` | text | yes |  |
| `priority` | integer | yes |  |
| `security_invoker` | boolean | yes |  |

## `pgsodium.valid_key`

Type: view

Managed Supabase schema. Documented for catalog completeness; application code should usually avoid direct writes here.

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `id` | uuid | yes |  |
| `name` | text | yes |  |
| `status` | key_status | yes |  |
| `key_type` | key_type | yes |  |
| `key_id` | bigint | yes |  |
| `key_context` | bytea | yes |  |
| `created` | timestamp with time zone | yes |  |
| `expires` | timestamp with time zone | yes |  |
| `associated_data` | text | yes |  |

## `private.connected_account_tokens`

Type: table

Primary key: `id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `id` | uuid | no | gen_random_uuid() |
| `connected_account_id` | uuid | no |  |
| `user_id` | uuid | no |  |
| `provider` | text | no |  |
| `token_type` | text | yes |  |
| `scopes` | jsonb | no | '[]'::jsonb |
| `provider_user_id` | text | yes |  |
| `expires_at` | timestamp with time zone | yes |  |
| `refresh_expires_at` | timestamp with time zone | yes |  |
| `last_refreshed_at` | timestamp with time zone | yes |  |
| `secret_metadata` | jsonb | no | '{}'::jsonb |
| `created_at` | timestamp with time zone | no | now() |
| `updated_at` | timestamp with time zone | no | now() |
| `access_token_secret_id` | uuid | yes |  |
| `refresh_token_secret_id` | uuid | yes |  |

## `public._nhl_totals_current`

Type: table

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `nhl_player_id` | text | yes |  |
| `nhl_player_name` | text | yes |  |
| `nhl_team_abbreviation` | text | yes |  |
| `name_norm` | text | yes |  |
| `player_type` | text | yes |  |
| `points` | numeric | yes |  |
| `goals` | numeric | yes |  |
| `assists` | numeric | yes |  |
| `shots` | numeric | yes |  |
| `pp_points` | numeric | yes |  |
| `blocked_shots` | numeric | yes |  |
| `hits` | numeric | yes |  |
| `total_fow` | numeric | yes |  |
| `penalty_minutes` | numeric | yes |  |
| `sh_points` | numeric | yes |  |
| `wins` | numeric | yes |  |
| `losses` | numeric | yes |  |
| `saves` | numeric | yes |  |
| `shots_against` | numeric | yes |  |
| `shutouts` | numeric | yes |  |
| `quality_start` | numeric | yes |  |
| `goals_against_avg` | numeric | yes |  |
| `save_pct` | numeric | yes |  |

## `public._yahoo_players_465_norm`

Type: table

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `player_name` | character varying | yes |  |
| `player_id` | character varying | yes |  |
| `draft_analysis` | jsonb | yes |  |
| `average_draft_pick` | double precision | yes |  |
| `average_draft_round` | double precision | yes |  |
| `average_draft_cost` | double precision | yes |  |
| `percent_drafted` | double precision | yes |  |
| `editorial_player_key` | character varying | yes |  |
| `editorial_team_abbreviation` | character varying | yes |  |
| `editorial_team_full_name` | character varying | yes |  |
| `eligible_positions` | jsonb | yes |  |
| `display_position` | text | yes |  |
| `headshot_url` | text | yes |  |
| `injury_note` | text | yes |  |
| `full_name` | character varying | yes |  |
| `percent_ownership` | double precision | yes |  |
| `player_key` | character varying | yes |  |
| `position_type` | character varying | yes |  |
| `status` | character varying | yes |  |
| `status_full` | character varying | yes |  |
| `last_updated` | timestamp without time zone | yes |  |
| `uniform_number` | smallint | yes |  |
| `ownership_timeline` | jsonb | yes |  |
| `game_id` | integer | yes |  |
| `season` | integer | yes |  |
| `player_name_norm` | text | yes |  |

## `public._yahoo_players_latest_norm`

Type: table

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `player_name` | character varying | yes |  |
| `player_id` | character varying | yes |  |
| `draft_analysis` | jsonb | yes |  |
| `average_draft_pick` | double precision | yes |  |
| `average_draft_round` | double precision | yes |  |
| `average_draft_cost` | double precision | yes |  |
| `percent_drafted` | double precision | yes |  |
| `editorial_player_key` | character varying | yes |  |
| `editorial_team_abbreviation` | character varying | yes |  |
| `editorial_team_full_name` | character varying | yes |  |
| `eligible_positions` | jsonb | yes |  |
| `display_position` | text | yes |  |
| `headshot_url` | text | yes |  |
| `injury_note` | text | yes |  |
| `full_name` | character varying | yes |  |
| `percent_ownership` | double precision | yes |  |
| `player_key` | character varying | yes |  |
| `position_type` | character varying | yes |  |
| `status` | character varying | yes |  |
| `status_full` | character varying | yes |  |
| `last_updated` | timestamp without time zone | yes |  |
| `uniform_number` | smallint | yes |  |
| `ownership_timeline` | jsonb | yes |  |
| `game_id` | integer | yes |  |
| `season` | integer | yes |  |
| `player_name_norm` | text | yes |  |

## `public.admin__column_catalog`

Type: view

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `schema` | name | yes |  |
| `table` | name | yes |  |
| `column` | name | yes |  |
| `column_lc` | text | yes |  |
| `data_type` | character varying | yes |  |
| `udt_name` | name | yes |  |
| `is_nullable` | boolean | yes |  |
| `null_frac` | real | yes |  |
| `n_distinct` | real | yes |  |

## `public.admin__prd_requirements`

Type: table

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `namespace` | text | no |  |
| `table_match_regex` | text | no |  |
| `required_col` | text | no |  |
| `aliases` | _text[] | yes | '{}'::text[] |
| `required` | boolean | yes | true |

## `public.admin__table_profile`

Type: view

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `schema` | name | yes |  |
| `table` | name | yes |  |
| `bytes` | bigint | yes |  |
| `is_partitioned` | boolean | yes |  |
| `live_rows_parent` | bigint | yes |  |
| `live_rows_children` | bigint | yes |  |
| `est_rows_parent` | bigint | yes |  |
| `est_rows_children` | bigint | yes |  |
| `live_rows_effective` | bigint | yes |  |
| `est_rows_effective` | bigint | yes |  |

## `public.admin__table_summary`

Type: view

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `schema` | name | yes |  |
| `table` | name | yes |  |
| `bytes` | bigint | yes |  |
| `size_pretty` | text | yes |  |
| `live_rows` | bigint | yes |  |
| `est_rows` | bigint | yes |  |
| `rls_enabled` | boolean | yes |  |
| `rls_forced` | boolean | yes |  |

## `public.connected_accounts`

Type: table

Primary key: `id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `id` | uuid | no | gen_random_uuid() |
| `user_id` | uuid | no |  |
| `provider` | text | no |  |
| `provider_user_id` | text | yes |  |
| `account_label` | text | yes |  |
| `status` | text | no | 'disconnected'::text |
| `scopes` | jsonb | no | '[]'::jsonb |
| `metadata` | jsonb | no | '{}'::jsonb |
| `last_synced_at` | timestamp with time zone | yes |  |
| `created_at` | timestamp with time zone | no | now() |
| `updated_at` | timestamp with time zone | no | now() |

## `public.cron_job_audit`

Type: table

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `job_name` | text | no |  |
| `run_time` | timestamp with time zone | no | now() |
| `status` | text | no |  |
| `rows_affected` | integer | yes |  |
| `details` | jsonb | yes |  |

## `public.cron_job_report`

Type: view

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `jobname` | name | yes |  |
| `scheduled_time` | timestamp with time zone | yes |  |
| `status` | text | yes |  |
| `sql_text` | text | yes |  |
| `return_message` | text | yes |  |
| `end_time` | timestamp with time zone | yes |  |
| `jobid` | bigint | yes |  |
| `runid` | bigint | yes |  |

## `public.entity_sustainability_bands_daily`

Type: table

Primary key: `snapshot_date`, `entity_type`, `entity_id`, `metric_key`, `window_code`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `snapshot_date` | date | no |  |
| `season_id` | integer | yes |  |
| `entity_type` | text | no |  |
| `entity_id` | bigint | no |  |
| `team_id` | smallint | yes |  |
| `player_id` | bigint | yes |  |
| `metric_key` | text | no |  |
| `window_code` | text | no |  |
| `baseline` | double precision | yes |  |
| `ewma` | double precision | yes |  |
| `value` | double precision | no |  |
| `ci_lower` | double precision | no |  |
| `ci_upper` | double precision | no |  |
| `z_score` | double precision | yes |  |
| `percentile` | double precision | yes |  |
| `exposure` | double precision | yes |  |
| `distribution` | jsonb | yes |  |
| `provenance` | jsonb | no | '{}'::jsonb |
| `metadata` | jsonb | no | '{}'::jsonb |
| `computed_at` | timestamp with time zone | no | now() |
| `updated_at` | timestamp with time zone | no | now() |

## `public.entity_sustainability_scores_daily`

Type: table

Primary key: `snapshot_date`, `entity_type`, `entity_id`, `metric_scope`, `window_code`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `snapshot_date` | date | no |  |
| `season_id` | integer | yes |  |
| `entity_type` | text | no |  |
| `entity_id` | bigint | no |  |
| `team_id` | smallint | yes |  |
| `player_id` | bigint | yes |  |
| `metric_scope` | text | no | 'overall'::text |
| `window_code` | text | no |  |
| `baseline_value` | double precision | yes |  |
| `recent_value` | double precision | yes |  |
| `expected_value` | double precision | yes |  |
| `z_score` | double precision | yes |  |
| `s_raw` | double precision | no |  |
| `s_100` | double precision | no |  |
| `expectation_state` | text | no |  |
| `components` | jsonb | no | '{}'::jsonb |
| `provenance` | jsonb | no | '{}'::jsonb |
| `metadata` | jsonb | no | '{}'::jsonb |
| `computed_at` | timestamp with time zone | no | now() |
| `updated_at` | timestamp with time zone | no | now() |

## `public.entity_trend_snapshots_daily`

Type: table

Primary key: `snapshot_date`, `entity_type`, `entity_id`, `metric_key`, `window_code`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `snapshot_date` | date | no |  |
| `season_id` | integer | yes |  |
| `entity_type` | text | no |  |
| `entity_id` | bigint | no |  |
| `team_id` | smallint | yes |  |
| `player_id` | bigint | yes |  |
| `metric_key` | text | no |  |
| `window_code` | text | no |  |
| `recent_value` | double precision | yes |  |
| `baseline_value` | double precision | yes |  |
| `delta_value` | double precision | yes |  |
| `slope_value` | double precision | yes |  |
| `trend_score_0_to_100` | double precision | yes |  |
| `trend_rank` | integer | yes |  |
| `percentile` | double precision | yes |  |
| `history_points` | jsonb | no | '[]'::jsonb |
| `components` | jsonb | no | '{}'::jsonb |
| `provenance` | jsonb | no | '{}'::jsonb |
| `metadata` | jsonb | no | '{}'::jsonb |
| `computed_at` | timestamp with time zone | no | now() |
| `updated_at` | timestamp with time zone | no | now() |

## `public.expected_goals`

Type: table

Primary key: `game_id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `game_id` | bigint | no |  |
| `game_date` | date | no |  |
| `home_team_id` | integer | no |  |
| `away_team_id` | integer | no |  |
| `home_team_abbreviation` | text | no |  |
| `away_team_abbreviation` | text | no |  |
| `home_expected_goals` | numeric | no |  |
| `away_expected_goals` | numeric | no |  |
| `home_win_odds` | numeric | no |  |
| `away_win_odds` | numeric | no |  |
| `home_api_win_odds` | numeric | yes |  |
| `away_api_win_odds` | numeric | yes |  |
| `updated_at` | timestamp with time zone | no | now() |
| `league_average_goals_for` | numeric | no |  |

## `public.external_leagues`

Type: table

Primary key: `id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `id` | uuid | no | gen_random_uuid() |
| `connected_account_id` | uuid | no |  |
| `user_id` | uuid | no |  |
| `provider` | text | no |  |
| `external_league_key` | text | no |  |
| `league_name` | text | yes |  |
| `season_key` | text | yes |  |
| `league_metadata` | jsonb | no | '{}'::jsonb |
| `scoring_settings` | jsonb | no | '{}'::jsonb |
| `roster_settings` | jsonb | no | '{}'::jsonb |
| `imported_at` | timestamp with time zone | yes |  |
| `created_at` | timestamp with time zone | no | now() |
| `updated_at` | timestamp with time zone | no | now() |

## `public.forge_projection_accuracy_daily`

Type: table

Primary key: `date`, `scope`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `date` | date | no |  |
| `scope` | text | no |  |
| `accuracy_avg` | numeric | no |  |
| `mae` | numeric | no |  |
| `rmse` | numeric | no |  |
| `player_count` | integer | no |  |
| `accuracy_sum` | numeric | no |  |
| `error_abs_sum` | numeric | no |  |
| `error_sq_sum` | numeric | no |  |
| `running_accuracy_sum` | numeric | no |  |
| `running_error_abs_sum` | numeric | no |  |
| `running_error_sq_sum` | numeric | no |  |
| `running_player_count` | integer | no |  |
| `running_accuracy_avg` | numeric | no |  |
| `running_mae` | numeric | no |  |
| `running_rmse` | numeric | no |  |
| `updated_at` | timestamp with time zone | no | now() |

## `public.forge_projection_accuracy_stat_daily`

Type: table

Primary key: `date`, `scope`, `stat_key`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `date` | date | no |  |
| `scope` | text | no |  |
| `stat_key` | text | no |  |
| `mae` | numeric | no |  |
| `rmse` | numeric | no |  |
| `player_count` | integer | no |  |
| `error_abs_sum` | numeric | no |  |
| `error_sq_sum` | numeric | no |  |
| `updated_at` | timestamp with time zone | no | now() |

## `public.forge_projection_calibration_daily`

Type: table

Primary key: `date`, `scope`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `date` | date | no |  |
| `projection_date` | date | no |  |
| `scope` | text | no |  |
| `source_run_id` | uuid | no |  |
| `metrics` | jsonb | no | '{}'::jsonb |
| `updated_at` | timestamp with time zone | no | now() |

## `public.forge_projection_results`

Type: table

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `as_of_date` | date | no |  |
| `actual_date` | date | no |  |
| `game_id` | bigint | yes |  |
| `player_id` | bigint | no |  |
| `player_type` | text | no |  |
| `team_id` | smallint | yes |  |
| `opponent_team_id` | smallint | yes |  |
| `predicted_fp` | numeric | no |  |
| `actual_fp` | numeric | no |  |
| `error_abs` | numeric | no |  |
| `error_sq` | numeric | no |  |
| `accuracy` | numeric | no |  |
| `source_run_id` | uuid | no |  |
| `created_at` | timestamp with time zone | no | now() |

## `public.forge_runs`

Type: table

Primary key: `run_id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `run_id` | uuid | no | gen_random_uuid() |
| `as_of_date` | date | no |  |
| `status` | text | no | 'created'::text |
| `git_sha` | text | yes |  |
| `notes` | text | yes |  |
| `metrics` | jsonb | no | '{}'::jsonb |
| `created_at` | timestamp with time zone | no | now() |
| `updated_at` | timestamp with time zone | no | now() |

## `public.gameOutcomes`

Type: view

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `gameId` | bigint | yes |  |
| `teamId` | smallint | yes |  |
| `outcome` | text | yes |  |

## `public.game_prediction_accountability_daily`

Type: table

Primary key: `accountability_daily_id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `accountability_daily_id` | uuid | no | gen_random_uuid() |
| `backtest_run_id` | uuid | yes |  |
| `model_name` | text | no |  |
| `model_version` | text | no |  |
| `feature_set_version` | text | no |  |
| `as_of_date` | date | no |  |
| `evaluated_games` | integer | no |  |
| `correct_games` | integer | no |  |
| `wrong_games` | integer | no |  |
| `cumulative_accuracy` | double precision | yes |  |
| `rolling_10_accuracy` | double precision | yes |  |
| `rolling_25_accuracy` | double precision | yes |  |
| `rolling_50_accuracy` | double precision | yes |  |
| `brier_score` | double precision | yes |  |
| `log_loss` | double precision | yes |  |
| `metadata` | jsonb | no | '{}'::jsonb |
| `computed_at` | timestamp with time zone | no | now() |
| `created_at` | timestamp with time zone | no | now() |

## `public.game_prediction_accountability_games`

Type: table

Primary key: `accountability_game_id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `accountability_game_id` | uuid | no | gen_random_uuid() |
| `backtest_run_id` | uuid | yes |  |
| `prediction_id` | uuid | yes |  |
| `game_id` | bigint | no |  |
| `snapshot_date` | date | no |  |
| `model_name` | text | no |  |
| `model_version` | text | no |  |
| `feature_set_version` | text | no |  |
| `home_team_id` | smallint | no |  |
| `away_team_id` | smallint | no |  |
| `open_home_win_probability` | double precision | no |  |
| `low_home_win_probability` | double precision | no |  |
| `high_home_win_probability` | double precision | no |  |
| `final_home_win_probability` | double precision | no |  |
| `actual_home_win_probability` | double precision | no |  |
| `prediction_count` | integer | no |  |
| `predicted_winner_team_id` | smallint | yes |  |
| `actual_winner_team_id` | smallint | no |  |
| `predicted_winner_correct` | boolean | no |  |
| `home_score` | smallint | no |  |
| `away_score` | smallint | no |  |
| `probability_spread` | double precision | no |  |
| `final_prediction_cutoff_at` | timestamp with time zone | no |  |
| `metadata` | jsonb | no | '{}'::jsonb |
| `computed_at` | timestamp with time zone | no | now() |
| `created_at` | timestamp with time zone | no | now() |

## `public.game_prediction_backtest_runs`

Type: table

Primary key: `backtest_run_id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `backtest_run_id` | uuid | no | gen_random_uuid() |
| `model_name` | text | no |  |
| `model_version` | text | no |  |
| `feature_set_version` | text | no |  |
| `season_id` | integer | no |  |
| `training_start_date` | date | no |  |
| `training_end_date` | date | no |  |
| `replay_start_date` | date | no |  |
| `replay_end_date` | date | no |  |
| `training_games` | integer | no |  |
| `replay_games` | integer | no |  |
| `retrain_cadence_games` | integer | no | 1 |
| `status` | text | no | 'completed'::text |
| `metrics` | jsonb | no | '{}'::jsonb |
| `model_artifacts` | jsonb | no | '{}'::jsonb |
| `metadata` | jsonb | no | '{}'::jsonb |
| `started_at` | timestamp with time zone | no | now() |
| `completed_at` | timestamp with time zone | yes |  |
| `created_at` | timestamp with time zone | no | now() |

## `public.game_prediction_feature_snapshots`

Type: table

Primary key: `feature_snapshot_id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `feature_snapshot_id` | uuid | no | gen_random_uuid() |
| `game_id` | bigint | no |  |
| `snapshot_date` | date | no |  |
| `prediction_scope` | text | no | 'pregame'::text |
| `prediction_cutoff_at` | timestamp with time zone | no |  |
| `model_name` | text | no |  |
| `model_version` | text | no |  |
| `feature_set_version` | text | no |  |
| `home_team_id` | smallint | no |  |
| `away_team_id` | smallint | no |  |
| `source_cutoffs` | jsonb | no | '{}'::jsonb |
| `feature_payload` | jsonb | no | '{}'::jsonb |
| `missing_features` | jsonb | no | '[]'::jsonb |
| `fallback_flags` | jsonb | no | '{}'::jsonb |
| `provenance` | jsonb | no | '{}'::jsonb |
| `metadata` | jsonb | no | '{}'::jsonb |
| `computed_at` | timestamp with time zone | no | now() |
| `created_at` | timestamp with time zone | no | now() |

## `public.game_prediction_history`

Type: table

Primary key: `prediction_id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `prediction_id` | uuid | no | gen_random_uuid() |
| `feature_snapshot_id` | uuid | no |  |
| `run_id` | uuid | yes |  |
| `snapshot_date` | date | no |  |
| `game_id` | bigint | no |  |
| `prediction_scope` | text | no | 'pregame'::text |
| `prediction_cutoff_at` | timestamp with time zone | no |  |
| `model_name` | text | no |  |
| `model_version` | text | no |  |
| `feature_set_version` | text | no |  |
| `home_team_id` | smallint | no |  |
| `away_team_id` | smallint | no |  |
| `home_win_probability` | double precision | no |  |
| `away_win_probability` | double precision | no |  |
| `home_expected_goals` | double precision | yes |  |
| `away_expected_goals` | double precision | yes |  |
| `total_expected_goals` | double precision | yes |  |
| `spread_projection` | double precision | yes |  |
| `predicted_winner_team_id` | smallint | yes |  |
| `confidence_label` | text | yes |  |
| `top_factors` | jsonb | no | '[]'::jsonb |
| `components` | jsonb | no | '{}'::jsonb |
| `provenance` | jsonb | no | '{}'::jsonb |
| `metadata` | jsonb | no | '{}'::jsonb |
| `is_public` | boolean | no | true |
| `computed_at` | timestamp with time zone | no | now() |
| `published_at` | timestamp with time zone | yes |  |
| `created_at` | timestamp with time zone | no | now() |

## `public.game_prediction_model_metrics`

Type: table

Primary key: `metric_id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `metric_id` | uuid | no | gen_random_uuid() |
| `run_id` | uuid | yes |  |
| `model_name` | text | no |  |
| `model_version` | text | no |  |
| `feature_set_version` | text | no |  |
| `evaluation_start_date` | date | no |  |
| `evaluation_end_date` | date | no |  |
| `segment_key` | text | no | 'overall'::text |
| `segment_value` | text | no | 'all'::text |
| `evaluated_games` | integer | no |  |
| `log_loss` | double precision | yes |  |
| `brier_score` | double precision | yes |  |
| `accuracy` | double precision | yes |  |
| `auc` | double precision | yes |  |
| `calibration` | jsonb | no | '{}'::jsonb |
| `coverage` | jsonb | no | '{}'::jsonb |
| `metadata` | jsonb | no | '{}'::jsonb |
| `computed_at` | timestamp with time zone | no | now() |
| `created_at` | timestamp with time zone | no | now() |

## `public.game_prediction_model_versions`

Type: table

Primary key: `model_name`, `model_version`, `feature_set_version`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `model_name` | text | no |  |
| `model_version` | text | no |  |
| `feature_set_version` | text | no |  |
| `status` | text | no | 'candidate'::text |
| `algorithm` | text | no |  |
| `training_run_id` | uuid | yes |  |
| `trained_at` | timestamp with time zone | yes |  |
| `training_start_date` | date | yes |  |
| `training_end_date` | date | yes |  |
| `validation_start_date` | date | yes |  |
| `validation_end_date` | date | yes |  |
| `promoted_at` | timestamp with time zone | yes |  |
| `retired_at` | timestamp with time zone | yes |  |
| `git_sha` | text | yes |  |
| `hyperparameters` | jsonb | no | '{}'::jsonb |
| `training_metrics` | jsonb | no | '{}'::jsonb |
| `validation_metrics` | jsonb | no | '{}'::jsonb |
| `calibration_metadata` | jsonb | no | '{}'::jsonb |
| `source_audit_metadata` | jsonb | no | '{}'::jsonb |
| `metadata` | jsonb | no | '{}'::jsonb |
| `created_at` | timestamp with time zone | no | now() |
| `updated_at` | timestamp with time zone | no | now() |

## `public.game_prediction_outputs`

Type: table

Primary key: `snapshot_date`, `game_id`, `model_name`, `model_version`, `prediction_scope`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `snapshot_date` | date | no |  |
| `game_id` | bigint | no |  |
| `model_name` | text | no |  |
| `model_version` | text | no |  |
| `prediction_scope` | text | no | 'pregame'::text |
| `home_team_id` | smallint | no |  |
| `away_team_id` | smallint | no |  |
| `home_win_probability` | double precision | yes |  |
| `away_win_probability` | double precision | yes |  |
| `home_expected_goals` | double precision | yes |  |
| `away_expected_goals` | double precision | yes |  |
| `total_expected_goals` | double precision | yes |  |
| `spread_projection` | double precision | yes |  |
| `components` | jsonb | no | '{}'::jsonb |
| `provenance` | jsonb | no | '{}'::jsonb |
| `metadata` | jsonb | no | '{}'::jsonb |
| `computed_at` | timestamp with time zone | no | now() |
| `updated_at` | timestamp with time zone | no | now() |

## `public.gamelog_game_map`

Type: table

Primary key: `player_id`, `date_scraped`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `player_id` | bigint | no |  |
| `date_scraped` | date | no |  |
| `game_id` | bigint | no |  |
| `source` | text | no |  |
| `created_at` | timestamp with time zone | no | now() |

## `public.games`

Type: table

Primary key: `id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `id` | bigint | no |  |
| `date` | date | no |  |
| `seasonId` | bigint | no |  |
| `startTime` | timestamp with time zone | no | now() |
| `type` | smallint | yes |  |
| `created_at` | timestamp with time zone | no | now() |
| `homeTeamId` | smallint | no |  |
| `awayTeamId` | smallint | no |  |

## `public.job_locks`

Type: table

Primary key: `job_name`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `job_name` | text | no |  |
| `locked_at` | timestamp with time zone | yes | now() |

## `public.job_run_details`

Type: view

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `jobid` | bigint | yes |  |
| `runid` | bigint | yes |  |
| `job_pid` | integer | yes |  |
| `database` | text | yes |  |
| `username` | text | yes |  |
| `command` | text | yes |  |
| `status` | text | yes |  |
| `return_message` | text | yes |  |
| `start_time` | timestamp with time zone | yes |  |
| `end_time` | timestamp with time zone | yes |  |

## `public.line_source_ifttt_events`

Type: table

Primary key: `id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `id` | uuid | no | gen_random_uuid() |
| `source` | text | no | 'ifttt'::text |
| `source_group` | text | no |  |
| `source_key` | text | no |  |
| `source_account` | text | no |  |
| `username` | text | yes |  |
| `text` | text | yes |  |
| `link_to_tweet` | text | yes |  |
| `tweet_id` | text | yes |  |
| `tweet_embed_code` | text | yes |  |
| `tweet_created_at` | timestamp with time zone | yes |  |
| `created_at_label` | text | yes |  |
| `processing_status` | text | no | 'pending'::text |
| `raw_payload` | jsonb | no | '{}'::jsonb |
| `received_at` | timestamp with time zone | no | now() |
| `updated_at` | timestamp with time zone | no | now() |

## `public.line_source_snapshots`

Type: table

Primary key: `capture_key`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `capture_key` | text | no |  |
| `source_group` | text | no |  |
| `source_key` | text | no |  |
| `source_account` | text | no |  |
| `snapshot_date` | date | no |  |
| `observed_at` | timestamp with time zone | no | now() |
| `tweet_posted_at` | timestamp with time zone | yes |  |
| `tweet_posted_label` | text | yes |  |
| `game_id` | bigint | yes |  |
| `team_id` | bigint | yes |  |
| `team_abbreviation` | text | yes |  |
| `team_name` | text | yes |  |
| `source` | text | no |  |
| `source_url` | text | yes |  |
| `source_label` | text | yes |  |
| `source_handle` | text | yes |  |
| `author_name` | text | yes |  |
| `tweet_id` | text | yes |  |
| `tweet_url` | text | yes |  |
| `quoted_tweet_id` | text | yes |  |
| `quoted_tweet_url` | text | yes |  |
| `quoted_author_handle` | text | yes |  |
| `quoted_author_name` | text | yes |  |
| `primary_text_source` | text | yes |  |
| `classification` | text | yes |  |
| `detected_league` | text | yes |  |
| `nhl_filter_status` | text | no | 'accepted'::text |
| `nhl_filter_reason` | text | yes |  |
| `status` | text | no | 'observed'::text |
| `raw_text` | text | yes |  |
| `enriched_text` | text | yes |  |
| `quoted_raw_text` | text | yes |  |
| `quoted_enriched_text` | text | yes |  |
| `keyword_hits` | _text[] | yes |  |
| `matched_player_ids` | _int8[] | yes |  |
| `matched_player_names` | _text[] | yes |  |
| `unmatched_names` | _text[] | yes |  |
| `line_1_player_ids` | _int8[] | yes |  |
| `line_1_player_names` | _text[] | yes |  |
| `line_2_player_ids` | _int8[] | yes |  |
| `line_2_player_names` | _text[] | yes |  |
| `line_3_player_ids` | _int8[] | yes |  |
| `line_3_player_names` | _text[] | yes |  |
| `line_4_player_ids` | _int8[] | yes |  |
| `line_4_player_names` | _text[] | yes |  |
| `pair_1_player_ids` | _int8[] | yes |  |
| `pair_1_player_names` | _text[] | yes |  |
| `pair_2_player_ids` | _int8[] | yes |  |
| `pair_2_player_names` | _text[] | yes |  |
| `pair_3_player_ids` | _int8[] | yes |  |
| `pair_3_player_names` | _text[] | yes |  |
| `goalie_1_player_id` | bigint | yes |  |
| `goalie_1_name` | text | yes |  |
| `goalie_2_player_id` | bigint | yes |  |
| `goalie_2_name` | text | yes |  |
| `scratches_player_ids` | _int8[] | yes |  |
| `scratches_player_names` | _text[] | yes |  |
| `injured_player_ids` | _int8[] | yes |  |
| `injured_player_names` | _text[] | yes |  |
| `raw_payload` | jsonb | no | '{}'::jsonb |
| `metadata` | jsonb | no | '{}'::jsonb |
| `updated_at` | timestamp with time zone | no | now() |

## `public.market_prices_daily`

Type: table

Primary key: `snapshot_date`, `game_id`, `market_type`, `sportsbook_key`, `outcome_key`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `snapshot_date` | date | no |  |
| `game_id` | bigint | no |  |
| `market_type` | text | no |  |
| `sportsbook_key` | text | no |  |
| `outcome_key` | text | no |  |
| `line_value` | double precision | yes |  |
| `price_american` | integer | yes |  |
| `implied_probability` | double precision | yes |  |
| `source_payload` | jsonb | no | '{}'::jsonb |
| `source_rank` | smallint | no | 1 |
| `is_official` | boolean | no | false |
| `source_observed_at` | timestamp with time zone | no | now() |
| `freshness_expires_at` | timestamp with time zone | yes |  |
| `provenance` | jsonb | no | '{}'::jsonb |
| `metadata` | jsonb | no | '{}'::jsonb |
| `computed_at` | timestamp with time zone | no | now() |
| `updated_at` | timestamp with time zone | no | now() |

## `public.model_market_flags_daily`

Type: table

Primary key: `snapshot_date`, `entity_type`, `entity_id`, `model_name`, `model_version`, `market_type`, `flag_type`, `game_id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `snapshot_date` | date | no |  |
| `entity_type` | text | no |  |
| `entity_id` | bigint | no |  |
| `game_id` | bigint | no |  |
| `model_name` | text | no |  |
| `model_version` | text | no |  |
| `market_type` | text | no |  |
| `sportsbook_key` | text | yes |  |
| `flag_type` | text | no |  |
| `edge_value` | double precision | yes |  |
| `confidence_0_to_100` | double precision | yes |  |
| `reasons` | jsonb | no | '[]'::jsonb |
| `provenance` | jsonb | no | '{}'::jsonb |
| `metadata` | jsonb | no | '{}'::jsonb |
| `computed_at` | timestamp with time zone | no | now() |
| `updated_at` | timestamp with time zone | no | now() |

## `public.model_sustainability_config`

Type: table

Primary key: `id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `id` | bigint | no | nextval('model_sustainability_config_id_seq'::regclass) |
| `model_version` | integer | no |  |
| `active` | boolean | no | true |
| `weights_json` | jsonb | no |  |
| `toggles_json` | jsonb | no |  |
| `constants_json` | jsonb | no |  |
| `sd_mode` | text | no |  |
| `freshness_days` | integer | no | 45 |
| `created_at` | timestamp with time zone | no | now() |
| `updated_at` | timestamp with time zone | no | now() |

## `public.news_feed_items`

Type: table

Primary key: `id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `id` | uuid | no | gen_random_uuid() |
| `source_review_item_id` | uuid | yes |  |
| `source_tweet_id` | text | yes |  |
| `source_url` | text | yes |  |
| `tweet_url` | text | yes |  |
| `source_label` | text | yes |  |
| `source_account` | text | yes |  |
| `team_id` | bigint | yes |  |
| `team_abbreviation` | text | yes |  |
| `headline` | text | no |  |
| `blurb` | text | no | ''::text |
| `category` | text | no |  |
| `subcategory` | text | yes |  |
| `card_status` | text | no | 'draft'::text |
| `observed_at` | timestamp with time zone | yes |  |
| `published_at` | timestamp with time zone | yes |  |
| `metadata` | jsonb | no | '{}'::jsonb |
| `created_at` | timestamp with time zone | no | now() |
| `updated_at` | timestamp with time zone | no | now() |

## `public.news_feed_keyword_phrases`

Type: table

Primary key: `id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `id` | uuid | no | gen_random_uuid() |
| `source_review_item_id` | uuid | yes |  |
| `source` | text | no | 'manual_review'::text |
| `phrase` | text | no |  |
| `normalized_phrase` | text | no |  |
| `scope_key` | text | no |  |
| `category` | text | yes |  |
| `subcategory` | text | yes |  |
| `notes` | text | yes |  |
| `status` | text | no | 'active'::text |
| `created_at` | timestamp with time zone | no | now() |
| `updated_at` | timestamp with time zone | no | now() |

## `public.nhl_api_game_payloads_raw`

Type: table

Primary key: `id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `id` | bigint | no | nextval('nhl_api_game_payloads_raw_id_seq'::regclass) |
| `game_id` | bigint | no |  |
| `endpoint` | text | no |  |
| `season_id` | bigint | yes |  |
| `game_date` | date | yes |  |
| `source_url` | text | no |  |
| `payload_hash` | text | no |  |
| `payload` | jsonb | no |  |
| `fetched_at` | timestamp with time zone | no | now() |
| `created_at` | timestamp with time zone | no | now() |

## `public.nhl_api_pbp_events`

Type: table

Primary key: `game_id`, `event_id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `game_id` | bigint | no |  |
| `season_id` | bigint | yes |  |
| `game_date` | date | yes |  |
| `event_id` | bigint | no |  |
| `sort_order` | integer | yes |  |
| `period_number` | integer | yes |  |
| `period_type` | text | yes |  |
| `time_in_period` | text | yes |  |
| `time_remaining` | text | yes |  |
| `period_seconds_elapsed` | integer | yes |  |
| `time_remaining_seconds` | integer | yes |  |
| `situation_code` | text | yes |  |
| `away_goalie` | smallint | yes |  |
| `away_skaters` | smallint | yes |  |
| `home_skaters` | smallint | yes |  |
| `home_goalie` | smallint | yes |  |
| `strength_exact` | text | yes |  |
| `strength_state` | text | yes |  |
| `home_team_defending_side` | text | yes |  |
| `type_code` | integer | yes |  |
| `type_desc_key` | text | yes |  |
| `event_owner_team_id` | bigint | yes |  |
| `event_owner_side` | text | yes |  |
| `is_shot_like` | boolean | no | false |
| `is_goal` | boolean | no | false |
| `is_penalty` | boolean | no | false |
| `details` | jsonb | no | '{}'::jsonb |
| `losing_player_id` | bigint | yes |  |
| `winning_player_id` | bigint | yes |  |
| `shooting_player_id` | bigint | yes |  |
| `scoring_player_id` | bigint | yes |  |
| `goalie_in_net_id` | bigint | yes |  |
| `blocking_player_id` | bigint | yes |  |
| `hitting_player_id` | bigint | yes |  |
| `hittee_player_id` | bigint | yes |  |
| `committed_by_player_id` | bigint | yes |  |
| `drawn_by_player_id` | bigint | yes |  |
| `served_by_player_id` | bigint | yes |  |
| `player_id` | bigint | yes |  |
| `assist1_player_id` | bigint | yes |  |
| `assist2_player_id` | bigint | yes |  |
| `shot_type` | text | yes |  |
| `penalty_type_code` | text | yes |  |
| `penalty_desc_key` | text | yes |  |
| `penalty_duration_minutes` | integer | yes |  |
| `reason` | text | yes |  |
| `secondary_reason` | text | yes |  |
| `x_coord` | numeric | yes |  |
| `y_coord` | numeric | yes |  |
| `zone_code` | text | yes |  |
| `home_score` | integer | yes |  |
| `away_score` | integer | yes |  |
| `home_sog` | integer | yes |  |
| `away_sog` | integer | yes |  |
| `created_at` | timestamp with time zone | no | now() |
| `updated_at` | timestamp with time zone | no | now() |
| `source_play_by_play_hash` | text | no |  |
| `parser_version` | integer | no | 1 |
| `strength_version` | integer | no | 1 |
| `raw_event` | jsonb | no | '{}'::jsonb |

## `public.nhl_api_pbp_shot_events_v1`

Type: view

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `game_id` | bigint | yes |  |
| `season_id` | bigint | yes |  |
| `game_date` | date | yes |  |
| `event_id` | bigint | yes |  |
| `sort_order` | integer | yes |  |
| `period_number` | integer | yes |  |
| `period_type` | text | yes |  |
| `time_in_period` | text | yes |  |
| `time_remaining` | text | yes |  |
| `period_seconds_elapsed` | integer | yes |  |
| `time_remaining_seconds` | integer | yes |  |
| `situation_code` | text | yes |  |
| `away_goalie` | smallint | yes |  |
| `away_skaters` | smallint | yes |  |
| `home_skaters` | smallint | yes |  |
| `home_goalie` | smallint | yes |  |
| `strength_exact` | text | yes |  |
| `strength_state` | text | yes |  |
| `type_code` | integer | yes |  |
| `type_desc_key` | text | yes |  |
| `event_owner_team_id` | bigint | yes |  |
| `event_owner_side` | text | yes |  |
| `details` | jsonb | yes |  |
| `shooting_player_id` | bigint | yes |  |
| `scoring_player_id` | bigint | yes |  |
| `goalie_in_net_id` | bigint | yes |  |
| `blocking_player_id` | bigint | yes |  |
| `shot_type` | text | yes |  |
| `reason` | text | yes |  |
| `x_coord` | numeric | yes |  |
| `y_coord` | numeric | yes |  |
| `zone_code` | text | yes |  |
| `home_score` | integer | yes |  |
| `away_score` | integer | yes |  |
| `home_sog` | integer | yes |  |
| `away_sog` | integer | yes |  |
| `is_goal` | boolean | yes |  |

## `public.nhl_api_shift_rows`

Type: table

Primary key: `game_id`, `shift_id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `game_id` | bigint | no |  |
| `shift_id` | bigint | no |  |
| `season_id` | bigint | yes |  |
| `game_date` | date | yes |  |
| `player_id` | bigint | no |  |
| `team_id` | bigint | no |  |
| `team_abbrev` | text | yes |  |
| `team_name` | text | yes |  |
| `first_name` | text | yes |  |
| `last_name` | text | yes |  |
| `period` | integer | yes |  |
| `shift_number` | integer | yes |  |
| `start_time` | text | yes |  |
| `end_time` | text | yes |  |
| `duration` | text | yes |  |
| `start_seconds` | integer | yes |  |
| `end_seconds` | integer | yes |  |
| `duration_seconds` | integer | yes |  |
| `type_code` | integer | yes |  |
| `detail_code` | integer | yes |  |
| `event_number` | integer | yes |  |
| `event_description` | text | yes |  |
| `event_details` | text | yes |  |
| `hex_value` | text | yes |  |
| `created_at` | timestamp with time zone | no | now() |
| `updated_at` | timestamp with time zone | no | now() |
| `source_shiftcharts_hash` | text | no |  |
| `parser_version` | integer | no | 1 |
| `raw_shift` | jsonb | no | '{}'::jsonb |

## `public.nhl_edge_stats_daily`

Type: table

Primary key: `snapshot_date`, `season_id`, `game_type`, `endpoint_family`, `endpoint_variant`, `entity_type`, `entity_id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `snapshot_date` | date | no |  |
| `season_id` | bigint | no |  |
| `game_type` | smallint | no | 2 |
| `entity_type` | text | no |  |
| `entity_id` | bigint | no |  |
| `entity_slug` | text | yes |  |
| `entity_name` | text | yes |  |
| `team_id` | bigint | yes |  |
| `team_abbreviation` | text | yes |  |
| `endpoint_family` | text | no |  |
| `endpoint_variant` | text | no | ''::text |
| `rank_order` | integer | no | 0 |
| `source` | text | no | 'nhl-edge'::text |
| `source_url` | text | no |  |
| `payload` | jsonb | no | '{}'::jsonb |
| `metadata` | jsonb | no | '{}'::jsonb |
| `created_at` | timestamp with time zone | no | timezone('utc'::text, now()) |
| `updated_at` | timestamp with time zone | no | timezone('utc'::text, now()) |

## `public.nhl_names`

Type: table

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `nhl_player_id` | text | yes |  |
| `player_name` | text | yes |  |
| `first_name` | text | yes |  |
| `last_name` | text | yes |  |

## `public.nst_att_def_scores`

Type: view

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `team_abbreviation` | text | yes |  |
| `team_name` | text | yes |  |
| `att_score_pp` | numeric | yes |  |
| `att_score_pk` | numeric | yes |  |
| `att_score_all` | numeric | yes |  |
| `att_score_5v5` | numeric | yes |  |
| `def_score_pp` | numeric | yes |  |
| `def_score_pk` | numeric | yes |  |
| `def_score_all` | numeric | yes |  |
| `def_score_5v5` | numeric | yes |  |
| `pp_toi_diff` | numeric | yes |  |
| `pk_toi_diff` | numeric | yes |  |
| `all_toi_diff` | numeric | yes |  |
| `5v5_toi_diff` | numeric | yes |  |
| `att_advantage_pp` | numeric | yes |  |
| `att_advantage_pk` | numeric | yes |  |
| `att_advantage_all` | numeric | yes |  |
| `att_advantage_5v5` | numeric | yes |  |
| `def_advantage_pp` | numeric | yes |  |
| `def_advantage_pk` | numeric | yes |  |
| `def_advantage_all` | numeric | yes |  |
| `def_advantage_5v5` | numeric | yes |  |

## `public.nst_avg_5v5`

Type: view

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `team_abbreviation` | text | yes |  |
| `team_name` | text | yes |  |
| `gp` | bigint | yes |  |
| `toi` | bigint | yes |  |
| `w` | bigint | yes |  |
| `l` | bigint | yes |  |
| `otl` | bigint | yes |  |
| `points` | bigint | yes |  |
| `cf` | bigint | yes |  |
| `ca` | bigint | yes |  |
| `cf_pct` | double precision | yes |  |
| `ff` | bigint | yes |  |
| `fa` | bigint | yes |  |
| `ff_pct` | double precision | yes |  |
| `sf` | bigint | yes |  |
| `sa` | bigint | yes |  |
| `sf_pct` | double precision | yes |  |
| `gf` | bigint | yes |  |
| `ga` | bigint | yes |  |
| `gf_pct` | double precision | yes |  |
| `xgf` | double precision | yes |  |
| `xga` | double precision | yes |  |
| `xgf_pct` | double precision | yes |  |
| `scf` | bigint | yes |  |
| `sca` | bigint | yes |  |
| `scf_pct` | double precision | yes |  |
| `hdcf` | bigint | yes |  |
| `hdca` | bigint | yes |  |
| `hdcf_pct` | double precision | yes |  |
| `hdsf` | bigint | yes |  |
| `hdsa` | bigint | yes |  |
| `hdsf_pct` | double precision | yes |  |
| `hdgf` | bigint | yes |  |
| `hdga` | bigint | yes |  |
| `hdgf_pct` | double precision | yes |  |
| `sh_pct` | double precision | yes |  |
| `sv_pct` | double precision | yes |  |
| `pdo` | numeric | yes |  |

## `public.nst_avg_all`

Type: view

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `team_abbreviation` | text | yes |  |
| `team_name` | text | yes |  |
| `gp` | bigint | yes |  |
| `toi` | bigint | yes |  |
| `w` | bigint | yes |  |
| `l` | bigint | yes |  |
| `otl` | bigint | yes |  |
| `points` | bigint | yes |  |
| `cf` | bigint | yes |  |
| `ca` | bigint | yes |  |
| `cf_pct` | double precision | yes |  |
| `ff` | bigint | yes |  |
| `fa` | bigint | yes |  |
| `ff_pct` | double precision | yes |  |
| `sf` | bigint | yes |  |
| `sa` | bigint | yes |  |
| `sf_pct` | double precision | yes |  |
| `gf` | bigint | yes |  |
| `ga` | bigint | yes |  |
| `gf_pct` | double precision | yes |  |
| `xgf` | double precision | yes |  |
| `xga` | double precision | yes |  |
| `xgf_pct` | double precision | yes |  |
| `scf` | bigint | yes |  |
| `sca` | bigint | yes |  |
| `scf_pct` | double precision | yes |  |
| `hdcf` | bigint | yes |  |
| `hdca` | bigint | yes |  |
| `hdcf_pct` | double precision | yes |  |
| `hdsf` | bigint | yes |  |
| `hdsa` | bigint | yes |  |
| `hdsf_pct` | double precision | yes |  |
| `hdgf` | bigint | yes |  |
| `hdga` | bigint | yes |  |
| `hdgf_pct` | double precision | yes |  |
| `sh_pct` | double precision | yes |  |
| `sv_pct` | double precision | yes |  |
| `pdo` | numeric | yes |  |

## `public.nst_avg_pk`

Type: view

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `team_abbreviation` | text | yes |  |
| `team_name` | text | yes |  |
| `gp` | bigint | yes |  |
| `toi` | bigint | yes |  |
| `w` | bigint | yes |  |
| `l` | bigint | yes |  |
| `otl` | bigint | yes |  |
| `points` | bigint | yes |  |
| `cf` | bigint | yes |  |
| `ca` | bigint | yes |  |
| `cf_pct` | double precision | yes |  |
| `ff` | bigint | yes |  |
| `fa` | bigint | yes |  |
| `ff_pct` | double precision | yes |  |
| `sf` | bigint | yes |  |
| `sa` | bigint | yes |  |
| `sf_pct` | double precision | yes |  |
| `gf` | bigint | yes |  |
| `ga` | bigint | yes |  |
| `gf_pct` | double precision | yes |  |
| `xgf` | double precision | yes |  |
| `xga` | double precision | yes |  |
| `xgf_pct` | double precision | yes |  |
| `scf` | bigint | yes |  |
| `sca` | bigint | yes |  |
| `scf_pct` | double precision | yes |  |
| `hdcf` | bigint | yes |  |
| `hdca` | bigint | yes |  |
| `hdcf_pct` | double precision | yes |  |
| `hdsf` | bigint | yes |  |
| `hdsa` | bigint | yes |  |
| `hdsf_pct` | double precision | yes |  |
| `hdgf` | bigint | yes |  |
| `hdga` | bigint | yes |  |
| `hdgf_pct` | double precision | yes |  |
| `sh_pct` | double precision | yes |  |
| `sv_pct` | double precision | yes |  |
| `pdo` | numeric | yes |  |

## `public.nst_avg_pp`

Type: view

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `team_abbreviation` | text | yes |  |
| `team_name` | text | yes |  |
| `gp` | bigint | yes |  |
| `toi` | bigint | yes |  |
| `w` | bigint | yes |  |
| `l` | bigint | yes |  |
| `otl` | bigint | yes |  |
| `points` | bigint | yes |  |
| `cf` | bigint | yes |  |
| `ca` | bigint | yes |  |
| `cf_pct` | double precision | yes |  |
| `ff` | bigint | yes |  |
| `fa` | bigint | yes |  |
| `ff_pct` | double precision | yes |  |
| `sf` | bigint | yes |  |
| `sa` | bigint | yes |  |
| `sf_pct` | double precision | yes |  |
| `gf` | bigint | yes |  |
| `ga` | bigint | yes |  |
| `gf_pct` | double precision | yes |  |
| `xgf` | double precision | yes |  |
| `xga` | double precision | yes |  |
| `xgf_pct` | double precision | yes |  |
| `scf` | bigint | yes |  |
| `sca` | bigint | yes |  |
| `scf_pct` | double precision | yes |  |
| `hdcf` | bigint | yes |  |
| `hdca` | bigint | yes |  |
| `hdcf_pct` | double precision | yes |  |
| `hdsf` | bigint | yes |  |
| `hdsa` | bigint | yes |  |
| `hdsf_pct` | double precision | yes |  |
| `hdgf` | bigint | yes |  |
| `hdga` | bigint | yes |  |
| `hdgf_pct` | double precision | yes |  |
| `sh_pct` | double precision | yes |  |
| `sv_pct` | double precision | yes |  |
| `pdo` | numeric | yes |  |

## `public.nst_gamelog_as_counts`

Type: table

Primary key: `id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `id` | bigint | no | nextval('nst_gamelog_as_counts_id_seq'::regclass) |
| `player_id` | bigint | no |  |
| `season` | integer | no |  |
| `date_scraped` | date | no |  |
| `gp` | smallint | yes |  |
| `toi` | integer | yes |  |
| `goals` | smallint | yes |  |
| `total_assists` | smallint | yes |  |
| `first_assists` | smallint | yes |  |
| `second_assists` | smallint | yes |  |
| `total_points` | smallint | yes |  |
| `shots` | smallint | yes |  |
| `ixg` | double precision | yes |  |
| `icf` | smallint | yes |  |
| `iff` | smallint | yes |  |
| `iscfs` | smallint | yes |  |
| `hdcf` | smallint | yes |  |
| `rush_attempts` | smallint | yes |  |
| `rebounds_created` | smallint | yes |  |
| `pim` | smallint | yes |  |
| `total_penalties` | smallint | yes |  |
| `minor_penalties` | smallint | yes |  |
| `major_penalties` | smallint | yes |  |
| `misconduct_penalties` | smallint | yes |  |
| `penalties_drawn` | smallint | yes |  |
| `giveaways` | smallint | yes |  |
| `takeaways` | smallint | yes |  |
| `hits` | smallint | yes |  |
| `hits_taken` | smallint | yes |  |
| `shots_blocked` | smallint | yes |  |
| `faceoffs_won` | smallint | yes |  |
| `faceoffs_lost` | smallint | yes |  |
| `ipp` | numeric | yes |  |
| `faceoffs_percentage` | double precision | yes |  |
| `sh_percentage` | double precision | yes |  |

## `public.nst_gamelog_as_counts_oi`

Type: table

Primary key: `id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `player_id` | integer | no |  |
| `gp` | integer | yes |  |
| `cf` | integer | yes |  |
| `ca` | integer | yes |  |
| `cf_pct` | double precision | yes |  |
| `ff` | integer | yes |  |
| `fa` | integer | yes |  |
| `ff_pct` | double precision | yes |  |
| `sf` | integer | yes |  |
| `sa` | integer | yes |  |
| `sf_pct` | double precision | yes |  |
| `gf` | integer | yes |  |
| `ga` | integer | yes |  |
| `gf_pct` | double precision | yes |  |
| `xgf` | double precision | yes |  |
| `xga` | double precision | yes |  |
| `xgf_pct` | double precision | yes |  |
| `scf` | integer | yes |  |
| `sca` | integer | yes |  |
| `scf_pct` | double precision | yes |  |
| `hdcf` | integer | yes |  |
| `hdca` | integer | yes |  |
| `hdcf_pct` | double precision | yes |  |
| `hdgf` | integer | yes |  |
| `mdcf` | integer | yes |  |
| `mdca` | integer | yes |  |
| `mdcf_pct` | double precision | yes |  |
| `mdgf` | integer | yes |  |
| `mdga` | integer | yes |  |
| `mdgf_pct` | double precision | yes |  |
| `ldcf` | integer | yes |  |
| `ldca` | integer | yes |  |
| `ldcf_pct` | double precision | yes |  |
| `ldgf` | integer | yes |  |
| `ldga` | integer | yes |  |
| `ldgf_pct` | double precision | yes |  |
| `on_ice_sh_pct` | double precision | yes |  |
| `on_ice_sv_pct` | double precision | yes |  |
| `off_zone_starts` | integer | yes |  |
| `neu_zone_starts` | integer | yes |  |
| `def_zone_starts` | integer | yes |  |
| `off_zone_start_pct` | double precision | yes |  |
| `off_zone_faceoffs` | integer | yes |  |
| `neu_zone_faceoffs` | integer | yes |  |
| `def_zone_faceoffs` | integer | yes |  |
| `off_zone_faceoff_pct` | double precision | yes |  |
| `date_scraped` | date | no |  |
| `season` | integer | no |  |
| `toi` | integer | yes |  |
| `pdo` | double precision | yes |  |
| `hdga` | double precision | yes |  |
| `hdgf_pct` | double precision | yes |  |
| `id` | bigint | no | nextval('nst_gamelog_as_counts_oi_id_seq'::regclass) |
| `shots_blocked` | integer | yes |  |
| `on_the_fly_starts` | double precision | yes |  |

## `public.nst_gamelog_as_rates`

Type: table

Primary key: `id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `id` | bigint | no | nextval('nst_gamelog_as_rates_id_seq'::regclass) |
| `player_id` | bigint | no |  |
| `season` | integer | no |  |
| `date_scraped` | date | no |  |
| `gp` | smallint | yes |  |
| `toi` | integer | yes |  |
| `toi_per_gp` | double precision | yes |  |
| `icf_per_60` | double precision | yes |  |
| `hdcf_per_60` | double precision | yes |  |
| `goals_per_60` | numeric | yes |  |
| `total_assists_per_60` | numeric | yes |  |
| `first_assists_per_60` | numeric | yes |  |
| `second_assists_per_60` | numeric | yes |  |
| `shots_per_60` | numeric | yes |  |
| `ixg_per_60` | numeric | yes |  |
| `iff_per_60` | numeric | yes |  |
| `rush_attempts_per_60` | numeric | yes |  |
| `rebounds_created_per_60` | numeric | yes |  |
| `pim_per_60` | numeric | yes |  |
| `penalties_drawn_per_60` | numeric | yes |  |
| `giveaways_per_60` | numeric | yes |  |
| `takeaways_per_60` | numeric | yes |  |
| `hits_per_60` | numeric | yes |  |
| `shots_blocked_per_60` | numeric | yes |  |
| `faceoffs_won_per_60` | numeric | yes |  |
| `faceoffs_lost_per_60` | numeric | yes |  |
| `hits_taken_per_60` | numeric | yes |  |
| `total_points_per_60` | numeric | yes |  |
| `iscfs_per_60` | numeric | yes |  |
| `ipp` | double precision | yes |  |
| `sh_percentage` | double precision | yes |  |
| `faceoffs_percentage` | double precision | yes |  |
| `major_penalties_per_60` | double precision | yes |  |
| `minor_penalties_per_60` | double precision | yes |  |
| `misconduct_penalties_per_60` | double precision | yes |  |
| `total_penalties_per_60` | double precision | yes |  |

## `public.nst_gamelog_as_rates_oi`

Type: table

Primary key: `id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `player_id` | bigint | no |  |
| `position` | text | yes |  |
| `gp` | integer | yes |  |
| `toi` | integer | yes |  |
| `toi_per_gp` | double precision | yes |  |
| `cf_per_60` | double precision | yes |  |
| `ca_per_60` | double precision | yes |  |
| `cf_pct` | double precision | yes |  |
| `ff_per_60` | double precision | yes |  |
| `fa_per_60` | double precision | yes |  |
| `ff_pct` | double precision | yes |  |
| `sf_per_60` | double precision | yes |  |
| `sa_per_60` | double precision | yes |  |
| `sf_pct` | double precision | yes |  |
| `gf_per_60` | double precision | yes |  |
| `ga_per_60` | double precision | yes |  |
| `gf_pct` | double precision | yes |  |
| `xgf_per_60` | double precision | yes |  |
| `xga_per_60` | double precision | yes |  |
| `xgf_pct` | double precision | yes |  |
| `scf_per_60` | double precision | yes |  |
| `sca_per_60` | double precision | yes |  |
| `scf_pct` | double precision | yes |  |
| `hdcf_per_60` | double precision | yes |  |
| `hdca_per_60` | double precision | yes |  |
| `hdcf_pct` | double precision | yes |  |
| `hdgf_per_60` | double precision | yes |  |
| `hdga_per_60` | double precision | yes |  |
| `hdgf_pct` | double precision | yes |  |
| `mdcf_per_60` | double precision | yes |  |
| `mdca_per_60` | double precision | yes |  |
| `mdcf_pct` | double precision | yes |  |
| `mdgf_per_60` | double precision | yes |  |
| `mdga_per_60` | double precision | yes |  |
| `mdgf_pct` | double precision | yes |  |
| `ldcf_per_60` | double precision | yes |  |
| `ldca_per_60` | double precision | yes |  |
| `ldcf_pct` | double precision | yes |  |
| `ldgf_per_60` | double precision | yes |  |
| `ldga_per_60` | double precision | yes |  |
| `ldgf_pct` | double precision | yes |  |
| `on_ice_sh_pct` | double precision | yes |  |
| `on_ice_sv_pct` | double precision | yes |  |
| `pdo` | double precision | yes |  |
| `off_zone_starts_per_60` | double precision | yes |  |
| `neu_zone_starts_per_60` | double precision | yes |  |
| `def_zone_starts_per_60` | double precision | yes |  |
| `off_zone_start_pct` | double precision | yes |  |
| `off_zone_faceoffs_per_60` | double precision | yes |  |
| `neu_zone_faceoffs_per_60` | double precision | yes |  |
| `def_zone_faceoffs_per_60` | double precision | yes |  |
| `off_zone_faceoff_pct` | double precision | yes |  |
| `date_scraped` | date | no |  |
| `season` | integer | no |  |
| `id` | bigint | no | nextval('nst_gamelog_as_rates_oi_id_seq'::regclass) |

## `public.nst_gamelog_es_counts`

Type: table

Primary key: `id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `id` | integer | no | nextval('nst_gamelog_es_counts_id_seq'::regclass) |
| `player_id` | bigint | no |  |
| `season` | integer | no |  |
| `date_scraped` | date | no |  |
| `gp` | integer | yes |  |
| `toi` | integer | yes |  |
| `goals` | integer | yes |  |
| `total_assists` | integer | yes |  |
| `first_assists` | integer | yes |  |
| `second_assists` | integer | yes |  |
| `total_points` | integer | yes |  |
| `rush_attempts` | integer | yes |  |
| `rebounds_created` | integer | yes |  |
| `pim` | integer | yes |  |
| `total_penalties` | integer | yes |  |
| `minor_penalties` | integer | yes |  |
| `major_penalties` | integer | yes |  |
| `misconduct_penalties` | integer | yes |  |
| `penalties_drawn` | integer | yes |  |
| `giveaways` | integer | yes |  |
| `takeaways` | integer | yes |  |
| `hits` | integer | yes |  |
| `hits_taken` | integer | yes |  |
| `shots_blocked` | integer | yes |  |
| `faceoffs_won` | integer | yes |  |
| `faceoffs_lost` | integer | yes |  |
| `cf` | integer | yes |  |
| `ca` | integer | yes |  |
| `ff` | integer | yes |  |
| `fa` | integer | yes |  |
| `sf` | integer | yes |  |
| `sa` | integer | yes |  |
| `gf` | integer | yes |  |
| `ga` | integer | yes |  |
| `xgf` | integer | yes |  |
| `xga` | integer | yes |  |
| `scf` | integer | yes |  |
| `sca` | integer | yes |  |
| `hdca` | integer | yes |  |
| `hdgf` | integer | yes |  |
| `hdga` | integer | yes |  |
| `mdcf` | integer | yes |  |
| `mdca` | integer | yes |  |
| `mdgf` | integer | yes |  |
| `mdga` | integer | yes |  |
| `ldcf` | integer | yes |  |
| `ldca` | integer | yes |  |
| `ldgf` | integer | yes |  |
| `ldga` | integer | yes |  |
| `pdo` | integer | yes |  |
| `off_zone_starts` | integer | yes |  |
| `neu_zone_starts` | integer | yes |  |
| `def_zone_starts` | integer | yes |  |
| `off_zone_faceoffs` | integer | yes |  |
| `neu_zone_faceoffs` | integer | yes |  |
| `def_zone_faceoffs` | integer | yes |  |
| `created_at` | timestamp with time zone | yes | CURRENT_TIMESTAMP |
| `faceoffs_percentage` | double precision | yes |  |
| `shots` | integer | yes |  |
| `icf` | integer | yes |  |
| `iff` | integer | yes |  |
| `iscfs` | integer | yes |  |
| `hdcf` | integer | yes |  |
| `toi_per_gp` | double precision | yes |  |
| `goals_per_60` | double precision | yes |  |
| `total_assists_per_60` | double precision | yes |  |
| `first_assists_per_60` | double precision | yes |  |
| `second_assists_per_60` | double precision | yes |  |
| `total_points_per_60` | double precision | yes |  |
| `ipp` | double precision | yes |  |
| `shots_per_60` | double precision | yes |  |
| `sh_percentage` | double precision | yes |  |
| `ixg` | double precision | yes |  |
| `ixg_per_60` | double precision | yes |  |
| `icf_per_60` | double precision | yes |  |
| `iff_per_60` | double precision | yes |  |
| `iscfs_per_60` | double precision | yes |  |
| `hdcf_per_60` | double precision | yes |  |
| `rush_attempts_per_60` | double precision | yes |  |
| `rebounds_created_per_60` | double precision | yes |  |
| `pim_per_60` | double precision | yes |  |
| `total_penalties_per_60` | double precision | yes |  |
| `minor_penalties_per_60` | double precision | yes |  |
| `major_penalties_per_60` | double precision | yes |  |
| `misconduct_penalties_per_60` | double precision | yes |  |
| `penalties_drawn_per_60` | double precision | yes |  |
| `giveaways_per_60` | double precision | yes |  |
| `takeaways_per_60` | double precision | yes |  |
| `hits_per_60` | double precision | yes |  |
| `hits_taken_per_60` | double precision | yes |  |
| `shots_blocked_per_60` | double precision | yes |  |
| `faceoffs_won_per_60` | double precision | yes |  |
| `faceoffs_lost_per_60` | double precision | yes |  |
| `cf_pct` | double precision | yes |  |
| `ff_pct` | double precision | yes |  |
| `sf_pct` | double precision | yes |  |
| `gf_pct` | double precision | yes |  |
| `xgf_pct` | double precision | yes |  |
| `xga_pct` | double precision | yes |  |
| `scf_pct` | double precision | yes |  |
| `hdcf_pct` | double precision | yes |  |
| `hdgf_pct` | double precision | yes |  |
| `mdcf_pct` | double precision | yes |  |
| `mdgf_pct` | double precision | yes |  |
| `ldcf_pct` | double precision | yes |  |
| `ldgf_pct` | double precision | yes |  |
| `on_ice_sh_pct` | double precision | yes |  |
| `on_ice_sv_pct` | double precision | yes |  |
| `off_zone_start_pct` | double precision | yes |  |
| `off_zone_faceoff_pct` | double precision | yes |  |
| `cf_per_60` | double precision | yes |  |
| `ca_per_60` | double precision | yes |  |
| `ff_per_60` | double precision | yes |  |
| `fa_per_60` | double precision | yes |  |
| `sf_per_60` | double precision | yes |  |
| `sa_per_60` | double precision | yes |  |
| `gf_per_60` | double precision | yes |  |
| `ga_per_60` | double precision | yes |  |
| `xgf_per_60` | double precision | yes |  |
| `xga_per_60` | double precision | yes |  |
| `scf_per_60` | double precision | yes |  |
| `sca_per_60` | double precision | yes |  |
| `hdca_per_60` | double precision | yes |  |
| `hdgf_per_60` | double precision | yes |  |
| `hdga_per_60` | double precision | yes |  |
| `mdcf_per_60` | double precision | yes |  |
| `mdca_per_60` | double precision | yes |  |
| `mdgf_per_60` | double precision | yes |  |
| `mdga_per_60` | double precision | yes |  |
| `ldcf_per_60` | double precision | yes |  |
| `ldca_per_60` | double precision | yes |  |
| `ldgf_per_60` | double precision | yes |  |
| `ldga_per_60` | double precision | yes |  |
| `on_ice_sh_pct_per_60` | double precision | yes |  |
| `on_ice_sv_pct_per_60` | double precision | yes |  |
| `pdo_per_60` | double precision | yes |  |
| `off_zone_starts_per_60` | double precision | yes |  |
| `neu_zone_starts_per_60` | double precision | yes |  |
| `def_zone_starts_per_60` | double precision | yes |  |
| `off_zone_start_pct_per_60` | double precision | yes |  |
| `off_zone_faceoffs_per_60` | double precision | yes |  |
| `neu_zone_faceoffs_per_60` | double precision | yes |  |
| `def_zone_faceoffs_per_60` | double precision | yes |  |

## `public.nst_gamelog_es_counts_oi`

Type: table

Primary key: `id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `id` | integer | no | nextval('nst_gamelog_es_counts_oi_id_seq'::regclass) |
| `player_id` | bigint | no |  |
| `season` | integer | no |  |
| `date_scraped` | date | no |  |
| `gp` | integer | yes |  |
| `toi` | integer | yes |  |
| `goals` | integer | yes |  |
| `total_assists` | integer | yes |  |
| `first_assists` | integer | yes |  |
| `second_assists` | integer | yes |  |
| `total_points` | integer | yes |  |
| `rush_attempts` | integer | yes |  |
| `rebounds_created` | integer | yes |  |
| `pim` | integer | yes |  |
| `total_penalties` | integer | yes |  |
| `minor_penalties` | integer | yes |  |
| `major_penalties` | integer | yes |  |
| `misconduct_penalties` | integer | yes |  |
| `penalties_drawn` | integer | yes |  |
| `giveaways` | integer | yes |  |
| `takeaways` | integer | yes |  |
| `hits` | integer | yes |  |
| `hits_taken` | integer | yes |  |
| `cf` | integer | yes |  |
| `ca` | integer | yes |  |
| `ff` | integer | yes |  |
| `fa` | integer | yes |  |
| `sf` | integer | yes |  |
| `sa` | integer | yes |  |
| `gf` | double precision | yes |  |
| `ga` | double precision | yes |  |
| `xgf` | double precision | yes |  |
| `xga` | double precision | yes |  |
| `scf` | double precision | yes |  |
| `sca` | double precision | yes |  |
| `hdca` | double precision | yes |  |
| `hdgf` | integer | yes |  |
| `hdga` | integer | yes |  |
| `mdcf` | integer | yes |  |
| `mdca` | integer | yes |  |
| `mdgf` | integer | yes |  |
| `mdga` | integer | yes |  |
| `ldcf` | integer | yes |  |
| `ldca` | integer | yes |  |
| `ldgf` | integer | yes |  |
| `ldga` | integer | yes |  |
| `pdo` | double precision | yes |  |
| `off_zone_starts` | integer | yes |  |
| `neu_zone_starts` | integer | yes |  |
| `def_zone_starts` | integer | yes |  |
| `off_zone_faceoffs` | integer | yes |  |
| `neu_zone_faceoffs` | integer | yes |  |
| `def_zone_faceoffs` | integer | yes |  |
| `created_at` | timestamp with time zone | yes | CURRENT_TIMESTAMP |
| `cf_pct` | double precision | yes |  |
| `shots` | integer | yes |  |
| `icf` | integer | yes |  |
| `iff` | integer | yes |  |
| `iscfs` | integer | yes |  |
| `hdcf` | integer | yes |  |
| `toi_per_gp` | double precision | yes |  |
| `goals_per_60` | double precision | yes |  |
| `total_assists_per_60` | double precision | yes |  |
| `first_assists_per_60` | double precision | yes |  |
| `second_assists_per_60` | double precision | yes |  |
| `total_points_per_60` | double precision | yes |  |
| `ipp` | double precision | yes |  |
| `shots_per_60` | double precision | yes |  |
| `sh_percentage` | double precision | yes |  |
| `ixg` | double precision | yes |  |
| `ixg_per_60` | double precision | yes |  |
| `icf_per_60` | double precision | yes |  |
| `iff_per_60` | double precision | yes |  |
| `iscfs_per_60` | double precision | yes |  |
| `hdcf_per_60` | double precision | yes |  |
| `rush_attempts_per_60` | double precision | yes |  |
| `rebounds_created_per_60` | double precision | yes |  |
| `pim_per_60` | double precision | yes |  |
| `total_penalties_per_60` | double precision | yes |  |
| `minor_penalties_per_60` | double precision | yes |  |
| `major_penalties_per_60` | double precision | yes |  |
| `misconduct_penalties_per_60` | double precision | yes |  |
| `penalties_drawn_per_60` | double precision | yes |  |
| `giveaways_per_60` | double precision | yes |  |
| `takeaways_per_60` | double precision | yes |  |
| `hits_per_60` | double precision | yes |  |
| `hits_taken_per_60` | double precision | yes |  |
| `shots_blocked_per_60` | double precision | yes |  |
| `faceoffs_won_per_60` | double precision | yes |  |
| `faceoffs_lost_per_60` | double precision | yes |  |
| `faceoffs_percentage` | double precision | yes |  |
| `ff_pct` | double precision | yes |  |
| `sf_pct` | double precision | yes |  |
| `gf_pct` | double precision | yes |  |
| `xgf_pct` | double precision | yes |  |
| `xga_pct` | double precision | yes |  |
| `scf_pct` | double precision | yes |  |
| `hdcf_pct` | double precision | yes |  |
| `hdgf_pct` | double precision | yes |  |
| `mdcf_pct` | double precision | yes |  |
| `mdgf_pct` | double precision | yes |  |
| `ldcf_pct` | double precision | yes |  |
| `ldgf_pct` | double precision | yes |  |
| `on_ice_sh_pct` | double precision | yes |  |
| `on_ice_sv_pct` | double precision | yes |  |
| `off_zone_start_pct` | double precision | yes |  |
| `off_zone_faceoff_pct` | double precision | yes |  |
| `cf_per_60` | double precision | yes |  |
| `ca_per_60` | double precision | yes |  |
| `ff_per_60` | double precision | yes |  |
| `fa_per_60` | double precision | yes |  |
| `sf_per_60` | double precision | yes |  |
| `sa_per_60` | double precision | yes |  |
| `gf_per_60` | double precision | yes |  |
| `ga_per_60` | double precision | yes |  |
| `xgf_per_60` | double precision | yes |  |
| `xga_per_60` | double precision | yes |  |
| `scf_per_60` | double precision | yes |  |
| `sca_per_60` | double precision | yes |  |
| `hdca_per_60` | double precision | yes |  |
| `hdgf_per_60` | double precision | yes |  |
| `hdga_per_60` | double precision | yes |  |
| `mdcf_per_60` | double precision | yes |  |
| `mdca_per_60` | double precision | yes |  |
| `mdgf_per_60` | double precision | yes |  |
| `mdga_per_60` | double precision | yes |  |
| `ldcf_per_60` | double precision | yes |  |
| `ldca_per_60` | double precision | yes |  |
| `ldgf_per_60` | double precision | yes |  |
| `ldga_per_60` | double precision | yes |  |
| `on_ice_sh_pct_per_60` | double precision | yes |  |
| `on_ice_sv_pct_per_60` | double precision | yes |  |
| `pdo_per_60` | double precision | yes |  |
| `off_zone_starts_per_60` | double precision | yes |  |
| `neu_zone_starts_per_60` | double precision | yes |  |
| `def_zone_starts_per_60` | double precision | yes |  |
| `off_zone_start_pct_per_60` | double precision | yes |  |
| `off_zone_faceoffs_per_60` | double precision | yes |  |
| `neu_zone_faceoffs_per_60` | double precision | yes |  |
| `def_zone_faceoffs_per_60` | double precision | yes |  |
| `on_the_fly_starts` | double precision | yes |  |

## `public.nst_gamelog_es_rates`

Type: table

Primary key: `id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `id` | integer | no | nextval('nst_gamelog_es_rates_id_seq'::regclass) |
| `player_id` | bigint | no |  |
| `season` | integer | no |  |
| `date_scraped` | date | no |  |
| `toi_per_gp` | double precision | yes |  |
| `goals_per_60` | double precision | yes |  |
| `total_assists_per_60` | double precision | yes |  |
| `first_assists_per_60` | double precision | yes |  |
| `second_assists_per_60` | double precision | yes |  |
| `total_points_per_60` | double precision | yes |  |
| `ipp` | double precision | yes |  |
| `shots_per_60` | double precision | yes |  |
| `sh_percentage` | double precision | yes |  |
| `ixg_per_60` | double precision | yes |  |
| `icf_per_60` | double precision | yes |  |
| `iff_per_60` | double precision | yes |  |
| `iscfs_per_60` | double precision | yes |  |
| `hdcf_per_60` | double precision | yes |  |
| `rush_attempts_per_60` | double precision | yes |  |
| `rebounds_created_per_60` | double precision | yes |  |
| `pim_per_60` | double precision | yes |  |
| `total_penalties_per_60` | double precision | yes |  |
| `minor_penalties_per_60` | double precision | yes |  |
| `major_penalties_per_60` | double precision | yes |  |
| `misconduct_penalties_per_60` | double precision | yes |  |
| `penalties_drawn_per_60` | double precision | yes |  |
| `giveaways_per_60` | double precision | yes |  |
| `takeaways_per_60` | double precision | yes |  |
| `hits_per_60` | double precision | yes |  |
| `hits_taken_per_60` | double precision | yes |  |
| `shots_blocked_per_60` | double precision | yes |  |
| `faceoffs_won_per_60` | double precision | yes |  |
| `faceoffs_lost_per_60` | double precision | yes |  |
| `faceoffs_percentage` | double precision | yes |  |
| `created_at` | timestamp with time zone | yes | CURRENT_TIMESTAMP |
| `gp` | integer | yes |  |
| `toi` | integer | yes |  |

## `public.nst_gamelog_es_rates_oi`

Type: table

Primary key: `id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `id` | integer | no | nextval('nst_gamelog_es_rates_oi_id_seq'::regclass) |
| `player_id` | bigint | no |  |
| `season` | integer | no |  |
| `date_scraped` | date | no |  |
| `toi_per_gp` | double precision | yes |  |
| `goals_per_60` | double precision | yes |  |
| `total_assists_per_60` | double precision | yes |  |
| `first_assists_per_60` | double precision | yes |  |
| `second_assists_per_60` | double precision | yes |  |
| `total_points_per_60` | double precision | yes |  |
| `ipp` | double precision | yes |  |
| `shots` | integer | yes |  |
| `shots_per_60` | double precision | yes |  |
| `sh_percentage` | double precision | yes |  |
| `ixg` | double precision | yes |  |
| `ixg_per_60` | double precision | yes |  |
| `icf` | double precision | yes |  |
| `icf_per_60` | double precision | yes |  |
| `iff` | double precision | yes |  |
| `iff_per_60` | double precision | yes |  |
| `iscfs` | double precision | yes |  |
| `iscfs_per_60` | double precision | yes |  |
| `hdcf` | double precision | yes |  |
| `hdcf_per_60` | double precision | yes |  |
| `rush_attempts_per_60` | double precision | yes |  |
| `rebounds_created_per_60` | double precision | yes |  |
| `pim_per_60` | double precision | yes |  |
| `total_penalties_per_60` | double precision | yes |  |
| `minor_penalties_per_60` | double precision | yes |  |
| `major_penalties_per_60` | double precision | yes |  |
| `misconduct_penalties_per_60` | double precision | yes |  |
| `penalties_drawn_per_60` | double precision | yes |  |
| `giveaways_per_60` | double precision | yes |  |
| `takeaways_per_60` | double precision | yes |  |
| `hits_per_60` | double precision | yes |  |
| `hits_taken_per_60` | double precision | yes |  |
| `shots_blocked_per_60` | double precision | yes |  |
| `faceoffs_won_per_60` | double precision | yes |  |
| `faceoffs_lost_per_60` | double precision | yes |  |
| `faceoffs_percentage` | double precision | yes |  |
| `cf_pct` | double precision | yes |  |
| `ca_per_60` | double precision | yes |  |
| `ff_pct` | double precision | yes |  |
| `fa_per_60` | double precision | yes |  |
| `sf_pct` | double precision | yes |  |
| `sa_per_60` | double precision | yes |  |
| `gf_pct` | double precision | yes |  |
| `ga_per_60` | double precision | yes |  |
| `xgf_per_60` | double precision | yes |  |
| `xga_per_60` | double precision | yes |  |
| `scf_per_60` | double precision | yes |  |
| `sca_per_60` | double precision | yes |  |
| `hdcf_pct` | double precision | yes |  |
| `hdgf_per_60` | double precision | yes |  |
| `hdga_per_60` | double precision | yes |  |
| `mdcf_per_60` | double precision | yes |  |
| `mdca_per_60` | double precision | yes |  |
| `mdgf_per_60` | double precision | yes |  |
| `mdga_per_60` | double precision | yes |  |
| `ldcf_per_60` | double precision | yes |  |
| `ldca_per_60` | double precision | yes |  |
| `ldgf_per_60` | double precision | yes |  |
| `ldga_per_60` | double precision | yes |  |
| `on_ice_sh_pct` | double precision | yes |  |
| `on_ice_sv_pct` | double precision | yes |  |
| `pdo_per_60` | double precision | yes |  |
| `off_zone_starts_per_60` | double precision | yes |  |
| `neu_zone_starts_per_60` | double precision | yes |  |
| `def_zone_starts_per_60` | double precision | yes |  |
| `off_zone_start_pct_per_60` | double precision | yes |  |
| `off_zone_faceoffs_per_60` | double precision | yes |  |
| `neu_zone_faceoffs_per_60` | double precision | yes |  |
| `def_zone_faceoffs_per_60` | double precision | yes |  |
| `created_at` | timestamp with time zone | yes | CURRENT_TIMESTAMP |
| `cf_per_60` | double precision | yes |  |
| `gp` | integer | yes |  |
| `goals` | integer | yes |  |
| `total_assists` | integer | yes |  |
| `first_assists` | integer | yes |  |
| `second_assists` | integer | yes |  |
| `total_points` | integer | yes |  |
| `rush_attempts` | integer | yes |  |
| `rebounds_created` | integer | yes |  |
| `pim` | integer | yes |  |
| `total_penalties` | integer | yes |  |
| `minor_penalties` | integer | yes |  |
| `major_penalties` | integer | yes |  |
| `misconduct_penalties` | integer | yes |  |
| `penalties_drawn` | integer | yes |  |
| `giveaways` | integer | yes |  |
| `takeaways` | integer | yes |  |
| `hits` | integer | yes |  |
| `hits_taken` | integer | yes |  |
| `shots_blocked` | integer | yes |  |
| `faceoffs_won` | integer | yes |  |
| `faceoffs_lost` | integer | yes |  |
| `cf` | integer | yes |  |
| `ca` | integer | yes |  |
| `ff` | integer | yes |  |
| `fa` | integer | yes |  |
| `sf` | integer | yes |  |
| `sa` | integer | yes |  |
| `gf` | integer | yes |  |
| `ga` | integer | yes |  |
| `scf` | integer | yes |  |
| `sca` | integer | yes |  |
| `hdca` | integer | yes |  |
| `hdgf` | integer | yes |  |
| `hdga` | integer | yes |  |
| `mdcf` | integer | yes |  |
| `mdca` | integer | yes |  |
| `mdgf` | integer | yes |  |
| `mdga` | integer | yes |  |
| `ldcf` | integer | yes |  |
| `ldca` | integer | yes |  |
| `ldgf` | integer | yes |  |
| `ldga` | integer | yes |  |
| `off_zone_starts` | integer | yes |  |
| `neu_zone_starts` | integer | yes |  |
| `def_zone_starts` | integer | yes |  |
| `off_zone_faceoffs` | integer | yes |  |
| `neu_zone_faceoffs` | integer | yes |  |
| `def_zone_faceoffs` | integer | yes |  |
| `toi` | integer | yes |  |
| `xgf` | double precision | yes |  |
| `xgf_pct` | double precision | yes |  |
| `xga` | double precision | yes |  |
| `xga_pct` | double precision | yes |  |
| `scf_pct` | double precision | yes |  |
| `hdgf_pct` | double precision | yes |  |
| `mdcf_pct` | double precision | yes |  |
| `mdgf_pct` | double precision | yes |  |
| `ldcf_pct` | double precision | yes |  |
| `ldgf_pct` | double precision | yes |  |
| `off_zone_start_pct` | double precision | yes |  |
| `off_zone_faceoff_pct` | double precision | yes |  |
| `ff_per_60` | double precision | yes |  |
| `sf_per_60` | double precision | yes |  |
| `gf_per_60` | double precision | yes |  |
| `hdca_per_60` | double precision | yes |  |
| `on_ice_sh_pct_per_60` | double precision | yes |  |
| `on_ice_sv_pct_per_60` | double precision | yes |  |
| `pdo` | double precision | yes |  |
| `on_the_fly_starts_per_60` | double precision | yes |  |

## `public.nst_gamelog_pk_counts`

Type: table

Primary key: `id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `id` | integer | no | nextval('nst_gamelog_pk_counts_id_seq'::regclass) |
| `player_id` | bigint | no |  |
| `season` | integer | no |  |
| `date_scraped` | date | no |  |
| `gp` | integer | yes |  |
| `toi` | integer | yes |  |
| `goals` | integer | yes |  |
| `total_assists` | integer | yes |  |
| `first_assists` | integer | yes |  |
| `second_assists` | integer | yes |  |
| `total_points` | integer | yes |  |
| `rush_attempts` | integer | yes |  |
| `rebounds_created` | integer | yes |  |
| `pim` | integer | yes |  |
| `total_penalties` | integer | yes |  |
| `minor_penalties` | integer | yes |  |
| `major_penalties` | integer | yes |  |
| `misconduct_penalties` | integer | yes |  |
| `penalties_drawn` | integer | yes |  |
| `giveaways` | integer | yes |  |
| `takeaways` | integer | yes |  |
| `hits` | integer | yes |  |
| `hits_taken` | integer | yes |  |
| `shots_blocked` | integer | yes |  |
| `faceoffs_won` | integer | yes |  |
| `faceoffs_lost` | integer | yes |  |
| `cf` | integer | yes |  |
| `ca` | integer | yes |  |
| `ff` | integer | yes |  |
| `fa` | integer | yes |  |
| `sf` | integer | yes |  |
| `sa` | integer | yes |  |
| `gf` | integer | yes |  |
| `ga` | integer | yes |  |
| `xgf` | integer | yes |  |
| `xga` | integer | yes |  |
| `scf` | integer | yes |  |
| `sca` | integer | yes |  |
| `hdca` | integer | yes |  |
| `hdgf` | integer | yes |  |
| `hdga` | integer | yes |  |
| `mdcf` | integer | yes |  |
| `mdca` | integer | yes |  |
| `mdgf` | integer | yes |  |
| `mdga` | integer | yes |  |
| `ldcf` | integer | yes |  |
| `ldca` | integer | yes |  |
| `ldgf` | integer | yes |  |
| `ldga` | integer | yes |  |
| `pdo` | integer | yes |  |
| `off_zone_starts` | integer | yes |  |
| `neu_zone_starts` | integer | yes |  |
| `def_zone_starts` | integer | yes |  |
| `off_zone_faceoffs` | integer | yes |  |
| `neu_zone_faceoffs` | integer | yes |  |
| `def_zone_faceoffs` | integer | yes |  |
| `created_at` | timestamp with time zone | yes | CURRENT_TIMESTAMP |
| `faceoffs_percentage` | double precision | yes |  |
| `shots` | integer | yes |  |
| `icf` | integer | yes |  |
| `iff` | integer | yes |  |
| `iscfs` | integer | yes |  |
| `hdcf` | integer | yes |  |
| `toi_per_gp` | double precision | yes |  |
| `goals_per_60` | double precision | yes |  |
| `total_assists_per_60` | double precision | yes |  |
| `first_assists_per_60` | double precision | yes |  |
| `second_assists_per_60` | double precision | yes |  |
| `total_points_per_60` | double precision | yes |  |
| `ipp` | double precision | yes |  |
| `shots_per_60` | double precision | yes |  |
| `sh_percentage` | double precision | yes |  |
| `ixg` | double precision | yes |  |
| `ixg_per_60` | double precision | yes |  |
| `icf_per_60` | double precision | yes |  |
| `iff_per_60` | double precision | yes |  |
| `iscfs_per_60` | double precision | yes |  |
| `hdcf_per_60` | double precision | yes |  |
| `rush_attempts_per_60` | double precision | yes |  |
| `rebounds_created_per_60` | double precision | yes |  |
| `pim_per_60` | double precision | yes |  |
| `total_penalties_per_60` | double precision | yes |  |
| `minor_penalties_per_60` | double precision | yes |  |
| `major_penalties_per_60` | double precision | yes |  |
| `misconduct_penalties_per_60` | double precision | yes |  |
| `penalties_drawn_per_60` | double precision | yes |  |
| `giveaways_per_60` | double precision | yes |  |
| `takeaways_per_60` | double precision | yes |  |
| `hits_per_60` | double precision | yes |  |
| `hits_taken_per_60` | double precision | yes |  |
| `shots_blocked_per_60` | double precision | yes |  |
| `faceoffs_won_per_60` | double precision | yes |  |
| `faceoffs_lost_per_60` | double precision | yes |  |
| `cf_pct` | double precision | yes |  |
| `ff_pct` | double precision | yes |  |
| `sf_pct` | double precision | yes |  |
| `gf_pct` | double precision | yes |  |
| `xgf_pct` | double precision | yes |  |
| `xga_pct` | double precision | yes |  |
| `scf_pct` | double precision | yes |  |
| `hdcf_pct` | double precision | yes |  |
| `hdgf_pct` | double precision | yes |  |
| `mdcf_pct` | double precision | yes |  |
| `mdgf_pct` | double precision | yes |  |
| `ldcf_pct` | double precision | yes |  |
| `ldgf_pct` | double precision | yes |  |
| `on_ice_sh_pct` | double precision | yes |  |
| `on_ice_sv_pct` | double precision | yes |  |
| `off_zone_start_pct` | double precision | yes |  |
| `off_zone_faceoff_pct` | double precision | yes |  |
| `cf_per_60` | double precision | yes |  |
| `ca_per_60` | double precision | yes |  |
| `ff_per_60` | double precision | yes |  |
| `fa_per_60` | double precision | yes |  |
| `sf_per_60` | double precision | yes |  |
| `sa_per_60` | double precision | yes |  |
| `gf_per_60` | double precision | yes |  |
| `ga_per_60` | double precision | yes |  |
| `xgf_per_60` | double precision | yes |  |
| `xga_per_60` | double precision | yes |  |
| `scf_per_60` | double precision | yes |  |
| `sca_per_60` | double precision | yes |  |
| `hdca_per_60` | double precision | yes |  |
| `hdgf_per_60` | double precision | yes |  |
| `hdga_per_60` | double precision | yes |  |
| `mdcf_per_60` | double precision | yes |  |
| `mdca_per_60` | double precision | yes |  |
| `mdgf_per_60` | double precision | yes |  |
| `mdga_per_60` | double precision | yes |  |
| `ldcf_per_60` | double precision | yes |  |
| `ldca_per_60` | double precision | yes |  |
| `ldgf_per_60` | double precision | yes |  |
| `ldga_per_60` | double precision | yes |  |
| `on_ice_sh_pct_per_60` | double precision | yes |  |
| `on_ice_sv_pct_per_60` | double precision | yes |  |
| `pdo_per_60` | double precision | yes |  |
| `off_zone_starts_per_60` | double precision | yes |  |
| `neu_zone_starts_per_60` | double precision | yes |  |
| `def_zone_starts_per_60` | double precision | yes |  |
| `off_zone_start_pct_per_60` | double precision | yes |  |
| `off_zone_faceoffs_per_60` | double precision | yes |  |
| `neu_zone_faceoffs_per_60` | double precision | yes |  |
| `def_zone_faceoffs_per_60` | double precision | yes |  |
| `on_the_fly_starts` | integer | no | 0 |

## `public.nst_gamelog_pk_counts_oi`

Type: table

Primary key: `id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `id` | integer | no | nextval('nst_gamelog_pk_counts_oi_id_seq'::regclass) |
| `player_id` | bigint | no |  |
| `season` | integer | no |  |
| `date_scraped` | date | no |  |
| `gp` | integer | yes |  |
| `toi` | integer | yes |  |
| `goals` | integer | yes |  |
| `total_assists` | integer | yes |  |
| `first_assists` | integer | yes |  |
| `second_assists` | integer | yes |  |
| `total_points` | integer | yes |  |
| `rush_attempts` | integer | yes |  |
| `rebounds_created` | integer | yes |  |
| `pim` | integer | yes |  |
| `total_penalties` | integer | yes |  |
| `minor_penalties` | integer | yes |  |
| `major_penalties` | integer | yes |  |
| `misconduct_penalties` | integer | yes |  |
| `penalties_drawn` | integer | yes |  |
| `giveaways` | integer | yes |  |
| `takeaways` | integer | yes |  |
| `hits` | integer | yes |  |
| `hits_taken` | integer | yes |  |
| `shots_blocked` | integer | yes |  |
| `faceoffs_won` | integer | yes |  |
| `faceoffs_lost` | integer | yes |  |
| `cf` | integer | yes |  |
| `ca` | integer | yes |  |
| `ff` | integer | yes |  |
| `fa` | integer | yes |  |
| `sf` | integer | yes |  |
| `sa` | integer | yes |  |
| `gf` | double precision | yes |  |
| `ga` | double precision | yes |  |
| `xgf` | double precision | yes |  |
| `xga` | double precision | yes |  |
| `scf` | double precision | yes |  |
| `sca` | double precision | yes |  |
| `hdca` | double precision | yes |  |
| `hdgf` | integer | yes |  |
| `hdga` | integer | yes |  |
| `mdcf` | integer | yes |  |
| `mdca` | integer | yes |  |
| `mdgf` | integer | yes |  |
| `mdga` | integer | yes |  |
| `ldcf` | integer | yes |  |
| `ldca` | integer | yes |  |
| `ldgf` | integer | yes |  |
| `ldga` | integer | yes |  |
| `pdo` | double precision | yes |  |
| `off_zone_starts` | integer | yes |  |
| `neu_zone_starts` | integer | yes |  |
| `def_zone_starts` | integer | yes |  |
| `off_zone_faceoffs` | integer | yes |  |
| `neu_zone_faceoffs` | integer | yes |  |
| `def_zone_faceoffs` | integer | yes |  |
| `created_at` | timestamp with time zone | yes | CURRENT_TIMESTAMP |
| `cf_pct` | double precision | yes |  |
| `shots` | integer | yes |  |
| `icf` | integer | yes |  |
| `iff` | integer | yes |  |
| `iscfs` | integer | yes |  |
| `hdcf` | integer | yes |  |
| `toi_per_gp` | double precision | yes |  |
| `goals_per_60` | double precision | yes |  |
| `total_assists_per_60` | double precision | yes |  |
| `first_assists_per_60` | double precision | yes |  |
| `second_assists_per_60` | double precision | yes |  |
| `total_points_per_60` | double precision | yes |  |
| `ipp` | double precision | yes |  |
| `shots_per_60` | double precision | yes |  |
| `sh_percentage` | double precision | yes |  |
| `ixg` | double precision | yes |  |
| `ixg_per_60` | double precision | yes |  |
| `icf_per_60` | double precision | yes |  |
| `iff_per_60` | double precision | yes |  |
| `iscfs_per_60` | double precision | yes |  |
| `hdcf_per_60` | double precision | yes |  |
| `rush_attempts_per_60` | double precision | yes |  |
| `rebounds_created_per_60` | double precision | yes |  |
| `pim_per_60` | double precision | yes |  |
| `total_penalties_per_60` | double precision | yes |  |
| `minor_penalties_per_60` | double precision | yes |  |
| `major_penalties_per_60` | double precision | yes |  |
| `misconduct_penalties_per_60` | double precision | yes |  |
| `penalties_drawn_per_60` | double precision | yes |  |
| `giveaways_per_60` | double precision | yes |  |
| `takeaways_per_60` | double precision | yes |  |
| `hits_per_60` | double precision | yes |  |
| `hits_taken_per_60` | double precision | yes |  |
| `shots_blocked_per_60` | double precision | yes |  |
| `faceoffs_won_per_60` | double precision | yes |  |
| `faceoffs_lost_per_60` | double precision | yes |  |
| `faceoffs_percentage` | double precision | yes |  |
| `ff_pct` | double precision | yes |  |
| `sf_pct` | double precision | yes |  |
| `gf_pct` | double precision | yes |  |
| `xgf_pct` | double precision | yes |  |
| `xga_pct` | double precision | yes |  |
| `scf_pct` | double precision | yes |  |
| `hdcf_pct` | double precision | yes |  |
| `hdgf_pct` | double precision | yes |  |
| `mdcf_pct` | double precision | yes |  |
| `mdgf_pct` | double precision | yes |  |
| `ldcf_pct` | double precision | yes |  |
| `ldgf_pct` | double precision | yes |  |
| `on_ice_sh_pct` | double precision | yes |  |
| `on_ice_sv_pct` | double precision | yes |  |
| `off_zone_start_pct` | double precision | yes |  |
| `off_zone_faceoff_pct` | double precision | yes |  |
| `cf_per_60` | double precision | yes |  |
| `ca_per_60` | double precision | yes |  |
| `ff_per_60` | double precision | yes |  |
| `fa_per_60` | double precision | yes |  |
| `sf_per_60` | double precision | yes |  |
| `sa_per_60` | double precision | yes |  |
| `gf_per_60` | double precision | yes |  |
| `ga_per_60` | double precision | yes |  |
| `xgf_per_60` | double precision | yes |  |
| `xga_per_60` | double precision | yes |  |
| `scf_per_60` | double precision | yes |  |
| `sca_per_60` | double precision | yes |  |
| `hdca_per_60` | double precision | yes |  |
| `hdgf_per_60` | double precision | yes |  |
| `hdga_per_60` | double precision | yes |  |
| `mdcf_per_60` | double precision | yes |  |
| `mdca_per_60` | double precision | yes |  |
| `mdgf_per_60` | double precision | yes |  |
| `mdga_per_60` | double precision | yes |  |
| `ldcf_per_60` | double precision | yes |  |
| `ldca_per_60` | double precision | yes |  |
| `ldgf_per_60` | double precision | yes |  |
| `ldga_per_60` | double precision | yes |  |
| `on_ice_sh_pct_per_60` | double precision | yes |  |
| `on_ice_sv_pct_per_60` | double precision | yes |  |
| `pdo_per_60` | double precision | yes |  |
| `off_zone_starts_per_60` | double precision | yes |  |
| `neu_zone_starts_per_60` | double precision | yes |  |
| `def_zone_starts_per_60` | double precision | yes |  |
| `off_zone_start_pct_per_60` | double precision | yes |  |
| `off_zone_faceoffs_per_60` | double precision | yes |  |
| `neu_zone_faceoffs_per_60` | double precision | yes |  |
| `def_zone_faceoffs_per_60` | double precision | yes |  |
| `on_the_fly_starts` | integer | no | 0 |

## `public.nst_gamelog_pk_rates`

Type: table

Primary key: `id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `id` | integer | no | nextval('nst_gamelog_pk_rates_id_seq'::regclass) |
| `player_id` | bigint | no |  |
| `season` | integer | no |  |
| `date_scraped` | date | no |  |
| `toi_per_gp` | double precision | yes |  |
| `goals_per_60` | double precision | yes |  |
| `total_assists_per_60` | double precision | yes |  |
| `first_assists_per_60` | double precision | yes |  |
| `second_assists_per_60` | double precision | yes |  |
| `total_points_per_60` | double precision | yes |  |
| `ipp` | double precision | yes |  |
| `shots_per_60` | double precision | yes |  |
| `sh_percentage` | double precision | yes |  |
| `ixg_per_60` | double precision | yes |  |
| `icf_per_60` | double precision | yes |  |
| `iff_per_60` | double precision | yes |  |
| `iscfs_per_60` | double precision | yes |  |
| `hdcf_per_60` | double precision | yes |  |
| `rush_attempts_per_60` | double precision | yes |  |
| `rebounds_created_per_60` | double precision | yes |  |
| `pim_per_60` | double precision | yes |  |
| `total_penalties_per_60` | double precision | yes |  |
| `minor_penalties_per_60` | double precision | yes |  |
| `major_penalties_per_60` | double precision | yes |  |
| `misconduct_penalties_per_60` | double precision | yes |  |
| `penalties_drawn_per_60` | double precision | yes |  |
| `giveaways_per_60` | double precision | yes |  |
| `takeaways_per_60` | double precision | yes |  |
| `hits_per_60` | double precision | yes |  |
| `hits_taken_per_60` | double precision | yes |  |
| `shots_blocked_per_60` | double precision | yes |  |
| `faceoffs_won_per_60` | double precision | yes |  |
| `faceoffs_lost_per_60` | double precision | yes |  |
| `faceoffs_percentage` | double precision | yes |  |
| `created_at` | timestamp with time zone | yes | CURRENT_TIMESTAMP |
| `gp` | integer | yes |  |
| `toi` | integer | yes |  |

## `public.nst_gamelog_pk_rates_oi`

Type: table

Primary key: `id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `id` | integer | no | nextval('nst_gamelog_pk_rates_oi_id_seq'::regclass) |
| `player_id` | bigint | no |  |
| `season` | integer | no |  |
| `date_scraped` | date | no |  |
| `toi_per_gp` | double precision | yes |  |
| `goals_per_60` | double precision | yes |  |
| `total_assists_per_60` | double precision | yes |  |
| `first_assists_per_60` | double precision | yes |  |
| `second_assists_per_60` | double precision | yes |  |
| `total_points_per_60` | double precision | yes |  |
| `ipp` | double precision | yes |  |
| `shots` | integer | yes |  |
| `shots_per_60` | double precision | yes |  |
| `sh_percentage` | double precision | yes |  |
| `ixg` | double precision | yes |  |
| `ixg_per_60` | double precision | yes |  |
| `icf` | double precision | yes |  |
| `icf_per_60` | double precision | yes |  |
| `iff` | double precision | yes |  |
| `iff_per_60` | double precision | yes |  |
| `iscfs` | double precision | yes |  |
| `iscfs_per_60` | double precision | yes |  |
| `hdcf` | double precision | yes |  |
| `hdcf_per_60` | double precision | yes |  |
| `rush_attempts_per_60` | double precision | yes |  |
| `rebounds_created_per_60` | double precision | yes |  |
| `pim_per_60` | double precision | yes |  |
| `total_penalties_per_60` | double precision | yes |  |
| `minor_penalties_per_60` | double precision | yes |  |
| `major_penalties_per_60` | double precision | yes |  |
| `misconduct_penalties_per_60` | double precision | yes |  |
| `penalties_drawn_per_60` | double precision | yes |  |
| `giveaways_per_60` | double precision | yes |  |
| `takeaways_per_60` | double precision | yes |  |
| `hits_per_60` | double precision | yes |  |
| `hits_taken_per_60` | double precision | yes |  |
| `shots_blocked_per_60` | double precision | yes |  |
| `faceoffs_won_per_60` | double precision | yes |  |
| `faceoffs_lost_per_60` | double precision | yes |  |
| `faceoffs_percentage` | double precision | yes |  |
| `cf_pct` | double precision | yes |  |
| `ca_per_60` | double precision | yes |  |
| `ff_pct` | double precision | yes |  |
| `fa_per_60` | double precision | yes |  |
| `sf_pct` | double precision | yes |  |
| `sa_per_60` | double precision | yes |  |
| `gf_pct` | double precision | yes |  |
| `ga_per_60` | double precision | yes |  |
| `xgf_per_60` | double precision | yes |  |
| `xga_per_60` | double precision | yes |  |
| `scf_per_60` | double precision | yes |  |
| `sca_per_60` | double precision | yes |  |
| `hdcf_pct` | double precision | yes |  |
| `hdgf_per_60` | double precision | yes |  |
| `hdga_per_60` | double precision | yes |  |
| `mdcf_per_60` | double precision | yes |  |
| `mdca_per_60` | double precision | yes |  |
| `mdgf_per_60` | double precision | yes |  |
| `mdga_per_60` | double precision | yes |  |
| `ldcf_per_60` | double precision | yes |  |
| `ldca_per_60` | double precision | yes |  |
| `ldgf_per_60` | double precision | yes |  |
| `ldga_per_60` | double precision | yes |  |
| `on_ice_sh_pct` | double precision | yes |  |
| `on_ice_sv_pct` | double precision | yes |  |
| `pdo_per_60` | double precision | yes |  |
| `off_zone_starts_per_60` | double precision | yes |  |
| `neu_zone_starts_per_60` | double precision | yes |  |
| `def_zone_starts_per_60` | double precision | yes |  |
| `off_zone_start_pct_per_60` | double precision | yes |  |
| `off_zone_faceoffs_per_60` | double precision | yes |  |
| `neu_zone_faceoffs_per_60` | double precision | yes |  |
| `def_zone_faceoffs_per_60` | double precision | yes |  |
| `created_at` | timestamp with time zone | yes | CURRENT_TIMESTAMP |
| `cf_per_60` | double precision | yes |  |
| `gp` | integer | yes |  |
| `goals` | integer | yes |  |
| `total_assists` | integer | yes |  |
| `first_assists` | integer | yes |  |
| `second_assists` | integer | yes |  |
| `total_points` | integer | yes |  |
| `rush_attempts` | integer | yes |  |
| `rebounds_created` | integer | yes |  |
| `pim` | integer | yes |  |
| `total_penalties` | integer | yes |  |
| `minor_penalties` | integer | yes |  |
| `major_penalties` | integer | yes |  |
| `misconduct_penalties` | integer | yes |  |
| `penalties_drawn` | integer | yes |  |
| `giveaways` | integer | yes |  |
| `takeaways` | integer | yes |  |
| `hits` | integer | yes |  |
| `hits_taken` | integer | yes |  |
| `shots_blocked` | integer | yes |  |
| `faceoffs_won` | integer | yes |  |
| `faceoffs_lost` | integer | yes |  |
| `cf` | integer | yes |  |
| `ca` | integer | yes |  |
| `ff` | integer | yes |  |
| `fa` | integer | yes |  |
| `sf` | integer | yes |  |
| `sa` | integer | yes |  |
| `gf` | integer | yes |  |
| `ga` | integer | yes |  |
| `scf` | integer | yes |  |
| `sca` | integer | yes |  |
| `hdca` | integer | yes |  |
| `hdgf` | integer | yes |  |
| `hdga` | integer | yes |  |
| `mdcf` | integer | yes |  |
| `mdca` | integer | yes |  |
| `mdgf` | integer | yes |  |
| `mdga` | integer | yes |  |
| `ldcf` | integer | yes |  |
| `ldca` | integer | yes |  |
| `ldgf` | integer | yes |  |
| `ldga` | integer | yes |  |
| `off_zone_starts` | integer | yes |  |
| `neu_zone_starts` | integer | yes |  |
| `def_zone_starts` | integer | yes |  |
| `off_zone_faceoffs` | integer | yes |  |
| `neu_zone_faceoffs` | integer | yes |  |
| `def_zone_faceoffs` | integer | yes |  |
| `toi` | integer | yes |  |
| `xgf` | double precision | yes |  |
| `xgf_pct` | double precision | yes |  |
| `xga` | double precision | yes |  |
| `xga_pct` | double precision | yes |  |
| `scf_pct` | double precision | yes |  |
| `hdgf_pct` | double precision | yes |  |
| `mdcf_pct` | double precision | yes |  |
| `mdgf_pct` | double precision | yes |  |
| `ldcf_pct` | double precision | yes |  |
| `ldgf_pct` | double precision | yes |  |
| `off_zone_start_pct` | double precision | yes |  |
| `off_zone_faceoff_pct` | double precision | yes |  |
| `ff_per_60` | double precision | yes |  |
| `sf_per_60` | double precision | yes |  |
| `gf_per_60` | double precision | yes |  |
| `hdca_per_60` | double precision | yes |  |
| `on_ice_sh_pct_per_60` | double precision | yes |  |
| `on_ice_sv_pct_per_60` | double precision | yes |  |
| `pdo` | double precision | yes |  |
| `on_the_fly_starts_per_60` | integer | no | 0 |

## `public.nst_gamelog_pp_counts`

Type: table

Primary key: `id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `id` | bigint | no | nextval('nst_gamelog_pp_counts_id_seq'::regclass) |
| `player_id` | bigint | no |  |
| `season` | integer | no |  |
| `date_scraped` | date | no |  |
| `gp` | smallint | yes |  |
| `toi` | integer | yes |  |
| `goals` | smallint | yes |  |
| `total_assists` | smallint | yes |  |
| `first_assists` | smallint | yes |  |
| `second_assists` | smallint | yes |  |
| `total_points` | smallint | yes |  |
| `ipp` | double precision | yes |  |
| `shots` | smallint | yes |  |
| `sh_percentage` | double precision | yes |  |
| `ixg` | double precision | yes |  |
| `icf` | smallint | yes |  |
| `iff` | smallint | yes |  |
| `iscfs` | smallint | yes |  |
| `hdcf` | smallint | yes |  |
| `rush_attempts` | smallint | yes |  |
| `rebounds_created` | smallint | yes |  |
| `pim` | smallint | yes |  |
| `total_penalties` | smallint | yes |  |
| `minor_penalties` | smallint | yes |  |
| `major_penalties` | smallint | yes |  |
| `misconduct_penalties` | smallint | yes |  |
| `penalties_drawn` | smallint | yes |  |
| `giveaways` | smallint | yes |  |
| `takeaways` | smallint | yes |  |
| `hits` | smallint | yes |  |
| `hits_taken` | smallint | yes |  |
| `shots_blocked` | smallint | yes |  |
| `faceoffs_won` | smallint | yes |  |
| `faceoffs_lost` | smallint | yes |  |
| `faceoffs_percentage` | double precision | yes |  |
| `cf` | integer | yes |  |
| `ca` | integer | yes |  |
| `ff` | integer | yes |  |
| `fa` | integer | yes |  |
| `sf` | integer | yes |  |
| `sa` | integer | yes |  |
| `gf` | integer | yes |  |
| `ga` | integer | yes |  |
| `scf` | integer | yes |  |
| `sca` | integer | yes |  |
| `hdca` | integer | yes |  |
| `hdgf` | integer | yes |  |
| `hdga` | integer | yes |  |
| `mdcf` | integer | yes |  |
| `mdca` | integer | yes |  |
| `mdgf` | integer | yes |  |
| `mdga` | integer | yes |  |
| `ldcf` | integer | yes |  |
| `ldca` | integer | yes |  |
| `ldgf` | integer | yes |  |
| `ldga` | integer | yes |  |
| `off_zone_starts` | integer | yes |  |
| `neu_zone_starts` | integer | yes |  |
| `def_zone_starts` | integer | yes |  |
| `off_zone_faceoffs` | integer | yes |  |
| `neu_zone_faceoffs` | integer | yes |  |
| `def_zone_faceoffs` | integer | yes |  |
| `toi_per_gp` | double precision | yes |  |
| `goals_per_60` | double precision | yes |  |
| `total_assists_per_60` | double precision | yes |  |
| `first_assists_per_60` | double precision | yes |  |
| `second_assists_per_60` | double precision | yes |  |
| `total_points_per_60` | double precision | yes |  |
| `shots_per_60` | double precision | yes |  |
| `ixg_per_60` | double precision | yes |  |
| `icf_per_60` | double precision | yes |  |
| `iff_per_60` | double precision | yes |  |
| `iscfs_per_60` | double precision | yes |  |
| `hdcf_per_60` | double precision | yes |  |
| `rush_attempts_per_60` | double precision | yes |  |
| `rebounds_created_per_60` | double precision | yes |  |
| `pim_per_60` | double precision | yes |  |
| `total_penalties_per_60` | double precision | yes |  |
| `minor_penalties_per_60` | double precision | yes |  |
| `major_penalties_per_60` | double precision | yes |  |
| `misconduct_penalties_per_60` | double precision | yes |  |
| `penalties_drawn_per_60` | double precision | yes |  |
| `giveaways_per_60` | double precision | yes |  |
| `takeaways_per_60` | double precision | yes |  |
| `hits_per_60` | double precision | yes |  |
| `hits_taken_per_60` | double precision | yes |  |
| `shots_blocked_per_60` | double precision | yes |  |
| `faceoffs_won_per_60` | double precision | yes |  |
| `faceoffs_lost_per_60` | double precision | yes |  |
| `cf_pct` | double precision | yes |  |
| `ff_pct` | double precision | yes |  |
| `sf_pct` | double precision | yes |  |
| `gf_pct` | double precision | yes |  |
| `xgf` | double precision | yes |  |
| `xgf_pct` | double precision | yes |  |
| `xga` | double precision | yes |  |
| `xga_pct` | double precision | yes |  |
| `scf_pct` | double precision | yes |  |
| `hdcf_pct` | double precision | yes |  |
| `hdgf_pct` | double precision | yes |  |
| `mdcf_pct` | double precision | yes |  |
| `mdgf_pct` | double precision | yes |  |
| `ldcf_pct` | double precision | yes |  |
| `ldgf_pct` | double precision | yes |  |
| `on_ice_sh_pct` | double precision | yes |  |
| `on_ice_sv_pct` | double precision | yes |  |
| `off_zone_start_pct` | double precision | yes |  |
| `off_zone_faceoff_pct` | double precision | yes |  |
| `cf_per_60` | double precision | yes |  |
| `ca_per_60` | double precision | yes |  |
| `ff_per_60` | double precision | yes |  |
| `fa_per_60` | double precision | yes |  |
| `sf_per_60` | double precision | yes |  |
| `sa_per_60` | double precision | yes |  |
| `gf_per_60` | double precision | yes |  |
| `ga_per_60` | double precision | yes |  |
| `xgf_per_60` | double precision | yes |  |
| `xga_per_60` | double precision | yes |  |
| `scf_per_60` | double precision | yes |  |
| `sca_per_60` | double precision | yes |  |
| `hdca_per_60` | double precision | yes |  |
| `hdgf_per_60` | double precision | yes |  |
| `hdga_per_60` | double precision | yes |  |
| `mdcf_per_60` | double precision | yes |  |
| `mdca_per_60` | double precision | yes |  |
| `mdgf_per_60` | double precision | yes |  |
| `mdga_per_60` | double precision | yes |  |
| `ldcf_per_60` | double precision | yes |  |
| `ldca_per_60` | double precision | yes |  |
| `ldgf_per_60` | double precision | yes |  |
| `ldga_per_60` | double precision | yes |  |
| `on_ice_sh_pct_per_60` | double precision | yes |  |
| `on_ice_sv_pct_per_60` | double precision | yes |  |
| `pdo` | double precision | yes |  |
| `pdo_per_60` | double precision | yes |  |
| `off_zone_starts_per_60` | double precision | yes |  |
| `neu_zone_starts_per_60` | double precision | yes |  |
| `def_zone_starts_per_60` | double precision | yes |  |
| `off_zone_start_pct_per_60` | double precision | yes |  |
| `off_zone_faceoffs_per_60` | double precision | yes |  |
| `neu_zone_faceoffs_per_60` | double precision | yes |  |
| `def_zone_faceoffs_per_60` | double precision | yes |  |

## `public.nst_gamelog_pp_counts_oi`

Type: table

Primary key: `id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `player_id` | integer | no |  |
| `position` | text | yes |  |
| `gp` | integer | yes |  |
| `cf` | integer | yes |  |
| `ca` | integer | yes |  |
| `cf_pct` | double precision | yes |  |
| `ff` | integer | yes |  |
| `fa` | integer | yes |  |
| `ff_pct` | double precision | yes |  |
| `sf` | integer | yes |  |
| `sa` | integer | yes |  |
| `sf_pct` | double precision | yes |  |
| `gf` | integer | yes |  |
| `ga` | integer | yes |  |
| `gf_pct` | double precision | yes |  |
| `xgf` | double precision | yes |  |
| `xga` | double precision | yes |  |
| `xgf_pct` | double precision | yes |  |
| `scf` | integer | yes |  |
| `sca` | integer | yes |  |
| `scf_pct` | double precision | yes |  |
| `hdcf` | integer | yes |  |
| `hdca` | integer | yes |  |
| `hdcf_pct` | double precision | yes |  |
| `hdgf` | integer | yes |  |
| `mdcf` | integer | yes |  |
| `mdca` | integer | yes |  |
| `mdcf_pct` | double precision | yes |  |
| `mdgf` | integer | yes |  |
| `mdga` | integer | yes |  |
| `mdgf_pct` | double precision | yes |  |
| `ldcf` | integer | yes |  |
| `ldca` | integer | yes |  |
| `ldcf_pct` | double precision | yes |  |
| `ldgf` | integer | yes |  |
| `ldga` | integer | yes |  |
| `ldgf_pct` | double precision | yes |  |
| `on_ice_sh_pct` | double precision | yes |  |
| `on_ice_sv_pct` | double precision | yes |  |
| `off_zone_starts` | integer | yes |  |
| `neu_zone_starts` | integer | yes |  |
| `def_zone_starts` | integer | yes |  |
| `on_the_fly_starts` | integer | yes |  |
| `off_zone_start_pct` | double precision | yes |  |
| `off_zone_faceoffs` | integer | yes |  |
| `neu_zone_faceoffs` | integer | yes |  |
| `def_zone_faceoffs` | integer | yes |  |
| `off_zone_faceoff_pct` | double precision | yes |  |
| `date_scraped` | date | no |  |
| `season` | integer | no |  |
| `toi` | integer | yes |  |
| `hdga` | double precision | yes |  |
| `hdgf_pct` | double precision | yes |  |
| `id` | bigint | no | nextval('nst_gamelog_pp_counts_oi_id_seq'::regclass) |
| `pdo` | double precision | yes |  |
| `goals` | integer | yes |  |
| `total_assists` | integer | yes |  |
| `first_assists` | integer | yes |  |
| `second_assists` | integer | yes |  |
| `total_points` | integer | yes |  |
| `shots` | integer | yes |  |
| `icf` | integer | yes |  |
| `iff` | integer | yes |  |
| `iscfs` | integer | yes |  |
| `rush_attempts` | integer | yes |  |
| `rebounds_created` | integer | yes |  |
| `pim` | integer | yes |  |
| `total_penalties` | integer | yes |  |
| `minor_penalties` | integer | yes |  |
| `major_penalties` | integer | yes |  |
| `misconduct_penalties` | integer | yes |  |
| `penalties_drawn` | integer | yes |  |
| `giveaways` | integer | yes |  |
| `takeaways` | integer | yes |  |
| `hits` | integer | yes |  |
| `hits_taken` | integer | yes |  |
| `shots_blocked` | integer | yes |  |
| `faceoffs_won` | integer | yes |  |
| `faceoffs_lost` | integer | yes |  |
| `toi_per_gp` | double precision | yes |  |
| `goals_per_60` | double precision | yes |  |
| `total_assists_per_60` | double precision | yes |  |
| `first_assists_per_60` | double precision | yes |  |
| `second_assists_per_60` | double precision | yes |  |
| `total_points_per_60` | double precision | yes |  |
| `ipp` | double precision | yes |  |
| `shots_per_60` | double precision | yes |  |
| `sh_percentage` | double precision | yes |  |
| `ixg` | double precision | yes |  |
| `ixg_per_60` | double precision | yes |  |
| `icf_per_60` | double precision | yes |  |
| `iff_per_60` | double precision | yes |  |
| `iscfs_per_60` | double precision | yes |  |
| `hdcf_per_60` | double precision | yes |  |
| `rush_attempts_per_60` | double precision | yes |  |
| `rebounds_created_per_60` | double precision | yes |  |
| `pim_per_60` | double precision | yes |  |
| `total_penalties_per_60` | double precision | yes |  |
| `minor_penalties_per_60` | double precision | yes |  |
| `major_penalties_per_60` | double precision | yes |  |
| `misconduct_penalties_per_60` | double precision | yes |  |
| `penalties_drawn_per_60` | double precision | yes |  |
| `giveaways_per_60` | double precision | yes |  |
| `takeaways_per_60` | double precision | yes |  |
| `hits_per_60` | double precision | yes |  |
| `hits_taken_per_60` | double precision | yes |  |
| `shots_blocked_per_60` | double precision | yes |  |
| `faceoffs_won_per_60` | double precision | yes |  |
| `faceoffs_lost_per_60` | double precision | yes |  |
| `faceoffs_percentage` | double precision | yes |  |
| `xga_pct` | double precision | yes |  |
| `cf_per_60` | double precision | yes |  |
| `ca_per_60` | double precision | yes |  |
| `ff_per_60` | double precision | yes |  |
| `fa_per_60` | double precision | yes |  |
| `sf_per_60` | double precision | yes |  |
| `sa_per_60` | double precision | yes |  |
| `gf_per_60` | double precision | yes |  |
| `ga_per_60` | double precision | yes |  |
| `xgf_per_60` | double precision | yes |  |
| `xga_per_60` | double precision | yes |  |
| `scf_per_60` | double precision | yes |  |
| `sca_per_60` | double precision | yes |  |
| `hdca_per_60` | double precision | yes |  |
| `hdgf_per_60` | double precision | yes |  |
| `hdga_per_60` | double precision | yes |  |
| `mdcf_per_60` | double precision | yes |  |
| `mdca_per_60` | double precision | yes |  |
| `mdgf_per_60` | double precision | yes |  |
| `mdga_per_60` | double precision | yes |  |
| `ldcf_per_60` | double precision | yes |  |
| `ldca_per_60` | double precision | yes |  |
| `ldgf_per_60` | double precision | yes |  |
| `ldga_per_60` | double precision | yes |  |
| `on_ice_sh_pct_per_60` | double precision | yes |  |
| `on_ice_sv_pct_per_60` | double precision | yes |  |
| `pdo_per_60` | double precision | yes |  |
| `off_zone_starts_per_60` | double precision | yes |  |
| `neu_zone_starts_per_60` | double precision | yes |  |
| `def_zone_starts_per_60` | double precision | yes |  |
| `off_zone_start_pct_per_60` | double precision | yes |  |
| `off_zone_faceoffs_per_60` | double precision | yes |  |
| `neu_zone_faceoffs_per_60` | double precision | yes |  |
| `def_zone_faceoffs_per_60` | double precision | yes |  |

## `public.nst_gamelog_pp_rates`

Type: table

Primary key: `id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `id` | bigint | no | nextval('nst_gamelog_pp_rates_id_seq'::regclass) |
| `player_id` | bigint | no |  |
| `season` | integer | no |  |
| `date_scraped` | date | no |  |
| `gp` | smallint | yes |  |
| `toi` | integer | yes |  |
| `toi_per_gp` | double precision | yes |  |
| `goals_per_60` | double precision | yes |  |
| `total_assists_per_60` | double precision | yes |  |
| `first_assists_per_60` | double precision | yes |  |
| `second_assists_per_60` | double precision | yes |  |
| `total_points_per_60` | double precision | yes |  |
| `ipp` | double precision | yes |  |
| `shots_per_60` | double precision | yes |  |
| `sh_percentage` | double precision | yes |  |
| `ixg_per_60` | double precision | yes |  |
| `icf_per_60` | double precision | yes |  |
| `iff_per_60` | double precision | yes |  |
| `iscfs_per_60` | double precision | yes |  |
| `hdcf_per_60` | double precision | yes |  |
| `rush_attempts_per_60` | double precision | yes |  |
| `rebounds_created_per_60` | double precision | yes |  |
| `pim_per_60` | double precision | yes |  |
| `total_penalties_per_60` | double precision | yes |  |
| `minor_penalties_per_60` | double precision | yes |  |
| `major_penalties_per_60` | double precision | yes |  |
| `misconduct_penalties_per_60` | double precision | yes |  |
| `penalties_drawn_per_60` | double precision | yes |  |
| `giveaways_per_60` | double precision | yes |  |
| `takeaways_per_60` | double precision | yes |  |
| `hits_per_60` | double precision | yes |  |
| `hits_taken_per_60` | double precision | yes |  |
| `shots_blocked_per_60` | double precision | yes |  |
| `faceoffs_won_per_60` | double precision | yes |  |
| `faceoffs_lost_per_60` | double precision | yes |  |
| `faceoffs_percentage` | double precision | yes |  |

## `public.nst_gamelog_pp_rates_oi`

Type: table

Primary key: `id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `player_id` | integer | no |  |
| `position` | text | yes |  |
| `gp` | integer | yes |  |
| `toi` | integer | yes |  |
| `toi_per_gp` | double precision | yes |  |
| `cf_per_60` | double precision | yes |  |
| `ca_per_60` | double precision | yes |  |
| `cf_pct` | double precision | yes |  |
| `ff_per_60` | double precision | yes |  |
| `fa_per_60` | double precision | yes |  |
| `ff_pct` | double precision | yes |  |
| `sf_per_60` | double precision | yes |  |
| `sa_per_60` | double precision | yes |  |
| `sf_pct` | double precision | yes |  |
| `gf_per_60` | double precision | yes |  |
| `ga_per_60` | double precision | yes |  |
| `gf_pct` | double precision | yes |  |
| `xgf_per_60` | double precision | yes |  |
| `xga_per_60` | double precision | yes |  |
| `xgf_pct` | double precision | yes |  |
| `scf_per_60` | double precision | yes |  |
| `sca_per_60` | double precision | yes |  |
| `scf_pct` | double precision | yes |  |
| `hdcf_per_60` | double precision | yes |  |
| `hdca_per_60` | double precision | yes |  |
| `hdcf_pct` | double precision | yes |  |
| `hdgf_per_60` | double precision | yes |  |
| `hdga_per_60` | double precision | yes |  |
| `hdgf_pct` | double precision | yes |  |
| `mdcf_per_60` | double precision | yes |  |
| `mdca_per_60` | double precision | yes |  |
| `mdcf_pct` | double precision | yes |  |
| `mdgf_per_60` | double precision | yes |  |
| `mdga_per_60` | double precision | yes |  |
| `mdgf_pct` | double precision | yes |  |
| `ldcf_per_60` | double precision | yes |  |
| `ldca_per_60` | double precision | yes |  |
| `ldcf_pct` | double precision | yes |  |
| `ldgf_per_60` | double precision | yes |  |
| `ldga_per_60` | double precision | yes |  |
| `ldgf_pct` | double precision | yes |  |
| `on_ice_sh_pct` | double precision | yes |  |
| `on_ice_sv_pct` | double precision | yes |  |
| `pdo` | double precision | yes |  |
| `off_zone_starts_per_60` | double precision | yes |  |
| `neu_zone_starts_per_60` | double precision | yes |  |
| `def_zone_starts_per_60` | double precision | yes |  |
| `on_the_fly_starts_per_60` | double precision | yes |  |
| `off_zone_start_pct` | double precision | yes |  |
| `off_zone_faceoffs_per_60` | double precision | yes |  |
| `neu_zone_faceoffs_per_60` | double precision | yes |  |
| `def_zone_faceoffs_per_60` | double precision | yes |  |
| `off_zone_faceoff_pct` | double precision | yes |  |
| `date_scraped` | date | no |  |
| `season` | integer | no |  |
| `id` | bigint | no | nextval('nst_gamelog_pp_rates_oi_id_seq'::regclass) |
| `goals` | integer | yes |  |
| `total_assists` | integer | yes |  |
| `first_assists` | integer | yes |  |
| `second_assists` | integer | yes |  |
| `total_points` | integer | yes |  |
| `shots` | integer | yes |  |
| `icf` | integer | yes |  |
| `iff` | integer | yes |  |
| `iscfs` | integer | yes |  |
| `hdcf` | integer | yes |  |
| `rush_attempts` | integer | yes |  |
| `rebounds_created` | integer | yes |  |
| `pim` | integer | yes |  |
| `total_penalties` | integer | yes |  |
| `minor_penalties` | integer | yes |  |
| `major_penalties` | integer | yes |  |
| `misconduct_penalties` | integer | yes |  |
| `penalties_drawn` | integer | yes |  |
| `giveaways` | integer | yes |  |
| `takeaways` | integer | yes |  |
| `hits` | integer | yes |  |
| `hits_taken` | integer | yes |  |
| `shots_blocked` | integer | yes |  |
| `faceoffs_won` | integer | yes |  |
| `faceoffs_lost` | integer | yes |  |
| `cf` | integer | yes |  |
| `ca` | integer | yes |  |
| `ff` | integer | yes |  |
| `fa` | integer | yes |  |
| `sf` | integer | yes |  |
| `sa` | integer | yes |  |
| `gf` | integer | yes |  |
| `ga` | integer | yes |  |
| `scf` | integer | yes |  |
| `sca` | integer | yes |  |
| `hdca` | integer | yes |  |
| `hdgf` | integer | yes |  |
| `hdga` | integer | yes |  |
| `mdcf` | integer | yes |  |
| `mdca` | integer | yes |  |
| `mdgf` | integer | yes |  |
| `mdga` | integer | yes |  |
| `ldcf` | integer | yes |  |
| `ldca` | integer | yes |  |
| `ldgf` | integer | yes |  |
| `ldga` | integer | yes |  |
| `off_zone_starts` | integer | yes |  |
| `neu_zone_starts` | integer | yes |  |
| `def_zone_starts` | integer | yes |  |
| `off_zone_faceoffs` | integer | yes |  |
| `neu_zone_faceoffs` | integer | yes |  |
| `def_zone_faceoffs` | integer | yes |  |
| `goals_per_60` | double precision | yes |  |
| `total_assists_per_60` | double precision | yes |  |
| `first_assists_per_60` | double precision | yes |  |
| `second_assists_per_60` | double precision | yes |  |
| `total_points_per_60` | double precision | yes |  |
| `ipp` | double precision | yes |  |
| `shots_per_60` | double precision | yes |  |
| `sh_percentage` | double precision | yes |  |
| `ixg` | double precision | yes |  |
| `ixg_per_60` | double precision | yes |  |
| `icf_per_60` | double precision | yes |  |
| `iff_per_60` | double precision | yes |  |
| `iscfs_per_60` | double precision | yes |  |
| `rush_attempts_per_60` | double precision | yes |  |
| `rebounds_created_per_60` | double precision | yes |  |
| `pim_per_60` | double precision | yes |  |
| `total_penalties_per_60` | double precision | yes |  |
| `minor_penalties_per_60` | double precision | yes |  |
| `major_penalties_per_60` | double precision | yes |  |
| `misconduct_penalties_per_60` | double precision | yes |  |
| `penalties_drawn_per_60` | double precision | yes |  |
| `giveaways_per_60` | double precision | yes |  |
| `takeaways_per_60` | double precision | yes |  |
| `hits_per_60` | double precision | yes |  |
| `hits_taken_per_60` | double precision | yes |  |
| `shots_blocked_per_60` | double precision | yes |  |
| `faceoffs_won_per_60` | double precision | yes |  |
| `faceoffs_lost_per_60` | double precision | yes |  |
| `faceoffs_percentage` | double precision | yes |  |
| `xgf` | double precision | yes |  |
| `xga` | double precision | yes |  |
| `xga_pct` | double precision | yes |  |
| `on_ice_sh_pct_per_60` | double precision | yes |  |
| `on_ice_sv_pct_per_60` | double precision | yes |  |
| `pdo_per_60` | double precision | yes |  |
| `off_zone_start_pct_per_60` | double precision | yes |  |

## `public.nst_league_averages`

Type: view

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `strength` | text | yes |  |
| `gp` | numeric | yes |  |
| `toi` | numeric | yes |  |
| `w` | numeric | yes |  |
| `l` | numeric | yes |  |
| `otl` | numeric | yes |  |
| `points` | numeric | yes |  |
| `cf` | numeric | yes |  |
| `ca` | numeric | yes |  |
| `cf_pct` | double precision | yes |  |
| `ff` | numeric | yes |  |
| `fa` | numeric | yes |  |
| `ff_pct` | double precision | yes |  |
| `sf` | numeric | yes |  |
| `sa` | numeric | yes |  |
| `sf_pct` | double precision | yes |  |
| `gf` | numeric | yes |  |
| `ga` | numeric | yes |  |
| `gf_pct` | double precision | yes |  |
| `xgf` | double precision | yes |  |
| `xga` | double precision | yes |  |
| `xgf_pct` | double precision | yes |  |
| `scf` | numeric | yes |  |
| `sca` | numeric | yes |  |
| `scf_pct` | double precision | yes |  |
| `hdcf` | numeric | yes |  |
| `hdca` | numeric | yes |  |
| `hdcf_pct` | double precision | yes |  |
| `hdsf` | numeric | yes |  |
| `hdsa` | numeric | yes |  |
| `hdsf_pct` | double precision | yes |  |
| `hdgf` | numeric | yes |  |
| `hdga` | numeric | yes |  |
| `hdgf_pct` | double precision | yes |  |
| `sh_pct` | double precision | yes |  |
| `sv_pct` | double precision | yes |  |
| `pdo` | numeric | yes |  |

## `public.nst_percentile_as_defense`

Type: table

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `player_id` | bigint | yes |  |
| `season` | integer | yes |  |
| `gp` | bigint | yes |  |
| `toi_seconds` | bigint | yes |  |
| `ca_per_60` | double precision | yes |  |
| `fa_per_60` | double precision | yes |  |
| `sa_per_60` | double precision | yes |  |
| `ga_per_60` | double precision | yes |  |
| `xga_per_60` | double precision | yes |  |
| `sca_per_60` | double precision | yes |  |
| `hdca_per_60` | double precision | yes |  |
| `hdga_per_60` | double precision | yes |  |
| `mdga_per_60` | double precision | yes |  |
| `ldga_per_60` | double precision | yes |  |
| `shots_blocked_per_60` | double precision | yes |  |
| `takeaways_per_60` | double precision | yes |  |
| `hits_per_60` | double precision | yes |  |
| `pim_per_60` | double precision | yes |  |
| `total_penalties_per_60` | double precision | yes |  |
| `minor_penalties_per_60` | double precision | yes |  |
| `major_penalties_per_60` | double precision | yes |  |
| `misconduct_penalties_per_60` | double precision | yes |  |
| `giveaways_per_60` | double precision | yes |  |
| `on_ice_sv_pct` | double precision | yes |  |

## `public.nst_percentile_as_defense_filtered`

Type: table

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `player_id` | bigint | yes |  |
| `season` | integer | yes |  |
| `gp` | bigint | yes |  |
| `toi_seconds` | bigint | yes |  |
| `ca_per_60` | double precision | yes |  |
| `fa_per_60` | double precision | yes |  |
| `sa_per_60` | double precision | yes |  |
| `ga_per_60` | double precision | yes |  |
| `xga_per_60` | double precision | yes |  |
| `sca_per_60` | double precision | yes |  |
| `hdca_per_60` | double precision | yes |  |
| `hdga_per_60` | double precision | yes |  |
| `mdga_per_60` | double precision | yes |  |
| `ldga_per_60` | double precision | yes |  |
| `shots_blocked_per_60` | double precision | yes |  |
| `takeaways_per_60` | double precision | yes |  |
| `hits_per_60` | double precision | yes |  |
| `pim_per_60` | double precision | yes |  |
| `total_penalties_per_60` | double precision | yes |  |
| `minor_penalties_per_60` | double precision | yes |  |
| `major_penalties_per_60` | double precision | yes |  |
| `misconduct_penalties_per_60` | double precision | yes |  |
| `giveaways_per_60` | double precision | yes |  |
| `on_ice_sv_pct` | double precision | yes |  |
| `xga_per_60_percentile` | double precision | yes |  |
| `sca_per_60_percentile` | double precision | yes |  |
| `hdca_per_60_percentile` | double precision | yes |  |
| `shots_blocked_per_60_percentile` | double precision | yes |  |
| `takeaways_per_60_percentile` | double precision | yes |  |
| `minor_penalties_per_60_percentile` | double precision | yes |  |
| `giveaways_per_60_percentile` | double precision | yes |  |
| `ga_per_60_percentile` | text | yes |  |
| `sa_per_60_percentile` | text | yes |  |

## `public.nst_percentile_as_offense`

Type: table

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `player_id` | bigint | yes |  |
| `season` | integer | yes |  |
| `gp` | bigint | yes |  |
| `toi_seconds` | bigint | yes |  |
| `goals_per_60` | double precision | yes |  |
| `total_assists_per_60` | double precision | yes |  |
| `first_assists_per_60` | double precision | yes |  |
| `second_assists_per_60` | double precision | yes |  |
| `total_points_per_60` | double precision | yes |  |
| `shots_per_60` | double precision | yes |  |
| `ixg_per_60` | double precision | yes |  |
| `icf_per_60` | double precision | yes |  |
| `iff_per_60` | double precision | yes |  |
| `iscfs_per_60` | double precision | yes |  |
| `i_hdcf_per_60` | double precision | yes |  |
| `rush_attempts_per_60` | double precision | yes |  |
| `rebounds_created_per_60` | double precision | yes |  |
| `cf_per_60` | double precision | yes |  |
| `ff_per_60` | double precision | yes |  |
| `sf_per_60` | double precision | yes |  |
| `gf_per_60` | double precision | yes |  |
| `xgf_per_60` | double precision | yes |  |
| `scf_per_60` | double precision | yes |  |
| `oi_hdcf_per_60` | double precision | yes |  |
| `hdgf_per_60` | double precision | yes |  |
| `mdgf_per_60` | double precision | yes |  |
| `ldgf_per_60` | double precision | yes |  |
| `cf_pct` | double precision | yes |  |
| `ff_pct` | double precision | yes |  |
| `sf_pct` | double precision | yes |  |
| `gf_pct` | double precision | yes |  |
| `xgf_pct` | double precision | yes |  |
| `scf_pct` | double precision | yes |  |
| `hdcf_pct` | double precision | yes |  |
| `hdgf_pct` | double precision | yes |  |
| `mdgf_pct` | double precision | yes |  |
| `ldgf_pct` | double precision | yes |  |
| `ipp` | double precision | yes |  |
| `sh_percentage` | double precision | yes |  |
| `on_ice_sh_pct` | double precision | yes |  |
| `penalties_drawn_per_60` | double precision | yes |  |

## `public.nst_percentile_es_defense`

Type: view

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `player_id` | bigint | yes |  |
| `season` | integer | yes |  |
| `gp` | bigint | yes |  |
| `toi_seconds` | bigint | yes |  |
| `ca_per_60` | double precision | yes |  |
| `fa_per_60` | double precision | yes |  |
| `sa_per_60` | double precision | yes |  |
| `ga_per_60` | double precision | yes |  |
| `xga_per_60` | double precision | yes |  |
| `sca_per_60` | double precision | yes |  |
| `hdca_per_60` | double precision | yes |  |
| `hdga_per_60` | double precision | yes |  |
| `mdga_per_60` | double precision | yes |  |
| `ldga_per_60` | double precision | yes |  |
| `shots_blocked_per_60` | double precision | yes |  |
| `takeaways_per_60` | double precision | yes |  |
| `hits_per_60` | double precision | yes |  |
| `pim_per_60` | double precision | yes |  |
| `total_penalties_per_60` | double precision | yes |  |
| `minor_penalties_per_60` | double precision | yes |  |
| `major_penalties_per_60` | double precision | yes |  |
| `misconduct_penalties_per_60` | double precision | yes |  |
| `giveaways_per_60` | double precision | yes |  |
| `on_ice_sv_pct` | double precision | yes |  |

## `public.nst_percentile_es_defense_filtered`

Type: view

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `player_id` | bigint | yes |  |
| `season` | integer | yes |  |
| `gp` | bigint | yes |  |
| `toi_seconds` | bigint | yes |  |
| `ca_per_60` | double precision | yes |  |
| `fa_per_60` | double precision | yes |  |
| `sa_per_60` | double precision | yes |  |
| `ga_per_60` | double precision | yes |  |
| `xga_per_60` | double precision | yes |  |
| `sca_per_60` | double precision | yes |  |
| `hdca_per_60` | double precision | yes |  |
| `hdga_per_60` | double precision | yes |  |
| `mdga_per_60` | double precision | yes |  |
| `ldga_per_60` | double precision | yes |  |
| `shots_blocked_per_60` | double precision | yes |  |
| `takeaways_per_60` | double precision | yes |  |
| `hits_per_60` | double precision | yes |  |
| `pim_per_60` | double precision | yes |  |
| `total_penalties_per_60` | double precision | yes |  |
| `minor_penalties_per_60` | double precision | yes |  |
| `major_penalties_per_60` | double precision | yes |  |
| `misconduct_penalties_per_60` | double precision | yes |  |
| `giveaways_per_60` | double precision | yes |  |
| `on_ice_sv_pct` | double precision | yes |  |
| `xga_per_60_percentile` | double precision | yes |  |
| `sca_per_60_percentile` | double precision | yes |  |
| `hdca_per_60_percentile` | double precision | yes |  |
| `shots_blocked_per_60_percentile` | double precision | yes |  |
| `takeaways_per_60_percentile` | double precision | yes |  |
| `minor_penalties_per_60_percentile` | double precision | yes |  |
| `giveaways_per_60_percentile` | double precision | yes |  |
| `ga_per_60_percentile` | text | yes |  |
| `sa_per_60_percentile` | text | yes |  |

## `public.nst_percentile_es_offense`

Type: view

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `player_id` | bigint | yes |  |
| `season` | integer | yes |  |
| `gp` | bigint | yes |  |
| `toi_seconds` | bigint | yes |  |
| `goals_per_60` | double precision | yes |  |
| `total_assists_per_60` | double precision | yes |  |
| `first_assists_per_60` | double precision | yes |  |
| `second_assists_per_60` | double precision | yes |  |
| `total_points_per_60` | double precision | yes |  |
| `shots_per_60` | double precision | yes |  |
| `ixg_per_60` | double precision | yes |  |
| `icf_per_60` | double precision | yes |  |
| `iff_per_60` | double precision | yes |  |
| `iscfs_per_60` | double precision | yes |  |
| `i_hdcf_per_60` | double precision | yes |  |
| `rush_attempts_per_60` | double precision | yes |  |
| `rebounds_created_per_60` | double precision | yes |  |
| `cf_per_60` | double precision | yes |  |
| `ff_per_60` | double precision | yes |  |
| `sf_per_60` | double precision | yes |  |
| `gf_per_60` | double precision | yes |  |
| `xgf_per_60` | double precision | yes |  |
| `scf_per_60` | double precision | yes |  |
| `oi_hdcf_per_60` | double precision | yes |  |
| `hdgf_per_60` | double precision | yes |  |
| `mdgf_per_60` | double precision | yes |  |
| `ldgf_per_60` | double precision | yes |  |
| `cf_pct` | double precision | yes |  |
| `ff_pct` | double precision | yes |  |
| `sf_pct` | double precision | yes |  |
| `gf_pct` | double precision | yes |  |
| `xgf_pct` | double precision | yes |  |
| `scf_pct` | double precision | yes |  |
| `hdcf_pct` | double precision | yes |  |
| `hdgf_pct` | double precision | yes |  |
| `mdgf_pct` | double precision | yes |  |
| `ldgf_pct` | double precision | yes |  |
| `ipp` | double precision | yes |  |
| `sh_percentage` | double precision | yes |  |
| `on_ice_sh_pct` | double precision | yes |  |
| `penalties_drawn_per_60` | double precision | yes |  |

## `public.nst_percentile_es_offense_filtered`

Type: view

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `player_id` | bigint | yes |  |
| `season` | integer | yes |  |
| `gp` | bigint | yes |  |
| `toi_seconds` | bigint | yes |  |
| `goals_per_60` | double precision | yes |  |
| `total_assists_per_60` | double precision | yes |  |
| `first_assists_per_60` | double precision | yes |  |
| `second_assists_per_60` | double precision | yes |  |
| `total_points_per_60` | double precision | yes |  |
| `shots_per_60` | double precision | yes |  |
| `ixg_per_60` | double precision | yes |  |
| `icf_per_60` | double precision | yes |  |
| `iff_per_60` | double precision | yes |  |
| `iscfs_per_60` | double precision | yes |  |
| `i_hdcf_per_60` | double precision | yes |  |
| `rush_attempts_per_60` | double precision | yes |  |
| `rebounds_created_per_60` | double precision | yes |  |
| `cf_per_60` | double precision | yes |  |
| `ff_per_60` | double precision | yes |  |
| `sf_per_60` | double precision | yes |  |
| `gf_per_60` | double precision | yes |  |
| `xgf_per_60` | double precision | yes |  |
| `scf_per_60` | double precision | yes |  |
| `oi_hdcf_per_60` | double precision | yes |  |
| `hdgf_per_60` | double precision | yes |  |
| `mdgf_per_60` | double precision | yes |  |
| `ldgf_per_60` | double precision | yes |  |
| `cf_pct` | double precision | yes |  |
| `ff_pct` | double precision | yes |  |
| `sf_pct` | double precision | yes |  |
| `gf_pct` | double precision | yes |  |
| `xgf_pct` | double precision | yes |  |
| `scf_pct` | double precision | yes |  |
| `hdcf_pct` | double precision | yes |  |
| `hdgf_pct` | double precision | yes |  |
| `mdgf_pct` | double precision | yes |  |
| `ldgf_pct` | double precision | yes |  |
| `ipp` | double precision | yes |  |
| `sh_percentage` | double precision | yes |  |
| `on_ice_sh_pct` | double precision | yes |  |
| `penalties_drawn_per_60` | double precision | yes |  |
| `total_points_per_60_percentile` | double precision | yes |  |
| `ixg_per_60_percentile` | double precision | yes |  |
| `iscfs_per_60_percentile` | double precision | yes |  |
| `penalties_drawn_per_60_percentile` | double precision | yes |  |
| `xgf_pct_percentile` | double precision | yes |  |
| `cf_pct_percentile` | double precision | yes |  |
| `shots_per_60_percentile` | double precision | yes |  |
| `gf_per_60_percentile` | double precision | yes |  |
| `scf_per_60_percentile` | double precision | yes |  |
| `hdgf_per_60_percentile` | double precision | yes |  |

## `public.nst_percentile_pk_defense`

Type: view

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `player_id` | bigint | yes |  |
| `season` | integer | yes |  |
| `gp` | bigint | yes |  |
| `toi_seconds` | bigint | yes |  |
| `ca_per_60` | double precision | yes |  |
| `fa_per_60` | double precision | yes |  |
| `sa_per_60` | double precision | yes |  |
| `ga_per_60` | double precision | yes |  |
| `xga_per_60` | double precision | yes |  |
| `sca_per_60` | double precision | yes |  |
| `hdca_per_60` | double precision | yes |  |
| `hdga_per_60` | double precision | yes |  |
| `mdga_per_60` | double precision | yes |  |
| `ldga_per_60` | double precision | yes |  |
| `shots_blocked_per_60` | double precision | yes |  |
| `takeaways_per_60` | double precision | yes |  |
| `hits_per_60` | double precision | yes |  |
| `pim_per_60` | double precision | yes |  |
| `total_penalties_per_60` | double precision | yes |  |
| `minor_penalties_per_60` | double precision | yes |  |
| `major_penalties_per_60` | double precision | yes |  |
| `misconduct_penalties_per_60` | double precision | yes |  |
| `giveaways_per_60` | double precision | yes |  |
| `on_ice_sv_pct` | double precision | yes |  |

## `public.nst_percentile_pk_defense_filtered`

Type: view

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `player_id` | bigint | yes |  |
| `season` | integer | yes |  |
| `gp` | bigint | yes |  |
| `toi_seconds` | bigint | yes |  |
| `ca_per_60` | double precision | yes |  |
| `fa_per_60` | double precision | yes |  |
| `sa_per_60` | double precision | yes |  |
| `ga_per_60` | double precision | yes |  |
| `xga_per_60` | double precision | yes |  |
| `sca_per_60` | double precision | yes |  |
| `hdca_per_60` | double precision | yes |  |
| `hdga_per_60` | double precision | yes |  |
| `mdga_per_60` | double precision | yes |  |
| `ldga_per_60` | double precision | yes |  |
| `shots_blocked_per_60` | double precision | yes |  |
| `takeaways_per_60` | double precision | yes |  |
| `hits_per_60` | double precision | yes |  |
| `pim_per_60` | double precision | yes |  |
| `total_penalties_per_60` | double precision | yes |  |
| `minor_penalties_per_60` | double precision | yes |  |
| `major_penalties_per_60` | double precision | yes |  |
| `misconduct_penalties_per_60` | double precision | yes |  |
| `giveaways_per_60` | double precision | yes |  |
| `on_ice_sv_pct` | double precision | yes |  |
| `xga_per_60_percentile` | double precision | yes |  |
| `sca_per_60_percentile` | double precision | yes |  |
| `hdca_per_60_percentile` | double precision | yes |  |
| `shots_blocked_per_60_percentile` | double precision | yes |  |
| `takeaways_per_60_percentile` | double precision | yes |  |
| `minor_penalties_per_60_percentile` | double precision | yes |  |
| `giveaways_per_60_percentile` | double precision | yes |  |
| `ga_per_60_percentile` | double precision | yes |  |
| `sa_per_60_percentile` | double precision | yes |  |

## `public.nst_percentile_pk_offense`

Type: view

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `player_id` | bigint | yes |  |
| `season` | integer | yes |  |
| `gp` | bigint | yes |  |
| `toi_seconds` | bigint | yes |  |
| `goals_per_60` | double precision | yes |  |
| `total_assists_per_60` | double precision | yes |  |
| `first_assists_per_60` | double precision | yes |  |
| `second_assists_per_60` | double precision | yes |  |
| `total_points_per_60` | double precision | yes |  |
| `shots_per_60` | double precision | yes |  |
| `ixg_per_60` | double precision | yes |  |
| `icf_per_60` | double precision | yes |  |
| `iff_per_60` | double precision | yes |  |
| `iscfs_per_60` | double precision | yes |  |
| `i_hdcf_per_60` | double precision | yes |  |
| `rush_attempts_per_60` | double precision | yes |  |
| `rebounds_created_per_60` | double precision | yes |  |
| `cf_per_60` | double precision | yes |  |
| `ff_per_60` | double precision | yes |  |
| `sf_per_60` | double precision | yes |  |
| `gf_per_60` | double precision | yes |  |
| `xgf_per_60` | double precision | yes |  |
| `scf_per_60` | double precision | yes |  |
| `oi_hdcf_per_60` | double precision | yes |  |
| `hdgf_per_60` | double precision | yes |  |
| `mdgf_per_60` | double precision | yes |  |
| `ldgf_per_60` | double precision | yes |  |
| `cf_pct` | double precision | yes |  |
| `ff_pct` | double precision | yes |  |
| `sf_pct` | double precision | yes |  |
| `gf_pct` | double precision | yes |  |
| `xgf_pct` | double precision | yes |  |
| `scf_pct` | double precision | yes |  |
| `hdcf_pct` | double precision | yes |  |
| `hdgf_pct` | double precision | yes |  |
| `mdgf_pct` | double precision | yes |  |
| `ldgf_pct` | double precision | yes |  |
| `ipp` | double precision | yes |  |
| `sh_percentage` | double precision | yes |  |
| `on_ice_sh_pct` | double precision | yes |  |
| `penalties_drawn_per_60` | double precision | yes |  |

## `public.nst_percentile_pk_offense_filtered`

Type: view

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `player_id` | bigint | yes |  |
| `season` | integer | yes |  |
| `gp` | bigint | yes |  |
| `toi_seconds` | bigint | yes |  |
| `goals_per_60` | double precision | yes |  |
| `total_assists_per_60` | double precision | yes |  |
| `first_assists_per_60` | double precision | yes |  |
| `second_assists_per_60` | double precision | yes |  |
| `total_points_per_60` | double precision | yes |  |
| `shots_per_60` | double precision | yes |  |
| `ixg_per_60` | double precision | yes |  |
| `icf_per_60` | double precision | yes |  |
| `iff_per_60` | double precision | yes |  |
| `iscfs_per_60` | double precision | yes |  |
| `i_hdcf_per_60` | double precision | yes |  |
| `rush_attempts_per_60` | double precision | yes |  |
| `rebounds_created_per_60` | double precision | yes |  |
| `cf_per_60` | double precision | yes |  |
| `ff_per_60` | double precision | yes |  |
| `sf_per_60` | double precision | yes |  |
| `gf_per_60` | double precision | yes |  |
| `xgf_per_60` | double precision | yes |  |
| `scf_per_60` | double precision | yes |  |
| `oi_hdcf_per_60` | double precision | yes |  |
| `hdgf_per_60` | double precision | yes |  |
| `mdgf_per_60` | double precision | yes |  |
| `ldgf_per_60` | double precision | yes |  |
| `cf_pct` | double precision | yes |  |
| `ff_pct` | double precision | yes |  |
| `sf_pct` | double precision | yes |  |
| `gf_pct` | double precision | yes |  |
| `xgf_pct` | double precision | yes |  |
| `scf_pct` | double precision | yes |  |
| `hdcf_pct` | double precision | yes |  |
| `hdgf_pct` | double precision | yes |  |
| `mdgf_pct` | double precision | yes |  |
| `ldgf_pct` | double precision | yes |  |
| `ipp` | double precision | yes |  |
| `sh_percentage` | double precision | yes |  |
| `on_ice_sh_pct` | double precision | yes |  |
| `penalties_drawn_per_60` | double precision | yes |  |
| `gf_per_60_percentile` | double precision | yes |  |
| `xgf_per_60_percentile` | double precision | yes |  |
| `scf_per_60_percentile` | double precision | yes |  |
| `hdgf_per_60_percentile` | double precision | yes |  |
| `shots_per_60_percentile` | double precision | yes |  |
| `total_points_per_60_percentile` | double precision | yes |  |
| `ixg_per_60_percentile` | double precision | yes |  |

## `public.nst_percentile_pp_defense`

Type: view

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `player_id` | bigint | yes |  |
| `season` | integer | yes |  |
| `gp` | bigint | yes |  |
| `toi_seconds` | bigint | yes |  |
| `ca_per_60` | double precision | yes |  |
| `fa_per_60` | double precision | yes |  |
| `sa_per_60` | double precision | yes |  |
| `ga_per_60` | double precision | yes |  |
| `xga_per_60` | double precision | yes |  |
| `sca_per_60` | double precision | yes |  |
| `hdca_per_60` | double precision | yes |  |
| `hdga_per_60` | double precision | yes |  |
| `mdga_per_60` | double precision | yes |  |
| `ldga_per_60` | double precision | yes |  |
| `shots_blocked_per_60` | double precision | yes |  |
| `takeaways_per_60` | double precision | yes |  |
| `hits_per_60` | double precision | yes |  |
| `pim_per_60` | double precision | yes |  |
| `total_penalties_per_60` | double precision | yes |  |
| `minor_penalties_per_60` | double precision | yes |  |
| `major_penalties_per_60` | double precision | yes |  |
| `misconduct_penalties_per_60` | double precision | yes |  |
| `giveaways_per_60` | double precision | yes |  |
| `on_ice_sv_pct` | double precision | yes |  |

## `public.nst_percentile_pp_defense_filtered`

Type: view

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `player_id` | bigint | yes |  |
| `season` | integer | yes |  |
| `gp` | bigint | yes |  |
| `toi_seconds` | bigint | yes |  |
| `ca_per_60` | double precision | yes |  |
| `fa_per_60` | double precision | yes |  |
| `sa_per_60` | double precision | yes |  |
| `ga_per_60` | double precision | yes |  |
| `xga_per_60` | double precision | yes |  |
| `sca_per_60` | double precision | yes |  |
| `hdca_per_60` | double precision | yes |  |
| `hdga_per_60` | double precision | yes |  |
| `mdga_per_60` | double precision | yes |  |
| `ldga_per_60` | double precision | yes |  |
| `shots_blocked_per_60` | double precision | yes |  |
| `takeaways_per_60` | double precision | yes |  |
| `hits_per_60` | double precision | yes |  |
| `pim_per_60` | double precision | yes |  |
| `total_penalties_per_60` | double precision | yes |  |
| `minor_penalties_per_60` | double precision | yes |  |
| `major_penalties_per_60` | double precision | yes |  |
| `misconduct_penalties_per_60` | double precision | yes |  |
| `giveaways_per_60` | double precision | yes |  |
| `on_ice_sv_pct` | double precision | yes |  |
| `xga_per_60_percentile` | double precision | yes |  |
| `sca_per_60_percentile` | double precision | yes |  |
| `hdca_per_60_percentile` | double precision | yes |  |
| `shots_blocked_per_60_percentile` | double precision | yes |  |
| `takeaways_per_60_percentile` | double precision | yes |  |
| `minor_penalties_per_60_percentile` | double precision | yes |  |
| `giveaways_per_60_percentile` | double precision | yes |  |
| `ga_per_60_percentile` | double precision | yes |  |
| `sa_per_60_percentile` | double precision | yes |  |

## `public.nst_percentile_pp_offense`

Type: view

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `player_id` | bigint | yes |  |
| `season` | integer | yes |  |
| `gp` | bigint | yes |  |
| `toi_seconds` | bigint | yes |  |
| `goals_per_60` | double precision | yes |  |
| `total_assists_per_60` | double precision | yes |  |
| `first_assists_per_60` | double precision | yes |  |
| `second_assists_per_60` | double precision | yes |  |
| `total_points_per_60` | double precision | yes |  |
| `shots_per_60` | double precision | yes |  |
| `ixg_per_60` | double precision | yes |  |
| `icf_per_60` | double precision | yes |  |
| `iff_per_60` | double precision | yes |  |
| `iscfs_per_60` | double precision | yes |  |
| `i_hdcf_per_60` | double precision | yes |  |
| `rush_attempts_per_60` | double precision | yes |  |
| `rebounds_created_per_60` | double precision | yes |  |
| `cf_per_60` | double precision | yes |  |
| `ff_per_60` | double precision | yes |  |
| `sf_per_60` | double precision | yes |  |
| `gf_per_60` | double precision | yes |  |
| `xgf_per_60` | double precision | yes |  |
| `scf_per_60` | double precision | yes |  |
| `oi_hdcf_per_60` | double precision | yes |  |
| `hdgf_per_60` | double precision | yes |  |
| `mdgf_per_60` | double precision | yes |  |
| `ldgf_per_60` | double precision | yes |  |
| `cf_pct` | double precision | yes |  |
| `ff_pct` | double precision | yes |  |
| `sf_pct` | double precision | yes |  |
| `gf_pct` | double precision | yes |  |
| `xgf_pct` | double precision | yes |  |
| `scf_pct` | double precision | yes |  |
| `hdcf_pct` | double precision | yes |  |
| `hdgf_pct` | double precision | yes |  |
| `mdgf_pct` | double precision | yes |  |
| `ldgf_pct` | double precision | yes |  |
| `ipp` | double precision | yes |  |
| `sh_percentage` | double precision | yes |  |
| `on_ice_sh_pct` | double precision | yes |  |
| `penalties_drawn_per_60` | double precision | yes |  |

## `public.nst_percentile_pp_offense_filtered`

Type: view

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `player_id` | bigint | yes |  |
| `season` | integer | yes |  |
| `gp` | bigint | yes |  |
| `toi_seconds` | bigint | yes |  |
| `goals_per_60` | double precision | yes |  |
| `total_assists_per_60` | double precision | yes |  |
| `first_assists_per_60` | double precision | yes |  |
| `second_assists_per_60` | double precision | yes |  |
| `total_points_per_60` | double precision | yes |  |
| `shots_per_60` | double precision | yes |  |
| `ixg_per_60` | double precision | yes |  |
| `icf_per_60` | double precision | yes |  |
| `iff_per_60` | double precision | yes |  |
| `iscfs_per_60` | double precision | yes |  |
| `i_hdcf_per_60` | double precision | yes |  |
| `rush_attempts_per_60` | double precision | yes |  |
| `rebounds_created_per_60` | double precision | yes |  |
| `cf_per_60` | double precision | yes |  |
| `ff_per_60` | double precision | yes |  |
| `sf_per_60` | double precision | yes |  |
| `gf_per_60` | double precision | yes |  |
| `xgf_per_60` | double precision | yes |  |
| `scf_per_60` | double precision | yes |  |
| `oi_hdcf_per_60` | double precision | yes |  |
| `hdgf_per_60` | double precision | yes |  |
| `mdgf_per_60` | double precision | yes |  |
| `ldgf_per_60` | double precision | yes |  |
| `cf_pct` | double precision | yes |  |
| `ff_pct` | double precision | yes |  |
| `sf_pct` | double precision | yes |  |
| `gf_pct` | double precision | yes |  |
| `xgf_pct` | double precision | yes |  |
| `scf_pct` | double precision | yes |  |
| `hdcf_pct` | double precision | yes |  |
| `hdgf_pct` | double precision | yes |  |
| `mdgf_pct` | double precision | yes |  |
| `ldgf_pct` | double precision | yes |  |
| `ipp` | double precision | yes |  |
| `sh_percentage` | double precision | yes |  |
| `on_ice_sh_pct` | double precision | yes |  |
| `penalties_drawn_per_60` | double precision | yes |  |
| `gf_per_60_percentile` | double precision | yes |  |
| `xgf_per_60_percentile` | double precision | yes |  |
| `scf_per_60_percentile` | double precision | yes |  |
| `hdgf_per_60_percentile` | double precision | yes |  |
| `shots_per_60_percentile` | double precision | yes |  |
| `total_points_per_60_percentile` | double precision | yes |  |
| `ixg_per_60_percentile` | double precision | yes |  |

## `public.nst_seasonal_individual_counts`

Type: table

Primary key: `player_id`, `season`, `team`, `strength`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `player_id` | bigint | no |  |
| `season` | integer | no |  |
| `team` | text | no |  |
| `strength` | text | no |  |
| `gp` | integer | yes |  |
| `toi` | double precision | yes |  |
| `goals` | integer | yes |  |
| `total_assists` | integer | yes |  |
| `first_assists` | integer | yes |  |
| `second_assists` | integer | yes |  |
| `total_points` | integer | yes |  |
| `ipp` | double precision | yes |  |
| `shots` | integer | yes |  |
| `sh_percentage` | double precision | yes |  |
| `ixg` | double precision | yes |  |
| `icf` | integer | yes |  |
| `iff` | integer | yes |  |
| `iscfs` | integer | yes |  |
| `ihdcf` | integer | yes |  |
| `rebounds_created` | integer | yes |  |
| `pim` | integer | yes |  |
| `total_penalties` | integer | yes |  |
| `minor_penalties` | integer | yes |  |
| `major_penalties` | integer | yes |  |
| `misconduct_penalties` | integer | yes |  |
| `penalties_drawn` | integer | yes |  |
| `giveaways` | integer | yes |  |
| `takeaways` | integer | yes |  |
| `hits` | integer | yes |  |
| `hits_taken` | integer | yes |  |
| `shots_blocked` | integer | yes |  |
| `faceoffs_won` | integer | yes |  |
| `faceoffs_lost` | integer | yes |  |
| `faceoffs_percentage` | double precision | yes |  |
| `created_at` | timestamp with time zone | no | now() |

## `public.nst_seasonal_individual_rates`

Type: table

Primary key: `player_id`, `season`, `team`, `strength`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `player_id` | bigint | no |  |
| `season` | integer | no |  |
| `team` | text | no |  |
| `strength` | text | no |  |
| `gp` | integer | yes |  |
| `toi` | double precision | yes |  |
| `toi_per_gp` | double precision | yes |  |
| `goals_per_60` | double precision | yes |  |
| `total_assists_per_60` | double precision | yes |  |
| `first_assists_per_60` | double precision | yes |  |
| `second_assists_per_60` | double precision | yes |  |
| `total_points_per_60` | double precision | yes |  |
| `ipp` | double precision | yes |  |
| `shots_per_60` | double precision | yes |  |
| `sh_percentage` | double precision | yes |  |
| `ixg_per_60` | double precision | yes |  |
| `icf_per_60` | double precision | yes |  |
| `iff_per_60` | double precision | yes |  |
| `iscfs_per_60` | double precision | yes |  |
| `ihdcf_per_60` | double precision | yes |  |
| `rebounds_created_per_60` | double precision | yes |  |
| `pim_per_60` | double precision | yes |  |
| `total_penalties_per_60` | double precision | yes |  |
| `minor_penalties_per_60` | double precision | yes |  |
| `major_penalties_per_60` | double precision | yes |  |
| `misconduct_penalties_per_60` | double precision | yes |  |
| `penalties_drawn_per_60` | double precision | yes |  |
| `giveaways_per_60` | double precision | yes |  |
| `takeaways_per_60` | double precision | yes |  |
| `hits_per_60` | double precision | yes |  |
| `hits_taken_per_60` | double precision | yes |  |
| `shots_blocked_per_60` | double precision | yes |  |
| `faceoffs_won_per_60` | double precision | yes |  |
| `faceoffs_lost_per_60` | double precision | yes |  |
| `faceoffs_percentage` | double precision | yes |  |
| `created_at` | timestamp with time zone | no | now() |

## `public.nst_seasonal_on_ice_counts`

Type: table

Primary key: `player_id`, `season`, `team`, `strength`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `player_id` | bigint | no |  |
| `season` | integer | no |  |
| `team` | text | no |  |
| `strength` | text | no |  |
| `gp` | integer | yes |  |
| `toi` | double precision | yes |  |
| `cf` | integer | yes |  |
| `ca` | integer | yes |  |
| `cf_pct` | double precision | yes |  |
| `ff` | integer | yes |  |
| `fa` | integer | yes |  |
| `ff_pct` | double precision | yes |  |
| `sf` | integer | yes |  |
| `sa` | integer | yes |  |
| `sf_pct` | double precision | yes |  |
| `gf` | integer | yes |  |
| `ga` | integer | yes |  |
| `gf_pct` | double precision | yes |  |
| `xgf` | double precision | yes |  |
| `xga` | double precision | yes |  |
| `xgf_pct` | double precision | yes |  |
| `scf` | integer | yes |  |
| `sca` | integer | yes |  |
| `scf_pct` | double precision | yes |  |
| `hdcf` | integer | yes |  |
| `hdca` | integer | yes |  |
| `hdcf_pct` | double precision | yes |  |
| `hdgf` | integer | yes |  |
| `hdga` | integer | yes |  |
| `hdgf_pct` | double precision | yes |  |
| `mdcf` | integer | yes |  |
| `mdca` | integer | yes |  |
| `mdcf_pct` | double precision | yes |  |
| `mdgf` | integer | yes |  |
| `mdga` | integer | yes |  |
| `mdgf_pct` | double precision | yes |  |
| `ldcf` | integer | yes |  |
| `ldca` | integer | yes |  |
| `ldcf_pct` | double precision | yes |  |
| `ldgf` | integer | yes |  |
| `ldga` | integer | yes |  |
| `ldgf_pct` | double precision | yes |  |
| `on_ice_sh_pct` | double precision | yes |  |
| `on_ice_sv_pct` | double precision | yes |  |
| `pdo` | double precision | yes |  |
| `off_zone_starts` | double precision | yes |  |
| `neu_zone_starts` | double precision | yes |  |
| `def_zone_starts` | double precision | yes |  |
| `on_the_fly_starts` | double precision | yes |  |
| `off_zone_start_pct` | double precision | yes |  |
| `off_zone_faceoffs` | double precision | yes |  |
| `neu_zone_faceoffs` | double precision | yes |  |
| `def_zone_faceoffs` | double precision | yes |  |
| `off_zone_faceoff_pct` | double precision | yes |  |
| `created_at` | timestamp with time zone | no | now() |

## `public.nst_seasonal_on_ice_rates`

Type: table

Primary key: `player_id`, `season`, `team`, `strength`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `player_id` | bigint | no |  |
| `season` | integer | no |  |
| `team` | text | no |  |
| `strength` | text | no |  |
| `gp` | integer | yes |  |
| `toi` | double precision | yes |  |
| `toi_per_gp` | double precision | yes |  |
| `cf_per_60` | double precision | yes |  |
| `ca_per_60` | double precision | yes |  |
| `cf_pct` | double precision | yes |  |
| `ff_per_60` | double precision | yes |  |
| `fa_per_60` | double precision | yes |  |
| `ff_pct` | double precision | yes |  |
| `sf_per_60` | double precision | yes |  |
| `sa_per_60` | double precision | yes |  |
| `sf_pct` | double precision | yes |  |
| `gf_per_60` | double precision | yes |  |
| `ga_per_60` | double precision | yes |  |
| `gf_pct` | double precision | yes |  |
| `xgf_per_60` | double precision | yes |  |
| `xga_per_60` | double precision | yes |  |
| `xgf_pct` | double precision | yes |  |
| `scf_per_60` | double precision | yes |  |
| `sca_per_60` | double precision | yes |  |
| `scf_pct` | double precision | yes |  |
| `hdcf_per_60` | double precision | yes |  |
| `hdca_per_60` | double precision | yes |  |
| `hdcf_pct` | double precision | yes |  |
| `hdgf_per_60` | double precision | yes |  |
| `hdga_per_60` | double precision | yes |  |
| `hdgf_pct` | double precision | yes |  |
| `mdcf_per_60` | double precision | yes |  |
| `mdca_per_60` | double precision | yes |  |
| `mdcf_pct` | double precision | yes |  |
| `mdgf_per_60` | double precision | yes |  |
| `mdga_per_60` | double precision | yes |  |
| `mdgf_pct` | double precision | yes |  |
| `ldcf_per_60` | double precision | yes |  |
| `ldca_per_60` | double precision | yes |  |
| `ldcf_pct` | double precision | yes |  |
| `ldgf_per_60` | double precision | yes |  |
| `ldga_per_60` | double precision | yes |  |
| `ldgf_pct` | double precision | yes |  |
| `on_ice_sh_pct` | double precision | yes |  |
| `on_ice_sv_pct` | double precision | yes |  |
| `pdo` | double precision | yes |  |
| `off_zone_starts_per_60` | double precision | yes |  |
| `neu_zone_starts_per_60` | double precision | yes |  |
| `def_zone_starts_per_60` | double precision | yes |  |
| `on_the_fly_starts_per_60` | double precision | yes |  |
| `off_zone_start_pct` | double precision | yes |  |
| `off_zone_faceoffs_per_60` | double precision | yes |  |
| `neu_zone_faceoffs_per_60` | double precision | yes |  |
| `def_zone_faceoffs_per_60` | double precision | yes |  |
| `off_zone_faceoff_pct` | double precision | yes |  |
| `created_at` | timestamp with time zone | no | now() |

## `public.nst_seasonlong_as_counts`

Type: view

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `player_id` | bigint | yes |  |
| `season` | integer | yes |  |
| `gp` | bigint | yes |  |
| `toi_seconds` | bigint | yes |  |
| `goals` | bigint | yes |  |
| `total_assists` | bigint | yes |  |
| `first_assists` | bigint | yes |  |
| `second_assists` | bigint | yes |  |
| `total_points` | bigint | yes |  |
| `shots` | bigint | yes |  |
| `sh_percentage` | double precision | yes |  |
| `ixg` | double precision | yes |  |
| `icf` | bigint | yes |  |
| `iff` | bigint | yes |  |
| `iscfs` | bigint | yes |  |
| `hdcf` | bigint | yes |  |
| `rush_attempts` | bigint | yes |  |
| `rebounds_created` | bigint | yes |  |
| `pim` | bigint | yes |  |
| `total_penalties` | bigint | yes |  |
| `minor_penalties` | bigint | yes |  |
| `major_penalties` | bigint | yes |  |
| `misconduct_penalties` | bigint | yes |  |
| `penalties_drawn` | bigint | yes |  |
| `giveaways` | bigint | yes |  |
| `takeaways` | bigint | yes |  |
| `hits` | bigint | yes |  |
| `hits_taken` | bigint | yes |  |
| `shots_blocked` | bigint | yes |  |
| `faceoffs_won` | bigint | yes |  |
| `faceoffs_lost` | bigint | yes |  |
| `faceoffs_percentage` | double precision | yes |  |

## `public.nst_seasonlong_as_counts_oi`

Type: view

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `player_id` | integer | yes |  |
| `season` | integer | yes |  |
| `gp` | bigint | yes |  |
| `toi_seconds_oi` | bigint | yes |  |
| `cf` | bigint | yes |  |
| `ca` | bigint | yes |  |
| `ff` | bigint | yes |  |
| `fa` | bigint | yes |  |
| `sf` | bigint | yes |  |
| `sa` | bigint | yes |  |
| `gf` | bigint | yes |  |
| `ga` | bigint | yes |  |
| `xgf` | double precision | yes |  |
| `xga` | double precision | yes |  |
| `scf` | bigint | yes |  |
| `sca` | bigint | yes |  |
| `hdcf` | bigint | yes |  |
| `hdca` | bigint | yes |  |
| `hdgf` | bigint | yes |  |
| `hdga` | double precision | yes |  |
| `mdcf` | bigint | yes |  |
| `mdca` | bigint | yes |  |
| `mdgf` | bigint | yes |  |
| `mdga` | bigint | yes |  |
| `ldcf` | bigint | yes |  |
| `ldca` | bigint | yes |  |
| `ldgf` | bigint | yes |  |
| `ldga` | bigint | yes |  |
| `off_zone_starts` | bigint | yes |  |
| `neu_zone_starts` | bigint | yes |  |
| `def_zone_starts` | bigint | yes |  |
| `off_zone_faceoffs` | bigint | yes |  |
| `neu_zone_faceoffs` | bigint | yes |  |
| `def_zone_faceoffs` | bigint | yes |  |

## `public.nst_seasonlong_as_rates`

Type: view

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `player_id` | bigint | yes |  |
| `season` | integer | yes |  |
| `gp` | bigint | yes |  |
| `toi_seconds` | bigint | yes |  |
| `goals_per_60` | double precision | yes |  |
| `total_assists_per_60` | double precision | yes |  |
| `first_assists_per_60` | double precision | yes |  |
| `second_assists_per_60` | double precision | yes |  |
| `total_points_per_60` | double precision | yes |  |
| `shots_per_60` | double precision | yes |  |
| `ixg_per_60` | double precision | yes |  |
| `icf_per_60` | double precision | yes |  |
| `iff_per_60` | double precision | yes |  |
| `iscfs_per_60` | double precision | yes |  |
| `ihdcf_per_60` | double precision | yes |  |
| `rush_attempts_per_60` | double precision | yes |  |
| `rebounds_created_per_60` | double precision | yes |  |
| `pim_per_60` | double precision | yes |  |
| `total_penalties_per_60` | double precision | yes |  |
| `minor_penalties_per_60` | double precision | yes |  |
| `major_penalties_per_60` | double precision | yes |  |
| `misconduct_penalties_per_60` | double precision | yes |  |
| `penalties_drawn_per_60` | double precision | yes |  |
| `giveaways_per_60` | double precision | yes |  |
| `takeaways_per_60` | double precision | yes |  |
| `hits_per_60` | double precision | yes |  |
| `hits_taken_per_60` | double precision | yes |  |
| `shots_blocked_per_60` | double precision | yes |  |
| `faceoffs_won_per_60` | double precision | yes |  |
| `faceoffs_lost_per_60` | double precision | yes |  |
| `sh_percentage` | double precision | yes |  |
| `faceoffs_percentage` | double precision | yes |  |
| `ipp` | double precision | yes |  |

## `public.nst_seasonlong_as_rates_oi`

Type: view

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `player_id` | integer | yes |  |
| `season` | integer | yes |  |
| `gp` | bigint | yes |  |
| `toi_seconds_oi` | bigint | yes |  |
| `cf_per_60` | double precision | yes |  |
| `ca_per_60` | double precision | yes |  |
| `ff_per_60` | double precision | yes |  |
| `fa_per_60` | double precision | yes |  |
| `sf_per_60` | double precision | yes |  |
| `sa_per_60` | double precision | yes |  |
| `gf_per_60` | double precision | yes |  |
| `ga_per_60` | double precision | yes |  |
| `xgf_per_60` | double precision | yes |  |
| `xga_per_60` | double precision | yes |  |
| `scf_per_60` | double precision | yes |  |
| `sca_per_60` | double precision | yes |  |
| `hdcf_per_60` | double precision | yes |  |
| `hdca_per_60` | double precision | yes |  |
| `hdgf_per_60` | double precision | yes |  |
| `hdga_per_60` | double precision | yes |  |
| `mdcf_per_60` | double precision | yes |  |
| `mdca_per_60` | double precision | yes |  |
| `mdgf_per_60` | double precision | yes |  |
| `mdga_per_60` | double precision | yes |  |
| `ldcf_per_60` | double precision | yes |  |
| `ldca_per_60` | double precision | yes |  |
| `ldgf_per_60` | double precision | yes |  |
| `ldga_per_60` | double precision | yes |  |
| `cf_pct` | double precision | yes |  |
| `ff_pct` | double precision | yes |  |
| `sf_pct` | double precision | yes |  |
| `gf_pct` | double precision | yes |  |
| `xgf_pct` | double precision | yes |  |
| `scf_pct` | double precision | yes |  |
| `hdcf_pct` | double precision | yes |  |
| `hdgf_pct` | double precision | yes |  |
| `mdcf_pct` | double precision | yes |  |
| `mdgf_pct` | double precision | yes |  |
| `ldcf_pct` | double precision | yes |  |
| `ldgf_pct` | double precision | yes |  |
| `on_ice_sh_pct` | double precision | yes |  |
| `on_ice_sv_pct` | double precision | yes |  |
| `pdo` | double precision | yes |  |
| `off_zone_start_pct` | double precision | yes |  |
| `off_zone_faceoff_pct` | double precision | yes |  |

## `public.nst_seasonlong_combined_es`

Type: view

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `player_id` | bigint | yes |  |
| `season` | integer | yes |  |
| `gp` | bigint | yes |  |
| `toi_seconds` | bigint | yes |  |
| `toi_seconds_oi` | bigint | yes |  |
| `goals` | bigint | yes |  |
| `total_assists` | bigint | yes |  |
| `first_assists` | bigint | yes |  |
| `second_assists` | bigint | yes |  |
| `total_points` | bigint | yes |  |
| `shots` | bigint | yes |  |
| `sh_percentage` | double precision | yes |  |
| `ixg` | double precision | yes |  |
| `icf` | bigint | yes |  |
| `iff` | bigint | yes |  |
| `iscfs` | bigint | yes |  |
| `hdcf` | bigint | yes |  |
| `rush_attempts` | bigint | yes |  |
| `rebounds_created` | bigint | yes |  |
| `pim` | bigint | yes |  |
| `total_penalties` | bigint | yes |  |
| `minor_penalties` | bigint | yes |  |
| `major_penalties` | bigint | yes |  |
| `misconduct_penalties` | bigint | yes |  |
| `penalties_drawn` | bigint | yes |  |
| `giveaways` | bigint | yes |  |
| `takeaways` | bigint | yes |  |
| `hits` | bigint | yes |  |
| `hits_taken` | bigint | yes |  |
| `shots_blocked` | bigint | yes |  |
| `faceoffs_won` | bigint | yes |  |
| `faceoffs_lost` | bigint | yes |  |
| `faceoffs_percentage` | double precision | yes |  |
| `cf` | bigint | yes |  |
| `ca` | bigint | yes |  |
| `ff` | bigint | yes |  |
| `fa` | bigint | yes |  |
| `sf` | bigint | yes |  |
| `sa` | bigint | yes |  |
| `gf` | bigint | yes |  |
| `ga` | bigint | yes |  |
| `xgf` | double precision | yes |  |
| `xga` | double precision | yes |  |
| `scf` | bigint | yes |  |
| `sca` | bigint | yes |  |
| `hdcf_onice` | bigint | yes |  |
| `hdca` | bigint | yes |  |
| `hdgf` | bigint | yes |  |
| `hdga` | bigint | yes |  |
| `mdcf` | bigint | yes |  |
| `mdca` | bigint | yes |  |
| `mdgf` | bigint | yes |  |
| `mdga` | bigint | yes |  |
| `ldcf` | bigint | yes |  |
| `ldca` | bigint | yes |  |
| `ldgf` | bigint | yes |  |
| `ldga` | bigint | yes |  |
| `off_zone_starts` | bigint | yes |  |
| `neu_zone_starts` | bigint | yes |  |
| `def_zone_starts` | bigint | yes |  |
| `off_zone_faceoffs` | bigint | yes |  |
| `neu_zone_faceoffs` | bigint | yes |  |
| `def_zone_faceoffs` | bigint | yes |  |
| `ipp` | double precision | yes |  |
| `cf_pct` | double precision | yes |  |
| `ff_pct` | double precision | yes |  |
| `sf_pct` | double precision | yes |  |
| `gf_pct` | double precision | yes |  |
| `xgf_pct` | double precision | yes |  |
| `scf_pct` | double precision | yes |  |
| `hdcf_pct` | double precision | yes |  |
| `hdgf_pct` | double precision | yes |  |
| `on_ice_sh_pct` | double precision | yes |  |
| `on_ice_sv_pct` | double precision | yes |  |
| `pdo` | double precision | yes |  |
| `off_zone_start_pct` | double precision | yes |  |
| `off_zone_faceoff_pct` | double precision | yes |  |
| `cf_per_60` | double precision | yes |  |
| `ca_per_60` | double precision | yes |  |
| `ff_per_60` | double precision | yes |  |
| `fa_per_60` | double precision | yes |  |
| `sf_per_60` | double precision | yes |  |
| `sa_per_60` | double precision | yes |  |
| `gf_per_60` | double precision | yes |  |
| `ga_per_60` | double precision | yes |  |
| `xgf_per_60` | double precision | yes |  |
| `xga_per_60` | double precision | yes |  |
| `scf_per_60` | double precision | yes |  |
| `sca_per_60` | double precision | yes |  |
| `hdcf_per_60` | double precision | yes |  |
| `hdca_per_60` | double precision | yes |  |
| `hdgf_per_60` | double precision | yes |  |
| `hdga_per_60` | double precision | yes |  |
| `goals_per_60` | double precision | yes |  |
| `assists_per_60` | double precision | yes |  |
| `first_assists_per_60` | double precision | yes |  |
| `second_assists_per_60` | double precision | yes |  |
| `points_per_60` | double precision | yes |  |
| `shots_per_60` | double precision | yes |  |
| `ixg_per_60` | double precision | yes |  |
| `icf_per_60` | double precision | yes |  |
| `iff_per_60` | double precision | yes |  |
| `iscfs_per_60` | double precision | yes |  |
| `ihdcf_per_60` | double precision | yes |  |
| `rush_attempts_per_60` | double precision | yes |  |
| `rebounds_created_per_60` | double precision | yes |  |
| `pim_per_60` | double precision | yes |  |
| `total_penalties_per_60` | double precision | yes |  |
| `penalties_drawn_per_60` | double precision | yes |  |
| `giveaways_per_60` | double precision | yes |  |
| `takeaways_per_60` | double precision | yes |  |
| `hits_per_60` | double precision | yes |  |
| `hits_taken_per_60` | double precision | yes |  |
| `shots_blocked_per_60` | double precision | yes |  |
| `faceoffs_won_per_60` | double precision | yes |  |
| `faceoffs_lost_per_60` | double precision | yes |  |

## `public.nst_seasonlong_combined_pk`

Type: view

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `player_id` | bigint | yes |  |
| `season` | integer | yes |  |
| `gp` | bigint | yes |  |
| `toi_seconds` | bigint | yes |  |
| `toi_seconds_oi` | bigint | yes |  |
| `goals` | bigint | yes |  |
| `total_assists` | bigint | yes |  |
| `first_assists` | bigint | yes |  |
| `second_assists` | bigint | yes |  |
| `total_points` | bigint | yes |  |
| `shots` | bigint | yes |  |
| `sh_percentage` | double precision | yes |  |
| `ixg` | double precision | yes |  |
| `icf` | bigint | yes |  |
| `iff` | bigint | yes |  |
| `iscfs` | bigint | yes |  |
| `hdcf` | bigint | yes |  |
| `rush_attempts` | bigint | yes |  |
| `rebounds_created` | bigint | yes |  |
| `pim` | bigint | yes |  |
| `total_penalties` | bigint | yes |  |
| `minor_penalties` | bigint | yes |  |
| `major_penalties` | bigint | yes |  |
| `misconduct_penalties` | bigint | yes |  |
| `penalties_drawn` | bigint | yes |  |
| `giveaways` | bigint | yes |  |
| `takeaways` | bigint | yes |  |
| `hits` | bigint | yes |  |
| `hits_taken` | bigint | yes |  |
| `shots_blocked` | bigint | yes |  |
| `faceoffs_won` | bigint | yes |  |
| `faceoffs_lost` | bigint | yes |  |
| `faceoffs_percentage` | double precision | yes |  |
| `cf` | bigint | yes |  |
| `ca` | bigint | yes |  |
| `ff` | bigint | yes |  |
| `fa` | bigint | yes |  |
| `sf` | bigint | yes |  |
| `sa` | bigint | yes |  |
| `gf` | bigint | yes |  |
| `ga` | bigint | yes |  |
| `xgf` | double precision | yes |  |
| `xga` | double precision | yes |  |
| `scf` | bigint | yes |  |
| `sca` | bigint | yes |  |
| `hdcf_onice` | bigint | yes |  |
| `hdca` | bigint | yes |  |
| `hdgf` | bigint | yes |  |
| `hdga` | bigint | yes |  |
| `mdcf` | bigint | yes |  |
| `mdca` | bigint | yes |  |
| `mdgf` | bigint | yes |  |
| `mdga` | bigint | yes |  |
| `ldcf` | bigint | yes |  |
| `ldca` | bigint | yes |  |
| `ldgf` | bigint | yes |  |
| `ldga` | bigint | yes |  |
| `off_zone_starts` | bigint | yes |  |
| `neu_zone_starts` | bigint | yes |  |
| `def_zone_starts` | bigint | yes |  |
| `off_zone_faceoffs` | bigint | yes |  |
| `neu_zone_faceoffs` | bigint | yes |  |
| `def_zone_faceoffs` | bigint | yes |  |
| `ipp` | double precision | yes |  |
| `cf_pct` | double precision | yes |  |
| `ff_pct` | double precision | yes |  |
| `sf_pct` | double precision | yes |  |
| `gf_pct` | double precision | yes |  |
| `xgf_pct` | double precision | yes |  |
| `scf_pct` | double precision | yes |  |
| `hdcf_pct` | double precision | yes |  |
| `hdgf_pct` | double precision | yes |  |
| `on_ice_sh_pct` | double precision | yes |  |
| `on_ice_sv_pct` | double precision | yes |  |
| `pdo` | double precision | yes |  |
| `off_zone_start_pct` | double precision | yes |  |
| `off_zone_faceoff_pct` | double precision | yes |  |
| `cf_per_60` | double precision | yes |  |
| `ca_per_60` | double precision | yes |  |
| `ff_per_60` | double precision | yes |  |
| `fa_per_60` | double precision | yes |  |
| `sf_per_60` | double precision | yes |  |
| `sa_per_60` | double precision | yes |  |
| `gf_per_60` | double precision | yes |  |
| `ga_per_60` | double precision | yes |  |
| `xgf_per_60` | double precision | yes |  |
| `xga_per_60` | double precision | yes |  |
| `scf_per_60` | double precision | yes |  |
| `sca_per_60` | double precision | yes |  |
| `hdcf_per_60` | double precision | yes |  |
| `hdca_per_60` | double precision | yes |  |
| `hdgf_per_60` | double precision | yes |  |
| `hdga_per_60` | double precision | yes |  |
| `goals_per_60` | double precision | yes |  |
| `assists_per_60` | double precision | yes |  |
| `first_assists_per_60` | double precision | yes |  |
| `second_assists_per_60` | double precision | yes |  |
| `points_per_60` | double precision | yes |  |
| `shots_per_60` | double precision | yes |  |
| `ixg_per_60` | double precision | yes |  |
| `icf_per_60` | double precision | yes |  |
| `iff_per_60` | double precision | yes |  |
| `iscfs_per_60` | double precision | yes |  |
| `ihdcf_per_60` | double precision | yes |  |
| `rush_attempts_per_60` | double precision | yes |  |
| `rebounds_created_per_60` | double precision | yes |  |
| `pim_per_60` | double precision | yes |  |
| `total_penalties_per_60` | double precision | yes |  |
| `penalties_drawn_per_60` | double precision | yes |  |
| `giveaways_per_60` | double precision | yes |  |
| `takeaways_per_60` | double precision | yes |  |
| `hits_per_60` | double precision | yes |  |
| `hits_taken_per_60` | double precision | yes |  |
| `shots_blocked_per_60` | double precision | yes |  |
| `faceoffs_won_per_60` | double precision | yes |  |
| `faceoffs_lost_per_60` | double precision | yes |  |

## `public.nst_seasonlong_combined_pp`

Type: view

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `player_id` | bigint | yes |  |
| `season` | integer | yes |  |
| `gp` | bigint | yes |  |
| `toi_seconds` | bigint | yes |  |
| `toi_seconds_oi` | bigint | yes |  |
| `goals` | bigint | yes |  |
| `total_assists` | bigint | yes |  |
| `first_assists` | bigint | yes |  |
| `second_assists` | bigint | yes |  |
| `total_points` | bigint | yes |  |
| `shots` | bigint | yes |  |
| `sh_percentage` | double precision | yes |  |
| `ixg` | double precision | yes |  |
| `icf` | bigint | yes |  |
| `iff` | bigint | yes |  |
| `iscfs` | bigint | yes |  |
| `hdcf` | bigint | yes |  |
| `rush_attempts` | bigint | yes |  |
| `rebounds_created` | bigint | yes |  |
| `pim` | bigint | yes |  |
| `total_penalties` | bigint | yes |  |
| `minor_penalties` | bigint | yes |  |
| `major_penalties` | bigint | yes |  |
| `misconduct_penalties` | bigint | yes |  |
| `penalties_drawn` | bigint | yes |  |
| `giveaways` | bigint | yes |  |
| `takeaways` | bigint | yes |  |
| `hits` | bigint | yes |  |
| `hits_taken` | bigint | yes |  |
| `shots_blocked` | bigint | yes |  |
| `faceoffs_won` | bigint | yes |  |
| `faceoffs_lost` | bigint | yes |  |
| `faceoffs_percentage` | double precision | yes |  |
| `cf` | bigint | yes |  |
| `ca` | bigint | yes |  |
| `ff` | bigint | yes |  |
| `fa` | bigint | yes |  |
| `sf` | bigint | yes |  |
| `sa` | bigint | yes |  |
| `gf` | bigint | yes |  |
| `ga` | bigint | yes |  |
| `xgf` | double precision | yes |  |
| `xga` | double precision | yes |  |
| `scf` | bigint | yes |  |
| `sca` | bigint | yes |  |
| `hdcf_onice` | bigint | yes |  |
| `hdca` | bigint | yes |  |
| `hdgf` | bigint | yes |  |
| `hdga` | bigint | yes |  |
| `mdcf` | bigint | yes |  |
| `mdca` | bigint | yes |  |
| `mdgf` | bigint | yes |  |
| `mdga` | bigint | yes |  |
| `ldcf` | bigint | yes |  |
| `ldca` | bigint | yes |  |
| `ldgf` | bigint | yes |  |
| `ldga` | bigint | yes |  |
| `off_zone_starts` | bigint | yes |  |
| `neu_zone_starts` | bigint | yes |  |
| `def_zone_starts` | bigint | yes |  |
| `on_the_fly_starts` | bigint | yes |  |
| `off_zone_faceoffs` | bigint | yes |  |
| `neu_zone_faceoffs` | bigint | yes |  |
| `def_zone_faceoffs` | bigint | yes |  |
| `ipp` | double precision | yes |  |
| `cf_pct` | double precision | yes |  |
| `ff_pct` | double precision | yes |  |
| `sf_pct` | double precision | yes |  |
| `gf_pct` | double precision | yes |  |
| `xgf_pct` | double precision | yes |  |
| `scf_pct` | double precision | yes |  |
| `hdcf_pct` | double precision | yes |  |
| `hdgf_pct` | double precision | yes |  |
| `on_ice_sh_pct` | double precision | yes |  |
| `on_ice_sv_pct` | double precision | yes |  |
| `pdo` | double precision | yes |  |
| `off_zone_start_pct` | double precision | yes |  |
| `off_zone_faceoff_pct` | double precision | yes |  |
| `cf_per_60` | double precision | yes |  |
| `ca_per_60` | double precision | yes |  |
| `ff_per_60` | double precision | yes |  |
| `fa_per_60` | double precision | yes |  |
| `sf_per_60` | double precision | yes |  |
| `sa_per_60` | double precision | yes |  |
| `gf_per_60` | double precision | yes |  |
| `ga_per_60` | double precision | yes |  |
| `xgf_per_60` | double precision | yes |  |
| `xga_per_60` | double precision | yes |  |
| `scf_per_60` | double precision | yes |  |
| `sca_per_60` | double precision | yes |  |
| `hdcf_per_60` | double precision | yes |  |
| `hdca_per_60` | double precision | yes |  |
| `hdgf_per_60` | double precision | yes |  |
| `hdga_per_60` | double precision | yes |  |
| `goals_per_60` | double precision | yes |  |
| `assists_per_60` | double precision | yes |  |
| `first_assists_per_60` | double precision | yes |  |
| `second_assists_per_60` | double precision | yes |  |
| `points_per_60` | double precision | yes |  |
| `shots_per_60` | double precision | yes |  |
| `ixg_per_60` | double precision | yes |  |
| `icf_per_60` | double precision | yes |  |
| `iff_per_60` | double precision | yes |  |
| `iscfs_per_60` | double precision | yes |  |
| `ihdcf_per_60` | double precision | yes |  |
| `rush_attempts_per_60` | double precision | yes |  |
| `rebounds_created_per_60` | double precision | yes |  |
| `pim_per_60` | double precision | yes |  |
| `total_penalties_per_60` | double precision | yes |  |
| `penalties_drawn_per_60` | double precision | yes |  |
| `giveaways_per_60` | double precision | yes |  |
| `takeaways_per_60` | double precision | yes |  |
| `hits_per_60` | double precision | yes |  |
| `hits_taken_per_60` | double precision | yes |  |
| `shots_blocked_per_60` | double precision | yes |  |
| `faceoffs_won_per_60` | double precision | yes |  |
| `faceoffs_lost_per_60` | double precision | yes |  |

## `public.nst_seasonlong_es_counts`

Type: view

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `player_id` | bigint | yes |  |
| `season` | integer | yes |  |
| `gp` | bigint | yes |  |
| `toi_seconds` | bigint | yes |  |
| `goals` | bigint | yes |  |
| `total_assists` | bigint | yes |  |
| `first_assists` | bigint | yes |  |
| `second_assists` | bigint | yes |  |
| `total_points` | bigint | yes |  |
| `shots` | bigint | yes |  |
| `sh_percentage` | double precision | yes |  |
| `ixg` | double precision | yes |  |
| `icf` | bigint | yes |  |
| `iff` | bigint | yes |  |
| `iscfs` | bigint | yes |  |
| `hdcf` | bigint | yes |  |
| `rush_attempts` | bigint | yes |  |
| `rebounds_created` | bigint | yes |  |
| `pim` | bigint | yes |  |
| `total_penalties` | bigint | yes |  |
| `minor_penalties` | bigint | yes |  |
| `major_penalties` | bigint | yes |  |
| `misconduct_penalties` | bigint | yes |  |
| `penalties_drawn` | bigint | yes |  |
| `giveaways` | bigint | yes |  |
| `takeaways` | bigint | yes |  |
| `hits` | bigint | yes |  |
| `hits_taken` | bigint | yes |  |
| `shots_blocked` | bigint | yes |  |
| `faceoffs_won` | bigint | yes |  |
| `faceoffs_lost` | bigint | yes |  |
| `faceoffs_percentage` | double precision | yes |  |

## `public.nst_seasonlong_es_counts_oi`

Type: view

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `player_id` | bigint | yes |  |
| `season` | integer | yes |  |
| `gp` | bigint | yes |  |
| `toi_seconds_oi` | bigint | yes |  |
| `cf` | bigint | yes |  |
| `ca` | bigint | yes |  |
| `ff` | bigint | yes |  |
| `fa` | bigint | yes |  |
| `sf` | bigint | yes |  |
| `sa` | bigint | yes |  |
| `gf` | bigint | yes |  |
| `ga` | bigint | yes |  |
| `xgf` | double precision | yes |  |
| `xga` | double precision | yes |  |
| `scf` | bigint | yes |  |
| `sca` | bigint | yes |  |
| `hdcf` | bigint | yes |  |
| `hdca` | bigint | yes |  |
| `hdgf` | bigint | yes |  |
| `hdga` | bigint | yes |  |
| `mdcf` | bigint | yes |  |
| `mdca` | bigint | yes |  |
| `mdgf` | bigint | yes |  |
| `mdga` | bigint | yes |  |
| `ldcf` | bigint | yes |  |
| `ldca` | bigint | yes |  |
| `ldgf` | bigint | yes |  |
| `ldga` | bigint | yes |  |
| `off_zone_starts` | bigint | yes |  |
| `neu_zone_starts` | bigint | yes |  |
| `def_zone_starts` | bigint | yes |  |
| `off_zone_faceoffs` | bigint | yes |  |
| `neu_zone_faceoffs` | bigint | yes |  |
| `def_zone_faceoffs` | bigint | yes |  |

## `public.nst_seasonlong_es_rates`

Type: view

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `player_id` | bigint | yes |  |
| `season` | integer | yes |  |
| `gp` | bigint | yes |  |
| `toi_seconds` | bigint | yes |  |
| `goals_per_60` | double precision | yes |  |
| `total_assists_per_60` | double precision | yes |  |
| `first_assists_per_60` | double precision | yes |  |
| `second_assists_per_60` | double precision | yes |  |
| `total_points_per_60` | double precision | yes |  |
| `shots_per_60` | double precision | yes |  |
| `ixg_per_60` | double precision | yes |  |
| `icf_per_60` | double precision | yes |  |
| `iff_per_60` | double precision | yes |  |
| `iscfs_per_60` | double precision | yes |  |
| `ihdcf_per_60` | double precision | yes |  |
| `rush_attempts_per_60` | double precision | yes |  |
| `rebounds_created_per_60` | double precision | yes |  |
| `pim_per_60` | double precision | yes |  |
| `total_penalties_per_60` | double precision | yes |  |
| `minor_penalties_per_60` | double precision | yes |  |
| `major_penalties_per_60` | double precision | yes |  |
| `misconduct_penalties_per_60` | double precision | yes |  |
| `penalties_drawn_per_60` | double precision | yes |  |
| `giveaways_per_60` | double precision | yes |  |
| `takeaways_per_60` | double precision | yes |  |
| `hits_per_60` | double precision | yes |  |
| `hits_taken_per_60` | double precision | yes |  |
| `shots_blocked_per_60` | double precision | yes |  |
| `faceoffs_won_per_60` | double precision | yes |  |
| `faceoffs_lost_per_60` | double precision | yes |  |
| `sh_percentage` | double precision | yes |  |
| `faceoffs_percentage` | double precision | yes |  |
| `ipp` | double precision | yes |  |

## `public.nst_seasonlong_es_rates_oi`

Type: view

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `player_id` | bigint | yes |  |
| `season` | integer | yes |  |
| `gp` | bigint | yes |  |
| `toi_seconds_oi` | bigint | yes |  |
| `cf_per_60` | double precision | yes |  |
| `ca_per_60` | double precision | yes |  |
| `ff_per_60` | double precision | yes |  |
| `fa_per_60` | double precision | yes |  |
| `sf_per_60` | double precision | yes |  |
| `sa_per_60` | double precision | yes |  |
| `gf_per_60` | double precision | yes |  |
| `ga_per_60` | double precision | yes |  |
| `xgf_per_60` | double precision | yes |  |
| `xga_per_60` | double precision | yes |  |
| `scf_per_60` | double precision | yes |  |
| `sca_per_60` | double precision | yes |  |
| `hdcf_per_60` | double precision | yes |  |
| `hdca_per_60` | double precision | yes |  |
| `hdgf_per_60` | double precision | yes |  |
| `hdga_per_60` | double precision | yes |  |
| `mdcf_per_60` | double precision | yes |  |
| `mdca_per_60` | double precision | yes |  |
| `mdgf_per_60` | double precision | yes |  |
| `mdga_per_60` | double precision | yes |  |
| `ldcf_per_60` | double precision | yes |  |
| `ldca_per_60` | double precision | yes |  |
| `ldgf_per_60` | double precision | yes |  |
| `ldga_per_60` | double precision | yes |  |
| `cf_pct` | double precision | yes |  |
| `ff_pct` | double precision | yes |  |
| `sf_pct` | double precision | yes |  |
| `gf_pct` | double precision | yes |  |
| `xgf_pct` | double precision | yes |  |
| `scf_pct` | double precision | yes |  |
| `hdcf_pct` | double precision | yes |  |
| `hdgf_pct` | double precision | yes |  |
| `mdcf_pct` | double precision | yes |  |
| `mdgf_pct` | double precision | yes |  |
| `ldcf_pct` | double precision | yes |  |
| `ldgf_pct` | double precision | yes |  |
| `on_ice_sh_pct` | double precision | yes |  |
| `on_ice_sv_pct` | double precision | yes |  |
| `pdo` | double precision | yes |  |
| `off_zone_start_pct` | double precision | yes |  |
| `off_zone_faceoff_pct` | double precision | yes |  |

## `public.nst_seasonlong_pk_counts`

Type: view

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `player_id` | bigint | yes |  |
| `season` | integer | yes |  |
| `gp` | bigint | yes |  |
| `toi_seconds` | bigint | yes |  |
| `goals` | bigint | yes |  |
| `total_assists` | bigint | yes |  |
| `first_assists` | bigint | yes |  |
| `second_assists` | bigint | yes |  |
| `total_points` | bigint | yes |  |
| `shots` | bigint | yes |  |
| `sh_percentage` | double precision | yes |  |
| `ixg` | double precision | yes |  |
| `icf` | bigint | yes |  |
| `iff` | bigint | yes |  |
| `iscfs` | bigint | yes |  |
| `hdcf` | bigint | yes |  |
| `rush_attempts` | bigint | yes |  |
| `rebounds_created` | bigint | yes |  |
| `pim` | bigint | yes |  |
| `total_penalties` | bigint | yes |  |
| `minor_penalties` | bigint | yes |  |
| `major_penalties` | bigint | yes |  |
| `misconduct_penalties` | bigint | yes |  |
| `penalties_drawn` | bigint | yes |  |
| `giveaways` | bigint | yes |  |
| `takeaways` | bigint | yes |  |
| `hits` | bigint | yes |  |
| `hits_taken` | bigint | yes |  |
| `shots_blocked` | bigint | yes |  |
| `faceoffs_won` | bigint | yes |  |
| `faceoffs_lost` | bigint | yes |  |
| `faceoffs_percentage` | double precision | yes |  |

## `public.nst_seasonlong_pk_counts_oi`

Type: view

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `player_id` | bigint | yes |  |
| `season` | integer | yes |  |
| `gp` | bigint | yes |  |
| `toi_seconds_oi` | bigint | yes |  |
| `cf` | bigint | yes |  |
| `ca` | bigint | yes |  |
| `ff` | bigint | yes |  |
| `fa` | bigint | yes |  |
| `sf` | bigint | yes |  |
| `sa` | bigint | yes |  |
| `gf` | bigint | yes |  |
| `ga` | bigint | yes |  |
| `xgf` | double precision | yes |  |
| `xga` | double precision | yes |  |
| `scf` | bigint | yes |  |
| `sca` | bigint | yes |  |
| `hdcf` | bigint | yes |  |
| `hdca` | bigint | yes |  |
| `hdgf` | bigint | yes |  |
| `hdga` | bigint | yes |  |
| `mdcf` | bigint | yes |  |
| `mdca` | bigint | yes |  |
| `mdgf` | bigint | yes |  |
| `mdga` | bigint | yes |  |
| `ldcf` | bigint | yes |  |
| `ldca` | bigint | yes |  |
| `ldgf` | bigint | yes |  |
| `ldga` | bigint | yes |  |
| `off_zone_starts` | bigint | yes |  |
| `neu_zone_starts` | bigint | yes |  |
| `def_zone_starts` | bigint | yes |  |
| `off_zone_faceoffs` | bigint | yes |  |
| `neu_zone_faceoffs` | bigint | yes |  |
| `def_zone_faceoffs` | bigint | yes |  |

## `public.nst_seasonlong_pk_rates`

Type: view

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `player_id` | bigint | yes |  |
| `season` | integer | yes |  |
| `gp` | bigint | yes |  |
| `toi_seconds` | bigint | yes |  |
| `goals_per_60` | double precision | yes |  |
| `total_assists_per_60` | double precision | yes |  |
| `first_assists_per_60` | double precision | yes |  |
| `second_assists_per_60` | double precision | yes |  |
| `total_points_per_60` | double precision | yes |  |
| `shots_per_60` | double precision | yes |  |
| `ixg_per_60` | double precision | yes |  |
| `icf_per_60` | double precision | yes |  |
| `iff_per_60` | double precision | yes |  |
| `iscfs_per_60` | double precision | yes |  |
| `ihdcf_per_60` | double precision | yes |  |
| `rush_attempts_per_60` | double precision | yes |  |
| `rebounds_created_per_60` | double precision | yes |  |
| `pim_per_60` | double precision | yes |  |
| `total_penalties_per_60` | double precision | yes |  |
| `minor_penalties_per_60` | double precision | yes |  |
| `major_penalties_per_60` | double precision | yes |  |
| `misconduct_penalties_per_60` | double precision | yes |  |
| `penalties_drawn_per_60` | double precision | yes |  |
| `giveaways_per_60` | double precision | yes |  |
| `takeaways_per_60` | double precision | yes |  |
| `hits_per_60` | double precision | yes |  |
| `hits_taken_per_60` | double precision | yes |  |
| `shots_blocked_per_60` | double precision | yes |  |
| `faceoffs_won_per_60` | double precision | yes |  |
| `faceoffs_lost_per_60` | double precision | yes |  |
| `sh_percentage` | double precision | yes |  |
| `faceoffs_percentage` | double precision | yes |  |
| `ipp` | double precision | yes |  |

## `public.nst_seasonlong_pk_rates_oi`

Type: view

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `player_id` | bigint | yes |  |
| `season` | integer | yes |  |
| `gp` | bigint | yes |  |
| `toi_seconds_oi` | bigint | yes |  |
| `cf_per_60` | double precision | yes |  |
| `ca_per_60` | double precision | yes |  |
| `ff_per_60` | double precision | yes |  |
| `fa_per_60` | double precision | yes |  |
| `sf_per_60` | double precision | yes |  |
| `sa_per_60` | double precision | yes |  |
| `gf_per_60` | double precision | yes |  |
| `ga_per_60` | double precision | yes |  |
| `xgf_per_60` | double precision | yes |  |
| `xga_per_60` | double precision | yes |  |
| `scf_per_60` | double precision | yes |  |
| `sca_per_60` | double precision | yes |  |
| `hdcf_per_60` | double precision | yes |  |
| `hdca_per_60` | double precision | yes |  |
| `hdgf_per_60` | double precision | yes |  |
| `hdga_per_60` | double precision | yes |  |
| `mdcf_per_60` | double precision | yes |  |
| `mdca_per_60` | double precision | yes |  |
| `mdgf_per_60` | double precision | yes |  |
| `mdga_per_60` | double precision | yes |  |
| `ldcf_per_60` | double precision | yes |  |
| `ldca_per_60` | double precision | yes |  |
| `ldgf_per_60` | double precision | yes |  |
| `ldga_per_60` | double precision | yes |  |
| `cf_pct` | double precision | yes |  |
| `ff_pct` | double precision | yes |  |
| `sf_pct` | double precision | yes |  |
| `gf_pct` | double precision | yes |  |
| `xgf_pct` | double precision | yes |  |
| `scf_pct` | double precision | yes |  |
| `hdcf_pct` | double precision | yes |  |
| `hdgf_pct` | double precision | yes |  |
| `mdcf_pct` | double precision | yes |  |
| `mdgf_pct` | double precision | yes |  |
| `ldcf_pct` | double precision | yes |  |
| `ldgf_pct` | double precision | yes |  |
| `on_ice_sh_pct` | double precision | yes |  |
| `on_ice_sv_pct` | double precision | yes |  |
| `pdo` | double precision | yes |  |
| `off_zone_start_pct` | double precision | yes |  |
| `off_zone_faceoff_pct` | double precision | yes |  |

## `public.nst_seasonlong_pp_counts`

Type: view

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `player_id` | bigint | yes |  |
| `season` | integer | yes |  |
| `gp` | bigint | yes |  |
| `toi_seconds` | bigint | yes |  |
| `goals` | bigint | yes |  |
| `total_assists` | bigint | yes |  |
| `first_assists` | bigint | yes |  |
| `second_assists` | bigint | yes |  |
| `total_points` | bigint | yes |  |
| `shots` | bigint | yes |  |
| `sh_percentage` | double precision | yes |  |
| `ixg` | double precision | yes |  |
| `icf` | bigint | yes |  |
| `iff` | bigint | yes |  |
| `iscfs` | bigint | yes |  |
| `hdcf` | bigint | yes |  |
| `rush_attempts` | bigint | yes |  |
| `rebounds_created` | bigint | yes |  |
| `pim` | bigint | yes |  |
| `total_penalties` | bigint | yes |  |
| `minor_penalties` | bigint | yes |  |
| `major_penalties` | bigint | yes |  |
| `misconduct_penalties` | bigint | yes |  |
| `penalties_drawn` | bigint | yes |  |
| `giveaways` | bigint | yes |  |
| `takeaways` | bigint | yes |  |
| `hits` | bigint | yes |  |
| `hits_taken` | bigint | yes |  |
| `shots_blocked` | bigint | yes |  |
| `faceoffs_won` | bigint | yes |  |
| `faceoffs_lost` | bigint | yes |  |
| `faceoffs_percentage` | double precision | yes |  |

## `public.nst_seasonlong_pp_counts_oi`

Type: view

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `player_id` | integer | yes |  |
| `season` | integer | yes |  |
| `gp` | bigint | yes |  |
| `toi_seconds_oi` | bigint | yes |  |
| `cf` | bigint | yes |  |
| `ca` | bigint | yes |  |
| `ff` | bigint | yes |  |
| `fa` | bigint | yes |  |
| `sf` | bigint | yes |  |
| `sa` | bigint | yes |  |
| `gf` | bigint | yes |  |
| `ga` | bigint | yes |  |
| `xgf` | double precision | yes |  |
| `xga` | double precision | yes |  |
| `scf` | bigint | yes |  |
| `sca` | bigint | yes |  |
| `hdcf` | bigint | yes |  |
| `hdca` | bigint | yes |  |
| `hdgf` | bigint | yes |  |
| `hdga` | bigint | yes |  |
| `mdcf` | bigint | yes |  |
| `mdca` | bigint | yes |  |
| `mdgf` | bigint | yes |  |
| `mdga` | bigint | yes |  |
| `ldcf` | bigint | yes |  |
| `ldca` | bigint | yes |  |
| `ldgf` | bigint | yes |  |
| `ldga` | bigint | yes |  |
| `off_zone_starts` | bigint | yes |  |
| `neu_zone_starts` | bigint | yes |  |
| `def_zone_starts` | bigint | yes |  |
| `on_the_fly_starts` | bigint | yes |  |
| `off_zone_faceoffs` | bigint | yes |  |
| `neu_zone_faceoffs` | bigint | yes |  |
| `def_zone_faceoffs` | bigint | yes |  |

## `public.nst_seasonlong_pp_rates`

Type: view

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `player_id` | bigint | yes |  |
| `season` | integer | yes |  |
| `gp` | bigint | yes |  |
| `toi_seconds` | bigint | yes |  |
| `goals_per_60` | double precision | yes |  |
| `total_assists_per_60` | double precision | yes |  |
| `first_assists_per_60` | double precision | yes |  |
| `second_assists_per_60` | double precision | yes |  |
| `total_points_per_60` | double precision | yes |  |
| `shots_per_60` | double precision | yes |  |
| `ixg_per_60` | double precision | yes |  |
| `icf_per_60` | double precision | yes |  |
| `iff_per_60` | double precision | yes |  |
| `iscfs_per_60` | double precision | yes |  |
| `ihdcf_per_60` | double precision | yes |  |
| `rush_attempts_per_60` | double precision | yes |  |
| `rebounds_created_per_60` | double precision | yes |  |
| `pim_per_60` | double precision | yes |  |
| `total_penalties_per_60` | double precision | yes |  |
| `minor_penalties_per_60` | double precision | yes |  |
| `major_penalties_per_60` | double precision | yes |  |
| `misconduct_penalties_per_60` | double precision | yes |  |
| `penalties_drawn_per_60` | double precision | yes |  |
| `giveaways_per_60` | double precision | yes |  |
| `takeaways_per_60` | double precision | yes |  |
| `hits_per_60` | double precision | yes |  |
| `hits_taken_per_60` | double precision | yes |  |
| `shots_blocked_per_60` | double precision | yes |  |
| `faceoffs_won_per_60` | double precision | yes |  |
| `faceoffs_lost_per_60` | double precision | yes |  |
| `sh_percentage` | double precision | yes |  |
| `faceoffs_percentage` | double precision | yes |  |
| `ipp` | double precision | yes |  |

## `public.nst_seasonlong_pp_rates_oi`

Type: view

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `player_id` | integer | yes |  |
| `season` | integer | yes |  |
| `gp` | bigint | yes |  |
| `toi_seconds_oi` | bigint | yes |  |
| `cf_per_60` | double precision | yes |  |
| `ca_per_60` | double precision | yes |  |
| `ff_per_60` | double precision | yes |  |
| `fa_per_60` | double precision | yes |  |
| `sf_per_60` | double precision | yes |  |
| `sa_per_60` | double precision | yes |  |
| `gf_per_60` | double precision | yes |  |
| `ga_per_60` | double precision | yes |  |
| `xgf_per_60` | double precision | yes |  |
| `xga_per_60` | double precision | yes |  |
| `scf_per_60` | double precision | yes |  |
| `sca_per_60` | double precision | yes |  |
| `hdcf_per_60` | double precision | yes |  |
| `hdca_per_60` | double precision | yes |  |
| `hdgf_per_60` | double precision | yes |  |
| `hdga_per_60` | double precision | yes |  |
| `mdcf_per_60` | double precision | yes |  |
| `mdca_per_60` | double precision | yes |  |
| `mdgf_per_60` | double precision | yes |  |
| `mdga_per_60` | double precision | yes |  |
| `ldcf_per_60` | double precision | yes |  |
| `ldca_per_60` | double precision | yes |  |
| `ldgf_per_60` | double precision | yes |  |
| `ldga_per_60` | double precision | yes |  |
| `cf_pct` | double precision | yes |  |
| `ff_pct` | double precision | yes |  |
| `sf_pct` | double precision | yes |  |
| `gf_pct` | double precision | yes |  |
| `xgf_pct` | double precision | yes |  |
| `scf_pct` | double precision | yes |  |
| `hdcf_pct` | double precision | yes |  |
| `hdgf_pct` | double precision | yes |  |
| `mdcf_pct` | double precision | yes |  |
| `mdgf_pct` | double precision | yes |  |
| `ldcf_pct` | double precision | yes |  |
| `ldgf_pct` | double precision | yes |  |
| `on_ice_sh_pct` | double precision | yes |  |
| `on_ice_sv_pct` | double precision | yes |  |
| `pdo` | double precision | yes |  |
| `off_zone_start_pct` | double precision | yes |  |
| `off_zone_faceoff_pct` | double precision | yes |  |

## `public.pbp_games`

Type: table

Primary key: `id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `id` | integer | no | nextval('pbp_games_id_seq'::regclass) |
| `date` | date | yes |  |
| `starttime` | timestamp with time zone | yes |  |
| `type` | integer | yes |  |
| `season` | character varying | yes |  |
| `hometeamid` | integer | yes |  |
| `awayteamid` | integer | yes |  |
| `created_at` | timestamp with time zone | yes | now() |
| `hometeamname` | character varying | yes |  |
| `hometeamabbrev` | character varying | yes |  |
| `hometeamscore` | integer | yes |  |
| `awayteamname` | character varying | yes |  |
| `awayteamabbrev` | character varying | yes |  |
| `awayteamscore` | integer | yes |  |
| `location` | character varying | yes |  |
| `outcome` | character varying | yes |  |

## `public.pbp_plays`

Type: table

Primary key: `gameid`, `id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `id` | integer | no |  |
| `gameid` | integer | no |  |
| `periodnumber` | integer | yes |  |
| `periodtype` | character varying | yes |  |
| `timeinperiod` | character varying | yes |  |
| `timeremaining` | character varying | yes |  |
| `situationcode` | character varying | yes |  |
| `typedesckey` | character varying | yes |  |
| `hometeamdefendingside` | character varying | yes |  |
| `sortorder` | integer | yes |  |
| `eventownerteamid` | integer | yes |  |
| `losingplayerid` | integer | yes |  |
| `winningplayerid` | integer | yes |  |
| `playerid` | integer | yes |  |
| `zonecode` | character varying | yes |  |
| `xcoord` | integer | yes |  |
| `ycoord` | integer | yes |  |
| `reason` | character varying | yes |  |
| `typecode` | integer | yes |  |
| `shootingplayerid` | integer | yes |  |
| `goalieinnetid` | integer | yes |  |
| `awaysog` | integer | yes |  |
| `homesog` | integer | yes |  |
| `blockingplayerid` | integer | yes |  |
| `hittingplayerid` | integer | yes |  |
| `hitteeplayerid` | integer | yes |  |
| `durationofpenalty` | character varying | yes |  |
| `committedbyplayerid` | integer | yes |  |
| `drawnbyplayerid` | integer | yes |  |
| `penalizedteam` | character varying | yes |  |
| `scoringplayerid` | integer | yes |  |
| `scoringplayertotal` | integer | yes |  |
| `shottype` | character varying | yes |  |
| `assist1playerid` | integer | yes |  |
| `assist1playertotal` | integer | yes |  |
| `assist2playerid` | integer | yes |  |
| `assist2playertotal` | integer | yes |  |
| `homescore` | integer | yes |  |
| `awayscore` | integer | yes |  |
| `game_date` | date | yes |  |
| `updated_at` | timestamp with time zone | yes |  |

## `public.power_rankings`

Type: view

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `team_id` | smallint | yes |  |
| `team_name` | text | yes |  |
| `abbreviation` | character | yes |  |
| `power_score` | numeric | yes |  |

## `public.power_rankings_store`

Type: table

Primary key: `team_id`, `season_id`, `date`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `team_id` | smallint | no |  |
| `season_id` | bigint | no |  |
| `date` | date | no |  |
| `std_pim` | numeric | yes |  |
| `std_pts_pct` | numeric | yes |  |
| `std_hits` | numeric | yes |  |
| `std_blocks` | numeric | yes |  |
| `std_power_play_opportunities` | numeric | yes |  |
| `std_goals_for` | numeric | yes |  |
| `std_goals_against` | numeric | yes |  |
| `std_goals_for_pct` | numeric | yes |  |
| `std_shots_for` | numeric | yes |  |
| `std_power_play_pct` | numeric | yes |  |
| `std_penalty_kill_pct` | numeric | yes |  |
| `l_ten_pim` | numeric | yes |  |
| `l_ten_pts_pct` | numeric | yes |  |
| `l_ten_hits` | numeric | yes |  |
| `l_ten_blocks` | numeric | yes |  |
| `l_ten_power_play_opportunities` | numeric | yes |  |
| `l_ten_goals_for` | numeric | yes |  |
| `l_ten_goals_for_pct` | numeric | yes |  |
| `l_ten_shots_for` | numeric | yes |  |
| `l_ten_power_play_pct` | numeric | yes |  |
| `l_ten_penalty_kill_pct` | numeric | yes |  |
| `rank_l_ten_pim` | smallint | yes |  |
| `rank_l_ten_pts_pct` | smallint | yes |  |
| `rank_l_ten_hits` | smallint | yes |  |
| `rank_l_ten_blocks` | smallint | yes |  |
| `rank_l_ten_power_play_opportunities` | smallint | yes |  |
| `rank_l_ten_goals_for` | smallint | yes |  |
| `rank_l_ten_goals_for_pct` | smallint | yes |  |
| `rank_l_ten_shots_for` | smallint | yes |  |
| `rank_l_ten_power_play_pct` | smallint | yes |  |
| `rank_l_ten_penalty_kill_pct` | smallint | yes |  |
| `sos_past` | numeric | yes |  |
| `sos_future` | numeric | yes |  |
| `season_avg_pts_pct` | numeric | yes |  |
| `season_avg_record` | text | yes |  |
| `opponent_past_aggregate_record` | text | yes |  |
| `opponent_future_aggregate_record` | text | yes |  |

## `public.pp_timeframes`

Type: table

Primary key: `id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `id` | bigint | no | nextval('pp_timeframes_id_seq'::regclass) |
| `game_id` | bigint | no |  |
| `season_id` | integer | no |  |
| `game_type` | integer | no |  |
| `game_date` | date | no |  |
| `game_state` | character varying | no |  |
| `away_team_id` | integer | no |  |
| `away_team_abbrev` | character varying | no |  |
| `away_team_score` | integer | no |  |
| `away_team_sog` | integer | no |  |
| `home_team_id` | integer | no |  |
| `home_team_abbrev` | character varying | no |  |
| `home_team_score` | integer | no |  |
| `home_team_sog` | integer | no |  |
| `plays` | jsonb | no |  |
| `created_at` | timestamp with time zone | no | timezone('utc'::text, now()) |
| `updated_at` | timestamp with time zone | no | timezone('utc'::text, now()) |
| `pp_timeframes` | jsonb | no | '[]'::jsonb |

## `public.predictions_sko`

Type: table

Primary key: `player_id`, `as_of_date`, `horizon_games`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `player_id` | integer | no |  |
| `as_of_date` | date | no |  |
| `horizon_games` | integer | no |  |
| `pred_points` | double precision | yes |  |
| `pred_points_per_game` | double precision | yes |  |
| `stability_cv` | double precision | yes |  |
| `stability_multiplier` | double precision | yes |  |
| `sko` | double precision | yes |  |
| `top_features` | jsonb | yes |  |
| `model_name` | text | no |  |
| `model_version` | text | no |  |
| `created_at` | timestamp with time zone | no | now() |
| `updated_at` | timestamp with time zone | no | now() |

## `public.prop_market_prices_daily`

Type: table

Primary key: `snapshot_date`, `player_id`, `market_type`, `sportsbook_key`, `outcome_key`, `game_id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `snapshot_date` | date | no |  |
| `game_id` | bigint | no |  |
| `player_id` | bigint | no |  |
| `market_type` | text | no |  |
| `sportsbook_key` | text | no |  |
| `outcome_key` | text | no |  |
| `line_value` | double precision | yes |  |
| `price_american` | integer | yes |  |
| `implied_probability` | double precision | yes |  |
| `source_payload` | jsonb | no | '{}'::jsonb |
| `source_rank` | smallint | no | 1 |
| `is_official` | boolean | no | false |
| `source_observed_at` | timestamp with time zone | no | now() |
| `freshness_expires_at` | timestamp with time zone | yes |  |
| `provenance` | jsonb | no | '{}'::jsonb |
| `metadata` | jsonb | no | '{}'::jsonb |
| `computed_at` | timestamp with time zone | no | now() |
| `updated_at` | timestamp with time zone | no | now() |

## `public.provider_sync_runs`

Type: table

Primary key: `id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `id` | uuid | no | gen_random_uuid() |
| `user_id` | uuid | no |  |
| `provider` | text | no |  |
| `connected_account_id` | uuid | yes |  |
| `external_league_id` | uuid | yes |  |
| `external_team_id` | uuid | yes |  |
| `trigger_source` | text | no | 'manual'::text |
| `status` | text | no | 'queued'::text |
| `dedupe_key` | text | yes |  |
| `cooldown_until` | timestamp with time zone | yes |  |
| `started_at` | timestamp with time zone | yes |  |
| `finished_at` | timestamp with time zone | yes |  |
| `result_summary` | jsonb | no | '{}'::jsonb |
| `error_details` | jsonb | no | '{}'::jsonb |
| `created_at` | timestamp with time zone | no | now() |
| `updated_at` | timestamp with time zone | no | now() |

## `public.rolling_games`

Type: table

Primary key: `id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `id` | integer | no | nextval('rolling_games_id_seq'::regclass) |
| `game_id` | bigint | no |  |
| `team_id` | integer | no |  |
| `opponent_team_id` | integer | no |  |
| `game_date` | date | no |  |
| `faceoff_win_pct` | numeric | yes |  |
| `goals_against` | integer | yes |  |
| `goals_for` | integer | yes |  |
| `home_road` | character varying | yes |  |
| `losses` | integer | yes |  |
| `ot_losses` | integer | yes |  |
| `penalty_kill_pct` | numeric | yes |  |
| `point_pct` | numeric | yes |  |
| `points` | integer | yes |  |
| `power_play_pct` | numeric | yes |  |
| `regulation_and_ot_wins` | integer | yes |  |
| `shots_against_per_game` | numeric | yes |  |
| `shots_for_per_game` | numeric | yes |  |
| `team_full_name` | character varying | yes |  |
| `wins` | integer | yes |  |
| `wins_in_regulation` | integer | yes |  |
| `wins_in_shootout` | integer | yes |  |
| `blocked_shots` | integer | yes |  |
| `blocked_shots_per60` | numeric | yes |  |
| `empty_net_goals` | integer | yes |  |
| `giveaways` | integer | yes |  |
| `giveaways_per60` | numeric | yes |  |
| `hits` | integer | yes |  |
| `hits_per60` | numeric | yes |  |
| `missed_shots` | integer | yes |  |
| `sat_pct` | numeric | yes |  |
| `takeaways` | integer | yes |  |
| `takeaways_per60` | numeric | yes |  |
| `time_on_ice_per_game_5v5` | numeric | yes |  |
| `game_number` | integer | yes |  |
| `power_play_goals_for` | integer | yes |  |
| `pp_opportunities` | integer | yes |  |
| `pp_time_on_ice_per_game` | numeric | yes |  |
| `sh_goals_against` | integer | yes |  |
| `std_game_ids` | _text[] | yes |  |
| `std_opponent_team_ids` | _int4[] | yes |  |
| `std_home_roads` | _text[] | yes |  |
| `std_faceoff_win_pct` | numeric | yes |  |
| `std_penalty_kill_pct` | numeric | yes |  |
| `std_power_play_pct` | numeric | yes |  |
| `std_point_pct` | numeric | yes |  |
| `std_shots_for_per_game` | numeric | yes |  |
| `std_shots_against_per_game` | numeric | yes |  |
| `std_blocked_shots_per60` | numeric | yes |  |
| `std_giveaways_per60` | numeric | yes |  |
| `std_hits_per60` | numeric | yes |  |
| `std_sat_pct` | numeric | yes |  |
| `std_pp_time_on_ice_per_game` | numeric | yes |  |
| `std_time_on_ice_per_game_5v5` | numeric | yes |  |
| `std_goals_against` | integer | yes |  |
| `std_goals_for` | integer | yes |  |
| `std_losses` | integer | yes |  |
| `std_ot_losses` | integer | yes |  |
| `std_points` | integer | yes |  |
| `std_regulation_and_ot_wins` | integer | yes |  |
| `std_wins` | integer | yes |  |
| `std_blocked_shots` | integer | yes |  |
| `std_empty_net_goals` | integer | yes |  |
| `std_giveaways` | integer | yes |  |
| `std_takeaways` | integer | yes |  |
| `std_missed_shots` | integer | yes |  |
| `std_hits` | integer | yes |  |
| `std_power_play_goals_for` | integer | yes |  |
| `std_pp_opportunities` | integer | yes |  |
| `std_sh_goals_against` | integer | yes |  |
| `ltg_game_ids` | _text[] | yes |  |
| `ltg_opponent_team_ids` | _int4[] | yes |  |
| `ltg_home_roads` | _text[] | yes |  |
| `ltg_faceoff_win_pct` | numeric | yes |  |
| `ltg_penalty_kill_pct` | numeric | yes |  |
| `ltg_power_play_pct` | numeric | yes |  |
| `ltg_point_pct` | numeric | yes |  |
| `ltg_shots_for_per_game` | numeric | yes |  |
| `ltg_shots_against_per_game` | numeric | yes |  |
| `ltg_blocked_shots_per60` | numeric | yes |  |
| `ltg_giveaways_per60` | numeric | yes |  |
| `ltg_hits_per60` | numeric | yes |  |
| `ltg_sat_pct` | numeric | yes |  |
| `ltg_pp_time_on_ice_per_game` | numeric | yes |  |
| `ltg_time_on_ice_per_game_5v5` | numeric | yes |  |
| `ltg_goals_against` | integer | yes |  |
| `ltg_goals_for` | integer | yes |  |
| `ltg_losses` | integer | yes |  |
| `ltg_ot_losses` | integer | yes |  |
| `ltg_points` | integer | yes |  |
| `ltg_regulation_and_ot_wins` | integer | yes |  |
| `ltg_wins` | integer | yes |  |
| `ltg_blocked_shots` | integer | yes |  |
| `ltg_empty_net_goals` | integer | yes |  |
| `ltg_giveaways` | integer | yes |  |
| `ltg_takeaways` | integer | yes |  |
| `ltg_missed_shots` | integer | yes |  |
| `ltg_hits` | integer | yes |  |
| `ltg_power_play_goals_for` | integer | yes |  |
| `ltg_pp_opportunities` | integer | yes |  |
| `ltg_sh_goals_against` | integer | yes |  |
| `std_date_range` | text | yes |  |
| `ltg_date_range` | text | yes |  |
| `std_pim` | integer | yes |  |
| `ltg_pim` | integer | yes |  |
| `pim` | integer | yes |  |
| `opponent_wins` | integer | yes |  |
| `opponent_losses` | integer | yes |  |
| `opponent_ot_losses` | integer | yes |  |
| `std_opponent_wins` | integer | yes |  |
| `std_opponent_losses` | integer | yes |  |
| `std_opponent_ot_losses` | integer | yes |  |
| `ltg_opponent_wins` | integer | yes |  |
| `ltg_opponent_losses` | integer | yes |  |
| `ltg_opponent_ot_losses` | integer | yes |  |

## `public.seasons`

Type: table

Primary key: `id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `id` | bigint | no |  |
| `created_at` | timestamp with time zone | no | now() |
| `startDate` | date | no |  |
| `endDate` | date | no |  |
| `regularSeasonEndDate` | date | no |  |
| `numberOfGames` | smallint | no |  |

## `public.shift_charts`

Type: table

Primary key: `id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `id` | integer | no | nextval('shift_charts_id_seq'::regclass) |
| `game_id` | integer | no |  |
| `game_type` | character varying | yes |  |
| `game_date` | date | yes |  |
| `player_id` | integer | yes |  |
| `player_first_name` | character varying | yes |  |
| `player_last_name` | character varying | yes |  |
| `team_id` | integer | yes |  |
| `team_abbreviation` | character varying | yes |  |
| `shift_numbers` | _int4[] | yes |  |
| `periods` | _int4[] | yes |  |
| `start_times` | _varchar[] | yes |  |
| `end_times` | _varchar[] | yes |  |
| `durations` | _varchar[] | yes |  |
| `game_toi` | character varying | yes |  |
| `home_or_away` | character varying | yes |  |
| `opponent_team_abbreviation` | character varying | yes |  |
| `opponent_team_id` | integer | yes |  |
| `display_position` | character varying | yes |  |
| `primary_position` | character varying | yes |  |
| `time_spent_with` | jsonb | yes |  |
| `percent_toi_with` | jsonb | yes |  |
| `time_spent_with_mixed` | jsonb | yes |  |
| `percent_toi_with_mixed` | jsonb | yes |  |
| `game_length` | character varying | yes |  |
| `line_combination` | integer | yes |  |
| `pairing_combination` | integer | yes |  |
| `season_id` | integer | yes |  |
| `player_type` | character | yes |  |
| `shifts` | jsonb | yes |  |
| `created_at` | timestamp with time zone | no | timezone('utc'::text, now()) |
| `updated_at` | timestamp with time zone | no | timezone('utc'::text, now()) |
| `pp_shifts` | jsonb | yes |  |
| `es_shifts` | jsonb | yes |  |
| `total_pp_toi` | character varying | yes |  |
| `total_es_toi` | character varying | yes |  |
| `total_pk_toi` | text | yes |  |

## `public.shots_goals_by_coord`

Type: table

Primary key: `xcoord`, `ycoord`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `xcoord` | integer | no |  |
| `ycoord` | integer | no |  |
| `league_shots` | integer | yes | 0 |
| `league_goals` | integer | yes | 0 |
| `team_1_shots` | integer | yes | 0 |
| `team_1_goals` | integer | yes | 0 |
| `team_2_shots` | integer | yes | 0 |
| `team_2_goals` | integer | yes | 0 |
| `team_3_shots` | integer | yes | 0 |
| `team_3_goals` | integer | yes | 0 |
| `team_4_shots` | integer | yes | 0 |
| `team_4_goals` | integer | yes | 0 |
| `team_5_shots` | integer | yes | 0 |
| `team_5_goals` | integer | yes | 0 |
| `team_6_shots` | integer | yes | 0 |
| `team_6_goals` | integer | yes | 0 |
| `team_7_shots` | integer | yes | 0 |
| `team_7_goals` | integer | yes | 0 |
| `team_8_shots` | integer | yes | 0 |
| `team_8_goals` | integer | yes | 0 |
| `team_9_shots` | integer | yes | 0 |
| `team_9_goals` | integer | yes | 0 |
| `team_10_shots` | integer | yes | 0 |
| `team_10_goals` | integer | yes | 0 |
| `team_12_shots` | integer | yes | 0 |
| `team_12_goals` | integer | yes | 0 |
| `team_13_shots` | integer | yes | 0 |
| `team_13_goals` | integer | yes | 0 |
| `team_14_shots` | integer | yes | 0 |
| `team_14_goals` | integer | yes | 0 |
| `team_15_shots` | integer | yes | 0 |
| `team_15_goals` | integer | yes | 0 |
| `team_16_shots` | integer | yes | 0 |
| `team_16_goals` | integer | yes | 0 |
| `team_17_shots` | integer | yes | 0 |
| `team_17_goals` | integer | yes | 0 |
| `team_18_shots` | integer | yes | 0 |
| `team_18_goals` | integer | yes | 0 |
| `team_19_shots` | integer | yes | 0 |
| `team_19_goals` | integer | yes | 0 |
| `team_20_shots` | integer | yes | 0 |
| `team_20_goals` | integer | yes | 0 |
| `team_21_shots` | integer | yes | 0 |
| `team_21_goals` | integer | yes | 0 |
| `team_22_shots` | integer | yes | 0 |
| `team_22_goals` | integer | yes | 0 |
| `team_23_shots` | integer | yes | 0 |
| `team_23_goals` | integer | yes | 0 |
| `team_24_shots` | integer | yes | 0 |
| `team_24_goals` | integer | yes | 0 |
| `team_25_shots` | integer | yes | 0 |
| `team_25_goals` | integer | yes | 0 |
| `team_26_shots` | integer | yes | 0 |
| `team_26_goals` | integer | yes | 0 |
| `team_28_shots` | integer | yes | 0 |
| `team_28_goals` | integer | yes | 0 |
| `team_29_shots` | integer | yes | 0 |
| `team_29_goals` | integer | yes | 0 |
| `team_30_shots` | integer | yes | 0 |
| `team_30_goals` | integer | yes | 0 |
| `team_52_shots` | integer | yes | 0 |
| `team_52_goals` | integer | yes | 0 |
| `team_53_shots` | integer | yes | 0 |
| `team_53_goals` | integer | yes | 0 |
| `team_54_shots` | integer | yes | 0 |
| `team_54_goals` | integer | yes | 0 |
| `team_55_shots` | integer | yes | 0 |
| `team_55_goals` | integer | yes | 0 |
| `team_59_shots` | integer | yes | 0 |
| `team_59_goals` | integer | yes | 0 |

## `public.sko_pp_stats`

Type: table

Primary key: `player_id`, `date`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `player_id` | integer | no |  |
| `player_name` | text | yes |  |
| `date` | date | no |  |
| `shoots_catches` | text | yes |  |
| `position_code` | text | yes |  |
| `games_played` | integer | yes |  |
| `current_team_abbreviation` | text | yes |  |
| `current_team_name` | text | yes |  |
| `pp_toi_pct_per_game` | double precision | yes |  |
| `team_abbrev` | text | yes |  |

## `public.sko_trends`

Type: table

Primary key: `player_id`, `date`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `player_id` | integer | no |  |
| `player_name` | character varying | yes |  |
| `date` | date | no |  |
| `sko_score` | numeric | yes |  |
| `sustainability` | character varying | yes |  |
| `z_scores` | jsonb | yes |  |

## `public.source_provenance_snapshots`

Type: table

Primary key: `snapshot_date`, `source_type`, `entity_type`, `entity_id`, `source_name`, `game_id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `snapshot_date` | date | no |  |
| `source_type` | text | no |  |
| `entity_type` | text | no |  |
| `entity_id` | bigint | no |  |
| `game_id` | bigint | no |  |
| `source_name` | text | no |  |
| `source_url` | text | yes |  |
| `source_rank` | smallint | no | 1 |
| `is_official` | boolean | no | false |
| `status` | text | no | 'observed'::text |
| `observed_at` | timestamp with time zone | no | now() |
| `freshness_expires_at` | timestamp with time zone | yes |  |
| `payload` | jsonb | no | '{}'::jsonb |
| `metadata` | jsonb | no | '{}'::jsonb |
| `updated_at` | timestamp with time zone | no | now() |

## `public.statsUpdateStatus`

Type: table

Primary key: `gameId`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `gameId` | bigint | no |  |
| `updated` | boolean | no | false |

## `public.sustainability_priors`

Type: table

Primary key: `season_id`, `position_group`, `stat_code`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `season_id` | integer | no |  |
| `position_group` | text | no |  |
| `stat_code` | text | no |  |
| `k` | numeric | no |  |
| `league_mu` | double precision | no |  |
| `alpha0` | double precision | no |  |
| `beta0` | double precision | no |  |
| `computed_at` | timestamp with time zone | no | now() |

## `public.sustainability_projections`

Type: table

Primary key: `player_id`, `snapshot_date`, `metric_key`, `horizon_games`, `projection_type`, `scope_key`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `player_id` | bigint | no |  |
| `snapshot_date` | date | no |  |
| `metric_key` | text | no |  |
| `horizon_games` | smallint | no |  |
| `projection_type` | text | no | 'snapshot'::text |
| `scope_key` | text | no | 'overall'::text |
| `game_id` | bigint | yes |  |
| `team_id` | smallint | yes |  |
| `opponent_team_id` | smallint | yes |  |
| `expected_value` | double precision | no |  |
| `band50_lower` | double precision | yes |  |
| `band50_upper` | double precision | yes |  |
| `band80_lower` | double precision | yes |  |
| `band80_upper` | double precision | yes |  |
| `rate_per_60` | double precision | yes |  |
| `toi_seconds` | double precision | yes |  |
| `attempts` | double precision | yes |  |
| `expected_wins` | double precision | yes |  |
| `distribution_model` | text | yes |  |
| `opponent_adjustment` | jsonb | no | '{}'::jsonb |
| `distribution_summary` | jsonb | no | '{}'::jsonb |
| `metadata` | jsonb | no | '{}'::jsonb |
| `computed_at` | timestamp with time zone | no | now() |
| `updated_at` | timestamp with time zone | no | now() |

## `public.sustainability_scores`

Type: table

Primary key: `player_id`, `snapshot_date`, `window_code`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `player_id` | integer | no |  |
| `season_id` | integer | no |  |
| `snapshot_date` | date | no |  |
| `position_group` | text | no |  |
| `window_code` | text | no |  |
| `s_raw` | double precision | no |  |
| `s_100` | double precision | no |  |
| `components` | jsonb | no |  |
| `computed_at` | timestamp with time zone | no | now() |

## `public.sustainability_trend_bands`

Type: table

Primary key: `player_id`, `snapshot_date`, `metric_key`, `window_code`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `player_id` | integer | no |  |
| `season_id` | integer | yes |  |
| `snapshot_date` | date | no |  |
| `metric_key` | text | no |  |
| `window_code` | text | no |  |
| `baseline` | numeric | yes |  |
| `ewma` | numeric | yes |  |
| `value` | numeric | no |  |
| `ci_lower` | numeric | no |  |
| `ci_upper` | numeric | no |  |
| `n_eff` | numeric | yes |  |
| `prior_weight` | numeric | yes |  |
| `z_score` | numeric | yes |  |
| `percentile` | numeric | yes |  |
| `exposure` | numeric | yes |  |
| `distribution` | jsonb | yes |  |
| `computed_at` | timestamp with time zone | no | now() |

## `public.sustainability_trends_v`

Type: view

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `player_id` | integer | yes |  |
| `season_id` | integer | yes |  |
| `snapshot_date` | date | yes |  |
| `position_group` | text | yes |  |
| `window_code` | text | yes |  |
| `s_raw` | double precision | yes |  |
| `s_100` | double precision | yes |  |
| `luck_pressure` | double precision | yes |  |
| `abs_luck` | double precision | yes |  |
| `player_name` | text | yes |  |
| `position_code` | text | yes |  |

## `public.sustainability_window_z`

Type: table

Primary key: `player_id`, `snapshot_date`, `window_code`, `stat_code`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `player_id` | integer | no |  |
| `season_id` | integer | yes |  |
| `snapshot_date` | date | no |  |
| `position_group` | text | no |  |
| `window_code` | text | no |  |
| `stat_code` | text | no |  |
| `successes` | numeric | no |  |
| `trials` | numeric | no |  |
| `rate` | double precision | no |  |
| `prior_alpha` | double precision | no |  |
| `prior_beta` | double precision | no |  |
| `prior_mean` | double precision | no |  |
| `prior_var` | double precision | no |  |
| `k` | numeric | no |  |
| `shrink` | double precision | no |  |
| `var_mixed` | double precision | no |  |
| `eb_z` | double precision | no |  |
| `computed_at` | timestamp with time zone | no | now() |

## `public.tweet_pattern_review_items`

Type: table

Primary key: `id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `id` | uuid | no | gen_random_uuid() |
| `dedupe_key` | text | no |  |
| `source_table` | text | no |  |
| `source_row_key` | text | no |  |
| `source_group` | text | yes |  |
| `source_key` | text | yes |  |
| `source_account` | text | yes |  |
| `source_label` | text | yes |  |
| `source_handle` | text | yes |  |
| `author_name` | text | yes |  |
| `snapshot_date` | date | yes |  |
| `source_created_at` | timestamp with time zone | yes |  |
| `tweet_id` | text | yes |  |
| `tweet_url` | text | yes |  |
| `source_url` | text | yes |  |
| `quoted_tweet_id` | text | yes |  |
| `quoted_tweet_url` | text | yes |  |
| `team_id` | bigint | yes |  |
| `team_abbreviation` | text | yes |  |
| `parser_classification` | text | yes |  |
| `parser_filter_status` | text | yes |  |
| `parser_filter_reason` | text | yes |  |
| `keyword_hits` | _text[] | yes |  |
| `review_text` | text | yes |  |
| `raw_text` | text | yes |  |
| `enriched_text` | text | yes |  |
| `quoted_text` | text | yes |  |
| `review_status` | text | no | 'pending'::text |
| `reviewed_category` | text | yes |  |
| `reviewed_subcategory` | text | yes |  |
| `selected_highlights` | jsonb | no | '[]'::jsonb |
| `notes` | text | yes |  |
| `metadata` | jsonb | no | '{}'::jsonb |
| `reviewed_at` | timestamp with time zone | yes |  |
| `created_at` | timestamp with time zone | no | now() |
| `updated_at` | timestamp with time zone | no | now() |
| `review_assignments` | jsonb | no | '[]'::jsonb |

## `public.user_entitlements`

Type: table

Primary key: `id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `id` | uuid | no | gen_random_uuid() |
| `user_id` | uuid | no |  |
| `source_provider` | text | no |  |
| `source_account_id` | uuid | yes |  |
| `entitlement_key` | text | no |  |
| `entitlement_status` | text | no | 'inactive'::text |
| `source_reference` | text | yes |  |
| `effective_from` | timestamp with time zone | yes |  |
| `effective_to` | timestamp with time zone | yes |  |
| `metadata` | jsonb | no | '{}'::jsonb |
| `created_at` | timestamp with time zone | no | now() |
| `updated_at` | timestamp with time zone | no | now() |

## `public.user_profiles`

Type: table

Primary key: `user_id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `user_id` | uuid | no |  |
| `display_name` | text | yes |  |
| `avatar_url` | text | yes |  |
| `timezone` | text | yes |  |
| `created_at` | timestamp with time zone | no | now() |
| `updated_at` | timestamp with time zone | no | now() |

## `public.user_provider_preferences`

Type: table

Primary key: `id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `id` | uuid | no | gen_random_uuid() |
| `user_id` | uuid | no |  |
| `provider` | text | no |  |
| `connected_account_id` | uuid | yes |  |
| `default_external_league_id` | uuid | yes |  |
| `default_external_team_id` | uuid | yes |  |
| `refresh_on_login` | boolean | no | false |
| `active_context` | jsonb | no | '{}'::jsonb |
| `created_at` | timestamp with time zone | no | now() |
| `updated_at` | timestamp with time zone | no | now() |

## `public.user_settings`

Type: table

Primary key: `user_id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `user_id` | uuid | no |  |
| `scoring_categories` | jsonb | no | '{}'::jsonb |
| `league_type` | text | no | 'points'::text |
| `category_weights` | jsonb | no | '{}'::jsonb |
| `roster_config` | jsonb | no | '{}'::jsonb |
| `ui_preferences` | jsonb | no | '{}'::jsonb |
| `active_context` | jsonb | no | '{}'::jsonb |
| `created_at` | timestamp with time zone | no | now() |
| `updated_at` | timestamp with time zone | no | now() |

## `public.users`

Type: table

Primary key: `id`, `user_id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `id` | bigint | no |  |
| `created_at` | timestamp with time zone | yes | now() |
| `user_id` | uuid | no |  |
| `role` | character varying | no | 'basic'::character varying |

## `public.vw_current_season`

Type: view

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `season_id` | bigint | yes |  |

## `public.vw_season_game_dates`

Type: view

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `date` | date | yes |  |

## `public.vw_slate_day`

Type: view

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `game_id` | bigint | yes |  |
| `game_date` | date | yes |  |
| `season_id` | bigint | yes |  |
| `team_id` | smallint | yes |  |
| `opp_id` | smallint | yes |  |
| `team_abbrev` | character | yes |  |
| `opp_abbrev` | character | yes |  |
| `home_away` | text | yes |  |

## `public.wgo_avg_career`

Type: table

Primary key: `player_id`, `strength`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `player_id` | bigint | no |  |
| `strength` | text | no |  |
| `num_seasons` | integer | yes |  |
| `updated_at` | timestamp with time zone | no | now() |
| `total_gp` | integer | yes |  |
| `total_toi` | double precision | yes |  |
| `total_goals` | integer | yes |  |
| `total_total_assists` | integer | yes |  |
| `total_first_assists` | integer | yes |  |
| `total_second_assists` | integer | yes |  |
| `total_total_points` | integer | yes |  |
| `total_shots` | integer | yes |  |
| `total_ixg` | double precision | yes |  |
| `total_icf` | integer | yes |  |
| `total_iff` | integer | yes |  |
| `total_iscfs` | integer | yes |  |
| `total_ihdcf` | integer | yes |  |
| `total_rebounds_created` | integer | yes |  |
| `total_pim` | integer | yes |  |
| `total_total_penalties` | integer | yes |  |
| `total_minor_penalties` | integer | yes |  |
| `total_major_penalties` | integer | yes |  |
| `total_misconduct_penalties` | integer | yes |  |
| `total_penalties_drawn` | integer | yes |  |
| `total_giveaways` | integer | yes |  |
| `total_takeaways` | integer | yes |  |
| `total_hits` | integer | yes |  |
| `total_hits_taken` | integer | yes |  |
| `total_shots_blocked` | integer | yes |  |
| `total_faceoffs_won` | integer | yes |  |
| `total_faceoffs_lost` | integer | yes |  |
| `total_cf` | integer | yes |  |
| `total_ca` | integer | yes |  |
| `total_ff` | integer | yes |  |
| `total_fa` | integer | yes |  |
| `total_sf` | integer | yes |  |
| `total_sa` | integer | yes |  |
| `total_gf` | integer | yes |  |
| `total_ga` | integer | yes |  |
| `total_xgf` | double precision | yes |  |
| `total_xga` | double precision | yes |  |
| `total_scf` | integer | yes |  |
| `total_sca` | integer | yes |  |
| `total_hdcf` | integer | yes |  |
| `total_hdca` | integer | yes |  |
| `total_hdgf` | integer | yes |  |
| `total_hdga` | integer | yes |  |
| `total_mdcf` | integer | yes |  |
| `total_mdca` | integer | yes |  |
| `total_mdgf` | integer | yes |  |
| `total_mdga` | integer | yes |  |
| `total_ldcf` | integer | yes |  |
| `total_ldca` | integer | yes |  |
| `total_ldgf` | integer | yes |  |
| `total_ldga` | integer | yes |  |
| `total_off_zone_starts` | double precision | yes |  |
| `total_neu_zone_starts` | double precision | yes |  |
| `total_def_zone_starts` | double precision | yes |  |
| `total_on_the_fly_starts` | double precision | yes |  |
| `total_off_zone_faceoffs` | double precision | yes |  |
| `total_neu_zone_faceoffs` | double precision | yes |  |
| `total_def_zone_faceoffs` | double precision | yes |  |
| `avg_toi_per_gp` | double precision | yes |  |
| `goals_per_60` | double precision | yes |  |
| `total_assists_per_60` | double precision | yes |  |
| `first_assists_per_60` | double precision | yes |  |
| `second_assists_per_60` | double precision | yes |  |
| `total_points_per_60` | double precision | yes |  |
| `shots_per_60` | double precision | yes |  |
| `ixg_per_60` | double precision | yes |  |
| `icf_per_60` | double precision | yes |  |
| `iff_per_60` | double precision | yes |  |
| `iscfs_per_60` | double precision | yes |  |
| `ihdcf_per_60` | double precision | yes |  |
| `rebounds_created_per_60` | double precision | yes |  |
| `pim_per_60` | double precision | yes |  |
| `total_penalties_per_60` | double precision | yes |  |
| `minor_penalties_per_60` | double precision | yes |  |
| `major_penalties_per_60` | double precision | yes |  |
| `misconduct_penalties_per_60` | double precision | yes |  |
| `penalties_drawn_per_60` | double precision | yes |  |
| `giveaways_per_60` | double precision | yes |  |
| `takeaways_per_60` | double precision | yes |  |
| `hits_per_60` | double precision | yes |  |
| `hits_taken_per_60` | double precision | yes |  |
| `shots_blocked_per_60` | double precision | yes |  |
| `faceoffs_won_per_60` | double precision | yes |  |
| `faceoffs_lost_per_60` | double precision | yes |  |
| `sh_percentage` | double precision | yes |  |
| `ipp` | double precision | yes |  |
| `faceoffs_percentage` | double precision | yes |  |
| `cf_per_60` | double precision | yes |  |
| `ca_per_60` | double precision | yes |  |
| `ff_per_60` | double precision | yes |  |
| `fa_per_60` | double precision | yes |  |
| `sf_per_60` | double precision | yes |  |
| `sa_per_60` | double precision | yes |  |
| `gf_per_60` | double precision | yes |  |
| `ga_per_60` | double precision | yes |  |
| `xgf_per_60` | double precision | yes |  |
| `xga_per_60` | double precision | yes |  |
| `scf_per_60` | double precision | yes |  |
| `sca_per_60` | double precision | yes |  |
| `hdcf_per_60` | double precision | yes |  |
| `hdca_per_60` | double precision | yes |  |
| `hdgf_per_60` | double precision | yes |  |
| `hdga_per_60` | double precision | yes |  |
| `mdcf_per_60` | double precision | yes |  |
| `mdca_per_60` | double precision | yes |  |
| `mdgf_per_60` | double precision | yes |  |
| `mdga_per_60` | double precision | yes |  |
| `ldcf_per_60` | double precision | yes |  |
| `ldca_per_60` | double precision | yes |  |
| `ldgf_per_60` | double precision | yes |  |
| `ldga_per_60` | double precision | yes |  |
| `off_zone_starts_per_60` | double precision | yes |  |
| `neu_zone_starts_per_60` | double precision | yes |  |
| `def_zone_starts_per_60` | double precision | yes |  |
| `on_the_fly_starts_per_60` | double precision | yes |  |
| `off_zone_faceoffs_per_60` | double precision | yes |  |
| `neu_zone_faceoffs_per_60` | double precision | yes |  |
| `def_zone_faceoffs_per_60` | double precision | yes |  |
| `cf_pct` | double precision | yes |  |
| `ff_pct` | double precision | yes |  |
| `sf_pct` | double precision | yes |  |
| `gf_pct` | double precision | yes |  |
| `xgf_pct` | double precision | yes |  |
| `scf_pct` | double precision | yes |  |
| `hdcf_pct` | double precision | yes |  |
| `hdgf_pct` | double precision | yes |  |
| `mdcf_pct` | double precision | yes |  |
| `mdgf_pct` | double precision | yes |  |
| `ldcf_pct` | double precision | yes |  |
| `ldgf_pct` | double precision | yes |  |
| `on_ice_sh_pct` | double precision | yes |  |
| `on_ice_sv_pct` | double precision | yes |  |
| `pdo` | double precision | yes |  |
| `off_zone_start_pct` | double precision | yes |  |
| `off_zone_faceoff_pct` | double precision | yes |  |
| `total_possible_gp` | integer | yes |  |
| `gp_percentage` | double precision | yes |  |

## `public.wgo_avg_three_year`

Type: table

Primary key: `player_id`, `strength`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `player_id` | bigint | no |  |
| `strength` | text | no |  |
| `num_seasons` | integer | yes |  |
| `updated_at` | timestamp with time zone | no | now() |
| `total_gp` | integer | yes |  |
| `total_toi` | double precision | yes |  |
| `total_goals` | integer | yes |  |
| `total_total_assists` | integer | yes |  |
| `total_first_assists` | integer | yes |  |
| `total_second_assists` | integer | yes |  |
| `total_total_points` | integer | yes |  |
| `total_shots` | integer | yes |  |
| `total_ixg` | double precision | yes |  |
| `total_icf` | integer | yes |  |
| `total_iff` | integer | yes |  |
| `total_iscfs` | integer | yes |  |
| `total_ihdcf` | integer | yes |  |
| `total_rebounds_created` | integer | yes |  |
| `total_pim` | integer | yes |  |
| `total_total_penalties` | integer | yes |  |
| `total_minor_penalties` | integer | yes |  |
| `total_major_penalties` | integer | yes |  |
| `total_misconduct_penalties` | integer | yes |  |
| `total_penalties_drawn` | integer | yes |  |
| `total_giveaways` | integer | yes |  |
| `total_takeaways` | integer | yes |  |
| `total_hits` | integer | yes |  |
| `total_hits_taken` | integer | yes |  |
| `total_shots_blocked` | integer | yes |  |
| `total_faceoffs_won` | integer | yes |  |
| `total_faceoffs_lost` | integer | yes |  |
| `total_cf` | integer | yes |  |
| `total_ca` | integer | yes |  |
| `total_ff` | integer | yes |  |
| `total_fa` | integer | yes |  |
| `total_sf` | integer | yes |  |
| `total_sa` | integer | yes |  |
| `total_gf` | integer | yes |  |
| `total_ga` | integer | yes |  |
| `total_xgf` | double precision | yes |  |
| `total_xga` | double precision | yes |  |
| `total_scf` | integer | yes |  |
| `total_sca` | integer | yes |  |
| `total_hdcf` | integer | yes |  |
| `total_hdca` | integer | yes |  |
| `total_hdgf` | integer | yes |  |
| `total_hdga` | integer | yes |  |
| `total_mdcf` | integer | yes |  |
| `total_mdca` | integer | yes |  |
| `total_mdgf` | integer | yes |  |
| `total_mdga` | integer | yes |  |
| `total_ldcf` | integer | yes |  |
| `total_ldca` | integer | yes |  |
| `total_ldgf` | integer | yes |  |
| `total_ldga` | integer | yes |  |
| `total_off_zone_starts` | double precision | yes |  |
| `total_neu_zone_starts` | double precision | yes |  |
| `total_def_zone_starts` | double precision | yes |  |
| `total_on_the_fly_starts` | double precision | yes |  |
| `total_off_zone_faceoffs` | double precision | yes |  |
| `total_neu_zone_faceoffs` | double precision | yes |  |
| `total_def_zone_faceoffs` | double precision | yes |  |
| `avg_toi_per_gp` | double precision | yes |  |
| `goals_per_60` | double precision | yes |  |
| `total_assists_per_60` | double precision | yes |  |
| `first_assists_per_60` | double precision | yes |  |
| `second_assists_per_60` | double precision | yes |  |
| `total_points_per_60` | double precision | yes |  |
| `shots_per_60` | double precision | yes |  |
| `ixg_per_60` | double precision | yes |  |
| `icf_per_60` | double precision | yes |  |
| `iff_per_60` | double precision | yes |  |
| `iscfs_per_60` | double precision | yes |  |
| `ihdcf_per_60` | double precision | yes |  |
| `rebounds_created_per_60` | double precision | yes |  |
| `pim_per_60` | double precision | yes |  |
| `total_penalties_per_60` | double precision | yes |  |
| `minor_penalties_per_60` | double precision | yes |  |
| `major_penalties_per_60` | double precision | yes |  |
| `misconduct_penalties_per_60` | double precision | yes |  |
| `penalties_drawn_per_60` | double precision | yes |  |
| `giveaways_per_60` | double precision | yes |  |
| `takeaways_per_60` | double precision | yes |  |
| `hits_per_60` | double precision | yes |  |
| `hits_taken_per_60` | double precision | yes |  |
| `shots_blocked_per_60` | double precision | yes |  |
| `faceoffs_won_per_60` | double precision | yes |  |
| `faceoffs_lost_per_60` | double precision | yes |  |
| `sh_percentage` | double precision | yes |  |
| `ipp` | double precision | yes |  |
| `faceoffs_percentage` | double precision | yes |  |
| `cf_per_60` | double precision | yes |  |
| `ca_per_60` | double precision | yes |  |
| `ff_per_60` | double precision | yes |  |
| `fa_per_60` | double precision | yes |  |
| `sf_per_60` | double precision | yes |  |
| `sa_per_60` | double precision | yes |  |
| `gf_per_60` | double precision | yes |  |
| `ga_per_60` | double precision | yes |  |
| `xgf_per_60` | double precision | yes |  |
| `xga_per_60` | double precision | yes |  |
| `scf_per_60` | double precision | yes |  |
| `sca_per_60` | double precision | yes |  |
| `hdcf_per_60` | double precision | yes |  |
| `hdca_per_60` | double precision | yes |  |
| `hdgf_per_60` | double precision | yes |  |
| `hdga_per_60` | double precision | yes |  |
| `mdcf_per_60` | double precision | yes |  |
| `mdca_per_60` | double precision | yes |  |
| `mdgf_per_60` | double precision | yes |  |
| `mdga_per_60` | double precision | yes |  |
| `ldcf_per_60` | double precision | yes |  |
| `ldca_per_60` | double precision | yes |  |
| `ldgf_per_60` | double precision | yes |  |
| `ldga_per_60` | double precision | yes |  |
| `off_zone_starts_per_60` | double precision | yes |  |
| `neu_zone_starts_per_60` | double precision | yes |  |
| `def_zone_starts_per_60` | double precision | yes |  |
| `on_the_fly_starts_per_60` | double precision | yes |  |
| `off_zone_faceoffs_per_60` | double precision | yes |  |
| `neu_zone_faceoffs_per_60` | double precision | yes |  |
| `def_zone_faceoffs_per_60` | double precision | yes |  |
| `cf_pct` | double precision | yes |  |
| `ff_pct` | double precision | yes |  |
| `sf_pct` | double precision | yes |  |
| `gf_pct` | double precision | yes |  |
| `xgf_pct` | double precision | yes |  |
| `scf_pct` | double precision | yes |  |
| `hdcf_pct` | double precision | yes |  |
| `hdgf_pct` | double precision | yes |  |
| `mdcf_pct` | double precision | yes |  |
| `mdgf_pct` | double precision | yes |  |
| `ldcf_pct` | double precision | yes |  |
| `ldgf_pct` | double precision | yes |  |
| `on_ice_sh_pct` | double precision | yes |  |
| `on_ice_sv_pct` | double precision | yes |  |
| `pdo` | double precision | yes |  |
| `off_zone_start_pct` | double precision | yes |  |
| `off_zone_faceoff_pct` | double precision | yes |  |
| `total_possible_gp` | integer | yes |  |
| `gp_percentage` | double precision | yes |  |

## `public.wgo_career_averages`

Type: table

Primary key: `player_id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `player_id` | integer | no |  |
| `player_name` | text | yes |  |
| `shoots_catches` | text | yes |  |
| `position_code` | text | yes |  |
| `birth_city` | text | yes |  |
| `birth_date` | text | yes |  |
| `current_team_abbreviation` | text | yes |  |
| `current_team_name` | text | yes |  |
| `draft_overall` | integer | yes |  |
| `draft_round` | integer | yes |  |
| `draft_year` | integer | yes |  |
| `first_season_for_game_type` | integer | yes |  |
| `nationality_code` | text | yes |  |
| `weight` | integer | yes |  |
| `height` | integer | yes |  |
| `birth_country` | text | yes |  |
| `number_of_seasons` | integer | yes |  |
| `games_played_avg` | double precision | yes |  |
| `points_avg` | double precision | yes |  |
| `goals_avg` | double precision | yes |  |
| `assists_avg` | double precision | yes |  |
| `shots_avg` | double precision | yes |  |
| `plus_minus_avg` | double precision | yes |  |
| `ot_goals_avg` | double precision | yes |  |
| `gw_goals_avg` | double precision | yes |  |
| `pp_points_avg` | double precision | yes |  |
| `blocked_shots_avg` | double precision | yes |  |
| `empty_net_goals_avg` | double precision | yes |  |
| `empty_net_points_avg` | double precision | yes |  |
| `giveaways_avg` | double precision | yes |  |
| `hits_avg` | double precision | yes |  |
| `missed_shots_avg` | double precision | yes |  |
| `takeaways_avg` | double precision | yes |  |
| `d_zone_faceoffs_avg` | double precision | yes |  |
| `ev_faceoffs_avg` | double precision | yes |  |
| `n_zone_faceoffs_avg` | double precision | yes |  |
| `o_zone_faceoffs_avg` | double precision | yes |  |
| `pp_faceoffs_avg` | double precision | yes |  |
| `sh_faceoffs_avg` | double precision | yes |  |
| `total_faceoffs_avg` | double precision | yes |  |
| `d_zone_fol_avg` | double precision | yes |  |
| `d_zone_fow_avg` | double precision | yes |  |
| `ev_fol_avg` | double precision | yes |  |
| `ev_fow_avg` | double precision | yes |  |
| `n_zone_fol_avg` | double precision | yes |  |
| `n_zone_fow_avg` | double precision | yes |  |
| `o_zone_fol_avg` | double precision | yes |  |
| `o_zone_fow_avg` | double precision | yes |  |
| `pp_fol_avg` | double precision | yes |  |
| `pp_fow_avg` | double precision | yes |  |
| `sh_fol_avg` | double precision | yes |  |
| `sh_fow_avg` | double precision | yes |  |
| `total_fol_avg` | double precision | yes |  |
| `total_fow_avg` | double precision | yes |  |
| `es_goals_against_avg` | double precision | yes |  |
| `es_goals_for_avg` | double precision | yes |  |
| `pp_goals_against_avg` | double precision | yes |  |
| `pp_goals_for_avg` | double precision | yes |  |
| `sh_goals_against_avg` | double precision | yes |  |
| `sh_goals_for_avg` | double precision | yes |  |
| `game_misconduct_penalties_avg` | double precision | yes |  |
| `major_penalties_avg` | double precision | yes |  |
| `match_penalties_avg` | double precision | yes |  |
| `minor_penalties_avg` | double precision | yes |  |
| `misconduct_penalties_avg` | double precision | yes |  |
| `penalties_avg` | double precision | yes |  |
| `penalties_drawn_avg` | double precision | yes |  |
| `penalty_minutes_avg` | double precision | yes |  |
| `sh_assists_avg` | double precision | yes |  |
| `sh_goals_avg` | double precision | yes |  |
| `sh_points_avg` | double precision | yes |  |
| `sh_shots_avg` | double precision | yes |  |
| `sh_time_on_ice_avg` | double precision | yes |  |
| `pp_assists_avg` | double precision | yes |  |
| `pp_goals_avg` | double precision | yes |  |
| `sh_primary_assists_avg` | double precision | yes |  |
| `sh_individual_sat_for_avg` | double precision | yes |  |
| `sh_secondary_assists_avg` | double precision | yes |  |
| `pp_primary_assists_avg` | double precision | yes |  |
| `pp_secondary_assists_avg` | double precision | yes |  |
| `pp_shots_avg` | double precision | yes |  |
| `pp_toi_avg` | double precision | yes |  |
| `toi_per_game_5v5_avg` | double precision | yes |  |
| `sat_against_avg` | double precision | yes |  |
| `sat_ahead_avg` | double precision | yes |  |
| `sat_behind_avg` | double precision | yes |  |
| `sat_close_avg` | double precision | yes |  |
| `sat_for_avg` | double precision | yes |  |
| `sat_tied_avg` | double precision | yes |  |
| `sat_total_avg` | double precision | yes |  |
| `usat_against_avg` | double precision | yes |  |
| `usat_ahead_avg` | double precision | yes |  |
| `usat_behind_avg` | double precision | yes |  |
| `usat_close_avg` | double precision | yes |  |
| `usat_for_avg` | double precision | yes |  |
| `usat_tied_avg` | double precision | yes |  |
| `usat_total_avg` | double precision | yes |  |
| `assists_5v5_avg` | double precision | yes |  |
| `goals_5v5_avg` | double precision | yes |  |
| `points_5v5_avg` | double precision | yes |  |
| `total_primary_assists_avg` | double precision | yes |  |
| `total_secondary_assists_avg` | double precision | yes |  |
| `goals_backhand_avg` | double precision | yes |  |
| `goals_bat_avg` | double precision | yes |  |
| `goals_between_legs_avg` | double precision | yes |  |
| `goals_cradle_avg` | double precision | yes |  |
| `goals_deflected_avg` | double precision | yes |  |
| `goals_poke_avg` | double precision | yes |  |
| `goals_slap_avg` | double precision | yes |  |
| `goals_snap_avg` | double precision | yes |  |
| `goals_tip_in_avg` | double precision | yes |  |
| `goals_wrap_around_avg` | double precision | yes |  |
| `goals_wrist_avg` | double precision | yes |  |
| `shots_on_net_backhand_avg` | double precision | yes |  |
| `shots_on_net_bat_avg` | double precision | yes |  |
| `shots_on_net_between_legs_avg` | double precision | yes |  |
| `shots_on_net_cradle_avg` | double precision | yes |  |
| `shots_on_net_deflected_avg` | double precision | yes |  |
| `shots_on_net_poke_avg` | double precision | yes |  |
| `shots_on_net_slap_avg` | double precision | yes |  |
| `shots_on_net_snap_avg` | double precision | yes |  |
| `shots_on_net_tip_in_avg` | double precision | yes |  |
| `shots_on_net_wrap_around_avg` | double precision | yes |  |
| `shots_on_net_wrist_avg` | double precision | yes |  |
| `ev_time_on_ice_avg` | double precision | yes |  |
| `ot_time_on_ice_avg` | double precision | yes |  |
| `shifts_avg` | double precision | yes |  |
| `sat_percentage_avg` | double precision | yes |  |
| `sat_percentage_ahead_avg` | double precision | yes |  |
| `sat_percentage_behind_avg` | double precision | yes |  |
| `sat_percentage_close_avg` | double precision | yes |  |
| `sat_percentage_tied_avg` | double precision | yes |  |
| `usat_percentage_avg` | double precision | yes |  |
| `usat_percentage_ahead_avg` | double precision | yes |  |
| `usat_percentage_behind_avg` | double precision | yes |  |
| `usat_percentage_close_avg` | double precision | yes |  |
| `usat_percentage_tied_avg` | double precision | yes |  |
| `secondary_assists_5v5_avg` | double precision | yes |  |
| `primary_assists_5v5_avg` | double precision | yes |  |
| `ev_time_on_ice_per_game_avg` | double precision | yes |  |
| `ot_time_on_ice_per_game_avg` | double precision | yes |  |
| `shifts_per_game_avg` | double precision | yes |  |
| `toi_per_game_avg` | double precision | yes |  |
| `es_toi_per_game_avg` | double precision | yes |  |
| `points_per_game_avg` | double precision | yes |  |
| `pp_toi_per_game_avg` | double precision | yes |  |
| `sh_toi_per_game_avg` | double precision | yes |  |
| `penalty_seconds_per_game_avg` | double precision | yes |  |
| `sh_time_on_ice_pct_per_game_avg` | double precision | yes |  |
| `pp_toi_pct_per_game_avg` | double precision | yes |  |
| `time_on_ice_per_shift_avg` | double precision | yes |  |
| `penalty_minutes_per_toi_avg` | double precision | yes |  |
| `shooting_percentage_avg` | double precision | yes |  |
| `fow_percentage_avg` | double precision | yes |  |
| `d_zone_fo_percentage_avg` | double precision | yes |  |
| `ev_faceoff_percentage_avg` | double precision | yes |  |
| `n_zone_fo_percentage_avg` | double precision | yes |  |
| `o_zone_fo_percentage_avg` | double precision | yes |  |
| `pp_faceoff_percentage_avg` | double precision | yes |  |
| `sh_faceoff_percentage_avg` | double precision | yes |  |
| `es_goals_for_percentage_avg` | double precision | yes |  |
| `sh_shooting_percentage_avg` | double precision | yes |  |
| `pp_shooting_percentage_avg` | double precision | yes |  |
| `goals_pct_avg` | double precision | yes |  |
| `on_ice_shooting_pct_avg` | double precision | yes |  |
| `faceoff_pct_5v5_avg` | double precision | yes |  |
| `sat_pct_avg` | double precision | yes |  |
| `zone_start_pct_avg` | double precision | yes |  |
| `shooting_percentage_5v5_avg` | double precision | yes |  |
| `skater_save_pct_5v5_avg` | double precision | yes |  |
| `skater_shooting_plus_save_pct_5v5_avg` | double precision | yes |  |
| `o_zone_start_pct_5v5_avg` | double precision | yes |  |
| `on_ice_shooting_pct_5v5_avg` | double precision | yes |  |
| `zone_start_pct_5v5_avg` | double precision | yes |  |
| `blocks_per_60_avg` | double precision | yes |  |
| `giveaways_per_60_avg` | double precision | yes |  |
| `hits_per_60_avg` | double precision | yes |  |
| `takeaways_per_60_avg` | double precision | yes |  |
| `penalties_drawn_per_60_avg` | double precision | yes |  |
| `penalties_taken_per_60_avg` | double precision | yes |  |
| `pp_goals_against_per_60_avg` | double precision | yes |  |
| `sh_goals_per_60_avg` | double precision | yes |  |
| `sh_individual_sat_per_60_avg` | double precision | yes |  |
| `sh_points_per_60_avg` | double precision | yes |  |
| `sh_primary_assists_per_60_avg` | double precision | yes |  |
| `sh_secondary_assists_per_60_avg` | double precision | yes |  |
| `sh_shots_per_60_avg` | double precision | yes |  |
| `pp_goals_for_per_60_avg` | double precision | yes |  |
| `pp_goals_per_60_avg` | double precision | yes |  |
| `pp_individual_sat_per_60_avg` | double precision | yes |  |
| `pp_points_per_60_avg` | double precision | yes |  |
| `pp_primary_assists_per_60_avg` | double precision | yes |  |
| `pp_secondary_assists_per_60_avg` | double precision | yes |  |
| `pp_shots_per_60_avg` | double precision | yes |  |
| `individual_sat_for_per_60_avg` | double precision | yes |  |
| `individual_shots_for_per_60_avg` | double precision | yes |  |
| `assists_per_60_5v5_avg` | double precision | yes |  |
| `goals_per_60_5v5_avg` | double precision | yes |  |
| `points_per_60_5v5_avg` | double precision | yes |  |
| `primary_assists_per_60_5v5_avg` | double precision | yes |  |
| `secondary_assists_per_60_5v5_avg` | double precision | yes |  |
| `sat_relative_avg` | double precision | yes |  |
| `usat_relative_avg` | double precision | yes |  |
| `sat_relative_5v5_avg` | double precision | yes |  |
| `assists_5v5_per_60_avg` | numeric | yes |  |
| `goals_5v5_per_60_avg` | numeric | yes |  |
| `points_5v5_per_60_avg` | numeric | yes |  |
| `pp_individual_sat_for_per_60_avg` | numeric | yes |  |
| `primary_assists_5v5_per_60_avg` | numeric | yes |  |
| `secondary_assists_5v5_per_60_avg` | numeric | yes |  |
| `sh_individual_sat_for_per_60_avg` | numeric | yes |  |

## `public.wgo_three_year_averages`

Type: table

Primary key: `player_id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `player_id` | integer | no |  |
| `player_name` | text | yes |  |
| `shoots_catches` | text | yes |  |
| `position_code` | text | yes |  |
| `birth_city` | text | yes |  |
| `birth_date` | text | yes |  |
| `current_team_abbreviation` | text | yes |  |
| `current_team_name` | text | yes |  |
| `draft_overall` | integer | yes |  |
| `draft_round` | integer | yes |  |
| `draft_year` | integer | yes |  |
| `first_season_for_game_type` | integer | yes |  |
| `nationality_code` | text | yes |  |
| `weight` | integer | yes |  |
| `height` | integer | yes |  |
| `birth_country` | text | yes |  |
| `number_of_seasons` | integer | yes |  |
| `games_played_avg` | double precision | yes |  |
| `points_avg` | double precision | yes |  |
| `goals_avg` | double precision | yes |  |
| `assists_avg` | double precision | yes |  |
| `shots_avg` | double precision | yes |  |
| `plus_minus_avg` | double precision | yes |  |
| `ot_goals_avg` | double precision | yes |  |
| `gw_goals_avg` | double precision | yes |  |
| `pp_points_avg` | double precision | yes |  |
| `blocked_shots_avg` | double precision | yes |  |
| `empty_net_goals_avg` | double precision | yes |  |
| `empty_net_points_avg` | double precision | yes |  |
| `giveaways_avg` | double precision | yes |  |
| `hits_avg` | double precision | yes |  |
| `missed_shots_avg` | double precision | yes |  |
| `takeaways_avg` | double precision | yes |  |
| `d_zone_faceoffs_avg` | double precision | yes |  |
| `ev_faceoffs_avg` | double precision | yes |  |
| `n_zone_faceoffs_avg` | double precision | yes |  |
| `o_zone_faceoffs_avg` | double precision | yes |  |
| `pp_faceoffs_avg` | double precision | yes |  |
| `sh_faceoffs_avg` | double precision | yes |  |
| `total_faceoffs_avg` | double precision | yes |  |
| `d_zone_fol_avg` | double precision | yes |  |
| `d_zone_fow_avg` | double precision | yes |  |
| `ev_fol_avg` | double precision | yes |  |
| `ev_fow_avg` | double precision | yes |  |
| `n_zone_fol_avg` | double precision | yes |  |
| `n_zone_fow_avg` | double precision | yes |  |
| `o_zone_fol_avg` | double precision | yes |  |
| `o_zone_fow_avg` | double precision | yes |  |
| `pp_fol_avg` | double precision | yes |  |
| `pp_fow_avg` | double precision | yes |  |
| `sh_fol_avg` | double precision | yes |  |
| `sh_fow_avg` | double precision | yes |  |
| `total_fol_avg` | double precision | yes |  |
| `total_fow_avg` | double precision | yes |  |
| `es_goals_against_avg` | double precision | yes |  |
| `es_goals_for_avg` | double precision | yes |  |
| `pp_goals_against_avg` | double precision | yes |  |
| `pp_goals_for_avg` | double precision | yes |  |
| `sh_goals_against_avg` | double precision | yes |  |
| `sh_goals_for_avg` | double precision | yes |  |
| `game_misconduct_penalties_avg` | double precision | yes |  |
| `major_penalties_avg` | double precision | yes |  |
| `match_penalties_avg` | double precision | yes |  |
| `minor_penalties_avg` | double precision | yes |  |
| `misconduct_penalties_avg` | double precision | yes |  |
| `penalties_avg` | double precision | yes |  |
| `penalties_drawn_avg` | double precision | yes |  |
| `penalty_minutes_avg` | double precision | yes |  |
| `sh_assists_avg` | double precision | yes |  |
| `sh_goals_avg` | double precision | yes |  |
| `sh_points_avg` | double precision | yes |  |
| `sh_shots_avg` | double precision | yes |  |
| `sh_time_on_ice_avg` | double precision | yes |  |
| `pp_assists_avg` | double precision | yes |  |
| `pp_goals_avg` | double precision | yes |  |
| `sh_primary_assists_avg` | double precision | yes |  |
| `sh_individual_sat_for_avg` | double precision | yes |  |
| `sh_secondary_assists_avg` | double precision | yes |  |
| `pp_primary_assists_avg` | double precision | yes |  |
| `pp_secondary_assists_avg` | double precision | yes |  |
| `pp_shots_avg` | double precision | yes |  |
| `pp_toi_avg` | double precision | yes |  |
| `toi_per_game_5v5_avg` | double precision | yes |  |
| `sat_against_avg` | double precision | yes |  |
| `sat_ahead_avg` | double precision | yes |  |
| `sat_behind_avg` | double precision | yes |  |
| `sat_close_avg` | double precision | yes |  |
| `sat_for_avg` | double precision | yes |  |
| `sat_tied_avg` | double precision | yes |  |
| `sat_total_avg` | double precision | yes |  |
| `usat_against_avg` | double precision | yes |  |
| `usat_ahead_avg` | double precision | yes |  |
| `usat_behind_avg` | double precision | yes |  |
| `usat_close_avg` | double precision | yes |  |
| `usat_for_avg` | double precision | yes |  |
| `usat_tied_avg` | double precision | yes |  |
| `usat_total_avg` | double precision | yes |  |
| `assists_5v5_avg` | double precision | yes |  |
| `goals_5v5_avg` | double precision | yes |  |
| `points_5v5_avg` | double precision | yes |  |
| `total_primary_assists_avg` | double precision | yes |  |
| `total_secondary_assists_avg` | double precision | yes |  |
| `goals_backhand_avg` | double precision | yes |  |
| `goals_bat_avg` | double precision | yes |  |
| `goals_between_legs_avg` | double precision | yes |  |
| `goals_cradle_avg` | double precision | yes |  |
| `goals_deflected_avg` | double precision | yes |  |
| `goals_poke_avg` | double precision | yes |  |
| `goals_slap_avg` | double precision | yes |  |
| `goals_snap_avg` | double precision | yes |  |
| `goals_tip_in_avg` | double precision | yes |  |
| `goals_wrap_around_avg` | double precision | yes |  |
| `goals_wrist_avg` | double precision | yes |  |
| `shots_on_net_backhand_avg` | double precision | yes |  |
| `shots_on_net_bat_avg` | double precision | yes |  |
| `shots_on_net_between_legs_avg` | double precision | yes |  |
| `shots_on_net_cradle_avg` | double precision | yes |  |
| `shots_on_net_deflected_avg` | double precision | yes |  |
| `shots_on_net_poke_avg` | double precision | yes |  |
| `shots_on_net_slap_avg` | double precision | yes |  |
| `shots_on_net_snap_avg` | double precision | yes |  |
| `shots_on_net_tip_in_avg` | double precision | yes |  |
| `shots_on_net_wrap_around_avg` | double precision | yes |  |
| `shots_on_net_wrist_avg` | double precision | yes |  |
| `ev_time_on_ice_avg` | double precision | yes |  |
| `ot_time_on_ice_avg` | double precision | yes |  |
| `shifts_avg` | double precision | yes |  |
| `sat_percentage_avg` | double precision | yes |  |
| `sat_percentage_ahead_avg` | double precision | yes |  |
| `sat_percentage_behind_avg` | double precision | yes |  |
| `sat_percentage_close_avg` | double precision | yes |  |
| `sat_percentage_tied_avg` | double precision | yes |  |
| `usat_percentage_avg` | double precision | yes |  |
| `usat_percentage_ahead_avg` | double precision | yes |  |
| `usat_percentage_behind_avg` | double precision | yes |  |
| `usat_percentage_close_avg` | double precision | yes |  |
| `usat_percentage_tied_avg` | double precision | yes |  |
| `secondary_assists_5v5_avg` | double precision | yes |  |
| `primary_assists_5v5_avg` | double precision | yes |  |
| `ev_time_on_ice_per_game_avg` | double precision | yes |  |
| `ot_time_on_ice_per_game_avg` | double precision | yes |  |
| `shifts_per_game_avg` | double precision | yes |  |
| `toi_per_game_avg` | double precision | yes |  |
| `es_toi_per_game_avg` | double precision | yes |  |
| `points_per_game_avg` | double precision | yes |  |
| `pp_toi_per_game_avg` | double precision | yes |  |
| `sh_toi_per_game_avg` | double precision | yes |  |
| `penalty_seconds_per_game_avg` | double precision | yes |  |
| `sh_time_on_ice_pct_per_game_avg` | double precision | yes |  |
| `pp_toi_pct_per_game_avg` | double precision | yes |  |
| `time_on_ice_per_shift_avg` | double precision | yes |  |
| `penalty_minutes_per_toi_avg` | double precision | yes |  |
| `shooting_percentage_avg` | double precision | yes |  |
| `fow_percentage_avg` | double precision | yes |  |
| `d_zone_fo_percentage_avg` | double precision | yes |  |
| `ev_faceoff_percentage_avg` | double precision | yes |  |
| `n_zone_fo_percentage_avg` | double precision | yes |  |
| `o_zone_fo_percentage_avg` | double precision | yes |  |
| `pp_faceoff_percentage_avg` | double precision | yes |  |
| `sh_faceoff_percentage_avg` | double precision | yes |  |
| `es_goals_for_percentage_avg` | double precision | yes |  |
| `sh_shooting_percentage_avg` | double precision | yes |  |
| `pp_shooting_percentage_avg` | double precision | yes |  |
| `goals_pct_avg` | double precision | yes |  |
| `on_ice_shooting_pct_avg` | double precision | yes |  |
| `faceoff_pct_5v5_avg` | double precision | yes |  |
| `sat_pct_avg` | double precision | yes |  |
| `zone_start_pct_avg` | double precision | yes |  |
| `shooting_percentage_5v5_avg` | double precision | yes |  |
| `skater_save_pct_5v5_avg` | double precision | yes |  |
| `skater_shooting_plus_save_pct_5v5_avg` | double precision | yes |  |
| `o_zone_start_pct_5v5_avg` | double precision | yes |  |
| `on_ice_shooting_pct_5v5_avg` | double precision | yes |  |
| `zone_start_pct_5v5_avg` | double precision | yes |  |
| `blocks_per_60_avg` | double precision | yes |  |
| `giveaways_per_60_avg` | double precision | yes |  |
| `hits_per_60_avg` | double precision | yes |  |
| `takeaways_per_60_avg` | double precision | yes |  |
| `penalties_drawn_per_60_avg` | double precision | yes |  |
| `penalties_taken_per_60_avg` | double precision | yes |  |
| `pp_goals_against_per_60_avg` | double precision | yes |  |
| `sh_goals_per_60_avg` | double precision | yes |  |
| `sh_individual_sat_per_60_avg` | double precision | yes |  |
| `sh_points_per_60_avg` | double precision | yes |  |
| `sh_primary_assists_per_60_avg` | double precision | yes |  |
| `sh_secondary_assists_per_60_avg` | double precision | yes |  |
| `sh_shots_per_60_avg` | double precision | yes |  |
| `pp_goals_for_per_60_avg` | double precision | yes |  |
| `pp_goals_per_60_avg` | double precision | yes |  |
| `pp_individual_sat_per_60_avg` | double precision | yes |  |
| `pp_points_per_60_avg` | double precision | yes |  |
| `pp_primary_assists_per_60_avg` | double precision | yes |  |
| `pp_secondary_assists_per_60_avg` | double precision | yes |  |
| `pp_shots_per_60_avg` | double precision | yes |  |
| `individual_sat_for_per_60_avg` | double precision | yes |  |
| `individual_shots_for_per_60_avg` | double precision | yes |  |
| `assists_per_60_5v5_avg` | double precision | yes |  |
| `goals_per_60_5v5_avg` | double precision | yes |  |
| `points_per_60_5v5_avg` | double precision | yes |  |
| `primary_assists_per_60_5v5_avg` | double precision | yes |  |
| `secondary_assists_per_60_5v5_avg` | double precision | yes |  |
| `sat_relative_avg` | double precision | yes |  |
| `usat_relative_avg` | double precision | yes |  |
| `sat_relative_5v5_avg` | double precision | yes |  |
| `secondary_assists_5v5_per_60_avg` | numeric | yes |  |
| `assists_5v5_per_60_avg` | numeric | yes |  |
| `goals_5v5_per_60_avg` | numeric | yes |  |
| `points_5v5_per_60_avg` | numeric | yes |  |
| `pp_individual_sat_for_per_60_avg` | numeric | yes |  |
| `primary_assists_5v5_per_60_avg` | numeric | yes |  |
| `sh_individual_sat_for_per_60_avg` | numeric | yes |  |

## `public.xfs_audit_log`

Type: table

Primary key: `id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `id` | integer | no | nextval('xfs_audit_log_id_seq'::regclass) |
| `player_id` | integer | no |  |
| `prediction_date` | date | no |  |
| `game_date` | date | no |  |
| `predicted_xfs` | numeric | no |  |
| `actual_fantasy_score` | numeric | yes |  |
| `accuracy_score` | numeric | yes |  |
| `prediction_horizon` | integer | no |  |
| `created_at` | timestamp without time zone | yes | CURRENT_TIMESTAMP |
| `player_name` | text | yes |  |

## `public.yahoo_api_credentials`

Type: table

Primary key: `id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `id` | integer | no | nextval('yahoo_api_credentials_id_seq'::regclass) |
| `consumer_key` | text | no |  |
| `consumer_secret` | text | no |  |
| `access_token` | text | no |  |
| `refresh_token` | text | no |  |
| `token_expires_at` | timestamp with time zone | yes |  |
| `created_at` | timestamp with time zone | yes | now() |
| `updated_at` | timestamp with time zone | yes | now() |

## `public.yahoo_game_keys`

Type: table

Primary key: `game_id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `game_id` | integer | no |  |
| `game_key` | text | no |  |
| `name` | text | yes |  |
| `code` | text | yes |  |
| `type` | text | yes |  |
| `url` | text | yes |  |
| `season` | integer | yes |  |
| `is_registration_over` | integer | yes |  |
| `is_game_over` | integer | yes |  |
| `is_offseason` | integer | yes |  |
| `contest_group_id` | integer | yes |  |
| `current_week` | integer | yes |  |
| `editorial_season` | integer | yes |  |
| `game_weeks` | jsonb | yes |  |
| `has_schedule` | integer | yes |  |
| `is_contest_over` | integer | yes |  |
| `is_contest_reg_active` | integer | yes |  |
| `is_live_draft_lobby_active` | integer | yes |  |
| `leagues` | jsonb | yes |  |
| `picks_status` | text | yes |  |
| `players` | jsonb | yes |  |
| `position_types` | jsonb | yes |  |
| `roster_positions` | jsonb | yes |  |
| `scenario_generator` | integer | yes |  |
| `stat_categories` | jsonb | yes |  |
| `teams` | jsonb | yes |  |
| `last_updated` | timestamp with time zone | yes | now() |

## `public.yahoo_matchup_weeks`

Type: table

Primary key: `id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `id` | integer | no | nextval('yahoo_matchup_weeks_id_seq'::regclass) |
| `game_key` | text | no |  |
| `game_id` | text | yes |  |
| `name` | text | yes |  |
| `code` | text | yes |  |
| `type` | text | yes |  |
| `url` | text | yes |  |
| `season` | text | no |  |
| `week` | integer | no |  |
| `start_date` | date | yes |  |
| `end_date` | date | yes |  |
| `inserted_at` | timestamp with time zone | no | now() |

## `public.yahoo_names`

Type: table

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `player_id` | character varying | yes |  |
| `player_name` | character varying | yes |  |
| `first_name` | text | yes |  |
| `last_name` | text | yes |  |

## `public.yahoo_nhl_player_map`

Type: table

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `nhl_player_id` | text | yes |  |
| `nhl_player_name` | text | yes |  |
| `nhl_team_abbreviation` | text | yes |  |
| `name_norm` | text | yes |  |
| `player_type` | text | yes |  |
| `points` | numeric | yes |  |
| `goals` | numeric | yes |  |
| `assists` | numeric | yes |  |
| `shots` | numeric | yes |  |
| `pp_points` | numeric | yes |  |
| `blocked_shots` | numeric | yes |  |
| `hits` | numeric | yes |  |
| `total_fow` | numeric | yes |  |
| `penalty_minutes` | numeric | yes |  |
| `sh_points` | numeric | yes |  |
| `wins` | numeric | yes |  |
| `losses` | numeric | yes |  |
| `saves` | numeric | yes |  |
| `shots_against` | numeric | yes |  |
| `shutouts` | numeric | yes |  |
| `quality_start` | numeric | yes |  |
| `goals_against_avg` | numeric | yes |  |
| `save_pct` | numeric | yes |  |
| `yahoo_player_id` | character varying | yes |  |
| `yahoo_player_name` | character varying | yes |  |
| `yahoo_team` | character varying | yes |  |
| `percent_ownership` | double precision | yes |  |
| `eligible_positions` | jsonb | yes |  |
| `injury_note` | text | yes |  |
| `status` | character varying | yes |  |
| `status_full` | character varying | yes |  |
| `mapped_position` | text | yes |  |

## `public.yahoo_nhl_player_map_unmatched`

Type: table

Primary key: `id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `id` | bigint | no | nextval('yahoo_nhl_player_map_unmatched_id_seq'::regclass) |
| `nhl_player_id` | text | yes |  |
| `nhl_player_name` | text | yes |  |
| `nhl_normalized` | text | yes |  |
| `candidate_yahoo` | jsonb | yes |  |
| `attempts` | integer | yes | 0 |
| `created_at` | timestamp with time zone | yes | now() |
| `last_attempt_at` | timestamp with time zone | yes |  |

## `public.yahoo_player_draft_analysis_history`

Type: table

Primary key: `player_key`, `captured_at`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `player_key` | text | no |  |
| `captured_at` | timestamp with time zone | no | now() |
| `average_draft_pick` | numeric | yes |  |
| `average_draft_round` | numeric | yes |  |
| `average_draft_cost` | numeric | yes |  |
| `percent_drafted` | numeric | yes |  |
| `raw` | jsonb | no |  |
| `source` | text | yes | 'yahoo'::text |

## `public.yahoo_player_keys`

Type: table

Primary key: `player_key`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `player_key` | character varying | no |  |
| `player_id` | integer | yes |  |
| `player_name` | character varying | yes |  |
| `last_updated` | timestamp without time zone | no | now() |

## `public.yahoo_player_ownership_daily`

Type: table

Primary key: `player_key`, `ownership_date`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `player_key` | text | no |  |
| `ownership_date` | date | no |  |
| `ownership_pct` | double precision | yes |  |
| `season_start_year` | integer | yes |  |
| `season_id` | bigint | yes |  |
| `league_id` | text | yes |  |
| `game_id` | text | yes |  |
| `player_id` | bigint | yes |  |
| `player_name` | text | yes |  |
| `source` | text | yes | 'yahoo'::text |
| `inserted_at` | timestamp with time zone | no | now() |
| `updated_at` | timestamp with time zone | no | now() |

## `public.yahoo_player_ownership_history`

Type: table

Primary key: `player_key`, `ownership_date`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `player_key` | text | no |  |
| `ownership_date` | date | no |  |
| `ownership_pct` | double precision | yes |  |
| `source` | text | yes | 'yahoo'::text |
| `inserted_at` | timestamp with time zone | yes | now() |
| `player_name` | text | yes |  |
| `player_id` | bigint | yes |  |
| `game_id` | text | yes |  |
| `season_start_year` | integer | yes |  |
| `season_id` | bigint | yes |  |
| `league_id` | text | yes |  |

## `public.yahoo_players`

Type: table

Primary key: `player_key`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `player_name` | character varying | yes |  |
| `player_id` | character varying | yes |  |
| `draft_analysis` | jsonb | yes |  |
| `average_draft_pick` | double precision | yes |  |
| `average_draft_round` | double precision | yes |  |
| `average_draft_cost` | double precision | yes |  |
| `percent_drafted` | double precision | yes |  |
| `editorial_player_key` | character varying | yes |  |
| `editorial_team_abbreviation` | character varying | yes |  |
| `editorial_team_full_name` | character varying | yes |  |
| `eligible_positions` | jsonb | yes |  |
| `display_position` | text | yes |  |
| `headshot_url` | text | yes |  |
| `injury_note` | text | yes |  |
| `full_name` | character varying | yes |  |
| `percent_ownership` | double precision | yes |  |
| `player_key` | character varying | no |  |
| `position_type` | character varying | yes |  |
| `status` | character varying | yes |  |
| `status_full` | character varying | yes |  |
| `last_updated` | timestamp without time zone | yes | now() |
| `uniform_number` | smallint | yes |  |
| `ownership_timeline` | jsonb | yes | '[]'::jsonb |
| `game_id` | integer | yes |  |
| `season` | integer | yes |  |

## `public.yahoo_positions`

Type: table

Primary key: `player_key`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `player_key` | text | no |  |
| `player_id` | bigint | yes |  |
| `full_name` | text | yes |  |
| `display_position` | text | yes |  |
| `editorial_team_abbr` | text | yes |  |
| `team_full_name` | text | yes |  |
| `team_abbr` | text | yes |  |
| `position_type` | text | yes |  |
| `primary_position` | text | yes |  |
| `uniform_number` | text | yes |  |
| `status` | text | yes |  |

## `realtime.messages`

Type: table

Managed Supabase schema. Documented for catalog completeness; application code should usually avoid direct writes here.

Primary key: `id`, `inserted_at`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `topic` | text | no |  |
| `extension` | text | no |  |
| `payload` | jsonb | yes |  |
| `event` | text | yes |  |
| `private` | boolean | yes | false |
| `updated_at` | timestamp without time zone | no | now() |
| `inserted_at` | timestamp without time zone | no | now() |
| `id` | uuid | no | gen_random_uuid() |

## `realtime.schema_migrations`

Type: table

Managed Supabase schema. Documented for catalog completeness; application code should usually avoid direct writes here.

Primary key: `version`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `version` | bigint | no |  |
| `inserted_at` | timestamp without time zone | yes |  |

## `realtime.subscription`

Type: table

Managed Supabase schema. Documented for catalog completeness; application code should usually avoid direct writes here.

Primary key: `id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `id` | bigint | no |  |
| `subscription_id` | uuid | no |  |
| `entity` | regclass | no |  |
| `filters` | _user_defined_filter[] | no | '{}'::realtime.user_defined_filter[] |
| `claims` | jsonb | no |  |
| `claims_role` | regrole | no |  |
| `created_at` | timestamp without time zone | no | timezone('utc'::text, now()) |
| `action_filter` | text | yes | '*'::text |

## `storage.buckets`

Type: table

Managed Supabase schema. Documented for catalog completeness; application code should usually avoid direct writes here.

Primary key: `id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `id` | text | no |  |
| `name` | text | no |  |
| `owner` | uuid | yes |  |
| `created_at` | timestamp with time zone | yes | now() |
| `updated_at` | timestamp with time zone | yes | now() |
| `public` | boolean | yes | false |
| `avif_autodetection` | boolean | yes | false |
| `file_size_limit` | bigint | yes |  |
| `allowed_mime_types` | _text[] | yes |  |
| `owner_id` | text | yes |  |
| `type` | buckettype | no | 'STANDARD'::storage.buckettype |

## `storage.buckets_analytics`

Type: table

Managed Supabase schema. Documented for catalog completeness; application code should usually avoid direct writes here.

Primary key: `id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `name` | text | no |  |
| `type` | buckettype | no | 'ANALYTICS'::storage.buckettype |
| `format` | text | no | 'ICEBERG'::text |
| `created_at` | timestamp with time zone | no | now() |
| `updated_at` | timestamp with time zone | no | now() |
| `id` | uuid | no | gen_random_uuid() |
| `deleted_at` | timestamp with time zone | yes |  |

## `storage.buckets_vectors`

Type: table

Managed Supabase schema. Documented for catalog completeness; application code should usually avoid direct writes here.

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `id` | text | no |  |
| `type` | buckettype | no | 'VECTOR'::storage.buckettype |
| `created_at` | timestamp with time zone | no | now() |
| `updated_at` | timestamp with time zone | no | now() |

## `storage.migrations`

Type: table

Managed Supabase schema. Documented for catalog completeness; application code should usually avoid direct writes here.

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `id` | integer | no |  |
| `name` | character varying | no |  |
| `hash` | character varying | no |  |
| `executed_at` | timestamp without time zone | yes | CURRENT_TIMESTAMP |

## `storage.objects`

Type: table

Managed Supabase schema. Documented for catalog completeness; application code should usually avoid direct writes here.

Primary key: `id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `id` | uuid | no | gen_random_uuid() |
| `bucket_id` | text | yes |  |
| `name` | text | yes |  |
| `owner` | uuid | yes |  |
| `created_at` | timestamp with time zone | yes | now() |
| `updated_at` | timestamp with time zone | yes | now() |
| `last_accessed_at` | timestamp with time zone | yes | now() |
| `metadata` | jsonb | yes |  |
| `path_tokens` | _text[] | yes |  |
| `version` | text | yes |  |
| `owner_id` | text | yes |  |
| `user_metadata` | jsonb | yes |  |

## `storage.s3_multipart_uploads`

Type: table

Managed Supabase schema. Documented for catalog completeness; application code should usually avoid direct writes here.

Primary key: `id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `id` | text | no |  |
| `in_progress_size` | bigint | no | 0 |
| `upload_signature` | text | no |  |
| `bucket_id` | text | no |  |
| `key` | text | no |  |
| `version` | text | no |  |
| `owner_id` | text | yes |  |
| `created_at` | timestamp with time zone | no | now() |
| `user_metadata` | jsonb | yes |  |
| `metadata` | jsonb | yes |  |

## `storage.s3_multipart_uploads_parts`

Type: table

Managed Supabase schema. Documented for catalog completeness; application code should usually avoid direct writes here.

Primary key: `id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `id` | uuid | no | gen_random_uuid() |
| `upload_id` | text | no |  |
| `size` | bigint | no | 0 |
| `part_number` | integer | no |  |
| `bucket_id` | text | no |  |
| `key` | text | no |  |
| `etag` | text | no |  |
| `owner_id` | text | yes |  |
| `version` | text | no |  |
| `created_at` | timestamp with time zone | no | now() |

## `storage.vector_indexes`

Type: table

Managed Supabase schema. Documented for catalog completeness; application code should usually avoid direct writes here.

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `id` | text | no | gen_random_uuid() |
| `name` | text | no |  |
| `bucket_id` | text | no |  |
| `data_type` | text | no |  |
| `dimension` | integer | no |  |
| `distance_metric` | text | no |  |
| `metadata_configuration` | jsonb | yes |  |
| `created_at` | timestamp with time zone | no | now() |
| `updated_at` | timestamp with time zone | no | now() |

## `supabase_migrations.schema_migrations`

Type: table

Managed Supabase schema. Documented for catalog completeness; application code should usually avoid direct writes here.

Primary key: `version`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `version` | text | no |  |
| `statements` | _text[] | yes |  |
| `name` | text | yes |  |
| `created_by` | text | yes |  |
| `idempotency_key` | text | yes |  |

## `vault.cron_secrets`

Type: table

Managed Supabase schema. Documented for catalog completeness; application code should usually avoid direct writes here.

Primary key: `key`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `key` | text | no |  |
| `value` | text | no |  |

## `vault.decrypted_secrets`

Type: view

Managed Supabase schema. Documented for catalog completeness; application code should usually avoid direct writes here.

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `id` | uuid | yes |  |
| `name` | text | yes |  |
| `description` | text | yes |  |
| `secret` | text | yes |  |
| `decrypted_secret` | text | yes |  |
| `key_id` | uuid | yes |  |
| `nonce` | bytea | yes |  |
| `created_at` | timestamp with time zone | yes |  |
| `updated_at` | timestamp with time zone | yes |  |

## `vault.secrets`

Type: table

Managed Supabase schema. Documented for catalog completeness; application code should usually avoid direct writes here.

Primary key: `id`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| `id` | uuid | no | gen_random_uuid() |
| `name` | text | yes |  |
| `description` | text | no | ''::text |
| `secret` | text | no |  |
| `key_id` | uuid | yes | (pgsodium.create_key()).id |
| `nonce` | bytea | yes | pgsodium.crypto_aead_det_noncegen() |
| `created_at` | timestamp with time zone | no | CURRENT_TIMESTAMP |
| `updated_at` | timestamp with time zone | no | CURRENT_TIMESTAMP |
