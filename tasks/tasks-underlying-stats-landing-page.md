## Relevant Files

- `web/pages/underlying-stats/index.tsx` - Main dashboard page with the quadrant map, risers/fallers, trust/context/inefficiency modules, and the lower-page supporting table.
- `web/pages/underlying-stats/indexUS.module.scss` - Page-level dashboard layout, module styling, hover-linked row treatment, and responsive behavior.
- `web/lib/underlying-stats/teamLandingRatings.ts` - Landing snapshot resolver now returning both ratings rows and the server-built dashboard summary.
- `web/lib/underlying-stats/teamLandingDashboard.ts` - Derived dashboard helper for quadrant coordinates, module slices, archetype tags, and summary notes.
- `web/components/underlying-stats/UnderlyingStatsDashboardCard.tsx` - Reusable shell for landing-page dashboard modules.
- `web/components/underlying-stats/UnderlyingStatsDashboardCard.module.scss` - Styles for the reusable dashboard-card shell.
- `web/components/underlying-stats/UnderlyingStatsQuadrantMap.tsx` - Interactive league process scatterplot with hover tooltips and guide lines.
- `web/components/underlying-stats/UnderlyingStatsQuadrantMap.module.scss` - Styling for the quadrant map, point states, and chart tooltip.
- `web/__tests__/pages/underlying-stats/index.test.tsx` - Page-level coverage for the dashboard snapshot shape, module rendering, and table integration.
- `web/lib/underlying-stats/teamLandingRatings.test.ts` - Snapshot-level coverage for the landing payload and dashboard summary wiring.
- `web/lib/underlying-stats/teamLandingDashboard.test.ts` - Targeted tests for dashboard derivation logic.

### Notes

- Reuse the current power-rating pipeline and upstream tables wherever practical; prefer new derived helpers and payload shaping over upstream rewrites.
- Bias the first release toward a trading-dashboard feel: chart-forward, modular, interactive, and useful within seconds.
- Keep the table as a supporting lower-page module; do not let it drive the information architecture.
- Follow the repo’s existing charting direction if an obvious library already exists; do not introduce a charting fork unless implementation clearly blocks on the current stack.
- Add tests for non-trivial derivation and rendering only where they materially reduce risk.

## Tasks

- [x] 1.0 Reframe the page into a dashboard-first landing-page architecture
  - [x] 1.1 Audit the current `underlying-stats` page structure and define a new information hierarchy where the first screen is led by league-wide visual summaries, not the team table.
  - [x] 1.2 Rework `web/pages/underlying-stats/index.tsx` and `indexUS.module.scss` into a terminal-style dashboard layout with a strong above-the-fold chart area, modular summary panels, and the existing team table moved lower.
  - [x] 1.3 Preserve the snapshot-date control and existing navigation, but reposition them so they support the dashboard rather than dominate it.
  - [x] 1.4 Introduce reusable dashboard/card shells and shared layout patterns so the new landing modules do not become one-off markup blocks.
  - [x] 1.5 Add desktop-first responsive behavior that collapses modules cleanly on smaller screens without breaking the core chart or the lower-page table.

- [x] 2.0 Extend the landing snapshot with dashboard-ready derived summaries
  - [x] 2.1 Review the existing `team-ratings` payload and identify the smallest viable expansion needed to power the new dashboard modules while keeping the current data pipeline intact.
  - [x] 2.2 Add league quadrant-map coordinates derived from offensive process and defensive process inputs rather than from final rank labels.
  - [x] 2.3 Add risers/fallers slices driven by recent trend deltas plus compact plain-English reasons grounded in actual rating inputs.
  - [x] 2.4 Add sustainability/trust summaries using existing scoring, goaltending, PDO, and result-vs-process context while keeping rank drivers separate from descriptive variance signals.
  - [x] 2.5 Extend schedule-context shaping beyond raw future SoS to summarize near-future difficulty, game density, rest edges, home/road tilt, and other intuitive schedule texture signals when data is available.
  - [x] 2.6 Add a market-inefficiency summary that flags teams whose surface results and underlying profile disagree most, with clearly defined comparison logic.
  - [x] 2.7 Derive lightweight archetype tags from existing metrics where the labeling is cheap, honest, and immediately useful.

