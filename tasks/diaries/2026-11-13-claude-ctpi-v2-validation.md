# Diary: follow-up lane F5, CTPI v2 validation and approval change (Claude, 2026-11-13)

## Scope
Brief: `tasks/artifacts/calculation-inventory-2026-11-10/master/fix-lanes/FOLLOWUP-LANES-2026-11-13.md` Lane F5 (commit 53045f5b6).
1. Held-out study: v1 vs v2 as predictors of next-N-games GD/game and points% (rule 11). No production writes; bounded read-only reads under read hygiene; no NST/NHL calls.
2. If v2 ≥ v1: successor change, writer issues `approved` from a stated date; stored candidate rows never relabelled (rule 21). Files: `web/lib/trends/ctpiVersions.ts`, `web/lib/trends/recentTeamFormV2*.ts`, `web/pages/api/v1/db/update-team-ctpi-daily.ts` + tests.
3. If worse: report and options, no code.
4. Production steps for TJ.

## Where
octoberBranch, sole checkout, HEAD 53045f5b6 at start.
Report: `tasks/artifacts/calculation-inventory-2026-11-10/master/production/ctpi-v2-validation-2026-11-13/REPORT.md`.

## Findings so far
- Production source (read 2026-11-13, pg_stat_activity 1 active): NST team gamelogs hold only 2025-26 (2,556 gp=1 as_counts rows, regular season only, ~79-80 games/team, Feb Olympic gap) and 2026-27 (618 rows, 09-29 → 11-12). No earlier seasons in the DB; the multiseason audit script fetches from NST, so it is off-limits here.
- as_counts gp=1 carries wins/losses/otl/points (W=2, OTL=1) and gf/ga: targets come from the same table.
- Stored rows: v1 8,064 (2025-26) + 1,425 (2026-27); v2 candidate 1,102 (2026-27, 10-07 → 11-13).
- Writer replay plan keys on formula/input version + fingerprint + watermark, not publication status: an approval must not change the formula version string (would replay and relabel every stored candidate date).

## Next
Pull the four source tables (selected columns, gp=1) to the scratchpad; build the offline harness (v1 and v2 from games before D); check it reproduces stored v2.

## Blockers
None.

## Checkpoint 1 — data pulled, decision rule fixed before results
- Read-only pull (pg_stat_activity 2 active, longest 1 s): four NST team tables (selected columns, gp = 1, 2025-26 + 2026-27) and stored `team_ctpi_daily` scores (no payload) via psql `\copy` to the session scratchpad. No other production reads.
- Harness: `production/ctpi-v2-validation-2026-11-13/ctpi-v2-validation.ts` (v1 = computeTrendMetrics + computeCtpi; v2 = the writer's buildRecentTeamFormCandidateSnapshot; both from games < D).
- **Decision rule (fixed before results):** primary = 2025-26, next-10-game GD/game and points%, mean per-game-day Spearman across teams; Δ = v2 − v1 with a moving-block bootstrap (20 game days, 2,000 reps). v2 is "at least as good" if, for both targets, the 95% CI lower bound of Δ ≥ −0.03 (non-inferiority margin, a stated hypothesis), and no secondary (horizons 5/20, held-out calibration skill, 2026-27 out-of-time) shows v2 worse with a CI excluding 0.

## Checkpoint 2 — results and report (2026-11-13)
- SQL used (read-only, statement_timeout 10 s): `\copy (select season_id, team_abbreviation team, date, gp, <cols> from nst_team_gamelogs_{as_rates,as_counts,pp_counts,pk_counts} where gp=1 and season_id in (20252026,20262027)) to csv`; `\copy (select ctpi_version, season_id, team, date, ctpi_raw, ctpi_0_to_100 from team_ctpi_daily) to csv`. CSVs stay in the session scratchpad (raw production rows, not committed).
- Harness: offline v2 = stored v2 1,102/1,102; offline v1 = stored v1 2026-27 1,425/1,425; stored v1 2025-26 not reproducible (r 0.746).
- Primary (2025-26, N=10): GD Δ v2−v1 −0.011 [−0.030 block / −0.036 team]; points −0.006 [−0.027 / −0.031]. **Fails the preset rule narrowly** (GD lower bound past −0.03; block held-out calibration GD10/Pts10/GD20 favour v1 with CIs excluding 0; team-cluster CIs all span 0).
- Cause: PDO exclusion only. v2 vs v1-without-PDO within ±0.01 everywhere (tight CIs). v2 beats issued v1 history (+0.052 [+0.008, +0.143] GD10). 2026-27 (descriptive) says dropping PDO helps.
- Report: `production/ctpi-v2-validation-2026-11-13/REPORT.md` + `results.json` + harness `ctpi-v2-validation.ts`.
- Next: ask TJ (pop-up) A approve with PDO as context / B keep gated, re-run January / C candidate-3 with PDO. Code only if A.
- Gotcha: block CIs with < 2 blocks are not estimable (2026-27); the script reports null there.

## Checkpoint 3 — TJ direction (pop-up, 2026-11-13) and follow-through
- TJ: no January wait. **Propose** a display-only v2 beta on the team page ("Descriptive beta · not a forecast"; window, games included, as-of; 5v5 PDO/SH%/SV% alongside as puck-luck context; candidate rows as issued; nothing into projections/rankings/recommendations); bring the display plan before shipping. Predictive use: checkpoints at each team's completed games 10/20/30/40, formal at 40, −0.03 margin unrounded, earlier looks informational, matched v1/v2 PDO on/off, issued v1 separate, uncertainty for shared games and overlapping windows; inconclusive → beta stays descriptive. No relabel, no release from this alone.
- So: **no application code** (brief step 2 not triggered). Docs: `DISPLAY-PLAN.md`, `CHECKPOINT-PROTOCOL.md`; harness `ctpi-v2-checkpoints.ts` (exports added to `ctpi-v2-validation.ts`).
- Extra read (same hygiene): `games` type 2 joined to `teams` for both seasons → schedule CSV (abbreviations match NST; no doubleheaders). `team_ctpi_daily` and `nst_team_5v5` have `public_read` RLS for anon → beta can read client-side, no API route.
- Game-10 look: 32/32 ready, issued = offline 32/32, rank ρ day-to-day 0.963, median move 1.98 pts after a game / 0.17 without.
- Power: 2025-26 rehearsal, batches 10/20/30 (96) → CI ±0.075, inconclusive; dense every-game 10…30 (672) → ±0.035. Open choice for TJ.
- Gotcha: a dev run graded the 16 teams that had reached game 20 (partial batch) before the complete-batch rule existed; numbers discarded and not reported. Script now refuses partial batches (unless `--partial`, diagnostics only) and refuses a premature formal look.
- Gotcha: jackknife collapsed when a batch had exactly MIN teams (LOO fell below MIN) → LOO uses MIN − 1.
- Next: pop-up to TJ (display plan approval; formal set batches vs dense). Then commit docs (explicit pathspecs) and report to Chef.

## Checkpoint 4 — TJ approvals (pop-up, 2026-11-13)
- Display plan: **approved; build in a separate session** (commit only, no release; /superstyle + local screenshots before shipping).
- Formal set: **every completed game 10–30** (adopted before any 2026-27 batch was graded). Script default switched; `--batches-only` kept for reference. Protocol doc marked frozen.
- Re-ran: 2026-27 game-10 look (no batch graded), 2025-26 rehearsals (every-game: pass ±0.035 — power check only; batches: inconclusive ±0.075), premature formal look refused.
- Next: commit docs (explicit pathspecs), start the beta implementation session, report to Chef.
