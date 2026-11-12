# W1-10 peer review: game predictions and odds

Reviewed 2026-11-11 on Tim's Mac in the canonical `octoberBranch` checkout. Audit reviewed: Fable commit `5cff74faac` (audit source baseline `87785fdbc`). Review checkout began at `5ae1037cc4155acf586564187cddc4390bf99f90`. The inspected game-prediction modules, legacy Poisson modules, Game Grid, GamePreview and game pages have no diff from the audit commit and no local changes. Paths below are relative to `web/` unless explicitly rooted at `tasks/`.

## Verdict

**Accept the audit as a useful defect inventory, with material corrections before using it as a fix plan.** The placeholder, threshold mismatch, issuance-weighted scoring, in-sample calibration, calibration-summary schema mismatch and disconnected model promotion are supported by source. The sampled performance tables are **Fable's reported 2026-11-11 measurements, not independently reproduced production evidence**.

The most consequential changes to the audit are:

1. **Additional P1: the default walk-forward replay learns a simultaneous game's outcome before predicting another game.** An actual-function offline counterfactual moved the second game's probability from **0.333998 to 0.666002** by changing only the first simultaneous game's result. M-GPR-005 is not sound.
2. **Additional P1: the recommended “last pregame issuance” helper does not prove a forecast was published before the game, and persisted snapshot selection does not enforce its cutoff.** Both failures reproduce. Do not repair D7 by copying that helper unchanged.
3. **Additional P1: partial recent-form rows become fabricated low rates or 100% shares.** A missing-count game halves a 4 GF/game and 2 xGA/60 fixture to 2 and 1; an absent xGA turns xGF share into 1.0. Ratio-of-sums is sound only for matched observed support.
4. **Correct D3's exposure: the old game-page Poisson component is not rendered.** At the audited commit and current source, the page only imports it and prepares unused chart data. Its arithmetic needs fixing before reuse, but it is not a demonstrated live P0 and “three draw conventions are live” is false for the inspected code.
5. **Correct D1/D34's health claim: missing-model and missing-predictions alerts already exist and execute.** Cron success classification is a distinct operational/product decision, not proof that health silently passes.

No implementation, database operation, production/provider request, deployment, installation, commit or shared-file edit was performed. This report is the sole saved deliverable. No fresh live serving-state assertion is made.

## Additional defects and strengthened repair contracts

### R1. Same-slate outcome leakage in default walk-forward replay — P1, research/backtest path

`accountability.ts:2998-3015` splits the sorted game array in half rather than splitting by an information boundary. In the non-blind branch, each replay outcome is appended to training immediately (`:4060-4067`); the default retrain cadence is one game (`:3796`), and retraining happens before the next replay game (`:4068-4077`). Ordering by start time does not mean the preceding game has finished before the next game's forecast cutoff. Initial training can also split a single date/slate.

**Executed counterfactual:** four synthetic games, two on Jan 9 for initial training and two distinct matchups starting Jan 10 at 23:00Z. Both replay forecasts claim a 22:00Z cutoff. All features are zero/missing; an explicitly supplied zero-weight initial model produces 0.5 for the first replay. Changing only that game's later result from an away win to a home win changes the second replay's prediction from 0.333998 to 0.666002. The outcomes and client are wholly in-memory; `persist:false`. This is outcome leakage, independently of source-table backfills.

The explicit `trainStartDate` + `blindDate` branch is better: it adds replay labels only from dates strictly before the simulation date (`:3923-3942`). Do not attribute the demonstrated non-blind bug to every historical run; Fable's stored v1–v4 configuration and exact cohorts were not re-read. The generic `workflow.ts:1343-1362` helper also splits same-date examples, but repository search finds only its test as a caller, so that helper is dormant rather than evidence of the active replay's implementation.

**Repair:** split/retrain at date/slate boundaries, or require the actual result-availability timestamp to precede the next forecast cutoff. Give all simultaneous forecasts the same trained artifact. Report training/validation game IDs and information cutoffs.

**Tests:** flip a future or simultaneous outcome and require every earlier-cutoff prediction to remain unchanged; permute games within a slate; ensure no initial split crosses an unresolved slate. Keep a separate test for the explicit blind-window branch.

### R2. Pregame labels are weaker than pregame evidence — P1, accountability and replay paths

