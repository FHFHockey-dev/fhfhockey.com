# W1-8 audit: player-forecasts-season-part1 (M-PFC-001 to M-PFC-060)

Fable, 2026-11-11, on `octoberBranch` at `e56c5d635`. Read-only: no code changed, no tests run.

**How this was done.** I read the code behind the entries (the live TypeScript native path in full; the Python season and advanced models at every cited function; the research modules at the lines each lead points to) and ran bounded, read-only SQL against production. Six entries got only a light read and are marked so in the table. Batch A's rules apply: every number below is a dated sample, not a population rate.

**Database reads (2026-11-11).** `pg_stat_activity` showed 0 other active queries before each heavier read. Reads were: catalog lookups (`pg_class`, `pg_proc`, `pg_indexes`, `information_schema`), row counts of 16 near-empty `player_forecast_*` tables, server-side aggregates of `forge_served_forecast_ledger` (10,956 rows, no jsonb column touched), and one date-indexed aggregate of `wgo_goalie_stats` (2026-01-03 to 02-02, 482 rows). One read broke the spirit of the rules and is disclosed in section 5.

---

## 1. Summary

| Verdict | Count |
|---|---:|
| Sound | 20 |
| Mis-specified | 33 |
| Wrong | 5 |
| Undetermined | 2 |

**Served-or-not, in one paragraph.** Almost nothing in this packet reaches a user today.
- The whole Python season model (v4) and advanced model (v5) are **not served**: all `player_forecast_season_*` tables, `player_forecast_outputs`, `player_forecast_rest_of_season_outputs` and `player_forecast_model_artifacts` hold **0 rows**.
- The "live, approved" native means are **not served either**: `native_forecast_catalog_heads` holds 0 rows, so `selectForecastServingSource` cannot return `native` (`web/lib/player-forecasts/forecastServingSource.ts:59-78`). Native rate observations in production were last written on 2026-10-16. The served ledger has no `native` rows at all; it holds only `bridge_exact`, `bridge_reaimed`, `naive_last5` and `naive_season`.
- What is live: the ledger scoring behind `/api/v1/forge/scoreboard` (M-PFC-030, 031), the game-expectation view (M-PFC-057, carrying the legacy bridge source), and the deployed SQL function `build_player_forecast_runtime_features` (M-PFC-001, callable but with no stored outputs).

So there are **no P0 defects** (no user-visible wrong numbers from this packet). The findings matter at activation time.

**Top 5 findings by user impact (if the paths are activated as they stand).**

1. **Native goalie rates are raw, and raw is worse than a constant** (M-PFC-042, P1). Goalies with about 7 starts (187 shots) had a raw save percentage ranging from .804 to .947. On 146 settled starts (59 goalies, 2026-10-22 to 11-08), predicting goals against from that raw rate gave RMSE 1.670 per start; the league-average rate gave 1.495. The raw rate carried about 4% signal (regression slope 0.043).
2. **Native skater means need shrinkage** (M-PFC-013, 014; C16, P1). On 2,215 paired skater-games over 10 slates, a raw current-season mean for goals barely beat the league constant (RMSE 0.4452 against 0.4479). Shrinking toward the league mean with 10 pseudo-games gave 0.4365, and the FORGE bridge, which blends a prior, gave 0.4336. The raw mean's calibration slope was 0.54 for goals.
3. **The v4 and v5 release gates cannot fail, and the "80%" is never measured out of sample** (M-PFC-032, 038, 008; P1). Family choice, decay, shrinkage, interval calibration and the reported coverage all use the same validation rows, and those rows include the documented lockbox (2026-01-03 to 04-16).
4. **Interval widths are wrong in both directions** (M-PFC-007 and 010; P1/P2). Per-game advanced bands are about 28% too wide where the calibrated residual dominates (C17). Season totals add per-game variances as if games were independent, which leaves out talent and role uncertainty; an illustrative 30-goal forecast gets about ±7 where ±11 is more plausible.
5. **The ledger compares unlike things** (M-PFC-030; C18; P2). Bridge forecasts are unconditional (already multiplied by the chance of playing) but are scored only on players who dressed, next to naive rows that assume a 100% chance. On the same 2,215 rows the bridge's mean goals were 9% under actual and shots 6% under; the naive rows were within 4%.

One Batch-level correction: **C19's direction is wrong.** FHFH's quality-start rule does not inflate QS against Vollman. On 482 starts it gave 203 against Vollman's 248 (section 3, D9).

