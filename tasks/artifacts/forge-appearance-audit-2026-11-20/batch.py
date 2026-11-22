"""Exact, atomic production or disposable apply/rollback and fresh read-only readback."""
import argparse,csv,gzip,hashlib,itertools,json,os,time
from pathlib import Path
import psycopg2
from psycopg2.extras import execute_values
from snapshot import connect,sha

HASH='f71f2e195731677664ddaa5419c710bfd43d74b1523832ef74cd81e6ae95e275'
N=497787
CHUNK=2000
TABLE='public.rolling_player_game_metrics'
KEY='player_id,game_date,strength_state'
PLAN='player_id game_date strength_state game_id season team_id audit_xmin new_game new_season new_team defects window_scope date_band latest current_member status source_game source_season source_team support_source event_side wgo_game wgo_season wgo_team wgo_toi'.split()
TYPES='bigint date text bigint int int text bigint int int text text text boolean boolean text bigint int int text text bigint int text float8'.split()
OLD=('game_id','season','team_id')
NEW=('new_game','new_season','new_team')
def require(check,reason):
    if not check:raise RuntimeError(reason)
def store(path,obj):
    raw=json.dumps(obj,indent=2)+'\n'
    path.parent.mkdir(parents=True,exist_ok=True)
    tmp=path.with_suffix('.pending')
    with open(tmp,'w') as f:f.write(raw);f.flush();os.fsync(f.fileno())
    os.replace(tmp,path)
    fd=os.open(path.parent,os.O_RDONLY)
    try:os.fsync(fd)
    finally:os.close(fd)
def triples(alias,fields):return '('+','.join(alias+'.'+x for x in fields)+')'
def rows(manifest):
    with gzip.open(manifest,'rt') as f:
        r=csv.DictReader(f);require(r.fieldnames==PLAN,'unknown manifest columns')
        for v in r:yield [v[k] if v[k]!='' else None for k in PLAN]
def readonly(db,manifest,version,fields,local_expected=False):
    # Independent repeatable read with bounded inline values. No temp objects or writes.
    db.set_session(readonly=True,isolation_level='REPEATABLE READ')
    c=db.cursor();c.execute("select transaction_timestamp()::text,pg_current_snapshot()::text,current_setting('transaction_read_only')")
    stamp,snap,ro=c.fetchone();require(ro=='on','readback must be read-only')
    count=0;digest=hashlib.sha256();it=rows(manifest)
    names=['player_id','game_date','strength_state',*fields,'audit_xmin']
    while chunk:=list(itertools.islice(it,CHUNK)):
        values=[[v[PLAN.index(k)] for k in names] for v in chunk]
        expected='p.audit_xmin' if version is None else "'"+str(int(version)%2**32)+"'"
        extra=''
        if local_expected:
            extra=' join audit.initial i using(player_id,game_date,strength_state)'
            expected='i.local_xmin'
        sql=f"""with p({','.join(names)}) as(values %s)
            select count(*),count(*) filter(where r.xmin::text={expected} and {triples('r',OLD)} is not distinct from {triples('p',fields)})
            from p join {TABLE} r using({KEY}) {extra}"""
        template='('+','.join('%s::'+TYPES[PLAN.index(k)] for k in names)+')'
        execute_values(c,sql,values,template=template,page_size=CHUNK)
        n,matched=c.fetchone();require(n==matched==len(values),f'readback conflict at manifest rows {count+1} through {count+len(values)}: {matched}/{len(values)} exact matches')
        for v in values:
            digest.update((json.dumps(v[:6],separators=(',',':'))+'\n').encode())
        count+=n
    db.rollback();require(count==N,'readback count mismatch')
    return dict(time=stamp,snapshot=snap,read_only=ro,rows=count,matched_keys_values_sha256=digest.hexdigest(),version=version)
def staged(c,manifest,local):
    c.execute('create temp table plan ('+','.join(n+' '+t for n,t in zip(PLAN,TYPES))+', seq bigint generated always as identity,primary key('+KEY+')) on commit drop')
    with gzip.open(manifest,'rt') as f:
        c.copy_expert('copy plan ('+','.join(PLAN)+') from stdin with(format csv,header true)',f)
    c.execute('create unique index on plan(seq); analyze plan')
    if local:
        c.execute(f'update plan p set audit_xmin=i.local_xmin from audit.initial i where {triples("p",KEY.split(","))}={triples("i",KEY.split(","))} and i.prod_xmin=p.audit_xmin')
        require(c.rowcount==N,'fixture and audited versions differ')
    c.execute('select count(*),min(seq),max(seq) from plan')
    require(c.fetchone()==(N,1,N),'manifest count mismatch')
def apply_source_check(c,local):
    # Recheck the same canonical IDs, dated sides and participation before mutation.
    wgo='public.wgo' if local else 'public.wgo_skater_stats'
    c.execute(f"""select count(*) from plan p join {wgo} w on (w.player_id,w.date)=(p.player_id,p.game_date)
        join public.teams t on t.id=p.source_team join public.seasons s on s.id=p.source_season
        join public.players pl on pl.id=p.player_id left join public.games g on g.id=p.source_game
        where (w.game_id,w.season_id,w.team_abbrev,w.toi_per_game) is not distinct from
         (p.wgo_game,p.wgo_season,p.wgo_team,p.wgo_toi) and w.games_played=1 and w.toi_per_game>0 and
         p.game_date between s."startDate" and s."endDate" and
         ((p.status='resolved' and (g.date,g."seasonId")=(p.game_date,p.source_season) and g.type in (2,3) and
          (case when p.event_side='home' then g."homeTeamId" when p.event_side='away' then g."awayTeamId" end)=p.source_team)
         or (p.status='canonical_game_missing' and g.id is null and p.game_id is not distinct from p.new_game))""")
    require(c.fetchone()[0]==N,'participation or canonical evidence has changed')
    c.execute('select exists(select 1 from plan join public.rolling_player_metric_support_payloads using('+KEY+'))')
    require(not c.fetchone()[0],'new sidecar present on a target')
