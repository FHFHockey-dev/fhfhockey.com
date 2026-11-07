"""Independent read-only verification of frozen January outputs. No fit/origin execution."""
import collections
import datetime
import hashlib
import json
import math
from pathlib import Path

OUT = Path(__file__).resolve().parent
TASK = Path('/Users/tim/Documents/Codex/2026-10-27/task-3')
JAN = TASK / 'january-replication-20240115-01'
VIS = TASK / 'native-production-visual-20261101-01'
REPO = Path('/Users/tim/Code/fhfhockey.com')
load = lambda p: json.loads(p.read_text())
lines = lambda p: [json.loads(s) for s in p.read_text().splitlines()]
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
digest = lambda x: hashlib.sha256(json.dumps(x, separators=(',', ':')).encode()).hexdigest()
finite = lambda x: isinstance(x, (int, float)) and not isinstance(x, bool) and math.isfinite(x)
total = lambda xs: sum(xs) if xs and all(finite(x) for x in xs) else None
sign = lambda x: (x > 0) - (x < 0)
max_errors = collections.defaultdict(float)
checks = collections.Counter()

def eq(a, b, kind='numeric'):
    checks[kind] += 1
    if a is None or b is None:
        assert a is b, (kind, a, b)
    else:
        max_errors[kind] = max(max_errors[kind], abs(a-b))
        assert math.isclose(a, b, rel_tol=1e-9, abs_tol=1e-9), (kind, a, b)

pins = []
for file in [VIS/'FINAL-SOURCE-PINS.json', JAN/'INPUT-PINS.json', JAN/'SOURCE-PINS.json', JAN/'native-annotation-01/INPUT-PINS.json']:
    for name, h in load(file).items():
        assert sha(Path(name)) == h, name
        pins.append(name)
for root in [VIS, JAN]:
    rec = load(root/'FINAL-RECEIPT.json')
    for name, meta in rec.get('artifacts', rec.get('files', {})).items():
        p = root/name
        assert sha(p) == meta['sha256'] and p.stat().st_size == meta['bytes'], str(p)
        pins.append(str(p))

input_pins = load(JAN/'INPUT-PINS.json')
history = lines(Path(next(p for p in input_pins if p.endswith('/dev-history.jsonl'))))
assert {r['season_id'] for r in history} == {20222023, 20232024}
assert len({r['id'] for r in history}) == len(history)
byid = {r['id']:r for r in history}
train, current = collections.defaultdict(list), collections.defaultdict(list)
for r in history:
    if r['season_id'] == 20222023: train[r['player_id']].append(r)
    elif r['date'] < '2024-01-15': current[r['player_id']].append(r)
for group in [train, current]:
    for rr in group.values(): rr.sort(key=lambda r:(r['date'],r['id']))
FP = {'goals':3,'assists':2,'pp_points':1,'shots':.2,'hits':.2,'blocked_shots':.25}
GS = {'goals':.75,'total_primary_assists':.7,'total_secondary_assists':.55,'shots':.075,'blocked_shots':.05,'penalties_drawn':.15,'penalties':-.15,'total_fow':.01,'total_fol':-.01,'sat_for':.05,'sat_against':-.05,'es_goals_for':.15,'pp_goals_for':.15,'sh_goals_for':.15,'es_goals_against':-.15,'pp_goals_against':-.15,'sh_goals_against':-.15}
def outcomes(r):
    def weighted(weights):
        return sum(r[k]*v for k,v in weights.items()) if r['games_played']==1 and all(finite(r.get(k)) and r[k]>=0 for k in weights) else None
    pts=weighted({'goals':1,'assists':1})
    if pts is not None and r.get('points') is not None and not math.isclose(pts,r['points'],abs_tol=1e-10): pts=None
    return [weighted(FP),pts,weighted(GS)]
def proc(r):
    ind, oi = r['nst_individual'], r['nst_onice']
    t=r['toi_per_game']
    a=ind[0] if len(ind)==1 else {}
    b=oi[0] if len(oi)==1 else {}
    x=a.get('nst_ixg') if r['games_played']==1 and a.get('nst_gp')==1 and a.get('nst_toi')==t else None
    yz=[b.get('xgf'), b.get('xga')] if r['games_played']==1 and b.get('gp')==1 and b.get('toi')==t else [None,None]
    if not all(finite(v) and v>=0 for v in yz): yz=[None,None]
    return [x if finite(x) and x>=0 else None, *yz]
def rates(rr):
    t=total([r['toi_per_game'] for r in rr])
    vals=[total([proc(r)[j] for r in rr]) for j in range(3)]
    return [3600*v/t if v is not None and t and t>0 else None for v in vals]
def inverse(a):
    n=len(a); z=[list(row)+[int(i==j) for j in range(n)] for i,row in enumerate(a)]
    for i in range(n):
        pivot=max(range(i,n),key=lambda j:abs(z[j][i])); z[i],z[pivot]=z[pivot],z[i]
        d=z[i][i]; assert abs(d)>1e-15
        z[i]=[x/d for x in z[i]]
        for j in range(n):
            if j!=i:
                d=z[j][i]; z[j]=[x-d*y for x,y in zip(z[j],z[i])]
    return [row[n:] for row in z]

