# BLSH personal baseline (decision 1): implementation and development evaluation

2026-11-04 · Claude · branch `octoberBranch` · research only (nothing here is trusted, adopted or released)

## Summary

- **Implemented** TJ's decision 1 as a new assembly arm, `C_weighted_personal_baseline`. Arms A and B are unchanged, so earlier dry runs still reproduce.
  - The baseline: up to three completed seasons weighted 0.6/0.3/0.1, plus current-season games before the window.
  - Weights apply per unit of exposure: games for per-game rates, TOI for per-60 rates.
  - The window and every later game are excluded by construction. Unknown history is never treated as zero.
- **Current-season weight: 1.0 per game**, against 0.6 for last season's games. TJ chose this in a pop-up after the first development run, where 1.0 beat my a-priori 0.6 on every track. It is frozen for the reserve test.
- **Data:** with TJ's approval, 2024-25 was read from Supabase: one read-only transaction, 47,224 WGO rows. **2025-26 was not read**; TJ keeps it as an untouched reserve. A 2026-27 baseline therefore lacks its 0.6-weighted most recent season. It is labelled incomplete (`missingSeasons: [20252026]`), never treated as zero.
- **Development evaluation** (2023-24 and 2024-25 origins; 5,605 windows; 768 players):
  - The weighted baseline beats the prior-season baseline on every track and unit, by a wide margin.
  - It beats the 82-game baseline by a small margin. That is significant on per-60 and on per-game points and Game Score; on fantasy points per game, it is significant overall but not in 2024-25 alone.
  - The 0.1 tier could not be tested at all, and the 0.3 tier only in 2024-25.
- **The ~20-game cutoff** would withhold:
  - 3.9% of development windows;
  - 16.7% of 2026-27 players with a full window, while 2025-26 stays reserved;
  - in the real-data arm-C run, 151 of 729 profiles, 109 of them otherwise numeric.

## 1. The baseline (`web/lib/buyLowSellHigh/productionReference.ts`)

`weightedBaseline(games, season, before, coveredSeasons, weights?)`, version `weighted-personal-baseline-v1`.

