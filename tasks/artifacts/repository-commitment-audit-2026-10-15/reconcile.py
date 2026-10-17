"""Assemble audit-only crosswalks from the retained, bounded source inventory."""
from pathlib import Path
from collections import Counter, defaultdict
from datetime import datetime, timezone
import hashlib
import json
import re
import subprocess

ROOT = Path('/Users/tim/Code/fhfhockey.com')
OUT = Path(__file__).resolve().parent
PRIOR = Path('/tmp/fhfh-repo-audit-20261013')

def read(name):
    return json.loads((OUT/name).read_text())

def write(name, value):
    (OUT/name).write_text(json.dumps(value, indent=2, ensure_ascii=False)+'\n')

def git(*args):
    result = subprocess.run(['git', *args], cwd=ROOT, capture_output=True, text=True)
    return result.stdout.strip() if result.returncode == 0 else None

inventory = read('inventory.json')
files = {r['path']:r for r in inventory}
checks = read('checklists.json')
prior = json.loads((PRIOR/'item-adjudication.json').read_text())
index = json.loads((PRIOR/'master-scope-index.json').read_text())
write('master-scope-index.json', index)
now = datetime.now(timezone.utc).isoformat()
master_now = read('master-page-sequence-42.json')['metadata']

prior_rows = []
current_by_text = {(r['path'],r['text']):r for r in checks}
for old in prior['items']:
    current = current_by_text.get((old['path'],old['text']))
    f = files.get(old['path'], {})
    prior_rows.append({
        'prior_row_key':old['row_key'], 'path':old['path'],
        'current_line':current['line'] if current else None,
        'task_id':old.get('task_id'), 'text':old['text'],
        'current_checked':current.get('checked') if current else None,
        'identical_row_text':current is not None,
        'current_source_sha256':f.get('sha256'),
        'whole_source_hash_matches_prior':f.get('prior_same_hash'),
        'disposition':old['disposition'], 'finding_id':old.get('finding_id'),
        'duplicate_group':old.get('duplicate_group'),
        'master_matches':old.get('master_matches',[]),
        'remaining_scope':old.get('actual_unfinished_scope',old.get('reason')),
        'verification':'Retained item-level adjudication + fresh row/source comparison; no new runtime acceptance.',
        'current_master_sequence':master_now['current_sequence'],
        'current_master_overlay':'LIVE-MASTER-DELTA.md and master-page-sequence-42.json take precedence over historical MS41 scope wording.',
        'delta_note':('Current RSO 30/31 local acceptance does not close provider/account/forecast gates.'
                      if 'rso-consolidated' in old['path'] else
                      'New OCT14-COMP/F00-F22 mapping is additional owned research scope; it closes none of these historical rows.'
                      if '/forge-projections/' in old['path'] else None),
    })
assert len(prior_rows)==423 and all(r['identical_row_text'] and not r['current_checked'] for r in prior_rows)
write('prior-423-reconciliation.json', prior_rows)

amendment = {}
projection_source = ROOT/'tasks/TASKS/forge-projections/v1/tasks-prd-projection-model.md'
for line_no,line in enumerate(projection_source.read_text().splitlines(),1):
    m = re.match(r'\| (F\d\d) [—–-].*?\| (.*?) \| (.*?) \|$',line)
    if m:
        amendment[m[1]]={'canonical_path':str(projection_source.relative_to(ROOT)),
                          'canonical_line':line_no,'owning_tasks':m[2],
                          'current_disposition':m[3].split('**',2)[1] if '**' in m[3] else m[3]}
assert len(amendment)==23
write('forge-amendment-crosswalk.json',amendment)

