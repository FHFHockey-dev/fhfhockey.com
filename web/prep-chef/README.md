# Prep Chef — user-facing page audit

## Working agreement

Finish and improve existing experiences before proposing new tools. Work one page at a time: inspect the page and its immediate UI, summarize its purpose, discuss it with the owner, refine recommendations, record decisions, and prepare a separate `/plan` handoff. No application implementation or deployment is part of this audit.

Status progression: Not audited → Discussion started → Follow-up needed → Ready for plan → Handed off. A page may instead be Closed — retain as-is when the owner requests no changes; this requires no implementation task list. A scaffold is not a completed audit. Do not mark a page Ready for plan until its purpose, audience, approved scope, and measurable acceptance criteria are established and material ambiguities are resolved.

Use one record per route template, not per individual player, team, game, or article. Filenames preserve route spelling and join nested segments with `--`; dynamic parameters retain their names without brackets. Tabs, modal tools, query-driven views, and access states belong in the parent page record. Redirects retain a record documenting their destination and proposed disposition. Hidden does not automatically mean obsolete.

Exclude API routes, framework wrappers, styles, scripts, and backend implementation. Apparent internal administration routes are listed separately below rather than silently omitted. Testing/placeholder pages remain candidates until inspection determines whether they contain a user-facing idea worth completing. Navigation visibility reflects only NavbarItemsData.ts, not a complete link or access audit.

## Sequence

1. Establish the primary audience, core fantasy decisions, and a reference experience for consistency.
2. Homepage and shared navigation, then follow the user's primary journey through existing tools.
3. Review related detail pages immediately after their parent tool; cover remaining visible pages, hidden pages, and unfinished alternatives.
4. Review account/authentication and recovery experiences, content, and the 404 page.
5. Resolve overlap between pages and reconcile shared decisions before handing off conflicting plans.

The actual order after Home remains open to the owner's priorities. This inventory is a coverage checklist, not an implementation priority ranking.

## Shared decisions

Confirmed with the owner:

- **Audience:** the average fantasy GM. Offer advanced statistics for interested users without alienating the average GM.
- **UI references:** Home (`web/pages/index.tsx`) and Draft Dashboard (`web/pages/draft-dashboard.tsx`).
- **Homepage role:** high-level information before decision-making: today's games, market adds/drops, standings and rising/falling teams, injuries, and recent transactions.
- **Homepage disposition:** preserve purpose/content; later owner feedback identifies two exceptions: duplicate Slate links and mobile standings-selector layout. See home.md.
- **Navigation:** global NavBar overhaul is open for discussion on desktop and mobile; MobileMenu needs fine tuning. Prioritize Game Grid, Stats, Underlying Stats, and eventually Start Chart after improvements. See [shared-navigation.md](shared-navigation.md).

Still to establish as relevant pages are discussed:

- League/scoring formats to prioritize.
- Main visitor jobs and what success looks like for each.
- Specific conventions to take from Home and Draft Dashboard; leave room for different page tasks.
- Navigation labels, hierarchy, player/team links, filter behavior, table conventions, metric definitions, and mobile priorities.
- Trust requirements: visible freshness, sources, definitions, forecast uncertainty, and evidence of accuracy where relevant.
- What is free, signed-in, or paid; recovery paths when access or data is unavailable.
- Seasonal priorities, scope limits, and the meaning of done.
- Disposition per page: finish, improve, merge, retain, or retire. No removal without an explicit decision.

## Initial questions

1. Who should we serve first, and which fantasy decision should FHFH help them make especially well?
2. Which existing page feels closest to your vision, and what do you like about it?
3. Should the homepage primarily help returning managers act today, introduce newcomers to the tools, or showcase the podcast/community? Which comes first, and does that change by season?

Owner responses:

1. “The Average fantasy GM. With options for the advance user who is interested in high-level statistics, without ostracizing the Average GM.” No single site-wide fantasy decision has been selected; determine each tool's job during its audit.
2. Home and Draft Dashboard. Specific qualities to carry across pages remain to be articulated.
3. Confirmed the high-level overview, with the refinement that visitors are not making decisions yet. Owner is very happy with Home and requests no changes. Better navigation is the only improvement opportunity raised.

## Next discussion — shared navigation

Owner responses:

