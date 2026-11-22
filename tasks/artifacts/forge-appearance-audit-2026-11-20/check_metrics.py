"""Audit the deployed hydrated values, including the historical-compatibility overlay."""
import collections,csv,gzip,json,math,sys
from pathlib import Path
import psycopg2
from snapshot import columns
d=Path(sys.argv[2]);db=psycopg2.connect(host=sys.argv[1],port=55496,user='postgres',dbname='postgres')
db.set_session(readonly=True,isolation_level='REPEATABLE READ')
metrics=columns()[5:];tally=collections.Counter(); nulls=collections.Counter();num=0
countfields=[f for f in metrics if f.startswith(('goals_total','shots_total','assists_total','hits_per_60_hits_','blocks_per_60_blocks_'))]
checks=[(f'{s}_total_last5',f'{s}_total_all') for s in ['goals','shots','assists','toi_seconds']]
checks.extend([(f'{s}_per_60_{m}_season',f'{s}_per_60_{m}_3ya') for s in ['hits','blocks'] for m in [s,'toi_seconds']])
checks.extend([(f'toi_seconds_avg_{w}',f'toi_seconds_total_{w}') for w in ['last5','all']])
with db.cursor(name='metrics') as cur,gzip.open(d/'metric-observations.csv.gz','wt') as f:
    w=csv.writer(f);w.writerow(['player_id','game_date','strength','rule','field','observed','comparison'])
    cur.execute('select r.player_id,r.game_date,r.strength_state,'+','.join('r.'+k for k in metrics)+
        """,s.player_id,s.game_id,s.season,s.payload_schema_version,s.support_payload->'historicalCompatibility',
        jsonb_typeof(s.support_payload),r.game_id,r.season from rolling_player_game_metrics r
        left join rolling_player_metric_support_payloads s using(player_id,game_date,strength_state)""")
    cur.itersize=2000
    for row in cur:
        num+=1;v=dict(zip(metrics,row[3:]));sp,sg,ss,ver,h,pt,rg,rs=row[3+len(metrics):]
        def flag(rule,field,a,b=None):
            tally[rule]+=1;w.writerow([*row[:3],rule,field,a,b])
        if sp is not None and (sg!=rg or ss!=rs or ver!=1 or pt!='object' or (h is not None and not isinstance(h,dict))):
            flag('invalid_support_identity_or_payload','support',sg,rg)
        for k,val in (h or {}).items():
            if k not in v or val is None:continue
            if type(val) not in (int,float) or not math.isfinite(val) or val<0:flag('invalid_support_metric',k,val)
            elif v[k] is not None and v[k]!=val:flag('wide_support_conflict',k,v[k],val)
            elif v[k] is None:v[k]=val
        for k,z in v.items():
            if z is None:nulls[k]+=1;continue
            if not math.isfinite(z) or z<0:flag('invalid_numeric',k,z)
        for k in countfields:
            if v[k] is not None and (not v[k].is_integer() if isinstance(v[k],float) else int(v[k])!=v[k]):flag('fractional_count',k,v[k])
        if v['ipp_all'] is not None and v['ipp_all']>100:flag('ipp_above_100','ipp_all',v['ipp_all'],100)
        for a,b in checks:
            if v[a] is not None and v[b] is not None and v[a]>v[b]+0.00001:flag('inconsistent_nested_totals',a,v[a],v[b])
        for win in ['last5','all']:
            g=v['goals_total_'+win];s=v['shots_total_'+win]
            if g is not None and s is not None and g>s:flag('compare_observation_frames','goals/shots_'+win,g,s)
        for s in ['hits','blocks']:
            for win in ['season','3ya']:
                a=f'{s}_per_60_{s}_{win}';b=f'{s}_per_60_toi_seconds_{win}'
                if v[a] is not None and v[a]>0 and v[b]==0:flag('event_without_exposure',a,v[a],v[b])
with db.cursor() as c:
    c.execute("""select count(*) from rolling_player_metric_support_payloads s left join rolling_player_game_metrics r using(player_id,game_date,strength_state) where r.player_id is null""");orphans=c.fetchone()[0]
(d/'metric-checks.json').write_text(json.dumps(dict(rows=num,flags=tally,legitimate_missing_allowed_by_field=nulls,orphan_support=orphans),indent=2)+'\n')
print(num,tally,orphans)
