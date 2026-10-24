from pathlib import Path
import copy, datetime, hashlib, json, re, sys

ROOT = Path('/Users/tim/Code/fhfhockey.com')
OUT = Path(__file__).resolve().parent
NOW = datetime.datetime.now(datetime.timezone.utc).isoformat()
START = json.loads((OUT/'START.json').read_text())
PATHS = [e['path'] for e in START['canonical_before']]
RAW = {p:(OUT/('BASELINE-'+Path(p).name)).read_bytes() for p in PATHS}
J = json.loads(RAW[PATHS[2]])
BEFORE = copy.deepcopy(J)
BY = {t['taskID']:t for t in J['tasks']}
OLD = {t['taskID']:t for t in BEFORE['tasks']}
C = 'tasks/artifacts/cross-platform/2026-10-24-coordination/'
G = 'tasks/artifacts/forge-testing-grounds-2026-10-24/'
CHANGES = {}

def ev(path, marker=None, line=None, end=None, scope='Full documentary receipt read; no application/test/pixel acceptance by auditor.'):
    b=(ROOT/path).read_bytes(); lines=b.decode().splitlines()
    if line is None:
        line=next((i for i,s in enumerate(lines,1) if marker and marker in s),1)
    assert 1 <= line <= len(lines), path
    e={'path':path,'line':line,'sha256':hashlib.sha256(b).hexdigest(),'observed_at':NOW,'review_scope':scope}
    if end: e['end_line']=end
    return e

def update(tid, fields, refs, retained=()):
    t=BY[tid]; before={k:t.get(k) for k in fields}
    t.update(fields); t['as_of']=NOW
    t['evidence'].extend(refs)
    if retained: t.setdefault('artifact_audit_retained_scopes',[]).extend(retained)
    t.setdefault('artifact_audit_continuation',[]).append({'at':NOW,'before_fields':before,'note':'Current dated overlay supersedes conflicting earlier status only; scopes, evidence and narrower completed credit retained.'})
    CHANGES[tid]={'before_fields':before,'fields':fields,'new_evidence':refs,'retained_clauses':list(retained)}

