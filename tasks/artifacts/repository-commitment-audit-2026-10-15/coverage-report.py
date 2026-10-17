"""Render coverage and per-marker dispositions; no repository mutations outside OUT."""
from pathlib import Path
from collections import Counter, defaultdict
import json

OUT=Path(__file__).resolve().parent
def read(n):return json.loads((OUT/n).read_text())
def write(n,x):(OUT/n).write_text(json.dumps(x,indent=2,ensure_ascii=False)+'\n')
files=read('inventory.json'); coverage=read('coverage.json'); markers=read('markers.json')

marker_rows=[]
for r in markers:
    p,t=r['path'],r['text']
    classification=authority=None
    if p=='tasks/draft-dashboard-youtube-outline.md':
        classification,authority='stale_editorial_status','FRESH-06; Draft Pro ledger W07–W10.'
    elif '/fixture-entry.tsx' in p or p.endswith(('.test.ts','.test.tsx','.test.js')) or p=='supabase/tests/goalie_team_resolution.sql' or p=='functions/tests/test_sko_pipeline.py':
        classification,authority='test_fixture_or_assertion','Synthetic identifiers/expected unavailable behavior; GameGrid legacy expected-value comments are not independent requirements.'
    elif p=='tasks/artifacts/goalie-stats-filter-semantics-audit.md':
        classification,authority='explicitly_historical','Opening historical-scope notice points to canonical goalie completion/runbook.'
    elif p in ['tasks/rso-goal-handoff.md','tasks/tasks-prd-roster-schedule-optimizer.md']:
        classification,authority='existing_owned_remainder','RSO consolidated tasks and MISS-FE-COHERENT-REFRESH; no duplicate scope.'
    elif p=='tasks/tasks-README.md':
        classification,authority='dated_completion_note','Opponent-schedule correction recorded locally; preserve distinct real-data acceptance.'
    elif p.startswith('tasks/artifacts/'):
        classification,authority='retained_evidence','Dated artifact description; no fresh task authority from marker.'
    elif p.endswith('goalie-confirmation-context-snapshot-2026-10-06.md'):
        classification,authority='existing_owned_remainder','RSO goalie/provider contract; no new start/minimum inference.'
    elif p.endswith('yahoo-current-inventory.md') or p.endswith('populate_yahoo_nhl_mapping.py'):
        classification,authority='filename_reference','Name-mapping TODO artifact is a reviewed input, not permission to write mappings or invoke providers.'
    elif p.endswith('prd-draft-dash-debug.md'):
        classification,authority='historical_or_explicitly_optional','Reconciliation table at 558–566 and completed NEW 8.1 distinguish optional measured optimizations from old dialogue.'
    elif p.endswith('prd-projection-model.md'):
        classification,authority='existing_owned_research','OCT14-COMP and F15 distribution/uncertainty gate; no model execution authority.'
    elif p.endswith('prd-forge-trends-combo-project.md'):
        classification,authority='historical_design_proposal','FORGE command-center/dashboard owning plans supersede a new route name invented from TBD.'
    elif p.endswith('prd-forge-ecosystem-pass-3-stabilization-quarantine-dashboard.md'):
        classification,authority='superseded_legacy_route','Operational route decision matrix retains update-power-rankings as inert 410; no replacement inferred.'
    elif '/super-goal/' in p:
        classification,authority='canonical_source_mirror','Super-goal source mirrors/history; retain owning task and its actual acceptance limit.'
    elif '/sko-charts/' in p:
        classification,authority='explicit_historical_only','SKO ownership contract rejects an automatic v2 pipeline restart.'
    elif p.endswith('tasks-prd-sustainability-barometer.md') or p.endswith('functions/lib/sustainability/config_loader.py'):
        classification,authority='explicit_offline_boundary','Task 5.10/runbook documents Python offline-only and unimplemented persistence; no new production writer.'
    elif p.endswith('dr-010-migration-review.md'):
        classification,authority='negated_implementation_claim','Merge history is deliberately nondestructive; not an unfinished delete.'
    elif '/contextual-hockey-rankings/' in p:
        classification,authority='planned_or_explicit_unavailable','MS41-088 paused Rankings/model scope; task 57.8/8.4 and workstation policy retain honest planned states.'
    elif p=='tasks/draft-pro/LEDGER.md':
        classification,authority='historical_diary_state','Later accepted W01–W12 local completion supersedes the 60% intermediate entry.'
    elif p.startswith('tasks/') and 'Owner: TBD' in t:
        classification,authority='owner_placeholder','Canonical project/master ownership controls; an old PRD owner placeholder is not implementation authorization.'
    elif p=='web/components/PlayerStats/PlayerRadarChart.tsx':
        classification,authority='fresh_verified_component_gap','FRESH-01/02/03; current DB queries exist, but inverse direction, scope coherence and partial fallback need bounded acceptance.'
    elif p=='web/components/GameStateAnalysis/GameStateAnalysis.tsx':
        classification,authority='owner_decision','FRESH-07; reachable comparison placeholder, no exact approved feature scope found.'
    elif p in ['web/components/LinemateMatrix/index.tsx','web/components/DateRangeMatrix/index.tsx','web/components/TimeOnIceChart/TimeOnIceChart.tsx','web/lib/getTimes.ts']:
        classification,authority='unsupported_input_guard','Default branch/error for unsupported mode or time option; not evidence a named supported mode is missing.'
    elif p=='web/hooks/usePlayerStats.ts':
        classification,authority='unused_legacy_hook','No literal source caller found; current player page uses its SSR path. Do not build a table from this comment.'
    elif p=='web/hooks/useTeamSchedule.ts':
        classification,authority='unused_presentation_field','Venue is assigned TBD; no venue consumer found in the inspected TeamDashboard/TeamScheduleCalendar paths.'
    elif p=='web/pages/api/v1/projections.ts':
        classification,authority='legacy_scaffold_disposition','Start Chart task 5.1/5.3/5.5 names canonical /api/v1/start-chart; no literal old caller found. Retire/retain decision, not second engine.'
    elif p=='web/pages/api/v1/rankings.ts':
        classification,authority='deprecated_compatibility','Route explicitly advertises deprecation/successor; no fresh model-wiring task.'
    elif p=='web/pages/api/v1/db/shift-charts.ts':
        classification,authority='already_implemented_comment','All named fields written at 809–811.'
    elif p=='web/pages/api/v1/db/cron/update-stats-cron.ts':
        classification,authority='obsolete_fanout_comment','Disabled processGameIDs comment precedes active bounded stats work; do not reactivate it.'
    elif p=='docs/player-projections/project-data-availability.md':
        classification,authority='prior_stale_doc_correction','Prior RETIREMENT-CORRECTION-01 already identifies current SKO handler/rewrite; not a new missing handler.'
    elif p=='functions/api/index.py':
        classification,authority='intentional_501_boundary','SKO historical-only stage execution explicitly unimplemented; authenticated honest 501 is the accepted disposition.'
    elif p.startswith('web/') and ('TBD' in t or 'XXX' in t):
        classification,authority='honest_unavailable_display','Unknown time/date/team/player placeholder; no feature task inferred.'
    if classification is None:
        raise AssertionError(f'Unreviewed marker: {p}:{r["line"]}')
    marker_rows.append({**r,'classification':classification,'authority':authority})
