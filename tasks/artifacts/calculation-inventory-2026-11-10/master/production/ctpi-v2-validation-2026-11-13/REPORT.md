# Lane F5: Recent Team Form v2 (CTPI v2) held-out validation against v1 (2026-11-13)

## Verdict

**Under the rule fixed before the run, v2 is not shown to be at least as good as the v1 formula, but the miss is narrow.**

- **The gap.** On 2025-26, v2 predicts next-10-game goal differential per game slightly worse than v1: mean per-day Spearman ρ is 0.261 against 0.273, Δ −0.011.
  - The 95% lower bound of Δ is −0.030 under the block bootstrap and −0.036 under the team bootstrap. The non-inferiority margin was −0.03.
  - For points%, Δ is −0.006 [−0.027, +0.013], which passes under the block bootstrap.
- **The cause.** The whole gap comes from one design choice: v2 drops v1's 10% PDO ("luck") term. Against v1 without PDO, v2 ties within about ±0.01 on every target and horizon, with tight CIs.
  - Pooled PP/PK (decision 20), null handling, the 5-game minimum and the bounded display therefore cost nothing measurable.
- **The value of PDO is unstable.** It helps in 2025-26 and hurts in early 2026-27, though 2026-27 is descriptive only (fewer than two bootstrap blocks).
  - Batch A's review already flagged this: "Removing PDO is a model change that needs holdout validation" (BATCH-A-CONSOLIDATED.md:148).
- **Against the v1 rows actually issued in 2025-26,** v2 is better: Δρ +0.052 [+0.008, +0.143] at GD10.
- **Against naive baselines,** both versions beat season-to-date GD/game and points%.

So it is an owner decision: is PDO part of Recent Team Form? If it is not (rule 16: a disclosed estimand), v2 passes against v1 without PDO, and the approval change in brief step 2 applies. If it is, v2 fails, and the options are below. No code was changed before that decision.

## TJ's direction (2026-11-13) and what follows from it

TJ did not choose any of options A, B or C below. The direction instead:
- **Descriptive beta now.** A display-only CTPI v2 beta on the team page, labelled "Descriptive beta · not a forecast". It shows its window, the games included and the as-of date, with 5-on-5 PDO, SH% and SV% beside it as separate puck-luck context.
  - Candidate rows stay as issued, and the beta feeds no projections, rankings or recommendations.
  - TJ sees the display plan before anything ships.
- **Predictive use waits for a checkpoint protocol.** Checkpoints are each team's completed games 10, 20, 30 and 40, with the formal decision at 40.
  - The −0.03 margin is kept and judged unrounded; earlier looks are informational.
  - Matched v1 and v2 are compared with PDO on and off; issued v1 is reported separately.
  - Uncertainty accounts for shared games and overlapping windows.
  - If the result is inconclusive, the beta stays descriptive and predictive use stays gated.
- **Nothing is relabelled or released** on the strength of this direction alone.

Deliverables in this folder:
- `DISPLAY-PLAN.md`: the beta display plan for TJ's review. Nothing is built or shipped.
- `CHECKPOINT-PROTOCOL.md` plus `ctpi-v2-checkpoints.ts`: the protocol, the harness, and the game-10 look, run 2026-11-13.
  - Coverage: 32 of 32 teams ready; issued rows equal the offline recompute.
  - Stability: day-to-day rank ρ 0.963.
  - A 2025-26 rehearsal shows that the batch-only formal set (96 forecasts, about ±0.075) is very likely to end inconclusive. An every-game 10…30 set (672 forecasts, about ±0.035) can decide. **TJ adopted the every-game set on 2026-11-13** and approved the display plan, to be built in a separate session (commit only, no release; /superstyle and local screenshots before shipping).
- **No application code changed.** The approval change in brief step 2 is not written, because v2 did not pass the preset rule and TJ chose the beta-plus-checkpoints route instead.

## Data, information set, and read hygiene

