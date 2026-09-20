# WiGO single-viewport implementation

## Audit
- Live route: `web/pages/wigoCharts.tsx` → `WigoDashboardSections.tsx` → existing WiGO components. Active page styles: `web/styles/wigoCharts.module.scss`; component-local similarly named stylesheet is dormant.
- Unrelated untracked `tasks/TASKS/wigo-charts-audit/` preserved.
- C01: Layout/Header and WigoDashboardHeader; C02–03: WigoPlayerIdentity; C04–05: PerGameStatsTable; C06: OpponentGamelog; C07: PlayerRatingsDisplay; C08–11: TeamPerformanceDrivers; C12–13: comparison/table and StatsTableRowChart; C14: ConsistencyChart; C15: CategoryCoverageChart; C16: ToiLineChart; C17: PpgLineChart; C18: GameScoreSection; C19: RateStatPercentiles.
- Canonical `WIGO_STAT_ORDER` already matches all 36 requested columns.
- DIFF: `(left - right) / abs(right) * 100`, using per-game counts and direct rates, averages and percentages. One decimal display. GP is unavailable. Both zero → 0; nonzero over zero, missing inputs or invalid GP → unavailable. Historical totals are unchanged.
- Images 1 and 2 inspected. Reuse existing panel/toolbar/chart families and tokens; do not promote new site-wide style canon.

## Implementation checklist
- [x] Three-band desktop shell and compact navigation; preserve narrow-screen workflow.
- [x] Canonical transposed matrix and permanently reserved selected-stat log.
- [x] 84-game pace, complete summary panels, radar and percentile grid.
- [x] Chart controls, source states, keyboard behavior and typography.
- [x] Targeted tests/static checks and actual 1920×1080 viewport evidence.

Implementation and local verification complete. See `report.md` for changed files, C01–C19 coverage, checks, evidence and limitations. The live radar RPC timeout remains an external data-source limitation; radar rendering is separately verified with an explicit test fixture.