- `finalPregamePredictions` uses `prediction_cutoff_at ?? computed_at` (`accountability.ts:1385-1402`). A backdated cutoff wins over a postgame publication time. Missing or invalid game start accepts all rows.
- **Executed:** cutoff Jan 10 22:00Z, game start 23:00Z, `computed_at` Jan 11 03:00Z is accepted as the final pregame candlestick. `workflow.ts:880-893` also accepts a post-date cutoff when start time is absent.
- Persisted payload validation checks version/game/date, not `prediction_cutoff_at`, publication or source availability (`accountability.ts:3107-3125`); the reader chooses latest `computed_at` among 20 rows (`:3134-3153`). **Executed:** a payload explicitly marked 23:30Z for a game starting 23:00Z is accepted when its date matches.
- Replay fetch can use a 16:00Z payload cutoff (`:3175-3180`) and later label its prediction one hour before start (`:3958-3971`, `:4028-4041`), without proving that the retained payload's information belongs to that cutoff. For an early game these orderings can even reverse.
- Concrete upstream problems remain: goalie rows use `created_at <= end-of-day`, not the prediction cutoff, and lines use `observed_at <= end-of-day` (`featureBuilder.ts:2764,2905-2922`). Current rosters (`:2969-2975`) and unbounded-time FORGE team rows (`:2950-2959`) are not historical membership/issuance evidence. FORGE proof admissibility is not by itself a proof of availability at this game's cutoff.

**Repair:** distinguish actually issued forecasts from retrospective reconstructions. For issued forecasts require immutable source/receipt cutoffs, publication/computation before the frozen game start, and known valid start time. For reconstructions prove historical source availability and retain the reconstruction label, rather than backdating publication. Select the latest eligible payload under the requested cutoff, with coherent row/payload identity. Unknown timing is not verified pregame evidence.

**Tests:** early cutoff with late publication; same-day late starter news; post-cutoff feature snapshot; unknown start; earlier eligible snapshot behind a later ineligible one; current roster changed after historical date. The fixture demonstrates eligibility gaps, not their production prevalence.

### R3. Recent-form support is not matched — P1, enabled recent-GD/xGF feature path

`sumNumbers` converts absent cells to zero (`featureBuilder.ts:907-912`). `summarizeRecentTeamRows` counts every row as a game and independently accumulates numerators and ice time (`:928-970`). GP=1 filtering (`:987-989`) establishes neither completeness nor matched support.

**Executed source-function fixtures:**
- Row A: GP=1, GF=4, GA=2, xGF=2, xGA=2, TOI=3600, points=2. Row B: GP=1, all those counts missing, TOI=3600. Output: GF/game=2, GD/game=1, xGA/60=1, point%=0.5. The single observed row supports 4, 2, 2 and 1 respectively; the full two-game quantities are unknown, not the lower numbers.
- One row with xGF=2 and xGA missing produces xGF share=1.0.

This is not only the already-noted latest-game percentage fallback. It can affect the default model's recent-5/10 GD and recent-10 xGF inputs (`baselineModel.ts:657-674`) if incomplete rows reach the builder. Current production frequency was not measured.

**Repair/tests:** define complete per-metric observation sets; use matching GF/GA support and matching xGA/TOI support; expose eligible versus observed games. Withhold incomplete full-window values or explicitly label a covered-subset estimate. Preserve genuine zeros. Test all-null, one-sided missing counts, valid zero counts and mixed coverage before recalibrating the model.

### R4. Odds bars can combine different sportsbooks — P2, active UI code with conditional input

GamePreview selects a preferred offer independently for each side (`components/GamePreview/GamePreview.tsx:93-99,211-226`); the stats page does the same (`pages/stats/game/[gameId].tsx:175-196`). With home offers from provider 9 and away offers only from provider 8, their prices are normalized as if they were opposite sides of one book. That is not removal of a single bookmaker's margin. No asymmetric live offer was inspected.

**Repair/test:** choose a common provider and the same market/time for both sides, then convert/de-vig the pair. If there is no complete pair, show unavailable or an explicitly labelled cross-book composite. Add mismatched-provider, invalid preferred offer, and missing-side fixtures. A shared scalar converter alone does not repair this issue.

### R5. The forecast route structurally omits the current lineup — P2, strengthens D6

The cron route always passes `sourceAsOfDate` (`pages/api/v1/game-predictions/forecast.ts:59-78`). `fetchGamePredictionFeatureInputs` interprets any explicit date as reason to exclude the target game from line-combination IDs (`featureBuilder.ts:2762,2834-2838`). `buildLineupFeatures` requires that target game's ID (`:1646-1654`), so this route's payload has no current lineup even when a current line exists in the database. Both absent lineups incur a total 0.06 dampening penalty (`baselineModel.ts:551-553`).

This is a source-selection design effect, not evidence that real lineups were unavailable. Keep historical reconstruction fail-closed; do not “fix” it by allowing today's lineup into historical forecasts. Separate current issuance from reconstruction and admit only genuinely pre-cutoff lineup evidence. Test equivalent explicit-date and default-date current requests against immutable fixture receipts.

