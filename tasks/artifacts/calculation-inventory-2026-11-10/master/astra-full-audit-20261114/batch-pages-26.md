# Trends dashboard page audit

All1,914 lines of `web/pages/trends/index.tsx` read at frozen `89da739cb45d7d572ed59bfa0b209c79c5d99299`. `pages26-probe.cjs` passed after a fixture brace correction, then passed with the real modeled-head source added and the compatibility fallback severity qualified. No live/API action or application edit.

## AFULL-TRENDSP1-01 — P1: missing forecast heads become displayed zero

- Location: `web/pages/trends/index.tsx:387–393,419–428,1778–1782`.
- Claim checked: unavailable projection heads must remain unknown through every numeric reader.
- Evidence: exact frozen modeled-head helper plus exact page memo. A supported legacy strength row with missing ES goals/shots and known PP0 yields points=null and shots=null; `/api/v1/forge/players.ts:419–431` passes those nullable totals through. The page converts both to0, ranks by the resulting numeric points and formats the cell as0.00. Known-zero control also becomes0.00.
- Minimal scenario: one named player with missing points/shot forecasts reaches the top-ten projection table; it displays0.00PTS and0.00SOG rather than unavailable. No actual published row or hosted occurrence was queried. The legacy alternate memo independently zero-fills missing shot/hit/block fields and unknown fallback points.
- Suggested fix: preserve nullable finite values in page types/adapters, use explicit unavailable cells and null-last/withheld sorting. Keep known0 distinct. Add the actual nullable source-to-page case to an existing reader test.
- Readers affected: `/trends` FORGE and legacy projection table; this does not alter source calculations or issued history.

## AFULL-TRENDSP1-02 — P2: latent fallback substitutes fantasy points for hockey points

- Location: `web/pages/trends/index.tsx:421–424,1760,1779`.
- Claim checked: PTS means hockey goals plus assists; fantasy points have a separate scoring scale.
- Evidence/scenario: exact legacy memo given G=null,A=1,FP=8 returns PTS8, while a known G2/A1 control correctly returns3. The displayed column is explicitly PTS and the description calls it projected points/shots.
- Reach boundary: the ordinary legacy Start Chart producer at `start-chart.ts:1610–1617,1658–1669` withholds FP unless its scoring line is complete. Consequently the8FP counterexample is a compatibility/admission risk, not proof that the canonical legacy producer currently emits that combination. Later admitted/native adaptation is a separate contract; no such emitted row was established in this batch. P2 reflects the latent fallback under this boundary, not a live numeric failure.
- Suggested fix: remove the cross-unit fallback and require both hockey operands for PTS. If fantasy points are useful, expose a separately named scoring column with its basis.
- Readers affected: legacy-source projection table and its points ordering. Do not count this as an additional proven live incidence of01.

## Complete source review

- Date parser checks real calendar dates and SSR defaults to Eastern today. Exact invalid2026Feb29/valid2024Feb29 controls pass. URL date changes update state. The loader's already recorded FORGE-W01 date omissions still affect historical team/skater context; this page does not repair the request scope.
- Search is bounded8suggestions/20results with a200ms debounce and keyboard navigation. Debounce cancellation does not cancel an already-running response; this is an identity-suggestion race limitation, not a new demonstrated wrong numeric row.
- Team/skater/goalie series merge by numeric GP and sort that axis. Exact two-team fixture keeps an absent first-game peer observation absent, rather than filling0. Up to8top-ranked series are drawn with linear segments; user focus changes emphasis only. The common GP axis is not a shared calendar date. Tooltip rounds percentile values and the axis states0–100; source percentile computation remains in its audited producer.
- Rank deltas remain distinct from percentile level; skater/goalie accessibility labels describe movement in spots. Top movers filter and sort positive/negative changes independently. Raw current-form values use their shared unit formatter with percentile below; no raw value is replaced with percentile when it is present. Existing PTR1-01/02 producer weighting/window limitations remain inherited.
- Missing whole sections distinguish loading, errors, retry and empty results. Last successful section timestamps/resolved scopes are disclosed on error. The corrected recency helper's warning is followed by stale downgrade wording in this page, preserving DASHLIB1-01. A mixed-date notice is not a numerical adjustment or fresh-data guarantee.
- FORGE/legacy row identity merges use player ID, ignoring game ID, and take top20then10. Multiple-game/window qualification remains the upstream contract; no new duplicate-game failure is asserted. The page retains some uncertainty but does not expose full participation/PK/model basis or run expiry. Its simplified display is not independent readiness, expected-participation or current-time proof.
- Goalie merge prefers Start Chart identity/start probability then FORGE probability, uses nullable win/shutout values, and converts fractions to percent only at display. Exact unknownWin/null versus known0SO/start controls remain distinct. Missing start probability sorts as0 but displays unavailable. Source dates/basis and conditional-vs-team win interpretation require the upstream contract; this batch does not establish calibrated goalie outcome probabilities.
- Workload-share chart mounts only after intersection (or when IntersectionObserver is unavailable). Scrolling can therefore trigger additional reads, which must be included in a live budget. Forecast/section retries and player search are extra actions, not free checks. The hook has epoch guards but no page-level automatic expiry removal/polling; retained data and visible refreshed labels require actual live verification.
- Server-side page props only normalize the requested date. Static links, logos, responsive table hiding and focused-line state do not rederive numbers. No screenshot, layout, API fanout or console behavior was observed live.

Exact pure probes cover nullable source/adapter behavior, legacy units, goalie unknown/zero, calendar validation, legend formatting and missing-series preservation. No actual database/provider/user settings/browser/server, supplied suites or later-Claude changes were executed.
