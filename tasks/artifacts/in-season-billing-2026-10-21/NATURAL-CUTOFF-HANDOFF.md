# Natural monthly season-end verification — 2026-10-21

**Passed:** a separate, still-paying sandbox subscription terminated naturally at **July 1, 2027 00:00 America/New_York (04:00Z)**, with no July invoice. This closes the natural-cutoff gap in the earlier [sandbox handoff](SANDBOX-E2E-HANDOFF.md). No cancellation API, stop worker or cutoff worker caused this result.

## Actual evidence

- Exact approved sandbox `acct_1UDRxGLaomqkve47`, same dedicated restricted credential and approved monthly price. One additional direct clock subscription through the real `createMonthlyBilling` adapter and existing synthetic user B. **Zero additional Checkout sessions**; hosted-case usage remains **3/3**. No new key, scope expansion, user, schema application or production action.
- Clock `clock_1UT4VoLaomqkve47yQ1Tn9bJ`; subscription `sub_1UT4VqLaomqkve47ZuNVP0OP`; schedule `sub_sched_1UT4VqLaomqkve47dnlDaCf6`. Creation outcomes were saved privately before subsequent operations, with stable idempotency keys.
- Initial October 21 payment **177 cents**, then **eight 499-cent paid renewals November–June**. One zero-value DST deferral invoice. All ten invoices stayed paid; none was dated July 1 or later.
- **03:59:59Z:** subscription and schedule active; actual stored access eligible until 04:00Z.
- After advancing to07:00Z: subscription `canceled`, `ended_at=1814414400`; schedule `completed`, `completed_at=1814414400`. Both equal the exact 04:00Z cutoff. No July invoice.
- Signed actual sandbox events were reconciled with explicit test-clock `now` through the real monthly handler and real RPC storage. Nine paid periods persisted. Stored cancellation is 04:00Z, current access expired, and historical access one second before cutoff remains valid.
- The local stop and cutoff jobs remain **pending with zero accounting snapshots**. No worker ran in this scenario. This distinguishes natural provider termination from the previous June-failure cancellation/cleanup experiment.

[Before/after readback](NATURAL-CUTOFF-READBACK.json) and [full sanitized clock receipts](SANDBOX-NATURAL-CUTOFF-RESULTS.jsonl) are the evidence. This continues the explicit virtual-time test convention; it does not prove a deployed scheduler. One observation arrived while Stripe was still advancing and stopped before reconciliation; the harness now waits at most 30 seconds for the same operation without resubmitting it.

## Concrete defect fixed

