# FORGE / RSO release-readiness slice — October 24

One exact web validation candidate is frozen and reproducible. Application TypeScript and scoped lint pass. The focused consumer/admission run has **160 passed, one failed and one existing opt-in replay skipped**. The remaining failure is an RSO positive test fixture that lacks the now-required fictional target review/bindings. Two artifact-only controls confirm intentional denial, correct GOALS/SOG selection with exact fictional reviews, and permission withdrawal on revocation. No production approval or numerical model change is proposed.

## Candidate identity and boundaries

- Source branch/HEAD: `octoberBranch`, `2a5092d37cb863ec92a2a4e609999cf226bfa4a5`; index stayed empty.
- Retained local master: `457435eb3010c5b3dd92d2e1a46d9c75d851780a`; retained origin/master/Release C: `d4c2632d39ee8a59fa683f44a0e1d21c55db66bd`. Local master is an older ancestor; neither was fetched, changed or switched. `RETAINED-MASTER-COMPARISON.json` records both comparisons: 1,131 versus local master and 829 versus retained origin/master changed/new web paths. These counts are provenance differences, not new acceptance claims.
- 3,637 source/resource files, 109 final selected packet pins. Archive `candidate-source.tar.gz`, SHA256 `a08f698fa74f07da67fdc188224fa7a3d4c5f5c245eb109b9c6a1b63fc4ab664`, 47,097,870 bytes. Content-tree SHA256 `d54286fd7f8ad2a32abb2fa928f21a01b3c8d8ce300d4caa526cfb2fb0e53f95`.
- Seed: immutable combined October23 archive `8569002b…e4a7`; final accepted Yahoo, selected Release C restoration, billing, Grid readers/R5, news serialization, RSO fixture and two-file layout overlays. Each selected source hash was verified before copy. Input manifest copies are retained under `inputs/`; `CANDIDATE.json` records per-path provenance and deliberate Grid supersession.
- Inherited supporting source is frozen verification context. It does not acquire blanket release acceptance from this run. 168 retained public image/font/license resources and the explicit Next cron-document tracing dependency complete omissions from the old text-only archive. Resources came from pinned Git objects, not a moving copy.
- No environment files, Git metadata, context diaries, dependency installation, unqualified experiment branch or newly held manual Luna implementation was added. SQL/migration application and companion CMS/functions are outside this bounded web candidate. It is not a deployable whole-repository release commitment or a candidate commit SHA.
- The offline-denial preload is a sidecar, outside the candidate. `node_modules` is a local read-only dependency link with package-lock identity recorded in COMMANDS.json; no package/lockfile change or install occurred.

## Current custody

Read October24 protocol, both mailboxes, both lease files and current-repo receipt before assembly. Wrote only this artifact namespace, the task diary and a disposable export; no shared application writes, refs/index operations or mailbox edits. Claude C1 has its own isolated Next slot :3110. This lane started no Next server and used only an atomic token/inode-owned heavy lock for checks. All owned checks are complete and that lock is released. Parent's later C3 isolated InSeasonPanel correction is not imported. New Testing Grounds modules/PRD work and other October24 Claude changes are not included. The coordinator owns lease/mailbox updates; Sol audit owner owns master/LEDGER.

## Evidence actually executed

Node22.11.0/npm10.9.0, clean synthetic environment, offline npm and network-denial preload; no provider, database, hosted endpoint or paid request. Exact commands/environment/lock tokens and timestamps are in COMMANDS.json and diagnostics/COMMAND.json.