- [x] 3.0 Build the league quadrant map as the primary above-the-fold chart module
  - [x] 3.1 Create a reusable scatterplot/quadrant component that renders every team in a 2D process view and feels like the central analytical read of the page.
  - [x] 3.2 Add strong hover behavior with rich tooltips that surface team identity, key process context, and a short interpretation without requiring the user to inspect the table.
  - [x] 3.3 Add crosshair, guide-line, or equivalent cursor-follow affordances if supported cleanly by the repo’s charting stack, keeping the interaction analytical rather than decorative.
  - [x] 3.4 Add concise axis labels, quadrant hints, or lightweight legend text so users can interpret the chart quickly even if they do not know the formulas by memory.
  - [x] 3.5 If low-friction within the page architecture, wire shared hover/highlight behavior between the chart and the related card or table row.

- [x] 4.0 Build the supporting dashboard modules for change, trust, context, and inefficiency
  - [x] 4.1 Add a risers/fallers module that surfaces the biggest recent movers with compact “why up / why down” copy based on rating drivers rather than eye-catching but secondary context.
  - [x] 4.2 Add a sustainability/trust module that separates process-backed teams from teams running hot, cold, or otherwise noisy.
  - [x] 4.3 Add a “what matters next” module that translates future schedule context into intuitive, glanceable league-wide signals rather than forcing users to parse SoS alone.
  - [x] 4.4 Add a market-inefficiency or under-the-radar module that highlights overperformers, underperformers, and hidden quality where process and results diverge.
  - [x] 4.5 Weave archetype tags into these modules where they sharpen interpretation without turning the page into a taxonomy exercise.
  - [x] 4.6 Standardize microcopy, labels, legends, and tooltip language across the new modules so users can quickly distinguish strength, movement, and context.

- [x] 5.0 Reintegrate the existing team table as a lower-page supporting module
  - [x] 5.1 Move the current team table below the new dashboard modules and explicitly frame it as the detailed follow-through surface rather than the main landing experience.
  - [x] 5.2 Keep the existing simplified table work where it helps readability, but remove or reposition any remaining UI that competes with the new dashboard-first hierarchy.
  - [x] 5.3 Ensure the lower-page table can still benefit from refreshed dashboard data such as narratives, schedule context, or hover-linked emphasis without adding a large new column burden.
  - [x] 5.4 Preserve or lightly refine the existing simple/advanced, tooltip, and sparkline behavior only where it supports the new landing-page architecture.

- [x] 6.0 Harden the release with loading states, targeted validation, and polish
  - [x] 6.1 Add coherent loading, empty, and error states for the new dashboard modules so the landing page remains readable even when partial data is unavailable.
  - [x] 6.2 Add focused tests for any new non-trivial derived helper logic that powers quadrant coordinates, module slices, trust classification, or market-inefficiency logic.
  - [x] 6.3 Update page-level tests to cover the new dashboard modules, their core rendering states, and the lower-page table remaining functional after the layout shift.
  - [x] 6.4 Validate desktop and smaller-screen presentation so charts, cards, tooltips, and shared highlight behavior remain legible and useful.
  - [x] 6.5 Run targeted lint/tests for the touched page, helpers, and API shaping code, then do a browser pass against a populated snapshot to confirm the page feels like a market-style league dashboard rather than a re-skinned table.

- [ ] 7.0 NEW: Clean up the missing asset request observed during live verification
  - [ ] 7.1 Investigate why `/pictures/hamburgerMenu.svg` returned `404` during the local `/underlying-stats` browser pass and either restore the asset or remove the stale reference.