| Rule | Definition |
|---|---|
| Lookback | The three completed seasons before `season`, weighted 0.6 / 0.3 / 0.1, most recent first (`PRIOR_SEASON_WEIGHTS`). Older seasons are excluded. |
| Current-season blend | Games of `season` dated strictly before the window count `CURRENT_SEASON_WEIGHT` = **1.0** per game. |
| Exposure weighting | `rate = Σ w·total / Σ w·exposure` (Marcel-style). Per game: exposure = games. Per 60: exposure = TOI, ×3600. Both use the same games. Three full seasons give shares of exactly 0.6/0.3/0.1. A 41-game season counts half as much as an 82-game one. |
| Window exclusion | `date < before` (the window's first date) is enforced inside the function, whatever the caller passes. |
| Usable game | GP = 1, TOI > 0, and the headline FHFH fantasy-points track known. Other games count as `unusableGames` and are excluded from numerators and denominators alike. |
| Missing secondary track | Left out of that track's rate only (`trackGames`). Example: Game Score when on-ice goal fields are null. |
| Missing season | A lookback season the history source does not cover is listed in `missingSeasons` and labelled; it is never treated as zero games. |
| `status` | `personal` when there is at least one usable game. `confirmed_none` only when there are no lookback games at all and every lookback season is covered. Otherwise `unknown`. |
| `insufficient` | Fewer than 20 usable games (`INSUFFICIENT_HISTORY_GAMES`, provisional). The lists apply the withholding, not the scorer. |
| Scorer input | `weightedHistorySummary` passes per-second rates and **Kish effective seconds** `(Σ w·T)² / Σ w²·T` to the unchanged shrinkage in `personalReference`. Weighting discards information, so the personal weight is lower than raw TOI would give. |

Season shares are reported per baseline (`seasons[].share`), so a reader can see how much of the baseline is current-season evidence. Median across 2026-27 full-window players: 21%.

### Comparable units (`currentWindows.ts`, `Profile.comparisons`)

Every profile, in every arm, now carries two comparisons over the same five games:

- `per_game`: window total ÷ games, against the reference's per-game rate.
- `per_60`: window total ×3600 ÷ window TOI, against the reference's per-60 rate.

Each holds `window`, `reference` and `delta` arrays in `PRODUCTION_TRACKS` order: fantasy points, raw points, WIGO Game Score. A null is unavailable, never zero.

- Arm C's reference is the weighted baseline. Arms A and B use unweighted rates over their 50 reference games.
- The comparisons use the player's own unshrunk baseline. The scored gap still uses the shrunk reference at the window's TOI, as before.

### Arm C assembly

- Reference games are the baseline's usable games. Production and identity checks use them, unchanged.
- **Process reference (provisional rule).** Weighted per-60 over the reference games whose process value qualified. It counts as personal only when those games carry at least half of the weighted reference TOI; otherwise the scorer's cohort mode is used, with a coverage note.
  - The old all-or-nothing rule fails almost any 150-game reference; with 2024-25 raw rows it left 600 of 729 arm-A references unusable in the smoke run.
- Explanation context totals over the reference games stay **unweighted**: the frozen explainer needs whole-game counts. Every arm-C profile carries the coverage note `reference_context: explanation_reference_totals_unweighted_over_baseline_games`.

## 2. History data

- New sibling script: `web/scripts/blsh/export_db_history.py`. `export_dev_history.py` is unchanged, because the pinned dry run checks its hash.
- `capture` stage: one psql connection, `REPEATABLE READ READ ONLY`, 60 s statement timeout. The count query runs first and stops the run if a bound is exceeded (60,000 rows per table; 1,700 games). Then four SELECTs; no writes, provider calls or NST calls.
- `build` stage: verifies the capture hashes and writes `db-history.jsonl` in the dev-history row shape. Every NST match is kept, so the existing one-match gate decides.
- Run 2026-11-04 00:09 UTC: transaction `read_only=on`, `repeatable read`; 14 s.
- Counts: WGO 47,224; NST individual 50,478; NST on-ice 50,473; games 1,522. Bound not exceeded.
- Output: 47,224 regular-season rows, none skipped, `db-history.jsonl` SHA-256 `3b4e6429…5fb3a`.
- Files, outside the repo: `/Users/tim/Documents/Claude/2026-11-04/blsh-baseline/` (`capture-20242025/` with receipt, `history-20242025/` with receipt).
- Data-quality findings in 2024-25:
  - 10,600 of 47,224 rows (22%) have null on-ice goal fields, so the Game Score track is unknown for those games. This is the class Codex repaired for 2026-27 (NULL→0), but it is unrepaired here and treated as unknown.
  - 89 rows have no NST individual match and 94 no on-ice match.
  - 107 rows have NST TOI ≠ WGO TOI and fail the gate.

## 3. Development evaluation

`web/scripts/blsh/baselineEvaluation.test.ts` is opt-in and evaluates the shipped `weightedBaseline` function, not a copy. Inputs are SHA-256-pinned.

Output: `/Users/tim/Documents/Claude/2026-11-04/blsh-baseline/eval-02/EVALUATION.json`, SHA-256 `84d2f545…7c9a`. `eval-01` is the run with current weight 0.6 that informed TJ's choice.

**Design**

- Origins: the 15th of November, December, January, February and March in 2023-24 and in 2024-25.
- Window: the player's last five usable games on or before the origin, the last within seven days.
- Baselines: every one uses only games strictly before the window.
- Target: the player's next 10 to 20 usable games of the same season after the origin.
- Error: baseline rate − target rate, in the same unit.
- Comparison set: only windows that every baseline can score (5,383 of 5,605).
- Uncertainty: paired ΔMSE against the frozen weighted baseline, with a 95% CI from 1,000 seeded player-cluster bootstrap resamples. A positive ΔMSE means the alternative is worse.

**What could be tested.** History covers 2022-23 to 2024-25.

- 2023-24 origins have only the 0.6 tier (2022-23); 2021-22 and 2020-21 are missing.
- 2024-25 origins have the 0.6 and 0.3 tiers; 2021-22 is missing.
- The 0.1 tier and the full three-season shape are therefore **untested**. They are first testable on the reserve.

**All development origins** (RMSE; ΔMSE vs weighted [95% CI]):

| Baseline | FP / game | FP / 60 | Points / game | Points / 60 | Game Score / game | Game Score / 60 |
|---|---|---|---|---|---|---|
| **Weighted 0.6/0.3/0.1, current 1.0** | **0.575** | **1.855** | **0.193** | **0.656** | **0.240** | **0.891** |
| Last 82 games | 0.582; +0.0075 [+0.0018, +0.0132] | 1.876; +0.078 [+0.029, +0.125] | 0.196; +0.0011 [+0.0005, +0.0016] | 0.664; +0.011 [+0.005, +0.018] | 0.243; +0.0013 [+0.0005, +0.0021] | 0.901; +0.017 [+0.006, +0.029] |
| Prior season only | 0.660; +0.104 [+0.087, +0.122] | 2.090; +0.926 [+0.720, +1.164] | 0.217; +0.0099 [+0.0080, +0.0118] | 0.730; +0.104 [+0.079, +0.130] | 0.279; +0.020 [+0.016, +0.024] | 1.033; +0.272 [+0.207, +0.344] |
| Last 50 games (arms A/B) | 0.583; +0.0094 [−0.0010, +0.0194] | 1.918; +0.239 [+0.155, +0.325] | 0.198; +0.0020 [+0.0009, +0.0031] | 0.680; +0.033 [+0.022, +0.044] | 0.242; +0.0011 [−0.0003, +0.0025] | 0.904; +0.024 [+0.003, +0.042] |
| Current weight 0.3 | 0.603; +0.033 [+0.026, +0.040] | 1.895; +0.152 [+0.084, +0.224] | — | — | — | — |
| Current weight 0.6 (a priori) | 0.586; +0.012 [+0.009, +0.016] | 1.865; +0.037 [+0.007, +0.069] | 0.195; +0.0009 [+0.0005, +0.0012] | 0.657; +0.002 [−0.002, +0.006] | — | — |
| Current weight 1.5 | 0.570; −0.006 [−0.008, −0.004] | 1.860; +0.019 [−0.006, +0.044] | 0.192; −0.0002 [−0.0005, +0.0001] | 0.659; +0.005 [+0.002, +0.008] | 0.238; −0.0011 [−0.0015, −0.0007] | 0.888; −0.006 [−0.011, −0.000] |

**By season** (FP per game; FP per 60):

| Origins | Windows | Weighted | 82-game ΔMSE | Prior-season ΔMSE |
|---|---|---|---|---|
| 2023-24 | 2,729 | 0.581; 1.872 | +0.0066 [+0.0006, +0.0129]; +0.023 [−0.043, +0.083] | +0.112 [+0.088, +0.135]; +0.845 [+0.610, +1.111] |
| 2024-25 | 2,654 | 0.569; 1.838 | +0.0084 [−0.0008, +0.0177]; +0.135 [+0.052, +0.217] | +0.097 [+0.073, +0.124]; +1.009 [+0.674, +1.356] |

**By position** (FP per game, ΔMSE of the 82-game baseline):

- Forwards: +0.0107 [+0.0019, +0.0186], 3,561 windows.
- Defence: +0.0013 [−0.0046, +0.0070], 1,822 windows.

**Reading:**

- The prior-season-only baseline is clearly the worst. It throws away current-season games and every older season.
- The weighted baseline's edge over the last 82 games is real but small: about 1% of RMSE. It is largest on per-60 and among forwards.
- All baselines over-predict future production slightly (bias +0.05 FP per game). That is consistent with ageing and role churn; no baseline corrects it.
- **Selection caveat:** current weight 1.0 was chosen on these same development windows. Its edge over 0.6 in this table is in-sample. The reserve test is the honest check.

## 4. What the ~20-game cutoff would withhold

| Population | Windows / players | Below 20 usable games | Of which 1–19 games | Of which unknown, 0 usable | Confirmed none |
|---|---|---|---|---|---|
| Development origins, all | 5,605 | 221 (3.9%) | 214 | 7 | 0 |
| 2023-24 origins | 2,858 | 128 (4.5%) | 123 | 5 | 0 |
| 2024-25 origins | 2,747 | 93 (3.4%) | 91 | 2 | 0 |
| 2026-27 full-window players (to 10-28, 2025-26 reserved) | 624 | 104 (16.7%) | 101 | 3 | 0 |
| Arm-C real-data run, all 729 profiles | 729 | 151 | 124 | 27 | 0 |

- **No development window is "confirmed none".** Every development origin lacks at least one lookback season (2021-22), so zero history is always unknown there.
- **2026-27 is inflated by the reserve.** Players whose first NHL games came in 2025-26 have no usable history until 2025-26 is released. The 16.7% will fall once it is.
- **Error below the cutoff.** On the 104 comparable windows below 20 games, FP-per-game RMSE is 0.626 (20+ games: 0.574) and FP per 60 is 2.95 (20+ games: 1.83).
  - Small-sample per-60 baselines are much noisier, which supports withholding direction there.
  - In that group, the 82-game and 50-game baselines (identical below 20 games) are slightly better than weighted on per-game, with the CI crossing 0. Heavier current-season weight hurts small samples.

Method notes:

- The 2026-27 row uses WGO rows directly. It is a count of history size, not a score.
- The arm-C row is a full `assembleProfiles` run on the 2026-10-28 capture, using verified inputs and no overlay.

## 5. Real-data arm-C run (2026-10-28 capture, verified inputs)

- 729 profiles; 551 numeric (the same count as arm A on the same inputs); 503 with a measured personal process reference.
- Median personal games: 132. History status: 702 personal, 27 unknown.
- 3–4 profiles per feature fell back to the cohort process reference under the 50%-coverage rule.
- The run completed without errors. Explanation reconciliation residuals were not tallied in this run; the unit test checks them on synthetic data.
- Example, player 8470613:
  - 172 games: 2024-25 82 (share 0.60), 2023-24 82 (0.20), 2026-27 8 (0.20); 2025-26 marked missing.
  - FP per game: window 1.82 against baseline 1.64. FP per 60: 6.78 against 4.89.
- Throwaway harness, not committed. Output: `/Users/tim/Documents/Claude/2026-11-04/blsh-baseline/arm-c-smoke.json`.

## 6. Interface for the lists lane (`Profile.reference`)

- `personalN` (unchanged meaning): usable personal games behind the scored reference; 0 when the reference is the cohort's.
- `historyStatus`: `"personal" | "confirmed_none" | "unknown"`. This is the field that tells unknown history from confirmed zero.
  - `confirmed_none` only when the player has no lookback games at all and the source covers all three prior seasons.
  - `unknown` when a prior season is missing from the source or every lookback game was unusable. It is also `unknown` in arm C when `personalN` is 0 but usable games exist, for example a mixed-position cohort fallback.
  - Arms A and B use the same definition. With the 2022-24 source, a player without rows is `unknown`, because 2024-25 and 2025-26 are missing. Today's mapper treats `personalN === 0` with no reference games as confirmed zero; please switch it to `historyStatus`.
- `missingSeasons`: prior seasons the source does not cover. In 2026-27 this is `[20252026]` while the reserve holds. Show it as "baseline incomplete: 2025-26 not included".
- `insufficientHistory`: `personalN < 20`. Withhold buy/sell direction and show cohort context with the insufficient-history label (decision 1).
- `baseline`: arm C only. A `WeightedBaseline` with `perGame`, `per60`, per-season `seasons[]` (`weight`, `covered`, `games`, `seconds`, `share`), `unusableGames` and `trackGames`.
- New `Profile.comparisons`: `[{ unit: "per_game" | "per_60", window, reference, delta }]` for the matching-unit display (decision 1, and decision 3's per-game comparison).
- New reason `personal_history_unknown_cohort`: the cohort reference was used because history is unknown, not absent.

## 7. Codex: parser changes and repackaging (not done; Codex-leased files)

`researchSnapshot.ts` changes needed to accept an arm-C snapshot:

1. **Line 152, `referencePolicy`:** accept `policy.arm === "C_weighted_personal_baseline"`. For arm C, `stale` must be false. Add a required `incomplete` flag with `missingSeasons: [20252026]` while the reserve holds.
2. **Line 171, development reference custody** (rejects reference dates after 2024-04-18 and seasons other than 2022-23/2023-24). For arm C, replace it with:
   - reference seasons ⊆ {20232024, 20242025, 20262027}, never 20252026 while reserved;
   - reference dates ≤ `eventThroughDate` and strictly before the window (the line-170 check stays);
   - no reference date in 2022-23 or earlier.
3. **Line 148, `eventThroughDate` allowlist:** add the new capture date when repackaging.
4. **New display fields** once the lists lane maps them: validate `historyStatus` ∈ the three values; `confirmed_none` ⇒ `personalGames === 0` with no reference games; `insufficientHistory` ⇔ `personalGames < 20`; and no listed profile with `insufficientHistory`.
5. **Comparisons:** each unit has three tracks, `delta = window − reference` within tolerance, and null wherever either side is null.

**Repackaging steps**

1. Re-run `assembleProfiles` with arm C on the frozen capture. Inputs:
   - `history` = dev-history.jsonl (`da32a473…`) + db-history.jsonl (`3b4e6429…`);
   - `coveredSeasons: [20222023, 20232024, 20242025]`;
   - the same block catalog and overlay as the canonical snapshot.
   `currentDryRun.test.ts` (not mine) runs arms A and B only. It needs `C_weighted_personal_baseline` and the db-history pin added.
2. Build the display snapshot with the lists lane's mapper. Write it to a new file, leaving the old ones as they are.
3. Apply the parser changes above. Re-pin `CURRENT_SNAPSHOT_PATH`/`SHA256` in `researchSnapshot.server.ts` and the counts in the preview tests.
4. Player Cards' `RETAINED_BLSH_SHA256`: re-pin only after review.

## 8. Frozen protocol for the 2025-26 reserve test (proposed, not run)

Frozen:

- the method in `productionReference.ts` at this commit;
- prior weights 0.6/0.3/0.1, current weight 1.0, the 20-game cutoff;
- the evaluation harness design: origins on the 15th of November to March, the 5-game fresh window, a 10–20-game target, and the same baselines and bootstrap.

Steps:

1. TJ approves the 2025-26 read: the same four SELECTs with season 20252026; `ALLOWED_SEASONS` in `export_db_history.py` must be widened.
2. Run the harness with 2025-26 origins only, with no changes to method or weights, and report.
3. Only then decide whether 2025-26 enters the operational 2026-27 baseline and which later period becomes the next holdout.

2025-26 origins are the first with all three tiers covered (2022-23, 2023-24 and 2024-25), so this is also the first test of the 0.1 tier.

## 9. Limitations and open questions

1. **Untested tiers.** The 0.1 tier and the three-season shape are untested (see §3). The 0.6/0.3/0.1 prior weights remain TJ's provisional values.
2. **In-sample current weight.** The 1.0 current weight was selected on the development data, so the reserve test must confirm it.
3. **2024-25 Game Score.** 22% of the season's Game Score values are unknown (null on-ice goals). Should the 2026-27 repair (NULL→0 under the official-evidence rule) be extended to 2024-25 before operational use? That needs its own approval; it is a write.
4. **50% process-coverage rule.** Arm C's rule for the process reference is a provisional choice of mine, not validated. Decision needed: keep it, or require a fixed number of qualified games.
5. **Unweighted explanation context.** Context totals in arm C are unweighted over up to about 250 games, while the score is weighted. Either the explainer gains weighted context (`supportGap.ts`, frozen) or the display labels the difference.
6. **Shrinkage.** Shrinkage still pulls toward the 2022-24 donor cohort (`fitProductionPrior`, donors = complete final-50 histories). Arm C does not refresh the cohort prior. Refreshing it with 2024-25 donors is a separate change to evaluate.
7. **Next step for the lists lane.** Mapping `historyStatus`, `missingSeasons`, `insufficientHistory` and `comparisons` into the display profile, and withholding direction below 20 games, belongs to the lists lane.
