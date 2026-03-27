-- Harden provider token storage by moving raw token material into Supabase Vault.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_namespace
        WHERE nspname = 'vault'
    ) THEN
        RAISE EXCEPTION
            'Supabase Vault must be enabled before applying 20260327_encrypt_connected_account_tokens_with_vault.sql';
    END IF;
END;
$$;

ALTER TABLE private.connected_account_tokens
ADD COLUMN IF NOT EXISTS access_token_secret_id UUID NULL,
ADD COLUMN IF NOT EXISTS refresh_token_secret_id UUID NULL;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'private'
          AND table_name = 'connected_account_tokens'
          AND column_name = 'access_token'
    ) THEN
        EXECUTE $sql$
            UPDATE private.connected_account_tokens
            SET access_token_secret_id = vault.create_secret(
                access_token,
                format('connected-account:%s:access-token', connected_account_id),
                format('Encrypted %s access token for connected account %s', provider, connected_account_id)
            )
            WHERE access_token IS NOT NULL
              AND access_token_secret_id IS NULL
        $sql$;
    END IF;
END;
$$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'private'
          AND table_name = 'connected_account_tokens'
          AND column_name = 'refresh_token'
    ) THEN
        EXECUTE $sql$
            UPDATE private.connected_account_tokens
            SET refresh_token_secret_id = vault.create_secret(
                refresh_token,
                format('connected-account:%s:refresh-token', connected_account_id),
                format('Encrypted %s refresh token for connected account %s', provider, connected_account_id)
            )
            WHERE refresh_token IS NOT NULL
              AND refresh_token_secret_id IS NULL
        $sql$;
    END IF;
END;
$$;

ALTER TABLE private.connected_account_tokens
DROP COLUMN IF EXISTS access_token,
DROP COLUMN IF EXISTS refresh_token;

COMMENT ON COLUMN private.connected_account_tokens.access_token_secret_id IS
'Vault secret id for the encrypted provider access token. The raw token is never stored in this table.';

COMMENT ON COLUMN private.connected_account_tokens.refresh_token_secret_id IS
'Vault secret id for the encrypted provider refresh token. The raw token is never stored in this table.';

CREATE INDEX IF NOT EXISTS idx_connected_account_tokens_access_token_secret_id
ON private.connected_account_tokens (access_token_secret_id);

CREATE INDEX IF NOT EXISTS idx_connected_account_tokens_refresh_token_secret_id
ON private.connected_account_tokens (refresh_token_secret_id);

