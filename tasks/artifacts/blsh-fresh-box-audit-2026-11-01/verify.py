from pathlib import Path
from collections import Counter, defaultdict
from datetime import datetime
from itertools import combinations
import csv, hashlib, json

O = Path(__file__).resolve().parent
B = Path('/Users/tim/Documents/Codex/2026-10-27/task-3')
F = B / 'fresh-box-qualification-20261101-01'
S = B / 'fresh-source-qualification-20261101-01'
C = B / 'current-refresh-reader-20261101-01'
load = lambda p: json.loads(Path(p).read_text())
sha = lambda b: hashlib.sha256(b).hexdigest()
stamp = lambda s: datetime.fromisoformat(s.replace('Z', '+00:00'))
pins = {}
def pin(path, digest):
    path = Path(path); body = path.read_bytes()
    assert sha(body) == digest, str(path)
    pins[str(path)] = digest
    return body
for packet in [F, S]:
    receipt = load(packet / 'FINAL-RECEIPT.json')
    for group in ['files', 'sharedSourcePins']:
        for path, digest in receipt[group].items(): pin(path, digest)
for name in ['PLAN.json', 'PPP-EXTENSION-PLAN.json']:
    plan = load(F / name)
    for path, digest in plan.get('inputs', plan.get('pins')).items(): pin(path, digest)
for path, digest in load(S / 'current-evidence-01/SOURCE-PINS.json').items(): pin(path, digest)
capture = load(C / 'live-read-01/capture/CURRENT-REQUEST.json')
assert sha((C / 'live-read-01/capture/CURRENT-REQUEST.json').read_bytes()) == 'c6d1d13dc7327baa54742c3eb7efe0a1e5d96c6ef6ffefc66de23f4092c12ba2'
raw = {r['id']: r for r in capture['wgo']['rows']}
assert len(raw) == len(capture['wgo']['rows']) == 8135
assert len({(r['player_id'], r['game_id']) for r in raw.values()}) == 8135
assert all(r['season_id'] == 20262027 and '2026-07-01' <= r['date'] <= '2026-10-31' for r in raw.values())
groups = defaultdict(list)
for r in raw.values(): groups[r['player_id']].append(r)
contexts = load(C / 'production-context-02/CONTEXTS.json')['profiles']
assert len(contexts) == len(groups) == 740
selected = []
for p in contexts:
    expected = sorted(groups[p['playerId']], key=lambda r: (r['date'], r['id']))[-5:]
    assert p['sourceIds'] == [r['id'] for r in expected]
    assert p['supportScore'] is None and p['buySellLabel'] is None and p['baselineComparison'] is None
    assert p['trusted'] is False and p['productionAdopted'] is False
    selected.extend(p['sourceIds'])
assert len(selected) == len(set(selected)) == 3461
selected = set(selected)
assert sum(len(p['sourceIds']) == 5 for p in contexts) == 644
goal_fields = {'es_goals_for':'evenStrengthGoalsFor','pp_goals_for':'powerPlayGoalFor','sh_goals_for':'shortHandedGoalsFor','es_goals_against':'evenStrengthGoalsAgainst','pp_goals_against':'powerPlayGoalsAgainst','sh_goals_against':'shortHandedGoalsAgainst'}
missing = {sid for sid, r in raw.items() if any(r['counts'][k] is None for k in goal_fields)}
assert len(missing) == 280 and missing <= selected
assert all(all(k in raw[sid]['counts'] and raw[sid]['counts'][k] is None for k in goal_fields) for sid in missing)
assert all(v is not None for sid in missing for k, v in raw[sid]['counts'].items() if k not in goal_fields)
assert Counter(raw[sid]['date'] for sid in missing) == {'2026-10-27':116,'2026-10-28':22,'2026-10-29':67,'2026-10-30':21,'2026-10-31':54}
assert len({raw[sid]['player_id'] for sid in missing}) == 228
assert sum(raw[sid]['counts']['shots'] == 0 for sid in missing) == 117
assert sum(raw[sid]['counts']['shots'] <= 1 for sid in missing) == 215
for p in contexts:
    gs = next(m for m in p['metrics'] if m['key'] == 'wigoGameScore')
    assert (gs['total'] is None) == bool(set(p['sourceIds']) & missing)

