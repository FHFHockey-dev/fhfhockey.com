# W1-10 · Game predictions and odds: math audit

Auditor: Claude (Fable), 2026-11-11, `octoberBranch` at 87785fdbc. Scope: M-GPR-001 to 045 per TRIAGE.md §2 W1-10. Read-only; no code changed.

**Evidence rules.** Every stored-data number below is a dated sample from bounded reads on 2026-11-11 (queries in §6), not a population rate. Log loss and Brier figures are alarms, not proofs (Batch A rule 2). Paths are relative to `web/` unless they start with `supabase/` or `tasks/`.

## 1. Summary

| Verdict | Count | Entries |
|---|---:|---|
| Sound | 14 | 002, 003, 005, 008, 009, 019, 021, 024, 027, 029, 033, 040, 042, 043 |
| Mis-specified | 25 | 001, 006, 007, 010–015, 017, 018, 020, 023, 025, 026, 030, 031, 032, 035, 036, 038, 039, 041, 044, 045 |
| Wrong | 5 | 004, 016, 022, 028, 034 |
| Undetermined | 1 | 037 |

### Answers to the brief's questions

- **What does production serve, and was it ever fitted?** Right now production serves **no game-prediction model output**. No row in `game_prediction_model_versions` has status `production` (all nine are `candidate`), so `ensureServingModelVersion` refuses to persist (`lib/game-predictions/workflow.ts:817-849`, `:352-374`). The last stored prediction is dated 2026-06-17. When it did run, the model was `INITIAL_BASELINE_MODEL`: hand-typed weights, never fitted (`workflow.ts:48-71`). C24 is confirmed, with this correction to its "served" wording.
- **Home-ice term?** None. Bias is 0 (`workflow.ts:70`). Stored final predictions average 0.498 home probability (49 playoff games).
- **Zero-weight and forced-zero features.** Of 53 keys, 15 have non-zero weight. Six of those 15 are in the default-excluded list and are forced to 0 before the dot product (`baselineModel.ts:267-277`, `:790-794`): recent-20 and recent-40 goal differential, recent-20, recent-40, season-to-date and cross-season xGF%. Nine weights are live: four power-rating differences, point %, goal differential, recent-5 and recent-10 goal differential, recent-10 xGF%. Rest, goalie GSAA, CTPI, schedule strength, roster impact, FORGE and market features all have weight 0, despite the version name `v6_roster_ctpi_sos_threshold_52`.
- **Calibrated? Does the 0.52 rule make accuracy and confidence inconsistent?** Not calibrated by any fitted step. Yes, inconsistent: see D4.
- **How many implied-probability implementations?** Six, plus a seventh de-vig library. They agree on the American-odds formula and differ in validation, decimal handling, rounding and de-vig method: see D9.

### Top 5 findings by user impact

1. **Nothing is being served, and the cron reports success (D1).** The forecast cron has run 948 times with status `success`; today's two runs both returned `no_production_model` with 0 persisted and 6 games skipped. `/nhl-predictions` and the homepage win-probability slot have had no data all of 2026-27. Given the model is a placeholder (owner decision 1), the gate is doing the right thing by accident; the defect is that it is silent.
2. **The only model win probability users see is the Game Grid's legacy Poisson number, and it is poor (D2; owned by W1-4 D5).** On 85 regular-season games (2026-10-25 to 11-10) with a pregame market snapshot: Game Grid log loss 0.683, de-vigged market 0.642, fixed 54% home 0.697. It sits a mean 7.9 points from the market (max 30.5). It has no home-ice term: mean home probability 0.500 over 274 games where the home team won 55.8%.
3. **The game page's Poisson chart uses each team's own goals-per-game as "expected goals" and drops draws (D3).** No opponent defence, no home ice. Dropping draws instead of splitting them inflates the favourite by 2.4 points at λ 3.4 v 2.6 and 4.2 points at 4.2 v 2.2 against the stored legacy convention. Three draw conventions are live.
4. **The placeholder model, when it ran, was a power-rating score with a hidden 0.68 shrink (D5, D6).** On the last 53 stored issuances the data-quality multiplier averaged 0.68 (range 0.57–0.71): it never predicted undampened. The logit is dominated by rating differences that W1-4 found defective (C21, C22); point % and xGF% contribute about a tenth as much. No fitted candidate has shown skill either: the best walk-forward backtest (369 games) scored 0.6862 against 0.6905 for a fixed 54%.
5. **The evaluation and promotion plumbing would mis-score any model (D4, D7, D8).** Scoring counts every issuance as a game (100 rows for 35 games). The 0.52 winner rule lowers expected accuracy and breaks the calibration gap. The public calibration summary is always null (C25 confirmed). The promotion thresholds sit inside sampling noise, and a promotion would not change the served weights.

