# Audit W1-7: FORGE projections, part 2 (M-FRG-061 to M-FRG-120)

Fable, 2026-11-11, on `octoberBranch` at `bc60b18a6`. Read-only: no code, data or configuration was changed.

**How this was done.** I read the market-edge, uncertainty, dispersion, accuracy, goalies-API, goalie shots-against and promotion-gate code myself. Two read-only helpers covered the FORGE v2 research entries and the skater-stage, availability, start-chart and client entries; I re-read the code behind every defect they reported before using it. Paths are relative to `web/`.

**Evidence rules (Batch A).** Every magnitude is a dated sample, never a population rate. The samples used:

- **Coverage sample:** `forge_projection_calibration_daily`, scopes `skater_rolling_dashboard` and `goalie_interval_coverage`, dates 2026-10-19 to 2026-11-10 (8 skater days, 1,835 dressed skater-games; 7 goalie days, 66 goalie rows). Read 2026-11-11.
- **Goalie run sample:** the latest horizon-1 run for 2026-11-08 in `forge_goalie_projections` (6 games, 12 rows).
- **Game sample:** `game_prediction_outputs`, model `forge`, horizon 1, 2026-10-20 to 2026-11-10 (152 rows).
- **Market tables:** row counts and latest dates of `market_prices_daily`, `prop_market_prices_daily` and `model_market_flags_daily`, plus the 40 newest price rows.
- **Executed:** `lib/projections/uncertainty.ts` and `dispersion.ts` functions through a scratch script (model-implied coverage, simulated bands, Poisson cover probabilities). Helpers executed `computeSkaterTeamToiTargetWithPoolGuard`, `reconcileTeamToPlayers`, `buildGoalieStarterMixtureRows` and the forge-v2 scoring functions.

The SQL and scripts were run ad hoc and are not in the repo. Re-run them from a saved script with these ids and dates before any fix relies on a number here.

---

## 1. Summary

| Verdict | Count |
|---|---:|
| Sound | 30 |
| Mis-specified | 18 |
| Wrong | 12 |
| Undetermined | 0 |

### Answers to the brief's four questions

