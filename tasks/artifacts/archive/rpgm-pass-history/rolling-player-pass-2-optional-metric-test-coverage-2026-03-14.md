# Optional metric coverage sweep

## Scope

This closes the explicit test-coverage pass for the optional metrics added in
task group `5.x`.

## Coverage added or reaffirmed

- `primary_assists`
- `secondary_assists`
- `penalties_drawn`
- `penalties_drawn_per_60`
- `pp_toi_seconds`

## Test focus

### Validation payload formulas

`rollingPlayerValidationPayload.test.ts` now verifies formula metadata for the
optional metric families across:

- additive surface-count metrics
- weighted-rate metrics
- PP-usage additive metrics

### Validation-console visibility

`trendsDebug.test.tsx` now verifies:

- direct PP deployment visibility for `pp_toi_seconds`
- selector visibility for authoritative additive legacy optional metrics in
  canonical view
- hiding of compatibility-only weighted-rate legacy aliases when canonical view
  is active
- formula-audit copy output for an optional metric

## Verification

- `npm test -- --run lib/supabase/Upserts/rollingPlayerValidationPayload.test.ts pages/trendsDebug.test.tsx`
- `npx tsc --noEmit --pretty false`
