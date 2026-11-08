# RSO + Start Chart Yahoo read inventory (Phase 1, 2026-10-26)

Static analysis of `octoberBranch` at 28335fd46. No Yahoo, DB, or production calls were made. "Read" means one Yahoo Fantasy API GET through `fetchYahooJson` (`web/lib/integrations/yahoo/providerClient.ts:230`). OAuth token refreshes (`getYahooAccessToken`, `providerClient.ts:234/298`) hit Yahoo's auth host, not the Fantasy API; they're listed apart and aren't in the 64.

Every Fantasy API read also gets one silent repeat after a 401 (`providerClient.ts:297`). `readRequiredPlanningResource` (`rosterPlanning.ts:268`) repeats a required read once after a timeout. Both repeats are rare and left out of the counts.

## 1. Provider snapshot: `POST /api/v1/roster-schedule-optimizer/provider`

Route: `web/pages/api/v1/roster-schedule-optimizer/provider.ts:19` → `loadYahooPlanningSnapshot` (`web/lib/integrations/yahoo/rosterPlanning.ts:276`).

| # | Yahoo resource (path) | Call site | Fields actually consumed (file:line) | Reads / snapshot | Share of the measured 64 |
|---|---|---|---|---|---|
| S1 | `league/{lk}/settings` (`fetchYahooDraftResource "settings"`) | `rosterPlanning.ts:302` | `league_key` (:303 scope check); `time_zone` (:304; real leagues omit it, see WINDOW-RESULTS); `draft_status` (:347, only on an empty roster); via `parseYahooBoardSettings` (`liveDraft.ts:518`): roster slots + reserve slots (`rosterConfig`, `excludedInjurySlots`, `unsupportedRosterSlots`), `roster_type`, `weekly_deadline`, scoring type, stat weights and categories, `unsupportedStatIds`, `min_games_played` (:409–437); `max_weekly_adds` (:229, :249); transport `Date`/`Age` for freshness (:352) | 1 | 1 (1.6%) |
| S2 | `team/{tk}/roster;date={today}` | `rosterPlanning.ts:332` | `team_key`, `roster.date`, `roster.coverage_type`, `is_owned_by_current_login` (:342–344); `roster.is_editable` (:446); per player: `player_key` (:377), `name.full` (only in a limitation, :393), `selected_position.position` (:395), `eligible_positions` (:397–406), `is_undroppable` (:402), `status`/`status_full`/`injury_note` (`yahooInjury` :157, used :403), `starting_status` (goalies, :404, `yahooStartingStatus` :166), `is_editable` (:446); player count (`yahooPlanningPlayers` :140) | 1 | 1 (1.6%) |
| S3 | `team/{tk}/roster;date={d}` for each elapsed day of the horizon | `rosterPlanning.ts:315–329` | Same scope fields; per player `player_key`, `selected_position.position`, `name.full` (:456–461). Feeds `pastLineups`, goalie-minimum credit (:465) and past points (:467) | 0–13 (one per elapsed day; cached in a per-instance memory map, `pastRosterCache` :18, so a cold serverless instance re-reads all of them) | 0 in the 10-26 run (Monday, day 1 of the week); adds up to 6 on a Sunday of a normal week |
| S4 | `league/{lk}/scoreboard` | `rosterPlanning.ts:333` | `league_key` (:554); matchup `week_start`/`week_end` (:566); both teams' `team_key` and `team_stats` (:567–570) → `realized`, `opponent.realized` | 1 | 1 (1.6%) |
| S5 | `league/{lk}/teams/roster/players` (league_rosters) | `rosterPlanning.ts:334` | `league_key` (:387); each team's `team_key` (:569) and its players' `player_key` (:388–390 → `unavailableIds`; :570 → opponent roster) | 1 | 1 (1.6%) |
| S6 | `league/{lk}` (league metadata) | `rosterPlanning.ts:335` | `league_key` and `current_week` only (:225, :235, :246) | 1 | 1 (1.6%) |
| S7 | `team/{tk}` (team metadata) | `rosterPlanning.ts:336` | `team_key`, `is_owned_by_current_login`, `roster_adds.{coverage_type, coverage_value, value}` only (:226–248) | 1 | 1 (1.6%) |
| S8 | `league/{lk}/players;status=A;sort=OR;start={n};count=25/ownership` (discovery) | `rosterPlanning.ts:486–515` (`fetchYahooPlanningResource "available_page"`) | `league_key` (:499); per row `player_key` (:509, :520); `ownership.ownership_type` (:524); `ownership.waiver_date` (:526); `status`/`status_full`/`injury_note` (:525); `eligible_positions` (:530); transport freshness (:499) | 1 + 3 per batch until a page returns < 25 rows, up to start 2000 (81 pages) or 8 s. **58 measured** | **58 (90.6%)** |

Measured 10-26 total: S1 + S2 + S4–S7 = 6, plus 58 discovery = 64. Theoretical ceiling: 6 + 13 + 81 = 100.

Discovery's yield in the measured run: 1,384 Yahoo rows, of which only 815 matched the FHFH catalog. 569 rows (41%) were Yahoo players FHFH doesn't model, so the planner could never use them. 33 catalog players were still "neither known".

## 2. Goalie confirmation read: `POST /api/v1/roster-schedule-optimizer/yahoo-current-data`

