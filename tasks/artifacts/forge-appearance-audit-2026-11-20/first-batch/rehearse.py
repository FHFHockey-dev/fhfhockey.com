"""Run against the small pilot fixture and its separate, pristine pilot_stale clone."""
import hashlib
import json
from pathlib import Path
import subprocess

import psycopg2
import pilot as p

fixture = p.PACKET/'fixture'
rows = p.load_plan()
proof = {}
def reader(stage):
    out = fixture/('reader-'+stage+'.json')
    subprocess.run(['node','/tmp/forge-appearance-pg-1120/reader.cjs','http://127.0.0.1:53497',
                    str(fixture/'reader-scopes.json'),str(out)],check=True)
    results = json.loads(out.read_text())['results']
    assert len(results)==72 and all(r.get('latest') == r.get('events') == 1 for r in results)
    proof['reader_'+stage] = hashlib.sha256(out.read_bytes()).hexdigest()
    assert out.read_bytes() == (fixture/'reader-baseline.json').read_bytes()

def contents(db):
    c = db.cursor()
    c.execute("set local timezone='UTC'")
    c.execute('select player_id,game_date::text,strength_state,xmin::text,to_jsonb(r)::text from '+p.TABLE+' r order by 1,2,3')
    data = {(str(pid),date,strength):(version,hashlib.sha256(raw.encode()).hexdigest()) for pid,date,strength,version,raw in c}
    db.rollback()
    return data

def local(action):
    p.run(action,True,None,p.PACKET/'local')

original_connection = p.connection
def stale(local):
    assert local
    return psycopg2.connect(host=p.SOCKET,port=55497,dbname='pilot_stale',user='postgres')
p.connection = stale
with stale(True) as db:
    before = contents(db)
    c = db.cursor()
    c.execute("update public.rolling_player_game_metrics set updated_at=coalesce(updated_at,now())+interval '1 second' where (player_id,game_date,strength_state)=(%s,%s,%s)",rows[0][:3])
    assert c.rowcount == 1
    db.commit()
    intervened = contents(db)
    try:
        p.run('apply',True,None,p.PACKET/'local-drift')
        raise AssertionError('stale batch accepted')
    except RuntimeError as err:
        assert 'drift' in str(err)
        assert contents(db)==intervened and sum(before[k]!=v for k,v in intervened.items())==1
        proof['stale_refused']=str(err)
p.connection = original_connection
with p.connection(True) as db:
    before = contents(db)
    local('apply')
    after = contents(db)
    wanted = {r[:3] for r in rows}
    assert len(before)==42 and {k for k,v in before.items() if after[k]!=v}==wanted
    proof['unchanged_control_versions_and_values']=len(before)-len(wanted)
    reader('applied')
    local('apply')
    assert contents(db)==after
    proof['apply_retry_changed']=0
    # An unrelated client holding one target prevents any partial rollback.
    c = db.cursor()
    c.execute('select 1 from '+p.TABLE+' where (player_id,game_date,strength_state)=(%s,%s,%s) for update',rows[-1][:3])
    try:
        local('rollback')
        raise AssertionError('locked row accepted')
    except psycopg2.errors.LockNotAvailable as err:
        proof['locked_rollback_sqlstate']=err.pgcode
    db.rollback()
    assert contents(db)==after
    local('rollback')
    restored=contents(db)
    assert all(v[1]==restored[k][1] for k,v in before.items())
    proof['full_623_column_rows_restored']=len(before)
    reader('rolled-back')
    local('rollback')
    assert contents(db)==restored
    proof['rollback_retry_changed']=0
p.store(p.PACKET/'rehearsal.json',proof)
