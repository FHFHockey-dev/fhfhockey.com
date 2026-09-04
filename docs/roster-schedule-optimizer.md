# Roster Schedule Optimizer

## Product behavior

The roster schedule optimizer measures how many scheduled player-games cannot fit into a fantasy lineup. The Draft Dashboard adds a passive `DUST +N` signal to available-player rows and, for elevated or high risk, may show a comparable lower-conflict alternative. Drafting remains immediate and unrestricted. The standalone page at `/roster-schedule-optimizer` evaluates a roster, supports add, remove, swap, and reset scenarios, and compares each scenario with the initially connected roster baseline.

Both surfaces use the pure TypeScript engine in `web/lib/rosterScheduleOptimizer`. They load the normalized team-game schedule in one bulk request and perform roster and candidate calculations in memory.

## Definitions

A **Bench Game** occurs when all of the following are true on a date:

1. A rostered, available player's NHL team has a countable scheduled game.
2. The player is eligible for at least one active fantasy slot.
3. No exact assignment of all scheduled rostered players to the configured active slots can start that player.

The assignment first maximizes the number of starters, then prefers the higher-valued players among equally large assignments. Bench, IR, IR+, NA, and other inactive slot capacities are not active lineup slots. Players explicitly marked IR, IR+, NA, or inactive are excluded from the avoidable-conflict pool. Unknown eligibility fails closed and is reported as an unresolved game instead of silently becoming a Bench Game.

**DUST** means **Daily Unstartable Schedule Tax**. Candidate DUST is an exact marginal count:

```text
DUST Games(candidate) = BenchGames(roster + candidate) - BenchGames(roster)
DUST Rate(candidate) = DUST Games(candidate) / candidate scheduled games
Active Games Added(candidate) = candidate scheduled games - DUST Games(candidate)
```

The roster-level DUST rate is total Bench Games divided by total scheduled player-games. Daily results are summed into Yahoo matchup weeks using inclusive week boundaries.

### Worked examples

With four RW-only players, two active RW slots, and all four NHL teams playing on the same date, the exact assignment starts two players and produces **two Bench Games**.

Multi-position eligibility changes the assignment graph; it is not a fixed discount. Suppose a C/LW player and an LW-only player play on a day with one C slot and one LW slot. Both can start by assigning the flexible player to C. Add a C-only player and the best assignment still starts only two of three players. Depending on the other players and slots, the C/LW eligibility can prevent one conflict, several conflicts, or none. It therefore cannot truthfully be modeled as “half the DUST.”

## Schedule cache and ingestion

`public.roster_optimizer_team_games` stores one row per Yahoo game key, NHL source game, and NHL team. Each NHL game therefore normally creates two rows. The stable unique identity `(game_key, source_game_id, team_id)` lets a reconciliation update dates, opponents, statuses, and matchup-week mappings after a reschedule without creating duplicates.

The table includes the Yahoo season/week, canonical NHL game date and start time, game/schedule status, countability, team/opponent identity, source URL/metadata, source timestamps, and fetch freshness. Indexes support game-key/week, game-key/date, team/date, and freshness reads. RLS is forced: anonymous and authenticated clients have read-only access, while only the service role can write. The application API still performs reads server-side.

`POST /api/v1/db/update-roster-optimizer-schedule` uses the existing operational-route authentication and cron audit wrapper. It reads `yahoo_matchup_weeks`, resolves the NHL season and teams, fetches the official NHL schedule, normalizes both team rows, maps dates to Yahoo weeks, excludes non-countable postponed/cancelled games, and upserts idempotently. A complete full refresh also deletes cache identities no longer present upstream; an incomplete club refresh explicitly skips deletion. Duplicate source IDs, unknown teams, season mismatches, unmapped games, reschedules, stale-row reconciliation, and skipped reconciliation are surfaced through warnings, logs, and the receipt.

The default bounded refresh covers two days behind through 21 days ahead and accepts at most 45 inclusive days. Full mode reconciles the entire season. `gameKey` defaults to `477` but remains an input rather than a schema constant.

`GET /api/v1/roster-schedule-optimizer/schedule?gameKey=477&startWeek=1&endWeek=30` returns the countable mapped rows in one bounded query with `latestFetchedAt`, `oldestFetchedAt`, row count, and cache version. Clients treat missing freshness or data older than 36 hours as stale and show an explicit state instead of reporting zero conflicts.

## Matchup-week mapping

Yahoo matchup boundaries come from `yahoo_matchup_weeks`. An NHL `gameDate` maps to a week when:

```text
week_start_date <= game_date <= week_end_date
```

Invalid dates, dates outside the selected weeks, and overlapping Yahoo week ranges remain explicitly unmapped. They are never guessed or counted as playable optimizer games.

## Shared engine

The domain package contains eligibility normalization, active-slot expansion, schedule indexing, inclusive week mapping, exact matching, roster evaluation, candidate marginal DUST, risk classification, alternative ranking, and stable cache signatures. It has no React, Next.js, Supabase, or network dependency.

Daily assignment is a deterministic maximum-cardinality bipartite matching between scheduled eligible players and active slot instances. A value-aware tie-break chooses starters without changing the maximum starter count. Daily results retain player, position, date, and week attribution for summaries and diagnostics.

