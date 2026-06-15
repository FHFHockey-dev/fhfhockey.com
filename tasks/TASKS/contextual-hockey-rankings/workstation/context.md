## Player Rankings Workstation Context

### Source of truth

- `tasks/TASKS/contextual-hockey-rankings/workstation/goal.md`
- Supporting research: `deep-research-report.md`, `Recommendations-DRR.md`
- Current implementation target: `web/pages/rankings.tsx`

### Current findings

- Existing rankings stack is substantial: skater matrix, goalie matrix, team matrix, deployment tiers, trending, splits, metric metadata, lower-is-better rank handling, composite writer, and focused tests already exist under `web/lib/rankings`, `web/components/Rankings`, and contextual rankings API routes.
- Existing migrations include `metric_definitions`, `skater_composite_ratings`, contextual methodology/version metadata, and composite peer context keys.
- Current gap was mostly product completion and workstation wiring: team/goalie views rendered as plain result sections, desktop frame could scroll too much, matrix scroll behavior needed to be contained, and goalie/team snapshot panels needed row selection parity with skaters.
- No values should be invented. Missing WAR/adjusted impact/call-up denominator pieces should stay as source-pending or planned states.

### Implementation plan

- Add team and goalie snapshot panels using existing API payloads.
- Reuse the skater workstation layout for skater, goalie, and team ranking tabs.
- Make selected goalie/team rows URL-addressable so shared links restore the right snapshot.
- Tighten CSS for one-screen desktop behavior, contained matrix scrolling, and responsive collapse.
- Add focused page tests for the new snapshot panels and run targeted rankings tests.

### Snags and risks

- Worktree has existing uncommitted rankings changes. Do not revert them.
- Full `npm run test:full` may be expensive; run targeted tests first and broaden if feasible.
- Supabase connector found project `fhfhockey.com` (`fyhftlxokyjtpndbkfse`), but table listing requires reauthentication. Rely on repo migrations/contracts and SQL/API tests until the connector is reauthenticated.
- Worktree also contains many unrelated task/document moves and existing edits outside rankings. Leave them untouched.

### Progress