# Independently bind the complete 16 retained report pages, preserving the first-page witness limitation.
pageplan = load(S / 'OFFICIAL-REPORT-PAGINATION-PLAN.json')
pagegroups = defaultdict(list); native = {}; origins = {}; reportbytes = 0; reporttimes = []
oldbody = S / 'official-reports-01/2026-10-27.body.json'
pin(oldbody, pageplan['priorPartialBodySHA256'])
oldresult = load(S / 'official-reports-01/RESULT.json')
pin(S / 'official-reports-01/RESULT.json', pageplan['priorResultSHA256'])
assert oldresult['dispatched'] == 1 and oldresult['verified'] == 0 and oldresult['reason'] == 'report_row_bound_or_pagination'
olddata = load(oldbody); assert len(olddata['data']) == 100 and olddata['total'] == 396
oldurl = load(S / 'official-reports-01/2026-10-27.dispatch.json')['url']
assert oldurl == pageplan['dates'][0]['url']
assert pageplan['priorPartialCaptureIntervalUTC'][1] == oldresult['finishedAtUTC']
assert stamp(pageplan['priorPartialCaptureIntervalUTC'][0]) > stamp(capture['asOfUTC'])
pagegroups['2026-10-27'].append((0, olddata)); reportbytes += oldbody.stat().st_size
for r in olddata['data']: origins[(r['playerId'], r['gameId'])] = (str(oldbody), sha(oldbody.read_bytes()), oldurl)
for item in pageplan['requests']:
    key = item['date'] + '-start-' + str(item['start']).zfill(3)
    prefix = S / 'official-reports-02' / key
    bodypath = Path(str(prefix) + '.body.json'); body = bodypath.read_bytes()
    receipt = load(str(prefix) + '.receipt.json'); dispatch = load(str(prefix) + '.dispatch.json')
    assert receipt['state'] == 'verified' and receipt['httpStatus'] == 200 and receipt['TLSVerified'] is True
    assert receipt['url'] == dispatch['url'] == item['url'] and receipt['sha256'] == sha(body) and receipt['bytes'] == len(body)
    assert stamp(pageplan['atUTC']) < stamp(dispatch['atUTC']) <= stamp(receipt['atUTC'])
    data = json.loads(body); assert data['total'] == item['expectedRows'] and len(data['data']) == item['expectedPageRows']
    assert all(r['gameDate'] == item['date'] and r['gameId'] in item['expectedGameIds'] and r['gamesPlayed'] == 1 for r in data['data'])
    pagegroups[item['date']].append((item['start'], data)); reportbytes += len(body); reporttimes.append(receipt['atUTC'])
    for r in data['data']: origins[(r['playerId'], r['gameId'])] = (str(bodypath), sha(body), item['url'])
for dateitem in pageplan['dates']:
    start = 0; keys = []
    for offset, page in sorted(pagegroups[dateitem['date']]):
        assert offset == start and page['total'] == dateitem['expectedRows'] and len(page['data']) == min(100, page['total']-offset)
        for r in page['data']:
            k = (r['playerId'], r['gameId']); assert k not in native
            assert r['gameDate'] == dateitem['date'] and r['gameId'] in dateitem['expectedGameIds']
            assert type(r['gamesPlayed']) is int and r['gamesPlayed'] == 1
            native[k] = r; keys.append(k)
        start += len(page['data'])
    assert start == dateitem['expectedRows'] and keys == sorted(keys) and len(keys) == len(set(keys))
