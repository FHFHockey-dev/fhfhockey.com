wgo_skater_stats:
| column_name                       | data_type        | is_nullable | column_default                               | character_maximum_length |
| --------------------------------- | ---------------- | ----------- | -------------------------------------------- | ------------------------ |
| id                                | integer          | NO          | nextval('wgo_skater_stats_id_seq'::regclass) | null                     |
| player_id                         | integer          | NO          | null                                         | null                     |
| player_name                       | text             | NO          | null                                         | null                     |
| date                              | date             | NO          | null                                         | null                     |
| shoots_catches                    | text             | YES         | null                                         | null                     |
| position_code                     | text             | YES         | null                                         | null                     |
| games_played                      | integer          | YES         | null                                         | null                     |
| points                            | integer          | YES         | null                                         | null                     |
| points_per_game                   | double precision | YES         | null                                         | null                     |
| goals                             | integer          | YES         | null                                         | null                     |
| assists                           | integer          | YES         | null                                         | null                     |
| shots                             | integer          | YES         | null                                         | null                     |
| shooting_percentage               | double precision | YES         | null                                         | null                     |
| plus_minus                        | integer          | YES         | null                                         | null                     |
| ot_goals                          | integer          | YES         | null                                         | null                     |
| gw_goals                          | integer          | YES         | null                                         | null                     |
| pp_points                         | integer          | YES         | null                                         | null                     |
| fow_percentage                    | double precision | YES         | null                                         | null                     |
| toi_per_game                      | double precision | YES         | null                                         | null                     |
| blocked_shots                     | integer          | YES         | null                                         | null                     |
| blocks_per_60                     | double precision | YES         | null                                         | null                     |
| empty_net_assists                 | integer          | YES         | null                                         | null                     |
| empty_net_goals                   | integer          | YES         | null                                         | null                     |
| empty_net_points                  | integer          | YES         | null                                         | null                     |
| first_goals                       | integer          | YES         | null                                         | null                     |
| giveaways                         | integer          | YES         | null                                         | null                     |
| giveaways_per_60                  | double precision | YES         | null                                         | null                     |
| hits                              | integer          | YES         | null                                         | null                     |
| hits_per_60                       | double precision | YES         | null                                         | null                     |
| missed_shot_crossbar              | integer          | YES         | null                                         | null                     |
| missed_shot_goal_post             | integer          | YES         | null                                         | null                     |
| missed_shot_over_net              | integer          | YES         | null                                         | null                     |
| missed_shot_short_side            | integer          | YES         | null                                         | null                     |
| missed_shot_wide_of_net           | integer          | YES         | null                                         | null                     |
| missed_shots                      | integer          | YES         | null                                         | null                     |
| takeaways                         | integer          | YES         | null                                         | null                     |
| takeaways_per_60                  | double precision | YES         | null                                         | null                     |
| d_zone_fo_percentage              | double precision | YES         | null                                         | null                     |
| d_zone_faceoffs                   | integer          | YES         | null                                         | null                     |
| ev_faceoff_percentage             | double precision | YES         | null                                         | null                     |
| ev_faceoffs                       | integer          | YES         | null                                         | null                     |
| n_zone_fo_percentage              | double precision | YES         | null                                         | null                     |
| n_zone_faceoffs                   | integer          | YES         | null                                         | null                     |
| o_zone_fo_percentage              | double precision | YES         | null                                         | null                     |
| o_zone_faceoffs                   | integer          | YES         | null                                         | null                     |
| pp_faceoff_percentage             | double precision | YES         | null                                         | null                     |
| pp_faceoffs                       | integer          | YES         | null                                         | null                     |
| sh_faceoff_percentage             | double precision | YES         | null                                         | null                     |
| sh_faceoffs                       | integer          | YES         | null                                         | null                     |
| total_faceoffs                    | integer          | YES         | null                                         | null                     |
| d_zone_fol                        | integer          | YES         | null                                         | null                     |
| d_zone_fow                        | integer          | YES         | null                                         | null                     |
| ev_fol                            | integer          | YES         | null                                         | null                     |
| ev_fow                            | integer          | YES         | null                                         | null                     |
| n_zone_fol                        | integer          | YES         | null                                         | null                     |
| n_zone_fow                        | integer          | YES         | null                                         | null                     |
| o_zone_fol                        | integer          | YES         | null                                         | null                     |
| o_zone_fow                        | integer          | YES         | null                                         | null                     |
| pp_fol                            | integer          | YES         | null                                         | null                     |
| pp_fow                            | integer          | YES         | null                                         | null                     |
| sh_fol                            | integer          | YES         | null                                         | null                     |
| sh_fow                            | integer          | YES         | null                                         | null                     |
| total_fol                         | integer          | YES         | null                                         | null                     |
| total_fow                         | integer          | YES         | null                                         | null                     |
| es_goal_diff                      | integer          | YES         | null                                         | null                     |
| es_goals_against                  | integer          | YES         | null                                         | null                     |
| es_goals_for                      | integer          | YES         | null                                         | null                     |
| es_goals_for_percentage           | double precision | YES         | null                                         | null                     |
| es_toi_per_game                   | double precision | YES         | null                                         | null                     |
| pp_goals_against                  | integer          | YES         | null                                         | null                     |
| pp_goals_for                      | integer          | YES         | null                                         | null                     |
| pp_toi_per_game                   | double precision | YES         | null                                         | null                     |
| sh_goals_against                  | integer          | YES         | null                                         | null                     |
| sh_goals_for                      | integer          | YES         | null                                         | null                     |
| sh_toi_per_game                   | double precision | YES         | null                                         | null                     |
| game_misconduct_penalties         | integer          | YES         | null                                         | null                     |
| major_penalties                   | integer          | YES         | null                                         | null                     |
| match_penalties                   | integer          | YES         | null                                         | null                     |
| minor_penalties                   | integer          | YES         | null                                         | null                     |
| misconduct_penalties              | integer          | YES         | null                                         | null                     |
| net_penalties                     | integer          | YES         | null                                         | null                     |
| net_penalties_per_60              | double precision | YES         | null                                         | null                     |
| penalties                         | integer          | YES         | null                                         | null                     |
| penalties_drawn                   | integer          | YES         | null                                         | null                     |
| penalties_drawn_per_60            | double precision | YES         | null                                         | null                     |
| penalties_taken_per_60            | double precision | YES         | null                                         | null                     |
| penalty_minutes                   | integer          | YES         | null                                         | null                     |
| penalty_minutes_per_toi           | double precision | YES         | null                                         | null                     |
| penalty_seconds_per_game          | double precision | YES         | null                                         | null                     |
| pp_goals_against_per_60           | double precision | YES         | null                                         | null                     |
| sh_assists                        | integer          | YES         | null                                         | null                     |
| sh_goals                          | integer          | YES         | null                                         | null                     |
| sh_points                         | integer          | YES         | null                                         | null                     |
| sh_goals_per_60                   | double precision | YES         | null                                         | null                     |
| sh_individual_sat_for             | integer          | YES         | null                                         | null                     |
| sh_individual_sat_per_60          | double precision | YES         | null                                         | null                     |
| sh_points_per_60                  | double precision | YES         | null                                         | null                     |
| sh_primary_assists                | integer          | YES         | null                                         | null                     |
| sh_primary_assists_per_60         | double precision | YES         | null                                         | null                     |
| sh_secondary_assists              | integer          | YES         | null                                         | null                     |
| sh_secondary_assists_per_60       | double precision | YES         | null                                         | null                     |
| sh_shooting_percentage            | double precision | YES         | null                                         | null                     |
| sh_shots                          | integer          | YES         | null                                         | null                     |
| sh_shots_per_60                   | double precision | YES         | null                                         | null                     |
| sh_time_on_ice                    | integer          | YES         | null                                         | null                     |
| sh_time_on_ice_pct_per_game       | double precision | YES         | null                                         | null                     |
| pp_assists                        | integer          | YES         | null                                         | null                     |
| pp_goals                          | integer          | YES         | null                                         | null                     |
| pp_goals_for_per_60               | double precision | YES         | null                                         | null                     |
| pp_goals_per_60                   | double precision | YES         | null                                         | null                     |
| pp_individual_sat_for             | integer          | YES         | null                                         | null                     |
| pp_individual_sat_per_60          | double precision | YES         | null                                         | null                     |
| pp_points_per_60                  | double precision | YES         | null                                         | null                     |
| pp_primary_assists                | integer          | YES         | null                                         | null                     |
| pp_primary_assists_per_60         | double precision | YES         | null                                         | null                     |
| pp_secondary_assists              | integer          | YES         | null                                         | null                     |
| pp_secondary_assists_per_60       | double precision | YES         | null                                         | null                     |
| pp_shooting_percentage            | double precision | YES         | null                                         | null                     |
| pp_shots                          | integer          | YES         | null                                         | null                     |
| pp_shots_per_60                   | double precision | YES         | null                                         | null                     |
| pp_toi                            | integer          | YES         | null                                         | null                     |
| pp_toi_pct_per_game               | double precision | YES         | null                                         | null                     |
| goals_pct                         | double precision | YES         | null                                         | null                     |
| faceoff_pct_5v5                   | double precision | YES         | null                                         | null                     |
| individual_sat_for_per_60         | double precision | YES         | null                                         | null                     |
| individual_shots_for_per_60       | double precision | YES         | null                                         | null                     |
| on_ice_shooting_pct               | double precision | YES         | null                                         | null                     |
| sat_pct                           | double precision | YES         | null                                         | null                     |
| toi_per_game_5v5                  | double precision | YES         | null                                         | null                     |
| usat_pct                          | double precision | YES         | null                                         | null                     |
| zone_start_pct                    | double precision | YES         | null                                         | null                     |
| sat_against                       | integer          | YES         | null                                         | null                     |
| sat_ahead                         | integer          | YES         | null                                         | null                     |
| sat_behind                        | integer          | YES         | null                                         | null                     |
| sat_close                         | integer          | YES         | null                                         | null                     |
| sat_for                           | integer          | YES         | null                                         | null                     |
| sat_tied                          | integer          | YES         | null                                         | null                     |
| sat_total                         | integer          | YES         | null                                         | null                     |
| usat_against                      | integer          | YES         | null                                         | null                     |
| usat_ahead                        | integer          | YES         | null                                         | null                     |
| usat_behind                       | integer          | YES         | null                                         | null                     |
| usat_close                        | integer          | YES         | null                                         | null                     |
| usat_for                          | integer          | YES         | null                                         | null                     |
| usat_tied                         | integer          | YES         | null                                         | null                     |
| usat_total                        | integer          | YES         | null                                         | null                     |
| sat_percentage                    | double precision | YES         | null                                         | null                     |
| sat_percentage_ahead              | double precision | YES         | null                                         | null                     |
| sat_percentage_behind             | double precision | YES         | null                                         | null                     |
| sat_percentage_close              | double precision | YES         | null                                         | null                     |
| sat_percentage_tied               | double precision | YES         | null                                         | null                     |
| sat_relative                      | double precision | YES         | null                                         | null                     |
| shooting_percentage_5v5           | double precision | YES         | null                                         | null                     |
| skater_save_pct_5v5               | double precision | YES         | null                                         | null                     |
| skater_shooting_plus_save_pct_5v5 | double precision | YES         | null                                         | null                     |
| usat_percentage                   | double precision | YES         | null                                         | null                     |
| usat_percentage_ahead             | double precision | YES         | null                                         | null                     |
| usat_percentage_behind            | double precision | YES         | null                                         | null                     |
| usat_percentage_close             | double precision | YES         | null                                         | null                     |
| usat_percentage_tied              | double precision | YES         | null                                         | null                     |
| usat_relative                     | double precision | YES         | null                                         | null                     |
| zone_start_pct_5v5                | double precision | YES         | null                                         | null                     |
| assists_5v5                       | integer          | YES         | null                                         | null                     |
| assists_per_60_5v5                | double precision | YES         | null                                         | null                     |
| goals_5v5                         | integer          | YES         | null                                         | null                     |
| goals_per_60_5v5                  | double precision | YES         | null                                         | null                     |
| net_minor_penalties_per_60        | double precision | YES         | null                                         | null                     |
| o_zone_start_pct_5v5              | double precision | YES         | null                                         | null                     |
| on_ice_shooting_pct_5v5           | double precision | YES         | null                                         | null                     |
| points_5v5                        | integer          | YES         | null                                         | null                     |
| points_per_60_5v5                 | double precision | YES         | null                                         | null                     |
| primary_assists_5v5               | integer          | YES         | null                                         | null                     |
| primary_assists_per_60_5v5        | double precision | YES         | null                                         | null                     |
| sat_relative_5v5                  | double precision | YES         | null                                         | null                     |
| secondary_assists_5v5             | integer          | YES         | null                                         | null                     |
| secondary_assists_per_60_5v5      | double precision | YES         | null                                         | null                     |
| assists_per_game                  | double precision | YES         | null                                         | null                     |
| blocks_per_game                   | double precision | YES         | null                                         | null                     |
| goals_per_game                    | double precision | YES         | null                                         | null                     |
| hits_per_game                     | double precision | YES         | null                                         | null                     |
| penalty_minutes_per_game          | double precision | YES         | null                                         | null                     |
| primary_assists_per_game          | double precision | YES         | null                                         | null                     |
| secondary_assists_per_game        | double precision | YES         | null                                         | null                     |
| shots_per_game                    | double precision | YES         | null                                         | null                     |
| total_primary_assists             | integer          | YES         | null                                         | null                     |
| total_secondary_assists           | integer          | YES         | null                                         | null                     |
| goals_backhand                    | integer          | YES         | null                                         | null                     |
| goals_bat                         | integer          | YES         | null                                         | null                     |
| goals_between_legs                | integer          | YES         | null                                         | null                     |
| goals_cradle                      | integer          | YES         | null                                         | null                     |
| goals_deflected                   | integer          | YES         | null                                         | null                     |
| goals_poke                        | integer          | YES         | null                                         | null                     |
| goals_slap                        | integer          | YES         | null                                         | null                     |
| goals_snap                        | integer          | YES         | null                                         | null                     |
| goals_tip_in                      | integer          | YES         | null                                         | null                     |
| goals_wrap_around                 | integer          | YES         | null                                         | null                     |
| goals_wrist                       | integer          | YES         | null                                         | null                     |
| shooting_pct_backhand             | double precision | YES         | null                                         | null                     |
| shooting_pct_bat                  | double precision | YES         | null                                         | null                     |
| shooting_pct_between_legs         | double precision | YES         | null                                         | null                     |
| shooting_pct_cradle               | double precision | YES         | null                                         | null                     |
| shooting_pct_deflected            | double precision | YES         | null                                         | null                     |
| shooting_pct_poke                 | double precision | YES         | null                                         | null                     |
| shooting_pct_slap                 | double precision | YES         | null                                         | null                     |
| shooting_pct_snap                 | double precision | YES         | null                                         | null                     |
| shooting_pct_tip_in               | double precision | YES         | null                                         | null                     |
| shooting_pct_wrap_around          | double precision | YES         | null                                         | null                     |
| shooting_pct_wrist                | double precision | YES         | null                                         | null                     |
| shots_on_net_backhand             | integer          | YES         | null                                         | null                     |
| shots_on_net_bat                  | integer          | YES         | null                                         | null                     |
| shots_on_net_between_legs         | integer          | YES         | null                                         | null                     |
| shots_on_net_cradle               | integer          | YES         | null                                         | null                     |
| shots_on_net_deflected            | integer          | YES         | null                                         | null                     |
| shots_on_net_poke                 | integer          | YES         | null                                         | null                     |
| shots_on_net_slap                 | integer          | YES         | null                                         | null                     |
| shots_on_net_snap                 | integer          | YES         | null                                         | null                     |
| shots_on_net_tip_in               | integer          | YES         | null                                         | null                     |
| shots_on_net_wrap_around          | integer          | YES         | null                                         | null                     |
| shots_on_net_wrist                | integer          | YES         | null                                         | null                     |
| ev_time_on_ice                    | integer          | YES         | null                                         | null                     |
| ev_time_on_ice_per_game           | double precision | YES         | null                                         | null                     |
| ot_time_on_ice                    | integer          | YES         | null                                         | null                     |
| ot_time_on_ice_per_game           | double precision | YES         | null                                         | null                     |
| shifts                            | integer          | YES         | null                                         | null                     |
| shifts_per_game                   | double precision | YES         | null                                         | null                     |
| time_on_ice_per_shift             | double precision | YES         | null                                         | null                     |
| birth_city                        | text             | YES         | null                                         | null                     |
| birth_date                        | text             | YES         | null                                         | null                     |
| current_team_abbreviation         | text             | YES         | null                                         | null                     |
| current_team_name                 | text             | YES         | null                                         | null                     |
| draft_overall                     | integer          | YES         | null                                         | null                     |
| draft_round                       | integer          | YES         | null                                         | null                     |
| draft_year                        | integer          | YES         | null                                         | null                     |
| first_season_for_game_type        | integer          | YES         | null                                         | null                     |
| nationality_code                  | text             | YES         | null                                         | null                     |
| weight                            | integer          | YES         | null                                         | null                     |
| height                            | integer          | YES         | null                                         | null                     |
| birth_country                     | text             | YES         | null                                         | null                     |
| season_id                         | integer          | YES         | null                                         | null                     |

