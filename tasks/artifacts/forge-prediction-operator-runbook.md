# FORGE Prediction Operator Runbook

## Daily Order

1. Confirm source ingestion freshness: games, teams, players, rosters, WGO, NST, line combinations, goalie starts, and tweet-review accepted rows.
2. Run rolling foundations: `/api/v1/db/run-rolling-forge-pipeline?mode=daily_incremental`.
3. Rebuild sustainability in order: baselines, priors, window z, scores, trend bands.
4. Build projection derived tables: `/api/v1/db/build-projection-derived-v2`.
5. Run FORGE projections: `/api/v1/db/run-projection-v2`.
6. Generate game predictions: `/api/v1/game-predictions/forecast`.
7. Score completed game predictions: `/api/v1/game-predictions/score`.
8. Review health: `/api/v1/db/cron-report`, `/api/v1/game-predictions/health`, `/api/v1/runs/latest`, and `/api/v1/runs/{run_id}`.

## Triage

- Stale source warnings: rerun the owning ingestion route first; do not rerun downstream model jobs until source cutoffs are current or explicitly accepted as degraded.
- Missing rolling features: rerun rolling player averages and verify validation payloads before projection execution.
- Sustainability gaps: rerun the chain in dependency order and inspect `guardrail_filtered` plus component warnings in `/api/v1/sustainability/trends`.
- FORGE run stuck in `running`: check `/api/v1/runs/latest`; if the row exceeded the active window, treat the latest succeeded run as serving-safe and rerun `run-projection-v2` with bounded `maxRuntimeMs`.
- Game prediction degradation: compare `/api/v1/game-predictions/accountability`, backtest, and ablation outputs before promoting a model/version bump.

## Rollback

- Keep serving on the latest succeeded `forge_runs` row when a newer run fails or is stale-running.
- Do not promote a new `game_prediction_model_versions` row to production unless persisted validation metrics pass promotion gates.
- Revert `GAME_PREDICTION_FEATURE_SET_VERSION`, `BASELINE_MODEL_VERSION`, or FORGE model versions only with a matching code rollback and health check.
- Keep sKO quarantined unless it has persisted feature importance, validation metrics, and a promotion gate.
