# Audit packet: Lines / TOI / PP units

Master entries M-LINE-001 to M-LINE-043 (43 of 43 in this family). Built from the merged Opus and Codex inventories; see [../MASTER.md](../MASTER.md) and [../MERGE-NOTES.md](../MERGE-NOTES.md).

How to read: each entry gives both inventories' descriptions side by side. **Conflicts** are places where the two descriptions disagree; they are unresolved. **Leads** are Opus red flags and Codex unknowns: observations to check, not audited findings. Tags are keyword heuristics. Line numbers were valid when each inventory was written on 2026-11-10 (Opus at d31dcb33f, Codex at 11e4192d3); re-check against the current checkout.

| ID | Name | Match | Conflicts | Leads |
|---|---|---|---:|---:|
| M-LINE-001 | view vw_pp_unit_share_recent | Both | 0 | 4 |
| M-LINE-002 | fn refresh_player_lineup_deployment_tallies | Both | 0 | 4 |
| M-LINE-003 | DRM line/pair builder with comboPoints | Both | 0 | 2 |
| M-LINE-004 | Player lineup deployment tallies (line/pair/PP slot shares) | Both | 0 | 3 |
| M-LINE-005 | Beat-reporter candidate confidence and team-conflict share | Both | 0 | 2 |
| M-LINE-006 | American odds to implied probability | Both | 0 | 2 |
| M-LINE-007 | Tweet parse card confidence score (swipe trainer) | Both | 0 | 2 |
| M-LINE-008 | Date-range linemate aggregation (DRM) and %TOI-with | Both | 0 | 3 |
| M-LINE-009 | Linemate shared-TOI matrix (game) and greedy line clustering | Both | 0 | 4 |
| M-LINE-010 | Shift-chart replay TOI, game clock axis and shared-interval matrix | Both | 0 | 2 |
| M-LINE-011 | Exact-five PP units (observed 5v4/5v3 groups) | Both | 0 | 3 |
| M-LINE-012 | PP unit assignment + per-player PP usage metrics (powerPlayCombinatio… | Both | 0 | 6 |
| M-LINE-013 | generated column team_unit_toi.unit_share | Opus only | 0 | 0 |
| M-LINE-014 | Date Range Matrix cell shade from shared TOI% | Opus only | 0 | 3 |
| M-LINE-015 | Tweet trainer confidence tone bands (component copy) | Opus only | 0 | 1 |
| M-LINE-016 | Social share deployment change (TOI/GP L5 vs season, line and PP unit… | Opus only | 0 | 3 |
| M-LINE-017 | Decisions reference shadow adapter: token reservation, USD budget and… | Opus only | 0 | 2 |
| M-LINE-018 | Tweet identity resolution evaluation grading (baseline vs determinist… | Opus only | 0 | 1 |
| M-LINE-019 | Per-game TOI and power-play TOI share series | Opus only | 0 | 2 |
| M-LINE-020 | Shift-chart overlap, percent-TOI-with and greedy line/pair assignment | Opus only | 0 | 3 |
| M-LINE-021 | Power-play unit assignment and PP time from play-by-play | Opus only | 0 | 3 |
| M-LINE-022 | Line promotions/demotions and line-card goalie stats | Opus only | 0 | 3 |
| M-LINE-023 | Source authority tier weights | Opus only | 0 | 1 |
| M-LINE-024 | Line claim decision: context, certainty and binding | Opus only | 0 | 0 |
| M-LINE-025 | PP unit carry-forward, staleness and swaps | Opus only | 0 | 1 |
| M-LINE-026 | Entry lineup selection (context rank > authority > recency) and freeze | Opus only | 0 | 1 |
| M-LINE-027 | Injury attribute confidence + severity tier | Opus only | 0 | 0 |
| M-LINE-028 | First-arrival winner per lineup signal bucket | Opus only | 0 | 1 |
| M-LINE-029 | Tweet claim extraction precision/recall (prospective evaluation) | Opus only | 0 | 0 |
| M-LINE-030 | News inference auto-publish confidence thresholds | Opus only | 0 | 1 |
| M-LINE-031 | Shift-chart pair shared TOI and %TOI-with (route) | Opus only | 0 | 4 |
| M-LINE-032 | PP TOI % per game chart bands | Opus only | 0 | 1 |
| M-LINE-033 | PowerPlayCombos unit card PP stats | Opus only | 0 | 1 |
| M-LINE-034 | Player TOI / PP TOI share series (/api/toi) | Opus only | 0 | 1 |
| M-LINE-035 | Penalty PP timeframes (legacy per-penalty blocks + details) | Opus only | 0 | 4 |
| M-LINE-036 | Power-play blocks (manpower advantage timeline) | Opus only | 0 | 3 |
| M-LINE-037 | Per-player ES/PP/PK TOI from shifts (strengthForTeam) | Opus only | 0 | 2 |
| M-LINE-038 | PBP situation timeline per period | Opus only | 0 | 2 |
| M-LINE-039 | Event on-ice attribution + team strength state | Opus only | 0 | 1 |
| M-LINE-040 | Shift interval normalization + stint sweep | Opus only | 0 | 2 |
| M-LINE-041 | team_unit_toi 5v5 forward-line / D-pair pooled TOI | Opus only | 0 | 4 |
| M-LINE-042 | team_unit_toi power-play units (from powerPlayCombinations) | Opus only | 0 | 2 |
| M-LINE-043 | team_unit_toi shift cleanup + nightly planning/completeness | Opus only | 0 | 1 |

## M-LINE-001 view vw_pp_unit_share_recent

- **Match:** Both; Opus LINE-002; Codex sql-pp-recent
- **Purpose:** 30-day PP1 probability, PP TOI share and pct-of-PP per player
- **Where:** `supabase/migrations/20260716112908_production_schema_baseline.sql:26405 (vw_pp_unit_share_recent)`; `supabase/migrations/20260716112908_production_schema_baseline.sql:26405 vw_pp_unit_share_recent`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: per game; generation: legacy, current
- **Opus view (LINE-002):**
  - Method: team_pp_toi = SUM(player PPTOI) per game-team; pct_share = percentageOfPP/100 if >1 else as-is; last 30 days (CURRENT_DATE): p_pp1 = AVG(unit=1); pp_share_recent = AVG(player PPTOI/team_pp_toi); pp_toi60_recent = 3600*SUM(player PPTOI)/SUM(team_pp_toi); pct_share_avg = AVG(pct_share).
  - Inputs/units: PP TOI seconds; percent 0-100 or fraction; sources: powerPlayCombinations, lineCombinations, games, players, teams
  - Output scale: probability 0-1; share 0-1; writes: —
  - Status: legacy/dead — no reader in web/ or functions/
  - Consumers: no reader found
- **Codex view (sql-pp-recent, calculation, location; Codex family 'SQL PP context'):** vw_pp_unit_share_recent
  - Purpose: Summarize recent PP unit assignments and usage.
  - Inputs/units: powerPlayCombinations player seconds/unit/percentageOfPP, team resolved from line combinations and schedules; past30 calendar days
  - Output scale: p_pp1=mean(unit==1); pp_share_recent=mean(playerPPTOI/sum roster PPTOI); pp_toi60_recent=3600×sum(playerPPTOI)/sum(teamPPTOI); pct_share_avg mean normalized percentageOfPP where >1 divides100.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex sql-pp-recent): SQL definition; recorded denominator is sum of participating player PP seconds, distinct from explicit team PP exposure contract.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `{"discovered_not_run": []}`
- **Leads (not audited):**
  - (opus) team_pp_toi sums all skaters' PP seconds (~5x clock PP time), so pp_share_recent maxes near 0.2
  - (opus) pp_toi60_recent = 3600*player/pooled-team seconds is a scaled share, not a per-60 rate
  - (opus) percentageOfPP scale detected heuristically (>1 => percent)
  - (codex:sql-pp-recent) Definition exists locally; applied migration/live view shape, data freshness and runtime consumer use unknown.

## M-LINE-002 fn refresh_player_lineup_deployment_tallies

- **Match:** Both; Opus LINE-003; Codex sql-line-deployment
- **Purpose:** Counts games each player spent in each forward line slot, D pair slot and PP unit; share within deployment group
- **Where:** `supabase/migrations/20260716112908_production_schema_baseline.sql:2866 (refresh_player_lineup_deployment_tallies)`; `web/supabase/migrations/20260629020121_create_player_lineup_deployment_tallies.sql:68 (original)`; `web/supabase/migrations/20260629020121_create_player_lineup_deployment_tallies.sql:68 refresh_player_lineup_deployment_tallies; supabase/migrations/20260716112908_production_schema_baseline.sql:2866 refresh_player_lineup_deployment_tallies`
- **Tags (heuristic):** percent scale: fraction 0-1; generation: current
- **Opus view (LINE-003):**
  - Method: Forwards: line_number = floor((ordinality-1)/3)+1 for first 12 forwards, slot from player's roster position (LW/C/RW). Defense: pair = floor((ord-1)/2)+1 for first 6, LD if odd ordinal else RD, lines 1-3. PP: unit 1/2, one row per player-game (lowest unit). games = count distinct games; total_games = SUM(games) over (player,season,game_type,group); share = round(games/total_games,4). Regular season+playoffs (type 2,3).
  - Inputs/units: game counts; sources: lineCombinations, powerPlayCombinations, games, players
  - Output scale: share 0-1 (4 dp); writes: player_lineup_deployment_tallies (delete+insert)
  - Status: live — invoked by web/pages/api/v1/db/update-lineup-deployment-tallies.ts
  - Consumers: web/pages/api/v1/db/update-lineup-deployment-tallies.ts; web/pages/stats/player/[playerId].tsx; web/lib/draft-ranker/discoveryServer.ts; web/components/StarterBoardPlayerDetails.tsx
- **Codex view (sql-line-deployment, calculation, location; Codex family 'SQL usage aggregates'):** player_lineup_deployment_tallies.share
  - Purpose: Build player line/pair/PP percentage-grid history.
  - Inputs/units: Line array ordinalities, canonical position, PP unit, game/season/type/team identities
  - Output scale: Forward line=floor((ordinality−1)/3)+1; defense pair=floor((ordinality−1)/2)+1, side parity; distinct games/cell; total games within player/season/type/deployment group; share=games/totalGames. Share rounded4; total_games is sum of cell game counts within the deployment group.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
- **Audit context:**
  - Intent (Opus): supabase/migrations/20260716112908_production_schema_baseline.sql:3079 COMMENT 'Refreshes player lineup deployment tallies from lineCombinations and powerPlayCombinations'
  - Intended contract (Codex sql-line-deployment): Table/share comments explicitly define cell share within player/season/game_type/deployment_group denominator.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/__tests__/pages/api/v1/db/update-lineup-deployment-tallies.test.ts`; `{"discovered_not_run": []}`
- **Leads (not audited):**
  - (opus) forward slot label comes from players.position not line-card position, so a C playing wing is counted as C on that line; a line can get two Cs
  - (opus) LD/RD assigned purely by ordinal parity
  - (opus) total_games sums slot games within a group, so a player moved between lines in one game is not possible but a player listed in both F and D groups is counted separately
  - (codex:sql-line-deployment) Definition exists locally; applied migration/live view shape, data freshness and runtime consumer use unknown.

## M-LINE-003 DRM line/pair builder with comboPoints

- **Match:** Both; Opus LINE-012; Codex MISC-MATRIX
- **Purpose:** Rank players by weighted line-slot frequency then greedily group into lines/pairs by mutual shared TOI.
- **Where:** `web/components/DateRangeMatrix/lineCombinationHelper.ts:15 (calculateLinesAndPairs)`; `web/components/DateRangeMatrix/fetchAggregatedData.ts:1106 buildAggregatedPlayers`; `web/components/DateRangeMatrix/lineCombinationHelper.ts:11 compareCanonicalPlayerOrder`
- **Tags (heuristic):** percent scale: 0-100; denominators: per game; generation: current
- **Opus view (LINE-012):**
  - Method: comboPoints = 4*L1 + 3*L2 + 2*L3 + 1*L4 + 3*P1 + 2*P2 + 1*P3 appearances; sort desc (tie by id); pivot = first unassigned, add top (groupSize-1) by mutualSharedToi (fallback percentToiWith); 3 F per line, 2 D per pair; line-combination mode caps 4 lines / 3 pairs.
  - Inputs/units: counts; seconds; sources: shift_charts (aggregated)
  - Output scale: ordinal groups; writes: —
  - Status: live — /drm
  - Consumers: DateRangeMatrix LinePairGrid
- **Codex view (MISC-MATRIX, calculation, location; Codex family 'Other product calculations'):** Date-range shared-TOI percentages, ATOI and line ordering
  - Purpose: Aggregate observed relationships and describe player role over a selected team-game window.
  - Inputs/units: Player/shared shift seconds, game duration seconds, observed games, line/pair occurrence counts.
  - Output scale: Shared TOI / player TOI *100; shared / game length *100; ATOI=total TOI/GP; combo points weight lines 4/3/2/1 and pairs 3/2/1.
  - Version/status: Local matrix aggregation. Production deployment/active database state not checked.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex MISC-MATRIX): Fixed team last-N window; mutual shared seconds retained separately from asymmetric percentage denominator.
  - External references: Daily Faceoff / LeftWingLock line usage frequency
  - Fixtures/test data: none listed
  - Tests: `web/__tests__/pages/drm.test.tsx`; `web/components/DateRangeMatrix/fetchAggregatedData.test.ts`; `web/components/DateRangeMatrix/lineCombinationHelper.test.ts`
- **Leads (not audited):**
  - (opus) magic weights 4/3/2/1 and 3/2/1; mutualSharedToi (seconds) and percentToiWith (percent) are mixed as fallback sort keys
  - (codex:MISC-MATRIX) No mathematical accuracy or fitness assessment performed. Tests listed, not run.

## M-LINE-004 Player lineup deployment tallies (line/pair/PP slot shares)

- **Match:** Both; Opus LINE-014; Codex sql-line-deployment
- **Purpose:** SQL refresh of how often a player occupied each forward-line slot, D pair and PP1/PP2 in a season.
- **Where:** `web/supabase/migrations/20260629020121_create_player_lineup_deployment_tallies.sql:68 (refresh_player_lineup_deployment_tallies)`; `web/pages/api/v1/db/update-lineup-deployment-tallies.ts:23`; `web/supabase/migrations/20260629020121_create_player_lineup_deployment_tallies.sql:68 refresh_player_lineup_deployment_tallies; supabase/migrations/20260716112908_production_schema_baseline.sql:2866 refresh_player_lineup_deployment_tallies`
- **Tags (heuristic):** percent scale: fraction 0-1; generation: current
- **Opus view (LINE-014):**
  - Method: Forward line_number = floor((ordinality-1)/3)+1, slot label from roster position (L/LW, C, R/RW); D pairs likewise /2; PP units 1-2 one row per player-game; games = count distinct game_id; share = games / total_games within player-season-gametype-deployment_group (4 dp). Game types 2,3.
  - Inputs/units: game counts; sources: lineCombinations, powerPlayCombinations, games, players
  - Output scale: share fraction 0-1; writes: player_lineup_deployment_tallies
  - Status: live — pg_cron update-lineup-deployment-tallies 09:55 UTC (action=current)
  - Consumers: player stats cross-tab (playerIdCrossTab); draft-ranker discovery; start-chart
- **Codex view (sql-line-deployment, calculation, location; Codex family 'SQL usage aggregates'):** player_lineup_deployment_tallies.share
  - Purpose: Build player line/pair/PP percentage-grid history.
  - Inputs/units: Line array ordinalities, canonical position, PP unit, game/season/type/team identities
  - Output scale: Forward line=floor((ordinality−1)/3)+1; defense pair=floor((ordinality−1)/2)+1, side parity; distinct games/cell; total games within player/season/type/deployment group; share=games/totalGames. Share rounded4; total_games is sum of cell game counts within the deployment group.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
- **Audit context:**
  - Intent (Opus): web/supabase/migrations/20260629020121_create_player_lineup_deployment_tallies.sql:281-290 COMMENTs (percentage-grid tallies; share within player/season/game_type/deployment_group)
  - Intended contract (Codex sql-line-deployment): Table/share comments explicitly define cell share within player/season/game_type/deployment_group denominator.
  - External references: Daily Faceoff line deployment percentages
  - Fixtures/test data: none listed
  - Tests: `web/__tests__/pages/api/v1/db/update-lineup-deployment-tallies.test.ts`; `{"discovered_not_run": []}`
- **Leads (not audited):**
  - (opus) slot label is the player's roster position, not the slot he occupied (a C on the wing is tallied as C)
  - (opus) inherits all-strength clustering of lineCombinations and rank-bucket PP units
  - (codex:sql-line-deployment) Definition exists locally; applied migration/live view shape, data freshness and runtime consumer use unknown.

## M-LINE-005 Beat-reporter candidate confidence and team-conflict share

- **Match:** Both; Opus LINE-016; Codex OPS-BEAT
- **Purpose:** Rank X authors of lineup posts as beat-reporter candidates and flag reassigned reporters.
- **Where:** `web/lib/lines/beatReporterInference.ts:91 (candidateConfidence)`; `web/lib/lines/beatReporterInference.ts:99 (buildCandidate)`; `web/lib/lines/beatReporterInference.ts:151 (findTeamConflicts)`; `web/lib/lines/beatReporterInference.ts:91 candidateConfidence`; `web/lib/lines/beatReporterInference.ts:151 findTeamConflicts`
- **Tags (heuristic):** percent scale: fraction 0-1; generation: current
- **Opus view (LINE-016):**
  - Method: confidence = round2(topTeamShare * min(1, ln(1+tagged)/ln(1+30))); suggested teams = top + any with share >= 0.25 and >= 3 posts; conflict if >= 5 posts since review and assigned-team share < 0.5.
  - Inputs/units: counts; sources: line_source_snapshots
  - Output scale: 0-1 score; writes: —
  - Status: live — admin review page
  - Consumers: /db/beat-reporter-review
- **Codex view (OPS-BEAT, calculation, location; Codex family 'Operational calculation helpers'):** Beat-reporter candidate confidence and conflict share
  - Purpose: Rank source-review candidates from team-tagged post concentration.
  - Inputs/units: Counts of stored team-tagged posts by original author/team, review date and assigned teams.
  - Output scale: Confidence 0–1=top team share*min(1,log1p(tagged)/log1p(30)), rounded2; assigned-team post share and conflict flag.
  - Version/status: Operational, not hockey-performance metric. Production deployment/active database state not checked.
- **Audit context:**
  - Intent (Opus): web/lib/lines/beatReporterInference.ts:39-55 comments
  - Intended contract (Codex OPS-BEAT): Confidence is content-concentration/volume heuristic, not a calibrated truth probability.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/lines/beatReporterInference.test.ts`
- **Leads (not audited):**
  - (opus) log-volume saturation at 30 posts is a magic constant
  - (codex:OPS-BEAT) No mathematical accuracy or fitness assessment performed. Tests listed, not run.

## M-LINE-006 American odds to implied probability

- **Match:** Both; Opus LINE-022; Codex core-353
- **Purpose:** Convert American prices to implied probability for market rows.
- **Where:** `web/lib/sources/oddsSourceIngestion.ts:270 (americanPriceToImpliedProbability)`; `web/lib/sources/oddsSourceIngestion.ts:270 americanPriceToImpliedProbability`
- **Tags (heuristic):** percent scale: fraction 0-1; generation: current
- **Opus view (LINE-022):**
  - Method: p = 100/(price+100) for +price; -price/(-price+100) for -price; 0 or null -> null. No vig removal.
  - Inputs/units: American odds; sources: The Odds API / ParlayAPI / NHL schedule odds
  - Output scale: probability 0-1 (with vig); writes: market price rows (odds source tables)
  - Status: live — odds ingestion
  - Consumers: game predictions / player props (other slices)
- **Codex view (core-353, calculation, location; Codex family 'game prediction market'):** Source American price implied probability
  - Formula: Positive price: 100/(price+100). Negative price: -price/(-price+100).
  - Purpose: Provide source American price implied probability for the identified consumer.
  - Inputs/units: Signed American price.
  - Output scale: Probability fraction, or null for zero/nonfinite/missing price.
  - Version/status: Local working tree on octoberBranch, read on 2026-11-10. HEAD changed during the inventory from d31dcb33f72d4c9d69b507874c388f0cd549fe2f to 11e4192d36ecc4ac4b338f9ab48e529c7049c618. This is a non-atomic local scan; deployment and persisted-data state are not verified. Referenced implementation files had no tracked/untracked status entry at the final status check.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex core-353): Function signature and comments at web/lib/sources/oddsSourceIngestion.ts:270 americanPriceToImpliedProbability; independent product specification not verified.
  - External references: Standard American-odds conversion; de-vig (multiplicative/Shin) for fair probability
  - Fixtures/test data: none listed
  - Tests: `Located only; not run for this inventory.`; `web/lib/sources/oddsSourceIngestion.test.ts`
- **Leads (not audited):**
  - (opus) implied probabilities include bookmaker margin (sum > 1); likely owned by game-prediction slice
  - (codex:core-353) ["Calculation inventory only; no correctness or model-quality verdict."]

## M-LINE-007 Tweet parse card confidence score (swipe trainer)

- **Match:** Both; Opus LINE-025; Codex OPS-TRAINER
- **Purpose:** 0-100 confidence that a parsed lineup/goalie/news card is correct.
- **Where:** `web/lib/sources/tweetSwipeTrainer.ts:547 (scoreTrainerConfidence)`; `web/lib/sources/tweetSwipeTrainer.ts:50 (MATCH_BASIS_CONFIDENCE)`; `web/lib/sources/tweetSwipeTrainer.ts:299`; `web/lib/sources/tweetSwipeTrainer.ts:547 scoreTrainerConfidence`
- **Tags (heuristic):** percent scale: 0-100; generation: current
- **Opus view (LINE-025):**
  - Method: Start 100; -10 unknown publish time; -10/-20 weak phrase tier; -10 conflicting types; lineup: -40*(missing of 7 ES units)/7 or -40*(missing of 2 PP units)/2; -15 no complete unit; -8 per unresolved name (max 40); -5 per unplaced player (max 25); goalie line penalties; -(100-meanMatch)*0.3; cap at weakest match+20; cap 15 if filter rejected or image-only. Name match: full 100, alias 90, initial 85, surname 75, ambiguous 40, conflicting 30, position mismatch -40. Bands high>=85, mid>=60.
  - Inputs/units: —; sources: line_source_snapshots / tweet reviews
  - Output scale: 0-100 score; writes: —
  - Status: live — trainer/review tooling
  - Consumers: TweetSwipeTrainer UI; cron report section readers
- **Codex view (OPS-TRAINER, calculation, location; Codex family 'Operational calculation helpers'):** Tweet parser confidence penalty score
  - Purpose: Summarize parsing completeness and ambiguity for review.
  - Inputs/units: Parsed type, rule tier, matched-name confidence, complete lines/pairs, unresolved names and filter status.
  - Output scale: 0–100 penalty score with category/cap rules and signal explanations.
  - Version/status: Operational parser heuristic, not calibrated probability. Production deployment/active database state not checked.
- **Audit context:**
  - Intent (Opus): web/lib/sources/tweetSwipeTrainer.ts:543-546 docblock
  - Intended contract (Codex OPS-TRAINER): Starts at100; publication/rules/completeness/name penalties; mean name confidence penalty; weakest-match+20 and rejected/image-only caps.
  - External references: none suggested
  - Fixtures/test data: `web/lib/sources/fixtures/tweetClassificationLabels.json`; `web/lib/sources/fixtures/october11TroublesomeTweets.json`
  - Tests: `web/components/TweetSwipeTrainer/TweetSwipeTrainer.test.tsx`; `web/lib/sources/tweetSwipeTrainer.test.ts`
- **Leads (not audited):**
  - (opus) heuristic penalties are uncalibrated against labelled accuracy
  - (codex:OPS-TRAINER) No mathematical accuracy or fitness assessment performed. Tests listed, not run.

## M-LINE-008 Date-range linemate aggregation (DRM) and %TOI-with

- **Match:** Both; Opus LINE-026; Codex MISC-MATRIX
- **Purpose:** Aggregate shift_charts relationships over a date range: total TOI, pair shared seconds, % of player TOI, % of season, line/pair counts.
- **Where:** `web/components/DateRangeMatrix/fetchAggregatedData.ts:1106 (buildAggregatedPlayers)`; `web/components/DateRangeMatrix/useTOIData.tsx:792 (percentToiWith etc.)`; `web/components/DateRangeMatrix/fetchAggregatedData.ts:1106 buildAggregatedPlayers`; `web/components/DateRangeMatrix/lineCombinationHelper.ts:11 compareCanonicalPlayerOrder`
- **Tags (heuristic):** percent scale: 0-100; denominators: per game; generation: current
- **Opus view (LINE-026):**
  - Method: Per player: totalToiSeconds = sum game TOI; totalGameLengthSeconds = sum game lengths; pair seconds summed across games (same vs mixed position type); percentToiWith = pairSeconds / player's totalToi * 100; percentOfSeason = pairSeconds / totalGameLength * 100; timesOnLine/timesOnPair counts; ATOI = totalToi / games.
  - Inputs/units: seconds; sources: shift_charts, players (fallback positions)
  - Output scale: percent 0-100; writes: —
  - Status: live — /drm page and team stats pages
  - Consumers: web/pages/drm.tsx; DateRangeMatrixView; LinePairGrid; lineCombinationHelper
- **Codex view (MISC-MATRIX, calculation, location; Codex family 'Other product calculations'):** Date-range shared-TOI percentages, ATOI and line ordering
  - Purpose: Aggregate observed relationships and describe player role over a selected team-game window.
  - Inputs/units: Player/shared shift seconds, game duration seconds, observed games, line/pair occurrence counts.
  - Output scale: Shared TOI / player TOI *100; shared / game length *100; ATOI=total TOI/GP; combo points weight lines 4/3/2/1 and pairs 3/2/1.
  - Version/status: Local matrix aggregation. Production deployment/active database state not checked.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex MISC-MATRIX): Fixed team last-N window; mutual shared seconds retained separately from asymmetric percentage denominator.
  - External references: NST 'TOI together' and 'TOI% with' (5v5)
  - Fixtures/test data: none listed
  - Tests: `web/__tests__/pages/drm.test.tsx`; `web/components/DateRangeMatrix/fetchAggregatedData.test.ts`; `web/components/DateRangeMatrix/lineCombinationHelper.test.ts`; `web/components/DateRangeMatrix/useDateRangeMatrixData.test.tsx`; `web/components/DateRangeMatrix/useTOIData.test.ts`
