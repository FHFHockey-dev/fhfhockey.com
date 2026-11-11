# Independent peer review: W2-2 underlying stats summaries, part 1

Reviewed 2026-11-11 in `/Users/tim/Code/fhfhockey.com`, `octoberBranch`, HEAD `3e81061cb60105e984ae7724365b2d9f22ba6d11`. Target: Fable audit commit `3e81061cb`, `../audits/underlying-stats-summaries-part1.md`. This additive review preserves the audit and owner decisions. File references below are repository-relative and relocated in this checkout.

## Decision

**Accept the main strength, score-state, aggregation and unit diagnoses, but revise the remedies and scope before using this audit as an implementation checklist.** The five leading findings survive independent source review. Offline execution of extracted, unchanged calculation functions reproduced the strength reversal, five skater fallthroughs, missing score-state time and goalie duplicate-goal mechanism.

Important qualifications:

1. The goalie medium/low-danger error is **not uniformly 2× across strength filters**. The two accumulators see different events when the strength parser is reversed. A synthetic home-PP goal gives MD GA = 2 in all strengths, 1 in PP, and a spurious 1 in PK despite PK GA = 0.
2. D8's proposed strict tie comparison cannot satisfy its “all ties = Average” test: it would produce Abysmal. Half credit for ties gives 50%, which maps to Average under the existing bands.
3. D9's duplicated fantasy percentile is redundant, not an extra fantasy weight. Averaging two identical percentiles still leaves the fantasy component at 35%. Removing one is score-neutral. The singleton-consistency problem is real.
4. D12's proposed share identity already passes the mixed-source implementation. Same-source arithmetic alone is neither necessary nor sufficient for matching the same games, event universe and coverage.
5. D20's null rate with incomplete TOI is a safe behavior, not itself a defect. An optional covered-games rate must filter **both** numerator and denominator to the same observations and be labelled separately.
6. The audit misses live goalie advanced-metric coverage/window problems and a goalie distance-weighting error, described below.

The audit's 14 sound / 23 mis-specified / 23 wrong counts are **Fable's classification**, not an independently re-established 60-entry accuracy result. This review re-derived the high-impact paths and selected shared helpers; it did not turn carried legacy findings into newly verified ones. Production magnitudes remain the original auditor's dated samples, not this review's measurements. No production database, provider, application endpoint or browser requests were made.

## A. Additional actionable findings

### PR-U1 · P1: Advanced goalie metrics ignore the selected range and can be truncated

**Evidence.** `web/pages/goalies.js:608-635` fetches `goalie_stats_unified` using only `season_id`; no selected-week/date bounds, pagination, count or stable order. The relation is game-grained, including `date` and per-game fields (`supabase/migrations/20260716112908_production_schema_baseline.sql:10419-10430`). The checkout's local API row cap is 1,000 (`supabase/config.toml:18`), but the hosted cap was not checked. `goalies.js:849-853` combines these season-wide advanced rows with date-filtered leaderboard rows, and `goalieMetrics.ts:582-605` uses their QS% in the value-tier score. The advanced table itself filters only by season GP (`goalies.js:894-899`).

**Impact.** Changing the selected weeks changes the ordinary leaderboard while leaving the advanced statistics and QS% reference unchanged. Historical selected periods can therefore use later season results in their value tier. When the returned season exceeds the API cap, totals may also be silently partial; actual hosted truncation is **conditional**, not measured here.

**Fix.** Share explicit season, game-type and selected-date scope between ordinary and advanced paths; return date/coverage metadata. Page in deterministic unique order or use a bounded, server-side aggregate with completeness checks. Do not merely rename the request “season rows.”

**Tests.** Freeze an early-week fixture, append later games, and assert the early-week advanced values and tier stay unchanged. A mocked 1,001-row result delivered in pages must include the last row exactly once. The advanced query must update when its intended date range changes.

### PR-U2 · P1: Advanced metrics use unmatched missing-data coverage; missing QS is counted as failure

**Evidence.** `goalieMetrics.ts:73-97` sums each field independently and returns a total when just one row is known. `:157-186` divides those partial numerators by the sum of every known TOI. `:145-151,214-216` counts all known starts but converts null quality-start flags to zero via `finiteOrZero` (`:68-69`). This extends D10 to a separate live reader, M-UST-050.

**Executed fixture.** Two 60-minute starts: xGA values `[3, null]`, quality-start flags `[1, null]`. The current function returns xGA = 3, xGA/60 = **1.5**, QS% = **0.5**. Full-window xGA and QS% are unknown. If explicitly reporting only the first game's covered subset, xGA/60 would be 3 and QS% 1, each with 1/2 coverage. This is a fixture, not a production prevalence estimate.

