# Inactive billing entrypoints — local review packet, 2026-10-22

**Later correction:** independent review found same-owner auth refresh discarded unresolved cancellation IDs. The [two-file owner-refresh correction](../cancellation-owner-refresh-2026-10-22/HANDOFF.md) supersedes only this packet's panel and panel-test hashes; all other seven packet hashes and all 11 prior core hashes remain unchanged. The reviewer independently passed 105 entrypoint tests and found the remaining entrypoints locally conforming; the new correction still requires re-review.

The guarded account UI/routes and an inactive authenticated worker entrypoint are implemented locally. **This new packet needs independent review; prior acceptance of the billing core does not accept these changes.** All 11 files in the prior correction-manifest union remain byte-for-byte unchanged. No activation flags or credentials were configured, SQL applied, Stripe/provider calls made, services started, cron added, production configuration changed, commits/pushes or deployments performed.

## Concrete behavior

- Monthly signup uses the existing finite monthly adapter through the account checkout API. Its new activation flag defaults off. The existing isolated-sandbox configuration guard, explicit verified minimum, approved quote and final signup cutoff remain required. The route uses the authenticated owner, rejects client owner/price/minimum overrides, avoids duplicate valid access, and fails closed on unknown entitlements. Below-minimum signup explains that no rounding up or balance carry occurs. Availability GET performs no Auth/DB/Stripe call and returns no secret/configuration values.
- The account panel uses the matching monthly hosted invoice destination (`https://invoice.stripe.com`) and retains the separate season-pass destination (`https://checkout.stripe.com`). It rejects credentials, alternate ports and misleading hostnames. A pending payment never grants access in the browser. Monthly pricing, fixed season cutoff, independent grants and manual plans are preserved.
- The new subscriptions GET is independently disabled by default. It authenticates the owner, accepts no query overrides, calls only a service-only owner-filtered RPC, validates returned ownership/shape, and exposes only subscription ID, cancellation/stop timestamps and stop completion. An absent RPC or failed lookup returns 503, never a false empty success.
- Cancellation uses the existing unchanged API/lifecycle, including for owners without current premium entitlement. The UI asks for confirmation, preserves the same request ID across uncertain retries, and does not claim provider billing has stopped merely because cancellation was saved. Readback distinguishes requested and completed stop. Auth changes invalidate pending purchase, cancellation and management responses. It does not clear saved plans or independent access.
- `POST /api/v1/internal/in-season-billing` has no schedule. It defaults off, requires a separate server-only token (no admin/cron-key fallback), compares token digests in constant time, rejects all body/query overrides and validates the existing isolated sandbox configuration. It requires an explicit retry-setting verification reference and invokes the existing executor once with **limit 1**, without a caller-supplied clock. The route declares a 300-second platform duration; deployed timeout behavior has not been exercised. Existing durable leases/receipts remain responsible for interrupted recovery.
- Worker failures are truthful: unfinished per-job results return 503 with `needs_attention`, successful completed IDs are retained, and an empty/busy result is `no_jobs_completed`. Provider error text is not exposed. A global account/list failure returns a generic 503; this route performs no automatic retry. The one-job limit requires repeated separately authorized invocations for a backlog; no cadence was selected.

## Exact packet inventory

Application (5):

- `web/components/account/InSeasonPanel.tsx`
- `web/pages/api/v1/account/in-season/checkout.ts`
- `web/pages/api/v1/account/in-season/subscriptions.ts` — new
- `web/pages/api/v1/internal/in-season-billing.ts` — new
- `web/lib/in-season/billingEntryConfig.ts` — new

Tests (3):

- `web/components/account/InSeasonPanel.test.tsx`
- `web/lib/in-season/billingRoutes.test.ts`
- `web/lib/in-season/billingEntryPoints.test.ts` — new

Separate **unapplied review draft** (1): [DRAFT-OWNER-LOOKUP.sql](DRAFT-OWNER-LOOKUP.sql). It adds the missing read-only owner lookup, limits results to 20, retains service-only execution and grants no table access. It is an artifact, not an installed migration. The existing reviewed SQL is unchanged. Turning on management before this RPC exists fails closed.

