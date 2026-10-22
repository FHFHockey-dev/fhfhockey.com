# NST continuation R1 independent review

**Qualified acceptance for local integration of the five pinned files. NST-R1 and NST-R2 are fixed; no new blocking defect was demonstrated.** This supersedes the R0 rejection for these new hashes only. Production rollout, recovery of existing rows and the active backfill are not approved or verified here.

## Findings resolved

**NST-R1: durable hold cannot be erased by a stale invocation.** The optional guard in `web/lib/projections/projectionPipelineState.ts:375` runs against the freshly parsed row whose revision is supplied to the existing acquisition RPC. The NST-specific guard in `web/lib/rollingForgePipelineRunState.ts:187` rejects `failed / nst_persistence_unconfirmed` before any transition. If state changes after the read, the existing SQL's revision check rejects the old revision while holding the operation's transaction/row lock. The guard does not re-read into an unguarded new revision.

The original same-version interleaving now passes unchanged: the first invocation durably holds; the second returns manual review, retains the marker and does not call NST. A new independent test also changes the persisted row to a newer hold after the acquisition read has returned its older handoff snapshot. The actual in-memory RPC rejects the stale revision, the hold survives, no NST call occurs, and the next invocation returns manual review. This supplements the owner's shared-helper test, which supplies an RPC mismatch response directly.

**NST-R2: manual-review response and later admission survive a failed hold write.** The route sets terminal `manual_review_required / resumeRequired: false` before awaiting persistence (`run-rolling-forge-pipeline.ts:1478`). The catch preserves it and adds the state-write diagnostic. The original failed-write oracle now passes unchanged, including the later invocation: NST is called only once and WGO remains untouched.

The later safety condition is the existing, acknowledged acquisition row written before child execution. Any existing `running` upstream stage is denied acquisition: an active lease returns in-progress; an expired or missing expiry returns manual review. The route excludes this stage from automatic kill-count/closure transitions (`:1294`), so a retry cannot erase that intent through the previous recovery path. A lost acquisition acknowledgement also does not start NST; its persisted running row requires review later. These claims assume the existing row/RPC is durable and all participating pipeline workers use the guarded code.

## Recovery and regression boundaries

- A saved `failed / stage_handoff` row remains resumable with the stored monotonic cursor and a refreshed deadline. The unchanged three-invocation consumer and producer tests still pass; WGO waits for completion. A completed stage remains terminal.
- Handoff acknowledgement loss is handled according to actual persisted state. The new independent tests simulate both outcomes: when the handoff transition committed, a later confirmed state read resumes cursor 15; when only the cursor checkpoint committed and the handoff did not, the stage remains running and requires manual review. Neither path silently repeats from the older cursor.
- Ordinary acknowledged, non-ambiguous NST failures still retry once and then stop. Other stages retain their existing abandoned-worker/kill-count handling. The new shared helper callback is optional, and the NST stage is its only application caller; the acquisition RPC arguments, receipt validation and default behavior are unchanged.
- The conservative hold applies to the whole `upstream_skater_sources` stage. A worker killed before its first NST request, after an acknowledged NST result but before handoff/finish persistence, or during later WGO work can require review. That loss of automatic recovery is an intentional operational tradeoff, not a guarantee that every held run performed ambiguous writes.
- Precision on malformed data: a missing expiry reaches the manual-review guard. A malformed non-null timestamp is rejected earlier by existing receipt parsing and returns fail-closed `state_error`, rather than necessarily the manual-review label. It still cannot acquire or execute NST. A real timestamp column cannot contain an arbitrary malformed string; this does not reopen either safety finding.

The producer contract, malformed-continuation rejection, frozen source bounds, deadline reserves, source-down degradation and coverage limitations remain as reviewed in [R0](../REVIEW.md). The original seven-case fixture is byte-for-byte unchanged, including its two previously failing cases. R1 has not changed the producer, request budgeting, authorization wrappers, cron schedules or source-down policy.

## No schema change required

The complete incremental diff contains exactly three implementation files and two tests. There is no SQL, schema, migration, generated type or RPC signature change. The callback is an application-side check; the persisted evidence is the existing status, last-error, cursor, owner, expiry and revision fields. The inspected existing `advance_projection_pipeline_state_v1` definition takes an operation lock, reads the row for update, and checks `p_expected_revision` before updating (`supabase/migrations/20260720105524_add_projection_materialization_transactions.sql:3936–3995`).

