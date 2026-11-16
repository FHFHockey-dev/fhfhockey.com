from pathlib import Path
import json,math,hashlib
p=Path('/private/tmp/astra-lib-fantasy-1');raw=(p/'web__lib__fantasy-projections____fixtures____season-evaluator-parity-v2.json').read_text()
def unique(pairs):
 out={}
 for k,v in pairs:
  assert k not in out,'duplicate '+k
  out[k]=v
 return out
f=json.loads(raw,object_pairs_hook=unique);counts={'numbers':0,'nulls':0,'strings':0,'booleans':0,'objects':0,'arrays':0}
def walk(x):
 if x is None:counts['nulls']+=1
 elif isinstance(x,bool):counts['booleans']+=1
 elif isinstance(x,(int,float)):counts['numbers']+=1;assert math.isfinite(x)
 elif isinstance(x,str):counts['strings']+=1
 elif isinstance(x,list):counts['arrays']+=1;[walk(v) for v in x]
 else:counts['objects']+=1;[walk(v) for v in x.values()]
walk(f);issues=[];checks=0
pairs={}
def close(actual,expected,label):
 global checks
 checks+=1
 if not math.isclose(actual,expected,rel_tol=1e-8,abs_tol=1e-8):issues.append(dict(label=label,actual=actual,expected=expected))
for i,c in enumerate(f['cases']):
 e=c['expected'];assert str(c['fhfhPlayerId']) in f['artifact']['players'];assert c['game']['gameId']==e['gameId'];assert c['fhfhPlayerId']==e['fhfhPlayerId'];assert len(e['componentHash'])==64;pairs[(c['fhfhPlayerId'],e['gameId'])]=e
 for key in ['conditionalMeans','unconditionalMeans','baselineUnconditionalMeans']:
  m=e[key]
  for target,inputs in [('ASSISTS',['PRIMARY_ASSISTS','SECONDARY_ASSISTS']),('POINTS',['GOALS','ASSISTS']),('PP_POINTS',['PP_GOALS','PP_ASSISTS']),('SH_POINTS',['SH_GOALS','SH_ASSISTS']),('EV_ASSISTS',['EV_PRIMARY_ASSISTS','EV_SECONDARY_ASSISTS']),('EV_POINTS',['EV_GOALS','EV_ASSISTS'])]:
   if all(k in m for k in inputs):close(m[target],sum(m[k] for k in inputs),f'case{i}.{key}.{target}')
  if 'SHOTS_AGAINST_GOALIE' in m:
   close(m['SAVES_GOALIE'],m['SHOTS_AGAINST_GOALIE']-m['GOALS_AGAINST_GOALIE'],f'case{i}.{key}.SAVES')
   close(m['SAVE_PERCENTAGE'],m['SAVES_GOALIE']/m['SHOTS_AGAINST_GOALIE'],f'case{i}.{key}.SV')
   close(m['GOALS_AGAINST_AVERAGE'],3600*m['GOALS_AGAINST_GOALIE']/m['TOTAL_TOI'],f'case{i}.{key}.GAA')
 for k in set(e['quantiles']['p10'])&set(e['quantiles']['p50'])&set(e['quantiles']['p90']):assert e['quantiles']['p10'][k]<=e['quantiles']['p50'][k]<=e['quantiles']['p90'][k],(i,k)
for i,a in enumerate(f['aggregates']):
 e=a['expected'];components=[pairs[(a['fhfhPlayerId'],g)] for g in a['gameIds']]
 assert e['componentManifest']==[dict(gameId=c['gameId'],componentHash=c['componentHash']) for c in components]
 for k,v in e['variances'].items():close(v,sum(c['variances'].get(k,0) for c in components),f'agg{i}.variance.{k}')
 for k in ['GAMES_PLAYED','TOTAL_TOI','GOALS','PRIMARY_ASSISTS','SECONDARY_ASSISTS','SHOTS_ON_GOAL','WINS_GOALIE','LOSSES_GOALIE','OTL_GOALIE','SHOTS_AGAINST_GOALIE','GOALS_AGAINST_GOALIE']:
  if k in e['means']:close(e['means'][k],a['actuals'].get(k,0)+sum(c['unconditionalMeans'].get(k,0) for c in components),f'agg{i}.mean.{k}')
 close(e['dependence']['primitiveCorrelation'],e['dependence']['factorLoading']**2,f'agg{i}.correlation')
 for k in set(e['quantiles']['p10'])&set(e['quantiles']['p50'])&set(e['quantiles']['p90']):assert e['quantiles']['p10'][k]<=e['quantiles']['p50'][k]<=e['quantiles']['p90'][k]
binary=[dict(case=i,player=c['fhfhPlayerId'],target=k,p90=c['expected']['quantiles']['p90'][k]) for i,c in enumerate(f['cases']) for k in ['WINS_GOALIE','LOSSES_GOALIE','OTL_GOALIE','SHUTOUTS_GOALIE','QUALITY_STARTS_GOALIE'] if c['expected']['quantiles']['p90'].get(k,0)>1]
assert not issues,issues
result={'passed':True,'mode':'JSON-only structural and independent elementary arithmetic checks; evaluator and tests not executed','counts':counts,'players':len(f['artifact']['players']),'teams':len(f['artifact']['teams']),'cases':len(f['cases']),'aggregates':len(f['aggregates']),'arithmetic_checks':checks,'arithmetic_mismatches':issues,'retained_SEASON_13_binary_support_violations':binary,'hash_boundary':'Only component-manifest reference equality and 64-character digest shape checked; canonical digest not independently replayed','provenance':f['description']};(p/'fixture-probe.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