- [x] Read goal, research docs, and task generation guide.
- [x] Inspected existing rankings page, components, APIs, migrations, and tests.
- [x] Patched workstation UI gaps: team and goalie tabs now use the same two-column workstation shell with live snapshot panels and explicit source-pending caveats.
- [x] Patched goalie/team row selection parity: clicking a goalie or team updates `selected_goalie` / `selected_team` query params and drives the right snapshot panel.
- [x] Patched focused page tests for goalie/team snapshot panels.
- [x] Added focused page tests for goalie/team selected-row URL restoration.
- [x] Added API-backed WAR source-pending contract and UI panel; no WAR values are fabricated.
- [x] Added explicit Source Pending states for goalie/team secondary tabs that do not yet have verified row contracts.
- [x] Updated contextual rankings metadata glossary so goalie/team matrix coverage is no longer described as gated and WAR source-pending status is discoverable.
- [x] Added workstation-level Legend & Methodology access for every rankings view, backed by the metadata endpoint/current active metric contract.
- [x] Tightened entity-aware filter semantics: renamed player type control to Entity, disabled goalie Role with Source Pending copy, kept goalie workload filters, and hid skater-only controls for team rankings.
- [x] Brought goalie/team matrix cells to the same display contract as skaters: explicit Sort Rank header plus separate percentile, raw rank, raw value, and Source Pending/No sample/Low sample/Raw context state chips.
- [x] Added `/api/v1/contextual-rankings/available-filters` and embedded the same entity-aware filter contract in metadata so skater/goalie/team availability, Source Pending options, page sizes, display modes, and archetype contracts are machine-readable.
- [x] Added `/api/v1/contextual-rankings/snapshot` so selected skater, goalie, and team rows can be resolved from cached matrix surfaces without raw-event aggregation; absent entities return `unavailable` rather than fabricated values.
- [x] Added snapshot metadata to `/api/v1/contextual-rankings/metadata`.
- [x] Wired selected snapshot API responses into the workstation right panels so explicit `selected_player`, `selected_goalie`, and `selected_team` shared links can restore off-page selections without fabricating values.
- [x] Added regression coverage that goalie/team Metric Explorer routes stay in the explicit Source Pending state and do not call the skater explorer API.
- [x] Added shareable search filter contract for skater, goalie, and team ranking matrices. Search filters cached/aggregated ranking rows before pagination and preserves full-peer rank/percentile semantics.
- [x] Added shareable matrix display mode control (`Both`, `Percentile`, `Raw Rank`) and wired it through skater, goalie, and team matrix cell rendering.
- [x] Added real goalie Team filtering from filter UI/URL through `/api/v1/contextual-rankings/goalies`. Numeric team IDs or exact team abbreviations/names resolve to team IDs before querying `goalie_stats_unified`, so goalie ranks/percentiles are calculated within the filtered cached surface rather than as a client-only cosmetic filter.
- [x] Added live goalie role/deployment buckets and filter contract. Goalie roles now derive from projected season start share when available, fall back to selected-window team start share, rank within the filtered cached surface, and expose clear source notes in table/snapshot UI. Emergency call-up denominator adjustment remains explicitly Source Pending.
- [x] Added distinct stale-source rendering for goalie and team metric cells using existing freshness metadata. Goalie cells now flag historical matrix snapshots, and team style-derived cells flag style-source snapshots that lag the team power snapshot; unavailable/source-pending cells keep their own state precedence.
- [x] Added `/api/v1/contextual-rankings/comparison`, a read-only comparison payload contract for skaters, goalies, and teams. It pages through existing cached matrix surfaces, returns per-subject available/unavailable states, and does not fabricate missing rows or run raw-event aggregation.
- [x] Updated contextual rankings metadata so the comparison contract is discoverable as `/api/v1/contextual-rankings/comparison`, with version, supported entities, subject params, max subject count, caveats, and the legacy skater list comparison endpoint preserved separately.
- [x] Added live goalie Really Bad Start Rate (`really_bad_start_rate` / `RBS%`) from existing `goalie_stats_unified` game rows through `goalieMethodology.isGoalieReallyBadStart`; no values are fabricated when xG rows are unavailable.
- [x] Updated goalie metric ranking so lower-is-better columns use the same dense-rank and user-friendly percentile semantics as the team matrix.
- [x] Wired `RBS%` through goalie filters, URL parsing, source-contract metadata, component fixtures, and focused tests.
- [x] Ran targeted rankings/component/lib tests.
- [x] Ran contextual rankings API/metadata tests.
- [x] Ran `npm run lint` and `npm run build`.
- [x] Ran browser smoke check against `http://localhost:3001/rankings`.
- [x] Ran `npm run test:full`; unrelated failures documented below.

### Verification

