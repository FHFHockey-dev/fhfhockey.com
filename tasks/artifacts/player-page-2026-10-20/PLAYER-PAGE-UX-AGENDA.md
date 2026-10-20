# Player statistics page: separate UX review and agenda

Date: October 20, 2026. Status: analysis complete for supplied views and a bounded desktop inspection; implementation not started. Design direction awaits TJ’s optional mockups. This agenda is separate from the FORGE → RSO → Start Chart release-critical work.

Reference: https://fhfhockey.com/stats/player/8485406 (Porter Martone).

## Evidence and limits

- Reviewed all four supplied full-page screenshots: Overview (IMG_0646.jpeg), Advanced (IMG_0648.png), Trends (IMG_0650.png), Calendar (IMG_0652.png). They are scaled images, not reliable CSS-pixel measurements. No mobile Gamelog screenshot was supplied.
- Inspected the live public page in Scout’s cloud desktop Chrome, approximately 1165×747 screenshot dimensions, across all five tabs. Ordinary page viewing/tab selection only; no direct API probes, backend repairs, logins, or configuration changes.
- Inspected cloud repository source separately. Source findings are not proof of which commit is deployed. No application or repository files were changed for this agenda.
- Not performed: real-device touch/VoiceOver, mobile browser emulation, 1440/1920px screenshots, 200% zoom, keyboard traversal, full contrast measurements, or data-source validation. These are acceptance work, not claimed completed tests.

## Executive assessment

This is not primarily a padding problem. Several components retain desktop column arrangements inside narrow containers; nested padding reduces usable width further, and overflow clipping hides content. A separate CSS specificity problem also makes the calendar activity grid enormous on desktop. Shrinking typography would conceal rather than solve these issues.

There is a second, distinct track: cross-tab statistics/context contracts. A visual redesign must not make contradictory or incorrectly formatted figures look more authoritative. Preserve unavailable states and investigate the exact denominator, season and units before altering displayed values.

## Mobile findings, by supplied view

### Overview
- Profile/insights and calendar remain adjacent as extremely narrow strips. Headings, labels and summary values wrap excessively; substantial content is cut off.
- The controls occupy a large block before the useful answers. A mobile overview should lead with identity and a compact factual summary, then offer optional detail.
- Multiple nested card borders/padding spend scarce width without adding hierarchy. The long left column leaves poor balance and excessive vertical distance.
- Recommendation: a true single-column composition; full-width key summary and profile, with calendar as a compact preview/link to its dedicated tab. Keep deployment details readable, not squeezed into a narrow residual panel.

### Advanced
- Half-width table and chart are not useful on a phone: dates are truncated and the chart is a narrow slice.
- The lower profile/insights pair repeats the same problem. Fixed-height wrappers risk clipping rather than scrolling to complete content.
- Recommendation: full-width modules; deliberate horizontal scrolling inside the data table only, with a persistent identifying column and clear overflow affordance. Charts need their own responsive height/legend, separate from table sizing.

### Trends
- This is the strongest existing mobile structure: chart and summary use the available width rather than two narrow columns.
- Selection controls still have crowded labels and weak grouping. Long advanced names wrap into several lines.
- Five large stacked summary cards consume substantial height for little information. Use a compact responsive summary grid/list with clear units, not smaller text.
- Counts and percentage series share a plot. Use unit-aware grouping, small multiples, or an explicitly labelled alternate axis only after deciding the intended comparison. Do not silently standardize values.

### Calendar
- The month layout extends beyond the card, exposing a partial second month. Navigation/overflow intent is unclear.
- The activity overview consumes too much space and has clipped weekday labels. Summary information is repeated in multiple places.
- Recommendation: one complete month at a time on phones with obvious previous/next controls; preserve selected date details. A compact activity overview is optional rather than the primary mobile surface.
- Color must not be the only way to distinguish played, missed, future, playoff and quality states. Provide readable text on selection/focus, not hover alone.

### Gamelog
- Not visually verified on mobile. Include it in this agenda rather than assuming the other four screenshots cover it.
- Preserve selected statistics and date identity; contain horizontal table scrolling instead of introducing page-level overflow.

