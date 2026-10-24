from pathlib import Path
import json,hashlib,difflib,datetime
r=Path(__file__).resolve().parent;repo=Path('/Users/tim/Code/fhfhockey.com');stamp=datetime.datetime.now(datetime.timezone.utc).isoformat()
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
paths=['web/e2e/roster-schedule-optimizer.spec.ts','web/e2e/roster-schedule-optimizer-fixtures.ts'];patch=''
for p in paths:
 b=r/'before'/Path(p).name;before=b.read_text().splitlines(True) if b.exists() else []
 patch+=''.join(difflib.unified_diff(before,(repo/p).read_text().splitlines(True),fromfile='a/'+p if before else '/dev/null',tofile='b/'+p))
(r/'FIXTURE-CANDIDATE.patch').write_text(patch)
(r/'ACCEPTANCE-HARNESS.patch').write_text(''.join(difflib.unified_diff((r/'before/rso-p07-acceptance.spec.ts').read_text().splitlines(True),(r/'harness-v2/rso-p07-acceptance.spec.ts').read_text().splitlines(True),fromfile='original-Claude-harness',tofile='harness-v2/rso-p07-acceptance.spec.ts')))
pins={p:sha(repo/p) for p in paths};pins.update({p:sha(r/p) for p in ['FIXTURE-CANDIDATE.patch','ACCEPTANCE-HARNESS.patch','harness-v2/rso-p07-acceptance.spec.ts']})
original=json.loads((r/'BEFORE.json').read_text());unchanged={p:sha(repo/p)==h for p,h in original.items() if p not in paths}
snapshot=json.loads((r/'RUNTIME-SNAPSHOT-PINS.json').read_text());drift={p:{'before':h,'after':sha(r/'snapshot'/p)} for p,h in snapshot.items() if p not in paths and (r/'snapshot'/p).exists() and sha(r/'snapshot'/p)!=h}
(r/'CURRENT-PINS.json').write_text(json.dumps({'at':stamp,'head':'2a5092d37cb863ec92a2a4e609999cf226bfa4a5','pins':pins,'unchangedOriginals':unchanged,'snapshotDrift':drift},indent=2)+'\n')
latest={};runs=[]
def cases(d):
 out=[]
 def walk(s):
  for sp in s.get('specs',[]):
   for t in sp['tests']:
    x=t['results'][-1];out.append({'title':sp['title'],'project':t.get('projectName'),'status':x['status'],'errors':[e.get('message','') for e in x.get('errors',[])]})
  for ss in s.get('suites',[]):walk(ss)
 walk(d);return out
for label in ['affected-spec-01','failed-families-01','commandbar-and-oracles-01','remaining-controls-01','disclosure-controls-01','adjudicated-controls-01','account-and-partial-01','alignment-and-account-01','final-disclosure-controls-01','horizontal-and-bench-01','final-contract-controls-01','retained-yahoo-final-01','final-unknown-contracts-01']:
 if not (r/label/'EXIT.json').exists():continue
 d=json.loads((r/label/'results.json').read_text());cs=cases(d);(r/label/'CASES.json').write_text(json.dumps(cs,indent=2))
 for c in cs:latest[c['title']]={**c,'run':label}
 runs.append({'run':label,'pass':sum(c['status']=='passed' for c in cs),'fail':sum(c['status']!='passed' for c in cs),'stats':d['stats']})
(r/'CURRENT-CASE-ACCOUNTING.json').write_text(json.dumps({'at':stamp,'qualification':'Latest per-case evidence across distinct frozen run pins, NOT a green full run. Original full run16/44 passed.','runs':runs,'latest':list(latest.values())},indent=2))
pending=[f"- {v['title']} ({v['run']}): {v['status']}" for v in latest.values() if v['status']!='passed']
(r/'REPORT-WIP.md').write_text(f'''# RSO test fixture reconciliation — checkpoint {stamp}

Test-only lease on two E2E paths. Runtime candidate remains NOT ACCEPTED while layout failures and unreconciled fixtures remain. No push/deploy/provider calls or application edits by this worker.

Original receipt: 3 passed/41 failed; preserved in before/. Affected spec ran once: 16 passed/28 failed; subsequent focused repaired-family results are individually pinned, not a new full-spec claim. Own versioned authenticated Yahoo acceptance harness:10/10 desktop/mobile passed; original Claude harness unchanged. 191 baseline/+999 complete-swap improvement passed. Full typical workload passed:25 roster/300 candidates/70 games/2275 forecasts, cancellation27.8/27.7ms, stale clear35.6ms.

Exact patch and pins: FIXTURE-CANDIDATE.patch, ACCEPTANCE-HARNESS.patch, CURRENT-PINS.json, CURRENT-CASE-ACCOUNTING.json. Source runtime remains frozen except authorized exact owner SCSS overlay in CSS-OVERLAY.json and generated next-env.d.ts.

Owner CSS4e40feb9 is now overlaid (CSS-ALIGNMENT-OVERLAY.json), preserving commandbar correction. Full original1180x757 accountcase PASS, including normalRefresh/Save/Continue after real status hover, ownership change abort/stale publication suppression and manualfork editing. Oldnotice collision was collapsed disclosure state; no forcedclick or notice runtimefix. Initialalignment improved to <=0.024px but mobile horizontal scroll120 exposes real120.0078125px mismatch; owner preparing narrow runtime sync. Summary19/20/29 and three category cases pass. <=1px alignment failures remain unchanged.

Candidate999 reaches correct final candidate/+16/zeroAGP, but metrics.activePoints counts40 scored shortlist rows against original999 expectation. Recorded maxGap45.7ms/ticks200. Source returns full population separately as search.eligibleCandidates. Owner verified released bounded-search source byteidentical; updated999 eligible/<=40 candidates/<=160 evaluations/incomplete and originalranking/+16/zeroAGP/responsiveness allPASS. Compactfuture now asserts currentworker display/manifest asOf plus unchangedwhole savedworkspace and originaldate/navigation behavior; PASS. Originalredreceipts retained. Remaining oldYahoo timeout/candidatefeedback semantics underownerreview, not waived.

Latest unresolved cases:
{chr(10).join(pending)}

Active operation (if EXIT.json absent): final-unknown-contracts-01, exec session25175; own isolated NextPID11732 port3139. Runner owns atomic shared lock and releases only token/inode match. Do not interrupt. Next: inspect this result and save run TEST-PINS before another runner; await owner's runtime CSS overlay/new exact pin; targeted verification only. Narrow lint pending; no dependencies or full duplicate suite.
''')
print(json.dumps({'at':stamp,'runs':runs,'latestPass':sum(v['status']=='passed' for v in latest.values()),'remaining':len(pending),'pins':pins,'unchangedOriginals':unchanged,'snapshotDrift':drift},indent=2))
