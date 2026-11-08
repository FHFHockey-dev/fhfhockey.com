# Handoff diary: FORGE hits/blocks residual bias (league-to-date rescale)

## 1. Scope
- Started from session local_24b29608. Task: design and backtest a fix for the residual bias in FORGE v2 all-situation hits/blocks rates (`computeSkaterPhysicalEventRates`), after TJ approved the fitted constants (priors F 4.9/2.1, D 3.2/4.4; KP 50/300; KR 120/1000; TOI cap 1.3).
- Bias: the three-season baseline weights old seasons equally while league hit and block rates fall. D hits went 4.19 → 3.35 → 3.03 per 60 (2023-24 → 2025-26), and established D hits overpredicted at about 1.13.
- TJ then approved the league-to-date rescale design (`cand_lgTD_disc`) with K = 50 team-games, and asked for a local implementation.

## 2. Where
- Branch octoberBranch. Committed locally as `34a5588db` on 2026-10-20, after TJ's approval relayed by Chef local_60e96358. Not pushed.
- Files touched:
  - `supabase/migrations/20261020211500_forge_league_skater_physical_totals.sql` (new)
  - `tasks/TASKS/repository-audit-remediation/migration-authority.json` (order 88, pending)
  - `tasks/TASKS/super-goal/super-goal-final-summary.md` (count line only)
  - `web/lib/supabase/supportedBaselineMigration.test.ts` (88 records, 3 pending)
  - `web/lib/projections/constants/projection-weights.ts`
  - `web/lib/projections/calculators/skater-adjustments.ts`
  - `web/lib/projections/queries/skater-queries.ts` and `.test.ts`
  - `web/lib/projections/types/run-forge-projections.types.ts`
  - `web/lib/projections/stages/skater-stage.ts`
  - `web/lib/projections/run-forge-projections.ts`
  - `web/lib/projections/runProjectionV2.test.ts`
  - `web/lib/projections/nativeGoalAccounting.test.ts`
- Notes are in `~/Library/Application Support/Claude/side-session-notes/local_24b29608-3fce-44c7-b449-a285e958e1e7/`:
  - `forge-physical-baseline-2026-10-19.md`: Q6–Q9 results.
  - `forge-physical-lgtd-design-2026-10-20.md`: design, Q12 results, implementation status.
  - `forge-physical-baseline-sql/`: Q6–Q12 SQL, draft migration, local-test generator.

## 3. State
- **Committed locally in `34a5588db` (13 files). Not pushed, not on master. Migration not applied. No deploy.**
- **Formula:**
  - This season's events count at full weight; the two prior seasons (3ya − season) at weight 0.5.
  - Prior-season events are scaled by r = clamp(Ltd*/Lp, 0.7, 1.3). Lp is the league rate pooled over the prior two seasons. Ltd* is this season's league rate to date, shrunk toward Lp by K = F 9,000 / D 5,750 minutes. Ltd* is also the prior.
  - Hits KR 240, blocks KR 1000; KP unchanged.
  - If the league read fails: r = 1 with the constant priors, counted in `data_quality.physical_league_totals_unavailable`.
- **League aggregate:** the new STABLE, SECURITY INVOKER function `public.forge_league_skater_physical_totals(p_season_id, p_cutoff)`; EXECUTE for service_role only. FORGE calls it once per run and date, through `leaguePhysicalTotalsCache` in `run-forge-projections.ts`.
- **Checks (all passed):**
  - Focused Vitest (4 files): 231 tests.
  - Wider Vitest (`lib/projections`, `lib/rosterScheduleData`, the run-projection-v2 route, `__tests__/pages/api/v1/forge`): 64 files, 1,322 tests.
  - ESLint on the 10 changed TypeScript files: clean.
  - `NODE_OPTIONS=--max-old-space-size=12288 npx tsc --noEmit`: exit 0.
  - The migration applied twice cleanly on a throwaway local Postgres 17 and matched a direct aggregate.
- **Backtest (read-only, TJ approved Q6–Q9, the Q9 re-run, and Q12):**
  - Games 2–30, vs fitted: hits −240 and blocks −69 in Poisson deviance.
  - Established D hits calibration: 1.13 → 1.04–1.05.
  - Only regression: 2025-26 hits on games 2–5 (+21.5 ± 12.8).

## 4. Next
- Nothing started. The next step is TJ's call: commit or release, then the hosted migration apply.
- First step if approved: re-verify the diff with `git diff` and re-run the focused Vitest files.
- After release, a bounded check would confirm the counter `physical_league_totals_unavailable` is 0 in a run's metrics.

## 5. Blocked / needs TJ
- Push and release of `34a5588db`. Per memory, push octoberBranch only together with the Vercel preview check.
- Hosted apply of migration 20261020211500. Separate explicit approval. Code can ship first (it falls back).
- Optional: the TOI-multiplier fallback guard (use the ratio only when ev and pp last-5 averages exist). Not implemented.

## 6. Insights
- **The TOI multiplier already uses recent all ÷ recent ES+PP** (`skater-stage.ts`, `toiEs + toiPp` are ev/pp last-5 averages). The flaw in the brief was only the 700 s / 120 s defaults on the fallback path.
- **Production 3ya totals were 2–4× inflated** for about 20% of players. The cause was 253,257 WGO rows dated 2010–2017 and labelled `season_id = 20242025`. It was fixed by the R6d writer guard plus a 214-player recompute (session local_c39098ae). The Q9 re-run then matched WGO within 0.994–1.001.
  - **The WGO data itself is still mislabelled.** Any `wgo_skater_stats` read must bound by date as well as season_id; the new function does.
- **The WGO backtests (Q1–Q7, Q12) were never affected** by the mislabels, because they filter `date between 2021-09-01 and 2026-07-01`.
- **`supportedBaselineMigration.test.ts` pins exact counts** (records, pending) and checks a count line in `super-goal-final-summary.md`. Orders must be contiguous, so the IFTTT SQL6–SQL8 drafts noted on order 87 now take 89–91.
- **Full `tsc` runs out of memory at 4 GB; use 12 GB.** It takes 15–20 minutes.
- **Local Postgres on macOS:** set `LC_ALL=C` and use TCP (the scratchpad path is too long for a Unix socket).
- **2025-26 games 6–10 overpredict about 5% under every variant** (a within-season effect). Not addressed.
