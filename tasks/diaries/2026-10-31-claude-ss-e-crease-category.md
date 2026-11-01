# SS lane E: Crease Shift and Category Counts (8.0, 9.0)

**Scope:** `creaseShift`, `goaliePeriod`, `goalieGsax`, `shared/categoryCounts.ts`, lane barrel, E2E spec, receipt. TGV and GoalieShareChart stay untouched.

**Where:** `octoberBranch`, canonical checkout, base `7bddeaf0d`. Receipt: `tasks/artifacts/social-share-expansion-2026-10-31/lanes/e-crease-category.md`.

**State:** all subtasks built with tests; real reads logged in the receipt; committing.

**Next:** the lead runs the loaders and the spec, compares them with the receipt's SQL tables, and takes the first real output to TJ (9.7).

**Blockers:** none. Pending: TJ's real-output review.

**Decisions:**
- Rates compare at contract precision through integer half-up rounding, so a binary float cannot break or fake a tie.
- A null stat leaves a baseline's numerator and denominator for that category only; it is never a zero.
- Default month follows the contract, so it is an empty September until October and week 5 finish.

**Gotchas:**
- NST goalie rows can name a different goalie than WGO for the same game (NSH 10-10). GSAx drops and counts them.
- `teamStartShare` gives `share: 0` on an incomplete window; treat it as null.
- zsh does not word-split `$FILES`, so eslint needs the paths spelled out.

## Blocks and rolling line (TJ's second Crease Shift review)

Replaced the running share with per-game starter blocks and a rolling share line (5 games, 3 for L5). Removed RELIEF and GS / GP. Vitest, eslint, tsc on Crease files and the CSS pure check pass; spec lists 10, no browser run. Next: lead's render checks fit and PNG.

## Span 1, full width, PREV N GP (TJ's third Crease Shift review)

Line is now per game (`byGame`), blocks and line reach the chart's edges, legend is one line with the method in evidence, PREV prints its real GP in the header or per team. Next: lead's render checks fit and PNG.

## Running start share (TJ's fourth Crease Shift review)

Line is now `runningShare`: starts so far ÷ team games so far, with TJ's VAN example as a fixture. A no-report game holds flat because SHARE leaves it out. Next: lead's render checks fit and PNG.

## Period ADP (TJ, 2026-11-01)

Removed the TGV league section and added the Avg ADP line. Gotcha: `yahoo_players` holds three seasons and the 192 max is a null-season row; goalie values must filter to the current season. The aliased JSON select has not run through PostgREST here. Next: lead's render.

## Period headline, custom range, season (TJ, 2026-11-01)

ADP ticket committed as 529e8abdb. Added headline, custom range and season by the month rules. Gotcha: `npx tsc --noEmit` runs out of memory at the default heap, and piping it through a filter hides that; use NODE_OPTIONS=--max-old-space-size=12288. Next: lead's render.
