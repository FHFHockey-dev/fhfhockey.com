# PRD: FORGE + Trends + Start Chart Combo Dashboard

## 1) One-liner
Create a single master dashboard that merges FORGE projections, Trends (CTPI + skater/team trends), Start Chart projections/goalie starts, and Underlying Stats (team power ratings), eliminating duplicate views while keeping all core insights.

## 2) Goals
- Unify four pages into one cohesive dashboard with shared filters and consistent data definitions.
- Reduce duplicate UI sections (team power, CTPI ladder, projections tables) and replace with one canonical version of each.
- Keep data loading fast and predictable (avoid duplicate API calls, prefer cached endpoints).
- Preserve all current functionality (no loss of trend charts, projections, or goalie start info).

## 3) Non-goals
- Rewriting underlying projection models or trend math.
- Changing Supabase schema or rebuilding historical datasets.
- Re-skinning the entire site outside the combined dashboard.

## 4) Current Page Audit (100% inventory)

### A) `web/pages/api/v1/start-chart.ts`
**Purpose**: Start Chart API combining player projections + goalie starts + CTPI sparkline + team ratings.
- Data sources (Supabase):
  - `games` (date, homeTeamId, awayTeamId)
  - `player_projections` (legacy table, not FORGE)
  - `goalie_start_projections`
  - `yahoo_nhl_player_map_mat` (NHL -> Yahoo ids)
  - `yahoo_players` (ownership, positions)
  - `team_ctpi_daily` (CTPI sparkline)
- External helpers:
  - `fetchCurrentSeason` (`web/utils/fetchCurrentSeason.ts`)
  - `teamsInfo` (`web/lib/teamsInfo.ts`) for team IDs/abbrevs
  - `fetchTeamRatings` (`web/lib/teamRatingsService.ts`)
- Main behaviors:
  - Date fallback: prior day then latest available projections.
  - Enriches players with Yahoo ownership + positions + team/opponent abbrev.
  - Computes games remaining this week for team.
  - CTPI sparkline for teams playing on dateUsed.
  - Enriches games with `teamRatings` + goalie lists sorted by start_probability.

### B) `web/pages/trends/index.tsx`
**Purpose**: Sustainability trends dashboard (team and skater trends).
- API dependencies:
  - `/api/v1/trends/team-power` (team trend percentiles)
  - `/api/v1/trends/team-ctpi` (CTPI ladder + sparkline)
  - `/api/v1/trends/team-sos` (strength of schedule)
  - `/api/v1/trends/skater-power` (skater trends)
- Data models:
  - `TEAM_TREND_CATEGORIES` (`web/lib/trends/teamMetricConfig.ts`)
  - `SKATER_TREND_CATEGORIES` (`web/lib/trends/skaterMetricConfig.ts`)
  - `CtpiScore` (`web/lib/trends/ctpi.ts`)
- UI sections:
  - Player search/autocomplete (Supabase `players`)
  - Power ladder table (CTPI + snapshots)
  - Hot/Cold streaks (CTPI delta)
  - Team category charts with brush
  - Skater category charts + ranking table
  - SOS overlays in power ladder
- Components:
  - `TopMovers` (`web/components/TopMovers/TopMovers.tsx`)
  - Custom charts via `recharts`

### C) `web/pages/underlying-stats/index.tsx`
**Purpose**: Team power rankings snapshot view.
- API dependencies:
  - SSR: `fetchTeamRatings` (`web/lib/teamRatingsService.ts`)
  - CSR: `/api/team-ratings`
- Data sources (Supabase):
  - `team_power_ratings_daily` (+ optional `team_power_ratings_daily__new` fallback)
- UI sections:
  - Date selector (last 90 dates)
  - Top-3 summary cards
  - Full rankings table
  - Component ratings (finishing, goalie, danger, special, discipline)
  - Special teams tiers + trend

### D) `web/pages/FORGE.tsx`
**Purpose**: FORGE player projections grid.
- API dependency:
  - `/api/v1/forge/players` (`web/pages/api/v1/forge/players.ts`)
- Data source:
  - `forge_player_projections` joined with `players` + `teams`
- UI sections:
  - Search, team filter, position filter
  - Projections card grid
  - Uncertainty bands (p10/p50/p90)

