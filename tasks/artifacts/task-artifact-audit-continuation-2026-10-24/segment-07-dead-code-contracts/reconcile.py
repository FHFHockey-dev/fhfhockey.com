"""Guarded documentary reconciliation, no application or Git operations."""
from pathlib import Path
import collections, copy, datetime, difflib, hashlib, json, re, sys

ROOT=Path('/Users/tim/Code/fhfhockey.com')
B=ROOT/'tasks/artifacts/task-artifact-audit-continuation-2026-10-24/segment-07-dead-code-contracts'
P=['tasks/handoff-2026-10-20/MASTER-TASKLIST-2026-10-20.md','tasks/artifacts/fhfh-sprint-ledger-2026-10-22/LEDGER.md','tasks/artifacts/fhfh-sprint-ledger-2026-10-22/LEDGER.json']
sha=lambda raw:hashlib.sha256(raw).hexdigest()
dump=lambda p,d:p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
start=json.loads((B/'START.json').read_text());raws={p:(ROOT/p).read_bytes() for p in P}
assert all(sha(raws[p])==start['canonical_before'][p] for p in P),'Canonical changed; no write'
coverage=json.loads((B/'COVERAGE.json').read_text())
snapshots=json.loads((B/'SOURCE-SNAPSHOT-INDEX.json').read_text())['sources']
post_cutoff=[]
for e in coverage['entries']:
    if e['status']!='metadata-only':
        if e['path'] in snapshots:
            snap=snapshots[e['path']]
            assert sha((ROOT/snap['path']).read_bytes())==e['sha256']
            actual=sha((ROOT/e['path']).read_bytes())
            if actual!=e['sha256']:post_cutoff.append(dict(path=e['path'],reviewed_sha256=e['sha256'],current_sha256=actual,status='Changed after frozen reviewed cutoff; pending next content pass'))
        else:
            assert sha((ROOT/e['path']).read_bytes())==e['sha256'],'Reviewed source advanced: '+e['path']
dump(B/'POST-CUTOFF-CHANGES.json',post_cutoff)
stamp=B/'CHECKPOINT-TIME.txt'
if not stamp.exists():stamp.write_text(datetime.datetime.now(datetime.timezone.utc).isoformat()+'\n')
now=stamp.read_text().strip()
for p,raw in raws.items():
    dest=B/('BASELINE-'+Path(p).name)
    if dest.exists():assert dest.read_bytes()==raw
    else:dest.write_bytes(raw)
old=json.loads(raws[P[2]]);new=copy.deepcopy(old);byid={t['taskID']:t for t in new['tasks']};pins={}
def ev(path,line=1,scope='Full documentary source read; historical owner/reviewer/external receipts not reproduced by auditor.'):
    original=path
    if path in snapshots:path=snapshots[path]['path']
    raw=(ROOT/path).read_bytes();assert 1<=line<=len(raw.decode().splitlines());pins[path]=sha(raw)
    record=dict(path=path,line=line,sha256=sha(raw),observed_at=now,review_scope=scope)
    if original!=path:record['original_path']=original
    return record