coord=[ev(C+'CLAUDE-TO-CODEX.md',line=38,end=54,scope='Bounded CLAUDE004 section read; orchestrator evidence, not independent acceptance.')]
s12=ev(C+'STEER-LOG.md',line=131,end=142,scope='Full S12 section read; accepted user steer, no expansion of excluded boundaries.')
update('STATS-S06',{
 'acceptance':'Owner 39/39 focused tests and scoped lint 0 errors/1 inherited warning; orchestrator reports the 39-case rerun within 110/110 across C1/C4/C5. C1 whole-project TypeScript exit0 claim is superseded by CLAUDE004: exit2, exactly two Luna TS2345 Buffer/BinaryLike errors at tweetLunaReview.test.ts:192 and review-ifttt-luna.ts:22, with no C1/C4/C5 diagnostics. Screenshots remain owner evidence, not audit pixel acceptance. Full S06 acceptance remains open.',
 'verification':OLD['STATS-S06']['verification']+' Current type result is attributed to the canonical Claude working tree; frozen release r0/r1 checks concern a different candidate.'
},coord)
update('LUNA-LOCAL',{
 'next_action':'Implementation owner may reproduce/correct F1/F2 locally under S12 in the existing six-file default-off scope with a nonoverlapping exact lease; independent reviewer remains separate. Ordinary local choices do not await Scout serial approval. F1 Decisions unknown/skipped may remain review_only/CLI0; F2 attempts counts transport invocations. Reconcile the two TS2345 errors under exact current ownership. No repair completion is inferred. Shared/core boundaries, hosted activation, paid calls and public claim authority remain separately gated.',
 'dispatch_class':'C7 bounded review delivered; S12 permits implementation-owner local corrections, while enabled dispatch stays blocked on unresolved F1/F2',
 'acceptance':OLD['LUNA-LOCAL']['acceptance']+' Whole-tree TypeScript is currently reported failed on two Luna TS2345 errors; scoped pass is not full-tree acceptance.'
},[s12]+coord)
update('CRON-AUDIT-COVERAGE',{
 'implementation':'Claude C5 five-file route-wrapper candidate delivered; prospects statically qualified, Yahoo runtime delegate remains unqualified by the unchanged classifier. Disabled/suspended Yahoo exits intentionally create no audit row in this candidate. S12 permits ordinary placement decisions inside the existing route scope; shared/global classifier changes still require exact transfer.',
 'acceptance':'Owner 65/65 focused tests and scoped TS/lint pass; orchestrator reports 65-case rerun within 110/110 across C1/C4/C5. Initial owner full-tree OOM134 was not a type result; later whole-tree run exits2 on exactly two Luna TS2345 errors, with no C5 diagnostics. No independent candidate/integration/live acceptance.',
 'next_action':'C5 may choose intentional disabled/suspended no-op auditing from the existing contract and focused mocks under S12, preserving auth, genuine failures and expected-disabled semantics and recording the no-row observability tradeoff. Ordinary local choice needs no Scout serial approval. Exact shared classifier/global-wrapper/cron transfer remains separate; reconcile newer handback before any completion claim.',
 'dispatch_class':'Claude C5 local candidate pending independent review; routine local placement choice may proceed under S12; excluded shared boundaries remain held'
},[s12]+coord)
update('BILLING-CANCEL-RELOAD',{
 'implementation':'C3 handed back an isolated two-file reload-persistence candidate, patch c500b580b79f2bd1ce3bc00e50630ea3ac1d47bd1985843c53121cb8a9b420ff. Canonical accepted panel trio remains unchanged; candidate is excluded from frozen release r1. Per-tab owner-bound request IDs expire at24h. Shared-auth sign-out clearing remains a separate unapplied/untested one-key proposal.',
 'acceptance':'Owner and orchestrator report 52/52 focused checks; fixture browser reproduction/fix, mutations and lint are receipt evidence. Whole-tree TS exit2 has only the two Luna errors. Independent candidate acceptance/integration remain open; no real billing/provider operation occurred.',
 'verification':'Full C3 receipt and CLAUDE006 read. Candidate panel9987664256fd615d6b47cb41d019edd7c9515456e8c02808d42d741e239776ea and test646b3379e105e0ae3777c196db148fcd9af1366faa757102ccb3ebeae4b3e535 are owner/orchestrator pins; audit did not apply patches or run tests/browser.',
 'next_action':'Independently review the exact isolated candidate. Parent decides only the excluded browser-auth.ts boundary proposal c0deaddc7e9421a13c3b944c37c54e1a4fb421d93452d1275eacac2538e40002: app sign-out can unmount the panel before its clearing callback, retaining the same owner ID within24h; foreign owners are rejected per receipts. Refund-consumer/private-safe-error serial scope remains unstarted. Preserve mounted fix and canonical billing protections.',
 'dispatch_class':'C3 isolated candidate handed back; independent review pending, shared-auth boundary proposal held separately'
},[ev(C+'handoffs/C3/RECEIPT.md'),ev(C+'CLAUDE-TO-CODEX.md',line=66,end=82,scope='Full CLAUDE006 section read; orchestrator/owner evidence only.'),s12])
update('SITE-WIGO',{
 'implementation':'C4 workflow-link wiring candidate and fixture-browser handback delivered, patch2266893f0e268690ab27819aa3d2d3ab6afc3a2d8af6058cf14d79d11e4e190e. Existing shared links/components/styles remain unchanged per receipt. Broader WiGO data/rating/performance work is not completed by this narrow wiring.',
 'acceptance':'Owner reports 6/6 tests, baseline6/6 failures, lint pass and fixture browser/keyboard/Back coverage; orchestrator rerun includes those6 in110/110. Whole-tree TS exits2 on two Luna errors, no C4 diagnostics. Independent C4 review pending; audit did not view screenshots. Browser was not wholly offline: at least5 public NHL reads, exact count unknown, are disclosed; no FHFH production Supabase contact reported.',
 'verification':'Full C4 receipt plus CLAUDE005-007 read. Candidate pagefd3e6b7fbaa7a27f97063123b7ab03c384f2fedba07c5a69d9eb3cf35b703469 and new testee8f00a8bcd70ef2ab80b03feb831d3550bffd5b3fa0b2966553dc9508046064 identify the owner packet. The audit ran no browser/source/test checks.',
 'next_action':'Review frozen C4 packet independently; retain unresolved source/window/unit/rating/cohort/performance clauses. C4 released3110, then C7 social used/released it per CLAUDE007; later CLAUDE010 declares SS1 holding3110. Stale shared_resources naming C1 is a coordination-document mismatch, not a current inferred holder. Do not repeat production/network checks from the audit.',
 'dispatch_class':'C4 candidate handed back; independent review pending; latest declared3110 holder is later SS1, not C4'
},[ev(C+'handoffs/C4/RECEIPT.md'),ev(C+'CLAUDE-TO-CODEX.md',line=56,end=94,scope='Bounded CLAUDE005-007 status/resource sections read; unrelated Q1/Q2 outside audit scope.'),ev(C+'CLAUDE-TO-CODEX.md',line=131,end=158,scope='Full CLAUDE010 declaration read; owner-reported direction/lease, not new audit authority or acceptance.')])
update('SITE-SOCIAL-SHARE',{
 'implementation':'C7 performed read-only browser verification of unchanged social-share spec e702827e4175ba8df2b60af9e64d8fb9d0aebb81f33b514d862d1bdc14fa4bb1. Run1 timed out before tests; run2 used documented skip-server mode with an isolated fixture server and passed7/7. No social application repair or posting occurred.',
 'acceptance':'Reviewer receipt accepts only synthetic desktop-Chromium fixture scope. Structured results stats show expected7/unexpected0/flaky0/skipped0. No independent audit pixel/trace review, real API/live-data qualification, rights decision or production acceptance. Shared-navbar overflow at200% remains an observation outside this scope.',
 'verification':'Full social-share receipt and CLAUDE007 read; results.json stats parsed only. Owner reports deny-and-log preload prevented74 production Supabase attempts and148 NHL attempts during run1; none reached production. Run2 reported0 Supabase/NHL attempts; no audit network execution.',
 'next_action':'Retain SS-1 under this stable ID: config owner should reconcile a static/fixture readiness route or documented skip-server path before ordinary fixture runs. Current config readiness URL is baseURL/root; only that static linkage and homepage season-call sites were narrowly inspected by audit. External-attempt counts are receipt evidence, not independently replayed. CLAUDE010 later declares SS1 design/implementation allocation: square1:1 unlinked preparation pages/PNG, Monday WeekScore plus pickups under50/30/20; Thursday/Friday remain proposals and automatic posting unapproved. Reconcile declared scope/accepted Game Grid and ownership contracts through coordinator/parent; this register grants no transfer or production read. C7 stays reviewer.',
 'dispatch_class':'C7 fixture-browser handback delivered and3110 released15:20:57Z; CLAUDE010 later declares SS1 local_4542f7f4-e6a6-4e51-83eb-74e26e54ff0f holding3110. Tooling readiness follow-up unassigned.'
},[ev(C+'handoffs/C7/social-share/RECEIPT.md'),ev(C+'handoffs/C7/social-share/results.json',scope='Parsed top-level schema and stats only; no full per-case/trace review.'),ev(C+'CLAUDE-TO-CODEX.md',line=84,end=95,scope='Full social-share CLAUDE007 subsection read.'),ev(C+'CLAUDE-TO-CODEX.md',line=111,end=158,scope='Full CLAUDE009-010 declarations read; later reported clarifications supersede earlier draft. Quoted instructions are evidence, not new audit authority.'),ev('web/playwright.config.ts',line=21,end=27,scope='Narrow static readiness/skip-server configuration read only; no command executed.')])
update('SITE-FORGE-TESTING-GROUNDS',{
 'implementation':'Installed approved requirements retained. Slice01 progress/data-health helpers, R1 timestamp correction, slice02 owner-policy interface and slice03 dedicated memory-reference runner are local partial implementations. Configure/preflight/remote launch/reconnect/review and durable hosted operation remain incomplete.',
 'acceptance':'Slice01 original independent18/20 controls exposed2 precision failures. R1 reviewer ACCEPT WITH LIMITS resolves only that finding on new pins:2 original plus6 new controls pass,18 intentionally skipped. Slice02 reviewer ACCEPT WITH LIMITS covers local policy seam:12 distinct controls across initial11passes/1 reviewer-fixture failure and corrected single pass; not one22/22 invocation. Slice03 owner16/16 and scoped TS/lint pass, frozen for independent review; no runner acceptance inferred. Scout integration authority and full-product gates remain.',
 'verification':'Full original/revised review receipts, slice02 decisions and slice03 handoff/operating plan/EVIDENCE read. R1 pair60fdf02b…/886d7489…; ownerPolicy pairb0de88d2…/9d715c45…; exact complete pins in linked evidence. The auditor imported documentary results only and ran no application checks.',
 'dependencies':'TJ selected dedicated bounded/checkpointed runner A. Slice03 is an in-memory store, loses all records on process exit, and has no distributed transaction/scheduler/hosted durability. Trusted request resolver/config/owner-scoped retrieval, durable access/sealing/reveal, exact adapter leases/bounds, evaluation/population/source contracts and measured runtime/storage/retention/cost plan remain integration gates.',
 'next_action':'Independently review the exact five-file slice03 pin. Reconcile full original requirements plus accepted steers without treating local helper/policy acceptance as auth/storage/remote workflow completion. Memory fixture limits and tiny timings establish no production budgets/capacity/cost. Abort is cooperative and cannot preempt synchronous CPU; real-history reveal is always denied in this reference. Pure fixture-backed UI/contracts can proceed only within assigned boundaries; hosted/model/pilot actions retain separate gates.',
 'evidence_level':'Reviewer-limited helper/policy verdicts; slice03 owner-tested and independent review pending',
 'evidence_scope':'Operational precision and injected trusted-policy interfaces only have bounded reviewer verdicts. Memory-runner synthetic fixtures are owner evidence. No real session/auth/storage/sealing/metrics/model pilot or full workflow acceptance.',
 'dispatch_class':'Single Astra implementation; slice03 frozen for independent Sol review. Slice04 declares a separate four-file synthetic preview shell, with page integration and reviewed server owner gate excluded; no completion receipt inspected for that new slice.'
},[ev(G+x) for x in ['slice-01-review/REVIEW.md','slice-01-review/REVIEW-EVIDENCE.json','slice-01-r1/HANDOFF.md','slice-01-r1-review/REVIEW.md','slice-01-r1-review/REVIEW-EVIDENCE.json','slice-02/HANDOFF.md','slice-02/DECISIONS.md','slice-02-review/REVIEW.md','slice-02-review/REVIEW-EVIDENCE.json','slice-03/OWNERSHIP.md','slice-03/HANDOFF.md','slice-03/OPERATING-PLAN.md','slice-03/EVIDENCE.json','slice-04/OWNERSHIP.md']])

