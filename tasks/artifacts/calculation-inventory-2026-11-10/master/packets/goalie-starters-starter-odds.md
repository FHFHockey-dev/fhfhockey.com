# Audit packet: Goalie starters & starter odds

Master entries M-GST-001 to M-GST-020 (20 of 20 in this family). Built from the merged Opus and Codex inventories; see [../MASTER.md](../MASTER.md) and [../MERGE-NOTES.md](../MERGE-NOTES.md).

How to read: each entry gives both inventories' descriptions side by side. **Conflicts** are places where the two descriptions disagree; they are unresolved. **Leads** are Opus red flags and Codex unknowns: observations to check, not audited findings. Tags are keyword heuristics. Line numbers were valid when each inventory was written on 2026-11-10 (Opus at d31dcb33f, Codex at 11e4192d3); re-check against the current checkout.

| ID | Name | Match | Conflicts | Leads |
|---|---|---|---:|---:|
| M-GST-001 | fn process_team_goalie_projections (+ calculate_goalie_start_projecti… | Both | 0 | 5 |
| M-GST-002 | Goalie start probability and GSAA/60 (goalie_start_projections v2) | Both | 0 | 7 |
| M-GST-003 | Legacy SQL calculate_goalie_start_projections | Both | 0 | 4 |
| M-GST-004 | goalie_start_projections v2 (L10 start share + GSAA/60) | Both | 0 | 7 |
| M-GST-005 | Starter board scoring (fantasy points, participation integration, ran… | Both | 0 | 5 |
| M-GST-006 | FORGE starter probability model (computeStarterProbabilities) | Both | 0 | 5 |
| M-GST-007 | Starter candidate selection + scenario blend | Both | 0 | 3 |
| M-GST-008 | RSO goalie likely-starter mark (p >= 0.5) | Opus only | 0 | 1 |
| M-GST-009 | Starter board operations SLO report (on-time share, nearest-rank late… | Opus only | 0 | 1 |
| M-GST-010 | Goalie board heat level and best/worst tie handling | Opus only | 0 | 1 |
| M-GST-011 | Goalie inventory team lenses (pooled per-game team rates, PP%, PK%, l… | Opus only | 0 | 2 |
| M-GST-012 | Goalie inventory rank band, strength share and head-to-head winner | Opus only | 0 | 2 |
| M-GST-013 | Social share team start share (official starts / team games over last… | Opus only | 0 | 2 |
| M-GST-014 | Goalie share / workload by team (L10/L20/L30/Season) | Opus only | 0 | 1 |
| M-GST-015 | News/evidence goalie override (confirmed/likely) | Opus only | 0 | 1 |
| M-GST-016 | Best goalie-start source selection (news/model precedence + TTL) | Opus only | 0 | 1 |
| M-GST-017 | Starter board validation / promotion gate | Opus only | 0 | 0 |
| M-GST-018 | Goalie starter mixture (B2B adjust, normalize, confidence, staleness) | Opus only | 0 | 3 |
| M-GST-019 | Team goalie starter context + line-combo goalie prior | Opus only | 0 | 1 |
| M-GST-020 | Skater variance (production proxy SD) | Opus only | 0 | 1 |

## M-GST-001 fn process_team_goalie_projections (+ calculate_goalie_start_projections)

- **Match:** Both; Opus GST-001; Codex legacy-sql-goalie-start-share, sql-goalie-projection-legacy
- **Purpose:** Legacy goalie start probability and projected GSAA/60 per team-game from last 10 team games
- **Where:** `supabase/migrations/20260716112908_production_schema_baseline.sql:2677 (process_team_goalie_projections)`; `migrations/20251126_calculate_goalie_projections.sql:28 (original, identical logic)`; `supabase/migrations/20260730193000_repair_compile_invalid_legacy_routines.sql:8 (calculate_goalie_start_projections -> tombstone raising 'Legacy RPC retired')`; `supabase/migrations/20260716112908_production_schema_baseline.sql:704 (calculate_goalie_start_projections loop, superseded)`; `migrations/20251126_calculate_goalie_projections.sql:28 process_team_goalie_projections`; `supabase/migrations/20260716112908_production_schema_baseline.sql:2677 process_team_goalie_projections; migrations/20251126_calculate_goalie_projections.sql:28; supabase/migrations/20260730193000_repair_compile_invalid_legacy_routines.sql:8 tombstones calculate_goalie_start_projections`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: per 60; generation: legacy, current
- **Opus view (GST-001):**
  - Method: last 10 team dates before p_date; per goalie SUM(games_started), SUM(shots_against), SUM(goals_against), SUM(time_on_ice). start_probability = starts / total starts in window. projected_gsaa_per_60 = ((SA * 0.900) - GA) / TOI * 60 with league sv% hard-coded 0.900.
  - Inputs/units: TOI assumed minutes (unverified); counts; sources: teams, wgo_team_stats, wgo_goalie_stats
  - Output scale: probability 0-1; per-60 rate; writes: goalie_start_projections (upsert on game_id,player_id)
  - Status: legacy/dead — coordinator calculate_goalie_start_projections tombstoned (20260730193000); no web/ caller of process_team_goalie_projections
  - Consumers: calculate_goalie_start_projections (now tombstoned); update-goalie-projections-v2 route replaced it
- **Codex view (legacy-sql-goalie-start-share, calculation, location; Codex family 'Legacy SQL goalie projections'):** Legacy goalie start share
  - Purpose: Last-10 team-date goalie starts divided by total starts; zero if zero denominator.
  - Inputs/units: wgo_goalie_stats starts; last 10 wgo_team_stats dates.
  - Output scale: start_probability fraction.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "deployment": "Unknown; source inspection only."}
- **Codex view (sql-goalie-projection-legacy, calculation, location; Codex family 'Legacy goalie projection SQL'):** process_team_goalie_projections / calculate_goalie_start_projections
  - Purpose: Historical last-ten team goalie start share and projected GSAA/60 writer.
  - Inputs/units: Prior ten wgo_team_stats dates; goalie starts, SA, GA, time_on_ice (comment assumes minutes); fixed league SV .900
  - Output scale: start_probability=starts/totalStarts or0; projected_gsaa_per_60=((SA×.900−GA)/TOI)×60 or0.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
- **Audit context:**
  - Intent (Opus): migrations/20251126_calculate_goalie_projections.sql header comments; tombstone comment 'update-goalie-projections-v2 owns writes'
  - Intended contract (Codex legacy-sql-goalie-start-share): Source comments call this Probability; migration execution/current existence unverified.
  - Intended contract (Codex sql-goalie-projection-legacy): Original migration introductory comments specify last10/start share/GSAA60; later repair comment says one-release tombstone and v2 owns writes.
  - External references: GSAA = SA*(1 - league SV%) - GA (expected GA minus actual GA)
  - Fixtures/test data: none listed
  - Tests: `web/lib/supabase/supportedBaselineMigration.test.ts`; `{"discovered_not_run": []}`; `{"status": "Discovered; not run", "references": ["No dedicated test linkage resolved in this bounded pass."]}`
- **Leads (not audited):**
  - (opus) formula SA*0.900 - GA is expected SAVES minus goals against (huge positive), not GSAA; correct is SA*(1-0.900) - GA or saves - SA*0.900
  - (opus) comment 'Assuming minutes' for time_on_ice; WGO goalie TOI is often seconds -> per-60 off by 60x
  - (opus) league sv% hard-coded 0.900; window filters wgo_goalie_stats by team abbreviation and date only (traded goalies)
  - (codex:legacy-sql-goalie-start-share) ["Deployment and runtime behavior not verified; calculation listed without correctness assessment."]
  - (codex:sql-goalie-projection-legacy) Definition exists locally; applied migration/live view shape, data freshness and runtime consumer use unknown.

## M-GST-002 Goalie start probability and GSAA/60 (goalie_start_projections v2)

- **Match:** Both; Opus GST-008; Codex goalie-api-l10_start_pct, goalie-api-projected_gsaa_per_60, goalie-api-season_start_pct
- **Purpose:** Per game and team, estimate each goalie's start probability from recent start share and a GSAA/60 quality number.
- **Where:** `web/pages/api/v1/db/update-goalie-projections-v2.ts:366-445 (handler game loop)`; `web/pages/api/v1/db/update-goalie-projections-v2.ts:426 handler`; `web/pages/api/v1/db/update-goalie-projections-v2.ts:432 handler`; `web/pages/api/v1/db/update-goalie-projections-v2.ts:424 handler`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: per 60; generation: current
- **Opus view (GST-008):**
  - Method: Logs with gameDate <= game date (current game INCLUDED). seasonPct = goalie starts / team unique game dates; l10Pct = starts in team's last 10 dates / 10; start_probability = l10Pct. gsaa = saves - shotsAgainst*0.900; projected_gsaa_per_60 = gsaa / minutes * 60. Goalies not currently on the team are excluded.
  - Inputs/units: TOI seconds converted to minutes; counts; sources: api.nhle.com stats goalie/summary, games, rosters
  - Output scale: probability 0-1; GSAA per 60; writes: goalie_start_projections
  - Status: live — owns writes per docs RET-020; route ledger calls=11, tests=9; run inside rolling FORGE pipeline
  - Consumers: web/pages/api/v1/start-chart.ts (slate goalies); web/lib/projections/gameRevisions.ts; web/lib/rollingForgePipeline.ts; web/pages/rankings.tsx; update-goalie-starter-mixtures (lib/projections/goalieStarterMixtures)
- **Codex view (goalie-api-l10_start_pct, calculation, location; Codex family 'Goalie prior API arithmetic'):** l10_start_pct / start_probability
  - Purpose: starts in latest 10 unique dates / number of selected dates
  - Inputs/units: NHL goalie logs; actual source filter is gameDate <= target date; timeOnIce seconds /60.
  - Output scale: Source fraction.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "deployment": "Unknown; source inspection only."}
- **Codex view (goalie-api-projected_gsaa_per_60, calculation, location; Codex family 'Goalie prior API arithmetic'):** projected_gsaa_per_60
  - Purpose: (saves-shots*.900)/minutes*60
  - Inputs/units: NHL goalie logs; actual source filter is gameDate <= target date; timeOnIce seconds /60.
  - Output scale: Source goals saved above fixed league baseline per 60 minutes.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "deployment": "Unknown; source inspection only."}
- **Codex view (goalie-api-season_start_pct, calculation, location; Codex family 'Goalie prior API arithmetic'):** season_start_pct
  - Purpose: seasonStarts / number of unique team game dates
  - Inputs/units: NHL goalie logs; actual source filter is gameDate <= target date; timeOnIce seconds /60.
  - Output scale: Source fraction.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "deployment": "Unknown; source inspection only."}
- **Audit context:**
  - Intent (Opus): Comment update-goalie-projections-v2.ts:~372-378 (user wants rolling tally including the current game); docs/player-projections/duplicate-retirement-ledger.md RET-020
  - Intended contract (Codex goalie-api-l10_start_pct): {"source": "web/pages/api/v1/db/update-goalie-projections-v2.ts:363", "statement": "Comments explicitly preserve rolling-tally inclusion through game date; distinguish from pregame cutoff-safe models."}
  - Intended contract (Codex goalie-api-projected_gsaa_per_60): {"source": "web/pages/api/v1/db/update-goalie-projections-v2.ts:363", "statement": "Comments explicitly preserve rolling-tally inclusion through game date; distinguish from pregame cutoff-safe models."}
  - Intended contract (Codex goalie-api-season_start_pct): {"source": "web/pages/api/v1/db/update-goalie-projections-v2.ts:363", "statement": "Comments explicitly preserve rolling-tally inclusion through game date; distinguish from pregame cutoff-safe models."}
  - External references: GSAx vs expected-goals (MoneyPuck/Evolving-Hockey) rather than fixed league sv%; starter models use rest days, back-to-backs, confirmations
  - Fixtures/test data: none listed
  - Tests: `web/__tests__/pages/api/v1/db/update-goalie-projections-v2.test.ts`; `web/lib/projections/goaliePipeline.test.ts`; `{"status": "Discovered; not run", "references": ["No dedicated test linkage resolved in this bounded pass."]}`
- **Leads (not audited):**
  - (opus) logs include the target game itself when already played (comment acknowledges 'peeking')
  - (opus) fixed league save% 0.900 baseline regardless of season or shot quality
  - (opus) start probability ignores back-to-backs, rest and confirmed starters; equals plain L10 share
  - (opus) team-level start probabilities are not renormalized after excluding goalies who left the team
  - (codex:goalie-api-l10_start_pct) ["Deployment and runtime behavior not verified; calculation listed without correctness assessment."]
  - (codex:goalie-api-projected_gsaa_per_60) ["Deployment and runtime behavior not verified; calculation listed without correctness assessment."]
  - (codex:goalie-api-season_start_pct) ["Deployment and runtime behavior not verified; calculation listed without correctness assessment."]

## M-GST-003 Legacy SQL calculate_goalie_start_projections

- **Match:** Both; Opus GST-012; Codex legacy-sql-goalie-gsaa, legacy-sql-goalie-start-share
- **Purpose:** Original SQL start share and GSAA/60 from wgo_goalie_stats last 10 team games.
- **Where:** `migrations/20251126_calculate_goalie_projections.sql:28 (process_team_goalie_projections)`; `migrations/20251126_create_goalie_start_projections.sql:4`; `supabase/migrations/20260730193000_repair_compile_invalid_legacy_routines.sql:8 (tombstone)`; `migrations/20251126_calculate_goalie_projections.sql:84 process_team_goalie_projections`; `migrations/20251126_calculate_goalie_projections.sql:28 process_team_goalie_projections`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: per 60; generation: legacy
- **Opus view (GST-012):**
  - Method: start_probability = starts / total starts in last 10 team dates; GSAA/60 = (SA*0.900 - GA)/TOI*60 with TOI 'assuming minutes'.
  - Inputs/units: minutes (assumed); sources: wgo_goalie_stats, wgo_team_stats, teams
  - Output scale: probability 0-1; writes: goalie_start_projections
  - Status: legacy/dead — one-release tombstone per 20260730193000 migration comment
  - Consumers: —
- **Codex view (legacy-sql-goalie-gsaa, calculation, location; Codex family 'Legacy SQL goalie projections'):** Legacy projected_gsaa_per_60
  - Purpose: As implemented: ((SA*.900)-GA)/TOI*60.
  - Inputs/units: Shots against, goals against; source comment assumes TOI minutes.
  - Output scale: Signed source-labeled GSAA/60; this inventory records formula without judging it.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "deployment": "Unknown; source inspection only."}
