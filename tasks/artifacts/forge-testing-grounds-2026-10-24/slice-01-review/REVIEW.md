# CHANGES REQUIRED — slice 01 exact pins

One **P2 (medium) operational validation defect**, reproduced by two independent controls. The owner 20/20 tests pass; independent controls are **18 passed / 2 failed**. Scoped strict TypeScript and ESLint pass. No app source was repaired or changed. This verdict concerns these pure helpers, not completion of Testing Grounds.

## Finding R1: accepted timestamp precision exceeds comparison precision

`web/lib/forge-testing-grounds/operationalProgress.ts:37`–39, 48–50 and 81 accepts ISO timestamps with microseconds but compares `Date.parse` millisecond values. Consequently it accepts timestamp sequences that violate its own chronological/saved-snapshot validation:

| Control | Input timestamps | Expected | Actual |
| --- | --- | --- | --- |
| Heartbeat before start | start `2026-09-05T11:59:00.000002Z`; heartbeat `2026-09-05T11:59:00.000001Z` | `workStageSchema.safeParse(...).success === false` | `true` |
| Event after saved snapshot | recorded `2026-09-05T12:00:00.000001Z`; heartbeat `2026-09-05T12:00:00.000002Z` | `operationalSnapshotSchema.safeParse(...).success === false` | `true` |

The full otherwise-valid fixtures and failing expectations are in [boundaries.test.ts](boundaries.test.ts), tests ending `[R1]`; original output is in [boundaries.log](boundaries.log). Both are actual failures, not expected-failure annotations. Millisecond-only controls reject invalid ordering correctly; this is a precision mismatch, not a general chronology failure. Input-health chronology already uses the pinned microsecond helper and passes independent cutoff controls.

Impact is limited to operational timestamp consistency within one millisecond. This review found no resulting model/outcome leakage and does not equate this with scientific authenticity or stale-worker fencing. Before accepting this pin, the owner should either preserve the accepted precision when comparing operational timestamps or explicitly reject unsupported precision; retain regression coverage in a new owner receipt. No broad refactor or provider decision is required. The reviewer made no correction and did not rerun/replace the failures.

## Exact reviewed identity

Canonical checkout `octoberBranch`, HEAD `2a5092d37cb863ec92a2a4e609999cf226bfa4a5`. Files are uncommitted/new; HEAD alone does not identify the candidate.

| Source/test file under `web/lib/forge-testing-grounds/` | SHA-256 |
| --- | --- |
| `operationalProgress.ts` | `3d8112f72969ad567d827a237d71f7596df774a74b541f232cc7456070404daf` |
| `operationalProgress.test.ts` | `ec02afa4ad37b48f10f48e76fc9399f2c918c2ef8b1de31fdda93fede58daa8c` |
| `dataHealth.ts` | `0205a7bfd011305e4fc109de9f81f1958b9b623f8a56f79808515ddb6d24e982` |
| `dataHealth.test.ts` | `c806bcf60ccf4c19958e9bc735213481f0239749abc2ef358d063fcb821691d3` |

All **30/30** start pins matched: four candidate files, 19 dependencies, three owner artifact pins, installed PRD/task hashes, HANDOFF and EVIDENCE. Full expected/actual hashes are in [PINS.start.json](PINS.start.json); [PINS.end.json](PINS.end.json) records end integrity. Installed PRD is `33f74b0c7df68483821bcf41e3c446d0eee26f788bbd101c3a92a0087cfbdaa5`; task list is `a0a760cabc61fe15a496b768634858171b32d6673999f3abaf4d8cbcb321c9b2`. The additive source-resolution receipt resolves the older absent-document caveat without rewriting owner history.

Node `v22.11.0`, npm `10.9.0`; installed Vitest `3.2.7`, Zod `3.25.76`, TypeScript `5.7.3` match package-lock versions. Additional lockfile/tooling pins are recorded. Current coordination/leases and the protocol were read. No new workers/subagents; the single Astra owner remains `01a16e4b-590b-72f9-9ced-5684a8c9e030`. The parent/coordination designate other workers GPT-6.1 Sol; local tools provide no independent runtime-model attestation.

## Commands and actual results

All commands ran from `web/`. Exact argv, elapsed times and artifact-local npm environment overrides are in [COMMANDS.json](COMMANDS.json). The isolated reviewer config uses existing Vitest/jsdom/setup and writes its cache under this reviewer directory.

```sh
npm test -- --run --config ../tasks/artifacts/forge-testing-grounds-2026-10-24/slice-01-review/review.vitest.config.mts --maxWorkers=1 --no-file-parallelism
```

**FAILED, exit 1:** 38 passed / 2 failed, three files. Owner tests 20/20 passed; independent tests 18/20 passed. A `punycode` deprecation warning was emitted. No test retry, weakened assertion or self-repair.

