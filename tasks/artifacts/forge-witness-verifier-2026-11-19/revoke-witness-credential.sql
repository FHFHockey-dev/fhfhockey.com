-- Forget the verifier credential and make every outstanding forge_witness_api token useless immediately: PostgREST can
-- no longer switch to the role once authenticator is not a member. Verdicts and targets stay. Run as postgres.
-- Re-enable later with set-witness-credential.sql (which grants the membership again).
\set ON_ERROR_STOP on
begin;
select forge_witness.revoke_credential_v1() as revoked;
revoke forge_witness_api from authenticator;
commit;
select json_build_object('credentialPresent', forge_witness.credential_v1() is not null,
  'authenticatorMayUseRole', pg_catalog.pg_has_role('authenticator', 'forge_witness_api', 'MEMBER'));
