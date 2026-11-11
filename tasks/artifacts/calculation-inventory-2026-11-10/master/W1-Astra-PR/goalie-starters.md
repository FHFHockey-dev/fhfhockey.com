# Independent peer review: W1-5 goalie starters and starter odds

Reviewed 2026-11-11 in `/Users/tim/Code/fhfhockey.com`, `octoberBranch`, HEAD `f6cdee012b8c16d330362cb88f81435d17f975ff`.

This is an additive review of `../audits/goalie-starters-starter-odds.md`, its 20-entry packet, W1-5 brief, and current `../OWNER-DECISIONS.md`. The original report remains unchanged. No implementation, production queries, provider requests, database writes, migration, publication, or deployment was performed. Production statistics below remain attributed to W5, not independently reproduced observations.

## Verdict

**Retain the main defect findings, but do not accept W5 unchanged as a verified production calibration report or an implementation-ready fix plan.** Same-day look-ahead, duplicated recent-usage influence, non-unit three-candidate mass, missing timestamp updates in the v2 payload, the wrong accuracy outcome, TOI-based starter identification, and the missing model expiry are supported by current source. Three focused test files passed, 87 tests total; isolated calls to the actual probability and starter-context functions reproduce two important defects.

The most consequential corrections are:

1. **All candidate probabilities can be persisted, not only the top pick.** The writer stores them in metadata. Partner calibration need not automatically be inferred from the top pick.
2. **Real TOI does not identify the credited starter.** W5's suggested alternative of merely populating TOI still mislabels an early-pulled starter whose reliever plays longer.
3. **A fresh `updated_at` is necessary, but not a historical snapshot.** Require immutable inputs and pregame availability/publication, not just a run creation time.
4. **Start Chart exposure has an earlier native-source gate.** Neither the number of revision rows nor the starter-board flag alone establishes what production serves.
5. **Do not convert the proposed calibration constants into a fix.** The 0.3 shrink factor and 8.7% back-to-back rate are hypotheses. The claimed “three L10 counts,” causal attribution, and saves/wins error percentages need narrower wording.

The original 10 sound / 3 mis-specified / 7 wrong entry tally is an inventory classification, not 20 independently verified production behaviors. Most code-level dispositions stand with the qualifications below. Missing production evidence and calibration results must remain explicitly undetermined even where the underlying code defect is established.

## Corrections and additional context

### R1. Candidate probabilities are stored beyond the top-level column

W5 says only the top-ranked probability is stored and therefore partner calibration must be inferred. That is only true of the scalar `starter_probability` column.

- `web/lib/projections/utils/projection-metadata-builders.ts:267-269` serializes every `rankedGoalies` entry as `candidate_goalies` with its probability.
- The same metadata is retained by `augmentStarterModelMetaWithScenarioProjections` at `:325-340`, then assigned to `model.starter_selection` at `:465`.
- `web/lib/projections/stages/goalie-stage.ts:824` persists the uncertainty object. It also persists `daily_board_candidates`, populated with each scenario's probability when compute mode is enabled (`:620-632`).
- `web/lib/projections/starterBoardDataset.ts:119-131` already iterates those daily-board candidates and emits candidate-level start-probability targets.

**Correction:** distinguish “one top-level goalie row” from “one stored candidate probability.” Check version-specific metadata coverage on a small approved sample or existing export before declaring partner probabilities unavailable. This review did not read bulk JSON or establish that every historical row contains that metadata. Do not reconstruct a partner as `1 − p(top)` when a third candidate or unresolved mass exists.

### R2. D6 must use an official start label, not maximum TOI

The defect is stronger than the null column. `web/lib/projections/queries/goalie-queries.ts:113-123` chooses the maximum-TOI goalie for each date; with all TOI null, `safeNumber(..., 0)` leaves the first returned row selected. The current producer explicitly writes null (`web/lib/projections/derived/buildGoalieGameV2.ts:123-138`).

**Executed counterexample:** the actual query function, with an in-memory client returning a credited starter with 600 seconds and a reliever with 3,000 seconds on the same date, selected the reliever as `previousGameStarterGoalieId` and assigned that goalie one start. Merely filling TOI would therefore leave the outcome wrong.

