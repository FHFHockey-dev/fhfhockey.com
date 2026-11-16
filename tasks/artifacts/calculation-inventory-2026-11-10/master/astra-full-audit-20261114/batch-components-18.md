# Underlying-stat components — batch18

Root full-source review at `89da739cb45d7d572ed59bfa0b209c79c5d99299`: all10 scoped paths under `web/components/underlying-stats/`, **4,475 lines**, read in path order. Scope hashes, every function/callback/initialized value and numeric column declaration are retained in the manifest/TSV. No application or test source changes.

## Findings

### AFULL-UNDER18-01 — P1: IPP chart summaries average ratios and drop unknown games

- **Claim/location:** `PlayerStatsExpandedRowChart.tsx:427–468,497–550`. Decision19/W2-2 requires ratio summaries pooled by their own denominators, preserving unknown support.
- **Evidence:** IPP is omitted from `POOLED_RATIO_SPECS`; it falls into generic mean-per-game arithmetic. Exact-source VM inputs with game IPP1 from1point/1on-ice goal and IPP0.5 from5points/10on-ice goals produce rolling/window0.75, whereas pooled IPP is6/11≈0.54545. Replacing the second game's IPP with null produces a displayed rolling/window1 with no partial-support disclosure.
- **Producer/readers:** `playerStatsColumns.ts:143,180` offers IPP in both individual families. `pages/underlying-stats/playerStats/index.tsx:715–724,1374–1397` excludes only identity text fields from the chart and mounts it with this metric. `lib/underlying-stats/playerStatsLandingServer.ts:4800–4880` maps one summary row per game;5055–5068 computes each IPP from matched on-ice goals, retaining null when that denominator is unknown. That matched denominator is not passed through as an explicit chart field. The table's pooled producer is distinct from the chart's ratio averaging; no current stored value or browser incidence was checked.
- **What remains correct:** SV%, GAA, shot shares and generic per60 summaries still use paired pooled support. The exact probe independently retains the6/11 SV% result. This finding extends the existing pooling closure only with the newly checked omitted IPP reader.
- **Suggested fix/test:** Carry the same matched on-ice-goal denominator with each chart point and register IPP as a pooled ratio; keep an unknown window unknown unless explicitly labelled common-support coverage. Extend the existing chart test with unequal denominators and an unknown denominator. Its existing SV/GAA oracles are valid but do not cover IPP. The current label “Mean per game” accurately names its implemented operation but does not meet the binding ratio definition.

### AFULL-UNDER18-02 — P2: chart dates move to the previous day west of UTC

- **Claim/location:** `PlayerStatsExpandedRowChart.tsx:348–372`; a game-date label should retain the supplied NHL schedule date.
- **Evidence/scenario:** Both helpers parse `2026-11-14` at midnight UTC and format with no timezone option. Exact-source probe with `TZ=America/New_York` returns **Nov13** and **Nov13,2026**. The API's `gameDate` remains Nov14. This affects the X-axis/brush label through `buildExpandedRowChartData` and tooltip through `formatLongDate`; numerical rates are unchanged.
- **Reach/readers:** Same actual expanded player/goalie chart reader above; the browser's default locale timezone supplies the offset. No live browser was used. Invalid dates already fall back to their input.
- **Suggested fix/test:** Format a date-only value consistently, for example pin UTC for these UTC-created date objects or use a date-only helper. Extend the existing chart tests with a west-of-UTC timezone and retain the original schedule date at both axis and tooltip.

## Complete-file review

