set statement_timeout='8s';
with en as (
  select e.game_id, e.event_owner_team_id as scorer_id, e.situation_code
  from nhl_api_pbp_events e
  where e.type_desc_key='goal' and e.season_id=20262027
    and e.game_date between '2026-10-01' and '2026-11-12'
    and e.goalie_in_net_id is null and coalesce(e.period_type,'')<>'SO'
), tg as (
  select distinct en.game_id, g.date as game_date,
    case when g."homeTeamId"=en.scorer_id then g."awayTeamId" else g."homeTeamId" end as conceding_id,
    bool_or(en.situation_code='0551' or en.situation_code='1550') over (partition by en.game_id) as has_5v5_skater_en
  from en join games g on g.id=en.game_id
), sa as (
  select tg.game_id, tg.game_date, tg.conceding_id, tg.has_5v5_skater_en,
    count(*) filter (where p.event_owner_team_id<>tg.conceding_id and p.situation_code='1551') as pbp_5v5_sa
  from tg join nhl_api_pbp_events p on p.game_id=tg.game_id and p.type_desc_key in ('shot-on-goal','goal') and coalesce(p.period_type,'')<>'SO'
  group by 1,2,3,4
)
select x.game_date, t.abbreviation team, x.has_5v5_skater_en, x.pbp_5v5_sa, s.sa nst_5v5_sa,
  s.toi_seconds s5_toi, a.toi_seconds all_toi,
  round(r.xga_per_60::numeric,3) rate_xga60, round((s.xga*3600.0/nullif(s.toi_seconds,0))::numeric,3) calc_xga60,
  round(r.ga_per_60::numeric,3) rate_ga60, round((s.ga*3600.0/nullif(s.toi_seconds,0))::numeric,3) calc_ga60,
  r.toi_seconds rate_toi
from sa x join teams t on t.id=x.conceding_id
left join nst_team_gamelogs_es_counts s on s.team_abbreviation=t.abbreviation and s.date=x.game_date
left join nst_team_gamelogs_es_rates r on r.team_abbreviation=t.abbreviation and r.date=x.game_date
left join nst_team_gamelogs_as_counts a on a.team_abbreviation=t.abbreviation and a.date=x.game_date
order by x.game_date desc, team;
