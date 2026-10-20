# R-VERCEL-GATE — bounded local implementation

Chef reserves exactly these two source/test paths to /root/c_f2:
- web/lib/cron/cronAuditCoverage.ts
- web/__tests__/pages/api/v1/db/cron-audit-wrappers.test.ts

Read and implement the accepted proposal in R-OPEN-LOCAL-PARTS.md. Preserve all accepted F2/Python wrapper-test edits. No other source, master, register, route or config writes. Reports only in this continuation-review lane.

Acceptance:
- Cover every actual Vercel cron entry as well as preserving existing pg_cron 46-route/50-job coverage.
- Keep configured entry identity/path/query/schedule distinct from its normalized route; all current27entries/18routes resolve. Inputs must be bounded local values, with malformed/unsupported input explicit rather than silently dropped.
- Recognize only concrete supported reviewed auth forms; merely mentioning/importing a secret/helper is not protection. Four bespoke internal forms require source-bound fixtures; avoid a generic security analyzer. Unsupported source stays unqualified.
- Audit wrapper/manual/helper-owned/unqualified results must be honest. Explicit unresolved audit owners must not become silent exemptions or fabricated green coverage. Read excluded owners only; no runtime edits or imports/execution.
- Static inspection is source evidence, never deployed/runtime proof.
- Extend the existing focused file with meaningful positive/negative fixtures; do not create another test file.
- Run only npm test -- __tests__/pages/api/v1/db/cron-audit-wrappers.test.ts from web/. Chef owns subsequent needed global checks.
- One bounded implementation, diagnose any failure and change approach before retry. No subworkers, extra tasks or clock limit.
- Report exact files/hash, checks pass/fail, qualified/unqualified route list, acceptance limitations. C0044 remains open for hosted inventory/schedule/audit-owner gates.
- Prior runtime Sol/high was verified; confirm the current runtime metadata still matches before edits. Chef remains Sol/xhigh, higher than worker.

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

