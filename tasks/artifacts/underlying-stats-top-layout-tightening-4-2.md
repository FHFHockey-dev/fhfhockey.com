# Underlying Stats Top-Layout Tightening

Task: `4.2 Tighten the top-of-page layout in web/pages/underlying-stats/indexUS.module.scss so the summary and support modules do not push the table too far below the fold.`

## What changed

Updated `/Users/tim/Code/fhfhockey.com/web/pages/underlying-stats/indexUS.module.scss` to make the page render more like a table-first data surface without changing the page markup:

- reduced page-level and header-panel vertical gaps
- reduced header, control-card, legend, sub-ratings, and summary-card padding
- tightened body-copy line height and support-module text sizing
- compressed sub-ratings cards and summary-card anatomy
- changed visual section order so the main table surfaces earlier:
  - `.tableSection { order: 2; }`
  - `.summarySection { order: 3; }`
  - `.secondaryPanels { order: 4; }`

## Intent

This pass focuses only on SCSS-level layout tightening. It does not:

- change data
- change page copy
- change `/underlying-stats/playerStats`
- overwrite the current working-tree shell-width override (`width: 90%`)

## Verified vs inferred

Verified:

- The current stylesheet now visually prioritizes the table via flex-order rules in the page shell.
- The heaviest pre-table modules have reduced padding and tighter internal spacing.
- The live route still responds on `http://localhost:3003/underlying-stats`.

Inferred:

- Because the visual-order rules and spacing reductions are present in the stylesheet, the rendered page should place the table materially higher in the viewport than the audited `4.1` state.

## Verification limits

- Fresh post-change headless screenshots could not be captured during this step because the Chrome headless invocation flaked after the successful `4.1` audit captures.
- That means this sub-task is verified at the stylesheet/layout-rule level, but not yet re-verified with a fresh desktop/mobile image capture.
- A full rendered confirmation should happen in task `5.3`.
