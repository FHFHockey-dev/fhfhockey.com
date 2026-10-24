"""Prepare guarded, focused documentary reconciliation; --apply writes only three owned registers."""
from pathlib import Path
import json,hashlib,re,datetime,copy,sys
ROOT=Path(__file__).resolve().parents[3];OUT=Path(__file__).resolve().parent
sys.path.insert(0,str(OUT));from prepare_changes import evidence
base=json.loads((OUT/'BASELINE-LEDGER.json').read_text());d=copy.deepcopy(base);NOW=datetime.datetime.now(datetime.timezone.utc).isoformat();oldby={t['taskID']:t for t in base['tasks']};by={t['taskID']:t for t in d['tasks']};updates={}
OLD='tasks/artifacts/repository-commitment-audit-2026-10-15/';COORD='tasks/artifacts/cross-platform/2026-10-24-coordination/';TG='tasks/artifacts/forge-testing-grounds-2026-10-24/slice-01/';REL='tasks/artifacts/release-readiness-2026-10-24/'
def upd(tid,changes,refs=(),retained=()):
 t=by[tid];before={k:copy.deepcopy(t.get(k)) for k in changes};t.update(changes);t['as_of']=NOW
 newev=[evidence(*r) for r in refs];t['evidence'].extend(newev)
 if retained:t['artifact_audit_retained_scopes']=list(retained)
 t['artifact_audit_20261024']={'at':NOW,'before_fields':before,'note':'Documentary reconciliation only. Earlier evidence and acceptance remain bound to their original scope/bytes.'}
 updates[tid]={'fields':list(changes),'new_evidence':newev,'retained_scopes':list(retained)}
upd('SITE-FORGE-TESTING-GROUNDS',{
 'implementation':'Approved PRD v1 and task list v0 are installed at their canonical local paths. Sole Astra worker01a16e4b-590b-72f9-9ced-5684a8c9e030 implemented four new operationalProgress/dataHealth files, slice01 frozen for independent Sol review. Full configure→preflight→remote launch→reconnect→review remains incomplete.',
 'acceptance':'Owner reports20/20 synthetic Vitest plus scoped strict TypeScript/ESLint passed. No independent slice acceptance, API/UI/runner/store integration or real-pilot qualification.',
 'release':'Bounded local implementation was explicitly requested. Real capture, paid/remote runtime, production writes, provisioning and deployment remain separately gated.',
 'dependencies':'Installed approved sources retain Library identities/versions. Exact four-file slice ownership and19 dependency pins; TJ-only owner policy, runner/resource/storage/retention choices, statistical/event/reveal conventions and protected evidence gates.',
 'verification':'Audit read slice handoff and additive source-resolution receipt; verified installed sizes/lines/hashes. Owner checks are imported evidence, not rerun by audit. Earlier failed download/absent-source statements are historical and superseded only by source installation.',
 'next_action':'Scout arranges independent review of the frozen slice01 and reconciles exact source requirements plus steers. TJ-only fail-closed local owner policy is authorized as a next bounded slice; actual session/config activation, runner and probability-track decisions remain separate.',
 'evidence_level':'owner-tested local slice; independent acceptance pending',
 'evidence_scope':'Pure progress/numeric health contracts and synthetic fixtures only. No integrated workflow, live authenticity, durable storage or validated model/pilot claim.',
 'dispatch_class':'Bounded single Astra implementation; independent Sol review pending'
},[(TG+'OWNERSHIP.md',1),(TG+'HANDOFF.md',1),(TG+'EVIDENCE.json',1),(TG+'SOURCE-RESOLUTION-AND-NEXT.md',1),('tasks/TASKS/prd-forge-testing-grounds.md',1),('tasks/tasks-prd-forge-testing-grounds.md',1)])
upd('SPRINT-INTEGRATE',{
 'implementation':'October24 frozen r1 web candidate has3637 files/110 selected pins; manifest65ce37e40dac6232697a71e686fd08aade788900a8e5ed54d15d322aa58eb042, archive dc0bed3594b39bb51b3825e033f527794cbb66231486f88d1e834f7ffad6e555. Parent-approved one-file synthetic Start Chart correction is handed back;3636 other files remain r0-identical. Historical r0 archive/160pass-1fail-1skip and two diagnostic controls are retained.',
 'acceptance':'Owner r1 run:161 passed/0failed/1existing opt-in replay skipped across four matched files; scoped TS/lint exit0. R0 full-app TS,109-pin lint with8 inherited warnings and241-module/903-edge closure with0missing remain upstream evidence. Parent/independent exact-r1 acceptance and whole-release gates remain open.',
 'verification':'Audit read r0/r1 full handoffs and bounded structured results/hashes; no test execution. R1 exact reviewed patch a8a2f2bf20949e303b550383047d38daa13eae2d6d4d169511ce6a5a694aa0cf; changed test hash eebd86016d6cc3809ab15b2e936b884464d41666519d689ce26112a967d203c7. Artifact diagnostics and unmatched currentPlanningRead.test.ts filter are excluded from161.',
 'next_action':'Parent independently reviews exact r1 patch/manifest/receipts, then resolves whole-release source/resource/privacy/migration and companion-project composition, exact commit/browser and linked-project gates. The test-only lease is handed back; no active owner operation/lock. C3, new Claude changes and Testing Grounds are excluded.',
 'evidence_level':'local candidate verified by owner; exact-r1 independent acceptance pending',
 'evidence_scope':'Named r1 consumer/admission fixtures and scoped static checks; existing separate44RSO/10Yahoo browser receipts reused, not a fresh whole browser run. Archive identity is not a commit SHA or deployment approval.'
},[(REL+'HANDOFF.md',1),(REL+'tests.json',1),(REL+'r1/HANDOFF.md',1),(REL+'r1/EVIDENCE.json',1),(REL+'r1/tests.json',1)])
# Allocation is evidence of ownership boundaries, not implementation acceptance.
allocs={
 'STATS-S06':('C1','Seven exact team/line/shot/tab paths allocated to Claude C1; no lane session ID or completion receipt reported at audit cutoff.'),
 'SITE-WIGO':('C4','Claude C4 allocated only existing workflow-link wiring; broader WiGO source/rating/performance acceptance remains unassigned.'),
 'CRON-AUDIT-COVERAGE':('C5','Claude C5 allocated two existing operational route wrappers and their focused fixtures; no shared wrapper/auth or remote invocation authority.'),
 'LUNA-LOCAL':('C7','Claude C7 allocated read-only independent review of the pinned six-file local Luna packet; manual caller remains default-off and hosted/paid activation unqualified.')}
