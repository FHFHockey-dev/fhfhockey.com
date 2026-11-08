# Independent FORGE v2 implementation audit

**Disposition: changes required before accepting local implementation as complete.** Five new checks reproduce implementation defects while all 147 existing focused tests pass. There is also an uncompleted local integration path. The existing scientific and release gates remain valid; they are not the only remaining work.

This review inspected the goal thread and the actual committed implementation, rather than relying on its handoff. It did not edit product code, stop the goal, commit, push, deploy, modify a database, acquire live data, or open protected evaluation data.

**Scope and ownership.** The goal in `01a18a10-68f8-7610-bec7-ccfe0f4d0ef5` (Read Codex goal objective) was to implement and verify the approved PLAN (11) PRD and PLAN (12) task list, finish every authorized unblocked local task, and leave scientific/external gates explicit. It authorized local checkpoint commits on `octoberBranch` only. The observed thread was idle after its completed implementation turn. Its five commits are `2bb04301c`, `4c8150349`, `92f9d63bd`, `43d35f802`, and `988423d38`.

The reviewed diff is `18e52a481589a314dc6a67663dd98d1fa8c48454..988423d385d76ecc2a59efea88d5391784060911`: 49 added paths, 8,115 text lines, including two screenshots. These are the isolated `web/lib/forge-v2`, `web/components/ForgeV2`, page/API wrappers, browser spec, one private migration, approved documents, and implementation evidence. All 49 paths matched the candidate before and after testing. Another lane advanced repository HEAD during review; none of these 49 paths changed. `pins.json` identifies the exact reviewed bytes. Unrelated dirty files were not included.

The task register independently counts 48 checked and 15 unchecked subtasks. The unchecked IDs are 2.2, 2.4, 2.5, 7.1, 7.3, 8.3, 8.5, 13.2, 13.4, and 14.1–14.6. The claim of no qualified public subset is accurate; this review does not establish scientific qualification.

1. **P1 — Persist failed attempts and missing-refresh gaps outside the mutable queue.**

   Evidence: [pipeline.server.ts:323](/Users/tim/Code/fhfhockey.com/web/lib/forge-v2/pipeline.server.ts:323), [refresh.ts:340](/Users/tim/Code/fhfhockey.com/web/lib/forge-v2/refresh.ts:340), [ForecastExplorer.tsx:22](/Users/tim/Code/fhfhockey.com/web/components/ForgeV2/ForecastExplorer.tsx:22).

   `runPreparedQueueBatch` records failure by calling `finishRefresh` and replacing the queue snapshot. It never appends a corresponding `history_event`. Subsequent attempts also replace the job's previous reason/status; the immutable attempt record is absent. The history view breaks shading only when supplied an explicit gap event.

   Reproduction: enqueue a valid daily plan, remove its prepared input, and run the real batch function using the existing durable-store double. The result is `prepared_inputs_missing`, the acknowledged queue job is `failed`, and the immutable store contains **zero history events**. The new assertion requiring a retained gap fails. This is a pipeline omission; no database access is required to reproduce it.

   Impact: FR-14/FR-19 and tasks 3.3/5.4 are not complete. The retained issuance history can omit a known failed/missing refresh, and later plotting can bridge it. Add idempotent immutable attempt/gap capture and an explicit read-model consumer; preserve each failed attempt through retry success and queue archival.

