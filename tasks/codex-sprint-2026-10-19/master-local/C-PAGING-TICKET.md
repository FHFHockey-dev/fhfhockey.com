# C-PAGING — master ranking post-alignment C0064

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


User expanded sprint to finish unblocked master tasks. Reconciliation found source unique ordering already implemented, but acceptance requires a page-boundary regression. Chef independently ran three existing tests: they only assert order arrays, with small one-page fixtures. Do not close C0064 on those alone. Underlying teamStatsQueries has a real1,000row tie-aware boundary test; reuse its mock approach where appropriate without broad refactor.

Own ONLY web/lib/rankings/teamMatrix.test.ts, web/lib/rankings/goalieMatrix.test.ts, web/lib/rankings/deploymentTiers.test.ts plus this lane/C-PAGING-HANDOFF.md. Existing runtime source read only. Add meaningful >page-size synthetic fixtures where nonunique date/game keys tie across boundary; simulate backend unstable tie order if unique tie-break omitted. Exercise actual source reader(s) and assert complete unique logical rows or aggregate output sensitive to loss/duplication and multiple page requests. Cover at least representative team, goalie and deployment reads; retain existing exact ordering coverage for remaining tables. Avoid tests that merely mirror .order calls or inflate count without checking data. Existing query mock can be extended narrowly. No artifact writes outside this lane, no source behavior change, no new test files/dependencies.

Acceptance real page boundary exercised through actual readers and loses/duplicates (or yields wrong aggregate) if tie-break removed; focused three owning files pass; record a bounded temporary in-memory source omission or fixture adversary showing regression sensitivity if feasible, never mutate runtime source on disk. All pure/mocked local data only. Runtime Sol/medium already confirmed; Chef xhigh. No subworkers/global checks/Git mutations. One diagnosis and one changed retry then report concrete blocker rather than broadening.
