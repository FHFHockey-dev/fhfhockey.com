# R-CRON-FLOOR — concrete owner decision preparation

Task parent: cron schedule source NEW8.0 / imported C0045. This task explicitly permits recording an owner-approved exception instead of rescheduling. Current StatusCheck C10/C11 are separate throughput/report decisions; do not merge them.

Owner /root/c_f1, existing Sol/medium (reconfirm runtime); Chef Sol/xhigh. Report-only. Scope: create continuation-review/R-CRON-FLOOR-PROPOSAL.md. Read only named source task/PRD, cron-schedule.md, web/vercel.json, existing local cronInventory helpers and directly relevant retained finding/receipt if necessary. No source/test/task-list/register/config writes; no commands executing routes or application modules.

Question: Can a precise bounded owner choice now resolve NEW8's schedule-floor policy, without pretending the frozen local inventory equals current hosted scheduling?

Prepare:
- Exact current local before-floor configured jobs/entries and recurrent jobs that cross the floor, with stable identity/path/schedule. Keep pg_cron and Vercel identities distinct and use existing parser semantics/source; do not invent another broad scheduling framework.
- Resolve wording evidence for fixed EST versus daylight-adjusting Eastern honestly; if ambiguous, explicitly identify it instead of deciding for TJ.
- Distinguish dated retained hosted receipt from local config. No live check. Identify whether owner exception alone can close policy clause but not current scheduler evidence; do not claim full inventory/new deployed acceptance.
- Smallest concrete owner options (retain enumerated exceptions vs request future bounded reschedule proposal), with exact list reviewed by Chef before asking. No recommendation to blanket-disable essential freshness jobs, reduce NST21s spacing, or change config now.
- Reuse settled R-OPEN and C-RECONCILE evidence. Stop if new investigation would require provider/hosted/secrets/fenced changes. No tests, no subworkers or extra tasks.
- Report exact path/hash and limitations. Do not ask user yourself.

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