D='tasks/TASKS/dead-code-cleanup/'
W='tasks/artifacts/wigo-player-card-investigation-2026-10-24/'
C='tasks/artifacts/player-cards-2026-10-24/'
steer=str((B/'PARENT-STEERS.json').relative_to(ROOT))
changes={
'WGO-HISTORY':dict(fields={
 'implementation':'Preserve the accepted forward season/date guard and its separate253,257 mislabeled/105 bad-date historical proposal. A different88-row Utah team-identity repair is source-reported applied/replay-verified under NEW105; do not reopen it. NEW107 closes relocation lineage/design and forward writer evidence, while the distinct376-row ATL/PHX physical repair remains authorization-held.',
 'acceptance':'Forward/local and exact Utah receipt credit remain limited to their named cohorts. No whole historical repair acceptance; date-label and376-row relocation mutations remain held/current-state unverified.',
 'verification':'Full WGO-LABELS, Utah and relocation contracts read. Utah source records ledger20260730200000 and88 exact mappings; relocation source records five historical scopes/376 rows and an explicit future transaction/rollback design only. These dated counts are not fresh hosted observations. NEW107 source assertion correction28/28/full3599 is owner evidence, not new writer/data proof.',
 'next_action':'Keep three cohorts separate within WGO-HISTORY: original season/date reconstruction and105 bad dates; completed88-row Utah identity repair; held376-row relocation-era repair design. Reconcile only retained exact receipts/current owner disposition before any proposed mutation; do not relabel NEW107 design closure as physical repair or revive the superseded sKO replacement/backfill plan.',
 'evidence_level':'Full documentary chronology reconciled; historical production counts and future repair gates remain qualified'
},evidence=[ev('tasks/artifacts/codex-2026-10-20/WGO-LABELS.md',3),ev(D+'wgo-utah-identity-repair-contract.md',3),ev(D+'wgo-relocation-era-identity-contract.md',7),ev(D+'tasks-prd-cleanup-tasks.md',235,'Only selected NEW20/107/127 and closure lines reviewed; rest of paired task file not fully read.')]),
'REPO-GENERATED-TRACKING':dict(fields={
 'implementation':'CR-REL-03 and B-CLEAN NEW127/C0032/C0039/C0042 are the same generated-tracking follow-up. Earlier cleanups and158/158 July closure retain credit; the October17 recurrence is later evidence. No current index/tracking inspection or cleanup was performed by this audit.',
 'verification':'Full cleanup/dead-code PRDs preserve their historical removals and quarantines; selected cleanup task256 records482 cached files/~79MB, retained UI outputs and eight temporary CLI-state files as the October17 recurrence. Those are dated source claims, not freshly counted tracked paths. A clean isolated candidate does not by itself prove canonical tracking cleanup.',
 'next_action':'Existing release/repository owner reconciles NEW127 and CR-REL-03 against exact current tracking receipts when authorized; preserve local files and evidence, no history rewrite or blanket deletion. Keep completed July removals closed and do not create another generated-cache task.',
 'source_inputs':['CR-REL-03','B-CLEAN NEW127','C0032','C0039','C0042']
},evidence=[ev(D+'tasks-prd-cleanup-tasks.md',256,'Only selected task/closure lines inspected; no Git/index command or cache cleanup.'),ev(D+'prd-cleanup-tasks.md',8),ev(D+'tasks-prd-dead-code-report.md',34)]),
'PIPE-DRM-NATURAL':dict(fields={
 'implementation':'Preserve accepted transaction/CAS/normalization and narrower canary/UI/wrapper credit. NEW20/23–29/32/33/37–39 retain exact history/cursor/writer/natural receipt gaps. Add the distinct October17 NEW86/C0074 same-name Yahoo position recurrence for reconciliation; the existence of a selector name in a helper inventory is not shipped-fix/natural-success proof. NEW49/50/51 historical scheduler/runtime/audit closures remain closed.',
 'verification':'Full DRM PRD and August1 local77-case receipt read, plus all selected unchecked/NEW49/50 task clauses. NEW50 has an August4 completed/persisted natural closure; earlier open boilerplate is superseded. NEW86 source183 records the Pettersson collision and exact ship-plus-natural closure; a generated helper index names selectRelationshipYahooPosition but establishes no behavior/release. Audit ran no route, source import, test, database or natural run.',
 'next_action':'Reconcile NEW86/C0074 against exact newer selector/candidate and natural-success receipts within this existing ID, without declaring the historical failure current or dispatching another repair. Keep broader NEW20/23–29/32/33/37–39 evidence gates and no-backfill quarantine separate; do not reopen completed49/50/51 or retired supabaseShifts.js from old PRD sections.',
 'source_inputs':['MISS-DRM-NATURAL','MS41-041','MS41-042','MS41-047','B-DRM NEW86','C0074']
},evidence=[ev(D+'prd-drm-refactor.md',3),ev(D+'drm-local-gates-checkpoint-2026-08-01.md',45),ev(D+'tasks-prd-drm-refactor.md',143,'Selected unchecked/NEW49/50 clauses only; full paired task file not read.'),ev(D+'tasks-prd-drm-refactor.md',183,'Selected exact NEW86 clause only; current shipped outcome remains unverified.')]),
'SITE-WIGO':dict(fields={
 'implementation':'C4 workflow-link candidate/browser receipt retains its narrow credit. Separate investigator01a16eab-cefb-71a0-9a22-199c2d039009 handed back the TJ-approved four-file local data fix at patcha63ef5a4e6dde4ee1255661a612f01b79a4e4306c5822f8d4fe078f89fbb394e. Source-frame alignment, six read-error branches and recent-snapshot rate authority are implemented per owner; independent review/integration pending, no production refresh/backfill.',
 'acceptance':'No whole WiGO/data acceptance. Retained diagnostic has two SELECTs/68rows/no writes: L5 current inputs5/5 but stored nulls, L10 matches9/10, independent L20 matches13/20. Owner reports58/58 focused tests and scoped lint passed; whole-web TypeScript exits2 on the same two pre-existing Luna errors, not a clean build. Exact correction independent review is pending. One-player/fixture evidence establishes no league coverage.',
 'verification':'Full original offline report was reviewed in segment06; full production addendum/summary/SQL and local-fix ownership read here. Auditor parsed retained68row source groups and date/season joins, reproduced5/9/13 matching and L5 sums6313seconds/1.82ixG/35iCF without SQL/app execution. No wigo_rates row existed for this player and STD matched, so offline override/STD risks are not this demonstrated cause. Six older unmatched selected L20 dates are not proven absent deeper in source tables; chronology of L5 nulls remains unknown.',
 'next_action':'Parent independently reviews the exact four-file correction and its invalid-frame/fail-closed behavior before acceptance/integration. Earlier written player batches are not rolled back on a later source error; population-wide legacy-frame compatibility was not tested and remains a release concern. Preserve true NST gaps as unavailable, current cross-season policy and C4 wiring credit. Stored L5 nulls remain unchanged by code edits; any bounded refresh path/execution and October5 backfill require separate authority. Card worker consumes only reviewed supplied evidence.',
 'dispatch_class':'Existing WiGO investigator handed back local four-file candidate; independent review pending, no new worker or execution authority from audit'
},evidence=[ev(W+'production-diagnostic/REPORT.md',5),ev(W+'production-diagnostic/summary.json',1),ev(W+'local-fix/OWNERSHIP.json',1),ev(W+'local-fix/HANDOFF.md',1),ev(W+'local-fix/HANDOFF.json',1),ev(steer,1,'Trusted parent authorization record only; no authority transferred to auditor.')]),
'REPO-DOCUMENTATION':dict(fields={
 'next_action':'Retain reported C6 pointer-correction allocation and all auth/Rankings/Underlying scopes. Dead-code full reads confirm B-DEAD44/44 closure, supported FORGE/admin surfaces, retained quarantines and superseded sKO burn-down; do not revive old deletion/modernization recommendations or re-close them as new work. Reconcile stale open boilerplate to later dated CLEAN/DRM closures while preserving October recurrences and held history. Player-card inputs are now installed by their owner; cloud-copy header wording is historical. No diary/document retirement from audit.'
},evidence=[ev(D+'hidden-product-surface-ownership-matrix.md',5),ev(D+'tasks-prd-dead-code-report.md',23),ev(D+'prd-dead-code-report.md',279),ev(D+'burn-down-plan.md',3),ev(C+'INPUTS.json',1)])
}
newid='SITE-PLAYER-CARDS';assert newid not in byid
added=dict(taskID=newid,group='October24 bounded local player-card work',scope='Build shareable observed player cards with honest windows, all-valid-player ranks and snapshot-consistent PNGs',user_impact='Anonymous visitors can discover/read/export useful cards; unknown coverage and unapproved premium choices must remain explicit.',implementation='TJ authorized task generation and bounded local implementation by one Sol in a new visible thread. Initial PRDv1/tasklistv0 installation exactly matched complete reviewed Library text; the local task list is now an owner working derivative. Worker has a coordinator-granted nine-path local slice and reports a synthetic card/PNG preview plus proposed rank convention implemented in the local task derivative. Owner frozen handoff/EVIDENCE now read after their initial references preceded file creation;10focused tests/10offline Chromium/scoped static passes are owner evidence only, with independent acceptance pending. The old unapproved/no-task-generation PRDv0 wording is superseded only by this bounded authorization.',acceptance='Task list is parent-reviewed for dispatch; implementation acceptance pending. Free public search/basic card/PNG, curated optional metrics and premium expanded metrics/two-player comparison are confirmed. Exact allocation, season/incomplete-N policy, proposed defaults, rank convention and visual proposals remain unapproved choices.',release='Local-only; no deployment, live-card, model/scientific, source-rights or production coverage acceptance.',owner='CODEX-SCOUT',reviewer='UNASSIGNED',dependencies='Existing single Sol card owner; exact new-path ownership and protected shared files; SITE-WIGO diagnostic/local-fix dependency; SITE-SOCIAL-SHARE export work remains separately owned. Complete appearance/source/pool evidence, entitlement boundary, rights and cost/retention decisions gate affected real/premium integration.',verification='Auditor fully read Library PRDv1(178lines/26797bytes)/tasklistv0(85lines/16503bytes), verified initial installation text, then reviewed every local task-list delta and reread the changed ownership. Local derivative reports10focused tests/scoped TS-lint/10offline Chromium checks/PNG; these are unaccepted owner claims, then the frozen HANDOFF/EVIDENCE were read after explicit new delivery evidence. Images/logs remain metadata-only; no application code or preview executed by audit. Recorded static3125/PID is an owner declaration, not observed liveness.',acceptance_release_gate='Independent exact local review before integration. Preserve no-GP/TOI/position hidden pool filters, valid-zero/null distinction and rank suppression for unknown coverage. Product-dependent observed/premium behavior stays disabled/configurable until resolved. No new production reads/writes/refresh/backfill, shared auth/export/billing edits, dependency/spend, Git or deploy authority.',next_action='Existing Sol owner advances independent free-card/contracts/synthetic preview work under its exact lease and brings reviewable evidence to Scout. Parent resolves only remaining dependent product/asset/source/entitlement choices. Do not create a second card worker, duplicate WiGO repair, import schedule-specific snapshots as player data or infer card capability from RSO entitlement flags.',as_of=now,evidence_level='Reviewed requirements and owner preparation; implementation/review incomplete',evidence_scope='Bounded local player-card scope only. Schema/prototype fields, one-player diagnostic and synthetic preview are not live league coverage or public launch.',evidence_provenance='Trusted parent continuation authorization, Library versions and exact installed source documents, owner scope records.',dispatch_class='Authorized single-Sol bounded local implementation; parent integration/review remains separate',source_inputs=['TJ October24 task-generation/local-implementation approval','Library libfile_c30125d0825481919d792fe441de993c v1','Library libfile_9cedfb0ae3a081918e150b8b18613043 v0','SITE-WIGO','SITE-SOCIAL-SHARE','segment06 proposed alias SITE-PLAYER-CARDS-PRD'],evidence=[ev('tasks/TASKS/prd-shareable-player-cards.md',3,'Complete Libraryv1 text read; installed exact reviewed-text duplicate, no raw-transfer hash claim.'),ev('tasks/tasks-prd-shareable-player-cards.md',3,'Complete Libraryv0 base plus every current local delta read. Checkbox/test narrative is owner evidence, not implementation acceptance.'),ev(C+'INPUTS.json',1),ev(C+'REQUIREMENTS-AND-STEERS.md',5),ev(C+'slice-01/OWNERSHIP.json',1),ev(C+'slice-01/HANDOFF.md',1),ev(C+'slice-01/EVIDENCE.json',1),ev(steer,1,'Trusted parent authorization record only; not a worker dispatch by auditor.')])
for tid,c in changes.items():
    t=byid[tid];c['before_fields']={k:t.get(k) for k in c['fields']};t.setdefault('artifact_audit_segment07',[]).append(dict(at=now,before_fields=c['before_fields'],note='Documentary chronology overlay; existing scopes/evidence and narrower closures retained. No source/runtime work or new execution authority.'));t.update(c['fields']);t['as_of']=now
    existing={(e.get('path'),e.get('line'),e.get('sha256')) for e in t['evidence']};c['evidence']=[e for e in c['evidence'] if (e.get('path'),e.get('line'),e.get('sha256')) not in existing];t['evidence'].extend(c['evidence'])
