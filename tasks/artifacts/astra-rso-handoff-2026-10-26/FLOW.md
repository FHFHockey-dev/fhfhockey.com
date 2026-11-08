# RSO implementation flow at the checkpoint (octoberBranch cd73cbd69)

This describes what the code does, from a read-only map plus the orchestrator's checks. It doesn't claim untested behaviour works; verification status is per link. Paths are under `web/`. Abbreviations: **PR** = `pages/api/v1/roster-schedule-optimizer/`, **RSO** = `lib/rosterScheduleOptimizer/`, **YH** = `lib/integrations/yahoo/`.

Status legend:
- **L** = local tests only
- **D** = deployed in production (master 538100d41 unless stated)
- **V** = live behaviour observed
- **—** = none

## 1. Provider (Yahoo) or manual roster, plus league rules
- **Route `PR/provider.ts:9`** (POST):
  - Checks run in order: requireApiUser, then requireProviderSyncAccess.
  - Fantrax returns 409.
  - Body: `{provider:"yahoo", teamId, startDate, endDate, timeZone?, refresh}`. `refresh` is "manual" only if the body says so, else "auto". That pass-through is local only, in 3795abb43.
  - Calls `loadYahooPlanningSnapshot` and returns `{success, snapshot: PlanningSnapshot, capabilities: ProviderCapabilities, code?, retryAfterSeconds?, yahooDiet?, bridgeForecasts?}`.
  - Errors: curated YahooLiveDraftError, a timeout with retained-inputs copy, otherwise 503.
- **`YH/rosterPlanning.ts:286` loadYahooPlanningSnapshot:**
  - Reads `external_teams`/`external_leagues` and settings.
  - Reads up to 13 elapsed-day rosters (past-roster cache, then `rso_yahoo_past_lineups` when the diet is on, then Yahoo).
  - Runs in parallel: `loadPlanningData(…, {forgeDailyBridge:true, consumer:"rso"})`, today's roster (required), scoreboard, league_rosters, league and team.
  - **Availability scan** (:559–588): 25 per page, start 0..2000, 8 s budget. The 2026-10-26 real-account run measured 58 pages, about 64 Yahoo reads per snapshot.
  - **LeagueRules** (:489–496):
    - `acquisitionTiming` is "unknown" unless the diet is on and timing is inferred from weekly_deadline (TJ D6).
    - `periods` are set only when the weekly counter is verified.
    - `goalieMinimum.credited` comes from `wgo_goalie_stats`.
    - `capabilities.rules` is always false.
  - **Fallbacks:**
    - empty roster: 409;
    - failed optional reads become limitations;
    - unresolved identity: the player is skipped, with a limitation;
    - no scoreboard: opponent null;
    - no time zone: client zone, else UTC.
- **`RSO_YAHOO_DIET`** (`YH/yahooIdentity.ts:7`, "1" = on; **off in code and production**). When on:
  - process caches (settings 6 h, league facts 30 m, discovery 15 m, today roster 120 s);
  - the past-lineup table (migration **not applied**);
  - verified `fhfh_player_external_identities` instead of `yahoo_nhl_player_map_read`;
  - inferred timing;
  - the upkeep lease.
- **Confirmations** `YH/planningConfirmations.ts:27` (via `PR/yahoo-current-data.ts:27`): one roster read gives Starting/Not Starting via `applyProviderGoalieStarts`. It expires within 120 s, minus the provider's cache age. Failure returns 503.
- **Manager rules** `RSO/providerRules.ts:34` supplementProviderRules:
  - The provider wins; the manager fills unknowns.
  - Inferred timing can be overridden (local, 3795abb43).
  - Conflicting locks are not applied.
- **Manual setup:** `RSO/workspace.ts:188` defaultWorkspace/defaultRules (C2 LW2 RW2 D4 G2 UTIL1 BN4, timing unknown); name import `:286`; UI "Add or import roster" and "League rules and scoring" in `components/RosterScheduleOptimizer/RosterScheduleOptimizer.tsx`.
- **Tests:** rosterPlanning, yahooDiet, planningConfirmations (+Route), providerRules, workspace, dailyAcceptance.yahoo (34) and .manual (29).
- **Status:**
  - L for all.
  - D for base Yahoo planning.
  - **V partial:** the 2026-10-26 R1 real-account snapshot confirmed the Y1 limitation copy, complete discovery, unknown timing and goalie-minimum semantics, and roster mapping. R2–R4 and the weekly counter were **not** verified (WINDOW-RESULTS-2026-10-26.md).

