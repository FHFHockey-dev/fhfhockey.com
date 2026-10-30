# P4 Sous assignment

Owner: /root/p4. Model: GPT-6.1 Sol. Reasoning: medium; Chef actual xhigh. FAST is not allowed.

Read this whole ticket, STATUS-CHECK.md, the P4 register row, and applicable repository instructions before work. You own only this prompt. Do not write REGISTER.md or STATUS-CHECK.md. Do not create user-visible chats. Use no further delegation unless a concrete bounded need and free slot are confirmed with Chef. Preserve all preexisting/concurrent changes.

Before edits, confirm your actual runtime model/effort using your own turn_context metadata or runtime-provided assignment. Do not print unrelated transcript/configuration. If unverifiable or wrong, report to Chef and continue read-only preparation only. The parent confirmed configured service tier default; do not enable FAST.

Adjusted scope: Do not run git fsck --lost-found: it writes Git state. Non-writing fsck --no-reflogs --unreachable is permitted. Forward/reverse apply --check only; never apply a patch. Compare committed octoberBranch bytes at 8a6ac8adc separately from dirty working-tree bytes. Report FORGE/Start Chart proposals only for Claude/TJ. Shared inventory directory has P1/P3 owners: edit only your output and P4-prefixed report/ticket files. Use bounded metadata inspection for missing commits.

Verification: inspect selected tests before execution for network, credentials, Git mutation or production access; use fixtures/mocks only. Allowed app checks are npm test -- <file>, npx tsc --noEmit, npm run lint from web/. Request Chef to serialize global checks. No GIT_DIR/GIT_WORK_TREE. Preserve failed check output in your lane without secrets. One diagnosis pass and one changed approach per blocker; escalate with exact evidence, do not spin. Stop when your acceptance is satisfied or a genuine authority/input blocker remains.

Handoff: write P4-HANDOFF.md in your lane with exact created/changed files, hashes, commands/pass/fail/not-run, acceptance matrix, blockers/proposals and any running process ID. Tell Chef when edits are finished so review can begin. No broad cleanup.

## Prompt 4 — Side-branch salvage report (read-only)

Register rows 7, 30, 41, 62, 72, 81.

```text
/goal For six side-branch commits that the reconciled register flags as not fully integrated, report exactly what content is missing from octoberBranch and whether it still applies. Read-only; don't cherry-pick or apply anything.

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

Commits (register row → commit, branch if known):
- 7, 8 → 9592e2e6 (chef/forecast-m1-caller-integration). FORGE: report only; a decision on it belongs to the Claude session.
- 30 → 894fe7ea (chef/start-chart-consumer). Start Chart: report only, same as above.
- 41 → 8b6332 (forge cron-chain branches; adds physicalShiftIntervals*.ts)
- 62 → 2331cc1 (chef/social-share-tools; ~11% not present)
- 72, 81 → 76d507e (draft/WiGO; ~39% present)
- Also try to find 3d15e65e, 9984caf, c983535e, f3520f0, 0a6fed7: search `git log --all`, `git fsck --lost-found` (read-only), and every worktree listed by `git worktree list`. Report found / not found.

For each commit: the files it touched; for each file, whether it exists on octoberBranch and whether its added lines are present (`git show <sha> -- <file>` compared with the current file); `git apply --check --reverse` and `git apply --check` results (dry-run only, via `git show <sha> | git apply --check`); and a verdict: FULLY-PRESENT / PARTIAL (list the missing hunks) / ABSENT / CONFLICTS.

Deliverable: tasks/codex-sprint-2026-10-19/inventory/SIDE-BRANCH-SALVAGE.md.
Acceptance: each commit has a verdict backed by command output; the working tree is unchanged (`git status --porcelain` identical before and after).
```
