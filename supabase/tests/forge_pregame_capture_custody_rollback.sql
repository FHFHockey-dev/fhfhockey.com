-- Rollback for 20261115000000_forge_pregame_capture_custody.sql. Drops exactly what it added.
-- Retained capture evidence is destroyed by this rollback: export it first if any rows exist.
begin;
drop function if exists public.forge_pregame_capture_sweep_v1(integer, integer);
drop function if exists public.forge_pregame_capture_record_outcome_v1(bigint, text, uuid, text, jsonb);
drop function if exists public.forge_pregame_capture_record_witness_v1(uuid, text, text, timestamptz, bigint, text, text, timestamptz, timestamptz, text, text);
drop function if exists public.forge_pregame_capture_lookup_v1(bigint, text);
drop function if exists public.forge_pregame_capture_read_v1(uuid);
drop function if exists public.forge_pregame_capture_settle_v1(uuid);
drop function if exists public.forge_pregame_capture_save_v1(uuid, text, text, text);
drop function if exists public.forge_pregame_capture_claim_v1(bigint, text, date, smallint, smallint, text, timestamptz, integer, text);
drop schema if exists forge_pregame_capture cascade;
commit;
