# Billing owner handoff — 2026-10-22

**Later local increment:** the first two local work packets below are now implemented behind inactive gates in [the new entrypoint review packet](inactive-entrypoints-2026-10-22/HANDOFF.md), with 307 passing tests, TypeScript/lint and unchanged prior core hashes. Its owner-lookup SQL remains an unapplied review draft. That new delta still requires independent review and service verification. The remainder records the preceding readiness baseline; its descriptions of missing public wiring/worker entrypoints are historical, not the latest source state.

**Owner: Astra. Local implementation is reviewed; billing is not ready for activation.** This reconciliation inspected existing code and receipts only. No new application edits, tests, service calls, credential access, database operations or deployment. Observed checkout: `octoberBranch`, HEAD `a811b0762ffe29006c3df7eaa4c19bf18deecda3`, with substantial concurrent dirty/untracked work preserved. The separately accepted Yahoo `rosterPlanning.ts` packet was not edited.

## What is complete and what remains inactive

- Existing central entitlements gate provider sync. Valid supporter, grandfathered and retained Draft Pro grants remain valid; manual workspaces remain free. The completed broad surface audit is not repeated here.
- Monthly schedule/payment adapter, signed webhook reconciliation, durable payment-specific grants, owner-bound cancellation, retry/stop/cutoff executor and season-pass adjustment handling exist locally. Unknown outcomes stay unfinished without repeat collection; confirmed failure identities prevent duplicate or skipped-slot overcounts; failed jobs do not abort later cleanup.
- `POST /api/v1/account/in-season/checkout` still rejects monthly requests with 409. `InSeasonPanel.tsx` has a disabled monthly button and no monthly management UI. Its current redirect validation accepts `checkout.stripe.com`; the internal monthly adapter returns a hosted invoice at `invoice.stripe.com`. Public wiring must explicitly accommodate the correct destination before activation.
- `createMonthlyBilling` and `runMonthlyBillingJobs` have no application caller outside their definitions/tests. There is no automatic billing worker trigger. The cancellation API exists but public management UI remains unfinished.
- `billingConfig.ts` deliberately rejects production and requires loopback storage/origin plus the exact approved sandbox catalog. The draft schema uses sandbox tables/grant references. Live support needs a reviewed local adaptation and rollout plan; changing an environment flag alone cannot enable it safely. No deployed environment was inspected this turn.

## Evidence reconciled

| Evidence | Result and limit |
| --- | --- |
| Latest Sol review, thread `01a15fd2-1d7a-75ac-b30d-a34a7d3d3026` | Both final findings closed; 235/235 independently rerun across six files; both original reproductions passed; seven hashes matched. Earlier three P1 closures and safe unresolved-attempt strategy remain intact. TypeScript/lint receipts inspected by reviewer, not independently rerun. |
| [Latest correction receipt](job-isolation-failure-identities/HANDOFF.md) | Local 235/235 in one six-file run; full TypeScript and targeted lint passed. Today all 11 distinct files in the latest `review-fixes`, `manual-retry-recovery` and `job-isolation-failure-identities` manifests match their recorded hashes. No suite rerun was needed for this documentation reconciliation. |
| [Real PostgreSQL queue proof](queue-sql-verification/HANDOFF.md) | 14 check groups passed on a fresh disposable loopback PostgreSQL 17.11 cluster. At limit two, six failed stop jobs rotate and cutoff is selected in batch four despite 25 older retries. Unknown/failed jobs remain unfinished; active leases, bounds, role denial, fencing and unchanged due dates verified. Synthetic lease expiry was accelerated; this is not deployed scheduler timing proof. |
| [Sandbox E2E](SANDBOX-E2E-HANDOFF.md) and [natural cutoff](NATURAL-CUTOFF-HANDOFF.md) | Three of three hosted Checkout cases used. Separate direct monthly test clocks proved failed-payment cancellation and natural termination of a still-paying subscription at July 1, without a July invoice or worker action. These predate the latest recovery corrections and do not prove their real-service execution. |
| Cleanup receipts | Forwarder/Auth/VM/earlier PostgreSQL stopped at 2026-10-21 18:53:45 UTC; queue verification PostgreSQL stopped at 19:58:16 UTC. Historical observed cleanup, not a fresh service probe. No services were started in this reconciliation. |

Counts are separate evidence sets, not additive. The original sync-audit 636 was deduplicated latest-per-file evidence from overlapping runs, not a single 636-test run.

## Smallest safe local next packets