### R6. Poisson boundary handling is not uniformly sound — P2, conditional edge cases

`lib/gameGoalProjections/utils.ts:8-13` and `components/GameGrid/utils/poisson.ts:3-8` correctly give P(0)=1 at lambda=0, but also silently give that result for negative or NaN lambda. The heat-map tie helper divides by zero when both lambdas are zero, then writes NaN diagonal cells (`poissonHelpers.ts:45-58`). The old chart's helper returns zero even for lambda=0 (`PoissonDistributionChart.jsx:8-14`), though its component rejects nonpositive lambdas before invoking it (`:46-68`).

**Repair/tests:** lambda=0 is a valid degenerate distribution; negative/nonfinite lambda is invalid and must stay unavailable. Test these separately, plus mass conservation and bounded truncation error for valid lambda. Do not adopt Fable's broad “lambda <= 0 returns the same value everywhere” invariant. The chart issue is dormant; the heat-map invalid-input risk is conditional, not a measured current user error.

## Corrections to Fable's conclusions and recommendations

### C1. D3 is dormant, not a second live P0

Repository-wide references to `PoissonDistributionChart` are its definition/export, the game-page import (`pages/game/[gameId].tsx:8`), and a test mock. There is no JSX or createElement use in the page. `chartData` is built at `:594-652`, used in the unused `isDataLoaded` calculation at `:655-681`, and never passed to the chart. Pregame rendering is `GamePreview` (`:714-740`). This is true in `5cff74faa`, not a later fix.

The legacy Game Grid path **is wired**: `components/GameGrid/TeamRow.tsx:348-351` and `VerticalMatchupCell.tsx` render the heatmap, which reads stored odds and generates its score matrix (`PDHC/PoissonHeatMap.tsx:148-172`). Keep the owner direction to fix or withhold those odds; no promotion of the placeholder is implied.

Fable correctly computes the distinction between splitting draw mass 50/50 and conditioning on non-draw outcomes. Conditioning is not an arithmetic error; displaying it as full-game win probability without an explicit overtime assumption is the problem. A regulation-score heatmap can legitimately retain diagonal draws while full-game moneyline includes OT/SO. Align the **target event and documented OT model**, not blindly force every display to have identical numbers. The heatmap's redistribution is a no-op for ordinary positive inputs, not a third effective win-probability algorithm. Dixon–Coles is a football low-score dependence model, not proof of the NHL tie rate or the right hockey correction; no new external reference or empirical NHL tie rate was verified here.

### C2. Health already detects the missing model

`adminHealth.ts:468-483` passes missing coverage to `buildPredictionHealthChecks` and explicitly emits `production_model_missing`. `workflow.ts:1497-1502` emits `missing_predictions`. The offline report with one scheduled game and no model/output returned both warnings (and a market-readiness warning). Existing `adminHealth.test.ts:227-233` also covers missing production model.

D1's observation that forecast cron records success can still be accurate: its handler deliberately calls no-production-model an expected skip and sets success from `failedGames===0` (`pages/api/v1/game-predictions/forecast.ts:86-94`). It also returns explicit status/counts. Decide whether to use a distinct withheld/skip status and public explanation, rather than treating an intentional model hold as a computation failure. Fable's recommendation to add the two already-existing alerts is unnecessary; actual monitoring consumption/notification of those alerts remains unverified.

The public calibration defect is separate and confirmed: evaluator writes `predictions` (`evaluation.ts:182-188`), summary reads `count` (`publicPredictions.ts:552-559`). An actual producer-to-consumer fixture returns null for a populated bin. This remains a real defect even though a no-production-model state prevents current public display.

### C3. Statistical claims exceed the supplied evidence

- The 85-game market comparison uses the last retained pre-start snapshot, reportedly **3.1 hours before start on average**. Call it that, not a verified closing line. `espnOdds.ts:560-563` reads an ESPN field named `close`; that field name does not establish that a particular stored value was the actual market close.
- The Game Grid rows were reportedly overwritten after games. Their proper scores are a retrospective diagnostic, not clean out-of-sample forecast performance or a release benchmark.
- A mean paired log-loss gap of 0.0043 on 369 games cannot be called “not distinguishable from zero” without per-game differences and their dependence structure. Equally, a 0.002 improvement threshold is not automatically valid evidence of superiority. **Uncertainty was not computed**, rather than “no skill exists.”
- Fixed 54% is a transparent benchmark, not the observed home rate fitted on the evaluation set. Learn deployable home-rate/Elo parameters only on prior data. Market and model comparisons need the same games and target cutoff; a later closing line is a useful separately labelled benchmark, not contemporaneous information for an earlier forecast.
- V1's poor scores and pinned probabilities do not alone establish that normalization caused the difference versus V2; freeze the other changes and perform an ablation before making that attribution.
- D8's proposed test that a perfectly calibrated synthetic forecast passes at **any** n above a minimum is incorrect for random outcomes: sampling error can make a truly calibrated forecaster fail a fixed empirical max-gap threshold. Test a deterministic exact-rate fixture and interval/coverage behavior separately. A single p=.85 miss reproduces a max gap=.85 but does not prove the model is miscalibrated.

