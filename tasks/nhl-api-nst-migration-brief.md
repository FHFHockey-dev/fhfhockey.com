# NHL API to NST Migration Brief

## Goal

Replace NST-scraped skater metrics with NHL public API ingestion that is auditable, idempotent, and scalable enough to support:

1. Exact NST metric parity for current product surfaces.
2. Strength-aware player/team aggregations.
3. Future xG model training from normalized play-by-play plus shift-based on-ice attribution.

## Evidence Collected

- PbP reconnaissance report: `tasks/artifacts/nhl-pbp-recon-2026-03-30.md`
- PbP reconnaissance JSON: `tasks/artifacts/nhl-pbp-recon-2026-03-30.json`
- Existing legacy PbP flattening: `web/lib/supabase/Upserts/fetchPbP.ts`
- Existing legacy shift totals: `web/pages/api/v1/db/shift-charts.ts`
- Current projection ingest PbP: `web/lib/projections/ingest/pbp.ts`
- Current projection ingest shifts: `web/lib/projections/ingest/shifts.ts`

## Event Dictionary

Observed event types across the sampled games:

- `502 faceoff`
- `503 hit`
- `504 giveaway`
- `505 goal`
- `506 shot-on-goal`
- `507 missed-shot`
- `508 blocked-shot`
- `509 penalty`
- `516 stoppage`
- `520 period-start`
- `521 period-end`
- `523 shootout-complete`
- `524 game-end`
- `525 takeaway`
- `535 delayed-penalty`

Key `details` observations from the sampled set:

- Shot-like events consistently carry `eventOwnerTeamId`, location (`xCoord`, `yCoord`, `zoneCode`), and shooter/goalie identifiers when a goalie is in net.
- `goal` adds scorer, assists, score state, clip metadata, and usually `goalieInNetId`.
- `penalty` adds `descKey`, `typeCode`, `duration`, `committedByPlayerId`, `drawnByPlayerId`, and occasionally `servedByPlayerId`.
- `stoppage` is lightweight and mainly uses `reason` plus optional `secondaryReason`.
- Period boundary and game-end events have no `details`.

The full per-type key coverage with presence percentages and example values lives in `tasks/artifacts/nhl-pbp-recon-2026-03-30.md`.

## Situation Code Mapping

Empirical mapping is consistent with:

- `situationCode = awayGoalie, awaySkaters, homeSkaters, homeGoalie`

Validated examples:

- `1331` during OT 3-on-3 in `2025021172` (`DAL @ PHI`) means both goalies in, 3v3.
- `0651` in `2025021171` (`CHI @ NJD`) means away goalie pulled, away 6 skaters, home 5 skaters, home goalie in.
- `1560` in `2025021103` (`PHI @ SJS`) means away 5 skaters with goalie in, home 6 skaters with goalie pulled.

Canonical strength recommendation:

- Store exact counts as `strength_exact`, using away-vs-home format like `5v5`, `5v4`, `6v5`, `3v3`.
- Store event-relative strength state as `strength_state`:
  - `EV` when skater counts match and both goalies are in.
  - `PP` when `eventOwnerTeamId` has more skaters than the opponent.
  - `SH` when `eventOwnerTeamId` has fewer skaters than the opponent.
  - `EN` whenever either goalie digit is `0`.

## Required NHL Endpoints

- `gamecenter/{id}/play-by-play`
  - Raw event stream.
  - Already includes `rosterSpots`, which is enough for a game roster dimension.
- `gamecenter/{id}/boxscore`
  - Still worth storing raw for audit and goalie/game stat context, even though current roster shape is less useful than `play-by-play`.
- `gamecenter/{id}/landing`
  - Summary context, stars, penalty summary, score, SOG, broadcast metadata.
- `stats/rest/en/shiftcharts?cayenneExp=gameId={id}`
  - Required for on-ice attribution, deployment, zone usage, and any metric that depends on actual shifts rather than event ownership alone.

## Existing Repo Findings

Current ingest/storage conventions:

- Upserts use natural keys and explicit `onConflict` strings.
- Existing PbP storage is a flattened legacy schema:
  - `pbp_games`
  - `pbp_plays`
- Existing shift storage is aggregated-per-player-per-game:
  - `shift_charts`
