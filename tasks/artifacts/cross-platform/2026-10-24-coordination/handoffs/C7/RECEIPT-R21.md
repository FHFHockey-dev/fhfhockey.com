# C7 ticket 21 — review of three local commits

**Reviewer:** Claude C7 lane session (not the author). Read-only: no `web/` edits, no Git mutations, no `GIT_DIR`, no live reads. Tests ran under the outbound network-deny preload. Evidence is in `r21-evidence/`.

| Commit | Verdict |
| --- | --- |
| `5660dcdd0` GS: one appearance per per-game row | **Accept** |
| `ef524ca2a` SS1: `bounded()` returns empty past the exact count | **Accept** |
| `1b5c36024` C3: 500 on rejected upserts; stable player order | **Accept** (two observations) |

**Gate not run:** whole-project `tsc`, which the commit messages list as pending. When I went to run it at 14:30 local, the heavy lock was held by "Claude Q2 v24" (`v24-hud-playmode`, created 18:30:11Z), and I didn't take or touch it. The three commits change 3 source lines' worth of types at most (no new types or exports). Run `npm run typecheck` once the lock frees.

## Tests: new tests fail on the parent, pass on HEAD

The six committed files equal the working tree (`git diff HEAD` clean for each).

| Run | Result |
| --- | --- |
| **HEAD** (`head.json`) | **62/62**: GoalieShareChart 17, playerSources 8, calculate-wigo-stats 37 |
| **GS parent** `48809914a` (`gs.json`): HEAD test with the parent `goalieWorkload.ts` | 16/17. **Only** "counts each per-game row as one appearance when gamesPlayed is missing or malformed" fails. |
| **SS1 parent** `5660dcdd0` (`ss.json`): HEAD test with the parent `playerSources.ts` | 7/8. **Only** "reads a result of exactly one full page without requesting a page past the end (SS1-20)" fails. |
| **C3 parent** `ef524ca2a` (`c3.json`): HEAD test with the parent route. The mirror's `lib/` is a symlink, so the test's relative `vi.mock` paths resolve to the same modules. | 34/37. **Only** the 3 new tests fail: the `wigo_career` and `wigo_recent` rejected-upsert cases, and "pages the player list in a stable order…". |

So each new test guards its fix, and no older test changed behaviour.

## `5660dcdd0` GS: `web/lib/goalieWorkload.ts:106-107`

- **Change:** `gamesPlayed: sum(row => (row.gamesPlayed === 0 ? 0 : 1))`. A missing, `null` or malformed value (e.g. `3`) counts as one appearance; an explicit `0` counts as zero.
- **Consistency:** the pie denominator (`totalAppearances`) and `totalGames` stay consistent. The test shows 3 rows, totalGames 3, appearances 3/0.
- **Edge cases:**
  - Uniqueness per `(gameId, playerId)` is still enforced by `assertUniqueGoalieGameRows`, so "one row = one appearance" can't double count.
  - Wins, losses and save inputs are unchanged, and so is my earlier GS starts logic (it reads `gamesStarted`, not `gamesPlayed`).
- **Assumption:** every row in NHL's `isGame=true` goalie summary is an appearance, so a row with a missing `gamesPlayed` is a missing field, not a non-appearance. That is plausible for that endpoint, but a live payload check is still pending (no live reads here).

## `ef524ca2a` SS1: `web/lib/socialShare/playerSources.ts:30-32`

- **Change:** `if (expected != null && from >= expected) return { data: [], error: null }` runs before the request.
- **Cause and fix:** `fetchAllSupabasePages` (`lib/supabase/pagination.ts:114-140`) asks for another page after any full page. On an exact multiple of 1,000 rows, PostgREST answers that request with 416 (PGRST103), and `bounded()` failed closed, giving "Recent form unavailable". The guard skips the request once the exact count says nothing is left.
- **Edge cases:**
  - **0 rows:** the first page is always requested (`expected` is still null), so a genuinely empty result still comes from the server.
  - **Count over the limit** (e.g. 2,000 rows with a 1,680 cap): pages stop at the cap, `rows.length !== expected`, and it **still fails closed**.
  - **Count changing between pages:** still throws "completeness changed".
  - **Coverage:** it fixes all `bounded()` users (Yahoo, skater and goalie totals, the map chunks, recent form).
  - The test proves 1,000 rows make **one** request, and 1,001 rows page normally into `[1000, 1099]`.
- **Live effect:** "a plausible cause of the live recent-form gap" is reasonable, but it isn't confirmed until the post-deploy runtime log (`[social-share] … unavailable: PGRST103 …`) is read.

## `1b5c36024` C3: `web/pages/api/v1/db/calculate-wigo-stats.ts`

- **Stable order (`:178-179`):** the `players` id read now `.order("id", { ascending: true })` before `.range()`. `players.id` is the primary key, so pages are disjoint and complete. The loop still stops at `allPlayerIds.length >= count`.
  - The test simulates Postgres returning unordered pages in alternating orders. With the parent code, the 1,500-player run skips skaters; with the fix, all 1,500 are written.
- **Rejected upserts (`:1295`, `:1340`, `:1358-1368`):** each `{error}` from an interim or final batch upsert is collected in `writeErrors`, and the route returns **500** `{success:false, error, writeErrors, rejectedPlayerIds, message, duration}`. That check runs **before** C3a's 207 rejected-player response, so a write failure always wins.
- **Contract with `withCronJobAudit`:** `inferredFailure = thrown || statusCode === 207 || statusCode >= 400 || inferFailure(body)` (`lib/cron/withCronJobAudit.ts:327-331`). A 500 is recorded as a **failure**. `isPlannedContinuation` applies only to 207, so a 500 can't be read as a continuation.
- **Callers:** the only reference outside tests is `pages/api/v1/db/cron-report.ts` (`:69`, `:139-140`, `:176`), which reads audit rows and maps the route to the `wigo_table_stats` freshness check. No route chains to it expecting 200. It is wrapped in `adminOnly(withCronJobAudit(withNhlOffSeasonSkip(…)))`.

| # | Observation |
| --- | --- |
| **C1** (info) | Earlier batches are already committed when a later one fails. The 500 body says "some rows may not have been written", which is accurate but could also say that *other* rows were written, so a rerun is idempotent (`onConflict: player_id`). |
| **C2** (info) | The 500 body includes raw Supabase error messages (`writeErrors`). The route is admin-only and the same text is logged, so this is acceptable. Keep it off any public surface. |
| **C3** (info) | A thrown rejection inside `Promise.all` (rather than an `{error}` result) still goes through the existing outer catch, which also gives 500. Unchanged. |
