# Underlying Stats Landing Page Snapshot Fallback Resolution (`1.6`)

Date: 2026-04-05

## Goal

Preserve the landing page's "latest valid snapshot" fallback behavior after the distinct-date loading change from task `1.5`, and make that same fallback behavior available to client-side date changes.

## Problem

After task `1.5`, SSR still had fallback behavior because `index.tsx` retried against the latest available snapshot when the requested date returned no ratings rows.

The client-side path did not fully preserve that behavior:

- `/api/underlying-stats/team-ratings` returned only a bare ratings array
- if a requested date resolved to no rows, the client had no structured way to learn the fallback date that should be used instead

## Implemented Fix

### Shared resolver

File:

- `/Users/tim/Code/fhfhockey.com/web/lib/underlying-stats/teamLandingRatings.ts`

Added `resolveUnderlyingStatsLandingSnapshot()` which:

- accepts a requested date and the ordered list of available snapshot dates
- tries the requested date first when it is a valid ISO date
- then walks the available snapshot dates from newest to oldest
- returns the first date that actually has landing-page ratings rows
- returns both the `requestedDate` and the `resolvedDate`

This makes "latest valid snapshot with data" an explicit landing-page rule rather than an SSR-only side effect.

### SSR

File:

- `/Users/tim/Code/fhfhockey.com/web/pages/underlying-stats/index.tsx`

SSR now uses the shared resolver instead of open-coding the retry logic.

### Client/API

Files:

- `/Users/tim/Code/fhfhockey.com/web/pages/api/underlying-stats/team-ratings.ts`
- `/Users/tim/Code/fhfhockey.com/web/pages/underlying-stats/index.tsx`

The landing-page API now returns:

- `requestedDate`
- `resolvedDate`
- `ratings`

The page uses `resolvedDate` to update local selection and the shallow route if a fallback was required.

## What Was Verified

### Unit test

Verified:

- fallback from an empty requested snapshot to the latest later candidate with data
- invalid requested-date input does not become the resolved snapshot date

### Runtime checks

Verified against a stale request date (`1900-01-01`):

- `/api/underlying-stats/team-ratings?date=1900-01-01` returned:
  - `requestedDate: 1900-01-01`
  - `resolvedDate: 2026-04-05`
  - `ratings.length: 32`
- SSR for `/underlying-stats?date=1900-01-01` rendered `initialDate: 2026-04-05`

## Scope Notes

- This task stays fully within the landing page.
- `/underlying-stats/playerStats` was not modified.
