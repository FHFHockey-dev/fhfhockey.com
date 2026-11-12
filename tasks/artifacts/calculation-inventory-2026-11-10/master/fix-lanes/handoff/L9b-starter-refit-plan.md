# L9b: starter-probability refit plan (W1 P0 #16 step 4) — 2026-11-11

Model change, held out. Not run; no fitting, FORGE run or promotion without TJ approval through the existing gate.

## Preconditions (landed in 266794115 / 4eab7347d)
1. Outcome: credited-start label per team-game (wgo games_started, keyed by game id); unknowns excluded, never zero.
2. Timestamps: each issuance records run_id, issued_at, information_cutoff_at and starter-label coverage (goalie_candidates.issuance). Still open: frozen-start receipt (immutable copy at puck drop) via starterBoardDataset.ts:42-55.
3. Pregame cutoffs: rest-split and QS reads use date < slate (rule 25); starter history uses game_date < as-of.

## Data
Prospective frozen issuances from the next FORGE runs (goalie_candidates rows), plus historical replay only where inputs are reconstructable strictly pregame. Population: every candidate with a stored probability (all-candidate) and the top pick separately.

## Candidates to compare (paired, same games)
- Current heuristic (2.4·L10 share + 0.7·logit prior + season start share + B2B/weak-opponent terms, bounds [0.01, 0.98] on a closed set).
- Ablations: drop the duplicated L10 terms (prior logit, season share) one at a time (the 7/10 → .895, 8/10 → .967 amplification).
- Refit logistic/softmax on the same features with fitted shrinkage; B2B effect fitted, not 8.7%/0.09 or 0.65.
- Baselines: constant team-mean (Brier ≈ .239), raw L10 share.

## Evaluation
Time-ordered held-out folds clustered by slate; Brier and log score with paired differences and bootstrap intervals by slate; reliability bins with intervals; top-pick and all-candidate calibration reported separately; unknown labels excluded with their count. Promotion only through starterBoardValidation.ts:59-75 unchanged (≥ 200 games, ≥ 30 slates, paired improvement). If nothing qualifies, keep the heuristic labelled "uncalibrated_model" (it already is) and never claim it won (decision 66).
