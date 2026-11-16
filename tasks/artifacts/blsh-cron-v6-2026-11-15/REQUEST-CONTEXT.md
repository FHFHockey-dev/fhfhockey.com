# Daily request/context read v1: design (human-gated)

**Chef's decision 3 (2026-11-15):** a reviewed, narrow SECURITY DEFINER function, executable only by `service_role`.

**Built in Phase 2, offline:**
- **The function:** `supabase/migrations/20261116000100_blsh_request_context_v1.sql`, a file that has not been applied.
- **The pure builder:** `web/lib/blsh/nativeCaptureV6/requestContext.ts`. It turns the function's result into the reader's `RAW-*.json` files and `CURRENT-REQUEST` shape.

**Not built:** the caller. It stays human-gated until the function has been independently reviewed, approved by TJ and applied.

## Function contract

`public.blsh_request_context_v1(p_date_from date, p_event_through date) returns jsonb`. It is STABLE and SECURITY DEFINER, with `search_path ''`, and only `service_role` can execute it.

**Rows:** exactly the reader's rows (scope `d84a9547…`, `COLUMNS.json` `c14231f0…`):
- the key seal (WGO ids, ordered by id, ≤ 10,000; refused at 10,001);
- per WGO id, the 4-element group `[wgo, individual[≤9], onIce[≤9], games[≤9]]`.

**Snapshot:** one STABLE function means one statement snapshot, the equivalent of the reader's REPEATABLE READ READ ONLY transaction. It writes nothing.

**Bounds:**
- `p_date_from ≤ p_event_through`, a span of at most 28 days, inside 2026-07-01…2027-06-30;
- at most 8 MiB of JSON.

The 28 days match the reader's 2026-10-14 → 2026-11-11 window.

**Parity, proved on a disposable Postgres** (`supabase/tests/blsh_capture_v6.py`, 57/57 for both migrations): the key seal and every row group equal the reader's own `KEY_SQL`/`PAGE_SQL`, imported read-only from `capture_reader.py`, on the same seeded rows. That includes `LIMIT 9` on a 10-row linked list, plus the out-of-scope season, date and game cases.

**Builder** (`requestContext.test.ts`): the function's real output (fixture `web/lib/blsh/nativeCaptureV6/__fixtures__/request-context-v1.sample.json`, written by `--write-fixture`) builds a request that:
- passes `export_context.cjs` `checkRequestShape`, loaded read-only;
- passes the real `qualifyCurrentInputs`.

It refuses the reader's failure cases: an added key, an out-of-scope row, more than 8 linked rows, a cross-join, a conflicting duplicate and a changed column contract.

## Proposed caller (not built; for approval later)

`POST /api/v1/db/blsh-request-context`, cron-bearer only, with the same isolated `node:https` writer as the capture route.

**Gates:**
1. the capture run for D is `packet_complete_pending_review`;
2. now ≥ the latest native retrieval, and now ≤ the earliest native retrieval + 12 h (the reader's window rule, read from the packet's TRANSPORT-OBSERVATIONs);
3. a one-shot claim `(pipeline 'request-context-v1', D)` in the same `blsh_capture_runs` table. This widens that table's `pipeline` check, so it needs a small migration of its own.

**Call:** exactly one `rpc/blsh_request_context_v1` with `p_date_from = D − 28` and `p_event_through = D`. There are 0 retries. The response is capped at 8 MiB, streamed and counted.

**Output:**
- `RAW-{wgo,individual,onIce,calendar}.json`, `CURRENT-REQUEST.json` and `RESULT.json`;
- `RESULT.json` has `executionMode` and `captureContext` = `definer_function_request_context_v1`, `atomicDatabaseSnapshot: true` and `sessionClosed: true` (no session);
- all uploaded under `request-context-v1/{D}/{run_id}/`, manifest last.

**Slot:** 12:35Z, about 30 minutes after the capture, well inside its 12-hour window. It makes no NST traffic.

**Needs before it runs:**
- the function reviewed, approved and applied;
- `export_context.cjs` accepting the new `captureContext` (PROFILE-SPEC.md §5);
- TJ approving one daily production DB read of this exact scope.
