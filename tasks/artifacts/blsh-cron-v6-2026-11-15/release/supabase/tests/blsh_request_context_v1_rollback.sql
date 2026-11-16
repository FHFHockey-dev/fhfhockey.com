-- Rollback for 20261116000100_blsh_request_context_v1.sql. Drops exactly what it added: one function.
-- No data is stored by it. Afterwards, delete the ledger row:
--   delete from supabase_migrations.schema_migrations where version = '20261116000100';
-- Idempotent: a second run changes nothing. Roll this back before 20261116000000 when undoing both.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
drop function if exists public.blsh_request_context_v1(date, date);
commit;
