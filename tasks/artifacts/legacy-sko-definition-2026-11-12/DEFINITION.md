# Volatility-Discounted Points Pace (VDP) — the number in `predictions_sko.sko`

Decision 80 definition; TJ chose the name 2026-11-12. Code constant: `VOLATILITY_DISCOUNTED_PACE` in `web/lib/predictions/legacyQuarantine.ts`.

**What it is.** VDP = pace × horizon × multiplier, for one skater as of a date.
- **pace** = 0.6·mean(last 10 appearances) + 0.4·mean(last 5) points per appearance. Unshrunk: no prior, opponent or ice-time term.
- **horizon** = 5 player appearances by default (not scheduled team games).
- **multiplier** = 0.8 + 0.2·(1 − smoothstep((sd10 − 0.8·sd20)/(0.4·sd20))), population SDs of points per appearance. Stored SD10 is `stability_cv` (a population SD, not a CV; served as `stability_sd`).
- **Population** (v0.4): current regular-season appearances only (window clamped to the regular-season start); an unknown game makes every value whose window contains it null; no history → null.

**What it is not.** Not sKO (the sustainability barometer, OWNER-INTENT-SKO-VUDU.md), not a forecast with validated skill, not a sustainability rating. Discounting volatility is a presentation choice, not evidence that steadier is better (decision 32). Unvalidated; compatibility model, not promoted.

**Vetting (R1, tests in `web/__tests__/pages/api/v1/ml/update-predictions-sko.test.ts`).** Multiplier ∈ [0.8, 1]; invariant to x → a·x + b (so "taxes production" is not shown); pace is affine-equivariant; a constant 20-game series → 1.0; every series of ≤ 10 games → 0.9 (sd10 = sd20). "Neutral must be 1" is a policy, not a defect.

**Versions.** v0.2/v0.3 rows are issued history (unchanged, rule 21). v0.4 = this definition.

**Optimization.** One paged source scan replaces ~760 per-player queries plus a discovery scan. No re-weighting: any new weights need held-out evidence under decisions 32/65.

**Production steps (not run; each needs TJ approval).**
1. Pause the cron (decision 129):
   `select cron.alter_job(job_id := (select jobid from cron.job where jobname = 'update-predictions-sko'), active := false);` — check exactly one row first; `web/lib/cron/combinedCronInventory.test.ts` (Codex-owned) lists this job as active.
2. Column rename ticket for L4a: add `stability_sd` (backfill = `stability_cv` for baseline-moving-average v0.2–v0.4) and a VDP-named column/view for `sko`; keep old columns until readers move.
3. Decision 124: one bounded log check of `/api/v1/ml/get-predictions-sko` callers before any gating.
4. Resume the cron only after v0.4 ships and TJ approves.
