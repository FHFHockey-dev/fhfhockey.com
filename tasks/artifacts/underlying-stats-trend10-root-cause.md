# Underlying Stats `trend10` Root Cause Analysis

## Scope

Task `1.3`: determine whether the current all-zero `trend10` values are caused by upstream data generation, stale carry-forward behavior, read-time mapping, or a combination of those factors.

## Root Cause Summary

The all-zero `trend10` values are caused by a combination of:

1. upstream trend generation that uses prior stored table rows rather than a true last-10-game baseline
2. stale or carry-forward rating history in `team_power_ratings_daily` that collapses recent `off_rating` history into repeated values

This is **not** primarily a read-time mapping or UI formatting problem.

## Evidence

### 1. Read-time mapping is pass-through only

`web/lib/teamRatingsService.ts` maps:

- `trend10: Number(row.trend10)`

There is no repair, recomputation, or fallback in:

- `web/lib/teamRatingsService.ts`
- `web/pages/api/team-ratings.ts`
- `web/pages/underlying-stats/index.tsx`

Conclusion:

- the landing page simply renders the stored value
- the bug must exist before rendering

### 2. Current updater logic does not match the documented SQL definition

The documented SQL source defines:

- `trend10 = off_rating - off_rating_last10`

Reference:

- `web/rules/power-ratings-tables.md:628`

The current updater instead:

1. fetches prior rows from `team_power_ratings_daily`
2. builds `historyMap` from prior stored `off_rating` values
3. averages up to 10 prior stored rows
4. computes:
   - `calculated.off_rating - avgLast10`
   - or `latest.off_rating - avgLast10`

References:

- `web/lib/power-ratings.ts:673`
- `web/pages/api/v1/db/update-team-power-ratings.ts:162`
- `web/pages/api/v1/db/update-team-power-ratings.ts:174`
- `web/pages/api/v1/db/update-team-power-ratings.ts:251`
- `web/pages/api/v1/db/update-team-power-ratings.ts:264`
- `web/pages/api/v1/db/update-team-power-ratings.ts:290`

Conclusion:

- the updater is not implementing the documented trend baseline directly
- it is using prior stored rows as the trend history source

### 3. The prior stored history is already flat across consecutive dates

Live table checks show repeated `off_rating` values across many consecutive dates.

Example for `COL` from `2026-03-20` through `2026-04-05`:

- 17 rows
- 1 unique `off_rating`
- 1 unique `trend10`

The same flat pattern was observed for other sampled teams:

- `CAR`
- `DET`
- `EDM`
- `SEA`

Each sampled team had:

- 17 rows
- 1 unique `off_rating`
- 1 unique `trend10`

Conclusion:

- recent stored history is effectively a repeated snapshot, not a meaningful rolling sequence
- averaging the last 10 stored rows will naturally produce the current stored value again, which forces `trend10` toward zero

### 4. Carry-forward behavior exists in the updater

If the updater cannot produce a new calculated row for a team on the target date, it explicitly falls back to the latest prior stored row and copies those rating fields forward.

Reference:

- `web/pages/api/v1/db/update-team-power-ratings.ts:268`

Conclusion:

- the table can accumulate repeated same-value rows across dates
- this makes the stored table a poor source for a “recent baseline” unless the baseline logic explicitly filters to true game-based updates

## What This Means

### Verified cause

- Upstream trend generation is currently based on prior stored table rows.
- The stored table history is flat across recent consecutive dates for sampled teams.
- The flat stored history makes the updater’s average-of-prior-rows trend logic collapse to zero.

### Rejected primary cause

- Read-time mapping in the service or page is not the primary cause.

## Best Current Diagnosis

The current all-zero `trend10` issue is caused by **upstream data generation plus stale carry-forward behavior together**.

More specifically:

- the updater computes trend from prior stored rows instead of a true last-10-game baseline
- the stored rows themselves are heavily flattened by carry-forward behavior
- the combination makes `avgLast10` equal or nearly equal the current `off_rating`, producing `trend10 = 0`

## Implication For Next Tasks

- Task `1.4` should restore trend from a source that reflects true recent performance rather than prior copied table rows
- A later implementation step will likely need a targeted backfill or refresh of affected `team_power_ratings_daily` rows after the trend logic is corrected
