# Rolling Player Game Metrics Pass-2 Field Inventory

## Purpose

This artifact is the source-of-truth field inventory for `rolling_player_game_metrics` for pass 2.

Source of truth:

- `/Users/tim/Code/fhfhockey.com/web/lib/supabase/database-generated.types.ts`

Inventory method:

- derive fields from `Database["public"]["Tables"]["rolling_player_game_metrics"]["Row"]`
- group fields by persisted contract shape rather than by migration history
- keep the inventory field-complete by listing exact fields where the surface is small and by listing exact families plus suffix grids where the surface is repetitive

## Totals

- total row fields in `rolling_player_game_metrics`: `942`
- row spine, counters, context labels, and timestamps: `17`
- legacy additive surfaces: `286`
- legacy ratio snapshot surfaces: `143`
- legacy GP compatibility surfaces: `13`
- legacy weighted-rate surfaces: `104`
- canonical ratio aliases: `88`
- canonical weighted-rate aliases: `64`
- canonical availability / participation surfaces: `35`
- persisted formula support columns: `192`

The totals reconcile exactly to the generated row type:

- `17 + 286 + 143 + 13 + 104 + 88 + 64 + 35 + 192 = 942`

## 1. Row Spine, Counters, Context Labels, and Timestamps

Exact fields:

- `player_id`
- `team_id`
- `game_id`
- `game_date`
- `season`
- `strength_state`
- `games_played`
- `team_games_played`
- `gp_semantic_type`
- `line_combo_slot`
- `line_combo_group`
- `pp_unit`
- `pp_share_of_team`
- `pp_unit_usage_index`
- `pp_unit_relative_toi`
- `pp_vs_unit_avg`
- `updated_at`

Contract role:

- row identity and chronology
- low-level participation counters
- context labels and PP metadata
- compatibility discriminator for availability versus split-strength participation

## 2. Legacy Additive Surfaces

These fields still use the legacy additive naming grid and remain persisted contract:

- suffix grid:
  - `_total_all`
  - `_total_last3`
  - `_total_last5`
  - `_total_last10`
  - `_total_last20`
  - `_avg_all`
  - `_avg_last3`
  - `_avg_last5`
  - `_avg_last10`
  - `_avg_last20`
  - `_avg_season`
  - `_avg_3ya`
  - `_avg_career`

Additive families using the full 13-field grid:

- `assists`
- `blocks`
- `ca`
- `cf`
- `dz_starts`
- `fa`
- `ff`
- `goals`
- `hits`
- `ihdcf`
- `iscf`
- `ixg`
- `nz_starts`
- `oi_ga`
- `oi_gf`
- `oi_sa`
- `oi_sf`
- `oz_starts`
- `points`
- `pp_points`
- `shots`
- `toi_seconds`

Inventory math:

- `22 families x 13 fields each = 286 fields`

## 3. Legacy Ratio Snapshot Surfaces

These are the pre-canonical ratio fields that still persist as stored contract and compatibility baggage.

Suffix grid:

- `_total_all`
- `_total_last3`
- `_total_last5`
- `_total_last10`
- `_total_last20`
- `_avg_all`
- `_avg_last3`
- `_avg_last5`
- `_avg_last10`
- `_avg_last20`
- `_avg_season`
- `_avg_3ya`
- `_avg_career`

Ratio families using the full 13-field grid:

- `cf_pct`
- `expected_sh_pct`
- `ff_pct`
- `ipp`
- `on_ice_sh_pct`
- `on_ice_sv_pct`
- `oz_start_pct`
- `pdo`
- `pp_share_pct`
- `primary_points_pct`
- `shooting_pct`

Inventory math:

- `11 families x 13 fields each = 143 fields`

## 4. Legacy GP Compatibility Surfaces

These fields still persist separately from the canonical availability and participation replacements:

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

Inventory math:

- `13 fields`

## 5. Legacy Weighted-Rate Surfaces

These fields preserve the older weighted-rate storage pattern alongside the canonical alias families.

Suffix grid:

- `_total_all`
- `_total_last3`
- `_total_last5`
- `_total_last10`
- `_total_last20`
- `_avg_all`
- `_avg_last3`
- `_avg_last5`
- `_avg_last10`
- `_avg_last20`
- `_avg_season`
- `_avg_3ya`
- `_avg_career`

Weighted-rate families using the full 13-field grid:

- `assists_per_60`
- `blocks_per_60`
- `goals_per_60`
- `hits_per_60`
- `ixg_per_60`
- `primary_assists_per_60`
- `secondary_assists_per_60`
- `sog_per_60`

Inventory math:

- `8 families x 13 fields each = 104 fields`

## 6. Canonical Ratio Alias Surfaces

These fields are the canonical scope-based ratio aliases added by the pass-1 remediation work.

Suffix grid:

- `_all`
- `_last3`
- `_last5`
- `_last10`
- `_last20`
- `_season`
- `_3ya`
- `_career`

Canonical ratio families using the full 8-field grid:

- `cf_pct`
- `expected_sh_pct`
- `ff_pct`
- `ipp`
- `on_ice_sh_pct`
- `on_ice_sv_pct`
- `oz_start_pct`
- `pdo`
- `pp_share_pct`
- `primary_points_pct`
- `shooting_pct`

Inventory math:

- `11 families x 8 fields each = 88 fields`

## 7. Canonical Weighted-Rate Alias Surfaces

These fields are the canonical scope-based weighted-rate aliases added by the pass-1 remediation work.

Suffix grid:

- `_all`
- `_last3`
- `_last5`
- `_last10`
- `_last20`
- `_season`
- `_3ya`
- `_career`

Canonical weighted-rate families using the full 8-field grid:

- `assists_per_60`
- `blocks_per_60`
- `goals_per_60`
- `hits_per_60`
- `ixg_per_60`
- `primary_assists_per_60`
- `secondary_assists_per_60`
- `sog_per_60`

Inventory math:

- `8 families x 8 fields each = 64 fields`

## 8. Canonical Availability and Participation Surfaces

These are the explicit replacement fields for all-strength availability and split-strength participation semantics.

Availability percentage fields:

- `season_availability_pct`
- `three_year_availability_pct`
- `career_availability_pct`
- `availability_pct_last3_team_games`
- `availability_pct_last5_team_games`
- `availability_pct_last10_team_games`
- `availability_pct_last20_team_games`

Availability support fields:

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

Participation percentage fields:

- `season_participation_pct`
- `three_year_participation_pct`
- `career_participation_pct`
- `participation_pct_last3_team_games`
- `participation_pct_last5_team_games`
- `participation_pct_last10_team_games`
- `participation_pct_last20_team_games`

Participation support fields:

- `season_participation_games`
- `three_year_participation_games`
- `career_participation_games`
- `participation_games_last3_team_games`
- `participation_games_last5_team_games`
- `participation_games_last10_team_games`
- `participation_games_last20_team_games`

Inventory math:

- `7 availability pct + 14 availability support + 7 participation pct + 7 participation support = 35 fields`

## 9. Persisted Formula Support Columns

These fields exist so canonical ratios and weighted rates can be reconstructed directly from stored numerators and denominators.

### 9.1 Historical Ratio Support Columns

Exact fields:

- `shooting_pct_goals_season`
- `shooting_pct_shots_season`
- `shooting_pct_goals_3ya`
- `shooting_pct_shots_3ya`
- `shooting_pct_goals_career`
- `shooting_pct_shots_career`
- `expected_sh_pct_ixg_season`
- `expected_sh_pct_shots_season`
- `expected_sh_pct_ixg_3ya`
- `expected_sh_pct_shots_3ya`
- `expected_sh_pct_ixg_career`
- `expected_sh_pct_shots_career`
- `cf_pct_cf_season`
- `cf_pct_ca_season`
- `cf_pct_cf_3ya`
- `cf_pct_ca_3ya`
- `cf_pct_cf_career`
- `cf_pct_ca_career`
- `ff_pct_ff_season`
- `ff_pct_fa_season`
- `ff_pct_ff_3ya`
- `ff_pct_fa_3ya`
- `ff_pct_ff_career`
- `ff_pct_fa_career`