## 2. Schedule and candidate pool
- **/schedule** `PR/schedule.ts:11` → `readRosterSchedule` (`lib/rosterScheduleData/query.ts:115`, table `roster_optimizer_team_games`). The client (`canonicalSchedule.ts:35`) requires `roster-team-games.v1` and data less than 36 h old, else "unknown".
- **/eligibility** `PR/eligibility.ts:6` → `readYahooEligibilityCache` (`yahoo_game_keys`, `fhfh_player_external_identities`, `fhfh_player_identities`, `yahoo_players`). Used only for retained Yahoo rosters.
- **/data** `PR/data.ts:9` (public GET, optional nonce): selectForecastServingSource, then loadPlanningData, then transport plus the bridge wire. Errors return 503 "saved manual workspace is preserved".
- **`lib/rosterScheduleData/planning.ts:62` loadPlanningData:**
  - Returns players, games, forecasts, baseline and participation sources, forecastManifest, evidence and matchupWeeks.
  - Inputs:
    - `roster_optimizer_team_games`, `fhfh_player_identities`, `teams`, `rosters` (planningInputs.ts:126);
    - `yahoo_matchup_weeks`;
    - `read_forge_game_revisions` RPC;
    - `yahoo_player_ownership_daily` + `yahoo_nhl_player_map_read`;
    - `games` + `skatersGameStats` (form).
  - Every player starts with availability unknown and eligibility unverified; optional read failures become limitations, never zero.
- **Candidate pool** `RSO/candidatePlanMetrics.ts:71`:
  - Filters out unverified eligibility, availability outside {free_agent, manager_available, waivers}, and players with no scheduled game.
  - Orders by `candidateHorizonPoints`, then games.
  - Defaults: 40 candidates, 160 evaluations, 12 proposals.
  - Runs via a worker (`hooks/candidateMetrics.worker.ts` → executeRosterPlanning).
- **Status:** L; D. The production smoke (2026-10-26 02:16Z release) returned 200 from /data with the bridge present, 32/32 teams and season rates readable.

## 3. Projections reaching RSO
- **Source** `lib/player-forecasts/forecastServingSource.ts:59`: if `PLAYER_FORECAST_NATIVE_CATALOG_HEAD_ID` is unset, it returns `{kind:"legacy", reason:"native_not_activated"}`. **Production shows this** (V: /data and /api/v1/start-chart smoke, 2026-10-25/26).
- **Native inputs** (planning.ts:85–108: contribution bundle and participation stores in `player_forecast_source_observations`) are loaded either way and resolved in `resolvePlanningContributions`. The use policy `RSO_USE_POLICY.reviews` is empty, so every non-bridge detailed FORGE row is denied (`use_not_approved`).
- **Bridge gate** planning.ts:195. All of these must hold: forgeDailyBridge, legacy source, no admitted revisions, no baseline sources, and `RSO_FORGE_DAILY_BRIDGE !== "off"`.
- **Bridge** `lib/rosterScheduleData/forgeDailyBridge.ts:576`:
  - Reads `forge_runs` (released, horizon 1, 7 days), `forge_player_projections`, `forge_goalie_projections` and `goalie_start_projections` (bound to team and season).
  - Optional reads: season rates, team strength, rest, tilts and daily-board evidence.
  - Unknown supplements stay null.
- **Proof guard** (local only: 9eb4f0d36 + cd73cbd69; **not released**):
  - `loadExternalInputProof` (`lib/projections/externalInputProof.ts:106`) runs at forgeDailyBridge.ts:585.
  - A run is proven by a captured `forge-run-inputs-v1` snapshot. Failing that, by an exact allowlisted `forge_runs.git_sha` (`verifiedForgeReleases.ts`, one entry 538100d41…) **with `invocations === "1"`** (:64).
  - Unproven runs are withheld. If none are proven, planning is schedule-only with a limitation.
