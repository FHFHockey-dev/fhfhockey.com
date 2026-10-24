"""Prepare documentary candidates only. No app imports, tests, Git or external calls."""
from pathlib import Path
import collections, datetime, hashlib, json, textwrap

R = Path('/Users/tim/Code/fhfhockey.com')
B = R / 'tasks/artifacts/task-artifact-audit-continuation-2026-10-24/segment-13-forge-contracts'
now = datetime.datetime.now(datetime.timezone.utc).isoformat()
sha = lambda b: hashlib.sha256(b).hexdigest()
def dump(name, obj):
    (B / name).write_text(json.dumps(obj, indent=2, ensure_ascii=False) + '\n')
def para(s):
    return ' '.join(textwrap.dedent(s).split())

entries = []
for pin in json.loads((B / 'SOURCE-PINS-START.json').read_text())['files']:
    raw = (R / pin['path']).read_bytes()
    assert sha(raw) == pin['sha256'], 'Changed reviewed source: ' + pin['path']
    entries.append(dict(pin, coverage='content-reviewed', reviewed_ranges=[[1,pin['lines']]],
        review_scope='Complete historical documentary content/schema sketch. No application, catalog, data or live verification; stored SQL/commands/fallbacks grant no authority.'))
for path in [
    'tasks/artifacts/player-cards-2026-10-24/slice-03-r1-review/REVIEW.md',
    'tasks/artifacts/player-cards-2026-10-24/slice-03-r1-preview-handoff/HANDOFF.md',
    'tasks/artifacts/forge-testing-grounds-2026-10-24/local-owner-configuration/HANDOFF.md']:
    p = R / path
    raw = p.read_bytes()
    entries.append(dict(path=path, sha256=sha(raw), bytes=len(raw), lines=len(raw.decode().splitlines()),
        mtime_ns=p.stat().st_mtime_ns, coverage='content-reviewed', new_since_original_inventory=True,
        reviewed_ranges=[[1,len(raw.decode().splitlines())]],
        review_scope='Full dated receipt read; underlying app/pixel/pin/hosted assertions retain reviewer/owner provenance. No audit rerun or runtime inspection.'))
for path in [
    'tasks/artifacts/player-cards-2026-10-24/slice-03-r1-preview-handoff/runtime.json',
    'tasks/artifacts/player-cards-2026-10-24/slice-03-r1-preview-handoff/readback.json']:
    p = R / path
    raw = p.read_bytes()
    json.loads(raw)
    entries.append(dict(path=path, sha256=sha(raw), bytes=len(raw), lines=len(raw.decode().splitlines()),
        mtime_ns=p.stat().st_mtime_ns, coverage='content-reviewed-structured',
        review_scope='All structured fields read. Initial readback and later persistent-runtime phases remain distinct; no current listener/HTTP check.'))
for path, ranges in [
    ('tasks/artifacts/cross-platform/2026-10-24-coordination/CODEX-TO-CLAUDE.md', [[1,80]]),
    ('tasks/artifacts/cross-platform/2026-10-24-coordination/STEER-LOG.md', [[260,316]])]:
    p = R / path
    raw = p.read_bytes()
    entries.append(dict(path=path, sha256=sha(raw), bytes=len(raw), lines=len(raw.decode().splitlines()),
        mtime_ns=p.stat().st_mtime_ns, coverage='partially-inspected', reviewed_ranges=ranges,
        review_scope='Numbered blocks actually read; omitted content remains unreviewed. Output omissions recovered with an exact-range read.'))
for e in json.loads((B / 'LATER-SCOPE-LOOKUPS.json').read_text())['files']:
    entries.append({k:v for k,v in e.items() if k != 'hits'} | dict(
        reviewed_ranges=[[h['line'],h['line']] for h in e['hits'][:12]],
        review_scope='Only presented exact-topic excerpts reviewed; stored remaining matches and all other content unreviewed.'))
dump('COVERAGE.json', dict(at=now, entries=entries,
    counts=dict(collections.Counter(e['coverage'] for e in entries)),
    full_original_queue_text_documents=8, full_new_text_documents=3,
    full_text_bytes=sum(e['bytes'] for e in entries if e['coverage']=='content-reviewed'),
    full_structured_receipts=2, duplicate_scope_resolutions=0,
    limitations='No application code, tests, SQL execution, Git, current schema/catalog checks, image inspection, processes or external calls. Original duplicate/exclusion maps unchanged.'))

