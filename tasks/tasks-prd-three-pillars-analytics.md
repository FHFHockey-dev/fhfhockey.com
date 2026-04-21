## Relevant Files

- `tasks/TASKS/prd-three-pillars-analytics.md` - Source PRD for the three-pillar implementation plan.
- `web/pages/underlying-stats/index.tsx` - Team intelligence landing that must remain the canonical ULS landing.
- `web/pages/underlying-stats/teamStats/index.tsx` - Team table explorer route whose ownership must be separated from the ULS landing.
- `web/pages/underlying-stats/playerStats/index.tsx` - Skater advanced-metrics explorer that will need first-class rating integration.
- `web/pages/underlying-stats/goalieStats/index.tsx` - Goalie advanced-metrics explorer that will need first-class goalie-rating integration.
- `web/pages/trends/index.tsx` - Trends landing that must expand to clearer team/skater/goalie movement coverage.
- `web/pages/trendsSandbox.tsx` - Sustainability lab that must expand from skater-only to team/skater/goalie coverage.
- `web/lib/navigation/analyticsSurfaceOwnership.ts` - Shared ownership contract and glossary for the ULS, Trends, and Sandbox boundaries.
- `web/lib/underlying-stats/teamLandingRatings.ts` - Current team-rating assembly layer for the ULS landing.
- `web/lib/underlying-stats/teamLandingDashboard.ts` - Current team-intelligence module composition that should remain the landing backbone.
- `web/lib/trends/trendsSurface.ts` - Shared trend-surface language and summary-card helpers.
- `web/lib/dashboard/dataFetchers.ts` - Aggregate fetch layer currently wiring trends, CTPI, SoS, projections, and sustainability.
- `web/lib/sustainability/bands.ts` - Sustainability metric contract definitions that will need entity expansion planning.
- `web/lib/sustainability/model.ts` - Sustainability model logic that should become part of the team/skater/goalie sustainability rollout.
- `web/pages/api/v1/trends/team-power.ts` - Team movement API surface for `/trends`.
- `web/pages/api/v1/trends/skater-power.ts` - Skater movement API surface for `/trends`.
- `web/pages/api/v1/trends/player-trends.ts` - Trend metric rebuild and fetch path that may need extension for parity across entities.
- `web/lib/underlying-stats/playerStatsLandingServer.ts` - Landing aggregation pipeline returning empty player and goalie rows despite persisted summary payloads.
- `web/lib/underlying-stats/playerStatsQueries.ts` - Shared player landing API contract and empty-response behavior used by player and goalie explorer routes.
- `web/lib/underlying-stats/goalieStatsServer.ts` - Goalie landing aggregation wrapper sharing the same empty landing behavior.
- `web/lib/underlying-stats/playerStatsLandingServer.test.ts` - Regression coverage for season-wide chunked landing summary fetch and aggregate-cache behavior.
- `web/sql/ratings/001_create_analytics_rating_contracts.sql` - Proposed Supabase schema contract for normalized team ratings plus first-class skater offense, skater defense, and goalie rating storage.
- `web/sql/ratings/002_create_analytics_trends_predictions_and_provenance.sql` - Proposed Supabase schema contract for parity trend storage, cross-entity sustainability, prediction outputs, market flags, and source provenance/freshness.
- `web/rules/process-task-list.mdc` - Task-processing rule set clarified so true external manual steps are distinct from routine terminal work Codex can execute directly.
- `web/lib/sources/lineupSourceIngestion.ts` - Normalized NHL.com, DailyFaceoff, and GameDayTweets lineup parsing, roster validation, source ranking, and provenance-row builders for pregame lineup ingestion.
- `web/lib/sources/lineupSourceIngestion.test.ts` - Targeted regression coverage for official/fallback lineup parsing, DailyFaceoff `Last Game` rejection, GameDayTweets classification, and lineup-source ranking.
- `web/pages/api/v1/db/update-lineup-source-provenance.ts` - Admin ingestion endpoint that snapshots scheduled-team lineup sources into `source_provenance_snapshots` using the NHL.com -> DailyFaceoff -> GameDayTweets hierarchy.
- `web/sql/ratings/003_create_historical_line_source_tables.sql` - Supabase schema for `lines_nhl`, `lines_dfo`, and `lines_gdl` historical lineup snapshot tables with explicit ordered line, pair, and goalie columns.
- `web/lib/sources/injuryStatusIngestion.ts` - Canonical injury-status normalization, returning-state detection, homepage mapping, and injury provenance builders backed by the durable player-status store.
- `web/lib/sources/injuryStatusIngestion.test.ts` - Regression coverage for injury normalization, returning-state creation, homepage display mapping, and provenance row shaping.
- `web/pages/api/v1/db/update-player-statuses.ts` - Admin ingestion endpoint that snapshots Bell injury feed results into `player_status_history` and related provenance rows.
- `web/sql/ratings/004_create_player_status_history.sql` - Supabase schema for durable `injured` and `returning` player-status history plus the current-state view.
- `web/components/HomePage/HomepageStandingsInjuriesSection.tsx` - Homepage injury module now styling persisted `injured` and `returning` states distinctly.
- `web/components/HomePage/HomepageStandingsInjuriesSection.test.tsx` - Homepage regression coverage for returning-player rendering.
- `web/styles/Home.module.scss` - Homepage injury-row color treatment for negative `injured` and positive `returning` states.
- `web/lib/sources/oddsSourceIngestion.ts` - Launch odds/props source contract, provider normalization, implied-probability shaping, and NHL fallback market builders for sportsbook ingestion.
- `web/lib/sources/oddsSourceIngestion.test.ts` - Fixture-backed regression coverage for ParlayAPI-compatible featured markets, player props, and NHL schedule fallback odds normalization.
- `web/pages/api/v1/db/update-market-prices.ts` - Admin ingestion endpoint that persists normalized game markets, player props, and provider provenance using ParlayAPI when configured, The Odds API as secondary compatibility, and NHL fallback odds otherwise.
- `web/lib/projections/queries/market-queries.ts` - Market-context fetch and consensus-summary layer that makes sportsbook inputs available to the projection runner without coupling it directly to raw odds tables.
- `web/lib/projections/queries/market-queries.test.ts` - Deterministic coverage for fresh-vs-stale market selection and summary shaping before the projection pipeline consumes sportsbook inputs.
- `web/lib/projections/run-forge-projections.ts` - Canonical projection runner now responsible for threading sportsbook market context into persisted game/player prediction outputs and model-vs-market flag generation.
- `web/pages/api/v1/sustainability/trends.ts` - Existing skater sustainability summary endpoint that will need broader entity support.
- `web/pages/api/v1/sustainability/trend-bands.ts` - Existing player trend-band endpoint that will need broader entity support.
- `web/lib/projections/goaliePipeline.ts` - Existing goalie-start/model pipeline contract that informs launch-scope prediction dependencies.
- `web/pages/index.tsx` - Current homepage injury-source integration that will need normalized `injured` and `returning` state planning.
- `web/rules/context/nhl-edge-stats-api.md` - Starting point for NHL Edge endpoint expansion during launch implementation.

