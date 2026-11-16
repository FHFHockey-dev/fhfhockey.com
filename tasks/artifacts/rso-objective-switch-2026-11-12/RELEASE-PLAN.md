# RSO objective switch + dated Lines report release

## Exact candidate and target

Object-only candidate **f42a15054adeee03be4858a9a4859cddb6d31040**, tree `0d1f85f45f7bacba0ee458b22dd469041c7abe38`, parent `4243bcd4e29889c035e832562e25850d14af0ee1`.

Target: Vercel **fhfhockey**, production, repository branch **master**, root **web**, serving `https://fhfhockey.com`. No preview, database change, flag/configuration change or additional release is included.

This immutable candidate was assembled in a temporary Git index, without changing HEAD, branch refs, shared index, or checkout. A Git archive is used solely as an isolated verification snapshot. Do not push the local octoberBranch HEAD or local master: they contain/diverge from unrelated work. The current remote master was checked with git ls-remote and matches the candidate parent.

## Contents

Exactly eight source/test paths in BATCHED-RELEASE-CANDIDATE.json:
- RSO component and planner: use the same existing known-part forecast eligibility for the objective button as the planner. Repeated Most starts → Best projected points works; all-unknown forecasts and saved read-only gates remain guarded.
- RSO component/streaming tests: repeated objective toggles, persistent selection, real partial/no-forecast engine coverage.
- Lines projected API and component: if a team-only legacy lookup has no reports today, select the latest retained report date within seven preceding Eastern dates; explicitly display the older date and warn it is not today's confirmed lineup. Exact-game and snapshot paths unchanged.
- Lines API/component tests.

Exclude all DRM/DateRangeMatrix/history, mixed aesthetic work, other local commits, database repairs, flags, schema, config/lockfiles, diaries and artifacts. Candidate tree diff was checked against parent; all eight hashes reproduce the two owners' pins.

## Verification

- Pre-fix toggle regression failed on the disabled points button.
- Local RSO checks: 279 tests, final two toggle tests, TypeScript passed with 8 GiB heap; lint zero errors and six existing hook warnings.
- Independent RSO reviewer: no blocking issue, hashes matched, five focused tests passed.
- Independent batch reviewer: no blocking findings, exact eight-file scope verified; 20 Lines tests passed in the exact candidate archive.
- Exact combined candidate archive: 299 tests passed in four test files. The nonexistent optional `lib/sources/read.test.ts` pattern selected no file; no reader-suite execution is claimed.
- Final isolated-candidate TypeScript passed with 8 GiB heap.
- No local production build, browser E2E, new-code production request, push, or deployment has been performed.

## Remote preflight and remaining checks

Current authenticated Vercel metadata confirms web production alias at READY deployment `dpl_HH8SPE1cLyonVBW9uN3rUi1MN3Sa`, SHA `4243bcd4e`, and exactly four repository-linked projects. The three companions' latest entries are CANCELED. Evidence: VERCEL-PREFLIGHT.json.

Current slim connector results omit rootDirectory, productionBranch and ignore settings. Retained 2026-11-12 17:41Z authenticated settings inventory gives roots web/cms/functions/repository and master triggers; tracked ignore rules remain web-specific, CMS/functions directory-specific and root exit 0. Expected fan-out for this eight-file web-only change is four entries: one web build and three ignored/canceled companion entries. This is conditional until the release owner verifies those settings and previous-SHA comparisons. No settings changes are authorized. If unexpected companion builds would occur, stop and propose a bounded skip/filter plan.

Before publishing, verify current remote master still equals parent, all eight source/object hashes and independent reviews, final TypeScript result, writer/release coordination, full current linked-project settings, and absence of an existing/in-progress deployment for this exact candidate. Obtain explicit approval naming this SHA and expected one-build/three-skip scope. Do not silently rebase if the parent advanced: review and pin a new candidate.

## Rollout and bounded verification proposal

After specific approval only: publish this immutable candidate to master through the established release process, preserve the dirty checkout and index, verify remote SHA, and wait for the one web build plus expected companion skips. Stop on ERROR, unexpected extra build, or SHA mismatch; no automatic retry.

At most three sequential read-only application GETs, no cache-busting and no script/request fan-out:
1. `/roster-schedule-optimizer` HTML shell: 200 and expected title/loading shell. This route is client-only and has no server data loader.
2. `/api/v1/lines/projected?teamId=54`: only after verifying current legacy mode (entry-serving false) and publishing true, with no other writer and bounded timeout. Require enabled response/reportScope and valid older/current disclosure bounds; no hard-coded report count.
3. `/api/v1/lines/projected?teamId=54&gameId=2026020296`: same mode guard, require unchanged exact-game selection and reports scope.

The `/lines/VGK` HTML route is excluded because its ISR loader invokes team/line-combination reads. No broad browser load or script fan-out is in this smoke budget.

If serving flags differ, do not invoke an observation-capable GET or change flags; report that live API smoke requires rescoping. Stop at first failed assertion or abnormal latency. Shell checks do not verify authenticated RSO behavior; local regression is the toggle interaction evidence, and the reporting user can refresh the page after verified release.

## Rollback

No database rollback is needed. Record the exact pre-release production deployment and alias before publication. On regression, stop; within an explicitly approved rollback scope, restore the retained READY production deployment for parent 4243bcd4e, avoiding a new build. Confirm alias and bounded shell readback. Vercel rollback may disable automatic production alias assignment; do not silently change project behavior. A Git revert/redeploy is a separate reviewed action if needed. Preserve both fixes as independently revertible source hunks.
