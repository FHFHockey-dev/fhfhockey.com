# C5 receipt: CRON-AUDIT-COVERAGE (Claude lane)

- Stable ID: CRON-AUDIT-COVERAGE. Lane: C5 (Claude). Date: 2026-10-24.
- Base: `octoberBranch` @ `2a5092d37cb863ec92a2a4e609999cf226bfa4a5` in the canonical checkout. No Git writes, no commit. Codex owns integration.
- Status: **implemented locally and checked; needs independent review.** It has not been accepted, integrated or released. Nothing was run against a live route, cron, provider or database.

## Patch

`handoffs/C5/C5-cron-audit-coverage.patch`, SHA-256 `62faa9ce4657ceeb12ea645fcf907992500f2e72b3a5b6994f38f8951542a541`. It is a `git diff` against HEAD, and `git apply --check -R` passes on the current tree. 5 files, +232/−46.

| Path | Baseline SHA-256 (lease) | Candidate SHA-256 |
| --- | --- | --- |
| web/pages/api/internal/yahoo-live-draft.ts | ce7c6553…ea92c69 | 96704e8bf3328052aa4ff3f8ac7fced1e1f38839060ad02155ecaeb80201d445 |
| web/pages/api/v1/db/update-drafted-prospects.ts | 980b050f…2b2c9c | e4c5e476c50e57be341498a615ad0517ccd9f918937f42d85410f8a7c1df9881 |
| web/__tests__/pages/api/internal/yahoo-live-draft.test.ts | fba094aa…2b5f1 | 247565864c28a584c127fed5bf7120f4cf220f821d6131eec507b40d3b8faf0b |
| web/__tests__/pages/api/v1/db/update-drafted-prospects.test.ts | 995d6da8…62c1e | f16fad19188630ced0a9d32c53a91b5a969cee0b4e45b6cee5c2e2ca98899b27 |
| web/__tests__/pages/api/v1/db/cron-audit-wrappers.test.ts | e4d387ce…ad451 | 5e2365e7d45adebae887f5b7a08b53cdd994bede6a9aa5cd6b05f0e1eecaea53 |

All five baselines matched CLAUDE-LEASES.json at the start.

Dependency pins: none of these files are edited, and all are clean at HEAD.
- `web/lib/cron/withCronJobAudit.ts`: `02790f98626c71accd9bdb0b01a2e9da95799a254c14b98ad82a94bfca635094`
- `web/lib/cron/cronAuditCoverage.ts`: `754a0df900b7cabd573838b4d229857ae63d83361e6ad94ad6a7f7ea084706b3`
- `web/utils/adminOnlyMiddleware.ts`: `de749fa9e811aacbbd1c85a080140f380fd8c3d3794ad378caa9dd4025f444c5`
- `web/lib/cron/timingContract.ts`: `ded35e2b2b243ade44b9ea0a4ae1f575f4dccdb6e13c195c81eb844cc9b629ff`
- `web/vercel.json`: `bcd2cab8174bead693c7a4268ce2dd44ea551c9dfa92736b347868a0ebac2d2b`

## What changed

- **update-drafted-prospects**: the route is now `adminOnly(withCronJobAudit(handler, { jobName: "/api/v1/db/update-drafted-prospects", recordRowMetrics: false, responsePreviewKeys: [success, skipped, reason, dryRun, year, total, nextCursor, message] }))`. Authentication runs before auditing, which is the convention in the existing auth-first list. The handler body is unchanged: same dry-run default, both write gates, lease claim/cursor, finish/failed job updates and responses. The static classifier now rates it `admin-or-cron` / `shared-wrapper`.
- **yahoo-live-draft**: the reviewed 5-statement cron-secret prefix and the disabled/suspended no-op exits stay in the default handler. The session lookup and polling loop moved without change into `const auditedPoll = withCronJobAudit(..., { jobName: "/api/internal/yahoo-live-draft", recordRowMetrics: false, responsePreviewKeys: [cycles, attempted, succeeded, failed, error] })`. The handler returns that delegate last, following the espn-sync pattern. Responses, status codes, polling cadence and the deadline are unchanged.
- **Audit placement (decision for review)**: the yahoo route writes no audit row when it exits as disabled or suspended. That exit does no work, and auditing it would insert a row every minute for the whole off-season. Once the route is enabled and unsuspended, every run writes one row, including runs that find no active session (`cycles: 0`, recorded as success).
- Row metrics are null on both routes. Unknown is recorded as unknown; the wrapper's key inference is not used to invent counts. Persisted previews keep only bounded primitives: no player or import lists, and no provider or DB error text on yahoo.