for tid,(lane,note) in allocs.items():
 changes={'dispatch_class':f'Claude {lane} bounded allocation acknowledged; completion unverified','next_action':f'Reconcile the immutable {lane} handoff when available against exact baseline hashes. '+note}
 if tid!='LUNA-LOCAL':changes['implementation']=by[tid]['implementation']+' October24: '+note
 else:changes['reviewer']='CLAUDE-C7'
 upd(tid,changes,[(COORD+'CLAUDE-TO-CODEX.md',7),(COORD+'CLAUDE-LEASES.json',1)])
upd('BILLING-CANCEL-RELOAD',{
 'implementation':'Parent granted Claude C3 a NEW PINNED ISOLATED LOCAL correction candidate on the three InSeasonPanel paths. Current canonical accepted billing files remain protected; no completed C3 correction/acceptance receipt at audit cutoff.',
 'dispatch_class':'Isolated local candidate authorized; canonical write/integration not transferred',
 'next_action':'Claude C3 returns exact isolated patch/base/candidate/check receipts. Parent reviews before any integration. No shared auth/API/RPC/schema/entitlement/live-gate/Stripe action; exclude C3 from frozen release r1 acceptance.'
},[(COORD+'CODEX-TO-CLAUDE.md',1),(COORD+'CODEX-LEASES.json',1)])
upd('SITE-WIGO',{
 'next_action':by['SITE-WIGO']['next_action']+' Preserve the older source/window/unit, rating/radar/cohort and measured-performance gates below; C4 links do not complete them.'
},[(OLD+'PRIOR-19.md',65),('tasks/tasks-README.md',30)],retained=[
 'MISS-WIGO-DATA: season totals, pooled rates, chart references, points, team cohorts and Game Score SQL/source version acceptance. Reuse IST comparison/TOI owner once.',
 'MISS-WIGO-RATINGS: raw versus ranked meaning, midrank/GP/TOI/fallback/errors, known-response radar and explicit defense-PP versus PK decision; paused broader Rankings remains parked.',
 'MISS-WIGO-PERF: after correctness, bounded local cold/warm/player-switch/tab/chart baseline before any cache optimization; no production load test.'])