## 2. Benchmarks on settled games

All samples small. None supports a ranking of models; they show the size of the gap to the market.

**A. Paired cohort: 85 regular-season games, 2026-10-25 to 11-10** (latest DraftKings snapshot before puck drop, mean 3.1 h before; home team won 49.4%).

| Forecast | Log loss | Brier | Accuracy |
|---|---:|---:|---:|
| De-vigged closing moneyline (proportional) | 0.6418 | 0.2254 | 64.7% |
| Game Grid legacy Poisson (`expected_goals.home_win_odds`) | 0.6834 | 0.2451 | 57.6% |
| Coin flip | 0.6931 | 0.2500 | — |
| Fixed 54% home | 0.6973 | 0.2521 | 49.4% |

Caveat: all 274 `expected_goals` rows this season were last updated after their game date, so the Game Grid figures are not a clean pregame record. Mean overround of the market snapshots is 4.37%.

**B. Placeholder model: 49 settled playoff games, 2026-04-28 to 06-17** (final pregame issuance per game, three compiled versions pooled; home team won 46.9%).

| Forecast | Log loss | Brier | Accuracy |
|---|---:|---:|---:|
| Placeholder (stored) | 0.6589 | 0.2331 | 67.3% (stored 0.52 pick); 61.2% (0.50 pick) |
| Coin flip | 0.6931 | 0.2500 | — |
| Fixed 54% home | 0.7013 | 0.2540 | 46.9% |

No market snapshots exist for these games (ingestion began 2026-10-25), so the market comparison the brief asks for **cannot be made on any game the model predicted**. 71 games were predicted; only 49 have a usable outcome (see D7).

**C. Fitted candidates: walk-forward backtest, 369 games, 2026-01-01 to 03-08** (home team won 53.7%).

| Candidate | Log loss | Brier | Acc. (stored) | Acc. (0.50) | SD of p |
|---|---:|---:|---:|---:|---:|
| v1 (no normalisation) | 1.0460 | 0.3457 | 50.1% | 50.1% | 0.314 |
| v2 normalised | 0.6888–0.6892 | 0.2478–0.2480 | 55.6% | 55.6% | 0.063–0.071 |
| v3 recent form | 0.6866 | 0.2467 | 53.9% | 53.9% | 0.060 |
| v4 threshold 0.52 | 0.6862 | 0.2465 | 55.0% | 56.1% | 0.059 |
| Fixed 54% home | 0.6905 | 0.2487 | 53.7% | — | 0 |

The best candidate beats a constant by 0.0043 log loss on 369 games. I did not have per-game losses for a paired interval, but a gap that size on that sample is not distinguishable from zero. v1 shows what unnormalised features do to a fitted model: 45 of 369 predictions pinned at the 0.05/0.95 floor. For scale, the market's home probability has SD 0.103 in cohort A.

**Elo.** No Elo implementation exists in the repo, so the FiveThirtyEight-style benchmark in the brief could not be scored. It belongs in the replacement spec (§4).

## 3. Per-entry table

Reference standards are those named in the brief. "Served weight" is the weight in `INITIAL_BASELINE_MODEL`.