**Fix.** Retain field-specific coverage and matched denominators, or make incomplete full-range outputs unavailable. Missing QS evidence must not become a failed start. Importing an NHL `qualityStart` field does not independently establish all of owner decision 40's boundary and credited-starter requirements; the audit should retain that verification dependency rather than imply it was tested.

**Tests.** Known zero is included; null stays unknown. Removing a metric's numerator from one row must not retain that row's exposure in a purported covered-only rate. QS% must disclose incomplete classification coverage, and the value-tier reader must not rank an incomplete value as complete.

### PR-U3 · P1: Goalie average distances are reweighted by shots/goals without coordinates

**Evidence.** The parity layer averages only shots/goals with usable distances (`web/lib/supabase/Upserts/nhlNstParityMetrics.ts:1502-1515,1820-1826`). The landing aggregator reconstructs totals by multiplying those averages by **all** shots or goals (`playerStatsLandingServer.ts:3554-3562`), rather than the counts that produced those averages. Own goals are another reason the goal-distance count can differ from GA.

**Executed fixture.** Game A has 10 shots, but only one observed distance, 10 ft; game B has one shot at 30 ft. The current landing accumulator returns `(10×10 + 30×1)/11` = **11.818 ft**. The two observed distances average **20 ft**. The same issue applies to average goal distance.

**Fix.** Carry actual distance sums and measured-distance counts through parity, stored summaries and aggregate merges. Do not impute a missing shot distance from its teammates' game average without an explicit model/label. Repair stored summary coverage as part of the approved bounded rebuild, not a silent full-history recompute.

**Tests.** Missing-coordinate shots do not alter the known-distance mean; one 10-ft and one 30-ft observed shot aggregate to 20 ft regardless of how many additional unknown distances occur. Test own goals and all-unknown games separately.

### PR-U4 · P1: A week with no comparable metrics is classified Abysmal

**Evidence.** `goalieCalculations.ts:232-257` skips missing/non-comparable inputs, but assigns percentage 0 when `comparableStats === 0`; `:190-195` maps this to Abysmal. The outer eligibility guard (`:429-441`) checks starts and TOI, not metric coverage. This can enter week counts, points and consistency as an actual bad performance.

**Executed fixture.** An otherwise eligible week with selected saves null and a known league average returns `{ranking: "Abysmal", percentage: 0, points: 1}`. This is distinct from the early “no selected keys” branch returning Average.

**Fix/test.** No comparable selected stats means unclassified/unavailable; do not add ranking points or a performance tier. Test an eligible week with all selected metrics null, and one with a valid nonzero observation. A genuine zero league average can be compared without division, because the implementation only uses inequalities; skipping every zero baseline is not mathematically necessary.

### PR-U5 · P1 presentation: Equal special-team percentages receive different ranks

`teamSpecialTeamsContext.ts:28-36` sorts by value then assigns `index + 1`, even for ties. A fixture with A = B = .5 returns A rank 1, B rank 2; reversing insertion order swaps them. After D5 repairs pooled PP/PK, use an explicit competition or dense rank and test equal values plus unknowns. The rank should not depend on database row order. Magnitude in production was not measured.

## B. Corrections to Fable's findings and remedies

### R1. D1/D2/D3/D4: retain, but test oriented event fixtures and overlapping score states

- **D1 confirmed.** `nhlStrengthState.ts:31-44` serializes away first. Both readers interpret home first (`teamStatsSummaryRefresh.ts:334-346,631-633`; `playerStatsLandingServer.ts:1708-1720,1888-1890`). Fixture situation `1451` serializes `4v5`, then incorrectly parses home=4, away=5. The team's PP time is correct-side while its shots are wrong-side. A shared parser is appropriate.
- **The reciprocity test alone is insufficient.** Swapping PP/PK consistently on both teams can still satisfy “home PP CF = away PK CA.” Keep the oriented fixture where the known advantaged team, event and time are all asserted. Test home and away, 5v4/4v5, and pulled-goalie flags.
- **D2 confirmed with a narrower magnitude.** The first MD/LD increment is at `playerStatsLandingServer.ts:3548,3551`; the second at `:3458,3461,3564`. Under asymmetric strengths the feature filter is inverted, so it is not necessarily the same goal counted twice in that displayed row. For the one home-PP MD goal fixture: all-strength GA/MD-GA = 1/2; PP = 1/1; PK = 0/1. The HD source is likewise inconsistent with its parity shots/saves.
- **Own goals require an explicit residual.** Parity includes own goals in GA but excludes them from shots and danger buckets (`nhlNstParityMetrics.ts:1502-1535`). The feature-bucket accumulator has no own-goal guard (`playerStatsLandingServer.ts:3424-3462`). Bucket shots minus saves equals classified non-own-goal GA; total GA conservation must include own goals and unclassified goals exactly once. Avoid introducing a universal total `SA − saves = GA` test on this event convention.
- **D3 confirmed.** `resolveSkaterSplitKey` maps five offered options to `pk` (`playerStatsLandingServer.ts:1644-1664`). Exhaustive mapping and all ten strength fixture checks are appropriate. “4v5 PK” falling through to broad PK is still wrong where PK includes other strengths, even if it happens to match an all-4v5 fixture.
- **D4 confirmed.** Segment scores are nullable event fields (`teamStatsSummaryRefresh.ts:326-327,551-566`); shots use running-score features (`:525-536`). An unscored 60-second 5v5 segment contributes 0 tied seconds. `leading` excludes +1 in both helpers. Owner decision 11 requires overlapping predicates, not merely renaming a single exclusive bucket: tied/leading/trailing partition known time; upOne/downOne are subsets; withinOne overlaps them. Preserve the upstream same-clock ordering and penalty-expiry issues when sharing helpers.