assert len(marker_rows)==100
write('marker-adjudication.json',marker_rows)

families={
 'auth-user-settings-platform':('MS41-074/075','ADD-02/03, Google PKCE and owner system mapping; preserve completed auth children.'),
 'contextual-hockey-rankings':('MS41-088','Completed implementation lists plus explicit unavailable/planned model/data heads; broader research remains paused.'),
 'cron-operations':('MS41-043–056','Natural run/output/cost evidence; MISS-CRON-FOUR-AUDITS remains exact and separate.'),
 'dead-code-cleanup':('MS41-041/042/047/085','DRM natural writer/cursor remainder; historical SKO alternative explicitly superseded.'),
 'draft-dashboard-yahoo':('MS41-063/068/054','Existing live provider/history gates; optional Yahoo live-draft roadmap is not an approved polling schedule.'),
 'draft-ranker':('MS41-064–067','Current execution-boundary/release-manifest gates; checked local deliveries do not imply activation.'),
 'forge-projections':('MS41-001–015/026–036','10 new OCT14-COMP parent/child rows + one pointer; F00–F22 inputs reconcile to same sole owner.'),
 'in-season-trust-clarity-decision-workflow':('MS41-057','Retained acceptance evidence; canonical tasks/tasks-prd-in-season-trust-clarity-decision-workflow.md distinguishes local presentation from real provenance/combined flow.'),
 'lines-ccc-ingestion':('MS41-038/040','Shared GDL/CCC parser and authentic-source acceptance, no duplicate ingestion implementation.'),
 'lines-gdl-ingestion':('MS41-038/040','Historical key/alias-email gates retained; October 15 dedicated IFTTT local integration now has its own superseding handoff.'),
 'nhl-game-prediction-model':('MS41-031–036/015','Runtime/scoring task 11 closure explicitly defers unsupported production activation; current GameGrid owner retains remaining evidence.'),
 'repository-audit-remediation':('MS41-074/085','Prior 19 additions retain exact task 002/004/026/028 and document-disposition gates; FRESH-04 corrects task 001 header only.'),
 'rules':('Repository instructions','Templates/historical execution processes; seven global template boxes excluded. Current AGENTS.md controls execution.'),
 'schema-docs':('Relevant database owners','Schema references are documentation, not schema-publish authority or new unchecked requirements.'),
 'sko-charts':('MS41-085 and historical provenance','Historical-only ownership contract; all 132 boxes checked. No automatic pipeline restoration.'),
 'super-goal':('MS41-095 plus canonical source rows','Large consolidated source mirrors; exclude 55 open aliases and superseded unbounded parent protocol, retain true canonical gates.'),
 'three-pillars-analytics':('MS41-069/070/076/077/088/090','Current surface implementation map supersedes abandoned layouts; keep CTPI, matured Sustainability and Parlay identity gates.'),
 'variance':('MS41-088 and current canonical variance task lists','No unchecked rows; PRD suggestions/owner placeholders do not override current completed scope or paused research.'),
 'wigo-charts':('MS41-071','Completed shared query/rating implementation is retained; distinct PlayerStats findings do not reopen its accepted query fix.'),
 'wigo-charts-audit':('MS41-071','Reference/input/acceptance packet; tasks/tasks-README.md owns actual incomplete acceptance, not a second visual project.'),
 'wigo-single-viewport':('MS41-071','Five checked local implementation items; preserve remaining current-inclusion/reference acceptance.'),
 'xg-model':('MS41-005/006/043–053 and existing FORGE data owners','Foundation/release documents are dated stages; final exception-resolution task references the v2 no-blocker verdict. Historical failures are not new failures.'),
 '(top level)':('MS41-016–025','RSO audit/PRD/layout plans reconciled through the October 9 consolidated list, with local 30/31 updates and genuine A1–A11 gates.'),
}
group=defaultdict(Counter)
for r in files:
    if r['path'].startswith('tasks/TASKS/'):
        parts=r['path'].split('/'); key=parts[2] if len(parts)>3 else '(top level)'
        group[key]['files']+=1
        for k in ['checklists','unchecked','prose_candidates']:group[key][k]+=r.get(k,0)
