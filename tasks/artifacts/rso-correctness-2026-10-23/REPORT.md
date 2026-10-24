# Bounded RSO correctness — 2026-10-23

The baseline re-resolution defect is fixed locally in three application/test files. The release owner's existing two-file Yahoo correction is independently verified at the hashes in `CANDIDATE.json`; those files were not edited by this task. **392 distinct selected tests across 11 files pass**, with scoped TypeScript, scoped ESLint, patch dry-run and whitespace checks passing. No whole-tree, native-target, model, production or release approval is implied.

## Baseline correction

Changed files:

- `web/lib/player-forecasts/resolvedPlanningForecast.ts`: when a baseline borrows non-modeled participation from an issued forecast, preserve that forecast's code version. The baseline's own policy version remains in its per-target source receipt. Independent modeled participation keeps its existing path.
- `web/lib/player-forecasts/rsoUsePolicy.ts`: in the absence of a detailed mean source, compare the target binding to the borrowed issued participation's own cutoff. The reconstructed aggregate cutoff may legitimately come from a newer baseline rate and remains unchanged for display/lineage.
- `web/lib/rosterScheduleOptimizer/planningReproducibility.test.ts`: convert the existing expected failure to a normal test with all original assertions intact; add 14 regression cases covering newer-cutoff skater/goalie replay, missing/rate-only/revoked/expired approvals, missing/changed bindings and identity, expired participation, revoked issued revisions, target/use separation and true zero.

The original oracle failed before repair: expected points objective `outcome`, received `agp`. Removing `it.fails` only exposed that existing assertion; no fixture values or expected outcomes were changed. A model-version-only correction still failed both newer-cutoff replay cases: their initially admitted assignment/totals became null. The cutoff correction fixes that separately reproduced identity loss. The final original oracle retains points/category/goalie profiles, input permutations, JSON replay, contribution arithmetic and snapshot nonmutation checks.

Authority remains external to serialized bindings: `resolveRsoTargetUse` still requires one matching current trusted review. Native production reviews remain empty. Rates cannot lend approval to issued participation. Replay recomputes current use permissions and still denies revoked, expired, malformed or mismatched receipts. No new schema, transport field, signer, secret, dependency or persistence mechanism was introduced.

## Yahoo authority review

The October22 source handoff explicitly placed `applyProviderGoalieStarts(snapshot.players, ...)` after the current data GET but before runtime bridge fingerprinting. Parser validation and browser labels do not establish current server authority. Even where the ordinary retained-input constructor drops the label, callers can supply serialized snapshot marks directly to the execution adapter/worker. The old application trusted those marks to change `startProbability`, `confirmedStart` and expected `stats`, then fingerprinted the modified row as authorized bridge output.

This is now a demonstrated synthetic actual-path defect, not an alleged production exploit. In the isolated prepatch run, a client-created Starting mark changed the selected forecast from probability 0.3 / saves 7.5 / unconfirmed to probability 1 / saves 25 / confirmed. The fixture exercises the actual shared fallback after a mocked same-origin current GET with nonce and the real bridge wire expansion. See `evidence/yahoo-independent-prepatch.log`. The release owner's separate original oracle also documents an old serialized Not Starting mark forcing zero; that is imported corroboration, not counted as this task's test execution.

The release-owner patch removes provider mark application at that authority constructor. Independent review fixture `review-fixtures/rsoBoundaryReview.test.ts` verifies:

- Unmarked, forged Starting, old Not Starting and future-dated marks produce identical server quantitative values through both the actual worker module and shared no-worker fallback. The label remains present, the goalie minimum remains unmet, and coalesced fallback consumers use one GET.
- A current-looking label cannot extend an expired bridge or admit a native target with an unapproved binding even if a bridge revision claim is also present.
- Modified copies are denied inside the read; serialized rows have no runtime bridge authority after the synchronous scope ends. Current server rows retain their legitimate authority.

The policy is shared by worker/fallback; no browser-only permission exception was added. This is unit-level execution of the actual worker module, not a browser Worker packaging or live Yahoo test. No private Yahoo export or provider request was used.

## Verification and exact scope

All checks used Node22.11.0 and existing installed dependencies (Vitest reports3.2.7), an ordinary temporary source copy, environment-file loading disabled, synthetic Supabase import values, and network-denial preload/setup. No installs or dependency changes occurred. `FIXED-SNAPSHOT.json` pins3282 source/test/config files in `/tmp/fhfh-rso-correctness-20261023`; `CANDIDATE.json` pins the actual three-file delta, reviewed Yahoo files and exact per-file test counts. The three edited files and two reviewed Yahoo files matched canonical at packaging time.

- `planningReproducibility.test.ts`:32pass, including the formerly expected failure and14new cases.
- Contributions/target-use/native admission and native participation tests:308pass across5files.
- Execution adapter/provider helper/hooks:48pass across4files.
- Independent Yahoo boundary review:4pass in one artifact-only file.
- Total392 distinct selected cases,11files. Focused and retyped-fixture repetitions are not added to this total.
- Scoped TypeScript checks both changed implementation modules, changed regression test, the independent fixture and transitive dependencies. This is not a full repository typecheck. Scoped ESLint has zero diagnostics. Both ran sequentially under `/private/tmp/fhfh-heavy.lock`; only this task's lock was released.
- `baseline-identity.patch` applies to `before/` in dry-run; `git diff --check` passes. `after/` holds exact candidate files.

The initial wider test invocation had282passed cases but one suite could not collect because the temporary copy omitted `web/scripts/run-forge-calendar-local.ts`. After adding tracked script source dependencies, that110-case contribution suite passed; no passing suites were needlessly rerun. Initial scoped typing found only two narrow inferred-wire-type errors in this task's artifact fixture; using the existing `BridgeForecastWire` type fixed them without altering assertions. A first test startup could not write through the dependency symlink into canonical `.vite-temp`; local per-package symlinks moved Vite's temporary writes inside the isolated copy. These harness corrections are complete; none is a source/runtime defect or unresolved approval block.

## Readiness and remaining limits

Recommend accepting the exact baseline three-file patch for release-owner integration/review, together with the already owned Yahoo authority correction. Preserve review-before-use and the empty production native catalog. These results do not justify enabling any unqualified native forecast.

The old `web/lib/rosterScheduleData/forgeDailyBridge.test.ts` expectation at the review snapshot requires Yahoo labels to rewrite bridge values, and the earlier browser scenario also expects quantitative Yahoo overrides. That behavior is intentionally withheld by the corrected authority boundary. The release owner has been notified to reconcile those dependent feature expectations and communicate that labels are informational; do not restore the unsafe call to satisfy them. The provider helper remains capable of transforming rows as a pure helper, but this reviewed current-read path no longer invokes it. A future quantitative Yahoo feature needs independently trusted current provider evidence, not serialized labels or equivalent query parameters.

Previously resolved/saved baseline rows whose code identity was already lost are not guessed back into authority; refresh from current server inputs is required. Native model/target qualification, whole-tree integration, browser packaging, live provider behavior and deployment remain separate release gates. The release owner's unrelated current changes are preserved.

No Git mutation, commit, push, deployment, production API/data action, migration, credential access/change or private-data export was performed. No action remains denied, pending approval or uncertain. The independent Yahoo review and exact baseline source lease can transfer to the release owner with this packet; this task retains only its diary/artifact custody.
