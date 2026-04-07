# Goalie Stats Filter Semantics Audit (`1.3`)

## Findings

### 1. The current shared contract exposes more goalie filter values than the shared server actually supports.

Verified contract values in [`web/lib/underlying-stats/playerStatsTypes.ts`](/Users/tim/Code/fhfhockey.com/web/lib/underlying-stats/playerStatsTypes.ts:4):

- Season types:
  - `regularSeason`
  - `playoffs`
  - `preSeason`
- Strength values:
  - `fiveOnFive`
  - `allStrengths`
  - `evenStrength`
  - `penaltyKill`
  - `powerPlay`
  - `fiveOnFourPP`
  - `fourOnFivePK`
  - `threeOnThree`
  - `withEmptyNet`
  - `againstEmptyNet`
- Score states:
  - `allScores`
  - `tied`
  - `leading`
  - `trailing`
  - `withinOne`
  - `upOne`
  - `downOne`

However, the shared landing server only treats these strengths as supported in [`web/lib/underlying-stats/playerStatsLandingServer.ts`](/Users/tim/Code/fhfhockey.com/web/lib/underlying-stats/playerStatsLandingServer.ts:1468):

- `allStrengths`
- `evenStrength`
- `fiveOnFive`
- `powerPlay`
- `penaltyKill`

The following PRD-requested strengths are in the public filter contract but are not implemented in the shared landing aggregation path:

- `fiveOnFourPP`
- `fourOnFivePK`
- `threeOnThree`
- `withEmptyNet`
- `againstEmptyNet`

Conclusion:

- The dedicated goalie route cannot honestly claim full support for all requested strength states until the shared pipeline is extended.

### 2. Score-state filtering is exposed in the UI and query contract, but the shared landing aggregation pipeline only supports `allScores`.

- The filter contract and UI expose all score states in:
  - [`web/lib/underlying-stats/playerStatsTypes.ts`](/Users/tim/Code/fhfhockey.com/web/lib/underlying-stats/playerStatsTypes.ts:22)
  - [`web/components/underlying-stats/PlayerStatsFilters.tsx`](/Users/tim/Code/fhfhockey.com/web/components/underlying-stats/PlayerStatsFilters.tsx:232)
- But the native landing aggregation path explicitly throws when `scoreState !== "allScores"` in [`web/lib/underlying-stats/playerStatsLandingServer.ts`](/Users/tim/Code/fhfhockey.com/web/lib/underlying-stats/playerStatsLandingServer.ts:2556).
- The summary snapshot builder also hard-codes `scoreState: "allScores"` in [`web/lib/underlying-stats/playerStatsLandingServer.ts`](/Users/tim/Code/fhfhockey.com/web/lib/underlying-stats/playerStatsLandingServer.ts:3141).

Conclusion:

- Score-state support is currently a contract/UI illusion for landing reads.
- This is a real blocker for a goalie PRD that promises `Tied`, `Up 1`, `Leading`, `Down 1`, `Trailing`, and `Within 1`.

### 3. Season type is fully supported today.

- The shared contract exposes `regularSeason`, `playoffs`, and `preSeason` in [`web/lib/underlying-stats/playerStatsTypes.ts`](/Users/tim/Code/fhfhockey.com/web/lib/underlying-stats/playerStatsTypes.ts:4).
- The filter UI renders those values directly in [`web/components/underlying-stats/PlayerStatsFilters.tsx`](/Users/tim/Code/fhfhockey.com/web/components/underlying-stats/PlayerStatsFilters.tsx:198).
- The shared server resolves game type from season type and applies it when selecting source games in [`web/lib/underlying-stats/playerStatsLandingServer.ts`](/Users/tim/Code/fhfhockey.com/web/lib/underlying-stats/playerStatsLandingServer.ts:732).

Conclusion:

- Season type is a verified reusable goalie filter.

### 4. Venue is fully supported today, but its semantics differ slightly depending on whether a team context is active.