assert set(group)<=set(families)

def doc_authority(path):
    if '/archive/' in path:return 'Explicit archive; retain historical record.'
    if path.startswith('tasks/TASKS/'):
        parts=path.split('/'); key=parts[2] if len(parts)>3 else '(top level)'
        return ' | '.join(families[key])
    if path.startswith('web/prep-chef/'):
        return 'Page-discussion scaffold by default. home.md contains plan-only owner exceptions (FRESH-05); shared-navigation.md retains unresolved owner choices. Not-audited status is not a new audit mandate.'
    if path.startswith('tasks/draft-pro/') or path=='tasks/draft-dashboard-youtube-outline.md':return 'Draft canonical ledger/OPERATOR-CHECKLIST/INITIAL-RELEASE-PACKET; FRESH-06 separates stale copy, local completion and provider gates.'
    if path.startswith('docs/player-projections/'):return 'Held player-forecast research/FE contracts; prior 423 adjudication and current FORGE authority. No protected raw evidence reviewed.'
    if path.startswith('docs/repository-audit/'):return 'Frozen August audit, current remediation tracker and HOLD-DOC-11; frozen ledgers are not a new task register.'
    if path.startswith('tasks/artifacts/'):return 'Dated evidence/checkpoint, not independent task authority; current canonical owner/receipt supersession controls.'
    if path.startswith('tasks/'):return 'Canonical top-level task list or companion PRD; prior-423 and new-60 source crosswalks control named obligations.'
    if path.startswith('output/'):return 'Retained local receipt/report; parent identity/PK/UI acceptance gates remain separately scoped. Not a fresh execution mandate.'
    if path.startswith('web/public/fonts/'):return 'Font license terms, not product tasks.'
    if path.startswith('cms/'):return 'CMS README: intentional local staging/archive boundary; no new CMS feature commitment found.'
    if path.startswith('functions/'):return 'Functions development README and accepted historical SKO boundary.'
    if path.startswith('supabase/') or path.startswith('migrations/'):return 'Migration/source authority and historical archive instructions; no database execution authorized.'
    if path.startswith('web/rules/'):return 'Older process/reference material; current AGENTS.md and HOLD-DOC-11 disposition prevail.'
    if path.startswith('web/scripts/'):return 'Local script operating contract; separate current FORGE/data owner and protected-evidence boundary.'
    return 'Repository/package instructions and references; no new product commitment inferred from generic must/pending wording.'

