# WiGO audit — Group A (identity, search, season summary, schedule, team drivers)

Snapshot audited: `/private/tmp/fhfh-wigo-redesign/web` (read-only). DDL read from `/Users/tim/Code/fhfhockey.com/supabase/migrations/20260716112908_production_schema_baseline.sql` (also read-only). Prior audit cross-checked: `tasks/TASKS/wigo-charts-audit/` (00–06, 08–11, README, LIVE-EVIDENCE) and `tasks/TASKS/wigo-single-viewport/report.md`.

Checks: source and DDL inspection only. **Vitest was not run.** The snapshot's `node_modules` is a symlink into `/Users/tim/Code/fhfhockey.com/web/node_modules`, and Vitest writes its cache there, which would break the do-not-touch rule. No network, database, server or git activity.

The code paths below all apply to the dashboard as rendered by `pages/wigoCharts.tsx`. Only one responsive tree mounts at a time (`wigoCharts.tsx:126`, `:200`).

---

## 1. Query inventory

| Component (caller) | Table / view / RPC / endpoint | Columns | Filters | Expected rows | Paging / limit | Dedupe / cache |
|---|---|---|---|---|---|---|
| `useWigoPlayerDashboard` → `fetchWigoPlayerDetails` (`hooks/useWigoPlayerDashboard.ts:88-92`) | `players` | `*` | `id = playerId` | 1 | `.single()` | Key `["wigoPlayerDetails", id]`. Default QueryClient (`pages/_app.tsx:20`): staleTime 0, refetch on focus, 3 retries. Seeded by `setQueryData` on select (`:194`) but still refetched (A-07). |
| same (`:104-117`) | NHL `api-web.nhle.com/v1/player/{id}/landing`, fetched directly from the browser, not through `/api/cors` | `headshot` | only when `image_url` is null | 1 | – | Inside the same query function, so it repeats on every refetch of the details query. |
| hook → `fetchPlayerAggregatedStats` (`utils/fetchWigoPlayerStats.ts:587-612`) | `wigo_career` (PK `player_id`) | `*` (~150 cols) | `player_id` | 0–1 | `maybeSingle` | Key `["wigoPlayerAggregatedStats", id]`: **no season** in key. staleTime 0, refetch on focus. |
| same | `wigo_recent` (PK `player_id`) | `*` | `player_id` | 0–1 | `maybeSingle` | same query |
| same | `wigo_rates` | `*` | `player_id` | 0–1. Live table has **0 rows** (LIVE-EVIDENCE). | `maybeSingle` | same query |
| same | `wgo_skater_stats_totals` (PK `player_id, season`) | goals, assists, points, shots, hits, blocked_shots, penalty_minutes, pp_points, season, toi_per_game, pp_toi_pct_per_game | `player_id`, `order season desc`, `limit 1`. **No season filter.** | 1 | limit 1 | same query; duplicates the read in the next row |
| `PerGameStatsTable` → `useWigoPlayerTotals` (`hooks/useWigoPlayerTotals.ts`; also used by ToiLineChart and PpgLineChart) → `fetchPlayerPerGameTotals` (`fetchWigoPlayerStats.ts:694-760`) | `wgo_skater_stats_totals` | 15 cols | `player_id`, `season = String(seasonId)` | 0–1 | `limit 1 maybeSingle` | Key `["wigoPerGameTotals", player, season]`, staleTime 60 s. Enabled only when the season is known. Shared by 3 consumers. |
| `NameSearchBar` (`components/WiGO/NameSearchBar.tsx:66-71`) | `players` | `*` | `fullName ILIKE %term%` | ≤10 | `limit 10`, **no order** | Key `["wigoPlayerSearch", term]`, 300 ms debounce, skipped when the term equals the selected name |
| `useCurrentSeason` → `/api/v1/season` → `lib/NHL/server/index.ts:250-255` | `seasons` | `*` | `startDate ≤ now`, `order startDate desc` | 2 | `limit 2` | Key `["currentSeason"]`, staleTime 1 h. HTTP `max-age=86400`. |
| `OpponentGamelog` (`OpponentGamelog.tsx:78-97`) | `/api/cors` (Vercel function) → NHL `club-schedule-season/{abbr}/{season}` | `games[]` | client side: `season === seasonId`, gameType 1–3, team | ~90–110 games in the payload, 5–10 shown | – | Key `["wigoTeamSchedule", abbr, season]`, shared by teammates. staleTime 60 s. **refetchInterval** 30 s when a game is live, otherwise 300 s. Proxy sets no Cache-Control (`pages/api/cors/index.ts`). |
| `TeamPerformanceDrivers` → `fetchTeamDriverSnapshots` (`fetchTeamDriverSnapshots.ts:9-11`) | `games` | id, date, homeTeamId, awayTeamId | `seasonId`, `type = 2` | ~1,344 (84 × 32 / 2) | paged 1000 (`fetchAllSupabasePages`), so 2 pages | Key `["wigoTeamDriverSnapshots", season]`, staleTime 60 s. Shared by all players and teams. |
| same (`:17-18`) | `nst_team_5v5` | date | date in [first RS game, min(last RS game, today UTC)] | 1 | limit 1 | same query, sequential step 2 |
| same (`:23-26`) | `nst_team_5v5` (PK `team_abbreviation, date`; daily rows) | team_abbreviation, date, gp, xgf, xga, gf | date in [start, cutoff] | up to ~2,688 by season end | paged 1000, unique order | same query, step 3 (parallel with the next row) |
| same (`:27-30`) | `wgo_team_stats` (PK `id`) | team_id, game_id, date, pp_opportunities, power_play_goals_for, times_shorthanded, pp_goals_against | `season_id`, date in [start, cutoff] | up to ~2,688 | paged 1000, order game_id, team_id | same query |

