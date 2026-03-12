# Rolling Player Pass-2 Helper and Contract Map

## Purpose

This artifact maps the required helper and contract files to the metrics and persisted fields they influence in `rolling_player_game_metrics`.

It is meant to answer five implementation questions for pass 2:

- what contract each module owns
- which metric families and fields depend on it
- whether its semantics are reflected directly in stored fields or only in recompute-time behavior
- what `trendsDebug.tsx` needs to surface from that contract
- where validation should hook into the pipeline during audit execution

Primary application surface:

- `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts`

## Summary Matrix

| Module | Contract ownership | Primary metric families / fields influenced | Persisted in row fields | `trendsDebug.tsx` exposure | Primary validation hook |
| --- | --- | --- | --- | --- | --- |
| `rollingWindowContract.ts` | canonical `lastN` family semantics | additive metrics, ratio metrics, weighted-rate metrics, availability windows | yes, through stored scope outputs and support fields | formula panel, rolling-window membership panel | compare selected window membership and missing-component policy against stored scopes |
| `rollingPlayerPpShareContract.ts` | PP team-share contract and builder-vs-WGO fallback | `pp_share_pct*`, `pp_share_pct_player_pp_toi_*`, `pp_share_pct_team_pp_toi_*`, optional PP context fields | yes | PP context panel, source precedence panel, numerator/denominator panel | reconstruct PP share from builder or fallback components per scope |
| `rollingPlayerPpUnitContract.ts` | trusted PP unit label contract | `pp_unit`, contextual PP fields | yes for labels, no for trust state | PP context panel, freshness banner | compare stored `pp_unit` against refreshed `powerPlayCombinations` rows |
| `rollingPlayerLineContextContract.ts` | trusted line assignment label contract | `line_combo_slot`, `line_combo_group` | yes for labels, no for trust state | line context panel, freshness banner | compare stored line labels against refreshed `lineCombinations` rows |
| `rollingPlayerToiContract.ts` | TOI source precedence, fallback seed, WGO normalization, suspicious-value rejection | `toi_seconds*`, all weighted `/60` families, TOI-backed support fields | yes for TOI outputs and downstream effects, no for trust trace | TOI trust panel, source precedence panel, diagnostics panel | per-row TOI source resolution trace |
| `rollingPlayerSourceSelection.ts` | NST-over-WGO additive source selection | additive player stats, additive fallback usage, ixG source selection | yes through stored additive outputs, no explicit source-trace fields | source precedence panel | compare counts rows to WGO fallbacks for each additive metric |
| `rollingPlayerAvailabilityContract.ts` | availability vs participation semantics and legacy GP policy | canonical availability / participation fields, `games_played`, `team_games_played`, `gp_semantic_type`, legacy `gp_pct_*` | yes | availability denominator panel, context panel | reconstruct season / rolling / historical availability and participation from team-game ledger |
| `rollingPlayerPipelineDiagnostics.ts` | coverage, freshness, completeness, and suspicious-output diagnostics | no metric ownership; governs validation readiness across all families | no row fields; recompute summaries only | freshness banner, diagnostics panel, blocker messaging | compare source coverage and tail freshness before trusting diffs |

## Contract Detail

### 1. `rollingWindowContract.ts`

File:

- `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingWindowContract.ts`

Owns:

- canonical rolling family taxonomy:
  - `availability`
  - `additive_performance`
  - `ratio_performance`
  - `weighted_rate_performance`
- selection-unit semantics:
  - current-team chronological team games
  - chronological appearances in strength state
- aggregation-method semantics:
  - availability ratio from selected team games
  - sum and mean over selected appearances
  - ratio of aggregated components
  - weighted rate from aggregated components
- missing-component policy for ratio and weighted-rate families

Influenced metrics and fields:

- additive families:
  - `goals*`
  - `assists*`
  - `shots*`
  - `hits*`
  - `blocks*`
  - `points*`
  - `pp_points*`
  - `ixg*`
  - `iscf*`
  - `ihdcf*`
  - `cf*`
  - `ca*`
  - `ff*`
  - `fa*`
  - `toi_seconds*`
  - `oi_gf*`
  - `oi_ga*`
  - `oi_sf*`
  - `oi_sa*`
  - `oz_starts*`
  - `dz_starts*`
  - `nz_starts*`
- ratio families:
  - `shooting_pct*`
  - `expected_sh_pct*`
  - `primary_points_pct*`
  - `ipp*`
  - `on_ice_sh_pct*`
  - `on_ice_sv_pct*`
  - `oz_start_pct*`
  - `pp_share_pct*`
  - `cf_pct*`
  - `ff_pct*`
  - `pdo*`
