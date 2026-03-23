## NST URL Counts And Burst Behavior

This artifact confirms the real per-date request counts and current wait/burst behavior for the NST routes called out in task `4.1`.

### 1. `update-nst-goalies`

Route:
- `/api/v1/db/update-nst-goalies`

Code evidence:
- [update-nst-goalies.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-nst-goalies.ts#L75)
- [update-nst-goalies.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-nst-goalies.ts#L268)
- [update-nst-goalies.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-nst-goalies.ts#L579)

Per-date NST URL count:
- `10` URLs per date

Why:
- `5` situations are enumerated: `5v5`, `ev`, `all`, `pp`, `pk`
- each situation creates `2` requests: counts + rates
- `5 * 2 = 10`

Current timer / burst behavior:
- default interval constant is `22000 ms`
- if `datesToScrape.length <= 2`, the route switches to `requestIntervalMs = 0`
- otherwise it uses `22000 ms`
- the route also caps work per request with `DEFAULT_MAX_PENDING_URLS_PER_RUN = 8`

Important implication:
- the existing "small backlog means no wait" branch is date-count based, not URL-count based
- `2` dates means up to `20` NST requests can run without delay

### 2. `update-nst-team-daily`

Route:
- `/api/v1/db/update-nst-team-daily`

Code evidence:
- [update-nst-team-daily.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-nst-team-daily.ts#L72)
- [update-nst-team-daily.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-nst-team-daily.ts#L78)
- [update-nst-team-daily.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-nst-team-daily.ts#L354)
- [update-nst-team-daily.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-nst-team-daily.ts#L729)

Per-date NST URL count:
- `8` URLs per date

Why:
- `8` datasets are defined directly:
  - `as_counts`
  - `as_rates`
  - `es_counts`
  - `es_rates`
  - `pp_counts`
  - `pp_rates`
  - `pk_counts`
  - `pk_rates`
- each dataset maps to one NST request for that date

Current timer / burst behavior:
- `1` date => `0 ms`
- `2` dates => `3000 ms`
- `3+` dates => `30000 ms`

Important implication:
- this route already has a three-tier burst system
- the decision is also date-count based, not URL-count based
- `2` dates means `16` NST requests with only `3s` spacing

### 3. `update-nst-team-daily-incremental`

Scheduled job name:
- `update-nst-team-daily-incremental`

Actual route:
- `/api/v1/db/update-nst-team-daily`

Schedule evidence:
- [cron-schedule.md](/Users/tim/Code/fhfhockey.com/web/rules/cron-schedule.md#L58)
- [cron-schedule.md](/Users/tim/Code/fhfhockey.com/web/rules/cron-schedule.md#L1096)

Finding:
- there is no separate `update-nst-team-daily-incremental` route file
- the scheduled job is just the default no-param incremental mode of `update-nst-team-daily`

Per-date NST URL count:
- `8` URLs per date

Current timer / burst behavior:
- identical to `update-nst-team-daily`
- default cron call with no params uses the same `0 ms / 3s / 30s` date-count tiers

### 4. `update-nst-team-stats-all`

Scheduled job name:
- `update-nst-team-stats-all`

Actual route:
- `/api/Teams/nst-team-stats`

Schedule evidence:
- [cron-schedule.md](/Users/tim/Code/fhfhockey.com/web/rules/cron-schedule.md#L59)
- [cron-schedule.md](/Users/tim/Code/fhfhockey.com/web/rules/cron-schedule.md#L1118)

Code evidence:
- [nst-team-stats.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/Teams/nst-team-stats.ts#L12)
- [nst-team-stats.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/Teams/nst-team-stats.ts#L14)
- [nst-team-stats.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/Teams/nst-team-stats.ts#L15)
- [nst-team-stats.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/Teams/nst-team-stats.ts#L259)
- [nst-team-stats.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/Teams/nst-team-stats.ts#L591)
- [nst-team-stats.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/Teams/nst-team-stats.ts#L950)

Per-run NST URL count:
- default incremental `date=all` run:
  - `4` date-based URLs for the single processed date
  - plus `2` season-based URLs only if the date backlog is clear and runtime budget remains
  - so actual request count is `4` or `6`, not "per date all dates"
- manual/single-date run:
  - `4` date-based URLs for that date
- season-table tail when backlog is clear:
  - `2` extra URLs

Why:
- `dateBasedResponseKeys` contains `4` tables:
  - `countsAll`
  - `counts5v5`
  - `countsPP`
  - `countsPK`
- `seasonBasedResponseKeys` contains `2` tables:
  - `seasonStats`
  - `lastSeasonStats`
- `MAX_DATE_BASED_DATES_PER_RUN = 1`, so one call processes at most one date

Current timer / burst behavior:
- always enforces `NST_INTER_REQUEST_DELAY_MS = 21000`
- no special small-backlog burst bypass exists
- every request waits through `waitForNextNstRequestSlot()` if needed

### Conclusion

Confirmed current behavior:
- `update-nst-goalies`: `10` URLs/date, burst to `0 ms` only when queued dates `<= 2`
- `update-nst-team-daily`: `8` URLs/date, `0 ms` for `1` date, `3s` for `2` dates, `30s` for `3+`
- `update-nst-team-daily-incremental`: same route and same behavior as `update-nst-team-daily`
- `update-nst-team-stats-all`: `4` date-based URLs for one date, optionally `+2` season URLs, always `21s` spacing, no burst branch

Key weakness to address in later tasks:
- the current burst decisions are based on date count rather than total URL count against the published NST request ceilings
