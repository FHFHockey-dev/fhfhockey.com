# FORGE + Trends + Start Chart Combo Dashboard

## 1.1 Route + rendering strategy

### Proposed route
- Primary route: `/trends`
- Page title: "FHFH Dashboard"
- Legacy pages link to the new route (redirects handled later in Task 6.0).

### SSR/CSR strategy (hybrid)
- SSR: resolve the default `date` and fetch team power ratings so the page has
  a meaningful first paint even if trend APIs are still loading.
- CSR: load projections (FORGE + optional legacy), CTPI ladder, SOS, team trends,
  skater trends, and start-chart schedule context via shared client loader.
- Rationale: trend endpoints are heavier and already cached with
  `s-maxage/stale-while-revalidate`, so CSR keeps TTFB low while still
  benefiting from CDN caches.

## 1.2 Canonical data contracts (draft)

### Team power row
```ts
type TeamPowerRow = {
  teamId: number;
  teamAbbr: string;
  teamName: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
  };
  date: string; // YYYY-MM-DD snapshot date
  power: {
    offRating: number;
    defRating: number;
    paceRating: number;
    score: number; // derived: base + special teams adjustment
    trend10: number;
  };
  components: {
    xgf60: number;
    gf60: number;
    sf60: number;
    xga60: number;
    ga60: number;
    sa60: number;
    pace60: number;
  };
  specialTeams: {
    ppTier: 1 | 2 | 3;
    pkTier: 1 | 2 | 3;
    specialRating: number | null;
    disciplineRating: number | null;
  };
  ctpi?: {
    ctpi0To100: number;
    offense: number;
    defense: number;
    goaltending: number;
    specialTeams: number;
    luck: number;
    sparkSeries?: Array<{ date: string; value: number }>;
  };
  sos?: {
    pastWinPct: number | null;
    futureWinPct: number | null;
    combinedWinPct: number | null;
    sosScore: number | null;
    pastRecord?: string;
    futureRecord?: string;
  };
};
```

### Projection row (skaters)
```ts
type ProjectionRow = {
  source: "forge" | "legacy";
  date: string; // YYYY-MM-DD used for the run
  playerId: number;
  playerName: string;
  position: string | null;
  teamId: number | null;
  teamAbbr: string | null;
  opponentTeamId: number | null;
  opponentAbbr: string | null;
  gamesRemainingWeek?: number;
  ownershipPct?: number | null;
  stats: {
    fantasyPoints?: number | null;
    goals: number | null;
    assists: number | null;
    points?: number | null;
    shots: number | null;
    ppPoints?: number | null;
    hits: number | null;
    blocks: number | null;
    pim?: number | null;
    matchupGrade?: number | null;
  };
  uncertainty?: {
    goals?: { p10: number; p50: number; p90: number };
    assists?: { p10: number; p50: number; p90: number };
    points?: { p10: number; p50: number; p90: number };
    shots?: { p10: number; p50: number; p90: number };
    ppPoints?: { p10: number; p50: number; p90: number };
    hits?: { p10: number; p50: number; p90: number };
    blocks?: { p10: number; p50: number; p90: number };
  };
};
```

### Goalie row
```ts
type GoalieRow = {
  source: "forge" | "legacy";
  date: string; // YYYY-MM-DD used for the run
  playerId: number;
  playerName: string;
  teamId: number;
  teamAbbr: string;
  opponentTeamId: number | null;
  opponentAbbr: string | null;
  ownershipPct?: number | null;
  start: {
    probability: number | null;
    confirmed: boolean | null;
  };
  stats: {
    projectedGsaa?: number | null;
    projectedSaves?: number | null;
    winProb?: number | null;
    shutoutProb?: number | null;
  };
};
```

### Trend series (team and skater)
```ts
type TrendSeriesPoint = {
  gp: number;
  percentile: number;
};

type TrendSeries = Record<string, TrendSeriesPoint[]>;

type TeamTrendSeries = {
  categoryId: string;
  series: TrendSeries; // key: teamAbbr
  rankings: Array<{
    team: string;
    percentile: number;
    gp: number;
    rank: number;
    previousRank: number | null;
    delta: number;
  }>;
};

type SkaterTrendSeries = {
  categoryId: string;
  series: TrendSeries; // key: playerId
  rankings: Array<{
    playerId: number;
    percentile: number;
    gp: number;
    rank: number;
    previousRank: number | null;
    delta: number;
    latestValue: number | null;
  }>;
  playerMetadata: Record<
    string,
    {
      id: number;
      fullName: string;
      position: string | null;
      teamAbbrev: string | null;
      imageUrl: string | null;
    }
  >;
};
```

