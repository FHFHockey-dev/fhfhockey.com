# Cron NST Safety Matrix

## NST Limits

- `40` requests per `1` minute
- `80` requests per `5` minutes
- `100` requests per `15` minutes
- `180` requests per `1` hour

## Safety Policy Used For This Audit

Two different safety checks matter:

1. `Raw cap safety`
   Does the route's own configured request behavior appear to stay under the published NST request-count caps?

2. `Cross-endpoint spacing safety`
   Does the written cron schedule keep direct-NST routes at least `15` minutes apart from each other, or otherwise rely on internal throttling in a way that is still defensible?

The current schedule can pass `raw cap safety` and still fail `cross-endpoint spacing safety`.

## Direct NST Jobs In The Current Schedule

| Job | Slot | Gap From Prior NST Job |
| --- | --- | --- |
| `update-nst-gamelog` | `07:25 UTC` | — |
| `update-nst-tables-all` | `08:10 UTC` | `45 min` |
| `update-nst-goalies` | `08:30 UTC` | `20 min` |
| `update-nst-current-season` | `08:45 UTC` | `15 min` |
| `update-nst-team-daily` | `09:55 UTC` | `70 min` |
| `update-nst-team-daily-incremental` | `10:50 UTC` | `55 min` |
| `update-nst-team-stats-all` | `10:55 UTC` | `5 min` |

## Route-Level Evaluation

| Job | Route Behavior | Raw Cap Safety | Current Schedule Spacing Safety | Verdict |
| --- | --- | --- | --- | --- |
| `update-nst-gamelog` | Builds `16` NST URLs per date (`4` strengths x `2` stdoi modes x `2` rate modes) and uses a global `25s` inter-request gate. | `Safe` by raw cap math. `25s` spacing implies about `2.4` requests/minute and `144` requests/hour max. | `Safe` against the next written slot (`45 min` later). | Keep as direct-NST and leave broadly separated. |
| `update-nst-tables-all` | `nst-team-stats` slices date backlog to `1` date per run and performs `4` date-based requests, plus up to `2` season-based requests when backlog is clear. It enforces `21s` between NST fetches. | `Safe` by raw cap math. Even `6` requests with `21s` pacing stays far under published caps. | `Safe` against the previous `07:25` slot by written start times. | Keep as direct-NST; spacing is acceptable here. |
| `update-nst-goalies` | Queues `10` dataset URLs per date, but default run stops after `8` pending URLs. When scraping more than `2` days it uses `22s` pacing; when scraping `<=2` days it uses `0ms` route-level pacing. | `Probably safe` by raw cap count. Even `8` immediate requests stays under `40/min`, but the route depends on low total request count rather than enforced pacing in the common incremental case. | `Conditionally unsafe`. The next NST job is only `15 min` later, and the benchmark observed `17:00` wall-clock runtime before failure. | Needs schedule slack or endpoint shaping; do not treat `08:30 -> 08:45` as comfortably safe. |
| `update-nst-current-season` | Executes exactly `4` report fetches (`IndividualCounts`, `IndividualRates`, `OnIceCounts`, `OnIceRates`) for one strength. It documents NST caps, but the declared `REQUEST_DELAY_MS = 1500` is unused in the active loop. | `Safe by low request count`, not by enforced pacing. Four requests in one run stays under raw caps. | `Borderline`. Written gap from the prior NST job is exactly `15 min`, with no extra slack. | Safe enough on request counts, but weakly defended; should not stay on a knife-edge slot. |
| `update-nst-team-daily` | Processes `8` datasets per date. For `1` target date it uses `0ms` interval; for `2` dates it uses `3s`; for `>=3` dates it uses `30s`. | `Safe` by raw cap count for single-date incremental runs (`8` requests). | `Safe` against prior NST slot because the written start gap is `70 min`. | Fine on schedule placement, but route still relies on low request count when only one date is processed. |
| `update-nst-team-daily-incremental` | Same implementation as `update-nst-team-daily`, typically `8` date-dataset fetches with `0ms` interval for a single incremental date. | `Safe` by raw cap count for single-date runs. | `Unsafe` relative to the next written NST slot because the next job is only `5 min` later. | Must move. |
| `update-nst-team-stats-all` | Same `nst-team-stats` implementation family as `update-nst-tables-all`; typically `4` date-based requests plus optional `2` season-based requests with `21s` spacing. | `Safe` by raw cap math. | `Unsafe` because it is scheduled only `5 min` after another direct-NST job. | Must move. |

## Current Schedule Verdict

### Safe Under Raw Request Caps

The current direct-NST routes appear to stay under the published NST request-count caps when evaluated in isolation:

- `update-nst-gamelog`
- `update-nst-tables-all`
- `update-nst-goalies`
- `update-nst-current-season`
- `update-nst-team-daily`
- `update-nst-team-daily-incremental`
- `update-nst-team-stats-all`

That conclusion depends on current route shapes and low per-run request counts, not on every route having strong internal pacing.

### Unsafe Under Preferred Cross-Endpoint Spacing

The current written cron schedule is **not** NST-safe under the preferred cross-endpoint spacing rule.

Definite failures:

- `update-nst-team-daily-incremental` -> `update-nst-team-stats-all`
  - written gap: `5 min`
  - verdict: unsafe

Weak / fragile pairs:

- `update-nst-goalies` -> `update-nst-current-season`
  - written gap: `15 min`
  - benchmark observed `update-nst-goalies` taking `17:00` before failing
  - verdict: not enough slack

### Benchmark Evidence

The benchmark runner had to insert explicit NST guard waits before:

- `update-nst-tables-all`: `597s`
- `update-nst-current-season`: `813s`
- `update-nst-team-stats-all`: `900s`

Those waits were based on sequential local execution, not literal wall-clock cron starts, but they still reinforce the same conclusion:

- NST jobs cannot be treated as freely packable short routes
- the late NST cluster is especially unsafe

## Proposed Safety Rule For The Schedule Rewrite

Use this rule in the upcoming cron redesign:

- Keep direct-NST cron starts at least `15 minutes` apart by default.
- Do not place a direct-NST route immediately after another direct-NST route unless the earlier route has both:
  - stable low request count
  - a proven completion time that leaves slack before the next slot
- Treat these as fixed direct-NST anchors that should stay well separated:
  - `update-nst-gamelog`
  - `update-nst-tables-all`
  - `update-nst-goalies`
  - `update-nst-current-season`
  - `update-nst-team-daily`
  - `update-nst-team-daily-incremental`
  - `update-nst-team-stats-all`

## Immediate Scheduling Implications

- `10:55 UTC update-nst-team-stats-all` must move away from `10:50 UTC update-nst-team-daily-incremental`.
- `08:45 UTC update-nst-current-season` should not remain immediately downstream of `08:30 UTC update-nst-goalies` without additional slack.
- `update-nst-current-season` should either restore a real per-request delay or be treated explicitly as “safe only because it makes four calls,” which is a weaker guarantee.
