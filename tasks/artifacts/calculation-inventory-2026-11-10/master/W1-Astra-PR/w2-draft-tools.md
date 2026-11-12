# W2-5 draft tools: independent peer review

2026-11-11. Review of Fable's [draft-tools audit](../audits/draft-tools.md), committed as **68d907dc20e186f974509a590be49424d0b994a0**, on the canonical `octoberBranch` checkout on Tim's Mac. The review started at that HEAD. During the review, HEAD advanced through concurrent social-share and audit-document work to `76b25fb8f`; a scoped comparison found no changes in the inspected draft, scoring-input, mock or community implementation paths. Existing unrelated working-tree changes were preserved. Paths are relative to `web/` unless otherwise stated.

Read with the [Wave 2 brief](../wave2-prompts/w2-5-draft-tools.md), [owner decisions 1–68](../OWNER-DECISIONS.md), Batch A/B/C consolidated rules, and the [fantasy-scoring](fantasy-scoring.md) and [SQL](w2-1-sql-cross-cut.md) peer reviews. This is an addendum, not an edit to Fable's report. Only this report was saved. No application edits, database access, provider calls, production requests, installs, builds, deployments, pushes or commits.

## Assessment

**Retain the candidate-relative VONA defect, moving replacement baseline, category-need unit mismatch and missing-value concerns. Correct the headline live Source Accuracy claim, the proposed replacement algorithm and several purportedly mandatory invariants. Do not carry the already-withdrawn Human Mock ADP finding into the fix plan.**

The strongest independently reproduced results are:

- Three centres valued **100, 99, 0**, two teams with one C slot each, one opposing pick: baseline recommendation scores **42.58, 92.07, −6.93**. The 99-point player beats the 100-point player before risk or needs adjustments because his private VONA baseline looks below him rather than at the same future alternative.
- Four centres valued **100, 90, 80, 70**, two C slots league-wide: removing the 100-point player changes replacement **80 → 70** and his own recalculated VORP **20 → 30**. There was no projection change.
- An unrelated **−1000** candidate changes a needed player's personalized score **90 → 540**, reversing the winner. The adjustment scale is the maximum **absolute** score, not necessarily the best player's score.
- A source with exactly correct per-game goals scores **0%** in total mode and **100%** in per-game mode. However, **no checked-in runtime consumer of `ProjectionSourceAccuracy` was found**. Its “live P0” classification is not supported by the inspected call graph.
- Missing points become **0**, above a genuinely measured **−5**. Missing categories were already caught in the fantasy-scoring peer review; the points branch also needs the unknown-data contract.

All new numeric examples here are **small synthetic offline fixtures**, not real draft outcomes. Fable's 473-player experiment remains its reported, dated real-projection/synthetic-ADP experiment. Its magnitudes, source counts and deployed-state assertions were not independently replayed. I do not certify the complete **22 Sound / 23 Mis-specified / 6 Wrong** tally: four “Sound” entries are explicitly description-level in the audit, some upstream verdicts are superseded, and several remaining items are product-policy questions rather than demonstrated formula errors.

## 1. Source accuracy: real arithmetic problem, unsupported live reach, incomplete remedy

### 1.1 Remove the unverified live P0 claim

`lib/draftDashboard/sourceAccuracy.ts:73-94` does calculate mean absolute relative error with a 0.01 denominator floor, then clamp `100 − error` to [0,100]. The component defaults to total mode (`components/DraftDashboard/ProjectionSourceAccuracy.tsx:15-16`). The 84-versus-15 GP, 42-versus-7.5 goal fixture returns **460% mean error / 0% accuracy**, versus **0% / 100%** per game. One projected SH goal against zero actuals returns **10,000% error**. These mechanisms are verified.

But the tracked-source search

```sh
git grep -n -E 'ProjectionSourceAccuracy|calculateSourceAccuracy' -- web
```

finds only the component, helper and their two test files. There is no import or render from a page, Dashboard, ProjectionsTable, or other runtime component. Classify **M-DRF-021 as an unwired component in the inspected source; production reach unverified**, rather than “the panel shows 0% for every source now.” Do not activate it merely to fix or test it. The rate-only fixture in the appendix also returns 100% in total mode, so “every source” is not an algebraic consequence of this helper either.