unchecked=[]
new=[]
for r in checks:
    if r['checked']:continue
    row={k:r[k] for k in ['path','line','heading','text']}
    if r['prior_adjudication']:
        row.update({'classification':'prior_eligible_reconciled','authority':r['prior_adjudication']})
    elif '/archive/' in r['path']:
        row.update({'classification':'historical_archive','authority':'Explicit archive; retain as history, not an active obligation.'})
    elif r['text'].startswith('`SRC::'):
        row.update({'classification':'source_alias','authority':'Super-goal mirror; use canonical source row and prior 423 crosswalk.'})
    elif r['path'].endswith('.mdc') or r['path']=='docs/repository-audit/generate-audit-tasks-prompt.md':
        row.update({'classification':'template','authority':'Task-generation/process example, not a product commitment.'})
    elif '/forge-research-amendment-' in r['path']:
        fid=re.search(r'F\d\d',r['text']).group(0)
        row.update({'classification':'new_amendment_input_alias','amendment_id':fid,
                    'authority':amendment[fid], 'master_relation':'Section 1, MS41-001–015; retain OCT14-COMP as owning ledger.'})
        new.append(row)
    elif r['path'].endswith('/v1/tasks-prd-projection-model.md'):
        row.update({'classification':'new_owned_forge_canonical_row',
                    'authority':'OCT14-COMP-0 parent and -1 through -9 children; existing FORGE owner.',
                    'master_relation':'Section 1 broad FORGE research/evaluation/horizon scope; granular amendment postdates sequence 41 and is not expanded into a second backlog by sequence 42.'})
        new.append(row)
    elif r['path'].endswith('/prediction-engine/tasks-prd-forge-prediction-engine-super-task-list.md'):
        row.update({'classification':'new_forge_parent_pointer',
                    'authority':'Pointer to OCT14-COMP in V1; no second implementation assignment.',
                    'master_relation':'Same Section 1 FORGE owner.'})
        new.append(row)
    elif '/rso-release-readiness-' in r['path']:
        row.update({'classification':'new_rso_release_gate_copy',
                    'authority':'Canonical RSO tasks 2–7/9–11, acceptance A1–A11 and repository release rules.',
                    'master_relation':'MS41-019–025 and MS41-085; do not reopen local 30/31 acceptance.'})
        new.append(row)
    else:
        row.update({'classification':'unresolved_new_row','authority':'Requires explicit reconciliation before delivery.'})
    unchecked.append(row)
counts=Counter(r['classification'] for r in unchecked)
assert counts==Counter({'prior_eligible_reconciled':423,'historical_archive':226,'source_alias':55,'template':7,
                       'new_amendment_input_alias':42,'new_owned_forge_canonical_row':10,'new_forge_parent_pointer':1,'new_rso_release_gate_copy':7}),counts
write('unchecked-adjudication.json',unchecked)
write('new-60-reconciliation.json',new)

fresh_notes={
 'ADD-01':'Retain historical owner-held provider-key retirement boundary. This audit makes no current exposure claim and performs no provider/credential probe.',
 'ADD-02':'Unchecked umbrella is unchanged; later Yahoo/FHFH closures must be subtracted. Reconcile named-system status without values or blanket rotation.',
 'ADD-03':'Owner mailbox/system mapping still required by unchanged source. No mailbox/secret access.',
 'ADD-04':'Only rankings-e2e.yml is present in .github/workflows. The specific bounded advisory job remains absent; existing successful release CI is not this requested job.',
 'MISS-WIGO-DATA':'Same source rows and whole-file hash; preserve source/window/unit acceptance. No production data qualification inferred.',
 'MISS-WIGO-RATINGS':'Same source rows and whole-file hash. Fresh PlayerStats radar findings are a distinct component/route and must not reopen the completed query-contract correction.',
 'MISS-WIGO-PERF':'Same source rows and whole-file hash; measured local performance remains after correctness. No new benchmark or production load.',
 'MISS-UNDERLYING-MOCKUP':'Same explicit delivery rows and source hash; no newer receipt found in the inspected task/artifact inventory.',
 'BLOCK-UNDERLYING-VERIFICATION':'Prior inventory records the landing page and test tracked-clean at the same HEAD, and both remain HEAD-identical now (source-to-git-master.json). No prior task-candidate SHA was retained for those two files. No new candidate-bound test/browser receipt established by this audit.',
 'MISS-FE-COHERENT-REFRESH':'Fresh symbol search finds captured/native baseline bundle helpers called only within baselineGeneration.ts and contributions.test.ts. Added native guard code does not supply the FE-06b operational caller. Refresh/cache scope remains.',
 'MISS-ALIAS-EMAIL':'Alias UI/API work and restored IFTTT wrappers are concurrent local changes. They do not provide the explicit production signed-email send/receipt gate. No send performed.',
 'MISS-DRM-NATURAL':'Same source rows and hashes. Preserve completed implementation and separate natural cursor/writer/backfill receipts; no job/recompute invoked.',
 'MISS-YAHOO-HISTORY':'Same source rows and hashes; current RSO waiver-date fix is unrelated to older league-equivalence/backfill/legacy-owner acceptance.',
 'MISS-CTPI-ACTIVATION':'Same held owner/schema/trace rows. No activation, migration, publication or broad historical repair.',
 'REFINE-SUST-MATURED':'Same rows; harness completion is not matured predictive evidence. No evaluation/outcome artifact opened.',
 'MISS-PARLAY-PROPS':'Same rows and hashes; player identity/provider source gate remains separate from GameGrid O/U. No provider call.',
 'REFINE-GOOGLE-PKCE':'Same exact Google account-completion dependency. No login/credential/compatibility removal.',
 'MISS-CRON-FOUR-AUDITS':'Same four-route natural-correlation requirement. Current NST code changes and old report delivery do not certify these four receipts.',
 'HOLD-DOC-11':'Working-set index still explicitly defers the eleven named Keep versus Archive/Merge owner decisions. Safe frozen ledgers remain unchanged; no documents retired.',
}
findings=[]
for fid,v in prior['findings'].items():
    refs=[]
    for e in v.get('evidence',[]):
        path=e.get('path'); f=files.get(path,{})
        refs.append({'path':path,'line':e.get('line',e.get('start_line')),'end_line':e.get('end_line'),
                     'current_sha256':f.get('sha256'),'whole_source_hash_matches_prior':f.get('prior_same_hash')})
    findings.append({'id':fid,'title':v['title'],'priority':v['priority'],
                     'classification':v['disposition'],'master_ids':v.get('nearest_master_ids',[]),
                     'recommended_wording':v.get('suggested_wording'),'source_refs':refs,
                     'fresh_verification':fresh_notes[fid],
                     'state':'Sequence 42 acknowledges the prior 19 as refinements/blockers. Retain granular source scope once; not newly discovered or closed by this audit.',
                     'current_master_sequence':master_now['current_sequence']})