Inventory math:

- `24 fields`

### 9.2 Historical Weighted-Rate Support Columns

Families with exact numerator / TOI support fields for `season`, `3ya`, and `career`:

- `sog_per_60_shots_*`
- `sog_per_60_toi_seconds_*`
- `ixg_per_60_ixg_*`
- `ixg_per_60_toi_seconds_*`
- `hits_per_60_hits_*`
- `hits_per_60_toi_seconds_*`
- `blocks_per_60_blocks_*`
- `blocks_per_60_toi_seconds_*`
- `goals_per_60_goals_*`
- `goals_per_60_toi_seconds_*`
- `assists_per_60_assists_*`
- `assists_per_60_toi_seconds_*`
- `primary_assists_per_60_primary_assists_*`
- `primary_assists_per_60_toi_seconds_*`
- `secondary_assists_per_60_secondary_assists_*`
- `secondary_assists_per_60_toi_seconds_*`

Scope grid:

- `_season`
- `_3ya`
- `_career`

Inventory math:

- `8 weighted-rate families x 2 support columns x 3 historical scopes = 48 fields`

### 9.3 Full-Scope Ratio Support Columns

Primary points percentage support:

- `primary_points_pct_primary_points_all`
- `primary_points_pct_points_all`
- `primary_points_pct_primary_points_last3`
- `primary_points_pct_points_last3`
- `primary_points_pct_primary_points_last5`
- `primary_points_pct_points_last5`
- `primary_points_pct_primary_points_last10`
- `primary_points_pct_points_last10`
- `primary_points_pct_primary_points_last20`
- `primary_points_pct_points_last20`
- `primary_points_pct_primary_points_season`
- `primary_points_pct_points_season`
- `primary_points_pct_primary_points_3ya`
- `primary_points_pct_points_3ya`
- `primary_points_pct_primary_points_career`
- `primary_points_pct_points_career`

IPP support:

- `ipp_points_all`
- `ipp_on_ice_goals_for_all`
- `ipp_points_last3`
- `ipp_on_ice_goals_for_last3`
- `ipp_points_last5`
- `ipp_on_ice_goals_for_last5`
- `ipp_points_last10`
- `ipp_on_ice_goals_for_last10`
- `ipp_points_last20`
- `ipp_on_ice_goals_for_last20`
- `ipp_points_season`
- `ipp_on_ice_goals_for_season`
- `ipp_points_3ya`
- `ipp_on_ice_goals_for_3ya`
- `ipp_points_career`
- `ipp_on_ice_goals_for_career`

On-ice shooting percentage support:

- `on_ice_sh_pct_goals_for_all`
- `on_ice_sh_pct_shots_for_all`
- `on_ice_sh_pct_goals_for_last3`
- `on_ice_sh_pct_shots_for_last3`
- `on_ice_sh_pct_goals_for_last5`
- `on_ice_sh_pct_shots_for_last5`
- `on_ice_sh_pct_goals_for_last10`
- `on_ice_sh_pct_shots_for_last10`
- `on_ice_sh_pct_goals_for_last20`
- `on_ice_sh_pct_shots_for_last20`
- `on_ice_sh_pct_goals_for_season`
- `on_ice_sh_pct_shots_for_season`
- `on_ice_sh_pct_goals_for_3ya`
- `on_ice_sh_pct_shots_for_3ya`
- `on_ice_sh_pct_goals_for_career`
- `on_ice_sh_pct_shots_for_career`

PDO support:

- `pdo_goals_for_all`
- `pdo_shots_for_all`
- `pdo_goals_against_all`
- `pdo_shots_against_all`
- `pdo_goals_for_last3`
- `pdo_shots_for_last3`
- `pdo_goals_against_last3`
- `pdo_shots_against_last3`
- `pdo_goals_for_last5`
- `pdo_shots_for_last5`
- `pdo_goals_against_last5`
- `pdo_shots_against_last5`
- `pdo_goals_for_last10`
- `pdo_shots_for_last10`
- `pdo_goals_against_last10`
- `pdo_shots_against_last10`
- `pdo_goals_for_last20`
- `pdo_shots_for_last20`
- `pdo_goals_against_last20`
- `pdo_shots_against_last20`
- `pdo_goals_for_season`
- `pdo_shots_for_season`
- `pdo_goals_against_season`
- `pdo_shots_against_season`
- `pdo_goals_for_3ya`
- `pdo_shots_for_3ya`
- `pdo_goals_against_3ya`
- `pdo_shots_against_3ya`
- `pdo_goals_for_career`
- `pdo_shots_for_career`
- `pdo_goals_against_career`
- `pdo_shots_against_career`

O-zone start percentage support:

- `oz_start_pct_off_zone_starts_all`
- `oz_start_pct_def_zone_starts_all`
- `oz_start_pct_neutral_zone_starts_all`
- `oz_start_pct_off_zone_starts_last3`
- `oz_start_pct_def_zone_starts_last3`
- `oz_start_pct_neutral_zone_starts_last3`
- `oz_start_pct_off_zone_starts_last5`
- `oz_start_pct_def_zone_starts_last5`
- `oz_start_pct_neutral_zone_starts_last5`
- `oz_start_pct_off_zone_starts_last10`
- `oz_start_pct_def_zone_starts_last10`
- `oz_start_pct_neutral_zone_starts_last10`
- `oz_start_pct_off_zone_starts_last20`
- `oz_start_pct_def_zone_starts_last20`
- `oz_start_pct_neutral_zone_starts_last20`
- `oz_start_pct_off_zone_starts_season`
- `oz_start_pct_def_zone_starts_season`
- `oz_start_pct_neutral_zone_starts_season`
- `oz_start_pct_off_zone_starts_3ya`
- `oz_start_pct_def_zone_starts_3ya`
- `oz_start_pct_neutral_zone_starts_3ya`
- `oz_start_pct_off_zone_starts_career`
- `oz_start_pct_def_zone_starts_career`
- `oz_start_pct_neutral_zone_starts_career`

PP share percentage support:

- `pp_share_pct_player_pp_toi_all`
- `pp_share_pct_team_pp_toi_all`
- `pp_share_pct_player_pp_toi_last3`
- `pp_share_pct_team_pp_toi_last3`
- `pp_share_pct_player_pp_toi_last5`
- `pp_share_pct_team_pp_toi_last5`
- `pp_share_pct_player_pp_toi_last10`
- `pp_share_pct_team_pp_toi_last10`
- `pp_share_pct_player_pp_toi_last20`
- `pp_share_pct_team_pp_toi_last20`
- `pp_share_pct_player_pp_toi_season`
- `pp_share_pct_team_pp_toi_season`
- `pp_share_pct_player_pp_toi_3ya`
- `pp_share_pct_team_pp_toi_3ya`
- `pp_share_pct_player_pp_toi_career`
- `pp_share_pct_team_pp_toi_career`

Inventory math:

- `primary_points_pct 16 + ipp 16 + on_ice_sh_pct 16 + pdo 32 + oz_start_pct 24 + pp_share_pct 16 = 120 fields`

## 10. Pass-2 Classification Notes

- canonical aliases currently exist only for ratio and weighted-rate families, not additive families
- additive families remain on the legacy `avg` / `total` naming grid and still need explicit review for whether that surface is the final public contract
- `gp_pct_*` remains a compatibility-only persisted surface and must stay separate from the canonical availability / participation inventory
- line and PP context labels are persisted row fields and must be audited even though they are not arithmetic metrics
- the support-column surface is large enough that later audit steps must treat it as first-class persisted contract, not optional debug scaffolding

## 11. How This Inventory Should Be Used

- task `1.3` should regroup this surface by the PRD’s required metric families and mark strength applicability, canonical-versus-legacy role, and debug-console visibility
- task `1.4` should map each inventory bucket to the helper and contract files that influence it
- tasks in `2.x` should use this artifact to ensure every persisted field receives a status, a formula entry where applicable, and an action-backlog item when a concrete improvement is discovered
