# Audit: xG part 1 (M-XG-001 to M-XG-060)

Wave 1, pass W1-1. Audited 2026-11-10 against `octoberBranch` at `692fd8104` plus the dirty working tree. No code was changed. Line numbers are from the current checkout.

**How this was done.** I read the core path myself (event features, dataset encoder, trainer, calibration, scoring route, aggregates, consumers). Three read-only research agents covered the derived, rebound and evaluation entries; I spot-checked their decisive claims in code before using them. Evidence beyond code:

- The four committed model artifacts, which store per-shot holdout predictions. I recomputed log loss, Brier, AUC and decile reliability from them.
- Bounded database reads under the owner's rules (listed in section 5). `pg_stat_activity` showed 0 active queries before each heavier read.
- A 230-game sample of scalar feature columns (19,790 unblocked shots, no jsonb, one indexed query per game, all under 300 ms), held only in the session scratchpad, used for an offline refit.

## 1. Summary

| Verdict | Entries |
|---|---:|
| Sound | 16 |
| Mis-specified | 23 |
| Wrong | 21 |
| Undetermined | 0 |

No entry is left undetermined, but six sub-questions are open (section 4 and 5).

### What the site actually serves

| xG universe | Where it shows | State today |
|---|---|---|
| In-house trained model | Team page Metrics Timeline, homepage game analytics, xG Lab (`/underlying-stats/xg`), FORGE team prior (if its env var is set) | Every stored aggregate row is from `cfg9bac2706`, the earlier artifact that used post-shot features. Rows cover 2025-10-07 to 2026-05-26 only. Nothing exists for 2026-27. |
| Heuristic bucket xG (0.18 / 0.08 / 0.02, goals floored at 0.25) | Underlying-stats player, team and goalie pages | Live for every season. The branch that would substitute trained-model xG is dead code, so the trained model never reaches these pages. |
| Natural Stat Trick xG | Trends, rankings, goalie GSAx share card | Imported, outside this packet. |

`NHL_XG_MODEL_ARTIFACT_PATH` unset means: the prediction route returns HTTP 400 and scores nothing (`web/pages/api/v1/db/update-nhl-xg-shot-predictions.ts:366-374`); the aggregate route only loses its drift baseline. There is no default path and no xG entry in `vercel.json`. The registry's `artifact_uri` is a local laptop path, which suggests scoring has been run locally.

### Top 5 findings by user impact

1. **The registered champion is the leaky model, and it feeds every in-house xG number on the site.** `nhl_xg_model_registry` has `cfg9bac2706` as `champion`, `is_active = true`. It selects `missReasonBucket` and `isShortSideMiss`, and it reads a null shooter shift age as "goal". Holdout AUC is 0.934, which no pre-shot model reaches. In a one-week sample, shots that became goals carry a mean xG of 0.424 against 0.098 from the corrected candidate; 48% of all xG sits on the 8% of shots that scored. Team xGF tracks goals by construction and goalie GSAx is compressed toward zero. The corrected candidate has been an inactive shadow since 2026-07-13.
2. **The underlying-stats pages show a second xG that depends on the outcome** (triage C4, confirmed). A goal is worth at least 0.25; the same shot saved is worth 0.02 to 0.18. Blocked shots get xG. The goalie column labelled GSAA is xGA minus GA on that heuristic.
3. **There is no in-house xG for the current season.** Play-by-play for 2026-27 is being ingested (18% of stored events), but features, predictions and aggregates stop at 2026-05-26. FORGE's in-house prior query has no season filter, so if its model-version env var is set it reads last season's final rolling rows.
4. **The corrected candidate is not fit to promote as it stands.** Test AUC 0.712 (0.736 at even strength), against 0.77 to 0.78 for Evolving-Hockey at even strength. Three separate causes, each sized on the sample refit: the optimiser stops before converging, the L2 penalty is far too strong for rare features, and `isFlurryShot` leaks the future. Empty-net shots are scored worse than a constant would. A leak-free, converged fit on the same features reaches AUC 0.748, and 0.76 with the empty net split in two.
5. **Public xG Lab columns promise more than the data holds.** "Shot-Assist xG", "xPrimary A", "Entries" and "Exits" are takeaway-or-hit-to-shot proxies, one player's credit can exceed the shot's xG (1.55×), and the stored tables hold about 158 shot-assist rows for a 118,000-shot season, consistent with an unpaginated query losing about 96% of source events. The team shot map mirrors left and right for half its shots.

### Leak-free refit (done criterion)

Sample: every 6th training game and every 3rd test game of the candidate's own split (161 + 69 games). Train 13,882 shots / 963 goals; test 5,908 shots / 415 goals; base-rate log loss 0.2543. Features are the candidate's `first_pass_v1` set minus shooter shift age (stale in stored rows, see D4). Intervals are game-cluster bootstrap, 400 resamples.

