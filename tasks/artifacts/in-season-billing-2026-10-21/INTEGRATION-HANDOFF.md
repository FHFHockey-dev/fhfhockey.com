# Executable local billing increment — 2026-10-21

**Current verification, 2026-10-21:** [SANDBOX-E2E-HANDOFF.md](SANDBOX-E2E-HANDOFF.md) supersedes the earlier setup/execution blockers below. The approved isolated sandbox run used 3/3 hosted checkout cases, real local Auth/PostgreSQL, monthly test clocks and retry/cutoff execution. The subsequent [natural-cutoff follow-up](NATURAL-CUTOFF-HANDOFF.md) proved automatic July termination of a still-paying subscription without a July invoice or worker action. Latest local verification passed 338 tests in one 10-file run, TypeScript and targeted lint. Public monthly checkout and automatic billing execution remain disabled. Refund verification is still blocked by the specific pending Stripe dashboard approval; live release is not authorized.

The remainder of this document records the **earlier local implementation checkpoint**. Statements below that no credentials, database writes, subscriptions or payments occurred apply to that earlier phase only. Current results, exact nine-file fix delta, cleanup and remaining limitations are in the linked E2E handoff.

The requested local wiring is written: monthly charging/schedule creation, storage adapter and draft RPCs, signed webhook reconciliation, cancellation, retry/cutoff execution, and later season-pass adjustments. **This is not a completed or enabled payment flow.** Public monthly checkout remains disabled; no worker trigger was added; no database or Stripe transaction was executed in this increment.

**Verification:** one focused run passed **323 tests in 10 files**, zero failures. Full TypeScript, targeted ESLint and `git diff --check` passed. `INTEGRATION-TEST-RESULTS.json` is the test receipt. SQL, real Stripe schedules/invoices/payments, browser checkout and end-to-end persistence remain unverified.

## Executable paths versus unverified dependencies

| Path | Implemented locally | Verification limit |
| --- | --- | --- |
| `monthlyBilling.ts` → `monthlySchedule.ts` | Validates the exact sandbox catalog and explicit minimum; saves an owner-bound attempt/customer; creates a finite schedule using stable idempotency keys; saves the subscription binding before finalizing the initial invoice; returns a verified Stripe hosted-invoice URL | Internal adapter only. No public call path is enabled. Real schedule acceptance, initial line formats, payment-method collection and renewal behavior need sandbox proof |
| `monthlyStore.ts` → draft SQL | Owner-bound monthly ledger, globally unique monthly invoice/payment/event bindings, fenced reconciliation leases, state versioning, payment-specific grants and transactional retry/stop jobs | RPC calls are mocked. SQL syntax/runtime, RLS, global uniqueness, rollback and concurrency have not been executed against a database |
| Signed `in-season-stripe` webhook → `monthlyWebhook.ts` | Fresh subscription/schedule/catalog/invoice/allocation/payment/charge validation; payment/failure/cancellation and full refund/dispute reconciliation; duplicate receipt before fresh adjustment snapshots; failure returns retryable error | Signature/dispatch and adapter chains are mocked, including persistence failure. No webhook forwarder or endpoint was configured |
| `POST /api/v1/account/in-season/cancel` | Requires authenticated owner and exact request fields; missing/foreign subscription both return 404; accepts idempotent cancellation, immediately bounds access and queues billing stop | No premium requirement. No provider call from this route. Actual subscription cancellation depends on the executor; no cancellation UI was activated while purchasing is disabled |
| `monthlyExecutor.ts` | Bounded job claims, state lease, fresh ownership checks, stable provider idempotency keys, accounting snapshots before mutations; retry, cancellation and July cleanup operations | Callable internal worker, with **no cron/API/automatic runner added**. Provider operations are mocked; no actual retry, cancellation, void or delete occurred |
| Season-pass `billing.ts` / `paymentAdjustments.ts` / `billingStore.ts` | Completion plus later refund/dispute dispatch; fresh complete adjustment lists under fenced reconciliation; only that purchase grant changes, with immutable original paid date/cutoff | Draft reconciliation RPC is not applied. Real adjustment events and persistence need isolated E2E |