```sh
npx --no-install tsc --noEmit --strict --skipLibCheck --target es2015 --module esnext --moduleResolution bundler --esModuleInterop lib/forge-testing-grounds/operationalProgress.ts lib/forge-testing-grounds/operationalProgress.test.ts lib/forge-testing-grounds/dataHealth.ts lib/forge-testing-grounds/dataHealth.test.ts
npx --no-install eslint --report-unused-disable-directives-severity warn lib/forge-testing-grounds/operationalProgress.ts lib/forge-testing-grounds/operationalProgress.test.ts lib/forge-testing-grounds/dataHealth.ts lib/forge-testing-grounds/dataHealth.test.ts
```

**PASSED, exit 0 each**, no output; retained in [scoped-ts.log](scoped-ts.log) and [scoped-lint.log](scoped-lint.log). These are explicit-file checks, not an application type/lint claim. No full suite/build/server/browser/remote validation was run. No heavy check or heavy-lock mutation; these tiny scoped checks do not use the shared Next resource. Claude's `.next-playwright`/:3110 remains untouched. No GIT_DIR override, Git/index/ref mutation, package/config/migration/coordination/master/ledger write, external request, production data access, capture, paid runtime or deployment.

## Boundary results and limits

- **Progress controls passed:** terminal work uses the supplied eligible denominator, not eligible plus exclusions. Failed/skipped work is counted as processed while success remains separate; all-failed 100% work cannot become a completed-success stage. Pending evaluation remains incomplete with zero failures. Unknown-total fitting and zero-denominator work have no percent; no overall percent is invented. Largest-safe totals do not reach 100% while a unit remains pending. Nonfinite, negative, fractional, unsafe, missing and contradictory counts are rejected.
- **Retry scope:** duplicate stage IDs are rejected and counter sums reconcile. There are no logical output/work IDs or acceptance storage, so consistent aggregate numbers cannot prove deduplication. Two attempts counted as two distinct units can pass if the aggregate still sums correctly. Counter atomicity, immutable manifests, fencing, delayed-write rejection and lifecycle transition enforcement remain unimplemented, as the owner discloses.
- **Operational payload controls passed:** unknown top-level, stage, denominator and count fields carrying outcomes, scores or arbitrary messages are rejected. These fixtures prove structural payload separation, not actual server authorization or sealing of other channels. Millisecond malformed/impossible clocks, cancellation and stale-heartbeat distinctions pass; R1 covers the supported submillisecond gap.
- **Health controls passed:** actual zero/fractional values, absent values and nulls stay distinct; no coercion or automatic exclusions. Range/whole-number policy rejects invalid/nonfinite/overflow inputs in the tested declared contracts. All duplicate rows are flagged; overlapping issues do not inflate total affected rows; samples stop at ten and retain exact omitted counts. Source/identity/unit/strength mismatches are diagnosed without reflecting raw inputs. Trusted spec policy explicitly chooses warnings/blockers, while invalid/future knowledge is always blocking; authentic-history policy escalates unknown availability/later capture/missing revision. Microsecond cutoff and freshness inclusivity pass.
- **Safe sample scope:** hostile raw source fields/values/clocks/revisions are absent from serialized reports, malformed identities are withheld, and original input/spec mutations cannot rewrite prior returned reports. Distinct recheck report/input IDs are enforced; the original report remains intact. The bare `/db/runner` link only describes navigation. No repair or navigation was executed.
- **Health coverage is partial:** `cohortId` labels the report but no expected cohort membership is supplied or checked. Empty rows produce zero supplied-row counts; this is not evidence that the intended cohort is complete. `validNumericRows` is a numeric-validity count, not eligibility/accepted coverage; such rows can still have duplicate, identity or provenance defects. `checked` means no configured blockers, not issue-free. Missing and null are distinguished; not-yet-observable/unknown outcome coverage, approved exclusions, per-issue affected dates, multi-source adapters and durable report immutability still need integration. `original_snapshot_clocks_present` is not independent authenticity proof, especially for an empty input array.
- **Outcome safety prerequisite:** the health adapter accepts input rows only. It cannot discover that a caller supplied sealed outcome rows; even counts/shapes/identifiers can leak outcomes. No adapter/API/log/export/object/reveal enforcement exists in this slice. Synthetic shape redaction must not be promoted to full sealing acceptance.

These limits reconcile the partial Task 2.3/2.6, 4.4–4.6 and operational Task 6.6/7.3 claims with PRD §§5–8 and 13. No durable runner, auth, live-data pilot, reconnect persistence, actual statistical metric/probability capability, or complete configure-to-review workflow is accepted. The existing concrete owner decisions are relayed in [DECISION-RELAY.md](DECISION-RELAY.md); no broader architecture study was substituted.

All 30 acceptance-relevant pins remain unchanged at the end. The two shared coordination files changed during concurrent work and are recorded separately in PINS.end.json; their latest owner/resource summaries were reread. The reviewer did not write them.

No review check was blocked, denied or left running. The remaining action is an owner correction/new pin for R1 followed by a focused re-review. Broader product gates remain pending rather than denied. Initial path/glob discovery failures are retained in [DISCOVERY-NOTES.md](DISCOVERY-NOTES.md); they are separate from the two substantive failed controls.
