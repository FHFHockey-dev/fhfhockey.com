# FIELD-MAP: Yahoo field → in-house source → freshness → class

Classes:
- **A**: replace now with an in-house source of the same or better freshness.
- **B**: keep Yahoo, because it's league-specific truth.
- **C**: keep Yahoo but reduce how often or how widely it's read.

"In-house" includes FHFH's own server-side copies of global (not league) Yahoo data that one daily job reads for all users. Type line numbers refer to `web/lib/supabase/database-generated.types.ts`. Cron schedules come from `web/vercel.json` and `tasks/TASKS/cron-operations/cron-schedule.md` (production inventory, 2026-10-04); all are UTC. No DB queries were run: the Supabase MCP isn't authenticated, so the query log is empty (0 of 10).

## Already in-house (no Yahoo involvement today)

| Fact | Source | Writer / cadence | Used by |
|---|---|---|---|
| NHL schedule, games per day, start times, status, back-to-backs | `roster_optimizer_team_games` (types:27430), witness under 36 h old | `update-roster-optimizer-schedule-daily` → `lib/rosterScheduleData/persistence.ts:130`; Vercel `52 8,14 * * *` | `loadPlanningData`, `/schedule` |
| Live game state for today | `lib/NHL/server/scheduleDaily.ts` (NHL API at runtime) | n/a | Start Chart (`starterBoard.ts:94`) |
| Player identity, NHL id, name, class | `fhfh_player_identities` (types:3475) | DB functions plus player-forecast jobs | `planningInputs.ts:134` |
| NHL team assignment | `rosters` (is_current) + `teams` (types:27536, 30329) | `update-players` job 6 `0 2 * * *`; `update-teams` job 3 `0 0 * * *` | `planningInputs.ts:137–138` |
| Logos / abbreviations | `lib/teamsInfo.ts:15`, `public/teamLogos/*` | static | UI |
| Matchup week calendar (game-level) | `yahoo_matchup_weeks` (types:39988) | `update-yahoo-weeks` job 233 `20 7 * * *` | `planning.ts:81`, acquisition period (`rosterPlanning.ts:237`) |
| FHFH projections, goalie start probability | FORGE bridge, `goalie_start_projections` (types:6191) | job 364 `30 9 * * *` plus the FORGE pipeline | `forgeDailyBridge.ts:586` |
| Realized per-game stats for past points and goalie credit | `wgo_skater_stats`, `wgo_goalie_stats` | WGO jobs | `rosterPlanning.ts:37–133` |
| Global Yahoo default eligible positions | `yahoo_players.eligible_positions` (types:40391), valid only after the latest 08:40 UTC run | `update-yahoo-players` job 106 `40 8 * * *` | `/eligibility` → `yahooEligibilityCache.ts` (retained-roster path only) |
| Global Yahoo status / injury note | `yahoo_players.status`, `status_full`, `injury_note` (types:40395–40406) | job 106, daily | not used by RSO today |
| Injury state (non-Yahoo) | `player_status_history` (types:23442) | `update-player-statuses.ts:188`; no cron found | not used by RSO |

## Identity mapping (precondition for every swap)

| Fact | Today | In-house alternative | Finding |
|---|---|---|---|
| Yahoo player_key ↔ NHL id | `yahoo_nhl_player_map_read` (`rosterPlanning.ts:360`, `planningConfirmations.ts:59`, `starterBoard.ts:162`) | `fhfh_player_external_identities` (types:3403), verified rows, already used two-way by `yahooEligibilityCache.ts:26–33` and by live draft and FORGE universe | **`yahoo_nhl_player_map` has no scheduled writer.** Only the manual `populate_yahoo_nhl_mapping.py` writes it; `update-yahoo-players.ts:143–150` only counts its rows. New call-ups map to nothing, so they stay `unknown`. That's safe, but it caps every swap's coverage. Class **A**: move RSO and Start Chart identity resolution to the verified table (PLAN step 0, DECISIONS D8). |

## Per-field map