[CHANGED-FILES.json](CHANGED-FILES.json) fixes all nine SHA-256 hashes, baseline/current HEAD, exact per-file patches and the unchanged prior 11 hashes. Four existing files were snapshotted before editing; five files are new. No Yahoo/FORGE/stats worker files were edited. Supporting changes are this packet, the parent report/readiness pointers and the retained billing diary.

## Verification actually run

Node **22.11.0**, npm **10.9.0**, from `web/`, no `GIT_DIR`, dependencies, lockfile changes or build:

```sh
npm test -- lib/in-season/billingRoutes.test.ts lib/in-season/billingEntryPoints.test.ts components/account/InSeasonPanel.test.tsx lib/in-season/monthlyIntegration.test.ts lib/in-season/monthlyLifecycle.test.ts lib/in-season/monthlyStripe.test.ts lib/in-season/commerce.test.ts lib/in-season/access.test.ts --reporter=default --reporter=json --outputFile=../tasks/artifacts/in-season-billing-2026-10-21/inactive-entrypoints-2026-10-22/FINAL-RESULTS.json
NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit --incremental false
npx eslint components/account/InSeasonPanel.tsx components/account/InSeasonPanel.test.tsx pages/api/v1/account/in-season/checkout.ts pages/api/v1/account/in-season/subscriptions.ts pages/api/v1/internal/in-season-billing.ts lib/in-season/billingEntryConfig.ts lib/in-season/billingEntryPoints.test.ts lib/in-season/billingRoutes.test.ts
```

- **Passed: 307/307 tests in one final eight-file run**, zero failures/skips. Counts: routes 51, entrypoints 30, panel 24, monthly integration 63, lifecycle 24, Stripe facts 38, commerce 57, access 20. Earlier 102/306 runs overlap; do not add counts.
- **Passed:** final full TypeScript and eight-file ESLint, exits 0. Initial Buffer typing and JSX apostrophe findings were corrected before the final successful checks. Logs and exact test receipt are retained in this folder.
- **Passed:** final manifest/source-hash checks, draft read-only/security contract assertions and artifact links. The SQL assertions inspect source; they do not execute PostgreSQL.
- **Not run:** new RPC syntax/RLS/runtime tests in a real database, browser-hosted payment, provider execution of this new route, scheduling or production checks. Existing real-PostgreSQL proof concerns the unchanged earlier queue function, not this new owner lookup. UI tests use jsdom and mocked navigation, not a browser payment session.

## Activation and remaining gates

New server-only gates all default off: `IN_SEASON_SANDBOX_MONTHLY_SIGNUP_ENABLED`, `IN_SEASON_SANDBOX_MANAGEMENT_ENABLED`, `IN_SEASON_SANDBOX_WORKER_ENABLED`. No values were set. Worker configuration additionally needs `IN_SEASON_SANDBOX_WORKER_TOKEN`, `IN_SEASON_SANDBOX_AUTOMATIC_RETRIES_DISABLED` and `IN_SEASON_SANDBOX_RETRY_VERIFICATION_REFERENCE`; the latter records verified settings, not permission to change them. Existing sandbox isolation, account/catalog, minimum and signing-secret requirements remain unchanged. No live-environment implementation or credentials are introduced.

Next: independent review of this nine-file packet, then separately scoped isolated execution of the owner-lookup draft and route/RPC binding with two synthetic owners. Verify the existing pending refund's actual status before any further adjustment; do not resubmit it. Service recovery/refund/dispute proof, active worker scheduling/monitoring, live minimum/tax choices, production schema adaptation and deployment remain separate gates. Three hosted Checkout cases remain consumed; no additional Checkout or new service activity was authorized or performed here.

No action is currently denied or uncertain. Database/service verification is **not run under the current restrictions**, not claimed complete. Official [Supabase function documentation](https://supabase.com/docs/guides/database/functions) was consulted for the draft; the changelog fetch was unavailable. The new draft deliberately retains the established service-role RPC pattern; it must be verified in isolated storage before enabling management.
