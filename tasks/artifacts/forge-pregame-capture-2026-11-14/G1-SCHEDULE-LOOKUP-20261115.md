# G1 schedule lookup (TJ-approved, read-only)

- **Session:** one psql session to the IPv4 session pooler, `READ ONLY` transaction, `statement_timeout 5s`, started 2026-11-15 14:07:38Z.
- **Load hygiene:** 0 other active queries, longest 0 s, 0 lock waits.
- **Query:** `games` starting after now and at or before 2026-11-18 00:30Z, joined to `roster_optimizer_team_games` for abbreviations, `game_status`, `schedule_status` and `home_away`. Every row was FUT/OK, with team rows fetched 2026-11-15 08:52Z.

| game | slate (ET) | puck drop UTC | puck drop ET | away @ home |
| --- | --- | --- | --- | --- |
| **2026020326** | 2026-11-15 | 2026-11-16 00:30 | Sun 19:30 | EDM @ PHI |
| 2026020327 | 2026-11-15 | 2026-11-16 01:00 | Sun 20:00 | FLA @ DAL |
| 2026020328 | 2026-11-15 | 2026-11-16 01:00 | Sun 20:00 | CGY @ ANA |
| 2026020329 | 2026-11-15 | 2026-11-16 02:00 | Sun 21:00 | VAN @ VGK |
| 2026020330 | 2026-11-15 | 2026-11-16 02:00 | Sun 21:00 | NSH @ SJS |
| 2026020331 | 2026-11-16 | 2026-11-17 00:30 | Mon 19:30 | MTL @ NYR |
| 2026020332 | 2026-11-16 | 2026-11-17 02:30 | Mon 21:30 | VAN @ UTA |
| 2026020333 / 335 / 336 / 337 / 341 | 2026-11-17 | 2026-11-18 00:00 | Tue 19:00 | LAK@BOS, EDM@FLA, CBJ@NYI, BUF@PHI, OTT@WPG |
| 2026020334 (fallback) | 2026-11-17 | 2026-11-18 00:30 | Tue 19:30 | WSH @ TBL (matches the Oct 29 snapshot) |
| 2026020338 | 2026-11-17 | 2026-11-18 00:30 | Tue 19:30 | TOR @ CHI |

**Earliest eligible game:** 2026020326. Its T−60 is 18:30 ET (23:30Z), and the last possible claim is 18:26 ET (23:26Z). Any launch from approval + 30 min to 18:26 ET qualifies.
