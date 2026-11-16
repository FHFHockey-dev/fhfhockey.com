# Draft component audit — batch 2

Target `89da739cb45d7d572ed59bfa0b209c79c5d99299`. Root fully read seven files, **5,565 lines**, in assigned path order: ComparePlayersModal, LeagueStandings, MyRoster, ProjectionSourceAccuracy, ProjectionsTable, RoundRankChart and SuggestedPicks. All bytes match the target. The companion TSV inventories every function/component/internal closure; the manifest pins each file. Whole parent Dashboard, ScoringSettings and Summary are a separate worker batch.

This is source review, not a browser or production-incidence claim. No app import, React rendering, Vitest, HTTP, database, provider, write interaction or source/test modification occurred. Two isolated TypeScript-AST probes evaluated exact source expressions with supplied fixtures and exited 0. `draft-component-probe.cjs` and its JSON output retain the first probe. `draft-table-probe.cjs` retains the second; its successful stdout was observed in the tool transcript, not saved as a separate execution JSON. These probes establish the specific calculations below, not end-to-end qualification.

## Findings

### AFULL-DRAFT-01 — empty shared support becomes a zero-percentile tie

- **Severity:** P1, reachable unknown-value reader error; hosted occurrence unverified.
- **Location:** `web/components/DraftDashboard/ComparePlayersModal.tsx:178`, `:308`, `:456`, `:543`.
- **Claim checked:** rule21 unknown stays unknown; the summary should compare only supported shared categories.
- **Evidence:** target source and exact `useMemo` initializer probe. Existing `ComparePlayersModal.test.tsx:97` verifies missing row cells, but not the summary.
- **Wrong behavior/scenario:** player A has GOALS30, player B has unknown goals, and another cohort player has GOALS10. A's supported row percentile is75 and B's is null. With no shared rows, both average percentiles become0; both summary bars are0%, and the conclusion says “It’s a tie on average percentile.” No common measurement supports that zero or tie. The earlier row-level missing-value fix remains valid; this is new summary evidence.
- **Suggested fix:** nullable average and unavailable comparison when shared support is empty; suppress its winner/bars. Preserve real zero and supported ties. Add assertions for the summary to the existing unknown-input test.
- **Readers:** comparison modal launched from DraftDashboard and ProjectionsTable; summary, bars and winner text all share the bad average.

### AFULL-DRAFT-02 — incomplete team VORP shown and sorted as complete

- **Severity:** P1, reader mismatch.
- **Location:** `web/components/DraftDashboard/LeagueStandings.tsx:84`, `:233`; parent producer `DraftDashboard.tsx:2512` and `:2550` (bounded context).
- **Claim checked:** rule21 and the producer's `unknownVorpCount` qualification must survive aggregation and display.
- **Evidence:** parent sums known values and separately passes the missing count; LeagueStandings never consults that count. Exact-expression probe reproduces its comparator and display.
- **Wrong behavior/scenario:** team A has known VORP−5. Team B has one drafted player with unknown VORP, hence partial sum0 and unknownVorpCount1. B displays0.0 and sorts above A as though measured. Even a positive partial sum omits its incomplete qualification.
- **Suggested fix:** expose unavailable/partial VORP explicitly and exclude unqualified totals from complete ranking; retain legitimate measured0. Extend the existing standings test with missing VORP, known zero and a negative comparator.
- **Readers:** Draft Dashboard League Standings. Summary category-winner VORP has a related omission under review in batch3; it is not a separate finding ID. MyRoster's explicitly incomplete projected-points total is not this defect.

### AFULL-DRAFT-03 — standings assign distinct ranks to ties and rank unknown totals

- **Severity:** P1, reachable ranking error.
- **Location:** `web/components/DraftDashboard/LeagueStandings.tsx:74`, `:178`.
- **Claim checked:** decision90 tie handling and rule21 unknown ranking; numeric rank should describe a supported primary standing.
- **Evidence:** exact `standingOrder` expression and rendered `findIndex+1`; probe with tied and unavailable teams. Existing standings test covers nullable category/rate text, not these rank assertions.
- **Wrong behavior/scenario:** A and B both have supported10 points; C has an unknown total. The table gives ranks1,2,3 even though A/B tie and C has no comparable value. Sorting unknown last does not authorize assigning it a rank.
- **Suggested fix:** derive competition ranks from qualified primary values, give A/B rank1 and withhold C's rank; preserve deterministic order within ties without making order a distinct statistical rank. Add reversed-input/tie/missing regression fixtures.
- **Readers:** League Standings. DraftSummaryModal's ordinal team ranking and arbitrary single-winner tie handling are being integrated under this same ID by batch3; no duplicate finding is needed.

### AFULL-DRAFT-04 — missing values sort first in some numeric directions