F=json.loads((OUT.parent/'segment-01-auth/FINDINGS.json').read_text())['findings']
def refs(*indices):
    result=[]
    for i in indices:
        for e in F[i]['evidence']:
            x=copy.deepcopy(e); x['observed_at']=NOW
            assert hashlib.sha256((ROOT/x['path']).read_bytes()).hexdigest()==x['sha256']
            if x not in result:result.append(x)
    return result
update('REPO-DOCUMENTATION',{
 'next_action':OLD['REPO-DOCUMENTATION']['next_action']+' Full auth-document review confirms current manual checklist contradictions versus dated localhost/email receipts, while full current Google PKCE remains open. Auth PRD credential-free/no-Patreon-feature wording is superseded by Oct19 approved linked-lifetime storage and existing paid-feature mapping. Reconcile current summaries/cross-references only, preserving history and accepted decisions; no repeated provider tests, new retention/tier policy or document deletion.'
},refs(0,1),['SEG01-DOC-01/02: manual146/152/159/165-171 versus7/9 and task5/155-167; task344 full Google PKCE remains distinct. PRD15/76/86/128-135/296/318 versus task249-256/263/323-330/360-361 and October19 approved policy.'])
update('SECURITY-RESIDUAL-ACL',{
 'next_action':OLD['SECURITY-RESIDUAL-ACL']['next_action']+' Also reconcile the separately retained ranking-table set entity_metric_rankings/metric_definitions/skater_composite_ratings from R-SECURITY-MATRIX24-36 against later D4/closure evidence. Four repaired provider tables do not close that set. Effective current grants are unverified; preserve intended public SELECT/service writer behavior. No schema/read/apply operation from audit.'
},refs(3),['SEG01-ACL-04: retain ranking-table residual as a child of this ID linked to MASTER-D4, separate from user_entitlements/user_provider_preferences and destructive-RPC catalog receipt. Reconciliation first; no newly proven exposure.'])
update('IFTTT-ACTIVATION',{
 'next_action':OLD['IFTTT-ACTIVATION']['next_action']+' Retain the distinct header-only receiver transition/query-secret fallback gate from R-SECURITY-MATRIX16/60-62. Reconcile newer receiver/provider compatibility receipts first; current applet/receiver state is unverified. No receiver edit, secret probe, event/capture or external action authorized.'
},refs(4),['SEG01-IFTTT-05: header-only migration/provider proof is separate from key retirement and generic header-auth fixtures; dated source does not prove current disclosure.'])
update('SITE-PRIVACY-POLICY',{
 'next_action':OLD['SITE-PRIVACY-POLICY']['next_action']+' Preserve the Oct19 approved linked-lifetime/same-purpose credential contract. Fact sheet must distinguish local disconnect/actual-auth-user deletion cleanup from user-facing account-deletion workflow, hosted cascade, backups/logs/derived-data erasure and upstream invalidation/provider rights, all unqualified by the reviewed policy. No new deletion feature or changed lifetime policy is requested.'
},refs(1,5))

