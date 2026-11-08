# R21 correction: keep a configured pilot retain-only under the minute scheduler

**Status: owner-tested locally; independent review pending.** The guard has no effect unless pilot configuration is present. Nothing was activated, committed or deployed.

## Defect

R21 was found by `../review-rpc-deadline-reconciliation-v1/REVIEW.md`. `retryPendingLineSourceEvents()` had no guard for controlled intake. The every-minute `/api/internal/starter-board` cron, with scheduler and capture enabled, could therefore ask `update-line-sources` and `update-lines-ccc` to process today's pending raw rows. That includes rows the pilot retained, which the accepted policy says must remain pending.

Before evidence: `../review-rpc-deadline-reconciliation-v1/evidence/independent-R21-scheduler-processes-pilot-sources.json`. Under full pilot configuration with an absent evaluation cohort, it shows 6 processor requests.

## Change (3 files, `owned-source-sha256.json`)

- `web/lib/sources/iftttIntakePolicy.ts`: adds the exported `iftttIntakePilotConfigured()`. It is the exact predicate `iftttIntakeConfiguration` already used, and `iftttIntakeConfiguration` now calls it.
- `web/lib/sources/lineSourceIftttReceiver.ts`: `retryPendingLineSourceEvents()` returns `{ attempted: 0, failed: 0, results: [], skipped: "controlled_intake" }` whenever any pilot flag, policy or stop is present.
- `web/lib/sources/lineSourceIftttReceiver.test.ts`: two scheduler cases (full pilot, and stop only). Each expects no processor fetch, no RPC, no dispatch, and `capture.skipped = "controlled_intake"`.

Before-copies are in `before/`; diffs are in `evidence/*.diff`.

Unchanged:

- `pages/api/internal/starter-board.ts`. It already reports `capture` as returned, and `skipped` passes through.
- Every SQL selection.
- Behavior with no pilot configuration: the existing 6-request scheduler tests still pass.

## Checks

| Check | Result | Evidence |
|---|---|---|
| Nearest Vitest: `lineSourceIftttReceiver.test.ts` (14) and `iftttIntakePolicy.test.ts` (20) | 34/34 pass | `evidence/nearest.log`, `nearest-results.json` |
| Copied actual-PG regression (88 PG, 10 SDK, 20 policy, 14 receiver) on private PG17 | 132/132 pass | `evidence/regression132.log`, `regression132-results.json` |
| ESLint on the 3 changed files | exit 0 | `evidence/lint.log` |
| Full `tsc --noEmit` (8 GB heap), one run after all edits | exit 0, no diagnostics | `evidence/full-tsc.log` |

## Operational meaning (also in `../rollout-approval-2026-10-17/ROLLOUT-APPROVAL.md`)

While any pilot variable is present:

- No IFTTT source is retried or processed by the scheduler.
- In-scope receipts are retained only.
- Out-of-scope receivers fail closed with 503.

Site line and news updates from IFTTT therefore pause for the pilot window. Retained rows are processed later only under a separately approved cohort or processing decision.
