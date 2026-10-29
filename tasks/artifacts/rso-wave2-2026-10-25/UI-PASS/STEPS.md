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
- **Commit:** `da62093c2`.

## Step 4: Best Fit toolbar

- **What changed:**
  - **Confirm bar:** the "Confirm planning inputs to enable Preview swap" prompt is a slim one-line bar with the reason on the left and a compact button on the right. It is sticky at the top of the Best Fit column, so it stays in view while you scroll the cards whose Preview swap it unlocks.
  - **Toolbar:** sort ("By projected points" / "By more starts") is a segmented control, and "Find & filter" sits on the same row. When opened, the filter takes the full row below.
  - **Status slot:** goalie-first notes, "Rankings appear once…", loading and error lines now share one quiet slot below the toolbar (12 px, muted).
  - **Unchanged:** labels, roles, ids and behaviour. The cards start about 90 px higher.
- **Files:** `CandidateBrowser.tsx`, `RosterScheduleOptimizer.module.scss`.
- **Checks:**
  - RSO vitest passed: 421 of 421, with no test edits.
  - eslint on `CandidateBrowser.tsx`: clean.
  - CSS pure check passed.
  - On phones (under 640 px) the toolbar buttons keep their 44 px touch height.
- **Screens:** `screens/step4-bestfit-before-after.png`, `screens/step4-phone-before-after.png`.
- **TJ verdict:** approved 2026-10-29.
- **Commit:** `f4e96126a`.

## Step 5: one type, colour and radius scale

- **What changed:**
  - **New scale partial:** `_scale.scss`, built on `styles/vars` tokens. It holds six sizes (10, 11, 12, 14, 16, 20 px), two weights (400, 700), three radii (small = `$radius-control` 6 px, card = `$radius-card` 10 px, round) and eight text-colour roles (ink, muted, strong, accent, on-accent, good, warn, bad).
  - **Stylesheets mapped onto it:** all nine RSO `.module.scss` files now take their font sizes, weights, radii and text colours from the scale.
    - Sizes: 9 → 10, 13 → 12, 15 → 16 (grid point badges → 14 so names keep their room), 18–23 → 20, and the 12/14/20/24 px tokens map to their nearest step.
    - Weights: 500 → 400, and 600/800/900 → 700.
    - Radii: 2–5 px and `$radius-xs` → small, 8 px pills → round, `$radius-md` → card.
    - Colours: gold, neutral-400, danger and background-dark text → the matching role.
  - **Inherited text:** the workspace base size is 14 px, the panel-body step, instead of the page's 16 px. A `<small>` with no size of its own gets 11 px instead of the browser's relative "smaller", which produced 11.67 and 9.17 px.
  - **Phone fix:** on narrow screens, the command bar's status row hides when it has nothing to show. In manual mode it had left a blank band about 40 px tall (a step 1 leftover).
- **Measured** (rendered text inside the workspace, manual fixture, 1600 px):

  | | Before | After |
  | --- | --- | --- |
  | Size/weight combos | 24 | 11 |
  | Text colours | 11 | 8 |
  | Corner radii | 6 | 3 (6 px, 10 px, round) |

- **Files:** `_scale.scss` (new) and the nine RSO `*.module.scss` files.
- **Checks:**
  - RSO vitest passed: 421 of 421.
  - CSS pure check passed on all nine.
  - The e2e Plan-summary contract (10 px card radius, 1 px outline, 4 px accent) is kept.
- **Screens:** `screens/step5-desktop-before-after.png`, `screens/step5-phone-before-after.png`.
- **TJ verdict:** approved 2026-10-29.
- **Commit:** `7499af689`.

## Step 6: slimmer top-five team strip

- **What changed:** the five team cards keep their content (team band, every day with its opponent logo and off-night highlight, Score, GP and OFF) in about half the height:
  - day boxes are 18 px tall and opponent logos 16 px;
  - Score, GP and OFF are inline label-value pairs, with Score still above GP (the e2e pins that);
  - the team band is 18 px wide;
  - on desktop the summary row is 24 px tall; on phones it keeps its 44 px touch height.
- **Height:** the desktop strip goes from about 118 px to about 75 px, which gives about 40 px back to the three columns.
- **Seven days (TJ asked):** a full week fits on desktop. On phones (≤1100 px) each card keeps a 280 px minimum, so seven weekday labels don't collide and the cards scroll sideways as before.
- **Files:** `TeamScheduleContext.module.scss`.
- **Checks:**
  - RSO vitest passed: 421 of 421.
  - CSS pure check passed.
  - The e2e `expectTeamCards` invariants hold: 5 cards, vertical band, score above GP, logos, off-night background.