- **Production reality** (bounded read, 2026-10-26): the 2 released runs since 02:16Z have no snapshot, and capture is off. Today, production serves the **unguarded** legacy bridge (pundit-free by the 538100d41 code).
- **Status:** L for the guard; D for the bridge without the guard; V for the source kind and the absence of snapshots.

## 4. Legal lineup optimization
- `RSO/planning.ts:619` evaluatePlan(snapshot, intent, "agp"|"outcome", steps, includeBenchEvidence) → PlanEvaluation.
  - Per-day `assign` (:374) uses exact max-weight matching (`lib/projections/weightedAssignment.ts:2`) over expanded slots (`slots.ts:28`), with eligibility from `eligibility.ts:85`.
  - Weights: "agp" = games×bonus + value; "outcome" = value.
  - Unknown-quality plays contaminate their slot component (:401–417).
  - Also handled: weekly windows, started games, and IR/out holds.
  - `projectedValue` is null on any unresolved play (:924).
- `planRoster` (:1250) uses "outcome" only if the no-move outcome is eligible, else "agp".
- `matching.ts` is used by Draft Dashboard/DUST, not the in-season planner.
- **Tests:** planning, planningReproducibility, dailyDecisionReplay, lineupGaps, optimizer.
- **Status:** L; D.

## 5. Drop/add evaluation
- `RSO/planningTimeline.ts:25` buildTimeline rejects:
  - unavailable adds;
  - unknown timing (`acquisitionEffectiveAt` returns null);
  - missing waiver clearance;
  - locks, uncovered periods, exceeded allowance and capacity breaches.
- Proposals come from `extensions` (planning.ts:1180): add, add+reserve and add+drop. Drops come only from `knownDropOrder` (`retention.ts:81`) and `dropEligible` (canDrop, not protected, reserved or out).
- **Reconciliation** `reconciliation.ts:5` checks against the effective-order timeline and is never silent on a timeline-illegal plan (3f127f485; 1,122-case invariant).
- **Healthy reserves** `healthyReserves.ts:54` (daily; policy 3A for the weekly lock).
- **Status:** L; D (through release 3/4).

## 6. Startable marginal gain
- `candidatePlanMetrics.ts:78–194`:
  - The baseline is the no-move outcome (points mode, comparison-eligible), otherwise the AGP baseline.
  - Per plan: `netAGP` (if the schedule is known), `netPoints` (both sides eligible), `netGoalieStarts` and `displacedPlayerIds`.
  - The dropped player's lost contribution comes from `contributionLedger.ts:25` (`lostAGP`/`lostPoints`, null if unknown).
  - Plan dominance pruning.
