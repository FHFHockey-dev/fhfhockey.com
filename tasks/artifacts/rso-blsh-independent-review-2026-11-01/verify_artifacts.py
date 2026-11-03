import pathlib,json,hashlib,gzip,math,statistics,os
import pyarrow.parquet as pq
B=pathlib.Path('/Users/tim/Documents/Codex/2026-10-27/task-3'); O=pathlib.Path('/tmp/rso-blsh-audit-iyklh0gv')
def read(p):return json.loads(p.read_text())
def sha(b):return hashlib.sha256(b).hexdigest()
A=B/'absence-ledger-replay-20261101-01'; C=B/'midseason-absence-cohort-20261101-01'
source=read(B/'absence-ledger-feasibility-20261029-01/SOURCE-QUALIFICATION.json'); cp=pathlib.Path(source['inputs']['calendar_path']);assert sha(cp.read_bytes())==source['inputs']['calendar_sha256']
calendar={r['id']:r for r in pq.read_table(cp).to_pylist()};assert all(r['seasonId']==20232024 for r in calendar.values())
q=read(C/'qualification-01/QUALIFICATION.json');ep=read(B/'tanev-absence-qualification-20261029-01/QUALIFIED-EPISODE.json')
boxes={};counts=[]
for label,receipts in [('cohort',q['receipts']),('tanev',ep['events'])]:
 n=0
 for r in receipts:
  p=pathlib.Path(r['receipt_path']);rr=p.read_bytes();receipt=json.loads(rr);raw=gzip.decompress(p.with_suffix('.gz').read_bytes());box=json.loads(raw);gid=r['game_id'];cal=calendar[gid]
  assert sha(rr)==r['receipt_sha256'] and sha(raw)==r['body_sha256']==receipt['sha256']
  assert receipt['TLS_verified'] is True and receipt['status']=='success' and receipt['http_status']==200
  assert receipt['url']==f'https://api-web.nhle.com/v1/gamecenter/{gid}/boxscore'
  assert box['id']==gid and box['season']==20232024 and box['gameType']==2 and box['gameState'] in ['OFF','FINAL']
  assert box['gameDate']==str(cal['date'])[:10] and (box['homeTeam']['id'],box['awayTeam']['id'])==(cal['homeTeamId'],cal['awayTeamId'])
  ids=[p['playerId'] for side in ['homeTeam','awayTeam'] for role in ['forwards','defense'] for p in box['playerByGameStats'][side][role]];assert len(ids)==len(set(ids))
  n+=len(raw);boxes[gid]=box
 counts.append({'scope':label,'bodies':len(receipts),'bytes':n})
expected={r['id'] for r in calendar.values() if int(r['type'])==2 and '2023-10-10'<=str(r['date'])[:10]<='2024-01-31' and {r['homeTeamId'],r['awayTeamId']}&{7,30,52}}
assert expected=={r['game_id'] for r in q['receipts']}|{r['game_id'] for r in q['missingCachedBoxes']}
frozen=read(C/'COHORT-FROZEN.json');assert sha(pathlib.Path(frozen['qualificationPath']).read_bytes())==frozen['qualificationSHA256']
# Read only the explicitly released development history, never reserved seasons.
hp=B/'current-refresh-20261029-01/dev-history-cache/dev-history.jsonl';assert sha(hp.read_bytes())==read(C/'INPUT-PINS.json')[str(hp)]
history=[json.loads(s) for s in hp.read_text().splitlines()];assert all(r['season_id'] in [20222023,20232024] for r in history)
weights={'goals':3,'assists':2,'pp_points':1,'shots':.2,'hits':.2,'blocked_shots':.25}
fp=lambda r:math.fsum(r[k]*w for k,w in weights.items())
tanevbase=read(A/'replay-01/BASELINE.json');baselines=[{'baseline':tanevbase['baseline'],'originalRows':tanevbase['originalRecordedRows']}]+read(C/'replay-01/BASELINES.json')
events={8479293:read(A/'replay-01/ADAPTER-EVENTS.json')['events'],**{r['playerId']:r['events'] for r in read(C/'replay-01/ADAPTER-EVENTS.json')}}
traces={'8479293':read(A/'replay-01/TRACES.json'),**read(C/'replay-01/TRACES.json')};report=[]
for row in baselines:
 base=row['baseline'];pid=base['player_id'];original=sorted([r for r in history if r['player_id']==pid and r['season_id']==20222023 and r['date']<'2023-10-10'],key=lambda r:(r['date'],r['id']))[-50:]
 assert original==row['originalRows'] and base['source_ids']==[r['id'] for r in original]
 mean=statistics.mean([fp(r) for r in original]);sd=statistics.stdev([fp(r) for r in original]);assert mean==base['mean'] and sd==base['sd']
 apps=0;misses=0
 for e in events[pid]:
  gid=int(e['game_id']);box=boxes[gid];players=[(box[s]['id'],p) for s in ['homeTeam','awayTeam'] for role in ['forwards','defense'] for p in box['playerByGameStats'][s][role] if p['playerId']==pid]
  teamid={8479293:55,8478398:52,8478864:30}[pid];assert teamid in [box['homeTeam']['id'],box['awayTeam']['id']]
  if e['participation']=='confirmed_absent':
   assert not players and e['value'] is None and e['roster_proof'] and e['participation_proof'];misses+=1;continue
  assert e['participation']=='appeared' and len(players)==1 and players[0][0]==teamid
  actual=[r for r in history if r['player_id']==pid and r['season_id']==20232024 and r['date']==e['game_date']];assert len(actual)==1;r=actual[0];p=players[0][1]
  assert r['team_abbrev']==e['team'] and r['games_played']==1 and fp(r)==e['value']
  assert (r.get('_research_game_id') or r.get('game_id'))==gid and r['calendar']==[20232024,e['game_date'],2]
  minutes,seconds=map(int,p['toi'].split(':'));assert r['toi_per_game']==e['toi_seconds']==60*minutes+seconds>0
  for a,b in [('goals','goals'),('assists','assists'),('shots','sog'),('hits','hits'),('blocked_shots','blockedShots')]:assert r[a]==p[b]
  if p['assists']==0:assert r['pp_points']==p['powerPlayGoals']
  apps+=1
 for policy,trace in traces[str(pid)].items():
  signal=0.;assert len(trace)==len(events[pid])
  for e,t in zip(events[pid],trace):
   if e['participation']=='appeared':signal=2/3*signal+1/3*(e['value']-mean)/sd
   else:
    factor=1 if policy=='no_decay' else 0 if policy=='reset' else 2**(-1/float(policy.removeprefix('decay_H')));signal*=factor
    assert t['standardized_observation'] is None
   assert math.isclose(signal,t['recent_strength'],rel_tol=1e-12,abs_tol=1e-12)
 report.append({'player':pid,'appearances':apps,'misses':misses,'baselineMean':mean,'baselineSD':sd,'calendarKnown':sum(r.get('calendar') is not None for r in original),'independentTraceArithmetic':'passed'})
result={'receipts':counts,'scheduledUnion':len(expected),'players':report,'frozenHash':'matched','reservedSeasonReads':0,'remoteProviderAPICalls':0}
(O/'artifact-verification.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))
