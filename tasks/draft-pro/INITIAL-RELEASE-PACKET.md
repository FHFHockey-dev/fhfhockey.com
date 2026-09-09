# Draft Pro Initial Release Packet

Status: preparation packet only. Draft Pro is not advertised as live from this packet. Do not enable providers, publish production changes, send real email, move money, or change live configuration without explicit owner authorization.

## Proposed initial-release scope

The locally approved initial-release candidates are the one-time 2026-27 pass, Stripe purchase and entitlement lifecycle, Patreon eligibility grant, refund request/access handling, roster-aware recommendations, personalized replacement suggestions, DUST, and aggregate CSV export. Account and expanded graph views are integration surfaces; the expanded graph remains free. The free DUST schedule matrix provides a position-by-week overview with player-by-week drilldown across all 27 Yahoo weeks, with selected playoffs highlighted; OFF and B2B views may follow the selected playoffs. Paid candidate DUST insights, alternatives, and schedule-fit sorting remain gated, with the actual analysis window and freshness displayed.

Saved Drafts and private imports are a separately approved later milestone set in the same pass when enabled; production availability remains gated. Scenarios and reports are locally approved, while Yahoo is parked. The initial candidates, Saved Drafts, and decision tools are ready for owner review when enabled; these milestones must not appear as currently available in launch copy.

## Contract

- Price: US$5.99 one time for `draft_pro_2026_27`.
- Expiration: `2027-07-01T04:00:00.000Z` (July 1, 2027 at 12:00 AM Eastern).
- Renewal: none; no subscription.
- Refund requests: case by case, within 168 hours of first server-recorded purchase activation; one open request per purchase; no automatic refund or access revocation.
- Patreon: refunds stay with Patreon; a purchased pass survives Patreon loss, while Patreon eligibility follows paid access through its expiry.

## Schema and configuration

Committed migration names:

- `supabase/migrations/20260907143356_draft_pro_foundation.sql`
- `supabase/migrations/20260907145602_draft_pro_stripe_fulfillment.sql`
- `supabase/migrations/20260907182507_draft_pro_saved_drafts_transactions.sql`

