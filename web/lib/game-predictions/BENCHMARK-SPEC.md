# Game win probability: benchmark and replacement spec (owner decision 1)

Status: **specification only.** Nothing here promotes, trains in production, or changes what is served. Written by fix lane L22 on 2026-11-11 from owner decisions 1, 30, 42, 43 and 45, BC §W1-10 and the W1-10 audit and review.

## 1. What is being benchmarked

`INITIAL_BASELINE_MODEL` (`workflow.ts`) is a hand-set logistic placeholder over `BASELINE_FEATURE_KEYS` with `bias: 0` and no venue term. It is not a fitted model. It is not in production: the forecast cron records an explicit `skipped` / `no_production_model` receipt (decision 42), and every public surface shows "FHFH predictions unavailable while the model is developed and validated."

## 2. Estimand and scoring

- **Target:** the final result (regulation, OT or shootout), home win = 1. Regulation-only models convert through the one shared OT rule, `overtimeRule.ts` (50/50 split, labelled an approximation until a fitted split beats it on time-ordered held-out games; decision 45).
- **Issuance:** one forecast per game, the last forecast **computed before the frozen start** with its input cutoff also before the start (`finalPregamePredictions`). Unknown start time means no eligible forecast (rule 10).
- **Primary scores:** log loss and Brier score per game, averaged over the same games for every contender.
- **Uncertainty:** paired per-game score differences against each benchmark, with a 95% interval from a block bootstrap that resamples whole slates (game dates) to respect same-night dependence. Report n, the date range and the interval; never "no skill" from a point difference alone (BC §W1-10 B).
- **Calibration:** reliability bins with each bin's n, mean forecast, observed rate and 95% sampling band. The promotion gate uses the largest gap beyond the band over bins with at least 30 decided games (`calibrationMaxGapFromBuckets`), never a raw max gap (D8).
- **Winner accuracy** is secondary: the pick follows the displayed probability, exactly 50% is a tie, and ties are excluded and counted apart (decision 43; TJ 2026-11-11).

## 3. Benchmarks (all fitted only on data before each evaluation slate)

| Key | Definition | Notes |
|---|---|---|
| `home_rate_prior` | Home-win rate from prior seasons plus earlier current-season slates, Laplace-smoothed. | Replaces the fixed `home_team_fixed_54` for scoring; keep the fixed 54% as a labelled transparent reference only. |
| `elo_home` | Team Elo with a fitted home-advantage offset and a fitted K, between-season regression to the mean fitted on prior seasons; margin-of-victory multiplier only if it improves held-out log loss. | None exists in the repo yet; build it in `lib/game-predictions/` as a pure function over final results ordered by start time. |
| `market_devig` | Same-book two-way moneyline, de-vigged (proportional, method stated), captured before the forecast cutoff. | A different estimand when captured later: the last pre-start snapshot (about 3.1 h out in the W1-10 sample) is labelled as such, not as a verified close. Only from an authorised current source (decisions 30, 42). Benchmark only; never a training feature unless captured before the cutoff. |
| `placeholder` | `INITIAL_BASELINE_MODEL` as served (with dampening and floor). | The thing under audit. |

## 4. Fitted replacement (candidate spec)

- **Model:** regularised logistic regression on the existing feature vector **plus an explicit home-ice intercept** (the fitted bias, interpreted as the home log-odds at equal features). Home > 50% for identical teams is a fitted behaviour checked on held-out data, not an identity. Include a venue-disabled symmetry test (swap teams, no venue term: p → 1 − p).
- **Training data:** only pre-cutoff lineage (feature payloads whose cutoff precedes the start, rule 10), with matched-support recent form (unknown stays unknown; no zero-filled counts) and identity-complete final outcomes.
- **Replay:** walk forward by slate: one trained artifact per slate, outcomes added after the slate (no same-slate leakage; `backtestLeak.test.ts`). Retrain cadence counted in games, applied at slate boundaries.
- **Dampening:** the hand-set data-quality multiplier is a candidate to validate, not assumed. Compare with and without it on held-out slates; calibrate the final output, not a pre-dampening value.
- **Selection:** choose the regularisation strength and any feature subset on validation slates only; report how many configurations were tried. Final judgement on an untouched holdout season segment.
- **Artifact:** a stored, versioned artifact with feature order, scaling, weights, intercept, calibrator, clipping and quality policy, cutoff policy and training manifest (game ids and cutoffs), plus a replay test that rebuilds one stored prediction exactly. Today the server serves only the compiled identity; promoting a different version now fails the cron loudly (`workflow.ts`), so loading the artifact is a prerequisite for serving it.

## 5. Acceptance (for a later, separately approved promotion)

A candidate may be proposed for promotion only if, on the same held-out games: its log loss beats `home_rate_prior` and `elo_home` with the paired 95% interval excluding zero; its Brier score is not worse than either; the calibration gate statistic is at or below 0.05; and it is reported against `market_devig` (no requirement to beat the market). Promotion is its own production step with TJ's approval.

## 6. Not in scope here

Game Grid odds and Week Score (L12; they can import `overtimeRule.ts`); homepage presentation (L16); FORGE de-vig and markets (L9a); the dormant game-page Poisson chart (decision 44: stays unrendered).
