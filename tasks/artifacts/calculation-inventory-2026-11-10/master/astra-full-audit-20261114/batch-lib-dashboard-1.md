# Dashboard library batch 1

Target `89da739cb45d7d572ed59bfa0b209c79c5d99299`. All **8 assigned files / 2,591 lines** fully read in path order; current bytes match the pin. The TSV contains **544 unique source identities**: 144 functions/callbacks, 203 initializers, 102 conditions, 63 assertion calls and 32 test/suite declarations. Exact offsets disambiguate anonymous callbacks. The manifest includes hashes, source ranges, bounded dependencies and complete isolated probe source/results.

This batch **extends existing AFULL-FORGE-W01 (P1)** for a separate active aggregate loader/caller, and adds **AFULL-DASHLIB1-01 (P2)** for a stale reader label. It does not duplicate FORGE-W03 or dormant D01–06. No actual test suite, app import, React hook, browser/server, network/provider/DB call, source edit or commit occurred. Only exact source declarations ran in an isolated VM with fake fetch/cache/metadata and extracted static scoring weights.

## Coverage

Paths relative to `web/lib/dashboard/`:

| File | Lines | Principal contract |
| --- | ---: | --- |
| dataFetchers.test.ts | 30 | Three-day aligned/four-day mixed recency boundary and corrected warning copy. |
| dataFetchers.ts | 826 | Public request parameters/cache lifetimes; typed section defaults, partial merges, scope labels and source-date recency. |
| normalizers.test.ts | 435 | Null/zero, CTPI missing components, tier/version provenance, serving metadata, goalie row basis and distinct own/team/unconditional Win. |
| normalizers.ts | 757 | Numeric/string/array adapters, rating/CTPI/sustainability/goalie/start-chart/trend payloads and legacy mover projections. |
| teamContext.test.ts | 81 | Independent power arithmetic, pace/tier invariance, CTPI endpoint delta and reciprocal edges. |
| teamContext.ts | 77 | Shared offense/defense mean, chronological spark delta, reciprocal team edges and missing whole-rating guard. |
| topAddsRanking.test.ts | 127 | Independent 2.725-point fixture, missing head/schedule, deterministic ties, uncertainty adapter and availability behavior. |
| topAddsRanking.ts | 258 | Per-game expected FHFH points, actual week games, conditional availability, incomplete admission and stable ordering. |

No assigned paths remain pending. `commandCenterData.ts`, `useDashboardData.ts`, endpoint sources, scoring config and UI readers receive **bounded context credit only**, not full scope coverage. Root retains canonical integration.

## Existing finding extension: AFULL-FORGE-W01 — P1

**Additional producer:** `dataFetchers.ts:398–433,493–507,664–740`. The Trends aggregate loader receives `params.date`, but `fetchTeamTrends`, `fetchTeamCtpi`, `fetchTeamSos` and `fetchSkaterTrends` omit it. A fully fulfilled section is marked resolved for `params.date` at 680–684 without comparing any returned date. These are independent fetch functions from the already-recorded `commandCenterData.ts` omission; fixing only that command-center request would leave this loader unchanged.

**Claim:** A selected historical date must not silently become a current-date trend request or a falsely resolved historical scope. Latest-only feeds may remain latest context if that scope is explicitly separated; their numbers must not be relabelled as historical.

**Exact evidence:** The fake-loader probe requests `2026-03-14`, forward, 3 GP. Captured URLs are:

- `/api/team-ratings?date=2026-03-14`
- `/api/v1/trends/team-power`
- `/api/v1/trends/team-ctpi`
- `/api/v1/trends/team-sos`
- `/api/v1/trends/skater-power?position=forward&window=3&limit=25&seriesGames=40`
- the two sustainability requests correctly contain `snapshot_date=2026-03-14`.

Date-free fake responses explicitly represent `2026-11-13`. The exact loader returns those dates for team/CTPI/SOS/skater and March 14 for sustainability, with **no section errors**, while setting `sectionResolvedFor.team="2026-03-14"` and `sectionResolvedFor.skater="2026-03-14; forward; 3 GP"`. The fake represents an admitted producer response, not an actual provider observation. `team-ctpi.ts:211–218` and `skater-power.ts:648–655` explicitly default missing query dates to current UTC date. The SOS endpoint is deliberately latest-current-season (`team-sos.ts:31–51,67–76`), so merely appending a date would not make it historical. The team-power reader likewise serves current-season history rather than a selected-date snapshot; its source-update label remains separate.

**Active caller/reader:** `/trends` passes its URL-selected date to `useDashboardData` (`pages/trends/index.tsx:330–345`). The hook invokes this loader and merges the result (`hooks/useDashboardData.ts:47–75`). The page consumes returned skater categories/summary/rankings at 634–687 and 1494–1515 without comparing their returned date to the requested date; team trend series similarly use the aggregate. The page does show a team source-update date and a global mixed-source warning when the observed gap exceeds three days. Those disclosures are preserved; they do not repair the omitted request date or the false resolved-scope marker. CTPI/SOS are loaded here but this bounded trace does not assert every field is currently printed on `/trends`. The already-established command-center terminal remains the direct CTPI numeric consumer in W01.