| Variant | Test log loss | Brier | AUC | Mean pred (obs 7.02%) |
|---|---:|---:|---:|---:|
| A. Trainer replica: 800 gradient steps, lr 0.05, L2 0.01 | 0.2380 | 0.06307 | 0.713 | 7.46% |
| B. Same objective, solved to convergence (5 Newton steps) | 0.2350 | 0.06259 | 0.733 | 6.92% |
| H. Converged, L2 0.01, `isFlurryShot` removed | 0.2371 | 0.06296 | 0.720 | 6.92% |
| C. Converged, L2 0.0005, flurry flag kept (leaky) | 0.2260 | 0.06159 | 0.767 | 6.95% |
| **D. Converged, L2 0.0005, `isFlurryShot` removed (leak-free)** | **0.2310** | **0.06241** | **0.748** | 6.96% |
| F2. D plus empty-net split (shooting at empty net / own goalie pulled) | 0.2254 | 0.06091 | 0.761 | 6.93% |
| G. Leak demo: C plus stored shift age, nulls as zero | 0.1250 | 0.02863 | 0.940 | 6.85% |

- A reproduces the committed artifact (0.2434 / 0.712 on its full test split), so the replica is faithful.
- Convergence alone: −0.0031 log loss (95% −0.0044 to −0.0016). Weaker L2 as well: −0.0120 (−0.0147 to −0.0093).
- Flurry leak in a converged model: removing the flag costs +0.0050 log loss (+0.0031 to +0.0067) and 0.019 AUC. That is the size of the leak.
- Empty-net split: −0.0056 log loss (−0.0076 to −0.0035) on top of D.
- G shows shift-age missingness alone lifts AUC to 0.94. It explains the champion's 0.93.

Reliability of D on the test sample, by decile (predicted / observed): 0.015/0.014 · 0.023/0.012 · 0.031/0.010 · 0.040/0.034 · 0.050/0.032 · 0.061/0.059 · 0.074/0.090 · 0.091/0.117 · 0.116/0.159 · 0.193/0.176. The shape (too high at the bottom, too low in deciles 7 to 9) is what a model linear in distance and angle produces; it wants a spline or log-distance term.

Limits of the refit: one sixth of the training data, stale stored features, linear logistic only. It sizes the defects; it is not a candidate model.

### What the candidate model includes and excludes

`cfg2afcf561`, family `logistic_l2`, feature family `first_pass_v1`, 65 encoded columns.

| Item | Status | Detail |
|---|---|---|
| Shot universe | Unblocked attempts | Goals, shots on goal, misses. Excludes blocked shots, own goals, penalty shots, shootout (`web/lib/xg/baselineDataset.ts:281-296`). Matches the Fenwick basis used by Evolving-Hockey and MoneyPuck. |
| Location | Included | Normalised x and y, rotated 180° so the attacked net is at (89, 0). Verified against stored blocked shots. No arena adjustment (MoneyPuck adjusts). |
| Distance | Included, linear | Feet to (89, 0), z-scored. No log or spline. |
| Angle | Included, unsigned, linear | `atan2(|y|, |89 − x|)` in degrees. No left/right side. Behind-the-net shots fold onto in-front angles. |
| Shot type | Included | 11 one-hot levels. |
| Rebound | Included as one boolean | Immediately previous event is a same-team attempt, same period, 0 < gap ≤ 3 s. Gap, lateral move and angle change are excluded. |
| Rush | Included as one boolean | 10 s window, D/N-zone source, no speed or distance test. |
| Flurry | Included, **leaks** | True for every shot in a sequence of 2 or more, including the first. |
| Prior event | Included | Type, same-team flag, seconds since, raw distance. |
| Movement | Included | East-west and north-south feet from the previous same-team event; a "royal road" flag. |
| Strength | Included twice | Owner-relative EV / PP / SH / EN, plus away-v-home manpower string. |
| Empty net | One boolean | Identical to the `strengthState:EN` column (both weights 0.0317). Does not say which net is empty. |
| Game time | Included, linear | Period, period seconds, game seconds, overtime flag, PP age, shooter shift age. |
| Zone | Included | O / N / D one-hot. |
| Score state | **Excluded** | Only in `expanded_v2`. No score or venue adjustment anywhere. |
| Shooter | **Excluded** | No identity, hand or position. |
| Goalie | **Excluded** | No identity or catch hand. |
| Seasons | 2025-26 only | 82,636 train / 17,829 validation / 17,834 test shots; chronological by game; test is 2026-03-30 to 2026-05-21, mostly playoffs. |
| Calibration | None applied | Raw kept. Cross-validated isotonic scored best (log loss 0.2402 against 0.2421) but the requirement test said none was needed. |

## 2. Per-entry table

References: **EH** = Evolving-Hockey xG write-up (Younggren & Younggren). **MP** = MoneyPuck published methodology, as summarised in the packet. **NM-C** = Niculescu-Mizil & Caruana (2005). **NST** = Natural Stat Trick glossary. "Sample" = the 19,790-shot sample. "Week" = the one-week joined aggregate, 2026-04-01 to 04-07, 4,731 unblocked shots.

