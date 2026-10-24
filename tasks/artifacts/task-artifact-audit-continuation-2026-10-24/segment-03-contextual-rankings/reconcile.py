from pathlib import Path
import copy, datetime, hashlib, json, re, sys

ROOT=Path('/Users/tim/Code/fhfhockey.com'); OUT=Path(__file__).resolve().parent
START=json.loads((OUT/'START.json').read_text()); NOW=datetime.datetime.now(datetime.timezone.utc).isoformat()
PATHS=list(START['canonical_checkpoint'])
for p,h in START['canonical_checkpoint'].items():
    assert hashlib.sha256((ROOT/p).read_bytes()).hexdigest()==h,p+' advanced; preserve current writer'
    target=OUT/('BASELINE-'+Path(p).name)
    if not target.exists():target.write_bytes((ROOT/p).read_bytes())
RAW={p:(OUT/('BASELINE-'+Path(p).name)).read_bytes() for p in PATHS}
B=json.loads(RAW[PATHS[2]]); J=copy.deepcopy(B); BY={t['taskID']:t for t in J['tasks']}; OLD={t['taskID']:t for t in B['tasks']}; CHANGES={}
R='tasks/TASKS/contextual-hockey-rankings/'
def ev(path,marker=None):
    b=(ROOT/path).read_bytes();lines=b.decode().splitlines();line=next((i for i,s in enumerate(lines,1) if marker and marker in s),1)
    assert not marker or marker in lines[line-1],(path,marker)
    return {'path':path,'line':line,'sha256':hashlib.sha256(b).hexdigest(),'observed_at':NOW,'review_scope':'Full documentary source read; audit did not run underlying tests, inspect all referenced raw evidence, or observe hosted state.'}
def update(tid,fields,refs,clauses=()):
    t=BY[tid];before={k:t.get(k) for k in fields};t.update(fields);t['as_of']=NOW;t['evidence'].extend(refs)
    if clauses:t.setdefault('artifact_audit_retained_scopes',[]).extend(clauses)
    t.setdefault('artifact_audit_segment03',[]).append({'at':NOW,'before_fields':before,'scope':'Documentary current-status overlay; v4 checkpoint and all earlier evidence preserved.'})
    CHANGES[tid]={'before_fields':before,'fields':fields,'new_evidence':refs,'retained_clauses':list(clauses)}