2. **P1 — One immutable calibration pin cannot reproduce both original and supported custom-profile intervals.**

   Evidence: [uncertainty.ts:114](/Users/tim/Code/fhfhockey.com/web/lib/forge-v2/uncertainty.ts:114), [uncertainty.ts:123](/Users/tim/Code/fhfhockey.com/web/lib/forge-v2/uncertainty.ts:123), [uncertainty.ts:129](/Users/tim/Code/fhfhockey.com/web/lib/forge-v2/uncertainty.ts:129), [pipeline.server.ts:261](/Users/tim/Code/fhfhockey.com/web/lib/forge-v2/pipeline.server.ts:261).

   A vintage has one calibration reference. Reproduction requires the supplied calibration reference to equal that immutable reference, then requires its scalar `profileId` to equal the selected profile. A default-scored vintage therefore cannot use a different profile's calibration. The producer additionally pins joint output to only `prepared.scoring.id`.

   Reproduction: use the existing synthetic trusted-evidence factory, register both default and signed profiles, pin both calibration hashes, and leave the issued vintage unchanged. Original default intervals reproduce. The original calibration cannot apply to the custom profile, while the appropriate custom calibration fails the exact-reference check. The new custom-profile reproduction assertion fails. All approval/evaluation objects here are fabricated gate-test inputs, not real scientific evidence.

   Impact: FR-10/FR-25 and tasks 3.5/8.4/13.1 cannot be satisfied by supplying real calibration data alone. The current lifecycle test only checks raw `scoreJoint` arithmetic for custom weights and explicitly expects qualified reproduction to be unavailable. Provide an immutable, profile-addressable calibration representation or a pinned validated transformation that supports multiple profiles without rewriting the issuance.

3. **P2 — Missing zero-weight PIM can suppress otherwise complete default-profile uncertainty.**

   Evidence: [pipeline.server.ts:256](/Users/tim/Code/fhfhockey.com/web/lib/forge-v2/pipeline.server.ts:256), [uncertainty.ts:39](/Users/tim/Code/fhfhockey.com/web/lib/forge-v2/uncertainty.ts:39).

   The producer constructs the joint over every category with an available marginal mean, including zero-weight PIM. A partially observed PIM head may have an available mean, but including it discards rows that are complete for every default-scoring category. The resulting joint no longer matches the published means, so the entire distribution is refused.

   Reproduction: in the existing two-row pipeline fixture, mark only the second row's PIM unavailable. `predictJoint` over the six nonzero default categories remains available. The real producer publishes the vintage with an unavailable joint (`joint_mean_mismatch`). The assertion that this default profile retains its available distribution fails.

   Impact: the intended default subset is unnecessarily blocked by a category it does not use, contrary to FR-09 and task 8.2. Choose the applicable joint support per supported profile/category scope, and make the means and joint agree on that population. Do not require an unrelated zero-weight head to be complete.

4. **P2 — Later authoritative actual-start corrections cannot restore correct final selection.**

   Evidence: [evaluation.ts:48](/Users/tim/Code/fhfhockey.com/web/lib/forge-v2/evaluation.ts:48), [evaluation.ts:88](/Users/tim/Code/fhfhockey.com/web/lib/forge-v2/evaluation.ts:88).

   Both publication eligibility and the final deadline use the minimum actual start across every historical lock epoch. A superseded erroneous early time remains a permanent cutoff even when a later authoritative observation corrects it.

   Reproduction: scheduled lock 23:00; vintage published 22:15; first postgame observation says actual start 22:00; a later linked correction says 22:30. The original selection is correctly missing under the first observation. After the correction, the final selector still returns `missing`/null rather than selecting the 22:15 vintage. The new assertion fails.

   Impact: FR-21 and task 9.2 misgrade corrected timing evidence. Resolve the authoritative actual-start revision as of the evaluation time, preserve the prior decision, and append the corrected final selection. This does not reopen pregame issuance after play.

5. **P2 — Restoring default scoring is rejected by the UI's response check.**

   Evidence: [ForecastExplorer.tsx:117](/Users/tim/Code/fhfhockey.com/web/components/ForgeV2/ForecastExplorer.tsx:117), [api.server.ts:126](/Users/tim/Code/fhfhockey.com/web/lib/forge-v2/api.server.ts:126).

   The API labels the default profile `as issued`, but the component requires every scoring response to be labeled `re-scored under selected profile`.

   Reproduction: start with custom G=4, choose **Use default weights**, then **Apply scoring**; return the default DTO with the API's documented `as issued` label. The rendered alert is “Scoring response did not match the selected profile.” The test expecting successful application fails. Applying unchanged default weights has the same mismatch.

   Impact: task 11.4's scoring interaction fails when connected to its own API. Validate the response label against the requested profile, or make the API/UI labeling contract consistent. The browser fixture always returns the rescore label, which hides this integration defect.

