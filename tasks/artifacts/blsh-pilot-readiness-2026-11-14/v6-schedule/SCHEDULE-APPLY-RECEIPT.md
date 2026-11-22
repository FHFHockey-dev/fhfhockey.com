# BLSH v6 schedule (switch off): apply receipt

## Authorization

TJ, by pop-up, 2026-11-16: "Schedule, switch off". The approved scope was to run the reviewed `SCHEDULE.sql` once, leave the kill switch off and read the result back. The first firing on 11-19 counts as v6 probe part B. Enabling the switch is a separate approval.

## What ran

| | |
| --- | --- |
| **File** | `tasks/artifacts/blsh-cron-v6-2026-11-15/schedule/SCHEDULE.sql`, sha256 `bb7b3df2cbc85883…`. Line-reviewed in V6-REVIEW; unchanged in V6-RECHECK |
| **Method** | psql 15 to the session pooler as `postgres`, app name `claude-blsh-v6-schedule`, `lock_timeout` 5 s, `statement_timeout` 30 s. One transaction, `begin` and `commit` in the file |
| **Applied** | 2026-11-16 at about 19:12:38Z. Exit 0, `COMMIT` |
| **Private outputs** | the folder named in `OUTDIR` (0700): preflight, pattern, net, apply and readback |

## Preflight (read-only, 19:12:16Z)

| Check | Result |
| --- | --- |
| BLSH jobs | 0 |
| Invoker function | absent |
| `require_cron_request_headers` | present |
| Vault `site_url` | absent, so the URL falls back to `https://fhfhockey.com`, as `invoke_player_forecast_endpoint` does |
| Vault `cron_secret` | present |
| Kill switch | **off** |
| Runs | 0 |
| pg_cron and pg_net | both present |

pg_net responses over the last 6 h were 200 and 207 only, with no redirects.

## Readback (read-only)

| jobid | Job | Schedule (UTC) |
| --- | --- | --- |
| 404 | `blsh-native-capture` | 12:05 |
| 405 | `blsh-native-capture-backup` | 12:20 |
| 406 | `blsh-native-capture-watchdog` | 12:50 |
| 407 | `blsh-native-capture-watchdog-assert` | 12:52 |

- All four jobs are active.
- `fhfh_internal.invoke_blsh_endpoint` is SECURITY DEFINER with `search_path=""`. No EXECUTE for anon, authenticated or service_role.
- **The switch is off. Runs: 0.**

## What fires, and when

| Dates | What the route does | Watchdog assert |
| --- | --- | --- |
| 11-17 and 11-18 | The pilot fence gives a 200 skip before any env or runtime check. No NST, no admission, no Storage | Silent: switch off and no run |
| 11-19, 12:05Z and 12:20Z | Part B: expect 200 `skipped:"disabled"`. This confirms the system env and runtime precheck only; the observer self-test runs only on an enabled run | Silent |

To check part B, read `cron.job_run_details`, `net._http_response` and the Vercel runtime logs for the route. Make no route calls.

## Not done (each needs its own approval)

- Setting `blsh_capture_control.enabled = true`.
- **Before enabling, land in one change** (review L7):
  - the `cron-schedule.md` inventory entry from `CRON-SCHEDULE-ENTRY.md`;
  - the `nstCoordination.ts` / `nstClassification.ts` registration from REGISTRATION.md.

  These are shared NST files.
- M1 part 2; the bridge/reader v6 profiles; Phase 3 boxscores.

## Rollback

```sql
select cron.unschedule(jobid) from cron.job where jobname in ('blsh-native-capture','blsh-native-capture-backup','blsh-native-capture-watchdog','blsh-native-capture-watchdog-assert');
drop function fhfh_internal.invoke_blsh_endpoint(text);
```

## Part B result (2026-11-19, logs only)

At 12:05Z and 12:20Z: 200 `{"success":true,"skipped":"disabled","sourceDate":"2026-11-18"}`. On 11-17, 11-18 and 11-19, all four jobs report `succeeded`. Switch off, runs 0. Private output: `partB-read.out` in `OUTDIR`.