update('BILLING-CANCEL-RELOAD',{
 'implementation':'C3 isolated reload-continuity candidate is independently ACCEPT WITH LIMITS at patch c500b580b79f2bd1ce3bc00e50630ea3ac1d47bd1985843c53121cb8a9b420ff. Restore rejects request IDs aged 24h; it does not automatically delete storage bytes. Canonical panel trio remains unchanged and candidate is excluded from frozen release r1. The exact shared-auth proposal is tested only in reviewer-owned copies, remains unapplied canonically and held for exact parent source/test lease.',
 'acceptance':'Independent reviewer passed 9/9 focused offline controls for reload/storage/reset boundaries; owner52-case receipt was inspected, not rerun. Reload continuity alone is accepted with limits. Sign-out/privacy cleanup is not complete: app unmount can leave private billing metadata, and an independent48h control proves 24h is reuse eligibility rather than a physical retention guarantee. No real financial/provider or full-product acceptance.',
 'verification':'Full independent REVIEW.md and REVIEW-EVIDENCE.json read. Reviewer reports30/30 packet hashes,4/4 canonical baselines and exact isolated patch reconstruction;9/9 independent controls. Auth proposal key matches both localStorage/sessionStorage and existing reset paths, with error/timeout checks; audit performed no source repair, test, browser or provider execution.',
 'next_action':'Preserve limited reload acceptance and original mounted fix. Parent must grant/reconfirm the exact browser-auth.ts plus existing AuthProviderContext.test.tsx lease before a canonical sign-out correction; reviewer recommendation grants no ownership. Correct C3 receipt wording through its artifact owner: no hard24h byte deletion, global cross-tab cleanup, cross-device idempotency or exactly-once financial claim. Refund-consumer/private-safe-error scope remains unstarted; release integration is separate.',
 'dispatch_class':'C3 reload continuity independently accepted with limits; exact shared-auth/test correction lease and sign-out completion held separately'
},[ev('tasks/artifacts/c3-independent-review-2026-10-24/REVIEW.md'),ev('tasks/artifacts/c3-independent-review-2026-10-24/REVIEW-EVIDENCE.json')])
update('SITE-FORGE-TESTING-GROUNDS',{
 'acceptance':OLD['SITE-FORGE-TESTING-GROUNDS']['acceptance'].replace('Slice03 owner16/16 and scoped TS/lint pass, frozen for independent review; no runner acceptance inferred.','Slice03 original pins received CHANGES REQUIRED: owner16/16 and independent9/10 controls produce25pass/1fail in one invocation. P2 S03-R1 relabels still-pending outcomes as failed when execution checks exhaust the budget. Scoped TS/lint pass does not close it. Owner correction/new pins and focused re-review remain pending; no slice03 acceptance.'),
 'verification':OLD['SITE-FORGE-TESTING-GROUNDS']['verification']+' Full slice03 independent REVIEW and REVIEW-EVIDENCE read. At maxExecutionsPerUnit=2, two pending_outcomes responses followed by a third claim yield failed1/pending0 instead of failed0/pending1. The run is failed, not falsely successful; no invented metric value was demonstrated. Parent reports correction underway; no accepted corrected pin was inspected here.',
 'next_action':'Owner corrects S03-R1 without removing finite execution/poll limits or fabricating outcome failures; preserve original failed controls and obtain a separately frozen focused re-review. Keep prior timestamp/policy verdicts within their scopes. Dedicated runner A is settled; durability, actual trusted auth, sealing, metrics/model/real-pilot and hosted runtime/storage/retention/cost remain unqualified. Slice04 declaration is independent preview work, not runner acceptance.',
 'evidence_level':'Limited timestamp/policy reviewer verdicts preserved; slice03 CHANGES REQUIRED on P2 pending-outcome coverage, correction pending',
 'dispatch_class':'Single Astra owner correcting slice03 P2; independent re-review/new exact pin acceptance required. Slice04 preview declaration remains separate.'
},[ev('tasks/artifacts/forge-testing-grounds-2026-10-24/slice-03-review/REVIEW.md'),ev('tasks/artifacts/forge-testing-grounds-2026-10-24/slice-03-review/REVIEW-EVIDENCE.json')])
update('REPO-DOCUMENTATION',{
 'next_action':OLD['REPO-DOCUMENTATION']['next_action']+' Rankings full-read segment adds a documentary supersession map: June7 skater-only matrix limits and original/V2 cume-dist/inclusive percentile suggestions are historical; later alignment chooses tested strictly-worse-peer semantics with explicit tie/singleton behavior and a dated snapshot rebuild. Post-alignment task receipts supersede older URL/type/PP-points/xS-denominator/Results-Luck/comparison/Relative-SV gaps. Preserve exact source-pending archetypes, relative skater impact, Under Pressure, adjusted style and history-dependent opportunity signals as intentionally parked; no new feature/model/data dispatch. Do not transfer Rankings percentile choices to WiGO or revive historical rebuild runbooks.'
},[ev(R+'2026-06-07-goal.md','Scope boundary'),ev(R+'prd-contextual-hockey-rankings.md','Raw rank should use dense-rank semantics'),ev(R+'prd-v2-pass-CHR.md','Consider percentile as'),ev(R+'tasks-prd-rankings-ecosystem-alignment-audit.md','better-than-peer semantics now produce'),ev(R+'tasks-prd-rankings-ecosystem-alignment-audit.md','Task 17.3 verified'),ev(R+'tasks-prd-rankings-post-alignment-gap-audit.md','Deferred source-pending decisions')],['SEG03-RANK-DOC: later closed task groups include conditional “implement or explicitly source-pend” branches; checked parent boxes do not certify exact original-formula parity. Main rankings task list is structural-only in this segment. Broad Rankings work stays parked; NEW21/C0124 already maps to SPRINT-OPTIMIZATION and is not a new optimization task.'])

