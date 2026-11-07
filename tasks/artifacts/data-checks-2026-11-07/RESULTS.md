# Data checks after release #414 (2026-11-07)

These are production checks, mostly read-only: SELECTs through the Supabase plugin connector and one Vercel deployment-list read. TJ approved the two backfills in check 5 and check 6 by pop-up, and they ran once each with the bounds stated below. The exact queries are in `tasks/diaries/2026-11-07-claude-data-checks.md`.

| # | Check | Result |
|---|---|---|
| 1 | Hand-applied migrations | No change in state. The registry evidence was refreshed and the test passes (21/21). |
| 2 | Yahoo sticky status, step 5 | Passed and closed. |
| 3 | Luna in production | Confirmed. |
| 4 | `rosters.official_seen_at` | **Waiting.** The first nightly run is at 02:00 UTC on 11-08. |
| 5 | PP units rerun 09-29 → 10-30 | **Done**, with TJ's approval: 216/216 games, 0 failed, and 99.2% of rows now match WGO PP TOI. |
| 6 | NST goalie HD/GS | The 10-25 → 11-03 range was already complete. A new gap (11-04 → 11-06) was found and backfilled with TJ's approval. All 30 table/date combinations are verified. |

## 1. Hand-applied migrations

| Migration | In `schema_migrations` | Catalog | Registry state |
|---|---|---|---|
| 20261106210000 x_timeline_watchdog | no | `x_timeline_watchdog` is present: security definer, empty search_path, execute for service_role only. Cron job 401 `x-timeline-watchdog` runs every 5 minutes and is active. | unknown (unchanged) |
| 20261106220000 watchdog loud alerts | no | **Not applied.** `x_timeline_watchdog_label` doesn't exist, and the live watchdog has no `test_alert` mode and no 🚨 subject. | pending (unchanged) |
| 20261106233000 cron_job_audit index | no | `cron_job_audit_run_time_idx` is valid and ready. Its definition, `(run_time, job_name, status, rows_affected)`, matches the file. | unknown (unchanged) |

I added the readback to `stateEvidence` for rows 115–117 in `migration-authority.json`. The counts stay at 119 total, 79 applied and 10 pending, so `supportedBaselineMigration.test.ts` and the super-goal summary needed no edit. The test passes 21/21.

**Open items for TJ:**
- Loud alerts are still not applied.
- The other two need an approved `supabase migration repair --status applied` before they can be marked applied.

## 2. Yahoo sticky status, step 5

The check used the 11-07 08:40 UTC `update-yahoo-players` run. The audit marks it `partial`, but only because 1,031 rows had no ownership data, which is Scout's lane. All 1,610 rows were upserted, with 0 rows omitted by the provider and 0 deferred.

- **Coverage:** all 1,610 game-477 rows were refreshed, and no stale flags remain.
- **Status counts, 11-04 → 11-07:**
  - DTD: 118 → 13
  - IR: 102 → 66
  - O: 40 → 10
  - IR-NR: 28 → 18
  - IR-LT: 22 → 18
  - NA: 888 → 791. This is a real Yahoo value for players off active rosters.
  - No status: 410 → 694
- **Named players:** McAvoy and Bedard are both clear.

These results are also recorded in `CLEANUP-PLAN.md` and in the Yahoo diary.

## 3. Luna in production

Vercel `list_deployments` (project `fhfhockey`, sha 00ea36b39, target production) returned one deployment: `dpl_Eq1QaL9XDs1Bp3oWd3v9NV3TCEJW`, READY, from master, release #414, created at about 21:16 UTC on 11-07. The tree at that commit contains `web/pages/api/internal/luna-binding-check.ts` and `luna-review.ts`.

## 4. `rosters.official_seen_at`

`update-players-job` (jobid 6) runs on schedule `0 2 * * *` and is active. Right now 0 of the 5,227 `is_current` rows have a stamp, which is expected: the migration was applied at 19:29 UTC and the first run after it is 02:00 UTC on 11-08. Two follow-ups remain after that run:
- Rerun the count query in the diary (Q7).
- Do a read-only replay of the pending Schwindt (FLA) and Hryckowian (DAL) queue items.

## 5. PP units rerun

