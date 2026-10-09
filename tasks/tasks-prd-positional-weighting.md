## Relevant Files

- `web/components/DraftDashboard/DraftDashboard.tsx` - Chef: setting contract, gating, source resolution, valuation wiring, restore defaults.
- `web/lib/draftDashboard/positionWeights.ts` - Chef: bounded weight validation/normalization and eligible-position multiplier selection.
- `web/lib/draftDashboard/playerValues.ts` - Chef: shared comparable-value adjustment.
- `web/hooks/useVORPCalculations.ts` and `web/lib/draftDashboard/tierDashboardAdapter.ts` - Chef: pass multipliers into both valuation consumers.
- `web/components/DraftDashboard/ProjectionsTable.tsx` and `web/__tests__/components/DraftDashboard/ProjectionsTable.test.tsx` - Chef: keep projected-points sorting independent of positional valuation, including zero weight.
- `web/components/DraftDashboard/DraftScoringSettings.tsx` and `DraftSettingsDomains.module.scss` - Sous UI: separate position-weight controls.
- `web/__tests__/components/DraftDashboard/DraftSettingsScoring.test.tsx` - Sous UI: controls, reset, entitlement, and live-sync behavior; preserve existing edits.
- `web/lib/draftDashboard/settingsValidation.ts` and `draftWorkflow.integration.test.tsx` - Sous persistence: malformed-weight validation and bookmark compatibility.
- `web/lib/draft-pro/savedDrafts.ts` and `savedDrafts.test.ts` - Sous persistence: saved-draft round trip and validation.
- `web/hooks/useVORPCalculations.test.tsx` and `web/lib/draftDashboard/positionalTiers.test.ts` - Sous verification: valuation/source/neutral regression coverage.
- `web/e2e/draft-pro-account.spec.ts` - Chef: fixture-backed browser coverage for valuation editing, persistence, entitlement changes, reset, and old-bookmark import.

### Notes

- Follow `prd-positional-weighting.md`, `AGENTS.md`, and `mise-en-place.md`. Preserve the dirty checkout. The initial scope excluded release; the user subsequently authorized pushing to production. Do not contact the customer or alter purchases.
- Tasks 2, 3, and 4 may run concurrently after 1; they have disjoint ownership. Chef owns central integration (5), which can proceed concurrently once contracts are settled. Task 6 depends on all contributions.
- Runtime contract: `PositionWeights = Partial<Record<"C" | "LW" | "RW" | "D" | "G", number>>`; optional `UseVORPParams.positionWeightMultipliers: ReadonlyMap<string, number>` defaults neutral. Chef exports `POSITION_WEIGHT_KEYS`, `normalizePositionWeights`, `isValidPositionWeights`, and `buildPositionWeightMultipliers(players, weights, enabled)` from the helper. The multiplier map uses source-selected players; replacement eligibility uses existing players.
- Staffing: Chef retains architecture/math and integration. Sous UI uses GPT-6 Sol / medium for bounded accessible controls. Sous persistence uses GPT-6 Sol / high for validation and restore boundaries. Sous verification uses GPT-6 Sol / high for numerical and eligibility regressions. No further delegation.
- Use existing Vitest files and `npm test -- --run <files>` from `web/`. Run type-check and targeted lint after integration; no production build unless a build-specific issue requires it.
- Chef reviewed all three contributions and the final integration. React review and a browser screenshot confirmed the controls fit the existing settings layout. Existing Yahoo changes in shared files were retained; unrelated navigation, start-chart, and underlying-stats work was left untouched.
- Verification passed: 90 unique Vitest tests across seven focused files; one Chromium fixture test; `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit --incremental false`; targeted ESLint (zero errors, two warnings on unchanged Dashboard hook dependencies); `git diff --check`. Initial type-check exceeded the default heap; the larger-heap check identified test fixture types that were corrected before the successful final run. The browser test's initial stale Setup-button selector was corrected to the current full-settings control and Scoring tab.
- Initial implementation verification did not include the full suite, a production build, a real-account Yahoo/Fantrax exercise, push, or deployment. Browser checks used fictional data/account responses and local endpoints. Production readiness applies to this feature's diff, not unrelated shared-checkout changes. The customer's purchase/refund decision remains unresolved.
- Authorized release: isolated the feature on `chef/positional-weighting` from the latest `origin/master`, preserving newer Fantrax/Yahoo fixes and the shared checkout. All 90 focused tests passed against that base. Added the newly required Fantrax ID to a test fixture; its 11 tests and the full TypeScript check then passed. Confirmed the local Scoring panel exposes neutral controls and gates editing without Pro. Push to `master` uses the existing Vercel production integration.

## Tasks

- [x] 1.0 Inspect and settle requirements/contracts — Chef
  - [x] 1.1 Inspect valuation, UI, entitlement, selected-source eligibility, and persistence paths; record existing edits.
  - [x] 1.2 Write concise PRD and dependency/ownership plan.
- [x] 2.0 Add position-weight settings controls — Sous UI; depends on 1; concurrent with 3, 4, 5
  - [x] 2.1 Add labeled 0–200% inputs, explanation, and independent neutral reset; gate editing but permit Pro live-sync edits.
  - [x] 2.2 Extend UI tests and run that file.
- [x] 3.0 Validate and preserve portable/saved settings — Sous persistence; depends on 1; concurrent with 2, 4, 5
  - [x] 3.1 Validate weights at settings, bookmark, and saved-draft boundaries; retain backward compatibility without schema changes.
  - [x] 3.2 Extend existing tests for round trip, old drafts, and malformed values; run relevant files.
- [x] 4.0 Add valuation regression tests — Sous verification; depends on 1; concurrent with 2, 3, 5
  - [x] 4.1 Cover neutral identity, D scaling, categories/signed values, multi-eligibility, source selection, gating, grouping, and proration using existing valuation tests.
  - [x] 4.2 Cover shared tier valuations; run tests once Chef's integration is available.
- [x] 5.0 Integrate central valuation — Chef; depends on 1; concurrent with 2, 3, 4
  - [x] 5.1 Implement weight helper and setting contract, resolve source-selected/gated multipliers, and wire both VORP paths and tiers.
  - [x] 5.2 Normalize restore/update paths, ensure old bookmarks reset weights, and preserve raw projection/scoring/source data.
- [x] 6.0 Review and deliver — Chef; depends on 2, 3, 4, 5
  - [x] 6.1 Inspect every contribution and final diff for correctness and unrelated-work preservation.
  - [x] 6.2 Run focused integration/type/lint checks; record actual results and limitations.
  - [x] 6.3 Report behavior and production-push readiness; do not push or deploy.