## Desktop assessment

- The desktop header has a large identity card, substantial whitespace and separate search block, pushing analytics below the first viewport. Consolidate identity/search/context before adding new widgets.
- Desktop can support multiple columns, but components must have sufficient usable width. At the inspected width, the Advanced table already requires horizontal scrolling; that is acceptable when intentional and discoverable, unlike clipped charts.
- The Advanced chart visibly cuts off at its enclosing panel boundary. Its source wrappers need intrinsic/responsive sizing rather than a universal fixed-height card.
- The full-width Calendar activity grid becomes giant squares, causing extreme page height. This is a functional layout bug, not a request to redesign the visualization from scratch.
- Profile unavailable states occupy large empty regions. Keep the explanation, but give empty states appropriate height and preserve available summaries.
- Desktop should be compact and scannable, but this is a detailed player page: do not impose the RSO single-viewport constraint or force every module into an internally scrolling dashboard.

## Cross-tab correctness findings to resolve separately

Observed on this page; these are discrepancies, not verified NHL ground truth:

1. Overview availability: 11.9%, “10 of 84 possible games (74 missed).” Advanced: 100%, “10 of 10 possible games.” Future scheduled games must not automatically become absences. Define elapsed eligible team games and missing/scratch/injury states explicitly.
2. Overview and Advanced/game log show 10 games, while calendar shows 8. Source inspection identifies differing season/date handling; reconcile regular-season scope and historical dates before selecting one figure as correct.
3. Advanced profile says no valid season selected while Overview identifies 2026–27. Propagate explicit season/context consistently rather than suppressing the warning.
4. Trends summary shows SH% 0.1%; insights shows 18.2%. Desktop Gamelog also shows 0.3% on a row with 1 goal and 3 shots. Validate fraction-versus-percentage-point formatting and aggregate shooting percentage from summed goals/shots, with zero-shot handling; do not average daily percentages blindly.
5. Overview calendar displays future/missed counts while dedicated Calendar displays zero for those categories. Check whether inputs are absent or truly zero; do not infer actual schedule completeness from the UI.

## Prioritized separate agenda

### UX-1: Repair responsive containment (high priority, M)
Scope: Overview/Advanced column collapse, usable min-widths, nested padding, intentional table overflow, chart wrapper sizing. Preserve all data and controls. Acceptance: no hidden content or page-wide horizontal scrolling at 320/375/390/430px; data-table scrolling remains usable; desktop 1024/1165/1440/1920px remains balanced.

### UX-2: Repair calendar sizing and navigation (high priority, M)
Scope: resolve competing CSS specificity, compact activity-grid geometry, complete mobile month view, accessible selected-day details. Acceptance: no giant activity cells on desktop, no partial inaccessible months on mobile, readable weekday labels and state distinctions.

### DATA-1: Align statistics and context contracts (high priority, M)
Scope: season propagation, played/missed/future denominators, percentage units and aggregation, calendar versus log scope. Acceptance: deterministic fixtures across all five tabs for early season, no games, no shots, partial provider data and historical season. Do not repair production records in this UX work.

### UX-3: Simplify navigation and controls (medium priority, S/M)
Scope: compact identity/header, legible tabs, time-window controls, statistic presets plus expandable advanced selections. Acceptance: all current selections remain available and consistent; selected state is clear; focus order and touch targets work without hover.

### UX-4: Improve analytical hierarchy (medium priority, M)
Scope: Overview answers first, compact summaries, chart units/legends, non-redundant calendar preview, honest compact empty states. Await mockup direction where it affects layout or visual style.

### QA-1: Complete responsive/accessibility evidence (required before acceptance, M)
Scope: all five tabs, defined viewport matrix, keyboard, touch/VoiceOver, text zoom, long names, missing stats and image/error states. Test actual scrolling, chart tooltips, calendar date selection, glossary and tab/filter state preservation. Screenshot review alone is insufficient.

## Design decisions to keep open for TJ’s mockups

- Compact mobile header versus a more prominent player identity hero.
- Always-visible tabs versus a scrollable tab strip; retain understandable labels.
- Compact overview calendar preview versus removing that duplication in favor of the dedicated tab.
- Statistics presets and collapsed advanced controls versus an always-visible selection panel.
- Chart grouping and summary treatment, while preserving the existing data contract.

