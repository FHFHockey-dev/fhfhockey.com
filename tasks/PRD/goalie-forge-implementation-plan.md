# Goalie FORGE Implementation Plan

## Phase 1 (implemented in this pass)
- Add a reusable goalie projection model helper (`web/lib/projections/goalieModel.ts`) that enforces:
  - regression-to-mean save% priors
  - volatility index + blowup risk
  - confidence, quality, reliability tiers
  - recommendation label (`START`, `SIT`, `STREAM_TARGET`, `AVOID`)
- Integrate helper into `runProjectionV2ForDate` in `web/lib/projections/run-forge-projections.ts` so goalie projections are no longer fixed at league-average save%.
- Persist model metadata in `forge_goalie_projections.uncertainty.model`.
- Add `GET /api/v1/forge/goalies` for FORGE page consumption.
- Update `web/pages/FORGE.tsx` with Skaters/Goalies mode switch and goalie-specific cards.

## Phase 2 (next)
- Replace baseline `forge_goalie_game` evidence pulls with precomputed goalie feature snapshots to reduce runtime query cost.
- Add context features to goalie model:
  - opponent shot-quality proxy and pace
  - team defensive environment trends (`xGA/60`, attempts against)
  - workload/fatigue flags (start clusters, rest)
- Add short-horizon forecast option (`horizon=5`) with sequential uncertainty widening.

## Phase 3 (validation + calibration)
- Backtest goalie model on rolling 30/60/90 day windows:
  - save%, GA, saves calibration curves
  - blowup risk reliability plots
  - recommendation outcome hit rates
- Tune thresholds for recommendation logic and confidence tiers from empirical error.
- Add lightweight monitoring panel for drift (model vs actual by tier).

## Phase 4 (PRD stretch goals)
- Incorporate flurry/venue/rink-bias adjustments where data permits.
- Add scenario simulations for confirmed/likely starts and lineup event overrides.
- Add start/sit and prop-lean endpoints with explicit confidence labels.
