# Local monthly billing policy increment — 2026-10-21

**Historical 281-test checkpoint.** The later executable adapter/storage/webhook/worker and season-pass adjustment work supersedes this document's unfinished-wiring statements. See [INTEGRATION-HANDOFF.md](INTEGRATION-HANDOFF.md) for current status and the single-run 323-test receipt. The body below records what was and was not implemented at the policy checkpoint.

The approved monthly policy logic and provider-fact validators are implemented and tested locally. **Monthly purchasing is still disabled, and the full billing integration is not complete.** This increment makes no Stripe calls, database writes, applied migrations, credential changes or deployments. The sandbox catalog receipt in REPORT.md is unchanged.

## Accepted decisions implemented

The existing accepted contract in `web/lib/in-season/commerce.ts` and `tasks/artifacts/security-audit-fixes-2026-10-18/Q-02-auth-entitlements-billing.md` established USD 4.99 monthly, USD 24.99 one-time season pass, first-of-month renewals, immediate cancellation, 48 elapsed hours of grace, retries at +24/+48 hours, and the exclusive July 1, 2027 00:00 America/New_York cutoff. The subsequent trusted TJ approvals supersede the old Q-02 and initial REPORT.md entries that called these policies undecided:

- Through the 14th in New York, the first charge is 499 cents. From the 15th, include the signup calendar day, divide remaining days by that month's days, then round once to the nearest cent, half up. October 21 is 177 cents. Renewal periods remain full 499 cents.
- An initial charge below the verified applicable Stripe minimum is declined, with a clear explanation. It is neither rounded up nor carried forward. The minimum must identify the exact sandbox account, charge/settlement currencies and verification reference. No settlement eligibility or minimum value has been assumed/configured; 50 cents appears only in mocked fixtures.
- Cancellation alone creates no refund. Refund requests require manual review. Only completed full refunds remove the affected payment's access; partial refunds retain it unless explicitly adjusted. Pending, failed or canceled refunds do not count as completed refunds. There is no seven-day request limit or automatic refund entitlement/execution.
- Disputes suspend the affected payment and request an end to future subscription billing. A win restores only the original unexpired coverage, and never restarts billing. Independent paid periods, supporter grants and grandfather grants remain separate.
- Season end stops collection, voids unpaid in-season invoices, clears pending in-season invoice items, and retains accounting records. Late payments remain in the ledger and never reopen expired access. Tax/legal terms remain unchosen.

## What the code does

| Module | Implemented behavior |
|---|---|
| `commerce.ts` | Approved policy constants, integer proration, Eastern date/anchor calculations, explicit verified-minimum quote gate |
| `billingConfig.ts` | Disabled monthly checkout explanation; optional minimum configuration parser with no default |
| `monthlyLifecycle.ts` | Owner/subscription-bound invoice/payment ledger, duplicate-event checks, immutable invoice/payment/period binding, order-independent paid/failure facts, immediate cancellation, bounded renewal grace and retry intents, payment-specific refund/dispute history, central entitlement resolver integration |
| `monthlyStripe.ts` | Exact sandbox subscription/price/customer/invoice/payment-intent/charge validation; refusal of uncapped subscriptions; normalized failure/refund/dispute facts; owner-scoped cancellation and cutoff cleanup command plans |

The plan computes Eastern first-of-month coverage and requires `cancel_at=2027-07-01T04:00:00Z` in the same future subscription-creation request. **It does not create or configure a Stripe subscription.** Merely returning that field is not proof of a provider cutoff guarantee. A fixed UTC monthly anniversary can differ from Eastern midnight across DST; the charging adapter must handle that without duplicate/extra invoices.

Monthly grants have one reference per invoice/payment, rather than one mutable subscription-wide grant. Refunds on an older period cannot erase later independently paid coverage. Grace requires an actually paid preceding period, the original first-failure time, fewer than three failed attempts, and a window capped at both the period end and season end. A later failure delivery cannot start a fresh 48-hour window. The third failure produces a cancellation command plan. Cancellation acceptance is idempotent and immediately bounds that subscription's grants.

