# Social Share expansion: source qualification

Reads: [READ-RECEIPT.md](READ-RECEIPT.md), run 2026-10-31 against season 20262027 (first game 2026-09-29, data through 2026-10-30). Definitions: [CONTRACT.md](CONTRACT.md).

**Real-source state and fixture readiness are separate.** "Qualified" below means the tables hold what the claim needs. It does not mean a post is built or accepted. Every post can be built and tested on fixtures now, whatever its source state. No post has real-input evidence yet except the Team Games example's source shape.

## What the reads showed

| Source | Grain and keys | Season coverage | Findings that bind the posts |
| --- | --- | --- | --- |
| `games` | One game: `id`, `date`, `seasonId`, `type`, `startTime`, home/away team ids | 1,344 regular-season games; 216 dated before 2026-10-31 | **No status column.** It proves a game was scheduled, not that it finished |
| `wgo_team_stats` | One team in one game (`games_played` is always 1): `team_id`, `game_id`, `opponent_id` | 432 rows, 216 of 216 games | Has PP opportunities and times shorthanded with **known zeros** (4 team games of each). This is the completed-team-game proof |
| `wgo_skater_stats` | One skater in one game (`games_played` is always 1, unique player and game) | 7,775 rows, 216 of 216 games, 733+ skaters | Zero nulls in SOG, hits, blocks, TOI and PP TOI in October. TOI and PP TOI are **seconds**. 7 rows have a game team different from the current team, so traded skaters are real |
| `wgo_goalie_stats` | One goalie in one game | 457 rows, 455 with a game id, 216 of 216 games | **432 of 432 team games have exactly one labeled starter**; 23 relief rows since Oct 1. `time_on_ice` is **seconds**. **2 rows are dated June with no game id** and must be dropped |
| `rolling_player_game_metrics` (`all`) | One skater in one game, 623 columns | Through 2026-10-30, updated 2026-10-31 | **Missing 937 appearances, all in the first week (416 skaters, 39 games, all with TOI above 0).** Later weeks reconcile fully. Tuesday's own rules stand, but new posts must not treat its windows as complete season samples. No `hits_total_last5` or `blocks_total_last5` columns exist |
| `nst_gamelog_as_counts` and `_oi` | One skater per `date_scraped` (no game id, no team on counts) | 7,019 and 6,839 rows since Oct 1, through 10-30 | **468 of about 7,487 WGO appearances have no NST row**, so underlying metrics need a coverage count. `ixg`, `iscfs`, `hdcf` and on-ice `xgf`/`xga`/`scf` exist |
| `nst_gamelog_pp_counts` | Same, PP only | 4,490 rows since Oct 1 | A missing row is not proof of zero PP time; use WGO `pp_toi` for that |
| `nst_team_gamelogs_as_counts` | One team per date, `gp` always 1 | 432 of 432, updated 2026-10-31 | `sf`, `sa`, `gf`, `ga`, `xgf`, `xga`, `scf`, `sca`, `hdcf`, `hdca` all present |
| `nst_team_gamelogs_pp_counts`, `_pk_counts` | Same, by situation | 428 of 432 each | 4 rows absent, and WGO has 4 known-zero games of each. The counts match but were not joined row by row, so a lane must prove the match by that join before reading absence as zero |
| `nst_gamelog_goalie_all_counts`, `_5v5_counts` | One goalie per `date_scraped`, `gp` always 1 | 417 rows each, **through 2026-10-27**: 3 days behind WGO; 40 appearances not yet covered | `xg_against`, `gsaa` and HD/MD/LD shots present with no nulls. `toi` is **minutes**, unlike WGO. **`gsaa` is goals saved above average, not GSAx** |
| `nhl_xg_goalie_game_aggregates` | One goalie in one game, one model version | **0 rows this season; last game 2026-05-26** (2,922 rows since 2025-10) | An approved GSAx source that is out of date for this season |
| `nhl_xg_team_game_aggregates` | One team in one game | **0 rows this season** | Same |
| `goalie_ratings_daily` | Daily ratings | **0 rows since Oct 1** | Not usable |
| `goalie_weekly_aggregates`, `league_weekly_goalie_averages` | Views: goalie week and league week | 254 goalie weeks, 70 goalies, 5 weeks | League SV% and GAA are correctly pooled from sums. Both return **0 rather than null** when empty, and the goalie view drops zero-TOI rows, so the Category Counts producer computes from `wgo_goalie_stats` rather than these |
| `yahoo_matchup_weeks` | One fantasy week | 27 weeks from 2026-09-29 | The week calendar for Category Counts. `season` is text (`2026`) |
| `goalie_start_projections` | One goalie in one game | 1,023 rows since Oct 1; 215 future rows, 48 future games | **`confirmed_status` is never true in 1,023 rows**, so it cannot show confirmation. `start_probability` alone is not admitted by the Start Chart contract |
| `player_forecast_goalie_start_observations` | One status claim | 603 accepted since 10-10: 486 confirmed, 117 projected, 139 games, 67 goalies | **The real confirmation source, but the anon role cannot read it** (no SELECT grant, no policy). All from `tweet_projection`, with `observed_at`, `expires_at`, `source_url`. It covers part of the season, so absent means no observation, not "not starting" |
| `yahoo_players` | One Yahoo player, current | 1,608 rows, updated 2026-10-31 | **757 have null `percent_ownership` and none has 0.** Minimum known value is 1 |
| `yahoo_player_ownership_history` | One player per date | 17,537 rows, 622 players, 31 dates, none null | **Minimum value is 1 and no row holds 0** |
| `yahoo_nhl_player_map_read` | Identity view | 2,373 rows, 1,400 NHL ids | 603 rows show 0%, but the view `COALESCE`s to a **legacy** mapping when `yahoo_players` is null, so these zeros are not current observations |
| `powerPlayCombinations` | One player in one game | 6,098 rows, 216 games | Role unit evidence, already used by Tuesday |
| `game_prediction_market_odds_snapshots` | One provider's game line at one capture: `game_id`, `provider`, `captured_at`, moneylines, `total_line` | Read 2026-11-01: 174 rows, 40 games, 2026-10-25 to 2026-11-01, all DraftKings, at most 5 a game, none after start | **Same-day games only:** no row exists for a later game, so most of a 7-day window has none. Read server-side only |
| NHL.com partner odds (`api-web.nhle.com/v1/partner-game/US/now`, not a table) | One response: `currentOddsDate`, `lastUpdatedUTC`, `bettingPartner`, `games[].homeTeam.odds`, `awayTeam.odds` | Read 2026-11-01 ~03:00 UTC: DraftKings, 10 games, all the 2026-10-31 slate | **One odds date, not a window**, and it keeps live prices for games under way. `/US/2026-11-03`, `/US/2026-11-01` and `/US/2026-10-31` all returned 404, so no dated path was found |
| Reddit, X fan discussion, sentiment | | **No table and no reader exists** | `tweet_*` and `news_feed_*` hold lineup and goalie news pipelines, not fan comparison discussion. Package manifest and app code contain no Gemini client and no Reddit reader (`rg`, 2026-10-31) |

