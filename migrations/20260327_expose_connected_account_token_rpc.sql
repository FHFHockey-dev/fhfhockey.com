CREATE OR REPLACE FUNCTION public.upsert_connected_account_tokens_secure(
    p_connected_account_id UUID,
    p_user_id UUID,
    p_provider TEXT,
    p_access_token TEXT DEFAULT NULL,
    p_refresh_token TEXT DEFAULT NULL,
    p_token_type TEXT DEFAULT NULL,
    p_scopes JSONB DEFAULT NULL,
    p_provider_user_id TEXT DEFAULT NULL,
    p_expires_at TIMESTAMPTZ DEFAULT NULL,
    p_refresh_expires_at TIMESTAMPTZ DEFAULT NULL,
    p_last_refreshed_at TIMESTAMPTZ DEFAULT NULL,
    p_secret_metadata JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, private
AS $$
    SELECT private.upsert_connected_account_tokens(
        p_connected_account_id,
        p_user_id,
        p_provider,
        p_access_token,
        p_refresh_token,
        p_token_type,
        p_scopes,
        p_provider_user_id,
        p_expires_at,
        p_refresh_expires_at,
        p_last_refreshed_at,
        p_secret_metadata
    );
$$;

REVOKE ALL ON FUNCTION public.upsert_connected_account_tokens_secure(
    UUID,
    UUID,
    TEXT,
    TEXT,
    TEXT,
    TEXT,
    JSONB,
    TEXT,
    TIMESTAMPTZ,
    TIMESTAMPTZ,
    TIMESTAMPTZ,
    JSONB
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.upsert_connected_account_tokens_secure(
    UUID,
    UUID,
    TEXT,
    TEXT,
    TEXT,
    TEXT,
    JSONB,
    TEXT,
    TIMESTAMPTZ,
    TIMESTAMPTZ,
    TIMESTAMPTZ,
    JSONB
) FROM anon;
REVOKE ALL ON FUNCTION public.upsert_connected_account_tokens_secure(
    UUID,
    UUID,
    TEXT,
    TEXT,
    TEXT,
    TEXT,
    JSONB,
    TEXT,
    TIMESTAMPTZ,
    TIMESTAMPTZ,
    TIMESTAMPTZ,
    JSONB
) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.upsert_connected_account_tokens_secure(
    UUID,
    UUID,
    TEXT,
    TEXT,
    TEXT,
    TEXT,
    JSONB,
    TEXT,
    TIMESTAMPTZ,
    TIMESTAMPTZ,
    TIMESTAMPTZ,
    JSONB
) TO service_role;
