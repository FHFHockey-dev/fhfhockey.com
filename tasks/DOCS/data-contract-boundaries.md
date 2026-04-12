# Data Contract Boundaries

## Purpose

This document defines the contract boundaries between the four NHL API data layers:

1. raw upstream storage
2. normalized event and shift facts
3. derived shot and context features
4. published NST-parity outputs

Future work must preserve these boundaries so parser changes, feature changes, and parity changes can be versioned independently and replayed safely.

## Boundary Rule

Use each layer for one job only:

- raw layer stores immutable upstream payloads and raw source-row shapes
- normalized layer stores replayable typed facts directly parsed from upstream
- derived-feature layer stores methodology-bearing shot and sequence context
- parity layer stores published metric surfaces built from normalized plus feature inputs

Do not push derived methodology into raw or normalized tables.
Do not push raw JSON archives into parity tables.

## Layer 1: Raw Upstream Storage

### Purpose

The raw layer is the immutable archive of what the NHL APIs returned for a game and endpoint at fetch time.

### Canonical Storage

- `public.nhl_api_game_payloads_raw`

### Allowed Contents

- full endpoint payload JSON
- endpoint identity such as `play-by-play`, `boxscore`, `landing`, `shiftcharts`
- source URL
- payload hash
- fetch timestamp
- game identity

### Raw-Only Responsibilities

- auditability
- replayability
- upstream drift investigation
- re-parsing without re-fetching

### Raw Layer Must Not Own

- interpreted strength labels
- attacking-direction-normalized coordinates
- rebound, rush, flurry, or danger classifications
- TOI splits
- published player or goalie metrics

## Layer 2: Normalized Facts

### Purpose

The normalized layer stores one-row-per-entity facts parsed directly from raw payloads without embedding downstream methodology.

### Canonical Storage

- `public.nhl_api_game_roster_spots`
- `public.nhl_api_pbp_events`
- `public.nhl_api_shift_rows`
- convenience read surface: `public.nhl_api_pbp_shot_events_v1`

### Allowed Contents

- stable row identity:
  - `game_id`
  - `event_id`
  - `sort_order`
  - roster spot keys
  - shift row keys
- upstream-derived typed fields:
  - team ids
  - player ids
  - period and clock fields
  - score state fields
  - `type_code`
  - `type_desc_key`
  - `situation_code`
  - `x_coord`
  - `y_coord`
  - shot type
  - penalty reason
  - participant ids
  - zone code
- normalized but still parser-level interpretations:
  - `strength_exact`
  - `strength_state`
  - `event_owner_side`
  - event sequence fields such as prior and next event ids
  - `is_shot_like`
  - `is_goal`
  - `is_penalty`
- raw row preservation alongside typed fields:
  - `raw_spot`
  - `raw_event`
  - `raw_shift`

### Versioning And Lineage Required Here

- `source_play_by_play_hash`
- `source_shiftcharts_hash`
- `parser_version`
- `strength_version`

These fields make normalized rows replayable against immutable raw inputs.

### Normalized Layer Must Not Own

- mirrored attacking-direction coordinates
- distance or angle calculations
- rebound, rush, flurry, or danger-bucket outputs
- fatigue, PP age, or east-west movement proxies
- xG values or model-ready feature vectors
- published NST-parity tables

### Why

If a field can change under the same normalized event rows because methodology changed rather than the parser changed, it does not belong in the normalized layer.

## Layer 3: Derived Shot And Context Features

### Purpose

The feature layer stores methodology-bearing outputs that are derived from normalized events plus shifts.

### Canonical Builder Modules

- `web/lib/supabase/Upserts/nhlCoordinates.ts`
- `web/lib/supabase/Upserts/nhlPriorEventContext.ts`
- `web/lib/supabase/Upserts/nhlRebounds.ts`
- `web/lib/supabase/Upserts/nhlRush.ts`
- `web/lib/supabase/Upserts/nhlFlurries.ts`
- `web/lib/supabase/Upserts/nhlMissReasons.ts`
- `web/lib/supabase/Upserts/nhlContextualFeatures.ts`
- `web/lib/supabase/Upserts/nhlShotFeatureBuilder.ts`

### Allowed Contents

- attacking-direction-normalized coordinates
- shot distance and angle
- previous-event context
- rebound flags and source-shot linkage
- rush flags and source-transition linkage
- flurry sequence membership
- miss-reason buckets
- PP age
- fatigue proxies
- movement proxies
- danger buckets
- future xG values
- feature-layer inclusion flags for model eligibility

### Versioning Required Here

- `feature_version`

Any change to a methodology-bearing field in this layer must increment `feature_version`.

### Feature Layer Must Not Own

- immutable upstream payload storage
- parser-only row identity
- authoritative raw coordinates
- published parity counts and rates as the primary storage format

### Why

This layer is where approximations live. Public-data assumptions for rebound, rush, flurry, danger, and future xG must be isolated here so they can evolve without rewriting the parser contract.

