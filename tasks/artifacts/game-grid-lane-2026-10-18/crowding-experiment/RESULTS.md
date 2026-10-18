# Crowding grade experiment — results (2026-10-18)

Protocol: `PROTOCOL.md` (written before the run). Reproduce from the repository root:

```
node tasks/artifacts/game-grid-lane-2026-10-18/crowding-experiment/convert-schedule.mjs "<Frozen Tools CSV>" tasks/artifacts/game-grid-lane-2026-10-18/crowding-experiment/schedule-2025-03-17_04-07.json
node --experimental-strip-types --no-warnings tasks/artifacts/game-grid-lane-2026-10-18/crowding-experiment/run-experiment.mjs
```

The run takes about 75s and uses the production `calcWeekScore` / `calculateSlateCrowding`. Raw output is in `results.json`.

| Roster (R skaters, 12 slots) | Top-1 regret v1 → v2 | Top-1 utility v1 → v2 | Top-5 utility v1 → v2 | Spearman v1 → v2 | Top-1 better / worse |
|---|---|---|---|---|---|
| 14 | 0.0467 → 0.0190 | 2.985 → 3.013 | 2.656 → 2.667 | 0.980 → 0.987 | 35 / 0 |
| 16 | 0.0709 → 0.0349 | 2.738 → 2.773 | 2.393 → 2.408 | 0.977 → 0.984 | 35 / 0 |
| 18 | 0.0851 → 0.0515 | 2.514 → 2.548 | 2.156 → 2.171 | 0.947 → 0.957 | 35 / 0 |

- 192 scenarios (3 real weeks × 64 day masks).
- The top-1 set changed in 38 scenarios: 35 improved and 3 were neutral in every configuration.
- **0 GP/ON guarantee violations.**
- **Pre-registered criterion: met.**

**Interpretation.** The grade acts almost entirely as a tie-breaker inside equal GP/ON groups, which is what its ±0.25 budget was designed for. Where it changes a pick, the pick has more synthetic startable games, about +0.03 to +0.04 games per pick on average. It never makes a pick worse.

**Limits.**
- The roster model is synthetic and positionless: no eligibility, locks, goalies or acquisition limits.
- The sample is 3 late-season weeks from one season.
- These results are plausibility evidence, not observed fantasy start probability or live acceptance.
- The matchup term was neutral, so interaction with win odds is untested.