def operate(args):
    require(args.sha256==HASH and sha(args.manifest)==HASH,'exact manifest checksum mismatch')
    local=args.socket is not None
    if local:
        require(args.socket.is_absolute() and str(args.socket).startswith('/tmp/forge-appearance-'),'invalid disposable socket')
    def session():
        return (psycopg2.connect(host=str(args.socket),port=55496,dbname=args.fixture_db,user='postgres') if local else connect())
    tag=f'{args.socket}/{args.fixture_db}' if local else 'production'
    records=args.receipts;records.mkdir(parents=True,exist_ok=True)
    def intent(action):return records/(action+'-intent.json')
    def previous(action,db):
        if not intent(action).exists():return None
        obj=json.loads(intent(action).read_text())
        require(obj['environment']==tag and obj['manifest']==HASH,'wrong receipt')
        with db.cursor() as c:c.execute('select pg_xact_status(%s::xid8)',(str(obj['xid']),));state=c.fetchone()[0]
        db.rollback()
        require(state in ('committed','aborted'),'commit status pending or expired; inspect existing transaction')
        return obj['xid'] if state=='committed' else None
    with session() as db:
        # Same-repair operators serialize before examining or writing intents.
        c=db.cursor()
        if args.action!='readback':
            c.execute("select pg_try_advisory_lock(25061120,1177)");require(c.fetchone()[0],'batch operator already active')
        db.commit()
        ax=previous('apply',db);rx=previous('rollback',db)
        fields=OLD if rx or not ax else NEW;ver=rx or ax
        if args.action=='readback' or (args.action=='apply' and ax) or (args.action=='rollback' and rx):
            if args.action=='apply' and rx:raise RuntimeError('batch already rolled back; a new apply needs a new audit')
            result=readonly(db,args.manifest,ver,fields,local and ver is None)
            result.update(environment=tag,action=args.action,changed=0,manifest=HASH)
            store(records/(args.action+'-readback-'+str(time.time_ns())+'.json'),result);print(json.dumps(result));return
        require(args.action=='apply' or ax is not None,'no committed apply available for rollback')
        before,after=(OLD,NEW) if args.action=='apply' else (NEW,OLD)
        db.set_session(readonly=False,isolation_level='SERIALIZABLE')
        c=db.cursor();c.execute("set local lock_timeout='2s'; set local statement_timeout='120s'; set local idle_in_transaction_session_timeout='60s'")
        c.execute("""select count(*) from pg_trigger where tgrelid='public.rolling_player_game_metrics'::regclass and not tgisinternal and tgenabled<>'D'""")
        require(c.fetchone()[0]==0,'unexpected write trigger')
        staged(c,args.manifest,local)
        if args.action=='apply':apply_source_check(c,local)
        want='p.audit_xmin' if args.action=='apply' else "'"+str(ax%2**32)+"'"
        cond=f'r.xmin::text={want} and {triples("r",OLD)} is not distinct from {triples("p",before)}'
        c.execute(f'select count(*) from plan p join {TABLE} r using({KEY}) where {cond}')
        require(c.fetchone()[0]==N,'target changed since audited or committed version; transaction refused')
        c.execute('select pg_current_xact_id()::text');xid=int(c.fetchone()[0])
        start=time.monotonic();count=0
        for first in range(1,N+1,CHUNK):
            require(time.monotonic()-start<1200,'20-minute update budget exceeded')
            c.execute(f"""update {TABLE} r set (game_id,season,team_id)={triples('p',after)} from plan p
              where p.seq between %s and %s and {triples('r',KEY.split(','))}={triples('p',KEY.split(','))} and {cond}""",(first,first+CHUNK-1))
            require(c.rowcount==min(CHUNK,N-first+1),'target changed during update')
            count+=c.rowcount
        c.execute(f"""select count(*) from plan p join {TABLE} r using({KEY})
            where r.xmin::text=%s and {triples('r',OLD)} is not distinct from {triples('p',after)}""",(str(xid%2**32),))
        require(c.fetchone()[0]==count==N,'before-commit verification failed')
        info=dict(environment=tag,manifest=HASH,xid=xid,rows=count,action=args.action)
        store(intent(args.action),info);db.commit()
        store(records/(args.action+'-committed.json'),info)
    # Separate connection after the commit to establish durable visibility.
    with session() as verify:
        result=readonly(verify,args.manifest,xid,after)
    result.update(info,changed=count)
    store(records/(args.action+'-postcommit.json'),result);print(json.dumps(result))
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('action',choices=['apply','rollback','readback'])
    g=p.add_mutually_exclusive_group(required=True);g.add_argument('--production',action='store_true');g.add_argument('--socket',type=Path)
    p.add_argument('--fixture-db',choices=['postgres','audit_stale'],default='postgres');p.add_argument('--manifest',type=Path,required=True);p.add_argument('--sha256',required=True);p.add_argument('--receipts',type=Path,required=True)
    operate(p.parse_args())
