SET lock_timeout = '5s';
SET statement_timeout = '30s';

CREATE UNIQUE INDEX IF NOT EXISTS idx_connected_accounts_id_user_id_unique
ON public.connected_accounts (id, user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_external_leagues_id_user_id_unique
ON public.external_leagues (id, user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_external_teams_id_user_id_unique
ON public.external_teams (id, user_id);

-- Cover every composite ownership foreign key on the referencing side. These
-- indexes keep parent updates/deletes and constraint checks from scanning the
-- child tables as provider data grows.
CREATE INDEX IF NOT EXISTS idx_external_leagues_connected_account_user
ON public.external_leagues (connected_account_id, user_id);

CREATE INDEX IF NOT EXISTS idx_external_teams_connected_account_user
ON public.external_teams (connected_account_id, user_id);

CREATE INDEX IF NOT EXISTS idx_external_teams_external_league_user
ON public.external_teams (external_league_id, user_id);

CREATE INDEX IF NOT EXISTS idx_user_provider_preferences_connected_account_user
ON public.user_provider_preferences (connected_account_id, user_id);

CREATE INDEX IF NOT EXISTS idx_user_provider_preferences_default_league_user
ON public.user_provider_preferences (default_external_league_id, user_id);

CREATE INDEX IF NOT EXISTS idx_user_provider_preferences_default_team_user
ON public.user_provider_preferences (default_external_team_id, user_id);

CREATE INDEX IF NOT EXISTS idx_provider_sync_runs_connected_account_user
ON public.provider_sync_runs (connected_account_id, user_id);

CREATE INDEX IF NOT EXISTS idx_provider_sync_runs_external_league_user
ON public.provider_sync_runs (external_league_id, user_id);

CREATE INDEX IF NOT EXISTS idx_provider_sync_runs_external_team_user
ON public.provider_sync_runs (external_team_id, user_id);

CREATE INDEX IF NOT EXISTS idx_user_entitlements_source_account_user
ON public.user_entitlements (source_account_id, user_id);

CREATE INDEX IF NOT EXISTS idx_connected_account_tokens_connected_account_user
ON private.connected_account_tokens (connected_account_id, user_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'external_leagues_connected_account_user_fk'
          AND conrelid = 'public.external_leagues'::regclass
    ) THEN
        ALTER TABLE public.external_leagues
        ADD CONSTRAINT external_leagues_connected_account_user_fk
        FOREIGN KEY (connected_account_id, user_id)
        REFERENCES public.connected_accounts (id, user_id)
        ON DELETE CASCADE NOT VALID;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'external_teams_connected_account_user_fk'
          AND conrelid = 'public.external_teams'::regclass
    ) THEN
        ALTER TABLE public.external_teams
        ADD CONSTRAINT external_teams_connected_account_user_fk
        FOREIGN KEY (connected_account_id, user_id)
        REFERENCES public.connected_accounts (id, user_id)
        ON DELETE CASCADE NOT VALID;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'external_teams_external_league_user_fk'
          AND conrelid = 'public.external_teams'::regclass
    ) THEN
        ALTER TABLE public.external_teams
        ADD CONSTRAINT external_teams_external_league_user_fk
        FOREIGN KEY (external_league_id, user_id)
        REFERENCES public.external_leagues (id, user_id)
        ON DELETE CASCADE NOT VALID;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'user_provider_preferences_connected_account_user_fk'
          AND conrelid = 'public.user_provider_preferences'::regclass
    ) THEN
        ALTER TABLE public.user_provider_preferences
        ADD CONSTRAINT user_provider_preferences_connected_account_user_fk
        FOREIGN KEY (connected_account_id, user_id)
        REFERENCES public.connected_accounts (id, user_id) NOT VALID;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'user_provider_preferences_default_external_league_user_fk'
          AND conrelid = 'public.user_provider_preferences'::regclass
    ) THEN
        ALTER TABLE public.user_provider_preferences
        ADD CONSTRAINT user_provider_preferences_default_external_league_user_fk
        FOREIGN KEY (default_external_league_id, user_id)
        REFERENCES public.external_leagues (id, user_id) NOT VALID;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'user_provider_preferences_default_external_team_user_fk'
          AND conrelid = 'public.user_provider_preferences'::regclass
    ) THEN
        ALTER TABLE public.user_provider_preferences
        ADD CONSTRAINT user_provider_preferences_default_external_team_user_fk
        FOREIGN KEY (default_external_team_id, user_id)
        REFERENCES public.external_teams (id, user_id) NOT VALID;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'provider_sync_runs_connected_account_user_fk'
          AND conrelid = 'public.provider_sync_runs'::regclass
    ) THEN
        ALTER TABLE public.provider_sync_runs
        ADD CONSTRAINT provider_sync_runs_connected_account_user_fk
        FOREIGN KEY (connected_account_id, user_id)
        REFERENCES public.connected_accounts (id, user_id) NOT VALID;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'provider_sync_runs_external_league_user_fk'
          AND conrelid = 'public.provider_sync_runs'::regclass
    ) THEN
        ALTER TABLE public.provider_sync_runs
        ADD CONSTRAINT provider_sync_runs_external_league_user_fk
        FOREIGN KEY (external_league_id, user_id)
        REFERENCES public.external_leagues (id, user_id) NOT VALID;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'provider_sync_runs_external_team_user_fk'
          AND conrelid = 'public.provider_sync_runs'::regclass
    ) THEN
        ALTER TABLE public.provider_sync_runs
        ADD CONSTRAINT provider_sync_runs_external_team_user_fk
        FOREIGN KEY (external_team_id, user_id)
        REFERENCES public.external_teams (id, user_id) NOT VALID;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'user_entitlements_source_account_user_fk'
          AND conrelid = 'public.user_entitlements'::regclass
    ) THEN
        ALTER TABLE public.user_entitlements
        ADD CONSTRAINT user_entitlements_source_account_user_fk
        FOREIGN KEY (source_account_id, user_id)
        REFERENCES public.connected_accounts (id, user_id) NOT VALID;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'connected_account_tokens_connected_account_user_fk'
          AND conrelid = 'private.connected_account_tokens'::regclass
    ) THEN
        ALTER TABLE private.connected_account_tokens
        ADD CONSTRAINT connected_account_tokens_connected_account_user_fk
        FOREIGN KEY (connected_account_id, user_id)
        REFERENCES public.connected_accounts (id, user_id)
        ON DELETE CASCADE NOT VALID;
    END IF;
