# R-SCORE — successful full-population local route acceptance

Status: owning-file acceptance passed; ready for Chef review. Ownership released. No running process or blocker. Sol/medium runtime reconfirmed in this worker's latest matching turn_context during preceding bounded triage.

Exact row mapping: `SRC::tasks/TASKS/three-pillars-analytics/sustainability/tasks-prd-sustainability-barometer.md::C0095` NEW17.0 batch completeness; `::C0096` NEW18.0 local distribution/quintile finalizer behavior. Parent master4.2/5.7.27 inherit these dependencies. **Neither row is closed**: scheduled scope/capacity, finalizer scheduling, U-1 readback and natural production receipts remain held.

Exact R-SCORE files changed/created:

- `web/__tests__/pages/api/v1/sustainability/rebuild-score.test.ts`
- `tasks/codex-sprint-2026-10-19/continuation-review/R-SCORE-HANDOFF.md`

The prior read-only assignment separately created `continuation-review/R-NEXT-CANDIDATES.md`; it was not modified during R-SCORE. No source/master/register/schema/config changes. Current runtime route's preexisting C-F2 auth/audit ordering diff was inspected before/after and preserved exactly.

## Exercised behavior

Two new cases execute actual exported `rebuildScoreHandler` successful control flow with1,001synthetic players,250-player batch size and all four actual windows. Prerequisite/detector/config/player selection/league-reference/score-generation boundaries are mocked. Admin/audit/offseason wrappers are fully mocked; fetch throws if called. Scoring model arithmetic and provider behavior are deliberately outside this test.

The actual pure distribution/quintile builder and snapshot-row mapper are retained. **Actual upsertScores,400-row chunker and distribution persistence helper are retained**, with a mocked Supabase client recording rows instead of writing. This exceeds a mere mocked writer-count assertion.

- Successful write fixture: exact set of4,004`player_id:window_code` keys, no missing/duplicate key, all1,001players including tail1001, five requested batches. Actual persistence emits11chunks: ten400-row chunks plus4rows, with original conflict identity. Full row data is inspected.
- Deterministic scores0..100 in0.1steps yield four real distributions, each population1,001/min0/max100/mean50 and p20/p50/p80=20/50/80. Real quintile assignment per window has counts201/200/200/200/200; final player1001 is in quintile4. Four persisted snapshot rows retain synthetic revision/model/hash, snapshot date and correct conflict key. Successful route receipt reports all rows/chunks/batches/distribution counts.
- Dry fixture: identical complete4,004prepared rows and actual quintiles/distributions; actual helpers receive dry mode and return zero inserts/chunks/distribution writes. **No mocked Supabase.from call at all**, so no score write, distribution write or drift read occurs. Verification sample explicitly0 to avoid unrelated stored-sample reads. Dry receipt preserves counts and reports no drift/write.

Deleting the final row or duplicating a prior row would fail the length/set equality; losing the final batch would fail4,004rows and tail/quintile assertions. No runtime mutation or intentional source omission performed. Existing four prerequisite/no-op/offset/force cases remain passing; independent detector coverage was not duplicated.

## Checks actually run

From `web/`: `npm test -- __tests__/pages/api/v1/sustainability/rebuild-score.test.ts`.

- First run FAIL exit1: existing4cases passed; new2cases returned500 because newly added broad `vi.restoreAllMocks` erased mock factory defaults before success cases. Wrapper stubs were also incomplete, producing mocked audit/offseason warnings; no actual client/provider call occurred.
- One diagnosis/revised attempt: restore only console spy instead of all mock factories, and explicitly mock audit/offseason wrappers. Final run PASS exit0, **6/6**, including both complete success/dry cases. Only nonfatal Node punycode deprecation remains.
- Scoped `git diff --check` on test file PASS exit0.
- Runtime route diff inspected after test: still only the already-owned default auth/audit reorder; this worker did not edit it.
- No global type/lint/full suite/build/browser/provider/hosted checks; Chef owns global verification. No Git mutation, real database, schema change, schedule or production execution.

Exact hashes are appended from local bytes below. Next action is Chef independent review/rerun, then reserved global checks. No further runtime change proposed; this handoff does not stop the sprint or imply empirical/model qualification.

- `web/__tests__/pages/api/v1/sustainability/rebuild-score.test.ts`: `fd6c425defb993048121b95a4a91bd3cc56dfdd367b552f6b60c625cf21141b9`
- `web/pages/api/v1/sustainability/rebuild-score.ts`: `6fddaeed41db6e5bf632d302606ffe57e76f5c8dcaef4a5259ec4d657e97859e` (read-only runtime)
