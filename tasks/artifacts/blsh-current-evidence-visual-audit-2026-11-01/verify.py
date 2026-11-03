"""Offline independent data/receipt/recount audit; never invoke producer main."""
import sys
sys.dont_write_bytecode=True
from pathlib import Path
from collections import Counter
from datetime import datetime, date
import hashlib, importlib, importlib.util, json, os, re, unittest
from bs4 import BeautifulSoup
O=Path(__file__).resolve().parent
B=Path('/Users/tim/Documents/Codex/2026-10-27/task-3')
V=B/'current-evidence-visual-candidate-20261101-01'
E=B/'ppp-retained-earlier-events-20261101-01'
F=E/'format-extension-01'
C=B/'ppp-sidecar-composition-20261101-01'
load=lambda p:json.loads(Path(p).read_text())
sha=lambda raw:hashlib.sha256(raw).hexdigest()
stamp=lambda s:datetime.fromisoformat(s.replace('Z','+00:00'))
pins={}
def pin(path,expected=None):
    p=Path(path);h=sha(p.read_bytes());assert expected is None or h==expected,str(p)
    assert str(p) not in pins or pins[str(p)]==h
    pins[str(p)]=h
def pinmap(values):
    for p,h in values.items():pin(p,h)
def module(name,path):
    spec=importlib.util.spec_from_file_location(name,path);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
def offline(event,args):
    if event.startswith('socket.'):raise RuntimeError('Audit denies networking')
