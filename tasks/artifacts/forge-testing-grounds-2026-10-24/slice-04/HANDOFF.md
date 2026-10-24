# Slice 04 — visible operational and data-health preview

2026-10-24. Canonical `octoberBranch`, base HEAD `2a5092d37cb863ec92a2a4e609999cf226bfa4a5`. **Frozen for independent review; Scout retains acceptance.** Slice03 code/receipts and previous accepted inputs are unchanged.

Open **`preview.html` in this directory** for the self-contained interactive preview. It uses inline local assets and synthetic September fixtures, blocks network connections through its CSP, and has no external resources. The Codex file-panel open request returned `queued`; visibility in the parent's window is not asserted. No Next server/build directory or browser slot was used.

## Delivered files

New application paths inside the assigned namespace:

- `web/lib/forge-testing-grounds/preview/TestingGroundsPreview.tsx`: labeled fixture shell, strict operational snapshot panel, data-health view, disabled launch and sealed-review boundary.
- `web/lib/forge-testing-grounds/preview/TestingGroundsPreview.module.scss`: existing Sass-module/token conventions, dark/cyan surfaces, responsive columns, numeric alignment, visible focus and 44px control minimums. No global style edits or animations.
- `web/lib/forge-testing-grounds/preview/previewFixtures.ts`: ten fixed September scenarios. Only synthetic rows; the health report is computed through the existing input-health checker, not fabricated report counts. Operational envelopes use the existing validated schema.
- `web/lib/forge-testing-grounds/preview/TestingGroundsPreview.test.tsx`: focused DOM/behavior tests, including every scenario and poisoned-envelope rejection.

New artifacts: this `HANDOFF.md`, `OWNERSHIP.md`, `EVIDENCE.json`, `checks.log`, `render-preview.mjs` and generated `preview.html` (236,107 bytes). The renderer uses installed esbuild/Sass, with automatic JSX matching the application transform. No dependencies were installed or changed. The task diary is working context, outside the candidate.

## Behavior and scope

The default view shows 432 completed prediction units out of 720, separated into 420 successful, 12 skipped, zero failed and 288 pending. Exclusions do not inflate completed counts. Fitting exposes elapsed time and heartbeat, never a percentage. The selector also shows preflight blocked, queued, stale heartbeat, cancellation requested, cancelled, failed, completed-but-sealed and empty states. Selecting a view is explicitly a display operation, with no job or persistence.

The health panel distinguishes valid numeric/zero, missing/null, malformed, duplicates, stale observations, identity/unit/strength mismatches and historically unavailable or later/unknown sources. Issue counts can overlap; affected rows are unique. Reconstructed history stays labeled diagnostic. Expandable issues show safe selectable IDs and manual `/db/runner` guidance. There is no runner navigation link, automatic repair, exclusion, or clipboard permission request. New inputs after repair require a new manifest/report, with the old report retained.

Operational JSON is collapsed by default and built only from the strict accepted progress projection. Unknown score/log/outcome fields cause a generic unavailable message and are not reflected. No quality metrics, outcome payloads, review/export controls, real model calls or runner/store imports are present. Even the completed scenario keeps results sealed. The launch button is disabled and explains that hosted execution and owner access are not connected and nothing continues after closing this preview.

This is partial local delivery toward Tasks 5.3–5.5 and 8.3–8.5. It is not authentication, a launchable dashboard, guided model configuration, durable progress, real health preflight, restored history, metric/chart delivery or a pilot. A static preview cannot satisfy browser-independent/phone-reopen acceptance. No original requirement is superseded or claimed complete by the synthetic UI.

## Checks and original failures

- First focused DOM run: 7/8 passed. One test's text selector matched both the fixture option and displayed status badge. Scoped the assertion to the named Work progress region, preserving the intended assertion. Final run: **8/8 passed**, 330ms tests / 849ms Vitest duration. All ten selector scenarios are exercised, including zero network requests and disabled launch.
- Scoped strict TypeScript over the three new TS/TSX files with existing Next bootstrap and repository target/libs: **passed**, no output. Scoped ESLint: **passed**, no output. Sass compiled successfully in the standalone artifact renderer.
- First artifact built but its actual jsdom execution failed with `React is not defined`: renderer defaulted to classic JSX while the app/Vitest uses automatic JSX. Corrected only the owned renderer, rebuilt, and executed the actual HTML again. Heading, blocked/sealed state changes, disabled launch, zero fetch calls, zero external resources and zero runtime errors all **passed**. This is script/DOM evidence, not a browser layout test.
- Both original failures and corrected results remain in `checks.log`. Initial discovery of guessed Forge index/style paths failed; corrected to actual `forge-dashboard`/`ForgeDashboard.module.scss` paths before implementation.
- Forty-five prior frozen source/receipt pins matched; all four new source files passed whitespace inspection. Exact candidate/dependency/artifact pins and final read-back are in `EVIDENCE.json`.
- **Not run/verified:** screenshots, browser layout at desktop/mobile widths, rendered contrast, real keyboard/touch interactions, native details behavior in a browser, live authentication, route activation, persistence, phone reconnection, full suites or production requests. There is no running server/process.

Interface skill applied: `make-interfaces-feel-better` at `/Users/tim/.codex/skills/make-interfaces-feel-better/SKILL.md`. Source/DOM scope only:

| Category | Evidence and limit |
| --- | --- |
| Typography | Reused font/color tokens, wrapping headings and tabular counts; rendered font metrics/contrast unverified. |
| Surfaces | Scoped Sass, responsive stacking, focus outlines and 44px controls inspected; no screenshot/layout claim. |
| Animation | No animation or fake progress movement; no motion inspection necessary. |
| Icons | No icon library or decorative status-only icons; every state has a text label. |
| Performance | No polling/timers/network or runner imports; one fixture projection per selection; standalone assets local. No browser performance benchmark. |

Considered and rejected: wiring an in-memory launch button (would confuse a display preview with remote execution); reusing live-data Forge cards (imports network behavior); rendering score charts with dummy outcomes (unnecessary and conflicts with the operational/sealed scope). No actionable issue remains from the performed source/DOM checks; visual/accessibility and independent acceptance remain pending.

## Exact integration request and remaining gates

The next minimal page transfer is **`web/pages/forge/testing-grounds.tsx`**, verified absent. Do not mount this preview as an authenticated product route until its server owner boundary is reviewed. An explicit page lease and a verified server principal/configured-TJ-owner integration are required; current admin/cron/local bypasses are not suitable. The local owner-policy module alone is not an activated session verifier. This route transfer request was sent through coordinator; page editing is pending, not denied, and no route operation was attempted.

No shared navigation edit is required to review this artifact. `web/components/forge-dashboard/ForgeRouteNav.tsx`, existing auth helpers, global layout, API routes, schema, cron and packages remain untouched. No live owner ID/configuration or credentials were read. Further server/API/auth/model/persistence paths need separate exact leases as their contracts settle.

Slice03 remains frozen for the already queued independent Sol review. This UI imports the earlier progress/health contracts only, so runner findings can be corrected without changing this shell. Full configure/preflight/launch/remote monitor/review acceptance still requires durable hosting, model/evaluation contracts, authoritative reveal policy and a separately approved real pilot. No denied or uncertain write is outstanding; only the queued file-panel presentation and pending future route transfer are unresolved actions.
