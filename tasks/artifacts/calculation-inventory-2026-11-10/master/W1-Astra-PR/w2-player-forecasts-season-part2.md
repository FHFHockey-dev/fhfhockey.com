# Independent peer review: W2 player forecasts, season part 2

Reviewed 2026-11-11 in `/Users/tim/Code/fhfhockey.com` on `octoberBranch`. Audit commit: `76b25fb8fb60e6cde12b4cd2a5634e83ff1eadf1`. The implementation paths inspected below had no diff from that commit. This is an addendum to [Fable’s part-2 audit](../audits/player-forecasts-season-part2.md), not a replacement or an endorsement of its 7/25/11/17 totals.

Read with the [Wave 2 assignment](../wave2-prompts/w2-7-player-forecasts-season-part2.md), [owner decisions](../OWNER-DECISIONS.md), [prior season Astra review](player-forecasts-season.md), and [part-3 Astra review](w2-player-forecasts-season-part3.md), which owns the fuller ledger-population analysis.

## Assessment

**Keep the placeholder-label, improper mean-score, training/serving mismatch and UTC-date findings. Strengthen the label findings with producer evidence, qualify the GLM conclusions, and close the 17 unread entries before using this audit as a fix plan.**

Key changes: producer proof strengthens the placeholder/EN findings; actual-function fixtures confirm mean-score and GLM concerns with narrower claims; v4 disables context on replaced heads; unread entries 110/120 contain new defects. Engineering publication checks do not establish model calibration.

### Evidence limits

- Direct evidence: source-to-consumer traces and synthetic executions below; **217 focused TypeScript tests passed**.
- Fable’s empty release/catalog tables, 11,547 ledger rows, 5,544 placeholder rows, 97-game EN comparison and 2,688-team-game B2B counts are **reported snapshots only**. No production extracts or original synthetic scripts were retained with its audit; its query descriptions are not complete SQL. These magnitudes were not reproduced here.
- `web/lib/fantasy-projections/queries.ts:98–120` needs an active release pointer and matching release; `web/lib/player-forecasts/forecastServingSource.ts:59–78` needs a valid unexpired native catalog selection. This corroborates the consequence of an empty snapshot, not current deployment state. Approximate table statistics cannot prove artifact absence.
- No new currently served P0 established. Season defects block activation on the reported inactive snapshot. Ledger and ingestion are live-capable; manual native modules do not establish a running scheduler.
- No DB/application/provider requests, deployments, dependency installs, commits or application edits. Temporary fixture files were outside the repository and removed.

Abbreviated Python filenames below are under `modeling/player_forecasts/`; TypeScript filenames are under `web/lib/player-forecasts/`, except `historicalQualification.ts` under `web/lib/forecast-diagnostics/`.

## 1. Label defects: now traceable to their producers

**M-PFC-111/100, Fable D1. P1 before a season release; ingestion producer is active-capable.**

### Placeholder zeros

`web/pages/api/v1/db/update-stats/[gameId].ts:613–675` normalizes every boxscore skater. Lines **669–672** explicitly set `faceoffs="0/0"`, `powerPlayToi="00:00"` and `shorthandedToi="00:00"`. They do not copy verified zeros from a provider. The caller passes these rows to `persistCompleteGameStatsTransaction` at `:424–446`; `web/lib/cron/transactionalGameStatsPersistence.ts:437–445` passes them as `p_skater_rows` to the transactional persistence RPC. Completeness of a row manifest does not mean completeness of its statistical fields.

`modeling/player_forecasts/season.py:397–410,440–444` parses those strings into PP/PK TOI and faceoff zeros, and assigns all total TOI to EV. The faceoff SQL correctly subtracts won from taken for **valid** won/taken inputs; that does not rescue fabricated `0/0`. These are base targets (`:28–33`), while `_fantasy_metric_source_audit` only covers the extra v4 targets and counts non-null as observed (`:912–925`). The statistical selection then accepts the zero values (`:1607–1615,2195–2205`).

For v3/game-row serving this directly contaminates estimates. In v4, season-total TOI and scoring replacements reduce some mean contamination, but inherit the policies fitted from these rows. Faceoffs are **not** among the replacement heads (`:62–72`). This does not establish full-season error magnitude.

**Remedy/test:** preserve field-level missingness through ingestion and modeling. Verify exact PP/PK seconds and faceoffs on independently known frozen games; extend coverage to base targets and provenance. Do not reject a genuine all-zero history merely for being zero. Historical repair requires separate approval.

