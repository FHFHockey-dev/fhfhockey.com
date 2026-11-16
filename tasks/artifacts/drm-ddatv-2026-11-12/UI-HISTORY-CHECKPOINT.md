# DRM local UI and history checkpoint

2026-11-12; canonical `octoberBranch`, HEAD at final source-pin check `cd0d4670de40ffb3d245663e88116f27c4f50674`. This is an implemented local checkpoint, not completion of the DRM goal or release acceptance.

## Implemented and verified

- Calendar presets now mean inclusive last 7/14/30 Eastern calendar days. Season-to-date stops at today or the selected historical season's end; early/future seasons and DST are covered. Opponent/venue filters narrow the same dates. Custom dates and asynchronous scope changes retain their guards.
- Total TOI ordering uses cumulative seconds, with deterministic player-ID ties. A high-ATOI substitute no longer outranks a player with more total minutes.
- Custom line cards use the matrix's accepted game/player scope. The present all-strength inferred groups carry an explicit caveat; they are not relabeled as observed 5v5 units.
- New read-only history route and on-demand DRM panel: verified game-linked reports default to game date, publication shown alongside; practice and uncertain/unlinked reports have publication-date sections and a publication-only switch. Uncertain links never acquire a game date. Date/team changes cancel and discard old responses.
- Three independent retained stores/views are intentionally explicit: audited game claims, legacy report versions, and additional claim interpretations browsed by publication date. No provider/live-game service is invoked by the route. Source URLs require consistent original attribution; DTOs exclude private raw payload, identity/review evidence and relay provenance. All retained versions remain visible; their current active/corrected status is not asserted.
- Canonical publication browsing checks at most 50 candidate records per page using exact existing index prefixes, with one lookahead record and at most one next-game discovery read. Scanned progress, empty matched pages, pagination, unavailable/disabled states and unverified coverage remain visible. It may require many manual pages. See `HISTORY-BACKEND.md` for the exact contract and limitations.

## Evidence

- Existing page tests: **25 passed** after integration. Matrix ordering/keyboard tests: **7 passed**. Scoped card tests: **7 passed**.
- New history component: **5 passed**. Backend/route tests: **42 passed**; independent source review found no remaining concrete cursor/projection issue after fixing practice routing and attribution checks.
- Chromium: four final cold-start scenarios passed (accepted-row math/order/Custom cards/keyboard, calendar/filter/layout controls, partial/error/empty states, 390px mobile). The fifth history scenario passed on a corrected targeted rerun; the initial failure was an ambiguous text locator. Final history scenario includes all three streams, game/publication separation, visible uncertain links, publication-mode switch and scope reset.
- Browser fixture exercises actual DRM page/readers/reducer/matrix against synthetic local database rows. History browser checks use intercepted API DTOs; backend tests exercise source rows independently. External browser requests are blocked. These checks are not live NHL-data or production-load acceptance.
- Whole-web TypeScript passed after the history backend/UI additions. Scoped application/history lint passed; the native image used to replace Next Image in the isolated fixture has one expected lint warning. No application build ran.
- Two captured public VGK report versions passed the real reader offline (2 accepted, 0 skipped, 2 source links) after converting three top-level SQL timestamp fields to PostgREST ISO format in memory. Unmodified SQL transport formatting was rejected. No source facts or payload clocks changed. The two rows refer to one original post; they do not prove unique-source count or broad coverage.

## Current data findings

`archive_schema_recovered.json` verifies private RLS/grants and valid existing indexes. `archive_coverage_sample.json` covers only VGK November 4–10: 19 retained report versions, 3 original-clock/link records representing 2 distinct stored URLs, and no immutable claims for its two games. No sample cap was reached. This does not establish absent tweets, complete capture, corrected history, or original-link reachability. A second zero-active/zero-lock guard preceded the two-record capture. All database activity in this chat was bounded and read-only; no provider ingestion, production application requests, data writes, schedules, builds or deployments were triggered.

## Source-owner completion received

The user's forwarded completion and updated `../drm-pipeline-triage-2026-11-12/MATH-AUDIT.md` supersede this audit's earlier clock-failure status. All **21 candidate file hashes match**. Reused evidence: five reconciled source games, 190 players, 760 exact official clocks, 3,420 directed pair checks and all ten team clocks qualified. Two games require the retained official-report source replacements; the original snapshots remain intact. This chat did not repeat those successful checks. Production release/repair remains undone. Exact path ownership transfer was requested because the completion receipt does not explicitly release ownership.

## Required next work

1. After ownership transfer, integrate the qualified source contract and explicit expected-game/roster/version coverage into DRM. Entirely absent games and stale generations must not look complete.
2. Replace synthetic pairwise line assignment with observed simultaneous 5v5 units: one primary unit per player, alternatives separately; other ES time separate. Existing pooled-player-second caches and their completeness flags are not yet admitted as qualified facts.
3. Add all/ES/PP/PK matrix measures and distinct ES lines/PP units without mixed denominators. The clock repair alone does not provide this DRM UI/data contract.
4. Compare reported history against observed units without claiming a projected or practice report proves shared ice time. Coverage/correction completeness and large historical ranges still need qualification.
5. Assemble a reviewable candidate and source-aware historical repair plan. No commit/push/release/backfill is authorized or claimed here.

## Local reproduction

From `web/`:

```sh
npm test -- __tests__/pages/drm.test.tsx components/DateRangeMatrix/index.accessibility.test.tsx components/DateRangeMatrix/LinePairGrid.test.tsx components/DateRangeMatrix/LineHistory.test.tsx lib/sources/lineHistory.test.ts __tests__/pages/api/v1/lines/history.test.ts
npx playwright test -c e2e/drm-previews.config.ts
```

The Playwright command starts/stops the isolated local fixture server on port3114. It does not contact Supabase, NHL or Vercel. For manual synthetic matrix inspection, run `node e2e/fixtures/drm-previews/server.mjs`; history responses are supplied only by the automated browser tests, so manual fixture history requests return unavailable. The normal application uses the new read-only history route only after a Load button is pressed.
