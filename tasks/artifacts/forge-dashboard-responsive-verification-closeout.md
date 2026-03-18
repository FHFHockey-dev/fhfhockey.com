# FORGE Dashboard Responsive And Verification Closeout

## Scope

This artifact closes task-list phase `7.0`:

- `7.1` Responsive desktop/mobile behavior
- `7.2` Section-specific stale-state handling
- `7.3` Page and route tests
- `7.4` Dashboard adapter / contract tests
- `7.5` Nav, click-through, mobile, and ownership-filter verification
- `7.6` Full regression and production build verification

## Responsive Behavior

The dashboard now has an explicit mobile accordion mode driven by `matchMedia("(max-width: 767px)")`.

Default mobile expansion state:

- `Tonight's Slate`: expanded
- `Team Trend Context`: collapsed
- `Player Insight Core`: expanded
- `Goalie and Risk`: expanded

Desktop keeps the full multi-band scan layout, while mobile hides heavy sections behind band toggles instead of forcing long uninterrupted scroll.

## Stale And Degraded States

Stale/degraded handling is now implemented at both band level and route level.

### Dashboard bands

Each band aggregates child-module status for:

- loading
- error
- stale
- empty

### FORGE route family

`FORGE.tsx`, `/forge/team/[teamId]`, and `/forge/player/[playerId]` now use local degraded-state behavior:

- partial preview feeds can fail without blanking the route
- stale source dates are surfaced explicitly
- hard failure is reserved for genuinely unusable route state

## Verification Coverage

### Page / route tests

- `web/__tests__/pages/forge/dashboard.test.tsx`
- `web/__tests__/pages/FORGE.test.tsx`
- `web/__tests__/pages/forge/team/[teamId].test.tsx`
- `web/__tests__/pages/forge/player/[playerId].test.tsx`

### Adapter / contract tests

- `web/lib/dashboard/normalizers.test.ts`
- `web/lib/dashboard/playerOwnership.test.ts`
- `web/lib/dashboard/teamContext.test.ts`
- `web/lib/dashboard/topAddsRanking.test.ts`
- `web/lib/dashboard/topAddsScheduleContext.test.ts`

## Final Verification

The final closeout verification stack is:

- `npm test -- --run`
- `npx tsc --noEmit --pretty false`
- `npm run build`

## Build Cleanliness Fixes

Two build-path adjustments were required for reliable closeout:

- `next.config.js`
  - use config-based `eslint.ignoreDuringBuilds` instead of the CLI `--no-lint` flag
  - clean the dist directory during build by default
- `package.json`
  - use `NEXT_TELEMETRY_DISABLED=1 next build`

This removed the stale-route build crash and avoided the CLI warning banner produced by `next build --no-lint`.
