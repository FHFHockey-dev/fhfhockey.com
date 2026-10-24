# Job79 retirement/advisory planner independent review

**Qualified local acceptance.** No new blocking defect found in the exact nine-file overlay. Retain the retirement and advisory-planner changes together; do not apply only the schedule-slot removal. This accepts the pinned local packet for release reconciliation, not deployment, live cron changes, or a production-health claim.

Patch SHA-256: `4e0b4db7da44e883dd278f611c787db646b83874af8b9e7d624d4fd5c75389ec` against base `6d5664f761132ab479a7febec60548d0fa9ee6ff`.

## Actual source findings

- The planner treats audited cron-slot clearance as advisory while preserving its diagnostic fields. Burst eligibility uses the complete job count below 40, not queued-date count or per-invocation cap. Counts of 40 or more require at least 21 seconds. Unsafe explicit goalie intervals are rejected; longer explicit intervals are retained.
- The unchanged gamelog route computes `fullPlanRequestCount` before slicing resumed work, passes it both to the planner and to `requestControl.plannedRequestCount`, and retains that control for retries. Its budgeted client invokes `withNstRequestBudget` before transport, keeps the deadline through body consumption and rejects redirects. This packet does not replace those route/client fixes or the continuation/persistence code.
- Actual dispatch protection is the unchanged **same-user local filesystem ledger**: exclusive admission, all four rolling windows, normalized-URL active-duplicate checks, previous/current interval maximum, shared attempt cap, and fail-closed missing dispatch acknowledgement. The 600000 ms completion-spacing/concurrency-one fields in `nstCoordination.ts` are policy metadata consumed by benchmark metadata, not a global runtime job lock. The ledger can admit distinct small-job URLs concurrently; it does not establish cross-host/container coordination. No broader runtime guarantee is accepted here.
- The replacement daily owner exists in the frozen `web/vercel.json`: `/api/v1/db/run-rolling-forge-pipeline?...` at `5,10,15,20,30,35,40,45,55 10 * * *`. Its upstream stage invokes the gamelog route with explicit source dates, cursor and bounded deadline. The existing lease/continuation/WGO-degradation path is unchanged. Job399 is the separate queued route-runner worker, not the replacement daily scheduler.
- The job399 route still checks configuration before claiming work; its unchanged tick checks live ownership, conditionally claims one job, and checks for another holder before invoking a route. The database implementation and scheduler predicates were inspected as source only. This is not a fresh database-concurrency certification.
- Only JSON inventory record 79 changes and record 399 is added; every other record is byte-equivalent after parsing. The Vercel schedule is unchanged. The nine patch paths contain no runtime route, lease implementation, request-budget implementation, database migration or Vercel config. Existing producer/consumer repairs therefore remain outside the overlay. Applied/retired production facts in the document remain sourced historical claims, not observations by this reviewer.

## Independent verification

All 79 fixture hashes and their base hashes verified. The nine-file patch applies with whitespace checking to a separate disposable baseline copy and reproduces every declared candidate hash. [Snapshot](SNAPSHOT.json), [patch application](PATCH-APPLICATION.json), [scope checks](SCOPE-CHECKS.json).

**36 tests passed** on Node 22.11.0 with existing npm dependencies and inherited network-denial preloads:

- 26 targeted coordination and ledger cases, including all four rolling windows, separate local processes, invalid/unknown full-job counts, retry accounting, active duplicate exclusion and crash/deadline handling. [Log](TARGETED-TESTS.log).
- 10 independent imported-code cases, including a retired small-job plan behind a paced reservation, an already-exhausted minute window, a one-attempt resumed suffix from a 40-URL job, preservation of a longer interval across job handoff, invalid full counts, and the 21-second policy floor. No NST transport is invoked. [Fixture](adversarial.test.ts), [log](ADVERSARIAL.log).
- The single retirement-only negative control independently fails as expected: a 20-URL plan becomes 21000 ms instead of 0 when the old planner is combined with the removed slot. The complete candidate passes the same oracle. [Negative-control log](RETIREMENT-ONLY-RED.log).

The owner's 102-case suite, scoped TypeScript and ESLint receipts were inspected; they were not redundantly rerun in full. The frozen candidate and original owner artifacts remained unchanged through this review. Exact pins and supporting hashes are in [RECEIPT.json](RECEIPT.json).

## Remaining boundaries

Keep the progress-read query/index proposal held. The actual route already filters exact scope and job name, orders by time and reads two rows to detect ambiguous equal timestamps. No retained database error code, timing or query plan justifies an index/filter change; explicit progress must not gain an arbitrary TTL or lose failed/blocked receipts. No SQL or database request was made.

Release reconciliation must preserve this coupling and recheck changed bytes. This review does not confirm a deployed replacement schedule, a newly completed scheduled pipeline, distributed NST coordination, or current production health. No canonical application edits, network/production/NST calls, SQL, cron mutations, commits or deployment. Only independent artifacts, diary and disposable verification fixtures were written. No approval or execution blocker.
