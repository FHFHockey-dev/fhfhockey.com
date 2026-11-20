-- Retire the installed permit in one transaction. This preserves every run and object.
\set ON_ERROR_STOP on
begin;
set local lock_timeout = '5s';
set local statement_timeout = '15s';
lock table public.blsh_capture_control, public.blsh_capture_runs in share row exclusive mode;
update public.blsh_capture_control set enabled = false, updated_at = pg_catalog.clock_timestamp() where singleton;

-- Restore the reviewed migration 153 function only after clearing its raw singleton.
create or replace function public.blsh_capture_enabled_v1() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select c.enabled from public.blsh_capture_control as c where c.singleton), false)
$$;
do $$
begin
  if not exists (select 1 from public.blsh_capture_control where singleton and not enabled)
     or public.blsh_capture_enabled_v1() is distinct from false then
    raise exception 'pilot_rollback_requires_switch_off';
  end if;
end $$;
drop trigger blsh_pilot_claim_20261122 on public.blsh_capture_runs;
drop function public.blsh_pilot_claim_20261122();
drop table public.blsh_pilot_20261122;
commit;