---

## 2. Per-entry table

Status key: **NS-season** = Python season/advanced bundle, never imported (0 rows). **NS-native** = approved native policy, not activated (no catalog head). **Research** = writes local files only. **Live** = reachable in production today.

| ID | Verdict | Evidence | Reference compared | Magnitude | Served / downstream |
|---|---|---|---|---|---|
| 001 runtime feature RPC | Mis-specified | `supabase/migrations/20260805003121_…context_rates.sql:59-60, 84-95, 114-116, 133` | Marcel weighting; opponent-adjusted rates | Team and opponent rates pool every season; 0.7/0.3 blend ignores sample size (1 current game still gets 0.7); `startTime < cutoff` admits games in progress | Deployed (4-arg, `pg_proc`). No stored outputs. Not served |
| 002 fantasy predictor script | Wrong | `web/scripts/performance_prediction.py:237, 262, 271` | Time-ordered features | Team rolling mean runs over rows sorted by player, so it mixes players; season progress uses the season's final date | Dead script. None |
| 003 advanced skater/team observations | Mis-specified | `modeling/player_forecasts/advanced.py:1016-1300` (bands at ~1162) | NST high danger (zone based) | "High danger" is distance ≤ 20 ft over all attempts. Missing player-games lead not verified | NS-season |
| 004 advanced goalie bands, GSAx | Mis-specified | `advanced.py:1207-1215, 1793-1809` | NST HDSV%; owner decisions 7, 10 | Goalie bands count shots on goal; skater bands count all attempts, under one name. GSAx = xGA − GA inherits W1-1's leaky goalie xG | NS-season |
| 005 EDGE context | Sound | `advanced.py:759-870` | n/a (descriptive, zero coefficient) | None | NS-season |
| 006 Gaussian copula | Mis-specified | `advanced.py:1867-1913, 2082-2095` | Estimated correlation matrix | One unestimated 0.65 for every pair. Marginal p10/p90 are unaffected; 256 draws add about ±0.11 SD of noise. The 84-game cap is right (lead refuted) | NS-season |
| 007 advanced per-game variance, team totals | **Wrong** (C17) | `advanced.py:1997-2001`, `:2172-2174` | Split conformal half-width | Section 3, D4 | NS-season |
| 008 advanced EB policy | Mis-specified | `advanced.py:875-977`, `:1351-1372`; `:71-73` | Conformal with held-out calibration; rolling-origin with separate folds | Section 3, D3 | NS-season |
| 009 "expected assists" | Mis-specified | `advanced.py:980-1000`, `:1984-1995` | xA from shot-assist xG | Actual-assist projections under an "expected" name; always flagged fallback | NS-season |
| 010 season / ROS aggregation | Mis-specified | `season.py:4437-4468`, `:4330-4345` | Talent uncertainty (Marcel reliability) | Section 3, D5 | NS-season |
| 011 context profile | Mis-specified | `season.py:1711-1846` | Delta-method aging curves | Within-player ratios are survivor-biased. Low impact: used only when this family wins | NS-season |
| 012 future age multiplier | Mis-specified | `season.py:1848-1865` | Marcel age factor | Applied only to targets where the contextual family won, so most targets get no aging; date hard-coded 2026-10-01 | NS-season |
| 013 current-appearance skater rate | Mis-specified (C16) | `web/lib/player-forecasts/baselineRates.ts:14-18, 231-268`; `nativeDailyMeansCapture.ts:467-473` | Marcel; Tango n/(n+k); Robinson EB | Section 3, D1 | NS-native. Would feed Start Chart, RSO, FORGE expectations |
| 014 prior-appearance skater rate | Mis-specified | `baselineRates.ts:204-228`; `nativeDailyMeansCapture.ts:30-33` | Marcel | Last 20 of up to 82 prior games (the policy hash says 82); unregressed, unaged; dropped entirely after one current game | NS-native |
| 015 legacy skater baseline | Mis-specified | `baselineRates.ts:90-200`; `baselinePolicy.ts:59-60` | Tango stat-specific k | Fixed k = 20 for every stat; reads `PROJECTIONS_*` (banned for FORGE on 10-26) | Dead as a policy; its kernel still computes 014's counts |
| 016 SOG canary | Sound (light read) | `currentSeasonSogBaseline.ts:97-172` | n/a | n ≤ 5, one hard-coded player; labelled unreleased | Draft |
| 017 native PP points | Sound | `nativePowerPlayPoints.ts:22` | NHL PPP definition | None | NS-native |
| 018 daily-board ridge context | Sound | `daily_board_context.py:140-175` | Ridge on residuals | None found | Research |
| 019 goalie temperature scaling | Sound | `daily_board_models.py:140-157` | Guo et al. 2017 | None | Research |
| 020 daily-board baselines | Mis-specified | `daily_board_models.py:22-97` | Tango exposure prior | Goalie counts use TOI exposure like skaters; issuance prior of 300 min was never tested (see 024) | Research |
| 021 participation logistic | Sound | `daily_board_models.py:99-131` | L2 logistic | Fixed 1,000 steps on standardised inputs; convex, adequate | Research |
| 022 joint game simulator | Sound | `daily_board_scenarios.py:43-53, 145-240` | Poisson shot process | Documented limits only (no relief, no empty net) | Research |
| 023 strength-split baselines | Mis-specified | `daily_board_strength.py:25` | Exposure-based reliability | One 180-minute prior for EV, PP and PK despite very different exposure | Research |
| 024 baseline policy grid | **Wrong** | `daily_board_training.py:41-51`; `daily_board_baseline_issuance.py:20` | Selection must match what is issued | Grid tests 60/180/360 prior minutes; issuance hard-codes 300. The selected policy is not the issued one | Research |
| 025 deployment evidence, availability | Mis-specified | `season.py:2881-2960, 3484-3495` | Return-date models | One injury or scratch snapshot cuts play probability by 50–70% for every remaining game | NS-season |
| 026 role heuristics | Undetermined | `season.py:3543-3660` (not read line by line) | n/a | Constants unvalidated per inventory | NS-season |
| 027 team goal alignment | Sound (light read) | `web/lib/forecast-diagnostics/contract.ts:117-160` | Accounting identity | None | Research |
| 028 empirical team goals | Mis-specified | `forecast-diagnostics/pairedInputs.ts:7, 81-100` | Dixon-Coles style, home ice | Minimum 1 game; no home ice, no regression. Labelled unfitted | Research |
| 029 prospective evaluation | Sound (light read) | `web/lib/player-forecasts/evaluation.ts:34, 51-210` | MAE, Brier | No non-test callers | Dead |
| 030 ledger scoring | Mis-specified | `servedForecastLedger.ts:140-161, 332-342, 424` | Like-for-like scoring | Section 3, D6 | **Live** (`/api/v1/forge/scoreboard`) |
| 031 paired ledger, market scoring | Sound | `servedForecastLedger.ts:460-530` | Skill scores; Brier skill | RMSE skill and Brier skill use different ratios, both labelled | **Live** |
| 032 release gates v4, v5 | **Wrong** | `advanced.py:393-456, 1481-1528` | Held-out gate | Section 3, D3 | NS-season |
| 033 horizon residual quantiles | Mis-specified | `challenger_math.py:23-60` | Split conformal | Residuals come from the folds that picked the winner | Flagged off |
| 034 paired loss bootstrap | Sound (light read) | `daily_board.py:102` | Cluster bootstrap | None | Research |
| 035 daily-board metrics | Sound | `daily_board.py:41-100` | Gneiting & Raftery 2007 | CRPS and interval score (2/α = 10) check out | Research |
| 036 slate bootstrap, lockbox gates | Sound | `model.py:107-135`; `scoring.py:57-100` | Block bootstrap | None | Research |
| 037 range evaluation, skill score | Sound | `scoring.py:11-56` | 1 − loss ratio | "Skill" is 50 at parity, a nonstandard scale; say so wherever it is shown | Research |
| 038 conformal calibration (v4) | Mis-specified | `season.py:2391-2498`; folds `:77-81` | Angelopoulos & Bates 2021 | Section 3, D3 | NS-season |
| 039 challenger features | Undetermined | `challenger_features.py` (not read) | n/a | n/a | Flagged off |
| 040 historical-core features | Mis-specified | `features.py:60-135`; `model.py:13-27` | Marcel 5/4/3 | 0.7/0.3 fixed; `empirical_bayes_rate` is computed but is not a candidate | Research |
| 041 native goalie win rate | Mis-specified | `goalieBaselineRates.ts:184-221` | Team win probability | Section 3, D2 | NS-native |
| 042 native goalie volume rates | Mis-specified | `goalieBaselineRates.ts:224-256` | SV% regression (Tango; beta-binomial EB) | Section 3, D2 | NS-native |
| 043 native summary W and SO rates | Mis-specified | `goalieBaselineRates.ts:259-308` | Same | Section 3, D2 | NS-native |
| 044 legacy goalie baseline | Mis-specified | `goalieBaselineRates.ts:78-173` | Same | W and SO are pure external consensus; reads `PROJECTIONS_*` | Dead (dry runs only) |
| 045 goalie starter label | Sound | `nativeGoalieOutcomes.ts:19-60, 185` | Official `starter` flag | Matches Batch A's "one credited start per team-game, unknown stays unknown" | Label only |
| 046 challenger serving | **Wrong** | `challenger_inference.py:49-71`; `challenger_model.py:380, 424-447` | Train/serve parity | Section 3, D7 | Flagged off |
| 047 per-game target multiplier | Mis-specified | `season.py:4090-4138` | log5 / multiplicative strength | Goalie GA ignores own team defence; PP targets ignore opponent PK; venue effect applied to both teams | NS-season |
| 048 per-game mean and variance | Sound | `season.py:4348-4434` | Law of total variance | Mixture formula is right | NS-season |
| 049 frozen-window participation | Sound | `modeledSkaterParticipation.ts:177-243`; `nativeDailyPipelineV2.ts:30` | n/a | Expired by design on 2026-10-27 | Dead |
| 050 skater participation frequency | Mis-specified | `modeledSkaterParticipation.ts:100-125` | Beta-binomial smoothing | Section 3, D8 | Kernel only |
| 051 rolling 14-day participation | Mis-specified | `rollingWindowParticipation.ts:45-64` | Same | Section 3, D8 | NS-native (flag off by default) |
| 052 PP shot-rate ablation | Sound (light read) | `pp_shot_support.py:74-110` | n/(n+k) | None | Research |
| 053 adjusted defense rating | Mis-specified | `season.py:2781-2852` | RAPM / xGA-based ratings | All strengths mixed (penalty killers penalised); geometric mean halves each effect; chance value and goals are both added, so the scale is about double. The "5 skaters share the ice" lead is **not** a defect: on-ice counts are not split | NS-season |
| 054 rating signals, percentiles | Mis-specified | `season.py:3500-3530, 3623-3625` | Mid-rank percentile | Plus-minus per 60 is pooled with goal-equivalent suppression; offence is per game, so it tracks ice time | NS-season |
| 055 derived-stat reconciliation | Sound (light read) | `season.py:3935-4088` | NHL definitions | Win% is W/GS, not W/decisions | NS-season |
| 056 normal quantiles, ratio intervals | Mis-specified | `season.py:4330-4345, 4226-4240` | Count quantiles | p50 is the mean; extreme pairing (p10 ÷ p90) is not a quantile and is too wide | NS-season |
| 057 game expectations | Sound | `gameExpectations.ts:138-225` | SV% = SV/SA; GAA = 60·GA/min | Ratio of expected totals, labelled. `PENALTY_MINUTES` unit shows as "count" (label only) | **Live**, carrying the bridge source |
| 058 TS rest-of-season | Mis-specified | `restOfSeason.ts:17-60` | Same as 010 | Independence again; writer has no callers; table is empty | Dead writer |
| 059 rookie logistic offsets | Mis-specified | `rookies.py:306-346` | Logistic with offset | Ridge 0.2 on the mean gradient is about 3× the data curvature, so offsets are shrunk roughly 70% toward zero. Undrafted = pick 128 | NS-season |
| 060 rookie league transition | Mis-specified | `rookies.py:350-470` | NHLe (Desjardins) | Factors use only players who made the NHL (survivor selection) | NS-season |

