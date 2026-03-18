# Forge Dashboard Data Operator Runbook

## Purpose

This runbook is the operational procedure for restoring, rebuilding, validating, and troubleshooting the data pipelines that feed the Forge Dashboard.

This document covers:

1. Sustainability data
2. Team Power data
3. Required source ingests
4. Derived-table rebuild order
5. Manual validation after each stage
6. How to process every player batch explicitly, without relying on shorthand

This runbook is written for local development against:

- `http://localhost:3000`

The procedures below assume that:

1. the application is running locally
2. the local environment is pointed at the intended Supabase project
3. the operator has permission to call all rebuild endpoints and run SQL against the database

## Important Operating Rules

Before running anything, read these rules:

1. Do not run derived rebuild endpoints before their source tables are current.
2. Do not assume one successful endpoint call completes a full rebuild.
3. Several endpoints process players in batches. When that happens, one request only processes one batch, not all players.
4. Always validate table counts and latest dates after each major stage.
5. If a materialized view is stale, rebuilding downstream tables from it will produce stale or incomplete output.

## Forge Dashboard Data Domains

The Forge Dashboard currently depends on two independent data domains relevant to this runbook:

1. Sustainability
2. Team Power

These domains have different source tables and different rebuild chains.

## Part One: Sustainability Domain

### Sustainability Overview

The Sustainability panel depends on the following source and derived objects.

### Sustainability Source Objects

The Sustainability pipeline draws from these upstream sources:

1. `player_stats_unified`
2. `player_totals_unified`

Those unified objects are themselves fed by upstream season and game ingestion tables.

### Sustainability Upstream Raw Tables

The following tables provide the raw material for the unified views:

1. `wgo_skater_stats`
2. `wgo_skater_stats_totals`
3. `nst_seasonal_individual_counts`
4. `nst_seasonal_individual_rates`
5. `nst_seasonal_on_ice_counts`
6. `nst_seasonal_on_ice_rates`

### Sustainability Derived Tables

The Sustainability rebuild chain writes into these tables:

1. `player_baselines`
2. `sustainability_priors`
3. `sustainability_player_priors`
4. `sustainability_window_z`
5. `sustainability_scores`
6. `sustainability_trend_bands`

## Part Two: Team Power Domain

### Team Power Overview

The Team Power card depends on these source and derived objects.

### Team Power Source Tables

1. `nst_team_gamelogs_as_rates`
2. `nst_team_5v5`
3. `nst_team_gamelogs_pp_rates`
4. `nst_team_gamelogs_pk_rates`
5. `wgo_team_stats`
6. `teams`

### Team Power Derived Tables

1. `team_power_ratings_daily`
2. `team_power_ratings_daily__new`

## Full Operator Procedure

Run the sections below in order.

# Section One: Confirm Environment

## Step One: Confirm the local application is running

Open the local site and verify the application responds:

- `http://localhost:3000`

If the site does not load, start the application before proceeding.

## Step Two: Confirm database connectivity

Verify that the local environment is connected to the intended Supabase project.

If you are unsure, stop and verify environment variables before running any rebuild or ingestion command.

## Step Three: Confirm the target snapshot date

Decide which date you are rebuilding for.

For the examples in this runbook, the target snapshot date is:

- `2026-03-07`

If you use a different date, substitute that date consistently in every request where a snapshot date appears.

# Section Two: Refresh Sustainability Source Data

You must refresh Sustainability source data before rebuilding Sustainability derived tables.

Run these endpoints in the following order.

## Step Four: Refresh official daily skater game data

Call:

- `/api/v1/db/update-wgo-skaters`

Full local URL:

- `http://localhost:3000/api/v1/db/update-wgo-skaters`

Purpose:

- refresh official daily skater game-by-game data
- populate and maintain the data that ultimately contributes to `player_stats_unified`

## Step Five: Refresh season statistics

Call:

- `/api/v1/db/update-season-stats`

Full local URL:

- `http://localhost:3000/api/v1/db/update-season-stats`

Purpose:

- refresh season-level player statistical inputs used in unified player layers

## Step Six: Refresh current season Natural Stat Trick season data

Call:

- `/api/v1/db/update-nst-current-season`

Full local URL:

- `http://localhost:3000/api/v1/db/update-nst-current-season`

Purpose:

- refresh Natural Stat Trick season-level tables
- populate season totals and rates used by `player_totals_unified`

## Step Seven: Refresh Natural Stat Trick player game logs

Call:

- `/api/v1/db/update-nst-gamelog`

Full local URL:

- `http://localhost:3000/api/v1/db/update-nst-gamelog`

Purpose:

