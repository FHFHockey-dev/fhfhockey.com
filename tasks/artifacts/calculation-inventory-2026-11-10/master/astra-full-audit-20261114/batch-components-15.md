# Components 15 — stats boards, sustainability, team dashboard

Worker `readfirst_production`; target `89da739cb45d7d572ed59bfa0b209c79c5d99299`. All **12 scoped paths, 5,754 lines** were fully read in scope order, stopping before TeamLandingPage. All local hashes equal target hashes. The TSV has **737 unique character-offset identities**: 333 function-like declarations/callbacks, 352 initializers, 51 test/suite declarations, one no-math stylesheet row. No unread assigned remainder. Bounded dependencies have separate manifest entries and receive no full scope-audit credit.

Proposed findings: six P1 source-reachable defects and one P2 legend defect. These are local counterexamples, not hosted incidence. CTPI beta/current same-games closures, pooled NST/WGO rates, StatsPage zero/qualifier/tie handling, and TeamDashboard request ownership remain preserved. Both approved database batches are exhausted; this worker made no database or external requests.

## Complete scoped coverage

Paths below are relative to `web/components/`.

| Path | Lines | Reviewed contract / test boundary |
| --- | ---: | --- |
| StatsPage/LeaderboardCategoryGoalie.test.tsx | 36 | Real zero formatting; empty/withheld qualifier wording. Source reviewed only. |
| StatsPage/LeaderboardCategoryGoalie.tsx | 88 | Nullable fraction/decimal presentation and supplied board order. |
| StatsPage/MobileTabInterface.test.tsx | 162 | Tab/section selection, values, empty boards, ties at fifth, printed qualifier. Source reviewed only. |
| StatsPage/MobileTabInterface.tsx | 312 | Raw-value competition ranks, finite formatting, board/context/detail mapping. |
| SustainabilityVSCareerChart/SustainabilityVSCareerChart.test.tsx | 70 | Sample-aware color example and unknown comparison; mocks hook outputs. Source reviewed only. |
| SustainabilityVSCareerChart/SustainabilityVSCareerChart.tsx | 236 | Current/career comparison admission, fraction formatting, color and legend semantics. |
| TeamDashboard/RecentTeamFormBeta.module.scss | 349 | Diverging ±2 SD track, clipped-end marker, layout/unknown/debug presentation; no estimator. |
| TeamDashboard/RecentTeamFormBeta.test.tsx | 434 | Issued candidate contract, same-date identity, partial/unknown states, bar clipping, development-only diagnostics, source-import boundary. Source reviewed only. |
| TeamDashboard/RecentTeamFormBeta.tsx | 293 | Issued score and SD units; same/separate sample labels, pooled PDO context, explicit descriptive beta. |
| TeamDashboard/TeamDashboard.test.tsx | 1,025 | Context/race guards, rates pooled from counts, incomplete counts, progressive loading. One existing test endorses unknown schedule → 0% workload. Source reviewed only. |
| TeamDashboard/TeamDashboard.tsx | 2,220 | Exact team/season identity, requests, aggregations, goalie workload/QS, ranking populations and displays. |
| TeamDashboard/useRecentTeamFormBeta.ts | 529 | Versioned candidate reader, exclusive cutoff, score-date confirmation and same-games comparison. |

Full hashes, reading ranges, probe source/results and bounded reader hashes are in `batch-components-15-manifest.json`. TSV source excerpts and zero-based UTF-16 start/end offsets disambiguate every callback, including several on one line. Finding tags on enclosing function rows identify contained defects; they do not condemn every operation in that span.

## Findings

### AFULL-COMP15-01 — P1: scheduled entries dilute goalie workload; missing schedule becomes 0%

- **Location/claim:** `TeamDashboard.tsx:550–624,2040–2075,2155–2202`; “% of starts” requires a known, compatible completed-game denominator.
- **Exact evidence:** Probe `workload` extracts the current schedule filter, goalie mapping and totals. With one final `OFF` regular game, one postponed `FUT` entry and one same-day `FUT` game, all within the requested date bounds, `completedGames=3`. A goalie with one completed start gets **33.333333%**, displayed as **33.3% of starts**, instead of 100% of the one completed game. With the same goalie and an empty schedule response, the share becomes **0%** rather than unknown.
- **Cause/reachability:** The schedule endpoint returns a season schedule; filtering at 583 checks only `gameType===2` and inclusive dates. `goalieEndDate` can be today, so an unstarted game later today is admitted. No `gameState`/postponement check exists, and zero denominator explicitly maps to zero. `fetchWithCache.ts` returns the provider JSON unchanged; it does not filter finality. The summary query separately requests aggregated regular-season goalie games. The printed label says starts, not scheduled opportunities.
- **Readers:** Current team dashboard individual cards, workload bars, combined distribution and legend. The team page → TeamTabNavigation → TeamDashboard path is source-confirmed below. No real provider payload was fetched.
- **Test/fix:** Existing test “keeps goalie workload finite when the schedule feed is empty” expects `0.0% of starts`; it proves finite output but pins the wrong missingness oracle. Require completed official games and compatible summary cutoff/coverage, or a verified complete starts denominator. Keep unavailable denominator unknown; test future/postponed/empty/partial schedule cases and share conservation.