---

## 3. Defects

### D1 · Native skater means are raw, with a hard season switch (M-PFC-013, 014; C16) · P1
- **What.** As soon as one current-season appearance exists, the prior season is discarded and the estimate is a 0.9-decay mean of at most 20 games with no prior (`baselineRates.ts:243-255`; selection at `nativeDailyMeansCapture.ts:467-473`).
- **Correction to C16.** The "effective sample of about 8 games" is the weight sum (8.78). The variance-effective sample is about 15 games at a full window and about 10.6 at 12 games.
- **Magnitude (ledger proxy, 2026-10-22 to 11-08, 2,215 dressed skater-games on 10 slates, 11.8 prior games on average).** The ledger has no native rows, so I used `naive_season` (the plain current-season mean) as the stand-in. The native decay makes it slightly noisier than this.

| RMSE | League constant | Raw season mean | Shrunk, k games | FORGE bridge | Raw mean slope |
|---|---:|---:|---:|---:|---:|
| Goals | 0.4479 | 0.4452 | 0.4365 (k=10) | 0.4336 | 0.54 |
| Assists | 0.5963 | 0.5763 | 0.5694 (k=10) | 0.5659 | 0.67 |
| Shots | 1.4965 | 1.3893 | 1.3680 (k=5) | 1.3691 | 0.74 |

  - Shrinkage beat the raw mean on 8 of 10 slates for goals, 6 for assists and 7 for shots.
  - For the 129 rows with 5 or fewer prior games, the raw mean (0.3524) was worse than the constant (0.3211).
  - 25 rows carried a raw goal rate of 0.75 per game or more; the maximum with 3 or fewer games was 1.00.
  - Hits and blocks behave differently: the raw mean beat the bridge (1.217 against 1.339; 0.960 against 0.999). Stat-specific k matters.
