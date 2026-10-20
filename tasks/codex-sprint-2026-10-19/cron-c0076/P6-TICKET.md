# P6 Sous assignment

Owner: /root/p6. Model: GPT-6.1 Sol. Reasoning: high; Chef actual xhigh. FAST is not allowed.

Read this whole ticket, STATUS-CHECK.md, the P6 register row, and applicable repository instructions before work. You own only this prompt. Do not write REGISTER.md or STATUS-CHECK.md. Do not create user-visible chats. Use no further delegation unless a concrete bounded need and free slot are confirmed with Chef. Preserve all preexisting/concurrent changes.

Before edits, confirm your actual runtime model/effort using your own turn_context metadata or runtime-provided assignment. Do not print unrelated transcript/configuration. If unverifiable or wrong, report to Chef and continue read-only preparation only. The parent confirmed configured service tier default; do not enable FAST.

Adjusted scope: Existing task receipts already document NstConfigError fail-fast and the standings incremental/14-day cap. Verify current source first and avoid duplicating those fixes. Reproduce a remaining cause before changing source; otherwise deliver exact not-reproducible/production-read proposal. Before editing, report to Chef the exact route/helper/test paths you will own. withCronJobAudit edits, if necessary, must be additive/backward-compatible because fenced callers depend on it. Inspect tests for live/network/Git side effects. Run focused mocked tests; Chef owns shared tsc/lint. C0076 stays open.

Verification: inspect selected tests before execution for network, credentials, Git mutation or production access; use fixtures/mocks only. Allowed app checks are npm test -- <file>, npx tsc --noEmit, npm run lint from web/. Request Chef to serialize global checks. No GIT_DIR/GIT_WORK_TREE. Preserve failed check output in your lane without secrets. One diagnosis pass and one changed approach per blocker; escalate with exact evidence, do not spin. Stop when your acceptance is satisfied or a genuine authority/input blocker remains.

Handoff: write P6-HANDOFF.md in your lane with exact created/changed files, hashes, commands/pass/fail/not-run, acceptance matrix, blockers/proposals and any running process ID. Tell Chef when edits are finished so review can begin. No broad cleanup.

## Prompt 6 — Cron route-audit gap C0076 (local diagnosis + local fix)

```text
/goal Explain locally why four cron routes can run on schedule without writing cron_job_audit rows (master C0076: update-standings-details, update-nst-goalies, update-nst-team-daily, update-nst-team-daily-incremental), and fix it locally if the cause is in route code. No production access.

HARD RULES (read before anything else):
- Repo: /Users/tim/Code/fhfhockey.com, branch octoberBranch. Another agent (Claude) is editing in this same checkout right now.
- DO NOT run: git commit, git stash, git checkout, git switch, git reset, git restore, git clean, git rebase, git merge, git pull, git push, git worktree add/remove, git branch -d/-D. Read-only git only (status, log, diff, show, branch --list, merge-base, cherry -v).
- DO NOT edit, format, or move any file under these paths. Reading them is fine:
    web/lib/projections/**
    web/lib/rosterScheduleOptimizer/**
    web/lib/rosterScheduleData/**
    web/lib/in-season/**
    web/components/RosterScheduleOptimizer/**
    web/pages/start-chart.tsx, web/pages/api/v1/start-chart.ts
    web/pages/game-grid/**, web/pages/api/v1/forge/**, web/pages/api/v1/roster-schedule-optimizer/**
    web/pages/api/v1/db/run-projection*.ts, web/pages/api/v1/db/run-*forge*.ts
    web/__tests__/components/RosterScheduleOptimizer/**, web/__tests__/pages/api/v1/db/run-*
    supabase/migrations/**, migrations/**, sql/**
    web/package.json, web/package-lock.json, tsconfig*, vitest/playwright configs, .github/**, vercel.json
    tasks/sprint-2026-10-18/**, tasks/master-reconciliation-2026-10-17/**, tasks/artifacts/forge-team-context-fix-2026-10-19/**
- If the task seems to need a fenced file: STOP and write the needed change as a proposal in your report.
- No production or hosted calls of any kind: no Supabase MCP/CLI against the hosted project, no Vercel deploys, builds, or API calls, no route invocations against fhfhockey.com, no provider/Yahoo/NST/IFTTT requests. Local files, local tests, and fixtures only.
- No npm install, no lockfile changes, no `npm run build`. Allowed checks: `npm test -- <file>`, `npx tsc --noEmit`, `npm run lint` (run from web/).
- Never set GIT_DIR or GIT_WORK_TREE while running tests.
- Leave your changes uncommitted. End with an exact list of every file you created or changed, the checks you ran with pass/fail, and anything you could not verify.
- Write your notes and reports only under tasks/codex-sprint-2026-10-19/<your-lane>/.
Allowed edits: the route files behind those four jobs (web/pages/api/v1/db/update-standings-details/**, update-nst-goalies.ts, update-nst-team-daily.ts; "incremental" has no file of its own, so find out which route and parameters job 328 calls), the shared audit wrapper web/lib/cron/withCronJobAudit.ts, and their tests. If the wrapper is imported by any fenced path (`rg withCronJobAudit web/pages/api/v1/db/run-*`), you may still read it, but limit wrapper edits to additive, backward-compatible changes and say so in your report.

Steps:
1. Read the four routes and withCronJobAudit/adminOnly. Find every early return, redirect, timeout, or streaming/res.end path that could exit before the audit row is written (e.g. a response sent before `await`, maxDuration exceeded, an exception thrown before the wrapper, a 307 at the edge, a method mismatch).
2. Check the scheduler side read-only: find these jobs' cron definitions in the repo (rg the job names / numbers 43, 99, 275, 328 in web/, supabase/, sql/, tasks/) and compare the URL/method they call with what the route accepts.
3. Write a failing Vitest test that reproduces the gap for the most likely cause, then make it pass with the smallest change. Extend the nearest existing wrapper/route test; don't create a duplicate file if one exists.
4. Run the focused tests, `npx tsc --noEmit`, and `npm run lint`.

Deliverable: tasks/codex-sprint-2026-10-19/cron-c0076/DIAGNOSIS.md (causes ranked, with file:line evidence; what is confirmed vs suspected) plus the code/test diff.
Acceptance: either a reproduced and fixed cause with a passing regression test, or a documented "not reproducible locally" with the exact production read needed (for TJ to approve). Do not mark C0076 closed; it still needs a natural deployed receipt.
NST rule: never add code that makes NST requests closer than 21 seconds apart.
```