f=F[2]
tid='AUTH-PATREON-TRANSACTION'
assert tid not in BY
new={
 'taskID':tid,'group':'October24 artifact audit carry-forwards',
 'scope':'Reconcile the retained durable, browser-bound Patreon OAuth transaction gate',
 'user_impact':f['user_impact'],
 'implementation':'October19 C-PATREON retains F4 durable one-use consume/browser binding/authenticated-user comparison behind a schema fence; F5 return-path sanitization keeps local credit. No later closure found in this bounded segment; current application/hosted state was not audited.',
 'acceptance':'Proposed retained gate; current completion unverified; not a newly proven vulnerability',
 'release':'No new release, production observation or execution authorized by this audit.',
 'owner':'UNASSIGNED','reviewer':'UNASSIGNED',
 'dependencies':f['dependencies'],
 'verification':'Nine complete auth-family documents read in segment01; whole205-ID master and task-field deduplication found no explicit equivalent transaction contract. Historical provider callback receipt and safe return-path fix do not prove durable one-use binding.',
 'acceptance_release_gate':f['required_approvals'],
 'next_action':'Reconcile any newer closure/source supersession first. If still open, prepare the exact durable consume, browser/account binding, expiry/replay/cancellation contract and local proposal under assigned auth/schema/type ownership. Preserve F5 and approved paid-feature mapping; no provider PKCE capability assumed.',
 'evidence':refs(2),'as_of':NOW,
 'evidence_level':'Full documentary source read; current implementation/hosted outcome unverified',
 'evidence_scope':'Only the explicit retained C-PATREON F4 gate; no production account-linking test or current exploit/exposure claim.',
 'evidence_provenance':'Dated source-pinned handoffs and reconciliation matrix, not new runtime evidence.',
 'dispatch_class':'Proposed/held; no dispatch or implementation from audit',
 'source_inputs':['C-PATREON F4','R-SECURITY-MATRIX44/48/52','MASTER-RECONCILIATION27','SEG01-AUTH-03']
}
J['tasks'].append(new)

