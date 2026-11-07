# PLAN: cut RSO and Start Chart Yahoo reads to what only Yahoo knows

Phase 2 proposal. Nothing here is implemented, and every step needs TJ's approval (DECISIONS-FOR-TJ.md) plus file leases from the orchestrator. Savings are per provider snapshot against the measured 64 reads (6 base + 58 discovery). Contract invariants held by every step:
- League availability stays current and league-scoped, and only individually verified free agent or waivers status is actionable.
- Global Yahoo ownership is context only. Unknown is never zero. Unseen stays unknown.
- Saved or client-supplied labels never mint authority.
- Integration stays read-only.

## Target budget

| | Today | After steps 1–4 |
|---|---|---|
| Snapshot on open or manual refresh | 64 (up to 100) | **5–8**: settings 0–1 (cached), today roster 1, league_rosters 1, scoreboard 1, targeted ownership 2–3, past days 0 after the first read |
| Auto-upkeep per open hour | ~768 | **~30–40** (step 5: 12 × 2 volatile reads, plus 4 × 2–3 targeted, plus 2 × 1 settings/scoreboard) |
| Goalie confirmation per plan edit | 1 | 0 while the cached today roster is inside its 2-minute window; 0 when no rostered goalie plays today |
| Start Chart load | 2–6 | **2–3**: roster 1, settings 0–1 (cached), targeted ownership 1 |

## Ordered swaps

### Step 0. Identity from the verified in-house table (precondition, 0 Yahoo reads saved)
- **Why.** Every swap below resolves Yahoo keys to FHFH players. Today that goes through `yahoo_nhl_player_map_read`, whose base table has no scheduled writer: only the manual `populate_yahoo_nhl_mapping.py` writes it, and `update-yahoo-players.ts:143–150` only counts its rows. Unmapped call-ups stay `unknown`. That's safe, but it caps coverage for step 1. The RSO `/eligibility` cache already resolves two-way through verified `fhfh_player_external_identities` (`yahooEligibilityCache.ts:26–33`).
- **Change.** Replace the three mapping reads (`rosterPlanning.ts:358–375`, `planningConfirmations.ts:59–73`, `starterBoard.ts:160–187`) with one shared two-way resolver over verified `fhfh_player_external_identities`, keeping the uniqueness rule in both directions.
- **Tests.** `rosterPlanning.test.ts`, `planningConfirmations.test.ts`, and the starter-board tests. The cases: ambiguous in either direction ⇒ unresolved; an unverified row is ignored; another season's key is ignored.
- **Savings.** 0 Yahoo reads, but it raises step 1's match coverage.
- **Risk.** Medium, because identity authority changes (D8). Run a one-off offline comparison of both resolvers on the same keys before switching.

### Step 1. Two-tier availability replaces full discovery (biggest saving)
- **Change.** Drop the S8 page loop (`rosterPlanning.ts:477–533`). Instead:
  1. From S5 (already read), build `ownedKeys` for the whole league. Require a fresh read, matching `league_key`, and every team's `count` equal to its rows; otherwise the league is "unverified" and every non-owned player stays `unknown`.
  2. Mark each catalog player that maps uniquely to Yahoo (the existing two-way `resolve`, :376) and isn't in `ownedKeys` as `unrostered_unverified`. This is a new non-actionable availability value: the candidate filters at `candidatePlanMetrics.ts:101` and `planning.ts:1168` still exclude it. Unmapped or ambiguous players stay `unknown`.
  3. Pre-rank the `unrostered_unverified` pool on the server with the planner's own signals (`candidateHorizonPoints` and the scheduled game count from `candidatePlanMetrics.ts`), with a position-balanced pick like `shortlist` (`planning.ts:1164`). Positions for this ranking only come from `yahoo_players.eligible_positions`, the daily job 106 cache that `/eligibility` already reads. They are not marked `eligibilityVerified`. Take the top 50: the planner's 40-candidate cap (`candidatePlanMetrics.ts:74`) plus a margin.
  4. Verify them with `fetchYahooBoardResource({ type: "availability", playerKeys })` (`providerClient.ts:179`; it exists but has no production caller yet), 25 keys per read, so 2 reads. Accept a page only if it's fresh, `league_key` matches, and each requested key comes back exactly once. Then set `free_agent` or `waivers`, `waiverClearsAt`, `injury` and Yahoo `eligible_positions` exactly as the loop does today (:524–532). A returned `ownership_type: team` is `rostered`; anything missing stays `unknown`.
  5. On demand: a new `requestedPlayerIds` verify path (an extension of the `yahoo-current-data` body, or a small sibling route) verifies players the manager searches for, at most 25 per read with a per-user rate limit.
