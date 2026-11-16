# Bounded audit: web page tests, batch 11

Target: `89da739cb45d7d572ed59bfa0b209c79c5d99299`. Worker `readfirst_lanes`, verified Astra/high. Chef owns canonical ledger, review and final finding classification.

## Outcome and boundary

All eight assigned files were read top to bottom in path order: **3,136 lines**. No assigned sections remain unread. Each file byte-matches target and checkout. The companion TSV inventories **315 function-like definitions, including 67 test declarations, plus 15 top-level fixtures/constants = 330 rows**. Parameterized tests count once per declaration. No exact normalized duplicate test bodies were found.

**No new confirmed defect.** Concrete arithmetic, null handling, time/identity scope and presentation guards are documented below. A weak or missing assertion is a coverage limitation, not an implementation finding.

The TSV verdict `audited` means test/helper source reviewed, not test passed or whole implementation verified. No runtime test, application import, browser, server, HTTP/provider/database call, model training or production action occurred. Only pinned text reads, a local TypeScript AST inventory and artifact checks were executed. No application/test edits or canonical ledger changes.

## Pin and full-read manifest

Paths below begin `web/__tests__/`. Read ranges are 1 through the listed final line. Private target copies are numbered under `/tmp/astra-web-tests-11/` to distinguish the two index files.

| File | Lines | Bytes | Target SHA-256 | Functions / test declarations |
|---|---:|---:|---|---:|
| `pages/db/index.test.tsx` | 71 | 3119 | `25a19df348214aa1b77eef69f9f858c04c214e30d54b73ee8a07652ce4352015` | 25 / 1 |
| `pages/drm.test.tsx` | 1031 | 38127 | `0c20c843c9c04cfc651af4be01a1b95b3760e2e495f8b0bdc579695b3c0b5d9c` | 119 / 24 |
| `pages/fantasy-projections.test.tsx` | 583 | 21258 | `49aad1624db76851c0c63fe1267297b8d6fedbf1023ef556df7e0c25bb3e63de` | 36 / 8 |
| `pages/forge/player/[playerId].test.tsx` | 1071 | 32362 | `4a8ebecc68f01ef4ada2072554203b86cec109888ec2d5a5b851e995b0b9cb91` | 51 / 14 |
| `pages/game/poissonChartUnserved.test.ts` | 16 | 606 | `e71c10f4742a7b2eb4ce8d53fbea283866533c40f0a924a35e5d9dd75c57e604` | 2 / 1 |
| `pages/homepage-loading.test.ts` | 86 | 5110 | `3fce1ea1808a1e68cbf64f33a9f56fc348720eb1f36ab320eb11fe44ca397237` | 38 / 6 |
| `pages/lines/abbreviation-header.test.tsx` | 129 | 4421 | `518c5af24e1e6307c53292e61ffaf40a65313c002581959c06bf0867da8ef367` | 16 / 7 |
| `pages/lines/index.test.tsx` | 149 | 6683 | `64ae45635ea5f5b452ed482b63e6f991bbf66f6963fd1d79001960e236d69633` | 28 / 6 |

## Contract and oracle review

Previously read governing records/lane decisions were reused. Relevant contracts include: unknown remains unknown; calendar and source scopes remain explicit; only the latest selected request may own current UI data; scoring uses role-appropriate units and declared weights; deployment claims require qualified evidence; source timestamps differ from render times. Named local decision anchors are rule19 stored game state/fallback, decision44 unserved Poisson chart, decision107 legacy Lines grouping, decision118 FHFH add points, decision122 population-prior newcomer, decision123 projected ice-time order/withheld PP/PK units, decision132 confirmed-out opportunity, and decision137 observed5v5 Lines.

### pages/db/index.test.tsx — 1–71