### Empty-net and shootout classification

The previously unverified semantics are visible in `web/lib/supabase/Upserts/nhlRawGamecenter.mjs:78–122`: `buildStrengthState` returns `EN` whenever **either** goalie flag is zero, before the EV/PP/SH branch. `normalizePbpEvents` persists both goalie flags and event owner, but defines `is_goal` solely from `typeDescKey === "goal"` (`:703–725`).

Actual normalizer fixture: situation `1560`, home team scoring, away goalie present and home goalie absent, returns `strength_state="EN"`. This is an extra-attacker goal **against a goalie**, not an empty-net goal. A synthetic goal with `periodType="SO"` also returns `is_goal=true`. `season.py:208–220` counts both without excluding shootouts; `:286–289` compares the PBP count with boxscore goals, and `:453–457` treats the EN state as empty-net scoring. The mechanism is source-proved independently of Fable’s reported +35% sample discrepancy.

**Remedy/test:** separate opponent-net-empty, own-net-empty and official strength; exclude SO goals/assists. Test both pulled-goalie directions, PP/SH with a goalie pulled, and a shootout. Do not infer official advantage solely from six skaters or overwrite conflicts to force agreement.

## 2. Proper mean scoring: retain the defect, correct the claims and tests

**M-PFC-066/078/079; add 082. P1 for season/accountability activation, P2 for the finite research pilot.**

`season.py:2192–2209` minimizes validation MAE over decay/shrinkage, and `:2341–2369` selects family and a 0.1% lift by the same loss. MAE elicits a median; squared error elicits a mean. The source already calculates squared error in `web/lib/player-forecasts/settlement.ts:155–165`, but its displayed composite uses a clipped per-row ratio of absolute errors (`:171–180`). The accountability candle just summarizes that upstream number; it does not fix its meaning.

**Independent analytic example, Y ~ Poisson(0.2):**

| Forecast | Expected MAE | Expected squared error | Expected current composite vs baseline 0.19 |
|---|---:|---:|---:|
| 0 | 0.200000 | 0.240000 | 88.926283 |
| true mean 0.2 | 0.327492 | 0.200000 | 47.951248 |

Summed Poisson probabilities through 19. Actual `scoreForecast` confirms zero forecast/outcome scores 100 against 0.19. This is an independent example, not Fable’s 600-player experiment; 0.19 is close to, not exactly, the true mean.

**Corrections:**

- Replace “any candidate that biases low wins” with the rare-count/median mechanism. Reducing a prediction can worsen MAE; an individual finite validation sample can also favor a non-mean predictor by chance.
- A perfect baseline does **not** imply a 0-or-100 score. Actual=baseline=forecast=0 gives **50**, confirmed by execution. A nonzero error against that perfect baseline clips toward 0. Near-zero baseline errors make the per-row ratio unstable.
- Aggregating a proper loss first matters. Averaging ratios with realized, outcome-dependent denominators is not equivalent to `1 − sum(loss)/sum(baseline loss)`.
- `forge_walk_forward.py:392–425,945–946` also chooses its mean method and reports paired improvement using MAE. Its chronology, frozen comparisons and cluster bootstrap can be internally correct while its primary mean-selection criterion conflicts with decision 65. Keep the issued historical pilot intact; change the criterion in a new disclosed experiment rather than retroactively relabelling its selection as proper mean validation.

**Remedy/test:** select on proper loss with a common population, chronological holdout and paired game/slate uncertainty; retain MAE secondarily. Verify expected-loss optimality analytically or with a pre-specified powered simulation, not guaranteed wins in each sample. Zero aggregate baseline loss makes skill unavailable, not the individual losses.

## 3. GLM: circular fitting is real, but it is not proof of future-label leakage or a universal slope bound

**M-PFC-076/077/080, Fable D3. P1 modeling concern before activation.**

`season.py:1994–2028` creates one weighted response per player from the same history used to calculate its EB feature. With equal support n, the EB input is `(n*m + k*prior)/(n+k)` while the response is m. The fitting objective therefore rewards recovering the noisy raw mean from its shrunk transform, rather than predicting an independent future mean. The log link and exposure-offset algebra at `:1972–1974` are valid; the target construction is the issue. The NB and hurdle branches repeat the same-history feature/response construction (`:2040–2057,2100–2133`).

