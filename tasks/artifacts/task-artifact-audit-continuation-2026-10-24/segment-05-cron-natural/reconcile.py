"""Prepare guarded documentary candidates; --write installs only after validation."""
from pathlib import Path
import collections, copy, datetime, difflib, hashlib, json, re, sys

ROOT = Path('/Users/tim/Code/fhfhockey.com')
B = ROOT / 'tasks/artifacts/task-artifact-audit-continuation-2026-10-24/segment-05-cron-natural'
P = ['tasks/handoff-2026-10-20/MASTER-TASKLIST-2026-10-20.md', 'tasks/artifacts/fhfh-sprint-ledger-2026-10-22/LEDGER.md', 'tasks/artifacts/fhfh-sprint-ledger-2026-10-22/LEDGER.json']
sha = lambda x: hashlib.sha256(x).hexdigest()
dump = lambda p, d: p.write_text(json.dumps(d, indent=2, ensure_ascii=False)+'\n')
start = json.loads((B/'START.json').read_text())
current = {p:(ROOT/p).read_bytes() for p in P}
assert all(sha(current[p]) == start['canonical_before'][p] for p in P), 'Canonical advanced; no write'
old = json.loads(current[P[2]])
stamp_path = B/'CHECKPOINT-TIME.txt'
if not stamp_path.exists(): stamp_path.write_text(datetime.datetime.now(datetime.timezone.utc).isoformat()+'\n')
now = stamp_path.read_text().strip()
for p,raw in current.items():
    dest=B/('BASELINE-'+Path(p).name)
    if dest.exists(): assert dest.read_bytes()==raw
    else: dest.write_bytes(raw)

sources={}
def ev(path,line,scope='Full documentary read; owner/reviewer tests and hosted receipts not reproduced by auditor.'):
    raw=(ROOT/path).read_bytes(); assert 1<=line<=len(raw.decode().splitlines())
    h=sha(raw); sources[path]=h
    return dict(path=path,line=line,sha256=h,observed_at=now,review_scope=scope)
schedule='tasks/TASKS/cron-operations/cron-schedule.md'
nst='tasks/TASKS/cron-operations/tasks-prd-cron-nst-audit-remediation.md'
email='tasks/TASKS/cron-operations/tasks-cron-audit-email-failures.md'
coord='tasks/artifacts/cross-platform/2026-10-24-coordination/'
tg='tasks/artifacts/forge-testing-grounds-2026-10-24/'
fpi='tasks/TASKS/forge-projections/tasks-forge-projection-improvements-2026-10-22.md'

