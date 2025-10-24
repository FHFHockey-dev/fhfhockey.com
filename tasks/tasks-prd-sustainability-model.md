## Relevant Files

- `web/pages/api/v1/sustainability/recompute.ts` - API route to trigger nightly recompute and append snapshot data.
- `web/pages/api/v1/sustainability/player/[playerId].ts` - API route to fetch score, probabilities, projections, flags, explanations.
- `web/pages/api/v1/sustainability/upcoming/[playerId].ts` - API route to fetch per-opponent per-game projections and rollups.
- `web/lib/sustainability/data.ts` - Data access layer: fetch WGO/NST windows, career baselines, joins, opponent context.
- `web/lib/sustainability/features.ts` - Feature engineering: rolling windows, z-scores, priors, shrinkage, usage deltas.
- `web/lib/sustainability/model.ts` - Modeling functions: probability model, projections, bands, explainability stubs.
- `web/lib/sustainability/persist.ts` - Persistence: upsert into sustainability_trend_bands and sustainability_projections.
- `web/lib/sustainability/types.ts` - Shared types/interfaces and JSON schemas.
- `web/lib/sustainability/data.ts` - Typed data-access helpers to fetch and aggregate last-N windows from WGO/NST.
- `web/sql/sustainability/*.sql` - Parameterized SQL for metric retrieval and inserts.
- `web/sql/sustainability/wgo_last_n_games.sql` - Returns last-N game rows from WGO per-player for rolling windows.
- `web/sql/sustainability/wgo_last_n_aggregate.sql` - Aggregates last-N window for surface stats and TOI splits.
- `web/sql/sustainability/nst_last_n_counts.sql` - Returns last-N NST gamelog individual counts rows per player.
- `web/sql/sustainability/nst_last_n_counts_aggregate.sql` - Aggregates last-N NST counts window totals and FO%.
- `web/sql/sustainability/nst_last_n_rates.sql` - Returns last-N NST gamelog individual rates rows per player.
- `web/sql/sustainability/nst_last_n_rates_aggregate.sql` - Aggregates last-N NST rates window as averages.
- `web/sql/sustainability/nst_game_date_map.sql` - NST date_scraped passthrough as canonical game_date (placeholder for future mapping).
- `web/sql/sustainability/nst_career_baseline_counts.sql` - Aggregates seasonlong NST counts across seasons; includes derived per-60.
- `web/sql/sustainability/nst_career_baseline_rates.sql` - TOI-weighted averages from seasonlong NST rates across seasons.
- `web/__tests__/sustainability/*.test.ts` - Unit tests for data, features, model, and API.
- `functions/lib/sustainability` - Optional: if compute is moved to Python functions later; for now, keep in web.

### Notes

- Unit tests should typically be placed alongside the code files they are testing (e.g., `MyModule.ts` and `MyModule.test.ts` in the same directory).
- Use `npx vitest` to run tests in this workspace (web uses Vitest). You can scope to a file, e.g., `npx vitest web/__tests__/sustainability/data.test.ts`.

## Tasks

- [ ] 1.0 Data access and joins
  - [ ] 1.1 Implement SQL/queries to fetch rolling windows (3/5/10/25/50) from WGO and NST per player and date.
    - [x] 1.1.1 Add SQL files in `web/sql/sustainability/` to compute last-N games by player for WGO per-game stats (goals, assists, shots, pp_points, hits, blocks, pim, plus_minus, fow/fo%, toi splits).
    - [x] 1.1.2 Add SQL files for NST gamelogs (counts/rates) to compute last-N windows for ixG, iCF/FF/SF, rush_attempts, rebounds_created, first/second assists.
  - [x] 1.1.3 Implement a canonical game_date selection (prefer WGO date; map NST `date_scraped` to game_date).
  - [x] 1.1.4 Expose typed data access helpers in `web/lib/sustainability/data.ts` with input: {playerId, snapshotDate, windows[]}.
  - [ ] 1.2 Implement career all-strengths baselines from NST seasonlong views and/or seasonal tables.
    - [x] 1.2.1 Create queries to aggregate multi-season career baselines from `nst_seasonlong_as_counts` and `nst_seasonlong_as_rates`.
    - [x] 1.2.2 Implement per-60 baselines and variance estimates (for priors) in `data.ts`.
    - [ ] 1.2.3 Add fallback for rookies/limited data: shrink toward league-average by position.
  - [ ] 1.3 Normalize keys (players.id vs wgo player_id) and dates (WGO `date`, NST `date_scraped`).
    - [ ] 1.3.1 Validate that `wgo_skater_stats.player_id` aligns to `players.id`; if not, add internal non-Yahoo crosswalk.
    - [ ] 1.3.2 Implement date normalization utility and unit tests.
  - [ ] 1.4 Implement opponent mapping for next 5/10 games via `games` (and team views if needed).
    - [ ] 1.4.1 Query upcoming schedule for a player’s team and list next 10 games with opponent and dates.
    - [ ] 1.4.2 Add team strength pulls from `nst_team_stats` and/or `nst_team_all` for opponent adjustments.
    - [ ] 1.4.3 Expose a function getUpcomingOpponents(playerId, nGames) in `data.ts`.

