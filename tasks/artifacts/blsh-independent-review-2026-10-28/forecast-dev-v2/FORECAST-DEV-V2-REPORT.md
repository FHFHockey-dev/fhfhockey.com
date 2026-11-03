# BLSH development forecast comparison, evaluator v2: exploratory result (re-review pending)

**This is exploratory development evidence, not a performance claim.**
- 2023-24 is exposed development data.
- 2024-25 was excluded, and 2025-26 was not opened.
- The simplified history gate is not proven equivalent to the sealed transport.

This run applies Codex's evaluator review (`CODEX-BLSH-FORECAST-EVALUATOR-REVIEW-20261029`). The v1 run in `../forecast-dev/` is kept unchanged and carries a correction header.

**Protocol:** `../FORECAST-PROPOSAL-v2.md` (`56fecc78…`), unchanged. One under-specified secondary item was defined after the primary results were seen (the composite basis below); it is disclosed here.

**Run:**
- 2026-10-29, local, under the heavy lock, 985 s.
- **Runner status: 1 test passed, no unhandled errors, exit code 0** (`RUN.log`).
- The evaluator now yields between players and sections, and that removed the v1 run's unhandled Vitest error.
- A 60-minute budget is checked as the run goes; once it passes, the run stops before writing anything.
- No database or network access.
- Inputs: the same pins as v1 (history `da32a473…`, catalog `f60056cd…`, `INPUTS.json` `343e7960…`, exporter `b6a4a580…`).

## The primary result is unchanged

A field-by-field comparison with the v1 run found no differences in:
- the funnel and γ;
- the primary metrics, contrasts and decision;
- the team-season clusters;
- the per-60 arms (except the new P1-H entry);
- every subgroup and the floors;
- all 28,876 origins' targets, TOI, ΔX, reference rates, predictions and floors.

So every primary number in the v1 report stands. Codex had already reproduced those numbers independently.

## Corrected and added secondary outputs

**1. Sensitivity schedule: every 5th eligible origin per player, as proposed.** 5,992 origins, 511 players, player-clustered intervals.

| Contrast (MAE, A − B) | FP | G+A | WiGO GS |
|---|---|---|---|
| P2 − P0 | −0.0595 [−0.0750, −0.0454] | −0.0150 [−0.0194, −0.0109] | −0.0189 [−0.0238, −0.0140] |
| P1 − P0 | −0.0592 [−0.0749, −0.0446] | −0.0149 [−0.0190, −0.0109] | −0.0185 [−0.0234, −0.0135] |
| **P2 − P1** | **−0.0003 [−0.0010, +0.0004]** | −0.0001 [−0.0004, +0.0001] | −0.0004 [−0.0009, +0.0000] |
| P2-transfer − P1 | +0.0081 [+0.0038, +0.0123] | +0.0014 [+0.0002, +0.0026] | +0.0074 [+0.0048, +0.0102] |
| P3 − P0 | +0.190 [+0.165, +0.214] | +0.065 [+0.057, +0.074] | +0.076 [+0.067, +0.085] |

On this schedule, P2 − P1 includes zero on every track. The RMSE point estimates for FP and G+A are slightly positive. These numbers replace v1's greedy schedule (6,031 origins); the two schedules' intervals are not interchangeable.

**2. Evidence tier**: v1's tier at each origin. "Measured" means personal process and production references, inside the prior's span and range, with no floor.

| Tier | Origins | Players | FP MAE: P0 / P1 / P2 / P2-transfer / P3 |
|---|---:|---:|---|
| Measured process, personal reference | 26,048 | 494 | 0.801 / 0.742 / 0.741 / 0.746 / 0.985 |
| Provisional (estimated or extrapolated) | 2,828 | 477 | 0.742 / 0.706 / 0.706 / 0.721 / 0.949 |

**By position:**
- Measured: 17,928 forward and 8,120 defence origins (335 and 159 players).
- Provisional: 1,770 forward and 1,058 defence origins (317 and 160 players).

The ordering is the same in both tiers: the reference (P1) does the work, and the support adjustment adds almost nothing.

