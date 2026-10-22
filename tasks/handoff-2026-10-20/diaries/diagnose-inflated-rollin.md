# Diary: inflated rolling three-season (`_3ya`) totals

## 1. Scope
- **Task:** diagnose why the all-strength rolling rows' `_3ya` totals were 2–4× too large for about 20% of skaters.
  - The brief came from session local_d181f1c6, after calibration session local_24b29608 (Q8/Q9) found the inflation.
  - Those totals feed the FORGE v2 hits/blocks baseline (`computeSkaterPhysicalEventRates`).
- **Then, on TJ's direct approvals:**
  - Attempted a WGO season-label repair. It was blocked; see §5.
  - Shipped a writer guard (option 3).
  - Ran the bounded post-deploy rolling recompute.

## 2. Where
- **Branch:** octoberBranch.
- **Commit:** `5c3be7a0f` "Rolling writer: derive season from game date when the WGO label disagrees". It released in master `ccfe5e57b` (R6d) as a patch.
- **Files:**
  - `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts`: `getSeasonIdForGameDate`, `resolveSeasonValue`, and the `seasonSource` value `"wgo_date"`.
  - `web/lib/supabase/Upserts/fetchRollingPlayerAverages.test.ts:363`: the regression test.
- **Notes** (in `~/Library/Application Support/Claude/side-session-notes/local_d181f1c6-dfc5-4ea8-aa10-cfc6cd89d06d/`):
  - `sidecar-3ya-inflation-diagnosis-2026-10-19.md`: root cause and evidence.
  - `wgo-season-label-repair-2026-10-19.md`: running log covering the dry runs, blocked repair, guard, recompute and verification.
  - `wgo-season-id-consumers-2026-10-19.md`: reader audit by session local_50710811.
  - `sidecar-3ya-sql/`: q10, q11 (diagnosis), r1 (repair, not executed), v1 (verification).
- **Recompute driver:** `recompute-run.ts` and `cohort.txt`, in this session's temporary scratchpad. They won't persist; the log in the notes has the cohort and bounds.

## 3. State
- **Root cause:** 253,257 `wgo_skater_stats` rows dated 2010-12-20..2017-01-16 carry `season_id = 20242025`. Another 105 rows dated 1959/1967 have the same label.
  - The rolling writer's `resolveSeasonValue` trusted the label, so veterans' 2010-17 games fell inside the 2024–26 three-season window.
  - The window code, resume, fallback and key mapping were all correct.
- **Guard (date-derived season when the label disagrees):** live in production as R6d.
  - Master `ccfe5e57b`; deployment dpl_DVxwCFoKPghzA1XyjNXS17HXq2Z1, READY 2026-10-20 00:09:56Z.
  - Checks: `npm test -- lib/supabase/Upserts/` 319/319, the `update-rolling-player-averages` route test 25/25, eslint clean, `tsc --noEmit` 0 errors.
- **Recompute: done and verified** (2026-10-20 00:16:18–00:57:51Z).
  - Code: the released writer, run from a `git archive` export of `ccfe5e57b`.
  - Scope: 214 players, all 5 strengths, 2026-09-29..2026-10-18, one player per call, no truncate.
  - Result: 7,460/7,460 rows, 0 mismatches.
  - DB check: 1,492 rows per strength, and 0 rows with 3ya TOI > 6,000 min or GP > 180.
  - Example, 8470613: hits 676 → 34, GP 610 → 172.
- **WGO data is unchanged.** All 253,257 rows are still mislabelled. The R1 batch 1 rolled back with 0 rows changed.

## 4. Next
- **Planned:** confirm the production fix end to end, then hand it to calibration.
- **Exact first step:** with TJ's read approval, re-run the calibration session's `q9_3ya_vs_wgo_proposed.sql` (in `.../local_24b29608-…/forge-physical-baseline-sql/`). Deciles 9–10 should drop from 1.9×/3.5× to about 1.0.
- After that, re-fit the hits/blocks KR on the corrected rows (calibration session).

## 5. Blocked / needs TJ
- **WGO label data fix: ON HOLD** (TJ chose option 3).
  - A relabel is impossible: two NOT VALID checks on `wgo_skater_stats` require a non-null `game_id`, and `season_id` must match the season encoded in `game_id`. All cohort rows have a null `game_id`.
  - A `game_id` backfill is infeasible from the DB: the rows also have a null `team_abbrev`, so they match 0 games.
  - Remaining routes: NHL API game logs, or a constraint change.
- **105 odd rows:** proposed fix, awaiting TJ's go.
  - They are genuine 1959-60 / 1967-68 games that missed a `game_id` (one contiguous id block per date).
  - Fix: 5 NHL game-id lookups, then set `game_id` and `season_id` together.
  - The ids per date are in the repair log.
- **Optional historical recompute:** 2024-25 rows (`_season` and `_3ya` inflated) and 2025-26 rows (`_3ya`), about 740k rows. A separate decision.
- **Prevention:** an ingest-side season check or a DB check constraint (not approved). This is the second time; the April 2023 repair was the first.

## 6. Insights
- **Fastest diagnostic:** at strength `all`, every WGO row is an appearance, so the sidecar's `three_year_games_played` counts exactly the rows the writer placed in the window.
- **Why Q8/Q9 missed it:** Q9's WGO side filtered `date >= 2024-09-01`, which hid the mislabelled rows. The 2026-27 `_season` was clean.
- **Writer `season` option:** it filters the WGO history read to one `season_id`, which breaks 3ya and career totals. Bound any recompute by `startDate`/`endDate`.
- **`updated_at`:** on `rolling_player_game_metrics` it is only a default on insert. No writer or trigger updates it, so it can't show rewrites.
  - During the recompute, 365 rows per strength (357 for ev/pp) were new inserts: early-season coverage gaps that this run filled.
- **Local vs released writer:** octoberBranch's writer differs from the release by adding an `alignedCountSupport` payload to ev/pp rows. Run production writes from the released code.
- **Approvals:** the auto-mode classifier blocks production writes approved only through a cross-session relay. TJ must approve in the session that writes.
- **Correction:** `mv_team_stats_nst_wgo` does not read `wgo_skater_stats`. An early note of mine said it did.
- **Reader audit:** apart from the rolling table, readers are fixed by a data repair alone. The live exposure today is `/stats/player/[id]?season=20242025`.
- **Not separated:** the milder +3–5% hits/60 excess in deciles 6–8.