### C4. Keep modeling recommendations conditional

The owner's fitted replacement with a home-ice term is the right direction, not an already validated model. Correlated inputs, multiple training configurations, clipping and shrinkage are not algebraic defects by themselves. Convergence failure in the xG training problem does not prove nonconvergence on these game examples. Add objective/gradient stopping diagnostics and tune on held-out dates.

D6 establishes post-calibration modification and hand-set penalties, not that removing dampening immediately improves predictions. Fit/validate the complete prediction pipeline and calibrate its final output (or explicitly validate a replacement without the multiplier). Stale observations for two teams can represent two genuine uncertainties; shared table identity alone does not prove a duplicate penalty. Deduplicate according to the intended evidence unit, not table name alone. A confirmed/unconfirmed indicator does not automatically let a linear model learn symmetric confidence shrinkage without suitable interactions or calibration.

The placeholder has zero direct weights for many inputs, but those inputs can still alter missingness/freshness/goalie penalties. “Weight zero” does not always mean “no effect on output.” D5's replacement should retain a reproducible artifact containing feature order, scaling, weights, intercept, calibrator, clipping/quality policy, cutoff policy, version and training manifest. Merely promoting an arbitrary registry version currently does not load it: generation defaults to the compiled version/model (`workflow.ts:914-916`) and checks **that exact identity** (`:836-842`). Promotion of a different version can leave the cron refusing to persist rather than quietly using the new model.

Home-ice >50% for identical teams is a proposed fitted-model behavior, not a universal mathematical identity. Allow a venue-disabled symmetry test and separately validate the learned home coefficient.

### C5. Odds and smaller scope qualifications

- There are six converter call sites listed in D9, **including** `devig.ts`. “Six plus a seventh de-vig library” is inconsistent with that list; do not claim a seventh without identifying it.
- The UI explicitly interprets unsigned strings as decimal prices. `"150"` is ambiguous without an input-format contract, rather than always a parsing defect. Declare American/decimal format at each source boundary. The invariant is parity for the **same typed price and method**, not identical answers for an untyped `1.91` or `"150"` across incompatible parsers. Normalize units too (fractions versus percentages).
- Proportional and Shin/equal-margin estimates can legitimately differ. Centralize validation/pairing while retaining explicit method choice. No live decimal-format failure is established.
- ExtraTrees' feature importance is nonnegative but `value * importance` can be negative; Fable's “unsigned contribution” wording is imprecise. The real issue is that it is not a local directional attribution. Bootstrapping is a documented variant/design choice; ignored sample weights are more consequential when comparing to the weighted logistic model. The current promotion evidence already blocks ExtraTrees for missing explanations (`accountability.ts:2027-2029`).
- Linear factors use **normalized** feature values (`baselineModel.ts:1275-1287`), not raw value times weight for fitted models. Their baseline is the model intercept at the training mean, not necessarily an even matchup; list only top five and omit intercept/calibration/dampening, so they are partial logit explanations.
- The SOS composite inputs are all nominally centered at 100 with scale 15 (`featureBuilder.ts:463-465`), not simply unlike numeric units. Their hockey meaning and upstream defects still require validation. The neutral-50 GD offset cancels in an unbounded home-minus-away difference; xGF-share offsets need not cancel at the clamp (`:1233-1240`).
- Start Chart grade exposure is conditional on native/legacy selection. Native/empty returns before the legacy calculations (`pages/api/v1/start-chart.ts:1196-1198,1226-1242`); no flag values or live response were inspected.
- M-GPR-037 is confirmed **dormant by repository caller search**, not mathematically undetermined merely because no production caller was found. Its 17 existing offline tests pass. That is not a completeness proof or permission to delete it.

## Per-entry disposition

This is a targeted peer-review disposition, not a new independent production certification for all 45 entries. “Agree” means inspected source supports the stated narrow claim; sample magnitudes remain Fable's.

