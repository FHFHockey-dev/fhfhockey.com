# Upstream Ambiguities

## Purpose

This document records NHL public API ambiguities, sparse fields, and missing semantics that require one of the following:

- approximation,
- fallback logic,
- versioned parser behavior,
- documented non-parity exceptions.

It is the canonical ambiguity register for phase 1 NHL API ingestion and NST parity work.

## Current Ambiguities

### 1. `goalieInNetId` is not universal on shot-like events

Observed evidence:

- `goal` carried `goalieInNetId` at `95.8%` in the March 30, 2026 sample
- `missed-shot` carried `goalieInNetId` at `97.4%` in the same sample

Impact:

- goalie identity cannot be treated as mandatory on every shot-like event
- empty-net detection cannot rely on `goalieInNetId == null`

Required handling:

- use `situationCode` as the canonical empty-net authority
- preserve nullable `goalieInNetId` when present
- only use `goalieInNetId` as enrichment, not as the state classifier

Parity risk:

- low for strength-state classification
- medium for goalie-attribution edge cases if downstream logic assumes the field is always populated

### 2. `shotType` is not universal across the full shot-attempt family

Observed evidence:

- `goal` carried `shotType` at `98.6%`
- `shot-on-goal` carried `shotType` at `100%`
- `missed-shot` carried `shotType` at `100%`
- `blocked-shot` did not expose `shotType` in the baseline sample

Impact:

- attempt-type features that depend on `shotType` will be incomplete for blocked attempts

Required handling:

- allow null `shot_type` on blocked attempts
- avoid backfilling invented shot types for blocked events
- document any derived model behavior that excludes blocked attempts from shot-type-dependent features

Parity risk:

- low for basic Corsi/Fenwick counts
- medium for shot-type-conditioned xG features if blocked attempts are included in feature tables

### 3. Score fields are not present on every event class

Observed evidence:

- `goal` includes `homeScore` and `awayScore`
- `shot-on-goal` includes `homeSOG` and `awaySOG`
- many non-goal event classes do not include cumulative score fields

Impact:

- exact score state at every event must be reconstructed from event order and goal events, not read directly from one universal field

Required handling:

- treat event sequence plus goal events as the score-progression authority
- do not assume every event row will carry explicit game score

Parity risk:

- low if score progression is replayed deterministically from normalized events

### 4. `eventOwnerTeamId` is not universal on non-attributed event classes

Observed evidence:

- strong coverage on offensive and player-attributed event classes in the baseline sample
- stoppages and period-boundary events do not consistently carry the same ownership semantics

Impact:

- event ownership cannot be used as a universal attribute across all event classes
- strength labeling for non-owned events may require nullable owner-relative fields

Required handling:

- keep `event_owner_team_id` nullable
- do not force owner-relative logic for event types that do not expose ownership

Parity risk:

- low for shot and player-event metrics
- low to medium for generalized event classification if parser assumes every row has an owner

### 5. `servedByPlayerId` on penalties is sparse

Observed evidence:

- `servedByPlayerId` appeared on only `11%` of sampled penalties

Impact:

- served-by semantics are not reliable enough to drive core penalty metrics on their own

Required handling:

- preserve `servedByPlayerId` when present
- keep committed-by and drawn-by fields primary for penalty attribution
- treat served-by as optional enrichment for bench or special penalty cases

Parity risk:

- low for standard penalty counts
- medium for specialized penalty-served attribution if exact NST behavior depended on that nuance

### 6. `boxscore` roster shape is not the same as `play-by-play.rosterSpots`

Observed evidence:

- sampled `play-by-play` payloads exposed directly useful `rosterSpots`
- sampled `boxscore` payloads did not expose the expected roster sections in the same usable shape

Impact:

- roster normalization cannot assume `boxscore` is the authoritative phase 1 roster source

Required handling:

- normalize roster rows from `play-by-play.rosterSpots`
- store raw `boxscore` for audit and future enrichment only

Parity risk:

- low for phase 1 if `rosterSpots` remains present
- medium if upstream endpoint behavior changes and parser assumptions are not revisited

### 7. Empty-net semantics require derived logic, not a single raw flag

Observed evidence:

- zero-goalie `situationCode` examples such as `0651` and `1560`
- recon helper also found cases where practical empty-net interpretation aligned with zero-goalie digits plus missing goalie fields

Impact:

- empty-net classification is derived from decoded manpower state, not from one guaranteed explicit event flag

Required handling:

- canonical rule: any zero goalie digit in `situationCode` -> `EN`
- do not use nullable `emptyNet` booleans as the authoritative classifier

Parity risk:

- low if `situationCode` remains stable

### 8. Penalty-shot handling was unresolved during recon and is now versioned conservatively

Observed evidence:

- no final phase 1 penalty-shot rule has been locked
- current docs already state penalty-shot handling must be explicitly versioned

Impact:

- penalty shots still require a dedicated future methodology if they are ever to participate in xG or parity surfaces

Current handling:

- preserve penalty-shot rows in normalized storage
- exclude them from phase 1 parity, on-ice parity, and general shot-feature eligibility
- detect them explicitly from normalized text fields and raw-event detail fields

Parity risk:

- low for phase 1 parity because the exclusion is now explicit and versioned

### 9. Chance buckets and xG-style values are inherently approximation territory

Observed evidence:

- `SCF`, `HDCF`, `MDCF`, `LDCF`, `ixG`, `xGF`, and `xGA` in the parity map are already marked as close approximations pending finalized rules

Impact:

- these metric families cannot be claimed as exact parity until danger-bucket and shot-value rules are fully versioned

Required handling:

- version danger geometry, rush/rebound logic, flurry logic, and shot-value methodology separately
- record intentional divergences from legacy NST behavior

Parity risk:

- high relative to pure event-count metrics

### 10. On-ice attribution is impossible from play-by-play alone

Observed evidence:

- `eventOwnerTeamId` exists on many events but does not identify all players on the ice
- shift rows are required for actual on-ice attribution

Impact:

- any on-ice counts, rates, zone starts, and player deployment metrics require `shiftcharts`

Required handling:

- treat `shiftcharts` as mandatory for on-ice parity
- do not ship on-ice parity surfaces from PbP-only logic

Parity risk:

- high if shift ingestion is incomplete or stale

## Current Non-Parity Exceptions

These are not yet blockers for raw ingest, but they are blockers for exact parity claims:

- penalty-shot treatment until explicitly versioned
- exact danger-bucket methodology until finalized
- exact xG value methodology until finalized
- any metric whose legacy NST behavior depended on hidden or proprietary classification rules

## Change Management

- If a new upstream ambiguity is discovered, add it here before changing parser behavior.
- If an ambiguity is resolved by stronger upstream evidence, do not delete the entry; mark the old ambiguity as superseded and note the version that changed behavior.
- Any ambiguity that can change published outputs must trigger the relevant parser, strength, feature, or parity version bump.