assert len(native) == 1404 and reportbytes == 821315
cohort = {sid:r for sid,r in raw.items() if '2026-10-27' <= r['date'] <= '2026-10-31'}
assert len(cohort) == 1404 and {(r['player_id'],r['game_id']) for r in cohort.values()} == set(native)
comparison = {r['sourceId']:r for r in load(S/'diagnosis-01/DATE-COHORT-COMPARISON.json')}
assert set(comparison) == set(cohort)
report_diffs = {}; nonnull_goal_cells = 0
for sid,r in cohort.items():
    n=native[(r['player_id'],r['game_id'])]; q=comparison[sid]
    assert (n['teamAbbrev'],n['gameDate']) == (r['team_abbrev'],r['date'])
    assert q['state']=='identity_matched_with_field_evidence' and all(q['identityChecks'].values())
    assert q['scoreInferred'] is False and q['updateProposed'] is False
    assert q['isMissingInputTarget'] == (sid in missing)
    e=q['nativeEvidence']; assert (e['bodyPath'],e['bodySHA256'],e['url']) == origins[(r['player_id'],r['game_id'])]
    for k,v in goal_fields.items():
        assert k in r['counts'] and v in n
        f=next(f for f in q['goalFields'] if f['capturedField']==k)
        if sid in missing:
            assert r['counts'][k] is None and n[v] is None
            assert f['nativeState']==f['capturedState']=='explicit_null' and f['observedValuesEqual'] is None
        else:
            assert r['counts'][k] == n[v] and n[v] is not None and f['observedValuesEqual'] is True
            nonnull_goal_cells+=1
    assert q['allSixNativeExplicitNull']==q['allSixCapturedExplicitNull']==(sid in missing)
    assert all(r['counts'][k]==n[k] for k in ['goals','assists','points'])
    assert r['pp_toi_per_game']==n['powerPlayTimeOnIcePerGame']
    fields=[]
    if r['es_toi_per_game']!=n['evenStrengthTimeOnIcePerGame']:
        fields=['es_toi_per_game']; report_diffs[sid]=n['evenStrengthTimeOnIcePerGame']-r['es_toi_per_game']
    assert q['observedDiscrepancies']==fields
assert nonnull_goal_cells==6744 and len(report_diffs)==6 and len(set(report_diffs)&missing)==1
assert {r['sourceId'] for r in load(S/'diagnosis-01/TARGET-DIAGNOSIS.json')}==missing

# Bind all selected identities to the exact capture and prior proof objects.
ledger = {r['sourceId']:r for r in load(S/'current-evidence-01/ROW-EVIDENCE.json')}
priorboxes = {r['sourceId']:r for r in load(B/'current-box-provenance-20261101-01/ROW-QUALIFICATION.json')}
priorppp = {r['sourceId']:r for r in load(B/'ppp-census-bounds-20261101-01/replay-01/ROWS.json') if r['season']==20262027}
assert len(ledger)==3461 and set(ledger)==selected
linkcounts=Counter(); expected_new=set()
for sid,r in ledger.items():
    x=raw[sid]; assert r['sourceRow']==x and r['capturedAtUTC']==capture['asOfUTC']
    assert (r['playerId'],r['gameId'],r['date'],r['team'])==(x['player_id'],x['game_id'],x['date'],x['team_abbrev'])
    assert r['priorBox']['evidence']==priorboxes.get(sid)
    pb=priorboxes.get(sid)
    if pb is None or 'no_pinned_cached_official_box' in pb['reasons']:expected_new.add(sid)
    if pb:
        assert (pb['playerId'],pb['gameId'],pb['date'],pb['wgoTeam'])==(x['player_id'],x['game_id'],x['date'],x['team_abbrev'])
        for k,f in pb['counts'].items(): assert f['wgo'] is None or f['wgo']==x['counts'][k]
        if pb['TOI']:assert pb['TOI']['wgo']==x['toi_per_game']
        if pb['PPP']:assert pb['PPP']['wgo']==x['counts']['pp_points']
    pp=r['priorPPP']
    if pp:
        assert pp['evidence']==priorppp[sid] and pp['admittedToScoring'] is False
        p=pp['evidence'];assert (p['playerId'],p['gameId'],p['date'],p['team'],p['wgoPPP'])==(x['player_id'],x['game_id'],x['date'],x['team_abbrev'],x['counts']['pp_points'])
        assert not p['priorQualified'] or x['toi_per_game']==p['seconds']
        wanted='unresolved'
        if p['cohort']=='current_direct_validation': assert p['directEvidence'] and p['directPPP']==x['counts']['pp_points'];wanted='prior_direct_match'
        elif p['state']=='uniquely_implied':assert p['priorQualified'] and p['impliedPPP']==x['counts']['pp_points'];wanted='prior_uniquely_derived_match'
        assert pp['state']==wanted;linkcounts[wanted]+=1
    assert r['freshGoalsReport']==comparison.get(sid)
    assert r['NSTStrengthDateUnitModelReceipt']=='unavailable' and r['scoringAdmissionChanged'] is False