- refresh Natural Stat Trick game log data
- populate game-level data used by `player_stats_unified`

### If incremental mode is not enough

If the current season still appears stale after the incremental call, run:

- `http://localhost:3000/api/v1/db/update-nst-gamelog?runMode=forward`

Purpose:

- force a broader refresh of the current season rather than just picking up the latest incremental dates

# Section Three: Refresh the Materialized View for Player Totals

This is a required step.

If `player_totals_unified` is stale, the Sustainability priors and player priors will be wrong or empty.

## Step Eight: Refresh `player_totals_unified`

Run this SQL:

```sql
REFRESH MATERIALIZED VIEW player_totals_unified;
```

If you have already created a unique index on `(player_id, season_id)`, you may use:

```sql
REFRESH MATERIALIZED VIEW CONCURRENTLY player_totals_unified;
```

## Step Nine: Ensure the unique index exists for future concurrent refreshes

Run this SQL once if it does not already exist:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_player_totals_unified_pk
ON player_totals_unified (player_id, season_id);
```

## Step Ten: Validate that `player_totals_unified` now contains current-season rows

Run a validation query similar to:

```sql
SELECT COUNT(*)
FROM player_totals_unified
WHERE season_id = 20252026;
```

Expected result:

- a non-zero row count

If the result is zero, stop here. Do not proceed to Sustainability priors until the materialized view is fixed.

# Section Four: Rebuild Sustainability Derived Tables

Once source data is refreshed and `player_totals_unified` has current-season rows, rebuild the Sustainability chain in this order.

## Step Eleven: Rebuild player baselines

Call:

- `http://localhost:3000/api/v1/db/sustainability/rebuild-baselines?snapshot_date=2026-03-07`

Purpose:

- populate `player_baselines` for the target snapshot date

## Step Twelve: Rebuild league priors and player posteriors

Call:

- `http://localhost:3000/api/v1/sustainability/rebuild-priors?season=20252026`

Purpose:

- populate `sustainability_priors`
- populate `sustainability_player_priors`

## Step Thirteen: Validate priors before moving on

Check for:

1. `sustainability_priors` rows existing for season `20252026`
2. non-zero `league_mu` values
3. non-zero `sustainability_player_priors` row count

If `league_mu` values are all zero, stop and return to the `player_totals_unified` refresh stage.

# Section Five: Rebuild Sustainability Window Z-Scores

This endpoint does not process every player in one request.

It uses two query parameters:

1. `limit`
2. `offset`

## What `limit` means

`limit` is the number of players processed in a single request.

In this runbook, `limit=250` means:

- each request processes 250 players

## What `offset` means

`offset` is how many players to skip before starting the next batch.

Examples:

1. `offset=0` means process players `1` through `250`
2. `offset=250` means skip the first 250 players and process players `251` through `500`
3. `offset=500` means skip the first 500 players and process players `501` through `750`
4. `offset=750` means skip the first 750 players and process players `751` through `1000`

If your snapshot has 958 baseline rows, you must call every batch needed to cover all 958 players.

For a `limit` of `250`, and 958 eligible players, you must make exactly four calls.

## Step Fourteen: Run the first window z-score batch

Call:

- `http://localhost:3000/api/v1/sustainability/rebuild-window-z?season=20252026&snapshot_date=2026-03-07&offset=0&limit=250`

## Step Fifteen: Run the second window z-score batch

Call:

- `http://localhost:3000/api/v1/sustainability/rebuild-window-z?season=20252026&snapshot_date=2026-03-07&offset=250&limit=250`

## Step Sixteen: Run the third window z-score batch

Call:

- `http://localhost:3000/api/v1/sustainability/rebuild-window-z?season=20252026&snapshot_date=2026-03-07&offset=500&limit=250`

## Step Seventeen: Run the fourth window z-score batch

Call:

- `http://localhost:3000/api/v1/sustainability/rebuild-window-z?season=20252026&snapshot_date=2026-03-07&offset=750&limit=250`

## Step Eighteen: Validate window z-score output

Check:

- `sustainability_window_z` row count for `snapshot_date = 2026-03-07`

Expected shape:

- one player
- multiplied by four window codes
- multiplied by four stat codes

If the count is only `4000`, that usually means only the first batch was processed:

- `250 players * 4 windows * 4 stat codes = 4000`

# Section Six: Rebuild Sustainability Scores

This endpoint also requires full batch coverage.

Use the exact same batch sequence.

## Step Nineteen: Run the first score batch

Call:

- `http://localhost:3000/api/v1/sustainability/rebuild-score?season=20252026&snapshot_date=2026-03-07&offset=0&limit=250`