Cold load for one player in group A is about 17 requests: players, the optional NHL landing call, 4 aggregate tables, totals, the schedule proxy, and about 9 team-driver pages. A teammate reuses the schedule and team-driver data, and any player reuses the team-driver data. None of these reads is an unpaged read over 1,000 rows, and none is an N+1 loop.

---

## 2. Prior-audit findings for group A: current status

| Prior finding (source) | Status | Current evidence |
|---|---|---|
| Aggregate query key is player-only and has no season argument (README P1, plan 00) | **STILL OPEN** | `useWigoPlayerDashboard.ts:32-33` `["wigoPlayerAggregatedStats", playerId]`; `:162-166`. See A-02. |
| Latest-season totals can fill missing STD counts (README P1, plan 12) | **STILL OPEN** | `fetchWigoPlayerStats.ts:603-611` (no season predicate) and `:331-357`. See A-01. |
| Desktop and mobile trees both mount (README P2, plan 00) | **FIXED** | `wigoCharts.tsx:126` / `:200` render one tree based on `viewportWidth` (introduces L-01). |
| Mobile tab initialized once from `window.location` (plan 00) | **FIXED** | `wigoCharts.tsx:57-58` reads `router.query.tab` on every render. |
| Invalid or non-finite URL IDs (plan 01) | **FIXED** | `getPlayerIdFromQueryValue` uses `Number.isSafeInteger && > 0` (`hook:35-46`). |
| Player-detail error not surfaced (plan 01) | **FIXED** | `wigoCharts.tsx:125` renders `playerDataError` with `role="alert"`. |
| Goalie selection unsupported (plan 01) | **STILL OPEN** | `NameSearchBar.tsx:67-71` has no `position` filter. See A-05. |
| Diacritics in search (plan 01) | **STILL OPEN** | plain `ilike`, no unaccent. See A-13. |
| Broken remote headshot or logo falls back (plan 02) | **FIXED** | `PlayerHeader.tsx:23-25, 34, 46`; header thumbnail `WigoDashboardSections.tsx:176, 194-195`. |
| Biography units, null and invalid dates, leap-day birthdays (plan 03) | **FIXED** | `playerBiography.ts:1-26`. |
| Totals query runs before the season resolves (plan 04) | **FIXED** | `useWigoPlayerTotals.ts:12` `enabled: !!playerId && !!seasonId`, with a season filter at `fetchWigoPlayerStats.ts:726-728`. |
| 82-game pace; S% inferred from magnitude (plan 05) | **FIXED** | `PerGameStatsTable.tsx:86-98`: S% = 100·G/SOG, pace = count/GP × 84, GP and S% not projected. |
| Totals fetched separately in 3 panels (README P2) | **FIXED** for the panels (shared key). The aggregate fetch still reads the same table separately (A-08). | `useWigoPlayerTotals.ts:10` |
| Schedule ordering, dedupe, next game, PPD/CNCL, team/season cache (plan 06) | **FIXED** in code | `OpponentGamelog.tsx:106-119, 132-133, 79`. Live revalidation is still open per plan 06. |
| 5v5 snapshot has no season predicate (plan 08, README P2) | **FIXED** | Bounded by regular-season `games` dates (`fetchTeamDriverSnapshots.ts:9-18`). |
| 5v5 and PP/PK rows are daily values, not cumulative (LIVE-EVIDENCE) | **FIXED** | 5v5 rows summed (`teamPerformanceDriverModel.ts:12-43`); PP/PK summed from opportunities and goals (`:63-88`). |
| League sample of 24 counts team identities, not valid metric values (plan 08) | **FIXED** | `teamPerformanceDriverModel.ts:213-216` checks each population. |
| One shared league fetch for all four cards (plan 08) | **FIXED** | A single query keyed by season (`TeamPerformanceDrivers.tsx:25-30`). |
| Special-teams percent inferred from magnitude (plan 11) | **FIXED** | Computed in percentage points (`model:84-85`); `formatPercentage` has no inference (`:252-253`). |
| Zero or missing xGF must not produce a fabricated percentile (plan 10) | **FIXED** | `finishingRate` requires `xgf > 0` (`model:150-151`); a null team result gives the "unavailable" card. |

