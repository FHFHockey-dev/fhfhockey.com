-- Rollback for 20261113160000_team_ctpi_daily_v2_publication.sql: drops the v1 freeze trigger and its function,
-- restores the (season_id, team, date) primary key and drops ctpi_version (its CHECK goes with it).
-- Refuses, and changes nothing, while any v2 row is stored: those rows share (season_id, team, date) with v1 rows,
-- so the old key cannot hold both, and dropping them would lose issued v2 history.
-- The five component columns stay nullable: order 56 (20260828142331) made the same change and its production
-- state is unknown, so restoring NOT NULL here could undo it.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $$
begin
  if exists (select 1 from public.team_ctpi_daily where ctpi_version <> 1) then
    raise exception using errcode = '55000',
      message = 'F1_ROLLBACK_REFUSED: CTPI v2 rows are stored; the (season_id, team, date) key cannot hold them beside v1';
  end if;
end
$$;

drop trigger team_ctpi_daily_v1_frozen on public.team_ctpi_daily;
drop function fhfh_internal.reject_ctpi_v1_write();

alter table public.team_ctpi_daily
  drop constraint team_ctpi_daily_pkey;

alter table public.team_ctpi_daily
  add constraint team_ctpi_daily_pkey primary key (season_id, team, date);

alter table public.team_ctpi_daily
  drop column ctpi_version;

commit;