Monthly webhook dispatch consumes invoice paid/payment-succeeded/payment-failed/payment-action-required events; canceled subscription updates/deletion; refund created/updated/failed, charge refunded and dispute created/updated/closed. Season-pass dispatch handles Checkout completion and the same payment-adjustment families. Irrelevant legacy subscriptions/payments remain outside these handlers. Unknown, incomplete, mismatched or unpersisted facts do not grant access.

## Accepted financial behavior preserved

- USD **499 cents monthly** and **2499 cents one-time season pass**; exclusive cutoff **2027-07-01T04:00:00Z**, midnight America/New_York. No rolling annual product.
- Through Eastern day 14, initial 499 cents. From day 15, include signup day, divide remaining calendar days by the month's days, round once half up. October 21 is 177 cents. First-of-month renewals remain 499 cents.
- Decline below the explicitly verified applicable minimum; no rounding up or balance carry. Minimum/settlement applicability has **not** been verified/configured. The 50-cent value exists only in fixtures.
- Immediate cancellation ends that subscription's access; a saved stop job ends billing. Renewal grace is bounded to 48 elapsed hours from the original first failure, requires a valid preceding paid period and ends on the third failure. Retry intents are +24/+48 hours, capped by coverage/season end. The worker refuses late jobs and checks the clock again before collection.
- Cancellation creates no refund. Manual review remains the policy; no automatic refund execution or seven-day limit was introduced. Only completed full refunds remove that payment's access. Partial refunds retain it unless explicitly adjusted; pending/failed/canceled attempts do not count as completed refunds.
- Disputes suspend that payment and stop future billing. A win restores only original unexpired paid coverage, without restart or renewed grace. Older refunded/disputed payments cannot erase later independently paid periods. Supporter/grandfather grants remain independent.
- At cutoff the worker stops the schedule/subscription, preserves paid/void invoices, voids open/uncollectible in-season invoices, deletes draft invoices and verified pending invoice items, and saves accounting snapshots first. Late payments remain recorded without reopening expired access.

These implement the accepted commerce/Q-02 contract plus TJ's later approved proration/refund/dispute/cutoff decisions. First-100 selection and tax/legal terms are still separate decisions, not reasons to deny already-valid grants.

## Calendar and collection safeguards needing real verification

