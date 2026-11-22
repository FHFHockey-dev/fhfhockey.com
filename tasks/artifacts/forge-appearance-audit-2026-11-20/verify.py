"""Compare complete fixture table contents to the preserved pre-apply copy."""
import hashlib,json,sys
from pathlib import Path
import psycopg2
from psycopg2 import sql
sock,phase=sys.argv[1:3];out=Path(sys.argv[3]);snap=Path(sys.argv[4])
assert phase in ('applied','rolled-back')
schema=json.loads((snap/'column-types.json').read_text())
result={}
class Digest:
    def __init__(self):self.d=hashlib.sha256()
    def write(self,data):self.d.update(data)
for db in ['audit_stale','postgres']:
    con=psycopg2.connect(host=sock,port=55496,user='postgres',dbname=db);con.set_session(readonly=True,isolation_level='REPEATABLE READ')
    c=con.cursor();fields=[]
    for rel,k,typ in schema:
        if rel!='rolling_player_game_metrics' or (phase=='applied' and k in ('game_id','season','team_id')):continue
        if db=='audit_stale' and k=='gp_semantic_type':
            # This one non-identity field was deliberately changed in the independent stale-target test.
            # Its original fixture value is NULL (column omitted by reader projection).
            fields.append(sql.SQL("case when player_id=8470604 and game_date='2011-02-15' and strength_state='ev' and gp_semantic_type='concurrent edit' then null else gp_semantic_type end"))
        else:fields.append(sql.Identifier(k))
    h=Digest();c.copy_expert(sql.SQL('copy(select {} from rolling_player_game_metrics order by player_id,game_date,strength_state collate "C") to stdout with(format binary)').format(sql.SQL(',').join(fields)),h)
    result[db]={'columns':len(fields),'binary_sha256':h.d.hexdigest()}
    c.execute("""select count(*) total,count(*) filter(where i.player_id is null or r.player_id is null) as key_differences,
       count(*) filter(where p.player_id is null) as outside_manifest,
       count(*) filter(where p.player_id is null and r.xmin::text is distinct from i.local_xmin) as outside_manifest_rewritten,
       count(*) filter(where p.player_id is not null and (r.game_id,r.season,r.team_id) is distinct from (p.game_id,p.season,p.team_id)) as different_from_before
       from rolling_player_game_metrics r full join audit.initial i using(player_id,game_date,strength_state)
       left join audit.plan p using(player_id,game_date,strength_state)""")
    result[db].update(dict(zip([d.name for d in c.description],c.fetchone())))
    c.execute("""select count(*),count(*) filter(where v.original is distinct from s.xmin::text) from rolling_player_metric_support_payloads s full join audit.support_versions v using(player_id,game_date,strength_state)""")
    result[db]['support_rows'],result[db]['support_rewritten']=c.fetchone()
    con.close()
a=result['postgres'];assert a['total']==937774 and a['outside_manifest']==439987 and a['outside_manifest_rewritten']==0 and a['key_differences']==0 and a['support_rows']==111198 and a['support_rewritten']==0
assert a['binary_sha256']==result['audit_stale']['binary_sha256'] and a['different_from_before']==(497787 if phase=='applied' else 0)
(out/(phase+'-whole-fixture.json')).write_text(json.dumps(result,indent=2)+'\n')
print(phase,a)