| Scoped file | Lines | Checked contract and oracle boundary |
|---|---:|---|
|PlayerStatsExpandedRowChart.test.tsx|93|Mocked goalie route/AbortSignal/loading text; independent1/1+5/10→6/11 SV,5GA/4800sec→3.75GAA, missing exposure→null and mean saves3. Recharts entirely mocked; no rendering/real API proof.|
|PlayerStatsExpandedRowChart.tsx|550|Player/goalie request identity and abort cleanup; loading/error/empty suppression; fixed geometry; finite formatting; count means, paired ratio/per60 windows and original-date labels. Findings above.|
|PlayerStatsTable.test.tsx|875|Six family contracts, sticky offsets, percent/TOI formats, sort callbacks, pagination/load-more/state gates, expanded row position, supplied tie ranks and SplitGP labels. Many synthetic numeric fields are deliberately not mutually consistent, so this is a renderer oracle, not a producer proof.|
|PlayerStatsTable.tsx|527|Shared formatter and passed values, supplied competition rank or page-aware ordinal explicitly labelled sort position, sticky/extra column geometry, guarded pagination and load-more.|
|TeamStatsFilters.tsx|490|Ordered season bounds, scope mutual exclusion, legacy gameRange alias, date/lastN selection, nullable seconds floor, exact strength/score/venue labels.|
|playerStatsColumns.test.ts|732|Independent fixed key/label/format contracts for six families, hidden heuristic xG/default-sort changes, identity arrays and numerical format examples. This is useful contract coverage, not numerical aggregation qualification.|
|playerStatsColumns.ts|408|Six field/label/unit families; decimal fractions assigned percentage format, seconds TOI adapters, house-location FHFH labels, hidden xG and visible default sorts.|
|playerStatsSorting.test.ts|130|Defaults, descending first click/toggle, unknown-key preservation and active header metadata. It does not exercise actual server numeric sorting.|
|teamStatsColumns.test.ts|388|Fixed ordered counts/rates schemas, identities, visible CF% default and hidden xG, representative formatting.|
|teamStatsColumns.ts|282|Counts/rates labels and identity geometry, house-chance provenance, shared defaults and conditional removal of record columns.|

The expanded chart's pooled denominator helper refuses any missing numerator/exposure and nonpositive total exposure. Count/distance-like summaries explicitly say mean per game. Source charts use supplied chronological order; bounded producer tracing confirms ascending game-date/ID order. Selected strength/scope are passed through the chart API builder; player-window minimumTOI is deliberately removed from per-game point admission, preserving the earlier fix. A cleanup AbortController exists; no unsupported stale-result race is alleged from arbitrary mocks that ignore browser abort semantics. `connectNulls` remains on summary lines, a visual continuity limitation whose rendering was not exercised; no additional confirmed finding was invented from it.

The generic table's leading `#` explicitly says “Position in the current sort (not a quality rank)” and carries page offsets; where a server rank exists, tied ranks are preserved. This is different from the literal Rank defect in SkaterAdvancedMetricsTable. GP becomes SplitGP when appropriate, with its support explanation. Test fixture82GP/3723seconds is supplied rendering data; it does not qualify an actual season denominator. Column counts, colspan and viewport dimensions are presentation geometry. Page range text trusts server pagination metadata; no malformed-response incidence established.

Team controls treat dates and each team's own lastN as mutually exclusive scopes; old gameRange links show through the same field. The number parser accepts nonnegative integers and treats blank as null; scope normalization is upstream. There is no provider, cron or write action in these controls. `teamStatsColumns` leaves record visibility to its caller: bounded `pages/underlying-stats/teamStats/index.tsx:383–397` correctly enables record columns only for all strengths/all scores. This preserves decision92 rather than treating the default argument alone as a defect. The table column definitions contain no model computation or qualification claim. FHFH shot-location provenance and retired heuristic-xG hiding remain in place.

## Evidence and limits

`components18-probe.cjs` ran once with `TZ=America/New_York`, exit0, retaining `components18-probe-output.json`. It extracts exact pure declarations into a one-second VM using Node/TypeScript only. No application imports, React/Recharts, test runner, network/provider/database, browser/server or production operation. All10 target/current hashes and unique inventory identities checked. Every scoped test source was read, **none run in this batch**. The supporting formatting/sorting/producer/page snippets remain bounded context, not whole-file credit; full server aggregation, data freshness and live page checks remain pending.
