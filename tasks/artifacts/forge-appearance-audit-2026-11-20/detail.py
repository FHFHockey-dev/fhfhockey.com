"""Capture bounded source checks for every outlier after sidecar hydration."""
import csv,gzip,json,sys,collections
from pathlib import Path
import psycopg2
from psycopg2.extras import execute_values
from snapshot import connect
d=Path(sys.argv[1]);o=Path(sys.argv[2]);sock=sys.argv[3]
db=psycopg2.connect(host=sock,port=55496,dbname='postgres',user='postgres')
c=db.cursor()
data=list(csv.DictReader(gzip.open(o/'metric-observations.csv.gz','rt')))
c.execute('select player_id,game_date,strength_state,audit_xmin,recent_rank,current_member,window_scope from audit.rows where player_id=any(%s)',(list({int(x['player_id']) for x in data}),))
meta={(str(p),str(day),s):(x,rank,member,window) for p,day,s,x,rank,member,window in c.fetchall()}
prod=connect();prod.set_session(readonly=True,isolation_level='REPEATABLE READ');p=prod.cursor();out=[]
for strength,base in [('ev','es'),('all','as'),('5v5','5v5'),('pp','pp')]:
    group=[r for r in data if r['strength']==strength]
    for i in range(0,len(group),100):
        part=group[i:i+100];keys=[(int(r['player_id']),r['game_date'],strength,meta[r['player_id'],r['game_date'],strength][0]) for r in part]
        execute_values(p,f"""select r.player_id,r.game_date,r.strength_state,r.game_id,r.games_played,r.toi_seconds_total_all,
          r.ipp_points_season,r.ipp_on_ice_goals_for_season,r.ipp_all,
          s.support_payload#>'{{historicalCompatibility,ipp_all}}' as support_ipp,
          w.points,w.ev_points,w.pp_points,w.es_goals_for,w.pp_goals_for,w.sh_goals_for,
          a.total_points as nst_points,a.goals as nst_goals,a.shots as nst_shots,b.gf as nst_on_ice_goals,
          s.support_payload#>'{{alignedCountSupport,pairs,goalPerShot,all}}' as aligned_all,
          s.support_payload#>'{{alignedCountSupport,coverage}}' as aligned_coverage,
          s.support_payload#>'{{windowCountSupport,windows,last5,ratio,sog_per_60}}' as shot_frame5,
          s.support_payload#>'{{windowCountSupport,windows,last5,ratio,goals_per_60}}' as goal_frame5
          from (values %s) k(p,d,s,x) join rolling_player_game_metrics r on
          (r.player_id,r.game_date,r.strength_state,r.xmin::text)=(k.p,k.d::date,k.s,k.x)
          join wgo_skater_stats w on (w.player_id,w.date)=(r.player_id,r.game_date)
          left join rolling_player_metric_support_payloads s using(player_id,game_date,strength_state)
          left join nst_gamelog_{base}_counts a on (a.player_id,a.date_scraped)=(r.player_id,r.game_date)
          left join nst_gamelog_{base}_counts_oi b on (b.player_id,b.date_scraped)=(r.player_id,r.game_date)""".replace('left join rolling_player_metric_support_payloads s using(player_id,game_date,strength_state)','left join rolling_player_metric_support_payloads s on (s.player_id,s.game_date,s.strength_state)=(r.player_id,r.game_date,r.strength_state)'),keys)
        obs={(str(v[0]),str(v[1]),v[2]):dict(zip([col.name for col in p.description],v)) for v in p.fetchall()}
        assert len(obs)==len(keys)
        for r in part:
            k=(r['player_id'],r['game_date'],strength)
            v=obs[k];_,rank,member,window=meta[k]
            out.append(dict(**v,rule=r['rule'],field=r['field'],observed=r['observed'],comparison=r['comparison'],latest=rank==1,current_member=member,window=window))
prod.rollback()
(o/'metric-evidence.json').write_text(json.dumps(out,default=str,indent=1)+'\n')
with open(o/'live-pp.csv','w') as f:
    w=csv.writer(f);w.writerow(['player','game_date','game_id','scalar_goals','scalar_shots','aligned_goals','aligned_shots','aligned_observations','canonical_matched','matched_pairs_missing'])
    for r in sorted(out,key=lambda r:r['player_id']):
        if r['rule']=='compare_observation_frames' and r['latest'] and r['current_member']:
            pair=r['aligned_all'];cov=r['aligned_coverage']
            w.writerow([r['player_id'],r['game_date'],r['game_id'],r['observed'],r['comparison'],pair['numerator'],pair['denominator'],pair['observations'],cov['canonicalMatched'],cov['missingPair']['goalPerShot']])
print('all observations',len(out),'all-time PP valid aligned',sum(r['field']=='goals/shots_all' and (r['aligned_all'] or {}).get('observations',0)>0 for r in out))