assert len(findings)==19
write('prior-19-reconciliation.json',findings)

proof_paths=[
 'web/components/PlayerStats/PlayerRadarChart.tsx','web/components/PlayerStats/PlayerRadarChart.test.tsx',
 'web/pages/stats/player/[playerId].tsx','web/components/GameStateAnalysis/GameStateAnalysis.tsx',
 'web/components/TeamTabNavigation/TeamTabNavigation.tsx','web/pages/stats/team/[teamAbbreviation].tsx',
 'web/prep-chef/home.md','web/components/TeamStandingsChart/TeamStandingsChart.module.scss',
 'web/components/TeamStandingsChart/TeamStandingsChart.tsx','web/pages/index.tsx',
 'tasks/TASKS/repository-audit-remediation/tasks-repository-audit-remediation.md',
 'tasks/TASKS/repository-audit-remediation/security-rpc-rollout-runbook.md',
 'tasks/draft-dashboard-youtube-outline.md','tasks/draft-pro/LEDGER.md',
 'tasks/TASKS/wigo-charts/tasks-prd-wigo-charts-optimization.md',
 'web/pages/api/v1/db/shift-charts.ts','web/pages/api/v1/projections.ts',
 'web/lib/player-forecasts/baselineGeneration.ts',
 'web/pages/underlying-stats/index.tsx','web/__tests__/pages/underlying-stats/index.test.tsx',
 '.github/workflows/rankings-e2e.yml',
]
proof=[]
for path in proof_paths:
    if not (ROOT/path).exists():
        proof.append({'path':path,'missing':True});continue
    wt=git('hash-object',path); head=git('rev-parse',f'HEAD:{path}'); master=git('rev-parse',f'master:{path}')
    proof.append({'path':path,'sha256':hashlib.sha256((ROOT/path).read_bytes()).hexdigest(),
                  'worktree_blob':wt,'head_blob':head,'master_blob':master,
                  'matches_local_master':bool(master and wt==master),
                  'matches_HEAD':bool(head and wt==head)})
write('source-to-git-master.json',{'observed_at':now,'head':git('rev-parse','HEAD'),'master':git('rev-parse','master'),
      'limit':'Local Git refs; no fetch, deployment query or runtime verification.','files':proof})
write('radar-arithmetic-demonstration.json',{
 'source':'web/components/PlayerStats/PlayerRadarChart.tsx:428-440',
 'method':'Direct arithmetic reproduction of inspected formula; does not execute application/component/tests.',
 'cohort':[2,3,4], 'lower_is_better':True,
 'rows':[{'value':v,'current_rank':sum(x<v for x in [2,3,4])+1,
          'current_favorable_percentile':round(sum(x<v for x in [2,3,4])/3*100),
          'strict_worse_share_for_comparison':round(sum(x>v for x in [2,3,4])/3*100)} for v in [2,3,4]],
 'conclusion':'Best and worst favorable direction are reversed; exact tie convention is a separate existing policy choice.'})

summary={'generated_at':now,'current_master_sequence':master_now['current_sequence'],'master_rechecked_at':'2026-10-15T05:40:00Z','unchecked_classes':counts,'prior_rows':len(prior_rows),'prior_findings':len(findings),
         'new_rows':len(new),'canonical_forge_parent_and_children':10,'amendment_input_aliases':42,
         'report_only':True,'application_tests_run':0,'application_or_provider_requests':0,
         'deployments_triggered':0,'builds_triggered':0,'pushes':0,'protected_raw_evidence_read':False,
         'source_proof_missing':[r['path'] for r in proof if r.get('missing')]}
write('reconciliation-summary.json',summary)
print(json.dumps(summary,indent=2))
