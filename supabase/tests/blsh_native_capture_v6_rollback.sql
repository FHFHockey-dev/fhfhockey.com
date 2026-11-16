-- Rollback for 20261116000000_blsh_native_capture_v6.sql. Drops exactly what it added, except the
-- empty private bucket: Supabase refuses direct SQL deletes on storage tables, and an empty bucket
-- with the same settings passes the migration's own bucket check if it is re-applied.
-- Destroys the run ledger and the object index (the integrity record). Export both first if any rows exist.
-- Refuses while any packet bytes remain in blsh-native-packets: delete them through the Storage API first.
-- Afterwards, delete the ledger row: delete from supabase_migrations.schema_migrations where version = '20261116000000';
-- Idempotent: every drop is "if exists"; a second run changes nothing.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
do $$
begin
  if exists (select 1 from storage.objects as s where s.bucket_id = 'blsh-native-packets') then
    raise exception 'blsh-native-packets still holds objects: delete them through the Storage API first';
  end if;
end $$;
drop function if exists public.blsh_capture_mark_pruned_v1(uuid);
drop function if exists public.blsh_capture_retention_v1(date);
drop function if exists public.blsh_capture_keep_v1(uuid);
drop function if exists public.blsh_capture_watchdog_assert_v1(date);
drop function if exists public.blsh_capture_watchdog_v1();
drop function if exists public.blsh_capture_close_v1(uuid, text, text, text);
drop function if exists public.blsh_capture_object_v1(uuid, integer, text, text, integer);
drop function if exists public.blsh_capture_intent_v1(uuid, text, text[]);
drop function if exists public.blsh_capture_claim_v1(text, date, jsonb);
drop function if exists public.blsh_capture_enabled_v1();
drop table if exists public.blsh_capture_objects;
drop table if exists public.blsh_capture_runs;
drop table if exists public.blsh_capture_control;
drop function if exists public.blsh_capture_guard_v1();
commit;