**Sizing (before the run).** Every day from 10-31 to 11-06 already matched WGO `pp_toi` within 2 seconds on 100% of rows, because the fixed writer has been live since #402. The 09-29 → 10-30 range covered 32 dates and 216 games, with 6,098 stored rows of which 2,948 matched (48%). The plan was 32 one-day calls, about 648 NHL requests, and no NST or Yahoo calls.

**Run (TJ pop-up approval, 21:29–21:30 UTC on 11-07).** Calls went to `GET https://fhfhockey.com/api/v1/db/update-power-play-combinations?startDate=D&endDate=D`, one day per call, one call at a time, stopping on any non-200 response.

- I ran 09-29 alone first. It went from 84/135 matched to 118/120.
- The remaining 31 days took about 30 seconds in total.
- Every call returned HTTP 200: 216 games processed, 0 failed, 0 skipped.
- 15 rows were kept as `keptUnproven` across all days.

**After the run.** 5,046 of 5,085 rows match (99.2%). 1,013 stale rows were deleted under the boxscore-TOI guard.

The days still short of 100% are:

| Date | Matched / rows |
|---|---|
| 09-29 | 118/120 |
| 10-09 | 95/96 |
| 10-10 | 331/335 |
| 10-17 | 286/291 |
| 10-22 | 272/280 |
| 10-24 | 248/253 |
| 10-26 | 70/71 |
| 10-27 | 238/250 |
| 10-29 | 267/268 |

These are mostly the kept-unproven rows plus partial shift feeds. Inspect them, worst first: 10-27 and 10-22.

**Not done: derived rebuilds.** `update-rolling-player-averages`, `update-team-unit-toi` and `update-lineup-deployment-tallies` for 09-29 → 10-30 still hold the old values. They are not sized and need their own approval.

## 6. NST goalie HD/GS

**Read-only check first.** TJ's 11-01 backfill held. Checked against WGO with the card's join, every date from 10-25 to 11-03 is complete. A new gap opened after that:

| Date | WGO goalies | NST `all_counts` |
|---|---|---|
| 11-04 | 8 | 0 |
| 11-05 | 22 | 0 |
| 11-06 | 7 | 0 |

All ten tables stopped at 11-03, except `5v5_counts`, which reached 11-04. There have been no `update-nst-goalies` audit rows since the 11-01 /db runs, so the 08:30 cron runs are going unaudited again. The released route still calls `fetchNstTextByUrl` with no `requestControl` (origin/master; the last change was #380). That means the writer fix is unreleased and **the gap will regrow** until it ships. That fix belongs to the NST lane (now Claude) and has not been done here.

**Sizing.** The backfill needed 29 URLs: 9 for 11-04 (all but `5v5Counts`), 10 for 11-05 and 10 for 11-06. The released client forces 21-second spacing, so the run could not be a true burst.

**Run (TJ pop-up approval).** Every call used the same fixed URL, `GET https://fhfhockey.com/api/v1/db/update-nst-goalies?runMode=incremental&overwrite=false&startDate=2026-11-04&maxDays=3&maxUrls=6&requestIntervalMs=21000`, so the window could not reach 11-07. Calls ran one at a time, with at most 6 planned.

- 5 calls from 21:29 to 21:40 UTC, all HTTP 200, and the last one finished with `stoppedEarly: false`.
- 29 URLs processed. `5v5Counts` for 11-04 was skipped because it already existed, and skipped URLs make no NST request.
- At 21-second spacing, this is at most 3 requests a minute and 15 per 5 minutes, which is within all four NST windows.

**Verification (SELECT only, all 30 combinations).** For each of the 10 tables on 11-04, 11-05 and 11-06, I checked the row count, matches to WGO goalies by id and date, non-null `toi`, and, for the counts tables, non-null `hd_shots_against`:

| Date | WGO goalies | Rows in each table | WGO matches | Non-null toi and HD |
|---|---|---|---|---|
| 11-04 | 8 | 8 (all 10 tables) | 8 | all |
| 11-05 | 22 | 22 (all 10 tables) | 22 | all |
| 11-06 | 7 | 7 in 8 tables; 6 in `pp_counts` and `pp_rates` | all rows | all |

On 11-06, one goalie has no PP row. The PP tables usually run lower, because a goalie who faced no power play gets no row. The table the card reads, `all_counts`, is complete.

No rows dated 11-07 were written. All 30 combinations are present, and no table/date is missing.
