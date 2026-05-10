# The FORGE System: Explained Like You're 5 (Merged Summary)

Imagine you have a super-smart robot friend named **FORGE**.

FORGE's job is to guess what might happen in upcoming hockey games, then later check if its guesses were good.

This file combines:
- the original simple FORGE explanation
- the full `FORGE.tsx` ecosystem audit (APIs, helpers, pipeline jobs, tests, and schema files)

## The Big Idea (ELI5)
Think of FORGE like a **hockey prediction factory**:
- Some workers collect fresh hockey facts.
- Some workers clean and organize the facts.
- Some workers make predictions.
- Some workers grade the predictions later.
- The website shows you the results in nice cards and charts.

## The Face (What You See)

### `web/pages/FORGE.tsx`
This is the FORGE page you visit.

It:
- asks for skater projections
- asks for goalie projections
- asks for FORGE accuracy history
- asks for a goalie game strip ("today's slate")
- shows filters (search/team/position)
- shows uncertainty ranges like floor / typical / ceiling
- lets you switch between **Skaters** and **Goalies**

### `web/styles/Forge.module.scss`
This is the page's outfit and makeup (colors, spacing, badges, charts, goalie ticker styles).

### `web/lib/teamsInfo.ts`
This is the team encyclopedia (team IDs, names, abbreviations, colors, logo info).

## The Messengers (APIs that bring data to the page)

### `web/pages/api/v1/forge/players.ts`
The skater waiter.
- Fetches skater projections from FORGE tables.
- If today's data is missing, it finds the most recent day that has data.
- Returns goals/assists/points/shots/etc. plus uncertainty.

### `web/pages/api/v1/forge/goalies.ts`
The goalie waiter.
- Fetches goalie projections from FORGE tables.
- Includes extra model details like confidence, volatility, risk, recommendation.
- Includes diagnostics notes and calibration hints (a mini report card for the goalie model).
- Normalizes likely-starter win probabilities so matchup totals make sense.

### `web/pages/api/v1/forge/accuracy.ts`
The report-card waiter.
- Returns recent accuracy trend points for `overall`, `skater`, or `goalie`.
- The page uses this to draw the line chart.

### `web/pages/api/v1/start-chart.ts`
The goalie-slate waiter.
- Builds the "Today's Slate" strip shown in goalie mode.
- Adds team ratings and goalie start-probability bars.

### Shared helpers used by these APIs
- `web/pages/api/v1/projections/_helpers.ts` - date validation + "find latest succeeded FORGE run"
- `web/lib/formatDurationMmSs.ts` - formats time like `MM:SS`
- `web/lib/supabase/server.ts` - server-side database client

## The Brains (Main FORGE logic and math)

### `web/lib/projections/run-forge-projections.ts` (The Boss / Big Brain)
This is the big manager file.

It:
- loads the inputs FORGE needs
- applies skater and goalie logic
- uses uncertainty math
- reconciles totals so numbers add up
- writes predictions into FORGE tables

### `web/lib/projections/goaliePipeline.ts` (The Checklist Boss)
This file defines the official FORGE stage order (what should happen first, second, third...).

It lists the pipeline stages and the tables they create.

### `web/lib/projections/goalieModel.ts` (The Goalie Math Wizard)
This file estimates goalie outcomes like:
- projected saves
- projected goals allowed
- win probability
- shutout probability
- blowup risk (bad-outcome risk)
- volatility and confidence tiers

### `web/lib/projections/reconcile.ts` (The Peacemaker)
If player totals and team totals disagree, this file fixes the mismatch so everything adds up properly.

### `web/lib/projections/uncertainty.ts` (The Fortune Teller)
This file creates uncertainty ranges (floor / typical / ceiling) using simulation/quantile math.

### Accuracy and scoring helpers
- `web/lib/projections/accuracy/fantasyPoints.ts` - turns stats into fantasy points + computes accuracy score
- `web/lib/projectionsConfig/fantasyPointsConfig.ts` - default fantasy scoring weights

## How FORGE Gets Its Ingredients (Upstream pipeline jobs)

