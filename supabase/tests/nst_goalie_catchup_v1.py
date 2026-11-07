#!/usr/bin/env python3
"""Disposable PostgreSQL 15 fixture: Unix socket only, no hosted credentials.
Loads the exact migration first. Positive time-window tests replace ONLY
clock_timestamp() in RPC bodies with a fixture clock; the exact definitions are
restored and compared before shutdown. No production migration runner is used.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import time
import uuid
import psycopg2
from psycopg2.extras import Json

ROOT = Path(__file__).resolve().parents[2]
MIGRATION = ROOT / 'supabase/migrations/20261101161622_nst_goalie_catchup_v1.sql'
ADMISSION = Path('/Users/tim/Documents/Codex/2026-10-27/task/accepted-local-handoff/sql/20261027_nst_shared_admission_v1.sql')
PG = Path('/opt/homebrew/opt/postgresql@15/bin')
LOCK = Path('/private/tmp/fhfh-heavy.lock')
DATASETS = ['5v5Counts','5v5Rates','evCounts','evRates','allCounts','allRates','ppCounts','ppRates','pkCounts','pkRates']
NOW = '2026-11-01T11:10:00Z'


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',type=Path,required=True)
    args=parser.parse_args(); out=args.output.resolve(); out.mkdir(parents=True,exist_ok=False)
    token=str(uuid.uuid4()); checks=[]; started=False; c=None; sock=None
    result={'status':'STARTED','hostedCalls':0,'checks':checks,'migrationSha256':hashlib.sha256(MIGRATION.read_bytes()).hexdigest(),
        'clockFixture':'Only clock_timestamp() in function bodies replaced for deterministic windows; exact definitions restored and compared.'}
    try: LOCK.mkdir()
    except FileExistsError:
        (out/'RESULT.json').write_text(json.dumps({'status':'BLOCKED_HEAVY_LOCK','testsStarted':False})); return 75
    (LOCK/'owner.json').write_text(json.dumps({'owner':'NST-GOALIE-LOCAL-PG','pid':os.getpid(),'token':token}))
    env={k:v for k,v in os.environ.items() if k in ['PATH','HOME','USER','LOGNAME','TMPDIR','LANG'] or k.startswith('LC_')}
    pgpass=out/'empty.pgpass';pgpass.write_text('');pgpass.chmod(0o600)
    env.update({'TZ':'UTC','PGPASSFILE':str(pgpass),'PGSERVICEFILE':'/dev/null'})
    data=out/'pgdata'
    def command(name,argv):
        with (out/(name+'.log')).open('w') as log:subprocess.run(argv,env=env,stdout=log,stderr=subprocess.STDOUT,check=True,timeout=30)
    def connect():
        assert sock.startswith('/tmp/fhfh-nst-goalie-')
        conn=psycopg2.connect(host=sock,port=55449,user='fixture_owner',dbname='postgres',passfile=str(pgpass),sslmode='disable',connect_timeout=2,
            options='-c statement_timeout=5000 -c lock_timeout=3000 -c TimeZone=UTC')
        conn.autocommit=True;return conn
    def q(sql,params=None,conn=None):
        with (conn or c).cursor() as cur:
            cur.execute(sql,params);return cur.fetchall() if cur.description else None
    def rpc(name,args,conn=None):return q('select public.'+name+'('+','.join(['%s']*len(args))+')',args,conn)[0][0]
    def fails(work):
        try:work()
        except psycopg2.Error:return
        raise AssertionError('Expected SQL rejection')
    def check(name,work):
        work();checks.append({'name':name,'status':'PASS'});print(name+': PASS',flush=True)
    def reset():
        q('reset role; truncate public.nst_goalie_unit_receipts,public.nst_goalie_claims,public.nst_goalie_cohort_units,public.nst_goalie_cohorts,public.nst_goalie_units,public.nst_goalie_daily_budget,public.route_runner_jobs cascade')
        for table in tables:q('truncate public.'+table)
        q("update public.fixture_clock set at=%s",[NOW])
        q("update public.nst_goalie_control set enabled=true,enabled_at='2026-11-01T07:00Z',bootstrap_date='2026-10-27'")
        q("truncate public.nst_jobs;update public.nst_job_control set enforced=true,qualified_at='2026-11-01T10:50Z',qualification_fingerprint=repeat('e',64),last_untracked_at=null")
        q('set role service_role')
    def evidence(d,game_ids,goalie_ids):
        payload={'currentDate':d,'games':[{'id':g,'season':20262027,'gameType':2,'gameDate':d,'gameState':'OFF','homeTeam':{'id':1},'awayTeam':{'id':2}} for g in game_ids]}
        q("insert into public.nst_goalie_day_evidence(season,game_date,game_ids,goalie_ids,source_fingerprint,observed_at,source_url,source_payload) values(20262027,%s,%s,%s,repeat('d',64),'2026-11-01T10:00Z',%s,%s)",[d,game_ids,goalie_ids,'https://api-web.nhle.com/v1/score/'+d,Json(payload)])
    def manifest(days=1,scope='a'*64):
        dates=['2026-10-'+str(n) for n in range(27,27+days)]
        units=[{'key':f'20262027/{d}/{ds}','date':d,'dataset':ds,'state':'pending','reason':None} for d in dates for ds in DATASETS]
        return {'version':1,'scope':scope,'season':'20262027','sourceVersion':'fixture-v1','startDate':dates[0],'endDate':dates[-1],
            'plannedRequestCount':len(units),'nextUnplannedDate':None,'units':units}
    def ensure(m):return rpc('nst_goalie_ensure_cohort_v1',[Json(m)])
    def claim(m,conn=None):
        state=rpc('nst_goalie_read_state_v1',[m['scope']],conn); remaining=60-state['budget']['attempts']
        cap=min(20 if m['plannedRequestCount']<40 else 6,remaining)
        keys=[x['key'] for x in state['manifest']['units'] if x['state']=='pending'][:cap]
        return rpc('nst_goalie_claim_step_v1',[m['scope'],keys,min(3*len(keys),remaining),q("select at+interval '220 seconds' from public.fixture_clock",conn=conn)[0][0]],conn)
    def rows(key):
        ds=key.split('/')[-1];base={'date_scraped':key.split('/')[1],'season':20262027,'gp':1,'toi':60}
        base.update({'shots_against':20,'saves':19,'goals_against':1,'xg_against':1.1,'hd_shots_against':4,'hd_saves':3} if ds.endswith('Counts') else
            {'toi_per_gp':60,'shots_against_per_60':20,'saves_per_60':19,'gaa':1,'xg_against_per_60':1.1,'hd_shots_against_per_60':4,'hd_saves_per_60':3})
        return [{**base,'player_id':i,'player_name':f'Fixture {i}','team':'TOR'} for i in [1,2]]
    def commit(cl,key,payload=None):
        payload=rows(key) if payload is None else payload
        return rpc('nst_goalie_commit_unit_v1',[cl['scope'],cl['claimId'],key,Json(payload),'b'*64,not payload,len(payload),len(payload)])
    def finish(cl,keys,attempts=None):return rpc('nst_goalie_finish_step_v1',[cl['scope'],cl['claimId'],len(keys) if attempts is None else attempts,keys])
    try:
        command('initdb',[str(PG/'initdb'),'-D',str(data),'-A','trust','-U','fixture_owner','--no-locale','--encoding=UTF8'])
        sock=tempfile.mkdtemp(prefix='fhfh-nst-goalie-',dir='/tmp')
        command('start',[str(PG/'pg_ctl'),'-D',str(data),'-l',str(out/'postgres.log'),'-o',f"-F -p 55449 -k {sock} -h '' -c shared_buffers=16MB -c max_connections=12",'-w','start']);started=True
        c=connect();assert q('select inet_server_addr() is null')[0][0]
        result['postgresVersion']=q('show server_version')[0][0]
        q('create role anon;create role authenticated;create role service_role bypassrls;grant usage on schema public to service_role')
        baseline=(ROOT/'supabase/migrations/20260716112908_production_schema_baseline.sql').read_text()
        tables=['nst_gamelog_goalie_'+re.sub(r'(Counts|Rates)$',lambda m:'_'+m[1].lower(),ds) for ds in DATASETS]
        for table in tables+['games','wgo_goalie_stats','seasons']:
            match=re.search(r'CREATE TABLE public\.'+table+r' \(\n[\s\S]*?\n\);',baseline);assert match,table
            q(match[0])
            if table in tables:q('alter table public.'+table+' add primary key(player_id,date_scraped)')
            q('grant select,insert,update on public.'+table+' to service_role')
        q("insert into public.seasons(id,\"startDate\",\"endDate\",\"regularSeasonEndDate\",\"numberOfGames\") values(20262027,'2026-10-07','2027-06-30','2027-04-15',82)")
        identity=(ROOT/'supabase/migrations/20260814020808_harden_wgo_game_identity.sql').read_text()
        for statement in re.findall(r'alter table public\.wgo_goalie_stats[\s\S]*?;',identity):q(statement)
        # Reuse the exact accepted runner schema, with its ordinary trigger prerequisite.
        q("create function public.update_updated_at_column() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end $$")
        q((ROOT/'supabase/migrations/20261022133743_route_runner_tables.sql').read_text())
        fails(lambda:q(MIGRATION.read_text()));q('rollback')
        assert q("select to_regclass('public.nst_goalie_cohorts')")[0][0] is None
        checks.append({'name':'Missing shared admission prerequisite rolls back migration','status':'PASS'})
        assert hashlib.sha256(ADMISSION.read_bytes()).hexdigest()=='aefd3c20f2ff76328ef8b27e19244e438ad69a22ea1f9b5ef3cc1d6068784dce'
        q(ADMISSION.read_text());q(MIGRATION.read_text())
        check('Exact migration, RLS and least privileges',lambda:q((ROOT/'supabase/tests/nst_goalie_catchup_v1.sql').read_text()))
        exact=dict(q("select proname,pg_get_functiondef(oid) from pg_proc where pronamespace='public'::regnamespace and (proname like 'nst_goalie_%_v1' or proname like 'nst_job_%_v1' or proname in ('nst_admit_attempt_v1','nst_admit_job_attempt_v1'))"))
        q("create table public.fixture_clock(at timestamptz);insert into public.fixture_clock values('2026-11-01T11:10Z');grant select on public.fixture_clock to service_role")
        q('create function public.fixture_now() returns timestamptz language sql as $$ select at from public.fixture_clock $$')
        for definition in exact.values():q(definition.replace('clock_timestamp()','public.fixture_now()'))
        for i in range(27,32):
            d=f'2026-10-{i}';game=2026020000+i
            q('insert into public.games(id,date,"seasonId",type,"homeTeamId","awayTeamId") values(%s,%s,20262027,2,1,2)',[game,d])
            for goalie in [1,2]:q('insert into public.wgo_goalie_stats(goalie_id,goalie_name,date,season_id,games_played,game_id) values(%s,%s,%s,20262027,1,%s)',[goalie,f'Fixture {goalie}',d,game])
            evidence(d,[game],[1,2])
        def disabled():
            q('set role service_role');m=manifest();ensure(m)
            assert rpc('nst_goalie_read_state_v1',[m['scope']])['sharedJobActive']
            assert claim(m)['status']=='deferred'
        check('Default disabled control dispatches nothing',disabled)
        def ensure_checks():
            reset();m=manifest();a=ensure(m);assert ensure(m)==a
            assert q('select count(*) from public.route_runner_jobs')[0][0]==1
            altered={**m,'sourceVersion':'changed'};fails(lambda:ensure(altered))
            missing={**m,'scope':'c'*64,'units':m['units'][:-1]};fails(lambda:ensure(missing))
            q('reset role;delete from public.nst_goalie_day_evidence where game_date=\'2026-10-27\';set role service_role')
            fails(lambda:ensure({**m,'scope':'d'*64}))
            q("reset role");evidence("2026-10-27",[2026020027],[1,2])
        check('Idempotent enqueue, scope collision, aperture and missing finality',ensure_checks)
        def concurrency():
            reset();m=manifest(5);ensure(m);one=connect();two=connect()
            q('set role service_role',conn=one);q('set role service_role',conn=two);one.autocommit=False
            try:
                a=claim(m,one)
                assert a['status']=='claimed',a
                q('reset role')  # Fixture owner may inspect both session wait events.
                with ThreadPoolExecutor(max_workers=1) as pool:
                    future=pool.submit(claim,m,two);end=time.monotonic()+2;waited=False
                    while time.monotonic()<end:
                        if q('select wait_event_type from pg_stat_activity where pid=%s',[two.get_backend_pid()])[0][0]=='Lock':waited=True;break
                        time.sleep(.02)
                    assert waited;one.commit();b=future.result(3)
                assert a['status']=='claimed' and b['status']=='deferred'
                assert q('select steps,attempts_charged from public.nst_goalie_daily_budget')[0]==(1,18)
            finally:one.rollback();one.close();two.close()
        check('Two workers serialize on actual PostgreSQL lock; one reservation',concurrency)
        def commits():
            reset();m=manifest();ensure(m);cl=claim(m);key=cl['unitKeys'][0]
            a=commit(cl,key);assert commit(cl,key)==a
            changed=rows(key);changed[0]['toi']=59;fails(lambda:commit(cl,key,changed))
            keys=[key]
            for k in cl['unitKeys'][1:]:
                commit(cl,k,[] if k.endswith(('ppCounts','ppRates','pkCounts','pkRates')) else None);keys.append(k)
            assert q("select count(*) from public.nst_goalie_unit_receipts where status='empty_valid'")[0][0]==4
            a=finish(cl,keys);assert a['attemptsCharged']==30 and a['unusedReleased']==0
            assert finish(cl,keys)==a;fails(lambda:finish(cl,keys,11))
            assert q('select attempts_charged from public.nst_goalie_daily_budget')[0][0]==30
        check('Ten dataset commits, valid empty, idempotency and no unverified refund',commits)
        def rollback():
            reset();m=manifest();ensure(m);cl=claim(m);key=cl['unitKeys'][0]
            q("reset role;create function public.fixture_reject_receipt() returns trigger language plpgsql as $$ begin raise exception 'fixture rejection'; end $$;create trigger fixture_reject before insert on public.nst_goalie_unit_receipts for each row execute function public.fixture_reject_receipt();set role service_role")
            fails(lambda:commit(cl,key));assert q('select count(*) from public.nst_gamelog_goalie_5v5_counts')[0][0]==0
            assert q('select count(*) from public.nst_goalie_unit_receipts')[0][0]==0
            q('reset role;drop trigger fixture_reject on public.nst_goalie_unit_receipts;set role service_role');commit(cl,key)
        check('Receipt failure rolls back output in same transaction',rollback)
        def validation():
            reset();m=manifest();ensure(m);cl=claim(m);key=cl['unitKeys'][4]
            fails(lambda:commit(cl,key,rows(key)[:1]));fails(lambda:commit(cl,key,[]))
            bad=rows(key);bad[0]['hd_saves']=None;fails(lambda:commit(cl,key,bad))
            bad=rows(key);bad[0]['unexpected']=1;fails(lambda:commit(cl,key,bad))
            bad=rows(key);bad[1]['player_id']=1;fails(lambda:commit(cl,key,bad))
            bad=rows(key);bad[0]['gp']=2;fails(lambda:commit(cl,key,bad))
            assert q('select count(*) from public.nst_goalie_unit_receipts')[0][0]==0
            q("insert into public.nst_gamelog_goalie_all_counts(player_id,date_scraped,season) values(3,'2026-10-27',20262027)")
            fails(lambda:commit(cl,key))
            assert q('select count(*) from public.nst_gamelog_goalie_all_counts')[0][0]==1
            q("reset role;delete from public.nst_gamelog_goalie_all_counts where player_id=3;set role service_role")
            commit(cl,key)
        check('All-counts exact keys, missing fields, duplicates and unknown columns rejected',validation)
        def expiry():
            reset();m=manifest();ensure(m);cl=claim(m)
            q("reset role;update public.fixture_clock set at='2026-11-02T11:10Z';set role service_role")
            assert rpc('nst_goalie_read_state_v1',[m['scope']])['reviewRequired']
            fails(lambda:commit(cl,cl['unitKeys'][0]));fails(lambda:finish(cl,[],0))
            rpc('nst_goalie_hold_step_v1',[m['scope'],cl['claimId'],'Unknown worker outcome'])
            ensure(manifest(scope='c'*64))
            assert rpc('nst_goalie_read_state_v1',['c'*64])['reviewRequired']
            assert q('select attempts_charged from public.nst_goalie_daily_budget')[0][0]==30
        check('Expired/held claim survives day rollover and new cohort',expiry)
        def bounds():
            reset();m=manifest(5);ensure(m)
            for stamp in ['2026-11-01T08:29Z','2026-11-01T08:31:21Z','2026-11-01T10:10Z','2026-11-01T12:46:21Z']:
                q('reset role;update public.fixture_clock set at=%s;set role service_role',[stamp]);assert claim(m)['status']=='deferred'
            q('reset role;update public.fixture_clock set at=%s;set role service_role',[NOW])
            total=0
            for _ in range(4):
                cl=claim(m);assert cl['status']=='claimed';keys=cl['unitKeys']
                for k in keys:commit(cl,k)
                finish(cl,keys);total+=len(keys)
            assert total==24 and claim(m)['status']=='deferred'
            assert q('select steps,attempts_charged from public.nst_goalie_daily_budget')[0]==(4,60)
            reset();ensure(m);q("reset role;insert into public.nst_goalie_daily_budget values('2026-11-01',7,0);set role service_role");assert claim(m)['status']=='deferred'
        check('Worker windows, conservative 24-unit/60-reservation cap and seven-step limit',bounds)
        def no_games_and_changed_sources():
            reset();m=manifest();q("reset role");evidence("2026-10-26",[],[]);q("set role service_role")
            m={**m,'startDate':'2026-10-26','endDate':'2026-10-26','plannedRequestCount':0,'units':[{**u,'key':u['key'].replace('27','26',1),'date':'2026-10-26','state':'no_games'} for u in m['units']]}
            # Replace the date, not the season's 27 suffix.
            for u in m['units']:u['key']='20262027/2026-10-26/'+u['dataset']
            assert ensure(m)['jobId'] is None
            reset();m=manifest();ensure(m);cl=claim(m)
            q("reset role;update public.wgo_goalie_stats set games_played=2 where date='2026-10-27' and goalie_id=1;set role service_role")
            fails(lambda:commit(cl,cl['unitKeys'][0]))
            q("reset role;update public.wgo_goalie_stats set games_played=1 where date='2026-10-27' and goalie_id=1;set role service_role")
        check('Attested no-game day creates no job; changed WGO evidence blocks commit',no_games_and_changed_sources)
        def prepare_inputs():
            reset();q('reset role;truncate public.nst_goalie_day_evidence;set role service_role')
            m=manifest(5);m['sourceVersion']='official-nhl-score-off-v1';obs=[]
            for i in range(27,32):
                d=f'2026-10-{i}'
                payload=json.dumps({'currentDate':d,'games':[{'id':2026020000+i,'season':20262027,'gameType':2,'gameDate':d,'gameState':'OFF','homeTeam':{'id':1},'awayTeam':{'id':2}}]})
                obs.append({'date':d,'payloadText':payload,'fingerprint':hashlib.sha256(payload.encode()).hexdigest(),'sourceUrl':'https://api-web.nhle.com/v1/score/'+d,'observedAt':NOW})
            return m,obs
        def prepare_checks():
            m,obs=prepare_inputs();state=rpc('nst_goalie_preparation_state_v1',[])
            assert state['startDate']=='2026-10-27' and state['endDate']=='2026-10-31',state
            a=rpc('nst_goalie_prepare_cohort_v1',[Json(m),Json(obs)]);assert a['plannedRequestCount']==50
            assert rpc('nst_goalie_prepare_cohort_v1',[Json(m),Json(obs)])==a
            assert rpc('nst_goalie_preparation_state_v1',[])['activeScope']==m['scope']
            assert q('select count(*) from public.nst_goalie_day_evidence')[0][0]==5
            assert q('select count(*) from public.route_runner_jobs')[0][0]==1
            assert q("select expires_at=(select at from public.fixture_clock)+interval '14 days' from public.route_runner_jobs")[0][0]
            q("reset role;update public.route_runner_jobs set status='failed';set role service_role")
            assert rpc('nst_goalie_preparation_state_v1',[])['reviewRequired']
            fails(lambda:rpc('nst_goalie_prepare_cohort_v1',[Json(m),Json(obs)]))
        check('Official OFF evidence atomically prepares five days and reuses one cohort/job',prepare_checks)
        def prepare_rejects():
            for kind in ['hash','nonfinal','date','old','missingWgo']:
                m,obs=prepare_inputs()
                if kind=='hash':obs[-1]['fingerprint']='a'*64
                if kind in ['nonfinal','date']:
                    payload=json.loads(obs[-1]['payloadText'])
                    if kind=='nonfinal':payload['games'][0]['gameState']='FINAL'
                    else:payload['currentDate']='2026-10-30'
                    obs[-1]['payloadText']=json.dumps(payload);obs[-1]['fingerprint']=hashlib.sha256(obs[-1]['payloadText'].encode()).hexdigest()
                if kind=='old':obs[-1]['observedAt']='2026-11-01T10:00Z'
                if kind=='missingWgo':q("reset role;update public.wgo_goalie_stats set games_played=0 where date='2026-10-31' and goalie_id=1;set role service_role")
                fails(lambda:rpc('nst_goalie_prepare_cohort_v1',[Json(m),Json(obs)]))
                assert q('select count(*) from public.nst_goalie_day_evidence')[0][0]==0
                assert q('select count(*) from public.route_runner_jobs')[0][0]==0
                if kind=='missingWgo':q("reset role;update public.wgo_goalie_stats set games_played=1 where date='2026-10-31' and goalie_id=1;set role service_role")
            q('reset role;update public.nst_goalie_control set enabled=false;set role service_role')
            assert not rpc('nst_goalie_preparation_state_v1',[])['enabled']
            fails(lambda:rpc('nst_goalie_prepare_cohort_v1',[Json(m),Json(obs)]))
        check('Partial/changed/unfinal/stale source rolls back all evidence and disabled producer rejects',prepare_rejects)
        def prepare_empty():
            reset();q("reset role;truncate public.nst_goalie_day_evidence;update public.nst_goalie_control set bootstrap_date='2026-11-01';update public.fixture_clock set at='2026-11-02T11:10Z';set role service_role")
            m=manifest();m.update({'sourceVersion':'official-nhl-score-off-v1','startDate':'2026-11-01','endDate':'2026-11-01','plannedRequestCount':0})
            m['units']=[{**u,'key':'20262027/2026-11-01/'+u['dataset'],'date':'2026-11-01','state':'no_games'} for u in m['units']]
            payload=json.dumps({'currentDate':'2026-11-01','games':[]})
            obs=[{'date':'2026-11-01','sourceUrl':'https://api-web.nhle.com/v1/score/2026-11-01','payloadText':payload,'fingerprint':hashlib.sha256(payload.encode()).hexdigest(),'observedAt':'2026-11-02T11:10Z'}]
            assert rpc('nst_goalie_prepare_cohort_v1',[Json(m),Json(obs)])['jobId'] is None
            assert q("select count(*) from public.nst_goalie_units where state='no_games'")[0][0]==10
            assert rpc('nst_goalie_preparation_state_v1',[])['startDate'] is None
        check('Explicit empty official slate creates ten no-game receipts without a runner job',prepare_empty)
        def progress_checks():
            m,obs=prepare_inputs();rpc('nst_goalie_prepare_cohort_v1',[Json(m),Json(obs)])
            q("reset role;update public.nst_goalie_cohorts set created_at='2026-11-01T07:00Z';update public.fixture_clock set at='2026-11-01T13:00Z';set role service_role")
            progress=rpc('nst_goalie_progress_v1',[20262027]);assert progress['noProgressWindows']==2,progress
            assert progress['pending']==50 and len(progress['datasets'])==10
            q("reset role;update public.fixture_clock set at='2026-11-01T11:10Z';set role service_role")
            cl=claim(m);key=cl['unitKeys'][0];commit(cl,key);finish(cl,[key])
            q("reset role;update public.nst_goalie_unit_receipts set committed_at='2026-11-01T11:11Z';update public.fixture_clock set at='2026-11-01T13:00Z';set role service_role")
            progress=rpc('nst_goalie_progress_v1',[20262027]);assert progress['noProgressWindows']==0 and progress['pending']==49,progress
            q("reset role;update public.nst_goalie_units set state='held',hold_reason='unknown work' where unit_key=%s;set role service_role",[key])
            assert rpc('nst_goalie_progress_v1',[20262027])['reviewRequired']
            q("reset role;update public.nst_goalie_units set state='complete' where state='pending';update public.nst_goalie_unit_receipts set committed_at='2026-11-01T07:00Z';set role service_role")
            progress=rpc('nst_goalie_progress_v1',[20262027]);assert progress['reviewRequired'] and progress['noProgressWindows']==0,progress
            q('reset role;update public.nst_goalie_control set enabled_at=null;set role service_role')
            assert not rpc('nst_goalie_progress_v1',[20262027])['configurationKnown']
        check('Durable progress distinguishes two stalled windows, progress, hold and unknown activation',progress_checks)
        def invalid_activation_checks():
            for settings in ["bootstrap_date=null", "bootstrap_date='2026-10-06'", "bootstrap_date='2026-11-01'",
                    "enabled_at=null", "enabled_at='2026-11-02T07:00Z'"]:
                reset();q('reset role;update public.nst_goalie_control set '+settings+';set role service_role')
                assert rpc('nst_goalie_preparation_state_v1',[])['reviewRequired'],settings
                progress=rpc('nst_goalie_progress_v1',[20262027])
                assert not progress['configurationKnown'] and progress['reviewRequired'],(settings,progress)
                assert progress['pending']==progress['held']==progress['inFlight']==progress['noProgressWindows']==0
            reset()
            progress=rpc('nst_goalie_progress_v1',[20262027])
            assert progress['configurationKnown'] and not progress['reviewRequired'],progress
            assert not rpc('nst_goalie_progress_v1',[20252026])['configurationKnown']
            q('reset role;insert into public.seasons(id,"startDate","endDate","regularSeasonEndDate","numberOfGames") select 20262028,"startDate","endDate","regularSeasonEndDate","numberOfGames" from public.seasons where id=20262027;set role service_role')
            assert rpc('nst_goalie_preparation_state_v1',[])['reviewRequired']
            assert not rpc('nst_goalie_progress_v1',[20262027])['configurationKnown']
            q('reset role;delete from public.seasons where id=20262028;update public.fixture_clock set at=\'2027-07-01T11:10Z\';set role service_role')
            preparation=rpc('nst_goalie_preparation_state_v1',[])
            assert not preparation['reviewRequired'] and preparation['startDate'] is None
            progress=rpc('nst_goalie_progress_v1',[20262027])
            assert not progress['configurationKnown'] and progress['reviewRequired']
            q('reset role;update public.nst_goalie_control set enabled=false;set role service_role')
            progress=rpc('nst_goalie_progress_v1',[20262027])
            assert progress['configurationKnown'] and not progress['enabled']
        check('Empty queues cannot mask invalid bootstrap, activation, ambiguous or ineligible season',invalid_activation_checks)
        def lifecycle_checks():
            reset();m=manifest();ensure(m);token=str(uuid.uuid4());deadline='2026-11-01T11:13Z'
            assert rpc('nst_job_state_v1',[])['qualified']
            rpc('nst_job_begin_v1',[token,'fixture-direct',deadline])
            assert rpc('nst_job_state_v1',[])['active'] and claim(m)['status']=='deferred'
            fails(lambda:rpc('nst_admit_attempt_v1',[False,None]))
            fails(lambda:rpc('nst_admit_job_attempt_v1',['direct',str(uuid.uuid4()),False,None]))
            assert rpc('nst_admit_job_attempt_v1',['direct',token,False,None])['version']==1
            assert rpc('nst_job_finish_v1',[token])['status']=='finished'
            assert not rpc('nst_job_state_v1',[])['active']
            assert claim(m)['status']=='deferred' # Ten-minute post-direct cooldown.
            q("reset role;update public.fixture_clock set at='2026-11-01T11:21Z';set role service_role")
            cl=claim(m);assert cl['status']=='claimed'
            fails(lambda:rpc('nst_job_begin_v1',[str(uuid.uuid4()),'fixture-racer','2026-11-01T11:24Z']))
            assert rpc('nst_admit_job_attempt_v1',['goalie',cl['claimId'],False,None])['version']==1
            fails(lambda:rpc('nst_admit_job_attempt_v1',['goalie',str(uuid.uuid4()),False,None]))
            reset();token=str(uuid.uuid4());rpc('nst_job_begin_v1',[token,'fixture-expired',deadline])
            q("reset role;update public.fixture_clock set at='2026-11-01T11:14Z';set role service_role")
            assert rpc('nst_job_state_v1',[])['reviewRequired']
            fails(lambda:rpc('nst_job_finish_v1',[token]))
            fails(lambda:rpc('nst_admit_job_attempt_v1',['direct',token,False,None]))
            rpc('nst_job_hold_v1',[token,'unknown outcome']);assert rpc('nst_job_state_v1',[])['active']
            q("reset role;update public.fixture_clock set at='2026-11-02T11:10Z';set role service_role")
            assert rpc('nst_job_state_v1',[])['reviewRequired']
        check('Shared lifecycle token fence, direct/goalie exclusion, cooldown and persistent expiry hold',lifecycle_checks)
        def legacy_fence():
            reset();q('reset role;update public.nst_job_control set enforced=false;set role service_role')
            assert not rpc('nst_job_state_v1',[])['qualified']
            assert rpc('nst_admit_attempt_v1',[False,None])['version']==1
            q('reset role;update public.nst_job_control set enforced=true;set role service_role')
            assert not rpc('nst_job_state_v1',[])['qualified'] # Legacy use after attestation invalidates it.
            fails(lambda:rpc('nst_admit_attempt_v1',[False,None]))
        check('Legacy mode records untracked use; enforcement and qualification are separate',legacy_fence)
        q('reset role')
        for definition in exact.values():q(definition)
        restored=dict(q("select proname,pg_get_functiondef(oid) from pg_proc where pronamespace='public'::regnamespace and (proname like 'nst_goalie_%_v1' or proname like 'nst_job_%_v1' or proname in ('nst_admit_attempt_v1','nst_admit_job_attempt_v1'))"));assert restored==exact
        result['exactFunctionDefinitionsRestored']=True;result['status']='PASS'
    except BaseException as error:
        result['status']='FAIL';result['error']=str(error);raise
    finally:
        if c:c.close()
        if started:
            command('stop',[str(PG/'pg_ctl'),'-D',str(data),'-m','immediate','-w','stop']);result['serverStopped']=True
            shutil.rmtree(data);result['disposableDataRemoved']=True
        if sock:shutil.rmtree(sock)
        if json.loads((LOCK/'owner.json').read_text()).get('token')==token:
            (LOCK/'owner.json').unlink();LOCK.rmdir();result['ownedLockReleased']=True
        (out/'RESULT.json').write_text(json.dumps(result,indent=2)+'\n')
    return 0

if __name__=='__main__':raise SystemExit(main())
