# Rolling Player Pass-2 Ratio Family Audit

## Purpose

This artifact is the ratio-family portion of the pass-2 audit.

It covers every persisted ratio metric family in `rolling_player_game_metrics` and records, for each family:

- stored field set
- source tables
- source fields
- code path
- canonical formula
- intended hockey meaning
- current stored-field behavior
- reconstruction method
- scale contract
- window semantics
- component completeness rules

This artifact does not assign final status buckets yet. Status ledger work remains separate in `/Users/tim/Code/fhfhockey.com/tasks/rpm-audit-notes-pass-2.md`.

## Scope

Ratio family surface from the generated row type:

- ratio families: `11`
- legacy ratio fields: `143`
- canonical ratio alias fields: `88`
- dedicated ratio support fields: `144`
- total persisted ratio-related fields in scope for this artifact: `375`

Legacy ratio families using the full 13-field grid:

- `shooting_pct`
- `expected_sh_pct`
- `primary_points_pct`
- `ipp`
- `oz_start_pct`
- `pp_share_pct`
- `on_ice_sh_pct`
- `on_ice_sv_pct`
- `pdo`
- `cf_pct`
- `ff_pct`

Canonical ratio alias families using the full 8-field grid:

- `shooting_pct`
- `expected_sh_pct`
- `primary_points_pct`
- `ipp`
- `oz_start_pct`
- `pp_share_pct`
- `on_ice_sh_pct`
- `on_ice_sv_pct`
- `pdo`
- `cf_pct`
- `ff_pct`

Dedicated support-field groupings:

- historical-only support via additive companions:
  - `shooting_pct`
  - `expected_sh_pct`
  - `cf_pct`
  - `ff_pct`
- full-scope support fields:
  - `primary_points_pct`
  - `ipp`
  - `on_ice_sh_pct`
  - `pdo`
  - `oz_start_pct`
  - `pp_share_pct`
- no dedicated persisted support columns:
  - `on_ice_sv_pct`

## Shared Ratio Contract

### Upstream row assembly

Ratio metrics use the same WGO-spined row construction as the additive suite:

- row spine:
  - `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts`
  - `fetchWgoRowsForPlayer(...)`
  - `buildGameRecords(...)`
- player-count additive companions:
  - split-specific `nst_gamelog_*_counts`
  - all-strength WGO fallback only where the source-selection contract allows it
- on-ice context companions:
  - split-specific `nst_gamelog_*_counts_oi`
- PP share context:
  - `powerPlayCombinations`
  - fallback `wgo_skater_stats`

### Ratio accumulation code path

Ratio metrics are the `aggregation: "ratio"` entries in `METRICS`:

- `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts`

Runtime flow:

1. `buildGameRecords(...)` merges WGO, NST counts, NST rates, NST on-ice counts, PP rows, and line rows into `PlayerGameData`
2. each ratio metric resolves per-game raw components through `metric.getComponents(game)`
3. `updateRatioRollingAccumulator(...)` accumulates raw components into:
   - `all`
   - `last3`
   - `last5`
   - `last10`
   - `last20`
4. `updateHistoricalRatioAccumulator(...)` accumulates season buckets for:
   - `season`
   - `3ya`
   - `career`
5. `getRatioRollingSnapshot(...)` and `getHistoricalRatioSnapshot(...)` derive the stored ratio values
6. `applyRatioSupportOutputs(...)` writes persisted numerator / denominator companion fields where the schema supports them

### Canonical ratio window contract

Ratio metrics use the `ratio_performance` family from `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingWindowContract.ts`.

Shared rules:

- selection unit:
  - player's chronological appearances in the relevant strength state
- aggregation method:
  - ratio of aggregated components inside the selected appearance window
- selected-slot behavior:
  - selected appearance slots always count once the player appeared
- missing numerator behavior:
  - coerce to `0` when a denominator exists
- missing denominator behavior:
  - keep the selected appearance slot but exclude components from aggregation

