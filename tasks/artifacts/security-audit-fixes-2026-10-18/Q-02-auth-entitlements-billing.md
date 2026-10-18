# Q-02: accounts, entitlements and in-season billing (2026-10-18)

Local only. No billing, provider or hosted action was taken. Passing pure functions is not evidence that customers are billed correctly in production.

## 1. What exists today

| Layer | Where | State |
|---|---|---|
| **Pure in-season contract** | `web/lib/in-season/commerce.ts` | Prices, cutoff, anchor, grace and retry intent, coverage capping, cancellation and the 14th/15th threshold. Proration is **proposal only**. |
| **Grant resolver** | `web/lib/in-season/access.ts` | Unions purchase, grandfather, common_preview, Patreon (verified within 1 h) and owner_testing grants. Expiry is exclusive. |
| **Server loader** | `web/lib/in-season/server.ts` | Owner allowlist from the server Auth record. Reads `in_season_grants` and Patreon `user_entitlements` (paged, `order(id)`). A stale Patreon row is reverified and fails closed. |
| **Grants table** | `supabase/migrations/20260927104934_in_season_access_workspace.sql` | `source` CHECK limits it to purchase/grandfather/common_preview, `unique(source, source_reference)` and `effective_to > effective_from`. Browser roles hold no privileges. |
| **RSO saved workspaces** | `pages/api/v1/roster-schedule-optimizer/workspace.ts` | `requireApiUser`, then `rso_account_save` for writes. Every query is filtered by `user_id`, provider and context, with lock-version CAS. Team and league ownership checks include matching `connected_account_id`. Preservation receipts are bound to the principal and context. |
| **Payments** | `lib/integrations/stripe/*`, `pages/api/v1/webhooks/stripe.ts` | Draft Pro only: one-time Checkout, raw-body signature check, idempotent `record_draft_pro_stripe_event(p_event_id…)`. **No in-season product, price, subscription or webhook path exists.** |
| **SDK** | `web/node_modules/stripe` 18.5.0 | API `2025-08-27.basil`. `billing_cycle_anchor_config.day_of_month`, `cancel_at`, `proration_behavior` and the `invoice.paid`, `invoice.payment_failed`, `invoice.payment_action_required`, `customer.subscription.updated` and `customer.subscription.deleted` events are all present in the installed types. |

**Remaining work, compared with the accepted local increments:**
- the in-season Checkout and Subscription adapters;
- a subscription event ledger and reducer;
- grant writes from verified events;
- first-100 grandfather assignment (no code; the `grandfather` source exists but nothing assigns it or counts to 100);
- the account UI for purchase and status;
- test-mode wiring and production acceptance.

## 2. Policy table

| Policy | Value in code | Source | Status |
|---|---|---|---|
| Season pass | 2499 USD cents, one-time | `commerce.ts:7`; handoff | Settled |
| Monthly | 499 USD cents | `commerce.ts:8` | Settled |
| Access end | 2027-07-01T04:00Z (00:00 New York), exclusive | `commerce.ts:5`, test "midnight Eastern" | Settled |
| No July charge, no offseason renewal | `julyChargesAllowed:false`, `offseasonRenewalAllowed:false` | `commerce.ts:12-13` | Settled |
| Renewal anchor on the 1st; June 1–July 1 is a full 499 | `anchorDayOfMonth:1`, `finalPeriod` | `commerce.ts:14-19` | Settled |
| Cancellation | access ends immediately | `purchasedCoverageAfterCancellation` | Settled |
| Failed payment | 48 h grace, retries at +24 h and +48 h (elapsed hours across DST), 3 failures end access | `commerce.ts:22`, `monthlyFailureWindow` | Settled |
| Initial charge | full through the 14th (Eastern); prorated from the 15th | `previewInitialMonthlyCharge` | Threshold settled |
| Proration arithmetic and rounding | proposal: inclusive calendar days, half-up cents | `unresolvedPolicies.prorationArithmetic/Rounding = null` | **Unsettled (TJ)** |
| Refunds | none | `refundTreatment = null` | **Unsettled (TJ)** |
| Post-cutoff invoices and collection | none | `postCutoffCollection = null` | **Unsettled (TJ)** |
| February season-pass promotion (~40%) | not implemented | handoff only | Tentative, not approved; nothing to build |
| First 100 Draft Pro customers grandfathered through June 2027 | not implemented | handoff | **Needs a TJ rule:** what counts as a customer, the ordering key, refunded purchases, and who assigns the grant |
| RSO free tier: manual entry, one local workspace per browser | client-side; server capability needed only to save | `workspace.ts` | Settled |
| Paid: Yahoo/Fantrax sync and saved sessions | capabilities `rso_sync`, `rso_account_save`, `rso_auto_upkeep` | `access.ts:1` | Settled. A Fantrax entitlement does not imply an authoritative Fantrax integration. |

