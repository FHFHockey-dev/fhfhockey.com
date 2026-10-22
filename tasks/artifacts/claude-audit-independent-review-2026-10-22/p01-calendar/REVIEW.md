# P01 calendar display independent review — 2026-10-22

**Accept the pinned season-summary display slice. No blocking defect demonstrated within that slice.** This is not full S02/calendar acceptance. Finality, timezone, WGO result interpretation, RW/ROW, and broader source/freshness work remain explicitly held for their own packets.

## Observed result and scope

- The matching EDM 20242025 snapshot with W/L/OTL **2–6–3**, points **7**, and GP **11** renders `2-6-3`, `7 pts`, `31.8%`, and 11 games. The previous half-points display calculation has been removed.
- Season Record and Season Overview take the supplied matching standings snapshot as their authority. Sparse/mixed calendar rows do not change those summaries: the separate 3–0–2 snapshot renders 8 points, 5 games, 80.0% points percentage, and 60.0% win percentage. This verifies summary isolation, not validity of the individual mixed calendar rows.
- Missing/wrong-team/wrong-season snapshots, missing numeric fields, negative/noninteger/nonfinite/unsafe numeric values, numeric strings, inconsistent GP versus W+L+OTL, and points above 2×GP are withheld in both summaries. Same-component season changes immediately withhold the prior season's snapshot and adopt a matching replacement.
- Measured zero points with three played losses renders 0.0%; zero-game exposure renders percentage placeholders. Values are not fabricated from calendar coverage.
- The arithmetic uses supplied `points`, W/L/OTL, and GP. This review does not independently prove the upstream snapshot's correctness/freshness or every possible cross-field invariant (for example a separate `points === 2*wins + ot_losses` assertion). The patch does not reconstruct or overwrite authoritative source points.

## Rating and source boundaries

The actual diff is restricted to season-summary admission/formatting, removing the three obsolete derived summary fields and their now-unused denominator. TypeScript AST extraction confirms byte-identical declarations before/after for `getGameResult`, `calculateGameRating`, `gamesWithResults`, `getPercentageClass`, `getPointsPercentageClass`, and `getLeagueRankingClass`. [Comparison receipt](rating-formula-verification.json).

Both schedule/header hooks and their tests exactly match the owner's baseline/final pins. They were read as bounded dependencies, not modified. The caller's standings read filters season/team, orders by date, and supplies the row; data availability/publication completeness was not verified.

The owner's held issues remain held: inferred FINAL status/default game type, WGO cumulative-vs-game interpretation, loss/OT classification, date-only timezone behavior, hidden zero scores, `regulation_and_ot_wins` mapped to regulation wins, header/calendar source agreement, streaks/home-away/performance cohorts. Empty-calendar rendering and remaining raw diagnostic standings displays also remain outside the two-summary acceptance. The independent synthetic NaN fixture produces a React warning from the unchanged raw `standingsDetails.points` diagnostic display at component line 1996; the two reviewed summaries still correctly show unavailable. The warning is retained in the test log, not suppressed or represented as a new regression.

## Independent verification

Fresh isolated snapshot: `/tmp/fhfh-queue-check-h71qkf0k/isolation/snapshot/web`. Node **22.11.0**, npm **10.9.0**; cleared synthetic environment, isolated home/tmp, socket/HTTP(S)/unmocked-fetch denial, existing dependencies. DB/WGO reads mocked; no real provider or production traffic.

| Check | Actual result | Evidence |
| --- | --- | --- |
| Owner's mounted component suite | **8 passed** | [log](owner-tests.log) |
| Independent invalid-value/season-transition/zero fixtures | **13 passed** | [fixture](reviewCalendarStandings.test.tsx), [log](independent-tests.log) |
| Scoped TypeScript: component/test, two hooks, bootstrap/imports | **Passed**, exit 0 | [config](tsconfig.p01.json), [log](typecheck.log) |
| Scoped lint: component/test and two hooks | **Passed**, exit 0, no diagnostics | [log](lint.log) |
| Component diff whitespace | **Passed** | `git diff --check -- web/components/TeamScheduleCalendar/TeamScheduleCalendar.tsx` |
| Six source/test pins, current vs snapshot | **Matched before/after** | [start](hash-verification-start.json), [end](hash-verification-end.json) |
| Six result/rating/color declarations | **Unchanged** | [receipt](rating-formula-verification.json) |

The owner's 65-test neighbor selection and baseline eight failures were inspected as historical evidence, not rerun or counted as independent passes. The hooks were byte-identical and no shared behavior changed; only the eight component cases plus 13 new cases were executed. Used the established offline `run-tests.sh` wrapper for `components/TeamScheduleCalendar/TeamScheduleCalendar.test.tsx` and `lib/reviewCalendarStandings.test.tsx`. Typecheck used `npm exec --offline -- tsc --noEmit --project tsconfig.p01.json`; lint used the owner's four-file command via `run-check.sh`.

## Candidate identity and remaining limits

Branch `octoberBranch`; independently tested HEAD `716896be8325a64f5cbd3ece9a1fdab48c50733f`. Owner recorded earlier HEAD `d3f057c6c849d5d5474bc912a6f461f617c65b15`; all six pinned P01 bytes still match, and the original component hash matches HEAD source. Concurrent route-runner/admin/P03 work is not included in acceptance.

| Changed file | SHA-256 |
| --- | --- |
| `web/components/TeamScheduleCalendar/TeamScheduleCalendar.tsx` | `53121a1d2666c664e326159a982ef5efe36f9f8da3c082af81eab78211debbd7` |
| `web/components/TeamScheduleCalendar/TeamScheduleCalendar.test.tsx` | `f16767f9da1ea35bcbd4b25351715da1c24ca9c6f3c86aae516bffc5dcf3468d` |

All six exact source/dependency pins are in the hash receipts. Original component SHA-256: `ee3bdbf2283c8110a1b6ca912e0e755e71cc8e3f774136cc492f1706fb9bb2cf`. An unrelated external commit advanced canonical HEAD to `38749d5036b1b474f4659222d70d523dcded8855` before handoff; the end check confirmed all six P01 files still match the tested snapshot and records the unrelated changed paths.

No browser/AT/touch/timezone validation, full suite/typecheck/build, live data comparison or production verification. No application/owner-artifact edits, dependency installation, credential reads, network/production/NST requests, commits, pushes, migrations or deployments. P03 untouched. No denied, pending, or uncertain external action. Parent owns integration; broader S02 holds remain.
