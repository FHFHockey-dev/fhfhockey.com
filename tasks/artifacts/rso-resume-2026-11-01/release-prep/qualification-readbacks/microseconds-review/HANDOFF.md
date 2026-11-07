# Downstream P2 precision repair — ready for independent re-review

The independently reported downstream P2 is fixed in the **isolated** checker. Original adapter P2/P3 remain closed by `rso-settlement-audit-2026-11-01/timestamp-rereview/REVIEW.md`; their source files were not changed again.

Every checker chronology boundary now uses the unchanged production `timestampMicros` parser and explicit null guards: cutoff ≤ issue, issue < puck drop, readback ≥ issue and < puck drop, settlement > puck drop. Invalid clocks cannot participate as numeric zero. Explicit zones, real calendar dates and up to six fractional digits are required; exact timestamps remain strings in reports, so bigint values are never serialized.

Eight regressions failed before repair: six checker tests, the two-consumer normalized readback → actual CLI test, and the settlement adapter → actual checker test. The issued/readback pair at `.000002`/`.000001` now fails with `readback_before_issue`; settlement one microsecond after start now remains settled. Before/equal/after boundaries and equivalent explicit offsets are covered. A further test checks raw invalid issue/cutoff/start/settlement clocks.

Verification in `after.json`: **28 checker + 19 typechecked readback + 19 settlement tests pass under each of UTC and America/New_York**. The identity and E1 preflight import this checker, so their **10 + 11 tests** also passed. Total: **87 distinct tests / 153 executions**. An additional clean-fixture CLI run passed from `/tmp` with the checker placed at its retained installation path inside the disposable export.

The CLI layout probe initially used macOS's `/tmp` alias; the existing entry guard compares literal paths and emitted nothing because Node resolved the module under `/private/tmp`. That was not accepted as a pass. The corrected probe uses the physical file path; both records remain. The existing alias limitation was not changed in this chronology patch.

## Parser dependency and custody

The checker locates the repository from its own module location, then loads only `web/lib/projections/evidenceTime.ts` through the already installed `web/node_modules/ts-node`. This avoids copying timestamp business rules and works from either artifact layout, independent of the caller's working directory. It now requires the repository's web dependencies rather than being a standalone dependency-free script. The loader can attempt ordinary temporary compiler-cache writes, as the preceding independent loader review observed; it does not load production environment files or clients. No install, environment edit or application source change was made.

`../source.patch` still targets exactly the two retained files:

- `tasks/artifacts/rso-wave2-2026-10-25/FORGE-QUAL/tooling/check-readbacks.mjs`
- `tasks/artifacts/rso-wave2-2026-10-25/FORGE-QUAL/tooling/check-readbacks.test.mjs`

The patch includes the earlier empty-population, required-consumer, sealed-window and capture-clock supplement, plus this precision correction. `git apply --check --whitespace=error` passed against the unchanged retained originals; reverse checking passed against the proposed files in the disposable export. **It has not been applied to retained tooling.** `EVIDENCE.json` binds the current checker, tests, patch, adapter tests and unchanged parser/adapter sources by SHA-256.

The retained `FORGE-QUAL` coordination record lists the artifact lane with `write_paths: []`; it supplies no current installation allocation or named active file custodian. Do not infer transfer from that empty list or from PROV-GUARD's separate two-file admission transfer. The orchestrator must arrange explicit allocation of the two retained tooling files before installation. No new mailbox request was sent. The isolated supplement remains available for offline review without changing held files.

Please independently rerun both reported microsecond reproductions against this pinned checker, inspect null handling and the repository-loader dependency, and confirm boundary behavior under both timezones. This repair grants no source admission, forecast-use review, live-capture authority or scientific qualification. Model/configuration evidence, final admission commit, comparator inputs and prospective protocol gates remain open.
