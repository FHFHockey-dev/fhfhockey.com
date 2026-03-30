# PRD: NHL API xG Model Data Foundation

## 1. Introduction / Overview

This project replaces the repo's NST-scraped game-level skater and goalie metrics with an NHL public API ingestion and derivation pipeline. The new system must preserve the current product's useful strength-split metrics, prefer NHL-derived correctness when it conflicts with NST edge-case behavior, and create a scalable data foundation for later xG model training from normalized play-by-play and shift data.

The immediate goal is not to train a model yet. The immediate goal is to build an auditable, replayable ingestion and derivation layer that:

- stores immutable raw NHL payloads,
- normalizes play-by-play and shift-chart data into analytic tables,
- reproduces current NST-era metrics for skaters and goalies,
- supports phase 1 derived classifications for rush, rebound, flurry, and danger buckets,
- prioritizes current-season production use while allowing immediate historical backfill through a query parameter.

## 2. Goals

- Replace NST-scraped skater and goalie metric dependencies with NHL public API-derived data.
- Preserve or improve existing product metrics across all-situations, even-strength, power-play, and penalty-kill splits.
- Store raw upstream payloads so parsing and derivation logic can be replayed and audited later.
- Normalize one row per event and one row per shift so future xG features, prior-event windows, and on-ice attribution are queryable.
- Treat rush, rebound, flurry, and danger-bucket classifications as phase 1 deliverables.
- Prioritize current-season production readiness first, while supporting immediate historical backfill via a query parameter.
- Version parser, feature, parity, and model logic so intentional behavior changes can be traced over time.

## 3. User Stories

- As a developer, I want immutable raw NHL payload snapshots so I can debug parser changes and replay ingest without re-scraping NST.
- As a developer, I want normalized event and shift tables so I can compute strength-aware player, goalie, team, line, and pairing metrics from first principles.
- As a product owner, I want current-season skater and goalie metrics to keep working without NST scraping dependencies.
- As an analyst, I want rush, rebound, flurry, and danger-bucket classifications available in phase 1 so I can validate expected-goals-oriented features early.
- As a data engineer, I want one route and one ingest contract that can run current-season updates by default and historical backfills on demand.
- As a future model builder, I want normalized event and shift data with versioned derived features so xG training can begin without redesigning the data model.

## 4. Functional Requirements

1. The system must ingest NHL public API data from `play-by-play`, `landing`, `boxscore`, and `shiftcharts` endpoints for a target game or batch of games.
2. The system must store immutable raw payload snapshots with endpoint metadata, fetch timestamps, and content hashes to support replay and auditability.
3. The system must normalize `play-by-play` payloads into one event row per event, preserving both typed columns and raw `details` JSON.
4. The system must normalize `shiftcharts` payloads into one shift row per shift record rather than storing only per-player aggregates.
5. The system must normalize `play-by-play.rosterSpots` into a reusable game-roster table.
6. The system must decode `situationCode` using the empirically validated order `awayGoalie, awaySkaters, homeSkaters, homeGoalie`.
7. The system must store both exact manpower labels such as `5v5`, `5v4`, `6v5`, and `3v3` and canonical strength states such as `EV`, `PP`, `SH`, and `EN`.
8. The system must treat NHL-derived correctness as the source of truth when it conflicts with NST edge-case behavior, and any intentional divergence must be documented and versioned.
9. The system must reconstruct skater and goalie metric families currently relied on from NST-era tables, including all-situations, even-strength, power-play, and penalty-kill splits.
10. The system must support individual counts, on-ice counts, rates, on-ice rates, zone starts, zone faceoffs, and related strength-aware outputs where they are currently part of the repo’s NST contract.
11. The system must exclude shootout events from NST-style skater and goalie parity metrics.
12. The system must treat empty-net states separately from true goalie-in-net EV, PP, and SH states.
13. The system must derive on-ice attribution from raw shift rows rather than inferring on-ice state only from event ownership.
14. The system must support phase 1 derived classifications for rush, rebound, flurry, and danger buckets.
15. The system must support normalized attacking-direction coordinates for downstream distance and angle calculations.
16. The system must support prior-event context features such as previous event type, previous event team, time since prior event, and distance from prior event.
17. The system must support query-parameter-driven historical backfill while defaulting operational flows to current-season updates.
18. The system must be idempotent for replaying the same game ingest multiple times without creating duplicate logical records.
19. The system must expose reusable library modules for raw ingest, event parsing, strength decoding, shift stint reconstruction, derived feature generation, parity generation, and validation.
20. The system must include route- or job-level entry points that fit existing repo audit and auth patterns for one game, a date range, and backfill mode.
21. The system must validate normalized event totals against raw payload totals for every ingested game.
22. The system must validate parity outputs against representative existing NST-era outputs for sampled games, teams, players, and goalies.
23. The system must version parser logic, feature logic, and parity logic so future behavior changes are replayable and attributable.
24. The system must keep model-input tables separate from parity-output tables and separate both from raw upstream storage.

## 5. Non-Goals (Out of Scope)

- Training, fitting, calibrating, or benchmarking the final xG model in this phase.
- Silently reproducing NST behavior when it conflicts with better NHL-derived logic.
- Replacing every downstream product surface in one step without validation gates.
- Using a per-game JSON blob as the primary long-term analytic store for events or shifts.
- Deferring rush, rebound, flurry, or danger-bucket work to a later phase.

## 6. Design Considerations

- The living event dictionary, strength mapping, parity map, and validation checklist should be maintained alongside implementation.
- Raw payload storage, normalized event/shift storage, and derived output storage should remain separated by design.
- The architecture should support backfills, replay, and future model versions without destructive redesign.

## 7. Technical Considerations

- Existing legacy tables such as `pbp_games`, `pbp_plays`, and `shift_charts` should be treated as compatibility surfaces during migration, not the target long-term model.
- Current schema work is anchored by `migrations/20260330_create_nhl_api_raw_ingestion_tables.sql`.
- Current reconnaissance evidence is captured in `tasks/artifacts/nhl-pbp-recon-2026-03-30.md` and `tasks/artifacts/nhl-pbp-recon-2026-03-30.json`.
- `play-by-play` currently provides a more useful roster shape through `rosterSpots` than `boxscore` does for the sampled games, but both raw payloads should still be stored.
- Query performance must support filtering by season, game, event sequence, team, player, strength, and event type.
- Validation and parity logic are release blockers for current-season production adoption.

## 8. Success Metrics

- Current-season skater and goalie ingest runs successfully from NHL public APIs without relying on NST scraping.
- Raw payloads, normalized events, and raw shifts can be replayed idempotently for the same game.
- Representative current-season parity checks pass for required skater and goalie metric families across all-situations, EV, PP, and PK splits.
- Rush, rebound, flurry, and danger-bucket classifications are available in phase 1 derived outputs.
- Historical backfill can be triggered through a query parameter without redesigning the ingest flow.
- The system is documented well enough that a junior developer can understand the ingest layers, strength mapping, and parity rules without re-running the original reconnaissance.

## 9. Open Questions

- Which downstream product surfaces should be migrated first once the new parity outputs are validated?
- Which legacy tables should dual-write temporarily versus remain read-only during migration?
- Which goalie-specific parity outputs should be considered mandatory for release versus follow-up enhancements if public data gaps appear?
