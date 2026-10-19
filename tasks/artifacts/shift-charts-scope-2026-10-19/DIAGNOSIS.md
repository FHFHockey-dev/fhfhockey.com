# update-shift-charts: "Invalid relationship roster scope for game 2026010007"

Date: 2026-10-19. Revision 2: follows Chef's R-1 to R-3 reads and TJ's preseason rule. Code-only work. No hosted DB, cron, API, NST or Yahoo requests were made.

TJ's rule: "I would like to be able to see Pre-season shift charts, but once regular season starts they should not be in the queue. If a user selects a date that is a preseason game they should be able to view it."

## Cause

- **The check.** `buildRelationshipRosterPositionMap` (`web/lib/projections/relationshipPlayerPosition.ts:110`) throws when a game's roster row list is empty or longer than 100.
- **Its input.** The rows are `nhl_api_game_roster_spots` filtered to the game's current `pbp_raw_payload_hash`. They are the PBP payload's `rosterSpots`, which the gamecenter normaliser accepts in a range of 0 to 100. So a game can be input-complete with no roster rows.
- **The game.** R-3 confirms that 2026010007 has 0 roster rows under any hash: its preseason PBP carried no roster spots.
- **Why a preseason game was in the queue.** `listPendingRelationshipGameIds` selects every current-season game. `selectPendingRelationshipGameIds` takes the oldest 16 pending games, and the run stops at the first throw.
  - Preseason ran 09-19 to 09-26 (65 games, R-2), so it always sorts first. One preseason game wrote its 39 rows, then 2026010007 stopped the run.
  - No regular-season game (season started 09-29) has had relationships materialised since then.

## Why run-projection-v2 returns 422 (corrected)

My first note blamed `projection_input_ingest`. **That was wrong.** R-1 shows it passes at 51/51.

The failing gates are:
- `projection_derived_v2`: no rows.
- `skater_derived_freshness`: 8 of 8 teams missing.
- `stale_goalie_game_rows`: 6 of 8 teams missing.

All three need recent `forge_*_game*` derived rows, and code reading confirms that the stuck relationship queue starves the derived build:

1. `build-projection-derived-v2` on a scheduled run (no date parameters) calls `listPendingProjectionDerivedDates`, which calls `selectPendingProjectionDerivedDates` (`lib/projections/derived/projectionDerivedQueue.ts:38`). That queue only returns a game whose relationship is current: `relationship_status = 'complete'`, a matching input fingerprint, and `SHIFT_RELATIONSHIP_ALGORITHM_VERSION`.
2. No regular-season game has a current relationship. The queue is therefore empty, and the route falls back to yesterday's date (`build-projection-derived-v2.ts:333-341`).
3. For each game, `readProjectionGameInputManifest` (`projectionDerivedPersistence.ts:177-185`) refuses it with "Projection input and relationship manifest is not complete". No derived rows are written, so the three gates fail.

The shift coverage gate passes because it checks the `shift_charts` rows against the raw shift manifest. It does not check the relationship status.

Once regular-season relationships complete, the derived queue picks up those dates on its own. Whether the derived build has its own backlog cap is in TJ's `build-projection-derived-v2.ts`, which I did not change.

## Fix (uncommitted)

### 1. Queue rule (`web/lib/projections/relationshipMaterialization.ts`)

- `selectPendingRelationshipGameIds` reads the game type from NHL game ID digits 5-6.
- Types 02 and 03 are always eligible.
- Type 01 (preseason) is eligible only while no regular-season game in the season's `games` rows has a status row. Status rows are all `input_status = 'complete'`, so the first status row on a regular-season game means that game was played and ingested.
- Other types, such as the All-Star game, are excluded.
- This uses only the data the selector already receives: no hardcoded date and no new query.
- The cut-over happens when the first regular-season game is ingested, not at puck drop. That is within a day of the start.

### 2. Viewing a preseason date (no change needed)

- `/shiftChart` (`pages/shiftChart.tsx` with `components/ShiftChart/data.ts`) loads the schedule, boxscore, shiftcharts and play-by-play live from the NHL APIs. It never reads `shift_charts` or the relationship status, so a preseason game is viewable whether or not it was queued.
- The only requirements are in `components/ShiftChart/model.ts`: the game is OFF or FINAL, and the NHL feed has plays and shifts. A game whose NHL shift feed is empty shows "Replay unavailable", as it would for any game type.
- The date-range matrix (`/drm`, `fetchAggregatedData.ts`) does read `shift_charts`, but only for types 2 and 3 by design. Preseason was never part of it.
- To store one preseason game on demand, the existing `POST /api/v1/db/shift-charts?gameId=<id>` still works. It bypasses the queue.