- **Severity:** P1, reachable reader ordering error.
- **Location:** `web/components/DraftDashboard/ProjectionsTable.tsx:815` and `:826`; `SuggestedPicks.tsx:505`.
- **Claim checked:** unknown-last numerical ordering independent of ascending/descending direction; missing is not an extreme number.
- **Evidence:** exact comparator AST probes using actual stat-proration and availability helpers, with no app imports.
- **Wrong behavior/scenario:** an unknown projected statistic maps to negative infinity and appears before known10 in ascending order. Missing ADP is first in descending ADP in both tables. In SuggestedPicks, missing availability maps to−1 and appears before a known probability in ascending order. Each reproduced output was `[unknown player2, known player1]`. FP/VORP/VBD's existing known-last helper works and is not reopened.
- **Suggested fix:** retain null and use the finite-aware known-last comparator for every numeric field; apply direction only to two known values. Add ascending and descending missing/zero fixtures in the existing table/Picks tests.
- **Readers:** ProjectionsTable stat and ADP sorts; SuggestedPicks ADP and availability sorts. Similar MyRoster helpers are currently unbound/dormant and are not claimed as a second active consumer.

### AFULL-DRAFT-05 — production UI can expose pipeline diagnostics

- **Severity:** P2, diagnostic/label exposure under the governing classification.
- **Location:** `web/components/DraftDashboard/ProjectionsTable.tsx:1546`, `:2615`.
- **Claim checked:** §4 debug rule requires QA sources, skipped rows, IDs and pipeline reasons to render only in development.
- **Evidence:** complete source has no NODE_ENV gate; the settings checkbox toggles `showDiagnostics`, which directly gates the output. The same settings include a source cross-check action. No checkbox, source query or live page was invoked.
- **Wrong behavior/scenario:** production rendering with diagnostics selected and one unresolved mapping displays exclusion counts, raw/source IDs, mapping reasons and internal lane ownership text. Production receives the same branch as development.
- **Suggested fix:** development-gate both diagnostic controls and rendering, including the cross-check action; keep separately justified user-facing coverage text outside that diagnostic section. Existing tests need a production-environment nonrender assertion.
- **Readers:** ProjectionsTable settings and diagnostics panel. No secret disclosure or actual hosted exposure is asserted.

### AFULL-DRAFT-06 — historical goalie rates are rounded to integers

- **Severity:** P1, reachable precision/unit presentation error.
- **Location:** `web/components/DraftDashboard/ProjectionsTable.tsx:2560`, `:2726`, `:2747`.
- **Claim checked:** save fraction and GAA must retain their explicit precision; a rate is not an integer count.
- **Evidence:** exact StatPill conditional probe; historical SV% and GAA feed numeric values straight into the generic pill. Existing projected SV% test uses a different formatter; historical expansion coverage supplies skater counts only.
- **Wrong behavior/scenario:** numeric save_pct0.918 renders “1”; goals_against_avg2.42 renders “2”; shooting percentage12.3 renders “12”. The tooltip/ARIA retains the original value, so accessible text and visible number disagree. Null remains a dash and known0 remains0. The production totals table's current value/type prevalence was not queried.
- **Suggested fix:** pass a stat definition/formatter, using three decimals for save fraction and two for GAA while preserving integer counts. Add a numeric prior-season goalie fixture, not only projected columns.
- **Readers:** expanded prior-season summary in ProjectionsTable. The W-L-OT null-to-zero template is a separate producer-contract followup, not established as a reachable defect here.

### AFULL-DRAFT-07 — FP sort and color use a different quantity from displayed FP

- **Severity:** P1, reachable category-mode reader mismatch; color inconsistency is an associated presentation effect.
- **Location:** `web/components/DraftDashboard/ProjectionsTable.tsx:824`, value-band memos around`:940`, FP display around`:2178`; `web/lib/draftDashboard/playerValues.ts:49` and `:109` (bounded context).
- **Claim checked:** displayed FP, its sorting and its numerical band must have a common definition/unit.
- **Evidence:** target expressions; category-mode `buildPlayerValues` produces category z-score value, and its unweightedValue preserves that category quantity before position weighting. Exact-source comparator/band probes. Parent passes the valuations separately from raw projection FP.
- **Wrong behavior/scenario:** A displays FP100 with category value−1; B displays FP10 with category value+1. Descending FP sorts B before A because it uses the category value. The band code can mix a known category score with raw FP from a player whose category value is null, producing a green band for the unsupported valuation. Existing position-weight sorting fixture is points mode and cannot detect this category-mode unit mismatch.
- **Suggested fix:** sort/color the displayed FP quantity, with one consistent proration policy; keep category-score bands separate and do not replace unknown category value with FP. Add category-mode reversed FP/category ordering and missing-category-score regressions.
- **Readers:** ProjectionsTable FP sort/color in DraftDashboard. The underlying z-score calculation is not alleged wrong by this finding.

### AFULL-DRAFT-08 — off-night rank quartiles use endpoint ranks instead of midranks

