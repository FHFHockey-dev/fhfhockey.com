"""Independent retained-event PPP recount and hypothetical coverage arithmetic."""
import sys
sys.dont_write_bytecode=True
from pathlib import Path
from collections import Counter
from datetime import datetime,date
import hashlib,json,os,re
from bs4 import BeautifulSoup

O=Path(__file__).resolve().parent
B=Path('/Users/tim/Documents/Codex/2026-10-27/task-3')
P=B/'ppp-event-attribution-20261101-01';S=B/'production-track-evidence-20261101-01'
load=lambda p:json.loads(Path(p).read_text())
sha=lambda raw:hashlib.sha256(raw).hexdigest()
stamp=lambda s:datetime.fromisoformat(s.replace('Z','+00:00'))
pins={}
def pin(path,expected):
    path=Path(path);raw=path.read_bytes();assert sha(raw)==expected,str(path)
    pins[str(path)]=expected;return raw
def no_network(event,args):
    if event in ('socket.connect','socket.bind','socket.getaddrinfo'):raise RuntimeError('Audit forbids network')
sys.addaudithook(no_network)
lock=Path('/private/tmp/fhfh-heavy.lock');owner={'owner':'codex-blsh-ppp-event-independent-recount','pid':os.getpid()}
lock.mkdir();(lock/'owner.json').write_text(json.dumps(owner))
try:
    final=load(P/'FINAL-RECEIPT.json');pin(P/'FINAL-RECEIPT.json',sha((P/'FINAL-RECEIPT.json').read_bytes()))
    for k in ['files','sharedSourcePins']:
        for path,h in final[k].items():pin(path,h)
    for file in ['INPUT-PINS.json','RUN-PINS.json']:
        for path,h in load(P/file).items():pin(path,h)
    assert pins[str(P/'PLAN.json')]=='5018553d66fa072b3a693e2a0923400c0be1ce4c057b887e4b3a06c81b8af43f'
    accepted=load(O.parent/'blsh-event-evidence-audit-2026-11-01/PINS.json')
    plan=load(P/'PLAN.json')
    all_refs=load(B/'official-event-evidence-20261101-01/qualification-01/EVIDENCE.json')
    queue=load(S/'gate-accounting-02/UNRESOLVED-PPP-EVIDENCE-QUEUE.json')
    queue_rows={t['sourceId']:t for g in queue for t in g['targetRows']}
    assert sum(len(g['targetRows']) for g in queue)==len(queue_rows)==407
    selected_queue={g['gameId']:g for g in queue if str(g['gameId']) in all_refs}
    assert len(plan['games'])==len({g['gameId'] for g in plan['games']})==len(selected_queue)==31
    targets={t['sourceId']:t for g in plan['games'] for t in g['targets']}
    assert len(targets)==sum(len(g['targets']) for g in plan['games'])==200
    assert set(targets)=={t['sourceId'] for g in selected_queue.values() for t in g['targetRows']}
    capture=load(B/'current-refresh-reader-20261101-01/live-read-01/capture/CURRENT-REQUEST.json')
    source={r['id']:r for r in capture['wgo']['rows']};assert len(source)==len(capture['wgo']['rows'])==8135
    prior={r['sourceId']:r for r in load(B/'fresh-box-qualification-20261101-01/qualification-01/COMBINED-ROW-EVIDENCE.json')}
    output=load(P/'qualification-01/ROWS.json');rows={r['sourceId']:r for r in output}
    output_games=load(P/'qualification-01/GAMES.json');game_results={g['gameId']:g for g in output_games}
    assert len(output)==len(rows)==200 and set(rows)==set(targets)
    assert len(output_games)==len(game_results)==31
    totals=Counter();holds=[];goalie_credits=[];recount_games=[];matches=set();all_values={}
    for g in plan['games']:
        gid=g['gameId'];day=g['date'];ref=g['evidence'];assert g['targets']==selected_queue[gid]['targetRows']
        assert ref==all_refs[str(gid)] and '2026-10-27'<=day<='2026-10-31'
        bodies={};times=[]
        for key,expected_url in [('box',f'https://api-web.nhle.com/v1/gamecenter/{gid}/boxscore'),('playByPlay',f'https://www.nhl.com/scores/htmlreports/20262027/PL{gid%1000000:06d}.HTM')]:
            e=ref[key];body=pin(e['bodyPath'],accepted[e['bodyPath']]);receipt=json.loads(pin(e['receiptPath'],accepted[e['receiptPath']]))
            assert receipt['url']==expected_url and receipt['httpStatus']==200 and receipt['TLSVerified'] is True and receipt['status']=='success'
            assert receipt['bytes']==len(body) and receipt['sha256']==sha(body)
            assert stamp(capture['asOfUTC'])<stamp(receipt['retrievedAtUTC'])<stamp(plan['atUTC'])
            bodies[key]=body;times.append(receipt['retrievedAtUTC'])
        box=json.loads(bodies['box']);assert (box['id'],box['season'],box['gameType'],box['gameDate'])==(gid,20262027,2,day) and box['gameState'] in ['OFF','FINAL']
        players={};lookup={};teams=[box[s]['abbrev'] for s in ['awayTeam','homeTeam']]
        for side in ['awayTeam','homeTeam']:
            team=box[side]['abbrev']
            for category in ['forwards','defense','goalies']:
                for player in box['playerByGameStats'][side][category]:
                    key=(team,player['sweaterNumber']);assert key not in lookup and player['playerId'] not in players
                    lookup[key]=player['playerId'];players[player['playerId']]={'box':player,'team':team,'goalie':category=='goalies'}
        skaters={pid:p for pid,p in players.items() if not p['goalie']};assert len(skaters)==36
        counts={pid:Counter() for pid in players}
        soup=BeautifulSoup(bodies['playByPlay'],'html.parser')
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
        credits=[];team_goals=Counter();game_goalies=[];shootout=0
        for v in ledger:
            if v[4]!='GOAL':continue
            period=int(v[1]);assert 1<=period<=5
            if period==5:
                assert box['gameOutcome']['lastPeriodType']=='SO';shootout+=1;continue
            strength=v[2];assert strength in ['EV','PP','SH']
            desc=v[5];assert 'Penalty Shot' not in desc
            team=desc.split(' ',1)[0];assert team in teams
            # Separate token grammar: enumerate credited actors, then validate their sections.
            actors=list(re.finditer(r'#(\d{1,2})\s+([^#;()]+)\((\d+)\)',desc))
            assert 1<=len(actors)<=3 and len(actors)==desc.count('#')
            numbers=[int(a[1]) for a in actors];assert len(set(numbers))==len(numbers)
            assert desc[:actors[0].start()].strip()==team and desc[actors[0].end():].startswith(',')
            marker=re.search(r'\bAssists?:',desc)
            assert (marker is not None)==(len(actors)>1)
            if marker:
                assist_text=desc[marker.end():].strip()
                assert assist_text=='; '.join(a.group(0) for a in actors[1:])
            ids=[lookup[team,n] for n in numbers]
            for index,pid in enumerate(ids):
                role='goals' if index==0 else 'assists';counts[pid][role]+=1
                if strength=='PP':counts[pid]['pp_goals' if index==0 else 'pp_assists']+=1
                if players[pid]['goalie']:
                    assert 'goals' not in players[pid]['box'] and 'assists' not in players[pid]['box']
                    game_goalies.append({'gameId':gid,'eventNumber':int(v[0]),'playerId':pid,'team':team,'credit':'goal' if index==0 else 'assist','strength':strength,'description':desc})
            team_goals[team]+=1
            credits.append({'eventNumber':int(v[0]),'period':period,'strength':strength,'team':team,'scorerId':ids[0],'assistIds':ids[1:],'description':desc})
        for pid,p in skaters.items():
            assert [counts[pid][k] for k in ['goals','assists','pp_goals']]==[p['box'][k] for k in ['goals','assists','powerPlayGoals']],(gid,pid)
            totals['skaterBoxOperands']+=3
        scores={box[s]['abbrev']:box[s]['score'] for s in ['awayTeam','homeTeam']}
        if box['gameOutcome']['lastPeriodType']=='SO':
            assert team_goals[teams[0]]==team_goals[teams[1]]
            winner=max(scores,key=scores.get);assert all(scores[t]-team_goals[t]==int(t==winner) for t in teams)
        else:assert all(team_goals[t]==scores[t] for t in teams)
        gr=game_results[gid]
        if game_goalies:
            assert gid==2026020224 and gr['state']=='held' and gr['reason']=='unknown_or_goalie_credit_held' and gr['events']==[] and gr['controls']==0
            assert game_goalies[0]['eventNumber']==295 and game_goalies[0]['playerId']==8476932 and game_goalies[0]['credit']=='assist' and game_goalies[0]['strength']=='EV'
        else:
            assert gr['state']=='reconciled' and gr['reason'] is None and gr['events']==credits and gr['controls']==36 and gr['excludedShootoutGoalEvents']==shootout
            totals['reconciledGames']+=1;totals['qualifiedControlRows']+=36;totals['qualifiedGoalEvents']+=len(credits)
        totals['allGoalEvents']+=len(credits);totals['excludedShootoutGoalEvents']+=shootout;goalie_credits.extend(game_goalies)
        for t in g['targets']:
            sid=t['sourceId'];r=rows[sid];s=source[sid];q=prior[sid]['boxQualification'];pid=t['playerId']
            assert t==queue_rows[sid] and all(r[k]==v for k,v in t.items())
            assert (s['player_id'],s['game_id'],s['date'],s['team_abbrev'],s['counts']['pp_points'])==(pid,gid,day,t['team'],t['capturedPPP'])
            assert pid in skaters and skaters[pid]['team']==s['team_abbrev']
            m,sec=map(int,skaters[pid]['box']['toi'].split(':'));official_toi=m*60+sec
            assert q['TOI']['official']==official_toi and q['TOI']['wgo']==s['toi_per_game']
            assert r['evidenceAvailableAtUTC']==max(times,key=stamp) and r['sourceCaptureAtUTC']==capture['wgo']['capture']['retrievedAtUTC']
            assert r['originalPublicationUTC'] is None and r['scoringAdmission'] is False and r['canonicalUpdates']==0 and r['weakGFAWitnessAndGameScoreHoldsUnchanged'] is True and r['otherHoldsNotCleared'] is True
            if game_goalies:
                assert r['eventPPP'] is None and r['state']=='held' and r['reason']=='unknown_or_goalie_credit_held'
                holds.append({'sourceId':sid,'gameId':gid,'reason':r['reason'],'team':s['team_abbrev']})
            elif q['state']!='identity_team_exposure_qualified':
                assert sid in [5598688,5599832] and s['toi_per_game']!=official_toi
                assert r['eventPPP'] is None and r['state']=='held' and r['reason']=='prior_exposure_hold'
                holds.append({'sourceId':sid,'gameId':gid,'reason':r['reason'],'sourceTOI':s['toi_per_game'],'officialTOI':official_toi})
            else:
                assert official_toi==s['toi_per_game']>0 and s['games_played']==1 and q['gameFinality']=='final'
                value=counts[pid]['pp_goals']+counts[pid]['pp_assists']
                assert r['state']=='matched' and r['reason'] is None and r['eventPPP']==value==t['capturedPPP']
                matches.add(sid);all_values[sid]=value;totals['zeroMatches' if value==0 else 'nonzeroMatches']+=1
        recount_games.append({'gameId':gid,'goals':len(credits),'skaterControls':len(skaters),'goalieCredits':len(game_goalies),'targetRows':len(g['targets'])})
        print(json.dumps({'gameId':gid,'independentRecount':'passed','retainedMethodHold':bool(game_goalies)}),flush=True)
    assert len(matches)==195 and len(holds)==5 and len(goalie_credits)==1
    assert totals['zeroMatches']==113 and totals['nonzeroMatches']==82 and totals['skaterBoxOperands']==3348
    assert totals['allGoalEvents']==211 and totals['qualifiedGoalEvents']==205 and totals['qualifiedControlRows']==1080 and totals['reconciledGames']==30
    # Authenticate the sidecar baseline, but keep its separate acceptance status explicit.
    sidecar_receipt=json.loads(pin(S/'FINAL-RECEIPT.json','c757c91fe13e452a9c17b741404d9aa1671bf62bc052a0df96f5a899b87d4278'))
    for f in ['sidecar-01/ROW-TRACK-EVIDENCE.json','sidecar-01/PROFILE-TRACK-EVIDENCE.json','INPUT-PINS.json']:
        path=S/f;pin(path,sidecar_receipt['files'][str(path)])
    for path,h in load(S/'INPUT-PINS.json').items():pin(path,h)
    side_rows=load(S/'sidecar-01/ROW-TRACK-EVIDENCE.json');side={r['sourceId']:r for r in side_rows}
    profiles=load(S/'sidecar-01/PROFILE-TRACK-EVIDENCE.json')
    contexts=load(B/'current-refresh-reader-20261101-01/production-context-02/CONTEXTS.json')['profiles']
    by_player={p['playerId']:p for p in contexts};assert len(profiles)==len({p['playerId'] for p in profiles})==len(by_player)==740
    fresh={r['sourceId']:r for r in load(B/'fresh-box-qualification-20261101-01/ppp-extension-01/ROWS.json')}
    original=set();hypothetical=set();other_differences=[];unknown=set()
    assert len(side)==len(side_rows)==len(prior)==3461 and set(side)==set(prior)
    for sid,r in side.items():
        q=prior[sid]['boxQualification'];s=source[sid];pp=q.get('PPP');old=prior[sid].get('priorPPP');new=fresh.get(sid)
        ppp_matched=bool(pp and pp['state']=='match' or old and old['state'] in ['prior_direct_match','prior_uniquely_derived_match'] or new and new['state']=='uniquely_implied' and new['wgoComparison']=='matches_unique_value')
        assert ppp_matched==(r['fields']['pp_points']['state']=='matched')
        if not ppp_matched:unknown.add(sid)
        exposure=q['state']=='identity_team_exposure_qualified' and q['gameFinality']=='final' and q['TOI']['state']=='match' and q['team']=='match' and q['appearance']=='positive_official_TOI'
        if exposure:assert s['games_played']==1 and s['toi_per_game']==q['TOI']['official']>0
        different=[];known=True
        for k in ['goals','assists','shots','hits','blocked_shots']:
            fact=q['counts'].get(k)
            if fact:assert fact['wgo']==s['counts'][k]
            status='matched' if fact and fact['state']=='match' else 'different' if fact and fact['state']=='mismatch' else 'unknown'
            assert r['fields'][k]['state']==status
            if status=='different':different.append(k)
            known=known and status=='matched'
        original_match=exposure and known and ppp_matched
        assert r['tracks']['fantasyPoints']['corroboratedForThisRow']==original_match
        if original_match:original.add(sid);hypothetical.add(sid)
        if sid in matches:
            assert not ppp_matched and r['tracks']['fantasyPoints']['unknownFields']==['pp_points'] and exposure
            if known:hypothetical.add(sid)
            else:other_differences.append({'sourceId':sid,'differentFields':different})
        assert r['scoringAdmission'] is False and r['fullProfileQualified'] is False
    assert len(unknown)==407 and unknown==set(queue_rows)
    original_windows=set();hypothetical_windows=set();selection=[]
    for p in profiles:
        c=by_player[p['playerId']];ids=p['sourceIds'];selection.extend(ids)
        assert ids==c['sourceIds'] and p['shots']==c['shots']
        assert p['tracks']['fantasyPoints']['capturedMetric']==next(m for m in c['metrics'] if m['key']=='fantasyPoints')
        assert p['capturedGameScore']==next(m for m in c['metrics'] if m['key']=='wigoGameScore')
        assert p['combinedScore'] is None and p['buySellLabel'] is None and p['baselineComparison'] is None and p['confidenceProbability'] is None and p['fullProfileQualified'] is False and p['productionAdopted'] is False
        if set(ids)<=original:original_windows.add(p['playerId'])
        if set(ids)<=hypothetical:hypothetical_windows.add(p['playerId'])
    assert len(selection)==len(set(selection))==3461 and set(selection)==set(side)
    assert len(original)==2950 and len(hypothetical)==3140 and len(other_differences)==5
    assert len(original_windows)==379 and len(hypothetical_windows)==482 and len(hypothetical_windows-original_windows)==103
    assert len(unknown-matches)==212 and len((unknown-set(targets)))==207
    assert sum(p['shots']==0 for p in profiles)==20
    before=load(P/'CANDIDATE-COVERAGE.json');after=load(P/'CANDIDATE-COVERAGE-v2.json');correction=load(P/'COVERAGE-LABEL-CORRECTION.json')
    assert sha((P/'CANDIDATE-COVERAGE.json').read_bytes())==correction['originalSHA256'] and sha((P/'CANDIDATE-COVERAGE-v2.json').read_bytes())==correction['revisedSHA256']
    assert {k.replace('acceptedSidecar','previousSidecar'):v for k,v in before.items()}==after
    assert after['hypotheticalCandidateFPRowIntersection']==len(hypothetical) and after['hypotheticalCandidateFPWindowIntersection']==len(hypothetical_windows)
    assert after['previousSidecarFPRowIntersection']==len(original) and after['previousSidecarFPWindowIntersection']==len(original_windows)
    assert after['candidateAdditionalWindows']==103 and after['hypotheticalUnresolvedPPPAfter']==212 and after['candidateMatchesRetainingOtherFieldDifferences']==5
    assert after['reviewRequiredBeforeUsingCandidate'] is True and after['sidecarNotChanged'] is True and after['appliedToCurrentApplication'] is False and after['scoresComputed']==0
    # Keep the separate Game Score trial unchanged, without importing any score logic.
    prior_trial_pins=load(O.parent/'blsh-isolated-component-audit-2026-11-01/PINS.json')
    trial_path=B/'isolated-component-admission-20261101-01/verification-and-trial-01/ISOLATED-TRIAL.json'
    trial=json.loads(pin(trial_path,prior_trial_pins[str(trial_path)]))
    assert len(trial['copies'])==163 and Counter(d['state'] for d in trial['decisions'])=={'withheld':117,'composed_for_offline_review':163}
    for path,h in pins.items():assert sha(Path(path).read_bytes())==h
    named=[]
    for sid in sorted(matches):
        s=source[sid]
        if s['player_name'] in ['Teuvo Teravainen','Connor Bedard','Filip Forsberg','Brent Burns']:
            named.append({'sourceId':sid,'name':s['player_name'],'gameId':s['game_id'],'PPP':all_values[sid]})
    report={'pass':True,'pinsVerifiedAndUnchanged':len(pins),'planRows':200,'planGames':31,'selectedExactlyFromUnresolvedAndRetainedGames':True,'matched':len(matches),'held':holds,'tallies':dict(totals),'goalieCredits':goalie_credits,'otherDifferencesRetained':other_differences,
            'coverage':{'previousRows':len(original),'hypotheticalRows':len(hypothetical),'previousWindows':len(original_windows),'hypotheticalWindows':len(hypothetical_windows),'additionalWindows':103,'unresolvedBefore':407,'hypotheticalUnresolvedAfter':212,'outsideEventScopeUnresolved':207,'zeroShotWindows':20},
            'namedExamples':named,'sourceCaptureAtUTC':capture['asOfUTC'],'eventThroughDate':capture['eventThroughDate'],'sourceRowsUnchanged':True,'sidecarUnchanged':True,'metadataRenameOnly':True,'separateGameScoreTrialUnchanged':True,'networkDenied':True,'scoresComputed':0,'productionActions':0,'games':recount_games}
    (O/'PINS.json').write_text(json.dumps(pins,indent=2)+'\n');(O/'VERIFICATION.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({k:v for k,v in report.items() if k!='games'}))
finally:
    assert load(lock/'owner.json')==owner
    lock.rename(O/'recount-lock-released')