1. Global NavBar needs attention, potentially an overhaul. Slate duplicates Starter Board, Game Grid, Trends, and Underlying Stats links.
2. Prioritize Game Grid, eventually Start Chart (needs work), Stats, and Underlying Stats. Do not hide Underlying Stats merely because its subject is advanced.
3. Both desktop and mobile. Specifically reorganize the mobile standings team selector and workshop MobileMenu with a generated mockup.

Latest decisions: keep Slate right-hand Quick Links; replace the bottom row with the owner-confirmed Stats · Lines · News · Shift Chart, in that order. Mobile concept direction accepted with increased density. Standings selector confirmed: each division two columns by four rows, division groups two-by-two on narrow phones and four across where space permits. Homepage scope is ready for planning. Shared navigation still needs mobile-density refinement and desktop design discussion. Detailed Q&A and handoff are in [shared-navigation.md](shared-navigation.md); homepage-specific exceptions are in [home.md](home.md). Application implementation remains outside this audit.

## Coverage

68 candidate page records; 7 apparent internal routes excluded from the user-facing queue pending contrary evidence. Inventory reflects the working tree at audit setup.

| Route | Record | Status |
| --- | --- | --- |
| `/404` | [404.md](404.md) | Not audited |
| `/FORGE` | [FORGE.md](FORGE.md) | Not audited |
| `/account` | [account.md](account.md) | Not audited |
| `/auth/callback` | [auth--callback.md](auth--callback.md) | Not audited |
| `/auth` | [auth.md](auth.md) | Not audited |
| `/auth/reset-password` | [auth--reset-password.md](auth--reset-password.md) | Not audited |
| `/blog/[slug]` | [blog--slug.md](blog--slug.md) | Not audited |
| `/blog` | [blog.md](blog.md) | Not audited |
| `/blog/substack/[slug]` | [blog--substack--slug.md](blog--substack--slug.md) | Not audited |
| `/buyLowSellHigh` | [buyLowSellHigh.md](buyLowSellHigh.md) | Not audited |
| `/charts` | [charts.md](charts.md) | Not audited |
| `/community-draft-rankings` | [community-draft-rankings.md](community-draft-rankings.md) | Not audited |
| `/cssTestingGrounds` | [cssTestingGrounds.md](cssTestingGrounds.md) | Not audited |
| `/draft-dashboard` | [draft-dashboard.md](draft-dashboard.md) | Not audited |
| `/draft-pro/policies` | [draft-pro--policies.md](draft-pro--policies.md) | Not audited |
| `/draft-rankings` | [draft-rankings.md](draft-rankings.md) | Not audited |
| `/drm` | [drm.md](drm.md) | Not audited |
| `/fantasy-projections` | [fantasy-projections.md](fantasy-projections.md) | Not audited |
| `/forge/command-center` | [forge--command-center.md](forge--command-center.md) | Not audited |
| `/forge/dashboard` | [forge--dashboard.md](forge--dashboard.md) | Not audited |
| `/forge/player/[playerId]` | [forge--player--playerId.md](forge--player--playerId.md) | Not audited |
| `/forge/team/[teamId]` | [forge--team--teamId.md](forge--team--teamId.md) | Not audited |
| `/game/[gameId]` | [game--gameId.md](game--gameId.md) | Not audited |
| `/game-grid/[mode]` | [game-grid--mode.md](game-grid--mode.md) | Discussion started |
| `/game-grid/dateRange` | [game-grid--dateRange.md](game-grid--dateRange.md) | Not audited |
| `/game-grid` | [game-grid.md](game-grid.md) | Redirect inspected; discussion in mode record |
| `/goalies` | [goalies.md](goalies.md) | Not audited |
| `/` | [home.md](home.md) | Ready for plan — two scoped improvements |
| `/lines/[abbreviation]` | [lines--abbreviation.md](lines--abbreviation.md) | Not audited |
| `/lines` | [lines.md](lines.md) | Not audited |
| `/lines/line-combo/[gameId]` | [lines--line-combo--gameId.md](lines--line-combo--gameId.md) | Not audited |
| `/news` | [news.md](news.md) | Not audited |
| `/nhl-predictions` | [nhl-predictions.md](nhl-predictions.md) | Not audited |
| `/player-forecasts` | [player-forecasts.md](player-forecasts.md) | Not audited |
| `/podfeed` | [podfeed.md](podfeed.md) | Not audited |
| `/projections` | [projections.md](projections.md) | Not audited |
| `/rankings` | [rankings.md](rankings.md) | Not audited |
| `/roster-schedule-optimizer` | [roster-schedule-optimizer.md](roster-schedule-optimizer.md) | Not audited |
| `/shiftChart` | [shiftChart.md](shiftChart.md) | Not audited |
| `/skoCharts` | [skoCharts.md](skoCharts.md) | Not audited |
| `/splits` | [splits.md](splits.md) | Not audited |
| `/start-chart` | [start-chart.md](start-chart.md) | Not audited |
| `/stats/game/[gameId]` | [stats--game--gameId.md](stats--game--gameId.md) | Not audited |
| `/stats` | [stats.md](stats.md) | Not audited |
| `/stats/player/[playerId]` | [stats--player--playerId.md](stats--player--playerId.md) | Not audited |
| `/stats/team/[teamAbbreviation]` | [stats--team--teamAbbreviation.md](stats--team--teamAbbreviation.md) | Not audited |
| `/statsPlaceholder` | [statsPlaceholder.md](statsPlaceholder.md) | Not audited |
| `/teamStats/[teamAbbreviation]` | [teamStats--teamAbbreviation.md](teamStats--teamAbbreviation.md) | Not audited |
| `/teamStats` | [teamStats.md](teamStats.md) | Not audited |
| `/trends` | [trends.md](trends.md) | Not audited |
| `/trends/placeholder` | [trends--placeholder.md](trends--placeholder.md) | Not audited |
| `/trends/player/[playerId]` | [trends--player--playerId.md](trends--player--playerId.md) | Not audited |
| `/trendsDebug` | [trendsDebug.md](trendsDebug.md) | Not audited |
| `/trendsSandbox` | [trendsSandbox.md](trendsSandbox.md) | Not audited |
| `/trendsTestingGrounds` | [trendsTestingGrounds.md](trendsTestingGrounds.md) | Not audited |
| `/trueGoalieValue` | [trueGoalieValue.md](trueGoalieValue.md) | Not audited |
| `/twitterEmbeds` | [twitterEmbeds.md](twitterEmbeds.md) | Not audited |
| `/underlying-stats/goalieStats/[playerId]` | [underlying-stats--goalieStats--playerId.md](underlying-stats--goalieStats--playerId.md) | Not audited |
| `/underlying-stats/goalieStats` | [underlying-stats--goalieStats.md](underlying-stats--goalieStats.md) | Not audited |
| `/underlying-stats` | [underlying-stats.md](underlying-stats.md) | Not audited |
| `/underlying-stats/playerStats/[playerId]` | [underlying-stats--playerStats--playerId.md](underlying-stats--playerStats--playerId.md) | Not audited |
| `/underlying-stats/playerStats` | [underlying-stats--playerStats.md](underlying-stats--playerStats.md) | Not audited |
| `/underlying-stats/teamStats` | [underlying-stats--teamStats.md](underlying-stats--teamStats.md) | Not audited |
| `/underlying-stats/xg` | [underlying-stats--xg.md](underlying-stats--xg.md) | Not audited |
| `/variance/goalies` | [variance--goalies.md](variance--goalies.md) | Not audited |
| `/variance` | [variance.md](variance.md) | Not audited |
| `/variance/skaters` | [variance--skaters.md](variance--skaters.md) | Not audited |
| `/wigoCharts` | [wigoCharts.md](wigoCharts.md) | Not audited |

## Apparent internal routes — outside the requested scope

- `/db` — `web/pages/db/index.tsx`
- `/db/player-aliases` — `web/pages/db/player-aliases.tsx`
- `/db/player-forecast-review` — `web/pages/db/player-forecast-review.tsx`
- `/db/player-forecast-season-editor` — `web/pages/db/player-forecast-season-editor.tsx`
- `/db/tweet-pattern-review` — `web/pages/db/tweet-pattern-review.tsx`
- `/db/upsert-projections` — `web/pages/db/upsert-projections.tsx`
- `/underlying-stats/xg/operations` — `web/pages/underlying-stats/xg/operations.tsx`

## Verification and limits

Setup inspected the page inventory, primary navigation configuration, and homepage composition in source. No rendered page, mobile layout, interaction flow, or production access was tested. Other page records are placeholders awaiting individual inspection. Existing working-tree Draft Dashboard changes were preserved; assess those against the current state when that page is reached.
