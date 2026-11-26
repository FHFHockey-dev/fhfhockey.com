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
- 278,244 scored category predictions: 267,624 skater and 10,620 goalie. These are not independent outcomes: one realized game line is scored at up to ten horizons, from different cutoffs, and across categories.
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
- **Limitation, later in the season.** The route reads a 60-day log window. Today it covers the whole season, so this validation could not show the effect. From about late November on, a replay at a cutoff up to 30 days back sees only 30–57 days of rate history, not exactly what was issued then. The calibration replay then approximates the issued forecasts rather than reproducing them. Widening the route's window, or reading season-to-date for the replay, would fix that. It needs its own decision.
- **Gaps.** No raw band was refused for thin kernel support at the evaluation cutoffs. Calibration was too thin for goalie H8–H10 at the earliest cutoffs: 780 outcomes in total, counted as open gaps. At the 2026-11-23 cutoff all 120 cells are fitted (278,244 replay observations).

## Goalie band policy (TJ, 2026-11-24, by pop-up)

TJ's decision: "Use the labelled Poisson/Bernoulli baseline for goalie 50% at H1–H10 and goalie 90% at H8–H10. Keep
the candidate 90% band at H1–H7 only where it reliably improves on the baseline and contains the 50% band. Otherwise
use the baseline for both levels."

**As implemented** (`GOALIE_BAND_POLICY`, version `forge-h10-goalie-band-policy-v1`, in `lib/forge-v2/h10Intervals.ts`):
- **Goalie 50%, H1–H10:** baseline around the stored point forecast. Poisson for SAVES, SHOTS_AGAINST and GOALS_ALLOWED; Bernoulli for WIN and SHUTOUT.
- **Goalie 90%, H8–H10:** baseline.
- **Goalie 90%, H1–H7:** the calibrated kernel band only in cells the rule selected, and only when that band is valid and contains the 50% band. Otherwise the baseline at both levels.
- **Skaters:** unchanged; the calibrated kernel band at both levels.
- **Gaps:** if neither method gives a valid band (no usable point forecast), the band is an explicit gap, `no_valid_band:<reason>`.
- **Method on every band:** each edition records `methods` per category and level (`kernel_calibrated`, `poisson_baseline` or `bernoulli_baseline`) and the policy version. The candidate band is kept beside it (`candidateIntervals`) for monitoring.
- **Monitoring, without switching:** each nightly calibration record carries `goalieMonitor`: per goalie cell and level, the replay's candidate and baseline interval scores and distinct starts. These are in-sample for the candidate. The cell list changes only with a new policy version, a human decision. Past editions are never rewritten.

**Reliability rule.** Written into the code before any scoring:
- **Applies to:** goalie 90% cells at H1–H7, per category × horizon (35 cells).
- **Selection data:** evaluation cutoffs 10-24 to 11-20 (every 3 days), using only outcomes received by 2026-11-21 09:00Z, so the holdout's games are excluded.
- **Condition 1:** at least 150 distinct goalie starts in the cell.
- **Condition 2:** the one-sided 95% bootstrap upper bound of the mean paired interval-score difference, candidate minus baseline per distinct start, must be below 0. That is the 95th percentile of 2,000 resampled means, seed 20261124.
- The script refuses to run if the committed cell list differs from what the rule selects.

**Selected: SAVES at H2 and SAVES at H4** (269 and 217 starts; upper bounds −0.58 and −0.32).
- No other cell qualified. SAVES at H1 and H3 have negative mean differences, but their upper bounds are above 0.
- WIN and SHUTOUT bands are identical under both methods: a difference of exactly 0.
- **Caveat:** testing 35 cells at one-sided 95% would select about 1.75 cells by chance even with no real edge. So two selections are not strong evidence on their own. The rule is conservative in the other direction too (next two items).

**Untouched holdout.** Daily cutoffs 11-21, 11-22 and 11-23, on games after the selection data. **It is very small.**
- Only H1 and H2 have outcomes: 38 distinct starts at H1 and 7 at H2; 240 scored predictions in all.
- The 11-23 cutoff has none yet: the saved reads end with the 11-22 games.
- The policy's structure was chosen after TJ saw tables that included these games at long horizons. So "untouched" holds for the cell selection, not for the policy design. Truly untouched evidence starts with the first nights after release, which is what the monitoring is for.

