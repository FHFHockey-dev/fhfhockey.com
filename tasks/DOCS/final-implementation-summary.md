# Final Implementation Summary

## Purpose

This document summarizes the current state of the NHL API ingestion, normalization, feature, and parity foundation at the end of the phase-1 implementation pass.

It answers four questions:

1. what is complete
2. what is implemented but intentionally approximate
3. what is intentionally deferred
4. what still blocks release for training or production rollout

## Complete

### Raw Ingestion Foundation

Complete:

- immutable raw payload archival for:
  - `play-by-play`
  - `boxscore`
  - `landing`
  - `shiftcharts`
- content-hash-based raw dedupe and append-only archival behavior
- reusable raw-ingest library and API routes for:
  - single-game ingest
  - date-range ingest
  - current-season-first backfill mode
- retry and backoff handling for transient upstream fetch failures
- Supabase schema and generated types for raw payloads, roster spots, normalized events, and raw shifts

### Normalized Event And Shift Layer

Complete:

- normalized roster extraction from `play-by-play.rosterSpots`
- one-row-per-event `nhl_api_pbp_events`
- one-row-per-shift `nhl_api_shift_rows`
- deterministic event ordering via `sortOrder`
- typed parsing for:
  - participants
  - coordinates
  - shot type
  - penalty reason
  - score progression inputs
  - owner-relative strength context
- canonical `situationCode` decoding and exact/canonical strength labeling
- normalized inclusion and exclusion rules for:
  - shootouts
  - penalty shots
  - delayed-penalty contexts
  - empty-net states
  - overtime
  - rare manpower states
- shift normalization, stint reconstruction, and event-time on-ice attribution

### Derived Feature Layer

Complete:

- attacking-direction coordinate normalization helpers
- prior-event context
- rebound classification
- rush classification
- flurry sequence grouping
- miss-reason bucketing
- contextual features for:
  - power-play age
  - fatigue proxies
  - east-west and net-direction movement proxies
- versioned shot-feature builder kept separate from parity outputs

### NST-Parity Foundation

Complete:

- skater parity surfaces for:
  - `all`
  - `EV`
  - `PP`
  - `PK`
- goalie parity surfaces for:
  - `all`
  - `EV`
  - `5v5`
  - `PP`
  - `PK`
- count and rate families
- skater on-ice count and rate families
- split-aware TOI reconstruction from shifts plus strength segments
- parity validation helpers against representative NST-era samples

### Documentation And Audit Contract

Complete:

- PRD
- definitions and parity policy
- event dictionary
- strength mapping
- metric parity map
- schema recommendation
- legacy ingest conventions
- ambiguity register
- boundary contract
- validation checklist
- manual audit requirements
- idempotent backfill behavior
- failure handling policy
- manual audit artifact for representative games

## Implemented But Intentionally Approximate

These areas are shipped as versioned phase-1 methodology, not claimed as exact NST equivalence.

### Chance And xG-Style Families

Approximate:

- `ixG`
- `xGF`
- `xGA`
- scoring-chance families
- danger-bucket families:
  - `SCF`
  - `SCA`
  - `HDCF`
  - `HDCA`
  - `MDCF`
  - `MDCA`
  - `LDCF`
  - `LDCA`

Why:

- public-data danger geometry and shot-value methodology are versioned approximations, not validated tracking-grade truth

### Rush, Rebound, And Flurry Families

Approximate:

- rush attempts
- rebounds created
- rebound shots
- flurry-aware sequence accounting

Why:

- they depend on public-event sequencing assumptions rather than direct tracking or official NHL labels

### Contextual Model Inputs

Approximate:

- fatigue proxies
- PP age segments
- east-west movement proxies
- royal-road proxy logic

Why:

- public play-by-play and shift rows do not expose full puck trajectory, passing chain, or true movement tracking

### Some Goalie Attribution Edge Cases

Approximate or enrichment-limited:

- goalie-linked shot context when `goalieInNetId` is sparse or absent
- any feature logic that would require universal goalie identity on all shot-like events

## Intentionally Deferred

Not part of the current release-ready foundation:

- training, fitting, calibrating, or benchmarking the final xG model
- coefficient fitting or model selection
- calibration studies
- benchmark comparisons against external xG providers
- production migration of every downstream reader to NHL-derived parity outputs
- finalized derived-table migrations for:
  - shot-feature storage
  - parity-output storage
- full stale-row cleanup semantics for all replay/backfill modes when upstream emits fewer rows than a prior run
- any future methodology that excludes specific miss subtypes from xG
- any tracking-grade enhancements that require data beyond NHL public APIs

## Current Release Blockers

The project is not approved yet for xG training use or production rollout until all of the following are satisfied.

### Validation Blockers

Still required as a formal release package:

- a recorded validation run using `tasks/validation-checklist.md`
- passing raw-vs-normalized validation on the intended release sample
- passing parity validation on the intended release sample
- documented approved exceptions for any expected approximation drift

### Publication Blockers

Still required before switching production readers:

- final published parity storage surface or migration plan for production readers
- explicit downstream cutover decision for which readers move first
- confirmation that legacy NST-derived readers stay frozen until the new surfaces are approved

### Replay And Backfill Hardening

Still required before authoritative large backfills:

- full replace semantics for stale normalized, feature, and parity rows when reprocessing a game with fewer upstream rows than a prior run
- explicit per-game partial-failure reporting as part of the route and audit contract

### Outstanding Follow-Up Decisions

Still unresolved in the tracked task list:

- whether to keep `pbp_plays` frozen as a partial comparison baseline or broaden overlap coverage
- whether `shift_charts` remains a validation baseline as-is or gets repaired/backfilled

## Release Status

Current status:

- ingestion foundation: complete
- normalized event and shift foundation: complete
- derived feature foundation: complete
- parity foundation: complete with documented approximation boundaries
- training readiness: blocked pending release validation package
- production rollout readiness: blocked pending release validation package and downstream cutover decisions

## Recommended Next Step

The next correct move is to complete the phase-1 release package:

- finalize the implementation summary and follow-up list
- run and record the formal validation batch
- resolve remaining release blockers
- only then approve training-dataset publication or production-reader cutover

Once the release package is approved, execute the post-foundation queue in `tasks/post-foundation-follow-ups.md`.
