# Independent offline reference review

Reviewed October 16, 2026. Scope: the standalone default-off reference adapter, not the current FHFH repository or a production integration.

## Result

No blocking defect found for this stated reference-only scope. The final adapter passes syntax validation, its 23 author tests, and 34 independent adversarial probes: 57/57 tests passing on Node.js v24.19.0. The ZIP contents exactly match the reviewed source tree. SHA-256 values are recorded in `reviewed-sha256.txt`.

The probes cover default-off behavior without even reading input; malformed inputs and responses; source and player/claim hashes; exact UTF-16 quote offsets; bad and overflow claim bindings; question-name routing and local refusals; source-only triage when every candidate is invalid; mutation isolation across inputs, transport, calibration and cached results; timeout/late-result behavior; unknown billing; and calibrated/uncalibrated zero-claim handling.

The final implementation has no network client, credential access, file writes, database writes, publication or player-status assignment. Injected transport receives a cloned allowlisted request. Disabled mode makes zero transport calls; enabling without explicit positive budgets still makes zero calls. No original package files were changed during this review.

## Limits retained

- These tests establish software behavior with synthetic responses, not model accuracy, calibration, extraction coverage, API compatibility, actual price or usage.
- Player identity and candidate statements remain caller/model responsibilities. Exact quotes bind evidence, but do not independently verify the candidate's semantic truth.
- Timeout is a JavaScript timer/AbortSignal boundary. It cannot preempt synchronous event-loop blocking or prove a provider stopped. The README correctly says an aborted request may still incur charges; a late response leaves the adapter blocked with its reservation retained.
- Reservation size is a heuristic and counters/deduplication are process-local. These limitations, need for fresh-source integration, and production billing controls are already explicitly documented.
- A calibrated low-scoring zero-claim result is a shadow estimate, not an instruction to drop evidence or an assurance that extraction was exhaustive.

## Reproduce

Run from any directory:

    node --check /workspace/shared/ifttt-decisions-shadow-20261016/adapter.mjs
    node --test /workspace/shared/ifttt-decisions-shadow-20261016/test/adapter.test.mjs /workspace/shared/ifttt-decisions-review-20261016/adversarial.test.mjs

Evidence: `final-verification.txt`, `archive-verification.txt`, `reviewed-sha256.txt`.

No network, live API calls, credentials, installs, or production changes were used.
