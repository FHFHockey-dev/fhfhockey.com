# Rolling Player Game Metrics Pass-2 Family Grouping

## Purpose

This artifact regroups the field-complete inventory in `/Users/tim/Code/fhfhockey.com/tasks/artifacts/rolling-player-game-metrics-pass-2-field-inventory.md` into the metric families required by the pass-2 PRD.

It exists so later audit steps can answer four questions quickly for any persisted field set:

- which audit family owns it
- which `strength_state` rows it is meaningful for
- whether it is canonical, legacy, contextual, support-only, or compatibility-only
- whether it should appear in `trendsDebug.tsx` as a primary metric, a support component, a contextual label, or a hidden-by-default debug field

## Visibility Vocabulary for `trendsDebug.tsx`

- `Primary`
  - should appear in the main metric selector or main stored-value panel
- `Support`
  - should appear in formula, numerator/denominator, or reconstruction panels
- `Context`
  - should appear in context or trust panels rather than in the primary metric selector
- `Hidden by default`
  - should be available behind support/debug toggles only

## Family Matrix

| Family | Field groups included | Strength applicability | Role classification | `trendsDebug.tsx` visibility |
| --- | --- | --- | --- | --- |
| Availability / participation | `games_played`, `team_games_played`, canonical availability pct fields, canonical availability support fields, canonical participation pct fields, canonical participation support fields, `gp_semantic_type`, legacy `gp_pct_*` | all strengths, but semantics differ by `strength_state` | mixed canonical + support + compatibility | `Primary` for canonical pct fields, `Support` for numerators/denominators, `Context` for `gp_semantic_type`, `Hidden by default` for legacy `gp_pct_*` |
| TOI | `toi_seconds_*` additive fields plus every `*_toi_seconds_*` weighted-rate support field | all strengths | mixed direct metric + support | `Primary` for `toi_seconds_*`, `Support` for weighted-rate TOI supports |
| Surface counting stats | additive fields for `goals`, `assists`, `shots`, `hits`, `blocks`, `points`, `pp_points`, `ixg`, `iscf`, `ihdcf`, `cf`, `ca`, `ff`, `fa`, `oz_starts`, `dz_starts`, `nz_starts`, `oi_gf`, `oi_ga`, `oi_sf`, `oi_sa` | all strengths | mostly legacy direct metric output | `Primary` for player-facing metrics and on-ice counts, `Hidden by default` for bulk additive history grids unless selected |
| Weighted `/60` rates | legacy `*_per_60_avg_*` and `*_per_60_total_*`, canonical `*_per_60_*`, and weighted-rate support columns | all strengths | mixed canonical + legacy + support | `Primary` for canonical rate fields, `Support` for numerator / TOI components, `Hidden by default` for legacy `avg` / `total` aliases |
| Finishing / shooting | `shooting_pct*`, `expected_sh_pct*`, `primary_points_pct*`, `ipp*`, `on_ice_sh_pct*`, `on_ice_sv_pct*`, `pdo*`, plus support columns feeding them | all strengths, with on-ice variants meaningful only when on-ice source rows exist | mixed canonical + legacy + support | `Primary` for canonical fields, `Support` for all component fields, `Hidden by default` for legacy `avg` / `total` aliases |
| Expected / chance metrics | additive `ixg*`, `iscf*`, `ihdcf*`, canonical / legacy `expected_sh_pct*`, and related support columns | all strengths | mixed direct metric + canonical ratio + support | `Primary` for `ixg`, `iscf`, `ihdcf`, and canonical `expected_sh_pct`, `Support` for support columns |
| On-ice context | additive `oi_gf*`, `oi_ga*`, `oi_sf*`, `oi_sa*`, canonical / legacy `on_ice_sh_pct*`, `on_ice_sv_pct*`, `pdo*`, and their supports | all strengths where on-ice source data exists | mixed direct metric + canonical ratio + support | `Primary` for canonical rates and additive on-ice counts, `Support` for PDO and shot/goal components |
| Territorial / possession | additive `cf*`, `ca*`, `ff*`, `fa*`, `oz_starts*`, `dz_starts*`, `nz_starts*`, canonical / legacy `cf_pct*`, `ff_pct*`, `oz_start_pct*`, and supports | all strengths where on-ice source data exists | mixed direct metric + canonical ratio + support | `Primary` for canonical rates plus additive counts, `Support` for zone-start and possession components |
| Power-play usage | canonical / legacy `pp_share_pct*`, PP share support columns `pp_share_pct_player_pp_toi_*` and `pp_share_pct_team_pp_toi_*` | semantically meaningful for `all` and `pp`; should be treated as excluded for `ev` and `pk` validation | mixed canonical + legacy + support | `Primary` for canonical `pp_share_pct_*`, `Support` for player/team PP TOI components, `Hidden by default` for legacy aliases |
| PP role / PP unit context | `pp_unit`, `pp_share_of_team`, `pp_unit_usage_index`, `pp_unit_relative_toi`, `pp_vs_unit_avg` | most meaningful for `all` and `pp`; may be null or non-applicable elsewhere | contextual labels and builder-derived context | `Context` |
| Line / role context | `line_combo_slot`, `line_combo_group` | most meaningful for `all` and `ev`; may be null or non-applicable elsewhere | contextual labels | `Context` |
| Historical baseline columns | every `*_avg_season`, `*_avg_3ya`, `*_avg_career`, canonical `*_season`, `*_3ya`, `*_career`, and historical support columns | all strengths, subject to source availability and season window completeness | mixed canonical + legacy + support | `Primary` for selected canonical historical fields, `Support` for historical support columns, `Hidden by default` for legacy historical aliases |
| Diagnostic support / numerator-denominator support columns | every persisted support column added for ratio and weighted-rate reconstruction | all strengths for the families they support | support-only | `Support` or `Hidden by default` |
| Freshness / trust / fallback support | persisted contextual/trust-adjacent fields only: `gp_semantic_type`, PP context labels, line context labels; non-persisted freshness / TOI-trust state remains recompute payload only | all strengths, but often family-specific | contextual or payload-only | `Context` for persisted fields, validation payload only for non-persisted trust/freshness data |