| ID | Verdict | Evidence | Reference | Magnitude | Downstream |
|---|---|---|---|---|---|
| M-XG-001 | Wrong | Registry champion `cfg9bac2706` selects forbidden features; candidate keeps `isFlurryShot` (`baselineDataset.ts:160-168`) and is unconverged (`binaryLogistic.ts:84-131`) | EH, MP | Champion: goals mean xG 0.424 (week). Candidate: AUC 0.712 against 0.748 leak-free and converged | All in-house aggregates and everything in D1 |
| M-XG-002 | Mis-specified | Isotonic is one block per row with no tie pooling and a step-function lookup (`web/lib/xg/calibration.ts:318-366`, `:416-424`); Platt is 400 fixed gradient steps | NM-C | Champion's isotonic maps any raw score above about 0.66 to xG 1.0; tied predictions resolve by row order | Champion predictions |
| M-XG-003 | Mis-specified | Needs calibration only if mean gap ≥ 0.02 or a 10-equal-width-bin gap ≥ 0.10 (`calibration.ts:218-272`) | NM-C; quantile reliability bins | 0.02 is 28% of the base rate. 77% of holdout shots sit in bin 0. Candidate over-predicts by 7% and passes | Candidate ships uncalibrated |
| M-XG-004 | Mis-specified | Procedure is clean (Platt on validation, metrics on test, no tuning on test) but inherits `isFlurryShot` (`web/scripts/train_nhl_xg_challengers.py:61-96`) | EH | Recorded test AUC 0.813 is above published models; trees can isolate first-in-flurry shots, so the figure is inflated | Model-selection research only |
| M-XG-005 | Wrong | Stored rows predate the 2026-07-14 boundary fix (`nhlContextualFeatures.ts:120-146`, commit `4134292c2`): shift age is null where the shooter's shift ends at the event second. PP age restarts whenever manpower changes (`:337-366`) | MP | Sample: null on 80.0% of goals, 0.8% of other shots | Champion leak; scoring of any model from stored rows |
| M-XG-006 | Mis-specified | "Royal road" is any same-team previous event in the offensive zone on the other side of centre, with no time limit and no pass (`nhlContextualFeatures.ts:277-300`). The x ≥ 25 threshold is the blue line; the lead calling it loose is wrong | Royal-road passes are a tracked-pass concept | Fires on 33% of eligible shots (3,990 of 12,232 in the sample); goal rate 8.3% against 6.4% | Candidate weight −0.013; heuristic xG adds 0.02 for it |
| M-XG-007 | Sound | `nhlCoordinates.ts:37-88`. Stored blocked shots: owner is the shooting team in 32 of 32 checkable cases, and x sits in the owner's attacking end | EH and HockeyViz flip by attacking side | None. No arena adjustment, which the model spec states | Distance, angle, movement |
| M-XG-008 | Sound | `nhlPriorEventContext.ts:51-117`. Raw-coordinate distance is frame-independent within a period | MP prior-event features | Speed is null at a 0 s gap | Rebound, movement, shot-assist proxy |
| M-XG-009 | Sound | `nhlRebounds.ts:6`, `:190-205` | MP 3 s rule | The single boolean pools unlike shots: goal rate 3.3% at a 1 s gap, 13.4% at 2 s, 19.4% at 3 s. Same-second pairs: 67 shots, 0 goals, so excluding them is harmless | Candidate weight +0.03; rebounds under-predicted 25% on test (8.9% against 12.0%) |
| M-XG-010 | Wrong | Blocked-shot events store a defender-relative zone code (36 of 39 are `D` in one game) while owner is the shooter. `getTeamRelativeZoneCode` inverts it to `O`, so the block-then-rush source never qualifies (`nhlRush.ts:75-89`, `:204-235`) | MP and EH use about 4 s | Flag carries no signal: 7.7% goal rate against 7.0% overall; the ≤ 4 s subset is 5.2% | Candidate weight −0.024; transition proxies; heuristic xG +0.02 |
| M-XG-011 | Sound | `nhlScoreState.ts:47-56`, `:108-170`; score is taken before the event | Score-adjusted xG (EH, HockeyViz) | Not in the production family | `expanded_v2`, adjusted impact |
| M-XG-012 | Sound | `nhlShotFeatureBuilder.ts:176-180`, `:384-400` | — | Stored goalie-on-ice columns are null on every row read (stale table, D4) | Labels, eligibility |
| M-XG-013 | Mis-specified | `Math.abs(89 − x)` folds behind-the-net shots (`nhlShotFeatureBuilder.ts:192-199`); three copies of the geometry | EH and MP keep signed or behind-net information | 1.3% of shots (265 in sample), goal rate 3.0%, candidate gives 7.5% | Model, danger buckets |
| M-XG-014 | Mis-specified | Matchup is shooter hand against goalie catch hand, no shot location (`web/lib/xg/handedness.ts:27-36`) | Off-wing is shooter hand against shot side | Not in any saved model | Stored payload only |
| M-XG-015 | Wrong | Possession map keyed by `eventId` alone while the only caller batches 20 games (`web/lib/xg/reboundRichLabels.ts:126-128`) | NST high-danger zone is not a 20 ft / 35° wedge | Saved output shows a 1.5% next-attempt rate against a 9.8% rebound-label rate | Offline heads only |
| M-XG-016 | Wrong | Timezone map has no team id 68 (Utah) (`web/lib/xg/travelFatigue.ts:68-102`); "three in four" is a 96 h window with `<=` | — | About 82 team-games a season get null rest after a Utah home game; an every-other-day stretch is flagged | No reader found |
| M-XG-017 | Wrong | `isFlurryShot` is a default feature and not on the forbidden list (`baselineDataset.ts:160-168`, `:241-245`). `isEmptyNetEvent` duplicates `strengthState:EN`. Zero-imputation (`:449-463`) is benign here: coordinates have 0 nulls in 118,299 rows and every sparse feature has a companion indicator | — | See D2 | Trainer, challengers, scoring |
| M-XG-018 | Sound | Chronological by game, random within a date (`baselineDataset.ts:384-440`) | EH trains on many seasons | One season; test is mostly playoffs | Trainer |
| M-XG-019 | Wrong | Fixed 800 full-batch steps from zero, no convergence test (`web/lib/xg/binaryLogistic.ts:84-131`). L2 sits on the mean-loss gradient, so it is strong for rare columns | Any converged logistic fit matches the training mean exactly | Train mean prediction 7.67% against 7.17% observed. Distance weight −0.35 against −1.5 when converged with light L2 | Candidate, Platt, rebound heads |
| M-XG-020 | Mis-specified | Same as M-XG-004 | EH | Same | Research only |
| M-XG-021 | Sound | Train-only mean and population SD (`web/scripts/train-nhl-xg-baseline.ts:789-830`) | — | None | Trainer, scoring |
| M-XG-022 | Wrong | Library boosts in probability space from 0.5 (`@fractal-solutions/xgboost-js/src/xgboost.js:22-41`) then returns `sigmoid` of that sum (`:120-125`); repo scorer copies it (`web/lib/xg/shotFeaturePersistence.ts:593-601`) | — | Outputs sit in about 0.45 to 0.73 for a 7% event. Committed artifacts: mean prediction 0.53, log loss 0.71. It is the CLI default (`train-nhl-xg-baseline.ts:665`) | Not registered; nothing live |
| M-XG-023 | Mis-specified | One row per shot, response is that shot's xG, one ±1 coefficient per player (`web/lib/xg/adjustedImpact.ts:391-419`) | RAPM: stint rows, xGF/60, separate offence and defence, duration weights | β is half the gap in xG per shot, for against against. 600 for and 400 against at equal quality gives 0. Live coefficients are within one SE of zero | Contract text only; not rendered |
| M-XG-024 | Wrong | Shot-assist and transition credit stack on the same shot; rolling window is the last N games with credit, not games played (`web/lib/xg/createdXg.ts:227-260`) | — | One player's credit reaches 1.55× the shot's xG | xG Lab columns |
| M-XG-025 | Mis-specified | Percentile within position × TOI tercile; `percentileRank` returns 1 for a lone player; one rating snapshot for all games (`web/lib/xg/qotQoc.ts:101-152`) | QoC and QoT are league-wide, TOI-weighted | A league-0.95 high-TOI forward can rank 0 in his tercile | No reader |
| M-XG-026 | Wrong | Expected rebounds come from a model whose features include the look-ahead flurry flag; denominator includes missed shots (`web/lib/xg/reboundControl.ts:276-387`) | — | Stored tables are empty (24 kB each), so nothing is shown today | xG Lab goalie rebound columns when populated |
| M-XG-027 | Mis-specified | Product algebra is right, but the two factors use different rebound definitions and status is hard-coded `approved_model` (`web/lib/xg/reboundHeads.ts:28-60`) | — | Three of four heads are always unavailable | Admin operations page |
| M-XG-028 | Wrong | Chronological order is a string compare on `date:gameId:eventId`, so event 1000 sorts before 101 (`web/lib/xg/residualSkill.ts:40-44`) | MP uses a Bayesian shooter prior | Caller uses k = 100 and min 25 on 1,000 shots; shrinkage is about an order of magnitude too weak | Admin counts only |
| M-XG-029 | Mis-specified | Only same-team `takeaway` and `hit` events within 8 s can qualify (`web/lib/xg/shotAssists.ts:76-131`) | A shot assist is the last pass before a shot (tracking data) | At most about 3.6% of shots can qualify. Stored table has about 158 rows | xG Lab "Shot-Assist xG", "xPrimary A" |
| M-XG-030 | Wrong | Exits are a strict subset of entries; "failed exit against" fires in the giving team's offensive or neutral zone; dump-in branch is unreachable (`web/lib/xg/transitions.ts:142-156`, `:336-398`) | Entries and exits are manually tracked | One D-zone takeaway yields entry +1, exit +1, entry assist +1 | xG Lab "Entries", "Exits", "Entry A" |
| M-XG-031 | Sound | `web/lib/rankings/xgDenominatorSemantics.ts:35-67`; unblocked denominators throughout | — | No non-test caller | None |
| M-XG-032 | Mis-specified | `ixg / iff × 100` beside a 0-to-1 shooting percentage on a shots-on-goal base; rolling value is a mean of per-game ratios (`web/lib/trends/playerTrendCalculator.ts:181-204`, `:307-323`) | — | 100× scale gap; 10.0 against 13.3 on the same game | Testing page only |
| M-XG-033 | Mis-specified | Formula is right (GSAx = xGA − GA on unblocked shots with a goalie in net) (`web/lib/xg/aggregates.ts:618-800`). `shots_against` is unblocked attempts; team totals include empty-net shots; own goals are left out | EH, MP GSAx | Inherits D1 in full | Metrics Timeline, homepage, xG Lab, FORGE |
| M-XG-034 | Sound | `xg_i × Π(1 − xg_j)` over earlier shots in the sequence (`web/lib/xg/flurryAdjusted.ts:22-48`) | MP flurry adjustment | −1.7% on season team xG. Double-discounts later shots while the model also carries the flurry flag | Aggregates |
| M-XG-035 | Wrong | Scores the stored `feature_payload` (`shotFeaturePersistence.ts:532-556`, `:743-779`) while the trainer rebuilds features from events (`train-nhl-xg-baseline.ts:1837`). The builder changed on 2026-07-14 with `featureVersion` still 1 | — | Small for the candidate (shift-age weight +0.045); decisive for the champion (−1.24) | Every stored prediction |
| M-XG-036 | Sound | `train-nhl-xg-baseline.ts:881-930` | — | Null-date games sort to the end | Trainer |
| M-XG-037 | Sound | Same as M-XG-021 | — | None | Trainer |
| M-XG-038 | Wrong | Same as M-XG-019 and M-XG-022 | — | Same | Trainer |
| M-XG-039 | Wrong | `gsaa` is xGA − GA on the heuristic; xGA sums every attempt, save percentage uses shots on goal (`web/lib/supabase/Upserts/nhlNstParityMetrics.ts:1503-1521`, `:1780-1781`) | GSAA is league SV% × SA − GA (Hockey-Reference) | About +1.2 "GSAA" a game from missed and blocked shots | Goalie stats pages, column "GSAA" |
| M-XG-040 | Wrong | `if (shot.isGoal) value = Math.max(value, 0.25)` (`nhlNstParityMetrics.ts:407-418`); applied to blocked shots; the `shot.xgValue` branch is never fed | NST xG | A low-danger goal is 0.25, the same shot saved is 0.02 | Underlying-stats player, team and goalie pages |
| M-XG-041 | Mis-specified | Goals for count own goals, shot counts do not; leading and trailing mean two or more (`nhlNstParityMetrics.ts:1412-1421`) | NST | See the W1-2 audit | Player stats pages |
| M-XG-042 | Mis-specified | Compares the full model with a constant; threshold 0 (`adjustedImpact.ts:553-611`) | — | The recorded 7% gain is context terms; pure noise passes 4 of 20 trials | Gate on a diagnostic write |
| M-XG-043 | Mis-specified | Fixed ±0.015 on mean prediction and goal rate (`aggregates.ts:274-277`) | — | ±21% of the base rate, about 11 standard errors at 1,000 shots; never compares live xG with live goals | Aggregate route response |
| M-XG-044 | Mis-specified | Formulas are right (`calibration.ts:106-130`; `train-nhl-xg-baseline.ts:345-361`). No AUC, equal-width bins, no "beats base rate" gate for shot_goal (`:526-568`) | NM-C; quantile bins | Approval needs 10 goals and a mean prediction between 0.001 and 0.999 | Approval gate |
| M-XG-045 | Mis-specified | Drift check returns nothing below 1,000 rows (`web/lib/xg/featureCoverage.ts:187`); scoring runs one game (about 86 rows) at a time | — | Never fires in normal scoring | Prediction route |
| M-XG-046 | Mis-specified | 5v5 surface is not empty (the caller passes `strength_exact`), so that lead is refuted. Score-state axis reads keys that do not exist (`web/pages/api/v1/xg/operations.ts:94`) | — | Score-state segments are always "unknown" | Admin page |
| M-XG-047 | Sound | Mann-Whitney with average ranks (`web/scripts/train-nhl-xg-rebound-heads-offline.ts:121-138`); ECE formula standard | — | None. Not applied to the shot_goal model | Offline |
| M-XG-048 | Sound | `web/lib/xg/operationsHealth.ts:17-56` | — | Identity holds by construction; proves little | Admin page |
| M-XG-049 | Sound | Gate logic is right (`update-nhl-xg-shot-predictions.ts:366-416`) | — | Operationally nothing has been scored since 2026-05-26. The current gate would reject the registered champion | All in-house consumers |
| M-XG-050 | Mis-specified | Same as M-XG-003 (`train-nhl-xg-baseline.ts:1532-1596`) | NM-C | Same | Candidate |
| M-XG-051 | Mis-specified | Same as M-XG-044 | — | Same | Approval gate |
| M-XG-052 | Wrong | Positive-x branch returns `[-y, -x]` where a rotation needs `[y, -x]`; folding by the sign of x ignores the fetched defending side (`web/components/ShotVisualization/ShotVisualization.tsx:393-416`) | NHL coordinates need a 180° rotation | Shots at (−70, 20) and (70, −20) are the same spot and plot 40 ft apart | Team page shot map |
| M-XG-053 | Mis-specified | Empty net is "either goalie digit is 0" (`nhlStrengthState.ts:64-69`; `nhlEventInclusion.ts:106-137`) | EH and MP treat empty-net shots separately | Sample: shooting at an empty net scores 51% and gets 0.10; shooting with your own net empty scores 7% and gets 0.17 | Model, aggregates |
| M-XG-054 | Wrong | `includes("short")` maps the NHL reason `short` to "short-side"; `above-crossbar` matches "crossbar" first, so "over-net" is unreachable (`nhlMissReasons.ts:36-49`) | NHL miss reasons | `above-crossbar` is about six times as common as `hit-crossbar` | Champion feature `isShortSideMiss`; diagnostics |
| M-XG-055 | Wrong | Any stoppage within 3 s is a freeze, reason ignored; a stoppage in the same second is excluded by `nextDelta > 0` (`nhlRebounds.ts:140-152`) | — | `goalie-stopped-after-sog` is the most common stoppage reason; same-second share not measured | Rebound-creation label, rebound control |
| M-XG-056 | Sound | Boundary second resolves to the stint ending there (`nhlShiftStints.ts:268-284`) | — | None after the July fix | On-ice attribution |
| M-XG-057 | Sound | `nhlShotFeatureBuilder.ts:233-262` | — | 300 s overtime is a fallback only when clock fields are missing | Windows, time features |
| M-XG-058 | Mis-specified | `strengthExact` is away-v-home, not owner-relative (`nhlStrengthState.ts:40-45`) | — | `5v4` and `4v5` get near-equal weights (−0.094, −0.100); levels `0v1` and `1v0` exist | Model, parity splits |
| M-XG-059 | Wrong | Same as M-XG-001 | EH, MP | Same | Same |
| M-XG-060 | Wrong | `createsRebound = 1` implies `isFlurryShot = 1` on the same shot (a rebound within 3 s always joins the 5 s flurry) | — | Saved rebound model: flurry weight +1.61, holdout AUC 0.950 | Rebound control |