## Layer 4: Published NST-Parity Outputs

### Purpose

The parity layer publishes the replacement surfaces that downstream repo consumers will read instead of NST-scraped tables.

### Canonical Builder Module

- `web/lib/supabase/Upserts/nhlNstParityMetrics.ts`

### Allowed Contents

- skater counts
- skater rates
- skater on-ice counts
- skater on-ice rates
- goalie counts
- goalie rates
- strength splits for:
  - skater `all`, `EV`, `PP`, `PK`
  - goalie `all`, `EV`, `5v5`, `PP`, `PK`
- published percentage fields:
  - `cf_pct`
  - `ff_pct`
  - `sf_pct`
  - `pdo`
  - `sv_percentage`
- published aggregates such as:
  - `ixg`
  - `xgf`
  - `xga`
  - danger-bucket counts
  - rebound and rush counts
  - zone starts
  - faceoff-zone counts

### Versioning Required Here

- `parity_version`
- `feature_version` where the metric depends on derived feature logic
- `parser_version`
- `strength_version`

### Parity Layer Must Not Own

- full raw event JSON
- row-level event parsing logic
- one-off feature experimentation that has not been versioned

### Why

Parity is a published contract. It must be reproducible from versioned normalized plus feature inputs, not from ad hoc query logic.

## Field Placement Rules

Use these tests when deciding where a field belongs:

### Raw

Place a field in raw storage if:

- it is copied from upstream as-is
- it is needed for audit or replay
- it is not required for indexed analytic queries

### Normalized

Place a field in normalized storage if:

- it is directly parsed from upstream
- it supports joins, filtering, ordering, or interval attribution
- it should not change unless parser or strength logic changes

### Derived Feature

Place a field in the feature layer if:

- it depends on coordinate normalization
- it depends on prior-event windows or shift-derived context
- it reflects public-data methodology or approximation
- it may change under the same normalized inputs when feature logic changes

### Parity

Place a field in the parity layer if:

- it is a published player, goalie, team, line, or pairing metric surface
- it aggregates normalized or feature rows into NST-replacement outputs
- it is intended for direct downstream consumption

## Examples

### Belongs In Raw Only

- `landing` presentation sections
- unused `boxscore` fragments
- upstream media or clip metadata

### Belongs In Normalized Facts

- `event_id`
- `sort_order`
- `type_desc_key`
- `event_owner_team_id`
- `event_owner_side`
- `situation_code`
- `strength_exact`
- `strength_state`
- `x_coord`
- `y_coord`
- `zone_code`
- `shooting_player_id`
- `goalie_in_net_id`

### Belongs In Derived Features

- `normalizedX`
- `normalizedY`
- `shotDistanceFeet`
- `shotAngleDegrees`
- `isReboundShot`
- `isRushShot`
- `isFlurryShot`
- `missReasonBucket`
- `ownerPowerPlayAgeSeconds`
- `crossedRoyalRoad`
- future `xgValue`

### Belongs In Parity Outputs

- `goals`
- `shots`
- `ixg`
- `cf`
- `xgf`
- `hdcf`
- `rush_attempts`
- `rebounds_created`
- `sv_percentage`
- `gaa`
- `toi_per_gp`

## Migration And Replay Contract

The long-term schema sequence must stay separated:

1. raw-ingestion migration
2. normalized-event and shift migration
3. derived shot-feature migration
4. parity-output migration

Replay contract:

1. preserve immutable raw payload rows
2. rebuild normalized rows under a specific `parser_version` and `strength_version`
3. rebuild feature rows under a specific `feature_version`
4. rebuild parity rows under a specific `parity_version`

Do not skip layers during replay.

## Operational Guidance

- Raw re-fetch is not required for parser-only or feature-only revisions if raw payloads already exist.
- Feature experiments must not overwrite normalized event rows.
- Parity comparisons against NST must be run against explicit version tuples, not against unnamed “latest” logic.
- If a consumer needs row-level shots for modeling, read the feature layer.
- If a consumer needs published NST-era surfaces, read the parity layer.
- If a consumer needs parser debugging, read raw plus normalized together.

## Current Repo Ownership Map

- Raw ingest:
  - `web/lib/supabase/Upserts/nhlRawGamecenter.mjs`
- Normalized parsing and attribution:
  - `web/lib/supabase/Upserts/nhlPlayByPlayParser.ts`
  - `web/lib/supabase/Upserts/nhlStrengthState.ts`
  - `web/lib/supabase/Upserts/nhlShiftStints.ts`
  - `web/lib/supabase/Upserts/nhlOnIceAttribution.ts`
  - `web/lib/supabase/Upserts/nhlEventInclusion.ts`
- Derived features:
  - `web/lib/supabase/Upserts/nhlShotFeatureBuilder.ts`
  - helper modules listed above
- Published parity:
  - `web/lib/supabase/Upserts/nhlNstParityMetrics.ts`

Any future table or module should declare which layer it belongs to before it is added.
