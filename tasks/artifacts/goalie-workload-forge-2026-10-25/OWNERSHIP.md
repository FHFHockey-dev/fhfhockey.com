# Scoped local ownership

Owner: goalie workload delegated task from `01a16eed-60f6-7096-879f-696c469db015`, October 25, 2026. All other sprint lanes remain stopped. Canonical checkout: `octoberBranch` at `2a5092d37cb863ec92a2a4e609999cf226bfa4a5`.

Exact write paths for this slice:
- `web/components/GoalieShareChart/index.tsx`
- `web/components/GoalieShareChart/GoalieShareChart.test.ts`
- `web/components/GoalieShareChart/GoalieShareChart.pagination.test.tsx`
- `web/lib/goalieWorkload.ts` (new, extracted descriptive aggregation)
- `web/lib/projections/goalie/workloadEvidence.ts` (new, dormant evidence seam)
- `web/lib/projections/goalie/workloadEvidence.test.ts` (new)
- this artifact directory and `tasks/diaries/2026-10-25-codex-goalie-workload-forge.md`.

Checked current CODEX/CLAUDE lease files and master F11/A8/S01/S03/FE08 boundaries. No active exact-file lease overlaps these paths; Claude C1 was released October 25 04:07Z. Existing dirty chart retry/mobile changes are inputs and must survive. Shared lease registers remain with their named writer. No query, model, stage, RSO, Start Chart, other held source, package, cache or port ownership is taken.

Tests: dedicated artifact Vitest configuration/cache, one worker, inert service environment and network blocked. Acquire `/private/tmp/fhfh-heavy.lock` atomically only when absent; release only our own lock. No Next server/build, canonical generated output, GIT_DIR, production operation or other lane restart. One agent keeps this tightly coupled slice together; no staffing/settings claims or dispatch.

Status: claimed before source edits; bounded implementation and tests pending.

Frozen at 2026-10-25T13:43:56.782867+00:00 for local commit custody by coordinator `01a16e23-72b5-76ee-8ade-2d209d0e7002`. No further source writes/tests. Exact six-file pins and recovery patch in CHECKPOINT.json. Parent review/acceptance remains pending; no lease transfer to unrelated workers.