Separate **M-DRF-010**: current-season actuals are fetched at `hooks/useProcessedProjectionsData.tsx:609-653`; per-stat differences are emitted at `:1200-1204`; fantasy-point differences are computed at `lib/draftDashboard/fantasyPointRecalculation.ts:17-24,47-68`. Those active calculations can compare year-to-date actuals with full-season projections. They are not Source Accuracy readers and must be fixed or labelled independently.

The component already discloses “currently loaded source values,” no preseason-vintage claim, the total/per-game definitions, and its scoring formula (`ProjectionSourceAccuracy.tsx:23-26,46-60`). Preserve that disclosure. A displayed difference between these two totals is arithmetically valid if clearly described; calling it forecast accuracy or a comparable forecast-error ranking is the problem.

### 1.2 New: source ranks use different observation populations

`sourceAccuracy.ts:43-58,76-98` buckets only the finite projections supplied by each source and sorts their resulting scores. Its coverage denominator is **that source's supplied stat observations**, not a common player/stat universe. Thus 100% coverage can mean entirely different comparison tasks.

Executed fixture: actual goals=10 and assists=10. Source A supplies goals=10, assists=20; B supplies only goals=11. A scores **50**, B **90**, both with **100% coverage**. A is better on their sole shared stat, but B wins the displayed ranking because it does not supply the harder observation. This is a comparator/population problem, not evidence that either source is more accurate in real data.

**Repair before activation:** choose stat, cohort, horizon and forecast vintage explicitly; report per-stat proper scores and paired/common-support source comparisons, plus distinct coverage against the intended universe. Show unmatched observations separately. Do not allow omitted stats to masquerade as superior accuracy. Standardize a cross-stat score only with a documented fixed reference scale; replacing percentage error with squared error on each source's different support does not solve the comparison.

**Qualify Fable's fix/test:** per-game evaluation assesses rate prediction, not projected availability/season totals. Evaluate workload separately rather than making injury/GP errors disappear by pacing. A perfect-rate fixture may have zero *rate* error at any positive GP, but it need not have perfect total-forecast accuracy. With squared error, a zero actual is well-defined, but error is not globally bounded as the projection grows; use a finite, exact expected-loss assertion, not an unqualified “bounded effect.” Decision 65 remains binding. Current retrospective inputs are not automatically a held-out preseason evaluation.

## 2. Recommendations: keep D2, tighten the definition and test

### 2.1 Source-to-consumer chain and executable inversion

`useVORPCalculations.ts:166-180` estimates positional departures from the first N available ADP-ranked players, splitting each multi-position player across eligible positions. At `:219-227` it then uses **the candidate's own current position rank plus departures**, floored, as that candidate's alternative. `:253` blends:

`VBD = .6 VORP + .3 VONA + .1 VOLS`.

`hooks/usePlayerRecommendations.ts:57-79` consumes the metrics and sets:

`baselineScore = .7 VBD + .3 VONA = .42 VORP + .51 VONA + .07 VOLS`.

Expanded in one selected position, this is exactly Fable's value minus `.42 replacement + .51 next-baseline + .07 last-starter`. The double inclusion and the candidate-relative cliff are real.

For C values [100,99,0], ADP [1,2,3], T=2/C=1 and N=1:

| Candidate value | VORP | VOLS | VONA | VBD | Baseline score |
|---:|---:|---:|---:|---:|---:|
| 100 | 100 | 1 | 1 | 60.4 | 42.58 |
| 99 | 99 | 0 | 99 | 89.1 | 92.07 |
| 0 | 0 | −99 | 0 | −9.9 | −6.93 |

This inversion requires no model calibration claim. A common future-position baseline removes this particular cliff advantage. The 51% coefficient is not intrinsically a mathematical error: it is the effective heuristic weight, to be exposed and deliberately chosen/validated rather than characterized as a universally forbidden coefficient.

**Readers verified:**

- Dashboard computes the global and optional personalized maps separately (`DraftDashboard.tsx:2332-2366`).
- Suggested Picks uses the common hook for the local path (`SuggestedPicks.tsx:303-323`) and the same candidate builder for the Pro request (`:338-359`). Returned Pro scores are consumed at `:364-382`.
- The local path alone adds `.25 × (1 − availability) × max(0,VBD)` (`:404-415`). Pro success bypasses it; during remote fallback the local calculation remains. This is an additional rank policy, not part of the `.42/.51/.07` equation.
- My Roster consumes the hook at `MyRoster.tsx:142-153`; Pro scenario/report adapters consume global VORP, not this ranking score (section 3).

