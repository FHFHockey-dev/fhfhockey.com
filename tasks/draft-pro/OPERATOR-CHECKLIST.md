# Draft Pro Operator Checklist

Status: pre-launch checklist. Complete locally first. Do not create live accounts, activate providers, send real email, move money, or publish production changes from this checklist without explicit owner authorization.

## 1. Product and owner approvals

- [ ] Confirm the owner-approved Terms, refund language, privacy language, and support contact are linked before launch.
- [ ] Confirm the owner has reviewed tax collection, tax reporting, and applicable sale obligations. Do not infer or add obligations here.
- [ ] Confirm the owner has permission to use every source, logo, name, feed, and provider reference in the product and launch copy.
- [ ] Confirm the support owner and escalation path for payment, entitlement, Patreon, import, and data-retention issues.

## 2. Stripe and payment configuration

W02 owns the Stripe implementation. Confirm the actual names and values with W02; the names below are a checklist of expected configuration points, not instructions to create accounts or secrets.

- [ ] Product is named for `Draft Pro 2026-27` and configured as a one-time payment, quantity one, USD 5.99.
- [ ] Test and live are treated as Stripe modes; record the mode used for each check and do not assume they are separate accounts.
- [ ] Server-owned product/price identity is confirmed for `draft_pro_2026_27`; client input cannot choose price, amount, currency, or expiration.
- [ ] Test and live configuration names to confirm with W02: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_DRAFT_PRO_PRICE_ID`, `STRIPE_DRAFT_PRO_PRODUCT_ID`, and `NEXT_PUBLIC_SITE_URL`. Do not copy secret values into this document or logs.
- [ ] Confirm `DRAFT_PRO_STRIPE_LIVE_APPLY_ENABLED` remains unset or false unless the owner explicitly authorizes a live-key reconciliation apply.
- [ ] Stripe Checkout uses the approved payment mode and quantity-one constraint.
- [ ] Run reconciliation dry-run from `web/` with `NODE_PATH=. npx ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node"}' scripts/draft-pro/stripe-reconcile.ts --limit=25`; use `--apply` only with explicit owner authorization, and live keys additionally require `DRAFT_PRO_STRIPE_LIVE_APPLY_ENABLED=true`.
- [ ] Link behavior is tested in Stripe test mode and merchant Link enablement is documented for live mode.
- [ ] Receipt delivery is tested with a non-production address and the live receipt sender/support address is owner-approved.
- [ ] OWNER ONLY: Confirm Stripe identity and business verification status, linked bank details, and payout schedule with the owner. Do not set up or change payout details from this checklist.
- [ ] OWNER ONLY: Confirm Stripe branding, customer-facing business name, support address, and receipt branding are approved and match the owner’s support path.
- [ ] PayPal is not configured or advertised.
- [ ] Confirm checkout and refund operator-facing errors stay generic and do not expose provider internals, secrets, or private imports.
- [ ] Duplicate purchase/rebuy behavior, webhook signature verification, replay handling, and return-page verification are covered by W02 evidence.
- [ ] Test-mode full and partial refund behavior is recorded, including entitlement reconciliation through webhook events.

## 3. Patreon and source permissions

- [ ] Confirm the exact FHFH Patreon campaign and the definition of active paid membership with the owner.
- [ ] Confirm Patreon API/webhook credentials and redirect/source permissions through W03. Do not print or copy secrets.
- [ ] Confirm paid eligibility is independently verified and stale verification blocks premium operations without deleting retained history.
- [ ] Confirm cancellation, expiry, reconnect, and Patreon refund handling before enabling the grant.
- [ ] Confirm any external data source, feed, logo, and provider terms permit the intended display, storage, export, and commercial use.
- [ ] Keep Yahoo support disabled unless its separate readiness validation is approved.

## 4. Receipts, support, and customer handling

