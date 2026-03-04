# Forge Dashboard Dependency Matrix

## Scope
This matrix documents each implemented Forge dashboard module and the exact dependency chain:
- UI component(s)
- API endpoint(s)
- Supabase table(s)

## Modules

### 1) Team Power Rankings
- Components:
  - `web/components/forge-dashboard/TeamPowerCard.tsx`
  - `web/pages/forge/dashboard.tsx`
- API endpoints:
  - `GET /api/team-ratings?date=YYYY-MM-DD`
- Supabase tables (via `teamRatingsService`):
  - `team_power_ratings_daily`
  - `team_power_ratings_daily__new` (fallback)

### 2) Sustainable vs Unsustainable
- Components:
  - `web/components/forge-dashboard/SustainabilityCard.tsx`
  - `web/pages/forge/dashboard.tsx`
- API endpoints:
  - `GET /api/v1/sustainability/trends?snapshot_date=...&window_code=l10&pos=...&direction=hot|cold&limit=...`
- Supabase tables:
  - `sustainability_scores`
  - `player_baselines`

### 3) Hot / Cold Streaks
- Components:
  - `web/components/forge-dashboard/HotColdCard.tsx`
  - `web/pages/forge/dashboard.tsx`
- API endpoints:
  - `GET /api/v1/trends/team-ctpi`
- Supabase tables:
  - `team_ctpi_daily` (primary)
  - Fallback compute path tables if daily data unavailable:
    - `nst_team_gamelogs_as_rates`
    - `nst_team_gamelogs_as_counts`
    - `nst_team_gamelogs_pp_counts`
    - `nst_team_gamelogs_pk_counts`

### 4) Goalie Start + Risk
- Components:
  - `web/components/forge-dashboard/GoalieRiskCard.tsx`
  - `web/pages/forge/dashboard.tsx`
- API endpoints:
  - `GET /api/v1/forge/goalies?date=...&horizon=1&fallbackToLatestWithData=true`
- Supabase tables:
  - `forge_goalie_projections`
  - `forge_runs`
  - `forge_projection_calibration_daily`
  - `games`
  - `players`
  - `teams`

### 5) Start-Chart Slate Strip
- Components:
  - `web/components/forge-dashboard/SlateStripCard.tsx`
  - `web/pages/forge/dashboard.tsx`
- API endpoints:
  - `GET /api/v1/start-chart?date=YYYY-MM-DD`
- Supabase tables:
  - `games`
  - `player_projections`
  - `goalie_start_projections`
  - `yahoo_nhl_player_map_mat`
  - `yahoo_players`
  - `team_ctpi_daily`

### 6) Top Movers (Team + Skater lens)
- Components:
  - `web/components/forge-dashboard/TopMoversCard.tsx`
  - `web/components/TopMovers/TopMovers.tsx`
  - `web/pages/forge/dashboard.tsx`
- API endpoints:
  - `GET /api/v1/trends/team-ctpi`
  - `GET /api/v1/trends/skater-power?position=...&window=3&limit=60`
- Supabase tables:
  - Team movers path:
    - `team_ctpi_daily` (primary)
    - fallback compute path tables (same as Hot/Cold)
  - Skater movers path:
    - `player_trend_metrics`
    - `players`

## Cross-Cutting Shared Dependencies
- Shared fetch orchestration:
  - `web/lib/dashboard/dataFetchers.ts`
- Shared response normalization:
  - `web/lib/dashboard/normalizers.ts`
- Shared client-side cache/in-flight dedupe:
  - `web/lib/dashboard/clientFetchCache.ts`
- Shared route-level state/filter composition:
  - `web/pages/forge/dashboard.tsx`

## Canonical Decisions Captured
- Canonical goalie source for dashboard is `/api/v1/forge/goalies`.
- Date drift guardrails are surfaced at page-level based on each date-bound module’s resolved date.
- Module-level timestamp metadata is displayed using `snapshot_date`, `dateUsed`, `asOfDate`, and `generatedAt` where available.