wgo_skater_stats_totals:
| column_name                       | data_type                | is_nullable | column_default | character_maximum_length |
| --------------------------------- | ------------------------ | ----------- | -------------- | ------------------------ |
| player_id                         | integer                  | NO          | null           | null                     |
| player_name                       | text                     | YES         | null           | null                     |
| season                            | text                     | NO          | null           | null                     |
| shoots_catches                    | text                     | YES         | null           | null                     |
| position_code                     | text                     | YES         | null           | null                     |
| games_played                      | integer                  | YES         | null           | null                     |
| points                            | integer                  | YES         | null           | null                     |
| points_per_game                   | double precision         | YES         | null           | null                     |
| goals                             | integer                  | YES         | null           | null                     |
| assists                           | integer                  | YES         | null           | null                     |
| shots                             | integer                  | YES         | null           | null                     |
| shooting_percentage               | double precision         | YES         | null           | null                     |
| plus_minus                        | integer                  | YES         | null           | null                     |
| ot_goals                          | integer                  | YES         | null           | null                     |
| gw_goals                          | integer                  | YES         | null           | null                     |
| pp_points                         | integer                  | YES         | null           | null                     |
| fow_percentage                    | double precision         | YES         | null           | null                     |
| toi_per_game                      | double precision         | YES         | null           | null                     |
| blocked_shots                     | integer                  | YES         | null           | null                     |
| blocks_per_60                     | double precision         | YES         | null           | null                     |
| empty_net_goals                   | integer                  | YES         | null           | null                     |
| empty_net_points                  | integer                  | YES         | null           | null                     |
| giveaways                         | integer                  | YES         | null           | null                     |
| giveaways_per_60                  | double precision         | YES         | null           | null                     |
| hits                              | integer                  | YES         | null           | null                     |
| hits_per_60                       | double precision         | YES         | null           | null                     |
| missed_shots                      | integer                  | YES         | null           | null                     |
| takeaways                         | integer                  | YES         | null           | null                     |
| takeaways_per_60                  | double precision         | YES         | null           | null                     |
| d_zone_fo_percentage              | double precision         | YES         | null           | null                     |
| d_zone_faceoffs                   | integer                  | YES         | null           | null                     |
| ev_faceoff_percentage             | double precision         | YES         | null           | null                     |
| ev_faceoffs                       | integer                  | YES         | null           | null                     |
| n_zone_fo_percentage              | double precision         | YES         | null           | null                     |
| n_zone_faceoffs                   | integer                  | YES         | null           | null                     |
| o_zone_fo_percentage              | double precision         | YES         | null           | null                     |
| o_zone_faceoffs                   | integer                  | YES         | null           | null                     |
| pp_faceoff_percentage             | double precision         | YES         | null           | null                     |
| pp_faceoffs                       | integer                  | YES         | null           | null                     |
| sh_faceoff_percentage             | double precision         | YES         | null           | null                     |
| sh_faceoffs                       | integer                  | YES         | null           | null                     |
| total_faceoffs                    | integer                  | YES         | null           | null                     |
| d_zone_fol                        | integer                  | YES         | null           | null                     |
| d_zone_fow                        | integer                  | YES         | null           | null                     |
| ev_fol                            | integer                  | YES         | null           | null                     |
| ev_fow                            | integer                  | YES         | null           | null                     |
| n_zone_fol                        | integer                  | YES         | null           | null                     |
| n_zone_fow                        | integer                  | YES         | null           | null                     |
| o_zone_fol                        | integer                  | YES         | null           | null                     |
| o_zone_fow                        | integer                  | YES         | null           | null                     |
| pp_fol                            | integer                  | YES         | null           | null                     |
| pp_fow                            | integer                  | YES         | null           | null                     |
| sh_fol                            | integer                  | YES         | null           | null                     |
| sh_fow                            | integer                  | YES         | null           | null                     |
| total_fol                         | integer                  | YES         | null           | null                     |
| total_fow                         | integer                  | YES         | null           | null                     |
| es_goals_against                  | integer                  | YES         | null           | null                     |
| es_goals_for                      | integer                  | YES         | null           | null                     |
| es_goals_for_percentage           | double precision         | YES         | null           | null                     |
| es_toi_per_game                   | double precision         | YES         | null           | null                     |
| pp_goals_against                  | integer                  | YES         | null           | null                     |
| pp_goals_for                      | integer                  | YES         | null           | null                     |
| pp_toi_per_game                   | double precision         | YES         | null           | null                     |
| sh_goals_against                  | integer                  | YES         | null           | null                     |
| sh_goals_for                      | integer                  | YES         | null           | null                     |
| sh_toi_per_game                   | double precision         | YES         | null           | null                     |
| game_misconduct_penalties         | integer                  | YES         | null           | null                     |
| major_penalties                   | integer                  | YES         | null           | null                     |
| match_penalties                   | integer                  | YES         | null           | null                     |
| minor_penalties                   | integer                  | YES         | null           | null                     |
| misconduct_penalties              | integer                  | YES         | null           | null                     |
| penalties                         | integer                  | YES         | null           | null                     |
| penalties_drawn                   | integer                  | YES         | null           | null                     |
| penalties_drawn_per_60            | double precision         | YES         | null           | null                     |
| penalties_taken_per_60            | double precision         | YES         | null           | null                     |
| penalty_minutes                   | integer                  | YES         | null           | null                     |
| penalty_minutes_per_toi           | double precision         | YES         | null           | null                     |
| penalty_seconds_per_game          | double precision         | YES         | null           | null                     |
| pp_goals_against_per_60           | double precision         | YES         | null           | null                     |
| sh_assists                        | integer                  | YES         | null           | null                     |
| sh_goals                          | integer                  | YES         | null           | null                     |
| sh_points                         | integer                  | YES         | null           | null                     |
| sh_goals_per_60                   | double precision         | YES         | null           | null                     |
| sh_individual_sat_for             | integer                  | YES         | null           | null                     |
| sh_individual_sat_per_60          | double precision         | YES         | null           | null                     |
| sh_points_per_60                  | double precision         | YES         | null           | null                     |
| sh_primary_assists                | integer                  | YES         | null           | null                     |
| sh_primary_assists_per_60         | double precision         | YES         | null           | null                     |
| sh_secondary_assists              | integer                  | YES         | null           | null                     |
| sh_secondary_assists_per_60       | double precision         | YES         | null           | null                     |
| sh_shooting_percentage            | double precision         | YES         | null           | null                     |
| sh_shots                          | integer                  | YES         | null           | null                     |
| sh_shots_per_60                   | double precision         | YES         | null           | null                     |
| sh_time_on_ice                    | integer                  | YES         | null           | null                     |
| sh_time_on_ice_pct_per_game       | double precision         | YES         | null           | null                     |
| pp_assists                        | integer                  | YES         | null           | null                     |
| pp_goals                          | integer                  | YES         | null           | null                     |
| pp_goals_for_per_60               | double precision         | YES         | null           | null                     |
| pp_goals_per_60                   | double precision         | YES         | null           | null                     |
| pp_individual_sat_for             | integer                  | YES         | null           | null                     |
| pp_individual_sat_per_60          | double precision         | YES         | null           | null                     |
| pp_points_per_60                  | double precision         | YES         | null           | null                     |
| pp_primary_assists                | integer                  | YES         | null           | null                     |
| pp_primary_assists_per_60         | double precision         | YES         | null           | null                     |
| pp_secondary_assists              | integer                  | YES         | null           | null                     |
| pp_secondary_assists_per_60       | double precision         | YES         | null           | null                     |
| pp_shooting_percentage            | double precision         | YES         | null           | null                     |
| pp_shots                          | integer                  | YES         | null           | null                     |
| pp_shots_per_60                   | double precision         | YES         | null           | null                     |
| pp_toi                            | integer                  | YES         | null           | null                     |
| pp_toi_pct_per_game               | double precision         | YES         | null           | null                     |
| goals_pct                         | double precision         | YES         | null           | null                     |
| faceoff_pct_5v5                   | double precision         | YES         | null           | null                     |
| individual_sat_for_per_60         | double precision         | YES         | null           | null                     |
| individual_shots_for_per_60       | double precision         | YES         | null           | null                     |
| on_ice_shooting_pct               | double precision         | YES         | null           | null                     |
| sat_pct                           | double precision         | YES         | null           | null                     |
| toi_per_game_5v5                  | double precision         | YES         | null           | null                     |
| usat_pct                          | double precision         | YES         | null           | null                     |
| zone_start_pct                    | double precision         | YES         | null           | null                     |
| sat_against                       | integer                  | YES         | null           | null                     |
| sat_ahead                         | integer                  | YES         | null           | null                     |
| sat_behind                        | integer                  | YES         | null           | null                     |
| sat_close                         | integer                  | YES         | null           | null                     |
| sat_for                           | integer                  | YES         | null           | null                     |
| sat_tied                          | integer                  | YES         | null           | null                     |
| sat_total                         | integer                  | YES         | null           | null                     |
| usat_against                      | integer                  | YES         | null           | null                     |
| usat_ahead                        | integer                  | YES         | null           | null                     |
| usat_behind                       | integer                  | YES         | null           | null                     |
| usat_close                        | integer                  | YES         | null           | null                     |
| usat_for                          | integer                  | YES         | null           | null                     |
| usat_tied                         | integer                  | YES         | null           | null                     |
| usat_total                        | integer                  | YES         | null           | null                     |
| sat_percentage                    | double precision         | YES         | null           | null                     |
| sat_percentage_ahead              | double precision         | YES         | null           | null                     |
| sat_percentage_behind             | double precision         | YES         | null           | null                     |
| sat_percentage_close              | double precision         | YES         | null           | null                     |
| sat_percentage_tied               | double precision         | YES         | null           | null                     |
| sat_relative                      | double precision         | YES         | null           | null                     |
| shooting_percentage_5v5           | double precision         | YES         | null           | null                     |
| skater_save_pct_5v5               | double precision         | YES         | null           | null                     |
| skater_shooting_plus_save_pct_5v5 | double precision         | YES         | null           | null                     |
| usat_percentage                   | double precision         | YES         | null           | null                     |
| usat_percentage_ahead             | double precision         | YES         | null           | null                     |
| usat_percentage_behind            | double precision         | YES         | null           | null                     |
| usat_percentage_close             | double precision         | YES         | null           | null                     |
| usat_percentage_tied              | double precision         | YES         | null           | null                     |
| usat_relative                     | double precision         | YES         | null           | null                     |
| zone_start_pct_5v5                | double precision         | YES         | null           | null                     |
| assists_5v5                       | integer                  | YES         | null           | null                     |
| assists_per_60_5v5                | double precision         | YES         | null           | null                     |
| goals_5v5                         | integer                  | YES         | null           | null                     |
| goals_per_60_5v5                  | double precision         | YES         | null           | null                     |
| o_zone_start_pct_5v5              | double precision         | YES         | null           | null                     |
| on_ice_shooting_pct_5v5           | double precision         | YES         | null           | null                     |
| points_5v5                        | integer                  | YES         | null           | null                     |
| points_per_60_5v5                 | double precision         | YES         | null           | null                     |
| primary_assists_5v5               | integer                  | YES         | null           | null                     |
| primary_assists_per_60_5v5        | double precision         | YES         | null           | null                     |
| sat_relative_5v5                  | double precision         | YES         | null           | null                     |
| secondary_assists_5v5             | integer                  | YES         | null           | null                     |
| secondary_assists_per_60_5v5      | double precision         | YES         | null           | null                     |
| total_primary_assists             | integer                  | YES         | null           | null                     |
| total_secondary_assists           | integer                  | YES         | null           | null                     |
| goals_backhand                    | integer                  | YES         | null           | null                     |
| goals_bat                         | integer                  | YES         | null           | null                     |
| goals_between_legs                | integer                  | YES         | null           | null                     |
| goals_cradle                      | integer                  | YES         | null           | null                     |
| goals_deflected                   | integer                  | YES         | null           | null                     |
| goals_poke                        | integer                  | YES         | null           | null                     |
| goals_slap                        | integer                  | YES         | null           | null                     |
| goals_snap                        | integer                  | YES         | null           | null                     |
| goals_tip_in                      | integer                  | YES         | null           | null                     |
| goals_wrap_around                 | integer                  | YES         | null           | null                     |
| goals_wrist                       | integer                  | YES         | null           | null                     |
| shots_on_net_backhand             | integer                  | YES         | null           | null                     |
| shots_on_net_bat                  | integer                  | YES         | null           | null                     |
| shots_on_net_between_legs         | integer                  | YES         | null           | null                     |
| shots_on_net_cradle               | integer                  | YES         | null           | null                     |
| shots_on_net_deflected            | integer                  | YES         | null           | null                     |
| shots_on_net_poke                 | integer                  | YES         | null           | null                     |
| shots_on_net_slap                 | integer                  | YES         | null           | null                     |
| shots_on_net_snap                 | integer                  | YES         | null           | null                     |
| shots_on_net_tip_in               | integer                  | YES         | null           | null                     |
| shots_on_net_wrap_around          | integer                  | YES         | null           | null                     |
| shots_on_net_wrist                | integer                  | YES         | null           | null                     |
| ev_time_on_ice                    | integer                  | YES         | null           | null                     |
| ev_time_on_ice_per_game           | double precision         | YES         | null           | null                     |
| ot_time_on_ice                    | integer                  | YES         | null           | null                     |
| ot_time_on_ice_per_game           | double precision         | YES         | null           | null                     |
| shifts                            | integer                  | YES         | null           | null                     |
| shifts_per_game                   | double precision         | YES         | null           | null                     |
| time_on_ice_per_shift             | double precision         | YES         | null           | null                     |
| birth_city                        | text                     | YES         | null           | null                     |
| birth_date                        | text                     | YES         | null           | null                     |
| current_team_abbreviation         | text                     | YES         | null           | null                     |
| current_team_name                 | text                     | YES         | null           | null                     |
| draft_overall                     | integer                  | YES         | null           | null                     |
| draft_round                       | integer                  | YES         | null           | null                     |
| draft_year                        | integer                  | YES         | null           | null                     |
| first_season_for_game_type        | integer                  | YES         | null           | null                     |
| nationality_code                  | text                     | YES         | null           | null                     |
| weight                            | integer                  | YES         | null           | null                     |
| height                            | integer                  | YES         | null           | null                     |
| birth_country                     | text                     | YES         | null           | null                     |
| updated_at                        | timestamp with time zone | YES         | null           | null                     |