- [ ] Confirm the public support address and owner for payment and access issues.
- [ ] Confirm Stripe receipt settings and the support address shown in receipts.
- [ ] Confirm refund request handling stores the request before any email attempt and supports retry on email failure.
- [ ] Confirm the refund-email retry path is dry-run by default with `NODE_PATH=. npx ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node"}' scripts/retry-draft-pro-refund-emails.ts 25`; any live resend requires the same command with explicit `--send` and respects Resend's 24-hour idempotency window.
- [ ] Confirm refund requests allow exactly one open request per purchase, require exactly these six reasons: technical problem, confusing experience, missing expected feature, not useful for my draft, accidental purchase, or other; require a 10-2,000 character explanation; and enforce the 168-hour window from first server-recorded purchase activation.
- [ ] Confirm optional improvement and live-draft-use questions are stored separately from the required reason and explanation.
- [ ] Confirm requests are case-by-case, do not auto-refund, and do not auto-revoke access.
- [ ] Confirm success copy says the request was saved and will be reviewed case by case; if email fails, show `tim@fhfhockey.com` for support.
- [ ] Confirm refund request notifications are addressed to `tim@fhfhockey.com` and email failure is persisted for retry.
- [ ] Confirm Patreon refund instructions point customers to Patreon rather than promising an FHFH refund.
- [ ] Confirm support can identify purchase activation, entitlement source, expiration, refund status, and relevant provider verification without exposing secrets or private imports.

## 5. Private imports and retained data

- [ ] Confirm private imports are never public URLs and are authorized by account ownership at both API and storage boundaries.
- [ ] Confirm upload occurs only after an explicit Save to account; local autosave remains free and local.
- [ ] Confirm quota messaging: 10 Saved Drafts per account, 10 MiB per normalized private import/draft, and 100 MiB per account.
- [ ] Confirm disconnect removes provider credentials while retaining entitlement history and premium data.
- [ ] Confirm revoked or ineligible access locks premium read/export/write/calculation without deleting retained premium payloads; owned item names/status remain visible.
- [ ] Confirm customer-facing locked copy says: "Your saved drafts are still here. Renew eligibility to restore access to your retained work."
- [ ] Confirm a valid purchased pass remains active if Patreon disconnects; only the affected grant is reevaluated.
- [ ] Confirm renewed eligibility restores retained work and does not overwrite differing local work silently.
- [ ] Confirm replacement of differing local work requires an explicit user confirmation.
- [ ] Confirm private import/source permissions and retention language are covered by the owner-approved Terms and privacy review.

## 6. Rollout and rollback

- [ ] Record the canonical all-off feature-flag state for `DRAFT_PRO_CHECKOUT_ENABLED`, `DRAFT_PRO_RECOMMENDATIONS_ENABLED`, `DRAFT_PRO_DUST_ENABLED`, `DRAFT_PRO_BLENDED_CSV_ENABLED`, `DRAFT_PRO_SAVED_DRAFTS_ENABLED`, `DRAFT_PRO_PRIVATE_IMPORTS_ENABLED`, `DRAFT_PRO_SCENARIOS_ENABLED`, and `DRAFT_PRO_REPORTS_ENABLED`.
- [ ] Launch first with test-mode evidence and local/test users; do not use live money or real customer email during testing.
- [ ] Enable only the capabilities whose implementation, provider readiness, copy, and owner approvals are complete.
- [ ] Confirm the free Draft path remains usable when checkout and all Draft Pro feature flags are disabled.
- [ ] Roll back by disabling the affected flag or provider integration, preserving purchases, entitlement history, retained premium data, and local drafts.
- [ ] Do not delete entitlements, private imports, or saved drafts as part of rollback.
- [ ] Record the rollback owner, decision signal, timestamp, affected flag/provider, customer communication, and restore criteria.
- [ ] After rollback, reconcile any Stripe/Patreon events received during the incident before re-enabling access.

## 7. Release packet

- [ ] Attach W02 Stripe test evidence and confirmed test/live configuration names.
- [ ] Attach W03 Patreon verification/reconnect evidence and source permission confirmation.
- [ ] Attach W04 refund/access evidence, including email retry and no-live-email test results.
- [ ] Attach private-import ownership/storage and retention evidence.
- [ ] Attach owner approvals for tax, Terms, privacy, support, source permissions, and rollout/rollback.
- [ ] Record unresolved items as blockers. Do not describe proposed or unshipped premium features as launch-available.
