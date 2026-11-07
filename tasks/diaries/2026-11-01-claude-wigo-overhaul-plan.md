# 2026-11-01 claude: WiGO Charts overhaul planning thread

## Scope
Plan and audit only. TJ drives this thread. Deliver `PLAN.md` and `EXECUTOR-PROMPT.md` in `tasks/artifacts/wigo-charts-overhaul-2026-11-01/`. No application code; TJ starts the implementation thread personally.

## Where
Checkout on `octoberBranch`. No git mutations so far.

## State (orient done)
- Page: `web/pages/wigoCharts.tsx`; grid in `web/styles/wigoCharts.module.scss:1991+`. `web/components/WiGO/wigoCharts.module.scss` is a small separate file (45 lines).
- 10-30 declutter: 14 commits, on `octoberBranch`, NOT on `master` (master is 545 behind, 0 ahead). Top pass commit `14c19c319`.
- Leases: WIGO-UI-PASS is the last WiGO writer lease (work done). No active WiGO holder found in Codex's active exact leases. SS-EXPANSION reads `components/WiGO/**` read-only.
- No dirty files under `web/components/WiGO`, `web/pages/wigoCharts.tsx` or `web/styles/wigoCharts.module.scss` at start.
- TJ's "no-scroll at >=1280" decision (10-25, `LAYOUT-PLAN.md`) conflicts with this brief's chart room goal. Needs an explicit reversal.
- `e2e/wigo-one-page.spec.ts` pins the no-scroll fit and the two transposed halves. The executor has to rewrite those tests on purpose.
- Axe MCP server still down at orient (ToolSearch found nothing). Report the check as not run.

## Settled by TJ (pop-ups, 11-01)
Keep no-scroll. Workspace 95% on this page. One 36-column table band, periods as rows, DIFF bottom row, compare dropdowns in the toolbar. Charts one row of four. Bio group plus doughnut/radar and ratings/drivers to its right. Phone keeps tabs, regrouped. Approved: 40 prod SELECTs (B 20, C 20), 6 local page loads (D), players picked from data, all five lanes. Full scope in `audits/BRIEF.md`.

Second round (11-01): top block revised by TJ: columns identity+prod/doughnut, pace, list (rate percentiles span pace+list in row 2), ratings/drivers, radar 2 rows tall. Phone regroup approved. Slow views: executor drafts a local migration, TJ approves applying. AS: make real (local migration for approval), junk fallback removed now. PTS1/60 moves to Per 60 as PTS1. Game log: bars for counts, straight lines for rates, real gaps.

## Audit status
A to E reports in `audits/`, read by me. Checked in code: writer id order and flush, `invalidFrame` rejection, TOI summing, `safeDivide` zero path, `maxDuration` 240, no `retry` on ratings query, 3-attempt pager, AS default and fallback, 300 s schedule poll, bare `QueryClient`. L2 screenshot shows ratings error, 16 tiles at 50%, blank L-window rates. B's 97 unwritten skaters = C's 84 stale + 13 no row. Ledger: 24 B, 20 C, 6 D, all SELECT.
Cross-lane catch: C says "default to ES", but D shows the ES views time out from the browser; only C's privileged reads succeeded. So ES depends on the slow-view migration.

Third round (11-01): revised grid measured and approved. F/D stays pooled, stated on panels. `PP%` label stays, defined in hover/help. Order: code first, UI alongside.

## Next
`PLAN.md` and `EXECUTOR-PROMPT.md` written, uncommitted (not asked to commit). TJ starts the implementation thread. Keep this diary until that thread takes over.

## Blockers
None yet.

## Gotchas
- Goalies are excluded from search (A-05), so a goalie test player does not apply.
- 36 metrics as columns cannot fit one row at 1296 px (about 34 px a column).
