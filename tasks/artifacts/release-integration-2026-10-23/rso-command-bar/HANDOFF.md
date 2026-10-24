# RSO command-bar clipping correction

**Implemented; isolated browser regression passed. Full account-case acceptance remains blocked by a separately observed notice overlay.** The test owner reproduced an enabled Refresh provider button outside the viewport at the preserved 1180×757 connected-account viewport; Save to account is clipped. The release owner read the original click trace and viewed its screenshot. This is a real layout failure, unlike the superseded summary-card assertion.

Only `web/components/RosterScheduleOptimizer/RosterScheduleOptimizer.module.scss` changed, in two existing rules. The outer `.navBar` can now wrap at any width when its contents require it. Its `.commandActions` group can shrink and wrap within the available width. No action was hidden, forced, renamed or disabled; no JSX, forecast, provider or entitlement code changed. Source was clean before this exact lease.

The original SCSS is retained as `before.scss`. `CANDIDATE.json` records old/new hashes and the exact `candidate.patch`. `git diff --check` and `node --check regression.mjs` passed. Actual Sass and Chromium verification completed successfully under Node22.11.0/npm10.9.0, session46495 exit0. RESULT.json records original1180px document overflow1468px and four outside controls; all six corrected widths contain every control. Twelve normal Refresh/Save clicks were asserted and six keyboard Enter exercises executed. There were zero requests. Screenshots at1180 and320 were viewed. This synthetic-markup check does not establish full application acceptance.

The prepared `regression.mjs` compiles actual before/current SCSS against synthetic connected command-bar markup with all account actions. It requires the original 1180px overflow, checks corrected containment at six widths, and uses normal Refresh/Save clicks and keyboard activation. It blocks all requests and launches no HTTP server or Next instance. This is a supplementary CSS regression; it cannot replace the actual application case.

The original worker run finished naturally. The release-owned regression has completed and released its own matching lock; no release-owned process remains. Do not repeat this successful regression merely for status. The worker overlaid only the exact pinned SCSS in its isolated export and reports normal1180×757 Refresh/Save reachability and permissions/exclusions/account-switch cancellation passing. Later in that account case, a separate notice intercepts Continue manually; the original60-second failure and trace remain preserved. Full application acceptance is still open. The run passed8/10, including all three corrected summary-card cases and three category cases.

Reproduction command already run (cwd `web/`):

```sh
/usr/bin/env -i PATH=/usr/local/bin:/usr/bin:/bin HOME=/tmp/fhfh-rso-command-bar-home TMPDIR=/tmp PLAYWRIGHT_BROWSERS_PATH=/Users/tim/Library/Caches/ms-playwright npm_config_offline=true npm_config_update_notifier=false npm_config_audit=false npm_config_fund=false npm exec --offline --no -- node ../tasks/artifacts/release-integration-2026-10-23/rso-command-bar/regression.mjs
```

Next safe action: inspect the worker's preserved notice-overlay trace and the existing notice CSS before any further runtime edit; keep fixture paths with their current owner and preserve this candidate version.

The command takes its own atomic heavy lock and releases only its matching token/inode. If Chromium is sandbox-blocked, use the supported approval path; do not bypass a denial. Preserve the candidate if verification fails; inspect the actual geometry before another edit. Independent application verification and parent acceptance remain required. No Git/index, provider, production, migration, dependency or deployment action occurred.
