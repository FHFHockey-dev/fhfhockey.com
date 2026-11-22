-- PROPOSAL ONLY (managed-signer lane, 2026-11-22), OPTION V1b. One-time operator setup, under its own TJ line.
-- A postgres-owned private table for the two Ed25519 signing keys and the trigger bearer. It is NOT Vault: Supabase's Vault
-- grants SELECT on vault.decrypted_secrets to service_role (the Vercel app's key) by default, and those grants come from
-- supabase_admin, so the project's postgres role cannot remove them (proved locally in proof/out/proof-log.txt). Here postgres
-- owns the table and its grants. Plaintext at rest inside the database; readable by postgres and anything that runs SQL as it.
\set ON_ERROR_STOP on
begin;
set local lock_timeout = '5s';
create table fhfh_internal.blsh_signer_secrets (
  name text primary key check (name ~ '^blsh_signer_(trigger_secret|rc_key_\d{8}|official_key_\d{8})$'),
  secret text not null check (length(secret) between 32 and 256),
  created_at timestamptz not null default pg_catalog.clock_timestamp()
);
revoke all on fhfh_internal.blsh_signer_secrets from public, anon, authenticated, service_role;
do $check$
begin
  if exists (select 1 from (values ('service_role'), ('anon'), ('authenticated')) r(role)
             where pg_catalog.has_table_privilege(r.role, 'fhfh_internal.blsh_signer_secrets', 'select,insert,update,delete')) then
    raise exception 'signer_secrets_client_access';
  end if;
end $check$;
commit;
