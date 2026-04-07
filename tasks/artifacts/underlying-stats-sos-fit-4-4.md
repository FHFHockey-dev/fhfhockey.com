# Underlying Stats SoS Table Fit Check

Task: `4.4 Ensure the added SoS column still fits within the table layout on desktop and remains usable in the current mobile/tablet responsive behavior.`

## What changed

Adjusted the table-density rules in `/Users/tim/Code/fhfhockey.com/web/pages/underlying-stats/indexUS.module.scss` to absorb the added `SoS` column more cleanly:

- reduced table minimum width:
  - `1120px -> 1080px`
- reduced header/body cell padding:
  - desktop: `0.75rem 0.8rem -> 0.7rem 0.72rem`
  - tablet: `0.65rem 0.7rem -> 0.58rem 0.6rem`
- reduced `rankCell` width:
  - `56px -> 52px`
- tightened badge widths:
  - `.componentBadge`
  - `.sosPill`
  - `.tierBadge`

## Why

The `SoS` column itself is compact, but once added to an already dense grid it increases horizontal pressure on:

- the initial mobile viewport
- tablet horizontal scroll cost
- desktop table breathing room when the page shell is narrower than full-width

These adjustments preserve the existing table structure while slightly lowering the width budget for every row.

## Verified vs inferred

Verified:

- Updated mobile screenshot from `http://localhost:3003/underlying-stats` shows the leading columns clearly visible together:
  - `#`
  - `Team`
  - `Power`
  - `SoS`
  - `Off`
- The table remains horizontally scrollable for the wider metric set, which preserves current mobile behavior rather than forcing a broken wrap.

Inferred:

- Desktop should comfortably fit the adjusted table because the page shell is much wider than the new `1080px` table minimum and the column-density budget is smaller than before.
- A fresh desktop screenshot was not captured in this step, so the desktop fit conclusion is based on the updated width budget and stylesheet review rather than a new post-change image capture.

## Verification

- Mobile screenshot captured at:
  - `/tmp/underlying-stats-3003-mobile.png`
- Reviewed final table-density diff in:
  - `/Users/tim/Code/fhfhockey.com/web/pages/underlying-stats/indexUS.module.scss`