These are the factory workers that prepare the data before FORGE predicts anything.

### 1) Freshness jobs (fill the toy box)
- `web/pages/api/v1/db/update-games.ts` - updates the games schedule table
- `web/pages/api/v1/db/update-teams.ts` - updates teams and team-season links
- `web/pages/api/v1/db/update-players.ts` - updates players and rosters

### 2) Line combinations (who skates together)
- `web/pages/api/v1/db/update-line-combinations/index.ts` - batch updater
- `web/pages/api/v1/db/update-line-combinations/[id].ts` - one-game line combo builder

### 3) Input ingest (raw game facts)
- `web/pages/api/v1/db/ingest-projection-inputs.ts` - runs ingest over date ranges
- `web/lib/projections/ingest/pbp.ts` - fetches play-by-play and stores it
- `web/lib/projections/ingest/shifts.ts` - fetches shift charts and computes TOI totals
- `web/lib/projections/ingest/nhleFetch.ts` - NHL fetch with retries/timeouts
- `web/lib/projections/ingest/time.ts` - time parsing helpers

### 4) Derived input builders (clean and shape the facts)
- `web/pages/api/v1/db/build-projection-derived-v2.ts` - orchestrates derived builds
- `web/lib/projections/derived/buildStrengthTablesV2.ts` - builds skater/team strength tables
- `web/lib/projections/derived/buildGoalieGameV2.ts` - builds goalie game history table
- `web/lib/projections/derived/situation.ts` - translates NHL situation codes into ES/PP/PK

### 5) Goalie starter priors (who is likely to start)
- `web/pages/api/v1/db/update-goalie-projections-v2.ts` - estimates goalie start probabilities and goalie prior metrics

### 6) Run FORGE predictions
- `web/pages/api/v1/db/run-projection-v2.ts` - runs the FORGE projection engine and writes outputs

### 7) Grade FORGE predictions
- `web/pages/api/v1/db/run-projection-accuracy.ts` - computes accuracy and calibration diagnostics

### Shared admin/cron support
- `web/lib/cron/withCronJobAudit.ts` - logs cron job outcomes
- `web/utils/adminOnlyMiddleware.ts` - protects admin endpoints and attaches DB client
- `web/lib/supabase/index.ts` - public/token Supabase helpers

## The Goalie Strip's Extra Helpers (used by `start-chart`)
- `web/utils/fetchCurrentSeason.ts` - gets current season (internal API first, NHL fallback)
- `web/lib/cors-fetch.ts` - browser/server fetch wrapper
- `web/pages/api/v1/season.ts` - season endpoint
- `web/lib/NHL/server/index.ts` - NHL server-side helper functions
- `web/lib/NHL/types.ts` - NHL data type definitions
- `web/lib/teamRatingsService.ts` - team rating loader with caching

## Extra Helpers Used by Line Combination Jobs
- `web/components/LinemateMatrix/index.tsx` - reusable TOI extraction utilities
- `web/components/LinemateMatrix/utilities.ts` - pairwise TOI math
- `web/utils/getPowerPlayBlocks.ts` - builds PP time blocks from penalties/goals
- `web/utils/groupBy.ts` - groups things into buckets
- `web/utils/setDifference.ts` - compares sets to find what's missing

## Tests (the safety checks)
- `web/pages/FORGE.test.tsx` - checks goalie-mode UI pieces render correctly
- `web/pages/__snapshots__/FORGE.test.tsx.snap` - saved picture of expected FORGE UI markup
- `web/pages/api/v1/forge/goalies.test.ts` - checks goalie API response shape and metadata
- `web/pages/api/v1/forge/__snapshots__/goalies.test.ts.snap` - saved picture of expected goalie API payload

## Database and Schema Files (where FORGE stores things)
- `web/rules/context/forge-tables.md` - FORGE table definitions (source of truth doc)
- `migrations/20251224_rename_projection_tables_to_forge.sql` - renamed old projection tables to `forge_*`
- `migrations/20251227_add_goalie_win_shutout_and_accuracy_stats.sql` - added goalie win/shutout fields + per-stat accuracy table
- `migrations/20260208_add_projection_calibration_snapshots.sql` - added daily calibration snapshot table

