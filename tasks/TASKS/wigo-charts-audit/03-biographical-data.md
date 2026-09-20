# 03 — Biographical .playerMetaGrid

Status: planned; source inspection completed, implementation pending. Priority/dependencies: P2; depends on 01 identity.

## Scope and evidence

Age is calculated with UTC birthday comparison. Height converts centimeters to rounded whole inches; weight converts kilograms to pounds. Position comes from the player record. Values are assumed present and valid.

- [WigoDashboardSections.tsx](/Users/tim/Code/fhfhockey.com/web/components/WiGO/WigoDashboardSections.tsx)
- [types.ts](/Users/tim/Code/fhfhockey.com/web/components/WiGO/types.ts)

## Distinct implementation plan

1. Verify raw player field units and nullable shapes before conversion. Add explicit unavailable display for invalid dates, missing height/weight and unsupported positions; never render NaN or plausible zero measurements.

2. Keep age as of today unless a historical-age feature is explicitly requested. Specify UTC/local birthday convention and handle leap-day births consistently.

3. Reuse the selected-player data; no independent fetch or derived-data pipeline is warranted.

## Verification and acceptance

Check birthday before/on/after, leap day, malformed date, null values, and rounding across feet/inches boundaries. Acceptance: correct readable age/height/weight/position with no additional network request.

Before changing code, read [the audit scope and shared completion standard](README.md). Preserve other components and existing user changes. Live production validation and performance measurements are not implied by this source review.

## Implementation evidence — September 19, 2026

Complete locally. The roster adapter (`web/lib/sources/nhlRosterPreview.ts`) and individual landing adapter (`web/pages/api/v1/db/update-player/[playerId].ts`) read NHL centimeter/kilogram fields. Both writers preserve those units in `players`; the dashboard reuses the selected record. Source fallback zero measurements display as unavailable.

`playerBiography.ts` now owns the existing unit conversions and UTC age calculation. It rejects impossible/future dates, handles February 29 birthdays on March 1 in non-leap years, carries rounded inches into feet, and gives unavailable states for invalid measurements/positions. The grid uses these helpers without an additional request. Nineteen focused tests, targeted ESLint and the full TypeScript check pass. Browser rendering remains part of the shared responsive acceptance, not a claim made here.
