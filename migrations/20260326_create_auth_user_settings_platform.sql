-- Auth + user settings platform
-- Subtask 1.1: create the core user-owned tables for profiles, settings, and saved teams.

CREATE TABLE IF NOT EXISTS user_profiles (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT NULL,
    avatar_url TEXT NULL,
    timezone TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_settings (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    scoring_categories JSONB NOT NULL DEFAULT '{
        "GOALS": 3,
        "ASSISTS": 2,
        "PP_POINTS": 1,
        "SHOTS_ON_GOAL": 0.2,
        "HITS": 0.2,
        "BLOCKED_SHOTS": 0.25
    }'::jsonb,
    league_type TEXT NOT NULL DEFAULT 'points',
    category_weights JSONB NOT NULL DEFAULT '{
        "GOALS": 1,
        "ASSISTS": 1,
        "PP_POINTS": 1,
        "SHOTS_ON_GOAL": 1,
        "HITS": 1,
        "BLOCKED_SHOTS": 1,
        "WINS_GOALIE": 1,
        "SAVES_GOALIE": 1,
        "SAVE_PERCENTAGE": 1
    }'::jsonb,
    roster_config JSONB NOT NULL DEFAULT '{
        "C": 2,
        "LW": 2,
        "RW": 2,
        "D": 4,
        "G": 2,
        "bench": 4,
        "utility": 1
    }'::jsonb,
    ui_preferences JSONB NOT NULL DEFAULT '{
        "account_settings_section": "profile",
        "league_settings_panel_open": true
    }'::jsonb,
    active_context JSONB NOT NULL DEFAULT '{
        "source_type": "manual",
        "provider": null,
        "external_league_id": null,
        "external_team_id": null
    }'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_saved_teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    source_type TEXT NOT NULL DEFAULT 'manual',
    provider TEXT NULL,
    external_team_key TEXT NULL,
    external_league_key TEXT NULL,
    roster_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    settings_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS connected_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    provider_user_id TEXT NULL,
    account_label TEXT NULL,
    status TEXT NOT NULL DEFAULT 'disconnected',
    scopes JSONB NOT NULL DEFAULT '[]'::jsonb,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    last_synced_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS external_leagues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connected_account_id UUID NOT NULL REFERENCES connected_accounts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    external_league_key TEXT NOT NULL,
    league_name TEXT NULL,
    season_key TEXT NULL,
    league_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    scoring_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    roster_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    imported_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS external_teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_league_id UUID NOT NULL REFERENCES external_leagues(id) ON DELETE CASCADE,
    connected_account_id UUID NOT NULL REFERENCES connected_accounts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    external_team_key TEXT NOT NULL,
    team_name TEXT NULL,
    team_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    roster_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    imported_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_provider_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    connected_account_id UUID NULL REFERENCES connected_accounts(id) ON DELETE CASCADE,
    default_external_league_id UUID NULL REFERENCES external_leagues(id) ON DELETE SET NULL,
    default_external_team_id UUID NULL REFERENCES external_teams(id) ON DELETE SET NULL,
    refresh_on_login BOOLEAN NOT NULL DEFAULT FALSE,
    active_context JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS provider_sync_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    connected_account_id UUID NULL REFERENCES connected_accounts(id) ON DELETE CASCADE,
    external_league_id UUID NULL REFERENCES external_leagues(id) ON DELETE CASCADE,
    external_team_id UUID NULL REFERENCES external_teams(id) ON DELETE CASCADE,
    trigger_source TEXT NOT NULL DEFAULT 'manual',
    status TEXT NOT NULL DEFAULT 'queued',
    dedupe_key TEXT NULL,
    cooldown_until TIMESTAMPTZ NULL,
    started_at TIMESTAMPTZ NULL,
    finished_at TIMESTAMPTZ NULL,
    result_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
    error_details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_entitlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    source_provider TEXT NOT NULL,
    source_account_id UUID NULL REFERENCES connected_accounts(id) ON DELETE SET NULL,
    entitlement_key TEXT NOT NULL,
    entitlement_status TEXT NOT NULL DEFAULT 'inactive',
    source_reference TEXT NULL,
    effective_from TIMESTAMPTZ NULL,
    effective_to TIMESTAMPTZ NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_saved_teams_user_id
ON user_saved_teams (user_id);

