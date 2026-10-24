from pathlib import Path
import json,hashlib,datetime,subprocess
R=Path('/Users/tim/Code/fhfhockey.com');V=Path(__file__).resolve().parent;O=V.parent;M=json.loads((V/'CANDIDATE.json').read_text());T=json.loads((V/'tests.json').read_text());res=json.loads((V/'RESULT.json').read_text());sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();at=datetime.datetime.now(datetime.timezone.utc).isoformat()
assert T['numPassedTests']==161 and T['numFailedTests']==0 and T['numPendingTests']==1
assert all(x['exitCode']==0 for x in res['results']) and not res['snapshotDrift']
files=[]
for f in T['testResults']:
 # macOS resolves /tmp to /private/tmp; normalize both before computing paths.
 n='web/'+str(Path(f['name']).resolve().relative_to((Path(M['snapshot'])/'web').resolve()))
 counts={s:sum(a['status']==s for a in f['assertionResults']) for s in ['passed','failed','skipped']};files.append({'path':n,**counts})
assert len(files)==4
M['status']='R1 frozen bounded web validation candidate;161pass0fail1existing-opt-in-skip, scoped types/lint pass; broader release gates remain'
M['completedChecks']={'fourMatchedFiles':files,'scopedTypeScript':0,'scopedESLint':0,'changedCandidatePaths':1,'fullSuiteRun':False,'newBrowserRun':False}
(V/'CANDIDATE.json').write_text(json.dumps(M,indent=2)+'\n')
receipt={'at':at,'decision':'Parent-approved exact test-only correction implemented and verified; no broader release acceptance','sourceRef':subprocess.check_output(['git','rev-parse','HEAD'],cwd=R,text=True).strip(),'branch':subprocess.check_output(['git','branch','--show-current'],cwd=R,text=True).strip(),'file':'web/__tests__/pages/api/v1/start-chart.test.ts','beforeSha256':'9f70e810de91003b78d4b64d3e8a06c6740493d1902a99331f94e41405664504','afterSha256':'eebd86016d6cc3809ab15b2e936b884464d41666519d689ce26112a967d203c7','patchSha256':sha(V/'reviewed.patch'),'candidateManifestSha256':sha(V/'CANDIDATE.json'),'archiveSha256':sha(V/'candidate-source.tar.gz'),'contentTreeSha256':M['contentTreeSha256'],'fileCount':len(M['files']),'matchedTestFiles':files,'tests':{'passed':161,'failed':0,'skipped':1,'skip':'Pre-existing opt-in supplied offline acceptance packet; no packet provided/captured','diagnosticsNotAddedToThisCount':2},'typesExit':0,'lintExit':0,'lintOutputBytes':(V/'scoped-lint.log').stat().st_size,'allOtherCandidatePathsUnchanged':3636,'productionScopeProofSha256':sha(V/'UNCHANGED-PRODUCTION-SCOPE.json'),'r0ArchivePreserved':res['oldArchiveUnchanged'],'originalFailureReceiptSha256':sha(O/'tests.json'),'originalDiagnosticsReceiptSha256':sha(O/'diagnostics/tests.json'),'indexPaths':subprocess.check_output(['git','diff','--cached','--name-only'],cwd=R,text=True).splitlines(),'activeOwnedProcesses':0,'ownedHeavyLockReleased':not Path('/private/tmp/fhfh-heavy.lock').exists(),'gitMutations':0,'productionCalls':0,'runtimeSourceChanges':0,'remainingGates':['Parent/independent acceptance of exact r1 candidate and correction receipts','Whole-release inherited accepted scope/privacy/resources/migration-source and companion projects reconciliation','Exact release commit/browser acceptance and project/deployment gates; no push or external action granted here']}
(V/'EVIDENCE.json').write_text(json.dumps(receipt,indent=2)+'\n')
rows='\n'.join('| `'+x['path']+'` | '+str(x['passed'])+' | '+str(x['failed'])+' | '+str(x['skipped'])+' |' for x in files)
report=f'''# R1 test-only correction handback

The exact parent-reviewed correction is implemented in the sole leased test file and a new isolated candidate. The same four matched boundary files now pass **161 tests, zero failed, one existing opt-in replay skipped**. The affected actual Start Chart file is included. Scoped TypeScript and ESLint both exit0 with empty diagnostic logs. The earlier two artifact diagnostics and unmatched filter are not added to this result.

## Exact delta and candidate

- Only changed canonical/candidate path: `web/__tests__/pages/api/v1/start-chart.test.ts`.
- Before `{receipt['beforeSha256']}`; after `{receipt['afterSha256']}`.
- `reviewed.patch` is byte-identical to the parent-reviewed proposal: `{receipt['patchSha256']}`.
- Candidate:3,637 files/110 selected pins. All3,636 other files match r0. Candidate manifest SHA256 `{receipt['candidateManifestSha256']}`.
- Archive `candidate-source.tar.gz`, SHA256 `{receipt['archiveSha256']}`; content-tree SHA256 `{receipt['contentTreeSha256']}`.
- Source branch/HEAD remains octoberBranch/{receipt['sourceRef']}; index empty. These export hashes are not a commit SHA or release authorization.

The test verifies unreviewed denial and the production empty catalog, supplies exact fictional GOALS/SOG reviews using the existing helper, retains every original API/rank/selection/projected-score/immutability assertion, verifies revocation denial, and restores the spy in finally. No runtime, helper, model, contract or production approval changed.

## Actual verification

Node22.11.0/npm10.9.0; synthetic environment, offline npm and network-denial preload in a disposable snapshot. One token/inode-owned heavy lock covered the four-file run and scoped static checks; it was released. No server, unrelated suite or external call. Exact arguments/environment/times are in COMMANDS.json and RESULT.json.

| Matched file | Passed | Failed | Skipped |
| --- | ---: | ---: | ---: |
{rows}

`npm exec --no -- vitest run <four files above> --maxWorkers=1 --minWorkers=1 --reporter=json --outputFile=<tests.json>` executed once. The skipped case is the existing externally supplied offline packet replay; no approved packet was supplied and none was captured or fabricated. It remains a separate missing qualification input.

Scoped types: `npm exec --no -- tsc --project <r1/tsconfig.json> --noEmit --pretty false`, including changed test/declarations/imports. Scoped lint: `npm exec --no -- eslint __tests__/pages/api/v1/start-chart.test.ts`. Both exit0. R0 full-application TypeScript remains upstream evidence; unchanged source is identical and the scoped check covers new imports. No full application rerun was necessary for this test-only delta.

## Preserved evidence and remaining gates

Original archive `a08f698fa74f07da67fdc188224fa7a3d4c5f5c245eb109b9c6a1b63fc4ab664`, original160/1/1 receipt and both artifact diagnostic controls remain unchanged. Existing44 RSO cases across distinct frozen runs and separate10 Yahoo cases remain reused browser evidence, not a new whole browser run.

UNCHANGED-PRODUCTION-SCOPE.json binds r0/r1/current canonical hashes for rsoUsePolicy.ts, its fixture helper, planning.ts, currentPlanningRead.ts and the Start Chart API. All match. Frozen production reviews remain empty. The corrected actual test passes unreviewed denial, fictional positive selection and revocation withdrawal. Existing serving/admission gates and Release C evaluation are unchanged; later Claude C3 and Testing Grounds work are excluded.

Parent/independent acceptance of this exact version, whole-release source/resource/privacy/migration-authority and companion-project composition, exact commit/browser acceptance and deployment-project gates remain. No Git/index/ref operation, push, deployment, production/provider call, capture, fitting, migration or credential action occurred. All correction operations finished; this one-file lease is ready for handback. Next safe action is independent inspection of these exact patch/manifest/receipts, then broader composition under separate scope.

Packaging note: an initial receipt-only path calculation encountered macOS /tmp versus /private/tmp spelling. It wrote no receipt/source change; normalizing both paths fixed packaging without rerunning tests.
'''
(V/'HANDOFF.md').write_text(report)
(V/'restore.py').write_bytes((O/'restore.py').read_bytes())
with (R/'tasks/diaries/2026-10-24-codex-forge-rso-release-readiness.md').open('a') as f:f.write('\n- '+at+': R1 reviewedpatch appliedexactly toonlyleasedStartCharttest (aftereebd8601) andnew3637-filecandidate. Archivedc0bed35/content6471be57. Actualfourmatchedfile single-run161pass0fail1existingopt-inskip; no unmatchedfilter/diagnosticcountadded. ScopedTS/lint0emptylogs. All3636otherfiles and5protectedcanonicalpins unchanged; productionreviewcatalogempty. R0archive/originalfailure/twodiagnostics preserved. Noactiveoperation/ownlock/index/ref/productionchange. R1HANDOFF/EVIDENCEsaved; packagingnormalized/tmpversus/private/tmpwithouttestrerun. Nextindependentreview/broaderwhole-releasegates; nofurtherappeditqueued.\n')
print(json.dumps({'matchedFiles':files,'evidenceSha256':sha(V/'EVIDENCE.json'),'handoffSha256':sha(V/'HANDOFF.md'),'candidateManifestSha256':sha(V/'CANDIDATE.json')},indent=2))