The Draft Dashboard hook builds the canonical roster from the same drafted-player and keeper assignments used by the dashboard, filters to the user's team, uses the dashboard's roster configuration and VORP value metric, and recalculates from the already-loaded schedule whenever draft state changes. Its cache signature includes roster, slots, selected weeks, game key, lineup mode, and schedule version/freshness.

The standalone page uses the same evaluator and schedule endpoint. It accepts a configurable Yahoo game key, displays the daily-lineup assumption and active/bench capacity, preserves explicit connected-roster statuses such as IR, identifies highest-conflict dates, and explains open slots, benched players, and unresolved eligibility in daily details. Its roster and scenario controls never invoke a per-candidate server request.

## Recommendations and risk thresholds

Thresholds are centralized in `web/lib/rosterScheduleOptimizer/types.ts`.

| Risk | Minimum marginal games | Minimum DUST rate |
| --- | ---: | ---: |
| Moderate | 2 | 5% |
| Elevated | 4 | 10% |
| High | 7 | 15% |

Both the count and rate boundary must be met. Alternatives are considered only when they are currently available, are the same player class, overlap at least one meaningful non-UTIL active slot type, improve DUST by at least `max(2, ceil(candidate DUST × 25%))` Bench Games, and lose no more than 5% of the intended candidate's canonical value. Ranking prefers greatest DUST reduction, then best value difference, then value, with player ID as a deterministic tie-break.

## Research reconciliation

The research report preferred deriving the Yahoo-aligned cache from the existing `games` table. The implementation keeps the repository's official NHL client as the authority but fetches the richer club/daily schedule payload directly for this cache. This is a deliberate repository-based divergence: the current `games` schema and `update-games` route retain identity, date, start time, type, and teams, but not NHL game state, schedule state, source-update time, or diagnostic source metadata. Those missing fields are required to distinguish postponed/cancelled games and diagnose schedule changes without guessing. The optimizer table remains a cache rather than a competing browser-side source, and all writes remain behind the authenticated operational route.

The report also notes that the production Draft Dashboard route is currently covered by its existing maintenance notice. The DUST integration lives inside the canonical `DraftDashboard` component and is ready when that separate product-release gate is lifted; this feature does not bypass or replace the maintenance behavior.

No new feature-flag framework was introduced because the repository has no general rollout system for this surface. The row badge is passive and non-blocking. The current game key, week range, stale interval, cache version, risk boundaries, and recommendation boundaries are centralized and can be tuned without scattering literals through UI components.

## Testing

Focused unit coverage exercises eligibility, slot expansion, exact conflicts, value-aware ties, empty/no-game/unknown inputs, Yahoo boundaries, weekly aggregation, marginal DUST, displaced Bench Games, risk thresholds, recommendations, stable signatures, normalization, reschedules, and idempotent upserts. API tests cover auth, query validation, bounded reads, filtering, freshness, and structured errors. UI integration tests cover keeper/draft/undo recalculation, passive Draft behavior, low-risk rows, alternatives, and standalone scenario changes.

Run the focused suites from `web/`, for example:

```bash
npm test -- --run lib/rosterScheduleOptimizer/optimizer.test.ts
npm test -- --run lib/rosterScheduleData hooks/useRosterScheduleOptimizer.test.tsx
npm test -- --run __tests__/components/DraftDashboard/ProjectionsTable.test.tsx
```

## Operations

Apply the active migration through the repository's normal Supabase release process before enabling the UI against production. Do not publish a migration or schedule from a local verification run.

After deployment, run the initial full backfill with the configured cron bearer:

```bash
curl --fail-with-body --request POST \
  --header "Authorization: Bearer $CRON_SECRET" \
  "https://fhfhockey.com/api/v1/db/update-roster-optimizer-schedule?mode=full&gameKey=477"
```

Run a near-term reconciliation manually or from the existing pg_cron infrastructure:

```bash
curl --fail-with-body --request POST \
  --header "Authorization: Bearer $CRON_SECRET" \
  "https://fhfhockey.com/api/v1/db/update-roster-optimizer-schedule?mode=bounded&gameKey=477"
```

An explicit incident range can add `startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`. Inspect the returned mapped/unmapped counts and the `update-roster-optimizer-schedule` entry in `cron_job_audit`/the cron report. A practical production cadence is a daily bounded refresh plus a less frequent full-season reconciliation; activate that cadence only after the migration, initial backfill, and bounded probe succeed.

## Assumptions and extension points

- Exact daily assignment is the production calculation. Weekly-lock leagues currently return an explicit `WEEKLY_LINEUP_UNSUPPORTED` diagnostic rather than pretending daily assignment is equivalent; real-league lineup-mode validation is still required.
- The canonical NHL `gameDate`, not a locally shifted start timestamp, determines the scoring date.
- Yahoo roster imports require explicit player-ID joins. Ambiguous name-only matches are not accepted; manual roster construction remains available.
- The official schedule and Yahoo week table must use current team mappings. Relocations and abbreviations should be updated through those sources, not hardcoded in UI.
- Postponed and cancelled games are non-countable until the authoritative source supplies a valid playable schedule.
- Risk and value-loss thresholds are initial product defaults and should be validated against real league behavior.

Future work can add a verified weekly-lock assignment model, selected-week controls beyond the default range, schedule-change notifications, historical DUST calibration, persisted user scenarios, or a global multiweek optimization objective. Those extensions should continue to use the same normalized schedule cache and domain package.
