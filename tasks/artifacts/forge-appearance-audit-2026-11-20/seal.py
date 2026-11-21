"""Produce deterministic row-level evidence for the decision from the local audited snapshot."""
import csv,gzip,hashlib,io,json,sys
from pathlib import Path
import psycopg2
from snapshot import sha,columns
d=Path(sys.argv[1]);out=Path(sys.argv[3]);out.mkdir(exist_ok=False,parents=True)
db=psycopg2.connect(host=sys.argv[2],port=55496,user='postgres',dbname='postgres');c=db.cursor()
def export(name,query):
    with open(out/(name+'.csv.gz'),'wb') as f,gzip.GzipFile(filename='',mode='wb',fileobj=f,mtime=0,compresslevel=5) as z:
        c.copy_expert('copy ('+query+') to stdout with(format csv,header true)',z)
def table(query):
    c.execute(query);return [dict(zip([x.name for x in c.description],row)) for row in c.fetchall()]
export('manifest','select * from audit.plan order by player_id,game_date,strength_state collate "C"')
export('unresolved-games',"""select player_id,game_date,strength_state,game_id as stored_game,source_game as nhl_game,source_season,source_team,
support_source,status,'canonical public.games row with the NHL ID and matching date, season, home and away teams' as required
from audit.rows where status<>'resolved' order by 1,2,3""")
export('unresolved-ipp',"""select r.player_id,r.game_date,r.strength_state,r.game_id,coalesce(r.ipp_all,(s.support_payload#>>'{historicalCompatibility,ipp_all}')::float8) as ipp_all,'IPP outside documented 0..100' as violated_rule,
'canonical original window membership and corrected matched player-points and on-ice goals-for observations, or approved source-contract ruling' as required
from rolling_player_game_metrics r left join rolling_player_metric_support_payloads s using(player_id,game_date,strength_state)
where coalesce(r.ipp_all,(s.support_payload#>>'{historicalCompatibility,ipp_all}')::float8)>100 order by 1,2,3""")
export('coverage',"""select window_scope,date_band,recent_rank=1 latest,current_member,count(*) as scanned,
count(*) filter(where p.player_id is not null) as proposed from audit.rows a left join (select player_id,game_date,strength_state from audit.plan) p
using(player_id,game_date,strength_state) group by 1,2,3,4 order by 1,2,3,4""")
summary={
 'snapshot':json.loads((d/'snapshot.json').read_text()),'cutoff':'2026-11-20',
 'rows':table('select count(*) as targets,count(distinct (player_id,game_date)) as player_dates,count(distinct player_id) as players from audit.plan')[0],
 'changes':table("""select count(*) filter(where game_id is distinct from new_game) as game_id,
 count(*) filter(where season is distinct from new_season) as season,count(*) filter(where team_id is null) as missing_team,
 count(*) filter(where team_id is not null and team_id is distinct from new_team) as wrong_team from audit.plan""")[0],
 'defect_combinations':table('select defects,count(*) n from audit.plan group by 1 order by 1'),
 'exposure':table('select window_scope,date_band,count(*) n,count(*) filter(where latest) newest,count(*) filter(where latest and current_member) newest_current from audit.plan group by 1,2 order by 1,2'),
 'unresolved':table("select status,count(*) n,count(distinct source_game) games,count(distinct (player_id,game_date)) appearances from audit.rows where status<>'resolved' group by 1"),
 'candidate_sidecars':table('select count(*) n from audit.plan join rolling_player_metric_support_payloads using(player_id,game_date,strength_state)')[0],
 'duplicate_game_strength':table('select count(*) n from (select player_id,game_id,strength_state from rolling_player_game_metrics where game_id is not null group by 1,2,3 having count(*)>1) x')[0],
 'sha256':{p.name:sha(p) for p in sorted(out.glob('*.csv.gz'))}}
(out/'summary.json').write_text(json.dumps(summary,indent=2)+'\n')
print(json.dumps({k:summary[k] for k in ('rows','changes','exposure','unresolved','sha256')}))
