# FORGE Ecosystem Audit (ELI5)

## What this is
This is a file-by-file map of the **`web/pages/FORGE.tsx` ecosystem**: page UI, FORGE read APIs, upstream FORGE pipeline jobs, and key helpers/utilities those files rely on.

## FORGE pipeline in kid terms
1. `update-games`, `update-teams`, `update-players` fill the toy box with fresh teams, players, and schedules.
2. `update-line-combinations` figures out who is usually skating together.
3. `ingest-projection-inputs` downloads play-by-play and shift charts so we know what happened second-by-second.
4. `build-projection-derived-v2` turns raw logs into cleaner “strength” tables.
5. `update-goalie-projections-v2` estimates who is likely to start in net.
6. `run-projection-v2` runs the FORGE brain to predict player/team/goalie outcomes.
7. `run-projection-accuracy` grades yesterday’s guesses and stores report cards.
8. `/api/v1/forge/*` endpoints serve those predictions and grades to the webpage.
9. `FORGE.tsx` fetches those endpoints and paints cards/charts for humans.
10. Tests/snapshots check that this all still looks and responds correctly.

## File-by-file ELI5 summaries

### A) FORGE page and UI behavior
- `web/pages/FORGE.tsx` - The main FORGE screen; it fetches skater/goalie projections, accuracy, and game-strip data, then renders filters, cards, and uncertainty ranges.
- `web/styles/Forge.module.scss` - The costume closet for the FORGE page (colors, spacing, badges, chart styling, goalie ticker visuals).
- `web/lib/teamsInfo.ts` - Big team dictionary (name, ID, abbreviations, colors) used to match team IDs to friendly labels/logos/colors.

### B) Read APIs used by FORGE.tsx
- `web/pages/api/v1/forge/players.ts` - Returns skater projections for a date/run, with fallback to the latest date that actually has player rows.
- `web/pages/api/v1/forge/goalies.ts` - Returns goalie projections plus model metadata, diagnostics, calibration hints, and matchup-level win-probability normalization.
- `web/pages/api/v1/forge/accuracy.ts` - Returns recent accuracy trend points (overall/skater/goalie) for charting.
- `web/pages/api/v1/start-chart.ts` - Builds the “today’s slate” strip (games, team ratings, projected starting-goalie bars).
- `web/pages/api/v1/projections/_helpers.ts` - Shared query parsing/date validation and “find latest succeeded FORGE run” helper logic.
- `web/lib/formatDurationMmSs.ts` - Tiny helper that formats elapsed job/API time like `MM:SS`.
- `web/lib/supabase/server.ts` - Server-only Supabase client used by FORGE API routes and pipeline jobs.

### C) Start-chart dependency chain used by FORGE goalie strip
- `web/utils/fetchCurrentSeason.ts` - Gets current season from internal API first, NHL API second.
- `web/lib/cors-fetch.ts` - Small fetch wrapper that uses direct fetch on server, `/api/cors` on browser.
- `web/pages/api/v1/season.ts` - Internal season endpoint used by `fetchCurrentSeason`.
- `web/lib/NHL/server/index.ts` - Server NHL data layer (season/teams/players/schedule helpers).
- `web/lib/NHL/types.ts` - Type shapes for NHL entities (season, player, boxscore, schedules, etc.).
- `web/lib/teamRatingsService.ts` - Loads cached team power ratings for a date, with fallback handling for schema/table differences.

### D) Pipeline orchestrator and stage map
- `web/lib/projections/goaliePipeline.ts` - Declares the official FORGE stage order and what each stage produces.
- `web/pages/api/v1/db/run-projection-v2.ts` - Main projection runner endpoint (range/chunk/time-budget/preflight handling + output summary).
- `web/pages/api/v1/db/build-projection-derived-v2.ts` - Builds the derived FORGE input tables used before running projections.
- `web/pages/api/v1/db/run-projection-accuracy.ts` - Computes and stores accuracy/calibration diagnostics after projection runs.
- `web/lib/cron/withCronJobAudit.ts` - Middleware that logs cron job outcomes into `cron_job_audit`.
- `web/lib/supabase/index.ts` - Browser/public Supabase client plus token-based client creation used by admin middleware/auditing paths.