assert len(expected_new)==1432 and linkcounts=={'unresolved':197,'prior_direct_match':141,'prior_uniquely_derived_match':116}
assert sum(r['priorBox']['evidence'] is None for r in ledger.values())==864
assert sum(len(p['sourceDiscrepancies']) for p in contexts)==90

# The new exact-game capture is complete for the declared 1,432-row cohort.
plan=load(F/'PLAN.json'); boxes={}; times=[]; dispatches=[]; bodybytes=0
assert {sid for i in plan['requests'] for sid in i['sourceIds']}==expected_new
assert sum(len(i['sourceIds']) for i in plan['requests'])==1432 and len(plan['requests'])==42
boxev=load(F/'qualification-01/BOX-EVIDENCE.json')
for item in plan['requests']:
    gid=item['gameId']; prefix=F/'collection-01'/str(gid)
    body=Path(str(prefix)+'.body.json').read_bytes(); b=json.loads(body)
    receipt=load(str(prefix)+'.receipt.json'); transport=load(str(prefix)+'.transport.json'); dispatch=load(str(prefix)+'.dispatch.json')
    assert receipt['url']==transport['url']==dispatch['url']==item['url']==f'https://api-web.nhle.com/v1/gamecenter/{gid}/boxscore'
    assert receipt['status']=='success' and receipt['httpStatus']==200 and receipt['TLSVerified'] is True
    assert {**transport,'status':'success'}==receipt
    assert receipt['sha256']==sha(body) and receipt['bytes']==len(body)
    assert (b['id'],b['season'],b['gameType'],b['gameDate'])==(gid,20262027,2,item['date']) and b['gameState'] in ['OFF','FINAL']
    assert gid not in boxes;boxes[gid]=b; bodybytes+=len(body)
    assert stamp(plan['atUTC']) < stamp(dispatch['atUTC']) <= stamp(receipt['retrievedAtUTC']) and stamp(receipt['retrievedAtUTC'])>stamp(capture['asOfUTC'])
    e=boxev[str(gid)]; assert e['bodySHA256']==sha(body) and e['receiptSHA256']==sha(Path(str(prefix)+'.receipt.json').read_bytes())
    assert e['retrievedAtUTC']==receipt['retrievedAtUTC'] and e['originalPublicationUTC'] is None and e['availableAtEarlierWGOCapture'] is False
    times.append(receipt['retrievedAtUTC']);dispatches.append(dispatch['atUTC'])
    assert all(raw[sid]['date']==item['date'] and raw[sid]['game_id']==gid for sid in item['sourceIds'])
