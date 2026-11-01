# Top Multi-Cat Stars of the Week: receipt

Post id `multi-cat-stars`, at `/social-share/posts?post=multi-cat-stars`. Registered in `lanes/skaterBoards.ts`.

## Decisions

- **Board:** 4 skaters in a 2 by 2 grid, each panel with a radar beside a one-column last 7 days table. Stacked rows would have left each radar about 200px; this gives about 320 by 292. Three skaters: the last panel takes the whole row. More than four are counted in `evidence.cohort`.
- **Period control (shared `periodWindow`, past-only):** Current fantasy week (default), Matchup week, Custom range. Links naming only `basis` and `formula` open on the default.
- **Fantasy week:** now the `yahoo_matchup_weeks` week holding the cutoff (yesterday in New York), so a Monday post still shows the week just ended. This replaces the first version's Monday to Sunday week from CONTRACT §2: the pager uses the matchup calendar, and a Monday to Sunday default would rank half of a 14-day matchup while calling it the fantasy week. Past the last week it takes the last completed one; before the first it is missing with the reason.
- **Table window:** default keeps the last 7 days ending at the last date read. A chosen matchup or range shows the ranking's dates, captioned SAME DATES, and the legend says so.
- **Radar window:** season through the period's last date, printed on the card. A past card does not move with later games. The skater read stops at that date too.
- **Headline:** "of the Week" only for one matchup of 7 days or fewer, "of the Matchup" for a longer one, plain "Top Multi-Cat Stars" for a custom range with the dates in the legend's first line. Per Game headlines are true over any dates and do not change.
- **Last 7 days:** 7 calendar days ending at the last date read. It contains a normal week so far; in a long matchup a ranked skater can show 0 table GP.
- **Views:** default Period Total (first version: Fantasy Week Total), Standard. Headlines: "Top Multi-Cat Stars of the Week", "Top Multi-Cat Stars Per Game", "Top Points-First Stars of the Week", "Top Points-First Stars Per Game". The ticket set no default; I chose the total because its headline is the post's name and it is not empty early in the week.
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

- `multiCatStars.test.ts`, `bshBoard.test.ts`, `periodWindow.test.ts`: 95 passed, with another session's uncommitted `bshBoard.test.ts` edit (it exempts `panelOnly` date fields) in the working tree.
- `e2e/social-share-multi-cat-stars.spec.ts`: 8 passed in Chromium on fictional data, isolated dev server on port 3117. Adds a past matchup, a 14-day matchup, a custom range, and a landing link naming only the view. Fit at 860px asserted in each.
- eslint on the post's TypeScript files: clean. Pure-selector check: passed; the SCSS did not change.
- `npm run typecheck`: exit 2, one error, the known `lib/player-cards/retainedBlsh.test.ts:134`.

## Not verified

- No real data, including the real calendar. The read is tested with a fake client only. The `plus_minus` null rate this season is unread.
- A real name or stat line wider than the fictional 22 characters is untested.
