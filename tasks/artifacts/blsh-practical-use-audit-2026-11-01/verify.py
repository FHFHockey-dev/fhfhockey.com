"""Independent arithmetic/accounting reconciliation; reads only named retained artifacts."""
from pathlib import Path
from collections import Counter,defaultdict
from datetime import date,datetime
import hashlib,json,math,os,sys,itertools
sys.dont_write_bytecode=True
P=Path('/Users/tim/Documents/Codex/2026-10-27/task-3/practical-use-comparison-20261101-01');O=Path(__file__).resolve().parent
sha=lambda b:hashlib.sha256(b).hexdigest()
load=lambda p:json.loads(Path(p).read_text())
digest=lambda x:sha(json.dumps(x,separators=(',',':')).encode())
close=lambda x,y:math.isclose(x,y,rel_tol=1e-10,abs_tol=1e-10)
finite=lambda x:type(x) in (int,float) and math.isfinite(x)
readpins={}
def pinned(path,expected):
 b=Path(path).read_bytes();assert sha(b)==expected['sha256'],path
 if 'bytes' in expected:assert len(b)==expected['bytes'],path
 readpins[str(path)]={'sha256':sha(b),'bytes':len(b)};return b
C=load(P/'CONTRACT.json');Q=load(P/'ppp-cached-check-01/CONTRACT.json')
for d in [P,P/'ppp-cached-check-01']:
 assert sha((d/'CONTRACT.json').read_bytes())==(d/'CONTRACT.sha256').read_text().strip()
for c in [C,Q]:
 for path,pin in c['inputs'].items():pinned(path,pin)
for path,h in C['sharedSourcePins'].items():pinned(path,{'sha256':h})
for name,h in load(P/'FINAL-RECEIPT.json')['artifacts'].items():pinned(P/name,{'sha256':h})
for d in [P/'comparison-02',P/'ppp-cached-check-01']:
 receipt=load(d/'RECEIPT.json')
 for path,pin in receipt['outputs'].items():pinned(d/path,pin)
 assert receipt['contractSHA256']==sha((d.parent/'CONTRACT.json').read_bytes()) if d.name=='comparison-02' else receipt['contractSHA256']==sha((d/'CONTRACT.json').read_bytes())
 assert datetime.fromisoformat(receipt['atUTC'])>datetime.fromisoformat(C['frozenBeforeComparisonUTC'] if d.name=='comparison-02' else Q['frozenUTC'])
