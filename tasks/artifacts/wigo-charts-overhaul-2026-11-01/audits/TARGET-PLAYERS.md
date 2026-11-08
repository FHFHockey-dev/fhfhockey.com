# Target players (lane B, 2026-11-01)

Current season from the data: **20262027**. `wgo_skater_stats` holds rows for that season through 2026-10-31 (740 skaters). Picked by ledger query B-01.

Counts below are `wgo_skater_stats` rows with `season_id = 20262027`. They are all regular-season rows: the regular season opened 2026-09-29 and no preseason rows exist for this season (ledger B-02, B-03). TOI is seconds per game in that table.

| Role | player_id | Name | Team | Rows / pts | Avg TOI | Why |
|---|---|---|---|---|---|---|
| Star | 8478402 | Connor McDavid | EDM | 14 / 37 | 23:29 | Top points in the season |
| Depth | 8478147 | Bokondji Imama | FLA | 14 / 0 | 7:39 | Third-lowest TOI among skaters with 8+ games; zero points tests empty and zero states |
| Rookie, low GP | 8483428 | Filip Bystedt | SJS | 2 / 0 | 12:51 | `first_season_for_game_type = 20262027`, two games, so L5/L10/L20 windows are partial and LY/CA may be empty |
| Traded | 8482110 | Dawson Mercer | NJD, WPG (now WPG) | 14 / 6 | 15:23 | Two teams this season, most points among two-team skaters |
