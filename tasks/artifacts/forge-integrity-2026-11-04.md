# FORGE integrity implementation — November 4, 2026

Local, uncommitted slice on `octoberBranch`, starting at `152ee53b766d656d21154aacfe53ff2491a1bccf`. Existing unrelated changes were preserved. No deployment, push, migration, ingestion, database write, or production request occurred. The attached research was treated as hypotheses, not an accuracy result.

## Delivered

1. **Default validation correction:** observed skater labels must be nonnegative safe integers and obey PPP ≤ G+A. `web/lib/forge-v2/contracts.ts:337` now supplies the shared validator used by ledger ingestion (`evaluation.ts:120`), direct settlement (`evaluation.ts:157`), and model examples (`model.ts:68`). Fractional expectations remain valid; unavailable categories remain unavailable. Existing invalid stored labels will fail validation when processed again; this task did not rewrite historical records.
2. **Opt-in goalie accounting correction:** `web/lib/projections/uncertainty.ts` adds `jointGoalieCounts: true`, with version `goalie-shots-binomial-ga-v1`. It draws GA conditional on sampled SA using a binomial, then derives saves = SA − GA. Poisson/NB shot options and the existing persistent scenario selection are reused. The new output carries `count_model_version`; omitted/false preserves incumbent output. No producer enables this option. It changes interval distributions and needs empirical qualification before promotion.
3. **Offline cumulative evaluation:** `web/lib/forge-v2/horizonEvaluation.ts` and `web/scripts/forge-horizon-evaluate.ts` evaluate supplied frozen 1/10/20-game-window trajectories, with independent sample/label validators, temporal gates, explicit missingness, participation scores, CRPS/log scores, mean errors, 50/80/95% interval scores, horizon summaries, and paired calendar-block diagnostics. Fixtures live in `horizonEvaluation.fixtures.ts`; tests in `horizonEvaluation.test.ts`.

This completes a correctness/evaluation slice. It does **not** complete a multi-season empirical comparison or replace the forecasting system.

## Reproduced defects

| Finding | Before patch | Resolution |
|---|---|---|
| Fractional observed PIM accepted by the v2 outcome ledger | New regression using PIM=0.5 failed because ingestion did not throw; 21 incumbent evaluation tests passed | Shared observed-count validation at ingestion, settlement and training |
| Impossible observed PPP accepted by that ledger | New regression using G=0, A=0, PPP=1 also failed | Same validator; missing G/A remain unknown, never invented zeros |
| Legacy goalie count simulation can create saves when the specified save expectation is zero | For SA=1, GA=1, saves=0 over ten games, reproduced saves quantiles `{p10:1,p50:3,p90:5}`; coherent result is all zero | Opt-in joint sampler now returns zero saves and identical SA/GA quantiles; incumbent retained pending evaluation |

These are synthetic counterexamples, not estimates of real-world defect frequency or accuracy gains.

## Pipeline and consumer audit