Use independently complete team-game opportunities and exactly one official `games_started = 1` label per completed team-game. Missing or contradictory labels are unknown, not an arbitrary first row. Keep last appearance, last credited start, and fatigue/workload separate: `lastPlayedDateByGoalie` currently derives only from selected “starters” on the queried team (`goalie-queries.ts:126-144`), while `fetchGoalieWorkloadContext` counts all observed goalie dates as starts (`:174-210`). A traded goalie or reliever needs a different history treatment, not a fabricated 999-day gap. Date grouping is also a weaker identity than game ID.

**Acceptance tests:** early pull with longer relief; reversed null-TOI row order; missing/duplicate official starter; recent appearance on a prior team; relief-only appearance. This is a correctness prerequisite before refitting probabilities.

### R3. D3–D5 require point-in-time content, not only better timestamps

Source confirms the v2 payload does not set `updated_at` (`update-goalie-projections-v2.ts:435-446`, upsert at `:77-79`) and includes logs on the target date (`:357-367`). The Start Chart legacy read uses `updated_at <= endOfTargetDate` (`start-chart.ts:838-844`); the game-prediction read instead filters `created_at` (`featureBuilder.ts:2905-2911`). Updating one column does not repair the latter, and neither timestamp recovers the overwritten prior version of a mutable row.

The legacy accuracy path selects the latest succeeded run by date (`run-projection-accuracy.ts:1716-1723`; `apiHelpers.ts:36-48`), not by game-specific information cutoff. Its provenance check is useful, but does not itself establish a pre-puck-drop prediction. A run created before puck drop can finish, read inputs, or publish afterward. Conversely, a later historical reconstruction must not be presented as a forecast that was actually available then.

**Better repair contract:** persist or reuse immutable issued forecasts with the candidate set, source content/receipt clocks, information cutoff, publication time, and frozen scheduled game start. Select the latest eligible pregame issuance per game, not the latest run for a calendar date. The existing `starterBoardDataset.ts:42-55` is a useful stronger local contract: it validates cutoff, capture, availability and publication before the frozen start, and rejects input receipts after the declared cutoff. Reuse that contract where applicable instead of creating a weaker parallel definition.

The accuracy outcome is also confirmed wrong: `run-projection-accuracy.ts:2073-2082` scores `actualRow ? 1 : 0`; its primary read does not select a start label (`:1606-1627`). A reliever counts positive, and a missing data feed can count negative. Require a complete, settled team-game and credited-start outcomes; exclude unknown actuals. Do not infer that every historical run actually passed the other release/provenance gates, or that “live daily runs are clean,” without the captured evidence.

**Acceptance tests:** row overwritten after its cutoff; pregame-created run with postgame read/publication; latest run ineligible but earlier eligible issuance exists; relief appearance; missing actual feed; both teams' complete start labels. W5's reported affected-row counts and its pregame Table B have not been rerun here.

### R4. The serving decision is more than the starter-board flag

`web/pages/api/v1/start-chart.ts:1196-1199` resolves the native forecast source first. `:1226-1242` returns native or empty output before the legacy slate and goalie mixture logic. Only the remaining legacy/legacy-flagged branch reaches `:1539-1556`.

`web/lib/player-forecasts/forecastServingSource.ts:21-25,59-78` distinguishes pre-activation legacy, usable native head, empty fallback, and `FORGE_NATIVE_SERVING_FALLBACK = legacy_flagged`. In that legacy branch, `starterBoardFlags.ts:1-10` resolves `STARTER_BOARD_SERVING_ENABLED` with `START_CHART_GAME_REVISIONS` as its default when the explicit variable is absent. Canary scope and valid revisions also matter.

**Correction:** D2 and the stale-confidence display exposure are conditional. Establish the effective source selection and legacy/revision flags for a concrete response or already-recorded deployment before calling them the production Start Chart behavior. A single old revision row is not proof of an off flag. These values were not inspected in this review. The same native-source resolver is shared with RSO/FORGE, so legacy bridge findings should be scoped accordingly.

### R5. Usage amplification is real; “three L10 counts cause the error” overstates the evidence

The score contains:
- L10 share from the team starter context, coefficient 2.4 (`goalie-starter.ts:168,190`).
- Logit of the v2 L10 prior, coefficient 0.7 (`:169,191`; `skater-stage.ts:3557-3563`).
- A distinct season-to-date start share, weighted by sample size (`:176-198`).

The third term overlaps recent usage but is not a third identical L10 input. Correlated predictors are not inherently invalid in a fitted model; the problem is an unvalidated hand-weighted score with amplification and defective inputs. Establishing its main empirical cause requires an ablation or a properly held-out refit, not merely counting terms.