paths={Path(x).name:Path(x) for x in C['inputs']};profiles=[json.loads(s) for s in paths['PLAYER-EVIDENCE.jsonl'].read_text().splitlines()];fits={x['playerId']:x for x in (json.loads(s) for s in paths['FITTED-PARAMETERS.jsonl'].read_text().splitlines())};dep=load(paths['FIT-DEPENDENCIES.json'])
assert len(profiles)==len(fits)==824
windowdates=[];refdates=[];supportfit=0;prodfit=0;bridge=0;index=0
ind={};states={a:Counter() for a in C['arms']};direction={a:Counter() for a in C['arms']}
for p in profiles:
 pid=p['playerId'];w=p['window'];ref=p['reference'];prod=p['production'];score=p['score'];first=min(w['dates']);seconds=w['seconds'];age=(date.fromisoformat(C['eventThrough'])-date.fromisoformat(max(w['dates']))).days
 assert p['originExclusive']==C['originExclusive'];assert all('2023-07-01'<=d<C['originExclusive'] for d in w['dates']);assert all('2022-07-01'<=d<'2023-07-01' and d<first for d in ref['dates']);assert not set(w['sourceIds'])&set(ref['sourceIds']);assert len(w['dates'])==len(set(w['sourceIds']))==w['appearances'];assert len(ref['dates'])==len(ref['sourceIds']);assert age==w['lastDateAgeDays'];assert close(seconds/60,w['minutes']);windowdates.extend(w['dates']);refdates.extend(ref['dates'])
 f=fits[pid];assert f['cutoff']==first
 if f['production']:
  eligible=[d for d in dep['donors'] if d['player_id']!=pid and d['position']==p['position']];assert all('2022-07-01'<=d['start']<=d['end']<'2023-07-01' and d['end']<first for d in eligible);assert f['production']['targetExcluded'] is True;assert digest([d['player_id'] for d in eligible])==f['production']['donorIdentitySHA256'];assert len(eligible)==f['production']['donors'];prodfit+=1
 if f['support']:
  m=f['support'];assert m['targetId']==pid and m['cutoff']==first and m['priorLastDate']<first and str(pid) not in m['playerWeightSums'];groups=defaultdict(list)
  for b in dep['trainingBlocks']:
   assert all('2022-07-01'<=d<'2023-07-01' for d in b['dates'])
   if b['playerId']==pid or b['position']!=p['position'] or max(b['dates'])>=first:continue
   if len({t for t in b.get('teams',[]) if t is not None})>1 or any(q is not None and q!=p['position'] for q in b.get('positions',[])):continue
   groups[b['playerId']].append(b)
  used=[(i,bb) for i,bb in sorted(groups.items()) if len(bb)>=2];ids=[sid for _,bb in used for b in bb for sid in b['sourceIds']]
  assert len(ids)==len(set(ids))==m['sourceIdsCount'];assert digest(ids)==m['sourceIdsSHA256'];assert set(map(str,(i for i,_ in used)))==set(m['playerWeightSums']);assert close(sum(m['playerWeightSums'].values()),1);supportfit+=1
 native=next(n for n in p['native'] if n['track']=='fantasy_points');actual=prod['raw_observed'][0];expected=prod['expected_totals'][0];fp60=(expected-actual)*3600/seconds
 assert close(fp60,native['baselineGapPer60']);assert close(actual,native['actualTotal']);assert close(expected,native['baselineExpectedAtObservedTOI']);assert close(expected,prod['reference_rate'][0]*seconds)
 v=prod['joint_gap_covariance'];weights=prod['weights'];sd=[math.sqrt(v[i][i]) for i in range(3)];den=sum(weights[i]*weights[j]*v[i][j]/sd[i]/sd[j] for i in range(3) for j in range(3));computed=sum(weights[i]/sd[i]*(prod['expected_totals'][i]-prod['raw_observed'][i]) for i in range(3))/math.sqrt(den);assert close(computed,prod['normalized_gap']);bridge+=1
 if score['value'] is not None:assert close(score['value'],100*score['normalizedGap']/(1+abs(score['normalizedGap'])));index+=1
 methods={}
 for arm,value in [('FP60',fp60),('production_only',computed),('BLSH',score['value'])]:
  side=None
  if not finite(value):state='unavailable'
  elif not finite(seconds) or seconds<=0:state='exposure_unknown_or_nonpositive'
  elif not 0<=age<=7:state='age_held'
  elif value==0:state='balanced'
  elif arm=='BLSH' and score['researchList'] not in ('BL','SH'):state='conflicting' if score['status']=='conflicting_baseline_and_support' else 'saved_withheld'
  else:state='directional';side='BL' if value>0 else 'SH'
  if arm=='BLSH' and side is not None:assert side==score['researchList']
  methods[arm]={'value':value,'side':side,'state':state};states[arm][state]+=1
  if side:direction[arm][side]+=1
 ind[pid]=methods
saved=load(P/'comparison-02/ALL-PROFILES.json');assert len(saved)==len(ind)
for row in saved:
 for a,v in ind[row['playerId']].items():
  orig=row['arms'][a];assert v['side']==orig['side'] and v['state']==orig['state'];assert v['value']==orig['value'] if v['value'] is None else close(v['value'],orig['value'])
def ranked(universe,a,s):return sorted((pid for pid in universe if ind[pid][a]['side']==s),key=lambda pid:(-abs(ind[pid][a]['value']),pid))[:20]
lists={a:{s:ranked(ind,a,s) for s in ('BL','SH')} for a in C['arms']};selection=load(P/'comparison-02/SELECTIONS.json');summary=load(P/'comparison-02/SUMMARY.json')
for a in lists:
 assert dict(states[a])==summary['states'][a];assert dict(direction[a])==summary['directionalCounts'][a]
 for s in ('BL','SH'):assert lists[a][s]==[x['playerId'] for x in selection[a][s]];assert [x['rank'] for x in selection[a][s]]==list(range(1,21))
