# Slice 03 ownership — local runner A

2026-10-24, parent authorization follows TJ's “yes A” design choice. Sole Testing Grounds worker; `octoberBranch` HEAD `2a5092d37cb863ec92a2a4e609999cf226bfa4a5`.

New exact application files under `web/lib/forge-testing-grounds/`:
- `runnerContracts.ts`
- `runStore.ts`
- `memoryRunStore.ts`
- `boundedWorker.ts`
- `boundedWorker.test.ts`

New exact artifacts here: `OWNERSHIP.md`, `HANDOFF.md`, `EVIDENCE.json`, `OPERATING-PLAN.md`, `checks.log`. Continue existing task diary.

Scope: local portions of Tasks 2 and 6 with sealed operational/result projections. Immutable plans and store acceptance interface, in-memory reference implementation, one bounded worker step, synthetic lifecycle/security/race fixtures. No hosted persistence/durability claim. No maintenance-route reuse, model/data capture, actual forecasting, migrations, SQL execution, infrastructure, credentials, route/cron activation, shared source/config edits, server/heavy checks, Git mutation or new worker.

Previously reviewed/frozen sources and artifacts are read-only; exact imports are existing Zod and Node crypto plus this new slice. Existing routeRunner lease/CAS implementation is a read-only design reference, not an imported executor. Focused single-worker Vitest and scoped TypeScript/lint only. Explicit synthetic limits are test inputs, not an approved production operating plan or cost estimate.
