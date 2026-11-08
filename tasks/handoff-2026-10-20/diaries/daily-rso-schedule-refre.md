# Handoff diary: daily RSO schedule refresh

## 1. Scope
- Task from "Code handoff review" (local_08a0bf1c): design and build, locally, a recurring bounded refresh of `roster_optimizer_team_games`. The goal is to keep the RSO schedule "complete".
- What "complete" means: `planningInputs.ts` `hasScheduleCoverage` needs every date from startDate−1 to endDate+1 to carry an `nhl-source-days-v1` witness fetched within 36 h. Otherwise totals become estimates and Best Fit cannot rank adds.
- Constraints:
  - No deploy, scheduler change, DDL or production calls.
  - Chef (local_4317ea20) required the wrapper shape `withCronJobAudit(adminOnly(...))`, a bounded runtime, and a proposed slot with no cross-provider cron collision.

## 2. Where
- Branch: `octoberBranch`.
- My three files were committed by TJ in `b8fe1072e` ("sfgsdfgsdfgsdf", 2026-10-19 20:57 −0400). That commit is **not** an ancestor of `master`. HEAD is now `392c02af2` (sync from R6f `b630e0767`).
- Files:
  - NEW `web/pages/api/v1/db/cron/update-roster-optimizer-schedule-daily.ts`
  - NEW `web/__tests__/pages/api/v1/db/update-roster-optimizer-schedule-daily.test.ts`
  - EDIT `web/lib/rosterScheduleData/planningInputs.ts`: `hasScheduleCoverage` exported (1 line)
  - `web/vercel.json`: NOT edited. The cron line is a proposal.
- Full notes, including the pg_cron SQL and the V2 DDL needs: `/Users/tim/Library/Application Support/Claude/side-session-notes/local_08a0bf1c-fda1-4d08-9f56-8ff961d00e41/rso-daily-schedule-refresh-2026-10-19.md`
- Prior design this builds on: `tasks/artifacts/schedule-refresh-recurring-2026-10-15/` (V2 proposal, reviews, `database-prerequisite.sql`) and `tasks/artifacts/forge-serving-release-review-2026-10-17/B2-SCHEDULE-REFRESH-PROPOSAL.md`.

## 3. State
- **The route** (`/api/v1/db/cron/update-roster-optimizer-schedule-daily`, GET or POST, audit job `update-roster-optimizer-schedule-daily`):
  1. Off-season skip.
  2. Rejects any query parameter except `ignoreOffSeason`.
  3. Window = `recurringRange`: current + next New York Mon–Sun weeks ∪ the active Yahoo period, ±1 day, ≤31 days. That is 10-18..11-02 for 10-21.
  4. Runs the existing legacy bounded writer in-process with a 120 s deadline; on timeout it returns 504 `writeOutcome=unknown`.
  5. Reads the window back (≤1000 sides) and runs `hasScheduleCoverage`. Complete → 200; incomplete → 409 `SCHEDULE_COVERAGE_INCOMPLETE`.
  - Skips: no active Yahoo period → 200 skip. More than 90 days after key 477's last period → 409 `PROFILE_RENEWAL_REQUIRED`.
- **Checks** (all on the final code, 2026-10-19):
  - New test file: 10/10.
  - Neighbouring tests: 107/107 (update-roster-optimizer-schedule, cron-audit-wrappers, cron-auth-boundaries, combinedCronInventory). An earlier run was 139/139.
  - `tsc --noEmit -p .` under the heavy lock: exit 0, 0 errors.
  - eslint on the 3 files: clean.
- **Not released.** On master, none of these are present: the route, a vercel.json cron line, witness stamping in `source.ts`, or the witness check in `planningInputs.ts` (checked 2026-10-20).
- No hosted, API, cron or DDL calls were made.

## 4. Next
- No further task is planned in this lane. The next step depends on TJ's approvals (section 5).
- If they are approved, the first step is to add `{ "path": "/api/v1/db/cron/update-roster-optimizer-schedule-daily", "schedule": "52 8,14 * * *" }` to `web/vercel.json` `crons` in the release candidate. Then re-run `lib/cron/combinedCronInventory.test.ts` and `__tests__/pages/api/v1/db/cron-audit-wrappers.test.ts`.

## 5. Blocked / needs TJ
1. **Cron line approval.** Vercel `52 8,14 * * *` (04:52 / 10:52 ET; one missed run still keeps stamps under 36 h). The minimum alternative is `52 8 * * *`. The pg_cron alternative is in the notes file.
2. **Release vehicle.** The route + cron must ship in the **same release** that brings the octoberBranch witness slice to master (`source.ts`, `normalize.ts`, `types.ts`, `update-roster-optimizer-schedule.ts`, `planningInputs.ts`). Otherwise production RSO turns into estimates 36 h after the last manual refresh.
3. **Accept or reject the open overlap risk.** Two overlapping writers can let an older observation replace a newer one (V1 review finding P2). The alternative is the DDL-gated V2 route. Never activate both.
4. **Optional bridge.** The 10-19 manual stamps expire about **2026-10-21 08:00Z**. Before the release, one approved POST to this route on a local dev server (not port 3000) would cost 3 NHL GETs, about 220 upserted rows in production `roster_optimizer_team_games`, and 1 audit row.

## 6. Insights
- **The brief's "yesterday − 1" window is wrong.** The RSO default view reads from period start − 1, so from Wednesday on, Monday's rows would age past 36 h. Use `recurringRange`, as B2 also found.
- **A recurring route already exists:** octoberBranch has an unreleased V2 route `refresh-roster-optimizer-schedule.ts` + `recurring.ts`.
  - It was independently ACCEPTED, with 12/12 real PostgreSQL cases passing.
  - It needs unapplied DDL: `roster_schedule_observation_clock`, `commit_recurring_roster_schedule`, and 2 triggers on the table, including a row trigger that also blocks stale or equal legacy writes. No migration file exists in `supabase/migrations`.
  - It has no off-season skip and pins 477 / 2026 / 20262027.
- **Production bytes strip witnesses.** Running master's `update-roster-optimizer-schedule` (either mode), or any full-mode run, removes them.
- **Cost per run:** the legacy writer also pages the whole season's cached rows (about 2,600) for its change summary. NHL reads are 3 normally, 5 at most (one per 7-day page).
- **Collision checker blind spot:** `findCrossProviderCronCollisions` ignores "unclassified" routes, so it cannot flag this one; result `[]`. 09:50 UTC was avoided because pg_cron `build-projection-derived-v2` runs then. Hours 8–11 are dense with pg_cron jobs, and minute :52 is clear.
- **Game key 477 is pinned** in both `RECURRING_PROFILE` and `DEFAULT_YAHOO_GAME_KEY`. The 2027-28 season needs both changed.
- **Test gotcha:** a second `vi.useFakeTimers` call inside a test did not take effect until I called `vi.useRealTimers()` first.