Appearance anchor behavior:

- `strength = "all"`:
  - every WGO row counts as an appearance
- split-strength rows:
  - appearance requires resolved split TOI `> 0`

Important ratio consequence:

- the pipeline never averages per-game percentages
- every stored ratio is a ratio-of-aggregates over the selected scope

### Shared scale contract

Scale guardrails from `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingMetricScaleContract.ts`:

- `shooting_pct`: percent `0-100`
- `primary_points_pct`: fraction `0-1`
- `expected_sh_pct`: fraction `0-1`
- `ipp`: percent `0-100`
- `oz_start_pct`: percent `0-100`
- `pp_share_pct`: fraction `0-1`
- `on_ice_sh_pct`: percent `0-100`
- `on_ice_sv_pct`: percent `0-100`
- `pdo`: index `0-2`
- `cf_pct`: percent `0-100`
- `ff_pct`: percent `0-100`

These scales are enforced only as diagnostics and suspicious-output warnings. They do not alter the stored arithmetic.

## Ratio Family Audit

### 1. Player Finishing and Shot-Quality Ratios

Families:

- `shooting_pct`
- `expected_sh_pct`
- `primary_points_pct`

Stored field set:

- each family uses:
  - full 13-field legacy ratio grid
  - full 8-field canonical alias grid
- dedicated support-field coverage:
  - `shooting_pct`: historical-only support
  - `expected_sh_pct`: historical-only support
  - `primary_points_pct`: full-scope support

Source tables:

- player counts:
  - split-specific `nst_gamelog_*_counts`
- all-strength fallback where allowed:
  - `wgo_skater_stats`

Source fields by family:

- `shooting_pct`
  - numerator:
    - `goals`
    - resolved through NST counts first, WGO all-strength fallback second
  - denominator:
    - `shots`
    - resolved through NST counts first, WGO all-strength fallback second
- `expected_sh_pct`
  - numerator:
    - `ixg`
    - resolved through `resolveIxgValue(...)`
  - denominator:
    - `shots`
- `primary_points_pct`
  - numerator:
    - `counts.goals + counts.first_assists`
  - denominator:
    - `counts.total_points`

Primary code path:

- `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts`
  - `METRICS` ratio entries
  - `getGoals(...)`
  - `getShots(...)`
  - `getPoints(...)`
  - `resolveIxgValue(...)`
- source-selection helper:
  - `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerSourceSelection.ts`
- ratio math:
  - `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingMetricAggregation.ts`

Canonical formulas:

- `shooting_pct = sum(goals) / sum(shots) * 100`
- `expected_sh_pct = sum(ixg) / sum(shots)`
- `primary_points_pct = sum(goals + first_assists) / sum(total_points)`

Intended hockey meaning:

- `shooting_pct`:
  - actual conversion rate on player shots
- `expected_sh_pct`:
  - average xG value per shot, stored as fraction rather than percent
- `primary_points_pct`:
  - share of player points that were primary points

Current stored-field behavior:

- `*_total_*` and `*_avg_*` are identical for ratio families because both write the derived ratio snapshot, not an average of ratios
- canonical `*_all`, `*_lastN`, `*_season`, `*_3ya`, and `*_career` duplicate the same ratio snapshot under the new contract
- `shooting_pct` and `expected_sh_pct` persist dedicated support only for `season`, `3ya`, and `career`
- `primary_points_pct` persists support fields for all scopes

Scale review:

- `shooting_pct`: percent scale is intentional
- `expected_sh_pct`: fraction scale is intentional and must not be displayed as percent without conversion
- `primary_points_pct`: fraction scale is intentional

Window / component completeness review:

- all three families use appearance-anchored ratio windows
- if a selected appearance has a denominator but a null numerator, numerator is treated as `0`
- if a selected appearance has no denominator, the appearance slot remains in the `lastN` window but contributes no aggregated components

Reconstruction method:

1. reconstruct additive companions per game
2. select the fixed appearance window
3. aggregate raw numerators and denominators inside the window
4. apply the family scale:
   - `* 100` for `shooting_pct`
   - no scale for `expected_sh_pct`
   - no scale for `primary_points_pct`

Evidence from tests:

- `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingMetricAggregation.test.ts`
  - confirms ratio-of-aggregates arithmetic
  - confirms appearance-anchored windows
  - confirms null-vs-zero denominator behavior
- `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/fetchRollingPlayerAverages.test.ts`
  - confirms canonical ratio snapshots and support-field persistence for `primary_points_pct`
- `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingMetricScaleContract.test.ts`
  - confirms stored scale contract

### 2. On-Ice and Possession Ratios

Families:

- `ipp`
- `on_ice_sh_pct`
- `on_ice_sv_pct`
- `pdo`
- `cf_pct`
- `ff_pct`
- `oz_start_pct`

Stored field set:

- each family uses:
  - full 13-field legacy ratio grid
  - full 8-field canonical alias grid
- dedicated support-field coverage:
  - `ipp`: full-scope support
  - `on_ice_sh_pct`: full-scope support
  - `pdo`: full-scope support
  - `oz_start_pct`: full-scope support
  - `cf_pct`: historical-only support
  - `ff_pct`: historical-only support
  - `on_ice_sv_pct`: no dedicated support columns

Source tables:

- authoritative:
  - split-specific `nst_gamelog_*_counts_oi`

Source fields by family:

- `ipp`
  - numerator:
    - `points`
    - resolved from player scoring sources
  - denominator:
    - `countsOi.gf`
- `on_ice_sh_pct`
  - numerator:
    - `countsOi.gf`
  - denominator:
    - `countsOi.sf`
- `on_ice_sv_pct`
  - numerator:
    - `countsOi.sa - countsOi.ga`
  - denominator:
    - `countsOi.sa`
- `pdo`
  - primary numerator:
    - `countsOi.gf`
  - primary denominator:
    - `countsOi.sf`
  - secondary numerator:
    - `countsOi.sa - countsOi.ga`
  - secondary denominator:
    - `countsOi.sa`
- `cf_pct`
  - numerator:
    - `countsOi.cf`
  - denominator:
    - `countsOi.cf + countsOi.ca`
- `ff_pct`
  - numerator:
    - `countsOi.ff`
  - denominator:
    - `countsOi.ff + countsOi.fa`
- `oz_start_pct`
  - numerator:
    - `countsOi.off_zone_starts`
  - denominator:
    - `countsOi.off_zone_starts + countsOi.def_zone_starts`
  - persisted companion support:
    - neutral-zone starts are stored separately and intentionally excluded from the denominator

Primary code path:

- `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts`
  - `METRICS` ratio entries
  - `applyRatioSupportOutputs(...)`
- ratio math:
  - `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingMetricAggregation.ts`

Canonical formulas:

- `ipp = sum(points) / sum(on_ice_goals_for) * 100`
- `on_ice_sh_pct = sum(on_ice_goals_for) / sum(on_ice_shots_for) * 100`
- `on_ice_sv_pct = sum(on_ice_shots_against - on_ice_goals_against) / sum(on_ice_shots_against) * 100`
- `pdo = ((sum(on_ice_goals_for) / sum(on_ice_shots_for)) * 100 + (sum(on_ice_shots_against - on_ice_goals_against) / sum(on_ice_shots_against)) * 100) * 0.01`
- `cf_pct = sum(corsi_for) / sum(corsi_for + corsi_against) * 100`
- `ff_pct = sum(fenwick_for) / sum(fenwick_for + fenwick_against) * 100`
- `oz_start_pct = sum(off_zone_starts) / sum(off_zone_starts + def_zone_starts) * 100`

Intended hockey meaning:

- `ipp`:
  - share of on-ice goals the player recorded a point on
- `on_ice_sh_pct`:
  - team finishing rate while player is on ice