**Fix/test:** Propagate the selected date to endpoints that support it, validate/retain resolved dates per feed, and distinguish explicitly latest-only context from selected-date data. Do not mark a section resolved for a requested scope solely because all promises fulfilled. Add a fake transport test for exact URLs and different source/request dates, plus an active reader test. Existing `dataFetchers.test.ts` checks only recency text/gaps; it does not pin request date propagation. Public cache keys are URLs, so the omitted date also means different selections reuse the same trend request key for five minutes.

**Boundaries:** This is a shared-ID extension, not a new CTPI mathematical/version finding or proof of hosted historical leakage. The corrected candidate-v2 component nulls and explicit legacy/candidate goalie basis remain intact. The aggregate recency helper measures differences among observed dates, not freshness relative to the selection or wall clock; its three-day policy is not changed here.

## AFULL-DASHLIB1-01 — P2: active recency badge still claims a downgrade

- **Location:** Correct helper `dataFetchers.ts:351–395`, its test `dataFetchers.test.ts:17–24`, and actual reader `web/pages/trends/index.tsx:1207–1214`.
- **Claim:** A date-gap notice must not claim a numerical/quality downgrade when the code merely labels the gap. The helper explicitly documents this correction and says feeds “may be out of date.”
- **Exact evidence/scenario:** The exact helper with team date November 6 and start-chart date November 10 returns `status:mixed`, `gapDays:4`, and the corrected warning. The active JSX condition renders when that status is mixed and still prints **“Mixed dates · downgraded”**. The probe extracts that exact JSX text at character offsets 42246–42270, line 1213. A three-day control returns aligned/no warning. No ranking weight or projection adjustment occurs in this helper.
- **What's wrong:** The test's negative assertion against “downgraded” checks only `state.warning`, while the actual consumer appends the prohibited claim in a different span. Thus the library text fix is correct but its reader remains inconsistent.
- **Fix/test:** Replace the badge with a truthful mixed-date label, and extend an existing page/reader test to assert the whole rendered notice. Preserve the existing helper and its three-day boundary; do not introduce arbitrary down-weighting to match stale copy.
- **Readers/severity:** Active `/trends` mixed-source banner. P2 label-only; no hosted incidence, changed numeric calculation or model qualification claim. Chef assigned this new ID after checking for an existing one.

## Per-file numerical and admission review

**dataFetchers:** `buildQuery` preserves `0`/`false`, excludes only undefined and URL-encodes values. Trend TTL is five minutes; projection/rating/slate TTL is one minute. The shared cache is keyed by URL, deduplicates in-flight requests, bounds completed entries to 64, and exposes non-OK details only to the development console; it was inspected as a dependency, not executed. There is no automatic retry loop in these fetch wrappers. Goalie/start-chart/ratings/Forge and sustainability requests carry the selected date; goalie projections explicitly use horizon 1 and the documented fallback option.

Empty defaults contain empty collections, partial coverage and unavailable dates rather than fabricated measured results. Metadata indexes use known team lookup functions. Each section's `Promise.allSettled` applies successful siblings even if another fails; it retains failed siblings from the supplied base and leaves the last successful timestamp/scope marker. `mergeDashboardSections` replaces only requested sections and recomputes metadata/recency. This is not an atomic same-snapshot transaction. The hook's epoch protects older request epochs, while its retained base and page labels require caller-owned scope handling. This batch reports that boundary rather than assigning an unproved hook-race finding. The active reader does disclose a failed section's last successful timestamp/scope. No broader claim that all partial merges are safe is made.

`buildDashboardRecencyState` accepts date-shaped strings, computes UTC-midnight min/max difference rounded in days, returns insufficient below two sources, aligned at gap ≤3 and mixed above3. This is alignment, not a guarantee of currentness or historical admissibility. It uses `teamTrends.dateUsed` for the `teamPower` entry, not the independently fetched team-rating date. The two source tests independently pin 3/4 days and correct warning wording; they do not validate actual dates, payload completeness, selected-date identity or the page badge.

**normalizers:** Null, undefined, exact empty string and nonfinite inputs stay null in `toFiniteNumber`; numeric strings and known zero survive. The helper uses JavaScript `Number`, so it is not a strict type/range/ID validator for arbitrary malformed payloads. No new defect is inferred solely from hypothetical booleans/whitespace/arrays. `normalizeTeamRatings` requires team/date and finite offense/defense/pace, preserves unknown PP/PK tiers as null, passes calculation version/source cutoff through and retains optional component nulls. Its compatibility `trend10 ?? 0` does not establish that an unknown provider trend is truly measured zero; current source admission must be considered before a reachability claim.

Sustainability requires ID, score and luck pressure; optional z components, history and contributions are filtered individually. The compatibility default of non-provisional status to ready and the enum casts in serving metadata are not scientific qualification. CTPI normalization preserves null offense/defense/luck, actual supplied spark points and dateUsed, with generatedAt's date as a compatibility fallback. It drops some provenance/serving fields from this display shape; the current v2 producer remains responsible for admission. This batch does not reopen its version/formula closure.

