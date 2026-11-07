from pathlib import Path
from collections import Counter
import json,hashlib
p=Path('/Users/tim/Documents/Codex/2026-10-27/task-3/practical-use-comparison-20261101-01');o=Path(__file__).resolve().parent
load=lambda x:json.loads(x.read_text())
rows=load(p/'comparison-02/ALL-PROFILES.json');lookup={r['playerId']:r for r in rows};sel=load(p/'comparison-02/SELECTIONS.json');summary=load(p/'comparison-02/SUMMARY.json');checked=0
for a,sides in sel.items():
 for s,ranking in sides.items():
  selected=[lookup[r['playerId']] for r in ranking]
  strata={'n':len(selected),'under30minutes':sum(r['window']['minutes']<30 for r in selected),'zeroShots':sum(r['window']['shots']==0 for r in selected),'shotsUnknown':sum(r['window']['shots'] is None for r in selected),'referenceCounts':dict(Counter('cohort_only' if r['reference']['personalN']==0 else '1to4' if r['reference']['personalN']<5 else '5to49' if r['reference']['personalN']<50 else '50' for r in selected)),'imputedProcess':sum(r['imputedProcessCount'] is not None and r['imputedProcessCount']>0 for r in selected),'processUnavailable':sum(r['imputedProcessCount'] is None for r in selected)}
  assert strata==summary['selectedStrata'][a][s];checked+=1
cards=load(p/'comparison-02/BLINDED/CASES.json');md=(p/'comparison-02/BLINDED/REVIEW.md').read_text();seed=load(p/'CONTRACT.json')['caseSelectionSeed']
assert cards==sorted(cards,key=lambda c:hashlib.sha256((seed+':display:'+c['caseId']).encode()).hexdigest())
for c in cards:
 section=md.split('## Case '+c['caseId']+'\n',1)[1].split('## Case ',1)[0];v=c['FP']
 assert f"{c['appearances']} recorded appearances · {c['minutes']:.2f} total minutes" in section
 for label,value in [('Actual production',v['actualTotal']),('Historical comparison',v['baselineExpectedAtObservedTOI']),('Support comparison',v['supportExpectedAtObservedTOI'])]:assert f'| {label} | {value:.2f} |' in section
 for k in ['baselineGapPer60','supportGapPer60']:assert f"{v[k]:.2f} versus actual" in section
 assert f"personal estimator weight {c['personalEstimatorWeight']:.2f}" in section
z=[r for r in rows if r['window']['shots']==0];assert len(z)==42
result={'selectedStrataReconciled':checked,'markdownCasesReconciled':len(cards),'hashShuffledDisplayOrder':True,'zeroShotProfiles':len(z),'zeroShotDirectional':{a:sum(r['arms'][a]['side'] is not None for r in z) for a in sel}}
assert set(result['zeroShotDirectional'].values())=={16}
# Final read confirms only audit artifacts changed during these checks.
pins=load(o/'PINS.json');assert all(hashlib.sha256(Path(path).read_bytes()).hexdigest()==pin['sha256'] for path,pin in pins.items());result['all84PinsUnchangedAtFinish']=True
(o/'PACKET-STRATA.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
