# Decisions for TJ: RSO Yahoo diet

Only owner calls are listed. Each has a recommended option. Implementation waits on these and on file leases from the orchestrator.

## D1. Can "not on any league roster" stand in for availability?
League rosters (one read) list every owned player in the league. A modelled NHL player who maps uniquely to Yahoo and is on no team's roster must be a free agent or on waivers. The read can't say which, or when waivers clear.
- **(Recommended) A. Two tiers.** Not on any league roster becomes a new state, `unrostered_unverified`: the player can rank and show as "likely available", but can't be actioned. Only the top ~50 candidates, plus any player the manager asks about, get a targeted Yahoo ownership read (25 players per read). That read sets exact free agent or waivers and the waiver-clear date, and only verified players become actionable. This matches the existing rule that only individually verified availability may be actionable (`rosterPlanning.ts:579`).
- B. Treat unrostered as actionable "available" without a targeted read. It's cheapest, but it would act on unverified free agent/waivers status and wrong waiver timing. Not recommended.
- C. Keep full discovery (status quo, about 58 reads).

## D2. Cadence for the full snapshot (auto-upkeep)
Today a visible tab re-runs the whole snapshot every 5 minutes, about 768 Yahoo reads an hour.
- **(Recommended) A. Split upkeep.** Every 5 minutes, refresh only the volatile league facts: today's roster plus league rosters, about 2 reads. Re-run targeted availability at most every 15 minutes, or when league rosters change. Settings, scoreboard and the weekly counter refresh every 30 minutes or on a manual refresh.
- B. Keep one full snapshot, but every 15 minutes.
- C. Keep 5 minutes for everything.

## D3. Server-side cache of league settings
Settings (slots, scoring, `min_games_played`, `max_weekly_adds`, `weekly_deadline`) rarely change mid-season.
- **(Recommended) A.** Cache parsed settings per league for 6 hours in server memory, bypassed by a manual refresh. It needs no new table and no writes.
- B. Persist settings to `external_leagues.roster_settings` / `scoring_settings` (existing columns, user-scoped row) with a 24-hour TTL. It survives cold starts but adds a production DB write path.
- C. No cache (status quo: one read per snapshot and per Start Chart load).

## D4. Persist elapsed-day lineups (S3)
Recorded lineups for past days never change, but they're cached only in instance memory: up to 13 reads per cold snapshot, more each day of the week.
- **(Recommended) A.** Add a private, service-role-only table keyed by (user, team, date) for elapsed-day lineups: player keys and slots only, no names. Purge it at season end. This needs a migration and RLS review, both approved separately.
- B. Keep the memory cache only (status quo).
- C. Stop reading past lineups. This loses goalie-minimum credit and past points. Not recommended.

## D5. Goalie Starting/Not Starting confirmation reads (C1)
One Yahoo roster read per planning execution, including every edit to the plan while today is in range.
- **(Recommended) A.** A per-(user, team, date) server cache of the today-roster read, valid while the existing 2-minute `expiresAt` lasts and shared with the snapshot's own today read (S2). Skip the read when no rostered goalie has a game today. Yahoo stays the source.
- B. Replace Yahoo marks with FHFH's own confirmed-starter data. It's in-house, but the contract treats Yahoo's Starting/Not Starting marks as Yahoo truth (B-class). Not recommended without a contract change.

## D6. Acquisition timing from `weekly_deadline`
Start Chart infers same-day or next-day adds from `weekly_deadline` (`starterBoard.ts:127`). RSO keeps it "unknown" and asks the manager. This isn't a Yahoo-read cost, but the two pages disagree.
- **(Recommended) A.** Keep RSO's "unknown, manager confirms" rule and align Start Chart to show its inference as unverified. This change goes in a separate small ticket.
- B. Let RSO adopt Start Chart's inference.

## D8. Which identity table RSO trusts for Yahoo ↔ NHL
`yahoo_nhl_player_map` (used by RSO, confirmations and Start Chart) is refreshed only by a manual Python script. Verified `fhfh_player_external_identities` already backs RSO `/eligibility`, live draft and FORGE.
- **(Recommended) A.** Move RSO, confirmations and Start Chart to verified `fhfh_player_external_identities` (PLAN step 0), after an offline comparison of both resolvers.
- B. Keep the legacy map, and schedule `populate_yahoo_nhl_mapping.py` as a cron. That's a new job, so production cron approval is needed.
- C. Keep the status quo. Unmapped call-ups stay unknown.

## D7. Rollout guard
- **(Recommended) A.** Ship behind a server flag. A one-tab, real-account window compares the new two-tier path (about 6–10 reads) against one legacy full-discovery snapshot (about 64 reads) on the same league, a budget of at most 80 reads. It records counts and agreement rates only, never names. It also records, from real payloads, whether the scoreboard carries the week and the roster carries `roster_adds` (PLAN step 4). Then switch on by default.
- B. Switch on directly after offline tests.
