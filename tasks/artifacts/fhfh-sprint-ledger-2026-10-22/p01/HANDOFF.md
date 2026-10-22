# P01 calendar standings display — local review candidate

Completed the assigned points-display slice; **not full S02 acceptance**. No shared-file collision or tool approval block occurred. All commands finished; no process/server remains running from this packet. The two changed application files are ready for parent/reviewer ownership.

Branch: `octoberBranch`. Base/current HEAD: `d3f057c6c849d5d5474bc912a6f461f617c65b15`. Runtime: Node `v22.11.0`, npm `10.9.0`. Canonical checkout: `/Users/tim/Code/fhfhockey.com`.

## Change and reproduced evidence

- `web/components/TeamScheduleCalendar/TeamScheduleCalendar.tsx`: Season Record and Season Overview now use the supplied matching `nhl_standings_details` snapshot for W/L/OTL, points, games played, point percentage and win percentage. The card labels the regular-season source and snapshot date. No derived calendar/WGO fallback is presented as an authoritative season record.
- Missing, wrong-team, wrong-season, non-integer/negative or internally inconsistent game-count snapshots show **Standings unavailable**. Genuine zero points remain zero; percentages with no games played are unavailable (`—`).
- `web/components/TeamScheduleCalendar/TeamScheduleCalendar.test.tsx`: eight mounted DOM tests with mocked DB and WGO sources. The baseline rendered `2-6-3`, **3.5 pts**, and 31.8%; the corrected candidate renders **7 pts**, 31.8%, and 11 games. A separate 3-win/2-OTL snapshot renders **8 pts**, 80% points percentage, 60% wins, and 5 games despite sparse/mixed calendar rows.
- Mixed rows include preseason, playoffs, unknown type, live, postponed, missing-score and future rows. This proves those rows cannot alter the **season summary**, not that individual game outcomes/finality are now correct.
- No changes to rating formulas, WGO queries/normalization, hook guards, stored data, ingestion, runner files, SoS or shared consumers. `useTeamSchedule`, `useTeamStatsHeaderData` and their tests match their initial hashes.

## Exact verification

Commands below ran from `/Users/tim/Code/fhfhockey.com/web` unless noted. No install or network operation was required.

1. Before application edit: `npm test -- --run components/TeamScheduleCalendar/TeamScheduleCalendar.test.tsx` → exit **1**, **8 failures**, including the mounted 3.5-points reproduction. Output: [before-test.log](before-test.log).
2. Final candidate: `npm test -- --run components/TeamScheduleCalendar/TeamScheduleCalendar.test.tsx hooks/useTeamSchedule.test.tsx hooks/useTeamStatsHeaderData.test.tsx components/TeamTabNavigation/TeamTabNavigation.test.tsx` → exit **0**, **65 tests / 4 files passed** (8 calendar + 51 schedule hook + 3 header hook + 3 tab navigation). Output: [after-test.log](after-test.log). Existing `punycode` deprecation warnings only. Run once after implementation and again after final JSX formatting.
3. `./node_modules/.bin/tsc --noEmit --incremental false --project ../tasks/artifacts/fhfh-sprint-ledger-2026-10-22/p01/tsconfig.json` → exit **0**, no diagnostics. [Scoped config](tsconfig.json), [typecheck.log](typecheck.log). Roots are the changed component/test plus the two inspected hooks and Next type bootstrap; their imports are checked. This is not a full-repository typecheck.
4. `./node_modules/.bin/eslint --report-unused-disable-directives-severity warn components/TeamScheduleCalendar/TeamScheduleCalendar.tsx components/TeamScheduleCalendar/TeamScheduleCalendar.test.tsx hooks/useTeamSchedule.ts hooks/useTeamStatsHeaderData.ts` → exit **0**, no diagnostics. [lint.log](lint.log).
5. From repository root: `git diff --check -- web/components/TeamScheduleCalendar/TeamScheduleCalendar.tsx` → exit **0**. Scoped final diff inspected; no unrelated edits in this packet.
6. From repository root: `shasum -a 256 web/components/TeamScheduleCalendar/TeamScheduleCalendar.tsx web/components/TeamScheduleCalendar/TeamScheduleCalendar.test.tsx web/hooks/useTeamSchedule.ts web/hooks/useTeamStatsHeaderData.ts web/hooks/useTeamSchedule.test.tsx web/hooks/useTeamStatsHeaderData.test.tsx` → exact byte pins in [final.sha256](final.sha256); initial clean source pins in [baseline.sha256](baseline.sha256).

## Unchanged source findings and limits

These were inspected, not corrected or remotely verified, because they need a separate source/result contract and would expand the assigned display fix:

- `useTeamSchedule.ts:381,445–457`: missing game type defaults to 2; paired score rows cause `gameState: "FINAL"`. The selected `games` fields and `teamGameStats` fields contain no finality or last-period evidence. The generated schema corroborates this (`database-generated.types.ts:5930,30249`). Do not add a guessed field or infer finality from two scores. A separate producer/source decision is needed.
- `TeamScheduleCalendar.tsx`, `getGameResult`: WGO points/record deltas assume cumulative semantics; fallback score losses infer regulation without reliable period evidence. Individual results, streaks, home/away fallbacks and performance cohorts still require full S02 review. This patch deliberately does not redefine those ratings or result classifications.
- The same component still parses date-only strings through `new Date`, which is not a verified date-only display contract; tooltip/cell score truthiness also hides home zero. No timezone/browser test was run and neither defect is claimed fixed.
- `useTeamStatsHeaderData.ts:108–112,145–166`: header core record comes from `team_summary_years`, while the calendar receives `nhl_standings_details`. Both queries are season-scoped, but cross-source freshness/production agreement was not proved. `regulation_wins` is populated from `regulation_and_ot_wins`; the broader ST02b consumer correction remains outstanding.
- DOM fixtures test the supplied authority and computation. They do not establish real DB contents, publication completeness, standings freshness, full-season WGO coverage or all calendar/UI behavior. No browser, broad suite, build, production request, NST request, migration, dependency/lockfile change, commit, push or deployment ran. TJ's active NST process and files were untouched.

Independent review should verify the pinned diff and the summary-only contract; do not credit this as completion of source/finality/timezone/OT/RW portions of S02. No denied, pending or uncertain external action exists.
