# A7–A9 stats fixes

- Scope: percentUnits matched/null samples, GoalieShareChart incomplete pagination, useShotData request ownership; isolated synthetic regressions only. No FORGE/Yahoo work or external requests.
- Where: canonical `/Users/tim/Code/fhfhockey.com`, `octoberBranch`, base HEAD `a811b0762ffe29006c3df7eaa4c19bf18deecda3`. Parent explicitly assigns packet S; existing dirty stats work must remain intact.
- Start: read repository instructions, queue/verification recipe and A7–A9 report pointers. Node 22.11.0/npm 10.9.0 available. Broad pre-existing dirty work recorded in initial status.
- Next: inspect assigned files and consumers; preserve initial bytes/hashes in private scratch, run guarded offline red regressions, patch, rerun narrow checks, hand off fixed hashes.
- Contract: prefer unknown full-window metrics when required counts/exposures are incomplete. Any consumer edit outside assigned packet requires coordination first.
- Blockers: none; no external actions attempted. Parent handles usage and independent review. No further delegation.

## Checkpoint 1
- Preserved pre-edit source snapshot and all file hashes at `/tmp/fhfh-queue-check-3_hiunsv`; original A7/A8/A9 reproductions failed (3/3) under the queue's network-deny recipe. Receipt `/tmp/fhfh-a7-a9-baseline.log`.
- Added focused chart pagination and hook lifecycle tests. Eight selected new regressions fail against pre-edit code; receipt `/tmp/fhfh-a7-a9-new-regressions-red.log`.
- A8 now rejects incomplete/invalid/changing page metadata and throws after repeated 429; it withholds every chart window and displays unavailable. Retries/concurrency/span caching preserved.
- A9 now retires obsolete effects, guards async state writes and follow-on page reads, uses stable filter values, restores cached loading state, and only returns data for the current key. Offline async checks running.
- Coordination attempt to source thread `01a15411-3560-7632-8d31-1dd2447ba00e` through send_message_to_thread returned `thread not found` (not delivered). Needed consumer scope is already expressly included in the delegation (“affected consumers only as necessary”); queue's original unconfirmed ownership gate is superseded by assignment and trusted idle/no-collision evidence. Narrow necessary null-display/type adjustments remain within A7; no unrelated files will be touched.

## Checkpoint 2
- A8/A9 targeted checks passed 33/33 at `/tmp/fhfh-queue-check-7xeisxoe`; receipt `/tmp/fhfh-a7-a9-async-green.log`. Added an additional synthetic eight-request concurrency assertion afterward.
- A7 adds complete-field sums, null unknown game exposure, and unknown labels in the three necessary consumers. Before editing, all eight A7 source/consumer/test files were checked against the initial snapshot and matched. New A7 regressions produced 37 expected failures against original implementations (`/tmp/fhfh-a7-a9-a7-red.log`).
- First combined run: 106 passed/2 failed; both failures were new display-test oracle mistakes (dashboard uses N/A, one sample label includes 5v5 prefix), now corrected against actual existing presentation conventions.
- Inspection exposed direct aggregate-null→zero coercion in dashboard rank calculations. Removed those coercions; incomplete current/peer aggregate ranks remain unavailable, real zero values remain rankable. Two new rank regressions fail against original code, zero-value control passes (`/tmp/fhfh-a7-a9-ranks-red.log`).
- Next: pin final bytes; run relevant tests plus original reproductions, focused lint/type checking; review only task delta and hand off hashes. No production/provider calls or deployment actions.