Do not assume Free/Pro policy parity is already an owner requirement. Make the difference explicit and test the intended fallback behavior. Nevertheless, simply fixing the hook while overlooking the local risk term would leave different final recommendation behavior.

### 2.2 Corrections to the proposed VONA remedy

- “VONA is negative for anyone who is not best at his position” is false when several players are expected to leave. For [100,90,80] and one departure, a common second-player baseline gives [10,0,−80]; with two departures it gives [20,10,0]. Negativity depends on the selected alternative, not only being second-best.
- Flooring fractional departures loses whole selections. In the executed miniature with A=C/LW=100, B=C=99, C=LW=1, ADP [1,2,3], N=1, the code assigns `.5 C + .5 LW`; **all three VONAs are 0**. This is source behavior, not a claim about actual opponent probabilities.
- Linear interpolation removes that discontinuity, but **value at the expected rank is not generally the expected value of the best survivor**. Multi-position eligibility, which player is actually taken, your own current selection, missing ADP and room needs must be accounted for in a declared deterministic or probabilistic departure model. Do not claim calibration from interpolation.
- The dominance regression belongs to the **base value score with identical eligibility, common baselines and other adjustments held fixed**. Different survival probabilities, fit priorities or lineup effects can legitimately alter final draft recommendations. A blanket final-score dominance rule can prohibit sensible wait-and-pick behavior.

**Required tests:** the explicit cliff fixture; zero opposing picks; one selected dual-eligible player removed once; tied values; missing ADP; and common-baseline recomputation. Select blend weights using replay/held-out draft decision performance against a simple value/VORP baseline, not an arbitrary percentage. No such empirical superiority was established in this review or by Fable's synthetic ADP replay.

## 3. Replacement: retain drift, reject greedy/pooled substitutes as proofs

### 3.1 Current drift reaches totals, awards and captured comparisons

`useVORPCalculations.ts:125-153` keeps the same league-wide index while switching to the shrinking available pool. Default Dashboard mode is remaining (`DraftDashboard.tsx:588-590`); global metrics explicitly disable personalization (`:2347`). The four-centre fixture confirms replacement 80→70 and held-player VORP 20→30 after one pick. Full mode remains at the same original reference if projections/settings are frozen.

Verified consumers:

- Team VORP sums the **current** metric map for held players (`DraftDashboard.tsx:2493-2497`).
- Summary “top VORP pick” reads that map (`DraftSummaryModal.tsx:240-258`). Draft winner combines normalized projected points and team VORP, 60/40 (`:260-278`). Relative awards can change when positional baseline changes differ across teams; not every draft state necessarily flips an award.
- `scenarioDashboardAdapter.ts:73-98` and `reportDashboardAdapter.ts:66-80` copy current `metric.vorp` into `globalVorp`. `scenarios.ts:55-57,67-72` sums it as `rawVorp` and uses it as candidate delta. Thus captures from different baseline states need not be comparable. This does **not** prove an already-saved immutable report mutates after saving.

**Repair:** define separate versioned reference valuation and draft-state opportunity valuation. If awards/history are intended to compare drafts on a common basis, use one frozen **full-league reference** with its settings, projection vintage, eligibility and cohort. Merely freezing each player's *moving* VORP at his pick embeds a different comparator for every player and rewards pick timing. Fable's wording includes a full-pool reference; retain that qualification, not “freeze at pick” alone.

For a dynamic board, subtract actual league-wide assigned obligations, not my filled slots multiplied by T (`useVORPCalculations.ts:127-135`). An available-pool alternative can legitimately change after a pick; “never moves” is only a valid test for the separate fixed-reference metric. Store enough baseline/version metadata to compare or explicitly decline cross-version comparisons.

### 3.2 Multi-position, UTIL and bench require one-player/one-slot constraints

Independent pools are verified (`forwardGrouping.ts:133-158`). UTIL is allocated only to forwards (`useVORPCalculations.ts:61,92-105`), whereas the dashboard allocator actually permits any non-goalie in UTIL (`forwardGrouping.ts:243-246`). The latter is useful existing contract evidence for the owner question, not proof of a provider-specific rule in every league. Bench inclusion and replacement estimand still need an explicit policy, especially under decision 62.