### AFULL-COMP15-02 — P1: quality-start missingness and known zero are reversed

- **Location/claim:** `TeamDashboard.tsx:623–624,630–659,2105–2126`; unknown QS should remain unknown, while observed zero QS% should display zero.
- **Exact evidence:** Probe `qualityStarts`: a valid summary goalie with no matching advanced row receives `qualityStarts=0`, `qualityStartsPct=0`, and team total QS=0. An observed advanced row `{qualityStart:0,qualityStartsPct:0}` produces the same internal values, then the exact UI conditional displays **N/A** for QS% instead of **0.0%**.
- **Cause:** Optional advanced fields use `|| 0` and are added into team totals; display uses a truthiness check for the rate. Partial advanced responses therefore fabricate complete zero counts while genuine zero rates are hidden.
- **Readers:** Team QS total, individual QS and QS% in the active dashboard. This is a distinct local implementation from earlier GoaliePage/PlayerStats findings; no shared helper is responsible.
- **Test/fix:** Preserve nullable advanced observations and require complete compatible coverage for team QS. Test missing advanced row separately from known zero. Render rates with null/finite admission rather than truthiness. Existing component tests supply empty advanced data but do not assert QS missingness.

### AFULL-COMP15-03 — P1: nullable summary counts and zero GP become ranked numeric rates

- **Location/claim:** `TeamDashboard.tsx:468–490,830–867,1070–1096`; missing official totals and absent exposure must not yield known rates or ranks.
- **Exact evidence:** `summaryUnknown`: current team GP=1, GF/GA/points/point_pct=null, peer GF=3/GA=2/GP=1. Exact expressions produce current GF/GP=0, GA/GP=0 and **GA/GP rank #1**; point values also become zero. Expected current rates/ranks are unknown. `summaryZeroGp`: current GF=GA=GP=0 yields internal rates 0 and **rank #2**, although the current rate formatter correctly displays **N/A**. The cohort filters zero GP out, then `calculateRank` returns population length+1 for the nonexistent value.
- **Source admission:** `database-generated.types.ts:29949–29975` explicitly permits nullable summary counts/rates. Primary display state and ranking calculations independently coerce them with `|| 0`; the rank denominator also uses `GP || 1`. No data constraint/readback proving absence of nulls was obtained in this batch.
- **Readers:** Team statistics, offensive/defensive rankings and rank colors. Actual zero values with positive exposure remain valid; this finding concerns missing counts and absent exposure.
- **Test/fix:** Keep null fields nullable, require positive known GP, and use the same validity contract for displayed values and ranks. Add null-total and zero-GP rank assertions to the existing tests; the current zero-GP test checks `N/A` display but not the fabricated rank.

### AFULL-COMP15-04 — P1: completely absent teams bypass the incomplete-ranking guard

- **Location/claim:** `TeamDashboard.tsx:193–239,776–828,963–1072`; league rank must disclose or verify its population.
- **Exact evidence:** Probe `absentPeerAggregate` runs the exact grouping and rank helper with one returned EDM game, CF=55/CA=45, while the same-season summary roster includes EDM and BOS. A focused follow-up exact-expression probe explicitly supplies `games_played=1` for both EDM and BOS in season 20262027; BOS is eligible and played, not idle. The aggregate contains only EDM and produces **#1** for CF%=0.55; BOS has no source row and its value is unknown. The output is an unqualified league rank, rather than unknown or explicitly rank 1 of 1 observed team.
- **Cause:** The finite-value guard rejects null metrics in rows that exist, but grouping creates no entry for a wholly absent team. The reader never reconciles returned identities with the expected team population. This also affects separate WGO-derived count ranks. The existing missing-peer test supplies a peer row containing null; it does not exercise an absent row.
- **Readers:** League ranking grids and performance colors. This is not a claim that any hosted team is currently absent. The positive-GP summary rows are the independent fixture eligibility oracle; source does not reconcile secondary membership against those played teams.
- **Test/fix:** Establish expected season/team membership and per-metric completeness before assigning a league rank, or label the observed partial cohort and its size. Test missing identity separately from explicit null. Preserve valid tied competition ranking and pooled ratios.

