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
| Current production route is offseason-empty                                                                      | Evidence limitation          | Desktop/tablet/mobile shell and overflow proof captured; populated schedule, orientation, Player Pickup, and live PDHC visual proof remain open                                            |

No new shared token or mixin was added: the verified needs were already served by canonical tokens, and no new semantic value had two independent consumers.

## Verification

- Component behavior: `Tooltip.test.tsx`, `SwitchToggle.test.tsx`, `SortableHeaders.test.tsx`, and `FourWeekGrid.test.tsx` pass 12/12.
- Type safety: `npx tsc --noEmit` passes.
- Style safety: the Tooltip and Poisson modules compile directly with Sass; the Toggle/Switch modules are included in the final style compilation group.
- Browser evidence: `/game-grid/7-Day-Forecast` was inspected at 1440×900, 834×1112, and 390×844. Body and main client/scroll widths matched at every width, the primary grid stayed readable inside its owned surface, controls retained accessible names, and the browser error log was empty.
- Scope: no sorting, schedule calculations, data fetching, pagination, orientation logic, schema, data, provider, or production state changed.