wgo_goalie_stats:
| column_name                   | data_type        | is_nullable | column_default | character_maximum_length |
| ----------------------------- | ---------------- | ----------- | -------------- | ------------------------ |
| goalie_id                     | integer          | NO          | null           | null                     |
| goalie_name                   | text             | NO          | null           | null                     |
| date                          | date             | NO          | null           | null                     |
| shoots_catches                | text             | YES         | null           | null                     |
| position_code                 | text             | YES         | null           | null                     |
| games_played                  | integer          | YES         | null           | null                     |
| games_started                 | integer          | YES         | null           | null                     |
| wins                          | integer          | YES         | null           | null                     |
| losses                        | integer          | YES         | null           | null                     |
| ot_losses                     | integer          | YES         | null           | null                     |
| save_pct                      | double precision | YES         | null           | null                     |
| saves                         | integer          | YES         | null           | null                     |
| goals_against                 | integer          | YES         | null           | null                     |
| goals_against_avg             | double precision | YES         | null           | null                     |
| shots_against                 | integer          | YES         | null           | null                     |
| time_on_ice                   | double precision | YES         | null           | null                     |
| shutouts                      | integer          | YES         | null           | null                     |
| goals                         | integer          | YES         | null           | null                     |
| assists                       | integer          | YES         | null           | null                     |
| complete_game_pct             | double precision | YES         | null           | null                     |
| complete_games                | integer          | YES         | null           | null                     |
| incomplete_games              | integer          | YES         | null           | null                     |
| quality_start                 | integer          | YES         | null           | null                     |
| quality_starts_pct            | double precision | YES         | null           | null                     |
| regulation_losses             | integer          | YES         | null           | null                     |
| regulation_wins               | integer          | YES         | null           | null                     |
| shots_against_per_60          | double precision | YES         | null           | null                     |
| games_played_days_rest_0      | integer          | YES         | null           | null                     |
| games_played_days_rest_1      | integer          | YES         | null           | null                     |
| games_played_days_rest_2      | integer          | YES         | null           | null                     |
| games_played_days_rest_3      | integer          | YES         | null           | null                     |
| games_played_days_rest_4_plus | integer          | YES         | null           | null                     |
| save_pct_days_rest_0          | double precision | YES         | null           | null                     |
| save_pct_days_rest_1          | double precision | YES         | null           | null                     |
| save_pct_days_rest_2          | double precision | YES         | null           | null                     |
| save_pct_days_rest_3          | double precision | YES         | null           | null                     |
| save_pct_days_rest_4_plus     | double precision | YES         | null           | null                     |
| season_id                     | integer          | YES         | null           | null                     |
| team_abbreviation             | text             | YES         | null           | null                     |

wgo_goalie_stats_totals:
| column_name               | data_type                | is_nullable | column_default | character_maximum_length |
| ------------------------- | ------------------------ | ----------- | -------------- | ------------------------ |
| goalie_id                 | bigint                   | NO          | null           | null                     |
| goalie_name               | text                     | YES         | null           | null                     |
| season_id                 | integer                  | NO          | null           | null                     |
| shoots_catches            | text                     | YES         | null           | null                     |
| games_played              | integer                  | YES         | null           | null                     |
| games_started             | integer                  | YES         | null           | null                     |
| wins                      | integer                  | YES         | null           | null                     |
| losses                    | integer                  | YES         | null           | null                     |
| ot_losses                 | integer                  | YES         | null           | null                     |
| save_pct                  | numeric                  | YES         | null           | null                     |
| saves                     | integer                  | YES         | null           | null                     |
| goals_against             | integer                  | YES         | null           | null                     |
| goals_against_avg         | numeric                  | YES         | null           | null                     |
| shots_against             | integer                  | YES         | null           | null                     |
| time_on_ice               | numeric                  | YES         | null           | null                     |
| shutouts                  | integer                  | YES         | null           | null                     |
| goals                     | integer                  | YES         | null           | null                     |
| assists                   | integer                  | YES         | null           | null                     |
| complete_game_pct         | numeric                  | YES         | null           | null                     |
| complete_games            | integer                  | YES         | null           | null                     |
| incomplete_games          | integer                  | YES         | null           | null                     |
| quality_start             | integer                  | YES         | null           | null                     |
| quality_starts_pct        | numeric                  | YES         | null           | null                     |
| regulation_losses         | integer                  | YES         | null           | null                     |
| regulation_wins           | integer                  | YES         | null           | null                     |
| shots_against_per_60      | numeric                  | YES         | null           | null                     |
| team_abbrevs              | text                     | YES         | null           | null                     |
| updated_at                | timestamp with time zone | YES         | now()          | null                     |
| current_team_abbreviation | text                     | YES         | null           | null                     |

nst_gamelog_as_counts:
| column_name                 | data_type        | is_nullable | column_default                                    | character_maximum_length |
| --------------------------- | ---------------- | ----------- | ------------------------------------------------- | ------------------------ |
| id                          | bigint           | NO          | nextval('nst_gamelog_as_counts_id_seq'::regclass) | null                     |
| player_id                   | bigint           | NO          | null                                              | null                     |
| season                      | integer          | NO          | null                                              | null                     |
| date_scraped                | date             | NO          | null                                              | null                     |
| gp                          | smallint         | YES         | null                                              | null                     |
| toi                         | integer          | YES         | null                                              | null                     |
| goals                       | smallint         | YES         | null                                              | null                     |
| total_assists               | smallint         | YES         | null                                              | null                     |
| first_assists               | smallint         | YES         | null                                              | null                     |
| second_assists              | smallint         | YES         | null                                              | null                     |
| total_points                | smallint         | YES         | null                                              | null                     |
| ipp                         | double precision | YES         | null                                              | null                     |
| shots                       | smallint         | YES         | null                                              | null                     |
| sh_percentage               | double precision | YES         | null                                              | null                     |
| ixg                         | double precision | YES         | null                                              | null                     |
| icf                         | smallint         | YES         | null                                              | null                     |
| iff                         | smallint         | YES         | null                                              | null                     |
| iscfs                       | smallint         | YES         | null                                              | null                     |
| hdcf                        | smallint         | YES         | null                                              | null                     |
| rush_attempts               | smallint         | YES         | null                                              | null                     |
| rebounds_created            | smallint         | YES         | null                                              | null                     |
| pim                         | smallint         | YES         | null                                              | null                     |
| total_penalties             | smallint         | YES         | null                                              | null                     |
| minor_penalties             | smallint         | YES         | null                                              | null                     |
| major_penalties             | smallint         | YES         | null                                              | null                     |
| misconduct_penalties        | smallint         | YES         | null                                              | null                     |
| penalties_drawn             | smallint         | YES         | null                                              | null                     |
| giveaways                   | smallint         | YES         | null                                              | null                     |
| takeaways                   | smallint         | YES         | null                                              | null                     |
| hits                        | smallint         | YES         | null                                              | null                     |
| hits_taken                  | smallint         | YES         | null                                              | null                     |
| shots_blocked               | smallint         | YES         | null                                              | null                     |
| faceoffs_won                | smallint         | YES         | null                                              | null                     |
| faceoffs_lost               | smallint         | YES         | null                                              | null                     |
| faceoffs_percentage         | double precision | YES         | null                                              | null                     |
| cf                          | integer          | YES         | null                                              | null                     |
| ca                          | integer          | YES         | null                                              | null                     |
| ff                          | integer          | YES         | null                                              | null                     |
| fa                          | integer          | YES         | null                                              | null                     |
| sf                          | integer          | YES         | null                                              | null                     |
| sa                          | integer          | YES         | null                                              | null                     |
| gf                          | integer          | YES         | null                                              | null                     |
| ga                          | integer          | YES         | null                                              | null                     |
| scf                         | integer          | YES         | null                                              | null                     |
| sca                         | integer          | YES         | null                                              | null                     |
| hdca                        | integer          | YES         | null                                              | null                     |
| hdgf                        | integer          | YES         | null                                              | null                     |
| hdga                        | integer          | YES         | null                                              | null                     |
| mdcf                        | integer          | YES         | null                                              | null                     |
| mdca                        | integer          | YES         | null                                              | null                     |
| mdgf                        | integer          | YES         | null                                              | null                     |
| mdga                        | integer          | YES         | null                                              | null                     |
| ldcf                        | integer          | YES         | null                                              | null                     |
| ldca                        | integer          | YES         | null                                              | null                     |
| ldgf                        | integer          | YES         | null                                              | null                     |
| ldga                        | integer          | YES         | null                                              | null                     |
| off_zone_starts             | integer          | YES         | null                                              | null                     |
| neu_zone_starts             | integer          | YES         | null                                              | null                     |
| def_zone_starts             | integer          | YES         | null                                              | null                     |
| off_zone_faceoffs           | integer          | YES         | null                                              | null                     |
| neu_zone_faceoffs           | integer          | YES         | null                                              | null                     |
| def_zone_faceoffs           | integer          | YES         | null                                              | null                     |
| toi_per_gp                  | double precision | YES         | null                                              | null                     |
| goals_per_60                | double precision | YES         | null                                              | null                     |
| total_assists_per_60        | double precision | YES         | null                                              | null                     |
| first_assists_per_60        | double precision | YES         | null                                              | null                     |
| second_assists_per_60       | double precision | YES         | null                                              | null                     |
| total_points_per_60         | double precision | YES         | null                                              | null                     |
| shots_per_60                | double precision | YES         | null                                              | null                     |
| ixg_per_60                  | double precision | YES         | null                                              | null                     |
| icf_per_60                  | double precision | YES         | null                                              | null                     |
| iff_per_60                  | double precision | YES         | null                                              | null                     |
| iscfs_per_60                | double precision | YES         | null                                              | null                     |
| hdcf_per_60                 | double precision | YES         | null                                              | null                     |
| rush_attempts_per_60        | double precision | YES         | null                                              | null                     |
| rebounds_created_per_60     | double precision | YES         | null                                              | null                     |
| pim_per_60                  | double precision | YES         | null                                              | null                     |
| total_penalties_per_60      | double precision | YES         | null                                              | null                     |
| minor_penalties_per_60      | double precision | YES         | null                                              | null                     |
| major_penalties_per_60      | double precision | YES         | null                                              | null                     |
| misconduct_penalties_per_60 | double precision | YES         | null                                              | null                     |
| penalties_drawn_per_60      | double precision | YES         | null                                              | null                     |
| giveaways_per_60            | double precision | YES         | null                                              | null                     |
| takeaways_per_60            | double precision | YES         | null                                              | null                     |
| hits_per_60                 | double precision | YES         | null                                              | null                     |
| hits_taken_per_60           | double precision | YES         | null                                              | null                     |
| shots_blocked_per_60        | double precision | YES         | null                                              | null                     |
| faceoffs_won_per_60         | double precision | YES         | null                                              | null                     |
| faceoffs_lost_per_60        | double precision | YES         | null                                              | null                     |
| cf_pct                      | double precision | YES         | null                                              | null                     |
| ff_pct                      | double precision | YES         | null                                              | null                     |
| sf_pct                      | double precision | YES         | null                                              | null                     |
| gf_pct                      | double precision | YES         | null                                              | null                     |
| xgf                         | double precision | YES         | null                                              | null                     |
| xgf_pct                     | double precision | YES         | null                                              | null                     |
| xga                         | double precision | YES         | null                                              | null                     |
| xga_pct                     | double precision | YES         | null                                              | null                     |
| scf_pct                     | double precision | YES         | null                                              | null                     |
| hdcf_pct                    | double precision | YES         | null                                              | null                     |
| hdgf_pct                    | double precision | YES         | null                                              | null                     |
| mdcf_pct                    | double precision | YES         | null                                              | null                     |
| mdgf_pct                    | double precision | YES         | null                                              | null                     |
| ldcf_pct                    | double precision | YES         | null                                              | null                     |
| ldgf_pct                    | double precision | YES         | null                                              | null                     |
| on_ice_sh_pct               | double precision | YES         | null                                              | null                     |
| on_ice_sv_pct               | double precision | YES         | null                                              | null                     |
| off_zone_start_pct          | double precision | YES         | null                                              | null                     |
| off_zone_faceoff_pct        | double precision | YES         | null                                              | null                     |
| cf_per_60                   | double precision | YES         | null                                              | null                     |
| ca_per_60                   | double precision | YES         | null                                              | null                     |
| ff_per_60                   | double precision | YES         | null                                              | null                     |
| fa_per_60                   | double precision | YES         | null                                              | null                     |
| sf_per_60                   | double precision | YES         | null                                              | null                     |
| sa_per_60                   | double precision | YES         | null                                              | null                     |
| gf_per_60                   | double precision | YES         | null                                              | null                     |
| ga_per_60                   | double precision | YES         | null                                              | null                     |
| xgf_per_60                  | double precision | YES         | null                                              | null                     |
| xga_per_60                  | double precision | YES         | null                                              | null                     |
| scf_per_60                  | double precision | YES         | null                                              | null                     |
| sca_per_60                  | double precision | YES         | null                                              | null                     |
| hdca_per_60                 | double precision | YES         | null                                              | null                     |
| hdgf_per_60                 | double precision | YES         | null                                              | null                     |
| hdga_per_60                 | double precision | YES         | null                                              | null                     |
| mdcf_per_60                 | double precision | YES         | null                                              | null                     |
| mdca_per_60                 | double precision | YES         | null                                              | null                     |
| mdgf_per_60                 | double precision | YES         | null                                              | null                     |
| mdga_per_60                 | double precision | YES         | null                                              | null                     |
| ldcf_per_60                 | double precision | YES         | null                                              | null                     |
| ldca_per_60                 | double precision | YES         | null                                              | null                     |
| ldgf_per_60                 | double precision | YES         | null                                              | null                     |
| ldga_per_60                 | double precision | YES         | null                                              | null                     |
| on_ice_sh_pct_per_60        | double precision | YES         | null                                              | null                     |
| on_ice_sv_pct_per_60        | double precision | YES         | null                                              | null                     |
| pdo                         | double precision | YES         | null                                              | null                     |
| pdo_per_60                  | double precision | YES         | null                                              | null                     |
| off_zone_starts_per_60      | double precision | YES         | null                                              | null                     |
| neu_zone_starts_per_60      | double precision | YES         | null                                              | null                     |
| def_zone_starts_per_60      | double precision | YES         | null                                              | null                     |
| off_zone_start_pct_per_60   | double precision | YES         | null                                              | null                     |
| off_zone_faceoffs_per_60    | double precision | YES         | null                                              | null                     |
| neu_zone_faceoffs_per_60    | double precision | YES         | null                                              | null                     |
| def_zone_faceoffs_per_60    | double precision | YES         | null                                              | null                     |

