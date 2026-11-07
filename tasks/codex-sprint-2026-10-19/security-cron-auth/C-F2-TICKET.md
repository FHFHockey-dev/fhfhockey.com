# C-F2 — resumed sprint

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


User expansion: Implement local fixes from reports, finish remaining gaps in prompts 1–8, and other unblocked master-list tasks while avoiding Claude. No time cap; all hard fences and hosted-call ban persist.

Implement P8 F2 on exact clean unfenced noncolliding callers: rejected auth must not cause cron audit inserts; admitted operations retain auditing. Start by enumerate A! rows from security/API-ROUTE-INVENTORY.md and compare current diff. Before edits write exact owned route list to this lane/OWNERSHIP.md and message Chef the list. Own clean caller auth-order changes and web/__tests__/pages/api/v1/db/cron-audit-wrappers.test.ts; do NOT change shared withCronJobAudit.ts, adminOnlyMiddleware.ts or operational auth helper. Do not touch literal fences OR these active adjacent owners: web/pages/api/v1/db/cron/update-roster-optimizer-schedule-daily.ts, build-projection-derived-v2.ts, ingest-projection-inputs.ts, sweep-gamecenter-normalization.ts, auto-news-feed-items.ts, update-line-sources.ts, update-lines-ccc.ts, any Yahoo route/writer, and any dirty file not this sprint-owned update-nst-team-daily.ts. Treat projection/FORGE-impacted paths conservatively; exclude rather than edit into active Claude work. Preserve auth semantics, method behavior, trace/status/response, admitted audit. Focus on adminOnly wrapper ordering; bespoke internal-secret callers excluded if their semantics need broader change. Use source completeness checks plus mocked representative unauthorized/no-audit and authorized/audit tests. Inventory every excluded A! row with reason; no claim of globally resolved F2. Acceptance: all declared scoped exports put auth outermost, local tests demonstrate no audit on rejection and retained audit on admission, excluded consumers exact. Model Sol high.

Read AGENTS.md, SPRINT-MODE.md and mise-en-place.md. Chef owns REGISTER.md and global tsc/lint. Do not edit the register, spawn subworkers, read .env/secrets, or make network calls. Before implementation confirm actual gpt-6.1-sol/high from your own CODEX_THREAD_ID matching turn_context; root is xhigh. Focused tests only using synthetic/mocked inputs. One diagnosis pass and one revised attempt for an unexpected blocker, then report exact dependency. Report exact changed files, checks with exit/pass/fail, source limits and ownership release in this lane/HANDOFF.md. No other notes/reports outside lane. Return when bounded acceptance met; do not expand scope.
