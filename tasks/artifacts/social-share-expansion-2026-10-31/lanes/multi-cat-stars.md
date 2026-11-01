# Top Multi-Cat Stars of the Week: receipt

Post id `multi-cat-stars`, at `/social-share/posts?post=multi-cat-stars`. Registered in `lanes/skaterBoards.ts`.

## Decisions

- **Board:** 4 skaters in a 2 by 2 grid, each panel with a radar beside a one-column last 7 days table. Stacked rows would have left each radar about 200px; this gives about 320 by 292. Three skaters: the last panel takes the whole row. More than four are counted in `evidence.cohort`.
- **Fantasy week:** CONTRACT §2 for skater posts, Monday to Sunday through `calendarWeekStart`, not `yahoo_matchup_weeks`. It is the week holding the cutoff (yesterday in New York), so a Monday post shows the week just ended. The two calendars differ at least in week 1, which `yahoo_matchup_weeks` starts on 2026-09-29. Not compared for other weeks.
- **Last 7 days:** 7 calendar days ending at the cutoff. It always contains the week so far, so a ranked skater always has table games.
- **Views:** default Fantasy Week Total, Standard. Headlines: "Top Multi-Cat Stars of the Week", "Top Multi-Cat Stars Per Game", "Top Points-First Stars of the Week", "Top Points-First Stars Per Game". The ticket set no default; I chose the total because its headline is the post's name and it is not empty early in the week.
- **Min GP:** fixed by the view (2 or none), printed on the card, not a separate field.
- **Ties:** one rule, `competitionRanks` (1, 2, 2, 4), with id ordering display only. A tie past the fourth panel is printed on the card.
- **Missing:** any null component in the week leaves a skater unranked and counted. A null in the table prints an amber `—`. A null radar spoke prints `—` with a dashed marker, the shape does not close, and only neighbouring known spokes join. A season with one null game in a category has no percentile for that category, the same strict rule as `skaterCategoryTotal`.

## Radar: what is reused and what differs from Wigo

Wigo's radar is `CategoryCoverageChart` (Chart.js canvas), fed by `usePercentileRank`, reached from `WigoDashboardSections.tsx`. `WigoCharts.tsx` does not exist; the page is `pages/wigoCharts.tsx`.

- **Reused:** `calculateRankingResult` on per-game averages, higher is better on every spoke including PIM, the same spoke order, colours and 0 to 100 scale.
- **Redrawn:** SVG with attribute colours, for the PNG. Rings every 20 as Wigo; ring colour softened from white so the shape reads at this size.
- **Different source:** Wigo reads the `get_skaters_avg_stats` RPC over `skatersGameStats`, joined on date only, which has no game-type filter. This post reads `wgo_skater_stats`, regular season, per CONTRACT §2. Percentiles can differ slightly from the Wigo page. Not compared on real data.
- **Different missing rule:** SQL `AVG` skips nulls; this post treats a null as a missing category.
- **Cohort:** every skater with 1+ regular-season GP, as Wigo has no minimum. A one-game call-up with a goal scores high on that spoke. Printed on the card with N.

## Reads

`multiCatStars.sources.ts`, SELECT only, server only, with the existing ceilings: `wgo_skater_stats` (appearance columns plus `plus_minus`), `wgo_team_stats` through `readCompletedTeamGames`, `games`. `plus_minus` is not on the shared `SkaterAppearance`, so the post has its own read and did not change a type other lanes' fixtures build on. No NST or Yahoo call.

## Edits outside this post's own files

- `lanes/skaterBoards.ts` (lane B's barrel): one import, one entry, the comment. `registry.ts` is frozen and there is no other skater barrel.
- `bshBoard.test.ts:254`: the barrel's expected id list gained `multi-cat-stars`.

## Checks

- `multiCatStars.test.ts`: 23 passed. All `lib/socialShare/modules` tests: 603 passed in 23 files.
- `e2e/social-share-multi-cat-stars.spec.ts`: 6 passed in Chromium on fictional data, isolated dev server on port 3117. Covers the four views' headline and fit at 860px, a traded skater's longest line, three panels, the empty state, missing values, and a real downloaded PNG: 1080 by 1080, with the radar fill present by pixel count. Fit is measured in the node's own pixels.
- eslint on the post's TypeScript files and the barrel: clean. Pure-selector check: passed.
- `tsc --noEmit` (8 GB heap; the default heap ran out of memory): exit 0 for the whole app, run after the follow-up commit's spec fix. The first commit carried a type error in the spec's `writeFileSync`; the follow-up fixes it.

## Not verified

- No real data: Chef does that render. The `plus_minus` null rate this season is unread, and a real name or stat line wider than the fictional 22 characters is untested.
- The read is tested with a fake client only.
