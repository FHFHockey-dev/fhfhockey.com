# Independent shift-chart fix review

Reviewed 2026-11-12 on `octoberBranch`, HEAD `496b5c9de402dcb8bf91650cea0505447bc327f6`, against the assigned uncommitted diff. Reviewer runtime was verified as `gpt-6.1-sol` / `high`; Chef as `gpt-6-astra` / `xhigh`.

## Findings

No actionable defect found in this bounded review. This is a local code review, not production acceptance or release approval.

## Assessment

- `buildCanonicalShiftIntervals` validates source identity, metadata consistency, clocks, positive duration, period bounds, final PBP and both-team coverage before merging. The zero-end sentinel is resolved against the played period end before the union. Overlaps, nested intervals, duplicate physical intervals with different shift numbers, and adjacent intervals become nonoverlapping intervals per player/period. Output objects are cloned; calculations do not mutate the source rows or the raw snapshot.
- Strength totals and relationship strength segments use the same canonical union. The route uses that union for player game TOI and pair intersections, while persistence still receives the original source hashes. Per-player and shared-time bounds fail closed before publishing relationships.
- The materializer version participates in the input fingerprint. Default relationship queue selection filters to the current input materializer; relationship persistence independently rejects pre-union input manifests. The existing SQL RPC locks the manifest and checks input fingerprint plus input version, so a concurrent re-ingestion cannot silently bind these rows to another input generation.
- The DRM reader excludes every player and pair fact from a game with malformed/missing TOI, accounts for excluded rows, and scopes card statistics to retained games. It does not fabricate TOI for pending rows. Its identity/scope validation remains strict.

## Checks and limits

- Read the assigned ten-file diff, relevant calculation/route callers, input fingerprint construction, existing RPC CAS boundary and adjacent tests.
- Inspected the offline replay harness and captured fixture structure to check its scope and remote-call blocking. Did not rerun or independently certify its result.
- `git diff --check` passed for all ten assigned files.
- No tests executed by this reviewer: no concrete concern remained that warranted duplicating the implementer's targeted test execution. The inspected tests cover partial/nested overlaps, changed shift numbers, zero-end boundaries, immutability, canonical reapplication, mixed input-version rejection and invalid-TOI game exclusion.
- Production cron order, live RPC behavior, historical repair coverage, deployment and restored user-visible freshness were not verified here. Existing rows are not repaired by the reader fallback or the version bump; they require the separately bounded re-ingestion/relationship repair plan. Directly targeting an old-input game intentionally rejects it until re-ingestion.

No application code or tests were edited. Review output and the task diary are the only reviewer-owned files.

## Final nominal-length and chronology follow-up

No actionable finding in the newly added `buildSituationTimelineForPeriod` nominal-length/period-type checks or the numeric comparators in `shiftChartRelationshipPayload.ts`.

- Regulation uses 1,200-second nominal periods. Preseason/regular-season P4 uses 300 seconds; playoff P4 and later overtime periods use 1,200 seconds. Nominal length remains distinct from the earlier played terminal, preserving legitimate sudden-death OT. The inspected existing tests now cover shortened preseason/regular-season/playoff OT and second playoff OT, and reject incompatible period definitions.
- The strict clock parser accepts padded and unpadded valid clocks, rejects unsafe integer seconds, and numeric comparisons correctly order `2:00` before `10:00`. Raw string values remain unchanged. Equal numeric clock spellings have a canonical-JSON tie-breaker, preserving permutation-independent output and relationship fingerprint inputs.
- All parallel relationship arrays derive from the same sorted `shifts` array; PP/ES arrays use corresponding numeric keys. The algorithm version is already being bumped in this same unreleased candidate, covering the ordering change.
- Read the changed implementation and existing tests plus the bounded parser/fingerprint contracts. `git diff --check` passed for these four files. No test rerun or application edit in this follow-up; Chef owns the final TypeScript check.

This scoped no-findings result does not close the independent strength-timing qualification blocker documented in `MATH-CLOCK-REVIEW.md`.
