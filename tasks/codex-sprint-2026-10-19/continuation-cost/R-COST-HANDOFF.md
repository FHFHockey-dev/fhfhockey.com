# R-COST — local actual-reader envelope for C0124

Status: bounded measurement and subsequently Chef-approved local hydration reuse implemented; focused and before/after checks pass, ready for Chef review. The original measurement/proposal below is retained as historical context; current implementation receipt follows. This does not close hosted cost or owner acceptance. Sol/medium confirmed from own matching CODEX_THREAD_ID `01a1566f-a56b-7590-888a-d4783994573b` turn_context before edits. Canonical octoberBranch; no source/Git mutation or global checks.

## Concrete finding and next local action

Actual `buildEntityMetricRankingSurfaces` fetches the full snapshot cohort, builds unhydrated responses, fetches only displayed player/team metadata, then **calls the full build/rank/sort again**. `hydrateMetadata:false` performs one calculator call per metric; default hydration performs two. Existing S-20 metadata narrowing is correct and preserved. Snapshot-date warm cache removes only date lookups, never the full row scan or ranking.

Proposed exact next ownership: `web/lib/rankings/entityMetricRankingReader.ts` and existing `web/lib/rankings/entityMetricRankingReader.test.ts`. After Chef approval, hydrate only returned API rows from the existing unhydrated surfaces, copying entity name/position/image and team abbreviation/name with existing null fallbacks. Reuse ranked/sorted rows and all current response metadata. Do not change cohort queries, sample qualification, returned IDs/order, limits, source timestamps, snapshot semantics or `hydrateMetadata:false`.

Bounded acceptance: existing reader tests under explicit lane-directed/unset output env vars, plus exact hydrated/unhydrated ranks/percentiles/qualified peers, mixed-team/missing metadata fallbacks and display-selection invariance; benchmark should show hydrated calculator calls/candidates reduced from2M/2NM toM/NM and unchanged row/page/request workload. Compare measured timing only after correctness; no hard wall-clock test threshold or hosted-savings claim. No source edit occurred in this assignment.

## Harness and measurement boundary

- [Harness](reader-cost.cjs) loads the actual reader, ranking calculator and metric definitions through installed TypeScript5.7.3's transpileModule and Node22.11.0. Supabase is injected; rankingMetadata's annotation constant is copied from actual source without loading unrelated dependency graph. Only these explicitly allowed imports can resolve. No test hooks, secrets/env files, provider clients or existing test afterAll are loaded.
- Global fetch throws. Mock query responses are pre-indexed fixture rows, selected/sliced at real requested1,000row offsets; no synthetic database full-table sort is charged every page. Query callback separately times its own projection/JSON-byte estimation. This is a reader measurement, not a simulated PostgreSQL plan or network.
- `rankingMs` directly wraps the actual calculator function; elapsed includes reader allocation/mapping/sorting, promise work, mock projection and JSON serialization. `readerOutsideMockMs = elapsed - measured mock time` remains approximate local processing, not isolated CPU billing. Compilation/module load and fixture creation excluded from timed calls; no forced GC/JIT warmup. Three observations per cell, no p95 or statistical confidence claim.
- JSON bytes are uncompressed serialized selected-row arrays, including metadata responses. Excludes HTTP headers, DB protocol, compression and transport latency. The100/1,000/10,000entity workloads are explicit synthetic envelopes, not observed live cohorts. Eight metrics is a multi-metric stress scenario, not a default endpoint assumption.
-36main measurements (3scenarios ×3trials ×2hydration modes ×2snapshot-cache states), plus3single-entity selection checks. Display limit25. Source values deliberately tie (`id mod97`); every tenth entity fails selected5-game minimum. All metrics use the same snapshot date, giving grouped metric pagination. Exact multiples require an empty terminal page.
- Assertions passed: full N×M source rows fetched, exact page counts, selected sample-qualified peer counts,25returned rows/metric, hydrated metadata, identical ranks/percentiles/IDs across hydrated/unhydrated and warm/cold states, selected-ID output retaining full cohort and selected minimums, and calculator call/candidate counts. No naive entity/limit DB pushdown.

