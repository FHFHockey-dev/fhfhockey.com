# /superstyle backlog: /trends (2026-11-06)

High items are fixed through the per-change loop; Medium/Low items are logged here.

| page | element (file) | finding and suggested fix | priority | pass |
|---|---|---|---|---|
| /trends | Recent-Form Scan cards (`pages/trends/index.tsx`) | Each card shows "No recent trend leaders yet" until its data arrives, so a slow load reads as "no data". Show a loading line or skeleton until the section resolves. | Medium (pass 4) | critique |
| /trends | Team Risers/Fallers panel (`dashboard.module.scss .teamWorkspaceGrid`) | Stretches to the chart's height and leaves an empty band at its bottom. Consider `align-items: start` or a footer note. | Low | critique |
| /trends phone | Movement workspace meta ("Rolling percentile by games played / Recent directionality first / Source updated…") | Three right-aligned uppercase lines under the title on phones; left-align them, or fold them into one caption. | Low | critique |
| /trends phone | Team/skater/goalie trend charts | Eight smoothed lines squeezed into ~300px read as spaghetti. Dataviz pass: fewer lines, or highlight one. | High (pass 7) | critique |
| /trends | Chart palette (`getChartColor`) | Cycles 4–5 hues, so lines 1 and 6 share a colour (Jarry and DiPietro both blue). Dataviz pass. | High (pass 7) | critique |
| /trends | Raw values in `dashboard.module.scss` / `TopMovers.module.scss` | 0.7/0.72rem → `$font-size-xs`, 0.85/0.9rem → `$font-size-sm`; `rgba(255,255,255,x)` → `rgba(v.$color-white, x)`; 13 hand-set letter-spacings (0.06–0.12em) with no token; `999px` pills with no pill-radius token. Sizes shift <1px, so this is a quiet sweep. | Medium | design-system |
| /trends | `CHART_COLORS` in `pages/trends/index.tsx` | A local 5-hue palette (#2563eb, #16a34a, #f97316, #ef4444, #8b5cf6) outside the token system; red is a status colour. Replace with a validated shared chart palette. | High (pass 7) | design-system |
| /trends | TopMovers `.item` gradient (`rgba(255,255,255,0.01)` → transparent) | Near-invisible decorative gradient; flatten it to the surface (unslop). | Low | design-system |