overlaps={}
for a,b in itertools.combinations(lists,2):
 key=a+'_vs_'+b;overlaps[key]={}
 for s in ('BL','SH'):
  aa,bb=set(lists[a][s]),set(lists[b][s]);stored=summary['overlap'][key][s];assert stored['both']==len(aa&bb);assert stored['leftOnly']==sorted(aa-bb) and stored['rightOnly']==sorted(bb-aa);assert close(stored['jaccard'],len(aa&bb)/len(aa|bb));overlaps[key][s]=len(aa&bb)
common=[pid for pid,m in ind.items() if all(finite(v['value']) for v in m.values()) and m['FP60']['state'] not in ('age_held','exposure_unknown_or_nonpositive')];assert len(common)==summary['commonNumericUniverse']==629
commonoverlap={}
for s in ('BL','SH'):
 n=len(set(ranked(common,'FP60',s))&set(ranked(common,'BLSH',s)));assert n==summary['commonUniverseFP60vsBLSH'][s]['both'];commonoverlap[s]=n
seed=C['caseSelectionSeed'];key=load(P/'comparison-02/PRIVATE-CASE-KEY.json');cards=load(P/'comparison-02/BLINDED/CASES.json');responses=load(P/'comparison-02/BLINDED/RESPONSES.template.json');used=set();expectedkey=[]
for side in ('BL','SH'):
 a,b=set(lists['FP60'][side]),set(lists['BLSH'][side])
 for group,pool in [('both',a&b),('FP60_only',a-b),('BLSH_only',b-a)]:
  chosen=sorted(pool-used,key=lambda pid:sha(f'{seed}:{pid}'.encode()))[:2];assert len(chosen)==2;used.update(chosen)
  expectedkey.extend({'caseId':sha(f'{seed}:{pid}'.encode())[:12],'playerId':pid,'side':side,'group':group} for pid in chosen)
assert key==expectedkey;assert len(cards)==len(used)==12;assert set(x['caseId'] for x in cards)==set(x['caseId'] for x in key);assert responses['casePacketSHA256']==sha((P/'comparison-02/BLINDED/CASES.json').read_bytes());assert responses['reviewer'] is None and responses['priorExposure'] is None
assert all(all(v is None for k,v in x.items() if k!='caseId') for x in responses['cases'])
for card in cards:
 assert not {'playerId','side','group','combinedIndex','researchList','rank'}&card.keys()
 original=next(p for p in profiles if p['playerId']==next(k['playerId'] for k in key if k['caseId']==card['caseId']));assert card['FP']==next(n for n in original['native'] if n['track']=='fantasy_points')
# Cross-check every PPP result directly against original target rows and pinned report bodies.
rowpath=next(Path(x) for x in Q['inputs'] if x.endswith('/ROW-QUALIFICATION.json'));targets={r['sourceId']:r for r in load(rowpath) if r['PPP'] and r['PPP']['state']=='unknown_PP_assists_not_supplied'};assert len(targets)==645
reports={};evidence={};times=[]
for entry in Q['plan']:
 item=entry['item'];body=Path(entry['body']).read_bytes();receipt=load(entry['receipt']);doc=json.loads(body);rows=doc['data'];assert item['gameId'] not in reports;assert receipt['url']==item['url'] and receipt['item']==item;assert receipt['TLSVerified'] and receipt['httpStatus']==200 and receipt['state']=='verified';assert receipt['sha256']==sha(body) and receipt['bytes']==len(body);stamp=datetime.fromisoformat(receipt['at']);assert stamp>datetime.fromisoformat(Q['originalCaptureAsOf']);times.append(stamp.isoformat());assert doc['total']==len(rows)==len({x['playerId'] for x in rows}) and 0<len(rows)<=100;assert all(x['gameId']==item['gameId'] and x['gameDate']==item['date']<=Q['eventThrough'] and x['gamesPlayed']==1 for x in rows)
 reports[item['gameId']]={x['playerId']:x for x in rows};evidence[item['gameId']]={'url':item['url'],'bodySHA256':sha(body),'receiptSHA256':sha(Path(entry['receipt']).read_bytes()),'retrievedAtUTC':receipt['at'],'availableAtOriginalCapture':False}
