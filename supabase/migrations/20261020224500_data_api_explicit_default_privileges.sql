-- D4: stop auto-granting future objects to the Data API roles.
--
-- From 2026-10-30 Supabase stops granting anon, authenticated and service_role on
-- new public objects (https://github.com/orgs/supabase/discussions/45329). The
-- canonical baseline (20260716112908, the ALTER DEFAULT PRIVILEGES block at its end)
-- re-creates the old posture on every replay: ALL on tables, sequences and functions
-- for all three roles. Applied history is left as it is; this migration supersedes those
-- defaults from here on, so a replay and the hosted project converge on the platform's
-- new posture.
--
-- Default privileges only shape objects created later by postgres (the migration role).
-- Existing objects keep their ACLs; 20261020224600 reconciles the reviewed set. Every
-- object created after this migration needs its own explicit GRANT next to its RLS and
-- policies, for service_role too. Identity columns still insert without a sequence
-- grant; serial/nextval defaults need USAGE on their sequence.
--
-- PostgreSQL also gives PUBLIC EXECUTE on every new function. A schema-scoped default
-- cannot remove that built-in, so the last statement revokes it globally for postgres:
-- new postgres functions in every schema are executable only by their owner and the
-- roles granted explicitly. Trigger functions and SECURITY DEFINER callers owned by
-- postgres are unaffected.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke all on functions from anon, authenticated, service_role;

alter default privileges for role postgres
  revoke execute on functions from public;

commit;