| Item | Value |
|---|---|
| Production reads | One pass, 2026-11-13, read-only via psql `\copy`, after `pg_stat_activity` (2 active, longest 1 s). Inputs: the four NST team game-log tables (selected columns, `gp = 1`, seasons 20252026 and 20262027) and stored `team_ctpi_daily` scores (`ctpi_version, season_id, team, date, ctpi_raw, ctpi_0_to_100`; no payload/jsonb). No writes, no NST/NHL calls. |
| Seasons available | Only 2025-26 (regular season 2025-10-07 → 2026-04-16, 2,534 rate rows / 2,556 result rows, 32 teams, 163 game days, Olympic gap in February) and 2026-27 to date (09-29 → 11-12, 618 rows, 45 game days). No earlier seasons in the database; the multiseason script fetches from NST, so it was not used. |
| v1 | `computeTrendMetrics` + `computeCtpi` (`web/lib/trends/ctpi.ts`, `ctpi-formula-v1`), score = `ctpi_raw` |
| v2 | `buildRecentTeamFormCandidateSnapshot` (the writer's own path), `recent-team-form-v2-candidate-2`, score = `ctpi_raw` (the 0–100 display is monotone in raw, so rank results are identical) |
| Information set | Games **strictly before** snapshot date D for both versions (v2's contract; v1 is given the same cutoff so only the formula differs) |
| Targets | The team's next N games dated on or after D: GD/game = mean(GF − GA); points% = Σ points ÷ 2N (NST all-situations counts; W = 2, OTL = 1). N = 5, 10 (primary), 20 |
| Sample | Every game day D × team where **both** versions score (paired; v2 needs ≥ 5 prior games) and N future games exist. 2025-26: 4,900 paired team-dates; 4,331 with N = 10. 2026-27: 1,070; 385 with N = 10; none with N = 20 |
| Agreement | v1 vs v2 on paired team-dates: Pearson 0.969, Spearman 0.963 (2025-26); 0.985, 0.979 (2026-27) |

### Harness checks (offline equals production)

| Check | Result |
|---|---|
| Offline v2 vs stored v2 candidate rows, 2026-27 | 1,102 / 1,102 equal (max abs diff 0); no rows missing on either side |
| Offline v1 (games through D) vs stored v1, 2026-27 | 1,425 / 1,425 equal |
| Offline v1 (games through D) vs stored v1, 2025-26 | **Not reproducible.** 8,019 compared, 32 exact, Pearson 0.746, max abs diff 2.10, 45 stored-only rows. The issued 2025-26 history came from earlier code or earlier source rows; the cause is not established here. In this report, "v1" means the frozen v1 formula as it ships today; "issued v1" means those stored rows. |

## Decision rule (written in the diary before results)

- **Primary:** 2025-26, N = 10, both targets. Statistic: the mean over game days of the cross-sectional Spearman between score and target, comparing teams within a date. Δ = v2 − v1.
- **Uncertainty:** a moving-block bootstrap over ordered game days (block of 20 game days, about one 10-game window; 2,000 replicates; fixed seed).
- **Pass ("at least as good"):** the lower 95% bound of Δ is ≥ −0.03 for both targets, and no secondary result shows v2 worse with a CI that excludes 0.
- **Secondaries:** N = 5 and 20; held-out calibration skill; 2026-27 out of time.
- **The margin of 0.03 is a hypothesis** (rule 12), not a fitted value.
- **Held-out by construction.** Neither formula's weights were fitted on these seasons: v2 reuses v1's hand-set component weights, and v2's logistic slope does not change ranks. So the rank statistics are already out of sample.
- **Calibration check:** fit y = a + b·score on training rows whose whole target window ends before the split, then score the test rows.
  - Splits: 2025-26 Oct–Dec → Jan–Apr, and all of 2025-26 → 2026-27.
  - Skill = 1 − MSE ÷ MSE(training mean).

## Results

### Primary (2025-26, N = 10)

| Target | v1 | v2 | v1 without PDO | Season-to-date GD | Δ v2 − v1 [95% block] | Δ v2 − v1 [95% team cluster] | Δ v2 − v1 without PDO [block] |
|---|---|---|---|---|---|---|---|
| GD/game | 0.273 | 0.261 | 0.263 | 0.216 | **−0.011 [−0.030, +0.008]** | [−0.036, +0.015] | −0.001 [−0.010, +0.009] |
| Points% | 0.219 | 0.213 | 0.211 | 0.133 | −0.006 [−0.027, +0.013] | [−0.031, +0.019] | +0.003 [−0.008, +0.018] |

- 135 game days (2025-10-18 → 2026-03-24), 31.8 teams per date.
- The CIs for each version's own mean ρ are wide (v2 GD10 0.212–0.344): this measures day-to-day signal over one season, n = 1 season.
- Two runs with different seed sequences gave GD10 lower bounds of −0.0305 and −0.0301. The result sits on the margin either way, and it fails under the more conservative team bootstrap.

### Other horizons (2025-26, mean per-day Spearman; Δ with block CI)

| Target | v1 | v2 | Δ v2 − v1 | Δ v2 − v1 without PDO |
|---|---|---|---|---|
| GD, N = 5 | 0.206 | 0.204 | −0.002 [−0.023, +0.012] | −0.004 [−0.010, +0.004] |
| Points%, N = 5 | 0.161 | 0.163 | +0.002 [−0.024, +0.022] | +0.002 [−0.006, +0.013] |
| GD, N = 20 | 0.270 | 0.263 | −0.006 [−0.030, +0.024] | −0.003 [−0.009, +0.008] |
| Points%, N = 20 | 0.203 | 0.204 | +0.001 [−0.028, +0.036] | +0.005 [−0.008, +0.022] |

### Held-out calibration (skill vs training mean; RMSE)

| Split, target | v1 skill | v2 skill | Δ v2 − v1 [block] | Δ [team cluster] | Δ v2 − v1 without PDO [block] |
|---|---|---|---|---|---|
| 2025-26 Jan–Apr, GD5 | 0.062 | 0.062 | −0.000 [−0.010, +0.010] | [−0.011, +0.011] | −0.001 [−0.005, +0.006] |
| 2025-26 Jan–Apr, Pts5 | 0.047 | 0.046 | −0.001 [−0.010, +0.008] | [−0.012, +0.009] | −0.001 [−0.006, +0.006] |
| 2025-26 Jan–Apr, **GD10** | 0.126 | 0.114 | **−0.012 [−0.023, −0.008]** | [−0.031, +0.008] | −0.001 [−0.008, +0.008] |
| 2025-26 Jan–Apr, **Pts10** | 0.083 | 0.078 | **−0.005 [−0.018, −0.000]** | [−0.022, +0.011] | 0.000 [−0.005, +0.006] |
| 2025-26 Jan–Apr, **GD20** | 0.119 | 0.106 | **−0.014 [−0.028, −0.006]** | [−0.044, +0.018] | −0.002 [−0.009, −0.001] |
| 2025-26 Jan–Apr, Pts20 | 0.064 | 0.067 | +0.003 [−0.012, +0.010] | [−0.022, +0.026] | +0.002 [−0.003, +0.002] |
| 2025-26 → 2026-27, GD5 | 0.130 | 0.143 | +0.013 (CI n/a) | — | −0.004 |
| 2025-26 → 2026-27, GD10 | 0.260 | 0.257 | −0.003 (CI n/a) | — | −0.018 |
| 2025-26 → 2026-27, Pts10 | 0.225 | 0.218 | −0.006 (CI n/a) | — | −0.017 |

- **GD10 RMSE, Jan–Apr 2025-26:** v1 0.873, v2 0.878, season-to-date GD 0.911, training mean 0.933. v2 is 0.65% worse than v1.
- **Block bootstrap (bold rows):** v1 is better, with CIs that exclude 0. These test windows hold only about 2–3 blocks (47–77 test days), so the block CIs are likely too narrow. Under the team bootstrap, every calibration CI includes 0.
- **2026-27:** 12–30 test days, fewer than two blocks, so CIs are not estimable. Treat these rows as descriptive.

### 2026-27 out of time (descriptive; about one independent window)

| Target | v1 | v2 | v1 without PDO | v2 + PDO (exploratory) |
|---|---|---|---|---|
| GD, N = 5 (24 days) | 0.303 | 0.321 | 0.322 | 0.296 |
| Points%, N = 5 | 0.298 | 0.304 | 0.307 | 0.291 |
| GD, N = 10 (12 days) | 0.476 | 0.460 | 0.486 | 0.453 |
| Points%, N = 10 | 0.485 | 0.457 | 0.495 | 0.459 |

Dropping PDO helps in every 2026-27 row, in both v1 and v2. In 2025-26 it hurts. One season says keep PDO; the other, too small to estimate, says drop it.

### Against the v1 rows actually issued (2025-26 stored row for D − 1, i.e. games before D)

| Target | Issued v1 | v2 | Δ v2 − issued v1 [block] |
|---|---|---|---|
| GD, N = 5 | 0.165 | 0.204 | +0.039 [+0.007, +0.094] |
| GD, N = 10 | 0.209 | 0.261 | **+0.052 [+0.008, +0.143]** |
| Points%, N = 10 | 0.172 | 0.213 | +0.041 [−0.014, +0.143] |
| GD, N = 20 | 0.223 | 0.263 | +0.040 [−0.016, +0.149] |

### Exploratory: v2 + PDO (v1's hand-set 0.1 weight added back; not fitted, rule 12)

- **2025-26:** it recovers v1. Δ v2 + PDO − v1 is GD10 +0.002 [−0.006, +0.013] and Pts10 +0.006 [−0.002, +0.021].
- **2026-27:** it is worse than plain v2 (GD10 0.453 against 0.460).
- **Not a basis for a candidate:** evidence across seasons is unstable, and choosing the weight on 2025-26 and then testing on 2025-26 would not be held-out.

## Interpretation

1. **Decision 20 is not the issue.** v2 against v1 without PDO is within ±0.01 ρ on every target and horizon, with the tightest CIs in the study. Pooled PP/PK, null handling, the 5-game minimum and the bounded 0–100 display are predictively neutral.
2. **The only measurable difference is PDO's 10% weight.** In 2025-26, recent PDO carried a little forward-looking signal for goal differential, which is plausible: shooting and save talent persist partly. That signal was absent or reversed in early 2026-27.
3. **The effect is small.** It is about 0.01 ρ, or 0.65% of RMSE, on a signal that predicts about 11–13% of next-10-game GD variance. The 2025-26 seasonal CI for each version's own ρ (about ±0.07) is far wider than the gap.
4. **v2 beats what users saw.** Users saw issued v1 in 2025-26, and v2 is clearly better than that history. Today's v1 formula (2026-27 issued rows) is reproduced exactly.

## Options put to TJ (superseded by TJ's direction above)

| Option | What happens | Code now | Production |
|---|---|---|---|
| **A. Approve v2; PDO stays context only** (disclosed estimand, rule 16) | v2 passes against v1 without PDO. The approval change (brief step 2) is written: the writer issues `approved` for snapshot dates from a stated date. Status is fixed when a date is first issued, so stored candidate rows are never relabelled. Re-run this harness when 2026-27 reaches about 40 games per team (mid-January) to revisit PDO with a second estimable season. | `ctpiVersions.ts`, `recentTeamFormV2Materialization.ts`, the writer, and tests. Commit only; no release. | Release (TJ approval). The first date issued after the release is the first approved date. No re-issue. |
| **B. Keep gated; re-validate in January** | No code. Recent Team Form stays dark. Re-run this harness unchanged on 2026-27 with about 40 games per team; approve only if the same rule passes. | None | None |
| **C. Candidate-3 with PDO** | A new formula version (v2 + PDO term) with its own preregistered validation. Candidate-2 rows stay as issued. The 2026-27 evidence currently points against adding PDO. | A new formula version and its tests | New rows and a later validation |

## Reproduction

From `web/`, with the five CSVs in a directory (`as_rates.csv`, `as_counts.csv`, `pp_counts.csv`, `pk_counts.csv`, `ctpi_stored.csv`, columns as in the script):

```bash
NODE_PATH=. npx ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node"}' ../tasks/artifacts/calculation-inventory-2026-11-10/master/production/ctpi-v2-validation-2026-11-13/ctpi-v2-validation.ts --data=<csv dir> --out=<results.json>
```

Aggregate output: `results.json` (this folder). Runtime is about 90 s, mostly the team bootstrap. The CSVs are not committed because they are raw production rows; the SQL is in the diary (`tasks/diaries/2026-11-13-claude-ctpi-v2-validation.md`).
