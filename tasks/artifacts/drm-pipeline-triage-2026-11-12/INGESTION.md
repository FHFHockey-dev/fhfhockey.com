# Shift ingestion triage

Initial source audit on `octoberBranch`, observed HEAD `ca06cbf6c7ee6dcdb9e54e1f610ac109a8eb8de8`, 2026-11-12; subsequently authorized local remediation is recorded below. No remote queries, ingestion execution, or builds. Runtime confirmed from this worker's matching turn context: `gpt-6.1-sol/high`. Chef owns live evidence and adjacent calculation review. Line references in the initial audit describe the pre-fix source.

## Finding: projection source deduplication differs from raw normalization

**Verified locally; warrants a focused correction independent of scheduling.**

`web/lib/supabase/Upserts/nhlRawGamecenter.mjs:792–807,837–857` canonicalizes by player/team/period/start/end/type, retaining the lowest source row ID. `web/lib/projections/ingest/shifts.ts:404–419` additionally includes `shiftNumber` and `duration` in its duplicate identity. Consequently, two copies of the same interval with different shift numbers, or equivalent duration strings (`00:30` / `0:30`), count once in normalized raw storage but twice in projection inputs. The latter feeds strength totals and relationship calculations. `buildShiftStrengthUpserts` adds each interval at `shifts.ts:644–759` without detecting overlap.

Executed an isolated Node probe against the actual raw selector and the transpiled projection module's dependency-free `buildShiftSnapshotFromRawPayload` (all module imports blocked; no provider/database effects):

| Input pair | Raw canonical rows | Projection rows |
| --- | ---: | ---: |
| Identical interval, differing `shiftNumber` | 1 | 2 |
| Identical interval, duration `00:30` / `0:30` | 1 | 2 |
| Partially overlapping intervals | 2 | 2 |

Smallest remediation proposal: normalize projection interval identity consistently before strength or relationship derivation; ignore source row ID/shift number for identical intervals, compare clock values semantically, and refuse contradictory duplicate metadata/durations. Preserve the unmodified raw envelope. Reject partial per-player/period overlap before publishing derived totals rather than silently adding overlapping seconds. Extend the existing `shifts.test.ts` with duplicate-number, equivalent-clock, contradictory-duration, and overlap cases; coordinate endpoint overlap handling with the calculation owner. No raw SQL/schema rewrite is required merely to prevent duplicate projection counts. No evidence supplied establishes this anomaly in game `2026020298`; this is a separate reproducible invariant gap.

## Actual lineage and staging behavior

| Boundary | Evidence | Result |
| --- | --- | --- |
| Route alias | `web/pages/api/v1/db/update-nhl-shift-charts.ts:5–12` | Creates the shared raw Gamecenter route, with admin/audit wrappers. |
| Selection/execution | `nhlRawGamecenterRoute.ts:449–455` | Calls raw-game ingestion; a single game throws on failure, multiple games report partial failure. |
| Provider capture | `nhlRawGamecenter.mjs:601–648,1274–1329` | Fetches PBP/boxscore/landing/shifts, validates mixed/truncated shift feed before writes, then stores four immutable snapshots sequentially. |
| Raw normalized storage | `nhlRawGamecenter.mjs:1248–1270`; `supabase/migrations/20261109034000_gamecenter_normalized_v2_shift_dedupe.sql:719–724,726–983` | Transactionally replaces game-scoped roster/event/shift rows and status via v2 RPC; no `shift_charts` reference in this migration. |
| Projection source normalization | `shifts.ts:300–436,519–538` | Strict paginated live read or manifest-bound stored snapshot; preserves raw duplicates and separately returns sorted projection rows. |
| Initial aggregate rows | `shifts.ts:725–770,925–927`; `supabase/migrations/20260720105524_add_projection_materialization_transactions.sql:1760–1827` | Identity + strength totals are inserted into `shift_charts`; `game_toi`/`game_length` are deliberately omitted. |
| Relationship invalidation | Same transaction migration `1837–1859` | Changed projection inputs explicitly clear relationship-owned fields, including `game_toi`/`game_length`. This is intentional stale-derived-data invalidation. |
| Schema contract | `supabase/migrations/20260716112908_production_schema_baseline.sql:25019–25056` | Relationship clocks/arrays are nullable. New strength-only rows therefore have null relationship clocks until relationship materialization succeeds. |