---

## 3. New and still-open findings

### A-01 (P1, still open): STD counts can show another season's totals
- **Where:** `utils/fetchWigoPlayerStats.ts:603-611` and `:331-357`.
- **Problem:** the totals query has no season filter:
  ```ts
  .from("wgo_skater_stats_totals")…
  .eq("player_id", playerId)
  .order("season", { ascending: false })
  .limit(1)
  ```
  That row then fills STD Goals, Assists, Points, SOG, HIT, BLK, PIM and PPP whenever `std_*` is null:
  ```ts
  (stdValue == null || Number.isNaN(stdValue)) && totalsData
  ```
- **Why it matters:** the writer leaves `std_*` null only when it found no current-season data (`calculate-wigo-stats.ts:515ff` assigns them only `if (stdData)`). So whenever the fallback fires, the latest row it can find is normally a prior season.
- **Failure scenario:** a player out all season, or a player with no current-season games yet, shows last season's goal and point totals under STD, next to an empty STD GP.
- **Fix:** add `.eq("season", String(currentSeasonId))`, which means passing the season into the fetch and the query key (A-02), or remove the fallback.

### A-02 (P1, still open): aggregates are not tied to the dashboard season
- **Where:** `hooks/useWigoPlayerDashboard.ts:32-33`, `:162-166`.
- **Problem:** `queryFn: () => fetchPlayerAggregatedStats(selectedPlayerId as number)` takes no season, and the key is `["wigoPlayerAggregatedStats", playerId]`. `wigo_career` and `wigo_recent` have no season column, so STD, LY, 3YA and CA describe whichever season the last `calculate-wigo-stats` run treated as current.
- **Failure scenario:** around season rollover, or if the writer cron fails, the comparison table's STD and the Season production card (current-season totals) describe different seasons. Nothing on screen says so.
- **Fix:** include `currentSeasonId` in the key and pass it to the totals fallback. Show `wigo_career.last_updated` (it exists in the DDL) as an as-of date.

