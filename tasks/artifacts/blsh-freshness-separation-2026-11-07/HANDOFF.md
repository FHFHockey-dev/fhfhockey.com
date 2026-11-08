# BLSH source observation and window freshness

## Local result

Added source-observation qualification and captured-window diagnostics to the canonical `currentProcessEvidence.server.ts`, with regression tests in its existing test file. The BLSH owner confirmed ownership and no overlapping edits. No source, score, baseline, acceptance list, research snapshot or runtime caller was changed.

This is a safe staged correction, **not a widening of the existing v1 admission contract**. Existing `.qualified`, `.reasons` and `.provenance` fields still apply the per-row event-age rule. All existing values are identical to the frozen pre-change implementation in 66 complete synthetic-output comparisons after removing the newly added fields.

## Why the clocks must be separated

The earlier authenticated November 1 metadata recount found 644 captured five-game windows, 594 with a latest game within seven days of November 1, but none with all five members within seven days. An older member of a valid last-five window does not become a newer event when fetched again. Conversely, an authentic older game may still be usable history when freshly observed. Fetch age and event age answer different questions.

There is a second boundary: `CurrentInputRequest` explicitly covers captured WGO records, not an independently established complete player-appearance census. The last five captured records must not be represented as a verified latest-five-completed-appearances window. Even a perfectly bound recent subset cannot prove that no later appearances were omitted.

## New fields and their limits

- Each process group has `sourceObservation`. This carries the existing complete exact-byte review, native transport/scope/value declaration, official finality/identity/exposure, original observation chronology and oldest-observation capture-age checks. It excludes only the separate per-member event-age restriction. Original clocks and event dates are preserved; missing values, discrepancies and exposure holds are not repaired. The gate still relies on independent exact native-cell/model review, rather than parsing native HTML itself.
- `capturedWindows` selects the latest five captured records per player **before** qualification. A held or missing member is not backfilled with an older passing record. It reports exact selected IDs/dates, per-group qualified member counts and latest-event recency.
- Diagnostic recency is explicitly anchored to the server evaluation UTC date, inclusive of the existing `maxEventAgeDays` boundary. It does not use a frozen event cutoff as today's clock. This is an explicit conservative diagnostic choice, not a silent change to the research assembler's historical cutoff-based output.
- Every captured window has `completeLatestFiveEstablished: false` and `currentUseQualified: false`. The missing independent membership contract is an explicit reason. Short and identity/exposure-held windows are labeled. Fresh observations of a stale window remain stale; recent events with stale observations remain source-withheld.
- New source-observation coverage counts are separate from unchanged v1 admission counts. Existing raw row freshness metadata is preserved. The output remains untrusted, unadopted and unscored.

## Verification actually run

Using Node 22.11.0 / npm 10.9.0:

- 59 focused gate tests passed under UTC: all 52 existing tests plus seven new window/source regressions. Existing exact microsecond future/age boundaries now additionally assert source-observation withholding.
- Seven new tests passed under America/New_York; the other 52 were intentionally skipped in that timezone run.
- 66 complete legacy-output comparisons passed across 11 synthetic cases, three evaluation times and accepted/closed synthetic policies. This is compatibility evidence, not real-source admission.
- Focused strict TypeScript check passed for the gate/test and imported qualifier with the application ES2015 target and bundler module resolution.
- Scoped ESLint passed with zero findings. Scoped `git diff --check` passed.
- `currentInput.ts`, `currentWindows.ts`, shared `nst/client.ts` and `researchSnapshot.server.ts` match their pre-edit hashes. A bounded non-test `web` search still found only the gate definition, no production caller.

The first test-append attempt used a repository-relative path while running inside `web`; it failed before editing. The path was corrected, then the complete new suite above passed. An earlier 52-test baseline run is not counted as coverage of the new tests.

No full application suite or build was run because there is no runtime caller or UI change. No provider/DB calls, live capture, real input replay, reserved-data reads, rescoring, acceptance configuration, commit, push or deployment occurred. No operation was denied or left uncertain.

## Remaining implementation boundary

Do not consume `sourceObservation.qualified` as a recommendation or complete-window admission. The next version needs an independently reviewed, exact-byte-bound completed-appearance membership/census contract for the intended player population and cutoff, with original observations and omissions accounted for. Then an explicit versioned window-admission path can combine every selected member's source qualification, complete latest-five membership, live server-time recency, and the separately admitted production/reference/method requirements. Migrate callers deliberately; do not relabel or drop the v1 gate.

Actual native receipts and independent exact-cell/transport/model review are still absent; the real acceptance policy remains empty. The current isolated capture preparation stays a two-page compatibility pilot, not a full-window collection. No larger capture, threshold increase, holdout consumption, baseline adoption or release is authorized by this change.

## Files

- Canonical source/test: `web/lib/buyLowSellHigh/currentProcessEvidence.server.ts` and `.server.test.ts`.
- `BASE-PINS.json` and the two `.base.ts` copies preserve pre-change source evidence.
- `CHECKS.json`, `MANIFEST.json`, test/type/lint logs, `compare-legacy.cjs` and `LEGACY-PARITY.json` record local verification.
- `change.patch` contains only the two canonical file changes. No shared Git staging or branch custody changed.
