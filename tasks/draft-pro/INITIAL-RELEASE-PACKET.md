# Draft Pro Initial Release Packet

Status: preparation packet only. Draft Pro is not advertised as live from this packet. Do not enable providers, publish production changes, send real email, move money, or change live configuration without explicit owner authorization.

## Proposed initial-release scope

The locally approved initial-release candidates are the one-time 2026-27 pass, Stripe purchase and entitlement lifecycle, Patreon eligibility grant, refund request/access handling, roster-aware recommendations, personalized replacement suggestions, DUST, and aggregate CSV export. Account and expanded graph views are integration surfaces; the graph remains free. The current DUST contract is full weeks 1 through 30 and daily views only. The free schedule matrix shows all 27 Yahoo weeks, with selected playoffs highlighted; OFF and B2B views may follow the selected playoffs.

Saved Drafts/private imports, scenarios, reports, and Yahoo are not initial-release capabilities. Saved Drafts runtime modules are integrated, but dashboard integration and full user-flow verification remain pending. Scenarios and reports are queued; Yahoo is parked. These milestones must not appear as currently available in launch copy.

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
- `supabase/migrations/20260907182507_draft_pro_saved_drafts_transactions.sql` (follow-on Saved Drafts schema now present in the integration branch; feature flags remain off)

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

RC evidence currently recorded: the full suite reports 4,281 passed, 2 failed, and 3 skipped; both inventory failures were subsequently fixed, with targeted checks reporting 19 and 47 passed; full-repository TypeScript exits 0, recorded in `/tmp/draft-pro-rc-types-final.log` at commit `3dcf15b05`. Attach the isolated migration/RLS/storage harness output from `tasks/draft-pro/verification/README.md` and the relevant W02-W04 implementation evidence before release. The sticky-table geometry correction is integrated. The combined free/account Chromium suite passed all 8 cases on the corrected integration baseline with the focus-revalidation fixture (source `94ed8e6da`, integrated `1c6739e13`). This covers manual drafting, comparison, source weights, local CSV restoration, graph keyboard close, free export denial, mocked paid export, and mocked account retry/access denial. Real Stripe, Patreon, and Resend validation remains blocked. The full-season diagonal matrix follow-on is now locally approved: product `5b250f93b`, browser fixtures `2f089d1fc`. W12 verified 20 selected players × 27 weeks, unknown-team unavailable cells, desktop/mobile views, and the combined free/matrix and account flows; screenshots are retained in `/tmp/draft-pro-matrix-reviewed/`.


Saved Drafts modules are integrated at `1597de292`, including private file recovery, version conflicts, and account-change cancellation. The combined runtime check passed 49 tests before the final typing/privacy corrections; affected transport and hook checks subsequently passed 10 and 17 tests. Full integrated TypeScript passed (`/tmp/draft-pro-chef-w08-types-approved.log`) before the final one-line account-list clearing correction. This is module evidence, not proof of complete dashboard save/restore behavior.

Private Storage HTTP verification is integrated at `b9d9c09e1`. W12 used an isolated local Storage service to verify service-role roundtrip, denied direct anon/two-user payload access, empty private listings, and repeated batch deletion with missing paths. The harness asserts the migrated bucket configuration. Shared-blob retention and orphan cleanup have sequential SQL probe evidence. W12 also verified overlapping Saved Drafts transactions: PostgreSQL observed the second caller waiting on the first transaction lock; after release, only the winner saved and the stale caller received a conflict. Source `03071158c` includes the deterministic concurrency harness. The cross-device browser flow remains a separate pending acceptance check.

Real Stripe test-mode Checkout/webhook validation, Patreon provider validation, and Resend delivery validation are blocked until the owner supplies authorized provider configuration and test access. No real provider check, live charge, Patreon verification, or email send is claimed by this packet.

Saved Drafts real-service API verification is approved at `5d88d8a03` (W12 source `56fac9a11`). The local GoTrue/PostgREST/Storage/Next fixture saves a populated snapshot and restores it with downloaded private rows through a second same-account token. It checks file integrity, cross-user denial, inactive names-only access and payload/write/file locks, restoration after entitlement reactivation, and version conflicts. Its final `cleanup=verified` marker follows process, port, container, and network cleanup checks. The binary-response defect found by this fixture is fixed at `059553e6f`; the affected API suite passed 28 tests with follow-on `73bc3b922`. Dashboard browser save/restore remains pending.

## Rollout and rollback

Roll out with all flags off, then enable only the candidate capability whose implementation evidence, provider readiness, copy review, and owner approval are complete. Keep provider secrets server-side and use test-mode evidence first.

Rollback disables the affected feature flag or provider integration and preserves purchases, entitlements, refund records, retained data, and local drafts. Do not delete entitlements, private imports, or saved drafts. Reconcile Stripe and Patreon events received during an incident before re-enabling access.