- weighted-rate families:
  - `sog_per_60*`
  - `ixg_per_60*`
  - `hits_per_60*`
  - `blocks_per_60*`
  - `goals_per_60*`
  - `assists_per_60*`
  - `primary_assists_per_60*`
  - `secondary_assists_per_60*`
- availability windows:
  - `availability_pct_lastN_team_games`
  - `participation_pct_lastN_team_games`
  - `games_played_lastN_team_games`
  - `team_games_available_lastN`
  - `participation_games_lastN_team_games`

Primary application points:

- family tags on `METRICS` in `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts`
- ratio window normalization in `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingMetricAggregation.ts`

Stored semantics reflected in fields:

- yes
- the contract is not stored as a row field, but it governs how every `last3`, `last5`, `last10`, and `last20` output is produced

`trendsDebug.tsx` requirements:

- show contract summary for the selected metric family
- show whether the window is team-game based or appearance based
- show missing-component behavior for selected ratio and weighted-rate metrics

Validation hooks:

- compare selected rolling members for the chosen player / strength / date
- verify whether a missing numerator coerced to zero or whether a missing denominator excluded the component while keeping the selected slot

### 2. `rollingPlayerPpShareContract.ts`

File:

- `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerPpShareContract.ts`

Owns:

- PP share semantic type: team power-play share
- authoritative builder fields:
  - `powerPlayCombinations.PPTOI`
  - `powerPlayCombinations.pp_share_of_team`
- fallback fields:
  - `wgo_skater_stats.pp_toi`
  - `wgo_skater_stats.pp_toi_pct_per_game`
- explicit exclusions:
  - `percentageOfPP`
  - `pp_unit_usage_index`
  - `pp_unit_relative_toi`
  - `pp_vs_unit_avg`

Influenced metrics and fields:

- canonical:
  - `pp_share_pct_all`
  - `pp_share_pct_last3`
  - `pp_share_pct_last5`
  - `pp_share_pct_last10`
  - `pp_share_pct_last20`
  - `pp_share_pct_season`
  - `pp_share_pct_3ya`
  - `pp_share_pct_career`
- legacy:
  - `pp_share_pct_total_*`
  - `pp_share_pct_avg_*`
- support:
  - `pp_share_pct_player_pp_toi_*`
  - `pp_share_pct_team_pp_toi_*`
- optional context copied from builder rows:
  - `pp_share_of_team`
  - `pp_unit_usage_index`
  - `pp_unit_relative_toi`
  - `pp_vs_unit_avg`

Primary application points:

- PP context row shaping via `toRollingPlayerPpContextRow(...)`
- PP share component resolution via `resolvePpShareComponents(...)`
- writer call site `getPpShareComponents(...)` in `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts`

Stored semantics reflected in fields:

- yes
- both the PP-share outputs and the PP-share support columns are direct manifestations of this contract

`trendsDebug.tsx` requirements:

- show builder PPTOI and builder share
- show WGO fallback PPTOI and WGO fallback share
- show which source won for each selected row or window
- show excluded unit-relative fields separately so they are not mistaken for team share

Validation hooks:

- reconstruct PP share from `player_pp_toi / inferred_team_pp_toi`
- flag mixed-source windows where some component rows came from builder data and others from fallback
- compare stored support columns against reconstructed components

### 3. `rollingPlayerPpUnitContract.ts`

File:

- `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerPpUnitContract.ts`

Owns:

- `pp_unit` as a contextual label only
- builder freshness dependency for trusting PP unit labels
- positive-integer validation for trusted `pp_unit`

Influenced metrics and fields:

- `pp_unit`
- indirectly informs the trustworthiness of:
  - `pp_share_of_team`
  - `pp_unit_usage_index`
  - `pp_unit_relative_toi`
  - `pp_vs_unit_avg`

Primary application points:

- `resolvePpUnitLabel(...)` at row output time in `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts`

Stored semantics reflected in fields:

- partially
- stored label is reflected directly
- trust state and stale-builder warnings are not row fields today

`trendsDebug.tsx` requirements:

- dedicated PP context panel
- explicit “trusted / untrusted” label state
- explicit stale-builder warning when PP rows are missing or stale

Validation hooks:

- compare stored `pp_unit` against refreshed `powerPlayCombinations.unit`
- treat null or non-positive units as untrusted, not as valid “unit 0”

### 4. `rollingPlayerLineContextContract.ts`

File:

- `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerLineContextContract.ts`

Owns:

- `line_combo_slot`
- `line_combo_group`
- slot derivation from line builder arrays:
  - forwards in groups of 3
  - defensemen in groups of 2
  - goalies in groups of 1

Influenced metrics and fields:

- `line_combo_slot`
- `line_combo_group`

Primary application points:

- `resolveTrustedLineAssignment(...)`
- `resolveLineCombo(...)` in `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts`

Stored semantics reflected in fields:

- partially
- labels are stored directly
- source-row presence and trusted-assignment state are not stored as row fields

