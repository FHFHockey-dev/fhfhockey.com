# Security audit handoff to the coordinating Chef

> Follow-up checkpoint (2026-10-15 05:56:27 UTC): the one explicitly approved npm retry succeeded: 57 affected package entries (3 critical / 32 high / 14 moderate / 8 low). Dependency applicability triage and the database-hardening proposal remain incomplete. Stop requested by TJ. See [context diary and resume handoff](context-diary-and-resume.md) and `dependency-audit-approved.json`. Original source findings/tests predate the separate proxy/Host workers' fixes; those fixes have not been re-reviewed here.

**Disposition:** ready for review of the bounded static audit. Findings are not remediated. Deployment-state checks remain unresolved. Current dependency matching succeeded on the approved retry; applicability triage is incomplete. This handoff is prepared before the revised 06:56 UTC sprint checkpoint; it does not claim that time has arrived or that production has been verified.

Checkout: `/Users/tim/Code/fhfhockey.com`, branch `octoberBranch`, HEAD `a8f58de6178e282acd3a71851c66f4a56b119f14`. The repository was and remains dirty with concurrent work. Only `tasks/artifacts/security-audit-sprint-2026-10-15-0512/` was edited by this audit. No shared task register, application file, configuration, branch or worktree was changed. No commits, pushes, deployments, production application requests, database writes, package installs or fixes occurred. No secret values or raw FORGE/held-experiment artifacts were read or included.

## Review first

1. Read `findings.md` for ten findings, evidence paths/lines, safe reproduction designs, impact boundaries and proposed fixes. The P0 item is an **unknown deployment state** for existing security migrations, not a new confirmed production exploit.
2. Read `coverage.md` before treating any unreported area as safe. The 360-file inventory is pattern triage; detailed manual review was concentrated on trust boundaries. See `report-verification.json` and `referenced-source-hashes.csv` for the final source snapshot and drift check.
3. `safe-local-checks.json` has nine passing isolated TypeScript checks; `safe-python-checks.json` has two passing Python handler checks. Pass means the stated behavior was reproduced or the stated negative control held. All service calls were mocked.

## Proposed work packages — not assigned and not entered in the shared register