- **Evidence and diagnostics.** Keep the `discoverySummary` shape, but report "league rosters: N owned; unrostered pool: M; verified: K of 50; unverified pool remains non-actionable". `capabilities.availability` becomes true only for the verified set, and the existing limitation "Only individually verified availability may be actionable" stays.
- **Files.** `web/lib/integrations/yahoo/rosterPlanning.ts`, `web/lib/rosterScheduleOptimizer/planningTypes.ts` (new availability value), `candidatePlanMetrics.ts` / `planning.ts` (allow-lists stay unchanged, plus a test asserting the new value is excluded), and the RSO UI copy for "likely available, not verified".
- **Tests.** Extend `web/lib/integrations/yahoo/rosterPlanning.test.ts`:
  - S8 is never called.
  - Incomplete league_rosters ⇒ every non-owned player is `unknown`.
  - An unmapped or ambiguous identity ⇒ `unknown`.
  - Targeted page with a missing key, a duplicate key, the wrong league or a stale response ⇒ `unknown`.
  - `ownership_type: team` on a targeted row ⇒ `rostered`.
  - Waiver date parsing is unchanged.
  - Only verified rows reach the candidate filters.

  Also extend `dailyAcceptance.yahoo.test.ts` (unseen stays unknown) and add one `candidatePlanMetrics` case for `unrostered_unverified`.
- **Savings.** −58 + 2 = **−56 reads per snapshot**, plus up to 25 extra on a cold full-list league.
- **Risk.** Medium.
  - A good candidate outside the pre-ranked 50 shows as "likely available, unverified" instead of actionable; the on-demand verify covers it.
  - Waiver timing is exact only for verified players.
  - The new availability value has to stay out of every actionable allow-list (guarded by tests).
  - Players Yahoo lists but FHFH doesn't model (569 in the 10-26 run) were never usable, so nothing is lost there.

### Step 2. Share and cache today's roster read (S2, C1, B1)
- **Change.** A server-side per-(user, team, date) memo of the `team/{tk}/roster;date=today` response, valid while `providerFresh` holds (Age ≤ 60 s, Date within 120 s). `loadYahooPlanningConfirmations` and `loadYahooStarterBoard` reuse it. Skip C1 entirely when no rostered goalie's team plays today (FHFH schedule). Freshness checks and the 2-minute `expiresAt` ceiling are unchanged; the expiry still comes from the original response's `Date` and `Age`.
- **Files.** A new tiny cache module in `web/lib/integrations/yahoo/`; `planningConfirmations.ts`, `rosterPlanning.ts:332`, `starterBoard.ts:91`.
- **Tests.** `planningConfirmations.test.ts`, `planningConfirmationRoute.test.ts`: a reuse within the window makes no second fetch, an expired memo forces a fetch, the cache key includes the user (no cross-principal reuse), and no goalie game today means no fetch.
- **Savings.** 0 on a cold snapshot; removes most C1 reads (1 per plan edit becomes about 1 per 2 minutes, at most), and B1 when Start Chart opens within the window.
- **Risk.** Low. The cache is process-local and keyed by user; it never crosses principals or lengthens authority.

### Step 3. Cache league settings (S1, B2)
- **Change.** Per D3: cache the parsed `parseYahooBoardSettings` result plus `max_weekly_adds`, `time_zone` and `draft_status` per (user, league), with a TTL; a manual "Refresh provider" bypasses it. RSO's freshness flag (`fresh`, :352) today depends on S1 being fresh. Split it: roster freshness keeps gating locks and eligibility, and settings carry their own `asOf` in evidence. Never claim settings are "fresh" when they come from cache.
- **Files.** `rosterPlanning.ts` (:302–306, :352, :409), `starterBoard.ts:92`, plus the D3B persistence path if chosen.
- **Tests.** `rosterPlanning.test.ts`: the second snapshot inside the TTL makes no settings fetch; a manual refresh refetches; cached settings don't mark the roster stale or fresh; limitations name the settings `asOf`.
- **Savings.** −1 per snapshot after the first in each TTL window, and −1 per Start Chart load.
- **Risk.** Low to medium. Mid-season settings edits (rare) show up after the TTL or a manual refresh, and the evidence states that.

### Step 4. Fold `league` (S6) and `team` (S7) into reads already made
- **Change.** Take `current_week` from the scoreboard's league-scoped `week` (S4), and `roster_adds` from our team's metadata in the today-roster response (S2) or league_rosters (S5). **Precondition:** first confirm from real Yahoo payloads (in the D7 window) that both fields are present there. The repo has no recorded real payload proving it; test fixtures are synthetic. Fall back to S6/S7 if a field is absent.
- **Alternative if the precondition fails.** Use Yahoo's `league/{lk};out=settings,scoreboard` to fetch both in one read. That would need a new explicit resource in `providerClient.ts`, and its exact shape also needs verifying.
- **Files.** `rosterPlanning.ts:220–265, 330–340`, `providerClient.ts` (only for the alternative).
- **Tests.** `rosterPlanning.test.ts` acquisition cases (:56–127) re-pointed to the new source, keeping every existing scope, freshness and coverage rule; a missing field means the counter is unknown (never 0 and never unlimited).
- **Savings.** −2 per snapshot (−1 if only one folds).
- **Risk.** Medium, because the weekly counter is league truth. It must keep `coverage_type: week`, matching week and contained-horizon checks.