assert bodybytes==559659 and len(boxes)==42
assert all((stamp(b)-stamp(a)).total_seconds()>=1.99 for a,b in zip(dispatches,dispatches[1:]))
new={r['sourceId']:r for r in load(F/'qualification-01/ROW-QUALIFICATION.json')};assert set(new)==expected_new
stats=Counter();diffs={};operands=0; pp_unknown=set()
countmap={'goals':'goals','assists':'assists','shots':'sog','hits':'hits','blocked_shots':'blockedShots'}
for sid,q in new.items():
    r=raw[sid];b=boxes[r['game_id']];players=[]
    for side in ['homeTeam','awayTeam']:
        for group in ['forwards','defense']:players += [(p,b[side]['abbrev'],b[side]['id']) for p in b['playerByGameStats'][side][group]]
    assert len({p['playerId'] for p,_,_ in players})==len(players)
    found=[(p,t,tid) for p,t,tid in players if p['playerId']==r['player_id']];assert len(found)==1
    p,team,tid=found[0];assert team==r['team_abbrev']==q['officialTeam'] and tid==q['officialTeamId']
    assert q['gameFinality']=='final' and q['team']=='match' and q['appearance']=='positive_official_TOI' and r['games_played']==1
    seconds=sum(int(v)*scale for v,scale in zip(p['toi'].split(':'),[60,1]));assert seconds>0
    assert q['TOI']=={'wgo':r['toi_per_game'],'official':seconds,'state':'match' if seconds==r['toi_per_game'] else 'mismatch'};operands+=1
    held=seconds!=r['toi_per_game'];assert q['state']==('held' if held else 'identity_team_exposure_qualified')
    assert q['reasons']==(['positive_exact_TOI_not_established'] if held else [])
    if held:diffs[(sid,'toi_per_game')]=(r['toi_per_game'],seconds);assert seconds-r['toi_per_game']==report_diffs[sid]
    for k,v in countmap.items():
        assert q['counts'][k]=={'wgo':r['counts'][k],'official':p[v],'state':'match' if r['counts'][k]==p[v] else 'mismatch'};operands+=1
        if r['counts'][k]!=p[v]:diffs[(sid,k)]=(r['counts'][k],p[v]);stats[k]+=1
    if p['assists']==0:assert q['PPP']=={'wgo':r['counts']['pp_points'],'official':p['powerPlayGoals'],'state':'match'}
    else:assert q['PPP']=={'wgo':r['counts']['pp_points'],'official':None,'state':'unknown_PP_assists_not_supplied'};pp_unknown.add(sid)
    assert q['sourceRowSHA256']==sha(json.dumps(r,sort_keys=True,separators=(',',':')).encode()) and q['scoreComputed'] is False
    assert q['WGOCapturedAtUTC']==capture['asOfUTC'] and q['availableAtEarlierWGOCapture'] is False
assert operands==8592 and stats=={'shots':17,'hits':8,'blocked_shots':8}
assert len(diffs)==len({sid for sid,k in diffs})==39 and len(pp_unknown)==355
csvrows=list(csv.DictReader((F/'qualification-01/DISCREPANCIES.csv').open()))
assert len(csvrows)==39
for r in csvrows:assert diffs[(int(r['sourceId']),r['field'])]==(float(r['captured']),float(r['official']))
full=lambda q:q['state']=='identity_team_exposure_qualified' and all(q['counts'][k]['state']=='match' for k in countmap)
assert sum(full(q) for q in new.values())==1393
assert sum(raw[sid]['counts']['shots']==0 for sid in new)==418
assert sum(raw[sid]['counts']['shots']==0 and q['state']=='identity_team_exposure_qualified' for sid,q in new.items())==416

