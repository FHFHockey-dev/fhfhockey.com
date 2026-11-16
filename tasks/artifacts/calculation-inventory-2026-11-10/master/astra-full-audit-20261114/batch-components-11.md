# Components 11 — PP combos, legacy predictions, projection comparison

Worker: `readfirst_production`. Immutable target: `89da739cb45d7d572ed59bfa0b209c79c5d99299`. Provisional findings for Chef review; no canonical ledger/report edits.

All nine assigned files were fully read in path order: **2,866 lines, 492 separately identified AST entries** (228 function-like declarations/callbacks, 240 initializers, 24 test/suite declarations). Current and target SHA-256 hashes match for every file. No assigned remainder; stopped before Rankings. Manifest contains hashes, exact reading ranges, bounded reader traces, retained probe outputs and complete probe source. TSV identities include zero-based, end-exclusive character offsets, so callbacks on the same line remain distinct.

Two reachable source defects are proposed P1; five masked/dormant or label-only defects are P2. No live incidence, stored corruption, predictive qualification, or production verification is claimed. Existing PP-clock/Decision 152 and xG-retirement closures remain preserved.

## Coverage and contracts

| File | Lines | Principal checked output and evidence boundary |
| --- | ---: | --- |
| `PowerPlayCombos/PowerPlayCombos.test.tsx` | 413 | Synthetic query/fetch fixtures cover season pending/mismatch/failure, PP-clock states, and partial FORGE coverage. Read, not run. |
| `PowerPlayCombos/PowerPlayCombos.tsx` | 857 | Season/team/game admission; units and five previous games; observed PP counts; complete same-games model TOI/GP and SOG; nullable display. |
| `Predictions/MetricCards.test.tsx` | 27 | Independent arithmetic examples for known-sample weighted hit rate and all-unknown result. Read, not run. |
| `Predictions/MetricCards.tsx` | 128 | Pooled known sample counts, fraction-to-percent conversion and metric labels. |
| `Predictions/PlayerTable.tsx` | 72 | Legacy VDP values, player metadata and externally supplied sparklines; disclosed five-appearance horizon. |
| `Predictions/PredictionsLeaderboard.tsx` | 184 | Legacy model/version/horizon query, metadata join, history selection and stale-map retention. No current TS/TSX caller found. |
| `Predictions/SkoExplainer.tsx` | 72 | Static legacy formula and limitations; no estimator or forecast qualification. |
| `Projections/ProjectionSourceAnalysis.test.ts` | 32 | One-source season-to-date proration and zero/unknown actual GP. Fixture source identity bypasses the current producer contract. Read, not run. |
| `Projections/ProjectionSourceAnalysis.tsx` | 1,081 | Source scoring totals, GP denominators, errors, median/mean, heuristic rankings, position/round grouping and labels. Seven findings below include one in Leaderboard. |

Paths in this table are relative to `web/components/`. Per-symbol formulas, callbacks, finding intersections and expression excerpts are in `batch-components-11.tsv`. A finding on an outer component/function row means that its source span contains the identified defect, not that every enclosed operation is independently defective.

## Findings

### AFULL-COMP11-01 — P1: draft-round metrics recurse without a base case

- **Location/claim:** `web/components/Projections/ProjectionSourceAnalysis.tsx:411–449`, `computeSourceMetrics`; round rankings should aggregate each round once.
- **Evidence:** Target-pinned exact function extraction; manifest probe `recursionWithRealIdControls`. A selected positive-weight `ag_skaters` control and one player with `yahooAvgPick=1` produce `RangeError: Maximum call stack size exceeded`.
- **Cause:** The round subset calls the same function, which groups the same player into the same round and calls itself again. Any admitted positive pick at most 240 suffices. This happens even when the source-ID mismatch produces no aggregate source rows, because round grouping iterates the original players. No switch to the round tab is required: the component's `useMemo` computes all views at line 467.
- **Reachability/readers:** `web/pages/projections/index.tsx:1663–1678` renders this component for the analysis view and passes current processed players and controls. `web/hooks/useProcessedProjectionsData.tsx:1452–1491` supplies parsed Yahoo average picks. This is a current source path, not evidence that a live visit crashed.
- **Suggested fix/test:** Separate overall aggregation from round orchestration, or give the internal aggregation an explicit no-round mode. Add an existing-test case with one admitted Yahoo pick and actual ID-keyed controls; assert finite completion even when no source contribution matches. Fixing source identity alone cannot fix recursion.