## Step Twenty: Run the second score batch

Call:

- `http://localhost:3000/api/v1/sustainability/rebuild-score?season=20252026&snapshot_date=2026-03-07&offset=250&limit=250`

## Step Twenty-One: Run the third score batch

Call:

- `http://localhost:3000/api/v1/sustainability/rebuild-score?season=20252026&snapshot_date=2026-03-07&offset=500&limit=250`

## Step Twenty-Two: Run the fourth score batch

Call:

- `http://localhost:3000/api/v1/sustainability/rebuild-score?season=20252026&snapshot_date=2026-03-07&offset=750&limit=250`

## Step Twenty-Three: Validate Sustainability scores

Check:

- `sustainability_scores` row count for `snapshot_date = 2026-03-07`

Expected shape:

- one player
- multiplied by four windows

If the count is only `1000`, that usually means only the first batch was processed:

- `250 players * 4 windows = 1000`

# Section Seven: Rebuild Sustainability Trend Bands

Trend bands are separate from Sustainability scores.

They may already be fresher than `sustainability_scores`, but for a full rebuild they should still be run after the score rebuild.

## Step Twenty-Four: Run the first trend band batch

Call:

- `http://localhost:3000/api/v1/sustainability/rebuild-trend-bands?snapshot_date=2026-03-07&offset=0&limit=250`

## Step Twenty-Five: Run the second trend band batch

Call:

- `http://localhost:3000/api/v1/sustainability/rebuild-trend-bands?snapshot_date=2026-03-07&offset=250&limit=250`

## Step Twenty-Six: Run the third trend band batch

Call:

- `http://localhost:3000/api/v1/sustainability/rebuild-trend-bands?snapshot_date=2026-03-07&offset=500&limit=250`

## Step Twenty-Seven: Run the fourth trend band batch

Call:

- `http://localhost:3000/api/v1/sustainability/rebuild-trend-bands?snapshot_date=2026-03-07&offset=750&limit=250`

## Optional historical trend band rebuild

If you want to build a historical date range, run batched calls like:

- `http://localhost:3000/api/v1/sustainability/rebuild-trend-bands?history=true&start_date=2026-02-01&end_date=2026-03-07&offset=0&limit=250`
- `http://localhost:3000/api/v1/sustainability/rebuild-trend-bands?history=true&start_date=2026-02-01&end_date=2026-03-07&offset=250&limit=250`
- `http://localhost:3000/api/v1/sustainability/rebuild-trend-bands?history=true&start_date=2026-02-01&end_date=2026-03-07&offset=500&limit=250`
- `http://localhost:3000/api/v1/sustainability/rebuild-trend-bands?history=true&start_date=2026-02-01&end_date=2026-03-07&offset=750&limit=250`

# Section Eight: Refresh Team Power Source Data

Team Power uses a separate source chain.

Run these steps after or independently from Sustainability.

## Step Twenty-Eight: Refresh Natural Stat Trick team game logs

Call:

- `http://localhost:3000/api/v1/db/update-nst-gamelog?runMode=incremental`

If incremental mode does not advance the team tables enough, run:

- `http://localhost:3000/api/v1/db/update-nst-gamelog?runMode=forward`

## Step Twenty-Nine: Refresh WGO averages

Call:

- `http://localhost:3000/api/v1/db/update-wgo-averages`

## Step Thirty: Refresh WGO totals

Call:

- `http://localhost:3000/api/v1/db/update-wgo-totals`

## Step Thirty-One: Validate Team Power source freshness

Check the latest dates in:

1. `nst_team_gamelogs_as_rates`
2. `nst_team_gamelogs_pp_rates`
3. `nst_team_gamelogs_pk_rates`
4. `wgo_team_stats`

If the latest Natural Stat Trick team dates are still behind the target date, Team Power will still be stale after rebuild.

# Section Nine: Rebuild Team Power Tables

## Step Thirty-Two: Rebuild the legacy Team Power table

Call:

- `http://localhost:3000/api/v1/db/update-team-power-ratings?date=2026-03-07`

## Step Thirty-Three: Rebuild the new Team Power table

Call:

- `http://localhost:3000/api/v1/db/update-team-power-ratings-new?date=2026-03-07`

## Step Thirty-Four: Validate Team Power output

Check:

1. the latest rows exist for `date = 2026-03-07`
2. `trend10` contains non-zero values for at least some teams

If `trend10` is still zero for every team:

1. the Team Power source data is still stale
2. or the Team Power rebuild logic is reusing frozen historical values

At that point, the Forge dashboard is only reflecting the source state correctly and the remaining work is pipeline debugging, not dashboard debugging.

