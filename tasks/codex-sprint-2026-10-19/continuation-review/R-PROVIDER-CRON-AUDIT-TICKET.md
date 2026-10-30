# R-PROVIDER-CRON-AUDIT — three unfenced hourly invocation receipts

Parent: C0044/NEW7. Chef independently read the three clean route diffs, actual helper readback and shared audit contract. This is an authorized local fix from R-VERCEL-GATE-HANDOFF's three unowned integration gaps. No provider business helper or shared runtime audit/auth helper may be changed.

Owner /root/c_f2, Sol/high current runtime reconfirm required; Chef Sol/xhigh.

Exactly seven source/test files reserved:
- web/pages/api/internal/patreon-reconcile.ts
- web/pages/api/internal/espn-sync.ts
- web/pages/api/internal/fantrax-sync.ts
- web/__tests__/pages/api/internal/espn-sync.test.ts
- web/__tests__/pages/api/internal/fantrax-sync.test.ts
- web/lib/cron/cronAuditCoverage.ts
- web/__tests__/pages/api/v1/db/cron-audit-wrappers.test.ts

Report sole new path continuation-review/R-PROVIDER-CRON-AUDIT-HANDOFF.md. Do not edit prior handoff/register/master/config. The three routes were clean at Chef readback; preserve any unrelated concurrent changes if observed and stop that path rather than overwrite them.

Acceptance:
1. Use existing withCronJobAudit to persist one route-run receipt for an admitted hourly invocation, including disabled/zero-work and exception outcomes. No new persistence abstraction, DB schema or logging framework. At configured cadence, three routes represent at most72scheduled opportunities/day; this is not an observed hosted count or deployment permission.
2. Preserve exact existing admission and method behavior. Patreon adminOnly remains outside audit. ESPN/Fantrax retain method/secret/nonempty/constant-time rejection before any audit or helper work, with no browser-admin fallback. No secrets, request headers or account/league IDs added to audit.
3. Existing API result fields, statuses and sync parameters remain. To make aggregate failures honest under shared wrapper inference, an additive success boolean derived from the existing finite failed counter is allowed; audit failure must not depend only on HTTP200. Do not broaden into changing provider/business error semantics or counters. Disabled/empty outcomes remain explicit. Use recordRowMetrics:false: league/account counts are not rows affected. Preserve fixed catch messages.
4. No provider helper changes, consent/entitlement/storage/feature policy changes, runtime scheduling or real credentials. Existing read-only helper behavior and caller bounds remain untouched.
5. Extend existing ESPN/Fantrax tests using actual shared audit wrapper with mocked DB/provider and network forbidden, asserting unauthorized/missing-config/method cases no-audit/no-work; admitted disabled/empty/success/aggregate-failure/thrown-failure cases exactly one audit with correct safe status and no row metric inference. Extend existing wrapper suite for actual Patreon handler under existing shared synthetic auth/audit mocks, including empty/aggregate failure/fixed catch, without new test file.
6. Update static Vercel gate narrowly for actual auth-first audited delegate shape of ESPN/Fantrax (source-specific supported syntax, no generic analyzer); require actual reviewed import/call relationship after exact bespoke admission prefix. Add negative decoy/bypassed/late audit-delegate fixtures. Existing pg46/50,27entries/18routes, F2/Python and four Claude-owned unqualified routes remain explicit. Expected remaining audit-unqualified routes: starter-board,yahoo-live-draft,replay-player-aliases,update-drafted-prospects.
7. Focused command from web/: npm test -- __tests__/pages/api/internal/espn-sync.test.ts __tests__/pages/api/internal/fantrax-sync.test.ts __tests__/pages/api/v1/db/cron-audit-wrappers.test.ts. No global checks; Chef does independent rerun/TypeScript/lint after source review.
8. One bounded implementation, diagnose/change approach before retries; no subworkers, new unrelated work or arbitrary clock cutoff. Report exact source/test hashes, checks/failures/limits. Return ownership before Chef review.

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

