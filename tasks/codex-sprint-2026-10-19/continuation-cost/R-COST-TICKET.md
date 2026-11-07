# R-COST — sprint remains active

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


The human explicitly removed the time limit, authorized implementing local report fixes/remaining prompt gaps/other unblocked master-list work, and corrected Chef for stopping at another batch. No timed cutoff. Preserve Claude ownership and all hard fences; continue useful unblocked work while external gates stay explicit.

Work master rankings ecosystem C0124's unblocked local measurement portion. Own ONLY this lane initially. Read current full-cohort entityMetricRankingReader and relevant S-20 contract; full-cohort ranks are intentional. Build a bounded network-free fixture benchmark using actual exported reader with injected/mocked Supabase/query/cache boundaries, recording rows/pages/requests, payload size estimates, ranking time across explicit small/representative/stress synthetic cohorts, warm/cold where actual cache supports it, exact runtime/config/source hashes. No live/request latency/cost claim. Preserve rank/cohort correctness, no naive entity/limit pushdown. Existing entityMetricRankingReader.test.ts writes receipts outside authorized lane in afterAll, so do not run it unmodified. Prefer lane-local harness with supported installed runtime; no install/config/build/provider calls. If a concrete maintainable unfenced performance improvement follows, propose exact file ownership/change before editing application code. Deliver benchmark and concrete bounded acceptance/performance proposal, not a claim to close hosted cost. Keep work narrow and measured, no fabricated million-row exhaustive run. Runtime Sol/medium; root xhigh.

Read AGENTS.md, SPRINT-MODE.md and mise-en-place.md. Confirm own actual Sol model/effort from matching CODEX_THREAD_ID turn_context before edits. Chef owns REGISTER/global checks and independently reruns focused verification; do not write register or spawn subworkers. One diagnosis and one changed attempt per concrete blocker, then report it and continue independent task portions. No secret/env reads, hosted/provider/network/Git mutations. Exact source ownership before edit; inspect current diff. All notes/handoffs confined to this lane. Keep previous receipts historical. Return actionable findings/checks/limits and next unblocked piece; don't declare the sprint finished.