- `on_ice_sv_pct`:
  - save percentage while player is on ice
- `pdo`:
  - on-ice shooting plus on-ice save percentage on a `0-2` index scale
- `cf_pct` / `ff_pct`:
  - share of total Corsi or Fenwick events controlled by the player's team
- `oz_start_pct`:
  - offensive-zone share of non-neutral zone starts

Current stored-field behavior:

- `ipp`, `on_ice_sh_pct`, `pdo`, and `oz_start_pct` have direct persisted component columns for every scope
- `cf_pct` and `ff_pct` rely on additive `cf`, `ca`, `ff`, and `fa` for `all` and `lastN` reconstruction, and persist dedicated support only for `season`, `3ya`, and `career`
- `on_ice_sv_pct` has no dedicated persisted numerator / denominator support columns; reconstruction must use additive `oi_sa` and `oi_ga`
- `oz_start_pct_def_zone_starts_*` is derived as denominator minus numerator, not read from a standalone ratio accumulator
- `oz_start_pct_neutral_zone_starts_*` is persisted from support accumulators even though neutral-zone starts are excluded from the percentage denominator
- `pdo_goals_against_*` is derived as `shots_against - saves`

Scale review:

- `ipp`, `on_ice_sh_pct`, `on_ice_sv_pct`, `cf_pct`, `ff_pct`, `oz_start_pct` are all `0-100` percent scales
- `pdo` is intentionally stored on a `0-2` index scale, not `0-200`

Window / component completeness review:

- all families use appearance-anchored ratio windows
- on-ice families are only meaningful when `countsOi` exists for the row
- `oz_start_pct` keeps the appearance slot even if offensive / defensive zone start denominator is absent
- `on_ice_sv_pct` completeness depends on additive `oi_sa` and `oi_ga` companions because the ratio family itself has no dedicated support columns

Reconstruction method:

1. load split-specific NST on-ice counts by game date
2. reconstruct per-game raw components
3. select the fixed appearance window
4. aggregate components
5. derive the ratio snapshot with the stored scale
6. when dedicated support fields do not exist, reconstruct from additive companions:
   - `on_ice_sv_pct` from `oi_sa` and `oi_ga`
   - `cf_pct` all/lastN from `cf` and `ca`
   - `ff_pct` all/lastN from `ff` and `fa`

Evidence from tests:

- `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/fetchRollingPlayerAverages.test.ts`
  - confirms `oz_start_pct` support fields, including neutral-zone counts
  - confirms canonical `on_ice_sv_pct` snapshots
  - confirms additive companion surfaces for `oi_gf`, `oi_ga`, `oi_sf`, and `oi_sa`
- `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingMetricAggregation.test.ts`
  - confirms composite ratio arithmetic for `pdo`
- `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingMetricScaleContract.test.ts`
  - confirms `pdo` scale contract

### 3. Power-Play Share Ratio

Family:

- `pp_share_pct`

Stored field set:

- full 13-field legacy ratio grid
- full 8-field canonical alias grid
- full-scope support fields:
  - `pp_share_pct_player_pp_toi_*`
  - `pp_share_pct_team_pp_toi_*`

Source tables:

- authoritative:
  - `powerPlayCombinations`
- fallback:
  - `wgo_skater_stats`

Source fields:

- authoritative numerator:
  - `powerPlayCombinations.PPTOI`
- authoritative share:
  - `powerPlayCombinations.pp_share_of_team`
- fallback numerator:
  - `wgo_skater_stats.pp_toi`
- fallback share:
  - `wgo_skater_stats.pp_toi_pct_per_game`
- explicitly excluded:
  - `powerPlayCombinations.percentageOfPP`
  - `powerPlayCombinations.pp_unit_usage_index`
  - `powerPlayCombinations.pp_unit_relative_toi`
  - `powerPlayCombinations.pp_vs_unit_avg`

Primary code path:

- `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts`
  - `getPpShareComponents(...)`
