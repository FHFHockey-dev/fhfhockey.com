# P01 date identity extension — independent review, 2026-10-22

**Qualified acceptance of the pinned date-identity correction. No defect demonstrated within this packet.** The earlier accepted standings slice remains preserved. This does not accept the held finality, WGO grain/coverage, zero-score, RW/ROW, or broader calendar semantics.

## Independently verified behavior

- `2026-10-19` remains October 19 in the calendar cell, tooltip, and sidebar under both UTC and America/New_York. An actual start instant on October 20 UTC does not move that schedule date. Exact string keys feed WGO result/performance lookup, dated opponent strength, and grid matching.
- Real dated-strength indexing with filter-aware mocked queries selects October 19 for both a strong and a weak Boston control, with the prior date deliberately opposite. Synthetic WGO rows select the October 19 win and its `+4` goal differential / `50-30` shots, rather than the prior observation or conflicting score fallback. These tests establish date selection only; they do not qualify cumulative WGO grain or completeness.
- Start labels use the supplied UTC instant and explicit Eastern timezone. Independent controls cover spring DST (`1:30 AM EST` then `3:30 AM EDT`), the repeated autumn hour (`1:30 AM EDT` then `1:30 AM EST`), a UTC midnight crossing, December 31/year rollover, and February 29/leap-month rollover. Results are identical in both host zones. Owner empty/invalid-string start cases show `Start time unavailable`.
- The eight accepted standings cases still pass in both zones, including 2–6–3 → 7 points / 11 GP / 31.8%, invalid or mismatched snapshot unavailability, and measured zero values. AST extraction confirms eight summary, performance/rating, and color declarations are byte-identical to the accepted P01 baseline; see [formula verification](formula-verification.json). `getGameResult` and dated input selection change only where the patch changes date parsing/keys, not their points/scoring rules.

The bounded source contract inspected is `useTeamSchedule` mapping separate `games.date` and `games.startTime` fields to `gameDate` and `startTimeUTC`. The local generated `games` row type declares both as strings. This review does not establish the live database contents or extend admission to malformed schedule dates or arbitrary non-string timestamps.

## Checks and identity

Fresh isolated snapshot `/tmp/fhfh-queue-check-ns1q4he3/isolation/snapshot/web`; Node **22.11.0**, npm **10.9.0**, Vitest **3.2.7**. Used the queue source-copy recipe and established offline wrapper: cleared synthetic environment, isolated home/tmp, socket/HTTP(S)/unmocked-fetch denial, and mocked DB/WGO reads. No test root was the canonical checkout.

| Check | Result | Evidence |
| --- | --- | --- |
| Owner 14 + independent 10 cases, `TZ=UTC` | **24 passed** | [log](tests-utc.log) |
| Same cases, `TZ=America/New_York` | **24 passed** | [log](tests-new-york.log) |
| Component/owner-test scoped TypeScript | **Passed**, exit 0 | [config](tsconfig.p01-date.json), [log](typecheck.log) |
| Component/owner-test ESLint | **Passed**, exit 0, no diagnostics | [log](lint.log) |
| Five final pins, snapshot, reverse-patch baseline | All match | [start](hash-verification-start.json), [end](hash-verification-end.json) |
| Eight preserved declarations | Byte-identical | [receipt](formula-verification.json) |
| Changed application files `git diff --check` | **Passed**, exit 0 | [end](hash-verification-end.json) |

These are **24 distinct cases executed twice**, not 48 distinct cases. The [independent fixture](reviewCalendarDates.test.tsx) adds seven timestamp/date controls, two dated-strength controls, and one dated WGO performance control. Owner historical baseline failures were inspected, not rerun or counted as new evidence. The broader prior 65-test selection was not rerun.

Commands used `run-check.sh <snapshot> env TZ=<UTC|America/New_York> npm test -- --run --config audit.vitest.config.mts components/TeamScheduleCalendar/TeamScheduleCalendar.test.tsx components/TeamScheduleCalendar/reviewCalendarDates.test.tsx`; then `npm exec --offline -- tsc --noEmit --project tsconfig.p01-date.json` and the owner's two-file ESLint command via the same wrapper. Canonical diff checking was read-only.

Branch `octoberBranch`; snapshot HEAD `d77602cf7fbdd4549588127603ebf0b535138b99`. Acceptance is tied to these working-tree hashes; final HEAD is recorded in the end receipt. Reverse-applying the owner's patch in a private copy reproduces accepted P01 component `53121a1d2666c664e326159a982ef5efe36f9f8da3c082af81eab78211debbd7` and test `f16767f9da1ea35bcbd4b25351715da1c24ca9c6f3c86aae516bffc5dcf3468d`. All three hook pins remain unchanged.

| Candidate | SHA-256 |
| --- | --- |
| `web/components/TeamScheduleCalendar/TeamScheduleCalendar.tsx` | `a8514752a748ff9cd39e18037a2a2648e4290e684c96e3398901aac3cc8e85a3` |
| `web/components/TeamScheduleCalendar/TeamScheduleCalendar.test.tsx` | `ee6424542b502ec0448eb70f7bf21e590d91837b56d2adb1bad5ace2cb2ae124` |
| Owner `changes.patch` | `7382e2448afac5f3894c2bbf9e88ff0728c5a7497f733deafa94598b289671f1` |

## Limits and handoff

Held outside this packet: authoritative game finality/type and OT/SO interpretation; WGO row grain, cumulative differencing and coverage; zero-score truthiness display; RW/ROW naming; broader streak/performance cohorts and upstream standings correctness/freshness. The explicit Eastern label is deterministic for the tested instants; this does not approve all application timezone preferences, non-US historical timezone rules, malformed date admission, SSR/hydration, or real browser/AT/touch presentation.

No application or owner-artifact edits, ignored environment/credential reads, network/provider/production calls, browser session, dependency installation, build, commit, push, or deployment. No blocked, denied, pending, or uncertain action; commands completed. Parent owns integration and the outstanding semantic contracts.