| M-GPR | Disposition |
|---|---|
| 001 | Agree discontinuous heuristic baselines and no Elo; market exclusion from promotion floor is a policy choice, not invalid arithmetic. `accountability.ts:1354-1365,1568-1654,1897-1925`; C3. |
| 002 | **Downgrade sound: eligibility is wrong/incomplete.** R2; `accountability.ts:1385-1402`. Per-game aggregation itself is useful. |
| 003 | Agree correlation and empirical binned-MI arithmetic; diagnostic scores are not causal or held-out predictive importance. `baselineModel.ts:352-409`. |
| 004 | Agree issuance weighting and no final-state enforcement; formulas are sound on eligible observations. `workflow.ts:1297-1315`, `evaluation.ts:91-161,438-462`; R2. |
| 005 | **Wrong in default non-blind replay.** R1/R2; explicit blind-date mode must be distinguished. |
| 006 | Agree imputation/scale concerns, but standardization itself is already part of candidate training. `baselineModel.ts:279-281,578-638,641-795`. |
| 007 | Preserve uncertainty about roster-rating centering; additionally raw xGF share is definitively uncentered at zero before unequal weights. `featureBuilder.ts:1670-1678,2049-2053`. This is a modeling hypothesis, not a validated prior. |
| 008 | Agree phase convention; source GP validity remains upstream. `featureBuilder.ts:1734-1763`. |
| 009 | Arithmetic is sound for genuine prior played games. Source query and helper do not require final state, so postponements/unplayed prior dates remain conditional defects. `featureBuilder.ts:828-852,2792-2799`. |
| 010 | Agree inherited rating defects, nonzero direct weights; reported logit contribution sizes not remeasured. `featureBuilder.ts:855-875`, `workflow.ts:51-54`. |
| 011 | **Strengthen to wrong under partial support**, not merely unshrunk windows. R3; `featureBuilder.ts:907-970`. |
| 012 | Agree roster-average versus expected-starter distinction; historical current-roster fallback also lacks as-of membership. `rosterImpact.ts:101-126`, `featureBuilder.ts:2969-2975`; R2. |
| 013 | Agree incomplete-mass renormalization/unknown GSAA issues; confirmation can affect dampening despite zero quality weight. `featureBuilder.ts:1424-1464`, `baselineModel.ts:516-539`; R2/C4. |
| 014 | Slot completeness protections exist; “unlike scales” is too broad. Final-game eligibility still absent. `featureBuilder.ts:1124-1221`; C5. |
| 015 | Neutral-50 compatibility is explicit. Cancellation applies to unclamped GD differences, not all xGF-share cases. `featureBuilder.ts:1224-1241`; C5. |
| 016 | Agree normal-input tie redistribution no-op; add both-zero NaN case. Active heatmap uses stored win odds separately. R6/C1. |
| 017 | Agree no venue term, 50/50 draw convention and upstream issues; market averaging code is conditional, not proven permanently dead by 0/274 observations. `calculations.ts:32-107,188-210`; C3. |
| 018 | Agree in-sample calibration and inherited isotonic tie bug; calibrating before post-hoc dampening also changes the evaluated mapping. `accountability.ts:3251-3275,3298-3307`; C4. |
| 019 | Agree labeled season weights for logistic training. `accountability.ts:372-383,3205-3208`. |
| 020 | Agree ignored weights and false attribution, qualify algorithm-variant wording and already-blocked promotion. `baselineModel.ts:951-986,1323-1341`; C5. |
| 021 | Sound partial additive logit components, not a complete probability explanation or necessarily an even-matchup baseline. `baselineModel.ts:1268-1292`; C5. |
| 022 | Agree inconsistency of a named winner with the larger probability at .50–.52. Threshold change is not a fitted probability repair. `baselineModel.ts:1565-1599`. |
| 023 | Agree unvalidated quality transform; removing it is a candidate to validate, not an immediate statistical cure. `baselineModel.ts:498-576,1544-1555`; R5/C4. |
| 024 | Agree training-only weighted population moments for finite, nonnegative, positive-total weights. `baselineModel.ts:578-638`. |
| 025 | Agree convergence instrumentation and artifact loading needed; xG failure is not proof of game-model nonconvergence. `baselineModel.ts:893-908`; C4. |
| 026 | Agree owner-defined placeholder and exact-identity gate. No live registry reread. `workflow.ts:48-71,817-849,914-916`. |
| 027 | Formula correct for valid typed American odds, validation weaker than shared devig helper. ESPN close semantics remain unverified. `espnOdds.ts:474-523,560-563`; C3/C5. |
| 028 | Agree threshold/calibration and noisy fixed-score-gate concerns; add R1 before interpreting any passing backtest gate. `workflow.ts:1375-1476`. |
| 029 | Agree comparison to .5. Actual live output availability is reported, not observed here. `HomepageGamesSection.tsx:263-268`. |
| 030 | Slate-relative rank requires honest labeling; actual legacy branch exposure conditional. C5. |
| 031 | Shared typed odds parsing is useful; add sportsbook-pair identity and keep missing unavailable. R4/C5. |
| 032 | Agree differently thresholded model/baseline audit needs disclosure; script's dated empirical scope is not general performance evidence. `scripts/audit-game-prediction-team-form.ts:104-143`. |
| 033 | Algebraic complementary-probability check is vacuous for calibration, but useful for stored-contract integrity. No new DB checks run. |
| 034 | Calibration summary wrong; **health absent-model claim refuted** by actual execution. C2. |
| 035 | ES+PP is a partial modeled total; SH omission belongs to the upstream FORGE total contract. No source-clock proof in latest-row selection. `featureBuilder.ts:1276-1307`; R2. |
| 036 | Agree coarse 14-day policy; per-side cutoff counting requires a documented evidence unit, not automatic deduplication by table. `featureBuilder.ts:749-766,2178-2242`; C4. |
| 037 | Dormant; only its tests import it. Seventeen pass, no claim of complete mathematical certification. C5. |
| 038 | Agree TOI>=1200 is not a credited start, and team filter loses pre-trade personal workload. `featureBuilder.ts:1560-1577`. Context-only direct use does not validate labeling. |
| 039 | Dormant component with poor matchup interpretation and conditional-win target, not live P0. C1/R6. |
| 040 | Agree weighted Laplace prior and convex blends for their stated domains; not validation of predictive value. `accountability.ts:880-893,3409-3436`. |
| 041 | Same typed parsing/provider-pair issue as 031; **this is the rendered pregame surface**. R4/C1. |
| 042 | Correct strict capture cutoff for known valid clocks; missing start falls open at `featureBuilder.ts:1790`. Capture provenance and frozen event time still matter. R2. |
| 043 | Poisson PMF correct only on valid domain; NaN/negative are silently reinterpreted. R6. |
| 044 | Agree small-segment noise concern; complete paired cohorts and R1/R2 timing repairs precede promotion decisions. `accountability.ts:1927-2062`. |
| 045 | Same dormant component as 039; no separate live surface established. C1. |

