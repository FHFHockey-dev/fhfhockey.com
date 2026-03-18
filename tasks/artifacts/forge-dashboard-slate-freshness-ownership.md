# FORGE Dashboard Slate Freshness Ownership

## Purpose

This artifact traces the refresh ownership behind the slate surfaces so the Start Chart chain is documented as an operational graph, not just a list of source tables.

It answers:

- which jobs keep each slate sub-feed current
- what runtime expectation each upstream job currently has
- where the slate chain is explicit
- where it is duplicated, misordered, or semantically mismatched

## Ownership Summary

- overall ownership clarity: `yellow`
- current operational result for the slate component: still `red` because the goalie leg of the chain is stale

The chain is mostly traceable, but it is not yet a single clean authoritative pipeline.

## Start Chart Sub-Feeds

| Slate sub-feed | Table / output | Current owner | Current expectation |
| --- | --- | --- | --- |
| scheduled games | `games` | core entity freshness / `update-games` family | upstream ownership is only partially explicit in the current cron/runbook surface |
| expected skaters | `lineCombinations` | `update-line-combinations` | scheduled before Start Chart projection build |
| rolling skater inputs | `rolling_player_game_metrics` | `update-rolling-player-averages` | daily incremental budget `270000ms` |
| opponent rating context | `team_power_ratings_daily` | `update-team-power-ratings` | scheduled daily with `300000ms` timeout |
| CTPI overlay | `team_ctpi_daily` | `update-team-ctpi-daily` | scheduled daily with `100000ms` timeout |
| goalie suppression / slate goalie context | `goalie_start_projections` | `update-goalie-projections-v2` | scheduled daily with `100000ms` timeout |
| player projection rows for Start Chart | `player_projections` | `update-start-chart-projections` | scheduled daily with `300000ms` timeout |
| Yahoo overlays | `yahoo_players` | `update-yahoo-players` | scheduled daily with `100000ms` timeout |
| served slate response | `/api/v1/start-chart` | [start-chart.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/start-chart.ts) | dashboard payload budget `300000` bytes, target `p95 <= 900ms` |

## Current Scheduled Chain

Documented jobs from [cron-schedule.md](/Users/tim/Code/fhfhockey.com/web/rules/cron-schedule.md):

- `08:00 UTC` `update-line-combinations`
- `08:40 UTC` `update-yahoo-players`
- `09:00 UTC` `update-rolling-player-averages`
- `09:10 UTC` `update-team-ctpi-daily`
- `09:15 UTC` `update-team-power-ratings`
- `09:20 UTC` `update-team-power-ratings-new`
- `09:30 UTC` `update-goalie-projections-v2`
- `09:40 UTC` `update-start-chart-projections`

## Hidden Dependencies Behind `player_projections`

[update-start-chart-projections.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-start-chart-projections.ts) does not simply enrich an existing projection feed.

It currently depends on:

- `games`
- `lineCombinations`
- `team_power_ratings_daily`
- `goalie_start_projections`
- `rolling_player_game_metrics`

That means the real Start Chart chain is:

1. core games fresh enough to identify the slate
2. line combinations fresh enough to identify expected skaters
3. rolling player recompute fresh enough to supply per-player rates
4. team power fresh enough to derive matchup multipliers
5. goalie projections fresh enough to supply suppression context
6. Start Chart projection build writes `player_projections`
7. `/api/v1/start-chart` serves games, skater projections, goalie rows, Yahoo overlays, CTPI, and team ratings together

## Runtime Expectations

Current explicit runtime expectations are split across cron timeouts and dashboard route budgets:

- `update-line-combinations`: `100000ms` cron timeout
- `update-yahoo-players`: `100000ms` cron timeout
- `update-team-ctpi-daily`: `100000ms` cron timeout
- `update-team-power-ratings`: `300000ms` cron timeout
- `update-team-power-ratings-new`: `300000ms` cron timeout
- `update-goalie-projections-v2`: `100000ms` cron timeout
- `update-start-chart-projections`: `300000ms` cron timeout
- `update-rolling-player-averages`: daily incremental budget `270000ms` from [rollingPlayerOperationalPolicy.ts](/Users/tim/Code/fhfhockey.com/web/lib/rollingPlayerOperationalPolicy.ts)
- `/api/v1/start-chart`: payload budget `300000` bytes and target `p95 <= 900ms` from [perfBudget.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/perfBudget.ts)

