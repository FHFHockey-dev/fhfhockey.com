# NST Validation 2026-03-21

Validated locally against the app running on `http://localhost:3000` with cron auth.

## Results

### 1. `update-nst-goalies`
- Route: `/api/v1/db/update-nst-goalies?startDate=2026-03-21&maxDays=1`
- Outcome: `200 OK`
- Message: `Processed a bounded chunk of NST goalie work. Re-run to continue.`
- Pending URLs processed: `8`
- Total queued URLs: `10`
- Stopped early: `true`
- Effective request interval: `0ms`
- Request budget used for policy: `8`
- Compliance:
  - `1m`: `8 / 40`
  - `5m`: `8 / 80`
  - `15m`: `8 / 100`
  - `1h`: `8 / 180`
- Validation note: default bounded run now bursts because the actual per-run budget is only `8` NST requests, which is compliant with every published ceiling.

### 2. `update-nst-team-daily`
- Route: `/api/v1/db/update-nst-team-daily?runMode=forward&startDate=2026-03-21&endDate=2026-03-21`
- Outcome: `200 OK`
- Message: `Processed 1 day(s); 0 skipped.`
- Duration: `2961 ms`
- Processed dates: `1`
- Effective request interval: `0ms`
- Request count: `8`
- Compliance:
  - `1m`: `8 / 40`
  - `5m`: `8 / 80`
  - `15m`: `8 / 100`
  - `1h`: `8 / 180`
- Validation note: single-date burst remains compliant, and the route now justifies burst mode from request-count math instead of a date-count heuristic.

### 3. `nst-team-stats`
- Route: `/api/Teams/nst-team-stats?date=2026-03-21`
- Outcome: `200 OK`
- Message: `NST team stats completed in 5.4 seconds.`
- Duration: `5.4s`
- Complete: `true`
- Ran season tables: `true`
- Effective request interval: `0ms`
- Request count: `6`
  - date-based: `4`
  - season-based: `2`
- Compliance:
  - `1m`: `6 / 40`
  - `5m`: `6 / 80`
  - `15m`: `6 / 100`
  - `1h`: `6 / 180`
- Validation note: this is the clearest runtime improvement from the burst-policy refactor. The route no longer enforces the old fixed `21s` delay for a tiny compliant run.

## Overall Conclusion

- All validated NST routes returned success locally.
- All three request plans were compliant at `0ms` under the published NST ceilings.
- The total request volume across this validation pass was `22` NST requests:
  - goalie: `8`
  - team-daily: `8`
  - team-stats: `6`
- `22` total requests in the pass remained under the strictest published ceiling of `40` requests per minute.
- `nst-team-stats` shows a real measured runtime improvement after the refactor.
- `update-nst-goalies` and `update-nst-team-daily` are now safer because burst mode is justified by actual request-count math rather than implicit day-count assumptions.
