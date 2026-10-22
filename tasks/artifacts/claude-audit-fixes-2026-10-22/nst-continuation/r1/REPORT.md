# NST continuation R1 — fenced acquisition and uncertain holds

**Both independent failures are fixed in the pinned local candidate; re-review remains pending.** TJ clarified that his active backfill runs through the production `/db` console, resolving the temporary local-edit hold. All five source/test writes occurred at 13:06:00 UTC before that hold arrived; no canonical source writes occurred during it. Subsequent work was read-only inspection, isolated verification and artifact writing. No process was stopped, restarted or contacted.

## Fixes and safety boundary

**NST-R1:** `acquireProjectionPipelineLease` now accepts an optional synchronous resumability guard. It runs against the freshly read state whose revision is used by the acquire compare-and-swap. The NST stage’s guard rejects `nst_persistence_unconfirmed` without an RPC transition, so a concurrent invocation with an older run-state map cannot erase the hold. If another writer changes the state after the guard, the existing revision check rejects acquisition. Other callers retain their previous behavior.

**NST-R2:** the route assigns the non-resumable manual-review response before attempting to persist the hold. A rejected hold write preserves that response and adds the state-write error as a diagnostic.

The second fix also needs protection on a later invocation, not just a truthful response. The already-acquired `running` stage row is durable intent written before NST is invoked. This candidate refuses to reacquire **any existing running NST stage**: an active owner returns in-progress; an expired or malformed lease requires manual review. This blocks replay even when the later hold write was lost or when a worker died before returning. The stage is not relabeled, its cursor is preserved, and no kill-count/retry transition erases that evidence. A confirmed `stage_handoff` still resumes normally; a completed stage remains terminal. Other stages keep their existing A6 recovery behavior.

This is deliberately conservative: a process killed before making its first NST request, or after a valid producer continuation but before saving its cursor, also requires review. Automatic recovery would need an independently reviewed proof that the producer’s exact request and all writes are durably acknowledged; lease expiry alone cannot supply it. No schema change is required for this conservative fence, and no schema or database change was made. The guarantee assumes the existing RPC/durable row and same-version admission path; it does not cover manual row deletion, database rollback/loss, old workers, or direct independent runner calls.

## Changed files

- `web/pages/api/v1/db/run-rolling-forge-pipeline.ts`: preserve manual termination before persistence, handle guarded acquisition, exclude NST from automatic abandoned-stage takeover.
- `web/lib/rollingForgePipelineRunState.ts`: NST-specific guard and typed manual-review error.
- `web/lib/projections/projectionPipelineState.ts`: optional guard against the exact acquisition revision; no RPC/SQL changes.
- Their existing tests: `web/__tests__/pages/api/v1/db/run-rolling-forge-pipeline.test.ts` and `web/lib/projections/projectionPipelineState.test.ts`.

`r1-fixes.patch` applies to the rejected R0 candidate; `cumulative-fixes.patch` includes the original continuation changes relative to the accepted pre-NST bytes. Both old archives remain unchanged. The producer, transport, rate-budget code, auth wrappers and cron configuration are unchanged. The two previously failing review cases are retained as application regressions. The entire independent seven-case fixture is also included byte-for-byte in the isolated snapshot.

## Verification

Node 22.11.0/npm 10.9.0; fresh nested source-only snapshot; synthetic environment; sockets/HTTP(S)/unmocked fetch denied; existing dependencies reused. No install, server, production or NST request.

| Check | Result |
|---|---|
| Unchanged reviewer fixture against R0 | 2 failed, 5 passed — reproduced both reported defects |
| Updated pipeline suite | 56 passed |
| Unchanged real NST producer suite with mocked transport/DB | 101 passed |
| Shared lease helper suite | 9 passed, including guard rejection before RPC and revision change after guard |
| Unchanged independent reviewer fixture against R1 | 7 passed |
| Total executed fixed cases | **173 passed**; the two reviewer cases also appear in the pipeline regression suite |
| Full isolated nonincremental TypeScript check | Passed, exit 0 |
| ESLint on all five changed files | Passed, exit 0 |
| Scoped diff whitespace and R1 patch application check | Passed |

The original shared test harness still models database behavior in memory. These checks do not execute Postgres locks or prove deployed runtime behavior. Existing mock offseason and punycode warnings remain. No network guard failure occurred.

`CANDIDATE.json` pins the five changed files and seven unchanged dependencies. The 3,357-file archive hash is `0204013426c5702b1fcd87cf0db9ec8d0919b2a4d2601945ad1d9d8a98e9ac25`; `FIXED-SNAPSHOT.json` pins every file. It is a scoped review snapshot, not a combined release candidate.

## Active backfill and remaining gates

See `RUNTIME-HOLD.md` for the preserved read-only risk assessment and subsequent clarification. TJ confirmed production `/db` console execution. These unpublished local edits cannot change deployed code. Local release records identify R20, but the exact code version executing his current backfill was not observed and is not asserted. No competing NST request or runtime intervention occurred.

The five candidate files remain pinned for review; no further source changes are needed for this packet. Independent R1 acceptance, quiescent/version-consistent rollout and any authorized operational recovery are pending. The original model-qualification, completeness/universe, coverage and real-account consumer gates remain open. No release, migration, backfill or production action is approved by these passing tests. No external action was attempted, denied or uncertain; the active user process was not inspected or controlled.
