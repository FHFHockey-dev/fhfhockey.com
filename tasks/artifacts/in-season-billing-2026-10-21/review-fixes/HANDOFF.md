# Three P1 review corrections — local handoff

The three independent-review reproductions failed before repair and now pass. This increment changes exactly **seven implementation/test paths: four application files and three test files**. Baseline-relative patches and SHA-256 hashes are in [CHANGED-FILES.json](CHANGED-FILES.json), so earlier paywall/billing work and concurrent edits are not presented as this delta. No migration, manifest, lockfile, credential or production configuration changed.

## Corrections and evidence

| Finding | Correction | Regression evidence |
|---|---|---|
| Six expired Fantrax leagues starve a later paid league | Scan at most 60 due candidates, check central entitlement per account, select at most six eligible leagues. Hourly rotating windows cover larger denied backlogs without changing skipped leagues' freshness. Recheck entitlement and remaining runtime before credential/provider access. | Six expired plus one paid reaches the paid account on both runs; 65 denied plus one paid reaches the paid account in the next hourly window; denied accounts never load credentials/call the provider; runtime exhaustion stops work. |
| Request-start timestamps misorder fresh monthly refund snapshots | Persist an optional refund observation version derived from the state held by the fenced reconciliation lease. New observations supersede older versions even if their request timestamps are earlier. The existing lease-token/expiry commit guard rejects stale in-flight reads. | Interleaved pending→succeeded and succeeded→failed reads preserve the later acquired reconciliation; a stalled read whose lease expires cannot overwrite a newer committed completion; lower-version and unordered snapshots cannot overwrite ordered state. |
| A retry that paid successfully but lost its response is discarded after five minutes | Separate authorization to collect from the duty to reconcile. Retrieve and validate the existing invoice after the window, using the same verified payment/refund/dispute reconciliation as the webhook. Finish only after a verified outcome is saved; in-flight/ambiguous results remain unfinished. | Success followed by a lost response, recovered six minutes later, persists paid access with exactly one pay call. Cutoff and both local/provider cancellation preserve accounting without reopening access or charging. Definitive third decline and recovered full-refund cases also pass. |

The refund sequence uses existing JSON state and fenced persistence; no schema change was needed. The shared reconciliation helper validates invoice allocation, payment intent/charge binding and complete adjustment lists before producing a grant. Legacy timestamp-only snapshots remain readable; once a refund has ordered state, an unordered replacement is rejected.

The Fantrax scan has a 60-candidate application bound and keeps the existing six-league, two-account concurrency and runtime/headroom limits. The existing cron runs hourly (`17 * * * *`). Hourly rotation avoids a fixed denied backlog hiding later accounts; it does not establish a scheduling SLA under changing backlog size, missed cron runs or slow database queries. Skipped leagues are never marked fresh.

## Exact implementation/test delta

Application:

- `web/lib/integrations/fantrax/server.ts`
- `web/lib/in-season/monthlyLifecycle.ts`
- `web/lib/in-season/monthlyWebhook.ts`
- `web/lib/in-season/monthlyExecutor.ts`

Tests:

- `web/lib/integrations/fantrax/server.test.ts`
- `web/lib/in-season/monthlyLifecycle.test.ts`
- `web/lib/in-season/monthlyIntegration.test.ts`

Supporting artifacts are this handoff, baseline snapshots/patches, changed-file manifest, JSON test/check receipts, the main report's latest-checkpoint link and the existing context diary update. The diary is not release or acceptance evidence.

## Verification

Run from `web/` with Node **22.11.0**, npm **10.9.0**. No `GIT_DIR` override.