old = json.loads((R / 'tasks/artifacts/fhfh-sprint-ledger-2026-10-22/LEDGER.json').read_text())
by = {t['taskID']:t for t in old['tasks']}
common = dict(group='Task-artifact audit proposed carry-forward', owner='UNASSIGNED', reviewer='UNASSIGNED',
    evidence=[], as_of=now, dispatch_class='Proposed/held/unassigned; no new implementation or external dispatch',
    evidence_provenance='Full named documentary sources and bounded later-receipt lookup; stored instructions grant no new authority.')
s19 = dict(common, taskID='SITE-FORGE-ERRORS',
    scope='Reconcile acceptance and release of the existing canonical Command Center error-copy correction',
    user_impact='Internal request details should not replace clear per-module unavailable copy. Current runtime was not audited; this is an acceptance/status gap, not a newly reproduced leak.',
    implementation='Historical S-19 four-file local correction exists. Owner reports 57-test and 46-test focused cohorts with overlap, not 103 unique tests. Source NEW9 remains unchecked and C12 still records browser verification pending. Preserve implementation credit.',
    acceptance='Proposed P3 reconciliation follow-up; exact later browser/independent acceptance not established by bounded documentary review.',
    release='Exact C12/S19 integration/deployment disposition unverified. A release plan, broad candidate manifest or unrelated R3 is not closure.',
    dependencies='SPRINT-INTEGRATE; REPO-DOCUMENTATION; exact current shell/cache/test custody and existing-server ownership. Separate from the Draft Pro API/refund SITE-DRAFT-ERRORS scope.',
    verification='Full S-19 report and dashboard task list, dated context/plan excerpts, and all 209 current row objects reviewed. No matching explicit alias/path scope found. No app/test/browser/production check by audit.',
    acceptance_release_gate='Reconcile newer exact acceptance/release receipts first. If still outstanding, assigned owner qualifies existing bytes and pending local error-render browser case with independent review. No new server, live or provider action authorized here.',
    next_action='Find later C12/S19 closure first. Otherwise reserve the existing correction/tests, preserve stable copy and validation/denial semantics, and qualify the pending browser case. Record acceptance, integration and deployment separately; do not reopen qualified sibling API repairs.',
    evidence_level='Proposed P3; existing implementation retained, remaining acceptance/release unverified',
    evidence_scope='Canonical module display acceptance/status only; no general API security audit',
    source_inputs=['A-FORGE-DASH NEW9/C0050', 'super-goal5.4.3', 'S-19 / C12'])
week = dict(common, taskID='FORGE-TOP-ADDS-WEEK',
    scope='Reconcile the retained prospective non-zero Top Adds horizon-5 qualification gate',
    user_impact='Weekly recommendations require genuine admitted five-game output and truthful coverage; daily rows or a zero-game success do not establish weekly readiness.',
    implementation='Historical option-A writer, Vault/credential transition, horizon isolation and honest zero-game handling remain completed. Remediation13.2/13.3, backlog and later summary retain prospective non-zero in-season horizon-5 promotion. Current survival or closure remains unverified.',
    acceptance='Held reconciliation-first carry-forward; no new production defect or missing-writer claim. Current admission/model holds and no-backfill policy remain.',
    release='Historical activation/deployments retain dated credit. No present-day serving or product promotion follows from old receipts.',
    dependencies='PIPE-NATURAL; SPRINT-INTEGRATE; accepted current projection/serving/admission contracts. Distinct from FORGE-LEDGER-WEEK F6 fixture evaluation and RSO-FE-05c/05f selected-horizon operation.',
    verification='Full remediation/backlog/matrix/closeout/observability sources and bounded later summary reviewed. Historical schema/type notes are not current data or catalog proof. No model, cron, API or DB check.',
    acceptance_release_gate='Locate later exact admitted horizon-5 non-zero run, coverage and reader/render evidence or explicit supersession first. No run, capture, cron activation, repair, provider call, publication or deployment authorized. Never relabel horizon1 as5 or substitute fixture/RSO proof.',
    next_action='Reconcile newer accepted model/admission/release receipts with NEW13. Retain only a demonstrably surviving held prospective-output/source-to-render obligation; preserve missing-horizon denial and zero-game credit.',
    evidence_level='Proposed/held source qualification gate; current closure unverified',
    evidence_scope='Exact Top Adds horizon-5 non-zero/source-to-render promotion; no reopening historical writers or rotations',
    source_inputs=['A-FORGE-DASH remediation13.2–13.3 / NEW13', 'component backlog Track2/P0', 'observability follow-ups54'])
