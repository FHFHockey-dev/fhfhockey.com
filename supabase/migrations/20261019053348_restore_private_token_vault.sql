-- Restore the private token vault that the active chain calls but never creates.
-- The baseline was dumped from the public schema only, so it keeps the
-- public.*_connected_account_tokens_secure wrappers while the private schema,
-- its token table, the composite owner foreign key and the three private
-- routines exist only in supabase/migration-archive/pre-baseline-20260716.
-- A fresh replay therefore fails every Yahoo, Patreon, Fantrax and ESPN token
-- write at runtime. This file recreates the final production state of
-- production-ledger 20260713055508, 20260713055537 and 20260713060931
-- (raw-token columns already moved to Vault). Every statement is guarded or
-- replace-style, so on an environment that already has the vault it only
-- re-states identical definitions. It never reads or writes token rows.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'vault') then
    raise exception 'Supabase Vault must be enabled before restoring the private token vault.';
  end if;
end;
$$;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;

create table if not exists private.connected_account_tokens (
  id uuid primary key default gen_random_uuid(),
  connected_account_id uuid not null references public.connected_accounts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null,
  token_type text null,
  scopes jsonb not null default '[]'::jsonb,
  provider_user_id text null,
  expires_at timestamptz null,
  refresh_expires_at timestamptz null,
  last_refreshed_at timestamptz null,
  secret_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  access_token_secret_id uuid null,
  refresh_token_secret_id uuid null
);

alter table private.connected_account_tokens
  add column if not exists access_token_secret_id uuid null,
  add column if not exists refresh_token_secret_id uuid null;

revoke all on table private.connected_account_tokens from public, anon, authenticated;

comment on column private.connected_account_tokens.access_token_secret_id is
'Vault secret id for the encrypted provider access token. The raw token is never stored in this table.';
comment on column private.connected_account_tokens.refresh_token_secret_id is
'Vault secret id for the encrypted provider refresh token. The raw token is never stored in this table.';

create index if not exists idx_connected_account_tokens_connected_account_id
  on private.connected_account_tokens (connected_account_id);
create index if not exists idx_connected_account_tokens_user_id_provider
  on private.connected_account_tokens (user_id, provider);
create unique index if not exists idx_connected_account_tokens_connected_account_unique
  on private.connected_account_tokens (connected_account_id);
create index if not exists idx_connected_account_tokens_access_token_secret_id
  on private.connected_account_tokens (access_token_secret_id);
create index if not exists idx_connected_account_tokens_refresh_token_secret_id
  on private.connected_account_tokens (refresh_token_secret_id);
create index if not exists idx_connected_account_tokens_connected_account_user
  on private.connected_account_tokens (connected_account_id, user_id);

-- The eleventh (connected_account_id, user_id) owner key; the other ten are
-- in the baseline.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'connected_account_tokens_connected_account_user_fk'
      and conrelid = 'private.connected_account_tokens'::regclass
  ) then
    alter table private.connected_account_tokens
      add constraint connected_account_tokens_connected_account_user_fk
      foreign key (connected_account_id, user_id)
      references public.connected_accounts (id, user_id)
      on delete cascade;
  end if;
end;
$$;

create or replace function private.upsert_connected_account_tokens(
    p_connected_account_id uuid,
    p_user_id uuid,
    p_provider text,
    p_access_token text default null,
    p_refresh_token text default null,
    p_token_type text default null,
    p_scopes jsonb default null,
    p_provider_user_id text default null,
    p_expires_at timestamptz default null,
    p_refresh_expires_at timestamptz default null,
    p_last_refreshed_at timestamptz default null,
    p_secret_metadata jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = private, public, vault
as $$
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

create or replace function private.get_connected_account_tokens(
    p_connected_account_id uuid,
    p_user_id uuid
)
returns table (
    id uuid,
    connected_account_id uuid,
    user_id uuid,
    provider text,
    access_token text,
    refresh_token text,
    token_type text,
    scopes jsonb,
    provider_user_id text,
    expires_at timestamptz,
    refresh_expires_at timestamptz,
    last_refreshed_at timestamptz,
    secret_metadata jsonb,
    created_at timestamptz,
    updated_at timestamptz
)
language sql
security definer
set search_path = private, public, vault
as $$
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

create or replace function private.cleanup_connected_account_token_secrets()
returns trigger
language plpgsql
security definer
set search_path = private, public, vault
as $$
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

drop trigger if exists cleanup_connected_account_token_secrets
  on private.connected_account_tokens;
create trigger cleanup_connected_account_token_secrets
before delete on private.connected_account_tokens
for each row
execute function private.cleanup_connected_account_token_secrets();

revoke all on function private.upsert_connected_account_tokens(
  uuid, uuid, text, text, text, text, jsonb, text, timestamptz, timestamptz, timestamptz, jsonb
) from public, anon, authenticated;
revoke all on function private.get_connected_account_tokens(uuid, uuid)
  from public, anon, authenticated;
revoke all on function private.cleanup_connected_account_token_secrets()
  from public, anon, authenticated;
grant execute on function private.upsert_connected_account_tokens(
  uuid, uuid, text, text, text, text, jsonb, text, timestamptz, timestamptz, timestamptz, jsonb
) to service_role;
grant execute on function private.get_connected_account_tokens(uuid, uuid)
  to service_role;

commit;