## Outcomes the tests pin (real wrapper and real guard; only services are mocked)

| Case | yahoo-live-draft | update-drafted-prospects |
| --- | --- | --- |
| Denied | 401 wrong bearer, 405, 503 no secret: no audit row, no DB or provider work | real adminOnly: 401 missing bearer, 401 invalid token, 403 non-admin: no audit row, no rpc or preview |
| Success | 1 row `success`, counters in the preview, inserted before the response is flushed | scheduled write and dry-run: 1 row `success`; one job finish update |
| Failure | DB error: 1 row `failure` (503), no "private details" | import rejects: 1 row `failure` (400); cursor preserved |
| Partial | some polls fail: 1 row `failure` (503) with the true counters 195/130/65 | 1 of 2 imports fails: 1 row `failure`; cursor not advanced; one failed-state update |
| Throw | coordinator rejects: route keeps its fixed 503 body; 1 row `failure`, no provider detail or secret | failed-state write throws: wrapper's 500 path; 1 row `failure`, `error: "Handler failed."` |
| Other | audit insert error: response still flushed once; disabled run after an enabled one adds no second row | admin token admitted; DELETE gives 405 and 1 row `failure`; lease held gives skipped and success |
| No import-time request | a global `fetch` counter is installed before the route graph loads and stays at 0 | same |

Inventory (`cron-audit-wrappers.test.ts`): the prospects route moves off the unresolved list, and shared-wrapper routes go from 17 to 18. `v1/db/update-drafted-prospects.ts` is added to `authFirstAuditRoutes`. A new test confirms the prospects qualification depends on the wrapper. Another pins that yahoo's runtime delegate is still statically `unqualified` (see the held hunk).

## Checks actually run

- `npm test -- __tests__/pages/api/internal/yahoo-live-draft.test.ts __tests__/pages/api/v1/db/update-drafted-prospects.test.ts __tests__/pages/api/v1/db/cron-audit-wrappers.test.ts`: **passed**, 3 files, 65/65.
- Regression check: the two HEAD route files were temporarily swapped back in with the new tests in place, giving **19 failed / 46 passed**. The candidate routes were then restored and verified byte-identical with `cmp`.
- `npx eslint` on the 5 files: **passed** (exit 0).
- `npx tsc --noEmit` (whole project, run once in the background without the heavy lock): **blocked**. Node aborted with a heap OOM (exit 134), so this is not a type result, and I did not retry it.
- Focused type-check: a scratch tsconfig extends `web/tsconfig.json` and lists only the 5 files plus `next-env.d.ts` (with `skipLibCheck`, following their imports). **Passed**: exit 0, 0 errors. `--listFilesOnly` confirms that the 5 files, `withCronJobAudit.ts` and `adminOnlyMiddleware.ts` were in the program.
- Not run: full suite, build, any Next server, any remote/route/cron execution (none needed).

## Held boundary (not edited; needs the owner of `web/lib/cron/cronAuditCoverage.ts`)

`classifyVercelCronSource` reviews audit delegates only for espn-sync, fantrax-sync and patreon-reconcile. So `/api/internal/yahoo-live-draft` stays `auditMode: "unqualified"` in the static inventory, even though it now writes runtime audit rows. That is honest, and no exemption was added. The smallest change that would qualify it: in the `delegatedAudit` expression, accept yahoo when `bespoke` is true and `returnsAuditDelegate(defaultHandler, 7)` matches. Statements 6 and 7 would be pinned by `sourceSignature` to the exact disabled/suspended exits. After that, drop yahoo from `unresolvedAuditRoutes`, change 18 to 19, and flip the pin test. If the owner prefers to audit the disabled/suspended exits as well, the delegate can move to sit right after the 5-statement prefix instead (`returnsAuditDelegate(defaultHandler, 5)`). That costs an audit row every minute.

## Preserved / not done

- Auth helpers, wrapper, classifier, cron config, schedules, provider writers, forecast ingestion and alert rules are untouched.
- starter-board and replay-player-aliases stay unresolved; they are outside C5.
- Live acceptance of audit rows in hosted `cron_job_audit` and cron-report consumption: **unrun**.

Diary: `/Users/tim/Code/fhfhockey.com/tasks/diaries/2026-10-24-claude-c5-cron-audit-coverage.md`.
