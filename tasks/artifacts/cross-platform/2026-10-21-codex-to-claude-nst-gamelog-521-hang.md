# Codex → Claude / TJ: NST gamelog outage and deadline repair

Local candidate on `octoberBranch`; no production calls, deployments, pushes, or cron changes. TJ owns release approval. Files: `web/pages/api/v1/db/update-nst-gamelog.ts` and its existing API test file, plus this note.

What changed:
- Each route attempt now asks the NST client for zero internal retries. Previously its default two retries could turn one logged attempt into three network attempts, before the route's own retries. All dispatches still use the same shared admission control, including retries: 40/minute, 80/5 minutes, 100/15 minutes, 180/hour. The admission implementation and pacing policy are unchanged.
- The first HTTP 520–527 stops the pass and prevents the failed-URL retry pass. Response: HTTP 503, `success=false`, `operationStatus=source_down`. The failure audit records `details.sourceDown` (status and URL), failed URLs, and `nstProgress.continuation.nextIndex` at the acknowledged prefix. An outage in a retry pass also retains failures that pass did not revisit.
- NST awaits have a hard request-deadline race, covering admission, transport, response body, and completion acknowledgement. Database fetch/body waits also have a deadline race plus abort. The audit insert has its own bounded acknowledgement wait; the no-dates exit uses that same audit writer. Defaults remain 215 seconds for work plus five seconds reserved for audit, within the 220-second route budget and configured 240-second platform limit. `maxRuntimeMs`/`deadlineAt` shorten these bounds.
- An explicit scope that advances safely then stops on its deadline returns HTTP 207 with the exact `resume.request.query`, after the audit is acknowledged. A source-down failure keeps the same cursor replayable, including when the request already contained a cursor. Late NST responses cannot proceed to row writes after the route's cutoff.

Diagnosis boundary: current source confirms nested retries and an abort-only await boundary, but already checks admission sleeps against the deadline. The retained logs do not identify the exact stalled await or prove deployed bytes match this checkout; no production reproduction was attempted. If the database itself cannot acknowledge an audit before its deadline, the handler reports `auditPersistence=not_confirmed` and does not retry the insert or claim a saved cursor.

Verification (local, mocked NST/database, fake timers):
- `env -u GIT_DIR npm test -- __tests__/pages/api/v1/db/update-nst-gamelog.test.ts`: 100 passed. Covers ten queued 521s stopping after one dispatch, all 520–527 statuses, outage in a retry pass, stalled NST deadline with date-range 207/audit, original-URL resume, and nonzero cursor replay after outage.
- `env -u GIT_DIR npx tsc --noEmit`: default Node heap exhausted (~4 GiB). Retried with `NODE_OPTIONS=--max-old-space-size=8192`: passed.
- ESLint on both changed TypeScript files: passed.

After TJ approves and releases this candidate, resume the complete October 7–18 scope from an authenticated admin session:

```text
/api/v1/db/update-nst-gamelog?runMode=incremental&startDate=2026-10-07&endDate=2026-10-18&overwrite=yes
```

Run sequentially, without overlapping another NST job. Preserve this exact scope. On HTTP 207, construct the next query from `resume.request.query` and run it sequentially; do not advance dates or invent a cursor. Reopening the original URL also uses the latest saved `nextIndex`. This range has its own audit scope; a separate single-date invocation has a separate cursor. Shared admission may defer a request instead of consuming the remaining budget.

On HTTP 503/source-down, stop the backfill session and wait for source recovery; later replay the same URL/query. It retries the failed URL rather than skipping it. Do not spin automatic outage retries. On `auditPersistence=not_confirmed`, inspect the audit before retrying because writes may have committed. On other blocked/unresolved outcomes, inspect source outcomes instead of advancing manually. If using an absolute `deadlineAt`, refresh it for each invocation; the URL above uses a fresh relative budget automatically.

Finish only when `success=true` and `nextIndex===totalUrls`; those establish completion of acknowledged source attempts, not independent coverage acceptance. Then use the separately authorized completeness review before changing job 79. This candidate changes no schedule.
