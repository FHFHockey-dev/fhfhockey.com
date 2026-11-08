from pathlib import Path
from collections import Counter,defaultdict
from datetime import datetime
import ast,gzip,hashlib,itertools,json,math
P=Path('/Users/tim/Documents/Codex/2026-10-27/task-3/ppp-census-bounds-20261101-01');O=Path(__file__).resolve().parent
sha=lambda b:hashlib.sha256(b).hexdigest();load=lambda p:json.loads(Path(p).read_text());pins={}
def pinned(path,pin):
 b=Path(path).read_bytes();assert sha(b)==pin['sha256'],path
 if 'bytes' in pin:assert len(b)==pin['bytes'],path
 pins[str(path)]={'sha256':sha(b),'bytes':len(b)};return b
c=load(P/'CONTRACT.json');assert sha((P/'CONTRACT.json').read_bytes())==(P/'CONTRACT.sha256').read_text().strip()
for path,pin in c['inputs'].items():pinned(path,pin)
for path,h in c['sharedSourcePins'].items():pinned(path,{'sha256':h})
for path,h in load(P/'FINAL-RECEIPT.json')['artifacts'].items():pinned(P/path,{'sha256':h})
receipt=load(P/'replay-01/RECEIPT.json');assert receipt['contractSHA256']==sha((P/'CONTRACT.json').read_bytes());assert datetime.fromisoformat(receipt['atUTC'])>datetime.fromisoformat(c['frozenBeforeReplayUTC']);assert receipt['automaticScoringAdmissionPermitted'] is False and receipt['censusValuesAreDerivedNotDirectObservations'] is True
for path,pin in receipt['outputs'].items():pinned(P/'replay-01'/path,pin)
get=lambda suffix:load(next(path for path in c['inputs'] if path.endswith(suffix)))
priorrows=get('/current-box-provenance-20261101-01/ROW-QUALIFICATION.json');prior={r['sourceId']:r for r in priorrows};direct=get('/ppp-cached-check-01/ROWS.json');assert len(direct)==len({r['sourceId'] for r in direct})==645
links=get('/baseline-01/BASELINE-ROW-LINKS.json');assert len(links)==150;assert sum(r['PPPIndependentOfficialCheck'] for r in links)==101
old=get('/replay-02/BASELINE.json')['originalRecordedRows'];old+= [r for g in get('/replay-02/BASELINES.json') for r in g['originalRows']];raw={r['id']:r for r in old};assert len(old)==len(raw)==150
targets={}
for r in direct:
 p=prior[r['sourceId']];cohort='current_direct_validation' if r['state']=='match' else 'current_unresolved';assert r['state'] in ['match','unknown'];assert r['wgoPPP']==p['PPP']['wgo'];assert r['priorCountFlags']=={k:v['state'] for k,v in p['counts'].items()}
 targets[(20262027,p['sourceId'])]={'sourceId':p['sourceId'],'playerId':p['playerId'],'gameId':p['gameId'],'season':20262027,'date':p['date'],'team':p.get('officialTeam'),'seconds':p['TOI']['official'] if p['TOI'] else None,'priorQualified':p['state']=='identity_team_exposure_qualified' and p['gameFinality']=='final','cohort':cohort,'wgoPPP':r['wgoPPP'],'directPPP':r['officialPPP'],'directEvidence':r['evidence'] if cohort=='current_direct_validation' else None,'priorCountFlags':r['priorCountFlags'],'sourceRowSHA256':p['sourceRowSHA256']}
for l in links:
 if l['PPPIndependentOfficialCheck']:continue
 p=raw[l['sourceId']];assert p['season_id']==20222023;assert sha(json.dumps(p,sort_keys=True,separators=(',',':')).encode())==l['originalRowSHA256']
 targets[(20222023,l['sourceId'])]={'sourceId':l['sourceId'],'playerId':l['playerId'],'gameId':l['derivedGameId'],'season':20222023,'date':l['date'],'team':l['derivedTeam'],'seconds':p['toi_per_game'],'priorQualified':l['calendarStatus']=='qualified' and l['officialOverlapStatus']=='matched','cohort':'historical_reference_unresolved','wgoPPP':p['pp_points'],'directPPP':None,'directEvidence':None,'priorCountFlags':{'conflictingFields':l.get('conflictingFields',[])},'sourceRowSHA256':l['originalRowSHA256']}
