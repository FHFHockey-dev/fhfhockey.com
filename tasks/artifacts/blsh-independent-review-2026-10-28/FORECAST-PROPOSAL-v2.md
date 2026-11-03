# BLSH development forecast comparison: proposal v2 (not run)

**Status: proposal only.** No evaluator code exists, nothing has been run, no threshold is set, and 2025-26 is closed.

Prerequisite: the independent re-review of explanation v3 is done, and its findings are fixed or recorded in v3.1 (`EXPLANATION-REVIEW.md`, `dry-run-v3/`). The forecast does **not** use the explanation layer; it uses only the production reference, the frozen v1 coefficient (for the P2-transfer diagnostic only) and the new γ.

v2 supersedes §3–4 of `CASE-REVIEW-AND-FORECAST-PROPOSAL.md`, which is kept unchanged.

**This is a separate question from the retrospective BLSH tool.** Its result is not a prerequisite for that tool. The retrospective path is reconciled independently in `RETROSPECTIVE-RECONCILIATION.md`.

## 1. Question

At each eligible origin, using only information dated before the first target game:
- does a forecast built from the BLSH support evidence predict the next five appearances better than the frozen prior-season mean?
- does it beat the unchanged production reference alone?

The prior-season mean is the primary benchmark.

## 2. Data roles, kept apart

| Season | Role |
|---|---|
| 2022-23 | **Training only**: fits the forward coefficient γ (§4.3). Supplies the prior-season mean for 2023-24. |
| 2023-24 | **Exploratory development evaluation**. This season has been exposed, so results are exploratory and cannot confirm anything. |
| 2024-25 | Exposed retrospectively and not qualified for this assembler. **Excluded** from this proposal. |
| 2025-26 | **Reserved.** At most one confirmatory run, only after every item in §9 is frozen. Not part of this development proposal. |

## 3. Origins, eligibility and targets: one set, used for every arm

**Origin:** player *p*, recorded appearance *i* in 2023-24.
- **Current window W** is appearances i−4 … i.
- **Target window T** is appearances i+1 … i+5.
- Every feature comes only from rows dated before T's first game.

**Schedules:**
- **Primary schedule:** every eligible appearance, so targets overlap across origins. This matches the 2024-25 validation design, for comparability.
- **Sensitivity schedule:** every 5th eligible appearance per player, so targets do not overlap within a player.

**Target** for each track t (FHFH Standard FP, G+A, the named WiGO Game Score):
- y_t = the mean per appearance of track t over T.
- All of T must lie in the same regular season.
- The same target is used by every arm.

**An origin is eligible only if all of these hold.** The same set is used for all arms and all three tracks:
1. W and T are 10 consecutive admitted (GP 1) appearances, with all three tracks finite.
2. There is no in-season gap of more than 30 days and no known team change from W's first game through T's last. This is the frozen 2024-25 boundary rule.
3. **P0 is ready:** the player's last 50 admitted appearances in 2022-23 exist, with every track finite. No missing-score compression, as in the frozen 2024-25 definition.
4. **P1 is ready:** the production reference is numeric. Its reference is the 50 games before W, using the frozen estimator. Donors are players with a complete 50 games ending before W's first game.
5. **P2 is ready:** all three W process rates are observed under the unchanged complete-window rule, with no imputation for forecasting. The reference process rates are available (personal or cohort, with the mode recorded). The support model fits on blocks ending before W.
6. T contains no 2025-26 game.

**Funnel:** every 2023-24 appearance is counted at each step, with the reason it fails. Results are reported overall and by evidence tier, position, personal-reference games (0, 1–49, 50) and window span.

**Selection-bias note:** P0's 50-game requirement restricts the evaluation to established players. In the 2024-25 validation, about 57% of players qualified. Results apply to that population only.

## 4. Arms: exact predictions in each track's units per appearance

