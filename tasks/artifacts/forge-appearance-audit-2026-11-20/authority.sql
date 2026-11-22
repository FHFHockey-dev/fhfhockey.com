-- Local tables only. Identity is an event-level fact shared by the strength rows.
drop table if exists audit.event cascade;
create table audit.event as
with official as (
 select b.player_id,b.game_date,count(distinct (b.game_id,b.season,b.team_abbrev,b.side)) as candidates,
 min(b.game_id) as game_id,min(b.season) as season,min(b.team_abbrev) as abbrev,min(b.side) as side,
 min(b.team_id) as box_team, count(distinct b.team_id) as team_count,min(b.toi_seconds) as min_toi,
 string_agg(distinct b.source,',' order by b.source) as source
 from audit.nhl b join wgo w on (b.player_id,b.game_date)=(w.player_id,w.date)
 where b.toi_seconds>0 group by 1,2
), candidates as (
 select w.*,o.candidates,o.game_id as box_id,o.season as box_season,o.abbrev as box_abbrev,o.side,o.box_team,
 o.team_count,o.min_toi,o.source,coalesce(o.game_id,w.game_id) as event_id,coalesce(o.season,w.season_id) as event_season,
 coalesce(o.abbrev,w.team_abbrev) as abbrev,coalesce(o.side,case w.home_road when 'H' then 'home' when 'R' then 'away' end) as event_side
 from wgo w left join official o on (o.player_id,o.game_date)=(w.player_id,w.date)
)
select q.*,g.id as canonical_id,g."seasonId" as canonical_season,case event_side when 'home' then g."homeTeamId" when 'away' then g."awayTeamId" end as event_team,
 case when p.id is null then 'missing_player'
 when q.games_played is distinct from 1 or not coalesce(q.toi_per_game>0,false) then 'participation_unconfirmed'
 when candidates>1 or team_count>1 then 'conflicting_official_appearances'
 when q.game_id is not null and q.box_id is not null and q.game_id<>q.box_id then 'conflicting_wgo_and_nhl_game'
 when g.id is null then case when event_id is null then 'need_nhl_participation' else 'canonical_game_missing' end
 when g.date is distinct from q.date or g.type not in (2,3) or g."seasonId" is distinct from event_season
   or g."seasonId" is distinct from ((event_id/1000000)::int*10000+(event_id/1000000)::int+1)
   or g.type is distinct from ((event_id/10000)%100)::int then 'canonical_date_season_type_conflict'
 when se.id is null or q.date not between se."startDate" and se."endDate" then 'canonical_season_calendar_conflict'
 when q.event_side not in ('away','home') or ht.id is null or at.id is null or
    (case event_side when 'home' then ht.abbreviation when 'away' then at.abbreviation end) is distinct from q.abbrev
    or (q.box_team is not null and q.box_team is distinct from case event_side when 'home' then ht.id else at.id end)
    then 'canonical_team_conflict'
 when q.game_id is not null and (q.team_abbrev is distinct from q.abbrev or q.home_road is distinct from case event_side when 'home' then 'H' else 'R' end
    or q.opponent_team_abbrev is distinct from case event_side when 'home' then at.abbreviation else ht.abbreviation end)
    then 'wgo_team_or_opponent_conflict'
 else 'resolved' end as status
from candidates q left join games g on g.id=q.event_id left join seasons se on se.id=g."seasonId"
left join teams ht on ht.id=g."homeTeamId" left join teams at on at.id=g."awayTeamId" left join players p on p.id=q.player_id;
alter table audit.event add primary key(player_id,date);
analyze audit.event;
