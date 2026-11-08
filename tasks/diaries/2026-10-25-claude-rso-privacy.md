# RSO-PRIVACY diary (2026-10-25/26, Claude)
- Scope: D2 per-principal local workspace + legacy migration; D1 context-switch intent reset; TJ granted AcquisitionRules.integration, dailyAcceptance.yahoo and roster-schedule-optimizer.spec.ts for mechanical seeding updates. No commit.
- State: done (with API-compat follow-up: no-principal reads unchanged from HEAD; dailyAcceptance.yahoo restored to HEAD and green). RSO unit 1631/1631 (TZ=UTC); E2E 50/54 (4 fail on HEAD too); tsc 0 errors under lock; eslint 0 errors.
- Gotchas: hydration waits for auth; the first hydration keeps pre-auth edits. After 00:00 UTC Monday, 4 component cases fail on HEAD too. Old preservation backups no longer validate. The existing RSO E2E spec has 4 pre-existing failures (533/590/635/1368 at HEAD) — worth a separate look.
- Next: orchestrator commits. Retire the diary after commit.
