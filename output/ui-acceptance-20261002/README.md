# Local UI acceptance review — 2026-10-02

Review-only outcome: Underlying Stats 320px acceptance and Starter Board selected scenarios pass. Shift Chart desktop acceptance remains open because of two reproduced sizing failures. No application-source edits, commits, merges, builds, pushes, deployments, production writes, or original implementation work were performed.

The tested source is a frozen, credential-free copy at `/tmp/fhfh-ui-acceptance-20261002/web`, served only on `http://127.0.0.1:3198`. The server was stopped after verification. Dependencies were locally cloned from the existing installation; no install or lockfile change. A dependency symlink initially caused duplicate React resolution; replacing it with the isolated dependency copy resolved that setup error before acceptance execution. The normal sandbox blocked listening and Chromium; supported escalated execution was approved. Chromium actually executed all reported browser checks.

## Source identity and supported history

Repository HEAD: `73af9d051ecc755dd3695f5265bf5837bbfc7a4e`. The checkout contains owner changes, so HEAD alone is insufficient. [source-hashes.json](source-hashes.json) contains exact tested SHA-256 values for 28 scoped application/fixture files and their comparison to current source at report time; all match. [source-manifest.json](source-manifest.json) contains the full 3,405-file copied inventory captured before harness modifications. The snapshot's E2E harness additions are preserved in [harness](harness); application files were unchanged.

Read the requested Underlying Stats head and verification threads, Shift Chart refinement thread, and both Starter Board UI threads. Their final reports already establish completed implementation work, so this review did not resume those goals. The six files identified by the newer `output/underlying-stats-320px-20261002/browser-receipt.json` match current source exactly. Its already-passed local browser evidence supersedes the older blocked verifier report.

Repository `AGENTS.md` and `mise-en-place.md` were read. No repository or relevant parent/home `.agents` directory was present at the checked locations. The browser-verification skill was read; its `agent-browser` CLI is unavailable, so the repository's Playwright tooling supplied the rendered verification.

## Passed browser coverage

**Underlying Stats: 4 independent current-snapshot cases at 320×800.** Team Rankings, Advanced, and all-team defaults; keyboard Tab/Enter/Space disclosure interaction with retained visible focus; expanded readiness width and document containment; no runtime page errors. Panel x=8..312, width=304, client/scroll width=302; body/document width=320. Evidence: [browser-receipt.json](browser-receipt.json), [expanded-readiness.png](expanded-readiness.png), [trace.zip](trace.zip).

**Readiness duplication decision:** the newest head-thread brief explicitly says to retain per-dataset statuses, dates, and row counts and keep the header as the single *always-visible* summary. The expanded Team snapshot row repeats the team date/count, as intended dataset detail. Browser checks establish that it disappears when the disclosure closes while the header remains visible. Under that supported requirement, the earlier ambiguity is resolved and the local readiness gate is closed. This does not silently impose the older, stricter reading that would prohibit duplicated detail even when expanded.

**Starter Board: all 7 selected scenarios pass.** Full workflows at 1440×900, 1024×768, 390×844, and 320×568 cover five-row previews, View all, player filtering, expandable lineup deployment, keyboard/mobile position tabs, URL intent, and requested/resolved-date fallback. State tests at 1180px and 390px cover loading, truthful unavailable error, keyboard-visible Retry focus and Enter activation, recovery into partial/upcoming coverage, no projections, and no scheduled games. The reference preview/goals-chart scenario also runs at 1440×900, 1180×757, 1024×768, 768×1024, 390×844, and 320×844, checking 5/10-game data. All selected checks report no document horizontal overflow, runtime page errors, or framework overlays.

Screenshots include desktop/mobile initial views, loading, error, keyboard retry, partial upcoming, and empty games under `browser-results/start-chart-*`. Exact test results: [playwright-report.json](playwright-report.json). Every selected scenario has a `trace.zip` and `page-evidence.json`.

**Shift Chart: 4 selected behavior scenarios pass.** Deep-link game data, replay controls, active sorting, position filters and one data load; request retry; contained responsive chart scrolling and reduced-motion keyboard seeking at 1664/1024/768/390px; loading and missing shifts. Full-roster fixture confirms 40 player rows, two 18×18 matrices/648 cells. Full desktop acceptance passes at 1920×1080 (stacked timelines, minimum cell 18.078125px) and 1728×900 (side-by-side timelines, minimum cell 13.078125px), including visible bounds and no page/panel overflow.