### Notes

- Unit tests should typically be placed alongside the code files they are testing.
- Use the project’s existing test runner and conventions already present under `web/lib/**.test.ts` and `web/components/**.test.tsx`.
- This task list intentionally groups work by implementation phase so model, source, and route decisions are handled before deeper page rewrites.

## Tasks

- [x] 1.0 Lock route ownership, page contracts, and shared product language
  - [x] 1.1 Document the final ownership contract for `/underlying-stats`, `/underlying-stats/teamStats`, `/underlying-stats/playerStats`, `/underlying-stats/goalieStats`, `/trends`, and `/trendsSandbox` in code-facing notes or shared surface config.
  - [x] 1.2 Define shared terminology for ratings, trends, baselines, sustainability states, and source provenance so the three pillars do not drift in language.
  - [x] 1.3 Audit and remove current surface overlap where `/underlying-stats` and `/underlying-stats/teamStats` both behave like the primary team advanced-stats route.
  - [x] 1.4 Define which modules stay on the ULS landing versus move to Trends or Sandbox before any major UI rewrite begins.

- [x] 2.0 Build the launch-scope data contracts for ratings, trends, sustainability, and model outputs
  - [x] 2.1 Design or refactor Supabase tables/views for team ratings, skater offensive ratings, skater defensive ratings, and goalie ratings as first-class stored products.
  - [x] 2.2 Define persistence contracts for team/skater/goalie trend outputs so `/trends` can render parity across entity types.
  - [x] 2.3 Expand sustainability storage and contracts beyond skater-only production assumptions to support teams and goalies.
  - [x] 2.4 Define prediction-model output storage for game predictions, player predictions, market comparisons, and prop flags.
  - [x] 2.5 Add source-provenance and freshness fields needed for lineup sources, goalie starts, injuries, odds, props, and model outputs.

