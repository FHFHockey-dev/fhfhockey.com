# FORGE Dashboard Team Trend Context Freshness Ownership

## Purpose

This artifact traces the refresh ownership behind Team Trend Context so the component is judged as one mixed-source chain rather than as three unrelated fetches.

It covers:

- team-power freshness ownership
- CTPI freshness ownership
- matchup-edge freshness ownership
- NST and WGO upstream dependencies
- current dashboard freshness/runtime policy

## Ownership Verdict

- overall ownership clarity: `red`
- current operational result for Team Trend Context: `red`

The chain is not merely stale. It is operationally misowned in multiple places:

- some upstream jobs run after the consumers they are supposed to feed
- one required upstream (`nst_team_5v5`) is not part of the active current-day chain
- another required upstream (`wgo_team_stats`) is materially stale in live data
- the dashboard freshness policy checks the wrong CTPI timestamp field

## Team Context Sub-Feeds

| Sub-feed | Current owner | Current runtime / policy |
| --- | --- | --- |
| team power serving | [team-ratings.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/team-ratings.ts) via [teamRatingsService.ts](/Users/tim/Code/fhfhockey.com/web/lib/teamRatingsService.ts) | dashboard freshness policy: `30h error`; dashboard budget: `800ms`, `120KB` |
| CTPI serving | [team-ctpi.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/trends/team-ctpi.ts) | dashboard freshness policy: `72h warn`; dashboard budget: `800ms`, `180KB` |
| matchup-edge serving | `/api/v1/start-chart` | downstream of Start Chart chain; team context consumes rating snapshots already embedded there |
| team power writer | [update-team-power-ratings.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-team-power-ratings.ts) and [update-team-power-ratings-new.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-team-power-ratings-new.ts) | cron timeout `300000ms` each |
| CTPI writer | [update-team-ctpi-daily.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-team-ctpi-daily.ts) | cron timeout `100000ms` |
| team NST gamelog inputs | [update-nst-team-daily.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-nst-team-daily.ts) | incremental resume-from-latest; scheduled later than CTPI/power in current runbook |
| team 5v5 input | [nst-team-stats.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/Teams/nst-team-stats.ts) | resume-from-latest when called without params; not part of the earlier active team-context chain |
| WGO team input | `update-wgo-teams` via `run-fetch-wgo-data` | scheduled later than CTPI/power in current runbook |

## Current Scheduled Chain

Current runbook entries in [cron-schedule.md](/Users/tim/Code/fhfhockey.com/web/rules/cron-schedule.md):

- `09:10 UTC` `update-team-ctpi-daily`
- `09:15 UTC` `update-team-power-ratings`
- `09:20 UTC` `update-team-power-ratings-new`
- `09:35 UTC` `update-wgo-teams`
- `09:40 UTC` `update-start-chart-projections`
- `09:55 UTC` `update-nst-team-daily`
- `10:15 UTC` `refresh-team-power-ratings-daily`

Later static snippets also exist for:

- `10:50 UTC` `update-nst-team-daily-incremental`
- `10:55 UTC` `update-nst-team-stats-all`

## Live Upstream Freshness Evidence

Current max dates in the relevant source tables:

- `nst_team_gamelogs_as_rates`: `2026-03-16`
- `nst_team_gamelogs_pp_rates`: `2026-03-16`
- `nst_team_gamelogs_pk_rates`: `2026-03-16`
- `nst_team_5v5`: `2026-03-02`
- `wgo_team_stats`: `2026-02-05`
- `team_ctpi_daily`: `2026-03-17`
- `team_power_ratings_daily`: `2026-03-17`
- `team_power_ratings_daily__new`: `2026-03-17`

This is the key ownership problem:

- the output tables are current by date
- but some inputs the writers actually read are materially stale

So date-current output rows do not prove the component is freshness-healthy.

## Team Power Ownership

[update-team-power-ratings.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-team-power-ratings.ts) and [update-team-power-ratings-new.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-team-power-ratings-new.ts) both read through [power-ratings.ts](/Users/tim/Code/fhfhockey.com/web/lib/power-ratings.ts).

That helper currently depends on:

- `nst_team_gamelogs_as_rates`
- `nst_team_5v5`
- `nst_team_gamelogs_pp_rates`
- `nst_team_gamelogs_pk_rates`
- `wgo_team_stats`

Operational issues:

1. the writers run at `09:15` and `09:20 UTC`
2. `update-wgo-teams` does not run until `09:35 UTC`
3. `update-nst-team-daily` does not run until `09:55 UTC`
4. `nst-team-stats` is not part of that earlier active team-power chain at all

So the current cron order guarantees that team-power writes happen before several of their own upstreams have refreshed.