Chef's live diagnostics explain the concrete null rows: relationship job runs 07:45 UTC, ingestion runs 09:45 UTC; later ingestion inserted 229 strength-only rows for six games `2026020293..2026020298` with input complete and relationships pending. Chef also reports 277 relationship-complete games since October 1 have parseable, non-null clocks. This worker did not independently query live services. The scheduling/reader-eligibility fix belongs to Chef; null staging fields themselves do not warrant changing ingestion to invent relationship values.

## Invariants and failure ordering

- Raw snapshots use `(game_id,endpoint,payload_hash)` with `ignoreDuplicates:true` (`mjs:669–676`); rerunning the raw route does not directly overwrite relationship clocks.
- The four captures are not one cross-endpoint transaction. A later capture/normalization failure can leave earlier raw snapshots stored; head invalidation/status prevents treating an unnormalized generation as complete. `ingestNhlApiRawGame:1287–1342` returns success only after normalization receipt validation. The capture retry only retries the specific pre-commit writer-busy rejection (`1217–1238`), not arbitrary errors.
- Raw validation rejects off-game IDs, unknown game teams, missing row IDs, and a finished game's team/period tail more than 10 seconds before the final PBP event (`819–893`). It retains markers separately by `typeCode`. It does not union/reject partially overlapping player intervals; downstream derivation must enforce that invariant.
- Projection strength derivation filters type 517 (`shifts.ts:581`), rejects inconsistent player/team metadata (`606–621,744–755`), validates final PBP timeline and positive interval clocks (`107–280,655–686`), and accepts the documented zero-end sentinel only when duration reaches the played period end (`665–670`). Source normalization itself does not change the raw end clock. The calculation owner is checking use of that sentinel downstream.
- Standalone strength replacement invalidates only `total_es_toi/total_pp_toi/total_pk_toi` before upsert (`911–928`); it can leave strength totals incomplete on replacement failure. The transactional projection-input path is the intended stronger boundary. Neither behavior proves data corruption from the raw route.

## Verification

Passed:

```sh
cd /Users/tim/Code/fhfhockey.com/web
npm test -- --run lib/supabase/Upserts/nhlRawGamecenter.test.ts lib/projections/ingest/shifts.test.ts -t 'shift payload validation|rejects premature short pages|invalidates only strength-owned|fails closed when strength invalidation'
```

Result: 2 test files passed; 19 tests passed, 58 skipped. Existing mocks cover raw duplicate selection and mixed/truncated/pagination refusal, projection pagination/exact duplicates, and ownership-limited invalidation/failure ordering. The isolated normalization probe above also passed and exposed the untested differing-number/duration duplicate cases.

Not run during initial audit: live provider/database queries, ingestion, SQL integration execution, full suite, type check, lint, builds, deployment. Mock tests do not establish deployed SQL or source completeness.

## Authorized local remediation

Chef's subsequent live diagnostics found four overlong goalie aggregates associated with duplicate/overlapping source intervals (Woll game `2026020009`, Saros `2026020115`, Kuemper `2026020159`, Cossa `2026020205`). Chef therefore selected **physical interval union**, superseding this report's initial proposal to reject partial overlaps.