- `npm run test:full -- __tests__/pages/rankings.test.tsx components/Rankings/PlayerMatrixTable.test.tsx lib/rankings/playerMatrix.test.ts lib/rankings/goalieMatrix.test.ts lib/rankings/teamMatrix.test.ts lib/rankings/rankingCalculator.lowerIsBetter.test.ts lib/rankings/skaterCompositeWriter.test.ts` passed: 22 tests.
- `npm run test:full -- __tests__/pages/api/v1/contextual-rankings.test.ts __tests__/pages/api/v1/contextual-rankings-metadata.test.ts __tests__/pages/api/v1/contextual-rankings-trending.test.ts __tests__/pages/api/v1/contextual-rankings-splits.test.ts __tests__/pages/api/v1/rankings.test.ts lib/rankings/deploymentTiers.test.ts lib/rankings/trending.test.ts lib/rankings/splits.test.ts lib/rankings/metricDefinitions.test.ts lib/rankings/matrixMetricRegistry.test.ts` passed: 28 tests.
- `npm run test:full -- __tests__/pages/rankings.test.tsx` passed after selected goalie/team URL restoration tests were added: 4 tests.
- `npm run test:full -- lib/rankings/rankingUrlState.test.ts components/Rankings/PlayerMatrixTable.test.tsx lib/rankings/goalieMatrix.test.ts lib/rankings/teamMatrix.test.ts` passed after selected goalie/team URL state was added: 15 tests.
- `npm run test:full -- __tests__/pages/api/v1/contextual-rankings-war.test.ts __tests__/pages/api/v1/contextual-rankings-metadata.test.ts __tests__/pages/rankings.test.tsx lib/rankings/rankingUrlState.test.ts` passed after WAR/fallback tab wiring: 17 tests.
- `npm run test:full -- __tests__/pages/rankings.test.tsx __tests__/pages/api/v1/contextual-rankings-metadata.test.ts lib/rankings/rankingUrlState.test.ts` passed after Legend & Methodology panel wiring: 15 tests.
- `npm run lint` passed with existing warning noise, including `<img>` warnings consistent with existing snapshot components.
- `npm run build` passed after row-selection wiring.
- `npm run lint` passed after WAR/fallback tab wiring with existing warning noise.
- `npm run build` passed after WAR/fallback tab wiring; `/api/v1/contextual-rankings/war` is included in the Next route table.
- `npm run lint` passed after Legend & Methodology panel wiring with existing warning noise.
- `npm run build` passed after Legend & Methodology panel wiring.
- `npm run test:full -- components/Rankings/RankingsFilters.test.tsx __tests__/pages/rankings.test.tsx` passed after entity-aware filter semantics: 7 tests.
- `npm run build` passed after entity-aware filter semantics.
- `npm run test:full -- components/Rankings/GoalieTeamMatrixTable.test.tsx` passed after goalie/team metric-cell contract wiring: 2 tests.
- `npm run test:full -- components/Rankings/GoalieTeamMatrixTable.test.tsx components/Rankings/PlayerMatrixTable.test.tsx __tests__/pages/rankings.test.tsx` passed after goalie/team matrix contract wiring: 9 tests.
- `npm run build` passed after goalie/team matrix contract wiring.
- `npm run lint` passed after goalie/team matrix contract wiring with existing warning noise.
- Supabase changelog scan on 2026-06-13 found no relevant breaking-change item for the read-only Next API filter contract.
- `npm run test:full -- __tests__/pages/api/v1/contextual-rankings-available-filters.test.ts __tests__/pages/api/v1/contextual-rankings-metadata.test.ts lib/rankings/rankingMetadata.test.ts` passed after available-filters contract wiring: 6 tests.
- `npm run lint` passed after available-filters contract wiring with existing warning noise.
- `npm run build` passed after available-filters contract wiring; `/api/v1/contextual-rankings/available-filters` is included in the Next route table.
- Supabase changelog scan on 2026-06-13 found no relevant breaking-change item for the read-only Next API snapshot contract.
- `npm run test:full -- lib/rankings/snapshot.test.ts __tests__/pages/api/v1/contextual-rankings-snapshot.test.ts` passed after snapshot API wiring: 5 tests.
- `npm run test:full -- lib/rankings/snapshot.test.ts __tests__/pages/api/v1/contextual-rankings-snapshot.test.ts __tests__/pages/api/v1/contextual-rankings-metadata.test.ts __tests__/pages/api/v1/contextual-rankings-available-filters.test.ts lib/rankings/rankingMetadata.test.ts` passed after snapshot metadata wiring: 11 tests.
- `npm run build` passed after snapshot API wiring; `/api/v1/contextual-rankings/snapshot` is included in the Next route table.
- `npm run lint` must be run from `web/`; running it at the repo root fails because there is no root `package.json`.
- `npm run lint` from `web/` passed after snapshot API wiring with existing warning noise.
- `npm run test:full -- __tests__/pages/rankings.test.tsx` passed after non-skater Metric Explorer Source Pending regression coverage: 4 tests.
- `npm run lint` from `web/` passed after the Metric Explorer regression test with existing warning noise.
- Supabase changelog scan on 2026-06-13 found no relevant breaking-change item for the cached rankings search contract.
- `npm run test:full -- lib/rankings/playerMatrix.test.ts lib/rankings/goalieMatrix.test.ts lib/rankings/teamMatrix.test.ts lib/rankings/rankingUrlState.test.ts components/Rankings/RankingsFilters.test.tsx __tests__/pages/rankings.test.tsx __tests__/pages/api/v1/contextual-rankings-available-filters.test.ts` passed after search contract wiring: 28 tests.
- `npm run build` passed after search contract wiring.
- `npm run lint` from `web/` passed after search contract wiring with existing warning noise.
- `npm run test:full -- lib/rankings/rankingUrlState.test.ts components/Rankings/RankingsFilters.test.tsx components/Rankings/PlayerMatrixTable.test.tsx components/Rankings/GoalieTeamMatrixTable.test.tsx __tests__/pages/rankings.test.tsx` passed after display-mode wiring: 24 tests.
- `npm run build` passed after display-mode wiring.
- `npm run lint` from `web/` passed after display-mode wiring with existing warning noise.
- `npm run test:full -- lib/rankings/rankingUrlState.test.ts __tests__/pages/rankings.test.tsx components/Rankings/PlayerSnapshotPanel.test.tsx __tests__/pages/api/v1/contextual-rankings-snapshot.test.ts lib/rankings/snapshot.test.ts` passed after selected snapshot API UI wiring: 23 tests.
- `npm run build` passed after selected snapshot API UI wiring.
- `npm run lint` from `web/` passed after selected snapshot API UI wiring with existing warning noise.
- Supabase changelog scan on 2026-06-13 found the new-table Data API exposure breaking-change item; no new public table was added for goalie team filtering, so no RLS/Data API exposure change was needed.
- `npm run test:full -- lib/rankings/goalieMatrix.test.ts lib/rankings/rankingUrlState.test.ts components/Rankings/RankingsFilters.test.tsx` passed after goalie team-filter wiring: 17 tests.
- `npm run test:full -- __tests__/pages/rankings.test.tsx __tests__/pages/api/v1/contextual-rankings-snapshot.test.ts lib/rankings/snapshot.test.ts` passed after goalie team-filter wiring: 9 tests.
- `npm run lint` from `web/` passed after goalie team-filter wiring with existing warning noise.
- `npm run build` passed after goalie team-filter wiring.
- Browser smoke check after goalie team-filter wiring passed at `http://localhost:3000/rankings?entity=goalies&team=DAL`: goalie view loaded, Team input retained `DAL`, Role stayed disabled, goalie snapshot rendered, no browser console errors, and no document-level vertical scroll at 1280x720.
- Supabase changelog scan on 2026-06-13 found the new-table Data API exposure breaking-change item; no schema migration, public table, RLS, or Data API exposure change was needed for goalie role filtering.
- `npm run test:full -- lib/rankings/goalieMethodology.test.ts lib/rankings/goalieMatrix.test.ts lib/rankings/rankingUrlState.test.ts components/Rankings/RankingsFilters.test.tsx components/Rankings/GoalieTeamMatrixTable.test.tsx __tests__/pages/api/v1/contextual-rankings-available-filters.test.ts __tests__/pages/rankings.test.tsx lib/rankings/snapshot.test.ts __tests__/pages/api/v1/contextual-rankings-snapshot.test.ts` passed after goalie role/deployment wiring: 38 tests.
- `npm run lint` from `web/` passed after goalie role/deployment wiring with existing warning noise, including existing `<img>` warnings in `pages/rankings.tsx`.
- `npm run build` passed after goalie role/deployment wiring; `/rankings` generated successfully.
- Browser smoke check after goalie role/deployment wiring passed at `http://localhost:3000/rankings?entity=goalies&goalie_role=g1_workhorse`: role filter retained `g1_workhorse`, Role selector was enabled, G1 Workhorse option existed, goalie matrix/snapshot rendered, role methodology copy and Role column rendered, no browser console errors, and no document-level vertical scroll at 1280x720.
- `npm run test:full -- components/Rankings/GoalieTeamMatrixTable.test.tsx` passed after goalie/team stale-source state wiring: 4 tests.
- `npm run test:full -- components/Rankings/GoalieTeamMatrixTable.test.tsx __tests__/pages/rankings.test.tsx` passed after stale-source state wiring: 8 tests.
- `npm run lint` from `web/` passed after stale-source state wiring with existing warning noise.
- `npm run build` passed after stale-source state wiring; `/rankings` generated successfully.
- Supabase changelog scan on 2026-06-13 found the new-table Data API exposure breaking-change item; no schema migration, public table, RLS, or Data API exposure change was needed for the read-only comparison route.
- `npm run test:full -- lib/rankings/comparison.test.ts __tests__/pages/api/v1/contextual-rankings-comparison.test.ts` passed after comparison route wiring: 4 tests.
- `npm run build` passed after comparison route wiring; `/api/v1/contextual-rankings/comparison` is included in the Next route table.
- `npm run lint` from `web/` passed after comparison route wiring with existing warning noise.
- `npm run test:full -- __tests__/pages/api/v1/contextual-rankings-metadata.test.ts lib/rankings/rankingMetadata.test.ts lib/rankings/comparison.test.ts __tests__/pages/api/v1/contextual-rankings-comparison.test.ts` passed after comparison metadata wiring: 9 tests.
- Supabase changelog scan on 2026-06-13 found the new-table Data API exposure breaking-change item; no schema migration, public table, RLS, or Data API exposure change was needed for comparison metadata wiring.
- `npm run lint` from `web/` passed after comparison metadata wiring with existing warning noise.
- `npm run build` passed after comparison metadata wiring; `/api/v1/contextual-rankings/comparison` remains in the Next route table.
- Supabase changelog scan on 2026-06-13 found the new-table Data API exposure breaking-change item; no schema migration, public table, RLS, or Data API exposure change was needed for goalie RBS% wiring.
- `npm run test:full -- lib/rankings/goalieMethodology.test.ts lib/rankings/goalieMatrix.test.ts lib/rankings/rankingUrlState.test.ts components/Rankings/GoalieTeamMatrixTable.test.tsx __tests__/pages/api/v1/contextual-rankings-available-filters.test.ts __tests__/pages/rankings.test.tsx lib/rankings/rankingMetadata.test.ts __tests__/pages/api/v1/contextual-rankings-metadata.test.ts` passed after goalie RBS% wiring: 38 tests.
- `npm run lint` from `web/` passed after goalie RBS% wiring with existing warning noise, including existing `<img>` warnings in rankings surfaces.
- `npm run build` passed after goalie RBS% wiring; `/rankings` and `/api/v1/contextual-rankings/goalies` generated successfully.
- `npm run test:full` was run after goalie RBS% wiring. Rankings-related tests passed, but the full suite still fails on unrelated existing issues: Vitest collects `e2e/rankings.spec.ts` and rejects Playwright `test.describe`, and `__tests__/pages/api/v1/db/update-nst-gamelog.test.ts` has the existing NST URL encoding/order expectation failures.
- Browser smoke check passed at 1280x720: skater matrix populated, goalie/team tabs populated, new snapshot panels rendered, source-pending caveats rendered, no browser console errors, no document-level vertical scroll after the desktop CSS fix, and the matrix scrolls internally.
- Browser smoke check after row-selection wiring passed: clicking goalie rank 2 selected Dennis Hildeby and added `selected_goalie`; clicking team rank 2 selected MIN and added `selected_team`; reloading the selected team URL restored the MIN snapshot and selected row after data settled.
- Desktop viewport check at 1280x720 passed after selected team URL reload: no document-level vertical scroll and no browser console errors. A narrow 651px viewport uses expected responsive page scrolling.
- Browser smoke check after WAR/fallback tab wiring passed: `/rankings?tab=war` shows Source Pending, Replacement Baseline, and "No WAR values are exposed in API or UI"; `/rankings?entity=goalies&tab=trending` shows the Source Pending fallback instead of a blank tab; both have no browser console errors and no document-level vertical scroll at 1280x720.
- Browser smoke check after Legend & Methodology panel wiring passed at 1280x720: closed summary is visible, opened panel shows Ranking Legend, dense-rank semantics, lower-is-better percentile copy, and glossary text; no browser console errors, no document-level vertical scroll, and the matrix retains internal scroll.
- Browser smoke check after entity-aware filter semantics passed at 1280x720: `/rankings?entity=goalies` shows Goalies selected, disabled Role = All Goalie Roles, Min Starts/Min Shots and Team visible, no More Filters, no document-level vertical scroll, and no console errors; `/rankings?entity=teams` shows Teams selected, only Season/Window filters, team matrix visible, no More Filters, no document-level vertical scroll, and no console errors.
- `npm run test:full` failed on unrelated existing issues:
  - `e2e/rankings.spec.ts` is a Playwright test collected by Vitest and fails with `Playwright Test did not expect test.describe() to be called here`.
  - `__tests__/pages/api/v1/db/update-nst-gamelog.test.ts` has two URL contract expectation failures around unencoded date hyphens/query ordering. This is in NST gamelog code not touched by the rankings workstation patch.

