# CHANGES REQUIRED — slice 04 DOM preview

One **P2 finding, S04-R1**: rounding can label unfinished work “100.0% complete.” Author's eight DOM tests pass; five of six independent controls pass. No other tested rendering, sealing, health-state or no-I/O defect reproduced. This is a source/DOM review only, with no visual/screenshot acceptance.

## S04-R1 — one-decimal formatting claims completion while a unit is pending

`web/lib/forge-testing-grounds/preview/TestingGroundsPreview.tsx:43` uses `stage.percent.toFixed(1)` followed by `% complete`. A valid running stage with eligible=10000, successful=9999, skipped=0, failed=0, pending=1 produces:

- Correct numeric work/bar attributes: value=9999, max=10000.
- Correct underlying percentage: 99.99.
- **Incorrect displayed completion label: `100.0% complete`.**

Expected: an incomplete stage must not be labeled 100% complete. The exact failing control is preserved in [boundaries.test.tsx](boundaries.test.tsx), `[S04-R1]`, with original assertion/output in [dom-boundaries.log](dom-boundaries.log). The ten fixed scenarios do not reach this near-completion rounding edge; the exported panel accepts the general validated operational envelope, and this counterexample is valid under that contract.

This is a bounded presentation error, not a false successful run, data corruption or a model-score leak. Correct percentage formatting so rounding cannot imply complete work before completed=eligible, retain a regression, and regenerate the owned standalone artifact in a new receipt. No helper, timestamp, runner, auth or broad UI refactor is needed. No correction or retry was made by this reviewer.

## Four-file scope and exact pins

All four new application files match the frozen slice04 candidate. Canonical `octoberBranch` HEAD `2a5092d37cb863ec92a2a4e609999cf226bfa4a5`; no candidate commit exists.

| File under `web/lib/forge-testing-grounds/preview/` | SHA-256 |
| --- | --- |
| `TestingGroundsPreview.tsx` | `fcfaaef571427d0304b1da4a809489de0fd9cb780da915cc8dfa4ded371532c9` |
| `TestingGroundsPreview.module.scss` | `d810009a51f0385837c270f59cbb7d2861050f9f59b836b608fca9847ed6cf74` |
| `previewFixtures.ts` | `78a34b4eb07a588b95b0f6876152f1cd3fa4527bf35a6edcec5fc63cb551ddea` |
| `TestingGroundsPreview.test.tsx` | `b0387ad5842fe963a1d5f0d41a09a018c4d13b7311cebd6a7ff2dfa653be0c22` |

Across 82 recorded pins, **79 directly match** and three historical protected runner pins match their **parent-accepted S03-R1 replacements**: runnerContracts.ts, memoryRunStore.ts and boundedWorker.test.ts. Their before/after identities agree with the frozen accepted S03-R1 receipt. They are not runtime preview imports. All 4 candidate, 26 dependency, 2 reference and 5 owner-artifact pins directly match; no unexplained mismatch or start/end drift. Owner EVIDENCE remains unchanged. Full reconciliation in [PINS.start.json](PINS.start.json) / [PINS.end.json](PINS.end.json); do not flatten this to “82 original pins match.”

The component imports only React, scoped styles, pure operational/health/fixture helpers; no runner/store/auth/API/live-data modules. Ten fixed September scenarios are clearly labeled synthetic. No production route/navigation or durable launch was introduced in this packet.

## Boundary checks that passed

- Stage bars use terminal work counts with declared eligible denominators; pre-stage exclusions remain separate. Zero totals show no fabricated bar/percentage. Fitting has no percentage. Pending evaluation keeps failed=0; all-failed terminal work can be 100% processed while status/counters remain failed, not successful.
- Empty selection has no fabricated health report. Blocked health retains distinct zero/missing/null categories and safe ID samples. A failed worker does not automatically mark its separate input-health report blocked; its queued evaluation remains pending. These are fixed fixture states, not verification of asynchronous health-request failure/loading/recheck behavior.
- Poison fields at top-level, stage, denominator and counter levels, and malformed HTML-like timestamps, fail closed with a generic message and no operational JSON or reflected poison. Health report strings containing `<svg onload=...>` render as escaped text without creating SVG/script/event-handler DOM. This demonstrates React text rendering, not approval to send sealed outcome-bearing report data.
- Operational JSON stays collapsed by default, parses to the strict projection and contains no score/result/payload fields. Complete fixture work remains sealed and exposes no reveal, result-export or model-quality controls. Input-health counts are safe only because the adapter receives synthetic input rows; arbitrary outcome-derived counts would still be a disclosure risk.
- Across all ten scenarios, independent guards observed zero fetch, XMLHttpRequest, WebSocket, sendBeacon, window.open or storage set/remove calls. Launch is disabled and source has no launch handler. There are no navigation anchors/forms/remote resource elements in the rendered component, and labels explain that no job runs, nothing is saved and work does not continue after closing.

