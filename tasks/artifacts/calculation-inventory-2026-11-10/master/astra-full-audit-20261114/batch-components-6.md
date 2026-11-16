# Components batch 6 — GamePreview and GoaliePage

Target `89da739cb45d7d572ed59bfa0b209c79c5d99299`; Astra/high worker, Chef owns integration and adjudication. **All 12 assigned files fully read in path order: 4,779 lines / 155,761 bytes.** Three new provisional findings below. Previously closed advanced GSAA, matched-window paging, missing-exposure and sample-floor fixes remain supported in this slice; this report does not reopen them wholesale.

Artifacts: `batch-components-6.tsv` has **427 rows**: 115 declarations, 258 function/callback nodes, 40 test callbacks, eight stylesheet selectors/import blocks, and six separately marked context paths. Exact symbol ranges and offsets distinguish nested callbacks and containing declarations. Each row combines surrounding data-flow review with local guards/operations/calls or exact assertions. The JSON manifest carries complete read ranges, sizes/hashes and exact-source probe receipts. Only the 12 scoped paths qualify for full-file integration; six context paths do not.

## Findings for Chef

### AFULL-GOALIE-W01 — missing goalie inputs and empty denominators still become numeric output in standard readers (P1 proposed)

**Source-confirmed current reader; frequency and deployed behavior unmeasured.** This concerns the standard weekly/leaderboard calculation path, not the repaired advanced GSAA path.

1. `GoalieList.tsx:69–86,128–147` uses an all-zero template for every nullable weekly statistic. A null `weekly_sv_pct` maps to `savePct=0`, then `GoalieTable.tsx:114–135` prints **0.000** and may apply worse-than-average color. The weekly league header correctly preserves N/A at `GoalieList.tsx:223–268`, so the same missing value receives inconsistent treatment across row/header. `web/pages/goalies.js:189–211` preserves null from NHL API weekly fields, and `615–631,1247–1256` passes those rows to this actual component. There is no intervening missing-stat admission guard. A credited zero-shot appearance can legitimately have unknown SV%; zero is not its observed save rate.
2. `goalieCalculations.ts:105–145` coalesces each starter count independently to zero before pooling. For two qualifying starters with `(saves,SA)=(27,30)` and `(null,30)`, the league SV% bar becomes **27/60=.450**. This retains exposure whose count is unknown and feeds comparisons. Both rows meet one start/20-minute admission. `pages/goalies.js:260–266,626–631` uses this builder directly on provider rows. The existing zero-SA test guards only a zero total denominator; it does not guard mismatched known support.
3. `calculateGameFantasyPoints` (`262–274`) treats unknown GA/SV/SO/W as0. With30 saves, unknown GA and settings `{goalAgainst:-1,save:.2,shutout:3,win:4}`, it returns **6** points. Overall totals similarly zero-fill nullable game fields (`652–665`); overall SV% and GAA return0 for zero denominator (`243–256`). Those manufactured finite numbers feed per-game means, variability and percentiles (`667–710`). The actual page adapter already zero-fills the same absent API game fields (`214–233`), so a helper-only fix would be insufficient: unknownness is lost upstream. These fields are nullable in `goalieTypes.ts:205–230`.

**Expected:** known zeros remain zero; absent counts/ratios remain unavailable. Count/exposure support must match or the full-window result must be withheld with coverage. **Suggested fix:** preserve unknowns through the API adapters and display types; avoid defaulting absent weighted fantasy inputs to0; propagate incomplete totals/ratios to the actual leaderboard and tier inputs. Keep the already-correct advanced count/TOI safeguards. Add adversarial cases to the existing calculation and page/component tests, including zero-shot known appearance, missing GA with positiveSA, and one missing saves row with retained SA.

**Exact-source probe:** AST-extracted pure declarations and weekly adapter callback reproduced all three cases (null SV→0, incomplete league SV=.45, unknownGA FP=6), plus zero-denominator overallSV/GAA→0. No React mount, application import or provider request ran. This finding does not assert missing data is common, nor that a real provider emitted the synthetic missing payload today.

### AFULL-GOALIE-W02 — “average percentile across the visible stat set” silently uses only four stats (P1 proposed)

`goalieCalculations.ts:723–758` builds populations for GP, W, L, OTL, SV, SA, GA, SO, TOI, SV% and GAA (GS is absent already). But the per-goalie assignment switch at **765–779** only emits **GP, W, SV%, GAA**. The final average (`796–808`) averages only those emitted percentiles; absent ones do not signal incompleteness. `goalieMetrics.ts:624–630` explicitly describes this as the average across the **visible stat set**. The current page supplies all12 visible `leaderboardStatColumns` (`pages/goalies.js:50–132,277–286`) regardless of the separate weekly-grading selection.