### 3. Empty roster no longer stops the run, for preseason only (`web/pages/api/v1/db/shift-charts.ts`)

- `fetchCurrentRelationshipRosterPositions` takes a new `allowEmptyRoster` flag. When the flag is set and there are 0 roster rows, it returns `null`.
- The loop passes `gameType === 1`. A preseason game with no roster spots is skipped and recorded as `{ gameId, reason: "preseason_without_roster_spots" }` in `skippedGames`. The field appears in the response body and the `cron_job_audit` details, and the run continues.
- Every other game type keeps fail-closed behaviour and still throws "Invalid relationship roster scope". On regular-season data, an empty roster is a real ingest fault.
- Why skip rather than materialise:
  - Without roster spots, no shift player can be bound to a position.
  - The status stays pending, so the game is retried if a later PBP snapshot adds roster spots.
  - A skipped preseason game takes a queue slot only until the regular season starts, after which rule 1 removes it.
- The skip doesn't add to `rowsAffected` and doesn't change the status table.

## Tests and commands (in `web/`)

| Command | Result |
|---|---|
| `npm test -- lib/projections/relationshipMaterialization.test.ts`, after the revised rule | passed: 19 tests |
| `npm test -- lib/projections/relationshipMaterialization.test.ts __tests__/pages/api/v1/db/shift-charts.queue.test.ts __tests__/pages/api/v1/db/shift-charts.audit.test.ts __tests__/pages/api/v1/db/shift-charts.transactional.test.ts lib/projections/relationshipPlayerPosition.test.ts lib/projections/derived` | **passed**: 10 files, 87 tests |
| `npx eslint` on the 4 touched files | passed: no output |
| `npx tsc --noEmit` | not run: no shared or exported types changed. The changed return type is file-local. |

Tests changed:
- **`relationshipMaterialization.test.ts`, new test: "queues preseason games only until a regular-season game has inputs".** It checks that preseason is queued before the regular season starts, and skipped once 2026020001 has a status row. The first revision's form of this test failed before that fix.
- **`relationshipMaterialization.test.ts`, the existing ordering test.** Its placeholder IDs 10/20/30 encode no game type, so they are now 2025020010/20/30. The assertions are unchanged.
- **`__tests__/pages/api/v1/db/shift-charts.audit.test.ts`, new `it.each` "handles an empty roster scope for game type $gameType".**
  - Type 1 returns 200 with `skippedGames` recorded and no persist.
  - Type 2 returns 500 "Invalid relationship roster scope for game 2026020007".
  - This test file already imports `update-shifts.ts`, but only imports it. I did not edit it.

## Release file list

1. `web/lib/projections/relationshipMaterialization.ts`
2. `web/lib/projections/relationshipMaterialization.test.ts`
3. `web/pages/api/v1/db/shift-charts.ts`
4. `web/__tests__/pages/api/v1/db/shift-charts.audit.test.ts`
5. `tasks/artifacts/shift-charts-scope-2026-10-19/DIAGNOSIS.md` (this note)

**TJ's files:** the fix needs none of `update-shifts.ts`, `run-projection-v2.ts`, `run-rolling-forge-pipeline.ts` or `build-projection-derived-v2.ts`.
- Item 3 does touch `shift-charts.ts`, which is a cron route. It had no uncommitted changes in this checkout when I edited it. If it is among TJ's "about 60 other cron routes", Chef should reconcile it before release.
- `update-shifts.ts` delegates to `delegatedShiftChartsHandler`, and the response only gains a `skippedGames` field.

**Frozen FORGE files and `fix-stale-forge-readers` files:** none touched.

## After release

- The first scheduled run should select only type-02 games, oldest first from 09-29, at 16 per run (cap 50 via `maxGames`). Roughly 20 days of regular-season games are pending, so the backlog takes several days at the default. A bounded catch-up with `maxGames=50`, run outside the scheduled times, needs TJ's approval.
- The derived build and then `run-projection-v2` should start passing once relationships cover the 7-day derived window.