These are plans, not implemented changes in this handoff. Preserve the current public checkout block and all external activation guards while developing them with mocks.

1. **Public monthly signup and management wiring.** Use the existing monthly adapter and owner-bound cancel route; add the minimal authenticated owner-only subscription read needed by the UI. Limit the packet to the account in-season panel, its routes and nearest tests. Assert anonymous/foreign-account denial, failed entitlement/config checks, duplicate valid access, explicit minimum/below-minimum refusal, hosted-invoice destination, pending payment, stale response after account switch and idempotent cancellation. Independent grants and saved manual plans must survive cancellation.
2. **Inactive worker invocation boundary and operator handling.** Reuse the existing executor, with authenticated invocation, bounded batch/runtime and explicit reporting of both `completed` and `failed`. Mock unauthorized calls, global account/list failure, partial failure, lease contention and urgent cleanup beyond one batch. Unknown attempts stay recoverable and never gain an automatic re-charge or forced-success action. Choose the operational hosting/cadence before adding an active trigger; no scheduler or credentials are needed for local contract tests.
3. **Prepare the next isolated service verification packet.** Specify synthetic IDs/storage, exact assertions, event replay and failure injection before requesting execution. Cover response-lost-after-payment, durable decline receipt recovery, real draft/pending-item cleanup, payment-specific refund/dispute readback and preservation of independent grants. Existing mocks and SQL receipts already cover the corresponding local behavior; avoid another broad audit or duplicate unit suite.

Focused commands after relevant code changes, from `web/` using Node 22.11.0/npm 10.9.0 (not run again in this reconciliation):

```sh
npm test -- lib/in-season/billingRoutes.test.ts components/account/InSeasonPanel.test.tsx
npm test -- lib/in-season/monthlyIntegration.test.ts lib/in-season/monthlyLifecycle.test.ts lib/in-season/monthlyStripe.test.ts
NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit --incremental false
```

Use targeted ESLint for the actual changed files. A production build is not needed for these local packets. The previously independent 235-test command additionally included `access.test.ts` and `commerce.test.ts`; its exact command is in the review and correction receipts.

## Exact remaining decisions and permissions

- **Settled; do not reopen:** $4.99 monthly/$24.99 one-time season pass; July 1, 2027 midnight America/New_York cutoff; approved day-14/day-15 proration and half-up rounding; explicit applicable minimum; immediate cancellation, 48-hour anchored grace and distinct confirmed failure stop; manual refund review, payment-specific full-refund/dispute effects and cutoff accounting cleanup. No additional financial-policy choice blocks the local packets above.
- **Pending external outcome:** the sole $1 sandbox refund request was still `requires_review`, with no refund object, at the last authorized read on **2026-10-21 18:43:57 UTC**. [Exact request](https://dashboard.stripe.com/acct_1UDRxGLaomqkve47/test/settings/approvals/requests/apreq_test_61VcRrl4OlX6lIlYG16VMpuc7lSQy9I9FTdeM4784LQu). Current status is unverified; chat approval is not execution proof. Next authorized step is one read-only outcome check, then isolated reconciliation if completed. Never resubmit an auto-executing pending request. No new check was made here under the current no-Stripe-call instruction.
- **Sandbox continuation approval:** resume temporary isolated storage/forwarding and define a bounded refund/dispute/recovery matrix before further service execution. All three Checkout cases are consumed; no fourth Checkout without explicit approval. Scope any additional transaction independently; no blanket extension or credential expansion.
- **Operational choice before activation:** select worker host, invocation cadence, batch/runtime budget, monitoring/alert destination and response owner for unresolved jobs; confirm who owns competing automatic retry settings and webhook retry/delivery monitoring. Local tests can precede this selection; active scheduling cannot.
- **Live commercial/configuration decisions:** verify the live settlement currency and applicable minimum, determine tax handling/customer terms with the responsible owner, and select any new first-100 cohort assignment rule. Cohort selection applies only to new assignments and must not delay or revoke existing valid supporter/grandfathered grants.
- **Separate live release approval:** exact live account/catalog/credentials and webhook exposure; reviewed production schema adaptation, preservation/rollout/rollback plan; enabled public signup/cancellation and worker candidate; independent review of new delta; exact release SHA, linked Vercel project inventory and bounded smoke-test budget. No live mutation, migration, worker activation, push or deployment is authorized by this handoff.

No current tool action was denied or has an uncertain execution result. The known external refund remains pending as of its last read; release/service work is gated by scope and verification, not by a new local tool failure. Keep the billing task open. This handoff changes only documentation and its working diary.
