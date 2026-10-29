# RSO UI pass: steps

Declutter in place (see `AUDIT-2026-10-29.md`). One local commit per approved step, explicit pathspecs, no push. Screenshots come from a fictional offline fixture league (Playwright, network isolated) on an isolated dev server at :3160. They show no real league data.

## Step 1: command bar and status messages

- **What changed:**
  - **Context group:** the provider chip, a new compact **↻ Refresh** button and the week range with Current week now sit in one joined control ("League and week"). The Refresh button keeps the accessible name "Refresh provider" and shows "Refreshing…" while busy.
  - **Quiet actions:** Undo and Matchup are borderless text buttons, so **Save to account** is the only filled action.
  - **Toasts:** provider-refresh success, account-save success and action confirmations ("Streaming plan selected…", "Alternative 1 selected…", roster review) leave the status rail. They show as a toast in the bottom-right corner (above the bottom nav on phones), which fades after about 7 seconds and pauses on hover. Errors, busy states and blocked-refresh reasons stay in the rail as before. The live regions keep their ids and roles, and reduced-motion users get the fade without movement.
- **Files:** `RosterScheduleOptimizer.tsx`, `RosterScheduleOptimizer.module.scss`.
- **Checks:**
  - RSO vitest passed: 421 of 421, with no test edits.
  - eslint: 0 errors. The 6 exhaustive-deps warnings were already there.
  - CSS pure check passed.
- **Screens:** `screens/step0-desktop-before.png`, `screens/step1-desktop-after.png`, `screens/step1-bar-before-after.png`, `screens/step1-phone-before-after.png`.
- **TJ verdict:** approved 2026-10-29.
- **Commit:** pending.
