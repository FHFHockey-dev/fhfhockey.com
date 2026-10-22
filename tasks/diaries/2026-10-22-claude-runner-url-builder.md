# 2026-10-22 claude: /db/runner URL builder and restyle

## Scope
TJ: give `/db/runner` controls for every option each allowed route takes (runMode, start/end dates,
overwrite, dataset filters, etc.) so URLs can be pieced together; restyle the page per
`tasks/TASKS/rules/fhfh-styles.md` and `brand-style-cheat-sheet.md`, borrowing from the RSO workspace.
Local change on octoberBranch; a release (R22) only with TJ's approval.

## Where
- New: `web/lib/routeRunner/options.ts` (+ test), `web/styles/RouteRunner.module.scss`.
- Rewritten: `web/pages/db/runner.tsx` (MUI removed; same API calls and polling).

## Decisions
- The URL field stays the single source of truth; each control reads its value from the URL and
  writes back one param, so pasted URLs and the builder stay in sync.
- Left out on purpose: runner-owned params (deadlineAt, maxRuntimeMs, cursor, continueDailyWindow,
  disableRuntimeBudget), rolling fullRefresh/fullRefreshMode (table truncation) and autoResume*,
  NST requestIntervalMs (pacing), WGO all_seasons_full_refresh and playerId debug modes.

## State
- Option inventory read from each handler (octoberBranch; params match master).
- Built and committed on octoberBranch (not pushed, not released). Checks: options test 6/6,
  runner page test 4/4, lib/routeRunner + __tests__/pages/db 78/78, eslint clean, tsc 0, CSS pure-mode
  check ok. Visual check: isolated `next dev -p 3110` + throwaway Playwright script with a faked admin
  session and fixture jobs (all Supabase calls intercepted); desktop 1440 and mobile 390 screenshots
  in the session scratchpad. Dev server stopped.

- Commits `1cf7bf424` (builder + restyle) and `964ac2aee` (TJ: no edge-to-edge; `$page-max-width: 90%`
  token in vars.scss, runner workspace centred, own canvas removed).

## Next
- TJ decides on R22 (this page alone on master `99c9e56b7`): gate, push, smoke, octoberBranch sync.

## Gotchas
- 2026-10-22 14:02Z: TJ's console backfill stopped at 208/240 on a 500 "NST explicit progress read is
  unconfirmed" (cron_job_audit JSON-path read failed; 0 NST requests, 0 rows). Rerun resumes at 208.