Fable's **247 pooled-forward baseline is not a demonstrated “true assignment”** for C2/LW2/RW2/UTIL1. Removing position constraints can select an infeasible forward set. No retained matching result proves its real-projection pool attains that value under the original slots. The reported 20–26 point difference is a comparison against a **relaxed pooled-forward benchmark**, not a measured correction.

Executed exhaustive two-slot counterexamples:

| Players and slots | Greedy C then LW | Optimal legal total | Unrestricted top-two total |
|---|---:|---:|---:|
| A C/LW=100, B C=99, C LW=1; C1/LW1 | 101 | 199 | 199 |
| A C=100, B C=99, C LW=1; C1/LW1 | 101 | 101 | 199 |

The first invalidates a literal greedy “fill C, LW, RW, D, G, then UTIL” remedy; the second invalidates using unrestricted forwards as a correctness oracle. These are proof fixtures, not simulations of a specific league. An assignment solver must permit reassignment and enforce each player once, eligibility, required slots, UTIL, bench and goalie rules. Existing `allocateGroupedRosterSlots` can reassign occupants, and mock feasibility uses augmenting/max-flow methods; neither by itself defines the intended weighted replacement-price calculation.

**Replacement must be defined, not inferred from a solver name.** After finding a feasible/optimal rostered population, specify whether each player's metric uses an undrafted alternative, an opportunity-cost/marginal removal calculation, or a documented positional threshold. Those are not identical quantities with flexible eligibility. Validate small cases against exhaustive enumeration before scaling.

Withdraw D4's test “the number of players above replacement across positions equals starting slots.” Ties make strict-above counts smaller, overlapping pools double-count identities, and marginal values are not a count of starters. Instead test legal capacity, uniqueness, optimum total against enumeration, tie handling, and the **chosen** replacement definition. “Best undrafted at draft end” is conditional on that definition and the bench/rostered-depth policy, not a universal VORP law.

## 4. Need weighting and missing inputs: stronger, executable issues

### 4.1 Maximum-absolute scaling makes unrelated tail values control the top choice

D5 correctly quotes the formula but describes its scale as the “single best player.” Actual code is `max(1, max(abs(baselineScore or rankValue)))` (`lib/draft-pro/recommendations.ts:172-179`). A negative tail can control it.

Executed: A=C score100, B=LW score40; needs C0/LW1; alpha=.5. Scores are A100/B90. Add an otherwise irrelevant C candidate scoring −1000. A stays100, B becomes **540**, tail stays−1000. This exposes reference-cohort instability beyond Fable's positive-top-player example.

Category needs also fail a unit-change fixture: two equal-base candidates GOALS/HITS=[2,0] and [0,2], needs=[1,1] initially tie at 0. Express hits in doubled units, changing both hit projection and hit deficit to 4 and 2, without changing the underlying situation: the hit candidate gets **0.117851**, the goal candidate0. The z-scores themselves are scale-invariant; the raw deficit is not.

The source of those raw deficits is `DraftDashboard.tsx:2615-2646`, six hard-coded skater keys. The endpoint normalizes candidate-pool z fit at `recommendations.ts:119-179`. Ratio/goalie needs cannot be repaired by simply adding raw ratio differences to this vector; use roster-level numerators/denominators, minimums and league direction under decisions 55/62.

**Repair/tests:** fix the pressure units and use an explicit, robust, versioned decision-cohort scale with a declared maximum adjustment. Test the negative-tail insertion, unit conversion and irrelevant filter changes. A “next round” spread is a candidate design, not proven optimal. Withdraw “a player three rounds worse never passes one with no need” until the owner has chosen that cap and the round/rank definition; it is not a mathematical invariant.

**Consumer correction:** My Roster's hook call omits `leagueType`, `catNeeds`, `categoryWeights`, personalized replacement and `selectionHorizon` (`MyRoster.tsx:142-153`). Therefore it uses the default points-style positional fit even when its supplied base VBD came from category values, and availability is null. Fixing category pressures only at the Pro endpoint does not automatically make My Roster category-aware. Decide/label whether it should offer positional-only advice or pass the same context; don't attribute executed category-fit behavior to that call today.

### 4.2 New: points inputs also turn unknown into average/zero

`playerValues.ts:34-41` maps null/missing/nonfinite projected fantasy points to numeric0. The hook then inserts those values into position/replacement pools and emits numeric VORP (`useVORPCalculations.ts:108-121,186-199`). Executed points fixture [null,−5] produces [0,−5], so the wholly unknown player can outrank a supported negative-valued one. This is conditional on incomplete inputs, not a measured production incidence.