- **Codex view (legacy-sql-goalie-start-share, calculation, location; Codex family 'Legacy SQL goalie projections'):** Legacy goalie start share
  - Purpose: Last-10 team-date goalie starts divided by total starts; zero if zero denominator.
  - Inputs/units: wgo_goalie_stats starts; last 10 wgo_team_stats dates.
  - Output scale: start_probability fraction.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "deployment": "Unknown; source inspection only."}
- **Audit context:**
  - Intent (Opus): migrations/20251126_calculate_goalie_projections.sql:1-6 header
  - Intended contract (Codex legacy-sql-goalie-gsaa): Comment and expression at lines 84-88; not the same expression as newer API.
  - Intended contract (Codex legacy-sql-goalie-start-share): Source comments call this Probability; migration execution/current existence unverified.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `{"status": "Discovered; not run", "references": ["No dedicated test linkage resolved in this bounded pass."]}`
- **Leads (not audited):**
  - (opus) TOI unit assumed minutes (WGO time_on_ice is commonly seconds) - 60x scale risk
  - (opus) tombstoned; v2 route owns writes
  - (codex:legacy-sql-goalie-gsaa) ["Deployment and runtime behavior not verified; calculation listed without correctness assessment."]
  - (codex:legacy-sql-goalie-start-share) ["Deployment and runtime behavior not verified; calculation listed without correctness assessment."]

