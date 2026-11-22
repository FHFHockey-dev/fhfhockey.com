"""Stream a single read-only production snapshot to a new local fixture directory."""
import argparse, csv, datetime, gzip, hashlib, json, os, re, subprocess
from pathlib import Path
from urllib.parse import urlsplit, unquote
import psycopg2

ROOT = Path(__file__).resolve().parents[3]
RELEASE = '3e360ae4c6bf2aecf10edda6df48a585f7f4b505'
READER = 'web/lib/projections/queries/skater-queries.ts'
KEY = 'player_id,game_date,strength_state'
def connect():
    line = next(s for s in (ROOT/'web/.env.local').read_text().splitlines() if s.startswith('SUPABASE_DB_URL='))
    url = urlsplit(line.split('=', 1)[1].strip('"\''))
    if url.hostname != 'db.fyhftlxokyjtpndbkfse.supabase.co' or url.path != '/postgres':
        raise RuntimeError('unexpected FORGE database target')
    ref = url.hostname.split('.')[1]
    con = psycopg2.connect(host='aws-0-us-east-1.pooler.supabase.com', dbname=url.path[1:] or 'postgres',
        user=f'{unquote(url.username)}.{ref}', password=unquote(url.password), sslmode='require', connect_timeout=10,
        application_name='forge-appearance-readonly', options='-c default_transaction_read_only=on -c statement_timeout=30000 -c lock_timeout=1500')
    con.set_session(readonly=True)
    return con
def columns():
    src = subprocess.check_output(['git','-C',str(ROOT),'show',f'{RELEASE}:{READER}'],text=True)
    clause = src.split('export const ROLLING_ROW_SELECT_CLAUSE =')[1].split('].join')[0]
    return [x for x in re.findall(r'"(\w+)"',re.sub(r'//[^\n]*','',clause)) if x != 'weighted_rate']
def sha(path):
    with open(path,'rb') as f: return hashlib.file_digest(f,'sha256').hexdigest()
def select_wide():
    return ','.join([*columns(),'team_id','xmin::text as audit_xmin'])
def main(out):
    out.mkdir(parents=True,exist_ok=False)
    con=connect()
    con.set_session(isolation_level='REPEATABLE READ',readonly=True)
    cur=con.cursor()
    cur.execute("select transaction_timestamp()::text,pg_current_snapshot()::text,current_setting('transaction_read_only'),version()")
    meta=dict(zip(('time','snapshot','read_only','postgres'),cur.fetchone()))
    meta.update(release=RELEASE, reader_columns=columns(),files={})
    cur.execute("select pg_get_functiondef('public.forge_latest_rolling_rows(bigint[],text,date,text[])'::regprocedure)")
    (out/'rpc.sql').write_text(cur.fetchone()[0])
    queries={
        'games':'select id,date,"seasonId",type,"homeTeamId","awayTeamId" from public.games',
        'teams':'select id,abbreviation from public.teams', 'players':'select id,position from public.players',
        'seasons':'select id,"startDate","endDate" from public.seasons',
        'rosters':'select "playerId","teamId","seasonId",is_current from public.rosters where is_current',
        'wide':'select '+select_wide()+' from public.rolling_player_game_metrics',
        'wgo':"""select w.player_id,w.date,w.season_id,w.game_id,w.games_played,w.team_abbrev,w.opponent_team_abbrev,w.home_road,w.toi_per_game
            from public.wgo_skater_stats w where exists (select 1 from public.rolling_player_game_metrics r where r.player_id=w.player_id and r.game_date=w.date)""",
        'spots':'select player_id,game_id,game_date,season_id,team_id,position_code from public.nhl_api_game_roster_spots',
        'support':"""select player_id,game_id,game_date,season,strength_state,team_id,payload_schema_version,
             (select jsonb_object_agg(k,case when k='historicalCompatibility' and jsonb_typeof(v)='object'
               then coalesce((select jsonb_object_agg(hk,hv) from jsonb_each(v) as h(hk,hv) where hk=any(array[%s])), '{}'::jsonb)
               else v end) from jsonb_each(case when jsonb_typeof(support_payload)='object' then support_payload else '{}'::jsonb end) as j(k,v)
               where k in ('historicalCompatibility','alignedCountSupport'))::text as selected_payload,
             jsonb_typeof(support_payload) as payload_type, updated_at,xmin::text as audit_xmin
             from public.rolling_player_metric_support_payloads""" % ','.join("'"+c+"'" for c in columns())}
    cur.execute("""select c.relname,a.attname,format_type(a.atttypid,a.atttypmod) from pg_attribute a join pg_class c on c.oid=a.attrelid
        where c.relnamespace='public'::regnamespace and c.relname in ('rolling_player_game_metrics','rolling_player_metric_support_payloads')
        and a.attnum>0 and not a.attisdropped order by c.relname,a.attnum""")
    (out/'column-types.json').write_text(json.dumps(cur.fetchall()))
    for name,sql in queries.items():
        with con.cursor(name='audit_'+name) as c, gzip.open(out/(name+'.csv.gz'),'wt',compresslevel=2,newline='') as f:
            c.execute(sql)
            n=0
            writer=csv.writer(f,lineterminator='\n')
            while True:
                rows=c.fetchmany(1000 if name=='support' else 4000)
                if not n: writer.writerow([d.name for d in c.description])
                if not rows: break
                writer.writerows([[r'\N' if v is None else v for v in row] for row in rows])
                n+=len(rows)
        meta['files'][name]={'rows':n,'sha256':sha(out/(name+'.csv.gz'))}
        print(name,n,flush=True)
    con.rollback();con.close()
    (out/'snapshot.json').write_text(json.dumps(meta,indent=2)+'\n')
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('new_directory',type=Path);main(p.parse_args().new_directory)
