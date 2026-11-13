# Decision 152 refresh approval packet (Chef, 2026-11-13 ~20:44Z)

**State:** not started. PP share stays **hidden**; readers are unchanged. Serving PP share is a separate, later approval.

**Preconditions met:**
- Migration 149 applied and verified (20:36:48Z).
- TJ accepted dry-run diff `db94a9de864b9dfa8fa69f24c6be9045dd037ed1937393c3b03dd69d9ec4f15c`.
- #441 (`f5c7adc2d`) releases the writer with `PP_STORED_CALCULATION_WRITES_ENABLED` unset, so every write call skips.

## Step 1: turn writes on (an env change plus one deployment; each needs TJ's OK)
1. **TJ sets** `PP_STORED_CALCULATION_WRITES_ENABLED=true` (Production) in Vercel → fhfhockey → Environment Variables. The Vercel connector couldn't create env vars earlier.
2. **A deployment is needed for it to take effect.**
   - A dashboard Redeploy of unchanged code is canceled by the Ignored Build Step (`web/vercel.json`; the 2026-11-01 incident).
   - So: a **clean-export CLI production deploy of master `f5c7adc2d`** (git archive to a temp folder, `.vercel/project.json`, `vercel deploy --prod`). This is **1 extra fhfhockey build, ~8 min**, with no code change. Master doesn't move.
   - Then: alias check, a 3-GET smoke, and confirming the flag is live. The confirmation is the first refresh call's response (no `skipped`), not a separate probe.
3. **Effect once on:** the nightly cron 388 (08:05Z, last 3 days) writes through the new calculation from then on. That's the intended end state.
4. **Alternative (no extra build):** leave the flag for the next code release to pick up. The refresh then waits for that release, and new games keep getting no PP combination rows meanwhile.

## Step 2: the refresh (write phase), bound to the accepted diff
- **Runner:** `20-refresh-runner.py --phase write --dry-run-sha256 db94a9de…f15c --base-url https://fhfhockey.com`. The batches are frozen: 31 × ≤10 games, 2026020001–309, sha-pinned.
- **Bounds:**
  - concurrency 1, ≥5 s between calls, load gate before each;
  - only the fhfhockey.com route is called, with no provider calls;
  - each call reads ~1,130 stored rows per game and writes one `replace_power_play_game_v1` transaction per game.
- **After each call:** a read-only readback of each game against the dry-run expectation: row set and values, both clock rows (availability, seconds), and `calculation_version` / `computed_at` set.
- **Stops before the next call on:** the first mismatch, a non-200, a call over 60 s, a failed or skipped game, or a busy database. It prints `--start-batch` for a resume.
  - A stop leaves no half-written game, because each game is one transaction.
  - Inputs that changed since the export (e.g. a re-normalized game) show up as a mismatch and stop the run. They're never written silently.

**Expected end state** (from the accepted diff):

| | Before | After |
|---|---|---|
| 2026-27 regular-season `powerPlayCombinations` rows | 7,190 | **7,180** (−15 group A, +5 group C) |
| Rows with `calculation_version` set | 0 | 7,180 (every row of the 309 games) |
| Rows whose values change | — | 37 updated (23 PP time/share + 14 unit-relative) in the 16 team-games; all others identical |
| `pp_team_game_clock` rows | 0 | **618** (609 available, 9 not applicable, 0 unavailable) |
| Other seasons' rows | 40,498 | unchanged |

## Step 3: readbacks (read-only, after the run)
- The counts above.
- Every row stamped, with no row on a non-available team-game.
- Share ≤ 1 and PPTOI ≤ clock everywhere.
- The 16 team-games' rows equal the dry run's "after" values.
- Group A's 15 player rows are gone.
- 2026020131 t18 has 10 skaters at ≤120 s.
- Cron 388's next run writes (no `skipped`) and audits `success`.

## Not in this approval
- Reader gates and serving PP share: a separate TJ approval after the readbacks pass.
- Other seasons: they stay on the earlier writer, with null version.
