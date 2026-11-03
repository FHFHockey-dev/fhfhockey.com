# Rolling validation 5v5 — resolved in current source

The previously identified valid `5v5` filtering defect is already repaired in the current canonical checkout. No application or test source was changed, and no duplicate repair was prepared.

- `web/lib/supabase/Upserts/rollingPlayerValidationPayload.ts:651–655` recognizes `5v5`; `filterRowsForRequest` at :689 retains its rows, and `getRowKey` at :668 preserves that strength for comparisons.
- Existing `web/lib/supabase/Upserts/rollingPlayerValidationPayload.test.ts:1205` parameterizes all/ev/pp/pk/5v5 through actual writer splitting, stored hydration, filtering and mismatch comparison. It also rejects4v4. This test source was inspected, not executed this turn.
- Debug API `web/pages/api/v1/debug/rolling-player-metrics.ts:24–53` retains the explicit5v5/unsupported-strength contract.

Fresh offline command: `node tasks/artifacts/rolling-validation-5v5-recheck-2026-10-28/recheck.cjs` — final exit0, **8 checks passed**, Node22.11.0. The checks execute exact AST-extracted current filtering, row-key, comparison and route-strength functions with synthetic fixtures in a VM. Whole application modules, route handlers, hydration/storage clients and environment loaders are not imported. All five captured current-file hashes remained unchanged. See `RESULTS.json` for source symbols, line numbers, hashes, expected values and observations.

The checks show all five admitted strengths retain exactly their selected row and report a deliberately different recomputed value as a mismatch; unsupported4v4 is rejected; season/team/date restrictions remain intact; zero stays distinct from null or missing. Resolved hydration work was not repeated.

Attempt1 failed before completed test results because this artifact harness omitted the `isLegacyField` dependency of comparison metadata. Its exact declaration was added to the extraction and the corrected run passed. `ATTEMPT-1.json` preserves that failure separately from application behavior.

Focused Vitest was **never started**: `/private/tmp/fhfh-heavy.lock` was occupied by **Codex Scout V63 sprint**, PID91323, token recorded in `CHECKPOINT.json`. The lock was not acquired, changed, removed or bypassed for a package/heavy check. No fresh Vitest, lint, TypeScript, full-suite or build pass is claimed. A narrow standalone source-function probe completed without that shared heavy resource.

Repository AGENTS and current Codex/Claude coordination leases were inspected; no exact target-file claim was found. Since the defect was already fixed, no source custody was taken. No Git operation, source edit, credential read, DB/provider/network request, refresh/backfill, production change, push, deployment or deletion occurred. No operation remains active or uncertain. The shared register was not edited.

Parent disposition: reconcile the stale open local finding to the existing fix using this checkpoint. Production/release status is outside this check. There is no further implementation work for this defect; any desired fresh package regression can use `cd web && npm test -- --run lib/supabase/Upserts/rollingPlayerValidationPayload.test.ts -t "retains compacted"` after the shared lock is released and the test runner's offline environment is confirmed.