`trendsDebug.tsx` requirements:

- dedicated line context panel
- show source row presence
- show trusted-assignment boolean
- show refreshed builder row alongside stored labels

Validation hooks:

- compare stored labels to refreshed `lineCombinations` for the same game/team
- distinguish “no source row” from “source row exists but player absent”

### 5. `rollingPlayerToiContract.ts`

File:

- `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerToiContract.ts`

Owns:

- TOI source precedence:
  - `counts`
  - `counts_oi`
  - `rates`
  - `fallback`
  - `wgo`
  - `none`
- trust tiers:
  - `authoritative`
  - `supplementary`
  - `fallback`
  - `none`
- fallback seed resolution
- WGO TOI normalization:
  - minutes to seconds
  - already seconds
  - missing
  - invalid
- suspicious-value rejection:
  - non-finite
  - non-positive
  - above max seconds

Influenced metrics and fields:

- direct TOI outputs:
  - every `toi_seconds_*`
- every weighted-rate family through its denominator:
  - `sog_per_60*`
  - `ixg_per_60*`
  - `hits_per_60*`
  - `blocks_per_60*`
  - `goals_per_60*`
  - `assists_per_60*`
  - `primary_assists_per_60*`
  - `secondary_assists_per_60*`
- weighted-rate support columns:
  - every `*_toi_seconds_*`

Primary application points:

- `resolveFallbackToiSeed(...)`
- `resolveRollingPlayerToiContext(...)`
- `resolveFallbackToiContext(...)` and `getToiSeconds(...)` usage in `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts`

Stored semantics reflected in fields:

- yes for the chosen TOI values and downstream weighted-rate outputs
- no for source choice, trust tier, rejection reasons, or WGO normalization trace

`trendsDebug.tsx` requirements:

- dedicated TOI trust panel
- chosen TOI source
- rejected candidates
- trust tier
- WGO normalization result
- fallback seed source

Validation hooks:

- reconstruct TOI resolution for individual rows
- confirm weighted-rate numerators use the chosen TOI denominator
- flag rows where suspicious candidates were rejected before fallback

### 6. `rollingPlayerSourceSelection.ts`

File:

- `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerSourceSelection.ts`

Owns:

- NST counts over WGO fallback preference for additive player stats
- all-strength-only WGO fallback policy for several player stats
- PP points special-case behavior
- ixG raw-value preference via `resolveIxgValue(...)`

Influenced metrics and fields:

- additive player metrics:
  - `points*`
  - `shots*`
  - `goals*`
  - `assists*`
  - `hits*`
  - `blocks*`
  - `pp_points*`
  - `ixg*`
- indirect numerator inputs for:
  - `shooting_pct*`
  - `expected_sh_pct*`
  - `ixg_per_60*`
  - `goals_per_60*`
  - `assists_per_60*`
  - `hits_per_60*`
  - `blocks_per_60*`
  - `sog_per_60*`

Primary application points:

- `getPoints(...)`
- `getShots(...)`
- `getGoals(...)`
- `getAssists(...)`
- `getHits(...)`
- `getBlocks(...)`
- `getPpPoints(...)`
- `getIxg(...)`
- all called from metric definitions inside `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts`

Stored semantics reflected in fields:

- yes, through the resulting additive outputs and ratio numerators
- no dedicated source-trace fields are persisted today

`trendsDebug.tsx` requirements:

- source precedence panel must show counts row value, WGO fallback value, and chosen source
- ixG panels must distinguish counts raw, WGO raw, and rate reconstruction where applicable

Validation hooks:

- compare stored additive outputs to source-selected counts/WGO values per row
- identify when all-strength rows fell back to WGO because counts were missing

### 7. `rollingPlayerAvailabilityContract.ts`

File:

- `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerAvailabilityContract.ts`

Owns:

- all-strength semantic type: availability
- split-strength semantic type: participation
- intended replacement policy for canonical season, rolling, and historical fields
- legacy `gp_pct_*` field policy

Influenced metrics and fields:

- low-level counters:
  - `games_played`
  - `team_games_played`
- semantic label:
  - `gp_semantic_type`
- canonical availability fields:
  - `season_availability_pct`
  - `three_year_availability_pct`
  - `career_availability_pct`
  - `availability_pct_lastN_team_games`
  - `season_games_played`
  - `season_team_games_available`
  - `three_year_games_played`
  - `three_year_team_games_available`
  - `career_games_played`
  - `career_team_games_available`
  - `games_played_lastN_team_games`
  - `team_games_available_lastN`
- canonical participation fields:
  - `season_participation_pct`
  - `three_year_participation_pct`
  - `career_participation_pct`
  - `participation_pct_lastN_team_games`
  - `season_participation_games`
  - `three_year_participation_games`
  - `career_participation_games`
  - `participation_games_lastN_team_games`