## 3. Decisions for TJ (reported, not reversed)

1. **Patreon now grants paid features.** The audit (G1 P2.1) found:
   - An active `patreon_supporter` row with `metadata.draft_pro_eligible = true` unlocks Draft Pro (`web/lib/draft-pro/server.ts:22-33`) and every in-season capability (`web/lib/in-season/server.ts:51-54`). It is set in `lib/integrations/patreon/sync.ts:316`, from 69b9d6a67/e717c661d (2026-09-07).
   - The browser can't grant itself access; restrictive policy `user_entitlements_draft_pro_service_only` blocks it.
   - But rows 27.3, 41.0 and 42.0 and the 6.3 matrix say Patreon is account-linking only.

   **Decision:** keep Patreon as a paid-feature grant (then update those rows and the matrix), or remove the grant.
2. **ESPN and Fantrax credentials are stored.**
   - ESPN `SWID`/`espn_s2` session cookies (`supabase/migrations/20260815023132_espn_fantasy_private_beta.sql:403-417`) and the Fantrax user Secret ID (`20260814192101_fantrax_settings_first.sql:242-256`) go into the Vault-backed token store.
   - Rows 25.1 and 26.1 say no credentials are stored.
   - These writes depend on the private token vault that migration 85 restores for fresh replays.

   **Decision:** approve the storage (with consent version, retention and deletion policy), or remove it.
3. **Proration arithmetic and rounding**, **refunds**, and **post-cutoff invoices**. The fields are `null` by design.
4. **First-100 grandfather rule** (see the table).
5. **Grant semantics under DB uniqueness.** `resolveInSeasonAccess` does not check `source` and grants on any `active` row. That is safe today only because of the CHECK constraint, `unique(source, source_reference)` and the absence of browser grants. A future event reducer must update the one row per reference, never insert parallel rows. Optionally, harden the resolver to reject unknown sources (in a shared entitlement file, so coordinate with the RSO owner).

## 4. Isolation and event-order evidence (local)

- **New tests** (`web/lib/in-season/commerce.test.ts`, "grant event order, duplicates and reactivation"):
  - access is order-independent across permutations;
  - a replayed duplicate grant counts once;
  - monthly coverage ends exactly at the Eastern first across the March DST change;
  - a lapse between periods reports `expired`, and access returns on the next verified grant;
  - missing, pending, past-due and blank-reference grants give no access.
- **Existing tests:**
  - the threshold and grace cases above;
  - `workspaceRoutes.test.ts` (owner scope, cross-account CAS, forged owner fields, preservation receipt binding);
  - `access.test.ts` (fail-closed owner lookup, stale Patreon).
- **Checks:** `npx vitest run lib/in-season lib/integrations/stripe lib/draft-pro/access.test.ts lib/draft-pro/server.test.ts` gives 8 files and 164 tests, all passing.
- **Provider snapshot reads are owner-scoped:** `teamRoster.ts:226-231`, `pickupServer.ts:17-24`, `rosterPlanning.ts:146-150`, `starterBoard.ts:67-69` and `yahooUniverseCapture.ts:29-33` all filter on `user_id`, and league reads check `connected_account_id`.
- **Shared caches:** the eligibility cache (`yahooEligibilityCache.ts`) holds shared player-eligibility data keyed by game and season, not account data.
- **Credentials:**
  - Provider tokens live only in the private Vault through service-role routines.
  - Browser roles have no access to `private` or to the token wrappers (verified in the migration 85 harness).
  - Migration 84 removes browser writes to `connected_accounts`, `external_*` and `provider_sync_runs`.
  - Account 500s no longer echo dependency text.

## 5. Test-mode integration and webhook design (not built)

