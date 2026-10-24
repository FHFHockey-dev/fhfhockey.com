# Portable offline FORGE gate kit

This directory can be copied by itself. Python 3.9+ and its standard library are sufficient. It reads already-authorized local JSON inputs, reports diagnostics and statistics, and never runs a capture or contacts a service. **Actual model qualification remains unrun. Every new capture requires TJ's separate approval.**

From any working directory, point `KIT` at this directory and `OUT` at a locally authorized capture directory containing one subdirectory per variant. `f` and `candidate` below are example names; no symlinks or `PYTHONPATH` setup are required.

```sh
python3 -B "$KIT/score_pair.py" "$OUT" f candidate "$ACTUALS" "$HITS_BLOCKS"
python3 -B "$KIT/gate_ci.py" "$OUT" f candidate "$ACTUALS" "$HITS_BLOCKS"
python3 -B "$KIT/mz.py" "$OUT" f,candidate "$ACTUALS" "$HITS_BLOCKS"
```

`score_pair.py` retains the handover's five-argument API and reports overall/F/D bias, relative bias, RMSE, paired Δbias/ΔRMSE confidence intervals, and own-forecast deciles. `gate_ci.py` reports per-variant relative-bias and top-decile intervals. Its former `SCORER_PATH OUT ACTUALS HB` signature is deliberately replaced by the explicit five-argument pair signature above. `mz.py` keeps the comma-separated pair argument and now uses exactly the same join and category denominator.

The optional legacy Task2 entry point remains:

```sh
python3 -B "$KIT/score_gate.py" "$OUT" "$ACTUALS" "$HITS_BLOCKS"
python3 -B "$KIT/score_gate.py" "$OUT" "$ACTUALS" "$HITS_BLOCKS" --base f --candidate candidate
```

Only that entry point defaults to `va/vc`. Its historical numerical checks remain: FP/HIT/SOG relative bias within ±10%, every head's top-decile ratio within ±10% of 1. These checks alone do not implement the full F1/F3/F4 approval gates. The handover's changed-head bias, FP ΔRMSE CI ≤ 0, top-decile limits including ticket-specific 0.95 floors, MZ movement toward 1, and D representation requirements remain unchanged and require the selected ticket's explicit review.

## Input and denominator contract

- Capture filenames must match between variant directories and start with an ISO date. Unpaired filenames are counted and excluded. Capture `payload.slateDate`, when supplied, must agree. Only horizon-one `forge_player_projections` intended upserts are used.
- Pair on normalized positive integer `(game_id, player_id)`, within each common capture file. Duplicate IDs in actuals, hits/blocks, a variant file, or across common capture files raise an error; no last-write-wins join is allowed.
- A dressed row means an actuals row exists for that identity **and capture date**. Source actual counts, paired dressed counts, matched games, excluded rows and file counts are separate diagnostics. The supplied 2,231 actuals are not proof of the historical 2,079 matched dressed denominator. `games-all.txt` and `s5_pp_actuals.json` remain preserved source inputs, not silently applied scoring filters.
- Actuals and hits/blocks require ISO `date` fields. A hits/blocks date mismatch makes those two categories unavailable for that identity; it does not turn them into zeros. Missing, nonnumeric, boolean, infinite and NaN category values are unavailable. Numeric zero remains a valid measurement. FP is unavailable if any weighted component is unavailable.
- Each head uses rows with truth and **both** variant predictions present. That same paired subset is used by all reports, MZ and its bootstrap. Positions come structurally from `payload.reads` → `players` → `result.data`, scoped to each file. F/C/L/R/LW/RW map to F, D maps to D; unknown stays unknown. Conflicting known F/D positions fail.
- Numeric stats are descriptive. Unmatched replay flags, missing files, unknown positions, inadequate coverage or undefined metrics require review. None of the scripts establishes model qualification, authorizes captures, or changes the release.

## Statistical conventions

FP weights remain G=3, A=2, PPP=1, SOG=0.2, HIT=0.2, BLK=0.25. Bias is mean(pred−actual); relative bias is Σpred/Σactual−1; RMSE is the square root of mean squared error. Decile ratios are Σactual/Σpred, not the mean of individual ratios.

The bootstrap remains 2,000 replicates with `random.Random(1)`, sampling games with replacement, preserving every eligible player in each selected game and each repeated game. Both variants use the same draw. Intervals retain the historical sorted order statistics at indices 50 and 1949. Head-eligible games are the sampling universe, matching the paired scorer. This corrects the old `gate_ci.py` behavior that sampled all joined games before dropping missing categories. No CI is reported if any draw is undefined; the report shows the defined draw count instead of silently discarding draws.

Own-forecast bins retain `[d*n//10:(d+1)*n//10]`. A 21-row top bin therefore has three rows. MZ regresses actual on predicted with an intercept and reports unavailable for zero prediction variance. Its D-representation diagnostic retains the historical `floor(n/10)` top count (two for n=21); it is deliberately distinct from the calibration top-bin size. Both conventions are tested. Ties use stable game/player identity ordering, replacing legacy input-order dependence. MZ's actual-ranking ties can therefore differ from an old file-order tie on sparse data.

## Synthetic verification

```sh
python3 -B -m unittest discover -s "$KIT/tests" -p 'test_*.py' -v
```

The tests generate temporary synthetic captures and actuals, check hand-calculated oracles and isolated-copy CLI execution, and compare against checked-in legacy reference results. The reference was produced by the historical scripts at `2a5092d37`, scoring only these synthetic fixtures; source hashes are recorded inside `tests/legacy_reference.json`. The old MZ regex requires compact JSON, so reference generation writes identical fixture data in compact form. Normal tests use formatted JSON to verify structural extraction.

Optional reference regeneration requires the historical repository only for reading four scorer source blobs, never retained model captures:

```sh
python3 -B "$KIT/tests/make_legacy_reference.py" /path/to/fhfhockey.com
```

No dependencies, application tests, model captures, production requests or database access are needed. See [REPORT.md](REPORT.md) and [tests/RESULTS.log](tests/RESULTS.log) for this packet's verification and limitations.