- A drop plan that isn't comparison-eligible is relabelled schedule-only ("fantasy-point cost is unknown").
- `gameForecastPoints` (planning.ts:108) is points-only, null unless every weighted stat allows totals. (There's no gameForecastPoints.ts module; only its test file.)
- `candidateActivePoints` (:255) and `candidateMetrics` (:1451) have no production caller.
- **Status:** L; D. With RSO's use policy denying native rows, real point comparisons depend on the interim bridge.

## 7. Displayed recommendation
- `useRosterPlanning` → worker → `executeRosterPlanning` (`RSO/executionAdapter.ts:10`). That calls `withCurrentPlanningRead` (re-fetches /data; for Yahoo, the `yahooPlanningReadBroker` → /yahoo-current-data), then planRoster, candidatePlanMetrics, healthyReserves and displaySnapshot. On read failure it falls back to `capacityPlanningSnapshot` (schedule-only).
- **Panels:**
  - Roster;
  - Optimized Week / Itinerary;
  - Best Fit Available (CandidateBrowser, with Plan alternatives);
  - Matchup (no move vs selected, sensitivity, goalie evidence);
  - Data health (limitations plus provider diagnostics);
  - "Why add/drop plans may be unavailable".
- **Status:** L; D; **V partial** (2026-10-26: the page loaded the Yahoo workspace once Chrome reported online; the Data health copy was read).

## 8. Refresh, save and reopen
- **Local** `RSO/workspace.ts`:
  - Per-principal keys plus an anonymous slot, a context key and `:undo` (≤20).
  - `migrateLegacyWorkspace` (:213) drops legacy device-wide data, keeping only the dates (TJ: ownerless).
  - `retainProviderInputs` (:267) drops availability and canDrop.
  - `retainedScheduleSnapshot` (:303) gives a provisional schedule-only input.
- **Account save** `PR/workspace.ts:123`:
  - GET reads `in_season_workspaces`.
  - PUT needs `rso_account_save`. It inserts, or updates with `lock_version` (a conflict returns 409).
  - Owner-only preservation mode.
- **Upkeep** (component :561–599):
  - 5-min interval, with backoff to 30 min and cooldown on 429/retryAfter.
  - Blocked on 401/403/reauth.
  - With the diet on, `claimRsoUpkeepLease` (`upkeepLease.ts:16`, 6-min lease). **C7 R39 Y1: a non-holder tab busy-loops; this must be fixed before the flag goes on.**
- **Refresh** (:529): retainProviderInputs, then `reconcileIntent(supplementProviderRules(…))`, giving a proposal. Selected moves are kept; Undo is at :375–390.
- **Offline flag:** RSO no longer blocks the first load or an explicit refresh on `navigator.onLine` (5356dc616, local only, **not released**). Production still has the stall when Chrome misreports offline (V 2026-10-26).
- **Status:** L (rso-continuity E2E 10/10 + 1 offline case; full RSO E2E 55/55 in two time zones); D through release 4 (except 5356dc616); V partial.

## Cross-cutting
- **Supabase objects:**
  - Read: `external_teams`, `external_leagues`, `yahoo_nhl_player_map_read`, `fhfh_player_external_identities`, `fhfh_player_identities`, `yahoo_game_keys`, `yahoo_players`, `roster_optimizer_team_games`, `teams`, `rosters`, `yahoo_matchup_weeks`, `yahoo_player_ownership_daily`, `games`, `skatersGameStats`, `wgo_skater_stats`, `wgo_goalie_stats`, `player_forecast_source_observations`, `native_forecast_catalog_heads`, `forge_runs`, `forge_player_projections`, `forge_goalie_projections`, `goalie_start_projections`, `wgo_skater_stats_totals`, `nhl_team_data`, `nst_team_stats`, `opponent_skater_allowed_by_position`, and RPC `read_forge_game_revisions`.
  - Read/write: `in_season_workspaces`, and `rso_yahoo_past_lineups` (diet; table not created).
- **Flags (names only):**
  - `RSO_YAHOO_DIET`, `RSO_FORGE_DAILY_BRIDGE`, `PLAYER_FORECAST_NATIVE_CATALOG_HEAD_ID`, `FORGE_NATIVE_SERVING_FALLBACK`, `PLAYER_FORECAST_BASELINE_RELEASE_IDS`, `PLAYER_FORECAST_*_PARTICIPATION_RELEASES` / `*_START_RELEASES`.
  - `STARTER_BOARD_SERVING_ENABLED` (prod false), `STARTER_BOARD_CANARY_GAME_IDS` (prod 1 game), `START_CHART_GAME_REVISIONS` (prod unset), `STARTER_BOARD_CAPTURE_ENABLED` / `STARTER_BOARD_COMPUTE_ENABLED` (prod: capture evidently off).
  - `PROVIDER_SYNC_PREMIUM_ENFORCEMENT_ENABLED`, `IN_SEASON_*`, plus Yahoo OAuth keys (values never read or recorded).
- **Yahoo endpoints** (read-only, `fantasy/v2`): league settings; `team/{key}/roster;date=`; `league/{key}/teams/roster/players`; `league/{key}/scoreboard`; `league/{key}`; `team/{key}`; `league/{key}/players;status=A;sort=OR;start=N;count=25/ownership`.
- **Not inspected:** Yahoo token storage, `resolveYahooGameContext`, `loadDailyBoardEvidence`, and the access tables.
