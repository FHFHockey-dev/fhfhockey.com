# Game Grid / Draft Dashboard Style Audit Report

Date: 2026-07-22

## Canonical recipes

- Surfaces use `v.$background-dark`, `v.$background-medium`, `v.$border-soft`, `v.$radius-*`, and `v.$shadow-panel`; elevated overlays may use the existing restrained cyan radial accent.
- Panel containers, headers, scroll bodies, and first-column separators use `panel.panel-container`, `panel.panel-title`, `panel.panel-scroll-wrapper`, and `panel.first-col-separator`.
- Dense tables use compact uppercase headers, numeric alignment, stable sticky layers, token-derived zebra/hover states, and a container-owned horizontal scroller.
- Controls use dark token surfaces, canonical borders, `v.$focus-ring-desktop`, explicit disabled/pressed state, native or named switch semantics, and `v.$transition-duration` / `v.$transition-easing`.
- Scrollable feature surfaces use `v.custom-scrollbar`; responsive thresholds use shared breakpoint tokens.
- Dialog-like overlays use a fixed backdrop, elevated bounded shell, persistent close action, viewport-contained scrolling, modal semantics, focus entry/trap/return, and reduced-motion handling.

## Classification and disposition

| Finding                                                                                                          | Classification               | Disposition                                                                                                                                                                                |
| ---------------------------------------------------------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Opponent Metrics and Four Week Grid already consume the shared panel title/container/scroll/separator helpers    | Shared mixin adoption        | Evidence-closed; no churn                                                                                                                                                                  |
| Player Pickup already uses the shared panel, focus, state, pagination, and scrollbar recipes                     | Shared mixin adoption        | Evidence-closed; final Phase-5 responsive workflow proof remains separate                                                                                                                  |
| Toggle/Switch retained local transition constants and literal black/white alpha sources                          | Token replacement            | Replaced with canonical transition and color tokens; minimum 24px target retained at mobile sizes                                                                                          |
| PDHC used one duplicate tooltip ID and tooltip semantics for a modal interaction                                 | Semantic prerequisite        | Recorded as NEW 11.0, then repaired with unique ownership, dialog semantics, keyboard activation, focus containment/return, Escape/backdrop/close dismissal, and a persistent close action |
| PDHC JavaScript supplied raw neutral fallback colors even though the rendered state requires valid team metadata | Token replacement            | Removed; intentional team CSS-variable hooks remain and shared SCSS fallbacks own neutral UI colors                                                                                        |
| Poisson probability ramp literals are feature-specific visualization colors                                      | Local exception              | Retained; they encode the chart scale rather than the shared shell                                                                                                                         |
| The paired Toggle/Switch `.module.css` files have no consumers                                                   | Controlled cleanup candidate | Retained until the separately tracked cleanup disposition                                                                                                                                  |
| Current production route is offseason-empty                                                                      | Evidence limitation          | Superseded by local populated in-season browser proof, including the repaired 528-result Player Pickup workflow                                                                               |
| Populated desktop legacy-vertical mode compresses/clips its side and transposed tables without an owning scroller | Responsive defect            | Registered as P2 NEW 12.0 before remediation, then repaired with readable fixed-minimum rails and a bounded container-owned desktop scroller                                                |
| Offseason Player Pickup queries the 2025–26 Yahoo population as season 2026 although stored rows use start year 2025 | Functional prerequisite      | NEW 13.0 closed: the UI now derives start year 2025 and preserves NHL aggregate identity `20252026`; pure contract tests and populated browser proof pass                                      |
| Player Pickup range/select labels and sortable headers lack complete native semantics                              | Accessibility prerequisite   | NEW 14.0 closed: associated labels, native sort buttons/`aria-sort`, contextual disclosures, focus styling, and valid table DOM pass desktop/mobile browser proof                             |
| Side-table literal white/black alpha sources                                                                      | Token replacement            | Opponent Metrics, Four Week Grid, and Player Pickup now use shared white/black tokens; exact scoped raw-color/WebKit-scrollbar scan is empty                                                |

No new shared token or mixin was added: the verified needs were already served by canonical tokens, and no new semantic value had two independent consumers.

## Control reconciliation — 2026-07-25

The canonical recipes above directly satisfy task 1.1. The published shell/header evidence satisfies every child of 2.0. Populated in-season browser proof closes schedule, side-table, transposed-grid, Player Pickup, responsive/accessibility comparison, residual clipping/team-color, representative-route, and behavior-parity rows. Every discovery was registered before remediation; the source/master pair is complete.

## Verification

- Component behavior: `Tooltip.test.tsx`, `SwitchToggle.test.tsx`, `SortableHeaders.test.tsx`, and `FourWeekGrid.test.tsx` pass 12/12.
- Type safety: `npx tsc --noEmit` passes.
- Style safety: the Tooltip and Poisson modules compile directly with Sass; the Toggle/Switch modules are included in the final style compilation group.
- Browser evidence: `/game-grid/7-Day-Forecast` was inspected at 1440×900, 834×1112, and 390×844. Body and main client/scroll widths matched at every width, the primary grid stayed readable inside its owned surface, controls retained accessible names, and the browser error log was empty.
- Scope: no sorting, schedule calculations, data fetching, pagination, orientation logic, schema, data, provider, or production state changed.
- Side-table token cleanup: the exact three-module scan finds zero raw hex, literal RGB/RGBA color source, or WebKit-only scrollbar fragment; direct bundled-Node-24 Sass compilation passes for all three modules.
- Populated responsive proof: 32 NHL teams render across seven in-season days at 1440×900, 834×1112, and 390×844. Master and stacked modes have zero body overflow; controls remain inside the viewport; Week Score and the live 68.6%/31.4% PDHC heatmap stay bounded; Escape restores heatmap-trigger focus; and browser error logs are empty.
- Legacy-vertical repair: desktop rails retain 320px / 1320px / 280px readable minimums inside one owned horizontal scroller (1295px client, 1968px scroll width). Trackpad scrolling reaches the right rail, body overflow remains zero, and post-fix tablet/mobile layouts remain stacked.
- Regression proof: `SortableHeaders.test.tsx`, `SwitchToggle.test.tsx`, and `FourWeekGrid.test.tsx` pass 12/12; `GameGrid.module.scss` compiles directly under bundled Node 24; scoped lint and diff integrity pass.
- Player Pickup contract: Production contains 1,494 start-year `2025` Yahoo rows, 599 default-eligible. The UI now retains that start year after the 2025–26 season ends and derives aggregate identity `20252026`; two direct regressions cover valid and fail-closed identities.
- Player Pickup workflow: desktop/mobile render 528 results and 25 rows/page. Browser actions prove ascending name sort, ANA filter with 19 matching rows, reset to ALL/528, page 2/22 with Previous enabled, contextual mobile disclosure, zero body/region overflow, and clean fresh runtime logs.
- Token/accessibility closure: every literal white/black RGBA channel in the exact scoped modules now uses shared tokens without alpha changes. Remaining schedule-intensity, team hook, Poisson/error-ramp, and local control-size values are feature semantics rather than duplicate design tokens. Four reduced-motion owners remain active. Labels, `aria-sort`, keyboard sort buttons, focus rings, textual H/A/rank/state cues, 320px owned table reflow, and valid table DOM satisfy the scoped accessibility comparison.
- Final gates: eight focused files pass 27/27; full TypeScript, scoped ESLint, three bundled-Node-24 Sass compilations, new-test Prettier, and diff integrity pass.