| ID | Verdict | Evidence | Reference compared | Magnitude | Downstream |
|---|---|---|---|---|---|
| 001 Simple baselines | Mis-specified | `accountability.ts:1354-1366`, `:1568-1654`, `:1897-1925` | Home rate; Elo; closing line | `boundedEdgeProbability` jumps 0.50 → 0.53 on any non-zero edge. Fixed 0.54 is close to the samples (53.7%, 55.8%). No Elo. Market is reported but excluded from the promotion floor | Promotion gate floor |
| 002 Candlesticks, rolling accuracy | Sound | `accountability.ts:1385-1459`, `:1461-1529` | Forecast verification | Uses the final pregame issuance per game. If `startTime` is missing, post-start rows are not filtered (`:1390-1392`) | Accountability API, `/nhl-predictions` |
| 003 Feature signals | Sound | `baselineModel.ts:352-409`, `:1159-1248` | Point-biserial r; mutual information | Diagnostics only. Population SD; O(n²) binning is a cost, not an error | Admin route |
| 004 Evaluation metrics | **Wrong** | `workflow.ts:1296-1317`; `evaluation.ts:91-112`, `:133-161`, `:426-470` | Log loss, Brier, reliability bins | Formulas are right. The scorer counts every issuance: v4 has 100 scored rows for 35 games. D7 | `game_prediction_model_metrics`, public performance box |
| 005 Walk-forward splits | Sound | `workflow.ts:1343-1363`; `accountability.ts:657-678`, `:3157-3183`; `featureBuilder.ts:2762-2764` | Rolling-origin evaluation | Time-ordered; features use rows strictly before the as-of date. Date ordering does not prove knowledge time for backfilled rows (W1-4, C26) | Backtests |
| 006 Feature vector | Mis-specified | `baselineModel.ts:279-281`, `:641-795` | Standardised inputs for a linear model | Missing and excluded features both become 0 ("teams equal"). Hand divisors (/50, /3, /100). Raw rating points sit beside fractions. D5 | Served model, all candidates |
| 007 Roster/form blend weights | Mis-specified | `featureBuilder.ts:1698-1732`, `:1670-1679`, `:2024-2048` | Shrinkage by sample size (Tango) | Hand checkpoints. `home×w_home − away×w_away` gives a non-zero edge to two equal teams with different games played unless the rating is centred at 0 (not verified). Served weight 0 | Candidate only |
| 008 Season phase | Sound | `featureBuilder.ts:1734-1763` | — | Thresholds 20 and 60 games are a labelled convention | Segments |
| 009 Rest, back-to-back | Sound | `featureBuilder.ts:828-853` | — | Days rest = day difference − 1. Served weight 0, so rest has no effect on the output | Context |
| 010 Power-rating differences | Mis-specified | `featureBuilder.ts:855-875`; `workflow.ts:51-54` | W1-4 audit | Subtraction is right; inputs are slate-standardised and double-counted (C21, C22). Mean \|off diff\| 20.7 points × 0.018 = 0.37 logit; goalie 11.5 × 0.02 = 0.23. These two dominate the model | Served model |
| 011 Recent form windows | Mis-specified | `featureBuilder.ts:928-972`, `:974-1083` | Ratio of sums; shrink short windows | Ratio of sums is right. Early-season windows with 2–3 games are used unshrunk. Share fallback takes the most recent single game's % (`:955-959`), only when counts are absent. All-situations NST xG, unadjusted | Served model (recent-5/10 GD, recent-10 xGF%) |
| 012 Roster impact | Mis-specified | `rosterImpact.ts:55-80`, `:113-135` | — | Goalie impact averages every rostered goalie, not the expected starter. Served weight 0 | Candidate only |
| 013 Goalie blend, uncertainty | Mis-specified | `featureBuilder.ts:1310-1467`, `:1469-1483`, `:1631-1644` | W1-5 audit | A goalie with no GSAA adds 0 at full weight (unknown becomes league average). Projected and NST GSAA mixed. Start probabilities rescaled to sum to 1. Inherits C26 look-ahead. Served weight 0 | Dampening penalty; candidates |
| 014 Past-opponent strength | Mis-specified | `featureBuilder.ts:1124-1131`, `:1155-1222` | W1-4 audit | Equal-weight mean of four ratings on unlike scales. Slot handling is careful (missing opponents are not replaced). Served weight 0 | Candidate only |
| 015 Opponent-adjusted form | Mis-specified | `featureBuilder.ts:1224-1242`, `:463-467` | — | Neutral point 50 against ratings centred on 100 adds about +1 goal/game per team. Documented in code as a compatibility contract. It cancels in the home-minus-away feature; the /50 scale is unfitted | Candidate only |
| 016 Heat-map tie-breaker | **Wrong** | `components/GameGrid/utils/poissonHelpers.ts:6-58`; `components/GameGrid/utils/calcWinOdds.ts:6-18` | — | The "redistribution" writes each draw cell back unchanged (the two ratios sum to 1). `calculateBlendedWinOdds` returns the model number on both branches. Display is unaffected; the names promise something that does not happen. D10 | Game Grid heat map |
| 017 Legacy Poisson win odds | Mis-specified | `lib/gameGoalProjections/calculations.ts:31-37`, `:77-108`, `:113-124`, `:188-210` | Dixon & Coles (1997); proportional de-vig | No home ice, independent Poisson, draws split 50/50. Inputs defective (W1-4 D5). The vig-included API average never fires: 0 of 274 rows this season have API odds. D2 | Game Grid |
| 018 Backtest calibration | Mis-specified | `accountability.ts:3251-3276` | Calibration on held-out data | Platt/isotonic is fitted on the model's own training predictions. Also inherits the isotonic tie defect (Batch A, W1-1 A) | Ablations |
| 019 Season recency weight | Sound | `accountability.ts:372-383` | — | 1, 0.65, 0.35, 0.2: a labelled heuristic, applied consistently in logistic training | Backtests |
| 020 ExtraTrees candidate | Mis-specified | `baselineModel.ts:972-986`, `:955-970`, `:1323-1342` | Geurts et al. (2006) | Bootstraps rows (the published method uses the full sample), ignores example weights, and reports value × importance as a "contribution" (unsigned) | Ablations |
| 021 Top factors | Sound | `baselineModel.ts:1268-1292` | Linear attribution | Weight × input is the exact logit contribution relative to an even matchup. It does not show the dampening step | `/nhl-predictions` factors |
| 022 Floor, threshold, confidence, edge | **Wrong** | `baselineModel.ts:20`, `:1250-1257`, `:1259-1266`, `:1563-1579` | Decision theory for a calibrated forecast | D4. 46 of 369 backtest games (12.5%) fall in [0.50, 0.52) | Stored winner, accuracy, public "pick" |
| 023 Data-quality dampening | Mis-specified | `baselineModel.ts:494-576`, `:1549-1556` | Calibration | Mean multiplier 0.68 on 53 stored issuances. D6 | Every stored probability |
| 024 Standardisation | Sound | `baselineModel.ts:578-605` | z-score | Weighted mean and population SD; scale 1 for constant columns | Candidate training |
| 025 Logistic training | Mis-specified | `baselineModel.ts:893-909`; `workflow.ts:1365-1373`; `accountability.ts:3228-3232`; `lib/xg/binaryLogistic.ts:84-133` | Ridge logistic regression | Three hyperparameter sets (0.05/0.01 × 800; 0.03/0.02 × 1000; 0.03/0.02 × 800). Fixed-iteration gradient descent with no convergence check (the same trainer did not converge in W1-1). Fitted weights are never loaded by serving | Candidates |
| 026 Served model | Mis-specified | `workflow.ts:48-71`, `:912`, `:817-849` | Owner decision 1 | Placeholder, per the owner. Not fitted; no home ice; no normalisation; currently not persisting. D1, D5 | `/nhl-predictions`, homepage |
| 027 ESPN odds, no-vig | Sound | `lib/game-predictions/espnOdds.ts:476-486`, `:498-523` | Proportional de-vig | Correct. Rounds each side to 6 dp before normalising (error < 1e-6). Mean stored overround 4.37% | Market snapshots |
| 028 Promotion gate | **Wrong** | `workflow.ts:1375-1477`; `accountability.ts:1773-1825` | Reliability; paired score differences | D8 | Model promotion |
| 029 Homepage tone | Sound | `components/HomePage/HomepageGamesSection.tsx:263-268` | — | Trivial comparison with 0.5. No data to show at present (D1) | Homepage |
| 030 Defense ease grade | Mis-specified | `pages/api/v1/start-chart.ts:715-745` | W1-4, W1-5 | Rank within tonight's slate only; the same opponent's grade changes with slate size | Start Chart |
| 031 Game stats moneyline | Mis-specified | `pages/stats/game/[gameId].tsx:118-135`, `:186-197` | Proportional de-vig | Maths right. Duplicate code. An unsigned "150" is read as decimal odds (0.67%). D9 | `/stats/game/[gameId]` |
| 032 Team-form audit script | Mis-specified | `scripts/audit-game-prediction-team-form.ts:104-143` | — | Model picks at 0.52, benchmark at 0.50; evaluation window is playoffs only | Manual audit |
| 033 Source audit checks | Sound | `scripts/audit-nhl-game-prediction-sources.ts` (identity checks) | — | The "home + away within 0.05 of 1" check is vacuous: away is stored as 1 − home | Manual audit |
| 034 Health checks, calibration summary | **Wrong** | `publicPredictions.ts:552-560`; `evaluation.ts:163-190`; `workflow.ts:123-159` | — | C25 confirmed: the filter reads `bin.count`, bins store `predictions`, so the summary is always null. Health also misses D1. D1, D8 | `/nhl-predictions`, admin health |
| 035 FORGE team features | Mis-specified | `featureBuilder.ts:1276-1308` | — | Short-handed goals omitted from projected goals. Served weight 0 | Candidate only |
| 036 Source freshness | Mis-specified | `featureBuilder.ts:749-767`, `:2181-2239` | — | 14 days is lenient for daily tables. Cutoffs are collected per team side, so a stale league-wide table counts twice | Dampening |
| 037 Team game normalisation | Undetermined | `lib/game-predictions/teamGameNormalization.ts:52-152` | — | No production caller found; logic not traced end to end. Settle by confirming it is unused, or by a fixture replay if it is wired in | None found |
| 038 Goalie workload | Mis-specified | `featureBuilder.ts:1550-1629` | W1-5 (credited start) | A "start" is TOI ≥ 1,200 s; a pulled starter is missed and a long relief counts. Context only | Display context |
| 039 Game page Poisson | Mis-specified | `components/PoissonDistributionChart.jsx:8-15`, `:86-147`; `pages/game/[gameId].tsx:606-627` | Dixon & Coles (1997) | D3 | `/game/[gameId]` |
| 040 Blend variants | Sound | `accountability.ts:880-893`, `:3409-3436` | Shrinkage toward a prior | Ablation experiments, labelled as such. Laplace-smoothed home prior is right | Ablations |
| 041 Game preview odds | Mis-specified | `components/GamePreview/GamePreview.tsx:74-90`, `:209-227` | Proportional de-vig | Same maths and same ambiguity as 031. D9 | Game preview |
| 042 Market snapshot selection | Sound | `featureBuilder.ts:1765-1836` | Pre-cutoff information only | Latest snapshot strictly before cutoff and puck drop. 0 of 413 stored snapshots were captured at or after start | Market feature, edge |
| 043 Poisson PMF | Sound | `lib/gameGoalProjections/utils.ts:8-13` | Poisson | Correct. A second implementation in the chart takes `(lambda, k)` in the opposite order and returns 0, not 1, at λ ≤ 0. D3 | Game Grid |
| 044 Promotion evidence | Mis-specified | `accountability.ts:1927-1971`, `:1973-2063` | — | Segment guardrails compare point estimates on segments as small as 20 games. D8 | Promotion |
| 045 Displayed score outcomes | Mis-specified | `components/PoissonDistributionChart.jsx:86-147` | — | Same as 039 | `/game/[gameId]` |