**Executed actual-function diagnostic:** 200 players, each with 40 independent Poisson observations; latent rate drawn Gamma(shape=2.2, scale=0.17/2.2); constant TOI=900; seed=20261111; decay=1. This is not Fable’s fixture or a production estimate.

| k | fitted log-EB slope | EB RMSE against latent rates | GLM RMSE | raw-mean RMSE |
|---|---:|---:|---:|---:|
| 5 | 1.138761 | 0.061310 | 0.067305 | 0.066390 |
| 20 | 1.483943 | 0.061198 | 0.069689 | 0.066390 |
| 40 | 1.863161 | 0.069701 | 0.070838 | 0.066390 |

This reproduces stationary de-shrinkage, not universal GLM inferiority or future-label leakage. `_weighted_summary` respects cutoff (`:1605–1606`); later-row validation can reject the GLM. Those selection folds are not untouched performance evidence, and slope >1 is not intrinsically wrong.

NB dispersion is not proven necessarily understated: `:1966` clips each residual contribution at zero **before** summation, countering the simple residual-shrinkage argument. Direction/magnitude remain unestablished. A binary hurdle’s positive stage is redundant (outcome=1), but its probability stage remains meaningful.

**Remedy/test:** train with cutoff-separated feature/outcome windows and declared exposure/penalty units. Compare proper loss with EB on held-out dates and known-rate simulations with heterogeneous support/changing roles. Neither slopes ≤1 nor GLM dominance in every draw is a valid universal acceptance test.

## 4. V4 exposure overwrite: real evidence mismatch, with important scope limits

**M-PFC-074/073 and D4/D7. P1 activation blocker; dormant on the reported snapshot.**

The trace is explicit:

1. `season.py:3113–3130` fits game-row policies and stores their validation results.
2. `:3136–3174` fits season-total exposure summaries using the selected game-row decay and shrinkage. It retains the old policy fields and **does disclose** `servingRateBasis="recency_weighted_exposure_empirical_bayes"`.
3. `:3343–3365` replaces both candidate and baseline rates and rescales the pre-existing variance by a bounded rate ratio. TOI and the ten mapped scoring heads are overwritten at `:3387–3406`.
4. `:3373–3384` explicitly disables their game-row age, B2B and venue context effects because the source semantics differ.

Final means/uncertainty differ from the validated predictor: an **evidence-to-served-model mismatch**, not undisclosed identity or proof every final number is incorrect.

`_weighted_exposure_summary` uses weighted games for shrinkage support (`:1647–1658`). Actual-function fixture: two players each have 20 GP, but PP exposure is 60 versus 15,000 seconds. Both return support **20**, so with k=20 both get the same 50% player/prior weight despite 250-fold exposure difference. A games-based reliability model can be declared, but it is not automatically the exposure-based Gamma-Poisson posterior suggested by the rate’s denominator and needs validation.

A missing cutoff parameter does not preclude evaluation: callers can prefilter. **This path does not evaluate the replacement predictor.** The 2025–26 `_season_age` anchor is not alone leakage either: moving it rescales weights/effective k. D7’s real mismatch is intra-season validation with target-season history versus season-ahead serving without it.

**Remedy/test:** evaluate the complete serving function (season totals, replacements, reconciliation, context resets) from cutoff-valid inputs. Tune in declared units and bind each head to its own evaluation. Changing replacement inputs must change both served predictions and their evaluation. Decision 39 already settles consumed-lockbox and uncalibrated labels.

## 5. UTC back-to-backs: correct source finding, conditional forecast impact

**M-PFC-102, Fable D4b. P1 before affected context-enabled models activate.**

Training annotates rest from `game_date` (`season.py:1665–1688`). `_schedule_contexts_by_team` instead calls `.date()` on `scheduled_start_at` without converting to the agreed game-date basis (`:4166–4178`). A UTC offset in the stored timestamp therefore changes the result.

Actual-function examples, interpreted in America/New_York:

- Starts `2026-11-01T00:00Z` and `2026-11-02T20:00Z`: official/local dates Oct 31 and Nov 2, **not** a B2B; function returns true because UTC dates are Nov 1 and Nov 2.
- Starts `2026-11-01T23:00Z` and `2026-11-03T00:00Z`: local dates Nov 1 and Nov 2, **are** a B2B; function returns false because UTC dates differ by two.

The flag reaches schedule projections and `_target_multiplier` (`:3849–3868,4090–4119,4369`), but its numerical impact requires a non-unit context multiplier. V4 exposure-replaced heads reset that multiplier to 1. Do not multiply Fable’s 271 false/84 missed flags into an invented forecast-error rate, or describe all v4 TOI/scoring heads as affected.

