## pass-2 rolling upsert repro

Sub-task: `1.1`

Date:

- `2026-03-12`

## Goal

Reproduce the targeted `rolling_player_game_metrics` upsert failure on a deterministic slice and capture:

- the exact error payload currently returned by the write path
- the derived row shape being sent to the failing upsert

## Deterministic repro slice

- player: `Brent Burns`
- `playerId`: `8470613`
- season: `20252026`
- options:
  - `skipDiagnostics: true`
  - standard upsert path
  - no local app server dependency

Reason for choosing this slice:

- it is the same ready validation player used during pass 2
- March 12 audit evidence already showed this targeted recompute failing in the upsert phase
- the slice is small enough to rerun directly and stable enough for repeat debugging

## Repro method

Because `localhost:3000` was not running during this task, the failure was reproduced by calling the rolling pipeline directly with `ts-node`, loading `web/.env.local`, and executing the real `main(...)` path from:

- [fetchRollingPlayerAverages.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts)

Temporary repro scripts used:

- `/tmp/rolling-player-pass2-upsert-repro.ts`
- `/tmp/rolling-player-pass2-row-shape.ts`

## Observed pipeline behavior

The direct recompute completed:

- bootstrap
- all-strength fetch / merge / derive
- EV fetch / merge / derive
- PP fetch / merge / derive
- PK fetch / merge / derive

It failed only once the write phase began:

- upsert rows prepared: `244`
- total batches: `1`
- batch size: `500`
- rows written before failure: `0`

Retry behavior:

- attempt `1/5`: `Bad Request`
- attempt `2/5`: `Bad Request`
- attempt `3/5`: `Bad Request`
- attempt `4/5`: `Bad Request`
- attempt `5/5`: `Bad Request`

Slow-log behavior:

- slow operation warning after `15s`
- final failed upsert duration: `28s`

## Exact captured error payload

Raw error object captured from the direct `main(...)` call:

```json
{
  "ok": false,
  "name": null,
  "message": "Bad Request",
  "details": null,
  "hint": null,
  "code": null,
  "status": null,
  "statusCode": null,
  "ownKeys": [
    "message"
  ],
  "stringified": "{\"message\":\"Bad Request\"}"
}
```

Current conclusion:

- the current write path is not surfacing a richer Supabase payload
- the only available error payload at this stage is the collapsed `message: "Bad Request"` object
- sub-task `1.2` needs targeted logging or dry-run output to expose the real failing column set

## Captured row-shape summary

Recomputed row output for the same slice:

- total derived rows: `244`
- first row key count: `941`

First row identity:

```json
{
  "player_id": 8470613,
  "game_id": 2025020003,
  "game_date": "2025-10-07",
  "season": 20252026,
  "strength_state": "all"
}
```

First row sample:

```json
{
  "gp_semantic_type": "availability",
  "pp_unit": 2,
  "line_combo_slot": 2,
  "line_combo_group": "defense",
  "goals_total_last20": 0,
  "toi_seconds_total_last20": 1210,
  "ixg_per_60_last20": 0.208264,
  "pp_share_pct_last20": 0.226
}
```

Important row-shape observations:

- the row count matches the expected `61` games across `4` strength states
- the first derived row contains `941` keys, which is effectively the full current storage contract minus one field that is likely database-managed
- the failure occurs before any row in this batch is written, so the current repro does not isolate one specific row as malformed
- the most useful next step is exposing batch-level or row-level payload validation details before the actual upsert call

## Result

Status:

- `PASS`

What this sub-task established:

- the `Bad Request` upsert failure is reproducible today on a deterministic targeted slice
- the current error payload is too collapsed to diagnose root cause directly
- the current write batch is a `244`-row payload with near-full row width
- `1.2` should focus on dry-run payload inspection, batch narrowing, and richer Supabase error logging
