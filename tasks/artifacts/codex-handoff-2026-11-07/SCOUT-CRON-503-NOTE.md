# For Scout (Codex): cron routes return 503 when the audit insert is unconfirmed

TJ wants PR #379 (octoberBranch → master) merged once the full gate is green. On octoberBranch `85d8bcb4e`
(master `46f971753` already merged in), 19 tests in 5 files fail because wrapped routes now return 503 when the
`cron_job_audit` insert cannot be confirmed:

- `web/__tests__/pages/api/v1/db/update-line-combinations.test.ts` (8): expected 200/400/500, received 503
- `web/__tests__/pages/api/v1/db/update-rolling-games.test.ts` (2): expected 410/405, received 503
- `web/__tests__/pages/api/v1/sustainability/rebuild-priors.test.ts` (2), `rebuild-trend-bands.test.ts` (1), `rebuild-window-z.test.ts` (1): expected 200/424, received 503
- Log line in each: `cron_job_audit insert failed TypeError: fetch failed` (the tests have no audit mock).

These fail identically on octoberBranch before the master merge (`e8ee0fb0e`), so they came in with the
octoberBranch `withCronJobAudit` hardening (`finalAuditStatus` "unverified", acknowledgement timeout), not with
the merge. Master's released `withCronJobAudit` (from `b4033ad65`) does not 503 on an audit failure.

Question for Scout: is "503 when the audit can't be confirmed" intended for every wrapped route, or only when
`includeFinalAuditReceipt` is set? In production, a slow or failing audit insert during DB stress would turn
every wrapped cron run into a 503. Please either (a) limit the 503 to routes that opted into the final receipt
and keep others' responses unchanged, or (b) confirm it's intended and update the five test files' audit mocks.
Either way, report the commit SHA to TJ; Claude's Chef will re-gate and merge #379 after it lands.

No push, deploy or production action is needed for this; local commit on octoberBranch with explicit pathspecs.