## Repair order and acceptance

1. Preserve the current model hold until the owner decides presentation. Do not bootstrap the placeholder or switch Game Grid to it. Explain withheld output and route status using existing health evidence.
2. Fix outcome finality, one-issuance-per-game selection, source/receipt/publication clocks, paired support, and same-slate replay leakage. Paginate both scoring history and completed-season game reads (`accountability.ts:2595-2604` also has no pagination), with deterministic ordering and coverage counts.
3. Resolve typed odds formats/provider pairing and intended regulation/full-game targets. Keep the dormant chart dormant until qualified; no deletion follows from this review.
4. Fit and validate the owner's replacement on a frozen local dataset with pre-cutoff lineage, a training-only home baseline, separately labeled market/Elo references and untouched final holdout. Account for repeated model selection and date/slate dependence.
5. Serialize and load the actual promoted artifact, then replay a prediction from stored inputs to verify identical probability/pick/explanation. Validate every consumer and effective serving branch before claiming the replacement is live.

Outstanding owner choices remain the withheld-model presentation, desired Poisson OT convention, whether to expose market odds while withheld, and whether to change the pick rule separately. A choice to revive the old chart is not required to finish this audit. Existing owner decisions already require a fitted home-term replacement and forbid substituting the placeholder for Game Grid.

## Verification and limits

**Passed:** Node v22.23.4; from `web/`, `npm test -- --run lib/game-predictions/accountability.test.ts lib/game-predictions/adminHealth.test.ts lib/game-predictions/baselineModel.test.ts lib/game-predictions/evaluation.test.ts lib/game-predictions/publicPredictions.test.ts lib/game-predictions/teamGameNormalization.test.ts lib/game-predictions/workflow.test.ts lib/game-predictions/espnOdds.test.ts`: **8 files, 117 tests**. The selected tests use pure functions or mocked requests/clients. Passing tests do not cover the new counterexamples.

**Passed:** offline actual-source fixtures for R1, R2, R3, duplicate scoring, public calibration schema mismatch, health alerts and singleton calibration gap. The first standalone harness attempt refused an unlisted built-in `crypto` import; after explicitly permitting that pure builtin it completed. No application error or external access occurred. The reproducible fixture below retains the important counterexamples in this sole artifact; its final run passed 16 assertions, including the two distinct-team simultaneous-game replays.

**Inspected:** audit, owner decisions, Wave-1 prompt/triage, Batch-A consolidation and relevant prior team/goalie reviews, packet entries, primary feature/model/evaluation/serving/odds implementations and focused tests. No browser screenshot/render, fresh database snapshot, production/provider read, live flag check, statistical refit or reproduction of Fable's 85/49/369-game metrics was performed. No application test suite, typecheck or build was needed for this report-only change.

