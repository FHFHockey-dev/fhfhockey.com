# C3 receipt 2 — (b) correction per CODEX-20261025-082

- **Scope:** this receipt covers the C3b correction only. (a) and (d) are unchanged (accepted and queued); (c) is unchanged. The first-pass artifacts in `tasks/artifacts/today-plan-2026-10-25/C3/` are preserved untouched. This is a new, immutable version.
- **Freeze (CODEX-083):** nothing was written inside `/Users/tim/Code/fhfhockey.com`. Every file is in `/private/tmp/fhfh-claude-outbox/C3/`. Repo `git status --porcelain` is identical before and after the test run. No Git commands, no live reads, and no lock, retry or schedule changes.
- **Base:** canonical `web/lib/underlying-stats/playerStatsRefreshWindow.ts`, sha256 `d6a291b2371deab1f260ff5fe575069c4aaf42fe97a0dd87a81dcc952b820fb1`, rechecked at HEAD `1ee5127dc`.

## Deliverable

| File | sha256 |
|---|---|
| `C3-b-incremental-recent-holes-v2.patch` | `2d1250f0b9b35adbdfe8def6a6562ff0b3c48b6b6cbd861a7432990adcbe0cea` |
| `patched/playerStatsRefreshWindow.ts` (proposed source) | `5a83d97a21c0eab565b86e5fdffa9fc131fad4dd6196d15f3c11efba990f8fc1` |

`git apply --check -p1` passes against the current canonical tree. Nothing was applied. This replaces the first-pass patch `3a280e44…`, which was not accepted.

## What changed from the first pass

1. **`startDate` is truthful.** It is the date of the earliest game actually selected (`selectedGames[0].date`), and falls back to the old watermark start only when nothing is selected. `latestCoveredDate` is unchanged and stays the watermark. The route already passes `selection.startDate` through, so its response now reports the real interval.
2. **The bound is defined from the data, not the clock.** The floor is `endDate − 7 days`, inclusive, where `endDate` is the latest finished eligible game's date from the existing 8-hour finished rule. It is not 7 days before the current time.
3. **No widening without a watermark.** The hole rule applies only when `latestCoveredDate != null`. Otherwise the selection is byte-for-byte what the canonical code returns.
4. **Unchanged:** the global writer lock, the raw-capture retry budget, concurrency, the trigger fan-out and the schedules. Only uncovered games inside the bound are added. Covered games in between are not re-fetched.

## Tests

14/14 pass with mocked dependencies only ([c3b-tests.log](c3b-tests.log)). The fixtures are fabricated games on a fake clock.

`tests/b-incremental-recent-holes.test.ts` (13):

- **Defect control:** the canonical selector skips the 10/24 holes and reports `startDate` 10/25.
- **Interval:** the correction returns `startDate` 10/24, `latestCoveredDate` 10/25 and `endDate` 10/25, with game IDs `[171, 179, 180–185]`.
- **Each hole exactly once,** with no duplicate IDs. The covered 10/24 games 172–178 are excluded.
- **An uncovered game on the watermark date** is selected once, through the existing rule.
- **Boundary inclusive:** a hole at latest − 7 days is selected, and `startDate` becomes that date.
- **Outside the bound:** a hole at latest − 8 days is not selected, and `startDate` stays the watermark.
- **Data, not clock:** with the clock 19 days past the last game, a hole within 7 days of that game is still selected.
- **An unfinished game (started under 8 hours ago)** does not move the bound.
- **Controls:** with no holes, no covered game, or no finished games, the corrected output equals the canonical output. The no-watermark case keeps selecting every finished game, so the bound does not apply there. The empty case returns the canonical empty shape.

`tests/b-route-startdate.test.ts` (1): the route, running with the corrected selector, responds with `startDate` 10/24, `endDate` and `latestCoveredDate` 10/25, and `gameIds` `[171, 179, 180, 181]`. Raw ingest is called once, with each game once.

Run the tests from `web/`:

```bash
npx vitest run --config /private/tmp/fhfh-claude-outbox/C3/c3b.vitest.config.mts
```

**Not run:** `tsc`, lint, the full suite, and any live check. The tests prove fixture behaviour only, not production recovery of 2026020171/2026020179 (live reads L-b2/L-b3 in the first receipt are still unapproved). Integration, durable placement of these tests in `web/`, and custody stay with Codex.

## Observation

During this run the SS1 lane (`ss1-gamegrid-share`, working) wrote new files under `tasks/artifacts/cross-platform/2026-10-24-coordination/handoffs/SS1/t17/` in the canonical checkout: `server.log`, PNGs and Playwright artifacts. That may conflict with the CODEX-083 write freeze. It was not caused by C3.
