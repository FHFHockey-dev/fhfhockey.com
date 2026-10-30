# Independent review: RPC deadline and read-only reconciliation v1

**Verdict: accepted within the bounded local scope.** The owner increment (`../rpc-deadline-reconciliation-v1/`) has no implementation defect in its client deadline, reconciliation contract or SQL8. Every reviewed path returns unknown on a timeout, never treats it as rollback, and never sends a second write. This review adds one observation (O-1) about the accepted SQL6 path, which fails closed. It also found one adjacent gap outside this increment (R21), corrected separately in `../scheduler-retain-only-v1/`.

Reviewed 2026-10-17 by a separate session from the owner. The owner's interrupted run left no acceptance note. All results here come from new runs in this folder. No owner evidence was modified.

## Reviewed bytes

| Path | SHA-256 |
|---|---|
| `web/lib/sources/iftttRpcDeadline.ts` (new) | in `pin-check-before.json` |
| `web/lib/sources/iftttReceiptRetention.ts`, `lineSourceIftttReceiver.ts`, `lineSourceIftttReceiver.test.ts` (3 declared changes) | in `pin-check-before.json` |
| SQL8 `../rpc-deadline-reconciliation-v1/supabase/migrations/20261016092509_ifttt_rpc_deadline_reconciliation.sql` | `7c6c5e093fdaa1b0ccef15228eccda1b60096d4a74662fb0ad84e0302be01e4a` |

- Against the accepted intake-v2 manifest (148 pins), exactly the 3 declared files changed. The live diffs equal the owner's `evidence/*.diff` byte for byte.
- `iftttRpcDeadline.ts` is the only new runtime file.
- All 14 source pins and 38 owner artifacts were unchanged after every run (`pin-check-after.json`). The frozen copies under `frozen-source/` equal live.
- Git HEAD was `ceceb407a`; the increment code arrived in commit `7f094c8e6`. It is on `octoberBranch` only, not on `master`.

## Checks actually run

| Check | Result | Evidence |
|---|---|---|
| Owner's 130-case harness, copied byte for byte: 88 actual-PG, 10 SDK-transport, 20 policy, 12 receiver | **130/130 pass** | `evidence/copied130*.{log,json}` |
| First attempt of the same run | Environment failure, kept as-is: macOS PG17 refuses to start without `LC_ALL` ("postmaster became multithreaded"). Rerun with `LC_ALL=en_US.UTF-8`. | `evidence/attempt1-env-failure-*` |
| 9 independent cases (`independent-deadline.test.ts`) | **9/9 pass** | `evidence/independent9*.{log,json}`, `evidence/independent-*.json` |
| R21 demonstration (`independent-scheduler-retain-only.test.ts`), run against the pinned pre-fix bytes | 2/2 pass. Documents the gap. | `evidence/independent-R21*` |
| Scoped TypeScript (`tsconfig.json`, including the independent tests) | exit 0 | `evidence/scoped-tsc.log` |

Commands were run from `web/`:

- `LC_ALL=en_US.UTF-8 IFTTT_POSTGRES_BIN=/opt/homebrew/opt/postgresql@17/bin npx vitest --run --no-file-parallelism --config <this>/regression.config.mjs`
- the same command with `--config <this>/vitest.independent.config.mjs`
- `npx vitest --run --config <this>/vitest.config.mjs independent-scheduler-retain-only`
- `./node_modules/.bin/tsc --noEmit --project <this>/tsconfig.json`

Every PG run used a fresh private PG17 cluster with Unix sockets only, synthetic roles and data, and removal at the end. Network access was denied, except that the independent SDK cases could reach one `127.0.0.1` listener created by the test (`loopback-only-network.ts`). No full `tsc`, build, lint rerun or hosted call happened. Lint was not rerun because runtime bytes are unchanged since the owner's empty `lint.log`.

## What the independent cases add

These cases cover what the owner's harness did not (it used an injected fetch, hard-coded `SET LOCAL` timeouts and post-commit reads only):