| Order | Bounded task | Exact starting files / owner boundary | Acceptance evidence |
|---|---|---|---|
| 1 | Verify whether existing critical SQL and entitlement protections are deployed | Existing migrations `supabase/migrations/20260820013120_revoke_execute_sql_browser_roles.sql`, `supabase/migrations/20260820013124_revoke_truncate_rolling_metrics_browser_roles.sql`, `supabase/migrations/20260909120000_draft_pro_complimentary_access_codes.sql`; database/release owner | Authorized catalog reads show no anon/authenticated/PUBLIC execution for the two privileged RPCs and the intended restrictive entitlement policy. Reconcile applied migration hashes. Prepared `deployed-metadata-checks.sql` is read-only and was not executed. Any missing protection needs its own approved release; never test by invoking the dangerous functions. |
| 2 | Remove or constrain arbitrary server egress (SEC-01) | `web/pages/api/cors/index.ts`, consumer `web/lib/cors-fetch.ts`; API owner | Mock tests reject private/loopback/link-local destinations, unsupported protocols/methods and unapproved redirects before transport; legitimate approved provider calls still work; byte/time budgets enforced. |
| 3 | Make CSV-created tables secure atomically (SEC-06) | `web/pages/api/v1/db/upsert-csv.ts`; database owner for any existing-table audit/migration | No DDL before full input validation; new tables enable RLS and least-privilege grants before data is inserted. Disposable database role tests reject anonymous mutation. Preserve intended public reads deliberately. |
| 4 | Remove Host-only admin bypass (SEC-02) | `web/utils/adminOnlyMiddleware.ts` and nearest middleware test; shared-auth owner | An unauthenticated non-loopback peer with Host localhost is denied in development; normal production/admin/cron paths retain expected behavior. Any local bypass is explicit and bound to verified local access. |
| 5 | Bind Patreon linking to the initiating browser (SEC-03) | `web/lib/integrations/patreon/oauth.ts`, `web/pages/api/v1/account/patreon/connect.ts`, `web/pages/api/v1/account/patreon/callback.ts`; provider integration owner | Short-lived, single-use state transaction plus browser binding. Cross-browser, absent-cookie, mismatched-cookie and replay tests fail before token exchange/linking. Use Yahoo's existing transaction contract as a reference. |
| 6 | Correct cron audit order and privacy (SEC-04, SEC-09) | `web/lib/cron/withCronJobAudit.ts`, `web/lib/cron/withOperationalRouteAuth.ts`, exact 94 routes in `cron-audit-order.csv`; auth/cron and database owners | Denied requests cause no service audit write. Detailed audit reads are not public; any intended public health view is allowlisted. Query/response redaction tested with synthetic markers. Coordinate with active ingestion workers before changing their route wrappers. |
| 7 | Protect operational fan-out (SEC-05, SEC-10) | `web/pages/api/v1/db/audit-nhl-ppt-replay-coverage.ts`, `functions/api/index.py`, `functions/api/fetch_team_table.py`, `web/pages/api/fetch_team_table.ts`; web/functions ingestion owners | Anonymous requests never reach upstream mocks. Authenticated jobs have validated bounds/shared budgets; NST spacing remains at least 21 seconds across jobs. Do not use live provider calls as regression tests. |
| 8 | Restrict provider identity authoring (SEC-07) | Connected-account browser grants/policies in supported migrations and provider server flows; identity/database owner | Synthetic user A cannot reserve or modify a provider identity without server verification. User B's legitimate linking flow is not blocked by A's arbitrary claim. Preserve permitted owner display/settings edits. |
| 9 | Bound public CMS comment writes (SEC-08) | `web/pages/api/createComment.ts`, `cms/schemas/comment.js`; CMS/API owner | POST-only strict bounded schema, published-post validation and anti-abuse contract; mocked invalid-method/type/size/rate cases do not call Sanity. Sanitized errors. Anonymous-comment product intent remains explicit. |
| Pending | Finish dependency applicability triage | Saved `dependency-audit-approved.json`; do not repeat the upload | Summarize verified advisory matches and dev/runtime applicability; no installs or package changes. See checkpoint diary. |

## Checks and operation state

Completed locally, with exit code 0:

```sh
python3 tasks/artifacts/security-audit-sprint-2026-10-15-0512/inventory.py
python3 tasks/artifacts/security-audit-sprint-2026-10-15-0512/supplemental-inventory.py
python3 tasks/artifacts/security-audit-sprint-2026-10-15-0512/sql-security-inventory.py
node tasks/artifacts/security-audit-sprint-2026-10-15-0512/safe-local-checks.cjs
python3 tasks/artifacts/security-audit-sprint-2026-10-15-0512/safe-python-checks.py
python3 tasks/artifacts/security-audit-sprint-2026-10-15-0512/verify-report.py
```

Failed/blocked: isolated npm advisory query (sandbox DNS failure, then automatic approval rejection of disclosure escalation). Retained `dependency-audit.json` and `dependency-audit-stderr.txt` are failure evidence, not vulnerability results. The temporary copied lockfile/npm cache were removed from this report directory after retaining the failure and source digest.

Not run: application suites/type check/build/Playwright, live exploits, provider calls, deployed metadata SQL, production scans. No audit-started server, process, polling loop or external operation remains running. There is no unfinished mutation requiring rollback. Ownership of the report directory can be transferred to the Chef after review; application ownership was never acquired.

Next safe command for the receiver is the `verify-report.py` invocation above if source integration changes after handoff. Re-run behavioral reproductions only when relevant source changed or when evaluating a fix. Preserve the original evidence when comparing a remediation.

Historical: automatic approval review rejected the first metadata-upload escalation. TJ subsequently explicitly authorized one retry to the same recipient, which succeeded. No further retry or alternate recipient is needed. Preserve both the original failure and successful result.