Configuration names to verify without recording values:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_DRAFT_PRO_PRICE_ID`
- `STRIPE_DRAFT_PRO_PRODUCT_ID`
- `DRAFT_PRO_STRIPE_LIVE_APPLY_ENABLED`
- `NEXT_PUBLIC_SITE_URL`
- `PATREON_CLIENT_ID`
- `PATREON_CLIENT_SECRET`
- `PATREON_CAMPAIGN_ID`
- `PATREON_WEBHOOK_SECRET`
- `RESEND_API_KEY`

Canonical Draft Pro flags are all off by default: `DRAFT_PRO_CHECKOUT_ENABLED`, `DRAFT_PRO_RECOMMENDATIONS_ENABLED`, `DRAFT_PRO_DUST_ENABLED`, `DRAFT_PRO_BLENDED_CSV_ENABLED`, `DRAFT_PRO_SAVED_DRAFTS_ENABLED`, `DRAFT_PRO_PRIVATE_IMPORTS_ENABLED`, `DRAFT_PRO_SCENARIOS_ENABLED`, and `DRAFT_PRO_REPORTS_ENABLED`.

## Evidence and blockers

- Product release-candidate checkpoint is `2d7cba039`; later verification commits are recorded separately and this packet does not make a provider launch claim.
- Prior release-candidate evidence stays at `acc95703d`: root unit RC4349 passed with 3 skipped, plus targeted 29 tests after the final corrections, and full root TypeScript exited 0.
- DUST is accepted at root code `4d371a801` and `a3e0fcb50`, with spec `28a9c8698` and Chef approval `19e037839`. Screenshots are retained under `/Users/tim/.codex/visualizations/2026/09/07/01a07c1d-047d-7660-954c-b3ce7d8ef7d2/dust-position-matrix/`.
- The accepted DUST contract is the position-by-week overview with player-by-week drilldown and actual diamond-grid user reference; desktop and 390/320 verification are complete.
- Scenario module/API and dashboard integration are locally approved: full desktop/private browser verification passed from sources `4fb5ce916` and `1e5db4c23` at roots `3cb5f069e` and `7dfac74c1`, with session `12014` exiting 0, cleanup verified, and the populated 390px mobile view showing no overflow. Artifacts are retained under the Chef `scenarios/` visualizations.
- Report module integration is recorded at `7d834b147`; 18 focused tests passed in `/tmp/draft-pro-chef-report-module-tests.log`, final mount verification passed 19 tests from source `2d7cba039` in `/tmp/draft-pro-chef-report-mount-tests.log`, and the root typecheck session `33629` exited 0 with output in `/tmp/draft-pro-decision-tools-rc-types.log`. The real API is accepted from source `b6df29909` at root `58bde5036`, with session `99831` exiting 0 and cleanup verified. Final browser/print verification passed from source `cc51beb73` with stylesheet `12e1e88ad` at root `dd8c69c9c`, README correction `08d4353c`, session `95517` exiting 0, and cleanup verified; artifacts are retained under the Chef `reports/` visualizations.
- Saved Drafts evidence remains accepted. Provider configuration and partial real-provider verification are now available; see the September 9 evidence below. This is not production activation approval.
- RC full suite source `2d7cba039` passed: session `67978` exited 0 with 763 files passed and 2 files skipped; 4,412 tests passed and 3 tests skipped. Output is in `/tmp/draft-pro-decision-tools-rc-full.log`.
- Full real-service browser session `56624`, final styling-only session `37500`, and standalone TypeScript session `61020` remain the earlier Saved Drafts evidence; the screenshots live under `/Users/tim/.codex/visualizations/2026/09/07/01a07c49-af48-7d63-8efd-734ea1d6c002/`.
- The Saved Draft browser acceptance used 200% pinch plus a 640 CSS width reflow-equivalent check; actual desktop browser-chrome zoom is not claimed.
- Isolated verification covered the local Storage service, denied anon/two-user payload access, empty private listings, repeated batch deletion with missing paths, and overlapping Saved Drafts transactions where the second caller waited on the first lock and the stale caller received a conflict.
- The free/account matrix suite passed all 10 cases: the original run had 8 passed and 2 account failures caused solely by a synthetic URL mismatch; corrected loopback URL rerun passed both account cases in 13.1s. Session `29631` and outputs `/tmp/draft-pro-decision-tools-browser-regression.log` and `/tmp/draft-pro-decision-tools-account-regression.log` are retained.
- Actual Stripe sandbox Checkout payment, return reconciliation, and Stripe CLI-signed partial/full refund events passed. A full refund revoked only its purchase grant, and return replay did not restore it. A second route-created sandbox Checkout delivered an actual signed `checkout.session.completed` event on September 9, activated one grant, and survived two confirmed return retries without duplication.
- A separate documented Stripe test-dispute fixture delivered actual signed open/close events: grant suspended on dispute and restored after a won resolution. Its seeded local purchase association is synthetic; it is not additional Checkout evidence. Detailed provenance: `verification/stripe-provider-20260909.md`.
- Resend accepted and delivered a synthetic message to its test-recipient sink; retry with the same idempotency key returned the same email ID. No real support/customer inbox delivery is claimed.
- Actual Patreon creator OAuth, encrypted Vault token persistence, and manual provider refresh passed. The creator account has no paid membership of its own campaign; no paid grant was issued. The owner explicitly deferred real paid-patron verification on September 9 and accepts that risk. Paid-member recognition, paid-through cancellation and recovery remain covered by local fixtures, not actual paid-provider evidence; signed Patreon webhook delivery remains unverified.
- The owner authorized account-bound complimentary access codes as a support fallback. This addition must pass independent redemption, ownership, expiry, revocation and premium-payload checks before it is advertised as available. It does not convert deferred Patreon checks into passes.
- The current matrix fixture is 2 position groups by 27 weeks, with player-by-week drilldown; the superseded 20-player claim is not current evidence.
- Full unit/type evidence at `2d7cba039` preceded the CSS-only report browser verification at `dd8c69c9c`; no full-suite claim is made for the CSS-only head.

## Rollout and rollback

Roll out with all flags off, then enable only the candidate capability whose implementation evidence, provider readiness, copy review, and owner approval are complete. Keep provider secrets server-side and use test-mode evidence first.

Remaining external steps: finish remaining sandbox payment-event evidence; record any unverified provider checks distinctly from the explicitly deferred paid-patron test; owner review of terms, source permissions, and tax setup; then explicit authorization for production migrations, deployment, and activation. Complimentary-code implementation and verification are part of the revised local release candidate.

Rollback disables the affected feature flag or provider integration and preserves purchases, entitlements, refund records, retained data, and local drafts. Do not delete entitlements, private imports, or saved drafts. Reconcile Stripe and Patreon events received during an incident before re-enabling access.