END $$;

ALTER TABLE public.external_leagues
VALIDATE CONSTRAINT external_leagues_connected_account_user_fk;
ALTER TABLE public.external_teams
VALIDATE CONSTRAINT external_teams_connected_account_user_fk;
ALTER TABLE public.external_teams
VALIDATE CONSTRAINT external_teams_external_league_user_fk;
ALTER TABLE public.user_provider_preferences
VALIDATE CONSTRAINT user_provider_preferences_connected_account_user_fk;
ALTER TABLE public.user_provider_preferences
VALIDATE CONSTRAINT user_provider_preferences_default_external_league_user_fk;
ALTER TABLE public.user_provider_preferences
VALIDATE CONSTRAINT user_provider_preferences_default_external_team_user_fk;
ALTER TABLE public.provider_sync_runs
VALIDATE CONSTRAINT provider_sync_runs_connected_account_user_fk;
ALTER TABLE public.provider_sync_runs
VALIDATE CONSTRAINT provider_sync_runs_external_league_user_fk;
ALTER TABLE public.provider_sync_runs
VALIDATE CONSTRAINT provider_sync_runs_external_team_user_fk;
ALTER TABLE public.user_entitlements
VALIDATE CONSTRAINT user_entitlements_source_account_user_fk;
ALTER TABLE private.connected_account_tokens
VALIDATE CONSTRAINT connected_account_tokens_connected_account_user_fk;

CREATE OR REPLACE FUNCTION public.get_connected_account_tokens_secure(
    p_connected_account_id UUID,
    p_user_id UUID
)
RETURNS TABLE (
    id UUID,
    connected_account_id UUID,
    user_id UUID,
    provider TEXT,
    access_token TEXT,
    refresh_token TEXT,
    token_type TEXT,
    scopes JSONB,
    provider_user_id TEXT,
    expires_at TIMESTAMPTZ,
    refresh_expires_at TIMESTAMPTZ,
    last_refreshed_at TIMESTAMPTZ,
    secret_metadata JSONB,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, private
AS $$
    SELECT *
    FROM private.get_connected_account_tokens(
        p_connected_account_id,
        p_user_id
    );
$$;

REVOKE ALL ON FUNCTION public.get_connected_account_tokens_secure(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_connected_account_tokens_secure(UUID, UUID) FROM anon;
REVOKE ALL ON FUNCTION public.get_connected_account_tokens_secure(UUID, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_connected_account_tokens_secure(UUID, UUID) TO service_role;
;