| Yahoo field (read) | Consumed at | In-house source | Freshness: Yahoo vs in-house | Class | Notes |
|---|---|---|---|---|---|
| `settings.league_key` (S1, B2) | `rosterPlanning.ts:303`, `starterBoard.ts:102` | — | — | B | Scope check; travels with whatever settings read remains. |
| roster slots, reserve slots (S1) | `liveDraft.ts:518`, `rosterPlanning.ts:429–433` | none | per read vs — | **B + C** | League truth. Cache with TTL (PLAN step 3). |
| scoring type, weights, categories (S1, B2) | `rosterPlanning.ts:436`, `starterBoard.ts:114–121` | none | — | **B + C** | Cache. |
| `roster_type`, `weekly_deadline` (S1, B2) | `rosterPlanning.ts:410`, `starterBoard.ts:111, 127` | none | — | **B + C** | Cache. See D6 on the timing inference. |
| `min_games_played` (S1) | `liveDraft.ts:521`, `rosterPlanning.ts:437` | none | — | **B + C** | Cache. |
| `max_weekly_adds` (S1) | `rosterPlanning.ts:249` | none | — | **B + C** | Cache, but the limit must be from the same TTL window as the counter's week. |
| `time_zone` (S1) | `rosterPlanning.ts:304` | Planning setup (client) | Yahoo usually omits it | B | Already falls back explicitly. |
| `draft_status` (S1) | `rosterPlanning.ts:347` | none | — | B | Message-only. |
| own roster scope (`team_key`, date, coverage, `is_owned_by_current_login`) (S2, C1, B1) | `rosterPlanning.ts:342`, `planningConfirmations.ts:43`, `starterBoard.ts:96–101` | none | — | **B + C** | Authority. Share one read across the three paths (PLAN step 2). |
| own `player_key` list (S2) | `rosterPlanning.ts:377, 391` | none | — | B | Owned roster. |
| `selected_position` (S2, S3, B1) | `rosterPlanning.ts:395, 458`, `starterBoard.ts:210` | none | — | B | Slot truth. |
| own `eligible_positions` (S2, B1) | `rosterPlanning.ts:397–406`, `starterBoard.ts:212` | `yahoo_players.eligible_positions` (daily) | same read vs daily | B | Free with S2, so there's no reason to swap. Also gives IR/IR+/NA reserve eligibility, which is league truth. |
| `is_undroppable` (S2, B1) | `rosterPlanning.ts:402`, `starterBoard.ts:226` | none | — | B | |
| `is_editable` (team + player) (S2, B1) | `rosterPlanning.ts:446`, `starterBoard.ts:221` | Game start from `roster_optimizer_team_games` / NHL API already combined | — | B | Lock truth. In-house start times already add the "started" lock. |
| own `status` / `status_full` / `injury_note` (S2) | `rosterPlanning.ts:157, 403` | `yahoo_players.status` (daily), `player_status_history` (no cron) | per read vs daily | B (free) | Comes with S2 at no extra cost. Keep it. |
| `starting_status` (S2, C1) | `rosterPlanning.ts:166, 404`, `planningConfirmations.ts:79` | `goalie_start_projections.confirmed_status` (daily plus FORGE) | per read vs daily | **B + C** | The contract keeps Yahoo marks. Reduce C1 with a memo and skip it when no goalie plays today (step 2, D5). |
| `editorial_team_abbr` (C1, B1) | `planningConfirmations.ts:82`, `starterBoard.ts:198` | `rosters` + `teams` | per read vs daily | A (cross-check only) | Used as a consistency guard, so keep reading it while the row is there anyway. |
| `name.full` (S2, S3, B1) | limitation text, past-lineup fallback, Start Chart names | `fhfh_player_identities.name` | — | **A** | Use the in-house name whenever identity resolves. Yahoo names only for unresolved rows. |
| past-day roster rows (S3) | `rosterPlanning.ts:315–329, 452–463` | none (recorded lineups are Yahoo truth) | immutable after the day | **B + C** | Persist once per day (step 6, D4). |
| scoreboard `week_start`/`week_end`, team `team_stats` (S4) | `rosterPlanning.ts:553–571` | `yahoo_matchup_weeks` for dates only; realized totals: none | — | B | League matchup truth. Could also replace S6 (step 4). |
| league_rosters: all teams' `player_key` (S5) | `rosterPlanning.ts:386–390, 569–570` | none | — | **B (expanded role)** | Becomes the authoritative owned set for inference (step 1). |
| `league.current_week` (S6) | `rosterPlanning.ts:235` | scoreboard `week` (S4), if present in real payloads | same read | **C (fold)** | Step 4 precondition. |
| team `roster_adds` (S7) | `rosterPlanning.ts:228` | team metadata inside S2 or S5, if present | same read | **C (fold)** | Step 4 precondition. Never infer the counter from transactions. |
| discovery `ownership_type` (S8, B3) | `rosterPlanning.ts:524`, `starterBoard.ts:283` | S5 owned set ⇒ "not rostered (FA or waivers unverified)"; then a targeted `players;player_keys=…/ownership` read for the top 50 | same freshness for the verified set | **C** | Step 1. Free agent vs waivers stays exact for verified players only. |
| discovery `waiver_date` (S8) | `rosterPlanning.ts:526` | targeted read | same | **C** | Exact for verified players only. Unverified players get no waiver time. |
| discovery `eligible_positions` (S8) | `rosterPlanning.ts:530` | `yahoo_players.eligible_positions` (daily, default positions) for pre-ranking; targeted read for verified players | daily vs per read | **A for ranking, B for actionability** | `eligibilityVerified` stays true only from a league-scoped read (as today). |
| discovery `status` / `injury_note` (S8) | `rosterPlanning.ts:525` | `yahoo_players.status` (daily) for unverified players; targeted read for verified players | daily vs per read | **A for display, C for verified** | Injury on unverified players is labelled with its daily `asOf`. |
| discovery `player_key` (S8) | `rosterPlanning.ts:509, 520` | `fhfh_player_external_identities` | — | **A** | Identity for the pool comes from in-house mapping, not from paging Yahoo. |
| B3 `name.full` | `starterBoard.ts:282` | `fhfh_player_identities` | — | A | |

## What must stay exact vs what can be narrowed

**Must stay exact, from a fresh league-scoped Yahoo read:**
- the owned roster, its slots, editability and droppability
- the league-wide owned set (league_rosters)
- free agent vs waivers and waiver-clear time for **any player the planner may action**
- the weekly add counter and limit
- league scoring and slots
- Starting/Not Starting marks used for authority
- recorded past lineups

**Can be narrowed:**
- Which unowned players get an exact free agent/waivers check: the top 50 by FHFH pre-rank plus manager-requested players, instead of all ~1,400 Yahoo rows. The rest are "not rostered, unverified": visible and rankable, never actionable.
- How often settings, scoreboard and the counter are re-read (TTL, upkeep split).

**"Unseen stays unknown" is preserved:**
- A player not in a complete league_rosters read is *seen* as not rostered, but the free agent vs waivers status stays unknown until a targeted read.
- A player FHFH can't uniquely map, or any player when league_rosters is incomplete or stale, stays `unknown`.
- Nothing infers "free agent" from absence alone, and nothing infers "zero adds left" from a missing counter.