## 4. Defects

### D1 · No production model; the forecast cron reports success · P1
Entries 026, 034.
- **Evidence.** All nine `game_prediction_model_versions` rows are `candidate`. `cron_job_audit` has 948 `success` rows for `game-predictions-forecast`; both runs on 2026-11-11 returned `status: no_production_model`, `persistedPredictions: 0`, 6 games skipped. `game_prediction_history` ends 2026-06-17. The public payload filters to production versions (`publicPredictions.ts:429-447`), so it returns nothing.
- **Impact.** `/nhl-predictions` and the homepage win probability are empty for 2026-27. Daily scoring writes metric rows over zero games.
- **Fix.** This is a decision first (Q1). If withholding is intended, make it explicit: return a non-success audit status for `no_production_model` and show a "model withheld" state on the page. Do not bootstrap the placeholder back into production.
- **Test.** A forecast run with no production version yields an audit status other than `success`. The health report raises a warning when scheduled games have no prediction and no production version exists.

### D2 · Game Grid win odds: no home ice, weak against the market · P0 (owned by W1-4 D5)
Entries 016, 017.
- **Evidence.** §2 cohort A. Mean home probability 0.500 over 274 games; home teams won 55.8%. λ = attack × defence × league average with no venue term (`calculations.ts:31-37`).
- **Fix.** Follow the W1-4 direction: fix or withhold; do not switch to the placeholder. If repaired, add a home-ice term and decide the draw convention once (D3).
- **Test.** Two identical teams give the home side more than 50%. Win odds are scored against outcomes on a frozen cohort before display.

