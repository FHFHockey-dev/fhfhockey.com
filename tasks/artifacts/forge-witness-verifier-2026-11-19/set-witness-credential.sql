-- Store the verifier's Data API credential in forge_witness.credentials (owner-only; no grant to service_role or anyone)
-- and (re)enable the role for PostgREST. The token is read from STDIN by \prompt, never from argv, a file or Vault, and
-- is never printed: the output is only its role and expiry. Run as postgres, piping the freshly minted token in:
--   pbpaste | python3 -I witness_token_setup.py --hours 11 --stdout | psql "<postgres connection>" -X -q -f set-witness-credential.sql
-- (With -f, psql's \prompt reads standard input.) Mint a new one before it expires; re-running replaces the old one.
\set ON_ERROR_STOP on
\set ECHO none
\prompt witness_token
begin;
select forge_witness.set_credential_v1(:'witness_token') as credential;
grant forge_witness_api to authenticator;
commit;
\unset witness_token
