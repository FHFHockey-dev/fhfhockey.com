# C-OPERATOR — public operator provider routes

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


User explicitly authorized local security report fixes and other unblocked master-list tasks. Own ONLY web/pages/api/fetch_team_table.ts, existing web/__tests__/pages/api/fetch_team_table.test.ts, web/pages/api/v1/db/audit-nhl-ppt-replay-coverage.ts, existing web/__tests__/pages/api/v1/db/cron-auth-boundaries.test.ts, plus this lane. Inspect current diffs first. No helper/schema edits. NHL ppt helper imports fenced projection helper; mock boundary in tests, never edit it.

Implement two small admission fixes: master NST API NEW9/C0047 explicitly accepts adminOnly wrapping of fetch_team_table plus denial test; do that while preserving admitted parser behavior/GET method semantics, no route removal or rate-policy redesign. P8 S2 operator replay-coverage diagnostic is public and allows up to250NHL requests; use existing adminOnly outer guard before database selection/provider loops. Preserve admitted diagnostic schema, GET method behavior and limits. Do not add operational auditing or alter shared helper. No live/provider request.

Extend existing test files with real guard using mocked auth/role/provider/client dependencies as suitable: missing/invalid/non-admin denied before any provider/database operation, allowed cron/admin retains bounded valid behavior and admitted405; no token secrecy in outputs. Existing fetch_team_table test may need authenticated fixture. Prefer existing tests and no new test file. Verify no browser/runtime consumer relies on anonymous operator routes (bounded route-string search only). Acceptance focused tests actual guarded exports deny before network/privileged read, authorized read still behaves; documented error limits remain honest. Return HANDOFF.md exact file list/checks/hashes and no production claim.

Runtime same Sol/high/rootxhigh confirmed; no subworkers/global checks/network/Git mutations. One diagnosis and one changed retry; narrow if blocked. All previous74route ownership released; do not revisit them unless Chef requests correction.