changes={
'PIPE-JOB79':dict(fields={
 'implementation':'The former keep-active proposal is superseded by the coupled nine-file retirement/advisory overlay already recorded under FPI-11.4. Canonical schedule documentation marks job79 inactive/unscheduled October22; the overlay preserves full-job pacing and job399 records together.',
 'acceptance':'Qualified independent local acceptance of patch 4e0b4db7da44e883dd278f611c787db646b83874af8b9e7d624d4fd5c75389ec; reviewer reports36 focused checks and the expected retirement-only negative control. This closes the old conditional-retirement proposal only, not pipeline/backfill or cross-host pacing qualification.',
 'release':'Historical FPI-11.4 task receipt records R25 master27751818b and READY deployment dpl_961psWL4xHd751Pf6QU4V1TxSm3a. Documentary release credit only; no new hosted verification by this audit.',
 'verification':'Full owner HANDOFF and independent REVIEW read; FPI task11.4 lines140–142 and schedule dated retirement cross-checked. Same-user filesystem coordination is not a distributed job lock; progress-read index remains held without SQLSTATE/timing/plan evidence.',
 'acceptance_release_gate':'Retirement/advisory coupling retained under FPI-11.4. PIPE-BACKFILL, PIPE-NATURAL, cross-host coordination and progress-read evidence gates remain separate; no reactivation or schedule operation from this row.',
 'next_action':'Reconcile aliases PIPE-JOB79 and FPI-11.4 as the same retired-job obligation; do not dispatch another retirement or keep job79 active from the stale proposal. Preserve broader unfinished ingestion/backfill/natural-run work and the progress-read index hold.',
 'dispatch_class':'Historical retirement closed through FPI-11.4; no new implementation or hosted authority',
 'evidence_level':'Exact local reviewer verdict plus dated release receipt; current hosted state unobserved'
},evidence=[ev('tasks/artifacts/fpi-11-4-job79-2026-10-22/HANDOFF.md',3),ev('tasks/artifacts/fpi-11-4-job79-independent-review-2026-10-22/REVIEW.md',3),ev(fpi,140,'Only lines132–147 inspected; dated task11.4 release receipt, not independent hosted verification.'),ev(schedule,47,'Dated header and all73 JSON records inspected; remaining historical SQL templates not fully reviewed.')]),
'SUSTAINABILITY-NATURAL':dict(fields={
 'implementation':'Preserve accepted narrower local repairs and historical releases. Exact C0019 / failed-jobs NEW6 requires committed-batch receipts after partial baseline writes; NST NEW73/C0065 separately requires job374/baseline order and full score-page population. August1 NEW61 handoff success predates the October17 recurrence and does not close it.',
 'acceptance':'Exact later natural committed-batch, non-overlap and full-population closure remains unverified in inspected receipts. Historical all-200 chain and local counter repair are narrower evidence.',
 'release':'Historical fixes retain release credit; exact shipped baseline receipt and later natural chain closure remain open, not inferred from local source or document schedule slots.',
 'verification':'Failed-jobs task line99 records C0019 timeout/partial-write failure and closure requirement. NST tasks189/202 distinguish earlier NEW61 success from later NEW73. Prior segment04 narrow source read found rowsUpserted/partialWrite counters survive the catch; it did not execute or prove release. Schedule JSON has job374 at10:38 and baseline326 at10:40, which is configured intent rather than observed non-overlap. Historical82/171 marker backlog and4 fresh markers do not certify all batches.',
 'acceptance_release_gate':'Exact shipped candidate plus one natural run reporting committed batches for C0019; correlated non-overlapping upstream→baseline→priors→all window-z/score/trend pages, full population and durable markers. No cron/API/database/natural invocation or blanket shutdown authorized.',
 'next_action':'Existing owner reconciles retained exact release and natural receipts for C0019/NEW6 and C0065/NEW73 against Sustainability NEW17. Record source/job/run identity, committed counts and all-page coverage; keep missing evidence open rather than rerunning or duplicating accepted local fixes.'
},evidence=[ev('tasks/TASKS/cron-operations/tasks-prd-cron-failed-jobs-remediation.md',99,'Full source read in segment04; exact C0019 child and natural committed-batch requirement.'),ev(nst,189),ev(nst,202),ev(schedule,62,'All73 first-fence records parsed and reviewed; scheduler configuration only, no hosted run proof.')]),
'CRON-SCHEDULE-DISPOSITION':dict(fields={
 'implementation':'October19 policy is3AMlocal America/New_York for the daily batch, recurring freshness jobs excluded. The original13 fixed-entry proposal included job79, later retired under FPI-11.4. Preserve that closure; only the other12 original identities remain unresolved as a documentary disposition set, not a claim that12 are currently hosted/active. Report NEW12 and inventory parity remain separate.',
 'verification':'Full floor proposal read, including its exact13 identities and job79 row32; schedule header and all73 JSON rows inspected. JSON contains57active/16inactive while August3 prose still says69total/59active/10inactive and some timeline rows preserve old79/393/392 states. These are static document discrepancies across dates, not current hosted totals. Vercel daily pipeline and pg_cron job399 queue worker have distinct ownership.',
 'next_action':'Reconcile remaining original fixed identities and report NEW12 against later accepted retirement/schedule receipts before any owner decision. Exclude retired79 from a new reschedule proposal. Reconcile dated inventory header/timeline/SQL references without reviving old schedules. Preserve recurring freshness,3AMlocal seasonal semantics and separate provider owners.'
},evidence=[ev('tasks/codex-sprint-2026-10-19/continuation-review/R-CRON-FLOOR-PROPOSAL.md',5),ev('tasks/codex-sprint-2026-10-19/continuation-review/R-CRON-FLOOR-PROPOSAL.md',32),ev(schedule,17,'Partial inventory read: dated header, all73 JSON records, selected timeline/provider notes; historical SQL remainder unreviewed.'),ev(email,208)]),
'PIPE-NATURAL':dict(fields={
 'verification':'Full paired NST PRD/task/email lists read this segment. A-CRON-EMAIL7.5/C0047 has an August3 non-preview clean natural report closure, followed by the distinct August4 B-CRON-NST NEW72/C0076 recurrence on jobs43/99/275/328. Runtime failures establish deployed entry, not a terminal persisted audit. Missing-key fail-fast and standings14-day cap are local-only at those dated receipts; no current credential or runtime failure is inferred. Existing later pipeline/forecast gates retain their own exact receipts.',
 'next_action':'Reconcile existing retained terminal route/audit evidence for the NEW72/C0076 quartet separately from the closed August3 C0047 report receipt and newer PIPELINE work. Do not add a duplicate wrapper repair from an old gap or infer natural success from200/submission alone. Current Oct23/24 report UUID/lease/completion evidence stays separately open; no endpoint invocation, historical backfill or model/pilot restart.'
},evidence=[ev(nst,200),ev(nst,222),ev(email,184)]),
'BILLING-CANCEL-RELOAD':dict(fields={
 'implementation':'C3 reload continuity remains independently ACCEPT WITH LIMITS at patch c500b580b79f2bd1ce3bc00e50630ea3ac1d47bd1985843c53121cb8a9b420ff. Parent now grants the exact browser-auth.ts/AuthProviderContext.test.tsx cleanup transfer for an isolated candidate only under CODEX-012; CLAUDE013 acknowledges it. Canonical/release files remain read-only, sign-out completion and integration are pending.',
 'next_action':'C3 proceeds only in the granted isolated snapshot with exact anchored cancellation-key cleanup and focused absent-panel/case/unrelated-storage/sign-out-error/timeout controls. Final independent handback and canonical integration remain separate. Preserve24h reuse-eligibility wording and original mounted/reload acceptance; no physical global erasure or exactly-once financial claim. Refund-consumer/private-safe-error scope remains unstarted.',
 'dispatch_class':'Exact parent isolated shared-auth/test lease granted and acknowledged; sign-out completion/final review/integration pending'
},evidence=[ev(coord+'CODEX-TO-CLAUDE.md',12,'Only current lines1–26 read fully; exact isolated C3 transfer, not canonical integration.'),ev(coord+'CLAUDE-TO-CODEX.md',191,'Only current CLAUDE013 lines191–208 fully read; allocation/acknowledgement, no completion.')]),
'SITE-FORGE-TESTING-GROUNDS':dict(fields={
 'acceptance':'Earlier timestamp and owner-policy limited verdicts retained. Slice03 original P2 S03-R1 is resolved only on the frozen three-file R1 pins: independent ACCEPT WITH LIMITS reports one11-pass/24-intentionally-skipped invocation plus scoped TS/lint. Original failed evidence is preserved. Scout retains integration authority; no full-product, hosted or scientific acceptance.',
 'verification':'Full slice03-r1 HANDOFF, independent REVIEW and REVIEW-EVIDENCE read; owner EVIDENCE non-pin fields reviewed structurally. Independent11 controls comprise original2, new owner regression groups3 and new independent6; original16 owner cases were not rerun by reviewer. Reviewer88/88 pins are reported, not reproduced by auditor. Unresolved evaluation stays successful0/failed0/pending1/percent0 at waiting cap. Optional outcome-check limit preserves omitted manifest hash but increases conservative total claims from E to E+W, up to2E for legacy omission; no hosted resource allowance inferred.',
 'dependencies':'Dedicated bounded/checkpointed runner A remains selected. Memory-only durability, actual trusted request/session/worker authorization, sealing/reveal, executor finality, statistical/model/pilot contracts and approved runtime/storage/retention/cost plan remain incomplete. CODEX016 grants ten-path local owner/page/API implementation and a narrow requested localhost view, not shared-auth edits, hosted calls, owner environment configuration or activation.',
 'next_action':'Retain S03-R1 limited correction credit on exact new pins and original failure history. Budget computation and outcome checks independently before any hosted activation; incomplete computation must checkpoint rather than claim availability waiting. Follow the exact local slice05 lease and preserve locked SSR/API owner gates. Preview/page delivery or localhost request is not evidence of durable workflow/auth/scientific acceptance.',
 'evidence_level':'S03-R1 independently ACCEPT WITH LIMITS on revised pins; full workflow and hosted/scientific qualification open',
 'dispatch_class':'Single Astra local implementation; limited reviewer correction verdict and exact slice05 grant recorded, no external execution authority'
},evidence=[ev(tg+'slice-03-r1/HANDOFF.md',1),ev(tg+'slice-03-r1-review/REVIEW.md',1),ev(tg+'slice-03-r1-review/REVIEW-EVIDENCE.json',1),ev(coord+'CODEX-TO-CLAUDE.md',5,'Only lines1–26 fully read; exact local ten-path grant and inherited safe viewing limits, no audit execution.')]),
'REPO-DOCUMENTATION':dict(fields={
 'next_action':'Claude013 now records C6 allocated for docs pointer correction, superseding the earlier C6-unallocated hold only. Preserve all retained auth/Rankings/Underlyings/parked scopes. Reconcile current summaries against accepted contracts and exact source receipts. Cron source prose mixes August totals and later JSON retirement/provider updates; reconcile documentary pointers without changing schedules or inferring hosted state. Broad cleanup/retirement decisions stay held; no document deletion.',
 'dispatch_class':'C6 pointer-correction allocation reported in CLAUDE013; audit alone owns canonical register reconciliation, no completion inferred'
},evidence=[ev(coord+'CLAUDE-TO-CODEX.md',191,'Only lines191–208 fully read; current allocation receipt.'),ev(schedule,17,'Dated inventory header and full first JSON fence reviewed, historical SQL remainder unreviewed.')])
}

