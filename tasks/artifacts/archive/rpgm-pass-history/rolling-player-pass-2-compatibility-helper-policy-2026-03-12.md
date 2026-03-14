# Compatibility Helper Policy - 2026-03-12

## Scope

Sub-task `4.1`

This change upgrades [rollingPlayerMetricCompatibility.ts](/Users/tim/Code/fhfhockey.com/web/lib/rollingPlayerMetricCompatibility.ts) from two generic canonical-first wrappers into an explicit compatibility-policy surface that matches the pass-2 authoritative-field classification.

## Policy Implemented

### Canonical-first families

- `ratio`
- `weighted_rate`
- `availability`

These families now resolve canonical values first and use legacy values only as fallback.

### Legacy-first families

- `additive_average`
- `additive_total`
- `toi_average`
- `toi_total`

These families stay legacy-first because additive and TOI `avg` / `total` naming still encodes real meaning and does not yet have a full canonical replacement surface.

## Helper Surface Added

- `resolveFiniteCompatibilityValue(...)`
- `resolveNullableCompatibilityValue(...)`
- `getCompatibilityFieldOrder(...)`

The existing convenience wrappers remain in place:

- `canonicalOrLegacyFinite(...)`
- `canonicalOrLegacyNullable(...)`

They continue to behave as canonical-first weighted-rate helpers for current callers.

## Why This Shape

- It centralizes the audited field-authority policy before downstream migration work starts.
- It gives later tasks a reusable way to migrate readers without re-encoding fallback order in each file.
- It preserves current callers while making family-specific intent explicit.

## Verification

- `npm test -- --run lib/rollingPlayerMetricCompatibility.test.ts`
- `npx tsc --noEmit --pretty false`
