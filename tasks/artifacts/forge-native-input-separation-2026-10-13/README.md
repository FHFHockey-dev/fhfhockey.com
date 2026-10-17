# FORGE external fantasy input separation — local candidate

Canonical checkout: `/Users/tim/Code/fhfhockey.com`, `octoberBranch`. Seven owned source/test paths and their hashes, the 20 core files inspected by the regression contract, other inspected paths, and saved handoffs are recorded in [evidence.json](evidence.json). No task-list completion claim or release action is made here.

Current instruction: AG, Cullen, DtZ and all other external/crowdsourced fantasy projections may be isolated comparison references only. They cannot feed native features, priors, targets, blending, fallback, calibration, selection or served values. This supersedes the saved implementation handoff's proposed external-consensus product/feature roles.

## Verified violation and repair

- `web/lib/projections/seasonBootstrap.ts` imports the external provider registry, reads selected annual tables when `allowCurrentFantasy=true`, and blends their converted rates into the season prior.
- The native skater stage enabled those reads at lines 1460 and 1592; the native goalie stage enabled them at line 166. All three now pass `false`. Native previous-season hockey appearances remain available. The shared helper and its existing coefficients, transition, missing-category redistribution and history window are unchanged. Removing an input naturally changes affected output values; this is not a coefficient retune or a substitute forecast.
- `calibrationEligibility.ts` now issues `external_fantasy_input_contract=excluded_from_native_inputs_v1` alongside the existing rolling-history contract. Calibration requires both contracts. Older runs lacking exclusion provenance fail eligibility rather than being presumed clean. The snapshot type retains the marker, and the accuracy route's existing error now describes native input provenance.
- `nativeInputEligibility.test.ts` checks all three call sites through the TypeScript AST; checks 20 core inference/query/calculator/calibration/selection files for provider dependencies; and uses a database mock that rejects every table except native skater/goalie appearance history. It verifies empty external stats/source IDs and preserves missing categories. External provider imports, annual tables and the separate external-baseline modules are forbidden in the bounded core.
- `apiHelpers.test.ts` covers valid exclusion provenance and absent, malformed, legacy or comparison-only markers. No model producer or source collection was run.

## Verification

- Boundary/provenance cohort: **16/16 passed** (`npm test -- --run lib/projections/nativeInputEligibility.test.ts lib/projections/apiHelpers.test.ts`).
- Existing native/accuracy cohort: **144/144 passed** (`runProjectionV2.test.ts`, `nativeGoalAccounting.test.ts`, `module-imports.test.ts`, `run-projection-accuracy.test.ts`). The accuracy fixture emitted its existing mocked audit-client warning; tests passed without live access.
- After strengthening the dependency guard, boundary tests **6/6 passed again**, plus scoped ESLint.
- Scoped ESLint across all seven owned files: **passed**.
- Full TypeScript: the default 4 GB heap failed with exit 134; **passed** after `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit --incremental false`. The first retry failed to start during a brief exec transport disconnection; shell access was verified before retrying, with no missing mutation or duplicate producer.
- Owned diff whitespace check: **passed**. Node: `v22.11.0`. No build, deployment, commit, push, branch switch, database request/write, endpoint execution, credentials or direct parent message.

## Remaining gaps / ownership handoff

1. `web/lib/player-forecasts/baselinePolicy.ts` still defines AG/Cullen/DtZ/5v5 ingredients and a 0.6 external consensus / 0.4 history candidate. `baselineRates.ts:132` and `goalieBaselineRates.ts:108` use that consensus as a prior; `baselineGeneration.ts` turns it into contribution bundles and `goalieBaselineInputCapture.ts` reads provider rows. This is outside the assigned FORGE boundary. No import from this family was found in the audited native FORGE runner/stages/readers. It needs a separate disposition to ensure it is comparison-only and never a product fallback, challenger for selection, native prior or served source. No values or weights in that family were changed.
2. Existing stored FORGE outputs are not retroactively cleaned or blocked at every reader. `apiHelpers.ts:requireLatestSucceededRunId` selects the latest succeeded run by date without checking exclusion provenance, and `consumerRevisionAdmission.ts` checks captured-read receipts/issued contexts without checking this new exclusion marker. RSO/Start Chart consumers and their tests are owned separately and were not changed here.
3. The current accuracy-run eligibility guard now rejects legacy provenance, but historical rolling accuracy summaries and stored calibration hints are not comprehensively filtered/quarantined by this patch. The atomic-result SQL contract still checks only the earlier rolling-history marker. Existing records were neither inspected live nor modified. A broader historical-provenance policy and any database migration require separate ownership/authorization.
4. `seasonBootstrap.ts` retains generic external conversion/loading/blending support for isolated references. All audited native callers disable the external loader branch; the contract is deliberately bounded and does not certify every platform integration or every future indirect import.

No `.agents/skills` directory exists in the canonical repository or the checked home/Code locations. Repository `AGENTS.md`, relevant saved projection handoffs, and the available Supabase skill were read. Unrelated dirty work, including concurrent RSO/Start Chart/Yahoo/ingestion/build-setting edits, was preserved. This candidate advances the separation item; the platform-wide item must stay open for the remaining gaps.
