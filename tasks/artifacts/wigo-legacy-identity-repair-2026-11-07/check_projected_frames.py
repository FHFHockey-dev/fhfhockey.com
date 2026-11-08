"""Prepare a read-only simulation of the unchanged WiGO last-20 guard."""
import json
from pathlib import Path
p=Path(__file__).resolve().parent
plan=json.loads((p/'source-plan.json').read_text())
values=','.join(f"({r['id']},{r['player_id']},{r['game_id']},{r['season_id']})" for r in plan['repairs'])
query=f"""with proposed(id,player_id,game_id,season_id) as (values {values}),
players as (select distinct player_id from proposed),
frames as (select w.* from players p cross join lateral (select w.id,w.player_id,w.date,w.game_id,w.season_id,w.games_played from public.wgo_skater_stats w where w.player_id=p.player_id and w.games_played=1 order by w.date desc,w.game_id desc limit 20) w),
projected as (select f.id,f.player_id,f.date,coalesce(p.game_id,f.game_id) as game_id,coalesce(p.season_id,f.season_id) as season_id,f.games_played from frames f left join proposed p using(id)),
violations as (select *, (game_id is null or season_id is null or game_id::text !~ ('^' || (season_id/10000)::text || '02[0-9]{{4}}$') or season_id<>(season_id/10000)*10000+(season_id/10000)+1 or games_played<>1) as invalid from projected)
select jsonb_build_object('players',(select count(*) from players),'frame_rows',(select count(*) from frames),'invalid_identity_rows',(select count(*) from violations where invalid),'duplicate_player_games',(select count(*) from (select player_id,game_id from projected group by player_id,game_id having count(*)>1) d),'planned_rows_outside_current_frames',(select count(*) from proposed p left join frames f using(id) where f.id is null)) as projected_guard;
"""
(p/'projected-frames.sql').write_text(query)