new['tasks'].append(added)

labels={'implementation':'Implementation','acceptance':'Acceptance','release':'Release','owner':'Owner','reviewer':'Reviewer','dependencies':'Dependencies','verification':'Verification','acceptance_release_gate':'Acceptance/release gate','next_action':'Next','dispatch_class':'Dispatch class','evidence_level':'Evidence level','evidence_scope':'Evidence scope','source_inputs':'Source aliases','user_impact':'User impact'}
def block(text,tid):
    m=re.search(r'^### '+re.escape(tid)+r' —.*?(?=^### |^## |\Z)',text,re.M|re.S);assert m,tid;return m
def refs(evidence):return '; '.join(f'[{e["path"]}:{e["line"]}](</Users/tim/Code/fhfhockey.com/{e["path"]}:{e["line"]}>) SHA256 `{e["sha256"]}`' for e in evidence)
overlay=f'''## Dead-code chronology and current owner checkpoint — {now}

207 stable IDs preserve all206 prior IDs/scopes and all925 prior evidence entries. One distinct SITE-PLAYER-CARDS row records TJ-authorized single-Sol bounded local work, cross-linked to existing WiGO/social ownership; it is not another worker dispatch. PRDv1/tasklistv0 installation is verified; exact defaults/paywall/season policy and live-data/source/rights gates remain separate. Earlier no-task-generation wording is superseded only within this local authorization.

Dead-code/CLEAN full reads preserve closed removal cohorts, active hidden owners, historical sKO quarantine and narrower DRM natural/runtime closures. WGO-HISTORY keeps original date-label, completed88-row Utah and held376-row relocation cohorts separate. NEW127 maps to existing generated tracking; NEW86 maps to the existing DRM receipt gate without declaring an old failure current. WiGO's investigator has approved local code fixes after two SELECTs/68rows/no writes; audit reproduced retained source matching only, not a hosted call. Refresh/backfill and full-product acceptance remain held.

Exact coverage and exclusions are in [segment07](/Users/tim/Code/fhfhockey.com/tasks/artifacts/task-artifact-audit-continuation-2026-10-24/segment-07-dead-code-contracts/REPORT.md). The overall content audit is unfinished. No application source/test execution, new worker, Git, production/API/DB/cron/provider action by this audit.

'''
prepared=[]
for idx in [0,1]:
    text=raws[P[idx]].decode();text=re.sub(r'As of `[^`]+`',f'As of `{now}`',text,count=1)
    if idx==0:text=text.replace('**206 current ledger rows**','**207 current ledger rows**',1)
    cut=text.index('\n## ');text=text[:cut]+'\n\n'+overlay.rstrip()+'\n'+text[cut:]
    for tid,c in changes.items():
        m=block(text,tid);nb=m.group()
        for k,val in c['fields'].items():
            before=c['before_fields'][k];display=val if isinstance(val,str) else '; '.join(val)
            if isinstance(before,str) and before in nb:
                nb=nb.replace(before,display,1)
                if display.endswith('.'):nb=nb.replace(display+'.',display,1)
            else:nb=nb.rstrip()+f'\n- **Current {labels.get(k,k)}:** {display}\n\n'
            assert display in nb
        nb=nb.rstrip()+f'\n- **Segment07 reconciliation date:** `{now}`.\n- **Segment07 evidence:** '+refs(c['evidence'])+'.\n\n';text=text[:m.start()]+nb+text[m.end():]
    row='### '+newid+' — '+added['scope']+'\n\n'
    for k in ['owner','reviewer','user_impact','implementation','acceptance','release','dependencies','verification','acceptance_release_gate','next_action','evidence_level','evidence_scope','dispatch_class']:
        row+=f'- **{labels[k]}:** {added[k]}\n'
    row+=f'- **Status evidence date:** `{now}`.\n- **Pinned references:** '+refs(added['evidence'])+'.\n'
    text=text.rstrip()+'\n\n## October24 player-card local scope\n\n'+row
    prepared.append(text.rstrip()+'\n')
