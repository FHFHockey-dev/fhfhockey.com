# Legacy Trends placeholder — frozen source audit

Target `89da739cb45d7d572ed59bfa0b209c79c5d99299`. Fully read `web/pages/trends/placeholder.tsx` (2,612 lines); 556 unique AST rows. The route is public and has no admin/development gate. Evidence: `pages27-probe.cjs`, its output JSON and the hash-bound manifest. This is local source evidence, not a production observation.

## AFULL-TRENDLEG1-01 — P1: missing CTPI is replaced by a different ranking formula

- **Location/claim:** placeholder:488–583,1570–1638,2087–2281. Rule4 requires matching reader definitions; unavailable approved CTPI must remain distinguishable from another metric.
- **Evidence/scenario:** exact `buildPowerBoard` and page memo, two teams with category percentiles70 and30 and an empty trusted CTPI response. It returns numeric overall70 and30 and renders them under the unconditional CTPI heading. This fallback is a renormalized35/35/15/15 percentile composite, not CTPI. The real team-ctpi API returns `teams:[]` when no rows meet its trusted-publication gate; the page discards coverage/warnings/version metadata. This makes the empty response path supported by the actual reader, not an invented failed request.
- **Partial control:** with teamBBB CTPI offense2 and teamAAA missing CTPI, descending offense compares AAA percentile70 to BBB z-score2. It ranks AAA first despite incompatible units. Overall/other component columns similarly merge unlike definitions. When no CTPI exists the memo returns before honoring the selected sort control.
- **Fix/readers:** withhold CTPI rankings for unavailable teams and expose source/version/coverage; if a fallback remains, give it an explicit separate metric and cohort. This route's table, rankings, hot/cold sidebar and component colors consume the result. Actual hosted publication coverage was not queried.

## AFULL-TRENDLEG1-02 — P1: mover signs reverse in the presentation

- **Location/claim:** placeholder:827–878,1346–1389; `components/TopMovers/TopMovers.tsx:45–71,82–108`. A displayed direction must match the signed change.
- **Evidence/scenario:** exact team-movers callback with AAA80→70 and BBB20→30 returns both teams in both five-row lists. The shared JSX renders AAA's −10 in Improved as `▲10.0%` and BBB's +10 in Degraded as `▼10.0%` by applying absolute value and column-specific arrows/colors. This requires only a small/partial cohort or fewer than five positive/negative movers; no malformed input is needed. Skater callback uses the same unfiltered sorting, and hot/cold lists likewise lack sign filters.
- **Fix/readers:** filter the correct sign before selecting each directional list; keep zero separate. Percentile differences are percentage points, and insufficient five-game support must be labelled rather than called a complete five-GP window. Reuse a signed mover contract in both chart cards and sidebar. Two-observation control yields10 and one observation yieldsnull, explicitly demonstrating the early-window limitation. No browser rendering was executed.

## AFULL-TRENDLEG1-03 — P2 dormant: nullable v2 special teams crashes the legacy memo

- **Location/claim:** placeholder:18,1595–1596,1834–1838; API `web/pages/api/v1/trends/team-ctpi.ts:41,58,184`. The actual served v2 type permits null component values, while this page asserts the old nonnullable `CtpiScore`.
- **Evidence/scenario:** a finite score80 with `specialTeams:null` throws a `toFixed` error in the exact page memo. A known specialTeams1 control succeeds. The API explicitly preserves null via `finiteOrNull`; the page invokes `.toFixed(2)` unguarded.
- **Boundary:** the current writer emits candidate v2 and the predictive reader accepts only approved publication status. This probe does not establish a currently admitted null row or live crash. Classified dormant P2 while that gate is closed; do not relax it to test this finding.
- **Fix/readers:** adopt the nullable/versioned served contract and guard unknown formatting before any future admission. The legacy table and its CTPI merge are affected. Current tooltip formulas also describe v1 luck/trend semantics; update them with the actual version if v2 is admitted.

## Remaining checks and limits

Reviewed every helper/component/effect/JSX branch: sorted-GP dataset union leaves absent observations absent; round-to-two is display-only; trailing smoothing averages observed points, not a continuous five-game completeness proof. Sparkline range expansion and fixed geometry are graphical scaling, not calibrated intervals. Sparse delta fallback can span fewer or more than five GPs. Weighted fallback and unknown-momentum wording are included in findings/limitations rather than presented as CTPI qualification. Team/skater fetches use abort+mounted guards; search debounce cancels the timer but not an already-running query. Charts connect gaps and thus do not establish continuous coverage.

SOS uses the shared headline adapter, mean opponent points% and its source-as-of explanation; unknown SOS stays absent, but the entire SOS merge is skipped for teams lacking CTPI. Sort sentinels can put unknowns first in ascending order. Page startup requests team-power, team-ctpi, team-sos and skater-power independently; search introduces bounded player queries. These costs belong in the eventual page budget. No network, actual Supabase import, environment values, provider call, React mount, browser, server or supplied suite ran.

The probe initially failed because its exported `result` shadowed the callback's injected `result` input. Renaming the probe export fixed the harness; the rerun passed. No source code was changed. Hash and AST identity checks passed.