`fantasyPointRecalculation.ts:31-48` also emits a numeric subtotal once **any** enabled stat is present, with no completeness marker. A partial line and a complete line can therefore look comparable before replacement is computed. The same category-side issue is already established in [fantasy-scoring R1](fantasy-scoring.md); do not record it as an independent discovery here.

**Repair:** propagate completeness/coverage separately from value, preserve measured zeros, and exclude unknown or unsupported comparable values from automatic ranking and replacement references unless an explicit fallback is chosen and labelled. Test all-missing and partially missing scoring inputs, real zero, negative complete goalie value, and every table/recommendation/scenario reader. A report adapter's finite-number check does not detect an upstream fabricated zero.

## 5. Category conclusions need the existing peer-review corrections

Retain the full-pool versus league-aware valuation issue (`playerValues.ts:44-87`), wrong Score tooltip (`ProjectionsTable.tsx:1267-1271`), and points-based category draft-winner formula. Standings uses mean player z across starters **and bench** (`LeagueStandings.tsx:58-77`); round history has the analogous mean (`roundRankHistory.ts:37`). A roster mean is not a projected categorical outcome.

But “add any below-average player lowers standings” needs **below the current team mean**, not just below the league mean. Adding −1 to a −2 team raises the mean. More importantly, replacing mean by “sum over starting slots” alone does not satisfy decision 62: ratio effects, workload, minimums, eligibility, schedule and lineup replacement matter. Establish whether the label represents projected category outcomes, a roster-quality summary or drafting value; retain these distinctions in tests.

Do not resurrect the original fantasy-scoring D6 claim that recommendations lose negative weights through `Math.abs`: the earlier peer review corrected it. `enabledCategoryWeights` preserves sign (`recommendations.ts:71-74`); the absolute value at `:133` is in normalization. Remaining provider-direction and standings/report inconsistencies need their actual readers, not that disproven explanation. Likewise, multiplying a signed z by a position multiplier can deliberately mean “more extreme at this position”; determine whether the UI promises an additive boost before declaring all negative-score multiplication inherently wrong.

## 6. Other audit corrections that affect the fix plan

### 6.1 Human Mock ADP: carry the SQL peer review forward

Withdraw the inherited M-DRF-002/004 “ADP must be the mean over all drafts” verdict. The UI says **Human Mock ADP · Provisional**, human selections, past 30 days, equal contributor weighting, bot influence on availability and not real-league ADP (`MockAdpBoard.tsx:72-77`). SQL computes per-user means then their mean, with contributor thresholds (`supabase/migrations/20260917133519_mock_draft_adp.sql:115-141`, relative to repository root). This is already resolved in [SQL C3](w2-1-sql-cross-cut.md).

Deployment absence remains Fable-reported, not rechecked. Flags default off (`lib/mockDraft/flags.ts:10-12`); missing ADP RPCs do not alone prove every local mock-engine flow is unavailable. Retain D13's raw-vs-effective roster mismatch: slot construction groups the config (`engine.ts:74-81`) but baseline/surplus calculations read raw `config.roster[pos]` (`:218-227,260-261`). Test **two equivalent FWD representations**, not demand identical results from a flexible FWD league and a genuinely position-constrained split league. The latter have different feasible rosters. No engine replay was run here.

### 6.2 Community ranking: prior sensitivity is real, but Fable's source and fix are too simple

Candidate loading is **not every identity**: it selects verified identities in three active lifecycle states (`communityServer.ts:157-168`) and joins prior-season Yahoo data (`:170-215`). A stale total-table statistic of 4378 is not the candidate count. Fable's local algebra using F=4378 should not be presented as the model's measured effective population or exact rank displacement.

`communityModel.ts:256-276` does make prior locations depend on candidate count. Offline, with 300 market ranks and no comparisons, the score gap between ranks 149/150 is **0.01250793**. Adding 300 unranked candidates changes it to **0.00838007**, and rank 150's score from **0.00625369 to 1.03607722**. Both fits converge. This proves sensitivity, not its empirical harm.