upd('IFTTT-ACTIVATION',{'next_action':by['IFTTT-ACTIVATION']['next_action']+' Preserve the exact historical-key-retirement and signed unresolved-player review-email gates; generic cron mail or local semantic fixtures do not close them.'},[(OLD+'PRIOR-19.md',7),(OLD+'PRIOR-19.md',163),('tasks/TASKS/lines-gdl-ingestion/tasks-prd-gdl-suite-ingestion.md',169)],retained=[
 'ADD-01: GDL NEW13/15/16/17/18 are one held account-key retirement prerequisite. Completed containment remains accepted; no repeated key probe/event/applet edit.',
 'MISS-ALIAS-EMAIL: source-agnostic signed review, owner-authorized send/receipt and event-bounded reprocess remain separate from general cron email. No send authorized by audit.'])
upd('PIPE-NATURAL',{'next_action':by['PIPE-NATURAL']['next_action']+' Retain the separate historical NEW72 audit-correlation quartet from the source list; reconcile only existing natural/deployed receipts, never invoke routes for audit.'},[(OLD+'PRIOR-19.md',257)],retained=['MISS-CRON-FOUR-AUDITS: jobs43/99/275/328 (standings, NST goalie, NST team daily and incremental) retain exact natural terminal-audit correlation requirements; dated configuration failures and28local tests do not establish current completion.'])
upd('REPO-DOCUMENTATION',{'next_action':'Claude C6 remains held/unallocated for its two proposed task-list paths. Preserve completed Underlying mockup/layout and corrected radar source; reconcile only stale current pointers and exact owner decisions below. No diary/document retirement from this audit.','dispatch_class':'Claude C6 held; audit only reconciles canonical registers'},[(OLD+'FINDINGS.md',45),('tasks/tasks-underlying-stats-lineupexperts-alignment.md',20),(OLD+'PRIOR-19.md',269),('tasks/TASKS/forge-projections/dashboard-health/tasks-prd-forge-dashboard.md',143)],retained=[
 'FRESH-04: source AUDIT-TASK-001 current header/index remains a documentation reconciliation against its October2 closure; do not reopen the completed security rollout.',
 'FRESH-06: Draft tutorial/status appendix needs reconciliation with accepted local W07–W10, without unsupported live/paid launch claims.',
 'HOLD-DOC-11 / AUDIT-TASK-013.4: keep the11 exact Keep/Archive/Merge decisions held.115Keep decisions and frozen ledgers retain credit; no document deletion.',
 'MISS-UNDERLYING-MOCKUP and BLOCK-UNDERLYING-VERIFICATION are superseded by source October17 reconciliation: mockup delivered October15, target implemented and31items checked with local browser/keyboard/test evidence. Do not create a replacement layout task.',
 'Dashboard NEW9/10: October19 R-OPEN records stable canonical error copy already implemented; preserve that local credit and approved dashboard redirect. Reconcile stale checklist descriptions only, not another source repair.'])