nst_gamelog_as_counts_oi:
| column_name          | data_type        | is_nullable | column_default                                       | character_maximum_length |
| -------------------- | ---------------- | ----------- | ---------------------------------------------------- | ------------------------ |
| player_id            | integer          | NO          | null                                                 | null                     |
| position             | text             | YES         | null                                                 | null                     |
| gp                   | integer          | YES         | null                                                 | null                     |
| cf                   | integer          | YES         | null                                                 | null                     |
| ca                   | integer          | YES         | null                                                 | null                     |
| cf_pct               | double precision | YES         | null                                                 | null                     |
| ff                   | integer          | YES         | null                                                 | null                     |
| fa                   | integer          | YES         | null                                                 | null                     |
| ff_pct               | double precision | YES         | null                                                 | null                     |
| sf                   | integer          | YES         | null                                                 | null                     |
| sa                   | integer          | YES         | null                                                 | null                     |
| sf_pct               | double precision | YES         | null                                                 | null                     |
| gf                   | integer          | YES         | null                                                 | null                     |
| ga                   | integer          | YES         | null                                                 | null                     |
| gf_pct               | double precision | YES         | null                                                 | null                     |
| xgf                  | double precision | YES         | null                                                 | null                     |
| xga                  | double precision | YES         | null                                                 | null                     |
| xgf_pct              | double precision | YES         | null                                                 | null                     |
| scf                  | integer          | YES         | null                                                 | null                     |
| sca                  | integer          | YES         | null                                                 | null                     |
| scf_pct              | double precision | YES         | null                                                 | null                     |
| hdcf                 | integer          | YES         | null                                                 | null                     |
| hdca                 | integer          | YES         | null                                                 | null                     |
| hdcf_pct             | double precision | YES         | null                                                 | null                     |
| hdgf                 | integer          | YES         | null                                                 | null                     |
| mdcf                 | integer          | YES         | null                                                 | null                     |
| mdca                 | integer          | YES         | null                                                 | null                     |
| mdcf_pct             | double precision | YES         | null                                                 | null                     |
| mdgf                 | integer          | YES         | null                                                 | null                     |
| mdga                 | integer          | YES         | null                                                 | null                     |
| mdgf_pct             | double precision | YES         | null                                                 | null                     |
| ldcf                 | integer          | YES         | null                                                 | null                     |
| ldca                 | integer          | YES         | null                                                 | null                     |
| ldcf_pct             | double precision | YES         | null                                                 | null                     |
| ldgf                 | integer          | YES         | null                                                 | null                     |
| ldga                 | integer          | YES         | null                                                 | null                     |
| ldgf_pct             | double precision | YES         | null                                                 | null                     |
| on_ice_sh_pct        | double precision | YES         | null                                                 | null                     |
| on_ice_sv_pct        | double precision | YES         | null                                                 | null                     |
| off_zone_starts      | integer          | YES         | null                                                 | null                     |
| neu_zone_starts      | integer          | YES         | null                                                 | null                     |
| def_zone_starts      | integer          | YES         | null                                                 | null                     |
| on_the_fly_starts    | integer          | YES         | null                                                 | null                     |
| off_zone_start_pct   | double precision | YES         | null                                                 | null                     |
| off_zone_faceoffs    | integer          | YES         | null                                                 | null                     |
| neu_zone_faceoffs    | integer          | YES         | null                                                 | null                     |
| def_zone_faceoffs    | integer          | YES         | null                                                 | null                     |
| off_zone_faceoff_pct | double precision | YES         | null                                                 | null                     |
| date_scraped         | date             | NO          | null                                                 | null                     |
| season               | integer          | NO          | null                                                 | null                     |
| toi                  | integer          | YES         | null                                                 | null                     |
| pdo                  | double precision | YES         | null                                                 | null                     |
| hdga                 | double precision | YES         | null                                                 | null                     |
| hdgf_pct             | double precision | YES         | null                                                 | null                     |
| id                   | bigint           | NO          | nextval('nst_gamelog_as_counts_oi_id_seq'::regclass) | null                     |
| shots_blocked        | integer          | YES         | null                                                 | null                     |

nst_gamelog_as_rates:
| column_name                 | data_type        | is_nullable | column_default                                   | character_maximum_length |
| --------------------------- | ---------------- | ----------- | ------------------------------------------------ | ------------------------ |
| id                          | bigint           | NO          | nextval('nst_gamelog_as_rates_id_seq'::regclass) | null                     |
| player_id                   | bigint           | NO          | null                                             | null                     |
| season                      | integer          | NO          | null                                             | null                     |
| date_scraped                | date             | NO          | null                                             | null                     |
| gp                          | smallint         | YES         | null                                             | null                     |
| toi                         | integer          | YES         | null                                             | null                     |
| toi_per_gp                  | double precision | YES         | null                                             | null                     |
| goals_per_60                | double precision | YES         | null                                             | null                     |
| total_assists_per_60        | double precision | YES         | null                                             | null                     |
| first_assists_per_60        | double precision | YES         | null                                             | null                     |
| second_assists_per_60       | double precision | YES         | null                                             | null                     |
| total_points_per_60         | double precision | YES         | null                                             | null                     |
| ipp                         | double precision | YES         | null                                             | null                     |
| shots_per_60                | double precision | YES         | null                                             | null                     |
| sh_percentage               | double precision | YES         | null                                             | null                     |
| ixg_per_60                  | double precision | YES         | null                                             | null                     |
| icf_per_60                  | double precision | YES         | null                                             | null                     |
| iff_per_60                  | double precision | YES         | null                                             | null                     |
| iscfs_per_60                | double precision | YES         | null                                             | null                     |
| hdcf_per_60                 | double precision | YES         | null                                             | null                     |
| rush_attempts_per_60        | double precision | YES         | null                                             | null                     |
| rebounds_created_per_60     | double precision | YES         | null                                             | null                     |
| pim_per_60                  | double precision | YES         | null                                             | null                     |
| total_penalties_per_60      | double precision | YES         | null                                             | null                     |
| minor_penalties_per_60      | double precision | YES         | null                                             | null                     |
| major_penalties_per_60      | double precision | YES         | null                                             | null                     |
| misconduct_penalties_per_60 | double precision | YES         | null                                             | null                     |
| penalties_drawn_per_60      | double precision | YES         | null                                             | null                     |
| giveaways_per_60            | double precision | YES         | null                                             | null                     |
| takeaways_per_60            | double precision | YES         | null                                             | null                     |
| hits_per_60                 | double precision | YES         | null                                             | null                     |
| hits_taken_per_60           | double precision | YES         | null                                             | null                     |
| shots_blocked_per_60        | double precision | YES         | null                                             | null                     |
| faceoffs_won_per_60         | double precision | YES         | null                                             | null                     |
| faceoffs_lost_per_60        | double precision | YES         | null                                             | null                     |
| faceoffs_percentage         | double precision | YES         | null                                             | null                     |
| xgf_per_60                  | double precision | YES         | null                                             | null                     |
| xga_per_60                  | double precision | YES         | null                                             | null                     |
| goals                       | integer          | YES         | null                                             | null                     |
| total_assists               | integer          | YES         | null                                             | null                     |
| first_assists               | integer          | YES         | null                                             | null                     |
| second_assists              | integer          | YES         | null                                             | null                     |
| total_points                | integer          | YES         | null                                             | null                     |
| shots                       | integer          | YES         | null                                             | null                     |
| icf                         | integer          | YES         | null                                             | null                     |
| iff                         | integer          | YES         | null                                             | null                     |
| iscfs                       | integer          | YES         | null                                             | null                     |
| hdcf                        | integer          | YES         | null                                             | null                     |
| rush_attempts               | integer          | YES         | null                                             | null                     |
| rebounds_created            | integer          | YES         | null                                             | null                     |
| pim                         | integer          | YES         | null                                             | null                     |
| total_penalties             | integer          | YES         | null                                             | null                     |
| minor_penalties             | integer          | YES         | null                                             | null                     |
| major_penalties             | integer          | YES         | null                                             | null                     |
| misconduct_penalties        | integer          | YES         | null                                             | null                     |
| penalties_drawn             | integer          | YES         | null                                             | null                     |
| giveaways                   | integer          | YES         | null                                             | null                     |
| takeaways                   | integer          | YES         | null                                             | null                     |
| hits                        | integer          | YES         | null                                             | null                     |
| hits_taken                  | integer          | YES         | null                                             | null                     |
| shots_blocked               | integer          | YES         | null                                             | null                     |
| faceoffs_won                | integer          | YES         | null                                             | null                     |
| faceoffs_lost               | integer          | YES         | null                                             | null                     |
| cf                          | integer          | YES         | null                                             | null                     |
| ca                          | integer          | YES         | null                                             | null                     |
| ff                          | integer          | YES         | null                                             | null                     |
| fa                          | integer          | YES         | null                                             | null                     |
| sf                          | integer          | YES         | null                                             | null                     |
| sa                          | integer          | YES         | null                                             | null                     |
| gf                          | integer          | YES         | null                                             | null                     |
| ga                          | integer          | YES         | null                                             | null                     |
| scf                         | integer          | YES         | null                                             | null                     |
| sca                         | integer          | YES         | null                                             | null                     |
| hdca                        | integer          | YES         | null                                             | null                     |
| hdgf                        | integer          | YES         | null                                             | null                     |
| hdga                        | integer          | YES         | null                                             | null                     |
| mdcf                        | integer          | YES         | null                                             | null                     |
| mdca                        | integer          | YES         | null                                             | null                     |
| mdgf                        | integer          | YES         | null                                             | null                     |
| mdga                        | integer          | YES         | null                                             | null                     |
| ldcf                        | integer          | YES         | null                                             | null                     |
| ldca                        | integer          | YES         | null                                             | null                     |
| ldgf                        | integer          | YES         | null                                             | null                     |
| ldga                        | integer          | YES         | null                                             | null                     |
| off_zone_starts             | integer          | YES         | null                                             | null                     |
| neu_zone_starts             | integer          | YES         | null                                             | null                     |
| def_zone_starts             | integer          | YES         | null                                             | null                     |
| off_zone_faceoffs           | integer          | YES         | null                                             | null                     |
| neu_zone_faceoffs           | integer          | YES         | null                                             | null                     |
| def_zone_faceoffs           | integer          | YES         | null                                             | null                     |
| ixg                         | double precision | YES         | null                                             | null                     |
| cf_pct                      | double precision | YES         | null                                             | null                     |
| ff_pct                      | double precision | YES         | null                                             | null                     |
| sf_pct                      | double precision | YES         | null                                             | null                     |
| gf_pct                      | double precision | YES         | null                                             | null                     |
| xgf                         | double precision | YES         | null                                             | null                     |
| xgf_pct                     | double precision | YES         | null                                             | null                     |
| xga                         | double precision | YES         | null                                             | null                     |
| xga_pct                     | double precision | YES         | null                                             | null                     |
| scf_pct                     | double precision | YES         | null                                             | null                     |
| hdcf_pct                    | double precision | YES         | null                                             | null                     |
| hdgf_pct                    | double precision | YES         | null                                             | null                     |
| mdcf_pct                    | double precision | YES         | null                                             | null                     |
| mdgf_pct                    | double precision | YES         | null                                             | null                     |
| ldcf_pct                    | double precision | YES         | null                                             | null                     |
| ldgf_pct                    | double precision | YES         | null                                             | null                     |
| on_ice_sh_pct               | double precision | YES         | null                                             | null                     |
| on_ice_sv_pct               | double precision | YES         | null                                             | null                     |
| off_zone_start_pct          | double precision | YES         | null                                             | null                     |
| off_zone_faceoff_pct        | double precision | YES         | null                                             | null                     |
| cf_per_60                   | double precision | YES         | null                                             | null                     |
| ca_per_60                   | double precision | YES         | null                                             | null                     |
| ff_per_60                   | double precision | YES         | null                                             | null                     |
| fa_per_60                   | double precision | YES         | null                                             | null                     |
| sf_per_60                   | double precision | YES         | null                                             | null                     |
| sa_per_60                   | double precision | YES         | null                                             | null                     |
| gf_per_60                   | double precision | YES         | null                                             | null                     |
| ga_per_60                   | double precision | YES         | null                                             | null                     |
| scf_per_60                  | double precision | YES         | null                                             | null                     |
| sca_per_60                  | double precision | YES         | null                                             | null                     |
| hdca_per_60                 | double precision | YES         | null                                             | null                     |
| hdgf_per_60                 | double precision | YES         | null                                             | null                     |
| hdga_per_60                 | double precision | YES         | null                                             | null                     |
| mdcf_per_60                 | double precision | YES         | null                                             | null                     |
| mdca_per_60                 | double precision | YES         | null                                             | null                     |
| mdgf_per_60                 | double precision | YES         | null                                             | null                     |
| mdga_per_60                 | double precision | YES         | null                                             | null                     |
| ldcf_per_60                 | double precision | YES         | null                                             | null                     |
| ldca_per_60                 | double precision | YES         | null                                             | null                     |
| ldgf_per_60                 | double precision | YES         | null                                             | null                     |
| ldga_per_60                 | double precision | YES         | null                                             | null                     |
| on_ice_sh_pct_per_60        | double precision | YES         | null                                             | null                     |
| on_ice_sv_pct_per_60        | double precision | YES         | null                                             | null                     |
| pdo                         | double precision | YES         | null                                             | null                     |
| pdo_per_60                  | double precision | YES         | null                                             | null                     |
| off_zone_starts_per_60      | double precision | YES         | null                                             | null                     |
| neu_zone_starts_per_60      | double precision | YES         | null                                             | null                     |
| def_zone_starts_per_60      | double precision | YES         | null                                             | null                     |
| off_zone_start_pct_per_60   | double precision | YES         | null                                             | null                     |
| off_zone_faceoffs_per_60    | double precision | YES         | null                                             | null                     |
| neu_zone_faceoffs_per_60    | double precision | YES         | null                                             | null                     |
| def_zone_faceoffs_per_60    | double precision | YES         | null                                             | null                     |

