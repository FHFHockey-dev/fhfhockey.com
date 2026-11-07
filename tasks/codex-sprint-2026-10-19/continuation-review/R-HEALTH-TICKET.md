# R-HEALTH — approved bounded snapshot diagnostics

Chef approves exact two-file scope and contract in R-HEALTH-PROPOSAL.md. Owner /root/c_f1 Sol medium; Chef xhigh. Only web/lib/sustainability/health.ts and existing health.test.ts plus lane handoff. No route/schema/config/writer/model edits, no subworkers.

Preserve existing fields; additive latest-observed-score-date diagnostics only. expectedPopulation always null and coverage always unverified; never infer complete membership/freshness from matching counts or producer population_count. At most six new serialized date/window-scoped queries, four window HEAD counts, one null-quintile HEAD count, one deterministic identity/population distribution query with exact count and five-row sentinel. No added queries without anchor. Report missing/inconsistent/ambiguous/truncated observations honestly; reject unavailable/invalid new counts and queryerrors. All ambiguous multi-version observations remain unverified, no arbitrary active config selection. Existing all-history counts remain unchanged. Root source read found baseline idx_susscore_date_win(snapshot_date,window_code) at35789, but no hosted plan/cost guarantee follows. Recordquery/payloadbounds and limitations.

Extend existing focused mock tests as proposed, including equal250-row windows remaining unverified, missing/null-quintile observations, identity/truncation/nullcount/errors, no-anchor sixqueries, datepredicate, limit5 and maximum12requests. Only npm test -- lib/sustainability/health.test.ts fromweb; Chef reserves globalchecks. No API invocation, real DB/provider/hosted/network/secret/env-file access, manifests/config/env edits, schema or Git mutation. No Python exception applies to this task. Preserve hardfences and concurrentstate. Report hashes/checks/sourcecontract and scheduling/fullpopulation limits, release ownership. Sprint remains active without timedcutoff.

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

