-- Rollback for 20261113170000_team_sos_daily_v2.sql: drops the sos_standings v1 freeze trigger and its function,
-- then drops public.team_sos_daily.
-- Refuses, and changes nothing, while any v2 row is stored: dropping the table would lose issued v2 history.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $$
begin
  if exists (select 1 from public.team_sos_daily) then
    raise exception using errcode = '55000',
      message = 'F2_ROLLBACK_REFUSED: descriptive-sos-v2 rows are stored in team_sos_daily; keep them as issued history';
  end if;
end
$$;

drop trigger sos_standings_v1_frozen on public.sos_standings;
drop function fhfh_internal.reject_sos_v1_write();
drop table public.team_sos_daily;

commit;