### D3 · Game page Poisson: wrong λ, and three draw conventions · P0
Entries 039, 043, 045.
- **Evidence.** λ is the team's own goals for per game (`pages/game/[gameId].tsx:607`, with the comment "Assuming this is the intended value"). Win % = P(home win) ÷ (P(home win) + P(away win)), which drops draws (`PoissonDistributionChart.jsx:139-143`). The stored legacy model splits draws 50/50 (`calculations.ts:99-100`). The heat map claims a redistribution that is a no-op (016).
- **Magnitude.** Computed here: at λ 3.2 v 2.9, 54.7% (split) against 55.6% (dropped); at 3.4 v 2.6, 62.5% against 64.9%; at 4.2 v 2.2, 77.9% against 82.1%. Independent Poisson gives a 16.7% draw at λ = 3 each; NHL regulation ties run higher (low 20s per cent, from memory, not checked here), which is the dependence Dixon and Coles correct for in low scores.
- **Fix.** Label the chart for what it is (a score distribution from season scoring rates) or feed it the same λ as the repaired Game Grid model. Pick one overtime rule, state it, and use one shared Poisson module.
- **Test.** One fixture, three surfaces, same λ: identical win %. λ ≤ 0 returns the same value from every Poisson helper.

### D4 · The 0.52 winner threshold · P1
Entries 022, 028, 032.
- **What happens.** Home is the predicted winner only at p ≥ 0.52 (`baselineModel.ts:20`, `:1576-1579`). For p in [0.50, 0.52) the page shows the home team as more likely and names the away team as the pick. Confidence uses |p − 0.5| (`:1250-1257`), so accuracy and confidence disagree in that band.
- **Why it is wrong.** For a calibrated forecast the accuracy-maximising pick is the side above 0.5. Picking the away side at p = 0.51 has expected accuracy 0.49. A threshold above 0.5 only helps a model biased toward the home team; this model has no home term and averages 0.498, so the rule shifts picks further from the home side.
- **Magnitude.** Backtest v4, 369 games: 46 games in the band; accuracy 55.0% with the rule, 56.1% without. Playoff sample, 49 games: 5 in the band; 67.3% with, 61.2% without, in a sample where home teams won 46.9%. The two samples disagree in sign, which is what noise looks like.
- **Fix.** Pick at 0.5. Give the fitted replacement an intercept so home ice lives in the probability. Rename the version.
- **Test.** For any p ≠ 0.5 the predicted winner is the side with the larger displayed probability.

