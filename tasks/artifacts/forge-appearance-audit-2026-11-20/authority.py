"""Load archived official NHL box-score rows and corroborating direct NHL game logs into local Postgres."""
import csv, gzip, io,json,sys
from pathlib import Path
import pyarrow.parquet as pq,psycopg2
def load(d,sock):
    con=psycopg2.connect(host=sock,port=55496,user='postgres',dbname='postgres');c=con.cursor()
    c.execute("""drop table if exists audit.nhl;create table audit.nhl(player_id bigint,game_date date,game_id bigint,
        season int,team_id int,team_abbrev text,side text,toi_seconds int,source text)""")
    def put(rows):
        f=io.StringIO();w=csv.writer(f);w.writerows(rows);f.seek(0);c.copy_expert('copy audit.nhl from stdin with(format csv)',f)
    def seconds(v):
        if not v or ':' not in v:return None
        m,s=v.split(':');return 60*int(m)+int(s)
    cols='player_id game_date game_id season team_id team_abbrev home_away toi'.split()
    for path in sorted((d/'boxes').glob('*.parquet')):
        for b in pq.ParquetFile(path).iter_batches(columns=cols,batch_size=10000):
            put([(*r[:7],seconds(r[7]),path.name) for r in zip(*(b.column(n).to_pylist() for n in cols))])
    for path in sorted((d/'nhl').glob('*.json.gz')):
        p,s,t=path.name.split('.')[0].split('-');g=json.load(gzip.open(path));rs=g.get('gameLog',[])
        if not rs:continue
        assert int(g['seasonId'])==int(s) and int(g['gameTypeId'])==int(t)
        put([(p,r['gameDate'],r['gameId'],s,None,r['teamAbbrev'],{'H':'home','R':'away'}[r['homeRoadFlag']],seconds(r['toi']),path.name) for r in rs])
    c.execute('create index on audit.nhl(player_id,game_date);analyze audit.nhl');con.commit();con.close()
if __name__=='__main__':load(Path(sys.argv[1]),sys.argv[2])