new['as_of']=now
new['artifact_audit_segment07_20261024']=dict(at=now,changed_ids=list(changes),added_ids=[newid],preserved_ids=206,baseline_evidence=925,coverage=str((B/'COVERAGE.json').relative_to(ROOT)),whole_tree_content_complete=False)
new['master_consolidation_plan'].update(after_sha256=sha(prepared[0].encode()),completed_at=now,task_rows_after=207,status='October24 segment07:207 IDs; preserved cleanup/quarantine chronology, WiGO local-fix boundaries and distinct authorized card scope. Whole-tree content audit incomplete.')
candidates={P[0]:prepared[0].encode(),P[1]:prepared[1].encode(),P[2]:(json.dumps(new,ensure_ascii=False,indent=2)+'\n').encode()}
for p,raw in candidates.items():(B/('CANDIDATE-'+Path(p).name)).write_bytes(raw)
ids=lambda d:[t['taskID'] for t in d['tasks']]
assert ids(new)[:-1]==ids(old) and len(set(ids(new)))==207
for a,b in zip(old['tasks'],new['tasks']):
    assert a['scope']==b['scope'] and b['evidence'][:len(a['evidence'])]==a['evidence']
    if a['taskID'] not in changes:assert a==b
legacy=[t['taskID'] for t in old['tasks'] if t['taskID'].startswith('MASTER-')];assert len(legacy)==32
for i in [0,1]:
    out=candidates[P[i]].decode();before=raws[P[i]].decode();assert collections.Counter(re.findall(r'^### (\S+) —',out,re.M))==collections.Counter(ids(new))
    for tid in legacy:assert block(before,tid).group()==block(out,tid).group(),(i,tid)
    for val in added.values():
        if isinstance(val,str) and val not in [added['taskID'],added['group'],added['user_impact'],added['evidence_provenance']]:
            assert val in out,newid