# Independent allocation enumeration directly from raw teammate goals, not exported operands.
extension=load(F/'PPP-EXTENSION-PLAN.json'); ext={r['sourceId']:r for r in load(F/'ppp-extension-01/ROWS.json')}
assert set(ext)==pp_unknown and {r['sourceId'] for r in extension['targets']}==pp_unknown
assert stamp(extension['atUTC'])>max(map(stamp,times))
counts=Counter(); reasons=Counter(); zeros=0; enumerated=0
for t in extension['targets']:
    sid=t['sourceId'];r=raw[sid];q=new[sid];e=ext[sid];b=boxes[r['game_id']]
    assert all(e[k]==v for k,v in t.items())
    assert t=={'sourceId':sid,'playerId':r['player_id'],'gameId':r['game_id'],'season':20262027,'date':r['date'],'team':q['officialTeam'],'seconds':q['TOI']['official'],'priorQualified':q['state']=='identity_team_exposure_qualified','wgoPPP':r['counts']['pp_points'],'priorCountFlags':{k:v['state'] for k,v in q['counts'].items()},'sourceRowSHA256':q['sourceRowSHA256']}
    hold='prior_identity_exposure_or_finality_held' if not t['priorQualified'] else None
    if hold is None:
        teams={}; bad=False
        for side in ['homeTeam','awayTeam']:
            ps=b['playerByGameStats'][side]['forwards']+b['playerByGameStats'][side]['defense'];teams[b[side]['abbrev']]=ps
            G=sum(p['goals'] for p in ps)
            assert all(type(p[k]) is int and p[k]>=0 for p in ps for k in ['goals','assists','powerPlayGoals'])
            assert all(p['powerPlayGoals']<=p['goals'] and p['assists']<=G-p['goals'] for p in ps) and sum(p['assists'] for p in ps)<=2*G
            bad |= G!=b[side]['score']
        if bad:hold='goal_census_score_mismatch_no_shootout_or_goalie_adjustment'
        else:
            ps=teams[t['team']];p=next(p for p in ps if p['playerId']==t['playerId']);goals=[]
            for other in ps:
                if other['playerId']!=p['playerId']:goals += [1]*other['powerPlayGoals']+[0]*(other['goals']-other['powerPlayGoals'])
            possible={p['powerPlayGoals']+sum(c) for c in combinations(goals,p['assists'])}
            assert (e['lowerPPP'],e['upperPPP'])==(min(possible),max(possible)) and r['counts']['pp_points'] in possible
            assert e['operands']=={'playerGoals':p['goals'],'playerPPGoals':p['powerPlayGoals'],'playerAssists':p['assists'],'teamGoals':sum(o['goals'] for o in ps),'teamPPGoals':sum(o['powerPlayGoals'] for o in ps),'teammatePPGoals':sum(goals),'teammateNonPPGoals':len(goals)-sum(goals)}
            if len(possible)==1:assert e['state']=='uniquely_implied' and e['impliedPPP']==next(iter(possible))==r['counts']['pp_points'];zeros+=e['impliedPPP']==0
            else:assert e['state']=='ambiguous' and e['impliedPPP'] is None
            enumerated+=1
    if hold:assert e['state']=='unknown' and e['reason']==hold and e['lowerPPP'] is None and e['upperPPP'] is None and e['impliedPPP'] is None
    assert e['admittedToScoring'] is False and e['valueKind']=='derived_bound_not_direct_observation'
    counts[e['state']]+=1
    if e['reason']:reasons[e['reason']]+=1
assert counts=={'uniquely_implied':145,'ambiguous':188,'unknown':22} and zeros==129 and enumerated==333
assert reasons=={'more_than_one_PP_assist_allocation':188,'goal_census_score_mismatch_no_shootout_or_goalie_adjustment':20,'prior_identity_exposure_or_finality_held':2}
assert len({r['gameId'] for r in ext.values()})==41
extension_evidence=load(F/'ppp-extension-01/EVIDENCE.json')
assert set(extension_evidence)=={str(r['gameId']) for r in ext.values()}
extension_bytes=0
for gid,e in extension_evidence.items():
    original=boxev[gid]
    assert e['URL']==original['url'] and e['sourcePublicationUTC'] is None
    for key in ['bodyPath','receiptPath','bodySHA256','receiptSHA256','retrievedAtUTC']:assert e[key]==original[key]
    assert e['bodyBytes']==Path(e['bodyPath']).stat().st_size
    extension_bytes+=e['bodyBytes']