nst_gamelog_as_rates_oi:
| column_name                 | data_type        | is_nullable | column_default                                      | character_maximum_length |
| --------------------------- | ---------------- | ----------- | --------------------------------------------------- | ------------------------ |
| player_id                   | bigint           | NO          | null                                                | null                     |
| position                    | text             | YES         | null                                                | null                     |
| gp                          | integer          | YES         | null                                                | null                     |
| toi                         | integer          | YES         | null                                                | null                     |
| toi_per_gp                  | double precision | YES         | null                                                | null                     |
| cf_per_60                   | double precision | YES         | null                                                | null                     |
| ca_per_60                   | double precision | YES         | null                                                | null                     |
| cf_pct                      | double precision | YES         | null                                                | null                     |
| ff_per_60                   | double precision | YES         | null                                                | null                     |
| fa_per_60                   | double precision | YES         | null                                                | null                     |
| ff_pct                      | double precision | YES         | null                                                | null                     |
| sf_per_60                   | double precision | YES         | null                                                | null                     |
| sa_per_60                   | double precision | YES         | null                                                | null                     |
| sf_pct                      | double precision | YES         | null                                                | null                     |
| gf_per_60                   | double precision | YES         | null                                                | null                     |
| ga_per_60                   | double precision | YES         | null                                                | null                     |
| gf_pct                      | double precision | YES         | null                                                | null                     |
| xgf_per_60                  | double precision | YES         | null                                                | null                     |
| xga_per_60                  | double precision | YES         | null                                                | null                     |
| xgf_pct                     | double precision | YES         | null                                                | null                     |
| scf_per_60                  | double precision | YES         | null                                                | null                     |
| sca_per_60                  | double precision | YES         | null                                                | null                     |
| scf_pct                     | double precision | YES         | null                                                | null                     |
| hdcf_per_60                 | double precision | YES         | null                                                | null                     |
| hdca_per_60                 | double precision | YES         | null                                                | null                     |
| hdcf_pct                    | double precision | YES         | null                                                | null                     |
| hdgf_per_60                 | double precision | YES         | null                                                | null                     |
| hdga_per_60                 | double precision | YES         | null                                                | null                     |
| hdgf_pct                    | double precision | YES         | null                                                | null                     |
| mdcf_per_60                 | double precision | YES         | null                                                | null                     |
| mdca_per_60                 | double precision | YES         | null                                                | null                     |
| mdcf_pct                    | double precision | YES         | null                                                | null                     |
| mdgf_per_60                 | double precision | YES         | null                                                | null                     |
| mdga_per_60                 | double precision | YES         | null                                                | null                     |
| mdgf_pct                    | double precision | YES         | null                                                | null                     |
| ldcf_per_60                 | double precision | YES         | null                                                | null                     |
| ldca_per_60                 | double precision | YES         | null                                                | null                     |
| ldcf_pct                    | double precision | YES         | null                                                | null                     |
| ldgf_per_60                 | double precision | YES         | null                                                | null                     |
| ldga_per_60                 | double precision | YES         | null                                                | null                     |
| ldgf_pct                    | double precision | YES         | null                                                | null                     |
| on_ice_sh_pct               | double precision | YES         | null                                                | null                     |
| on_ice_sv_pct               | double precision | YES         | null                                                | null                     |
| pdo                         | double precision | YES         | null                                                | null                     |
| off_zone_starts_per_60      | double precision | YES         | null                                                | null                     |
| neu_zone_starts_per_60      | double precision | YES         | null                                                | null                     |
| def_zone_starts_per_60      | double precision | YES         | null                                                | null                     |
| on_the_fly_starts_per_60    | double precision | YES         | null                                                | null                     |
| off_zone_start_pct          | double precision | YES         | null                                                | null                     |
| off_zone_faceoffs_per_60    | double precision | YES         | null                                                | null                     |
| neu_zone_faceoffs_per_60    | double precision | YES         | null                                                | null                     |
| def_zone_faceoffs_per_60    | double precision | YES         | null                                                | null                     |
| off_zone_faceoff_pct        | double precision | YES         | null                                                | null                     |
| date_scraped                | date             | NO          | null                                                | null                     |
| season                      | integer          | NO          | null                                                | null                     |
| id                          | bigint           | NO          | nextval('nst_gamelog_as_rates_oi_id_seq'::regclass) | null                     |
| goals                       | integer          | YES         | null                                                | null                     |
| total_assists               | integer          | YES         | null                                                | null                     |
| first_assists               | integer          | YES         | null                                                | null                     |
| second_assists              | integer          | YES         | null                                                | null                     |
| total_points                | integer          | YES         | null                                                | null                     |
| shots                       | integer          | YES         | null                                                | null                     |
| icf                         | integer          | YES         | null                                                | null                     |
| iff                         | integer          | YES         | null                                                | null                     |
| iscfs                       | integer          | YES         | null                                                | null                     |
| hdcf                        | integer          | YES         | null                                                | null                     |
| rush_attempts               | integer          | YES         | null                                                | null                     |
| rebounds_created            | integer          | YES         | null                                                | null                     |
| pim                         | integer          | YES         | null                                                | null                     |
| total_penalties             | integer          | YES         | null                                                | null                     |
| minor_penalties             | integer          | YES         | null                                                | null                     |
| major_penalties             | integer          | YES         | null                                                | null                     |
| misconduct_penalties        | integer          | YES         | null                                                | null                     |
| penalties_drawn             | integer          | YES         | null                                                | null                     |
| giveaways                   | integer          | YES         | null                                                | null                     |
| takeaways                   | integer          | YES         | null                                                | null                     |
| hits                        | integer          | YES         | null                                                | null                     |
| hits_taken                  | integer          | YES         | null                                                | null                     |
| shots_blocked               | integer          | YES         | null                                                | null                     |
| faceoffs_won                | integer          | YES         | null                                                | null                     |
| faceoffs_lost               | integer          | YES         | null                                                | null                     |
| cf                          | integer          | YES         | null                                                | null                     |
| ca                          | integer          | YES         | null                                                | null                     |
| ff                          | integer          | YES         | null                                                | null                     |
| fa                          | integer          | YES         | null                                                | null                     |
| sf                          | integer          | YES         | null                                                | null                     |
| sa                          | integer          | YES         | null                                                | null                     |
| gf                          | integer          | YES         | null                                                | null                     |
| ga                          | integer          | YES         | null                                                | null                     |
| scf                         | integer          | YES         | null                                                | null                     |
| sca                         | integer          | YES         | null                                                | null                     |
| hdca                        | integer          | YES         | null                                                | null                     |
| hdgf                        | integer          | YES         | null                                                | null                     |
| hdga                        | integer          | YES         | null                                                | null                     |
| mdcf                        | integer          | YES         | null                                                | null                     |
| mdca                        | integer          | YES         | null                                                | null                     |
| mdgf                        | integer          | YES         | null                                                | null                     |
| mdga                        | integer          | YES         | null                                                | null                     |
| ldcf                        | integer          | YES         | null                                                | null                     |
| ldca                        | integer          | YES         | null                                                | null                     |
| ldgf                        | integer          | YES         | null                                                | null                     |
| ldga                        | integer          | YES         | null                                                | null                     |
| off_zone_starts             | integer          | YES         | null                                                | null                     |
| neu_zone_starts             | integer          | YES         | null                                                | null                     |
| def_zone_starts             | integer          | YES         | null                                                | null                     |
| off_zone_faceoffs           | integer          | YES         | null                                                | null                     |
| neu_zone_faceoffs           | integer          | YES         | null                                                | null                     |
| def_zone_faceoffs           | integer          | YES         | null                                                | null                     |
| goals_per_60                | double precision | YES         | null                                                | null                     |
| total_assists_per_60        | double precision | YES         | null                                                | null                     |
| first_assists_per_60        | double precision | YES         | null                                                | null                     |
| second_assists_per_60       | double precision | YES         | null                                                | null                     |
| total_points_per_60         | double precision | YES         | null                                                | null                     |
| ipp                         | double precision | YES         | null                                                | null                     |
| shots_per_60                | double precision | YES         | null                                                | null                     |
| sh_percentage               | double precision | YES         | null                                                | null                     |
| ixg                         | double precision | YES         | null                                                | null                     |
| ixg_per_60                  | double precision | YES         | null                                                | null                     |
| icf_per_60                  | double precision | YES         | null                                                | null                     |
| iff_per_60                  | double precision | YES         | null                                                | null                     |
| iscfs_per_60                | double precision | YES         | null                                                | null                     |
| rush_attempts_per_60        | double precision | YES         | null                                                | null                     |
| rebounds_created_per_60     | double precision | YES         | null                                                | null                     |
| pim_per_60                  | double precision | YES         | null                                                | null                     |
| total_penalties_per_60      | double precision | YES         | null                                                | null                     |
| minor_penalties_per_60      | double precision | YES         | null                                                | null                     |
| major_penalties_per_60      | double precision | YES         | null                                                | null                     |
| misconduct_penalties_per_60 | double precision | YES         | null                                                | null                     |
| penalties_drawn_per_60      | double precision | YES         | null                                                | null                     |
| giveaways_per_60            | double precision | YES         | null                                                | null                     |
| takeaways_per_60            | double precision | YES         | null                                                | null                     |
| hits_per_60                 | double precision | YES         | null                                                | null                     |
| hits_taken_per_60           | double precision | YES         | null                                                | null                     |
| shots_blocked_per_60        | double precision | YES         | null                                                | null                     |
| faceoffs_won_per_60         | double precision | YES         | null                                                | null                     |
| faceoffs_lost_per_60        | double precision | YES         | null                                                | null                     |
| faceoffs_percentage         | double precision | YES         | null                                                | null                     |
| xgf                         | double precision | YES         | null                                                | null                     |
| xga                         | double precision | YES         | null                                                | null                     |
| xga_pct                     | double precision | YES         | null                                                | null                     |
| on_ice_sh_pct_per_60        | double precision | YES         | null                                                | null                     |
| on_ice_sv_pct_per_60        | double precision | YES         | null                                                | null                     |
| pdo_per_60                  | double precision | YES         | null                                                | null                     |
| off_zone_start_pct_per_60   | double precision | YES         | null                                                | null                     |

