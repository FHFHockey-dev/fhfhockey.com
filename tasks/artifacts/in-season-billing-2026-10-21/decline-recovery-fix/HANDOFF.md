# Verified decline recovery — P2 local correction

**Historical checkpoint, superseded:** [manual-retry-recovery/HANDOFF.md](../manual-retry-recovery/HANDOFF.md) removes this count-only inference. The current implementation uses attempt-specific durable receipts and leaves unknown outcomes unfinished; the fixture/count results below describe the earlier intermediate implementation only.

The reported fixture reproduced and is repaired: two stored failures, a third provider decline with a lost response, and read-only recovery six minutes later now persist **three failures**, retain the original first failure time, and derive **`p_stop: true`, `p_retries: []`** before completing the job. The regression includes a still-active schedule with a future $4.99 June phase and asserts exactly one payment call across the failed request and recovery.

## Exact delta

- `web/lib/in-season/monthlyExecutor.ts`: after the existing fresh unpaid invoice/allocation/payment-intent checks, validate the provider's cumulative attempt count and reduce a failed observation before commit/finish. Reuse the saved first-failure timestamp. The existing reducer takes the maximum count; recovery never adds one or substitutes the requested job attempt.
- `web/lib/in-season/monthlyIntegration.test.ts`: add the third-decline/lost-response/stop-intent regression, duplicate recovery checks, stale counts 0/1/2 without inflation or shifted retry/grace anchor, and invalid counts that must remain unfinished. The fixture accepts a May start to include the future June phase.

[CHANGED-FILES.json](CHANGED-FILES.json) contains exact baseline/current hashes and links to the two baseline-relative patches. No schema, route, provider-sync, configuration or dependency changes.

## Evidence

- [REPRODUCTION.json](REPRODUCTION.json): one selected regression failed before the implementation, with stored count 2 instead of 3; 41 unrelated cases skipped by the name filter.
- [FIRST-FIX.json](FIRST-FIX.json): that selected regression passed after the fix.
- [INTERMEDIATE-RESULTS.json](INTERMEDIATE-RESULTS.json): 106 passed, three failed because the new test used `dueAt` instead of the existing retry-intent field `at`; corrected the assertion, not the contract.
- [FINAL-RESULTS.json](FINAL-RESULTS.json): **109 tests passed in three files, zero failed/skipped, one final run**. Do not add these to prior overlapping counts.
- Targeted ESLint passed with zero warnings ([LINT.json](LINT.json)); full TypeScript passed, exit 0 ([TYPECHECK.json](TYPECHECK.json)). Baseline-relative added-line whitespace checks passed.

Commands, run from `web/`, Node 22.11.0/npm 10.9.0, no `GIT_DIR` override:

```sh
npm test -- lib/in-season/monthlyIntegration.test.ts -t 'persists a third decline recovered' --reporter=json --outputFile=../tasks/artifacts/in-season-billing-2026-10-21/decline-recovery-fix/REPRODUCTION.json
npm test -- lib/in-season/monthlyIntegration.test.ts lib/in-season/monthlyLifecycle.test.ts lib/in-season/monthlyStripe.test.ts --reporter=json --outputFile=../tasks/artifacts/in-season-billing-2026-10-21/decline-recovery-fix/FINAL-RESULTS.json
npx eslint lib/in-season/monthlyExecutor.ts lib/in-season/monthlyIntegration.test.ts
NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit --incremental false
```

## Limit and re-review target

**This repairs the reported cumulative-count case, not every possible unknown manual decline.** The installed Stripe SDK's `web/node_modules/stripe/types/Invoices.d.ts:122` states that manual attempts after the first do not increment the invoice retry-schedule count; it also notes scheduled retries can increment it without an executed payment. Thus a provider count below the requested job attempt is not proof that a lost-response manual retry failed. The patch intentionally does not infer that missing failure or inflate the counter to the job number.

Independent re-review should assess this exact normalization fix and the remaining manual-attempt evidence limitation. Stronger reconciliation of a manual decline whose invoice count did not advance needs durable evidence identifying that attempt's actual outcome; it is not established by these fixtures. No external call was made to resolve that service behavior. Do not claim the complete unknown-decline lifecycle or live release ready on this result.

No blocker prevented this bounded local correction. No external calls, credentials/configuration changes, database writes, applied migrations, service starts, new Checkout cases, commits, pushes, builds or deployment occurred. Concurrent dirty/untracked work and the prior P1 corrections were preserved. Public monthly checkout stays disabled; worker/configuration and real refund/dispute verification remain separate release blockers.
