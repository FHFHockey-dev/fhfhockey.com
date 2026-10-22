# NST continuation consumer — local candidate

Implemented and verified a separate three-file candidate. **Local continuation enablement is supported; independent review and production rollout remain pending.** The original A1–A4/A6 packet, archive and independent acceptance are preserved. This candidate changes three of those accepted paths and therefore reopens their review boundary; it does not replace the original evidence.

## Findings and changes

The original hold was release pairing: the consumer would stay inactive until D1 delivered the acknowledged integer-cursor contract and received review. The retained cross-platform agreement and delivery receipt identify D1 `e89dfdde58d2ce848947ab493710237223dcd440`, including a three-invocation producer test. The R20/current producer implements HTTP 207 continuations only after confirmed progress audit persistence. Its response contains the original query plus a strictly increasing cursor. The canonical consumer still disabled that path.

The correction goes beyond changing the flag:

- Removed the inert switch. A valid continuation stores the cursor, releases the stage as an A6 handoff, and pauses WGO and downstream stages. A later invocation uses the stored cursor and a fresh deadline. Completed work is skipped on further invocations.
- Tightened success admission: HTTP 200 needs boolean `success: true` and no contradictory continuation/error. HTTP 207 needs `continuation_required`, boolean `success: false`, confirmed audit persistence, and an exact request query with only its cursor changed. Malformed, non-integer, non-increasing, changed-scope and changed-deadline responses block the stage.
- Preserved the pipeline’s 20-second deadline reserve and producer’s separate five-second audit reserve. Explicit requests now pass their end date as well as their start date; previously the consumer omitted explicit `endDate`, allowing the producer’s default aperture to exceed the requested window.
- Explicit `writePersistence` or `auditPersistence: not_confirmed` now returns a manual-review hold and persists `nst_persistence_unconfirmed` in the existing stage `last_error` field. Future scheduled invocations preserve the cursor and do not automatically rerun the ambiguous operation. Explicit `stopOnFailure=false` cannot bypass this hold. The run-state helper only adds an optional failure-code argument; no storage/schema/migration is added.
- Kept R20’s source-down policy: a recognized unresolved source result may continue on WGO, explicitly marked `nst_source_unavailable`. This also works after a continuation. It does not assert that NST finished its aperture or that counts/coverage are complete. Ordinary provider errors, malformed continuations and unknown persistence do not use that exception.

Files: `web/pages/api/v1/db/run-rolling-forge-pipeline.ts`, `web/__tests__/pages/api/v1/db/run-rolling-forge-pipeline.test.ts`, and `web/lib/rollingForgePipelineRunState.ts`. Producer source/test, cron configuration, authorization wrappers, dependencies and other owners’ work are unchanged. `CANDIDATE.json` pins all three before/after hashes and eight dependency fences. `owned-fixes.patch` is relative to the independently accepted dirty baseline, not a guessed clean Git tree.

## Verification performed

All execution used the fresh nested source-only snapshot in `snapshot-path.txt`, Node v22.11.0/npm 10.9.0, a sanitized environment with synthetic settings, denied sockets/HTTP(S)/unmocked fetch, and existing dependencies. No live NST/API/database call occurred.

| Check | Result |
|---|---|
| New regressions against pre-fix consumer | Four expected failures: default continuation, malformed 200 success, unconfirmed audit, unconfirmed write. 48 other cases filtered out at that point. `evidence/baseline.log` |
| Final pipeline suite | 54 passed: default three-invocation continuation plus fourth no-op, fresh deadline, cursor persistence failure, malformed contracts, manual holds, explicit-window bounds, source-down and prior lease behavior |
| Unchanged real NST producer suite | 101 passed: acknowledged 7+7+6 completion, older/completed-cursor replay without repeated acknowledged sources, original-plan pacing, deadline/audit headroom, missing scope, source-down and lost acknowledgements |
| Combined focused run | **155 passed**, `evidence/final-tests.log` |
| Full isolated nonincremental TypeScript check | Passed, exit 0, `evidence/typecheck.log` |
| ESLint on the three changed files | Passed, exit 0, `evidence/lint.log` |
| Scoped diff whitespace; patch application check against saved baseline | Passed; `patch-check.log` |
| Canonical versus tested owned bytes; producer/dependency fences; original accepted archive | Matched at candidate freeze |

The producer and consumer suites exercise real implementations separately, with mocked transport/database and mocked child route responses in the consumer suite. This is contract evidence, not a claim of a single real-database end-to-end run. Existing offseason mock fallback and Node punycode warnings occur in the pipeline log; no test failures or denied network attempt occurred.

The fixed archive contains 3,356 source/support files; its SHA-256 is `6cb9bd758692c6163cae88a46249b7dfeda03a8ad87187442ae18c00700dc75e`. `FIXED-SNAPSHOT.json` pins every file. Other owners changed stats/billing files after this isolated snapshot was taken; their newer changes were preserved in canonical and are not represented as verified by this archive.

## Remaining gates

- Independently review this incremental packet, then pin the eventual combined candidate. The original audit acceptance does not automatically accept these new hashes.
- Retain A6’s quiescent/new-run rollout gate. Old workers do not recognize the new manual-review marker, and previously terminal/complete stages are not reset here. No mixed-version takeover or repair of existing pipeline rows is approved.
- The manual-review marker prevents replay once durably stored. Simultaneous process death or a failed state write cannot be proven safe by these in-memory tests. Inspect unconfirmed receipts and storage state before operational recovery; do not infer exactly-once provider execution. The producer itself discloses that overlapping independent runs may replay attempts.
- No Oct 22 scheduled execution, fresh source availability, backfill completion, RSO/Start Chart account behavior, or coverage was verified. A source-down completion remains degraded. Migration/universe/completeness and historical model-qualification gates from the accepted audit packet remain held.
- No production action was attempted, denied or uncertain. Deployment, runtime observation, DB recovery and NST/backfill execution are unperformed and outside this task’s authorization. No commits, pushes, installs, remote builds, model API calls or billing operations occurred.

References: `tasks/artifacts/cross-platform/2026-10-21-claude-to-codex-pipeline-nst-contract.md`; `2026-10-20-codex-to-claude-pipeline-nst-contract.md` in the same folder; the daily evidence diary; and `tasks/artifacts/claude-audit-independent-review-2026-10-22/forge-ledger-lease/REVIEW.md`.

Final repository observation: another local task advanced `octoberBranch` from the pinned baseline `a811b0762ffe29006c3df7eaa4c19bf18deecda3` to `d3f057c6c849d5d5474bc912a6f461f617c65b15` ("Streamlining list: 10-22 morning runs clean on R20"). This task made no commit or branch change. The three tested files, eight dependency fences and other 11 original audit files still match their recorded hashes. The source-only candidate remains pinned to its manifest; the newer documentation commit is preserved.