1. **Season pass:** reuse the Draft Pro one-time Checkout (`mode: "payment"`) with a separate Price and Product. On a verified `checkout.session.completed` (paid), write one `in_season_grants` row (`source: purchase`, `source_reference = payment_intent id`) with `seasonPassCoverage(paidAt)`.
2. **Monthly:**
   - Checkout `mode: "subscription"`, with `billing_cycle_anchor_config: { day_of_month: 1 }` and `cancel_at = 2027-07-01T04:00:00Z`, so no July invoice is created.
   - Activation on the 1st–14th charges the full amount. After the 14th, `proration_behavior` follows the approved arithmetic; this is **blocked on decision 3**.
   - Set the retry schedule in Stripe Billing to +24 h and +48 h with 3 attempts, then cancel. Use `monthlyFailureWindow` only to show grace and to check that the Stripe settings match.
3. **Webhook ledger:**
   - Reuse the event-id idempotency of `record_draft_pro_stripe_event`: insert on `event_id` conflict, do nothing, return `processed:false`.
   - **Reducer:** per subscription, apply only events newer than the stored `latest_event_created` (`event.created` plus a tie-break on `event.id`). Rebuild the single grant row for `source_reference = subscription id` from the subscription object fetched at processing time, not from the event payload. A late `invoice.paid` can't extend a deleted subscription, and a duplicate is a no-op.
   - **Effects on the grant:**
     - `invoice.paid` sets `effective_to` to the invoice's `period.end`, capped by `capInSeasonPurchasedCoverage`.
     - `invoice.payment_failed` keeps the row active until `graceEndsAt`.
     - `customer.subscription.deleted` (or cancellation) sets `effective_to` to the cancellation time, through `purchasedCoverageAfterCancellation`.
     - Reactivation is a new subscription, so a new reference and a new row.
4. **Reconciliation job (dry-run first):** list test-mode subscriptions and invoices, compare them with the grants, and report drift without writing. Bound it by date and page size; no cron until approved.
5. **Test surface:**
   - Stripe test mode with test keys, and the Stripe CLI `listen`/`trigger` against a local server, on an isolated Supabase branch or a local database seeded with throwaway users.
   - Never use the owner's working roster or account.
   - Genuine save and restore needs that isolated surface, or an approved reversible preservation plan; the existing receipt flow in `workspace.ts` is that plan's mechanism.

## 6. Acceptance matrix (remaining integration and production)

| # | Check | Surface | Needs approval |
|---|---|---|---|
| A1 | Season-pass checkout grants until the cutoff; a webhook replay is a no-op | Stripe test mode, isolated DB | Test keys, product and price creation in test mode |
| A2 | Monthly signup on the 14th and the 15th (Eastern), both sides of the DST changes | test clocks | Same, plus the proration decision |
| A3 | Out-of-order `invoice.paid` after `subscription.deleted` grants nothing | Stripe CLI resend | Same |
| A4 | Two failures then a success stays in grace; three failures end access | test clock | Same |
| A5 | Cancel ends access immediately; a later resubscribe reactivates | test mode | Same |
| A6 | No July invoice; the subscription ends at 2027-07-01T04:00Z | test clock | Same |
| A7 | Two accounts: no cross-account workspace, roster or grant visibility | isolated DB | Isolated branch |
| A8 | Migrations 84 and 85 on a Supabase branch, then a token write and read | branch | Branch creation and apply |
| A9 | Live product, price and webhook endpoint created; one owner purchase, then refund | production | **Explicit separate approval** |

## 7. Rollback plan

- **Flags:** keep checkout behind an env flag, like `DRAFT_PRO_CHECKOUT_ENABLED`. Rollback means flag off: the routes return 503 and existing grants stay valid.
- **Webhooks:** disable the in-season webhook endpoint in Stripe. Events queue and retry for up to 3 days, and on re-enable the event-id ledger makes the replay safe.
- **Grants:** never delete. Correct by setting `status = 'revoked'` or adjusting `effective_to` through a reviewed service-role script with a dry-run diff.
- **Migrations:**
  - 84 is ACL-only. To revert, re-grant the baseline privileges and recreate the three owner write policies per table. Revert only if a browser write path is found, and none exists today.
  - 85 is additive and replace-style, so there's nothing to roll back on production. On a branch, `drop schema private cascade` removes it, and this destroys token rows: never run it on production.
