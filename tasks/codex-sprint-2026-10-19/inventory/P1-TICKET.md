# P1 Sous assignment

Owner: /root/p1. Model: GPT-6.1 Sol. Reasoning: medium; Chef actual xhigh. FAST is not allowed.

Read this whole ticket, STATUS-CHECK.md, the P1 register row, and applicable repository instructions before work. You own only this prompt. Do not write REGISTER.md or STATUS-CHECK.md. Do not create user-visible chats. Use no further delegation unless a concrete bounded need and free slot are confirmed with Chef. Preserve all preexisting/concurrent changes.

Before edits, confirm your actual runtime model/effort using your own turn_context metadata or runtime-provided assignment. Do not print unrelated transcript/configuration. If unverifiable or wrong, report to Chef and continue read-only preparation only. The parent confirmed configured service tier default; do not enable FAST.

Adjusted scope: Use read-only refs/stash reflog metadata via git log -g rather than any git stash invocation. git worktree list --porcelain is read-only and permitted. Never prune. Enumerate exact branches/worktrees/stashes and preserve unique work. Pin committed-tree evidence to 8a6ac8adc unless refs advance before your initial snapshot; do not repeatedly re-inventory. Shared inventory directory has P3/P4 owners: edit only your named output and P1-prefixed report/ticket files.

Verification: inspect selected tests before execution for network, credentials, Git mutation or production access; use fixtures/mocks only. Allowed app checks are npm test -- <file>, npx tsc --noEmit, npm run lint from web/. Request Chef to serialize global checks. No GIT_DIR/GIT_WORK_TREE. Preserve failed check output in your lane without secrets. One diagnosis pass and one changed approach per blocker; escalate with exact evidence, do not spin. Stop when your acceptance is satisfied or a genuine authority/input blocker remains.

Handoff: write P1-HANDOFF.md in your lane with exact created/changed files, hashes, commands/pass/fail/not-run, acceptance matrix, blockers/proposals and any running process ID. Tell Chef when edits are finished so review can begin. No broad cleanup.

## Prompt 1 — Branch, worktree, and stash preservation inventory (read-only)

Register row 94. No collision risk: it doesn't write to any branch.

```text
/goal Produce a complete, read-only preservation inventory of every local branch, worktree, and stash in /Users/tim/Code/fhfhockey.com, so TJ can later approve cleanup safely. Delete nothing.

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
1. List every local branch (`git branch --list`), every worktree (`git worktree list --porcelain`), and every stash (`git stash list`; read only, never pop or drop).
2. For each branch, record: tip SHA, last commit date, `git rev-list --count octoberBranch..<branch>` (commits not on octoberBranch), and whether those commits' content is already in octoberBranch (`git cherry -v octoberBranch <branch>`: lines starting with "-" are already present).
3. For each worktree: path, branch, whether the path still exists, and whether it has uncommitted changes (`git -C <path> status --porcelain | wc -l`). If the path is missing, mark it "prunable"; don't prune it.
4. Classify each item: SAFE-TO-DELETE-LATER (0 unique commits, no dirty files), HAS-UNIQUE-WORK (list the subjects), or UNKNOWN.

Deliverable: tasks/codex-sprint-2026-10-19/inventory/BRANCH-WORKTREE-INVENTORY.md with one table per category, plus a summary count at the top.
Acceptance: every branch, worktree, and stash appears exactly once; the counts match the git output; no git state changed (`git status` and `git stash list` are identical before and after).
Stop when the file is written. Don't propose deletion commands.
```