### Peripheral utilities and APIs (referenced by the above)
- `web/utils/fetchCurrentSeason.ts` (current season resolution, API fallback)
- `web/lib/teamRatingsService.ts` (caching + team power ratings)
- `web/lib/teamsInfo.ts` (team metadata map + id/abbr helpers)
- `web/lib/trends/teamPercentiles.ts` (trend percentiles engine)
- `web/lib/trends/strengthOfSchedule.ts` (SOS computation)
- `web/pages/api/v1/trends/*` (team/ctpi/sos/skater trend APIs)

## 5) Overlaps and Consolidation Opportunities
- **Team power rankings** appear in two places:
  - Underlying Stats (power ratings + tiers + components)
  - Trends (CTPI ladder + team category percentiles + SOS)
- **Team performance snapshots** overlap:
  - Start Chart uses `fetchTeamRatings` for each game.
  - Trends uses CTPI ladder + category breakdown.
- **Player projections** overlap:
  - Start Chart uses legacy `player_projections`.
  - FORGE uses `forge_player_projections`.
- **Goalie insights** overlap:
  - Start Chart uses `goalie_start_projections`.
  - FORGE has goalie projections with win/shutout probabilities.
- **Team metadata** and abbrev mapping are reused across all pages (`teamsInfo`).

## 6) Combined Dashboard Requirements

### UX Layout (single page)
- **Global filter bar**
  - Date selector (default: today/most recent)
  - Team filter (optional)
  - Search (player/team)
  - Toggle: “Projections source” (FORGE vs legacy start-chart projections)
- **Top row: Snapshot tiles**
  - CTPI overall ladder (top 5 + delta)
  - Team Power Score snapshot (top 5 + tiers)
  - SOS summary (past/future)
- **Core sections**
  1) **Team Power**
     - Combined CTPI ladder + team power ratings table
     - Include offense/defense/goalie/special + component ratings
  2) **Projections**
     - Player projections (FORGE primary; legacy optional)
     - Uncertainty bands
     - Goalie projections + start probabilities + win/shutout odds
  3) **Trends**
     - Team trend charts (category tabs)
     - Skater trend charts (position + window)
  4) **Schedule & Matchups**
     - Daily games list (from Start Chart) with goalie start likelihoods
     - CTPI sparkline for teams playing today

### Data rules for goalie win probability
- Win/shutout probabilities should use **team-level projected goals for** and **opponent projected goals/GA**:
  - Use `forge_team_projections` as the primary source (GF estimate).
  - Use `forge_team_game_strength` for historical baselines (priors).
  - Use projected opponent shots/GA for GA inputs.

## 7) API + Data Alignment Plan

### Primary data sources
- FORGE projections: `/api/v1/forge/players` + `/api/v1/projections/goalies`
- Trends/CTPI/SOS:
  - `/api/v1/trends/team-power`
  - `/api/v1/trends/team-ctpi`
  - `/api/v1/trends/team-sos`
  - `/api/v1/trends/skater-power`
- Team power ratings:
  - `/api/team-ratings?date=YYYY-MM-DD`
- Start Chart schedule/goalies:
  - `/api/v1/start-chart?date=YYYY-MM-DD`

### Normalization rules
- Use `teamsInfo` for all abbreviations, names, and colors.
- Use `forge_player_projections` as canonical projection source.
- Keep legacy `player_projections` as fallback/compare until deprecated.

## 8) Implementation Plan
1) **Create new dashboard page** (new route TBD, e.g., `/forge-trends` or `/dashboard`).
2) **Build shared data hooks** to dedupe API calls and cache responses.
3) **Merge team power views** (CTPI + team ratings) into a single table + cards.
4) **Merge player projections + goalie starts** into one unified projections section.
5) **Embed trend charts** for teams/skaters as collapsible panels.
6) **Add cross-links** to player trend pages and team detail pages.

## 9) Information Architecture (Draft Diagram)
```text
Dashboard Page
├─ Global Filter Bar
│  ├─ Date (default: today / latest)
│  ├─ Team (optional)
│  ├─ Search (player / team)
│  └─ Projection Source Toggle (FORGE vs legacy)
├─ Snapshot Tiles
│  ├─ CTPI ladder summary + delta
│  ├─ Team power ratings (top 5 + tiers)
│  └─ SOS summary (past/future)
├─ Team Power Section
│  ├─ Combined ladder (CTPI + power ratings)
│  └─ Component ratings + special teams tiers
├─ Projections Section
│  ├─ Player projections table/grid (FORGE primary)
│  ├─ Goalie starts + win/shutout odds
│  └─ Uncertainty bands
├─ Trends Section
│  ├─ Team category charts (tabs)
│  └─ Skater category charts + rankings
└─ Schedule & Matchups
   ├─ Daily games list
   └─ CTPI sparkline for teams playing today
```