- **Leads (not audited):**
  - (opus) two implementations (fetchAggregatedData.ts and useTOIData.tsx) compute the same percentages - duplicate logic
  - (opus) inherits all-situation overlap from shift_charts; percentToiWith here (/player TOI) differs from shift_charts.percent_toi_with (/game length)
  - (codex:MISC-MATRIX) No mathematical accuracy or fitness assessment performed. Tests listed, not run.

## M-LINE-009 Linemate shared-TOI matrix (game) and greedy line clustering

- **Match:** Both; Opus LINE-027; Codex MISC-SHIFTS
- **Purpose:** Per game, compute pairwise shared seconds (all strengths or PP only) and order players into lines/pairs for the matrix and lineCombinations table.
- **Where:** `web/components/LinemateMatrix/utilities.ts:28 (getPairwiseTOI)`; `web/components/LinemateMatrix/index.tsx:195 (getTOIData)`; `web/components/LinemateMatrix/index.tsx:517 (sortByLineCombination)`; `web/components/LinemateMatrix/index.tsx:678 (avgSharedToi)`; `web/components/LinemateMatrix/index.tsx:884 (cell opacity)`; `web/components/LinemateMatrix/index.tsx:940 (PPTOIComparasion)`; `web/pages/api/v1/db/update-line-combinations/[id].ts:80 (getLineCombos)`; `web/components/ShiftChart/model.ts:337 toiAt`; `web/components/ShiftChart/model.ts:389 matrixData`; `web/components/LinemateMatrix/utilities.ts:28 getPairwiseTOI`; `web/components/LinemateMatrix/utilities.ts:150 getAvg`
- **Tags (heuristic):** percent scale: fraction 0-1; generation: current
- **Opus view (LINE-027):**
  - Method: Per period 1200-slot boolean arrays; shared seconds = count of seconds both on ice (and inside own PP block in pp-toi mode). Lines: pivot = highest own TOI, then add the n-1 players with most shared TOI with pivot (3 F per line, 2 D per pair), repeat. Cell opacity = shared/avg own TOI clamped 0-1. PP comparison bar = avg PPTOI of PP1 vs PP2 as % of their sum.
  - Inputs/units: seconds; sources: NHL shiftcharts, NHL boxscore, NHL play-by-play
  - Output scale: seconds; order 1..N; opacity 0-1; writes: lineCombinations (via upsert_line_combinations_from_source RPC)
  - Status: live — update-line-combinations-job every 25 min and update-line-combinations-all 08:00 UTC; /lines and linemate matrix pages
  - Consumers: /lines pages; LineCombinations components; FORGE line-combo goalie prior; player_lineup_deployment_tallies; Discord line-combo webhooks
