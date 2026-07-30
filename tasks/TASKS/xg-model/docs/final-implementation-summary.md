# Final Implementation Summary

## Purpose

This document summarizes the current state of the NHL API ingestion, normalization, feature, and parity foundation at the end of the phase-1 implementation pass.

**Current audit overlay (2026-07-29):** The later exception-aware v2 release package satisfies training use for parser/strength/feature/parity version 1 with zero blocking mismatches and 1,021 visible approved-exception mismatches. Production-reader cutover and authoritative parity publication remain separate. The authenticated raw-ingest owner now enforces a 25-game request ceiling, rejects implicit date-range truncation, continues bounded multi-game work after game-local failures, and returns value-free structured HTTP 500 partial-failure receipts. The transactional normalization migration/deployment and broad-history gates remain separately open.

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

## Historical Phase-1 Release Blockers

The items below describe the pre-release state captured by this phase-1 report. The later exception-aware v2 package resolved the training-use validation items for the recorded version-1 tuple; production publication/cutover and broader rollout remain separately governed.

The project is not approved yet for xG training use or production rollout until all of the following are satisfied.

### Validation Blockers

Still required as a formal release package:

- a recorded validation run using `tasks/TASKS/xg-model/nhl-api-foundation/validation-checklist.md`
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
- training readiness: approved for the recorded parser/strength/feature/parity version-1 tuple
- production rollout readiness: separately gated on authoritative publication, downstream cutover, transactional-normalization deployment, and bounded history

## Recommended Next Step

The phase-1 training release package is complete. Continue only the explicitly governed post-foundation queue in `tasks/TASKS/xg-model/nhl-api-foundation/post-foundation-follow-ups.md`; do not infer production-reader cutover, authoritative parity publication, migration deployment, or broad historical rollout from the training-use verdict.
