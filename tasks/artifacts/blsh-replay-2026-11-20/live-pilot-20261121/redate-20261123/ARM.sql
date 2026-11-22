-- Separate operator authorization. Supply the same independently reviewed psql pins as INSTALL.sql.
\set ON_ERROR_STOP on
begin;
set local lock_timeout = '5s';
set local statement_timeout = '15s';
lock table public.blsh_capture_control, public.blsh_capture_runs in share row exclusive mode;

do $$
begin
  if not exists (select 1 from public.blsh_capture_control where singleton and not enabled)
     or exists (select 1 from public.blsh_capture_runs where pipeline = 'native-v6' and source_date = date '2026-11-22')
     or not exists (select 1 from pg_catalog.pg_trigger
                    where tgrelid = 'public.blsh_capture_runs'::regclass and tgname = 'blsh_pilot_claim_20261123'
                      and tgfoid = pg_catalog.to_regprocedure('public.blsh_pilot_claim_20261123()') and tgenabled = 'O') then
    raise exception 'pilot_not_armable';
  end if;
end $$;
update public.blsh_capture_control c set enabled = true, updated_at = pg_catalog.clock_timestamp()
from public.blsh_pilot_20261123 p
where c.singleton and p.singleton and p.release_sha = :'release_sha' and p.deployment_id = :'deployment_id'
  and pg_catalog.clock_timestamp() < timestamptz '2026-11-23 12:05:00+00';
do $$
begin
  if not exists (select 1 from public.blsh_capture_control where singleton and enabled)
     or public.blsh_capture_enabled_v1() is distinct from false then
    raise exception 'pilot_arm_pins_or_time_mismatch';
  end if;
end $$;
commit;