dep=load(JAN/'pilot-01/FIT-DEPENDENCIES.json')
rows=lines(JAN/'pilot-01/PLAYER-EVIDENCE.jsonl')
fits={f['playerId']:f for f in lines(JAN/'pilot-01/FITTED-PARAMETERS.jsonl')}
assert set(current)=={p['playerId'] for p in rows}==set(fits)
assert len(rows)==824 and len(dep['trainingBlocks'])==5216 and len(dep['donors'])==553
seen=set()
for b in dep['trainingBlocks']:
    rr=[byid[i] for i in b['sourceIds']]
    assert len(rr)==5 and len(set(b['sourceIds']))==5 and not seen.intersection(b['sourceIds'])
    seen.update(b['sourceIds'])
    assert all(r['season_id']==20222023 and r['player_id']==b['playerId'] for r in rr)
    assert [r['date'] for r in rr]==b['dates'] and b['dates'][-1]<'2023-07-01'
    t=sum(r['toi_per_game'] for r in rr); eq(t,b['seconds'],'block_seconds')
    for j in range(3):
        eq(rates(rr)[j],b['X'][j],'block_process')
        eq(sum(outcomes(r)[j] for r in rr)*3600/t,b['Y'][j],'block_outcome')
for d in dep['donors']:
    rr=train[d['player_id']][-50:]
    assert len(rr)==50 and [r['id'] for r in rr]==d['source_ids']
    assert d['end']==rr[-1]['date']<'2023-07-01'
    for j in range(3): eq(sum(outcomes(r)[j] for r in rr)/sum(r['toi_per_game'] for r in rr),d['rate'][j],'donor_rate')

for p in rows:
    pid=p['playerId']; w=current[pid][-5:]; before=w[0]['date']; f=fits[pid]
    h=[r for r in train.get(pid,[]) if r['date']<before][-50:]
    assert [r['id'] for r in w]==p['window']['sourceIds']
    assert [r['id'] for r in h]==p['reference']['sourceIds']
    assert all('2023-07-01'<=r['date']<'2024-01-15' for r in w)
    assert f['cutoff']==before and all(r['date']<before for r in h)
    m=f['support']; prior=f['production']
    assert m and prior and m['cutoff']==before and m['targetId']==pid and m['priorLastDate']<before
    donor=[d for d in dep['donors'] if d['player_id']!=pid and d['position']==p['position']]
    assert prior['targetExcluded'] and digest([d['player_id'] for d in donor])==prior['donorIdentitySHA256']
    assert all(d['end']<before for d in donor)
    groups=collections.defaultdict(list)
    for b in dep['trainingBlocks']:
        if b['playerId']!=pid and b['position']==p['position'] and b['dates'][-1]<before and len(set(t for t in b.get('teams',[]) if t is not None))<=1 and all(q is None or q==p['position'] for q in b.get('positions',[])):
            groups[b['playerId']].append(b)
    used=[(k,v) for k,v in sorted(groups.items()) if len(v)>=2]
    ids=[i for _,bb in used for b in bb for i in b['sourceIds']]
    assert digest(ids)==m['sourceIdsSHA256'] and len(ids)==m['sourceIdsCount']
    assert len(used)==m['donors'] and len(ids)==len(set(ids))
    for weight in m['playerWeightSums'].values(): eq(weight,1/len(used),'donor_weight')
    inv=inverse(m['Cxx'])
    for i in range(3):
        for j in range(3): eq(.5*sum(inv[i][k]*m['Cxy'][k][j] for k in range(3)),m['beta'][i][j],'coefficient_algebra')
    assert len(p['leaveOneOut'])==len(w)
    for v in [None,*p['leaveOneOut']]:
        rr=w if v is None else [r for r in w if r['id']!=v['removedSourceId']]
        t=total([r['toi_per_game'] for r in rr]); native=p['native'] if v is None else v['native']
        eq(t,p['window']['seconds'] if v is None else v['seconds'],'window_seconds')
        if v is not None: assert len(rr)==v['remainingAppearances']==len(w)-1
        cp=rates(rr); hp=rates(h); observed=[i for i,x in enumerate(cp) if x is not None]
        delta=[0]*3
        for i in observed: delta[i]=cp[i]-(hp[i] if hp[i] is not None else m['cohortX'][i])
        missing=[i for i in range(3) if i not in observed]
        if observed and missing:
            invobs=inverse([[m['Cxx'][i][j] for j in observed] for i in observed])
            for i in missing:
                delta[i]=sum(m['Cxx'][i][k]*invobs[ki][ji]*delta[j] for ki,k in enumerate(observed) for ji,j in enumerate(observed))
        numeric=bool(rr and t and observed)
        actual=[total([outcomes(r)[j] for r in rr]) for j in range(3)]
        baseline=[r*t for r in p['production']['reference_rate']] if t else [None]*3
        support=[baseline[j]+t/3600*sum(delta[i]*m['beta'][i][j] for i in range(3)) for j in range(3)] if numeric else [None]*3
        if numeric: support=[max(x,0) if j<2 else x for j,x in enumerate(support)]
        for j,n in enumerate(native):
            eq(actual[j],n['actualTotal'],'native_actual')
            eq(baseline[j],n['baselineExpectedAtObservedTOI'],'native_baseline')
            eq(support[j],n['supportExpectedAtObservedTOI'],'native_support')
            for kind,expected in [('baseline',baseline[j]),('support',support[j])]:
                gap=expected-actual[j] if expected is not None and actual[j] is not None else None
                eq(gap,n[kind+'GapAtObservedTOI'],'native_gap')
                eq(gap*3600/t if gap is not None and t else None,n[kind+'GapPer60'],'native_per60')
        value=p['score']['value'] if v is None else v['value']
        if not numeric:
            assert value is None
            continue
        refcov=p['production']['joint_gap_covariance']
        full_t=p['window']['seconds']
        # Recover the frozen reference-rate covariance from full-window covariance.
        cov=[[(refcov[i][j]-prior['omega'][i][j]*full_t)/(full_t**2)*t*t+prior['omega'][i][j]*t for j in range(3)] for i in range(3)]
        sd=[math.sqrt(cov[i][i]) for i in range(3)]
        denom=sum(cov[i][j]/sd[i]/sd[j]/9 for i in range(3) for j in range(3))
        a=[1/3/s/math.sqrt(denom) for s in sd]
        g=sum(a[j]*(support[j]-actual[j]) for j in range(3))
        baseg=sum(a[j]*(baseline[j]-actual[j]) for j in range(3))
        eq(g,p['score']['normalizedGap'] if v is None else v['gap'],'normalized_gap')
        eq(baseg,p['score']['baselineNormalizedGap'] if v is None else v['baselineGap'],'normalized_baseline')
        eq(100*g/(1+abs(g)),value,'bounded_index')
        age=(datetime.date(2024,1,14)-datetime.date.fromisoformat(rr[-1]['date'])).days
        fresh=0<=age<=7
        assert fresh==(p['window']['fresh'] if v is None else v['fresh'])
        eligible=fresh and sign(g)!=0 and sign(g)==sign(baseg)
        side=('BL' if g>0 else 'SH') if eligible else None
        if v is None:
            assert side==p['score']['researchList']
            for j,c in enumerate(p['components']):
                eq(sum(x['value'] for x in c['components']),c['gap'],'component_sum')
                eq(a[j],c['normalizedWeight'],'normalization_weight')
        else:
            assert (v['label'] if v['label'] in ['BL','SH'] else None)==side
            assert v['numericComparable']==(p['score']['value'] is not None)
            assert v['signAgrees']==(sign(g)==sign(p['score']['normalizedGap'])) if p['score']['value'] is not None else v['signAgrees'] is None

