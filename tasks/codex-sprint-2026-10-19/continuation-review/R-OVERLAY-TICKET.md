# R-OVERLAY — stale parent rows after accepted child closures

Parent scope: the existing63open nonimported/overlay master rows, specifically those reopened only by imported issues that this sprint has now closed. R-OPEN already reconciled106remaining imported IDs; do not rescan them or implementation source broadly. Chef found a concrete likely stale example: master4.5 B-SKO and5.7.26 still cite open SKO NEW10, but source NEW10/C0071 is now accepted closed and source has no open checkboxes. Other likely candidates:5.1.2 email,5.2.3 post-alignment,5.2.6 rolling remediation,5.3.2 team underlying,5.3.4 power/landing. Do not assume any is closable.

Owner /root/c_f1 existing Sol/medium (reconfirm actual runtime); Chef Sol/xhigh.
Write only continuation-review/R-OVERLAY-PROPOSAL.md. Master/source lists/register/evidence reports READ ONLY to worker; Chef is sole updater.

Outcome:
- Exact current remaining overlay parents whose only stated Oct17 reopen blocker was a now-closed imported child. Start with the named candidates and direct overlay ancestors; no new broad audit/source tree search.
- For each candidate, identify exact checkbox line, reopening child identity, source current checkbox/count and already Chef-accepted evidence/hash path. Reuse current receipts; no test reruns or runtime source edits.
- Recommend close only if existing acceptance is actually met at its stated level. A source-all-checked count alone is not sufficient; broader release/provider/history/owner gates remain explicit. Separate local audit completion, retained prior evidence and deployment/empirical acceptance. Preserve separate NEW-SKO-VUDU Phases1-3 blocked/unstarted even if original B-SKO audit is closed.
- Identify partial-note-only/leave-open rows if an independent acceptance remains. Do not create work or close parents by inherited optimism.
- Report concise candidate rows/exact proposed dated addendum and count impact. Do not write source/master/register or ask user.
- Existing no-cutoff sprint, no subworkers, no unrelated work. Stop after enough evidence for these concrete candidate dispositions; no complete audit of all169remaining tasks.

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

