# NST continuation independent review

**Request changes before accepting local continuation enablement.** The original producer-pairing requirement is satisfied by the reviewed code, and all 155 existing tests pass independently. Two review-only safety oracles reproduce gaps in the new manual-review behavior. Production, migration, recovery and release approval remain outside this review.

## Findings

**NST-R1 — P1: enforce the manual-review hold at lease acquisition, not only against the initial run-state snapshot.**

At `web/pages/api/v1/db/run-rolling-forge-pipeline.ts:1228`, the new hold check uses the map fetched once at invocation start. Another invocation can read that map while the first invocation owns NST, pause, and continue after the first invocation has durably written `failed / nst_persistence_unconfirmed`. The second invocation passes the stale check and calls `acquireRollingForgeStage` at line 1357. `acquireProjectionPipelineLease` freshly reads the held row, treats every failed row as resumable, and acquires it with `lastError: null` (`web/lib/projections/projectionPipelineState.ts:355–392`). The hold is erased before the route has another opportunity to inspect it.

The independent fixture runs this interleaving with two same-version route invocations. The first returns `manual_review_required`, and the test confirms the hold is durably present before releasing the second invocation. The second then calls NST again; with a successful mocked child response, it runs WGO/downstream and leaves the stage complete. Observed NST calls: **2; expected: 1**. No database failure, expired lease, old worker or mixed-version deployment is needed. A quiescent rollout does not prevent later same-version overlap.

The existing SQL permits acquisition of a failed row and protects revision/owner consistency, not the meaning of `last_error` (`supabase/migrations/20260720105524_add_projection_materialization_transactions.sql:3993–4049`). Since the helper reads the current revision immediately before acquisition, optimistic revision checks do not prevent this interleaving. Carry the nonretryable state check into the acquisition path against the same revision used for the transition, preserving the hold and returning a manual-review result. Add this interleaving as regression coverage. This can be addressed in application code; this review does not request or authorize a migration.

**NST-R2 — P2: keep the manual-review response when its state write fails.**

At `web/pages/api/v1/db/run-rolling-forge-pipeline.ts:1464–1493`, `reviewCode` is discovered before `finishRollingForgeStage`, but terminal/manual-review termination is assigned only after that awaited write succeeds. If the write fails, the shared catch returns `continuation_required / state_error / resumeRequired: true`. The row remains running without a hold, and a later invocation counts an expired lease and calls NST again.

The independent fixture supplies `writePersistence: not_confirmed`, rejects only the hold transition, and then invokes the route ten minutes later. The first response advertises a retry and the second invokes NST again. The child implementations are mocked; the subsequent WGO/complete response demonstrates the consumer's admission path, not actual duplicate provider/database execution. The real producer may reject a saved cursor against a blocked audit. In the lost-audit case, however, a prior acknowledged audit can still be the latest available receipt, so producer replay protection is not a general substitute for the consumer's hold.

The owner report already discloses that a failed state write cannot ensure a durable hold. That limitation should remain explicit, but it does not justify returning an affirmative automatic-retry receipt for a known uncertain operation. Set the manual-review response independently of storage success and attach the state-write failure as a diagnostic. Durable protection across a lost hold still needs an explicitly reviewed recovery/admission design or an enforced operational gate; this receipt does not claim that changing the response alone solves process death or storage loss.

Both failing oracles and observed receipts are preserved in [independent-oracles.log](independent-oracles.log); the complete executable fixture is [auditNstIndependent.test.ts](auditNstIndependent.test.ts), with reviewer-authored cases in [independent-oracles.ts](independent-oracles.ts).

## Contract and hold review

