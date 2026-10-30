# R-SCORE — successful complete-population rebuild acceptance

Parent: remaining sustainability source C0095/C0096 acceptance and NEW18 scheduling gap. Implement the locally testable successful full-population receipt; do not close scheduler/production rows.

Owner /root/c_f1, Sol medium; Chef xhigh reviewer. Exact ownership ONLY existing web/__tests__/pages/api/v1/sustainability/rebuild-score.test.ts and this lane's R-SCORE-HANDOFF.md. Source route/helper/schema/config read only. Inspect scoped diff before edits; preserve current auth-wrapper changes. No subworkers.

Acceptance: execute real route control flow on an explicit synthetic >750-player runAll fixture, with all database/config/persistence dependencies injected mocks; assert exact player×four-window identity set, all expected batches, tail/no duplicates/loss, distribution/quintile receipt and intended persistence boundary. Add a dry-run case that proves no writes and (if useful) one non-runAll offset/tail control without global finalization. Prefer actual pure distribution implementation with known-score fixture over mocking away the asserted behavior. Mock auth/audit/network completely; test is not provider, DB, scheduling, empirical or production proof. Inspect actual persistence dry-run contract before asserting whether helpers are invoked in no-write mode. If a runtime bug is exposed, report exact minimal change and STOP source edits until Chef assigns it. Keep test additions focused and meaningful. Run only owning focused file; no artifact write outside lane. Report exact writes/hashes, all outcomes, exclusions and next actionable piece; completing this handoff does not end sprint.

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