new=copy.deepcopy(old); byid={t['taskID']:t for t in new['tasks']}
for tid,c in changes.items():
    t=byid[tid];c['before_fields']={k:t.get(k) for k in c['fields']}
    t.setdefault('artifact_audit_segment05',[]).append(dict(at=now,before_fields=c['before_fields'],note='Dated documentary overlay; scopes, legacy clauses and evidence prefixes preserved. No implementation/hosted authority.'))
    t.update(c['fields']);t['as_of']=now;t['evidence'].extend(c['evidence'])

overlay=f'''## Cron chronology and content checkpoint — {now}

206 stable IDs and all previous scopes/evidence are preserved. PIPE-JOB79's old keep-active proposal is superseded by FPI-11.4's accepted coupled retirement and dated R25 receipt. The original13 schedule-floor set included retired79; the remaining12 original identities require documentary reconciliation, not a claim of12current active hosted jobs. C0019/failed-jobs NEW6 remains under SUSTAINABILITY-NATURAL: local counter repair and historical all-200 chains do not prove the exact shipped fix plus a natural committed-batch/full-population/non-overlap receipt. August3 report closure and August4 NEW72 terminal-audit recurrence are separate.

Later reviewed S03-R1 resolves only the pending-outcomes P2 on exact new pins, ACCEPT WITH LIMITS (11pass/24intentional skip); E+W and legacy up-to2E resource bounds need separate hosted budgeting. C3 isolated shared-auth/test transfer and local Testing Grounds slice05 ownership are granted; no canonical integration or full sign-out/workflow acceptance is inferred. C6 pointer-correction allocation is reported. Historical conflicting overlays below retain their dates.

Segment05 records full documentary reads separately from structured inventory/partial SQL coverage. Static inventory73/57/16 is not hosted state. No new IDs, application/test execution, cron/API/database/natural/provider call, Git mutation or deployment by the auditor. Overall recursive content audit remains unfinished; exact coverage and continuation are in [segment05](/Users/tim/Code/fhfhockey.com/tasks/artifacts/task-artifact-audit-continuation-2026-10-24/segment-05-cron-natural/REPORT.md).

'''
labels={'implementation':'Implementation','acceptance':'Acceptance','release':'Release','verification':'Verification','acceptance_release_gate':'Acceptance/release gate','next_action':'Next','dispatch_class':'Dispatch class','dependencies':'Dependencies','evidence_level':'Evidence level'}
def block(text,tid):
    m=re.search(r'^### '+re.escape(tid)+r' —.*?(?=^### |^## |\Z)',text,re.M|re.S)
    assert m,tid
    return m