- [ ] 2.0 Feature engineering
  - [ ] 2.1 Compute per-60 rates and recent-vs-career deltas/z-scores for surface and underlying metrics.
    - [ ] 2.1.1 Implement per-60 and per-game rate calculators in `features.ts` with type-safe inputs.
    - [ ] 2.1.2 Compute z-scores: (recent_rate - career_rate) / career_sd; store alongside raw.
    - [ ] 2.1.3 Add window weighting (e.g., greater weight to 3/5 vs 25/50 where configured).
  - [ ] 2.2 Build Empirical Bayes shrinkage toward career priors with window-weighting.
    - [ ] 2.2.1 Implement EB shrinker for key rates (goals/60, assists/60, shots/60, ixg/60, SCF/60, HDCF/60, IPP).
    - [ ] 2.2.2 Unit-test shrinkage behavior for small-N vs large-N windows.
  - [ ] 2.3 Compute usage deltas (ΔESTOI/PPTOI/SHTOI) and context features (PDO, oiSH%, OZS%).
    - [ ] 2.3.1 Add usage delta calculators using WGO TOI splits vs career baselines.
    - [ ] 2.3.2 Compute context: PDO, on-ice SH%, OZS% from NST OI tables; compute deltas vs career.
  - [ ] 2.4 Aggregate opponent-adjusted per-game distributions and roll up to 5/10 horizons with uncertainty.
    - [ ] 2.4.1 Derive opponent adjustment factors from opponent defensive rates (xGA/60, CA/60, PK).
    - [ ] 2.4.2 Produce per-game Poisson/NegBin approximations for counting stats; simulate or analytically sum to 5/10.
    - [ ] 2.4.3 Emit bands (50%/80%) via quantiles; verify calibration with small backtest.

- [ ] 3.0 Modeling and outputs
  - [ ] 3.1 Implement baseline probability model (logistic) for Hot/Normal/Cold using feature set; add calibration.
    - [ ] 3.1.1 Define Hot/Cold labels from historical z-scores or quantiles; create training target.
    - [ ] 3.1.2 Fit logistic regression; add isotonic/Platt calibration; return class probabilities.
    - [ ] 3.1.3 Add feature importance extraction and simple explanation text generator.
  - [ ] 3.2 Convert rate expectations to counting projections for goals/assists/points/shots/pp_points/hits/blocks/pim/+/−/fow/fo%.
    - [ ] 3.2.1 Compute expected per-game counts from rate×TOI; aggregate to 5/10; include variance.
    - [ ] 3.2.2 Handle FO% as a rate with appropriate aggregation and bands.
  - [ ] 3.3 Compute Sustainability Score (0–100) and generate over/underperforming flags.
    - [ ] 3.3.1 Define score formula combining calibrated streak probs and deltas vs baseline.
    - [ ] 3.3.2 Set thresholds for over/underperforming; expose flags.
  - [ ] 3.4 Generate explanations (top drivers); simple importance first.
    - [ ] 3.4.1 Map top features to human-readable bullets (e.g., "PP TOI up +40% vs career").
    - [ ] 3.4.2 Include up to 3 reasons with direction and magnitude.

- [ ] 4.0 Persistence and API
  - [ ] 4.1 Reuse `sustainability_trend_bands` for metric bands; implement upsert API in `persist.ts`.
    - [ ] 4.1.1 Write insert/upsert helpers for trend bands keyed by (player_id, snapshot_date, metric_key, window_code).
    - [ ] 4.1.2 Add unit tests for idempotency and conflict handling.
  - [ ] 4.2 Create `sustainability_projections` table migration (SQL) and types; store snapshots and per-opponent breakdowns.
    - [ ] 4.2.1 Author SQL migration in `web/sql/sustainability/001_create_sustainability_projections.sql`.
    - [ ] 4.2.2 Add TS types/interfaces in `types.ts` and serialization helpers in `persist.ts`.
  - [ ] 4.3 Implement POST `/api/v1/sustainability/recompute` endpoint.
    - [ ] 4.3.1 Validate input date; default to yesterday; enforce server-side auth.
    - [ ] 4.3.2 Orchestrate data->features->models->persist; return summary.
  - [ ] 4.4 Implement GET `/api/v1/sustainability/player/:playerId` and `/api/v1/sustainability/upcoming/:playerId` endpoints.
    - [ ] 4.4.1 Support query params window (3/5/10/25/50) and horizon (5/10); validate.
    - [ ] 4.4.2 Return JSON schema with score, probs, projections, bands, flags, explanations; include metadata.

- [ ] 5.0 Testing, docs, and performance
  - [ ] 5.1 Unit tests for data, features, model, and API (Vitest).
    - [ ] 5.1.1 Add tests: date normalization, window selection, priors/shrinkage, opponent adjustment.
    - [ ] 5.1.2 Add tests: probability calibration sanity, projection aggregation, API responses.
  - [ ] 5.2 Backtest accuracy vs career-only and recent-only baselines (MAE/RMSE; Brier for probs).
    - [ ] 5.2.1 Write a small backtest harness over past snapshots; record metrics.
    - [ ] 5.2.2 Document results and targets in README.
  - [ ] 5.3 Add README section with endpoint schema and feature dictionary.
    - [ ] 5.3.1 Document endpoint paths, params, response fields, and examples.
  - [ ] 5.4 Ensure nightly batch SLA; basic logging and error handling.
    - [ ] 5.4.1 Add timing logs and error counters; ensure idempotent recompute.
    - [ ] 5.4.2 Identify slow queries and add indexes if needed.