TEXTS={p:RAW[p].decode() for p in PATHS[:2]}
for p,text in TEXTS.items():
    text=text.replace(B['as_of'],NOW,1)
    for tid,c in CHANGES.items():
        m=re.search(r'^### '+re.escape(tid)+r' —.*?(?=^### |^## |\Z)',text,re.M|re.S);assert m,tid;block=m.group(0)
        for k,v in c['fields'].items():
            old=OLD[tid][k]
            if old in block:block=block.replace(old,v)
            else:block=block.rstrip()+'\n- **Current '+k.replace('_',' ')+':** '+v+'\n\n'
        block=block.replace(OLD[tid]['as_of'],NOW)
        for clause in c['retained_clauses']:block=block.rstrip()+'\n- **Retained continuation clause:** '+clause+'\n\n'
        block=block.rstrip()+'\n- **Segment03 evidence:** '+'; '.join(f"[{Path(e['path']).name}:{e['line']}]({ROOT/e['path']}:{e['line']}) SHA256 `{e['sha256']}`" for e in c['new_evidence'])+'.\n\n'
        text=text[:m.start()]+block+text[m.end():]
    summary=f'''## Contextual rankings content checkpoint — {NOW}

This dated overlay preserves the v4 checkpoint and all206 IDs/legacy scopes. Rankings source chronology retains completed narrower work, explicitly source-pending/parked contracts and NEW21/C0124's existing cost-acceptance home; no new feature or rebuild is dispatched. Original/V2 percentile and missing-feature claims are historical, not current authority. Full source/evidence mapping and coverage exclusions are in segment03-contextual-rankings.

Later independent review accepts C3 reload continuity with limits, while sign-out completion requires an exact shared-auth/test lease;24h is reuse eligibility, not physical byte deletion. Testing Grounds slice03 has CHANGES REQUIRED/P2 S03-R1 for execution-budget handling of pending outcomes, with correction/re-review pending; it is not accepted. Earlier owner tests and limited timestamp/policy verdicts retain their original scope. No source repair, tests, production/provider call or Git mutation by this audit.

'''
    i=text.index('## ');TEXTS[p]=(text[:i]+summary+text[i:]).rstrip()+'\n'
J['as_of']=NOW;J['artifact_audit_segment03_20261024']={'at':NOW,'changed_ids':list(CHANGES),'new_ids':[],'preserved_ids':206,'previous_checkpoint_hashes':START['canonical_checkpoint'],'coverage':'tasks/artifacts/task-artifact-audit-continuation-2026-10-24/segment-03-contextual-rankings/COVERAGE.json','scope':'Full selected documentary reads and bounded status reconciliation; broader rankings remains parked and overall task-tree content audit unfinished.'}
J['master_consolidation_plan']['after_sha256']=hashlib.sha256(TEXTS[PATHS[0]].encode()).hexdigest();J['master_consolidation_plan']['completed_at']=NOW
TEXTS[PATHS[2]]=json.dumps(J,indent=2)+'\n'
for p,s in TEXTS.items():(OUT/('CANDIDATE-'+Path(p).name)).write_text(s)
LOG={'at':NOW,'before_ids':206,'after_ids':206,'before_evidence':sum(len(t['evidence']) for t in B['tasks']),'after_evidence':sum(len(t['evidence']) for t in J['tasks']),'changes':CHANGES,'hashes':{p:hashlib.sha256(s.encode()).hexdigest() for p,s in TEXTS.items()},'written':False};(OUT/'CHANGELOG.json').write_text(json.dumps(LOG,indent=2)+'\n')
if '--write' in sys.argv:
    for p,h in START['canonical_checkpoint'].items():assert hashlib.sha256((ROOT/p).read_bytes()).hexdigest()==h,p+' advanced: STOP'
    for c in CHANGES.values():
        for e in c['new_evidence']:assert hashlib.sha256((ROOT/e['path']).read_bytes()).hexdigest()==e['sha256'],e['path']+' advanced: STOP'
    for p,s in TEXTS.items():(ROOT/p).write_text(s)
    LOG['written']=True;(OUT/'CHANGELOG.json').write_text(json.dumps(LOG,indent=2)+'\n')
print(json.dumps({'written':LOG['written'],'ids':206,'new_ids':0,'changed_ids':list(CHANGES),'evidence_before_after':[LOG['before_evidence'],LOG['after_evidence']]},indent=2))
