# 2.4 Goalie Query Contract

## Summary

Implemented dedicated goalie request parsing and URL/path builders in:

- `web/lib/underlying-stats/goalieStatsQueries.ts`

This gives the goalie surface a stable contract independent of the player route namespace while still delegating to the shared player-underlying filter and aggregation system.

## What Changed

Added dedicated goalie helpers for:

- default goalie landing filter state
- default goalie detail filter state
- landing API path
- detail API path
- chart API path
- landing page href
- detail page href
- landing API request parsing
- detail API request parsing
- chart API request parsing

Also rewired existing dedicated goalie routes and goalie API wrappers to consume this new module.

## Important Behavior

The dedicated goalie contract:

1. always forces `statMode=goalies`
2. keeps the shared query schema, validation, and serialization logic
3. uses goalie-specific route and API pathnames
4. defaults goalie landing and detail states to goalie-appropriate sorting (`savePct desc`)

## Why This Matters

Before this step, the dedicated goalie routes existed, but their route/API contract was still effectively ad hoc and player-helper-derived.

After this step, the repo has a concrete goalie-specific query contract that later `3.x` and `4.x` landing/detail work can import directly instead of reaching back into player route builders.

## Verified

Targeted tests:

- `npx vitest run web/lib/underlying-stats/goalieStatsQueries.test.ts web/__tests__/pages/underlying-stats/goalieStats/index.test.tsx web/__tests__/pages/underlying-stats/goalieStats/[playerId].test.tsx web/__tests__/pages/api/v1/underlying-stats/goalies.test.ts web/__tests__/pages/api/v1/underlying-stats/goalies/[playerId].test.ts web/__tests__/pages/api/v1/underlying-stats/goalies/[playerId]/chart.test.ts`

Passing assertions covered:

- dedicated goalie default states
- dedicated goalie landing/detail/chart API paths
- dedicated goalie landing/detail page hrefs
- dedicated goalie request parsing with forced goalie mode
- goalie landing/detail routes continuing to canonicalize correctly
- goalie API wrappers continuing to force goalie mode through the new contract
