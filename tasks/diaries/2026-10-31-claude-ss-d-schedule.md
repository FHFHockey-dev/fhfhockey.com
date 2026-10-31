# SS lane D: Off-Night Edge (6.0)

- **Scope:** `offNightEdge` five-file set, lane barrel `lanes/schedule.ts`, `e2e/social-share-schedule.spec.ts`, receipt `lanes/d-schedule.md`.
- **Where:** `octoberBranch`, canonical checkout; base `7bddeaf0d`.
- **State:** all subtasks implemented; 22 tests, eslint, pure check, tsc on my files and e2e `--list` passed. Browser and full loader render not run.
- **Decisions:** `selectScheduleDates` counts future games only, so mid-week a seven-day selection equals rest of week. Weekly therefore counts all regular non-postponed games Mon-Sun through `calcWeekScore` with the same inputs; parity with edition rows is tested. Unready schedule publishes no order (data null).
- **Gotcha:** `buildScheduleSnapshot` marks a read `missing` if `retrievedAt` is after `generatedAt`, so the loader stamps generatedAt after `getSchedule`, like `server.ts`.
- **Next:** lead renders the post and runs the spec at 13.0; check layout of the weekly card.
- **Blockers:** none. Full loader render is the lead's (needs more than 50 rows, plus the NHL schedule call).
