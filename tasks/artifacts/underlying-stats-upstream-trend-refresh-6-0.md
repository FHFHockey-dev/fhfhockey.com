# Underlying Stats Upstream Trend Refresh (`NEW 6.0`)

Date: `2026-04-05`

## Problem addressed

The landing page had already been repaired at read time, but the canonical writer at `/api/v1/db/update-team-power-ratings` was still storing `trend10` from prior rows in `team_power_ratings_daily`. Because those prior rows were already flattened by carry-forward behavior, the stored baseline collapsed toward the current `off_rating`, which kept `trend10` at or near zero.

## Implementation

### 1. Shared trend-history helper

Added:

- `/Users/tim/Code/fhfhockey.com/web/lib/teamRatingsTrend.ts`

This helper now centralizes the played-snapshot trend baseline logic used by both:

- the landing-page cache wrapper in `/Users/tim/Code/fhfhockey.com/web/lib/underlying-stats/teamLandingRatings.ts`
- the canonical writer in `/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-team-power-ratings.ts`

Shipped trend definition:

- build played-snapshot history from actual fetched game logs
- recompute each snapshot’s `off_rating`
- define `trend10` as:
  - current played snapshot `off_rating`
  - minus the mean of the prior 10 played-snapshot `off_rating` values

That matches the landing-page repair logic and no longer depends on stale stored rows.

### 2. Canonical writer fix

Updated:

- `/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-team-power-ratings.ts`

Changes:

- `trend10` is now derived from actual played-snapshot history via `deriveTrendOverridesFromLogs(...)`
- the route no longer computes trend from `fetchAllRatings()` history
- `fetchAllRatings()` remains only for carry-forward row materialization on dates without a fresh calculated row
- the route now supports explicit range refreshes on non-empty tables via:
  - `startDate`
  - `endDate`

This makes targeted backfill possible without relying on the old “table empty” auto-backfill path.

### 3. Test coverage

Updated:

- `/Users/tim/Code/fhfhockey.com/web/__tests__/pages/api/v1/db/update-team-power-ratings.test.ts`

Added coverage for:

- explicit non-empty-table range refreshes
- stored `trend10` recomputation from played snapshots instead of stale prior stored rows
- invalid explicit date ranges

## Live operator verification

### One-day live probe

Command run:

```bash
curl -sS -m 180 'http://localhost:3000/api/v1/db/update-team-power-ratings?date=2026-04-05'
```

Result:

- `processedDays: 1`
- `totalUpserts: 32`

Then checked canonical stored-reader output:

```bash
curl -sS -m 180 'http://localhost:3000/api/team-ratings?date=2026-04-05'
```

Verified:

- `32` rows returned
- `32/32` rows had non-zero `trend10`
- sample rows:
  - `COL -0.13`
  - `TOR -4.81`
  - `EDM -0.81`
  - `NYR 4.50`

### Range backfill run

Command run:

```bash
curl -sS -m 180 'http://localhost:3000/api/v1/db/update-team-power-ratings?startDate=2026-03-20&endDate=2026-04-05'
```

Result:

- `processedDays: 17`
- `totalUpserts: 544`
- `explicitRangeApplied: true`

### Post-backfill verification

Checked canonical stored-reader output for:

- `2026-03-20`
- `2026-04-01`
- `2026-04-05`

Verified:

- each date returned `32` rows
- each checked date had `32/32` non-zero `trend10` values

Sample values:

- `2026-03-20`
  - `COL -6.15`
  - `CAR -4.47`
  - `TOR -6.81`
  - `NYR -3.47`
  - `EDM -1.04`
- `2026-04-01`
  - `COL 4.52`
  - `CAR 6.78`
  - `TOR 4.83`
  - `NYR 2.97`
  - `EDM -7.84`
- `2026-04-05`
  - `COL -0.13`
  - `CAR 4.53`
  - `TOR -4.81`
  - `NYR 4.50`
  - `EDM -0.81`

## Additional verification

- Targeted test command passed:
  - `/Users/tim/Code/fhfhockey.com/web/__tests__/pages/api/v1/db/update-team-power-ratings.test.ts`
  - `/Users/tim/Code/fhfhockey.com/web/lib/underlying-stats/teamLandingRatings.test.ts`
  - `/Users/tim/Code/fhfhockey.com/web/__tests__/pages/underlying-stats/index.test.tsx`
  - `/Users/tim/Code/fhfhockey.com/web/lib/underlying-stats/teamScheduleStrength.test.ts`
- Full suite passed:
  - `npm run test:full`
  - `169` test files
  - `852` tests

## Residual note

This repair backfilled the verified affected recent window `2026-03-20` through `2026-04-05`. If broader historical stored trend integrity is needed beyond that validated scope, the same explicit range-refresh path can now be reused safely.
