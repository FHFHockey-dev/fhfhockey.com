# Audit packet: Underlying stats summaries (part 1 of 2)

Master entries M-UST-001 to M-UST-060 (60 of 98 in this family). Built from the merged Opus and Codex inventories; see [../MASTER.md](../MASTER.md) and [../MERGE-NOTES.md](../MERGE-NOTES.md).

How to read: each entry gives both inventories' descriptions side by side. **Conflicts** are places where the two descriptions disagree; they are unresolved. **Leads** are Opus red flags and Codex unknowns: observations to check, not audited findings. Tags are keyword heuristics. Line numbers were valid when each inventory was written on 2026-11-10 (Opus at d31dcb33f, Codex at 11e4192d3); re-check against the current checkout.

| ID | Name | Match | Conflicts | Leads |
|---|---|---|---:|---:|
| M-UST-001 | view goalie_totals_unified (+ matview goalie_totals_unified_snapshot) | Both | 0 | 3 |
| M-UST-002 | view goalie_weekly_aggregates | Both | 0 | 2 |
| M-UST-003 | view league_weekly_goalie_averages | Both | 0 | 2 |
| M-UST-004 | fn get_skater_game_scores_for_season | Both | 0 | 4 |
| M-UST-005 | fn get_skaters_avg_stats | Both | 0 | 3 |
| M-UST-006 | views nst_seasonlong_{es,pk,pp,as}_counts and _counts_oi | Both | 0 | 6 |
| M-UST-007 | views nst_percentile_{es,pk,pp}_{offense,defense}_filtered | Both | 0 | 9 |
| M-UST-008 | matview player_totals_unified (internal_stats) + wrapper view | Both | 0 | 5 |
| M-UST-009 | views wgo_skater_stats_per_game / wgo_goalie_stats_per_game | Both | 0 | 3 |
| M-UST-010 | fn get_aggregated_player_stats | Both | 0 | 4 |
| M-UST-011 | WGO career and three-year average aggregator (legacy) | Both | 0 | 9 |
| M-UST-012 | Goalie variance fantasy points, overall SV% and GAA | Both | 0 | 5 |
| M-UST-013 | Goalie week-over-week (WoW) ranking vs league average | Both | 0 | 4 |
| M-UST-014 | Goalie variance percentile ranks and average percentile | Both | 0 | 3 |
| M-UST-015 | Goalie consistency score | Both | 0 | 3 |
| M-UST-016 | Goalie page weekly league averages | Both | 0 | 4 |
| M-UST-017 | Goalie season ranking points (weekly tier tally) | Both | 0 | 3 |
| M-UST-018 | Goalie weekly ranking tier (beats-average count) | Both | 0 | 4 |
| M-UST-019 | Ratio-of-sums aggregation across games (nullable-sum semantics) | Both | 0 | 4 |
| M-UST-020 | Power rankings STD/L10 aggregation | Both | 0 | 6 |
| M-UST-021 | Power rankings stat ranks | Both | 0 | 4 |
| M-UST-022 | Strength of schedule (direct + indirect opponent point %) | Both | 0 | 6 |
| M-UST-023 | Schedule texture (next 7/14 days) | Both | 0 | 3 |
| M-UST-024 | Skater weekly aggregates, ownership/ADP buckets | Both | 0 | 4 |
| M-UST-025 | Skater week rating z-score (Elite..Really Bad) and value overview | Both | 0 | 6 |
| M-UST-026 | Skater variance fantasy points per game | Both | 0 | 2 |
| M-UST-027 | Power rankings strength of schedule and opponent records | Both | 0 | 5 |
| M-UST-028 | Archetype tags and quadrant summary | Both | 0 | 2 |
| M-UST-029 | Risers and fallers by trend | Both | 0 | 3 |
| M-UST-030 | Process quadrant (offense/defense process z-scores) | Both | 0 | 3 |
| M-UST-031 | PDO luck status and landing ratings merge | Both | 0 | 2 |
| M-UST-032 | Team rating narrative drivers vs 10-snapshot baseline | Both | 0 | 5 |
| M-UST-033 | Special-teams PP%/PK% and ranks | Both | 0 | 4 |
| M-UST-034 | Team landing aggregation: GP, point %, share %, SH%, SV%, PDO, per-60 | Both | 0 | 4 |
| M-UST-035 | Official NHL metric overlay for team rows | Both | 0 | 4 |
| M-UST-036 | Team strength-segment TOI | Both | 0 | 3 |
| M-UST-037 | NST team table header normalization and percentage validation | Opus only | 0 | 1 |
| M-UST-038 | views nst_seasonlong_{es,pk,pp,as}_rates and _rates_oi | Opus only | 0 | 3 |
| M-UST-039 | views nst_seasonlong_combined_{es,pk,pp} | Opus only | 0 | 1 |
| M-UST-040 | Goalie leaderboard percent colour bands and fPts diff vs league | Opus only | 0 | 2 |
| M-UST-041 | Team roster matrix heat shade (min-max of sorted column) | Opus only | 0 | 2 |
| M-UST-042 | Team roster matrix goalie gamelog aggregation (SV%, GAA, HD/MD/LD SV%) | Opus only | 0 | 3 |
| M-UST-043 | Legacy NST three-year and career count averages (ThreeYearAverages) | Opus only | 0 | 6 |
| M-UST-044 | Legacy NST three-year and career rate averages (per-60) with TOT rate… | Opus only | 0 | 2 |
| M-UST-045 | NST scrape cell normalization (TOI to seconds, dashes, percents) | Opus only | 0 | 4 |
| M-UST-046 | WGO/NST three-year and career average table (wgo_avg_three_year / wgo… | Opus only | 0 | 3 |
| M-UST-047 | Stats/goalie page client-side display derivations (grouped) | Opus only | 0 | 1 |
| M-UST-048 | Goalie danger-split goals-against and xG-against accumulation | Opus only | 0 | 3 |
| M-UST-049 | Goalie save %, GAA, 'GSAA' and danger-split save metrics | Opus only | 0 | 3 |
| M-UST-050 | Goalie advanced NST metrics by strength (GSAA, xGA/60, HDSA/60, dista… | Opus only | 0 | 3 |
| M-UST-051 | Goalie metrics leader groups and variance relative display | Opus only | 0 | 1 |
| M-UST-052 | Goalie value tier score (Tier 1-5) | Opus only | 0 | 3 |
| M-UST-053 | Goalie page week windows and weekly pipeline | Opus only | 0 | 3 |
| M-UST-054 | NHL Edge metric ingestion and snapshot freshness gate | Opus only | 0 | 2 |
| M-UST-055 | Declared percent units and ratio helpers | Opus only | 0 | 1 |
| M-UST-056 | Expanded-row chart rolling 5/10 and season averages | Opus only | 0 | 2 |
| M-UST-057 | Entity ratings overlay (latest rating snapshot) | Opus only | 0 | 3 |
| M-UST-058 | Native NST-parity game build per score state | Opus only | 0 | 2 |
| M-UST-059 | Score-state classifier (score differential before event) | Opus only | 0 | 1 |
| M-UST-060 | Team-relative strength-state classifier (shift/shot based) | Opus only | 0 | 3 |

## M-UST-001 view goalie_totals_unified (+ matview goalie_totals_unified_snapshot)

- **Match:** Both; Opus UST-002; Codex sql-unified-goalie-totals
- **Purpose:** Season totals and recomputed rates for goalies from WGO + NST game rows
- **Where:** `supabase/migrations/20260716112908_production_schema_baseline.sql:11043 (goalie_totals_unified)`; `supabase/migrations/20260716112908_production_schema_baseline.sql:11425 (goalie_totals_unified_snapshot, materialized copy)`; `supabase/migrations/20260716112908_production_schema_baseline.sql:11043 goalie_totals_unified; supabase/migrations/20260716112908_production_schema_baseline.sql:11425 goalie_totals_unified_snapshot`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: per 60, per game, 5v5 only; generation: current
- **Opus view (UST-002):**
  - Method: GROUP BY player_id, season_id: SUM counts; save_pct = SUM(saves)/SUM(SA); GAA = SUM(GA)*3600/SUM(TOI); complete_game_pct, quality_starts_pct = SUM/SUM(GS); SA/60 = SUM(SA)*3600/SUM(TOI); NST all/5v5: sv% = saves/SA, GAA, SA/60, saves/60, GSAA/60, xGA/60 = SUM*3600/SUM(nst toi), HD sv%.
  - Inputs/units: TOI seconds (assumed); sources: vw_goalie_stats_unified_source (WGO + nst_goalie_* counts/rates)
  - Output scale: fractions 0-1 for sv%; per-60 rates; GAA per 60 min; writes: goalie_totals_unified_snapshot (refresh)
  - Status: unknown — no web/ reader; may be read via goalie_stats_unified/other surfaces
  - Consumers: no reader found in web/ or functions/
- **Codex view (sql-unified-goalie-totals, calculation, location; Codex family 'SQL unified goalie aggregates'):** goalie_totals_unified / goalie_totals_unified_snapshot
  - Purpose: Aggregate goalie boxscore and NST season values.
  - Inputs/units: vw_goalie_stats_unified_source per-game stats, starts and TOI seconds
  - Output scale: Sums; saves/SA; GA×3600/TOI; complete-games/starts; quality-starts/starts; SA60; NST all/5v5 SV fractions, GAA, SA60/saves60/GSAA60/xGA60 and HD SV fraction. Named outputs: player_name, team_ids, position_code, shoots_catches, games_played, games_started, wins, losses, ot_losses, saves, goals_against, shots_against, time_on_ice, shutouts, goals, assists, complete_games, incomplete_games, quality_starts, regulation_losses, regulation_wins, save_pct, goals_against_avg, complete_game_pct, quality_starts_pct, shots_against_per_60, nst_all_toi, nst_all_shots_against, nst_all_saves, nst_all_goals_a…
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex sql-unified-goalie-totals): SQL implementation contract; joined source repair in migrations/20260410_repair_goalie_stats_unified_views.sql and game-team resolver change in 20261002140500_resolve_goalie_unified_game_team.sql are relationship changes, not newly inferred metrics.
  - External references: NHL GAA = GA*3600/TOI seconds; NST goalie per-60
  - Fixtures/test data: none listed
  - Tests: `{"discovered_not_run": []}`
- **Leads (not audited):**
  - (opus) WGO time_on_ice assumed seconds (GAA*3600); if minutes, GAA off by 60x
  - (opus) NST gsaa summed from NST per-game values (NST league-average baseline per game, not season)
  - (codex:sql-unified-goalie-totals) Definition exists locally; applied migration/live view shape, data freshness and runtime consumer use unknown.

## M-UST-002 view goalie_weekly_aggregates

- **Match:** Both; Opus UST-003; Codex sql-goalie-weekly
- **Purpose:** Goalie totals per Yahoo matchup week with sv%, GAA, saves/60, SA/60
- **Where:** `supabase/migrations/20260716112908_production_schema_baseline.sql:11637 (goalie_weekly_aggregates)`; `supabase/migrations/20260716112908_production_schema_baseline.sql:11637 goalie_weekly_aggregates`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: per 60; generation: current
- **Opus view (UST-003):**
  - Method: Join goalie games into Yahoo week [start,end] where substring(season,1,4)=yw.season; SUM GP/GS/W/L/OTL/saves/SA/GA/SO/TOI; sv% = saves/SA (0 if SA=0); GAA = GA*3600/TOI; saves60 = saves*3600/TOI; SA60 = SA*3600/TOI (0 if TOI=0). Rows with TOI>0 only.
  - Inputs/units: TOI seconds; sources: wigo_goalies, yahoo_matchup_weeks
  - Output scale: fraction sv%; per-60 rates; writes: —
  - Status: live — read by web/pages/trueGoalieValue.tsx and socialShare goaliePeriod module
  - Consumers: web/pages/trueGoalieValue.tsx; web/lib/socialShare/modules/goaliePeriod.ts
- **Codex view (sql-goalie-weekly, calculation, location; Codex family 'SQL goalie weekly aggregates'):** goalie_weekly_aggregates
  - Purpose: Aggregate goalie performance into Yahoo matchup-week boundaries.
  - Inputs/units: wigo_goalies game stats, yahoo_game_weeks date intervals; counts, TOI seconds
  - Output scale: weekly GP/GS/W/L/OTL/saves/SA/GA/SO/TOI sums; weekly SV=saves/SA fraction; GAA=GA×3600/TOI; saves60 and SA60.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex sql-goalie-weekly): Definition groups goalie identity/season/week; no separate prose contract found.
  - External references: NHL GAA/sv% conventions
  - Fixtures/test data: none listed
  - Tests: `{"discovered_not_run": []}`
- **Leads (not audited):**
  - (opus) zero-denominator cases return 0 (not NULL), biasing averages downward
  - (codex:sql-goalie-weekly) Definition exists locally; applied migration/live view shape, data freshness and runtime consumer use unknown.

## M-UST-003 view league_weekly_goalie_averages

- **Match:** Both; Opus UST-004; Codex sql-league-goalie-weekly
- **Purpose:** League-wide weekly goalie averages and pooled sv%/GAA
- **Where:** `supabase/migrations/20260716112908_production_schema_baseline.sql:11789 (league_weekly_goalie_averages)`; `supabase/migrations/20260716112908_production_schema_baseline.sql:11789 league_weekly_goalie_averages`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: per 60; generation: current
- **Opus view (UST-004):**
  - Method: Per (season, week): SUM league saves/SA/GA/TOI; AVG of per-goalie weekly counts (GP, GS, W, L, OTL, saves, SA, GA, SO, TOI); pooled sv% = SUM(saves)/SUM(SA); pooled GAA, saves/60, SA/60 = SUM*3600/SUM(TOI).
  - Inputs/units: TOI seconds; sources: goalie_weekly_aggregates
  - Output scale: pooled fraction / per-60 / per-goalie averages; writes: —
  - Status: live — read by web/pages/trueGoalieValue.tsx
  - Consumers: web/pages/trueGoalieValue.tsx; web/lib/socialShare/modules/goaliePeriod.ts
- **Codex view (sql-league-goalie-weekly, calculation, location; Codex family 'SQL goalie weekly aggregates'):** league_weekly_goalie_averages
  - Purpose: Provide league weekly goalie baselines.
  - Inputs/units: goalie_weekly_aggregates per goalie/week
  - Output scale: League sums plus arithmetic means for weekly counting fields; league SV/GAA/saves60/SA60 recomputed as ratios of league totals.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex sql-league-goalie-weekly): SQL implementation source; ratio denominator weighted by totals, counting averages per available goalie row.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `{"discovered_not_run": []}`
- **Leads (not audited):**
  - (opus) count averages include every goalie with TOI>0 that week (backups dilute 'average goalie')
  - (codex:sql-league-goalie-weekly) Definition exists locally; applied migration/live view shape, data freshness and runtime consumer use unknown.

## M-UST-004 fn get_skater_game_scores_for_season

- **Match:** Both; Opus UST-005; Codex sql-skater-game-score
- **Purpose:** Per-game Game Score series for one skater-season (WiGO game score chart)
- **Where:** `supabase/migrations/20260716112908_production_schema_baseline.sql:1342 (get_skater_game_scores_for_season)`; `supabase/migrations/20260716112908_production_schema_baseline.sql:1342 get_skater_game_scores_for_season`
- **Tags (heuristic):** denominators: per game, shots on goal; generation: current
- **Opus view (UST-005):**
  - Method: Game Score = 0.75*G + 0.7*A1 + 0.55*A2 + 0.075*SOG + 0.05*BLK + 0.15*PD - 0.15*PEN + 0.01*FOW - 0.01*FOL + 0.05*SAT_for - 0.05*SAT_against + 0.15*(ES+PP+SH GF) - 0.15*(ES+PP+SH GA); one row per game ordered by date.
  - Inputs/units: per-game counts; sources: wgo_skater_stats
  - Output scale: Game Score points (unbounded, ~-1..5 typical); writes: —
  - Status: live — rpc called by web/components/WiGO/GameScoreLineChart/index.tsx
  - Consumers: web/components/WiGO/GameScoreLineChart/index.tsx; web/components/WiGO/GameScoreSection.tsx (via chart)
- **Codex view (sql-skater-game-score, calculation, location; Codex family 'Legacy SQL Game Score'):** get_skater_game_scores_for_season.game_score
  - Purpose: Return weighted per-game performance score for season charts.
  - Inputs/units: WGO per-game goals, A1/A2, shots, blocks, penalties drawn/taken, FOW/FOL, shot attempts for/against, strength-summed goals for/against
  - Output scale: 0.75G+0.7A1+0.55A2+0.075S+0.05BLK+0.15PD−0.15PEN+0.01FOW−0.01FOL+0.05SATF−0.05SATA+0.15oiGF−0.15oiGA; unbounded numeric score
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
- **Audit context:**
  - Intent (Opus): supabase/migrations/20260716112908_production_schema_baseline.sql:1353 comment 'Your existing game_score calculation remains unchanged' (no spec); UNDOCUMENTED otherwise
  - Intended contract (Codex sql-skater-game-score): No separate written contract located in this bounded pass. SQL expression and aliases are implementation evidence, not an independently verified intended specification.
  - External references: Dom Luszczyszyn Game Score (2016): same weights, but CF/CA and GF/GA are 5v5 on-ice
  - Fixtures/test data: `web/e2e/fixtures/wigo/wigoFixtures.ts`
  - Tests: `web/components/WiGO/GameScoreLineChart/index.test.tsx`; `{"discovered_not_run": []}`
- **Leads (not audited):**
  - (opus) uses all-situation sat_for/against and ES+PP+SH on-ice goals instead of 5v5 on-ice CF/CA, GF/GA in the reference formula
  - (opus) penalties_drawn/penalties are counts; 'penalties' may be penalty count vs PIM (unverified column semantics)
  - (opus) SECURITY DEFINER with in-code comment '*** VERIFY YOUR COLUMN NAME ***'
  - (codex:sql-skater-game-score) Definition exists locally; applied migration/live view shape, data freshness and runtime consumer use unknown.

## M-UST-005 fn get_skaters_avg_stats

- **Match:** Both; Opus UST-006; Codex sql-skater-box-average
- **Purpose:** Per-player average per-game box stats between two dates (league population for percentile ranks)
- **Where:** `supabase/migrations/20260716112908_production_schema_baseline.sql:1386 (get_skaters_avg_stats)`; `supabase/migrations/20260716112908_production_schema_baseline.sql:1386 get_skaters_avg_stats`
- **Tags (heuristic):** denominators: per game; generation: current
- **Opus view (UST-006):**
  - Method: AVG(goals, assists, plusMinus, pim, hits, blockedShots, powerPlayPoints, shots) per playerId over games with date in [start,end]; COUNT(*) as numGames. Unweighted per-game mean.
  - Inputs/units: per-game counts; sources: skatersGameStats, games
  - Output scale: per-game averages; writes: —
  - Status: live — rpc called by web/pages/api/v1/player/[id]/percentile-rank.ts and web/hooks/usePercentileRank.ts
  - Consumers: web/pages/api/v1/player/[id]/percentile-rank.ts; web/hooks/usePercentileRank.ts
- **Codex view (sql-skater-box-average, calculation, location; Codex family 'Legacy SQL aggregates'):** get_skaters_avg_stats
  - Purpose: Average NHL boxscore fantasy categories in a date interval.
  - Inputs/units: skatersGameStats joined games dates; goal/assist/plusMinus/PIM/hit/block/PPP/shot counts
  - Output scale: Arithmetic averages for goals, assists, plusMinus, PIM, hits, blocks, powerPlayPoints, shots; numgames=COUNT rows.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex sql-skater-box-average): No separate written contract located in this bounded pass. SQL expression and aliases are implementation evidence, not an independently verified intended specification.
  - External references: none suggested
  - Fixtures/test data: `web/e2e/fixtures/wigo/wigoFixtures.ts`
  - Tests: `web/hooks/usePercentileRank.test.tsx`; `{"discovered_not_run": []}`
- **Leads (not audited):**
  - (opus) no minimum games filter; percentile population includes 1-GP players
  - (opus) game type not filtered (preseason/playoffs included if present in skatersGameStats)
  - (codex:sql-skater-box-average) Definition exists locally; applied migration/live view shape, data freshness and runtime consumer use unknown.

## M-UST-006 views nst_seasonlong_{es,pk,pp,as}_counts and _counts_oi

- **Match:** Both; Opus UST-007; Codex sql-nst-season-as, sql-nst-season-es, sql-nst-season-pk, sql-nst-season-pp
- **Purpose:** Season-long individual and on-ice counts per player by strength from NST game logs
- **Where:** `supabase/migrations/20260716112908_production_schema_baseline.sql:18678 (nst_seasonlong_es_counts)`; `supabase/migrations/20260716112908_production_schema_baseline.sql:18719 (nst_seasonlong_es_counts_oi)`; `supabase/migrations/20260716112908_production_schema_baseline.sql:19108 (pk_counts)`; `supabase/migrations/20260716112908_production_schema_baseline.sql:19149 (pk_counts_oi)`; `supabase/migrations/20260716112908_production_schema_baseline.sql:19531 (pp_counts)`; `supabase/migrations/20260716112908_production_schema_baseline.sql:19572 (pp_counts_oi)`; `supabase/migrations/20260716112908_production_schema_baseline.sql:20388 (as_counts)`; `supabase/migrations/20260716112908_production_schema_baseline.sql:20429 (as_counts_oi)`; `supabase/migrations/20260716112908_production_schema_baseline.sql:20388 nst_seasonlong_as_counts; supabase/migrations/20260716112908_production_schema_baseline.sql:20429 nst_seasonlong_as_counts_oi; supabase/migrations/20260716112908_production_schema_baseline.sql:20472 nst_seasonlong_as_rates; supabase/migrations/20260716112908_production_schema_baseline.sql:20514 nst_seasonlong_as_rates_oi`; `supabase/migrations/20260716112908_production_schema_baseline.sql:18678 nst_seasonlong_es_counts; supabase/migrations/20260716112908_production_schema_baseline.sql:18719 nst_seasonlong_es_counts_oi; supabase/migrations/20260716112908_production_schema_baseline.sql:18762 nst_seasonlong_es_rates; supabase/migrations/20260716112908_production_schema_baseline.sql:18804 nst_seasonlong_es_rates_oi`; `supabase/migrations/20260716112908_production_schema_baseline.sql:19108 nst_seasonlong_pk_counts; supabase/migrations/20260716112908_production_schema_baseline.sql:19149 nst_seasonlong_pk_counts_oi; supabase/migrations/20260716112908_production_schema_baseline.sql:19192 nst_seasonlong_pk_rates; supabase/migrations/20260716112908_production_schema_baseline.sql:19234 nst_seasonlong_pk_rates_oi`; `supabase/migrations/20260716112908_production_schema_baseline.sql:19531 nst_seasonlong_pp_counts; supabase/migrations/20260716112908_production_schema_baseline.sql:19572 nst_seasonlong_pp_counts_oi; supabase/migrations/20260716112908_production_schema_baseline.sql:19616 nst_seasonlong_pp_rates; supabase/migrations/20260716112908_production_schema_baseline.sql:19658 nst_seasonlong_pp_rates_oi`
- **Tags (heuristic):** percent scale: 0-100; denominators: per 60; generation: current
- **Opus view (UST-007):**
  - Method: GROUP BY player_id, season: SUM(COALESCE(x,0)) for gp, toi (renamed toi_seconds / toi_seconds_oi), goals, assists, A1, A2, points, shots, ixg, icf, iff, iscfs, hdcf, rush, rebounds, pim, penalties, hits, blocks, faceoffs, cf/ca/ff/fa/sf/sa/gf/ga/xgf/xga/scf/sca/hdcf/hdca/md*/ld*/zone starts; sh_percentage = goals*100/shots.
  - Inputs/units: toi seconds (labelled); sources: nst_gamelog_{es,pk,pp,as}_counts, nst_gamelog_{es,pk,pp,as}_counts_oi
  - Output scale: season totals; SH% 0-100; writes: —
  - Status: live — as_* views read by web/lib/nst/radarSeasonStats.ts and RosterMatrixWrapper.tsx; es/pk/pp via percentile views
  - Consumers: nst_seasonlong_*_rates; web/lib/nst/radarSeasonStats.ts (as_counts_oi); web/components/RosterMatrix/RosterMatrixWrapper.tsx (as)
