# Game Grid task 10: local presentation receipt

Status: completed locally on canonical `octoberBranch`; production category availability remains dependent on a qualified reader payload. This receipt covers the fresh task-10 requirements supplied by the coordinating parent, supplementing the earlier task-10 disclosure scaffold in `tasks-game-grid-execution-2026-10-07.md`. It does not close live producer qualification or production acceptance.

Baseline: clean `octoberBranch` at `a9a6964b05638f4744e5cacb3df012ffaa1bcf01`, with supplied release `ca81578afdae9b85643aee2c4d87d3ded3099c75` in local history. No deployed source readback occurred. No branch/worktree creation, switches, resets, push, build/deployment, provider access, credentials, database writes or native forecast execution occurred.

## Exclusive owned paths

- `web/components/GameGrid/TeamDetails.tsx`
- `web/components/GameGrid/TeamDetails.module.scss`
- `web/components/GameGrid/TeamDetails.test.tsx`
- `web/e2e/game-grid-previews.spec.ts`
- `web/e2e/game-grid-previews.config.ts`
- `web/e2e/fixtures/game-grid-previews/App.tsx`
- `web/e2e/fixtures/game-grid-previews/data.ts`
- `web/e2e/fixtures/game-grid-previews/index.html`
- `web/e2e/fixtures/game-grid-previews/server.mjs`
- This receipt.

The forecast worker's `web/scripts/qualify-native-players-offline*` and `web/scripts/fixtures/` files are separate work and were not edited or staged by this lane. Shared execution checklists were not changed.

## Result

The shared detail component now consumes optional existing `TeamForecastRecord[]` and `TeamForecastContext` inputs. Independent aggregate injection was removed: weekly categories derive from the same admitted per-game records shown in each game card. G/A/SOG/HIT/BLK/PPP and the existing optional PIM remain independent; goals never supply another category. Numeric zero, a covered bye, unavailable data and known partial subtotals remain distinct.

Game cards show full-game pregame category means, per-category coverage and available model/cutoff/issuance/source-watermark/source-availability metadata. The existing contract's admission checks apply without changing the producer contract. Presentation also checks displayed season, team, actual date, start identity, selected horizon, schedule coverage and pregame state. Duplicate/stale/conditional/mismatched records are withheld. Started games are not displayed as live remaining-game forecasts.

Remaining-week totals end on Sunday. Next-week and excluded-date cards can retain qualified full-game context, but their values do not enter these totals. Started, completed, inactive and unknown-eligibility games are excluded. An inferred date cannot create a confident empty week. Totals explicitly sum the displayed game means rounded to one decimal; regression inputs of 1.24 + 1.24 display 1.2 + 1.2 = 2.4. Incomplete schedules label numeric amounts as known subtotals.

Existing disclosures stay native buttons with names, expanded state and associated panels; Team HQ stays a separate link. Enter/Space open and close them. Close controls restore focus. Multiple open team IDs survive sorting, same-week refresh, forecast span and orientation changes. Corrected schedule behavior withholds rows while coverage is incomplete, then restores open panels when complete data returns. Selecting a different week resets the open set. This refers to data refresh in the mounted view; full document reload persistence is not added.

The existing BPA styling, header/date controls, date windows, Week Score and scoring/crowding/SoS/O-U policy were preserved.

## Verification

Node actually used: 22.11.0. All commands ran from `web/`.

- **Passed:** `npm test -- --run components/GameGrid/TeamDetails.test.tsx components/GameGrid/utils/teamForecasts.test.ts components/GameGrid/SortableHeaders.test.tsx components/GameGrid/utils/calcWeekScore.test.js` — 105 tests / 4 files (28 component, 48 contract, 10 sorting, 19 score).
- **Passed:** scoped `npx eslint` on the owned TSX/TS/MJS component, tests, config and fixtures; no lint diagnostics.
- **Passed:** `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit`; no TypeScript diagnostics.
- **Passed:** `npx playwright test -c e2e/game-grid-previews.config.ts` — 5 actual Chromium scenarios with 24 teams, desktop keyboard sorting, 390/320px keyboard sorting/reflow, Enter/Space activation, focus indicators/return, sorting/refresh/span/orientation persistence, new-week reset, partial-to-ready refresh and covered empty schedules. Qualified/partial/missing/stale/zero/unknown fixtures verify displayed totals and source metadata.
- **Passed:** axe audit of the rendered qualified detail fixture at 320px, zero violations. Audit scope is the isolated detail fixture; it does not establish whole-site accessibility or actual assistive-technology behavior.
- **Passed:** visual inspection of expanded desktop and 320px screenshots; `git diff --check` and owned-path diff review.
- **Not run:** production/provider/data reads, real forecast reconciliation, live acceptance, VoiceOver and native browser 200% zoom, application production build, push/deployment.

Recoverable initial checks exposed outdated weekly-only assertions, a fixture type error, fixture startup/module issues and selectors that did not account for desktop labels, repeated headers or the controls menu. These were corrected; the final commands above passed. Chromium executed successfully; this was not test discovery alone.

## Evidence and remaining dependency

Reproducible fixtures are committed with the UI. The Vite fixture replaces production reader/hooks, rejects production Supabase/NHL reader imports, uses temporary caches without environment files, and browser requests are limited to the loopback fixture server. No hosted input or real-data category mean is claimed.

Screenshots and logs are saved outside the checkout at `/Users/tim/Documents/Codex/2026-10-09/task-4/game-grid-task10/`: `desktop-24-team-expanded.png`, `narrow-390-expanded.png`, `narrow-320-expanded.png`, `qualified-payload-desktop.png`, `qualified-payload-320.png`, `accessibility-audit.json`, four check logs and `evidence-sha256.json`.

Production `GameGrid` currently supplies schedule data without an admitted category record payload; its expanded categories truthfully remain unavailable. Real category totals and team/player reconciliation require the producer owner to qualify and supply compatible per-game records/context. No serving flag or provider fetching contract was changed, and no production lineage was inferred from schedule data. This dependency does not block the completed presentation feature.
