# FORGE v2 remediation handoff — 2026-10-30

The five outside-audit defects and confirmed local integration gaps are repaired. Independent correction review accepted the local candidate. **The all-tasks objective remains incomplete:** the scientific and external gates below have not met their acceptance criteria. There is no qualified subset, public release, or RSO activation.

## Candidate and retained evidence

- Canonical checkout: `/Users/tim/Code/fhfhockey.com`, `octoberBranch`.
- Local code commit: `7113329d2c24b8629f54484df37441f95a63d853`; remediation base `1d9e900515726c5efcc62ad4df3a8cadc435c88c`.
- Approved PRD remains byte-identical: `7fe25088be9797eb6976aed6fe30367e52c9bf7dc2b6720c8d329121609ae51c`.
- [Canonical task list](../../tasks-prd-forge-v2-skater-game-forecasts.md) and [exact task status](task-status.json) enumerate every parent, subtask and discovered task. Checked entries mean their specified local acceptance passed, never scientific qualification by implication.
- [Verification](verification.json), [source pins](source-pins.json), [initial review](independent-review.json), [accepted correction review](review-followup.json), and `logs/` retain results and limitations.
- [Scientific prerequisites](scientific-prerequisites.json), [unfrozen protocol proposal](protocol-proposal.json), and [code-pin supplement](approval-code-pins.json) are resumable preparation, not approval or final scientific evidence.
- The original goal thread was idle and its writers had handed back before edits. All remediation workers have handed back. Only assigned v2 files and task-owned evidence changed. Unrelated dirty work and historical worktrees were preserved. Diaries remain uncommitted because the overall task is unfinished.

## Implemented behavior

1. Failed, unavailable and missed refreshes persist as immutable history. Queue transition and gap capture use one atomic compare-and-swap statement. Committed publication receipts increment the queue revision; bounded recovery checks them before classifying an expired job as missing. A stale queue reader cannot invent a gap after another worker publishes.
2. One immutable calibration bundle binds explicitly supported original/custom profile parameters. Joint coverage follows nonzero weights and required coherence dependencies. Missing zero-weight PIM does not block default uncertainty; unsupported contributing categories still fail closed.
3. The latest authoritative actual-start correction governs grading, while observing play remains an irreversible issuance fence. Final selection and same-vintage primary timing exclusions can be corrected with append-only selection/grade lineage.
4. `preparePlayerReadContext` builds bounded immutable player contexts from retained opportunity, episode, lock, publication, event and outcome evidence. Historical retries return the matching recorded context and cannot replace the latest head. Grade identities preserve artifact failure/restoration cycles. Native record ordering now uses numeric ordinals, fixing pagination after ordinal 9.
5. Exact-profile accountability includes category/FP errors, paired last-five/season baselines, interval coverage/width/proper score, participation reliability/Brier/log loss, missingness, corrections and artifact failures. Category and FP diagnostics can evaluate retained pins internally before qualification; public intervals still require qualification.
6. The disabled page has a connected read client. Returning to default weights matches the API's “as issued” label. The UI renders detailed accountability and category interval availability. The real queue→preparation→API→UI synthetic lifecycle replaces inspection-only/fabricated-publication acceptance.

## Checks actually run

All runs used Node 22.11.0, serial shared-heavy-lock ownership, local fixtures and no remote application/provider requests.

| Check | Result |
|---|---|
| Focused unit/API/component regressions | 134 passed |
| Final preparation appearance branches plus data/model/schedule/lifecycle | 37 passed; preparation overlaps the preceding run |
| Native PostgreSQL persistence/artifacts/pipeline/context integration | 13 passed |
| Existing RSO policy, serving-source and healthy-reserve compatibility | 93 passed |
| Chromium desktop/phone | 4 passed, including 2 actual-issuance/API cases |
| Scoped v2 TypeScript | Passed, exit 0 |
| Scoped v2 ESLint | Passed, exit 0 |
| Scoped final diff/whitespace | Passed |
| Independent original reproductions | All 3 passed after correction |

There are 183 unique v2 tests and 93 compatibility tests across focused runs, plus four browser cases; this is not one full repository suite. The final preparation test additionally covers dressed-unused, nonappearance, ambiguous, game-not-played and restored official-appearance states using actually issued vintages.

Reproduce a justified check from the repository root with `python3 tasks/artifacts/forge-v2-remediation-2026-10-30/verify.py <check>`, where check is `unit`, `acceptance`, `native`, `compatibility`, `browser`, `types` or `lint`. The runner never installs dependencies. Native PostgreSQL and Chromium required permitted sandbox escalation for local process capabilities. Native setup in the ordinary sandbox could not allocate shared memory; the isolated native rerun passed. A native integration failure exposed text sorting of record ordinals; the product query was corrected and rerun successfully.

