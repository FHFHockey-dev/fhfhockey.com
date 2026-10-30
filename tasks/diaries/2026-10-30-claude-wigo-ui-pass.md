# 2026-10-30 claude: WIGO UI pass (visual declutter)

## Scope
Declutter wigoCharts in place (presentation only), step by step with TJ approval, same format as the RSO pass. Lease WIGO-UI-PASS.

## Where
Branch octoberBranch. Artifacts: tasks/artifacts/wigo-visual-pass-2026-10-30/ (AUDIT, STEPS, screens, tools). Dev server: :3150 isolated (.next-playwright) with net-deny preload.

## State
- Lease baselines verified: 56/56 match.
- Audit done, order approved by TJ. Step 1 approved.

## Next
Step 2: panel titles.

## Blockers
None.

## Gotchas
- Phone rules above base rules in wigoCharts.module.scss lose on source order; new phone rules go in the block at the end of the file.
- Canvas fonts need a generic fallback ("Roboto Condensed, sans-serif") or they paint serif.
- Phone full-page captures hide the fixed nav; step0 phone shots still have it.