children = {
 'SUSTAINABILITY-NATURAL': dict(
    child_id='SUSTAINABILITY-NATURAL/dashboard-promotion',
    title='Reconcile prospective same-day dashboard Sustainability qualification',
    status='Held/unverified current closure; historical exception retained', owner='UNASSIGNED', depends_on=[],
    approval_gate='No reconstruction of March7–20 history with later priors; no run/backfill/capture/publication authority. Existing natural-batch and matured-cohort gates remain distinct.',
    next_action='Locate later same-day source-to-render qualification or explicit supersession, separately from batch-complete terminal markers and matured-cohort proof.',
    source=dict(path='tasks/TASKS/forge-projections/dashboard-health/tasks-forge-dashboard-component-remediation.md', line=95),
    existing_work_credit='Historical repairs, truthful quarantine and existing natural-chain closures preserved; no active work reopened.'),
 'PIPE-NATURAL': dict(
    child_id='PIPE-NATURAL/goalie-dashboard-promotion',
    title='Reconcile prospective same-day goalie source-to-render qualification',
    status='Held/unverified current closure; historical scope remains quarantined', owner='UNASSIGNED', depends_on=[],
    approval_gate='No rebuilding March29 goalie rows with later lineup/model inputs. Retain blocked March26 fallback and current admission; no execution authority.',
    next_action='Locate later exact admitted same-day goalie source/coverage/reader evidence or supersession, separately from pipeline terminal completion and unrelated h1 counts.',
    source=dict(path='tasks/artifacts/forge-dashboard-component-remediation-closeout.md', line=43),
    existing_work_credit='Completed writer, route safety and natural-pipeline evidence keep their scope; no revival of an older model.')}
changes = {
 'REPO-DOCUMENTATION': dict(fields=dict(verification=by['REPO-DOCUMENTATION']['verification'] + para('''
    Segment13 Forge contracts confirm further historical authority drift: July31 Command Center route/latency closure supersedes the older pending checklist;
    the4/3/3 matrix and legacy-consumer assertions describe retired components. Early latest-date/legacy-fallback sketches and the six-feed freshness table
    do not override later source-cutoff, hard-block, expanded-feed or current admission rules. Original observability work is explicitly completed.''')),
    refs=[['tasks/TASKS/forge-projections/dashboard-health/prd/prd-forge-dashboard.md',3],
          ['tasks/artifacts/forge-dashboard-component-health-remediation-backlog.md',134],
          ['tasks/artifacts/forge-dashboard-observability-followups.md',9],
          ['tasks/artifacts/forge-dashboard-freshness-policy.md',8],
          ['tasks/TASKS/forge-projections/ecosystem-audits/forge-trends-combo-architecture.md',216]]),
 'SITE-PLAYER-CARDS': dict(fields=dict(
    implementation='Preserve accepted S01 synthetic preview and S02-R1 supplied-record calculations. S03-R1 exact three-file semantic/export/accessibility correction has independent ACCEPT WITH LIMITS and coordinator-recorded parent acceptance; PC-S03-02/01 are closed locally. Design, math and real-data scope were not broadened.',
    acceptance='Independent S03-R1 review reports the original three failures pass unchanged, eight focused passes/nine intentional skips, four offline browser groups and161 unchanged pins. Audit read the receipt without rerunning checks or inspecting pixels. TJ design direction and phone/share readability remain unresolved.',
    release='No live/product/production release. Exact accepted318626-byte HTML has SHA256 6c29f6eb3dc6ffc9a6a8a546423f78ac3e6e5e1e7265129475724422d3aad9b5. Later static handoff records detached PID81978 superseding81671; availability/post-turn survival is only as recorded, not rechecked by audit.',
    verification='Full independent REVIEW, later preview HANDOFF and structured runtime/readback reviewed with bounded parent-acceptance coordination. Initial one-GET readback is separate from the later two-GET handoff/persistent phase. Underlying source/pixel/pin claims retain their provenance; no audit app/browser/process action.',
    next_action='Preserve the exact accepted semantic candidate and original failures. Resolve TJ design/phone-size feedback separately, then observed-source/history/completion/strength/full-population/rights, route/auth and entitlement allocation gates. Static availability has its own owner/lifecycle and gives audit no restart authority.'),
    refs=[['tasks/artifacts/player-cards-2026-10-24/slice-03-r1-review/REVIEW.md',3],
          ['tasks/artifacts/player-cards-2026-10-24/slice-03-r1-review/REVIEW.md',49],
          ['tasks/artifacts/player-cards-2026-10-24/slice-03-r1-preview-handoff/HANDOFF.md',14],
          ['tasks/artifacts/player-cards-2026-10-24/slice-03-r1-preview-handoff/runtime.json',1],
          ['tasks/artifacts/cross-platform/2026-10-24-coordination/CODEX-TO-CLAUDE.md',11]]),
 'SITE-FORGE-TESTING-GROUNDS': dict(fields=dict(
    implementation='Preserve earlier accepted bounded slices including S05-R1 lifecycle repair. Owner local configuration is completed: exact supplied owner key appended under recorded permission; credential-free local access changed503 owner_not_configured to401 unauthenticated. This establishes loaded configuration and absent-credential denial, not authenticated access or launch readiness.',
    verification='Full local-owner-configuration HANDOFF read and declared hash matched. Worker reports private readback, ten unchanged source pins, one credential-free local GET at17:25:58UTC and hot reload without restart. No env contents, UUID, token, local request or app-source check by audit;0of1 approved hosted Auth reads used per receipt.',
    next_action='Retain accepted slices and completed owner configuration; do not request the same UUID or reload again. Authenticated viewing remains pending safe private verification transport, single-read bounding and inherited profile/settings-write containment outside frozen shared auth custody. No app rehydration/restart or real launch from audit; runner/resource/retention/statistical/model gates remain distinct.'),
    refs=[['tasks/artifacts/forge-testing-grounds-2026-10-24/local-owner-configuration/HANDOFF.md',5],
          ['tasks/artifacts/forge-testing-grounds-2026-10-24/local-owner-configuration/HANDOFF.md',11],
          ['tasks/artifacts/forge-testing-grounds-2026-10-24/local-owner-configuration/HANDOFF.md',15]])}