Real DB admin page; auth/router/season/Supabase/cron runner/notifications are mocked. The sole test45–70 freezes April3 03:30Z and returns four game rows regardless of query predicates: LIVE recent game, stored FINAL, postponed FUT/PPD, and an older unknown-state game. The rendered update control must say **2 games between April1 and March31**, excluding LIVE and postponed while including stored FINAL plus the rule19 labelled start+8h fallback candidate.

This is an aggregate count/date-text oracle, not a row-by-row identity assertion. Its title “games the stored state calls final” is narrower than the fixture: one admitted game has null state and uses fallback. The test does not assert the fallback label, exact cutoff equality, stale-state behavior, query filters, authorization, clicking the update control or any write. Fake chain `eq/lte/order/returns` are no-ops, and head/non-game queries return zero counts. It would catch blanket inclusion of all four started dates, but not every possible wrong two-row selection.

### pages/drm.test.tsx — 1–1031

**Helper/mock boundary, 1–311.** Real page/date sanitizers and React state transitions; data hook, deployment fetcher, line/pair grids, observed units, coverage UI, datepicker and season readers are mocked. The URL hook is a stateful substitute supporting setter/popstate, not real Next router history. Datepicker is a local date-input substitute, so portal/CSS assertions are prop checks, not actual calendar behavior. `aggregateResponse:270–290` duplicates one fabricated player across all strengths, deduplicates scope IDs and supplies empty card stats; `deferred:260–268` controls completion order. Real unit selection, time aggregation, card statistics and coverage rendering are not exercised.

- **320–345:** inclusive Eastern L7/L14/L30 dates cross spring/fall DST and leap day with fixed expected dates. October2 early season clamps L7 and season-to-date to October1–2 and allows fewer than seven observed games. This distinguishes calendar days from N games and avoids fixed-millisecond DST drift.
- **347–365:** date-only/local/ISO-midnight keys round-trip March10; accepted total-TOI mode and adjacent-year season20242025 remain, invalid mode defaults, malformed/nonadjacent season IDs reject.
- **367–519:** historical custom raw-QA scope restores team/season/playoffs/dates without current-season lookup or aggregate fetch. Switching raw/aggregated retains bounded scope, hydration does not clear pending custom dates, and historical totals use October4–April17 bounds with team22/season20242025.
- **521–555:** malformed team/opponent/season/type/timeframe/source/home-away/dates canonicalize before team-scoped reads. Deployment fetch is not called. These are URL/control semantics, not database admission.
- **557–630:** heading/group/control labels, pressed states, input IDs/names and nonempty CSS/portal props are asserted. Mode/home/playoff clicks update state. No real-browser layout, focus, keyboard calendar or accessibility audit is established.
- **632–691:** explicit deferred requests make a newer TOR response win over late EDM; newer L14 wins over late L7. The calendar windows are independently pinned to April2–15 versus April9–15. These are substantive race regressions that would catch stale result overwrite.
- **693–736:** repeated active L7 is a no-op; not-yet-started playoff scope is empty/no fetch. Team/venue/opponent changes narrow the same April9–15 window rather than choosing different game IDs; duplicate matched fixture IDs do not redefine the calendar scope.
- **738–789:** on the first changed-filter render the old grid disappears and “Updating” appears until the new scope arrives; its key changes to home. Canonical line/pair arrays from the hook are forwarded verbatim. The mocked grid reveals props only, not actual cards.
- **791–807:** PP selection reuses the same response: all-strength player97 switches to PP player29 with the exact120-second PP unit and no refetch. This checks selection/propagation, not whether that120 seconds was qualified correctly.
- **809–833:** input3/roster1/skipped2 is partial, retains usable player97 and propagates coverage. The mock hook does not render the real coverage UI, so visual coverage disclosure remains outside the test.
- **835–868:** while a new historical season lookup is pending, old dates cannot trigger aggregate work; a newer20232024 result owns April12–18 and the late20242025 response causes no extra fetch.
- **870–964:** exact custom February1–10 persists through team/venue/opponent changes and grid scope keys; switching season type resets to actual playoff April16–June24 bounds and L7 recalculates June18–24, ignoring deliberately bogus1999 playoff fields in setup.
- **966–1029:** missing/reversed custom dates fail closed with precise error/alert and no new fetch/grid; a late preset response cannot replace manual custom dates or its player97 aggregate.

