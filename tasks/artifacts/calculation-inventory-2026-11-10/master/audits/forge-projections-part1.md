# Audit W1-6: FORGE projections, part 1 (M-FRG-001 to M-FRG-060)

Fable, 2026-11-11, on `octoberBranch` at `e56c5d635`. Read-only: no code, data or configuration was changed.

**How this was done.** I read the core skater and goalie path myself (stages, calculators, queries, reconciliation) and followed one game through every stage against its stored rows. Two read-only helpers covered the evaluation and scoring entries and the market, legacy, offline and derived-table entries; I spot-checked their defect claims against the code before using them. Paths are relative to `web/` unless they start with `supabase/`.

**Evidence rules (Batch A).** Every magnitude below is a dated sample, never a population rate. Three samples recur:

- **Ledger sample:** `forge_served_forecast_ledger`, source `bridge_exact`, served 2026-10-22 to 2026-11-08, settled rows. 2,219 dressed skater-games and 119 settled goalie rows (114 started). Read 2026-11-11.
- **Run sample:** the latest horizon-1 FORGE run for 2026-11-08 (6 games, 12 team rows, 215 skater rows), and for goalie context the latest run per team-game for 2026-11-06 to 11-08 (42 team-games).
- **Trace game:** 2026020278 (team 54 at team 7) in that run: skaters 8478403 and 8478397, goalies 8478499 and 8480045.

The SQL was run ad hoc through the Supabase connector and is not in the repo. Before any fix relies on a number here, re-run it from a saved script with the ids and dates above.

---

## 1. Summary

| Verdict | Count |
|---|---:|
| Sound | 13 |
| Mis-specified | 29 |
| Wrong | 16 |
| Undetermined | 2 |

### Top 5 findings by user impact

