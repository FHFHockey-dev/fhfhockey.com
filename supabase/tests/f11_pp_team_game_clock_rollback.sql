-- Rollback for 20261113220000_pp_team_game_clock.sql.
-- Revert the decision-152 writer (update-power-play-combinations/[gameId].ts) first, so nothing calls
-- replace_power_play_game_v1. This drops the function, public.pp_team_game_clock and the two provenance columns
-- on public."powerPlayCombinations". The player rows themselves stay as they are: the earlier writer reads and
-- rewrites them without the new columns.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

drop function public.replace_power_play_game_v1(bigint, text, timestamp with time zone, jsonb, jsonb);
drop table public.pp_team_game_clock;
alter table public."powerPlayCombinations"
  drop constraint "powerPlayCombinations_calculation_provenance_check",
  drop column computed_at,
  drop column calculation_version;

commit;
