# 2026-10-30 claude: WIGO UI pass (visual declutter)

## Scope
Declutter wigoCharts in place (presentation only), step by step with TJ approval, same format as the RSO pass. Lease WIGO-UI-PASS.

## Where
Branch octoberBranch. Artifacts: tasks/artifacts/wigo-visual-pass-2026-10-30/ (AUDIT, STEPS, screens, tools). Dev server: :3150 isolated (.next-playwright) with net-deny preload.

## State
All 12 steps approved by TJ and committed locally; end checks passed (see STEPS.md). Nothing pushed. Dev server :3150 stopped.

## Next
Report SHAs to the orchestrator. TJ's :3000 was found down at the end of the pass (see the incident in STEPS.md).

## Blockers
None for the pass.

## Gotchas
- Phone rules above base rules in wigoCharts.module.scss lose on source order; new phone rules go in the block at the end of the file.
- Canvas fonts need a generic fallback ("Roboto Condensed, sans-serif") or they paint serif.
- Phone full-page captures hide the fixed nav; step0 phone shots still have it.
- TJ keeps brand elements: the "What Is Going On" italic caps tagline stays. Do not flatten branding; ask first.
- Do not widen controls just to fill freed space (search capped at 340 px).
- Do not run the e2e with PLAYWRIGHT_PORT on a port with a running server: its webServer clobbers .next-playwright and that server returns 404/500. Use PLAYWRIGHT_BASE_URL + PLAYWRIGHT_SKIP_WEB_SERVER=1 against the running server.
- Never use a broad pkill for next-server: kill only the PIDs of your own server. See the incident in STEPS.md.
- The brief's PLAYWRIGHT_PORT form cannot work with net-deny: webServer waits on "/" which returns 500 when denied.
