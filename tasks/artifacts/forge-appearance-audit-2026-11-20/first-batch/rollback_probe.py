"""Probe an intervening write after commit using a separate local clone of the restored fixture."""
import json
import psycopg2
import pilot as p

original = p.PACKET
base = original/'fixture/rollback-drift'
base.mkdir(exist_ok=False)
(base/'fixture').mkdir()
for filename in ('manifest.csv','preapproval.json'):
    (base/filename).symlink_to(original/filename)
def connection(local):
    assert local
    return psycopg2.connect(host=p.SOCKET,port=55497,dbname='pilot_rollback_stale',user='postgres')
p.connection = connection
p.PACKET = base
rows = p.load_plan()
with connection(True) as db:
    c = db.cursor()
    state = p.keyed_state(c,rows)
    p.store(base/'fixture/local-versions.json',[r['xmin'] for r in state])
    db.rollback()
    p.run('apply',True,None,base/'operator')
    c.execute('update '+p.TABLE+" set updated_at=coalesce(updated_at,now()) + interval '1 second' where (player_id,game_date,strength_state)=(%s,%s,%s)",rows[-1][:3])
    assert c.rowcount == 1
    db.commit()
    modified = p.keyed_state(c,rows)
    db.rollback()
    try:
        p.run('rollback',True,None,base/'operator')
        raise AssertionError('stale rollback accepted')
    except RuntimeError as err:
        assert 'drift' in str(err) and modified==p.keyed_state(c,rows)
        assert all(r['team']==int(plan[6]) for r,plan in zip(modified,rows,strict=True))
        p.store(base/'result.json',dict(reason=str(err),unrelated_edits=1,guarded_rollback_writes=0,team_corrections_retained=36))