- Current NST gamelog strength splits already in the database:
  - all situations: `nst_gamelog_as_*`
  - even strength: `nst_gamelog_es_*`
  - power play: `nst_gamelog_pp_*`
  - penalty kill: `nst_gamelog_pk_*`
  - each split has counts, rates, on-ice counts, and on-ice rates variants where applicable

Important limitation in the old shape:

- `pbp_plays` is too flattened for long-term auditability and future feature engineering.
- `shift_charts` stores player-game aggregates and JSON blobs, not the raw shift rows needed for robust stint reconstruction and prior-event windows.

## Schema Decision

Chosen option: raw payload snapshots plus normalized relational tables.

Why:

- Raw JSON must be preserved for audit, replay, parser evolution, and future bug investigation.
- One row per event is the correct analytic grain for xG features, prior-event windows, rebound/rush tagging, and exact exclusions.
- One row per shift is the correct attribution grain for on-ice joins, zone starts, deployment, and PP elapsed-time features.
- JSONB arrays are acceptable only for immutable raw payload snapshots, not for the primary analytic grain.

Implemented schema slice:

- `nhl_api_game_payloads_raw`
  - Immutable raw snapshots keyed by `(game_id, endpoint, payload_hash)`.
- `nhl_api_game_roster_spots`
  - Normalized roster rows from `play-by-play.rosterSpots`.
- `nhl_api_pbp_events`
  - One row per event with typed columns plus full `details` JSONB.
- `nhl_api_shift_rows`
  - One row per shift record from the stats shiftcharts feed.
- `nhl_api_pbp_shot_events_v1`
  - Convenience view for shot-like events.

Migration file:

- `migrations/20260330_create_nhl_api_raw_ingestion_tables.sql`

## Initial Ingestion Implementation

Implemented scripts:

- `web/scripts/recon-nhl-pbp.mjs`
  - Pulls recent game IDs from Supabase, samples diverse games, and logs an event dictionary plus `situationCode` evidence.
- `web/scripts/ingest-nhl-api-raw.mjs`
  - Fetches `play-by-play`, `boxscore`, `landing`, and `shiftcharts` for supplied game IDs.
  - Stores immutable raw payload snapshots.
  - Upserts normalized roster rows, event rows, and raw shift rows.

Example usage:

```bash
node web/scripts/ingest-nhl-api-raw.mjs 2025021103 2025021171
```

## NST Parity Checklist

Individual counts:

- Goals, assists, points, shots, ixG, iCF, iFF, iSCF, iHDCF.
- Rebounds created.
- Rush attempts.
- PIM and penalty breakdown.
- Penalties drawn.
- Giveaways, takeaways, hits, hits taken, shots blocked.
- Faceoffs won/lost and faceoff percentage.

On-ice counts:

- CF, CA, FF, FA, SF, SA, GF, GA, xGF, xGA.
- SCF, SCA, HDCF, HDCA.
- HDGF, HDGA, MDCF, MDCA, MDGF, MDGA.
- LDCF, LDCA, LDGF, LDGA.
- On-ice SH%, SV%, PDO.
- Offensive/neutral/defensive zone starts.
- Offensive/neutral/defensive zone faceoffs.
- On-the-fly starts.

Rates:

- Every count family above must also exist in the relevant per-60 surfaces.
- `TOI/GP` and raw TOI must remain available.

Strength splits required:

- All situations.
- Even strength.
- Power play.
- Penalty kill.

Implementation rules for parity:

- Exclude shootout events from NST-style skater metrics.
- Treat empty-net state separately from true goalie-in-net EV/PP/SH.
- Reconstruct on-ice state from raw shift rows, not from `eventOwnerTeamId`.
- Zone starts and faceoff-zone metrics should be shift/on-ice driven, not scorekeeper-event-owner driven.
- Keep exclusions and classification logic versioned because xG and NST parity may diverge later by design.

## Open Questions Needed Before Final PRD

1. Should the first parity target be only the skater gamelog tables, or also goalie NST parity in the same phase?
2. Should exact NST parity win over “more correct” NHL-event-derived logic if the two disagree on edge cases?
3. Do you want the first production pipeline to backfill all historical seasons immediately, or land on the current season first and then backfill?
4. Should the normalized event model include derived shot classifications now (rush/rebound/slot danger buckets), or should those remain a second-pass derived layer on top of raw events and shifts?