**Concrete current-column scenario:** two one-game goalies A/B have SV30/10, SA33/11, GA3/1 and TOI3600/1200 seconds. Both have GP1, GS1, W/L/OTL/SO0, the same SV%=10/11 and GAA3. Their four emitted percentiles are all50, so both visible average ranks are **50**. Applying the declared direction map/midrank to all12 displayed known stats gives **54.1667 vs45.8333**: A is higher in SV/SA/TOI and lower in the desirable GA ranking; eight stats tie. This independently demonstrates the omitted basis, not a proposed scientific weighting scheme. A narrower saves-only call returns empty percentile maps and **0** for both, despite distinct saves deserving75/25 midranks.

**Reader reach:** `calculateRichGoalieRankings`→decorated/filtered rows→`GoalieLeaderboard`, whose percentile cell renders the result; page consumers confirmed by bounded source trace. **Suggested fix:** share one stat-to-overall-value accessor for population and per-goalie assignment, or explicitly specify and label a narrower intended set. Do not silently convert “no assigned percentiles” to0. Pin every advertised stat and the empty/unknown case in existing tests. The already-correct midrank formula itself is not the defect.

**Evidence:** the exact-source probe returns four keys/all50 for the full12-column fixture and empty/0 for saves-only. Existing calculation tests do not inspect percentile maps or the visible-set label against actual emitted keys. No live output observed.

### AFULL-GOALIE-W03 — descending weekly percentage sort promotes unclassified rows (P2 proposed)

`GoalieList.tsx:162–168` claims “Nulls last” but returns−1 when the left value is null in descending mode. The weekly transformation deliberately preserves null `percentage`/`ranking` for unclassified weeks (`94–105,119–126`). Clicking the `% vs Starter AVG` header twice changes to descending via `handleListSort`; `GoalieTable.tsx:250–267` wires that actual control. The null row then sorts above a known60% row. The exact-source adapter probe yields `[unknown,known60]` in descending order.

**Expected:** unavailable/unclassified rows stay after known values in both directions; direction applies only to known comparison. **Suggested fix:** use direction-independent missing placement, matching `sortAdvancedMetricRows`' already-correct pattern. Add ascending/descending fixtures with known0, known60, null and nonfinite values. This is not an advanced-table regression: its missing-last behavior is separately tested and retained.

Bounded context also shows the parent leaderboard uses direction-sensitive sentinel values (`pages/goalies.js:309–338,837–865`), so descending standard-deviation sorting can put unknown `+Infinity` ahead. That reader is context-only and should be assigned its own full audit before broader integration; it supports the same concern but is not a fully audited page verdict here.

## Closed fixes retained, and unpromoted caveats

