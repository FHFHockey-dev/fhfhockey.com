# Claude → Codex: `update-nst-gamelog` hangs to a 504 after NST 521s (2026-10-21)

## What happened
TJ ran the manual backfill `GET /api/v1/db/update-nst-gamelog?runMode=incremental&dates=2026-10-07&overwrite=yes` from a browser.
- 17:46:16Z: 401 (not signed in).
- 17:46:33Z: the next attempt ended in a **504** (Vercel request log).
- Runtime log for that call (`vercel logs`, `requestPath:"/api/v1/db/update-nst-gamelog"`):
  - 17:46:34Z: plan of 20 URLs for 2026-10-07.
  - 17:46:35–36Z: URLs 1–10 each failed at once with `NST request failed with status 521` (Attempt 1/1), and each was added to the failed list.
  - The log stops at `INFO [10/20]` at 17:46:36Z. Nothing more until the platform killed the function.
- No `cron_job_audit` row was written, so no `nstProgress` continuation was recorded. A rerun starts from 0.

## Asks (your lane)
1. Find where the route waits after a run of 521s; likely a retry pass or pacing sleep that ignores `deadlineAt`. It should stop at its 220 s deadline and answer, either 207 with the resume request or a failure with an audit row, instead of running into the platform limit.
2. Consider treating 5xx-from-Cloudflare (520–527) as "source down": stop the pass early and record it, rather than spending the remaining URLs.

## Data state (read-only count, 2026-10-21 ~18:40Z)
- `nst_gamelog_{as,es,pp,5v5}_counts` by `date_scraped`:
  - 10-07, 10-08, 10-14..10-18: nothing in any of the four tables.
  - 10-09..10-13: `as` only.
  - 10-19 and 10-20: complete (pipeline NST step).
- Job 79 stays scheduled until 10-07..10-18 are backfilled.

## Prompt for Codex (copy-paste)

```text
Fix a hang in web/pages/api/v1/db/update-nst-gamelog.ts (repo /Users/tim/Code/fhfhockey.com, branch octoberBranch; follow AGENTS.md).

Evidence (2026-10-21):
- GET /api/v1/db/update-nst-gamelog?runMode=incremental&dates=2026-10-07&overwrite=yes returned a Vercel 504.
- Runtime log for that call:
  - 17:46:34Z: plan of 20 URLs for 2026-10-07.
  - 17:46:35–36Z: URLs 1–10 each failed at once with "NST request failed with status 521" (Attempt 1/1) and went to the failed list.
  - The log stops after "INFO [10/20]". The function ran into the platform limit.
- No cron_job_audit row was written, so no nstProgress continuation was saved. A rerun restarts from index 0.
- Details: tasks/artifacts/cross-platform/2026-10-21-claude-to-codex-nst-gamelog-521-hang.md.

Goal: whatever NST returns, the route answers before the platform limit and writes its audit row.
1. Find what blocks after a run of fast failures. Suspects: the failed-URL retry pass, a pacing or admission sleep, or an await without a deadline. Make every wait and every retry pass respect requestControl.deadlineAt (220 s default, maxRuntimeMs). At the deadline, stop and answer:
   - 207 with resume.request.query when the explicit scope can continue;
   - otherwise a failure with the audit row.
2. Treat Cloudflare origin errors (HTTP 520–527) as "source down": end the pass early, record the failed URLs and the status in the audit details, and keep explicit-scope progress (nextIndex) at the last acknowledged URL so the same URL resumes later.
3. Never send more NST requests than the shared admission allows. The limits are 40/1 min, 80/5 min, 100/15 min and 180/h, and every attempt counts, retries included.

Tests: extend the existing update-nst-gamelog tests with mocked NST responses. Cover:
- (a) ten consecutive 521s: the handler returns within the deadline, writes the audit row, and makes no further NST attempts after the source-down stop;
- (b) an explicit date-range scope that hits the deadline answers 207 with the resume query and stores nextIndex;
- (c) re-calling the same URL resumes from nextIndex.
Run that test file, then npx tsc --noEmit and eslint on the changed files (from web/, env -u GIT_DIR).

Constraints:
- No production calls, no deploys, no cron changes. TJ approves releases.
- Commit only your files with explicit pathspecs. Other sessions have uncommitted work in the tree.
- Write a reply note in tasks/artifacts/cross-platform/ saying what changed and how TJ should resume the 10-07..10-18 backfill.
```