- **Codex view (MISC-SHIFTS, calculation, location; Codex family 'Other product calculations'):** Replay TOI, shared-ice overlap and linemate averages
  - Purpose: Measure ice time and pairwise overlap for replay/matrix displays.
  - Inputs/units: Shift start/end or duration seconds, replay timestamp, optional PP blocks.
  - Output scale: Player elapsed TOI seconds; pairwise shared seconds; roster average TOI.
  - Version/status: Two related implementations retained. Production deployment/active database state not checked.
- **Audit context:**
  - Intent (Opus): web/components/LinemateMatrix/index.tsx:521 comment (TJ: three fwds with most shared toi, then 2nd, 3rd, 4th)
  - Intended contract (Codex MISC-SHIFTS): Half-open interval overlap in replay; per-second boolean occupancy in legacy matrix.
  - External references: NST line TOI (5v5), Daily Faceoff / LeftWingLock confirmed lines
  - Fixtures/test data: none listed
  - Tests: `web/__tests__/pages/api/v1/db/update-line-combinations.test.ts`; `web/components/LinemateMatrix/index.test.tsx`; `web/components/ShiftChart/model.test.ts`; `web/lib/lines/matrixCapture.test.tsx`
- **Leads (not audited):**
  - (opus) line clustering uses all-situation shared TOI, so PP/PK pairings pull PP specialists into the top line
  - (opus) period arrays fixed at 1200 s; regular-season OT (300 s) fine but playoff OT > 1200 s and shifts past 1200 would overflow the array index
  - (opus) goalies list in lineCombinations is boxscore order of all dressed goalies, not the starter
  - (codex:MISC-SHIFTS) No mathematical accuracy or fitness assessment performed. Tests listed, not run.

## M-LINE-010 Shift-chart replay TOI, game clock axis and shared-interval matrix

- **Match:** Both; Opus LINE-028; Codex MISC-SHIFTS
- **Purpose:** Client-side replay: map shifts onto a game axis, TOI-so-far per player, running shots/goals, and an interval-overlap matrix.
- **Where:** `web/components/ShiftChart/model.ts:143 (normalizeGame)`; `web/components/ShiftChart/model.ts:337 (toiAt)`; `web/components/ShiftChart/model.ts:359 (statsAt)`; `web/components/ShiftChart/model.ts:389 (matrixData)`; `web/components/ShiftChart/model.ts:132 (mergeIntervals)`; `web/components/ShiftChart/model.ts:337 toiAt`; `web/components/ShiftChart/model.ts:389 matrixData`; `web/components/LinemateMatrix/utilities.ts:28 getPairwiseTOI`; `web/components/LinemateMatrix/utilities.ts:150 getAvg`
- **Tags (heuristic):** generation: current
- **Opus view (LINE-028):**
  - Method: Period lengths 1200 s (playoffs all periods) else OT 300 s; game duration = final period start + (length - secondsRemaining); shifts clamped to period and merged; toiAt = sum min(time,end)-start; statsAt counts goal + shot-on-goal as shots; matrixData = merge-join overlap of interval lists, intersected with own-team PP blocks in pp-toi mode (goalies excluded).
  - Inputs/units: seconds; sources: NHL api-web boxscore, play-by-play; NHL stats shiftcharts
  - Output scale: seconds on game axis; counts; writes: —
  - Status: live — /shiftChart page
  - Consumers: web/pages/shiftChart.tsx (Replay); LinemateMatrixView
- **Codex view (MISC-SHIFTS, calculation, location; Codex family 'Other product calculations'):** Replay TOI, shared-ice overlap and linemate averages
  - Purpose: Measure ice time and pairwise overlap for replay/matrix displays.
  - Inputs/units: Shift start/end or duration seconds, replay timestamp, optional PP blocks.
  - Output scale: Player elapsed TOI seconds; pairwise shared seconds; roster average TOI.
  - Version/status: Two related implementations retained. Production deployment/active database state not checked.
- **Audit context:**
  - Intent (Opus): web/components/ShiftChart/model.ts:388 comment (same shared-seconds measure as the standalone matrix)
  - Intended contract (Codex MISC-SHIFTS): Half-open interval overlap in replay; per-second boolean occupancy in legacy matrix.
  - External references: NHL shift-chart conventions
  - Fixtures/test data: `web/components/ShiftChart/testFixtures.ts`
  - Tests: `web/components/ShiftChart/Replay.test.tsx`; `web/components/ShiftChart/model.test.ts`; `web/components/ShiftChart/useGameGrid.test.tsx`
- **Leads (not audited):**
  - (opus) interval-based matrix here vs per-second boolean arrays in LinemateMatrix/utilities.ts - two implementations of the same shared-TOI measure
  - (codex:MISC-SHIFTS) No mathematical accuracy or fitness assessment performed. Tests listed, not run.

## M-LINE-011 Exact-five PP units (observed 5v4/5v3 groups)

- **Match:** Both; Opus LINE-032; Codex RANK-X5
- **Purpose:** Offline derivation of the exact five skaters on ice during validated 5v4/5v3 time with clock-second accounting.
- **Where:** `web/lib/exactFivePp/exactFivePpUnits.ts:213 (classifyTeamSituation)`; `web/lib/exactFivePp/exactFivePpUnits.ts:329 (buildExactFivePpGame)`; `web/lib/exactFivePp/exactFivePpUnits.ts:539 (summarizeExactFivePp)`; `web/lib/exactFivePp/exactFivePpOracle.ts:77 (runExactFiveOracle, test oracle)`; `web/lib/exactFivePp/exactFivePpUnits.ts:174 buildExactFiveUnitKey`; `web/lib/exactFivePp/exactFivePpUnits.ts:213 classifyTeamSituation`; `web/lib/exactFivePp/exactFivePpOracle.ts:77 runExactFiveOracle`; `web/lib/exactFivePp/exactFivePpUnits.ts:329 buildExactFivePpGame`; `web/lib/exactFivePp/exactFivePpUnits.ts:539 summarizeExactFivePp`
- **Tags (heuristic):** percent scale: fraction 0-1; generation: research, development, current
- **Opus view (LINE-032):**
  - Method: Per period: union each player's intervals (duplicate seconds counted separately), sweep all boundaries; team situation from PBP code (own/opp goalie, skater digits); qualifies only 5v4/5v3 with both goalies; cross-check shift counts (1 goalie each, own 5 skaters, opp 4 or 3) else seconds go to unknown reasons. Adjacent identical intervals merged. Summary: sharedClockSeconds per (team,manpower,unitKey), attributionCoverage = attributed/qualifying.
  - Inputs/units: seconds (half-open integer); sources: shift + PBP inputs already validated by buildShiftStrengthUpserts (offline)
  - Output scale: clock seconds; coverage fraction 0-1; writes: —
  - Status: draft — no callers outside exactFivePp fixtures/tests (sprint lane S-17 offline proposal)
  - Consumers: none in app code (fixtures/oracle/tests only)
- **Codex view (RANK-X5, calculation, location; Codex family 'Deployment and usage'):** Exact-five power-play unit exposure and oracle
  - Purpose: Compute exact five-player PP units, continuity and overlap.
  - Inputs/units: Rostered skater shift intervals and situation/manpower segments seconds.
  - Output scale: Exact-unit seconds, player/pairwise exposure, PP manpower and coverage tallies.
  - Version/status: Local implementation and tests. Production deployment/active database state not checked.
- **Audit context:**
  - Intent (Opus): web/lib/exactFivePp/exactFivePpUnits.ts:1-28 header (offline proposal, interval and manpower semantics)
  - Intended contract (Codex RANK-X5): exact_five_pp_v1; oracle is separate verification implementation, not production evidence.
  - External references: NST PP unit TOI; Evolving-Hockey 5v4 unit TOI
  - Fixtures/test data: `web/lib/exactFivePp/exactFivePpFixtures.ts`; `web/lib/exactFivePp/exactFivePpOracle.ts`
  - Tests: `web/lib/exactFivePp/exactFivePpUnits.test.ts`