Do not simply set F to ranked-field size while leaving unranked prior scores at 0. With F=300, ranks151–300 have negative means/scores, while an unranked no-evidence candidate has0; the proposed remedy can put unknown players above half the ranked field in the latent ranking. Redesign ranked and unranked priors together and specify the transformation from ADP (not necessarily an ordinal rank), disconnected components and evidence decay. Test empty/unranked additions, a ranked-versus-unranked pair and held-out comparisons. No fixed field-size choice has been empirically qualified here.

The established-evidence admission branch does tighten at `communityModel.ts:392-398`; that is a policy discontinuity worth reviewing. Requiring admission to be monotone in the *amount* of evidence is not universally valid: new negative evidence should sometimes remove an incumbent. Test quality and composition of evidence, not only counts. Stability buffers are heuristic rank buffers, not calibrated confidence intervals.

### 6.3 Distinguish alternative definitions from demonstrated defects

- **M-DRF-020:** `scheduleMetrics.ts:26-51` explicitly counts NHL opportunities and uses ≤8 games for the raw off-night count. The table labels it “Off-night opportunities” (`ProjectionsTable.tsx:2392`). Decision53 rejects unvalidated fixed **value multipliers** and asks for usable-game measurement; a conventional, disclosed raw slate count is not by itself a wrong multiplier. Keep raw count separate from measured lineup-fit value. Do not carry a “Wrong” verdict solely from finding the number 8.
- **D9 steal/reach:** pick−ADP is a coherent absolute-pick comparison (`DraftSummaryModal.tsx:202-236`). Standardizing by draft-position spread changes the metric; it may be useful, but “nearly always a late pick” was not measured. Treat normalization as a proposed enhancement unless the label promises a standardized surprise.
- **D10 bands:** colors over filtered undrafted players are real (`ProjectionsTable.tsx:924-975`), but a changing cohort can legitimately change percentiles. State the cohort or choose a fixed one deliberately. The compare modal's missing→50 and missing/zero-GP→0 are real unknown-data problems (`ComparePlayersModal.tsx:151-160,194-214`). Its per-stat pool filters finite values (`:133-136`), so merely passing skaters and goalies together does not prove that goalie SV% contains skater rows. Test the actual eligible/observed population.
- **D12 blending rates:** equal-weight averages of source rate forecasts are not intrinsically invalid. For rates .900/.950 on forecast exposures 100/1000, the rate ensemble is .925, whereas deriving a rate from equal-weight counts gives .945455. They answer different ensemble policies. Choose a coherent-stat-line contract if pooled components are wanted; preserve source support and label rate-only fallbacks. Partial per-stat renormalization can break identities such as P=G+A; use common component support or mark incoherence, rather than silently invent missing components.
- **D11/default labels:** keep decision 54's source/default-weight disclosure requirement. A grep absence is a useful lead and the defaults arithmetic can still be sound, but verify the active settings surface and provider mapping before claiming every connected user sees the fallback defaults.

## 7. Evidence, limits and implementation gate

### Evidence status

1. Source trace and the synthetic executions above establish mechanisms at the reviewed checkout, not deployed prevalence. The Source Accuracy reach correction materially changes its priority: repair before activation, rather than an established live P0. The active draft-ranking mechanisms remain high-priority draft-season fixes; their current deployed incidence was not measured.
2. **Five existing test files, 30 tests passed** in 2.36 seconds, with inert Supabase credentials and one worker:

```sh
NEXT_PUBLIC_SUPABASE_URL=https://unit-tests.supabase.invalid \
NEXT_PUBLIC_SUPABASE_PUBLIC_KEY=synthetic-public-key \
SUPABASE_SERVICE_ROLE_KEY=synthetic-service-role-key \
./node_modules/.bin/vitest run \
  lib/draftDashboard/sourceAccuracy.test.ts \
  lib/draftDashboard/forwardGrouping.test.ts \
  lib/draft-pro/recommendations.test.ts \
  hooks/usePlayerRecommendations.test.tsx \
  __tests__/components/DraftDashboard/ProjectionSourceAccuracy.test.tsx \
  --maxWorkers=1
```

These tests exercise current behavior; they do not certify the disputed mathematical contracts. In particular, passing a component render test does not demonstrate that a production page renders that component. No full suite, lint/typecheck, app build, browser or production test was needed for this report-only review.

