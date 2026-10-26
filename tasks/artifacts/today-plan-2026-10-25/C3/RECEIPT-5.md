# C3 receipt 5 — in-loop WiGO batch write failures now under regression test (test-only, uncommitted)

- **Ticket:** fix the next highest-value cron/data-integrity defect from my noted list, within a 12-minute time box. Checkout `octoberBranch` at HEAD `80fa80b5c`, with earlier C3 fixes released. No Git commands, no commits, and no cron, ETL, refresh, live or production calls.
- **Narrow lease used:** only `web/__tests__/pages/api/v1/db/calculate-wigo-stats.test.ts`, which is already in the C3 lease. No other lane holds it.

## Triage of the noted list

| Candidate | Outcome |
|---|---|
| `players` read uses `.neq("position","G")`, so NULL positions would be silently excluded | **Ruled out**: `players.position` is `NOT NULL` (production schema baseline) |
| Snapshot route `207 {success:false, marketError}` audited as success | **Ruled out** in RECEIPT-3: `inferFailure` treats `success:false` as a failure |
| Snapshot `loadPlanningInputs` takes a fresh 8 s budget, ignoring the route deadline | **Deferred**: Codex asked to wait for `stageMs` evidence (C3d) before changing budgets |
| Legacy `wgo_skater_stats` identity rows (NOT VALID constraints) | Data repair or backfill, not code; needs live reads that are not authorized |
| `makeJob()` hard-coded dates (RECEIPT-4) | Test-hygiene risk in a shared helper outside the ticket-4 file list; no current failure |
| **RECEIPT-3 gap: the in-loop 200-player upsert error path had no test** | **Done here** |

No new production code defect was confirmed inside the lease. The value here is closing the untested half of the RECEIPT-3 fix: a rejected in-loop batch must fail the run. That code had no test, so a revert would have gone unnoticed.

## Change

New case in `calculate-wigo-stats.test.ts`: "fails the run when an in-loop 200-player batch upsert is rejected, while later batches still write".

- 250 players, each with one valid game. The first `wigo_recent` batch (players 1–200) is rejected.
- Expected: `500`, `writeErrors: ["wigo_recent: synthetic batch failure"]`, exactly 2 `wigo_recent` upserts, and only players 201–250 written.
- This documents that earlier batches are **not rolled back**, and that later batches still write.

**Mutation check:** I temporarily removed the in-loop `writeErrors.push` line from the route. The new test **failed** (`expected 200 to be 500`). I then restored the file from a backup and verified it byte-identical (`7fd0ed70…`).

## Files

| Path | Status | sha256 |
|---|---|---|
| `web/__tests__/pages/api/v1/db/calculate-wigo-stats.test.ts` | changed (+1 case) | `521c625ea0ec0f8a0237631ed0c00a5979132016b9f80723569acadbd4616390` (HEAD `0c24694a0a58ef24…`) |
| `web/pages/api/v1/db/calculate-wigo-stats.ts` | unchanged (temporary mutation reverted) | `7fd0ed706d337ed1f059ba2e0b4dc50bc95bb43a21953d55870bbf541c231c10` |

## Checks

| Check | Result |
|---|---|
| `calculate-wigo-stats.test.ts` | **passed** (38/38) |
| New case under the mutation | **failed as expected**; passes once the source is restored |
| ESLint on the changed test | **passed** (exit 0) |
| Whole-project typecheck | not run (test-only change; time box) |