- **Leads (not audited):**
  - (opus) adjacent-interval merge compares only intervals.at(-1); merging can fail when both teams' intervals interleave (rare since only one side has the advantage)
  - (opus) no production caller - status draft; live PP units still use rank-bucket method
  - (codex:RANK-X5) No mathematical accuracy or fitness assessment performed. Tests listed, not run.

## M-LINE-012 PP unit assignment + per-player PP usage metrics (powerPlayCombinations)

- **Match:** Both; Opus LINE-034; Codex MISC-SHIFTS, pp-team-share, pp-unit-usage
- **Purpose:** Assign PP1/PP2/PP3 per team-game from PP shared TOI and compute unit-relative usage and team PP share.
- **Where:** `web/pages/api/v1/db/update-power-play-combinations/[gameId].ts:134 (updatePowerPlayCombinations)`; `web/components/LinemateMatrix/index.tsx:555 (sortByPPTOI)`; `web/components/LinemateMatrix/utilities.ts:150 (getAvg)`; `web/lib/supabase/Upserts/powerPlayCombinationMetrics.ts:25 (buildUnitUsageRows)`; `web/lib/supabase/Upserts/powerPlayCombinationMetrics.ts:46 (buildPowerPlayCombinationRows)`; `web/pages/api/v1/db/update-power-play-combinations/[gameId].ts:38 (getProvenNoPpPlayerIds)`; `web/components/ShiftChart/model.ts:337 toiAt`; `web/components/ShiftChart/model.ts:389 matrixData`; `web/components/LinemateMatrix/utilities.ts:28 getPairwiseTOI`; `web/components/LinemateMatrix/utilities.ts:150 getAvg`; `web/lib/supabase/Upserts/powerPlayCombinationMetrics.ts:46 buildPowerPlayCombinationRows`; `web/lib/supabase/Upserts/powerPlayCombinationMetrics.ts:25 buildUnitUsageRows`
- **Tags (heuristic):** percent scale: fraction 0-1; generation: current
- **Opus view (LINE-034):**
  - Method: Player PPTOI = seconds on ice inside own-team PP blocks (time-array AND). sortByPPTOI: PP1 pivot = max PPTOI; PP1 = top 5 by shared PP TOI with pivot (pivot included); PP2 pivot = max remaining PPTOI, top 5 shared; rest = PP3. Rows: percentageOfPP = pp_unit_usage_index = PPTOI / unit mean PPTOI; pp_unit_relative_toi = PPTOI - unit mean; pp_vs_unit_avg = index-1; pp_share_of_team = PPTOI / team PP block seconds. Guard: team skater PP seconds must be >= 3 x team PP seconds; stale rows deleted only if boxscore TOI matches shift TOI within 2 s.
  - Inputs/units: seconds; sources: NHL shiftcharts (json-api, fallback raw gamecenter payload), NHL boxscore, NHL play-by-play
  - Output scale: index ratio (~0-2); fraction 0-1 for pp_share_of_team; unit 1..3; writes: powerPlayCombinations
  - Status: live — pg_cron update-power-play-combinations 08:05 UTC; also triggered by line-combination DB trigger
  - Consumers: team_unit_toi PP rows; player_lineup_deployment_tallies PP1/PP2; PowerPlayCombos component; FORGE/rolling PP share (pp_share_pct); Rankings
- **Codex view (MISC-SHIFTS, calculation, location; Codex family 'Other product calculations'):** Replay TOI, shared-ice overlap and linemate averages
  - Purpose: Measure ice time and pairwise overlap for replay/matrix displays.
  - Inputs/units: Shift start/end or duration seconds, replay timestamp, optional PP blocks.
  - Output scale: Player elapsed TOI seconds; pairwise shared seconds; roster average TOI.
  - Version/status: Two related implementations retained. Production deployment/active database state not checked.
- **Codex view (pp-team-share, calculation, location; Codex family 'Power-play usage'):** pp_share_of_team
  - Purpose: Keep team-relative PP participation distinct from unit-relative usage.
  - Inputs/units: Player PP seconds, team PP seconds
  - Output scale: player PPTOI / team PPTOI, rounded 6 decimals; missing/nonpositive team denominator => null
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
- **Codex view (pp-unit-usage, calculation, location; Codex family 'Power-play usage'):** PPTOI, pp_unit_usage_index, percentageOfPP, pp_unit_relative_toi, pp_vs_unit_avg
  - Purpose: Describe each player relative to their unit average.
  - Inputs/units: Player PP TOI seconds; average unit TOI seconds
  - Output scale: usage_index = player/avg or 0; legacy percentageOfPP aliases index; relative_toi = player-avg rounded to seconds; vs_unit_avg = index-1; other outputs rounded 6 decimals. Index is not bounded at 1.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
- **Audit context:**
  - Intent (Opus): web/lib/supabase/Upserts/powerPlayCombinationMetrics.ts:59-60 comment (team-share stored separately for consistent pp_share_pct denominator); [gameId].ts:17-20 comments on thresholds
  - Intended contract (Codex MISC-SHIFTS): Half-open interval overlap in replay; per-second boolean occupancy in legacy matrix.
  - Intended contract (Codex pp-team-share): web/lib/supabase/Upserts/powerPlayCombinationMetrics.ts:60 team-share comment; web/lib/supabase/Upserts/rollingMetricSourceUnitContract.ts pp_share_pct contract.
  - Intended contract (Codex pp-unit-usage): web/lib/supabase/Upserts/powerPlayCombinationMetrics.ts:60 comment separates unit-relative context from team-share semantics.
  - External references: NST PP TOI% (player PPTOI / team PPTOI); Daily Faceoff / LeftWingLock PP unit reports
  - Fixtures/test data: none listed
  - Tests: `web/__tests__/pages/api/v1/db/update-power-play-combinations-game.test.ts`; `web/__tests__/pages/api/v1/db/update-power-play-combinations.test.ts`; `web/components/LinemateMatrix/index.test.tsx`; `web/components/ShiftChart/model.test.ts`; `web/lib/supabase/Upserts/powerPlayCombinationMetrics.test.ts`; `{"discovered_not_run": ["web/lib/supabase/Upserts/powerPlayCombinationMetrics.test.ts", "web/lib/supabase/Upserts/rollingPlayerPpShareContract.test.ts"]}`; `{"discovered_not_run": ["web/lib/supabase/Upserts/powerPlayCombinationMetrics.test.ts", "web/lib/supabase/Upserts/rollingPlayerPpUnitContract.test.ts"]}`
- **Leads (not audited):**
  - (opus) 'percentageOfPP' is a unit-relative index (~1.0), not a percent of PP - name mismatch with pp_share_of_team
  - (opus) no PP1/PP2 share threshold; unit membership is fixed size 5 by greedy pivot clustering, so a 4F1D vs 3F2D swap or 5v3 extra skater shifts players between units
  - (opus) team PP seconds computed with a 20*60 period length and only one boundary crossing
  - (codex:MISC-SHIFTS) No mathematical accuracy or fitness assessment performed. Tests listed, not run.
  - (codex:pp-team-share) No runtime verification or correctness assessment performed.
  - (codex:pp-unit-usage) No runtime verification or correctness assessment performed.

## M-LINE-013 generated column team_unit_toi.unit_share

- **Match:** Opus only; Opus LINE-001; Codex —
- **Purpose:** Unit share of pooled team unit TOI
- **Where:** `supabase/migrations/20260716112908_production_schema_baseline.sql:26007 (team_unit_toi.unit_share GENERATED)`; `web/supabase/migrations/20260622150500_create_team_unit_toi.sql:23 (original)`
- **Tags (heuristic):** percent scale: fraction 0-1; generation: current
- **Opus view (LINE-001):**
  - Method: unit_share = unit_toi_seconds / team_unit_pool_toi_seconds when pool > 0 else NULL (pooled player-seconds both sides).
  - Inputs/units: pooled player-seconds; sources: team_unit_toi
  - Output scale: share 0-1; writes: team_unit_toi.unit_share (stored)
  - Status: live — table written by web/pages/api/v1/db/update-team-unit-toi.ts and read by rankings/exactFivePp
  - Consumers: web/lib/exactFivePp/exactFivePpUnits.ts; web/lib/rankings/trending.ts; web/components/Rankings/caveatLabels.ts
- **Audit context:**
  - Intent (Opus): supabase/migrations/20260716112908_production_schema_baseline.sql:26054 COMMENT 'Generated unit_toi_seconds / team_unit_pool_toi_seconds share.'
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/__tests__/pages/rankings.test.tsx`; `web/lib/exactFivePp/exactFivePpUnits.test.ts`

## M-LINE-014 Date Range Matrix cell shade from shared TOI%

- **Match:** Opus only; Opus LINE-004; Codex —
- **Purpose:** Colour intensity of each pair cell in the line-mate TOI matrix.
- **Where:** `web/components/DateRangeMatrix/index.tsx:299 (avgSharedToi)`; `web/components/DateRangeMatrix/index.tsx:543 (Cell opacity)`
- **Tags (heuristic):** percent scale: fraction 0-1; generation: current
- **Opus view (LINE-004):**
  - Method: effective = percentToiWith \|\| percentToiWithMixed; opacity = (self ? 1 : effective/100) * 1.5. avgSharedToi = mean(totalTOI) over displayed roster, passed as teamAvgToi but not used by Cell.
  - Inputs/units: percent 0-100; sources: LINE-021 buildAggregatedPlayers output
  - Output scale: opacity 0-1.5 (clipped by CSS); writes: —
  - Status: live — /drm
  - Consumers: pages/drm.tsx
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/components/DateRangeMatrix/index.accessibility.test.tsx`
- **Leads (not audited):**
  - (opus) opacity saturates (>1) above 66.7% shared TOI, so top pairs are indistinguishable
  - (opus) avgSharedToi computed but unused; divides by roster length with no zero guard
  - (opus) same-position share falls back to mixed share with no indication

## M-LINE-015 Tweet trainer confidence tone bands (component copy)

- **Match:** Opus only; Opus LINE-005; Codex —
- **Purpose:** Colours the parse-card confidence score.
- **Where:** `web/components/TweetSwipeTrainer/TrainerCard.tsx:56 (confidenceTone)`
- **Tags (heuristic):** generation: current
- **Opus view (LINE-005):**
  - Method: high if >=85, mid if >=60, else low.
  - Inputs/units: 0-100 score; sources: tweet swipe trainer API
  - Output scale: 3-level tone; writes: —
  - Status: live — tweet swipe trainer
  - Consumers: TweetSwipeTrainer page
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: none listed
- **Leads (not audited):**
  - (opus) duplicate implementation of MISC-022 / LINE-020 CONFIDENCE_BANDS (web/lib/sources/tweetSwipeTrainer.ts:50-64)

## M-LINE-016 Social share deployment change (TOI/GP L5 vs season, line and PP unit step)

- **Match:** Opus only; Opus LINE-006; Codex —
- **Purpose:** Classify skaters as deployment up/down from TOI change and line/PP-unit moves between the last two contiguous games.
- **Where:** `web/lib/socialShare/trends.ts:209 (trendShortlists deployment)`; `web/lib/socialShare/trends.ts:153 (ppEvidence)`; `web/lib/socialShare/trends.ts:172-173 (ppRank, step)`; `web/lib/socialShare/trends.ts:73 (MIN_DEPLOYMENT_TOI_DELTA_SECONDS=60)`
- **Tags (heuristic):** denominators: per game; generation: current
- **Opus view (LINE-006):**
  - Method: Qualifier GP >= 10. TOI delta = round(L5 avg TOI s) - round(season avg TOI s). Line bucket via normalizeEvDeploymentBucket; lineChange = step(now, before) = +1 if line number fell (promotion), -1 if rose, 0 if equal/unknown/different group. PP state: unit 1/2 from game's PP rows, 'none' if game has PP rows but player not in unit 1-2 (unit 3 = incidental), else rolling row pp_unit 1-2, else unknown; ppRank none=9; ppChange = step. Previous game used only if season GP steps by exactly 1 and same team. Driver = 'toi' if \|delta\| >= 60 s (direction = sign), else 'role' (requires a line or PP change, mixed signs dropped; direction = sign of lineChange+ppChange). Sort: any role change first, \|role\|, \|delta\|, id. PP L5 per game = pp_toi_total_last5/5. 4 rows each side.
  - Inputs/units: TOI seconds per game; line/unit ordinals; sources: rolling_player_game_metrics, powerPlayCombinations
  - Output scale: seconds delta; -1/0/+1 steps; up/down flag; writes: —
  - Status: live — social-share edition trend layer (deployment section)
  - Consumers: web/lib/socialShare/server.ts (Tuesday trend layer of the social-share edition); web/components/SocialShare/SocialShare.tsx (Hot/Cold, Deployment, Rate, Movers cards)
