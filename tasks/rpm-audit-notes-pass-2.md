- ⚠️ `goals`
  - formula: `sum(resolved_goals)`

- ⚠️ `assists`
  - formula: `sum(resolved_assists)`

- ⚠️ `shots`
  - formula: `sum(resolved_shots)`

- ⚠️ `hits`
  - formula: `sum(resolved_hits)`

- ⚠️ `blocks`
  - formula: `sum(resolved_blocks)`

- ⚠️ `points`
  - formula: `sum(resolved_points)`

- ⚠️ `pp_points`
  - formula: `sum(resolved_pp_points)`

- ⚠️ `ixg`
  - formula: `sum(resolved_ixg)`

- ⚠️ `iscf`
  - formula: `sum(iscfs)`

- ⚠️ `ihdcf`
  - formula: `sum(hdcf)`

- ⚠️ `cf`
  - formula: `sum(cf)`

- ⚠️ `ca`
  - formula: `sum(ca)`

- ⚠️ `ff`
  - formula: `sum(ff)`

- ⚠️ `fa`
  - formula: `sum(fa)`

- ⚠️ `oi_gf`
  - formula: `sum(on_ice_goals_for)`

- ⚠️ `oi_ga`
  - formula: `sum(on_ice_goals_against)`

- ⚠️ `oi_sf`
  - formula: `sum(on_ice_shots_for)`

- ⚠️ `oi_sa`
  - formula: `sum(on_ice_shots_against)`

- ⚠️ `oz_starts`
  - formula: `sum(off_zone_starts)`

- ⚠️ `dz_starts`
  - formula: `sum(def_zone_starts)`

- ⚠️ `nz_starts`
  - formula: `sum(neutral_zone_starts)`

- ⚠️ `toi_seconds`
  - formula: `sum(resolved_toi_seconds)`

- ⚠️ `shooting_pct`
  - formula: `sum(goals) / sum(shots) * 100`

- ⚠️ `expected_sh_pct`
  - formula: `sum(ixg) / sum(shots)`

- ⚠️ `primary_points_pct`
  - formula: `sum(goals + first_assists) / sum(total_points)`

- ⚠️ `ipp`
  - formula: `sum(points) / sum(on_ice_goals_for) * 100`

- ⚠️ `oz_start_pct`
  - formula: `sum(off_zone_starts) / sum(off_zone_starts + def_zone_starts) * 100`

- ⚠️ `pp_share_pct`
  - formula: `sum(player_pp_toi) / sum(team_pp_toi_inferred_from_team_share)`

- ⚠️ `on_ice_sh_pct`
  - formula: `sum(on_ice_goals_for) / sum(on_ice_shots_for) * 100`

- ⚠️ `on_ice_sv_pct`
  - formula: `sum(on_ice_shots_against - on_ice_goals_against) / sum(on_ice_shots_against) * 100`

- ⚠️ `pdo`
  - formula: `((sum(on_ice_goals_for) / sum(on_ice_shots_for)) * 100 + (sum(on_ice_shots_against - on_ice_goals_against) / sum(on_ice_shots_against)) * 100) * 0.01`

- ⚠️ `cf_pct`
  - formula: `sum(corsi_for) / sum(corsi_for + corsi_against) * 100`

- ⚠️ `ff_pct`
  - formula: `sum(fenwick_for) / sum(fenwick_for + fenwick_against) * 100`

- ⚠️ `sog_per_60`
  - formula: `sum(shots) / sum(resolved_toi_seconds) * 3600`

- ⚠️ `ixg_per_60`
  - formula: `sum(resolved_ixg) / sum(resolved_toi_seconds) * 3600`

- ⚠️ `goals_per_60`
  - formula: `sum(goals) / sum(resolved_toi_seconds) * 3600`

- ⚠️ `assists_per_60`
  - formula: `sum(total_assists) / sum(resolved_toi_seconds) * 3600`

