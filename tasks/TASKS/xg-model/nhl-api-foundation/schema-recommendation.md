# Schema Recommendation

## Purpose

This document is the architecture decision record for the NHL API ingestion foundation.

It explains:

- the recommended storage shape,
- why raw snapshots plus normalized event and shift rows are preferred,
- why a primary per-game JSONB design is not sufficient,
- how the current migration fits the long-term plan.

## Recommendation

Use a layered raw-plus-normalized design:

1. Immutable raw endpoint snapshots per game and endpoint
2. Normalized roster rows
3. Normalized one-row-per-event play-by-play rows
4. Normalized one-row-per-shift shift rows
5. Later derived feature tables
6. Later parity-output tables

This is the recommended phase 1 foundation and the direction already started in:

- `migrations/20260330_create_nhl_api_raw_ingestion_tables.sql`

## Chosen Shape

### Raw Layer

Store immutable raw payloads in:

- `nhl_api_game_payloads_raw`

Why:

- preserves auditability
- preserves replayability
- supports parser changes without re-fetching upstream
- makes upstream drift debuggable

### Normalized Roster Layer

Store one row per roster spot in:

- `nhl_api_game_roster_spots`

Why:

- avoids re-parsing `rosterSpots` from JSON on every query
- supports player/team joins without JSON traversal
- gives a stable per-game roster dimension

### Normalized Event Layer

Store one row per play-by-play event in:

- `nhl_api_pbp_events`

Why:

- this is the natural grain for parity and xG-style features
- prior-event windows require rowwise ordering
- event filters by type, player, strength, period, or team become indexable
- exact exclusions such as shootout removal are easier and safer

### Normalized Shift Layer

Store one row per shift record in:

- `nhl_api_shift_rows`

Why:

- on-ice attribution requires shift-grain data
- shift overlap, stints, zone starts, deployment, and PP-age features all depend on interval logic
- aggregated player-game TOI tables are not enough for replayable attribution

## Why Not A Primary Per-Game JSONB Design

A primary per-game JSONB design would mean storing the game payload as the main analytic source and querying most logic out of nested JSON arrays.

That is not the right primary design here.

### 1. Event-Sequence Features Need Row Grain

Expected-goals groundwork depends on:

- previous event type
- previous event team
- time since previous event
- distance from previous event
- same-sequence and flurry logic
- rebound windows
- rush context

Those are naturally expressed with:

- deterministic event ordering
- row-by-row window functions
- indexed event tables

They are awkward, slower, and more error-prone when the primary source is arrays embedded in JSONB.

### 2. On-Ice Attribution Needs Shift Intervals, Not Blobs

NST parity depends on:

- on-ice counts
- on-ice rates
- zone starts
- faceoff-zone attribution
- player deployment
- PP and PK attribution

That requires joining event timestamps to actual shift intervals.

A JSONB-first design forces repeated array expansion and custom interval logic at query time. A normalized shift table makes that work explicit, reusable, testable, and indexable.

### 3. Analytics Queries Need Stable Keys And Indexes

The target query patterns are by:

- season
- game
- team
- player
- strength
- event type
- event order

Relational rows support:

- composite primary keys
- explicit conflict targets
- efficient btree indexes
- partial and covering query plans later if needed

JSONB snapshots alone do not provide the right default shape for this.

### 4. Parser Evolution Must Be Replayable

We already know parser and parity rules will evolve:

- strength decoding versions
- danger-bucket versions
- rebound and rush rules
- xG feature versions
- parity-definition versions

With raw snapshots plus normalized rows:

- raw source stays immutable
- normalized outputs can be replayed under a new parser version
- differences can be compared systematically

With a JSONB-only primary design:

- every downstream query must keep carrying parsing logic
- versioning becomes harder to isolate
- historical output comparisons become less disciplined

### 5. Compatibility And Migration Are Easier With Normalized Rows

The repo already depends on row-oriented legacy surfaces such as:

- `pbp_games`
- `pbp_plays`
- `shift_charts`
- NST parity tables

Replacing those with normalized relational layers is a manageable migration path.