### AFULL-COMP11-02 — P1: selection IDs cannot match emitted source names

- **Location/claim:** `ProjectionSourceAnalysis.tsx:118–135,169–174`; selected configured sources should contribute to comparison metrics.
- **Evidence:** Probe `idMismatch`: `{ag_skaters:{isSelected:true,weight:1}}`, source contribution `{name:"Apples & Ginos",value:82,weight:1}`, projected GP 82, actual GP/points 15, and POINTS scoring 1 return all four ranking arrays empty. This fixture has no Yahoo pick, isolating the failure from 01.
- **Cause:** Selection keys are stable IDs; contribution admission tests `src.name` or `src.sourceId`. The actual producer emits only `name`, `weight`, `value`, with no `sourceId`. All nine built-in configuration IDs differ from their display names. Display names also repeat across skater/goalie configurations, so adopting names as permanent identity would remain ambiguous.
- **Reader/producer trace:** Config `web/lib/projectionsConfig/projectionSourcesConfig.ts:65–176`; controls initialized by ID and passed through `web/pages/projections/index.tsx:645–685,1663–1678`; producer `web/hooks/useProcessedProjectionsData.tsx:79–85,1170–1236`. The producer internally has the ID but omits it from `contributingSources`. No caller adapter repairs this mismatch.
- **Suggested fix/test:** Preserve stable source ID alongside display name in contributions; aggregate and select by ID. Extend the existing test with real config-ID/display-name pairs. Its current `SourceA` control/name identity cannot catch this defect.

### AFULL-COMP11-03 — P2: individual sources use the blended GP denominator

- **Location/claim:** `ProjectionSourceAnalysis.tsx:113–156`; a source's per-game projection and season-to-date comparison should use its own projected games.
- **Evidence:** Probe `sourceSpecificGp`: source A forecasts 82 points/82 GP, B forecasts 41 points/41 GP, combined projected GP is 61.5, and actual GP/points are 15. Expected source comparison is 15 points and 1 point/game for both. Actual A is 20 and 1.333333; B is 10 and 0.666667.
- **Cause:** Both source numerators divide by `combinedStats.GAMES_PLAYED.projected`. The nominal `perSourceProjectedGP` map also stores this same blended number and is never used. Producer lines 1170–1236 retain per-source GP contributions, so the requisite distinct denominators exist.
- **Reachability/readers:** Exported helper and all comparison views. P2 here because the current built-in source-ID failure masks admission; the fixture deliberately supplies matching names to isolate the denominator defect. No current live wrong value is established.
- **Suggested fix/test:** Join each numerator to its own GP contribution by stable source ID, retain unknown when absent, and add the two-source fixture to the existing proration tests. Preserve the existing valid single-source season-to-date fix rather than reverting it.

### AFULL-COMP11-04 — P2: missing scoring categories become a partial forecast against full actual points

- **Location/claim:** `ProjectionSourceAnalysis.tsx:118–140`; projected and actual fantasy points need common scoring support.
- **Evidence:** Probe `partialScoring`: GOALS and ASSISTS each worth 1, known source goals 41, source assists unknown, GP 82; actual goals 41 and assists 41. Output reports projected 41 versus actual 82, treating the absent source category as contributing zero. A full-score forecast should remain unknown, or both sides must explicitly compare only the known category (41 versus 41).
- **Cause:** The function sums any available contributing statistics without establishing complete scoring-category coverage, then compares this partial sum with `player.fantasyPoints.actual`. Producer-derived categories can also have empty contribution arrays (`useProcessedProjectionsData.tsx:1395–1405`), reinforcing that absence is not proof of zero.
- **Reachability/readers:** Source error, accuracy, bias and quality rankings. P2 under the current ID-admission mask; this is a pure contract counterexample, not a retained live player result.
- **Suggested fix/test:** Establish required scoring-category coverage per source; withhold incomplete full-score comparisons or use an explicitly disclosed common-support calculation. Add a missing-source-category fixture distinct from a known zero value.