### Step 5. Split auto-upkeep cadence (largest saving per hour)
- **Change.** Per D2: the timed upkeep re-reads only the volatile facts (today roster plus league_rosters) and re-runs targeted ownership only when the owned set changed or 15 minutes have passed. Settings, scoreboard and the counter refresh every 30 minutes or on a manual refresh. This needs a provider request mode (`body.scope: "upkeep" | "full"`) and server code that merges the volatile reads into the last full snapshot's facts while keeping each fact's own `asOf` in evidence.
- Also add a cross-tab guard: a `BroadcastChannel` or `localStorage` lease so only one visible RSO tab per principal and league runs auto-upkeep. The 10-26 window doubled reads with 2 tabs.
- **Files.** `web/components/RosterScheduleOptimizer/RosterScheduleOptimizer.tsx` (:43, :560–586; this is a hot file, so lease it with care), `provider.ts`, `rosterPlanning.ts`.
- **Tests.** `__tests__/components/RosterScheduleOptimizer/RosterScheduleOptimizer.test.tsx` upkeep timing with fake timers; a second tab doesn't upkeep; the provider route rejects an unknown scope.
- **Savings.** About 768 → 30–40 Yahoo reads per open hour (with steps 1–3).
- **Risk.** Medium, from state merging. Each fact must carry its own `asOf`, and nothing older than its class's refresh window can be shown as current.

### Step 6. Persist elapsed-day lineups (S3)
- **Change.** Per D4A: a private service-role table (user, team, date → player keys and slots; no names). Read it before calling Yahoo, and write only after a fully verified read of an elapsed day.
- **Files.** A new migration (check which migration tree applies first), `rosterPlanning.ts:315–329`, and an RLS review.
- **Tests.** `rosterPlanning.test.ts`: a stored day isn't refetched; today is never stored; a partial read isn't stored; rows are scoped by user.
- **Savings.** 0–13 per cold snapshot. Averaged over a week that's about 3 per snapshot, and up to 6 late in the week.
- **Risk.** Low to medium: it's a new private-data table, so it needs a privacy review and a season-end purge.

### Step 7. Start Chart streaming shortlist (B3)
- **Change.** Replace Yahoo's first-100-by-OR pages with league_rosters (1 read), then FHFH-forecast-ranked unrostered players for today, then one targeted ownership read for the top 25 (the step 1 machinery). The streaming scope label changes from "first 100 Yahoo-ranked" to "top 25 FHFH-ranked, verified".
- **Files.** `web/lib/integrations/yahoo/starterBoard.ts:233–300`, `components/StarterBoardYahoo.tsx` (copy).
- **Tests.** The `starterBoard` tests (in the nearest existing file): an unverified row is never in `streaming`, a stale targeted page gives "unknown" availability, and `scopeLabel` is updated.
- **Savings.** −4 + 2 = −2 per load at most. The bigger gain is quality: candidates come from FHFH projections, not Yahoo's own ranking.
- **Risk.** Low.

## Not swapped: Yahoo-only, stays exact (B-class)
These are listed in FIELD-MAP:
- league settings, scoring and roster slots
- owned roster with selected slots, editability and `is_undroppable`
- league rosters (who owns whom)
- free agent vs waivers and waiver-clear time for verified candidates
- the weekly `roster_adds` counter and `max_weekly_adds`
- Starting/Not Starting marks
- scoreboard matchup totals and the opponent
- recorded past lineups
- league Yahoo eligible positions (verified per player at read time)

## Already in-house today (no Yahoo reads involved)
These already come from `loadPlanningData`, the WGO tables and `/schedule`; none of them calls Yahoo at runtime:
- schedule, games and back-to-backs (`roster_optimizer_team_games`, refreshed twice daily)
- team assignment (`rosters` + `teams`)
- identity (`fhfh_player_identities`)
- FHFH projections and goalie start probabilities
- matchup week dates (`yahoo_matchup_weeks`)
- NHL per-game stats

Steps 0–7 add no Yahoo dependency for them. The swaps instead extend in-house use to names, pool identity and pre-rank positions.

## Sequencing and verification
0. Step 0 (identity), behind its offline comparison.
1. Steps 2 and 3 (low risk, independent files except a shared touch of `rosterPlanning.ts`). Give them one lease, or do them in order.
2. Step 1, then step 7 (reuses step 1's targeted verifier).
3. Bounded real-account window (D7): verify step 1's agreement, and step 4's preconditions.
4. Step 4, then step 5 (the UI hot file goes last), then step 6 (needs migration approval).

Each step runs its nearest Vitest file, then `npx tsc --noEmit`, then lint on touched files. Nothing goes to production without the approved window, and nothing is deployed in Phase 2 without explicit authorization.