- **Screens:** `screens/step6-strip-before-after.png`, `screens/step6-strip-7day-before-after.png`, `screens/step6-desktop-after.png`.
- **TJ verdict:** approved 2026-10-29 after a 7-day check.
- **Commit:** `25f44e002`.

## Step 7: DROP chip contrast (from the accessibility check)

- **What changed:** the DROP chip text is dark (`$on-accent`) on the same coral, so contrast goes from 2.78:1 to 6.76:1. The old value predated this pass and failed AA.
- **Files:** `RosterScheduleOptimizer.module.scss`.
- **Checks:** CSS pure check passed; contrast measured in the fixture page.
- **Screens:** `screens/step7-drop-chip-before-after.png`.
- **TJ verdict:** approved 2026-10-29.
- **Commit:** `c368c679e`.

## Wrap-up checks

- **Type-check:** `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit` under `/private/tmp/fhfh-heavy.lock` passed (exit 0, no errors). It ran after step 6; step 7 only touched scss.
- **Unit tests:** RSO vitest passed 421 of 421 after every step, with no test edits in any step.
- **Accessibility:** see `A11Y-2026-10-29.md`.
- **Not run:** Playwright e2e specs. The capture scripts used the same fixtures, but the specs themselves did not run.
- **Not done:** no push, deploy or production access.

## Step 8: Streaming plan starts collapsed on desktop (design review)

- **What changed:** `StreamingItinerary` takes a `defaultOpen` prop. RSO passes `!desktop`, so on screens wider than 1100 px the plan opens collapsed and the week grid is visible without scrolling. Phones still open it. The manager's last toggle is remembered in this browser and wins, both "open" and "closed" (before, only "closed" was restored).
- **Files:** `StreamingItinerary.tsx`, `RosterScheduleOptimizer.tsx`, `__tests__/…/StreamingItinerary.test.tsx` (one new test).
- **Checks:**
  - RSO vitest passed: 422 of 422 (one test added).
  - eslint: clean.
  - No e2e spec depends on the plan being open.
- **Screens:** `screens/step8-streaming-collapsed-before-after.png`.
- **TJ verdict:** approved 2026-10-29.
- **Commit:** `ab4f9987e`.

## Step 9: one-line "No drop suggested" notice (design review)

- **What changed:** a single long reason (over 90 characters, such as the coverage and goalie-minimum detail) now folds into the same one-line disclosure that 3+ blockers already used: "No drop suggested: projected points are unknown", with the reason one click away. Short reasons stay inline. The summary for 3+ blockers is unchanged, as the e2e pins it.
- **Not done on purpose:** a single confirm button. The 10-29 decision (pinned in the unit tests) offers "Confirm planning inputs" both where swaps wait and where the streaming plan waits. On phones the Streaming plan's button is the only one in the Itinerary tab. Step 8 already hides that copy on desktop by collapsing the plan.
- **Files:** `RosterScheduleOptimizer.tsx`.
- **Checks:**
  - RSO vitest passed: 422 of 422.
  - eslint: 0 errors.
- **Screens:** `screens/step9-drop-notice-before-after.png`.
- **TJ verdict:** approved 2026-10-29.
- **Commit:** `64ac85ad1`.

## Step 10: small copy and phone fix (design review)

- **What changed:**
  - **Strip summary:** reads "Top five team schedules · Oct 7–Oct 11"; the redundant "· Team context" is gone.
  - **Best Fit card labels:** sentence case ("Net Pts / Net AGP") instead of all caps.
  - **Phones:** the command bar's search box shrinks first, so in manual mode ☰ shares the search row instead of taking a row of its own (about 40 px saved).
- **Changed from the review:** the review suggested "Net starts" for AGP. AGP is the page's term in the roster columns, the Streaming plan and the tooltips, and tests pin "Net AGP", so renaming only the cards would make the terms inconsistent. A page-wide AGP → "starts" rename is a separate copy task.
- **Files:** `TeamScheduleContext.tsx`, `CandidateCard.module.scss`, `RosterScheduleOptimizer.module.scss`.
- **Checks:**
  - RSO vitest passed: 422 of 422.
  - eslint: clean.
  - CSS pure check passed.
- **Screens:** `screens/step10-copy-phone-before-after.png`.
- **TJ verdict:** approved 2026-10-29.
- **Commit:** pending.