- **Caveats.** Ten slates, no confidence interval, a proxy for the policy, and the league mean is the cohort's own pre-game mean. This is an alarm that agrees with theory, not a fitted k.
- **Fix.** One estimator: `(Σw·x + k_stat · prior) / (Σw + k_stat)`, with the prior built from prior-season rate (aged, and regressed to position mean) so the switch disappears. Fit `k_stat` per stat on held-out dates. Keep the policy version and hash separate from the approved raw policy.
- **Test.** Monotonicity: with identical per-game values, the estimate moves from prior toward the sample mean as games are added, with no jump between 0 and 1 current games. A 1-game, 1-goal player must not get 1.0.

### D2 · Native goalie rates are not regressed at all (M-PFC-041, 042, 043) · P1
- **Answer to the brief's question:** no. Saves, goals against, shots against and minutes are equal-weight means over at most 20 current appearances including relief (`goalieBaselineRates.ts:229-246`); wins and shutouts are credits ÷ appearances (`:207-208`, `:272-273`, `:300-301`). Goalies with no current appearance get nothing, with no prior-season fallback.
- **Magnitude (146 settled starts, 59 goalies, same ledger window, starts with 15+ shots).** Raw save percentage had SD 0.026 and range .804–.947 on about 187 prior shots. Given the actual shots faced, goals-against RMSE was 1.670 with the raw rate, 1.495 with the league rate and 1.494 with a 2,500-shot prior. The slope of next-start GA rate on the raw rate was 0.043.
- **Reference.** Binomial noise alone at 187 shots is about ±0.022, against a talent spread of well under ±0.01, so reliability of 187/(187 + k) with k in the low thousands of shots is the expected order (Tango-style regression; beta-binomial EB).
- **Also.** Relief appearances sit in the denominator of wins, so a backup's per-appearance win rate is depressed, and then it is multiplied by an appearance probability that also counts relief.
- **Fix.** Regress GA through save percentage with a shots-based prior; project shots against from team and opponent, not from the goalie's own short sample; take wins from team win probability × start probability (owner decision 1 caveat applies).
- **Test.** A goalie with 5 starts at .950 and one at .850 must both land within about ±0.010 of league average.