## Family Detail

### 1. Availability / Participation

Included fields:

- low-level counters:
  - `games_played`
  - `team_games_played`
- canonical availability percentages:
  - `season_availability_pct`
  - `three_year_availability_pct`
  - `career_availability_pct`
  - `availability_pct_last3_team_games`
  - `availability_pct_last5_team_games`
  - `availability_pct_last10_team_games`
  - `availability_pct_last20_team_games`
- canonical availability support:
  - `season_games_played`
  - `season_team_games_available`
  - `three_year_games_played`
  - `three_year_team_games_available`
  - `career_games_played`
  - `career_team_games_available`
  - `games_played_last3_team_games`
  - `games_played_last5_team_games`
  - `games_played_last10_team_games`
  - `games_played_last20_team_games`
  - `team_games_available_last3`
  - `team_games_available_last5`
  - `team_games_available_last10`
  - `team_games_available_last20`
- canonical participation percentages:
  - `season_participation_pct`
  - `three_year_participation_pct`
  - `career_participation_pct`
  - `participation_pct_last3_team_games`
  - `participation_pct_last5_team_games`
  - `participation_pct_last10_team_games`
  - `participation_pct_last20_team_games`
- canonical participation support:
  - `season_participation_games`
  - `three_year_participation_games`
  - `career_participation_games`
  - `participation_games_last3_team_games`
  - `participation_games_last5_team_games`
  - `participation_games_last10_team_games`
  - `participation_games_last20_team_games`
- semantic discriminator:
  - `gp_semantic_type`