- Venue values are `all`, `home`, and `away` in [`web/lib/underlying-stats/playerStatsTypes.ts`](/Users/tim/Code/fhfhockey.com/web/lib/underlying-stats/playerStatsTypes.ts:58).
- The UI exposes `Home or Away` in [`web/components/underlying-stats/PlayerStatsFilters.tsx`](/Users/tim/Code/fhfhockey.com/web/components/underlying-stats/PlayerStatsFilters.tsx:432).
- When a specific landing `teamId` is active, venue is applied during source-game selection in [`web/lib/underlying-stats/playerStatsLandingServer.ts`](/Users/tim/Code/fhfhockey.com/web/lib/underlying-stats/playerStatsLandingServer.ts:774).
- Regardless of team filter, venue is also enforced at summary-row matching time through `matchesLandingVenue(...)` in [`web/lib/underlying-stats/playerStatsLandingServer.ts`](/Users/tim/Code/fhfhockey.com/web/lib/underlying-stats/playerStatsLandingServer.ts:3796) and [`web/lib/underlying-stats/playerStatsLandingServer.ts`](/Users/tim/Code/fhfhockey.com/web/lib/underlying-stats/playerStatsLandingServer.ts:4117).

Conclusion:

- Venue is a verified reusable goalie filter.

### 5. Minimum TOI is fully supported today and explicitly applies after aggregation.

- The control model explicitly says `appliesAfterAggregation: true` in [`web/lib/underlying-stats/playerStatsFilters.ts`](/Users/tim/Code/fhfhockey.com/web/lib/underlying-stats/playerStatsFilters.ts:72).
- The UI exposes `Minimum TOI` in [`web/components/underlying-stats/PlayerStatsFilters.tsx`](/Users/tim/Code/fhfhockey.com/web/components/underlying-stats/PlayerStatsFilters.tsx:446).
- The shared server filters aggregated rows by `minimumToiSeconds` in [`web/lib/underlying-stats/playerStatsLandingServer.ts`](/Users/tim/Code/fhfhockey.com/web/lib/underlying-stats/playerStatsLandingServer.ts:3657) and detail rows in [`web/lib/underlying-stats/playerStatsLandingServer.ts`](/Users/tim/Code/fhfhockey.com/web/lib/underlying-stats/playerStatsLandingServer.ts:3963).

Conclusion:

- Minimum TOI is a verified reusable goalie filter, with explicit post-aggregation semantics.

### 6. Date range, game range, and team-game range are mutually exclusive and already work as one active scope.

- The scope contract is mutually exclusive by type:
  - `none`
  - `dateRange`
  - `gameRange`
  - `byTeamGames`
  in [`web/lib/underlying-stats/playerStatsTypes.ts`](/Users/tim/Code/fhfhockey.com/web/lib/underlying-stats/playerStatsTypes.ts:110).
- Query parsing only returns one scope at a time in [`web/lib/underlying-stats/playerStatsFilters.ts`](/Users/tim/Code/fhfhockey.com/web/lib/underlying-stats/playerStatsFilters.ts:396).
- The UI copy already states that date and game-count inputs replace each other automatically in [`web/components/underlying-stats/PlayerStatsFilters.tsx`](/Users/tim/Code/fhfhockey.com/web/components/underlying-stats/PlayerStatsFilters.tsx:378).
- Scope switching is modeled as a single replacement in [`web/lib/underlying-stats/playerStatsFilters.ts`](/Users/tim/Code/fhfhockey.com/web/lib/underlying-stats/playerStatsFilters.ts:571).
- Tests already cover this exclusivity and goalie parsing in [`web/lib/underlying-stats/playerStatsFilters.test.ts`](/Users/tim/Code/fhfhockey.com/web/lib/underlying-stats/playerStatsFilters.test.ts:296), [`web/lib/underlying-stats/playerStatsFilters.test.ts`](/Users/tim/Code/fhfhockey.com/web/lib/underlying-stats/playerStatsFilters.test.ts:382), and [`web/lib/underlying-stats/playerStatsFilters.test.ts`](/Users/tim/Code/fhfhockey.com/web/lib/underlying-stats/playerStatsFilters.test.ts:522).

Conclusion:

- Scope exclusivity is already a verified shared behavior for the future goalie route.