Leads checked and not confirmed: the royal-road x threshold being loose (M-XG-006); strict gap > 0 undercounting rebounds (M-XG-009); blocked-shot ownership mirroring coordinates (M-XG-007); the empty 5v5 benchmark surface (M-XG-046); `hd_goals_against` (already in the triage).

## 3. Defects

Priority: **P0** user-visible wrong numbers, **P1** wrong or misleading but lower reach or not yet served, **P2** latent or diagnostic.

### P0

**D1. The served in-house xG comes from the leaky champion** (M-XG-001, 033, 049, 059)
- Evidence: registry row `cfg9bac2706` is `approved`, `champion`, active. `nhl_xg_team_game_aggregates` (2,772 rows) and `nhl_xg_goalie_game_aggregates` (2,922 rows) hold that version only. Holdout AUC 0.934. Week sample: goals 0.424 mean xG, saved shots on goal 0.052, misses 0.021.
- Readers: `web/components/MetricsTimeline/MetricsTimeline.tsx:158-168`, `web/lib/homepageGameAnalytics.ts:369-394`, `web/pages/api/v1/underlying-stats/xg.ts:256-283`, `web/lib/projections/queries/team-context-queries.ts:280-314`, `web/scripts/sync-player-forecast-historical-data-local.ts:292-352`.
- Effect: each extra goal on the same shots adds about 0.37 xG. Goalie GSAx moves about −0.6 per goal allowed instead of −1.
- Fix: clear `is_active` and `is_champion` on `cfg9bac2706`; mark or delete its aggregates; rebuild features (D4); promote only a model that passes D2, D3 and D5.
- Test: a registry check that fails when the active model's `feature_keys` contain a forbidden key, and an approval gate that rejects holdout AUC above 0.85 as a leak signal.

