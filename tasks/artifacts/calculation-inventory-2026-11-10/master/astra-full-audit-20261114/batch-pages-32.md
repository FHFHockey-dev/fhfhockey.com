# Underlying player and team explorers — frozen source audit

Target `89da739cb45d7d572ed59bfa0b209c79c5d99299`. Full reads of player detail (1,090 lines), player landing (1,644), and team explorer (737): 3,471 lines and 514 unique inventory rows. `pages32-probe.cjs` passed once; retained output records exact-source expressions and finite asynchronous setter doubles. No React, browser, storage, service, database or provider execution; supplied Vitest tests not run.

## AFULL-ULSTABLE1-01 — P1: failed scope change exposes the previous scope's rows

- **Location/claim:** `web/pages/underlying-stats/playerStats/[playerId].tsx:314–463`; `web/pages/underlying-stats/playerStats/index.tsx:437–490,780–870`. Rows must remain attributable to their player, strength and filter scope after a failed request.
- **Evidence/scenario:** exact state expressions with player 1's retained rows, a player 2 selection and a failed new request return `tableState = null`, admitting the old table. Changing landing strength has the same result. The cross-scope guard hides rows while loading, but stops applying after failure. A generic warning does say “Showing last successful result”; it does not identify the retained scope, and the new filter/split props remain active.
- **Fix/readers:** bind displayed payloads to their request identity after both success and failure; hide incompatible retained rows or retain their complete old labels explicitly. Affects shared player/goalie landing and detail tables. The team explorer clears failed data and does not share this defect. No hosted failure asserted.

## AFULL-ULSTABLE1-02 — P1: an old Load more response replaces a new selection

- **Location/claim:** player landing `handleLoadMore`, lines 495–577. An asynchronous response must still belong to the active query before mutating its results.
- **Evidence/scenario:** exact handler starts page 2 with 100 old-scope rows; the fixture changes current state to a new scope containing row 99; resolving the old request replaces that state with 200 old-scope rows. The local abort controller is not registered with selection cleanup and no generation/query guard rejects the late result. Filters remain enabled during this request.
- **Fix/readers:** register cancellation and require the current query/generation at response admission. Keep same-scope merging and deduplication. Affects player and goalie landing filters and pagination; finite promise reproduction, not browser timing evidence.

## AFULL-ULSTABLE1-03 — P1: Load more admits an expired cached page

- **Location/claim:** player landing lines 525–547. Its five-minute cache policy must apply to additional pages as well as the first page.
- **Evidence/scenario:** exact handler accepts cached page 2 with `isFresh: false`, appends its old row and makes zero fresh fetches. The cache helper reports freshness correctly; this caller checks only the page number. Updated current-season rows can therefore be merged with an obsolete additional page.
- **Fix/readers:** enforce cache freshness and revalidate under the active query generation. This is separate from late-response replacement. Affects both player and goalie pagination; historical immutable data need not differ, and no production cache contents were inspected.

## Inherited producer findings and controls

Player detail and landing consume the previously reviewed underlying query/aggregation paths, retaining `AFULL-ULAND1-01` through `08`: OT clock, unknown geometry, PS/SO fallback shots, penalty duration class, partial numerator/full time, display-mode cache identity, revision admission and missing summary reporting. They are source-linked here, not independently re-proven with hosted data. Expanded charts receive the selected family, team split and metric context; prior shared-chart findings continue to apply.

The team explorer retains upstream `AFULL-TEAMQ1-01/02` and `AFULL-TEAMSUM1-01` through `04`: paired-source overlay and rank selection, PP expiry clock, null official score, deciding-period classification and incomplete partition publication. Its own error/loading/invalid-filter branches hide old rows. House chance definitions are labelled, and retired xG is hidden in this table; this pass does not claim it serves champion xG.

Exact controls confirm cross-player/strength changes are not view-only, sort/page changes are view-only, cross-scope rows are hidden while loading, an empty failed request displays an error, merges deduplicate row keys, and a 100-row chunk with 123 total requests only 23 next rows. Season/ID labels and canonical team query ordering were checked. The 100-row Load more action is explicit, not an automatic full-data crawl. Detailed QA diagnostics in the team explorer are development-gated. Hashes, full-read bounds and source-offset identities are retained in the manifest; local probes establish these cases only, not production prevalence or release readiness.
