## Relevant Files

- `web/pages/shiftChart.tsx` — selection and page composition.
- `web/components/ShiftChart/` — normalized replay model, loading, presentation and tests.
- `web/components/LinemateMatrix/` — compatible supplied-data rendering and compact variant.
- `web/styles/ShiftChart.module.scss` — page-only responsive styling.
- `web/e2e/shift-chart.spec.ts` — deterministic interaction and layout coverage.

### Notes

Owner: lead agent for all tasks. Runtime model/effort verification is unavailable, so no delegation. Preserve unrelated changes and the preceding CORS fix. Tasks 2 and 3 depend on 1; final verification depends on all implementation.

## Tasks

- [x] 1.0 Build typed shared data and replay model.
  - [x] 1.1 Validate NHL inputs; normalize periods, shifts, events and special teams.
  - [x] 1.2 Implement race-safe loading and schedule selection; test calculations and errors.
- [x] 2.0 Integrate shared-data matrices without changing standalone consumers.
  - [x] 2.1 Add supplied-data view, compact team headers and independent position filters.
  - [x] 2.2 Extend regression coverage for loading and filtering.
- [x] 3.0 Replace the JavaScript page with the responsive TypeScript Game Grid.
  - [x] 3.1 Implement playback, dynamic statistics, active-first timeline and filters.
  - [x] 3.2 Match the mockup's hierarchy and verify keyboard/reduced-motion behavior.
- [x] 4.0 Verify and review.
  - [x] 4.1 Run targeted tests, type checking and lint; distinguish unrelated failures.
  - [x] 4.2 Run fixture-backed Playwright coverage and inspect responsive screenshots.
  - [x] 4.3 Inspect final diff and record verification results.

## Verification results

- 28 focused Vitest tests passed across the replay model, request/state handling, playback and matrix components. Includes standalone matrix compatibility and shared-seconds equivalence.
- All five fixture-backed Playwright scenarios passed. Affected scenarios were rerun after final changes.
- TypeScript passed with `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit`; the initial default-heap run exhausted memory.
- Targeted ESLint and `git diff --check` passed.
- Real game 2026010054 rendered with no page errors. Final replay score/shots matched the NHL boxscore: UTA 2 (35 shots), COL 0 (25 shots).
- Desktop, tablet and phone screenshots inspected; 390px and 768px real-data views had no document overflow. Fixture layout checks also covered 1024px and 1664px, keyboard seeking and reduced motion.
- No production build, deployment, database write or dependency installation performed. Existing local server reused.

## Single-viewport redesign follow-up

- [x] Scope the application shell and compact footer to `/shiftChart`; compress the control region using the canonical style guidance.
- [x] Measure timeline and matrix containers, retain every player, and use synchronized side-by-side timelines when stacked rows would fall below 15px.
- [x] Verify complete chart bounds at 1920×1080, 1728×900, 1708×864 and 1440×900, plus mobile and interaction regressions; capture viewport screenshots.


Follow-up verification:
- Real UTA–COL game 2026010054: 20 timeline rows per team and 324 cells per matrix (18 skaters); document bounds match all four requested desktop viewports. Last roster rows, last matrix cells, axes and footer are visible. No chart scrollbars or hidden-overflow fit workaround.
- 1920×1080 uses stacked rosters; 1728×900, 1708×864 and 1440×900 use synchronized side-by-side rosters. Timeline text remains 12px, with rows at least 15px; default matrix cells remain at least 12px square.
- All seven Playwright scenarios passed across targeted runs, including full-roster overtime geometry, independent matrix filters, mode changes, keyboard tooltip navigation/Escape, request counts, replay/date/game controls, loading, retry and unavailable data. Reduced-motion and 390px mobile coverage retained.
- Real FLA–TBL shootout 2026010059: the replay ends at 2–2 after overtime and separately labels the final 2–3 shootout result. Forty player rows retained.
- Mobile 390×844 was visually inspected, including horizontally panning the timeline with player names retained and scrolling to the final matrix cell. Normal mobile scrolling is intentional.
- 28 focused unit tests passed; the nine matrix tests were rerun after adding the keyboard tooltip assertion. Desktop and mobile viewport screenshots saved under `/tmp/shift-chart-real-*.png` and `/tmp/shift-chart-mobile-*.png`.
- Final TypeScript check (`NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit`), targeted ESLint and `git diff --check` passed. No production build or deployment ran.


## September 29 visual refinement

- [x] Fit the matrix rail to its height-limited content, restore the Shift Chart title above selection, restore lineup chips, and allocate their height from timeline rows without shrinking text.
- [x] Add clickable goal markers in a separate ruler lane, distinguish home/away position shades, and animate keyed active-player row reordering with interruption and reduced-motion support.
- [x] Recheck full-roster desktop bounds, mobile, goal seeking, animation, TypeScript and targeted lint.

September 29 verification: eight browser scenarios passed; the three affected layout/motion scenarios passed again after separating ruler goals from minute labels. The replay unit test, TypeScript and targeted ESLint passed. All four desktop sizes retain complete rosters/matrices without document scrolling; 390px mobile was inspected. Row motion was also inspected at 10% playback speed and remains interruptible. At 1920×1080, the matrix rail is approximately 436px (previously 494px), top controls 150px (previously 115px), and timeline rows approximately 16.4px with unchanged 12px text.
