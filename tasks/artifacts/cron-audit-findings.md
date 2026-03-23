# Cron Audit Findings

## Source Inputs

- `tasks/artifacts/cron-benchmark-run-latest.json`
- `tasks/artifacts/cron-benchmark-run-latest.md`
- `tasks/artifacts/cron-spacing-candidates.md`
- `tasks/artifacts/cron-optimization-denotations.md`
- `tasks/artifacts/cron-nst-safety-matrix.md`
- `tasks/artifacts/cron-loop-batching-decisions.md`

## Concrete Bottlenecks

### 1. Direct NST schedule pressure is a first-class bottleneck

- The benchmark runner had to insert explicit NST spacing waits before:
  - `update-nst-tables-all`: `597s`
  - `update-nst-current-season`: `813s`
  - `update-nst-team-stats-all`: `900s`
- This is not just endpoint slowness. It means the written schedule shape itself creates dead time when we enforce the preferred NST policy.
- The late NST pair is the clearest offender:
  - `update-nst-team-daily-incremental` at `10:50 UTC`
  - `update-nst-team-stats-all` at `10:55 UTC`

### 2. The FORGE mid-pipeline steps are timeout-bound

The following jobs all failed at roughly the `5 minute` boundary:

- `update-wigo-table-stats`
- `update-rolling-player-averages` (POST pass)
- `update-start-chart-projections`
- `ingest-projection-inputs`
- `build-forge-derived-v2`
- `update-nst-team-daily`
- `update-nst-team-daily-incremental`

This pattern is too consistent to treat as random. These look like one of:

- route max-duration pressure
- local `fetch` caller timeout pressure
- oversized single-request orchestration
- downstream services stalling until the caller fails

### 3. Supabase / upstream data-plane instability becomes a late-run bottleneck

Several SQL or data-heavy jobs failed with upstream HTML error responses instead of structured PostgREST errors:

- `daily-refresh-goalie-unified-matview` (`520`)
- `daily-refresh-matview` (`522`)
- `daily-refresh-player-totals-unified-matview` (`522`)
- later sustainability and projection jobs then failed on the same degraded data plane

This creates a cascading failure zone in the back half of the schedule.

### 4. Long failing NST jobs are still unresolved bottlenecks

- `update-nst-goalies` failed after `17:00`
- `update-nst-team-stats-all` failed after `16:18`

Those are not acceptable cron runtimes even before considering adjacent jobs.

## Dependency Risks

### 1. The sustainability chain is still vulnerable to upstream refresh failures

The benchmark showed a clear downstream collapse:

- `daily-refresh-player-totals-unified-matview` failed
- then `rebuild-sustainability-priors`, `rebuild-sustainability-window-z`, `rebuild-sustainability-score`, and `rebuild-sustainability-trend-bands` all failed

This means the sustainability block is still only as healthy as the unified-view refresh chain.

### 2. The schedule still contains a known functional dependency inversion

From earlier inventory work:

- `rebuild-sustainability-baselines` reads both `player_stats_unified` and `player_totals_unified`
- but the written schedule currently places baselines before the `player_totals_unified` refresh

That should be corrected in the schedule rewrite even if the route itself is otherwise healthy.

### 3. FORGE freshness is dependency-sensitive to multiple upstream failures

The following chain remains high risk:

- `update-rolling-player-averages`
- `update-goalie-projections-v2`
- `ingest-projection-inputs`
- `build-forge-derived-v2`
- `run-forge-projection-v2`
- `update-start-chart-projections`

When one stage fails or times out, multiple dashboard-facing consumers degrade together.

### 4. Stateful jobs should not be interpreted as “short and safe” from one good run

Examples:

- `update-goalie-projections-v2` observed `00:10`, but it is resumable and backlog-dependent
- `update-nst-gamelog` observed `00:34`, but it is rate-limited and date-backlog dependent

These should remain dependency-aware anchors, not “pack tightly” jobs.

## Missing Telemetry Gaps

### 1. Too many failures collapse to `fetch failed`

This happened on several key routes:

- `update-nst-goalies`
- `update-wigo-table-stats`
- `update-start-chart-projections`
- `build-forge-derived-v2`
- `update-nst-team-daily`
- `update-nst-team-daily-incremental`

That is not enough information for efficient operator response. These routes need richer failure payloads and progress checkpoints.

### 2. SQL-only failures surface infrastructure HTML, not normalized failure metadata

The SQL benchmark path correctly captured timing, but failure bodies for some RPC calls were raw Cloudflare HTML pages.

That means operators can see that something failed, but not:

- which SQL statement phase failed
- whether the database rejected the statement or the edge path timed out
- whether the job made partial progress

### 3. `update-nst-current-season` has a safety implementation gap

- The file documents NST caps
- It declares `REQUEST_DELAY_MS = 1500`
- That delay is not used in the active request loop

So the route currently relies on “only four requests” rather than real pacing telemetry or enforcement.

### 4. Several routes still do not expose granular progress units

The benchmark can tell us total duration, but not enough about internal work completion for:

- `ingest-projection-inputs`
- `build-forge-derived-v2`
- `update-start-chart-projections`
- `update-nst-goalies`

Those should expose processed batches, backlog remaining, or stage markers so future audits can distinguish “slow but advancing” from “stuck.”

## Short Jobs That Still Should Not Be Packed Tightly

These were short in the benchmark but should stay out of tight `1-minute` / `2-minute` groups:

- `update-nst-gamelog`
  - observed `00:34`
  - direct NST consumer
  - rate-limited
  - backlog-dependent
- `update-goalie-projections-v2`
  - observed `00:10`
  - resumable / stateful
  - runtime varies with how far behind projections are

## Jobs That Can Be Packed More Aggressively

These successful jobs are the strongest current candidates for `1-minute` or `2-minute` spacing:

`1-minute`

- `update-yahoo-matchup-dates`
- `update-all-wgo-skaters`
- `update-all-wgo-goalies`
- `daily-refresh-player-unified-matview`
- `update-power-play-timeframes`
- `update-line-combinations-all`
- `update-team-yearly-summary`
- `update-all-wgo-goalie-totals`
- `update-team-ctpi-daily`
- `update-team-sos`
- `update-team-power-ratings`
- `update-team-power-ratings-new`
- `update-wgo-teams`

`2-minute`

- `update-all-wgo-skater-totals`
- `update-standings-details`
- `update-expected-goals`
- `update-yahoo-players`

These are only first-pass candidates and should be revalidated after the failure-heavy jobs are stabilized.

## Immediate Weaknesses To Carry Into Schedule Redesign

- The written schedule is not NST-safe in its current late-morning cluster.
- The FORGE chain still contains multiple single-request bottlenecks clustered around `5 minutes`.
- The sustainability block depends on upstream refreshes that were unstable in this audit.
- Too many critical failures still return vague transport-level messages instead of operator-usable diagnostics.
- Tightening the schedule should focus on the clearly fast success cases first, not on the failed or stateful jobs.
