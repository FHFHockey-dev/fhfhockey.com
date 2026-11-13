-- Decision 152 Part B (F11): read cost of computing the PP numerator on demand,
-- against today's stored read. Bounded, read-only; scalar columns only. Run
-- after hygiene.sh with:
--   psql -v game=2026020192 -v team=2 -v player=8477500 -v games=2026020008,...,2026020308 -f 17-cost-probe.sql
-- `games` is that team's 2026-27 regular-season games (one player season or
-- one team season). EXPLAIN ANALYZE runs each query once.
set statement_timeout = '10s';
\timing on

-- Inputs for one team-game: the play-by-play (clock), the official row
-- (qualification) and the team's shifts.
explain (analyze, buffers, costs off, summary on)
select event_id, sort_order, period_number, period_type, time_in_period, time_remaining, situation_code,
       type_desc_key, event_owner_team_id, penalty_type_code, penalty_desc_key, penalty_duration_minutes,
       committed_by_player_id, served_by_player_id
from nhl_api_pbp_events where game_id = :game order by sort_order, event_id;
explain (analyze, buffers, costs off, summary on)
select "gameId", "teamId", "powerPlayToi", "powerPlay" from "teamGameStats" where "gameId" = :game;
explain (analyze, buffers, costs off, summary on)
select player_id, period, start_seconds, end_seconds from nhl_api_shift_rows
where game_id = :game and team_id = :team and type_code = 517;

-- One player season: that player's shifts, plus play-by-play and official
-- rows for every game they played.
explain (analyze, buffers, costs off, summary on)
select game_id, period, start_seconds, end_seconds from nhl_api_shift_rows
where player_id = :player and game_id in (:games) and type_code = 517;
explain (analyze, buffers, costs off, summary on)
select game_id, event_id, sort_order, period_number, period_type, time_in_period, time_remaining, situation_code,
       type_desc_key, event_owner_team_id, penalty_type_code, penalty_desc_key, penalty_duration_minutes,
       committed_by_player_id, served_by_player_id
from nhl_api_pbp_events where game_id in (:games) order by game_id, sort_order, event_id;
-- One team season: every shift of the team in those games.
explain (analyze, buffers, costs off, summary on)
select game_id, player_id, period, start_seconds, end_seconds from nhl_api_shift_rows
where game_id in (:games) and team_id = :team and type_code = 517;

-- Today's stored reads for the same scopes.
explain (analyze, buffers, costs off, summary on)
select "gameId", "playerId", unit, "PPTOI", pp_share_of_team from "powerPlayCombinations" where "gameId" = :game;
explain (analyze, buffers, costs off, summary on)
select "gameId", unit, "PPTOI", pp_share_of_team from "powerPlayCombinations" where "playerId" = :player and "gameId" in (:games);
explain (analyze, buffers, costs off, summary on)
select "gameId", unit, "PPTOI", pp_share_of_team from "powerPlayCombinations" where "playerId" = :player;

-- Rows and bytes of the selected columns.
select 'pbp one game' as scope, count(*) as rows,
       sum(pg_column_size(event_id) + pg_column_size(sort_order) + pg_column_size(period_number) + pg_column_size(period_type)
         + pg_column_size(time_in_period) + pg_column_size(time_remaining) + pg_column_size(situation_code)
         + pg_column_size(type_desc_key) + coalesce(pg_column_size(event_owner_team_id), 0) + coalesce(pg_column_size(penalty_type_code), 0)
         + coalesce(pg_column_size(penalty_desc_key), 0) + coalesce(pg_column_size(penalty_duration_minutes), 0)
         + coalesce(pg_column_size(committed_by_player_id), 0) + coalesce(pg_column_size(served_by_player_id), 0)) as bytes
from nhl_api_pbp_events where game_id = :game
union all
select 'pbp team season', count(*),
       sum(pg_column_size(event_id) + pg_column_size(sort_order) + pg_column_size(period_number) + pg_column_size(period_type)
         + pg_column_size(time_in_period) + pg_column_size(time_remaining) + pg_column_size(situation_code)
         + pg_column_size(type_desc_key) + coalesce(pg_column_size(event_owner_team_id), 0) + coalesce(pg_column_size(penalty_type_code), 0)
         + coalesce(pg_column_size(penalty_desc_key), 0) + coalesce(pg_column_size(penalty_duration_minutes), 0)
         + coalesce(pg_column_size(committed_by_player_id), 0) + coalesce(pg_column_size(served_by_player_id), 0))
from nhl_api_pbp_events where game_id in (:games)
union all
select 'shifts one team-game', count(*), sum(pg_column_size(player_id) + pg_column_size(period) + pg_column_size(start_seconds) + pg_column_size(end_seconds))
from nhl_api_shift_rows where game_id = :game and team_id = :team and type_code = 517
union all
select 'shifts one player season', count(*), sum(pg_column_size(game_id) + pg_column_size(period) + pg_column_size(start_seconds) + pg_column_size(end_seconds))
from nhl_api_shift_rows where player_id = :player and game_id in (:games) and type_code = 517
union all
select 'shifts team season', count(*), sum(pg_column_size(game_id) + pg_column_size(player_id) + pg_column_size(period) + pg_column_size(start_seconds) + pg_column_size(end_seconds))
from nhl_api_shift_rows where game_id in (:games) and team_id = :team and type_code = 517
union all
select 'stored one game', count(*), sum(pg_column_size("gameId") + pg_column_size("playerId") + pg_column_size(unit) + pg_column_size("PPTOI") + coalesce(pg_column_size(pp_share_of_team), 0))
from "powerPlayCombinations" where "gameId" = :game
union all
select 'stored player season', count(*), sum(pg_column_size("gameId") + pg_column_size(unit) + pg_column_size("PPTOI") + coalesce(pg_column_size(pp_share_of_team), 0))
from "powerPlayCombinations" where "playerId" = :player and "gameId" in (:games);
