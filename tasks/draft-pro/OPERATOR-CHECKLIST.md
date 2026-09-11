# Draft Pro Operator Checklist

Status: sales enabled September 9, 2026 through Stripe Managed Payments. Do not create live accounts, activate providers, send real email, move money, or publish production changes from this checklist without explicit owner authorization.


## Production repair — September 10, 2026

The later Git deployment `8da5c0590` omitted the isolated release's policy page, Managed Payments opt-in, receipt handling and account-bound purchase recovery. The September 9 acceptance record did not describe that newer deployed code. Restored the three approved payment commits onto the current production source, preserving the newer dashboard. Repair commit `f4b5f722e` was pushed to `master` with owner authorization and deployed as `dpl_9mzTKaayySvr9y6odGnrFVkXKTqs` (READY; canonical domain independently checked).

Verification: 92 targeted checkout, fulfillment, webhook, account, recovery and reconciliation tests passed; TypeScript passed. Live policy page returned 200 with pricing, Managed Payments and seven-day/60-day refund disclosures. Anonymous checkout returned 401; unsigned webhook returned 400. The signed-in owner account retained complimentary access and displayed the restored policy links and refund disclosure. Production checkout and Managed Payments flags read true. Live catalog: active one-time USD 599-cent price and personal-use SaaS product category. Stripe returned one unpaid, open, Managed Payments-enabled Draft Pro session since the superseding deployment, zero paid sessions, and no further result pages. No session was charged, refunded, expired or otherwise modified. The new deployment's five-minute error-level log query returned no records.

Limit: no new live purchase was performed; the owner already has Pro access. Prior real sandbox payment-to-entitlement evidence remains the transaction validation. This repair is on production `master`; unrelated uncommitted development work was not deployed. Do not roll back to the superseded deployment for payment incidents: disable checkout first, since that version omits the Managed Payments integration.

## Current launch gate audit — September 9, 2026

This audit supersedes the older chronological checkpoints below. **10/10 launch gates resolved (100%): 9 verified, 1 owner-waived**; this is a gate count, not percentage of implementation effort.

| Gate | Current evidence / remaining action |
| --- | --- |
| 1. Catalog | PASS — live $5.99 USD one-time product/price verified. Owner now selects $5.99 **plus applicable tax**. |
| 2. Production credentials | PASS — Production Stripe credentials/catalog references configured; signed delivery proves webhook secret correctness. |
| 3. Database and deployment | PASS — release 0bf0d5f39 promoted as dpl_EdQ7AHzgznPy3icqzzgwn9J2SyDS. Staged free pick passed; public dashboard/policies 200, anonymous checkout 401, unsigned webhook 400. |
| 4. Live webhook transport | PASS — actual Stripe-signed catalog event returned 200. No live payment made. |
| 5. Core sandbox payment lifecycle | PASS — route-created payment, return reconciliation, replay and partial/full refund evidence in verification/stripe-provider-20260909.md. |
| 6. Receipts, Link, support and payouts | PASS — production-configured Resend support test observed in tim@fhfhockey.com Inbox; manually sent Managed Payments sandbox receipt observed in TimBranson515@gmail.com Inbox at 7:37 PM Eastern, showing $6.35 and invoice/receipt attachments. Stripe receipt history independently confirms send. Live payout/receipt configuration previously verified; no real-money payment or automatic live receipt delivery claimed. |
| 7. Terms/privacy/refund pages | PASS — owner approved Managed Payments fee/refund conditions. Published policy explains Stripe’s 60-day refund authority and Link support; seven-day FHFH form remains subject to Stripe policy. |
| 8. Tax setup | PASS for Managed Payments transaction handling — live Ready to use, eligible SaaS personal-use product tax code. Sandbox Pennsylvania checkout collected 36 cents on $5.99; provider balance explicitly withheld sales tax. Owner’s separate income-tax/business paperwork is outside this transaction test. |
| 9. Source permissions | OWNER-WAIVED — September 9 explicit instruction to proceed without verification. This is an accepted launch exception, not a finding of permission. LineupExperts remains removed from dashboard use; database unchanged. |
| 10. Paid production capabilities and sales activation | PASS — checkout, Managed Payments, recommendations, DUST, CSV, Saved Drafts/private imports, scenarios and reports enabled and deployed. Yahoo stays off. No real-money transaction performed. |

