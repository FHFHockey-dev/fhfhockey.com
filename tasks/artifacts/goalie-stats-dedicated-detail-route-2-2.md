# 2.2 Dedicated Goalie Detail Route

## Summary

Created the dedicated goalie detail route at `web/pages/underlying-stats/goalieStats/[playerId].tsx`.

Like `2.1`, this step is intentionally narrow. It introduces the route and canonicalizes detail query state into goalie mode before delegating to the shared detail page, without yet introducing dedicated goalie APIs or a goalie-specific detail UI shell.

## What Changed

- Added `web/pages/underlying-stats/goalieStats/[playerId].tsx`
- Added `web/__tests__/pages/underlying-stats/goalieStats/[playerId].test.tsx`

## Route Behavior

The route:

1. parses the incoming detail query with the shared detail filter contract
2. forces `statMode=goalies`
3. preserves `playerId`
4. applies goalie-default sorting when the incoming URL does not explicitly specify a sort
5. rewrites the URL to the dedicated goalie detail pathname
6. renders the shared player detail page only after the goalie detail query is canonical

## Why This Shape

This keeps `2.2` consistent with the route-first strategy established in `2.1`:

- dedicated goalie pathname exists
- canonical goalie detail URL state exists
- shared detail aggregation and rendering remain the source of truth until later tasks specialize them

The dedicated goalie API wrappers and goalie-first detail presentation remain later work under `2.3+` and `4.x`.

## Verified

Targeted route test:

- `npx vitest run web/__tests__/pages/underlying-stats/goalieStats/[playerId].test.tsx`

Passing assertions:

- the route canonicalizes a minimal detail URL into goalie mode
- the route preserves `playerId` during canonicalization
- the route applies goalie default sort when no explicit sort exists
- the route renders the shared detail page when the goalie detail query is already canonical
