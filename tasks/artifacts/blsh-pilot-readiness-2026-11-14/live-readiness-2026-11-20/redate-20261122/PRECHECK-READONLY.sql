-- Read-only pre-check for forward migration 20261120143000_blsh_official_pilot_redate_20261121.sql.
-- For the DB owner on fyhftlxokyjtpndbkfse, before any apply approval. It runs in a READ ONLY transaction and rolls back.
-- Prints one line: verdict|source_date_check|claim_def_sha256|official_runs.
-- Expected today: ready_to_apply|CHECK ((source_date = '2026-11-20'::date))|5893416fdcb334659cefb8e6873da4b88426f91bfda92bcf1b81cfbb86fba2c1|0
-- After a successful apply: already_redated|CHECK ((source_date = '2026-11-21'::date))|4efee291f95cab0c761c3b88e423131a2d13d87956daf593fbcc9be05bf61f4d|0
-- Anything else: stop and report; do not apply.
\set ON_ERROR_STOP on
begin transaction read only;
with s as (
  select
    (select pg_catalog.pg_get_constraintdef(oid) from pg_catalog.pg_constraint
      where conrelid = 'public.blsh_official_runs'::regclass and conname = 'blsh_official_runs_source_date_check') as source_date_check,
    pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(pg_catalog.pg_get_functiondef(
      'public.blsh_official_claim_v1(date,uuid,text,text,text,text,integer[])'::regprocedure), 'UTF8')), 'hex') as claim_def_sha256,
    (select count(*) from public.blsh_official_runs) as official_runs)
select case
    when official_runs <> 0 then 'stop_official_runs_exist'
    when source_date_check = 'CHECK ((source_date = ''2026-11-20''::date))'
     and claim_def_sha256 = '5893416fdcb334659cefb8e6873da4b88426f91bfda92bcf1b81cfbb86fba2c1' then 'ready_to_apply'
    when source_date_check = 'CHECK ((source_date = ''2026-11-21''::date))'
     and claim_def_sha256 = '4efee291f95cab0c761c3b88e423131a2d13d87956daf593fbcc9be05bf61f4d' then 'already_redated'
    else 'stop_definition_mismatch' end
  || '|' || source_date_check || '|' || claim_def_sha256 || '|' || official_runs
from s;
rollback;
