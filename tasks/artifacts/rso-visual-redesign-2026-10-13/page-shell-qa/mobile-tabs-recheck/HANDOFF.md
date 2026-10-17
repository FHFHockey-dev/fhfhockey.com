# Mobile workspace tab offset — final frozen QA

Artifact-only verification of the RSO owner's nine-file frozen slice. QA did not edit production components, CSS, provider/forecast logic, accounts or storage. All previous six-context shell/qualifier evidence remains intact in the parent directories.

## Result

**Five fresh browser contexts completed, exit0, no observed layout defect in the targeted checks.** Pending provider and failed-provider/partial-warning states at390×844 and1440×900, plus one pending-provider1100×900 breakpoint case. Device scale1 throughout, local Roboto Condensed loaded, actual Layout/Header/NavbarItems and real RSO workers/components/styles; synthetic account/provider/API/calendar data and fresh isolated storage.

- At390px, the real header is56px high and sticky workspace tabs start at y56. All four tab centers at y82 hit their own controls. Each pending/partial case performs two cycles through all four workspaces with repeated scrolling and touch hits, then keyboard Enter activation.
- At1100px, the shared header is desktop/68px while RSO still uses mobile workspaces. Tabs start at y68; all four centers at y94 hit their own controls. Repeated click/scroll/keyboard activation passes in the one boundary context.
- Both1440×900 cases match the prior frozen desktop header, panel and document geometry exactly; widest center and contained three-panel frame remain. Full-width partial qualifier assertions still pass.
- Mobile schedule horizontal scrolling passes (656px content/364px view,292px scroll). At1100 the table fits (1074px content/view) and no horizontal scroll is expected. An inherited positive-scroll assertion was corrected for that boundary; this was a fixture expectation, not a product issue.
- Candidate Net points and Net AGP remain separate. Missing values stay unavailable. No page or console errors, no horizontal document overflow, no source drift. Screenshots were viewed after capture.

## Frozen identity

`owner-freeze.sha256` is the exact nine-file manifest with SHA-256 **630887197d69a44765140c60cbd84de6e6e50b243edf12e0be290fbb7e2bfc4f**. Sole changed production file from the prior eight-file checkpoint is `web/components/RosterScheduleOptimizer/RosterScheduleOptimizer.module.scss`, SHA-256 **53a0621910934d80f6693cc99cc43df9d71d4cc819ecc218ebdcfa91f51042d9**. Main remains92da56e80fa2a0122ea4f5a0e3e38673271c1b9ee1c65f63f9ee2be02ee55cf9; nearest test remains87a946e2b8f49a26598278634367b4ffddec18dc4bc139752a514a88407ad81c. Other eight pins unchanged. The functional owner retains the distinct source increment at `/tmp/rso-partial-schedule-diagnosis-20261013/mobile-tabs-review/mobile-tabs.patch`.

All nine pins checked before/after capture;80 bundled application/style/asset inputs unchanged (`source-inputs.sha256`). Capture browser closed and no source snapshot hold remains. No full compiler was run by QA; this mobile Sass-only check does not recertify other source changes' TypeScript.

## Evidence

`receipt.json` contains actual viewport/device scale/font loading, source identity, resource boundaries, hit tests and each labeled PNG's SHA-256. `verification.json` gives concise outcomes. The saved `run.cjs`/`fixture-entry.tsx` reproduce these targeted cases.

Inspect `fixture-pending-provider-390x844-roster-scrolled.png`, `fixture-partial-warning-390x844-tabs-after-repeated-scroll.png`, `fixture-pending-provider-1100x900-tabs-after-repeated-scroll.png`; corresponding initial/candidate/itinerary screenshots and desktop regression images are retained. Every screenshot visibly identifies fixture data with actual page-shell styling.

Zero outbound or real account/provider requests. One fake provider POST per context is fulfilled entirely within the fixture. Auth/router/Supabase reads/Next wrappers, closed AuthModal and external support/fictional-team image substitutes remain explicit boundaries. No user browser session/profile, installation, production request, commit/push or deployment. Real user account parity, provider refresh outcome, forecasting qualification and independent acceptance remain separate.

Independent reviewer is notified of these exact pins and the resolved header/tab obstruction. The previous parent handoff's remaining mobile finding is historical and superseded by this recheck.