**Remedy/test:** carry authoritative game dates through both paths; define first-game/postponement behavior. Test these examples, DST and ordinary B2Bs. The count 377 needs its frozen input/hash, not a permanent assertion.

## 6. Ledger controls: distinguish naive benchmark choices from missing-data invention

**M-PFC-097, Fable D6. P1 for comparable evaluation; live-capable.**

`web/lib/player-forecasts/servedForecastLedger.ts:143–160` issues skater means conditional on appearance with participation forced to 1, and goalie start-conditioned historical means times a start share. The goalie source named `naive_last5` actually uses ten starts and ten team games. It substitutes 0.5 when team win is absent and uses start share × team win as goalie win.

**Executed builder fixture:** ten consecutive team games, the goalie starts all ten, saves 10 in the older five and 30 in the latest five, no team-win input. `naive_last5` emits saves **20**, start probability **1**, win probability **0.5**. A genuine last-five conditional saves mean is 30. This verifies both the label error and fabricated win fallback without production reads.

Naive controls need not have sophisticated shrinkage; their naming, conditioning and comparison population must be honest. Team win × start share is not official goalie win when relief/credit differ. Nulling missing team-win data alone does not satisfy decisions 38/63.

Consumers: `scoreLedger` filters count/FP errors to `dressed===true` (`:396–424`); `scorePairedLedger` does likewise (`:487–504`). The API reads settled rows and calls both (`web/pages/api/v1/forge/scoreboard.ts:42–70`). These comparisons mix unconditional bridge/goalie counts with conditional skater controls unless the estimands are explicitly reconciled. Binary win/SO/start scores already use all known settled events (`servedForecastLedger.ts:417–418`), not the dressed-only count filter.

As [part 3](w2-player-forecasts-season-part3.md) demonstrates, missing WGO rows are **not DNP proof**. Neither row counts nor other players’ presence establish identity-complete outcomes. The claimed “12% high over the full set” is unproven zero-imputation. Receipts can establish known false events, but do not repair the separate dressed-only count filter. There is no equivalent binary-filter bug.

**Remedy/test:** name/version L10 honestly or implement L5; persist basis/population and unknown wins. Compare like estimands on common issued keys, testing starter, relief, proven nonparticipant and unresolved candidate. Report unresolved coverage, not an assumed bias direction.

## 7. New finding from unread entry 110: the assist-label gate is downstream of contaminated history

**M-PFC-110. Wrong; P2 research defect. Not proof of a currently served challenger.**

`modeling/player_forecasts/challenger_freeze.py:52–55` coalesces missing legacy PBP assist decomposition to zero and marks completeness only when A1+A2 equals official assists. That equality gate is useful. But `challenger_features.py:128–146` inserts **all** row outcomes into player, position, season, team and opponent histories. `_row_outcomes` also turns missing split fields into zero (`:85–95`). Only later, at `:225–228`, does it skip an incomplete A1/A2 **outcome row**. The contaminated history is already available to future direct split forecasts and decomposed assist features (`:220–224`).

**Executed full local feature-builder fixture:** one skater, two consecutive games. Game 1 has two official assists, A1=0/A2=0 because the split is unavailable, completeness=false. Game 2 has one verified A1, completeness=true. At game 2’s pregame cutoff:

- total-assist `career_rate` = **2**;
- A1 `career_rate` = **0**, `history_count` = **1**;
- total-assist `decomposed_sum_career_rate` and `play_driver_70_30_career_rate` = **0**.

The exclusion count rises by two while the same row remains observed zero history.

**Remedy/test:** gate each affected history before insertion, preserving valid total assists independently. Missing split history must remain unknown or use a labelled fallback. Extend the fixture with a verified zero-assist game and valid split game; retain genuine zeros. Repair does not qualify the research branch for promotion.

## 8. New finding from unread entry 120: PIM units change with representation

**M-PFC-120. Wrong; P2 conditional consumer defect.**

`web/lib/player-forecasts/baselineGeneration.ts:97` correctly labels PIM as minutes. `planningContributions.ts:195–199` also labels detailed PIM as minutes when it constructs a contribution. But `gameExpectations.ts:89,202` labels a raw detailed forecast PIM as **count** because its fallback handles only goalie minutes and TOI. `:195–204` then refuses aggregate totals across inconsistent units.

