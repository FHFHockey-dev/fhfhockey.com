"""Representative historical witnesses plus exhaustive potential caller IDs at the audit date."""
import json,sys
from datetime import timedelta
from pathlib import Path
import psycopg2
d=Path(sys.argv[2]);con=psycopg2.connect(host=sys.argv[1],port=55496,user='postgres',dbname='postgres');c=con.cursor()
c.execute("""select distinct on(p.defects) p.defects,p.player_id,p.game_date,p.strength_state,p.new_game
 from audit.plan p where p.strength_state='ev' and (p.status='canonical_game_missing' or not exists(
 select from audit.rows r where r.player_id=p.player_id and r.strength_state=p.strength_state and r.status<>'resolved'
 and r.game_date between p.game_date-364 and p.game_date)) order by p.defects,p.game_date,p.player_id""")
historical=[dict(name='history_'+k,ids=[p],cutoff=str(day+timedelta(days=1)),strength=s,days=365,sample=True,expectedGame=g)
            for k,p,day,s,g in c.fetchall()]
# All distinct ID/strengths potentially returned, irrespective of tonight's team or line combination. Group below 5000.
c.execute("""select window_scope,strength_state,array_agg(distinct player_id order by player_id) from audit.rows
where window_scope<>'outside' group by 1,2 order by 1,2""")
scopes=list(historical)
for window,strength,ids in c.fetchall():
    for i in range(0,len(ids),8):
        scopes.append(dict(name=f'{window}_{strength}_{i}',ids=ids[i:i+8],cutoff='2026-11-20',strength=strength,days=365 if window=='lineup365' else 1095))
(d/'scopes.json').write_text(json.dumps(scopes,indent=1))
print('historical',historical,'all scopes',len(scopes))