upd('SPRINT-OPTIMIZATION',{'next_action':by['SPRINT-OPTIMIZATION']['next_action']+' Also retain the distinct Rankings C0124 owner-cost acceptance: October19 hydration reuse preserves full cohorts and has complete response/workload comparisons; local gains do not establish hosted latency/cost or revive paused Rankings research.'},[('tasks/TASKS/contextual-hockey-rankings/tasks-prd-rankings-ecosystem-alignment-audit.md',264),('tasks/codex-sprint-2026-10-19/continuation-cost/R-COST-HANDOFF.md',1)],retained=['Rankings NEW21/C0124: preserve implemented rank-preserving hydration reuse,24reader tests/16complete response comparisons/36workload pairs. Full-cohort semantics remain; owner acceptance of measured operational budget is unverified.'])
upd('PIPE-NATURAL',{'next_action':by['PIPE-NATURAL']['next_action']+' Separate game-prediction no-model forecast and partial-write/natural chain clauses retain completed S03 local fixes; reconcile serving/scheduler/natural receipts rather than duplicate implementation.'},[('tasks/artifacts/data-correctness-fixes-2026-10-18/DIARY.md',1),('tasks/TASKS/nhl-game-prediction-model/tasks-prd-nhl-game-prediction-model.md',197)],retained=by['PIPE-NATURAL'].get('artifact_audit_retained_scopes',[])+['Game prediction NEW16/C0119 and cron baseline partial-write clauses: S03 truthfulness/partial receipts already implemented locally; model-serving decision, exact deployment and natural completion stay separate. No automatic cron deactivation.'])
upd('SPRINT-LEDGER',{
 'implementation':'October24 artifact audit preserves all189 baseline IDs/scopes and all736 currently attached evidence entries, including all188 original IDs and32 legacy clause sets. Added16 proposed/held source carry-forwards:205 total. Timestamped inventory and per-file/folder coverage distinguish complete document reading, bounded inspection, duplicates and exceptions.',
 'acceptance':'Register consistency and evidence checks are required for this documentary update; Scout review remains pending. Structural corpus coverage is complete at stated cutoffs; comprehensive semantic or visual coverage is explicitly not claimed.',
 'owner':'TASK-AUDIT',
 'verification':'Audit-specific hashes/ID parity, source-line checks, baseline field/evidence preservation,32legacy clauses, changed/new-file rescan and scoped whitespace checks. No application suites, production reads or source repairs by audit.',
 'next_action':'Scout reviews exact additions/status deltas and documented limits. Preserve stopped-sprint versus bounded-dispatch distinction, all held decisions and live-tree exceptions. No dispatch or implementation follows from proposed carry-forwards.',
 'evidence_scope':'Documentary task/evidence reconciliation with exact per-file coverage; binary/private/oversized and partial semantic limitations listed in coverage/report.',
 'dispatch_class':'Sole canonical register audit writer after explicit coordinator handoff; no Git/index/release custody'
},[('tasks/artifacts/task-artifact-reconciliation-2026-10-24/PROPOSED-ADDITIONS.json',1)])
# upd() may enrich the same row twice. Keep cumulative evidence/fields, not just last-call metadata.
for tid in updates:
 t=by[tid];changes={k:{'before':oldby[tid].get(k),'after':t.get(k)} for k in set(t)|set(oldby[tid]) if k not in ['evidence','artifact_audit_20261024','artifact_audit_retained_scopes'] and t.get(k)!=oldby[tid].get(k)}
 updates[tid]={'fields':changes,'new_evidence':t['evidence'][len(oldby[tid]['evidence']):],'retained_scopes':t.get('artifact_audit_retained_scopes',[])}
 t['artifact_audit_20261024']={'at':NOW,'before_fields':{k:v['before'] for k,v in changes.items()},'note':'Earlier scopes/evidence and narrower acceptance preserved; status change is documentary only.'}
newrows=json.loads((OUT/'PROPOSED-ADDITIONS.json').read_text())['tasks'];assert not(set(by)&{x['taskID'] for x in newrows});d['tasks'].extend(newrows)
d['owners']['TASK-AUDIT']={'thread':'01a16e4f-a250-727a-aeb5-2e42da87500f','assignment':'Sole documentary audit/register writer after explicit transfer; no application/test/Git/release work.','reported_model':'GPT-6.1 Sol assigned by parent; runtime settings not independently exposed'}
d['owners']['CLAUDE-C7']={'thread':None,'assignment':'Allocated read-only six-file Luna independent review; session identity/completion not reported.','reported_model':'Not verified by audit'}
d['as_of']=NOW
d.setdefault('coordination_history',{})['before_artifact_audit_20261024']={'sprint_control':copy.deepcopy(base['sprint_control']),'master_consolidation_plan':copy.deepcopy(base['master_consolidation_plan'])}
d['sprint_control']['documentation_exception']='General sprint remains stopped. Separately bounded local Testing Grounds, Claude allocations, isolated release correction and this documentary audit were explicitly dispatched; each retains its own scope/leases. No blanket implementation, capture, spend or deployment authority.'
d['sprint_control']['bounded_dispatches_20261024']={'source':'Parent/coordinator custody/status receipts in this audit conversation; current coordination files','testing_grounds_worker':'01a16e4b-590b-72f9-9ced-5684a8c9e030','release_worker':'01a1637a-4222-70c0-8439-cb3cc46b20c4','claude_allocations':['Q1','Q2','C1','C4','C5','C7'],'c3':'Isolated new pinned cancellation-reload candidate only; canonical paths protected','general_sprint_resumed':False,'new_production_spend_capture_deployment_authority':False}
d['artifact_audit_20261024']={'as_of':NOW,'baseline_ids':189,'after_ids':205,'original188_preserved':True,'legacy_scope_sets':32,'baseline_evidence_entries':736,'new_ids':[x['taskID'] for x in newrows],'changed_ids':list(updates),'inventory':'tasks/artifacts/task-artifact-reconciliation-2026-10-24/INVENTORY.json','coverage':'tasks/artifacts/task-artifact-reconciliation-2026-10-24/COVERAGE.json','report':'tasks/artifacts/task-artifact-reconciliation-2026-10-24/REPORT.md','limits':'Bounded structural/excerpt inspection across corpus; explicit exceptions. Not comprehensive semantic/visual review, source health or current production acceptance.'}
def audit_refs(es):return '; '.join(f"[{Path(e['path']).name}:{e['line']}]({str((ROOT/e['path']).resolve())}:{e['line']}) SHA256 `{e['sha256']}`" for e in es)
def rowblock(t):
 lines=[f"### {t['taskID']} — {t['scope']}",'']
 for k,label in [('owner','Owner'),('implementation','Implementation'),('acceptance','Acceptance'),('release','Release'),('user_impact','User impact'),('verification','Verification'),('dependencies','Dependencies'),('acceptance_release_gate','Acceptance/release gate'),('next_action','Next action')]:
  if k in t:lines.append(f'- **{label}:** {t[k]}')
 lines.extend([f"- **Reviewer:** {t['reviewer']}.",f"- **Evidence level / limits:** {t['evidence_level']}. {t['evidence_scope']}",f"- **Source aliases:** {', '.join(t.get('source_inputs',[]))}.",f"- **Status evidence date:** `{t['as_of']}`.",'- **Pinned references:** '+audit_refs(t['evidence'])+'.',''])
 return '\n'.join(lines)+'\n'
