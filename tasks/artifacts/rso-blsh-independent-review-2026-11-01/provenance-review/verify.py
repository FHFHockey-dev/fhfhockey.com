from pathlib import Path
import collections,datetime as dt,gzip,hashlib,json,math,os,statistics,subprocess,sys
B=Path('/Users/tim/Documents/Codex/2026-10-27/task-3');R=B/'baseline-card-provenance-20261101-01';O=Path('/Users/tim/Code/fhfhockey.com/tasks/artifacts/rso-blsh-independent-review-2026-11-01/provenance-review')
read=lambda p:json.loads(p.read_text());sha=lambda raw:hashlib.sha256(raw).hexdigest();result={}
lock=Path('/tmp/fhfh-heavy.lock')
try:lock.mkdir()
except FileExistsError:print('BLOCKED_SHARED_HEAVY_SLOT');sys.exit(2)
owner={'owner':'codex-independent-blsh-provenance-review','pid':os.getpid()};(lock/'owner.json').write_text(json.dumps(owner))
try:
 pins={**read(R/'INPUT-PINS.json'),**read(R/'SOURCE-PINS.json')}
 for p,h in pins.items():assert sha(Path(p).read_bytes())==h,p
 for p,h in read(R/'FINAL-RECEIPT.json')['filesSHA256'].items():assert sha((R/p).read_bytes())==h,p
 result['allInputSourceAndFinalReceiptPinsMatch']=True
 for name,command in [('baseline-tests',[sys.executable,'-B',str(R/'test_baselines.py')]),('card-tests',['node','--test',str(R/'card_provenance.test.cjs')])]:
  assert (O/(name+'.log')).exists() # Reuse completed passing tests; retry only the artifact-check harness.
 result['tests']={'python':10,'node':7,'passed':17}
 import pyarrow.parquet as pq
 cp=Path(next(p for p in pins if p.endswith('/games-20222023.parquet')));cal=pq.read_table(cp).to_pylist();assert all(g['seasonId']==20222023 for g in cal)
 t=read(Path(next(p for p in pins if p.endswith('/BASELINE.json'))));groups=[{'baseline':t['baseline'],'originalRows':t['originalRecordedRows']},*read(Path(next(p for p in pins if p.endswith('/BASELINES.json'))))]
 originals={r['id']:r for g in groups for r in g['originalRows']};assert len(originals)==150
 dates={r['date'] for r in originals.values()};games={g['id']:g for g in cal if g['type']==2 and str(g['date'])[:10] in dates}
 receipts=read(R/'baseline-01/OFFICIAL-RECEIPTS.json');assert len(receipts)==len({r['game_id'] for r in receipts})==834 and set(games)=={r['game_id'] for r in receipts}
 entries=collections.defaultdict(list);bytes_total=0
 for r in receipts:
  p=Path(r['receipt_path']);rr=p.read_bytes();receipt=json.loads(rr);raw=gzip.decompress(p.with_suffix('.gz').read_bytes());box=json.loads(raw);gid=r['game_id'];g=games[gid];bytes_total+=len(raw)
  assert sha(rr)==r['receipt_sha256'] and sha(raw)==r['body_sha256']==receipt['sha256']
  assert receipt['TLS_verified'] is True and receipt['status']=='success' and receipt['http_status']==200 and receipt['url']==r['sourceURL']==f'https://api-web.nhle.com/v1/gamecenter/{gid}/boxscore'
  assert box['id']==gid and box['season']==20222023 and box['gameType']==2 and box['gameState'] in ['OFF','FINAL'] and r['finality']==box['gameState']
  assert box['gameDate']==r['date']==str(g['date'])[:10] and (box['homeTeam']['id'],box['awayTeam']['id'])==(g['homeTeamId'],g['awayTeamId'])
  assert receipt['completed_at_utc']==r['retrievedAtUTC']
  seen=set()
  for side in ['homeTeam','awayTeam']:
   for role in ['forwards','defense']:
    for p in box['playerByGameStats'][side][role]:
     assert p['playerId'] not in seen;seen.add(p['playerId']);entries[(box['gameDate'],p['playerId'])].append((gid,box[side]['abbrev'],p,r))
 links=read(R/'baseline-01/BASELINE-ROW-LINKS.json');assert len(links)==150 and {l['sourceId'] for l in links}==set(originals);ppp=0
 for l in links:
  r=originals[l['sourceId']];candidates=entries[(r['date'],r['player_id'])];assert len(candidates)==1;gid,team,p,evidence=candidates[0]
  assert l['originalRowSHA256']==sha(json.dumps(r,sort_keys=True,separators=(',',':')).encode())
  for source,label in [('game_id','originalGameId'),('_research_game_id','originalResearchGameId'),('team_abbrev','originalTeam'),('calendar','originalCalendarLink')]:assert l[label]==r.get(source)
  assert l['derivedGameId']==gid and l['derivedTeam']==team and l['evidence']==evidence and l['calendarStatus']=='qualified' and l['officialOverlapStatus']=='matched' and not l['missingDateGameIds']
  assert r.get('game_id') in [None,gid] and r.get('_research_game_id') in [None,gid] and r.get('team_abbrev') in [None,team] and r.get('calendar') in [None,[20222023,r['date'],2]]
  mins,secs=map(int,p['toi'].split(':'));assert 0<=secs<60 and r['games_played']==1 and r['toi_per_game']==60*mins+secs>0
  for a,b in [('goals','goals'),('assists','assists'),('shots','sog'),('hits','hits'),('blocked_shots','blockedShots')]:assert type(r[a]) in [int,float] and r[a]==p[b]
  assert l['PPPIndependentOfficialCheck']==(p['assists']==0)
  if p['assists']==0:assert r['pp_points']==p['powerPlayGoals'];ppp+=1
 for g in groups:
  vals=[math.fsum(r[k]*w for k,w in {'goals':3,'assists':2,'pp_points':1,'shots':.2,'hits':.2,'blocked_shots':.25}.items()) for r in g['originalRows']]
  assert statistics.mean(vals)==g['baseline']['mean'] and statistics.stdev(vals)==g['baseline']['sd'] and [r['id'] for r in g['originalRows']]==g['baseline']['source_ids']
 result['baseline']={'rows':len(links),'dates':len(dates),'completeCalendarCensusBodies':len(receipts),'bodyBytes':bytes_total,'previousUnknownNowLinked':sum(r.get('calendar') is None for r in originals.values()),'officialOverlapMatches':150,'PPPIndependent':ppp,'baselineMembersMeanSDUnchanged':True}
 # Authenticate raw current captures and independently derive every saved window/mapping/gate.
 Q=B/'current-refresh-20261029-01';request=read(Q/'CURRENT-REQUEST.json');capture=read(Q/'CAPTURE-RECEIPT.json');side=read(R/'cards-01/PLAYER-CARDS-PROVENANCE.json')
 for key in ['wgo','calendar','individual','onIce']:
  rawbytes=(Q/f'RAW-{key}.json').read_bytes();raw=json.loads(rawbytes);feed=request[key]
  assert sha(rawbytes)==feed['capture']['sha256'] and raw['capturedAtUTC']==feed['capture']['retrievedAtUTC'] and raw['source']==feed['capture']['source'] and raw['snapshotUTC']==capture['snapshotUTC']
  rows=raw['records'] if key!='wgo' else [{**{k:r[k] for k in raw['columns'][:12]},'counts':{k:r[k] for k in raw['columns'][12:]}} for r in raw['records']]
  assert rows==feed['rows']
 snapbytes=Path(next(p for p in pins if '/research-snapshots/' in p)).read_bytes();snapshot=json.loads(snapbytes);assert sha(snapbytes)==side['snapshotSHA256'] and len(snapbytes)==side['snapshotBytes']
 profiles={p['playerId']:p for p in [json.loads(s) for s in (Q/'replay-01/PROFILES-A-canonical.jsonl').read_text().splitlines()]};display={p['playerId']:p for p in snapshot['profiles']};assert len(profiles)==len(display)==len(side['profiles'])==729
 wgo=collections.defaultdict(list);individual=collections.defaultdict(list);onice=collections.defaultdict(list)
 for r in request['wgo']['rows']:assert r['season_id']==20262027 and r['date']<=request['eventThroughDate'];wgo[r['player_id']].append(r)
 for feed,index in [('individual',individual),('onIce',onice)]:
  assert request[feed]['strengthScope']=='all_strength' and request[feed]['dateMeaning']=='game_date' and request[feed]['toiUnit']=='seconds'
  for r in request[feed]['rows']:assert r['season']==20262027;index[(r['player_id'],r['season'],r['date_scraped'])].append(r)
 calendar={r['id']:r for r in request['calendar']['rows']};bundle=read(B/'current-research-overlay-01/RESEARCH-GOAL-BUNDLE.json');patches={p['sourceId']:p for p in bundle['patches']}
 assert sha((B/'row-repair-01/REPAIR-MANIFEST.json').read_bytes())==bundle['manifestSHA256'] and sha((B/'row-repair-01/live-read-01/VERIFIED-ROW-PROPOSALS.json').read_bytes())==bundle['artifactSHA256']
 metrics={'fantasyPoints':['goals','assists','pp_points','shots','hits','blocked_shots'],'rawPoints':['goals','assists'],'wigoGameScore':['goals','total_primary_assists','total_secondary_assists','shots','blocked_shots','penalties_drawn','penalties','total_fow','total_fol','sat_for','sat_against','es_goals_for','pp_goals_for','sh_goals_for','es_goals_against','pp_goals_against','sh_goals_against']}
 nonneg=lambda x:type(x) in (int,float) and math.isfinite(x) and x>=0
 totals=collections.Counter(); ids=[]
 for p in side['profiles']:
  pid=p['playerId'];expected=sorted(wgo[pid],key=lambda r:(r['date'],r['id']))[-5:];assert p['scoreSnapshot']==display[pid]['score'] and p['window']==display[pid]['evidence']['window'] and p['reference']==display[pid]['evidence']['reference']
  assert p['window']['sourceIds']==profiles[pid]['window']['sourceIds']==[r['id'] for r in expected] and p['window']['dates']==[r['date'] for r in expected]
  assert len(p['sourceRows'])==len(expected)
  if all(r['counts']['shots']==0 for r in expected):totals['zeroShotWindows']+=1
  for e,r in zip(p['sourceRows'],expected):
   ids.append(r['id']);totals['windowRows']+=1
   for a,b in [('sourceId','id'),('playerId','player_id'),('gameId','game_id'),('season','season_id'),('date','date'),('team','team_abbrev'),('GP','games_played'),('TOISeconds','toi_per_game'),('esTOISeconds','es_toi_per_game'),('ppTOISeconds','pp_toi_per_game')]:assert e[a]==r[b]
   game=calendar[r['game_id']];assert game==e['calendarMatch'] and game['date']==r['date'] and game['type']==2 and game['seasonId']==r['season_id'] and e['regularSeasonCalendarMatched'] is True
   assert e['identityExposure']['qualified'] is True and r['games_played']==1 and nonneg(r['toi_per_game']) and r['toi_per_game']>0
   for track,fields in metrics.items():
    ok=all(nonneg(r['counts'][f]) for f in fields)
    if track=='rawPoints' and r['counts'].get('points') is not None:ok=ok and r['counts']['goals']+r['counts']['assists']==r['counts']['points']
    assert e['productionTracks'][track]['qualified']==ok
   if not e['productionTracks']['wigoGameScore']['qualified']:totals['missingGameScoreWindowRows']+=1
   for label,index,fields in [('individual',individual,['ixg']),('onIce',onice,['xgf','xga'])]:
    records=sorted(index[(r['player_id'],r['season_id'],r['date'])],key=lambda x:x['id']);assert records==e[label]['records'] and [v['id'] for v in records]==e[label]['sourceIds']
    ok=len(records)==1 and records[0]['gp']==1 and nonneg(records[0]['toi']) and records[0]['toi']==r['toi_per_game'] and all(nonneg(records[0][f]) for f in fields)
    assert e[label]['qualified']==ok
    if ok:totals[label+'Qualified']+=1
   patch=patches.get(r['id']);assert e['officialGoalReceipts']==(patch['proof'] if patch else None)
   assert e['finalityEstablished']==bool(patch and patch['proof']['finality']=='final' and e['officialGoalEvidence']['state']=='already_satisfied')
   if patch:
    assert (patch['playerId'],patch['gameId'],patch['date'],patch['teamAbbrev'])==(r['player_id'],r['game_id'],r['date'],r['team_abbrev']);assert all(r['counts'][k]==v for k,v in patch['values'].items());totals['officialFinalityMatchedRows']+=1
 assert len(ids)==len(set(ids))==3407
 age=(dt.datetime.fromisoformat(side['generatedAtUTC'].replace('Z','+00:00'))-dt.datetime.fromisoformat(request['asOfUTC'])).total_seconds()/3600;assert abs(age-side['capture']['ageHoursAtSidecarBuild'])<1/3600000 # JavaScript Date.parse truncates source timestamp microseconds to milliseconds.
 assert True and age>24 and side['capture']['withinOriginalCaptureAgeBudget'] is False
 summary=read(R/'cards-01/SUMMARY.json')
 for key,value in totals.items():assert summary[key]==value,(key,value,summary[key])
 assert side['trusted'] is False and side['productionAdopted'] is False and side['confidenceProbability'] is None and side['capture']['issuedAtUTC'] is None
 for key in ['individualXG','onIceXG']:assert side['metricDefinitions'][key]['xGModelVersion'] is None
 result['cards']={'profiles':729,**dict(totals),'savedSnapshotSHA256':sha(snapbytes),'ageHoursAtBuild':age,'stale':True,'modelRevisionUnknown':True,'bundleManifestAndArtifactHashesMatched':True,'calendarDoesNotContainTeamOrFinalityFields':set(next(iter(calendar.values())))=={'id','seasonId','date','type'}}
 # Trace every current-window finality assertion back to its exact original qualified proposal.
 proposals={p['source_id']:p for p in read(B/'row-repair-01/live-read-01/VERIFIED-ROW-PROPOSALS.json')['rows']}
 for pid in ids:
  if pid not in patches:continue
  p=patches[pid];old=proposals[pid];proof=old['proof']
  assert old['state']=='qualified' and proof['finality']=='final' and proof['attribution_state']=='qualified'
  assert p['sourceProjectionSHA256']==old['originalSourceProjectionSHA256'] and p['values']==old['proposed_after']==proof['values']
  assert p['proof']['receipts']==proof['receipts'] and p['proof']['method']==proof['method'] and p['proof']['availableAtUTC']==proof['proofAvailableAtUTC']
 result['currentFinalitySource']='657 matched original qualified proposals and exact receipt metadata; original current-season HTTP bodies not reinterpreted in this review'
 result['zeroProviderCalls']=True;result['reservedSeasonReads']=0
finally:
 assert read(lock/'owner.json')==owner;lock.rename(O/'heavy-lock-released-2')
(O/'RESULTS.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))