Replacing them with a JSONB-first analytics model would push complexity outward into every downstream consumer.

### 6. Supabase/Postgres Windowing Favors Rows

The planned workload benefits from standard SQL patterns:

- `lag` and `lead`
- partition-by game ordering
- interval joins
- grouped per-player/per-team aggregation
- filtered strength splits
- replay validation queries

Those patterns are straightforward on normalized tables and poor as a primary operating model on nested JSON arrays.

## Why Raw JSON Still Matters

Rejecting JSONB as the primary analytic grain does not mean rejecting JSONB.

JSONB is still the correct format for:

- immutable upstream payload snapshots
- preserving unpromoted fields
- auditing endpoint drift
- debugging parser regressions

The key distinction is:

- JSONB should be the immutable source-of-truth archive
- relational rows should be the primary analytic operating model

## Option Comparison

### Option A: Raw + Normalized + Derived Layers

Shape:

- raw payload snapshots
- normalized roster/event/shift rows
- later derived features and parity outputs

Advantages:

- best auditability
- best replayability
- best fit for window functions and attribution logic
- best fit for idempotent upserts
- best fit for strength-split aggregation

Costs:

- more tables
- explicit parser code required
- migration planning required for derived layers

Verdict:

- chosen

### Option B: Per-Game JSONB As Primary Analytic Store

Shape:

- raw payloads stored once per game
- most logic derived from JSON arrays at read time

Advantages:

- fewer initial tables
- faster initial ingest implementation

Costs:

- weak query ergonomics
- weak indexing for event/shift analytics
- repeated parsing cost
- poor fit for prior-event features
- poor fit for on-ice interval joins
- harder parity validation and versioned replay

Verdict:

- rejected as the primary operating design

## Current Phase 1 Table Mapping

Current migration-aligned layer map:

- raw snapshots
  - `nhl_api_game_payloads_raw`
- normalized roster
  - `nhl_api_game_roster_spots`
- normalized events
  - `nhl_api_pbp_events`
- normalized shifts
  - `nhl_api_shift_rows`
- convenience read surface
  - `nhl_api_pbp_shot_events_v1`

Planned later layers:

- shot-feature tables
- stint/on-ice attribution tables
- NST-parity output tables
- xG model-input tables

## Field Boundary Decision

The storage contract should distinguish clearly between:

1. fields that stay only in raw endpoint JSONB
2. fields promoted into normalized typed columns
3. fields deferred to later derived feature tables

### Keep Only In Raw Endpoint JSONB

These fields should remain only in the immutable endpoint payloads unless a later concrete use case justifies promotion.

Examples:

- clip and highlight metadata
  - `highlightClip`
  - `highlightClipFr`
  - `discreteClip`
  - sharing URLs
- venue and presentation metadata not needed for parity or feature generation
- broadcast and summary packaging fields from `landing`
- any endpoint-specific decorative or media fields
- boxscore sections not required for phase 1 roster or event normalization

Why:

- they are useful for audit and future enrichment
- they are not required for current parity or xG-feature groundwork
- promoting them now would add schema noise without analytic value

### Promote To Typed Normalized Columns

These fields should be promoted because they are query-critical, filter-critical, or foundational to parity and feature logic.

#### Raw Snapshot Table

Promote:

- `game_id`
- `endpoint`
- `season_id`
- `game_date`
- `source_url`
- `payload_hash`
- `fetched_at`

Why:

- these fields drive replay, deduplication, and audit lookup

#### Roster Table

Promote:

- `game_id`
- `season_id`
- `game_date`
- `source_play_by_play_hash`
- `parser_version`
- `team_id`
- `player_id`
- `first_name`
- `last_name`
- `sweater_number`
- `position_code`
- `headshot_url`

Keep alongside:

- `raw_spot`

Why:

- these are the stable join and roster-display fields required by phase 1

#### Event Table

Promote:

- identity and ordering
  - `game_id`
  - `source_play_by_play_hash`
  - `parser_version`
  - `strength_version`
  - `event_id`
  - `sort_order`