| Check | Result |
| --- | --- |
| Static import closure from nine FORGE/RSO/Start Chart entry points | 241 local source modules, 903 edges, no unresolved imports or local imported stylesheet/image files. The initial harness misclassified six bare Node builtins; initial report is preserved, then builtin recognition was corrected. This is static/string-import closure, not proof of all computed runtime paths. |
| `npm exec --no -- vitest run ... --maxWorkers=1 --minWorkers=1 --reporter=json ...` | 160 passed, one failed, one skipped across four matched files: apiHelpers.runAdmission, nativeContributionAdmission, planningConfirmationRoute and Start Chart API. The command also named absent currentPlanningRead.test.ts; no test coverage is claimed for that unmatched filter. No full suite ran. |
| `npm exec --no -- tsc --noEmit --pretty false`, established 8GB heap | Exit0, no diagnostics; entire candidate application source and its included tests. |
| `npm exec --no -- eslint <109-pin JS/TS selection>` | Exit0, zero errors/eight inherited warnings: six RSO hook dependencies and two image mocks. |
| Artifact-only permission diagnostic | 2/2 passed: original unreviewed positive fixture is correctly denied; fictional GOALS/SOG reviews restore exact selection and revocation withdraws it. Production catalog remains empty. |
| Integrity | All3,637 source/resource hashes and109 selected current pins unchanged after checks; source refs unchanged. Archive hash verified; index empty. |

The existing44 RSO browser cases across distinct frozen focused runs and separate10 Yahoo browser cases are reused, not rerun or relabeled a single full green run. Their final delivery artifacts, five fixture pins and two runtime pins matched; evidence and the versioned acceptance harness are copied under inputs/rso-evidence. Existing selected restoration108+9 and Yahoo58 independent reviews remain upstream evidence, not added to this run's count.

## Exact remaining test failure and proposed correction

`web/__tests__/pages/api/v1/start-chart.test.ts:1755`, case `matches crowded-day RSO selection to Start Chart ranks from the same admitted scoring inputs`, expects quantitative RSO planning after calling publicPlanningForecasts directly. It creates valid numeric rows but supplies no RSO-specific target review/bindings. `rsoUsePolicy.ts` requires those reviews and its production catalog remains empty. Start Chart source admission does not confer RSO permission. The unchanged candidate correctly returns null projected value and denies comparison.

`proposal-start-chart-fixture.patch` (SHA256 `a8a2f2bf20949e303b550383047d38daa13eae2d6d4d169511ce6a5a694aa0cf`) changes only that test file: assert unreviewed denial, bind those same synthetic rows to exact fictional GOALS/SOG reviews, retain all original API/rank/selection/numeric/immutability assertions, assert revocation withdrawal, and restore the spy in finally. `git apply --check` passes. **The proposal is not applied to canonical source or this frozen candidate and has not been run as a patched full case.** The artifact diagnostics establish cause and intended contract; they do not convert the preserved failing run into a pass. Parent-reviewed one-file test-only correction lease is the next concrete action.

The skipped case is the pre-existing opt-in externally supplied offline packet replay. No approved packet was supplied and none was captured or fabricated. Its missing qualification evidence remains separate.

## Gates and reproducibility

1. Review/authorize the exact one-file test-only correction, then create a versioned snapshot and rerun that failed case with its negative controls; do not change production catalog or weaken permissions to pass.
2. Parent review of the candidate/provenance and remaining inherited changes; reconcile any later accepted Claude delta separately. Recheck resource, private-data and migration-source authority for the whole release. This web slice does not settle CMS/functions/DB release composition.
3. Settle exact whole-release commit identity and applicable browser acceptance on that tree. Archive hashes are not commit SHAs. Preserve Release C October23–30 evaluation and existing interim serving gates.
4. Recheck linked project/build behavior and exact-SHA deployment status only under the separately authorized release action. No push, merge, commit, deployment, migration, production repair, capture or fitting occurred here.

Restore to a new directory with `python3 restore.py /tmp/fhfh-forge-rso-review-<unique>`. It verifies the archive, safely extracts and verifies every content hash. Use the already-installed matching dependencies and the synthetic/denied-network environment in COMMANDS.json when reproducing. Do not inherit shell credentials, GIT_DIR or environment files. Reacquire the free shared heavy lock before any check. Do not repeat completed suites for status.