## Measured workload and local times

Times below are medians of3observations in milliseconds. Query/page counts and JSON bytes are deterministic per cell; raw observations remain in [results](reader-cost-results.json).

| Synthetic entities × metrics / source rows | Hydrate | Snapshot cache | All queries / ranking pages | Estimated query JSON bytes | Calculator calls / candidate visits | Elapsed median ms | Calculator median ms | Mock median ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 100×1 / 100 | False | cold | 2/1 | 48,556 | 1/100 | 1.084 | 0.119 | 0.271 |
| 100×1 / 100 | False | warm | 1/1 | 48,524 | 1/100 | 0.607 | 0.120 | 0.318 |
| 100×1 / 100 | True | cold | 4/1 | 51,917 | 2/200 | 0.998 | 0.244 | 0.345 |
| 100×1 / 100 | True | warm | 3/1 | 51,885 | 2/200 | 0.973 | 0.243 | 0.329 |
| 1,000×4 / 4,000 | False | cold | 9/5 | 1,949,906 | 4/4,000 | 16.376 | 2.622 | 10.968 |
| 1,000×4 / 4,000 | False | warm | 5/5 | 1,949,778 | 4/4,000 | 16.497 | 2.428 | 10.793 |
| 1,000×4 / 4,000 | True | cold | 11/5 | 1,952,551 | 8/8,000 | 22.158 | 5.237 | 10.653 |
| 1,000×4 / 4,000 | True | warm | 7/5 | 1,952,423 | 8/8,000 | 21.817 | 4.488 | 11.250 |
| 10,000×8 / 80,000 | False | cold | 89/81 | 39,285,634 | 8/80,000 | 392.144 | 67.254 | 237.410 |
| 10,000×8 / 80,000 | False | warm | 81/81 | 39,285,378 | 8/80,000 | 385.336 | 64.029 | 232.564 |
| 10,000×8 / 80,000 | True | cold | 91/81 | 39,289,059 | 16/160,000 | 551.952 | 127.744 | 232.866 |
| 10,000×8 / 80,000 | True | warm | 83/81 | 39,288,803 | 16/160,000 | 545.933 | 116.706 | 236.304 |

At10,000entities×8metrics, warm cache still makes81ranking-page calls; hydration adds only one displayed-player metadata query and one displayed-team query. The repeated calculator/response work is therefore a separate, deterministic local CPU/allocation opportunity from database row cost. Full rows still scale N×M; optimizing that further needs a correctness-preserving cohort contract and real owner cost acceptance.

## Evidence, checks and exact files

- `node tasks/codex-sprint-2026-10-19/continuation-cost/reader-cost.cjs` — PASS exit0 on first attempt;39actual reader invocations including selection checks,36timed matrix observations. No install, application build, suites, browser, hosted/provider requests or Git mutation.
- Source-hash recheck against emitted four source hashes — PASS after measurement. Runtime recorded in JSON: `/usr/local/bin/node`,v22.11.0, TypeScript5.7.3, darwin/arm64, AppleM4Max,16logical CPUs. No isolated CPU scheduling or idle-system guarantee.
- Existing reader test afterAll was initially described as unconditional in ticket; Chef corrected that it returns unless `RANKINGS_VALIDATION_REPORT` is set. No existing suite was run here. Future owning-file checks may use explicit lane outputs/unset vars with source ownership.
- [S-20 retained correctness/metadata narrowing receipt](/Users/tim/Code/fhfhockey.com/tasks/sprint-2026-10-18/HANDOFF-2026-10-18.md:1395); [current full-cohort query](/Users/tim/Code/fhfhockey.com/web/lib/rankings/entityMetricRankingReader.ts:224); [actual second build](/Users/tim/Code/fhfhockey.com/web/lib/rankings/entityMetricRankingReader.ts:558). These are source/retained evidence, not freshly exercised hosted budgets.