These choices do not block identifying structural bugs. They do block declaring a final redesign accepted. No implementation worker, deploy, data repair or new migration is authorized by this agenda.

## Recommended work order

Confirm this inventory and optional mockup direction → lock the cross-tab data/context contract → fix responsive containers and calendar cascade → refine hierarchy and controls → run the viewport/accessibility matrix → TJ review → separately approved release.

Keep correctness and layout as separately reviewable changes; coordinate shared files before assigning workers. Recheck the latest local work before implementation because the cloud checkout cannot see TJ’s uncommitted laptop edits.

## Source evidence for implementation planning

Paths relative to the cloud repository at commit `62003323`; deployment commit not verified.

- `web/pages/stats/player/[playerId].tsx:237–255`: five-tab routing; `:262–397`: Overview; `:401–414`: Advanced props; `:417–519`: Trends; `:522–620`: Calendar; `:624–635`: Gamelog.
- `web/components/PlayerStats/PlayerStats.module.scss:109–156`: 95% shell without a maximum width, unconditionally 40%/60% Overview columns and two-column Advanced grid. `:398–411`: 300/400px minimum control widths. `:338–354`: tab row lacks wrapping/scrolling adaptation.
- Same SCSS `:1682–1738`: three-column monthly calendar with 35px minimum day widths. Approximate intrinsic requirement is 873px before outer calendar padding; it is also embedded in the narrower Overview column.
- Same SCSS `:1995–2190` versus `:2443–2498,2761–2889`: early contribution-day selector has six classes, later fixed-size/responsive selectors five. In-memory compilation with installed Sass confirmed specificity. Earlier width:100% and aspect-ratio rules defeat later small-cell intentions. Repair the cascade, not just append another mobile rule.
- `web/styles/vars.scss:774–781`: shared card mixin uses overflow:hidden. `PlayerStats.module.scss:723–747`: 400px chart wrappers. `web/components/PlayerStats/PlayerAdvancedStats.tsx:77–98` nests wrappers and full radar content, supporting the clipping diagnosis.
- `PlayerAdvancedStats.tsx:90–98` omits radar season/window/fallback props; compare route `:349–358`. `PlayerRadarChart.tsx:225–239` rejects absent/invalid season context.
- Overview passes missed games at route `:362–370`; Advanced invocation `:401–414` omits them and component defaults to empty (`PlayerAdvancedStats.tsx:40`). `web/hooks/useMissedGames.ts:32–34` clears on missing season. `PlayerContextualStats.tsx:80–116` computes availability from played+missed; this is not validation of the underlying missed-game classification.
- `PlayerPerformanceHeatmap.tsx:553–599`: additional date-derived season filtering. `PlayerStatsSummary.tsx:33–43` computes game-weighted mean of raw percentage values and substitutes zero for null; `types.ts:355` appends a percent sign. `PlayerContextualStats.tsx:229–261,299` instead derives shooting percentage from goals/shots. Unit and aggregation fixtures are essential.
- `PlayerPerformanceHeatmap.tsx:439–448,1153–1159,1378–1407`: hover-based information access; `:955–962` positions tooltips without viewport collision handling. `PlayerLineupDeploymentGrid.tsx:53–64` relies on title text for details.
- `PlayerStatsTable.tsx:304–308`: missed-game image references absent sizing class; source PNG is 512×512. This is a conditional risk, not an observed defect in the supplied screenshots. Include missed-game fixtures before acceptance.
- `PlayerStatsChart.tsx:58–79,222–261`: selected metrics share a single y-axis without unit separation.
- Existing `web/__tests__/pages/stats/player/playerId.test.ts:14–17,53–97` mocks presentation components; passing it would not prove responsive layout. No application test suite was run for this analysis.

Verification completed: all four supplied images inspected, all five desktop tab states inspected, bounded source review and in-memory stylesheet compilation, and clean repository status. The agenda itself is saved separately from the repo/task-list branch. Device-width matrix and data correctness remain pending execution.