The reported 66-game and seven-game production magnitudes remain Fable's dated observations. The source establishes a mechanism, not universal zero score-state TOI on every possible feed.

### R2. D5/D7/D11/D14/D19: retain with precise formulas and active-reader details

- **D5:** `teamSpecialTeamsContext.ts:58-61,97-108` picks the newest game; `Number(null)` becomes 0 (`:23-25`). Pooled season-to-date results/opportunities follow the settled owner contract. There is also no season lower bound today, so an early-season team may borrow a previous-season game. Add a test for a team with no games/opportunities in the selected season. Include PR-U5's tie policy.
- **D7:** The roster-matrix fallback uses `GA×3600/TOI` at `RosterMatrixWrapper.tsx:437-440` and HD saves as LD saves at `:422-426`. Its minute-based input makes GAA 60× high under the documented source contract. Write the remedy unambiguously as **GAA = GA×60/TOI_minutes**, or **GA×3600/TOI_seconds** after an explicit conversion; “divide by TOI minutes × 60” is ambiguous. The fallback also sums per-game GSAA at `:415`, another decision-10 consumer to fix alongside D6. NST unit measurements are Fable's evidence, not fresh reads here.
- **D11:** Retain owner decision 9's O/(O+D), known-zero handling and separation from neutral-zone starts. Coordinate SQL fixes with W2-1, rather than fixing only the native parity copy.
- **D14:** Historical scope mismatch is real, but the server already returns `ratingSnapshotDate` (`entityRatingsOverlay.ts:107,137`). The remedy must actually display/qualify it or hide the historical overlay; simply “return snapshot date” is already implemented. Offense and defense can have different latest dates but share one displayed date. Paging alone should not manufacture one coherent snapshot from independently stale components.
- **D19:** The chart is an active reader, not latent P2 code (`PlayerStatsExpandedRowChart.tsx:138-157,412-440`). `[1, .5]` gives .75 as the mean of game ratios, while underlying counts 1/1 and 5/10 pool to 6/11 ≈ .54545. If the line is intended as pooled window/season SV%, it is a P1 mismatch. A clearly labelled “mean game SV%” is a different valid estimand. Counts should remain per-game averages where that is what the chart says; do not blindly apply a ratio-of-sums transform to every metric.

### R3. D8: repair the proposed tie fix and the actual live baseline reader

Current `>=`/`<=` makes all tied comparisons Elite; replacing them with strict comparisons makes all ties Abysmal. The executable fixture produced 100%/Elite currently, 0%/Abysmal with strict-only scoring, and 50%/Average with half credit. Specify the intended tie rule before implementing, and test the actual classification output.

The `/goalies` leaderboard's weekly baseline is **not read from `league_weekly_goalie_averages`**: it is built from paginated NHL rows in `goalies.js:300-350`, using the local `buildLeagueWeeklyAverage` at `:210-276`. That implementation still includes every returned goalie-week in the counting-stat denominator (`:243-267`), while evaluated goalie weeks need at least one start and 20 minutes (`goalieCalculations.ts:54-64,429`). Therefore changing the SQL view alone does not repair this page. Keep SQL consumers such as trueGoalieValue/social-share separately inventoried. “Every multi-start week clears the bar” is too strong: neither multiple starts nor the baseline arithmetic guarantees high saves, wins or TOI; this is a workload-comparability concern, not that universal implication.

### R4. D9: remove the false weighting claim; preserve the actual sample problem

