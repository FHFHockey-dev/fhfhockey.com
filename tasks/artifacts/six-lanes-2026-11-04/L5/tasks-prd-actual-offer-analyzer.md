## Relevant Files

- `tasks/TASKS/prd-roster-autopsy.md` and `tasks/artifacts/trade-value-pipeline-2026-11-04/PLAN.md` — governing requirements, read-only; scoped by [brief](actual-offer-analyzer-brief.md).
- `web/pages/trade-analyzer.tsx` — proposed direct route.
- `web/components/TradeAnalyzer/TradeAnalyzer.tsx`, `TradeAnalyzer.module.scss`, `TradeAnalyzer.test.tsx` — proposed entry, preview, unavailable states and interaction tests.
- `web/lib/tradeAnalyzer/offer.ts`, `offer.test.ts` — proposed offer validation and full-roster transformations.
- `web/lib/rosterAutopsy/manual.ts`, `web/lib/rosterScheduleOptimizer/planningTypes.ts` — read-only reuse candidates; capacity and identity require explicit adaptation.
- `web/lib/tradeValue/` — proposed L4-owned dependency only; exact import paths/types await contract freeze. No L5 files assigned here.

### Notes

- Task-rule structure retained inside granted L5 namespace. Chef accepted the manual structural/capacity slice and granted the six exact new application files to L5; local implementation status below. Chef retains acceptance/integration.
- Full impact integration still waits for a qualified L4/RSO contract. Installed L4 observation-only Result/Asset types are reused; no proposed valuation/roster-impact imports.
- Run future targeted tests from `web/` with the existing Vitest setup; no new provider/API/database path needed for this slice.

## Tasks

- [x] 1.0 Accept the entered-offer first slice and claim exact files.
  - [x] 1.1 Accept two-team manual structural/capacity preview, in-memory-only state and explicit unavailable impact; confirm proposed name/route. Picks remain visible; only two sides can be entered in this slice.
  - [x] 1.2 Obtain L1/Chef exact grants; agree input shape with local identity, complete before-rosters, reviewed total-player limits, effective date, assets and explicit drops. Active/bench/reserve sublimits and other rules remain explicitly unverified.
- [x] 2.0 Validate offers and construct complete after-rosters (depends on 1).
  - [x] 2.1 Reject duplicate/conflicting assets, wrong-owner players and ambiguous identity for calculations, while retaining entered text/assets for correction. Never erase picks or unknown assets.
  - [x] 2.2 Apply the full exchange and manager-selected drops to each team. Check reviewed total count including all status rows; missing total capacity is unresolved. Outgoing/incoming assets cannot also be dropped. Separate active/bench/reserve restrictions remain unverified, not inferred from total capacity.
  - [x] 2.3 Add hand-calculated one-for-one/two-for-one/drop fixtures for both teams, missing limits, reserve-row preservation and unknown assets. Reserve legality remains unavailable.
- [x] 3.0 Implement offer-first UI (depends on 1; integrate after 2).
  - [x] 3.1 Add direct page with reviewed manual inputs, both before/after rosters and explicit drop resolution; preserve input on correction. Editing roster rows intentionally resets that side's stale offer/drop selections.
  - [x] 3.2 Render independent validity, capacity, dated legality and impact states. Show unavailable impact/value/market reasons without hiding conditional structural preview; synchronous derivation avoids stale async results.
  - [x] 3.3 Corrected component tests passed for principal flow, missing inputs, in-memory-only state, stale selections and stable textarea names. Chef's synthetic keyboard/responsive browser rerun passed 34 checks; 1440/390 visuals accepted by Chef. No persistence/auth/nav/provider changes.
- [ ] 4.0 Integrate accepted shared outputs (later dependent grant).
  - [ ] 4.1 Resolve the brief's concrete `roster-impact-v1` gaps (two-team/date/rule binding, capacity meaning, assignments/displacement and vector output), then bind frozen L4 imports and qualified RSO use. Compare both full-roster arms on identical dates/objectives, including drops. Preserve admission and unsupported weekly states.
  - [ ] 4.2 Keep production/quality, league value, roster impact and unknown acceptance separate; display guard notes without filtering entered offers and bundles without inferred prices. Preserve category vectors/ratios and missingness.
- [x] 5.0 Verify the granted slice and submit to Chef (depends on 2–3; task 4 remains separately gated).
  - [x] 5.1 Run focused model/component tests, affected types/lint and local synthetic desktop/phone/keyboard flow; no full build or external reads.
    - Passed: original 9 model cases reused plus corrected 5 component cases, scoped TypeScript, lint and component/CSS-module/Sass compilation. Chef's unchanged harness rerun records 34 successful checks with zero page errors/external requests. Full Next shell/font/build/provider parity remains unverified. Initial browser label failure and one correction are preserved in the receipt.
  - [x] 5.2 Chef accepted the corrected six-file local slice after source/diff and browser/visual review; exact pins and unresolved numerical/shared gates recorded in `ANALYZER-IMPLEMENTATION.md`. No whole-feature/live-provider/release claim.