**D6. Heuristic xG with a goal floor on the underlying-stats pages** (M-XG-039, 040, 041; triage C4)
- Evidence and readers are in the per-entry table. Four copies exist; the goalie danger copy differs from the others, so HD + MD + LD xGA does not add up to total xGA.
- Fix and test belong to the W1-2 audit (nst-derived-stats). The decision this audit adds: wire trained-model xG through `shot.xgValue`, or label the column as a danger-bucket estimate. Remove the goal floor either way. Rename `GSAA` to GSAx.
- Test: the same shot scores the same whether or not it is a goal.

**D10. Team shot map mirrors left and right** (M-XG-052)
- Fix: rotate using `hometeamdefendingside` and the owner's side; do not fold by the sign of x.
- Test: (−70, 20) attacking left and (70, −20) attacking right map to the same point.

### P1

**D2. `isFlurryShot` leaks the future** (M-XG-017, 004, 020, 060; triage C1)
- Sample: 24% of unblocked shots are flagged. The 2,558 non-final shots in a flurry scored 0 goals, by construction; the 2,198 final shots scored at 11.8%.
- Effect in the trainer replica: shots with an earlier shot in the sequence are predicted 8.1% against 10.1% observed. First shots of a flurry, which look like any other shot when taken, are pushed down by the same weight.
- Fix: drop it. Add `priorShotInSequence` (index > 1), which is known before the shot. Add the flurry look-ahead fields to `FORBIDDEN_BASELINE_FEATURE_INPUT_KEYS`.
- Test: no feature of a shot changes when every later event is deleted.

