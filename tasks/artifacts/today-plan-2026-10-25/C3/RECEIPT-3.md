# C3 receipt 3 — WiGO silently reported success after a failed upsert (fixed, uncommitted)

- **Ticket:** fix the single highest-value remaining cron/data-integrity defect inside the C3 lease, within a 12-minute time box. The checkout is `octoberBranch` at HEAD `48809914a`. No Git commands were run, nothing was committed, and no cron, ETL, refresh, live or production calls were made.
- **Defect:** `calculate-wigo-stats` checks each `wigo_career`/`wigo_recent` upsert result but only `console.error`s a failure, then still returns `200 {success: true}`. A rejected write (constraint, permission or timeout) is therefore audited as a success and never reaches the cron briefing. This was listed as out of scope in RECEIPT.md.
- **Reproduced:** with a mocked upsert that rejects for each table, the released route returned **200** (`expected 200 to be 500`, 2 failing cases) before the fix.
- **Fix (minimal; no guard, budget or read changes):**
  - Each upsert error is recorded as `"<table>: <message>"`, for both the in-loop batches and the final batch.
  - After the loop, any recorded error returns `500 {success:false, error, writeErrors, rejectedPlayerIds, message}`. The message says earlier batches may already be written; there is no rollback, as before.
  - `withCronJobAudit` infers failure from the `error` string.
  - The rejected-player 207 path and the clean 200 path are unchanged.

## Changed files

| Path | sha256 |
|---|---|
| `web/pages/api/v1/db/calculate-wigo-stats.ts` | `ef25e2e5b5d4d74e8ef69eb5b40c65aaab26e633392d8838582a4375e1fd6afc` |
| `web/__tests__/pages/api/v1/db/calculate-wigo-stats.test.ts` | `efe8212ff40097dfbfc17b807401d22ef36d0533c913cb4f2315584d3ec2f4d2` |

Base before this ticket: `355f4f19…` (source) and `fc28c83d…` (test). Both paths are in lease `T3-C3`.

## Checks

| Check | Result |
|---|---|
| New test `fails the run instead of reporting success when the %s upsert is rejected` (`wigo_career`, `wigo_recent`) | **failed before the fix** (200), **passed after** (500, `writeErrors` exact, the other table still written) |
| Focused Vitest `__tests__/pages/api/v1/db/calculate-wigo-stats.test.ts` | **passed** (36/36) |
| ESLint on the 2 changed paths | **passed** (exit 0) |
| Whole-project typecheck | **not run** (time box; the change adds only local `string[]` usage) |

## Limits

- Coverage is the final-batch path. The in-loop 200-player batch path got the identical one-line change but has no test of its own.
- An upsert that throws, rather than returning `{error}`, already reached the existing 500 catch.

---

# Ticket 3, part 2 — WiGO player list paged without a stable order (fixed, uncommitted)

- **Resumed** after the session-limit reset, with a 25-minute time box. HEAD is `48809914a`. No Git commands, no commits, and no cron, ETL, refresh, live or production calls.
- **Ruled out first:** the snapshot route's `207 {success:false, marketError}` path. `withCronJobAudit.inferFailure` returns true for `success === false` (`web/lib/cron/withCronJobAudit.ts:165-170`), so that path is already audited as a failure. This corrects the "may record as success" note in RECEIPT.md.
- **Defect:** `fetchAllPlayerIds` in `calculate-wigo-stats.ts` reads `players` (non-goalies) in 1,000-row `.range()` pages with **no `ORDER BY`**. Postgres guarantees no row order between separate page queries, so pages can overlap and skip rows. The duplicates are removed by `new Set`, but the skipped skaters are silently never processed, and the run still returns `200 "Successfully processed N of N"`, where N is the reduced count.
- **Reproduced offline:** the fixture has 1,500 skaters, one valid game each, and returns a different scan order on each unordered page query. The released route returned `Successfully processed 1000 of 1000 players.` and wrote 1,000 of 1,500, skipping 500 without any failure signal.
- **Fix (one line):** `.order("id", { ascending: true })` before `.range()`. No guard, budget, write or schedule changes. Live impact is unverified: no live reads were done to measure how many skaters were actually skipped.
- **Coverage bonus:** the same test runs 1,500 players through the in-loop 200-player save path. That path had no test before; only its success case is covered now.

## Changed files (cumulative for ticket 3)

| Path | sha256 after part 2 |
|---|---|
| `web/pages/api/v1/db/calculate-wigo-stats.ts` | `7fd0ed706d337ed1f059ba2e0b4dc50bc95bb43a21953d55870bbf541c231c10` |
| `web/__tests__/pages/api/v1/db/calculate-wigo-stats.test.ts` | `0c24694a0a58ef24b5f32201255f151a20f781b27660b69d64fcb1926bec7f74` |

## Checks (part 2)

| Check | Result |
|---|---|
| New test `pages the player list in a stable order so no skater is skipped across pages` | **failed before the fix** (`processed 1000 of 1000`), **passed after** (1500 of 1500, all 1,500 `wigo_recent` rows written) |
| Focused Vitest `__tests__/pages/api/v1/db/calculate-wigo-stats.test.ts` | **passed** (37/37) |
| ESLint on the 2 changed paths | **passed** (exit 0) |
| Whole-project typecheck | **not run**: `/private/tmp/fhfh-heavy.lock` was held by another lane (`WIGO t2 tsc`), and I did not wait or touch the lock |
