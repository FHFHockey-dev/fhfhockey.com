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

## Lead render reads, 2026-10-31 (authority: TJ pop-up: local dev renders; Start/Sit server-only read)

One sequential local run of each post's real loader through `loadPostSnapshot`, from `.env.local`, with `fetch` counted per table. GET only, no writes, no NST or Yahoo provider calls, no Vercel. The route's sign-in was not used: snapshots were then rendered in the isolated browser from saved JSON with a fictional session. One NHL schedule GET per Off-Night edition. Rows are returned rows; the anon client read everything except the goalie observation and conflict tables, which went through the server credential.

| Edition | Requests | Rows | Tables | State |
| --- | --- | --- | --- | --- |
| team-games | 2 | 147 | wgo_team_stats, games | ready |
| what-changed | 10 | 8423 | wgo_skater_stats, wgo_team_stats, games | ready |
| role-watch | 12 | 9021 | wgo_skater_stats, wgo_team_stats, games, rolling_player_game_metrics, powerPlayCombinations | ready |
| bsh-board | 10 | 8423 | wgo_team_stats, games, wgo_skater_stats | ready |
| bsh-risers | 10 | 8423 | wgo_team_stats, games, wgo_skater_stats | ready |
| category-blueprint | 10 | 8423 | wgo_team_stats, games, wgo_skater_stats | ready |
| nightly-floor | 15 | 12404 | wgo_team_stats, games, yahoo_players, wgo_skater_stats, yahoo_nhl_player_map_read | ready |
| cardio-masters | 15 | 12404 | games, yahoo_players, wgo_team_stats, wgo_skater_stats, yahoo_nhl_player_map_read | ready |
| off-night-rest | 13 | 9419 | /v1/schedule/2026-10-26, yahoo_players, games, wgo_skater_stats, yahoo_nhl_player_map_read | ready |
| off-night-weekly | 13 | 9419 | /v1/schedule/2026-10-26, yahoo_players, games, yahoo_nhl_player_map_read, wgo_skater_stats | ready |
| crease-shift | 3 | 1103 | games, wgo_team_stats, wgo_goalie_stats | ready |
| goalie-week4 | 6 | 329 | yahoo_matchup_weeks, games, wgo_team_stats, wgo_goalie_stats, goalie_weekly_aggregates, league_weekly_goalie_averages | ready |
| goalie-month-oct | 6 | 1389 | yahoo_matchup_weeks, wgo_goalie_stats, wgo_team_stats, games, goalie_weekly_aggregates, league_weekly_goalie_averages | ready |
| goalie-gsax | 5 | 1466 | wgo_goalie_stats, nst_gamelog_goalie_all_counts, nhl_xg_goalie_game_aggregates, wgo_team_stats, games | ready |
| busy-quiet | 5 | 1939 | wgo_team_stats, wgo_goalie_stats, games, nst_team_gamelogs_as_counts, nst_gamelog_goalie_all_counts | ready |
| goalie-rescue | 8 | 1449 | wgo_team_stats, games, yahoo_players, wgo_goalie_stats, yahoo_nhl_player_map_read | ready |
| ratio-impact | 0 | 0 |  | ready |
| risky-starts | 6 | 1561 | games, wgo_team_stats, nst_team_gamelogs_as_counts, wgo_goalie_stats, player_forecast_goalie_start_observations, player_forecast_observation_conflicts | ready |
| start-sit | 6 | 1561 | games, wgo_team_stats, nst_team_gamelogs_as_counts, wgo_goalie_stats, player_forecast_goalie_start_observations, player_forecast_observation_conflicts | ready |
| player-vs-player | 0 | 0 |  | blocked |

## Final real render, 2026-11-01

Local test process through each post's real loader, sequentially, SELECT only, public client. These loads read whole windows to compute the cards, so they exceed the 50-row sample limit that applied to coverage queries; nothing was printed or committed except computed snapshots' PNGs. TJ asked for real-data card reviews throughout. Risky Starts also made one GET of the NHL partner odds endpoint. Earlier review renders ran the same loaders; `wgo_skater_stats` timed out on three of them, each clean on retry. No writes.

| Post | Requests | Rows | State |
| --- | --- | --- | --- |
| team-games | 2 | 141 | ready |
| what-changed | 12 | 8948 | ready |
| role-watch | 13 | 9363 | ready |
| bsh-board | 11 | 8813 | ready |
| bsh-risers | 11 | 8813 | ready |
| mcm | 11 | 8813 | ready |
| mcm-points-first | 11 | 8813 | ready |
| nightly-floor | 16 | 12794 | ready |
| cardio-masters | 16 | 12794 | ready |
| stars-total | 11 | 8813 | ready |
| stars-total-pf | 11 | 8813 | ready |
| stars-pergame | 11 | 8813 | ready |
| stars-pergame-pf | 11 | 8813 | ready |
| off-night-rest | 13 | 9271 | ready |
| off-night-weekly | 13 | 9271 | ready |
| crease-shift | 3 | 1153 | ready |
| goalie-week4 | 6 | 499 | ready |
| goalie-month-oct | 6 | 1439 | ready |
| goalie-gsax | 6 | 1513 | ready |
| busy-quiet | 5 | 2013 | ready |
| goalie-rescue | 8 | 1489 | ready |
| ratio-impact | 1 | 9 | ready |
| risky-starts | 8 | 1582 | ready |
| start-sit | 6 | 1567 | ready |
| player-vs-player | 0 | 0 | blocked |
| pvp-dahlin-hughes | 4 | 107 | ready |