These 24 declarations test request ownership and scope integrity, with fixed dates and competing payload IDs. They do not independently validate lineup math, total TOI, final-game eligibility, provider completeness or production UI responsiveness. No dropped/reordered error response beyond the specified fixtures is claimed covered.

### pages/fantasy-projections.test.tsx — 1–583

Real page/scoring/settings/detail rendering with global fetch replaced by route-shaped synthetic responses. Auth is unauthenticated; storage is local/session test storage and cleaned afterward. The release fixture has fake hashes/healthy/beta flags; `player:76–117` sets model/published/p10/p50/p90 to the same supplied values. Those fields do not establish real release acceptance, uncertainty calibration or artifact provenance.

- **133–169:** session-only ESPN override GOALS5 × goals2 renders10.0 when there is no local preset. This catches failure to load exact session weights; it does not test browser-preset precedence because none is installed.
- **171–223:** role-specific weights yield skater2goals×2=4.0 and goalie3wins×10=30.0. Category mode changes the heading to Category score and renders the explicit composite title twice. It does not assert an independently computed category composite number.
- **225–270:** combined advanced columns use role-paired labels ixG/xGA, ixA/GSAx, iCF/HD SA and xGF%/HD SV%; row text contains shots attempts560 and goalieHD shots453. The percentages0.618/0.843 and other advanced values are fixture inputs, not individually asserted formatting/conversion or arithmetic.
- **272–367:** detail fetch supplies1200seconds total→20.0minutes with no literal1200 shown; model10→published12/+2, F1/F2 role probabilities70%/30%, old release team, fallback flag, provenance and NHL EDGE shot speed99.5 appear. Context is explicitly “not projected season totals.” This pins unit/display and disclosure; it does not establish that deployment odds or editorial changes are scientifically approved.
- **369–420:** team CF5701 and FF4141 display separately. This catches accidental reuse of unblocked attempts for total attempts; no underlying aggregation/calibration is checked.
- **421–492:** for both summary-v2 tuple and full payload, GOALS2 + missing TAKEAWAYS gives unknown FP, while GOALS1/TAKEAWAYS1→3.0 and GOALS3/TAKEAWAYS0→6.0 under weights2/1. Descending is high/low/unknown; ascending low/high/unknown. Category mode also retains unknown-last. This is a strong consumer regression against null→0 and reversed-sort unknown-first bugs. It does not test every tuple field or category-score formula.
- **494–529:** population_prior/prior_based_projection suppress bogus fixture F2 and60% role claims; row says Population prior/Role unknown, detail says heuristic and omits Rookie translation. Decision122 is checked at the presentation boundary, not producer pool admission.
- **531–582:** incoming forwardLines[1,2,3] display as “Projected ice-time order / Forwards1–3”; legacy payload PP/PK units are withheld, with explanation. No “Line1”, “PP1” or “PK1” claims. This verifies decision123 label/gate despite populated old payload fields; no actual projected TOI sorting is recomputed by this test.

### pages/forge/player/[playerId].test.tsx — 1–1071

Real detail page, client adapter/cache and exported SSR function; router, schedule hooks, season lookup and fetch responses are mocked. `scheduleResult:51–64` supplies one game, `currentWeekScheduleResult:66–89` supplies two team games on four-game league nights, and structured source/canonical team identities are synthetic. Each test clears client cache; mocked schedules do not establish provider finality/completeness or real route data freshness. No provider is contacted.