- compatibility-only legacy fields:
  - `gp_pct_total_all`
  - `gp_pct_total_last3`
  - `gp_pct_total_last5`
  - `gp_pct_total_last10`
  - `gp_pct_total_last20`
  - `gp_pct_avg_all`
  - `gp_pct_avg_last3`
  - `gp_pct_avg_last5`
  - `gp_pct_avg_last10`
  - `gp_pct_avg_last20`
  - `gp_pct_avg_season`
  - `gp_pct_avg_3ya`
  - `gp_pct_avg_career`

Strength applicability:

- all rows
- semantic interpretation changes by `strength_state`
- all-strength rows emphasize availability
- split-strength rows emphasize participation-in-state

Role classification:

- canonical outputs: explicit availability and participation percentage fields
- support fields: games-played and team-games-available companions
- contextual field: `gp_semantic_type`
- compatibility-only: legacy `gp_pct_*`

`trendsDebug.tsx` visibility:

- show canonical percentage fields in the main metric selector
- show support counters in the denominator / window panels
- show `gp_semantic_type` in the context panel
- keep `gp_pct_*` behind a legacy toggle

### 2. TOI

Included fields:

- additive TOI family:
  - `toi_seconds_total_all`
  - `toi_seconds_total_last3`
  - `toi_seconds_total_last5`
  - `toi_seconds_total_last10`
  - `toi_seconds_total_last20`
  - `toi_seconds_avg_all`
  - `toi_seconds_avg_last3`
  - `toi_seconds_avg_last5`
  - `toi_seconds_avg_last10`
  - `toi_seconds_avg_last20`
  - `toi_seconds_avg_season`
  - `toi_seconds_avg_3ya`
  - `toi_seconds_avg_career`
- weighted-rate TOI support families:
  - `sog_per_60_toi_seconds_*`
  - `ixg_per_60_toi_seconds_*`
  - `hits_per_60_toi_seconds_*`
  - `blocks_per_60_toi_seconds_*`
  - `goals_per_60_toi_seconds_*`
  - `assists_per_60_toi_seconds_*`
  - `primary_assists_per_60_toi_seconds_*`
  - `secondary_assists_per_60_toi_seconds_*`

Strength applicability:

- all rows

Role classification:

- direct metric output: `toi_seconds_*`
- support-only: per-family weighted-rate TOI denominators

`trendsDebug.tsx` visibility:

- expose `toi_seconds_*` as primary metrics
- expose all TOI denominator fields in the TOI trust and weighted-rate support panels

### 3. Surface Counting Stats

Included additive families:

- player counting:
  - `goals*`
  - `assists*`
  - `shots*`
  - `hits*`
  - `blocks*`
  - `points*`
  - `pp_points*`
- chance creation:
  - `ixg*`
  - `iscf*`
  - `ihdcf*`
- territorial raw counts:
  - `cf*`
  - `ca*`
  - `ff*`
  - `fa*`
- zone-start raw counts:
  - `oz_starts*`
  - `dz_starts*`
  - `nz_starts*`
- on-ice raw counts:
  - `oi_gf*`
  - `oi_ga*`
  - `oi_sf*`
  - `oi_sa*`

Strength applicability:

- all rows, subject to source-table availability for the relevant split

Role classification:

- legacy direct metric output

`trendsDebug.tsx` visibility:

- include all player counting families in primary metric selection
- keep raw historical additive grids hidden by default until a metric is selected
- include on-ice raw counts in the source-input and component panels when an on-ice ratio is selected

### 4. Weighted `/60` Rates

Included families:

- `sog_per_60`
- `ixg_per_60`
- `hits_per_60`
- `blocks_per_60`
- `goals_per_60`
- `assists_per_60`
- `primary_assists_per_60`
- `secondary_assists_per_60`

Included field types:

- legacy `*_avg_*`
- legacy `*_total_*`
- canonical `*_all`, `*_lastN`, `*_season`, `*_3ya`, `*_career`
- numerator support columns
- TOI denominator support columns

Strength applicability:

- all rows

Role classification:

- canonical outputs: canonical alias fields
- legacy aliases: `avg` / `total` families
- support-only: numerator and TOI denominator fields

`trendsDebug.tsx` visibility:

- primary selector should prefer canonical fields
- component panel should expose both numerator and TOI denominator
- legacy grids should stay behind a legacy toggle

### 5. Finishing / Shooting

Included families:

- `shooting_pct`
- `expected_sh_pct`
- `primary_points_pct`
- `ipp`
- `on_ice_sh_pct`
- `on_ice_sv_pct`
- `pdo`

Included field types:

- legacy `avg` / `total`
- canonical `all` / `lastN` / `season` / `3ya` / `career`
- support columns for all persisted numerators and denominators

Strength applicability:

- all rows where the relevant numerator and denominator sources exist

Role classification:

- canonical outputs: canonical alias fields
- legacy aliases: `avg` / `total`
- support-only: all persisted component columns

`trendsDebug.tsx` visibility:

- primary selector should expose canonical ratio fields
- formula panel must show the exact component columns backing the selected scope
- support components should remain directly visible in the numerator / denominator panel

### 6. Expected / Chance Metrics

Included fields:

- additive `ixg*`
- additive `iscf*`
- additive `ihdcf*`
- canonical and legacy `expected_sh_pct*`
- support columns:
  - `expected_sh_pct_ixg_*`
  - `expected_sh_pct_shots_*`

Strength applicability:

- all rows

Role classification:

- direct additive outputs plus ratio outputs and support

`trendsDebug.tsx` visibility:

- primary selector should include `ixg`, `iscf`, `ihdcf`, and canonical `expected_sh_pct`
- support panel should show the `ixg` and shot components used for `expected_sh_pct`

### 7. On-Ice Context

Included fields:

- additive `oi_gf*`
- additive `oi_ga*`
- additive `oi_sf*`
- additive `oi_sa*`
- canonical and legacy `on_ice_sh_pct*`
- canonical and legacy `on_ice_sv_pct*`
- canonical and legacy `pdo*`
- support columns:
  - `on_ice_sh_pct_goals_for_*`
  - `on_ice_sh_pct_shots_for_*`
  - `pdo_goals_for_*`
  - `pdo_shots_for_*`
  - `pdo_goals_against_*`
  - `pdo_shots_against_*`

Strength applicability:

- all rows where on-ice source tables exist for the selected split

Role classification:

- direct additive outputs plus ratio outputs and support

`trendsDebug.tsx` visibility:

- primary selector should expose canonical on-ice ratio fields and raw on-ice counts
- support panel should expose every component used for `on_ice_sh_pct` and `pdo`

### 8. Territorial / Possession

Included fields:

- additive `cf*`
- additive `ca*`
- additive `ff*`
- additive `fa*`
- additive `oz_starts*`
- additive `dz_starts*`
- additive `nz_starts*`
- canonical and legacy `cf_pct*`
- canonical and legacy `ff_pct*`
- canonical and legacy `oz_start_pct*`
- support columns:
  - `cf_pct_cf_*`
  - `cf_pct_ca_*`
  - `ff_pct_ff_*`
  - `ff_pct_fa_*`
  - `oz_start_pct_off_zone_starts_*`
  - `oz_start_pct_def_zone_starts_*`
  - `oz_start_pct_neutral_zone_starts_*`

Strength applicability:

- all rows where on-ice source tables exist for the selected split

Role classification:

- direct additive outputs plus ratio outputs and support

`trendsDebug.tsx` visibility:

- primary selector should expose canonical rates plus additive territorial counts
- support panel should expose the exact Corsi, Fenwick, and zone-start components

### 9. Power-Play Usage

Included fields:

- canonical and legacy `pp_share_pct*`
- support columns:
  - `pp_share_pct_player_pp_toi_*`
  - `pp_share_pct_team_pp_toi_*`

Strength applicability:

- valid for `all` and `pp`
- should be shown as excluded / non-applicable in `ev` and `pk`

Role classification:

- canonical outputs: canonical alias fields
- legacy aliases: `avg` / `total`
- support-only: player/team PP TOI components

`trendsDebug.tsx` visibility:

- primary selector should expose canonical `pp_share_pct`
- support panel should expose player PP TOI and team PP TOI for the selected scope
- fallback/source panel must show whether the denominator came from builder rows or fallback logic

### 10. PP Role / PP Unit Context

Included fields:

- `pp_unit`
- `pp_share_of_team`
- `pp_unit_usage_index`
- `pp_unit_relative_toi`
- `pp_vs_unit_avg`

Strength applicability:

- most meaningful for `all` and `pp`
- contextual only, not arithmetic metric outputs

Role classification:

- contextual labels and builder-derived context

`trendsDebug.tsx` visibility:

- show in a dedicated PP context panel
- do not list as normal metric-selector outputs

### 11. Line / Role Context

Included fields:

- `line_combo_slot`
- `line_combo_group`

Strength applicability:

- most meaningful for `all` and `ev`
- contextual only

Role classification:

- contextual labels

`trendsDebug.tsx` visibility:

- show in a dedicated line-context panel
- do not list as normal metric-selector outputs

### 12. Historical Baseline Columns

Included fields:

- all legacy `*_avg_season`
- all legacy `*_avg_3ya`
- all legacy `*_avg_career`
- all canonical `*_season`
- all canonical `*_3ya`
- all canonical `*_career`
- all persisted historical support columns ending in `_season`, `_3ya`, or `_career`

Strength applicability:

- all rows

Role classification:

- mixed canonical + legacy + support

`trendsDebug.tsx` visibility:

- canonical historical values should appear in primary stored-value panels when their family is selected
- support columns should appear in the formula / reconstruction panels
- legacy historical aliases should stay behind a legacy toggle

### 13. Diagnostic Support / Numerator-Denominator Support Columns

Included fields:

- all persisted support columns from the field inventory’s support bucket:
  - historical ratio support
  - historical weighted-rate support
  - full-scope ratio support
  - PP-share support
  - PDO support
  - zone-start support

Strength applicability:

- all rows for the families they support

Role classification:

- support-only

`trendsDebug.tsx` visibility:

- visible in formula and reconstruction panels
- hidden by default until a selected metric requires them

### 14. Freshness / Trust / Fallback Support

Persisted fields:

- `gp_semantic_type`
- `pp_unit`
- `pp_share_of_team`
- `pp_unit_usage_index`
- `pp_unit_relative_toi`
- `pp_vs_unit_avg`
- `line_combo_slot`
- `line_combo_group`

Not currently persisted in the row type and therefore required from recompute payloads instead of row columns:

- TOI trust tier
- TOI source selection trace
- TOI fallback seed
- stale-tail diagnostics
- source freshness summaries
- mixed-source warnings
- suspicious output warnings
- coverage-gap summaries

Strength applicability:

- persisted contextual fields can appear on any row
- non-persisted freshness and trust state is family-specific and recompute-specific

Role classification:

- persisted context plus non-persisted validation payload metadata

`trendsDebug.tsx` visibility:

- persisted items belong in context panels
- non-persisted items belong in freshness, diagnostics, source precedence, and TOI trust panels

## Grouping Rules for Later Audit Steps

- treat additive fields as owned by both their direct family and any higher-level umbrella family that depends on them
- treat canonical ratio and weighted-rate aliases as the preferred primary outputs for pass-2 validation
- treat legacy `avg` / `total` ratio and weighted-rate fields as compatibility surfaces that still require explicit status
- treat support columns as first-class persisted contract and not as optional debugging noise
- treat contextual labels separately from arithmetic metric outputs even when they live on the same row
- treat non-persisted freshness and TOI-trust data as required validation-console inputs even though they are outside the row type