**D3. The logistic fit is unconverged and over-penalised** (M-XG-019, 038; triage C3)
- Fix: solve to convergence (Newton or L-BFGS) with a gradient-norm stop; choose L2 by cross-validation on a scale that does not grow with row count; leave the bias unpenalised as now.
- Test: on the training split, mean prediction equals the goal rate within 1e-4.

**D4. Stored feature rows are stale and the version was not bumped** (M-XG-005, 035)
- `nhl_xg_shot_features` was last written 2026-05-26. The boundary fix landed 2026-07-14 under the same `feature_version = 1`. Scoring cannot tell.
- Fix: bump the feature version on any builder change; rebuild the table; have the route refuse rows whose builder hash differs from the artifact's.
- Test: stored shift age is non-null for the same share of goals as of other shots.

**D5. Empty-net shots** (M-XG-053, 058; brief question)
- One boolean covers both nets. On the candidate's test split the empty-net slice has AUC 0.52 and log loss 0.512 against 0.468 for a constant.
- Effect (sample, candidate weights): a shot taken with your own goalie pulled gets 0.17 against 7% observed, about 0.1 too much; a shot at an empty net gets 0.10 against 51% observed, about 0.4 too little. The net effect moves xG from the leading team to the trailing team.
- Fix: two owner-relative flags (target net empty, own net empty), or score empty-net shots with a separate small model. Decide whether team xG should include empty-net shots at all; Evolving-Hockey and Natural Stat Trick report 5v5 separately for this reason.
- Test: on a fixture, an empty-net target shot outranks the same shot against a goalie.

