# Forge Dashboard 6.4 Remediation Summary

Date: 2026-03-05  
Scope: Critical/high-priority defects found in 6.1, 6.2, and 6.3

## Defects Addressed

1. Desktop no-scroll failure at `1440x900` and `1920x1080`.
2. Mobile/tablet touch-target failure for `Top Movers` lens toggle (`28px` height).
3. Endpoint p95 misses on:
   - `/api/v1/trends/skater-power`
   - `/api/v1/start-chart`

## Changes Implemented

- `web/styles/ForgeDashboard.module.scss`
  - Converted dashboard root to flex-fill remaining layout space.
  - Added explicit desktop viewport-height cap for Forge page area (`100dvh - 130px`) at desktop no-scroll breakpoint.
  - Increased `Top Movers` toggle button min-height to `v.$touch-target-min` (`44px`).

- `web/pages/api/v1/trends/skater-power.ts`
  - Added in-memory response cache + in-flight request dedupe (`60s` TTL) by query key.

- `web/pages/api/v1/start-chart.ts`
  - Added in-memory response cache + in-flight request dedupe (`60s` TTL) by date key.
  - Added API cache headers for response reuse (`s-maxage=300, stale-while-revalidate=60`).

## Verification Evidence

- QA metrics re-run:
  - `tasks/artifacts/forge-dashboard-remediation-qa-results.json`
- Endpoint timing re-run:
  - `tasks/artifacts/forge-dashboard-remediation-perf-results.json`
- Full tests:
  - `npm test` passed (`22` files, `148` tests)

## Post-Remediation Results

- Desktop no-scroll:
  - `1440x900`: no vertical scrollbar (`docScrollHeight == docClientHeight`, no scroll movement)
  - `1920x1080`: no vertical scrollbar (`docScrollHeight == docClientHeight`, no scroll movement)

- Mobile/tablet touch targets:
  - `Top Movers` lens toggle min height: `44px` (passes touch-safe threshold)
  - Core controls min height: `44px`

- Endpoint p95 recheck (same params used in 6.3):
  - `/api/v1/trends/skater-power...`: `p95 3.91ms`
  - `/api/v1/start-chart...`: `p95 4.22ms`
  - Both now below PRD threshold (`<= 800ms`)

## Notes

- Endpoint improvements rely on short-lived in-process cache and in-flight dedupe.
- For multi-instance production, shared cache behavior depends on deployment topology; further infra-level caching can still be layered if needed.