That is not a minor delay. It means the current runbook order is structurally wrong for same-day freshness.

## CTPI Ownership

[update-team-ctpi-daily.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/update-team-ctpi-daily.ts) depends on:

- `nst_team_gamelogs_as_rates`
- `nst_team_gamelogs_as_counts`
- `nst_team_gamelogs_pp_counts`
- `nst_team_gamelogs_pk_counts`

Current schedule:

- CTPI writes at `09:10 UTC`
- `update-nst-team-daily` does not run until `09:55 UTC`

So CTPI also runs before the NST team daily sources that are supposed to keep it current.

This is a direct ownership mismatch, not just a stale-data caveat.

## Matchup-Edge Ownership

Team Trend Context gets matchup edge from `/api/v1/start-chart`.

That means its matchup leg is downstream of:

- Start Chart ratings
- which are themselves downstream of team power

Current schedule:

- `update-start-chart-projections` runs at `09:40 UTC`
- after both team-power writers

That ordering is at least directionally correct.

But because the team-power writers themselves are using stale/misordered upstreams, the matchup-edge leg inherits that weakness.

## Dashboard Policy Layer

Team Trend Context is more formally represented than Top Adds:

- [freshness.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/freshness.ts) includes:
  - `team-ratings` as `30h error`
  - `team-ctpi` as `72h warn`
- [perfBudget.ts](/Users/tim/Code/fhfhockey.com/web/lib/dashboard/perfBudget.ts) includes:
  - `/api/team-ratings`
  - `/api/v1/trends/team-ctpi`

But the freshness policy is currently misleading for CTPI:

- the dashboard checks `generatedAt`
- the route sets `generatedAt` to request time
- the real stale signal is the latest CTPI snapshot date inside the spark series

So the policy layer exists, but it is checking the wrong field and can therefore mark a stale CTPI feed as fresh.

## Ownership Findings

### 1. Team power is scheduled before required upstreams refresh

This is the strongest ownership failure.

The current runbook places:

- team power writes before `update-wgo-teams`
- team power writes before `update-nst-team-daily`
- team power writes before any active `nst-team-stats` refresh

That means the scheduled chain does not actually match the data dependencies in [power-ratings.ts](/Users/tim/Code/fhfhockey.com/web/lib/power-ratings.ts).

### 2. CTPI is also scheduled before required NST inputs refresh

`update-team-ctpi-daily` runs at `09:10 UTC`, while the NST team daily writer runs at `09:55 UTC`.

So CTPI cannot honestly be considered same-day fresh under the current order.

### 3. One required team-power input is not current at all

Live source evidence showed:

- `nst_team_5v5` latest date: `2026-03-02`

But [power-ratings.ts](/Users/tim/Code/fhfhockey.com/web/lib/power-ratings.ts) still reads it as a required source.

This is not a scheduling ambiguity. It is a broken upstream freshness leg.

### 4. Another required team-power input is materially stale

Live source evidence showed:

- `wgo_team_stats` latest date: `2026-02-05`

That means the discipline/WGO portion of team power is currently based on data more than a month behind the current audit date.

### 5. The dashboard freshness policy is checking a misleading CTPI timestamp

The current dashboard policy treats CTPI freshness as the route’s `generatedAt`, but that field reflects request time rather than data recency.

So Team Trend Context currently has a formal freshness policy that can still miss the most important freshness failure in the chain.

### 6. Team-power ownership is duplicated

There are currently multiple writers/surfaces for team power:

- `update-team-power-ratings`
- `update-team-power-ratings-new`
- `refresh-team-power-ratings-daily`
- serving fallback between `team_power_ratings_daily` and `team_power_ratings_daily__new`

That duplication makes the source of truth less clear even before freshness is considered.

## Freshness-Ownership Verdict

Team Trend Context ownership clarity does not qualify for `yellow`.

Why it is not `yellow`:

- the scheduled order does not match real dependencies
- required upstreams are stale in live data
- one required upstream is not part of the earlier active chain at all
- the dashboard freshness policy can falsely treat stale CTPI as fresh

This is ownership failure at the chain-definition level, not just a source lag inside an otherwise healthy chain.

## Required Follow-Ups

- reorder the team-context cron chain so:
  - NST team daily
  - WGO teams
  - `nst-team-stats`
  - CTPI/team-power writes
  - Start Chart projections
  happen in dependency order
- make `nst_team_5v5` a first-class owned dependency in the active team-context runbook instead of leaving it outside the earlier chain
- fix the stale `wgo_team_stats` leg or remove its influence from team-power freshness claims until it is current
- change Team Trend Context freshness checks to use real CTPI snapshot recency instead of `generatedAt`
- decide which team-power writer/table is authoritative and reduce the current duplicated ownership surface