- **PR-U1 / window scope:** `fetchGoalieAdvancedMetricsRows` filters exact season and inclusive dates, orders date/player ID, and pages1000 until short (`goalieMetrics.ts:78–104`). Parent uses the applied leaderboard window (`pages/goalies.js:291–295,562–589,768–786`), then builds advanced rows **before** display minimum-GP filtering. Thus the GSAA reference pool is not accidentally restricted to the user-filtered goalies. The mock paging test checks filters/ranges but cannot validate PostgREST behavior, snapshot consistency or provider truth.
- **GSAA / decision10:** `leagueSavePct` pools paired known SA/GA across fetched rows of each strength; `windowGsaa` uses complete individual SA/GA and computes `SA×(1−leagueSV)−GA` (`150–178`). It does not sum NST per-game GSAA. Tests pin−1/+1 from league100SA/8GA and the−1.00 rendered value rather than−0.50. Exact-source control keeps individual GSAA null with a missing game GA. Scope/units are season/date/strength matching, no60 multiplier on GSAA totals.
- **PR-U2 / matching exposure:** `completeSum` fails closed on any missing row; `pairedPer60` requires both complete counts and complete NST **minutes**, positive denominator, and multiplies by60 (`118–145`). Tests and pure-source control preserve unknown xGA/60 for `[3,null]` over two60-minute games. There is no new60× error here.
- **QS:** `qualityStartsPct` counts credited starts only and makes the window rate null if any included start lacks quality_start (`185–193`). The source consumes precomputed QS flags; this does **not** independently prove upstream Vollman eligibility/thresholds or league-average production. Earlier owner decision40's low-shot wording is superseded by decision112; this batch does not revive that old definition. Unknown `games_started` is treated as non-start locally, a remaining input-coverage limit rather than proof of an observed current misclassification.
- **Decision97:** modern weekly grading requires>=1 start and>=1200seconds, gives equal nonzero baseline0.5 credit and returnsnull for no comparable stat. The existing all-tied test is preserved. A zero-valued average is excluded even though no division by that average occurs; **a separate source test explicitly preserves this as the existing TGV method**, contrasting it with Category Counts (`categoryCounts.test.ts:145–162`). Record as a definition caveat needing intentional adjudication if changed, not a casual reopening of the closed tie fix. Social TGV now imports `gradeGoalieWeek` (`goaliePeriod.ts:1,100–115`); the legacy-helper comment claiming it still consumes `calculateWeeklyRanking` is stale. Search found no non-test caller of the legacy helper.
- **Decision98 / spread:** sample SD uses n−1 and returnsnull below2 samples. The value-tier builder uses a user-lowerable default5 starts and refuses missing required components; an actual single game or single graded week produces unknown spread and no tier. Known-value percentiles are midrank, with direction inversion, consistent with decision90. Existing singleton/four-start tests remain appropriate. This does not establish empirically validated tier thresholds or weights.
- **Dormant source risk:** `buildGoalieMetricsGroups` admits a goalie with any finite field then uses `toFiniteNumber(null)=0`. Its Consistency card can call one-game unknown spread0.00 and rank it first (`goalieMetrics.ts:331–333,384–450`). Bounded TS/TSX/JS reference search found only definition/tests, **no current application caller**. Do not claim a live `/goalies` card defect or reopen the correctly guarded current value-tier path on this basis.
- **Optional QS dimension:** the tier's start-confidence component adds QS percentile only when that goalie's QS is finite (`694–712`). Therefore mixed QS availability changes the component basis; existing tests explicitly compare tiers with/without advanced QS. This is a documented implementation caveat, not independently qualified methodology and not a newly established unauthorized change in this batch.
- **GamePreview:** same-book market calculation, timestamp admission, explicit model-unavailable notice and absent-goalie/line/trend placeholders remain supported. Special-teams bar uses `(awayPP + 1−homePK)` versus `(homePP + 1−awayPK)`, normalized then reversed for the other row (`212–220,335–357`). It is an unlabelled composite comparison heuristic, not independent model evidence; no probability/calibration finding promoted without an intended bar-definition contract.

## Per-file review

### GamePreview.module.scss — 1–65

Seven selectors style explicit data states, errors, partial note, secondary labels, unavailable six-pixel bar, prediction notice and market source. Shared styles/tokens are imported but not expanded. Numerical values are presentation dimensions/opacity, not data transforms. No Sass build or visual inspection; mixin output and contrast not claimed checked.

### GamePreview.test.tsx — 1–247

Eight tests; useSWR is mocked by key and never calls either fetcher. Complete fixture +120/−135 same-book odds independently expects44/56, GF/GP3.42/3.08, PP24.7%, PK81.4%, and known H2H score. Tests require model-unavailable wording and market/provider/as-of label; cross-book and missing timestamp suppress odds. Partial one-of-six team stats retains2.91 and exactly five unavailable cells, with no historical fabricated fallback values. Empty loaded payload, right-rail/schedule errors (three alerts) and loading are distinct. The title “real odds” means synthetic odds-shaped inputs passed through the real display helper, not real provider observations. No source transport, receipt timestamp execution or deployed freshness is tested by this file.

### GamePreview.tsx — 1–447

`fetcher` rejects non-ok HTTP and returns parsed JSON; `scheduleFetcher` stamps client receipt time. Optional right-rail current game wins over supplied context; schedule request key needs resolved date. `finiteNumber` only admits actual finite numbers. `getBarWidths` rejects missing sides/nonpositive total and computes percentages; legitimate zero can remain a metric. Invalid dates show unavailable. Source types do not structurally validate every provider array/property at runtime; no malformed-envelope defect was asserted without a concrete allowed payload path.

Six metrics define complete team data. GF ratios are2decimals, percentage fractions×100 one decimal; partial fields show em dash. Market status requires helper available and fetch timestamp; model notice is unconditional. H2H accepts OFF/OVER/FINAL, preserves0scores, names a winner only when both finite and unequal, and distinguishes absent list from empty completed meetings. No starting goalie, line matchup or player trend is fabricated. Helpers called by this component were not re-imported/executed; prior market source audit remains separate.

### GoalieAdvancedMetricsTable.tsx — 1–266