1. **Real loopback socket with the installed supabase-js.**
   - A 200 response whose body stalls is torn down at the 6 s write deadline: the server sees the socket close with the body unfinished.
   - It is then acknowledged by exactly one read with identical arguments, at about 6.0 s.
   - When both requests stall, both sockets close and the outcome is `IftttIntakeOutcomeUnknown` at about 8.0 s.
   - A PostgREST-shaped `57014` error body gets one read and no second write.
2. **Catalog-derived PostgREST model.** Transaction mode and hoisted settings come from `pg_proc` (provolatile and proconfig), not from hard-coded values.
   - The write runs read-write with `statement_timeout=5s` and `lock_timeout=2s`. Reconciliation runs `READ ONLY` with `1s`.
   - Called inside a read-write transaction, reconciliation leaves `txid_current_if_assigned()` NULL, so it allocated no transaction id and wrote nothing.
   - The catalog-derived 5 s hoist cancels a 6 s stalled write at about 5.1 s (`57014`). The whole attempt rolls back, including its attempt charge. A later read returns `unresolved`.
3. **In-flight write.** A write that holds the policy row, the advisory key lock and an uncommitted raw row is read as `unresolved` in under 500 ms, without blocking. After its late commit, the same read returns `committed` with the writer's receipt ID.
4. **Legacy coexistence.** A raw row written directly by a legacy writer, with no controlled admission, is never acknowledged.
5. **Cross-scope borrowing.** A committed receipt cannot be borrowed by another source key, or by the CCC table, for the same post ID.

## O-1: TimeZone sensitivity (accepted SQL6 behavior, fails closed)

SQL6 and SQL8 build `input_row` with `to_jsonb(jsonb_populate_record(...))`, so `tweet_created_at` is rendered in the session `TimeZone`. Evidence: `evidence/independent-timezone-sensitivity.json`.

- Reconciliation under another TimeZone returns `unresolved`. It never returns a wrong `committed`.
- An exact retry under another TimeZone is stored as a held `same_post_variant` that requires review and uses one receipt slot.

Neither outcome is unsafe, and Supabase defaults to UTC. The rollout precondition is to confirm a constant UTC `TimeZone` on the PostgREST/service-role path, and to run any operator reconciliation under UTC. Normalizing the clock to UTC text would be a separately reviewed SQL change. It is not needed for this acceptance.

## R21 (P1 rollout gate, outside this increment): the pilot was not retain-only under the starter-board scheduler

The accepted policy says pending raw carriers remain pending and that processing needs separate cohort authority. However:

- `pages/api/internal/starter-board.ts` runs every minute (`vercel.json`). When `STARTER_BOARD_SCHEDULER_ENABLED` and `STARTER_BOARD_CAPTURE_ENABLED` are on (or the legacy `START_CHART_GAME_REVISIONS=true`), it calls `retryPendingLineSourceEvents()`.
- With the pilot's required `TWEET_CLAIMS_MODE=shadow` and no evaluation cohort, `update-line-sources` and `update-lines-ccc` then select every pending raw row of the current Eastern day. That includes rows the pilot retained.
- The demonstration shows 6 processor requests under full pilot configuration, and 0 only when capture is off. Capture also gates Starter Board compute and FORGE orchestration, so turning it off is not a clean workaround.

Correction: `../scheduler-retain-only-v1/CHECKPOINT.md`. The scheduler retry is skipped whenever any pilot flag, policy or stop is present. The fix is owner-tested; an independent review of that three-file diff is pending.

## Boundary and remaining gates

This review does not establish:

- that the deployed PostgREST hoists function `statement_timeout`. That needs PostgREST v12+ with the default `db-hoisted-tx-settings`, and an actual-transport proof.
- that POST to a STABLE function runs READ ONLY in the hosted version.
- hosted grants (service-role SELECT on the five read tables, `BYPASSRLS`, removal of default EXECUTE grants).
- the IFTTT applet's own timeout or retry behavior.

The client bound is 6 s for the write plus 2 s for the read, against `maxDuration` 240. The legacy no-pilot path keeps its old unbounded upsert. That path is documented default-off compatibility, not universal fencing.

No staging, commit, push, deploy, hosted DDL or query, policy registration, flag change, replay or dispatch occurred.
