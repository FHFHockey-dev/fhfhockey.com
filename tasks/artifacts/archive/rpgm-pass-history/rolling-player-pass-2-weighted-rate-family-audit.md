# Rolling Player Pass-2 Weighted-Rate Family Audit

## Purpose

This artifact is the weighted-rate-family portion of the pass-2 audit.

It covers every persisted weighted-rate metric family in `rolling_player_game_metrics` and records, for each family:

- stored field set
- source tables
- source fields
- code path
- canonical formula
- intended hockey meaning
- current stored-field behavior
- reconstruction method
- TOI source precedence
- rate-reconstruction rules
- window semantics
- component completeness rules

This artifact does not assign final status buckets yet. Status ledger work remains separate in `/Users/tim/Code/fhfhockey.com/tasks/rpm-audit-notes-pass-2.md`.

## Scope

Weighted-rate family surface from the generated row type:

- weighted-rate families: `8`
- legacy weighted-rate fields: `104`
- canonical weighted-rate alias fields: `64`
- dedicated weighted-rate support fields: `48`
- total persisted weighted-rate-related fields in scope for this artifact: `216`

Legacy weighted-rate families using the full 13-field grid:

- `sog_per_60`
- `ixg_per_60`
- `goals_per_60`
- `assists_per_60`
- `primary_assists_per_60`
- `secondary_assists_per_60`
- `hits_per_60`
- `blocks_per_60`

Canonical weighted-rate alias families using the full 8-field grid:

- `sog_per_60`
- `ixg_per_60`
- `goals_per_60`
- `assists_per_60`
- `primary_assists_per_60`
- `secondary_assists_per_60`
- `hits_per_60`
- `blocks_per_60`

Dedicated persisted support-field coverage:

- historical-only support for every family:
  - numerator historical scopes:
    - `_season`
    - `_3ya`
    - `_career`
  - TOI denominator historical scopes:
    - `_season`
    - `_3ya`
    - `_career`

No dedicated `all` or `lastN` weighted-rate support columns exist. Those scopes must be reconstructed from additive companions plus `toi_seconds`.

## Shared Weighted-Rate Contract

### Upstream row assembly

Weighted-rate metrics use the same WGO-spined row construction as the rest of the rolling suite:

- row spine:
  - `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts`
  - `fetchWgoRowsForPlayer(...)`
  - `buildGameRecords(...)`
- player-count sources:
  - split-specific `nst_gamelog_*_counts`
- supplementary rate sources:
  - split-specific `nst_gamelog_*_rates`
- TOI authorities and fallbacks:
  - split-specific `nst_gamelog_*_counts`
  - split-specific `nst_gamelog_*_counts_oi`
  - split-specific `nst_gamelog_*_rates`
  - WGO-derived fallback seed and normalization path

### Weighted-rate accumulation code path

Weighted-rate metrics are stored as ratio-style component accumulators with the `weighted_rate_performance` contract:

- `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts`
- `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingMetricAggregation.ts`
- `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerMetricMath.ts`

Runtime flow:

1. `buildGameRecords(...)` builds `PlayerGameData`
2. each weighted-rate metric resolves a per-game component pair:
   - numerator:
     - raw event total or reconstructed implied total
   - denominator:
     - resolved TOI seconds
3. `updateRatioRollingAccumulator(...)` accumulates the raw event and TOI components inside:
   - `all`
   - `last3`
   - `last5`
   - `last10`
   - `last20`
4. `updateHistoricalRatioAccumulator(...)` accumulates the same raw components across season buckets
5. `getRatioRollingSnapshot(...)` and `getHistoricalRatioSnapshot(...)` apply the `/60` scale
6. `applyRatioSupportOutputs(...)` writes historical numerator and TOI support columns

### Canonical weighted-rate window contract

Weighted-rate metrics use the `weighted_rate_performance` family from `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingWindowContract.ts`.

Shared rules:

- selection unit:
  - player's chronological appearances in the relevant strength state
- aggregation method:
  - aggregate raw event totals and TOI across the selected appearance window, then apply `/60`
- selected-slot behavior:
  - selected appearance slots always count once the player appeared
- missing numerator behavior:
  - coerce to `0` when TOI is present
- missing denominator behavior:
  - keep the selected appearance slot but exclude components from aggregation

Important weighted-rate consequence:

- the pipeline never averages per-game `/60` values
- every stored `/60` metric is a weighted rate derived from aggregated raw events and aggregated TOI

### Shared formula

For any weighted-rate family `x_per_60`:

- `x_per_60 = sum(raw_event_x) / sum(toi_seconds) * 3600`

### Shared TOI source precedence

TOI resolution comes from `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerToiContract.ts`.

Priority order:

1. `nst_gamelog_*_counts.toi`
2. `nst_gamelog_*_counts_oi.toi`
3. `nst_gamelog_*_rates.toi_per_gp`
4. fallback seed produced by `resolveFallbackToiSeed(...)`
5. normalized `wgo_skater_stats.toi_per_game` if everything above is unavailable

Trust tiers:

- `counts`
  - source: `authoritative`
- `counts_oi`
  - source: `authoritative`
- `rates`
  - source: `supplementary`
- `fallback`
  - source: `fallback`
- `wgo`
  - source: `fallback`

WGO normalization rules:

- values above `200` are treated as already-seconds
- smaller positive values are converted from minutes to seconds
- suspicious values are rejected and surfaced through diagnostics

## Family Audit

### 1. Shot and xG Weighted Rates

Families:

- `sog_per_60`
- `ixg_per_60`

Stored field set:

- each family uses:
  - full 13-field legacy weighted-rate grid
  - full 8-field canonical alias grid
  - 6 historical support fields:
    - numerator `_season`, `_3ya`, `_career`
    - `toi_seconds` denominator `_season`, `_3ya`, `_career`

Source tables:

- raw numerator authority:
  - split-specific `nst_gamelog_*_counts`
- supplementary per-60 source:
  - split-specific `nst_gamelog_*_rates`
- all-strength fallback where allowed:
  - `wgo_skater_stats`
- TOI authority:
  - counts, counts_oi, rates, fallback seed, WGO normalization path

Source fields by family:

- `sog_per_60`
  - preferred numerator:
    - `shots`
    - resolved through `getShots(game)`
  - rate fallback:
    - `rates.shots_per_60`
  - denominator:
    - `getToiSeconds(game)`
- `ixg_per_60`
  - preferred numerator:
    - `counts.ixg`
  - all-strength fallback:
    - `wgo.ixg`
  - rate fallback:
    - `rates.ixg_per_60`
  - denominator:
    - `getToiSeconds(game)`

Primary code path:

- `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts`
  - `METRICS` entries for `sog_per_60` and `ixg_per_60`
- `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerMetricMath.ts`
  - `resolvePer60Components(...)`
  - `resolveIxgPer60Components(...)`
- additive source selection:
  - `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerSourceSelection.ts`
- TOI resolution:
  - `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerToiContract.ts`

Canonical formulas:

- `sog_per_60 = sum(shots) / sum(toi_seconds) * 3600`
- `ixg_per_60 = sum(ixg) / sum(toi_seconds) * 3600`

Intended hockey meaning:

- shot generation rate per sixty minutes
- expected-goals generation rate per sixty minutes

Current stored-field behavior:

- canonical `*_all`, `*_lastN`, `*_season`, `*_3ya`, and `*_career` duplicate the same weighted-rate snapshot as the legacy surfaces
- `*_total_*` and `*_avg_*` are identical for weighted-rate families because both store the weighted-rate snapshot, not separate totals versus averages
- `sog_per_60` can reconstruct its numerator from NST rates when raw shot totals are missing and TOI is present
- `ixg_per_60` prefers direct raw ixG first, then all-strength WGO ixG, then NST rates reconstruction

TOI / fallback review:

- both families are denominator-sensitive first and foremost
- if resolved TOI is absent or invalid, per-game components become `null`
- `sog_per_60` and `ixg_per_60` can still produce components when raw numerators are missing if:
  - TOI resolved successfully
  - the relevant NST `per_60` rate exists

Rate-reconstruction review:

- `sog_per_60`
  - `resolvePer60Components(...)` reconstructs implied shots as:
    - `shots_per_60 * toi_seconds / 3600`
- `ixg_per_60`
  - `resolveIxgPer60Components(...)` records a source label:
    - `counts_raw`
    - `wgo_raw`
    - `rate_reconstruction`
    - `unavailable`
- source tracking increments:
  - `summary.rateReconstructions.sog_per_60`
  - `summary.rateReconstructions.ixg_per_60`

Window / component completeness review:

- weighted-rate windows are appearance-anchored, not TOI-valid-observation windows
- selected appearance slots remain in `lastN` even when TOI is missing, but those rows contribute no aggregated components
- if TOI exists and numerator is missing, numerator is coerced to `0`

Reconstruction method:

1. resolve per-game TOI using the TOI contract
2. prefer direct raw shot or ixG totals
3. if allowed and available, reconstruct implied totals from `per_60` rate and TOI
4. aggregate raw numerators and TOI over the selected scope
5. divide numerator by TOI and multiply by `3600`

Evidence from tests:

- `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerMetricMath.test.ts`
  - confirms raw totals outrank rate reconstruction
  - confirms implied totals reconstruct from rate and TOI
  - confirms `ixg_per_60` only uses WGO ixG fallback on all-strength rows
- `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerHelperContracts.test.ts`
  - confirms direct ixG beats rate reconstruction
- `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/fetchRollingPlayerAverages.test.ts`
  - confirms source-tracking counters for `rateReconstructions`

### 2. Direct Event Weighted Rates

Families:

- `goals_per_60`
- `assists_per_60`
- `primary_assists_per_60`
- `secondary_assists_per_60`
- `hits_per_60`
- `blocks_per_60`

Stored field set:

- each family uses:
  - full 13-field legacy weighted-rate grid
  - full 8-field canonical alias grid
  - 6 historical support fields:
    - numerator `_season`, `_3ya`, `_career`
    - `toi_seconds` denominator `_season`, `_3ya`, `_career`

Source tables:

- raw event totals:
  - split-specific `nst_gamelog_*_counts`
- all-strength fallback where allowed:
  - `wgo_skater_stats`
- TOI denominator:
  - counts, counts_oi, rates, fallback seed, WGO normalization path

Source fields by family:

- `goals_per_60`
  - numerator:
    - `getGoals(game)`
    - inherits NST-first with all-strength WGO fallback
- `assists_per_60`
  - numerator:
    - `game.counts?.total_assists`
    - no WGO assist fallback in the current weighted-rate path
- `primary_assists_per_60`
  - numerator:
    - `game.counts?.first_assists`
- `secondary_assists_per_60`
  - numerator:
    - `game.counts?.second_assists`
- `hits_per_60`
  - numerator:
    - `getHits(game)`
    - inherits NST-first with all-strength WGO fallback
- `blocks_per_60`
  - numerator:
    - `getBlocks(game)`
    - inherits NST-first with all-strength WGO fallback

Primary code path:

- `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts`
  - `METRICS` entries for the six direct-event weighted-rate families
- `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerMetricMath.ts`
  - `resolvePer60Components(...)`
- additive source-selection helpers where the family uses `getGoals(...)`, `getHits(...)`, or `getBlocks(...)`
- TOI resolution:
  - `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerToiContract.ts`

Canonical formulas:

- `goals_per_60 = sum(goals) / sum(toi_seconds) * 3600`
- `assists_per_60 = sum(assists) / sum(toi_seconds) * 3600`
- `primary_assists_per_60 = sum(primary_assists) / sum(toi_seconds) * 3600`
- `secondary_assists_per_60 = sum(secondary_assists) / sum(toi_seconds) * 3600`
- `hits_per_60 = sum(hits) / sum(toi_seconds) * 3600`
- `blocks_per_60 = sum(blocks) / sum(toi_seconds) * 3600`

Intended hockey meaning:

- direct event generation rate normalized by playing time

Current stored-field behavior:

- all six families store weighted-rate snapshots under both legacy and canonical names
- only historical support columns are persisted directly
- `goals_per_60`, `hits_per_60`, and `blocks_per_60` can inherit all-strength WGO fallback via their additive helper paths
- `assists_per_60`, `primary_assists_per_60`, and `secondary_assists_per_60` do not currently use WGO numerator fallback
- none of these six families reconstruct implied numerators from NST `per_60` rate tables

TOI / fallback review:

- denominator behavior is shared across all six families
- numerator behavior is asymmetric:
  - WGO fallback possible:
    - `goals_per_60`
    - `hits_per_60`
    - `blocks_per_60`
  - WGO fallback not present:
    - `assists_per_60`
    - `primary_assists_per_60`
    - `secondary_assists_per_60`
- this asymmetry is intentional in the current code path and must be validated rather than normalized by assumption

Rate-reconstruction review:

- there is no direct `per_60` numerator reconstruction path for these six families
- if raw event total is absent and TOI exists:
  - numerator becomes `0` only when the selected row already has a denominator-present component entry
  - there is no alternate NST rates field to backfill the numerator

Window / component completeness review:

- same appearance-anchored weighted-rate contract as `sog_per_60` and `ixg_per_60`
- missing TOI excludes the row's components from the aggregated window while keeping the selected slot
- missing numerator with valid TOI coerces to `0`

Reconstruction method:

1. resolve per-game raw event total from the family-specific source path
2. resolve per-game TOI from the TOI contract
3. aggregate event totals and TOI inside the selected scope
4. divide by aggregate TOI and multiply by `3600`

Evidence from tests:

- `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/fetchRollingPlayerAverages.test.ts`
  - confirms canonical weighted-rate snapshots and historical support columns for:
    - `goals_per_60`
    - `assists_per_60`
    - `primary_assists_per_60`
    - `secondary_assists_per_60`
- `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingMetricAggregation.test.ts`
  - confirms weighted-rate arithmetic is ratio-of-aggregated raw events and TOI, not averaging per-game rates

## Historical Support-Field Contract

Weighted-rate support columns are emitted through `applyRatioSupportOutputs(...)` using these pairings:

- `sog_per_60`
  - numerator:
    - `sog_per_60_shots_*`
  - denominator:
    - `sog_per_60_toi_seconds_*`
- `ixg_per_60`
  - numerator:
    - `ixg_per_60_ixg_*`
  - denominator:
    - `ixg_per_60_toi_seconds_*`
- `goals_per_60`
  - numerator:
    - `goals_per_60_goals_*`
  - denominator:
    - `goals_per_60_toi_seconds_*`
- `assists_per_60`
  - numerator:
    - `assists_per_60_assists_*`
  - denominator:
    - `assists_per_60_toi_seconds_*`
- `primary_assists_per_60`
  - numerator:
    - `primary_assists_per_60_primary_assists_*`
  - denominator:
    - `primary_assists_per_60_toi_seconds_*`
- `secondary_assists_per_60`
  - numerator:
    - `secondary_assists_per_60_secondary_assists_*`
  - denominator:
    - `secondary_assists_per_60_toi_seconds_*`
- `hits_per_60`
  - numerator:
    - `hits_per_60_hits_*`
  - denominator:
    - `hits_per_60_toi_seconds_*`
- `blocks_per_60`
  - numerator:
    - `blocks_per_60_blocks_*`
  - denominator:
    - `blocks_per_60_toi_seconds_*`

These support columns exist only for:

- `_season`
- `_3ya`
- `_career`

For `all` and `lastN`, pass-2 validation must reconstruct from additive companions plus `toi_seconds`.

## TOI Trust and Validation Notes

- TOI is the highest-risk moving part for weighted-rate validation.
- The stored weighted-rate rows do not persist:
  - chosen TOI source
  - rejected TOI candidates
  - trust tier
  - WGO normalization mode
- Validation therefore requires:
  - source rows
  - TOI-resolution trace from recompute payload or live helper inspection
  - not just stored `/60` outputs

Critical validation cases:

- counts TOI present
- counts missing but counts_oi TOI present
- counts and counts_oi missing but rates TOI present
- fallback seed required
- WGO normalization path required
- suspicious TOI candidates rejected

Evidence from tests:

- `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerToiContract.test.ts`
  - confirms WGO minutes-to-seconds normalization
  - confirms already-seconds handling
  - confirms rejection tracking
  - confirms trust-tier assignment for rates fallback

## Diagnostic and Source-Tracking Notes

- `summarizeSourceTracking(...)` already captures:
  - `rateReconstructions.sog_per_60`
  - `rateReconstructions.ixg_per_60`
  - `ixgPer60Sources.*`
  - `toiSources.*`
  - `toiTrustTiers.*`
  - `toiFallbackSeeds.*`
  - `toiWgoNormalizations.*`
  - `toiSuspiciousReasons.*`
- No comparable numerator-source trace is persisted for every weighted-rate family.
- Weighted-rate validation in `trendsDebug.tsx` must therefore show:
  - numerator source path
  - TOI source path
  - whether numerator came from direct raw total or rate reconstruction
  - whether TOI came from authoritative, supplementary, or fallback tiers

## How This Artifact Should Be Used

- task `2.4` should keep availability and participation semantics separate from weighted-rate appearance windows
- tasks `2.6` and `2.7` should translate each weighted-rate family into:
  - a formula-only status entry in `/Users/tim/Code/fhfhockey.com/tasks/rpm-audit-notes-pass-2.md`
  - an action item in `/Users/tim/Code/fhfhockey.com/tasks/rpm-audit-action-items-pass-2.md` whenever TOI trust visibility, numerator-source asymmetry, or reconstruction friction needs follow-up
- tasks in `3.x` should use this artifact to design live validation slices that intentionally exercise:
  - authoritative TOI
  - supplementary TOI
  - fallback TOI
  - rate-reconstructed numerators
