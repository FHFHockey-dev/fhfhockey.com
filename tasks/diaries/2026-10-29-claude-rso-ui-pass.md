# RSO UI declutter pass (Claude, 2026-10-29)

## Scope
Presentation-only declutter of RSO per `tasks/artifacts/rso-wave2-2026-10-25/UI-PASS/AUDIT-2026-10-29.md`. Six steps, one local commit each after TJ approves before/after screenshots. Lease `RSO-UI-PASS`.

## Where
- Branch `octoberBranch`, shared checkout. Explicit pathspec commits only, no push.
- Steps log: `tasks/artifacts/rso-wave2-2026-10-25/UI-PASS/STEPS.md`.
- Screenshots: fictional offline fixtures via Playwright against an isolated dev server on :3160 (`PLAYWRIGHT_ISOLATED_NEXT=1`, `.next-playwright`). Capture script in scratchpad.

## State
- 2026-10-29: lease baselines verified (51/51 match). Main JSX is `RosterScheduleOptimizer.tsx` ~L1148–1234.
- Step 1 dc4f705fb, step 2 e982e1968 (TJ kept "Empty" boxes), step 3 da62093c2, step 4 f4e96126a, step 5 7499af689, step 6 25f44e002 (TJ checked 7-day strip), step 7 c368c679e (DROP chip contrast from a11y check). All approved by TJ pop-up. Each: RSO vitest 421/421 with no test edits, eslint 0 errors, pure check.
- Final: tsc --noEmit under heavy lock passed (exit 0). A11y notes: UI-PASS/A11Y-2026-10-29.md. Dev server :3160 stopped. Nothing pushed.

## Next
Done. Orchestrator relays to TJ/release; e2e specs not run (rso-acceptance/roster-schedule-optimizer specs touch moved markup: refresh button text "Refresh"/"Refreshing…", toasts fade after ~7s).

## Blockers / approvals
- Each step needs TJ's pop-up approval before commit.

## Gotchas
- Capture script: scratchpad `cap/capture.spec.ts` (CAP_MODE=manual gives projections; forecasts must be for games on/after the clock date). HMR needs a few seconds after scss edits before capturing.
- e2e pins the Plan summary article borders (Release C contract): keep 1px outline, 10px radius, 4px ::before accent.
- zsh: use arrays for pathspec lists.
- Fixture helpers: `web/e2e/fixtures/rso-continuity`, `web/e2e/roster-schedule-optimizer-fixtures.ts`, `web/e2e/fixtures/rso-acceptance` (top-five strip).