`goalieMetrics.ts:608-619` averages percentile(FP/G) and percentile(FP/G − constant). For a shared pool these are identical. `:656-660` gives the whole resulting fantasy component 35% weight. Algebraically `(p+p)/2 = p`, so this is redundancy and misleading feature independence, **not 70% fantasy weight**. The existing code already passes the proposed translation-invariance test: the synthetic three-goalie scores remain 38.3333, 50, 61.6667 after a common 100-point shift. Replacing the second feature with an independent one would change the model and requires a separate justification; simply removing it is score-neutral.

The zero SD for fewer than two games/weeks remains a real problem (`goalieCalculations.ts:146-153`; `goalieMetrics.ts:620-630`). Null alone will not repair it: `toFiniteNumber` maps null to 0 (`:238-239`) before the percentile calculation. Exclude unsupported component values and handle incomplete component coverage explicitly at every reader.

### R5. D12: the suggested test is algebraically vacuous

The current 5v5 overlay sets SF and then computes SF/(SF+native SA) (`teamStatsQueries.ts:565-585`). Consequently `SF% × (SF+SA) = SF` already passes despite mixed provenance. Executed fixture: official SF=6, native SA=4, share=.6, identity=6.

Mixing sources is not by itself a mathematical error if they measure the same complete event set. Conversely, equal GP (`:508,557`) does not prove matching game identities or definitions, and two fields from one source can still have unequal coverage. Retain the provenance/coverage concern and the silent-fallback disclosure concern, but do not claim a measured numeric bias without paired evidence. Test known disagreements with frozen official/native event populations, missing components, game identity/coverage and the response's provenance. Require coherent bundles or an explicitly labelled mixed-source estimate.

### R6. D20: do not replace safe nulls with unmatched ratios

`playerStatsLandingServer.ts:3472-3475,4196,4259-4261` deliberately nulls aggregate TOI when any appearance has unknown TOI. That prevents total production being divided by partial exposure. D20 should be an optional covered-subset enhancement, not a mathematical fault for failing closed. If implemented, compute a separate numerator over only the same reliable-TOI games, report known/eligible games and exposure, and preserve the unavailable full-range rate. D10's partial nullable sums (`:2092-2100`) remain a separate coverage issue.

### R7. External and carried claims remain qualified

- The 12-goalie GSAA sum of −.01 is consistent with a day-specific baseline but does not uniquely prove the source's baseline algorithm. Decision 10 settles the replacement contract regardless. The “league GSAA sums to zero” test requires the exact same complete event universe for baseline and summed goalies; filtered subsets need not sum to zero.
- Extra-attacker membership in NST-named PP/PK remains a reference-definition dependency. Source-confirmed raw-skater classification is not a verified external NST rule. Do not treat Fable's D15 as a settled independent P1 until the promised authoritative definition is pinned. Owner decision 9 still applies.
- The skater ownership-scale assumption (M-UST-024) and other declared unknown subfields should remain explicitly unverified even where a broader entry is called Sound. No new validation of the carried legacy/dead entries was performed. Do not delete dormant code because of these findings.

## C. Offline evidence and reproducibility

Two `node` stdin runs, from the repository root, loaded only source text with `fs.readFileSync`, parsed it using the already installed `./web/node_modules/typescript`, selected named top-level declarations, removed `export`, transpiled to JavaScript, and evaluated it in `vm`. **No application module was imported or initialized**, so database clients/provider code were not invoked. No scratch script or implementation file was written. The helper extraction pattern was:

```js
const fs = require('fs');
const ts = require('./web/node_modules/typescript');
const vm = require('vm');
function load(file, names) {
  const source = fs.readFileSync(file, 'utf8');
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const selected = ast.statements.filter(n =>
    ts.isFunctionDeclaration(n)
      ? names.includes(n.name?.text)
      : ts.isVariableStatement(n) && n.declarationList.declarations.some(
          d => names.includes(d.name.getText(ast))));
  return ts.transpileModule(
    selected.map(n => n.getText(ast)).join('\n').replace(/export /g, ''),
    { compilerOptions: { target: ts.ScriptTarget.ES2020 } }
  ).outputText;
}
const context = { console };
vm.createContext(context);
// vm.runInContext(load(file, names), context), then evaluate the fixtures below.
```

Extract these named declarations and dependencies, keeping different files' identically named helpers in separate VM contexts:

- `nhlStrengthState.ts`: `parseSituationCode`, `formatStrengthExact`.
- `playerStatsLandingServer.ts`: `parseStrengthExactCounts`, `resolveSkaterSplitKey`, `getTeamScoreDiffBucket`, `matchesPlayerStatsScoreState`, `matchesPlayerStatsStrengthForTeam`, `filterGoalieShotFeaturesForState`, `defaultAggregateMetrics`, `addNullable`, `accumulateGoalieShotFeatureBucketMetrics`, `accumulateLandingMetrics`.
- `teamStatsSummaryRefresh.ts`: `getTeamScoreDiffBucket`, `matchesTeamScoreState`, `matchesTeamStrength`, `resolveTeamSituationForSegment`, `accumulateTeamToiSeconds`.
- `goalieCalculations.ts`: `statMap`, `rankingPoints`, `classifyGoalieWeekPercentage`, `calculateWeeklyRanking`.
- `goalieMetrics.ts`: `GOALIE_ADVANCED_STRENGTH_OPTIONS`, `finiteOrZero`, `finiteOrNull`, `sumField`, `sumFieldOrNull`, `per60`, `per60OrNull`, `weightedAverageField`, `buildGoalieAdvancedMetricsRows`; separately `toFiniteNumber`, `average`, `percentile`, `buildGoalieValueTierMap`.
- `teamStatsQueries.ts`: `toPer60`, `toPctDecimal`, `toPdo`, `roundSeasonTotal`, `applyOfficialRowOverrides`.
- `teamSpecialTeamsContext.ts`: `buildRankMap`.
- `PlayerStatsExpandedRowChart.tsx`: `calculateAverage`, `calculateRollingAverage`.

Fixture inputs and observed results:

| Case | Inputs | Observed |
|---|---|---|
| Strength | `parseSituationCode('1451')` → format → landing parse | `4v5` → home 4, away 5 |
| Skater mapping | 5v4 PP, 4v5 PK, 3v3, with EN, against EN | All `pk` |
| Score classifier | `matchesTeamScoreState('leading', 1)` | false |
| Score time | Segment [0,60], both goalies on, 5v5, scores null; home 1, away 2; tied/allStrengths | 0 seconds |
| MD duplicate | Initial MD GA 1; one goal at distance 30, angle 20 for goalie 3 | MD GA 2 |
| Asymmetric split | One home-goalie-against goal: goalie 3, `4v5`, owner away, both goalies on, owner score difference 0, distance 30, angle 20; parity GA/MD GA=1 in all/PP and 0 in PK; actual feature filter applied | all 1/2; PP 1/1; PK 0/1 (GA/MD GA) |
| All ties | saves 30 versus average 30; one matching saves column | 100%, Elite |
| Strict/half tie policy | Current classifier on 0 / 50 | Abysmal / Average |
| Missing comparison | saves null versus average 30 | 0%, Abysmal, 1 point |
| Partial advanced rows | Same goalie, both GS 1 and TOI 60; xGA 3/null; QS 1/null | xGA 3; xGA/60 1.5; QS .5 |
| Distance aggregation | Goalie contexts SA/average distance 10/10, 1/30; other additive fields 0; no feature-bucket shots | 11.818181818 ft |
| Overlay | Native team 1: GP 2, TOI 600, SF 2, SA 4, GF 1, SV .75; official same-GP 5v5 SF 6 | SF .6 share; reconstruction gives 6 |
| Tier translation | Three goalies FP/G 1,2,3; delta −1,0,1; SDs 1; GP 5; GS 4; TOI 600; acceptable weeks 50; then subtract 100 from FP and delta | Scores unchanged: 38.333333, 50, 61.666667 |
| Equal ranks | Map A→.5, B→.5 | A→1, B→2 |
| Mean ratios | `calculateAverage([1,.5])` | .75 |

For `calculateWeeklyRanking`, use selected key `saves` and column `{value:'saves', dbFieldGoalie:'weekly_saves', dbFieldAverage:'avg_league_weekly_saves'}`. For landing accumulator fixtures use `defaultAggregateMetrics()`, goalie `playerId:3`, `kind:'goalies'`, `hasReliableToi:true`, TOI 60 and explicitly zero all unused additive count fields. The distance fixture represents game A's nine unmeasured coordinates; the true measured-distance denominator is 2, not 11.

These are focused function reproductions and algebraic counterexamples, not full route tests, UI execution or verification of deployed values. Test runner, application build, migrations, backfills and deployment were not run. Only this review file was created; existing concurrent working-tree changes were preserved.

## D. Suggested consolidation order

1. Keep D1–D4 together with upstream W1-2 event/strength/score corrections and PR-U3's distance-count contract. Verify event-level oriented fixtures, then stored-summary serialization/aggregation. One separately approved bounded rebuild, after write reconciliation, not multiple ad hoc rebuilds.
2. Keep D5 with W1-4 pooled special-team work; add season bounds and equal-rank behavior.
3. Repair M-UST-050's range, pagination, coverage and missing-QS semantics while replacing summed per-game GSAA. Include the roster-matrix GSAA fallback and every other decision-10 reader.
4. Treat weekly baseline population/tie handling, singleton consistency and chart estimands as explicit contracts. Preserve unknowns. Do not turn safe nulls or redundant features into arbitrary new formulas.
5. Preserve original audit sample sizes and evidence limits. The owner questions about bar population, minimum sample, missing weeks, historical overlays, split standings and dormant-view priority remain choices; this review does not answer them by fiat.