- compatibility fields:
  - `gp_pct_total_*`
  - `gp_pct_avg_*`

Primary application points:

- `getGpOutputCompatibilityMode(...)` in `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts`
- GP accumulator logic in `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingHistoricalAverages.ts`

Stored semantics reflected in fields:

- yes
- this contract is directly expressed by canonical availability and participation fields, plus compatibility-era `gp_semantic_type`

`trendsDebug.tsx` requirements:

- availability denominator panel with numerator / denominator supports
- semantic type label so split-strength rows are not misread as ordinary availability
- legacy alias comparison panel for `gp_pct_*`

Validation hooks:

- reconstruct season, rolling, 3YA, and career numerators and denominators from team-game ledger
- compare canonical availability outputs to legacy aliases where compatibility fields still exist

### 8. `rollingPlayerPipelineDiagnostics.ts`

File:

- `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/rollingPlayerPipelineDiagnostics.ts`

Owns:

- source coverage summaries
- source-tail freshness summaries
- derived-window completeness summaries
- suspicious-output summaries

Influenced metrics and fields:

- no persisted metric values directly
- validation readiness for all metric families
- freshness blockers for:
  - counts
  - rates
  - counts-on-ice
  - PP rows
  - line rows
- component-completeness checks for:
  - GP windows
  - `primary_points_pct`
  - `ipp`
  - `on_ice_sh_pct`
  - `pp_share_pct`
  - `pdo`

Primary application points:

- `summarizeCoverage(...)`
- `summarizeSourceTailFreshness(...)`
- `summarizeDerivedWindowDiagnostics(...)`
- `summarizeSuspiciousOutputs(...)`
- consumed in recompute validation flows from `/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts`

Stored semantics reflected in fields:

- no
- diagnostics are recompute-time outputs and logs, not row columns

`trendsDebug.tsx` requirements:

- freshness banner
- diagnostics panel
- explicit blocker messaging
- stale-tail counts
- unknown-game warnings
- mixed-component completeness warnings

Validation hooks:

- diagnostics must be checked before trusting stored-vs-reconstructed diffs
- any blocker should classify the metric as blocked or needs-review rather than broken

## Supporting Execution Helpers

These files are not the primary “contract owner” modules required by the PRD, but they are part of the application path and should be treated as supporting dependency surfaces during pass 2.

### `rollingMetricAggregation.ts`

Role:

- applies ratio and weighted-rate aggregation logic over selected windows
- computes ratio snapshots from aggregated components
- emits component snapshots used for persisted support fields
- uses `rollingWindowContract.ts` to decide selected-slot behavior for ratio and weighted-rate windows

Influences:

- every ratio family
- every weighted-rate family
- all persisted support-column families for those metrics

### `rollingPlayerMetricMath.ts`

Role:

- resolves `/60` components from raw values or per-60 reconstructions
- resolves share components
- resolves ixG source choice and ixG-per-60 component source

Influences:

- `sog_per_60*`
- `ixg_per_60*`
- `goals_per_60*`
- `assists_per_60*`
- `hits_per_60*`
- `blocks_per_60*`
- `primary_assists_per_60*`
- `secondary_assists_per_60*`
- `pp_share_pct*`
- `ixg*`
- `expected_sh_pct*`

### `rollingHistoricalAverages.ts`

Role:

- accumulates historical additive and GP / availability windows
- computes season / 3YA / career snapshots
- applies the availability contract to season, rolling, and historical GP semantics

Influences:

- all historical `*_avg_season`
- all historical `*_avg_3ya`
- all historical `*_avg_career`
- canonical availability / participation historical scopes
- legacy GP compatibility outputs

## `trendsDebug.tsx` Exposure Checklist by Contract

- `rollingWindowContract.ts`
  - show family contract summary and window selection basis
- `rollingPlayerPpShareContract.ts`
  - show builder-vs-fallback source trace and excluded unit-relative fields
- `rollingPlayerPpUnitContract.ts`
  - show trusted label status and PP builder freshness blocker
- `rollingPlayerLineContextContract.ts`
  - show trusted assignment status and line-builder freshness blocker
- `rollingPlayerToiContract.ts`
  - show TOI source, trust tier, normalization, and rejected candidates
- `rollingPlayerSourceSelection.ts`
  - show chosen additive source per metric row
- `rollingPlayerAvailabilityContract.ts`
  - show semantic type and numerator/denominator support fields
- `rollingPlayerPipelineDiagnostics.ts`
  - show blocker summaries before diff interpretation

## Audit Consequences

- every metric family audit should cite its governing contract module from this map
- any contract whose trust state is not visible in persisted fields must be surfaced through recompute validation payloads
- any mismatch that can be explained only by hidden contract state should generate an action item for better debug visibility