That supports the **no new schema required** claim against the repository's RPC contract. No database was queried, no deployed RPC version was inspected, and no SQL concurrency test was executed. It is not proof of the current production installation. The prior quiescent/version-consistent rollout gate remains required: old workers and independent direct NST runners do not use this application guard.

## Exact reviewed hashes

| Path | SHA-256 |
|---|---|
| `web/pages/api/v1/db/run-rolling-forge-pipeline.ts` | `ffe7e16c782987fdfec19f8b1e787a89a76aed0a2739994ec5f80eb9488f97b1` |
| `web/__tests__/pages/api/v1/db/run-rolling-forge-pipeline.test.ts` | `1137a449405ec993cb8440395311cc199251fd6da87508469390ffc0ff8f8227` |
| `web/lib/rollingForgePipelineRunState.ts` | `6ce1bab745bb6fa870b7aeb717c61b2470072db3645047e48006ea53304d2d38` |
| `web/lib/projections/projectionPipelineState.ts` | `288eaf8e8add181cf23290fda001409d001980aec53f49d96d4164b49e716b8f` |
| `web/lib/projections/projectionPipelineState.test.ts` | `bcfe0ea75668c7cca0d40346d8f901d123d5e7f190c2392bd4b2a5ed79e9b124` |

Archive SHA-256: `0204013426c5702b1fcd87cf0db9ec8d0919b2a4d2601945ad1d9d8a98e9ac25`. All **3,357 archived files** were verified before execution; five canonical candidate files and seven dependency fences match the tested snapshot at start and finish. The saved R0 baseline hashes match, and the independently generated [R1 diff](reviewed-r1-diff.patch) equals the owner's patch exactly. See [start integrity](start-integrity.json), [end integrity](end-integrity.json) and [reviewed hashes](REVIEWED-HASHES.json).

The canonical `octoberBranch` HEAD moved during review from `d3f057c6c849d5d5474bc912a6f461f617c65b15` to `716896be8325a64f5cbd3ece9a1fdab48c50733f`. This reviewer made no commit or branch change. All five candidate and seven dependency hashes still match; acceptance is scoped to those bytes, not the other concurrent work or a combined release tree.

## Checks actually run

Fresh nested source-only scratch extraction; Node **v22.11.0**, npm **10.9.0**; synthetic configuration; sockets, HTTP(S) and unmocked fetch denied; existing dependencies reused without installation. Extraction rejected links, special files, unsafe paths and env files. Only scratch cache location and separate review fixtures were added/adjusted. All five candidate source/test files and the old reviewer fixture stayed unchanged.

| Independent check | Result |
|---|---|
| Pipeline suite | **56 passed** |
| Unchanged real producer suite, mocked transport/database | **101 passed** |
| Shared lease helper suite | **9 passed** |
| Unchanged R0 reviewer suite | **7 passed**, including both old failures |
| New R1 fencing/recovery suite | **8 passed** |
| ESLint on all five changed files | Passed, exit 0 |
| Scoped diff whitespace; incremental/cumulative patch provenance; final byte integrity | Passed |
| Full TypeScript | Not rerun; owner records a passed nonincremental check |

**181 executed passing cases**, including the two original reviewer cases also copied into the pipeline suite; this count is not a claim of 181 distinct scenarios. No failed check remains. [Four-suite receipt](four-suites.json), [log](four-suites.log), [additional receipt](additional-oracles.json), [additional log](additional-oracles.log), [fixture](auditNstR1Additional.test.ts), [lint receipt](scoped-lint.json). No network-denial failure occurred. Existing mocked offseason-fallback and punycode warnings remain.

The in-memory state harness models the relevant revision/owner transitions; it does not execute Postgres transactions, actual server crashes or database durability. Tests establish the application admission behavior and no-replay guard under the modeled failures, not exactly-once source writes.

No application source edits, real DB/NST/network requests, secret access, installs, builds, commits, migrations or deployments occurred in this review. TJ's production `/db` backfill was not inspected, contacted or controlled. Billing/stats work is untouched. No tool action was denied, pending or externally uncertain. Local review is complete; combined-candidate pinning, version-consistent rollout and authorized operational recovery remain separate work.