Exact assignment write set:

1. `tasks/codex-sprint-2026-10-19/continuation-cost/reader-cost.cjs`
2. `tasks/codex-sprint-2026-10-19/continuation-cost/reader-cost-results.json`
3. `tasks/codex-sprint-2026-10-19/continuation-cost/R-COST-HANDOFF.md`

No running operation remains. Next unblocked piece is the precise hydration-reuse proposal above once Chef grants source/test ownership; otherwise handoff is ready for independent rerun and owner acceptance discussion. Sprint remains active; no whole-queue completion claim.

Source SHA-256 bound to actual executed modules/annotation:

- `web/lib/rankings/entityMetricRankingReader.ts`: `b4ac82bbd327a67e1b1e94f7ac250c302c22eb3d17b77b0b8ccc675181cb4d04`
- `web/lib/rankings/rankingCalculator.ts`: `5ca746fff2c2e5283f421f6200864eca3a138ffc2b422bebd9710979ac4d955f`
- `web/lib/rankings/metricDefinitions.ts`: `88395d09f1fe56f0f8a51f000d8a1c8bd63943b9f0875a5104348daba4900d77`
- `web/lib/rankings/rankingMetadata.ts`: `f48abafc7f543457fd79a14a21ffa5af02b7c29d24adbe1b99bc72982ead6009`

Harness SHA-256: `f97c8be73b913b95e20eef9056b7e2a919e05b4068f7140ec9a22f067bfc4313`.

## Chef-approved implementation receipt (supersedes proposal-only status above)

Chef explicitly granted only `web/lib/rankings/entityMetricRankingReader.ts` and its existing `.test.ts`. Both were clean at scoped initial diff inspection. Complete `toApiRow` was inspected: player metadata supplies entity name/position/image only, team metadata supplies abbreviation/name only. Historical source team ID and positionGroup come from the ranking row, not current player metadata. Every other API field derives from the source/cohort/request.

The implementation maps the already-ranked and limited unhydrated surfaces, fills exactly those five display metadata fields with existing null fallbacks, and retains every other field and response metadata. It avoids the second full-cohort calculator, API-row conversion and sort. Source fetches, selected minima, cohort identity, sorting, returned IDs, `hydrateMetadata:false`, snapshots and API metadata are unchanged. No new abstraction/dependency/source file introduced.

Existing reader test extended with two-metric cases over selected/limited IDs, full output and all-below-minimum requests. Full normalized responses are compared to unhydrated responses plus only expected display metadata; spy proves one calculator call per metric with all three candidates. Fixture includes missing player/team records, null player/team names, a real image value, changed display position, and conflicting player.team_id=999 while historical row.team_id=10 remains authoritative. Existing full-cohort/paging/rank/minimum tests remain intact.

Before/after harness enhanced to record complete normalized outputs and a missing/null/image/conflicting-team corpus. It preserves all response fields except `generatedAt`;16complete cases were **deep-equal and serialized JSON byte-identical** between [baseline](reader-cost-baseline.json) and [after](reader-cost-after.json). All36paired measured cases retain identical query counts, page counts, row counts by kind, request payload-byte estimates and response-byte lengths. This is actual old/new reader execution, not source-shape assertions. Initial reader-cost-results.json remains historical first measurement.

### Actual checks

