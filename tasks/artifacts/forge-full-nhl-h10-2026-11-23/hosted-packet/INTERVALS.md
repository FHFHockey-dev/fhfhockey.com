# H1–H10 uncertainty: candidate and validation receipt (2026-11-24)

TJ's brief, via Chef: add uncertainty to the existing Full-NHL H1–H10 shadow forecasts. This is a **candidate only**:
- the migration is not applied;
- nothing is deployed, scheduled or run in production;
- tonight's job 466, the 04:50 ET verifier (`first-night-verify.sql`, f3695ee76) and Daily FORGE/RSO are unchanged;
- the producer closure is unchanged (`23af25d3f3f534d5e8ce09de44c916ed8ba778bd080395486ec4dfb2500f5b27`).

## What each issued key gets

One immutable **interval edition** per published vintage, in the new table `forge_v2_private.forge_h10_interval_editions`
(migration `20261124000000`, additive). Each edition carries:
- **Point and bands:** the vintage's point forecast per category (copied, and checked against a recomputation), plus 50% and 90% bands for each target category.
  - Skaters: G, A, PPP, SOG, HIT, BLK, PIM.
  - Goalies: SAVES, SHOTS_AGAINST, GOALS_ALLOWED, WIN, SHUTOUT.
- **Provenance:** the vintage id and output hash, team, horizon, input cutoff (as-of), model and feature versions, method id, and the calibration record id, version and availability time.
- **Conditioning, labelled:** `conditionalOn` is `official_appearance` (skaters) or `official_start` (goalies). The probability of appearing or starting is not modelled and is not invented. Limitations say so on every edition.
- **Combination:** `marginal_per_category_not_summable`. A fantasy-points band, for RSO later, must come from the joint outcome distribution under league scoring (v2 `scoreJoint`), never from summing category endpoints.
- **Gaps:** where evidence is too thin, the category band is `unavailable` with a reason, counted as an open coverage gap. Reasons:
  - `effective_support_too_thin`: Kish effective sample size below 30;
  - `calibration_support_too_thin`: fewer than 40 replay observations in the cell;
  - `point_forecast_mismatch`, `model_version_mismatch`, `calibration_not_available_at_cutoff`, `non_nested_calibrated_intervals`.

**Prior editions are preserved.** Vintages are untouched. Editions are insert-only and immutable. They are first-write-wins
across months and must name an existing vintage with the same output hash. Each nightly or material vintage gets its own edition.

## Method (reuses the v2 uncertainty work; no new model)

1. **Distribution.** The predictive distribution is the **kernel-weighted empirical outcome distribution behind the point forecast**. It uses the same weights and row filters as `official-appearance-kernel-means-v1` and `goalie-start-kernel-means-v1`, which is what `predictJoint` does. Unit tests show the means are reproduced exactly. In the full-night rehearsal, every one of 8,038 editions reproduced its stored point forecast and model version.
2. **Bands.** Equal-tailed bands under the v2 left-continuous CDF convention (`left-cdf-equal-tail-v1`, the shared `quantile`).
3. **Calibration.** The v2 finite-sample tail-padding rank rule from `fitIntervalCalibration`, per class × category × horizon.
   - It is fitted each night at the nightly cutoff, on a replay of the same recipe at ten earlier cutoffs (every 3 days).
   - The replay uses **only outcomes received by the cutoff**.
   - It is stored once per night as an `evaluation` record (`forge-h10-interval-calibration:<date>`).
   - Padding only widens. Bands are clamped to each target's support: counts ≥ 0, WIN/SHUTOUT in {0, 1}.
   - The calibration is labelled `development_only_unreviewed`.
4. **Policy.** Constants were declared before validation (`H10_INTERVAL_POLICY`). Changing any of them is a new method version.

No band is derived from variation across revisions.

## Validation (chronological holdouts, real bounded reads)

Receipt: `interval-validation-2026-11.json`, produced by `scripts/forge-h10-interval-validation.ts`.

**Design**
- Ten evaluation cutoffs, 2026-10-24 to 2026-11-20 at 09:00Z, every 3 days.
- At each cutoff the model, rates and calibration use only rows received by it. The script asserts the calibration's latest outcome time is at or before the cutoff.
- Bands are scored on each team's next ten games: skaters on realized appearances, goalies on realized starts.
- 278,244 realized category outcomes: 267,624 skater and 10,620 goalie.
- Baseline: a Poisson (counts) or Bernoulli (WIN, SHUTOUT) equal-tail band around the **same mean**.
- Interval score: the Winkler score; lower is better.