### D5 · The placeholder's scale: a power-rating score in disguise · P1
Entries 006, 010, 026.
- **Evidence.** Mean absolute logit contributions on the last 53 stored issuances (13 playoff games, so few distinct matchups): offence rating 0.37, goalie rating 0.23, season goal differential 0.16, point % 0.036, recent-10 xGF% 0.012. Raw home probability ranged 0.35–0.65 (SD 0.126).
- **Why it matters.** The rating inputs are the ones W1-4 found standardised against the night's slate and double-counted (C21, C22). Point % and xGF% are near-inert at their weights because they enter as raw fractions.
- **Fix.** Replace, don't tune (owner decision 1). Spec in §5.
- **Test.** The replacement's training pipeline standardises inputs and stores the means and scales with the weights; a prediction recomputed from stored components matches to 1e-6.

### D6 · Data-quality dampening is always on · P1
Entries 023, 036.
- **Evidence.** Multiplier 0.57–0.71, mean 0.68, on 53 issuances; penalties present were stale sources, missing lineup, projected goalie and prediction horizon. Final SD of p fell from 0.126 to 0.085.
- **Problems.** The constants are hand-set. Stale sources are counted per team side, so a stale league table counts twice (`featureBuilder.ts:2181-2239`, `baselineModel.ts:502-507`). An unconfirmed goalie is penalised twice (`:522-539`). It runs after any calibrator (`:1545-1556`), so it would un-calibrate a calibrated model. Because it never switches off, it acts as an undeclared 0.68 shrink, and it is the reason the placeholder looks tame.
- **Fix.** Remove the multiplier from the probability path. Let a fitted model learn uncertainty from features (goalie confirmed or not, horizon). Keep data-quality flags as labels.
- **Test.** With a calibrator supplied, the stored probability equals the calibrator output apart from the floor.