| Horizon, level | Distinct starts | Policy coverage / width / score | Candidate coverage / width / score | Baseline coverage / width / score |
|---|---|---|---|---|
| H1 50% | 38 | 0.712 / 3.33 / 8.99 | 0.742 / 3.91 / 8.98 | 0.712 / 3.33 / 8.99 |
| H1 90% | 38 | 0.902 / 8.07 / 18.12 | 0.907 / 9.97 / **16.21** | 0.902 / 8.07 / 18.12 |
| H2 50% | 7 | 0.886 / 3.29 / 6.49 | 0.914 / 4.00 / 6.74 | 0.886 / 3.29 / 6.49 |
| H2 90% | 7 | 0.943 / 9.63 / 15.91 | 0.943 / 11.09 / **14.51** | 0.943 / 8.14 / 17.29 |

Bands by method in the holdout:
- 50%: 144 Poisson and 96 Bernoulli.
- 90%: 137 Poisson, 96 Bernoulli and 7 kernel (SAVES at H2).

**Check of the rule itself (supporting).** The rule was applied to the earlier outcomes only (cutoffs 10-24 to 11-05, outcomes received by 11-08), then scored on cutoffs 11-08 to 11-20.
- It selected **no** cell.
- On those later cutoffs the candidate 90% band beat the baseline's interval score at every horizon H1–H7, by 0.07 to 3.1 points. The policy (all baseline there) gave that up.
- The 50% bands were close: the candidate was marginally better at some horizons and worse at others.

**Reading:** the policy is safe and clearly labelled. The evidence so far suggests it leaves goalie 90% sharpness on the table at H1–H7. Revisiting that is a policy decision for TJ, not an automatic switch.

**Decision and revisit condition** (TJ, 2026-11-24: "Keep the policy as built … Revisit goalie 90% once there's enough fresh evidence across H1–H7, not after every cutoff"). Policy v1 stands. The revisit threshold is predeclared here; it is not a per-cutoff switch.
- **Fresh evidence only.** Prospective editions issued after release, scored against realized starts. Only games after 2026-11-22, the last games the v1 selection or this receipt saw.
- **Trigger.** At least 150 distinct goalie starts at **every** horizon H1–H7, counted from the editions' kept candidate bands (`candidateIntervals`) against the issued baseline bands.
- **Test, per horizon, once the trigger is met:**
  - the v1 paired bootstrap rule, pooled over the three count categories (SAVES, SHOTS_AGAINST, GOALS_ALLOWED), each start's difference being the mean over its categories;
  - a one-sided bound at 1 − 0.05/7 (Bonferroni across the seven horizons);
  - WIN and SHUTOUT are excluded, because both methods give them identical bands.
- **Containment.** A horizon qualifies only if the candidate 90% band also contains the 50% band in at least 95% of its scored starts.
- **Outcome.** A proposed policy v2 for TJ. Nothing switches automatically, and no past edition is rewritten.
- **Expected timing.** At roughly 14–16 goalie starts per horizon per night, 150 per horizon takes about 10–12 nights of realized outcomes, plus up to two weeks before H7 games happen. So not before mid-December.

## Same-cutoff parity and hosted time budget (final candidate)

Receipt: `interval-frozen-parity.json`.
- Three full-night runs at one frozen cutoff, 2026-11-24T00:45:00Z, using the same real reads and official rosters.
- The cutoff and official stamps were pinned through the route's existing `clock` input; the route is unchanged.
- Issuance ran on real time. No denominator game started during the runs: the next start was 02:40Z and the runs ended at 01:15Z.

| Run | Budget | Calls (s) | Published | Forecast fingerprint |
|---|---|---|---|---|
| A, no bands | 200 s | 200.8, 96.7, 0.0 (cached) | 8,040 of 8,040 frozen keys | `0bea1a7c…` |
| B, bands | 200 s | 200.3, 116.1 (interval phase 24.8 s, of which calibration 15.9 s), 0.0 | 8,040 of 8,040 | `0bea1a7c…` |
| C, bands | 120 s | 120.7, 120.7, 84.1 (interval phase 25.5 s), 0.0 | 8,040 of 8,040 | `0bea1a7c…` |

- **Parity.** The three runs froze the same denominator (`87093244…`). They published the **identical** 8,040 forecasts:
  - compared on class, player, game, team, horizon, model version, cutoff and every category mean;
  - the files are byte-identical (sha256 `0bea1a7c22c3…`).
  - The bands remove, add and change no forecast. The verifier reconcile shows 0 missing, 0 extra and 0 duplicate in all three.
