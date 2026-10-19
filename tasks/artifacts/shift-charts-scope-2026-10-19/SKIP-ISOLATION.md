# update-shift-charts: per-game skip isolation

Date: 2026-10-19. TJ approved this ("Yes: have the shift-charts session add skip-and-continue isolation to update-shift-charts for empty feeds and stale-input fingerprint mismatches, with tests, uncommitted.").

Uncommitted. No hosted, API, cron or NHL calls. `relationshipMaterialization.ts` was not needed and is unchanged.

## Behaviour

The loop in `fetchAndStoreShiftCharts` (`web/pages/api/v1/db/shift-charts.ts`) now handles one game at a time.

**1. Live shift feed.** The live NHL shift feed is fetched first.
- An empty feed (0 rows) records `{ gameId, reason: "shift_feed_unavailable" }`. It costs 1 NHL request, reads no PBP and writes nothing.
- A feed that has rows but no shift intervals (typeCode 517) still throws, as before.

**2. Play-by-play and roster.**
- The PBP final check and the season identity check are unchanged and fail-closed.
- The preseason empty-roster skip (`preseason_without_roster_spots`) is unchanged.

**3. Fingerprint mismatch.** `upsertShiftChartData` is wrapped in a check for these two messages from `persistShiftChartRelationships`:
- "PBP source fingerprint does not match projection inputs for game N"
- "Shift source fingerprint does not match projection inputs for game N"

The match is an exact regex, `STALE_INPUT_FINGERPRINT`. Either message records `reason: "projection_inputs_stale"` and the loop continues. Both checks run before the `persist_shift_chart_relationships_v1` RPC, which is the route's only write, so nothing is written for that game.

**4. Still fail-closed.**
- an empty roster on a non-preseason game
- "Raw PBP snapshot does not match relationship roster"
- `SHIFT_RELATIONSHIP_RAW_SNAPSHOT_STALE` and every other RPC error
- PBP not final, and season mismatch
- shift team identity, and missing intervals

On any of these, the run stops and the response names `failedGame: { gameId, message }`.

## Queue order and bounds

- **Over-read.** Skipped games stay pending and sort first. The route therefore reads the queue as `selectPendingRelationshipGameIds({ maxGames: maxGames + 64 })`, so `relationshipMaterialization.ts` is unchanged.
- **Counting.** Only processed games count against `maxGames`. Processed means materialised, including idempotent ones.
- **Stops.** The run ends at `maxGames` processed, at 64 skips (`skipBudgetReached: true`), or when the queue runs out.
- **Cost of skips.** At most 64 skips per run:
  - an empty-feed skip costs 1 NHL request;
  - a stale-fingerprint skip costs 1–2 shiftcharts pages plus 1 PBP request.
- **Today's backlog.** 0006–0053 is about 48 empty feeds, which fits inside one run's budget. A run with `maxGames=50` steps over them and processes from 0054 onward.
- **Note on the budget.** Once more than 64 skipped games sit ahead in the queue, a run makes no progress and returns 200 with `skipBudgetReached: true`. Ingesting those dates again or a feed recovery clears them, or the constant can be raised.

## Response and audit

| Case | HTTP | `success` | Audit status |
|---|---|---|---|
| All candidates processed, or some skipped and none failed | 200 | `true` | `success` |
| A fail-closed guard throws | 500 | `false` | `error`, with the route's own audit row; the delegated `update-shifts` / `withCronJobAudit` path records `failure` |

- **Status on skips.** 200 matches the existing preseason skip.
- **Why `withCronJobAudit` records success.** It treats a body with `success: true` as success (`inferFailure` returns at `b.success === true`), and the success message has no "fail" or "error" text.
- **New response fields:** `gamesProcessed`, `skippedGames` (with reasons), `skipBudgetReached` and `failedGame`, plus the existing row counts. The audit `details.context` carries the same fields.
- **Skipped versus failed.** These read separately: skips are listed, and a failure is the single `failedGame`.

## Tests (in `web/`)

| Command | Result |
|---|---|
| `npm test -- __tests__/pages/api/v1/db/shift-charts.queue.test.ts __tests__/pages/api/v1/db/shift-charts.audit.test.ts __tests__/pages/api/v1/db/shift-charts.transactional.test.ts lib/projections/relationshipMaterialization.test.ts lib/projections/relationshipPlayerPosition.test.ts` | **passed**: 5 files, 63 tests |
| `npx eslint` on `shift-charts.ts` and the 2 changed tests | passed |
| `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit` (heavy lock) | **passed**: exit 0, whole repository |

New tests in `shift-charts.audit.test.ts`, in a "per-game skip isolation" block:
1. **Skips without counting.** Two empty feeds, a Shift-fingerprint mismatch and a PBP-fingerprint mismatch, then two good games, with `maxGames=2`. Expected:
   - 200 and `success: true`;
   - 4 skips with the right reasons, and `gamesProcessed: 2`;
   - PBP is never fetched for empty feeds;
   - the next queued game is untouched;
   - the selector is asked for `2 + 64`;
   - an audit row with `success` and the skips in `details.context`.
2. **Other guards stay fail-closed.** "Raw PBP snapshot does not match relationship roster" returns 500 with `failedGame` set, keeps the earlier skip listed, and writes an `error` audit row.
3. **Skip budget.** 80 empty feeds with `maxGames=16` stop at 64 skips, with `skipBudgetReached: true`, 64 shift fetches, no PBP fetches and a 200.

Updated tests in `shift-charts.queue.test.ts`, because the contract changed:
- The selector bound is now `maxGames + 64`.
- The shift feed is fetched before PBP, so the non-final-PBP test now gives the feed a row.

## Release list

1. `web/pages/api/v1/db/shift-charts.ts`
2. `web/__tests__/pages/api/v1/db/shift-charts.audit.test.ts`
3. `web/__tests__/pages/api/v1/db/shift-charts.queue.test.ts`
4. `tasks/artifacts/shift-charts-scope-2026-10-19/SKIP-ISOLATION.md`

**Dependencies.** None beyond what is in production. `update-shifts.ts` keeps delegating unchanged. The release does not depend on `local_7becd39f`'s ingest isolation.