### A-03 (P1, new): one missing game row blanks a team's drivers for the season, and 9 such teams blank them for everyone
- **Where:** `components/WiGO/teamPerformanceDriverModel.ts:30-33`, `fetchTeamDriverSnapshots.ts:56`, `model:189-196`, `:213-216`.
- **Problem:** both readers require complete coverage. The 5v5 reader drops a team when any expected date is missing:
  ```ts
  if (dates.size !== expected.size || games.some(row => row.gp !== expected.get(row.date) …)) return [];
  ```
  The special-teams reader does the same:
  ```ts
  completeRows = regularRows.filter(row => observed.get(row.team_id)?.size === expected.get(row.team_id)?.size)
  ```
  The card then returns null for every team once fewer than 24 teams are complete.
- **Failure scenarios:**
  - LIVE-EVIDENCE records TBL missing 2 NST dates in October 2025. Under this code TBL's card stays "Incomplete regular-season coverage" for the whole season, with no recovery short of a backfill.
  - The 5v5 cutoff (latest `nst_team_5v5` date) is also applied to `wgo_team_stats`. If the WGO team writer lags the NST writer by one night, every team that played on the cutoff date fails the special-teams check. A typical night has 10 or more teams playing, so the card goes blank for all teams. **UNVERIFIED:** the relative cron timing of the WGO team-stats writer was not confirmed.
  - **UNVERIFIED:** postponed games that remain in `games` with their original date would also count as permanently missing.
- **Fix:**
  - Compute the cutoff as the minimum of the latest dates in the two sources.
  - Show "data through <date>, N of M games" for teams with small gaps instead of nulling them, or require coverage at or above a threshold.
  - Keep the 24-team gate on the population only.

### A-04 (P1, new): a valid PP/PK game can invalidate a team's whole season
- **Where:** `teamPerformanceDriverModel.ts:74-78`.
- **Problem:** a game is marked invalid when `row.power_play_goals_for! <= row.pp_opportunities! && row.pp_goals_against! <= row.times_shorthanded!` fails. If any single game fails, `valid` is false for the team, and both PP% and PK% become null for the whole season.
- **Why the check is wrong:** a 5-minute major does not end on a goal, so one power-play opportunity can produce two or more PP goals. That makes PPG > PPO a legitimate single-game value.
- **Failure scenario:** a team that scores twice on a major is excluded from special teams for the rest of the season. Enough such teams push the league sample under 24 and blank the card for everyone (A-03).
- **Fix:** validate on season sums, or drop the per-game `≤` checks and keep only the non-negative integer checks.

### A-05 (P1, still open): goalies and inactive players appear in search
- **Where:** `components/WiGO/NameSearchBar.tsx:67-71`.
- **Problem:** `.from("players").select("*").ilike("fullName", …).limit(10)` has no `.neq("position","G")`, and the dropdown does not show position or team. The WiGO writer excludes goalies (`calculate-wigo-stats.ts`: `.neq("position", "G")`).
- **Failure scenario:** selecting a goalie gives an empty comparison table, "No stats data found", and blank charts. The page does not say goalies are unsupported.
- **Fix:** add `.neq("position","G")` and show team and position in each option.

### A-06 (P1, new): a failed season lookup shows the wrong status
- **Where:**
  - `TeamPerformanceDrivers.tsx:24, 42-46`
  - `PerGameStatsTable.tsx:148`
  - `OpponentGamelog.tsx:203-206`
  - `hooks/useCurrentSeason.ts:33-36`
