# /superstyle backlog: /trends (2026-11-06)

High items are fixed through the per-change loop; Medium/Low items are logged here.

| page | element (file) | finding and suggested fix | priority | pass |
|---|---|---|---|---|
| /trends | Recent-Form Scan cards (`pages/trends/index.tsx`) | ~~Shows "No recent trend leaders yet" while loading.~~ Fixed in pass 4: "Loading leaders…" while loading, "No leaders in this window yet." when empty. | Done | critique |
| /trends | Team Risers/Fallers panel (`dashboard.module.scss .teamWorkspaceGrid`) | Stretches to the chart's height and leaves an empty band at its bottom. Consider `align-items: start` or a footer note. | Low | critique |
| /trends phone | Movement workspace meta ("Rolling percentile by games played / Recent directionality first / Source updated…") | Three right-aligned uppercase lines under the title on phones; left-align them, or fold them into one caption. | Low | critique |
| /trends phone | Team/skater/goalie trend charts | Eight smoothed lines squeezed into ~300px read as spaghetti. Dataviz pass: fewer lines, or highlight one. | High (pass 7) | critique |
| /trends | Chart palette (`getChartColor`) | Cycles 4–5 hues, so lines 1 and 6 share a colour (Jarry and DiPietro both blue). Dataviz pass. | High (pass 7) | critique |
| /trends | Raw values in `dashboard.module.scss` / `TopMovers.module.scss` | 0.7/0.72rem → `$font-size-xs`, 0.85/0.9rem → `$font-size-sm`; `rgba(255,255,255,x)` → `rgba(v.$color-white, x)`; 13 hand-set letter-spacings (0.06–0.12em) with no token; `999px` pills with no pill-radius token. Sizes shift <1px, so this is a quiet sweep. | Medium | design-system |
| /trends | `CHART_COLORS` in `pages/trends/index.tsx` | A local 5-hue palette (#2563eb, #16a34a, #f97316, #ef4444, #8b5cf6) outside the token system; red is a status colour. Replace with a validated shared chart palette. | High (pass 7) | design-system |
| /trends | TopMovers `.item` gradient (`rgba(255,255,255,0.01)` → transparent) | Near-invisible decorative gradient; flatten it to the surface (unslop). | Low | design-system |
| /trends | Hero link-pill tooltips (`lib/navigation/siteSurfaceLinks.ts` TRENDS_SURFACE_LINKS) | Tooltips read "…; trend date and player filters reset." (implementation detail). Shared link data, so this changes other pages too. Use plain descriptions. | Low | ux-copy |
| /trends | "Runway" naming (Supporting Runway, Projection Runway, Goalie Start Runway, pills) | Internal metaphor. Plain names would be Upcoming games / Projections / Goalie starts. Offered in pass 4, not chosen. | Low | ux-copy |
| /trends | Panel metas ("Recent directionality first", "Rolling percentile by games played", "Efficiency and workload movement", "Trends lookup", "Projections and start context") | Tracked-caps meta lines that restate the section; trim to the one fact that matters (window, source date). | Low | ux-copy |
