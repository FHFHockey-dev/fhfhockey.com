# L6 canonical integration — local patch applied, browser acceptance blocked

**Latest status:** Chef subsequently launched the browser successfully and observed real layout overflow. One page-style repair is now applied and awaits Chef rerun; see `LAYOUT-REPAIR.md` and `REPAIR-PINS.json`. The launch restriction below is historical worker evidence, not the current blocker.

Custodian explicitly released the old WIGO claim in `/Users/tim/Documents/Codex/2026-11-04/task-7/custodian-coordination/CUSTODIAN-RESPONSE.md` section 4. Chef granted exactly nine local paths. Before writing, all nine SHA-256 pins matched and their targeted diff was empty on `octoberBranch` HEAD `1fe279d3a2c1340ea85334cbcabb8626f6e8b910`.

Applied Chef's corrected `candidate-with-explicit-meter-role.patch`, not the old worker patch. All five installed files initially matched Chef's final candidate hashes. The only subsequent code changes are in the granted E2E spec: offline font interception, browser page/console diagnostic attachments, and an after-hook guard for failure before page setup. No assertions were weakened. Final exact source hashes and evidence hashes are in `FINAL-RECEIPT.json`; `canonical-final.patch` contains the complete final five-file diff against the baseline.

Changed application/test paths:

- `web/styles/wigoCharts.module.scss`
- `web/components/WiGO/PlayerRatingsDisplay.tsx`
- `web/components/WiGO/PlayerRatingsDisplay.module.scss`
- `web/components/WiGO/PlayerRatingsDisplay.test.tsx`
- `web/e2e/wigo-one-page.spec.ts`

The other four granted paths remain byte-identical. Matrix data/math, existing full consistency doughnut and bucket logic, fetchers, source fixtures, handlers, shared shell/styles/config, and dependencies were not edited. WiGO remains outside the 69-path composition. No staging, index/ref/commit/branch/worktree operation, push, deployment, migration or provider/database operation was performed.

## Evidence

**Canonical focused unit tests: 26/26 passed, five files.** Command from `web/`, under an atomically acquired `/private/tmp/fhfh-heavy.lock`:

`./node_modules/.bin/vitest run --configLoader native components/WiGO/PlayerRatingsDisplay.test.tsx components/WiGO/WigoDashboardSections.test.tsx __tests__/pages/wigoCharts.test.tsx components/WiGO/ConsistencyChart.test.tsx components/WiGO/WigoComparisonMatrix.test.tsx --maxWorkers=1 --minWorkers=1`

Full output: `canonical-unit.log`. Covers installed ratings, unavailable/cohort behavior, panel grouping/memoization, page behavior, existing outlier/Cardio consistency semantics and matrix freshness/mobile states. Reused Chef's seven synthetic actual-component tests, scoped typecheck/lint and 38 Chromium rating checks from `wigo-runtime-check/FINAL-RECEIPT.json`; these remain component evidence, not full dashboard evidence.

**Browser integration: blocked before opening a page.** The existing 13-test WiGO spec was invoked with one worker, no retries, and stop after the first failure. Chromium launch failed with `bootstrap_check_in … MachPortRendezvousServer … Permission denied (1100)` and SIGTRAP. One launch failure, twelve tests not run. No desktop/mobile hydration, geometry, overflow, interactive comparison, chart rendering, console cleanliness or screenshots were observed. Logs: `browser-run.log`, `browser-results.json`, `browser-results/`. The initial after-hook guard was corrected after the launch failure; no second browser attempt was made because an application change cannot fix this process-permission boundary.

**Isolated local shell: HTTP 200.** After browser launch was blocked, one bounded loopback-only GET to `/wigoCharts` compiled the actual route in 5.9s and returned 17,595 bytes including WiGO identity. See `server.log` and `shell-response.html`. This verifies route compilation/SSR response only, not client rendering or data-panel population.

**Scoped E2E lint: passed with zero warnings.** `./node_modules/.bin/eslint e2e/wigo-one-page.spec.ts --max-warnings=0`. Final targeted diff whitespace check passed. No full build/typecheck/suite was run.

## Isolation and cleanup

Used Node 22.11.0, dummy public/service settings and a minimal child environment. A local preload denied non-loopback Node connections/fetch and prevented reads of ignored `.env*` files. The browser suite's existing PostgREST/season/schedule fixtures remain intact; added interception closes their public-font exception. Server startup initially rejected an undefined CMS rewrite; supplied a dummy loopback `CMS_URL` without editing application config. The accepted unit run was reused after that startup-only correction.

Only owned server port 3186/process group was started and stopped; TJ's server was not touched. Server startup attempted a Next version-check fetch to npm; preload denied it before transfer, recorded in `server-network-denials.jsonl`. No provider/production traffic occurred. The isolated server and shared lock were released, confirmed by controller completion and lock absence. Existing dirty `web/next-env.d.ts` was observed at task start and left outside this patch; no claim is made that its pre-existing change belongs to L6.

## Remaining acceptance

Chef must run the existing offline spec in a runtime that permits Chromium to start, with the same fixture/network isolation. Preserve its desktop no-overflow/text/coverage, long-name, help/Escape, comparison interaction, phone matrix/pinned-context and flow-mode assertions. Review desktop/mobile screenshots and actual consistency/chart content before accepting the new geometry. There is no visual-match or final-design sign-off claim; exact dark raster identity is known but bytes remain uninspected here. No application layout repair was attempted without browser evidence.
