# P5 Sous assignment

Owner: /root/p5. Model: GPT-6.1 Sol. Reasoning: medium; Chef actual xhigh. FAST is not allowed.

Read this whole ticket, STATUS-CHECK.md, the P5 register row, and applicable repository instructions before work. You own only this prompt. Do not write REGISTER.md or STATUS-CHECK.md. Do not create user-visible chats. Use no further delegation unless a concrete bounded need and free slot are confirmed with Chef. Preserve all preexisting/concurrent changes.

Before edits, confirm your actual runtime model/effort using your own turn_context metadata or runtime-provided assignment. Do not print unrelated transcript/configuration. If unverifiable or wrong, report to Chef and continue read-only preparation only. The parent confirmed configured service tier default; do not enable FAST.

Adjusted scope: Use actual baseline counts (currently 185 open, 5117 checked), not historical 73. Read the named PDF acceptance lines; P2 will supply its extracted contract for coordination. Respect the existing non-actionable convention. Preserve every historical paragraph and real checkbox. Source edits only the two expressly allowed task documents; your notes/report only master-hygiene/. New initiative plus four phase children are the only new checklist rows. Do not alter real statuses due to our findings.

Verification: inspect selected tests before execution for network, credentials, Git mutation or production access; use fixtures/mocks only. Allowed app checks are npm test -- <file>, npx tsc --noEmit, npm run lint from web/. Request Chef to serialize global checks. No GIT_DIR/GIT_WORK_TREE. Preserve failed check output in your lane without secrets. One diagnosis pass and one changed approach per blocker; escalate with exact evidence, do not spin. Stop when your acceptance is satisfied or a genuine authority/input blocker remains.

Handoff: write P5-HANDOFF.md in your lane with exact created/changed files, hashes, commands/pass/fail/not-run, acceptance matrix, blockers/proposals and any running process ID. Tell Chef when edits are finished so review can begin. No broad cleanup.

## Prompt 5 — Master task list hygiene (docs only)

```text
/goal Fix false-open rows and stale navigation in tasks/TASKS/super-goal/tasks-prd-fhfh-comprehensive-completion-audit-optimization.md without changing any real task's status.

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
This lane may edit ONLY: tasks/TASKS/super-goal/tasks-prd-fhfh-comprehensive-completion-audit-optimization.md and tasks/TASKS/rules/generate-tasks.mdc. Make no other edits.

Steps:
1. The six rows `SRC::tasks/TASKS/rules/generate-tasks.mdc::C0001–C0006` are template placeholders ("Parent Task Title", "[Sub-task description 1.1]"), not tasks. Reclassify them as non-actionable template rows, using the file's existing exception/non-actionable convention (search the file for how other non-actionable rows are marked; copy that pattern exactly). Update the raw/actionable/mechanical counts in a NEW dated overlay paragraph at the top. Do not edit old paragraphs; they are append-only.
2. Add a short dated overlay paragraph (2026-10-19) that points to tasks/master-reconciliation-2026-10-17/REGISTER.md as the current reconciled register, and to the SKO/VuDu plan as a new initiative "SKO-VUDU" whose Phase 0 is being worked in tasks/codex-sprint-2026-10-19/sko-vudu/.
3. Add a "NEW" row under "## NEW Tasks" for SKO-VUDU with four children (Phase 0–3) copied from the plan's acceptance lines. Only Phase 0 is in progress; Phases 1–3 depend on the FORGE shared forecast release.
4. Count `- [ ]` and `- [x]` before and after; report both.

Acceptance: the only change in checkbox state is the six template rows plus the new SKO-VUDU rows; `git diff --stat` shows only the two allowed files; no historical paragraph changed (check with `git diff` that every removed line is a template row).
```
