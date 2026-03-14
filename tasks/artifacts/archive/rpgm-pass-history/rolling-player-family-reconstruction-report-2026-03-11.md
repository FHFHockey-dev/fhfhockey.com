# Rolling Player Family Reconstruction Report

Date: March 11, 2026

Command used:

```bash
npm run check:rolling-player-family-reconstruction
```

Script:
- [check-rolling-player-family-reconstruction.ts](/Users/tim/Code/fhfhockey.com/web/scripts/check-rolling-player-family-reconstruction.ts)

Recompute path used:
- [recomputePlayerRowsForValidation(...)](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts)

## Scope

This pass compared recomputed rolling outputs against stored `rolling_player_game_metrics` rows for the players that were `READY` after the freshness workflow:

- Brent Burns (`8470613`, season `20252026`)
- Jesper Bratt (`8479407`, season `20252026`)

Blocked from this pass due freshness state:

- Corey Perry (`8470621`)
  - PK source tail still blocked after the narrow refresh actions
- Seth Jones (`8477495`)
  - retained incomplete-source-tail proxy case

## Compared Metric Families

The comparison covered these metric families:

- availability
- participation
- TOI
- additive counts
- opportunity counts
- weighted `/60`
- finishing ratios
- on-ice context
- zone / usage
- territorial
- historical baselines

## Results Summary

### Brent Burns (`8470613`)

All compared families matched:

- availability: `MATCH`
- participation: `MATCH`
- TOI: `MATCH`
- additive counts: `MATCH`
- opportunity counts: `MATCH`
- weighted `/60`: `MATCH`
- finishing ratios: `MATCH`
- on-ice context: `MATCH`
- zone / usage: `MATCH`
- territorial: `MATCH`
- historical baselines: `MATCH`

Comparison volume:

- compared rows: `244`
- missing stored rows: `0`
- missing recomputed rows: `0`
- total family-field comparisons:
  - availability: `8784`
  - participation: `3416`
  - TOI: `3172`
  - additive counts: `22204`
  - opportunity counts: `9516`
  - weighted `/60`: `20496`
  - finishing ratios: `15372`
  - on-ice context: `15372`
  - zone / usage: `10248`
  - territorial: `22936`
  - historical baselines: `21960`

### Jesper Bratt (`8479407`)

All compared families matched:

- availability: `MATCH`
- participation: `MATCH`
- TOI: `MATCH`
- additive counts: `MATCH`
- opportunity counts: `MATCH`
- weighted `/60`: `MATCH`
- finishing ratios: `MATCH`
- on-ice context: `MATCH`
- zone / usage: `MATCH`
- territorial: `MATCH`
- historical baselines: `MATCH`

Comparison volume:

- compared rows: `248`
- missing stored rows: `0`
- missing recomputed rows: `0`
- total family-field comparisons:
  - availability: `8928`
  - participation: `3472`
  - TOI: `3224`
  - additive counts: `22568`
  - opportunity counts: `9672`
  - weighted `/60`: `20832`
  - finishing ratios: `15624`
  - on-ice context: `15624`
  - zone / usage: `10416`
  - territorial: `23312`
  - historical baselines: `22320`

## Interpretation

For the ready validation set, fresh stored rows match fresh recomputed source-derived rows across every required metric family in this family-level pass.

This establishes:

- no row-loss or row-key drift for Burns or Bratt
- no family-level divergence between recomputed outputs and stored rows for the compared current-season data
- fresh PP-share and PP-role-sensitive rows are now consistent for the heavy-PP ready case (Jesper Bratt)

## Important Limitation

This pass is a family-level stored-vs-recomputed comparison using the current remediation code path and fresh upstream data.

It does **not** replace the remaining verification work in later sub-tasks:

- Corey Perry’s blocked freshness case still needs dispute-focused verification once source freshness permits it
- Seth Jones remains the designated incomplete-tail proxy case
- disputed metrics still need explicit individual signoff in `7.5`
- contextual label validation remains separate in `7.6`

## Conclusion

`7.4` family reconstruction status:

- Brent Burns: passed
- Jesper Bratt: passed
- Corey Perry: blocked by freshness for PK-sensitive validation
- Seth Jones: intentionally blocked proxy case retained

