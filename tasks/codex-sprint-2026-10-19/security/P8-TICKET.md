# P8 Sous assignment

Owner: /root/p8. Model: GPT-6.1 Sol. Reasoning: high; Chef actual xhigh. FAST is not allowed.

Read this whole ticket, STATUS-CHECK.md, the P8 register row, and applicable repository instructions before work. You own only this prompt. Do not write REGISTER.md or STATUS-CHECK.md. Do not create user-visible chats. Use no further delegation unless a concrete bounded need and free slot are confirmed with Chef. Preserve all preexisting/concurrent changes.

Before edits, confirm your actual runtime model/effort using your own turn_context metadata or runtime-provided assignment. Do not print unrelated transcript/configuration. If unverifiable or wrong, report to Chef and continue read-only preparation only. The parent confirmed configured service tier default; do not enable FAST.

Adjusted scope: PKCE is already explicitly implemented; audit remaining correctness/guard/completion boundaries rather than starting a migration. Full bounded API writer inventory is required, not a keyword sample. Follow helpers enough to distinguish direct writes/provider calls, auth wrapper behavior/methods, and browser bundle reachability. Code/source report-only. P6 may edit four cron routes/audit wrapper: bind source evidence to hashes and reconcile those paths with its report before finalizing. Never read .env or secret values. Any existing focused test used as evidence must be safe and exact; Chef will independently rerun it.

Verification: inspect selected tests before execution for network, credentials, Git mutation or production access; use fixtures/mocks only. Allowed app checks are npm test -- <file>, npx tsc --noEmit, npm run lint from web/. Request Chef to serialize global checks. No GIT_DIR/GIT_WORK_TREE. Preserve failed check output in your lane without secrets. One diagnosis pass and one changed approach per blocker; escalate with exact evidence, do not spin. Stop when your acceptance is satisfied or a genuine authority/input blocker remains.

Handoff: write P8-HANDOFF.md in your lane with exact created/changed files, hashes, commands/pass/fail/not-run, acceptance matrix, blockers/proposals and any running process ID. Tell Chef when edits are finished so review can begin. No broad cleanup.

## Prompt 8 — Security read-only review (auth, PKCE, public data)

```text
/goal Do a read-only security review of the web app's auth and API boundaries, focused on A-AUTH NEW 46.0 (OAuth PKCE migration) and public routes that can trigger writes. Report only; change no code.

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
Never open, print, copy, or search for secret values (.env*, keys, tokens). If you see one, don't repeat it. Report only "a secret appears at <file>:<line>".

Steps:
1. Find the Supabase browser/server auth setup and callback/reset routes (rg "flowType|exchangeCodeForSession|verifyOtp|token_hash" web/). Check: is PKCE explicit; are callback `next`/return paths validated against open redirects; are codes and tokens scrubbed from the URL after exchange.
2. List every route under web/pages/api/** that writes to the database or calls an external provider, and whether it is wrapped by adminOnly / a cron secret / user auth. Flag any writer reachable without auth. Report fenced (Claude-owned) routes but don't propose edits to them; mark those "for Claude session".
3. Check for service-role client imports in any file that can be bundled for the browser (components/, pages/ non-api, hooks/).

Deliverable: tasks/codex-sprint-2026-10-19/security/AUTH-API-REVIEW.md with findings ranked P0–P3, each with file:line, a concrete exploit scenario, and a suggested fix. Separate confirmed findings from suspected ones.
Acceptance: every finding has file:line evidence; zero code changes (`git diff --stat` empty for code).
```
