# Legacy Ingest Conventions

## Purpose

This document captures the current legacy ingest behavior around:

- `pbp_games`
- `pbp_plays`
- `shift_charts`
- the associated API endpoints and helper modules

The goal is not to preserve the old design wholesale. The goal is to explicitly record which behaviors the NHL API migration must:

- preserve,
- replace,
- tighten,
- or intentionally drop.

## Audited Sources

- `web/lib/supabase/Upserts/fetchPbP.ts`
- `web/pages/api/v1/db/update-PbP.ts`
- `web/pages/api/v1/db/shift-charts.ts`
- `web/lib/projections/ingest/pbp.ts`
- `web/lib/projections/ingest/shifts.ts`
- `web/lib/cron/withCronJobAudit.ts`
- `web/tmp-check-pbp-structure.js`
- `web/tmp-check-pbp-games.ts`

## Legacy PbP Flow

### Entry Points

Primary route:

- `web/pages/api/v1/db/update-PbP.ts`

Primary ingest helper:

- `web/lib/supabase/Upserts/fetchPbP.ts`

Projection-side duplicate ingest helper:

- `web/lib/projections/ingest/pbp.ts`

### Supported Modes

The legacy PbP route supports:

- single game via `gameId`
- previous day via `gameId=recent`
- explicit date range via `startDate` and `endDate`
- current day default run with no parameters
- full historical/backlog mode via `games=all`

### Scope Selection Rules

Legacy `fetchPbP.ts` selects candidate games from the local `games` table, not directly from NHL schedule endpoints.

It also limits processing to a selected season slice:

- reads all rows from `seasons`
- sorts descending by `startDate`
- keeps the most recent six seasons

### Idempotency Behavior

Single-game mode:

- checks `pbp_plays` for any row with `gameid = gameId`
- checks `pbp_games` for any row with `id = gameId`
- if either exists, the game is treated as already processed and skipped

Date-range and current-day mode:

- if not `fullProcess`, existing `pbp_plays.gameid` rows are used as the skip signal
- the route skips already processed games rather than re-fetching them

Full backlog mode:

- does not skip existing games
- re-fetches and upserts all candidate games in the selected range

### Write Pattern

`pbp_games`:

- one row per game
- `upsert(gameInfo)` with no explicit `onConflict`
- relies on table primary key or default Supabase upsert target behavior

`pbp_plays`:

- one row per play
- `id = eventId`
- bulk `upsert(plays)` per game with no explicit `onConflict`
- relies on table primary key or default Supabase upsert target behavior

### Retry and Rate-Limit Behavior

Legacy PbP fetch behavior:

- retries failed NHL fetches up to 3 times
- waits 2 seconds between retries
- waits 1 second between processed games

### Flattening Contract

Legacy `pbp_plays` is a typed flattened projection of the event payload, including:

- event timing
- `situationCode`
- `typeDescKey`
- `sortOrder`
- selected participant IDs
- coordinates
- score state
- shot and penalty subfields

Important limitations:

- no immutable raw payload storage
- no raw `details` JSON preservation
- no payload hash or fetch snapshot audit trail
- event schema evolution is lossy because only promoted columns survive

### Audit Behavior

`update-PbP.ts` is wrapped by `withCronJobAudit`.

Current audit behavior:

- `job_name` defaults to the request path
- `status` becomes `success` or `failure`
- `rows_affected` is inferred from the response body if possible
- `details` stores method, URL, status code, duration, timing envelope, error, and serialized response

Current limitation:

- the PbP route response only returns a message string
- it does not return a concrete processed-row count
- this means `cron_job_audit.rows_affected` is likely `null` for PbP runs

## Legacy Shift Flow

### Entry Points

Primary route:

- `web/pages/api/v1/db/shift-charts.ts`

Projection-side duplicate ingest helper:

- `web/lib/projections/ingest/shifts.ts`

### Scope Selection Rules

The main legacy shift route is incremental by default and does not take date parameters.

It:

- reads the latest processed `game_date` from `shift_charts`
- fetches the current season ID
- loops team schedules for every NHL team
- keeps only finished games
- skips games whose `gameDate` is on or before the latest processed date
- deduplicates candidate games via a `Set`

Important limitation:

- the skip watermark is `latest game_date`, not per-game completeness
- this is coarse and can skip legitimate reprocessing for games on the same date
- it is not a robust replay or backfill contract

### Write Pattern

`shift_charts`:

- one row per player per game
- explicit `onConflict: "game_id,player_id"`
- stores aggregated TOI and multiple derived JSON structures, not raw shift rows

Stored content includes:

- full shift arrays
- PP and ES shift segments
- TOI totals
- teammate overlap summaries
- line and pairing assignments
- player position enrichment

Projection-side `web/lib/projections/ingest/shifts.ts` is narrower:

- fetches raw `shiftcharts`
- derives ES, PP, PK totals using PbP `situationCode` segments
- upserts one row per player per game into `shift_charts`
- also uses `onConflict: "game_id,player_id"`

### Dependency Contract

Legacy shift ingestion depends on more than raw shift rows.

The route currently pulls from:

- `pp_timeframes` for power-play windows
- `yahoo_positions` for position matching
- NHL team schedules
- NHL shiftchart endpoint

This means the current `shift_charts` table is both:

- an ingest artifact
- and a derived analytics surface

That coupling should be replaced in the new design.

### Audit Behavior

`shift-charts.ts` writes its own `cron_job_audit` row manually.

Current audit payload includes:

- `job_name = "update-shift-charts"`
- `status`
- `rows_affected = totalRowsUpserted`
- `details.method`
- `details.url`
- `details.statusCode`
- `details.durationMs`
- `details.error`
- `details.response`
- `details.context`

The route also returns:

- success flag
- message
- unmatched names list

This is a stronger audit contract than the current PbP route because it reports affected-row counts and useful context.

## Shared Legacy Conventions

### What The New Pipeline Should Preserve

- idempotent writes for the same logical game or player-game key
- explicit conflict targets where the table key is composite
- incremental processing mode for current production usage
- targeted single-game reprocessing mode
- auditable API routes that write `cron_job_audit`
- enough response structure for `rows_affected` to be inferable or explicit

### What The New Pipeline Should Replace

- skip logic based only on destination-table existence
- skip logic based only on `latest game_date`
- lossy flattened-only storage with no immutable raw payload snapshots
- blended raw ingest plus derived analytics in the same table
- duplicated PbP and shift ingest logic living in multiple modules

### What The New Pipeline Should Tighten

- use explicit raw snapshot identity such as `(game_id, endpoint, payload_hash)`
- use explicit normalized event identity such as `(game_id, event_id)`
- persist row counts in route responses so audit rows have meaningful `rows_affected`
- support forced re-ingest and versioned replay without hand-editing skip logic
- separate raw ingest, normalized tables, and derived parity/model outputs

## Preserve Or Replace Matrix

Preserve:

- `pbp_games` and `pbp_plays` logical grain of one game row plus one event row per play
- `shift_charts` composite idempotency key idea of one row per player per game where compatibility output is still needed
- route-level cron auditing

Replace:

- flattened-only PbP storage with raw-plus-normalized storage
- aggregated-only shift storage with raw shift rows plus later derived outputs
- date-watermark-only incremental logic with per-game replayable ingest state

Tighten:

- return explicit counts from every ingest route
- make `onConflict` explicit everywhere
- version parser and strength logic
- store upstream fetch metadata and payload hashes