## Handoff
- Final pinned snapshot: `/tmp/fhfh-queue-check-xtvh43r9/isolation/snapshot/web`. All 111 focused tests across 8 files plus 3 original reproductions passed. Scoped tsc exit 0. Focused ESLint exit 0 with two unchanged goalie image warnings. Diff/added-line whitespace checks passed.
- Scoped tsc initially caught two unsupported `getByRole` test options; fixed, restaged, and reverified. No implementation failure remains.
- All 12 edited source/test files still match final snapshot hashes; HEAD/branch unchanged. No FORGE/Yahoo/dependency/generated/migration/deployment edits.
- Durable review handoff: `tasks/artifacts/claude-audit-fixes-2026-10-22/a7-a9-stats/REPORT.md`, `CANDIDATE.json`, `SHA256SUMS`, packet-only patch, offline receipts, and verification helpers. Manifest SHA-256 `9d6bdf59238ca38259f0e75a4098cde543926a10cfac3dad7a8198cd21364486`.
- Next: parent/independent reviewer checks fixed hashes and accepts or requests corrections. Diary retained for handoff; not a release deliverable. No pending external action, denial, or uncertain outcome; the failed parent-message attempt was not delivered.

## A7 review follow-up start
- Parent returned the bounded R1 consumer-query gap. Independent review accepts A8/A9; their four changed source/test files are frozen for this follow-up.
- Reviewer demonstrated two failures with filter-aware queries: `.gt(games_played/gp, 0)` drops existing null-exposure rows before helpers can preserve unknowns. Same admission gap statically traced in strength and season/league-count reads.
- Scope: retain unknown exposures while excluding known zero-game rows before L10 limits, add realistic predicate-aware consumer regressions, update fixed hashes/receipts. Existing score-state observed-sample averaging is a separate labelled contract.
- Next: verify starting candidate hashes, inspect reviewer fixture and bounded query reads, reproduce R1 offline, patch only A7 consumers/tests, verify and return for review. No external actions or release authorization.

## A7 review follow-up checkpoint
- All 12 prior candidate hashes matched at start. Original reviewer fixture reproduced 2 failures in `/tmp/fhfh-queue-check-4uhrqejj`; added cross-consumer filter-aware suite reproduced 9 failures with 1 complete/bounded sample control passing.
- Changed exactly six count-query exposure predicates across the three consumers to `neq.0 OR is.null`, preserving null/invalid exposure and excluding only known zero before sorting/limits. Labelled score-state per-game averaging unchanged.
- New `web/lib/stats/teamCountConsumers.test.tsx` executes equality, SQL-like comparison/null OR, date bounds, ordering, limits, range pagination, and field projection. It covers L10, all strength tables, full-season WGO and both league-ranking reads; control verifies team/season/date bounds and zero-row exclusion before L10 limits.
- Existing consumer query mocks support the new OR operator; their query-shape assertions were updated. Helpers and A8/A9 files unchanged.
- First verification: nearest 5 files passed (89 tests), scoped tsc/lint passed. Replayed reviewer fixture needed OR support and a diagnostic-only plural lookup because the correct UI now has two matching incomplete notes; required-unknown assertions remain unchanged. Final replay running.

- Final replay passed all 91 tests; scoped typecheck and changed-file lint both passed with no diagnostics. The packet-handoff assertion caught an external HEAD advance to `d3f057c6c849d5d5474bc912a6f461f617c65b15`. Read-only comparison confirms that commit changes only the streamlining task document. All 13 packet files still match tested bytes; concurrent drift outside this packet is confined to the account InSeasonPanel source/test. Those files are outside this packet's checks and remain untouched. Handoff will record tested HEAD and observed HEAD separately rather than claim HEAD was unchanged.

## A7 R1 handoff
- Final candidate is pinned in updated `CANDIDATE.json`/`SHA256SUMS`; manifest SHA-256 `9676ea6d91dc9602be94a4c6934e6ac69d368bc2aaac6febff6040ea34e1c227`. Exactly 7 files changed in R1; cumulative packet 13 files, A8/A9 four files byte-identical.
- `R1.md` records exact changed-file inventory, predicate-aware red→green evidence, 91 passed tests, scoped tsc/lint exit 0, replay adaptation, tested/observed HEAD difference, and remaining upstream-completeness limits. R1-only and cumulative patches are preserved, along with revision-1 candidate metadata.
- Next: independent A7 re-review. No implementation blocker or pending external action. Retain this diary for the handoff, outside release deliverables.