3. An initial inline fixture command had a missing closing brace and did not execute. A later shell-quoted extraction attempt also failed before executing the runner. Both were corrected; the final appendix runner was then extracted through Python and executed successfully from the saved report. No scratch source/test files were left in the checkout.
4. Fable did not retain its 473 input rows or scratch script. Q5 gives a query recipe, not a frozen source snapshot; synthetic ADP specifies an LCG seed but not its recurrence/constants, and ties in value/order lack a stable player-id rule. Queries with ellipses are not complete runnable SQL. Consequently the inversion counts, replacement magnitudes and need-rank movement are **reported results**, not exactly reproducible from the committed audit alone. Retain data/version hashes, exact queries, IDs/tie order, RNG algorithm and executable script before relying on those figures to size an implementation.
5. Population/calibration evidence is still missing for revised VONA departure models, need scales, availability spreads, community priors/admission and roster-value policies. The normal survival ratio is mathematically consistent; a low conditional survival probability after surviving past ADP is not itself a contradiction, because normal hazards rise in the tail. That scenario motivates model validation rather than proving a formula bug.

### Readiness for the fix plan

Carry forward source-supported defects and the three additions here (comparison support, negative-tail sensitivity, points unknown handling). Keep owner choices limited to genuinely unsettled semantics: reference versus dynamic replacement, roster/bench/UTIL contract, score policy and team-summary interpretation. Do not ask the owner to choose magic coefficients in lieu of replay evidence. Preserve the existing decisions about league-aware pools, signed direction, unknown data and proper scoring. No deployment, deletion, model activation or source-weight change is authorized by this report.

## Appendix: small offline reproduction runner

Run from `web/` with the installed TypeScript dependency. This reads the actual source files, transpiles a whitelist in memory, and supplies only `React.useMemo(f)=f()` for the pure calculation hook body. It does not mount React, access a database or exercise the browser. The assignment enumeration is a standalone correctness oracle for the proposed algorithm, not existing application code. Community computation is the actual exported function, with only Node's local crypto import allowed.

