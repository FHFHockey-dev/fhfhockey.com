# 2026-10-22 claude route runner

## Scope
Server-side long-run route runner: paste an allowlisted route URL on `/db/runner`, a pg_cron-driven
tick (`/api/v1/db/route-runner-tick`) runs it step by step following each route's resume contract.
Draft SQL only (no migration applied, no cron applied, no production calls, no push).

## Where
- Branch `octoberBranch` (shared checkout; commit own files only, explicit pathspecs; no stash/reset/checkout).
- Files: `web/lib/routeRunner/**`, `web/pages/api/v1/db/route-runner-tick.ts`,
  `web/pages/api/v1/db/route-runner/**`, `web/pages/db/runner.tsx`, `web/pages/db/index.tsx` (link),
  `web/components/Admin/adminRoutePath.ts` (+ CronRouteRunner re-export),
  `tasks/artifacts/route-runner/route_runner_tables.sql`, cron-schedule.md new section.

## State
- 10-22 start: read AGENTS.md, CronRouteRunner, adminOnly, pipeline invoke pattern, NST gamelog
  (207 continuation_required / 503 source_down), rolling route (resumeFrom, maxRuntimeMs, deadlineAt),
  team-daily (`complete:false` + `nextStartDate`), nst-goalies (`stoppedEarly` + `nextStartDate`).

## Decisions
- Registry split: `registry.ts` (client-safe metadata; the page imports it) + `handlers.ts`
  (server-only static handler imports) so the page bundle never pulls route handlers.
- Added a fourth contract `next_start_date` (team-daily, nst-goalies): reading the routes showed a
  resume contract. Flag in report (table check constraint includes it).
- Concurrency 1 via conditional claim + post-claim "any other unexpired lease" check (release on
  conflict); no SQL function needed.
- Tick wrapped `adminOnly(withCronJobAudit(...))` with a small preview and recordRowMetrics=false
  (inner routes audit their own rows).

## Added scope (coordinator, mid-task)
Gate every /db page with a shared `components/Admin/AdminPageGate.tsx` (loading / "Authorization
prohibited: administrator access required" / children), inner-component split so no admin fetch runs
before the gate; index.tsx swaps its inline gate; list API routes those pages call that are not
adminOnly. Gotcha: AuthProvider sets isLoading=false before the role query resolves, so an admin
briefly reads as non-admin (same as index.tsx today; context not in my files).

## Checkpoint (written)
SQL draft, registry/core/store/tick (+ memoryStore.testHelper), tick route, jobs API, /db/runner page,
AdminPageGate + 7 /db pages wrapped, cron-schedule.md proposed section. Handler map lives in the tick
route (relative imports, `satisfies Record<RouteRunnerPath, RouteHandler>`), not a lib module.
Checks: vitest lib/cron + __tests__/pages/api/v1/db + components/Admin + lib/routeRunner +
__tests__/pages/db: 1335 pass, 7 fail in files I did not touch (projection-materialization-auth
update-PbP source assertion; update-team-ctpi-daily.test.ts modified by another session). eslint on
changed files: 0 errors, 1 pre-existing warning (player-aliases loadData deps). No .module.scss added.
- API routes called by /db pages: all adminOnly (or playerForecast* admin middlewares); aliases and
  forecast conflicts also accept a signed per-item reviewToken. Gating the pages blocks signed-out
  emailed review links (send-player-name-alias-review, send-conflict-review): flag for TJ.

tsc --noEmit under the heavy lock: exit 0.

## Next
Committed: route runner `87dcbd984`, /db gate `716896be8`, admin-flash + review-token links `38749d503`.
R21 candidate `99c9e56b7` (those three on master `248df9923`) gated: vitest baseline-only, eslint
clean, tsc 0; the master copy drops the tick's `responsePreviewKeys` (master's `withCronJobAudit`
lacks it). Open, needs TJ: file and apply the draft SQL as migration 98, push R21, then schedule the
`route-runner-tick` pg_cron job and update the cron inventory/tests. Optionally add the tick's
handler map to the CRON_AUTH_NON_CRON_CALLERS manifest. Keep this diary until those land.

## Gotchas
- NST HTTP body carries no row count (only the audit row); runner counts `rows_persisted` sources.
- Rolling 207 partial has `success:false`; contract continuation must be checked before success.
- cronAuditCoverage caller manifest is not auto-scanned; runner handlers are a new internal caller.