Types enumerate name/GP/GS/QS% plus selected-strength workload/GSAA. Finite formatting only: number2decimals, ratio×100 one decimal; N/A otherwise. Name/count/QS are strength-independent; strength fields nullable. Stable decorate-sort-undecorate handles missing before direction and keeps them last both ways. Native sort buttons and aria-sort reflect state. Footer calls rows “season-level” while actual fetch uses a window; source granularity wording does not override the explicit selected-window tooltips. No numeric recomputation or held-out quality inference.

### GoalieLeaderboard.tsx — 1–269

Renders caller ordering, index+1 ordinal, named bands, missing-tier/insufficient-sample state, grade-week counts and records, SD raw/relative helpers, FP difference, SV3decimals and GAA2. Legacy weekly labels map to current names. Missing quality percentages default0 and colors use75/50 cutoffs; empty graded support is not displayed as unavailable. Actual zero-grade rate production is documented under W01, not misrepresented as a failed advanced tier guard. Relative SD subtracts one filtered mean so known numeric order is unchanged; parent sort's sentinel issue is distinct. No rank/tier calculation is performed in this component.

### GoalieList.tsx — 1–387

Eligible weekly rows call modern grade, ineligible/no-comparable grades remainnull; initial rank-point sort puts unclassified last. Display transformation maps DB fields through statColumns, converts TOIseconds to minutes, but substitutes zero for missing values (W01). Later interactive sort reverses missing placement under descending (W03). The string branch runs before the ranking-specific ordering branch, so that internal special-case would be unreachable for ordinary named ranks; current table has no clickable Rank header, so no extra reachable rank-sort finding was promoted.

Header averages preserveN/A, SV3decimals, rates2 and TOIminutes1. Dates use date-fns; sortkey admission rejects gameDate for this weekly context. Loading/missing-data/empty-data screens separate. Mapped rows feed actual GoalieTable; no network in the component.

### GoalieTable.tsx — 1–334

Comparison colors require selected stat and usable parsed numeric values, use shared direction map and count equality as better for visual coloring. Format null/undefined/empty asN/A; SV3decimals, GAA/SA60/SV602, integer counts or default1decimal. Nonfinite numbers are not explicitly rejected here, but no new runtime NaN case was claimed. Header averages, date/name/team labels and optional percentage/rank columns depend on parent rows. Null percentage displays Unclassified even though low color class is selected. Source supports normal native sort controls/aria but browser interaction was not executed.

### goalieCalculations.test.ts — 1–313

Eleven tests cover sample SD1.29099 and n<2null; legacy gradeall-betterElite100/20 and no-selectedAverage0/5; exact starter eligibility and band boundaries80/60/45/30; consistency75 from twoElite/twoGood, mean3.5starts and W-L/OT record counts; starter-only league saves26 with excluded relief2; tie50Average; no comparable week unclassified; zero-SA leagueSVnull. Synthetic game/week rows do not establish real provider completeness. Missing matched counts, zero-denominator *overall* ratio behavior, percentile-key completeness and weekly display coercion are absent from these oracles. Read only, no Vitest execution.

### goalieCalculations.ts — 1–816

Direction map includes count-volume and ratio keys; WoW points20/10/5/3/1 differ intentionally from consistency bands100/75/50/25/0. Starter floor1/1200s. Starter league averages divide each count sum by goalie count; pooledSV/GAA use saves/SA andGA×3600/seconds, with zero denominatornull but missing count support defective (W01). Consistency is rounded `max(0,100−populationSD(band)/50×100)`, requiring two outcomes. Average starts and common W-L/OT records use graded outcomes, missing counts coalesce0; no prediction is implied.

Sample SD uses n−1; overall ratio and FP helpers have W01. Modern grade filters finite mapped pairs and zero average, half-creditties, then fixed bands; legacy gives ties full credit and has no current non-test caller found. Actual percentile return is midrank `(below+.5equal)/N×100`, inverted for smaller; earlier rank-search code is unused.

Leaderboard requires league averages and game rows, groups per goalie, computes FP and a league per-appearance mean, processes supplied weekly window, counts graded/unclassified weeks, and aggregates all supplied game rows. Caller is responsible for game-date filtering; helper does not refilter. GP counts game rows, not sums games_played; source data assumes one row per appearance. Totals use seconds internally and display totalTOI minutes. Percentile populations and assignment switches disagree (W02). Return sorting is WoWpoints descending. No deduplication or snapshot-consistency claim is made.

### goalieMetrics.test.ts — 1–603