### AFULL-COMP11-05 — P2: position error columns repeat the global error

- **Location/claim:** `ProjectionSourceAnalysis.tsx:389–407`; position-specific error columns should describe their position cohort.
- **Evidence:** Probe `positionError`: one center with projected/actual total 10/10 and one defenseman 10/30, each with 10 actual games. Expected total mean absolute errors are C=0 and D=20 (per-game 0 and 2). Both positions return total error 10 and per-game error 1.
- **Cause:** The position builder selects position-specific accuracy/count but copies `m.averageMarginOfError` and `m.averageMarginOfErrorPerGame` from the source's whole population. Position buckets already collect errors.
- **Reachability/readers:** Position-ranking table, including the selected total/per-game view. P2 while current built-in IDs block aggregate admission. The exact-source fixture uses matching display-name controls to isolate the problem.
- **Suggested fix/test:** Compute mean absolute errors from each position bucket and retain those in `positionMetrics`; test unequal errors across two positions. No ranking percentile semantics are inferred from these ordinal tables.

### AFULL-COMP11-06 — P2: bias direction labels are reversed

- **Location/claim:** `ProjectionSourceAnalysis.tsx:246,960–978,1033–1036`; label direction should agree with error sign.
- **Evidence:** Probe `bias` evaluates the exact UI conditional after the exact estimator: projection 10, actual 20 yields `actual - projection = +10`, displayed as **Over-projects**. This is under-projection. Positive bias also selects the over-bias style; negative values reverse the same way.
- **Readers:** Detailed metrics and bias color presentation. Label-only P2, additionally masked for the current built-in source contract. Numeric error sign itself is internally consistent.
- **Suggested fix/test:** Reverse the direction labels/styles, or consistently change the sign definition and all consumers. Add positive, negative and zero examples rather than asserting text without tying it to computed error.

### AFULL-COMP11-07 — P2: empty legacy history preserves another date window

- **Location/claim:** `web/components/Predictions/PredictionsLeaderboard.tsx:96–114`; sparkline history should remain inside the requested date context.
- **Evidence:** Exact `sparklineMap` callback extraction, probe `emptyNewSparkWindow`: old map for player 1 contains `2026-11-14,value=8`; a new `asOfDate=2026-10-01` context returns no history. The callback returns the same November point, which is beyond the new as-of date. The fixture explicitly supplies the prior ref and empty new result; no React execution occurred.
- **Cause:** Empty history or disabled sparklines return `previousSparkMap.current`, whose identity omits the query/window. The quarantined hook also retains old data during subsequent loading/error; that is not evidence of new-context data.
- **Reachability/readers:** `PlayerTable` sparklines if this component is mounted. A TS/TSX search across `web` found only the declaration/error log and quarantine registry string, with no current caller. Therefore P2 dormant, not a current page-incidence claim.
- **Suggested fix/test:** Scope any retained map to the complete query identity and clear it for a successful empty new result or disabled history. Add a date-context transition test; retain loading status separately from evidence for the current window.

## PP clock, missingness and reader review

`PowerPlayCombos.tsx:166–434` validates selected game metadata against requested season/team before roster and unit reads. It groups unit 1/2/3, sorts by PP TOI for membership, limits each to five, and loads at most five prior same-team/season games. The qualified-clock request covers the current and retained historical game IDs. Missing/failed current context clears units. Serving off preserves legacy units by the documented contract; when serving is on, unavailable/not-applicable current clocks suppress current units with the corresponding notice, and only available historical clocks survive. The imported hook requires `servingEnabled===true`; the serving helper distinguishes positive integer clocks, exact zero, and unavailable, and rejects PP time above the clock. No clock formula is re-derived here. Atomic writer/shift intersection were not re-audited in this component batch.