### D7 · Scoring counts issuances, not games · P1
Entry 004.
- **Evidence.** `scoreGamePredictions` reads every history row in the window and scores each (`workflow.ts:1296-1317`). Stored data: v1 42 rows for 12 games; v4 100 for 35; v6 31 for 7. `evaluated_games` therefore overstates the sample about threefold, and games refreshed more often weigh more.
- **Also.** Outcomes come from `pp_timeframes` then `pbp_games` with no final-state check (`evaluation.ts:91-112`, `:441-466`); a stored in-progress score would count as a result. All 2,590 `pp_timeframes` rows are `OFF` today, so this is a latent risk, not an observed error. `pp_timeframes` holds no playoff games, so all 71 predicted games fell to the fallback, which resolved 49. The read has no pagination, so windows over 1,000 rows truncate silently. The default window is 14 days, and the public box shows the latest window as "performance".
- **Fix.** Score one issuance per game: the last before puck drop (the rule `buildPredictionCandlestick` already uses). Require a final state. Paginate. Report the season to date beside any rolling window, with the game count.
- **Test.** Three issuances for one game score as one game. A game with a non-final state is excluded.

### D8 · Promotion gate and calibration measures · P1
Entries 028, 034, 044, 018, 025.
- **Calibration gap.** Buckets use confidence max(p, 1 − p) but accuracy of the 0.52 pick (`accountability.ts:1773-1815`). In the 50–55% bucket the 12.5% of games in [0.50, 0.52) are scored as away picks at "confidence" above 50%. The gap is the maximum over buckets with any games, with no minimum count (`:1817-1825`): one wrong game alone in the 80–90% bucket gives a gap of about 0.85 against a limit of 0.05.
- **Thresholds.** Promotion needs 100 games and a 0.002 log-loss improvement (`workflow.ts:1389-1401`). The 369-game backtest could not separate a 0.0043 gap from zero.
- **In-sample calibrator** (018) and **three training configurations with no convergence check** (025).
- **Promotion does not change serving.** The cron calls `generatePregamePredictionsForWindow` without a model, so it always uses the compiled constants (`workflow.ts:912`).
- **Public summary.** Always null (C25); even when fixed, "N populated calibration bins" is not a calibration statement.
- **Fix.** Reliability by bins of the predicted probability of the picked side, with a minimum count per bin and intervals. Gate on a paired per-game score difference with a date-blocked bootstrap interval, on one frozen cohort. Fit calibrators on held-out folds. Load promoted weights from the stored artifact when serving.
- **Test.** A perfectly calibrated synthetic forecast passes the gap check at any n above the minimum; a single-game bucket is ignored. Serving a promoted version uses that version's stored weights.

### D9 · Six odds converters · P2
Entries 027, 031, 041, 017.
- **Where.** `espnOdds.ts:498-505`; `lib/projections/utils/devig.ts:77-88`; `lib/sources/oddsSourceIngestion.ts:270-276`; `components/GamePreview/GamePreview.tsx:74-90`; `pages/stats/game/[gameId].tsx:118-135`; `lib/gameGoalProjections/calculations.ts:113-124`.
- **Agreement.** All use 100/(odds + 100) and |odds|/(|odds| + 100).
- **Differences.** `devig.ts` rejects |price| < 100; the others accept it. The two page components treat an unsigned number as decimal odds. `calculations.ts` throws on a bad string and averages books with the vig left in (dead path at present). Default de-vig is Shin in `devig.ts` and proportional elsewhere; for a −200/+170 line that is 64.8% against 64.3%.
- **Fix.** One shared module for parsing and conversion; pages import it. State the de-vig method wherever a "market probability" is shown.
- **Test.** A table of prices (−110, +100, −100, "150", 1.91, 0, "EVEN") returns the same result from every call site.

