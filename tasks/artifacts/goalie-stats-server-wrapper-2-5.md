# 2.5 Goalie Server Wrapper

## Summary

Added a dedicated goalie server wrapper layer in:

- `web/lib/underlying-stats/goalieStatsServer.ts`

This makes the dedicated goalie read surface explicitly delegate to the shared player-underlying aggregation engine instead of importing shared player builders directly inside the goalie API routes.

## What Changed

Added wrapper functions for:

- goalie landing aggregation
- goalie detail aggregation
- goalie landing chart aggregation

Updated the dedicated goalie API routes to call these wrapper functions instead of importing `playerStatsLandingServer.ts` directly.

Added verification in:

- `web/lib/underlying-stats/goalieStatsServer.test.ts`

## Why This Matters

This step creates an explicit server-side reuse boundary:

- dedicated goalie route and API surface above
- shared player-underlying aggregation engine below

That keeps future goalie-specific API or page behavior from leaking shared player-server imports all over the dedicated goalie implementation.

## Verified

Targeted tests:

- `npx vitest run web/lib/underlying-stats/goalieStatsServer.test.ts web/__tests__/pages/api/v1/underlying-stats/goalies.test.ts web/__tests__/pages/api/v1/underlying-stats/goalies/[playerId].test.ts web/__tests__/pages/api/v1/underlying-stats/goalies/[playerId]/chart.test.ts`

Passing assertions:

- goalie landing wrapper delegates through the shared landing aggregation builder
- goalie detail wrapper delegates through the shared detail aggregation builder
- goalie chart wrapper delegates through the shared chart builder
- dedicated goalie API routes continue to return through the wrapper layer