### AFULL-COMP15-05 — P1: a late career response can be compared with another player's current sample

- **Location/claim:** Bounded dependency `web/hooks/useCareerAveragesStats.ts:8–35`; scoped consumer `SustainabilityVSCareerChart.tsx:112–163`. Current and career values must belong to the same selected player.
- **Exact evidence:** `careerRace` executes only the AST-extracted effect callback with controlled fake promises. Start A's request, change `playerId` to B, resolve B with career S%=0.20, then resolve A with S%=0.05. After B: B data/loading=false. After late A: **A data/loading=false**. Both effect invocations return no cleanup. No React hook or actual fetch was executed.
- **Reachability:** `/charts` holds mutable `playerId` and mounts the chart without a player key; both responsive layouts pass the selected ID. `useSustainabilityStats` has a response ownership flag for its current data, so B's completed current request may remain B while the unguarded career request commits A. The chart requires only `!loading` and nonempty objects, not matching identities, before comparison. Thus its guard does not suppress this settled mismatched result.
- **Readers:** Current-vs-career values and sample-aware color decisions in `/charts`. Dependency fully inspected for this trace, but not credited as a scoped hooks audit. Parent explicitly assigned ownership of this reproducible dependency finding.
- **Test/fix:** Add request identity/cancellation to career reads and expose scope-keyed state synchronously; discard old success/error/finally state updates. Add a controlled out-of-order A/B test. The existing chart test mocks hooks to already-settled values, so it cannot detect the race.

### AFULL-COMP15-06 — P2: blue legend falsely promises “within range”

- **Location/claim:** `SustainabilityVSCareerChart.tsx:99–105,209–214`; the legend should describe the actual color mapping.
- **Exact evidence:** `legend` evaluates `statusColor("cold","hot")`, which returns blue `#07AAE3`. `cold` is outside the usual range on the low side; for S%, the declared red direction is hot. The legend nevertheless says **“Blue: within the career usual range for this sample.”** Favorable outside-range observations receive the same blue as neutral observations.
- **Readers:** Chart swatches, labels and legend. The statistical range computation is not changed or invalidated by this label defect; P2 only.
- **Test/fix:** Describe blue as within range **or outside in the favorable direction**, or distinguish favorable outside-range status. Add explicit neutral/hot/cold mapping assertions, not only one within-range example. This finding does not assert predictive sustainability qualification.

### AFULL-COMP15-07 — P1: displayed PP/PK values and adjacent ranks use different source samples

- **Location/claim:** `TeamDashboard.tsx:520–533,869–875,1096–1112,1526–1589`; a rank attached to a displayed metric should rank that same value/population.
- **Exact evidence:** `shownPpAggregate` computes WGO PP 1/4=0.25. `ppValueRankMismatch` uses the actual rank calculation with summary PP=0.80 and peer PP=0.50, producing **#1** beside the WGO **25.0%**. Ranking the displayed values (25%,50%) instead yields #2. These are deliberately differing valid source snapshots, not a claim that hosted providers currently disagree.
- **Cause/reachability:** Displayed PP/PK fractions come from pooled date-bounded WGO games; rank values come from `team_summary_years`. Independent reads have no common game-set, freshness or equality check. The advanced include-playoffs toggle also changes the WGO date window while summary rank scope is unchanged. Source divergence is admitted, and the displayed rank does not identify its alternate basis.
- **Readers:** PP%/PK% values, adjacent ranks and rank-based colors, plus special-team ranking grid.
- **Test/fix:** Derive displayed fractions and peer rankings from the same complete cohort/window, or explicitly separate and name the summary-source rank. Existing tests independently check WGO pooled rates and ranks, but not their agreement under differing source inputs. Preserve the corrected ratio-of-sums calculation.

## Preserved behavior and limits

**StatsPage:** `LeaderboardCategoryGoalie` retains observed zero SV/GAA/QS rates; mobile finite helpers likewise retain zero and show explicit unknown placeholders. QS fractions multiply by 100 once. Mobile competition ranks use the first equal raw value on the already-sorted board, so ties at fifth remain fifth; this is an ordinal board, not a percentile. Exact isolated tie probe returned rank 2 for the third row in `[9,8,8,6]`. The active `/stats` caller supplies the same lists to desktop/mobile, prints qualifier notes, and withholds unknown-qualifier rate boards. Bounded `statsPageFetch.ts:365–432` shows rate-board null exclusion and positive GP, with qualifiers tied to the board's actual season. Upstream stats derivation is not requalified here. Optional skater PP-assist subfields default to zero upstream and in mobile detail text; no new finding is promoted solely from arbitrary malformed props.