## 10) Component Reuse Matrix
```text
Source Page              | Candidate Components/Logic to Reuse
------------------------|---------------------------------------------
Start Chart              | game list w/ goalie starts, CTPI sparkline logic,
                         | Yahoo ownership + positions mapping, games remaining
Trends                   | power ladder table, hot/cold streaks, trend charts,
                         | skater rankings + search, SOS integration
Underlying Stats         | team power ratings table, top-3 summary cards,
                         | component ratings legend + badges
FORGE                    | projections grid, filters, uncertainty display

Shared Utilities         | teamsInfo mapping, fetchCurrentSeason, teamRatingsService,
                         | trend configs (team/skater), CTPI utilities
```

## 11) Risks / Open Questions
- Does `player_projections` remain required, or can we fully replace with FORGE outputs?
- How do we reconcile differing date semantics (today vs yesterday vs latest available)?
- Should the combined page be SSR (for SEO) or CSR only?
- API volume: ensure we stay within Vercel 4-minute and Supabase limits.

## 12) Acceptance Criteria
- A single dashboard page can replace `FORGE.tsx`, `trends/index.tsx`, `underlying-stats/index.tsx`, and the Start Chart view.
- All major data views are present: team power, CTPI, SOS, projections, trends.
- Duplicate cards/tables removed in favor of one canonical version each.
- Page loads in < 2 seconds on cached responses and < 5 seconds uncached.
- No loss of functionality: search, filters, and charts all preserved.

## 13) Supabase Tables + Update Endpoints (Required Freshness)

### A) Core schedule + mappings
- `games`
  - Updates: `/api/v1/db/update-games`
- `players`, `teams`
  - Updates: ingestion/seed pipelines (no single endpoint)
- `yahoo_nhl_player_map_mat`
  - Updates: materialized view refresh (cron SQL)
- `yahoo_players`
  - Updates: Yahoo ingestion jobs (existing Yahoo cron set)

### B) Start Chart + matchup context
- `player_projections` (legacy)
  - Updates: legacy projection pipeline (if retained)
- `goalie_start_projections`
  - Updates: `/api/v1/db/update-start-chart-projections`
- `team_ctpi_daily`
  - Updates: `/api/v1/db/update-team-ctpi-daily`

### C) FORGE projections
- `forge_player_projections`
- `forge_goalie_projections`
- `forge_team_projections`
- `forge_runs`
  - Updates (pipeline chain):
    - `/api/v1/db/ingest-projection-inputs`
    - `/api/v1/db/update-rolling-player-averages`
    - `/api/v1/db/build-projection-derived-v2`
    - `/api/v1/db/run-projection-v2`

### D) Trends (team + skater)
- `nst_team_gamelogs_as_counts`
- `nst_team_gamelogs_pp_counts`
- `nst_team_gamelogs_pk_counts`
- `nst_team_gamelogs_as_rates`
  - Updates: `/api/v1/db/update-nst-gamelog`
- `wgo_team_stats`
  - Updates: `/api/v1/db/update-wgo-totals`
- `player_trend_metrics`
  - Updates: `/api/v1/db/update-rolling-player-averages`

### E) Team power rankings + SOS
- `team_power_ratings_daily` (and optional `_new`)
  - Updates: `/api/v1/db/update-team-power-ratings` (or `update-team-power-ratings-new`)
- `sos_standings`
  - Updates: `/api/v1/db/update-team-sos`

### Notes
- If the combined dashboard uses only FORGE projections, `player_projections` can be deprecated and removed from the refresh list.
- `team_ctpi_daily` is used for sparklines and faster CTPI load; if empty, `/api/v1/trends/team-ctpi` will compute on the fly (slower).
- Add cron ordering: update games → NST/WGO data → CTPI/SOS/power ratings → FORGE pipeline → Start-chart goalie projections.
