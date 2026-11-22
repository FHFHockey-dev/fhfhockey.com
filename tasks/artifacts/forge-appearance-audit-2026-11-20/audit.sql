-- Disposable audit DB. A missing canonical event cannot be installed as a reader foreign key.
-- Independently proven season and team can still be repaired on that appearance.
drop table if exists audit.plan;
drop table if exists audit.rows;
create table audit.rows as
with ranked as (
 select r.player_id,r.game_date,r.strength_state,r.game_id,r.season,r.team_id,r.audit_xmin,
  row_number() over(partition by r.player_id,r.strength_state order by r.game_date desc) as recent_rank,
  max(r.game_date) filter(where r.strength_state in ('ev','pp') and r.game_date < date '2026-11-20') over(partition by r.player_id) as newest_ev_pp
 from rolling_player_game_metrics r
), eligible as (
 select r.*,case when r.game_date<date '2026-11-20' and r.strength_state in ('ev','pp','all','pk') and r.game_date>date '2026-11-20'-365 then 'lineup365'
 when r.game_date<date '2026-11-20' and r.strength_state in ('ev','pp','all') and r.game_date>date '2026-11-20'-1095 and
 (r.newest_ev_pp is null or r.newest_ev_pp<=date '2026-11-20'-365) then 'absence1095' else 'outside' end as window_scope,
 case when r.strength_state not in ('ev','pp','all','pk') then 'unused_strength'
 when r.game_date>=date '2026-11-20' then 'at_or_after_cutoff'
 when r.game_date>date '2026-11-20'-365 then '365d'
 when r.game_date>date '2026-11-20'-1095 then 'extended_date_band' else 'older' end as date_band
 from ranked r
)
select r.*, coalesce(e.status,'missing_participation_spine') status,e.event_id as source_game,e.event_season as source_season,
 case when e.status='resolved' then e.event_team when e.status='canonical_game_missing' and e.source is not null and e.candidates=1
  and e.event_season=se.id and e.date between se."startDate" and se."endDate" and e.team_count<=1
  then coalesce(bt.id,ut.id) end source_team, coalesce(e.source,'wgo_skater_stats') as support_source,
 case when e.status='resolved' then e.event_id else r.game_id end as new_game,
 case when e.status='resolved' or (e.status='canonical_game_missing' and e.source is not null and e.candidates=1 and e.box_season=se.id and e.date between se."startDate" and se."endDate")
  then e.event_season else r.season end as new_season,
 e.box_abbrev,e.event_side,e.game_id as wgo_game,e.season_id as wgo_season,e.team_abbrev as wgo_team,e.toi_per_game as wgo_toi,
 exists(select 1 from rosters ro where ro."playerId"=r.player_id and ro."seasonId"=20262027 and ro.is_current) as current_member
from eligible r left join audit.event e on (e.player_id,e.date)=(r.player_id,r.game_date)
left join seasons se on se.id=e.event_season
left join teams bt on bt.id=e.box_team and bt.abbreviation=e.abbrev
left join (select abbreviation,min(id) id from teams group by 1 having count(*)=1) ut on ut.abbreviation=e.abbrev and e.box_team is null;
create table audit.plan as
select player_id,game_date,strength_state,game_id,season,team_id,audit_xmin,new_game,new_season,coalesce(source_team,team_id) as new_team,
 concat_ws('+',case when game_id is distinct from new_game then case when game_id is null then 'missing_game' else 'wrong_game' end end,
 case when season is distinct from new_season then case when season is null then 'missing_season' else 'wrong_season' end end,
 case when source_team is not null and team_id is distinct from source_team then case when team_id is null then 'missing_team' else 'wrong_team' end end) as defects,
 window_scope,date_band,recent_rank=1 as latest,current_member,status,source_game,source_season,source_team,support_source,event_side,wgo_game,wgo_season,wgo_team,wgo_toi
from audit.rows
where (game_id,season,team_id) is distinct from (new_game,new_season,coalesce(source_team,team_id));
alter table audit.plan add primary key(player_id,game_date,strength_state);
analyze audit.plan;