1. **Skater lines are served as totals but leave out short-handed and extra-attacker production, so they run low (M-FRG-059, 038, 057).** Ledger sample: shots 1.485 projected against 1.582 actual (−6.1%), goals 0.174 against 0.191 (−9.0%), assists 0.287 against 0.321 (−10.8%), fantasy points 1.978 against 2.093 (−5.5%). The naive last-5 control on its own sample is within 1.5% on all of these. The team shot target is the team's last-10 even-strength shots plus official power-play shots (`lib/projections/stages/skater-stage.ts:2652-2659`). The strength table shows what that drops: its short-handed bucket holds 0.94 shots and 0.229 goals per team-game this season (3.4% of shots, 7.0% of goals), and official PP shots run below the table's PP bucket. Run-sample team shots average 26.2 against 27.7 in the table.
2. **A goalie row is the team's goalie slot, not that goalie (M-FRG-024, 011, 014, 016).** Saves, goals against, win and shutout are a start-probability-weighted mixture stored under the top goalie's id (`lib/projections/stages/goalie-stage.ts:656-685,804-824`). In the trace game goalie 8478499 has a 55.6% start chance and a stored win value of 0.522. His own chance of a credited win is 0.292, or 0.519 if he starts (both are in the row's metadata). The goalies API then rescales the two rows to sum to 1, which turns the value into the team win probability and shows it as that goalie's "Win" (`pages/api/v1/forge/goalies.ts:151-209`; `components/forge-dashboard/GoalieRiskCard.tsx:277,321`). Every scorer compares these rows with goalies who appeared: in the ledger, starters were projected 15.0 saves and made 24.0.
3. **The opponent-goalie adjustment is the largest single lever on skater goals and its input is unsound (M-FRG-044, 034).** It reads GSAA per 60 against a fixed .900, unshrunk, from `goalie_start_projections`. For 2026-11-01 to 11-09 (277 rows) 201 are negative, 112 (40%) are at or beyond the ±0.6 clamp, and the start-weighted mean is −0.29, so the average skater gets a goal boost for facing an average goalie. In the run sample it moved whole teams' goal conversion by −12.8% to +14.0% before damping. It also contradicts FORGE's own goalie model: goalie 8480045 is rated above league average there (.8954 against .8924) while his opponents get the full +14%.
4. **Hits and blocks count penalty-kill time twice (M-FRG-047).** Reconciled TOI already sums to 18,000 skater-seconds, which is all situations (`skater-stage.ts:2459,2527-2533`). The physical line then multiplies by all-situation TOI over ES+PP TOI again (`:2807`; `lib/projections/calculators/skater-adjustments.ts:543-545`). Ledger sample: blocks 0.846 projected against 0.752 actual (+12.5%), hits 1.249 against 1.201 (+4.0%).
5. **The evidence that sets how far a skater is regressed, and several context inputs, are on the wrong scale or one game deep (M-FRG-046, 043, 042, 051, 025).** The sample weight reads seconds per game (stored `evidence_toi_seconds` 387 to 1,364 across 72 skaters), so it sits between 0.32 and 0.75 for everyone (mean 0.64) and a 500-game veteran is regressed as hard as a second-year player. NST team xGA per 60 is computed from TOI in seconds as if it were minutes, so it is 60 times too low and the "pace edge" is pinned at its −0.2 floor for all four teams sampled. PDO is stored as a fraction near 1.0 and any value above 1 is divided by 100. Team 5v5 save percentage, NST team xGA and each skater's shot-quality and on-ice profile are single-game rows read as profiles.

Not in the top five but worth knowing:

- **Spread flags have the wrong sign (M-FRG-041; C11 confirmed).** A home favourite at −1.5 with a model margin of +0.8 is flagged "home cover" with an edge of +2.3; the right edge is −0.7.
- The accuracy job's "30-day" promotion gates use one day of data and pass on empty samples (M-FRG-016).
- The holdout "naive prior" halves power-play assists (M-FRG-018).
- Even-strength events and even-strength ice time are classified by two different rules when a goalie is pulled (M-FRG-057, 058).
- The projections page ranks a player with no fantasy-point value as if he had 0 (M-FRG-010).

### Stage-by-stage trace (run sample, game 2026020278)

**Skater 8478403 (top goal projection on team 54), stored row: ES 1,056 s, PP 137 s, shots 2.096 + 0.677, goals 0.303 + 0.159, assists 0.268 + 0.294, hits 0.419, blocks 0.633.**

| Stage | Stored value | Status |
|---|---|---|
| Sample weight | 0.7315 (evidence 1,168 s per game, 1,128 shots). Recomputed: 0.58 × 1168/2068 + 0.42 × 1128/1173 = 0.7317 | **Mis-scaled** (per-game TOI) |
| Rest (legacy buckets; team rest 3, opponent 2, away) | TOI × 1.0376, shots × 1.0132, goals × 1.0085 | TOI and shots **cancelled** by reconciliation; goal part effective, damped |
| Shot quality (one game, 2026-11-05) | shots × 1.0344, goals × 1.0518 | Shots **redistributed** within team; goals effective, damped |
| On-ice context (same one game) | shots × 1.0477, goals × 1.0506, assists × 1.0669 | Shots redistributed; goals effective; assist part **never used** |
| Team-level context | shots × 0.9982, goals × 0.9968, assists × 1.0008; pace edge −0.2; weight 0.146 | Shots **cancelled**; assist part **unused**; pace input wrong |
| Opponent goalie (GSAA/60 −0.631) | goals × 1.1404, assists × 1.0858 | Goals effective, the largest term; assist part **unused**; **double-counts** opponent goaltending with the team-level 5v5 save term |
| Compound goal multiplier | 1.0518 × 1.0506 × 0.9968 × 1.1404 × 1.0085 = **1.267** | Then pulled toward the position prior by the sample weight |
| Goal rate after second shrink | ES 0.1448, PP 0.2353 | 2.096 × 0.1448 = 0.3035 and 0.677 × 0.2353 = 0.159: **matches the row** |
| Trend band | none selected | Inert here (0 of 72 applied) |
| Role bounds | not applied; tier "MIDDLE" | n/a |
| PP allocation | official target 1,161 s, share 0.118 | Effective |
| Teammate coupling | assists × 0.9927 ES, × 0.9672 PP | **Redistributed** (team assists are rescaled to 1.65 and 1.91 per goal) |
| Team reconciliation | 18 skaters, TOI 18,000 s, team shots 25.4, goals 3.391, assists 5.872 (1.73 per goal) | Team volume pinned |

Skater 8478397 (a defenceman, 15th of 18 by goals): sample weight 0.731, compound goal multiplier 1.12 (shot quality 0.9596 from a single game at 0.017 ixG per shot), role bounds applied with tier "DEPTH" at 994 s of ES time, blocks 1.715.

**Goalies.**

| | 8480045 (team 7) | 8478499 (team 54) |
|---|---|---|
| Start probability | 0.8249 (7 of last 10) | 0.5557 (5 of last 10) |
| Shots against: opponent projected / team L10 / pre-context / final | 25.4 / 30.9 / 27.457 / 25.755 (context −6.2%) | 28.0 / 26.4 / 28.395 / 32.068 (context **+12.9%**) |
| Evidence shots (whole table history) | 899 | 565 |
| League save % used; modelled save % | .8924; .8954 | .8924; .8919 |
| Goals against = SA × (1 − sv) | 2.693 | 3.466 |
| Opposing skaters' projected goals (the λ used for his win) | 3.391 | 3.133 |
| Team win probability (Poisson race) | 0.4691 | 0.5309 (sum 1.000) |
| Stored `proj_win_prob` (slot) | 0.4616 | 0.5224 (sum 0.984) |
| His own credited win, unconditional / if he starts | 0.382 / 0.462 | 0.292 / 0.519 |
| Stored shutout (slot) | 0.0661 | 0.0315 |

All arithmetic reproduces the stored rows. What the trace shows: the goals a goalie is projected to allow and the goals his opponents are projected to score are two unreconciled numbers (2.69 against 3.39 for the same team-game), and the shots-against "context" step is dominated by the opponent's last-5 shot and goal trend.

### Which adjustments survive

| Adjustment | Shots | Goals | Assists | TOI |
|---|---|---|---|---|
| Shot quality (player) | redistributed | effective, damped by sample weight | n/a | n/a |
| On-ice context (player) | redistributed | effective, damped | computed, **unused** | n/a |
| Team-level context (team) | **cancelled** | effective, damped; inputs partly wrong | computed, **unused** | n/a |
| Opponent goalie (team) | n/a | effective, damped | computed, **unused** | n/a |
| Rest and home ice (team) | **cancelled** | effective, damped | computed, **unused** | **cancelled** |
| Trend band (player) | redistributed | effective, not damped | redistributed | n/a |
| Teammate coupling (player) | n/a | n/a | redistributed | n/a |
| Availability, recency, role stability (player) | redistributed | n/a | n/a | redistributed |

"Cancelled" means a team-uniform multiplier is removed exactly when shots are rescaled to the team target and TOI to 18,000 s. Assists follow team goals through the on-ice model, so every goal multiplier reaches assists anyway; the separate assist multipliers are dead on the lineup path (`skater-stage.ts:2285-2305`). Nothing changes team shot volume: not the opponent, pace, rest or venue.

### Answers to the brief's questions

- **Is the sample weight meant to see total TOI?** The constant (900 s) and the shots term (total shots over 45) only make sense for accumulated evidence. It is reading a per-game mean. Confirmed in stored rows.
- **Are rest buckets meant to be `legacy`?** Production passes `legacy` on purpose, with a comment that the newer tiers are "an unqualified offline candidate" (`skater-stage.ts:1944-1945`). In legacy mode the heavy-fatigue tier can never fire and a back-to-back gets the mild one. Owner question 2.
- **How are goalie starts identified with `toi_seconds` null?** They are not. All 2,699 rows are null, so the first row returned for a date wins (`lib/projections/queries/goalie-queries.ts:113-123`). Already confirmed in W1-5.
- **Is win probability per game at every horizon?** No: it is multiplied by the horizon scalar sum (`goalie-stage.ts:820-823`). Stored horizons are 1 for 3,921 of 3,925 goalie rows (four rows at horizon 5 on 2026-10-21), so this is latent.
- **Are percent inputs on the scale the code assumes?** IPP: yes (0 to 100, per W1-3). PDO: no. Stored `shooting_plus_save_pct_5v5` is a fraction (0.88 to 1.05 in four rows for one team) and the skater path divides anything above 1 by 100. NST team TOI: no (seconds, read as minutes).
- **Do means reconcile?** Player TOI and shots sum to team targets. Assists per goal land on the league constants. Player goals sum to the team goal figure by construction. Goalie goals against do not reconcile with the opposing skaters' goals.

---

## 2. Per-entry table

Reference standards named here: Marcel (Tango: weighted recent seasons, regression by sample size, age); regression to the mean by sample size; beta-binomial shrinkage; Poisson and Skellam; negative binomial; Brier score; Mincer–Zarnowitz regression; paired cluster bootstrap; Shin's method for de-vigging; NHL API `situationCode`; Hockey-Reference GSAA; owner decisions 7, 10 and 13.

| ID | Verdict | Evidence | Reference | Magnitude | Downstream |
|---|---|---|---|---|---|
| 001 Opponent allowed by position (matview) | See section 2a | | | | |
| 002 League physical totals (SQL fn) | See section 2a | | | | |
| 003 Scoreboard view | Mis-specified | `supabase/migrations/20261021230025_forge_served_forecast_ledger.sql:78-103`: win and shutout scored by mean absolute error of a probability; averages include `dressed = false` rows, unlike the TypeScript scorer | Brier score | None today: no code reads the view | None found |
| 004 Legacy game goal projections | See section 2a | | | | |
| 005 Legacy and test-only helpers | Sound (inert) | No non-test caller for `allocateTeamAssists`, `applySupportedSkaterConversionHeads`, `clampSkaterAssistRate`, `buildSkaterNaivePriorBaseline`; `resolveSkaterConversionRates` and `computeSupportedStrengthSplitConversionRates` only from `scripts/forge-counterfactual-backtest.ts`; `computeWorkloadSavePctPenalty` imported but unused (`skater-stage.ts:280`; `run-forge-projections.ts:273`) | n/a | Dead constants are 10× the fitted live ones (0.025/0.04/0.03 save % against −0.002/−0.003) | A future caller would import the wrong scale |
| 006 Completed game length | See section 2a | | | | |
| 007 Reserve lines | Mis-specified | `lib/projections/reserveProjections.ts:52-101`: same per-game sample weight (`:63-66`); raw last-5 TOI with no role bounds or reconciliation (by design, stated). Reserve hits and blocks do **not** double-count PK time, unlike lineup rows. Reserve shutout not horizon-scaled while lineup shutout is (`:153`) | Internal consistency | Not live: `forge_reserve_projections` does not exist in production (catalog read) and the flag defaults off | RSO bridge when enabled |
| 008 Season-opening bootstrap | Mis-specified | `lib/projections/seasonBootstrap.ts:39-90`: history = equal-weight mean of the last 20 previous-season appearances; weight (1 − games/20) × 0.4, renormalised, so 100% history at 0 games. No age term, one prior season, and the "organic" line already contains prior seasons through the career `_all` windows | Marcel | Not active in the run sample (`season_bootstrap` null on the traced row). Policy self-labelled "unvalidated" | Skater and goalie stages at season start |
| 009 Horizon scalars | Mis-specified (latent) | `lib/projections/utils/date-utils.ts:41-67`: the zero-rest penalty can never fire (dates are de-duplicated, so rest ≥ 1); the first game never gets a back-to-back penalty; 1.5% per game decay is a mean shift with no stated basis; goalie scalar averages the team's with today's opponent's future schedule (`goalie-stage.ts:719-726`); `fetchTeamHorizonScalars` has no game-type filter (`skater-stage.ts:1280-1286`) | Internal consistency | None at horizon 1, which is every stored run but four rows | Any multi-game request |
| 010 Projections table proration and ranks | See section 2a | | | | |
| 011 Goalies API win normalisation | Mis-specified | `pages/api/v1/forge/goalies.ts:151-209`. Inputs are one slot row per team, which sum to 0.984, not P(start) × P(win) per goalie. The rescale therefore removes the decision share (+1.6% relative) and outputs the team win probability under a goalie's name. The triage description (C12: "inflates when starters are uncertain") is not what happens | Internal consistency; the stage's own two-population note (`goalie-stage.ts:771-802`) | Trace: goalie with a 55.6% start chance is shown Win 53.1%; his own unconditional value is 29.2% | GoalieRiskCard; dashboard fetchers |
| 012 Counterfactual PP re-allocation | See section 2a | | | | |
| 013 Counterfactual conversion and blend inversion | See section 2a | | | | |
| 014 Served ledger scoring | **Wrong** (goalie heads); formulas sound | `lib/player-forecasts/servedForecastLedger.ts:332-357,460-467` are correct (bias = forecast − actual; Mincer–Zarnowitz; Brier; paired RMSE skill). Goalie heads are scored dressed-only against start-weighted expectations (`:414-420`), and only goalies who appeared are ever settled | Brier; Mincer–Zarnowitz; conditional against unconditional estimand | Ledger sample: 119 of 316 goalie rows settled, all "dressed"; mean start probability 0.614 against a 95.8% start rate; starters' saves 15.03 projected against 23.96 actual; fantasy points 2.49 against 4.14. Dividing by the start probability gives about 24.5 saves and 27.4 shots against (actual 24.0 and 26.8), so the conditional lines are close | `/api/v1/forge/scoreboard` |
| 015 Fantasy points scoring | Sound | Weights agree in every copy (`lib/projectionsConfig/fantasyPointsConfig.ts:8-30`; `lib/forge-v2/identity.ts:28`; `scripts/forge-skater-candidate-ablation.ts:121`). PPP stacks on goals and assists (`lib/projections/accuracy/fantasyPoints.ts:33-35`), which is standard league scoring but uncommented | League scoring settings | n/a | Accuracy, start chart, ledger |
| 016 Projection accuracy | **Wrong** | `pages/api/v1/db/run-projection-accuracy.ts`. Beyond the W1-5 defects (outcome `actualRow ? 1 : 0` at `:2078-2082`; run chosen by date at `:1717-1718`): gates named `_30d` read accumulators built inside one date's run (`:2052-2054`, gate text `:1009-1073`); an empty sample returns Brier 0 and passes (`:1213`); `computeAccuracyScore` is 1 − \|p − a\| / max(1, \|a\|, \|p\|), not a proper score, and is served as "accuracy %" (`lib/projections/accuracy/fantasyPoints.ts:54-62`; `pages/api/v1/forge/accuracy.ts:43-55`); goalie heads scored on appeared goalies against slot values (`:2084`) | Brier with a base-rate reference; proper scoring rules | Synthetic (helper): on a skater FP distribution with mean 2.74 the best constant forecast under the accuracy score is 3.05, not the mean. A shutout forecast of 0 passes the 0.08 Brier gate | Accuracy tables, `/api/v1/forge/accuracy`, promotion gates |
| 017 Promotion gates | Mis-specified | `lib/projections/promotionGates.ts:154-204`: paired and arithmetically right, but MAE-only, no interval or test, minimum n of 30 on a single day. `evaluateProjectionPromotionGates` and `evaluateShadowModeImprovement` have no non-test caller | Paired cluster bootstrap; RMSE or a count log score | Synthetic (helper), n = 300: an unbiased candidate (MAE 1.296) loses to a low-biased baseline (1.194) on MAE while winning on RMSE (1.4135 against 1.4636) | Holdout report in the accuracy run |
| 018 Skater holdout baselines | **Wrong** | `skater-stage.ts:2823-2826,2898-2901`: naive PP assists use 0.95 per PP goal, which is the per-two-goals constant (`skater-adjustments.ts:560`); per goal it is 1.9 and the model's league constant is 1.91. ES uses 1.44 against the model's 1.65. Flat goal rates 0.095/0.145 against position priors (F 0.1181, D 0.0537). The baseline reuses the model's shots, hits and blocks, so it tests conversion only | Internal consistency | Naive PP assists are half what they should be; naive defence ES goals about 77% high. Stored with every skater row | Holdout comparison (M-FRG-017) |
| 019 Backtest metrics | Mis-specified (offline) | `scripts/forge-counterfactual-backtest.ts:276-320` sound (bias sign, paired cluster bootstrap by game). Unknown actual goals, assists and PPP are coerced to 0 (`:267`); the top-decile table bins on one variant's own forecast (`:349`); latest run per date with no pre-puck-drop check (`:156-167`) | Paired cluster bootstrap; "unknowns stay unknown" | Not measured | Methodology decisions (Q7, Q8) |
| 020 Goalie backtest scoring | Sound | `scripts/forge-goalie-backtest.ts:157-231`: Brier, log loss, paired sums, bootstrap by game. Keeps the team, starts and candidate populations apart (`:300-369`). The variant sweep tunes prior shots and spread shrink on the fixture it scores (`:426-438`), so those results are in-sample | Brier; log loss | n/a | Goalie model review |
| 021 Skater candidate ablation | Sound | `scripts/forge-skater-candidate-ablation.ts:53-106` | Mincer–Zarnowitz | n/a | Model selection |
| 022 FORGE v2 refresh cadence | See section 2a | | | | |
| 023 Goalie starter probability | **Wrong** (confirmed in W1-5; not re-litigated) | `lib/projections/calculators/goalie-starter.ts:126-243`; starter by max of an always-null column (`goalie-queries.ts:113-123`; `lib/projections/derived/buildGoalieGameV2.ts:138`); three-candidate vector not renormalised (`goalie-starter.ts:236-241`) | Reliability table; Brier | W1-5: top pick stated 0.83, started 60% (300 team-games). This audit re-confirmed only the inputs: 2,699 of 2,699 `toi_seconds` null; all 277 November `start_probability` values equal `l10_start_pct` | Every goalie row; skater opponent-goalie weights; RSO |
| 024 Starter-scenario blend and horizon scaling | Mis-specified | `goalie-starter.ts:27-74`; `goalie-stage.ts:656-685,804-824`. Slot mixture under one goalie id; probabilities multiplied by the horizon scalar | Internal consistency | Trace: stored win 0.522 against the goalie's own 0.292. Slot values sum to 0.984 across the two teams. Horizon part latent | Goalies API, ledger, accuracy, RSO bridge, market saves comparison |
| 025 Team context for goalies | **Wrong** | `lib/projections/queries/team-context-queries.ts:422-427,435-455`: xGA per 60 = xGA × 60 / TOI with TOI in seconds (stored rows: `gp=1 toi=3600 xga=4.46`), so about 0.07 instead of about 4; rows are single games; `lte(date)` admits a same-day row. `fetchTeamFiveOnFiveProfile` (`:384-413`) reads one game's 5v5 save % with `games_played = 1`. `nhl_team_data` holds only today's date, so any run for an earlier date falls through to "latest" (`:367-381`), a look-ahead on backfills | Unit consistency | Stored: NST adjustment −0.0065 on both goalies (constant); 5v5 adjustment ±0.0005. Small because the weights are small | Goalie shots against and save % shift; skater team-level context |
| 026 Goalie game table | Mis-specified | `buildGoalieGameV2.ts:63-145`: counts are sound (shots on goal + goals against the goalie in net, empty-net and shootout excluded; 27.55 shots and 3.088 goals per team-game over 476 team-games this season). `toi_seconds` is written null and there is no starter flag | NHL shots-against convention; decision 7 | 33 team-games with two goalie rows in the table; readers cannot tell starter from reliever | Starter context, workload, evidence, league save % |
| 027 Shutout probability | Sound per game | `lib/projections/goalie/goalieOutcomes.ts:176-198`: negative-binomial shots, binomial goals, × 0.927 credit share. Trace value 0.0661 at 25.8 shots and .8954 is consistent with it. The stored value is a slot mixture and is horizon-scaled (M-FRG-024) | Negative binomial; binomial | n/a | Fantasy points, accuracy |
| 028 Modelled save % | Mis-specified | `lib/projections/goalieModel.ts:127-143`; `goalieOutcomes.ts:56-66`: one beta-binomial with a 6,000-shot prior, which the header says was tuned with three prior seasons as evidence. The evidence table starts 2025-10-01, so no goalie has more than about 1,900 shots | Beta-binomial shrinkage | Run sample (42 team-games): modelled save % .8860 to .8969, SD .0025. A .915 goalie over 899 shots is projected .8954. Context shifts are a few ten-thousandths | Goals against, win, shutout, quality tier |
| 029 Team win probability and win populations | Mis-specified (algebra sound) | `goalieOutcomes.ts:92-128`: two teams sum to 1 (trace 0.4691 + 0.5309); `goalieWinPopulations` (`:235-261`) sums to the team value (0.3823 + 0.0868 = 0.4691). No home-ice term: venue enters only through a +0.96% / −0.32% goal multiplier that is then damped (`skater-adjustments.ts:388,401`). λ is the ES+PP skater sum, which omits PK and empty-net goals on both sides. The 0.75 spread shrink is unvalidated by its own comment (`:48-51`) | Poisson race; Skellam | Home edge: about +0.2 points of win probability by calculation, against a historical NHL home win rate a few points above 50% (general knowledge; measure from `games` before relying on it). Run sample: team win 0.321 to 0.680, all 42 from the Poisson race, none from the moneyline | Goalie win, goalies API, game totals |
| 030 League save % | Sound | `lib/projections/goalie/leagueSavePct.ts:28-80`: current season blended with last by 20,000 prior shots. Used value .8924. No game-type filter | Beta-binomial prior mean | n/a | Modelled save % |
| 031 Goalie profile tiers | Mis-specified | `goalieModel.ts:88-125,146-254`. "ELITE" needs modelled save % ≥ league + 0.012; the largest gap in the run sample is +0.0045, so ELITE cannot occur and almost every goalie is "AVERAGE". Quality-start input is a single-game row (stored `quality_starts: 1, quality_starts_pct: 1` for both traced goalies). Residual SD uses a fixed .900 | Internal consistency | Tier output is close to constant | Goalie UI, START/SIT recommendation |
| 032 Goalie workload | Mis-specified (label) | `goalie-queries.ts:174-212`: "starts" are appearance dates, relief included | n/a | Small; drives the −0.002 / −0.003 save % terms | Save % adjustment |
| 033 Goalie evidence | Mis-specified | `goalie-queries.ts:251-356`: fixed .900 in residuals (`:320`); "baseline = last 200 appearances" is bounded by a table that starts 2025-10-01; no recency weighting; `wgo_goalie_stats` read with `lte` | Marcel (recency weights) | See 028 | Modelled save %, tiers |
| 034 Goalie start projections route | **Wrong** (confirmed in W1-5; reader impact sized here) | `pages/api/v1/db/update-goalie-projections-v2.ts:365-367,427-433` | Hockey-Reference GSAA with the season league save % (decision 10) | Reader side: see 044 | Starter prior; opponent-goalie adjustment |
| 035 Goalie line backtest | Sound | `scripts/forge-goalie-backtest.ts:103-143,300-438` | n/a | In-sample sweep noted under 020 | Model review |
| 036 Fantasy-projections evaluator and settlement | See section 2a | | | | |
| 037 Ledger build and settlement | Mis-specified | `servedForecastLedger.ts:193-200` (`impliedMeanFromMarket`) is sound: monotone bisection on P(over \| no push). The settle route passes no completeness scope (`pages/api/v1/db/forge-served-forecast-settle.ts:48-49`), so a player with no actual row is never settled; that keeps unknowns unknown but makes every settled goalie population "appeared". Naive goalie control coerces a missing team win to 0.5 (`:150`) and "last 5" uses 10 starts (`:159`) | "Unknowns stay unknown" | 197 of 316 goalie rows unsettled in the ledger sample | Scoreboard |
| 038 Native goal accounting | Mis-specified (arithmetic sound) | `lib/projections/nativeGoalAccounting.ts:223-262`: ES+PP sum of serialized player means; PK, overtime, empty-net and shootout left null with reasons. Sound and honest as accounting. The ES+PP figure is then used as the full-game λ (`goalie-stage.ts:376-382`) and, at horizon > 1, a multi-game sum would be used as a one-game mean | Decision 7 (empty-net reported separately) | 7.0% of goals this season are in the strength table's PK bucket | Win probability, starter heuristics, totals and spread flags |
| 039 Native coverage and reconciliation kernels | See section 2a | | | | |
| 040 Sportsbook de-vig | See section 2a | | | | |
| 041 Model against market props | See section 2a | | | | |
| 042 On-ice context | Mis-specified | `skater-adjustments.ts:150-229`; `lib/projections/queries/skater-queries.ts:547-600`: the "profile" is the single latest `player_stats_unified` row, one game. "Sample weight" is a rate, (xGF60 + xGA60) / (that + 2.5), not a sample size. Assist multiplier never used | Regression to the mean by sample size | Run sample: goal multiplier 0.939 to 1.072 per player from one game. All 18 skaters of team 7 got exactly 1.000 (latest row had no NST fields), so the adjustment also switches off for a whole team when NST lags | Shots (redistributed), goals |
| 043 Team-level skater context | **Wrong** | `skater-adjustments.ts:74-80,259-280`. PDO: fractions above 1 are divided by 100, so the PDO edge is −0.08 for every team above 1.000 and slightly negative below. Pace: NST xGA per 60 is 60× low (see 025), so the pace edge is −0.2 always. Opponent 5v5 save % is one game. "Pace" uses xGA of both teams, not xGF. Team xGA and opponent 5v5 save % overlap with the opponent-goalie term | Unit consistency | Stored: pace edge −0.20 on all four teams; weight about 0.15; goal multiplier 0.9916 to 1.0148. Small because the weight is small; the shot and assist parts are cancelled or unused | Goals; reserve lines; bootstrap context |
| 044 Opponent goalie adjustment | **Wrong** (input) | `skater-adjustments.ts:308-352`; `goalie-queries.ts:360-411`. GSAA/60 from a fixed .900, unshrunk; weighted first, clamped after, so one small-sample backup can saturate the team value | Hockey-Reference GSAA with the season league save %; shrinkage by shots | November sample: start-weighted mean −0.293, 40% of rows at the clamp, range −6.60 to +1.82. Run sample team multipliers: 1.0788, 1.0427, 0.8725, 1.1404 | Skater goals and, through team goals, assists; win probability λ |
| 045 Rest and schedule | Mis-specified | `skater-adjustments.ts:354-421`; `skater-stage.ts:1943-1950`. Legacy mode on purpose; heavy tier unreachable; a normal one-day break is scored as a "small boost". TOI and shot outputs are cancelled by reconciliation. Rest days are measured from the run date, with no game-type filter (`team-context-queries.ts:559-576`) | Owner intent (question 2) | Back-to-back goal multiplier −0.9% in legacy against −2.75% in the newer tiers, before damping. Run sample team values 0.9647 to 1.0459 | Goals |
| 046 Small-sample shrinkage weight | **Wrong** | `skater-stage.ts:2149-2154`; `skater-adjustments.ts:423-455` | Regression to the mean by sample size | Run sample (72 skaters): weight 0.32 to 0.75, mean 0.64; evidence TOI 387 to 1,364 s. With accumulated TOI a veteran would be near 0.98. For the traced skater that is roughly +6% on his goal rate; for a veteran well below his position prior, roughly −10%. These are calculations, not a re-run | TOI blend, goal rate, reserve lines |
| 047 Hits and blocks | **Wrong** (TOI double count); rates sound | `skater-adjustments.ts:467-547` (rates, shrinkage, league rescale: sound); `:543-545` and `skater-stage.ts:2807-2809` (double count) | Internal consistency | Ledger sample: blocks +12.5%, hits +4.0% | Fantasy points, blocked-shot props |
| 048 Assist share and allocation | Mis-specified | `skater-adjustments.ts:586-605`; `skater-stage.ts:2753-2775`. Algebra sound; team assists per goal 1.72 to 1.73 in the run sample, between the 1.65 and 1.91 constants. On-ice goals are split by TOI share alone, so a first line is credited the same goals per minute as a fourth | Reconciliation; regression by sample size | Ledger sample by projected-goal quintile: assists top fifth 0.475 projected against 0.567 actual (−16%); bottom fifth 0.181 against 0.158 (+15%) | Points, PPP, fantasy points |
| 049 Shot rate per 60 | Sound (formula) | `skater-adjustments.ts:634-651`: one shrink by hours toward a position prior, last five blended by their own hours. `_all` is career with equal weight and no age term | Marcel; regression by exposure | Trace: 9.73 ES and 14.8 PP per 60, plausible | Shots before reconciliation |
| 050 Goal conversion | Mis-specified | `skater-adjustments.ts:653-772`; `skater-stage.ts:2292-2298`. Shrunk twice: by the fitted prior strength (k = 423 ES shots for forwards), then again by the sample weight toward the same prior. The code comment says the second shrink stays because it damps the compounded context multipliers | Regression to the mean (one shrink at the fitted strength) | Compound context multiplier 0.79 to 1.28 across 72 skaters (team means 0.869 to 1.144) | Goals, assists, win λ |
| 051 Shot-quality adjustment | Mis-specified | `skater-adjustments.ts:82-148`: one game's ixG per shot; weight = shots per 60 / (that + 5), a rate; 0.09 baseline not position-specific | Regression by sample size | Run sample: goal multiplier 0.901 to 1.079 per player | Shots (redistributed), goals |
| 052 Research goal kernels | See section 2a | | | | |
| 053 Teammate assist coupling | Undetermined | `skater-stage.ts:1108-1166`: hand-set; "linemates" are players sharing a role label. Purely redistributive after the assist rescale | None stated | Trace: 0.90 to 0.99 | Assist split within a team |
| 054 Role scenarios | Mis-specified (latent) | `lib/projections/calculators/scenario-blending.ts:45-68,134-`; stored rollout is `baseline`, so scenarios do not change the line. Reversion goes toward a uniform scenario mix, not toward the current role | n/a | None in production | Candidate mode only |
| 055 Recency multiplier and active pool | Sound | `skater-stage.ts:884-900`; `lib/projections/utils/season-recency.ts:13`. A soft-stale skater keeps as little as 15% TOI and reconciliation hands the rest to teammates, which is reasonable for a player unlikely to dress | n/a | Pool was 18 skaters on 11 of 12 teams, 17 on one | Skater stage |
| 056 Sustainability trend band | Undetermined | `lib/projections/utils/trend-adjustments.ts:57-135`: a value above its band raises shot, goal and assist rates (momentum). The same mapping is used whichever metric was picked, with `fantasy_score` first. `lte(snapshot_date)` admits same-day rows | Regression to the mean (a value outside a sustainability band is expected to return to it) | Applied to 0 of 72 skaters sampled (12 had a row selected, all within band or stale). Up to ±14% on goals when it fires | Shots, goals, assists, uncertainty width |
| 057 Game strength tables | See section 2a | | | | |
| 058 Strength-state classification | See section 2a | | | | |
| 059 Team-to-player reconciliation | Mis-specified (arithmetic sound) | `lib/projections/reconcile.ts:97-184`; targets at `skater-stage.ts:2459-2533,2652-2659`. TOI target 18,000 s split into official PP share and "ES", so PK time is labelled ES. Shot target = last-10 strength-table ES shots + official PP shots, with no game-type filter on the strength averages (`team-context-queries.ts:40-56`) | Reconciliation; decision 7 | Strength table this season (476 team-games): shots ES 21.55, PP 5.24, PK 0.94; goals ES 2.132, PP 0.901, PK 0.229. Run sample team shots average 26.2 against 27.7 in the table. Ledger: finding 1 | Every skater count; goalie shots against |
| 060 Role usage bounds | Mis-specified | `skater-stage.ts:1168-1232`; `lib/projections/constants/projection-weights.ts:135-152`. Tier comes from the line-combination label: the top goal projection on team 54 is "MIDDLE" and a 16.5-minute defenceman is "DEPTH" | n/a | Bounds applied to 16 of 72 skaters sampled | TOI and shot rate before reconciliation |

### 2a. Entries covered by the helper pass (market, legacy, offline, derived tables)

Verdicts and evidence are the helper's; I re-read the cited lines for 010, 040, 041, 057/058 and 001. "Executed" means the helper ran the real function on synthetic input.

| ID | Verdict | Evidence | Reference | Magnitude | Downstream |
|---|---|---|---|---|---|
| 001 Opponent allowed by position | Mis-specified (in the reader) | The matview and the share maths are sound: per distinct game, shrunk by games/(games + 30), clamped ±15% (`lib/rosterScheduleData/forgeDailyBridge.ts:78,127-147`). A re-aimed line is multiplied by tilt_to / tilt_from (`:349-354`), but FORGE has no positional opponent term, so the line never contained tilt_from | Internal consistency | Executed: a defence line moved from an opponent at 1.15 to one at 0.8545 gets × 0.743 where × 0.8545 is right. Worst case +17.6% | RSO planning, ledger `bridge_reaimed` rows. **Hand to the RSO audit** |
| 002 League physical totals | Sound | Seconds throughout (`supabase/migrations/20261020211500_forge_league_skater_physical_totals.sql:32-45`; `lib/projections/calculators/skater-adjustments.ts:494-500`); to-date strictly before cutoff; scale clamped 0.7 to 1.3; missing RPC falls back to scale 1 with a warning | n/a | n/a | Hits and blocks |
| 004 Legacy game goal projections | Mis-specified (still read) | `lib/gameGoalProjections/calculations.ts:32-38,99-100,192-212`. No home term; ties split 50/50; book odds averaged as raw implied percentages with no de-vig. Read by `components/GameGrid/PDHC/PoissonHeatMap.tsx:130,149-156` | Poisson; proportional de-vig | Executed: −110/−110 stores 52.4/52.4 (sum 104.8). Grid truncation at 10 goals keeps 99.9% of the mass at normal scoring | Game Grid heat map. W1-4 already advises fixing or withholding these odds |
| 006 Completed game length | Sound | `lib/projections/gameLength.ts:44-64`. Executed: 3,767 s for overtime ending with 2:13 left; 5,280 s for a playoff second overtime. Impossible states are accepted (a regular-season "period 5 OT" returns 4,020) | NHL overtime rules | n/a | `pages/api/v1/db/shift-charts.ts:83` |
| 010 Proration and global ranks | **Wrong** (ranks); proration sound this season | `utils/projectionsRanking.ts:14-25`: a null value is ranked as 0, and ties get distinct ranks. `lib/draftDashboard/playerValues.ts:36` coerces the same way. The 84-game constant (`lib/projectionsConfig/proration.ts:13`) matches the repo's own 2026-27 schedule check (32 × 84 = 1,344 games, `lib/fantasy-projections/validation.ts:60-70`) but is not season-aware, and weighted stats outside the proratable list (for example GWG) are left unpaced | "Unknowns stay unknown" | Executed: `[120, null, −4]` ranks the null second, above the −4 player | `pages/projections/index.tsx:960`; draft dashboard |
| 012 Counterfactual PP re-allocation | **Wrong** (offline) | `scripts/forge-counterfactual-backtest.ts:459-461,481-485`: history is keyed to the player's latest team, so a traded player's old games become one-player team-games in the last-10 window. `allocatePpToi` can exceed its target (`:428`) | Internal consistency | Executed: team target 690 s against a true 1,200 s; 1,400 s allocated against 1,200 | PP-usage methodology decisions |
| 013 Counterfactual conversion and blend inversion | Mis-specified (offline; algebra exact) | Inversion reproduces the live blend to 1e-16 (`:121-134`). Drift from live: a null prior key is dropped from the weight in live code (`lib/projections/seasonBootstrap.ts:75-77`) but not in the script; the hand-copied assist clamps describe a table the live path no longer uses (live clamps assist shares to 0.02 to 0.9, `skater-stage.ts:2363-2364`); the script omits `position`, though mismatched rows are dropped by a guard (`:194-197`) | n/a | Executed: 0.278 against a true 0.300 for the null-key case | Q7 and Q8 decisions. Whether the Q8 rest change survives team reconciliation needs a full-stage replay |
| 022 FORGE v2 refresh cadence | Mis-specified (off) | `lib/forge-v2/refresh.ts:126-148,316-334`. DST handling is right (executed: 12:00Z on 2026-03-08, 13:00Z on 2026-11-01). Pregame `readyAt` and `deadlineAt` are the same instant, and lateness is "confirmed after deadline", so every pregame publication is marked late | n/a | Not live (`pages/api/v2/forge/[operation].ts:5`) | v2 operations summary |
| 036 Season evaluator and settlement | Mis-specified | Sign convention is consistent (`modeling/player_forecasts/season.py:2606-2607`; `lib/fantasy-projections/evaluator.ts:321,349-350`). Pace multiplier sqrt(team × opponent) re-applies the player's own team pace to a rate earned on that team (`evaluator.ts:298-301`). The "variance mixture" at `:237-244` reduces to the source variance. Normal quantiles on counts; season variance is a plain sum over games. Skill index is formed per observation, then averaged (`lib/fantasy-projections/settlement.ts:13-41`) | Poisson and negative binomial for counts | Executed: a team at the 1.25 pace clamp gets × 1.118 against an average opponent; a four-row mean index of 56.25 against 74.18 pooled | Season forecast routes. **Hand to the player-forecasts audit** |
| 039 Native coverage and reconciliation kernels | Sound where read (offline) | No live importer. `lib/projections/nativeDirectConditionalCounts.ts:105-128` and `nativeSkaterParticipationResearch.ts:74-80` read in full and sound. `nativePlayerCoverageKernel.ts`, `nativeIntervalReconciliation.ts` and `nativeGoalLedgerAudit.ts` skimmed; `nativePlayerCoverage.ts` not opened | n/a | n/a | Offline qualification scripts |
| 040 Sportsbook de-vig | **Wrong** (yes-only); two-way sound | `lib/projections/utils/devig.ts:76-79,106-190,244-251` match Shin's two-outcome closed form, proportional and additive methods, and EV = p·d − 1. Yes-only subtracts half an assumed overround and switches to proportional when that goes to zero or below (`:233-238`), which is not monotone in price | Shin's method | Executed: −200/+170 gives 0.6481 (Shin) against 0.6429 (proportional). Yes-only: +2300 → 0.0017, +2400 → 0.0370, so a longer price gets a 21× larger probability | Anytime-scorer and other one-sided props; ledger market rows |
| 041 Model against market | **Wrong** (spread sign, averaged lines) | Spread: `lib/projections/run-forge-projections.ts:1055-1057,1108` computes margin − home line; the stored line is the signed handicap (`lib/sources/oddsSourceIngestion.ts:477-480`). Props: the stages pass an averaged line per market (`lib/projections/queries/market-queries.ts:136`), which defeats the per-book median the comparison documents (`lib/projections/utils/market-output-builders.ts:373-383`). Tail maths, push handling and EV are right (`:204-229,361-369`). Goalie saves compares a slot mixture with a one-goalie line | Poisson; negative binomial | Executed: home 3.4, away 2.6, line −1.5 → code edge +2.30 "home cover"; correct −0.70. Books at 2.5 and 3.5 become one synthetic book at 3.0 (edge −0.025 against +0.011) | Market flag rows and pages |
| 052 Research goal kernels | Sound (offline) | `lib/projections/research/skater-candidates/accounting.ts:13-91`; `priors.ts:67-94`; `context.ts:42-49` (law of total variance); `lib/projections/researchGameGoals.ts:164-174`. `researchGoalBaseline.ts` not read | Regression by exposure | n/a | Offline scripts |
| 057 Game strength tables | **Wrong** (with 058) | `lib/projections/derived/buildStrengthTablesV2.ts:99-101,270-306,395-406`: shots are shots on goal plus goals, shootout excluded; empty-net goals are included; team TOI is the sum of player rows (player-seconds) | NHL `situationCode`; decision 7 | Stored this season: see M-FRG-059 | FORGE reads team TOI only as ratios. `lib/splits/splitsServer.ts:676-682,780` divides a player's PP seconds by team PP player-seconds, so a full-time PP skater shows about 20% |
| 058 Strength-state classification | **Wrong** | Two classifiers. Events use goalie-adjusted skater counts (`lib/projections/derived/situation.ts:44-56`), so 6v5 is even strength. Ice time uses raw skater counts (`lib/projections/ingest/shifts.ts:112-124`), so 6v5 is PP for one side and PK for the other. Situation segments also hold the last event's code until the next event, so a power play runs past its expiry (`shifts.ts:262-290`) | NHL `situationCode`; W1-2 note that PP seconds = penalty time is not a universal oracle | Executed: a 2:00 shift with 1:30 at `1560` gives ES 0:30 and PP 1:30 while the events in it count as ES. Ninety seconds of 6v5 adds 540 player-seconds of "PP". Expiry lag not quantified | Player and team strength TOI; ES and PP per-60 rates; PP share fallback |

---

## 3. Defects

Priorities: **P0** user-visible wrong numbers; **P1** wrong or misleading but smaller, conditional or evaluation-only; **P2** latent, offline or cosmetic. Each fix must list its readers and add a selection test for each (Batch A rule 4).

### P0

**D1. Skater totals omit short-handed and extra-attacker production (M-FRG-059, 038, 057).**
- Effect on fantasy points: −0.115 per skater-game (−5.5%) in the ledger sample; −0.29 (−8.1%) for the top fifth by projected goals.
- Fix: decide what a skater line is. Either (a) project all-situation shots, goals and assists (add PK and empty-net components, with empty-net goals reported separately per decision 7), or (b) keep ES+PP and label every served total as such, adding the remainder where a total is shown. The team shot target should be all-situation shots for, with extra-attacker time handled explicitly.
- Tests: on a fixture season, the sum of projected skater shots per team-game equals the team's mean all-situation shots for within 1%; ledger bias on goals, assists and shots each within ±2% over a frozen window; an empty-net goal fixture lands in its own named bucket.

**D2. Goalie rows are slot mixtures served as one goalie's line (M-FRG-024, 011).**
- Effect on fantasy points: at 4 points per win, the traced goalie is shown 2.09 from wins against 1.17 for his own unconditional expectation; saves 28.6 against 15.9.
- Fix: store per-candidate rows, each with its conditional-on-start line and its start probability, plus the unconditional product as separate named fields. The API serves the goalie's own values and, separately, the team win probability. Remove the rescale in `goalies.ts`.
- Tests: for each team-game the candidates' unconditional wins sum to the team win probability; a 0.55/0.45 fixture returns two different win values under two ids; no field multiplies a probability by a horizon scalar.
- Readers to fix together: goalies API, GoalieRiskCard, RSO bridge, ledger builder, accuracy job, market saves comparison.

**D3. Opponent-goalie adjustment (M-FRG-044, reader of 034).**
- Effect on fantasy points: the traced skater's goal rate carries +14% from this term (about +10% after damping), roughly +0.2 of his 3.76 projected points. Team 13 in the same run carries −12.8%.
- Fix: per decision 10, GSAA against the season league save %; shrink each goalie by shots before weighting; clamp each goalie, then weight. Better, read the opponent's modelled save % from FORGE's own goalie stage so the two models agree. Size the coefficient on held-out data before re-enabling.
- Tests: a league-average goalie returns exactly 1.0; a two-game backup at −6 GSAA/60 with a 20% start chance cannot move the team multiplier by more than a stated bound; the multiplier's start-weighted league mean is 1 within tolerance.

**D4. Hits and blocks double-count PK time (M-FRG-047).**
- Effect on fantasy points: +0.024 per skater-game from blocks and +0.010 from hits on average; larger for penalty-killing defencemen (the cap is 1.3).
- Fix: drop `physicalToiMultiplier` on the lineup path, where reconciled TOI is already all-situation, and keep it on the reserve path, where TOI is raw ES+PP. Or reconcile to an ES+PP target and keep the multiplier. Not both.
- Tests: the sum of each team's physical minutes equals 300 skater-minutes; ledger bias on hits and blocks within ±3% on a frozen window.

**D4b. Spread edge has the wrong sign (M-FRG-041; C11).**
- Effect: every spread flag is off by twice the line, so home favourites are flagged to cover and home underdogs to fail. Not a fantasy-points number; it is a user-visible market flag.
- Fix: edge = model margin + home line.
- Tests: (home 3.4, away 2.6, line −1.5) → −0.70, away cover; (2.6, 3.4, +1.5) → +0.70, home cover.

### P1

**D5. Sample weight reads per-game TOI (M-FRG-046; C8).** Fix the unit and re-fit the scale, thresholds and the second conversion shrink together, as W1-3 already directs. Test: monotone in games played with rates held fixed; the weight for 3 games differs from the weight for 300. Do not use W1-3's withdrawn call-up test.

**D6. NST per-60 unit and single-game team inputs (M-FRG-025, 043).** Convert TOI seconds to minutes in `calcPer60`; aggregate `nst_team_all` and `wgo_team_stats` over a stated window (pooled, with real games played) and use `lt(date)`; give `nhl_team_data` an as-of read or refuse to run for a past date. Fix the PDO scale in one shared helper (the two `normalizeRateOrPercent` copies disagree: `skater-adjustments.ts:74-80` against `team-context-adjustments.ts:19-27`). Tests: a team at 3.0 xGA per 60 yields 3.0; PDO 1.02 gives a positive edge; a replay for a past date reads no row dated after it.

**D7. Single-game player "profiles" (M-FRG-042, 051).** Use a pooled window with real exposure (shots, minutes) as the weight, skip rows with no NST fields instead of treating the player as neutral, and drop the unused assist multipliers. Test: the multiplier for a player is unchanged when his latest game is swapped for another with the same season totals.

**D8. Goalie shots-against context chases last-5 form (M-FRG-025, goalie stage).** `goalie-stage.ts:338-361`: opponent last-5 shot and goal trends, an always-on +3% when the opponent has had a day off, asymmetric clamps (−0.15, +0.20). Run sample: mean +2.3%, range −8.4% to +16.6% over 42 team-games; the traced goalie gains 3.7 shots (+0.66 fantasy points from saves, −0.4 from goals against). Fix: centre the terms on zero, fit them on held-out games or remove them. Test: the mean adjustment over a season fixture is within ±0.5%.

**D9. Goalie goals against and opposing skater goals are not reconciled (M-FRG-029, 038).** Trace: 2.69 against 3.39 for one team-game. Fix: one expected-goals figure per team-game feeds both (skater goals net of empty-net, equal to opposing goalie slot goals against). Test: per game, |skater goals − empty-net − opposing slot GA| below a tolerance.

**D10. Accuracy gates and score (M-FRG-016).** Compute `_30d` gates from 30-day sums with a minimum n; fail on empty; report Brier skill against a base rate; replace the accuracy score with MAE and RMSE skill; score goalies on credited starts with conditional lines (W1-5 order: outcome first). Tests: zero samples cannot pass; a `_30d` gate changes when day −15 changes.

**D11. Holdout naive baseline (M-FRG-018).** Use per-goal constants (1.91 PP, 1.65 ES), position priors and an independent shot baseline. Test: summed naive PP assists over summed naive PP goals is about 1.9.

**D12. Goalie scoring population in the ledger (M-FRG-014, 037).** Store conditional-on-start goalie heads and score them on `started`; score start, win and shutout probabilities only where team-game completeness is proven. Test: calibrated synthetic goalies give observed ≈ predicted in each start bin and saves bias ≈ 0.

**D13. No home-ice term in the team win probability (M-FRG-029).** Add a fitted home term (decision 1 asks for one in the game model) and calibrate the spread shrink on the ledger. Test: mean home win probability over a season fixture matches the observed home win rate within a stated tolerance.

**D14. Assist allocation compresses (M-FRG-048).** Split on-ice goals by each skater's share of on-ice goals for (or by line), not TOI alone. Test: assist bias by projected-goal quintile within ±5% on a frozen window.

**D15. Strength classification (M-FRG-057, 058).** Use one classifier for events and ice time (import the `situation.ts` rule in `shifts.ts`), and close PP segments at penalty expiry with per-case fixtures (W1-2 D8). Test: the `1560` fixture gives ES 2:00 for both sides.

**D16. Null fantasy points ranked as 0 (M-FRG-010).** Rank non-null values only; leave null ranks null; give ties equal ranks. Test: `[120, null, −4]` → `[1, null, 2]`.

**D17. Yes-only de-vig is not monotone (M-FRG-040).** Use the proportional estimate (or a fitted power method) throughout. Test: the estimate is monotone in price from +1000 to +3000.

**D18. Prop lines are averaged before comparison (M-FRG-041).** Pass per-book quotes, as the ledger already does. Test: books at 2.5 and 3.5 are compared separately.

**D19. Re-aimed lines divide by a tilt FORGE never applied (M-FRG-001; RSO audit).** Multiply by the destination tilt only, or add the term to FORGE. Test: a FORGE row with no positional input, moved, equals base × tilt_to.

**D20. Legacy Game Grid odds are not de-vigged (M-FRG-004).** De-vig each book pair before averaging, or withhold (W1-4 direction). Test: −110/−110 stores 50/50.

**D21. Season evaluator re-applies own-team pace (M-FRG-036; player-forecasts audit).** Drop the own-team factor or neutralise rates first; pool losses before forming the skill index.

### P2

- **D22. Goalie save % evidence is one season deep against a 6,000-shot prior (M-FRG-028, 033).** Backfill `forge_goalie_game` or read multi-season WGO totals with recency weights; then re-fit the prior strength. Test: modelled save % SD across starters is within a stated band of the fitted talent spread.
- **D23. Goalie quality tiers cannot reach ELITE (M-FRG-031).** Set thresholds from the modelled distribution. Test: each tier is non-empty on a season fixture.
- **D24. Horizon scaling (M-FRG-009, 024, 027; C7).** Probabilities are never multiplied by a horizon scalar; return per-game values or 1 − ∏(1 − p). Remove the unreachable zero-rest branch. Latent at horizon 1.
- **D25. Rest buckets (M-FRG-045; C9).** After the owner's answer, either adopt the newer tiers with a backtest or delete them; make the heavy tier reachable or remove it.
- **D26. Season bootstrap (M-FRG-008).** If it is kept for next October: weight prior seasons, add an age term, validate the 0.4 share.
- **D27. Role tiers (M-FRG-060).** Derive the tier from usage (TOI rank) or drop the per-tier shot caps.
- **D28. Offline scripts (M-FRG-012, 013, 019).** Withhold a head when the actual is null; bin deciles on a variant-neutral rank; key PP history by the row's own team; import live clamps instead of copying them.
- **D29. Dead constants (M-FRG-005).** Remove the unused imports; mark the legacy penalties as not for use. No deletion without a dependency inventory (Batch A rule 6).
- **D30. Scoreboard view (M-FRG-003).** Mirror the TypeScript populations or mark it unused.
- **D31. FORGE v2 pregame window (M-FRG-022).** Set `readyAt` before `deadlineAt`. Off today.

---

## 4. Questions for the owner

1. **What is a FORGE skater line: all-situation totals or ES+PP only?** It is served and scored as totals today (D1).
2. **Rest buckets:** keep `legacy` in production, or adopt the newer tiers once backtested (D25)?
3. **Sustainability trend band:** momentum (as coded) or regression toward the band (M-FRG-056)?
4. **Goalie rows:** one row per candidate with conditional and unconditional fields (D2), or keep one slot row and relabel it as the team's goalie slot?
5. **Should the opponent or venue ever change a team's shot volume?** Today nothing does (M-FRG-059).
6. **Is the multi-game horizon a supported product?** Four rows exist at horizon 5. If not, remove the option rather than fix it (D24).

---

## 5. Limits

- **No re-run.** I could not run FORGE with a fix applied, so effects of D5, D3 and D13 on a given player are calculations from stored multipliers, not measured differences. Ledger biases are measured but are the sum of several causes; D1's attribution to PK and extra-attacker production rests on the strength-table totals and the target code, not on an ablation.
- **Ledger rows are bridge rows.** `bridge_exact` is the RSO bridge's reading of FORGE. I did not diff it against `forge_player_projections` row by row; the per-skater mean (0.174 goals) matches the FORGE team sum divided by 18 (0.177). The naive controls are on a larger, unpaired sample.
- **Small samples.** 18 days of ledger; one run date for the multiplier ranges; 42 team-games for goalie context; 114 started goalie rows.
- **Not verified:** the official PP shot figure per team (I inferred the shortfall from totals); how much of the short-handed goal bucket is empty-net; whether NST's even-strength player rows include extra-attacker time; the home win rate (not read from `games`); production flag values (`STARTER_BOARD_COMPUTE_ENABLED`, `FORGE_RESERVE_PASS_ENABLED`): I inferred state from stored rows and the catalog only; the starter-probability calibration (taken from W1-5); `buildPlayerUncertainty` and the p10/p90 bands (not in this packet); why only 33 team-games have two goalie rows.
- **Helper-pass entries** (section 2a, and 003, 014 to 021, 035, 037 in the main table) were read by a helper and spot-checked, not fully re-read by me. Their magnitudes are synthetic unless a ledger figure is given. Three kernel files under M-FRG-039 were only skimmed and one was not opened.
- **No external data.** No NST, NHL API or Yahoo calls. Reference standards are named from general knowledge; no external figure was looked up.