CREATE INDEX IF NOT EXISTS idx_user_saved_teams_user_id_created_at
ON user_saved_teams (user_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_saved_teams_one_default_per_user
ON user_saved_teams (user_id)
WHERE is_default = TRUE;

CREATE INDEX IF NOT EXISTS idx_connected_accounts_user_id
ON connected_accounts (user_id);

CREATE INDEX IF NOT EXISTS idx_connected_accounts_user_id_provider
ON connected_accounts (user_id, provider);

CREATE UNIQUE INDEX IF NOT EXISTS idx_connected_accounts_id_user_id_unique
ON connected_accounts (id, user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_connected_accounts_provider_user_id_unique
ON connected_accounts (provider, provider_user_id)
WHERE provider_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_external_leagues_user_id_provider
ON external_leagues (user_id, provider);

CREATE UNIQUE INDEX IF NOT EXISTS idx_external_leagues_id_user_id_unique
ON external_leagues (id, user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_external_leagues_account_league_unique
ON external_leagues (connected_account_id, external_league_key);

CREATE INDEX IF NOT EXISTS idx_external_teams_user_id_provider
ON external_teams (user_id, provider);

CREATE UNIQUE INDEX IF NOT EXISTS idx_external_teams_id_user_id_unique
ON external_teams (id, user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_external_teams_league_team_unique
ON external_teams (external_league_id, external_team_key);

CREATE INDEX IF NOT EXISTS idx_user_provider_preferences_user_id_provider
ON user_provider_preferences (user_id, provider);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_provider_preferences_unique_user_provider
ON user_provider_preferences (user_id, provider);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_provider_preferences_default_league_unique
ON user_provider_preferences (default_external_league_id)
WHERE default_external_league_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_provider_preferences_default_team_unique
ON user_provider_preferences (default_external_team_id)
WHERE default_external_team_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_provider_sync_runs_user_id_provider_created_at
ON provider_sync_runs (user_id, provider, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_provider_sync_runs_status_created_at
ON provider_sync_runs (status, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_provider_sync_runs_dedupe_key_unique
ON provider_sync_runs (dedupe_key)
WHERE dedupe_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_entitlements_user_id_source_provider
ON user_entitlements (user_id, source_provider);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_entitlements_source_reference_unique
ON user_entitlements (source_provider, source_reference)
WHERE source_reference IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_entitlements_patreon_source_reference_unique
ON user_entitlements (source_reference)
WHERE source_provider = 'patreon' AND source_reference IS NOT NULL;

ALTER TABLE external_leagues
DROP CONSTRAINT IF EXISTS external_leagues_connected_account_user_fk;

ALTER TABLE external_leagues
ADD CONSTRAINT external_leagues_connected_account_user_fk
FOREIGN KEY (connected_account_id, user_id)
REFERENCES connected_accounts (id, user_id)
ON DELETE CASCADE;

ALTER TABLE external_teams
DROP CONSTRAINT IF EXISTS external_teams_connected_account_user_fk;

ALTER TABLE external_teams
ADD CONSTRAINT external_teams_connected_account_user_fk
FOREIGN KEY (connected_account_id, user_id)
REFERENCES connected_accounts (id, user_id)
ON DELETE CASCADE;

ALTER TABLE external_teams
DROP CONSTRAINT IF EXISTS external_teams_external_league_user_fk;

ALTER TABLE external_teams
ADD CONSTRAINT external_teams_external_league_user_fk
FOREIGN KEY (external_league_id, user_id)
REFERENCES external_leagues (id, user_id)
ON DELETE CASCADE;

ALTER TABLE user_provider_preferences
DROP CONSTRAINT IF EXISTS user_provider_preferences_connected_account_user_fk;

ALTER TABLE user_provider_preferences
ADD CONSTRAINT user_provider_preferences_connected_account_user_fk
FOREIGN KEY (connected_account_id, user_id)
REFERENCES connected_accounts (id, user_id);

ALTER TABLE user_provider_preferences
DROP CONSTRAINT IF EXISTS user_provider_preferences_default_external_league_user_fk;

ALTER TABLE user_provider_preferences
ADD CONSTRAINT user_provider_preferences_default_external_league_user_fk
FOREIGN KEY (default_external_league_id, user_id)
REFERENCES external_leagues (id, user_id);

ALTER TABLE user_provider_preferences
DROP CONSTRAINT IF EXISTS user_provider_preferences_default_external_team_user_fk;

ALTER TABLE user_provider_preferences
ADD CONSTRAINT user_provider_preferences_default_external_team_user_fk
FOREIGN KEY (default_external_team_id, user_id)
REFERENCES external_teams (id, user_id);

ALTER TABLE provider_sync_runs
DROP CONSTRAINT IF EXISTS provider_sync_runs_connected_account_user_fk;

ALTER TABLE provider_sync_runs
ADD CONSTRAINT provider_sync_runs_connected_account_user_fk
FOREIGN KEY (connected_account_id, user_id)
REFERENCES connected_accounts (id, user_id);

ALTER TABLE provider_sync_runs
DROP CONSTRAINT IF EXISTS provider_sync_runs_external_league_user_fk;

ALTER TABLE provider_sync_runs
ADD CONSTRAINT provider_sync_runs_external_league_user_fk
FOREIGN KEY (external_league_id, user_id)
REFERENCES external_leagues (id, user_id);

ALTER TABLE provider_sync_runs
DROP CONSTRAINT IF EXISTS provider_sync_runs_external_team_user_fk;

ALTER TABLE provider_sync_runs
ADD CONSTRAINT provider_sync_runs_external_team_user_fk
FOREIGN KEY (external_team_id, user_id)
REFERENCES external_teams (id, user_id);

ALTER TABLE user_entitlements
DROP CONSTRAINT IF EXISTS user_entitlements_source_account_user_fk;

ALTER TABLE user_entitlements
ADD CONSTRAINT user_entitlements_source_account_user_fk
FOREIGN KEY (source_account_id, user_id)
REFERENCES connected_accounts (id, user_id);

CREATE SCHEMA IF NOT EXISTS private;

REVOKE ALL ON SCHEMA private FROM PUBLIC;
REVOKE ALL ON SCHEMA private FROM anon;
REVOKE ALL ON SCHEMA private FROM authenticated;

CREATE TABLE IF NOT EXISTS private.connected_account_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connected_account_id UUID NOT NULL REFERENCES connected_accounts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    access_token TEXT NULL,
    refresh_token TEXT NULL,
    token_type TEXT NULL,
    scopes JSONB NOT NULL DEFAULT '[]'::jsonb,
    provider_user_id TEXT NULL,
    expires_at TIMESTAMPTZ NULL,
    refresh_expires_at TIMESTAMPTZ NULL,
    last_refreshed_at TIMESTAMPTZ NULL,
    secret_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

REVOKE ALL ON TABLE private.connected_account_tokens FROM PUBLIC;
REVOKE ALL ON TABLE private.connected_account_tokens FROM anon;
REVOKE ALL ON TABLE private.connected_account_tokens FROM authenticated;

CREATE INDEX IF NOT EXISTS idx_connected_account_tokens_connected_account_id
ON private.connected_account_tokens (connected_account_id);

CREATE INDEX IF NOT EXISTS idx_connected_account_tokens_user_id_provider
ON private.connected_account_tokens (user_id, provider);

CREATE UNIQUE INDEX IF NOT EXISTS idx_connected_account_tokens_connected_account_unique
ON private.connected_account_tokens (connected_account_id);

ALTER TABLE private.connected_account_tokens
DROP CONSTRAINT IF EXISTS connected_account_tokens_connected_account_user_fk;

ALTER TABLE private.connected_account_tokens
ADD CONSTRAINT connected_account_tokens_connected_account_user_fk
FOREIGN KEY (connected_account_id, user_id)
REFERENCES connected_accounts (id, user_id)
ON DELETE CASCADE;

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_saved_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE connected_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_provider_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_sync_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_entitlements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_profiles_select_own ON user_profiles;
CREATE POLICY user_profiles_select_own
ON user_profiles
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS user_profiles_insert_own ON user_profiles;
CREATE POLICY user_profiles_insert_own
ON user_profiles
FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS user_profiles_update_own ON user_profiles;
CREATE POLICY user_profiles_update_own
ON user_profiles
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS user_profiles_delete_own ON user_profiles;
CREATE POLICY user_profiles_delete_own
ON user_profiles
FOR DELETE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS user_settings_select_own ON user_settings;
CREATE POLICY user_settings_select_own
ON user_settings
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS user_settings_insert_own ON user_settings;
CREATE POLICY user_settings_insert_own
ON user_settings
FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS user_settings_update_own ON user_settings;
CREATE POLICY user_settings_update_own
ON user_settings
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS user_settings_delete_own ON user_settings;
CREATE POLICY user_settings_delete_own
ON user_settings
FOR DELETE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS user_saved_teams_select_own ON user_saved_teams;
CREATE POLICY user_saved_teams_select_own
ON user_saved_teams
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS user_saved_teams_insert_own ON user_saved_teams;
CREATE POLICY user_saved_teams_insert_own
ON user_saved_teams
FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS user_saved_teams_update_own ON user_saved_teams;
CREATE POLICY user_saved_teams_update_own
ON user_saved_teams
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS user_saved_teams_delete_own ON user_saved_teams;
CREATE POLICY user_saved_teams_delete_own
ON user_saved_teams
FOR DELETE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS connected_accounts_select_own ON connected_accounts;
CREATE POLICY connected_accounts_select_own
ON connected_accounts
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS connected_accounts_insert_own ON connected_accounts;
CREATE POLICY connected_accounts_insert_own
ON connected_accounts
FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS connected_accounts_update_own ON connected_accounts;
CREATE POLICY connected_accounts_update_own
ON connected_accounts
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS connected_accounts_delete_own ON connected_accounts;
CREATE POLICY connected_accounts_delete_own
ON connected_accounts
FOR DELETE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS external_leagues_select_own ON external_leagues;
CREATE POLICY external_leagues_select_own
ON external_leagues
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS external_leagues_insert_own ON external_leagues;
CREATE POLICY external_leagues_insert_own
ON external_leagues
FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS external_leagues_update_own ON external_leagues;
CREATE POLICY external_leagues_update_own
ON external_leagues
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS external_leagues_delete_own ON external_leagues;
CREATE POLICY external_leagues_delete_own
ON external_leagues
FOR DELETE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS external_teams_select_own ON external_teams;
CREATE POLICY external_teams_select_own
ON external_teams
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS external_teams_insert_own ON external_teams;
CREATE POLICY external_teams_insert_own
ON external_teams
FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS external_teams_update_own ON external_teams;
CREATE POLICY external_teams_update_own
ON external_teams
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS external_teams_delete_own ON external_teams;
CREATE POLICY external_teams_delete_own
ON external_teams
FOR DELETE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS user_provider_preferences_select_own ON user_provider_preferences;
CREATE POLICY user_provider_preferences_select_own
ON user_provider_preferences
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS user_provider_preferences_insert_own ON user_provider_preferences;
CREATE POLICY user_provider_preferences_insert_own
ON user_provider_preferences
FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS user_provider_preferences_update_own ON user_provider_preferences;
CREATE POLICY user_provider_preferences_update_own
ON user_provider_preferences
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS user_provider_preferences_delete_own ON user_provider_preferences;
CREATE POLICY user_provider_preferences_delete_own
ON user_provider_preferences
FOR DELETE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS provider_sync_runs_select_own ON provider_sync_runs;
CREATE POLICY provider_sync_runs_select_own
ON provider_sync_runs
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS provider_sync_runs_insert_own ON provider_sync_runs;
CREATE POLICY provider_sync_runs_insert_own
ON provider_sync_runs
FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS provider_sync_runs_update_own ON provider_sync_runs;
CREATE POLICY provider_sync_runs_update_own
ON provider_sync_runs
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS provider_sync_runs_delete_own ON provider_sync_runs;
CREATE POLICY provider_sync_runs_delete_own
ON provider_sync_runs
FOR DELETE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS user_entitlements_select_own ON user_entitlements;
CREATE POLICY user_entitlements_select_own
ON user_entitlements
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS user_entitlements_insert_own ON user_entitlements;
CREATE POLICY user_entitlements_insert_own
ON user_entitlements
FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS user_entitlements_update_own ON user_entitlements;
CREATE POLICY user_entitlements_update_own
ON user_entitlements
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS user_entitlements_delete_own ON user_entitlements;
CREATE POLICY user_entitlements_delete_own
ON user_entitlements
FOR DELETE
USING (auth.uid() = user_id);