Refund snapshots carry their server observation time; older snapshots cannot overwrite newer facts, and conflicting same-time snapshots fail. This is necessary because a previously successful refund can later fail or require further action. See [Stripe's refund state documentation](https://docs.stripe.com/refunds#failed-refunds). The future durable dispatcher must deduplicate a previously committed event **before** retrieving a new snapshot, and atomically commit event receipt, state version, purchase-grant projection and outbox work. The current pure reducer is not that durable dispatcher.

`monthlyStopCommands` returns cancellation, invoice void/delete, and pending-invoice-item delete instructions with stable idempotency keys and an accounting-snapshot prerequisite. It never executes them. Earlier cancellation/disputes stop future billing but do not automatically forgive earlier unpaid balances; the approved invoice-void policy is applied at season end. Paid invoices are preserved. Cleanup rejects mixed customer/subscription inventory.

## Verification actually run

Node **22.11.0**, npm **10.9.0**, from `web/`, without GIT_DIR or dependency changes:

```sh
npm test -- lib/in-season/commerce.test.ts lib/in-season/monthlyLifecycle.test.ts lib/in-season/monthlyStripe.test.ts lib/in-season/billing.test.ts lib/in-season/billingRoutes.test.ts lib/in-season/access.test.ts lib/integrations/providerSyncAccess.test.ts lib/integrations/providerSyncPaywall.test.ts components/account/InSeasonPanel.test.tsx --reporter=default --reporter=json --outputFile=../tasks/artifacts/in-season-billing-2026-10-21/MONTHLY-TEST-RESULTS.json
NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit --incremental false
npx eslint lib/in-season/commerce.ts lib/in-season/commerce.test.ts lib/in-season/billingConfig.ts lib/in-season/monthlyLifecycle.ts lib/in-season/monthlyLifecycle.test.ts lib/in-season/monthlyStripe.ts lib/in-season/monthlyStripe.test.ts
```

- **Passed:** 9 files, **281 tests in one final run**, zero failures. Exact receipt: `MONTHLY-TEST-RESULTS.json`. Includes existing checkout, shared entitlement, provider API failure/bypass and manual-preservation regressions.
- **Passed:** full TypeScript check, exit 0. The first type check exposed optional Stripe invoice IDs; the validators now reject missing IDs and accept expanded provider references before returning normalized facts.
- **Passed:** targeted ESLint, exit 0, no warnings. `git diff --check` passed.
- New cases include 28/29/30/31-day arithmetic, day 14/15, DST and June/July boundaries, explicit settlement/minimum checks, cross-account objects, wrong prices/periods/payment chains, missing cutoff, cancellation/replays, reordered failures/payments, late payments, old-period refunds, partial/pending/failed refunds, refund reversal, disputes/wins/losses and independent grandfather coverage.
- **Not run:** Stripe test payments/subscriptions/refunds, browser checkout, database execution/concurrency, retry worker, cleanup execution, test clocks or end-to-end grant persistence. Mocks and command plans do not verify these.

The 281 overlaps the earlier single-run 291 and original paywall latest-per-file 636. Do not sum these counts as distinct tests. The original 636 was never one final run.

## Exact local delta and concurrent work

Seven application/test paths were changed in this increment (four application modules and three test files); see `MONTHLY-CHANGED-FILES.json` for exact names. No new UI, route, schema, dependency or lockfile changes were made in this increment. Existing upgrades still route to `/account?section=in-season`, never the legacy $5.99 checkout. `GET /api/v1/account/in-season/checkout` still reports `monthlyAvailable:false`; monthly POST returns 409 before any Stripe creation. The existing webhook handles season-pass checkout completion only.

Canonical `octoberBranch` was retained. HEAD advanced through concurrent work from the earlier recorded `6b5e4ea2d5cf737f1b468519221c4d02f8cbb785` to observed `c04a3626b07fe261fe1b4092db8de82d545d5e33`; this agent did not commit or switch branches. The intervening commit diff did not touch this increment's in-season implementation paths. Other dirty/untracked work was preserved.

## Remaining work and exact permission boundaries

**Local engineering still needed; not a pending business-policy decision:**

1. The safe monthly subscription/initial-payment adapter must satisfy the full-through-14/prorated-from-15 invoice amounts, calendar anchors and atomically installed season cutoff. The installed Checkout subscription API cannot simply accept `cancel_at`; a post-payment repair webhook is insufficient. The current strict invoice fixture describes the required bound payment, not an observed Stripe invoice from that missing adapter.
2. Implement durable owner-bound monthly subscription/invoice/payment storage, globally unique payment/event bindings, atomic state/grant/outbox transactions and signed monthly webhook dispatch. The existing unapplied SQL is **season-pass only**. Per-state mocks do not establish cross-subscription uniqueness or concurrent DB safety. Authenticate signed events and verify the sandbox account before calling the new fact helpers; retrieve subscription/invoice/refund/dispute objects and enforce fresh snapshot ordering.
3. Connect bounded retry/cancellation/cutoff execution, persist accounting snapshots before destructive cleanup, validate complete owner-scoped inventory, and reconcile partial failures without restarting billing. Handle any in-flight payment intents through their verified invoice bindings; no complete provider collection-stop guarantee has been demonstrated.
4. Apply the approved later-refund/dispute policy to the season-pass fulfillment path as well. That earlier adapter still rejects non-intact charges at first fulfillment and does not consume later adjustment events. Do not enable it for real sales as currently written.

**Sandbox E2E is pending excluded permissions, not denied or uncertain:** access/configure dedicated sandbox test credentials; configure a local webhook signing secret/forwarder (or separately approved endpoint); initialize disposable isolated Supabase/Auth storage with throwaway accounts and apply reviewed draft migrations there; then authorize a bounded set of sandbox customers, subscriptions, test payments, declines, refund/dispute events and test-clock advances. No production fallback. The minimum's settlement applicability must be independently verified and configured. No credential, listener, database or external test action was attempted in this increment.

**Separate live approvals:** live catalog/keys, endpoint exposure, production migration/release plan, taxes and customer-facing legal terms, any live validation/deployment. Nothing here authorizes those actions.

**First-100 cohort:** choosing/assigning a new first-100 cohort still needs a rule. It does not block honoring already valid Patreon/supporter/grandfather/legacy Draft Pro rights. Existing central logic preserves every valid legacy Draft Pro grant, including a later valid $5.99 purchase; this increment does not narrow that population or alter grant records.

There is no outstanding auto-review denial and no uncertain external mutation. Keep this task open for the remaining implementation and isolated verification; no deployment is authorized.