- **Audit context:**
  - Intent (Opus): web/lib/socialShare/trends.ts:146-150 (two PP units rule) and :218-220 (column driver rule)
  - External references: none suggested
  - Fixtures/test data: `web/lib/socialShare/trendsFixture.ts`
  - Tests: `web/components/SocialShare/SocialShare.test.tsx`; `web/e2e/social-share.spec.ts`; `web/lib/socialShare/trendSources.test.ts`; `web/lib/socialShare/trends.test.ts`
- **Leads (not audited):**
  - (opus) PP unit derived from writer that ranks by PP TOI (top 5 -> unit 1, next 5 -> unit 2), so a unit change can be a TOI ranking artefact
  - (opus) pp.l5 divides L5 PP total by a hard 5 regardless of PP appearances
  - (opus) magic threshold 60 s TOI/GP; L5 overlaps season baseline

## M-LINE-017 Decisions reference shadow adapter: token reservation, USD budget and material-news triage

- **Match:** Opus only; Opus LINE-007; Codex —
- **Purpose:** Bound the cost of LLM shadow reviews of news posts and flag zero-claim posts whose material-news probability passes a frozen threshold.
- **Where:** `web/lib/sources/decisionsReference/adapter.mjs:121 (createShadowAdapter)`; `web/lib/sources/decisionsReference/adapter.mjs:134 (dollars)`; `web/lib/sources/decisionsReference/adapter.mjs:147-148 (reservation)`; `web/lib/sources/decisionsReference/adapter.mjs:100-112 (answer validation)`; `web/lib/sources/decisionsReference/adapter.mjs:189-195 (reviewReasons)`
- **Tags (heuristic):** percent scale: fraction 0-1
- **Opus view (LINE-007):**
  - Method: Reservation = request UTF-8 bytes + 512 tokens (conservative, not a tokenizer). USD = tokens/1e6 * usdPerMillionInputTokens * billingMultiplier (>=1). Skip if per-request bytes/reservation or period request/token/USD caps would be exceeded; on response, ledger adjusted by actual - reservation; unknown usage keeps reservation and blocks. Answers: predicate probability in [0,1]; choice distributions must sum to 1 +/- 0.001. Zero-claim post with probability >= frozen postMaterialMinProbability -> 'material_news_without_extracted_claims'; uncalibrated -> shadow only.
  - Inputs/units: bytes, tokens, USD; sources: —
  - Output scale: USD estimate; probability 0-1; writes: —
  - Status: unknown — shadow mode; wired through tweetLunaReview, enablement depends on config.enabled
  - Consumers: web/lib/sources/tweetLunaReview.ts; web/lib/sources/tweetDecisionReviewResults.ts; web/scripts/review-ifttt-luna.ts
- **Audit context:**
  - Intent (Opus): web/lib/sources/decisionsReference/adapter.mjs:147 comment ('Dependency-free, deliberately conservative estimate; NOT an exact tokenizer')
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/sources/tweetDecisionReview.test.ts`
- **Leads (not audited):**
  - (opus) bytes+512 as a token estimate over-reserves for English but could under-reserve for multi-byte-heavy text only if tokens > bytes (rare)
  - (opus) probability-sum validation duplicates MISC-021 (tweetDecisionReviewResults)

## M-LINE-018 Tweet identity resolution evaluation grading (baseline vs deterministic vs mocked resolver)

- **Match:** Opus only; Opus LINE-008; Codex —
- **Purpose:** Grade player-identity resolution of tweet mentions against labelled occurrences by cohort and arm.
- **Where:** `web/lib/sources/tweetIdentityEvaluation.ts:20 (gradeLocalIdentityComparison)`
- **Tags (heuristic):** generation: development
- **Opus view (LINE-008):**
  - Method: Cohorts synthetic_development, real_development, real_holdout (holdout requires independently adjudicated labels). Per arm and labelled occurrence: expectedPlayers, retrievalHits (expected id in candidates), nonPlayerCases/assignments, missingOccurrences, assignments, wrongPlayers (selected != expected), abstentions; extra predicted occurrences count as wrong assignments. No accuracy ratio is computed (realModelAccuracy null).
  - Inputs/units: counts; sources: —
  - Output scale: integer counts; writes: —
  - Status: draft — only a development fixture and test call it
  - Consumers: web/lib/sources/fixtures/tweetIdentityDevelopmentComparison.ts
- **Audit context:**
  - Intent (Opus): web/lib/sources/tweetIdentityEvaluation.ts:76-79 (interpretation and note strings)
  - External references: Entity-linking precision/recall (retrieval recall@k, assignment precision)
  - Fixtures/test data: `web/lib/sources/fixtures/tweetIdentityDevelopmentComparison.ts`
  - Tests: `web/lib/sources/tweetIdentityEvaluation.test.ts`
- **Leads (not audited):**
  - (opus) only counts, no rates; synthetic cohort explicitly not model accuracy

## M-LINE-019 Per-game TOI and power-play TOI share series

- **Match:** Opus only; Opus LINE-009; Codex —
- **Purpose:** Build a date-ordered series of a skater's TOI, PP TOI and share of team PP time for the time-on-ice chart.
- **Where:** `web/pages/api/toi.ts:125 (buildToiSeries)`; `web/pages/api/toi.ts:163 (parseTime)`
- **Tags (heuristic):** percent scale: 0-100; denominators: per 60; generation: current
- **Opus view (LINE-009):**
  - Method: toi = mm:ss -> minutes; powerPlayToi = FORGE toi_pp_seconds/60 (0 when missing); powerPlayToiShare = min(playerPP/teamPP*100, 100) using the PP time of the team the player dressed for (FORGE team_id), 0 when team PP is 0.
  - Inputs/units: player/team TOI mm:ss; FORGE PP TOI seconds; sources: skatersGameStats, games, forge_player_game_strength, teamGameStats, seasons
  - Output scale: minutes; share percent 0-100; writes: —
  - Status: live — components/TimeOnIceChart/TimeOnIceChart.tsx
  - Consumers: web/components/TimeOnIceChart/TimeOnIceChart.tsx; web/pages/api/v1/player/[id]/percentile-rank.ts (imports getInterval)
- **Audit context:**
  - Intent (Opus): Code comment web/pages/api/toi.ts:120-124: PP TOI is FORGE toi_pp_seconds and the share divides by the PP TOI of the team the player dressed for
  - External references: PP TOI share = player PP TOI / team PP TOI (NHL/NST convention)
  - Fixtures/test data: `web/__tests__/pages/api/toi.test.ts (inline rows)`
  - Tests: `web/__tests__/pages/api/toi.test.ts`
- **Leads (not audited):**
  - (opus) share is capped at 100% which hides data mismatches between FORGE shift-derived PP seconds and boxscore team PP time
  - (opus) missing FORGE PP data is reported as 0 PP TOI rather than null

## M-LINE-020 Shift-chart overlap, percent-TOI-with and greedy line/pair assignment

- **Match:** Opus only; Opus LINE-010; Codex —
- **Purpose:** From NHL shifts, compute per-player PP/ES TOI, time and percent of game spent with each teammate, and assign 4 forward lines and 3 D pairs.
- **Where:** `web/pages/api/v1/db/shift-charts.ts:306 (sumDurations)`; `web/pages/api/v1/db/shift-charts.ts:382 (getPairwiseTOI)`; `web/pages/api/v1/db/shift-charts.ts:415 (generateTeamLogs)`; `web/pages/api/v1/db/shift-charts.ts:880-990 (overlap loop)`
- **Tags (heuristic):** percent scale: 0-100; generation: current
- **Opus view (LINE-010):**
  - Method: total_pp_toi / total_es_toi = sum of PP/ES segment durations. For each same-team teammate: overlap seconds = sum over same-period shift pairs of max(0, min(end)-max(start)); percent_toi_with = overlap / game length seconds * 100 (split same-position vs mixed). Lines: pivot = highest-TOI unused forward, add the 2 unused forwards with most time_spent_with pivot; repeat 4 times. Pairs: same with 1 partner, 3 times.
  - Inputs/units: mm:ss clocks -> seconds; sources: NHL shiftcharts API, games, nhl_api_game_roster_spots, yahoo_positions
  - Output scale: seconds; percent 0-100; line 1-4, pair 1-3; writes: shift_charts, projection_game_materialization_status
  - Status: live — rolling FORGE pipeline and route-runner; route ledger calls=6
  - Consumers: projection inputs (lib/projections/ingest); rolling FORGE pipeline
- **Audit context:**
  - Intent (Opus): JSDoc on getPairwiseTOI (shift-charts.ts:~375 '@returns Total TOI in seconds')
  - External references: Line identification from ES shared TOI (NST/DailyFaceoff style)
  - Fixtures/test data: none listed
  - Tests: `web/__tests__/pages/api/v1/db/shift-charts.queue.test.ts`; `web/__tests__/pages/api/v1/db/update-nhl-shift-charts.test.ts`
- **Leads (not audited):**
  - (opus) getPairwiseTOI is passed only playerData.shifts (one player's shifts) and filters for p2 within it, so pairwise TOI looks always 0 except self-pairs
  - (opus) line assignment uses all-situation overlap (includes PP/PK), not 5v5
  - (opus) percent_toi_with divides by game length, not by the player's own TOI

## M-LINE-021 Power-play unit assignment and PP time from play-by-play

- **Match:** Opus only; Opus LINE-011; Codex —
- **Purpose:** Per game, derive team PP seconds from PP blocks and assign PP units by player PP TOI rank.
- **Where:** `web/pages/api/v1/db/update-power-play-combinations/[gameId].ts:134 (updatePowerPlayCombinations)`
- **Tags (heuristic):** generation: current
- **Opus view (LINE-011):**
  - Method: Team PP seconds = sum over PP blocks of end-start (cross-period: 20*60 - start + end). Players sorted by PP TOI: top 5 = unit 1, next 5 = unit 2, rest = unit 3. avgPPTOI per unit (getAvg); row metrics percentageOfPP, pp_unit_usage_index, pp_unit_relative_toi, pp_vs_unit_avg, pp_share_of_team built in lib/supabase/Upserts/powerPlayCombinationMetrics. Completeness check: player PP seconds >= 3 * team PP seconds else abort.
  - Inputs/units: seconds (mm:ss clocks); sources: NHL gamecenter play-by-play and shift charts (raw), powerPlayCombinations
  - Output scale: unit 1-3; seconds; percentages per lib; writes: powerPlayCombinations
  - Status: live — rolling FORGE pipeline stage; route ledger calls=6
  - Consumers: web/components/PowerPlayCombos/PowerPlayCombos.tsx; web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts; web/lib/rollingForgePipeline.ts
- **Audit context:**
  - Intent (Opus): Comments [gameId].ts:~200-210 (a team with PP time must show players on ice; catches grossly incomplete feed)
  - External references: PP unit identification by shared 5v4 ice time (e.g. NST line tool)
  - Fixtures/test data: none listed
  - Tests: `web/__tests__/pages/api/v1/db/update-power-play-combinations-game.test.ts`; `web/__tests__/pages/api/v1/db/update-power-play-combinations.test.ts`
- **Leads (not audited):**
  - (opus) cross-period PP duration assumes 20-minute periods (wrong for 5-minute regular-season OT)
  - (opus) PP units are fixed 5-player rank slices by PP TOI, not by who actually shared the ice; 4F1D vs 3F2D ignored
  - (opus) MIN_SKATERS_PER_PP_SECOND = 3 is a loose completeness floor (5 expected)

## M-LINE-022 Line promotions/demotions and line-card goalie stats

- **Match:** Opus only; Opus LINE-013; Codex —
- **Purpose:** Compare current vs previous lineCombinations to flag promotions/demotions; aggregate goalie record/SV%/GAA for line cards.
- **Where:** `web/components/LineCombinations/utilities.ts:407 (getLineChanges)`; `web/components/LineCombinations/utilities.ts:497 (processGoalie)`; `web/components/LineCombinations/utilities.ts:565 (convertToLines)`; `web/components/LineCombinations/utilities.ts:46 (aggregateSkaterToiSeconds)`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: per 60, per game; generation: current
- **Opus view (LINE-013):**
  - Method: Line number = index/3 (F) or /2 (D); promotion if new or lower line number, demotion if dropped or higher. Goalie: last10 = first 10 non-zero-TOI rows; SV% = mean of per-game savePctg; GAA = mean of per-game GA*60/minutes; missing outcome counted as WIN.
  - Inputs/units: seconds/MM:SS; percent fractions; sources: lineCombinations, goaliesGameStats, skatersGameStats, gameOutcomes
  - Output scale: SV% fraction; GAA goals/60; writes: —
  - Status: live — /lines pages
  - Consumers: /lines/[abbreviation] page; LineCombinationsGrid; GoalieCard
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: NHL SV% = saves/shots and GAA = GA*3600/TOI seconds (pooled)
  - Fixtures/test data: `web/components/LineCombinations/__test__/LineCombinationsData.ts`
  - Tests: `web/__tests__/pages/lines/index.test.tsx`; `web/components/LineCombinations/__test__/utilities.test.ts`
- **Leads (not audited):**
  - (opus) SV% and GAA are unweighted means of per-game ratios, not pooled totals
  - (opus) gameOutcomes missing -> counted as WIN
  - (opus) last10 relies on query order (no explicit sort in processGoalie)

## M-LINE-023 Source authority tier weights

- **Match:** Opus only; Opus LINE-015; Codex —
- **Purpose:** Weight a lines/PP claim by the original author's tier.
- **Where:** `web/lib/lines/authority.ts:46 (WEIGHT)`; `web/lib/lines/authority.ts:63 (authorityTier)`; `web/lib/lines/authority.ts:14 (RELAY_ONLY_WEIGHT)`; `web/lib/lines/authority.ts:92 (sourceAttribution)`
- **Tags (heuristic):** generation: current
- **Opus view (LINE-015):**
  - Method: team (32 club + team-run accounts) = 3, beat (reviewed list) = 2, aggregator (fhfhockey) = 1, unknown = 1, excluded = 0; unattributed relay post = 0.5; relay accounts never confer a tier; FHFHockey posts never confirm unless quoting an original.
  - Inputs/units: —; sources: line_source_snapshots (via ParsedLinesCccSource), fixtures/clubHandles.ledger.json (seed list)
  - Output scale: weight 0-3; writes: —
  - Status: live — lines processor (update-line-sources / update-lines-ccc)
  - Consumers: decisions.produceLineEvidence; reconcile.selectUnits
- **Audit context:**
  - Intent (Opus): web/lib/lines/authority.ts:5-44 comments (TJ sourcing rule 2026-11-06 / 11-07)
  - External references: Daily Faceoff / LeftWingLock source hierarchy (team > beat > aggregator)
  - Fixtures/test data: `web/lib/lines/fixtures/clubHandles.ledger.json`
  - Tests: `web/lib/lines/decisions.test.ts`; `web/lib/lines/processor.test.ts`
- **Leads (not audited):**
  - (opus) aggregator and unknown share weight 1 - unknown authors rank equal to FHFHockey

## M-LINE-024 Line claim decision: context, certainty and binding

- **Match:** Opus only; Opus LINE-017; Codex —
- **Purpose:** Turn a parsed lineup post into per-claim context/phase, certainty and game binding.
- **Where:** `web/lib/lines/decisions.ts:31 (decideContext)`; `web/lib/lines/decisions.ts:42 (decideBinding)`; `web/lib/lines/decisions.ts:89 (produceLineEvidence)`; `web/lib/lines/binding.ts:1`
- **Tags (heuristic):** generation: current
- **Opus view (LINE-017):**
  - Method: Context from explicit cue spans only (practice > in-game > warmup > projected > game); certainty = projected if marker/context projected, confirmed only if marker confirmed and author may confirm, else reported; binding requires one opponent + one calendar date, or a single relative day word in team timezone; publication only from trusted provider clocks.
  - Inputs/units: —; sources: line_source_snapshots
  - Output scale: categorical; writes: —
  - Status: live — lines processor
  - Consumers: reconcile
- **Audit context:**
  - Intent (Opus): web/lib/lines/decisions.ts:26-30, 41, 85-88 docblocks
  - External references: Daily Faceoff confirmed vs projected labels
  - Fixtures/test data: `web/lib/sources/fixtures/claimContextCases.json`
  - Tests: `web/lib/lines/binding.test.ts`; `web/lib/lines/decisions.test.ts`; `web/lib/lines/sourceClaims.test.ts`

## M-LINE-025 PP unit carry-forward, staleness and swaps

- **Match:** Opus only; Opus LINE-018; Codex —
- **Purpose:** Carry the latest accepted in-game PP unit to later games until superseded, a player is out, or 3 team games pass; apply partial swaps.
- **Where:** `web/lib/lines/reconcile.ts:158 (PP_STALE_GAMES)`; `web/lib/lines/reconcile.ts:161 (deriveSwap)`; `web/lib/lines/reconcile.ts:177 (reconcilePP)`
- **Tags (heuristic):** denominators: per team game; generation: current
- **Opus view (LINE-018):**
  - Method: PP unit valid only if explicit number, complete, 5 players; carried unit ends if a later different report exists (superseded), a member is reported out/left roster, or elapsed team games since anchor >= 3; newest swap after base applied if playersOut subset and playersIn disjoint.
  - Inputs/units: game counts; sources: line_claims, line_pp_decisions
  - Output scale: categorical; writes: line_pp_decisions
  - Status: live — lines service
  - Consumers: /lines pages; FORGE PP role evidence (daily board evidence)
- **Audit context:**
  - Intent (Opus): web/lib/lines/reconcile.ts:160 docblock
  - External references: Daily Faceoff PP unit reports
  - Fixtures/test data: none listed
  - Tests: `web/lib/lines/ppRules.test.ts`; `web/lib/lines/reconcile.test.ts`
- **Leads (not audited):**
  - (opus) PP_STALE_GAMES=3 is a magic constant

## M-LINE-026 Entry lineup selection (context rank > authority > recency) and freeze

- **Match:** Opus only; Opus LINE-019; Codex —
- **Purpose:** Select the published entry lineup per unit from eligible claims, detect conflicts, freeze at puck drop.
- **Where:** `web/lib/lines/reconcile.ts:71 (contextRank)`; `web/lib/lines/reconcile.ts:76 (selectUnits)`; `web/lib/lines/reconcile.ts:93 (reconcileEntry)`; `web/lib/lines/reconcile.ts:45 (activeLineClaims)`; `web/lib/lines/gameState.ts:6 (trustworthyState)`
- **Tags (heuristic):** generation: current
- **Opus view (LINE-019):**
  - Method: Sort per unit by context rank (warmup 3 > game 2 > practice 1 > projected 0), then authority weight, then claim time; peers with equal rank+authority but different player sets -> conflict; designation confirmed/projected/reported. Freeze when live or final with actual start; live state trusted only if observed within 5 min (LIVE_STATE_MAX_AGE_MS). One interpretation per original post (relays collapse).
  - Inputs/units: timestamps; sources: line_claims / line_entry_revisions / line_game_state_observations
  - Output scale: categorical designation; writes: line_entry_revisions
  - Status: live — lines service
  - Consumers: /lines pages (service.ts)
- **Audit context:**
  - Intent (Opus): web/lib/lines/reconcile.ts:70 comment; reconcile.ts:108-109, 133-134 comments
  - External references: Daily Faceoff line confirmation workflow (warmups > morning skate > practice)
  - Fixtures/test data: none listed
  - Tests: `web/lib/lines/processor.test.ts`; `web/lib/lines/reconcile.test.ts`; `web/lib/lines/service.test.ts`
- **Leads (not audited):**
  - (opus) no numeric confidence - ordering is lexicographic, so one beat reporter outranks any number of aggregator posts

## M-LINE-027 Injury attribute confidence + severity tier

- **Match:** Opus only; Opus LINE-020; Codex —
- **Purpose:** Classify injury text into severity tier and attribute confidence.
- **Where:** `web/lib/sources/injuryStatusIngestion.ts:283`
- **Tags (heuristic):** generation: current
- **Opus view (LINE-020):**
  - Method: severityTier severe/moderate/minor/unknown from phrases; confidence high if tier known and (region or limitations), medium if any one known, else low.
  - Inputs/units: —; sources: injury status sources
  - Output scale: ordinal; writes: —
  - Status: live — injury ingestion
  - Consumers: injury ingestion -> availability evidence
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/sources/injuryStatusIngestion.test.ts`

