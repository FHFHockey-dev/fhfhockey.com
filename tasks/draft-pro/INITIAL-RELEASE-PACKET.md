# Draft Pro Initial Release Packet

Status: preparation packet only. Draft Pro is not advertised as live from this packet. Do not enable providers, publish production changes, send real email, move money, or change live configuration without explicit owner authorization.

## Proposed initial-release scope

The locally approved initial-release candidates are the one-time 2026-27 pass, Stripe purchase and entitlement lifecycle, Patreon eligibility grant, refund request/access handling, roster-aware recommendations, personalized replacement suggestions, DUST, and aggregate CSV export. Account and expanded graph views are integration surfaces; the expanded graph remains free. DUST supports full-season daily-lineup analysis with its actual schedule window and freshness displayed. The free schedule matrix shows all 27 Yahoo weeks, with selected playoffs highlighted; OFF and B2B views may follow the selected playoffs.

Saved Drafts and private imports are a separately approved later milestone included in the same pass when enabled; production availability remains gated. Scenarios are being implemented, reports are queued, and Yahoo is parked. These milestones must not appear as currently available in launch copy.

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

Current approved local integration is `ab217e935`, which includes the later verification documentation on top of the approved Saved Drafts milestone set (`35edc72a2` and `c4e1bbb10`).

- The full unit release candidate at `acc95703d` passed 4,349 tests with 3 skipped. After the subsequent autosave/import corrections, 29 targeted hook/workspace tests passed.
- Current standalone TypeScript evidence is session `61020`, exit 0, recorded in `/tmp/draft-pro-chef-browser-fixture-types.log`.
- Full real-service browser session `56624` and final styling-only session `37500` both exited 0, with cleanup verified. These are execution session IDs, not commit IDs.
- Screenshots are retained under `/Users/tim/.codex/visualizations/2026/09/07/01a07c49-af48-7d63-8efd-734ea1d6c002/`.
- The browser acceptance used 200% pinch plus a 640 CSS width reflow-equivalent check; actual desktop browser-chrome zoom is not claimed.
- Isolated verification covered the local Storage service, denied anon/two-user payload access, empty private listings, repeated batch deletion with missing paths, and overlapping Saved Drafts transactions where the second caller waited on the first lock and the stale caller received a conflict.
- The free/account Chromium suite passed all 8 cases on the corrected integration baseline and covered manual drafting, comparison, source weights, local CSV restoration, graph keyboard close, free export denial, mocked paid export, and mocked account retry/access denial.
- The full-season diagonal matrix follow-on is locally approved and covers 20 selected players by 27 weeks, unknown-team unavailable cells, desktop/mobile views, and the combined free/matrix and account flows.
- Real Stripe test-mode Checkout/webhook validation, Patreon provider validation, and Resend delivery validation remain blocked until the owner supplies authorized provider configuration and test access.

## Rollout and rollback

Roll out with all flags off, then enable only the candidate capability whose implementation evidence, provider readiness, copy review, and owner approval are complete. Keep provider secrets server-side and use test-mode evidence first.

Rollback disables the affected feature flag or provider integration and preserves purchases, entitlements, refund records, retained data, and local drafts. Do not delete entitlements, private imports, or saved drafts. Reconcile Stripe and Patreon events received during an incident before re-enabling access.