1. **Are all market edges signed correctly?** Totals: yes (`model − line`, over when positive). Props: yes (model P(over | no push) minus the de-vigged market probability; Shin's formula is implemented correctly). Spread: **no** (C11 confirmed). But the market path is **dormant**: `model_market_flags_daily` and `prop_market_prices_daily` are empty and `market_prices_daily` holds 96 rows, the newest dated 2026-04-21. No user sees a flag today.
2. **Is a start-weighted goalie line compared with a single-goalie market line?** Structurally yes, numerically almost no. The saves value sent to the prop comparison is the team's goalie-slot mixture (`lib/projections/stages/goalie-stage.ts:868-879`), but each scenario in the mixture is a full-game line given that goalie starts (`:606-614`), so the mixture is not scaled down by start probability. In the run sample a goalie with a 55.6% start chance carries 28.6 saves on 32.1 shots. The error against a single-goalie line is the save-percentage gap between the two goalies times the partner's start share, about 0.1 to 0.2 saves. The flag is only ever attached to the top goalie.
3. **Do p10/p90 bands cover 80% out of sample?** No, and for skaters they cannot. Coverage sample: goals 95.2%, assists 93.1%, points 94.2%, PP points 95.9%, shots 91.1%, goalie goals against 93.9%, goalie saves 71.2%, goalie shots against 74.2%. Low-count integer bands scored inclusively cover 86% to 99% even for a perfectly calibrated model, so the skater numbers are what the model implies and say little. The goalie saves and shots bands fall about ten points short of what the model implies (81% to 83%).
4. **Does the goalies API report a meaningful win probability?** It reports the **team's** win probability (overtime and shootout included), shown under the top goalie's name. In words: the stage stores, per team, the chance that whichever goalie starts is credited with the win (Σ over starters of P(start) × P(team wins if he starts) × 0.984). The API divides the two teams' values by their sum. Run sample: all six pairs sum to 0.984 before the rescale, so the stage and API agree, and part 1's reading (M-FRG-011) is right. It is not that goalie's own chance of a win.

### Top 5 findings by user impact

1. **Hits and blocks count penalty-kill time twice (M-FRG-105, 108).** Same defect part 1 measured from the consumer side: blocks +12.5% and hits +4.0% on its ledger sample. Reconciled TOI already sums to all-situation seconds and the physical line multiplies by all-situation over ES+PP again (`lib/projections/stages/skater-stage.ts:2807-2809`). User-visible in every skater row.
2. **Tweet-driven roster events mis-set roles and availability (M-FRG-076, 097).** A reviewed "scratches" tweet becomes `INJURY_OUT` (multiplier 0) for a flat 30 hours, which can zero a healthy scratch across two or three slates and lets a real injury lapse after 30 hours (`lib/projections/rosterEvents.ts:92`). Line and power-play tweets carry no line number, so every named player is tagged "L3" or "PP2" (`skater-stage.ts:605-627`), which caps a first-liner's ice time and shot rate.
3. **The goalie win shown is the team's, not the goalie's (M-FRG-094), and the goalie interval and calibration gates measure the wrong population (M-FRG-068, 080, 085).** Goalie bands describe a full game by the team's starter; they are scored against any goalie who appeared. Saves coverage is 71.2% on 66 rows.
4. **The "p10 to p90" label promises 80% and delivers 91% to 96% for skaters (M-FRG-066).** The band is an inclusive integer range. For a 0.17-goal skater it is [0, 1], which covers 98.7%. The simulation's 400 draws also make the upper bound flip between adjacent integers for the same mean.
5. **Spread flags are wrong, and the obvious fix is not enough (M-FRG-095).** The sign is reversed (C11). With the sign fixed, a mean margin compared with a ±1.5 line flags the underdog in 141 of the 152 sampled games (every game with a model margin under one goal). A puck line needs a cover probability set against the de-vigged price, not a mean. Dormant today, so it is P1, not P0.

Also worth knowing:

- The skater pool guard cuts the team's ice-time target from 18,000 to 7,809 seconds the moment 14 skaters are projected instead of 15 (M-FRG-062).
- A latest-game power-play TOI of 45 seconds is read as 45 minutes (M-FRG-063).
- Start Chart zeroes a team's starter probabilities when three rounded candidates sum to 1.0001 (M-FRG-092; conditional on the serving flags W1-5 left open).
- Goalie shots against carries a +3% "opponent rested" boost in every non-back-to-back game (M-FRG-093). Run sample: goalie shots against average 27.85 where part 1 measured 26.2 projected team shots for the same six games.
- Nothing in `lib/forge-v2/` is served: the API is built with `enabled: false` and the page returns `notFound` (`pages/api/v2/forge/[operation].ts:5`; `pages/forge/v2/index.tsx:5-7`).

---

## 2. Per-entry table

"Part 1" means [forge-projections-part1.md](forge-projections-part1.md); "W1-5" means the goalie-starters audit as corrected in [BATCH-A-CONSOLIDATED.md](../BATCH-A-CONSOLIDATED.md).

| ID | Verdict | Evidence | Reference | Magnitude | Downstream |
|---|---|---|---|---|---|
| 061 Team PP share and PP TOI allocation | **Wrong** (one defect) | Share is PP skater-seconds over all-situation skater-seconds applied to an all-situation 18,000 target, which is consistent (`lib/projections/queries/team-context-queries.ts:143-172`; `stages/skater-stage.ts:1258-1262,2533`). No look-ahead (`.lt("date", asOfDate)`, `:110-111`), no season filter. Defects: `clamp(new/old, 0.25, 4)` leaves PP shots on a player given zero PP seconds (`skater-stage.ts:2568-2571`); the "< 3600 means minutes" rule can only misfire, because the writer stores seconds (`pages/api/v1/db/update-wgo-skaters.ts:500-503`; `team-context-queries.ts:156`) | Internal consistency | Executed (helper): PP TOI 200/0/100, PP shots 0.6/0.1/0.2, target 1.0 → the zero-TOI player keeps 0.111 PP shots. A partial game of 2,400 summed seconds becomes 144,000 | Skater rows; PP targets |
| 062 Team TOI target and pool guard | **Wrong** | 18,000 is about 1% above a rough estimate of real skater-seconds (helper estimate 17,800 ± 150, assumptions stated in its notes). Guard: `floor(2100 / blendedTopShare)` treats a share ceiling as the top share (`lib/projections/calculators/scenario-blending.ts:464-473`) | Internal consistency | Executed (helper), PP share 0.085: 15 skaters → 18,000; 14, 12 or 10 → 7,809; 6 → 7,200. TOI, hits and blocks fall 57%; shots and goals do not (separate target). How often fewer than 15 are projected was not measured | Skater TOI, hits, blocks |
| 063 WGO TOI normalisation and deployment prior | **Wrong** | `n <= 60 → ×60` on a column stored in seconds (`skater-stage.ts:339`). The "prior" is the single latest game row within 365 days (`lib/projections/queries/skater-queries.ts:510-527`). Zero returns null, so "no PP last game" removes the prior | Marcel (a prior is a multi-game average) | Hand: PP 45 s → 2,700 → clamp 1,200; blend 0.8 × 60 + 0.2 × 1,200 = 288 s against a rolling 60. Later PP allocation and reconciliation mute it | Skater TOI before allocation |
| 064 Role continuity multiplier | Mis-specified | Formula as documented (`skater-stage.ts:747-807`). Applied to TOI and shots before reconciliation (`:2347-2360`), so it only moves share within a team. Penalises a newly promoted player (0.745) | None published; internal | Stable L1 1.05; L2 6 of 10 with 3 switches 0.96; just promoted 0.745 (floor 0.70) | Skater TOI and shot share |
| 065 Count distribution helpers and fitted dispersion | Sound | pmf recursion, CDF, quantile, push handling and the horizon formula α = a/H + b/M are right (`lib/projections/uncertainty.ts:782-837,918-937`; `dispersion.ts:131-171`). Gamma sampler is a correct Marsaglia–Tsang with the shape < 1 boost (`uncertainty.ts:969-985`). Caveat, stated in the file: the fit is within player-season, so projection error is not in the variance. The horizon formula assumes independent games | Negative binomial (NB2 with an NB1 term) | n/a | Prop probabilities; simulations |
| 066 Player uncertainty Monte Carlo | Mis-specified | `uncertainty.ts:153-454`. Inclusive integer [p10, p90] cannot hit 80%. 400 draws put ±1.5 points of noise on the 90th percentile. Volatility widening multiplies the spread of integer quantiles (`:102-114`), giving values such as 1.55 that cover no extra integer. Goals ignore the simulated shot draw (`:354-357,380`). TOI noise and the residual TOI term do add up to the fitted TOI variance (`:762-772`) | Interval score; nominal coverage | Coverage sample: G 95.2%, A 93.1%, PTS 94.2%, PPP 95.9%, SOG 91.1% (n = 1,835). Executed model-implied coverage: G 92% to 99%, PTS 92% to 94%, SOG 86% to 94%. Executed: mean 0.51 points gives p90 = 2 where the exact quantile is 1 | Start chart, FORGE pages, accuracy coverage |
| 067 Team uncertainty Monte Carlo | Mis-specified | `uncertainty.ts:456-586`: one Poisson for the team total, no over-dispersion, 3% and 8% noise on a TOI total that reconciliation fixes | Negative binomial for over-dispersed counts | Not measured (no team coverage is stored) | Team pages |
| 068 Goalie uncertainty Monte Carlo | Mis-specified | `uncertainty.ts:600-733`. Sampling is right; goals against are Poisson given shots (about 10% more variance than binomial). The band is the team slot over a full game and is scored against any goalie who appeared | Negative binomial; binomial | Coverage sample (n = 66): saves 71.2%, shots against 74.2%, goals against 93.9%. Model-implied: 81%, 83%, 87%. The saves gap is about 1.8 standard errors: an alarm, not a proof | Accuracy gates; goalie pages |
| 069 Dispersion fit and holdout scoring | Sound (offline) | Method of moments with the s²/n correction, NNLS through the origin, log score, RPS and randomised PIT are right (`scripts/fit-forge-dispersion.ts:35-78,177-245`). Caveats: the date window Oct 1 to Apr 30 includes about ten days of playoff games; the holdout scores a bin's histogram at the bin mean; the holdout mean (prior 40 games) is not FORGE's projection | NB2 method of moments; proper scoring rules | n/a | `FORGE_DISPERSION` constants |
| 070 FORGE v2 evaluation scoring | Sound | CRPS, log score (zero mass reported as infinite, not clamped), interval score with matching α, mixture moments, paired block bootstrap (`lib/forge-v2/horizonEvaluation.ts:134-167,295-327`). Nits: both percentile indices use `floor`; a CI is emitted from as few as 2 blocks | Gneiting & Raftery 2007 | Executed (helper): CRPS 1.22 against brute force 1.22; interval score 6 as expected | Offline script only |
| 071 FORGE v2 kernel means and participation | Mis-specified (not served) | One bandwidth over unscaled features (`lib/forge-v2/model.ts:118`; `participation.ts:36`). `minimumSupport` counts rows with weight > 0, which a Gaussian kernel almost never excludes. Splits are time-ordered with no leak found (`model.ts:79-95,116,150`). Participation bins are not monotone and fail closed below support | Kernel regression practice; time-ordered splits | Executed (helper), h = 1: a 3-minute TOI gap gives weight 0.011; a 0.5 PP-share gap gives 0.882 | Tests and fixture harness |
| 072 FORGE v2 research baselines | Sound | Half-life in days, pool rate on the same exposure basis, strict cutoffs (`lib/forge-v2/researchBaselines.ts:52-86`). Caveat: one pool for all skaters | Empirical Bayes shrinkage | n/a | Tests only |
| 073 FORGE v2 joint distribution and interval calibration | Sound | Left-continuous weighted quantile; per-side level (1 + level)/2 with rank ceil((n + 1)q), the rank-th smallest, refused when rank > n (`lib/forge-v2/uncertainty.ts:76-116`). Union bound gives at least the stated level under exchangeability. The split's independence from model fitting is not enforced in code | Split conformal (Angelopoulos & Bates 2021) | Executed (helper): n = 18 unavailable, n = 19 rank 19 | Not served |
| 074 Dashboard client aggregates | **Wrong** (display) | `components/forge-command-center/TeamPowerTerminal.tsx:78,84-93,128-142`: ratings near 100 are drawn on a 0–100 bar, "risers" are the first five non-negative rows in power order, the fallback sparkline for a faller rises. "Trust" averages only the categories where the player made a top list (`components/forge-dashboard/HotColdCard.tsx:237-298`) | Internal consistency | Every at-or-above-average team shows a full bar. Faller with power 100, trend −4: spark [96, 102, 100] | `/forge` dashboard and command center |
| 075 Revision traversal spans | Sound | Sweep line and opacity 1 − 0.75ⁿ are right; gaps break the path and the caption says so (`components/ForgeV2/ForecastExplorer.tsx:17-33,73`) | n/a | n/a | Page returns 404 |
| 076 Roster events from reviewed tweets | **Wrong** | `SCRATCHES → INJURY_OUT` (`lib/projections/rosterEvents.ts:92`) with a flat 30-hour life; expiry is tested against the slate start only (`stages/preflight-stage.ts:139`). Tweet payloads carry no line number or PP unit (`rosterEvents.ts:164-177`). Fixed confidences 0.95/0.75/0.70. `evaluateRosterEventPreflight` has no non-test caller | Internal consistency | A scratch reviewed 23:00 UTC Monday zeroes the player on Monday, Tuesday and Wednesday slates. How many such events exist was not counted | Availability, role tags |
| 077 Goalie starter metadata | Mis-specified (latent) | `top2_probability_mass` is a plain sum, right (`lib/projections/utils/projection-metadata-builders.ts:297-301`). Win and shutout probabilities are multiplied by the horizon scalar sum (`:451-459`; C7) | Probability axioms | None at horizon 1. Run sample: all 12 rows horizon 1; top-2 mass 0.971 to 1.000 | Goalie metadata |
| 078 Pipeline stage map | Sound | A map, not a calculation (`lib/rollingForgePipeline.ts:48-200`). Its leads are real and owned elsewhere: accuracy scores horizon 1 only (`pages/api/v1/db/run-projection-accuracy.ts:1741,2027`); starter priors come from a separate route (W1-5); `toi_seconds` is null (C10) | n/a | n/a | Cron |
| 079 Miss attribution | Mis-specified | Skater: FP = TOI × shot rate × FP per shot (`run-projection-accuracy.ts:1949-2000`). With zero actual shots the "actual" end of the chain is 0 whatever the player scored, so the parts do not sum to the error; assists are attributed to shot conversion; hits and blocks are left out. Goalie: the shots and save-percentage terms are an exact two-term identity, and the "starter" term (1 − p) × \|GA error\| is added on top (`:2247-2256`) | Shapley or log-mean decomposition | Hand: 0 shots, 1 assist → reconstructed FP 0 against actual 2.0 | Diagnostics only |
| 080 Accuracy metrics | **Wrong** | Confirmed as part 1 found (M-FRG-016): `_30d` gates built from one date, an empty sample passes, the "accuracy" score is not proper. Added here: the interval gate [0.72, 0.90] is applied to hit rates whose calibrated value is 81% for saves and 87% for goals against; the goalie baseline reuses the model's shots against at a fixed .900 (`:2115-2123`); actual TOI of 80 or less is read as minutes (`:1963-1966`) | Brier; interval score | Coverage sample: saves 71.2% fails the gate, goals against 93.9% fails it from above | Accuracy tables, gates |
| 081 Accuracy role buckets | **Wrong** (minor) | Rank under 5 is PP1 and under 10 is PP2 with no test that PP TOI is positive (`run-projection-accuracy.ts:594-599`) | Internal consistency | A team with 6 PP players puts four zero-PP skaters in PP2 | Role-bucket diagnostics |
| 082 Run preflight gates | Sound | Thresholds as documented; any FAIL returns 422 for the slate (`pages/api/v1/db/run-projection-v2.ts:200-250,655-683`). A team idle more than 7 days fails the derived-rows gate | n/a | n/a | Pipeline |
| 083 Start-chart projected TOI | Mis-specified (minor) | Nulls are summed as 0, needed because PK is always null; totals over 65 minutes return null, which drops every multi-game row (`pages/api/v1/start-chart.ts:749-765`) | n/a | n/a | Start chart |
| 084 Projection source analysis | Mis-specified | `(1 − \|err\|/\|proj\|) × 100` is unbounded below; the quality score adds percentages to fantasy points; `ceil(ADP / 12)` assumes 12 teams (`components/Projections/ProjectionSourceAnalysis.tsx:234-238,306-314,401`) | MAE, RMSE, skill scores | Projected 10, actual 35 → −150% | `/projections` analysis view |
| 085 Calibration and goalie launch gates | **Wrong** | Starter outcome is "has an actual row" (`run-projection-accuracy.ts:2078-2082`); win is scored on appeared goalies against the slot value; Brier on an empty sample is 0 (`:1213`); inputs are clamped to [0, 1] before scoring (`:1190-1194`). All verified by W1-5 and part 1 | Brier with a base-rate reference | See W1-5 and part 1 | Launch gates; goalies API hints |
| 086 Skater miss attribution | Mis-specified | Same code as 079 | — | — | — |
| 087 Retained ledger validity | Sound | Tolerances match three 4-dp roundings; pairing uses identical rows (`scripts/forge-ledger-evaluate.ts:15-52`; `lib/player-forecasts/servedForecastLedger.ts:437-448,473-515`). "naive_last5" is 10 starts for goalies, disclosed in the output | Paired comparison | n/a | Offline; `scorePairedLedger` also feeds `/api/v1/forge/scoreboard` |
| 088 FORGE v2 issuance coherence gate | Mis-specified (not served) | 1e-10 is ample for float error. The gate is brittle for another reason: head means use rows where that head exists, the joint uses rows where all heads exist (`lib/forge-v2/model.ts:120`; `uncertainty.ts:53`) | Internal consistency | Executed (helper): float error 4.8e-14 on 5,000 outcomes; one training row missing one head moves a mean by 1.75e-3 and withholds every distribution | Not served |
| 089 FORGE v2 operations summary | Sound | Arithmetic right; called only from `lifecycle.test.ts` | n/a | n/a | None |
| 090 FORGE v2 qualification gate | Mis-specified (not served) | Means, participation and intervals fail closed (`lib/forge-v2/qualification.ts:44-87`). Accountability grades raw means and is projected with no qualification check (`evaluation.ts:173`; `api.server.ts:137-141`). No qualified manifest exists | Fail-closed gating | Unreachable today | Not served |
| 091 Goalie share, SV%, GAA by window | Sound | Pooled ratios; starts withheld unless every game has one labelled starter (`lib/goalieWorkload.ts:61-117`) | Standard definitions | n/a | GoalieShareChart |
| 092 Goalie starter mixtures | **Wrong** (conditional) | A raw sum above 1.000001 is "conflicting" and zeroes the whole team (`lib/projections/goalieStarterMixtures.ts:143-146,155-156`). Inputs are rounded to 4 dp and three-candidate vectors can sum above 1 (W1-5). The ×0.65 back-to-back factor drops mass instead of moving it and is not on any scheduled path | Probability axioms | Executed (helper): 0.6001/0.3001/0.0999 → all 0. Two-goalie teams are safe. Frequency not measured | Start Chart (`pages/api/v1/start-chart.ts:1539`), subject to W1-5's serving flags |
| 093 Goalie shots against | Mis-specified | `stages/goalie-stage.ts:296-360`. The "shots trend" compares the opponent's last-5 shots with the blended base, not with its own last 10. Opponent goals move shots. "Rested" is rest of 2 or more days, the normal state (`lib/projections/constants/projection-weights.ts:26`; `queries/team-context-queries.ts:568-575`), so +3% is the default. Clamps are asymmetric. Not reconciled with the opposing skaters' shots | Internal consistency (shots against = opponent shots) | Run sample: mean 27.85 across 12 rows; part 1 measured 26.2 projected team shots on the same six games (+6%) | Saves, goals against, shutout, bands |
| 094 Goalies API win normalisation | Mis-specified | Confirmed as part 1 (M-FRG-011). Also: a game with one row is left on the 0.984 scale (`pages/api/v1/forge/goalies.ts:173`), and at a multi-game horizon the rescale hides the horizon scaling | Probability definition | Run sample: 6 of 6 pairs sum to 0.984; team 54's goalie (55.6% to start) stores 0.5224 and is shown 0.531 | GoalieRiskCard "Win" |
| 095 Totals and spread flags | **Wrong** (dormant) | Totals sign right (`lib/projections/run-forge-projections.ts:1069,1078`). Spread: `margin − home line` (`:1108`); stored lines are signed, favourite negative (newest price rows: BUF −1.5, BOS +1.5). Lines are averaged across books (`queries/market-queries.ts:136`). Both compare a mean with a line | Sportsbook convention; Skellam | Executed: home 3.4, away 2.6, line −1.5 → code +2.30 "home cover"; fixed sign −0.70; Poisson chance the home side wins by 2 or more in regulation 0.381. Game sample: 141 of 152 have a model margin under 1.0. Flags table empty | Market flags (none stored) |
| 096 Start-chart defence grade | Sound | 0-based average rank over (n − 1), within [0, 100] (`pages/api/v1/start-chart.ts:715-745`). Caveats owned by W1-4: slate-only ranking and null xGA read as 0 | Percentile rank | n/a | Start chart |
| 097 Availability multiplier | Mis-specified | Multipliers are not probabilities: every DTD is 1 − 0.6 × 0.75 = 0.55 (`stages/preflight-stage.ts:41-70`). With the compute flag on it becomes 0 or 1 (`skater-stage.ts:2335-2336`). Latest `effective_from` wins | Participation probability | Flag off: a 1,000 s player becomes 565 s after reconciliation and teammates gain 2.8%. Which mode is live was not read | Skater lines |
| 098 Line recency, role tags, fallback | Mis-specified | L3 is DEPTH from line combinations (`skater-stage.ts:643-647`), MIDDLE from roster events (`:612`) and MIDDLE_SIX in accuracy (`run-projection-accuracy.ts:620`). Stale thresholds 10 and 21 days are unlabelled | Internal consistency | n/a | Usage bounds, accuracy buckets |
| 099 Team-context finite mean | Sound | `team-context-queries.ts:24-30` | Arithmetic mean | n/a | — |
| 100 PP opportunity means | Sound | `team-context-queries.ts:161` | Arithmetic mean | n/a | — |
| 101 Holdout comparator deltas | Mis-specified | Paired on identical rows and arithmetically right (`lib/projections/promotionGates.ts:149-194`); MAE-only, minimum n of 30, no interval. Same as part 1's M-FRG-017 | Paired bootstrap | See part 1 | Holdout report |
| 102 Holdout MAE and RMSE | Sound | `promotionGates.ts:127-146` | MAE, RMSE | n/a | — |
| 103 `proj_assists_es` | Sound | Team assists scale to exactly 1.65 per ES goal (`skater-stage.ts:2753-2775`) | Reconciliation | n/a | Skater rows |
| 104 `proj_assists_pp` | Sound | 1.91 per PP goal, same code | Reconciliation | n/a | Skater rows |
| 105 `proj_blocks` | **Wrong** | `skater-stage.ts:2807-2809` with `lib/projections/calculators/skater-adjustments.ts:543-545` | Internal consistency | Part 1 ledger sample: +12.5%. Hand: PK defenceman +10% | Skater rows, fantasy points |
| 106 `proj_goals_es` | Sound | Post-reconciliation shots × rate (`:2772-2773`); the team row is the sum of player rows | Reconciliation | n/a | Skater rows |
| 107 `proj_goals_pp` | Sound | Same; inherits 061's zero-TOI PP shots | Reconciliation | n/a | Skater rows |
| 108 `proj_hits` | **Wrong** | Same as 105 | Internal consistency | Part 1 ledger sample: +4.0% | Skater rows, fantasy points |
| 109 `proj_shots_es` | Sound | Share of the team target (`:2652-2659`); the target's level is part 1's M-FRG-059 | Reconciliation | n/a | Skater rows |
| 110 `proj_shots_pp` | Sound | Same | Reconciliation | n/a | Skater rows |
| 111 `proj_toi_es_seconds` | Mis-specified | The column holds everything that is not power play (ES, PK, 4v4, OT); `proj_toi_pk_seconds` is null (`:2533,3215`) | Honest labelling | PK is about 1,160 of 18,000 team seconds (helper estimate) | Any reader that treats it as even strength |
| 112 `proj_toi_pp_seconds` | Sound | Integer share of the PP target (`lib/projections/reconcile.ts:34-65`) | Reconciliation | n/a | Skater rows |
| 113 `buildAccountability` | Sound | `lib/forge-v2/evaluation.ts:230-240`; pools horizons, disclaimed | n/a | n/a | Not served |
| 114 `errors` | Sound | Bias is forecast − actual (`evaluation.ts:176,183`); the UI prints a bare "bias" | n/a | n/a | Not served |
| 115 `settleEvaluation` | Sound | `evaluation.ts:157-181` | n/a | n/a | Not served |
| 116 `summarizeAccountability` | Sound | `evaluation.ts:186-228` | Interval score | n/a | Not served |
| 117 `summarizeHorizonEvaluations` | Sound | `horizonEvaluation.ts:240-260`; `missing` inflates when skater and goalie cases are mixed | n/a | n/a | Offline script |
| 118 `totals` | Sound | A calendar window, documented at `horizonEvaluation.ts:122`; forecast and outcome use the same rule | n/a | n/a | Offline script |
| 119 `scoreMeans` | Sound | Weights equal `lib/projectionsConfig/fantasyPointsConfig.ts:8-15`; a missing head withholds the score (`lib/forge-v2/identity.ts:28-40`) | League scoring | n/a | Not served |
| 120 `scoringProfile` | Sound | `identity.ts:22-28` | League scoring | n/a | Not served |

---

## 3. Defects

### P0 (user-visible wrong numbers today)

**D1. Hits and blocks count penalty-kill time twice (M-FRG-105, 108).** Part 1's D4 already carries the fix and tests. Nothing to add except the entry ids.

**D2. Scratch tweets become 30-hour injuries; line tweets default to L3 and PP2 (M-FRG-076, 097).**
- Fix: map SCRATCHES to SCRATCH, scoped to a game id; test expiry against each game's start, not the slate start; give injuries no fixed expiry (end them with a RETURN event). Ignore LINE_CHANGE and PP_UNIT_CHANGE events that carry no line or unit.
- Tests: a scratch on day D leaves day D+1 untouched; an injury with no return is still out on day D+3; an event with no line number returns no role tag.
- First step: count the affected events (`forge_roster_events` by type and source for the season) so the size is known.

**D3. Team Power Terminal bars, risers and sparkline (M-FRG-074).**
- Fix: map a rating r to 50 + (r − 100)/15 × 16.7 for the bar; sort risers by `trend10` descending; fallback sparkline `[p − t, p − t/2, p]`; drop the variance flag from the bar list.
- Tests: a 100 rating draws a half bar; the top riser has the largest trend; a faller's sparkline ends below where it starts.

**D4. Goalie "Win" is the team's win probability (M-FRG-094).** Part 1's fix stands. Addition: label the current value "Team win" until per-goalie values are served, and never rescale a game that has one row.

### P1

**D5. Intervals labelled p10 to p90 do not mean 80% (M-FRG-066, 067, 068, 080).**
- Fix:
  - Compute skater and goalie count quantiles from the exact distribution (`summarizeCountDistribution` already exists) instead of 400 draws.
  - Label the band "typical range" and store its model-implied coverage beside it.
  - Judge calibration by randomised PIT and interval score per stat, not by a hit rate against a fixed 72% to 90% gate.
  - Score goalie bands on credited starts only (W1-5 order: outcome first).
  - Apply volatility to the variance before taking quantiles, not to integer quantiles.
- Tests: the same mean always gives the same band; on a simulated calibrated sample the PIT histogram is flat within tolerance; a relief appearance is excluded from goalie coverage.

**D6. Spread flag (M-FRG-095).**
- Fix: compute P(home margin + line > 0) from the two team means (Skellam, with the overtime rule stated: a one-goal overtime or shootout win does not cover −1.5), compare it with the de-vigged price per book, and flag on a probability edge as props do. Do the same for totals, adding the empty-net and overtime goals the mean leaves out. Never average lines across books.
- Tests: (3.4, 2.6, −1.5) gives a cover probability near 0.38, not a "home cover" flag; (2.6, 3.4, +1.5) mirrors it; books at 5.5 and 6.5 are compared separately.
- Do this before odds ingestion resumes.

**D7. Skater pool guard cliff (M-FRG-062).**
- Fix: target = min(18,000, n × 1,200), or scale by n/18.
- Tests: the target never decreases as n rises; 14 skaters give at least 16,000.

**D8. WGO seconds read as minutes (M-FRG-063, 061).**
- Fix: treat the columns as seconds everywhere; keep zero as zero; replace the one-game "prior" with a last-5 mean; skip team-games with fewer than 15 skater rows instead of rescaling them.
- Tests: 45 s stays 45 s; a partial game is skipped.

**D9. Start Chart zeroes a team on a rounding excess (M-FRG-092).**
- Fix: renormalise when the sum exceeds 1 by less than 0.001 per candidate; renormalise upstream after the 0.01 floor (W1-5); treat only larger excesses as conflicting.
- Tests: 0.6001/0.3001/0.0999 and 0.975/0.0205/0.01 keep their order and sum to 1.

**D10. Goalie shots against (M-FRG-093).**
- Fix: take one shots figure per team-game from the skater stage and use it for the opposing goalie; fit any rest, home and trend terms on held-out games or drop them; make "rested" the baseline, not a boost.
- Tests: per game, goalie shots against equals the opponent's projected shots within a tolerance; mean bias on a frozen window within ±1%.

### P2

**D11. PP shots on zero PP seconds (M-FRG-061).** Fix: PP shots = rate × allocated seconds, zero when allocated is zero. Test: zero allocation gives zero PP shots and goals.

**D12. `proj_toi_es_seconds` label (M-FRG-111).** Fix: rename to non-PP, or reconcile ES and PK separately and fill `proj_toi_pk_seconds`. Test: per team, ES + PP + PK = target and PK > 0.

**D13. Miss attribution (M-FRG-079, 086).** Fix: decompose the actual error with a symmetric (Shapley) split over TOI, shot rate, shooting, assists and peripherals so the parts sum to the error; drop the goalie "starter" add-on or make it the first term of an exact identity. Test: parts sum to the signed error for every row, including zero-shot games.

**D14. Role tiers and PP buckets (M-FRG-081, 098).** Fix: one tier map shared by the stage and the accuracy route; a bucket requires PP TOI above zero. Test: the L3 tier is the same in all three places.

**D15. Role continuity and availability multipliers (M-FRG-064, 097).** Fix: move role volatility into the variance, not the mean; replace DTD multipliers with a fitted participation probability kept separate from the line given that he plays. Test: a just-promoted player's mean is not below his prior role's.

**D16. Horizon-scaled probabilities in metadata (M-FRG-077).** Covered by C7 and part 1; fix both copies together.

**D17. Client accuracy score (M-FRG-084).** Fix: report MAE and bias per stat and a skill score against a named baseline; read the league size from settings. Test: the score is bounded and unit-consistent.

**D18. FORGE v2, before any release (M-FRG-071, 088, 090).** Per-feature bandwidths or train-only standardisation; effective sample size for the support gate; means and joint from one row set; qualification check on accountability. Tests as listed in the table rows.

---

## 4. Questions for the owner

1. Should the band keep the name "p10 to p90", or become a "typical range" with its real coverage shown?
2. Is odds ingestion meant to come back? If not, the market-edge code can stay parked and D6 drops to P2.
3. For a healthy scratch, should FORGE show a line "if he plays" or nothing?
4. Should `proj_toi_es_seconds` be renamed, or should PK ice time get its own number?
5. Is the Team Power Terminal meant to show the 100-centred rating or a 0–100 percentile?

---

## 5. Limits

- **Coverage** comes from the accuracy job's stored daily aggregates, not a re-join of projections to outcomes. It covers 8 skater days and 7 goalie days, inherits that job's defects (appeared goalies, dressed skaters only, latest run per date), and has no one-sided miss rates. I did not read per-row bands, to stay inside the read rules.
- **Model-implied coverage** was computed for representative means, not per stored row.
- **Market edges** could not be checked against stored flags because there are none. The spread convention rests on the newest price rows (April 2026) and part 1's reading of the ingester.
- **Not measured:** how often fewer than 15 skaters are projected; how often three goalie candidates sum above 1; how many scratch or line tweets became roster events; actual goals per game for the game sample (`games` has no scores), so the totals bias is unsized.
- **Not read:** production flag values (`STARTER_BOARD_*`, `FORGE_SKATER_MODEL_MODE`), so the availability mode and the Start Chart path are conditional.
- **Helper work:** the 18,000-second estimate, the forge-v2 executions and the skater-stage hand examples are the helpers'. I re-read the cited code for each defect but did not re-run their scripts.
- **Reference standards** are cited by name from memory (Gneiting & Raftery 2007; Angelopoulos & Bates 2021; Shin 1993; Skellam); I did not consult the papers.
- No NST, NHL or Yahoo calls, no writes, no tests run beyond the scratch scripts.