`PowerPlayCombos.tsx:490–590` derives PPA as observed PPP minus PPG and counts NHL rows for GP. FORGE shots and seconds are independently required across the same NHL game-ID set; partial or failed FORGE coverage stays unknown. Seconds are divided by GP and displayed explicitly as model input, not observed qualified PP-clock share. Shot share (`436–480`) is a different team-season shot fraction and converts to percent once. Cards round total seconds before formatting minutes/remainder, avoiding `1:60`. The current Lines caller (`web/pages/lines/[abbreviation].tsx:300–338`) passes season/game/team and its stats window. The fallback internally uses up to ten unique game IDs from a bounded 250-row read; its season/window assumptions are not production-verified here. Duplicate-row safety depends on upstream table contracts; this batch supplies no evidence of actual duplicates. Generated types declare NHL PPG/PPP nonnullable; the component's nullish fallback alone is not used to claim a reachable new missing-value bug.

The PP tests use controlled mock query queues and fetch responses. They independently check concrete same-games arithmetic, clock-state presentation, and requested filters, but do not execute actual database filtering or prove historical clock qualification. Their synthetic `computedAt` value is fixture data, not a retained production receipt. No new Decision 152 failure was established.

## Other numeric and test conclusions

`weightedHitRate` pools finite known hit rates by positive sample count, excluding unknown rates from both numerator and denominator. Existing tests independently pin 0.725 for rates 0.5/100 samples and 0.8/300 samples, retention of a lone known 0.5 despite 300 unknown samples, and null for all unknown. Input range/infinite sample validation is not independently established by these tests; no reachable malformed upstream fixture is claimed. Metric-card percentage conversion and display rounding are consistent with fractions. This is sample-weighted hit rate, not proof of predictive validity.

The legacy VDP table/explainer disclose the five-appearance horizon, unshrunk short-history blend, and discount assumptions. No conversion to current SKO or qualified forecast occurs in these files. Leaderboard query fields pin model/version/horizon consistently through `useQuarantinedPredictionsSko`. Its retry branch fetches and discards a response without changing the hook's query dependency; this is a dormant UI limitation, not an additional numeric finding. No retired champion output is reactivated by these nine files; upstream model qualification remains outside this bounded batch.

Source-analysis formulas use absolute errors for MAE/median, signed actual-minus-projected error for bias, and relative error against projection for the named accuracy. The combined quality score is a heuristic mixing percentage terms with fantasy-point error and bias penalties; it is not a calibrated accuracy probability or held-out model qualification. Ordinal ranks are sequential after metric sorting, not mid-rank percentiles. The tests contain no independent multi-source, mixed-position, missing-category, or draft-round oracle. Existing single-source proration tests remain useful but do not close findings 01–06.

## Verification and limits

- **Passed:** full nine-file reading; target/current SHA-256 equality; bounded support-file hash equality; exact-source isolated probes for all seven findings; retained-output assertions; 492 unique character-offset identities and full nine-path TSV coverage.
- **Probe boundary:** Node built-ins and TypeScript parser/transpiler only; exact extracted pure functions/callbacks in a VM with a one-second timeout. No production imports, React hook execution, app/test changes, or repository test runner. Successful probes were reused, not rerun. Complete scripts and outputs are embedded in the manifest so `/tmp` persistence is not required.
- **Not run:** Vitest, application/server/browser, database, provider/network calls, production page checks or predictive holdouts. No live availability/incidence or historical corruption claim.
- **Remaining:** Chef adjudication/integration; scoped files after Projections belong to later batches. No unread file remains within this assignment. Fix suggestions are review guidance only; nothing was implemented.

## Root adjudication

Full report and critical producer/reader branches reviewed. All proposed findings accepted at their stated severities. Current hashes independently match the pinned target for every assigned path. Retained exact-source probes reviewed, not rerun; no live incidence or app-runtime pass asserted. Whole-file credit is limited to the assigned scope paths.