texts=[]
for idx in [0,1]:
    text=current[P[idx]].decode()
    text=re.sub(r'As of `[^`]+`',f'As of `{now}`',text,count=1)
    if idx==0:text=text.replace('**205 current ledger rows**','**206 current ledger rows**',1)
    anchor=text.index('\n## ')
    text=text[:anchor]+'\n\n'+overlay.rstrip()+'\n'+text[anchor:]
    for tid,c in changes.items():
        m=block(text,tid);oldblock=m.group();nb=oldblock
        for k,val in c['fields'].items():
            before=c['before_fields'][k]
            if isinstance(before,str) and before in nb:
                nb=nb.replace(before,val,1)
                if val.endswith('.'):
                    nb=nb.replace(val+'.',val,1)
            else:nb=nb.rstrip()+f'\n- **Current {labels.get(k,k)}:** {val}\n\n'
        t=byid[tid]
        nb=nb.rstrip()+f'\n- **Current reconciliation date:** `{now}`; prior dated status retained above.\n'
        nb+='- **Segment05 evidence:** '+'; '.join(f'[{e["path"]}:{e["line"]}](</Users/tim/Code/fhfhockey.com/{e["path"]}:{e["line"]}>) SHA256 `{e["sha256"]}`' for e in c['evidence'])+'.\n\n'
        if tid=='PIPE-JOB79':nb+='- **Historical proposal note:** P09 queued-retirement wording above is superseded by FPI-11.4; no second retirement dispatch.\n\n'
        for val in c['fields'].values():assert val in nb,(tid,val)
        text=text[:m.start()]+nb+text[m.end():]
    texts.append(text.rstrip()+'\n')
