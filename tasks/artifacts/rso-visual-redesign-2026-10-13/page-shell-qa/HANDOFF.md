# Actual-shell RSO fixture QA — artifact-only handoff

All production component, CSS, provider, forecast, storage and account files were read-only for this QA consumer. The RSO functional owner separately edited and froze its eight-file slice. No compiler, application server, install, credential use, real account/provider request, commit/push, release or deployment was performed here.

## Latest mobile-tab correction recheck

The functional owner fixed the observed header/tab overlap in the ninth owned Sass path. [mobile-tabs-recheck/HANDOFF.md](mobile-tabs-recheck/HANDOFF.md) retains five successful targeted contexts, repeated mobile touch/scroll/keyboard hit testing, one1100px boundary check and exact unchanged1440px desktop geometry. All four controls now hit correctly below the56px mobile or68px boundary header. No targeted layout defect remains observed; independent acceptance is pending. The findings below describe earlier frozen checkpoints and are preserved as historical evidence.

## Outcome and remaining defect

The corrected fixture renders the actual **Layout/Header/NavbarItems**, MobileMenu/UserMenu, RSO page/Container/ClientOnly, application styles and actual planning/candidate workers. It loads the existing local Roboto Condensed font. All screenshots visibly say **FIXTURE DATA · actual page-shell styling · Synthetic account/provider state**.

Six fresh contexts cover pending provider and provider-failure/partial-warning states at **2048×1101, 1440×900 and 390×844**, with **deviceScaleFactor1/devicePixelRatio1**. Initial captures and a separate six-context qualifier-placement recheck are both retained; original visual redesign evidence was not overwritten.

A concrete placement defect was demonstrated in the initial source snapshot: the new partial qualifier occupied one desktop metric column; on mobile it sat offscreen inside the horizontal carousel at x1324, width58.375 and height112, stretching the entire metric row to136px. The functional owner moved it outside the metric grid/carousel. The recheck verifies it is a full-width persistent sibling with margin0: **2040×14 desktop2048,1432×14 desktop1440,374×28 mobile390**. Mobile metric row now measures71px. Desktop panels gain42px of vertical space; mobile panel top moves up29px. All important provisional/stale/missing evidence remains present.

**Unresolved observed defect:** at390px after scrolling past the workspace tabs, both the actual site header and the sticky workspace tabs sit at y0. Header is56px high; tabs52px high. All four tab centers at y26 hit the site header rather than their own controls. Both pending and partial-warning cases demonstrate the obstruction. See `layout-findings.json` and the final receipt's `mobile-workspace-tabs-obstructed` entries. The scrolled roster PNG shows the header while the workspace tabs are covered. This needs a separately owned product layout correction; none was made by QA. Source locations: `web/components/RosterScheduleOptimizer/RosterScheduleOptimizer.module.scss` mobileTabs sticky top0 (aroundline278) and `web/components/Layout/Header/Header.module.scss` mobileHeader sticky top0. The first batch's earlier shallow scroll check did not reach the sticky overlap; the recheck explicitly scrolls past the tabs and records hit testing.

## Screenshots

Use the **qualifier-placement-recheck/** files as the latest frozen-source captures:

- `fixture-pending-provider-2048x1101.png`, `fixture-pending-provider-1440x900.png`, `fixture-pending-provider-390x844.png` — full shell and visible notices/partial qualifier.
- Corresponding `fixture-partial-warning-*` — synthetic failed provider and retained partial inputs.
- `*-candidates.png` — first card brought into view; Net points and Net AGP are separately labeled, unavailable values remain unavailable, unranked discovery is labeled as canonical team schedule context.
- Mobile `*-roster-full.png`, `*-roster-scrolled.png`, `*-itinerary.png` — full document, the scrolled tab obstruction and horizontal schedule scrolling.

Viewport, full-page flag, visible fixture label and SHA-256 for each PNG are recorded in each receipt. The saved scripts and fixtures reproduce the captures. No Library uploads were requested or performed for these new QA images.

## Exact frozen snapshots

Initial `owner-freeze.sha256` pins eight source/test paths, main `5ed85bddd01141f253168c659363700ba2d742d2854ca8ccaa39e23a95040098`, nearest test `99852033b175bc5c10594447c8bcdc70515a793341acee2a86837082777bbc6e`. Initial `receipt.json`, frames, `source-inputs.sha256` and `qualifier-placement-finding.json` retain the demonstrated defect.

Final `qualifier-placement-recheck/owner-freeze.sha256` is byte-identical to the functional owner's final `/tmp/rso-partial-schedule-diagnosis-20261013/candidate.sha256`. Manifest SHA-256 **d268a804293ae96e1894bcfb4d7b86fbf9554bcff283e6bce6b12908a7a4d93a**. Main **92da56e80fa2a0122ea4f5a0e3e38673271c1b9ee1c65f63f9ee2be02ee55cf9**; nearest test **87a946e2b8f49a26598278634367b4ffddec18dc4bc139752a514a88407ad81c**; other six pins unchanged between checkpoints. The owner retains its incremental source patch/baselines and separate qualifier patch under `/tmp/rso-partial-schedule-diagnosis-20261013/`.

The recheck verifies all eight owner pins before and after the capture run and **80 bundled application/style/asset inputs** without drift (`source-inputs.sha256`). Production files were not edited by QA. All capture browsers closed; no active snapshot hold remains.

## Verification and limits

- Node22.11.0, React18.3.1, installed esbuild/Sass/Playwright/Chromium. No installation or full TypeScript run.
- Local font: `web/public/fonts/social-share/RobotoCondensed-Variable.ttf`,371616bytes,SHA-256 `dace262afcee68a5276f200d8026c57221735c0118ab5fda8c2c0d3dc409a8d0`. Browser FontFace status loaded, weight100–900,400/700 checks true; computed header/RSO family Roboto Condensed. Headings21px desktop/23px mobile. The fixture's body Roboto declaration falls back outside those named component families; remote font versions are not claimed identical.
- Actual header measures68px desktop/56px mobile. Desktop document dimensions equal viewport; all three panels fit with widest center. No horizontal document overflow. Mobile document scrolling and schedule horizontal scrolling work. Net metric fields do not overlap and are visually inspected after bringing cards into view.
- Final six cases exit0, zero page/console errors, no source drift. This confirms execution and placement assertions; it does **not** approve the unresolved mobile tab obstruction. `verification.json` reports that defect explicitly.
- Synthetic auth/router/access/roster/eligibility/calendar data; one locally fulfilled fake provider POST per fresh context. Local read-only Supabase fixture chains. Next Head/Link/Image wrappers and closed AuthModal are substitutes. Actual local shell logo/social assets are used; fictional team logos and the external support badge are local substitutes. No outbound network, real account or real provider requests. Unrecognized requests are blocked. No user browser/profile/storage used.
- Initial sandbox Chromium launch required approved escalation. Initial full-load wait exposed nonexistent fictional team-image fallback requests; the fixture now locally fulfills them and waits explicitly for DOM/font readiness. These harness corrections did not change application source.
- Updated screenshot reference was inspected earlier via verified Library bytes; these synthetic renders do not certify that user's CSS viewport/zoom/device ratio, genuine Yahoo account continuity, forecast qualification or production parity.

Independent review was requested for this exact frozen eight-file source slice and actual-shell evidence. Product acceptance, the mobile-tab correction and any coordinated compiler for later source revisions remain separate gates.
