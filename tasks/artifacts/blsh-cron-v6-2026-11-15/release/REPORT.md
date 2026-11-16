# Release prep for the inert BLSH v6 candidate: report (2026-11-15)

**Offline only:**
- no tracked file in the canonical checkout was edited, and nothing was pushed;
- no database was touched, apart from disposable local PostgreSQL 15 clusters.

**Inputs:**
- origin/master `86c249382`;
- the v6 commit `6d4aba061`: 23 files, and its migrations equal the octoberBranch files `4e896a89…` and `920e3430…`;
- v5 `348a122d6`.

## Blocker: origin/master + `6d4aba061` does not compile

- **The cause:** v6's `adapter.ts` imports `withTlsObservation`/`TlsObservation` from `web/scripts/blsh/nativeProcessCaptureAdapter.ts`. On origin/master that file is pre-v5 (`0162fb52`) and exports neither.
- **Full scratch export** of master (`web`, `supabase`, `tasks/TASKS`, `functions`, `cms`, root `vercel.json`) + the 23 v6 files + the release files:
  - `npm run typecheck` gave **exit 2**, with 2 × TS2305 at `adapter.ts:8`;
  - `core.test.ts` failed 11/11;
  - `routeRehearsal.test.ts` failed.
- **Resolution:** Chef's decision (2026-11-15): the RC (c2b3bd24c) ships v5 (348a122d6) on top of origin/master, so v6 imports the observer from the v5 adapter unchanged, as reviewed. The verbatim copy is not used; its bytes are kept in release/fix-tls-observer/ for reference only. Option B was briefly applied in the working tree on TJ's "Fix the blockers"; Chef restored `adapter.ts` to `6d4aba061` and removed the copy.
  - a new `tlsObservation.ts` holding v5 adapter lines 14–73 **verbatim**;
  - `adapter.ts` imports from it: a one-line import change plus its header comment;
  - a new `tlsObservation.test.ts` pins the block's sha256 `c01da6d8…` and, where the v5 file is at `aa6237bd`, compares the bytes directly.
- **With option B:**
  - **master + v6 + B:** `npm run typecheck` **exit 0, 0 errors**; ESLint exit 0. Vitest: `tlsObservation` 1 passed + 1 skipped (expected on master), `core` 11, `routeRehearsal` 3, `handler` 9, `sourceDate` 5, `runtimeReceipt` 3, `writer` 3, `sink` 3, `requestContext` 2 + 1 skipped (reader folder untracked), baseline 21, `operational-route-auth` 72, `cron-audit-wrappers` 55, `vercel-ignore` 12, `nstBypassGuard` 4, `callerLifecycle` 12.
  - **`6d4aba061` + B:** `tlsObservation` 2/2 (direct v5 byte comparison included), `core` 11, rehearsal 3.
  - **Canonical working tree (octoberBranch) after applying B:** Vitest `tlsObservation` 2/2 (direct comparison runs), `sourceDate` 5, `runtimeReceipt` 3, `writer` 3, `sink` 3, `core` 11, `handler` 9, `requestContext` 3, `routeRehearsal` 3, `nstBypassGuard` 4, `callerLifecycle` 12, `operational-route-auth` 72. `npm run typecheck` exit 0, 0 errors; ESLint exit 0.
- **Option A** (ship v5's six `web/scripts/blsh` files to master) is not recommended. It brings the laptop pilot's bootstrap and runner tests, which fail in fresh exports (19 × `bootstrap_wrong_checkout`).

## Deliverables

1. **Rollbacks** (`supabase/tests/…`, to be copied into the RC):
   - `blsh_native_capture_v6_rollback.sql`: drops every object except the empty private bucket, which Supabase refuses to drop over SQL and which re-apply accepts. It refuses while packet bytes remain.
   - `blsh_request_context_v1_rollback.sql`.
   - **Proof:** `proof/rollback_roundtrip.py` passes **15/15**: apply, a refusal while bytes remain, rollback, rollback again (a no-op), and re-apply to a byte-identical catalog snapshot.
2. **Authority:** a patched copy of master's `migration-authority.json`, adding orders 153 and 154: pending, feature, source-authorized, with a rolloutGate and stateEvidence in the style of 150–152. The diff is +20 lines, with no other change; it round-trips byte-exact.
3. **Baseline test:** a patched copy of master's `supportedBaselineMigration.test.ts` (154 rows; 118 applied, 28 unknown and 8 pending).
   - **Also required:** a patched `tasks/TASKS/super-goal/super-goal-final-summary.md`, because the test checks its authority sentence. It now says 154, and one sentence is added; the diff is 1 changed line.
   - **Results:** 21/21 in the export. Master's unpatched test fails 20/21 with v6 present, as the control.
4. **`PREFLIGHT-AND-APPLY.md`** with `sql/preflight.sql`, `apply-153.sql`, `apply-154.sql`, `readback-153.sql` and `readback-154.sql`.
   - The migration files carry their own `begin`/`commit`, so the apply runs **only the body** inside one transaction with the ledger insert. A step checks that the reassembled file equals the original hash.
   - **Rehearsed** by `proof/rehearse_apply.py`, **17/17**: through `psql` 15 as a non-superuser owner, under baseline default privileges. Every documented expected line matched exactly. When the ledger insert fails, the whole apply rolls back and nothing is left.
   - The readbacks include the bucket privacy assertion and the EXECUTE grants.
5. **`GATE.md`:** the exact commands and expected counts for the clean export, the blocker and the file placement map.