Twenty-one tests: relative columns/sort keys; filtered SD means3/6 and raw/relative±format; tier determinism, population sensitivity, optional QS effect, label/score; four-card helper copy; five exact strength prefixes; advanced aggregate QS.5, xGA4, xGA/602.67, SA/6026.67 and weighted distances36/20; safe formats and both-direction missing-last sort; static markup buttons/aria; pooledGSAA−1/+1 and missingGA null; incomplete QS/xGA60 null; exact mocked paged season/date/range calls; singleton no tier, four starts admitted only after loweringfloor, insufficient-sample/Wks markup.

The mocked Supabase builder logs arguments but does not enforce filters, ordering, schema or read limits. Fixture tests use renderToStaticMarkup in test source; the audit did not run React. Value-tier determinism and directional sensitivity are not calibration evidence. None covers standard-reader W01/W02/W03.

### goalieMetrics.ts — 1–781

Explicit five strengths and selected fields; paging1000, error propagation and exact window filters. Null helpers, complete sums, paired per60 and aggregateGSAA/QS details above. Weighted shot/goal distances pool matched positive-weight pairs, omitting missing pairs and no coverage label; currently not shown in the assigned advanced table. Numeric invalid player IDs are skipped while all input rows can contribute to the reference pool; no observed bad ID claimed.

Advanced GP/GS use finite-or-zero counts; personal full-window count/ratio calculations fail closed. League reference uses paired available rows and may be incomplete versus all appearances, so the title “every goalie” alone is not proof of full provider coverage. Current fetch/provider/catalog truth unverified.

Dormant metrics cards usetop3 and misleading unknown0 risk, separately recorded. Variance averages/formatter exclude missing and retainN/A. Tier cohort uses>=minimumStarts; required base components average known pairs or become unknown. Fantasy35%, consistency25%, workload20%, confidence20%; QS is optional third confidence dimension. Bands85/70/55/40 defineTier1–5. These are descriptive implemented weights, not established predictive qualification. Apply function preserves original rows and adds optionalscore/label plus insufficient flag.

### goalieTypes.ts — 1–251

Fantasy keysGA/SV/SO/W;14 numeric-stat keys; API/base displayTOIminutes versus game/weekly seconds; nullable weekly/game/league inputs, mostly nonnullable derived overall stats, optionalnullable SD/consistency/tier. Types expose the missing-input possibility but cannot validate payloads or justify zero coercion. No runtime action.

## Verification and limits

**Passed:** exact target blob/current equality for all12 paths; full read; TypeScript syntax AST parse for11 TS/TSX files; complete CSS inspection; 413 unique code nodes plus8style rows; 40 exact test assertion inventories; exact-source pure probes;427-row TSV7-column shape/unique symbols/path coverage; artifact whitespace check. See manifest for all hashes and read ranges.

Probe safety: full source reviewed first. Node loaded only local fs/crypto/assert/vm and installed TypeScript parser/transpiler. It selected named pure declarations and one `goaliesForTable` useMemo callback by AST, rejected emitted require/fetch/timer calls, and evaluated in an isolated VM with only exports or synthetic data. No imported application module, fetcher, Supabase builder, React render, browser or server ran. First probe established missingness/saves-only controls; a relevant extension added the actual12-column scenario and reran once. Receipt includes every extracted declaration's source range/hash and the exact probe script digest. This is targeted numerical verification, **not a passing application test suite**.

Context-only: `pages/goalies.js` bounded ranges, `goaliePeriod.ts:1–125`, `categoryCounts.test.ts:130–165`, governing decisions and prior checkpoint/recheck search references; application context matched target. No full page/social module completion. A combined owner-decision output was truncated; only separately visible/reread ranges are claimed, with the previously completed full governing read reused. Two exploratory glob commands referenced nonexistent patterns and failed without reads or mutation; corrected by exact file inventory/names.

No code/test edits, commits, network, DB, provider, browser, migrations or deployments. Chef must adjudicate IDs/severity and integrate only12 full paths. Runtime coverage, real payload prevalence, upstream QS/provider provenance and deployed output remain unverified.

## Root adjudication

Root reviewed the full report and independently inspected weekly zero defaults and sort, count/exposure summation, fantasy weighted inputs, zero-denominator overall ratios, percentile population/assignment switches, visible-set label and current page adapters/call. W01/W02 accepted P1. **W03 is also accepted P1**, superseding proposedP2: it changes reachable numerical ordering by promoting unknown rows, consistent with DRAFT04's classification. It is not just an inaccurate label. No hosted occurrence is asserted. Earlier advanced fixes and the explicitly preserved zero-baseline grading definition remain separate.

Only12scopepaths/421rows integrated; six context rows excluded. GamePreview stylesheet rows are no-math. No app/test/source edit or runtime qualification.
