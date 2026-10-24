# Draft Pro sales closed; paid-sync rollout remains off

Local candidate based on `2a5092d37cb863ec92a2a4e609999cf226bfa4a5`, canonical `octoberBranch`. No commit, push, deployment, configuration change, credential access, Stripe/provider call, refund, schema change or service started. This packet requires independent review and release-owner integration. Do not publish the entire dirty checkout.

## Behavior

- New Draft Pro checkout is unconditionally rejected after authentication with HTTP403 and `draft_pro_sales_closed`, before importing/calling the checkout adapter. An old `DRAFT_PRO_CHECKOUT_ENABLED=true`, stale browser or forged direct request cannot reopen app sales. GET still returns405. Account availability is false; existing eligible customers retain their access/readback.
- Draft Pro panel has no new-purchase handler/button even when its response incorrectly says checkout is available. Purchase verification/recovery, receipts, existing refund-request controls, Patreon, saved work and purchased/grandfathered capabilities remain. No refund action was performed or policy changed.
- Homepage promotion removed. Draft header/settings, God View, mock draft and Suggested Picks now link to **existing access** without offering a new purchase. The account tab remains for management/recovery. Existing terms are retained with a sales-closed notice; historical $5.99 price is not an offer for sale.
- New **server-only** `PROVIDER_SYNC_PREMIUM_ENFORCEMENT_ENABLED` requires the exact string `true`. Unset/false/malformed leaves paid sync enforcement **OFF**. No environment was inspected or changed. Future activation requires a working approved checkout and separate release/configuration approval.
- With enforcement off, authenticated sync capability returns `eligible:true`, `reason:rollout_free`, no granting source/expiry, and skips premium lookups. Authentication, account/team ownership, provider readiness and feature/cohort controls remain. This is permission to sync, not a paid grant. With enforcement on, existing central monthly/season/supporter/legacy checks remain authoritative; free/expired→403, unknown/failed→503, anonymous→401.
- Billing display and in-season duplicate-purchase checks explicitly request `entitlementOnly:true`. They never interpret free sync as paid membership. Unknown billing entitlement still returns a transient error. In-season checkout activation flags remain untouched/default-off. $4.99 monthly/$24.99 one-time season pricing and July1 cutoff/cancellation/grace semantics are unchanged.

## Surface and route inventory

| Surface | Result / shared path |
|---|---|
| `/account` Yahoo, Fantrax provider actions | `useProviderSyncAccess` reads the default-off capability response; no free-account upgrade gate after authenticated readback. Manual forms/imports and disconnect remain. |
| `/draft-dashboard` Yahoo/Fantrax start/poll/settings; `/start-chart` Yahoo comparison; Player Pickup Yahoo load | Same hook/readback. No edits to PlayerPickupTable or active Yahoo/RSO UI files. Existing feature readiness and local state handling remain. |
| `/roster-schedule-optimizer` provider sync | Existing access route now receives free `rso_sync` capability through central adapter. No unrelated account-save/auto-upkeep grants are invented; existing independent capabilities remain. Fantrax's unsupported RSO adapter still returns409. |
| `/account?section=draft-pro`, draft header/settings, God View, mock draft, Suggested Picks, homepage | New-sales CTA removed or replaced with existing-access management wording. Policies link remains historical/support documentation. |
| `POST /api/v1/account/draft-pro/checkout` | Always403 for authenticated users; no Stripe/checkout DB work. Anonymous auth denial preserved. |
| `GET /api/v1/account/provider-sync` | Private authenticated sync permission. `?entitlementOnly=true` selects actual membership readback, used by InSeasonPanel. |
| `POST /api/v1/account/in-season/checkout` | Existing disabled/isolation gates and actual entitlement duplicate check retained; only explicit entitlement-only argument added. |
| Yahoo `connect`, `callback`, `refresh`, `team-roster`, `pickup`, `starter-board` | Existing `requireProviderSyncAccess` now honors central rollout. OAuth transaction ownership/validation stays before exchange; no callback edit. |
| Yahoo `draft-sessions` GET/POST, owned session GET/poll; `/api/internal/yahoo-live-draft` and worker poll coordinator | Existing `loadProviderSyncAccess` honors rollout; readiness/cohort/owned-session rules retained. Type accepts explicit free-rollout permission. |
| Fantrax `discover`, `link`, `refresh`, `apply-settings`, selected-league connection PATCH, account and Draft Pro `player-data` | Existing domain guards use central rollout before provider calls. |
| Fantrax draft-session start/poll/list eligibility; `/api/internal/fantrax-sync` | Existing live-draft/shared guard and per-account scheduled guard honor rollout. Scheduling fairness/bounds untouched. |
| RSO `access`, `provider`, newly authored `yahoo-current-data` | Central policy applies. `yahoo-current-data` belongs to release owner's separate trusted-Yahoo packet; not edited or qualified by this packet. |
| Historical Draft Pro checkout verify/webhooks, owned readback/recovery; stop/disconnect/manual imports; shared NHL/Yahoo ownership ingestion | Preserved. No paywall added to otherwise-free pages, no local plans cleared, no live external paths invoked. |

