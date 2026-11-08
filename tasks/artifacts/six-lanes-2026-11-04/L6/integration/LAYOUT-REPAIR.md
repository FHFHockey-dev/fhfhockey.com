# One bounded layout repair — ready for Chef rerun

Current integration blocker is **actual populated dashboard overflow**, superseding this worker's historical Chromium-launch restriction. Chef successfully launched canonical Chromium and loaded the page with offline fixtures on port 3187. At 1280×800, all coverage IDs stayed inside the viewport, but the unchanged overflow assertion failed. Twelve subsequent cases did not run. Chef's page-error list was empty; blocked-resource console messages remain in its evidence.

Evidence read: `/Users/tim/Documents/Codex/2026-11-04/task-7/wigo-runtime-check/canonical-browser/{RESULT.json,browser.log}` and actual `results/wigo-one-page-every-WiGO-component-fits-one-1280×800-screen/test-failed-1.png`. Screenshot visually inspected in this worker. All nine source files matched the prior installed pins before repair.

## Repair applied

Changed **only `web/styles/wigoCharts.module.scss`**, within existing exact custody:

- Allocate 32px more to the schedule/consistency/percentile/driver row: 156→188px, 178→210px in the larger tier. The secondary trend row keeps its existing 130px/170px floor and absorbs the available-height difference. This provides room for the driver label that wraps to two lines and partial-coverage notes without reducing fonts or suppressing content.
- C05's two three-column pace tables: give Metric 36% and both value columns 32%, normalize cell padding, and allow header text to wrap inside cells. The actual failure showed Metric/Per-GP/Pace headers overflowing their fixed widths, not missing data. Scoped coverage selectors intentionally override child-module column widths without editing that child file or matching hashed class names.
- C06 schedule: use natural table height instead of 100% height. The visible table caption is outside the table's content height, so the old 100%-height table overran its enclosing panel. All ten games and caption remain.
- C16/C17/C18: keep title and reset/view/help controls in the first header row, with the full legend on a separate full-width second row. Allow legend wrapping. This removes the measured collision between title, long inline legend and controls. No series or legend entry is removed.

Dark palette, asymmetric focal plot, bottom horizontal matrix, existing complete consistency doughnut, all nineteen panels, labels/fonts, controls, source calculations/data and every test assertion remain intact. No `overflow: hidden`, scroll allowance or font-size reduction was added. No shared child-component/global-layout edits or new dependencies.

## Exact handoff and limits

- Repair-only patch: `bounded-layout-repair.patch` against the pre-repair installed page style.
- Full current five-file patch: `canonical-with-layout-repair.patch` against the original baseline.
- Nine exact current/pre-repair pins: `REPAIR-PINS.json`; only page style changed in this repair.
- Prior page style retained as `pre-repair-wigoCharts.module.scss`.

**No compilation, lint, tests, server or browser run after repair**, as instructed while Luna has priority on the shared heavy resource. This is the one authorized application repair attempt, ready for Chef's unchanged offline browser assertions and screenshots after resource release. Earlier 26 canonical units, seven synthetic rating tests and 38 rating-component browser checks remain dated evidence for unchanged behavior, not proof that this new layout fits.

Tradeoff: full legends now consume a second header line and the context row is taller, leaving less height for secondary plots. Only the actual browser rerun can establish honest fit at all existing target sizes and partial-coverage/long-name states. If those assertions still fail, return the concrete height/width constraint to Chef instead of weakening checks, hiding content or editing outside custody.
