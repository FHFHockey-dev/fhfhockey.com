# R4 catch-up: "Shift source fingerprint does not match projection inputs for game 2026020002"

Date: 2026-10-19. Code-only diagnosis. No hosted, API or cron calls. No repository files edited.

**Evidence:** `tasks/artifacts/release-r2-2026-10-19/ops/catchup-1-chef-20261019T1518Z.json`
- `2026020001` materialised: 38 rows written, 38 verified.
- `2026020002` threw, which stopped the run.

## Where the check lives and what it compares

- **The check:** `persistShiftChartRelationships` in `web/lib/projections/relationshipMaterialization.ts:270-277`. It compares two values:
  - **Stored side:** `projection_game_materialization_status.shift_source_hash`. `ingest-projection-inputs` wrote it when it captured the game. That route fetches the NHL shiftcharts, computes `buildProjectionShiftSourceHash(rows)`, and persists it via `persist_projection_game_inputs_v1`.
  - **Live side:** `sourceShiftHash`. `update-shift-charts` computes it from a **fresh NHL request made during this run**: `fetchShiftChartData` calls `fetchAllNhleShiftChartsForGame(gameId)` and hashes with the same `buildProjectionShiftSourceHash(allRows)` (`shift-charts.ts:613-628`).
- **What the hash covers:** `normalizeShiftSourceRows` (`projectionInputPersistence.ts:121`). For every row it takes player, team, team abbreviation, first and last name, shift number, period, start, end, duration and type code. It sorts the rows, so order does not matter.
- **Why 2026020002 failed:** the NHL shiftcharts content for that game changed between its ingest capture (around 09-30) and today's live fetch. This can be a shift correction, a name or accent fix, or rows added or removed.
- The PBP fingerprint check just before it (lines 263-269) passed. So only the shift feed drifted.

**Chef's guess, that the sweep caused this, does not fit the code.** The sweep is DB-only. It reads the stored snapshot heads and writes only the Gamecenter normalisation tables (`persist_nhl_api_gamecenter_normalized_v1`). It never writes `projection_game_materialization_status` or advances a snapshot head. The stored side of the comparison is unchanged since ingest; the live side moved.

A second guard sits behind this check. `persist_shift_chart_relationships_v1` also requires that the current `shiftcharts` and `play-by-play` snapshot heads equal the status's raw snapshot IDs and hashes. If any Gamecenter writer advanced the shiftcharts head after ingest, the game would next fail with `SHIFT_RELATIONSHIP_RAW_SNAPSHOT_STALE`. The recovery below fixes both cases.

## Recovery (smallest correct path: no code change)

**Re-run `ingest-projection-inputs` (R4 code) for the regular-season dates, then re-run `update-shift-charts`.** For each selected game, ingest does the following:
1. Re-fetches the live PBP and shiftcharts.
2. Captures them as raw snapshots, which advances the heads when the content changed.
3. Persists inputs with the new `shift_source_hash`.
   - When nothing changed, the receipt is idempotent: same fingerprint, so already-materialised games such as 2026020001 stay current.
   - When something changed, the input fingerprint changes, so the relationship queue picks the game up again.
4. Runs R4's `normalize_gamecenter` step, so the roster spots follow the new PBP hash.

**Bounds:**

| Item | Bound |
|---|---|
| Dates | `startDate=2026-09-29`, `endDate=2026-10-18` (regular season up to yesterday). Preseason is outside the queue now, so skip it. |
| Games | Every game in that range with a status row. R3's read found 87 regular-season games, so about 87–95. |
| Call shape | Explicit `startDate`/`endDate` with `maxGames=25` per call, `resumeFromGameId` from each response, and the default `maxDurationMs` (270 s). About 4 sequential calls, concurrency 1. An explicit range does not use or advance the scheduled durable cursor. |
| NHL requests (ingest) | Per game: 1 PBP plus 1 shiftcharts page (1,000 rows per page; a game is usually under 1,000 rows, occasionally 2 pages). About 90–180 requests. These are NHL api-web and stats calls, not NST, so the 21 s NST spacing does not apply. |
| NHL requests (shift-charts after) | Per game: 1 PBP plus 1–2 shiftcharts pages. About 90–180 more requests across 2 calls with `maxGames=50`. |
| Writes | Raw snapshots only for changed payloads; projection inputs; normalisation for changed games; then relationship rows. |
| Stop condition | Stop on any ingest error, or if shift-charts reports another fingerprint mismatch for a game ingested in the same session. That would mean live drift within minutes, which needs a code change. |

