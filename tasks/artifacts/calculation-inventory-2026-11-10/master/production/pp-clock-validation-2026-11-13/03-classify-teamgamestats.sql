-- Decision 144: classify every stored team-game PP clock (teamGameStats.powerPlayToi).
-- Scalar text columns only. One row per (game, team) with its class; a second
-- statement summarises by season x game type x class.
--   missing_row       : past game in `games` with no teamGameStats row for that team
--   malformed         : powerPlayToi or powerPlay not parseable, goals > opps, or clock > game length
--   placeholder_00    : "00:00" while the team had >=1 PP opportunity (failed-fetch default)
--   zero_unverified   : "00:00" and "0/0" (no PP or a double default; needs PBP to verify)
--   zero_opp_nonzero  : PP time > 0 but 0 opportunities (inconsistent source row)
--   nonzero           : PP time > 0 with >=1 opportunity
set statement_timeout = '10s';
drop table if exists pg_temp.f11_classes;
create temp table f11_classes as
with g as (
  select id as game_id, "seasonId" as season_id, type as game_type, "homeTeamId" as home, "awayTeamId" as away
  from games where date < current_date and type in (1,2,3)
), sides as (
  select game_id, season_id, game_type, home as team_id, away as opp_id, true as is_home from g
  union all
  select game_id, season_id, game_type, away, home, false from g
), joined as (
  select s.*, t."powerPlayToi" as toi, t."powerPlay" as pp, t.pim as own_pim, o.pim as opp_pim,
         (t."gameId" is not null) as has_row
  from sides s
  left join "teamGameStats" t on t."gameId" = s.game_id and t."teamId" = s.team_id
  left join "teamGameStats" o on o."gameId" = s.game_id and o."teamId" = s.opp_id
), parsed as (
  select *,
    case when toi ~ '^\d{1,3}:[0-5]\d$' then split_part(toi, ':', 1)::int * 60 + split_part(toi, ':', 2)::int end as toi_s,
    case when pp ~ '^\d+/\d+$' then split_part(pp, '/', 1)::int end as pp_goals,
    case when pp ~ '^\d+/\d+$' then split_part(pp, '/', 2)::int end as pp_opps
  from joined
)
select *,
  case
    when not has_row then 'missing_row'
    when toi_s is null or pp_opps is null or pp_goals > pp_opps or toi_s > 4800 then 'malformed'
    when toi_s = 0 and pp_opps > 0 then 'placeholder_00'
    when toi_s = 0 and pp_opps = 0 then 'zero_unverified'
    when toi_s > 0 and pp_opps = 0 then 'zero_opp_nonzero'
    else 'nonzero'
  end as class
from parsed;