The real subscription already had `canceled_at=June 1` while it remained active through June. Stripe documents that this field can represent the earlier scheduled-cancellation request; [`ended_at` records the actual end](https://docs.stripe.com/api/subscriptions/object). Using the request time on the eventual deletion event would incorrectly shorten paid June coverage.

The exact four-file delta is:

- `web/lib/in-season/monthlyStripe.ts`: require a verified actual end within the season, with a coherent earlier cancellation request.
- `web/lib/in-season/monthlyWebhook.ts`: use actual `ended_at` for provider cessation; earlier locally accepted immediate cancellation still bounds access through the existing lifecycle reducer.
- `web/lib/in-season/monthlyStripe.test.ts`: missing/late actual-end rejection regressions and updated canceled fixture.
- `web/lib/in-season/monthlyIntegration.test.ts`: scheduled-request versus actual-end regression, including preserved paid coverage before the end.

No other application files or SQL source changed in this follow-up. Task harness/receipt/report changes are listed in [NATURAL-CUTOFF-CHANGED-FILES.json](NATURAL-CUTOFF-CHANGED-FILES.json). Prior concurrent dirty work was preserved. No task commit, push, merge, build or deployment.

## Verification

Node 22.11.0/npm 10.9.0, from `web/`, no GIT_DIR override or dependency changes.

```sh
npm test -- lib/in-season/monthlyIntegration.test.ts lib/in-season/monthlyStripe.test.ts --reporter=json --outputFile=../tasks/artifacts/in-season-billing-2026-10-21/NATURAL-CUTOFF-REGRESSION-TESTS.json
npm test -- components/account/InSeasonPanel.test.tsx lib/in-season/access.test.ts lib/in-season/billing.test.ts lib/in-season/billingRoutes.test.ts lib/in-season/commerce.test.ts lib/in-season/monthlyIntegration.test.ts lib/in-season/monthlyLifecycle.test.ts lib/in-season/monthlyStripe.test.ts lib/integrations/providerSyncAccess.test.ts lib/integrations/providerSyncPaywall.test.ts --reporter=json --outputFile=../tasks/artifacts/in-season-billing-2026-10-21/NATURAL-CUTOFF-FINAL-TESTS.json
NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit --incremental false
npx eslint lib/in-season/monthlyStripe.ts lib/in-season/monthlyWebhook.ts lib/in-season/monthlyIntegration.test.ts lib/in-season/monthlyStripe.test.ts
```

**Passed:** 70 narrow tests; then **338/338 in one final 10-file run**, zero skipped. Full TypeScript exit 0; targeted lint exit 0/no warnings; scoped diff check. These runs overlap; do not sum them or add the earlier 335. The service harness was `node ../tasks/artifacts/in-season-billing-2026-10-21/SANDBOX-NATURAL-CUTOFF.cjs` with `setup`, `pay-initial`, bounded `advance` dates and `verify`. Do not blindly rerun creation/payment modes.

## Refund remains pending

Exactly one read-only status check was made in this follow-up, at **18:43:57 UTC**: `requires_review`, refunds empty. The existing request is [apreq_test_61VcRrl4OlX6lIlYG16VMpuc7lSQy9I9FTdeM4784LQu](https://dashboard.stripe.com/acct_1UDRxGLaomqkve47/test/settings/approvals/requests/apreq_test_61VcRrl4OlX6lIlYG16VMpuc7lSQy9I9FTdeM4784LQu).

The owner's earlier chat acknowledgement did not establish execution. [Prior/current readback proof](SANDBOX-REFUND-STATUS-HISTORY.jsonl) is retained. No resubmission and no additional refund request. This is a pending Stripe approval gate, not an automatic tool-review denial. Approval auto-executes; inspect the outcome before any further action. Temporary forwarding is stopped, so a delayed approval will require resumed isolated reconciliation.

## Remaining release checklist — no live changes authorized

- [ ] Independent fresh-context review of entitlement isolation, signed/fresh payment validation, SQL/RLS/leases, event ordering and billing job failure recovery. This implementation/testing pass is not that independent review.
- [ ] Resolve the existing pending refund, then verify actual payment-specific access readback. Full refund and real dispute suspension/win remain unexecuted. Scope any further synthetic transaction before execution; no fourth Checkout is authorized.
- [ ] Verify remaining operational branches: interrupted/uncertain provider execution, draft/pending-item deletion and recovery. Natural termination and failure-triggered cancellation now have separate real sandbox evidence.
- [ ] Implement/configure and independently review an authenticated, bounded, observable billing worker trigger plus webhook delivery/retry monitoring. Verify competing automatic collection is controlled. **Current worker has no automatic trigger.**
- [ ] Verify live settlement-currency/minimum applicability and required tax/legal terms. First-100 cohort assignment is separate; already-valid supporter/grandfathered grants remain honored.
- [ ] Separately approve live product/price/credential/webhook configuration and hosted migration rollout. The schema was applied only to disposable local databases. Existing live billing/legacy plans remain untouched.
- [ ] Complete and verify public monthly payment/cancellation UI activation only after the above gates, then separately approve the exact deployment candidate and bounded smoke test. **Monthly POST remains 409; production flags remain untouched.**

The restricted credential remains private locally for pending verification. Temporary services were stopped again; [natural-run cleanup receipt](NATURAL-CUTOFF-CLEANUP.json) records process/port/VM checks. Preserve the task diary and isolated data while the approval/verification work remains open.
