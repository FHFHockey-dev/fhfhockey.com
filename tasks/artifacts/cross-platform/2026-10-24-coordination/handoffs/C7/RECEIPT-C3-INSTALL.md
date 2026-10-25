# C7 independent review — C3a and C3b v2 installs (uncommitted, canonical tree)

**Verdict: accepted with limits.**
- **C3a:** quarantines a bad player and keeps the identity guard. The run still records a failure.
- **C3b v2:** `startDate` is now truthful (CODEX-082's correction) and the hole bound is anchored to the latest finished game.
- **Unchanged:** the global lock and bounded retry.
- **The limits are bookkeeping, not code:**
  - the owner receipt's typecheck line is an unfilled placeholder;
  - one new test file sits outside the lease.

**Reviewer:** Claude C7 lane session (not the author). Read-only: no edits, no Git, no live reads, and no server. Tests ran under the outbound network-deny preload. Evidence is in `r17-evidence/c3-install/`.

## Pins

These canonical working-tree hashes equal `C3/INSTALL-RECEIPT.md` and CODEX-082's reviewed proposed sources:

| Path | Hash |
| --- | --- |
| `pages/api/v1/db/calculate-wigo-stats.ts` | `355f4f19…` |
| `lib/underlying-stats/playerStatsRefreshWindow.ts` | `5a83d97a…` |
| `__tests__/…/calculate-wigo-stats.test.ts` | `fc28c83d…` |
| `lib/underlying-stats/playerStatsRefreshWindow.test.ts` (new) | `945761df…` |

**C3d held:** `forge-served-forecast-snapshot.ts` is still `968c894a…`, as the receipt says.

**Unchanged versus HEAD `9dbc55afb`:**
- the three selector callers: `update-player-underlying-stats.ts`, `catch-up-player-underlying.ts` and `update-player-underlying-summaries.ts`;
- `lib/underlying-stats/playerStatsSummaryRefresh.ts`, the writer lock and retry;
- `lib/cron/`.

## C3a: per-player quarantine (`calculate-wigo-stats.ts`)

- **Identity guard kept:** the same predicate as before decides validity: null `game_id` or `season_id`, a non-regular game id, a season mismatch, `games_played !== 1`, or a duplicate `game_id`. The only change is that a failure marks the player rejected instead of throwing for the whole run.
- **Writes are withheld for that player only:** `continue` happens before the player's `allCareerUpsertData` / `allRecentUpsertData` pushes (`:1243`, `:1248`) and before `processedCount++`. Earlier players' batch upserts are unaffected.
  - Owner test: with one bad and one valid player, `wigo_recent` and `wigo_career` contain only the valid id.
  - Owner test: the 4 invalid-frame variants plus missing-season give a 207 with zero writes.
- **The run still reports failure:** the response is `207 {success:false, error, rejectedPlayerIds}`. `withCronJobAudit` counts `statusCode === 207` (`withCronJobAudit.ts:330`) and `success === false` (`:169`) as failures, so the cron audit and report show a failed run, not a green one.
- **Not repaired:** rejected players' existing rows stay stale, which matches CODEX-082. Other per-player read errors (`:284`, `:303`, `:353`) still throw for the whole run, as before.

## C3b v2: hole reselection (`playerStatsRefreshWindow.ts`)

- **Truthful `startDate`:** `startDate` = the earliest *selected* game's date (`selectedGames[0]?.date`, sorted ascending), falling back to the old watermark only when nothing is selected. `latestCoveredDate` stays the watermark.
- **Bound:** `holeFloor` = the latest finished game's date (`endDate`) − 7 days, inclusive. It is not wall-clock time, and it only applies when a watermark exists; with no watermark, behaviour is unchanged. `summaryGameIds` is the whole-season coverage set, so holes are judged against full coverage.
- **Property control (`c3Selector.test.ts`):** 400 random seasons, each with up to 45 days of slates, random gaps, and coverage dense or sparse. For every case:
  - ids are unique;
  - `latestCoveredDate` = the latest covered date, and `endDate` = the latest finished date;
  - `startDate` = the earliest selected date;
  - each game is selected **iff** it is on or after the watermark, **or** it is uncovered and on or after the floor.

  **0 violations**, with 1,454 hole selections exercised.
- **Lock and retry unchanged:** `playerStatsSummaryRefresh.ts` (lock and retry) and all three routes are byte-identical to HEAD.

## Tests

**104/104 pass** (`c3.json`).
- The owner's focused set gives **66**: calculate-wigo-stats 34, playerStatsRefreshWindow 10, update-player-underlying-stats 16, update-player-underlying-summaries 6. That reproduces C3's 66/66.
- Neighbours: `playerStatsSummaryRefresh` 10 and `withCronJobAudit` 27.
- My property control: 1.

## Limits and findings

| # | To | Finding |
| --- | --- | --- |
| **L1** | C3 / orchestrator | `INSTALL-RECEIPT.md` "Checks" still reads `TSC_RESULT` for the whole-project typecheck, an unfilled placeholder. No typecheck result is recorded. I didn't run a whole-project `tsc` (heavy). Record it before commit, or run a scoped `tsc` on the 4 paths. |
| **L2** | Orchestrator | The new `lib/underlying-stats/playerStatsRefreshWindow.test.ts` is **outside the T3-C3 lease's `canonical_write_paths`**, as the receipt itself says. Confirm it, or move it, before committing. |
| **O1** | Owner (info) | The selector change applies to **all three** callers (stats, catch-up, summaries), not only the stats cron. Each now reselects in-window holes. That is consistent with CODEX-082's approval of "bounded reach", but worth one line in the commit message. |
| **O2** | Owner (info) | A hole that never succeeds (e.g. the provider never publishes it) is retried on every run until the latest finished game is more than 7 days later. The extra work per run is bounded by one week of uncovered games. |
| **O3** | Orchestrator (hygiene) | `web/next-env.d.ts` is modified in the working tree. That is not C3's change; a Next run regenerates it. Leave it out of the C3 commit. The SS1 files currently dirty belong to the pending SS1-17/18/19 work. |
| **O4** | Owner (info) | The artifact tests in `C3/tests/` and `C3/second-pass/tests/` now import the installed sources. As the receipt says, their "canonical defect" cases describe the old tree; they are frozen evidence, not current tests. |
