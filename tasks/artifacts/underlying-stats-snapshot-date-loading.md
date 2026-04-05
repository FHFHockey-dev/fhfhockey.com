# Underlying Stats Landing Page Snapshot-Date Loading (`1.5`)

Date: 2026-04-05

## Problem

The landing page SSR was loading snapshot dates like this:

- query `team_power_ratings_daily`
- `select("date")`
- `order("date", { ascending: false })`
- `limit(90)`
- dedupe the returned raw rows into `availableDates`

Because `team_power_ratings_daily` stores one row per team per date, the `limit(90)` was a raw-row limit rather than a distinct-date limit. With roughly 32 rows per snapshot date, the page often exposed only about 3 dates in the selector.

## Implemented Fix

Added:

- `/Users/tim/Code/fhfhockey.com/web/lib/underlying-stats/availableSnapshotDates.ts`
- `/Users/tim/Code/fhfhockey.com/web/lib/underlying-stats/availableSnapshotDates.test.ts`

The new helper `fetchDistinctUnderlyingStatsSnapshotDates()`:

- reads from `team_power_ratings_daily`
- orders by `date desc`
- pages through raw rows using `.range(...)`
- accumulates distinct dates in insertion order
- stops once it has the requested number of distinct dates or the source is exhausted

`/Users/tim/Code/fhfhockey.com/web/pages/underlying-stats/index.tsx` now uses this helper in SSR instead of the previous single raw-row-limited query.

## What Was Verified

### Unit test

Verified that the helper:

- continues paging until it reaches the requested distinct-date count
- returns early when the source runs out of rows

### SSR check

Verified against the local `/underlying-stats` route:

- before the fix, SSR exposed 3 snapshot `<option>` elements
- after the fix, SSR exposed 90 snapshot `<option>` elements

## Scope Notes

- This task changes only how the landing page collects available snapshot dates.
- It does not change the later fallback behavior when a requested date has no valid ratings rows. That remains explicitly covered by task `1.6`.
