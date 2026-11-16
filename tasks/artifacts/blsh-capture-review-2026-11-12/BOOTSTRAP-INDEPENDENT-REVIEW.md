# Independent bootstrap review

Reviewed 2026-11-12, local source/evidence only. No credentials, provider/ledger/database access, live adapter invocation, capture, or network requests. No pilot authority is created by this review.

Candidate bootstrap SHA-256: `a4b0388ed6e0e3b6236510d454b041174b5c735655f062d61c5ae78d157c8518`.
Candidate test SHA-256: `a46fef4fb257cbe65d6e12522a411d2954e58d6d69544c0e88fe2e2ff947c971`.

## Finding requiring correction

**High: hashed TypeScript source is not bound to the module actually imported.** `web/scripts/blsh/nativeProcessCaptureBootstrap.ts:117`–119 imports preparation, runner and adapter without extensions. The required invocation uses ts-node with CommonJS compilation, so these become CommonJS module loads. CommonJS extension resolution tries sibling `.js` before registered `.ts`. Lines 60 and 124 verify/pass hashes of `.ts` paths only; they do not bind the resolved runtime modules to those paths.

Reproduction conditions: place an unreviewed `nativeProcessCaptureAdapter.js` beside the unchanged pinned adapter `.ts`, then use the separately approved run path. The `.ts` hashes remain valid, but the extensionless adapter import loads the `.js`; its top-level code and factory can act before the runner's source snapshot. This is an established resolution path, not a live reproduction performed during review. The same problem applies to the other two direct imports and relevant extensionless imports of pinned transitive modules. A source snapshot inside the runner cannot prevent code already executed during import.

Bind each pinned source module's resolved path to its exact canonical `.ts` path before importing runtime modules, or use another explicit resolution mechanism that makes shadowing fail closed. Add an offline test that substitutes a `.js` resolution result and proves rejection before any dynamic module/factory/runner execution. Keep expected source pins fixed.

## Gates inspected

- Default/`--check` runs only local prerequisite checks. Adapter and runner imports are type-only or deferred; it reads no credential variables and creates no output. Public project/lifecycle and loader/TLS environment values are allowlisted.
- Receipt read is bounded to 16 KiB, a user-owned regular 0600 file, opened with `O_NOFOLLOW`; exact field set, bootstrap hash, fixed slot/output/origin/mode/five-attempt scope, references and nonfuture approval timestamp are checked before runtime imports.
- Receipt references are assertions recorded by the operator, not independently authenticated approvals or fetched evidence. Real external TJ approval and current coordination/runtime/admission receipts remain external prerequisites. The program has no receipt-generation or authority-granting path.
- Starts are checked at import/factory boundaries, within November 13 14:05:00 inclusive to 14:06:00 exclusive. The fixed disabled-mode runner enforces a 120-second wall/monotonic work limit, five operations, fixed November 7 date, and no transport retry. A latest legal start finishes its work budget before 14:08, subject to the already-documented inability to interrupt synchronous filesystem calls.
- Module-local `attempted` blocks repeat calls within the process. Cross-process duplicate network execution is blocked by exclusive creation of the fixed output directory before dispatch; pre-output failures do not produce a durable global attempted marker. Human/operator no-retry policy still applies.
- Failures from factory/runner are sanitized. The CLI catch emits a fixed message and exit code 1, but the test file does not directly exercise the `require.main` CLI branch.

## Verification evidence and limits

Read `BOOTSTRAP-TESTS.log`: 28 focused tests passed. The suite mocks adapter and runner, rejects HTTP/HTTPS/net/TLS modules and replaces global fetch. It covers default check, successful synthetic wiring, malformed args, receipt mismatches, slot boundaries, configured environment mismatch, source drift, existing output, private receipt restrictions, one-shot failure, and expiry after adapter construction.

Read `BOOTSTRAP-TYPECHECK.log` and `BOOTSTRAP-LINT.log`: no error diagnostics shown; their process exit statuses are not embedded in those files, so this review does not independently certify those commands' exit status. No unchanged suite was rerun. Source and test hashes were directly recomputed and matched the assigned candidate. Actual Node CLI launch was not run; live capture remains separately gated.

This is the first bounded review pass. One correction follow-up is available; Chef owns integration and delivery. Actual Chef runtime model/effort was unavailable in the handoff; no hierarchy verification is claimed.

## Correction follow-up

Successor bootstrap `d4d2fcac52ffd272307b97bcbe79a008d888f7ee05f96526888cdcea2a34c97f` and test `da58e7ac90724bbd7f2f979f2d0b1aa1a5f282cbb80cb2ca629cfc08adc57861` were directly rehashed and inspected. Bootstrap lines 62–66 now use the actual CommonJS resolver to require every one of the nine pinned extensionless source targets to resolve to its exact canonical `.ts` path before runtime imports. **The reported source-resolution defect is corrected.** Original fixed runner/adapter/transitive source pins remain unchanged.

`BOOTSTRAP-OFFLINE-CHECK.json` binds the corrected bootstrap hash and records successful check-only CLI state, unset public project, disabled lifecycle, nine matched source pins, no credential inspection/network/output. Chef reports a real sanitized-environment CLI invocation; this reviewer read its result without rerunning it.

At this checkpoint the successor focused-test log shows 18 passed and 14 failed: Vitest's real CommonJS resolver lacks ts-node's `.ts` extension registration. These are test-harness resolution failures (`Cannot find module …nativeProcessCaptureRunner`), not evidence of live execution or a new source-resolution bypass. Chef was notified; focused verification is pending a deterministic mocked source-resolution fixture and updated passing evidence. No further source correction review is planned within this assignment's one-follow-up budget.

Final verification update: test SHA-256 `47a531687a925dfe4dc045444d4894c7798e572f5b55b1b1078f223672816533` directly matches the corrected harness. It first uses real Node resolution, preserving `.js` preference, and adds explicit `.ts` fallback only for existing canonical web files when normal resolution fails; shadow regressions still override to `.js`. Updated `BOOTSTRAP-TESTS.log` records **32/32 passed**. Chef confirmed test and final lint exit 0; the unchanged production successor had a successful typecheck, with a final full check after the test-helper adjustment still underway at handoff.

**Review disposition:** the sole established defect is corrected in bootstrap `d4d2fcac52ffd272307b97bcbe79a008d888f7ee05f96526888cdcea2a34c97f`. No remaining code blocker was established in this bounded review. External pilot approval, coordination, actual configured-process runtime receipt and current admission/control evidence remain prerequisites; this disposition authorizes no capture. CLI failure branch behavior remains statically reviewed rather than directly tested. Chef owns final verification status and delivery.
