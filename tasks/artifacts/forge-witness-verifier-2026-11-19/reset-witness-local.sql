-- LOCAL / DISPOSABLE DATABASES ONLY. Removes the witness verifier completely (receipts included) so a rehearsal can
-- rerun the same inputs. Never run on production: production receipts are immutable evidence. Run as a superuser.
\set ON_ERROR_STOP on
begin;
do $$ begin
  if not (select rolsuper from pg_catalog.pg_roles where rolname = current_user) then
    raise exception 'reset-witness-local.sql needs a superuser on a disposable database'; end if;
end $$;
select cron.unschedule(jobid) from cron.job where jobname like 'forge-witness-verify-%';
drop schema if exists forge_witness_ops cascade;
drop schema if exists forge_witness_api cascade;
drop schema if exists forge_witness cascade;
do $$ begin
  if exists (select from pg_catalog.pg_roles where rolname = 'forge_witness_owner') then
    revoke all on schema forge_pregame_capture from forge_witness_owner;
    revoke all on all tables in schema forge_pregame_capture from forge_witness_owner;
    drop owned by forge_witness_owner;
    drop role forge_witness_owner;
  end if;
  if exists (select from pg_catalog.pg_roles where rolname = 'forge_witness_api') then
    drop owned by forge_witness_api;
    drop role forge_witness_api;
  end if;
end $$;
commit;
notify pgrst, 'reload schema';
