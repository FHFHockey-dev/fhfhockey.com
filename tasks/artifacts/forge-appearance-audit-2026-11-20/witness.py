"""Preserve complete production before-images for the historical witnesses and stable controls."""
import csv,gzip,json,sys
from pathlib import Path
import psycopg2
from psycopg2.extras import execute_values
from snapshot import connect
o,d=map(Path,sys.argv[1:3]);local=psycopg2.connect(host=sys.argv[3],port=55496,user='postgres',dbname='postgres');c=local.cursor()
scopes=json.loads((o/'scopes.json').read_text())
keys=[(q['ids'][0],q['cutoff'],q['strength']) for q in scopes if q.get('sample')]
c.execute("""select player_id,game_date,strength_state,audit_xmin from rolling_player_game_metrics where
(player_id,game_date,strength_state) in ((8473533,'2011-04-08','all'),(8473533,'2011-10-06','all'),(8470621,'2026-11-17','pp'),
(8485402,'2026-03-12','ev'),(8480025,'2024-04-18','ev'))""")
records=list(c.fetchall())
execute_values(c,"""select r.player_id,r.game_date,r.strength_state,r.audit_xmin from (values %s) k(p,d,s) join rolling_player_game_metrics r
on (r.player_id,r.game_date,r.strength_state)=(k.p,k.d::date-1,k.s)""",keys)
records+=c.fetchall();prod=connect();p=prod.cursor()
execute_values(p,"""select to_jsonb(r),to_jsonb(s),r.xmin::text from (values %s) as k(p,d,s,x)
join rolling_player_game_metrics r on (r.player_id,r.game_date,r.strength_state,r.xmin::text)=(k.p,k.d,k.s,k.x)
left join rolling_player_metric_support_payloads s on (r.player_id,r.game_date,r.strength_state)=(s.player_id,s.game_date,s.strength_state)
order by r.player_id,r.game_date""",records)
data=p.fetchall();assert len(data)==len(records)
with gzip.open(d/'complete-witness-rows.json.gz','wt') as f:json.dump(data,f,separators=(',',':'))
print('full before-image witnesses',len(data),'wide columns',len(data[0][0]))
prod.rollback()
