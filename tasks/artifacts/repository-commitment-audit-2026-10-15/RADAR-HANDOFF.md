# Two statistical-display defect handoffs

Prepared from the existing audit with a narrow source/status recheck on October 15, 2026, approximately 05:47–05:49 UTC. **Implementation approval is being obtained by Scout.** No application code, tests, shared registers or other workers' files were changed. No new broad audit or runtime/browser/database checks were performed.

Canonical checkout/branch remains `/Users/tim/Code/fhfhockey.com` / `octoberBranch`. The three proposed application files below are clean and their SHA-256 hashes still match the earlier audit. Use one owner for both defects because they touch the same component/test.

## 1. FRESH-01 — inverted favorable percentile for lower-is-better metrics

**Exact files and evidence**

- `web/components/PlayerStats/PlayerRadarChart.tsx:419–460`: the inverse branch counts `v < playerValue`, then uses that count both for ascending competition rank and the favorable percentile. The normal branch instead uses the count of worse values for its percentile.
- Same file `:1006`: inverse metrics explicitly say “lower is better”; `:1069–1080` labels high percentiles elite and low percentiles poor.
- Same file `:160–161`: GAA is explicitly inverted. The existing per-metric direction flags are out of scope for policy changes.
- `web/components/PlayerStats/PlayerRadarChart.test.tsx:85`: two existing tests cover exact skater/goalie query contracts; the `Radar` mock at line 28 currently discards chart data.
- `web/pages/stats/player/[playerId].tsx:349`: the chart is reachable on the player-detail page. No caller change is required for this arithmetic fix.
- `tasks/TASKS/wigo-charts/tasks-prd-wigo-charts-optimization.md:110`: NEW 7.0's completed query-schema fix stays closed.

**Reproduction, synthetic and deterministic**

Use a goalie row with GAA 2 and cohort `[2, 3, 4]`, with a nonempty game log and `selectedStats=["goals_against_avg"]`. The current expression gives rank **1 / 3** and favorable percentile **0%**. Repeat for GAA 4: rank **3 / 3**, percentile **67%**. This is already demonstrated by direct arithmetic in `radar-arithmetic-demonstration.json`; a component test has not yet been run.

**Established semantics and minimal fix**

The component's own comments and quality guide establish that a favorable percentile counts players the target is better than. Its normal branch currently uses **strictly worse count / cohort size**, with rounded display, and its ranks use **strictly better count + 1**. For the inverse branch, use `v > playerValue` for the favorable-percentile numerator while retaining `v < playerValue` for rank. Preserve the current denominator, rounding and competition-rank tie behavior. This produces 67%, 33%, 0% for the three values above. Do not introduce a new midrank convention, force the best value to 100%, or change the meaning of PIM/other direction flags in this fix.

**Acceptance**

Extend the adjacent test using mocked database rows and capture the `Radar` props if needed. Assert best/middle/worst inverse values, ties and a normal higher-is-better control; verify chart, displayed percentile, rank and quality direction agree. Existing exact query-contract assertions remain intact. From `web/`, start with `npm test -- components/PlayerStats/PlayerRadarChart.test.tsx`; then affected type/lint checks as warranted. No production reads or model/cohort rewrite.

## 2. FRESH-02 — one radar presentation mixes selected-log and current-season values

**Exact files and evidence**

- `web/pages/stats/player/[playerId].tsx:93,134–140`: page season and selected last-10/20/30 window exist. Lines `:921–995` resolve/load the selected historical season. At `:349–355`, the radar receives selected logs and playoff state but no season/scope contract.
- `web/components/PlayerStats/PlayerRadarChart.tsx:54–60`: props omit season and window identity. `:254` uses `useCurrentSeason()`; `:324–337` and `:380–399` filter player/cohort queries to that current season.
- Same file `:282,364`: `fetchPercentiles` receives calculated `playerValues`, but the comparison value is read from the current-season database player row instead.
- Same file `:512,586–587`: selected regular/playoff-log averages feed chart presentation. `:681–696` pairs that selected-log value with the database percentile in the same tooltip. `:1013–1019` can show the database player value in the breakdown instead.
- Same file `:890`: the ranking header can say “Playoffs,” although the queries do not change to a playoff cohort. The fetching effect at `:757–863` is based on regular `gameLog` and has no playoff selection dependency.
- Same file `:1055–1060`: a note explicitly says rankings use current-season data. **That disclosure exists; do not claim current-season use is entirely hidden.** It does not make the mixed tooltip/breakdown refer to one value/scope.

**Reproduction, synthetic and deterministic**