Overall original selected suite: **11 passed, 1 failed**. Two additional diagnostic executions completed after the failure: one measured all desktop sizes and finished overtime seeking, playback speed, matrix modes, tooltip/keyboard controls, and 390px mobile containment; the other isolated 1440px geometry. Their passing execution means measurements were captured; it does not override the failed acceptance criteria. An earlier diagnostic sampled before resize observers settled and failed; `diagnostic-results` preserves it, and `diagnostic-settled-results` contains the corrected settled measurements.

## Actionable reproduced Shift Chart findings

1. **1440×900 right matrix/document overflow.** Open `/shiftChart?gameId=2026010054` with `fullRosterFixture(2026010054, true)` via the existing spec's intercepted `/api/cors` responses. After settling, document width is **1462px** for a 1440px viewport; height remains 900. The page width is 1462.265625px, grid right edge 1452.265625px, and matrices right edge 1441.21875px. In the isolated geometry capture, 37 matrix/label/footer elements extend outside viewport bounds. The final matrix column is partly beyond the visible edge, matching the screenshot. Inspect the desktop shell/page/grid intrinsic sizing in `web/styles/ShiftChart.module.scss:687` and the Shift Chart shell rule in `web/components/Layout/Layout.module.scss:151`. Preserve complete rows and matrices while constraining the workspace to the viewport. Evidence: `geometry-results/*/1440-geometry.json`, `1440-clipping.png`, trace; also `diagnostic-settled-results/*/fit-1440.json` and `shift-chart-1440.png`.

2. **1708×864 matrix minimum misses the existing 12px criterion.** Same fixture and route. Cells remain square but measure **11.96875×11.96875px**. Document and panels fit, all rows remain visible, and square difference is zero. This is a 0.03125px acceptance-threshold failure rather than a nonsquare-cell defect. The existing test's `squareCells` boolean combines shape and minimum size. Inspect the flooring/sizing calculation at `web/components/LinemateMatrix/index.tsx:667` and available vertical space in its desktop styles. Evidence: original failing test screenshot/error context/trace in `browser-results/shift-chart-full-rosters-*`; settled `fit-1708.json` and `shift-chart-1708.png`.

No actionable Starter Board or Underlying Stats defect was reproduced within the selected coverage. No source fix was attempted.

## Reproduction

The isolated snapshot and harness remain available. From `/tmp/fhfh-ui-acceptance-20261002/web`, start the development server with the fake local variables used during review:

```sh
CMS_URL=http://127.0.0.1:3198 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:3198 NEXT_PUBLIC_SUPABASE_PUBLIC_KEY=ui-acceptance-fixture-only NEXT_PUBLIC_SUPABASE_ANON_KEY=ui-acceptance-fixture-only SUPABASE_URL=http://127.0.0.1:3198 SUPABASE_ANON_KEY=ui-acceptance-fixture-only NEXT_TELEMETRY_DISABLED=1 WATCHPACK_POLLING=true WATCHPACK_POLLING_INTERVAL=1000 ./node_modules/.bin/next dev -H 127.0.0.1 -p 3198
```

In a second terminal in that directory, reproduce only the original failed acceptance:

```sh
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:3198 NEXT_PUBLIC_SUPABASE_PUBLIC_KEY=ui-acceptance-fixture-only ./node_modules/.bin/playwright test --config=acceptance.config.ts e2e/shift-chart.spec.ts --grep 'full rosters and overtime'
```

Unknown API calls and non-GET/HEAD operations are locally fulfilled by the context safety fixture; the selected test-specific APIs are fulfilled by the established fixtures. External requests are locally fulfilled, with blank external font CSS and image placeholders. No remote API or authenticated session is needed. Avoid rerunning into these evidence output paths unless intentionally replacing the report. macOS sandbox execution may require the same supported escalation used here.

## Limits and remaining gates

External production fonts, live/historical data, real headshots/logos, authenticated Yahoo, browser speech output, and production release state were not verified. API upstream execution is intentionally outside the fixture-based checks. External font omission can affect geometry; the failures describe the precise local fixture rendering, not a measured production defect. No application suites, TypeScript/lint, or production builds were needed for this review-only task. No Rankings/RSO or avatar/WiGO surface was navigated or reviewed.

There are no remaining environment blockers to these executed checks. Shift Chart's two sizing findings remain with its owner. Local success does not establish production release or ongoing source freshness; the recorded hash comparison applies only at report time.