- [x] 3.0 Implement the lineup, goalie-start, injury, and source-ingestion foundation
  - [x] 3.1 Build the line-combination ingestion hierarchy with NHL.com lineup projections as default, DailyFaceoff as conditional fallback, and GameDayTweets `/lines` as tertiary fallback.
  - [x] 3.2 Implement DailyFaceoff page-state detection so `Last Game` pages are rejected as fallback sources.
  - [x] 3.3 Build GameDayTweets fallback parsing using tweet-link harvesting, regex extraction, keyword-group classification, and roster/player-table validation.
  - [x] 3.4 Implement official and fallback goalie-start ingestion, then reconcile external source truth with existing internal starter-probability outputs.
  - [x] 3.5 Normalize injury status into durable states including at least `injured` and `returning`, with persistence usable across pages.
  - [x] 3.6 Add internal source-ranking and freshness rules so downstream pages can choose the best available lineup, goalie, and injury inputs.

- [x] 4.0 Expand prediction, odds, and props infrastructure as launch dependencies
  - [x] 4.1 Select and integrate the launch-ready odds and props source contract for game lines and player props.
  - [x] 4.2 Build ingestion and storage for official odds, prop markets, and source freshness metadata.
  - [x] 4.3 Extend prediction-model pipelines so lineup, goalie-start, injury, and market inputs are part of the launch architecture instead of post-launch refactors.
  - [x] 4.4 Add comparison logic that identifies when internal predictions disagree with market prices in a way that can power page-level highlighting.
  - [x] 4.5 Expose a durable flag/output contract for “model-liked” props so ULS and related surfaces can render them consistently.

- [ ] 5.0 Finish the `/underlying-stats` route family around the final ULS product contract
  - [ ] 5.1 Keep `/underlying-stats` team-intelligence-first while formalizing navigation into skater and goalie advanced-metrics explorers.
  - [ ] 5.2 Add aligned date-range and relevant team-filter behavior across the ULS route family without breaking the snapshot-first landing workflow.
  - [ ] 5.3 Integrate first-class team, skater offensive, skater defensive, and goalie rating reads into the ULS route family.
  - [ ] 5.4 Preserve and refine the current team intelligence modules on the landing page, especially team meaning/explanation, SoS past/future, and process-vs-results context.
  - [ ] 5.5 Reposition `/underlying-stats/teamStats` as the raw filtered table explorer rather than a competing primary team landing.
  - [ ] 5.6 Add market/model comparison modules where they belong in the ULS current-state read without turning the landing page into a Trends-style movement dashboard.

- [ ] 6.0 Rebuild `/trends` as the movement-first surface for teams, skaters, and goalies
  - [ ] 6.1 Keep team trends on `/trends` and formalize the difference between movement/directionality and deeper team diagnosis.
  - [ ] 6.2 Expand team movement views to include rolling averages, recent directionality, risers/fallers, and hot/cold states that feel equivalent to skater movement reads.
  - [ ] 6.3 Expand goalie movement views so goalies are first-class citizens alongside teams and skaters.
  - [ ] 6.4 Refactor the route so projection/slate-triage modules support the movement workflow instead of obscuring it.
  - [ ] 6.5 Add clear hooks or placeholders for later predictions-vs-actual and candlestick implementations without blocking launch.

