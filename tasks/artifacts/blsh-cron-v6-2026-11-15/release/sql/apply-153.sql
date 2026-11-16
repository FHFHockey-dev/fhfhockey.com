-- Migration 153 apply: ONE transaction. psql -X -v body=<path to the extracted body, lines 15-268> -f apply-153.sql
-- The file's own begin (line 14) and commit (line 269) are replaced by this wrapper, so the ledger insert commits with it.
\set ON_ERROR_STOP on
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
\i :body
insert into supabase_migrations.schema_migrations (version, name) values ('20261116000000', 'blsh_native_capture_v6');
notify pgrst, 'reload schema';
select 'applied_at', clock_timestamp();
commit;