- **134–169:** exact default FHFH arithmetic is independent of ownership and uncertainty shape:3×.3+2×.4+.2+.2×2.5+.2×1+.25×.5=2.725, rendered2.7 with “per game ×1”. Null ownership and object uncertainty cannot suppress or alter it. This verifies rounding/weights for one complete skater line.
- **171–201:** confirmed_out yields0.0 tonight while conditional stat line remains “If he plays · scratched / not expected to dress”. This distinguishes true zero opportunity from missing numeric data.
- **203–311:** projection/ownership5D+5.0points, source identity, schedule-season label and exact Dashboard/Start Chart/team/Quick Read/Trends links preserve requested date/mode and encoded return path. It supplies no goals/assists, so it does not independently assert a complete FP total.
- **331–411:** parameterized Arizona2023–24, Hockey Club2024–25 and Mammoth2025–26 preserve historical display names/opponent while routing schedule through canonicalUTA/68 with the exact requested season/date.
- **414–479:** fallback projection source is validated against its resolved20232024 season while requested schedule stays20242025. The test checks display/routing, not that a year-old forecast is otherwise fit to recommend.
- **481–618:** wrong-era source or mismatched canonical identity preserves player text but disables team link/schedule identity. It does not assert every score is withheld, only those route/schedule effects.
- **620–738:** requested dateMarch14 controls schedule, not resolvedMarch13 or projectionMarch12. Ownership500 failures leave projection visible with explicit fallback-date and unavailable-ownership messages. This avoids unrelated dependency failure hiding useful context; fixture availability is not live freshness.
- **740–797:** week mode requests horizon5 and displays2G/2off from the schedule fixture. Despite the test title, it asserts no numerical weekly add score or multiplication. Do not cite it as proof that5 distinct games or weekly totals are correct.
- **799–897:** while route changes to next week and schedule hook still returns old rows/loadingtrue, old2G/2off label disappears; new1G/1off replaces it after loadingfalse. Both Monday anchorsMarch9/March16 are checked. This pins a UI stale-scope guard, not actual hook fetch ordering.
- **899–1004:** historical Arizona team53 drives one Friday/off-night in weekly context while canonicalUTA/68 routes the separate team-schedule hook. Again the oracle is labels, source identity and dates, not a numeric add total.
- **1006–1070:** SSR resolves persisted season from exact requested date, ignoring resolvedDate. Lookup failure returns scheduleSeasonIdnull, logs only stable warning text, and consumer passes explicit “unavailable” rather than undefined/current-season default. An unresolved fetch promise in the final test isolates this state.

These assertions distinguish unknown ownership, true confirmed-out zero and independent schedule identity. They do not prove current serving qualification, all availability probabilities, source arithmetic inside the API, weekly numerical score calibration or real browser interaction.

### pages/game/poissonChartUnserved.test.ts — 1–16

Decision44 lexical guard reads `pages/game/[gameId].tsx` relative to owning web cwd and rejects direct JSX `<PoissonDistributionChart` and direct `createElement(PoissonDistributionChart`. It neither imports nor renders the page, evaluates chart math nor follows aliases/dynamic/wrapper consumers. A pass would detect these two direct reintroductions only. This audit read the test text, not the referenced game page; that implementation path remains pending.

### pages/homepage-loading.test.ts — 1–86

Real homepage SSR function with all data services, enrichment, Supabase and fetch mocked. Mock game enrichment is identity; no advanced numeric calculation is exercised. Fake clock and provider bodies are deterministic.

- **36–41:** one direct season lookup, no fetch URL containing `/api/v1/season`, player count10/non-offseason/next dateNovember10. The title “no server-to-self requests” is broader than the predicate: other self-route URLs are not forbidden by it.
- **42–49:** unresolved injuries must not prevent two news calls and one pulse call; only after observing those starts is injuries resolved. This is a real async-orchestration oracle against serial blocking, not a wall-clock performance measurement.
- **50–57:** failure of general news preserves independently returned injury item and empty latestNews.
- **58–70:**45 future games ×4096unused bytes are excluded in regular-season SSR; today's game remains, weekly list empty, bracket not called, serialized props<128KiB.
- **71–84:** a playoff bracket allows weekly schedule with scheduleDate, absent bracket removes it. The playoff clock is May2027 while mock schedule remains November2026; these two tests establish conditional inclusion only, not correct-date selection or current playoff data.

