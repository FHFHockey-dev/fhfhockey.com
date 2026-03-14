# Forge Dashboard Desktop QA Checklist (6.1)

Date: 2026-03-05  
Scope: Desktop no-scroll behavior and visual integrity for `/forge/dashboard`  
Environment: Local Next.js dev server on `http://127.0.0.1:3000`

## Status

- Original 6.1 run identified blocker failures (captured below).
- Post-remediation verification in `tasks/artifacts/forge-dashboard-remediation-qa-results.json` now shows:
  - `1440x900`: `hasVerticalScrollbar=false`
  - `1920x1080`: `hasVerticalScrollbar=false`
- Current desktop QA status: **PASS**.

## Execution Notes

- Desktop QA was executed with real Chromium automation (headless) after Gatekeeper unblock.
- Evidence artifacts generated:
  - `tasks/artifacts/forge-dashboard-desktop-qa-results.json`
  - `tasks/artifacts/forge-dashboard-desktop-1440x900.png`
  - `tasks/artifacts/forge-dashboard-desktop-1920x1080.png`

## Checklist

| Check | Evidence | Result |
|---|---|---|
| Dashboard route loads successfully | `curl http://127.0.0.1:3000/forge/dashboard` returned `200` | PASS |
| Page shell and dashboard modules render on load | Chromium screenshots show title, filters, quick links, and all six cards loaded | PASS |
| Desktop no-scroll guard exists for target viewport class | `@media (min-width: 1280px) and (min-height: 900px) { .page { overflow: hidden; } }` | PASS |
| Desktop grid layout uses fixed 2-row/3-column composition | Same media block sets `grid-template-columns: 1.05fr 1.25fr 1fr` and `grid-template-rows: minmax(0, 1fr) minmax(0, 1fr)` | PASS |
| No page-level vertical scrolling at `1440x900` | QA JSON: `docHasVerticalScrollbar: true`, `scrollYChangedOnWindowScroll: true` | FAIL |
| No page-level vertical scrolling at `1920x1080` | QA JSON: `docHasVerticalScrollbar: true`, `scrollYChangedOnWindowScroll: true` | FAIL |
| Internal scrolling remains inside cards instead of page | Panels still render with `overflowY: auto` across all six cards | PASS |
| Visual system consistency follows shared style tokens/panel mixins | File uses `@use "styles/vars"` and `@use "styles/panel"`; panels use `@include p.panel-container(...)` | PASS |
| Desktop functional integrity under empty/default data | Chromium run renders stable empty states without card-level breakage | PASS |

## Risks / Follow-up

- Primary blocker for launch gate: desktop no-scroll requirement is currently not met.
- Metrics indicate page height inflation beyond viewport:
  - `1440x900`: `docScrollHeight=1141`, `mainHeight=1011`
  - `1920x1080`: `docScrollHeight=1557`, `mainHeight=1427`
- Likely cause is interaction with global layout header/footer wrappers plus dashboard container height strategy; requires CSS/layout adjustment in `6.4`.