**Notation:**
- r_t is the production-reference rate for track t, in units per second of TOI, from the unchanged `position-exposure-reference-gap-v1` estimator.
- ΔX = process rates in W minus reference process rates, in per-60 units: [individual xG/60, on-ice xGF/60, on-ice xGA/60].
- τ is the declared TOI per appearance: the mean TOI per appearance in W, in seconds, known at the origin.

### 4.1 P0: frozen prior-season mean (primary benchmark)
P0_t = mean of track t over the player's last 50 admitted 2022-23 appearances. It is fixed for the whole season.

### 4.2 P1: production reference
P1_t = r_t × τ.

### 4.3 P2: support-conditioned forecast (primary candidate)

The retrospective score cannot simply be added to P1:
- v1's coefficient B describes how outcome rates move with process rates **within the same block of games**, which is a concurrent relationship.
- Its 0.5 shrinkage was a frozen research choice, not a forecast calibration.
- Using B forward would assume the current-window relationship persists, and that assumption is untested.

P2 therefore uses a **separately fitted forward coefficient γ**:
- **Model, per track:** (y_t / τ_T) − r_t = (ΔX · γ_t) / 3600 + ε, with no intercept.
  - The left side is the realized next-5 rate per second minus the reference rate. τ_T is the realized TOI per appearance in T, used **only in fitting**, never in prediction.
  - γ is a 3 × 3 matrix (process dimension × track). Its units are track units per hour per unit of per-60 process rate. Positive entries raise the prediction; no sign is constrained or forced.
- **Fit:**
  - Only 2022-23 training origins, built with the same eligibility rules except that P0 is not required. Their targets lie entirely in 2022-23.
  - Exposure-weighted least squares, weighted by T's TOI, with equal total weight per player.
  - Forwards and defencemen are fitted separately.
  - No grid, no feature selection and no refit on 2023-24.
  - A single 0.5 ridge-style shrinkage of γ toward zero, mirroring v1's declared choice so the comparison stays apples to apples. Unshrunk γ is reported as a sensitivity only.
  - All coefficients, their signs and training counts are reported.
- **Prediction:** P2_t = (r_t + (ΔX · γ_t) / 3600) × τ.
- **Floors:** FP and G+A are floored at 0. The number of floored predictions is reported. Game Score stays signed.

### 4.4 Diagnostic and control arms (secondary)
- **P2-transfer:** (r_t + (ΔX · B_t) / 3600) × τ, with B the frozen v1 coefficient refitted prior-only at each origin. This tests the persistence assumption explicitly; it is never the primary candidate.
- **P3 recent form:** the mean of track t over W.
- **P1-H:** P1 with τ replaced by the mean TOI per appearance in the reference games. This checks sensitivity to the TOI declaration.