**D7. No in-house xG for 2026-27; FORGE prior has no season filter** (M-XG-049)
- Fix: schedule the features, predictions and aggregates chain once a clean model is promoted; add `season_id` to the FORGE prior query.
- Test: the latest aggregate date is within two days of the latest final game.

**D8. Approval and calibration gates cannot catch a bad model** (M-XG-003, 044, 050, 051)
- Fix: require test log loss and Brier below the base rate by a margin; report AUC; use quantile bins; make the calibration tolerance relative (for example 5% of the base rate); add an upper AUC bound as a leak alarm.
- Test: an artifact with mean prediction 0.002 is rejected; so is one with AUC 0.93.

**D9. Rush flag** (M-XG-010)
- Fix: treat a blocked shot's zone as defender-relative; revisit the 10 s window and the faceoff source against the 4 s community convention.
- Test: an opponent attempt blocked in our end, then our shot 5 s later, is a rush.

**D11. xG Lab proxies** (M-XG-024, 029, 030)
- Likely data loss: `web/pages/api/v1/db/update-nhl-xg-shot-assists.ts:190-212` and the transitions route fetch prior events with `.in(game_id).in(event_id)` and no paging, against `max_rows = 1000`. The stored shot-assist table has about 158 rows.
- Fix: page per game; cap one shot's total created credit at its xG; rename the columns as proxies; define exits independently of entries or drop them; fix the giveaway zone test.
- Test: a client capped at 1,000 rows still resolves every prior event; summed credit per shot ≤ shot xG.

**D12. `xgboost_js` is wrong and is the default family** (M-XG-022, 038)
- Fix: remove it or score with the clipped additive value; default to `logistic_l2`.
- Test: mean prediction is within 0.01 of the goal rate on a 7% fixture.

**D13. Rebound-creation model leaks its label** (M-XG-026, 060)
- Fix: the same backward-only flag as D2; restrict goalie rebound rows to shots on goal with that goalie in net.
- Test: holdout AUC falls well below 0.95 once the flag is removed.

### P2

