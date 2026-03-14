# Organization And Efficiency Closeout

Date: `2026-03-14`
Task: `5.6`

## Purpose

Close the organization / efficiency pass with a short summary of:

- the reduced operator-facing job surface
- the current runtime-budget status
- the cleanup intentionally deferred so this pass stays focused

## Reduced Job Surface

The preferred long-term operator-facing surface is now:

1. daily coordinator
   - `GET /api/v1/db/run-rolling-forge-pipeline?mode=daily_incremental&date=YYYY-MM-DD`
2. overnight coordinator
   - `GET /api/v1/db/run-rolling-forge-pipeline?mode=overnight&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`
3. monitoring
   - `GET /api/v1/db/cron-report`

This is the main organizational outcome of the pass.

It means the system does not need a large permanent cron list for:

- single-game PP rebuilds
- single-game line rebuilds
- separate WGO split jobs as operator-facing surfaces
- ad hoc debug or validation routes as routine scheduled work

## Runtime Budget Status

### Daily rolling-player path

Current enforced target:

- `4m 30s`

Verified live check:

- command:
  - `npm run check:rolling-player-runtime-budget -- --profile daily_incremental --date 2026-03-12`
- observed result:
  - `104182ms`
  - `1m 44s`
  - `withinBudget: true`

Interpretation:

- the daily rolling-player path is under budget with headroom
- the main reason is the narrowed date-scoped player selection, which removed the unnecessary full-player scan

### Overnight posture

Current baseline:

- season-sweep benchmark: `21m 45.843s`

Interpretation:

- this is operationally reasonable for an overnight path
- the coordinator and execution-profile split now keep overnight and daily behavior distinct instead of sharing one implicit default

## Organization Improvements Landed

### Operator-facing improvements

- one coordinator route for rolling-player + FORGE freshness
- one operator runbook that states what runs daily and overnight
- one explicit dependency graph instead of a loose route list

### Code-ownership improvements

- shared execution-profile and runtime-budget policy in:
  - [rollingPlayerOperationalPolicy.ts](/Users/tim/Code/fhfhockey.com/web/lib/rollingPlayerOperationalPolicy.ts)
- shared route query parsing in:
  - [queryParams.ts](/Users/tim/Code/fhfhockey.com/web/lib/api/queryParams.ts)
- backlog grouped into a smaller set of implementation tracks instead of many mini-projects

## Intentionally Deferred Cleanup

The following work remains intentionally deferred because it is useful but not required to keep the operator surface small and the runtime budget in range:

- deeper decomposition of `fetchRollingPlayerAverages.ts`
- full diagnostics/readiness model unification across helpers, payloads, UI, and scripts
- remaining PP provenance and TOI trust follow-up work
- compatibility and alias-cleanup track beyond the first boundary reductions
- PK source-tail fixes for the blocked retained validation scopes

## Final Readout

This pass achieved the organization and efficiency goals that matter operationally:

- the cron/job surface can stay small
- the daily rolling-player path is under the agreed runtime target
- the overnight path is distinct and manageable
- the repo now has clearer ownership boundaries for:
  - orchestration policy
  - transport helpers
  - validation and compatibility follow-up tracks

The remaining work is no longer “too many files and too many jobs.” It is a controlled set of follow-up tracks on top of a smaller operator-facing surface.