- **Codex view (sql-nst-season-as, calculation, location; Codex family 'SQL NST season aggregates'):** nst_seasonlong_as_counts, nst_seasonlong_as_counts_oi, nst_seasonlong_as_rates, nst_seasonlong_as_rates_oi
  - Purpose: Aggregate as player game logs to season counts and recomputed rates.
  - Inputs/units: nst_gamelog_as_counts and _counts_oi; event counts and TOI seconds; GP
  - Output scale: SUM additive fields with coalescing; SH%=SUM(G)/SUM(S)×100; individual/on-ice per60=total×3600/TOI; shares/SH/SV and IPP from aggregate components; several zero denominator cases coalesce to0. Named derived outputs: goals_per_60, total_assists_per_60, first_assists_per_60, second_assists_per_60, total_points_per_60, shots_per_60, ixg_per_60, icf_per_60, iff_per_60, iscfs_per_60, ihdcf_per_60, rush_attempts_per_60, rebounds_created_per_60, pim_per_60, total_penalties_per_60, minor_penalties_per_60, major_penalties_per_60, misconduct_penalties_per_60, penalties_drawn_per_60, giveaways_per_60, t…
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
- **Codex view (sql-nst-season-es, calculation, location; Codex family 'SQL NST season aggregates'):** nst_seasonlong_es_counts, nst_seasonlong_es_counts_oi, nst_seasonlong_es_rates, nst_seasonlong_es_rates_oi
  - Purpose: Aggregate es player game logs to season counts and recomputed rates.
  - Inputs/units: nst_gamelog_es_counts and _counts_oi; event counts and TOI seconds; GP
  - Output scale: SUM additive fields with coalescing; SH%=SUM(G)/SUM(S)×100; individual/on-ice per60=total×3600/TOI; shares/SH/SV and IPP from aggregate components; several zero denominator cases coalesce to0. Named derived outputs: goals_per_60, total_assists_per_60, first_assists_per_60, second_assists_per_60, total_points_per_60, shots_per_60, ixg_per_60, icf_per_60, iff_per_60, iscfs_per_60, ihdcf_per_60, rush_attempts_per_60, rebounds_created_per_60, pim_per_60, total_penalties_per_60, minor_penalties_per_60, major_penalties_per_60, misconduct_penalties_per_60, penalties_drawn_per_60, giveaways_per_60, t…
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
- **Codex view (sql-nst-season-pk, calculation, location; Codex family 'SQL NST season aggregates'):** nst_seasonlong_pk_counts, nst_seasonlong_pk_counts_oi, nst_seasonlong_pk_rates, nst_seasonlong_pk_rates_oi
  - Purpose: Aggregate pk player game logs to season counts and recomputed rates.
  - Inputs/units: nst_gamelog_pk_counts and _counts_oi; event counts and TOI seconds; GP
  - Output scale: SUM additive fields with coalescing; SH%=SUM(G)/SUM(S)×100; individual/on-ice per60=total×3600/TOI; shares/SH/SV and IPP from aggregate components; several zero denominator cases coalesce to0. Named derived outputs: goals_per_60, total_assists_per_60, first_assists_per_60, second_assists_per_60, total_points_per_60, shots_per_60, ixg_per_60, icf_per_60, iff_per_60, iscfs_per_60, ihdcf_per_60, rush_attempts_per_60, rebounds_created_per_60, pim_per_60, total_penalties_per_60, minor_penalties_per_60, major_penalties_per_60, misconduct_penalties_per_60, penalties_drawn_per_60, giveaways_per_60, t…
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
- **Codex view (sql-nst-season-pp, calculation, location; Codex family 'SQL NST season aggregates'):** nst_seasonlong_pp_counts, nst_seasonlong_pp_counts_oi, nst_seasonlong_pp_rates, nst_seasonlong_pp_rates_oi
  - Purpose: Aggregate pp player game logs to season counts and recomputed rates.
  - Inputs/units: nst_gamelog_pp_counts and _counts_oi; event counts and TOI seconds; GP
  - Output scale: SUM additive fields with coalescing; SH%=SUM(G)/SUM(S)×100; individual/on-ice per60=total×3600/TOI; shares/SH/SV and IPP from aggregate components; several zero denominator cases coalesce to0. Named derived outputs: goals_per_60, total_assists_per_60, first_assists_per_60, second_assists_per_60, total_points_per_60, shots_per_60, ixg_per_60, icf_per_60, iff_per_60, iscfs_per_60, ihdcf_per_60, rush_attempts_per_60, rebounds_created_per_60, pim_per_60, total_penalties_per_60, minor_penalties_per_60, major_penalties_per_60, misconduct_penalties_per_60, penalties_drawn_per_60, giveaways_per_60, t…
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED (baseline pg_dump)
  - Intended contract (Codex sql-nst-season-as): SQL named views are source contract; retain separate strength variants and denominator/output conventions. No external NST-method equivalence asserted.
  - Intended contract (Codex sql-nst-season-es): SQL named views are source contract; retain separate strength variants and denominator/output conventions. No external NST-method equivalence asserted.
  - Intended contract (Codex sql-nst-season-pk): SQL named views are source contract; retain separate strength variants and denominator/output conventions. No external NST-method equivalence asserted.
  - Intended contract (Codex sql-nst-season-pp): SQL named views are source contract; retain separate strength variants and denominator/output conventions. No external NST-method equivalence asserted.
  - External references: Natural Stat Trick season totals
  - Fixtures/test data: none listed
  - Tests: `web/lib/nst/radarSeasonStats.test.ts`; `{"discovered_not_run": []}`
- **Leads (not audited):**
  - (opus) toi summed and labelled seconds - nst_gamelog toi unit not verified here
  - (opus) no game-type filter (regular season vs playoffs) visible
  - (codex:sql-nst-season-as) Definition exists locally; applied migration/live view shape, data freshness and runtime consumer use unknown.
  - (codex:sql-nst-season-es) Definition exists locally; applied migration/live view shape, data freshness and runtime consumer use unknown.
  - (codex:sql-nst-season-pk) Definition exists locally; applied migration/live view shape, data freshness and runtime consumer use unknown.
  - (codex:sql-nst-season-pp) Definition exists locally; applied migration/live view shape, data freshness and runtime consumer use unknown.

## M-UST-007 views nst_percentile_{es,pk,pp}_{offense,defense}_filtered

- **Match:** Both; Opus UST-009; Codex sql-percentile-es-defense, sql-percentile-es-offense, sql-percentile-pk-defense, sql-percentile-pk-offense, sql-percentile-pp-defense, sql-percentile-pp-offense
- **Purpose:** Mid-rank percentiles of per-60 metrics within season among players with >= 25% of the player's GP
- **Where:** `supabase/migrations/20260716112908_production_schema_baseline.sql:18890 (nst_percentile_es_defense_filtered)`; `supabase/migrations/20260716112908_production_schema_baseline.sql:19009 (nst_percentile_es_offense_filtered)`; `supabase/migrations/20260716112908_production_schema_baseline.sql:19320 (pk_defense_filtered)`; `supabase/migrations/20260716112908_production_schema_baseline.sql:19447 (pk_offense_filtered)`; `supabase/migrations/20260716112908_production_schema_baseline.sql:19744 (pp_defense_filtered)`; `supabase/migrations/20260716112908_production_schema_baseline.sql:19871 (pp_offense_filtered)`; `supabase/migrations/20260716112908_production_schema_baseline.sql:18890 nst_percentile_es_defense_filtered`; `supabase/migrations/20260716112908_production_schema_baseline.sql:19009 nst_percentile_es_offense_filtered`; `supabase/migrations/20260716112908_production_schema_baseline.sql:19320 nst_percentile_pk_defense_filtered`; `supabase/migrations/20260716112908_production_schema_baseline.sql:19447 nst_percentile_pk_offense_filtered`; `supabase/migrations/20260716112908_production_schema_baseline.sql:19744 nst_percentile_pp_defense_filtered`; `supabase/migrations/20260716112908_production_schema_baseline.sql:19871 nst_percentile_pp_offense_filtered`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: per 60; generation: legacy, current
- **Opus view (UST-009):**
  - Method: pct(metric) = (COUNT(b: b.metric <= a.metric) + 0.5*COUNT(b: b.metric = a.metric)) / COUNT(b non-null), pool b = same season with b.gp >= ceil(a.gp*0.25). Correlated subquery per metric. ga/sa percentiles hard-coded NULL::text in defense.
  - Inputs/units: per-60; sources: nst_percentile_es_offense, nst_percentile_es_defense, ...
  - Output scale: fraction 0-1 (can exceed 1); writes: —
  - Status: legacy/dead — only referenced in web/e2e/fixtures/wigo/schema.json; client reads unfiltered base views
  - Consumers: no reader except web/e2e/fixtures/wigo/schema.json
- **Codex view (sql-percentile-es-defense, calculation, location; Codex family 'SQL player percentiles'):** nst_percentile_es_defense_filtered
  - Purpose: Compute same-season peer comparison fields with player-relative minimum GP filter.
  - Inputs/units: nst_percentile_es_defense rate view, focal GP, peer GP and metric values
  - Output scale: For each metric: (count eligible values ≤ focal +0.5×count ties)/count eligible peers, eligibility peer GP≥ceil(focal GP×.25), nonnull values. Outputs: xga_per_60_percentile, sca_per_60_percentile, hdca_per_60_percentile, shots_blocked_per_60_percentile, takeaways_per_60_percentile, minor_penalties_per_60_percentile, giveaways_per_60_percentile, ga_per_60_percentile, sa_per_60_percentile
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
- **Codex view (sql-percentile-es-offense, calculation, location; Codex family 'SQL player percentiles'):** nst_percentile_es_offense_filtered
  - Purpose: Compute same-season peer comparison fields with player-relative minimum GP filter.
  - Inputs/units: nst_percentile_es_offense rate view, focal GP, peer GP and metric values
  - Output scale: For each metric: (count eligible values ≤ focal +0.5×count ties)/count eligible peers, eligibility peer GP≥ceil(focal GP×.25), nonnull values. Outputs: total_points_per_60_percentile, ixg_per_60_percentile, iscfs_per_60_percentile, penalties_drawn_per_60_percentile, xgf_pct_percentile, cf_pct_percentile, shots_per_60_percentile, gf_per_60_percentile, scf_per_60_percentile, hdgf_per_60_percentile
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
- **Codex view (sql-percentile-pk-defense, calculation, location; Codex family 'SQL player percentiles'):** nst_percentile_pk_defense_filtered
  - Purpose: Compute same-season peer comparison fields with player-relative minimum GP filter.
  - Inputs/units: nst_percentile_pk_defense rate view, focal GP, peer GP and metric values
  - Output scale: For each metric: (count eligible values ≤ focal +0.5×count ties)/count eligible peers, eligibility peer GP≥ceil(focal GP×.25), nonnull values. Outputs: xga_per_60_percentile, sca_per_60_percentile, hdca_per_60_percentile, shots_blocked_per_60_percentile, takeaways_per_60_percentile, minor_penalties_per_60_percentile, giveaways_per_60_percentile, ga_per_60_percentile, sa_per_60_percentile
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
- **Codex view (sql-percentile-pk-offense, calculation, location; Codex family 'SQL player percentiles'):** nst_percentile_pk_offense_filtered
  - Purpose: Compute same-season peer comparison fields with player-relative minimum GP filter.
  - Inputs/units: nst_percentile_pk_offense rate view, focal GP, peer GP and metric values
  - Output scale: For each metric: (count eligible values ≤ focal +0.5×count ties)/count eligible peers, eligibility peer GP≥ceil(focal GP×.25), nonnull values. Outputs: gf_per_60_percentile, xgf_per_60_percentile, scf_per_60_percentile, hdgf_per_60_percentile, shots_per_60_percentile, total_points_per_60_percentile, ixg_per_60_percentile
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
- **Codex view (sql-percentile-pp-defense, calculation, location; Codex family 'SQL player percentiles'):** nst_percentile_pp_defense_filtered
  - Purpose: Compute same-season peer comparison fields with player-relative minimum GP filter.
  - Inputs/units: nst_percentile_pp_defense rate view, focal GP, peer GP and metric values
  - Output scale: For each metric: (count eligible values ≤ focal +0.5×count ties)/count eligible peers, eligibility peer GP≥ceil(focal GP×.25), nonnull values. Outputs: xga_per_60_percentile, sca_per_60_percentile, hdca_per_60_percentile, shots_blocked_per_60_percentile, takeaways_per_60_percentile, minor_penalties_per_60_percentile, giveaways_per_60_percentile, ga_per_60_percentile, sa_per_60_percentile
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
- **Codex view (sql-percentile-pp-offense, calculation, location; Codex family 'SQL player percentiles'):** nst_percentile_pp_offense_filtered
  - Purpose: Compute same-season peer comparison fields with player-relative minimum GP filter.
  - Inputs/units: nst_percentile_pp_offense rate view, focal GP, peer GP and metric values
  - Output scale: For each metric: (count eligible values ≤ focal +0.5×count ties)/count eligible peers, eligibility peer GP≥ceil(focal GP×.25), nonnull values. Outputs: gf_per_60_percentile, xgf_per_60_percentile, scf_per_60_percentile, hdgf_per_60_percentile, shots_per_60_percentile, total_points_per_60_percentile, ixg_per_60_percentile
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex sql-percentile-es-defense): Implementation formula is recorded verbatim in substance; name alone is not proof of percentile bounding or directional intent.
  - Intended contract (Codex sql-percentile-es-offense): Implementation formula is recorded verbatim in substance; name alone is not proof of percentile bounding or directional intent.
  - Intended contract (Codex sql-percentile-pk-defense): Implementation formula is recorded verbatim in substance; name alone is not proof of percentile bounding or directional intent.
  - Intended contract (Codex sql-percentile-pk-offense): Implementation formula is recorded verbatim in substance; name alone is not proof of percentile bounding or directional intent.
  - Intended contract (Codex sql-percentile-pp-defense): Implementation formula is recorded verbatim in substance; name alone is not proof of percentile bounding or directional intent.
  - Intended contract (Codex sql-percentile-pp-offense): Implementation formula is recorded verbatim in substance; name alone is not proof of percentile bounding or directional intent.
  - External references: percent_rank / cume_dist; mid-rank = (count(<) + 0.5*count(=))/N
  - Fixtures/test data: `web/e2e/fixtures/wigo/schema.json`
  - Tests: `{"discovered_not_run": []}`
- **Leads (not audited):**
  - (opus) ties double-counted - count(<=) already includes equals, so +0.5*count(=) gives 1.5x weight and percentiles can exceed 1
  - (opus) comparison pool depends on the subject's own GP (each player ranked against a different population)
  - (opus) defense metrics (CA/60 etc.) ranked ascending, so more shots against = higher percentile (no inversion)
  - (codex:sql-percentile-es-defense) Definition exists locally; applied migration/live view shape, data freshness and runtime consumer use unknown.
  - (codex:sql-percentile-es-offense) Definition exists locally; applied migration/live view shape, data freshness and runtime consumer use unknown.
  - (codex:sql-percentile-pk-defense) Definition exists locally; applied migration/live view shape, data freshness and runtime consumer use unknown.
  - (codex:sql-percentile-pk-offense) Definition exists locally; applied migration/live view shape, data freshness and runtime consumer use unknown.
  - (codex:sql-percentile-pp-defense) Definition exists locally; applied migration/live view shape, data freshness and runtime consumer use unknown.
  - (codex:sql-percentile-pp-offense) Definition exists locally; applied migration/live view shape, data freshness and runtime consumer use unknown.

## M-UST-008 matview player_totals_unified (internal_stats) + wrapper view