currentmeta=get('/BOX-EVIDENCE.json');histmeta={m['game_id']:m for m in get('/baseline-01/OFFICIAL-RECEIPTS.json')};ev=load(P/'replay-01/EVIDENCE.json');boxes={};times=defaultdict(list);decompressed=0
for key,e in ev.items():
 season,gid=ast.literal_eval(key);assert season in [20222023,20262027];meta=currentmeta[str(gid)] if season==20262027 else histmeta[gid];hist=season==20222023
 rp=Path(meta['receipt_path' if hist else 'receiptPath']);assert str(rp)==e['receiptPath'];rb=pinned(rp,{'sha256':meta['receipt_sha256' if hist else 'receiptSHA256']});rr=json.loads(rb);assert sha(rb)==e['receiptSHA256']
 bp=rp.with_suffix('.gz') if hist else Path(meta['bodyPath']);assert str(bp)==e['bodyPath'];stored=bp.read_bytes();assert len(stored)<=262144;body=gzip.decompress(stored) if hist else stored;assert len(body)<=262144
 assert len(body)==rr['bytes']==e['bodyBytes'];assert sha(body)==rr['sha256']==meta['body_sha256' if hist else 'bodySHA256']==e['bodySHA256'];pins[str(bp)]={'sha256':sha(stored),'bytes':len(stored)}
 url=f'https://api-web.nhle.com/v1/gamecenter/{gid}/boxscore';assert rr['url']==e['URL']==url and rr['status']=='success' and rr['http_status' if hist else 'httpStatus']==200 and rr['TLS_verified' if hist else 'TLSVerified'] is True
 at=rr['completed_at_utc' if hist else 'retrievedAtUTC'];assert at==meta['retrievedAtUTC']==e['retrievedAtUTC'];assert datetime.fromisoformat(at.replace('Z','+00:00')).tzinfo is not None;assert e['sourcePublicationUTC'] is None
 b=json.loads(body);dates={t['date'] for t in targets.values() if t['gameId']==gid and t['season']==season};assert len(dates)==1;assert (b['id'],b['season'],b['gameType'],b['gameDate'])==(gid,season,2,next(iter(dates)));boxes[key]=b;times[season].append(at);decompressed+=len(body)
assert len(boxes)==172 and decompressed==2293726
rows=load(P/'replay-01/ROWS.json');assert len(rows)==len({(r['season'],r['sourceId']) for r in rows})==len(targets)==694
counts=defaultdict(Counter);reasons=defaultdict(Counter);zeros=Counter();allocations=0;newother=0
for r in rows:
 t=targets[(r['season'],r['sourceId'])];assert all(r[k]==v for k,v in t.items());b=boxes[r['evidenceKey']];assert r['evidenceKey']==str((r['season'],r['gameId']));hold=None
 if not t['priorQualified']:hold='prior_identity_exposure_or_finality_held'
 else:
  assert b['gameState'] in ['OFF','FINAL'];teams={};ids=[];census_bad=False
  for side in ['homeTeam','awayTeam']:
   team=b[side];stats=b['playerByGameStats'][side];assert isinstance(stats['forwards'],list) and isinstance(stats['defense'],list);players=stats['forwards']+stats['defense'];assert players;assert team['abbrev'] not in teams
   for p in players:
    assert type(p['playerId']) is int and p['playerId']>0;ids.append(p['playerId']);assert all(type(p[k]) is int and p[k]>=0 for k in ['goals','assists','powerPlayGoals']);assert p['powerPlayGoals']<=p['goals']
   goals=sum(p['goals'] for p in players);pp=sum(p['powerPlayGoals'] for p in players)
   if goals!=team['score']:census_bad=True
   assert all(p['assists']<=goals-p['goals'] for p in players) and sum(p['assists'] for p in players)<=2*goals
   teams[team['abbrev']]=(players,goals,pp,team['id'])
  assert len(ids)==len(set(ids)) and len({x[3] for x in teams.values()})==2
  if census_bad:hold='goal_census_score_mismatch_no_shootout_or_goalie_adjustment'
  else:
   players,G,Pg,_=teams[t['team']];p=next(p for p in players if p['playerId']==t['playerId']);m,s=map(int,p['toi'].split(':'));assert 0<=s<60 and m*60+s==t['seconds']>0
   # Enumerate actual teammate-goal subsets; do not use the qualifier's bound formula to produce expected values.
   teammate=[]
   for teammate_player in players:
    if teammate_player['playerId']==t['playerId']:continue
    teammate += [1]*teammate_player['powerPlayGoals']+[0]*(teammate_player['goals']-teammate_player['powerPlayGoals'])
   A=p['assists'];possibilities={p['powerPlayGoals']+sum(teammate[i] for i in choice) for choice in itertools.combinations(range(len(teammate)),A)};assert possibilities
   low,high=min(possibilities),max(possibilities);assert (r['lowerPPP'],r['upperPPP'])==(low,high);assert possibilities==set(range(low,high+1));assert r['method']=='official_team_goal_census_integer_bounds'
   operands={'playerGoals':p['goals'],'playerPPGoals':p['powerPlayGoals'],'playerAssists':A,'teamGoals':G,'teamPPGoals':Pg,'teammatePPGoals':sum(teammate),'teammateNonPPGoals':len(teammate)-sum(teammate)};assert operands==r['operands'];allocations+=1
   if len(possibilities)==1:
    assert r['state']=='uniquely_implied' and r['impliedPPP']==low==t['wgoPPP'];assert r['wgoComparison']=='matches_unique_value';zeros[r['cohort']]+=low==0
    if r['cohort']=='current_unresolved':newother+='mismatch' in r['priorCountFlags'].values()
   else:assert r['state']=='ambiguous' and r['impliedPPP'] is None and r['wgoComparison']=='within_ambiguous_range_not_verified';assert t['wgoPPP'] in possibilities
   if r['cohort']=='current_direct_validation':assert t['directPPP'] in possibilities;assert r['directComparison']==r['wgoComparison']
 if hold:assert r['state']=='unknown' and r['reason']==hold and r['lowerPPP'] is None and r['upperPPP'] is None and r['impliedPPP'] is None and r['wgoComparison']=='unknown_no_qualified_bounds'
 counts[r['cohort']][r['state']]+=1
 if r['reason']:reasons[r['cohort']][r['reason']]+=1