- [ ] 7.0 Promote `/trendsSandbox` into the sustainability meter surface for all entity types
  - [ ] 7.1 Generalize the current skater-only sustainability workflow to teams, skaters, and goalies.
  - [ ] 7.2 Define category-specific metric sets for team sustainability, skater sustainability, and goalie sustainability.
  - [ ] 7.3 Implement season-long baseline plus rolling-window expectation logic for each entity class.
  - [ ] 7.4 Build readable threshold-band and expectation-state outputs that indicate overperformance, underperformance, and stability.
  - [ ] 7.5 Surface the reasoning inputs behind each sustainability state so the lab remains interpretable and promotable into production concepts later.

- [ ] 8.0 Expand public NHL data coverage and harden supporting APIs
  - [ ] 8.1 Audit existing `nhl-edge-stats-api.md` coverage against the actual three-pillar metric needs.
  - [ ] 8.2 Discover and document additional NHL Edge/public NHL endpoints required for ratings, movement, and sustainability features.
  - [ ] 8.3 Extend API wrappers and refresh jobs for any new advanced metrics adopted into launch scope.
  - [ ] 8.4 Reconcile new metrics with existing ULS, Trends, and Sandbox contracts so upstream shape changes do not fragment the route family.

- [ ] 9.0 Verify the integrated rollout and backfill missing tests
  - [ ] 9.1 Add targeted tests around source selection, fallback behavior, roster validation, and source-provenance rules where the logic is deterministic.
  - [ ] 9.2 Add targeted tests around new rating/trend/sustainability contract builders and route-level data assembly.
  - [ ] 9.3 Run focused verification on the final route family to confirm ownership boundaries, entity parity, and launch-scope dependencies are all wired together coherently.

- [ ] 10.0 NEW: Restore non-empty player and goalie explorer landing aggregates
  - [x] 10.1 Trace why `/api/v1/underlying-stats/players` and `/api/v1/underlying-stats/goalies` return empty `rows` while `games` and `nhl_api_game_payloads_raw` contain current-season summary data.
  - [x] 10.2 Confirm whether the failure lives in persisted-summary fetch, summary-row filtering, aggregate-cache reuse, or row-to-API aggregation.
  - [x] 10.3 Patch the underlying aggregation path so default player and goalie landing queries return populated rows for the current season again.
  - [x] 10.4 Add targeted regression coverage for the fixed player/goalie landing aggregate path because this is deterministic backend logic, not presentation-only behavior.

- [x] 11.0 NEW: Restart local Next dev server and re-verify season-wide player and goalie explorer routes
  - [x] 11.1 Restart the `web` Next dev server so the patched landing aggregation module and cleared in-memory aggregate cache are both active.
  - [x] 11.2 Re-check `/api/v1/underlying-stats/players` and `/api/v1/underlying-stats/goalies` for `20252026` season-wide five-on-five requests and confirm they now return non-empty rows.
  - [x] 11.3 Re-check `/underlying-stats/playerStats` and `/underlying-stats/goalieStats` in the browser and confirm the empty-state copy is gone for the default season-wide landing view.

- [ ] 12.0 NEW: Extend the pregame source hierarchy with GameDayTweets goalie/news feeds and a dedicated injury-state store
  - [ ] 12.1 Add `https://www.gamedaytweets.com/goalies` as the goalie-start fallback that sits behind DailyFaceoff and ahead of the internal goalie-start probability model.
  - [ ] 12.2 Evaluate and ingest `https://www.gamedaytweets.com/news` into the injury/news pipeline for returns, transactions, call-ups, and other non-lineup updates.
  - [x] 12.3 Design the separate injury-state database contract needed for `injured`, `returning`, and related status changes instead of overloading the line-history tables.

- [ ] 13.0 NEW: Provide live external odds-provider verification once a ParlayAPI key is available
  - [ ] 13.1 Add `PARLAY_API_KEY` to the runtime environment used by `web/pages/api/v1/db/update-market-prices.ts`.
  - [ ] 13.2 Run `/api/v1/db/update-market-prices` against a live NHL slate and confirm ParlayAPI featured markets upsert with `source_rank = 1`.
  - [ ] 13.3 Confirm at least one live prop market lands in `prop_market_prices_daily` and player matching succeeds for the target slate.
