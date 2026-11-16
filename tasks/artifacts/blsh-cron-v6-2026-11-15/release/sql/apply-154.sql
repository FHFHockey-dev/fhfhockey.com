-- Migration 154 apply: ONE transaction. psql -X -v body=<path to the extracted body, lines 16-63> -f apply-154.sql
-- The file's own begin (line 15) and commit (line 64) are replaced by this wrapper, so the ledger insert commits with it.
\set ON_ERROR_STOP on
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
\i :body
insert into supabase_migrations.schema_migrations (version, name) values ('20261116000100', 'blsh_request_context_v1');
notify pgrst, 'reload schema';
select 'applied_at', clock_timestamp();
commit;