variants=[v for p in rows for v in p['leaveOneOut']]
summary={'profiles':len(rows),'numeric':sum(p['score']['value'] is not None for p in rows),'lists':dict(collections.Counter(p['score']['researchList'] or 'withheld' for p in rows)),'zeroShot':{'profiles':sum(p['window']['shots']==0 for p in rows),'numeric':sum(p['window']['shots']==0 and p['score']['value'] is not None for p in rows),'listed':sum(p['window']['shots']==0 and p['score']['researchList'] is not None for p in rows)},'variants':len(variants),'numericComparisons':sum(v['numericComparable'] for v in variants),'signChanges':sum(v['signAgrees'] is False for v in variants),'emptyUnavailable':sum(v['remainingAppearances']==0 and v['value'] is None for v in variants)}
snapshot=load(REPO/'web/lib/buyLowSellHigh/research-snapshots/2026-10-28.arm-a-canonical-repaired.v2.json')
mislabeled=[{'playerId':p['playerId'],'name':p['displayName'],'ageDays':p['evidence']['window']['lastGameDaysBeforeRecordedThrough'],'reason':p['score']['reason'],'freshnessText':p['evidence']['window']['freshnessText']} for p in snapshot['profiles'] if p['evidence']['window']['lastGameDaysBeforeRecordedThrough'] is not None and 0<=p['evidence']['window']['lastGameDaysBeforeRecordedThrough']<=7 and not p['evidence']['window']['fresh']]
(OUT/'STALE-LABEL-CASES.json').write_text(json.dumps(mislabeled,indent=2)+'\n')
result={'state':'PASS_FROZEN_ARITHMETIC_AND_LINEAGE_WITH_SEPARATE_DISPLAY_FINDING','pinChecks':len(pins),'uniquePinnedFiles':len(set(pins)),'summary':summary,'checks':dict(checks),'maximumAbsoluteResiduals':dict(max_errors),'recentProfilesLabeledStale':len(mislabeled),'scope':'Existing frozen outputs only; no new origin, fitting, source editing, network, holdout or production access.'}
(OUT/'RESULT.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result,indent=2))
