# 02 — Headshot and .playerIdentityCard

Status: planned; source inspection completed, implementation pending. Priority/dependencies: P2; depends on 01 identity.

## Scope and evidence

players supplies identity and image_url; missing image_url can trigger an NHL landing lookup. Branding comes from team_id and local team metadata; logo URLs use team abbreviation. Placeholder selection handles an absent URL, not necessarily a broken remote image.

- [PlayerHeader.tsx](/Users/tim/Code/fhfhockey.com/web/components/WiGO/PlayerHeader.tsx)
- [WigoDashboardSections.tsx](/Users/tim/Code/fhfhockey.com/web/components/WiGO/WigoDashboardSections.tsx)
- [useWigoPlayerDashboard.ts](/Users/tim/Code/fhfhockey.com/web/hooks/useWigoPlayerDashboard.ts)
- [teamsInfo.ts](/Users/tim/Code/fhfhockey.com/web/lib/teamsInfo.ts)

## Distinct implementation plan

1. Check identity provenance, current versus historical team expectations, trade updates, sweater number and team abbreviation aliases. Label current-team context if statistics span multiple teams.

2. Test absent, invalid and failing headshots/logos. Preserve a usable identity card for no-team and no-image players and meaningful alt text.

3. Measure image dimensions, priority and duplicate responsive image loads. Request only the displayed image size and reuse successful fallback lookups.

## Verification and acceptance

Use existing dashboard tests where possible plus browser image-error and layout checks. Acceptance: correct player and team, reliable fallback, no clipped names or layout shift; no new database computation is required.

Before changing code, read [the audit scope and shared completion standard](README.md). Preserve other components and existing user changes. Live production validation and performance measurements are not implied by this source review.