- game-time context
  - `season_id`
  - `game_date`
  - `period_number`
  - `period_type`
  - `time_in_period`
  - `time_remaining`
  - `period_seconds_elapsed`
  - `time_remaining_seconds`
- strength context
  - `situation_code`
  - `away_goalie`
  - `away_skaters`
  - `home_skaters`
  - `home_goalie`
  - `strength_exact`
  - `strength_state`
  - `home_team_defending_side`
- event classification
  - `type_code`
  - `type_desc_key`
  - `is_shot_like`
  - `is_goal`
  - `is_penalty`
- event ownership
  - `event_owner_team_id`
  - `event_owner_side`
- participant IDs and player references
  - `losing_player_id`
  - `winning_player_id`
  - `shooting_player_id`
  - `scoring_player_id`
  - `goalie_in_net_id`
  - `blocking_player_id`
  - `hitting_player_id`
  - `hittee_player_id`
  - `committed_by_player_id`
  - `drawn_by_player_id`
  - `served_by_player_id`
  - `player_id`
  - `assist1_player_id`
  - `assist2_player_id`
- shot and penalty context
  - `shot_type`
  - `penalty_type_code`
  - `penalty_desc_key`
  - `penalty_duration_minutes`
  - `reason`
  - `secondary_reason`
- geometry and zone
  - `x_coord`
  - `y_coord`
  - `zone_code`
- scoreboard state
  - `home_score`
  - `away_score`
  - `home_sog`
  - `away_sog`

Keep alongside:

- `raw_event`
- `details`

Why:

- these fields are repeatedly needed in filters, joins, windows, and aggregations
- they form the normalized contract for parity and later feature derivation

Strength-specific contract:

- `strength_exact` stores the exact manpower label in away-vs-home skater format such as `5v5`, `5v4`, `6v5`, or `3v3`
- `strength_state` stores the canonical event-relative label limited to `EV`, `PP`, `SH`, or `EN`
- both fields must coexist on normalized event rows because exact manpower and canonical state answer different query needs
- exact manpower is needed for distinctions such as `5v5` versus `3v3` and `6v5`
- canonical state is needed for broader parity buckets such as EV, PP, PK-facing SH, and EN
- `strength_version` must be stored with normalized event rows so the same raw `situationCode` can be replayed under a future decoding revision without ambiguity

#### Shift Table

Promote:

- identity
  - `game_id`
  - `shift_id`
  - `source_shiftcharts_hash`
  - `parser_version`
- game and player context
  - `season_id`
  - `game_date`
  - `player_id`
  - `team_id`
  - `team_abbrev`
  - `team_name`
  - `first_name`
  - `last_name`
- interval context
  - `period`
  - `shift_number`
  - `start_time`
  - `end_time`
  - `duration`
  - `start_seconds`
  - `end_seconds`
  - `duration_seconds`
- shift-event linkage fields
  - `type_code`
  - `detail_code`
  - `event_number`
  - `event_description`
  - `event_details`
  - `hex_value`

Keep alongside:

- `raw_shift`

Why:

- these fields are required for shift overlap logic, player-team joins, and later stint derivation

### Defer To Derived Feature Tables

Do not store these as first-class normalized columns in the raw foundation tables. Compute them later in derived tables with explicit versioning.

Examples:

- normalized attacking-direction coordinates
- shot distance
- shot angle
- east-west movement proxies
- time since previous event
- distance from previous event
- previous event type/team
- rebound flags
- rush flags
- flurry grouping and sequence IDs
- power-play age
- fatigue and shift-age features
- scoring-chance buckets
- danger buckets
- xG values
- parity-family aggregates such as CF, xGF, HDCF, PDO, zone-start percentages, and on-ice rates

Why:

- they are functions of normalized rows, not direct upstream fields
- they need explicit parser/feature/parity versioning
- storing them too early would mix raw normalization with derived semantics

## Practical Rule

Use this rule when deciding where a field belongs:

- If it is required to identify, order, filter, join, or directly reconstruct an upstream event or shift row, promote it.
- If it is useful only for audit or future enrichment, keep it only in raw JSONB.
- If it is computed from normalized rows or depends on versioned methodology, defer it to derived feature or parity tables.

