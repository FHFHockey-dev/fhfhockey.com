# C-POPOVER

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


User expanded this sprint to local report fixes and unblocked master-list tasks, preserving fences and no hosted calls. Implement master source tasks/TASKS/three-pillars-analytics/underlying-stats/tasks-underlying-stats-power-rankings-roadmap.md NEW8.0 / master C0032: MetricPopover has no interaction coverage. Own ONLY web/__tests__/pages/underlying-stats/index.test.tsx plus this lane's C-POPOVER-HANDOFF.md. Read actual component at web/pages/underlying-stats/index.tsx:292 and existing test fixtures; do not change product code/default views or task lists. Extend the existing test with actual rendered metric disclosure interaction: starts collapsed, summary accessible/focusable, open by click displays correct metric explanation, closes again, independent metric disclosures do not share state. Use existing test dependencies, no invented keyboard event behavior that the test environment cannot exercise. If component already has adequate coverage, report existing evidence instead. Acceptance focused test proves visible real metric content and independent disclosure behavior; full owning file passes. No live/browser/server/provider calls. Verify actual Sol/medium from own CODEX_THREAD_ID, root is xhigh. No subworkers/global checks. Report exact files, results and native-browser/keyboard limits; do not claim browser execution. One diagnosis and one changed retry max.
