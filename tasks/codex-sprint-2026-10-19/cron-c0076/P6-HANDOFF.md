# P6 handoff — local candidate ready for Chef review

C0076 stays **OPEN**. Local runtime gap reproduced and patched; no hosted verification or release action occurred.

## Exact changed/created files

Changed:
- `web/pages/api/v1/db/update-nst-team-daily.ts` — one absolute NST deadline, conservative admission bound, resumable incomplete date; existing request control enforces retries within deadline and at least 21-second spacing.
- `web/__tests__/pages/api/v1/db/update-nst-team-daily.test.ts` — uses actual wrapper plus mocked audit sink, adds slow success/resume and slow failure regressions.

Created in this lane:
- `DIAGNOSIS.md`
- `P6-HANDOFF.md`
- `regression-before.log`
- `regression-after.log`
- `unchanged-contract-tests.log`

No wrapper/helper, fenced source/test, scheduler, manifest, configuration, register, branch, or other-owner change was made.

## Review hashes (SHA-256)

| File | Hash |
| --- | --- |
| `web/pages/api/v1/db/update-nst-team-daily.ts` | `af40a7562ab28f004f2d3dc363fa6fc25f06015fc3e63c3642865ec60edf9fac` |
| `web/__tests__/pages/api/v1/db/update-nst-team-daily.test.ts` | `7fe485da054eb72f9446a3eaf1d0a5f940b6cafd251914b65a369bbc534284b2` |
| unchanged `web/lib/cron/withCronJobAudit.ts` | `c747280dd09aa4ba40f59bfb06b72ff42df20cbb31bff575d952d57826a36ff0` |
| unchanged `web/pages/api/v1/db/update-nst-goalies.ts` | `fac4cb5347d0081902cbea413fd1050f4313ebfb861a01e99034fa2337e7a2ef` |
| unchanged `web/pages/api/v1/db/update-standings-details/index.ts` | `28f9894813119c58c7d02daf53032015b512b94dd8bc87f4d3429457a89b184e` |
| unchanged `web/lib/cron/standingsDateRange.ts` | `b493312401b8444d0c7a5fed7d40ee491df0298ab4df045c8fe79c4c785e204b` |

## Acceptance and verification

| Requirement | Receipt |
| --- | --- |
| Actual worker runtime confirmed before edits | Own child JSONL turn_context: `gpt-6.1-sol`, high; Chef xhigh confirmed. |
| Existing fixes checked, no duplicate work | Goalie NstConfigError and standings 14-date bound retained; focused tests pass. |
| Remaining cause reproduced before source fix | Regression: expected audit before 240000ms; observed 720000ms. Original 5 tests passed. |
| Minimal local fix + meaningful regression | Slow mock case audits at 180000ms, returns complete=false and exact current date, next run completes missing datasets. Actual wrapper exercised with mock insert. Additional 207/failure test passes. |
| Route suite | `npm test -- __tests__/pages/api/v1/db/update-nst-team-daily.test.ts --run`: 7/7 pass. |
| Existing contracts | `npm test -- lib/cron/withCronJobAudit.test.ts lib/cron/standingsDateRange.test.ts __tests__/pages/api/v1/db/update-nst-goalies.route.test.ts --run`: 21/21 pass. |
| Diff integrity | Scoped `git diff --check` passes. |
| Shared TypeScript | Chef-reported `npx tsc --noEmit`, NODE_OPTIONS heap limit 8192 MB: pass, exit 0. Not rerun by this worker. |
| Shared lint | Chef-reported `npm run lint`: pass, exit 0; 0 errors and 68 warnings outside changed files. Not rerun by this worker. |
| Chef independent review | Source diff reviewed; route 7/7 passed independently. Unchanged three-file cohort 21/21 passes reported (session 35504; exit confirmation pending at last worker receipt). |
| Natural/deployed audit | Not verified. Exact bounded read proposal in DIAGNOSIS.md requires TJ authorization; C0076 remains open. |

All application checks ran from `web/`; selected tests and setup were inspected for live/network/credential/Git side effects before execution. No real NST/provider/hosted call, credential inspection, install, build, migration, Git mutation, or further delegation. No running process remains.

## Remaining limits / next action

Chef review and independent checks are reported above; no further source/test edits or test reruns were requested. Deadline reserves 20 seconds before retained 240-second runtime, but pre-handler auth/off-season lookup, database work and audit latency remain unbounded. This patch supplies local evidence for team-daily only; other routes have retained fixes and explicitly reported residual risks. Job275 is inactive in retained Oct 17 metadata. Do not activate it or require a new natural run merely to close a historical alias gap.

Report-only review correction: production proposal now reads `details.response` plus `responseTruncated`, redacts URL strings, and decodes explicitly untruncated JSON offline. This supports older deployed wrappers without assuming the currently local `responseOutcome` field is deployed. Window/filter/row bounds remain unchanged; no query was executed.

Final diagnosis report SHA-256: `3370f00dc70724edbc7ca51c05de85e80aa117a5b6aa9488f28962d14f617578`. Source/test hashes above remain unchanged.