- **Problem:** `useCurrentSeason` returns `data ?? undefined` and drops the error.
  - Totals and schedule then show "Loading season info..." indefinitely, after 3 retries.
  - The drivers card is disabled because `enabled = !!teamId && !!teamAbbreviation && !!seasonId`, so a player who is selected sees "Select a player to load team drivers."
- **Fix:** expose `isError` from `useCurrentSeasonQuery` and render "Season unavailable" in these three panels.

### A-07 (P2, new): every focus re-fetches player details and aggregates, and seeding does not prevent the fetch
- **Where:** `useWigoPlayerDashboard.ts:156-166`, `:194-197`; `pages/_app.tsx:20` (`new QueryClient()` with defaults).
- **Problem:**
  - `setQueryData` seeds the cache, but with staleTime 0 the newly mounted key is already stale. React Query v5 (`^5.56.2`) therefore refetches immediately: another `players select *` plus the NHL landing call.
  - The details query and the 4-table aggregate query have no staleTime, so each window focus repeats about 6 requests (players + optional NHL landing + 4 aggregate tables).
  - The aggregate data only changes once a day (cron at 08:50 UTC per LIVE-EVIDENCE).
- **Fix:** set `staleTime` to 10–30 minutes on both queries, or a larger default for this page.

### A-08 (P2, still open): unused or duplicate reads in the aggregate fetch
- **Where:** `fetchWigoPlayerStats.ts:598-611`.
- **Problem:** `wigo_rates` has 0 rows live (LIVE-EVIDENCE) but is still queried for every player. `wgo_skater_stats_totals` is read again here with different, season-less semantics, in parallel with `useWigoPlayerTotals`.
- **Fix:** remove the `wigo_rates` read once its retirement is confirmed. Drop the totals fallback (A-01), or source it from the shared `useWigoPlayerTotals` query.

### A-09 (P2, new): schedule polling hits an uncached Vercel function
- **Where:** `OpponentGamelog.tsx:95-96`; `lib/cors-fetch.ts` (browser path `fetch('/api/cors?url=…')`); `pages/api/cors/index.ts` (no Cache-Control).
- **Problem:** the query polls `refetchInterval: … ? 30_000 : 300_000` for as long as the tab is focused, including with no game today and in the offseason. Each poll, plus each focus after 60 s, is one function invocation that downloads the full season schedule.
- **Fix:**
  - Poll only when a game today is PRE, LIVE or CRIT; otherwise use `refetchInterval: false` and a staleTime of 30 minutes or more.
  - Optionally add `s-maxage` on the proxy for schedule URLs.
  - This is a Vercel-cost item; changing proxy headers changes runtime behavior, so it needs approval.

### A-10 (P2, new): the team-driver dataset is refetched every 60 s on focus
- **Where:** `TeamPerformanceDrivers.tsx:29`; `fetchTeamDriverSnapshots.ts:9-30`.
- **Problem:** with `staleTime: 60_000`, about 6–7k rows (roughly 9 requests by season end) are downloaded again on any focus after a minute. The fetch also runs as 3 sequential steps: games, then latest date, then the two parallel reads. The sources are daily.
- **Fix:** staleTime 1 h or more, with gcTime to match.

### A-11 (P3, new): first render uses UTC dates and times
- **Where:** `OpponentGamelog.tsx:63, 70-72`.
- **Problem:** `localTimeZone` starts as `"UTC"` and is set in an effect, so the first render formats in UTC. A 7 pm ET game (23:00Z) briefly shows the UTC time and can be labelled "Tomorrow".
- **Fix:** initialize with `useState(getLocalTimeZone)`. The component is client-only, so there is no hydration mismatch risk.

### A-12 (P3, new): preseason shows the previous season everywhere
- **Where:** `lib/NHL/server/index.ts:253` (`.lte("startDate", now)`) combined with `OpponentGamelog.tsx:107`.
- **Problem:** before regular-season start, `seasonId` is still the previous season. The schedule shows last season's final 6 games with no upcoming game; totals and drivers also show last season. Including gameType 1 (preseason) therefore never matters, because preseason games belong to a season id that is not yet selected.
- **Fix:** label the panels with the applied season, or let the schedule look ahead to the next season.