### 7. The three requested timeframe windows already map to real shared server semantics.

Verified meanings:

- `From Date` + `Through Date`
  - applied as source-game date bounds during game selection in [`web/lib/underlying-stats/playerStatsLandingServer.ts`](/Users/tim/Code/fhfhockey.com/web/lib/underlying-stats/playerStatsLandingServer.ts:755)
  - validated for completeness, order, and season-span bounds in [`web/lib/underlying-stats/playerStatsFilters.ts`](/Users/tim/Code/fhfhockey.com/web/lib/underlying-stats/playerStatsFilters.ts:803)
- `# of GP`
  - represented as `scope.kind === "gameRange"`
  - applied as “most recent X appearances for each grouping” via `takeMostRecent*` in [`web/lib/underlying-stats/playerStatsLandingServer.ts`](/Users/tim/Code/fhfhockey.com/web/lib/underlying-stats/playerStatsLandingServer.ts:2856) and [`web/lib/underlying-stats/playerStatsLandingServer.ts`](/Users/tim/Code/fhfhockey.com/web/lib/underlying-stats/playerStatsLandingServer.ts:3864)
- `# of Team GP`
  - represented as `scope.kind === "byTeamGames"`
  - applied by selecting the most recent team game IDs, then keeping only player rows within that team window in [`web/lib/underlying-stats/playerStatsLandingServer.ts`](/Users/tim/Code/fhfhockey.com/web/lib/underlying-stats/playerStatsLandingServer.ts:2874) and [`web/lib/underlying-stats/playerStatsLandingServer.ts`](/Users/tim/Code/fhfhockey.com/web/lib/underlying-stats/playerStatsLandingServer.ts:3882)

Conclusion:

- The requested goalie timeframe filters already have verified shared semantics.

### 8. Goalie mode correctly disables position filtering while preserving the rest of the advanced filter contract.

- Goalie mode compatibility only allows `goalies` and reports `supportsPositionFilter: false` in [`web/lib/underlying-stats/playerStatsTypes.ts`](/Users/tim/Code/fhfhockey.com/web/lib/underlying-stats/playerStatsTypes.ts:221).
- Mode normalization clears incompatible position groups in [`web/lib/underlying-stats/playerStatsFilters.ts`](/Users/tim/Code/fhfhockey.com/web/lib/underlying-stats/playerStatsFilters.ts:736).
- That behavior is covered by tests in [`web/lib/underlying-stats/playerStatsFilters.test.ts`](/Users/tim/Code/fhfhockey.com/web/lib/underlying-stats/playerStatsFilters.test.ts:458) and [`web/lib/underlying-stats/playerStatsFilters.test.ts`](/Users/tim/Code/fhfhockey.com/web/lib/underlying-stats/playerStatsFilters.test.ts:489).

Conclusion:

- Team, venue, minimum TOI, timeframe scope, and trade mode carry cleanly into goalie mode.
- Position filtering should not be part of the dedicated goalie UI.

## Recommended Product Interpretation For The Goalie Route

Safe to promise immediately on the dedicated goalie route:

- season type
- team filter
- home or away
- minimum TOI
- date range
- player game range
- team game range

Safe to promise with caveats because the shared pipeline already supports them:

- `All Strengths`
- `Even Strength`
- `5v5`
- `Power Play`
- `Penalty Kill`

Not safe to promise yet without shared-pipeline work:

- `5 on 4 Power Play`
- `4 on 5 PK`
- `3 on 3`
- `w/Empty Net`
- `Against Empty Net`
- all non-`allScores` score states

## Verified vs Inferred

Verified:

- current public filter contract values
- current UI-exposed filter controls
- scope exclusivity behavior
- season type semantics
- venue semantics
- minimum TOI semantics
- date-range, game-range, and team-game-range semantics
- goalie-mode compatibility behavior
- unsupported-strength and unsupported-score-state limitations in the shared landing server

Inferred:

- the dedicated goalie route should narrow its first shipped filter promise to the subset already supported by the shared engine, unless the shared summary pipeline is extended in the goalie project itself