**Executed actual resolver/view fixture:** two scheduled games for one valid skater, 2 PIM expected per game. The first forecast is legitimately resolved through `resolvePlanningContributions`; the second retains the valid raw detailed representation. With no rate catalog supplied to the subsequent view, both forecasts remain admitted. Their expected PIM values are 2 and 2, units `minutes` and `count`, and the horizon total is:

`expected=null, coveredSum=null, coveredGames=2, requiredGames=2, unit=null, reason="incompatible_units"`.

All-raw emits 4/count. This is executed consumer behavior, not just a type mismatch; production incidence is unmeasured.

**Remedy/test:** centralize target units across representations, missing heads and totals; PIM is minutes. Keep the incompatible-units guard. Raw/resolved/mixed and transport-round-trip fixtures must preserve units and totals.

## 9. All 17 previously undetermined entries

“S” is sound **within the inspected contract**, not scientific validation or exhaustive security/concurrency review. C=conditional/manual; R=research; D=no production caller found. IDs are M-PFC; path abbreviations above apply.

| ID | Verdict | Direct-source evidence / consequence | Reach |
|---|---|---|---|
| 081 | S descriptive pilot | `forge_walk_forward.py:275–299,341–380,947–948`: cutoff-known positive-TOI history; empirical bands explicitly uncalibrated, coverage descriptive. | R |
| 082 | Mis-specified | Same file `:392–425,718–721,876–889,929–946`: MAE selects means; frozen pairing and game/slate clusters coherent, small-sample warning retained. Section 2. | R |
| 087 | S | `baselineSourceLineage.ts:275–290`: SA=SV+GA only with both nonnegative components; otherwise null. Positive appearances and upload lineage required; not native-rate qualification. | C/legacy |
| 090 | S orchestration | `daily_board_daily.py:44–51,170–280`: export, final-game check, immutable reuse, recorded failures, pregame binding, explicit non-promotion. Provider workflow read, not run. | R/manual |
| 092 | S settlement contract | `daily_board_settlement.py:38–179`: official starters/win credit, volume identity, clocks/conditioning; unknown remains unresolved. `daily_board_candidates.py:129–162` preserves unknown labels. | R |
| 093 | S proof contract | `historicalQualification.ts:35–108,122–167`: cutoff/source/scope hashes, reconstruction distinguished from issuance, complete regular-season inventory/exclusions. Does not authenticate provider; test-only caller. | D |
| 094 | S OHLC | `accountability.ts:16–127`, `dashboard.ts:162–183`: finite pregame revisions grouped by conditioning/artifact; scoring-version checkpoints, latest selection. Upstream score defect is 066. | C |
| 103 | S publication contract | `nativeBaselineCadence.ts:53–84,149–215,283–317`: due-slot/closure checks, durable attempt journal, original-input replay. No scheduler activation established. | C/manual |
| 104 | S admission | `nativeBaselinePublication.ts:53–120`: identity/hash/clock/byte bounds, offline admission, dry-run default, exact package before write. Fake-transport tests passed. | C/manual |
| 105 | S reissuance contract | `nativeCadenceOutputPreparation.ts:67–104,120–138,159–184`: closure-bound unchanged means/cutoff, disclosed expiry, fresh review pending. Twelve hours is policy, not calibration. | C/manual |
| 106 | S helpers | `nativeDailyPipeline.ts:35–118,179–189,228–233`: future regular-season bindings, history reobservation, expiry before next start or 12h. V2 still imports helpers. | C/manual |
| 107 | S gates | `nativeDailyPipelineV2.ts:63–110,153–184`: flags, frozen/rolling cutoff, owned-universe/coverage checks, pinned methods/nulls. Optional thresholds default-off, explicitly reported. | C/manual |
| 108 | S materialization | `nativeInputMaterialization.ts:44–127,214–240,270–323`: byte bounds, original/derived receipts, cutoff/identity/cycle checks, durable replay before closure acceptance. No live invocation. | C/manual |
| 110 | Wrong | Split-label history contaminated before outcome exclusion; section 7. | R |
| 115 | S accounting | `nativeParticipationFrame.ts:81–118,155–259`: P/Z/O/K/unknown partitions; X=P, N=P+Z only with qualified frame; unknown blocks. Test-only caller, not a probability model. | D/R |
| 117 | S evidence checks | `pp_evidence_capture.py:466–479,575–651`: exposure sums, immutable correction lineage, explicit zero proof/exclusions; qualified windows deliberately zero. Not predictive qualification. | R |
| 120 | Wrong | Units depend on representation; mixed admitted PIM heads lose total. Section 8. | C |