- Read the original cross-platform consumer agreement and integer amendment, producer confirmation/delivery receipt for D1 `e89dfdde58d2ce848947ab493710237223dcd440`, and the original [A1–A4/A6 independent review](../forge-ledger-lease/REVIEW.md). The original inactive flag represented producer release pairing and review, not an independent prohibition on resumability. The original quiescent/new-run and real-database concurrency gates remain open.
- The actual producer writes and checks its progress audit before returning 207. It returns the original query plus a string integer cursor, only after an acknowledged prefix increases. Its exact-scope identity excludes the invocation deadline, and replay consults latest acknowledged progress. The real producer's existing three-invocation test passes 7+7+6 URLs; old and completed cursors make no repeated acknowledged source requests. Original-plan pacing survives a short resumed suffix.
- The consumer checks boolean `success: false`, `continuation_required`, confirmed nested audit persistence, exact query keys/values including the sent deadline, and a strictly increasing positive safe-integer string cursor. Missing/changed scope, arrays, unsafe/numeric cursors and non-increasing progress do not advance the cursor or call WGO. A legitimate 200 requires boolean success and no contradictory continuation/error status.
- Cursor handoff calls the existing lease transition helper, which validates the exact RPC receipt, then releases the stage with `stage_handoff`. Deliberate handoff consumes no failure attempt or killed-worker count. A rejected cursor write returns state error and does not call WGO. Ordinary failures retain the two-attempt cap; existing A6 ownership/kill tests pass. This is offline state-machine evidence, not actual Postgres execution.
- Implicit requests use the previous Eastern calendar date for both source bounds. Explicit start/end now pass through to NST. Fresh invocations replace the deadline while preserving scope; the pipeline reserves 20 seconds, and the producer reserves a further five seconds inside that deadline. The new UTC-midnight review oracle passes.
- WGO waits on valid partial continuations and runs after completion. Existing source-down handling is preserved: recognized unresolved-source responses may complete the stage with `nst_source_unavailable`, including after a continuation. This remains degraded completion, not complete NST coverage. Uncertain persistence is checked before this exception. A stored manual hold survives ordinary sequential invocations and `stopOnFailure=false` cannot bypass the immediate hold; the two findings concern paths not covered by those sequential tests.

## Exact boundary and verification

The three reviewed source/test hashes are:

| Path | SHA-256 |
|---|---|
| `web/pages/api/v1/db/run-rolling-forge-pipeline.ts` | `fb3bab85f30f5f54eaeeef44308d4b2a21b5ba1b2ffaf8fbc15841edd6d763c3` |
| `web/__tests__/pages/api/v1/db/run-rolling-forge-pipeline.test.ts` | `db28d9339a8268dba92d1eec8e38e8aeafda786e5f8dbe85e9d3f8748382f2dd` |
| `web/lib/rollingForgePipelineRunState.ts` | `16ffb690accaf32e5d81c66748e115e371b43203b90eef6f0ce14378089c7fe0` |

The source-only archive SHA-256 is `6cb9bd758692c6163cae88a46249b7dfeda03a8ad87187442ae18c00700dc75e`. All **3,356** archived file hashes were verified before execution. Extraction rejected absolute/parent paths, links, special files and env files. All three canonical candidate files and eight dependency fences match the tested archive. The three saved accepted-baseline hashes match, and an independently generated diff equals the owner's patch exactly: [base-comparison.json](base-comparison.json), [reviewed-owned-diff.patch](reviewed-owned-diff.patch).

Tests ran from a fresh nested scratch extraction with Node **v22.11.0**, npm **10.9.0**, only synthetic configuration, and a socket/HTTP(S)/unmocked-fetch denial guard. Existing dependencies were symlinked; nothing was installed. Only the scratch Vitest cache path was adjusted and a separate reviewer test file added. Candidate source and original tests were not modified. The new fixture reuses the owner's transport/lease harness prefix and adds deterministic barriers; it exercises real route and lease-helper implementations. The harness omits SQL's expired `advance`/`complete` rejection, but neither finding depends on accepting either expired transition.

| Independent check | Result |
|---|---|
| Existing pipeline suite | **54 passed** |
| Unchanged real producer suite | **101 passed** |
| Reviewer safety and contract cases | **5 passed, 2 failed** — the two findings above |
| Scoped canonical diff whitespace check | Passed |
| Archive, baseline, patch and final source/dependency integrity | Passed; see manifests |
| TypeScript/scoped ESLint | Not rerun; owner reports passed. This review does not relabel those as independent checks. |

Receipts: [existing-suites.json](existing-suites.json), [existing-suites.log](existing-suites.log), [independent-oracles.json](independent-oracles.json), [start-integrity.json](start-integrity.json), [end-integrity.json](end-integrity.json), [REVIEWED-HASHES.json](REVIEWED-HASHES.json). No network-denial error occurred. Existing mocked offseason-fallback and punycode warnings appear in the logs.

No source edits, production/NST/network requests, secrets, installs, migrations, commits, pushes, builds or deployments were performed. Other workers' billing/stats changes were preserved and are outside this review. No tool action was denied or awaits approval; no external outcome is uncertain. **The remaining blockers are the two reproduced review findings and the previously held rollout/concurrency gates.**