Route: `yahoo-current-data.ts:27` → `loadYahooPlanningConfirmations` (`planningConfirmations.ts:20`).

| # | Resource | Call site | Fields consumed | Reads / call |
|---|---|---|---|---|
| C1 | `team/{tk}/roster;date={today}` | `planningConfirmations.ts:38` | Scope fields (:41–44); transport `Date`/`Age` → 2-minute `expiresAt` (:45–51); per player `player_key` (:54), `starting_status` (:79), `editorial_team_abbr` (:82) | 1, or 0 when today is outside the horizon (:37) |

This is the same resource and date as S2. It feeds only goalie Starting/Not Starting marks into forecasts (`applyProviderGoalieStarts`, :85).

## 3. Start Chart Yahoo panel: `POST /api/v1/account/yahoo/starter-board`

Route: `web/pages/api/v1/account/yahoo/starter-board.ts:19` → `loadYahooStarterBoard` (`web/lib/integrations/yahoo/starterBoard.ts:62`). Process-local limit of 30 per minute per user (`recommendationsRateLimit.ts`).

| # | Resource | Call site | Fields consumed | Reads / load |
|---|---|---|---|---|
| B1 | `team/{tk}/roster;date={today ET}` | `starterBoard.ts:91` | Scope fields (:96–106); `roster.is_editable` (:221–223); per player `player_key`, `editorial_team_abbr` (:198), `selected_position` (:210), `eligible_positions` (:212–218), `is_editable` (:221), `is_undroppable` (:226), `name.full` (:296) | 1 |
| B2 | `league/{lk}/settings` | `starterBoard.ts:92` | `league_key` (:102); `parseYahooBoardSettings`: scoring type, weights and categories, roster slots, `roster_type`, `weekly_deadline` (→ acquisition timing, :127), `min_games_played` (:122) | 1 |
| B3 | `league/{lk}/players;status=A;sort=OR;start={0,25,50,75};count=25/ownership` | `starterBoard.ts:243` | `league_key`, `count`, `player_key`, `editorial_team_abbr`, `eligible_positions`, `ownership.ownership_type`, `name.full` (:244–286) | 0 when FORGE has no forecasts today; otherwise 1, plus 3 if page 0 is full (max 4) |

Total per load: 2–6. Loading is user-triggered (button or team/category change in `components/StarterBoardYahoo.tsx:26–36`); there's no timer.

## 4. Frequency: when each fires

| Trigger | Where | Yahoo reads |
|---|---|---|
| RSO open, connected Yahoo workspace (canSync) | `RosterScheduleOptimizer.tsx:563–581`: `refresh(true)` on mount | 1 snapshot (64 measured) |
| **Auto-upkeep** while the tab is visible (needs the `rso_auto_upkeep` capability) | `PROVIDER_REFRESH_INTERVAL = 5 min` (:43); a complete refresh schedules the next in 5 min, a partial one doubles the delay up to 30 min (:539–541) | **1 snapshot every 5 min, so about 768 reads per open hour** |
| Tab becomes visible or comes back online | :582–584 (bounded by `nextAutoAt`) | up to 1 snapshot |
| Manual "Refresh provider" | :1038 (no cooldown unless Yahoo sent Retry-After) | 1 snapshot per click (in-flight requests are deduplicated, :484) |
| League, team or date context change | effect deps :586 | 1 snapshot |
| Each planning execution (new snapshot generation, or an intent/options/requested-player change) with today in range | `hooks/rosterPlanningExecution.ts:27` → broker → `yahoo-current-data` | 1 (C1) per execution; a user editing steps fires one per edit |
| Every additional RSO tab | each tab runs its own schedule | multiplies all of the above (the 10-26 window had 2 tabs, about 131 reads) |
| Start Chart load | `StarterBoardYahoo.tsx` `load()` | 2–6 |

## 5. Other Yahoo readers (outside this scope, listed for completeness)

- `GET /api/v1/account/yahoo/pickup` → `pickupServer.ts:28`: 1 league_rosters read per load (`PlayerPickupTable`).
- FORGE universe capture (`lib/player-forecasts/yahooUniverseCapture.ts:60`, URLs at `yahooUniverse.ts:41`): roster plus 2 discovery pages per capture.
- Live draft (`liveDraftServer.ts:1185–1605`): draft-season only; RSO and Start Chart don't use it.

## 6. Notable observations

1. Discovery is 91% of every snapshot. Auto-upkeep repeats it every 5 minutes, so cadence is the second-biggest lever after the page count.
2. The same `team/{tk}/roster;date=today` resource is read by S2, C1 and B1 (and by FORGE capture), with no shared server cache.
3. S6 (`league`) is read only for `current_week`, and S7 (`team`) only for `roster_adds`. Both facts may already be present in S4 (the scoreboard carries the week) and S2/S5 (team metadata). This needs a recorded-fixture check before relying on it; see PLAN step 4.
4. Past-day rosters (S3) never change once the day is over, but they're cached only in instance memory, so cost grows through the week on cold instances.
5. Inconsistency, not a Yahoo cost: Start Chart derives same-day or next-day acquisition timing from `weekly_deadline` (`starterBoard.ts:127`), while RSO deliberately keeps `acquisitionTiming: "unknown"` (`rosterPlanning.ts:435`). That's an owner call (DECISIONS D6).