| Layer | Owning code and observed behavior |
|---|---|
| Ingestion/derived inputs | `web/lib/projections/goaliePipeline.ts` maps games/teams/players → PbP/shifts → `forge_player_game_strength`, `forge_team_game_strength`, `forge_goalie_game` → goalie priors → projection runs. No endpoints were invoked. |
| Forecast-time context | `projections/stages/preflight-stage.ts` resolves roster availability, board evidence and market context; skater/goalie stages consume these plus historical/context queries. `run-forge-projections.ts:459` captures input/code/model identity; `:652` checks snapshot and replay-output hashes. Historical reconstructions are explicitly distinguished from captured live runs. Current downloads alone cannot prove historical availability. |
| Legacy horizons | `projections/stages/goalie-stage.ts:714` builds horizon scalars and `:807` persists scaled aggregate values. This is not a frozen cumulative trajectory/label contract. No trade-window semantics were silently changed. |
| Newer per-game FORGE | `forge-v2/contracts.ts` targets official appearance conditional production; H1–H10 is the ordinal of one future game. `schedule.ts` uses roster affiliations and explicit schedule shortfalls. `model.ts` checks admitted hashes, partition boundaries and model availability; `uncertainty.ts` checks joint counts and pinned calibration. Its kernel candidate remains development-only. |
| Storage/API | Legacy rows go through `projections/stages/persistence-stage.ts` to FORGE projection tables and `/api/v1/forge/players` / `goalies`. Newer v2 uses append-only history/artifacts, immutable read preparation and `/api/v2/forge/[operation]`. Existing validation and qualification gates remain. |
| RSO | `rosterScheduleData/forgeDailyBridge.ts` labels interim reused game lines and checks external-input proof. `forge-v2/integration.ts` still disables the v2 RSO adapter. No optimizer or league scoring was moved into FORGE. |
| BLSH / Trade Analyzer | `components/blshTrade/BlshTradeComparison.tsx` consumes interpretation records; `buyLowSellHigh/trade.ts` applies league scoring and separates retrospective BLSH evidence. Its goalie ratios use summed expected numerators/denominators. That estimand is preserved, not relabeled expected realized SV%/GAA. |
| Roster analysis surface | The located surface is `pages/roster-autopsy.tsx` → `components/RosterAutopsy/RosterAutopsy.tsx`, with local eligibility/workspace analysis in `lib/rosterAutopsy/manual.ts`. Its entry imports contain no new evaluator dependency; it was not rewired. No separate page named Roster Analysis was found in the bounded route check. |

## New experimental forecast contract

`forge-frozen-calendar-evaluation-v1` is separate from the serving target. It records canonical NHL player/team/season IDs, issuance and feature cutoff, source revision/hash/use and observed/published/first-received clocks, model availability, model/feature/calibration/schedule/category versions, and fitted-dependency training-window maturity. Source ages at issuance are reported; no invented universal freshness threshold is applied.

Each window declares H, exact frozen origin-team game IDs, and an inclusive calendar endpoint. It includes declared player games whose **start** falls in `(issuedAt, endAt]`, including contributions after a trade. Thus GP may exceed H. Explicit eligible game IDs must match supplied game records. Nonappearance is an observed zero only when supplied as such; missing values use null. Fewer than H origin games, incomplete coverage, missing anchors, unmatured finals/receipts, and anchors postponed beyond the frozen calendar remain unscored with reasons. Windows cannot change endpoint or anchor prefix silently.

One probability belongs to an entire supplied trajectory. Nested count totals are sums of the same nonnegative game outcomes and cannot decrease. Ratios need not be monotone. No independent daily availability draw or second zero-inflation process is inserted. The evaluator validates a declared trajectory; it does not estimate injury duration or invent a participation model.

