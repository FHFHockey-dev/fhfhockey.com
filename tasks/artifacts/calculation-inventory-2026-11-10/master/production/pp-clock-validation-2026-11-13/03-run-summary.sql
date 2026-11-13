-- Runs 03-classify-teamgamestats.sql then prints the season x type x class summary and exports rows.
\set QUIET on
\ir 03-classify-teamgamestats.sql
\pset footer off
select season_id, game_type, class, count(*) as team_games,
       count(*) filter (where class = 'zero_unverified' and coalesce(opp_pim,0) = 0) as opp_pim_zero
from f11_classes group by 1,2,3 order by 1 desc, 2, 3;
\copy (select game_id, season_id, game_type, team_id, opp_id, is_home, toi, pp, toi_s, pp_goals, pp_opps, own_pim, opp_pim, class from f11_classes where season_id >= 20252026 order by game_id, is_home desc) to 'OUT_CLASSES' with csv header
