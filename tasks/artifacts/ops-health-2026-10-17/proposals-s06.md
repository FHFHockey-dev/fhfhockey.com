# S-06 proposals (cron hygiene) — 2026-10-18

These are proposals only; no code here was changed. Source: `tasks/artifacts/super-goal-audit-2026-10-17/findings/G2-cron-ops-lines.md`
(EML::C0036/C0037/C0038, NSR::C0066, problem 9).

## 1. Cron-report email contract gaps

### 1a. "Last recorded success" covers only the 24 h window (EML::C0038)

- **Today:**
  - The only audit read is `cron_job_audit` with `run_time >= since` and
    `since = now − 24 h` (`web/pages/api/v1/db/cron-report.ts`, `auditSource`).
  - `buildLastKnownSuccessMap` therefore sees successes from the same window
    only.
  - So a job that failed today and last succeeded 3 days ago shows no last
    success, which looks the same as "never succeeded".
- **Proposal:**
  - Add one bounded read: the latest `success` row per failing or missing
    job, taken only for the jobs that need it.
  - Implement it as a `job_name IN (...)` query with
    `run_time >= now − 14 d`, `status = 'success'`, ordered by `run_time
    DESC`, capped at one row per job (small `limit`, or a lateral RPC).
  - Label the result as a lookback ("Last recorded success (14-day
    lookback)"). Show "none in 14 days" instead of an empty value.
- **Dependency:** Without an index this is another full 306 MB scan. Ship it
  only after `cron_job_audit_run_time_idx` exists (production plan P-D,
  change 1). With the index it reads a few pages.
- **Budget:** Counts against the report's shared 180 s source budget. Use the
  existing `readReportSource` deadline. If it fails, report the lookback as
  unknown and never as "no success".
- **Tests:**
  - A failure today with a success 3 days earlier shows that date.
  - A lookback read timeout shows unknown.
  - A route/query identity must not borrow another horizon's success (keep the
    existing `auditSuccessKey`).

### 1b. Two sections instead of the specified five (EML::C0036)

- **Today:** `web/components/CronReportEmail/CronAuditEmail.tsx` renders
  "Needs attention" and "Other job results", sorted by priority.
- **Proposal:**
  - Keep the priority sort but group into the specified sections:
    1. Critical failures.
    2. Missing scheduled runs.
    3. Audit/telemetry gaps (route audit missing, timing missing, telemetry
       unavailable).
    4. Partial / skipped / unknown (skip, no output, Yahoo partial, partial
       writes such as the baseline `partialWrite`).
    5. Successful.
  - Each section shows a count header and is omitted when empty.
- **Inputs:** Every needed classification already exists on the `RunDigest`
  (`status`, `missingObservationWarnings`, `observationKind`), so this is
  render-only.
- **Tests:** Extend `CronAuditEmail.test.tsx` with one fixture per section,
  plus an empty-section omission case.

### 1c. Every successful job is listed (EML::C0037)

- **Today:** "Every remaining job, including healthy runs" is listed, and
  `CronAuditEmail.test.tsx` asserts "includes clean successful jobs once in
  the briefing". That deliberately reversed the original spec, but the ledger
  row was never amended.
- **Decision needed (TJ):** Either
  - (a) collapse section 5 to a count plus names only, or
  - (b) keep the full list and amend EML::C0037 to record the reversal.
- **Recommendation:** (a). Successful rows add length, not signal, and a
  failure is easier to miss in a 50-row email.
- **Test change:** Update the existing test to assert names and a count, with
  no detail blocks.

## 2. Module-level `process.exit(1)` in seven NST/data routes (NSR::C0066 class)

- **Files:** `web/pages/api/v1/db/`:
  - `update-nst-gamelog.ts:160`
  - `update-nst-goalies.ts:87`
  - `update-nst-team-daily.ts:60`
  - `update-nst-current-season.ts:27`
  - `update-nst-last-ten.ts:26`
  - `update-nst-player-reports.ts:33`
  - `check-missing-goalie-data.ts:24`
- **Pattern:** At import time, `dotenv.config({ path: "./../../../.env.local" })`
  runs; if Supabase URL or service key is missing it logs, then
  `process.exit(1)`, and then a module-scope `createClient(...)`.
- **Risk:**
  - In a serverless function, a missing env var kills the worker process at
    import. The request gets a platform 500 with no JSON body and no
    `cron_job_audit` row, so the report sees "route audit missing" rather than
    a configuration failure.
  - In tests or tooling, importing the module terminates the runner.
  - The relative dotenv path is meaningless on Vercel.
- **Proposal (per file, behaviour-preserving):**
  1. Delete the module-level `process.exit(1)` and the `dotenv.config`
     call. Next.js loads `.env.local` itself.
  2. Use the shared lazy client `lib/supabase/server` (`getServiceRoleClient`
     validates configuration on first use) instead of a module-scope
     `createClient`.
  3. A missing env var then surfaces inside the handler as a thrown error.
     `withCronJobAudit` records it as a failure with a message, and the route
     returns JSON 500.
- **Tests:** One test per route (or one parametrized test) that imports the
  module with the Supabase env unset. It must not exit, and an invocation must
  return 500 JSON with an audit failure.
- **Ownership and timing:**
  - These are NST ingestion routes. Do it after the 2026-10-20 FORGE run, one
    file per change.
  - `update-nst-gamelog.ts` is the largest; it needs its own review.
  - Keep request spacing (≥21 s) and budgets untouched.
