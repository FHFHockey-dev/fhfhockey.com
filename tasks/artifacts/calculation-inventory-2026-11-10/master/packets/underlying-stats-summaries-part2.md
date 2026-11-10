# Audit packet: Underlying stats summaries (part 2 of 2)

Master entries M-UST-061 to M-UST-098 (38 of 98 in this family). Built from the merged Opus and Codex inventories; see [../MASTER.md](../MASTER.md) and [../MERGE-NOTES.md](../MERGE-NOTES.md).

How to read: each entry gives both inventories' descriptions side by side. **Conflicts** are places where the two descriptions disagree; they are unresolved. **Leads** are Opus red flags and Codex unknowns: observations to check, not audited findings. Tags are keyword heuristics. Line numbers were valid when each inventory was written on 2026-11-10 (Opus at d31dcb33f, Codex at 11e4192d3); re-check against the current checkout.

| ID | Name | Match | Conflicts | Leads |
|---|---|---|---:|---:|
| M-UST-061 | Per-60 rate conversion (players and goalies) | Opus only | 0 | 1 |
| M-UST-062 | PBP-only strength classifier (situation-code based) | Opus only | 0 | 1 |
| M-UST-063 | Appearance eligibility and games-played definition | Opus only | 0 | 2 |
| M-UST-064 | PBP-only individual counts fallback (games without shift data) | Opus only | 0 | 4 |
| M-UST-065 | Trade-mode grouping and team label | Opus only | 0 | 0 |
| M-UST-066 | Scope windows: last N games, last N team games, date range | Opus only | 0 | 2 |
| M-UST-067 | Minimum-TOI filter and TOI per game | Opus only | 0 | 1 |
| M-UST-068 | Per-season detail aggregation | Opus only | 0 | 0 |
| M-UST-069 | Per-game chart series | Opus only | 0 | 1 |
| M-UST-070 | Individual derived metrics: points, IPP, shooting %, faceoff % | Opus only | 0 | 1 |
| M-UST-071 | On-ice share percentages (CF%, FF%, SF%, GF%, xGF%, SCF%, HDCF%, HDGF… | Opus only | 0 | 1 |
| M-UST-072 | Finished-game and season/game-type eligibility filter | Opus only | 0 | 1 |
| M-UST-073 | PBP game-clock reconstruction (period duration, game seconds elapsed,… | Opus only | 0 | 2 |
| M-UST-074 | Position canonicalization and position-group filter | Opus only | 0 | 1 |
| M-UST-075 | Season window fallback and date-range validation | Opus only | 0 | 1 |
| M-UST-076 | Incremental refresh watermark selection | Opus only | 0 | 2 |
| M-UST-077 | Summary coverage and missing-game detection | Opus only | 0 | 2 |
| M-UST-078 | Shots and goals by rink coordinate | Opus only | 0 | 5 |
| M-UST-079 | Heuristic shot danger buckets (distance/angle) | Opus only | 0 | 2 |
| M-UST-080 | Heuristic approximate xG per shot | Opus only | 0 | 4 |
| M-UST-081 | Skater standard and advanced variance metrics (per-60, SH%, ATOI) | Opus only | 0 | 4 |
| M-UST-082 | Skater bucket average rows | Opus only | 0 | 1 |
| M-UST-083 | SoS game-log past/future opponent partition | Opus only | 0 | 3 |
| M-UST-084 | Strength-of-schedule opponent record totals (legacy script) | Opus only | 0 | 4 |
| M-UST-085 | Landing/detail table sort, pagination and rank | Opus only | 0 | 2 |
| M-UST-086 | Team landing goalie start share and span windows | Opus only | 0 | 3 |
| M-UST-087 | Trust-type classifier (buyLow / heatCheck / processBacked) | Opus only | 0 | 1 |
| M-UST-088 | Narrative context bullet thresholds | Opus only | 0 | 1 |
| M-UST-089 | WGO team game aggregation (PP%, PK%, shots/game, FO%) | Opus only | 0 | 1 |
| M-UST-090 | Team scope windows and minimum TOI | Opus only | 0 | 2 |
| M-UST-091 | Team shot, goal, xG and danger counts per game-split | Opus only | 0 | 3 |
| M-UST-092 | Game outcome and standings points (W, L, OTL, ROW, points) | Opus only | 0 | 3 |
| M-UST-093 | Legacy NHL statsapi TOI parsing, TOI% and PP-time share | Opus only | 0 | 5 |
| M-UST-094 | xG explorer row builders (latest rolling window + supplemental sums) | Opus only | 0 | 3 |
| M-UST-095 | xG explorer coverage ratios | Opus only | 0 | 1 |
| M-UST-096 | Weighted heatmap performance grade | Codex only | 0 | 1 |
| M-UST-097 | Radar pooled ratio percentages | Codex only | 0 | 1 |
| M-UST-098 | Goalie aggregate SV%, GAA, xGA differential, danger splits and averag… | Codex only | 0 | 1 |

## M-UST-061 Per-60 rate conversion (players and goalies)

- **Match:** Opus only; Opus UST-043; Codex —
- **Purpose:** Convert counts to per-60-minute rates.
- **Where:** `web/lib/underlying-stats/playerStatsLandingServer.ts:2059 (toPer60)`; `web/lib/underlying-stats/playerStatsLandingServer.ts:2070 (toGaa)`; `web/lib/underlying-stats/playerStatsLandingServer.ts:4958 (individual per-60 block)`; `web/lib/underlying-stats/playerStatsLandingServer.ts:5050 (on-ice per-60 block)`; `web/lib/underlying-stats/playerStatsLandingServer.ts:5133 (goalie per-60 block)`
- **Tags (heuristic):** denominators: per 60, shots on goal; generation: current
- **Opus view (UST-043):**
  - Method: per60 = count * 3600 / toiSeconds (TOI in seconds); null if TOI null/<=0. Applied to ~26 individual metrics (G, A, A1, A2, P, SOG, ixG, iCF, iFF, iSCF, iHDCF, rush, rebounds, PIM, penalties by class, drawn, GV, TK, hits, hits taken, blocks, FOW, FOL), 20 on-ice metrics (CF..MDGA) and goalie SA, saves, GSAA, xGA, HD/MD/LD shots/saves/GSAA, rush/rebound attempts against. GAA = GA*3600/TOI.
  - Inputs/units: counts; TOI in seconds; sources: —
  - Output scale: per-60 rates (events per 60 minutes); GAA goals per 60; writes: —
  - Status: live — read by pages/api/v1/underlying-stats/players.ts and goalies.ts (+[playerId], chart) for /underlying-stats/playerStats and /goalieStats; summaries written by pages/api/v1/db/update-player-underlying-stats.ts, which runs from the lineCombinations insert trigger (supabase/migrations/20260716112910_harden_line_combination_trigger_auth.sql:130) and the pg_cron job 'update-player-underlying-stats-yesterday' at 09:35 UTC (tasks/TASKS/cron-operations/cron-schedule.md:382,827)
  - Consumers: pages/api/v1/underlying-stats/players.ts; pages/api/v1/underlying-stats/players/[playerId].ts; pages/api/v1/underlying-stats/players/[playerId]/chart.ts; pages/api/v1/underlying-stats/goalies.ts; pages/api/v1/underlying-stats/goalies/[playerId].ts; pages/api/v1/db/update-player-underlying-stats.ts
- **Audit context:**
  - Intent (Opus): tasks/TASKS/three-pillars-analytics/underlying-stats/prd/prd-player-underlying-stats-landing-page.md:203 (ixG/60 etc.) and tasks/TASKS/three-pillars-analytics/underlying-stats/prd/prd-goalie-underlying-stats-landing-page.md:236-252 (GSAA/60 and danger GSAA/60)
  - External references: NST per-60 convention (count / TOI minutes * 60)
  - Fixtures/test data: `tasks/TASKS/three-pillars-analytics/underlying-stats/PlayerStatsLanding_Audit.md`; `tasks/TASKS/three-pillars-analytics/underlying-stats/PlayerStatsDetail_Audit.md`
  - Tests: `web/lib/underlying-stats/playerStatsLandingServer.test.ts:2009`
- **Leads (not audited):**
  - (opus) penalty-minutes per 60 and faceoffs per 60 use player TOI; danger-split GAA (hdGaa/mdGaa/ldGaa) divides danger goals by total goalie TOI

## M-UST-062 PBP-only strength classifier (situation-code based)

- **Match:** Opus only; Opus UST-044; Codex —
- **Purpose:** Strength matching for the no-shift fallback path.
- **Where:** `web/lib/underlying-stats/playerStatsLandingServer.ts:2361 (matchesPbpOnlyStrengthForTeam)`
- **Tags (heuristic):** denominators: 5v5 only; generation: current
- **Opus view (UST-044):**
  - Method: Uses classifyTeamStrengthState(parseSituationCode) => EV/PP/SH; 5v5 = EV and strength_exact '5v5'; 5v4 = PP and '5v4'; 4v5 = SH and '4v5'; 3v3 = EV and '3v3'; empty-net from goalie digits of situation code.
  - Inputs/units: situation_code 4-digit string; strength_exact 'HvA'; sources: nhl_api_pbp_events
  - Output scale: boolean; writes: —
  - Status: live — read by pages/api/v1/underlying-stats/players.ts and goalies.ts (+[playerId], chart) for /underlying-stats/playerStats and /goalieStats; summaries written by pages/api/v1/db/update-player-underlying-stats.ts, which runs from the lineCombinations insert trigger (supabase/migrations/20260716112910_harden_line_combination_trigger_auth.sql:130) and the pg_cron job 'update-player-underlying-stats-yesterday' at 09:35 UTC (tasks/TASKS/cron-operations/cron-schedule.md:382,827) (fallback path only, when a game has roster spots but no shift rows)
  - Consumers: buildPbpOnlyIndividualContextsForGame
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: NHL situationCode (away goalie, away skaters, home skaters, home goalie)
  - Fixtures/test data: `web/lib/underlying-stats/playerStatsLandingServer.test.ts:3141 fixture`
  - Tests: `web/lib/underlying-stats/playerStatsLandingServer.test.ts:3141 (PBP-only fallback)`
- **Leads (not audited):**
  - (opus) a second, different strength definition from matchesPlayerStatsStrengthForTeam (classifier-based vs raw skater counts), so fallback games can split strength differently from shift-backed games

## M-UST-063 Appearance eligibility and games-played definition

- **Match:** Opus only; Opus UST-045; Codex —
- **Purpose:** Turn per-game parity rows into player appearance contexts (defines GP and team/venue).
- **Where:** `web/lib/underlying-stats/playerStatsLandingServer.ts:2449 (buildIndividualContextsForGame)`; `web/lib/underlying-stats/playerStatsLandingServer.ts:2859 (buildOnIceContextsForGame)`; `web/lib/underlying-stats/playerStatsLandingServer.ts:2929 (buildGoalieContextsForGame)`; `web/lib/underlying-stats/playerStatsLandingServer.ts:2997 (buildPlayerStatsLandingContexts)`
- **Tags (heuristic):** denominators: per game; generation: current
- **Opus view (UST-045):**
  - Method: A player-game counts only if split TOI > 0 and the player has a shift row (team taken from the first shift row). GP in any strength split = number of games with TOI>0 in that split. Venue/team/position filters applied per game. Dedup: one context per gameId per grouping key.
  - Inputs/units: TOI seconds per split; sources: games, nhl_api_pbp_events, nhl_api_shift_rows, nhl_api_game_roster_spots, nhl_api_game_payloads_raw (endpoint=landing), players, teams
  - Output scale: GP integer; contexts; writes: nhl_api_game_payloads_raw (derived://underlying-player-summary-v2/... partitions), goalie_underlying_summary_partitions (copied by goalieStatsSummaryRefresh.ts)
  - Status: live — read by pages/api/v1/underlying-stats/players.ts and goalies.ts (+[playerId], chart) for /underlying-stats/playerStats and /goalieStats; summaries written by pages/api/v1/db/update-player-underlying-stats.ts, which runs from the lineCombinations insert trigger (supabase/migrations/20260716112910_harden_line_combination_trigger_auth.sql:130) and the pg_cron job 'update-player-underlying-stats-yesterday' at 09:35 UTC (tasks/TASKS/cron-operations/cron-schedule.md:382,827)
  - Consumers: pages/api/v1/underlying-stats/players.ts; pages/api/v1/underlying-stats/players/[playerId].ts; pages/api/v1/underlying-stats/players/[playerId]/chart.ts; pages/api/v1/underlying-stats/goalies.ts; pages/api/v1/underlying-stats/goalies/[playerId].ts; pages/api/v1/db/update-player-underlying-stats.ts
- **Audit context:**
  - Intent (Opus): tasks/TASKS/three-pillars-analytics/underlying-stats/prd/prd-player-underlying-stats-landing-page.md:138-139 (Game Range uses the player's own games; By Team Games uses team games even if the player missed some)
  - External references: NST GP convention (games played in the situation)
  - Fixtures/test data: `web/lib/underlying-stats/playerStatsLandingServer.test.ts:2549-2940 fixtures`
  - Tests: `web/lib/underlying-stats/playerStatsLandingServer.test.ts:2068 (by-team-games appearances)`; `web/lib/underlying-stats/playerStatsLandingServer.test.ts:2583`
- **Leads (not audited):**
  - (opus) in PP/PK splits GP counts only games with PP/PK time, so TOI/GP and any per-game view differ from all-situations GP
  - (opus) team assignment uses the first shift row seen per player; mid-game data errors could misassign

## M-UST-064 PBP-only individual counts fallback (games without shift data)

- **Match:** Opus only; Opus UST-046; Codex —
- **Purpose:** Produce individual counting stats when shift rows are missing but roster spots exist.
- **Where:** `web/lib/underlying-stats/playerStatsLandingServer.ts:2515 (buildPbpOnlyIndividualContextsForGame)`; `web/lib/underlying-stats/playerStatsLandingServer.ts:3045 (fallback selection in buildPlayerStatsLandingContexts)`
- **Tags (heuristic):** denominators: unblocked attempts, shots on goal; generation: current
- **Opus view (UST-046):**
  - Method: Counts G, A1, A2, points=G+A, PIM=sum duration, penalty class by duration (2=minor, 5=major, >=10=misconduct), penalties drawn, FOW/FOL, hits, hits taken, giveaways, takeaways, blocks; shots on goal, iCF (all non-own-goal attempts), iFF (unblocked), ixG via heuristic approximate xG, iSCF (danger != low), iHDCF (danger==high), rush attempts, rebounds created. TOI=0, hasReliableToi=false, ipp=null, gp=1. Only used for individual COUNTS when shiftRows.length==0 and rosterSpots>0.
  - Inputs/units: event ids; penalty_duration_minutes (minutes); shot features; sources: nhl_api_pbp_events, nhl_api_game_roster_spots
  - Output scale: integer counts per player-game; ixG in goals; TOI=0 (unknown); writes: nhl_api_game_payloads_raw (derived://underlying-player-summary-v2/... partitions), goalie_underlying_summary_partitions (copied by goalieStatsSummaryRefresh.ts)
  - Status: live — read by pages/api/v1/underlying-stats/players.ts and goalies.ts (+[playerId], chart) for /underlying-stats/playerStats and /goalieStats; summaries written by pages/api/v1/db/update-player-underlying-stats.ts, which runs from the lineCombinations insert trigger (supabase/migrations/20260716112910_harden_line_combination_trigger_auth.sql:130) and the pg_cron job 'update-player-underlying-stats-yesterday' at 09:35 UTC (tasks/TASKS/cron-operations/cron-schedule.md:382,827) (fallback path only)
  - Consumers: pages/api/v1/underlying-stats/players.ts; pages/api/v1/underlying-stats/players/[playerId].ts; pages/api/v1/underlying-stats/players/[playerId]/chart.ts; pages/api/v1/underlying-stats/goalies.ts; pages/api/v1/underlying-stats/goalies/[playerId].ts; pages/api/v1/db/update-player-underlying-stats.ts
- **Audit context:**
  - Intent (Opus): Test name at web/lib/underlying-stats/playerStatsLandingServer.test.ts:3141 is the only stated contract; otherwise UNDOCUMENTED
  - External references: NST individual counts definitions
  - Fixtures/test data: `web/lib/underlying-stats/playerStatsLandingServer.test.ts:3141 fixture`
  - Tests: `web/lib/underlying-stats/playerStatsLandingServer.test.ts:3141 ('falls back to PBP-only individual counts when shiftcharts are empty')`
- **Leads (not audited):**
  - (opus) score-state filter is applied to event-based counts but NOT to shot-derived counts (shots, iCF, iFF, ixG, iSCF, iHDCF) in the shot loop
  - (opus) double-minors (4 min) and 10-min misconducts vs game misconducts are not distinguished; 4-min penalties count in totalPenalties but no class
  - (opus) ixG here is the heuristic bucket xG, not the parity/NST xG used for shift-backed games — mixed xG models within one season aggregate
  - (opus) blocked-shot credit is gated on the opponent of the event owner; verify NHL API owner convention for blocked-shot events

## M-UST-065 Trade-mode grouping and team label

- **Match:** Opus only; Opus UST-047; Codex —
- **Purpose:** Combine or split a traded player's rows by team.
- **Where:** `web/lib/underlying-stats/playerStatsLandingServer.ts:3089 (getGroupingKey)`; `web/lib/underlying-stats/playerStatsLandingServer.ts:4359 (getSummaryGroupingKey)`; `web/lib/underlying-stats/playerStatsQueries.ts:150 (buildLandingTradeDisplay)`; `web/lib/underlying-stats/playerStatsQueries.ts:478 (getDistinctTeamContexts)`
- **Tags (heuristic):** generation: current
- **Opus view (UST-047):**
  - Method: combine: key=playerId, label 'A / B' when >1 team, teamId=null. split: key=playerId:teamId.
  - Inputs/units: ids; sources: —
  - Output scale: row keys / labels; writes: —
  - Status: live — read by pages/api/v1/underlying-stats/players.ts and goalies.ts (+[playerId], chart) for /underlying-stats/playerStats and /goalieStats; summaries written by pages/api/v1/db/update-player-underlying-stats.ts, which runs from the lineCombinations insert trigger (supabase/migrations/20260716112910_harden_line_combination_trigger_auth.sql:130) and the pg_cron job 'update-player-underlying-stats-yesterday' at 09:35 UTC (tasks/TASKS/cron-operations/cron-schedule.md:382,827)
  - Consumers: pages/api/v1/underlying-stats/players.ts; pages/api/v1/underlying-stats/players/[playerId].ts; pages/api/v1/underlying-stats/players/[playerId]/chart.ts; pages/api/v1/underlying-stats/goalies.ts; pages/api/v1/underlying-stats/goalies/[playerId].ts; pages/api/v1/db/update-player-underlying-stats.ts
- **Audit context:**
  - Intent (Opus): tasks/TASKS/three-pillars-analytics/underlying-stats/prd/prd-player-underlying-stats-landing-page.md:142-143 (Combine aggregates across teams; Split shows player-team stints)
  - External references: none suggested
  - Fixtures/test data: `web/lib/underlying-stats/playerStatsLandingServer.test.ts:1812 fixture`
  - Tests: `web/lib/underlying-stats/playerStatsLandingServer.test.ts:1812`; `web/lib/underlying-stats/playerStatsQueries.test.ts (buildLandingTradeDisplay)`

## M-UST-066 Scope windows: last N games, last N team games, date range

- **Match:** Opus only; Opus UST-048; Codex —
- **Purpose:** Restrict aggregation to a recent-games window.
- **Where:** `web/lib/underlying-stats/playerStatsLandingServer.ts:3098 (takeMostRecentContexts)`; `web/lib/underlying-stats/playerStatsLandingServer.ts:3116 (getSelectedGamesForTeamContext)`; `web/lib/underlying-stats/playerStatsLandingServer.ts:3280 (applyLandingScopeSelection)`; `web/lib/underlying-stats/playerStatsLandingServer.ts:4368 (takeMostRecentSummaryRows)`; `web/lib/underlying-stats/playerStatsLandingServer.ts:4386 (applyLandingScopeSelectionToSummaryRows)`; `web/lib/underlying-stats/playerStatsLandingServer.ts:3181 (resolveScopeWindowFromTeamSelection)`; `web/lib/underlying-stats/playerStatsLandingServer.ts:3209 (resolveLandingScopeWindowFromContexts)`; `web/lib/underlying-stats/playerStatsLandingServer.ts:3244 (resolveLandingScopeWindowFromSummaryRows)`
- **Tags (heuristic):** generation: current
- **Opus view (UST-048):**
  - Method: gameRange: per player (or player-team in split mode) keep the N most recent appearances by date desc, id desc. byTeamGames: take each of the player's teams' N most recent games (venue-filtered) and keep the player's appearances in those games. dateRange: SQL/date filter. Window start/end = min/max date of the selected games/appearances.
  - Inputs/units: N games (integer); ISO dates; sources: games
  - Output scale: filtered rows; window start/end dates; writes: —
  - Status: live — read by pages/api/v1/underlying-stats/players.ts and goalies.ts (+[playerId], chart) for /underlying-stats/playerStats and /goalieStats; summaries written by pages/api/v1/db/update-player-underlying-stats.ts, which runs from the lineCombinations insert trigger (supabase/migrations/20260716112910_harden_line_combination_trigger_auth.sql:130) and the pg_cron job 'update-player-underlying-stats-yesterday' at 09:35 UTC (tasks/TASKS/cron-operations/cron-schedule.md:382,827)
  - Consumers: pages/api/v1/underlying-stats/players.ts; pages/api/v1/underlying-stats/players/[playerId].ts; pages/api/v1/underlying-stats/players/[playerId]/chart.ts; pages/api/v1/underlying-stats/goalies.ts; pages/api/v1/underlying-stats/goalies/[playerId].ts; pages/api/v1/db/update-player-underlying-stats.ts
- **Audit context:**
  - Intent (Opus): tasks/TASKS/three-pillars-analytics/underlying-stats/prd/prd-player-underlying-stats-landing-page.md:58,138-139
  - External references: NST 'last N games' / team-games filters
  - Fixtures/test data: `web/lib/underlying-stats/playerStatsLandingServer.test.ts:1715-2154 fixtures`; `tasks/TASKS/three-pillars-analytics/underlying-stats/PlayerStatsLanding_Audit.md`; `tasks/TASKS/three-pillars-analytics/underlying-stats/PlayerStatsDetail_Audit.md`
  - Tests: `web/lib/underlying-stats/playerStatsLandingServer.test.ts:1715 (game-range windows)`; `web/lib/underlying-stats/playerStatsLandingServer.test.ts:2068`; `web/lib/underlying-stats/playerStatsLandingServer.test.ts:2941 (by-team-games)`
- **Leads (not audited):**
  - (opus) byTeamGames in combine mode unions the last N games of every team the player played for, so a traded player can get up to N per team (more than N games)
  - (opus) last-N windows are count-based on appearances; games with zero split TOI are skipped, so 'last 10 PP games' can reach far back

## M-UST-067 Minimum-TOI filter and TOI per game

- **Match:** Opus only; Opus UST-050; Codex —
- **Purpose:** Qualify rows by TOI and compute average TOI per GP.
- **Where:** `web/lib/underlying-stats/playerStatsLandingServer.ts:4183 (createLandingRowFromAggregation)`; `web/lib/underlying-stats/playerStatsLandingServer.ts:4247 (createLandingRowFromSummaryRows)`; `web/lib/underlying-stats/playerStatsLandingServer.ts:4493 (filterLandingAggregationRowsForState)`
- **Tags (heuristic):** denominators: per game; generation: current
- **Opus view (UST-050):**
  - Method: toiPerGameSeconds = toiSeconds / gamesPlayed (null if TOI unknown); row dropped if TOI unknown or < minimumToiSeconds (seconds).
  - Inputs/units: TOI seconds; minimumToiSeconds in seconds; sources: —
  - Output scale: seconds per game; boolean qualify; writes: —
  - Status: live — read by pages/api/v1/underlying-stats/players.ts and goalies.ts (+[playerId], chart) for /underlying-stats/playerStats and /goalieStats; summaries written by pages/api/v1/db/update-player-underlying-stats.ts, which runs from the lineCombinations insert trigger (supabase/migrations/20260716112910_harden_line_combination_trigger_auth.sql:130) and the pg_cron job 'update-player-underlying-stats-yesterday' at 09:35 UTC (tasks/TASKS/cron-operations/cron-schedule.md:382,827)
  - Consumers: pages/api/v1/underlying-stats/players.ts; pages/api/v1/underlying-stats/players/[playerId].ts; pages/api/v1/underlying-stats/players/[playerId]/chart.ts; pages/api/v1/underlying-stats/goalies.ts; pages/api/v1/underlying-stats/goalies/[playerId].ts; pages/api/v1/db/update-player-underlying-stats.ts
- **Audit context:**
  - Intent (Opus): tasks/TASKS/three-pillars-analytics/underlying-stats/prd/prd-player-underlying-stats-landing-page.md:144 and tasks/TASKS/three-pillars-analytics/underlying-stats/prd/prd-goalie-underlying-stats-landing-page.md:180 (minimum TOI after aggregation)
  - External references: NST minimum TOI filter (minutes)
  - Fixtures/test data: `web/lib/underlying-stats/playerStatsLandingServer.test.ts:1910 fixture`
  - Tests: `web/lib/underlying-stats/playerStatsLandingServer.test.ts:1910`; `web/lib/underlying-stats/playerStatsLandingServer.test.ts:2941`
- **Leads (not audited):**
  - (opus) min-TOI threshold is in seconds; rows with any unreliable-TOI game are excluded entirely when a minimum is set

## M-UST-068 Per-season detail aggregation

- **Match:** Opus only; Opus UST-051; Codex —
- **Purpose:** Player detail page: one row per season (or season-team).
- **Where:** `web/lib/underlying-stats/playerStatsLandingServer.ts:4702 (buildPlayerStatsDetailAggregationFromSummaryRows)`; `web/lib/underlying-stats/playerStatsLandingServer.ts:4644 (matchesPlayerStatsSummaryRowForDetailState)`; `web/lib/underlying-stats/playerStatsLandingServer.ts:4635 (formatPlayerStatsSeasonLabel)`
- **Tags (heuristic):** generation: current
- **Opus view (UST-051):**
  - Method: Same ratio-of-sums merge as landing, grouped by seasonId (or seasonId:teamId); optional opponent filter; season label 'YYYY-YY'.
  - Inputs/units: summary rows; sources: nhl_api_game_payloads_raw derived partitions
  - Output scale: per-season aggregate rows; writes: —
  - Status: live — read by pages/api/v1/underlying-stats/players.ts and goalies.ts (+[playerId], chart) for /underlying-stats/playerStats and /goalieStats; summaries written by pages/api/v1/db/update-player-underlying-stats.ts, which runs from the lineCombinations insert trigger (supabase/migrations/20260716112910_harden_line_combination_trigger_auth.sql:130) and the pg_cron job 'update-player-underlying-stats-yesterday' at 09:35 UTC (tasks/TASKS/cron-operations/cron-schedule.md:382,827) (detail pages /underlying-stats/playerStats/[playerId], goalieStats/[playerId])
  - Consumers: pages/api/v1/underlying-stats/players/[playerId].ts; pages/api/v1/underlying-stats/goalies/[playerId].ts
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED beyond tasks/TASKS/three-pillars-analytics/underlying-stats/PlayerStatsDetail_Audit.md (prior audit notes)
  - External references: none suggested
  - Fixtures/test data: `web/lib/underlying-stats/playerStatsLandingServer.test.ts:1161-1582 fixtures`
  - Tests: `web/__tests__/pages/api/v1/underlying-stats/players/[playerId].test.ts`; `web/lib/underlying-stats/playerStatsLandingServer.test.ts:1161-1582`

## M-UST-069 Per-game chart series

- **Match:** Opus only; Opus UST-052; Codex —
- **Purpose:** Per-game metric values for the expanded-row chart.
- **Where:** `web/lib/underlying-stats/playerStatsLandingServer.ts:4825 (buildLandingChartApiResultFromSummaryRows)`
- **Tags (heuristic):** denominators: per 60, per game; generation: current
- **Opus view (UST-052):**
  - Method: Each game is mapped independently through mapLandingAggregationRowToApiRow (single-game percentages and per-60s), chronological order.
  - Inputs/units: single-game summary rows; sources: nhl_api_game_payloads_raw derived partitions
  - Output scale: per-game values (same units as table); writes: —
  - Status: live — read by pages/api/v1/underlying-stats/players.ts and goalies.ts (+[playerId], chart) for /underlying-stats/playerStats and /goalieStats; summaries written by pages/api/v1/db/update-player-underlying-stats.ts, which runs from the lineCombinations insert trigger (supabase/migrations/20260716112910_harden_line_combination_trigger_auth.sql:130) and the pg_cron job 'update-player-underlying-stats-yesterday' at 09:35 UTC (tasks/TASKS/cron-operations/cron-schedule.md:382,827) (chart endpoints)
  - Consumers: pages/api/v1/underlying-stats/players/[playerId]/chart.ts; components/underlying-stats/PlayerStatsExpandedRowChart.tsx
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/__tests__/pages/api/v1/underlying-stats/goalies/[playerId]/chart.test.ts`; `web/__tests__/pages/api/v1/underlying-stats/players/[playerId]/chart.test.ts`
- **Leads (not audited):**
  - (opus) min-TOI filter is applied per single game here (createLandingRowFromSummaryRows), so with a min-TOI set, most single-game points can be dropped

## M-UST-070 Individual derived metrics: points, IPP, shooting %, faceoff %

- **Match:** Opus only; Opus UST-053; Codex —
- **Purpose:** Compute rate-free derived individual stats.
- **Where:** `web/lib/underlying-stats/playerStatsLandingServer.ts:4916 (totalPoints)`; `web/lib/underlying-stats/playerStatsLandingServer.ts:4926 (ipp)`; `web/lib/underlying-stats/playerStatsLandingServer.ts:4930 (shootingPct)`; `web/lib/underlying-stats/playerStatsLandingServer.ts:4951 (faceoffPct)`; `web/lib/underlying-stats/playerStatsLandingServer.ts:2048 (toPctDecimal)`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: shots on goal; generation: current
- **Opus view (UST-053):**
  - Method: points = G + A; IPP = points / sum(on-ice GF) (null if any game lacks on-ice counts); SH% = G / SOG; FO% = FOW/(FOW+FOL). All percentages are 0-1 decimals (formatted x100 in UI); denominator<=0 -> null.
  - Inputs/units: integer counts; sources: —
  - Output scale: fractions 0-1 (UI multiplies by 100); writes: —
  - Status: live — read by pages/api/v1/underlying-stats/players.ts and goalies.ts (+[playerId], chart) for /underlying-stats/playerStats and /goalieStats; summaries written by pages/api/v1/db/update-player-underlying-stats.ts, which runs from the lineCombinations insert trigger (supabase/migrations/20260716112910_harden_line_combination_trigger_auth.sql:130) and the pg_cron job 'update-player-underlying-stats-yesterday' at 09:35 UTC (tasks/TASKS/cron-operations/cron-schedule.md:382,827)
  - Consumers: pages/api/v1/underlying-stats/players.ts; pages/api/v1/underlying-stats/players/[playerId].ts; pages/api/v1/underlying-stats/players/[playerId]/chart.ts; pages/api/v1/underlying-stats/goalies.ts; pages/api/v1/underlying-stats/goalies/[playerId].ts; pages/api/v1/db/update-player-underlying-stats.ts; components/underlying-stats/playerStatsColumns.ts
- **Audit context:**
  - Intent (Opus): tasks/TASKS/three-pillars-analytics/underlying-stats/prd/prd-player-underlying-stats-landing-page.md:164,200 (IPP listed among individual columns)
  - External references: NST IPP = points / on-ice GF; NHL SH% = G/SOG
  - Fixtures/test data: none listed
  - Tests: `web/lib/underlying-stats/playerStatsLandingServer.test.ts:2009`
- **Leads (not audited):**
  - (opus) IPP numerator counts all points credited in the split while on-ice GF comes from parity countsOi; own-goals and EN goals handling depends on parity module

## M-UST-071 On-ice share percentages (CF%, FF%, SF%, GF%, xGF%, SCF%, HDCF%, HDGF%, MDCF%, MDGF%)

- **Match:** Opus only; Opus UST-054; Codex —
- **Purpose:** Compute on-ice for-share percentages for skaters.
- **Where:** `web/lib/underlying-stats/playerStatsLandingServer.ts:4992 (on-ice branch of mapLandingAggregationRowToApiRow)`
- **Tags (heuristic):** percent scale: fraction 0-1; generation: current
- **Opus view (UST-054):**
  - Method: X% = XF / (XF + XA) on window totals (ratio of sums), 0-1 decimal; xGF%/SCF%/HD*/MD* null if either side null.
  - Inputs/units: on-ice counts; xG in goals; sources: —
  - Output scale: fractions 0-1; writes: —
  - Status: live — read by pages/api/v1/underlying-stats/players.ts and goalies.ts (+[playerId], chart) for /underlying-stats/playerStats and /goalieStats; summaries written by pages/api/v1/db/update-player-underlying-stats.ts, which runs from the lineCombinations insert trigger (supabase/migrations/20260716112910_harden_line_combination_trigger_auth.sql:130) and the pg_cron job 'update-player-underlying-stats-yesterday' at 09:35 UTC (tasks/TASKS/cron-operations/cron-schedule.md:382,827)
  - Consumers: pages/api/v1/underlying-stats/players.ts; pages/api/v1/underlying-stats/players/[playerId].ts; pages/api/v1/underlying-stats/players/[playerId]/chart.ts; pages/api/v1/underlying-stats/goalies.ts; pages/api/v1/underlying-stats/goalies/[playerId].ts; pages/api/v1/db/update-player-underlying-stats.ts
- **Audit context:**
  - Intent (Opus): tasks/TASKS/three-pillars-analytics/underlying-stats/prd/prd-player-underlying-stats-landing-page.md:242 (on-ice xGF etc.)
  - External references: NST on-ice CF%/FF%/SF%/GF%/xGF%/SCF%/HDCF%
  - Fixtures/test data: `tasks/TASKS/three-pillars-analytics/underlying-stats/PlayerStatsLanding_Audit.md`; `tasks/TASKS/three-pillars-analytics/underlying-stats/PlayerStatsDetail_Audit.md`
  - Tests: `web/lib/underlying-stats/playerStatsLandingServer.test.ts:2583`
- **Leads (not audited):**
  - (opus) no player PDO/oiSH%/oiSV% or relative (Rel/TM) metrics; LD shares only expose ldcf (no ldca)

## M-UST-072 Finished-game and season/game-type eligibility filter

- **Match:** Opus only; Opus UST-055; Codex —
- **Purpose:** Select which games feed player/goalie landing aggregates.
- **Where:** `web/lib/underlying-stats/playerStatsLandingServer.ts:791 (resolvePlayerStatsSeasonGameType)`; `web/lib/underlying-stats/playerStatsLandingServer.ts:805 (isFinishedPlayerStatsSourceGame)`; `web/lib/underlying-stats/playerStatsLandingServer.ts:827 (filterPlayerStatsLandingSourceGames)`
- **Tags (heuristic):** generation: current
- **Opus view (UST-055):**
  - Method: Game type preSeason=1, regularSeason=2, playoffs=3. A game is finished if date < UTC today, or date==today and startTime <= now-8h. Filters by season range, game type, date range, team involvement and venue; sorts ascending by date then id.
  - Inputs/units: dates as ISO YYYY-MM-DD (UTC), startTime timestamptz; game type codes 1/2/3; sources: games
  - Output scale: boolean / filtered game list; writes: —
  - Status: live — read by pages/api/v1/underlying-stats/players.ts and goalies.ts (+[playerId], chart) for /underlying-stats/playerStats and /goalieStats; summaries written by pages/api/v1/db/update-player-underlying-stats.ts, which runs from the lineCombinations insert trigger (supabase/migrations/20260716112910_harden_line_combination_trigger_auth.sql:130) and the pg_cron job 'update-player-underlying-stats-yesterday' at 09:35 UTC (tasks/TASKS/cron-operations/cron-schedule.md:382,827)
  - Consumers: buildPlayerStatsLandingAggregationFromState; fetchPlayerStatsSourceGamesForFilterState
- **Audit context:**
  - Intent (Opus): tasks/TASKS/three-pillars-analytics/underlying-stats/prd/prd-player-underlying-stats-landing-page.md (season type/date-range filters); 'not-safely-finished same-day games' contract asserted in web/lib/underlying-stats/playerStatsLandingServer.test.ts:250
  - External references: none suggested
  - Fixtures/test data: `web/lib/underlying-stats/playerStatsLandingServer.test.ts:129-265 inline game fixtures`
  - Tests: `web/lib/underlying-stats/playerStatsLandingServer.test.ts (filterPlayerStatsLandingSourceGames, resolvePlayerStatsSeasonGameType)`
- **Leads (not audited):**
  - (opus) 'today' uses UTC date (toISOString) so late-evening North American games roll to the next UTC date; 8-hour finished cutoff is a magic constant reused in refresh windows and adminRouteHelpers

## M-UST-073 PBP game-clock reconstruction (period duration, game seconds elapsed, seconds since previous event)

- **Match:** Opus only; Opus UST-056; Codex —
- **Purpose:** Derive absolute game time per stored PBP event before running shot features / NST parity.
- **Where:** `web/lib/underlying-stats/playerStatsLandingServer.ts:895 (resolvePeriodDurationSeconds)`; `web/lib/underlying-stats/playerStatsLandingServer.ts:921 (resolveGameSecondsElapsed)`; `web/lib/underlying-stats/playerStatsLandingServer.ts:1006 (buildStoredPbpEventSequence)`; `web/lib/underlying-stats/teamStatsSummaryRefresh.ts:243 (resolvePeriodDurationSeconds, copy)`
- **Tags (heuristic):** generation: current
- **Opus view (UST-056):**
  - Method: Period duration = elapsed + remaining if both known, else SO=0, OT=300 s, otherwise 1200 s. gameSecondsElapsed = (period_number-1) * base + elapsed where base = 1200 when period<=3 OR duration unknown, else base = that period's own duration. secondsSincePrevious = elapsed(this) - elapsed(previous). Also tags own goals from landing payload summary.scoring goalModifier.
  - Inputs/units: seconds (period_seconds_elapsed, time_remaining_seconds); period_number integer; sources: nhl_api_pbp_events
  - Output scale: seconds of game time; writes: —
  - Status: live — read by pages/api/v1/underlying-stats/players.ts and goalies.ts (+[playerId], chart) for /underlying-stats/playerStats and /goalieStats; summaries written by pages/api/v1/db/update-player-underlying-stats.ts, which runs from the lineCombinations insert trigger (supabase/migrations/20260716112910_harden_line_combination_trigger_auth.sql:130) and the pg_cron job 'update-player-underlying-stats-yesterday' at 09:35 UTC (tasks/TASKS/cron-operations/cron-schedule.md:382,827)
  - Consumers: buildShotFeatureRows (rebound/rush timing); buildNstParityMetrics
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED (no comment states the game-clock contract; NHL_REGULATION_PERIOD_SECONDS/OT constants at web/lib/underlying-stats/playerStatsLandingServer.ts:212-213)
  - External references: NHL API period clock (20-min regulation, 5-min regular-season OT, 20-min playoff OT)
  - Fixtures/test data: `web/lib/underlying-stats/playerStatsLandingServer.test.ts:388-543 inline PBP rows (no OT case seen)`
  - Tests: `web/lib/underlying-stats/playerStatsLandingServer.test.ts:388 (buildStoredPbpEventSequence)`
- **Leads (not audited):**
  - (opus) for a regular-season OT event (period 4, duration 300) gameSecondsElapsed = 3*300 + elapsed (= 900+x) instead of 3600+x, so seconds_since_previous_event across the regulation->OT boundary is negative; any rebound/rush logic using it may misfire in OT
  - (opus) playoff 2nd+ OT uses own-period duration for all completed periods (fine only because playoff OT is also 1200 s)

## M-UST-074 Position canonicalization and position-group filter

- **Match:** Opus only; Opus UST-057; Codex —
- **Purpose:** Map raw positions to C/LW/RW/D/G and filter by group.
- **Where:** `web/lib/underlying-stats/playerStatsQueries.ts:212 (normalizeCanonicalPlayerPositionCode)`; `web/lib/underlying-stats/playerStatsQueries.ts:256 (matchesPlayerStatsPositionGroup)`
- **Tags (heuristic):** generation: current
- **Opus view (UST-057):**
  - Method: G/GK/GOALIE->G; D/LD/RD->D; C->C; LW/L->LW; RW/R->RW; W/F/unknown->null. Skaters group = C\|LW\|RW\|D only.
  - Inputs/units: position strings; sources: players, nhl_api_game_roster_spots
  - Output scale: canonical code C/LW/RW/D/G or null; writes: —
  - Status: live — read by pages/api/v1/underlying-stats/players.ts and goalies.ts (+[playerId], chart) for /underlying-stats/playerStats and /goalieStats; summaries written by pages/api/v1/db/update-player-underlying-stats.ts, which runs from the lineCombinations insert trigger (supabase/migrations/20260716112910_harden_line_combination_trigger_auth.sql:130) and the pg_cron job 'update-player-underlying-stats-yesterday' at 09:35 UTC (tasks/TASKS/cron-operations/cron-schedule.md:382,827)
  - Consumers: pages/api/v1/underlying-stats/players.ts; pages/api/v1/underlying-stats/players/[playerId].ts; pages/api/v1/underlying-stats/players/[playerId]/chart.ts; pages/api/v1/underlying-stats/goalies.ts; pages/api/v1/underlying-stats/goalies/[playerId].ts; pages/api/v1/db/update-player-underlying-stats.ts
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/underlying-stats/playerStatsQueries.test.ts`
- **Leads (not audited):**
  - (opus) players whose position is 'F'/'W'/null are excluded from every skater view, including the default all-skaters group

## M-UST-075 Season window fallback and date-range validation

- **Match:** Opus only; Opus UST-060; Codex —
- **Purpose:** Derive season date bounds and current season when canonical data is missing.
- **Where:** `web/lib/underlying-stats/playerStatsFilters.ts:222 (deriveFallbackSeasonWindow)`; `web/lib/underlying-stats/playerStatsFilters.ts:246 (getSeasonSpanDateBounds)`; `web/lib/underlying-stats/playerStatsFilters.ts:451 (deriveFallbackCurrentSeasonId)`; `web/lib/underlying-stats/playerStatsFilters.ts:803 (validatePlayerStatsFilterState)`; `web/lib/underlying-stats/teamStatsFilters.ts:400 (deriveFallbackSeasonWindow)`; `web/lib/underlying-stats/teamStatsFilters.ts:665 (deriveFallbackCurrentSeasonId)`; `web/lib/underlying-stats/teamStatsFilters.ts:945 (validateTeamStatsFilterState)`
- **Tags (heuristic):** generation: current
- **Opus view (UST-060):**
  - Method: Fallback season window = Sep 1 of start year to Jun 30 of end year (regular season and season end both Jun 30). Current season rolls over in September (month index >= 8, local time). Date-range scope must sit inside the window.
  - Inputs/units: seasonId YYYYYYYY; local Date; sources: —
  - Output scale: ISO dates; seasonId; writes: —
  - Status: live — read by pages/api/v1/underlying-stats/players.ts and goalies.ts (+[playerId], chart) for /underlying-stats/playerStats and /goalieStats; summaries written by pages/api/v1/db/update-player-underlying-stats.ts, which runs from the lineCombinations insert trigger (supabase/migrations/20260716112910_harden_line_combination_trigger_auth.sql:130) and the pg_cron job 'update-player-underlying-stats-yesterday' at 09:35 UTC (tasks/TASKS/cron-operations/cron-schedule.md:382,827); live — team_underlying_stats_summary written by pages/api/v1/db/update-player-underlying-stats.ts:242 and sweep-gamecenter-normalization.ts:352 (plus manual catch-up/backfill/rebuild routes); read by pages/api/v1/underlying-stats/teams.ts for /underlying-stats/teamStats
  - Consumers: player/team filter UI and API parsing
- **Audit context:**
  - Intent (Opus): web/lib/underlying-stats/playerStatsFilters.ts:455-456 comment ('Use September as the season rollover threshold for local fallback logic. Server/bootstrap code should pass a canonical currentSeasonId')
  - External references: NHL season calendar
  - Fixtures/test data: none listed
  - Tests: `web/lib/underlying-stats/playerStatsFilters.test.ts`; `web/lib/underlying-stats/teamStatsFilters.test.ts`
- **Leads (not audited):**
  - (opus) fallback regular-season end = Jun 30 (no distinction from playoffs); September rollover uses local time while other code uses UTC; logic duplicated in player and team filter modules

## M-UST-076 Incremental refresh watermark selection

- **Match:** Opus only; Opus UST-061; Codex —
- **Purpose:** Pick which finished games to (re)build summaries for.
- **Where:** `web/lib/underlying-stats/playerStatsRefreshWindow.ts:91 (resolvePlayerStatsIncrementalSelection)`; `web/lib/underlying-stats/playerStatsRefreshWindow.ts:137 (holeFloor)`; `web/lib/underlying-stats/goalieStatsRefreshWindow.ts:86 (resolveGoalieStatsIncrementalSelection)`; `web/lib/underlying-stats/teamStatsRefreshWindow.ts:86 (resolveTeamStatsIncrementalSelection)`; `web/lib/underlying-stats/adminRouteHelpers.ts:255 (inferRequestedGameType)`; `web/lib/underlying-stats/adminRouteHelpers.ts:287 (fetchFinishedSeasonGameIds)`
- **Tags (heuristic):** generation: current
- **Opus view (UST-061):**
  - Method: Finished = date < UTC today and startTime <= now-8h. Watermark = date of newest finished game that is already covered; select all finished games on/after watermark (or all if none covered). Player only: also retry uncovered games back to (latest finished date - 7 days). Game type inferred from game-id digits 5-6 when not explicit (all ids must agree).
  - Inputs/units: ISO dates (UTC); hours (8 h finished cutoff); days (7-day hole floor); sources: games, nhl_api_game_payloads_raw, goalie_underlying_summary_partitions, team_underlying_stats_summary
  - Output scale: list of game ids; ISO dates; writes: —
  - Status: live — player selection used by update-player-underlying-stats.ts and catch-up-player-underlying.ts; goalie by update-goalie-underlying-stats.ts and catch-up-goalie-underlying.ts; team by catch-up-team-underlying.ts
  - Consumers: pages/api/v1/db/update-player-underlying-stats.ts; pages/api/v1/db/catch-up-team-underlying.ts
- **Audit context:**
  - Intent (Opus): web/lib/underlying-stats/playerStatsRefreshWindow.ts:134-136 (retry uncovered games back to latest finished date minus 7 days); goalie/team equivalents UNDOCUMENTED
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/__tests__/pages/api/v1/db/catch-up-team-underlying.test.ts`; `web/__tests__/pages/api/v1/db/update-goalie-underlying-stats.test.ts`; `web/__tests__/pages/api/v1/db/update-player-underlying-stats.test.ts`; `web/lib/underlying-stats/playerStatsRefreshWindow.test.ts`
- **Leads (not audited):**
  - (opus) goalie and team selections lack the player's 7-day hole-floor retry, so a failed older game behind a covered newer game is never reselected for goalies/teams
  - (opus) refresh windows exclude games dated today while the landing filter includes today's games 8h after start

## M-UST-077 Summary coverage and missing-game detection

- **Match:** Opus only; Opus UST-062; Codex —
- **Purpose:** Decide which games are summarized / need rebuilding and report coverage.
- **Where:** `web/lib/underlying-stats/teamStatsSummaryRefresh.ts:1121 (fetchSeasonTeamSummaryGameIdSet)`; `web/lib/underlying-stats/teamStatsQueries.ts:944 (fetchSeasonCoverage)`; `web/lib/underlying-stats/adminRouteHelpers.ts:403 (selectMissingTeamSummaryGameIds)`; `web/lib/underlying-stats/adminRouteHelpers.ts:330 (selectMissingPlayerSummaryGameIds)`; `web/lib/underlying-stats/adminRouteHelpers.ts:367 (selectMissingGoalieSummaryGameIds)`; `web/lib/underlying-stats/playerUnderlyingCoverage.ts:24 (classifyPlayerUnderlyingCoverage)`
- **Tags (heuristic):** denominators: per team game; generation: current
- **Opus view (UST-062):**
  - Method: A team game counts as summarized only if >=2 distinct teams have toi_seconds>0 in the all/all row. Coverage: completedGames = games dated before UTC today; summarizedGames = ceil(allStrengths/allScores row count / 2). Player coverage diagnostic: set differences expected vs roster vs summary game ids -> complete / stale-roster / stale-summary / unknown-reference.
  - Inputs/units: row counts; TOI seconds; game ids; sources: team_underlying_stats_summary, games, nhl_api_game_payloads_raw, goalie_underlying_summary_partitions
  - Output scale: counts; set membership; status enum; writes: —
  - Status: live — coverage returned by pages/api/v1/underlying-stats/teams.ts; missing-game selectors used by catch-up/backfill routes; classifyPlayerUnderlyingCoverage used only by web/scripts/verify-player-underlying-query.ts (diagnostic script)
  - Consumers: pages/api/v1/db/catch-up-team-underlying.ts; pages/api/v1/underlying-stats/teams.ts (coverage); components/underlying-stats/UlsStatusPanel.tsx
- **Audit context:**
  - Intent (Opus): web/lib/underlying-stats/teamStatsQueries.ts:963 ('One all-situations row per team per game: two rows per summarized game'); web/lib/underlying-stats/teamStatsLandingApi.ts:142-144; guidance strings in web/lib/underlying-stats/playerUnderlyingCoverage.ts:24-100
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/__tests__/pages/api/v1/db/catch-up-team-underlying.test.ts`; `web/lib/underlying-stats/playerUnderlyingCoverage.test.ts`; `web/lib/underlying-stats/teamStatsSummaryRefresh.test.ts:72 (fetchSeasonTeamSummaryGameIdSet)`
- **Leads (not audited):**
  - (opus) summarizedGames counts rows/2 even if a game has only one team row (rounded up), so coverage can overstate
  - (opus) completedGames counts scheduled games before today, including postponed ones

## M-UST-078 Shots and goals by rink coordinate

- **Match:** Opus only; Opus UST-065; Codex —
- **Purpose:** Count shots-on-goal and goals per (x,y) coordinate per team and league-wide.
- **Where:** `web/lib/supabase/shotsByCoord.js:67 (updateShotsAndGoals)`; `web/lib/supabase/shotsByCoord.js:8 (teamsInfo ids)`
- **Tags (heuristic):** denominators: shots on goal; generation: legacy, current
- **Opus view (UST-065):**
  - Method: For each play with coordinates and a known team id: read current counts for (x,y), then team_<id>_shots +1 and league_shots +1; if goal also team_<id>_goals +1 and league_goals +1 (goals counted as shots, SOG convention). No season, strength or side normalization.
  - Inputs/units: raw NHL pbp x/y coordinates (feet, centre ice origin, not side-normalized); event counts; sources: pbp_plays (typedesckey shot-on-goal or goal)
  - Output scale: integer counts per coordinate per team and league; writes: shots_goals_by_coord
  - Status: legacy/dead — standalone script with no importers, no route/cron; no readers of shots_goals_by_coord
  - Consumers: none found
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: Shot location heat maps normally normalize coordinates to one attacking direction (e.g. MoneyPuck/NST rink normalization)
  - Fixtures/test data: none listed
  - Tests: none listed
- **Leads (not audited):**
  - (opus) non-idempotent read-increment-upsert; re-running double counts every event and concurrent runs race
  - (opus) raw x/y not flipped for period/attacking side, so offensive and defensive ends mix
  - (opus) no season or strength filter; all pbp_plays history pooled
  - (opus) UTA mapped to team id 59 while current schedule code notes UTA 68, so newer Utah events are skipped
  - (opus) dead script (no consumers)

## M-UST-079 Heuristic shot danger buckets (distance/angle)

- **Match:** Opus only; Opus UST-066; Codex —
- **Purpose:** Classify shots as high/medium/low danger and scoring chances.
- **Where:** `web/lib/underlying-stats/playerStatsLandingServer.ts:2328 (getPbpOnlyShotDangerBucket)`; `web/lib/underlying-stats/playerStatsLandingServer.ts:3433 (inline bucket in accumulateGoalieShotFeatureBucketMetrics)`; `web/lib/underlying-stats/teamStatsSummaryRefresh.ts:462 (getDangerBucket)`; `web/lib/underlying-stats/teamStatsSummaryRefresh.ts:517 (isScoringChance)`
- **Tags (heuristic):** generation: current
- **Opus view (UST-066):**
  - Method: high if distance<=20 ft AND angle<=35 deg; medium if distance<=40 AND angle<=50; else low; null if distance/angle missing. Scoring chance = high or medium.
  - Inputs/units: feet (distance to net at x=89,y=0 after mirroring), degrees (atan2(\|dy\|,\|dx\|), 0 = straight on); sources: derived shot features (nhlShotFeatureBuilder)
  - Output scale: categorical high/medium/low; boolean scoring chance; writes: team_underlying_stats_summary (hd*/md*/ld*/sc* columns)
  - Status: live — team_underlying_stats_summary written by pages/api/v1/db/update-player-underlying-stats.ts:242 and sweep-gamecenter-normalization.ts:352 (plus manual catch-up/backfill/rebuild routes); read by pages/api/v1/underlying-stats/teams.ts for /underlying-stats/teamStats; also live — read by pages/api/v1/underlying-stats/players.ts and goalies.ts (+[playerId], chart) for /underlying-stats/playerStats and /goalieStats; summaries written by pages/api/v1/db/update-player-underlying-stats.ts, which runs from the lineCombinations insert trigger (supabase/migrations/20260716112910_harden_line_combination_trigger_auth.sql:130) and the pg_cron job 'update-player-underlying-stats-yesterday' at 09:35 UTC (tasks/TASKS/cron-operations/cron-schedule.md:382,827) (goalie danger splits, fallback iSCF/iHDCF)
  - Consumers: team summaries; goalie danger splits; PBP-only individual iSCF/iHDCF
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED in this slice; tasks/TASKS/xg-model/docs/final-implementation-summary.md describes the parity foundation but not these thresholds
  - External references: NST scoring-chance / high-danger zone map (slot/home-plate regions, rebounds/rush bonuses) — this is a simplified geometric proxy
  - Fixtures/test data: none listed
  - Tests: none listed
- **Leads (not audited):**
  - (opus) does not match NST's zone-based SC/HD definitions despite NST-style labels (HDCF, SCF); rebound/rush do not upgrade danger
  - (opus) same thresholds hard-coded in at least three places (plus nhlNstParityMetrics) — drift risk

## M-UST-080 Heuristic approximate xG per shot

- **Match:** Opus only; Opus UST-067; Codex —
- **Purpose:** Assign an expected-goal value to each unblocked/blocked attempt for team and fallback individual xG.
- **Where:** `web/lib/underlying-stats/playerStatsLandingServer.ts:2344 (getPbpOnlyApproximateXgValue)`; `web/lib/underlying-stats/teamStatsSummaryRefresh.ts:481 (getApproximateXgValue)`
- **Tags (heuristic):** generation: current
- **Opus view (UST-067):**
  - Method: Hand-set lookup, not a trained model. Per shot: base 0.18 high / 0.08 medium / 0.02 low danger; +0.03 rebound, +0.02 rush, +0.02 royal-road crossing; if goal, value=max(value,0.25); cap 0.95; null if distance/angle missing. INCLUDES: x,y normalized to the attacking direction by mirroring (x,y)->(-x,-y) when the shooting team attacks the left side, from home_team_defending_side (web/lib/supabase/Upserts/nhlCoordinates.ts:51); net fixed at (89,0); distance = Euclidean feet to (89,0) (nhlShotFeatureBuilder.ts:182); angle = atan2(\|dy\|,\|dx\|) degrees (nhlShotFeatureBuilder.ts:192), used only through the danger buckets (<=20 ft & <=35 deg high; <=40 ft & <=50 deg medium; else low); rebound flag (DEFAULT_REBOUND_WINDOW_SECONDS=3, web/lib/supabase/Upserts/nhlRebounds.ts:6); rush flag (DEFAULT_RUSH_WINDOW_SECONDS=10, web/lib/supabase/Upserts/nhlRush.ts:5); royal-road crossing (prior and current event y of opposite sign, both x>=25, nhlContextualFeatures.ts:277); goal outcome (as a floor). EXCLUDES: shot type, distance/angle as continuous terms (bucketed only), strength state, score state/score effects, shooter talent, goalie effects, venue/rink scorer bias adjustment, time/period, empty-net handling, training set or seasons (none — constants are hand-set), model type (none; lookup table, not logistic/GBM), calibration to league goal rate (none). Blocked attempts are not excluded in team summaries (attempt type not checked before assigning xG). A copy of the same proxy is in nhlNstParityMetrics.ts:~410 (other slice).
  - Inputs/units: bucket label; booleans (rebound/rush/royal road); isGoal; sources: derived shot features
  - Output scale: expected goals per shot, 0.02-0.95 (sum = goals); writes: team_underlying_stats_summary.xgf/xga
  - Status: live — team_underlying_stats_summary written by pages/api/v1/db/update-player-underlying-stats.ts:242 and sweep-gamecenter-normalization.ts:352 (plus manual catch-up/backfill/rebuild routes); read by pages/api/v1/underlying-stats/teams.ts for /underlying-stats/teamStats; live — read by pages/api/v1/underlying-stats/players.ts and goalies.ts (+[playerId], chart) for /underlying-stats/playerStats and /goalieStats; summaries written by pages/api/v1/db/update-player-underlying-stats.ts, which runs from the lineCombinations insert trigger (supabase/migrations/20260716112910_harden_line_combination_trigger_auth.sql:130) and the pg_cron job 'update-player-underlying-stats-yesterday' at 09:35 UTC (tasks/TASKS/cron-operations/cron-schedule.md:382,827) (fallback ixG)
  - Consumers: team landing xGF%, xGF/60; PBP-only ixG
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED (no comment or PRD defines the proxy; team PRD tasks/TASKS/three-pillars-analytics/underlying-stats/prd/prd-team-underlying-stats-landing-page.md:64 only lists xGF/xGA/xGF% columns)
  - External references: MoneyPuck / Evolving-Hockey / NST logistic xG models (outcome-blind, calibrated to league goal rate)
  - Fixtures/test data: none listed
  - Tests: none listed
- **Leads (not audited):**
  - (opus) outcome leakage — goals get a floor of 0.25, so xG is not independent of the result and xGF/xGA/GSAx are biased toward actual goals
  - (opus) blocked shots receive xG in team summaries (attempt type not checked), unlike NST/MoneyPuck which exclude blocked attempts from xG
  - (opus) uncalibrated magic constants; team xG differs from the trained xG model used elsewhere (nhl_xg_* tables, xG explorer)
  - (opus) angle uses \|dx\|, so shots from behind the goal line (x>89) get the same small angle as shots from in front and can land in the high-danger bucket

## M-UST-081 Skater standard and advanced variance metrics (per-60, SH%, ATOI)

- **Match:** Opus only; Opus UST-071; Codex —
- **Purpose:** Per-player season/period totals and rates on the skater variance page
- **Where:** `web/components/SkaterPage/skaterMetrics.ts:275 (buildSkaterMetricsRows)`; `web/components/SkaterPage/skaterMetrics.ts:323 (buildSkaterAdvancedMetricsRows)`; `web/components/SkaterPage/skaterMetrics.ts:209 (per60)`; `web/components/SkaterPage/skaterMetrics.ts:191 (average)`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: per 60, per game; generation: current
- **Opus view (UST-071):**
  - Method: Counts summed. averageTimeOnIce = mean of per-game toi_per_game. SH% = sum(goals)/sum(shots) (0-1) else mean of row shooting_percentage. per60 = sum(stat)/sum(toi_per_game sec)*3600; PP G/A/P per 60 use sum(pp_toi). corsiForPer60, IPP, ixG/60 = unweighted mean of per-game NST rates (fallback individual_sat_for_per_60 for CF/60).
  - Inputs/units: WGO game toi_per_game and pp_toi in seconds; counts; NST per-60 and IPP pass-through (IPP likely 0-100); sources: wgo_skater_stats, wgo_skater_stats_totals
  - Output scale: per-60 rates (ratio-of-sums for counts, mean-of-ratios for NST fields); SH% fraction 0-1; ATOI seconds; writes: —
  - Status: live — pages/variance/skaters.tsx
  - Consumers: SkaterAdvancedMetricsTable; SkaterLeaderboard
- **Audit context:**
  - Intent (Opus): tasks/TASKS/variance/v2/prd-variance-goalies-skaters-second-pass.md:5 (first live /variance/skaters MVP table)
  - External references: NST per-60 convention; ratio-of-sums
  - Fixtures/test data: none listed
  - Tests: `web/components/SkaterPage/skaterCalculations.test.ts`; `web/components/SkaterPage/skaterMetrics.test.ts`
- **Leads (not audited):**
  - (opus) corsiForPer60 falls back from on-ice CF/60 (nst_oi_cf_per_60) to individual SAT/60 - two different stats under one label
  - (opus) CF/60, IPP and ixG/60 are mean-of-ratios across games while G/A/P per 60 are ratio-of-sums
  - (opus) SH% fallback averages per-game shooting percentages
  - (opus) average PP TOI uses pp_toi_per_game first then pp_toi; summing toi_per_game as seconds assumes WGO game rows store game TOI in seconds

## M-UST-082 Skater bucket average rows

- **Match:** Opus only; Opus UST-072; Codex —
- **Purpose:** Average player rows within each ownership/ADP bucket
- **Where:** `web/components/SkaterPage/skaterMetrics.ts:395 (averageWeekCounts)`; `web/components/SkaterPage/skaterMetrics.ts:415 (buildSkaterValueOverviewBucketAverageRows)`; `web/components/SkaterPage/skaterMetrics.ts:466 (buildSkaterMetricsBucketAverageRows)`
- **Tags (heuristic):** generation: current
- **Opus view (UST-072):**
  - Method: Unweighted mean over players of each metric (including SH%, ATOI, % good weeks, SDs).
  - Inputs/units: player-level metrics; sources: —
  - Output scale: unweighted bucket means; writes: —
  - Status: live — SkaterTable bucket rows on pages/variance/skaters.tsx
  - Consumers: SkaterTable bucket rows
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/components/SkaterPage/skaterMetrics.test.ts`
- **Leads (not audited):**
  - (opus) bucket SH% is mean of player SH% (not pooled); averaging SDs is not the SD of the bucket

## M-UST-083 SoS game-log past/future opponent partition

- **Match:** Opus only; Opus UST-074; Codex —
- **Purpose:** Attach past and future opponent lists to each team-date standings row for SoS.
- **Where:** `web/lib/supabase/Upserts/fetchSoSgameLog.js:106 (fetchDailyStandings)`; `web/lib/supabase/Upserts/fetchSoSgameLog.js:264 (updateStandingsWithOpponents)`; `web/lib/supabase/Upserts/fetchSoSgameLog.js:291 (past filter)`; `web/lib/supabase/Upserts/fetchSoSgameLog.js:304 (future filter)`
- **Tags (heuristic):** generation: legacy, current
- **Opus view (UST-074):**
  - Method: Intended: past = games with date <= standings date, future = games after. Rows store team W/L/OTL/points/point% per date.
  - Inputs/units: dates; standings counts; sources: api-web standings/{date}, api-web club-schedule-season, sos_standings
  - Output scale: JSON arrays of opponent games; writes: sos_standings
  - Status: legacy/dead — no importer of fetchSoSgameLog.js found; sos_standings is written live by pages/api/v1/db/update-team-sos.ts (pg_cron update-team-sos active=true, cron-schedule.md:345) and lib/supabase/sosStandings.js, read by pages/api/v1/trends/team-sos.ts and lib/underlying-stats/teamScheduleStrength.ts:509
  - Consumers: lib/supabase/sosStandings.js; pages/api/v1/trends/team-sos.ts; pages/api/v1/db/update-team-sos.ts (verify which reads sos_standings)
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: Opponent win%/points% SoS
  - Fixtures/test data: none listed
  - Tests: none listed
- **Leads (not audited):**
  - (opus) variable shadowing - filter compares gameDateObj <= gameDateObj (inner shadows outer), so past_opponents = all games and future_opponents = [] for every row
  - (opus) reads snake_case fields (ot_losses, point_pctg, win_pctg, games_played, team_common_name) that api-web returns in camelCase, so these are null; '\|\| null' also turns 0 wins into null
  - (opus) module runs as a self-invoking IIFE on import

## M-UST-084 Strength-of-schedule opponent record totals (legacy script)

- **Match:** Opus only; Opus UST-075; Codex —
- **Purpose:** For each team and date, sum past and future opponents' W/L/OTL as of that date.
- **Where:** `web/lib/supabase/sosStandings.js:172 (fetchDailyStandings)`; `web/lib/supabase/sosStandings.js:329 (fetchAndProcessGameLogs)`; `web/lib/supabase/sosStandings.js:391 (updateStandingsWithOpponents)`; `web/lib/supabase/sosStandings.js:625 (opponent totals)`
- **Tags (heuristic):** generation: legacy, current
- **Opus view (UST-075):**
  - Method: Past opponents = games with game_date <= row date; future = later games. Each opponent's W/L/OTL looked up from raw_standings_sos at the row date (missing -> 0). Totals = plain sums over games (opponents faced repeatedly counted each time) for past and future separately; no conversion to point% here. Team point/win pct copied from NHL (0-1).
  - Inputs/units: opponent W/L/OTL counts as of the row date; team pointPctg and winPctg as fractions 0-1 from NHL; sources: api-web.nhle.com /v1/standings/{date}, api-web.nhle.com /v1/club-schedule-season/{team}/{season}, raw_standings_sos, sos_standings
  - Output scale: integer W/L/OTL sums over past and future opponents (not normalized); writes: sos_standings
  - Status: unknown — legacy/unknown — standalone script (winston file logger, no importer except a path comment in Upserts/fetchSoSgameLog.js:1); live writer of sos_standings is pages/api/v1/db/update-team-sos.ts:318-320; table read by lib/trends/strengthOfSchedule.ts, lib/underlying-stats/teamScheduleStrength.ts, pages/api/v1/trends/team-sos.ts, pages/statsPlaceholder.tsx
  - Consumers: web/lib/trends/strengthOfSchedule.ts; web/lib/underlying-stats/teamScheduleStrength.ts; web/pages/api/v1/trends/team-sos.ts; web/pages/statsPlaceholder.tsx
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED in this file (section comments only, e.g. sosStandings.js:171 'Fetch Daily Standings and Upsert to sos_standings', :390 'Update Standings with Opponents')
  - External references: Common SoS = opponents' points% (or win%) weighted by games, optionally excluding games vs the team itself
  - Fixtures/test data: none listed
  - Tests: none listed
- **Leads (not audited):**
  - (opus) missing opponent standings silently become 0-0-0, deflating SoS
  - (opus) opponents' records are not adjusted to exclude results against the subject team
  - (opus) same sos_standings table is also written by pages/api/v1/db/update-team-sos.ts - two writers, possibly divergent logic
  - (opus) game on the row date is counted as 'past' (<=), and standings are fetched for every calendar day including non-game days

## M-UST-085 Landing/detail table sort, pagination and rank

- **Match:** Opus only; Opus UST-076; Codex —
- **Purpose:** Order rows (and assign team rank) for landing tables.
- **Where:** `web/lib/underlying-stats/playerStatsLandingServer.ts:5179 (compareNullable)`; `web/lib/underlying-stats/playerStatsLandingServer.ts:5202 (sortLandingApiRows)`; `web/lib/underlying-stats/teamStatsQueries.ts:392 (compareValues)`; `web/lib/underlying-stats/teamStatsQueries.ts:784 (sortRows)`; `web/lib/underlying-stats/teamStatsQueries.ts:1023 (rank = index+1)`; `web/components/underlying-stats/playerStatsSorting.ts:21 (getPlayerStatsNextSortState)`
- **Tags (heuristic):** generation: current
- **Opus view (UST-076):**
  - Method: Nulls always last; numeric diff else localeCompare; tie fallbacks playerName, teamLabel, positionCode, gamesPlayed, toiSeconds, rowKey. Team rows get rank = position after sort (no tie sharing). First click on a column sorts desc.
  - Inputs/units: metric values of mixed units; sources: —
  - Output scale: ordinal rank 1..N; page slices; writes: —
  - Status: live — read by pages/api/v1/underlying-stats/players.ts and goalies.ts (+[playerId], chart) for /underlying-stats/playerStats and /goalieStats; summaries written by pages/api/v1/db/update-player-underlying-stats.ts, which runs from the lineCombinations insert trigger (supabase/migrations/20260716112910_harden_line_combination_trigger_auth.sql:130) and the pg_cron job 'update-player-underlying-stats-yesterday' at 09:35 UTC (tasks/TASKS/cron-operations/cron-schedule.md:382,827); live — team_underlying_stats_summary written by pages/api/v1/db/update-player-underlying-stats.ts:242 and sweep-gamecenter-normalization.ts:352 (plus manual catch-up/backfill/rebuild routes); read by pages/api/v1/underlying-stats/teams.ts for /underlying-stats/teamStats
  - Consumers: pages/api/v1/underlying-stats/players.ts; pages/api/v1/underlying-stats/players/[playerId].ts; pages/api/v1/underlying-stats/players/[playerId]/chart.ts; pages/api/v1/underlying-stats/goalies.ts; pages/api/v1/underlying-stats/goalies/[playerId].ts; pages/api/v1/db/update-player-underlying-stats.ts; pages/api/v1/underlying-stats/teams.ts; components/underlying-stats/TeamStatsFilters.tsx + teamStatsColumns.ts table
- **Audit context:**
  - Intent (Opus): tasks/TASKS/three-pillars-analytics/underlying-stats/prd/prd-team-underlying-stats-landing-page.md:75 ('Default sorting logic must be defined (e.g., Points or xGF%)')
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/components/underlying-stats/playerStatsSorting.test.ts`; `web/lib/underlying-stats/playerStatsLandingServer.test.ts:1497`; `web/lib/underlying-stats/playerStatsLandingServer.test.ts:2155 (server pagination)`
- **Leads (not audited):**
  - (opus) null-last is applied before direction flip only for non-null comparisons — direction 'asc' negation does not move nulls (ok), but 'rank' is ordinal with no ties
  - (opus) default desc on first click is wrong-way for lower-is-better metrics (GAA, GA/60, xGA/60)

## M-UST-086 Team landing goalie start share and span windows

- **Match:** Opus only; Opus UST-077; Codex —
- **Purpose:** Each goalie's share of team games over L10/L20/L30/season
- **Where:** `web/components/TeamLandingPage/goalieTrends.js:12 (processGoalieData)`; `web/components/TeamLandingPage/goalieTrends.js:83 (calculateStartDate)`; `web/components/TeamLandingPage/GoalieWorkloadBars.js:9`
- **Tags (heuristic):** percent scale: 0-100; generation: legacy
- **Opus view (UST-077):**
  - Method: Span start = date of (most recent past game index + 9/19/29) in descending dates; share = gamesStarted/teamGames*100 (goalieTrends); workload bars share = gamesStarted/sum of goalie starts*100.
  - Inputs/units: NHL stats API gamesStarted counts; savePct fraction; GAA; sources: api.nhle.com stats/rest goalie/summary, api-web.nhle.com club-schedule-season
  - Output scale: share percent 0-100; writes: —
  - Status: legacy/dead — near-dead: only importer is pages/statsPlaceholder.tsx:14 (placeholder page)
  - Consumers: Team landing page goalie chart (DoughnutChart) and workload bars
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: none listed
- **Leads (not audited):**
  - (opus) two different denominators for 'share' (team games vs total goalie starts) on the same page
  - (opus) field named gamesPlayed actually holds gamesStarted
  - (opus) span start uses 'date < now' so a game later today is excluded inconsistently

## M-UST-087 Trust-type classifier (buyLow / heatCheck / processBacked)

- **Match:** Opus only; Opus UST-079; Codex —
- **Purpose:** Flag teams whose results diverge from process.
- **Where:** `web/lib/underlying-stats/teamLandingDashboard.ts:186 (resolveTrustType)`
- **Tags (heuristic):** denominators: per 60; generation: current
- **Opus view (UST-079):**
  - Method: scoringEdge = finishing-100, goalieEdge = goalie-100; inflation = scoringEdge + goalieEdge + 4*max(z,0); drag = max(0,100-finishing) + max(0,100-goalie) + 4*max(-z,0). buyLow if power>=103, gap>=0.12 and (drag>=6 or cold); heatCheck if power>=103, gap<=-0.12 and (inflation>=7 or hot); processBacked if power>=102, \|gap\|<=0.12, \|z\|<=0.9, \|edges\|<=4.
  - Inputs/units: power ~100 scale; goals/60 gap; ratings ~100; z; sources: —
  - Output scale: enum or null; writes: —
  - Status: live — pages/api/underlying-stats/landing.ts and team-ratings.ts feed pages/underlying-stats/index.tsx (feeds quadrant summary text)
  - Consumers: buildQuadrantSummary
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/underlying-stats/teamLandingDashboard.test.ts`
- **Leads (not audited):**
  - (opus) many magic thresholds (103/102 power, 0.12 goals/60 gap, 4x z weight, 6/7 inflation)

## M-UST-088 Narrative context bullet thresholds

- **Match:** Opus only; Opus UST-083; Codex —
- **Purpose:** Add one schedule/luck/finishing/goalie context sentence.
- **Where:** `web/lib/underlying-stats/teamRatingNarrative.ts:228 (buildContextBullet)`; `web/lib/underlying-stats/teamRatingNarrative.ts:395 (buildTeamRatingNarratives)`
- **Tags (heuristic):** generation: current
- **Opus view (UST-083):**
  - Method: Priority order: future SOS - league mean <= -0.015 softer / >= +0.015 tougher; PDO z >= 1 hot / <= -1 cold; finishing >= 105 / <= 95; goalie >= 105 / <= 95; else B2B count. No-baseline case compares sosFuture >= league mean directly.
  - Inputs/units: SOS fraction 0-1; z-score; ratings ~100; sources: —
  - Output scale: one bullet string; writes: —
  - Status: live — pages/api/underlying-stats/landing.ts and team-ratings.ts feed pages/underlying-stats/index.tsx
  - Consumers: narratives
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/underlying-stats/teamRatingNarrative.test.ts`
- **Leads (not audited):**
  - (opus) magic thresholds (0.015 point%, 105/95 rating) without sample-size gating

## M-UST-089 WGO team game aggregation (PP%, PK%, shots/game, FO%)

- **Match:** Opus only; Opus UST-086; Codex —
- **Purpose:** Aggregate per-game WGO team rows into period team special-teams and shot rates.
- **Where:** `web/lib/stats/percentUnits.ts:165 (aggregateWgoTeamGames)`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: per game; generation: current
- **Opus view (UST-086):**
  - Method: Exclude gp==0 rows; shots for/against per game = sum(per_game * gp)/sum gp; PP% = sum PPGF / sum PPO; PK% = 1 - sum PPGA / sum times shorthanded; PPO/game = sum PPO / games; FO% = FOW/(FOW+FOL); shot differential = SF/g - SA/g. Fractions 0-1.
  - Inputs/units: WGO per-game rows: shots_for/against_per_game (per game, weighted by games_played), PP/PK/SH counts, faceoffs won/lost; sources: wgo team stats rows written by web/lib/supabase/Upserts/fetchWGOdata.js
  - Output scale: PP%, PK%, FO% as fractions 0-1; shots per game; PPO per game; writes: —
  - Status: live — TeamDashboard.tsx:229, AdvancedL10Metrics.tsx:186/:227
  - Consumers: web/components/TeamDashboard/TeamDashboard.tsx:229; web/components/TeamDashboard/AdvancedL10Metrics.tsx:186 and :227 (L10/L5)
- **Audit context:**
  - Intent (Opus): web/lib/stats/percentUnits.ts:144-148 and :164 ('Full-sample totals over WGO game rows; only known zero-game rows are excluded')
  - External references: NHL.com PP% = PPG/PPO, PK% = 1 - PPGA/TSH
  - Fixtures/test data: `web/lib/stats/percentUnits.test.ts`; `web/components/TeamDashboard/AdvancedL10Metrics.test.tsx`
  - Tests: `web/components/TeamDashboard/AdvancedL10Metrics.test.tsx`; `web/lib/stats/percentUnits.test.ts`
- **Leads (not audited):**
  - (opus) PK% uses times_shorthanded; NHL net PK% variants also credit SH goals - definition choice should be stated

## M-UST-090 Team scope windows and minimum TOI

- **Match:** Opus only; Opus UST-089; Codex —
- **Purpose:** Last-N-games and min-TOI filters for team tables.
- **Where:** `web/lib/underlying-stats/teamStatsQueries.ts:867 (applyScopedRowWindow)`; `web/lib/underlying-stats/teamStatsQueries.ts:907 (applyMinimumToiFilter)`; `web/lib/underlying-stats/teamStatsQueries.ts:820 (fetchSummaryRows)`
- **Tags (heuristic):** generation: current
- **Opus view (UST-089):**
  - Method: gameRange: keep rows whose game_id is among the N highest game_ids across ALL fetched rows; byTeamGames: per team keep its N highest game_ids; dateRange in SQL. Min TOI drops teams with toiSeconds < minimum (seconds).
  - Inputs/units: N games; minimumToiSeconds (seconds); ISO dates; sources: team_underlying_stats_summary
  - Output scale: filtered rows; writes: —
  - Status: live — team_underlying_stats_summary written by pages/api/v1/db/update-player-underlying-stats.ts:242 and sweep-gamecenter-normalization.ts:352 (plus manual catch-up/backfill/rebuild routes); read by pages/api/v1/underlying-stats/teams.ts for /underlying-stats/teamStats
  - Consumers: pages/api/v1/underlying-stats/teams.ts; components/underlying-stats/TeamStatsFilters.tsx + teamStatsColumns.ts table
- **Audit context:**
  - Intent (Opus): tasks/TASKS/three-pillars-analytics/underlying-stats/prd/prd-team-underlying-stats-landing-page.md:23 (date range, game range and team-game range filters)
  - External references: NST last-N team games
  - Fixtures/test data: none listed
  - Tests: `web/lib/underlying-stats/teamStatsQueries.test.ts:271 (invalid date ranges)`
- **Leads (not audited):**
  - (opus) team 'gameRange' is league-wide (latest N games overall), not per team, unlike player gameRange which is per player
  - (opus) recency uses game_id order rather than date; rescheduled games break ordering

## M-UST-091 Team shot, goal, xG and danger counts per game-split

- **Match:** Opus only; Opus UST-091; Codex —
- **Purpose:** Per team-game counts for each strength x score state.
- **Where:** `web/lib/underlying-stats/teamStatsSummaryRefresh.ts:607 (accumulateTeamShotMetrics)`; `web/lib/underlying-stats/teamStatsSummaryRefresh.ts:969 (buildTeamUnderlyingSummaryRowsForGame)`; `web/lib/underlying-stats/teamStatsSummaryRefresh.ts:1245 (refreshTeamUnderlyingSummaryRowsForGameIds)`
- **Tags (heuristic):** denominators: per game, unblocked attempts, shots on goal; generation: current
- **Opus view (UST-091):**
  - Method: Excludes shootout. CF/CA = goal+SOG+missed+blocked (non-own-goal); FF/FA = unblocked; SF/SA = goal+SOG; GF/GA = isGoal (own goals included); xGF/xGA = sum heuristic xG; SC* = high\|medium danger; HD/MD/LD CF/SF/GF by bucket. 2 teams x 7 score states x 10 strengths = 140 rows per game, upserted in batches of 100 on (game_id,team_id,strength,score_state).
  - Inputs/units: shot features (feet, degrees, booleans); sources: games, nhl_api_pbp_events, nhl_api_shift_rows, nhl_api_game_roster_spots, nhl_api_game_payloads_raw (endpoint=landing), players, teams
  - Output scale: integer counts; xG in goals; writes: team_underlying_stats_summary
  - Status: live — team_underlying_stats_summary written by pages/api/v1/db/update-player-underlying-stats.ts:242 and sweep-gamecenter-normalization.ts:352 (plus manual catch-up/backfill/rebuild routes); read by pages/api/v1/underlying-stats/teams.ts for /underlying-stats/teamStats
  - Consumers: pages/api/v1/underlying-stats/teams.ts; components/underlying-stats/TeamStatsFilters.tsx + teamStatsColumns.ts table; pages/api/v1/db/rebuild-team-underlying-summaries.ts; pages/api/v1/db/catch-up-team-underlying.ts; pages/api/v1/db/backfill-team-underlying-season.ts
- **Audit context:**
  - Intent (Opus): tasks/TASKS/three-pillars-analytics/underlying-stats/prd/prd-team-underlying-stats-landing-page.md:64,66 (column list) and code comment web/lib/underlying-stats/teamStatsSummaryRefresh.ts:1192 (stale-key semantics)
  - External references: NST team counts (Corsi/Fenwick/shots/xG/SCF/HDCF)
  - Fixtures/test data: none listed
  - Tests: `web/__tests__/pages/api/v1/db/rebuild-team-underlying-summaries.test.ts (mocks refresh)`; `web/__tests__/pages/api/v1/db/update-player-underlying-stats.test.ts (mocks refresh)`
- **Leads (not audited):**
  - (opus) GF/GA include own goals but SF/SA exclude them, so team SV%/SH% derived later can be off
  - (opus) shot owner team is used for blocked shots (shooting team) — consistent with Corsi, but verify NHL owner convention for blocked-shot events
  - (opus) heuristic xG (see approximate xG entry) feeds xGF%

## M-UST-092 Game outcome and standings points (W, L, OTL, ROW, points)

- **Match:** Opus only; Opus UST-092; Codex —
- **Purpose:** Attach the game result to every team summary row.
- **Where:** `web/lib/underlying-stats/teamStatsSummaryRefresh.ts:781 (resolveGameOutcomeFromEvents)`; `web/lib/underlying-stats/teamStatsSummaryRefresh.ts:874 (resolveGameOutcomeFromOfficialPayload)`; `web/lib/underlying-stats/teamStatsSummaryRefresh.ts:909 (resolveGameOutcome)`; `web/lib/underlying-stats/teamStatsSummaryRefresh.ts:931 (buildStandingsOutcome)`
- **Tags (heuristic):** generation: current
- **Opus view (UST-092):**
  - Method: Prefer official payload: winner by score, outcome type from periodDescriptor/scoring/gameOutcome (REG/OT/SO). Fallback from events: max home/away score seen; OT/SO detected from period types. Winner: W=1, points=2, ROW=1 unless shootout. Loser: OT or SO -> OTL=1, points=1; else L=1. Tie/unresolved -> all zeros.
  - Inputs/units: scores (integers); period type strings; sources: nhl_api_game_payloads_raw (official landing), nhl_api_pbp_events
  - Output scale: W/L/OTL/ROW 0/1; points 0/1/2; writes: team_underlying_stats_summary
  - Status: live — team_underlying_stats_summary written by pages/api/v1/db/update-player-underlying-stats.ts:242 and sweep-gamecenter-normalization.ts:352 (plus manual catch-up/backfill/rebuild routes); read by pages/api/v1/underlying-stats/teams.ts for /underlying-stats/teamStats
  - Consumers: pages/api/v1/underlying-stats/teams.ts; components/underlying-stats/TeamStatsFilters.tsx + teamStatsColumns.ts table
- **Audit context:**
  - Intent (Opus): tasks/TASKS/three-pillars-analytics/underlying-stats/prd/prd-team-underlying-stats-landing-page.md:64 (W, L, OTL, ROW, Points, Point %)
  - External references: NHL standings (2 pts W, 1 pt OTL/SOL; ROW = regulation + OT wins)
  - Fixtures/test data: `web/lib/underlying-stats/teamStatsSummaryRefresh.test.ts:97-140 official payload fixtures`
  - Tests: `web/lib/underlying-stats/teamStatsSummaryRefresh.test.ts:96 (official payload shootout/OT/tied cases)`
- **Leads (not audited):**
  - (opus) event fallback cannot resolve shootout winners (scores tied in PBP) -> both teams get 0 W/L/pts for that game
  - (opus) playoff OT losses are recorded as OTL with 1 point (no playoff special-case)
  - (opus) identical standings are repeated on all 70 split rows per team-game, so split-filtered tables show W/L/points for games where the team merely had split time

## M-UST-093 Legacy NHL statsapi TOI parsing, TOI% and PP-time share

- **Match:** Opus only; Opus UST-093; Codex —
- **Purpose:** Parse mm:ss TOI to minutes and (legacy) chart a player's per-game TOI% and share of team PP time.
- **Where:** `web/lib/NHL/TOI.ts:82 (parseTime)`; `web/lib/NHL/TOI.ts:31 (fetchTotalPowerPlayTime)`; `web/lib/NHL/TOI.ts:71 (team PP TOI = sum/5)`; `web/lib/NHL/TOI.ts:93 (fetchTOIData)`; `web/pages/api/SustainabilityStats/[playerId].ts:141 (parseTime*60 consumer)`; `web/pages/api/CareerAverages/[playerId].ts:165 (consumer)`; `web/pages/api/Teams/[teamAbbreviation].ts:153 (consumer)`
- **Tags (heuristic):** percent scale: 0-100; denominators: per 60, per game; generation: legacy, current
- **Opus view (UST-093):**
  - Method: parseTime: if string contains '.', return Number(string) unchanged; else minutes = mm + ss/60. TOI% per game = TOI minutes*100/60. Team PP time per date = (sum of every current-roster player's PPTOI minutes on that date)/5; player PP share = player PPTOI / team PP time * 100. Callers convert parseTime output to seconds with *60.
  - Inputs/units: 'mm:ss' strings -> MINUTES (parseTime); strings containing '.' passed through unchanged (assumed minutes); callers multiply by 60 to get SECONDS; sources: statsapi.web.nhl.com /people/{id}/stats?stats=gameLog, statsapi.web.nhl.com /teams/{id}/roster
  - Output scale: parseTime: decimal minutes; fetchTOIData TOI: percent of 60 minutes (0-100+, OT can exceed 100); PPTOI: percent 0-100 of estimated team PP time; writes: —
  - Status: live — parseTime live — imported by pages/api/SustainabilityStats/[playerId].ts:8, pages/api/CareerAverages/[playerId].ts:6, pages/api/Teams/[teamAbbreviation].ts:17; fetchTOIData legacy/dead — no importer found and targets decommissioned statsapi.web.nhl.com
  - Consumers: parseTime: SustainabilityStats, CareerAverages, Teams/[teamAbbreviation] API routes; fetchTOIData default export: no importer found
- **Audit context:**
  - Intent (Opus): web/lib/NHL/TOI.ts:77-81 JSDoc ('Convert a time string to minutes. @param timeString mm:ss'); fetchTOIData UNDOCUMENTED
  - External references: NHL.com TOI mm:ss; NST TOI convention (seconds or minutes) and PP share = player PP TOI / team PP TOI
  - Fixtures/test data: none listed
  - Tests: none listed
- **Leads (not audited):**
  - (opus) fetchTOIData targets the decommissioned statsapi.web.nhl.com API and has no importer - dead code
  - (opus) TOI% divides by a fixed 60 minutes (OT games can exceed 100%)
  - (opus) team PP time estimated as sum of current-roster players' PPTOI / 5, which ignores traded/departed players and 5v3/4-skater units
  - (opus) parseTime returns minutes for 'mm:ss' but passes through any string containing '.' unchanged, so a decimal seconds string would be misread as minutes; no-colon strings give NaN
  - (opus) pages/api/toi.ts:163 defines a separate duplicate parseTime - divergent TOI parsers

## M-UST-094 xG explorer row builders (latest rolling window + supplemental sums)

- **Match:** Opus only; Opus UST-094; Codex —
- **Purpose:** Build player/team/goalie rows for the xG explorer.
- **Where:** `web/lib/underlying-stats/xgExplorer.ts:210 (sumByEntity)`; `web/lib/underlying-stats/xgExplorer.ts:229 (latestByEntity)`; `web/lib/underlying-stats/xgExplorer.ts:249 (xgPct)`; `web/lib/underlying-stats/xgExplorer.ts:335 (buildPlayerXgExplorerRows)`; `web/lib/underlying-stats/xgExplorer.ts:402 (buildTeamXgExplorerRows)`; `web/lib/underlying-stats/xgExplorer.ts:450 (buildGoalieXgExplorerRows)`
- **Tags (heuristic):** percent scale: fraction 0-1; generation: current
- **Opus view (UST-094):**
  - Method: Pick the latest rolling row per entity (max as_of_game_date, then game id); default window 10 games (pages/api/v1/underlying-stats/xg.ts). Transition and rebound fields are summed over all supplied game-aggregate rows. Team xG% = xGF/(xGF+xGA). expectedPrimaryAssists = shot-assist created xG. Values rounded to 6 dp. Sort: players by createdXg then ixg; teams by xG%; goalies by GSAx then rebound-control saved above expected. No xG is computed in xgExplorer.ts: it only reads precomputed nhl_xg_* aggregates (trained model documented elsewhere, e.g. tasks/TASKS/xg-model/docs/final-implementation-summary.md); INCLUDES/EXCLUDES of that model belong to the xG-model slice. Rounds to 6 dp and sums supplemental fields.
  - Inputs/units: rolling aggregates in goals (xG), counts; windowGames N (default 10); sources: nhl_xg_player_rolling_aggregates, nhl_xg_player_created_xg_rolling_aggregates, nhl_xg_team_rolling_aggregates, nhl_xg_goalie_rolling_aggregates, nhl_xg_transition_game_aggregates, nhl_xg_rebound_control_player_game_aggregates, nhl_xg_rebound_control_team_game_aggregates, nhl_xg_rebound_control_goalie_game_aggregates
  - Output scale: goals (6 dp); xG% fraction 0-1; writes: —
  - Status: live — pages/api/v1/underlying-stats/xg.ts feeds pages/underlying-stats/xg/index.tsx (xG Lab)
  - Consumers: pages/api/v1/underlying-stats/xg.ts; pages/underlying-stats/xg/index.tsx
- **Audit context:**
  - Intent (Opus): tasks/TASKS/xg-model/tasks-nhl-api-xg-model.md (xG model program); explorer contract UNDOCUMENTED
  - External references: MoneyPuck/Evolving-Hockey xG, GSAx
  - Fixtures/test data: `web/lib/underlying-stats/xgExplorer.test.ts inline rows`
  - Tests: `web/__tests__/pages/underlying-stats/xg/index.test.tsx`; `web/__tests__/pages/underlying-stats/xg/operations.test.tsx`; `web/lib/underlying-stats/xgExplorer.test.ts`
- **Leads (not audited):**
  - (opus) rolling-window xG (last N games) is shown beside transition/rebound totals summed over whatever game rows the route fetched — possible window mismatch
  - (opus) createdXg falls back to 0 when missing (zero-fill treated as data; coverage report warns separately)
  - (opus) expectedPrimaryAssists is a pure alias of shotAssistCreatedXg

## M-UST-095 xG explorer coverage ratios

- **Match:** Opus only; Opus UST-095; Codex —
- **Purpose:** Warn when supplemental xG coverage is sparse.
- **Where:** `web/lib/underlying-stats/xgExplorer.ts:254 (ratio)`; `web/lib/underlying-stats/xgExplorer.ts:262 (buildXgExplorerCoverageReport)`
- **Tags (heuristic):** percent scale: fraction 0-1; generation: current
- **Opus view (UST-095):**
  - Method: ratio = numerator/denominator (null if denominator 0); warning when supplemental=0 with sourceRows>0, or created/transition/rebound rows / source rows < 0.02.
  - Inputs/units: row counts; sources: —
  - Output scale: fractions 0-1; warning list; writes: —
  - Status: live — pages/api/v1/underlying-stats/xg.ts feeds pages/underlying-stats/xg/index.tsx (xG Lab)
  - Consumers: pages/api/v1/underlying-stats/xg.ts
- **Audit context:**
  - Intent (Opus): Warning text at web/lib/underlying-stats/xgExplorer.ts:283 and 294-296 (zero-filled fields are 'missing coverage', not production-authoritative)
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/underlying-stats/xgExplorer.test.ts`
- **Leads (not audited):**
  - (opus) 2% sparse threshold is a magic constant

## M-UST-096 Weighted heatmap performance grade

- **Match:** Codex only; Opus —; Codex core-370
- **Purpose:** Provide weighted heatmap performance grade for the identified consumer.
- **Where:** `web/components/PlayerStats/PlayerPerformanceHeatmap.tsx:119 calculatePerformanceLevel`
- **Codex view (core-370, calculation; Codex family 'player performance UI'):** Weighted heatmap performance grade
  - Formula: Weighted mean of available fixed-threshold percentile proxies; grade cuts are 90,75,60,40,25,10. TOI is converted from seconds to minutes; percentage values use display-unit conversion.
  - Purpose: Provide weighted heatmap performance grade for the identified consumer.
  - Inputs/units: Selected game stats; nonzero games played; fixed weights from 1.0 to 2.0.
  - Output scale: Elite, excellent, good, average, below-average, poor, very-poor or no-data.
  - Version/status: Local working tree on octoberBranch, read on 2026-11-10. HEAD changed during the inventory from d31dcb33f72d4c9d69b507874c388f0cd549fe2f to 11e4192d36ecc4ac4b338f9ab48e529c7049c618. This is a non-atomic local scan; deployment and persisted-data state are not verified. Referenced implementation files had no tracked/untracked status entry at the final status check.
  - Consumers: ["PlayerPerformanceHeatmap calendar and game details"]
- **Audit context:**
  - Intended contract (Codex core-370): Function signature and comments at web/components/PlayerStats/PlayerPerformanceHeatmap.tsx:119 calculatePerformanceLevel; independent product specification not verified.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `No dedicated test located in the bounded scan; no tests run.`
- **Leads (not audited):**
  - (codex:core-370) ["Calculation inventory only; no correctness or model-quality verdict."]

## M-UST-097 Radar pooled ratio percentages

- **Match:** Codex only; Opus —; Codex core-371
- **Purpose:** Provide radar pooled ratio percentages for the identified consumer.
- **Where:** `web/components/PlayerStats/PlayerRadarChart.tsx:242 ratioPercent`
- **Tags (heuristic):** percent scale: 0-100
- **Codex view (core-371, calculation; Codex family 'player performance UI'):** Radar pooled ratio percentages
  - Formula: 100*a/(a+b), or 100*a/b when totalIsPart; used for faceoff, shooting, SAT and USAT percentages.
  - Purpose: Provide radar pooled ratio percentages for the identified consumer.
  - Inputs/units: Finite success/part and rest/total counts; minimum attempts.
  - Output scale: Percentage points or null below required attempts.
  - Version/status: Local working tree on octoberBranch, read on 2026-11-10. HEAD changed during the inventory from d31dcb33f72d4c9d69b507874c388f0cd549fe2f to 11e4192d36ecc4ac4b338f9ab48e529c7049c618. This is a non-atomic local scan; deployment and persisted-data state are not verified. Referenced implementation files had no tracked/untracked status entry at the final status check.
  - Consumers: ["PlayerRadarChart derived skater statistics"]
- **Audit context:**
  - Intended contract (Codex core-371): Function signature and comments at web/components/PlayerStats/PlayerRadarChart.tsx:242 ratioPercent; independent product specification not verified.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/components/PlayerStats/PlayerRadarChart.test.tsx`; `Located only; not run for this inventory.`
- **Leads (not audited):**
  - (codex:core-371) ["Calculation inventory only; no correctness or model-quality verdict."]

## M-UST-098 Goalie aggregate SV%, GAA, xGA differential, danger splits and average distances

- **Match:** Codex only; Opus —; Codex underlying-goalie-aggregation
- **Purpose:** Create goalie stats API summaries.
- **Where:** `web/lib/underlying-stats/playerStatsLandingServer.ts:4893 mapLandingAggregationRowToApiRow goalie branch; :3420 accumulateGoalieShotFeatureBucketMetrics`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: per 60; generation: current
- **Codex view (underlying-goalie-aggregation, calculation; Codex family 'Underlying statistics'):** Goalie aggregate SV%, GAA, xGA differential, danger splits and average distances
  - Purpose: Create goalie stats API summaries.
  - Inputs/units: Aggregated goalie/danger counts, xGA, distances sum/count, TOI seconds
  - Output scale: savePct fractions; GAA=GA×3600/TOI; gsaa=xGA-GA; HD/MD/LD savePct/GAA/gsaa; shots/saves/xGA/GSAA/rush/rebound per60; average shot/goal distance feet.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown. Player summary payload format version is 1 at playerStatsLandingServer.ts:221; not a model-version identifier.
  - Consumers: goalieStatsServer.ts and goalie landing/detail/chart UI
- **Audit context:**
  - Intended contract (Codex underlying-goalie-aggregation): web/lib/underlying-stats/playerStatsLandingServer.ts mapping implementation and PlayerStatsLandingApiRow type.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `{"discovered_not_run": ["web/lib/underlying-stats/goalieStatsServer.test.ts", "web/lib/underlying-stats/playerStatsLandingServer.test.ts"]}`
- **Leads (not audited):**
  - (codex:underlying-goalie-aggregation) No runtime verification or correctness assessment performed.