| ID | Entry | Defect | Fix | Test |
|---|---|---|---|---|
| D14 | M-XG-054 | Miss-reason buckets mislabel `short` and `above-crossbar` | Map exact NHL reason strings | Each NHL reason maps to its named bucket |
| D15 | M-XG-055 | Freeze label ignores stoppage reason and same-second stoppages | Accept only goalie-stop reasons; allow a 0 s gap when sort order is later | Same-second goalie stop is a freeze; puck out of play is not |
| D16 | M-XG-016 | Utah missing from the timezone map; 96 h window | Add id 68; use local-date differences | Day after a Utah home game gives rest 0 |
| D17 | M-XG-002 | Isotonic does not pool ties; extreme blocks | Pool equal predictions before PAV; set a minimum block weight; interpolate | Ten tied predictions with three goals return 0.3 |
| D18 | M-XG-015 | Rich rebound labels collide across games | Key by `gameId:eventId` | One game labels the same alone and batched |
| D19 | M-XG-028 | Residual skill sorts event ids as strings | Numeric sort; update per game date | Events 9 and 10 process in order |
| D20 | M-XG-013 | Behind-net shots fold onto in-front angles | Signed x offset or a behind-net flag | A shot at x = 92 is flagged |
| D21 | M-XG-006 | "Royal road" label | Rename to "cross-slot change since previous same-team event" and add a time bound | Flag is false when the previous event is older than the bound |
| D22 | M-XG-023, 042 | Adjusted impact is not RAPM; its gate passes on noise | Stint rows, xGF/60, split offence and defence, converged ridge; gate against a context-only model | 600 for / 400 against at equal quality gives a positive coefficient |
| D23 | M-XG-025 | QoT/QoC percentile of a percentile; goalies counted | League-wide ratings as of the prior day; exclude goalies | 4 teammates and 5 opponents at 5v5 |
| D24 | M-XG-043, 045, 046 | Drift and coverage checks are inert | Signed ratio alerts scaled by sample size; cumulative windows; read `ownerScoreDiffBucket` | A +15% xG shift raises a warning |
| D25 | M-XG-058 | `strengthExact` not owner-relative | Encode as owner-v-opponent | `5v4` means the owner has five |
| D26 | M-XG-032 | Expected shooting % scale and denominator differ from its sibling | One scale, one denominator, ratio of sums | Both metrics share units |
| D27 | M-XG-027, 033 | Hard-coded head status; `shots_against` naming; Metrics Timeline has no model-version filter | Derive status; rename; filter by active model | Two model versions do not double a game's rows |

## 4. Questions for the owner

1. May I, or Chef, demote `cfg9bac2706` in the registry and mark its aggregates unapproved now? That hides last season's in-house xG until a clean model is scored.
2. Are `NHL_XG_TEAM_AGGREGATE_MODEL_VERSION` or `NHL_XG_MODEL_VERSION` set in production? If so, FORGE is reading last season's leaky rolling xG as this season's team prior.
3. Which xG should be the site's headline: the trained model, the bucket heuristic, or Natural Stat Trick's? Today the three coexist under one name.
4. Should team and player xG totals include empty-net shots?
5. Rush window: keep 10 s with faceoff sources, or move to the 4 s convention?
6. May a full-table refit read be run (118,299 rows of scalar columns, in paged per-game queries), or should the trainer be pointed at a local copy? The sample refit sizes the defects but cannot replace the real run.

## 5. Limits

- **Refit is a sample.** 230 of 1,381 games, stored (stale) features, shift age excluded, linear logistic only. A full leak-free refit with boosted trees was not run; the recorded challenger AUC of 0.813 includes the flurry leak and cannot be compared with published models.
- **Flurry and empty-net magnitudes** come from the 19,790-shot sample and a one-week aggregate, not the full season.
- **Blocked-shot ownership** was checked on two games (55 blocked shots).
- **Unpaginated fetch (D11)** is inferred from code, the hosted `max_rows` in `supabase/config.toml`, and stored row counts. A dry run's source-row count would prove it.
- **Rebound same-second stoppage share (D15)** was not measured.
- **Production env values** were not read. Only `NHL_XG_MODEL_ARTIFACT_PATH` is known to be unset (Chef's check).
- **Natural Stat Trick's xG taxonomy** was not checked; no NST, NHL or Yahoo calls were made.
- **Agent-covered entries** (M-XG-014 to 016, 022 to 032, 039 to 048, 052, 055, 060): I verified the decisive lines for M-XG-016, 022, 029, 040 and 052 myself and took the rest from the agents' quoted code.
- **No tests were run.**

Database reads made: catalog (`pg_class`, `pg_stats`, `pg_indexes`, `information_schema.columns`); `nhl_xg_model_registry` (2 rows, scalar columns and three jsonb key tests); grouped totals of the two small game-aggregate tables; blocked-shot rows for games 2025020965 and 2025020100; two one-week joined aggregates with an 8 s statement timeout; four feature rows of game 2025021200 with one jsonb key; and the 230-game sample of scalar columns. No writes.
