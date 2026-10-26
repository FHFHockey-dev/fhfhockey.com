# RSO-FLAKE: F2 selection label + FR18 re-verification (2026-10-26, Claude)

Lease: `components/RosterScheduleOptimizer/`, `__tests__/components/RosterScheduleOptimizer/`, `e2e/rso-acceptance.spec.ts`. Nothing committed. No git mutations, production reads or deploys. No GIT_DIR. Fixtures only, non-loopback blocked.

## Files (uncommitted; sha256)
| File | sha256 |
|---|---|
| web/components/RosterScheduleOptimizer/RosterScheduleOptimizer.tsx | 3d6d9e6a23762e57c9ee4894334fd1f21a1541258676f9dbc16f257242205275 |
| web/components/RosterScheduleOptimizer/RosterScheduleOptimizer.module.scss | c45548b361f96d05fc9031a15834ceb20f2003ad0f7b19558a55f8d180241c0d |
| web/__tests__/components/RosterScheduleOptimizer/RosterScheduleOptimizer.test.tsx | 1af3aedca8d56ed7177934261c22415c338e776fd105421d6342ecb996df9577 |
| web/e2e/rso-acceptance.spec.ts | 55ae8bf2991f6b2a97449b91a884f87739f930627c9e5a9ef483398654b26bf3 |

## 1. F2 follow-up: plans chosen by schedule capacity are labelled
- `Metric` accepts an optional `note`, shown under the existing detail text (which is unchanged).
- The "Projected points" card shows **"Lineup by schedule capacity"** when `result.selected.selectionMethod === "schedule_capacity"`. It appends **"; totals priced from approved projections"** only when the total is priced (`projectedValue` not null), so the note never claims a price when the total shows "—".
- The note sits inside the card, so the `.metrics` grid's `nth-child` colour rules are untouched. A new `.metricNote` rule passes the CSS-modules pure check (Next's `postcss-modules-local-by-default` in pure mode).
- Tests (`it.each`, component test): schedule capacity with a priced total (full note), schedule capacity with "—" (short note), and quality (no note). Each also asserts the unchanged detail text. 3/3 in UTC and New York.

## 2. FR18 re-verification (`e2e/rso-acceptance.spec.ts`, 5 tests)
| FR18 check | Test | Result (UTC / New York) | Screenshot |
|---|---|---|---|
| 1440×900 with 19 slots: one workspace (roster, optimized week, best fit available); ≤ 20 visible slot rows; an internal label per group; no page overflow | desktop 19 | pass / pass | `screenshots/fr18-desktop-19-slots.png` |
| Same with 20 slots | desktop 20 | pass / pass | `fr18-desktop-20-slots.png` |
| Same with 29 slots (scrolls inside the grid) | desktop 29 | pass / pass | `fr18-desktop-29-slots.png` |
| Mobile 390×844: Itinerary, Roster, Candidates and Matchup each show only their own region, with no page overflow; the first roster player is on the first screen | mobile tabs | pass / pass | `fr18-mobile-{itinerary,roster,candidates,matchup}.png` |
| Continuity: refresh → edit → Undo → second edit → reopen keeps the selected "ADD Bravo Center" step, its lock and an enabled Undo; Undo after reopen works | continuity | pass / pass | `fr18-continuity-reopen.png` |

Logs: `e2e-UTC.log`, `e2e-America-New_York.log`.

## Layout defects found
1. **Fixed (in lease):** the "No drop suggested" explanation listed every uncovered player with every date inline. With many unprojected players (20 in the fixture) it filled the whole first mobile screen of the Roster tab and pushed the roster rows out of view on desktop as well (seen in the first run's screenshots).
   - With more than 2 blockers it is now a collapsed disclosure, "No drop suggested: projected points are unknown for N players"; the full per-player text sits inside.
   - With 1–2 blockers it is still the inline paragraph.
   - Asserted in the desktop tests (collapsed, with a count) and the mobile test (first roster row above the bottom navigation).
2. **Fixed (in lease):** the roster header said "1 players"; it now reads "1 player" (asserted in the continuity test).
3. **Reported, not fixed:** at 1440×900 the Current Roster panel (~22% wide) gives the player-name column almost no room next to GP/AGP/DUST/Pts/Protect/More. Names truncate to one or two letters ("C…" in `fr18-desktop-19-slots.png`; "Al…" for "Alpha Center" in `fr18-continuity-reopen.png`). Changing the column widths is a design choice (FR18 says no redesign is inferred), so TJ should decide whether to drop a column at that width or widen the panel.
4. **Noted, not a defect:** the mobile Itinerary stream table scrolls horizontally inside its own container (Wednesday is cut off at the panel edge, `fr18-mobile-itinerary.png`); the page itself does not overflow.

## Runs
| Check | UTC | America/New_York |
|---|---|---|
| `e2e/rso-acceptance.spec.ts` (5 tests) | **5/5** | **5/5** |
| Component tests (`__tests__/components/RosterScheduleOptimizer`, `components/RosterScheduleOptimizer`) | **370/370** | 370/370 (RSO component file is green in the full run below) |
| Full RSO suites (`lib/rosterScheduleOptimizer`, the component tests, `hooks`, `lib/in-season`) | 1661/1673 | 1662/1673 |
| eslint (changed files) | 0 errors (the same 6 existing react-hooks warnings) | |
| Whole-project `tsc --noEmit` under `/private/tmp/fhfh-heavy.lock` | exit 0, 0 errors | |

**About the full-suite failures (not this lane):** all 11–12 failures are in `CategoryGains.test.tsx`, `dailyAcceptance.categories.test.ts`, `planning.test.ts` and `planningReproducibility.test.ts`. None imports the RSO component. They exercise `lib/rosterScheduleOptimizer/planning.ts`, which another lane has uncommitted edits to (`planning.ts`, `planning.test.ts` and `dailyAcceptance.categories.test.ts` are modified in the shared tree). My lease doesn't include those files, so I made no change there.

**Server note:** the ticket asked for `PLAYWRIGHT_ISOLATED_NEXT=1`. The social-share/tuesday-trends lane was running its own isolated server (port 3110) on the same `.next-playwright` directory at the same time, and each server kept wiping the other's build (ENOENT, 404/500 on the page). To stop clobbering their run, I stopped mine and served from the other isolated directory the Next config supports, `PLAYER_FORECAST_ISOLATED_NEXT=1` (`.next-player-forecasts`, unused since Oct 17), on port 3172. That is still isolated from TJ's `.next`/:3000 and from :3105. The server is stopped.