**Rules for every arm:**
- Realized T TOI never enters a prediction.
- Per-appearance predictions are compared only with per-appearance targets.
- **Secondary per-60 target:** y_t / τ_T compared with rate predictions (P0 converted using the prior season's TOI). This removes opportunity, and is reported separately.

## 5. Metrics, uncertainty, coverage

**Metrics:**
- Per track: MAE and RMSE for every arm on the identical origin set.
- Paired per-origin loss differences for these contrasts:
  - **P2 − P0 (primary, FP)**
  - P1 − P0
  - P2 − P1, which isolates the process contribution
  - P2-transfer − P1
  - P3 − P0
- All three tracks are reported side by side in the same tables. The secondary composite uses the frozen equal-weight normalization and is labelled secondary.

**Uncertainty:**
- **Player-clustered bootstrap.** Players are resampled with replacement, keeping all their origins. This covers overlapping five-game targets and repeated players. The run uses 2,000 resamples with a fixed seed; 95% percentile intervals are reported for each contrast and track.
- **Shared games across teammates:** a sensitivity bootstrap clustered by team-season. Remaining cross-team game dependence is disclosed, not modelled.
- **Overlap:** the primary schedule's overlap is handled by clustering. The non-overlapping sensitivity schedule is reported beside it.

**Multiplicity and the decision rule:**
- **One primary contrast:** FP, P2 − P0, primary schedule, player-clustered interval.
- The other contrasts, tracks, schedules and subgroups are secondary and labelled exploratory. No adjustment is used to rescue them.

**Coverage report:**
- The full funnel by reason.
- The number of eligible origins and players per tier and position.
- γ training counts.
- The number of floored predictions.
- The number of origins lost to each boundary rule.

## 6. Decision rule, set before running

On 2023-24, which is exploratory, P2 "shows forward promise" only if all of these hold:
- the FP interval for P2 − P0 lies entirely below 0;
- the FP point estimate for P2 − P1 is below 0;
- neither the G+A nor the Game Score point estimate for P2 − P0 is worse than P0.

Otherwise, the conclusion is **no forward claim**. Either way:
- the result is written up in full, including failures;
- no list threshold or score cutoff is derived from it;
- the normalized retrospective score is never presented as a probability, a z-score or a forecast.

A "promise" result only justifies freezing this protocol for the reserved 2025-26 run (§9). It is not itself a confirmed predictive claim.

## 7. Information-availability caveats
- This is a retrospective reconstruction from source values. Their original publication and revision times are unknown, so the run does not replay issued forecasts.
- The donors, support blocks and γ training all end before W or before 2023-24. `fitProductionPrior`'s later-donor guard stays in force, and the current-season donor pool is not reused.
- The simplified history process gate from the dry run is used again and disclosed. The result is exploratory for that reason too.

## 8. Bounds
- Local only. No database or provider reads, writes, Git or deployment.
- Inputs are pinned in code and checked when read: the exported history `da32a473…`, exporter script `b6a4a580…`, v1 `INPUTS.json` `343e7960…` (which pins the six parquet sources) and the v1 block catalog `f60056cd…`.
- Runs one job at a time under the heavy lock.
- A cost check on a small player subset runs first. The full run is expected to take tens of minutes, mostly origin-wise refits; it stops if it exceeds 60 minutes.

## 9. Reserved 2025-26: what must be frozen first

**Freeze before opening:**
- the arms' formulas and γ, fitted on 2022-23 plus 2023-24 only and then frozen;
- eligibility and boundary rules;
- targets, metrics, the primary contrast and the decision rule;
- schedules and the bootstrap seed;
- code and input hashes;
- the treatment of exposed game **2025020500**.

**Game 2025020500:** another worker has already seen its official summaries. Every origin whose W or T contains that game is excluded, for every player who dressed in it. Those players are identified only from that already-exposed summary, at freeze time.

**Overlapping windows:** early 2025-26 references draw on 2024-25 and 2023-24 games, which are exposed. They are allowed as features, never as targets. Target overlap across origins is handled as in §5.

**After the single run:** the complete result is recorded, including failure. Any later refit is kept separate. If the protocol is revised after seeing the result, 2025-26 is marked consumed, and confirmation moves to a later untouched or prospective period.

## 10. Paths needed for clearance (none written yet)

| Path | Purpose |
|---|---|
| `web/lib/buyLowSellHigh/forecastEvaluation.ts` | Pure functions: origin funnel and eligibility; P0, P1, P2, P2-transfer, P3 and P1-H predictions; γ fit; paired metrics; seeded player- and team-season-clustered bootstrap. No I/O. |
| `web/lib/buyLowSellHigh/forecastEvaluation.test.ts` | Synthetic tests: no feature dated on or after the first target game; identical origins across arms and tracks; units and τ declaration; floors; season-boundary and gap censoring; γ fitted only on training-season origins; bootstrap determinism; funnel reasons; P0 definition matches the frozen 2024-25 one. |
| `web/scripts/blsh/forecastDevRun.test.ts` | Opt-in local runner. Reads the pinned history and catalog, verifies hashes, writes only to `tasks/artifacts/blsh-independent-review-2026-10-28/forecast-dev/` (a new folder). |

**Read-only imports**, unchanged:
- `productionReference.ts`
- `supportGap.ts`: the frozen `score` and `fitPrior`, used for P2-transfer
- `currentWindows.ts`: `devSlot`

No changes to Codex-leased files.