## Ownership Findings

### 1. The goalie chain is explicitly scheduled, but currently not healthy

- [update-goalie-projections-v2.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-goalie-projections-v2.ts) is the documented owner of `goalie_start_projections`
- it resumes from the latest stored `game_date`
- it only processes games where `date <= today`
- live table evidence still showed latest goalie projection date `2026-02-28`

So the chain is named, but not currently succeeding in keeping the slate goalie leg fresh.

### 2. The Start Chart writer and goalie writer are semantically misaligned

[update-start-chart-projections.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-start-chart-projections.ts):

- defaults to projecting for `tomorrow` in EST when no date is supplied

[update-goalie-projections-v2.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-goalie-projections-v2.ts):

- only processes games from season start through `today`

That means the static cron chain can write tomorrow-facing `player_projections` without having tomorrow-facing `goalie_start_projections` available to enrich them.

This is a real ownership design mismatch, not just a stale table incident.

### 3. Start Chart route fallback is not the same as freshness ownership

[start-chart.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/start-chart.ts):

- falls back to previous or latest available dates only when the slate is empty
- does not treat partial sub-feed lag as a freshness failure

So route fallback covers empty-slate cases, but it does not protect against mixed-freshness payloads.

### 4. Team ratings ownership is duplicated

The slate route reads team ratings through [teamRatingsService.ts](/Users/tim/Code/fhfhockey.com/web/lib/teamRatingsService.ts), which prefers:

- `team_power_ratings_daily`
- then falls back to `team_power_ratings_daily__new`

But [update-start-chart-projections.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-start-chart-projections.ts) reads only `team_power_ratings_daily`.

So the serving path has an old/new fallback, while the writer path is still old-table only.

### 5. Pipeline/runbook ownership is not fully aligned with the real dependency graph

[rollingForgePipeline.ts](/Users/tim/Code/fhfhockey.com/web/lib/rollingForgePipeline.ts) places `update-start-chart-projections` in `downstream_projection_consumers` after `projection_execution`.

But the actual route dependency for Start Chart projections is mostly:

- line combinations
- rolling player metrics
- team power
- goalie projections

It does not directly consume `forge_player_projections`.

So the pipeline spec is currently more projection-system-centric than the actual Start Chart dependency graph.

### 6. Games freshness is only partially explicit in the current runbook

The `games` table is foundational to the slate chain, but the current cron summary is much clearer about projection and context writers than about the ongoing `update-games` ownership.

This is not the main blocker today, but it is still a documentation weakness in the chain.

## Freshness-Ownership Verdict

The slate chain cannot be called `green`.

Why it is not `red` on ownership clarity alone:

- most of the upstream jobs are identifiable
- the main daily cron order for lineups, rolling metrics, team context, goalie projections, and Start Chart projection writes is visible
- runtime expectations are mostly explicit

Why it stays `yellow` instead of `green`:

- goalie freshness ownership is named but currently failing
- the Start Chart writer and goalie writer are semantically misaligned on default date behavior
- team rating ownership is duplicated across old/new tables
- the pipeline spec and actual route dependency graph do not fully match
- `games` ownership is still less explicit than the rest of the chain

## Required Follow-Ups

- reconcile the default date semantics between `update-goalie-projections-v2` and `update-start-chart-projections`
- decide whether Start Chart should be a same-day surface, a tomorrow-first surface, or two explicit modes
- add a slate-specific freshness invariant that checks `games`, `player_projections`, and `goalie_start_projections` for the same resolved date
- align the runbook/pipeline spec with the actual Start Chart dependency graph
- decide whether Start Chart should continue reading `team_power_ratings_daily` only, or be upgraded to the same old/new fallback behavior used by the serving layer