## E. Deeper causal review and repair proof (2026-11-11)

This second pass remains on HEAD `3e81061cb60105e984ae7724365b2d9f22ba6d11`. It deepens D1–D4 and PR-U1/U2 rather than increasing the finding count. **The important change is the repair standard: a correct helper is insufficient; the selected observation set, stored rows, aggregation, model definition and visible result must agree.** Sections A–D remain the first-pass record. In particular, section C's statement that the test runner was not run applies to that pass; the additional execution below ran 52 focused tests.

### E1. A raw-event fixture reaches contradictory displayed goalie and team values

**Executed, offline.** Used the real exported `buildPlayerStatsLandingParityByGame` and `buildPlayerStatsLandingAggregation`, then the real `formatPlayerStatsValue`. No synthetic parity counts were supplied in this run. Fixture: one 20-minute period; home goalie and skaters have shifts `[0,1200]`; away/home team IDs 20/10. Events at seconds 0, 60, 600 and 1200 are period-start, away goal, faceoff and period-end. The first two have situation `1451` (home 5, away 4); the last two have `1541` (home 4, away 5). The only goal is against home goalie 3 at `(-60,10)`, with home defending left, producing measured geometry 30.6757 ft / 19.0256° and `strengthExact="4v5"`. Only the goal event has scores (home 0, away 1). This intentionally supplies nonzero PP **and** PK time, so the spurious PK statistic cannot be dismissed as an intermediate row filtered out for zero TOI.

The unchanged pipeline produced these actual formatted cell strings:

| Selected goalie strength | TOI | Total GA | MD shots | MD GA | MDGAA | MDGSAA |
|---|---:|---:|---:|---:|---:|---:|
| All strengths | 20:00 | 1 | 1 | 2 | 6.00 | −1.92 |
| Power play | 10:00 | 1 | 1 | 1 | 6.00 | unavailable |
| Penalty kill | 10:00 | 0 | 0 | 1 | 6.00 | −0.92 |

This locates the failure beyond a private accumulator. `goalieStatsServer.ts:15-21` delegates the live goalie landing request to this engine; `pages/api/v1/underlying-stats/goalies.ts:32-51` returns its rows; `components/underlying-stats/playerStatsColumns.ts:292-297` exposes the MD fields and `PlayerStatsTable.tsx:335` uses the tested formatter. No browser, API request or deployed UI was exercised.

The same actual feature output was passed through the unchanged `buildTeamUnderlyingSummaryRowsForGame`, JSON round-trip, `createAccumulator`, `addSummaryRow` and `mapAccumulatorToApiRow` (the private functions were source-extracted). For the home team, PP displays 10:00 / GA 0 / GA60 0.00, while PK displays 10:00 / GA 1 / GA60 6.00. The tied row displays 0:00 / CA 1 / GA 1 / GA60 unavailable. Thus the goalie and team paths disagree even about where the *total* goal occurred; this is not just an alternative bucket label or rounding convention.

**Score-time qualification.** This fixture's down-one row has 9:00, not zero: the goal record's post-goal score survives only until the next event at 600. The true down-one duration is 19:00; the initial tied duration is 1:00. The broad trailing row has zero because the +/−1 bucket is exclusive. This sharpens D4's causal diagnosis: score time can be **partially** known and silently undercounted, not just uniformly absent. Retain Fable's observed zero-TOI production sample as a dated sample, not a theorem about every feed.

### E2. Challenge the obvious repairs separately; neither closes the defect

A second source-extraction harness ran the exact feature filter → summary-row creation → JSON serialization → persisted-summary parser → aggregate merge → API mapper → cell formatter. It supplied one medium-danger home-PP goal with 60 minutes of exposure for each illustrative displayed split. It then made two **in-memory-only** changes: correct the away-first decoder, and remove the feature routine's extra MD/LD goal increments while retaining the parity counts. These are diagnostic mutations, not approved implementations.

| Variant | All-strength MD GA | PP MD GA / bucket xG−GA | PK MD GA / bucket xG−GA |
|---|---:|---:|---:|
| Current | 2 | 1 / unavailable | 1 / −0.92 |
| Decoder only | 2 | 2 / −1.92 | 0 / unavailable |
| Remove duplicate only | 1 | 1 / unavailable | 0 / **+0.08** |
| Both | 1 | 1 / −0.92 | 0 / unavailable |