No runtime polling, capture, automatic repair/exclusion, clipboard permission or real owner/session/launch integration is present. Unknown/malformed real reports, clean issue-free health views and asynchronous health lifecycle are not established by the fixed catalog; those need their own future contracts/integration checks, not inferred acceptance here.

## Standalone artifact and visual limits

The unchanged generated `preview.html` is 236107 bytes, SHA-256 `cfe211db8833cbd2b566c9c1b43a0bf8da7abd21b7df63b1756ca2bbdebea15c`. Static HTML inspection finds one inline script, no external resource attributes/CSS URL references, and CSP `connect-src 'none'` / `form-action 'none'`. Renderer source escapes closing script/style tags and uses automatic JSX. [ARTIFACT-STATIC.json](ARTIFACT-STATIC.json) records those checks.

This review did **not** rebuild or execute the standalone script, start a server/browser, acquire a browser slot, or validate CSP enforcement in an actual browser. Author's retained corrected jsdom artifact execution remains owner evidence. CSS source declares responsive stacking/focus/control sizing, but DOM tests do not prove rendered layout, contrast, font metrics, screenshots, native details behavior, keyboard/touch interaction, mobile readability or performance. No such visual/accessibility acceptance is claimed.

## Commands and original failures

Cwd `web/`, existing Node 22.11.0/npm 10.9.0; exact argv/timings and artifact-local cache/log overrides in [COMMANDS.json](COMMANDS.json).

```sh
npm test -- --run --config ../tasks/artifacts/forge-testing-grounds-2026-10-24/slice-04-review/review.vitest.config.mts --maxWorkers=1 --no-file-parallelism
```

**Failed, exit 1: 13 passed / 1 failed.** Owner DOM tests 8/8; independent controls 5/6. One invocation; S04-R1 failure/assertion retained without weakening or self-repair. Punycode warning retained. Actual output in dom-boundaries.log.

```sh
npx --no-install tsc --noEmit --strict --skipLibCheck --target es2015 --lib dom,dom.iterable,esnext --module esnext --moduleResolution bundler --esModuleInterop --jsx react-jsx next-bootstrap.d.ts lib/forge-testing-grounds/preview/TestingGroundsPreview.tsx lib/forge-testing-grounds/preview/previewFixtures.ts lib/forge-testing-grounds/preview/TestingGroundsPreview.test.tsx
npx --no-install eslint --report-unused-disable-directives-severity warn lib/forge-testing-grounds/preview/TestingGroundsPreview.tsx lib/forge-testing-grounds/preview/previewFixtures.ts lib/forge-testing-grounds/preview/TestingGroundsPreview.test.tsx
```

**Passed, exit 0 each**, empty [scoped-ts.log](scoped-ts.log) / [scoped-lint.log](scoped-lint.log). Owner's original ambiguous DOM selector failure and `React is not defined` standalone execution failure remain in the unchanged owner checks.log. The current selector still asserts the intended sealed label within its named region; renderer now requests automatic JSX. No historical failure was erased or reclassified as a pass.

Only reviewer artifacts and existing diary append changed. No application/renderer/old-evidence/shared config/package/route/auth/migration/coordination/master/ledger or Git mutation; no production/provider/paid call, browser/server/full suite or new worker. No check blocked, denied or running. Return an exact frozen owner correction for S04-R1; Scout retains acceptance. S03-R1's local acceptance and E+W resource qualification are preserved and were not retested.
