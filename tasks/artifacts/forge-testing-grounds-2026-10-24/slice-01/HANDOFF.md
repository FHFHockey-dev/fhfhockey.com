# Slice 01 — frozen for independent review

Local implementation only, 2026-10-24. Scout owns acceptance/integration. No independent review or live acceptance is claimed.

## Changed files and evidence

- `web/lib/forge-testing-grounds/operationalProgress.ts` — strict operational schema, reconciled stage denominators, distinct terminal/pending counters, elapsed/heartbeat/stale states, no percentage for fitting/empty denominator, no overall percentage or outcome-bearing envelope fields.
- `web/lib/forge-testing-grounds/operationalProgress.test.ts` — 10 synthetic tests.
- `web/lib/forge-testing-grounds/dataHealth.ts` — numeric input-only health, valid zero versus missing/null/malformed, duplicates/staleness/identity/units/strength/source checks, microsecond knowledge cutoffs, reconstructed-history labels, bounded safe shape/ID samples, manual investigation and distinct recheck IDs.
- `web/lib/forge-testing-grounds/dataHealth.test.ts` — 10 synthetic tests.

All four were new/absent at baseline. `OWNERSHIP.md` was written before source edits. `EVIDENCE.json` pins all four files, runtime/config and inspected discovery dependencies against HEAD `2a5092d37cb863ec92a2a4e609999cf226bfa4a5`; no candidate commit was made. `checks.log` retains actual results. `CAPABILITIES.md` records supported/unverified targets, actual potential parameter values, existing runner constraints and pending choices.

Focused Vitest: **20/20 passed**. Scoped strict TypeScript and scoped ESLint: **passed**. Explicit new-file whitespace inspection: **passed**. No test failures/retries or weakened tests. Original discovery failures and the failed parent-message attempt are recorded. No full app checks, browser tests or screenshots: this slice has no UI/server. No network/provider/production request, paid execution, deployment, capture, repair, schema/shared-source edit or Git mutation.

## Source identity caveat

Both entire planning documents were actually read via supported Library `read` with `has_more=false` (PRD 232 lines; task list 115 lines). Local installation failed in the coordinator and was not retried. PRD returned version 1. Task list's requested version 0 comes from delegation; read metadata returns `version_id=null`, with unchanged creation/modification time `2026-10-24T13:24:34.047110Z`. Each read text is one byte shorter than stored-file metadata; EVIDENCE hashes the returned complete text, not an invented materialized-file checksum. Neither canonical Mac document is claimed installed.

## Requirement and steer reconciliation

| Requirement/steer | State for this slice | Evidence or gap |
| --- | --- | --- |
| Completed work only; real denominators; no fitting percentage | Satisfied within pure projection | Counter reconciliation, heartbeat and pending/cancellation tests. Atomic accepted-output persistence remains incomplete. |
| Data health: zero/missing/malformed/duplicates/staleness/identity/units/strength/history | Partial implementation | Numeric field adapter and tests; complete multi-source cohort/adapters/report persistence still needed. |
| Immutable history/recheck after repair | Partial implementation | New report + input identities required, old return values not mutated. Durable immutability/storage not implemented. |
| Chronology/authenticity | Partial implementation | Known future knowledge blocks; missing/later evidence labeled reconstructed; no claim that clock presence proves authenticity. Full model/transform/calibration lineage pending. |
| Owner-only and reveal safety | Incomplete | Operational envelope rejects unknown fields; actual server auth, store access and outcome-channel enforcement absent. Input-only health counts must not be computed from sealed outcome rows. |
| Full configure → preflight → remote launch → reconnect → review | Incomplete, unchanged acceptance target | No integrated API/UI/runner/storage. This is not a viewer substitute or finished v1. |
| Guided controls, count/probability metrics and plots | Incomplete | Verified constants/head discovery only; no unapproved bounds, distribution conversion or metrics. |
| Preserve Release C and existing consumer gates | Satisfied locally | No edits or executions; only retained metadata read. Exact protected chronology/reveal still a prerequisite to real evaluation. |
| No automatic repair / AI cost / infrastructure | Satisfied | Zero such calls or changes; only bare `/db/runner` navigation descriptor. |
| Ordinary single Astra worker | Satisfied in staffing/actions | No subagents; no `/goal`; actual model/reasoning not separately exposed by local runtime and not falsely verified. |
| Viewer-only and live model scores | Intentionally superseded by accepted S01/S02 | No narrowed release claim or running quality display. |

## Remaining decisions and next bounded work

Pending, not denied: runner/storage choice and operating costs/bounds/retention; actual owner configuration/server-session integration; baseline/candidate and guided parameter bounds; event mapping/validation and statistical conventions; source/chronology/settlement/reveal/protected-block contracts; exact real-pilot data/runtime/budget approval. No uncertain external operation remains running.

Parent clarified owner access must remain TJ-only and a fail-closed local explicit-owner policy can proceed with synthetic fixtures. That is the next disjoint slice, not a reason to wait for hosted activation. Parent also clarified continuous scores can support rank-only ROC-AUC against declared binary labels; such a diagnostic does not qualify probability metrics or the validated-probability pilot. No silent scope change is made here; propose exact evaluation conventions before dependent implementation.

Please have a fresh Sol reviewer inspect these pinned files, requirements and evidence. Preserve this packet unchanged; any correction receives a new slice/receipt. The working diary remains local and is not release acceptance evidence.
