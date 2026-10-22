# Attempt-specific manual retry recovery — local handoff

**Later correction:** [job isolation and failure identities](../job-isolation-failure-identities/HANDOFF.md) retains this receipt strategy while isolating per-job failures, making urgent work reachable across batches and replacing retry-ordinal counts with distinct confirmed identities. Its manifest/checks are the latest delta.

This supersedes the earlier `decline-recovery-fix` count-only implementation. Manual retry recovery no longer treats an unpaid invoice or its retry-schedule count as proof that a particular manual attempt declined.

## Implemented behavior

- Before collection, the existing durable job snapshot now includes the invoice, attempt number and exact provider idempotency key. A resumed job with a recorded start does **not** call `invoices.pay` again, including during the original window.
- A definitive 402 response from that payment call is recorded as a separate durable `retry_declined` receipt with the same attempt identity **before** the monthly state is committed. A 402 from a later retrieval cannot be mistaken for a payment response.
- Recovery validates the receipt's job/invoice/attempt/key/status binding. A valid receipt reconstructs the known failed attempt using the original first-failure timestamp and existing monotonic reducer. A third decline produces `p_stop: true` and no new retry intents, even when the provider's invoice count remains one.
- If a payment response was lost and there is no durable definitive receipt, a still-unpaid invoice leaves the job **unfinished with an explicit unresolved-outcome error**. Neither a low nor high `invoice.attempt_count` turns that unknown result into a decline. Grace is not restarted, failure counts are not increased, and the job is not falsely acknowledged.
- A later verified paid invoice can resolve that unfinished job through the existing payment/refund/dispute reconciliation. Missing/malformed history or mismatched receipts fails closed. Legacy pre-call snapshots lacking the new key field remain recognizable as an unresolved started attempt; they are not replayed as a new charge.

The installed Stripe SDK's `web/node_modules/stripe/types/Invoices.d.ts:122` documents why the invoice retry-schedule count cannot identify a manual attempt. This increment used that local source and mocked fixtures; it made no external Stripe or documentation request.

## Exact delta

Two application files and one test file:

1. `web/lib/in-season/monthlyExecutor.ts`: durable attempt/decline receipts, bound read-only recovery, and explicit unresolved outcomes; removes the preceding count-only inference.
2. `web/lib/in-season/monthlyStore.ts`: expose the already-existing `accounting_snapshots` field in the job type.
3. `web/lib/in-season/monthlyIntegration.test.ts`: persistence-aware snapshot fixture and recovery regressions.

[CHANGED-FILES.json](CHANGED-FILES.json) records baseline/current hashes and exact patch filenames. The existing SQL already returns the complete job row and appends snapshots under the job lease; **no schema or migration change/application was needed**. Other prior paywall/billing edits and concurrent work were preserved.

## Verification

- [REPRODUCTION.json](REPRODUCTION.json): two new unchanged/high-counter unknown-response cases failed before the fix; 48 unrelated cases were excluded by the test-name filter.
- [FIRST-FIX.json](FIRST-FIX.json): both selected cases passed after implementation.
- [FOCUSED-RESULTS.json](FOCUSED-RESULTS.json): 119/119 passed across three files before the final receipt-acknowledgement regression.
- [FINAL-RESULTS.json](FINAL-RESULTS.json): **153/153 passed, four files, zero failed/skipped, one final run**. Includes monthly lifecycle/Stripe validation and billing-route regressions. Counts overlap earlier runs and are not additive.
- Targeted three-file ESLint passed with zero warnings ([LINT.json](LINT.json)). Full TypeScript passed, exit 0 ([TYPECHECK.json](TYPECHECK.json)). Baseline-relative added-line whitespace checks passed.

Regression evidence covers unchanged and misleading provider counters, unknown reads before/after the five-minute window, delayed success, state-write failure before/after commit, decline-receipt write failure before persistence and lost acknowledgement after persistence, known third-failure stopping, original grace/retry timing, duplicate recovery, missing/malformed history, wrong invoice/attempt/key/status receipts, and legacy unresolved snapshots. Provider calls, RPC persistence and lease behavior are mocked here, not newly exercised against services.

Commands from `web/`, Node 22.11.0/npm 10.9.0, no `GIT_DIR` override:

```sh
npm test -- lib/in-season/monthlyIntegration.test.ts -t 'keeps a lost-response manual retry' --reporter=json --outputFile=../tasks/artifacts/in-season-billing-2026-10-21/manual-retry-recovery/REPRODUCTION.json
npm test -- lib/in-season/monthlyIntegration.test.ts lib/in-season/monthlyLifecycle.test.ts lib/in-season/monthlyStripe.test.ts lib/in-season/billingRoutes.test.ts --reporter=json --outputFile=../tasks/artifacts/in-season-billing-2026-10-21/manual-retry-recovery/FINAL-RESULTS.json
npx eslint lib/in-season/monthlyExecutor.ts lib/in-season/monthlyStore.ts lib/in-season/monthlyIntegration.test.ts
NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit --incremental false
```

## Limits and status

This completes the requested **fail-closed, recoverable unresolved-job** alternative. It does not claim to discover a definitive decline when no attempt-specific outcome survived. Such a job remains unfinished for later read-only reconciliation or inspection; it never authorizes another payment or fabricates a third failure/stop decision. Definitive persisted third-decline receipts do restore the existing stop semantics. A future operational trigger must surface unresolved jobs rather than treat them as success; no trigger is enabled by this patch.

Independent re-review and real service recovery/refund/dispute verification remain separate. Monthly public checkout remains disabled. No external calls, new sandbox cases, credentials/configuration changes, database writes, migrations applied, service starts, commits, pushes, builds or deployment occurred in this increment. There is no outstanding permission denial or uncertain external action from this increment.
