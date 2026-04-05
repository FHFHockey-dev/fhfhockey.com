# Underlying Stats Copy Tightening

Task: `4.3 Adjust the header and legend copy in web/pages/underlying-stats/index.tsx so the page stays accurate, concise, and operational rather than editorial.`

## What changed

Updated copy in `/Users/tim/Code/fhfhockey.com/web/pages/underlying-stats/index.tsx`:

- shortened the page meta description
- replaced the header paragraph with a compact operational summary
- tightened the snapshot control hint
- renamed the legend trigger from `Metric legend & formulas` to `Metric definitions`
- shortened the Power, Trend, `SoS`, and component-rating legend text
- shortened supporting copy in:
  - `Sub-Ratings Spotlight`
  - `Top teams overview`
  - `Daily power rankings table`

## Intent

The page should explain:

- what the surface is
- what the selected snapshot contains
- what `Trend` and `SoS` mean

without reading like a long methodology panel above the main table.

## Verified vs inferred

Verified:

- The updated wording still matches the shipped implementation:
  - repaired trend from prior played snapshots
  - `SoS` as a 50/50 blend of record/schedule context plus opponent Power Scores
- The copy no longer spends header space on detailed model prose that belongs in deeper documentation.

Implementation choice:

- The legend remains formula-aware, but with compressed phrasing and fewer explanatory clauses.
- The header now favors scope/context over methodology.

## Verification

- Reviewed the final copy diff in `/Users/tim/Code/fhfhockey.com/web/pages/underlying-stats/index.tsx`
- No runtime or unit tests were necessary for this step because it is text-only