### A-13 (P3, still open plus new): search quality
- **Where:** `NameSearchBar.tsx:70-71`.
- **Problems:**
  - `ilike` without unaccent: "Stutzle" does not find "Stützle".
  - No `order`, so the 10 results are arbitrary for common substrings such as "Jack" or "Hughes", and the right player can be missing with no way to page.
  - `%` and `_` typed by the user are not escaped.
- **Fix:** order by active or current-team first, then name; use an unaccent RPC or a normalized-name column; escape wildcards.

### A-14 (P3, new): headshot fallback fetches the NHL API directly
- **Where:** `useWigoPlayerDashboard.ts:106-108`.
- **Problem:** `fetch(\`https://api-web.nhle.com/v1/player/${data.id}/landing\`)` is a direct cross-origin browser call. Elsewhere the codebase routes `api-web` through `/api/cors`. **UNVERIFIED:** whether `api-web.nhle.com` sends CORS headers. If it does not, the fallback always fails silently and the placeholder shows.
- **Fix:** use `lib/cors-fetch` or the stored `image_url` only.

### A-15 (P3, new): a bad URL id waits through retries
- **Where:** `useWigoPlayerDashboard.ts:88-96` (`.single()` throws PGRST116 for an unknown id).
- **Problem:** with the default 3 retries, a deep link with a non-existent player id waits about 7 s before showing the error.
- **Fix:** `retry: (n, e) => e.code !== "PGRST116" && n < 2`.

### A-16 (P3, new): PerGameStatsTable display details
- **Where:** `PerGameStatsTable.tsx`.
- **Problems:**
  - `:107-111`: the GP row puts total GP under the "Per/GP" header.
  - `:98`: the 84 is hard-coded; `useCurrentSeason` already exposes `numberOfGames`. It is correct for 2026-27.
  - `:153`: the raw season id is shown, e.g. "20262027".
- **Fix:** label the GP row's value as total GP, take the pace length from `numberOfGames`, and format the season as "2026-27".

### A-17 (P3, new): position codes shown raw
- **Where:** `playerBiography.ts:25-26`.
- **Problem:** the DDL enum `NHL_Position_Code` is `L`, `R`, …, so positions render as "L" and "R" rather than "LW" and "RW".
- **Fix:** map L→LW and R→RW for display.

### A-18 (P3, new): log noise
- **Where:** `fetchWigoPlayerStats.ts:584`.
- **Problem:** `console.log("Workspaceing pre-aggregated stats…")` runs on every fetch.
- **Fix:** remove it.

No other race conditions were found in group A. Every per-player and per-team read is a React Query keyed by id, so there is no stale cross-player state. Requests are not aborted on fast switching, which wastes bandwidth but does not produce wrong data.

---

## 4. Layout facts

**Page shell** (`pages/wigoCharts.tsx`, `styles/wigoCharts.module.scss`)

- **L-01: nothing renders until JavaScript measures the viewport.** `viewportWidth` starts null (`:33-39`), so server output and first paint contain no dashboard, which causes a layout shift. Crossing 768 px on resize unmounts and remounts the whole tree, losing search text and expanded rows. Crossing 1600 px switches `desktop` props and remounts sections.
- **769–1599 px:** a three-column grid, `minmax(280px,.72fr) minmax(640px,1.65fr) minmax(380px,1.05fr)`. The second row is `minmax(760px, calc(100vh-150px))`. The left column (`.leftColumnWrapper`, overflow-y auto) stacks identity, production/pace, schedule, ratings and drivers. Breakpoints at 1420, 1180 and 980 re-flow it (`:142-176`).
- **1600 px and wider:** rows `46px 260px 280px 376px`. The summary band is 260 px tall with 8 tracks: `252fr 196fr 212fr 224fr 226fr 236fr 246fr 248fr`. In order, the tracks are identity, production snapshot, pace table, schedule, ratings, team drivers, consistency, radar. Children use `height:auto; overflow: visible`, so overflow spills into the matrix row rather than clipping.

