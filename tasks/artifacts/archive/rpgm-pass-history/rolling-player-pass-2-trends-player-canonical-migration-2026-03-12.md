# Trends Player Canonical Migration - 2026-03-12

## Scope

Sub-task `4.2`

This change migrates [player/[playerId].tsx](/Users/tim/Code/fhfhockey.com/web/pages/trends/player/[playerId].tsx) away from hardcoded legacy suffix selection and onto family-aware compatibility resolution.

## What Changed

- Baseline and rolling-window selectors now use logical scopes:
  - baselines: `season`, `3ya`, `career`, `all`
  - rolling windows: `last3`, `last5`, `last10`, `last20`, `all`
- The page no longer assumes that every visible field is `metric_avg_*`.
- Field selection now goes through per-metric compatibility logic:
  - ratio metrics resolve canonical-first with legacy fallback
  - weighted-rate metrics resolve canonical-first with legacy fallback
  - additive average metrics remain legacy-first
  - TOI average metrics remain legacy-first

## Resulting Page Behavior

### Canonical-first on the page now

- `shooting_pct`
- `expected_sh_pct`
- `on_ice_sh_pct`
- `on_ice_sv_pct`
- `pdo`
- `ipp`
- `primary_points_pct`
- `pp_share_pct`
- `oz_start_pct`
- `cf_pct`
- `ff_pct`
- all `*_per_60` metrics shown on the page

These now read canonical fields such as `metric_last5` and `metric_season` first, with legacy `metric_avg_last5` / `metric_avg_season` only as fallback.

### Still legacy-first by design

- additive rolling averages such as `goals_avg_last5`, `assists_avg_last5`, `ixg_avg_last5`, `oi_gf_avg_last5`
- TOI average fields such as `toi_seconds_avg_last5`

These remain legacy-first because their `avg` semantics are still authoritative and not replaced by canonical aliases.

## Query Surface Change

`SELECT_CLAUSE` is now built from per-metric field candidates rather than a blanket `${metric}_${mode}` pattern.

That means the page requests:

- canonical plus legacy fallback fields for ratio and weighted-rate families
- only the authoritative legacy average fields for additive-average and TOI-average families

## Verification

- `npx tsc --noEmit --pretty false`
- `npm test -- --run lib/rollingPlayerMetricCompatibility.test.ts`