**Executed fixture:** two candidates, 10 prior team games, matching L10/prior shares, both last played 2026-11-09, target 2026-11-11, no team/opponent context, default season/quality/line priors:

| Input usage | Actual function output for first goalie |
|---|---:|
| 7 starts / 10, prior 0.7 | 0.8953147408 |
| 8 starts / 10, prior 0.8 | 0.9670994547 |

These verify W5's approximate 90%/97% amplification examples without the season-share term. They do not demonstrate the real-world conditional start rates. For three candidates with starts 5/5/0, priors 0.5/0.5/0, and no last-played date for the third, the output was `0.4999938735, 0.4999938735, 0.01`, totaling **1.0099877470**. The post-softmax clamp at `:236-241` is a direct coherence defect. Renormalization or a bounded-simplex mapping needs tests for dominant, equal, and tiny third-candidate probabilities, including rounding.

Keep the owner correction: 37%/56% are ratios inferred from average start chances, **not measured saves/wins forecast errors**. The attribution is additionally complicated by the stage storing a team-goalie mixture under the selected goalie ID (`goalie-stage.ts:656-685,804-824`) and the legacy bridge treating those fields as a per-start line (`forgeDailyBridge.ts:283-289,610-636`). A probability-ratio estimate alone cannot quantify that composite path's fantasy error.

### R6. Missing probability mass is not automatically a normalization bug

The mixture layer intentionally preserves unresolved mass (`goalieStarterMixtures.ts:165-168,212-213`). An executed 0.6/0.4 back-to-back fixture yielded 0.39/0.40 plus **0.21 unresolved**, as documented. Its existing test expects this behavior. W5 recognizes the residual in its description, but D7's proposal to move all removed mass to the other goalie needs a completeness condition.

For a closed, complete candidate set, candidate probabilities should sum to one. With incomplete eligibility/evidence, listed candidates plus an explicit unknown bucket should sum to one; blindly rescaling listed candidates manufactures certainty. The legacy RSO bridge deliberately uses this distinction (`forgeDailyBridge.ts:573-584`). Calibrate the 0.65 factor separately; it is not validated by this accounting identity.

The LIKELY override defect is conditional too: `preflight-stage.ts:170-176` accepts LIKELY overrides only when starter-board compute is off. The stage then lists the named goalie at its subunit chance and every other candidate at zero (`goalie-stage.ts:398-410`); its residual projection falls back to the named goalie's full-start line (`:656-679`). Do not conflate this with the bridge's distinct likely-news floor plus rescaling (`forgeDailyBridge.ts:595-605`) or confirmed daily-board evidence (`dailyBoardEvidence.ts:224-229`).

### R7. Tighten the statistical evidence and proposed release tests

W5 reports useful diagnostic reliability tables, but no query text, immutable extracted fixture, source-row manifest, or cohort hash accompanies this packet. Its 300-game calibration, 8,941 timestamp rows, null-TOI prevalence, B2B rate, missing-table observation and season SV% remain **prior-audit evidence, not independently verified measurements** here. The report supplies limitations, but those should also qualify its headline conclusions.

Before a refit or deployment decision:
- Freeze model/version, issuance rules, game dates, eligible candidate sets, and official outcomes. Report exclusions and missing-label coverage, including trades/call-ups in Table A's previous-row reconstruction.
- Separate top-pick calibration from all-candidate calibration. A three-candidate universe has a different baseline from a two-goalie top-pick cohort.
- Report reliability intervals and paired score differences on the same eligible games, with time-ordered fitting/validation and game/slate clustering. A 200-game sample and mean prediction within 0.05 do not by themselves establish calibration.
- A 0.25 Brier coin-flip comparator is a valid crude reference but too weak as the sole release test. At W5's rounded top-pick outcome prevalence 0.603, an in-sample constant has Brier `0.603 × 0.397 = 0.239391`; deployable baselines must be estimated from prior training data, not the evaluation labels. Compare incumbent, shrunk usage, schedule-aware and confirmed-news baselines under identical cutoffs.
- Mean error can cancel across probability bins, and Brier measures more than calibration. Include per-bin reliability, proper score comparison, and sample/coverage requirements. Existing `starterBoardValidation.ts:59-75` already requires prospective regular-season evidence, at least 200 games/30 slates, frozen baseline identity and a paired improvement interval; W5's proposed test must not weaken that gate.
- Do not ship 0.3 logit shrinkage, a 0.09 B2B constant, or a rule that yesterday's goalie must always rank below the partner solely from these retrospective averages. Eligibility, injury, team and usage context can invalidate that universal rule.