Fable's original audit cannot be called complete against its empirical benchmark brief: no like-for-like placeholder market benchmark, verified closing-price cohort, Elo benchmark, paired intervals or reproducible source extract was supplied. The fixes above are recommendations, not authorization to implement or deploy.

## Reproducible offline counterexamples

Run from `web/`. This script reads local TypeScript only, uses a private in-memory loader with an empty environment, denies network/client access, and never persists model output. Its appended exports expose existing pure private helpers in memory without modifying application files. The two replay matchups use distinct teams.

<!-- BEGIN OFFLINE FIXTURE -->
```javascript
const fs = require('fs'), path = require('path'), vm = require('vm');
const ts = require('typescript'), assert = require('assert/strict');
const root = process.cwd(), cache = new Map();
function load(id, from = root + '/fixture.ts') {
  if (id === 'lib/supabase/server') return { __esModule: true, default: null };
  if (id === 'crypto' || id === 'node:crypto') return require('crypto');
  const p = /^(lib|components)\//.test(id)
    ? path.join(root, id) : path.resolve(path.dirname(from), id);
  const f = [p, p + '.ts', p + '.tsx', p + '.js'].find(x =>
    fs.existsSync(x) && fs.statSync(x).isFile());
  if (!f) throw Error('Unapproved import: ' + id);
  if (cache.has(f)) return cache.get(f).exports;
  const m = { exports: {} }; cache.set(f, m);
  let source = fs.readFileSync(f, 'utf8');
  if (f.endsWith('/featureBuilder.ts')) source +=
    '\nexport { summarizeRecentTeamRows, adjustXgfPctForOpponentQuality };';
  const code = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  }}).outputText;
  vm.runInNewContext(code, {
    module: m, exports: m.exports, require: x => load(x, f),
    console, process: { env: {} }, Date, Map, Set,
    fetch() { throw Error('NETWORK FORBIDDEN'); },
  }, { filename: f });
  return m.exports;
}
const A = load('lib/game-predictions/accountability');
const F = load('lib/game-predictions/featureBuilder');
const B = load('lib/game-predictions/baselineModel');
const E = load('lib/game-predictions/evaluation');
const W = load('lib/game-predictions/workflow');
const H = load('lib/game-predictions/adminHealth');
const P = load('lib/game-predictions/publicPredictions');
const PMF = load('lib/gameGoalProjections/utils');
const Heat = load('components/GameGrid/utils/poissonHelpers');
let checks = 0;
function check(value) { assert.ok(value); checks++; }
const teams = ['BOS', 'MTL', 'TOR', 'OTT'].map((abbreviation, i) =>
  ({ id: i + 1, abbreviation, name: abbreviation }));
const games = [1, 2, 3, 4].map(id => {
  const date = id < 3 ? '2026-01-09' : '2026-01-10';
  return { id, date, startTime: date + 'T23:00:00Z', seasonId: 20252026,
    homeTeamId: id % 2 ? 1 : 3, awayTeamId: id % 2 ? 2 : 4, type: 2 };
});
const payloads = games.map(game => F.buildGamePredictionFeatureSnapshotPayload({
  game, sourceAsOfDate: game.date, predictionCutoffAt: game.date + 'T22:00:00Z',
  homeTeam: teams[game.homeTeamId - 1], awayTeam: teams[game.awayTeamId - 1],
  priorGames: [], teamPowerRows: [], standingsRows: [], wgoTeamRows: [],
  nstTeamGamelogRows: [], teamCtpiRows: [], goalieStartRows: [],
  lineCombinationRows: [], linesCccRows: [], goaliePerformanceRows: [],
  forgeGoalieGameRows: [], wgoGoalieRows: [],
}));
const featureSetVersion = payloads[0].featureSetVersion;
const payloadCache = new Map(payloads.map(p =>
  [`${featureSetVersion}:${p.gameId}:${p.sourceAsOfDate}`, p]));
function client(firstReplayHomeWon) {
  return { from(table) {
    if (!['games', 'teams', 'pp_timeframes', 'pbp_games'].includes(table))
      throw Error('Unapproved table: ' + table);
    const rows = table === 'games' ? games : table === 'teams' ? teams :
      table === 'pbp_games' ? [] : games.map(g => ({
        game_id: g.id, home_team_id: g.homeTeamId, away_team_id: g.awayTeamId,
        home_team_score: g.id === 1 || (g.id === 3 && firstReplayHomeWon) ? 4 : 1,
        away_team_score: 2,
      }));
    let q; q = new Proxy({}, { get(_, key) {
      if (key === 'then') return resolve => resolve({ data: rows, error: null });
      if (['select', 'eq', 'order', 'in'].includes(key)) return () => q;
      throw Error('Unapproved query method: ' + String(key));
    }}); return q;
  }};
}
(async () => {
  const secondProbabilities = [];
  for (const flip of [false, true]) {
    const result = await A.runWalkForwardBacktest({
      client: client(flip), seasonId: 20252026, payloadCache, featureSetVersion,
      persist: false, retrainCadenceGames: 1, disableDataQualityDampening: true,
      initialModel: { featureCount: B.BASELINE_FEATURE_KEYS.length,
        weights: B.BASELINE_FEATURE_KEYS.map(() => 0), bias: 0 },
    });
    check(result.persisted === false);
    secondProbabilities.push(result.candles.find(c => c.gameId === 4).finalHomeWinProbability);
  }
  check(secondProbabilities[0] === 0.333998 && secondProbabilities[1] === 0.666002);
  const game = games[2], outcome = {
    gameId: 3, homeTeamId: 1, awayTeamId: 2, homeScore: 3, awayScore: 1, homeWon: true,
  };
  const pred = {
    prediction_id: 'late-published', game_id: 3, snapshot_date: game.date,
    prediction_cutoff_at: '2026-01-10T22:00:00Z', computed_at: '2026-01-11T03:00:00Z',
    home_team_id: 1, away_team_id: 2, home_win_probability: .51, away_win_probability: .49,
    predicted_winner_team_id: 2, metadata: {},
  };
  const candle = A.buildPredictionCandlestick({ predictions: [pred], game, outcome });
  check(candle !== null);
  const latePayload = { ...payloads[2], predictionCutoffAt: '2026-01-10T23:30:00Z' };
  check(A.persistedFeatureSnapshotRowToPayload({
    row: { game_id: 3, feature_payload: latePayload, metadata: {},
      prediction_cutoff_at: latePayload.predictionCutoffAt, computed_at: pred.computed_at },
    featureSetVersion, sourceAsOfDate: game.date,
  }) !== null);
  check(W.isPregamePredictionCutoff({ game: { ...game, startTime: null },
    predictionCutoffAt: pred.computed_at }));
  const summary = F.summarizeRecentTeamRows([
    { gp: 1, gf: 4, ga: 2, xgf: 2, xga: 2, toi_seconds: 3600, points: 2 },
    { gp: 1, gf: null, ga: null, xgf: null, xga: null, toi_seconds: 3600, points: null },
  ]);
  check(summary.goalsForPerGame === 2 && summary.xgaPer60 === 1 && summary.pointPct === .5);
  check(F.summarizeRecentTeamRows([{ gp: 1, xgf: 2, xga: null }]).xgfPct === 1);
  const evaluated = E.attachOutcomesToPredictions([pred, { ...pred, prediction_id: '2' },
    { ...pred, prediction_id: '3' }], [outcome]);
  check(evaluated.length === 3);
  const version = { model_name: 'm', model_version: 'v', feature_set_version: 'f', status: 'production' };
  const publicPayload = P.buildPublicGamePredictionsPayload({ outputs: [], modelVersions: [version],
    metrics: [{ ...version, segment_key: 'overall', segment_value: 'all', computed_at: '2026-01-11',
      calibration: E.buildCalibrationBins(evaluated) }],
  });
  check(publicPayload.performance.calibrationSummary === null);
  const alerts = H.buildGamePredictionHealthReport({ productionModel: null,
    scheduledGames: [game] }).alerts.map(a => a.code);
  check(alerts.includes('missing_predictions') && alerts.includes('production_model_missing'));
  const gap = A.calibrationMaxGapFromBuckets(A.buildConfidenceCalibrationBuckets([
    { ...candle, finalHomeWinProbability: .85, predictedWinnerCorrect: false },
  ]));
  check(gap === .85);
  check(PMF.poissonProbability(0, NaN) === 1 && PMF.poissonProbability(0, -1) === 1);
  check(Number.isNaN(Heat.generateProbabilityMatrixWithTieBreaker(0, 0)[0][0]));
  const adjustedDifference = F.adjustXgfPctForOpponentQuality(.99, 100)
    - F.adjustXgfPctForOpponentQuality(.94, 100);
  check(Math.abs(adjustedDifference - .01) < 1e-12);
  const page = fs.readFileSync(path.join(root, 'pages/game/[gameId].tsx'), 'utf8');
  check(page.includes('import PoissonDistributionChart') && !page.includes('<PoissonDistributionChart'));
  console.log(JSON.stringify({ checks, secondProbabilities, alerts, gap,
    partialSupport: summary, adjustedDifference }, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
```
<!-- END OFFLINE FIXTURE -->
