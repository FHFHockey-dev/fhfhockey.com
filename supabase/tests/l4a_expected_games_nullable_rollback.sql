-- Rollback for 20261112110000_player_forecast_season_expected_games_nullable.sql: restores NOT NULL on
-- expected_games in both tables. Refuses (and changes nothing) while any row in either table has a NULL
-- expected_games; the tables are append-only, so such rows cannot be removed and the rollback then stays refused.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $$
begin
  if exists (select 1 from public.player_forecast_season_player_aggregates where expected_games is null)
     or exists (select 1 from public.player_forecast_season_release_players where expected_games is null) then
    raise exception using errcode = '23502',
      message = 'L4A_ROLLBACK_REFUSED: NULL expected_games rows exist; NOT NULL cannot be restored';
  end if;
end
$$;

alter table public.player_forecast_season_player_aggregates alter column expected_games set not null;
alter table public.player_forecast_season_release_players alter column expected_games set not null;

commit;
