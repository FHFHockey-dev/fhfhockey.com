# Corrective Migration Decision

## Purpose

This document closes task `8.2` by answering whether an additive corrective migration is required for the current target Supabase project.

Reference inputs:

- `tasks/live-schema-drift-audit.md`
- `migrations/20260330_create_nhl_api_raw_ingestion_tables.sql`

## Decision

No additive corrective migration is required for the current target Supabase project.

Reason:

- the live catalog audit in `tasks/live-schema-drift-audit.md` found no remaining phase-1 drift for:
  - columns
  - constraints
  - indexes
  - trigger behavior
  - `nhl_api_pbp_shot_events_v1`

Creating a no-op SQL migration for the current target environment would add migration noise without changing the database state.

## What This Means For `8.2`

`8.2` is satisfied for the current target project by recording a no-op corrective-migration decision rather than creating a redundant SQL file.

This is the correct outcome because the original purpose of `8.2` was to repair already-created `nhl_api_*` tables if they were missing the later phase-1 additions.

That condition is not true in the audited target project anymore.

## When A Corrective Migration Would Still Be Needed

Create an additive corrective migration only if another environment is discovered with any of these missing:

- `source_play_by_play_hash`
- `source_shiftcharts_hash`
- `parser_version`
- `strength_version`
- `raw_spot`
- `raw_event`
- `raw_shift`
- non-empty hash/source constraints
- event-state checks
- expected secondary indexes
- raw immutability trigger

## Required Shape Of Any Future Corrective Migration

If a second environment does require repair, the migration must be:

- additive, not destructive
- safe against existing data
- backfill-aware before enforcing `NOT NULL`
- explicit about lineage fields
- explicit about index creation with `IF NOT EXISTS`

It must not:

- recreate the tables
- drop live data
- overwrite raw payload history
- silently invent lineage hashes for rows that cannot be traced to raw payloads

## Recommended Fallback Procedure If Another Environment Is Stale

1. run the live-schema audit against that environment
2. diff only the missing objects
3. create an additive migration for that environment’s exact gap set
4. apply it
5. regenerate Supabase types
6. rerun the sampled raw ingest and validation checks

## Current Status

For the current target project:

- no corrective migration file is being added
- the next useful step is `8.3` only if another environment is identified as stale