### R8. GSAA and cleanup recommendations need contract boundaries

Owner decision 10 **already** specifies `SA × (1 − league SV%) − GA`. W5's owner question 4 is stale. The v2 arithmetic `saves − SA × 0.900` is algebraically correct GSAA against a fixed .900 comparator; the defect is using a fixed comparator under a league-average claim and treating an unstable descriptive value as a prior (`update-goalie-projections-v2.ts:431-433`). Use the matched season/strength/date-range league rate. If the predictive feature is shrunk, distinguish it from unshrunk descriptive GSAA rather than silently changing the meaning of the named statistic.

The legacy SQL has both errors identified by W5 (`production_schema_baseline.sql:2708,2733-2735`). With 28 SA, 2.8 GA and 3,600 seconds, its arithmetic is +0.373333 versus approximately zero at a .900 league rate. The coordinator is tombstoned (`20260730193000_repair_compile_invalid_legacy_routines.sql:8-20`). No code implementation or deletion is needed to accept the audit finding.

Deleting that RPC, deleting the unused skater helper, or creating/deleting the mixture route are separate cleanup/design decisions, not automatic consequences of a math audit. A mixture-table migration already exists at `migrations/20260527_create_goalie_starter_mixture_tables.sql:3`; its existence does not prove deployment, and W5's absent-production-table observation does not mean no schema definition exists. Decide supported ownership and deployment status before proposing a duplicate table.

## Per-entry disposition

“Agree” below concerns the inspected implementation, not an independent production-data certification.

| Entry | Peer-review disposition and evidence |
|---|---|
| M-GST-001 | Agree wrong legacy formula/units; ordinary caller is retired. `production_schema_baseline.sql:2708,2731-2735`; R8. Starts/total starts equals team-game share only with complete one-start-per-game labels. |
| M-GST-002 | Agree defects in same-day cutoff and timestamp payload; fixed-.900 metric and probability semantics need correction. `update-goalie-projections-v2.ts:365-367,425-446`; R3–R5. Production frequency/impact unverified. |
| M-GST-003 | Same underlying legacy defect as 001, not an independent production defect. Coordinator tombstone at migration `20260730193000...:8-20`. |
| M-GST-004 | Same v2 calculation as 002. Eligibility filters do not guarantee a complete candidate population. `update-goalie-projections-v2.ts:352,413-423`; R2, R6. |
| M-GST-005 | Agree conditional-to-unconditional arithmetic for its declared zero-relief assumption and known probability. `starterBoardScoring.ts:50-65,173-200,239-264`. This does not validate upstream probabilities or production activation. |
| M-GST-006 | Agree three-candidate mass defect, unvalidated score and verified amplification. Replace “three identical L10 counts/main cause proven” with R5. `goalie-starter.ts:166-241`. |
| M-GST-007 | Agree top-two normalized scenario labels and raw-weight-plus-residual arithmetic for valid nonnegative mass ≤1. `goalie-starter.ts:42-73,245-264`. Residual is explicitly an approximation using a fallback line, not the exact third goalie's expectation; do not treat the selected ID's team mixture as its own conditional line. |
| M-GST-008 | Display is verified, source attribution conditional. The component reads a generic forecast and Yahoo mark takes precedence, not FORGE exclusively. `SlotWeekGrid.tsx:202-206`; R4. “Likely” at exactly 0.5 is at best a UI convention, not a calibration guarantee. |
| M-GST-009 | Agree nearest-rank and on-time-share accounting. `starterBoardOperations.ts:19-23,45-58,67-109` keeps overdue/invalid deliveries in the failure accounting and discloses observed-delivery percentile limits. |
| M-GST-010 | Agree relative heat scale and tie handling. `goalieBoards.ts:16-39`. No cross-post absolute magnitude claim. |
| M-GST-011 | Agree pooled rates, completeness-gated ranks, unknown/tied weaker-opponent handling. `goalieInventory.sources.ts:137-194,283-290`. 74 inventory tests passed; upstream source equivalence was not re-audited here. |
| M-GST-012 | Agree 32-team bands 1–11 / 12–21 / 22–32 and direction-aware rank comparison. `goalieInventory.sources.ts:369-386`. Ranks do not convey gap magnitude. |
| M-GST-013 | Agree official-start/team-game accounting with caller completeness guard. `goalieLedger.ts:61-80`, `goalieInventory.sources.ts:300-308`. Internal zero when incomplete is not a valid probability. |
| M-GST-014 | Agree pooled SV%/GAA, official-start completeness and descriptive appearance-share distinction. `goalieWorkload.ts:61-118`; `goalie/workloadEvidence.ts:4-33` remains explicitly dormant. Recorded goalie games are not an independently complete schedule. |
| M-GST-015 | Agree conditional LIKELY override problem; not a blanket diagnosis of every news path. `preflight-stage.ts:167-184`, `goalie-stage.ts:398-410`; R6. W5's zero production event count was not reread. |
| M-GST-016 | Agree model expiry omission against declared four-hour TTL. `lineupSourceIngestion.ts:162-167,285-292,1718-1742`; confirmed source precedence follows `:1765-1791`. |
| M-GST-017 | Agree implementation matches the stated evidence gate, not proof of calibrated serving. `starterBoardValidation.ts:55-76`; preserve caveat that a noisy degradation is not blocked when its interval includes zero. R7. |
| M-GST-018 | Agree upstream timestamp dependency and absent B2B arguments in legacy Start Chart call. `goalieStarterMixtures.ts:181-209`, `start-chart.ts:1539-1542`. Residual mass is deliberate; 0.65 efficacy and live route/table availability remain undetermined here. R4, R6, R8. |
| M-GST-019 | Agree starter-context defect; strengthen remediation to official labels, independent coverage and cross-team history, not just nonnull TOI. `goalie-queries.ts:86-158`. Both dressed goalies get equal lineup priors when both are always listed (`:42-58`), which cancels in a score difference; claimed production frequency remains unverified. |
| M-GST-020 | Agree population-SD helper arithmetic under its input assumptions; no production import found beyond its test. `components/Variance/skaterVariance.ts:33-49`. Reclassify the inventory family if useful; deletion is optional cleanup, not a goalie math defect. |

