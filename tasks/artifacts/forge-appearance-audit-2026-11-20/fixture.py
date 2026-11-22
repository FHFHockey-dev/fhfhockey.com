"""Load captured reader fields into a disposable, Unix-socket-only PostgreSQL database."""
import csv, gzip, json, os, subprocess, sys
from pathlib import Path
import psycopg2
from snapshot import KEY
SNAP=Path(sys.argv[1]).resolve()
RUNTIME=Path(sys.argv[2]).resolve()
PGBIN=Path('/opt/homebrew/opt/postgresql@15/bin')
def local():
    return psycopg2.connect(host=str(RUNTIME),port=55496,dbname='postgres',user='postgres')
def shell(cmd):
    subprocess.run([str(x) for x in cmd],check=True,stdout=subprocess.DEVNULL)
def run():
    RUNTIME.mkdir(mode=0o700,parents=True,exist_ok=False)
    shell([PGBIN/'initdb','-D',RUNTIME/'pg','-U','postgres','-A','trust','--no-sync'])
    shell([PGBIN/'pg_ctl','-D',RUNTIME/'pg','-l',RUNTIME/'pg.log','-w','-o',f"-p 55496 -k {RUNTIME} -c listen_addresses='' -c unix_socket_permissions=0700",'start'])
    con=local();c=con.cursor()
    c.execute('create role anon; create role authenticated; create role service_role; create schema audit')
    types=json.loads((SNAP/'column-types.json').read_text())
    for name,table in [('wide','rolling_player_game_metrics'),('support','rolling_player_metric_support_payloads')]:
        fields=','.join('"'+col+'" '+typ for rel,col,typ in types if rel==table)
        c.execute(f'create table public.{table} ({fields}, audit_xmin text, primary key ({KEY}))')
    specs={'games':'id bigint primary key,date date,"seasonId" int,type int,"homeTeamId" int,"awayTeamId" int',
      'players':'id bigint primary key,position text','teams':'id int primary key,abbreviation text',
      'seasons':'id int primary key,"startDate" date,"endDate" date',
      'rosters':'"playerId" bigint,"teamId" int,"seasonId" int,is_current boolean',
      'wgo':'player_id bigint,date date,season_id int,game_id bigint,games_played int,team_abbrev text,opponent_team_abbrev text,home_road text,toi_per_game float8, primary key(player_id,date)',
      'spots':'player_id bigint,game_id bigint,game_date date,season_id int,team_id int,position_code text'}
    for name,ddl in specs.items():
        c.execute(f'create table public.{name} ({ddl})')
    for name in [*specs,'wide','support']:
        target={'wide':'rolling_player_game_metrics','support':'support_load'}.get(name,name)
        if name=='support':
            c.execute("""create temp table support_load (player_id bigint, game_id bigint,game_date date, season int,strength_state text,
                team_id int,payload_schema_version int,selected_payload jsonb,payload_type text,updated_at timestamptz,audit_xmin text)""")
        with gzip.open(SNAP/(name+'.csv.gz'),'rt') as f:
            header=next(csv.reader([f.readline()]))
            cols=','.join('"'+h+'"' for h in header)
            c.copy_expert(f"""copy {target} ({cols}) from stdin with (format csv,null '\\N')""",f)
        if name=='support':
            c.execute("""insert into rolling_player_metric_support_payloads
                select player_id,game_date,strength_state,season,team_id,game_id,payload_schema_version,
                case payload_type when 'object' then coalesce(selected_payload,'{}') when 'array' then '[]' when 'null' then 'null'
                when 'string' then '""' when 'number' then '0' when 'boolean' then 'false' end,updated_at,audit_xmin from support_load""")
        con.commit()
        print('loaded',name,flush=True)
    c.execute((SNAP/'rpc.sql').read_text())
    c.execute('create index on spots(player_id,game_date);create index on games(date);analyze')
    con.commit();con.close()
if __name__=='__main__':run()