## M-LINE-028 First-arrival winner per lineup signal bucket

- **Match:** Opus only; Opus LINE-021; Codex —
- **Purpose:** Decide which source group (GDL suite / DFO / NHL rosters) reported a lineup signal first.
- **Where:** `web/lib/sources/lineSourceFirstArrival.ts:83 (selectFirstArrivalBuckets)`; `web/lib/sources/lineSourceFirstArrival.ts:40 (getFirstArrivalTimestamp)`
- **Tags (heuristic):** generation: current
- **Opus view (LINE-021):**
  - Method: Bucket = date\|team\|game\|signalType\|subtype; timestamp = tweetPostedAt else observedAt; earliest wins, ties by sourceKey, tweetId, captureKey.
  - Inputs/units: ISO timestamps; sources: line_source_snapshots
  - Output scale: ordering; writes: —
  - Status: live — line source processing
  - Consumers: line source processing / timing reports
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/sources/lineSourceFirstArrival.test.ts`
- **Leads (not audited):**
  - (opus) mixes provider post time and our observation time in one comparison - an observed-only row can beat a later-posted but earlier-real tweet

## M-LINE-029 Tweet claim extraction precision/recall (prospective evaluation)

- **Match:** Opus only; Opus LINE-023; Codex —
- **Purpose:** Offline precision/recall/exception rate of claim extraction against adjudicated labels; Luna review label matching.
- **Where:** `web/lib/sources/tweetClaimEvaluation.ts:49 (evaluateForwardTweetClaims)`; `web/lib/sources/tweetLunaEvaluationScoring.ts:9 (scoreLunaEvaluation)`
- **Tags (heuristic):** percent scale: fraction 0-1; generation: research, development
- **Opus view (LINE-023):**
  - Method: Group by origin document (relays one vote); only documents with exactly one complete label count; TP/FP/FN over claim keys; precision = TP/(TP+FP), recall = TP/(TP+FN), exceptionRate = docs with pending support / docs. Luna: exact match of identity/goalie/decision labels, relevance predicate probability > 0.5.
  - Inputs/units: counts; sources: retained evaluation export
  - Output scale: fractions 0-1; writes: —
  - Status: draft — offline evaluation only (env TWEET_CLAIMS_EVALUATION_ID)
  - Consumers: offline evaluation scripts
- **Audit context:**
  - Intent (Opus): web/lib/sources/tweetClaimEvaluation.ts:29, 48 docblocks
  - External references: Standard IR precision/recall
  - Fixtures/test data: `web/lib/sources/fixtures/tweetLunaEvaluation.ts`; `web/lib/sources/fixtures/tweetLunaAdjudicatedLibrary.json`
  - Tests: `web/lib/sources/tweetClaimEvaluationBounds.test.ts`; `web/lib/sources/tweetClaimEvaluationIntake.test.ts`; `web/lib/sources/tweetLunaReview.test.ts`

## M-LINE-030 News inference auto-publish confidence thresholds

- **Match:** Opus only; Opus LINE-024; Codex —
- **Purpose:** Gate LLM news/injury inference for auto-publish by category-specific confidence.
- **Where:** `web/lib/sources/tweetNewsInference.ts:271 (minimumPublishConfidence)`; `web/lib/sources/tweetNewsInference.ts:403`
- **Tags (heuristic):** generation: current
- **Opus view (LINE-024):**
  - Method: Publish iff confidence >= threshold (REPORTED INJURY 0.86, NEWS UPDATE 0.88, SIGNING 0.95, other 0.92) and no validation errors.
  - Inputs/units: probability 0-1; sources: tweet news review rows
  - Output scale: boolean; writes: —
  - Status: live — tweet news automation
  - Consumers: tweet news automation / homepage news
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/sources/tweetNewsInference.test.ts`
- **Leads (not audited):**
  - (opus) thresholds applied to LLM self-reported confidence, uncalibrated

## M-LINE-031 Shift-chart pair shared TOI and %TOI-with (route)