docs=[]
for f in files:
    if f['coverage']=='document text scanned':
        docs.append({**{k:f.get(k) for k in ['path','sha256','checklists','unchecked','markers','prose_candidates','prior_same_hash']},
                     'authority_disposition':doc_authority(f['path']),
                     'coverage_depth':'Complete lexical discovery plus canonical-family reconciliation. Item-level semantic adjudication is explicit in prior-423/new-60/marker files; not independent acceptance of every prose sentence or checked box.'})
write('document-authority-inventory.json',docs)

lines=['# Coverage inventory','',
 f"Snapshot: **{coverage['captured_at']}**. The live worktree was changing under other owners; this is a timestamped inventory, not a frozen release candidate.",'',
 f"Inventoried **{coverage['files']:,}** non-generated files across every present repository root. Scanned **{coverage['text_scanned']:,}** text files, including **{len(docs)} documents**. Discovered **{coverage['checklists']:,}** checklist rows, **{coverage['unchecked']}** unchecked, **{len(markers)}** marker matches and **{coverage['prose_candidates']:,}** prose candidate lines. No read errors.",'',
 '## Checklist accounting','',
 '| Class | Rows | Disposition |','| --- | ---: | --- |',
 '| Prior eligible rows | 423 | Exact row text still present; retained semantic dispositions and current hashes/master mapping. |',
 '| New canonical FORGE rows | 10 | One parent + nine granular children, already owned in OCT14-COMP. |',
 '| New FORGE super-list pointer | 1 | Alias to the same canonical rows. |',
 '| New amendment input rows | 42 | Two copies of F02–F22; latest canonical F02/F03 disposition supersedes stale input checkbox state. |',
 '| New RSO release checklist rows | 7 | Copies of A1–A11/canonical acceptance/release rules, not seven new features. |',
 '| Explicit historical archives | 226 | Excluded from approved work. Numbered checklists included. |',
 '| Open SRC mirrors | 55 | Use original canonical source once. |',
 '| Templates | 7 | Not product tasks. |',
 '| Total | 771 | Every discovered unchecked row has an explicit classification. |','',
 '## Repository roots','',
 '| Root | Files | Text scanned | Checklists | Open | Marker matches | Prose candidates |',
 '| --- | ---: | ---: | ---: | ---: | ---: | ---: |']
for root,c in sorted(coverage['by_root'].items()):
    lines.append(f"| `{root}` | {c['files']} | {c['text_scanned']} | {c['checklists']} | {c['unchecked']} | {c['markers']} | {c['prose_candidates']} |")