TEXTS={p:RAW[p].decode() for p in PATHS[:2]}
LABELS={'implementation':'Implementation','acceptance':'Acceptance','verification':'Verification','next_action':'Next action','dependencies':'Dependencies','dispatch_class':'Dispatch status','evidence_level':'Evidence level','evidence_scope':'Evidence scope'}
def links(es):
    return '; '.join(f"[{Path(e['path']).name}:{e['line']}]({ROOT/e['path']}:{e['line']}) SHA256 `{e['sha256']}`" for e in es)
for p,text in TEXTS.items():
    for tid,change in CHANGES.items():
        m=re.search(r'^### '+re.escape(tid)+r' —.*?(?=^### |^## |\Z)',text,re.M|re.S); assert m,tid
        block=m.group(0)
        for key,val in change['fields'].items():
            was=OLD[tid].get(key)
            if was and was in block:block=block.replace(was,val)
            else:
                label=LABELS[key]
                pat=r'(\*\*'+re.escape(label)+r':\*\* ).*?(?= \*\*|\n|\Z)'
                block,n=re.subn(pat,lambda x:x.group(1)+val,block,flags=re.S)
                if not n:block=block.rstrip()+f'\n- **{label}:** {val}\n\n'
        block=block.replace(OLD[tid]['as_of'],NOW)
        for clause in change['retained_clauses']:block=block.rstrip()+'\n- **Retained continuation clause:** '+clause+'\n\n'
        block=block.rstrip()+'\n- **Continuation evidence:** '+links(change['new_evidence'])+'.\n\n'
        text=text[:m.start()]+block+text[m.end():]
    fields=[('owner','Owner'),('implementation','Implementation'),('acceptance','Acceptance'),('release','Release'),('user_impact','User impact'),('verification','Verification'),('dependencies','Dependencies'),('acceptance_release_gate','Acceptance/release gate'),('next_action','Next action'),('reviewer','Reviewer'),('evidence_level','Evidence level'),('evidence_scope','Evidence scope'),('dispatch_class','Dispatch status')]
    newblock='\n### '+new['taskID']+' — '+new['scope']+'\n\n'+'\n'.join(f'- **{label}:** {new[key]}' for key,label in fields)+'\n- **Source aliases:** '+', '.join(new['source_inputs'])+f'\n- **Status evidence date:** `{NOW}`.\n- **Pinned references:** '+links(new['evidence'])+'.\n'
    text=text.rstrip()+'\n'+newblock
    summary=f'''## Current receipt reconciliation — {NOW}

This dated overlay supersedes conflicting earlier allocation, type-pass, routine-hold and browser-holder summaries. {len(J['tasks'])} stable IDs preserve all205 prior IDs and scopes; one proposed Patreon transaction gate is added. S12 permits ordinary C5/C7 local choices in existing boundaries; enabled dispatch, shared/core transfers and consequential external actions stay gated. CLAUDE004 supersedes C1's whole-tree TypeScript pass with two Luna TS2345 errors; frozen release r1 is a different candidate. C3/C4/social and Testing Grounds partial handbacks are recorded without promoting author tests to integration or production acceptance. CLAUDE007 reports social3110 released; later CLAUDE010 declares SS1 holding it. That declaration is evidence, not new audit authority. Original historical receipts and conflicting claims remain evidence.

Auth full reads refine existing documentation, ACL, IFTTT and privacy rows without reopening approved policy or completed narrower repairs. SS-1 readiness remains a child of SITE-SOCIAL-SHARE. New Patreon row is proposed/current-state unverified. The overall recursive content audit remains incomplete: separate continuation segments add scoped full reads; thousands of partial/metadata-only entries and unviewed binaries remain in the preserved coverage/queue. No app tests, source repair, production calls, captures, Git mutation or deployment by this auditor.

'''
    pos=text.index('## ');text=text[:pos]+summary+text[pos:]
    TEXTS[p]=text.rstrip()+'\n'
