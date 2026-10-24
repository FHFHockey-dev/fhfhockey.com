# C1 receipt: STATS-S06 team Season Stats lines and Shot Map slice

- Lane C1, Claude session, 2026-10-24. Status: **implementation candidate, not reviewed, integrated or released**. This covers one S06 slice only. It does not complete STATS-S01 to S14.
- Base: `/Users/tim/Code/fhfhockey.com`, `octoberBranch` @ `2a5092d37cb863ec92a2a4e609999cf226bfa4a5`. No Git writes were made. Lease baselines matched 7/7 at start (CLAUDE-LEASES.json C1).
- Patch: `handoffs/C1/C1-S06.patch`, sha256 `ecef9b66b9aa65eba5be10e8842c67b996bdb26e80d5744093f82ee8fd0ab7d4`. It changes 7 files (+771/−309). Most of the ShotVisualization diff is re-indentation from moving the filter panel out of the non-empty branch.

## Gaps reproduced and fixed

All of these were reproduced against HEAD before any edit, using the fixture harness below.

1. **Inactive reads.** A Dashboard load read `lineCombinations` and `yahoo_nhl_player_map` on every team page, whatever tab was open (`before-report.json`, first entry). The read now lives in `TeamTabNavigation`, and it runs only while the Season Stats tab is open (`after-report.json`).
2. **Stale team.** The old page effects had no request ownership. A late response for team A could overwrite team B. The new hook is keyed by team and drops obsolete responses. An obsolete team never triggers a player-map read.
3. **Game-type filter had no effect.** `gameTypeFilters` was computed in `useShotData` and never applied. With "Playoffs" selected, the map showed all 146 season events. It now shows the 16 events from the single fixture playoff game. The filter uses game-ID digits 5-6 on rows that were already read, so the query shape and the A9 request/cache ownership are unchanged.
4. **Empty selection.** An empty event-type selection used to read every event type with no limit. An empty game-type selection also still read data. Now an explicitly empty selection makes no read and shows "Select at least one event type and one game type."
5. **No recovery from loading, empty or error states.** The filter panel was unmounted during loading (so a multi-select lost focus mid-change) and in the empty state, and there was no reset. The filters now stay mounted in the loading, empty, error and no-selection states. A **Reset filters** button restores Goals + Shots on Goal and Regular Season. A read error now appears inside the visualization (`role="alert"`) instead of a detached "No event data" plus a banner.
6. **Coordinates and shooting %.** Coordinates that could not be parsed were plotted at center ice (0,0). They are now dropped. Shooting % was goals ÷ saved shots (the fixture showed 107%). It is now goals ÷ (goals + `shot-on-goal`), and it is hidden when no saved shots are loaded. "Shots on Goal" now includes goals.
7. **Mixed line shapes.** A 13F/5D lineup dropped F13. Extra skaters now fill the other group's open slots (11F/7D and 10F/8D go into the forward grid, 13F/5D into the defense grid). Null or blank IDs are dropped instead of rendering "null" links, and nested rows are flattened.

## Verification (run in `web/`, Node 22.11.0)

- `npx vitest run hooks/useShotData.test.tsx components/TeamTabNavigation/TeamTabNavigation.test.tsx __tests__/pages/stats/team/teamAbbreviation.test.tsx`: **passed, 39/39.**
- The same two leased test files run against the HEAD sources: **18 new tests failed** and the 17 existing ones passed (`fixture-harness/baseline-run.txt`). The candidate files were restored afterwards and matched their sha256 (`baseline-swap.sh`).
- The existing useShotData fixtures now use real game-ID format (`2026020001`) instead of `id: 1`. All of the original ownership assertions are unchanged. The game-filter ownership case supplies a playoff game for `gameTypes: ["03"]`.
- `npx eslint` on the 7 files: **passed** (0 errors; 1 existing `<img>` warning in the page).
- `npx tsc --noEmit`: **failed, exit 2** (corrected 2026-10-24). The original "exit 0" was wrong: my zsh `pipestatus` index read the wrong command. The re-run (8 GB heap, under `/private/tmp/fhfh-heavy.lock`, released afterwards) found exactly 2 errors, both pre-existing in the Luna packet: `lib/sources/tweetLunaReview.test.ts:192` and `scripts/review-ifttt-luna.ts:22`. There are no errors in any C1 file. The output is in `tsc-recheck-2026-10-24.txt`.
- No `npm run build`, no E2E spec, no remote build or deploy.

## Screenshots: fixture-only, no production reads

- **Harness.** `fixture-harness/pgrst-stub.mjs` is a PostgREST stand-in on 127.0.0.1:54399. The Next dev server ran with `PLAYWRIGHT_ISOLATED_NEXT=1` on 127.0.0.1:3110, with `NEXT_PUBLIC_SUPABASE_URL` pointed at the stub. `capture.mjs` (Playwright) aborted every non-127.0.0.1 request and every `/api/*` request. The blocked hosts are listed in the reports.
- **Expected console errors.** These come from the stubbed or blocked `/api/v1/season` and standings calls ("Unable to load standings").
- **Captures.** `screenshots/{before,after}-*.png` at 1440px and 390px:
  - Season Stats lines for EDM 12F/6D and TOR 13F/5D
  - Shot Map default, Playoffs-only and empty selection
- **Narrow layout.** The 390px page has 0px horizontal document overflow.
- **Not covered:** 320px and 1024px widths, real devices, assistive technology, and real provider data. Keyboard reset is covered only by a jsdom `fireEvent` test.
- The server and stub are stopped, and ports 3110 and 54399 are free. The `.next-playwright` slot is released. Its cache was compiled with stub environment values, and the next holder should start fresh.

## Preserved and not touched

- A9 shot request ownership and the loaded-key cache: unchanged. All original useShotData tests pass.
- No edits to `clientFetchCache.ts`, `useTeams.ts`, `siteSurfaceLinks.ts`, shared navigation, or global or module CSS.
- `useTeams.ts` and `clientFetchCache.ts` were already dirty from others' work. Read-only dependency hashes are in `DEPENDENCIES.sha256`.
- No player hydration changes. The existing yahoo name/position map read is only moved, with the same columns.

## Follow-ups (not done, outside the lease)

1. `useTeamSchedule` still reads `games` on every tab, including the Dashboard. That needs a lease on `hooks/useTeamSchedule.ts`.
2. At 390px the half-rink SVG is clipped on the right, and the team rink's Goals and Shooting % lines are hidden. Both are pre-existing (see the before capture) and owned by CSS / `drawHockeyRink`, so they need a `TeamStatsPage.module.scss` lease.
3. The page derives `shotMapActive` from `router.query.tab === "visualization"`. An array-valued `tab` would disable it. This is minor and was left unchanged.

**Safe next action:** independent review of the patch, then Codex integration. No external action is needed.