# Section Ten: Dashboard Validation

After all rebuilds complete, validate the dashboard itself.

## Step Thirty-Five: Reload the Forge Dashboard

Open:

- `http://localhost:3000/forge/dashboard`

## Step Thirty-Six: Validate Sustainability panel

Confirm:

1. the panel no longer shows an empty-state message for the target date
2. the panel no longer depends on stale fallback if current data now exists
3. the list contains multiple player rows

## Step Thirty-Seven: Validate Team Power card

Confirm:

1. the card contains sixteen teams per view
2. `Top 16` view works
3. `Bottom 16` view works
4. trend values are no longer universally `0.0`

If the trend values are still universally `0.0`, the Team Power generator remains the blocker.

# Section Eleven: Quick Diagnosis Guide

## Symptom: `rebuild-priors` returns `inserted_player_rows = 0`

Root cause:

- `player_totals_unified` is empty or stale for the requested season

Action:

1. refresh `player_totals_unified`
2. validate current-season rows exist
3. rerun `rebuild-priors`

## Symptom: Sustainability panel uses current date but still looks sparse

Root cause:

- only the first `rebuild-window-z` and `rebuild-score` batch was processed

Action:

1. run every explicit batch:
   - `offset=0`
   - `offset=250`
   - `offset=500`
   - `offset=750`
2. validate row counts again

## Symptom: Sustainability panel still falls back to an older date

Root cause:

- current snapshot date was not fully built into `sustainability_scores`

Action:

1. validate `player_baselines` for the target snapshot date
2. validate `sustainability_window_z` for the target snapshot date
3. validate `sustainability_scores` for the target snapshot date

## Symptom: Team Power still shows every trend value as zero

Root cause:

- not a Forge layout problem
- the source `team_power_ratings_daily` table still contains universally flat `trend10` values

Action:

1. validate Team Power source tables
2. rerun Team Power rebuild endpoints
3. if trends remain flat, debug the Team Power generation job itself

# Section Twelve: Exact Sustainability Batch Checklist for Snapshot Date 2026-03-07

Run every item below exactly once.

## Sustainability window z-score requests

1. `http://localhost:3000/api/v1/sustainability/rebuild-window-z?season=20252026&snapshot_date=2026-03-07&offset=0&limit=250`
2. `http://localhost:3000/api/v1/sustainability/rebuild-window-z?season=20252026&snapshot_date=2026-03-07&offset=250&limit=250`
3. `http://localhost:3000/api/v1/sustainability/rebuild-window-z?season=20252026&snapshot_date=2026-03-07&offset=500&limit=250`
4. `http://localhost:3000/api/v1/sustainability/rebuild-window-z?season=20252026&snapshot_date=2026-03-07&offset=750&limit=250`

## Sustainability score requests

1. `http://localhost:3000/api/v1/sustainability/rebuild-score?season=20252026&snapshot_date=2026-03-07&offset=0&limit=250`
2. `http://localhost:3000/api/v1/sustainability/rebuild-score?season=20252026&snapshot_date=2026-03-07&offset=250&limit=250`
3. `http://localhost:3000/api/v1/sustainability/rebuild-score?season=20252026&snapshot_date=2026-03-07&offset=500&limit=250`
4. `http://localhost:3000/api/v1/sustainability/rebuild-score?season=20252026&snapshot_date=2026-03-07&offset=750&limit=250`

## Sustainability trend band requests

1. `http://localhost:3000/api/v1/sustainability/rebuild-trend-bands?snapshot_date=2026-03-07&offset=0&limit=250`
2. `http://localhost:3000/api/v1/sustainability/rebuild-trend-bands?snapshot_date=2026-03-07&offset=250&limit=250`
3. `http://localhost:3000/api/v1/sustainability/rebuild-trend-bands?snapshot_date=2026-03-07&offset=500&limit=250`
4. `http://localhost:3000/api/v1/sustainability/rebuild-trend-bands?snapshot_date=2026-03-07&offset=750&limit=250`

# Section Thirteen: Final Notes

As of the latest audit:

1. Sustainability can be restored successfully if the full batch sequence is executed.
2. Team Power remains dependent on stale or frozen upstream behavior and may require source-pipeline debugging even after rebuild endpoints are run.
3. The Forge dashboard itself is now correctly reflecting the data it receives; remaining failures are pipeline-level failures unless validation proves otherwise.


# Section Fourteen: Refresh Team Trends

1) run update-nst-team-daily.ts
2) run nst-team-stats.ts
3) update-team-power-ratings.ts
4) update-team-power-ratings-new.ts
