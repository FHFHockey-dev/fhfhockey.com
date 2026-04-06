# 2.1 Dedicated Goalie Landing Route

## Summary

Created the dedicated landing route at `web/pages/underlying-stats/goalieStats/index.tsx`.

This step intentionally does **not** implement the full dedicated goalie UI or a dedicated goalie API namespace yet. Instead, it introduces the goalie route shell and makes it canonicalize its URL state into shared landing-page goalie mode before delegating to the existing shared player landing page.

## What Changed

- Added `web/pages/underlying-stats/goalieStats/index.tsx`
- Added `web/__tests__/pages/underlying-stats/goalieStats/index.test.tsx`

## Route Behavior

The new route:

1. parses the incoming query using the shared player-underlying filter contract
2. forces `statMode=goalies`
3. clears mode-incompatible values through the existing shared normalization helper
4. applies goalie-default sorting when the incoming URL does not explicitly specify a sort
5. rewrites the URL to the dedicated goalie pathname
6. renders the existing shared landing page only after the query is canonical

## Why This Shape

This keeps `2.1` narrow and aligned with the task list:

- route exists now
- route is goalie-first in state bootstrap
- no duplicate aggregation or new API path is introduced yet

The dedicated goalie API wrappers, route-specific query helpers, and goalie-specific landing shell remain in later tasks under `2.x` and `3.x`.

## Verified

Targeted route test:

- `npx vitest run web/__tests__/pages/underlying-stats/goalieStats/index.test.tsx`

Passing assertions:

- the route canonicalizes an empty/shared query into goalie mode
- the route uses goalie default sort when no explicit sort exists
- the route does not render the shared landing page until the query is canonical
- the route renders the shared landing page when the goalie query is already canonical
