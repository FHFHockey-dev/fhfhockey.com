# P3 Sous assignment

Owner: /root/p3. Model: GPT-6.1 Sol. Reasoning: medium; Chef actual xhigh. FAST is not allowed.

Read this whole ticket, STATUS-CHECK.md, the P3 register row, and applicable repository instructions before work. You own only this prompt. Do not write REGISTER.md or STATUS-CHECK.md. Do not create user-visible chats. Use no further delegation unless a concrete bounded need and free slot are confirmed with Chef. Preserve all preexisting/concurrent changes.

Before edits, confirm your actual runtime model/effort using your own turn_context metadata or runtime-provided assignment. Do not print unrelated transcript/configuration. If unverifiable or wrong, report to Chef and continue read-only preparation only. The parent confirmed configured service tier default; do not enable FAST.

Adjusted scope: The Oct17 path-count assertion is obsolete. Pin immutable comparison refs origin/master=707f60e8331e22c9d851a5592aa06528e359b7fe and octoberBranch=8a6ac8adccee73fae8e07045c86b374ce8c98008; label the report with those SHAs. Exclude uncommitted files. Shared inventory directory has P1/P4 owners: edit only your named output and P3-prefixed report/ticket files. Do not fetch.

Verification: inspect selected tests before execution for network, credentials, Git mutation or production access; use fixtures/mocks only. Allowed app checks are npm test -- <file>, npx tsc --noEmit, npm run lint from web/. Request Chef to serialize global checks. No GIT_DIR/GIT_WORK_TREE. Preserve failed check output in your lane without secrets. One diagnosis pass and one changed approach per blocker; escalate with exact evidence, do not spin. Stop when your acceptance is satisfied or a genuine authority/input blocker remains.

Handoff: write P3-HANDOFF.md in your lane with exact created/changed files, hashes, commands/pass/fail/not-run, acceptance matrix, blockers/proposals and any running process ID. Tell Chef when edits are finished so review can begin. No broad cleanup.

## Prompt 3 — Unreleased-path ledger (read-only)

Register row 95.

```text
/goal Write a path-level ledger of every non-tasks/ path that differs between origin/master and octoberBranch, so TJ can choose the next release scope. Read-only.

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

Steps:
1. `git diff --name-status origin/master...octoberBranch -- . ':!tasks'` (three dots). Do NOT include the uncommitted working tree; that belongs to the other agent.
2. For each path record: status (A/M/D/R), top-level area (web/pages, web/lib/<subdir>, web/components/<subdir>, supabase, cms, functions, webhooks, other), the commit(s) that last touched it on octoberBranch (`git log --format='%h %ad %s' --date=short origin/master..octoberBranch -- <path> | head -3`), and whether a test file for it exists.
3. Group by feature area (FORGE, RSO, Start Chart, Game Grid, Sustainability/SKO, Cron/NST, Yahoo, Draft, Social, Auth, UX/other). For each group, give a one-line risk note: does it include migrations, cron routes, or writer endpoints?

Deliverable: tasks/codex-sprint-2026-10-19/inventory/UNRELEASED-PATH-LEDGER.md (summary table first, then the full per-path table).
Acceptance: the path count equals `git diff --name-only origin/master...octoberBranch -- . ':!tasks' | wc -l`; every path appears exactly once.
Don't recommend a release; don't run any build.
```