## Versioning And Replay Contract

Phase 1 normalized schema must support replayable backfills by recording:

- the raw snapshot identity that produced the row
- the parser version used to normalize it
- the strength version used to classify manpower state when relevant

Current normalized-table contract:

- `nhl_api_game_roster_spots`
  - `source_play_by_play_hash`
  - `parser_version`
- `nhl_api_pbp_events`
  - `source_play_by_play_hash`
  - `parser_version`
  - `strength_version`
- `nhl_api_shift_rows`
  - `source_shiftcharts_hash`
  - `parser_version`

Later derived-table contract:

- shot-feature tables must carry:
  - `parser_version`
  - `strength_version`
  - `feature_version`
- parity-output tables must carry:
  - `parser_version`
  - `strength_version`
  - `feature_version` where applicable
  - `parity_version`

### Normalized Attacking-Direction Coordinates

Normalized attacking-direction coordinates are required by the overall system, but they should not live in the raw-normalized foundation table as prematurely fixed feature columns.

Decision:

- keep raw rink coordinates in `nhl_api_pbp_events`
- derive attacking-direction-normalized coordinates in the later shot-feature layer
- version that transformation under `feature_version`

Why:

- coordinate normalization is deterministic but still methodological
- distance and angle logic may evolve
- storing it in the feature layer avoids mixing raw normalization with feature methodology

### Replayable Backfills

Replayability depends on all of the following:

- immutable raw snapshots in `nhl_api_game_payloads_raw`
- normalized rows tied to specific source payload hashes
- explicit parser and strength versions on normalized rows
- future feature and parity versions on derived tables

That contract allows:

- re-running the same game from the same raw payload
- comparing outputs across parser or strength revisions
- rebuilding derived layers without mutating the upstream archive

## Index And Constraint Plan

Phase 1 normalized schema should explicitly support efficient access by:

- game
- event order
- team
- player
- strength
- event type

### Implemented Core Indexes

Raw snapshots:

- `(game_id, endpoint, fetched_at desc)`
- `(season_id, game_date desc, endpoint)`

Roster rows:

- primary key `(game_id, player_id)`
- `(team_id, player_id, game_date desc)`
- `(season_id, game_date desc, game_id)`
- `(player_id, game_date desc, game_id)`

Event rows:

- primary key `(game_id, event_id)`
- `(game_id, sort_order)`
- `(game_id, type_desc_key, sort_order)`
- `(season_id, game_date desc, type_desc_key)`
- `(type_desc_key, strength_state, game_date desc)`
- `(event_owner_team_id, game_date desc)`
- `(strength_state, strength_exact, game_date desc)`
- partial player-centric indexes for:
  - `player_id`
  - `shooting_player_id`
  - `scoring_player_id`
- shot-family access:
  - `(is_shot_like, game_date desc, game_id)`
- `details` GIN index for occasional raw-key lookups

Shift rows:

- primary key `(game_id, shift_id)`
- `(game_id, player_id, period, start_seconds)`
- `(game_id, team_id, period, start_seconds)`
- `(season_id, game_date desc, team_id)`
- `(player_id, game_date desc, game_id, period, start_seconds)`

### Implemented Core Constraints

Event rows:

- goalie digits constrained to `0` or `1`
- `strength_exact` constrained to manpower-label format
- `strength_state` constrained to `EV`, `PP`, `SH`, `EN`
- `event_owner_side` constrained to `home` or `away` when present

Raw snapshots:

- immutable update guard via trigger
- non-empty `source_url`
- non-empty `payload_hash`

### Intentional Non-Indexes For Now

Do not add dedicated indexes yet for every nullable participant field such as:

- `assist1_player_id`
- `assist2_player_id`
- `blocking_player_id`
- `committed_by_player_id`
- `drawn_by_player_id`

Reason:

- phase 1 query pressure is expected to be highest on shooter, scorer, generic player, team, type, strength, and event-order access
- additional participant-specific indexes can be added later once real query patterns justify the write and storage cost

## Planned Next Migrations

