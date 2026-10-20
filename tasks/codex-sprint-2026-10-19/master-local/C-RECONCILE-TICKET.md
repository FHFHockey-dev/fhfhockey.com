# C-RECONCILE — remaining master queue

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


User explicitly expanded sprint to local report fixes, prompt gaps, and other unblocked master tasks while avoiding Claude. Your task is read-only reconciliation of remaining canonical master open tasks to identify actual actionable local gaps, without duplicating done work or inventing new work.

Own ONLY this lane/C-RECONCILE.md (and a compact JSON evidence table if useful). Do not edit source or any task list/register. Canonical master tasks/TASKS/super-goal/tasks-prd-fhfh-comprehensive-completion-audit-optimization.md has 183 open rows,120 imported SRC rows across34source lists. Cover every open imported SRC identifier once; group parent/overlay open rows by their child dependency rather than re-auditing whole repo. Give current status ready-local / locally-done-needs-receipt / blocked-fence-or-collision / blocked-owner-provider-production / parked, exact dependency, bounded source/report evidence. Do not call static assertions tests exercised. Read nearby sources only to decide real unblocked gaps; use current Oct18/19 receipts and actual code rather than stale Oct17 narrative. Many pagination, registry, redaction fixes already implemented.

Current active tickets already cover P8 F1/F2/F5, missing-PDO final flag, MetricPopover interaction (your just-finished test), and Cron report C0067. Chef currently reserves Auth NEW56 C0213 client imports. Skip investigating these implementations beyond noting active ownership. Claude owns all original fence plus active IFTTT/news/projection/RSO/Yahoo paths; DRM/Yahoo queued behind genuine RSO acceptance stay blocked. FORGE dashboards/Start/GameGrid/forecast comparison ownership must remain Claude even if literal glob doesn't fence each component. Source SQL/grant/scheduler migration work fenced. No new production/current count claims.

Output concise table covering120SRC rows (grouped IDs allowed if shared evidence), title/line links to reusable current receipts and exact candidate unblocked tasks for Chef. Pay attention to xG leakage/promotion C0172, NST public proxy/rate-policy rows, rankings pagination/reader cost, underlying landing supersessions/unique paging, quarantine completeness, cleanup generated artifacts constraints. Do not run app suites for read-only triage; do not generate huge source inventories. Sol medium actual runtime already confirmed, root xhigh. No subworkers. One focused evidence pass, no historical full scans. Report promptly when enough evidence supports disposition.
