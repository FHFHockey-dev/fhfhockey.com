# Live Schema Drift Audit

## Purpose

This document records the live-schema comparison for the `nhl_api_*` phase-1 foundation tables against:

- `migrations/20260330_create_nhl_api_raw_ingestion_tables.sql`

The goal of this audit was to identify any missing lineage columns, raw JSON preservation columns, indexes, trigger behavior, or supporting view definitions in the target Supabase project.

Audit date:

- March 30, 2026

Audit source:

- direct `pg` connection to the target Supabase Postgres catalog
- `information_schema.columns`
- `information_schema.table_constraints`
- `pg_indexes`
- `pg_trigger`
- `information_schema.views`

## Scope Checked

Tables checked:

- `public.nhl_api_game_payloads_raw`
- `public.nhl_api_game_roster_spots`
- `public.nhl_api_pbp_events`
- `public.nhl_api_shift_rows`

Supporting read surface checked:

- `public.nhl_api_pbp_shot_events_v1`

## Result

No live schema drift remains for the audited phase-1 objects.

The live target project currently matches the migration contract for the areas that originally mattered in the drift report:

- lineage columns
- raw JSON preservation columns
- non-empty hash constraints
- parser and strength version constraints
- event-state constraints
- expected secondary indexes
- immutable raw-payload trigger
- shot-event convenience view

## Column Comparison

### `nhl_api_game_payloads_raw`

Expected and present:

- `source_url`
- `payload_hash`
- `payload`
- `fetched_at`
- `created_at`

No missing lineage or raw-preservation columns.

### `nhl_api_game_roster_spots`

Expected and present:

- `source_play_by_play_hash`
- `parser_version`
- `raw_spot`

No missing lineage or raw-preservation columns.

### `nhl_api_pbp_events`

Expected and present:

- `source_play_by_play_hash`
- `parser_version`
- `strength_version`
- `raw_event`
- `details`
- `strength_exact`
- `strength_state`
- `event_owner_side`
- `away_goalie`
- `home_goalie`

No missing lineage or raw-preservation columns.

### `nhl_api_shift_rows`

Expected and present:

- `source_shiftcharts_hash`
- `parser_version`
- `raw_shift`

No missing lineage or raw-preservation columns.

## Constraint Comparison

Confirmed present:

- non-empty raw hash/source constraints on `nhl_api_game_payloads_raw`
- non-empty `source_play_by_play_hash` constraint on `nhl_api_game_roster_spots`
- `parser_version >= 1` constraints on roster, event, and shift tables
- `strength_version >= 1` on `nhl_api_pbp_events`
- goalie-digit checks on `nhl_api_pbp_events`
- `strength_exact` format check on `nhl_api_pbp_events`
- `strength_state` enum-style check on `nhl_api_pbp_events`
- `event_owner_side` check on `nhl_api_pbp_events`
- non-empty `source_shiftcharts_hash` constraint on `nhl_api_shift_rows`

No audited constraint from the migration was missing.

## Index Comparison

Confirmed present:

- raw payload indexes:
  - `nhl_api_game_payloads_raw_game_endpoint_idx`
  - `nhl_api_game_payloads_raw_season_date_idx`
- roster indexes:
  - `nhl_api_game_roster_spots_team_player_idx`
  - `nhl_api_game_roster_spots_season_game_idx`
  - `nhl_api_game_roster_spots_player_date_idx`
- event indexes:
  - `nhl_api_pbp_events_game_sort_idx`
  - `nhl_api_pbp_events_game_type_sort_idx`
  - `nhl_api_pbp_events_season_date_idx`
  - `nhl_api_pbp_events_type_strength_date_idx`
  - `nhl_api_pbp_events_owner_idx`
  - `nhl_api_pbp_events_strength_idx`
  - `nhl_api_pbp_events_player_idx`
  - `nhl_api_pbp_events_shooter_idx`
  - `nhl_api_pbp_events_scorer_idx`
  - `nhl_api_pbp_events_shot_like_idx`
  - `nhl_api_pbp_events_details_gin_idx`
- shift indexes:
  - `nhl_api_shift_rows_game_player_idx`
  - `nhl_api_shift_rows_game_team_idx`
  - `nhl_api_shift_rows_season_date_idx`
  - `nhl_api_shift_rows_player_date_idx`

No audited migration index was missing.

## Trigger And View Comparison

Confirmed present:

- trigger `nhl_api_game_payloads_raw_no_update`
- view `nhl_api_pbp_shot_events_v1`

The live view definition matches the current migration surface for the selected shot-event columns.

## Conclusion

The previously reported live schema drift has been resolved in the target Supabase project.

For task-planning purposes:

- `8.1` is complete with a null-drift finding
- `8.2` only remains necessary if a second environment is discovered with the older table shape
- the current target project does not need an additional corrective migration for the audited phase-1 raw-ingestion objects