assert allocations==631 and newother==0
summary=load(P/'replay-01/SUMMARY.json')
for cohort,v in counts.items():assert dict(v)==summary['cohorts'][cohort]['states'];assert dict(reasons[cohort])==summary['cohorts'][cohort]['reasons'];assert zeros[cohort]==summary['cohorts'][cohort]['impliedZero']
assert counts['current_unresolved']==Counter(uniquely_implied=188,ambiguous=244,unknown=34);assert counts['historical_reference_unresolved']==Counter(uniquely_implied=22,ambiguous=25,unknown=2);assert counts['current_direct_validation']==Counter(uniquely_implied=55,ambiguous=97,unknown=27)
remaining=load(P/'REMAINING-EVIDENCE.json')['rows'];want={(r['season'],r['sourceId']):r for r in rows if r['cohort']!='current_direct_validation' and r['state']!='uniquely_implied'};assert len(remaining)==len(want)==305;assert len({(r['season'],r['sourceId']) for r in remaining})==305
for row in remaining:assert all(want[(row['season'],row['sourceId'])][k]==v for k,v in row.items())
currentdirect={r['sourceId'] for r in rows if r['cohort']=='current_direct_validation'};newcurrent={r['sourceId'] for r in rows if r['cohort']=='current_unresolved' and r['state']=='uniquely_implied'};unresolved={r['sourceId'] for r in rows if r['cohort']=='current_unresolved' and r['state']!='uniquely_implied'};assert not currentdirect&newcurrent and not newcurrent&unresolved and not currentdirect&unresolved;assert len(currentdirect|newcurrent|unresolved)==645 and len(unresolved)==278
assert sum('no_pinned_cached_official_box' in r['reasons'] for r in priorrows)==580
coverage=load(P/'COMBINED-COVERAGE.json');assert coverage=={'currentOriginalPPPUnknown':645,'earlierDirectSummaryMatches':179,'additionalCensusUniqueMatches':188,'remainingCurrent':278,'remainingCurrentAmbiguous':244,'remainingCurrentHeld':34,'baselineOriginalUnknown':49,'additionalBaselineCensusUniqueMatches':22,'remainingBaseline':27,'baselinePreviouslyCheckable':101,'baselineNowCheckableInThreeFixedReferences':123,'fullCurrentRowsWithoutPinnedOfficialBoxStillOutsideThisCohort':580,'countsMustNotBeTreatedAsSourceAccuracyRates':True}
# No earlier direct match is discarded by the census's more conservative holds.
assert sum('mismatch' in r['priorCountFlags'].values() for r in rows if r['cohort']=='current_direct_validation')==15
example=next(r for r in rows if r['sourceId']==3077311);assert (example['playerId'],example['gameId'],example['impliedPPP'])==(8478398,2022020588,1)
assert all(sha(Path(path).read_bytes())==pin['sha256'] for path,pin in pins.items())
result={'pinsVerified':len(pins),'sharedPinsUnchanged':10,'authenticatedBodies':172,'decompressedBytes':decompressed,'allRowsReconciled':694,'empiricalAllocationSetsEnumerated':allocations,'cohortStates':counts,'derivedZerosByCohort':zeros,'additionalNewOtherCountDiscrepancies':newother,'combinedCurrentPartition':[179,188,278],'historicalPartition':[101,22,27],'remainingInventoryRows':305,'receiptRanges':{str(s):[min(t),max(t)] for s,t in times.items()},'currentDirectMatchesWithOtherDiscrepancies':15,'currentNoPinnedBoxOutsideCohort':580,'historicalConnorExampleVerified':True,'holdoutAccessed':False,'providerRequests':0,'sourceEdits':0}
(O/'VERIFICATION.json').write_text(json.dumps(result,indent=2)+'\n');(O/'PINS.json').write_text(json.dumps(pins,indent=2)+'\n');print(json.dumps(result,indent=2))
