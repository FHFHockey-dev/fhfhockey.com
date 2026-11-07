from pathlib import Path
import collections,csv,datetime as dt,hashlib,io,json,os,subprocess,sys
B=Path('/Users/tim/Documents/Codex/2026-10-27/task-3');R=B/'current-box-provenance-20261101-01';O=Path('/Users/tim/Code/fhfhockey.com/tasks/artifacts/rso-blsh-independent-review-2026-11-01/current-box-review')
read=lambda p:json.loads(p.read_text());sha=lambda b:hashlib.sha256(b).hexdigest();stamp=lambda s:dt.datetime.fromisoformat(s.replace('Z','+00:00'))
lock=Path('/tmp/fhfh-heavy.lock')
try:lock.mkdir()
except FileExistsError:print('BLOCKED_SHARED_HEAVY_SLOT');sys.exit(2)
owner={'owner':'codex-independent-current-box-review','pid':os.getpid()};(lock/'owner.json').write_text(json.dumps(owner));result={}
try:
 contract=read(R/'CONTRACT.json');final=read(R/'FINAL-RECEIPT.json')
 for p,h in contract['inputs'].items():assert sha(Path(p).read_bytes())==h,p
 for p,h in final['files'].items():assert sha((R/p).read_bytes())==h,p
 result['allFrozenInputAndFinalFilePinsMatch']=True
 run=subprocess.run([sys.executable,'-B','-m','unittest','-v','test_qualify'],cwd=R,capture_output=True,text=True,timeout=30,env={**os.environ,'PYTHONDONTWRITEBYTECODE':'1'});(O/'tests.log').write_text(run.stdout+run.stderr);assert run.returncode==0;result['testsPassed']=10
 side=read(Path(next(p for p in contract['inputs'] if p.endswith('/PLAYER-CARDS-PROVENANCE.json'))));raw=read(Path(next(p for p in contract['inputs'] if p.endswith('/RAW-wgo.json'))));bundle=read(Path(next(p for p in contract['inputs'] if p.endswith('/RESEARCH-GOAL-BUNDLE.json'))))
 oldrows=[r for p in side['profiles'] for r in p['sourceRows']];ids=[r['sourceId'] for r in oldrows];assert len(ids)==len(set(ids))==3407
 source={r['id']:r for r in raw['records']};assert len(source)==len(raw['records'])
 rows=read(R/'ROW-QUALIFICATION.json');saved={r['sourceId']:r for r in rows};assert len(rows)==len(saved)==3407 and set(saved)==set(ids)
 for r in oldrows:
  for k,v in [('sourceId','id'),('playerId','player_id'),('gameId','game_id'),('date','date'),('team','team_abbrev'),('GP','games_played'),('TOISeconds','toi_per_game')]:assert r[k]==source[r['sourceId']][v]
 games={source[i]['game_id'] for i in ids};assert len(games)==201
 pins={}
 for patch in bundle['patches']:
  gid=patch['gameId'];url=f'https://api-web.nhle.com/v1/gamecenter/{gid}/boxscore'
  for pin in patch['proof']['receipts']:
   if pin['url']==url:
    assert gid not in pins or pins[gid]==pin;pins[gid]=pin
 evidence=read(R/'BOX-EVIDENCE.json');boxes={};players={};total=0
 for gidtext,e in evidence.items():
  gid=int(gidtext);assert gid in games and gid in pins;pin=pins[gid]
  body=Path(e['bodyPath']).read_bytes();receipt_bytes=Path(e['receiptPath']).read_bytes();receipt=json.loads(receipt_bytes);box=json.loads(body);total+=len(body)
  assert sha(body)==e['bodySHA256']==receipt['sha256']==pin['sha256'] and sha(receipt_bytes)==e['receiptSHA256']
  assert receipt['bytes']==len(body) and receipt['status']=='success' and receipt['TLSVerified'] is True and receipt['httpStatus']==200
  assert receipt['url']==e['url']==pin['url']==f'https://api-web.nhle.com/v1/gamecenter/{gid}/boxscore'
  assert receipt['retrievedAtUTC']==e['retrievedAtUTC']==pin['retrievedAtUTC'] and stamp(receipt['retrievedAtUTC'])<=stamp(contract['captureAsOf'])
  assert box['id']==gid and box['season']==20262027 and box['gameType']==2 and box['gameState'] in ['OFF','FINAL'] and '2026-09-29'<=box['gameDate']<=contract['eventThrough']
  assert box['homeTeam']['id']!=box['awayTeam']['id'] and box['homeTeam']['abbrev']!=box['awayTeam']['abbrev'];entries={}
  for s in ['homeTeam','awayTeam']:
   team=box[s];assert type(team['id']) is int and team['id']>0 and isinstance(team['abbrev'],str) and team['abbrev']
   for g in ['forwards','defense']:
    assert isinstance(box['playerByGameStats'][s][g],list)
    for p in box['playerByGameStats'][s][g]:assert type(p['playerId']) is int and p['playerId']>0 and p['playerId'] not in entries;entries[p['playerId']]=(p,team)
  boxes[gid]=box;players[gid]=entries
 assert len(boxes)==183 and total==2441578
 assert games-set(boxes)==games-set(pins),'Missing games must be absent from frozen pin scope, not hidden read failures'
 missing=set();toi_diff=set();count_diff=set();matched=set();identity=set();fielddiff=[];PPP=collections.Counter();missingdates=collections.Counter();zeroshots=0
 for sid in sorted(ids):
  r=source[sid];s=saved[sid];gid=r['game_id'];assert r['season_id']==20262027
  assert s['sourceRowSHA256']==sha(json.dumps(r,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode())
  assert (s['sourceId'],s['playerId'],s['gameId'],s['date'],s['wgoTeam'])==(r['id'],r['player_id'],gid,r['date'],r['team_abbrev'])
  if gid not in boxes:
   missing.add(sid);missingdates[r['date']]+=1;assert s['state']=='held' and s['gameFinality']==s['appearance']==s['team']=='unknown' and s['TOI'] is None and s['counts']=={} and s['PPP'] is None and s['evidenceGameId'] is None and s['reasons']==['no_pinned_cached_official_box'];continue
  box=boxes[gid];assert box['gameDate']==r['date'];assert r['player_id'] in players[gid];p,team=players[gid][r['player_id']];assert team['abbrev']==r['team_abbrev']
  assert s['gameFinality']=='final' and s['team']=='match' and s['officialTeam']==team['abbrev'] and s['officialTeamId']==team['id'] and s['evidenceGameId']==gid
  mins,secs=map(int,p['toi'].split(':'));toi=mins*60+secs;assert 0<=secs<60 and toi>0 and r['games_played']==1 and s['appearance']=='positive_official_TOI';identity.add(sid)
  comparisons={'toi_per_game':(r['toi_per_game'],toi),**{a:(r[a],p[b]) for a,b in [('goals','goals'),('assists','assists'),('shots','sog'),('hits','hits'),('blocked_shots','blockedShots')]}}
  for field,(wgo,official) in comparisons.items():
   v=s['TOI'] if field=='toi_per_game' else s['counts'][field];assert v=={'wgo':wgo,'official':official,'state':'match' if wgo==official else 'mismatch'}
   if wgo!=official:
    (toi_diff if field=='toi_per_game' else count_diff).add(sid)
    fielddiff.append({'source_id':sid,'player_id':r['player_id'],'player_name':r['player_name'],'game_id':gid,'date':r['date'],'field':field,'wgo_value':wgo,'official_value':official,'official_captured_at':evidence[str(gid)]['retrievedAtUTC'],'wgo_captured_at':raw['capturedAtUTC'],'resolution':'unresolved source-vintage discrepancy; no repair or preferred value inferred'})
  if r['toi_per_game']==toi:
   assert s['state']=='identity_team_exposure_qualified' and s['reasons']==[]
   if r['shots']==0:zeroshots+=1
  else:assert s['state']=='held' and s['reasons']==['positive_exact_TOI_not_established']
  if sid not in toi_diff|count_diff:matched.add(sid)
  if p['assists']==0:
   assert s['PPP']=={'wgo':r['pp_points'],'official':p['powerPlayGoals'],'state':'match'} and r['pp_points']==p['powerPlayGoals'];PPP['match']+=1
  else:assert s['PPP']=={'wgo':r['pp_points'],'official':None,'state':'unknown_PP_assists_not_supplied'};PPP['unknown_PP_assists_not_supplied']+=1
 key=lambda r:(r['source_id'],r['field'])
 assert sorted(fielddiff,key=key)==sorted(read(R/'DISCREPANCIES.json'),key=key)
 csvrows=list(csv.DictReader(io.StringIO((R/'DISCREPANCIES.csv').read_text())));assert sorted([{k:str(v) for k,v in r.items()} for r in fielddiff],key=lambda r:(int(r['source_id']),r['field']))==sorted(csvrows,key=lambda r:(int(r['source_id']),r['field']))
 oldfinal={r['sourceId'] for r in oldrows if r['finalityEstablished']};assert oldfinal<=identity and len(oldfinal)==657
 summary=read(R/'SUMMARY.json');diff=read(R/'DISCREPANCY-SUMMARY.json');assert summary['rows']==len(ids) and summary['rawBoxFinalityRows']==len(identity) and summary['additionalFinalityRows']==len(identity-oldfinal)
 assert diff['missingBoxGames']==sorted(games-set(boxes)) and diff['missingBoxRowsByDate']==dict(missingdates)
 assert diff['differentCountFields']==dict(collections.Counter(d['field'] for d in fielddiff))
 assert diff['differentCountingRows']==len(count_diff) and diff['differentTOIOrCountingRows']==len(toi_diff|count_diff) and diff['fullyMatchingIdentityExposureAndFiveCountsRows']==len(matched)
 assert diff['differentCountingPlayers']==len({source[i]['player_id'] for i in count_diff}) and diff['differentCountingGames']==len({source[i]['game_id'] for i in count_diff})
 deltas=collections.Counter(str(d['wgo_value']-d['official_value']) for d in fielddiff if d['field']=='toi_per_game');assert diff['TOIDeltaWGOminusOfficial']==dict(deltas)
 assert summary['PPPStates']==dict(PPP) and summary['zeroShotSourceRowsQualified']==zeroshots
 result.update({'sourceRows':len(ids),'targetGames':len(games),'authenticatedBodies':len(boxes),'bodyBytes':total,'identityFinalityTeam':len(identity),'exposureMatched':len(identity-toi_diff),'fullyMatchedFiveCountsAndExposure':len(matched),'missingBoxRows':len(missing),'missingBoxGames':len(games-set(boxes)),'TOIDifferenceRows':len(toi_diff),'countDifferenceRows':len(count_diff),'TOIAndCountOverlapRows':len(toi_diff&count_diff),'uniqueDifferenceRows':len(toi_diff|count_diff),'discrepancyFields':len(fielddiff),'countFields':dict(collections.Counter(d['field'] for d in fielddiff)),'PPP':dict(PPP),'zeroShotSourceRowsExposureQualified':zeroshots,'previousFinalityRowsReconfirmed':len(oldfinal),'additionalFinalityRows':len(identity-oldfinal),'missingByDate':dict(missingdates),'CSVMatchesJSONAndRawEvidence':True,'noSourceRowDropped':len(matched)+len(toi_diff|count_diff)+len(missing)==len(ids),'currentCaptureAndBoxRevisionsUnadjudicated':True,'providerRequests':0,'holdoutReads':0})
finally:
 assert read(lock/'owner.json')==owner;lock.rename(O/'heavy-lock-released')
(O/'RESULTS.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))