Current tax configuration: Stripe Managed Payments handles indirect tax for eligible transactions; product category is SaaS — personal use (`txcd_10103000`). The earlier ordinary Stripe Tax registration/automatic_tax instructions below are historical and do not apply to this Managed Payments integration. Separate owner income-tax and business obligations are not verified by these payment tests.

References: [PA digital/software tax guidance](https://www.pa.gov/agencies/revenue/resources/tax-types-and-information/sales-use-and-hotel-occupancy-tax/canned-computer-software-digital-goods), [PA registration](https://www.pa.gov/agencies/revenue/resources/tax-types-and-information/sales-use-and-hotel-occupancy-tax), [Stripe Tax setup](https://docs.stripe.com/tax/set-up), [Stripe testing](https://docs.stripe.com/testing). Stripe documents prohibit testing in live mode with real payment details; sandbox testing plus live non-financial configuration checks is the prelaunch path. Do not require an owner self-charge as a launch gate.

Source inventory for permission review: Apples & Ginos (aggregate, Blake and Nate components), Cullen, DTZ, 5v5; also schedule/team-logo sources and users’ private imported datasets. Obtain owner-held agreements or provider permission addressing the specific uses above. No permission outreach has been sent.

## Checklist evidence and operating procedure

Checked items below mean implementation/configuration verified or an operator procedure established; they do **not** imply an unperformed live operation. Prior passing evidence is retained in [INITIAL-RELEASE-PACKET.md](INITIAL-RELEASE-PACKET.md), [Stripe provider evidence](verification/stripe-provider-20260909.md), and [database/browser verification procedures](verification/README.md). No broad suite was rerun merely to reconcile these boxes.

- Support and rollback owner: Tim Branson, `tim@fhfhockey.com`. Triage billing/access first using request ID, account email, purchase ID and timestamp; route Patreon refunds to Patreon. Escalate reproducible application failures to the Chef with sanitized error text. Never request credentials, cookies or private projection files.
- Refunds: review saved requests manually, approve/decline case by case; execute an approved refund in Stripe and let its webhook reconcile that individual grant. A request does not change access. The deadline remains exactly 168 hours (7 days) from activation.
- Rollback decision signals: duplicate/incorrect charges or grants, unauthorized payload access, data loss, or repeated failures of an enabled capability. Disable new checkout for payment defects; disable only the affected capability for isolated feature failures. Preserve records and local work. Record UTC timestamp, release, affected flags/provider, reason, impacted accounts, customer notice and restore criteria in this checklist. Reconcile incident-period provider events and rerun the affected test before restoration. There is no actual incident to record now.
- Current production flags: checkout, Managed Payments, live reconciliation apply and all shipped premium capabilities enabled. Ordinary automatic tax remains off because Managed Payments handles transaction taxes. Yahoo remains independently disabled.
- Patreon campaign: `3827245`; verified paid benefits required. Actual creator OAuth/refresh passed. Real paid-member and signed-webhook checks are **DEFERRED by owner**, not passed; complimentary-code support is the accepted fallback.
- Complimentary-code issue/revoke and refund-email resend are conditional procedures, not outstanding instructions to create a customer grant or send customer messages now. Their dry-run defaults and isolated acceptance evidence are recorded in the release packet.

## 1. Product and owner approvals

- [x] Confirm the owner-approved Terms, refund language, privacy language, and support contact are linked before launch.
- [ ] Confirm the owner has reviewed tax collection, tax reporting, and applicable sale obligations. Do not infer or add obligations here.
- [ ] Confirm the owner has permission to use every source, logo, name, feed, and provider reference in the product and launch copy.
- [x] Confirm the support owner and escalation path for payment, entitlement, Patreon, import, and data-retention issues.

## 2. Stripe and payment configuration

September 9 live-configuration checkpoint (owner authorized): copied Draft Pro into live account `acct_1UDRx5Lg7s087B8Q`. Product `prod_VDtr5clMeJ09yF`, one-time USD 5.99 price `price_1UDpzNLg7s087B8QWst9UmvZ`. Saved both catalog IDs in Vercel project `fhfhockey`, Production only, along with `DRAFT_PRO_CHECKOUT_ENABLED=false` and `DRAFT_PRO_STRIPE_LIVE_APPLY_ENABLED=false`. Existing `NEXT_PUBLIC_SITE_URL` is `https://fhfhockey.com`. No deployment was triggered; new settings are staged for the next deployment.

Created live destination `we_1UDq51Lg7s087B8QdDi5cvZu` for `https://fhfhockey.com/api/v1/webhooks/stripe`, then confirmed it is **Disabled** pending deployment. Selected `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `charge.refunded`, `charge.dispute.created`, and `charge.dispute.closed`. Stripe offered stable version `2026-08-26.dahlia`; installed SDK defaults to `2025-08-27.basil`, so payload compatibility remains a release check. Production URL returned HTTP 404 on a read-only GET check. The owner saved STRIPE_WEBHOOK_SECRET and STRIPE_SECRET_KEY as Production secrets; their presence and scope were observed in Vercel without reading values. Reconfirmed DRAFT_PRO_CHECKOUT_ENABLED=false. Secret correctness, API-version compatibility, and signed delivery verification remain pending until deployment; do not enable sales or mark delivery passed from this checkpoint.

September 9 deployment preparation: owner authorized production migration/deployment with sales off. All four release migrations applied to `fyhftlxokyjtpndbkfse`; MCP-generated migration timestamps were aligned with the authoritative repository versions (20260907143356, 20260907145602, 20260907182507, 20260909120000). Verified all 12 Draft Pro tables have RLS, no Draft Pro routines are executable by anon/authenticated/PUBLIC, and the import bucket is private with a 10 MiB limit. Isolated release branch `codex/draft-pro-live-release`, commit `e005ae3d8`, contains approved checkpoint `2a4ae028b` plus the requested promotional-text removal. Rollback deployment: `dpl_5aFq5q64g3vB7QqX1zupoKkxtxwX`. Production build/deployment and signed delivery checks are still pending. Compressed upload created staged production deployment `dpl_9nsuZ1neAosbhARDrde3z1XfYEtp` with `--skip-domain`; Vercel reports BLOCKED before build and links to team/commit-author collaboration requirements. The commit email is absent from the authenticated Vercel user’s primary/additional emails. Owner identity association must be corrected before retry; no build or promotion succeeded.

W02 owns the Stripe implementation. Confirm the actual names and values with W02; the names below are a checklist of expected configuration points, not instructions to create accounts or secrets.

- [x] Product is named for `Draft Pro 2026-27` and configured as a one-time payment, quantity one, USD 5.99.
- [x] Test and live are treated as Stripe modes; record the mode used for each check and do not assume they are separate accounts.
- [x] Server-owned product/price identity is confirmed for `draft_pro_2026_27`; client input cannot choose price, amount, currency, or expiration.
- [x] Test and live configuration names to confirm with W02: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_DRAFT_PRO_PRICE_ID`, `STRIPE_DRAFT_PRO_PRODUCT_ID`, and `NEXT_PUBLIC_SITE_URL`. Do not copy secret values into this document or logs.
- [x] Confirm `DRAFT_PRO_STRIPE_LIVE_APPLY_ENABLED` remains unset or false unless the owner explicitly authorizes a live-key reconciliation apply.
- [x] Stripe Checkout uses the approved payment mode and quantity-one constraint.
- [x] Reconciliation dry-run completed September 9 (execution detail below). Standard API-key command from `web/` with `NODE_PATH=. npx ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node"}' scripts/draft-pro/stripe-reconcile.ts --limit=25`; use `--apply` only with explicit owner authorization, and live keys additionally require `DRAFT_PRO_STRIPE_LIVE_APPLY_ENABLED=true`.
- [x] Link behavior is tested in Stripe test mode and merchant Link enablement is documented for live mode.
- [ ] Receipt delivery is tested with a non-production address and the live receipt sender/support address is owner-approved.
- [x] OWNER ONLY: Confirm Stripe identity and business verification status, linked bank details, and payout schedule with the owner. Do not set up or change payout details from this checklist.
- [x] Verify configured Stripe branding against the owner-approved business name/support path: live preview says “Receipt from Five Hole Fantasy Hockey,” live reply-to is tim@fhfhockey.com, and business details use the approved site/policy links. Default Stripe colors remain; no logo or custom domain was added. Preview sample items/amounts are Stripe placeholders, not actual Draft Pro receipt evidence.
- [x] PayPal is not configured or advertised.
- [x] Confirm checkout and refund operator-facing errors stay generic and do not expose provider internals, secrets, or private imports.
- [x] Duplicate purchase/rebuy behavior, webhook signature verification, replay handling, and return-page verification are covered by W02 evidence.
- [x] Test-mode full and partial refund behavior is recorded, including entitlement reconciliation through webhook events.

## 3. Patreon and source permissions

September 9 exception: owner explicitly deferred actual paid-patron testing and accepted the risk, requesting independently tested complimentary access codes as the support fallback. OAuth, encrypted storage and manual refresh passed with the creator identity. Do not tick paid-membership or signed-webhook provider checks based on that evidence; local fixture coverage is distinct. Request error text/time and a support reference before asking users for sanitized logs; never request tokens, cookies or authorization URLs.

- [x] Confirm the exact FHFH Patreon campaign and the definition of active paid membership with the owner.
- [ ] DEFERRED: Confirm Patreon API/webhook credentials and redirect/source permissions through W03; creator OAuth/refresh passed, signed webhook delivery did not. Do not print or copy secrets.
- [ ] DEFERRED actual paid-member provider check: confirm paid eligibility is independently verified and stale verification blocks premium operations without deleting retained history.
- [ ] DEFERRED actual provider lifecycle: cancellation/expiry/reconnect have fixture coverage and creator refresh evidence, not paid-member provider verification. Patreon refunds remain directed to Patreon.
- [ ] Confirm any external data source, feed, logo, and provider terms permit the intended display, storage, export, and commercial use.
- [x] Keep Yahoo support disabled unless its separate readiness validation is approved.

## 4. Receipts, support, and customer handling

- [x] Confirm the public support address and owner for payment and access issues.
- [x] Confirm live Stripe receipt settings and configured reply-to (`tim@fhfhockey.com`), plus sandbox receipt rendering. Actual live receipt delivery/footer remains unverified under gate 6.
- [x] Confirm refund request handling stores the request before any email attempt and supports retry on email failure.
- [x] Confirm the refund-email retry path is dry-run by default with `NODE_PATH=. npx ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node"}' scripts/retry-draft-pro-refund-emails.ts 25`; any live resend requires the same command with explicit `--send` and respects Resend's 24-hour idempotency window.
- [x] Confirm refund requests allow exactly one open request per purchase, require exactly these six reasons: technical problem, confusing experience, missing expected feature, not useful for my draft, accidental purchase, or other; require a 10-2,000 character explanation; and enforce the 168-hour window from first server-recorded purchase activation.
- [x] Confirm optional improvement and live-draft-use questions are stored separately from the required reason and explanation.
- [x] Confirm requests are case-by-case, do not auto-refund, and do not auto-revoke access.
- [x] Confirm success copy says the request was saved and will be reviewed case by case; if email fails, show `tim@fhfhockey.com` for support.
- [x] Confirm refund request notifications are addressed to `tim@fhfhockey.com` and email failure is persisted for retry.
- [x] Confirm Patreon refund instructions point customers to Patreon rather than promising an FHFH refund.
- [x] Confirm support can identify purchase activation, entitlement source, expiration, refund status, and relevant provider verification without exposing secrets or private imports.
- [x] Established conditional support-code procedure (isolated issue/revoke acceptance passed): if the owner enables the account-bound support-code fallback, use the installed runner from `web/`: `NODE_PATH=. ./node_modules/.bin/ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node"}' scripts/draft-pro/access-codes.ts issue <userUUID> '<reason>' 2027-07-01T04:00:00Z [--apply]` or `revoke <codeUUID> '<reason>' [--apply]`. Dry-run is the default and does not create codes or mutate data. `--apply` requires `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `DRAFT_PRO_ACCESS_CODE_ADMIN_USER_ID`; the database rechecks that the canonical `public.users.role` is `admin`.
- [x] Established delivery/audit procedure (no current customer code issuance requested): on an applied issue, record the returned `codeId`, send the one-time raw code only to the intended account holder, and do not suggest automatic email delivery. The database stores only the hash; retain `codeId` for later revocation. Support codes are independent of Patreon, expire no later than season end, and do not imply a refund or unfinished-feature access.

## 5. Private imports and retained data

- [x] Confirm private imports are never public URLs and are authorized by account ownership at both API and storage boundaries.
- [x] Confirm upload occurs only after an explicit Save to account; local autosave remains free and local.
- [x] Confirm quota messaging: 10 Saved Drafts per account, 10 MiB per normalized private import/draft, and 100 MiB per account.
- [x] Confirm disconnect removes provider credentials while retaining entitlement history and premium data.
- [x] Confirm revoked or ineligible access locks premium read/export/write/calculation without deleting retained premium payloads; owned item names/status remain visible.
- [x] Confirm customer-facing locked copy explains retention and inactive access. Account copy: "Your retained Draft Pro work is locked while access is inactive." Retained names and denied payloads passed isolated acceptance; the earlier proposed literal wording is not the shipped text.
- [x] Confirm a valid purchased pass remains active if Patreon disconnects; only the affected grant is reevaluated.
- [x] Confirm renewed eligibility restores retained work and does not overwrite differing local work silently.
- [x] Confirm replacement of differing local work requires an explicit user confirmation.
- [ ] Confirm private import/source permissions and retention language are covered by the owner-approved Terms and privacy review.

## 6. Rollout and rollback

- [x] Record the canonical all-off feature-flag state for `DRAFT_PRO_CHECKOUT_ENABLED`, `DRAFT_PRO_RECOMMENDATIONS_ENABLED`, `DRAFT_PRO_DUST_ENABLED`, `DRAFT_PRO_BLENDED_CSV_ENABLED`, `DRAFT_PRO_SAVED_DRAFTS_ENABLED`, `DRAFT_PRO_PRIVATE_IMPORTS_ENABLED`, `DRAFT_PRO_SCENARIOS_ENABLED`, and `DRAFT_PRO_REPORTS_ENABLED`.
- [x] Launch first with test-mode evidence and local/test users; do not use live money or real customer email during testing.
- [ ] Enable only the capabilities whose implementation, provider readiness, copy, and owner approvals are complete.
- [x] Confirm the free Draft path remains usable when checkout and all Draft Pro feature flags are disabled.
- [x] Roll back by disabling the affected flag or provider integration, preserving purchases, entitlement history, retained premium data, and local drafts.
- [x] Do not delete entitlements, private imports, or saved drafts as part of rollback.
- [x] Establish the rollback owner, decision signals and incident-record procedure above. Fill incident-specific timestamps and customer communication only if a rollback occurs.
- [x] Require incident-period Stripe/Patreon reconciliation before restoring access (procedure above; no rollback executed).

## 7. Release packet

- [x] Attach W02 Stripe test evidence and confirmed test/live configuration names.
- [ ] Attach W03 Patreon verification/reconnect evidence and source permission confirmation.
- [x] Attach W04 refund/access evidence, including email retry and no-live-email test results.
- [x] Attach private-import ownership/storage and retention evidence.
- [ ] Attach owner approvals for tax, Terms, privacy, support, source permissions, and rollout/rollback.
- [x] Record unresolved items as blockers. Do not describe proposed or unshipped premium features as launch-available.

September 9 author-account correction: owner confirmed both Vercel identities belong to them and explicitly authorized changing only the new release commit author to `fhfhockey@outlook.com`. Release commit is now `ef4e92c12`; earlier history is unchanged. Retrying a staged production build with domain promotion disabled.

September 9 deployed checkpoint: `ef4e92c12` built successfully (including TypeScript) as `dpl_3JrM4Nrp3MPuYrhz7hPA3TZLFC2U`, then promoted to fhfhockey.com with sales disabled. Staged dashboard loaded projections and accepted a free manual pick. Missing/invalid webhook signatures returned 400; unauthenticated account API returned 401. Canonical dashboard returned 200 after promotion. Live destination enabled; temporary product.updated subscription and a product save generated actual Stripe-signed event `evt_1UDqs9Lg7s087B8QTy2AYlGN` (2026-08-26.dahlia), delivered 200 with received=true, processed=false. This proves live transport/signing only, not live payment fulfillment or payment-payload compatibility. Temporary subscription removed; final subscriptions are the original five payment events. No real charge or entitlement grant was made. Checkout stays disabled pending payment launch review.

## Source-permission handoff — September 9

LineupExperts' [published terms](https://www.lineupexperts.com/terms.php), sections 2–3, reserve rights and restrict commercial use and data extraction. Written permission or a suitable license is needed before treating its projections as cleared for Draft Pro. This is a specific unresolved permission issue, not a finding that every other provider grants permission. No source was removed or enabled for sale during this audit.

Owner-send draft (not sent):

> Hi [provider], I’m Tim Branson of Five Hole Fantasy Hockey (fhfhockey.com). We’re preparing Draft Pro, an optional $5.99 one-time 2026–27 season pass. I’d like written permission for the following uses of your projections, with attribution and a link to your site: display in our free draft dashboard; combine with other selected sources for roster-aware analysis in paid tools; allow users to export an aggregated CSV that may reflect only your source if they select it alone; and retain user-selected projection data privately in account-backed drafts. Please indicate which uses you permit, whether your permission includes the named component projections where applicable, any attribution or update requirements, and any fees or restrictions. We can exclude uses you do not approve. We will not claim ownership of your projections. Thanks, Tim.

If permission outreach is needed, send individually to Apples & Ginos (including Blake/Nate components), Scott Cullen, DTZ and 5v5. LineupExperts was subsequently removed from dashboard use at the owner’s request. Record the provider's actual response and covered season/use; do not treat silence as permission. Review NHL schedule/logo rights separately. User-imported paid files require their own license review; an upload does not grant redistribution rights.

September 9 follow-through: tax parked per owner instruction, awaiting their paperwork/response. Owner approved policy text with “7 days” in customer-facing copy. Release commit d68d11969 includes approved policies, server-enabled feature disclosure in account, and receipt capture from expanded Stripe charges in webhook/return/reconciliation paths. Account receipt lookup filters owned purchases and Stripe events, projects receipt URL only, limits 100 rows, and tolerates optional lookup failure. No receipt delivery or new provider payment is claimed from unit fixtures. Targeted validation: 39 receipt/account/return/reconcile tests, 21 account UI tests, prior 8 checkout tests; TypeScript and diff checks pass. Staged production build dpl_EU9uZN8A2CXDPGsk7jn7v4aBxC3y started with --skip-domain. Checkout=false and live reconciliation apply=false were re-read from Vercel; automatic tax flag is absent/default false. No Git push or tax registration change.

September 9 release completed: d68d11969 deployed as dpl_EU9uZN8A2CXDPGsk7jn7v4aBxC3y and promoted after staged policy HTTP 200/content checks. Canonical policy HTTP 200, seven-day copy verified; unauthenticated account API 401 and unsigned Stripe webhook 400. Rollback target is prior sales-off deployment dpl_3JrM4Nrp3MPuYrhz7hPA3TZLFC2U. Fresh Stripe Checkout settings confirmed the exact public Terms/privacy URLs, tim@fhfhockey.com, and policy#refunds support URL; Save disabled after successful save. Earlier missing-field errors were stale Dashboard account data, resolved with a fresh settings tab. Tax registration/collection and checkout remain parked/off. One synthetic real-inbox validation email requested for owner authorization; not yet sent. Local policy review server remains available on port 3012.

September 9 LineupExperts export boundary (local, not deployed): owner requested preserving free projections while blocking CSV export. Shared client/API/CSV formatter checks now reject declared LineupExperts skater/goalie selections, including blends and zero-weight selections. No values are silently removed from an export and no free source is removed. Sources settings link credits LineupExperts. 15 targeted export tests passed; patch also applied to isolated release worktree for the next approved deployment. This is not origin verification: export rows and provenance are client-submitted, so deliberately relabeled rows cannot be identified by this guard. Server-recomputed exports would be required for that stronger guarantee. Public display notification, source acquisition permission and paid-analysis permission remain unresolved; no provider notification was sent. Do not mark source permission approved from this change alone.

September 9 revised owner decision: removed both LineupExperts configs from the public projection-source registry, removing Settings options and projection fetch/blending participation, including stale saved controls. Removed the now-obsolete source notice. Database tables/data and ingestion remain untouched. 28 targeted tests passed. Changes are local and copied to the release worktree; not deployed. This supersedes the previous plan to retain LineupExperts in the free dashboard.

September 9 operator reconciliation: fresh Stripe account settings show **Payments, Payouts and Link payments Active**, with **No active tasks to complete**. Fresh Customer emails shows successful-payment/refund emails enabled and replies directed to **tim@fhfhockey.com**; the personal-address display was stale tab state. This verifies configuration, not actual inbox delivery. LineupExperts removal committed as f57df7ec4 in the isolated release; staged deployment dpl_hmnsKom2TvUHzbw2KyJVj2o7kgXA is building, with production domain promotion pending. Database copy untouched.

September 9 source-removal release completed: **f57df7ec4**, deployment **dpl_hmnsKom2TvUHzbw2KyJVj2o7kgXA**, promoted to https://fhfhockey.com. Staged browser verified four default skater sources, three goalie sources, two optional A&G components, and no LineupExperts option. A free Connor McDavid pick succeeded. Post-promotion HTTP checks: dashboard/policies 200, anonymous account 401, unsigned webhook 400. No migration or database-copy change. Rollback target: dpl_EU9uZN8A2CXDPGsk7jn7v4aBxC3y (d68d11969). All ten sales/capability/tax/apply flags re-read as off or absent/off.

### Remaining external work — explicit disposition

- **Tax: PARKED**, per owner. Await paperwork/registration outcome; then validate sandbox automatic tax and approved classification before collection/sales.
- **Sources: OWNER-WAIVED.** Owner explicitly instructed proceeding without source-permission verification. No permissions are represented as verified and no outreach is authorized. LineupExperts stays removed from dashboard use; its database copy is untouched.
- **Patreon: OWNER-DEFERRED.** Real paid-membership and signed-webhook evidence is explicitly waived/deferred for this launch decision; existing fixtures and creator OAuth do not turn those checks into passes.
- **Receipt/support delivery: PROVIDER LIMIT + PENDING OWNER RESPONSE.** Test receipt preview passes, but Stripe says it does not email test charges. Live delivery remains an observation for a legitimate purchase after launch. The earlier permission request for one synthetic Resend email to tim@fhfhockey.com remains unanswered; no message sent.
- **Stripe reconciliation: COMPLETE.** Owner authorized Stripe CLI for the intended live account. The existing `runStripeReconciliation` function ran with `apply:false`, limit 25, real production Supabase reads, and an ephemeral read-only Stripe CLI transport supplied through its existing dependency parameter. Result: `dryRun:true, checked:0, eligible:0` — no pending purchases required reconciliation. No writes, grants, charges or email sends. The Vercel sensitive Stripe key was not retrieved; the standalone SDK/API-key command was not used.
- **Activation: WAITING ON ABOVE.** All production capability flags and checkout stay off. Enable only the reviewed launch scope, verify authenticated free/eligible access, and enable checkout after the external gates are resolved. Yahoo remains off.

Launch gate count remains **6/10 (60%)**; implementation completion and individual checked procedures are not substituted for unresolved launch gates.

September 9 final operator checks: production refund-email retry dry run completed with `{ "attempted": 0, "sent": 0, "failed": 0, "dryRun": true }`; no pending open emails were selected and no database write/email send occurred. Credentials were used only in process memory and never printed or written to a file. The temporary sandbox Link payment URL now visibly says **“The link is no longer active.”** Cleanup verified; its test payment remains as audit evidence. No live standalone Payment Link was created.

Stripe CLI device authorization opened for the owner to complete. The remaining reconciliation dry run will resume after authorization; no API key requested in chat.

September 9 CLI authorization completed for acct_1UDRx5Lg7s087B8Q. Live account identity was independently checked through `stripe get /v1/account --live`. Reconciliation dry run returned `{ "dryRun": true, "checked": 0, "eligible": 0 }`. This establishes that the current pending queue is empty, not new payment-fulfillment evidence. Launch gates remain 6/10 (60%); checkout remains disabled.

September 9 sales activation instruction: owner explicitly authorized enabling sales and waived source-permission verification. Their new purchase-recovery requirement is implemented in the release worktree: account shows a copyable `DPRO-<purchase UUID>` reference; the existing verify endpoint accepts it only for the authenticated purchaser, reloads Stripe evidence, rejects refunded/disputed/unverified payments, and reuses the purchase grant with a separate idempotent recovery event. This is an account-bound recovery reference, not a bearer coupon or separate complimentary grant; existing database purchase ownership is authoritative. No passwords or additional credential copies are stored. Targeted verification: 61 tests, TypeScript and SCSS passed. Full release-candidate suite passed: 4,475 tests, 3 skipped; 766 files passed, 2 skipped. Runtime commit 5d7f32aef; log /tmp/draft-pro-recovery-release-tests.log. Production publication/activation has not happened for this new recovery code.

Launch decisions: **7/10 gates resolved (6 verified, 1 owner-waived)**; this is not 70% provider verification. Tax remains parked and collection off. A specific tax-setting question is pending before enabling checkout: proceed with automatic tax off, or wait for registration. No answer inferred from elapsed time.

Recovery-code candidate 5d7f32aef is committed and Chef-reviewed. No migration is needed. It is not deployed yet; publication and sales activation await the owner’s pending choice about automatic tax remaining off. The permission waiver is recorded separately from verified gates.

### Managed Payments transition — September 9, 2026

- Owner approved Stripe Managed Payments' additional 3.5% fee and refund authority (up to 60 days; 48-hour merchant response).
- Live Dashboard setup completed: `Ready to use`, one eligible product, per-session opt-in; default remains disabled. Refund preference remains email for approval.
- Local Checkout implementation adds `DRAFT_PRO_STRIPE_MANAGED_PAYMENTS_ENABLED=true`, omits incompatible ordinary tax/payment-method options, rejects inclusive prices, and expires old ordinary open sessions before replacement. USD price remains $5.99 plus applicable tax. Existing account-bound fulfillment remains authoritative.
- Public/account refund copy explains Stripe policy precedence and links to Link support; FHFH's seven-day request form remains available.
- Verification: 51 targeted Checkout/fulfillment/account tests passed; TypeScript passed. No Managed Payments provider test or deployment is claimed yet.
- Sandbox CLI authorization requested: current authorization covers only the live account. Complete sandbox validation before enabling sales. Production sales remain off.
- Managed Payments provider gate passed: real sandbox tax withholding, route-created account-bound purchase, signed webhook, return replay, recovery code, active grant and account API verified against disposable services. See `verification/stripe-provider-20260909.md`.
- Full release suite: 4,477 passed, 3 skipped; TypeScript passed. Production feature/checkout/Managed Payments flags saved for the next deployment; Yahoo stays off. Staging and promotion pending. Receipt inbox delivery remains unverified.
- Rollback for this release: promote `dpl_hmnsKom2TvUHzbw2KyJVj2o7kgXA` (previous sales-off release), and reset `DRAFT_PRO_CHECKOUT_ENABLED=false` before any subsequent deployment. Preserve purchases, entitlements, provider events and retained work. Do not roll back database history.

### Support inbox delivery — September 9, 2026

Owner explicitly authorized test emails. Production-configured Resend accepted message `1fc3a097-0ba9-4aa1-ad40-86a65a9d4a0e`; Chrome independently showed `[TEST] FHFH Draft Pro refund-support delivery verification` in tim@fhfhockey.com Inbox from draft-pro@fhfhockey.com at 7:36 PM Eastern. This used the production sender/recipient configuration with synthetic content; no real refund request or entitlement was created. Stripe sandbox receipt delivery to the support address was rejected: only team-member addresses/aliases are allowed. Authorization to use the existing Stripe account email was requested; receipt delivery remains pending.

Final delivery acceptance: owner authorized the alternate Stripe team-member recipient after sandbox rejected the support address. Chrome verified the Link message “Your Five Hole Fantasy Hockey sandbox receipt” in Gmail Inbox on September 9 at 7:37 PM Eastern with Invoice-MPIFS5NA-0001.pdf and Receipt-2300-7777.pdf. This closes the delivery gate using actual sandbox receipt delivery and actual production-configured Resend sender delivery. All launch gates are resolved; source-permission verification remains owner-waived, Patreon paid-member validation owner-deferred, and Yahoo a separate parked milestone. No real charge or refund was created.
