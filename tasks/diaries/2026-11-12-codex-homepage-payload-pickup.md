# Homepage payload and pickup diagnostics

- Scope: TJ-approved local fixes for 225 kB homepage SSR data and recurring Yahoo pickup 503. No live provider/auth, DB, deployment or production requests.
- Checkout: octoberBranch, sole canonical checkout. Named application files clean at start. Fix-sprint leases released per 2026-11-12T14:44:58Z handback; retained sprint docs/DB operations untouched.
- Findings: regular-season SSR includes unused full playoffWeekGames. Pickup route collapses most provider/DB errors to generic 503 without a safe diagnostic code. Exact observed underlying failure not yet known.
- Plan: remove unused regular-season week payload with mocked SSR tests; add allowlisted safe pickup diagnostics and accurate status handling, never raw provider error details. Keep all retained evidence/display semantics.
- Pending: focused tests/typecheck/lint, final diff and handoff. No claim of live recovery.

## Local checkpoint
- Omitted playoffWeekGames unless the bracket actually renders; daily games, news/source evidence and analytics unchanged. Mocked regression includes an >180 kB unused week and verifies regular-season props below 128 kB, with playoff retention/failure cases.
- Pickup response now uses static allowlisted status/message/code and logs only code/status. It distinguishes DB settings/team/league, roster validation, game context, token coordination, provider/rate-limit/access errors. Unrecognized failures remain safe generic 503. No fabricated empty roster on failure.
- 44 focused tests passed across five files; scoped ESLint and git diff --check passed.
- Default TypeScript check hit Node's 4 GB heap limit; a single retry with an 8 GB heap is running. No application test failure inferred from OOM.
- Existing homepage browser tab was ERR_CONNECTION_REFUSED, so no retained __NEXT_DATA__ was available. No reload/navigation performed. Actual new homepage byte count and live Yahoo success remain unverified; next normal failing request will include a safe [yahoo-pickup] code in the terminal.
- Final TypeScript check PASSED with `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit --incremental --tsBuildInfoFile /tmp/fhfh-homepage-pickup.tsbuildinfo`. First attempt's resource failure resolved; no type errors.
- Six application/test files changed or added, plus this diary. Local, uncommitted; no Git index/ref mutation. Outcome delivered to Scout for user handoff. Remaining gate is actual payload/normal pickup request readback; diagnostic change is not Yahoo recovery.