The anon role, which the post route's reads use, can read all the other tables in this table (read 14). Three facts need to be stated plainly because they change how some posts read:

1. **0% ownership does not currently exist at the source.** Every "known" value is at least 1, and null covers 757 players who may be below Yahoo's reporting floor or may simply be unobserved. The contract still treats a stated 0 as known. Until a source states one, these players show as unknown (`—`), and low-ownership posts may include them only through an explicit, visible setting. Tracked as task 13.8.
2. **GSAx and chances do exist, but in narrower forms than the PRD assumes.** Current GSAx is only derivable from NST (`xg_against − goals_against`), lags WGO, and must be labeled NST-model. FHFH's own model has no rows this season. Team chances exist (`scf`, `sca`, `hdcf`, `hdca`). **No goalie-level "chances faced" column exists:** goalies have HD, MD and LD shots against, which are shots by danger zone and must not be relabeled chances.
3. **Start/Sit's confirmation source is closed to the post route.** `player_forecast_goalie_start_observations` has no anon access, so a live read needs a decision: a server-only privileged read limited to this table's status columns, or a new read-only view through a migration. Both are outside this lane's authority. Lane G builds and tests on fixtures with an injected client until it is decided, and live confirmation shows `none` with that reason.

## Post qualification

| Post | Tables and columns | Real-source state | Limits to carry on the card |
| --- | --- | --- | --- |
| Team Games (example) | `wgo_team_stats.team_id,game_id,date`; `games.id` | **Qualified** | None |
| What Changed (SS 2.0) | Production and opportunity: `wgo_skater_stats`. Underlying: `nst_gamelog_as_counts` (`ixg`, `iscfs`, `icf`), `_oi` (`xgf`, `xga`, `scf`) | **Partial** | Production and TOI are qualified. Underlying carries an NST coverage count (468 gaps) and joins on date, so a date with two games is unresolved |
| BSH leaders, risers, fallers (SS 3.0) | `wgo_skater_stats.blocked_shots,shots,hits,game_id,date,team_abbrev` | **Qualified** | Season to date is complete; rolling is not used |
| Category Blueprint (SS 3.0) | `wgo_skater_stats.goals,assists,points,shots,hits,blocked_shots,pp_points,penalty_minutes` | **Qualified** | Separate categories only, no aggregate |
| Role Watch (SS 4.0) | `wgo_skater_stats.toi_per_game,pp_toi`; `rolling_player_game_metrics.line_combo_slot,line_combo_group`; `powerPlayCombinations.unit` | **Qualified** for TOI and PPTOI; **partial** for line and unit history | Line and unit history lacks week 1 in rolling |
| Player vs Player, manual sourced input (SS 5.0) | Comparison windows: `wgo_skater_stats`, NST as above. Claims: a local reviewed JSON with URL, date, claim, kind | **Partial**: stats qualified; discussion is manual only | "No consensus established" unless shown |
| Sentiment discovery (SS 5.0) | None | **Blocked**: no source, no client, no credentials, and setting them up is out of scope | Assessment only |
| Off-Night Edge (SS 6.0) | Schedule: existing Game Grid edition. Candidates: `wgo_skater_stats`, `yahoo_players`, `yahoo_player_ownership_history`, `yahoo_nhl_player_map_read` | **Qualified** for schedule and identity; **partial** for ownership | 0% is not observed at source; unknown is shown separately |
| Nightly Floor, Cardio Masters (SS 7.0) | `wgo_skater_stats.shots,hits,blocked_shots,points,game_id` | **Qualified** | Ownership filter as above |
| Crease Shift (SS 8.0) | `wgo_team_stats` (denominator), `wgo_goalie_stats.games_started,game_id,team_abbreviation` | **Qualified**: 432 of 432 games have one labeled starter | Descriptive only |
| Goalie of the Week/Month, best/worst, Category Counts (SS 9.0) | `wgo_goalie_stats.wins,saves,shots_against,goals_against,time_on_ice,shutouts,games_started`; `yahoo_matchup_weeks` | **Qualified** | Existing TGV grades read through its own producer, under their own label |
| GSAx (SS 9.0) | NST: `nst_gamelog_goalie_{all,5v5}_counts.xg_against,goals_against`. FHFH model: `nhl_xg_goalie_game_aggregates` | **Partial**: NST-derived only, through 10-27. FHFH model **blocked for this season** (0 rows) | NST-model label; never `gsaa`; never interchangeable |
| Busy/Quiet (SS 10.0) | `wgo_goalie_stats` (SA, starts, relief, TOI); `nst_gamelog_goalie_all_counts.hd_shots_against`; team `sca`, `hdca` | **Qualified** for shots; **partial** for danger-zone; **no goalie-level chances source** | Team chances stay team-level, with relief disclosed |
| Goalie Category Rescue (SS 10.0) | `wgo_goalie_stats`, `yahoo_players`, map, schedule edition | **Qualified**; ownership **partial** | Candidate availability is rostered % only, never a league |
| Risky Starts (SS 11.0) | Team: `nst_team_gamelogs_{as,pp,pk}_counts`, `wgo_team_stats`. Schedule edition | **Qualified** for all three lenses | Start odds stay unavailable unless admitted |
| Risky Starts market lines | `game_prediction_market_odds_snapshots` first, then NHL.com partner odds, one source and one book per game | **Partial**: today's games only, in practice | The book's prices, labeled as market lines; nothing derived; "No line yet" otherwise |
| Start/Sit, confirmation (SS 11.0) | `player_forecast_goalie_start_observations` | **Blocked for live reads** until access is decided. Data is partial: 139 games, tweet source, from 10-10 | Absence means no observation |
| Start/Sit, conditional forecast (SS 11.0) | Start Chart `startParticipation` | **Blocked by default**: raw `goalie_start_projections.start_probability` is not admitted | "Forecast unavailable" until an admitted row exists |
| Ratio Impact (SS 12.0) | Manual inputs; optional base totals from `wgo_goalie_stats` | **Qualified**: no source needed for hypothetical inputs | Hypothetical basis |

Nothing in this table is a blocker for building. Blocked rows gate only the named claim: discovery, the FHFH GSAx model for this season, the conditional forecast, and live goalie confirmation.

## Yahoo null ownership (SS 13.8, answered 2026-11-01)

Codex, from the writer source (`CODEX-NST-GOALIE-WRITER-20261101-POST-BACKFILL` §4): a null `percent_ownership` means unknown, not below 1%. The writer keeps a valid numeric 0 and returns null for omitted, empty or non-numeric input. Posts keep the existing rule: unknown is excluded unless a visible setting includes it.
