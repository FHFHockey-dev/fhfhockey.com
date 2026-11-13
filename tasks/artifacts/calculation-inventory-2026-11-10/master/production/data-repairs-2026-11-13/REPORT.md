# F18 data repairs, 2026-11-13

Read-only investigation. Nothing was written to production and no route was run. Each of the two repairs below needs TJ's approval.

## Gap 1: Josh Mahura (8479372) missing from NST game logs on 11-07 and 11-12

**Cause.** The NST alias in `update-nst-gamelog.ts` maps "Josh Mahura" to "Joshua Mahura". The `players` row now reads "Josh Mahura", so the alias points at a name that no longer exists.
- NST still lists him as "Josh Mahura" with `playerid=8479372` (the retained Oct 1 fixture shows the same).
- The provider ID check found no candidate, so every dataset that listed him ended `parse_or_identity_unresolved`.
- He played no PP time on either date (WGO `pp_toi_per_game` 0). That is why the 4 PP datasets resolved and 16 of 20 did not.
- **Evidence:**
  - WGO vs `nst_gamelog_as_counts`: both have all 12 games from 10-01 to 11-04; only 11-07 (game 2026020267, SEA vs NYR) and 11-12 (2026020309, SEA vs CAR) are missing.
  - `update-players` writes `fullName` from the NHL roster, and it began real writes on 11-06 (it had been dry-running).
- **Inference, not proven:** that sync renamed the row from "Joshua Mahura" to "Josh Mahura" between the 11-04 and 11-07 runs. `players` has no updated_at column to confirm it.

**Same latent bug.** Joseph Veleno (8480813): the alias goes to "Joe Veleno", but the row reads "Joseph Veleno". His last NST game is 10-04, so his next game would fail the same way.

All other alias targets resolve today. "Nathan Legare" resolves through name normalization.

**Fix: commit `77a6e7592` (local, not pushed).**
- What changed: identity candidates are now the NST name plus its alias target, deduped by player id. The provider ID must still match one of them, so the fail-closed rule is unchanged.
- Why it works: an alias now holds whichever spelling the roster sync stores.
- The memo key now uses the raw NST name.
- Tests:
  - New unit test `getNstIdentityCandidates` covers both Mahura and Veleno spellings, dedupe, and an unmapped name.
  - The retained Oct 1 handler test now also runs with the row stored as "Josh Mahura". It **fails on the old code** and passes now.
- Checks: `update-nst-gamelog.test.ts` passed (111 tests). `npm run typecheck` exited 0. eslint on both files was clean.

**Re-fetch (needs TJ's approval).** Two calls on TJ's local dev server (`:3000` runs from this checkout, so it serves the fix). This needs no deploy and creates no Vercel usage. NST admission goes through the shared DB RPC, so local calls count against the same windows as production jobs.
1. Check first that no NST job is running.
2. `GET http://localhost:3000/api/v1/db/update-nst-gamelog?runMode=incremental&dates=2026-11-07&overwrite=yes`: 20 NST URLs, under 40, so it may burst; the route's `maxRequests` default of 40 caps retries.
3. Wait at least 60 s, then `...&dates=2026-11-12&overwrite=yes`: 20 URLs.
- Total: 40 NST requests (40/min, 80/5 min, 100/15 min, 180/h all hold).
- Stop condition: any 429/auth error, or a non-success audit.
- Readback:
  - Mahura rows on both dates in the 16 non-PP tables.
  - The run's audit should show `troublesomePlayersCount` 0 and `parse_or_identity_unresolved` 0.

## Gap 2: WiGO rejects Gawdin (8478446) and McCartney (8481827)

**Correction: 14 rows, not 2.**
- `calculate-wigo-stats` reads each player's last 20 games and stops at the first bad row, so the audit names only the newest null row.
- Gawdin has 12 rows with no game id, team, opponent or home/road: 2020-21 ×7, 2021-22 ×2, 2022-23 ×3. McCartney has 2 (2021-11-05, 2021-11-06).
- Fixing only the two reported rows would move the failure to the next row.
- Both players are in the current list because they just played (Gawdin 11-11 NYR, McCartney 11-12 UTA).

**Source.**
- `api-web.nhle.com/v1/player/{id}/game-log/{season}/2`, 4 GETs. Trimmed copies are in `nhl-api-gamelogs/`.
- All 14 rows match the NHL log on date, TOI to the second, goals, assists and shots.
- Gawdin was CGY in 2020-22 and ANA in 2022-23. McCartney was ARI.

**Statement.** In `wgo-legacy-identity-14-rows.sql`.
- One `DO` block sets `game_id`, `team_abbrev`, `opponent_team_abbrev` and `home_road`. It is keyed on id, player, date, season, TOI and all-NULL identity, and raises (changing nothing) unless exactly 14 rows match.
- Read-only dry check of the same predicate: 14 matched, 14 satisfy `wgo_skater_stats_game_identity_valid`, 14 distinct ids.
- WiGO frame check today shows 12 and 2 bad rows. Expected after: 0 and 0.
- `current_team_abbreviation` stays NULL: it records the team at scrape time, which the legacy writer never stored.

**Rollback limit.** The NOT VALID check `wgo_skater_stats_game_id_required` still applies to updated rows, so `game_id` cannot go back to NULL without dropping that constraint. Team, opponent and home/road can be reverted. A wrong game id would be corrected with another targeted UPDATE.

**Effect.** The next pg_cron 231 run (08:50Z) should write both players and audit `success`, if nothing else fails.

## Follow-ups (not done here)
- **Wider legacy WGO backfill.** Nearly every 2020-21 to 2022-23 WGO row lacks game identity; for example, 432 of 432 rows on 2021-02-20 and 2021-11-06. The legacy writer wrote no game id (C3 receipt, 2026-10-25). Any call-up whose last 20 games reach those seasons will trip WiGO the same way. That needs a bounded, approved backfill.
- **Other aliases with the old spellings.**
  - `lib/standardization/nameStandardization.ts:481` maps `joshmahura` to "Joshua Mahura".
  - `lib/sustainability/identity.ts:17` maps 8480813 to "Joe Veleno".
  - Consumers that look these up by `players.fullName` may now miss them. Not checked.
- The cache-failure fallback in `getPlayerIdByName` still queries only the alias target. It runs only for rows without a provider ID when the player cache fails to load.