Reuse the existing test's mocked current season `20252026`. Return a player per-game points value of **2** and cohort `[1, 2, 3]`, giving **33%** by the current normal formula. Supply a historical selected log with two one-game rows containing 0 and 1 point, giving **0.50** selected points/game. Once queries resolve, the chart tooltip/legend can show **Value 0.50 / Percentile 33%**, while the breakdown shows **Value 2.00 / Percentile 33%** and query traces remain on `20252026`. Change the selected log/window and confirm that selected raw value changes while the current-player percentile does not. For the playoff case, supply a distinct playoff log and toggle `showPlayoffData`: the heading says Playoffs while the cohort remains unchanged.

The current `Radar` mock discards data/options. Capturing props allows the test to invoke the tooltip callback and compare it to the rendered breakdown without Chart.js canvas or a browser. This is a proposed regression reproduction; it was not executed in the read-only audit.

**Semantics already established versus approval choice**

Established: the player page supports selected seasons/windows/playoffs; the existing radar note describes current-season rankings; every displayed value/percentile/rank must name the scope it actually represents. No inspected requirement proves that full historical/playoff/window-specific empirical cohorts are already implemented or approved. Do not invent such a backend contract from the display bug.

**Recommended minimal policy for approval:** the radar follows the selected page scope. Pass the resolved season and explicit period/window identity at the existing call site. For a supported full regular season, bind the player value and cohort to that same season and use the same value throughout chart, tooltip, legend and breakdown. For a selected filtered/playoff scope lacking an equivalent supported cohort, retain the selected raw value and show percentile/rank unavailable with a reason; do not substitute a current-season percentile or generic estimate. No new table, RPC or historical materialization is required.

If Scout instead approves an intentionally independent current-season comparison panel, the smaller alternative is to use the same current-season player/cohort values everywhere and consistently label the panel with its actual season/period, removing misleading selected-playoff wording. That alternative is a product choice, not an established requirement. Approval should name which policy the implementer is to follow.

**Acceptance**

Extend the adjacent component test for historical selection, changed recent-game window and playoff toggle. Assert one explicit scope/value across tooltip, legend and breakdown; query season identity must match the approved contract. Unsupported scopes must have an honest final unavailable state, not an unrelated percentile or indefinite loading. Preserve the completed skater `player_id`/text `season`/`position_code` and goalie `goalie_id`/numeric `season_id` query contracts. No broad page redesign or new cohort model.

## Ownership and collision boundary

**Proposed exclusive implementation files:**

1. `web/components/PlayerStats/PlayerRadarChart.tsx`
2. `web/components/PlayerStats/PlayerRadarChart.test.tsx`
3. `web/pages/stats/player/[playerId].tsx` — only if the approved scope policy needs new props at the existing radar call site.

All three were clean and hash-identical to the completed audit during this recheck. FRESH-01 and FRESH-02 must share one owner or be applied sequentially, since both use the same component/test. The adjacent partial-fallback finding FRESH-03 remains separately tracked; do not silently expand this request to fix it beyond behavior necessary for an explicitly approved unsupported-scope state.

The currently dirty paths matching the public-usability worker's stated scope are separate:

- `web/pages/stats/index.tsx`
- `web/__tests__/pages/stats/index.test.tsx`
- `web/components/StatsPage/MobileTabInterface.tsx`
- `web/lib/NHL/statsPageFetch.ts`
- `web/lib/NHL/statsPageFetch.test.ts`
- `web/lib/NHL/statsPageTypes.ts`
- `web/pages/lines/index.tsx`
- `web/components/underlying-stats/UnderlyingStatsDashboard.module.scss`

**No direct file collision is currently evident.** The radar imports its own `PlayerStats/types.ts` and stylesheet, not the landing page's `statsPageTypes` contract. Keep those public-usability paths and shared Supabase/current-season helpers out of the radar patch. If the implementer proposes changing shared formatting, helpers, styles or landing-page data contracts, coordinate that exact additional file first. Repository-wide type-checks can include both workers' changes, so record the actual candidate state and coordinate one combined check rather than using one worker's pass as acceptance of the other.

**Current source pins**

| Path | SHA-256 |
| --- | --- |
| `web/components/PlayerStats/PlayerRadarChart.tsx` | `bc20900709ff07447f6078dcf0fda7de7b62b18a5f365cc1136f429baa1a2954` |
| `web/components/PlayerStats/PlayerRadarChart.test.tsx` | `c4e267f530e2635ed8276c11ea6410fcc48267b4a6d404eed13a23d69278780f` |
| `web/pages/stats/player/[playerId].tsx` | `255097f6289c49bc6e111bd0ba6c5705d29c21be8bdd57dcbe7d8321252d79f6` |

Both handoffs stay under the existing stats/trust owner and the unchanged native master block `ff353747-248c-4110-a37a-412d96678900` (historical `MS41-071`), with `MS41-057` provenance context. Implementation and later release approval remain separate. This handoff is ready for Scout's approval request.
