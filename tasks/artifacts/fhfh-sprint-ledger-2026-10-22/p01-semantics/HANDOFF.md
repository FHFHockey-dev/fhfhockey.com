# P01 continuation — date identity correction

Local review candidate on `octoberBranch`, base HEAD `67b9efda5901a5f8c25a25889572e85527056f7a`. Node `v22.11.0`, npm `10.9.0`. Only `TeamScheduleCalendar.tsx` and its nearest test changed. The accepted P01 season-summary code remains unchanged and its eight tests pass. No hook, shared consumer, producer or writer edits.

## Selected defect and correction

The bounded audit reproduced several remaining defects. **Date identity was the highest-risk correction with a sufficient source contract:** the hook supplies a date-only `gameDate` separately from a start timestamp. Before this patch, `2026-10-19` rendered on October18 in New York, and that shifted key selected the prior WGO/opponent-strength date. The same date-only value was formatted as a fictional start time (midnight UTC / 8PM on the prior date in New York).

The patch keeps the exact date string for joins and grid lookup, uses `parseISO` for date-only grid/label/sort operations, and formats the actual `startTimeUTC` separately with an explicit `America/New_York` timezone (EDT/EST label). Empty/invalid start timestamps show **Start time unavailable**. No formula, rating, finality or cohort definition is changed.

Deliverables: [separate application patch](changes.patch), [baseline pins](baseline.sha256), [candidate pins](final.sha256), [offline source probes](source-probes.cjs), [scoped TypeScript config](tsconfig.json).

## Verification and exact commands

All application commands ran from `/Users/tim/Code/fhfhockey.com/web`; source probes and Git/hash commands ran from its parent. All test data/DB reads were mocked. No ignored environment files were loaded.

| Command | Result / receipt |
|---|---|
| `TZ=UTC npm test -- --run components/TeamScheduleCalendar/TeamScheduleCalendar.test.tsx -t 'date identity'` before the source fix | Exit1: **3 failed / 3 passed / 8 skipped**; [before-utc.log](before-utc.log). |
| `TZ=America/New_York npm test -- --run components/TeamScheduleCalendar/TeamScheduleCalendar.test.tsx -t 'date identity'` before the source fix | Exit1: **5 failed / 1 passed / 8 skipped**; [before-new-york.log](before-new-york.log). |
| `TZ=UTC npm test -- --run components/TeamScheduleCalendar/TeamScheduleCalendar.test.tsx` | Exit0: **14 passed**; [after-utc.log](after-utc.log). |
| `TZ=America/New_York npm test -- --run components/TeamScheduleCalendar/TeamScheduleCalendar.test.tsx` | Exit0: **14 passed**; [after-new-york.log](after-new-york.log). These are the same14 cases under a second timezone, not28 distinct tests. |
| `./node_modules/.bin/tsc --noEmit --incremental false --project ../tasks/artifacts/fhfh-sprint-ledger-2026-10-22/p01-semantics/tsconfig.json` | Exit0, no diagnostics; [typecheck.log](typecheck.log). Component/test roots plus imports; not whole-repository TS. |
| `./node_modules/.bin/eslint --report-unused-disable-directives-severity warn components/TeamScheduleCalendar/TeamScheduleCalendar.tsx components/TeamScheduleCalendar/TeamScheduleCalendar.test.tsx` | Exit0, no diagnostics; [lint.log](lint.log). |
| `TZ=UTC node tasks/artifacts/fhfh-sprint-ledger-2026-10-22/p01-semantics/source-probes.cjs` | Exit0 before and after; [before](probes-before-utc.json), [after](probes-after-utc.json). |
| `TZ=America/New_York node tasks/artifacts/fhfh-sprint-ledger-2026-10-22/p01-semantics/source-probes.cjs` | Exit0 before and after; [before](probes-before-new-york.json), [after](probes-after-new-york.json). |
| `git diff --check -- web/components/TeamScheduleCalendar/TeamScheduleCalendar.tsx web/components/TeamScheduleCalendar/TeamScheduleCalendar.test.tsx` | Exit0. Focused final diff inspected. |
| `shasum -a 256 -c tasks/artifacts/fhfh-sprint-ledger-2026-10-22/p01-semantics/final.sha256` | All five file pins match. |

An initial new fixture used a broad `Win` text selector that also matched the legend; it was corrected to the tooltip header before the definitive baseline runs above. Initial logs are retained as `before-initial-utc.log` and `before-initial-new-york.log`, not counted as product evidence. Tests emit the existing `punycode` deprecation warning only.

The original65-test packet was **not** repeated. Only the affected calendar file ran: its eight accepted summary cases plus six new date cases. New cases cover grid/tooltip date, same-date WGO lookup using explicitly synthetic cumulative rows, tomorrow's scheduled-date control, actual timestamp/zone display and two unavailable-start-time controls.

## Other inspected semantics: unchanged and not accepted

The source-extraction harness executes current expressions in isolation with synthetic inputs; it imports only local TypeScript/date-fns libraries, not application clients. A successful probe records an observation, not passing product acceptance.

| Surface | Actual observation | Remaining action / contract blocker |
|---|---|---|
| Finality/type | `useTeamSchedule` turns `UNKNOWN` plus two score rows into `FINAL`, and a null game type into2. Calendar result logic assigns a win to past scored rows whether state is LIVE, UNKNOWN, FINAL or FUT. | **Per-game result correction is blocked on source authority:** selected `games`/`teamGameStats` fields expose neither authoritative final status nor regulation/OT/SO outcome. Need the parent/producer custodian to name the persisted, season/game-keyed finality and last-period contract, including missing/type semantics. No guessed field, date-as-finality, new provider fetch or stored-data repair was introduced. |
| WGO grain/coverage | Synthetic cumulative observations two games apart with a two-point increase are treated as a single game's win once date matching succeeds. Actual stored row grain is not established by the consumer's interface or null-to-zero normalization. | Need retained source/grain evidence and exact-game/snapshot completeness before changing cumulative differencing or ratings. The new date test explicitly does not certify WGO semantics. |
| Zero score | Tooltip score expression returns null for home0/away3, but returns `1-3` for a nonzero home control. The cell has the same truthiness guard. | Concrete remaining display defect, left untouched under the one-issue instruction. |
| RW/ROW | Header maps synthetic `regulation_and_ot_wins:25` into `regulation_wins:25`. No claim that an actual RW-labelled visible statistic was rendered or that stored counts are wrong. | Separate consumer/naming slice needed; hook and shared consumers are unchanged. |

No real-browser rendering/accessibility, malformed `gameDate` contract, live data, standings freshness, finality, completed regular-season cohort, WGO grain, or entire S02 acceptance is claimed. Explicit Eastern time labels are now deterministic; other application timezone preferences were not changed.

No network, production, NST, SQL, cron, dependency/lockfile change, build, commit, push or deployment occurred. TJ's active backfill/process was untouched. No shared-file conflict or denied/pending/uncertain tool action occurred. All local commands are finished; no process remains running from this packet. Lease is safely transferable to parent/independent review.
