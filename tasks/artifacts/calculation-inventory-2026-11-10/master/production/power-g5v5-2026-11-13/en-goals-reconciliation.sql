set statement_timeout='8s';
with en as (
  select e.game_id, e.game_date, e.event_owner_team_id as scorer_id
  from nhl_api_pbp_events e
  where e.type_desc_key='goal' and e.season_id=20262027
    and e.game_date between '2026-10-01' and '2026-11-12'
    and e.goalie_in_net_id is null and coalesce(e.period_type,'')<>'SO'
), tg as (
  select distinct en.game_id, en.game_date,
    case when g."homeTeamId"=en.scorer_id then g."awayTeamId" else g."homeTeamId" end as conceding_id,
    case when g."homeTeamId"=en.scorer_id then 'away' else 'home' end as conceding_side
  from en join games g on g.id=en.game_id
), goals as (
  select tg.game_id, tg.game_date, tg.conceding_id, tg.conceding_side,
    count(*) filter (where p.event_owner_team_id<>tg.conceding_id) as pbp_ga,
    count(*) filter (where p.event_owner_team_id<>tg.conceding_id and p.goalie_in_net_id is null) as pbp_en_ga,
    count(*) filter (where p.event_owner_team_id<>tg.conceding_id and p.situation_code='1551') as pbp_5v5_ga
  from tg join nhl_api_pbp_events p on p.game_id=tg.game_id and p.type_desc_key='goal' and coalesce(p.period_type,'')<>'SO'
  group by 1,2,3,4
)
select gl.game_date, t.abbreviation team, gl.pbp_ga, gl.pbp_en_ga, gl.pbp_5v5_ga,
  a.ga as nst_all_ga, s.ga as nst_5v5_ga, s.sa as nst_5v5_sa, round(s.xga::numeric,2) as nst_5v5_xga, s.toi_seconds as nst_5v5_toi_s, s.gp as nst_5v5_gp, s.situation as sit
from goals gl join teams t on t.id=gl.conceding_id
left join nst_team_gamelogs_as_counts a on a.team_abbreviation=t.abbreviation and a.date=gl.game_date
left join nst_team_gamelogs_es_counts s on s.team_abbreviation=t.abbreviation and s.date=gl.game_date
order by gl.game_date desc, team;