lines+=['','`webhooks/` is absent in this checkout. The generic repository map is not evidence of a missing approved service. `.agents/` and `.codex/` are absent here; the available user-level REA skill excludes ordinary source-repository analysis. No historical editing worktree was used.','',
 '## Canonical initiative reconciliation','',
 'Counts describe discovered files/rows, not remaining implementation effort. All checked boxes remain evidence claims with their original limits.','',
 '| Initiative | Files | Open rows | Master/authority | Current disposition |','| --- | ---: | ---: | --- | --- |']
for name,c in sorted(group.items()):
    auth,note=families[name]
    lines.append(f"| {name} | {c['files']} | {c['unchecked']} | {auth} | {note} |")
lines += ['','## Freshly examined areas beyond the prior 423-row review','',
 '- Checked/status contradictions: Task #1 closure header; Draft tutorial/ledger status chronology; explicit historical goalie-filter audit notice.',
 '- Prose-only plans: page-audit scaffold inventory, concrete home exceptions, shared navigation decisions, Yahoo live-draft proposal, abandoned SKO alternative, current site-surface implementation map, old GameGrid layouts, goalie FORGE historical phases and xG release-stage supersession.',
 '- Reachable source markers: PlayerStats radar, team comparison placeholder, legacy API scaffolds, old cron/PBP comment, already-written Shift Chart fields, unsupported mode guards and unused hook/venue fields.',
 '- New evidence: RSO functional/visual acceptance and A1–A11 release gate list, extra two-file waiver-date correction, canonical FORGE F00–F22 mapping, dedicated IFTTT integration superseding its earlier absent-route checkpoint.',
 '- Frozen structured ledgers: nine explicitly selected repository-audit JSON/JSONL sources were hash-checked. Seven match retained hashes; two large shards had no prior hash but were tracked-clean at the same prior/current HEAD. Their retained 1,980 structured crosswalk records are reused, not reinterpreted as new tasks.','',
 '## Exclusions and honest limits','',
 '- All dependency/build/cache trees and symlink targets were excluded; exact roots are listed in `coverage.json`. No generated build output was treated as a new obligation.',
 '- Secret/environment/credential-named files were never content-read. Protected raw experiment/outcome/training/evaluation evidence was excluded. Other binary/structured data was inventoried by metadata only, except the explicitly selected safe repository-audit ledgers and supplied audit/master crosswalks.',
 '- The report directory excludes itself from scanning. Other workers created artifacts during this audit; final delivery does not claim an atomic view of their still-changing work.',
 '- The 6,512 prose keyword hits are discovery candidates, not 6,512 approved tasks. Every scanned document has a canonical-family authority disposition in `document-authority-inventory.json`. Focused semantic findings are documented; this is not a sentence-by-sentence implementation proof for every PRD or all 10,703 checked boxes.',
 '- No browser, application suite, build, production/provider request, remote schema inspection, dataset qualification or current deployment validation was run. Local Git-master equality is separate from deployment acceptance.',
 '- Private candidate/execution receipts referenced by plans were not reopened. No claim that the repository contains every unfinished private conversation or unregistered external commitment.',
 '- No subagents were started: the required actual model/reasoning hierarchy could not be verified in this execution context. This did not block the bounded single-agent audit.','',
 '## Machine-readable evidence','',
 '`inventory.json` records every included file and exact content coverage/exclusion. `checklists.json`, `unchecked-adjudication.json`, `document-authority-inventory.json`, `marker-adjudication.json`, `prior-423-reconciliation.json`, `new-60-reconciliation.json`, `prior-19-reconciliation.json`, `source-to-git-master.json` and `safe-ledger-deltas.json` preserve the detailed crosswalk. `initial-status.txt` is the early 05:19 inventory status (not a pristine intake snapshot); `latest-status.txt` is the latest scan status.','']
(OUT/'COVERAGE.md').write_text('\n'.join(lines))
print(json.dumps({'documents':len(docs),'markers':len(marker_rows),'marker_classes':Counter(r['classification'] for r in marker_rows),'canonical_groups':len(group)},indent=2))