nst_seasonlong_as_counts:
| column_name          | data_type        | is_nullable | column_default | character_maximum_length |
| -------------------- | ---------------- | ----------- | -------------- | ------------------------ |
| player_id            | bigint           | YES         | null           | null                     |
| season               | integer          | YES         | null           | null                     |
| gp                   | bigint           | YES         | null           | null                     |
| toi_seconds          | bigint           | YES         | null           | null                     |
| goals                | bigint           | YES         | null           | null                     |
| total_assists        | bigint           | YES         | null           | null                     |
| first_assists        | bigint           | YES         | null           | null                     |
| second_assists       | bigint           | YES         | null           | null                     |
| total_points         | bigint           | YES         | null           | null                     |
| shots                | bigint           | YES         | null           | null                     |
| sh_percentage        | double precision | YES         | null           | null                     |
| ixg                  | double precision | YES         | null           | null                     |
| icf                  | bigint           | YES         | null           | null                     |
| iff                  | bigint           | YES         | null           | null                     |
| iscfs                | bigint           | YES         | null           | null                     |
| hdcf                 | bigint           | YES         | null           | null                     |
| rush_attempts        | bigint           | YES         | null           | null                     |
| rebounds_created     | bigint           | YES         | null           | null                     |
| pim                  | bigint           | YES         | null           | null                     |
| total_penalties      | bigint           | YES         | null           | null                     |
| minor_penalties      | bigint           | YES         | null           | null                     |
| major_penalties      | bigint           | YES         | null           | null                     |
| misconduct_penalties | bigint           | YES         | null           | null                     |
| penalties_drawn      | bigint           | YES         | null           | null                     |
| giveaways            | bigint           | YES         | null           | null                     |
| takeaways            | bigint           | YES         | null           | null                     |
| hits                 | bigint           | YES         | null           | null                     |
| hits_taken           | bigint           | YES         | null           | null                     |
| shots_blocked        | bigint           | YES         | null           | null                     |
| faceoffs_won         | bigint           | YES         | null           | null                     |
| faceoffs_lost        | bigint           | YES         | null           | null                     |
| faceoffs_percentage  | double precision | YES         | null           | null                     |

nst_seasonlong_as_counts_oi:
| column_name       | data_type        | is_nullable | column_default | character_maximum_length |
| ----------------- | ---------------- | ----------- | -------------- | ------------------------ |
| player_id         | integer          | YES         | null           | null                     |
| season            | integer          | YES         | null           | null                     |
| gp                | bigint           | YES         | null           | null                     |
| toi_seconds_oi    | bigint           | YES         | null           | null                     |
| cf                | bigint           | YES         | null           | null                     |
| ca                | bigint           | YES         | null           | null                     |
| ff                | bigint           | YES         | null           | null                     |
| fa                | bigint           | YES         | null           | null                     |
| sf                | bigint           | YES         | null           | null                     |
| sa                | bigint           | YES         | null           | null                     |
| gf                | bigint           | YES         | null           | null                     |
| ga                | bigint           | YES         | null           | null                     |
| xgf               | double precision | YES         | null           | null                     |
| xga               | double precision | YES         | null           | null                     |
| scf               | bigint           | YES         | null           | null                     |
| sca               | bigint           | YES         | null           | null                     |
| hdcf              | bigint           | YES         | null           | null                     |
| hdca              | bigint           | YES         | null           | null                     |
| hdgf              | bigint           | YES         | null           | null                     |
| hdga              | bigint           | YES         | null           | null                     |
| mdcf              | bigint           | YES         | null           | null                     |
| mdca              | bigint           | YES         | null           | null                     |
| mdgf              | bigint           | YES         | null           | null                     |
| mdga              | bigint           | YES         | null           | null                     |
| ldcf              | bigint           | YES         | null           | null                     |
| ldca              | bigint           | YES         | null           | null                     |
| ldgf              | bigint           | YES         | null           | null                     |
| ldga              | bigint           | YES         | null           | null                     |
| off_zone_starts   | bigint           | YES         | null           | null                     |
| neu_zone_starts   | bigint           | YES         | null           | null                     |
| def_zone_starts   | bigint           | YES         | null           | null                     |
| on_the_fly_starts | bigint           | YES         | null           | null                     |
| off_zone_faceoffs | bigint           | YES         | null           | null                     |
| neu_zone_faceoffs | bigint           | YES         | null           | null                     |
| def_zone_faceoffs | bigint           | YES         | null           | null                     |

nst_seasonlong_as_rates:
| column_name                 | data_type        | is_nullable | column_default | character_maximum_length |
| --------------------------- | ---------------- | ----------- | -------------- | ------------------------ |
| player_id                   | bigint           | YES         | null           | null                     |
| season                      | integer          | YES         | null           | null                     |
| gp                          | bigint           | YES         | null           | null                     |
| toi_seconds                 | bigint           | YES         | null           | null                     |
| goals_per_60                | double precision | YES         | null           | null                     |
| total_assists_per_60        | double precision | YES         | null           | null                     |
| first_assists_per_60        | double precision | YES         | null           | null                     |
| second_assists_per_60       | double precision | YES         | null           | null                     |
| total_points_per_60         | double precision | YES         | null           | null                     |
| shots_per_60                | double precision | YES         | null           | null                     |
| ixg_per_60                  | double precision | YES         | null           | null                     |
| icf_per_60                  | double precision | YES         | null           | null                     |
| iff_per_60                  | double precision | YES         | null           | null                     |
| iscfs_per_60                | double precision | YES         | null           | null                     |
| ihdcf_per_60                | double precision | YES         | null           | null                     |
| rush_attempts_per_60        | double precision | YES         | null           | null                     |
| rebounds_created_per_60     | double precision | YES         | null           | null                     |
| pim_per_60                  | double precision | YES         | null           | null                     |
| total_penalties_per_60      | double precision | YES         | null           | null                     |
| minor_penalties_per_60      | double precision | YES         | null           | null                     |
| major_penalties_per_60      | double precision | YES         | null           | null                     |
| misconduct_penalties_per_60 | double precision | YES         | null           | null                     |
| penalties_drawn_per_60      | double precision | YES         | null           | null                     |
| giveaways_per_60            | double precision | YES         | null           | null                     |
| takeaways_per_60            | double precision | YES         | null           | null                     |
| hits_per_60                 | double precision | YES         | null           | null                     |
| hits_taken_per_60           | double precision | YES         | null           | null                     |
| shots_blocked_per_60        | double precision | YES         | null           | null                     |
| faceoffs_won_per_60         | double precision | YES         | null           | null                     |
| faceoffs_lost_per_60        | double precision | YES         | null           | null                     |
| sh_percentage               | double precision | YES         | null           | null                     |
| faceoffs_percentage         | double precision | YES         | null           | null                     |
| ipp                         | double precision | YES         | null           | null                     |

nst_seasonlong_as_rates_oi:
| column_name          | data_type        | is_nullable | column_default | character_maximum_length |
| -------------------- | ---------------- | ----------- | -------------- | ------------------------ |
| player_id            | integer          | YES         | null           | null                     |
| season               | integer          | YES         | null           | null                     |
| gp                   | bigint           | YES         | null           | null                     |
| toi_seconds_oi       | bigint           | YES         | null           | null                     |
| cf_per_60            | double precision | YES         | null           | null                     |
| ca_per_60            | double precision | YES         | null           | null                     |
| ff_per_60            | double precision | YES         | null           | null                     |
| fa_per_60            | double precision | YES         | null           | null                     |
| sf_per_60            | double precision | YES         | null           | null                     |
| sa_per_60            | double precision | YES         | null           | null                     |
| gf_per_60            | double precision | YES         | null           | null                     |
| ga_per_60            | double precision | YES         | null           | null                     |
| xgf_per_60           | double precision | YES         | null           | null                     |
| xga_per_60           | double precision | YES         | null           | null                     |
| scf_per_60           | double precision | YES         | null           | null                     |
| sca_per_60           | double precision | YES         | null           | null                     |
| hdcf_per_60          | double precision | YES         | null           | null                     |
| hdca_per_60          | double precision | YES         | null           | null                     |
| hdgf_per_60          | double precision | YES         | null           | null                     |
| hdga_per_60          | double precision | YES         | null           | null                     |
| mdcf_per_60          | double precision | YES         | null           | null                     |
| mdca_per_60          | double precision | YES         | null           | null                     |
| mdgf_per_60          | double precision | YES         | null           | null                     |
| mdga_per_60          | double precision | YES         | null           | null                     |
| ldcf_per_60          | double precision | YES         | null           | null                     |
| ldca_per_60          | double precision | YES         | null           | null                     |
| ldgf_per_60          | double precision | YES         | null           | null                     |
| ldga_per_60          | double precision | YES         | null           | null                     |
| cf_pct               | double precision | YES         | null           | null                     |
| ff_pct               | double precision | YES         | null           | null                     |
| sf_pct               | double precision | YES         | null           | null                     |
| gf_pct               | double precision | YES         | null           | null                     |
| xgf_pct              | double precision | YES         | null           | null                     |
| scf_pct              | double precision | YES         | null           | null                     |
| hdcf_pct             | double precision | YES         | null           | null                     |
| hdgf_pct             | double precision | YES         | null           | null                     |
| mdcf_pct             | double precision | YES         | null           | null                     |
| mdgf_pct             | double precision | YES         | null           | null                     |
| ldcf_pct             | double precision | YES         | null           | null                     |
| ldgf_pct             | double precision | YES         | null           | null                     |
| on_ice_sh_pct        | double precision | YES         | null           | null                     |
| on_ice_sv_pct        | double precision | YES         | null           | null                     |
| pdo                  | double precision | YES         | null           | null                     |
| off_zone_start_pct   | double precision | YES         | null           | null                     |
| off_zone_faceoff_pct | double precision | YES         | null           | null                     |

nst_team_all:
| column_name       | data_type                   | is_nullable | column_default    | character_maximum_length |
| ----------------- | --------------------------- | ----------- | ----------------- | ------------------------ |
| team_abbreviation | text                        | NO          | null              | null                     |
| team_name         | text                        | NO          | null              | null                     |
| gp                | integer                     | YES         | null              | null                     |
| toi               | integer                     | YES         | null              | null                     |
| w                 | integer                     | YES         | null              | null                     |
| l                 | integer                     | YES         | null              | null                     |
| otl               | integer                     | YES         | null              | null                     |
| points            | integer                     | YES         | null              | null                     |
| cf                | integer                     | YES         | null              | null                     |
| ca                | integer                     | YES         | null              | null                     |
| cf_pct            | double precision            | YES         | null              | null                     |
| ff                | integer                     | YES         | null              | null                     |
| fa                | integer                     | YES         | null              | null                     |
| ff_pct            | double precision            | YES         | null              | null                     |
| sf                | integer                     | YES         | null              | null                     |
| sa                | integer                     | YES         | null              | null                     |
| sf_pct            | double precision            | YES         | null              | null                     |
| gf                | integer                     | YES         | null              | null                     |
| ga                | integer                     | YES         | null              | null                     |
| gf_pct            | double precision            | YES         | null              | null                     |
| xgf               | double precision            | YES         | null              | null                     |
| xga               | double precision            | YES         | null              | null                     |
| xgf_pct           | double precision            | YES         | null              | null                     |
| scf               | integer                     | YES         | null              | null                     |
| sca               | integer                     | YES         | null              | null                     |
| scf_pct           | double precision            | YES         | null              | null                     |
| hdcf              | integer                     | YES         | null              | null                     |
| hdca              | integer                     | YES         | null              | null                     |
| hdcf_pct          | double precision            | YES         | null              | null                     |
| hdsf              | integer                     | YES         | null              | null                     |
| hdsa              | integer                     | YES         | null              | null                     |
| hdsf_pct          | double precision            | YES         | null              | null                     |
| hdgf              | integer                     | YES         | null              | null                     |
| hdga              | integer                     | YES         | null              | null                     |
| hdgf_pct          | double precision            | YES         | null              | null                     |
| sh_pct            | double precision            | YES         | null              | null                     |
| sv_pct            | double precision            | YES         | null              | null                     |
| pdo               | numeric                     | YES         | null              | null                     |
| date              | date                        | NO          | null              | null                     |
| situation         | text                        | NO          | 'all'::text       | null                     |
| created_at        | timestamp without time zone | YES         | CURRENT_TIMESTAMP | null                     |
| updated_at        | timestamp without time zone | YES         | CURRENT_TIMESTAMP | null                     |