- **Match:** Both; Opus UST-011; Codex sql-unified-skater-totals
- **Purpose:** Season totals and recomputed rates per skater from WGO + NST (player_stats_unified rows)
- **Where:** `supabase/migrations/20260716112908_production_schema_baseline.sql:23084 (player_totals_unified, materialized)`; `supabase/migrations/20260731040341_privatize_unified_materialized_views.sql:80 (public wrapper view; matview moved to internal_stats)`; `supabase/migrations/20260716112908_production_schema_baseline.sql:23084 player_totals_unified`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: per 60, per game, 5v5 only; generation: current
- **Opus view (UST-011):**
  - Method: GROUP BY player, season: SUM counts; FO% = FOW/FO; zone FO%; ES GF% = ESGF/(ESGF+ESGA); avg_toi_per_game = SUM(toi_per_game)/GP; SH% = G/S; PP SH%, PP *_per_60 = 3600*SUM/SUM(pp_toi); team_pp_toi_est = pp_toi/pp_toi_pct_per_game, pp_toi_pct_of_team = SUM(pp_toi)/SUM(team_pp_toi_est); SH per-60; 5v5 G/A/P per 60 = 3600*SUM/SUM(toi_per_game_5v5); toi per shift; nst_*_per_60 = 3600*SUM(x)/SUM(nst_toi); on-ice shares = for/(for+against); nst_oi_shooting_pct = GF/SF; save_pct = (SA-GA)/SA; nst_oi_pdo = sh%+sv% (fraction); OZS% = OZS/(OZS+DZS); on-ice per-60 = 3600*SUM/SUM(ev_time_on_ice).
  - Inputs/units: TOI seconds (WGO and NST); sources: player_stats_unified (wgo_skater_stats + nst_gamelog_* joins)
  - Output scale: fractions 0-1 for percentages; per-60 rates; writes: internal_stats.player_totals_unified (REFRESH via cron)
  - Status: live — sustainability pipeline (web/lib/sustainability/*) reads it; cron refresh jobs referenced in privatize migration
  - Consumers: web/lib/sustainability/score.ts; web/lib/sustainability/priors.ts; web/lib/sustainability/bandCalculator.ts; web/lib/sustainability/read.ts; migrations/20250930_add_baseline_3yr_career.sql
- **Codex view (sql-unified-skater-totals, calculation, location; Codex family 'SQL unified player aggregates'):** player_totals_unified
  - Purpose: Combine season-total WGO/NST counts and compute weighted ratios and rates.
  - Inputs/units: player_stats_unified per-game rows; boxscore counts; time seconds; NST individual/on-ice counts; reconstructed zone faceoff numerators and team PP TOI
  - Output scale: SUM counts; G/A/PTS/shot/peripheral per60, perGame; shooting/faceoff/PP-TOI fractions from sums; time/shift; NST per60 and on-ice for-shares, SH, SV, PDO=SH+SV fractions; OZ share excludes neutral. Named derived expressions: d_zone_fow_numer, ev_fow_numer, n_zone_fow_numer, o_zone_fow_numer, team_pp_toi_est, player_name, team_ids, position_code, shoots_catches, games_played, points, goals, assists, shots, plus_minus, gw_goals, pp_points, sh_points, penalty_minutes, hits, blocked_shots, takeaways, giveaways, total_faceoffs, total_fol, total_fow, fow_percentage, d_zone_faceoffs, d_zone_fo_perce…
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED (baseline pg_dump); privatize migration header documents storage move only
  - Intended contract (Codex sql-unified-skater-totals): View definition is source contract. Private storage relocation/public wrappers in 20260731040341_privatize_unified_materialized_views.sql retain named surfaces.
  - External references: NST per-60 and on-ice share definitions
  - Fixtures/test data: none listed
  - Tests: `web/__tests__/pages/api/v1/db/cron-report.test.ts`; `web/lib/supabase/supportedBaselineMigration.test.ts`; `web/lib/sustainability/score.test.ts`; `{"discovered_not_run": []}`
- **Leads (not audited):**
  - (opus) nst_goals_per_60/nst_shots_per_60 use WGO all-situation goals/shots over NST toi (source and strength mismatch)
  - (opus) NST on-ice counts per-60 divided by WGO ev_time_on_ice (different source/strength than NST on-ice counts)
  - (opus) OZS% excludes NZ here but nst_seasonlong_*_rates_oi includes NZ - inconsistent definitions
  - (opus) team_pp_toi_est = pp_toi / pp_toi_pct_per_game assumes the pct is a 0-1 fraction
  - (codex:sql-unified-skater-totals) Definition exists locally; applied migration/live view shape, data freshness and runtime consumer use unknown.

## M-UST-009 views wgo_skater_stats_per_game / wgo_goalie_stats_per_game

- **Match:** Both; Opus UST-012; Codex sql-wgo-per-game
- **Purpose:** Season per-game rates and percent of team games played
- **Where:** `supabase/migrations/20260716112908_production_schema_baseline.sql:27556 (wgo_skater_stats_per_game)`; `supabase/migrations/20260716112908_production_schema_baseline.sql:27290 (wgo_goalie_stats_per_game)`; `supabase/migrations/20260716112908_production_schema_baseline.sql:27556 wgo_skater_stats_per_game; supabase/migrations/20260716112908_production_schema_baseline.sql:27290 wgo_goalie_stats_per_game`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: per game, per team game, 5v5 only; generation: current
- **Opus view (UST-012):**
  - Method: percent_games = games_played / team games_played; every counting stat / games_played (points, goals, assists, shots, OT/GW goals, PPP, blocks, ENG, giveaways ...; goalies W, L, saves, SA, SO, QS per GP). Goalie team from current team when multi-team.
  - Inputs/units: season totals; sources: wgo_skater_stats_totals, wgo_goalie_stats_totals, teams, team_summary_years
  - Output scale: per-game; fraction 0-1; writes: —
  - Status: live — read by PlayerRadarChart.tsx and radarSeasonStats.ts
  - Consumers: web/components/PlayerStats/PlayerRadarChart.tsx; web/lib/nst/radarSeasonStats.ts
- **Codex view (sql-wgo-per-game, calculation, location; Codex family 'SQL WGO derived rates'):** wgo_skater_stats_per_game / wgo_goalie_stats_per_game
  - Purpose: Normalize season WGO count rows by games played and team games.
  - Inputs/units: WGO skater/goalie counts, player GP and team GP
  - Output scale: percent_games=playerGP/teamGP; counting stats divided by playerGP. Skater derived aliases: percent_games, points, goals, assists, shots, ot_goals, gw_goals, pp_points, blocked_shots, empty_net_goals, empty_net_points, giveaways, hits, missed_shots, takeaways, d_zone_faceoffs, ev_faceoffs, n_zone_faceoffs, o_zone_faceoffs, pp_faceoffs, sh_faceoffs, total_faceoffs, d_zone_fol, d_zone_fow, ev_fol, ev_fow, n_zone_fol, n_zone_fow, o_zone_fol, o_zone_fow, pp_fol, pp_fow, sh_fol, sh_fow, total_fol, total_fow, es_goals_against, es_goals_for, pp_goals_against, pp_goals_for, sh_goals_against, sh_goals_…
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex sql-wgo-per-game): SQL views define denominator choice; existing rate fields are passed through rather than recalculated.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/components/PlayerStats/PlayerRadarChart.test.tsx`; `web/lib/nst/radarSeasonStats.test.ts`; `{"discovered_not_run": []}`
- **Leads (not audited):**
  - (opus) multi-team players use current team's games for percent_games (can exceed 1 or understate)
  - (opus) goalie per-game uses games_played not games_started
  - (codex:sql-wgo-per-game) Definition exists locally; applied migration/live view shape, data freshness and runtime consumer use unknown.

## M-UST-010 fn get_aggregated_player_stats

- **Match:** Both; Opus UST-013; Codex sql-legacy-player-aggregates
- **Purpose:** Season/date-range aggregate shooting%, assist ratio, peripherals, 'PDO', zone-start% for one skater
- **Where:** `supabase/migrations/20260730193000_repair_compile_invalid_legacy_routines.sql:32 (get_aggregated_player_stats(int,date,date), latest)`; `supabase/migrations/20260716112908_production_schema_baseline.sql:1302 (get_aggregated_player_stats(int,date,date), baseline)`; `supabase/migrations/20260716112908_production_schema_baseline.sql:1279 (get_aggregated_player_stats(int,int), year overload, never redefined)`; `supabase/migrations/20260716112908_production_schema_baseline.sql:1279 get_aggregated_player_stats; supabase/migrations/20260730193000_repair_compile_invalid_legacy_routines.sql:32 get_aggregated_player_stats`
- **Tags (heuristic):** percent scale: 0-100; denominators: per game, 5v5 only; generation: legacy, current
- **Opus view (UST-013):**
  - Method: SH% = SUM(goals)/SUM(shots)*100; assist_ratio = SUM(A1)/SUM(A2); total_peripherals = SUM(blocks+hits+shots); pdo = SUM(skater_save_pct_5v5)/SUM(shooting_percentage_5v5)*100; o_zone_start_pct = AVG(zone_start_pct) of game rows. (int,int) overload filters EXTRACT(YEAR FROM date)=season_year.
  - Inputs/units: per-game WGO rows; sh%/sv% columns percent-or-fraction unknown; sources: wgo_skater_stats
  - Output scale: percent 0-100 for SH%; ratio for assist_ratio; 'pdo' unbounded ratio x100; writes: —
  - Status: legacy/dead — no web/ or functions/ caller; comment in repair migration calls it 'Read-only legacy aggregate contract'
  - Consumers: no repo caller found (only web/lib/supabase/supportedBaselineMigration.test.ts lists it)
- **Codex view (sql-legacy-player-aggregates, calculation, location; Codex family 'Legacy SQL aggregates'):** get_aggregated_player_stats
  - Purpose: Provide legacy aggregate shooting, assist, peripheral, PDO-labelled and zone-start values.
  - Inputs/units: wgo_skater_stats within calendar-year or date-range filter: goals, shots, primary/secondary assists, blocks, hits, skater_save_pct_5v5, shooting_percentage_5v5, zone_start_pct
  - Output scale: shooting_percentage=SUM(G)/SUM(S)×100; assist_ratio=SUM(A1)/SUM(A2); total_peripherals=SUM(blocks+hits+shots); pdo=SUM(skater SV%)/SUM(skater SH%)×100; o_zone_start_pct=AVG(zone_start_pct).
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
- **Audit context:**
  - Intent (Opus): supabase/migrations/20260730193000_repair_compile_invalid_legacy_routines.sql:1-6 'Preserve the read-only aggregate RPC contract and repair only its result typing'
  - Intended contract (Codex sql-legacy-player-aggregates): Repair migration comment: Read-only legacy aggregate contract with explicit double-precision results. Separate from conventional sum-based PDO elsewhere.
  - External references: PDO = on-ice SH% + on-ice SV% (NST/Corsica convention, ~100 or ~1.000)
  - Fixtures/test data: none listed
  - Tests: `web/lib/supabase/supportedBaselineMigration.test.ts`; `{"discovered_not_run": ["web/hooks/usePercentileRank.test.tsx"]}`
- **Leads (not audited):**
  - (opus) 'pdo' is a RATIO of summed per-game sv% to summed sh% x100, not the sum sh%+sv%; repaired in 20260730193000 but formula kept
  - (opus) (int,int) overload uses calendar year EXTRACT(YEAR FROM date) as season, splitting NHL seasons across two years; baseline version also does integer SUM/SUM (possible integer division)
  - (opus) zone_start_pct averaged per game (unweighted) rather than from summed zone starts
  - (codex:sql-legacy-player-aggregates) Definition exists locally; applied migration/live view shape, data freshness and runtime consumer use unknown.

## M-UST-011 WGO career and three-year average aggregator (legacy)

- **Match:** Both; Opus UST-021; Codex core-364, core-365, core-366, core-367
- **Purpose:** Aggregate wgo_skater_stats_totals seasons into career and prior-3-season averages
- **Where:** `web/scripts/WGOAverages/calculateAverages.ts:162 (safeDivide)`; `web/scripts/WGOAverages/calculateAverages.ts:167 (calculateAveragedStats)`; `web/scripts/WGOAverages/calculateAverages.ts:491 (processAndUpsertAverages)`; `web/scripts/WGOAverages/calculateAverages.ts:167 calculateAveragedStats`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: per 60, per game, shots on goal; generation: legacy
- **Opus view (UST-021):**
  - Method: career = all seasons; three-year = seasons.slice(1,4) (excludes most recent season); counting stats summed / number of seasons; listed 'per game' stats summed / total GP; time_on_ice_per_shift summed / total shifts; penalty_minutes / total pp_toi; percentages from summed numerators/denominators (sh% = G/SOG, FO% = FOW/(FOW+FOL), SAT% etc.); per-60 = stat / totalToiSeconds * 3600 where totalToiSeconds = sum of pp_toi; safeDivide returns 0 on zero denominator
  - Inputs/units: season totals; TOI seconds; sources: players, wgo_skater_stats_totals
  - Output scale: per-season averages, per-game, fractions 0-1, per-60; writes: wgo_career_averages, wgo_three_year_averages (upsert on player_id)
  - Status: flagged off — runs only when RUN_WGO_AVERAGES_SCRIPT=true (web/scripts/WGOAverages/calculateAverages.ts:752); header says 'Opt-in legacy'
  - Consumers: none found in web/ outside this script
- **Codex view (core-364, calculation, codex_part_of_opus; Codex family 'legacy WGO averages'):** Season-average stored fields
  - Formula: Sum each named field across seasons, then divide by number of seasons.
  - Purpose: Provide season-average stored fields for the identified consumer.
  - Inputs/units: Numeric season fields; number of seasons.
  - Output scale: Named *_avg or *_per_60_avg values in formula-specific units.
  - Version/status: Local working tree on octoberBranch, read on 2026-11-10. HEAD changed during the inventory from d31dcb33f72d4c9d69b507874c388f0cd549fe2f to 11e4192d36ecc4ac4b338f9ab48e529c7049c618. This is a non-atomic local scan; deployment and persisted-data state are not verified. Referenced implementation files had no tracked/untracked status entry at the final status check.
- **Codex view (core-365, calculation, codex_part_of_opus; Codex family 'legacy WGO averages'):** Per-game, per-shift and TOI-denominated averages
  - Formula: Per-game fields divide summed values by summed games; time_on_ice_per_shift divides by summed shifts; penalty_minutes_per_toi_avg divides penalty minutes by summed pp_toi seconds.
  - Purpose: Provide per-game, per-shift and TOI-denominated averages for the identified consumer.
  - Inputs/units: Summed season fields, games, shifts and pp_toi seconds.
  - Output scale: Named *_avg or *_per_60_avg values in formula-specific units.
  - Version/status: Local working tree on octoberBranch, read on 2026-11-10. HEAD changed during the inventory from d31dcb33f72d4c9d69b507874c388f0cd549fe2f to 11e4192d36ecc4ac4b338f9ab48e529c7049c618. This is a non-atomic local scan; deployment and persisted-data state are not verified. Referenced implementation files had no tracked/untracked status entry at the final status check.
- **Codex view (core-366, calculation, codex_part_of_opus; Codex family 'legacy WGO averages'):** Pooled percentage-like season ratios
  - Formula: Direct ratios from percentageCalculations; most are success/attempt or for/(for+against). on_ice_shooting_pct is implemented as sat_for/goals_for. Outputs do not multiply by 100. Zero-denominator behavior follows safeDivide and explicit \|\| 1 fallbacks.
  - Purpose: Provide pooled percentage-like season ratios for the identified consumer.
  - Inputs/units: Summed goals, shots, faceoff counts and for/against counts.
  - Output scale: Named *_avg or *_per_60_avg values in formula-specific units.
  - Version/status: Local working tree on octoberBranch, read on 2026-11-10. HEAD changed during the inventory from d31dcb33f72d4c9d69b507874c388f0cd549fe2f to 11e4192d36ecc4ac4b338f9ab48e529c7049c618. This is a non-atomic local scan; deployment and persisted-data state are not verified. Referenced implementation files had no tracked/untracked status entry at the final status check.
- **Codex view (core-367, calculation, codex_part_of_opus; Codex family 'legacy WGO averages'):** Stored per-60 season averages
  - Formula: Each listed metric: 3600 * summed count / totalToiSeconds; zero pp_toi uses fallback denominator 1.
  - Purpose: Provide stored per-60 season averages for the identified consumer.
  - Inputs/units: Summed metric counts and totalToiSeconds, implemented as summed pp_toi.
  - Output scale: Named *_avg or *_per_60_avg values in formula-specific units.
  - Version/status: Local working tree on octoberBranch, read on 2026-11-10. HEAD changed during the inventory from d31dcb33f72d4c9d69b507874c388f0cd549fe2f to 11e4192d36ecc4ac4b338f9ab48e529c7049c618. This is a non-atomic local scan; deployment and persisted-data state are not verified. Referenced implementation files had no tracked/untracked status entry at the final status check.
- **Audit context:**
  - Intent (Opus): file header 'Opt-in legacy WGO averages maintenance script' (web/scripts/WGOAverages/calculateAverages.ts:1)
  - Intended contract (Codex core-364): Function signature and comments at web/scripts/WGOAverages/calculateAverages.ts:167 calculateAveragedStats; independent product specification not verified.
  - Intended contract (Codex core-365): Function signature and comments at web/scripts/WGOAverages/calculateAverages.ts:167 calculateAveragedStats; independent product specification not verified.
  - Intended contract (Codex core-366): Function signature and comments at web/scripts/WGOAverages/calculateAverages.ts:167 calculateAveragedStats; independent product specification not verified.
  - Intended contract (Codex core-367): Function signature and comments at web/scripts/WGOAverages/calculateAverages.ts:167 calculateAveragedStats; independent product specification not verified.
  - External references: NST per-60 convention (all-situation TOI)
  - Fixtures/test data: none listed
  - Tests: `Located only; not run for this inventory.`; `web/__tests__/pages/api/WGOAverages/calculateAverages.test.ts`
- **Leads (not audited):**
  - (opus) per-60 and penalty-minutes-per-TOI use pp_toi (power-play TOI) as total TOI
  - (opus) on_ice_shooting_pct = sat_for / goals_for (inverted and wrong numerator)
  - (opus) toi_per_game and points_per_game (already per-game averages) are summed then divided by total GP
  - (opus) time_on_ice_per_shift sums per-shift averages then divides by total shifts
  - (opus) zero denominators return 0 instead of null
  - (codex:core-364) ["Calculation inventory only; no correctness or model-quality verdict.", "Grouped by distinct formula; metric_keys enumerates the stored metric family."]
  - (codex:core-365) ["Calculation inventory only; no correctness or model-quality verdict.", "Grouped by distinct formula; metric_keys enumerates the stored metric family."]
  - (codex:core-366) ["Calculation inventory only; no correctness or model-quality verdict.", "Grouped by distinct formula; metric_keys enumerates the stored metric family."]
  - (codex:core-367) ["Calculation inventory only; no correctness or model-quality verdict.", "Grouped by distinct formula; metric_keys enumerates the stored metric family."]

## M-UST-012 Goalie variance fantasy points, overall SV% and GAA

- **Match:** Both; Opus UST-028; Codex core-329, core-333
- **Purpose:** Per-goalie totals and ratio stats over the selected weeks
- **Where:** `web/components/GoaliePage/goalieCalculations.ts:176 (calculateGameFantasyPoints)`; `web/components/GoaliePage/goalieCalculations.ts:157 (calculateOverallSavePct)`; `web/components/GoaliePage/goalieCalculations.ts:163 (calculateOverallGAA)`; `web/components/GoaliePage/goalieCalculations.ts:324 (calculateGoalieRankings)`; `web/components/GoaliePage/goalieCalculations.ts:176 calculateGameFantasyPoints`; `web/components/GoaliePage/goalieCalculations.ts:324 calculateGoalieRankings`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: per 60; generation: current
- **Opus view (UST-028):**
  - Method: FP/game = GA*wGA + SV*wSV + SO*wSO + W*wW. Overall SV% = sum(saves)/sum(SA) (0 if no SA); GAA = sum(GA)*3600/sum(TOI sec); TOI shown in minutes; FP/G = total/games; league FP/G = total league FP / league games; GoG SD (sample) of game FP if >=2 games.
  - Inputs/units: WGO goalie game time_on_ice seconds; counts; sources: wgo_goalie_stats, goalie weekly aggregates and league weekly averages (loaded in pages/goalies.js)
  - Output scale: SV% fraction 0-1; GAA per 60; TOI minutes; fantasy points; writes: —
  - Status: live — pages/goalies.js (also /variance/goalies re-export) and pages/trueGoalieValue.tsx
  - Consumers: GoalieLeaderboard; GoalieTable; pages/goalies.js; pages/trueGoalieValue.tsx
- **Codex view (core-329, calculation, location; Codex family 'goalie value UI'):** Goalie game fantasy points
  - Formula: GA*wGA+saves*wSave+SO*wSO+wins*wWin.
  - Purpose: Calculate goalie game fantasy points.
  - Inputs/units: GA, saves, shutouts, wins and custom scoring weights.
  - Output scale: Fantasy points/game.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f.  Deployment not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final status check.
- **Codex view (core-333, calculation, location; Codex family 'goalie value UI'):** Goalie percentiles and composite ranking
  - Formula: Pooled SV=saves/SA; GAA=3600GA/seconds; midrank percentile with direction inversion; arithmetic mean available selected percentiles; grade totals preserved.
  - Purpose: Calculate goalie percentiles and composite ranking.
  - Inputs/units: Weekly/game stats, scoring settings, selected percentile categories.
  - Output scale: Weekly quality points, good/acceptable percentages, sample SDs, pooled SV/GAA, fantasy rates, percentile composite.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f.  Deployment not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final status check.
- **Audit context:**
  - Intent (Opus): tasks/TASKS/variance/v1/prd/prd-variance-section.md; defaults web/lib/projectionsConfig/fantasyPointsConfig.ts:25-29
  - Intended contract (Codex core-329): Source types and implementation in web/components/GoaliePage/goalieCalculations.ts:176; separate acceptance not verified.
  - Intended contract (Codex core-333): Source types and implementation in web/components/GoaliePage/goalieCalculations.ts:324; separate acceptance not verified.
  - External references: NHL.com SV% and GAA (GA*60/TOI min)
  - Fixtures/test data: none listed
  - Tests: `Located only; not run for this inventory.`; `web/__tests__/pages/trueGoalieValue.test.tsx`; `web/components/GoaliePage/goalieCalculations.test.ts`
- **Leads (not audited):**
  - (opus) SV% returns 0 (not null) when no shots against, which then ranks as worst
  - (opus) totalGP counts every game row as 1 GP including relief appearances
  - (opus) 'gogVariance' is a standard deviation
  - (codex:core-329) ["Inventory only; no correctness verdict."]
  - (codex:core-333) ["Inventory only; no correctness verdict."]

## M-UST-013 Goalie week-over-week (WoW) ranking vs league average

- **Match:** Both; Opus UST-029; Codex core-330, core-331
- **Purpose:** Grade each goalie-week by share of selected stats beating league weekly average
- **Where:** `web/components/GoaliePage/goalieCalculations.ts:199 (calculateWeeklyRanking)`; `web/components/GoaliePage/goalieCalculations.ts:190 (classifyGoalieWeekPercentage)`; `web/components/GoaliePage/goalieCalculations.ts:20 (statMap)`; `web/components/GoaliePage/goalieCalculations.ts:38 (rankingPoints)`; `web/components/GoaliePage/goalieCalculations.ts:54 (GOALIE_WEEK_MINIMUM_SAMPLE)`; `web/components/GoaliePage/goalieCalculations.ts:59 isGoalieWeekEligible`; `web/components/GoaliePage/goalieCalculations.ts:199 calculateWeeklyRanking`
- **Tags (heuristic):** percent scale: 0-100; denominators: per 60; generation: current
- **Opus view (UST-029):**
  - Method: Eligible week requires >=1 start and >=20 min TOI. For each selected stat: better if >= avg (larger-is-better) or <= avg (smaller); stats with avg 0 or null skipped. pct = better/compared*100; >=80 Elite, >=60 Good, >=45 Average, >=30 Bad, else Abysmal. Points Elite 20, Good 10, Average 5, Bad 3, Abysmal 1. WoW SD (sample) of weekly points; % acceptable/good weeks.
  - Inputs/units: weekly aggregates (TOI seconds) vs league weekly averages; sources: goalie weekly aggregates / league_averages_goalies (via pages/goalies.js)
  - Output scale: percent of stats beating average 0-100; band; points 1/3/5/10/20; writes: —
  - Status: live — pages/goalies.js, GoalieList.tsx
  - Consumers: GoalieList; GoalieLeaderboard; sort order of goalie rankings
- **Codex view (core-330, calculation, location; Codex family 'goalie value UI'):** Goalie week eligibility
  - Formula: At least 1 start and 1200 seconds.
  - Purpose: Calculate goalie week eligibility.
  - Inputs/units: Weekly starts and TOI seconds.
  - Output scale: Eligible boolean.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f.  Deployment not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final status check.
- **Codex view (core-331, calculation, location; Codex family 'goalie value UI'):** Direction-aware weekly goalie grade
  - Formula: Count >=average for higher-is-better and <=average for lower; divide by comparable stats; boundaries 80/60/45/30; points 20/10/5/3/1.
  - Purpose: Calculate direction-aware weekly goalie grade.
  - Inputs/units: Selected valid goalie stats and league weekly averages.
  - Output scale: Comparison percentage and grade/points.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f.  Deployment not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final status check.
- **Audit context:**
  - Intent (Opus): web/components/GoaliePage/goalieCalculations.ts:18-19,37 comments ('Keep for WoW ranking')
  - Intended contract (Codex core-330): Source types and implementation in web/components/GoaliePage/goalieCalculations.ts:59; separate acceptance not verified.
  - Intended contract (Codex core-331): Source types and implementation in web/components/GoaliePage/goalieCalculations.ts:199; separate acceptance not verified.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `Located only; not run for this inventory.`; `web/components/GoaliePage/goalieCalculations.test.ts`
- **Leads (not audited):**
  - (opus) shotsAgainst and shotsAgainst/60 flagged 'larger is better' (workload) and losses/OTL 'smaller'; equal-to-average counts as better
  - (opus) stats whose league average is exactly 0 are skipped, changing the denominator per week
  - (codex:core-330) ["Inventory only; no correctness verdict."]
  - (codex:core-331) ["Inventory only; no correctness verdict."]

## M-UST-014 Goalie variance percentile ranks and average percentile

- **Match:** Both; Opus UST-030; Codex core-333
- **Purpose:** Midrank percentile per stat across goalies and their mean
- **Where:** `web/components/GoaliePage/goalieCalculations.ts:269 (calculatePercentile)`; `web/components/GoaliePage/goalieCalculations.ts:324 (calculateGoalieRankings percentile block)`; `web/components/GoaliePage/goalieCalculations.ts:324 calculateGoalieRankings`
- **Tags (heuristic):** percent scale: 0-100; generation: current
- **Opus view (UST-030):**
  - Method: percentile = (below + 0.5*equal)/N*100, inverted (100-p) for smaller-is-better; averagePercentileRank = mean of available stat percentiles.
  - Inputs/units: overall goalie stats (SV% 0-1, GAA, counts); sources: —
  - Output scale: percentile 0-100 midrank; writes: —
  - Status: live — pages/goalies.js
  - Consumers: GoalieLeaderboard
- **Codex view (core-333, calculation, location; Codex family 'goalie value UI'):** Goalie percentiles and composite ranking
  - Formula: Pooled SV=saves/SA; GAA=3600GA/seconds; midrank percentile with direction inversion; arithmetic mean available selected percentiles; grade totals preserved.
  - Purpose: Calculate goalie percentiles and composite ranking.
  - Inputs/units: Weekly/game stats, scoring settings, selected percentile categories.
  - Output scale: Weekly quality points, good/acceptable percentages, sample SDs, pooled SV/GAA, fantasy rates, percentile composite.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f.  Deployment not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final status check.
- **Audit context:**
  - Intent (Opus): web/components/GoaliePage/goalieCalculations.ts:298-309 comments (percentile rank formula)
  - Intended contract (Codex core-333): Source types and implementation in web/components/GoaliePage/goalieCalculations.ts:324; separate acceptance not verified.
  - External references: Midrank percentile
  - Fixtures/test data: none listed
  - Tests: `Located only; not run for this inventory.`; `web/components/GoaliePage/goalieCalculations.test.ts`
- **Leads (not audited):**
  - (opus) value lookup switch only maps gamesPlayed, wins, savePct, goalsAgainstAverage, so other stats get no percentile and averagePercentileRank uses at most 4 stats
  - (opus) no minimum GP/shots filter, so 1-game goalies with 1.000 SV% enter the pool
  - (codex:core-333) ["Inventory only; no correctness verdict."]

## M-UST-015 Goalie consistency score

- **Match:** Both; Opus UST-031; Codex core-330, core-332
- **Purpose:** 0-100 stability of weekly quality bands
- **Where:** `web/components/GoaliePage/goalieCalculations.ts:66 (buildGoalieConsistencySummary)`; `web/components/GoaliePage/goalieCalculations.ts:59 isGoalieWeekEligible`; `web/components/GoaliePage/goalieCalculations.ts:66 buildGoalieConsistencySummary`
- **Tags (heuristic):** percent scale: 0-100; generation: current
- **Opus view (UST-031):**
  - Method: Band scores Elite 100, Good 75, Average 50, Bad 25, Abysmal 0; consistency = round(max(0, 100 - popSD/50*100)) if >=2 weeks; avg starts/week; W-(L+OTL) record pattern counts.
  - Inputs/units: band scores 0-100; sources: —
  - Output scale: 0-100 stability score; writes: —
  - Status: live — pages/goalies.js leaderboard
  - Consumers: GoalieLeaderboard columns
- **Codex view (core-330, calculation, location; Codex family 'goalie value UI'):** Goalie week eligibility
  - Formula: At least 1 start and 1200 seconds.
  - Purpose: Calculate goalie week eligibility.
  - Inputs/units: Weekly starts and TOI seconds.
  - Output scale: Eligible boolean.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f.  Deployment not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final status check.
- **Codex view (core-332, calculation, location; Codex family 'goalie value UI'):** Goalie consistency score and record frequency
  - Formula: Map grades 100/75/50/25/0; score=round(max(0, 100-2*population SD)); require 2 weeks; count records with L+OTL.
  - Purpose: Calculate goalie consistency score and record frequency.
  - Inputs/units: Eligible weekly grades and win/loss/start records.
  - Output scale: Consistency 0..100 or null, starts/week, record frequency.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f.  Deployment not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final status check.
- **Audit context:**
  - Intent (Opus): web/components/GoaliePage/goalieMetrics.ts:481 column tooltip '0-100 stability score across eligible weekly quality bands'
  - Intended contract (Codex core-330): Source types and implementation in web/components/GoaliePage/goalieCalculations.ts:59; separate acceptance not verified.
  - Intended contract (Codex core-332): Source types and implementation in web/components/GoaliePage/goalieCalculations.ts:66; separate acceptance not verified.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `Located only; not run for this inventory.`; `web/components/GoaliePage/goalieCalculations.test.ts`
- **Leads (not audited):**
  - (opus) population SD here vs sample SD for wow/gog variance in the same module
  - (codex:core-330) ["Inventory only; no correctness verdict."]
  - (codex:core-332) ["Inventory only; no correctness verdict."]

## M-UST-016 Goalie page weekly league averages

- **Match:** Both; Opus UST-032; Codex core-205
- **Purpose:** Compute per-week league average goalie line used as the baseline for weekly goalie rankings (legacy lib copy).
- **Where:** `web/lib/supabase/GoaliePage/calculateAverages.ts:18 (calculateAverages)`; `web/lib/supabase/GoaliePage/calculateAverages.ts:18 calculateAverages`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: per 60; generation: legacy, current
- **Opus view (UST-032):**
  - Method: Counting stats = total / number of goalies (equal weight per goalie). TOI = total seconds / 60 / goalies (minutes per goalie). savePct = sum saves / sum shotsAgainst (ratio of sums, 0-1). GAA = sum GA * 60 / total minutes. Empty input -> all zeros.
  - Inputs/units: NHL goalie summary weekly totals; timeOnIce in SECONDS (converted /60); savePct fraction 0-1; sources: api.nhle.com stats/rest goalie/summary (weekly aggregate)
  - Output scale: per-goalie mean counts; TOI minutes per goalie; savePct fraction 0-1 (ratio of sums); GAA goals per 60; writes: league_averages_goalies (via upsertGoalieData.js)
  - Status: legacy/dead — web/lib/supabase/GoaliePage/* has no importers outside the folder (rg 'supabase/GoaliePage' finds only its own files); only caller is the standalone script updateWeeklyData.ts; output tables goalie_page_stats/league_averages_goalies have no readers; live goalie pages import components/GoaliePage/goalieCalculations.ts
  - Consumers: web/lib/supabase/GoaliePage/updateWeeklyData.ts; calculateRanking.ts / calculateGoalieRanking.ts (no external importers)
- **Codex view (core-205, calculation, location; Codex family 'goalie weekly'):** Goalie weekly cohort averages and pooled ratios
  - Formula: Count sum/goalie count; SV=sumSV/sumSA; GAA=3600*sumGA/sum seconds.
  - Purpose: Calculate goalie weekly cohort averages and pooled ratios.
  - Inputs/units: Goalie count stats, TOI seconds, saves, shots against, GA.
  - Output scale: Mean counts/goalie; TOI minutes; save fraction; GA60.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f.  Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final status check.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex core-205): Source types and implementation in web/lib/supabase/GoaliePage/calculateAverages.ts:18; separate acceptance not verified.
  - External references: League SV% = total saves / total shots against; GAA = GA*60/minutes
  - Fixtures/test data: none listed
  - Tests: `No directly named test located; tests not run.`
- **Leads (not audited):**
  - (opus) counting-stat averages are per goalie appearing (incl. 1-game/relief goalies), so the 'average' wins/saves baseline is low and not per-start
  - (opus) averages TOI stored in minutes but per-goalie goalie_page_stats.time_on_ice is written raw from the NHL API (likely seconds) despite the 'Already in minutes' comment - unit mismatch between the two tables
  - (opus) lib/supabase/GoaliePage has no importers outside itself; live goalie pages use components/GoaliePage/goalieCalculations.ts - divergent duplicate
  - (codex:core-205) ["Inventory only, not validation of the formula, source semantics or model quality."]

## M-UST-017 Goalie season ranking points (weekly tier tally)

- **Match:** Both; Opus UST-033; Codex core-207
- **Purpose:** Rank goalies over the season by summing weekly tier points and computing % acceptable/good weeks.
- **Where:** `web/lib/supabase/GoaliePage/calculateGoalieRanking.ts:12 (calculateGoalieRankings)`; `web/lib/supabase/GoaliePage/calculateGoalieRanking.ts:12 calculateGoalieRankings`
- **Tags (heuristic):** percent scale: 0-100; generation: legacy, current
- **Opus view (UST-033):**
  - Method: Week points: Elite 20, Quality 10, Week 5, Bad 3, Really Bad 1; totalPoints = sum; percentAcceptableWeeks = (Elite+Quality+Week)/weeks*100; percentGoodWeeks = (Elite+Quality)/weeks*100; sort by totalPoints desc.
  - Inputs/units: weekly tiers per goalie; sources: goalie_page_stats, league_averages_goalies
  - Output scale: totalPoints (sum of 20/10/5/3/1 per week, unbounded); percents 0-100; writes: —
  - Status: legacy/dead — no importers of web/lib/supabase/GoaliePage/calculateGoalieRanking.ts; live equivalent is components/GoaliePage/goalieCalculations.ts (pages/goalies.js:10, pages/trueGoalieValue.tsx:27)
  - Consumers: none found outside web/lib/supabase/GoaliePage
- **Codex view (core-207, calculation, location; Codex family 'goalie weekly'):** Season weekly quality points and percentages
  - Formula: Assign grade weights 20,10,5,3,1. Acceptable percentage=100*(top three grade counts)/total weeks. Good percentage=100*(top two grade counts)/total weeks.
  - Purpose: Calculate season weekly quality points and percentages.
  - Inputs/units: Weekly goalie quality grades.
  - Output scale: Total quality points; acceptable-week and good-week percentages; descending ranking.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f.  Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final status check.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex core-207): Source types and implementation in web/lib/supabase/GoaliePage/calculateGoalieRanking.ts:12; separate acceptance not verified.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `No directly named test located; tests not run.`
- **Leads (not audited):**
  - (opus) totals are not normalized by weeks played, and even a 'Really Bad Week' earns +1, so volume of weeks dominates the ranking
  - (opus) dead duplicate of components/GoaliePage/goalieCalculations.ts
  - (codex:core-207) ["Inventory only, not validation of the formula, source semantics or model quality."]

## M-UST-018 Goalie weekly ranking tier (beats-average count)

- **Match:** Both; Opus UST-034; Codex core-206
- **Purpose:** Classify a goalie's week as Elite/Quality/Week/Bad/Really Bad by how many selected stats beat the weekly league average.
- **Where:** `web/lib/supabase/GoaliePage/calculateRanking.ts:11 (calculateRanking)`; `web/lib/supabase/GoaliePage/calculateRanking.ts:11 calculateRanking`
- **Tags (heuristic):** percent scale: 0-100; generation: legacy
- **Opus view (UST-034):**
  - Method: points = count of selected stats where goalie value > average (strict, same direction for every stat). Tier by points >= n*0.8 Elite, >= 0.65 Quality, >= 0.5 Week, >= 0.35 Bad, else Really Bad; percentage = points/n*100.
  - Inputs/units: weekly goalie stats vs weekly averages (same units as calculateAverages; per-goalie TOI likely seconds vs average minutes); sources: goalie_page_stats / league_averages_goalies (via upstream)
  - Output scale: tier enum (5 levels); percentage 0-100; writes: —
  - Status: legacy/dead — only caller calculateGoalieRanking.ts, which has no importers (rg 'supabase/GoaliePage')
  - Consumers: web/lib/supabase/GoaliePage/calculateGoalieRanking.ts
- **Codex view (core-206, calculation, location; Codex family 'goalie weekly'):** Weekly goalie category grade
  - Formula: One point per stat>average; Elite>=80%, Quality>=65%, Week>=50%, Bad>=35%, else Really Bad.
  - Purpose: Calculate weekly goalie category grade.
  - Inputs/units: Selected goalie stat values and cohort averages.
  - Output scale: Percent selected stats exceeding mean; 5-label grade.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f.  Deployment and persisted data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final status check.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED (inline comment calculateRanking.ts:20 'For percentages, higher is better' contradicts GAA semantics)
  - Intended contract (Codex core-206): This lists the existing comparison direction exactly; it is not a correctness finding.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `No directly named test located; tests not run.`
- **Leads (not audited):**
  - (opus) goalsAgainstAverage (and losses, otLosses, goalsAgainst) are scored higher-is-better - the 'percentages' branch is identical to the else branch, so lower-is-better stats are inverted
  - (opus) empty selectedStats gives 0 >= 0 -> 'Elite Week' and percentage NaN
  - (opus) ties with the average earn no point
  - (codex:core-206) ["Inventory only, not validation of the formula, source semantics or model quality."]

## M-UST-019 Ratio-of-sums aggregation across games (nullable-sum semantics)

- **Match:** Both; Opus UST-049; Codex underlying-player-aggregation
- **Purpose:** Sum per-game counts into window totals before computing rates/percentages.
- **Where:** `web/lib/underlying-stats/playerStatsLandingServer.ts:3467 (accumulateLandingMetrics)`; `web/lib/underlying-stats/playerStatsLandingServer.ts:3693 (mergeLandingAggregateMetrics)`; `web/lib/underlying-stats/playerStatsLandingServer.ts:2092 (addNullable)`; `web/lib/underlying-stats/playerStatsLandingServer.ts:4441 (buildPlayerStatsLandingAggregationFromSummaryRows)`; `web/lib/underlying-stats/playerStatsLandingServer.ts:5242 (buildPlayerStatsLandingAggregation)`; `web/lib/underlying-stats/playerStatsLandingServer.ts:3467 accumulateLandingMetrics; :3693 mergeLandingAggregateMetrics; :4893 mapLandingAggregationRowToApiRow`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: per 60; generation: current
- **Opus view (UST-049):**
  - Method: Integer counts summed; nullable metrics (ixg, iScf, iHdcf, xgf, xga, scf, hdcf, md*, xgAgainst...) summed with addNullable (null deltas skipped, total stays null only if every game is null). TOI summed only when every game has reliable TOI (else toiSeconds=null). Goalie avg shot/goal distance = sum(avg_distance*count)/sum(count) (count-weighted). Rates/percentages are then computed from the totals (ratio of sums).
  - Inputs/units: counts (integers), xG (goals), TOI seconds; sources: nhl_api_game_payloads_raw derived summary partitions
  - Output scale: window totals (ratio-of-sums inputs); writes: —
  - Status: live — read by pages/api/v1/underlying-stats/players.ts and goalies.ts (+[playerId], chart) for /underlying-stats/playerStats and /goalieStats; summaries written by pages/api/v1/db/update-player-underlying-stats.ts, which runs from the lineCombinations insert trigger (supabase/migrations/20260716112910_harden_line_combination_trigger_auth.sql:130) and the pg_cron job 'update-player-underlying-stats-yesterday' at 09:35 UTC (tasks/TASKS/cron-operations/cron-schedule.md:382,827)
  - Consumers: pages/api/v1/underlying-stats/players.ts; pages/api/v1/underlying-stats/players/[playerId].ts; pages/api/v1/underlying-stats/players/[playerId]/chart.ts; pages/api/v1/underlying-stats/goalies.ts; pages/api/v1/underlying-stats/goalies/[playerId].ts; pages/api/v1/db/update-player-underlying-stats.ts
- **Codex view (underlying-player-aggregation, calculation, location; Codex family 'Underlying statistics'):** Player season/window totals, per60, shares and faceoff percentage
  - Purpose: Aggregate summaries for player landing/detail/chart responses.
  - Inputs/units: Player game-summary counts, on-ice counts, TOI seconds, selected strength/score-state/date/game window
  - Output scale: Sums; totalPoints=goals+assists; IPP=points/onIceGoalsFor; SH%=goals/shots; faceoffPct=FOW/(FOW+FOL); on-ice for shares; per60 count×3600/TOI; TOI/game. API percentages are fractions, null unavailable/zero-denominator.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown. Player summary payload format version is 1 at playerStatsLandingServer.ts:221; not a model-version identifier.
- **Audit context:**
  - Intent (Opus): tasks/TASKS/three-pillars-analytics/underlying-stats/prd/prd-player-underlying-stats-landing-page.md:144 (minimum TOI applied after aggregation over the active scope)
  - Intended contract (Codex underlying-player-aggregation): web/lib/underlying-stats/playerStatsLandingServer.ts:2048 toPctDecimal, :2059 toPer60 and exported response types; unknown on-ice IPP denominator forces null.
  - External references: Ratio-of-sums convention (NST season totals)
  - Fixtures/test data: `web/lib/underlying-stats/playerStatsLandingServer.test.ts:1583-2207 summary-row fixtures`; `tasks/TASKS/three-pillars-analytics/underlying-stats/PlayerStatsLanding_Audit.md`; `tasks/TASKS/three-pillars-analytics/underlying-stats/PlayerStatsDetail_Audit.md`
  - Tests: `web/lib/underlying-stats/playerStatsLandingServer.test.ts:1583 (buildPlayerStatsLandingAggregationFromSummaryRows)`; `web/lib/underlying-stats/playerStatsLandingServer.test.ts:2009 (null rates when denominator zero)`; `{"discovered_not_run": ["web/lib/underlying-stats/playerStatsLandingServer.test.ts", "web/lib/underlying-stats/playerStatsSummaryRefresh.test.ts", "web/lib/underlying-stats/playerStatsQueries.test.ts"]}`
- **Leads (not audited):**
  - (opus) addNullable silently treats missing per-game xG/SCF as 0 when at least one game has a value, so window xG totals can undercount without any flag
  - (opus) a single PBP-only fallback game (hasReliableToi=false) nulls TOI and every per-60 for the whole window
  - (opus) goal-distance weighting uses goals_against (includes own goals) while the parity average excludes own goals
  - (codex:underlying-player-aggregation) No runtime verification or correctness assessment performed.

## M-UST-020 Power rankings STD/L10 aggregation

- **Match:** Both; Opus UST-058; Codex core-354, core-355
- **Purpose:** Aggregate WGO daily team rows into season-to-date and last-10 power-ranking stats.
- **Where:** `web/lib/supabase/Upserts/fetchPowerRankings.js:74 (calculateAggregatedStats)`; `web/lib/supabase/Upserts/fetchPowerRankings.js:574 (fetchTeamSummaries)`; `web/lib/supabase/Upserts/fetchPowerRankings.js:784 (average)`; `web/lib/supabase/Upserts/fetchPowerRankings.js:1050 (calculateAndUpsertPowerRankings)`; `web/lib/supabase/Upserts/fetchPowerRankings.js:1097 (l_ten_goals_for_pct)`; `web/lib/supabase/Upserts/fetchPowerRankings.js:74 calculateAggregatedStats`; `web/lib/supabase/Upserts/fetchPowerRankings.js:791 calculateRanks`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: per game; generation: legacy, current
- **Opus view (UST-058):**
  - Method: fetchTeamSummaries: STD = all season rows up to date, L10 = last 10 rows; counts summed, point_pct/shots/PP%/PK% mean-of-rows; goals_for_pct = GF/GA (0 if GA=0). calculateAndUpsertPowerRankings: L10 every column = mean of last 10 rows (incl. pim/hits counts) and l_ten_goals_for_pct = avgGF / (avgGA or 1).
  - Inputs/units: wgo_team_stats daily single-game rows (NHL REST pct as 0-1 fractions, shots per game, counts); sources: wgo_team_stats, games
  - Output scale: means of per-game pct (0-1) and sums/means of counts; goals_for_pct = GF/GA ratio; writes: power_rankings_store
  - Status: legacy/dead — pages/api/v1/db/update-power-rankings.ts returns 410 'Legacy power-rankings loader has been disabled'; pg_cron update-power-rankings active=false (cron-schedule.md:723); no in-repo reader of power_rankings_store
  - Consumers: pages/api/v1/db/update-power-rankings.ts (no in-repo reader of power_rankings_store found)
- **Codex view (core-354, calculation, location; Codex family 'legacy team aggregation'):** Stored team aggregate totals and rates
  - Formula: Sum PIM, hits, blocks, PP opportunities, GF and GA. Mean point percentage, shots/game, PP% and PK%. goals_for_pct = summed GF / summed GA, or zero when GA is zero.
  - Purpose: Provide stored team aggregate totals and rates for the identified consumer.
  - Inputs/units: wgo_team_stats rows, counts and existing rate fields.
  - Output scale: Summed counts; arithmetic mean rate fields; goals_for_pct ratio.
  - Version/status: Local working tree on octoberBranch, read on 2026-11-10. HEAD changed during the inventory from d31dcb33f72d4c9d69b507874c388f0cd549fe2f to 11e4192d36ecc4ac4b338f9ab48e529c7049c618. This is a non-atomic local scan; deployment and persisted-data state are not verified. Referenced implementation files had no tracked/untracked status entry at the final status check.
- **Codex view (core-355, calculation, location; Codex family 'legacy team aggregation'):** Stored power rank ordinals
  - Formula: Sort available rows descending by each metric and return first matching team position.
  - Purpose: Provide stored power rank ordinals for the identified consumer.
  - Inputs/units: Selected stored metric rows through cutoff date.
  - Output scale: One-based descending ordinal for each requested metric.
  - Version/status: Local working tree on octoberBranch, read on 2026-11-10. HEAD changed during the inventory from d31dcb33f72d4c9d69b507874c388f0cd549fe2f to 11e4192d36ecc4ac4b338f9ab48e529c7049c618. This is a non-atomic local scan; deployment and persisted-data state are not verified. Referenced implementation files had no tracked/untracked status entry at the final status check.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED (only inline code comments naming the steps)
  - Intended contract (Codex core-354): Function signature and comments at web/lib/supabase/Upserts/fetchPowerRankings.js:74 calculateAggregatedStats; independent product specification not verified.
  - Intended contract (Codex core-355): Function signature and comments at web/lib/supabase/Upserts/fetchPowerRankings.js:791 calculateRanks; independent product specification not verified.
  - External references: GF% = GF/(GF+GA); PP% = PPG/PPO ratio-of-sums
  - Fixtures/test data: none listed
  - Tests: `No dedicated test located in the bounded scan; no tests run.`; `web/lib/NHL/seasonAwareWriterTeams.test.js (team map only)`
- **Leads (not audited):**
  - (opus) 'goals_for_pct' is GF/GA ratio, not GF/(GF+GA); a 0 GA game gives 0 in one path and divides by 1 in the other
  - (opus) l_ten_pim/hits/blocks are sums in fetchTeamSummaries but per-game averages in calculateAndUpsertPowerRankings - same column, two meanings
  - (opus) fetchTeamSummaries upsert omits 'date' (commented out) but onConflict uses team_id,season_id,date
  - (opus) PP%/PK% averaged across games (mean of ratios)
  - (codex:core-354) ["Calculation inventory only; no correctness or model-quality verdict."]
  - (codex:core-355) ["Calculation inventory only; no correctness or model-quality verdict."]

## M-UST-021 Power rankings stat ranks

- **Match:** Both; Opus UST-059; Codex core-355
- **Purpose:** Rank teams on STD stats.
- **Where:** `web/lib/supabase/Upserts/fetchPowerRankings.js:791 (calculateRanks)`; `web/lib/supabase/Upserts/fetchPowerRankings.js:791 calculateRanks`
- **Tags (heuristic):** generation: legacy
- **Opus view (UST-059):**
  - Method: For each std key, fetch all rows for season with date <= date, drop nulls, sort descending, rank = 1-based position of first row for the team (no tie handling).
  - Inputs/units: std_* values in mixed units; sources: power_rankings_store
  - Output scale: rank 1..N where N = number of stored rows (can exceed 32); writes: power_rankings_store
  - Status: legacy/dead — 410 stub pages/api/v1/db/update-power-rankings.ts
  - Consumers: update-power-rankings route
- **Codex view (core-355, calculation, location; Codex family 'legacy team aggregation'):** Stored power rank ordinals
  - Formula: Sort available rows descending by each metric and return first matching team position.
  - Purpose: Provide stored power rank ordinals for the identified consumer.
  - Inputs/units: Selected stored metric rows through cutoff date.
  - Output scale: One-based descending ordinal for each requested metric.
  - Version/status: Local working tree on octoberBranch, read on 2026-11-10. HEAD changed during the inventory from d31dcb33f72d4c9d69b507874c388f0cd549fe2f to 11e4192d36ecc4ac4b338f9ab48e529c7049c618. This is a non-atomic local scan; deployment and persisted-data state are not verified. Referenced implementation files had no tracked/untracked status entry at the final status check.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex core-355): Function signature and comments at web/lib/supabase/Upserts/fetchPowerRankings.js:791 calculateRanks; independent product specification not verified.
  - External references: Dense/competition ranking across 32 teams on one date
  - Fixtures/test data: none listed
  - Tests: `No dedicated test located in the bounded scan; no tests run.`
- **Leads (not audited):**
  - (opus) ranks are computed over every historical row (all dates <= date), not one row per team, so ranks can exceed 32 and mix dates
  - (opus) all stats ranked descending, so high PIM ranks first
  - (opus) calculateAndUpsertPowerRankings reads ranks.l_ten_*_rank but calculateRanks only builds std_* keys, so all rank_l_ten_* are undefined/null
  - (codex:core-355) ["Calculation inventory only; no correctness or model-quality verdict."]

## M-UST-022 Strength of schedule (direct + indirect opponent point %)

- **Match:** Both; Opus UST-063; Codex core-351, underlying-team-sos
- **Purpose:** Past and future schedule strength per team for the ratings landing.
- **Where:** `web/lib/underlying-stats/teamScheduleStrength.ts:136 (computePointPctFromRecord)`; `web/lib/underlying-stats/teamScheduleStrength.ts:195 (computeScheduleBucket)`; `web/lib/underlying-stats/teamScheduleStrength.ts:174 (buildRankMap)`; `web/lib/underlying-stats/teamScheduleStrength.ts:241 (computeUnderlyingStatsTeamScheduleStrength)`; `web/lib/trends/strengthOfScheduleContract.ts:21 (recordPercentage)`; `web/lib/trends/strengthOfScheduleContract.ts:21 recordPercentage`; `web/lib/underlying-stats/teamScheduleStrength.ts:136 computePointPctFromRecord; :195 computeScheduleBucket; :241 computeUnderlyingStatsTeamScheduleStrength`
- **Tags (heuristic):** percent scale: fraction 0-1; generation: current
- **Opus view (UST-063):**
  - Method: Direct = opponents' combined point% = (2W + OTL)/(2*(W+L+OTL)). Indirect = games-weighted mean of each opponent's own direct value for the same bucket (opponents' opponents). Bucket SOS = (2*direct + indirect)/3 (falls back to whichever exists). Overall sos = mean(past, future). Rank 1 = highest SOS (hardest), ordinal, null-last.
  - Inputs/units: opponent W/L/OTL (integers); sources: sos_standings
  - Output scale: point% fraction 0-1; SOS fraction 0-1; rank 1..N (1 = hardest); writes: —
  - Status: live — pages/api/underlying-stats/landing.ts and team-ratings.ts feed pages/underlying-stats/index.tsx
  - Consumers: teamLandingRatings.ts; teamRatingNarrative.ts context bullet; pages/api/underlying-stats/team-ratings.ts; pages/underlying-stats/index.tsx
- **Codex view (core-351, calculation, location; Codex family 'strength of schedule'):** Descriptive record percentage
  - Formula: Win percentage = W/(W+L+OTL); points percentage = (2W+OTL)/(2*(W+L+OTL)).
  - Purpose: Provide descriptive record percentage for the identified consumer.
  - Inputs/units: Nonnegative integer wins, regulation losses and overtime losses; metric selector.
  - Output scale: Win fraction or standings points fraction; null for invalid or empty records.
  - Version/status: Local working tree on octoberBranch, read on 2026-11-10. HEAD changed during the inventory from d31dcb33f72d4c9d69b507874c388f0cd549fe2f to 11e4192d36ecc4ac4b338f9ab48e529c7049c618. This is a non-atomic local scan; deployment and persisted-data state are not verified. Referenced implementation files had no tracked/untracked status entry at the final status check.
- **Codex view (underlying-team-sos, calculation, location; Codex family 'Underlying schedule'):** Direct/indirect opponent strength and combined SoS
  - Purpose: Show team schedule difficulty using opponent records.
  - Inputs/units: Past/future opponent records and repeated opponent counts, fractional record percentages
  - Output scale: Indirect opponent pct is opponent-direct pct weighted by games; bucket SoS=(2×direct+indirect)/3 with available-side fallback; combined=(past+future)/2 when both present; ordinal ranks.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
- **Audit context:**
  - Intent (Opus): tasks/TASKS/three-pillars-analytics/underlying-stats/prd/prd-underlying-stats-landing-page-sos.md:30-36,64-80 (SoS must be 50% standings/record component + 50% predictive/context component)
  - Intended contract (Codex core-351): DESCRIPTIVE_SOS_VERSION and source types distinguish win-pct from point-pct; time-aware descriptive contract, not a forecast.
  - Intended contract (Codex underlying-team-sos): web/lib/underlying-stats/teamScheduleStrength.ts; recordPercentage shared from lib/trends/strengthOfScheduleContract.
  - External references: RPI-style SOS (2/3 OWP + 1/3 OOWP); NHL point %
  - Fixtures/test data: `web/lib/underlying-stats/teamScheduleStrength.test.ts inline sos_standings rows`; `tasks/TASKS/three-pillars-analytics/underlying-stats/UnderlyingStats_Audit.md`
  - Tests: `No dedicated test located in the bounded scan; no tests run.`; `web/lib/underlying-stats/teamScheduleStrength.test.ts`; `{"discovered_not_run": ["web/lib/underlying-stats/teamScheduleStrength.test.ts"]}`
- **Leads (not audited):**
  - (opus) for the future bucket, 'indirect' uses each opponent's FUTURE opponents' record, not their record to date
  - (opus) opponents' records include games against the team itself (no head-to-head exclusion as in RPI)
  - (opus) overall SOS averages past and future equally regardless of games remaining
  - (opus) PRD (tasks/TASKS/three-pillars-analytics/underlying-stats/prd/prd-underlying-stats-landing-page-sos.md:64-80) requires SoS = 50% record-based + 50% predictive/context component; code is record-only ((2*direct + indirect)/3) with past/future averaged — no predictive half
  - (codex:core-351) ["Calculation inventory only; no correctness or model-quality verdict."]
  - (codex:underlying-team-sos) No runtime verification or correctness assessment performed.

## M-UST-023 Schedule texture (next 7/14 days)

- **Match:** Both; Opus UST-064; Codex underlying-schedule-texture
- **Purpose:** Upcoming density, home/road, back-to-backs, 3-in-4 and rest edges.
- **Where:** `web/lib/underlying-stats/teamScheduleStrength.ts:91 (diffDays)`; `web/lib/underlying-stats/teamScheduleStrength.ts:382 (buildPreviousGameMap)`; `web/lib/underlying-stats/teamScheduleStrength.ts:396 (computeUnderlyingStatsScheduleTexture)`; `web/lib/underlying-stats/teamScheduleStrength.ts:498 (fetchUnderlyingStatsTeamScheduleStrengthForRatings)`; `web/lib/underlying-stats/teamScheduleStrength.ts:396 computeUnderlyingStatsScheduleTexture`
- **Tags (heuristic):** generation: current
- **Opus view (UST-064):**
  - Method: Upcoming = games strictly after date; gamesNext7/14 within +7/+14 days; home/road counts; B2B = consecutive upcoming games 1 day apart; 3-in-4 = game i and i+2 within 3 days (counted per starting game, overlapping); rest days = days since previous game - 1 for team and opponent; advantage if team rest > opponent rest.
  - Inputs/units: ISO dates; day differences (integers); sources: games
  - Output scale: integer game counts; writes: —
  - Status: live — pages/api/underlying-stats/landing.ts and team-ratings.ts feed pages/underlying-stats/index.tsx (rendered as schedule chips, pages/underlying-stats/index.tsx:781)
  - Consumers: teamLandingRatings.ts; teamRatingNarrative.ts (b2b bullet)
- **Codex view (underlying-schedule-texture, calculation, location; Codex family 'Underlying schedule'):** Games/home/road/B2B/three-in-four/rest advantages
  - Purpose: Describe upcoming schedule congestion.
  - Inputs/units: Team/opponent dated games and home/away flag; day differences
  - Output scale: gamesNext7/14; home/roadNext14; adjacent one-day pairs; triples spanning ≤3 days; restDays=date-prevGame-1; count team rest advantage/disadvantage.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
- **Audit context:**
  - Intent (Opus): tasks/TASKS/three-pillars-analytics/underlying-stats/prd/prd-underlying-stats-landing-page-sos.md:17 (rest disadvantage as optional context)
  - Intended contract (Codex underlying-schedule-texture): web/lib/underlying-stats/teamScheduleStrength.ts:396 loop defines rolling date boundaries and count semantics.
  - External references: Common rest/B2B conventions
  - Fixtures/test data: none listed
  - Tests: `web/lib/underlying-stats/teamScheduleStrength.test.ts`; `{"discovered_not_run": ["web/lib/underlying-stats/teamScheduleStrength.test.ts"]}`
- **Leads (not audited):**
  - (opus) 3-in-4 windows overlap (4 games in 5 nights counts 2)
  - (opus) regular-season only (type=2); rest for the first upcoming game is unknown if the previous game is >14 days back (lookback window) and is skipped
  - (codex:underlying-schedule-texture) No runtime verification or correctness assessment performed.

## M-UST-024 Skater weekly aggregates, ownership/ADP buckets

- **Match:** Both; Opus UST-068; Codex core-324, core-325
- **Purpose:** Group skater games into fantasy weeks and value tiers
- **Where:** `web/components/SkaterPage/skaterCalculations.ts:315 (buildSkaterWeeklyAggregates)`; `web/components/SkaterPage/skaterCalculations.ts:178 (calculateWeeklyOwnershipAverage)`; `web/components/SkaterPage/skaterCalculations.ts:207 (getWeeklyOwnershipValue)`; `web/components/SkaterPage/skaterCalculations.ts:222 (getOwnershipBucket)`; `web/components/SkaterPage/skaterCalculations.ts:279 (getAdpBucket)`; `web/components/SkaterPage/skaterFilters.ts:13 (DEFAULT_MINIMUM_PERCENT_DRAFTED)`; `web/components/SkaterPage/skaterCalculations.ts:178 calculateWeeklyOwnershipAverage`; `web/components/SkaterPage/skaterCalculations.ts:315 buildSkaterWeeklyAggregates`
- **Tags (heuristic):** generation: current
- **Opus view (UST-068):**
  - Method: Week = Yahoo matchup week else Monday-Sunday UTC. Weekly FP = sum; FP/G = FP/sum(games_played or 1). Ownership = mean of in-week timeline values, else closest prior, else current percent_ownership. Ownership bucket = floor(own/10)*10 deciles (90-100 top). ADP bucket round = ceil(ADP/12); percent drafted < 0.5 -> 'LOW %D'; no ADP -> WW.
  - Inputs/units: ownership 0-100; ADP pick number; percent_drafted 0-1; sources: wgo_skater_stats, yahoo_players_with_normalized_history, yahoo_nhl_player_map_read, yahoo_matchup_weeks
  - Output scale: weekly FP totals, FP/G; decile buckets; ADP round (12-team); writes: —
  - Status: live — pages/variance/skaters.tsx
  - Consumers: buildSkaterValueOverviewRows; skaterMetrics
- **Codex view (core-324, calculation, location; Codex family 'skater value UI'):** Weekly ownership average and valuation bucket
  - Formula: Mean ownership in week; fallback closest prior then current; ADP round=ceil(ADP/12); low-drafted and waiver exceptions.
  - Purpose: Calculate weekly ownership average and valuation bucket.
  - Inputs/units: Dated ownership percentages, week dates; ADP and percent drafted.
  - Output scale: Ownership percent; 10-point ownership bucket or draft-round bucket.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f.  Deployment not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final status check.
- **Codex view (core-325, calculation, location; Codex family 'skater value UI'):** Skater weekly production
  - Formula: Group by player/week; sum counts; fantasyPoints/gamesPlayed.
  - Purpose: Calculate skater weekly production.
  - Inputs/units: Game fantasy points, games played, dates.
  - Output scale: Weekly total points, games and points/game.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f.  Deployment not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final status check.
- **Audit context:**
  - Intent (Opus): tasks/TASKS/variance/v1/prd-skater-variance-leaderboard.md:19 (peer buckets)
  - Intended contract (Codex core-324): Source types and implementation in web/components/SkaterPage/skaterCalculations.ts:178; separate acceptance not verified.
  - Intended contract (Codex core-325): Source types and implementation in web/components/SkaterPage/skaterCalculations.ts:315; separate acceptance not verified.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `Located only; not run for this inventory.`; `web/components/SkaterPage/skaterCalculations.test.ts`
- **Leads (not audited):**
  - (opus) ADP round assumes 12-team league
  - (opus) percent_drafted threshold 0.5 assumes 0-1 units while ownership is 0-100
  - (codex:core-324) ["Inventory only; no correctness verdict."]
  - (codex:core-325) ["Inventory only; no correctness verdict."]

## M-UST-025 Skater week rating z-score (Elite..Really Bad) and value overview

- **Match:** Both; Opus UST-069; Codex core-326, core-327, core-328
- **Purpose:** Classify each player-week against same-bucket peers and summarise consistency
- **Where:** `web/components/SkaterPage/skaterCalculations.ts:390 (buildSkaterBucketWeeklyAverages)`; `web/components/SkaterPage/skaterCalculations.ts:426 (classifySkaterWeek)`; `web/components/SkaterPage/skaterCalculations.ts:480 (buildSkaterValueOverviewRowsFromAggregates)`; `web/components/SkaterPage/skaterCalculations.ts:76 (calculateStandardDeviation)`; `web/components/SkaterPage/skaterCalculations.ts:390 buildSkaterBucketWeeklyAverages`; `web/components/SkaterPage/skaterCalculations.ts:426 classifySkaterWeek`; `web/components/SkaterPage/skaterCalculations.ts:480 buildSkaterValueOverviewRowsFromAggregates`
- **Tags (heuristic):** percent scale: 0-100; generation: current
- **Opus view (UST-069):**
  - Method: Bucket-week mean FP, mean FP/G, sample SD (n-1). z = (FP - mean)/SD; >=1.5 Elite, >=0.5 Quality, >-0.5 Average, >-1.5 Bad, else Really Bad; buckets with <3 players or SD 0 -> Average. percentOkWeeks = (Elite+Quality+Average)/weeks*100; percentGoodWeeks = (Elite+Quality)/weeks*100; weeklyVariance = SD of weekly FP; gameToGameVariance = SD of game FP; FP above average = mean(player - bucket avg) by week or game basis.
  - Inputs/units: weekly fantasy points; sources: wgo_skater_stats, Yahoo tables above
  - Output scale: z-score bands; percents 0-100; SDs in fantasy points; writes: —
  - Status: live — pages/variance/skaters.tsx
  - Consumers: SkaterLeaderboard; SkaterTable; pages/variance/skaters.tsx
- **Codex view (core-326, calculation, location; Codex family 'skater value UI'):** Skater bucket weekly moments
  - Formula: Arithmetic cohort means; variance divisor n-1.
  - Purpose: Calculate skater bucket weekly moments.
  - Inputs/units: Player weekly totals within ownership/ADP bucket.
  - Output scale: Mean points/week, mean individual points/game, sample SD.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f.  Deployment not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final status check.
- **Codex view (core-327, calculation, location; Codex family 'skater value UI'):** Skater week quality grade
  - Formula: z=(points-mean)/SD; boundaries 1.5, .5, -.5, -1.5; under 3 players or SD 0 returns Average.
  - Purpose: Calculate skater week quality grade.
  - Inputs/units: Weekly points and bucket mean/sample SD.
  - Output scale: Elite/Quality/Average/Bad/Really Bad.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f.  Deployment not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final status check.
- **Codex view (core-328, calculation, location; Codex family 'skater value UI'):** Skater season value and consistency summaries
  - Formula: Fractions of qualifying grades*100; sample SD of weekly/game points; mean signed player-minus-bucket comparison.
  - Purpose: Calculate skater season value and consistency summaries.
  - Inputs/units: Game/weekly fantasy points, grades and matched bucket averages.
  - Output scale: Good/acceptable week percentages, weekly and game SD, total/rate points, points above average.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f.  Deployment not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final status check.
- **Audit context:**
  - Intent (Opus): tasks/TASKS/variance/v1/prd-skater-variance-leaderboard.md:19,113-117 (Elite >= avg+1.5 SD, Quality >= +0.5 SD, Bad <= -0.5 SD, Really Bad <= -1.5 SD); web/components/SkaterPage/skaterCalculations.ts:73 'Matches goalie variance and uses sample standard deviation'
  - Intended contract (Codex core-326): Source types and implementation in web/components/SkaterPage/skaterCalculations.ts:390; separate acceptance not verified.
  - Intended contract (Codex core-327): Source types and implementation in web/components/SkaterPage/skaterCalculations.ts:426; separate acceptance not verified.
  - Intended contract (Codex core-328): Source types and implementation in web/components/SkaterPage/skaterCalculations.ts:480; separate acceptance not verified.
  - External references: z-score banding
  - Fixtures/test data: none listed
  - Tests: `Located only; not run for this inventory.`; `web/components/SkaterPage/skaterCalculations.test.ts`
- **Leads (not audited):**
  - (opus) fields named 'Variance' hold standard deviations
  - (opus) bucket mean/SD include the player being classified
  - (opus) weeks the player did not play are absent rather than zero, so % good weeks ignores missed weeks
  - (codex:core-326) ["Inventory only; no correctness verdict."]
  - (codex:core-327) ["Inventory only; no correctness verdict."]
  - (codex:core-328) ["Inventory only; no correctness verdict."]

## M-UST-026 Skater variance fantasy points per game

- **Match:** Both; Opus UST-070; Codex core-323
- **Purpose:** Custom-scoring fantasy points per game row
- **Where:** `web/components/SkaterPage/skaterCalculations.ts:89 (calculateSkaterFantasyStatValue)`; `web/components/SkaterPage/skaterCalculations.ts:110 (calculateSkaterGameFantasyPoints)`; `web/components/SkaterPage/skaterMetrics.ts:17 (defaultPointValue)`; `web/components/SkaterPage/skaterCalculations.ts:110 calculateSkaterGameFantasyPoints`
- **Tags (heuristic):** denominators: per 60, per game, shots on goal; generation: current
- **Opus view (UST-070):**
  - Method: FP = sum over selected categories of stat * weight; TIME_ON_ICE stat = toi_per_game/60 (seconds->minutes). Defaults G 3, A 2, PPP 1, SOG 0.2, HIT 0.2, BLK 0.25, others 0.
  - Inputs/units: WGO per-game counts; toi_per_game seconds (converted /60 to minutes for TOI scoring); sources: wgo_skater_stats
  - Output scale: fantasy points per game; writes: —
  - Status: live — pages/variance/skaters.tsx -> SkaterList -> SkaterLeaderboard
  - Consumers: pages/variance/skaters.tsx; SkaterLeaderboard
- **Codex view (core-323, calculation, location; Codex family 'skater value UI'):** Skater game fantasy points
  - Formula: Weighted sum selected stats; TIME_ON_ICE converts seconds to minutes.
  - Purpose: Calculate skater game fantasy points.
  - Inputs/units: Selected scoring categories and weights, game counts, TOI seconds.
  - Output scale: Fantasy points per game.
  - Version/status: Local octoberBranch d31dcb33f72d4c9d69b507874c388f0cd549fe2f.  Deployment not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final status check.
- **Audit context:**
  - Intent (Opus): tasks/TASKS/variance/v1/prd-skater-variance-leaderboard.md; defaults web/lib/projectionsConfig/fantasyPointsConfig.ts:3-17
  - Intended contract (Codex core-323): Source types and implementation in web/components/SkaterPage/skaterCalculations.ts:110; separate acceptance not verified.
  - External references: Yahoo/ESPN points-league scoring
  - Fixtures/test data: none listed
  - Tests: `Located only; not run for this inventory.`; `web/components/SkaterPage/skaterCalculations.test.ts`
- **Leads (not audited):**
  - (opus) selecting POINTS together with GOALS/ASSISTS (or PPP with PPG/PPA) double counts; nothing prevents it
  - (codex:core-323) ["Inventory only; no correctness verdict."]

## M-UST-027 Power rankings strength of schedule and opponent records

- **Match:** Both; Opus UST-073; Codex core-356
- **Purpose:** Past/future SoS from opponents' L10 points %, season record string and opponent aggregate W-L-T.
- **Where:** `web/lib/supabase/Upserts/fetchPowerRankings.js:849 (calculateSoSForTeam)`; `web/lib/supabase/Upserts/fetchPowerRankings.js:945 (fetchSeasonAveragesAndRecord)`; `web/lib/supabase/Upserts/fetchPowerRankings.js:973 (season_avg_record)`; `web/lib/supabase/Upserts/fetchPowerRankings.js:984 (fetchOpponentAggregateRecord)`; `web/lib/supabase/Upserts/fetchPowerRankings.js:849 calculateSoSForTeam`
- **Tags (heuristic):** percent scale: fraction 0-1; generation: legacy
- **Opus view (UST-073):**
  - Method: Split schedule at current date into past/future opponent id lists; SoS = mean of l_ten_pts_pct over all store rows for those opponents (past: date <= current; future: date >= current), toFixed(3) string. Season record = sums of wins/losses/OTL over all standings rows for the season. Opponent aggregate = count of WIN/LOSS/other outcomes in gameOutcomes for opponent team ids, split by now().
  - Inputs/units: l_ten_pts_pct (0-1 fraction); standings cumulative counts; sources: games, power_rankings_store, standings, gameOutcomes
  - Output scale: SoS string toFixed(3) in 0-1; W-L-T strings; writes: power_rankings_store
  - Status: legacy/dead — 410 stub pages/api/v1/db/update-power-rankings.ts
  - Consumers: update-power-rankings route
- **Codex view (core-356, calculation, location; Codex family 'legacy team aggregation'):** Stored last-ten opponent SOS
  - Formula: Arithmetic mean of returned opponent l_ten_pts_pct rows, with missing values zero-filled; no rows gives zero.
  - Purpose: Provide stored last-ten opponent SOS for the identified consumer.
  - Inputs/units: Past/future opponent sets and stored l_ten_pts_pct rows filtered by date.
  - Output scale: Past and future SOS strings to three decimals.
  - Version/status: Local working tree on octoberBranch, read on 2026-11-10. HEAD changed during the inventory from d31dcb33f72d4c9d69b507874c388f0cd549fe2f to 11e4192d36ecc4ac4b338f9ab48e529c7049c618. This is a non-atomic local scan; deployment and persisted-data state are not verified. Referenced implementation files had no tracked/untracked status entry at the final status check.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex core-356): Function signature and comments at web/lib/supabase/Upserts/fetchPowerRankings.js:849 calculateSoSForTeam; independent product specification not verified.
  - External references: Opponent points % SoS weighted by games played against each opponent
  - Fixtures/test data: none listed
  - Tests: `No dedicated test located in the bounded scan; no tests run.`
- **Leads (not audited):**
  - (opus) standings are daily cumulative snapshots, so summing wins over all rows massively inflates season_avg_record
  - (opus) .in(team_id, opponents) dedupes opponents and averages over all their historical rows, so SoS is not weighted by games faced; future SoS reads rows dated >= today which usually do not exist -> 0
  - (opus) opponent aggregate uses new Date() instead of the row date and gameOutcomes with no season filter; OTL counted as 'ties'
  - (opus) standings delta stores goal_differential hard-coded 0 and reads 'regulatioinPlusOtWinPctg' (typo, likely always 0) at fetchPowerRankings.js:205/246
  - (codex:core-356) ["Calculation inventory only; no correctness or model-quality verdict."]

## M-UST-028 Archetype tags and quadrant summary

- **Match:** Both; Opus UST-078; Codex underlying-trust-tags
- **Purpose:** Label teams with up to 3 style tags.
- **Where:** `web/lib/underlying-stats/teamLandingDashboard.ts:101 (buildArchetypes)`; `web/lib/underlying-stats/teamLandingDashboard.ts:154 (buildQuadrantSummary)`; `web/lib/underlying-stats/teamLandingDashboard.ts:101 buildArchetypes; :186 resolveTrustType; :245 buildUnderlyingStatsLandingDashboard`
- **Tags (heuristic):** generation: current
- **Opus view (UST-078):**
  - Method: High-event pace>=106; Defense-first def>=104 and def>=off+4; Attack-driven off>=104 and off>=def+4; Chance-driving danger>=106; Finishing-driven >=105; Goalie-carried >=105; Disciplined >=105 / Undisciplined <=95; Special-teams boosted PP or PK tier 1; luck hot/cold; Contender-grade power>=110; first 3 kept. Summary: off>=104, def>=104, trend >= +1.5 / <= -1.5.
  - Inputs/units: ratings ~100 scale; tiers 1-3; trend points; sources: —
  - Output scale: up to 3 tag strings; summary text; writes: —
  - Status: live — pages/api/underlying-stats/landing.ts and team-ratings.ts feed pages/underlying-stats/index.tsx
  - Consumers: quadrant points; risers/fallers
- **Codex view (underlying-trust-tags, calculation, location; Codex family 'Underlying team dashboard'):** Archetypes, buyLow/heatCheck/processBacked, risers/fallers
  - Purpose: Produce context labels and top movers from ratings.
  - Inputs/units: Ratings near 100 baseline, power, trend10, processGap, PDO z, special teams tiers
  - Output scale: Tags based on thresholds (pace106, offense/defense104+4 edge, danger106, finishing/goalie/discipline105, discipline≤95, power110); trust uses power≥103, ±.12 process gap and contextDrag≥6/contextInflation≥7, or power≥102 and bounded gaps; top4 positive/negative trends.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex underlying-trust-tags): Explicit implementation thresholds; no accuracy or predictive meaning inferred.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/underlying-stats/teamLandingDashboard.test.ts`; `{"discovered_not_run": ["web/lib/underlying-stats/teamLandingDashboard.test.ts"]}`
- **Leads (not audited):**
  - (opus) first-3 truncation means tag set depends on rule order, not salience
  - (codex:underlying-trust-tags) No runtime verification or correctness assessment performed.

## M-UST-029 Risers and fallers by trend

- **Match:** Both; Opus UST-080; Codex core-349, core-350
- **Purpose:** Top 4 positive and negative trend teams.
- **Where:** `web/lib/underlying-stats/teamLandingDashboard.ts:316 (risers)`; `web/lib/underlying-stats/teamLandingDashboard.ts:332 (fallers)`; `web/lib/dashboard/teamContext.ts:34 (computeTeamPowerScore, upstream)`; `web/lib/dashboard/teamContext.ts:34 computeTeamPowerScore`; `web/lib/dashboard/teamContext.ts:52 buildSlateMatchupEdgeMap`; `web/lib/dashboard/teamContext.ts:72 getGamePowerEdge`; `web/lib/dashboard/teamContext.ts:42 computeCtpiDelta`
- **Tags (heuristic):** generation: current
- **Opus view (UST-080):**
  - Method: Risers: trend10 > 0 sorted desc, top 4; fallers: trend10 < 0 sorted asc, top 4; power = mean(off,def,pace) + (3-ppTier)*1.5 + (3-pkTier)*1.5.
  - Inputs/units: trend10 (rating points); sources: —
  - Output scale: top-4 lists; power on ~100 scale (+1.5 per tier step); writes: —
  - Status: live — pages/api/underlying-stats/landing.ts and team-ratings.ts feed pages/underlying-stats/index.tsx
  - Consumers: UnderlyingStatsDashboard
- **Codex view (core-349, calculation, location; Codex family 'team power'):** Dashboard team power and matchup edge
  - Formula: Mean of offense, defense and pace, null rating treated as zero, plus 1.5*(3-PP tier) + 1.5*(3-PK tier). Invalid tier defaults to 2. Edge is the difference of these scores.
  - Purpose: Provide dashboard team power and matchup edge for the identified consumer.
  - Inputs/units: Offense, defense and pace ratings; PP/PK tiers 1–3.
  - Output scale: Rating points and home-minus-away or team-minus-opponent edge.
  - Version/status: Local working tree on octoberBranch, read on 2026-11-10. HEAD changed during the inventory from d31dcb33f72d4c9d69b507874c388f0cd549fe2f to 11e4192d36ecc4ac4b338f9ab48e529c7049c618. This is a non-atomic local scan; deployment and persisted-data state are not verified. Referenced implementation files had no tracked/untracked status entry at the final status check.
- **Codex view (core-350, calculation, location; Codex family 'team power'):** Dashboard CTPI sparkline change
  - Formula: Last sparkline value minus first value.
  - Purpose: Provide dashboard CTPI sparkline change for the identified consumer.
  - Inputs/units: First and last sparkline values; current CTPI fallback.
  - Output scale: Signed rating-point change or null with fewer than two points.
  - Version/status: Local working tree on octoberBranch, read on 2026-11-10. HEAD changed during the inventory from d31dcb33f72d4c9d69b507874c388f0cd549fe2f to 11e4192d36ecc4ac4b338f9ab48e529c7049c618. This is a non-atomic local scan; deployment and persisted-data state are not verified. Referenced implementation files had no tracked/untracked status entry at the final status check.
- **Audit context:**
  - Intent (Opus): tasks/tasks-underlying-stats-lineupexperts-alignment.md (Team Movers in Chart tab)
  - Intended contract (Codex core-349): Function signature and comments at web/lib/dashboard/teamContext.ts:34 computeTeamPowerScore; independent product specification not verified.
  - Intended contract (Codex core-350): Function signature and comments at web/lib/dashboard/teamContext.ts:42 computeCtpiDelta; independent product specification not verified.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `Located only; not run for this inventory.`; `web/lib/dashboard/teamContext.test.ts`; `web/lib/underlying-stats/teamLandingDashboard.test.ts`
- **Leads (not audited):**
  - (opus) power score adds +1.5 per special-teams tier even for average (tier 2) teams, so league-average power is ~103 not 100
  - (codex:core-349) ["Calculation inventory only; no correctness or model-quality verdict."]
  - (codex:core-350) ["Calculation inventory only; no correctness or model-quality verdict."]

## M-UST-030 Process quadrant (offense/defense process z-scores)

- **Match:** Both; Opus UST-081; Codex underlying-process-quadrant
- **Purpose:** Place teams on an offense vs defense process map.
- **Where:** `web/lib/underlying-stats/teamLandingDashboard.ts:73 (standardDeviation)`; `web/lib/underlying-stats/teamLandingDashboard.ts:86 (zScore)`; `web/lib/underlying-stats/teamLandingDashboard.ts:245 (buildUnderlyingStatsLandingDashboard)`; `web/components/underlying-stats/UnderlyingStatsQuadrantMap.tsx:153 (domain)`; `web/lib/underlying-stats/teamLandingDashboard.ts:68 average; :73 standardDeviation; :245 buildUnderlyingStatsLandingDashboard`
- **Tags (heuristic):** denominators: per 60; generation: current
- **Opus view (UST-081):**
  - Method: League mean and population SD across teams; offenseProcess = 0.7*z(xGF/60) + 0.3*z(SF/60); defenseProcess = -0.7*z(xGA/60) - 0.3*z(SA/60). Quadrant average lines are clamped to [-0.01, 0.01]. Map axis domain = max(\|value\|, 1.8) + 0.35.
  - Inputs/units: xGF/60, SF/60, xGA/60, SA/60 (per-60 rates); sources: team_power_ratings_daily (via ratings)
  - Output scale: weighted z-score composite (unitless, ~-2..+2); writes: —
  - Status: live — pages/api/underlying-stats/landing.ts and team-ratings.ts feed pages/underlying-stats/index.tsx (Chart tab: components/underlying-stats/UnderlyingStatsQuadrantMap.tsx)
  - Consumers: components/underlying-stats/UnderlyingStatsQuadrantMap.tsx; UnderlyingStatsDashboard
- **Codex view (underlying-process-quadrant, calculation, location; Codex family 'Underlying team dashboard'):** offenseProcess, defenseProcess and processGap
  - Purpose: Place teams on process-based offense/defense quadrant.
  - Inputs/units: Team xGF60,SF60,xGA60,SA60,GF60,GA60 sample
  - Output scale: Population z-scores; offense=.7z(xGF60)+.3z(SF60); defense=-.7z(xGA60)-.3z(SA60); processGap=xGF60-xGA60-(GF60-GA60); zero z if zero SD.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
- **Audit context:**
  - Intent (Opus): tasks/tasks-underlying-stats-lineupexperts-alignment.md (Process Quadrant kept in Chart tab, task 3.3); formula UNDOCUMENTED
  - Intended contract (Codex underlying-process-quadrant): Implementation weighting and population SD at cited source.
  - External references: z-score convention (population vs sample SD)
  - Fixtures/test data: none listed
  - Tests: `web/__tests__/pages/underlying-stats/index.test.tsx`; `web/lib/underlying-stats/teamLandingDashboard.test.ts`; `{"discovered_not_run": ["web/lib/underlying-stats/teamLandingDashboard.test.ts"]}`
- **Leads (not audited):**
  - (opus) population SD (divide by n); weights 0.7/0.3 are magic
  - (opus) average lines clamped to +/-0.01 so they always sit at the origin
  - (codex:underlying-process-quadrant) No runtime verification or correctness assessment performed.

## M-UST-031 PDO luck status and landing ratings merge

- **Match:** Both; Opus UST-082; Codex underlying-luck-status
- **Purpose:** Classify team luck as hot/cold and merge SOS, special teams, trend into ratings.
- **Where:** `web/lib/underlying-stats/teamLandingRatings.ts:262 (mergeUnderlyingStatsLandingRatings)`; `web/lib/underlying-stats/teamLandingRatings.ts:216 (fetchUnderlyingStatsLandingRatings)`; `web/lib/underlying-stats/teamLandingRatings.ts:321 (resolveUnderlyingStatsLandingSnapshot)`; `web/lib/underlying-stats/teamLandingRatings.ts:262 mergeUnderlyingStatsLandingRatings`
- **Tags (heuristic):** generation: current
- **Opus view (UST-082):**
  - Method: luckStatus = 'hot' if PDO z >= 1, 'cold' if <= -1, else 'normal'. trend10 overridden by stored form-context trendDelta. Snapshot falls back through available dates until ratings exist.
  - Inputs/units: PDO z-score (unitless); sources: team_power_ratings_daily (via teamRatingsService/teamRatingsTrend), wgo_team_stats, sos_standings, games
  - Output scale: enum hot/cold/normal; writes: —
  - Status: live — pages/api/underlying-stats/landing.ts and team-ratings.ts feed pages/underlying-stats/index.tsx
  - Consumers: pages/api/underlying-stats/landing.ts; pages/api/underlying-stats/team-ratings.ts; pages/underlying-stats/index.tsx; components/underlying-stats/UnderlyingStatsDashboard.tsx
- **Codex view (underlying-luck-status, calculation, location; Codex family 'Underlying team context'):** luckStatus and trend override display
  - Purpose: Classify team PDO z-score and combine contextual modules.
  - Inputs/units: currentPdoZ and derived form/trend series from teamRatingsTrend; existing team ratings
  - Output scale: hot if PDO z≥1, cold if ≤-1, else normal; trend10 replaced with history override when available.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED in slice (PDO z computed in web/lib/teamRatingsTrend.ts)
  - Intended contract (Codex underlying-luck-status): Implementation thresholds; teamRatingsTrend source owns upstream trend/variance math.
  - External references: PDO regression-to-1000 convention
  - Fixtures/test data: `tasks/TASKS/three-pillars-analytics/underlying-stats/UnderlyingStats_Audit.md`
  - Tests: `web/lib/underlying-stats/teamLandingRatings.test.ts`; `{"discovered_not_run": ["web/lib/underlying-stats/teamLandingRatings.test.ts"]}`
- **Leads (not audited):**
  - (opus) PDO and its z-score are computed upstream in lib/teamRatingsTrend.ts (outside this slice); +/-1 SD threshold is a magic constant
  - (codex:underlying-luck-status) No runtime verification or correctness assessment performed.

## M-UST-032 Team rating narrative drivers vs 10-snapshot baseline

- **Match:** Both; Opus UST-084; Codex underlying-narrative-special-teams-bonus
- **Purpose:** Explain why a team's rating moved.
- **Where:** `web/lib/underlying-stats/teamRatingNarrative.ts:58 (computeSpecialTeamsBonus)`; `web/lib/underlying-stats/teamRatingNarrative.ts:85 (buildBaseline)`; `web/lib/underlying-stats/teamRatingNarrative.ts:284 (buildDrivers)`; `web/lib/underlying-stats/teamRatingNarrative.ts:348 (buildTeamRatingNarrative)`; `web/lib/underlying-stats/teamLandingRatings.ts:104 (fetchTeamRatingHistoryForNarratives)`; `web/lib/underlying-stats/teamRatingNarrative.ts:58 computeSpecialTeamsBonus; :85 buildBaseline; :284 buildDrivers; :348 buildTeamRatingNarrative. Dependency: web/lib/dashboard/teamContext.ts:28 SPECIAL_TEAM_STEP, :30 normalizeSpecialTeamTier, :34 computeTeamPowerScore.`
- **Tags (heuristic):** denominators: per 60; generation: current
- **Opus view (UST-084):**
  - Method: History = up to 11 most recent daily snapshots within 120 days; baseline = simple mean of snapshots 2..11 (excludes newest). Drivers: deltas of off, def, pace ratings and special-teams bonus (= computeTeamPowerScore with trend 0 - mean(off,def,pace); power adds (3-tier)*1.5 for PP and PK). Keep top 2 by \|delta\| if \|delta\| >= 0.35 (or if even the largest is < 0.35). Bullet direction by sign of xGF60/SF60/GF60 (or xGA60/SA60/GA60, pace60) vs baseline.
  - Inputs/units: ratings on ~100 scale; components per 60; sources: team_power_ratings_daily
  - Output scale: bullet text; deltas in rating points; writes: —
  - Status: live — pages/api/underlying-stats/landing.ts and team-ratings.ts feed pages/underlying-stats/index.tsx
  - Consumers: teamLandingDashboard risers/fallers; UnderlyingStatsDashboard
- **Codex view (underlying-narrative-special-teams-bonus, calculation, location; Codex family 'Underlying team narrative'):** Special-teams power-score contribution and recent-baseline delta
  - Purpose: Extract the special-teams contribution to the team power score and compare it with recent history to choose explanatory narrative drivers.
  - Inputs/units: offRating, defRating and paceRating in team rating points; ppTier/pkTier ordinal 1/2/3 or null. Recent history snapshots in caller-provided order; baseline uses history.slice(1,11), up to ten snapshots excluding the first.
  - Output scale: Bonus = Number((computeTeamPowerScore({...ratings, ppTier, pkTier, trend10:0}) - (offRating+defRating+paceRating)/3).toFixed(2)). With the observed dependency this isolates 1.5*(3-normalizedPpTier)+1.5*(3-normalizedPkTier): each component 0,1.5 or3 points; combined0..6 points. Invalid/null tiers normalize to2. Baseline is arithmetic mean of snapshot bonuses. Special-teams driver delta is current bonus minus baseline bonus rounded to2 decimals. No historical baseline returns null from buildBaseline.
  - Version/status: Bounded residual inspected 2026-11-10 on octoberBranch at observed HEAD11e4192d36ecc4ac4b338f9ab48e529c7049c618. teamRatingNarrative.ts SHA-256 e9b0f1f19fc8acfb68d839bf65034b67454afbee922fd1af8f449829d2042ea6. Earlier inventory observed a different HEAD; checkout may be live-mutating and is not a frozen release snapshot. Runtime/deployment status unknown.
- **Audit context:**
  - Intent (Opus): tasks/TASKS/three-pillars-analytics/underlying-stats/tasks-underlying-stats-power-rankings-roadmap.md (power rankings roadmap); thresholds UNDOCUMENTED
  - Intended contract (Codex underlying-narrative-special-teams-bonus): No separate prose formula specification was found in this bounded read. The named helper and implementation at teamRatingNarrative.ts:58-83 define extraction of special-teams contribution; :85-120 define recent-history mean; :305-310 define delta. buildSpecialTeamsBullet at :220 describes positive/negative delta as stronger/weaker PP and PK support relative to usual. Adjacent tests state biggest real rating drivers precede context, and insufficient history gives a baseline warning.
  - External references: none suggested
  - Fixtures/test data: `tasks/TASKS/three-pillars-analytics/underlying-stats/UnderlyingStats_Audit.md`
  - Tests: `web/lib/underlying-stats/teamRatingNarrative.test.ts`; `{"discovered_not_run": ["web/lib/underlying-stats/teamRatingNarrative.test.ts"]}`
- **Leads (not audited):**
  - (opus) baseline is the last 10 snapshot rows (daily rows, not games), so 'recent baseline' spans 10 calendar snapshots
  - (opus) when no driver passes 0.35 the filter keeps the top two anyway (condition uses list[0] < threshold)
  - (opus) bullet text hard-codes '5v5' though components may not be 5v5-only
  - (opus) toFiniteNumber maps null components to 0, pulling baseline means toward 0
  - (codex:underlying-narrative-special-teams-bonus) Caller history order is relied on, not validated inside buildBaseline. Adjacent tests inspected but not run; no direct computeSpecialTeamsBonus assertion was found in the inspected test file. No correctness or deployment assessment; no wider narrative/context formula expansion.

## M-UST-033 Special-teams PP%/PK% and ranks

- **Match:** Both; Opus UST-085; Codex underlying-special-ranks
- **Purpose:** Latest PP% and PK% with league rank for the ratings table.
- **Where:** `web/lib/underlying-stats/teamSpecialTeamsContext.ts:28 (buildRankMap)`; `web/lib/underlying-stats/teamSpecialTeamsContext.ts:47 (fetchUnderlyingStatsTeamSpecialTeamsContext)`; `web/lib/underlying-stats/teamSpecialTeamsContext.ts:28 buildRankMap; :47 fetchUnderlyingStatsTeamSpecialTeamsContext`
- **Tags (heuristic):** generation: current
- **Opus view (UST-085):**
  - Method: Take each team's most recent row with date <= requested date; rank both PP% and PK% descending (1 = best), ordinal, nulls unranked.
  - Inputs/units: WGO power_play_pct / penalty_kill_pct (scale as stored by WGO; not normalised here); sources: wgo_team_stats, teams
  - Output scale: same scale as input; rank 1..N; writes: —
  - Status: live — pages/api/underlying-stats/landing.ts and team-ratings.ts feed pages/underlying-stats/index.tsx
  - Consumers: teamLandingRatings.ts
- **Codex view (underlying-special-ranks, calculation, location; Codex family 'Underlying team context'):** PP%/PK% rank
  - Purpose: Rank special-teams percentages in current available team sample.
  - Inputs/units: Finite PP/PK percentages keyed by team
  - Output scale: Descending sort, index+1 rank; null missing values.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - Intended contract (Codex underlying-special-ranks): Implementation source; no separately documented tie policy beyond sort/index.
  - External references: NHL.com PP%/PK%
  - Fixtures/test data: none listed
  - Tests: `{"discovered_not_run": []}`
- **Leads (not audited):**
  - (opus) no season filter — a team with no current-season row would pick a prior season's value
  - (opus) unpaged query ordered by date desc relies on the default row cap containing every team's latest row
  - (opus) percent unit (0-1 vs 0-100) passed through from WGO unchanged
  - (codex:underlying-special-ranks) No runtime verification or correctness assessment performed.

## M-UST-034 Team landing aggregation: GP, point %, share %, SH%, SV%, PDO, per-60

- **Match:** Both; Opus UST-087; Codex underlying-team-rates
- **Purpose:** Aggregate team summary rows into the team stats table.
- **Where:** `web/lib/underlying-stats/teamStatsQueries.ts:305 (addSummaryRow)`; `web/lib/underlying-stats/teamStatsQueries.ts:349 (hasSampledTeamSummaryRow)`; `web/lib/underlying-stats/teamStatsQueries.ts:630 (mapAccumulatorToApiRow)`; `web/lib/underlying-stats/teamStatsQueries.ts:232 (toPer60)`; `web/lib/underlying-stats/teamStatsQueries.ts:240 (toPctDecimal)`; `web/lib/underlying-stats/teamStatsQueries.ts:248 (toPdo)`; `web/lib/underlying-stats/teamStatsQueries.ts:984 (queryTeamStatsLanding)`; `web/lib/underlying-stats/teamStatsQueries.ts:630 mapAccumulatorToApiRow; :232 toPer60; :240 toPctDecimal; :248 toPdo`
- **Tags (heuristic):** percent scale: both/ambiguous; denominators: per 60, per game; generation: current
- **Opus view (UST-087):**
  - Method: Sum all counts; GP = distinct game ids among rows with TOI>0 or any non-zero count; TOI/GP; point% = points/(2*GP); X% = XF/(XF+XA) for CF, FF, SF, GF, xGF, SCF, SCSF, SCGF, HDCF, HDSF, HDGF, MD*, LD*; SH% = GF/SF and SV% = (SA-GA)/SA overall and per SC/HD/MD/LD; PDO = (SH%+SV%)*100; per-60 = count*3600/TOI for all 36 counts. Percent outputs 0-1 except PDO (~100 scale).
  - Inputs/units: counts; TOI seconds; points; sources: team_underlying_stats_summary, teams
  - Output scale: fractions 0-1 for all % except PDO (sum of fractions x100, ~100 scale); per-60 rates; GP integer; rank 1..N; writes: —
  - Status: live — team_underlying_stats_summary written by pages/api/v1/db/update-player-underlying-stats.ts:242 and sweep-gamecenter-normalization.ts:352 (plus manual catch-up/backfill/rebuild routes); read by pages/api/v1/underlying-stats/teams.ts for /underlying-stats/teamStats
  - Consumers: pages/api/v1/underlying-stats/teams.ts; components/underlying-stats/TeamStatsFilters.tsx + teamStatsColumns.ts table
- **Codex view (underlying-team-rates, calculation, location; Codex family 'Underlying statistics'):** Team aggregate possession/danger shares, SH/SV, PDO, pointPct, per60
  - Purpose: Recompute aggregate rates from selected team summary totals.
  - Inputs/units: Sums of team counts and TOI seconds; distinct games and standings points
  - Output scale: pointPct=points/(2×games); CF/FF/SF/GF/xGF/SCF/SCSF/SCGF/HDCF/HDSF/HDGF/MDCF/MDSF/MDGF/LDCF/LDSF/LDGF = for/(for+against); SH=GF/SF, SV=(SA-GA)/SA plus SC/HD/MD/LD variants; PDO=(SH+SV)×100; per60=count×3600/TOI. Percent API fields fractions.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
- **Audit context:**
  - Intent (Opus): tasks/TASKS/three-pillars-analytics/underlying-stats/prd/prd-team-underlying-stats-landing-page.md:64-66 (full column list incl. SH%, SV%, PDO)
  - Intended contract (Codex underlying-team-rates): web/lib/underlying-stats/teamStatsQueries.ts implemented aggregations; official overlay can override compatible all-strength season rows.
  - External references: NST team stats (CF%, xGF%, HDCF%, SH%, SV%, PDO), NHL point %
  - Fixtures/test data: `web/lib/underlying-stats/teamStatsQueries.test.ts:226-615 summary-row fixtures`
  - Tests: `web/__tests__/pages/api/v1/underlying-stats/teams.test.ts`; `web/lib/underlying-stats/teamStatsQueries.test.ts:290 (aggregates counts and derives rates from toi)`; `web/lib/underlying-stats/teamStatsQueries.test.ts:477 (ignores zero-sample rows)`; `{"discovered_not_run": ["web/lib/underlying-stats/teamStatsQueries.test.ts"]}`
- **Leads (not audited):**
  - (opus) PDO is on a ~100 scale while SH%/SV% are 0-1 decimals — mixed percent units in one row
  - (opus) SV% = (SA-GA)/SA counts own goals and empty-net goals in GA but not in SA, so SV%/PDO can be depressed vs NST
  - (opus) in split strengths point% = points/(2*GP) where GP is games with split time — not a meaningful standings figure
  - (codex:underlying-team-rates) No runtime verification or correctness assessment performed.

## M-UST-035 Official NHL metric overlay for team rows

- **Match:** Both; Opus UST-088; Codex underlying-official-overlay
- **Purpose:** Replace native team totals with NHL Stats API values when GP matches.
- **Where:** `web/lib/underlying-stats/teamStatsQueries.ts:441 (roundSeasonTotal)`; `web/lib/underlying-stats/teamStatsQueries.ts:449 (fetchOfficialTeamMetricsSnapshot)`; `web/lib/underlying-stats/teamStatsQueries.ts:494 (applyOfficialRowOverrides)`; `web/lib/underlying-stats/teamStatsQueries.ts:597 (maybeApplyOfficialMetricOverlay)`; `web/lib/underlying-stats/teamStatsQueries.ts:441 roundSeasonTotal; :494 applyOfficialRowOverrides`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: per 60, per game, 5v5 only, all strengths; generation: current
- **Opus view (UST-088):**
  - Method: Only for single season, no scope/venue/opponent, allScores, strength all or 5v5, and official GP == native GP. All-strengths: W/L/OTL/points/ROW/GF/GA from summary; SF = shottype shotsOnNet or round(shotsForPerGame*GP); SA = round(shotsAgainstPerGame*GP); recompute point%, SF%, GF%, SH%, SV%, PDO and per-60 using native TOI. 5v5: CF/CA/FF/FA from satFor/satAgainst/usatFor/usatAgainst, SF = shots5v5; recompute CF%, FF%, SF%, SH%, PDO.
  - Inputs/units: NHL API per-game averages and season totals; native TOI seconds; sources: api.nhle.com/stats/rest/en/team/summary, team/summaryshooting, team/shottype
  - Output scale: overridden integer totals; fractions 0-1; PDO ~100; writes: —
  - Status: live — team_underlying_stats_summary written by pages/api/v1/db/update-player-underlying-stats.ts:242 and sweep-gamecenter-normalization.ts:352 (plus manual catch-up/backfill/rebuild routes); read by pages/api/v1/underlying-stats/teams.ts for /underlying-stats/teamStats (only with serverReadonly client, single season, allScores, all or 5v5)
  - Consumers: pages/api/v1/underlying-stats/teams.ts; components/underlying-stats/TeamStatsFilters.tsx + teamStatsColumns.ts table
- **Codex view (underlying-official-overlay, calculation, location; Codex family 'Underlying statistics'):** Official team season total reconstruction
  - Purpose: Overlay compatible official totals on native team display.
  - Inputs/units: Official per-game values and GP, official wins/points/record and rate percentages
  - Output scale: round(perGame×gamesPlayed) for reconstructed totals; official record/rate fields with native fallbacks.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
- **Audit context:**
  - Intent (Opus): web/lib/underlying-stats/teamStatsQueries.ts:492-493 ('Official NHL totals only replace native values when both cover the same games')
  - Intended contract (Codex underlying-official-overlay): Source :425 canApplyOfficialMetricOverlay restricts eligible filter states; code contract only.
  - External references: NHL.com team summary / SAT (Corsi) definitions
  - Fixtures/test data: `web/lib/underlying-stats/teamStatsQueries.test.ts:650 official row fixture`
  - Tests: `web/lib/underlying-stats/teamStatsQueries.test.ts:616-660 (applyOfficialRowOverrides)`; `{"discovered_not_run": ["web/lib/underlying-stats/teamStatsQueries.test.ts"]}`
- **Leads (not audited):**
  - (opus) 5v5 overlay mixes official SF with native SA in SF%, official SF with native GF in SH%, and native SV% in PDO — mixed sources in single metrics
  - (opus) SA reconstructed by rounding per-game averages times GP (approximation)
  - (opus) live network fetch to NHL API on every eligible request; failure silently falls back to native values
  - (codex:underlying-official-overlay) No runtime verification or correctness assessment performed.

## M-UST-036 Team strength-segment TOI

- **Match:** Both; Opus UST-090; Codex underlying-team-summary
- **Purpose:** Team time on ice per strength and score state from PBP event intervals.
- **Where:** `web/lib/underlying-stats/teamStatsSummaryRefresh.ts:268 (buildStrengthSegments)`; `web/lib/underlying-stats/teamStatsSummaryRefresh.ts:539 (resolveTeamSituationForSegment)`; `web/lib/underlying-stats/teamStatsSummaryRefresh.ts:570 (accumulateTeamToiSeconds)`; `web/lib/underlying-stats/teamStatsSummaryRefresh.ts:570 accumulateTeamToiSeconds; :607 accumulateTeamShotMetrics; :931 buildStandingsOutcome; :969 buildTeamUnderlyingSummaryRowsForGame`
- **Tags (heuristic):** denominators: per team game; generation: current
- **Opus view (UST-090):**
  - Method: Segment from each included event's elapsed time to the next same-period event (or period end via resolvePeriodDurationSeconds); strength from the event's situation code; score diff from the event's posted score. TOI = sum of segment lengths that match strength and score state.
  - Inputs/units: seconds (period_seconds_elapsed); sources: nhl_api_pbp_events
  - Output scale: TOI seconds per team-game-split; writes: team_underlying_stats_summary.toi_seconds
  - Status: live — team_underlying_stats_summary written by pages/api/v1/db/update-player-underlying-stats.ts:242 and sweep-gamecenter-normalization.ts:352 (plus manual catch-up/backfill/rebuild routes); read by pages/api/v1/underlying-stats/teams.ts for /underlying-stats/teamStats
  - Consumers: pages/api/v1/underlying-stats/teams.ts; components/underlying-stats/TeamStatsFilters.tsx + teamStatsColumns.ts table
- **Codex view (underlying-team-summary, calculation, location; Codex family 'Underlying statistics'):** Team strength/score-state TOI, event totals and standings outcomes
  - Purpose: Build per-game native team summary rows.
  - Inputs/units: PBP and shifts, supplied/heuristic xG and danger buckets, official outcome payload; time seconds
  - Output scale: CF/CA FF/FA SF/SA GF/GA xGF/xGA, SC shots/goals/chances and HD/MD/LD variants, TOI seconds; W/L/OTL/ROW and standings points according to game outcome. Outcome points: winner2; OT/SO loser1; regulation loser0. ROW excludes shootout wins.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED (team PRD tasks/TASKS/three-pillars-analytics/underlying-stats/prd/prd-team-underlying-stats-landing-page.md:64 lists TOI and TOI/GP only)
  - Intended contract (Codex underlying-team-summary): Source implementation filters by team-relative strength/score-state, excludes shootout shots; official outcome precedence defined at :909 resolveGameOutcome.
  - External references: NST team TOI (shift-based)
  - Fixtures/test data: none listed
  - Tests: `{"discovered_not_run": ["web/lib/underlying-stats/teamStatsSummaryRefresh.test.ts"]}`
- **Leads (not audited):**
  - (opus) event-interval TOI, not shift-based; strength changes between events (penalty expiry) are attributed to the earlier state until the next event
  - (opus) segment score uses the event's posted score (post-goal) whereas shots use score before the event — slightly different score-state attribution between TOI and counts
  - (codex:underlying-team-summary) No runtime verification or correctness assessment performed.

## M-UST-037 NST team table header normalization and percentage validation

- **Match:** Opus only; Opus UST-001; Codex —
- **Purpose:** Scrape NST team table and normalize header/percent fields for Supabase
- **Where:** `functions/api/fetch_team_table.py:77 (clean_header)`; `functions/api/fetch_team_table.py:86 (validate_percentage)`; `functions/api/fetch_team_table.py:96 (fetch_team_table)`; `web/scripts/fetch_team_table.py (manual copy with shared NST admission)`
- **Tags (heuristic):** denominators: per 60, per game; generation: current
- **Opus view (UST-001):**
  - Method: '/60' -> '_perSixty', '/GP' -> '_perGame', '%' -> 'Pct'; percentage columns parsed float and kept only if 0<=x<=100 else None; no derived math
  - Inputs/units: NST percents 0-100, per-60 rates; sources: Natural Stat Trick teamtable.php
  - Output scale: pass-through; writes: returned JSON (caller upserts)
  - Status: live — Flask route /api/fetch_team_table in functions/api
  - Consumers: functions/api/index.py /api/fetch_team_table
- **Audit context:**
  - Intent (Opus): docstring web/scripts and functions copies: 'Replace /60 with _perSixty and % with Pct'
  - External references: NST team table
  - Fixtures/test data: none listed
  - Tests: none listed
- **Leads (not audited):**
  - (opus) *Pct values outside 0-100 silently become None (no error); PDO is not validated

## M-UST-038 views nst_seasonlong_{es,pk,pp,as}_rates and _rates_oi

- **Match:** Opus only; Opus UST-008; Codex —
- **Purpose:** Per-60 individual and on-ice rates, on-ice shares, IPP, on-ice SH%/SV%, zone-start%
- **Where:** `supabase/migrations/20260716112908_production_schema_baseline.sql:18762 (nst_seasonlong_es_rates)`; `supabase/migrations/20260716112908_production_schema_baseline.sql:18804 (nst_seasonlong_es_rates_oi)`; `supabase/migrations/20260716112908_production_schema_baseline.sql:19192 (pk_rates)`; `supabase/migrations/20260716112908_production_schema_baseline.sql:19234 (pk_rates_oi)`; `supabase/migrations/20260716112908_production_schema_baseline.sql:19616 (pp_rates)`; `supabase/migrations/20260716112908_production_schema_baseline.sql:19658 (pp_rates_oi)`; `supabase/migrations/20260716112908_production_schema_baseline.sql:20472 (as_rates)`; `supabase/migrations/20260716112908_production_schema_baseline.sql:20514 (as_rates_oi)`
- **Tags (heuristic):** percent scale: 0-100; denominators: per 60; generation: current
- **Opus view (UST-008):**
  - Method: x_per_60 = x*3600/toi_seconds (COALESCE 0); on-ice shares cf_pct etc = for*100/(for+against) default 50; on_ice_sh_pct = GF*100/SF; on_ice_sv_pct = (SA-GA)*100/SA default 100; ipp = points*100/on-ice GF; off_zone_start_pct = OZS*100/(OZS+NZS+DZS); off_zone_faceoff_pct likewise.
  - Inputs/units: toi seconds; sources: nst_seasonlong_*_counts, nst_seasonlong_*_counts_oi
  - Output scale: per-60; percent 0-100; writes: —
  - Status: live — via nst_percentile_* views read by web/utils/fetchWigoPlayerStats.ts, fetchWigoRatingStats.ts
  - Consumers: nst_percentile_* views; web/lib/nst/radarSeasonStats.ts
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: NST per-60 and share conventions; NST OZS% excludes neutral-zone starts
  - Fixtures/test data: none listed
  - Tests: none listed
- **Leads (not audited):**
  - (opus) off_zone_start_pct includes NZ starts in denominator, unlike NST OZS% (and unlike player_totals_unified which uses OZS/(OZS+DZS))
  - (opus) zero-denominator defaults (0, 50, 100) are reported as real values
  - (opus) IPP numerator is individual points (incl. PP/PK in as_*) vs strength-matched on-ice GF - fine per strength, but as_ mixes

## M-UST-039 views nst_seasonlong_combined_{es,pk,pp}

- **Match:** Opus only; Opus UST-010; Codex —
- **Purpose:** Combined season counts plus per-60 rates per player and strength
- **Where:** `supabase/migrations/20260716112908_production_schema_baseline.sql:20567 (nst_seasonlong_combined_es)`; `supabase/migrations/20260716112908_production_schema_baseline.sql:20692 (combined_pk)`; `supabase/migrations/20260716112908_production_schema_baseline.sql:20817 (combined_pp)`
- **Tags (heuristic):** denominators: per 60; generation: legacy
- **Opus view (UST-010):**
  - Method: COALESCE counts to 0; individual per-60 = x*3600/toi_seconds; on-ice per-60 = x*3600/toi_seconds_oi (e.g. hdga_per_60).
  - Inputs/units: toi seconds; sources: nst_seasonlong_*_counts, nst_seasonlong_*_counts_oi
  - Output scale: per-60; writes: —
  - Status: legacy/dead — no reader in web/ or functions/
  - Consumers: no reader found
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: NST per-60
  - Fixtures/test data: none listed
  - Tests: none listed
- **Leads (not audited):**
  - (opus) duplicate of *_rates views with slightly different column names (assists_per_60 vs total_assists_per_60)

## M-UST-040 Goalie leaderboard percent colour bands and fPts diff vs league

- **Match:** Opus only; Opus UST-014; Codex —
- **Purpose:** Colours % acceptable weeks, % good weeks and avg percentile; shows FPts/G minus league average.
- **Where:** `web/components/GoaliePage/GoalieLeaderboard.tsx:35 (getPercentageClass)`; `web/components/GoaliePage/GoalieLeaderboard.tsx:151 (fPtsDiff)`
- **Tags (heuristic):** denominators: per game; generation: current
- **Opus view (UST-014):**
  - Method: class high if >=75, medium if >=50, else low (undefined -> 0 -> low). fPtsDiff = avgFP/G - leagueAvgFP/G.
  - Inputs/units: percent 0-100; fantasy points per game; sources: goalie rankings (UST-026/027/030)
  - Output scale: 3-level band; FP delta; writes: —
  - Status: live — goalie leaderboard
  - Consumers: pages/goalies.js; pages/trueGoalieValue.tsx
- **Audit context:**
  - Intent (Opus): GoalieLeaderboard.tsx:253 help text: Avg %ile shows overall statistical rank vs peers
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/__tests__/pages/trueGoalieValue.test.tsx`
- **Leads (not audited):**
  - (opus) one 75/50 band applied to three differently-distributed percentages (week shares and percentile ranks)
  - (opus) bands differ from the 80/60/45/30 weekly tiers in UST-026

## M-UST-041 Team roster matrix heat shade (min-max of sorted column)

- **Match:** Opus only; Opus UST-015; Codex —
- **Purpose:** Shades the sorted column of the roster matrix by position between table min and max.
- **Where:** `web/components/RosterMatrix/RosterMatrix.tsx:350 (renderRows heat)`
- **Tags (heuristic):** percent scale: fraction 0-1; generation: current
- **Opus view (UST-015):**
  - Method: n = (v-min)/(max-min); inverted (1-n) only for goals_against_avg; disabled if <2 values or max==min; 0-GP players excluded.
  - Inputs/units: column units; sources: RosterMatrixWrapper rows
  - Output scale: 0-1; writes: —
  - Status: live — team roster matrix
  - Consumers: TeamTabNavigation roster tab
- **Audit context:**
  - Intent (Opus): RosterMatrix.tsx:352 comment: shade = rank between lowest and highest value (GAA lower-is-better)
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: none listed
- **Leads (not audited):**
  - (opus) only GAA treated as lower-is-better; other lower-better columns (e.g. GA, PIM) shade as if higher is better
  - (opus) min-max is outlier sensitive and ignores sample size

## M-UST-042 Team roster matrix goalie gamelog aggregation (SV%, GAA, HD/MD/LD SV%)

- **Match:** Opus only; Opus UST-016; Codex —
- **Purpose:** Fallback season goalie ratios for the team page roster matrix when totals rows are missing.
- **Where:** `web/components/RosterMatrix/RosterMatrixWrapper.tsx:388 (aggregation)`; `web/components/RosterMatrix/RosterMatrixWrapper.tsx:422 (LD saves)`; `web/components/RosterMatrix/RosterMatrixWrapper.tsx:431 (ratios)`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: per 60; generation: current
- **Opus view (UST-016):**
  - Method: Sum per goalie over season gamelog. SV% = saves/SA; GAA = GA*3600/TOI(s); HD/MD/LD SV% = saves/shots per band. LD saves derived as: ldGA = ld_SA - hd_saves; total_ld_saves += hd_saves \|\| (ld_SA - ldGA). Zero denominators -> 0 (not null). Used only when goalieStatsMap lacks the player.
  - Inputs/units: TOI seconds; counts; sources: nst_gamelog_goalie_all_counts, wgo_goalie_stats_totals
  - Output scale: fraction 0-1; goals per 60; writes: —
  - Status: live — team page roster matrix fallback
  - Consumers: TeamTabNavigation roster tab
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: NHL SV%/GAA convention
  - Fixtures/test data: none listed
  - Tests: `web/components/TeamTabNavigation/TeamTabNavigation.test.tsx`
- **Leads (not audited):**
  - (opus) LD saves formula adds HD saves to LD saves (ld_saves column not selected), so LD SV% is wrong
  - (opus) zero-shot goalies get SV% 0 instead of null
  - (opus) total_xg_against/gsaa aggregated but unused in ratios

## M-UST-043 Legacy NST three-year and career count averages (ThreeYearAverages)

- **Match:** Opus only; Opus UST-017; Codex —
- **Purpose:** Scrape a player's NST season-by-season individual and on-ice counts and return 3-year and career per-season averages plus derived shares.
- **Where:** `web/pages/api/ThreeYearAverages/[playerId].ts:227 (parseTime)`; `web/pages/api/ThreeYearAverages/[playerId].ts:331 (addTotalRows)`; `web/pages/api/ThreeYearAverages/[playerId].ts:654 (GetThreeYearStats)`; `web/pages/api/ThreeYearAverages/[playerId].ts:1368 (GetCareerStats)`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: per 60, shots on goal; generation: legacy
- **Opus view (UST-017):**
  - Method: Per season: multi-team seasons summed into a TOT row (S% = G/SOG, secA% = A2/A, oZS% = oZS/(oZS+dZS), SOG/60 = SOG/TOI*60, IPP = (G+A)/oiGF, CF%/FF%/SF%/SCF%/xGF%/GF% = F/(F+A)). 3YA picks the 3 most recent seasons EXCLUDING the latest season (TOT row if traded), sums each count and divides by 3; throws if fewer than 3 prior seasons. Shares recomputed from 3-season totals. Career = same over all seasons except the latest, divided by number of seasons.
  - Inputs/units: NST TOI decimal minutes converted to seconds by local parseTime; counts are season totals; percentages as fractions 0-1; sources: Natural Stat Trick playerreport.php (scraped HTML, cached)
  - Output scale: per-season average counts; shares as fraction 0-1; SOG/60 mislabelled (per-minute); writes: —
  - Status: legacy/dead — no callers found in components/hooks/pages; route ledger incoming_counts {}; wrapped by NST job lifecycle; only referenced by functions/tests/test_nst_legacy_lifecycle.py and lib/nst/callerLifecycle.test.ts
  - Consumers: none found in web/components, hooks or pages (route ledger shows 0 incoming calls)
- **Audit context:**
  - Intent (Opus): Code comment at web/pages/api/ThreeYearAverages/[playerId].ts:~648 'Computes three-year averages for counting stats without strictly requiring TOT rows'; no product doc found
  - External references: NST per-60 convention (count / TOI minutes * 60); IPP = points / on-ice GF
  - Fixtures/test data: none listed
  - Tests: `web/lib/nst/callerLifecycle.test.ts (lifecycle only, not math)`
- **Leads (not audited):**
  - (opus) local parseTime converts NST decimal-minute TOI to SECONDS, then SOG/60 = SOG/TOI*60 yields shots per MINUTE, not per 60 (lib/NHL/TOI parseTime returns minutes, so the two files disagree)
  - (opus) data.IPP is written as goals + assists/oiGF (operator precedence) instead of (goals+assists)/oiGF; the correct rateAverages IPP is computed but not used in the returned object
  - (opus) addTotalRows adds count.SOG twice to the TOT row (lines ~411 and ~419)
  - (opus) rateAverages oiSH% and SOG/60 divide 3-season TOTAL numerators by 3-season AVERAGED denominators (SF and TOI already divided by 3), inflating by 3x
  - (opus) 'current season' is assumed to be the latest season in the NST table; in the offseason that excludes a completed season
  - (opus) mixes \|\| 1 and \|\| 0 guards, so zero denominators silently produce 0 rather than null

## M-UST-044 Legacy NST three-year and career rate averages (per-60) with TOT rate rows

- **Match:** Opus only; Opus UST-018; Codex —
- **Purpose:** Combine multi-team per-60 rows into TOI-weighted TOT rows, then average per-60 rates over 3 prior seasons and career.
- **Where:** `web/pages/api/ThreeYearAverages/[playerId].ts:481 (addTotalRateRows)`; `web/pages/api/ThreeYearAverages/[playerId].ts:1044 (GetThreeYearRates)`; `web/pages/api/ThreeYearAverages/[playerId].ts:1756 (GetCareerRates)`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: per 60; generation: legacy
- **Opus view (UST-018):**
  - Method: TOT row: rate*TOI/3600 summed per stat, then divided by summed TOI *3600 (TOI-weighted). 3YA/career: SIMPLE unweighted mean of each season's per-60 (sum/length), seasons = 3 most recent excluding latest (career = all but latest). Shares (CF%, FF%, SF%, GF%, xGF%, SCF%) computed from SUMS of per-60 rates across seasons.
  - Inputs/units: per-60 rates; TOI assumed seconds; sources: Natural Stat Trick playerreport.php (scraped)
  - Output scale: per-60 rates; shares fraction 0-1; writes: —
  - Status: legacy/dead — no callers found; route ledger incoming_counts {}
  - Consumers: none found
- **Audit context:**
  - Intent (Opus): Code comment at web/pages/api/ThreeYearAverages/[playerId].ts:~474 'Aggregates multiple team entries per season into a TOT row for yearlyRates. Computes percentages using specified formulas instead of averaging.'
  - External references: TOI-weighted pooling of per-60 rates (sum counts / sum TOI), as NST and Evolving-Hockey do for multi-season views
  - Fixtures/test data: none listed
  - Tests: none listed
- **Leads (not audited):**
  - (opus) multi-season averages are unweighted means of per-60 rates, so a 10-game season weighs the same as an 82-game season, inconsistent with the TOI-weighted TOT rows in the same file
  - (opus) TOT weighting divides by 3600 which assumes TOI in seconds; whether rate-table TOI goes through the seconds parseTime was not verified

## M-UST-045 NST scrape cell normalization (TOI to seconds, dashes, percents)

- **Match:** Opus only; Opus UST-019; Codex —
- **Purpose:** Convert scraped NST table cells into numeric DB columns for gamelog, season, last-ten, goalie, player-report and team-daily tables.
- **Where:** `web/pages/api/v1/db/update-nst-gamelog.ts:839 (isDashPlaceholder)`; `web/pages/api/v1/db/update-nst-gamelog.ts:1408-1440 (toi parse)`; `web/pages/api/v1/db/update-nst-team-daily.ts:338 (convertTimeToSeconds)`; `web/pages/api/v1/db/update-nst-current-season.ts:475 (cell parse)`; `web/pages/api/v1/db/update-nst-last-ten.ts:498 (cell parse)`; `web/pages/api/v1/db/update-nst-goalies.ts:480 (cell parse)`; `web/pages/api/v1/db/update-nst-player-reports.ts:586 (cell parse)`; `web/pages/api/v1/db/nst_gamelog_scraper.py:460 (cell parse)`
- **Tags (heuristic):** percent scale: 0-100; denominators: per 60; generation: legacy, current
- **Opus view (UST-019):**
  - Method: gamelog: TOI 'mm:ss' -> m*60+s seconds, decimal -> round(min*60) seconds; dash -> '0'; percent strings strip '%' (kept 0-100). team-daily: mm:ss -> seconds, '-' -> null. current-season / player-reports: '-' -> null, Number(). last-ten / goalies: strip all non [0-9.-] then Number(). Python gamelog scraper: float(), dash -> null, TOI kept as decimal minutes. Per-60 columns are NST-provided, not recomputed.
  - Inputs/units: NST text: mm:ss or decimal minutes; percents 0-100; sources: Natural Stat Trick playerteams/teamtable/playerreport pages
  - Output scale: seconds or minutes (by writer); percents 0-100; writes: nst_gamelog_* tables, nst_seasonal_individual_counts / nst_seasonal_on_ice_counts and rate variants, nst_team_* daily tables, nst goalie tables, nst last-ten tables
  - Status: live — route-runner registry and cron inventory (update-nst-gamelog, team-daily, current-season, goalies); Python scrapers in pages/api are legacy (not Next routes)
  - Consumers: calculate-wigo-stats; update-wgo-averages; rolling player averages (lib); sustainability (lib)
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED (NST rate limits documented in AGENTS.md, not parsing)
  - External references: NST definitions
  - Fixtures/test data: none listed
  - Tests: `web/lib/cron/nstClassification.test.ts`; `web/lib/routeRunner/tick.test.ts`
- **Leads (not audited):**
  - (opus) dash means 0 in update-nst-gamelog but null in every other NST writer, so missing vs zero differs by table
  - (opus) TOI units differ: TS gamelog stores seconds, Python gamelog scraper and seasonal writers store NST decimal minutes
  - (opus) last-ten and goalie parsers strip non-digits, so an 'mm:ss' cell would become e.g. 1234 (TOI format on those pages not verified)
  - (opus) 'iHDCF/60' is mapped to column hdcf_per_60 in individual tables (TS line 566, Python line 117), colliding in name with on-ice HDCF/60

## M-UST-046 WGO/NST three-year and career average table (wgo_avg_three_year / wgo_avg_career)

- **Match:** Opus only; Opus UST-020; Codex —
- **Purpose:** Aggregate NST seasonal individual and on-ice counts per player and strength into 3-year and career totals, per-60 rates and shares.
- **Where:** `web/pages/api/v1/db/update-wgo-averages.ts:23 (safeDivide)`; `web/pages/api/v1/db/update-wgo-averages.ts:438 (selectCompletedWgoAverageSeasons)`; `web/pages/api/v1/db/update-wgo-averages.ts:561 (processRow)`; `web/pages/api/v1/db/update-wgo-averages.ts:729-990 (metric builder)`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: per 60, per game; generation: current
- **Opus view (UST-020):**
  - Method: Three-year = 3 most recent COMPLETED seasons (regularSeasonEndDate < today); career = all. Sum counts; avg_toi_per_gp = toi/gp; X_per_60 = total*60/toi (about 60 stats); shares F/(F+A) for CF, FF, SF, GF, xGF, SCF, HDCF, HDGF, MDCF, MDGF, LDCF, LDGF; on_ice_sh_pct = GF/SF; on_ice_sv_pct = 1 - GA/SA; pdo = (sh+sv)*1000; off_zone_start_pct = OZS/(OZS+DZS) (excludes NZ and OTF); off_zone_faceoff_pct likewise; gp_percentage = gp / possible team GP for contributing team-seasons.
  - Inputs/units: TOI minutes (assumed); counts totals; sources: nst_seasonal_individual_counts, nst_seasonal_on_ice_counts, team_summary_years, teamsinfo, seasons
  - Output scale: per-60 rates; fractions 0-1; PDO ~1000; writes: wgo_avg_three_year, wgo_avg_career
  - Status: live — route ledger calls=1; part of rolling FORGE pipeline tests
  - Consumers: no direct reader found in components/hooks/lib for wgo_avg_three_year (other agents should check SQL views)
- **Audit context:**
  - Intent (Opus): Inline comments update-wgo-averages.ts (denominator excludes neutral zone and on-the-fly starts)
  - External references: NST pooled per-60 and share conventions; PDO*1000 convention
  - Fixtures/test data: none listed
  - Tests: `web/__tests__/pages/api/v1/db/update-wgo-averages.route.test.ts`
- **Leads (not audited):**
  - (opus) TOI unit assumed minutes (per_60 = count*60/toi); nst_seasonal tables are written raw from NST (decimal minutes) by update-nst-current-season while nst gamelog tables store seconds, so the same 'toi' column name has different units across nst_* tables
  - (opus) teamSeasonGp dedupes by season only, so a traded player's second team is skipped in possible-GP
  - (opus) pdo on 0-1000 scale while other pct outputs are 0-1

## M-UST-047 Stats/goalie page client-side display derivations (grouped)

- **Match:** Opus only; Opus UST-022; Codex —
- **Purpose:** Small client-side unit conversions and derived values on stats leaderboards and goalie lists
- **Where:** `web/components/StatsPage/MobileTabInterface.tsx:117 (assists = max(points - goals, 0))`; `web/components/StatsPage/MobileTabInterface.tsx:46 (fraction x100 percent)`; `web/components/StatsPage/LeaderboardCategoryGoalie.tsx:44 (QS% x100)`; `web/components/GoaliePage/GoalieList.tsx:137 (weekly TOI seconds/60)`; `web/components/GoaliePage/GoalieList.tsx:238 (league weekly TOI seconds/60)`; `web/components/TeamLandingPage/StrengthOfSchedule.tsx:46 (sos x100)`
- **Tags (heuristic):** percent scale: 0-100; generation: current
- **Opus view (UST-022):**
  - Method: Display transforms: assists derived as points minus goals; fractions multiplied by 100; TOI seconds to minutes.
  - Inputs/units: fractions 0-1; TOI seconds; counts; sources: stats page leaderboard props (lib/NHL/statsPageTypes), goalie weekly aggregates
  - Output scale: percent 0-100 strings; minutes; writes: —
  - Status: live — stats pages and pages/goalies.js; StrengthOfSchedule via team landing
  - Consumers: stats pages, goalies page, team landing
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/components/StatsPage/LeaderboardCategoryGoalie.test.tsx`; `web/components/StatsPage/MobileTabInterface.test.tsx`
- **Leads (not audited):**
  - (opus) assists derived from points-goals instead of reading assists

## M-UST-048 Goalie danger-split goals-against and xG-against accumulation

- **Match:** Opus only; Opus UST-023; Codex —
- **Purpose:** Per-goalie HD/MD/LD goals against and xG against from shot features.
- **Where:** `web/lib/underlying-stats/playerStatsLandingServer.ts:3420 (accumulateGoalieShotFeatureBucketMetrics)`; `web/lib/underlying-stats/playerStatsLandingServer.ts:3537 (goalie branch of accumulateLandingMetrics)`; `web/lib/underlying-stats/playerStatsLandingServer.ts:1876 (filterGoalieShotFeaturesForState)`
- **Tags (heuristic):** generation: current
- **Opus view (UST-023):**
  - Method: For goal or shot-on-goal faced by the goalie (filtered by strength + score state): bucket as above; xG value high=0.25 if goal else 0.18, medium=0.08, low=0.02 (no rebound/rush bonuses); adds goals to hd/md/ldGoalsAgainst and xG to hd/md/ldXgAgainst. Separately adds parity md_goals_against/ld_goals_against, hd/md/ld shots and saves. xG proxy here INCLUDES only the danger bucket and the goal flag (0.25 if a high-danger goal); EXCLUDES rebound/rush/royal-road bonuses, shot type, strength, score, shooter/goalie effects, training data and calibration.
  - Inputs/units: shot counts; feet/degrees for buckets; sources: games, nhl_api_pbp_events, nhl_api_shift_rows, nhl_api_game_roster_spots, nhl_api_game_payloads_raw (endpoint=landing), players, teams
  - Output scale: goals (integers) and xG (goals) per danger bucket; writes: nhl_api_game_payloads_raw (derived://underlying-player-summary-v2/... partitions), goalie_underlying_summary_partitions (copied by goalieStatsSummaryRefresh.ts)
  - Status: live — read by pages/api/v1/underlying-stats/players.ts and goalies.ts (+[playerId], chart) for /underlying-stats/playerStats and /goalieStats; summaries written by pages/api/v1/db/update-player-underlying-stats.ts, which runs from the lineCombinations insert trigger (supabase/migrations/20260716112910_harden_line_combination_trigger_auth.sql:130) and the pg_cron job 'update-player-underlying-stats-yesterday' at 09:35 UTC (tasks/TASKS/cron-operations/cron-schedule.md:382,827) (goalie mode)
  - Consumers: goalie landing/detail/chart
- **Audit context:**
  - Intent (Opus): tasks/TASKS/three-pillars-analytics/underlying-stats/prd/prd-goalie-underlying-stats-landing-page.md:38 ('danger-split shots, saves, goals against, save percentages, GAA, and GSAA')
  - External references: NST goalie HDSV%/HDGA; GSAx by danger
  - Fixtures/test data: `web/lib/underlying-stats/playerStatsLandingServer.test.ts:560-1160 persisted summary fixtures with md/ldGoalsAgainst`
  - Tests: `web/lib/underlying-stats/playerStatsLandingServer.test.ts (danger goals appear only as zero/one-valued fixture fields at :662-1037)`
- **Leads (not audited):**
  - (opus) mdGoalsAgainst and ldGoalsAgainst are added twice — once from parity counts (lines 3548, 3551) and again in accumulateGoalieShotFeatureBucketMetrics (lines 3459, 3461) — while hdGoalsAgainst is only added once; MD/LD GAA and GSAA are likely inflated/understated
  - (opus) danger-bucket xG (0.18/0.08/0.02, goal floor 0.25) differs from the parity xg_against model, so hdXg+mdXg+ldXg != xgAgainst
  - (opus) hdSavePct uses parity hd_saves/hd_shots_against while hdGoalsAgainst comes from the local heuristic — two sources for one split

## M-UST-049 Goalie save %, GAA, 'GSAA' and danger-split save metrics

- **Match:** Opus only; Opus UST-024; Codex —
- **Purpose:** Goalie landing/detail metrics.
- **Where:** `web/lib/underlying-stats/playerStatsLandingServer.ts:5075 (goalie branch of mapLandingAggregationRowToApiRow)`; `web/lib/underlying-stats/playerStatsLandingServer.ts:5085 (gsaa)`; `web/lib/underlying-stats/playerStatsLandingServer.ts:5093 (hdSavePct)`; `web/lib/underlying-stats/playerStatsLandingServer.ts:5119 (avgShotDistance)`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: per 60; generation: current
- **Opus view (UST-024):**
  - Method: SV% = saves / shotsAgainst; GAA = GA*3600/TOI; 'GSAA' = xGA - GA (this is goals saved above expected, GSAx); HD/MD/LD SV% = saves/shots per bucket; HD/MD/LD GAA = bucket GA*3600/total TOI; HD/MD/LD GSAA = bucket xGA - bucket GA; avg shot/goal distance = weighted totals / counts. All percentages 0-1.
  - Inputs/units: shots, saves, goals (integers); xG goals; TOI seconds; distance feet; sources: —
  - Output scale: SV% fraction 0-1; GAA goals/60; GSAA in goals (xGA-GA); distance feet; writes: —
  - Status: live — read by pages/api/v1/underlying-stats/players.ts and goalies.ts (+[playerId], chart) for /underlying-stats/playerStats and /goalieStats; summaries written by pages/api/v1/db/update-player-underlying-stats.ts, which runs from the lineCombinations insert trigger (supabase/migrations/20260716112910_harden_line_combination_trigger_auth.sql:130) and the pg_cron job 'update-player-underlying-stats-yesterday' at 09:35 UTC (tasks/TASKS/cron-operations/cron-schedule.md:382,827) (goalie mode)
  - Consumers: pages/api/v1/underlying-stats/players.ts; pages/api/v1/underlying-stats/players/[playerId].ts; pages/api/v1/underlying-stats/players/[playerId]/chart.ts; pages/api/v1/underlying-stats/goalies.ts; pages/api/v1/underlying-stats/goalies/[playerId].ts; pages/api/v1/db/update-player-underlying-stats.ts; components/underlying-stats/playerStatsColumns.ts (labels 'GSAA')
- **Audit context:**
  - Intent (Opus): tasks/TASKS/three-pillars-analytics/underlying-stats/prd/prd-goalie-underlying-stats-landing-page.md:36-38,200-219 (GSAA, xG Against, HD/MD/LD GSAA) — PRD does not define GSAA as xGA-GA
  - External references: NST/MoneyPuck GSAx = xGA - GA; GSAA (Hockey-Reference) = SA*(1 - league SV%) - GA
  - Fixtures/test data: `tasks/TASKS/three-pillars-analytics/underlying-stats/PlayerStatsLanding_Audit.md`; `tasks/TASKS/three-pillars-analytics/underlying-stats/PlayerStatsDetail_Audit.md`
  - Tests: `web/__tests__/pages/api/v1/underlying-stats/goalies/[playerId].test.ts`; `web/lib/underlying-stats/goalieStatsServer.test.ts`
- **Leads (not audited):**
  - (opus) metric labelled GSAA is actually xG-based GSAx; true GSAA (league-average SV% baseline) is not computed
  - (opus) MD/LD GSAA inherit the md/ld goals-against double count
  - (opus) no minimum-shots filter; SV% for tiny samples ranks alongside starters

## M-UST-050 Goalie advanced NST metrics by strength (GSAA, xGA/60, HDSA/60, distances, QS%)

- **Match:** Opus only; Opus UST-025; Codex —
- **Purpose:** Aggregate NST goalie counts per strength over selected rows
- **Where:** `web/components/GoaliePage/goalieMetrics.ts:126 (buildGoalieAdvancedMetricsRows)`; `web/components/GoaliePage/goalieMetrics.ts:93 (per60)`; `web/components/GoaliePage/goalieMetrics.ts:99 (weightedAverageField)`; `web/components/GoaliePage/goalieMetrics.ts:34 (GOALIE_ADVANCED_STRENGTH_OPTIONS)`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: per 60, per game; generation: current
- **Opus view (UST-025):**
  - Method: GSAA = sum of per-game NST GSAA; xGA total summed; per60 = sum/TOI*60 (TOI treated as minutes); avg shot distance weighted by shots against, avg goal distance weighted by goals against; QS% = sum(quality_start)/sum(games_started) (0-1).
  - Inputs/units: NST goalie TOI treated as minutes; counts; distances in feet; GSAA in goals; sources: goalie_stats_unified
  - Output scale: per-60 rates; feet; QS% fraction 0-1; GSAA goals; writes: —
  - Status: live — pages/goalies.js (GoalieAdvancedMetricsTable)
  - Consumers: GoalieAdvancedMetricsTable; buildGoalieValueTierMap
- **Audit context:**
  - Intent (Opus): tasks/TASKS/variance/v2/prd-variance-goalies-skaters-second-pass.md:5 ('a real advanced goalie Metrics table')
  - External references: NST goalie GSAA and per-60 conventions; HDSV%
  - Fixtures/test data: none listed
  - Tests: `web/components/GoaliePage/goalieMetrics.test.ts`
- **Leads (not audited):**
  - (opus) per60 assumes NST toi in minutes while GoaliePage WGO TOI and player-card NST TOI are treated as seconds - unit should be confirmed
  - (opus) summing per-game GSAA uses NST's per-game league SV% baseline rather than one period baseline
  - (opus) no HDSV% or GSAx (xGA minus GA) derived even though both inputs exist

## M-UST-051 Goalie metrics leader groups and variance relative display

- **Match:** Opus only; Opus UST-026; Codex —
- **Purpose:** Top-3 lists and variance vs average
- **Where:** `web/components/GoaliePage/goalieMetrics.ts:291 (buildGoalieMetricsGroups)`; `web/components/GoaliePage/goalieMetrics.ts:413 (buildGoalieVarianceAverages)`; `web/components/GoaliePage/goalieMetrics.ts:434 (formatGoalieVarianceValue)`
- **Tags (heuristic):** generation: current
- **Opus view (UST-026):**
  - Method: Consistency leaders sort by wowSD + gogSD ascending; workload by GP then TOI; recent form by WoW points then % good weeks; relative variance = value - mean across goalies.
  - Inputs/units: SDs in ranking points and fantasy points; sources: —
  - Output scale: sum of SDs; relative delta; writes: —
  - Status: live — pages/goalies.js GoalieLeaderboard
  - Consumers: GoalieLeaderboard
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/components/GoaliePage/goalieMetrics.test.ts`
- **Leads (not audited):**
  - (opus) adds SD of weekly ranking points to SD of game fantasy points (different units)

## M-UST-052 Goalie value tier score (Tier 1-5)

- **Match:** Opus only; Opus UST-027; Codex —
- **Purpose:** Composite percentile score classifying goalie fantasy value
- **Where:** `web/components/GoaliePage/goalieMetrics.ts:535 (buildGoalieValueTierMap)`; `web/components/GoaliePage/goalieMetrics.ts:249 (percentile)`; `web/components/GoaliePage/goalieMetrics.ts:686 (applyGoalieValueTiers)`
- **Tags (heuristic):** percent scale: 0-100; generation: current
- **Opus view (UST-027):**
  - Method: Midrank percentiles within filtered goalies. fantasy = mean(pct FP/G, pct FP above avg); consistency = mean(inverted pct wowSD, inverted pct gogSD); workload = mean(pct GP, pct TOI); startConfidence = mean(pct GS, pct acceptable weeks, [pct QS%]). Score = 0.35*fantasy + 0.25*consistency + 0.20*workload + 0.20*startConfidence. Tier1 >=85, Tier2 >=70, Tier3 >=55, Tier4 >=40, else Tier5.
  - Inputs/units: percentiles 0-100 of FP/G, SDs, GP, TOI minutes, GS, % weeks, QS% fraction; sources: wgo_goalie_stats, goalie_stats_unified
  - Output scale: 0-100 composite score; Tier 1-5; writes: —
  - Status: live — pages/goalies.js applyGoalieValueTiers
  - Consumers: GoalieLeaderboard; pages/goalies.js
- **Audit context:**
  - Intent (Opus): tasks/TASKS/variance/v2/prd-variance-goalies-skaters-second-pass.md:20,31,94-107 (explainable tier from production, consistency, workload, start confidence)
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/components/GoaliePage/goalieMetrics.test.ts`
- **Leads (not audited):**
  - (opus) fantasyPointsAboveAverage is never assigned in calculateGoalieRankings (only typed/tests), so every goalie gets the same midrank (50) for half the fantasy component
  - (opus) missing values coerced to 0 by toFiniteNumber before percentile
  - (opus) low-variance (few-game) goalies score high on consistency

## M-UST-053 Goalie page week windows and weekly pipeline

- **Match:** Opus only; Opus UST-035; Codex —
- **Purpose:** Define fantasy weeks (season start to first Sunday, then Mon-Sun) and fetch/aggregate/upsert weekly goalie stats.
- **Where:** `web/lib/supabase/GoaliePage/goaliePageWeeks.js:19 (fetchSeasonWeeks)`; `web/lib/supabase/GoaliePage/updateWeeklyData.ts:28 (updateWeeklyData)`; `web/lib/supabase/GoaliePage/fetchGoalieDataForWeek.js:11 (fetchGoalieDataForWeek)`; `web/lib/supabase/GoaliePage/upsertGoalieData.js:18 (upsertWeekData)`
- **Tags (heuristic):** generation: legacy, current
- **Opus view (UST-035):**
  - Method: Week 1 = season start through endOfWeek(start, weekStartsOn Monday); weeks 2+ = Monday-Sunday to regular-season end. Regular season only. Per-week aggregate NHL goalie summary fetched in pages of 100 with linear backoff (1000 ms*attempt, 3 tries); league averages via calculateAverages.
  - Inputs/units: dates (season start/end), NHL API weekly aggregates, TOI seconds; sources: api.nhle.com stats/rest goalie/summary (isAggregate=true, gameTypeId=2), season API
  - Output scale: week rows (id 1..N, start/end dates); writes: goalie_page_weeks, goalie_page_stats, league_averages_goalies
  - Status: legacy/dead — standalone node script (dotenv ../../../.env.local, process.exit), no route/cron references; no readers of goalie_page_weeks/goalie_page_stats/league_averages_goalies in web/ or functions/
  - Consumers: none found reading these tables in web/ or functions/
- **Audit context:**
  - Intent (Opus): web/lib/supabase/GoaliePage/goaliePageWeeks.js:14-17 ('Week 1: Season start to the first Sunday. Weeks 2+: Monday to Sunday')
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: none listed
- **Leads (not audited):**
  - (opus) updateWeeklyData.ts:16-17 console.logs the Supabase URL and the service-role key value
  - (opus) per-goalie time_on_ice written raw (likely seconds) vs averages in minutes; goalie.team is read but NHL summary rows expose teamAbbrevs
  - (opus) standalone script with no readers of its output tables - likely dead

## M-UST-054 NHL Edge metric ingestion and snapshot freshness gate

- **Match:** Opus only; Opus UST-036; Codex —
- **Purpose:** Map NHL Edge payloads (speeds, distances, zone time, shot location, goalie Edge stats) into daily metric rows and gate feature use on snapshot age.
- **Where:** `web/lib/NHL/edgeIngestion.ts:393 (edgeMeasure)`; `web/lib/NHL/edgeIngestion.ts:421 (edgeStatTriple)`; `web/lib/NHL/edgeIngestion.ts:744 (buildEdgeSkaterMetricRow)`; `web/lib/NHL/edgeIngestion.ts:816 (buildEdgeTeamMetricRow)`; `web/lib/NHL/edgeIngestion.ts:901 (buildEdgeGoalieMetricRow)`; `web/lib/NHL/edgeIngestion.ts:993 (buildEdgeSkaterSkatingDistanceGameRows)`; `web/lib/NHL/edgeFeatureContract.ts:245 (validateNhlEdgeSnapshotFreshness)`
- **Tags (heuristic):** generation: current
- **Opus view (UST-036):**
  - Method: Pass-through mapping: values copied as given (mph & kph, miles & km, NHL-computed percentile and league average); integers truncated with Math.trunc; no in-house derivation. Freshness: ageDays = floor((asOf - snapshot)/86,400,000); fail if missing, snapshot after asOf, or ageDays > 14 (default maxAgeDays).
  - Inputs/units: NHL Edge payload: speeds mph and kph, distances miles and km, NHL-published percentile (scale not declared), zone time pct as published, shooting pct by area as published; dates YYYY-MM-DD; sources: NHL Edge API (api-web.nhle.com /edge/*), nhl_edge_stats raw rows
  - Output scale: pass-through values; freshness ageDays integer, passed boolean (max 14 days); writes: nhl_edge_skater_metrics_daily, nhl_edge_team_metrics_daily, nhl_edge_goalie_metrics_daily, Edge detail / shot-location / skating-distance tables
  - Status: live — buildEdge*Row used by web/pages/api/v1/db/update-nhl-edge-stats.ts and update-nhl-edge-teams.ts (route runner registry web/lib/routeRunner/registry.ts); freshness gate used by buildNhlEdgeFeatureJoinPlan
  - Consumers: analytics.vw_nhl_edge_latest_* views; Edge feature join plan (buildNhlEdgeFeatureJoinPlan)
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED (no intent comment for units/percentile scale; contract shape defined in web/lib/NHL/edgeFeatureContract.ts:45-136)
  - External references: NHL Edge definitions (NHL.com); percentile scale as published by NHL Edge
  - Fixtures/test data: `web/lib/NHL/edgeIngestion.test.ts (inline Edge payload samples)`
  - Tests: `web/__tests__/pages/api/v1/db/update-nhl-edge-stats.test.ts`; `web/lib/NHL/edgeFeatureContract.test.ts`; `web/lib/NHL/edgeIngestion.test.ts`
- **Leads (not audited):**
  - (opus) NHL-provided percentile and zone-pct values are stored without unit normalization (0-1 vs 0-100 not declared)
  - (opus) 14-day staleness tolerance is a hard-coded default

## M-UST-055 Declared percent units and ratio helpers

- **Match:** Opus only; Opus UST-037; Codex —
- **Purpose:** Convert declared-unit percentages to fractions and compute exposure-correct ratios/shares.
- **Where:** `web/lib/stats/percentUnits.ts:12 (toFraction)`; `web/lib/stats/percentUnits.ts:30 (ratio)`; `web/lib/stats/percentUnits.ts:40 (sumField)`; `web/lib/stats/percentUnits.ts:54 (shareOfSums)`
- **Tags (heuristic):** percent scale: fraction 0-1; generation: current
- **Opus view (UST-037):**
  - Method: toFraction: percentagePoints/100, fraction unchanged, non-finite -> null. ratio: null if either side non-finite or denominator <= 0. sumField: null for empty set or any missing value. shareOfSums = for/(for+against).
  - Inputs/units: explicit unit tag: 'fraction' (0-1) or 'percentagePoints' (0-100); sources: —
  - Output scale: fraction 0-1; ratios; sums; writes: —
  - Status: live — imported by components/TeamDashboard/TeamDashboard.tsx, AdvancedL10Metrics.tsx, GameStateAnalysis/GameStateAnalysis.tsx
  - Consumers: web/components/TeamDashboard/TeamDashboard.tsx; web/components/TeamDashboard/AdvancedL10Metrics.tsx; web/components/GameStateAnalysis/GameStateAnalysis.tsx
- **Audit context:**
  - Intent (Opus): web/lib/stats/percentUnits.ts:1-4 ('callers must say which unit a source field uses; magnitude is never used to guess')
  - External references: Ratio-of-sums aggregation convention
  - Fixtures/test data: `web/lib/stats/percentUnits.test.ts`
  - Tests: `web/lib/stats/percentUnits.test.ts`
- **Leads (not audited):**
  - (opus) sumField returns null if any single row is missing, so one gap nulls the whole aggregate (strict, may hide data)

## M-UST-056 Expanded-row chart rolling 5/10 and season averages

- **Match:** Opus only; Opus UST-038; Codex —
- **Purpose:** Overlay rolling and season averages on the per-game chart.
- **Where:** `web/components/underlying-stats/PlayerStatsExpandedRowChart.tsx:146 (seasonAverage)`; `web/components/underlying-stats/PlayerStatsExpandedRowChart.tsx:412 (calculateRollingAverage)`; `web/components/underlying-stats/PlayerStatsExpandedRowChart.tsx:429 (calculateAverage)`
- **Tags (heuristic):** denominators: per 60, per game; generation: current
- **Opus view (UST-038):**
  - Method: Rolling window of last 5 and last 10 games (trailing, includes current game, partial windows at start), simple unweighted mean of non-null values; season average = simple mean of all per-game values.
  - Inputs/units: per-game metric values (fractions 0-1, per-60, counts, seconds); sources: —
  - Output scale: simple means in the metric's own units; writes: —
  - Status: live — read by pages/api/v1/underlying-stats/players.ts and goalies.ts (+[playerId], chart) for /underlying-stats/playerStats and /goalieStats; summaries written by pages/api/v1/db/update-player-underlying-stats.ts, which runs from the lineCombinations insert trigger (supabase/migrations/20260716112910_harden_line_combination_trigger_auth.sql:130) and the pg_cron job 'update-player-underlying-stats-yesterday' at 09:35 UTC (tasks/TASKS/cron-operations/cron-schedule.md:382,827) (rendered by pages/underlying-stats/playerStats/index.tsx:1348)
  - Consumers: player/goalie landing expanded rows
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: Ratio-of-sums (TOI- or attempt-weighted) rolling convention
  - Fixtures/test data: none listed
  - Tests: `web/components/underlying-stats/PlayerStatsExpandedRowChart.test.tsx (renders chart; no rolling-average assertion found)`
- **Leads (not audited):**
  - (opus) mean-of-ratios — averages per-game percentages and per-60 rates unweighted by TOI/attempts, so the chart 'season average' will not equal the table value for the same metric
  - (opus) partial windows (first 4 games for L5) are shown as if full-window values

## M-UST-057 Entity ratings overlay (latest rating snapshot)

- **Match:** Opus only; Opus UST-039; Codex —
- **Purpose:** Attach offensive/defensive/goalie 0-100 ratings, league rank and percentile to landing rows.
- **Where:** `web/lib/underlying-stats/entityRatingsOverlay.ts:49 (pickLatestByPlayerId)`; `web/lib/underlying-stats/entityRatingsOverlay.ts:144 (overlayEntityRatingsOnLandingResponse)`
- **Tags (heuristic):** percent scale: 0-100; generation: legacy
- **Opus view (UST-039):**
  - Method: Fetch all snapshots for the page's players ordered by snapshot_date desc; keep the max snapshot_date per player; copy rating_0_to_100, league_rank, percentile.
  - Inputs/units: rating_0_to_100, league_rank, percentile (as stored); sources: skater_offensive_ratings_daily, skater_defensive_ratings_daily, goalie_ratings_daily
  - Output scale: 0-100 rating; rank 1..N; percentile as stored; writes: —
  - Status: legacy/dead — no non-test caller of overlayEntityRatingsOnLandingResponse found (rg over web/pages, components, lib, scripts)
  - Consumers: none found (no non-test import of overlayEntityRatingsOnLandingResponse)
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: none listed
- **Leads (not audited):**
  - (opus) always the latest snapshot regardless of the table's season/date filter — historical-season tables show current ratings
  - (opus) unpaged .in() query over full daily history may hit the PostgREST row cap (default 1000) and drop players' latest rows
  - (opus) dead code — the overlay is never called, so landing rows carry no rating columns from it

## M-UST-058 Native NST-parity game build per score state

- **Match:** Opus only; Opus UST-040; Codex —
- **Purpose:** Build per-game skater/goalie counts and shot features from PBP + shifts for every score state used in summary partitions.
- **Where:** `web/lib/underlying-stats/playerStatsLandingServer.ts:1066 (buildPlayerStatsNativeGameParity)`; `web/lib/underlying-stats/playerStatsLandingServer.ts:1585 (buildPlayerStatsLandingParityByGame)`; `web/lib/underlying-stats/playerStatsLandingServer.ts:3775 (buildPlayerStatsGameSummaryRows)`
- **Tags (heuristic):** denominators: per game, 5v5 only; generation: current
- **Opus view (UST-040):**
  - Method: Wraps lib/supabase/Upserts/nhlShotFeatureBuilder.buildShotFeatureRows and nhlNstParityMetrics.buildNstParityMetrics. Summary build loops 7 score states (allScores, tied, leading, trailing, withinOne, upOne, downOne) x 10 strengths (all, EV, 5v5, PP, PK, 5v4 PP, 4v5 PK, 3v3, withEmptyNet, againstEmptyNet) x modes (individual counts/rates, onIce, goalies) and stores one summary row per player-game-split.
  - Inputs/units: PBP events, shift rows (seconds), situation codes; sources: games, nhl_api_pbp_events, nhl_api_shift_rows, nhl_api_game_roster_spots, nhl_api_game_payloads_raw (endpoint=landing), players, teams
  - Output scale: per-game count rows (integers; TOI seconds; xG goals); writes: nhl_api_game_payloads_raw (derived://underlying-player-summary-v2/... partitions), goalie_underlying_summary_partitions (copied by goalieStatsSummaryRefresh.ts)
  - Status: live — read by pages/api/v1/underlying-stats/players.ts and goalies.ts (+[playerId], chart) for /underlying-stats/playerStats and /goalieStats; summaries written by pages/api/v1/db/update-player-underlying-stats.ts, which runs from the lineCombinations insert trigger (supabase/migrations/20260716112910_harden_line_combination_trigger_auth.sql:130) and the pg_cron job 'update-player-underlying-stats-yesterday' at 09:35 UTC (tasks/TASKS/cron-operations/cron-schedule.md:382,827)
  - Consumers: pages/api/v1/underlying-stats/players.ts; pages/api/v1/underlying-stats/players/[playerId].ts; pages/api/v1/underlying-stats/players/[playerId]/chart.ts; pages/api/v1/underlying-stats/goalies.ts; pages/api/v1/underlying-stats/goalies/[playerId].ts; pages/api/v1/db/update-player-underlying-stats.ts
- **Audit context:**
  - Intent (Opus): tasks/TASKS/xg-model/docs/final-implementation-summary.md (NST-parity foundation section, line 76); tasks/TASKS/three-pillars-analytics/underlying-stats/prd/prd-player-underlying-stats-landing-page.md:34 'parity-backed stat surfaces'
  - External references: Natural Stat Trick game-level counts (parity target)
  - Fixtures/test data: `web/lib/underlying-stats/playerStatsLandingServer.test.ts:2209-2548 stored games/events/shifts fixtures`; `web/__tests__/fixtures/nst/oct1-identity-source.json (NST reference sample, not slice-specific)`
  - Tests: `web/lib/underlying-stats/playerStatsLandingServer.test.ts:2208 (buildPlayerStatsNativeGameParity)`; `web/lib/underlying-stats/playerStatsLandingServer.test.ts:932 (summary partitions by scoreState)`; `web/lib/underlying-stats/playerStatsSummaryRefresh.test.ts`
- **Leads (not audited):**
  - (opus) the actual count/xG formulas live in nhlNstParityMetrics.ts (outside this slice); this layer only selects splits
  - (opus) individual 'rates' support is decided by whether the rates-state context exists (supportedDisplayModes), so counts and rates can come from different eligibility rules

## M-UST-059 Score-state classifier (score differential before event)

- **Match:** Opus only; Opus UST-041; Codex —
- **Purpose:** Bucket events/shots/segments into tied, leading, trailing, withinOne, upOne, downOne.
- **Where:** `web/lib/underlying-stats/playerStatsLandingServer.ts:1722 (getTeamScoreDiffBucket)`; `web/lib/underlying-stats/playerStatsLandingServer.ts:1738 (matchesPlayerStatsScoreState)`; `web/lib/underlying-stats/playerStatsLandingServer.ts:1835 (getTeamScoreDiffBeforeEvent)`; `web/lib/underlying-stats/teamStatsSummaryRefresh.ts:349 (getTeamScoreDiffBucket, duplicate)`; `web/lib/underlying-stats/teamStatsSummaryRefresh.ts:365 (matchesTeamScoreState)`; `web/lib/underlying-stats/teamStatsSummaryRefresh.ts:525 (resolveTeamScoreDiffForShot)`
- **Tags (heuristic):** generation: current
- **Opus view (UST-041):**
  - Method: diff = team score - opponent score before the event (goal events subtract the scoring goal). 0=tied, +1=upOne, -1=downOne, >=+2 'leading', <=-2 'trailing'; withinOne = \|diff\|<=1; allScores matches everything; null diff fails non-all states.
  - Inputs/units: goals (integers); sources: nhl_api_pbp_events
  - Output scale: bucket label / boolean; writes: —
  - Status: live — read by pages/api/v1/underlying-stats/players.ts and goalies.ts (+[playerId], chart) for /underlying-stats/playerStats and /goalieStats; summaries written by pages/api/v1/db/update-player-underlying-stats.ts, which runs from the lineCombinations insert trigger (supabase/migrations/20260716112910_harden_line_combination_trigger_auth.sql:130) and the pg_cron job 'update-player-underlying-stats-yesterday' at 09:35 UTC (tasks/TASKS/cron-operations/cron-schedule.md:382,827); live — team_underlying_stats_summary written by pages/api/v1/db/update-player-underlying-stats.ts:242 and sweep-gamecenter-normalization.ts:352 (plus manual catch-up/backfill/rebuild routes); read by pages/api/v1/underlying-stats/teams.ts for /underlying-stats/teamStats
  - Consumers: summary partition builder; team summary refresh
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED (score-state options listed in tasks/TASKS/three-pillars-analytics/underlying-stats/prd/prd-player-underlying-stats-landing-page.md; 'leading' = +2 or more not stated)
  - External references: NST score-state filters (Leading/Trailing/Tied/Within 1)
  - Fixtures/test data: none listed
  - Tests: `web/lib/underlying-stats/playerStatsLandingServer.test.ts:809 (legacy rows default to allScores)`
- **Leads (not audited):**
  - (opus) 'leading'/'trailing' here mean lead/deficit of 2+ only (upOne/downOne excluded), unlike NST where Leading includes up-1; users may compare against NST 'Leading' and see mismatches

## M-UST-060 Team-relative strength-state classifier (shift/shot based)

- **Match:** Opus only; Opus UST-042; Codex —
- **Purpose:** Decide whether a shot/segment belongs to a requested strength split for a given team.
- **Where:** `web/lib/underlying-stats/playerStatsLandingServer.ts:1757 (matchesPlayerStatsStrengthForTeam)`; `web/lib/underlying-stats/playerStatsLandingServer.ts:1644 (resolveSkaterSplitKey)`; `web/lib/underlying-stats/playerStatsLandingServer.ts:1666 (resolveGoalieSplitKey)`; `web/lib/underlying-stats/playerStatsLandingServer.ts:1708 (parseStrengthExactCounts)`; `web/lib/underlying-stats/teamStatsSummaryRefresh.ts:384 (matchesTeamStrength, duplicate)`; `web/lib/underlying-stats/teamStatsSummaryRefresh.ts:334 (parseStrengthExactCounts, duplicate)`
- **Tags (heuristic):** denominators: 5v5 only; generation: current
- **Opus view (UST-042):**
  - Method: EV = teamSkaters == opponentSkaters (no goalie check); 5v5 = both goalies in and 5 vs 5; PP = teamSkaters > oppSkaters; PK = teamSkaters < oppSkaters; 5v4PP/4v5PK/3v3 require both goalies in; withEmptyNet = own goalie pulled; againstEmptyNet = opponent goalie pulled. Skater split keys collapse 5v4PP/4v5PK/3v3/EN strengths to 'pk' for skaters (resolveSkaterSplitKey falls through to 'pk').
  - Inputs/units: skater counts (integers), goalie-on-ice booleans; sources: derived shot features
  - Output scale: boolean match / split key; writes: —
  - Status: live — read by pages/api/v1/underlying-stats/players.ts and goalies.ts (+[playerId], chart) for /underlying-stats/playerStats and /goalieStats; summaries written by pages/api/v1/db/update-player-underlying-stats.ts, which runs from the lineCombinations insert trigger (supabase/migrations/20260716112910_harden_line_combination_trigger_auth.sql:130) and the pg_cron job 'update-player-underlying-stats-yesterday' at 09:35 UTC (tasks/TASKS/cron-operations/cron-schedule.md:382,827) and live — team_underlying_stats_summary written by pages/api/v1/db/update-player-underlying-stats.ts:242 and sweep-gamecenter-normalization.ts:352 (plus manual catch-up/backfill/rebuild routes); read by pages/api/v1/underlying-stats/teams.ts for /underlying-stats/teamStats
  - Consumers: filterGoalieShotFeaturesForState; accumulateTeamShotMetrics; accumulateTeamToiSeconds
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED (strength list in tasks/TASKS/three-pillars-analytics/underlying-stats/prd/prd-player-underlying-stats-landing-page.md filters section; no definition of EV/PP with empty net)
  - External references: NST situation definitions (5v5 excludes empty net; PP/PK by manpower advantage)
  - Fixtures/test data: none listed
  - Tests: none listed
- **Leads (not audited):**
  - (opus) observation, not audited (strong): resolveSkaterSplitKey (playerStatsLandingServer.ts:1644) returns 'pk' for fiveOnFourPP, fourOnFivePK, threeOnThree, withEmptyNet and againstEmptyNet even though nhlNstParityMetrics builds all 10 skater split keys (nhlNstParityMetrics.ts:1869-1880); skater individual/on-ice summary rows for 5v4 PP, 3v3 and empty-net strengths are therefore built from PK data but labelled with the requested strength (goalie mapping resolveGoalieSplitKey is complete)
  - (opus) PP/PK by raw skater count means a 6v5 extra-attacker situation counts as PP for the trailing team and PK for the leading team; EV includes 4v4/3v3 and empty-net equal-skater states
  - (opus) logic duplicated verbatim in teamStatsSummaryRefresh.ts — drift risk