## 2026-06-14 Aesthetic Workstation Pass

### Completed

- Removed visible `.resultsHeader` usage and deleted the dead stylesheet rules.
- Reworked the filters into a compact two-row workstation control block:
  - Entity segmented control and player/team search on the first row.
  - Season / Timeframe, Window, Display, Deployment, Strength, and Min GP evenly distributed on the second row.
  - More Filters and compact methodology control live in the filter container.
- Converted the methodology panel into a small details/tooltip-style control with a single popover shell.
- Moved rankings tabs immediately above the matrix and combined them with the matrix toolbar:
  - Tabs on the left.
  - Rank Display / Overall / Deployment controls on the right.
- Moved skater rank-display mode state up to `rankings.tsx` and passed it into `PlayerMatrixTable`.
- Moved goalie/team inline notices below their matrix wrappers so the tabs/action bar remains directly above the table.

### Verification

- `npm run test:full -- components/Rankings/RankingsFilters.test.tsx components/Rankings/PlayerMatrixTable.test.tsx components/Rankings/GoalieTeamMatrixTable.test.tsx __tests__/pages/rankings.test.tsx` passed: 16 tests.
- `npx tsc --noEmit --pretty false` passed.
- `npm run lint` passed with existing warning noise, including existing `<img>` warnings in rankings surfaces.
- `npm run build` passed; `/rankings` generated successfully.
- Dev server restarted cleanly on `http://localhost:3001`.
- Direct route check passed:
  - `/rankings` returned `200`.
  - Rendered HTML includes filter/search controls, compact methodology popover, combined matrix action bar, rank display controls, and tabs before matrix.
  - Rendered HTML no longer includes `resultsHeader`.
- Rankings matrix API check passed with 10 rows, 19 metric columns, snapshot date `2026-04-16`.
- In-app browser check passed at `http://localhost:3001/rankings`: no error overlay, no console errors, hydrated DOM contains the matrix action bar, methodology popover, rank display controls, populated skater matrix rows, and the compact filter layout.

### Notes

- `next start -p 3002` did not remain resident in this repo; it exited after unrelated startup average-calculation logs with an existing Supabase `invalid input syntax for type integer: "null"` message. Production build itself passed.
- A transient `/rankings` 500 occurred while restarting the dev server immediately after `next build` because the old dev process had stale `.next` state. Restarting dev resolved it.
