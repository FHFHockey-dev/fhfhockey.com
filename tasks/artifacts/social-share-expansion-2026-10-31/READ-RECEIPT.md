# Social Share expansion: read receipt

Authority: TJ, 2026-10-31 (relayed by the parent session): SELECT-only Supabase coverage queries, at most 50 sample rows per table, plus local dev renders. No writes, migrations, NST or Yahoo provider calls, or Vercel.

Project `fyhftlxokyjtpndbkfse`, read through the Supabase MCP `execute_sql` tool on 2026-10-31. Every statement below was a single `SELECT`. **Sample rows returned: 0.** Every result was metadata, a privilege check or an aggregate, so no player-level rows left the database. No statement wrote anything.

| # | Statement | Tables read | Rows returned | Result |
| --- | --- | --- | --- | --- |
| 1 | Table inventory by name pattern | `information_schema.tables` | 170 (names) | Passed |
| 2 | Column lists for 28 shortlisted tables | `information_schema.columns` | 28 | Passed |
| 3 | Column lists for 6 wide tables | `information_schema.columns` | 6 | Passed |
| 4 | Coverage aggregates, since 2026-10-01 | `wgo_goalie_stats`, `wgo_skater_stats`, `games`, `goalie_start_projections`, `nhl_xg_goalie_game_aggregates`, `nhl_xg_team_game_aggregates`, `nst_gamelog_goalie_all_counts`, `nst_team_gamelogs_as_counts` | 8 | Passed |
| 5 | Coverage aggregates, first attempt | Same as 6 | 0 | **Failed before running**: `text >= integer` on `matchup_season`. Corrected with a cast in 6 |
| 6 | Coverage aggregates | `rolling_player_game_metrics`, `nst_gamelog_as_counts`, `nst_gamelog_as_counts_oi`, `nst_gamelog_pp_counts`, `powerPlayCombinations`, `yahoo_players`, `yahoo_player_ownership_history`, `goalie_weekly_aggregates`, `league_weekly_goalie_averages`, `yahoo_matchup_weeks`, `player_forecast_goalie_start_observations`, `goalie_ratings_daily`, `teamGameStats`, `wgo_team_stats` | 14 | Passed |
| 7 | Starter labels per team game, last xG game, confirmed flags | `games`, `wgo_goalie_stats`, `nhl_xg_goalie_game_aggregates`, `goalie_start_projections`, `nst_gamelog_goalie_all_counts` | 1 | Passed |
| 8 | Ownership zero/null, unit ranges, row uniqueness | `yahoo_players`, `yahoo_player_ownership_history`, `yahoo_nhl_player_map_read`, `nst_gamelog_goalie_all_counts`, `nst_team_gamelogs_{as,pp,pk}_counts`, `wgo_team_stats`, `wgo_skater_stats`, `wgo_goalie_stats`, `player_forecast_goalie_start_observations` | 1 | Passed |
| 9 | Cross-source appearance reconciliation | `rolling_player_game_metrics`, `wgo_skater_stats`, `nst_gamelog_as_counts`, `wgo_goalie_stats`, `nst_gamelog_goalie_all_counts` | 1 | Passed |
| 10 | Rolling column names; social and news table names | `information_schema.columns`, `information_schema.tables` | 2 | Passed |
| 11 | Season totals by source; view definitions | `games`, `wgo_*`, `nst_*`, `pg_get_viewdef` on `yahoo_nhl_player_map_read`, `league_weekly_goalie_averages`, `goalie_weekly_aggregates` | 5 | Passed. Its rolling-gap column was malformed, so 12 repeated that part |
| 12 | Rolling gap by week, pre-season rows, season starter check, no-PP games, future confirmations | `rolling_player_game_metrics`, `wgo_skater_stats`, `wgo_goalie_stats`, `wgo_team_stats`, `goalie_start_projections` | 6 | Passed |
| 13 | `home_road` and `position_code` values | `wgo_skater_stats`, `wgo_goalie_stats` | 9 | Passed |
| 14 | Anon read privilege and policies for 18 post sources | `pg_class`, `pg_policies` | 18 | Passed |

No provider (NST, Yahoo, NHL) was called and no Vercel request was made. Findings are in [SOURCES.md](SOURCES.md).