- ⚠️ `primary_assists_per_60`
  - formula: `sum(first_assists) / sum(resolved_toi_seconds) * 3600`

- ⚠️ `secondary_assists_per_60`
  - formula: `sum(second_assists) / sum(resolved_toi_seconds) * 3600`

- ⚠️ `hits_per_60`
  - formula: `sum(hits) / sum(resolved_toi_seconds) * 3600`

- ⚠️ `blocks_per_60`
  - formula: `sum(blocks) / sum(resolved_toi_seconds) * 3600`

- ⚠️ `games_played`
  - formula: `season_games_played`

- ⚠️ `team_games_played`
  - formula: `season_team_games_available`

- ⚠️ `season_games_played`
  - formula: `count(current_season_team_games where player_appeared if gp_semantic_type = availability else player_strength_toi_seconds > 0)`

- ⚠️ `season_team_games_available`
  - formula: `count(current_season_team_games_in_scope)`

- ⚠️ `three_year_games_played`
  - formula: `count(team_games_in_current_season_and_prior_two where player_appeared if gp_semantic_type = availability else player_strength_toi_seconds > 0)`

- ⚠️ `three_year_team_games_available`
  - formula: `count(team_games_in_current_season_and_prior_two_in_scope)`

- ⚠️ `career_games_played`
  - formula: `count(career_team_games_in_scope where player_appeared if gp_semantic_type = availability else player_strength_toi_seconds > 0)`

- ⚠️ `career_team_games_available`
  - formula: `count(career_team_games_in_scope)`

- ⚠️ `games_played_last3_team_games`
  - formula: `count(current_team_games_in_last3 where player_appeared if gp_semantic_type = availability else player_strength_toi_seconds > 0)`

- ⚠️ `games_played_last5_team_games`
  - formula: `count(current_team_games_in_last5 where player_appeared if gp_semantic_type = availability else player_strength_toi_seconds > 0)`

- ⚠️ `games_played_last10_team_games`
  - formula: `count(current_team_games_in_last10 where player_appeared if gp_semantic_type = availability else player_strength_toi_seconds > 0)`

- ⚠️ `games_played_last20_team_games`
  - formula: `count(current_team_games_in_last20 where player_appeared if gp_semantic_type = availability else player_strength_toi_seconds > 0)`

- ⚠️ `team_games_available_last3`
  - formula: `count(current_team_games_in_last3)`

- ⚠️ `team_games_available_last5`
  - formula: `count(current_team_games_in_last5)`

- ⚠️ `team_games_available_last10`
  - formula: `count(current_team_games_in_last10)`

- ⚠️ `team_games_available_last20`
  - formula: `count(current_team_games_in_last20)`

- ⚠️ `season_availability_pct`
  - formula: `season_games_played / season_team_games_available`

- ⚠️ `three_year_availability_pct`
  - formula: `three_year_games_played / three_year_team_games_available`

- ⚠️ `career_availability_pct`
  - formula: `career_games_played / career_team_games_available`

- ⚠️ `availability_pct_last3_team_games`
  - formula: `games_played_last3_team_games / team_games_available_last3`

- ⚠️ `availability_pct_last5_team_games`
  - formula: `games_played_last5_team_games / team_games_available_last5`

- ⚠️ `availability_pct_last10_team_games`
  - formula: `games_played_last10_team_games / team_games_available_last10`

- ⚠️ `availability_pct_last20_team_games`
  - formula: `games_played_last20_team_games / team_games_available_last20`

- ⚠️ `season_participation_games`
  - formula: `season_games_played when gp_semantic_type = participation else null`

- ⚠️ `three_year_participation_games`
  - formula: `three_year_games_played when gp_semantic_type = participation else null`

- ⚠️ `career_participation_games`
  - formula: `career_games_played when gp_semantic_type = participation else null`

- ⚠️ `participation_games_last3_team_games`
  - formula: `games_played_last3_team_games when gp_semantic_type = participation else null`