Goalie normalization retains candidate versus legacy `row_basis`, distinct own conditional Win, team Win and unconditional credited Win, nullable counts/probabilities and matching candidate starter-selection context. Exact probe preserves 0.42/0.45/0.27 in those separate fields. **FORGE-W03 remains a consumer label defect**; the normalizer does not collapse the three populations. Missing whole identities are dropped, not invented. Nullable availability/risk data remain nullable.

Start-chart normalization delegates metadata and start basis to the canonical contract, then adapts raw games/goalies/ratings. A contract-normalization exception is tolerated for metadata compatibility and does not by itself discard raw games. Nonempty rating objects may contain nullable individual fields. This is a permissive adapter, not proof of complete source qualification. Existing tests independently pin basis propagation, known rate values, nullable tiers, version/source dates and ignored compatibility metadata. Neither API failure/metadata assertions nor mocked types prove every malformed payload is rejected.

Skater trend normalization requires numeric player ID, percentile, GP, rank and delta, preserving optional prior rank/latest value and supplied series order. It does not recompute mid-rank percentiles or rank populations. The inspected producer uses delta0 with previousRank null when movement is suppressed; normalizer filtering therefore does not drop those valid low-sample rows on a null-delta premise. `normalizeTeamMoversResponse` has no current production reference found; `normalizeSkaterMoversResponse` takes the first category and has only a test consumer in the bounded repository symbol search. Their limited projection shapes are not active composite-ranking definitions.

**teamContext:** The intended power score is exactly `(offense+defense)/2`, with ratings centered at100; pace and PP/PK tiers do not alter it. An independent test and exact probe give `(104+98)/2=101`. CTPI delta uses last minus first supplied chronological spark value, unknown with fewer than two points; it is a descriptive endpoint change, not a per-game slope or forecast. Known reciprocal matchup edges have equal magnitude/opposite signs. Whole missing rating objects produce no edge; **FORGE-D06** remains the dormant card's false “Off slate” interpretation, not a new map arithmetic defect. The active forge team-detail reader instead says matchup edge unavailable.

The legacy `normalizeSpecialTeamTier` maps unknown to2, but search found only its definition and test calls; the power formula no longer calls it, and the active rating normalizer preserves null. Do not undo that fix based on an unused helper.

A controlled partial input `{home:{offRating:null,defRating:100}, away:{offRating:100,defRating:100}}` yields edge−50 because the shared score uses null→0. **This is explicitly unpromoted**: the inspected start-chart producer uses `teamRatingsService` numeric mapping, and this batch has not established that a nullable individual metric is actually admitted/published. Whole missing teams are separately reachable and already covered by FORGE-W02/D06. No new finding or change to those severities is requested for the partial-object scenario.

**topAddsRanking:** Static FHFH weights are 3G+2A+PPP+0.2SOG+0.2HIT+0.25BLK. `projectionPts` is deliberately not added again. The independent fixture gives 2.725 points/game, displayed2.73; three games gives8.175→8.18. It multiplies the unrounded per-game value, not the displayed2.73. Only finite numeric heads are accepted by the API adapter; a missing required head or unknown week schedule produces typed incomplete/totalnull. Demand, ownership and uncertainty are tie-break/display context, not score terms. Sorting uses rounded totals, then demand, lower known ownership and ID; unique-ID input-order invariance is pinned by [1,3,2]. This is an ordered recommendation list, not a percentile computation.

Known-out tonight yields total0 with the conditional line retained; uncertain/unknown participation yields incomplete; known-out week is incomplete because later games are not qualified. Null availability on legacy runs is explicitly the existing projected-lineup compatibility policy, not newly certified evidence of participation. Finite nested role-continuity uncertainty is extracted without adding an object or NaN. The tests cover these distinctions with explicit independent values.

Active consumers are FORGE's tonight preview, `TopAddsWatchlist` and forge player details; dormant `TopAddsRail` remains a separate reader. The first two provide no week schedule and do not fabricate five games. Player detail explicitly refuses to divide its week/five-game totals into one-game heads, making that score incomplete. The earlier horizon/availability/unknown-head corrections are preserved. No predictive calibration, schedule completeness or ownership source freshness is established by this score-only audit.

## Verification and limits

- Scoped/support target hashes, 8-path coverage, unique offsets, TSV schema, exact source ranges and artifact whitespace checked. Four test files were fully read; their 32 suite/test declarations and 63 assertion calls are inventory, not runtime passes.
- One corrected isolated probe passed. Its first attempt failed before observations because the extracted CommonJS config export was not bound as the imported constant; the exact exported weights were then supplied to the fake VM dependency. Successful probes were not rerun. Manifest retains complete source and outputs.
- Existing FORGE findings remain separate from new evidence. No scientific, production, DB, route availability or hosted occurrence claims are made. No application/test edits, imports, actual hooks/tests, browser/server, secrets/env reads, provider/DB/catalog calls or commits occurred.
- Complete outputs: this report, `batch-lib-dashboard-1.tsv`, `batch-lib-dashboard-1-manifest.json`, and own diary. Chef owns adjudication and canonical records. No unread assigned files.