header=f'''## Artifact audit reconciliation — {NOW}

**205 stable IDs:** all189 baseline IDs and736 attached evidence entries preserved;16 omitted source obligations carried forward as proposed/held. All188 original IDs and32 legacy scope/acceptance sets remain intact. [Audit report](/Users/tim/Code/fhfhockey.com/tasks/artifacts/task-artifact-reconciliation-2026-10-24/REPORT.md) and [per-file coverage](/Users/tim/Code/fhfhockey.com/tasks/artifacts/task-artifact-reconciliation-2026-10-24/COVERAGE.json) state exact limits; file indexing is not whole-corpus semantic or visual acceptance.

The October23 general sprint stop remains in effect. Subsequent explicit bounded dispatches are distinct: the sole Astra Testing Grounds worker has a locally tested four-file slice awaiting independent Sol review; Claude acknowledged Q1/Q2/C1/C4/C5/C7 allocations, with lane session/completion receipts still unverified here; C3 may prepare only a new isolated pinned correction. Release r1 now has161passes/0failures/1existing skip after the approved test-only correction; earlier r0 failure is retained. No whole-release, live, capture, paid-runtime or deployment acceptance follows. Approved Testing Grounds sources are installed; earlier absence/download statements below are historical.

Canonical register custody transferred explicitly from coordinator01a16e23-72b5-76ee-8ade-2d209d0e7002 to audit01a16e4f-a250-727a-aeb5-2e42da87500f, with no pending canonical/Library write. Coordinator retains mailbox/lease/steer custody. Scout retains final acceptance and Git/index/release decisions. This audit edits documentation only.

The earlier October24 control text below is the13:54 checkpoint and is superseded only where the later bounded dispatch/source-installation/r1 receipts above say so; historical dates and accepted source pins are retained.

'''
outputs={}
for name,target in [('MASTER-TASKLIST-2026-10-20.md','tasks/handoff-2026-10-20/MASTER-TASKLIST-2026-10-20.md'),('LEDGER.md','tasks/artifacts/fhfh-sprint-ledger-2026-10-22/LEDGER.md')]:
 text=(OUT/('BASELINE-'+name)).read_text();text=text.replace(base['as_of'],NOW,1)
 for tid,change in updates.items():
  old=oldby[tid];t=by[tid];pat=r'^### '+re.escape(tid)+r' —.*?(?=^### |^## |\Z)';m=re.search(pat,text,re.M|re.S);assert m,tid;block=m.group(0)
  for k,c in change['fields'].items():
   if k in ['as_of','owner','reviewer','dispatch_class']:continue
   a=c['before'];b=c['after']
   if isinstance(a,str) and a in block:block=block.replace(a,str(b))
   elif k in ['implementation','acceptance','release','verification','next_action','dependencies','evidence_scope','evidence_level']:raise AssertionError((name,tid,k,'missing old scalar'))
  if old['as_of'] in block:block=block.replace(old['as_of'],NOW)
  if old['owner']!=t['owner']:block=re.sub(r'^- \*\*Owner:\*\*.*$',lambda m: f"- **Owner:** {t['owner']} (`01a16e4f-a250-727a-aeb5-2e42da87500f`); reviewer {t['reviewer']}."+(f" **Dependencies:** {t['dependencies']}" if '**Dependencies:**' in m.group(0) else ''),block,flags=re.M)
  if old['reviewer']!=t['reviewer']:block=block.replace('reviewer UNASSIGNED','reviewer '+t['reviewer']).replace('reviewer:** UNASSIGNED','reviewer:** '+t['reviewer'])
  if tid=='SITE-FORGE-TESTING-GROUNDS':block=block.replace('(Codex/Scout; implementation thread unassigned)','(Scout acceptance; sole bounded implementation worker `01a16e4b-590b-72f9-9ced-5684a8c9e030`)');block=re.sub(r'^- \*\*Library references \(not installed locally\):\*\*.*$', '- **Library identities:** PRD `libfile_f0c6192b583c81918b5d6edc88e02803` version1; task list `libfile_1831092d42f88191b7513ef7133ae6f7` version0. Both installed at the pinned paths; terminal LF restoration and transfer limits recorded in the additive source-resolution receipt.',block,flags=re.M)
  addition='- **Artifact audit — October24:** Documentary scope/status update; prior evidence and narrower acceptance preserved.\n'
  addition+=''.join('- **Retained audit scope:** '+s+'\n' for s in change['retained_scopes'])
  addition+='- **Audit evidence:** '+audit_refs(change['new_evidence'])+'.\n'
  block=block.rstrip()+'\n'+addition+'\n';text=text[:m.start()]+block+text[m.end():]
 text=text.replace('## Current control and appended coordination steers — October 24',header+'## Earlier control and coordination steers — October 24 13:54 checkpoint',1)
 if name.startswith('MASTER'):
  text=text.replace('**189 current ledger rows**','**205 current ledger rows**',1)
  text=text.replace('the new planning-only Testing Grounds row gives 189 IDs.','Testing Grounds is now a locally implemented bounded slice, and16audit carry-forwards give205 IDs.',1)
 text=text.rstrip()+'\n\n## October24 artifact audit carry-forwards\n\nThese preserve omitted source obligations as proposed/held entries. They do not authorize implementation, reopen parked research or supersede narrower accepted closures. Scout review is pending.\n\n'+''.join(rowblock(t) for t in newrows)
 outputs[target]=text.rstrip()+'\n'
