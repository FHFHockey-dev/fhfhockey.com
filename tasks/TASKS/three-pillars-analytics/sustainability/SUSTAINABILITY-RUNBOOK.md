# Sustainability Model Runbook

## Runtime contract

The canonical player key is `players.id`. Writes use the server-side Supabase client; public routes are read-only. Snapshot writes are idempotent on `(player_id, snapshot_date, metric_key, horizon_games, projection_type, scope_key)`.

### Recompute

`POST /api/v1/sustainability/recompute`

- Auth: admin/cron middleware; never call with a public key.
- Query: `date=YYYY-MM-DD` (defaults to yesterday UTC), `offset=0..100000`, `limit=1..50` (default 25), and optional `dry=true`.
- Repeat with the returned next offset while `hasMore` is true. A dry run computes but does not persist.
- Success is `200`; partial player failures are isolated and return `207`; validation errors return `400`.
- The response includes snapshot date, processed player/row counts, failures with bounded reasons, paging state, and timing metadata.

Example:

```text
POST /api/v1/sustainability/recompute?date=2026-01-15&offset=0&limit=25&dry=true
```

The route currently projects goals, assists, points, shots, power-play points, hits, and blocks for 5/10-game snapshots plus per-opponent game rows. Hot/Normal/Cold probabilities remain unavailable until historical calibration evidence exists.

### Player read

`GET /api/v1/sustainability/player/:playerId?window=10&horizon=5`

- `window`: one of `3`, `5`, `10`, `25`, `50`.
- `horizon`: `5` or `10`.
- Returns the latest score/raw score, metric bands, count projections and intervals, flags, top-driver explanations, and source/snapshot metadata.
- Probability fields explicitly return `pending_calibration` and null values until a held-out backtest supports publication.
- Returns `404` when the player has no sustainability snapshot.

### Upcoming read

`GET /api/v1/sustainability/upcoming/:playerId?games=5`

- `games`: `5` or `10`.
- Returns opponent-game projection rows grouped by game, including team/opponent provenance and snapshot metadata.
- Returns `404` when no upcoming projections exist.

### Internal health

`GET /api/internal/sustainability/health`

- Auth: existing admin/cron middleware; the public Supabase key cannot invoke it.
- Returns `generatedAt` plus exact `rowCount` and nullable `latestSnapshotDate` values for `sustainability_scores`, `sustainability_trend_bands`, and `sustainability_projections`.
- An empty table is reported as zero rows with a null latest date. Any failed table read fails the request; partial health is not reported as success.

## Feature dictionary

The executable dictionary is `web/lib/sustainability/featureDictionary.ts`. Its stable groups are recent rate, baseline rate, z-score, percentile, usage delta, context delta, opponent adjustment, reliability, and sample weight. Each entry declares its unit, primary source tables, description, and whether the score requires it. New production features must be added there before they are exposed in explanations or model metadata.

Primary data ownership:

- `rolling_player_game_metrics`: recent/career rates, samples, and context.
- `sustainability_player_priors`: shrunk baseline priors.
- `sustainability_window_z_scores`: normalized deltas and percentiles.
- `wgo_skater_stats`: current player production and usage inputs.
- `team_power_ratings_daily`, `nst_team_all`, `nst_team_stats`: opponent context.
- `sustainability_scores`, `sustainability_trend_bands`, `sustainability_projections`: public snapshot outputs.

## Historical backtest and publication gate

`web/lib/sustainability/backtestHarness.ts` pages persisted snapshot projections in stable date/player/metric/horizon order and evaluates resolved future actuals against sustainability, career-only, season-only, recent-only, and naive variants. Count metrics are MAE, RMSE, bias, mean actual, and mean prediction. Probability evaluation uses multiclass Brier score and a uniform baseline. Invalid/missing values are excluded per variant and sample counts are always reported.

Production coverage measured 2026-07-11:

| Table                        |       Rows | Date span             | Distinct players |
| ---------------------------- | ---------: | --------------------- | ---------------: |
| `sustainability_scores`      |    219,568 | 2025-10-14–2026-07-11 |              694 |
| `sustainability_trend_bands` | 10,849,256 | 2024-10-04–2026-07-11 |            1,293 |
| `sustainability_projections` |          0 | none                  |                0 |