Unread statuses closed: **14 narrow-contract sound, 1 mis-specified, 2 wrong**. Do not substitute these for whole-packet totals. The other 43 entries, D5’s team-defense aggregation and rookie magnitudes are not newly certified. Prior Astra corrections on goalie credits/mixtures, consumed lockbox and uncertainty still apply.

## Verification and reproducibility

### Commands actually run

From `web/`:

```sh
npm test -- --run \
  lib/player-forecasts/nativeBaselinePublication.test.ts \
  lib/player-forecasts/nativeDailyPipeline.test.ts \
  lib/player-forecasts/nativeDailyPipelineV2.test.ts \
  lib/player-forecasts/nativeParticipationFrame.test.ts \
  lib/player-forecasts/gameExpectations.test.ts \
  lib/player-forecasts/servedForecastLedger.test.ts
```

**Passed: 6 files, 217 tests, 4.36 seconds.** Publication tests use an explicit fake fetch/SDK transport and synthetic credentials; no production execution was performed. Passing these tests does not refute the new counterexamples, which are outside their present assertions.

### Independent fixture recipes

Python used `PYTHONDONTWRITEBYTECODE=1`; TypeScript used installed `ts-node/register/transpile-only`, `NODE_PATH=.`, compiler options `{"module":"commonjs","moduleResolution":"node"}`. No installs.

- **GLM/exposure/B2B:** AST-extract actual functions `_season_age`, `_weighted_summary`, `_weighted_exposure_summary`, `_eb_rate`, `_glm_features`, `_glm_prediction`, `_fit_log_link_ridge`, `_fit_penalized_rate_glm`, `_solve_ridge_system`, `_schedule_contexts_by_team` from `season.py`; inject standard-library math/defaultdict/date/datetime/typing and `TRAINING_CUTOFF_SEASON=20252026`, not application imports. `random.Random(20261111)`: each of 200 players draws `gammavariate(2.2,0.17/2.2)`, then 40 Poisson counts via product-uniform sampling; date=2026-01-01, season=20252026, TOI=900. Fit decay=1, k=5/20/40. Exposure and schedule inputs are in sections 4/5.
- **Composite/normalizer:** actual `scoreForecast`, unconditional, probability=null, pointEstimate=actual=0, baseline=.19 or 0 =>100/50. Analytic table sums y=0…19 with probability `exp(-.2)*.2^y/y!`. Actual `normalizePbpEvents`, home=1/away=2, home-owned goal, situation 1560 =>EN; SO goal/situation 1551 =>EV, is_goal=true. No fetch.
- **Ledger:** ten goalie 31/team 1 starts, game IDs 1…10, Oct 1…10 2026, season 20262027; saves 10 for first five, 30 for last five; GA 2, SA=saves+2, W=1, SO=0. Matching schedule. Issue Oct 15 noon UTC for Oct 15 23:00 game; empty bridge forecasts/runDates and no teamWin map. Actual `buildLedgerRows` gives section 6.
- **PIM:** valid player/schedule/issuedContext from `gameExpectations.test.ts:24–52`, PIM=2 in both games. Add unrelated admitted GOALS baseline, call actual `resolvePlanningContributions`; feed its first resolved forecast plus original second raw forecast to actual `buildGameExpectations` without baselineSources. Section 8 follows. No mocked resolver.
- **Assists:** actual `build_validation_features`, temporary v2-validation manifest with checked-in `VALIDATION_CONTRACT_SHA256`, target 20252026; games Nov 1/Nov 2 2025 at 23:00Z, home 1/away 2, C player 77/team 1, TOI 20:00. Assists/A1/A2/completeness=(2,0,0,false), then (1,1,0,true). Requested assists, primary_assists, secondary_assists, time_on_ice_seconds. Inspect game 2 pregame values in section 7; temporary directory removed.

No full build/typecheck or production backtest performed. Fixes need new regression tests and held-out artifact evaluation beyond these engineering checks.

## Fix-plan boundaries and owner questions

Decisions 38, 39, 41, 63 and 65 already settle qualification, consumed evidence, evaluation basis, relief and proper scores; no repeat owner question is needed. Repair scope, data sources, historical recomputation and activation need separate approval. Preserve issued forecasts/evidence; an empty snapshot or passing tests do not authorize activation.