# The top-level plan points at the resulting master bytes; earlier plan/history remain preserved.
masterpath='tasks/handoff-2026-10-20/MASTER-TASKLIST-2026-10-20.md';d['master_consolidation_plan']['after_sha256']=hashlib.sha256(outputs[masterpath].encode()).hexdigest();d['master_consolidation_plan']['task_rows_after']=205;d['master_consolidation_plan']['status']='October24 artifact reconciliation:205 stable IDs; stopped general sprint, separately bounded allocations; proposed source gates and partial content coverage explicit';d['master_consolidation_plan']['completed_at']=NOW
outputs['tasks/artifacts/fhfh-sprint-ledger-2026-10-22/LEDGER.json']=json.dumps(d,indent=2,ensure_ascii=True)+'\n'
for target,text in outputs.items():(OUT/('CANDIDATE-'+Path(target).name)).write_text(text)
(OUT/'CHANGELOG.json').write_text(json.dumps({'as_of':NOW,'before_ids':189,'after_ids':205,'baseline_evidence_entries':736,'after_evidence_entries':sum(len(t['evidence']) for t in d['tasks']),'updates':updates,'new_ids':[t['taskID'] for t in newrows]},indent=2)+'\n')
if '--apply' in sys.argv:
 # Guard ALL files before first write. No write occurs on changed ownership/baseline bytes.
 for target in outputs:
  assert (ROOT/target).read_bytes()==(OUT/('BASELINE-'+Path(target).name)).read_bytes(),target+' advanced; STOP'
 for target,text in outputs.items():(ROOT/target).write_text(text)
 print('Applied only three guarded register files.')
else:print('Prepared candidate files; canonical registers untouched.')
print(json.dumps({'at':NOW,'changed_existing_ids':list(updates),'new_ids':len(newrows),'total_ids':len(d['tasks']),'evidence_entries':sum(len(t['evidence']) for t in d['tasks'])},indent=2))