Fixing orientation alone can make the PP result appear *worse* by aligning the two formerly different event sets and revealing the duplicate. Removing only the extra goal leaves a positive PK “MDGSAA” from a PP shot even though PK has no shots or goals. A test that asserts only corrected MDGA would falsely pass. Save percentage currently uses parity saves/shots, not the doubled goal count, so a plausible MDSV% does not validate MDGA/GAA. A blanket replacement of saves with `shots − displayed goals` would spread the defect into a previously unaffected field.

**Counts and model meanings are separate roots.** Even the two diagnostic repairs do not implement owner decision 10. `mapLandingAggregationRowToApiRow` still calculates fields named GSAA as xGA−GA (`playerStatsLandingServer.ts:5085-5116`). Moreover, the parity total and bucket xG are different recipes: parity floors every goal's xG at .25 and adds contextual bonuses (`nhlNstParityMetrics.ts:407-419`); the landing medium bucket assigns .08 regardless of that goal outcome (`playerStatsLandingServer.ts:3441-3452`). For this single medium goal, corrected total xGA−GA is −.75 while the medium component is −.92. Both are still heuristic GSAx-like outputs, not shots × matched league miss rate − GA. Do not accept bucket/total xG conservation or rename-and-keep as the repair. The hide/retire direction and qualified league-baseline implementation remain separate gates.

An own-goal variant returned GA 1, MD shots 0, MDGA 1 and MDGSAA −.92 before repairs. The feature accumulator ignores `isOwnGoal`, whereas parity excludes own goals from shots/buckets. A proposed single-pass goal accumulator must preserve that distinction, not merely deduplicate values. HD goals have no separately stored `hd_goals_against` input here; deleting the whole feature routine without replacing that contribution would lose HD GA. For known classified non-own-goal events, parity HD shots minus HD saves is usable; total GA still needs explicit own-goal and unclassified residuals. These are event-universe tests, not universal `SA − saves = GA` identities.

### E3. “Rebuild summaries” is not an adequate deployment instruction

The defect survives serialization: a summary created with MDGA 2, JSON-round-tripped and accepted by `flattenPersistedSummaryRows`, still maps to displayed MDGA 2. The reader merges stored counters, not raw events (`playerStatsLandingServer.ts:3670-3771,4010-4082,5370-5404`). Two operational counterexamples were executed with injected in-memory I/O:

1. **Legacy migration is not a recalculation.** `buildPlayerStatsLandingSummarySnapshotsFromPayloadRows` merely repartitions accepted existing rows (`:4159-4182`). In the current refresh routine, `shouldMigrateLegacySummaries:true` then excludes migrated game IDs from raw rebuild (`playerStatsSummaryRefresh.ts:239-260`). The probe returned `migratedGameIds:[100]`, `rawBuildGameIds:[]`, zero raw-builder calls, and a written fixture payload still containing MDGA 2. `update-player-underlying-summaries.ts:354` enables this flag for `backfill_batch`; the season backfill's summary-only branch enables it too (`backfill-player-underlying-season.ts:180-191`). An existing command called “backfill” is therefore not proof of corrected arithmetic. Use an explicitly bounded raw rebuild for affected existing games, not missing-only selection or legacy repartitioning.
2. **Bumping the payload version alone can remove data.** The current structural version is 1 despite the partition URL containing “v2” (`playerStatsLandingServer.ts:215-221`). A test-only version bump made the parser reject the fixture's old payload. With the normal cache-eligible season state, the actual selection branch then returned one missing game, zero persisted rows and **zero live-builder calls**: `canUsePlayerStatsSeasonAggregateCache` is true and the caller passes `allowLiveSummaryBuild:false` (`:1920-1944,5380-5385`). Non-default scopes can follow a different fallback. Coordinate reader activation with verified rebuilt coverage; do not promise that version invalidation will transparently regenerate the default page.

A bounded repair plan therefore needs these acceptance gates, not an immediate production run:

- Freeze the affected game IDs, date/season/game-type range, source inputs and calculation version. Include **existing** faulty rows. Check prerequisite W1 event/strength/score corrections before rebuilding W2 derivatives.
- Prove every required mode/strength/score partition, both teams and each expected player appearance. Presence of one raw-payload game ID or both broad team rows does not prove all partitions are correct. Preserve legitimate zero observations; do not fill missing coverage with zero.
- Exercise raw rebuild, persistence, newest-compatible-row selection, and final landing/detail/chart reads on the same offline fixture. Exercise a mixed old/new population and interrupted/resumed batches, and fail or visibly qualify incomplete coverage rather than present it as a complete season.
- Reconcile both player JSON summaries and `team_underlying_stats_summary`, including stale keys that upsert alone cannot remove. Do not infer success from rows-attempted counters: player upsert uses `ignoreDuplicates:true`, and team `reportStaleKeys` reports differences without deleting them (`playerStatsSummaryRefresh.ts:168-196`; `teamStatsSummaryRefresh.ts:1284-1307`). Require key/version coverage and readback equivalence.
- Invalidate or expire all relevant serving caches only after verification. The player refresh clears its process's aggregate map (`playerStatsSummaryRefresh.ts:268-270`); that is not evidence that other workers' 10-minute maps or the API's private 60-second/300-second stale response caches have converged. Reuse the approved bounded verification budget, not repeated production refreshes.

No migrations, backfills, cache-warming calls or production changes were performed here. Exact rebuild scope/cost and hosted cache convergence remain unmeasured.

### E4. Missing-data and date-window defects can change the visible tier, not only an auxiliary metric

**Executed model propagation.** Built the advanced rows and value-tier map from actual `goalieMetrics.ts` functions. For goalie A, two 60-minute starts have xGA `[3,null]` and QS `[1,null]`. A's currently displayed advanced values are xGA 3, xGA/60 1.5, QS .5. In a frozen three-goalie comparison pool, A's score is **52.7778 / Tier 4**. Replacing only A's incompletely known QS with null yields **55.0000 / Tier 3**; resolving the unknown start as a quality start yields **57.2222 / Tier 3**. This is a deterministic synthetic counterexample, not a claim about a named player's current tier.

For reproduction, the comparison rows A/B/C use FP/G `[30,20,10]`, FP-above-average `[10,0,−10]`, both SDs `[2,1,3]`, GP `[3,5,7]`, GS `[2,1,3]`, TOI `[180,300,420]`, acceptable-week percentage `[50,50,50]`; B and C each have known QS% .75. Only A's advanced classification changes. The exact 55-point boundary is the code's Tier-3 threshold; the “exclude unknown” case is a sensitivity test, **not** an endorsed substitute model.

The live page supplies season-wide advanced rows to selected-range rankings (`goalies.js:608-635,849-856`), and `GoalieLeaderboard.tsx:166-175` renders that tier plus the numeric score in its tooltip. Thus late or out-of-window quality starts can alter a historical range's visible badge while the historical ordinary stats are unchanged. Separate fixes are needed for query range/game-type/completeness, classification coverage, and the model's missing-component policy. Making QS null alone removes a term from A's component average while other goalies retain it, changing effective component weights by player. That may be an explicit qualified model choice, but is not automatically comparability-preserving. Also retain the existing warning that setting unsupported SD to null still becomes zero through `toFiniteNumber` unless the reader changes.

### E5. Tests and evidence limits

**Passed:** 52 existing tests across four files, one worker, no build or server:

- `lib/underlying-stats/playerStatsLandingServer.test.ts`: 28.
- `lib/underlying-stats/teamStatsSummaryRefresh.test.ts`: 3.
- `components/GoaliePage/goalieMetrics.test.ts`: 14.
- `components/GoaliePage/goalieCalculations.test.ts`: 7.

The command, from `web/`, was `node node_modules/vitest/vitest.mjs run <the four files above> --pool=forks --maxWorkers=1 --minWorkers=1`. Supabase configuration was explicitly synthetic; a preload blocked `fetch`, HTTP/HTTPS requests and socket connects. The raw-event and extracted-function probes were also offline and passed their assertions. No application code was modified. Diagnostic mutations existed only in VM source strings; scripts were temporary files outside the repository.

**Why green is insufficient:** the team file tests broad coverage and game outcomes, not oriented strength/score arithmetic. The landing file's native parity fixture is symmetric 5v5 and does not connect asymmetric strength to displayed danger fields. The advanced metrics test explicitly accepts partial GSAA 2 when another row's GSAA is null (`goalieMetrics.test.ts:295-341`); the SD test explicitly expects zero for zero/one samples (`goalieCalculations.test.ts:54-57`). Those assertions encode behaviors under review, so a repair needs contract-level expectation changes, not merely more passing tests. Add asymmetric home/away cases, own/unclassified goals, score transitions, partial coverage, old-version payloads and final API/format assertions around the **same** frozen observations.

**Not verified:** deployed values, source prevalence, hosted row cap, production cache behavior, complete historical rebuilding, browser behavior, or the full application suite. The original audit's 66-game and seven-game production samples remain original dated evidence. This pass establishes reachable current-source failures and repair counterexamples, not a new production magnitude or an independently reviewed verdict for every inventory entry.
