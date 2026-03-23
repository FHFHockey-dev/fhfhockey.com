# Cron Spacing Candidates

## Basis

- Source run: `tasks/artifacts/cron-benchmark-run-latest.json`
- Benchmark window: `2026-03-20`
- Method:
  - only `success` observations were considered spacing candidates
  - failed and skipped jobs were excluded from tight-spacing eligibility
  - jobs with benchmark annotations `rate_limited`, `stateful`, `side_effect`, `special_handling`, `batch_loop`, or `dependency_sensitive` were excluded from tight-spacing eligibility even if their observed runtime was short
- Important caveat:
  - this is a single full-run benchmark, so these are first-pass observed candidates, not multi-run statistical guarantees
  - any job that later proves unstable should be moved back out of the tight-spacing buckets

## 1-Minute Gap Candidates

These jobs completed in `<= 30s` and did not carry disqualifying annotations in the benchmark run.

| Job | Observed Timer | Method | Current Route / SQL |
| --- | --- | --- | --- |
| `update-yahoo-matchup-dates` | `00:01` | `GET` | `/api/v1/db/update-yahoo-weeks?game_key=nhl` |
| `update-all-wgo-skaters` | `00:04` | `GET` | `/api/v1/db/update-wgo-skaters?action=all` |
| `update-all-wgo-goalies` | `00:00` | `GET` | `/api/v1/db/update-wgo-goalies?action=all` |
| `daily-refresh-player-unified-matview` | `00:02` | `SQL` | `REFRESH MATERIALIZED VIEW player_stats_unified;` |
| `update-power-play-timeframes` | `00:02` | `GET` | `/api/v1/db/powerPlayTimeFrame?gameId=all` |
| `update-line-combinations-all` | `00:02` | `GET` | `/api/v1/db/update-line-combinations` |
| `update-team-yearly-summary` | `00:01` | `GET` | `/api/v1/db/update-team-yearly-summary` |
| `update-all-wgo-goalie-totals` | `00:02` | `GET` | `/api/v1/db/update-wgo-goalie-totals` |
| `update-team-ctpi-daily` | `00:19` | `GET` | `/api/v1/db/update-team-ctpi-daily` |
| `update-team-sos` | `00:03` | `GET` | `/api/v1/db/update-team-sos` |
| `update-team-power-ratings` | `00:01` | `GET` | `/api/v1/db/update-team-power-ratings` |
| `update-team-power-ratings-new` | `00:01` | `GET` | `/api/v1/db/update-team-power-ratings-new` |
| `update-wgo-teams` | `00:21` | `GET` | `/api/v1/db/run-fetch-wgo-data` |

## 2-Minute Gap Candidates

These jobs completed in `> 30s` and `<= 120s` and did not carry disqualifying annotations in the benchmark run.

| Job | Observed Timer | Method | Current Route |
| --- | --- | --- | --- |
| `update-all-wgo-skater-totals` | `01:49` | `GET` | `/api/v1/db/update-wgo-totals?season=current` |
| `update-standings-details` | `01:30` | `GET` | `/api/v1/db/update-standings-details?date=all` |
| `update-expected-goals` | `01:27` | `GET` | `/api/v1/db/update-expected-goals?date=all` |
| `update-yahoo-players` | `01:27` | `GET` | `/api/v1/db/update-yahoo-players?gameId=465` |

## Short But Not Tight-Pack Candidates

These jobs were short in the observed run, but they should not be packed into 1-minute or 2-minute gaps because they are marked as rate-limited or stateful.

| Job | Observed Timer | Why Not Tight-Pack |
| --- | --- | --- |
| `update-nst-gamelog` | `00:34` | Direct NST consumer with `rate_limited` and `stateful` annotations. |
| `update-goalie-projections-v2` | `00:10` | `stateful` route whose runtime varies with backlog; it should stay dependency-aware rather than be treated like a trivial short job. |

## Not Measurable For Tight-Spacing From This Run

These jobs should not be assigned 1-minute or 2-minute gaps from the current benchmark because the run did not produce a successful timing signal that reflects healthy completion.

- all `27` failed jobs from `cron-benchmark-run-latest.json`
- all `4` policy-skipped jobs:
  - `update-shift-charts`
  - `sync-yahoo-players-to-sheet`
  - `daily-cron-report`
  - `update-pbp`

## Immediate Scheduling Implication

- There is enough evidence to begin grouping the `1-minute` and `2-minute` candidates more tightly.
- The direct NST jobs must remain outside those tight groups even when their observed runtime is short.
- The large failure set means a second benchmark pass will still be needed after stability fixes before the schedule is finalized.