**Remaining local integration gap — verified by source inspection, not a failed end-to-end execution.**

The code has useful individual modules, but it does not yet provide the claimed local issuance-to-public-view lifecycle:

- [PostgresContextReader](/Users/tim/Code/fhfhockey.com/web/lib/forge-v2/api.server.ts:37) reads `read_context` records. No non-test producer of those records exists in the owned implementation or inspected callers. The native read test inserts its own context at [history.test.ts:185](/Users/tim/Code/fhfhockey.com/web/lib/forge-v2/history.test.ts:185). The queue pipeline ends after publication/acknowledgement; it does not prepare settled selections, outcome/evaluation revisions, accountability, or public contexts.
- [lifecycle.test.ts:64](/Users/tim/Code/fhfhockey.com/web/lib/forge-v2/lifecycle.test.ts:64) fabricates publication receipts with `fixturePublished`; it does not drive the implemented queue/persistence/read API/UI together. [The browser harness](/Users/tim/Code/fhfhockey.com/web/e2e/forge-v2.spec.ts:58) renders supplied synthetic DTOs and custom callbacks. These are valuable module/browser tests, but do not establish task 13.1's integrated lifecycle.
- The [page](/Users/tim/Code/fhfhockey.com/web/pages/forge/v2/index.tsx:9) supplies null data and no callbacks. The literal release gate should remain disabled, but local fixture wiring and read preparation can be implemented/tested without activation.
- [PublicAccountability](/Users/tim/Code/fhfhockey.com/web/lib/forge-v2/contracts.ts:270) and [its API projection](/Users/tim/Code/fhfhockey.com/web/lib/forge-v2/api.server.ts:128) expose counts and MAE/RMSE/bias only. Paired baseline comparisons, interval coverage/width/proper scores, participation reliability, and horizon/cohort strata are calculated by a separate helper but cannot reach the declared public interface. Custom-profile metrics are unconditionally unavailable. FR-23 and tasks 10.1/11.1 need this connection or explicit reopened implementation status.

Reopen the affected completed subtasks and 13.1/13.5 for targeted regression/integration work. Preserve the existing fifteen scientific/external gates; no data access or release approval is needed to fix and test the local defects above.

**Verification and limits.**

- Independently executed on the pinned snapshot: Node 22.11.0, Vitest 3.2.7, 147 existing tests across 11 files passed, exit 0. This includes contracts, data, schedule, refresh, model, uncertainty, integration gates, evaluation, pipeline, API, and React component tests.
- Five newly written contract checks across four isolated test files failed, exit 1, with the expected/observed differences above. The checks reused existing synthetic factories/store doubles; product files were not changed. See `audit-regressions.log` and `reproductions/`.
- Original thread reports 256 focused tests, two Chromium cases, scoped TypeScript and lint. Its retained inventory is consistent with 163 v2 plus 93 existing consumer tests; this review independently reran 147 of those v2 tests. Native PostgreSQL, browser, capacity, existing-consumer, type/lint and full-suite checks were not rerun. The explicit no-database-change review boundary was preserved. Existing native receipts/source were inspected, not re-certified.
- Public API/page and RSO fences were source-inspected and remain disabled. No qualified release subset exists; predictive accuracy, real calibration, original source availability, rights/custody, untouched/prospective evaluation and production capacity remain unverified.
- All 49 pinned candidate paths still match. The shared heavy-test lock caused one temporary deferral while another lane held it; it was never removed or bypassed. There is no remaining access or approval blocker for this audit.

`verification.json` records scope, checks, exclusions, and snapshot location. `pins.json` records every candidate file hash. Run `python3 reproduce.py` from this directory (or by absolute path) to reconstruct a temporary snapshot and run just the five defect checks; expected candidate exit is 1. The runner uses existing dependencies, acquires the shared heavy lock, makes no database connection, and does not edit the checkout's product files.