sys.addaudithook(offline)
lock=Path('/private/tmp/fhfh-heavy.lock');owner={'owner':'codex-blsh-current-evidence-independent-audit','pid':os.getpid()}
lock.mkdir();(lock/'owner.json').write_text(json.dumps(owner))
try:
    for root in (V,E,F,C):
        pin(root/'FINAL-RECEIPT.json');r=load(root/'FINAL-RECEIPT.json')
        pinmap(r['files']);pinmap(r.get('sharedSourcePins',{}))
    for root,names in [(V,['INPUT-PINS.json','DETAIL-INPUT-PINS.json','RENDER-PINS.json']),(E,['INPUT-PINS.json','RUN-PINS.json','RECOUNT-RUN-PINS.json']),(F,['RUN-PINS.json'])]:
        for n in names:pinmap(load(root/n))
    for binding in load(E/'ACCEPTANCE-BINDINGS.json')['codeBindings']:
        pin(binding['auditPinsPath'],binding['auditPinsSHA256'])
        assert load(binding['auditPinsPath'])[binding['codePath']]==binding['codeSHA256']
        pin(binding['codePath'],binding['codeSHA256'])
    prior_review=O.parent/'blsh-ppp-composition-audit-2026-11-01'
    pin(prior_review/'REVIEW.md','b2176ac86f3ea90dcfa29e8414a15d9230db3677703be9df94f3f71561286df9')
    pin(prior_review/'PINS.json','51d5d1f79326e59fd2229f8a387cd50f90a600ed4cf97ed78a0bb80be499b859')
    pinmap(load(prior_review/'PINS.json'))
    # Imports already inspected; redirect the fixture writer into this audit directory.
    sys.path[:0]=[str(V),str(E),str(F)]
    suite=unittest.TestSuite()
    for n in ['test_render','test_replay','test_format']:
        m=importlib.import_module(n)
        if n=='test_replay':m.__file__=str(O/'test_replay_fixture_location.py')
        suite.addTests(unittest.defaultTestLoader.loadTestsFromModule(m))
    with (O/'TESTS.log').open('w') as out:result=unittest.TextTestRunner(stream=out,verbosity=2).run(suite)
    assert result.wasSuccessful() and result.testsRun==16
    original=module('independent_original_attribute',B/'ppp-event-attribution-20261101-01/attribute.py')
    extension=importlib.import_module('format_credits').bind(module('independent_extension_attribute',B/'ppp-event-attribution-20261101-01/attribute.py'))
    capture=load(B/'current-refresh-reader-20261101-01/live-read-01/capture/CURRENT-REQUEST.json')
    sources={r['id']:r for r in capture['wgo']['rows']};assert len(sources)==len(capture['wgo']['rows'])==8135
    source_time=capture['wgo']['capture']['retrievedAtUTC']
    combined={r['sourceId']:r for r in load(B/'fresh-box-qualification-20261101-01/qualification-01/COMBINED-ROW-EVIDENCE.json')}
    rows={r['sourceId']:r for r in load(C/'candidate-01/ROWS.json')}
    profiles=load(C/'candidate-01/PROFILES.json');summary=load(C/'candidate-01/SUMMARY.json')
    data=load(V/'DISPLAY-DATA.json');display={p['playerId']:p for p in data['profiles']}
    html=(V/'candidate.html').read_text();template=(V/'template.html').read_text()
    embedded=re.search(r'<script id="payload" type="application/json">(.*?)</script>',html,re.S)[1]
    assert json.loads(embedded)==data and html==template.replace('__DATA__',embedded)
    assert len(display)==len(data['profiles'])==len(profiles)==740
    assert data['profiles']==sorted(data['profiles'],key=lambda p:(p['name'].casefold(),p['playerId']))
    assert data['totals']=={'players':740,'selectedRecords':3461,'fpWindows':482,'unresolvedPPP':212,'zeroShotWindows':20}
    assert data['capture']==capture['wgo']['capture'] and data['cutoff']==capture['eventThroughDate']=='2026-10-31'
    assert data['fieldEvidencePreparedAt']==summary['atUTC'] and data['scoreAdmission'] is False
    notes={r['sourceId']:r for r in load(B/'assist-credit-consistency-20261101-01/FACEOFF-DIFFERENCE-DETAILS.json')}
    selected=[]
    for p in profiles:
        d=display[p['playerId']]
        for k in ['name','team','dates','selectedRecords','appearances','shots','lastRecordAgeDays']:assert d[k]==p[k]
        assert d['minutes']==p['seconds']/60 and d['fp']==p['tracks']['fantasyPoints'] and d['points']==p['tracks']['rawPoints'] and d['gameScore']==p['capturedGameScore']
        assert d['score'] is None and d['support'] is None and d['baselineComparison'] is None
        assert [g['sourceId'] for g in d['games']]==p['sourceIds']
        for g in d['games']:
            sid=g['sourceId'];s=sources[sid];r=rows[sid];selected.append(sid)
            assert (g['gameId'],g['date'],g['team'])==(s['game_id'],s['date'],s['team_abbrev'])
            assert g['fields']=={k:{**v,'captured':s['counts'][k]} for k,v in r['fields'].items()}
            assert g['exposureState']==r['exposureState'] and g['capturedSeconds']==s['toi_per_game'] and g['officialSeconds']==combined[sid]['boxQualification']['TOI']['official']
            assert g['evidenceVintage']==r['boxEvidenceVersion'] and g['additionalReviewNote']==notes.get(sid)
    assert len(selected)==len(set(selected))==3461 and set(selected)==set(rows)
    # Exact unresolved census and its frozen retained-response intersection.
    plan=load(E/'PLAN.json');fmt_plan=load(F/'PLAN.json')
    assert sha((E/'PLAN.json').read_bytes())=='6be7695b9d04d07f174a27d9614da0041ae93d8603c699bc9115c59666aabbd1'
    assert sha((F/'PLAN.json').read_bytes())=='2c01e7441dd8aac869a52c6c9da287ed69431a588309b66fe6beb436b2d28d46'
    earlier_proofs=load(B/'ppp-event-attribution-20261101-01/qualification-01/ROWS.json')
    old_ids={r['sourceId'] for r in earlier_proofs}
    remaining={sid for sid,r in rows.items() if r['fields']['pp_points']['state']=='unknown'}-old_ids
    targets=[t for g in plan['games']+plan['outside'] for t in g['targets']]
    assert len(targets)==len({t['sourceId'] for t in targets})==len(remaining)==207 and {t['sourceId'] for t in targets}==remaining
    assert len(plan['games'])==len({g['gameId'] for g in plan['games']})==60
    original_results={r['sourceId']:r for r in load(E/'replay-01/ROWS.json')}
    original_games={g['gameId']:g for g in load(E/'replay-01/GAMES.json')}
    extension_results={r['sourceId']:r for r in load(F/'replay-01/ROWS.json')}
    extension_games={g['gameId']:g for g in load(F/'replay-01/GAMES.json')}
    fmt_games={g['gameId']:g for g in fmt_plan['games']}
    assert len(original_results)==197 and len(extension_results)==24 and len(fmt_games)==5
    assert set(fmt_games)=={gid for gid,g in original_games.items() if g['reason'] in ['unrecognized_goal_credit','unrecognized_assist_credit']}
    total_bytes=0;times=[];stats=Counter();old_matches=set();new_matches=set();held=[];games_checked=[]
    for g in plan['games']:
        gid=g['gameId'];day=g['date'];assert '2026-10-01'<=day<='2026-10-26'
        bodies={};game_times=[]
        for kind,url in [('box',f'https://api-web.nhle.com/v1/gamecenter/{gid}/boxscore'),('playByPlay',f'https://www.nhl.com/scores/htmlreports/20262027/PL{gid%1000000:06d}.HTM')]:
            e=g['evidence'][kind];body=Path(e['bodyPath']).read_bytes();receipt=load(e['receiptPath'])
            assert receipt['url']==e['url']==url and receipt['httpStatus']==200 and receipt['status']=='success' and receipt['TLSVerified'] is True
            assert sha(body)==receipt['sha256']==e['bodySHA256'] and len(body)==receipt['bytes']==e['bytes']
            assert receipt['retrievedAtUTC']==e['retrievedAtUTC'] and stamp(receipt['retrievedAtUTC'])<stamp(source_time)<stamp(plan['asOfUTC'])
            assert receipt['retrievedAtUTC'].startswith('2026-10-27T')
            total_bytes+=len(body);times.append(receipt['retrievedAtUTC']);game_times.append(receipt['retrievedAtUTC']);bodies[kind]=body
        box=json.loads(bodies['box']);assert (box['id'],box['gameDate'],box['season'],box['gameType'])==(gid,day,20262027,2) and box['gameState'] in ('OFF','FINAL')
        players={};lookup={};teams=[box[s]['abbrev'] for s in ('awayTeam','homeTeam')]
        for side in ('awayTeam','homeTeam'):
            for category in ('forwards','defense','goalies'):
                for p in box['playerByGameStats'][side][category]:
                    team=box[side]['abbrev'];pid=p['playerId'];key=(team,p['sweaterNumber'])
                    assert pid not in players and key not in lookup
                    players[pid]={'box':p,'team':team,'goalie':category=='goalies'};lookup[key]=pid
        skaters={pid:p for pid,p in players.items() if not p['goalie']};assert len(skaters)==36
        counts={pid:Counter() for pid in players};soup=BeautifulSoup(bodies['playByPlay'],'html.parser')
        assert soup.title.get_text(strip=True)=='Play By Play'
        header=soup.get_text(' ',strip=True)[:1000]
        assert 'Final' in header and f'Game {gid%10000:04d}' in header and date.fromisoformat(day).strftime('%B %-d, %Y') in header
        ledger=[];headers=[]
        for tr in soup.find_all('tr'):
            cells=tr.find_all('td',recursive=False)
            if len(cells)!=8:continue
            v=[c.get_text(' ',strip=True) for c in cells]
            if v[0]=='#':headers.append(v)
            if v[0].isdigit():ledger.append(v)
        assert headers and all(h[6:]==[t+' On Ice' for t in teams] for h in headers)
        assert [int(v[0]) for v in ledger]==list(range(1,len(ledger)+1))
        ends=[i for i,v in enumerate(ledger) if v[4]=='GEND'];assert len(ends)==1
        end=ledger[ends[0]]
        assert all(v[4]=='GOFF' or(v[4]=='PEND' and v[1]==end[1] and v[3]==end[3] and v[5].startswith('Period End-')) for v in ledger[ends[0]+1:])
        credits=[];score=Counter();shootout=0;error_original=None;error_extension=None;goalie_credits=[]
        for v in ledger:
            if v[4]!='GOAL':continue
            period=int(v[1]);assert 1<=period<=5
            if period==5:assert box['gameOutcome']['lastPeriodType']=='SO';shootout+=1;continue
            desc=v[5];team=desc.split(' ',1)[0];assert team in teams and v[2] in ('EV','PP','SH')
            actors=list(re.finditer(r'#(\d{1,2})\s+([^#;()]+)\((\d+)\)',desc))
            assert 1<=len(actors)<=3 and len(actors)==desc.count('#')
            assert desc[:actors[0].start()].strip()==team and desc[actors[0].end():].lstrip().startswith(',')
            marker=re.search(r'\bAssists?:',desc);assert bool(marker)==(len(actors)>1)
            if marker:
                text=desc[marker.end():].strip();expected='; '.join(a.group(0) for a in actors[1:])
                assert text in (expected,expected+' Flub',expected+' Broken Stick')
            ids=[lookup[team,int(a[1])] for a in actors];assert len(ids)==len(set(ids))
            for i,pid in enumerate(ids):
                counts[pid]['goals' if i==0 else 'assists']+=1
                if v[2]=='PP':counts[pid]['pp_goals' if i==0 else 'pp_assists']+=1
                if players[pid]['goalie']:goalie_credits.append({'event':int(v[0]),'playerId':pid,'role':'goal' if i==0 else 'assist'})
            score[team]+=1
            credits.append({'eventNumber':int(v[0]),'period':period,'strength':v[2],'team':team,'scorerId':ids[0],'assistIds':ids[1:],'description':desc})
            # Parser decisions are checked separately from the independent actor/count derivation.
            for parser,which in [(original,'old'),(extension,'new')]:
                if (error_original if which=='old' else error_extension) is not None:continue
                try:
                    t,sc,ass=parser.parse_credit(desc)
                    assert (t,lookup[t,sc],[lookup[t,n] for n in ass])==(team,ids[0],ids[1:])
                    if any(players[pid]['goalie'] for pid in ids):raise ValueError('unknown_or_goalie_credit_held')
                except ValueError as exc:
                    if which=='old':error_original=str(exc)
                    else:error_extension=str(exc)
        for pid,p in skaters.items():
            assert [counts[pid][k] for k in ('goals','assists','pp_goals')]==[p['box'][k] for k in ('goals','assists','powerPlayGoals')],(gid,pid)
            stats['skaterControlCells']+=3
        scoreboard={box[s]['abbrev']:box[s]['score'] for s in ('awayTeam','homeTeam')}
        if box['gameOutcome']['lastPeriodType']=='SO':assert score[teams[0]]==score[teams[1]] and sorted(scoreboard[t]-score[t] for t in teams)==[0,1]
        else:assert all(scoreboard[t]==score[t] for t in teams)
        gr=original_games[gid];assert gr['reason']==error_original and gr['state']==('held' if error_original else 'reconciled')
        if not error_original:assert gr['events']==credits and gr['controls']==36 and gr['excludedShootoutGoalEvents']==shootout
        else:assert gr['events']==[] and gr['controls']==0
        if gid in fmt_games:
            assert fmt_games[gid]==g and extension_games[gid]['reason']==error_extension
            assert extension_games[gid]['state']==('held' if error_extension else 'reconciled')
        for t in g['targets']:
            sid=t['sourceId'];src=sources[sid];pid=t['playerId'];q=combined[sid]['boxQualification']
            assert (src['player_id'],src['game_id'],src['date'],src['team_abbrev'],src['counts']['pp_points'])==(pid,gid,day,t['team'],t['capturedPPP'])
            assert src['season_id']==20262027 and players[pid]['team']==src['team_abbrev']
            m,s=map(int,players[pid]['box']['toi'].split(':'));seconds=m*60+s
            for output,err,label in [(original_results,error_original,'old')]+([(extension_results,error_extension,'new')] if gid in fmt_games else []):
                r=output[sid];assert all(r[k]==v for k,v in t.items())
                why=err
                if not why and (q['state']!='identity_team_exposure_qualified' or q['gameFinality']!='final'):why='prior_identity_exposure_finality_hold'
                if not why and not (type(src['games_played']) is int and src['games_played']==1 and src['toi_per_game']==seconds>0):why='retained_event_box_exposure_hold'
                val=counts[pid]['pp_goals']+counts[pid]['pp_assists'] if why is None else None
                assert r['eventPPP']==val and r['reason']==why and r['state']==('held' if val is None else 'matched')
                if val is not None:
                    assert val==src['counts']['pp_points']
                    (old_matches if label=='old' else new_matches).add(sid)
                assert r['scoringAdmission'] is False and r['canonicalUpdates']==0 and r['originalPublicationUTC'] is None
                assert r['sourceCaptureAtUTC']==source_time and r['evidenceAvailableAtUTC']==max(game_times,key=stamp) and r['oldestEvidenceAtUTC']==min(game_times,key=stamp)
                if label=='new':assert r['method']=='official_PP_event_credit_strict_format_extension_candidate_v1' and r['previousHoldReason']==original_results[sid]['reason']
            if original_results[sid]['state']=='held':held.append(sid)
        stats['goals']+=len(credits);stats['shootoutGoalEvents']+=shootout
        games_checked.append({'gameId':gid,'skaterControls':36,'regulationOTGoals':len(credits),'originalHold':error_original,'extensionHold':error_extension if gid in fmt_games else 'not_in_extension_scope','goalieCredits':goalie_credits})
        print(json.dumps({'gameId':gid,'independentRecount':'passed'}),flush=True)
    assert total_bytes==plan['expectedInputBytes']==76175670
    assert stats['goals']==417 and stats['skaterControlCells']==6480
    assert len(old_matches)==138 and len(new_matches)==12 and not(old_matches&new_matches)
    matches=old_matches|new_matches;assert len(matches)==150 and len(held)==59
    assert Counter(original_results[sid]['eventPPP']==0 for sid in old_matches)=={True:78,False:60}
    assert Counter(extension_results[sid]['eventPPP']==0 for sid in new_matches)=={True:8,False:4}
    outside=load(E/'replay-01/OUTSIDE.json');assert len(outside)==10
    assert Counter(r['gameId'] for r in outside)=={2026020137:7,2026020223:3}
    assert {r['sourceId'] for r in outside}=={t['sourceId'] for g in plan['outside'] for t in g['targets']}
    assert all(r['eventPPP'] is None and r['state']=='outside_retained_scope' for r in outside)
    prior_holds=sorted(r['sourceId'] for r in earlier_proofs if r['state']=='held')
    assert prior_holds==plan['preservePreviousHeldSourceIds']==[5598688,5599832,5600780,5600805,5600831]
    fp_before={sid for sid,r in rows.items() if r['tracks']['fantasyPoints']['corroboratedForThisRow']}
    for sid in matches:
        t=rows[sid]['tracks']['fantasyPoints'];assert t['unknownFields']==['pp_points'] and not t['differentFields'] and t['identityExposureFinalityMatched'] is True
        assert sid not in fp_before and sid not in prior_holds
    fp_after=fp_before|matches
    windows_before=[p for p in profiles if all(sid in fp_before for sid in p['sourceIds'])]
    windows_138=[p for p in profiles if all(sid in fp_before|old_matches for sid in p['sourceIds'])]
    windows_after=[p for p in profiles if all(sid in fp_after for sid in p['sourceIds'])]
    assert len(fp_before)==3140 and len(fp_after)==3290 and len(windows_before)==482 and len(windows_138)==580 and len(windows_after)==592
    unresolved={sid for sid,r in rows.items() if r['fields']['pp_points']['state']=='unknown'}-matches
    assert len(unresolved)==62 and len(set(original_results)-matches)==47
    assert unresolved==set(original_results)-matches|{r['sourceId'] for r in outside}|set(prior_holds)
    coverage=load(F/'CANDIDATE-COVERAGE.json')
    assert coverage['unionMatches']==150 and coverage['hypotheticalUnresolvedPPP']==62 and coverage['hypotheticalCorroboratedFPWindows']==592 and coverage['applicationAdmission'] is False
    for p,h in list(pins.items()):pin(p,h)
    output={'status':'passed','tests':16,'authenticatedFiles':len(pins),'visual':{'players':740,'selectedRecords':3461,'FPWindows':482,'unresolvedPPP':212,'zeroShotWindows':20,'allDisplayValuesAgreeWithPinnedInputs':True},
        'earlierEvidence':{'games':60,'targets':197,'outsideTargets':10,'bytes':total_bytes,'originalMatches':138,'extensionMatches':12,'unionMatches':150,'originalHeld':59,'unionHeld':47,'originalZeros':78,'extensionZeros':8,'previousFiveHolds':prior_holds,'FPWindowsBefore':482,'FPWindowsAfterOriginal':580,'FPWindowsAfterUnion':592,'FPWindowLengthsAfterUnion':dict(Counter(p['selectedRecords'] for p in windows_after)),'FPRecordsAfterUnion':3290,'unresolvedAfterUnion':62,'earliestEvidence':min(times,key=stamp),'latestEvidence':max(times,key=stamp),'sourceCapture':source_time,'controls':dict(stats),'gamesChecked':games_checked},
        'providerRequests':0,'databaseRequests':0,'productionRequests':0,'sourceEdits':0,'producerMainCalls':0,'holdoutAccess':0}
    (O/'PINS.json').write_text(json.dumps(pins,indent=2)+'\n');(O/'VERIFICATION.json').write_text(json.dumps(output,indent=2)+'\n')
    print(json.dumps({'status':'passed','tests':16,'pins':len(pins),'unionMatches':150,'windows':592,'unresolved':62}),flush=True)
finally:
    assert load(lock/'owner.json')==owner
    lock.rename(O/'RELEASED-DATA-LOCK')