base189=json.loads((ROOT/'tasks/artifacts/task-artifact-reconciliation-2026-10-24/BASELINE-LEDGER.json').read_text());assert {t['taskID'] for t in base189['tasks']}<=set(ids(new))
validation=dict(at=now,before_ids=206,after_ids=207,added_ids=[newid],changed_ids=list(changes),before_evidence=sum(len(t['evidence']) for t in old['tasks']),after_evidence=sum(len(t['evidence']) for t in new['tasks']),all206_prior_scopes_preserved=True,all925_evidence_prefixes_preserved=True,handoff189_ids_preserved=True,legacy_blocks_byte_identical_each_markdown=32,unchanged_rows_identical=206-len(changes),canonical_before=start['canonical_before'],candidate_hashes={p:sha(raw) for p,raw in candidates.items()},application_operations=0,git_operations=0,production_operations=0,whole_tree_content_complete=False)
dump(B/'CHANGELOG.json',dict(at=now,changed=changes,added=[added]));dump(B/'SOURCE-PINS.json',pins);dump(B/'VALIDATION-PREPARED.json',validation)
(B/'CANONICAL-CHECKPOINT.patch').write_text(''.join(''.join(difflib.unified_diff(raws[p].decode().splitlines(True),candidates[p].decode().splitlines(True),fromfile='before/'+p,tofile='after/'+p)) for p in P))
if '--write' in sys.argv:
    assert all(sha((ROOT/p).read_bytes())==h for p,h in start['canonical_before'].items()),'Canonical advanced; no write'
    assert all(sha((ROOT/p).read_bytes())==h for p,h in pins.items()),'Evidence advanced; inspect first'
    for p,raw in candidates.items():(ROOT/p).write_bytes(raw)
    assert all((ROOT/p).read_bytes()==raw for p,raw in candidates.items())
    validation['canonical_written_and_read_back']=True;dump(B/'VALIDATION-CANONICAL.json',validation)
print(json.dumps(validation,indent=2))
