# Task 4 gate and the combined 3+4 release gate (2026-10-22)

**Verdict: tasks 3+4 together clear on the fantasy-point objective and fix the position biases.** PPP stays over-predicted, mostly for defencemen. Releasing 3+4 is TJ's call. The release candidate on master `40b17b572` is ready: [release-candidate-tasks3-4.patch](release-candidate-tasks3-4.patch), sha256 `9fc1f7af…`.

## Model (task 4)

Priors come from the same TJ-approved aggregate as task 3 ([PRIORS.json](../forge-priors-2026-10-22/PRIORS.json)).

- **Goals per shot.** F/D × ES/PP priors replace the position-blind 0.095 / 0.145. The prior strength is now the measured split-half k in shots, replacing the adaptive 12–72:

  | position | ES prior | ES k | PP prior | PP k |
  |---|---|---|---|---|
  | F | 0.118 | 423 | 0.159 | 155 |
  | D | 0.054 | 704 | 0.086 | 73 |

  This lives in `computeStrengthSplitConversionRates` (position arg) and `resolveSkaterConversionRates` on octoberBranch.
- **SOG/60.** `computeSkaterShotRatePer60` shrinks the all-window rate to the F/D prior by its hours, then blends the last five games by their own hours:

  | position | ES prior | ES k | PP prior | PP k |
  |---|---|---|---|---|
  | F | 6.62 | 8.4 h | 11.23 | 10.3 h |
  | D | 4.11 | 12.3 h | 8.39 | 5 h |

  This replaces taking the last-5 rate outright plus a games-weight shrink toward 6 / 8.
- **Q7 retest (4.2).** I dropped the second goal shrink in a 1-game pilot: forward goals per shot went to 0.154. That's above every prior, because the context goal multipliers compound to about 1.3 (opponent goalie 1.18, shot quality 1.10, on-ice 1.07). **Q7 is not shipped.** The small-sample shrink stays, now toward the F/D prior. It belongs with task 9, which sizes those multipliers.
- **Not done: season-current re-estimation (4.1).** Priors are the 2023-24..2025-26 pooled rates. 2026-27 to date is within noise of them: F ES shooting % 0.123 vs 0.118, D 0.057 vs 0.054. A per-season refresh is a follow-up.

## Gate

Same 62 games. f = d (task 3) + task 4; see [variant-f-over-d.patch](variant-f-over-d.patch).
- Reads: 7,666 GETs, within TJ's per-gate approval.
- Three runs stopped on transient zero-read failures and were resumed. One game was retried on its own.
- 62/62 replays matched.

### Combined 3+4 against the Release B model

From [PAIR-c-vs-f.md](PAIR-c-vs-f.md): 2,079 dressed player-games, seed-1 game-cluster bootstrap.

| head | rel. bias c → f | ΔRMSE [95% CI] | top decile c → f [f CI] | MZ slope c → f |
|---|---|---|---|---|
| **FP** | −10.7% → **−1.0%** | **−0.065** [−0.089, −0.039] | 1.068 → 1.099 [0.97, 1.24] | 0.98 → 1.14 |
| G | −7.5% → −6.9% | −0.006 [−0.009, −0.003] | 0.960 → 1.061 | 0.95 → 1.16 |
| G, D only | **+46.4% → +1.6%** | −0.007 | | |
| G, F only | −15.7% → −8.1% | −0.006 | | |
| A | −26.2% → −3.2% | −0.008 [−0.014, −0.002] | 1.329 → 1.184 | 1.29 → 1.36 |
| SOG | −9.3% → −9.2% | **−0.050** [−0.067, −0.035] | 0.979 → 1.046 | **0.78 → 0.99** |
| PPP | −30.1% → +17.1% | −0.009 (spans 0) | 1.020 → **0.920** [0.64, 1.24] | 0.94 → 0.86 |
| PPP, D only | −34.5% → +43.2% | −0.005 | 1.235 → 0.756 [0.47, 1.05] | |
| PPP, F only | −29.2% → +11.3% | −0.010 | 0.985 → 1.013 | |

HIT and BLK are unchanged.
- **FP deciles:** c ran 1.04–1.37 (under everywhere). f runs **0.90–1.10**.
- **SOG deciles:** d1 1.63 → 1.32.
- **D in the top FP decile:** 35 → 26 (actual 38). D are no longer inflated by goals; their top-end PPP is still high.

### Task 4 alone (f vs d, [PAIR-d-vs-f.md](PAIR-d-vs-f.md))

- RMSE improves on G (−0.006), SOG (−0.050), PPP (−0.005) and FP (−0.031), all with CIs excluding 0.
- PPP top decile improves from 0.767 to 0.920.

## Remaining issue: PPP volume

Actual PPP per goal in the cohort is 0.61, which implies about 21% of goals come on the PP. The model puts 27% of goals on the PP (95 of 351 predicted, against roughly 82 of 392 actual), so ES goals remain under-predicted. PP assists are correctly 1.91 × PP goals, so excess PP goals pass straight into PPP. Likely causes, both for task 9 or a team PP-goal reconciliation:
- context multipliers above 1 on PP conversion;
- D PP shares.

## Checks

- **octoberBranch:** 66 Vitest files (1,401 tests) pass, with new unit tests for the shot-rate prior and position conversion. eslint clean; tsc clean under the heavy lock.
- **Master candidate (rc34):** `lib/projections`, `lib/rosterScheduleData`, `lib/player-forecasts` and the offline qualification pass: 82 files, 2,261 tests. The fixture matches octoberBranch's (`7b8a39a4…`). The candidate inlines the team assist allocation (the gated code); the `allocateTeamAssists` helper and its unit tests exist on octoberBranch only. tsc on the candidate has not been run separately; octoberBranch's tsc covers the same code shape.
