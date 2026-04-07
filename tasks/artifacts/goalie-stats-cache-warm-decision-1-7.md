# Goalie Stats Cache Warm Decision (`NEW 1.7`)

## Decision

Yes. The dedicated goalie route needs its own aggregate-cache warm profile.

## Why

- The existing warm helper in [playerStatsSummaryRefresh.ts](/Users/tim/Code/fhfhockey.com/web/lib/underlying-stats/playerStatsSummaryRefresh.ts) previously always started from [createDefaultLandingFilterState()](/Users/tim/Code/fhfhockey.com/web/lib/underlying-stats/playerStatsFilters.ts), which defaults to:
  - `statMode: "onIce"`
  - `displayMode: "counts"`
  - `strength: "fiveOnFive"`
  - `scoreState: "allScores"`
- The shared season aggregate cache key in [playerStatsLandingServer.ts](/Users/tim/Code/fhfhockey.com/web/lib/underlying-stats/playerStatsLandingServer.ts) includes `statMode`, so warming the default skater/on-ice profile does **not** warm the future dedicated goalie landing route.
- That means the first request to `/underlying-stats/goalieStats` would still be a cold aggregate build even after a successful “warm landing cache” summary refresh.

## What Changed

- Extended [warmPlayerStatsLandingSeasonAggregateCache()](/Users/tim/Code/fhfhockey.com/web/lib/underlying-stats/playerStatsSummaryRefresh.ts) to accept optional `statModes`.
- The helper now warms each requested stat-mode profile explicitly and sets the corresponding default sort for that mode.
- Current route behavior stays unchanged because the default remains the existing skater/on-ice warm.
- The future goalie route can call the same helper with:
  - `statModes: ["goalies"]`
- If desired later, a combined warm can use:
  - `statModes: ["onIce", "goalies"]`

## Verification

- Added direct unit coverage in [playerStatsSummaryRefresh.test.ts](/Users/tim/Code/fhfhockey.com/web/lib/underlying-stats/playerStatsSummaryRefresh.test.ts):
  - default warm still targets `onIce`
  - goalie warm targets `goalies`
  - duplicate requested stat modes are deduped
- Verified route compatibility with:
  - [update-player-underlying-summaries.test.ts](/Users/tim/Code/fhfhockey.com/web/__tests__/pages/api/v1/db/update-player-underlying-summaries.test.ts)

## Scope Notes

- I did **not** change the current maintenance routes to warm goalie aggregates automatically. That would add extra work to every refresh run before the dedicated goalie route exists.
- The shared helper now supports the dedicated goalie route cleanly when that route is implemented in later tasks.
