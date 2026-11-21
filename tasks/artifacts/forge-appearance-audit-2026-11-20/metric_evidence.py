"""Read supplemental original components only for explicit metric exceptions, using captured versions."""
import json,sys
from pathlib import Path
import psycopg2
from snapshot import connect
from psycopg2.extras import execute_values
folder=Path(sys.argv[1])
local=psycopg2.connect(host=sys.argv[2],port=55496,user='postgres',dbname='postgres')
l=local.cursor()
l.execute("""select player_id,game_date,strength_state,audit_xmin from rolling_player_game_metrics
 where ipp_all>100 or goals_total_last5>shots_total_last5 or goals_total_all>shots_total_all""")
keys=l.fetchall()
con=connect();c=con.cursor()
c.execute("select attname from pg_attribute where attrelid='rolling_player_game_metrics'::regclass and attnum>0 and attname ~ '^(ipp_points|ipp_on_ice_goals_for|points|oi_gf|goals|shots)_(all|total_all|total_last5|last5)$'")
fields=','.join('r.'+x[0] for x in c.fetchall())
sql=f"""select r.player_id,r.game_date,r.strength_state,r.xmin::text as audit_xmin,{fields}, r.ipp_all,
 s.support_payload#>'{{windowCountSupport,windows,last5}}' as window5,s.support_payload#>'{{windowCountSupport,game}}' as game,
 s.support_payload#>'{{alignedCountSupport,pairs,goalPerShot,last5}}' as aligned5
 from (values %s) as k(p,d,s,x) join public.rolling_player_game_metrics r on
 (r.player_id,r.game_date,r.strength_state,r.xmin::text)=(k.p,k.d,k.s,k.x)
 left join public.rolling_player_metric_support_payloads s using(player_id,game_date,strength_state)
 order by 1,2,3"""
execute_values(c,sql,keys,page_size=len(keys))
out=[dict(zip([d.name for d in c.description],r)) for r in c.fetchall()]
assert len(out)==len(keys)
(folder/'metric-components.json').write_text(json.dumps(out,default=str)+'\n')
print('exception rows',len(out),'with explicit window',sum(x['window5'] is not None for x in out),'aligned',sum(x['aligned5'] is not None for x in out))
for s in ['pp','ev','all']:
 print({k:v for k,v in next(x for x in out if x['strength_state']==s).items() if k not in ['window5','game','aligned5']})
con.rollback();con.close()