### D3 · Gates that cannot fail; calibration and selection share one sample (M-PFC-032, 038, 008) · P1
- **v4** (`season.py:2192-2209, 2355-2369, 2391-2498`): decay, shrinkage and model family are picked by lowest MAE on `VALIDATION_FOLDS`; the interval multiplier is the 80th percentile of standardised residuals on the same rows; ties are randomised so reported coverage is 0.8 by construction. The gate then asks for coverage in [0.75, 0.85] and selected MAE ≤ baseline MAE (`advanced.py:420-431`). Both hold by construction.
- **v5** (`advanced.py:885-915`): same pattern on one window, 2026-01-03 to 04-16. `source_game_coverage` is passed as the constant 1.0 (`:1352, 1361, 1371`), so the ≥ 0.95 source gate is also vacuous.
- **Lockbox reuse.** That window is the documented lockbox (`contract.py:33`; `evaluation.ts:34`; runbook line 352 says tuning and calibration reject rows from 2026-01-03). v4's second and third folds and v5's whole validation window sit inside it. No untouched 2025-26 data remains for either model.
- **Selection metric.** MAE on sparse counts rewards predictions near the median (zero for goals), so it favours low estimates. A mean forecast should be chosen by squared error or Poisson deviance.
- **Interval coverage on data not used for fitting (the brief's done-criterion): not measurable today.** No v4/v5 bundle exists in the database or the repo, and 2026-27 has no imported game outputs to score.
- **Fix.** Three time-ordered pieces: fit and select, calibrate, report. Gate on the report piece only. Until a 2026-27 prospective sample exists, label intervals "uncalibrated" in the bundle.
- **Test.** Feed the gate an artifact whose intervals are deliberately half as wide; it must block.

### D4 · C17: the 80% residual is used as a standard deviation (M-PFC-007) · P2
- **Confirmed** at `advanced.py:1997-2001`: `conditional_variance = max(rate, residual80²)`, then ±1.2816 × SD.
- **Size, corrected.** It bites only where `residual80² > rate` (dense, overdispersed targets such as shot attempts and on-ice counts). There the band is 1.28× too wide, about 90% coverage for normal errors. For sparse targets the Poisson floor wins and C17 has no effect.
- **Inconsistent with itself.** Team rows use the residual directly as the half-width (`:2172-2176`), which is the right reading.
- **Team totals** use `residual × √games`. That treats game errors as independent around a known rate and omits rate uncertainty, which grows with games, so season team bands are too narrow.
- **Fix.** p10/p90 = mean ∓ residual80 for the playing case; carry a separate variance for the mixture. **Test.** Synthetic normal errors: empirical coverage of the emitted band within 0.80 ± 0.02.

### D5 · Season totals assume independent games (M-PFC-010, 058) · P2
- `_aggregate_components` sums per-game variances (`season.py:4440-4444`); the per-game variance was calibrated on single-game residuals.
- **Illustration, not a measurement.** A 30-goal forecast over 84 games: summed game variance is about 30, giving ±7. Add an assumed 20% talent uncertainty (SD 6 goals) and 10 games of availability uncertainty (SD 3.6) and the SD is about 8.9, giving ±11. The ±7 band would then cover about 57%.
- Availability is also treated as independent per game: games-played SD is about 2.7 at p = 0.9, where injuries cluster.
- **Fix.** Add a between-season talent variance term and a correlated availability term, or simulate player-level draws. **Test.** Backtest season totals on a prior season: p10–p90 coverage within 0.80 ± 0.05.

### D6 · Ledger scoring mixes conditioning; C18 confirmed (M-PFC-030) · P2 · live
- Bridge rows are unconditional means; naive rows set participation to 1 (`servedForecastLedger.ts:146-147`); scoring is dressed-only. On the 2,215 paired rows: actual goals 0.191, bridge 0.174, naive 0.183–0.190; actual shots 1.582, bridge 1.487, naive 1.58. The bridge's stored `participation_probability` was null on every paired row, so it cannot be divided back out.
- **C18** (`:159`): the goalie `naive_last5` uses the last 10 starts and 10 team games.
- The back-to-back subset uses `team_rest_days === 1` (`:424`) with rest as date difference, the same convention as `season.py:1688`. `horizons.py:60` uses date difference minus 1. Carry to part 2 (M-PFC-102).
- **Fix.** Score each source on its own basis: unconditional forecasts against the full universe (DNP = 0), conditional forecasts against dressed players. Persist the participation probability. Rename the goalie control. **Test.** A source with p = 0.9 and a perfect conditional mean must show zero bias.

### D7 · Challenger serving falls back to the position prior for most winners (M-PFC-046) · P2 · flagged off
- Training can select `hierarchical_opportunity`, `calibrated_*`, `decomposed_independent_selected` or `history_adaptive_assist` (`challenger_model.py:380, 424-447`). None is a feature key, so `snapshot["features"].get(candidate)` is `None` and serving returns `position_prior` (`challenger_inference.py:49, 69-71`).
- The lead's "no fallback flag" is half right: `fallbackToPositionPrior` is returned, but the runtime treats it as a normal result.
- `or position_prior` also replaces a legitimate 0.0 team or opponent rate (`:62-63`).
- **Fix.** Serve only candidates the inference path can compute, and fail closed otherwise. **Test.** For every winner the trainer can emit, serving reproduces the training-time estimate on a fixture row.

### D8 · Participation is a raw frequency on 6–8 games (M-PFC-050, 051) · P2
- `p = positive-minute games ÷ eligible games` (`modeledSkaterParticipation.ts:118-125`), with a 14-day window. Probabilities move in steps of about 1/7 and reach 0 or 1 often; both then multiply straight into totals.
- Goalie start frequencies are computed per goalie. Downstream rejects a team sum above 1 but accepts any sum below it (`planningContributions.ts:112`; C20, which belongs to M-PFC-122). Per Batch A, unresolved mass should stay an explicit unknown rather than be rescaled.
- **Fix.** Beta-binomial smoothing toward a role prior; report team start mass and the unknown remainder. **Test.** 7 of 7 must give less than 1; 0 of 7 more than 0.

### D9 · C19 quality start: confirmed, but the direction was wrong (M-PFC-113, sized here) · P2
- Rule at `season.py:556-566`: starter with ≥ 59 minutes and (GA ≤ 2 **or** SV% ≥ .917).
- **Sample (482 starts, 2026-01-03 to 02-02, league SV% .8926, 59-minute gate not applied).** FHFH rule 203; Vollman's rule (above league average, or at least .885 with two or fewer goals against) 248; the NHL's own flag 223. FHFH-only: 17 (two or fewer goals on a sub-.885 night). Vollman-only: 62 (above average, below .917, three or more goals).
- So the rule **under-counts by about 18%** in a .893 league, and the 59-minute gate lowers it further. The fixed .917 is the larger error.
- **Fix.** Vollman's definition with the season's league SV%. **Test.** 30 saves on 33 shots (.909) is a quality start; 8 saves on 10 is not.

### D10 · Research and dead-code defects · P2
- **M-PFC-024:** issue the policy the grid selected, or put 300 minutes in the grid.
- **M-PFC-002:** dead; delete only as a separate cleanup decision (Batch A rule 6).
- **M-PFC-001:** if inference is ever enabled, bound the context rates to recent seasons and make the 0.7/0.3 blend sample-aware.
- **M-PFC-003, 004, 009:** rename (distance bands, not "high danger"; "projected assists", not "expected").

---

## 4. Questions for the owner

1. **Is the native path meant to be live?** Production has no catalog head and no native rate observations since 2026-10-16. If activation is planned, D1 and D2 should land first.
2. **Native skater prior:** approve a blended policy (prior season plus current, stat-specific shrinkage) as a new policy version to replace the raw current-only mean?
3. **Goalie native means:** approve regressing save percentage and taking wins from team win probability, rather than a goalie's own short record?
4. **The 2025-26 lockbox is spent** for v4 and v5. Accept "uncalibrated" labels until a 2026-27 prospective sample exists, or carve out a new holdout?
5. **Quality start:** Vollman's definition with the season's league average, or keep a fixed rule and name it differently?
6. **Ledger basis:** score unconditional forecasts on the full universe (DNP counts as 0), or keep dressed-only and convert every source to conditional?

---

## 5. Limits

- **A read I should not have run.** To learn which native policies had been written, I grouped `player_forecast_source_observations` by three small keys extracted from its `payload` jsonb. The table is 71 MB in about 740 rows, so the server detoasted every payload. Only 14 summary rows came back and activity stayed at 0 afterwards, but it was a whole-table jsonb read, which the rules forbid. I did not repeat it.
- **Served status is from the production database only.** I did not read Vercel environment names or values (`PLAYER_FORECAST_NATIVE_CATALOG_HEAD_ID`, `PLAYER_FORECAST_ENABLE_INFERENCE`). An empty catalog-head table settles the native question regardless; local or file-only runs of `forge-daily-v2` would not show here.
- **No native rows exist to score.** D1 and D2 use ledger proxies (`naive_season`), 10 slates, with no confidence intervals and no time-clustered resampling. The scratch SQL is not in the repo; the queries are simple aggregates over `forge_served_forecast_ledger` and can be rebuilt from this description.
- **Interval coverage was not measured** on held-out data: no season artifact, freeze or golden vector exists in the repo or the database. D4 and D5 are derived from the code and stated assumptions.
- **Light reads** (verdict rests on a partial read plus the inventory): M-PFC-016, 027, 029, 034, 052, 055. **Not read:** M-PFC-026, 039 (both undetermined).
- **Not verified:** the M-PFC-003 lead that player-games with no on-ice rows are missing rather than zero; whether `chances_against` in M-PFC-053 is on-ice or team-level; the 10,000-observation position prior in M-PFC-040.
- No tests were run, and no NHL, NST or Yahoo calls were made.