Therefore no projection MAE/RMSE, baseline-win, or Brier claim is currently publishable. The API deliberately reports pending calibration. Close the gate only after real projection snapshots have matured through their 5/10-game horizons, actual outcomes are resolved without leakage, and held-out metrics plus sample/date/player coverage are recorded. Do not substitute scores or trend bands for absent historical projections.

## Operations and performance

### Canonical scheduled score chain

The production owner is the TypeScript/Supabase route chain in `web/vercel.json`:

1. `rebuild-priors` builds league and player priors for the current season.
2. Three ordered `rebuild-window-z` pages process offsets 0, 250, and 500.
3. Three ordered `rebuild-score` pages process the same offsets.
4. Four `rebuild-trend-bands` pages process offsets 0, 250, 500, and 750.

The jobs are deliberately idempotent on their documented composite keys. Potentially large source reads use deterministic range pagination, filtered player IDs are bounded in chunks, and production writes are split into at most 400 rows per PostgREST upsert. Route responses report timing, processed/built/upserted counts, write-chunk counts where the route owns a bulk write, and structured prerequisite or partial-failure details. Retry a failed page with the same season, snapshot date, offset, and limit; do not skip to a downstream stage after a prerequisite failure.

These independently scheduled routes are not an atomic all-stage orchestrator. Authoritative schedule ownership and cross-job ordering remain tracked under B-CRON-NST NEW 61. Empirical distribution-snapshot/quintile persistence and config-triggered retro recompute queues are not implemented by this chain and must not be inferred from trend-band output.

The legacy Python Sustainability package is offline-only. Its pure scoring functions may be used for fixtures and analysis, but its persistence, incremental, snapshot, run-log, lock, and retro entry points fail closed. Do not restore Python database writes or schedule those modules without a new approved ownership decision and executable schema proof.

### Operational response and audit field schema

Every audited scheduled Sustainability route returns a JSON response with:

- `success`: boolean terminal outcome.
- `timing.startedAt`, `timing.endedAt`: ISO-8601 timestamps.
- `timing.durationMs`: nonnegative elapsed milliseconds.
- `timing.timer`: zero-padded `MMSS` display value.
- Run identity as applicable: `season`, `season_id`, `snapshot_date`, `start_date`, `dry`/`dry_run`, `run_all`, `offset`, and `limit`.
- Work evidence as applicable: `processed_players`/`processed`, `rows_built`, `rows_upserted`, `rows_upserted_or_built`, `write_chunks`, `batches_processed`, `snapshots_processed`, `computed_bands`, and `updated_bands`.
- Bounded diagnostics as applicable: `sample`, `summaries`, and `errors`.
- Failed prerequisites: `message`, `prerequisite`, and `dependencyError` with `kind`, `source`, `classification`, `message`, nullable `detail`, and `htmlLike`.

`withCronJobAudit` persists the corresponding `cron_job_audit` record with `job_name`, terminal `status`, inferred `rows_affected`, and `details.method`, `details.url`, `details.statusCode`, `details.durationMs`, the normalized `details.timing` record (including `source`), `details.rowsUpserted`, `details.failedRows`, bounded `details.error`, and a bounded serialized `details.response`. Analytics consumers must treat absent route-specific counters as null/not-applicable, not zero, and must use `status` plus HTTP status rather than inferring success from row count. Do not add credentials, authorization headers, database URLs, or provider values to route responses or audit details.

- Target: full active-skater nightly recompute under 15 minutes. Process bounded pages and aggregate route timing from each response; do not send one unbounded request.
- Partial failures are returned per player and can be retried with the same snapshot/date/page. Composite-key upserts prevent duplicates.
- Reads are bounded by exact player/snapshot/window/horizon keys and limits. Potentially large historical reads use `.range()` until a short page.
- Live index verification on 2026-07-11 confirmed the player/date index serves latest-snapshot lookup and the primary key serves exact player/snapshot/horizon/type reads. `EXPLAIN` selected index scans with estimated total costs 2.36 and 2.37 respectively. No speculative index was added to an empty projection table.
- RLS is enabled on score, band, and projection tables. `anon`/`authenticated` have SELECT only; service role owns writes.
- Investigate only measured regressions: record route timing, row counts, failures, paging state, query plan, and table cardinality before proposing an index or schema change.
