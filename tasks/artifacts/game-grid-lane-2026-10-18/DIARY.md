# S-14 Game Grid lane diary — 2026-10-18

Owner: S-14 worker session (Opus 5.5).
Handoff: `site/game-grid-forecast-integration.md`, items 1, 3 and 5, plus the non-serving part of item 2.
Everything is local only: no commit, push, deploy, hosted DB, provider or NST calls.

## Already complete (verified, not redone)
- The crowding code (`schedule-v2-crowding-0.25`, `calcWeekScore.ts`, `scheduleSummary.ts`) is byte-identical to the accepted candidate `cca89e264` and to `98c1b5036`.
- `98c1b5036`, `4dacc4672`, `aedb7bc7c`, `fefefe006`, `eb33eda00`, `c9bf3d11f` and `5b7bbe35b` are ancestors of `master` and production `457435eb`.
- `56b9f4693` (compact mobile rows), `4ca92f874` (sticky dates) and `0de97e77d` (TJ checkpoint carrying the `calcWinOdds` stub removal) are on octoberBranch only. They are not released.
- The `calcWinOdds.ts` no-op stub removal was already committed by TJ in `0de97e77d`. Nothing was left uncommitted to preserve.

## Item 1: crowding reconciliation and experiment
The source is reconciled (see above). I ran a stated, offline experiment on a real 32-team schedule export: `crowding-experiment/PROTOCOL.md`, `RESULTS.md` and `results.json`. The pre-registered criterion was met with 0 guarantee violations. The improvement is small and comes from tie-breaking only; results are synthetic and positionless.

## Item 2: FORGE lineage (adapter only; serving blocked)
- New `web/components/GameGrid/utils/teamGameExpectations.ts` plus its test (4 tests). It reads the shared `forge-game-expectations-v1` response that RSO and Start Chart use, through a type-only import.
- It builds per-team, per-category known-player subtotals from covered `(gameId, playerId, target)` keys and carries the original cutoff and earliest expiry.
- Missing keys carry reasons: `missing_target`, `use_not_approved`, `expected_unavailable`, `game_not_future`, `unsafe_cutoff`, `expired`, `clocks_unavailable`, `lineage_unavailable`, `game_not_in_reader`, `duplicate_key`.
- `overlappingCategories` refuses to treat G, A and PPP as disjoint.
- It is not wired into the UI. That waits for native FORGE serving to be released, along with a Game Grid read route for the shared reader. No FORGE serving or frozen files were touched.

## Item 3: role-split opponent effects
- New `utils/opponentCategoryEffects.ts` plus its test (5 tests). It maps each role and category to opponent metrics and signs.
  - Skaters: G, A, SOG, BLK; PPP, HIT and PIM have no qualified input.
  - Goalies: W, GA, SV; SV% has no qualified input.
  - Signs are not universal: opponent SF is favorable in opposite directions for SOG and BLK, and for GA and SV.
- It traces the existing team-strength inputs (win odds → M, standings PTS% → 4WK OPP, NST cumulative rates → table) and rejects all of them as category factors.
- `findDoubleCountedEffects` flags an effect (opponent, pace, venue, …) applied by more than one layer.
- The UI uses this module as the single source of colors:
  - A new `OpponentRoleToggle` (Skaters/Goalies, `aria-pressed`) sits in the standalone opponent table and the desktop master table.
  - The skater default reproduces the released colors exactly.
  - The goalie view leaves SA uncolored and colors xGA/GA as win-only context, with legend text that explains this.
  - The toggle is hidden while data is loading, failed or empty.

## Item 5: acceptance tests and browser evidence
- New `LeagueWeek.test.tsx` (6 tests) uses the real Mar 17–23 2025 week:
  - All 32 rows; slate 5/9/2/14/1/14/7.
  - All 127 day masks: totals = 2× league games, decomposition sums to the score, crowding available, and 6ΔGP+4ΔON ≥ 2 ⇒ strict rank.
  - Partial coverage leaves crowding neutral and unavailable.
  - A postponement affects only the two teams and that night.
  - The empty-week sentinel.
  - A 32-row master render with aligned GP/Day totals, Score sorting and the day switch.