### E) Core FORGE math/model files
- `web/lib/projections/runProjectionV2.ts` - The large “brain” file that combines context, usage, reconciliation, uncertainty, and goalie modeling to write FORGE projection outputs.
- `web/lib/projections/reconcile.ts` - Ensures player-level totals add up to team-level targets (TOI/shots consistency).
- `web/lib/projections/uncertainty.ts` - Simulation/quantile helpers that generate floor/typical/ceiling uncertainty bands.
- `web/lib/projections/goalieModel.ts` - Goalie-specific model for save%, GA, saves, win/shutout probability, volatility, and recommendation tiers.
- `web/lib/projections/accuracy/fantasyPoints.ts` - Converts stats into fantasy points and computes simple accuracy scores.
- `web/lib/projectionsConfig/fantasyPointsConfig.ts` - Default fantasy point scoring weights for skaters and goalies.

### F) Derived input builders and ingest helpers
- `web/lib/projections/derived/buildStrengthTablesV2.ts` - Builds player and team game-strength tables from shifts + play-by-play.
- `web/lib/projections/derived/buildGoalieGameV2.ts` - Builds goalie game-history table (shots/goals/saves per game-goalie-team).
- `web/lib/projections/derived/situation.ts` - Interprets NHL situation codes to classify ES/PP/PK strength states.
- `web/lib/projections/ingest/time.ts` - Time parsing/format helpers for `MM:SS` clock values.
- `web/pages/api/v1/db/ingest-projection-inputs.ts` - Pulls and upserts play-by-play + shift totals for date ranges.
- `web/lib/projections/ingest/pbp.ts` - Fetches NHL play-by-play and upserts normalized `pbp_games`/`pbp_plays`.
- `web/lib/projections/ingest/shifts.ts` - Fetches shift charts and computes ES/PP/PK TOI totals per player-game.
- `web/lib/projections/ingest/nhleFetch.ts` - NHL fetch helper with timeout/retry behavior.

### G) Upstream freshness/admin stage files
- `web/pages/api/v1/db/update-goalie-projections-v2.ts` - Builds goalie start-probability priors from season/L10 goalie logs.
- `web/pages/api/v1/db/update-line-combinations/index.ts` - Batch runner to update line combinations for unprocessed games.
- `web/pages/api/v1/db/update-line-combinations/[id].ts` - Computes line combinations for one game and stores forward/defense/goalie groups.
- `web/pages/api/v1/db/update-games.ts` - Refreshes games table from NHL schedule data.
- `web/pages/api/v1/db/update-teams.ts` - Refreshes teams/team-season membership with safety checks.
- `web/pages/api/v1/db/update-players.ts` - Refreshes players + rosters from NHL roster endpoints.
- `web/utils/adminOnlyMiddleware.ts` - Protects admin endpoints and injects authenticated Supabase client.
- `web/lib/NHL/base.ts` - Low-level wrappers around NHL web/stats REST endpoints.

### H) Line-combination helper dependencies (used by update-line-combinations)
- `web/components/LinemateMatrix/index.tsx` - Contains TOI data extraction utilities reused by line-combination update jobs.
- `web/components/LinemateMatrix/utilities.ts` - Pairwise TOI computation helpers.
- `web/utils/getPowerPlayBlocks.ts` - Builds PP time blocks from penalties/goals for TOI context logic.
- `web/utils/groupBy.ts` - Generic array grouping helper.
- `web/utils/setDifference.ts` - Small set subtraction helper.

### I) Tests and snapshots for FORGE behavior
- `web/pages/FORGE.test.tsx` - UI test proving goalie mode renders disclosure, starter drivers, and slate strip correctly.
- `web/pages/__snapshots__/FORGE.test.tsx.snap` - Snapshot of expected FORGE goalie-mode markup.
- `web/pages/api/v1/forge/goalies.test.ts` - API test for goalie response shape, metadata, diagnostics, and probability normalization.
- `web/pages/api/v1/forge/__snapshots__/goalies.test.ts.snap` - Snapshot of expected goalie API payload.

### J) Schema and migration files that define FORGE storage
- `web/rules/forge-tables.md` - Source-of-truth SQL table definitions for FORGE tables.
- `migrations/20251224_rename_projection_tables_to_forge.sql` - Renames old v2 projection tables to `forge_*`.
- `migrations/20251227_add_goalie_win_shutout_and_accuracy_stats.sql` - Adds goalie win/shutout projection fields + per-stat accuracy table.
- `migrations/20260208_add_projection_calibration_snapshots.sql` - Adds daily calibration snapshot table for probability/interval diagnostics.

## Simple mental model
FORGE is a factory:
- Upstream jobs collect raw hockey facts.
- Derived jobs clean and shape those facts.
- Projection jobs make educated guesses.
- Accuracy jobs grade the guesses.
- Read APIs serve the results.
- `FORGE.tsx` shows it in a human-friendly way.