new['as_of']=now
new['artifact_audit_segment05_20261024']=dict(at=now,changed_ids=list(changes),added_ids=[],baseline_evidence=sum(len(t['evidence']) for t in old['tasks']),new_evidence=sum(len(c['evidence']) for c in changes.values()),coverage=str(B.relative_to(ROOT)/'COVERAGE.json'),whole_tree_complete=False)
mc=new['master_consolidation_plan'];mc['after_sha256']=sha(texts[0].encode());mc['completed_at']=now;mc['task_rows_after']=206;mc['status']='October24 segment05:206 stable IDs; documentary cron chronology and bounded later receipts, whole-tree content audit unfinished'
candidate={P[0]:texts[0].encode(),P[1]:texts[1].encode(),P[2]:(json.dumps(new,indent=2,ensure_ascii=False)+'\n').encode()}
for p,raw in candidate.items():(B/('CANDIDATE-'+Path(p).name)).write_bytes(raw)
dump(B/'CHANGELOG.json',dict(at=now,before_ids=len(old['tasks']),after_ids=len(new['tasks']),before_evidence=sum(len(t['evidence']) for t in old['tasks']),after_evidence=sum(len(t['evidence']) for t in new['tasks']),changes=changes))
dump(B/'SOURCE-PINS.json',sources)

ids=lambda d:[t['taskID'] for t in d['tasks']]
assert ids(old)==ids(new) and len(set(ids(new)))==206
for a,b in zip(old['tasks'],new['tasks']):
    assert a['scope']==b['scope'] and b['evidence'][:len(a['evidence'])]==a['evidence']
    if a['taskID'] not in changes:assert a==b
legacy=[t['taskID'] for t in old['tasks'] if t['taskID'].startswith('MASTER-')];assert len(legacy)==32
for idx in [0,1]:
    original=current[P[idx]].decode();prepared=candidate[P[idx]].decode()
    assert collections.Counter(re.findall(r'^### (\S+) —',prepared,re.M))==collections.Counter(ids(new))
    for tid in legacy:assert block(original,tid).group()==block(prepared,tid).group(),(idx,tid)
validation=dict(at=now,stable_ids=206,baseline_ids_preserved=True,all_scopes_preserved=True,baseline_evidence_prefixes_preserved=True,legacy_blocks_byte_identical_each_markdown=32,unchanged_rows_identical=206-len(changes),changed_rows=len(changes),canonical_before=start['canonical_before'],candidate_hashes={p:sha(raw) for p,raw in candidate.items()},source_pins=len(sources),application_checks_run=0,external_requests=0,git_mutations=0,whole_tree_content_complete=False)
patch=''.join(''.join(difflib.unified_diff(current[p].decode().splitlines(True),candidate[p].decode().splitlines(True),fromfile='before/'+p,tofile='after/'+p)) for p in P)
(B/'CANONICAL-CHECKPOINT.patch').write_text(patch)
dump(B/'VALIDATION-PREPARED.json',validation)
if '--write' in sys.argv:
    assert all(sha((ROOT/p).read_bytes())==h for p,h in start['canonical_before'].items()),'Canonical changed during preparation'
    assert all(sha((ROOT/p).read_bytes())==h for p,h in sources.items()),'Evidence changed; inspect before writing'
    for p,raw in candidate.items():(ROOT/p).write_bytes(raw)
    assert all((ROOT/p).read_bytes()==raw for p,raw in candidate.items())
    validation['canonical_written_and_read_back']=True
    dump(B/'VALIDATION-CANONICAL.json',validation)
print(json.dumps(dict(changed_ids=list(changes),ids=206,evidence_before=sum(len(t['evidence']) for t in old['tasks']),evidence_after=sum(len(t['evidence']) for t in new['tasks']),candidate_hashes=validation['candidate_hashes'],written='--write' in sys.argv),indent=2))