### D10 · Misleading no-ops · P2
Entry 016. Delete or implement the heat-map "tie-breaker" and the "blended" odds function; today both names describe behaviour that does not exist.

### Noted outside this packet
`components/GameGrid/utils/calcWinOdds.ts:57-59` multiplies win odds by 0.75 on the second night of a back-to-back (52% becomes 39%). That is a far larger penalty than the few points usually attributed to back-to-backs. It belongs to the fantasy-scoring packet (W1-12).

## 5. Replacement spec (owner decision 1)

A proposal for the fix plan, not a validated model.

1. **Form.** Ridge logistic regression with an intercept. The intercept is the home-ice term. Inputs standardised on the training set.
2. **Features, few and pre-registered.** Season goal differential per game (shrunk toward 0 by games played), a 5v5 shot-quality share from a labelled source (NST while decision 6 holds), rest difference, expected starter quality once W1-5's start labels are fixed. Add market probability only as a separate, clearly named model.
3. **Benchmarks on the same games.** Constant home rate; an Elo rating with a home advantage and margin-of-victory term in the FiveThirtyEight style; the de-vigged closing moneyline.
4. **Validation.** Walk-forward by date over at least two full seasons. Paired per-game log-loss and Brier differences with date-blocked bootstrap intervals. Reliability table with counts. Calibrate on held-out folds only.
5. **Data needed first.** Repaired power ratings (W1-4), immutable pregame feature snapshots for past seasons, and continuous market snapshots (they start 2026-10-25).
6. **Serving.** Weights, scaling and calibrator stored with the version and loaded at prediction time; pick at 0.5; no post-hoc dampening.

## 6. Questions for the owner

1. Is "nothing served" the intended state until a fitted model exists? If yes, should `/nhl-predictions` say so?
2. Game page Poisson chart: relabel as a scoring-rate illustration, or hold it until it can share a repaired model?
3. Overtime rule for Poisson win odds: split ties 50/50, or split by regulation strength?
4. May the 0.52 rule be dropped now, ahead of the replacement model?
5. Is a de-vigged market probability something the site should show as its own number while no model is served?

## 7. Limits

- **No like-for-like market comparison for the placeholder.** It predicted only playoff games before odds ingestion began. A replay on 2026-27 games needs feature payload reads that the database rules exclude.
- **No Elo benchmark.** None exists in the repo; building one was out of scope for a no-code audit.
- **No confidence intervals.** I read aggregates, not per-game rows, so paired intervals were not computed. Treat every difference in §2 as unproven.
- **Game Grid stored odds are not a pregame record** (rows updated after the game).
- **Dampening and contribution sizes** come from 53 issuances covering 13 playoff games.
- **Not traced end to end:** 037 (no caller found), the ESPN "close" odds field semantics (027 lead), `rating_raw` centring for 007, and whether `nhl_standings_details` has all 32 teams every day (the `limit(100)` read at `featureBuilder.ts:2870-2877` assumes it).
- **NHL regulation-tie rate and the usual back-to-back effect** are quoted from memory.
- **No tests were run.** No NST, NHL API or Yahoo calls were made.

### Database reads (2026-11-11, read-only, `pg_stat_activity` showed 0 active queries beforehand)
Catalog sizes and columns; `game_prediction_model_versions` (9 rows, no payload); `game_prediction_history` aggregates joined to `pbp_games` scores; `game_prediction_accountability_games` aggregates by backtest run; latest pre-start row per game from `game_prediction_market_odds_snapshots` joined to `pp_timeframes` scores and `expected_goals`; `cron_job_audit` counts and two truncated detail rows; scalar extracts from the `components` of the 53 most recent v6 history rows.
