-- Rollback for 20261113090000_player_forecast_accountability_v2_skill.sql: drops v2_skill (its CHECK goes with it).
-- Refuses, and changes nothing, while any row stores a v2_skill: those values would be lost and the table is
-- append-only, so they cannot be cleared first.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $$
begin
  if exists (select 1 from public.player_forecast_accountability_revisions where v2_skill is not null) then
    raise exception using errcode = '55000',
      message = 'L4A_ROLLBACK_REFUSED: v2_skill values are stored; dropping the column would lose them';
  end if;
end
$$;

alter table public.player_forecast_accountability_revisions drop column v2_skill;

commit;