The browser uses synthetic data and a durable-store double while running actual queue, preparation, API and client code. The PostgreSQL integration is a separate executed path. No single native-database-to-Chromium test is claimed. Screenshots are in `screens/`; no 200%-zoom or RTL audit is claimed. Production build/full-repository suites were not run.

## Exact incomplete gates

Each action below is **not attempted**: no denied operation, pending tool approval, or uncertain execution. The blockers are missing evidence/owner decisions/authorization, not failed local implementation checks. Details, required hashes and exact acceptance evidence are in `scientific-prerequisites.json`.

| Task | Target and prerequisite required to proceed |
|---|---|
| 2.2 | Source owner supplies six approved original appearance/PIM cases, authoritative credit/units, completeness, receipt/correction clocks and use rights. Synthetic zero-minute credit is insufficient. |
| 2.4 | Custodian supplies signed exposure/temporal allocation register with hashes, whole-game grouping and untouched-label custody. Existing 2024–25 exclusion and 2025–26 reservation remain in force. |
| 2.5 | Scientific lead/reviewer justify numerical thresholds on admitted development evidence, freeze executable recipes/data/candidate/evaluator hashes, and register independent methodology approval before final access. Proposal is unfrozen. |
| 7.1 | Data owner supplies an authorized independent real opportunity/official-appearance label manifest including all difficult and missing cases. |
| 7.3 | Execute registered chronological participation calibration on the authorized allocation and retain reliability, Brier/log loss, support and exclusions. No real calibration evidence exists here. |
| 8.3 | Fit/validate both interval levels on the authorized calibration allocation with profile/category scope and immutable artifacts; preserve all misses and chronology. |
| 8.5 | Run the finite registered development trial budget; preserve all diagnostics/failures, then freeze the candidate and contiguous release scope before final assessment. |
| 13.2 | Operations/storage owners provide representative real-model/population benchmark clearance, measured caps, retention plan, prices and v1/RSO reservations. Synthetic timings do not qualify capacity. |
| 13.4 | Implementation correction review is accepted. Scientific methodology acceptance and one authorized untouched evaluation still require frozen pins and custodian approval. No holdout was opened. |
| 14.1 | Complete the exact shadow packet with named environment, source/model/calibration/opportunity hashes, measured resource limits, cost/retention owner and exact future window. Local code pins are supplied separately; other fields remain unavailable. |
| 14.2 | After an approved packet and reviewed prospective producer wiring, capture future genuine issuance and settle it. Current prepared producer still refuses prospective/public classes. Observation time cannot be backfilled. |
| 14.3 | Independent untouched and prospective reports must support the prespecified contiguous subset, profiles, participation and both intervals. Current decision is no qualified subset. |
| 14.4 | Requires a qualified candidate plus separate exact-SHA/project/environment release approval, linked-build inventory and at-most-five-request smoke plan. No deployment authority exists. |
| 14.5 | All seven categories across H1–H10 require fresh preregistered evidence and accepted qualification. No real category/horizon cell is qualified. |
| 14.6 | RSO owner must accept transferred exact consumer changes, display lineage and side-by-side evidence, then receive separately approved bounded activation/rollback authority. Adapter remains disabled. |

Parents 2.0, 7.0, 8.0, 13.0 and 14.0 stay unchecked. All other parent tasks' local acceptance and NEW-01 through NEW-06 are recorded as complete. This does not narrow the goal to local engineering; these outstanding gates remain part of the same unfinished objective.

## Resume without losing custody

1. Recheck canonical branch, current diff, diaries, leases and exact ownership before edits. Verify source/review pins against the retained candidate; do not overwrite unrelated work.
2. Obtain 2.2/2.4 source/custody metadata and minimal approved cases first. No protected rows are needed to establish allocation metadata. Do not open protected labels merely because this goal says “all tasks.”
3. Resolve 2.5 with the scientific reviewer, then use the cleared development/calibration scope for 7.1/7.3/8.3/8.5. Keep final and prospective evidence separate. Do not retune against opened final labels.
4. Complete 13.2/13.4 and the missing fields in 14.1 before seeking exact external-action approval. Proposed caps stop admission at the first bound; they never delete retained history.
5. Keep API `enabled:false`, page `notFound:true`, and `RSO_V2_ADAPTER_ENABLED=false` until their separate accepted gates and approvals exist. No push, hosted migration, schedule, production job, acquisition, deployment, publication or spend is authorized by this handoff.

## Goal marker and action accounting

No persistent goal capability was exposed in the available tools, so **no actual goal marker is active**. The objective remains recorded in the task register and handoff; neither is represented as a native goal marker.

Remote builds/deployments/pushes/hosted migrations/schedules/provider requests/production application requests: **zero**. Protected-label access: **none**. Local checkpoint commit authority was explicit in the unattended goal. All remaining external operations are unattempted, with required prerequisites listed above.