rows=load(P/'ppp-cached-check-01/ROWS.json');assert len(rows)==len({x['sourceId'] for x in rows})==645;assert set(targets)==set(x['sourceId'] for x in rows);counts=Counter();unknown=defaultdict(list);zeros=other=0
for row in rows:
 t=targets[row['sourceId']];official=reports.get(t['gameId'],{}).get(t['playerId']);assert all(row[k]==t[k] for k in ('playerId','gameId','date'));assert row['wgoPPP']==t['PPP']['wgo'];assert row['priorCountFlags']=={k:v['state'] for k,v in t['counts'].items()};assert row['priorRowState']==t['state'];assert row['evidence']==evidence.get(t['gameId'])
 if official is None:reason='no_cached_official_summary_player'
 elif t['state']!='identity_team_exposure_qualified' or t['gameFinality']!='final':reason='prior_identity_exposure_or_finality_held'
 else:
  reason=None;assert (official['gameId'],official['playerId'],official['gameDate'],official['teamAbbrev'],official['gamesPlayed'])==(t['gameId'],t['playerId'],t['date'],t['officialTeam'],1);assert finite(official['timeOnIcePerGame']) and official['timeOnIcePerGame']>0 and official['timeOnIcePerGame']==t['TOI']['official'];values=[official[k] for k in ('ppPoints','ppGoals','goals','assists','points')];assert all(type(v) is int and v>=0 for v in values);pp,pg,g,a,pt=values;assert pg<=g and pg<=pp<=pt and pp-pg<=a and g+a==pt;assert pp==t['PPP']['wgo']==row['officialPPP'];assert row['state']=='match';zeros+=pp==0;other+='mismatch' in row['priorCountFlags'].values()
 if reason:assert row['state']=='unknown' and row['officialPPP'] is None and row['reason']==reason;unknown[reason].append(row)
 counts[row['state']]+=1
assert counts==Counter(match=179,unknown=466) and zeros==116 and other==15
remaining=load(P/'ppp-cached-check-01/REMAINING-EVIDENCE.json');assert remaining['rows']==466;flat=[sid for g in remaining['groups'] for sid in g['sourceIds']];assert len(flat)==len(set(flat))==466;assert set(flat)=={r['sourceId'] for r in rows if r['state']=='unknown'}
for group in remaining['groups']:
 assert group['rows']==len(group['sourceIds']);assert all(any(r['sourceId']==sid and r['gameId']==group['gameId'] and r['date']==group['date'] and r['reason']==group['reason'] for r in rows) for sid in group['sourceIds'])
result={'pinsVerified':len(readpins),'sharedPinsVerified':len(C['sharedSourcePins']),'profiles':len(profiles),'windowDateBounds':[min(windowdates),max(windowdates)],'referenceDateBounds':[min(refdates),max(refdates)],'productionTargetExcludedFits':prodfit,'supportTargetExcludedFitsAndSourceIDHashes':supportfit,'bridgeArithmeticChecked':bridge,'savedIndexTransformChecked':index,'states':states,'directionalCounts':direction,'overlaps':overlaps,'commonNumericUniverse':len(common),'commonOverlap':commonoverlap,'rankedListsReconciled':6,'uniqueUnjudgedCases':len(cards),'PPP':{'reports':len(reports),'targets':len(targets),'states':counts,'zeros':zeros,'matchesWithOtherCountDiscrepancy':other,'unknownReasons':{k:{'rows':len(v),'games':len({r['gameId'] for r in v})} for k,v in unknown.items()},'receiptDateRange':[min(times),max(times)],'originalCapture':Q['originalCaptureAsOf']},'holdoutAccessed':False,'rawHistoryOrOriginalBlockCatalogReread':False,'networkCalls':0}
(O/'VERIFICATION.json').write_text(json.dumps(result,indent=2)+'\n');(O/'PINS.json').write_text(json.dumps(readpins,indent=2)+'\n');print(json.dumps(result,indent=2))