## M-GST-004 goalie_start_projections v2 (L10 start share + GSAA/60)

- **Match:** Both; Opus GST-013; Codex goalie-api-l10_start_pct, goalie-api-projected_gsaa_per_60, goalie-api-season_start_pct
- **Purpose:** Nightly per game-goalie start probability = last-10 team-game start share, plus season start %, GP and GSAA/60.
- **Where:** `web/pages/api/v1/db/update-goalie-projections-v2.ts:351-440 (handler loop)`; `web/pages/api/v1/db/update-goalie-projections-v2.ts:158 (historicalGoalieTeams)`; `web/pages/api/v1/db/update-goalie-projections-v2.ts:133 (fetchCurrentGoalieTeams)`; `web/pages/api/v1/db/update-goalie-projections-v2.ts:426 handler`; `web/pages/api/v1/db/update-goalie-projections-v2.ts:432 handler`; `web/pages/api/v1/db/update-goalie-projections-v2.ts:424 handler`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: per 60, per team game; generation: current
- **Opus view (GST-013):**
  - Method: For each game-team: logs with gameDate <= game date; L10 = last 10 distinct team game dates; start_probability = l10_start_pct = goalie starts in L10 / L10 dates; season_start_pct = starts / distinct season dates; GSAA = saves - 0.9*shots; GSAA/60 = GSAA/minutes*60 (TOI seconds/60). Goalies not on the team (current roster for today+, latest observed team historically) excluded and pruned. Processes from last projection date, up to 30 dates, endDate <= today+7.
  - Inputs/units: seconds (timeOnIce), counts; sources: api.nhle.com/stats/rest/en/goalie/summary, games, rosters
  - Output scale: probability 0-1; GSAA per 60; writes: goalie_start_projections
  - Status: live — pg_cron update-goalie-projections-v2 09:30 UTC
  - Consumers: FORGE goalie-stage priors (skater-stage.ts:3556); start-chart API goalie rows + mixtures; lineupSourceIngestion model goalie source; update-goalie-starter-mixtures
- **Codex view (goalie-api-l10_start_pct, calculation, location; Codex family 'Goalie prior API arithmetic'):** l10_start_pct / start_probability
  - Purpose: starts in latest 10 unique dates / number of selected dates
  - Inputs/units: NHL goalie logs; actual source filter is gameDate <= target date; timeOnIce seconds /60.
  - Output scale: Source fraction.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "deployment": "Unknown; source inspection only."}
- **Codex view (goalie-api-projected_gsaa_per_60, calculation, location; Codex family 'Goalie prior API arithmetic'):** projected_gsaa_per_60
  - Purpose: (saves-shots*.900)/minutes*60
  - Inputs/units: NHL goalie logs; actual source filter is gameDate <= target date; timeOnIce seconds /60.
  - Output scale: Source goals saved above fixed league baseline per 60 minutes.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "deployment": "Unknown; source inspection only."}
- **Codex view (goalie-api-season_start_pct, calculation, location; Codex family 'Goalie prior API arithmetic'):** season_start_pct
  - Purpose: seasonStarts / number of unique team game dates
  - Inputs/units: NHL goalie logs; actual source filter is gameDate <= target date; timeOnIce seconds /60.
  - Output scale: Source fraction.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "deployment": "Unknown; source inspection only."}
- **Audit context:**
  - Intent (Opus): web/pages/api/v1/db/update-goalie-projections-v2.ts:101-103, 129-132, 156-157 docblocks; compatibilityInventory GOALIE_START_TABLE_OWNERSHIP
  - Intended contract (Codex goalie-api-l10_start_pct): {"source": "web/pages/api/v1/db/update-goalie-projections-v2.ts:363", "statement": "Comments explicitly preserve rolling-tally inclusion through game date; distinguish from pregame cutoff-safe models."}
  - Intended contract (Codex goalie-api-projected_gsaa_per_60): {"source": "web/pages/api/v1/db/update-goalie-projections-v2.ts:363", "statement": "Comments explicitly preserve rolling-tally inclusion through game date; distinguish from pregame cutoff-safe models."}
  - Intended contract (Codex goalie-api-season_start_pct): {"source": "web/pages/api/v1/db/update-goalie-projections-v2.ts:363", "statement": "Comments explicitly preserve rolling-tally inclusion through game date; distinguish from pregame cutoff-safe models."}
  - External references: Goalie usage studies (rest/B2B splits); MoneyPuck GSAx; NHL league SV% ~.900-.905
  - Fixtures/test data: `web/__tests__/pages/api/v1/forge/__snapshots__/goalies.test.ts.snap`
  - Tests: `web/__tests__/pages/api/v1/forge/goalies.test.ts`; `web/__tests__/pages/api/v1/start-chart.test.ts`; `web/lib/projections/goaliePipeline.test.ts`; `{"status": "Discovered; not run", "references": ["No dedicated test linkage resolved in this bounded pass."]}`
- **Leads (not audited):**
  - (opus) logs filter gameDate <= game.date includes the target game itself for completed games (leakage in historical rows)
  - (opus) league SV% hard-coded 0.9; GSAA uses all shots, no shot quality
  - (opus) no rest, back-to-back, workload or news inputs - pure L10 share; probabilities need not sum to 1 after excluded goalies
  - (opus) confirmed_status always false (never set by this writer)
  - (codex:goalie-api-l10_start_pct) ["Deployment and runtime behavior not verified; calculation listed without correctness assessment."]
  - (codex:goalie-api-projected_gsaa_per_60) ["Deployment and runtime behavior not verified; calculation listed without correctness assessment."]
  - (codex:goalie-api-season_start_pct) ["Deployment and runtime behavior not verified; calculation listed without correctness assessment."]

## M-GST-005 Starter board scoring (fantasy points, participation integration, ranks)

- **Match:** Both; Opus GST-014; Codex web-lib-projections-starterboardscoring-integrateboardparticipation, web-lib-projections-starterboardscoring-scoreboardstats, web-lib-projections-starterboardscoring-scorestarterboardpayload
- **Possible related records (low-confidence location link, unconfirmed):** web-lib-projections-startchartfantasyscoring-addstartchartpositionranks
- **Purpose:** Score starter-board players: expected stats = conditional stats x participation/start probability, fantasy points, category values, competition ranks.
- **Where:** `web/lib/projections/starterBoardScoring.ts:50 (scoreBoardStats)`; `web/lib/projections/starterBoardScoring.ts:62 (integrateBoardParticipation)`; `web/lib/projections/starterBoardScoring.ts:108 (skaterParticipationFromEvidence)`; `web/lib/projections/starterBoardScoring.ts:173 (boardGoalieForecast)`; `web/lib/projections/starterBoardScoring.ts:205 (boardSkaterStatsFromProjection)`; `web/lib/projections/starterBoardScoring.ts:239 (scoreStarterBoardPayload)`; `web/lib/projections/startChartFantasyScoring.ts:64 (addStartChartPositionRanks)`; `web/lib/projections/starterBoardScoring.ts:62 integrateBoardParticipation`; `web/lib/projections/starterBoardScoring.ts:50 scoreBoardStats`; `web/lib/projections/starterBoardScoring.ts:239 scoreStarterBoardPayload`
- **Tags (heuristic):** conditionality: unconditional; denominators: per 60, per game, shots on goal; generation: current
- **Opus view (GST-014):**
  - Method: Skater stats = sum ES+PP+PK components, TOI = (es+pp+pk seconds)/60; participation = 1 if confirmed in lineup, 0 if confirmed out, else unknown (conditional only). Goalie expected = conditional x startingProbability (zero relief minutes assumed). points = sum value*weight (defaults skater G 3, A 2, PPP 1, SOG 0.2, HIT 0.2, BLK 0.25; goalie GA -1, SV 0.2, SO 3, W 4); null if any weighted category missing; goalie sort by start probability or fantasy; GA category negated; competition ranks per position.
  - Inputs/units: per-game stat expectations; seconds; sources: forge_player_projections, forge_goalie_projections, daily board evidence
  - Output scale: fantasy points; rank 1..N; writes: —
  - Status: live — starter board (serving gated by STARTER_BOARD_SERVING_ENABLED env)
  - Consumers: /start-chart page (starter board); Yahoo starter board comparison