The previous audit at `../provider-sync-paywall-2026-10-21/REPORT.md` provides the detailed unchanged domain/route map. Its always-on statements are superseded here by the approved rollout switch; its historical test totals are not counted as this packet's verification.

## Verification

**320 distinct tests passed in20 files, latest result per file across overlapping runs—not one320-test run.** First19-file run:307/312, with4 failures from a leftover removed state setter and1 invalid allowlist test ID. Corrected two files:31/31. Additional existing starter-board policy fixture now explicitly activates enforcement:8/8. Final type-only cast correction has no runtime effect. Receipts: `tests.json`, `corrected-tests.json`, `starter-board-tests.json`, `TEST-SUMMARY.json`.

Coverage: stale/direct checkout, old flag true, existing purchase/recovery and isolation; off-switch free/UI/readback, anonymous auth, paid/legacy truth, billing outage separation, RSO sync-only permission, provider readiness/cohorts; on-switch monthly/season/supporter/grandfather/expired/cancelled/grace/unknown cases and13 direct API denial paths. Existing owned grants/verification/fulfillment tests passed. Not an exhaustive cross-product of every account state and route.

Node22.11.0/npm10.9.0, existing dependencies, ordinary temporary source copy, ignored env files excluded, synthetic import config, Vite `envDir:false`, network-denial preload, one test worker; no `GIT_DIR`. Exact cwd/environment/argv in `COMMAND.json`, `CORRECTION-COMMANDS.json`, `FINAL-CHECKS.json`, `STARTER-BOARD-CHECKS.json`. Main command entrypoints:

```sh
python3 tasks/artifacts/billing-sales-rollout-2026-10-23/verify.py
python3 tasks/artifacts/billing-sales-rollout-2026-10-23/verify-correction.py
# Inside the recorded isolated web/ snapshot:
npm test -- --run --config audit.vitest.config.mts <exact focused paths in receipts>
npm exec --offline --no -- tsc --noEmit --project tsconfig.billing-check.json
npm exec --offline --no -- eslint <exact leased paths in receipts>
```

Scoped TypeScript passed for the33-path core packet and imported dependencies. The later two-line starter-board fixture activation passed its8 tests and lint; no full application type-check claimed. Lint passed all34 changed source/test paths, zero diagnostics. Diff whitespace check passed. E2E specs updated but **browser execution not run**, no build. Shared heavy-check lock released; no process/server left running.

## Manual/browser acceptance for release owner

Use isolated mocked accounts/provider responses; do not use production provider calls for these checks.

1. With rollout variable absent, sign in as free: account Yahoo/Fantrax supported sync, Pickup, Start Chart and draft controls must not show a premium upsell. RSO gets sync capability only. Existing readiness restrictions/unsupported Fantrax RSO remain explicit.
2. In account Draft Pro, mock stale `checkoutAvailability.available:true`: no Get/Buy button; closed-sales notice, saved work and purchase recovery remain. Direct authenticated POST checkout returns403; signed-out request remains401.
3. Existing paid/grandfathered/supporter fixtures: original feature access, history/receipts/recovery remain. In-season billing panel reports actual membership, never “premium active” merely because rollout is free.
4. Sign out/switch account while a request is pending: previous owner's state cannot reappear. No local plan/import data is silently removed. Disconnect and manual continuation remain available.
5. In isolated fixtures only, set rollout flag to exact `true`: free/expired sync denied with season-pass upsell; valid grants work; unknown/failed verification offers retry, not upgrade. Return to unset afterward. No live activation is authorized by this packet.
6. Check draft header/settings/God View/mock/tier surfaces and homepage at desktop/mobile widths: no new Draft Pro sales promotion. E2E changes are in `god-view.spec.ts` and `draft-layout.spec.ts`; runtime acceptance remains pending.

## Remaining limits / approvals

- Independent packet review, combined release type/browser acceptance and exact candidate release custody remain with the parent/release owner. No deployed status is claimed.
- Previously issued hosted Stripe checkout links may remain payable until their existing expiry. This local app shutdown does not inspect or expire them, disable a Stripe product, or issue refunds. Any bounded Stripe cleanup is a separate explicit action/approval.
- Working monthly/season checkout, active worker/trigger, production configuration and schema admission remain separate existing release gates. The billing SQL remains an unchanged artifact draft outside the active migration chain. No migration authority is implied.
- No outstanding execution denial. Cross-thread messaging was not attempted; this handoff is returned through the parent, using the release owner's read-only recorded scope confirmation.

Exact application/test inventory: `FILES.md`. Before/after hashes: `CHANGED-FILES.json`. Delta-only patch: `packet.patch`. Preserve historical receipts, concurrent dirty/untracked work, monthly correction bytes and all release-owner/Yahoo/Game Grid/FORGE/stats leases.