assert extension_bytes==546475

# Reconcile the final combined partition and every retained prior hold.
combined=load(F/'qualification-01/COMBINED-ROW-EVIDENCE.json');assert len(combined)==3461 and {r['sourceId'] for r in combined}==selected
partition=Counter(); states=Counter(); matched=0; added=0; five=0
for r in combined:
    sid=r['sourceId'];l=ledger[sid];q=r['boxQualification'];assert q==new.get(sid,l['priorBox']['evidence']) and q is not None
    assert r['priorBoxHoldRecord']==(l['priorBox']['evidence'] if sid in new else None)
    assert r['priorPPP']==l['priorPPP'] and r['freshGoalsReport']==l['freshGoalsReport']
    assert r['scoringAdmissionChanged'] is False and r['NSTStrengthDateUnitModelReceipt']=='unavailable'
    state='unresolved'
    if q['PPP']['state']=='match':state='official_box_zero_assist_match'
    elif l['priorPPP'] and l['priorPPP']['state'] in ['prior_direct_match','prior_uniquely_derived_match']:state=l['priorPPP']['state']
    elif sid in ext and ext[sid]['state']=='uniquely_implied':state='new_uniquely_derived_match'
    partition[state]+=1;states[q['state']]+=1;five+=full(q)
    if full(q) and state!='unresolved':matched+=1;added+=state=='new_uniquely_derived_match'
assert partition=={'official_box_zero_assist_match':2652,'prior_uniquely_derived_match':116,'prior_direct_match':141,'new_uniquely_derived_match':145,'unresolved':407}
assert states=={'identity_team_exposure_qualified':3409,'held':52} and five==3334 and matched==2950 and added==137
coverage=load(F/'FINAL-COVERAGE.json');assert coverage['PPPFieldEvidence']==partition and coverage['identityExposureFiveCountsAndPPPMatch']==matched and coverage['additionalSuchRowsFromNewCensus']==added
assert coverage['wholeGameScoreOrAdvancedAdmission'] is False and coverage['scoreOrPreviewChanges']==0
assert all(sha(Path(p).read_bytes())==h for p,h in pins.items())
result={'pinsVerified':len(pins),'sharedSourcePinsUnchanged':10,'capturedWgoRows':8135,'selectedRows':3461,'profiles':740,'newlyBoxedRows':1432,'newBoxes':42,'newBoxBytes':bodybytes,'newOfficialCountTOIOperands':operands,'newDiscrepancyRowsAndFields':39,'newDiscrepanciesByField':{**stats,'toi_per_game':6},'reportPages':16,'reportRows':1404,'reportBytes':reportbytes,'explicitNullRows':280,'explicitNullCells':1680,'otherGoalCellsMatch':6744,'reportExposureDiscrepancies':6,'PPPAdditionalStates':counts,'PPPAdditionalZeros':zeros,'PPPAdditionalNonzeros':16,'independentEmpiricalRangesEnumerated':333,'combinedPPPPartition':partition,'combinedBoxStates':states,'identityExposureAndFiveCountsMatch':five,'identityExposureFiveCountsAndPPPMatch':matched,'additionalFullStandardOperandRows':added,'capturedAtUTC':capture['asOfUTC'],'boxRetrievalRangeUTC':[min(times),max(times)],'reportReceiptRangeUTC':[min(reporttimes),max(reporttimes)],'originalPartialPageCaptureIntervalUTC':pageplan['priorPartialCaptureIntervalUTC'],'sourcePublicationTimeEstablished':False,'auditProviderRequests':0,'auditSourceEdits':0,'auditHoldoutReads':0}
(O/'PINS.json').write_text(json.dumps(pins,indent=2)+'\n')
(O/'VERIFICATION.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result,indent=2))