**3. Secondary composite (labelled secondary).**
- **Definition:** v1's frozen equal-weight normalization, a_t = (1/3) / sd_t / √(w′Rw). The covariance is taken from the 2022-23 training targets (11,712 origins).
- **Weights:** FP 0.278, G+A 0.816, GS 0.695.
- **Disclosure:** the proposal named the formula but not the covariance basis, and I chose this arm-neutral, training-only basis after the primary results were known.

| Arm | Composite MAE |
|---|---:|
| P0 | 0.628 |
| P1 | 0.592 |
| P2 | 0.592 |
| P2-transfer | 0.598 |
| P3 | 0.789 |
| P2 unshrunk | 0.592 |
| P1-H | 0.595 |

**Contrasts:**
- P2 − P0: −0.0369 [−0.0467, −0.0272].
- P1 − P0: −0.0363 [−0.0463, −0.0266].
- P2 − P1: −0.0006 [−0.0012, −0.0001]; its RMSE interval [−0.0011, +0.0002] includes zero.

**4. P1-H coverage.**
- P1-H per-60 now has n = 28,876 on every track. Its rate prediction equals P1's by construction, because P1-H changes only the declared TOI.
- Per appearance, P1-H − P1 is +0.0071 [+0.0022, +0.0122] for FP, +0.0018 [+0.0006, +0.0030] for G+A and −0.0003 [−0.0015, +0.0008] for GS. Declaring TOI from the current window (P1) beats the reference games' mean TOI for FP and G+A.

**Floors:** no P2, P2-unshrunk or P2-transfer prediction needed the zero floor.

## Reading (exploratory; unchanged in substance)

1. **The production reference (P1) clearly beats last season's mean (P0) on every track, schedule and tier.**
2. **The support adjustment adds almost nothing.**
   - P2 − P1 is about 1% of P1 − P0.
   - Its interval includes zero on the proposed every-5th schedule (all tracks), for FP and G+A RMSE, and for the composite RMSE.
   - The pre-registered rule formally reads "promise", but that rule asked only for a negative P2 − P1 point estimate.
   - **Before any reserved 2025-26 run is frozen, TJ should decide whether the primary question becomes P2 − P1, with a declared minimum useful size.**
3. **Reusing the retrospective coefficient forward (P2-transfer) is worse than P1**, and recent form (P3) is worst.
4. **None of this changes the retrospective tool.**

## Files

- `RESULTS.json`: adds `everyFifthSchedule`, `secondaryComposite`, `coverage.evidenceTierByPosition`, `subgroups.evidenceTier` and P1-H per-60. The `nonOverlapping` key is replaced by `everyFifthSchedule`.
- `ORIGINS.jsonl`: each origin now carries `evidenceTier`.
- `RECEIPT.json` and `RUN.log` (exit 0).
- Code:
  - `forecastEvaluation.ts` (`10543e5c…`)
  - `forecastEvaluation.test.ts` (`5775e7b7…`)
  - `forecastDevRun.test.ts` (`4bacedc2…`)

## Addendum, 2026-10-29: deadline at the publication boundary (Astra re-review of CLAUDE-121)

The re-review closed six of seven findings. The remaining gap was that expiry during the final calculation could still return results and reach the output writes. Fixed in code only; **the outputs above are unchanged and were not rerun**.
- **Evaluator:** after the last aggregation, the evaluator checks the deadline again before returning.
- **Runner:**
  - Every payload is serialized first.
  - `publishBeforeDeadline` then checks the deadline immediately before the output directory is created.
  - Nothing is created or written once the deadline has passed.
- **Regressions:**
  - Expiry after the last checkpoint rejects with no result.
  - Expiry after a successful evaluation makes zero directory or file operations.
  - A within-budget control creates the directory first, then every file.
- The guard is cooperative, not hard preemption at exactly 60 minutes.

**Hashes:** `forecastEvaluation.ts` `8d7f9c4a…`, `forecastEvaluation.test.ts` `33a86d0c…`, `forecastDevRun.test.ts` `1ce7764e…`. The run above was made with the previous hashes (`10543e5c…`, `4bacedc2…`). The only change is this guard.

**Smoke check (a cost check, not a result).** A 40-player run of the corrected runner gave:
- exit 0, no unhandled error, with the exit line inside the log;
- `RESULTS.json` identical, apart from the version label, to the 40-player smoke made before the fix.

Its log is `deadline-fix-smoke/RUN.log`.
