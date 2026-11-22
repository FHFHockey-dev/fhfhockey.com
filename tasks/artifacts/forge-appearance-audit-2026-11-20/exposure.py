"""Check stored season / three-year seconds against a conservative physical upper bound on NHL regular-season minutes."""
import sys,json,csv,gzip,collections,io
from pathlib import Path
import psycopg2
from snapshot import connect
d,o=map(Path,sys.argv[1:3]);sock=sys.argv[3]
prod=connect();prod.set_session(readonly=True,isolation_level='REPEATABLE READ')
with prod.cursor(name='season_totals') as c,gzip.open(d/'season-participation.csv.gz','wt') as f:
    c.execute("""select player_id,season,games_played,toi_per_game,hits,blocked_shots from public.wgo_skater_stats_totals where season between '20012002' and '20262027'""")
    w=csv.writer(f);w.writerow('player_id season gp average_seconds hits blocks'.split());c.itersize=3000;w.writerows(c)
prod.rollback();prod.close()
db=psycopg2.connect(host=sock,port=55496,user='postgres',dbname='postgres');c=db.cursor()
c.execute('create temp table full_gp(player_id bigint,season int,gp int,avg_seconds float8,hits int,blocks int,primary key(player_id,season))')
with gzip.open(d/'season-participation.csv.gz','rt') as f:c.copy_expert('copy full_gp from stdin with(format csv,header true)',f)
# When the box archive has fewer games than the season total, grant ALL unobserved games before the anchor.
# Known post-anchor appearances subtract from the full-season GP, giving an upper bound even with historic gaps.
c.execute("""create temp table dates as select distinct player_id,season,game_id,game_date from audit.nhl
 where (game_id/10000)%100=2 and toi_seconds>0;
 create index on dates(player_id,season,game_date); analyze dates;
 create temp table b as select e.player_id,e.date,e.event_season,
    f.gp-count(d.game_id) filter(where d.game_date>e.date) as max_gp,
    f.gp as season_gp, count(d.game_id) as box_gp
 from audit.event e join full_gp f on (e.player_id,e.event_season)=(f.player_id,f.season)
 left join dates d on (d.player_id,d.season)=(f.player_id,f.season)
 group by e.player_id,e.date,e.event_season,f.gp having count(d.game_id)<=f.gp;
 create index on b(player_id,date);analyze b""")
# Missing prior season totals need a generous full-league historical per-player bound for that season.
# Omit that three-season comparison instead. Missing observations never establish a zero.
sql="""select r.player_id,r.game_date,r.strength_state,r.game_id,r.season,b.event_season,r.audit_xmin,b.season_gp,b.box_gp,b.max_gp,
 f1.gp as prior_gp1,f2.gp as prior_gp2,r.recent_rank=1 as latest,r.current_member,r.window_scope,
 """+','.join(f"""coalesce(m.{s}_per_60_toi_seconds_{win},(sp.support_payload#>>'{{historicalCompatibility,{s}_per_60_toi_seconds_{win}}}')::float) as {s}_{win}""" for win in ('season','3ya') for s in ('hits','blocks'))+"""
 from audit.rows r join b on (r.player_id,r.game_date)=(b.player_id,b.date)
 join rolling_player_game_metrics m using(player_id,game_date,strength_state)
 left join rolling_player_metric_support_payloads sp on (sp.player_id,sp.game_date,sp.strength_state)=(r.player_id,r.game_date,r.strength_state)
 left join full_gp f1 on f1.player_id=r.player_id and f1.season=b.event_season-10001
 left join full_gp f2 on f2.player_id=r.player_id and f2.season=b.event_season-20002"""
sql=sql.replace('join rolling_player_game_metrics m using(player_id,game_date,strength_state)','join rolling_player_game_metrics m on (r.player_id,r.game_date,r.strength_state)=(m.player_id,m.game_date,m.strength_state)')
counts=collections.Counter();coverage=collections.Counter();by=collections.Counter()
with db.cursor(name='derived') as cur,gzip.open(o/'unresolved-exposure.csv.gz','wt') as f:
    cur.itersize=2000;cur.execute(sql);w=csv.writer(f);w.writerow('player_id date strength game_id stored_season true_season xmin latest roster window max_gp_season max_gp_3ya field value max_possible_seconds evidence_needed'.split())
    for p,day,s,g,old,season,x,fullgp,boxgp,gp,p1,p2,latest,member,window,*vals in cur:
        found=False;coverage['season_game_bounds']+=1
        if p1 is not None and p2 is not None:coverage['three_year_game_bounds']+=1
        for k,v in zip(['hits_season','blocks_season','hits_3ya','blocks_3ya'],vals):
            n=gp if k.endswith('season') else gp+p1+p2 if p1 is not None and p2 is not None else None
            if n is None or v is None or v<=3900*n:continue
            found=True;counts[k]+=1
            metric,period=k.split('_')
            w.writerow([p,day,s,g,old,season,x,latest,member,window,gp,None if p1 is None or p2 is None else gp+p1+p2,f'{metric}_per_60_toi_seconds_{period}',v,3900*n,'event-level matched hit/block observations and TOI with original source coverage, partitioned by corrected NHL season'])
        if found:
            by[(s,window,latest,member)]+=1
res=dict(counts=counts,coverage=coverage,rows=sum(by.values()),scope=[[*k,v] for k,v in sorted(by.items())])
(o/'exposure-bounds.json').write_text(json.dumps(res,indent=2)+'\n')
print(json.dumps(res)[:1800])
