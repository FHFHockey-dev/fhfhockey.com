# Q-03: site UX and statistical-display reconciliation

The spec is `Claude-Code-Handoff-Pack/site/site-ux-and-statistical-display.md`, built on `output/page-optimization-audit-20261015.md`. This is a local, uncommitted patch: [q03-a11y-status-and-focus.diff](q03-a11y-status-and-focus.diff), 12 files. It applies to HEAD `0de97e77d` on its own. No dev server, browser, production request or `npm install` was used.

## 1. Classification of earlier findings and candidates

Status is judged against current source on 2026-10-18.

| Item | Status | Evidence |
| --- | --- | --- |
| Reset-password candidate (A01) | **Fixed, not regressed** | Correctable errors use `formError` and keep the form (`reset-password.tsx:298–320`). The 9 tests in `__tests__/pages/auth/reset-password.test.tsx` pass, including "preserves the fields and allows a successful retry after an update error". |
| API test routes (R01) | **Fixed** | 0 test files under `web/pages/`. The relocated tests under `__tests__/pages/api/` pass. |
| Game page candidate (A04, game part) | **Fixed, byte-identical to the frozen candidate** | `[gameId].tsx` and `game.test.tsx` SHA256 match the spec (`c49f1b63…`, `ba2d549b…`). Its tests pass. The original `/tmp` patch and manifests are **missing**; they were not recreated. |
| Radar direction and season scope | **Fixed, byte-identical to the accepted pins** | All four files match `radar-scope-integration-2026-10-15/pins.json`. 59 tests pass. Browser and live-data verification remain open, as that handoff states. |
| C01 Stats filter and heading | **Fixed** | Position-aware leader sets (`stats/index.tsx:78–91`) with a per-filter empty message. `stats/index.test.tsx` passes. |
| C02 Lines freshness wording | **Fixed** | Label is now "Page refreshed" (`lines/index.tsx:213`). Source report times stay separate. |
| C03 Leader-label legibility | **Fixed** | Leader labels are 0.75–1rem. The 0.62rem rules are gone; the 0.58rem rule is the mover `.tag`, not a leader label. |
| A05 Team-explorer error contrast | **Present → fixed here** | The partial-season `#8a5a00` notice had the same defect at 3.14:1. |
| A06 Spinner motion and text | **Present → fixed here** | |
| A03 Global focus suppression | **Present → fixed here** | |
| A02 Pointer-only controls | **Partly fixed here** | The lines logo download is fixed. The projections sort header and the legacy `statsPlaceholder` controls are **still present** (§3). |
| A04 Legacy team directory | **Present, deferred** | `useTeams` turns failures into `[]`, and `teamStats.tsx:74` then shows "Loading..." forever (§3). |
| P01–P04 | **Present, not in this UX set** | No `Promise.all` in the homepage or player-detail SSR. `lines/index.tsx:77` calls `getLineCombinations` per team. 5 `fonts.googleapis` lines in `_document` and 5 `@import`s in `globals.css`. |
| P05 Apollo in `_app` | **Fixed** | Patch 01 v2 is in HEAD (`0de97e77d`). |

## 2. What this patch changes

| Finding | Change | Regression test |
| --- | --- | --- |
| **A05** | The team explorer's alert, partial-season notice and row summary drop the inline `#8a1c1c` / `#8a5a00` / `#555` for new token classes in `playerStats.module.scss`: `$danger-color`, `$warning-color`, `$text-secondary`. Contrast on the measured panel colour rgb(17.01, 18.97, 21.59) rises from **2.01 / 3.14 / 2.50 : 1 to 6.53 / 12.35 / 8.01 : 1**. | `__tests__/pages/underlying-stats/teamStats/index.test.tsx` gains three assertions, including a new failed-load alert case, all requiring no inline colour. **RED check:** against HEAD's page, 3 of 7 tests fail; with the fix, 7/7 pass. |
| **A06** | `Spinner` stops rotating under `prefers-reduced-motion: reduce`. The ring is `aria-hidden`. A new optional `label` prop renders `role="status"` with visually hidden text. `Comments`, where the spinner is the only loading indicator, passes `label="Loading comments"`. The label is opt-in, so the other 15 callers, including 4 in GameGrid (S-14), produce no new announcements. | New `components/Spinner/Spinner.test.tsx` (3 tests). Every Spinner caller's tests pass: GameGrid, WiGO, TimeOnIce, Sustainability and variance, 37 files and 343 tests. |
| **A03** | `globals.css` hides the outline only for `:focus:not(:focus-visible)`. Keyboard `:focus-visible` on inputs and textareas gets the design system's focus treatment (3px `rgb(255,193,8)`, offset 2px, as in `vars.scss:592`). Component rules with class selectors keep higher specificity, so existing custom focus styles still win. | New `__tests__/styles/globalFocus.test.ts` (2 tests). |
| **A02 (lines)** | The team-lines logo becomes `<button type="button" aria-label="Download {team} line combinations image">`. The inner `div`s become `span`s, which is valid inside a button, and existing `display` rules keep the layout. The SCSS resets button chrome and adds the same focus ring. `Header` is exported for the test. | New `__tests__/pages/lines/abbreviation-header.test.tsx`: the button exists by role and name, has `type="button"`, and clicking calls the download. |

**Checks:**

- Focused files: 70 tests pass.
- Spinner callers: 343 tests pass.
- The earlier candidate sweep: 183 files and 1,581 tests pass.
- ESLint on all changed files exits 0. The only warnings are the two pre-existing `<img>` warnings in `lines/[abbreviation].tsx`.
- Locked full typecheck and compile build: see §4.

## 3. Not changed, with reasons

- **A02, projections sort header** (`pages/projections/index.tsx:374`). This is a TanStack header next to Draft's `projectionsConfig`. The fix is a native `<button>` inside each sortable `th` plus `aria-sort`. Ownership should be confirmed with S-13 first.
- **A02, `statsPlaceholder`.** A legacy placeholder route. Retire it or fix it, as a product decision.
- **A04, legacy `/teamStats` directory.** The fix needs `useTeams` (a shared hook) to expose `error` and `loaded`, and every consumer must be checked first.
- **P01–P04.** Performance items, outside this UX set. P04 (fonts) needs a browser visual check.

## 4. Locked typecheck and build

The job ran under `/private/tmp/fhfh-heavy.lock` from 19:05:02 to 19:06:33 UTC on 2026-10-18.

- **Full typecheck** (`tsc --noEmit` with an 8 GB heap, over the whole working tree including other lanes' uncommitted work): **exit 0, 0 errors**, 53 s.
- **Isolated compile build** (`PLAYWRIGHT_ISOLATED_NEXT=1 PRESERVE_NEXT_DIST=1 next build --experimental-build-mode=compile`): **exit 0**, 38 s. This compiles the changed SCSS and TSX.
- `web/next-env.d.ts` is unchanged. The lock was released.

## 5. Still open (not claimed)

- **Browser checks are pending; no dev server was allowed.**
  - Keyboard Tab and Enter/Space on the lines logo.
  - The visible focus ring on news search and team-explorer inputs at 320, 390, 768 and 1440 px.
  - Reduced-motion rendering of the spinner.
  - Screen-reader announcement of "Loading comments".
  - Contrast measured on rendered pixels; it is computed from tokens here.
- **A03 visual change for mouse users.** Browsers treat text inputs as `:focus-visible` even on click, so inputs without their own focus style now show the ring on click too. That is standard accessible behavior, but it needs a visual pass.
- **Live-data and production acceptance.** Not run for the radar or game page, per their handoffs.
