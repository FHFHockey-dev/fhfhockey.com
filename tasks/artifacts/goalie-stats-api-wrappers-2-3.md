# 2.3 Dedicated Goalie API Wrappers

## Summary

Added dedicated goalie read APIs under `/api/v1/underlying-stats/goalies` for:

- landing
- detail
- chart

These are thin wrappers over the existing shared player-underlying parsers and aggregation builders.

## What Changed

Added:

- `web/pages/api/v1/underlying-stats/goalies.ts`
- `web/pages/api/v1/underlying-stats/goalies/[playerId].ts`
- `web/pages/api/v1/underlying-stats/goalies/[playerId]/chart.ts`

Added focused tests:

- `web/__tests__/pages/api/v1/underlying-stats/goalies.test.ts`
- `web/__tests__/pages/api/v1/underlying-stats/goalies/[playerId].test.ts`
- `web/__tests__/pages/api/v1/underlying-stats/goalies/[playerId]/chart.test.ts`

## Wrapper Behavior

Each wrapper:

1. preserves the existing shared query contract
2. forces `statMode=goalies`
3. reuses the shared parser from `playerStatsQueries.ts`
4. reuses the shared aggregation builder from `playerStatsLandingServer.ts`
5. returns goalie-specific error strings from the route surface

## Why This Shape

This keeps the dedicated goalie namespace aligned with the PRD without duplicating any aggregation math or request-validation logic.

The wrappers only specialize route identity and default mode. Deeper goalie-specific query helpers and contracts remain later work under `2.4`.

## Verified

Targeted route tests:

- `npx vitest run web/__tests__/pages/api/v1/underlying-stats/goalies.test.ts web/__tests__/pages/api/v1/underlying-stats/goalies/[playerId].test.ts web/__tests__/pages/api/v1/underlying-stats/goalies/[playerId]/chart.test.ts`

Passing assertions:

- landing wrapper forces `statMode=goalies`
- detail wrapper forces `statMode=goalies` while preserving `playerId`
- chart wrapper forces `statMode=goalies` while preserving `playerId` and `splitTeamId`
