# Cron Benchmark Runner Shape

## Decision

Use a small shared runner library as the primary execution surface, with:

- a local/dev-first CLI script as the main operator entrypoint
- an optional thin API route wrapper only if later subtasks need remote invocation

This is not a route-first design and not a script-only design. The chosen shape is:

- shared runner core in `web/lib/cron/`
- thin script wrapper for local/dev audit execution
- optional thin API wrapper for remote or authenticated invocation

## Why This Shape Fits The PRD

- The PRD says local/dev should be the primary benchmark mode.
- The benchmark run must cover both HTTP routes and SQL-only jobs.
- Some jobs are unsafe to run blindly in a remote route context:
  - Google Sheets side effects
  - Resend email side effects
  - direct NST fetch spacing and pacing
- Some jobs will eventually benefit from an API wrapper, but forcing the first implementation through a Next.js route would make local iteration slower and increase mocking overhead.

## Rejected Alternatives

### 1. API Route As The Primary Runner

Rejected because:

- local/dev execution is the primary required mode
- long-running benchmark orchestration is easier to control from a script
- SQL-only jobs and side-effect skips do not naturally fit a route-first model
- route-only execution would force extra auth and request-shape glue for every local audit pass

### 2. Script-Only With No Shared Core

Rejected because:

- later subtasks may still need a route wrapper
- route and script would drift if orchestration logic lived only in one ad hoc script
- the repo already benefits from reusable pipeline-spec and audit-wrapper patterns

## Recommended Implementation Shape

### Shared Core

Create the real orchestration logic in `web/lib/cron/`:

- inventory loading
- chronological sequencing
- HTTP job invocation
- SQL job execution strategy selection
- skip/fallback handling
- benchmark observation normalization

The shared core should return plain structured results, not Next.js response objects.

### Script Wrapper

Create a thin script entrypoint as the primary operator surface:

- reads env from the same local workspace
- runs the shared runner in chronological order
- prints or persists summarized observations
- supports local safety flags and dry-run/skip controls

This script is the main implementation target for `4.2` to `4.7`.

### Optional API Wrapper

If needed later, add a thin route such as `web/pages/api/v1/db/cron-audit-runner.ts` that:

- validates auth
- forwards query params into the shared runner
- returns the shared runner result as JSON

The route should not own orchestration logic.

## Existing Repo Patterns That Support This Choice

- [run-rolling-forge-pipeline.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/run-rolling-forge-pipeline.ts)
  shows that the repo already uses a coordinator surface with reusable route primitives.
- [withCronJobAudit.ts](/Users/tim/Code/fhfhockey.com/web/lib/cron/withCronJobAudit.ts)
  already gives durable route-level audit visibility for child HTTP jobs.
- [cron-schedule-normalized-inventory.md](/Users/tim/Code/fhfhockey.com/tasks/artifacts/cron-schedule-normalized-inventory.md)
  already identifies SQL-only jobs, side-effect jobs, broken jobs, and NST-sensitive jobs, which all favor a shared runner over a route-only design.

## 4.x Implications

### 4.2 Chronological Execution

Implement in the shared core, not in the script itself.

### 4.3 HTTP And SQL Support

Model both job kinds in the shared core so the script and any future route wrapper use the same execution contract.

### 4.4 Observation Capture

Normalize all benchmark observations in the shared core so they can later feed `cron-report.ts`.

### 4.5 No Hard Duration Cutoff

The shared core should avoid route-layer time budgets for benchmark orchestration itself, even though individual jobs may still report their own runtime budgets.

### 4.6 Skip/Fallback Handling

Keep skip classification and local/dev safety policy in the shared core.

### 4.7 Output Contract

Define one structured benchmark result shape in the shared core, then let script and route wrappers serialize it differently.

## Chosen Files For Follow-Up Work

- `web/lib/cron/benchmarkRunner.ts`
  Shared orchestration core.
- `web/lib/cron/benchmarkRunnerTypes.ts`
  Shared result and execution-shape types if the runner file becomes too large.
- `web/scripts/cron-audit-runner.ts`
  Primary local/dev operator entrypoint.
- `web/pages/api/v1/db/cron-audit-runner.ts`
  Optional thin wrapper, only after the shared core exists.

## Final Choice

The benchmark execution shape for this project is:

- shared runner core plus thin script wrapper first
- thin API route wrapper later only if needed
