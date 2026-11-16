import json, math, hashlib, collections
from pathlib import Path
raw=Path('/tmp/astra-upserts1/0').read_bytes(); rows=json.loads(raw); assert len(rows)==60
wide=[r for r in rows if 'support_payload' not in r]; support=[r for r in rows if 'support_payload' in r]
key=lambda r:(r['player_id'],r['game_date'],r['strength_state'])
assert len(wide)==len(support)==30 and len({key(r) for r in wide})==30
assert {key(r) for r in wide}=={key(r) for r in support}
fields={}; leaves=collections.Counter(); schemas=collections.Counter()
def walk(x,p):
 if isinstance(x,dict):
  for k,v in x.items():walk(v,p+'.'+k)
 elif isinstance(x,list):
  for v in x:walk(v,p+'[]')
 else:
  t='null' if x is None else type(x).__name__; leaves[t]+=1
  f=fields.setdefault(p,{'types':collections.Counter(),'values':collections.Counter()});f['types'][t]+=1;f['values'][json.dumps(x,sort_keys=True)]+=1
  if isinstance(x,(int,float)) and not isinstance(x,bool):assert math.isfinite(x)
for r in rows:walk(r,'support' if 'support_payload' in r else 'wide')
by={key(r):r for r in wide}; checked_pairs=0; checked_windows=0; checked_pp=0
for r in support:
 w=by[key(r)];assert all(r[k]==w[k] for k in ['player_id','game_date','strength_state','season','team_id','game_id']);assert r['payload_schema_version']==1
 q=r['support_payload']['windowCountSupport'];assert q['version']=='rolling-player-window-counts-v1';assert q['strengthState']==r['strength_state'];assert q['anchor']=={'gameId':r['game_id'],'gameDate':r['game_date'],'season':r['season']}
 assert q['currentSeason']['season']==r['season'];assert q['selection']=='chronological_appearances_in_strength_state';assert q['currentSeason']['selection']=='chronological_appearances_in_strength_state_current_season'
 for label,s in q['windows'].items():
  n=int(label[4:]);assert s['appearances']==len(s['gameIds'])==len(s['gameDates'])<=n;assert s['gameDates']==sorted(s['gameDates']);assert all(d<=r['game_date'] for d in s['gameDates'])
  assert q['currentSeason']['windows'][label]['gameIds']==s['gameIds']
  for name,v in s['ratio'].items():assert len(v)==3 and 0<v[2]<=s['appearances'] and v[1]>=0
  checked_windows+=1
 if r['strength_state']=='all':
  assert math.isclose(w['sog_per_60_total_last5'],2*3600/1080,abs_tol=1e-6)
  assert w['season_availability_pct']==1
  nums=q['currentSeason']['seasonTotals']['ratio'].get('pp_share_pct')
  if nums and nums[1]>0:assert math.isclose(w['pp_share_pct_season'],nums[0]/nums[1],abs_tol=1e-6);checked_pp+=1
 checked_pairs+=1
schema={p:{'types':dict(v['types']),'distinct_values':len(v['values']),'values':dict(sorted(v['values'].items()))} for p,v in sorted(fields.items())}
out={'sha256':hashlib.sha256(raw).hexdigest(),'bytes':len(raw),'rows':len(rows),'wide_rows':len(wide),'support_rows':len(support),'wide_key_counts':sorted({len(r) for r in wide}),'leaf_types':dict(leaves),'schema_paths':len(fields),'identity_pairs_checked':checked_pairs,'rolling_windows_checked':checked_windows,'all_strength_pooled_pp_checks':checked_pp,'strengths':sorted({r['strength_state'] for r in wide}),'dates':sorted({r['game_date'] for r in wide}),'limits':'Every JSON leaf parsed, typed and finite-checked; every key inventoried below. Every paired identity, window membership and all-strength supplied SOG/availability/pooled PP identities checked. This stored before-change compatibility oracle is not independent evidence of all formulas or source correctness; no baseline regeneration or test execution.','schema':schema}
Path('/tmp/astra-rolling1-fixture-output.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps({k:v for k,v in out.items() if k!='schema'},indent=2))