## The Full FORGE Pipeline (Layman's version)

1. **Stock the kitchen**
   - Update teams, players, and game schedules so FORGE knows who exists and who is playing.

2. **Figure out who plays together**
   - Build line combinations so FORGE has context for skaters and team roles.

3. **Collect raw game evidence**
   - Download play-by-play and shift charts from NHL data sources.

4. **Turn raw logs into useful ingredients**
   - Build strength tables (skater/team/goalie game-level summaries).

5. **Guess which goalie starts**
   - Build goalie start probabilities and goalie priors.

6. **Run the FORGE brain**
   - Predict skater, team, and goalie outcomes.
   - Add uncertainty ranges (floor / typical / ceiling).
   - Reconcile totals so they all fit together.

7. **Save the predictions**
   - Store the outputs in FORGE tables (`forge_player_projections`, `forge_goalie_projections`, etc.).

8. **Grade the predictions later**
   - Compare predictions with real results.
   - Save accuracy scores and calibration snapshots.

9. **Serve the results to the page**
   - `/api/v1/forge/players`, `/api/v1/forge/goalies`, and `/api/v1/forge/accuracy` bring the data to the frontend.

10. **Show humans the story**
   - `web/pages/FORGE.tsx` displays cards, filters, uncertainty ranges, and trend charts.

## One-Sentence Mental Model
FORGE is a hockey prediction factory where data-collector workers, math workers, and report-card workers team up so the FORGE webpage can show useful predictions in simple cards.

## FORGE Full Refresh Itinerary (Endpoint Order of Operations)
Use this order when you want to "fix" or fully refresh FORGE data so frontend outputs are correct and consistent.

### A) Refresh upstream source tables FORGE depends on
These feed model features used by the canonical FORGE runner in `run-forge-projections.ts`:

1. `/api/v1/db/update-teams`
2. `/api/v1/db/update-players`
3. `/api/v1/db/update-games`
4. `/api/v1/db/update-wgo-skaters?action=all`
5. `/api/v1/db/update-wgo-goalies`
6. `/api/v1/db/update-nst-gamelog?runMode=incremental`
7. `/api/Teams/nst-team-stats?date=all`
8. `/api/v1/db/update-rolling-player-averages?fullRefresh=true&fullRefreshMode=rpc_truncate&playerConcurrency=4&upsertConcurrency=1&upsertBatchSize=400`

Notes:
- Step 8 is critical because FORGE skater projections read `rolling_player_game_metrics`.
- If you want an even safer write profile, reduce `playerConcurrency` to `2` and `upsertBatchSize` to `300`.

### B) Refresh FORGE pipeline tables in dependency order
Run these in order for the target date or date range:

1. `/api/v1/db/update-line-combinations`
2. `/api/v1/db/ingest-projection-inputs?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`
3. `/api/v1/db/build-projection-derived-v2?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`
4. `/api/v1/db/update-goalie-projections-v2`
5. `/api/v1/db/run-projection-v2?date=YYYY-MM-DD&horizonGames=1`
6. `/api/v1/db/run-projection-accuracy?actualDate=YYYY-MM-DD`

Notes:
- Use `horizonGames=1` for single-game projections shown in most FORGE player views.
- If running a range, execute steps 2-6 by date window/chunks from oldest to newest.

### C) Verification checkpoints after refresh
Before trusting UI output:

1. Confirm latest succeeded run exists in `forge_runs` for target date.
2. Confirm non-zero rows for that run/date in:
   - `forge_player_projections` with `horizon_games=1`
   - `forge_team_projections` with `horizon_games=1`
   - `forge_goalie_projections` with `horizon_games=1`
3. Confirm `/api/v1/forge/players?date=YYYY-MM-DD&horizon=1` returns expected row count and sane `sog` values.
4. Confirm `/api/v1/forge/goalies?date=YYYY-MM-DD&horizon=1` returns rows with starter probabilities.