**Header** (C01)

| Component | What it renders | Fixed sizes | Data-dependent? |
|---|---|---|---|
| NameSearchBar | Input plus absolute dropdown, ≤10 options | Container height 38 px (`:263-269`); dropdown `max-height: 250px`, z-index 1000 | Option count only |
| Selected-player control | 40 px thumbnail, name, abbreviation · position, Clear | Height 38 px (`:297-302`) | Name length |

Header grid: `minmax(245px,.8fr) minmax(260px,.9fr) minmax(260px,1fr) auto`, min-height 52 px (`:228-234`).

**PlayerHeader and identity** (C02, C03)

| Width | Card | Headshot box | Logo / image sizing |
|---|---|---|---|
| Below 1600 px | Flex, min-height 130 px | 44% width, min 104 px | – |
| 1600 px and wider | Height 180 px, columns `104px | 1fr` | 104 × 142 px | – |
| Mobile | min-height 180 px | – | – |

- Logos use next/image `fill` with sizes `160/220px`; headshots use `220/320px`.
- Content is fixed apart from name length; `overflow-wrap:anywhere` applies at the wide layout.
- The bio grid (`.playerMetaGrid`) is 4 equal columns (Age, Height, Weight, Position), min-height 52 px, `white-space: nowrap`, 11 px font (13 px at wide). Its size is fixed.

**PerGameStatsTable** (C04, C05)

| Part | Below 1600 px | 1600 px and wider |
|---|---|---|
| Production snapshot | 4 tiles in 1 row (Points, Goals, Assists, SOG: total plus "/GP") | 2 × 2, 24 px numbers |
| Pace table | — | rows 20 px high, 12 px font |
| Container | min-height 316 px | `display: contents` |

- The pace table is always header plus **10 rows × 3 columns** (Metric, Per/GP, Pace/84). Placeholder rows render when there is no data, so its height is **not data-dependent**.
- At 1600 px the pace table needs about 246 px in its 260 px track (computed, not measured).
- The methodology `<details>` popover is absolute, 260 px wide, z-index 10.

**OpponentGamelog** (C06)

- Table of **3 columns** (Date, Opponent, Details) with **5–10 rows**, which is data-dependent: 5 prior games, the next game, and 4 upcoming. There are fewer rows at season start, and 6 rows after the last game.
- **L-02: the next game can be hidden below 1600 px.** The outer `.opponentLogContainer` is fixed at **150 px** with overflow hidden from the mixin (`wigoCharts.module.scss:470-476`, `:181-187`), including on mobile. Header plus rows of about 21 px fit roughly 5 rows (computed, not browser-measured). The highlighted next game is row 6 whenever 5 prior games exist, so it can be clipped. `.scheduleTable { overflow-y: auto }` has no effect on a `<table>`.
- At 1600 px and wider, the height is auto inside the 260 px band, with `white-space: normal`. A Details cell such as "W 4-3 (SO)" can wrap in about 74 px columns, so 10 rows can exceed 260 px and spill.

**TeamPerformanceDrivers** (C08–C11)

- A WigoSectionCard holding a **2 × 2 card grid**, collapsing to 1 column below 768 px. Each card shows label, value and "status · Nth pct". A source note sits underneath.
- The help popover is absolute, 280 px wide, z-index 20.
- The four-card count is fixed. Text length varies: the "PP 22.1% · PK 82.3%" value wraps in narrow tracks. In the incomplete or empty state the same 4 cards show "—", so the layout is stable.
- Below 1600 px there is no fixed height; the card sits in the scrolling left column.
