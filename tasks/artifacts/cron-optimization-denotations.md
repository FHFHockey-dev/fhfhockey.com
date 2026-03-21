# Cron Optimization Denotations

## Rule

- Denotation threshold: `4m30s`
- Denotation: `OPTIMIZE`
- Source run: `tasks/artifacts/cron-benchmark-run-latest.json`

## Interpretation

- Any job over `4m30s` is flagged `OPTIMIZE`.
- Some jobs exceeded the threshold because the benchmark runner inserted explicit NST safety waits before execution.
- Those jobs still deserve schedule optimization, but they are different from jobs whose route or SQL work itself appears to be too slow or timeout-prone.

## OPTIMIZE: Schedule-Inflated By NST Safety Wait

These jobs crossed the threshold primarily because the audit enforced NST-safe spacing. Their observed wall-clock time is still important, but the dominant issue is schedule shape rather than raw endpoint execution speed.

| Job | Status | Observed Timer | Why It Exceeded 4m30s | Likely Cause |
| --- | --- | --- | --- | --- |
| `update-nst-tables-all` | `success` | `11:05` | Included a `597s` inserted NST safety wait. | Full NST table rebuild is stateful and direct-NST; current placement is too close to the prior NST job to run without a long guard band. |
| `update-nst-current-season` | `success` | `13:42` | Included an `813s` inserted NST safety wait. | The endpoint itself was not the dominant cost; the schedule position forced a long pause to preserve NST spacing. |
| `update-nst-team-stats-all` | `failure` | `16:18` | Included a `900s` inserted NST safety wait. | The `10:50` -> `10:55` NST cluster is fundamentally too tight, and this full-team-stat path also failed during table/date scan and upsert work. |

## OPTIMIZE: Endpoint Or SQL Runtime Bottlenecks

These jobs crossed the threshold because the route or SQL work itself appears to be too slow, timeout-bound, or failure-prone under the current execution path.

| Job | Status | Observed Timer | Why It Exceeded 4m30s | Likely Cause |
| --- | --- | --- | --- | --- |
| `update-nst-goalies` | `failure` | `17:00` | Long failing NST route. | Direct NST goalie scrape likely stalled on remote fetch or downstream processing without a graceful resumable cutoff. |
| `update-wigo-table-stats` | `failure` | `05:00` | Failed right at the boundary. | Route appears timeout-bound rather than cleanly completed; likely a request-budget ceiling or heavy downstream query work. |
| `update-rolling-player-averages` | `failure` | `05:00` | Failed at the boundary after broad rebuild work. | Large-scope rolling rebuild is still too heavy for this invocation shape and remains dependency-sensitive for FORGE. |
| `update-start-chart-projections` | `failure` | `05:01` | Timed out/fetch-failed. | Projection consumer likely exceeded the local benchmark request window or hit a downstream dependency stall. |
| `ingest-projection-inputs` | `failure` | `05:01` | Timed out/fetch-failed with explicit ingest/backlog notes. | Recent-game ingest is stateful and backlog-sensitive; current single-request shape is too large for a stable run. |
| `build-forge-derived-v2` | `failure` | `05:01` | Timed out/fetch-failed. | Multiple derived-table builders are bundled into one request and appear to exceed the safe route budget. |
| `update-nst-team-daily` | `failure` | `05:01` | Timed out/fetch-failed. | Direct NST team-daily route likely needs better internal chunking, retry handling, or narrower target windows. |
| `update-nst-team-daily-incremental` | `failure` | `05:01` | Timed out/fetch-failed. | Incremental NST team-daily run still behaves like a heavy blocking route under the current implementation. |

## Notable Supporting Failures Near But Under The Threshold

These did not exceed `4m30s`, so they are not denoted here, but they remain important for later bottleneck analysis.

- `update-season-stats-current-season` failed at `02:50`
- `update-sko-stats-full-season` failed at `01:18`
- `daily-refresh-goalie-unified-matview` failed at `01:10`
- `daily-refresh-player-totals-unified-matview` failed at `00:39`
- `rebuild-sustainability-priors` failed at `00:39`
- `rebuild-sustainability-window-z` failed at `00:39`
- `rebuild-sustainability-score` failed at `00:39`
- `update-predictions-sko` failed at `00:39`
- `run-projection-accuracy` failed at `00:39`

## Immediate Implication

- `OPTIMIZE` does not mean the same fix for every job.
- Direct NST jobs over the threshold are telling us the schedule is too tight for NST-safe execution.
- The 5-minute boundary failures point to route budgeting, chunking, or retry/resume problems that should be treated as endpoint-level optimization work.

## Remediation Update 2026-03-21

Targeted reruns after the remediation work changed the practical status of several jobs that were originally denoted here from the first failing benchmark run.

### No Longer Current As Active Optimization Flags In Local Validation

- `update-rolling-player-averages`
  - both cron invocation shapes now succeed locally in `03:46` and `03:37`
- `update-start-chart-projections`
  - now succeeds locally in `00:03.64`
- `ingest-projection-inputs`
  - now succeeds locally in `00:01.81`
- `build-forge-derived-v2`
  - now succeeds locally in `00:02`
- `update-nst-goalies`
  - small bounded validation run now completes compliantly with `0ms` burst spacing
- `update-nst-team-daily`
  - small bounded validation run now completes compliantly with `0ms` burst spacing
- `update-nst-team-stats-all`
  - single-date validation run now completes in `5.4s` with compliant `0ms` burst spacing

### Still Current Optimization Or Blocker Candidates

- `run-projection-v2`
  - now passes preflight but still hits structured DB statement timeout during execution
- `calculate-wigo-stats`
  - still hangs past the `180s` local validation window
- `update-season-stats-current-season`
  - still hangs past the `180s` local validation window
- `update-sko-stats-full-season`
  - now exposes a real schema mismatch blocker
- `update-wgo-averages`
  - now exposes a real upstream transport/dependency blocker

Use `/Users/tim/Code/fhfhockey.com/tasks/artifacts/cron-failed-jobs-remediation-status-2026-03-21.md` as the current source of truth for remediation status. This document remains the original benchmark-based denotation record.