### SOS row
```ts
type SosRow = {
  teamId: number;
  teamAbbr: string;
  date: string;
  past: {
    wins: number;
    losses: number;
    otl: number;
    winPct: number;
  };
  future: {
    wins: number;
    losses: number;
    otl: number;
    winPct: number;
  };
  combinedWinPct: number;
  sosScore: number;
};
```

## 1.3 Legacy projections decision

- Keep `player_projections` as an optional fallback for now.
- Default to FORGE projections in the unified dashboard.
- Add a source toggle to switch between FORGE and legacy; do not render legacy
  unless explicitly selected or FORGE data is missing for the selected date.
- Revisit default if the legacy model is empirically more accurate; capture that
  decision after `run-projection-accuracy` data review.

## 1.4 Date semantics and defaults

### Canonical date rules
- All dashboard data is keyed off `date` (YYYY-MM-DD) using America/New_York.
- Default `date` value: `today` in ET.
- If a source has no data for `date`, fall back in this order:
  1) `date - 1` (yesterday)
  2) Latest available for that source
- Each API response should expose `dateUsed` so the UI can indicate fallback.

### Source alignment
- Start chart: keep existing fallback logic; expose `dateUsed` already returned.
- Team ratings: require explicit `date`; if empty, return a 400 and let loader
  request `dateUsed` from the dashboard date resolver.
- CTPI/Team Trends/Skater Trends/SOS: use latest season data, but still return
  `generatedAt` and `seasonId`. When `date` is provided, use it as display
  context only (do not filter unless data supports it).
- FORGE projections: `date` maps to runId via `requireLatestSucceededRunId`.
  If no runId for `date`, fallback to latest succeeded run and return
  `dateUsed`.

## 1.5 Required filters

### Global filters
- Date (YYYY-MM-DD, default = today ET, with fallback to latest available)
- Team (optional, filter projections, trends, and matchups by team)
- Search (player/team text query)
- Projection source (FORGE default, legacy optional)

### Projections section filters
- Position (C/LW/RW/D/G)
- Ownership range (optional, Yahoo ownership)
- Games remaining this week (optional threshold)

### Trends section filters
- Team trend category (offense/defense/powerPlay/penaltyKill)
- Skater position group (forward/defense/all)
- Skater window size (1/3/5/10)

## 2.1 Shared data loading proposal

### Utilities
- `web/lib/dashboard/dataFetchers.ts`
  - `fetchTeamTrends()` → `/api/v1/trends/team-power`
  - `fetchTeamCtpi()` → `/api/v1/trends/team-ctpi`
  - `fetchTeamSos()` → `/api/v1/trends/team-sos`
  - `fetchSkaterTrends({ position, window, limit })` → `/api/v1/trends/skater-power`
  - `fetchForgePlayers(date)` → `/api/v1/forge/players?date=`
  - `fetchStartChart(date)` → `/api/v1/start-chart?date=`
  - `fetchTeamRatings(date)` → `/api/team-ratings?date=`
  - `loadDashboardData(params)` → `Promise.all` for all required resources

### Hook
- `web/hooks/useDashboardData.ts` wraps `loadDashboardData` with
  `{ data, error, isLoading }` to power the new `/trends` page.

## 2.2 Caching/memoization strategy

- Client-side request dedupe + short TTL cache in
  `web/lib/dashboard/dataFetchers.ts`.
- Trend endpoints cached for 5 minutes; snapshot endpoints (ratings, forge,
  start-chart) cached for 60 seconds.
- In-flight requests are de-duplicated by URL to avoid duplicate calls across
  sections within the same render cycle.

## 2.3 Team metadata normalization

- `web/lib/dashboard/teamMetadata.ts` provides `getTeamMetaByAbbr` and
  `getTeamMetaById` helpers based on `teamsInfo`.
- `loadDashboardData` builds a `teamMeta` index keyed by `teamAbbr` so sections
  can reuse consistent team names/colors/logos without per-section mapping.

## 2.4 Loading/error/empty state strategy

### Global
- Page shell renders immediately with filter bar and section headers.
- Use section-level loading and error states so one failing endpoint does not
  block the entire dashboard.

### Section defaults
- Team Power (ratings + CTPI + SOS)
  - Loading: "Loading team power snapshot…"
  - Empty: "No team power data for the selected date."
  - Error: surface specific fetch error (ratings/ctpi/sos).
- Projections (FORGE + legacy)
  - Loading: "Loading projections…"
  - Empty: "No projections available for this date."
  - Error: show error and allow source toggle to retry.
- Trends (team + skater)
  - Loading: "Loading trend charts…"
  - Empty: "No trend history yet."
  - Error: display per-category error messages.
- Schedule & Matchups
  - Loading: "Loading matchups…"
  - Empty: "No games scheduled."
  - Error: show error and allow manual date retry.

### Error handling
- Use a shared error banner component to keep messaging consistent.
- Preserve last successful data if a subsequent refresh fails.
