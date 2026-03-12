## pass-2 post-fix freshness rerun

Sub-task: `1.4`

Date:

- `2026-03-12`

## Goal

Re-run the March 12 validation-player recompute and freshness checks after the `rolling_player_game_metrics` write-path fix, then update the audit evidence so remaining blockers reflect real source-tail state rather than the old upsert transport failure.

## Validation players rerun

Players rerun through the repaired rolling writer:

- Brent Burns (`8470613`)
- Corey Perry (`8470621`)
- Jesper Bratt (`8479407`)
- Seth Jones (`8477495`)

Execution method:

- direct `ts-node` invocation of the real `main(...)` recompute path in [fetchRollingPlayerAverages.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts)
- no local Next.js server dependency

## Recompute results

All four targeted recomputes completed successfully:

```json
{
  "results": [
    {
      "label": "Brent Burns",
      "playerId": 8470613,
      "season": 20252026,
      "ok": true,
      "durationMs": 9585
    },
    {
      "label": "Corey Perry",
      "playerId": 8470621,
      "season": 20252026,
      "ok": true,
      "durationMs": 7138
    },
    {
      "label": "Jesper Bratt",
      "playerId": 8479407,
      "season": 20252026,
      "ok": true,
      "durationMs": 8147
    },
    {
      "label": "Seth Jones",
      "playerId": 8477495,
      "season": 20252026,
      "ok": true,
      "durationMs": 6093
    }
  ]
}
```

Observed row writes:

- Brent Burns:
  - rows written: `244`
  - freshness blockers during run summary: `0`
- Corey Perry:
  - rows written: `204`
  - freshness blockers during run summary: `1`
- Jesper Bratt:
  - rows written: `248`
  - freshness blockers during run summary: `0`
- Seth Jones:
  - rows written: `160`
  - freshness blockers during run summary: `1`

Important correction versus the earlier March 12 execution artifact:

- the repaired write path is now working for all four validation players
- Corey Perry and Seth Jones are no longer blocked by target writes
- their remaining blocker is source freshness in PK only

## Freshness snapshot after rerun

Source:

- `npm run check:rolling-player-validation-freshness`

Generated at:

- `2026-03-12T20:03:15.118Z`

### Brent Burns

- latest WGO date: `2026-03-10`
- latest rolling date: `2026-03-10`
- target freshness: `ok`
- overall status: `READY`
- all strengths:
  - `countsTailLag = 0`
  - `ratesTailLag = 0`
  - `countsOiTailLag = 0`
  - `ppTailLag = 0`
  - `lineTailLag = 0`

### Corey Perry

- latest WGO date: `2026-03-10`
- latest rolling date: `2026-03-10`
- target freshness: `ok`
- overall status: `BLOCKED`
- `all`, `ev`, and `pp`:
  - fully current
- `pk`:
  - `countsTailLag = 1`
  - `ratesTailLag = 1`
  - `countsOiTailLag = 1`
  - latest PK source dates remain `2026-03-08`

### Jesper Bratt

- latest WGO date: `2026-03-08`
- latest rolling date: `2026-03-08`
- target freshness: `ok`
- overall status: `READY`
- all strengths:
  - `countsTailLag = 0`
  - `ratesTailLag = 0`
  - `countsOiTailLag = 0`
  - `ppTailLag = 0`
  - `lineTailLag = 0`

### Seth Jones

- latest WGO date: `2026-01-02`
- latest rolling date: `2026-01-02`
- target freshness: `ok`
- overall status: `BLOCKED`
- `all`, `ev`, and `pp`:
  - fully current for his retained validation slice
- `pk`:
  - `countsTailLag = 1`
  - `ratesTailLag = 1`
  - `countsOiTailLag = 1`
  - latest PK source dates remain `2025-12-30`

## Updated interpretation

Post-fix freshness evidence now supports these conclusions:

- Brent Burns remains a fully ready healthy-control validation case.
- Jesper Bratt remains a fully ready heavy-PP validation case.
- Corey Perry is now writable and target-fresh; his remaining blocker is genuine PK source-tail staleness after March 8, 2026.
- Seth Jones is now writable and target-fresh; his remaining blocker is genuine PK source-tail staleness after December 30, 2025 for the retained validation slice ending January 2, 2026.

## Result

Status:

- `PASS`

What this sub-task established:

- the repaired write path holds across all retained March 12 validation players
- the audit no longer needs to treat Perry or Jones as target-write-blocked
- the only remaining blocked comparisons in this validation set are true PK source-tail blockers
- `1.5` can focus on regression coverage for the repaired writer rather than additional live-blocker triage