## Repair order and required verification

1. Define the settled official-start outcome, candidate completeness, and separate start/appearance history. Preserve unknowns.
2. Repair source update clocks and immutable pregame issuance/capture selection. Do not claim old overwritten history has become clean by refreshing a timestamp.
3. Verify the actual serving branch and recover available candidate metadata under the read-hygiene rules. Use a bounded local export only when authorized; no bulk live-payload analysis.
4. Fix the explicit probability-vector coherence defect without forcing unresolved mass onto known goalies. Trace conditional versus team-slot fields through each consumer.
5. Refit/calibrate with frozen, time-separated cohorts and compare proper scores/reliability with uncertainty. Treat constants proposed by W5 as experimental until this succeeds.
6. Separately consider canonical GSAA baseline, model-source expiry and optional dead-path cleanup. None of this review authorizes implementation or deployment.

## Checks and limits

**Passed:** from `web/`, `npm test -- --run lib/projections/goalieStarterMixtures.test.ts lib/projections/derived/buildGoalieGameV2.test.ts lib/socialShare/modules/shared/goalieInventory.sources.test.ts`: 3 files, 87 tests. The tests use pure functions/fixtures or mocked clients, with inert Supabase test defaults. Existing passing tests do not cover all defects above.

**Passed:** isolated Node v22.23.4/TypeScript transpilation of the actual probability, mixture, and starter-query modules, with a fully in-memory query double. Inputs and numeric results are recorded in R2, R5 and R6. The temporary harness initially failed on an unlisted pure import and then its missing mock `or` method; after those harness corrections it completed. These were harness failures, not product-test failures. No model fitting or statistical backtest was run.

**Inspected:** all 20 entry targets, principal v2/legacy probability writers, starter context, stage metadata/persistence, legacy accuracy selection/outcomes, native/legacy serving switch, legacy RSO bridge, relevant tests and schema definitions. The W5 original report/owner decisions were read directly; empirical findings were not presumed correct.

**Not run:** database queries, production requests, provider requests, full app test suite, build, browser/display validation, remote flag checks, refits or a reproduction of Tables A/B. No screenshots, current live calibration result, database deployment state or claims that every team sum-to-one path is tested follow from this review. W1-5's original done-criteria remain open on those points.
