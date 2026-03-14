## pass-2 authoritative field classification

Sub-task: `5.2`

This artifact determines which persisted field surfaces are authoritative after the current pass-2 validation work and which legacy aliases remain required, misleading, frozen-for-compatibility, or candidates for later deprecation.

## Decision Summary

The current `rolling_player_game_metrics` surface does not collapse into a single rule. It splits into four contract classes:

- canonical authoritative now
- legacy but still authoritative because no canonical replacement exists
- compatibility-only legacy aliases
- later deprecation candidates once downstream readers migrate

## 1. Canonical authoritative now

These fields should be treated as the source-of-truth contract for future readers and for pass-2 validation.

### Ratio families

Authoritative fields:

- canonical ratio aliases:
  - `*_all`
  - `*_last3`
  - `*_last5`
  - `*_last10`
  - `*_last20`
  - `*_season`
  - `*_3ya`
  - `*_career`

Applies to:

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

Reason:

- these fields match the current ratio-of-aggregates contract
- their naming no longer implies fake distinctions between `avg` and `total`
- downstream canonical-first fallback is already viable for some readers

### Weighted-rate families

Authoritative fields:

- canonical weighted-rate aliases:
  - `*_all`
  - `*_last3`
  - `*_last5`
  - `*_last10`
  - `*_last20`
  - `*_season`
  - `*_3ya`
  - `*_career`

Applies to:

- `sog_per_60`
- `ixg_per_60`
- `goals_per_60`
- `assists_per_60`
- `primary_assists_per_60`
- `secondary_assists_per_60`
- `hits_per_60`
- `blocks_per_60`

Reason:

- these fields match the weighted-rate contract
- their naming correctly describes one derived rate surface rather than fake `avg` versus `total` distinctions
- compatibility helpers already prefer them where adopted

### Availability / participation replacement fields

Authoritative fields:

- all-strength availability fields:
  - `season_availability_pct`
  - `three_year_availability_pct`
  - `career_availability_pct`
  - `availability_pct_lastN_team_games`
- split-strength participation fields:
  - `season_participation_games`
  - `three_year_participation_games`
  - `career_participation_games`
  - `participation_games_lastN_team_games`
  - `season_participation_pct`
  - `three_year_participation_pct`
  - `career_participation_pct`
  - `participation_pct_lastN_team_games`
- shared support counters:
  - `season_games_played`
  - `season_team_games_available`
  - `three_year_games_played`
  - `three_year_team_games_available`
  - `career_games_played`
  - `career_team_games_available`
  - `games_played_lastN_team_games`
  - `team_games_available_lastN`

Reason:

- these fields express the new contract explicitly
- they remove the legacy `gp_pct_*` overload
- pass-2 validation should anchor availability semantics here, not in `gp_pct_*`

### Contextual and support fields

Authoritative fields:

- contextual PP / line fields:
  - `pp_unit`
  - `pp_share_of_team`
  - `pp_unit_usage_index`
  - `pp_unit_relative_toi`
  - `pp_vs_unit_avg`
  - `line_combo_slot`
  - `line_combo_group`
- support fields added for ratio and weighted-rate reconstruction

Reason:

- these are the current intended stored surfaces
- there is no parallel legacy naming system that should outrank them

## 2. Legacy but still authoritative because no canonical replacement exists

These fields remain real contract, not mere compatibility aliases.

### Additive metrics

Still-authoritative fields:

- `*_total_all`
- `*_total_last3`
- `*_total_last5`
- `*_total_last10`
- `*_total_last20`
- `*_avg_all`
- `*_avg_last3`
- `*_avg_last5`
- `*_avg_last10`
- `*_avg_last20`
- `*_avg_season`
- `*_avg_3ya`
- `*_avg_career`

Applies to additive families such as:

- goals
- assists
- points
- shots
- hits
- blocks
- PP points
- `ixg`
- `iscf`
- `ihdcf`
- `cf`
- `ca`
- `ff`
- `fa`
- `oi_gf`
- `oi_ga`
- `oi_sf`
- `oi_sa`
- `oz_starts`
- `dz_starts`
- `nz_starts`

Reason:

- additive families still use `total` versus `avg` to represent two distinct meanings
- unlike ratio and weighted-rate families, this naming is not fake duplication
- no canonical additive alias set currently replaces this surface

### TOI additive family

Still-authoritative fields:

- `toi_seconds_total_all`
- `toi_seconds_total_lastN`
- `toi_seconds_avg_all`
- `toi_seconds_avg_lastN`
- `toi_seconds_avg_season`
- `toi_seconds_avg_3ya`
- `toi_seconds_avg_career`

Reason:

- TOI `total` versus `avg` remains semantically meaningful
- downstream readers still depend on `toi_seconds_avg_*`
- no canonical TOI alias family has replaced these fields

## 3. Compatibility-only legacy aliases

These fields should remain readable for now, but they should no longer be treated as the intended contract.

### Ratio legacy aliases

Compatibility-only fields:

- `ratio_metric_total_*`
- `ratio_metric_avg_*`

Reason:

- both names store the same derived ratio snapshot
- `total` and `avg` do not represent distinct arithmetic for ratio families
- they are transitional compatibility surface only

### Weighted-rate legacy aliases

Compatibility-only fields:

- `weighted_rate_metric_total_*`
- `weighted_rate_metric_avg_*`

Reason:

- both names store the same weighted-rate result
- the distinction is misleading and exists only for compatibility

### Legacy GP fields

Compatibility-only fields:

- `gp_pct_total_all`
- `gp_pct_avg_all`
- `gp_pct_avg_season`
- `gp_pct_avg_3ya`
- `gp_pct_avg_career`
- `gp_pct_total_lastN`
- `gp_pct_avg_lastN`

Reason:

- they no longer define the intended contract
- they are overloaded by `gp_semantic_type`
- the replacement availability / participation fields are the real pass-2 contract

## 4. Misleading legacy surfaces that should be frozen for compatibility only

These fields should not receive new product-facing adoption.

Freeze-for-compatibility surface:

- all ratio `*_avg_*` and `*_total_*` aliases
- all weighted-rate `*_avg_*` and `*_total_*` aliases
- all `gp_pct_*` fields

Rule:

- keep writing them while downstream readers still require them
- do not add new consumers against them
- route new readers through canonical fields or explicit compatibility helpers

## 5. Later deprecation candidates

These surfaces are candidates for removal or write-freeze after downstream migration, not immediately.

### First deprecation candidates

- ratio legacy alias grids
- weighted-rate legacy alias grids
- `gp_pct_*` fields

Prerequisites:

- [trends/player/[playerId].tsx](/Users/tim/Code/fhfhockey.com/web/pages/trends/player/[playerId].tsx) must stop encoding legacy suffixes in its UI model
- projection readers must read canonical-first for all migrated families
- compatibility-helper usage must be standardized where migration is still staged

### Not deprecation candidates yet

- additive `*_total_*`
- additive `*_avg_*`
- TOI `toi_seconds_total_*`
- TOI `toi_seconds_avg_*`

Reason:

- these still encode distinct meanings and have no canonical replacement

## 6. Required migration posture after this classification

- new readers should use canonical ratio and weighted-rate aliases first
- new availability reads should use replacement availability / participation fields first
- existing additive and TOI readers may continue to use legacy names because those remain authoritative contract today
- any legacy ratio, weighted-rate, or GP read that remains should be treated as migration debt, not product-contract endorsement
