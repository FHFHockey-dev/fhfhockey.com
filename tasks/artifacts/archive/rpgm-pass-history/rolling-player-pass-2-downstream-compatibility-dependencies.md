## pass-2 downstream compatibility dependencies

Sub-task: `5.1`

This artifact records the current canonical-versus-legacy field usage across the rolling writer and the downstream consumers named in the PRD so later schema decisions can distinguish:

- writer-side compatibility obligations
- readers that still depend on legacy aliases
- readers that already prefer canonical fields with legacy fallback

## Summary

The current surface splits into three dependency classes:

- writer emits both canonical and legacy fields
  - [fetchRollingPlayerAverages.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts)
- downstream readers that are still legacy-first by field name
  - [trends/player/[playerId].tsx](/Users/tim/Code/fhfhockey.com/web/pages/trends/player/[playerId].tsx)
  - [update-start-chart-projections.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-start-chart-projections.ts) for additive averages
  - [skater-queries.ts](/Users/tim/Code/fhfhockey.com/web/lib/projections/queries/skater-queries.ts) for additive totals and some legacy weighted-rate aliases
- downstream readers that already use canonical-first compatibility helpers for some families
  - [run-forge-projections.ts](/Users/tim/Code/fhfhockey.com/web/lib/projections/run-forge-projections.ts)
  - [update-start-chart-projections.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-start-chart-projections.ts) for `sog_per_60`

## 1. Writer-side compatibility surface

### `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts`

Current role:

- emits canonical fields and legacy aliases together
- treats `gp_pct_*` as compatibility-only aliases during the availability transition
- emits additive, ratio, and weighted-rate legacy surfaces alongside canonical snapshots

Observed dependency:

- the writer still has to populate:
  - legacy additive fields such as `*_avg_last5`, `*_avg_season`, `*_total_last5`
  - legacy ratio fields such as `*_avg_last5` and `*_total_last5`
  - legacy weighted-rate aliases such as `sog_per_60_avg_last5`
  - legacy GP fields such as `gp_pct_avg_last5`
- this is intentional and documented inline as transitional compatibility behavior

Implication:

- schema cleanup cannot remove legacy fields yet because multiple downstream readers still query them directly

## 2. Trend page dependency

### `web/pages/trends/player/[playerId].tsx`

Current role:

- builds its select clause dynamically from metric key plus suffix
- all UI selectors use legacy suffixes only:
  - baselines: `avg_season`, `avg_3ya`, `avg_career`, `avg_all`
  - rolling windows: `avg_last3`, `avg_last5`, `avg_last10`, `avg_last20`, `avg_all`

Observed dependency:

- the page reads legacy naming only
- it does not use [rollingPlayerMetricCompatibility.ts](/Users/tim/Code/fhfhockey.com/web/lib/rollingPlayerMetricCompatibility.ts)
- it does not query canonical ratio or weighted-rate aliases such as `*_last5` or `*_season`
- it does not expose canonical availability / participation fields

Implication:

- this page is a hard blocker for retiring legacy `avg_*` naming
- any canonical migration here will need a deliberate UI contract update, not just a query swap

## 3. Projection query dependency

### `web/lib/projections/queries/skater-queries.ts`

Current role:

- defines `ROLLING_ROW_SELECT_CLAUSE` for projection inputs
- fetches rolling EV and PP rows for projection modeling

Observed dependency:

- TOI fields are legacy-only:
  - `toi_seconds_avg_last5`
  - `toi_seconds_avg_all`
- additive counts are legacy total-only:
  - `goals_total_last5`, `shots_total_last5`, `assists_total_last5`
  - `goals_total_all`, `shots_total_all`, `assists_total_all`
- weighted rates are mixed:
  - canonical `sog_per_60_last5`, `sog_per_60_all`, `hits_per_60_last5`, `blocks_per_60_last5`
  - legacy fallback aliases `sog_per_60_avg_last5`, `sog_per_60_avg_all`, `hits_per_60_avg_last5`, `blocks_per_60_avg_last5`

Implication:

- the projection query layer is already partially canonicalized for weighted rates
- additive and TOI surfaces are still tied to legacy naming
- query-shape changes must stay aligned with [run-forge-projections.ts](/Users/tim/Code/fhfhockey.com/web/lib/projections/run-forge-projections.ts)

## 4. FORGE projection pipeline dependency

### `web/lib/projections/run-forge-projections.ts`

Current role:

- consumes EV and PP rolling rows for skater projection modeling
- mixes recent and all-scope rolling rates with multiple adjustment layers

Observed dependency:

- imports `canonicalOrLegacyNullable(...)`
- weighted-rate reads are canonical-first with legacy fallback:
  - `sog_per_60_last5` -> fallback `sog_per_60_avg_last5`
  - `sog_per_60_all` -> fallback `sog_per_60_avg_all`
  - same pattern for `hits_per_60` and `blocks_per_60`
- additive counts still use legacy totals directly:
  - `goals_total_all`, `shots_total_all`, `assists_total_all`
  - `goals_total_last5`, `shots_total_last5`, `assists_total_last5`
  - PP equivalents use the same legacy total naming
- TOI still uses legacy average naming:
  - `toi_seconds_avg_last5`
  - `toi_seconds_avg_all`

Implication:

- the projection engine is the strongest candidate for canonical-first migration because it already uses the compatibility helper
- additive totals and TOI remain direct legacy dependencies and would need either:
  - query-shape updates plus compatibility fallback, or
  - a decision that those legacy names remain authoritative for additive/TOI families

## 5. Start-chart projection endpoint dependency

### `web/pages/api/v1/db/update-start-chart-projections.ts`

Current role:

- reads rolling metrics for a simpler projection endpoint
- projects goals, assists, shots, and fantasy points from rolling form

Observed dependency:

- additive reads are legacy average-only:
  - `goals_avg_last5`, `goals_avg_all`
  - `assists_avg_last5`, `assists_avg_all`
  - `points_avg_last5`, `points_avg_all`
- weighted-rate reads are canonical-first with legacy fallback:
  - `sog_per_60_last5` fallback `sog_per_60_avg_last5`
  - `sog_per_60_all` fallback `sog_per_60_avg_all`
- TOI uses legacy average naming:
  - `toi_seconds_avg_last5`
  - `toi_seconds_avg_all`

Implication:

- this endpoint still depends directly on legacy additive average fields
- it can tolerate canonical weighted-rate migration more easily than additive migration

## 6. Compatibility helper role

### `web/lib/rollingPlayerMetricCompatibility.ts`

Current role:

- provides:
  - `canonicalOrLegacyFinite(...)`
  - `canonicalOrLegacyNullable(...)`

Observed dependency:

- only some downstream readers use it today
- the trend page does not use it
- the FORGE projection pipeline and start-chart endpoint do use it for weighted-rate compatibility

Implication:

- the helper already defines the preferred migration pattern for downstream readers:
  - canonical first
  - legacy fallback only where needed
- wider adoption of this helper is the lowest-risk path for downstream canonical migration

## Compatibility conclusions for later tasks

- legacy `avg_*` naming is still an active downstream contract, not dead surface
- additive totals and TOI remain the heaviest direct legacy dependencies in projection consumers
- weighted-rate families are the farthest along in canonical adoption because compatibility helpers are already in use there
- the player trend page is the clearest reader that still encodes legacy naming into its UI model rather than only its query layer
- no later schema-retirement step should proceed until each of these readers is either:
  - updated to canonical-first reads with compatibility fallback, or
  - explicitly frozen as a legacy-only consumer with documented migration debt