- **Every forecast got an edition.** B and C wrote 8,040 editions with no category gaps.
- **Added time.** +18.9 s for the night (B 316.4 s against A 297.5 s), the same number of calls.
- **Worst call.** 200.3 s with bands, against 200.8 s without. The issuance step's own budget check sets the worst call, not the bands. Every call is under the 300 s function limit.
- **Budget guard.** The interval calibration starts only with at least 60 s of budget left (`CALIBRATION_RESERVE_MS`); otherwise the call ends "continued" and the next call starts with it. The route test drives this deferral through tight budgets. In C the phase started with 61 s left and ran.
- **Hosted ceiling.** A call can run to the 200 s budget plus one calibration started at the edge (≤ 60 s reserve by construction). It stays under 300 s unless the host is more than 2.5× slower than this laptop on the calibration. **None of this was measured on Vercel.**
- **Not usable for parity.** An earlier attempt also froze the issuance clock. The skater job leases are checked against the database's real clock, so every skater job failed. The route still reported the night "complete", because failed jobs count as finished. That is an existing behaviour, not caused by the bands, and the verifier would show it as 7,320 missing. **Fixed in this candidate** (TJ: judge a night only by the key-by-key check):
- The run report separates `finished` (every queue terminal) from `complete` (every job published).
- A night is `complete` only if every frozen key was issued. Any failed or expired skater job, any skater gap, or any goalie gap (lock closed, schedule fields, thin training, publish failed after its retries) writes `forge-h10-nightly-incomplete:<date>` and reports `incomplete` with a `shortfall` by cause. Later ticks return it cached.
- **Bounded retries within the night.** A thrown publish error is retryable.
  - **Skaters:** 3 attempts (was 2), at least 60 s apart, so at the next nightly ticks.
  - **Goalies:** 3 attempts within the call, after 1 s and then 4 s. Before this, a goalie publish error aborted the dispatch.
  - Both retry the **same** draft or vintage bytes. The vintage insert is first-write-wins with a byte readback and the receipt is unique, so a retry can never create a second edition.
  - Non-retryable results (missing or invalid inputs, lock passed, model failure) are deterministic, so they are not retried.
- **Regression test** (`h10Route.test.ts`, own disposable Postgres):
  - one player in nine fails publication on every attempt, and another fails only the first;
  - one goalie fails every attempt, and another fails once.
  - Expected and observed: `incomplete` with exact counts (`skaterJobsFailed`, goalie `publish_failed`), no complete marker, the incomplete marker, and the cached repeat.
  - The transient cases end with exactly one vintage and one receipt per key.
  - The earlier persistent-only version of this test failed on the old rule.

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

- **Budget.** Dispatch 2 stays inside the 200 s budget. The phase checks the budget before the calibration and between batches of 250, and resumes on the next dispatch. The calibration itself (about 25 s here) cannot be interrupted once started, so a calibration starting near 200 s ends near 225 s, under the 300 s function limit. **All runtimes are laptop measurements; none was measured on the Vercel host.**
- **Steady state (final tree).** The pending read and the coverage read are bounded to the run: rows inserted at or after its cutoff. That also prunes the monthly partitions, and the coverage is aggregated in SQL. Re-timed after seeding 15 prior nights of vintages, receipts and editions for the same keys (118,905 each):

  | | Tonight only | With 15 prior nights | Change |
  |---|---|---|---|
  | Interval phase (pending read + 7,927 editions) | 5.5 s | 5.6 s | flat |
  | Coverage read | 0.39 s | 0.38 s | flat |

  Same final-tree run: dispatch 2 took 121.7 s, of which 16.1 s was calibration.
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
- The full forge-v2 suite with Postgres plus the `forge-h10-shadow` page test, on the final tree: 28 files, 292/292 passed. Without Postgres: 244 passed, 44 skipped. This includes the goalie policy test (methods, containment fallback, H8–H10 baseline, gap) and the route test's calibration-deferral path.
- Typecheck 0, eslint 0, and the closure print.

## Approvals this would need (none requested here)

1. Apply migration `20261124000000`. It is additive, on live tables. Until it is applied, the deployed code skips the phase and writes nothing.
2. Deploy the candidate SHA. The nightly then adds about 40 s and about 20 MB a night. The 04:50 ET verifier is unaffected: it does not read the new table, and the completion marker only gains a field.
3. The first nightly run with intervals is its own coverage milestone. H10 isn't complete on it alone.