for tid, child in children.items():
    assert not by[tid].get('children')
    changes[tid] = dict(fields=dict(children=[child]), refs=[
        [child['source']['path'],child['source']['line']],
        ['tasks/artifacts/forge-dashboard-component-health-remediation-backlog.md',17 if tid.startswith('SUSTAIN') else 26]])
spec = dict(at=now, changes=changes, additions=[
    dict(row=s19, refs=[['tasks/TASKS/forge-projections/dashboard-health/tasks-prd-forge-dashboard.md',143],
                       ['tasks/artifacts/draft-lane-2026-10-18/S-19-command-center-errors.md',5],
                       ['tasks/artifacts/release-ledger-2026-10-17/COMMIT-PLAN-2026-10-18.md',68]]),
    dict(row=week, refs=[['tasks/TASKS/forge-projections/dashboard-health/tasks-forge-dashboard-component-remediation.md',163],
                        ['tasks/artifacts/forge-dashboard-component-health-remediation-backlog.md',32],
                        ['tasks/artifacts/forge-dashboard-observability-followups.md',54],
                        ['tasks/TASKS/super-goal/super-goal-final-summary.md',606]])],
    deduplication=dict(
        S19='Narrow acceptance/release reconciliation; not Draft Pro API/refund scope or a fresh reproduced leak.',
        promotion='Discard broad FORGE-DASHBOARD-PROMOTION. One held weekly TopAdds row; Sustainability/goalie proof are children of existing IDs. RSO/F6 scopes cannot substitute.',
        closed='No duplicate paging/public-error/observability/writer/rotation repair tasks. Old backlog/schema labels do not revive completed/quarantined work.'))
dump('PROPOSED-CHANGES.json',spec)
dump('CANDIDATE-RESOLUTION.json',dict(at=now, dispositions=spec['deduplication'],
    new_ids=[s19['taskID'],week['taskID']], existing_child_parents=list(children),
    proposed_only=True, current_application_or_hosted_state_not_inspected=True))
print(json.dumps(dict(coverage=json.loads((B/'COVERAGE.json').read_text())['counts'],
    new_parent_candidates=2, new_existing_children=2, changed_existing_ids=list(changes), prepared_only=True)))