The monthly adapter uses finite [Stripe subscription schedule phases](https://docs.stripe.com/billing/subscriptions/subscription-schedules), with `end_behavior=cancel` and the final phase ending at the July cutoff in the **creation request**. It does not depend on a later webhook repairing an uncapped subscription.

An initial trial phase defers the recurring charge and adds the explicit initial invoice item. Fall DST uses an earlier UTC phase end plus a one-hour deferral to the next Eastern midnight; spring resets the next phase anchor to Eastern midnight. Zero-value deferral invoices are accepted only for the exact bound trial window and grant no access. This is executable parameter-building and validation code, **not observed proof of Stripe's resulting invoice schedule**. Test clocks must confirm no duplicate/extra invoice, correct invoice periods, and no July renewal. The adapter uses installed Stripe SDK types without upgrading dependencies. Future execution would create an inline initial price as part of the invoice item; no such object was created here.

The retry executor requires an explicit verified configuration identifying the sandbox account and confirming conflicting automatic retries are disabled. That configuration has not been verified or changed. It uses a five-minute execution window after each due time, records definitive 402 declines, and leaves unknown transport outcomes unfinished. In-flight requests, lease expiry, replay and partial cleanup require service-level testing before activation; mocks do not establish exactly-once external execution or a distributed collection-stop guarantee.

## Current UI and route status

- All membership sync upgrade links remain `/account?section=in-season`; anonymous sign-in remains `/auth?mode=sign-in`. None advertises these membership prices and then routes to the legacy $5.99 Draft Pro checkout. Draft Pro-specific purchasing retains its separate legacy route.
- `GET /api/v1/account/in-season/checkout` still reports `monthlyAvailable:false`; monthly POST remains **409**, including with otherwise valid sandbox configuration.
- Season-pass checkout remains unavailable without explicit isolated sandbox configuration. Runtime requires a dedicated test key, exact approved sandbox account, non-production Node mode and loopback app/database URLs; no legacy credential or production database fallback exists.
- The cancellation and signed webhook routes use the same configuration guard. The new monthly creation adapter and worker are internal entry points, not automatically invoked jobs.
- The provider UI/OAuth/API/automatic-refresh inventory is in [the provider audit](../provider-sync-paywall-2026-10-21/REPORT.md). That phase remains local. Free manual tools, plans, public NHL/ownership ingestion and disconnect/revoke access are preserved. Fantrax RSO still has an explicit unsupported adapter, not an invented integration.

## Exact local delta

[INTEGRATION-CHANGED-FILES.json](INTEGRATION-CHANGED-FILES.json) lists **18 application/test/schema paths** changed since the 281-test policy checkpoint: **13 application, 4 tests, 1 unapplied schema**. Eight are newly introduced in this increment; ten were already changed in earlier billing work. The cumulative billing manifest [CHANGED-FILES.json](CHANGED-FILES.json) contains **29 distinct implementation/test/schema paths: 20 application, 8 tests, 1 schema**. Artifacts and the retained working diary are listed separately.

Work remains in canonical `octoberBranch`. The latest observed concurrent HEAD is `1c3759ab9cdaf0ca3a53f216977a808271486a40`; intervening commits since the earlier checkpoint did not touch these billing paths. This task made no commit or branch change. All unrelated dirty/untracked work was preserved.

## Verification commands and receipts

Node **22.11.0**, npm **10.9.0**, owning directory `web/`; no GIT_DIR override, dependency install, lockfile change, build or generated output update by this task.

```sh
npm test -- lib/in-season/commerce.test.ts lib/in-season/monthlyLifecycle.test.ts lib/in-season/monthlyStripe.test.ts lib/in-season/monthlyIntegration.test.ts lib/in-season/billing.test.ts lib/in-season/billingRoutes.test.ts lib/in-season/access.test.ts lib/integrations/providerSyncAccess.test.ts lib/integrations/providerSyncPaywall.test.ts components/account/InSeasonPanel.test.tsx --reporter=default --reporter=json --outputFile=../tasks/artifacts/in-season-billing-2026-10-21/INTEGRATION-TEST-RESULTS.json
NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit --incremental false
npx eslint lib/in-season/billing.ts lib/in-season/billingStore.ts lib/in-season/billingConfig.ts lib/in-season/billing.test.ts lib/in-season/billingRoutes.test.ts lib/in-season/paymentAdjustments.ts lib/in-season/monthlyBilling.ts lib/in-season/monthlyStore.ts lib/in-season/monthlySchedule.ts lib/in-season/monthlyWebhook.ts lib/in-season/monthlyExecutor.ts lib/in-season/monthlyLifecycle.ts lib/in-season/monthlyLifecycle.test.ts lib/in-season/monthlyStripe.ts lib/in-season/monthlyIntegration.test.ts pages/api/v1/webhooks/in-season-stripe.ts pages/api/v1/account/in-season/cancel.ts
```

- **Passed:** 323 tests in one run starting `2026-10-21T17:31:12.873Z`; 10 files, zero failures, zero skipped. The receipt records 57 commerce, 22 lifecycle, 36 provider-fact, 24 monthly integration, 60 season billing, 33 route, 20 central access, 14 sync-access, 49 sync-paywall and 8 panel tests.
- **Passed:** full TypeScript, exit 0, after the final test changes. Log: `/tmp/fhfh-billing-integration-types-final.log`. Targeted ESLint exit 0, no warnings. Repository `git diff --check` passed. A final SQL source review fixed ambiguous job-token naming; SQL was not executed.
- **Not run:** database migration/RPC/RLS/concurrency tests; real Stripe customer/subscription/payment/refund/dispute/retry/cleanup operations; test clocks; browser hosted checkout; complete payment-to-persisted-entitlement E2E; deployment or production smoke tests.
- The earlier 281 and 291 are overlapping historical single runs. The original provider-gate **636** was deduplicated latest-per-file evidence across overlapping runs, **not one final run**. Do not sum these counts.

## Exact remaining permissions and release gates

**Pending, not denied or uncertain:** isolated E2E cannot run within the present credential/database/external-operation exclusions. The minimum next setup is:

1. Permit access/configuration of a dedicated sandbox test credential for `acct_1UDRxGLaomqkve47`, limited to the relevant test catalog/customer/schedule/invoice/payment/adjustment operations. No live key. No credential values in reports.
2. Permit a local webhook forwarder and its signing secret for the exact `/api/v1/webhooks/in-season-stripe` route, or separately approve an endpoint. No public endpoint/access expansion has occurred.
3. Permit initialization of disposable loopback Supabase/Auth storage, throwaway users and application of the reviewed prerequisite grant schema plus this draft there. Execute ownership/RLS/atomicity/concurrency/rollback tests before relying on storage. No production fallback.
4. Verify/configure the applicable charge minimum and settlement currency, and the isolated sandbox retry settings. Required existing configuration names include `IN_SEASON_BILLING_SANDBOX_ENABLED`, `IN_SEASON_SANDBOX_ORIGIN`, `IN_SEASON_STRIPE_SECRET_KEY`, `IN_SEASON_STRIPE_WEBHOOK_SECRET`, `IN_SEASON_STRIPE_MINIMUM_CHARGE_CENTS`, `IN_SEASON_STRIPE_MINIMUM_ACCOUNT_ID`, `IN_SEASON_STRIPE_SETTLEMENT_CURRENCY`, `IN_SEASON_STRIPE_MINIMUM_VERIFICATION_REFERENCE`, and isolated Supabase URL/public/service-role configuration. No values were accessed or changed.
5. Approve a bounded sandbox test matrix before external execution: initial full/prorated/too-small charges; successful and failed renewals/retries; cancel/replay/out-of-order events; full/partial/failed refunds; dispute open/win/loss; account isolation; October/November/December, March/April and June/July test-clock transitions; interrupted persistence and cleanup. It includes disposable customers, finite schedules, inline initial prices, test payments and adjustment/cleanup mutations. Inspect uncertain outcomes before retrying. Public monthly checkout remains disabled until these gates pass.

**Separate live release approvals:** production catalog/credentials, webhook exposure, production schema/release plan, taxes/customer terms and deployment/validation. This sandbox-only runtime/schema is not a ready production release candidate. First-100 cohort selection requires a rule if new cohort grants are to be assigned; it does not block honoring existing valid Patreon/supporter/grandfather/legacy Draft Pro rights. Existing central sync entitlement intentionally still honors any valid legacy Draft Pro grant, including a later valid $5.99 purchase.

## External and deployed status

**This increment:** zero external service mutations, credential operations, database writes, applied migrations, commits, pushes, builds or deployments. Earlier verified sandbox catalog creation is unchanged: product `prod_VU0CGry3DRLdud`, monthly `price_1UT2C4Laomqkve47zG3qQJq2`, one-time season `price_1UT2FBLaomqkve47tXDflfKF`. No subscription, payment or additional catalog object was created after that receipt. Legacy Draft Pro and all live objects remain untouched.

There is no outstanding auto-review denial and no uncertain external mutation. Local code/mocked checks are complete for this increment; isolated integration verification and any activation remain pending. Keep the task open for those steps; no deployment or archive is authorized.