nst_team_stats:
| column_name       | data_type                | is_nullable | column_default    | character_maximum_length |
| ----------------- | ------------------------ | ----------- | ----------------- | ------------------------ |
| team_abbreviation | text                     | NO          | null              | null                     |
| team_name         | text                     | NO          | null              | null                     |
| gp                | integer                  | YES         | null              | null                     |
| toi               | bigint                   | YES         | null              | null                     |
| w                 | integer                  | YES         | null              | null                     |
| l                 | integer                  | YES         | null              | null                     |
| otl               | integer                  | YES         | null              | null                     |
| points            | integer                  | YES         | null              | null                     |
| cf                | integer                  | YES         | null              | null                     |
| ca                | integer                  | YES         | null              | null                     |
| cf_pct            | double precision         | YES         | null              | null                     |
| ff                | integer                  | YES         | null              | null                     |
| fa                | integer                  | YES         | null              | null                     |
| ff_pct            | double precision         | YES         | null              | null                     |
| sf                | integer                  | YES         | null              | null                     |
| sa                | integer                  | YES         | null              | null                     |
| sf_pct            | double precision         | YES         | null              | null                     |
| gf                | integer                  | YES         | null              | null                     |
| ga                | integer                  | YES         | null              | null                     |
| gf_pct            | double precision         | YES         | null              | null                     |
| xgf               | double precision         | YES         | null              | null                     |
| xga               | double precision         | YES         | null              | null                     |
| xgf_pct           | double precision         | YES         | null              | null                     |
| scf               | integer                  | YES         | null              | null                     |
| sca               | integer                  | YES         | null              | null                     |
| scf_pct           | double precision         | YES         | null              | null                     |
| hdcf              | integer                  | YES         | null              | null                     |
| hdca              | integer                  | YES         | null              | null                     |
| hdcf_pct          | double precision         | YES         | null              | null                     |
| hdsf              | integer                  | YES         | null              | null                     |
| hdsa              | integer                  | YES         | null              | null                     |
| hdsf_pct          | double precision         | YES         | null              | null                     |
| hdgf              | integer                  | YES         | null              | null                     |
| hdga              | integer                  | YES         | null              | null                     |
| hdgf_pct          | double precision         | YES         | null              | null                     |
| sh_pct            | double precision         | YES         | null              | null                     |
| sv_pct            | double precision         | YES         | null              | null                     |
| pdo               | numeric                  | YES         | null              | null                     |
| season            | integer                  | NO          | null              | null                     |
| situation         | text                     | NO          | 'all'::text       | null                     |
| created_at        | timestamp with time zone | YES         | CURRENT_TIMESTAMP | null                     |
| updated_at        | timestamp with time zone | YES         | CURRENT_TIMESTAMP | null                     |

wgo_team_stats:
| column_name                | data_type        | is_nullable | column_default                             | character_maximum_length |
| -------------------------- | ---------------- | ----------- | ------------------------------------------ | ------------------------ |
| id                         | integer          | NO          | nextval('wgo_team_stats_id_seq'::regclass) | null                     |
| team_id                    | integer          | YES         | null                                       | null                     |
| franchise_name             | text             | NO          | null                                       | null                     |
| date                       | date             | NO          | null                                       | null                     |
| games_played               | integer          | YES         | null                                       | null                     |
| goals_against              | integer          | YES         | null                                       | null                     |
| goals_against_per_game     | double precision | YES         | null                                       | null                     |
| goals_for                  | integer          | YES         | null                                       | null                     |
| goals_for_per_game         | double precision | YES         | null                                       | null                     |
| losses                     | integer          | YES         | null                                       | null                     |
| ot_losses                  | integer          | YES         | null                                       | null                     |
| penalty_kill_net_pct       | double precision | YES         | null                                       | null                     |
| penalty_kill_pct           | double precision | YES         | null                                       | null                     |
| point_pct                  | double precision | YES         | null                                       | null                     |
| points                     | integer          | YES         | null                                       | null                     |
| power_play_net_pct         | double precision | YES         | null                                       | null                     |
| power_play_pct             | double precision | YES         | null                                       | null                     |
| regulation_and_ot_wins     | integer          | YES         | null                                       | null                     |
| shots_against_per_game     | double precision | YES         | null                                       | null                     |
| shots_for_per_game         | double precision | YES         | null                                       | null                     |
| wins                       | integer          | YES         | null                                       | null                     |
| wins_in_regulation         | integer          | YES         | null                                       | null                     |
| wins_in_shootout           | integer          | YES         | null                                       | null                     |
| faceoff_win_pct            | double precision | YES         | null                                       | null                     |
| blocked_shots              | integer          | YES         | null                                       | null                     |
| blocked_shots_per_60       | double precision | YES         | null                                       | null                     |
| empty_net_goals            | integer          | YES         | null                                       | null                     |
| giveaways                  | integer          | YES         | null                                       | null                     |
| giveaways_per_60           | double precision | YES         | null                                       | null                     |
| hits                       | integer          | YES         | null                                       | null                     |
| hits_per_60                | double precision | YES         | null                                       | null                     |
| missed_shots               | integer          | YES         | null                                       | null                     |
| sat_pct                    | double precision | YES         | null                                       | null                     |
| takeaways                  | integer          | YES         | null                                       | null                     |
| takeaways_per_60           | double precision | YES         | null                                       | null                     |
| time_on_ice_per_game_5v5   | double precision | YES         | null                                       | null                     |
| bench_minor_penalties      | integer          | YES         | null                                       | null                     |
| game_misconducts           | integer          | YES         | null                                       | null                     |
| major_penalties            | integer          | YES         | null                                       | null                     |
| match_penalties            | integer          | YES         | null                                       | null                     |
| minor_penalties            | integer          | YES         | null                                       | null                     |
| misconduct_penalties       | integer          | YES         | null                                       | null                     |
| net_penalties              | integer          | YES         | null                                       | null                     |
| net_penalties_per_60       | double precision | YES         | null                                       | null                     |
| penalties                  | integer          | YES         | null                                       | null                     |
| penalties_drawn_per_60     | double precision | YES         | null                                       | null                     |
| penalties_taken_per_60     | double precision | YES         | null                                       | null                     |
| penalty_minutes            | integer          | YES         | null                                       | null                     |
| penalty_seconds_per_game   | double precision | YES         | null                                       | null                     |
| total_penalties_drawn      | integer          | YES         | null                                       | null                     |
| pk_net_goals               | integer          | YES         | null                                       | null                     |
| pk_net_goals_per_game      | double precision | YES         | null                                       | null                     |
| pp_goals_against           | integer          | YES         | null                                       | null                     |
| pp_goals_against_per_game  | double precision | YES         | null                                       | null                     |
| sh_goals_for               | integer          | YES         | null                                       | null                     |
| sh_goals_for_per_game      | double precision | YES         | null                                       | null                     |
| times_shorthanded          | integer          | YES         | null                                       | null                     |
| times_shorthanded_per_game | double precision | YES         | null                                       | null                     |
| power_play_goals_for       | integer          | YES         | null                                       | null                     |
| pp_goals_per_game          | double precision | YES         | null                                       | null                     |
| pp_net_goals               | integer          | YES         | null                                       | null                     |
| pp_net_goals_per_game      | double precision | YES         | null                                       | null                     |
| pp_opportunities           | integer          | YES         | null                                       | null                     |
| pp_opportunities_per_game  | double precision | YES         | null                                       | null                     |
| pp_time_on_ice_per_game    | double precision | YES         | null                                       | null                     |
| sh_goals_against           | integer          | YES         | null                                       | null                     |
| sh_goals_against_per_game  | double precision | YES         | null                                       | null                     |
| goals_4v3                  | integer          | YES         | null                                       | null                     |
| goals_5v3                  | integer          | YES         | null                                       | null                     |
| goals_5v4                  | integer          | YES         | null                                       | null                     |
| opportunities_4v3          | integer          | YES         | null                                       | null                     |
| opportunities_5v3          | integer          | YES         | null                                       | null                     |
| opportunities_5v4          | integer          | YES         | null                                       | null                     |
| overall_power_play_pct     | double precision | YES         | null                                       | null                     |
| pp_pct_4v3                 | double precision | YES         | null                                       | null                     |
| pp_pct_5v3                 | double precision | YES         | null                                       | null                     |
| pp_pct_5v4                 | double precision | YES         | null                                       | null                     |
| toi_4v3                    | double precision | YES         | null                                       | null                     |
| toi_5v3                    | double precision | YES         | null                                       | null                     |
| toi_5v4                    | double precision | YES         | null                                       | null                     |
| toi_pp                     | double precision | YES         | null                                       | null                     |
| goals_against_3v4          | integer          | YES         | null                                       | null                     |
| goals_against_3v5          | integer          | YES         | null                                       | null                     |
| goals_against_4v5          | integer          | YES         | null                                       | null                     |
| overall_penalty_kill_pct   | double precision | YES         | null                                       | null                     |
| pk_3v4_pct                 | double precision | YES         | null                                       | null                     |
| pk_3v5_pct                 | double precision | YES         | null                                       | null                     |
| pk_4v5_pct                 | double precision | YES         | null                                       | null                     |
| toi_3v4                    | double precision | YES         | null                                       | null                     |
| toi_3v5                    | double precision | YES         | null                                       | null                     |
| toi_4v5                    | double precision | YES         | null                                       | null                     |
| toi_shorthanded            | double precision | YES         | null                                       | null                     |
| times_shorthanded_3v4      | integer          | YES         | null                                       | null                     |
| times_shorthanded_3v5      | integer          | YES         | null                                       | null                     |
| times_shorthanded_4v5      | integer          | YES         | null                                       | null                     |
| sat_against                | integer          | YES         | null                                       | null                     |
| sat_behind                 | integer          | YES         | null                                       | null                     |
| sat_close                  | integer          | YES         | null                                       | null                     |
| sat_for                    | integer          | YES         | null                                       | null                     |
| sat_tied                   | integer          | YES         | null                                       | null                     |
| sat_total                  | integer          | YES         | null                                       | null                     |
| shots_5v5                  | integer          | YES         | null                                       | null                     |
| usat_against               | integer          | YES         | null                                       | null                     |
| usat_ahead                 | integer          | YES         | null                                       | null                     |
| usat_behind                | integer          | YES         | null                                       | null                     |
| usat_close                 | integer          | YES         | null                                       | null                     |
| usat_for                   | integer          | YES         | null                                       | null                     |
| usat_tied                  | integer          | YES         | null                                       | null                     |
| usat_total                 | integer          | YES         | null                                       | null                     |
| goals_for_percentage       | double precision | YES         | null                                       | null                     |
| sat_percentage             | double precision | YES         | null                                       | null                     |
| sat_pct_ahead              | double precision | YES         | null                                       | null                     |
| sat_pct_behind             | double precision | YES         | null                                       | null                     |
| sat_pct_close              | double precision | YES         | null                                       | null                     |
| sat_pct_tied               | double precision | YES         | null                                       | null                     |
| save_pct_5v5               | double precision | YES         | null                                       | null                     |
| shooting_pct_5v5           | double precision | YES         | null                                       | null                     |
| shooting_plus_save_pct_5v5 | double precision | YES         | null                                       | null                     |
| usat_pct                   | double precision | YES         | null                                       | null                     |
| usat_pct_ahead             | double precision | YES         | null                                       | null                     |
| usat_pct_behind            | double precision | YES         | null                                       | null                     |
| usat_pct_close             | double precision | YES         | null                                       | null                     |
| usat_pct_tied              | double precision | YES         | null                                       | null                     |
| zone_start_pct_5v5         | double precision | YES         | null                                       | null                     |
| d_zone_faceoff_pct         | double precision | YES         | null                                       | null                     |
| d_zone_faceoffs            | integer          | YES         | null                                       | null                     |
| ev_faceoff_pct             | double precision | YES         | null                                       | null                     |
| ev_faceoffs                | integer          | YES         | null                                       | null                     |
| neutral_zone_faceoff_pct   | double precision | YES         | null                                       | null                     |
| neutral_zone_faceoffs      | integer          | YES         | null                                       | null                     |
| o_zone_faceoff_pct         | double precision | YES         | null                                       | null                     |
| o_zone_faceoffs            | integer          | YES         | null                                       | null                     |
| pp_faceoff_pct             | double precision | YES         | null                                       | null                     |
| pp_faceoffs                | integer          | YES         | null                                       | null                     |
| sh_faceoff_pct             | double precision | YES         | null                                       | null                     |
| sh_faceoffs                | integer          | YES         | null                                       | null                     |
| total_faceoffs             | integer          | YES         | null                                       | null                     |
| d_zone_fol                 | integer          | YES         | null                                       | null                     |
| d_zone_fow                 | integer          | YES         | null                                       | null                     |
| d_zone_fo                  | integer          | YES         | null                                       | null                     |
| ev_fo                      | integer          | YES         | null                                       | null                     |
| ev_fol                     | integer          | YES         | null                                       | null                     |
| ev_fow                     | integer          | YES         | null                                       | null                     |
| faceoffs_lost              | integer          | YES         | null                                       | null                     |
| faceoffs_won               | integer          | YES         | null                                       | null                     |
| neutral_zone_fol           | integer          | YES         | null                                       | null                     |
| neutral_zone_fow           | integer          | YES         | null                                       | null                     |
| neutral_zone_fo            | integer          | YES         | null                                       | null                     |
| o_zone_fol                 | integer          | YES         | null                                       | null                     |
| o_zone_fow                 | integer          | YES         | null                                       | null                     |
| o_zone_fo                  | integer          | YES         | null                                       | null                     |
| pp_fol                     | integer          | YES         | null                                       | null                     |
| pp_fow                     | integer          | YES         | null                                       | null                     |
| sh_fol                     | integer          | YES         | null                                       | null                     |
| sh_fow                     | integer          | YES         | null                                       | null                     |
| season_id                  | integer          | YES         | null                                       | null                     |
| game_id                    | bigint           | YES         | null                                       | null                     |
| opponent_id                | integer          | YES         | null                                       | null                     |

