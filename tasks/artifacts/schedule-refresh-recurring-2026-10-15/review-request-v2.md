# Same-peer review request — V2 overlap correction

Reviewer: `01a135cf-dda8-7599-896b-ca48cede00da`, the author of `independent-review.md`.

Review the exact file hashes in `FROZEN-V2.json` and its supplied SHA-256. Write a new `independent-review-v2.md` only; preserve the frozen files and `rejected-v1/`. This is engineering review of an unapplied proposal, not local application/DDL execution, scheduling, production acceptance or write authority. No private one-time approval/attempt/pilot artifacts are needed.

The exact supplied race was reproduced before correction and preserved in `rejected-v1/reproduced-overlap.log`. V2 has 32 passing offline VM/model/static checks and a passing five-root virtual TypeScript check. The previous 50 existing tests are reused, not rerun. PostgreSQL was not parsed, connected to or executed; the synthetic transaction model is not claimed as PostgreSQL proof.

Please focus on the single P2 and its correction:

1. Does `database-prerequisite.sql` enforce database-wide ordinary statement serialization and per-row strictly increasing receipt timestamps across the new RPC and the unchanged legacy/manual writer, including PostgreSQL's INSERT/UPDATE triggers during ON CONFLICT?
2. Does `commit_recurring_roster_schedule` prevent a stale/equal side from partially updating a batch, return known stale/busy/rejected no-ops only after transaction rollback or before changes, and preserve ambiguous transport errors as unknown? Check its advisory lock, row-version guard, exception block, typed insert column list and permissions. The temporal guarantee is stored observation-clock ordering, not provider publication causality or destructive/full-delete maintenance.
3. Does the route obtain its database ordering clock before source capture, avoid completion-time restamping, consume the RPC result honestly and leave the one-time route's game/hash authority unchanged? Acknowledge that shared DDL now rejects stale/equal/contending legacy statements and needs separate approval/owner handback.
4. Do the 11 new focused adversarial cases match the original race and exercise equal-clock replay, mixed-scope no-op/legacy rollback, both writer directions, busy contention, missing clock and lost/partial acknowledgements without claiming real SQL execution?
5. Do the corrected bounds distinguish metadata/API rows, overflow sentinels, internal SQL reads/work, per-invocation source concurrency and the two scheduled calls' daily allocation? The 1000-side ceiling is an explicit allocation; no actual normal population is claimed.

The new prerequisite is four SECURITY INVOKER functions and two triggers, no new table/column/index/data repair. It must become an independently authorized, correctly generated migration only after real isolated PostgreSQL/native-wrapper checks. Applying the five-file application patch alone is not sufficient. No live/provider/DB/schema/scheduler/build/deployment action is authorized for this review.

The reported completed one-day FORGE repair is planning metadata only and does not prove whole-week, next-game or arbitrary-horizon freshness. The current/next full-week/padding scope and twice-daily policy are unchanged. Existing release, bounded preflight, secret-reference, monitoring and recurring-write activation approvals remain pending regardless of engineering acceptance.
