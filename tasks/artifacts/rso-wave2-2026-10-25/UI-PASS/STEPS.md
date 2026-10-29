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
- **Commit:** `dc4f705fb`.

## Step 2: quieter empty slots and captions

- **What changed:**
  - **Week grid:** days left of the plan-from slider are muted further: content opacity drops from .4 to .3, and the position tint behind those cells is dropped, so the planned days carry the colour. The dashed "Empty" boxes are unchanged (TJ: keep them).
  - **Roster rows:** the DROP chip, along with the "no projection" and reserve chips, moves from the name line (where a truncated name hid it) to the second line after team and positions. The chips wrap as one unit. The two-to-five-line ownership caution under DROP becomes a small "?" marker ("!" for widely rostered), with the full sentence in its tooltip and kept as screen-reader text.
- **Files:** `SlotWeekGrid.module.scss`, `RosterPlayerRow.tsx`, `RosterScheduleOptimizer.module.scss`.
- **Checks:**
  - RSO vitest passed: 421 of 421, with no test edits.
  - eslint on the touched tsx: clean.
  - CSS pure check passed on both scss files.
  - Phone roster tab checked at 390 px.
- **Screens:** `screens/step2-grid-before-after.png`, `screens/step2-roster-before-after.png` (manual fixture with projections).
- **TJ verdict:** approved 2026-10-29 with one edit: keep the "Empty" boxes with their dotted borders. The faint unlabeled slots were reverted.
- **Commit:** `e982e1968`.

## Step 3: roster summary

- **What changed:**
  - **Stat cards:** the three week-summary cards (Active games, Bench games, Projected points or Category outcomes) are compact. Text is left-aligned, the value is 15 px, and the detail and note are each one line, with the full text in a tooltip (and still in the DOM). Each card keeps its 1 px band outline, 10 px radius and 4 px accent, as the e2e "Release C" contract pins them.
  - **Footer row:** the goalie-starts chip moves from its own row above the cards into one footer row below them, beside the lineup comparison. The comparison is borderless there and moves just outside the "Plan summary" region; the unit tests pin no comparison text.
  - **Height:** about 250 px down to about 165 px in the desktop roster column. On the phone, the old cards stretched to a tall empty height; they are now compact.
- **Files:** `RosterScheduleOptimizer.tsx`, `RosterScheduleOptimizer.module.scss`.
- **Checks:**
  - RSO vitest passed: 421 of 421, with no test edits.
  - eslint: 0 errors. The 6 exhaustive-deps warnings were already there.
  - CSS pure check passed.
- **Screens:** `screens/step3-summary-before-after.png`, `screens/step3-phone-before-after.png`.
- **TJ verdict:** approved 2026-10-29.
- **Commit:** pending.
