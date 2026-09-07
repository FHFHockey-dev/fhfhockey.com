# Draft Pro Initial Release Packet

Status: preparation packet only. Draft Pro is not advertised as live from this packet. Do not enable providers, publish production changes, send real email, move money, or change live configuration without explicit owner authorization.

## Proposed initial-release scope

The locally approved initial-release candidates are the one-time 2026-27 pass, Stripe purchase and entitlement lifecycle, Patreon eligibility grant, refund request/access handling, roster-aware recommendations, personalized replacement suggestions, DUST, and aggregate CSV export. Account and expanded graph views are integration surfaces; the graph remains free. The current DUST contract is full weeks 1 through 30 and daily views only. Free schedule matrix, OFF, and B2B views may follow the selected playoffs.

Saved Drafts/private imports, scenarios, reports, and Yahoo are not initial-release capabilities. They remain unimplemented, parked, or separately gated milestones and must not appear in availability copy.

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

RC evidence currently recorded: the full suite reports 4,281 passed, 2 failed, and 3 skipped; both inventory failures were subsequently fixed, with targeted checks reporting 19 and 47 passed; full-repository TypeScript exits 0, recorded in `/tmp/draft-pro-rc-types-final.log` at commit `3dcf15b05`. Attach the isolated migration/RLS/storage harness output from `tasks/draft-pro/verification/README.md` and the relevant W02-W04 implementation evidence before release. The sticky-table geometry correction is integrated. The combined free/account Chromium suite passed all 8 cases on the corrected integration baseline with the focus-revalidation fixture (source `94ed8e6da`, integrated `1c6739e13`). This covers manual drafting, comparison, source weights, local CSV restoration, graph keyboard close, free export denial, mocked paid export, and mocked account retry/access denial. Real Stripe, Patreon, and Resend validation remains blocked. The newly requested full-season diagonal matrix is a separate UI follow-on in progress.

Real Stripe test-mode Checkout/webhook validation, Patreon provider validation, and Resend delivery validation are blocked until the owner supplies authorized provider configuration and test access. No real provider check, live charge, Patreon verification, or email send is claimed by this packet.

## Rollout and rollback

Roll out with all flags off, then enable only the candidate capability whose implementation evidence, provider readiness, copy review, and owner approval are complete. Keep provider secrets server-side and use test-mode evidence first.

Rollback disables the affected feature flag or provider integration and preserves purchases, entitlements, refund records, retained data, and local drafts. Do not delete entitlements, private imports, or saved drafts. Reconcile Stripe and Patreon events received during an incident before re-enabling access.
