# Social comparison and streaming calculations

Frozen `89da739cb45d7d572ed59bfa0b209c79c5d99299`: six scoped paths, 2,021 lines fully read, 1,611 unique inventory rows. Manifest/TSV beside this file. Exact local probe and output: `social2-probe.cjs`, `social2-probe-output.json`. Supplied Vitest/DOM suites were read, not run. No production request, application edit or provider use.

## Findings

### AFULL-SOCIAL2-01 — P1 — combined peripheral rank averages unequal category support

- Location: `web/lib/socialShare/modules/teamStream.ts:189–201`, used by `teamStreamPicks:116–123`.
- Claim: the peripheral score is the mean percentile of L5 HIT, BLK, PIM and SOG, comparable among the edition's skaters.
- Evidence/scenario: exact extracted frozen `finishCandidates` and selection declarations. Two five-game skaters: A has totals HIT/BLK/SOG 10/10/10 and unknown PIM; B has 5/5/5 and PIM 50. A receives a numeric score 0.75 by averaging only three categories; B receives 0.3125 from four. A is selected first under Peripherals despite its unknown fourth category. `candidateOf:181–182` explicitly preserves missing PIM and supplied tests admit that case; the full-sample flag only checks games, not four-category support.
- Wrong: missing PIM is omitted from the composite denominator and peer pool without qualifying the comparable score. Raw PIM still prints unknown, which does not validate the composite rank.
- Suggested fix: require all four supported category values for the four-category composite, or define a separately labeled common-support comparison that applies consistently to everyone. Keep individual known-category rankings available.
- Readers: Team Stream card, rail previews and selection/alt text when focus is `peripherals`. No live selection observed.
- Test gap: existing tests assert unknown raw PIM and that returned scores sort descending; they do not independently establish four-category comparability.

### AFULL-SOCIAL2-02 — P2 — small negative delta prints negative zero

- Location: `web/lib/socialShare/modules/teamStream.ts:127` (`deltaText`).
- Claim: the displayed rounded percentage and its sign agree.
- Evidence/scenario: the exact declaration maps -0.001 (a -0.1% change) to `−0%`; its tone helper correctly treats the rounded value as flat. Source probe passed.
- Suggested fix: choose the sign after rounding and emit unsigned `0%` at zero.
- Readers: Team Stream delta text on card and in alt text. Label-only; no numeric ranking change.
- Test gap: the existing suite tests -8.4% but not values that round to zero.

## Traversal and retained controls

- `offNightEdge.ts` (353): uses the shared Week Score and quiet-night gate; full week includes scheduled/live/final regular-season games, rest of week uses future opportunity membership. Multiweek bounds, top-16 ties, trusted-source gating, newest-night trimming, ownership freshness/unknown state and ambiguity-safe identities inspected. Officially retained Yahoo injury overrides are conditional on recent play, demoted behind unflagged picks and disclosed to the editor. Form explicitly uses complete games, short samples are labeled, position medians and previous-game baseline define HOT; it is not forecast evidence. Historical windows explicitly use current picks/ownership. TTL cannot outlive schedule expiry.
- `playerVsPlayer.ts` (350), test (387): no consensus is inferred from hand-picked posts; URL/date/platform/rationale/limitations validated and disagreement retained when card claims are trimmed. The shipped candidate file is empty. No post URL was visited. Pair/window/basis/strength binding, different-sample total refusal, unknown bars, printed ties and one-to-one NST-date refusal inspected. Rates use covered games and paired strength-specific time; partial totals remain unknown. Exact two-game PP control gives 1 point / 360 seconds × 3600 = 10 per60, ties a one-game equal rate, while a missing component makes the total unknown. Settings mismatches refuse export; missing sources and older coverage gaps remain partial. Source-side finality/membership remains a loader contract, not proved by pure-helper tests.
- `shared/categoryCounts.test.ts` (257): independent 40-start worked total, pooled 89/110 save ratio, exact half-up precision, per-start vs per-goalie denominators, relief rules, paired unknown ratios, zero baseline, month ownership and directional game/week cells. The “equal better rates on different cell counts” test actually supplies identical cell counts, so that title overstates its oracle; other independent tie/rank controls remain. TGV's zero-baseline behavior is deliberately distinguished from Category Counts and was already recorded as a definition caveat.
- `teamStream.ts` (349), test (325): shares Off-Night schedule/pools and cuts to eight while retaining ties; deterministic picks, minimum-one-D rule, full/short and flagged ordering, per-category unknown-last behavior. Last-five and previous-five windows are complete-game windows, missing NST/PIM remains unknown, NST rates pool own-time and source counts, no zero-base relative delta. Role chips use newest regular-season game and line/PP evidence; missing optional sources do not erase known metrics. Browser-only team/focus/metric changes require no refetch. Real load bounds, stopped-read behavior and quiet-night parity are covered by source assertions, not executed backend evidence.

Context-only full source read of `teamStream.sources.ts` confirmed per-player/date NST history, role source kind, bounded exact-count reads and one timeout-specific NST retry; no query invoked or new scope credit. Missing-PIM reach is confirmed by the builder and its fixture, not assumed from an unbounded database read.

Probe passed, then a meaningful extension for negative-zero formatting also passed. Team Stream declarations are extracted from the exact frozen AST; synthetic candidate objects bypass upstream loading/admission. PvP uses the full frozen pure module with inert descriptor and denied unused source dependencies. No full runtime or UI acceptance is asserted.
