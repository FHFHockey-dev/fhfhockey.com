"""Load the preserved full pilot rows into a fresh private, socket-only Postgres 15."""
import gzip
import json
from psycopg2 import sql
from pilot import PACKET, TABLE, connection, keyed_state, load_plan, require, store

data = json.load(gzip.open(PACKET/'fixture/original.json.gz','rt'))
valid = json.load(gzip.open(PACKET/'fixture/valid-controls.json.gz','rt'))
db = connection(True)
c = db.cursor()
c.execute("select current_setting('listen_addresses'),to_regclass('public.rolling_player_game_metrics')")
require(c.fetchone() == ('',None),'requires empty disposable instance')
c.execute('create table '+TABLE+' ('+', '.join(sql.Identifier(name).as_string(db)+' '+typ for name,typ in data['columns'])+')')
c.execute("""create table games(id bigint primary key, date date, "seasonId" int, type int,"homeTeamId" smallint,"awayTeamId" smallint);
    create table players(id bigint primary key);
    create table teams(id smallint primary key, abbreviation text);
    create table seasons(id int primary key, "startDate" date,"endDate" date);
    create table wgo_skater_stats(player_id bigint,date date,game_id bigint,season_id int,team_abbrev text,toi_per_game float8,
        games_played int,opponent_team_abbrev text,home_road text,primary key(player_id,date));
    create table rolling_player_metric_support_payloads(player_id bigint, game_date date, strength_state text,game_id bigint,
        season int, payload_schema_version int,support_payload jsonb,updated_at timestamptz,primary key(player_id,game_date,strength_state));""")
data['contents']['rolling_player_game_metrics'] += valid
for name, values in data['contents'].items():
    cmd = sql.SQL("insert into {0} select (jsonb_populate_record(null::{0},%s::jsonb)).*").format(sql.Identifier(name))
    c.executemany(cmd, [(v,) for v in values])
for index in data['indexes']:
    c.execute(index)
c.execute("alter table rolling_player_game_metrics add primary key using index rolling_player_game_metrics_pkey")
c.execute((PACKET.parent/'forge-appearance-snapshot-01/rpc.sql').read_text())
c.execute("create role service_role; grant usage on schema public to service_role; grant select on all tables in schema public to service_role")
db.commit()
c.execute('analyze')
c.execute('checkpoint')
db.commit()
rows = load_plan()
state = keyed_state(c,rows)
store(PACKET/'fixture/local-versions.json',[r['xmin'] for r in state])
# Use the census cutoff for each sampled player and strength. For Utah, the legacy path sees both dates.
scopes = [dict(name='/'.join(r[:3]),ids=[int(r[0])],strength=r[2],days=1095,
               cutoff='2026-11-20',sample=True) for r in rows]
store(PACKET/'fixture/reader-scopes.json',scopes)
db.close()