- `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerPpShareContract.ts`
  - `resolvePpShareComponents(...)`
  - `ROLLING_PLAYER_PP_SHARE_CONTRACT`
- share math helper:
  - `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerMetricMath.ts`
  - `resolvePreferredShareComponents(...)`

Canonical formula:

- `pp_share_pct = sum(player_pp_toi) / sum(team_pp_toi_inferred_from_team_share)`

Where per-game team PP TOI is reconstructed as:

- `team_pp_toi = player_pp_toi / team_share`

Intended hockey meaning:

- player share of total team power-play TOI
- not unit-relative usage
- not share of PP1 only

Current stored-field behavior:

- valid only for `all` and `pp` rows
- `ev` and `pk` rows should be treated as non-applicable for validation
- builder-derived team share is authoritative
- WGO is fallback-only when builder coverage is missing
- persisted support fields expose the resolved player PP TOI numerator and reconstructed team PP TOI denominator for every stored scope

Scale review:

- `pp_share_pct` is intentionally a `0-1` fraction

Window / component completeness review:

- uses the standard appearance-anchored ratio window
- if the selected appearance has PP share inputs missing, the appearance slot remains but contributes no components
- mixed builder / WGO source windows remain arithmetically valid but must be called out during validation because the denominator source path can vary row by row

Reconstruction method:

1. prefer builder `PPTOI` plus `pp_share_of_team`
2. if builder coverage is missing, fall back to WGO `pp_toi` plus `pp_toi_pct_per_game`
3. reconstruct per-game team PP TOI as `player_pp_toi / share`
4. aggregate player PP TOI and team PP TOI inside the selected appearance window
5. divide aggregated player PP TOI by aggregated team PP TOI

Evidence from tests:

- `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerPpShareContract.test.ts`
  - confirms builder preference over WGO fallback
  - confirms unit-relative fields are excluded from the semantic contract
- `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingMetricScaleContract.test.ts`
  - confirms fraction scale
- `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerPipelineDiagnostics.test.ts`
  - confirms suspicious-output warnings flag out-of-range `pp_share_pct` snapshots while ignoring raw PP support columns

## Component Completeness Notes

- `shooting_pct`, `expected_sh_pct`, `cf_pct`, and `ff_pct` rely on additive companions for `all` and `lastN` reconstruction; only historical scopes have dedicated ratio support columns.
- `primary_points_pct`, `ipp`, `on_ice_sh_pct`, `pdo`, `oz_start_pct`, and `pp_share_pct` expose direct persisted support fields for every scope.
- `on_ice_sv_pct` has no direct support columns. Pass-2 validation must reconstruct it from additive `oi_sa` and `oi_ga` rows.
- ratio outputs are expected to mirror between legacy `*_total_*`, legacy `*_avg_*`, and canonical scoped aliases. Any drift between these surfaces is contract drift, not product intent.

## Scale and Diagnostics Notes

- suspicious-output diagnostics should validate only the scaled snapshot fields, not raw support columns
- support columns can legitimately exceed ratio scale bounds because they store raw counts or reconstructed denominators
- `pdo` requires special handling because valid values cluster around `1`, not `100`
- `expected_sh_pct` and `pp_share_pct` require fraction-aware UI formatting in `trendsDebug.tsx`

## How This Artifact Should Be Used

- task `2.3` should compare weighted-rate families against the same ratio-aggregation mechanics, with TOI-specific source review added
- tasks `2.6` and `2.7` should translate each audited ratio family into:
  - a formula-only status entry in `/Users/tim/Code/fhfhockey.com/tasks/rpm-audit-notes-pass-2.md`
  - an action item in `/Users/tim/Code/fhfhockey.com/tasks/rpm-audit-action-items-pass-2.md` whenever support visibility, naming, fallback clarity, or reconstruction friction needs follow-up
- tasks in `3.x` should use this artifact as the reconstruction reference during live validation and freshness checks