Skater labels/samples enforce integer counts and PPP=PPG+PPA≤G+A. Goalie labels/samples enforce SA=saves+GA, appearance=starts+relief, and shared team shutout ≠ individual SO. Relief wins and no-decision starts remain legal; no W≤GS constraint exists. Individual faced-shot counts exclude empty-net and shootout team bookkeeping. Official GP is not inferred from positive minutes. These exceptions and the ratio definitions were checked against the [NHL glossary](https://frontend.d3.nhle.com/info/hockey-glossary).

SV%=total saves/total SA and GAA=60×total GA/total minutes are computed **inside each outcome**, conditional on positive denominators. Unknown inputs and zero denominators are distinct. Reports expose no-exposure probability/Brier, expected realized ratios, and ratios of expected counts separately. The synthetic 10/10 versus 40/50 pair verifies .900 versus .833333 SV%.

Full forecast hashes bind versions, windows, lineage and sample bytes in cache identity. Comparator identity requires matching player, origin team, season, evidence class, issuance/cutoff, schedule/category versions and windows. Model versions can differ for comparison. Hashes detect changed bytes; they do not independently authenticate first-available timestamps or a genuinely frozen historical issuance. Authenticity and complete eligibility evidence must accompany empirical inputs.

## Reproduction and measured results

Run from `web/`, with the existing Node 22.11.0 installation; no dependency install is needed:

```sh
NODE_PATH=. npx ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node"}' scripts/forge-horizon-evaluate.ts --fixture true --comparator synthetic_incumbent --category SOG --horizon 20 --block-days 30
```

For admitted frozen artifacts, replace `--fixture true` with `--input /absolute/path/to/input.json`. Input is `{asOf, cases}` using the exported `RollingCase` contract and retained hashes. `--output /absolute/path/to/report.json` creates a new file exclusively and refuses overwrites. Block comparisons require all four comparison flags. Re-run empirical comparisons at longer block lengths as a sensitivity analysis; the evaluator rejects blocks shorter than the declared target span.

Fixture result: 3 requested / 3 evaluated horizons, approximately 13 ms in the recorded CLI run (machine-specific, not a scale benchmark).

| H | Expected GP | GP variance | Candidate SOG CRPS | Synthetic comparator SOG CRPS |
|---|---:|---:|---:|---:|
| 1 | 0.5 | 0.25 | 0.5 | 0 |
| 10 | 5 | 25 | 5 | 0 |
| 20 | 10 | 100 | 10 | 0 |

The fixture realizes the all-available branch, so the deliberately certain synthetic comparator wins this single realization. It is not the actual FORGE incumbent or a fitted baseline. H20 paired improvement is −10 CRPS, with **no confidence interval** because there is only one calendar block. No accuracy improvement is claimed.

Checks actually run:

- 259 distinct tests passed across 15 files: evaluation/model/contracts/preparation/integration/API/pipeline/uncertainty, new cumulative evaluation, legacy uncertainty and goalie accounting/selection, RSO bridge, and Trade Analyzer logic/component tests. Focused regressions failed before their respective fixes. Existing legacy-default uncertainty expectations passed unchanged.
- Full `npm run typecheck -- --incremental false` passed using its configured 8 GiB heap after plain `npx tsc` exhausted the default 4 GiB heap. Focused strict TypeScript checks covered subsequent evaluator/sampler edits.
- Targeted ESLint passed on all changed TypeScript files. No full-repository lint, full application test suite, browser session, production request, or build was run. Changes affect pure validation/evaluation math; no build-specific behavior or UI was changed.

Relevant tests can be reproduced with `npm test -- --run lib/forge-v2/evaluation.test.ts lib/forge-v2/model.test.ts lib/forge-v2/contracts.test.ts lib/forge-v2/preparation.test.ts lib/forge-v2/integration.test.ts lib/forge-v2/api.test.ts lib/forge-v2/pipeline.test.ts lib/forge-v2/uncertainty.test.ts lib/forge-v2/horizonEvaluation.test.ts lib/projections/uncertainty.test.ts lib/projections/goalieStarterMixtures.test.ts lib/projections/goalie/goalieOutcomes.test.ts lib/rosterScheduleData/forgeDailyBridge.test.ts lib/buyLowSellHigh/trade.test.ts components/blshTrade/BlshTradeComparison.test.tsx`.

## Remaining empirical gates and blockers

- No admitted, complete, multi-season dataset with historical first-available receipts and forecast-time eligible populations was supplied to this run. No production extraction or provider download was attempted. Current source code cannot prove rights, historical news availability, or xG model vintage.
- The new runner evaluates supplied frozen rolling origins; it does not train the prior-season/recency/strength-specific baseline ladder or fabricate missing historical trajectories. A legacy quantile summary is insufficient to recover a joint distribution. A bounded adapter/export with authentic inputs is needed before claiming an incumbent comparison.
- Exposure-error decomposition, fitted persistent injury/role trajectories, joint goalie minutes/pulls/relief, pooled rookies, prior-only venue effects, PP opportunity experiments and ranked league utility remain research work. Existing BLSH/RSO/Trade scoring remains in its owning components. No provider-reported performance was adopted as FORGE evidence.
- Before accessing an untouched holdout for the goalie candidate, use identical shot/exposure/selection inputs for incumbent and candidate; keep the fitted transformations prior-only. Require zero structural violations, no coverage loss, a positive lower 95% paired-block CRPS-improvement bound for both saves and GA at each tested horizon, and no >2 percentage-point deterioration in 80/95% interval coverage. Repeat at doubled block length. These are conservative local experimental gates, not production qualification or a passed test. An independent review and existing repository qualification requirements still apply.
- The default goalie simulator still uses incumbent intervals. Activation of the joint sampler, empirical evidence admission, retrospective record repairs, publishing and deployment have not occurred.
