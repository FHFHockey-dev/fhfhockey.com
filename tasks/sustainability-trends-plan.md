# Sustainability Volatility & Elasticity Project

## Goal
- Evolve `web/pages/trendsSandbox.tsx` into the primary sustainability workspace.
- Quantify per-player volatility for key metrics (HI/MED) using single-game and rolling (3, 5, 10) windows.
- Derive adaptive “elasticity bands” (normal ranges) per metric using historical variance blended with recent performance.
- Visualize bands vs. actual metric values, coloring streaks red (above band), blue (below), green (within) using palette from `web/styles/vars.scss`.
- Provide a Next.js API endpoint to recompute/store band data (cron-friendly) and surface visualization-ready payloads.
- Track auxiliary boxscore metrics & fantasy score signals to analyze correlations with streaks.

## Deliverables Checklist
- [ ] Data model decision for storing per-player per-metric volatility/band snapshots.
- [ ] Next.js API endpoint(s) for band recomputation & retrieval.
  - [ ] Define request parameters & payload shape (player, metric set, windows, snapshot date).
  - [ ] Implement Supabase queries aggregating 1/3/5/10 game windows.
  - [ ] Compute volatility stats (mean, variance, percentiles, blended weights).
  - [ ] Persist results (table or JSON storage) for UI consumption.
- [ ] Frontend updates in `trendsSandbox.tsx`.
  - [ ] Hook into new API to load band + metric series for selected player/season.
  - [ ] Normalize and combine metric series for visualization (shared scale or multi-axis approach).
  - [ ] Render elasticity bands + actual series with color-coded segments.
  - [ ] Surface 1-game dots, plus rolling averages (3/5/10) simultaneously or via toggles.
  - [ ] Add controls to choose metrics, windows, and visualization options.
  - [ ] Display supporting boxscore + fantasy score summaries and correlations.
- [ ] SCSS updates in `web/pages/trends/sandbox.module.scss` aligning with new visuals.
- [ ] Unit/integration tests for API computations (targeted utility functions).
- [ ] Documentation updates:
  - [ ] Finalize volatility/band formula reference.
  - [ ] Usage guide describing cron flow and API contract.
    - [ ] Document bulk rebuild endpoint (`POST /api/v1/sustainability/rebuild-trend-bands`) parameters (offset, limit, dry-run, game_limit).

## Decisions (locked in)
- Storage: create Supabase table `sustainability_trend_bands` (player × metric × window × snapshot).
- Recency vs history blend per metric:
  - EWMA with metric-specific half-lives (shots/ixG family 5 games; on-ice share 7; IPP 8–10; SH% 10–12; on-ice SH%/SV%/PDO 8; goalie save% 6–8).
  - Prior baseline: weighted season history (last season 60%, -2 season 30%, older 10%).
  - Bayesian shrinkage: `theta_hat = (n_eff * theta_EWMA + K * mu0) / (n_eff + K)` with exposure-specific `n_eff` and K tuned per metric (e.g., 300–400 minutes for volume drivers, 500–600 minutes for on-ice share, etc.).
- Variance & bounds:
  - Point estimates use the Bayesian blend above.
  - Bands derived from exposure-aware credible intervals (Poisson-Gamma for per-60, Beta-Binomial with Jeffreys/player priors for percentages).
  - Robust z-scores (positional 30-day window) using MAD for visualization/alerting.
- Normalization for charts: show robust z + percentile (pos segmented), plus delta vs player baseline; avoid min-max except optional sparklines.
- Boxscore/fantasy correlation focus (initial):
  - Skaters: shots_per_60, icf_per_60, ixg_per_60, pp_toi_pct_per_game, pp_shots_per_60, pp_points_per_60, points_per_60 (split strengths), ipp, on_ice_sh_pct & pdo, xgf_pct/scf_pct/hdcf_pct, hits_per_60, blocks_per_60.
  - Goalies: save_pct (shrunken) + CI, shots_against_per_60, opponent/team xga/hdca, quality_starts_pct.
- League/position normalization: 30-day rolling robust z/percentile by F/D/G segment.
- Hot/cold interpretation rules (per spec) baked into UI.

## Outstanding Questions
- None at this time. (Pending implementation tasks below.)

## Clarifications Received
- API cadence: nightly job (triggered via cron); backfill to cover historical seasons for baseline.
- Data retention: keep full history in `sustainability_trend_bands`.
- Chart UX: provide toggles to switch between 1/3/5/10-game views rather than simultaneous overlay.
- Goalies: defer; current scope is skaters only, separate goalie UI planned later.

## Progress Snapshot — Oct 2024
- Server-side band engine is partially in place (`web/lib/sustainability/bandCalculator.ts`, `bandService.ts`). It blends EWMA with season-prior baselines and persists to `sustainability_trend_bands`, but we still lack production-grade orchestration for historical backfill/nightly refresh.
- API surface includes both single-player (`web/pages/api/v1/sustainability/trend-bands.ts`) and bulk rebuild (`web/pages/api/v1/sustainability/rebuild-trend-bands.ts`) endpoints with limit/offset controls; we still need scheduling glue, request validation, and safety rails for large snapshots.
- Frontend sandbox (`web/pages/trendsSandbox.tsx`) now renders a responsive D3-based band chart with credible-interval shading and hot/cold markers; follow-up work is still needed to overlay additional gamelog series and expose window toggles inline with the spec.
- Supabase views (`player_stats_unified`, `player_totals_unified`) provide the data foundation, but season weights/exposure heuristics still need validation against historical seasons once ingestion tooling is ready.
- Documentation/workflow gaps: no cron/runbook yet for nightly rebuild, no usage note for bulk endpoint, and tests around `computeTrendBandsForPlayer` are absent.

## Backend Ingestion Worklog
- Added `computeAndStoreTrendBandHistory` in `web/lib/sustainability/bandService.ts` to iterate player gamelog snapshots, reuse the Bayesian band calculator, and bulk upsert results in chunks (history aware of sliding `gameLimit` window and season carryover).
- Extended `POST /api/v1/sustainability/rebuild-trend-bands` to accept `history`, `start_date`, `end_date`, and `game_limit` parameters so we can trigger multi-season backfills in batches (summaries now report computed snapshots, seasons touched, and dry-run counts).
- Normalized snapshot rounding/formatting logic shared between single-snapshot and history paths to ensure consistent persistence precision.

## Frontend Visualization Worklog
- Rebuilt the elasticity band chart in `web/pages/trendsSandbox.tsx` to use responsive D3 scales with shaded credible intervals, baseline overlays, and hot/cold markers that mirror the intended streak visualization.
- Updated `web/pages/trends/sandbox.module.scss` styling to support the new SVG layout (gridlines, axis labels, plotted background) while keeping palette cues from the design system.

## Suggested Next Steps
1. Confirm storage approach & statistical method choices (open questions).
2. Design Supabase schema changes (if any) and draft migration plan.
3. Build shared server-side utilities for rolling windows + volatility calculations.
4. Implement API endpoint(s) leveraging those utilities.
5. Update frontend to consume new API and render enhanced charts.
6. Iterate on analytics/correlation features once core visualization is stable.
