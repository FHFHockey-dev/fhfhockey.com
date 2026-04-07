# 2.6 Goalie Route Verification

## Summary

Extended route-level verification for the dedicated goalie API surface so the tests prove:

1. goalie-only families are exposed on the route surface
2. shared aggregation payload values are passed through unchanged

## What Changed

Expanded:

- `web/__tests__/pages/api/v1/underlying-stats/goalies.test.ts`
- `web/__tests__/pages/api/v1/underlying-stats/goalies/[playerId].test.ts`
- `web/__tests__/pages/api/v1/underlying-stats/goalies/[playerId]/chart.test.ts`

## What Is Now Proven

### Landing

- counts requests can return `goalieCounts`
- rates requests can return `goalieRates`
- route output preserves representative goalie metrics from the shared builder unchanged

### Detail

- counts requests can return `goalieCounts`
- rates requests can return `goalieRates`
- route output preserves representative goalie metrics from the shared detail builder unchanged

### Chart

- counts requests can return `goalieCounts`
- rates requests can return `goalieRates`
- route output preserves representative chart metrics from the shared chart builder unchanged

## Why This Matters

The dedicated goalie namespace is now verified at two levels:

- server wrapper tests prove delegation to the shared source-of-truth builders
- route tests prove the public goalie endpoints expose goalie-only families and do not distort shared payload math

## Verified

Targeted tests:

- `npx vitest run web/lib/underlying-stats/goalieStatsServer.test.ts web/__tests__/pages/api/v1/underlying-stats/goalies.test.ts web/__tests__/pages/api/v1/underlying-stats/goalies/[playerId].test.ts web/__tests__/pages/api/v1/underlying-stats/goalies/[playerId]/chart.test.ts`

Result:

- 4 files passed
- 9 tests passed
