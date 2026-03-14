# Forge Dashboard Rollout Notes (6.6)

Date: 2026-03-05  
Route: `/forge/dashboard`

## What Is Included

- New Forge dashboard page with six MVP modules:
  - Team Power Rankings
  - Sustainable vs Unsustainable
  - Hot / Cold Streaks
  - Goalie Start + Risk
  - Tonight's Slate
  - Top Movers (team/skater lens toggle)
- Shared global filters (date/team/position) with module-consistent updates.
- Audited endpoint and dependency coverage with automated invariant/contract checks.
- Desktop no-scroll remediation at target desktop viewports.
- Mobile/tablet touch-target remediation for interactive controls.

## Launch Gate Status

- Manual QA: PASS (desktop + mobile/tablet after remediation)
- Automated endpoint suite: PASS
- Full test suite: PASS (`22` files, `148` tests)

## Known Limitations

1. Endpoint latency improvements in `skater-power` and `start-chart` currently use in-process memory caching and in-flight dedupe.
2. In multi-instance deployments, cache benefits are per-instance unless backed by shared caching infrastructure.
3. Desktop no-scroll budget uses an explicit page height offset tied to current global header/footer sizing (`100dvh - 130px`); if global chrome sizes change, this may need adjustment.
4. Performance measurements were gathered in local dev mode and should be re-validated in a production-like environment.

## Post-Launch Monitoring Actions

1. Monitor p50/p95 latency and error rates for:
   - `/api/team-ratings`
   - `/api/v1/trends/team-ctpi`
   - `/api/v1/trends/skater-power`
   - `/api/v1/sustainability/trends`
   - `/api/v1/forge/goalies`
   - `/api/v1/start-chart`
2. Alert on endpoint p95 regression above `800ms` sustained over 15-minute windows.
3. Track dashboard render health:
   - module error-state rate
   - stale/fallback-state frequency
   - client-side filter interaction failures
4. Run periodic viewport regression checks (`1440x900`, `1920x1080`, `390x844`, `430x932`, `768x1024`, `834x1194`) to catch layout drift.

## Rollback/Contingency

1. Keep legacy `FORGE` route active as fallback entry point.
2. If critical dashboard regressions occur, direct traffic/nav links back to `/FORGE` while remediation is applied.
