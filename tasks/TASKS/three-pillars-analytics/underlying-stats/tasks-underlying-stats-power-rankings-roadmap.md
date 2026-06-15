## Relevant Files

- `web/pages/underlying-stats/index.tsx` - Main underlying-stats landing page; owns the table shell, help drawer, mode toggle, sorting UI, and row-level presentation.
- `web/pages/underlying-stats/indexUS.module.scss` - Page-specific styling for the table, drawer, mode controls, schedule chips, and drill-down popovers.
- `web/pages/api/underlying-stats/team-ratings.ts` - Server payload for the landing page; should be extended with narratives, schedule texture, and numeric sort fields.
- `web/lib/underlying-stats/teamLandingRatings.ts` - Landing-page data assembly layer that merges core rating inputs with contextual metrics.
- `web/lib/teamRatingsTrend.ts` - Existing trend history helper; relevant for prior-10 baseline comparisons and row sparklines.
- `web/lib/underlying-stats/teamScheduleStrength.ts` - Current SoS helper; likely extension point for future-schedule texture fields beyond a single SoS value.
- `web/lib/power-ratings.ts` - Source-of-truth formulas and weighted component inputs for offense, defense, and pace.
- `web/lib/underlying-stats/teamRatingNarrative.ts` - New helper for server-side “why up / why down” bullets tied to actual rating drivers.
- `web/lib/underlying-stats/teamRatingNarrative.test.ts` - Targeted coverage for narrative priority and baseline fallback behavior.
- `web/lib/underlying-stats/teamLandingRatings.test.ts` - Landing-data coverage for merged narratives, schedule texture, and trend overlays.
- `web/lib/underlying-stats/teamScheduleStrength.test.ts` - Coverage for BCS-style SoS math plus future schedule-texture calculations.
- `web/components/TransactionTrends/OwnershipSparkline.tsx` - Reference sparkline pattern for narrative/context cells that need compact trend visuals.
- `web/__tests__/pages/underlying-stats/index.test.tsx` - Route-level coverage for drawer behavior, mode switches, sorting, and major rendering changes.

### Notes

- The help drawer is already shipped and should remain one click away from the table title.
- Keep the page mental model explicit: `Power Score` explains current team strength, `Trend` explains change versus recent baseline, and context columns explain what may be inflating or suppressing results.
- Separate rank drivers from descriptive context. Do not let PDO, Scoring, or Goaltending explain a rise or fall unless they are clearly labeled as context rather than direct ranking inputs.
- Sort visible labels by hidden numeric values. For example, `Hot/Cold/Normal` must sort by the underlying PDO-derived number, not alphabetically.
- Use the repo’s existing targeted test flow and avoid broad verification when file-scoped tests are sufficient.
- `Pace` remains a first-class ranking driver in the current model, but the UX now treats it as advanced-only context. Recommendation: keep the formula unchanged for now, and revisit only if ranking validation shows pace is overwhelming true team strength.
- PP and PK remain tier bonuses for now because the cutoff model is easy to explain and already baked into `computeTeamPowerScore`. Recommendation: keep the current bonus until a deeper scoring-model pass can swap it for a continuous percentile bonus without changing the historical surface midstream.
- If the model changes later, the main migration work is in `web/lib/power-ratings.ts`, `web/lib/dashboard/teamContext.ts`, and any historical backfill path that materializes `team_power_ratings_daily`.

## Tasks

- [x] 1.0 Keep the page’s “How to read this table” guidance compact and anchored to the table entry point
  - [x] 1.1 Keep the help drawer in `web/pages/underlying-stats/index.tsx` one click away from the table title rather than burying it elsewhere on the page.
  - [x] 1.2 Limit the drawer copy to the three core concepts only: `Power Score`, `Trend`, and the `Scoring / Goaltending / Puck Luck` context layer.
  - [x] 1.3 Preserve the drawer styling and compact footprint in `web/pages/underlying-stats/indexUS.module.scss` so it supports the table instead of competing with it.

- [x] 2.0 Add a server-driven row narrative layer that explains why a team is moving up or down
  - [x] 2.1 Create `web/lib/underlying-stats/teamRatingNarrative.ts` to generate two required bullets plus one optional context bullet from actual rating drivers.
  - [x] 2.2 Compare current `Offense`, `Defense`, `Pace`, and special-teams bonus inputs against each team’s prior 10-snapshot baseline rather than against league-wide averages.
  - [x] 2.3 Use `SoS Future`, `Scoring`, `Goaltending`, or PDO-derived context only as an optional third bullet, and never as the primary explanation for rank movement.
  - [x] 2.4 Extend `web/pages/api/underlying-stats/team-ratings.ts` so each row includes a stable narrative payload for the page to render without client-side recomputation.
  - [x] 2.5 Add targeted tests for positive, negative, and mixed-driver cases so the generated copy stays tied to the actual ranking formula.

- [x] 3.0 Add `Simple` and `Advanced` table modes with client-side sorting built around numeric sort keys
  - [x] 3.1 Add a `Simple` mode in `web/pages/underlying-stats/index.tsx` that shows `Rank`, `Team`, `Power Score`, `Trend`, `SoS Future`, and `Why moving`.
  - [x] 3.2 Keep `Advanced` mode as the fuller analytical surface with component columns, sparklines, and explanatory affordances.
  - [x] 3.3 Build client-side sorting for the visible columns and ensure display labels such as tiers or `Hot/Cold/Normal` sort by hidden numeric values.
  - [x] 3.4 Preserve clear defaults so the page opens in the more approachable mode without removing access to the advanced view.
  - [x] 3.5 Add route-level coverage for mode switching, default presentation, and representative sort interactions.

- [x] 4.0 Extend schedule context beyond a single SoS value so upcoming schedule texture is easier to read
  - [x] 4.1 Define a compact schedule-texture data shape that covers upcoming back-to-backs, rest advantage or disadvantage, home-heavy versus road-heavy stretches, and games in the next 7 and 14 days.
  - [x] 4.2 Extend `web/lib/underlying-stats/teamScheduleStrength.ts` or a closely related helper so these fields are calculated from the same trusted future-schedule inputs as `SoS Future`.
  - [x] 4.3 Attach schedule-texture fields to the landing payload in `web/pages/api/underlying-stats/team-ratings.ts` without bloating the default table scan.
  - [x] 4.4 Surface the most intuitive schedule cues as compact chips or concise helper text so users can understand future difficulty without decoding raw schedule math.

- [x] 5.0 Add drill-down popovers for major metrics so advanced users can inspect formulas without cluttering the main table
  - [x] 5.1 Add popovers for the primary rating components that show raw inputs, weights, current values, league baselines or z-scores, and whether higher or lower is better.
  - [x] 5.2 Use `web/lib/power-ratings.ts` as the source-of-truth for offense, defense, and pace inputs so the popovers match the real ranking model.
  - [x] 5.3 Ensure popovers help users audit the math for context metrics such as `Scoring`, `Goaltending`, and `Puck Luck` without implying they are equal ranking drivers.
  - [x] 5.4 Add focused interaction coverage for popover rendering and accessibility on both desktop and mobile layouts.

- [x] 6.0 Audit the two remaining model-design questions before deeper ranking changes are made
  - [x] 6.1 Review whether `Pace` should remain a full peer of `Offense` and `Defense` in the `Power Score` formula or be reduced to a smaller modifier or context dimension.
  - [x] 6.2 Review whether PP and PK should continue to influence the rankings through discrete tier bonuses or move to a smoother continuous percentile-based bonus.
  - [x] 6.3 Document the recommendation, the expected UX impact, and any migration work needed before changing the live score formula.
