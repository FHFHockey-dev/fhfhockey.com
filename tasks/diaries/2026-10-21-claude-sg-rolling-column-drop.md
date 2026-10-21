# S-G: drop 491 unread rolling columns (7.1, 7.4-prep, 2.2)

## Scope

- Task list: `tasks/TASKS/forge-projections/tasks-forge-projection-audit-streamlining-2026-10-21.md` (7.1, 7.4-prep, 2.2).
- TJ decision: drop `wide_unread` + `pruned_unread` + `diag_sweep_only.{wide,pruned}` from `rolling-column-inventory.json` (491 names).
- Local only. No migration apply, no ledger edit, no commit.

## Where

- Branch `octoberBranch`, HEAD `0ff219d25` at start.
- Files I own: `web/lib/supabase/Upserts/rollingDroppedColumns.ts` (new), `fetchRollingPlayerAverages.ts` + test, `rollingPlayerValidationPayload.ts`, three `web/scripts/check-rolling-player-*.ts` sweeps, `web/pages/trendsDebug.tsx` (only if a literal is dropped), `database-generated.types.ts` (rolling table only), new `supabase/migrations/*_drop_unread_rolling_columns.sql`.

## State

- Started 2026-10-21 ~18:21Z. Union recomputed: 491, no identity/runtime overlap.
- Done: module (generated from JSON), writer split (dropped keys deleted; dropped gp_pct_* prunable keys still go to deprecatedCompatibility and count in prunedFieldCount), 3 scripts (filter at the single call site), validation payload (comparison fields, family summary, legacy, support, on_ice_sv_pct saves when a companion is dropped).
- Tests: writer 68/68, validation 19/19 after updating pinned dropped names.
- No dropped literal in trendsDebug.tsx. Other web/ literal hits: writer `output.*` assignments (in-memory compute) and rollingPlayerPipelineDiagnostics.ts:652 `gp_pct_avg_all` (suspicious-output classifier over recomputed rows).

- Types: 1,473 lines removed (491 x Row/Insert/Update), 0 added, all inside the rolling table block.
- Migration: `supabase/migrations/20261021182935_drop_unread_rolling_columns.sql` (generated from the module; 491 clauses, one alter). Not applied, not in the ledger.
- `supportedBaselineMigration.test.ts` now lists it as unregistered (expected; also lists another session's `20261021210000_in_season_sandbox_billing.sql`).
- Requested suites: 76 files / 714 tests passed. eslint clean on 8 changed files.
- Offline cross-check: FORGE select clause, ranking fields, results-luck fields (155 names): 0 dropped.

- tsc (under the heavy lock, 10 GB heap): exit 0, no errors.

## Next

- Handed back to the caller: commit, release the writer change (7.2) before the drop, register and apply the migration with TJ (7.4), then reclaim space (7.3, pg_repack).

## Blockers / approvals

- Migration apply and ledger registration: later, by the caller with TJ.

## Gotchas

- `gp_pct_*` window columns are in the drop set; `deprecatedCompatibility` stays untouched per instruction.
- Other sessions edit `rollingMetricAggregation.ts`, `rollingWindowContract.ts` (uncommitted); don't touch.
