# WiGO one-page dashboard — layout plan

**TJ decision (pop-up, 2026-10-25):** "No-scroll ≥1280". Strict no-scroll with every component visible at
1440×900 and 1280×800. At 1024 and below the same panels reflow into a scrolling layout, with nothing truncated or hidden.
**TJ direct (2026-10-25):** the "WiGO workflow" link block (SurfaceWorkflowLinks) is removed from the page.

## Before (fixture screenshots in `screenshots/before/`)

| Viewport | Document | Out of view or clipped |
| --- | --- | --- |
| 1440×900 | 1440×1103 (scrolls) | C07 ratings, C08–C11 team drivers, C19 percentiles; the matrix scrolls internally |
| 1280×800 | 1280×1121 | Adds C06 schedule and C18 Game Score |
| 1024×768 | 1024×2075 | 12 of 13 regions; site mobile shell (top bar plus bottom tab bar) |
| 390×844 | Tabs | By design (tabbed) |

The ≥1600 band layout (2026-09 single-viewport work) fits 1920×1080 only: rows of 46/260/280/376px plus a 37-column matrix.

## Space budget

The site header is about 68px on desktop. On 1024 the mobile shell takes about 56px at the top and 64px at the bottom.

| Viewport | Workspace (90% max width) | Grid height after toolbar |
| --- | --- | --- |
| 1440×900 | 1296 | ≈ 754 |
| 1280×800 | 1152 | ≈ 654 |
| 1024×768 | 922 | ≈ 560: not enough for 36×8 matrix cells plus 12 other panels at an 11px floor, hence the scrolling fallback |

## Grid as built (≥1200px wide with ≥700px of grid height)

24 columns; height = viewport − measured top − 6px; gap 4px.

```
row      span:  5            5          4          4          6
toolbar  [ WiGO · search · selected player · Player research (24) ]          auto (32px)
b1a      [ identity+bio | pace/84 ×2 | schedule | ratings 3×3 | drivers 2×2 ]  minmax(80px, 13fr)
b1b      [ production   |  (pace)    | (sched)  | (ratings)  | (drivers)   ]  minmax(56px, 9fr)
b2a      [ comparison matrix: 2 transposed halves, 18 metrics × 9 cols (18) | consistency (6) ]  minmax(158px, 24fr)
b2b      [                    (matrix)                                      | radar (6)       ]  minmax(158px, 24fr)
b3       [ selected-stat log (5) | TOI (4) | Points/GP (4) | Game Score (4) | rate percentiles (7) ]  minmax(175px, 27fr)
```

Measured panel sizes at 1280×800 (W×H, px):

| Panel | Size | Panel | Size |
| --- | --- | --- | --- |
| identity | 237×90 | production | 237×62 |
| pace | 237×156 | schedule | 189×156 |
| ratings | 189×156 | drivers | 285×156 |
| matrix | 863×336 | consistency | 285×166 |
| radar | 285×166 | selected | 237×187 |
| TOI / Points / Game Score | 189×187 each | rate percentiles | 333×187 |

**Changes from the first sketch** (forced by measured content):
- Pace is shown as two 5-row tables.
- The schedule is 4 spans.
- The rate percentiles panel moved to 7 spans with 2×8 single-line tiles.
- Its notices became short chips; the full sentence stays for screen readers and in a tooltip.
- The toolbar is a single 32px strip.

**Hierarchy**
- The comparison matrix is primary: it is the centre, the widest panel, and it has the only accent-coloured selection.
- The identity panel anchors the top left and carries the single team-colour top rail (canonical filled rail, no toenail).
- Everything else uses neutral standard panels: `$background-medium`, a subtle border and a 12px panel title.

**Matrix**
- At 1280 the 37-column orientation would give 30px columns, too narrow for "+272.7%" at 11px. So the matrix is transposed into two side-by-side halves:
  - "Totals & shares": GP…iCF and IPP.
  - "Per 60 & on-ice": 14 per-60s, oiSH%, OZS%, PTS1%, PTS1/60.
- Each half has 9 columns: metric, STD, LY, CA, 3YA, L5, L10, L20, DIFF. That is 18 rows at about 15px (1280) to 18px (1440).
- The L/R period markers sit in the column headers.
- Clicking a metric row button selects it for the selected-stat log (C13); GP stays unselectable.

**Type scale** (Roboto Condensed body/data, tabular numerals; the accent font only for the WiGO wordmark)

| Role | 1280 | ≥1440×860 |
| --- | --- | --- |
| Wordmark | 20px | 20px |
| Panel title (uppercase, +0.06em) | 11px | 12px |
| Table header | 11px | 11–12px |
| Data cells | 11px | 12px |
| Emphasis numerics (production tiles, rating values) | 15px | 17px |
| Captions/fine print | 11px floor | 11px floor |

Nothing in the DOM (including recharts SVG ticks) renders below 11px, verified by e2e. Chart.js canvas fonts are unchanged from base. At ≥1800×1000 the data size steps to 13px and emphasis to 19px.

## Fallbacks
- **769–1199px wide, or less than 700px of grid height below the site header** (about a 774px-tall window): the same panels in a 2-column flow at natural heights. The page scrolls; no panel clips or scrolls internally. Matrix halves stack when the panel is narrower than about 700px.
- **≤768px:** the existing tabbed mobile layout (Overview / Trends / Percentiles / Comparison) is unchanged, minus the workflow links.
- **No-scroll is guaranteed** at ≥1280×800 and ≥1440×900, and also covers 1920×1080; all three are verified by e2e. 1280×700 is verified to fall back to the scrolling flow rather than clip.