- **Match:** Opus only; Opus LINE-029; Codex —
- **Purpose:** Per game, compute same-team pairwise overlap seconds and percent of game together; assign forward lines/D pairs.
- **Where:** `web/pages/api/v1/db/shift-charts.ts:721 (upsertShiftChartData)`; `web/pages/api/v1/db/shift-charts.ts:415 (generateTeamLogs)`; `web/pages/api/v1/db/shift-charts.ts:382 (getPairwiseTOI)`; `web/pages/api/v1/db/shift-charts.ts:306 (sumDurations)`
- **Tags (heuristic):** percent scale: 0-100; generation: current
- **Opus view (LINE-029):**
  - Method: Overlap seconds = sum over same-period shift pairs of max(0, min(end)-max(start)). percent_toi_with = overlap / game_length_seconds * 100 (2 dp), split into same-position-type (time_spent_with) vs mixed. Lines: forwards sorted by game TOI, pivot = highest unused, linemates = top-2 by time_spent_with with pivot; 4 lines; D pairs top-1, 3 pairs.
  - Inputs/units: seconds; positions as codes; sources: NHL shiftcharts, yahoo_positions, rosters/players (relationship roster positions)
  - Output scale: percent 0-100 (string, 2dp); MM:SS strings; line 1..4, pair 1..3; writes: shift_charts
  - Status: live — update-shift-charts pg_cron 07:45 UTC (/api/v1/db/update-shifts delegates to shift-charts)
  - Consumers: DateRangeMatrix (drm page); FORGE buildStrengthTablesV2; lineup deployment tallies via shift_charts source
- **Audit context:**
  - Intent (Opus): web/pages/api/v1/db/shift-charts.ts:2-41 header: critical ingestion step for player TOI and line combinations
  - External references: NST line/pair TOI (5v5 'TOI together'), Dobber/LeftWingLock line combos
  - Fixtures/test data: none listed
  - Tests: `web/__tests__/pages/api/v1/db/shift-charts.audit.test.ts`; `web/__tests__/pages/api/v1/db/shift-charts.queue.test.ts`; `web/__tests__/pages/api/v1/db/shift-charts.transactional.test.ts`
