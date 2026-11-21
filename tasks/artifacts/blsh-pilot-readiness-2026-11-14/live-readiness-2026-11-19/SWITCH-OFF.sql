-- Emergency fallback when DISARM-ROLLBACK.sql cannot commit (for example the permit was never installed,
-- or was partly removed): DISARM's DROP statements then fail and roll back its own switch-off.
-- This file only clears the raw native switch and reads raw and effective state back. No DDL, no cron.job access.
\set ON_ERROR_STOP on
begin;
set local lock_timeout = '5s';
set local statement_timeout = '15s';
update public.blsh_capture_control set enabled = false, updated_at = pg_catalog.clock_timestamp() where singleton;
do $off$
begin
  if not exists (select 1 from public.blsh_capture_control where singleton and not enabled)
     or public.blsh_capture_enabled_v1() is distinct from false then
    raise exception 'switch_off_readback_failed';
  end if;
end $off$;
commit;