yahoo_nhl_player_map_mat:
| column_name           | data_type         | is_nullable | column_default | character_maximum_length |
| --------------------- | ----------------- | ----------- | -------------- | ------------------------ |
| nhl_player_id         | text              | YES         | null           | null                     |
| nhl_player_name       | text              | YES         | null           | null                     |
| nhl_team_abbreviation | text              | YES         | null           | null                     |
| normalized_team       | text              | YES         | null           | null                     |
| player_position       | text              | YES         | null           | null                     |
| mapped_position       | text              | YES         | null           | null                     |
| normalized_position   | text              | YES         | null           | null                     |
| yahoo_player_id       | character varying | YES         | null           | 255                      |
| yahoo_player_name     | character varying | YES         | null           | 255                      |
| yahoo_team            | character varying | YES         | null           | 10                       |
| percent_ownership     | double precision  | YES         | null           | null                     |
| eligible_positions    | jsonb             | YES         | null           | null                     |
| injury_note           | text              | YES         | null           | null                     |
| status                | character varying | YES         | null           | 10                       |
| status_full           | character varying | YES         | null           | 255                      |
| points                | numeric           | YES         | null           | null                     |
| goals                 | numeric           | YES         | null           | null                     |
| assists               | numeric           | YES         | null           | null                     |
| shots                 | numeric           | YES         | null           | null                     |
| pp_points             | numeric           | YES         | null           | null                     |
| blocked_shots         | numeric           | YES         | null           | null                     |
| hits                  | numeric           | YES         | null           | null                     |
| total_fow             | numeric           | YES         | null           | null                     |
| penalty_minutes       | numeric           | YES         | null           | null                     |
| sh_points             | numeric           | YES         | null           | null                     |
| wins                  | numeric           | YES         | null           | null                     |
| losses                | numeric           | YES         | null           | null                     |
| saves                 | numeric           | YES         | null           | null                     |
| shots_against         | numeric           | YES         | null           | null                     |
| shutouts              | numeric           | YES         | null           | null                     |
| quality_start         | numeric           | YES         | null           | null                     |
| goals_against_avg     | numeric           | YES         | null           | null                     |
| save_pct              | numeric           | YES         | null           | null                     |
| percent_games         | numeric           | YES         | null           | null                     |
| player_type           | text              | YES         | null           | null                     |

yahoo_players:
| column_name                 | data_type                   | is_nullable | column_default | character_maximum_length |
| --------------------------- | --------------------------- | ----------- | -------------- | ------------------------ |
| player_name                 | character varying           | YES         | null           | 255                      |
| player_id                   | character varying           | YES         | null           | 255                      |
| draft_analysis              | jsonb                       | YES         | null           | null                     |
| average_draft_pick          | double precision            | YES         | null           | null                     |
| average_draft_round         | double precision            | YES         | null           | null                     |
| average_draft_cost          | double precision            | YES         | null           | null                     |
| percent_drafted             | double precision            | YES         | null           | null                     |
| editorial_player_key        | character varying           | YES         | null           | 255                      |
| editorial_team_abbreviation | character varying           | YES         | null           | 10                       |
| editorial_team_full_name    | character varying           | YES         | null           | 255                      |
| eligible_positions          | jsonb                       | YES         | null           | null                     |
| display_position            | text                        | YES         | null           | null                     |
| headshot_url                | text                        | YES         | null           | null                     |
| injury_note                 | text                        | YES         | null           | null                     |
| full_name                   | character varying           | YES         | null           | 255                      |
| percent_ownership           | double precision            | YES         | null           | null                     |
| player_key                  | character varying           | NO          | null           | 255                      |
| position_type               | character varying           | YES         | null           | 50                       |
| status                      | character varying           | YES         | null           | 10                       |
| status_full                 | character varying           | YES         | null           | 255                      |
| last_updated                | timestamp without time zone | YES         | now()          | null                     |
| uniform_number              | smallint                    | YES         | null           | null                     |
| ownership_timeline          | jsonb                       | YES         | '[]'::jsonb    | null                     |

nhl_standings_details:
| column_name                  | data_type | is_nullable | column_default | character_maximum_length |
| ---------------------------- | --------- | ----------- | -------------- | ------------------------ |
| season_id                    | integer   | NO          | null           | null                     |
| date                         | date      | NO          | null           | null                     |
| team_abbrev                  | text      | NO          | null           | null                     |
| conference_abbrev            | text      | YES         | null           | null                     |
| conference_home_sequence     | integer   | YES         | null           | null                     |
| conference_l10_sequence      | integer   | YES         | null           | null                     |
| conference_name              | text      | YES         | null           | null                     |
| conference_road_sequence     | integer   | YES         | null           | null                     |
| conference_sequence          | integer   | YES         | null           | null                     |
| division_abbrev              | text      | YES         | null           | null                     |
| division_home_sequence       | integer   | YES         | null           | null                     |
| division_l10_sequence        | integer   | YES         | null           | null                     |
| division_name                | text      | YES         | null           | null                     |
| division_road_sequence       | integer   | YES         | null           | null                     |
| division_sequence            | integer   | YES         | null           | null                     |
| game_type_id                 | integer   | YES         | null           | null                     |
| games_played                 | integer   | YES         | null           | null                     |
| goal_differential            | integer   | YES         | null           | null                     |
| goal_differential_pctg       | numeric   | YES         | null           | null                     |
| goal_against                 | integer   | YES         | null           | null                     |
| goal_for                     | integer   | YES         | null           | null                     |
| goals_for_pctg               | numeric   | YES         | null           | null                     |
| home_games_played            | integer   | YES         | null           | null                     |
| home_goal_differential       | integer   | YES         | null           | null                     |
| home_goals_against           | integer   | YES         | null           | null                     |
| home_goals_for               | integer   | YES         | null           | null                     |
| home_losses                  | integer   | YES         | null           | null                     |
| home_ot_losses               | integer   | YES         | null           | null                     |
| home_points                  | integer   | YES         | null           | null                     |
| home_regulation_plus_ot_wins | integer   | YES         | null           | null                     |
| home_regulation_wins         | integer   | YES         | null           | null                     |
| home_wins                    | integer   | YES         | null           | null                     |
| l10_games_played             | integer   | YES         | null           | null                     |
| l10_goal_differential        | integer   | YES         | null           | null                     |
| l10_goals_against            | integer   | YES         | null           | null                     |
| l10_goals_for                | integer   | YES         | null           | null                     |
| l10_losses                   | integer   | YES         | null           | null                     |
| l10_ot_losses                | integer   | YES         | null           | null                     |
| l10_points                   | integer   | YES         | null           | null                     |
| l10_regulation_plus_ot_wins  | integer   | YES         | null           | null                     |
| l10_regulation_wins          | integer   | YES         | null           | null                     |
| l10_wins                     | integer   | YES         | null           | null                     |
| league_home_sequence         | integer   | YES         | null           | null                     |
| league_l10_sequence          | integer   | YES         | null           | null                     |
| league_road_sequence         | integer   | YES         | null           | null                     |
| league_sequence              | integer   | YES         | null           | null                     |
| losses                       | integer   | YES         | null           | null                     |
| ot_losses                    | integer   | YES         | null           | null                     |
| place_name                   | text      | YES         | null           | null                     |
| point_pctg                   | numeric   | YES         | null           | null                     |
| points                       | integer   | YES         | null           | null                     |
| regulation_plus_ot_win_pctg  | numeric   | YES         | null           | null                     |
| regulation_plus_ot_wins      | integer   | YES         | null           | null                     |
| regulation_win_pctg          | numeric   | YES         | null           | null                     |
| regulation_wins              | integer   | YES         | null           | null                     |
| road_games_played            | integer   | YES         | null           | null                     |
| road_goal_differential       | integer   | YES         | null           | null                     |
| road_goals_against           | integer   | YES         | null           | null                     |
| road_goals_for               | integer   | YES         | null           | null                     |
| road_losses                  | integer   | YES         | null           | null                     |
| road_ot_losses               | integer   | YES         | null           | null                     |
| road_points                  | integer   | YES         | null           | null                     |
| road_regulation_plus_ot_wins | integer   | YES         | null           | null                     |
| road_regulation_wins         | integer   | YES         | null           | null                     |
| road_wins                    | integer   | YES         | null           | null                     |
| shootout_losses              | integer   | YES         | null           | null                     |
| shootout_wins                | integer   | YES         | null           | null                     |
| streak_code                  | text      | YES         | null           | null                     |
| streak_count                 | integer   | YES         | null           | null                     |
| team_name_default            | text      | YES         | null           | null                     |
| team_name_fr                 | text      | YES         | null           | null                     |
| team_common_name             | text      | YES         | null           | null                     |
| waivers_sequence             | integer   | YES         | null           | null                     |
| wildcard_sequence            | integer   | YES         | null           | null                     |
| win_pctg                     | numeric   | YES         | null           | null                     |
| wins                         | integer   | YES         | null           | null                     |

nhl_team_data:
| column_name                  | data_type | is_nullable | column_default | character_maximum_length |
| ---------------------------- | --------- | ----------- | -------------- | ------------------------ |
| season_id                    | integer   | NO          | null           | null                     |
| date                         | date      | NO          | null           | null                     |
| team_abbrev                  | text      | NO          | null           | null                     |
| conference_abbrev            | text      | YES         | null           | null                     |
| conference_home_sequence     | integer   | YES         | null           | null                     |
| conference_l10_sequence      | integer   | YES         | null           | null                     |
| conference_name              | text      | YES         | null           | null                     |
| conference_road_sequence     | integer   | YES         | null           | null                     |
| conference_sequence          | integer   | YES         | null           | null                     |
| division_abbrev              | text      | YES         | null           | null                     |
| division_home_sequence       | integer   | YES         | null           | null                     |
| division_l10_sequence        | integer   | YES         | null           | null                     |
| division_name                | text      | YES         | null           | null                     |
| division_road_sequence       | integer   | YES         | null           | null                     |
| division_sequence            | integer   | YES         | null           | null                     |
| game_type_id                 | integer   | YES         | null           | null                     |
| games_played                 | integer   | YES         | null           | null                     |
| goal_differential            | integer   | YES         | null           | null                     |
| goal_differential_pctg       | numeric   | YES         | null           | null                     |
| goal_against                 | integer   | YES         | null           | null                     |
| goal_for                     | integer   | YES         | null           | null                     |
| goals_for_pctg               | numeric   | YES         | null           | null                     |
| home_games_played            | integer   | YES         | null           | null                     |
| home_goal_differential       | integer   | YES         | null           | null                     |
| home_goals_against           | integer   | YES         | null           | null                     |
| home_goals_for               | integer   | YES         | null           | null                     |
| home_losses                  | integer   | YES         | null           | null                     |
| home_ot_losses               | integer   | YES         | null           | null                     |
| home_points                  | integer   | YES         | null           | null                     |
| home_regulation_plus_ot_wins | integer   | YES         | null           | null                     |
| home_regulation_wins         | integer   | YES         | null           | null                     |
| home_wins                    | integer   | YES         | null           | null                     |
| l10_games_played             | integer   | YES         | null           | null                     |
| l10_goal_differential        | integer   | YES         | null           | null                     |
| l10_goals_against            | integer   | YES         | null           | null                     |
| l10_goals_for                | integer   | YES         | null           | null                     |
| l10_losses                   | integer   | YES         | null           | null                     |
| l10_ot_losses                | integer   | YES         | null           | null                     |
| l10_points                   | integer   | YES         | null           | null                     |
| l10_regulation_plus_ot_wins  | integer   | YES         | null           | null                     |
| l10_regulation_wins          | integer   | YES         | null           | null                     |
| l10_wins                     | integer   | YES         | null           | null                     |
| league_home_sequence         | integer   | YES         | null           | null                     |
| league_l10_sequence          | integer   | YES         | null           | null                     |
| league_road_sequence         | integer   | YES         | null           | null                     |
| league_sequence              | integer   | YES         | null           | null                     |
| losses                       | integer   | YES         | null           | null                     |
| ot_losses                    | integer   | YES         | null           | null                     |
| place_name                   | text      | YES         | null           | null                     |
| point_pctg                   | numeric   | YES         | null           | null                     |
| points                       | integer   | YES         | null           | null                     |
| regulation_plus_ot_win_pctg  | numeric   | YES         | null           | null                     |
| regulation_plus_ot_wins      | integer   | YES         | null           | null                     |
| regulation_win_pctg          | numeric   | YES         | null           | null                     |
| regulation_wins              | integer   | YES         | null           | null                     |
| road_games_played            | integer   | YES         | null           | null                     |
| road_goal_differential       | integer   | YES         | null           | null                     |
| road_goals_against           | integer   | YES         | null           | null                     |
| road_goals_for               | integer   | YES         | null           | null                     |
| road_losses                  | integer   | YES         | null           | null                     |
| road_ot_losses               | integer   | YES         | null           | null                     |
| road_points                  | integer   | YES         | null           | null                     |
| road_regulation_plus_ot_wins | integer   | YES         | null           | null                     |
| road_regulation_wins         | integer   | YES         | null           | null                     |
| road_wins                    | integer   | YES         | null           | null                     |
| shootout_losses              | integer   | YES         | null           | null                     |
| shootout_wins                | integer   | YES         | null           | null                     |
| streak_code                  | text      | YES         | null           | null                     |
| streak_count                 | integer   | YES         | null           | null                     |
| team_name_default            | text      | YES         | null           | null                     |
| team_name_fr                 | text      | YES         | null           | null                     |
| team_common_name             | text      | YES         | null           | null                     |
| waivers_sequence             | integer   | YES         | null           | null                     |
| wildcard_sequence            | integer   | YES         | null           | null                     |
| win_pctg                     | numeric   | YES         | null           | null                     |
| wins                         | integer   | YES         | null           | null                     |

lineCombinations
| column_name | data_type | is_nullable | column_default | character_maximum_length |
| ----------- | --------- | ----------- | -------------- | ------------------------ |
| gameId      | bigint    | NO          | null           | null                     |
| teamId      | smallint  | NO          | null           | null                     |
| forwards    | ARRAY     | NO          | null           | null                     |
| defensemen  | ARRAY     | NO          | null           | null                     |
| goalies     | ARRAY     | NO          | null           | null                     |

