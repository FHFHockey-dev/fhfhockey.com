# RSO R7 support: optional ownershipEvidence on saved players (claude session)

## Scope
Chef ticket. Add an optional strict `ownershipEvidence {value 0..100|null, observedOn YYYY-MM-DD|null, provider "yahoo"|null, status fresh|stale|unknown}` to the `player` schema in web/lib/in-season/workspaceSchema.ts. It must be backward compatible and is counted in the existing UTF-8 budgets. octoberBranch working tree only; no master patch (ships with R7).

## State
- PlanningPlayer type is in lib/rosterScheduleOptimizer/planningTypes.ts:27 (RSO worker local_038079b1). Told the Chef with the exact one-line field; not edited. tsc doesn't need it (z.ZodType<PlanningSnapshot> accepts the extra optional output field).
- RED: workspaceSchema.test "parses saves without it unchanged and round-trips…" and workspaceRoutes.test "saves per-player ownership evidence and restores it exactly" fail. The rejection cases (bad value/date/provider/status, extra key, missing key, null) already passed through `.strict()` and stay as guards.
- GREEN: 72/72 in the two files. tsc (octoberBranch, lock): first run had 2 errors in my test (it read .ownershipEvidence before the type line lands); fixed by comparing whole objects; re-run EXIT 0. DONE, nothing committed.
- Chef: type line routed to local_038079b1; this ticket is schema + tests + tsc only.
