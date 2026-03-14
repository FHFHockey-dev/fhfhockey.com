# Optional metric compatibility and selector follow-up

## Scope

This follow-up closes the selector / compatibility gap left after the optional
metric additions landed.

## Problem

`trendsDebug.tsx` previously hid every legacy-shaped field whenever
`Canonical View` was active. That was too aggressive:

- compatibility-only legacy aliases should stay hidden by default
- authoritative legacy additive and TOI surfaces should stay visible by default

That affected the new optional additive metrics directly because they do not
have canonical additive aliases:

- `primary_assists_avg_*`
- `secondary_assists_avg_*`
- `penalties_drawn_avg_*`
- `pp_toi_seconds_avg_*`

## Implementation

- Reused `rollingPlayerMetricCompatibility.ts` instead of local page-only
  legacy detection.
- Added `isAuthoritativeLegacyField(...)` to make the distinction explicit:
  - authoritative legacy additive / TOI fields remain part of the active read surface
  - compatibility-only legacy ratio / weighted-rate / GP aliases remain freeze candidates
- Updated `trendsDebug.tsx` metric-selector filtering so `Canonical View` hides
  only compatibility-only legacy aliases, not authoritative additive legacy fields.

## Result

With `Canonical View` active:

- `penalties_drawn_avg_last5` remains selectable
- `pp_toi_seconds_avg_last5` remains selectable
- `primary_assists_avg_last5` remains selectable
- `penalties_drawn_per_60_avg_last5` stays hidden in favor of canonical
  `penalties_drawn_per_60_last5`

## Verification

- compatibility helper regression coverage now includes optional metric field
  classification
- `trendsDebug` regression coverage now verifies selector visibility for
  authoritative additive legacy metrics versus compatibility-only legacy aliases
