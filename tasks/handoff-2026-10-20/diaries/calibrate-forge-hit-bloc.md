# Handoff diary: calibrate FORGE hits/blocks constants

## 1. Scope
- Calibrated the provisional constants behind FORGE v2 all-situation hits/blocks rates: `computeSkaterPhysicalEventRates` in `web/lib/projections/calculators/skater-adjustments.ts`.
  - The rates were added on 2026-10-19 after NST ES gamelog gaps zeroed proj_hits / proj_blocks.
  - Diagnosis: `side-session-notes/local_08a0bf1c-…/forge-hits-blocks-zeros-2026-10-19.md`.
- Started by session local_90b997f5 (no task ID). Proposed follow-up `task_4ea44bc7` became session local_d181f1c6 ("FORGE hits/blocks: recency-weighted 3-season baseline"), which owns all later work on this formula.

## 2. Where
- Branch: `octoberBranch`, in `/Users/tim/Code/fhfhockey.com`.
- The calibrated values are in commit `b8fe1072e` ("sfgsdfgsdfgsdf"). I did not make that commit; it also holds the F2/F3 hits/blocks source change.
- `master` has no `SKATER_PHYSICAL_*` constants, so this work is not released.
- Files I edited: `web/lib/projections/constants/projection-weights.ts`, `web/lib/projections/calculators/skater-adjustments.ts`, `web/lib/projections/runProjectionV2.test.ts` (physical-rate tests only).
- Evidence and SQL: `~/Library/Application Support/Claude/side-session-notes/local_90b997f5-7379-49bf-80b9-ca9242ebc0d8/`
  - `forge-physical-calibration-2026-10-19.md`: plan, results tables, proposal, implementation.
  - `forge-physical-calibration-sql/q1_rates.sql`, `q2_pk_share.sql`, `q3_grid.sql`, `q4_diagnostics.sql`.

## 3. State
**Values committed in b8fe1072e (TJ approved 2026-10-19):**
- Priors: F 4.9 hits / 2.1 blocks per 60; D 3.2 / 4.4.
- `SKATER_PHYSICAL_PRIOR_MINUTES = { hits: 50, blocks: 300 }`.
- `SKATER_PHYSICAL_RECENT_SHRINK_MINUTES = { hits: 120, blocks: 1000 }`.
- `SKATER_PHYSICAL_TOI_RATIO_MAX = 1.3`.
- The helper returns `hitsRecentWeight` / `blocksRecentWeight` in place of `recentWeight`.

**Checks I ran then:**
- Vitest: 3 focused files, 205 tests passed; the wider set (lib/projections, lib/rosterScheduleData, the run-projection-v2 route, api/v1/forge) passed with 64 files and 1,313 tests.
- ESLint on the 3 files: clean.
- `tsc --noEmit`: exit 0 with an 8 GB heap.

**Since then (2026-10-20):** session local_d181f1c6 committed its league-to-date rescale on top, locally on octoberBranch as `34a5588db` (13 files; not pushed, not released). I have not verified it.
- `RECENT_SHRINK_MINUTES.hits` changed 120 → 240.
- New constants: `SKATER_PHYSICAL_PRIOR_SEASON_WEIGHT`, `SKATER_PHYSICAL_LEAGUE_SHRINK_MINUTES`, `SKATER_PHYSICAL_LEAGUE_SCALE_MIN` / `_MAX`.
- Edits to skater-queries, skater-stage, run-forge-projections, types and tests.
- New migration `supabase/migrations/20261020211500_forge_league_skater_physical_totals.sql`, not applied.
- Its report: 63 Vitest files / 1,314 tests passed, ESLint clean, tsc passed with a 12 GB heap. Nothing deployed.

**Production reads:** Q1–Q4 ran once each on 2026-10-19, with TJ's approval. They were read-only, via the Supabase connector `execute_sql` on project `fyhftlxokyjtpndbkfse`. Q5 (reserve) was not needed.

## 4. Next
- None for this session; the next step belongs to local_d181f1c6 (TJ's decision on its migration and release).

## 5. Blocked / needs TJ
- Session local_d181f1c6 needs TJ's approval to apply `20261020211500_forge_league_skater_physical_totals.sql` to production and to release its code.
- Releasing b8fe1072e's hits/blocks work to `master` hasn't happened and needs the normal release approval.

## 6. Insights
**`wgo_skater_stats` facts, from Q1 on 2021-22..2025-26 (`games_played = 1`):**
- TOI is in seconds; ES + PP + SH equals TOI exactly.
- No null hits, blocks or TOI splits.
- Each season label holds 47,206–47,230 skater-games, which is a full season.
- `team_abbrev` is unusable for per-team-game counts in 2021-22 and 2022-23.

**Season labels:**
- 253,257 WGO rows dated 2010–2017 carry a wrong `season_id`. Always filter on `date` as well as `season_id`.
- R6d made the rolling writer derive the season from the game date, and the 2026-27 rolling rows were recomputed.
- My backtests used date windows and were unaffected.

**League trends:**
- League hit counting is falling: D hits/60 went 4.19 → 3.35 → 3.03 (2023-24 → 2025-26). Hits per team-game went 22.7 → 21.5 → 20.5.
- So an equal-weight three-season baseline overpredicts hits: established D come out at Σμ/Σy ≈ 1.13 in 2025-26 even with the fitted constants. This is why the follow-up adds the league-to-date rescale.

**Fit results:**
- Hits favor recency. Blocks favor the three-season baseline.
- One shared K for both metrics made blocks worse than the old constants (+27 to +51 deviance), so the K's are per metric.
- Last-5-only blows up the deviance (exact zeros). Prior-only is far worse than either blend.
- Players with thin history (rookie-type) hit more than the league average (F 5.75–6.73 /60). A rookie-cohort prior gave at most an 11-deviance gain, which is noise, so the priors stay league rates.

**TOI multiplier:**
- It is recent all-situation TOI ÷ *projected* ES+PP. When the ES+PP projection drops, the drop is read as PK time.
- 2025-26 last-5 p99 of the true ratio is 1.26 (D) and 1.30 (F); the player-season max is 1.26.
- The 1.3 cap is a judgment call and was not backtested.

**Tooling:**
- `npx tsc --noEmit` runs out of memory at the default heap. Use `NODE_OPTIONS=--max-old-space-size=8192` or higher.
- SQL can be tested locally with `/opt/homebrew/opt/postgresql@17` (initdb plus a TCP listener on 127.0.0.1).
  - It needs `LC_ALL=C` (otherwise "postmaster became multithreaded"); scratchpad paths are too long for a Unix socket.
- In Q4, a per-player self-join took 93 s. A window function (`max(...) filter (...) over (...)`) cut it to 1 s with identical output.
- Not backtested: games 1–5, where the last-5 window crosses seasons.