- Before edit: `node tasks/codex-sprint-2026-10-19/continuation-cost/reader-cost.cjs reader-cost-baseline.json` — PASS exit0, first attempt;36measurement observations plus selected-ID and extra metadata cases.
- From `web/`: `env -u RANKINGS_VALIDATION_REPORT -u RANKINGS_BROWSER_FIXTURE_OUTPUT npm test -- lib/rankings/entityMetricRankingReader.test.ts` — PASS exit0,24/24, first attempt. Both afterAll artifact-output variables explicitly unset, so no report outside owned lane is written.
- After edit: `node tasks/codex-sprint-2026-10-19/continuation-cost/reader-cost.cjs reader-cost-after.json --single-ranking` — PASS exit0, first attempt; same workload, calculator-call expectation now one per metric.
- Node assert.deepEqual and exact JSON string equality over all16normalized cases, plus matching workload fields across36paired measured cases — PASS exit0.
- `git diff --check -- web/lib/rankings/entityMetricRankingReader.ts web/lib/rankings/entityMetricRankingReader.test.ts` — PASS exit0.
- No failed implementation/test attempt. Global tsc/lint, broad suites, build, browser and hosted/provider checks NOT RUN; Chef owns global checks/review. No Git mutations or other source ownership used.

### Same-harness measured hydrated comparison

Three observations per cell; medians in ms, descriptive local runs only. Baseline rerun below includes the expanded normalization corpus, so these are the paired baseline/after artifacts rather than the earlier exploratory measurement table.

| Synthetic entities × metrics | Snapshot cache | Calculator calls before → after | Candidate visits before → after | Elapsed median before → after | Calculator median before → after |
| --- | --- | --- | --- | --- | --- |
| 100×1 | cold | 2 → 1 | 200 → 100 | 1.031 → 0.877 | 0.237 → 0.153 |
| 100×1 | warm | 2 → 1 | 200 → 100 | 0.839 → 0.761 | 0.219 → 0.135 |
| 1,000×4 | cold | 8 → 4 | 8,000 → 4,000 | 23.225 → 18.425 | 5.585 → 3.402 |
| 1,000×4 | warm | 8 → 4 | 8,000 → 4,000 | 22.065 → 18.325 | 4.594 → 2.581 |
| 10,000×8 | cold | 16 → 8 | 160,000 → 80,000 | 522.212 → 363.570 | 119.248 → 52.993 |
| 10,000×8 | warm | 16 → 8 | 160,000 → 80,000 | 505.511 → 366.871 | 112.639 → 54.038 |

This proves removal of redundant local work, not a billed CPU percentage or hosted latency saving. Stress full-cohort requests remain81ranking pages regardless of warm snapshot cache; application payload/cost model acceptance remains open under C0124. A next useful unblocked local piece is Chef independent review/rerun against the source hashes below, then reserved global checks. No additional source optimization is proposed without new evidence.

### Final exact assignment write set (seven paths)

1. `web/lib/rankings/entityMetricRankingReader.ts`
2. `web/lib/rankings/entityMetricRankingReader.test.ts`
3. `tasks/codex-sprint-2026-10-19/continuation-cost/reader-cost.cjs`
4. `tasks/codex-sprint-2026-10-19/continuation-cost/reader-cost-results.json`
5. `tasks/codex-sprint-2026-10-19/continuation-cost/reader-cost-baseline.json`
6. `tasks/codex-sprint-2026-10-19/continuation-cost/reader-cost-after.json`
7. `tasks/codex-sprint-2026-10-19/continuation-cost/R-COST-HANDOFF.md`

The earlier proposal-only write set and hashes are historical. Current SHA-256:

- `web/lib/rankings/entityMetricRankingReader.ts`: `bc84655c3558467e4cf8dc5cec9d9f3face5b4be22bc90fb8666ef31d541afa6`
- `web/lib/rankings/entityMetricRankingReader.test.ts`: `a402c6d814442f2a4cf0474cad632d64ecd1c2ae89a330e5c28c6acff96fa6e5`
- `tasks/codex-sprint-2026-10-19/continuation-cost/reader-cost.cjs`: `dd355a92d457df3c404b4bbfbd996469e7420214abaad0107b42d1e4650e4492`

Final source hashes match after-benchmark executed bytes. No running operations; source/test ownership released to Chef for review. Sprint remains active.