- **Leads (not audited):**
  - (opus) overlap is ALL situations (PP/PK included) - unlike NST 5v5 line TOI and unlike team_unit_toi (5v5 only)
  - (opus) percent_toi_with denominator is game length, whereas DateRangeMatrix percentToiWith divides by the player's own TOI (fetchAggregatedData.ts:1206) - same field name, different definitions
  - (opus) local getPairwiseTOI is called with playerData.shifts (only p1's shifts) so p2Shifts is empty for p1!=p2; the resulting pairwiseTOI map is also unused by generateTeamLogs (dead/broken compute)
  - (opus) isForward accepts only LW/RW/C - if primary_position is 'L'/'R' (players.position style) wingers fall out of line assignment; depends on relationshipPlayerPosition output

## M-LINE-032 PP TOI % per game chart bands

- **Match:** Opus only; Opus LINE-030; Codex —
- **Purpose:** Colour PP TOI % trend segments by thresholds.
- **Where:** `web/components/PlayerPPTOIPerGameChart/PPTOIChart.tsx:393`
- **Tags (heuristic):** generation: current
- **Opus view (LINE-030):**
  - Method: Segment colour: <0.5 low, 0.5-0.75 medium, >0.75 high (on the previous point's value).
  - Inputs/units: fraction 0-1; sources: sko_pp_stats
  - Output scale: categorical band; writes: —
  - Status: live — team PP TOI chart
  - Consumers: PPTOIChart (team pages)
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/components/PlayerPPTOIPerGameChart/PPTOIChart.test.tsx`
- **Leads (not audited):**
  - (opus) thresholds 0.5/0.75 undocumented; pp_toi_pct_per_game is WGO 0-1 fraction computed outside this slice

## M-LINE-033 PowerPlayCombos unit card PP stats

- **Match:** Opus only; Opus LINE-031; Codex —
- **Purpose:** Aggregate PPG/PPA/PP SOG/PP TOI for current PP unit members over the card window (last 10 team games default).
- **Where:** `web/components/PowerPlayCombos/PowerPlayCombos.tsx:450 (loadPpStats)`; `web/components/PowerPlayCombos/PowerPlayCombos.tsx:338 (unit history ordering)`
- **Tags (heuristic):** denominators: per team game; generation: current
- **Opus view (LINE-031):**
  - Method: games = rows; assists = PPP - PPG; shots and TOI summed from FORGE strength rows; window = statsGameIds or last PP_STATS_GAMES team games (query limit PP_STATS_GAMES*25 rows); PP shot share pulled from /api/v1/splits.
  - Inputs/units: seconds; counts; sources: skatersGameStats, forge_player_game_strength, powerPlayCombinations, games, rosters
  - Output scale: counts; seconds; writes: —
  - Status: live
  - Consumers: PowerPlayCombos component (/lines, game pages)
- **Audit context:**
  - Intent (Opus): web/components/PowerPlayCombos/PowerPlayCombos.tsx:436-439 comment
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/components/PowerPlayCombos/PowerPlayCombos.test.tsx`
- **Leads (not audited):**
  - (opus) games counted from NHL rows but shots/TOI only for FORGE rows that exist - mixed denominators if FORGE rows missing

## M-LINE-034 Player TOI / PP TOI share series (/api/toi)

- **Match:** Opus only; Opus LINE-033; Codex —
- **Purpose:** Per player-game TOI minutes and PP TOI share for the TimeOnIce chart.
- **Where:** `web/pages/api/toi.ts:125 (buildToiSeries)`; `web/pages/api/toi.ts:163 (parseTime)`
- **Tags (heuristic):** percent scale: 0-100; denominators: per 60; generation: current
- **Opus view (LINE-033):**
  - Method: toi minutes = MM:SS -> minutes; powerPlayToi = toi_pp_seconds/60; share = min(100, ppMinutes / team powerPlayToi minutes * 100) using the team the player dressed for.
  - Inputs/units: minutes (TOI), seconds (FORGE PP); sources: skatersGameStats, forge_player_game_strength, teamGameStats, seasons
  - Output scale: minutes; percent 0-100; writes: —
  - Status: live — TimeOnIceChart (charts pages)
  - Consumers: web/components/TimeOnIceChart/TimeOnIceChart.tsx
- **Audit context:**
  - Intent (Opus): web/pages/api/toi.ts:120-124 docblock
  - External references: NST PP TOI% (individual PP TOI / team PP TOI)
  - Fixtures/test data: none listed
  - Tests: `web/__tests__/pages/api/toi.test.ts`
- **Leads (not audited):**
  - (opus) numerator is shift-derived PP (situation-code based) while denominator is NHL teamGameStats powerPlayToi - different PP definitions; share clamped at 100 hides mismatches

## M-LINE-035 Penalty PP timeframes (legacy per-penalty blocks + details)

- **Match:** Opus only; Opus LINE-035; Codex —
- **Purpose:** Write one row per penalty with duration and whether it ended by goal to pp_timeframes.
- **Where:** `web/utils/getPowerPlayBlocks.ts:197 (getPenaltyPowerPlayBlocks)`; `web/utils/extractPPDetails.ts:58 (extractPowerPlayDetails)`; `web/pages/api/v1/db/powerPlayTimeFrame.ts:105`
- **Tags (heuristic):** generation: current
- **Opus view (LINE-035):**
  - Method: getPenaltyPowerPlayBlocks: per penalty (duration>=2) end = start+duration, minor ends at first PP goal, double minor ends at first goal if <2:00 remained else second goal; coincident same-time pairs net their durations. extractPowerPlayDetails: goalsNeededToEnd = 1 for 2-min, 2 for 4-min; duration = end-start; cross-period blocks additionally split into two period rows.
  - Inputs/units: minutes (penalty duration) -> seconds; sources: NHL play-by-play, games
  - Output scale: seconds per PP; writes: pp_timeframes
  - Status: live — pg_cron update-power-play-timeframes 07:55 UTC (/api/v1/db/powerPlayTimeFrame?gameId=all)
  - Consumers: web/lib/game-predictions/evaluation.ts:440 (reads pp_timeframes)
- **Audit context:**
  - Intent (Opus): web/utils/getPowerPlayBlocks.ts:187-196 docblock (one block per penalty, not manpower)
  - External references: NHL penalty rules; NST PP opportunities/TOI
  - Fixtures/test data: none listed
  - Tests: `web/__tests__/pages/api/v1/db/cron-audit-wrappers.test.ts`
- **Leads (not audited):**
  - (opus) playTypeKeyToCode maps 'minor'/'major' but details.typeCode values are 'MIN'/'MAJ', so penaltyTypeCode is '' and powerPlayGoal is always 'N' (no early end)
  - (opus) double minor requires 2 goals to end (rule: first goal ends only the current 2 min)
  - (opus) cross-period PPs are pushed three times (whole + two splits) -> double-counted duration
  - (opus) blocks overlap and treat misconducts as PPs (docblock getPowerPlayBlocks.ts:187-190 says 'It is not manpower')

## M-LINE-036 Power-play blocks (manpower advantage timeline)

- **Match:** Opus only; Opus LINE-036; Codex —
- **Purpose:** Simulate the penalty box second-by-second to produce non-overlapping stretches where a team has a skater advantage.
- **Where:** `web/utils/getPowerPlayBlocks.ts:401 (getPowerPlayBlocks default)`; `web/utils/getPowerPlayBlocks.ts:317 (getManpowerSegments)`; `web/utils/getPowerPlayBlocks.ts:335 (getPenaltiesAfterCancelling)`
- **Tags (heuristic):** generation: current
- **Opus view (LINE-036):**
  - Method: Game second = (period-1)*1200 + clock; minors 120 s endsOnGoal, double minor = two 120 s segments, major 300 s no early end; MIS/GAM/GMIS ignored; coinciding penalties cancel minor-for-minor and major-for-major across teams; max 2 serving per team, rest wait; a goal by the team with fewer in the box ends the opponent's earliest-expiring minor segment; block opens whenever serving counts differ. Shootout plays excluded; runs to last event second.
  - Inputs/units: seconds (MM:SS clocks); sources: NHL api-web play-by-play
  - Output scale: time blocks (period + MM:SS); writes: —
  - Status: live — via update-power-play-combinations pg_cron 08:05 UTC and UI
  - Consumers: update-power-play-combinations (team PP seconds + pp-toi matrix); LinemateMatrix pp-toi mode; ShiftChart replay PP shading; PowerPlayAreaIndicators
- **Audit context:**
  - Intent (Opus): web/utils/getPowerPlayBlocks.ts:392-399 docblock (minor ends early on goal, double minor loses current 2 min, coinciding cancel, max two serving)
  - External references: NHL Rule 16/19 penalty and coincidental-penalty rules; NST PP TOI from situation codes
  - Fixtures/test data: none listed
  - Tests: `web/__tests__/pages/api/v1/db/update-power-play-combinations-game.test.ts`; `web/components/ShiftChart/model.test.ts`
- **Leads (not audited):**
  - (opus) assumes every period is 1200 s (NORMAL_PERIOD_IN_SECONDS); regular-season OT is 300 s so OT clock mapping is fine but 'gameEnd' = last event second truncates PPs running to period end
  - (opus) penalty-shot and delayed-penalty nuances, and 'serving' when a goalie penalty is served by another player, not modelled
  - (opus) independent from PBP situationCode-based PP used by buildShiftStrengthUpserts - two PP definitions coexist

## M-LINE-037 Per-player ES/PP/PK TOI from shifts (strengthForTeam)

- **Match:** Opus only; Opus LINE-037; Codex —
- **Purpose:** Split each player's shift seconds into even-strength, power-play and penalty-kill TOI.
- **Where:** `web/lib/projections/ingest/shifts.ts:112 (strengthForTeam)`; `web/lib/projections/ingest/shifts.ts:596 (buildShiftStrengthUpserts)`; `web/lib/projections/ingest/shifts.ts:903 (upsertShiftTotalsForGameFromPbp)`
- **Tags (heuristic):** generation: current
- **Opus view (LINE-037):**
  - Method: For each shift (end=0 sentinel -> start+duration, must equal playedEnd), overlap seconds with each situation segment; strength = 'pp' if own skaters > opp skaters, 'pk' if fewer, else 'es' (goalie digits ignored). Requires covered seconds == duration and es+pp+pk == duration; totals summed per player and formatted MM:SS.
  - Inputs/units: seconds (clock strings MM:SS parsed); sources: NHL stats shiftcharts API / stored shift snapshot, PBP
  - Output scale: MM:SS strings per player-game; writes: shift_charts (total_es_toi,total_pp_toi,total_pk_toi)
  - Status: live — update-shift-charts pg_cron 07:45 UTC
  - Consumers: shift_charts consumers (DateRangeMatrix, FORGE strength tables buildStrengthTablesV2, rolling metrics)
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED (only inline error contracts)
  - External references: NST strength-state convention (5v5 / PP / SH by skater counts incl. goalie pull handling)
  - Fixtures/test data: none listed
  - Tests: `web/__tests__/pages/api/v1/db/ingest-projection-inputs.test.ts`; `web/__tests__/pages/api/v1/db/shift-charts.transactional.test.ts`
- **Leads (not audited):**
  - (opus) strength is by skater count only - 6v5 extra-attacker time is labelled PP for the trailing team and PK for the leader; 4v4/3v3 OT counted as ES (NST keeps EN and 4v4 separate)
  - (opus) shift-charts relationship contract labels every non-PP interval 'es_shifts' so PK time is mixed into ES arrays (shift-charts.ts:878-879 comment)

## M-LINE-038 PBP situation timeline per period

- **Match:** Opus only; Opus LINE-038; Codex —
- **Purpose:** Turn PBP situationCode events into contiguous per-period strength segments used to slice shift TOI.
- **Where:** `web/lib/projections/ingest/shifts.ts:99 (parseSituationDigits)`; `web/lib/projections/ingest/shifts.ts:156 (buildSituationTimelineForPeriod)`
- **Tags (heuristic):** generation: current
- **Opus view (LINE-038):**
  - Method: Per period: nominalLength = timeInPeriod+timeRemaining (must be constant); playedEnd = period-end/game-end time; events sorted by time, sortOrder, eventId; last event at each timestamp owns the state; segment [t_i, t_{i+1}) carries that event's 4-digit situation code (awayG, awaySk, homeSk, homeG regex ^[01][0-6][0-6][01]$). Requires coverage from 0 to playedEnd with no gaps, else throws.
  - Inputs/units: seconds elapsed in period (int); sources: NHL api-web gamecenter play-by-play (stored projection PBP)
  - Output scale: per-period segment list (seconds); writes: —
  - Status: live — used by update-shift-charts pg_cron 07:45 UTC via /api/v1/db/update-shifts -> shift-charts.ts
  - Consumers: buildShiftStrengthUpserts; buildShiftRelationshipStrengthSegments; shift-charts route
- **Audit context:**
  - Intent (Opus): web/lib/projections/ingest/shifts.ts:817-821 comment: split every validated shift interval against the same complete PBP situation timeline used for strength totals
  - External references: NHL PBP situationCode convention; NST/Evolving-Hockey derive strength from on-ice player counts in shift charts rather than event-sampled codes
  - Fixtures/test data: `web/__tests__/fixtures/nst`; `web/components/ShiftChart/testFixtures.ts`
  - Tests: `web/__tests__/pages/api/v1/db/ingest-projection-inputs.test.ts`; `web/__tests__/pages/api/v1/db/shift-charts.audit.test.ts`; `web/__tests__/pages/api/v1/db/shift-charts.queue.test.ts`
- **Leads (not audited):**
  - (opus) situation code is sampled at events, so a penalty expiring between events leaves a stale code until the next event (exactFivePpUnits.ts:21-25 documents this exact problem) - ES/PP/PK splits inherit it
  - (opus) no cross-check against shift-derived on-ice counts here (exactFivePp does cross-check; this live path does not)

## M-LINE-039 Event on-ice attribution + team strength state

- **Match:** Opus only; Opus LINE-039; Codex —
- **Purpose:** Attach home/away on-ice players and a per-team strength state to each PBP event.
- **Where:** `web/lib/supabase/Upserts/nhlOnIceAttribution.ts:48 (buildOnIceAttributionForEvent)`; `web/lib/supabase/Upserts/nhlOnIceAttribution.ts:133 (isPlayerOnIce/arePlayersOnIceTogether/isEntityOnIce)`
- **Tags (heuristic):** generation: current
- **Opus view (LINE-039):**
  - Method: Finds stint at event second; owner/opponent player sets by event_owner_team_id; strengthState via classifyTeamStrengthState(parseSituationCode(situation_code)) for each team.
  - Inputs/units: seconds; sources: nhl_api_pbp_events (parsed), nhl_api_shift_rows
  - Output scale: categorical strength + id lists; writes: —
  - Status: live — normalized NHL layer
  - Consumers: nhlContextualFeatures; on-ice xG/shot features (xG agent slice)
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: Evolving-Hockey / NST on-ice event attribution
  - Fixtures/test data: none listed
  - Tests: `web/lib/supabase/Upserts/nhlOnIceAttribution.test.ts`
- **Leads (not audited):**
  - (opus) strength from the event's situation code, while stint player counts are not cross-checked (can disagree on stale codes)

## M-LINE-040 Shift interval normalization + stint sweep

- **Match:** Opus only; Opus LINE-040; Codex —
- **Purpose:** Normalize NHL shift rows to integer intervals and build contiguous on-ice stints for event on-ice attribution.
- **Where:** `web/lib/supabase/Upserts/nhlShiftStints.ts:84 (normalizeShiftInterval)`; `web/lib/supabase/Upserts/nhlShiftStints.ts:136 (normalizeShiftIntervals)`; `web/lib/supabase/Upserts/nhlShiftStints.ts:195 (buildShiftStints)`; `web/lib/supabase/Upserts/nhlShiftStints.ts:270 (findShiftStintAtTime)`
- **Tags (heuristic):** denominators: per game; generation: current
- **Opus view (LINE-040):**
  - Method: end<=start -> end=start+duration; dedupe on (game,player,team,period,start,end) keeping lowest shift_id; per game-period sweep over all start/end boundaries, players active if interval overlaps; adjacent identical stints merged. Event lookup prefers a stint ENDING exactly at the event second, else the one containing it.
  - Inputs/units: seconds in period; sources: nhl_api_shift_rows
  - Output scale: stint intervals (seconds); writes: —
  - Status: live — used by normalized NHL layer / xG feature builders
  - Consumers: nhlOnIceAttribution.buildOnIceAttributionForEvent; nhlContextualFeatures; nhlShotFeatureBuilder (xG pipeline)
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: NHL shift-chart on-ice attribution convention (players on at event time; outgoing players credited at a change second)
  - Fixtures/test data: none listed
  - Tests: `web/lib/supabase/Upserts/nhlNormalizedLayer.test.ts`; `web/lib/supabase/Upserts/nhlOnIceAttribution.test.ts`; `web/lib/supabase/Upserts/nhlShiftStints.test.ts`
- **Leads (not audited):**
  - (opus) tie-break at a change second credits outgoing players; NST/MoneyPuck conventions differ by event type (faceoffs credit incoming players)
  - (opus) goalies are included in playerIds; no skater/goalie distinction here

## M-LINE-041 team_unit_toi 5v5 forward-line / D-pair pooled TOI

- **Match:** Opus only; Opus LINE-041; Codex —
- **Purpose:** Derive per-game 5v5 forward trios and D pairs with pooled player-seconds and rank them as units 1..N.
- **Where:** `web/lib/rankings/teamUnitToiBuilder.ts:264 (buildEvenStrengthTeamUnitToiRows)`; `web/lib/rankings/teamUnitToiBuilder.ts:218 (emitRankedRows)`; `web/lib/rankings/teamUnitToiBuilder.ts:94 (positionGroup)`
- **Tags (heuristic):** denominators: per game; generation: current
- **Opus view (LINE-041):**
  - Method: Per game-period sweep over all shift boundaries; segment counted only when exactly two teams are active and each has 5 skaters (F or D, goalies excluded); a team's segment then needs exactly 3F+2D. forwardSeconds = duration*3, defenseSeconds = duration*2 credited to the sorted-id unit key and to the team pool. Units ranked by pooled seconds desc -> unit_number. coverage 'partial' if any skater position unclassified.
  - Inputs/units: seconds; sources: nhl_api_shift_rows, players
  - Output scale: pooled seconds; unit rank 1..N; writes: team_unit_toi
  - Status: live — pg_cron update-team-unit-toi-nightly 08:55 UTC (season=20262027&mode=nightly, max 40 games/run)
  - Consumers: web/lib/rankings/trending.ts; web/lib/rankings/teamMatrix.ts; web/lib/rankings/availableFilters.ts; Rankings caveatLabels
- **Audit context:**
  - Intent (Opus): web/lib/rankings/teamUnitToiBuilder.ts:103-105 comment (unclassified skaters break the 5v5 count); metadata secondsBasis 'overlap_segments_multiplied_by_unit_player_count'
  - External references: NST line/pair 5v5 TOI (clock seconds together), Evolving-Hockey line tools
  - Fixtures/test data: `web/lib/rankings/fixtures/rankingsTrust.json`
  - Tests: `web/__tests__/pages/api/v1/db/update-team-unit-toi.test.ts`; `web/lib/rankings/teamUnitToiBuilder.test.ts`; `web/lib/rankings/teamUnitToiNightly.test.ts`; `web/lib/rankings/teamUnitToiWriter.test.ts`
- **Leads (not audited):**
  - (opus) unit_toi_seconds is pooled player-seconds (clock*3 for lines, *2 for pairs), not clock time; share = unit/pool is fine but absolute 'TOI' is 3x/2x NST line TOI
  - (opus) 5v5 detected from shift skater counts, not goalie presence; 5v5 with an empty net (6v5 minus a skater) or shift-feed gaps are misclassified
  - (opus) activeShiftsForSegment uses start<=s && end>=e so back-to-back shift boundaries are handled, but missing shifts silently drop segments (no unknown accounting)
  - (opus) cron route hard-codes season=20262027 in pg_cron URL

## M-LINE-042 team_unit_toi power-play units (from powerPlayCombinations)

- **Match:** Opus only; Opus LINE-042; Codex —
- **Purpose:** Write PP1/PP2/PP3 unit rows per team-game by summing player PPTOI within the stored PP unit label.
- **Where:** `web/lib/rankings/teamUnitToiBuilder.ts:379 (buildPowerPlayTeamUnitToiRows)`
- **Tags (heuristic):** generation: current
- **Opus view (LINE-042):**
  - Method: Team = team of player's shifts in that game; pool = sum PPTOI across all the team's PP rows; unit pooled seconds = sum PPTOI of players labelled unit k; player_ids = set of labelled players (can exceed 5).
  - Inputs/units: seconds; sources: powerPlayCombinations, nhl_api_shift_rows
  - Output scale: pooled seconds; writes: team_unit_toi
  - Status: live — same nightly job as 5v5 rows
  - Consumers: rankings trending / team matrix
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED (metadata secondsBasis 'sum_powerPlayCombinations_player_PPTOI_by_unit')
  - External references: NST PP unit TOI (clock seconds of 5-man group on 5v4)
  - Fixtures/test data: none listed
  - Tests: `web/lib/rankings/teamUnitToiBuilder.test.ts`
- **Leads (not audited):**
  - (opus) PP units here are rank buckets of individual PPTOI (top-5/next-5/rest from sortByPPTOI), not observed five-man groups; exactFivePp (offline) is the observed-group alternative
  - (opus) PPTOI pooled across 5v4, 5v3, 4v3 and 6v5-with-skater-advantage blocks

## M-LINE-043 team_unit_toi shift cleanup + nightly planning/completeness

- **Match:** Opus only; Opus LINE-043; Codex —
- **Purpose:** Repair duplicate/off-game shifts before unit build; choose up to 40 missing completed games; mark games complete.
- **Where:** `web/lib/rankings/teamUnitToiBuilder.ts:486 (cleanTeamUnitToiShifts)`; `web/lib/rankings/teamUnitToiNightly.ts:23 (planTeamUnitToiNightly)`; `web/lib/rankings/teamUnitToiNightly.ts:47 (completeGameIds)`
- **Tags (heuristic):** generation: current
- **Opus view (LINE-043):**
  - Method: Drop exact duplicate (game,player,period,start,end) and shifts whose team is not home/away; nightly picks oldest pending game types 2,3, max 40; a game is complete when unit_number 1 forward_line and defense_pair exist for both teams.
  - Inputs/units: —; sources: nhl_api_shift_rows, games, team_unit_toi
  - Output scale: counts / id sets; writes: team_unit_toi (via writer)
  - Status: live — nightly 08:55 UTC
  - Consumers: update-team-unit-toi route
- **Audit context:**
  - Intent (Opus): web/lib/rankings/teamUnitToiBuilder.ts:476-483 comment (NHL served game 2025020565 with mixed VGK/SJS shifts)
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/__tests__/pages/api/v1/db/update-team-unit-toi.test.ts`; `web/lib/rankings/teamUnitToiNightly.test.ts`
- **Leads (not audited):**
  - (opus) completeness only requires a top unit per team, so a game with large shift gaps still counts as complete

