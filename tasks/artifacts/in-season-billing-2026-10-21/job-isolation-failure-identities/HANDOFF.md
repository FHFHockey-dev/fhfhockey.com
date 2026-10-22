# Job isolation and confirmed failure identities — local correction

**Later verification without source edits:** [real PostgreSQL queue verification](../queue-sql-verification/HANDOFF.md) passed 14 check groups on a fresh disposable loopback database, then stopped the server. The seven source hashes are unchanged. The “SQL not executed” statements below describe this original local-code checkpoint; the later receipt supersedes that specific gap, without establishing deployed/provider behavior.

The two new review findings are corrected locally. Earlier entitlement/paywall, refund-ordering and payment-recovery protections remain in place. This is not a release-readiness claim.

## P1: unfinished work cannot abort the batch or monopolize selection

`runMonthlyBillingJobs` now returns `{ completed, failed }` with a job ID and error for each failed job. Each job has its own error boundary; an unknown retry, failed state claim or failed stop operation does not abort the remaining selected jobs. Unknown/failed jobs are not finished or reported as completed. Global sandbox-account verification and job-list failures still reject the invocation.

The existing draft SQL listing now orders eligible due work by:

1. Stop/cutoff jobs before retry jobs.
2. Never-leased jobs before previously attempted jobs; then oldest lease timestamp first.
3. Existing due time and ID as tie breakers, within the existing requested batch limit (maximum 20).

Claiming a job already updates its lease timestamp. Failed jobs retain that timestamp, so a backlog larger than one batch rotates on subsequent runs instead of repeatedly selecting the same oldest failures. No due dates, retry windows or data freshness are rewritten. Active leases remain excluded until expiry; a state lease can defer another job for the same subscription until that lease expires.

The mock queue regression includes 25 older retry jobs, six failing stop jobs and a July cutoff job with an already canceled subscription/completed schedule. With a batch size of two and lease-expiring time advances, the cutoff job is selected and performs inventory reads on the fourth invocation; failed stop jobs rotate rather than monopolize every batch. Separate regressions exercise continuation after an unknown retry for cancellation and July cleanup.

**SQL execution limit:** the test checks the authored SQL ordering contract and models its selection/claim behavior. No PostgreSQL process was started and no SQL was applied. Existing retained test databases still contain their previously installed listing function; approved future setup must include this ordering correction. This artifact does not prove deployed scheduling, query performance or live lease concurrency.

## P2: count identities, not retry slots

New failure observations carry stable identities. The signed initial invoice failure has one identity for that invoice; repeated invoice events and their retry-schedule counters cannot fabricate manual failures. Each definitive manual decline uses its durable job identity. The reducer increments only for a previously unseen identity and retains the original first-failure/grace timestamp.

Thus initial failure + skipped slot two + confirmed slot-three decline produces **two confirmed failures and no third-failure stop**. Initial failure + distinct confirmed slot-two and slot-three declines produces three and requests stopping. Replayed or late receipts count once; completed failure identities also suppress regeneration of their retry intent. Existing historical aggregate state/events remain readable and their stored counts are preserved; this patch performs no record rewrite or retroactive recount.

The 48-hour grace and July cutoff remain unchanged. An unknown manual outcome still stays unfinished without another collection attempt or an invented failure.

## Exact delta

Application (3):

- `web/lib/in-season/monthlyExecutor.ts`
- `web/lib/in-season/monthlyLifecycle.ts`
- `web/lib/in-season/monthlyStripe.ts`

Tests (3):

- `web/lib/in-season/monthlyIntegration.test.ts`
- `web/lib/in-season/monthlyLifecycle.test.ts`
- `web/lib/in-season/monthlyStripe.test.ts`

Draft SQL (1, **not applied**):

- `supabase/migrations/20261021210000_in_season_sandbox_billing.sql`

[CHANGED-FILES.json](CHANGED-FILES.json) records all seven baseline/current hashes and exact patches. Executor indentation changes are the necessary wrapping of its existing per-job body in an error boundary; payment/cleanup behavior is otherwise retained. Other concurrent work was preserved.

## Verification

- [REPRODUCTION.json](REPRODUCTION.json) captured the skipped-slot count failure. Its initial cleanup fixture lacked a required cancellation timestamp, so that first cleanup failure was not treated as proof of the loop defect.
- [P1-CORRECTED-REPRODUCTION.json](P1-CORRECTED-REPRODUCTION.json) uses the corrected fixture against the saved original executor and fails specifically at the unresolved-retry exception. The current executor was restored byte-for-byte immediately afterward.
- [CORRECTED-FIXTURE.json](CORRECTED-FIXTURE.json) and [P1-FINAL.json](P1-FINAL.json) show the corrected targeted cases passing. The first broader run passed 124 tests with one local fixture-path error; the path was corrected for Vitest's working directory.
- [FINAL-RESULTS.json](FINAL-RESULTS.json): **235/235 tests passed, six files, zero failed/skipped, one final run**. This includes monthly integration/lifecycle/Stripe, billing routes, entitlement access and commerce boundaries. Earlier counts overlap and are not additive.
- Targeted six-file ESLint passed with no warnings ([LINT.json](LINT.json)). Full TypeScript passed, exit 0 ([TYPECHECK.json](TYPECHECK.json)). Baseline-relative added-line whitespace checks passed for all seven paths.

Commands from `web/`, Node 22.11.0/npm 10.9.0, no `GIT_DIR` override:

```sh
npm test -- lib/in-season/monthlyIntegration.test.ts -t 'counts two confirmed|continues to July cleanup' --reporter=json --outputFile=../tasks/artifacts/in-season-billing-2026-10-21/job-isolation-failure-identities/REPRODUCTION.json
npm test -- lib/in-season/monthlyIntegration.test.ts lib/in-season/monthlyLifecycle.test.ts lib/in-season/monthlyStripe.test.ts lib/in-season/billingRoutes.test.ts lib/in-season/access.test.ts lib/in-season/commerce.test.ts --reporter=json --outputFile=../tasks/artifacts/in-season-billing-2026-10-21/job-isolation-failure-identities/FINAL-RESULTS.json
npx eslint lib/in-season/monthlyExecutor.ts lib/in-season/monthlyLifecycle.ts lib/in-season/monthlyStripe.ts lib/in-season/monthlyIntegration.test.ts lib/in-season/monthlyLifecycle.test.ts lib/in-season/monthlyStripe.test.ts
NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit --incremental false
```

## Status and remaining work

Ready for independent re-review. Real SQL selection/lease behavior and provider recovery remain unexecuted for this increment. Unknown outcomes require later read-only reconciliation or operator inspection; the future worker trigger must inspect the returned `failed` entries rather than interpret a resolved invocation as universal success.

No external calls, services, credentials/configuration changes, database writes, applied migrations, new sandbox cases, commits, pushes, builds or deployment occurred. Monthly checkout remains disabled and no automatic worker trigger was added. Production migration/configuration/deployment approval and real refund/dispute readback remain separate. No new permission denial or uncertain external operation occurred.