- [REPRODUCTION.json](REPRODUCTION.json): **3 failed, 37 passed** before implementation. The failures are the three reported defects.
- [FIRST-FIX-RESULTS.json](FIRST-FIX-RESULTS.json): initial fixes resolved those reproductions; 60 passed and two older mock cases failed because they represented an unpaid invoice with paid payment objects. Corrected fixture transitions now model settlement explicitly.
- [FOCUSED-RESULTS.json](FOCUSED-RESULTS.json): **72/72 passed** in the three changed test files.
- [FINAL-RESULTS.json](FINAL-RESULTS.json): **366/366 passed, 12 files, zero skipped, in one final run**. These are not added to historical overlapping run counts.
- [LINT.json](LINT.json): seven changed files passed targeted ESLint, zero warnings.
- `git diff --check` passed for the tracked changed files; baseline-relative patches are also checked for whitespace errors.
- **TypeScript passed, exit 0:** [TYPECHECK-8GB.json](TYPECHECK-8GB.json). The initial default-heap run exhausted Node's approximately 4 GiB heap (exit 134); the retry used the previously used 8 GiB limit and disabled incremental output. No source change was required.

Final test command:

```sh
npm test -- components/account/InSeasonPanel.test.tsx lib/in-season/access.test.ts lib/in-season/billing.test.ts lib/in-season/billingRoutes.test.ts lib/in-season/commerce.test.ts lib/in-season/monthlyIntegration.test.ts lib/in-season/monthlyLifecycle.test.ts lib/in-season/monthlyStripe.test.ts lib/integrations/providerSyncAccess.test.ts lib/integrations/providerSyncPaywall.test.ts lib/integrations/fantrax/server.test.ts __tests__/pages/api/internal/fantrax-sync.test.ts --reporter=json --outputFile=../tasks/artifacts/in-season-billing-2026-10-21/review-fixes/FINAL-RESULTS.json
```

Lint command:

```sh
npx eslint lib/integrations/fantrax/server.ts lib/integrations/fantrax/server.test.ts lib/in-season/monthlyLifecycle.ts lib/in-season/monthlyLifecycle.test.ts lib/in-season/monthlyWebhook.ts lib/in-season/monthlyExecutor.ts lib/in-season/monthlyIntegration.test.ts
```

TypeScript retry:

```sh
NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit --incremental false
```

## Status and remaining release work

- **Local only:** no external Stripe/provider request, database write, applied migration, service startup, key/configuration change, commit, push, build or deployment in this correction increment. Existing concurrent changes were preserved. Monthly public checkout still rejects requests; no automatic worker trigger was added.
- **Pending independent re-review:** the seven-file correction delta is ready for the completed review thread to inspect. Passing local mocks do not establish release readiness.
- **Service proof remains separate:** this increment's refund ordering, lease-expiry and unknown-payment recovery checks use mocked fixtures. Historical isolated SQL, Auth, Stripe clocks and natural cutoff evidence remain in the earlier handoffs; they are not a rerun of these corrections or proof of deployed scheduling.
- **Pending refund request remains unresolved:** last authorized read on October 21 at 18:43:57 UTC showed `requires_review` and no refund. The [exact Stripe approval request](https://dashboard.stripe.com/acct_1UDRxGLaomqkve47/test/settings/approvals/requests/apreq_test_61VcRrl4OlX6lIlYG16VMpuc7lSQy9I9FTdeM4784LQu) was not re-read or resubmitted in this local-only increment. Real refund/dispute access readback remains incomplete. Three hosted Checkout cases remain consumed; none added.
- **Release/configuration approval remains required:** reviewed production schema/rollout, live catalog/credentials and authenticated webhook/worker configuration, retry/minimum and operational verification, and deployment remain separate. No live billing or trigger is enabled. Existing valid supporter/grandfather grants remain intact; selecting a new first-100 cohort and unchosen tax/legal terms remain separate.

No approval denial or uncertain new external action occurred in this increment. An optional read-only `ps` diagnostic was blocked by the local sandbox (`operation not permitted`); it was not retried or escalated and is not a blocker because the type-check process returned exit 0 directly. Temporary services were not restarted; their earlier stopped-state receipt remains historical evidence rather than a new cleanup claim.