**Sustainability:** Seven columns use fractions or SOG/60 in the displayed units. `compareWindowToCareer` receives numerator/denominator components, checks finite known nonnegative values and positive denominators, and delegates proportion/rate usual ranges. The current sample's size affects the threshold; the old fixed-gap rule is not restored. The existing frozen example checks S%=2/10 against 100/1000 as blue and sparse SOG/60 as red, with unknown xS% grey. This batch does not rerun or scientifically qualify beta-binomial/negative-binomial interval implementations. xS% comes through the sustainability source contract; this is not proof of serving the retired custom xG champion.

**Recent Team Form beta:** Candidate v2 rows require the exact formula/input/publication contract, finite score and ready/partial status; insufficient recent games have their own state. The latest-row query uses team, season, v2, exact formula and date ≤ Eastern today. Supporting games are before the snapshot, not inclusive of it. Component unknowns stay unknown with reasons; score, SD parts and PDO context have distinct units. Bars cap visual extent at ±2 SD with an explicit clipped mark; printed SD values remain uncapped. Debug lineage renders only in development. No beta value flows into predictions/rankings from these scoped sources.

The score's dates are accepted only with matching window length, newest date and season count. “Same games” then requires every ordered 5v5 date to match. Exact-source probes retain `sameGames=true` only for the aligned fixture; a shifted window, one inner-date mismatch, or changed season count all return false. The existing tests independently exercise these distinctions and keep unconfirmed score dates separate. We do not infer immutable issued game membership solely from a current reread or re-audit source fingerprint semantics here; these are the preserved documented guards, not a new broader closure claim.

**TeamDashboard:** Canonical positive team ID, matching known abbreviation and consecutive-year season guards precede requests. Explicit selected season bypasses unrelated current-season loading/error. Primary read completion is separate from goalie/rank completion; context identity hides prior-team results synchronously and cleanup rejects stale updates. Tests include deferred old results/unmount rejection, metadata bounds, unknown exposure and ratio-of-sums counterexamples. NST and WGO pooled helpers require complete same-sample fields per metric and preserve unknown GP. `formatPerGame` correctly rejects zero exposure; finding 03 is the separate ranking path. Fixed goalie color thresholds are heuristics, not percentiles. Historical fallback dates are approximate October–April/June bounds and were not checked against every historical schedule. No playoff coverage or provider completeness is newly certified.

Active reader chain: `web/pages/stats/team/[teamAbbreviation].tsx:76–102,234–243` takes team/season from the latest summary and passes TeamTabNavigation; its `:330–340` dashboard branch mounts this component. The beta is mounted inside the dashboard's current momentum section. Other imported timeline/leaders/L10 components are outside the 12 scoped files and receive no full coverage credit in this batch. The source-import boundary test is a bounded symbol-search guard; reading it does not prove every possible indirect consumer was executed or searched.

## Verification and handoff

- Full 12-file source/test/stylesheet reading and all target/current hashes passed; all bounded support hashes match too.
- Exact AST expression/function probes ran locally with Node built-ins and TypeScript transpilation only. The career effect used controlled promises and state sinks, with no React/application execution. Probe scripts, extracted spans and complete outputs are embedded in the manifest.
- The support probe initially failed because a lexical VM binding was read as an object property; corrected binding access succeeded. The already-successful main probe was not rerun. Retained-output assertions cover findings and preserved same-games cases.
- Existing Vitest files were read, not run. No app/test edits, server/browser, production imports, DB/catalog/provider/network calls, or commits occurred. No hosted occurrence, runtime performance, or predictive validity is asserted.
- Outputs: this report, companion TSV/manifest, and own diary. Chef owns severity adjudication and canonical integration. No assigned source remainder; later scope begins at TeamLandingPage.

## Root adjudication

Full report and critical workload/QS, summary/rank, PP value/rank, career effect/consumer and legend branches reviewed. All seven findings accepted at stated severities. Finding04 was tightened at root request to a same-season peer with positive GP, wholly absent from the secondary source, so it does not confuse missing data with legitimate ineligibility. New focused retained probe checked; earlier successful probes not rerun. All12 scoped target hashes independently match. Career dependency is not scope coverage.