```js
// node <<'NODE' ... NODE
const fs = require('fs'), path = require('path'), vm = require('vm');
const ts = require('./node_modules/typescript');
const allowed = new Set([
  'hooks/useVORPCalculations', 'hooks/usePlayerRecommendations',
  'lib/draftDashboard/forwardGrouping', 'lib/draftDashboard/playerValues',
  'lib/draftDashboard/availability', 'lib/draftDashboard/sourceAccuracy',
  'lib/draftDashboard/fantasyPointRecalculation',
  'lib/projectionsConfig/proration', 'lib/projectionsConfig/fantasyPointsConfig',
  'lib/scoring/categoryScores', 'lib/draft-pro/recommendations',
  'lib/draft-ranker/communityModel'
]);
const cache = new Map();
function load(key) {
  if (cache.has(key)) return cache.get(key).exports;
  if (!allowed.has(key)) throw Error('Blocked import: ' + key);
  const module = { exports: {} }; cache.set(key, module);
  const code = ts.transpileModule(fs.readFileSync(key + '.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  function localRequire(name) {
    if (name === 'react') return { useMemo: f => f() };
    if (name === 'node:crypto' && key === 'lib/draft-ranker/communityModel') return require(name);
    return load(name.startsWith('.')
      ? path.posix.normalize(path.posix.join(path.posix.dirname(key), name)) : name);
  }
  vm.runInNewContext(code, { module, exports: module.exports, require: localRequire }, { filename: key });
  return module.exports;
}
const calc = load('hooks/useVORPCalculations').useVORPCalculations;
const candidates = load('hooks/usePlayerRecommendations').buildRecommendationCandidates;
const recommendations = load('lib/draft-pro/recommendations').buildPersonalizedRecommendations;
const accuracy = load('lib/draftDashboard/sourceAccuracy').calculateSourceAccuracy;
const player = (id, value, eligibility = ['C']) => ({
  playerId: id, fullName: 'P' + id, displayPosition: eligibility.join(','),
  eligiblePositions: eligibility, yahooAvgPick: Number(id),
  fantasyPoints: { projected: value }, combinedStats: {}
});
const metrics = (players, extra = {}) => calc({ players, availablePlayers: players,
  draftSettings: { teamCount: 2, rosterConfig: { C: 1 } }, picksUntilNext: 1, ...extra });
const out = {};
let players = [100,99,0].map((v,i) => player(String(i+1),v));
let result = metrics(players);
out.cliff = candidates({ players, vorpMetrics: result.playerMetrics }).map(p => [p.id,p.baselineScore]);
players = [100,90,80,70].map((v,i) => player(String(i+1),v));
out.moving = [0,1,2].map(n => {
  const r = metrics(players, { availablePlayers: players.slice(n) });
  return [n,r.replacementByPos.C.vorp,r.playerMetrics.get('1').vorp];
});
players = [player('1',100,['C','LW']), player('2',99,['C']), player('3',1,['LW'])];
result = metrics(players, { draftSettings: { teamCount: 1, rosterConfig: { C:1,LW:1 } } });
out.dual = { departures: result.expectedTakenByPos, vona: [...result.playerMetrics].map(([id,m]) => [id,m.vona]) };
function stat(key, actual, values) {
  return { actual, projectedDetail: { statDefinition: { key, dataType: 'number' },
    contributingSources: Object.entries(values).map(([name,value]) => ({ name,value,weight:1 })) } };
}
const perfect = { combinedStats: { GAMES_PLAYED: stat('GAMES_PLAYED',15,{A:84}), GOALS:stat('GOALS',7.5,{A:42}) } };
out.perfect = ['total','perGame'].map(mode => accuracy([perfect],mode));
out.zero = accuracy([{combinedStats:{SH_GOALS:stat('SH_GOALS',0,{A:1})}}],'total');
out.support = accuracy([{combinedStats:{GOALS:stat('GOALS',10,{A:10,B:11}), ASSISTS:stat('ASSISTS',10,{A:20})}}],'total');
out.rateOnly = accuracy([{combinedStats:{SAVE_PERCENTAGE:stat('SAVE_PERCENTAGE',.92,{A:.92})}}],'total');
const candidate = (id,score,pos) => ({ id,name:id,role:'skater',eligiblePositions:[pos],
  globalVorp:score,rankValue:score,baselineScore:score });
const base = [candidate('A',100,'C'),candidate('B',40,'LW')];
out.tail = [base,[...base,candidate('tail',-1000,'C')]].map(list => recommendations(list,{
  leagueType:'points',needAlpha:.5,positionNeeds:{C:0,LW:1},limit:10
}).map(r => [r.candidate.id,r.recommendationScore]));
out.units = [1,2].map(unit => recommendations([
  {...candidate('goal',0,'C'),categoryValues:{GOALS:2,HITS:0}},
  {...candidate('hit',0,'C'),categoryValues:{GOALS:0,HITS:2*unit}}
], {leagueType:'categories',categoryWeights:{GOALS:1,HITS:1},categoryNeeds:{GOALS:1,HITS:unit},needAlpha:.5,limit:10})
  .map(r => [r.candidate.id,r.recommendationScore]));
out.unknown = [...load('lib/draftDashboard/playerValues').buildPlayerValues({
  players:[player('1',null),player('2',-5)],
  draftSettings:{teamCount:2,rosterConfig:{C:1}},leagueType:'points'
}).values];
function optimal(ps, slots, used = new Set(), i = 0) {
  if (i === slots.length) return 0;
  let value = -Infinity;
  for (const p of ps) if (!used.has(p.id) && p.pos.includes(slots[i])) {
    const next = new Set(used); next.add(p.id);
    value = Math.max(value,p.value + optimal(ps,slots,next,i+1));
  }
  return value;
}
out.assignment = [true,false].map(flex => {
  const ps=[{id:1,value:100,pos:flex?['C','LW']:['C']},{id:2,value:99,pos:['C']},{id:3,value:1,pos:['LW']}];
  const used=new Set();
  const greedy=['C','LW'].reduce((sum,s) => {
    const p=ps.find(p=>!used.has(p.id)&&p.pos.includes(s));used.add(p.id);return sum+p.value;
  },0);
  return {flex,greedy,optimal:optimal(ps,['C','LW']),pooled:199};
});
out.community = [300,600].map(n => {
  const r=load('lib/draft-ranker/communityModel').computeCommunityRanking({
    candidates:Array.from({length:n},(_,i)=>({fhfhPlayerId:i+1,marketRank:i<300?i+1:null,
      priorState:i<300?'market_ranked':'previously_undrafted'})),preferences:[]
  });
  const score=id=>r.players.find(p=>p.fhfhPlayerId===id).score;
  return {n,converged:r.converged,gap149to150:score(149)-score(150),score150:score(150)};
});
console.log(JSON.stringify(out,null,2));
```
