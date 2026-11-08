# L2 synthetic-test handoff — ready for Chef/composer04 review

Canonical checkout: `/Users/tim/Code/fhfhockey.com`, `octoberBranch`; observed HEAD `42edeb1007f1ed5a9849985f8ca258dc33b6a77b`. Candidate03 base: `d95331f5ae476b1ee7466dcd89f31cbdb6992326`. No Git/index/ref operation, deployment, source/runtime/policy change, packaging or frozen-origin replay performed.

## Exact scope

Four granted consumer tests updated; three granted test helpers added. `synthetic-tests.patch` is relative to the verified custody baselines (not a whole-working-tree diff); `FINAL-PINS.json` identifies all seven final files. Runtime parser/mapper/scorer and all four retained files match `UNCHANGED-PINS.json`. Preserve concurrent work.

For composer04, include only these seven test/helper changes from this slice; omit the three research snapshot JSON files and `__fixtures__/display-profiles.jsonl` from the portable candidate. Keep their canonical local bytes untouched. Do not include this artifact directory or diary in the release.

## Behavior

Unset `BLSH_RETAINED_TEST_ROOT`: no retained-data read, explicitly named skipped retained suites, synthetic parser and mapper contracts plus existing authored scorer/card checks. Default parser records are literal authored contracts independent of mapper/scorer. Mapper inputs use simple diagonal covariance and independently asserted numeric expectations; no retained rows, names or statistics were used to construct them. Fake pins are fixture contract markers, not source acceptance.

Explicit `BLSH_RETAINED_TEST_ROOT` names a directory containing `research-snapshots/` and `__fixtures__/display-profiles.jsonl`. Reads are lazy and exact-pin checked. Missing/empty/wrong root or incorrect bytes fail instead of silently skipping. Canonical read-only opt-in used `/Users/tim/Code/fhfhockey.com/web/lib/buyLowSellHigh`.

`BLSH_V1_RUN_DIR` remains a separate expensive parity opt-in. Its historical snapshot prerequisite is now checked in beforeAll before replay. No BLSH_DISPLAY_OUT, BLSH_PARITY_RECEIPT or frozen data replay was enabled.

## Checks actually run

All application checks used an explicit environment with dummy service values, UTC, network-denial preload, one Vitest worker, and the atomically owned shared heavy slot. Default runs additionally blocked synchronous reads of all four retained filenames even though the files exist locally.

- Four-file default batch: **171 passed /111 skipped /0 failed** (`default-results.json`).
- After final mapper coverage additions, changed mapper alone: **25 passed /29 skipped /0 failed** (`mapper-final-results.json`); other three files' behavior unchanged. Combined current coverage is174 passed /110 skipped, but **no final four-file aggregate rerun is claimed**.
- Approved retained four-file batch: **276 passed /6 skipped /0 failed** (`retained-results.json`), before the final additive mapper cases and moving the pure reason-code assertion into default coverage. Original empirical assertions passed; final added mapper cases separately passed above.
- Final targeted TypeScript dependency graph: **0 diagnostics** (`types-confirmed.log`). Seven-file targeted lint passed; final modified mapper/helper lint passed (`lint.log`, `lint-confirmed.log`). Scoped diff check passed (`diff-check.log`).
- Explicit absent retained root: **expected exit1**, ENOENT from lazy loader (`missing-root.log`).
- Explicit wrong-pin authored dummy file: **expected exit1**, Retained data pin mismatch (`wrong-pin-diagnostic.log`). JSON reporter omitted the hook error text, so the diagnostic was repeated with the default reporter to verify the actual reason.
- Explicit parity run directory without retained root: **expected exit1 in beforeAll**, root required; no replay read/execution (`parity-missing-root.log`).
- The first default run exposed frozen scorer output in mutation fixtures; returning a structured clone corrected the fixture. Initial targeted type diagnostics were fixture typing issues, resolved without runtime changes. Original logs are retained for audit.
- Final parser test-name-only wording distinguishes pinned bytes from authored contracts; behavior unchanged and no rerun for that title-only edit.

Heavy slot released after inode/owner verification. No application build, broad suite, browser run or remote action.

## Coverage/limitations

`COVERAGE.md` maps each original mapper test, each expanded parser contract, and scorer/card cases to default substitutes or retained-only coverage. All original assertions remain. Exact population counts, real-player values, empirical distributions and retained-source byte fidelity are not established by portable tests. Those assertions remain explicit retained opt-in. No test here grants publication, source admission, forecast validation or production acceptance.

## Final SHA-256 pins

- `web/lib/buyLowSellHigh/researchSnapshot.test.ts`: `780334394ae3a70b3ef318fc9d5a2935e7533f95107ca55439e57f2877890f08`
- `web/lib/buyLowSellHigh/displayProfile.test.ts`: `ee310ed5997efcec4aa866afb8ea60bf489419aff842aba0a0ec01a6932bcd23`
- `web/lib/buyLowSellHigh/supportGap.test.ts`: `bf324db61a84d17861e15fa7f02993f5388d894321271edd31ae487f042c2c15`
- `web/lib/player-cards/retainedBlsh.test.ts`: `945685b3fe639ea2b26234b05a7bee36e1aadcf0713922c0e298165a40db6fe8`
- `web/lib/buyLowSellHigh/__fixtures__/syntheticProfiles.ts`: `32c843ec291ccbeea48e99c07b46733fe2c00e448ccbb2b8050625f57414cda1`
- `web/lib/buyLowSellHigh/__fixtures__/syntheticSnapshots.ts`: `cb67e51ad7c9dbedafade0cbf9d917f7e4ce4bd6f05095ea97fa6511c682f517`
- `web/lib/buyLowSellHigh/__fixtures__/retainedData.ts`: `6016135aac3658afe0db1ab4cd90b0c6582fb4af12ef25351c685d2349cd27cc`