CREATE OR REPLACE FUNCTION private.upsert_connected_account_tokens(
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
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = private, public, vault
AS $$
DECLARE
    existing_record private.connected_account_tokens%ROWTYPE;
    v_access_token_secret_id UUID;
    v_refresh_token_secret_id UUID;
    v_row_id UUID;
BEGIN
    SELECT *
    INTO existing_record
    FROM private.connected_account_tokens
    WHERE connected_account_id = p_connected_account_id
      AND user_id = p_user_id
    FOR UPDATE;

    IF FOUND THEN
        v_row_id := existing_record.id;

        IF p_access_token IS NOT NULL THEN
            IF existing_record.access_token_secret_id IS NULL THEN
                v_access_token_secret_id := vault.create_secret(
                    p_access_token,
                    format('connected-account:%s:access-token', p_connected_account_id),
                    format('Encrypted %s access token for connected account %s', p_provider, p_connected_account_id)
                );
            ELSE
                PERFORM vault.update_secret(
                    existing_record.access_token_secret_id,
                    p_access_token,
                    format('connected-account:%s:access-token', p_connected_account_id),
                    format('Encrypted %s access token for connected account %s', p_provider, p_connected_account_id)
                );
                v_access_token_secret_id := existing_record.access_token_secret_id;
            END IF;
        ELSE
            v_access_token_secret_id := existing_record.access_token_secret_id;
        END IF;

        IF p_refresh_token IS NOT NULL THEN
            IF existing_record.refresh_token_secret_id IS NULL THEN
                v_refresh_token_secret_id := vault.create_secret(
                    p_refresh_token,
                    format('connected-account:%s:refresh-token', p_connected_account_id),
                    format('Encrypted %s refresh token for connected account %s', p_provider, p_connected_account_id)
                );
            ELSE
                PERFORM vault.update_secret(
                    existing_record.refresh_token_secret_id,
                    p_refresh_token,
                    format('connected-account:%s:refresh-token', p_connected_account_id),
                    format('Encrypted %s refresh token for connected account %s', p_provider, p_connected_account_id)
                );
                v_refresh_token_secret_id := existing_record.refresh_token_secret_id;
            END IF;
        ELSE
            v_refresh_token_secret_id := existing_record.refresh_token_secret_id;
        END IF;

        UPDATE private.connected_account_tokens
        SET provider = p_provider,
            access_token_secret_id = v_access_token_secret_id,
            refresh_token_secret_id = v_refresh_token_secret_id,
            token_type = COALESCE(p_token_type, existing_record.token_type),
            scopes = COALESCE(p_scopes, existing_record.scopes),
            provider_user_id = COALESCE(p_provider_user_id, existing_record.provider_user_id),
            expires_at = COALESCE(p_expires_at, existing_record.expires_at),
            refresh_expires_at = COALESCE(p_refresh_expires_at, existing_record.refresh_expires_at),
            last_refreshed_at = COALESCE(p_last_refreshed_at, existing_record.last_refreshed_at),
            secret_metadata = COALESCE(p_secret_metadata, existing_record.secret_metadata),
            updated_at = NOW()
        WHERE id = existing_record.id;
    ELSE
        IF p_access_token IS NOT NULL THEN
            v_access_token_secret_id := vault.create_secret(
                p_access_token,
                format('connected-account:%s:access-token', p_connected_account_id),
                format('Encrypted %s access token for connected account %s', p_provider, p_connected_account_id)
            );
        END IF;

        IF p_refresh_token IS NOT NULL THEN
            v_refresh_token_secret_id := vault.create_secret(
                p_refresh_token,
                format('connected-account:%s:refresh-token', p_connected_account_id),
                format('Encrypted %s refresh token for connected account %s', p_provider, p_connected_account_id)
            );
        END IF;

        INSERT INTO private.connected_account_tokens (
            connected_account_id,
            user_id,
            provider,
            access_token_secret_id,
            refresh_token_secret_id,
            token_type,
            scopes,
            provider_user_id,
            expires_at,
            refresh_expires_at,
            last_refreshed_at,
            secret_metadata
        )
        VALUES (
            p_connected_account_id,
            p_user_id,
            p_provider,
            v_access_token_secret_id,
            v_refresh_token_secret_id,
            p_token_type,
            COALESCE(p_scopes, '[]'::jsonb),
            p_provider_user_id,
            p_expires_at,
            p_refresh_expires_at,
            p_last_refreshed_at,
            COALESCE(p_secret_metadata, '{}'::jsonb)
        )
        RETURNING id INTO v_row_id;
    END IF;

    RETURN v_row_id;
END;
$$;

CREATE OR REPLACE FUNCTION private.get_connected_account_tokens(
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
SET search_path = private, public, vault
AS $$
    SELECT
        cat.id,
        cat.connected_account_id,
        cat.user_id,
        cat.provider,
        access_secret.decrypted_secret AS access_token,
        refresh_secret.decrypted_secret AS refresh_token,
        cat.token_type,
        cat.scopes,
        cat.provider_user_id,
        cat.expires_at,
        cat.refresh_expires_at,
        cat.last_refreshed_at,
        cat.secret_metadata,
        cat.created_at,
        cat.updated_at
    FROM private.connected_account_tokens AS cat
    LEFT JOIN vault.decrypted_secrets AS access_secret
        ON access_secret.id = cat.access_token_secret_id
    LEFT JOIN vault.decrypted_secrets AS refresh_secret
        ON refresh_secret.id = cat.refresh_token_secret_id
    WHERE cat.connected_account_id = p_connected_account_id
      AND cat.user_id = p_user_id;
$$;

CREATE OR REPLACE FUNCTION private.cleanup_connected_account_token_secrets()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = private, public, vault
AS $$
BEGIN
    IF OLD.access_token_secret_id IS NOT NULL THEN
        DELETE FROM vault.secrets
        WHERE id = OLD.access_token_secret_id;
    END IF;

    IF OLD.refresh_token_secret_id IS NOT NULL
       AND OLD.refresh_token_secret_id <> OLD.access_token_secret_id THEN
        DELETE FROM vault.secrets
        WHERE id = OLD.refresh_token_secret_id;
    END IF;

    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS cleanup_connected_account_token_secrets
ON private.connected_account_tokens;

CREATE TRIGGER cleanup_connected_account_token_secrets
BEFORE DELETE ON private.connected_account_tokens
FOR EACH ROW
EXECUTE FUNCTION private.cleanup_connected_account_token_secrets();

REVOKE USAGE ON SCHEMA vault FROM PUBLIC;
REVOKE USAGE ON SCHEMA vault FROM anon;
REVOKE USAGE ON SCHEMA vault FROM authenticated;

REVOKE ALL ON TABLE vault.secrets FROM PUBLIC;
REVOKE ALL ON TABLE vault.secrets FROM anon;
REVOKE ALL ON TABLE vault.secrets FROM authenticated;
REVOKE ALL ON TABLE vault.decrypted_secrets FROM PUBLIC;
REVOKE ALL ON TABLE vault.decrypted_secrets FROM anon;
REVOKE ALL ON TABLE vault.decrypted_secrets FROM authenticated;

REVOKE ALL ON FUNCTION private.upsert_connected_account_tokens(
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
REVOKE ALL ON FUNCTION private.upsert_connected_account_tokens(
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
REVOKE ALL ON FUNCTION private.upsert_connected_account_tokens(
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

REVOKE ALL ON FUNCTION private.get_connected_account_tokens(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.get_connected_account_tokens(UUID, UUID) FROM anon;
REVOKE ALL ON FUNCTION private.get_connected_account_tokens(UUID, UUID) FROM authenticated;

REVOKE ALL ON FUNCTION private.cleanup_connected_account_token_secrets() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.cleanup_connected_account_token_secrets() FROM anon;
REVOKE ALL ON FUNCTION private.cleanup_connected_account_token_secrets() FROM authenticated;

GRANT USAGE ON SCHEMA private TO service_role;
GRANT EXECUTE ON FUNCTION private.upsert_connected_account_tokens(
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
GRANT EXECUTE ON FUNCTION private.get_connected_account_tokens(UUID, UUID) TO service_role;