- Added exported `buildCanonicalShiftIntervals(gameId, pbp, shiftRows): NhleShiftRow[]` in `web/lib/projections/ingest/shifts.ts`. It validates final-PBP identity/timelines, both teams, consistent player metadata, every source duration and played-period bounds before merging. Zero-end sentinels resolve to the validated played-period terminal. Overlapping/touching intervals union within player/team/period; clocks are formatted consistently and gaps remain separate. The representative shift number is the minimum within the union.
- `buildShiftStrengthUpserts` and `buildShiftRelationshipStrengthSegments` use the unions. The route owner separately integrates the helper into game/pair TOI arithmetic.
- Kept `buildShiftSnapshotFromRawPayload` and immutable raw envelopes unchanged. Calculation canonicalization does not mutate snapshot rows or the source hash contract. Root owns algorithm-version/invalidation analysis.
- Extended existing `shifts.test.ts` with four synthetic whole-game fixtures matching the observed duplicate/nested goalie shapes, a mixed-strength partial-overlap fixture, and source-preservation/order/idempotence/gap/invalid-duration checks.

Regression evidence: before implementation, the valid whole-game synthetic fixtures produced `68:40`, `70:00`, `71:07`, `66:54` versus their union expectations `63:23`, `65:00`, `62:43`, `63:27`. These synthetic totals are not claims about the exact live goalie minutes. The partial-overlap fixture counted PP `1:00` versus physical union `0:30`. All now pass, with one relationship segment per whole-game period in the goalie fixtures.

Final lane verification passed:

```sh
cd /Users/tim/Code/fhfhockey.com/web
npm test -- --run lib/projections/ingest/shifts.test.ts lib/projections/ingest/shifts.storedSnapshot.test.ts lib/projections/ingest/projectionInputPersistence.test.ts
npx eslint lib/projections/ingest/shifts.ts lib/projections/ingest/shifts.test.ts --report-unused-disable-directives-severity warn
```

Result: **47 tests passed across 3 files**, scoped ESLint passed, and `git diff --check` passed for the two application files. No full suite, type check, build, SQL integration, or remote execution in this lane. No source rows or existing production aggregates were rewritten. Uncommitted owned application changes: `web/lib/projections/ingest/shifts.ts` and `shifts.test.ts`; report and diary also updated. Chef must integrate/review the route change and decide any later bounded repair/deployment separately.

## Actual HTML overtime ingestion defect and correction

Root's independent official-report replay found a separate source-loss defect: `parseHtmlShiftReportRows` accepted only digit-only period labels, so it silently skipped real `OT` rows. Root observed this in the actual local reports `/tmp/drm-TH020009.HTM`, `/tmp/drm-TV020009.HTM`, `/tmp/drm-TH020205.HTM`, `/tmp/drm-TV020205.HTM`; the two whole-game goalie rows lost203/207seconds. This lane did not independently rerun root's190-player official oracle.

Implemented the smallest shared-parser correction in `web/lib/supabase/Upserts/nhlRawGamecenter.mjs`: numeric period labels retain their existing mapping; `OT` maps to4, `2OT` to5, and subsequent positive overtime ordinals follow the same mapping. A numbered physical-shift row with an unrecognized/nonpositive/unsafe period now throws in strict mode instead of silently disappearing. Headers and total rows with nonnumeric shift numbers remain ignored. Both projection and Gamecenter writers share this parser; no independent fallback implementation was introduced.

Added existing-file regressions in `web/lib/projections/ingest/shifts.htmlFallback.test.ts`: regular OT retained with correct clocks, playoff2OT retained as period5, and an unknown period on a numbered shift refuses the strict report. Before implementation, both overtime tests returned2rows instead of4 and the invalid-period test did not throw. All now pass.

Verification:

```sh
cd /Users/tim/Code/fhfhockey.com/web
npm test -- --run lib/projections/ingest/shifts.htmlFallback.test.ts lib/supabase/Upserts/nhlRawGamecenter.test.ts --silent
npx eslint lib/supabase/Upserts/nhlRawGamecenter.mjs lib/projections/ingest/shifts.htmlFallback.test.ts --report-unused-disable-directives-severity warn
```

**61 tests passed across2files** (15fallback,46raw); scoped ESLint and diff-check passed. No live ingestion/provider/database execution. Root owns the full official offline replay and any version/invalidation/release decision; this lane did not edit parser/materializer version constants or existing stored raw snapshots.
