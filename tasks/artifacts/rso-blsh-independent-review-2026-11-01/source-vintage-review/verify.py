from pathlib import Path
import collections,csv,datetime as dt,hashlib,io,json,math,os,subprocess,sys,urllib.parse
B=Path('/Users/tim/Documents/Codex/2026-10-27/task-3');R=B/'source-vintage-20261101-01';O=Path('/Users/tim/Code/fhfhockey.com/tasks/artifacts/rso-blsh-independent-review-2026-11-01/source-vintage-review')
read=lambda p:json.loads(p.read_text());sha=lambda b:hashlib.sha256(b).hexdigest();stamp=lambda s:dt.datetime.fromisoformat(s.replace('Z','+00:00'))
lock=Path('/tmp/fhfh-heavy.lock')
try:lock.mkdir()
except FileExistsError:print('BLOCKED_SHARED_HEAVY_SLOT');sys.exit(2)
owner={'owner':'codex-independent-source-vintage-review','pid':os.getpid()};(lock/'owner.json').write_text(json.dumps(owner));result={}
try:
 c=read(R/'CONTRACT.json');f=read(R/'FINAL-RECEIPT.json')
 for p,h in {**c['inputPins'],**read(R/'ANALYSIS-PINS.json')}.items():assert sha(Path(p).read_bytes())==h,p
 for p,h in f['files'].items():
  b=(R/p).read_bytes();assert sha(b)==h['sha256'] and len(b)==h['bytes'],p
 for p in read(R/'SHARED-SOURCE-UNCHANGED.json'):assert sha(Path(p['path']).read_bytes())==p['expected']
 result['allInputAnalysisFinalAndSharedPinsMatch']=True
 run=subprocess.run([sys.executable,'-B','-m','unittest','-v','test_compare','test_analyze'],cwd=R,capture_output=True,text=True,timeout=30,env={**os.environ,'PYTHONDONTWRITEBYTECODE':'1'});(O/'tests.log').write_text(run.stdout+run.stderr);assert run.returncode==0;result['testsPassed']=13
 oldraw=read(B/'current-research-overlay-01/RAW-wgo.json');newraw=read(B/'current-refresh-20261029-01/RAW-wgo.json');old={r['id']:r for r in oldraw['records']};new={r['id']:r for r in newraw['records']}
 discrepancies=read(B/'current-box-provenance-20261101-01/DISCREPANCIES.json');expected={(r['source_id'],r['field']) for r in discrepancies};assert len(expected)==len(discrepancies)==103 and len({i for i,_ in expected})==99
 fields=read(R/'FIELD-CLASSIFICATION.json');rows=read(R/'ROW-CLASSIFICATION.json');offline=read(R/'OFFLINE-FIELD-COMPARISON.json');offmap={(r['source_id'],r['field']):r for r in offline};manifest={r['source_id']:r for r in read(B/'row-repair-01/REPAIR-MANIFEST.json')['rows']}
 assert len(fields)==len(offline)==103 and {(r['source_id'],r['field']) for r in fields}==set(offmap)==expected
 assert len(rows)==99 and {r['source_id'] for r in rows}=={i for i,_ in expected}==set(c['cohort']['sourceIds'])
 bounds=c['liveBounds'];plan=bounds['requests'];correction=read(R/'CORRECTED-TRANSPORT.json');live=R/'live-02';prior=read(R/'live-01/RESULT.json');current=read(live/'RESULT.json')
 assert sha((R/'live-01/RESULT.json').read_bytes())==correction['priorResultSHA256'] and prior['dispatched']==1 and prior['verified']==prior['bytes']==prior['retries']==0 and prior['ownLockReleased']
 assert 'CERTIFICATE_VERIFY_FAILED' in prior['stopped']['reason'] and not list((R/'live-01').glob('*.body.json')) and len(list((R/'live-01').glob('*.dispatch.json')))==1 and len(list((R/'live-01').glob('*.error.json')))==1
 assert sha(Path(correction['CAFile']).read_bytes())==correction['CA_SHA256']
 bodies={};receipts={};starts=[];ends=[];bytecount=0;kindcounts=collections.Counter()
 assert len(plan)==len({(i['gameId'],i['kind']) for i in plan})==58
 assert stamp(c['at'])<stamp(correction['atUTC'])
 for index,item in enumerate(plan,1):
  gid=item['gameId'];kind=item['kind'];pair=(gid,kind);url=urllib.parse.urlparse(item['url']);q=urllib.parse.parse_qs(url.query)
  if kind=='boxscore':assert item['url']==f'https://api-web.nhle.com/v1/gamecenter/{gid}/boxscore'
  else:
   assert url.scheme=='https' and url.netloc=='api.nhle.com' and url.path==f'/stats/rest/en/skater/{kind}' and kind in ['summary','realtime']
   assert q['isAggregate']==['false'] and q['isGame']==['true'] and q['start']==['0'] and q['limit']==['100'] and q['cayenneExp']==[f'gameId={gid} and gameTypeId=2'] and q['factCayenneExp']==['gamesPlayed>=1']
  key=f'{index:03d}-{gid}-{kind}';bp=live/(key+'.body.json');rp=live/(key+'.receipt.json');body=bp.read_bytes();receipt=read(rp);dispatch=read(live/(key+'.dispatch.json'));payload=json.loads(body)
  assert receipt['item']==dispatch['item']==item and receipt['url']==item['url'] and receipt['state']=='verified' and receipt['httpStatus']==200 and receipt['TLSVerified'] is True and receipt['CA_SHA256']==correction['CA_SHA256']
  assert receipt['sha256']==sha(body) and receipt['bytes']==len(body)<=bounds['maxBodyBytes'];bytecount+=len(body)
  start=stamp(dispatch['at']);end=stamp(receipt['at']);assert start<=end and start>stamp(correction['atUTC'])>stamp(newraw['capturedAtUTC'])
  if ends:assert ends[-1]<=start
  starts.append(start);ends.append(end);kindcounts[kind]+=1
  if kind=='boxscore':assert (payload['id'],payload['gameDate'],payload['season'],payload['gameType'])==(gid,item['date'],20262027,2) and payload['gameState'] in ['OFF','FINAL']
  else:
   data=payload['data'];assert type(payload['total']) is int and payload['total']==len(data) and 1<=len(data)<=100 and len({x['playerId'] for x in data})==len(data)
   for x in data:assert (x['gameId'],x['gameDate'],x['gamesPlayed'])==(gid,item['date'],1) and type(x['gamesPlayed']) is int and type(x['playerId']) is int and x['playerId']>0
  bodies[pair]=payload;receipts[pair]={'url':item['url'],'at':receipt['at'],'bodySHA256':sha(body),'receiptSHA256':sha(rp.read_bytes()),'bodyPath':str(bp),'receiptPath':str(rp)}
 minstart=min((b-a).total_seconds() for a,b in zip(starts,starts[1:]));assert minstart>=2.999
 assert current['dispatched']==current['verified']==58 and current['bytes']==bytecount==1024786 and bytecount<=bounds['maxTotalBodyBytes'] and current['stopped'] is None and current['retries']==0 and current['cumulativeDispatchAttempts']==59 and current['ownLockReleased']
 assert kindcounts=={'boxscore':25,'summary':21,'realtime':12}
 oldevidence=read(B/'current-box-provenance-20261101-01/BOX-EVIDENCE.json');oldboxes={}
 for gid in {r['game_id'] for r in fields}:
  e=oldevidence[str(gid)];body=Path(e['bodyPath']).read_bytes();rr=Path(e['receiptPath']).read_bytes();receipt=json.loads(rr);box=json.loads(body)
  assert sha(body)==e['bodySHA256']==receipt['sha256'] and sha(rr)==e['receiptSHA256'];assert receipt['status']=='success' and receipt['httpStatus']==200 and receipt['TLSVerified'] is True and receipt['bytes']==len(body)
  assert receipt['url']==e['url']==f'https://api-web.nhle.com/v1/gamecenter/{gid}/boxscore' and stamp(receipt['retrievedAtUTC'])<stamp(newraw['capturedAtUTC'])<stamp(receipts[(gid,'boxscore')]['at']);oldboxes[gid]=box
 mapfield={'toi_per_game':('summary','timeOnIcePerGame','toi'),'goals':('summary','goals','goals'),'assists':('summary','assists','assists'),'shots':('summary','shots','sog'),'hits':('realtime','hits','hits'),'blocked_shots':('realtime','blockedShots','blockedShots')}
 def lookup(box,row):
  seen=set();found=[]
  for side in ['homeTeam','awayTeam']:
   for group in ['forwards','defense']:
    assert isinstance(box['playerByGameStats'][side][group],list)
    for x in box['playerByGameStats'][side][group]:
     assert type(x['playerId']) is int and x['playerId']>0 and x['playerId'] not in seen;seen.add(x['playerId'])
     if x['playerId']==row['player_id']:found.append((x,side))
  assert len(found)==1;x,side=found[0];assert box[side]['abbrev']==row['team_abbrev']
  assert (box['id'],box['gameDate'],box['season'],box['gameType'])==(row['game_id'],row['date'],row['season_id'],2) and box['gameState'] in ['OFF','FINAL']
  m,s=map(int,x['toi'].split(':'));assert m*60+s>0;return x,side,m*60+s
 manifestpairs=0
 for r in fields:
  sid=r['source_id'];field=r['field'];a=old[sid];b=new[sid];gid=b['game_id'];off=offmap[(sid,field)];kind,native,boxkey=mapfield[field]
  assert all(a[k]==b[k] for k in ['id','player_id','game_id','season_id','date','team_abbrev']) and b['games_played']==1
  assert a[field]==b[field]==r['priorWGOValue']==r['wgo_value'] and r['priorWGOCaptureUpperBoundUTC']==oldraw['capturedAtUTC'] and r['wgo_captured_at']==newraw['capturedAtUTC']
  assert r['WGOComparisonState']=='stored_value_unchanged_between_captures'
  for k,v in off.items():assert r[k]==v
  orig=manifest.get(sid);has=bool(orig and field in orig['source_projection']);assert r['originalManifestHasField']==has
  if has:assert r['originalManifestValue']==orig['source_projection'][field]==b[field];manifestpairs+=1
  nb=bodies[(gid,'boxscore')];np,side,ntoi=lookup(nb,b);op,_,otoi=lookup(oldboxes[gid],b)
  nv=ntoi if field=='toi_per_game' else np[boxkey];ov=otoi if field=='toi_per_game' else op[boxkey]
  report=bodies[(gid,kind)];xs=[x for x in report['data'] if x['playerId']==b['player_id']];assert len(xs)==1;x=xs[0]
  assert (x['gameId'],x['gameDate'],x['teamAbbrev'],x['gamesPlayed'])==(gid,b['date'],b['team_abbrev'],1)
  opp=nb['awayTeam' if side=='homeTeam' else 'homeTeam']['abbrev']
  if 'opponentTeamAbbrev' in x:assert x['opponentTeamAbbrev']==opp
  if 'homeRoad' in x:assert x['homeRoad']==('H' if side=='homeTeam' else 'R')
  rv=x[native];assert type(rv) in [int,float] and math.isfinite(rv) and rv>=0 and (field=='toi_per_game' or rv==int(rv))
  assert nv==ov==rv and nv!=b[field] and r['official_value']==ov and r['newBoxValue']==r['newBoxRawValue']==nv and r['currentReportValue']==rv and r['currentReportKind']==kind
  assert r['sourceVintageState']=='current_products_agree_box_unchanged_saved_WGO_differs' and r['joinState']=='qualified' and r['reportJoinState']=='identity_team_GP_qualified'
  assert r['newBoxEvidence']==receipts[(gid,'boxscore')] and r['currentReportEvidence']==receipts[(gid,kind)] and r['originalBoxEvidence']==oldevidence[str(gid)]
  for flag in ['sameBoxEndpointRevisionObserved','originalCutoffTruthResolved','ingestionFaultEstablished','repairProposed','sourcePublicationTimeKnown']:assert r[flag] is False
 assert manifestpairs==6
 byid=collections.defaultdict(list)
 for r in fields:byid[r['source_id']].append(r)
 for r in rows:
  group=byid[r['source_id']];assert r['fields']==[g['field'] for g in group] and r['states']=={'current_products_agree_box_unchanged_saved_WGO_differs':len(group)} and r['hasUnresolvedDifference'] and not r['mixedFieldStates']
 csvrows=list(csv.DictReader(io.StringIO((R/'FIELD-CLASSIFICATION.csv').read_text())))
 assert len(csvrows)==103
 for a,b in zip(csvrows,fields):assert all(a[k]==str(b[k]) for k in a)
 result.update({'fieldPairs':len(fields),'rows':len(rows),'games':len(oldboxes),'fieldsByType':dict(collections.Counter(r['field'] for r in fields)),'rowsByDate':dict(collections.Counter(r['date'] for r in rows)),'allOldAndNewBoxAndNativeReportValuesEqual':True,'allSavedWGOValuesDifferentAndStableAcrossTwoCaptures':True,'all103JoinsQualified':True,'unchangedManifestFieldPairs':manifestpairs,'oldWGOCapturedAt':oldraw['capturedAtUTC'],'newWGOCapturedAt':newraw['capturedAtUTC'],'rawNewBodiesVerified':len(bodies),'newBodyBytes':bytecount,'newResponseKinds':dict(kindcounts),'minimumRecordedDispatchIntervalSeconds':minstart,'newObservationRange':[min(e['at'] for e in receipts.values()),max(e['at'] for e in receipts.values())],'priorFailedTLSAttempts':1,'totalRetainedDispatchAttempts':59,'CSVAndRowsReconcile':True,'reviewProviderRequests':0,'reviewHoldoutReads':0,'causeAndOriginalCutoffTruthUnresolved':True})
finally:
 assert read(lock/'owner.json')==owner;lock.rename(O/'heavy-lock-released')
(O/'RESULTS.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))