| Class, level | n | Calibrated coverage / width / score | Baseline coverage / width / score |
|---|---|---|---|
| Skater 50% | 267,624 | 0.833 / 0.74 / **1.856** | 0.804 / 0.79 / 1.922 |
| Skater 90% | 267,624 | 0.973 / 2.33 / **3.399** | 0.959 / 2.02 / 3.527 |
| Goalie 50% | 9,840 | 0.783 / 4.56 / 7.760 | 0.723 / 3.27 / **7.657** |
| Goalie 90% | 9,840 | 0.945 / 10.77 / **14.065** | 0.926 / 8.01 / 14.694 |

Goalie rows are matched: the baseline is scored on the same 9,840 outcomes that received a calibrated band.

- **Skaters.** Better than the baseline on interval score at both levels and at **every horizon H1–H10**. The established and sparse-history subsets both hold:
  - sparse (fewer than 8 prior games): 39,396 outcomes; 50% score 1.616 vs 1.747; 90% score 3.221 vs 3.334.
- **Goalies at 90%.** Better at H1–H7. Worse at H8–H10, where samples are small (195–600).
- **Goalies at 50%.** Not better than the baseline: 7.76 vs 7.66 overall. The padding widens them slightly and the raw bands roughly tie the baseline (7.67). This is the weakest result. It should be read as such, not hidden.
- **Coverage is at or above nominal.** It runs well above nominal at 50%: 0.83 for skaters, 0.78 for goalies. Most categories are small integers, so equal-tail bands on discrete outcomes over-cover. The bands are conservative, not "calibrated to 50%".
- **Ordered and nested.** 0 invalid bands among 278,244 raw, 277,464 calibrated and 278,244 baseline sets.
- **Gaps.** No raw band was refused for thin kernel support at the evaluation cutoffs. Calibration was too thin for goalie H8–H10 at the earliest cutoffs: 780 outcomes in total, counted as open gaps. At the 2026-11-23 cutoff all 120 cells are fitted (278,244 replay observations).

## Full-night rehearsal (runtime and storage)

Receipt: `interval-night-rehearsal.json`.
- Both runs used the same real reads and the same signed tick → verify → begin → route → finish path, back to back on one laptop.
- A is without the migration (the phase skips itself); B is with it.

| | A: without intervals | B: with intervals | Added |
|---|---|---|---|
| Dispatches to complete | 2 (+1 cached) | 2 (+1 cached) | 0 |
| Dispatch 1 / dispatch 2 | 200.6 s / 105.2 s | 200.7 s / 144.7 s | +39.5 s |
| Night total | 305.8 s | 345.3 s | **+13%**: calibration 25.2 s, 8,038 editions in 33.8 s of phase time |
| Interval table (with indexes) | – | 19.6 MB (3.1 MB indexes); 30.2 MB raw payload text | ≈ +37% of the night's forge_v2 storage |
| Calibration record | – | 13.9 KB per night | |

- **Budget.** Dispatch 2 stays inside the 200 s budget. The phase checks the budget before the calibration and between batches of 250, and resumes on the next dispatch.
- **Completion marker.** Now includes interval coverage per class: keys, editions, category bands and gaps.
- **Retention.** At about 19.6 MB a night, three hot months is about 1.8 GB. The table is partitioned monthly and listed in the archive procedure, like the vintages.
- **B's 2 goalie gaps** (`issuance_lock_closed`): game 2026020378 started at 00:00Z during B's run. This was caught by both the verifier and the route's gap tallies, and is not caused by the intervals. The goalie phase runs first.

## Checks run

- `h10Intervals.test.ts`: 6/6. It covers:
  - exact mean reproduction for skaters and goalies;
  - target-specific, ordered, nested, integer bands;
  - thin evidence refused with a reason;
  - calibration ignores outcomes after the cutoff, and padding only widens;
  - binary bands clamped to {0, 1};
  - an edition refuses on point, model or calibration-time mismatch.
- `h10Route.test.ts` on disposable PostgreSQL. It covers:
  - one edition per published vintage (1,380 skater, 120 goalie) and one stored calibration;
  - no mismatch gaps;
  - the completion marker's coverage;
  - immutability, first-write-wins, and refusal of an edition whose vintage is missing;
  - material revisions get their own editions (30).
- `h10Partitions.test.ts`: the archive round trip, including the new table.
- The full forge-v2 suite with Postgres.
- Typecheck 0, eslint 0, and the closure print.

## Approvals this would need (none requested here)

1. Apply migration `20261124000000`. It is additive, on live tables. Until it is applied, the deployed code skips the phase and writes nothing.
2. Deploy the candidate SHA. The nightly then adds about 40 s and about 20 MB a night. The 04:50 ET verifier is unaffected: it does not read the new table, and the completion marker only gains a field.
3. The first nightly run with intervals is its own coverage milestone. H10 isn't complete on it alone.