- ⚠️ `participation_games_last5_team_games`
  - formula: `games_played_last5_team_games when gp_semantic_type = participation else null`

- ⚠️ `participation_games_last10_team_games`
  - formula: `games_played_last10_team_games when gp_semantic_type = participation else null`

- ⚠️ `participation_games_last20_team_games`
  - formula: `games_played_last20_team_games when gp_semantic_type = participation else null`

- ⚠️ `season_participation_pct`
  - formula: `season_participation_games / season_team_games_available`

- ⚠️ `three_year_participation_pct`
  - formula: `three_year_participation_games / three_year_team_games_available`

- ⚠️ `career_participation_pct`
  - formula: `career_participation_games / career_team_games_available`

- ⚠️ `participation_pct_last3_team_games`
  - formula: `participation_games_last3_team_games / team_games_available_last3`

- ⚠️ `participation_pct_last5_team_games`
  - formula: `participation_games_last5_team_games / team_games_available_last5`

- ⚠️ `participation_pct_last10_team_games`
  - formula: `participation_games_last10_team_games / team_games_available_last10`

- ⚠️ `participation_pct_last20_team_games`
  - formula: `participation_games_last20_team_games / team_games_available_last20`

- ⚠️ `gp_semantic_type`
  - formula: `availability if strength_state = all else participation`

- ⚠️ `gp_pct_total_all`
  - formula: `season_availability_pct if gp_semantic_type = availability else season_participation_pct`

- ⚠️ `gp_pct_total_last3`
  - formula: `availability_pct_last3_team_games if gp_semantic_type = availability else participation_pct_last3_team_games`

- ⚠️ `gp_pct_total_last5`
  - formula: `availability_pct_last5_team_games if gp_semantic_type = availability else participation_pct_last5_team_games`

- ⚠️ `gp_pct_total_last10`
  - formula: `availability_pct_last10_team_games if gp_semantic_type = availability else participation_pct_last10_team_games`

- ⚠️ `gp_pct_total_last20`
  - formula: `availability_pct_last20_team_games if gp_semantic_type = availability else participation_pct_last20_team_games`

- ⚠️ `gp_pct_avg_all`
  - formula: `gp_pct_total_all`

- ⚠️ `gp_pct_avg_last3`
  - formula: `gp_pct_total_last3`

- ⚠️ `gp_pct_avg_last5`
  - formula: `gp_pct_total_last5`

- ⚠️ `gp_pct_avg_last10`
  - formula: `gp_pct_total_last10`

- ⚠️ `gp_pct_avg_last20`
  - formula: `gp_pct_total_last20`

- ⚠️ `gp_pct_avg_season`
  - formula: `season_availability_pct if gp_semantic_type = availability else season_participation_pct`

- ⚠️ `gp_pct_avg_3ya`
  - formula: `three_year_availability_pct if gp_semantic_type = availability else three_year_participation_pct`

- ⚠️ `gp_pct_avg_career`
  - formula: `career_availability_pct if gp_semantic_type = availability else career_participation_pct`

- ⚠️ `pp_unit`
  - formula: `builder.unit if original_game_id present and builder.unit is positive integer else null`

- ⚠️ `pp_share_of_team`
  - formula: `builder.PPTOI / team_pp_toi_seconds`

- ⚠️ `pp_unit_usage_index`
  - formula: `builder.PPTOI / avg_unit_toi_seconds`

- ⚠️ `pp_unit_relative_toi`
  - formula: `builder.PPTOI - avg_unit_toi_seconds`

- ⚠️ `pp_vs_unit_avg`
  - formula: `(builder.PPTOI / avg_unit_toi_seconds) - 1`

- ⚠️ `line_combo_slot`
  - formula: `floor(player_index_within_builder_group / group_size) + 1 when player is assigned else null`

- ⚠️ `line_combo_group`
  - formula: `forward|defense|goalie from builder_membership else null`