- **Codex view (web-lib-projections-starterboardscoring-integrateboardparticipation, calculation, location; Codex family 'FORGE staged projection math'):** Starter-board unconditional means (integrateBoardParticipation)
  - Purpose: Multiply each conditional category by supplied appearance/start probability.
  - Inputs/units: Conditional means in stat units; probability [0,1] or null.
  - Output scale: Unconditional means or null.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (web-lib-projections-starterboardscoring-scoreboardstats, calculation, location; Codex family 'FORGE staged projection math'):** Starter-board custom fantasy score (scoreBoardStats)
  - Purpose: Linear sum of nonzero category weights times compatible mean values; required missing category withholds.
  - Inputs/units: Per-game category counts/minutes and points-per-unit weights.
  - Output scale: Fantasy points or unavailable.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (web-lib-projections-starterboardscoring-scorestarterboardpayload, symbol_candidate, location; Codex family 'FORGE staged projection math'):** Score starter board payload (scoreStarterBoardPayload)
  - Purpose: Score starter board payload for forge staged projection math. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: export function scoreStarterBoardPayload<T extends { players: any[] }>(payload: T, request: BoardScoringRequest) { const players = payload.players.map((player) => { const goalie = player.positions.includes("G"); const forecast: BoardForecast \| undefined = player.forecast; const stats = forecast?.expected ?? forecast?.conditional ?? forecast?.legacy ?? null; const weights = request.profile[goalie ? "goalie" : "skater"]; const score = scoreBoardStats(stats, weights); const previousPoints = forecast?.previous ? scoreBoardStats(forecast.previous.stats, weights).points : null; const categoryValue = request.category ? stats?.[request.category] ?? null : null; const previousValue = request.mode === "categories" && request.category ? forecast?.previous?.stats[…
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): docs/start-chart/implementation.md; docs/start-chart/deep-research.md:21 (separate start probability from goalie value); launch-validation.md:1460 (apply participation once)
  - Intended contract (Codex web-lib-projections-starterboardscoring-integrateboardparticipation): {"source": "web/lib/projections/starterBoardScoring.ts:62", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["web/lib/projections/starterBoardScoring.ts:65 return Object.fromEntries(Object.entries(conditional).map(([key, value]) => [key, value == null ? null : value * probability]));", "web/lib/projections/starterBoardScoring.ts:74 /** Resolved evidence still needs exact identity/time binding when decoded from storage. */"]}
  - Intended contract (Codex web-lib-projections-starterboardscoring-scoreboardstats): {"source": "web/lib/projections/starterBoardScoring.ts:50", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["web/lib/projections/starterBoardScoring.ts:57 else points += value * weight;"]}
  - Intended contract (Codex web-lib-projections-starterboardscoring-scorestarterboardpayload): {"source": "web/lib/projections/starterBoardScoring.ts:239", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": []}
  - External references: Yahoo default H2H points scoring; expected value = P(start) x conditional
  - Fixtures/test data: `web/__tests__/fixtures/consumerGameRevision.ts`
  - Tests: `web/__tests__/pages/api/v1/start-chart.test.ts`; `web/e2e/start-chart.spec.ts`; `web/lib/projections/goaliePipeline.test.ts`; `web/lib/projections/privateParticipationScenario.test.ts`; `web/lib/projections/startChartPipeline.test.ts`; `{"status": "Discovered only; not run", "references": ["web/lib/projections/startChartPipeline.test.ts:13"]}`
- **Leads (not audited):**
  - (opus) PP_POINTS weight 1 stacks on top of G/A points (intended in many leagues but a double count vs some)
  - (opus) probabilityStatus 'uncalibrated_model' acknowledged; skater participation only 0/1 from confirmations
  - (codex:web-lib-projections-starterboardscoring-integrateboardparticipation) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested."]
  - (codex:web-lib-projections-starterboardscoring-scoreboardstats) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested."]
  - (codex:web-lib-projections-starterboardscoring-scorestarterboardpayload) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-GST-006 FORGE starter probability model (computeStarterProbabilities)

- **Match:** Both; Opus GST-016; Codex web-lib-projections-calculators-goalie-starter-computestarterprobabilities
- **Purpose:** Score each candidate goalie and convert to start probabilities (sigmoid for 2, softmax for 3).
- **Where:** `web/lib/projections/calculators/goalie-starter.ts:126 (computeStarterProbabilities)`; `web/lib/projections/constants/projection-weights.ts:3-25`; `web/lib/projections/stages/goalie-stage.ts:394-470`; `web/lib/projections/calculators/goalie-starter.ts:126 computeStarterProbabilities`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: per 60; generation: current
- **Opus view (GST-016):**
  - Method: score = 2.4*(L10share-0.5) + 0.7*logit(prior clamp .01-.99) + 0.45*logit(lineCombo prior clamp .05-.95) + 0.5*clamp(GSAA60,+-0.6) + 0.28*(seasonStart%-0.5)*GP/(GP+10) + 0.2*GP/(GP+10); B2B: starter of previous game -2.75, other goalie +0.65; B2B & team weaker (GF + 0.35 < opp GF): primary (L10share>=0.6) -1.1, backup +0.45; weak opponent (GF <= 2.6): primary -0.7, backup +0.3; rust: >75 d -6, >30 d -3, >14 d -0.8, <=7 d +0.2. Two candidates: p = clamp(sigmoid(diff), .02, .98); three: softmax clamped .01-.98 (not renormalized). One candidate -> 1.
  - Inputs/units: counts, days, goals/game, GSAA per 60; sources: forge_goalie_game, games, goalie_start_projections, lineCombinations
  - Output scale: probability 0-1; writes: forge_goalie_projections (via goalie stage)
  - Status: live — FORGE run (run-forge-projections) goalie stage
  - Consumers: FORGE goalie stage -> starter board / start chart (serving flag); RSO, player forecasts
- **Codex view (web-lib-projections-calculators-goalie-starter-computestarterprobabilities, calculation, location; Codex family 'FORGE staged projection math'):** Heuristic goalie-start probability distribution (computeStarterProbabilities)
  - Purpose: Score combines recent start share, prior/lineup logits, GSAA, season usage, rest, opponent/team context and staleness. Two candidates use bounded sigmoid score difference; >2 use shifted softmax then individual bounds.
  - Inputs/units: Candidate identities; counts/start shares; GSAA/60; dates/rest; team goal means.
  - Output scale: Per-candidate P(start); single candidate=1; two sum exactly1; >2 post-clamp mass not separately inferred here.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): docs/player-projections/model-inventory.md:24 (PP-004 'heuristic probability + weighted formula')
  - Intended contract (Codex web-lib-projections-calculators-goalie-starter-computestarterprobabilities): {"source": "web/lib/projections/calculators/goalie-starter.ts:126", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["web/lib/projections/calculators/goalie-starter.ts:168 const l10Share = l10Starts / totalGames;", "web/lib/projections/calculators/goalie-starter.ts:182 const seasonGamesWeight = clamp(seasonGamesPlayed / (seasonGamesPlayed + 10), 0, 1);", "web/lib/projections/calculators/goalie-starter.ts:190 score += 2.4 * (l10Share - 0.5);", "web/lib/projections/calculators/goalie-starter.ts:191 score += 0.7 * Math.log(priorProb / (1 - priorProb));", "web/lib/projections/calculators/goalie-starter.ts:192 score += LINE_COMBO_PRIOR_LOGIT_WEIGHT * Math.log(lineComboPrior / (1 - lineComboPrior));", "web/lib/projections/calculators/goalie-starter.ts:193 score += GOALIE_GSAA_PRIOR_WEIGHT * projectedGsaaPer60;", "web/lib/projections/calculators/goalie-starter.ts:198 score += GOALIE_SEASON_GAMES_PLAYED_WEIGHT * seasonGamesWeight;", "web/lib/projections/calculators/goalie-starter.ts:237 const exps = scores.map((s) => Math.exp(s.score - maxScore));"]}
  - External references: Goalie usage studies (B2B starter rates ~10-20% for repeat starter); Daily Faceoff confirmations; logistic starter models
  - Fixtures/test data: none listed
  - Tests: `web/lib/projections/goaliePipeline.test.ts`; `web/lib/projections/module-imports.test.ts`; `web/lib/projections/runProjectionV2.test.ts`; `{"status": "Discovered only; not run", "references": ["web/lib/projections/module-imports.test.ts:11", "web/lib/projections/runProjectionV2.test.ts:44"]}`
- **Leads (not audited):**
  - (opus) L10 share enters twice - directly (2.4*) and via goalie_start_projections prior (which is itself the L10 share)
  - (opus) 'starter' in L10 context is max-TOI goalie, so relief-heavy games credit the backup
  - (opus) 3-candidate softmax clamps after normalization so probabilities may not sum to 1; uncalibrated heuristic weights (doc status 'heuristic probability')
  - (opus) line-combo prior counts every listed goalie in lineCombinations (both dressed goalies) with decay 0.82 - may be near-uninformative
  - (codex:web-lib-projections-calculators-goalie-starter-computestarterprobabilities) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested."]

## M-GST-007 Starter candidate selection + scenario blend

- **Match:** Both; Opus GST-017; Codex web-lib-projections-calculators-goalie-starter-blendtopstarterscenariooutputs, web-lib-projections-calculators-goalie-starter-buildtopstarterscenarios
- **Purpose:** Choose up to 3 candidate goalies, form top-2 normalized scenarios, and blend goalie outputs by start probability with residual mass.
- **Where:** `web/lib/projections/calculators/goalie-starter.ts:76 (selectStarterCandidateGoalieIds)`; `web/lib/projections/calculators/goalie-starter.ts:245 (buildTopStarterScenarios)`; `web/lib/projections/calculators/goalie-starter.ts:27 (blendTopStarterScenarioOutputs)`; `web/lib/projections/calculators/goalie-starter.ts:27 blendTopStarterScenarioOutputs`; `web/lib/projections/calculators/goalie-starter.ts:245 buildTopStarterScenarios`
- **Tags (heuristic):** percent scale: fraction 0-1; conditionality: conditional; generation: current
- **Opus view (GST-017):**
  - Method: Exclude non-roster and >75 days unplayed; rank score = 100 override + 25 confirmed + 10*prior + 1.5*L10 starts - min(days,120)/30; keep 3. Scenarios: top-2 probabilities renormalized to sum 1. Blend: sum w*metric over scenarios + (1 - sum w)*fallback for SA, saves, GA, win, shutout, SV%.
  - Inputs/units: —; sources: players, forge_goalie_game, goalie_start_projections
  - Output scale: probabilities 0-1; writes: —
  - Status: live — FORGE goalie stage
  - Consumers: goalie stage
- **Codex view (web-lib-projections-calculators-goalie-starter-blendtopstarterscenariooutputs, calculation, location; Codex family 'FORGE staged projection math'):** Starter-scenario mean mixture (blendTopStarterScenarioOutputs)
  - Purpose: Probability-weight scenario stat lines; add residual probability mass times fallback stat line. Preserve unavailable win means.
  - Inputs/units: Scenario probability, SA/SV/GA counts, save fractions and W/SO probabilities.
  - Output scale: Blended conditional stats/probabilities plus modeled/residual probability mass.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Codex view (web-lib-projections-calculators-goalie-starter-buildtopstarterscenarios, symbol_candidate, location; Codex family 'FORGE staged projection math'):** Build top starter scenarios (buildTopStarterScenarios)
  - Purpose: Build top starter scenarios for forge staged projection math. Exact arithmetic locations are recorded below; no correctness judgment is made.
  - Inputs/units: Parameter/type declaration excerpt: export function buildTopStarterScenarios(opts: { probabilitiesByGoalieId: Map<number, number>; maxScenarios?: number; }): StarterScenario[] { const maxScenarios = Number.isFinite(opts.maxScenarios) ? Math.max(1, Number(opts.maxScenarios)) : 2; const ranked = Array.from(opts.probabilitiesByGoalieId.entries()) .filter(([goalieId, probability]) => Number.isFinite(goalieId) && Number.isFinite(probability)) .sort((a, b) => b[1] - a[1]) .slice(0, maxScenarios); if (ranked.length === 0) return []; const rawMass = ranked.reduce((sum, [, probability]) => sum + Math.max(0, probability), 0); const denom = rawMass > 0 ? rawMass : ranked.length; return ranked.map(([goalieId, rawProbability], idx) => ({ goalieId, rawProbability,
  - Output scale: See declaration/return fields; exact head-specific output unit not independently resolved in this inventory.
  - Version/status: {"checkout": "octoberBranch @ d31dcb33f72d4c9d69b507874c388f0cd549fe2f", "declared_versions": [], "deployment": "Unknown; checked-in implementation is not deployment evidence.", "source_state": "No assigned-source modifications observed at initial status check."}
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex web-lib-projections-calculators-goalie-starter-blendtopstarterscenariooutputs): {"source": "web/lib/projections/calculators/goalie-starter.ts:27", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["web/lib/projections/calculators/goalie-starter.ts:47 weighted.proj_shots_against += w * s.proj_shots_against;", "web/lib/projections/calculators/goalie-starter.ts:48 weighted.proj_saves += w * s.proj_saves;", "web/lib/projections/calculators/goalie-starter.ts:49 weighted.proj_goals_allowed += w * s.proj_goals_allowed;", "web/lib/projections/calculators/goalie-starter.ts:51 else if (s.proj_win_prob !== null) weighted.proj_win_prob += w * s.proj_win_prob;", "web/lib/projections/calculators/goalie-starter.ts:52 weighted.proj_shutout_prob += w * s.proj_shutout_prob;", "web/lib/projections/calculators/goalie-starter.ts:53 weighted.modeled_save_pct += w * s.modeled_save_pct;", "web/lib/projections/calculators/goalie-starter.ts:63 weighted.proj_shots_against + residualMass * fallback.proj_shots_against,", "web/lib/projections/calculators/goalie-starter.ts:64 proj_saves: weighted.proj_saves + residualMass * fallback.proj_saves,"]}
  - Intended contract (Codex web-lib-projections-calculators-goalie-starter-buildtopstarterscenarios): {"source": "web/lib/projections/calculators/goalie-starter.ts:245", "explicit_comment": "No adjacent prose contract found; use declaration and implementation.", "arithmetic_locations": ["web/lib/projections/calculators/goalie-starter.ts:263 probability: clamp(Math.max(0, rawProbability) / denom, 0, 1),"]}
  - External references: Mixture expectation
  - Fixtures/test data: none listed
  - Tests: `web/lib/projections/module-imports.test.ts`; `{"status": "Discovered only; not run", "references": ["web/lib/projections/runProjectionV2.alignedConversion.test.ts:5", "web/lib/projections/runProjectionV2.test.ts:11"]}`; `{"status": "Discovered only; not run", "references": ["web/lib/projections/runProjectionV2.test.ts:12"]}`
- **Leads (not audited):**
  - (opus) top-2 renormalization discards third-goalie mass for scenario probabilities
  - (codex:web-lib-projections-calculators-goalie-starter-blendtopstarterscenariooutputs) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested."]
  - (codex:web-lib-projections-calculators-goalie-starter-buildtopstarterscenarios) ["Runtime data freshness, actual consumer enablement, deployment and statistical validity were not tested.", "Named calculation discovered by static inventory; formula/units only resolved where source comments or signature explicitly say. Not a correctness review.", "Supplemental discovery entry, not a resolved semantic metric contract."]

## M-GST-008 RSO goalie likely-starter mark (p >= 0.5)

- **Match:** Opus only; Opus GST-002; Codex —
- **Purpose:** Marks a goalie cell as confirmed or likely starter.
- **Where:** `web/components/RosterScheduleOptimizer/SlotWeekGrid.tsx:204`
- **Tags (heuristic):** generation: current
- **Opus view (GST-002):**
  - Method: If Yahoo start mark absent: confirmed -> check; else startProbability >= 0.5 -> '~ Likely starter (round(p*100)%)'.
  - Inputs/units: probability 0-1; sources: RSO goalie forecasts
  - Output scale: binary mark; writes: —
  - Status: live — RSO
  - Consumers: RosterScheduleOptimizer slot grid
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/components/RosterScheduleOptimizer/SlotWeekGrid.test.tsx`
- **Leads (not audited):**
  - (opus) 0.5 cutoff hard-coded; differs from other starter thresholds in GST family (not compared)

## M-GST-009 Starter board operations SLO report (on-time share, nearest-rank latency percentiles, sample gate)

- **Match:** Opus only; Opus GST-003; Codex —
- **Purpose:** Measure whether accepted lineup/goalie news reaches the visible starter board within 5 minutes.
- **Where:** `web/lib/projections/starterBoardOperations.ts:26 (buildStarterBoardOperationsReport)`; `web/lib/projections/starterBoardOperations.ts:19 (percentiles)`; `web/lib/projections/starterBoardOperations.ts:11 (TARGET_MS=300000)`
- **Tags (heuristic):** percent scale: fraction 0-1; generation: current
- **Opus view (GST-003):**
  - Method: Per event: latency = visible - accepted; status delivered_on_time if <= 300 s, delivered_late if >, overdue_no_visibility if no visibility and asOf - accepted >= 300 s, pending otherwise, invalid_timing on sequence errors. Reposts with same changeKey counted once. onTimeShare = on-time / non-pending unique events. Percentiles p50/p95/p99 by nearest rank (sorted[ceil(q*n)-1]) over valid events. sampleGateMet = >= 100 distinct newsKeys with pp, availability and goalie categories all present; measuredTargetMet = onTimeShare >= 0.95 and no invalid timing. Cohorts: regular season (gameType 2), preseason, other; window <= 31 days, <= 10000 events.
  - Inputs/units: ISO timestamps; ms; sources: starter board operational events (starter-board-release route)
  - Output scale: fraction 0-1; milliseconds; writes: —
  - Status: live — starter-board-release admin route
  - Consumers: web/pages/api/v1/db/starter-board-release.ts
- **Audit context:**
  - Intent (Opus): web/lib/projections/starterBoardOperations.ts:25 comment and limitations array (:101-106)
  - External references: Nearest-rank percentile definition; SLO on-time share
  - Fixtures/test data: none listed
  - Tests: `web/lib/projections/startChartPipeline.test.ts`
- **Leads (not audited):**
  - (opus) latency upper bound uses server visibility receipt times, not true render time (stated in limitations)

## M-GST-010 Goalie board heat level and best/worst tie handling

- **Match:** Opus only; Opus GST-004; Codex —
- **Purpose:** Colour intensity for goalie Best/Worst boards from each value's size relative to the largest shown value.
- **Where:** `web/lib/socialShare/modules/shared/goalieBoards.ts:34 (heatLevel)`; `web/lib/socialShare/modules/shared/goalieBoards.ts:39 (largestShown)`; `web/lib/socialShare/modules/shared/goalieBoards.ts:16 (side)`
- **Tags (heuristic):** generation: current
- **Opus view (GST-004):**
  - Method: tone = better if value>0, worse if <0, level if 0 or largest<=0, none if null; alpha = round(0.2 + 0.6*min(1,\|value\|/largest), 2). Boards: 8 rows per side, ranked ascending by the post's own rank; reports notShown and moreTied (ties at last shown rank); goalies may appear on both sides when the pool is small.
  - Inputs/units: post-specific (GSAx, deltas); sources: —
  - Output scale: alpha 0.2-0.8 and tone label; writes: —
  - Status: live — goalie board posts
  - Consumers: web/components/SocialShare/modules/GoalieBoards.tsx; goalie share posts (goaliePeriod etc.)
- **Audit context:**
  - Intent (Opus): web/lib/socialShare/modules/shared/goalieBoards.ts:33 comment (colour strength by size against the largest shown value; sign sets the colour)
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/socialShare/modules/goaliePeriod.test.ts`
- **Leads (not audited):**
  - (opus) intensity scales to the largest shown value, so colours are not comparable across editions

## M-GST-011 Goalie inventory team lenses (pooled per-game team rates, PP%, PK%, league ranks, back-to-back weaker opponent)

- **Match:** Opus only; Opus GST-005; Codex —
- **Purpose:** Season-to-date team context (volume, ratio exposure, win support) for each side of each scheduled goalie game in Start/Sit, Risky Starts and goalie posts.
- **Where:** `web/lib/socialShare/modules/shared/goalieInventory.sources.ts:149 (buildTeamLenses)`; `web/lib/socialShare/modules/shared/goalieInventory.sources.ts:137 (pooled)`; `web/lib/socialShare/modules/shared/goalieInventory.sources.ts:197 (gameSignals)`; `web/lib/socialShare/modules/shared/goalieInventory.sources.ts:283-291 (backToBacks weakerOpponent)`; `web/lib/socialShare/modules/shared/goalieInventory.sources.ts:254 (buildGoalieInventory)`
- **Tags (heuristic):** percent scale: 0-100; denominators: per game; generation: current
- **Opus view (GST-005):**
  - Method: Per team through the last fully reported night: counts per game = sum(known values)/known games (pooled; never a mean of rates). PP% = 100*sum(PPGF)/sum(PP opps); PK% = 100*sum(TSH - PPGA)/sum(TSH); goal differential per game. League rank (1 = highest value, competition ties) only when every team has the value over all completed games; low-first ranks also kept for 'high is weak' metrics (SA, xGA, chances against, GA, TSH). Game signals pair team vs opponent lenses without adding them. Back-to-back: if team played day before/after, weakerOpponent = this opponent's GD/game < the other night's opponent's GD/game (ties/unknown null). Includes L10 and L3 team start shares (teamStartShare).
  - Inputs/units: per-game counts; percent 0-100 for PP%/PK%; sources: nst_team_gamelogs_as_counts, wgo_team_stats, games, wgo_goalie_stats, player_forecast_goalie_start_observations
  - Output scale: per-game rates, percent 0-100, ranks 1..32; writes: —
  - Status: live — goalie inventory feeds Start/Sit and Risky Starts share posts
  - Consumers: web/lib/socialShare/modules/startSit.ts; web/lib/socialShare/modules/riskyStarts.ts; web/components/SocialShare/modules/StartSitCard.tsx; web/components/SocialShare/modules/RiskyStartsCard.tsx
- **Audit context:**
  - Intent (Opus): web/lib/socialShare/modules/shared/goalieInventory.sources.ts:144-148 comment (pooled from each game's counts, never a mean of rates; rank only when every team has the value)
  - External references: NHL.com PP%/PK% definitions (PK% = 1 - PPGA/TSH)
  - Fixtures/test data: `web/lib/socialShare/modules/shared/goalieInventory.fixture.ts`
  - Tests: `web/lib/socialShare/modules/riskyStarts.test.ts`; `web/lib/socialShare/modules/shared/goalieInventory.sources.test.ts`; `web/lib/socialShare/modules/startSit.test.ts`
- **Leads (not audited):**
  - (opus) mixes NST (shots/xG/chances) and WGO (goals/PP/PK) sources; NST coverage gaps make lens sample < games but values still shown
  - (opus) weaker-opponent flag compares raw goal differential per game with no schedule adjustment

## M-GST-012 Goalie inventory rank band, strength share and head-to-head winner

- **Match:** Opus only; Opus GST-006; Codex —
- **Purpose:** Turn team-lens league ranks into top/middle/bottom thirds, a 0-1 strength bar, and a winner between two sides for Risky Starts and Start/Sit.
- **Where:** `web/lib/socialShare/modules/shared/goalieInventory.sources.ts:369 (rankBand)`; `web/lib/socialShare/modules/shared/goalieInventory.sources.ts:377 (strengthRank)`; `web/lib/socialShare/modules/shared/goalieInventory.sources.ts:379 (strengthShare)`; `web/lib/socialShare/modules/shared/goalieInventory.sources.ts:384 (headToHeadWinner)`
- **Tags (heuristic):** percent scale: fraction 0-1; generation: current
- **Opus view (GST-006):**
  - Method: third = ceil(cohort/3); band top if rank <= third, bottom if rank > cohort - third, else middle; null when value or complete-league rank missing. strengthRank = low-first rank for HIGH_IS_WEAK metrics (shots/xG/chances/goals against, times shorthanded) else high-first rank. strengthShare = (cohort - strengthRank + 1)/cohort. headToHeadWinner = side with the smaller strength rank; equal or missing -> no winner.
  - Inputs/units: ranks 1..N; sources: (team lenses)
  - Output scale: band label; fraction 0-1; 0/1/null; writes: —
  - Status: live — Risky Starts flag and Start/Sit chips
  - Consumers: web/lib/socialShare/modules/riskyStarts.ts; web/components/SocialShare/modules/RiskyStartsCard.tsx; web/components/SocialShare/modules/StartSitCard.tsx
- **Audit context:**
  - Intent (Opus): web/lib/socialShare/modules/shared/goalieInventory.sources.ts:367-383 comments (Risky Starts cut; strength as share of league; one winner rule)
  - External references: none suggested
  - Fixtures/test data: `web/lib/socialShare/modules/shared/goalieInventory.fixture.ts`
  - Tests: `web/lib/socialShare/modules/riskyStarts.test.ts`; `web/lib/socialShare/modules/shared/goalieInventory.sources.test.ts`; `web/lib/socialShare/modules/startSit.test.ts`
- **Leads (not audited):**
  - (opus) tertile cut on ranks ignores value gaps (a tiny difference can flip top/middle)
  - (opus) head-to-head compares ranks of possibly different metrics (opponent offence vs team defence) as if on one scale

## M-GST-013 Social share team start share (official starts / team games over last N)

- **Match:** Opus only; Opus GST-007; Codex —
- **Purpose:** Descriptive goalie start share over a team's last N completed games for crease, goalie-period and inventory posts.
- **Where:** `web/lib/socialShare/modules/shared/goalieLedger.ts:61 (teamStartShare)`; `web/lib/socialShare/modules/shared/goalieInventory.sources.ts:300 (L10 and TREND_GAMES=3 calls)`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: per team game; generation: current
- **Opus view (GST-007):**
  - Method: Window = last n team games (null = season) after dropping the most recent `skip`. Starts counted per goalie; relief appearances separate. Shares are filled only when every window game has exactly one labelled starter (else complete=false, shares 0/null). share = starts / team games in window.
  - Inputs/units: game counts; sources: wgo_team_stats, wgo_goalie_stats
  - Output scale: fraction 0-1; writes: —
  - Status: live — used by creaseShift, goaliePeriod and goalie inventory
  - Consumers: web/lib/socialShare/modules/creaseShift.ts; web/lib/socialShare/modules/goaliePeriod.ts; web/lib/socialShare/modules/shared/goalieInventory.sources.ts
- **Audit context:**
  - Intent (Opus): web/lib/socialShare/modules/shared/goalieLedger.ts:56-60 comment (denominator is team games; relief apart; descriptive only, no start probability)
  - External references: none suggested
  - Fixtures/test data: `web/lib/socialShare/modules/shared/goalieInventory.fixture.ts`
  - Tests: `web/lib/socialShare/modules/shared/ledgers.test.ts`
- **Leads (not audited):**
  - (opus) duplicate implementation of Goalie share / workload by team (GST-003 buildGoalieShareByTeam) and naive goalie start share (PFC-044) and team landing start share (UST-074); denominators differ (team games here vs total appearances in GST-003 pie)
  - (opus) when incomplete the share field is 0 rather than null inside the goalie list (only the inventory wrapper nulls it)

## M-GST-014 Goalie share / workload by team (L10/L20/L30/Season)

- **Match:** Opus only; Opus GST-009; Codex —
- **Purpose:** Per-team goalie appearance share, official starts, W-L-OTL, SV% and GAA over trailing team-game windows.
- **Where:** `web/lib/goalieWorkload.ts:61 (buildGoalieShareByTeam)`; `web/components/GoalieShareChart/index.tsx:7`; `web/lib/projections/goalie/workloadEvidence.ts:7 (buildGoalieWorkloadEvidence)`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: per 60, per team game; generation: current
- **Opus view (GST-009):**
  - Method: Window = last N distinct team games (10/20/30/all); appearances = rows (gamesPlayed!=0); starts only if every game has exactly one labelled starter; SV% = saves/SA pooled; GAA = GA*3600/TOI seconds; pie denominator = total appearances (relief adds). workloadEvidence wraps rolling 14-day participation receipts (descriptive only).
  - Inputs/units: seconds; counts; sources: api.nhle.com goalie/summary (via CORS proxy)
  - Output scale: fractions; GAA per 60; writes: —
  - Status: live — GoalieShareChart; workloadEvidence status descriptive_only / dormant
  - Consumers: GoalieShareChart (stats, trends pages); socialShare creaseShift; mockDraft research
- **Audit context:**
  - Intent (Opus): web/lib/goalieWorkload.ts:3-4, 54-55 docblocks; workloadEvidence.ts:4-7
  - External references: Goalie usage share (starts / team games); NHL SV%/GAA
  - Fixtures/test data: `web/lib/socialShare/modules/shared/goalieInventory.fixture.ts`
  - Tests: `web/components/GoalieShareChart/GoalieShareChart.pagination.test.tsx`; `web/components/GoalieShareChart/GoalieShareChart.test.ts`; `web/lib/socialShare/modules/creaseShift.test.ts`
- **Leads (not audited):**
  - (opus) pie share uses appearances (relief included), not starts - differs from start share used by starter odds

## M-GST-015 News/evidence goalie override (confirmed/likely)

- **Match:** Opus only; Opus GST-010; Codex —
- **Purpose:** Override model starter odds from roster events or confirmed daily-board evidence.
- **Where:** `web/lib/projections/stages/preflight-stage.ts:166-183`; `web/lib/projections/dailyBoardEvidence.ts:224`; `web/lib/projections/stages/goalie-stage.ts:397-414`
- **Tags (heuristic):** percent scale: fraction 0-1; generation: current
- **Opus view (GST-010):**
  - Method: CONFIRMED -> starterProb 1; LIKELY (only when STARTER_BOARD_COMPUTE disabled) -> clamp(confidence ?? 0.75, 0.5, 1); highest prob per team wins; confirmed evidence assertion -> 1; any goalie conflict deletes override. Under override other candidates get 0.
  - Inputs/units: probability 0-1; sources: roster events table, daily board evidence
  - Output scale: probability 0-1; writes: —
  - Status: live — FORGE preflight (LIKELY branch gated by env STARTER_BOARD_COMPUTE_ENABLED)
  - Consumers: goalie stage, skater stage candidate ranking
- **Audit context:**
  - Intent (Opus): web/lib/projections/stages/goalie-stage.ts:507 comment (probability is not a source assertion)
  - External references: Daily Faceoff Confirmed/Likely labels
  - Fixtures/test data: none listed
  - Tests: `web/lib/projections/goaliePipeline.test.ts`
- **Leads (not audited):**
  - (opus) LIKELY default 0.75 is a magic constant; under a 0.75 override remaining 0.25 is residual mass, not given to the backup

## M-GST-016 Best goalie-start source selection (news/model precedence + TTL)

- **Match:** Opus only; Opus GST-011; Codex —
- **Purpose:** Choose the goalie start claim per team from NHL.com, Daily Faceoff, GameDay tweets or the model.
- **Where:** `web/lib/sources/lineupSourceIngestion.ts:1746 (selectBestGoalieStartSource)`; `web/lib/sources/lineupSourceIngestion.ts:162 (GOALIE_SOURCE_TTL_HOURS)`; `web/lib/sources/lineupSourceIngestion.ts:1718 (buildGoalieStartSourceFromModel)`; `web/lib/sources/lineupSourceIngestion.ts:285 (isSourceFresh)`
- **Tags (heuristic):** generation: current
- **Opus view (GST-011):**
  - Method: Eligible if matched player id and fresh (TTL hours: nhl.com 18, dailyfaceoff 8, gamedaytweets 6, model 4); sort by status rank confirmed 1 < likely 2 < unconfirmed 3 < projected 4 < model 5, then sourceRank (DFO 1, GDT 2, NHL 3, model 4), then confidenceScore desc.
  - Inputs/units: hours; probability 0-1; sources: Daily Faceoff starting goalies page, GameDayGoalies tweets, NHL.com, goalie_start_projections
  - Output scale: selection; writes: lineup_source_provenance / source snapshots
  - Status: live — update-lineup-source-provenance
  - Consumers: update-lineup-source-provenance route; start chart goalie badges
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: Daily Faceoff / LeftWingLock confirmed-starter labels
  - Fixtures/test data: none listed
  - Tests: `web/__tests__/pages/api/v1/db/update-lineup-source-provenance.test.ts`; `web/lib/sources/lineupSourceIngestion.test.ts`
- **Leads (not audited):**
  - (opus) buildGoalieStartSourceFromModel sets freshnessExpiresAt null directly (bypasses the 4 h model TTL), so model rows never expire

## M-GST-017 Starter board validation / promotion gate

- **Match:** Opus only; Opus GST-015; Codex —
- **Purpose:** Decide whether a challenger component is eligible for promotion from prospective evaluation metrics.
- **Where:** `web/lib/projections/starterBoardValidation.ts:55 (boardComponentDecisions)`; `web/lib/projections/starterBoardValidation.ts:90 (buildBoardValidationDisclosure)`; `web/lib/projections/starterBoardDataset.ts:112-131`
- **Tags (heuristic):** generation: current
- **Opus view (GST-015):**
  - Method: Ineligible unless captured_live regular season, games >= 200 and slates >= 30, baseline/primary metric match frozen policy, relative improvement >= 1%, lower 95% improvement > 0, protected metrics not degraded > 2% with lower95 > 0, both probability labels present. Brier must be <= 1. Holdout 2026-01-03..2026-04-16 protected. Review milestones day 14 and 30.
  - Inputs/units: —; sources: starter board release registry / reviews
  - Output scale: decision; writes: —
  - Status: live — disclosure; status 'awaiting/collecting evidence'
  - Consumers: StarterBoardValidation component; /api/v1/db/starter-board-release
- **Audit context:**
  - Intent (Opus): web/lib/projections/starterBoardValidation.ts:54 docblock
  - External references: Brier / log-loss calibration; paired bootstrap comparison
  - Fixtures/test data: none listed
  - Tests: `web/__tests__/pages/start-chart.test.tsx`; `web/lib/projections/startChartPipeline.test.ts`

## M-GST-018 Goalie starter mixture (B2B adjust, normalize, confidence, staleness)

- **Match:** Opus only; Opus GST-018; Codex —
- **Purpose:** Turn goalie_start_projections rows into adjusted/normalized start probabilities with confidence and stale flags.
- **Where:** `web/lib/projections/goalieStarterMixtures.ts:111 (buildGoalieStarterMixtureRows)`; `web/lib/projections/goalieStarterMixtures.ts:93 (confidenceFor)`; `web/lib/projections/goalieStarterMixtures.ts:238 (buildGoalieStarterBranchProjectionRows)`; `web/pages/api/v1/start-chart.ts:1539`; `web/pages/api/v1/db/update-goalie-starter-mixtures.ts`
- **Tags (heuristic):** percent scale: fraction 0-1; generation: current
- **Opus view (GST-018):**
  - Method: Manual override -> 1/0; conflicting evidence (>1 confirmed, duplicate ids, out-of-range, sum > 1) -> 0; confirmed -> 1/count; B2B and previous starter -> p*0.65; normalized = p / max(1, mass) (missing mass kept as residual); confidence high if confirmed or p>=0.8, low if stale >= 36 h, medium if stale >= 12 h or p>=0.6, else low. Branch rows weight SA/saves/GA/win/shutout by branch probability.
  - Inputs/units: probability 0-1; hours; sources: goalie_start_projections
  - Output scale: probability 0-1; ordinal confidence; writes: nhl_goalie_starter_mixture_distributions (route only)
  - Status: live — start-chart API; update-goalie-starter-mixtures route has no schedule found (manual/operational)
  - Consumers: web/pages/api/v1/start-chart.ts (goalie start_probability shown when not revisionMode)
- **Audit context:**
  - Intent (Opus): web/lib/projections/goalieStarterMixtures.ts:160-161 comment (do not redistribute missing mass)
  - External references: Goalie usage studies (B2B rotation)
  - Fixtures/test data: none listed
  - Tests: `web/__tests__/pages/api/v1/db/operational-route-auth.test.ts`; `web/__tests__/pages/api/v1/start-chart.test.ts`; `web/lib/projections/goalieStarterMixtures.test.ts`
- **Leads (not audited):**
  - (opus) start-chart calls buildGoalieStarterMixtureRows without previousGameStarter/backToBack inputs, so the 0.65 B2B adjustment never applies there
  - (opus) route default mixtureVersion 'goalie_starter_mixture_v1' vs library default v2
  - (opus) 0.65, 12 h, 36 h, 0.8/0.6 thresholds are magic numbers; mixture route has no cron entry

## M-GST-019 Team goalie starter context + line-combo goalie prior

- **Match:** Opus only; Opus GST-019; Codex —
- **Purpose:** Build L10 start counts, last-played dates, previous starter, and a recency-decayed line-combo prior.
- **Where:** `web/lib/projections/queries/goalie-queries.ts:86 (fetchTeamGoalieStarterContext)`; `web/lib/projections/queries/goalie-queries.ts:21 (fetchTeamLineComboGoaliePrior)`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: per team game; generation: current
- **Opus view (GST-019):**
  - Method: Starter per date = goalie with max TOI; L10 = 10 most recent dates; previous game starter by previous team game date. Prior: weight = 0.82^i over last 12 line combos; p = weight mass with goalie / total weight.
  - Inputs/units: seconds; dates; sources: forge_goalie_game, games, lineCombinations
  - Output scale: counts; probability 0-1; writes: —
  - Status: live — FORGE
  - Consumers: computeStarterProbabilities
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/projections/module-imports.test.ts`; `web/lib/projections/nativeGoalAccounting.test.ts`
- **Leads (not audited):**
  - (opus) previous game date comes from games table but starter from forge_goalie_game - missing goalie rows silently null the B2B starter

## M-GST-020 Skater variance (production proxy SD)

- **Match:** Opus only; Opus GST-020; Codex —
- **Purpose:** Per-skater production proxy and per-game volatility.
- **Where:** `web/components/Variance/skaterVariance.ts:46 (calculateSkaterProductionProxy)`; `web/components/Variance/skaterVariance.ts:49 (buildSkaterVarianceRows)`
- **Tags (heuristic):** denominators: per game; generation: legacy
- **Opus view (GST-020):**
  - Method: proxy = points + 0.1*shots per game; season proxy = sum; gameVolatility = population SD (divide by n) of per-game proxy; toiPerGame = sum toi_per_game / GP.
  - Inputs/units: counts; seconds; sources: —
  - Output scale: SD of proxy points; writes: —
  - Status: legacy/dead — only components/Variance/skaterVariance.test.ts imports it
  - Consumers: none (test only)
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: Sample SD (n-1) / coefficient of variation
  - Fixtures/test data: none listed
  - Tests: `web/components/Variance/skaterVariance.test.ts`
- **Leads (not audited):**
  - (opus) population SD; proxy weight 0.1 magic; no callers outside its test (variance pages use SkaterPage/GoaliePage modules)

