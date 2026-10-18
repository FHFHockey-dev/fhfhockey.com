# S-20 notes (2026-10-18, local only)

## 1. `persistCapturedGameNormalization` declaration
- I added `CapturedGameNormalizationArgs` and `persistCapturedGameNormalization(supabase, args): Promise<NormalizationReceipt>` to `web/types/nhlRawGamecenter.d.ts`.
- The argument types follow what the function actually reads:
  - `pbp` is passed to `normalizeRosterSpots` and `normalizePbpEvents`, so it is a `PlayByPlayPayload`.
  - `shiftPayload` is passed to `normalizeShiftRows`, so it is a `ShiftChartsPayload`.
  - The return value is `persistNormalizedGameScope`'s receipt.
- With the declaration in place, `sweep-gamecenter-normalization.ts` type-checks. `ingest-projection-inputs.ts` now fails with two real argument-type errors instead of the missing export:
  - `PbpResponse` lacks `rosterSpots`.
  - `NhleShiftRow` lacks `id`.
- Both objects are unmodified provider JSON at runtime: `fetchPbpGame` comes from `nhleFetchJson`, and the shift raw payload is the concatenated API pages. So the gap is in the local projection types, not the data.
- The proposed caller patch is `ingest-projection-inputs.caller-types.patch` in this folder. It is **not applied**, because that file is outside S-20.
- With the patch applied to a temporary copy, the scoped `tsc` over both routes, the declaration and all S-20 files exits 0.
- Residual runtime caveat: the normalizers fall back to `?? []`. A payload without `rosterSpots` would normalize zero roster rows rather than throw. Whether the RPC rejects that was not checked.

## 2. Rankings reader
- The `entityIds`/`limit` database pushdown was **not restored**. It is unsafe since `a5ba66196`: the reader re-ranks the full snapshot cohort under the request's minimums, so filtering or limiting in the database shrinks the cohort and changes ranks. The existing tests pin this ("reranks the complete snapshot cohort…", "preserves cohort ranks when selecting a single displayed entity").
- Safe pushdown applied instead: player and team metadata are hydrated only for the rows actually returned. Surfaces are built once without metadata, then rebuilt after hydrating the returned ids. Ranks and sort order never read metadata.
- New test in `entityMetricRankingReader.test.ts` pins three things: no `entity_id` filter or limit on the rankings query, the `players` filter is `[3]`, and the `teams` filter is `[11]`.

## 3. Debug route strength
- `pages/api/v1/debug/rolling-player-metrics.ts` now accepts `all`, `5v5`, `ev`, `pp` and `pk`. A missing or empty value defaults to `all`, and any other value returns 400.
- `5v5` is a first-class strength in the rolling pipeline: `STRENGTH_CONFIGS`, the `nst_gamelog_5v5_*` tables, and `byStrength` in the validation source.
- Three tests were added to `__tests__/pages/api/v1/debug/rolling-player-metrics.test.ts`.

## 4. PP select-list guard
- `skaterWindowAggregation.test.ts` asserts that every `pp_points_*` and `pp_toi_seconds_*` window input is in `ROLLING_RANKING_SELECT_FIELDS`.
- A Proxy records every row field the aggregator reads across all five strengths and all windows, and the test requires each one to be selected.

## Checks run
- Vitest on the reader, aggregation and debug-route test files: 47/47.
- Vitest on the reader consumers (`playerMatrix`, `rankingQueries`): 43/43.
- Scoped `tsc` (S-20 files, the declaration and both routes): only the two ingest caller errors remain; exit 0 with the caller patch.
- Full-project `tsc` was not run.

## Follow-up (Chef granted `ingest-projection-inputs.ts` for this fix)
- The caller patch is now **applied** to `web/pages/api/v1/db/ingest-projection-inputs.ts`, cleanly with `git apply`; the file was clean against HEAD before.
- `__tests__/pages/api/v1/db/ingest-projection-inputs.test.ts`: 28/28 pass.
- Full `npx tsc --noEmit` from `web/`, behind `/private/tmp/fhfh-heavy.lock`:
  - The first run aborted with a JavaScript heap out-of-memory error (exit 134) before reporting any errors.
  - The rerun with `NODE_OPTIONS=--max-old-space-size=12288` exited 0 with **zero errors**.
  - The lock was released both times.