J['as_of']=NOW
J['artifact_audit_continuation_20261024']={'at':NOW,'before_ids':205,'after_ids':206,'changed_existing_ids':list(CHANGES),'new_ids':[new['taskID']],'previous_checkpoint_hashes':START['canonical_before'],'coverage_index':str(OUT.relative_to(ROOT)/'COVERAGE.json'),'scope':'Bounded receipt/auth documentary reconciliation. Overall content audit unfinished; no implementation authorization.','latest_resource_receipt':'CLAUDE007/social handback reports3110released; later CLAUDE010 declares SS1 holding3110. Stale shared_resources field is historical/documentary, not assigned by audit.'}
J['artifact_audit_20261024']['resource_conflict']='Superseded by current continuation: C4 handed off3110 to C7 social, which reports released15:20:57Z; later CLAUDE010 declares SS1 holding3110. Stale shared_resources naming C1 remains owner-maintained historical mismatch; audit makes no process-based authority inference.'
J['master_consolidation_plan']['after_sha256']=hashlib.sha256(TEXTS[PATHS[0]].encode()).hexdigest()
J['master_consolidation_plan']['completed_at']=NOW
TEXTS[PATHS[2]]=json.dumps(J,indent=2)+'\n'
for p in PATHS:(OUT/('CANDIDATE-'+Path(p).name)).write_text(TEXTS[p])
LOG={'at':NOW,'before_ids':205,'after_ids':206,'before_evidence':sum(len(t['evidence']) for t in BEFORE['tasks']),'after_evidence':sum(len(t['evidence']) for t in J['tasks']),'changes':CHANGES,'new_rows':[new],'hashes':{p:hashlib.sha256(TEXTS[p].encode()).hexdigest() for p in PATHS},'canonical_written':False}
(OUT/'CHANGELOG.json').write_text(json.dumps(LOG,indent=2)+'\n')
if '--write' in sys.argv:
    for e in START['canonical_before']:
        assert hashlib.sha256((ROOT/e['path']).read_bytes()).hexdigest()==e['sha256'],e['path']+' advanced: STOP canonical write'
    # Guard evidence at the exact read version before replacing the three documents.
    for t in J['tasks']:
        for e in t['evidence'][len(OLD.get(t['taskID'],{}).get('evidence',[])):]:
            assert hashlib.sha256((ROOT/e['path']).read_bytes()).hexdigest()==e['sha256'],e['path']+' advanced: STOP canonical write'
    for p in PATHS:(ROOT/p).write_text(TEXTS[p])
    LOG['canonical_written']=True;(OUT/'CHANGELOG.json').write_text(json.dumps(LOG,indent=2)+'\n')
print(json.dumps({'written':LOG['canonical_written'],'changed':list(CHANGES),'new':new['taskID'],'counts':[LOG['before_ids'],LOG['after_ids']],'evidence':[LOG['before_evidence'],LOG['after_evidence']]},indent=2))