- `OpponentMetricsTable.test.tsx` (2 tests) and `GameGridPage.test.tsx` (1 test).
- Browser evidence ran in headless Chromium 1223, on isolated local Vite fixtures only (non-127.0.0.1 requests aborted):
  - The existing repo specs pass unchanged: `opponent-four-week-metrics` 4/4 (1920 and 390px) and `game-grid-previews` 10/10 (1920, 1440, 1180, 1040, 479, 430, 390, 320px).
  - The scratch 32-team real-week fixture (`browser-evidence/fixture-32-team/`, outside the repo's e2e tree) passes 6/6.
    - At 1920, 1180, 390 and 320px: 32 rows, totals, THU mask (GP 104→76→104), postponement (102, THU 13), partial withheld, empty week with Score "-", no page errors, 11 cells and no overflow on mobile.
    - Goalie toggle at 1920 and 390px.
  - Screenshots are in `browser-evidence/shots/`.
- Fixture caveat: the isolated fixtures don't load `styles/globals.css`, so mobile sections overflow by 32px there. The site's global `* { box-sizing: border-box }` prevents this in the app, so the scratch fixture now imports globals.
- I did not use the Next dev server on 3100. It would call the hosted DB and the NHL API from the page.

## Audit items
- **Keep exploring: RESTORED** in `pages/game-grid/[mode].tsx`, tested by `GameGridPage.test.tsx`. The removal in `f90bb13cd` was 6 undocumented lines inside a 164-file release commit. `SurfaceWorkflowLinks` is still used on 5 other pages, and all 4 destinations exist. WiGO's removed links (`15caa26eac`) are outside this lane.
- **`fefefe006` 4WK shading:** a deliberate later design. GAMEGRID C0025's "Score-only emphasis" wording is stale. Rank emphasis is still Score-only, and the 4WK columns add thirds-based favorability shading. That wording belongs to Super Goal (S-04).
- **`PlayerPickupTable.module.scss:1748-1763` raw colors:** outside the lane. `proposed-player-pickup-yahoo-context-tokens.patch` (applies cleanly) swaps the raw values for `v.$color-white`, `v.$color-blue`, `v.$background-dark` and `v.$primary-color`, with small visual shifts.

## Checks
- Game Grid Vitest: 22 files, 232 tests pass.
- Scoped ESLint is clean.
- Full `tsc` (behind the lock) found 4 errors. One was mine (`LeagueWeek.test.tsx` fixture type), now fixed. A scoped `tsc` over the changed Game Grid files and their imports (1,208 files) then passed.
- The other 3 errors belong to other lanes:
  - `pages/api/v1/db/sweep-gamecenter-normalization.ts:5` and `pages/api/v1/db/ingest-projection-inputs.ts:27`: missing `persistCapturedGameNormalization` export.
  - `lib/supabase/Upserts/rollingPlayerValidationPayload.test.ts:1154`: possibly null.
- I did not rerun full `tsc` after my fix.

## Remaining and approvals
- **Item 2 UI wiring:** needs native FORGE serving released, plus a Game Grid route over `loadGameExpectations`, which is a new API surface and needs Chef/TJ approval.
- **Item 4 (markets):** out of scope.
- **Live acceptance** (VoiceOver, real 200% zoom, production readback) needs a release authorization.

## Follow-up: e2e adoption (Chef granted ownership of the `game-grid-previews` spec, config and fixtures)
- `web/e2e/fixtures/game-grid-previews/real-week-32.ts` holds the real 2025-03-17 matchups, with the source and its validator noted.
- `README.md` labels all fixture data synthetic. `/?teams=32` selects the 32-team mode; the default 24-team fixture is unchanged.
- `data.ts` adds the 32-team mode and the `postponed` and `stale` schedule states. `App.tsx` adds Postponed, Stale and Ready buttons.
- `game-grid-previews.spec.ts` gains 5 cases:
  - At 1920, 1180, 390 and 320px: 32 rows, GP/Day totals, Score ranking order, THU day mask (104→76→104), postponement (102, THU 13), partial withheld and empty week.
  - Stale schedule receipts are disclosed in a preview, and all 7 categories stay Unavailable.
- Result: 15/15 pass (the 10 existing cases unchanged). ESLint is clean. Nothing listens on 3112 afterwards.
- The scratch copy under `browser-evidence/fixture-32-team/` is superseded and kept only as the earlier evidence record.