The raw and normalized foundation should remain narrow.

Do not keep adding derived semantics to:

- `nhl_api_pbp_events`
- `nhl_api_shift_rows`
- `nhl_api_game_roster_spots`

Instead, phase 1 should continue with separate migrations for:

1. derived shot and event-context features
2. NST-parity output storage

### Planned Migration 1: Derived Shot-Feature Storage

Planned file:

- `migrations/XXXXXXXXXXXX_create_nhl_shot_features_tables.sql`

Purpose:

- store derived, versioned shot and sequence context features computed from normalized event and shift data
- provide a stable base for later xG model-input construction without polluting raw-normalized tables

Recommended primary table:

- `nhl_api_shot_features`

Optional later companion table if event-context reuse becomes large enough:

- `nhl_api_event_context_features`

Recommended keying and lineage:

- primary key `(game_id, event_id)`
- foreign key to `nhl_api_pbp_events (game_id, event_id)`
- `parser_version`
- `strength_version`
- `feature_version`
- source hashes where needed for replay audit

Recommended contents:

- attacking-direction-normalized coordinates
- shot distance
- shot angle
- distance and time from previous event
- previous event type and previous event team
- previous-event coordinates where needed
- sequence or flurry identifiers
- rebound flags
- rush flags
- flurry flags
- power-play age
- shooter shift-age and fatigue proxies
- danger bucket and shot bucket outputs
- penalty-shot and empty-net derived flags where the feature layer needs them

Why this belongs in a separate migration:

- these fields are methodological, not raw upstream facts
- they may change under future `feature_version` revisions
- they are useful for both parity and xG work, but should not be embedded in the normalized ingest contract

Explicit non-goals for this migration:

- do not publish NST-facing aggregated parity tables here
- do not store fitted model outputs or final xG scores here unless a later migration explicitly introduces them
- do not duplicate immutable raw payload storage or normalized event storage

### Planned Migration 2: NST-Parity Output Storage

Planned file:

- `migrations/XXXXXXXXXXXX_create_nhl_metric_parity_tables.sql`

Purpose:

- publish the NHL-derived replacements for legacy NST-era skater and goalie outputs
- keep parity-serving aggregates separate from both the raw ingest contract and the model-feature contract

Recommended primary tables:

- `nhl_api_nst_skater_game_metrics`
- `nhl_api_nst_goalie_game_metrics`

Recommended supporting audit table:

- `nhl_api_nst_parity_audits`

Recommended keying and lineage:

- game-, player-, and team-scoped primary keys appropriate to each output table
- `parser_version`
- `strength_version`
- `feature_version` where the metric depends on derived feature logic
- `parity_version`

Recommended contents:

- all-situations and strength-split skater metrics
- all-situations and strength-split goalie metrics
- counts, rates, on-ice counts, and on-ice rates where applicable
- parity audit status fields and comparison metadata for sampled validations

Why this belongs in a separate migration:

- parity outputs are published products, not source facts
- parity definitions may evolve independently from parser and feature logic
- keeping parity tables separate makes dual-run validation, replays, and version comparisons much cleaner

Explicit non-goals for this migration:

- do not store raw events, shift rows, or unaggregated shot-feature rows here
- do not overload parity tables with model-training-only features
- do not make parity tables the canonical source for raw event reconstruction

### Migration Boundary Rule

Use these boundaries consistently:

- raw tables store immutable upstream payloads
- normalized tables store replayable row-level upstream facts
- feature tables store derived event and shot context
- parity tables store published NST-era metric outputs

If a field can be recomputed from normalized rows and exists mainly to support modeling or classification, it belongs in the feature layer.

If a field is an aggregate intended to replace a legacy NST-facing surface, it belongs in the parity layer.

## Decision

Phase 1 should continue with:

- immutable raw JSON snapshot storage
- normalized one-row-per-event storage
- normalized one-row-per-shift storage

and should not pivot to a primary per-game JSONB analytics design.

That decision is required by:

- auditability,
- idempotent replay,
- strength-aware aggregation,
- shift-based on-ice attribution,
- and future xG feature engineering.