**Alternatives considered:**
- **Status refresh without ingest:** rejected. `shift_source_hash` is part of the input fingerprint, together with the strength rows and raw snapshot IDs. Rewriting it alone would break the input contract that `persist_projection_game_inputs_v1` enforces.
- **Ingest only the drifted games:** only possible if they can be identified first. A pure SQL read can find head drift (Q-2 below), but not upstream drift that was never captured. Telling those apart needs one NHL fetch per game, which is what ingest does anyway. Since unchanged games are idempotent, the full-range re-run costs little more.

## Code follow-up (proposal only, not implemented)

The catch-up showed a recurring failure class:
- `update-shift-charts` re-fetches live NHL data and compares it with an earlier capture.
- Any game corrected upstream between the ingest and the shift-charts run throws, and **stops the whole run**.
- In steady state ingest runs shortly before shift-charts, so drift is rare. In any catch-up over older games it is likely.

Smallest robust change, in `shift-charts.ts` only:
- On the `"Shift source fingerprint does not match"` and `"PBP source fingerprint does not match"` errors, record `{ gameId, reason: "projection_inputs_stale" }` in `skippedGames` and continue, instead of throwing. Nothing is written for that game, so the snapshot binding stays fail-closed.
- The skipped game stays pending and is picked up after the next ingest of its date.
- Trade-off: a stale game re-enters the queue each run until ingest refreshes it.

A larger option is to build relationships from the stored raw snapshots pinned by the status (`shift_raw_payload_id` and `pbp_raw_payload_id`) instead of live fetches. That removes the drift class and the NHL requests from shift-charts entirely, but it changes the route's data source and needs review.

Recommendation: do the recovery first. Implement the skip only if TJ wants catch-ups to tolerate drift.

## Read-only SELECTs for Chef

**Q-1.** Which regular-season games still need relationships, and whether their status still matches the current heads. A row with `pbp_head_matches` or `shift_head_matches` false has head drift: a Gamecenter writer captured newer content after ingest.

```sql
select s.game_id, g.date,
       s.relationship_status,
       s.relationship_input_fingerprint = s.input_fingerprint as rel_current,
       s.pbp_raw_payload_hash   = hp.payload_hash as pbp_head_matches,
       s.shift_raw_payload_hash = hs.payload_hash as shift_head_matches
from projection_game_materialization_status s
join games g on g.id = s.game_id
left join nhl_api_game_payload_snapshot_heads hp on hp.game_id = s.game_id and hp.endpoint = 'play-by-play'
left join nhl_api_game_payload_snapshot_heads hs on hs.game_id = s.game_id and hs.endpoint = 'shiftcharts'
where s.game_id between 2026020001 and 2026029999
  and s.input_status = 'complete'
order by g.date, s.game_id;
```

**Q-2.** Count summary of Q-1, to size the work:

```sql
select count(*) as games,
       count(*) filter (where s.relationship_status = 'complete' and s.relationship_input_fingerprint = s.input_fingerprint) as rel_current,
       count(*) filter (where s.shift_raw_payload_hash is distinct from hs.payload_hash) as shift_head_drift,
       count(*) filter (where s.pbp_raw_payload_hash is distinct from hp.payload_hash) as pbp_head_drift
from projection_game_materialization_status s
left join nhl_api_game_payload_snapshot_heads hp on hp.game_id = s.game_id and hp.endpoint = 'play-by-play'
left join nhl_api_game_payload_snapshot_heads hs on hs.game_id = s.game_id and hs.endpoint = 'shiftcharts'
where s.game_id between 2026020001 and 2026029999 and s.input_status = 'complete';
```

Neither query can see upstream drift that hasn't been captured yet; only a fetch shows it. 2026020002 will most likely show both heads matching, which would confirm upstream drift since ingest.

## Files

- Added: `tasks/artifacts/shift-charts-scope-2026-10-19/R4-SHIFT-FINGERPRINT.md` (this note).
- Code changes: none.
- Off-limits files touched: none (`ingest-projection-inputs.ts`, `update-PbP.ts`, and the a05/a07/a08/a19/a20 sessions' files).