No actual browser/server/provider latency, rendered homepage, source-data completeness, or bracket math is verified.

### pages/lines/abbreviation-header.test.tsx — 1–129

Header/share helper and static-props functions are real; only getTeams/getLineCombinations are replaced via partial module mocks. Because partial mocks import originals if executed, test execution safety would require further import review; no imports were executed in this source-only batch.

- **24–41:** Save image is a button and clicks callback once, with team heading. No image generation, download, dimensions, clipping or screenshot is tested.
- **43–82:** observed5v5 source says most-used units/one slot per player and omits legacy; default source explicitly says all-strength legacy; null lastUpdated removes Updated rather than inventing a date. The label does not prove upstream player uniqueness or strength isolation.
- **88–108:** specific “Cannot find at least2games” exception yields null line data/no loadError/revalidate60; database timeout propagates. This proves exception classification, not actual zero-game count or live ISR preservation. One observed game also satisfies “fewer than2”, despite the title saying “no game data”.
- **112–128:** forward board units300/200/100seconds map to L1/L2/L3; empty L4 getsnull. Legacy missing unit-seconds gives fournulls, not0. Defense seconds are supplied but not asserted. This pins index-to-seconds mapping, not how those seconds/units were calculated.

### pages/lines/index.test.tsx — 1–149

Real Lines page/static props; teams/current season/line-change reader/news/database/images/TimeAgo mocked. TimeAgo returns fixed “1h ago”, so only underlying datetime is meaningful.

- **32–42:** page timestamp is plain “Page refreshed” with exact datetime; no Updated claim or timestamp link, and two empty movement sections. It would catch presenting render time as a source observation.
- **44–50:** team navigation link points to /lines/EDM. The title promises no unscoped projected-lineup request, but there is no fetch spy or direct absence assertion for that behavior.
- **52–73:** two movement rows are each one player link; null→L1 is New, L4→null is out of lineup, with observed5v5 wording. This is display normalization, not computed promotion classification.
- **75–85:** fake-clock static props carry pageRefreshedAt, no lastUpdated, and revalidate60. This verifies generated payload semantics only.
- **87–115:** per-team source metadata survives static props and renders two5v5/twoLegacy labels; legacy explanatory text is present. Given sources are mocks, not verified actual reader provenance.
- **117–148:** one primary batched call for[10,22,68] plus one historical fallback[59],season20242025; missing EDM is skipped and Utah fallback source/identity retained. The title “one batched call” means one primary call, with explicitly asserted second fallback call. This does not verify underlying RPC/query count, data aggregation or why EDM was absent.

## Integration limits and verification

No implementation source paths were additionally read or promoted to whole-path audited. Imported page/components/readers, actual chart service state, generated images, ISR retention and all hosted behavior remain pending their own source/runtime audit. Numeric assertions are identified above; fixture metadata and labels are not qualification receipts.

The companion TSV gives each reviewed function, method and callback its own row and exact line range, with local assertions/helper semantics and “not executed” evidence. Top-level fixtures/constants are separate rows. AST enumeration checked coverage after full source reading; it did not substitute for review.

Commands/results: eight `git show 89da739cb:<path>` copies and byte/hash comparisons succeeded. An initial tool-wrapper JavaScript quoting error prevented one inventory orchestration call from executing; corrected quoting then ran `node /tmp/astra-web-tests-11/inventory.cjs` successfully (exit0), parsing TS/TSX with the local TypeScript library and standard libraries only. No application module was imported. Final schema/count/unique-symbol/whitespace checks are recorded in the diary after execution. Chef owns acceptance and canonical integration.