- **Severity:** P2, numerical styling/tooltip classification.
- **Location:** `web/components/DraftDashboard/ProjectionsTable.tsx:1030`, `:2392`.
- **Claim checked:** decision90 midpoint percentile definition, including ties, for the displayed rank quartile.
- **Evidence:** exact rank-map probe; formula is average zero-based tie index divided by n−1, with singleton0.
- **Wrong behavior/scenario:** distinct descending off-night counts5,4,3,2,1 get inverse percentiles0,.25,.5,.75,1 and quartiles1,2,3,4,4. Midranks are .1,.3,.5,.7,.9 and quartiles1,2,3,3,4. The fourth player is labelled quartile4 instead of3. Counts themselves remain unchanged.
- **Suggested fix:** use the shared directional midrank definition and explicitly handle singleton/tied populations; test five values, ties and one supported value. No current test pins this distinction.
- **Readers:** ProjectionsTable Off column color and “rank quartile … of4” title.

### AFULL-DRAFT-09 — Score and VBD tooltips describe retired formulas

- **Severity:** P2, label-only.
- **Location:** `web/components/DraftDashboard/ProjectionsTable.tsx:1720`, `:1762`, `:1839`.
- **Claim checked:** decision62 category weighted-z definition and decision76 frozen VORP-based VBD; labels agree with the shared definition.
- **Evidence:** exact titles versus `buildPlayerValues` and current VORP pipeline/legend, reviewed as bounded imports. No numeric formula drift is asserted.
- **Wrong behavior/scenario:** a weighted z score2 is described as “Percentile-weighted category score”; a VBD10 from VORP10, regardless of VONA30, is described as a “blend.” Current explanatory legends elsewhere use the corrected concepts.
- **Suggested fix:** use the current weighted-z and frozen-replacement descriptions consistently; extend existing header/title assertions. Do not change calculations to match obsolete wording.
- **Readers:** table sort-button tooltips and accessible descriptions, in both relevant table modes.

## Other reviewed calculations and limits

- **ComparePlayersModal:** each supported category correctly uses `(below + half tied)/n`, with direction for lower-is-better statistics. Shared support is paired before averaging. Per-game counts require positive finite GP; rate/percentage fields are not divided by GP. Internal NaN for missing per-game values is displayed as a dash. The unsupported summary above is separate from these correct row rules.
- **LeagueStandings:** schedule totals deduplicate roster/bench identities; supplied category values preserve null and definition precision, and category estimated markers remain visible. All-tied category tones are suppressed. Parent aggregation and shared category standings have separate full-file reviews pending.
- **MyRoster:** configured slots plus bench define capacity; progress bars clamp visually while explicit over-capacity counts remain visible. UTIL accepts nong Goalies through normalized eligibility. Partial projected points explicitly say incomplete. DUST requires a ready baseline; unavailable schedule metrics are not painted as known zero. The local recommendation-sort helpers are presently not bound to rendered JSX. Provider eligibility/parent source selection belongs to the parent review.
- **ProjectionSourceAccuracy:** matched-support MSE delegates to the sourceAccuracy helper; null is a dash, known zero is0, other values use three significant digits. It explicitly calls the comparison retrospective with current source values, not vintage validation or adaptive weights. Bounded helper review checks common support and squared-error mean; no model qualification or fetched source-vintage validation occurred.
- **ProjectionsTable:** full-pool FP competition ranks preserve ties and exclude missing values; ADP-minus-rank uses the unfiltered cohort. ADP availability uses the shared conditional heuristic and excludes drafted/unavailable players. Projected-stat formatting has distinct save-fraction/percentage/count handling. 84-game count proration uses the shared helper without scaling percentage rates. Prior-season data are loaded on expansion in batches, not on mount; no loading interaction was executed. Cache ownership across changed season props remains a followup rather than a confirmed finding. Selection/pagination/empty states were fully read. Ordinary numeric legends and known-last FP/VORP/VBD behavior do not resolve the separate field-specific defects above.
- **RoundRankChart:** SVG coordinates use finite positive guard denominators; null rank breaks lines, tied ranks share a height. The bounded roundRankHistory producer emits contiguous rounds, avoiding sparse-round x overshoot. Missing supporting player values withhold that round's ranks. This is a round value history, not a claimed category standings calculation.
- **SuggestedPicks:** local candidate path truncates to200 before suggestions; Pro remote candidate input is filtered/bounded to2000 with at most100 requested results. Returned identities map to current players; global VORP is the displayed valuation. DUST orders active games, then known value, then ID and requires ready schedule basis; weekly DUST stays unavailable. Tier advice labels its .5/1.5 expected-remaining cutoffs as uncalibrated heuristics. The upstream tier construction remains pending. Ordinary ordinal row badges are list positions, not newly asserted statistical ranks.

Full-file coverage does not mean every imported producer, persisted record, provider rule, browser state or live response is verified. Bounded context included roundRankHistory, categoryStandings, sourceAccuracy, scheduleMetrics, playerValues, proration, availability and exact parent/summary ranges; none is added to the audited path count solely from those reads. Existing tests cited here were previously source-reviewed; no successful test was rerun. All nine findings await TJ's later §7 selection before any fix.
