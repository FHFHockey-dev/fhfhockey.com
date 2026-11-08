"""Generate a read-only preflight and an unexecuted, atomic metadata-only repair."""
import hashlib
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parent
RECORD='id integer, player_id integer, date date, season_id integer, original_season_id integer, game_id bigint, team_abbrev text, opponent_team_abbrev text, home_road text, before_md5 text, preserved_md5 text'
plan=json.loads((ROOT/'source-plan.json').read_text())
assert plan['status']=='source_validated_not_executed' and plan['matched_rows']==273 and not plan['rejected']
repairs=plan['repairs']
assert len({r['id'] for r in repairs})==273
assert sum(r['season_id']!=r['original_season_id'] for r in repairs)==3
payload=json.dumps(repairs,separators=(',',':')).replace("'","''")
cte=f"with proposed as (select * from jsonb_to_recordset('{payload}'::jsonb) as p({RECORD}))"
checks="""
select jsonb_build_object(
  'proposed_rows',(select count(*) from proposed),
  'players',(select count(distinct player_id) from proposed),
  'season_corrections',(select count(*) from proposed where season_id<>original_season_id),
  'missing_rows',(select count(*) from proposed p left join public.wgo_skater_stats w using(id) where w.id is null),
  'changed_rows',(select count(*) from proposed p join public.wgo_skater_stats w using(id) where md5(to_jsonb(w)::text)<>p.before_md5),
  'conflicting_player_games',(select count(*) from proposed p join public.wgo_skater_stats w on w.player_id=p.player_id and w.game_id=p.game_id and w.id<>p.id),
  'schedule_missing',(select count(*) from proposed p left join public.games g on g.id=p.game_id where g.id is null),
  'schedule_conflicts',(select count(*) from proposed p join public.games g on g.id=p.game_id left join public.teams ht on ht.id=g.\"homeTeamId\" left join public.teams at on at.id=g.\"awayTeamId\" where g.date is distinct from p.date or g.\"seasonId\" is distinct from p.season_id or g.type is distinct from 2 or (case when p.home_road='H' then ht.abbreviation else at.abbreviation end) is distinct from p.team_abbrev or (case when p.home_road='H' then at.abbreviation else ht.abbreviation end) is distinct from p.opponent_team_abbrev),
  'noninternal_triggers',(select count(*) from pg_trigger where tgrelid='public.wgo_skater_stats'::regclass and not tgisinternal)
) as preflight;
"""
(ROOT/'preflight.sql').write_text('begin read only;\nset local statement_timeout=\'15s\';\n'+cte+checks+'\nrollback;\n')
# No row inserts/deletes, functions, schema changes, ingestion or fan-out.
# The BEFORE checksum protects every column against drift after capture.
# Returning the season to its old value for the AFTER checksum proves that all
# fields outside the five explicitly authorized metadata fields were preserved.
transaction=f"""-- NOT EXECUTED. Requires approval for this exact source-plan and transaction.
-- Atomic scope: 273 exact rows, four identity fields; three also correct season_id.
begin;
set local statement_timeout='15s';
set local lock_timeout='2s';
set local idle_in_transaction_session_timeout='5s';
do $repair$
declare
  plan constant jsonb := '{payload}'::jsonb;
  affected integer;
begin
  if jsonb_array_length(plan)<>273 then raise exception 'Repair scope changed'; end if;
  if exists(select 1 from pg_trigger where tgrelid='public.wgo_skater_stats'::regclass and not tgisinternal) then raise exception 'Unexpected trigger/fan-out'; end if;
  perform w.id from public.wgo_skater_stats w join jsonb_to_recordset(plan) as p({RECORD}) using(id) order by w.id for update of w;
  get diagnostics affected = row_count;
  if affected<>273 then raise exception 'Target row missing'; end if;
  if exists(select 1 from public.wgo_skater_stats w join jsonb_to_recordset(plan) as p({RECORD}) using(id) where md5(to_jsonb(w)::text)<>p.before_md5) then raise exception 'Captured row changed; recapture/review required'; end if;
  if exists(select 1 from public.wgo_skater_stats w join jsonb_to_recordset(plan) as p({RECORD}) on w.player_id=p.player_id and w.game_id=p.game_id and w.id<>p.id) then raise exception 'Conflicting player/game identity'; end if;
  if exists(select 1 from jsonb_to_recordset(plan) as p({RECORD}) left join public.games g on g.id=p.game_id left join public.teams ht on ht.id=g.\"homeTeamId\" left join public.teams at on at.id=g.\"awayTeamId\" where g.id is not null and (g.date is distinct from p.date or g.\"seasonId\" is distinct from p.season_id or g.type is distinct from 2 or (case when p.home_road='H' then ht.abbreviation else at.abbreviation end) is distinct from p.team_abbrev or (case when p.home_road='H' then at.abbreviation else ht.abbreviation end) is distinct from p.opponent_team_abbrev)) then raise exception 'Schedule corroboration changed'; end if;
  update public.wgo_skater_stats w set game_id=p.game_id, team_abbrev=p.team_abbrev, opponent_team_abbrev=p.opponent_team_abbrev, home_road=p.home_road, season_id=p.season_id from jsonb_to_recordset(plan) as p({RECORD}) where w.id=p.id;
  get diagnostics affected = row_count;
  if affected<>273 then raise exception 'Unexpected update count'; end if;
  if exists(select 1 from public.wgo_skater_stats w join jsonb_to_recordset(plan) as p({RECORD}) using(id) where md5(((to_jsonb(w)-'game_id'-'team_abbrev'-'opponent_team_abbrev'-'home_road') || jsonb_build_object('season_id',p.original_season_id))::text)<>p.preserved_md5 or w.game_id is distinct from p.game_id or w.team_abbrev is distinct from p.team_abbrev or w.opponent_team_abbrev is distinct from p.opponent_team_abbrev or w.home_road is distinct from p.home_road or w.season_id is distinct from p.season_id) then raise exception 'Post-update identity/stat preservation failed'; end if;
end;
$repair$;
commit;
"""
(ROOT/'repair-NOT-EXECUTED.sql').write_text(transaction)
postflight=cte+"""
select count(*) as exact_rows,
 count(*) filter(where w.game_id=p.game_id and w.team_abbrev=p.team_abbrev and w.opponent_team_abbrev=p.opponent_team_abbrev and w.home_road=p.home_road and w.season_id=p.season_id) as corrected_rows,
 count(*) filter(where md5(((to_jsonb(w)-'game_id'-'team_abbrev'-'opponent_team_abbrev'-'home_road') || jsonb_build_object('season_id',p.original_season_id))::text)=p.preserved_md5) as stats_preserved
from proposed p join public.wgo_skater_stats w using(id);
"""
(ROOT/'postflight.sql').write_text('begin read only;\nset local statement_timeout=\'15s\';\n'+postflight+'\nrollback;\n')
for name in ['source-plan.json','preflight.sql','repair-NOT-EXECUTED.sql','postflight.sql']:
    data=(ROOT/name).read_bytes()
    print(name,hashlib.sha256(data).hexdigest(),len(data))
