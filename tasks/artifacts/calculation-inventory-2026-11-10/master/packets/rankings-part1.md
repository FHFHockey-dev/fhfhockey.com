# Audit packet: Rankings (part 1 of 2)

Master entries M-RNK-001 to M-RNK-060 (60 of 65 in this family). Built from the merged Opus and Codex inventories; see [../MASTER.md](../MASTER.md) and [../MERGE-NOTES.md](../MERGE-NOTES.md).

How to read: each entry gives both inventories' descriptions side by side. **Conflicts** are places where the two descriptions disagree; they are unresolved. **Leads** are Opus red flags and Codex unknowns: observations to check, not audited findings. Tags are keyword heuristics. Line numbers were valid when each inventory was written on 2026-11-10 (Opus at d31dcb33f, Codex at 11e4192d3); re-check against the current checkout.

| ID | Name | Match | Conflicts | Leads |
|---|---|---|---:|---:|
| M-RNK-001 | Contextual metric raw value + direction normalization | Both | 0 | 3 |
| M-RNK-002 | Peer-group sample gating & sample confidence | Both | 0 | 3 |
| M-RNK-003 | Contextual ranking percentile & dense rank (rankNormalizedMetricValue… | Both | 0 | 3 |
| M-RNK-004 | Team style profile (xGF%, shot quality, event rate, pace/control axes… | Both | 0 | 4 |
| M-RNK-005 | Team luck components (finishing, save, net GAx) | Both | 0 | 3 |
| M-RNK-006 | Team game context components (1-goal rate, home/road gap, PP opp/G, P… | Both | 0 | 3 |
| M-RNK-007 | QoT / QoC (quality of teammates / competition) features | Both | 0 | 5 |
| M-RNK-008 | Deployment tier bucket summaries | Both | 0 | 5 |
| M-RNK-009 | Deployment bucket assignment (EV line/pair, PP unit, PK tier) | Both | 0 | 4 |
| M-RNK-010 | Team unit-usage indices (forward top load, pair top load, PP1+PP2 sha… | Both | 0 | 3 |
| M-RNK-011 | Goalie value signal (avg of GSAx and GSAA) | Both | 0 | 3 |
| M-RNK-012 | Goalie relative SV% (vs same-team other goalies) | Both | 0 | 3 |
| M-RNK-013 | Goalie window aggregation (SV%, 5v5 GSAx, GSAA/60, xGA/shot, HD SV%) | Both | 0 | 5 |
| M-RNK-014 | Goalie quality start / really bad start / steal game classification | Both | 0 | 4 |
| M-RNK-015 | Goalie role / start-share buckets and adjusted core netshare | Both | 0 | 5 |
| M-RNK-016 | Results Luck Index (non-overlapping rate version with peer blend shri… | Both | 0 | 4 |
| M-RNK-017 | Results Luck Index (component-aware, written) | Both | 0 | 7 |
| M-RNK-018 | Offense Rating (skater composite) | Both | 0 | 5 |
| M-RNK-019 | Defense Rating / Defensive Impact in Context (skater composite) | Both | 0 | 4 |
| M-RNK-020 | MCM Score (multi-category fantasy composite) | Both | 0 | 5 |
| M-RNK-021 | BEAST tier classification | Both | 0 | 5 |
| M-RNK-022 | Skater archetype scores & tags (shoot-first, pass-first, play-driver) | Both | 0 | 3 |
| M-RNK-023 | xG denominator semantics helpers (xS%, SAX%, team shot quality, goali… | Both | 0 | 4 |
| M-RNK-024 | Trending percentile deltas, trend score & opportunity signals | Both | 0 | 4 |
| M-RNK-025 | WAR surface (placeholder, no calculation) | Both | 0 | 3 |
| M-RNK-026 | Season-decayed player impact priors | Both | 0 | 4 |
| M-RNK-027 | Player impact ratings (skater offense/defense, goalie) — z-score comp… | Both | 0 | 9 |
| M-RNK-028 | Player percentile rank across skaters (avg stats) | Opus only | 0 | 4 |
| M-RNK-029 | Legacy /api/v1/rankings start-chart scaffold | Opus only | 0 | 1 |
| M-RNK-030 | Skater contextual metric catalogue (per-60 rates, shares, regression … | Opus only | 0 | 4 |
| M-RNK-031 | Player matrix composite cells & composite-sort ranking | Opus only | 0 | 4 |
| M-RNK-032 | Player matrix all-strengths TOI per game | Opus only | 0 | 1 |
| M-RNK-033 | Team matrix ranking (power-rating passthrough + percentiles) | Opus only | 0 | 3 |
| M-RNK-034 | Team unit TOI builder (5v5 lines/pairs and PP units, pooled player-se… | Opus only | 0 | 3 |
| M-RNK-035 | Goalie matrix sample gate, confidence and ranking | Opus only | 0 | 2 |
| M-RNK-036 | Skater composite source population & coverage gate | Opus only | 0 | 3 |
| M-RNK-037 | Skater composite publication gate & population re-check | Opus only | 0 | 2 |
| M-RNK-038 | Rankings UI score tones and snapshot strengths/weak spots | Opus only | 0 | 1 |
| M-RNK-039 | Entity metric rankings snapshot writer/reader (persisted percentiles,… | Opus only | 0 | 2 |
| M-RNK-040 | Window-scaled minimum GP defaults (min GP by window, comparison-windo… | Opus only | 0 | 3 |
| M-RNK-041 | Skater window aggregation from rolling rows (per-60 / derived metrics) | Opus only | 0 | 3 |
| M-RNK-042 | Last-N window games-played / TOI resolution | Opus only | 0 | 2 |
| M-RNK-043 | Rankings splits (strength/window/deployment comparisons) | Opus only | 0 | 1 |
| M-RNK-044 | Team-vs-opponent splits (skater/goalie aggregates, PP share, QS) | Opus only | 0 | 2 |
| M-RNK-045 | Adjusted-impact promotion readiness gate | Opus only | 0 | 1 |
| M-RNK-046 | Assists/60 | Codex only | 0 | 1 |
| M-RNK-047 | Blocks/60 | Codex only | 0 | 1 |
| M-RNK-048 | xS% | Codex only | 0 | 1 |
| M-RNK-049 | Goals Above Expected | Codex only | 0 | 1 |
| M-RNK-050 | Goals/60 | Codex only | 0 | 1 |
| M-RNK-051 | Hits/60 | Codex only | 0 | 1 |
| M-RNK-052 | Individual xG/60 | Codex only | 0 | 1 |
| M-RNK-053 | On-ice GF% | Codex only | 0 | 1 |
| M-RNK-054 | On-ice xGF% | Codex only | 0 | 1 |
| M-RNK-055 | Penalties Taken/60 | Codex only | 0 | 1 |
| M-RNK-056 | Points/60 | Codex only | 0 | 1 |
| M-RNK-057 | Power-play Points/60 | Codex only | 0 | 1 |
| M-RNK-058 | Primary Assists/60 | Codex only | 0 | 1 |
| M-RNK-059 | Relative 5v5 GF% | Codex only | 0 | 1 |
| M-RNK-060 | Relative 5v5 xGF% | Codex only | 0 | 1 |

## M-RNK-001 Contextual metric raw value + direction normalization

- **Match:** Both; Opus RNK-006; Codex RANK-CORE
- **Purpose:** Compute a candidate's raw metric value when only numerator/denominator are supplied and flip lower-is-better metrics before ranking.
- **Where:** `web/lib/rankings/rankingCalculator.ts:144 (calculateMetricRawValue)`; `web/lib/rankings/rankingCalculator.ts:167 (normalizeMetricValue)`; `web/lib/rankings/rankingCalculator.ts:84 rankNormalizedMetricValues`; `web/lib/rankings/rankingCalculator.ts:144 calculateMetricRawValue`; `web/lib/rankings/rankingCalculator.ts:208 getSampleConfidence`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: per 60; generation: current
- **Opus view (RNK-006):**
  - Method: If rawValue finite use it; else if denominator>0: rate stats = numerator/denominator*3600 (per-60 from seconds), others = numerator/denominator (ratio, NOT x100). Normalized = -raw when higherIsBetter=false.
  - Inputs/units: numerator count, denominator TOI seconds (rate) or count; sources: —
  - Output scale: per-60 rate or 0-1 ratio; sign-flipped for lower-is-better; writes: —
  - Status: live — called by buildContextualRankingRows
  - Consumers: buildContextualRankingRows
- **Codex view (RANK-CORE, calculation, location; Codex family 'Contextual skater rankings'):** Dense ranking, tie-aware percentile and sample confidence
  - Purpose: Convert valid direction-normalized values into peer comparison scores.
  - Inputs/units: Raw values or numerator/TOI seconds, directionality, qualified peer cohort, GP/TOI minimums.
  - Output scale: Dense rank; percentile 100×strictly-worse/(N−1), sole peer=100; low/medium/high sample confidence.
  - Version/status: contextual_rankings_v1. Production deployment/active database state not checked.
- **Audit context:**
  - Intent (Opus): metricDefinitions formulaDescription per metric (web/lib/rankings/metricDefinitions.ts:202 et seq.)
  - Intended contract (Codex RANK-CORE): Explicit ranking function; lower-is-better sign flip. Confidence uses smallest sample-to-minimum multiple.
  - External references: NST per-60 convention (count / TOI minutes * 60)
  - Fixtures/test data: `web/lib/rankings/fixtures/rankingsTrust.json`
  - Tests: `web/lib/rankings/rankingCalculator.lowerIsBetter.test.ts`; `web/lib/rankings/rankingCalculator.test.ts`
- **Leads (not audited):**
  - (opus) non-rate fallback returns a 0-1 ratio while the same metrics' primary path (skaterWindowAggregation percent()) returns 0-100; unit mismatch only if rawValue is ever missing
  - (opus) results_luck_index is defined higherIsBetter=false, so ranking inverts 'luckier' to lower percentile
  - (codex:RANK-CORE) No mathematical accuracy or fitness assessment performed. Tests listed, not run.

## M-RNK-002 Peer-group sample gating & sample confidence

- **Match:** Both; Opus RNK-007; Codex RANK-CORE
- **Purpose:** Decide which skaters qualify for ranking and label sample confidence.
- **Where:** `web/lib/rankings/rankingCalculator.ts:195 (sampleMeetsMinimums)`; `web/lib/rankings/rankingCalculator.ts:208 (getSampleConfidence)`; `web/lib/rankings/rankingCalculator.ts:265 (buildContextualRankingRows)`; `web/lib/rankings/rankingCalculator.ts:84 rankNormalizedMetricValues`; `web/lib/rankings/rankingCalculator.ts:144 calculateMetricRawValue`; `web/lib/rankings/rankingCalculator.ts:208 getSampleConfidence`
- **Tags (heuristic):** denominators: per 60; generation: current
- **Opus view (RNK-007):**
  - Method: Qualified if GP>=minGp and TOI>=minToi (defaults from metric definition, typically minGp 1, minToi 300s; 600s for xGA/60, xS%, SAX%, GAx, on-ice shares; 1200s for luck/relative; 120s for PP points/60). sampleMultiple = min(GP/minGp, TOI/minToi): >=2 high, >=1 medium, else low. Peer groups with <3 qualified get 'small_peer_group' warning (still ranked).
  - Inputs/units: GP count, TOI seconds; sources: —
  - Output scale: boolean + low/medium/high; writes: —
  - Status: live — every contextual ranking surface
  - Consumers: rankingQueries; deploymentTiers; skaterCompositeWriter; entityMetricRankingWriter
- **Codex view (RANK-CORE, calculation, location; Codex family 'Contextual skater rankings'):** Dense ranking, tie-aware percentile and sample confidence
  - Purpose: Convert valid direction-normalized values into peer comparison scores.
  - Inputs/units: Raw values or numerator/TOI seconds, directionality, qualified peer cohort, GP/TOI minimums.
  - Output scale: Dense rank; percentile 100×strictly-worse/(N−1), sole peer=100; low/medium/high sample confidence.
  - Version/status: contextual_rankings_v1. Production deployment/active database state not checked.
- **Audit context:**
  - Intent (Opus): metricDefinitions sampleRequirements (web/lib/rankings/metricDefinitions.ts:179); PRD tasks/TASKS/contextual-hockey-rankings/prd-contextual-hockey-rankings.md
  - Intended contract (Codex RANK-CORE): Explicit ranking function; lower-is-better sign flip. Confidence uses smallest sample-to-minimum multiple.
  - External references: NST-style minimum TOI filters (e.g. 5v5 TOI cutoffs); Tango reliability-based thresholds
  - Fixtures/test data: `web/lib/rankings/fixtures/rankingsTrust.json`
  - Tests: `web/lib/rankings/metricDefinitions.test.ts`; `web/lib/rankings/rankingCalculator.test.ts`
- **Leads (not audited):**
  - (opus) minimum TOI of 300s (5 min) and minGp 1 are very low for per-60 percentiles; small samples dominate tails
  - (opus) peer groups of 1-2 still receive percentiles (N=1 -> 100)
  - (codex:RANK-CORE) No mathematical accuracy or fitness assessment performed. Tests listed, not run.

## M-RNK-003 Contextual ranking percentile & dense rank (rankNormalizedMetricValues)

- **Match:** Both; Opus RNK-008; Codex RANK-CORE
- **Purpose:** Shared rank/percentile convention for every contextual ranking surface (skater metrics, matrices, deployment tiers, entity_metric_rankings).
- **Where:** `web/lib/rankings/rankingCalculator.ts:84 (rankNormalizedMetricValues)`; `web/lib/rankings/rankingCalculator.ts:231 (rankQualifiedRows)`; `web/lib/rankings/rankingCalculator.ts:84 rankNormalizedMetricValues`; `web/lib/rankings/rankingCalculator.ts:144 calculateMetricRawValue`; `web/lib/rankings/rankingCalculator.ts:208 getSampleConfidence`
- **Tags (heuristic):** percent scale: 0-100; generation: current
- **Opus view (RNK-008):**
  - Method: Drop non-finite values; sort desc by normalized value (ties by id). Dense rank (ties share rank, next distinct value rank+1). Percentile = 100 * (count of strictly worse qualified peers) / (N-1), rounded to 3 dp; N==1 -> 100. Ties share percentile.
  - Inputs/units: direction-adjusted metric value (any unit); sources: —
  - Output scale: rank 1..N (dense); percentile 0-100; writes: —
  - Status: live — used by /api/v1/contextual-rankings*, matrices, update-entity-metric-rankings, update-skater-composite-ratings
  - Consumers: buildContextualRankingRows; teamMatrix.ts; playerMatrix.ts; goalieMatrix.ts; entityMetricRankingReader.ts; deploymentTiers.ts; skaterCompositeWriter metricPercentilesMatchPopulation (re-derives the same convention)
- **Codex view (RANK-CORE, calculation, location; Codex family 'Contextual skater rankings'):** Dense ranking, tie-aware percentile and sample confidence
  - Purpose: Convert valid direction-normalized values into peer comparison scores.
  - Inputs/units: Raw values or numerator/TOI seconds, directionality, qualified peer cohort, GP/TOI minimums.
  - Output scale: Dense rank; percentile 100×strictly-worse/(N−1), sole peer=100; low/medium/high sample confidence.
  - Version/status: contextual_rankings_v1. Production deployment/active database state not checked.
- **Audit context:**
  - Intent (Opus): MCM_SCORE_CONTRACT.percentileConvention: '100 * strictly worse qualified peers / (qualified peers - 1); tied values receive the same percentile' (web/lib/rankings/skaterCompositeMethodology.ts:82); PRD tasks/TASKS/contextual-hockey-rankings/prd-contextual-hockey-rankings.md
  - Intended contract (Codex RANK-CORE): Explicit ranking function; lower-is-better sign flip. Confidence uses smallest sample-to-minimum multiple.
  - External references: Standard percentile rank (exclusive, (#below)/(N-1)); compare to mid-rank convention (#below + 0.5*#ties)/N used by NST/HockeyViz-style percentile cards.
  - Fixtures/test data: `web/lib/rankings/fixtures/rankingsTrust.json`
  - Tests: `web/__tests__/pages/api/v1/contextual-rankings.test.ts`; `web/lib/rankings/rankingCalculator.lowerIsBetter.test.ts`; `web/lib/rankings/rankingCalculator.test.ts`
- **Leads (not audited):**
  - (opus) dense ranking (1,1,2) instead of competition ranking (1,1,3) means rank and 'of N' text can understate distance
  - (opus) strictly-worse/(N-1) convention gives tied-at-bottom 0 and tied-at-top <100 when ties exist; not mid-rank
  - (codex:RANK-CORE) No mathematical accuracy or fitness assessment performed. Tests listed, not run.

## M-RNK-004 Team style profile (xGF%, shot quality, event rate, pace/control axes, style badge)

- **Match:** Both; Opus RNK-010; Codex TEAM-STYLE
- **Purpose:** Raw 5v5 team style descriptors and a run-and-gun badge for the team matrix.
- **Where:** `web/lib/rankings/teamStyleMethodology.ts:120 (calculateTeamExpectedGoalsForPercentage)`; `web/lib/rankings/teamStyleMethodology.ts:142 (calculateRunAndGunProfile)`; `web/lib/rankings/teamMatrix.ts:687 (deriveStyleBadge)`; `web/lib/rankings/teamMatrix.ts:1062 (buildStylePayload)`; `web/lib/rankings/teamMatrix.ts:1444 (league average event rate)`; `web/lib/rankings/teamStyleMethodology.ts:120 calculateTeamExpectedGoalsForPercentage`; `web/lib/rankings/teamStyleMethodology.ts:132 calculateTeamShotQuality`; `web/lib/rankings/teamStyleMethodology.ts:142 calculateRunAndGunProfile`
- **Tags (heuristic):** percent scale: 0-100; denominators: per 60, per game, 5v5 only, unblocked attempts; generation: current
- **Opus view (RNK-010):**
  - Method: xGF% = xGF/(xGF+xGA)*100; shot quality = xGF/FF; eventRate = (xGF+xGA)/games (per game, not per 60); league avg = unweighted mean of team event rates; pace: >=1.1x league avg high_event, <=0.9x low_event; control: xGF%>=55 controls_play, <=45 chasing_play. Badge combines axes.
  - Inputs/units: 5v5 season-to-date xG totals, FF counts, games; sources: team_underlying_stats_summary (fiveOnFive, allScores), nst_team_5v5 (fallback)
  - Output scale: xGF% 0-100; xG per FF; xG per game; categorical axes; writes: —
  - Status: live — team matrix route /api/v1/contextual-rankings matrix (teams)
  - Consumers: TeamMatrixTable.tsx; /api/v1 team matrix route
- **Codex view (TEAM-STYLE, calculation, location; Codex family 'Team rankings'):** Team xGF%, shot quality, pace/control and run-and-gun profile
  - Purpose: Describe team shot-process style with separate event and control axes.
  - Inputs/units: xGF/xGA expected goals, Fenwick attempts, games count, league event baseline.
  - Output scale: xGF%=100*xGF/(xGF+xGA); quality=xGF/FF; event rate=(xGF+xGA)/GP; pace/control categorical axes.
  - Version/status: team_rankings_v2_season_5v5_asof. Production deployment/active database state not checked.
- **Audit context:**
  - Intent (Opus): TEAM_STYLE_SOURCE_CONTRACT web/lib/rankings/teamStyleMethodology.ts:35-58
  - Intended contract (Codex TEAM-STYLE): TEAM_STYLE_SOURCE_CONTRACT explicitly raw/contextual 5v5; adjusted target not yet wired.
  - External references: NST team 5v5 xGF%; score-and-venue adjusted xG (Evolving-Hockey / Micah McCurdy)
  - Fixtures/test data: none listed
  - Tests: `web/lib/rankings/teamMatrix.test.ts`; `web/lib/rankings/teamStyleMethodology.test.ts`
- **Leads (not audited):**
  - (opus) not score/venue adjusted (acknowledged in contract)
  - (opus) event rate is per game rather than per 60 5v5 minutes, so teams with more 5v5 time (fewer penalties) look higher-event
  - (opus) thresholds 1.1/0.9 and 55/45 are magic numbers
  - (codex:TEAM-STYLE) No mathematical accuracy or fitness assessment performed. Tests listed, not run.

## M-RNK-005 Team luck components (finishing, save, net GAx)

- **Match:** Both; Opus RNK-011; Codex TEAM-LUCK
- **Purpose:** Team goals vs expected goals for and against at 5v5.
- **Where:** `web/lib/rankings/teamStyleMethodology.ts:198 (calculateTeamLuckComponents)`; `web/lib/rankings/teamStyleMethodology.ts:198 calculateTeamLuckComponents`
- **Tags (heuristic):** denominators: 5v5 only; generation: current
- **Opus view (RNK-011):**
  - Method: finishingLuck = GF - xGF; saveLuck = xGA - GA; net = sum. Cumulative counts, ranked across teams.
  - Inputs/units: 5v5 goals and xG totals; sources: team_underlying_stats_summary, nst_team_5v5
  - Output scale: goals (cumulative); writes: —
  - Status: live — team matrix
  - Consumers: teamMatrix metrics finishing_luck/save_luck/net_luck
- **Codex view (TEAM-LUCK, calculation, location; Codex family 'Team rankings'):** Team finishing luck, save luck and net goals above expected
  - Purpose: Separate outcome residuals for team offense and goaltending.
  - Inputs/units: GF/GA integer goals, xGF/xGA expected goals.
  - Output scale: Finishing=GF−xGF; save=xGA−GA; net=sum, in goals.
  - Version/status: Local helper. Production deployment/active database state not checked.
- **Audit context:**
  - Intent (Opus): formulaDecisions.luck '(GF - xGF) + (xGA - GA)' web/lib/rankings/teamStyleMethodology.ts:51
  - Intended contract (Codex TEAM-LUCK): Explicit raw/contextual outcome differences.
  - External references: GSAx (team-level) / GAx; PDO
  - Fixtures/test data: none listed
  - Tests: `web/lib/rankings/teamStyleMethodology.test.ts`
- **Leads (not audited):**
  - (opus) cumulative totals not normalized per game/60 — teams with more games played rank more extreme
  - (opus) save luck conflates goaltending with skater shot-blocking/xG model error
  - (codex:TEAM-LUCK) No mathematical accuracy or fitness assessment performed. Tests listed, not run.

## M-RNK-006 Team game context components (1-goal rate, home/road gap, PP opp/G, Pen/60)

- **Match:** Both; Opus RNK-012; Codex TEAM-CONTEXT
- **Purpose:** Team game-context metrics for the team matrix.
- **Where:** `web/lib/rankings/teamStyleMethodology.ts:242 (calculateTeamGameContextComponents)`; `web/lib/rankings/teamMatrix.ts:805 (aggregateTeamGameContextRows)`; `web/lib/rankings/teamStyleMethodology.ts:242 calculateTeamGameContextComponents`
- **Tags (heuristic):** percent scale: 0-100; denominators: per 60, per game; generation: current
- **Opus view (RNK-012):**
  - Method: oneGoalGameRate = % of games with \|GF-GA\|<=1; homeRoadPointPctGap = (mean home point_pct - mean road point_pct)*100; PP opp rate and Pen/60 = unweighted mean of per-game values.
  - Inputs/units: per-game rows: goals, point_pct fraction 0-1, PP opp per game, pen per 60; sources: wgo_team_stats, games
  - Output scale: percent 0-100; point-pct gap x100; per-game; per-60; writes: —
  - Status: live — team matrix
  - Consumers: teamMatrix
- **Codex view (TEAM-CONTEXT, calculation, location; Codex family 'Team rankings'):** One-goal rate, home/road edge, PP opportunity and penalty context
  - Purpose: Aggregate schedule/result context metrics.
  - Inputs/units: Per-game GF/GA, point fraction, home/road, PP opp/game, penalties/60.
  - Output scale: One-goal-or-fewer game share 0–100%; home-road point-percentage-point gap; mean opportunity and penalty rates.
  - Version/status: Local helper. Production deployment/active database state not checked.
- **Audit context:**
  - Intent (Opus): METRIC_COLUMNS descriptions web/lib/rankings/teamMatrix.ts:428-455
  - Intended contract (Codex TEAM-CONTEXT): Calculation name oneGoalGameRate includes \|GF−GA\|≤1 in implementation.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/rankings/teamMatrix.test.ts`; `web/lib/rankings/teamStyleMethodology.test.ts`
- **Leads (not audited):**
  - (opus) Pen/60 is mean of per-game rates rather than total penalties / total TOI
  - (opus) one-goal rate counts shootout/OT games and excludes empty-net-inflated 2-goal games; point_pct per game row semantics (cumulative vs per-game) not verified
  - (codex:TEAM-CONTEXT) No mathematical accuracy or fitness assessment performed. Tests listed, not run.

## M-RNK-007 QoT / QoC (quality of teammates / competition) features

- **Match:** Both; Opus RNK-013; Codex XG-24
- **Purpose:** Per-game and rolling TOI-weighted average teammate and opponent impact percentiles from shift stints.
- **Where:** `web/lib/xg/qotQoc.ts:101 (percentileRank)`; `web/lib/xg/qotQoc.ts:110 (buildBucketByPlayer)`; `web/lib/xg/qotQoc.ts:137 (buildQotQocPlayerRatings)`; `web/lib/xg/qotQoc.ts:183 (averageRating)`; `web/lib/xg/qotQoc.ts:336 (buildRollingRows)`; `web/lib/xg/qotQoc.ts:407 (buildQotQocFeatureRows)`; `web/pages/api/v1/db/update-nhl-xg-qot-qoc.ts:90 (resolveRatingSnapshotDate)`; `web/lib/xg/qotQoc.ts:137 buildQotQocPlayerRatings`; `web/lib/xg/qotQoc.ts:407 buildQotQocFeatureRows`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: per game; generation: current
- **Opus view (RNK-013):**
  - Method: Re-percentile ratings within position group x TOI tercile (low/middle/high by TOI rank) using (count<=value - 1)/(N-1). Per stint: QoT = mean teammate offensive/defensive percentile (own skaters excl. self), QoC = mean of all opposing players' percentiles; accumulate weighted by stint seconds; per-game value = sum/TOI. Rolling windows 5/10/20 games = TOI-weighted mean over window. Unit-level QoT/QoC also built.
  - Inputs/units: ratings fraction 0-1; seconds; sources: skater_offensive_ratings_daily, skater_defensive_ratings_daily, players, shift stints (nhl_api_shift_rows-derived)
  - Output scale: percentile fraction 0-1; writes: QoT/QoC feature tables (via update-nhl-xg-qot-qoc; exact names in route)
  - Status: live — /api/v1/db/update-nhl-xg-qot-qoc
  - Consumers: xG adjusted-impact / game-prediction features (lib/xg)
- **Codex view (XG-24, calculation, location; Codex family 'Expected goals'):** QoT/QoC comparable-player ratings and on-ice exposure
  - Purpose: Measure quality of teammates/competition using ratings and shared ice time.
  - Inputs/units: Offensive/defensive metrics, position, TOI seconds, shift stints and as-of metadata.
  - Output scale: Within-position/TOI-tercile percentiles [0,1]; time-weighted teammate/opponent offense/defense context; line/pair and rolling values.
  - Version/status: Comparable groups by position plus low/middle/high TOI. Production deployment/active database state not checked.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED in read excerpts
  - Intended contract (Codex XG-24): Source provenance and leakage validators separately declared. Repository design sources: tasks/TASKS/xg-model/docs/definitions-and-parity.md; tasks/TASKS/xg-model/docs/data-contract-boundaries.md; tasks/TASKS/xg-model/baseline/xg-training-feature-contract.md. These document historical intent, not deployment evidence.
  - External references: Evolving-Hockey / NST QoT-QoC (TOI-weighted teammate/opponent TOI% or xGF%); HockeyViz competition metrics
  - Fixtures/test data: none listed
  - Tests: `web/lib/xg/qotQoc.test.ts`
- **Leads (not audited):**
  - (opus) a single (latest by default) rating snapshot is applied to all historical games — look-ahead leakage when used as model features
  - (opus) QoC averages all opposing players without filtering goalies (own-team list filters goalies only); goalies with ratings would enter QoC
  - (opus) percentiles of percentiles within TOI terciles compress differences; tercile bucketing by TOI couples quality and usage
  - (opus) likely overlaps the xG agent's slice (lib/xg) — listed here for QoC/QoT coverage
  - (codex:XG-24) No mathematical accuracy or fitness assessment performed. Tests listed, not run.

## M-RNK-008 Deployment tier bucket summaries

- **Match:** Both; Opus RNK-014; Codex RANK-TIERS
- **Purpose:** Average percentile per metric per deployment bucket (L1..PK2) and pick top metric/player.
- **Where:** `web/lib/rankings/deploymentTiers.ts:263 (metricAverage)`; `web/lib/rankings/deploymentTiers.ts:305 (bucketFromRows)`; `web/lib/rankings/deploymentTiers.ts:650 (buildDirectSpecialTeamsSection)`; `web/lib/rankings/deploymentTiers.ts:787 (sectionPeerGroupType)`; `web/lib/rankings/deploymentTiers.ts:857 (buildDeploymentTiersSurface)`; `web/lib/rankings/deploymentTiers.ts:263 metricAverage`; `web/lib/rankings/deploymentTiers.ts:305 bucketFromRows`; `web/lib/rankings/splits.ts:140 splitValue`
- **Tags (heuristic):** percent scale: 0-100; denominators: 5v5 only; generation: current
- **Opus view (RNK-014):**
  - Method: EV sections ranked at 5v5 vs whole position group; PP/PK sections ranked across all skaters (or position) at pp/pk strength with minToi forced to 0. Bucket metric average = mean of member percentiles (1dp); bucket average = mean of metric averages; topMetric = max average; sourceState available if >= min(3, #metrics) metrics have averages. Latest row per player within last 30 game dates.
  - Inputs/units: percentiles 0-100; sources: rolling_player_game_metrics, players, teams, games
  - Output scale: average percentile 0-100 (1dp); writes: —
  - Status: live — /api/v1/contextual-rankings/deployment-tiers, DeploymentTiersPanel
  - Consumers: /api/v1 deployment-tiers route; components/Rankings/DeploymentTiersPanel.tsx
- **Codex view (RANK-TIERS, calculation, location; Codex family 'Contextual skater rankings'):** Deployment-tier averages and comparisons
  - Purpose: Summarize metric peer groups and positional/strength split comparisons.
  - Inputs/units: Eligible contextual rows, raw value, percentile, role/position/strength.
  - Output scale: Bucket mean values/percentiles, top player, comparisons and sample/coverage counts.
  - Version/status: Local surface helpers. Production deployment/active database state not checked.
- **Audit context:**
  - Intent (Opus): comment web/lib/rankings/deploymentTiers.ts:785-786 (rank lines vs whole position, not vs bucket)
  - Intended contract (Codex RANK-TIERS): Arithmetic aggregation of displayed source rows; no new prediction model.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/__tests__/pages/api/v1/contextual-rankings-deployment-tiers.test.ts`; `web/lib/rankings/deploymentTiers.test.ts`; `web/lib/rankings/splits.test.ts`
- **Leads (not audited):**
  - (opus) SPECIAL_TEAMS_MIN_TOI_SECONDS = 0 lets tiny PP/PK samples receive percentiles
  - (opus) default metric on_ice_xgf_percentage is 5v5-only so it is always unavailable in PP/PK sections
  - (opus) bucket average is an unweighted mean of per-player percentiles (no TOI weighting)
  - (opus) 'latest row per player within 30 game dates' includes stale rows for players who stopped playing
  - (codex:RANK-TIERS) No mathematical accuracy or fitness assessment performed. Tests listed, not run.

## M-RNK-009 Deployment bucket assignment (EV line/pair, PP unit, PK tier)

- **Match:** Both; Opus RNK-015; Codex RANK-DEPLOY
- **Purpose:** Classify skaters into L1-L4, P1-P3, PP1-PP3, PK1-PK2 and aggregate a window's modal deployment with confidence.
- **Where:** `web/lib/rankings/skaterDeploymentAggregation.ts:108 (normalizeEvDeploymentBucket)`; `web/lib/rankings/skaterDeploymentAggregation.ts:140 (normalizePpDeploymentBucket)`; `web/lib/rankings/skaterDeploymentAggregation.ts:151 (normalizePkDeploymentBucket)`; `web/lib/rankings/skaterDeploymentAggregation.ts:159 (assignEvDeploymentBucketFromToiRank)`; `web/lib/rankings/skaterDeploymentAggregation.ts:214 (confidenceFor)`; `web/lib/rankings/skaterDeploymentAggregation.ts:233 (buildSkaterDeploymentAggregate)`; `web/lib/rankings/rankingQueries.ts:514 (buildCandidates bucket use)`; `web/lib/rankings/skaterDeploymentAggregation.ts:233 buildSkaterDeploymentAggregate`; `web/lib/rankings/skaterDeploymentAggregation.ts:159 assignEvDeploymentBucketFromToiRank`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: per game; generation: legacy, current
- **Opus view (RNK-015):**
  - Method: EV: forward slot clamp 1-4 -> L#, defense slot clamp 1-3 -> P#; fallback from EV TOI rank: forwards ceil(rank/3), D ceil(rank/2). PP: unit clamp 1-3. PK: avg PK TOI/game >=90s -> PK1 else PK2. Window aggregate = mode bucket over most recent teamGamesAvailable games; roleConsistencyShare = mode share; confidence high if coverage>=0.7 and share>=0.7, mixed if >=0.4/0.4, else low. rankingQueries labels deployment confidence 'medium' if EV bucket exists else 'low'.
  - Inputs/units: slot/unit integers; PK TOI seconds per game; sources: rolling_player_game_metrics, lineCombinations (via resolveTrustedLineAssignment)
  - Output scale: categorical buckets L1-L4,P1-P3,PP1-PP3,PK1-PK2; confidence high/mixed/low; share 0-1; writes: —
  - Status: live — normalize*Bucket used by rankingQueries/deploymentTiers; buildSkaterDeploymentAggregate/resolveEvDeploymentBucket/assignEvDeploymentBucketFromToiRank have no non-test callers (legacy/dead)
  - Consumers: rankingQueries (deployment peer groups & filters); deploymentTiers; teamUnitToiBuilder?; DeploymentTiersPanel
- **Codex view (RANK-DEPLOY, calculation, location; Codex family 'Deployment and usage'):** Player deployment buckets, typical role and confidence
  - Purpose: Infer selected-window EV/PP/PK role from observed deployment or TOI rank.
  - Inputs/units: Line combinations, role labels, player/team TOI rank and window observations.
  - Output scale: L1–L4/P1–P3/PP1–PP3/PK1–PK2 buckets; mode/share/sample confidence.
  - Version/status: Local deployment resolver. Production deployment/active database state not checked.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED in code beyond names; PRD tasks/TASKS/contextual-hockey-rankings/prd-contextual-hockey-rankings.md
  - Intended contract (Codex RANK-DEPLOY): Player production window and team deployment window are distinct contracts.
  - External references: Line-combination conventions (Daily Faceoff / NST line tool); PK usage tiers by SH TOI share
  - Fixtures/test data: none listed
  - Tests: `web/lib/rankings/skaterDeploymentAggregation.test.ts`
- **Leads (not audited):**
  - (opus) PK1/PK2 split uses a fixed 90 s/game threshold, not team-relative SH TOI share
  - (opus) rankingQueries uses only the latest row's line slot (single game) for deployment peer group, not the windowed mode aggregate
  - (opus) hard-coded 'medium'/'low' deployment confidence in rankingQueries ignores confidenceFor()
  - (codex:RANK-DEPLOY) No mathematical accuracy or fitness assessment performed. Tests listed, not run.

## M-RNK-010 Team unit-usage indices (forward top load, pair top load, PP1+PP2 share)

- **Match:** Both; Opus RNK-016; Codex RANK-UNIT
- **Purpose:** Team-level top-line/pair/PP-unit concentration from team_unit_toi.
- **Where:** `web/lib/rankings/teamMatrix.ts:848 (aggregateTeamUnitToiRows)`; `web/lib/rankings/teamMatrix.ts:661 (buildTeamUnitMetricInterpretation)`; `web/lib/rankings/teamUnitToiBuilder.ts:508 buildTeamUnitToiRows`; `web/lib/rankings/teamMatrix.ts:848 aggregateTeamUnitToiRows`
- **Tags (heuristic):** percent scale: 0-100; denominators: per game; generation: current
- **Opus view (RNK-016):**
  - Method: Per game: forwardTopShare = unit_share(forward_line 1)*100; defenseTopShare likewise; PP share = (PP1+PP2 unit seconds)/pool seconds*100. Team index = unweighted mean across games. Label coverage-qualified if status complete and >=3 games.
  - Inputs/units: unit_share fraction 0-1; player-seconds; sources: team_unit_toi, games
  - Output scale: percent 0-100; writes: —
  - Status: live — team matrix (source team_unit_toi from update-team-unit-toi)
  - Consumers: teamMatrix; TeamMatrixTable.tsx
- **Codex view (RANK-UNIT, calculation, location; Codex family 'Deployment and usage'):** Team unit shared TOI, pooled-player seconds and usage shares
  - Purpose: Build team forward lines, defense pairs and PP units from shifts.
  - Inputs/units: Shift intervals seconds, team/position/strength/line assignments.
  - Output scale: Unit TOI seconds, player-seconds, unit ranking and TOI share; top-forward/pair load and PP1/PP2 usage share.
  - Version/status: team_unit_toi_v1; team matrix dirty locally. Production deployment/active database state not checked.
- **Audit context:**
  - Intent (Opus): METRIC_COLUMNS descriptions web/lib/rankings/teamMatrix.ts:456-479
  - Intended contract (Codex RANK-UNIT): Unit usage labels explicitly pooled player-seconds where appropriate.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/__tests__/pages/api/v1/db/update-team-unit-toi.test.ts`; `web/lib/rankings/teamMatrix.test.ts`; `web/lib/rankings/teamUnitToiBuilder.test.ts`
- **Leads (not audited):**
  - (opus) mean of per-game shares (not pooled seconds) weights short and long games equally
  - (opus) MIN_TEAM_UNIT_LABEL_GAMES=3 is a very small sample for a style label
  - (codex:RANK-UNIT) No mathematical accuracy or fitness assessment performed. Tests listed, not run.

## M-RNK-011 Goalie value signal (avg of GSAx and GSAA)

- **Match:** Both; Opus RNK-018; Codex GOAL-RATIOS
- **Purpose:** Single saved-goals signal blending two goalie value measures.
- **Where:** `web/lib/rankings/goalieMatrix.ts:529 (calculateGoalieValueSignal)`; `web/lib/rankings/goalieMatrix.ts:569 metricValue`; `web/lib/rankings/goalieMatrix.ts:548 calculateGoalieRelativeSavePercentage`; `web/lib/rankings/goalieMatrix.ts:529 calculateGoalieValueSignal`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: per 60, 5v5 only, all strengths; generation: current
- **Opus view (RNK-018):**
  - Method: Mean of non-null of {GSAx, GSAA}; metric marked unavailable if either source partial in window.
  - Inputs/units: goals (cumulative); sources: goalie_stats_unified
  - Output scale: goals; writes: —
  - Status: live — goalie matrix
  - Consumers: goalie matrix
- **Codex view (GOAL-RATIOS, calculation, location; Codex family 'Goalie rankings'):** SV%, HD SV%, relative SV%, GSAx, GSAA/60, shot-quality and value signal
  - Purpose: Produce current goalie matrix calculated metrics.
  - Inputs/units: All-strength saves/shots/starts; matched 5v5 NST xGA, GA, GSAA, TOI seconds, HD counts; team-without-goalie baseline.
  - Output scale: Save and start rates fractions 0–1; relative SV difference; GSAx/GSAA expected-goal counts; GSAA/60; xGA/shot; mean available GSAx/GSAA value signal.
  - Version/status: goalie_rankings_v4_official_appearance_population; local dirty implementation. Production deployment/active database state not checked.
- **Audit context:**
  - Intent (Opus): METRIC_COLUMNS goalie_value_signal description goalieMatrix.ts:268-276
  - Intended contract (Codex GOAL-RATIOS): Metric definitions and aggregate unavailable coverage gates govern source alignment; relative sample separately matched.
  - External references: GSAx (xG baseline) vs GSAA (league-average SV% baseline) are distinct standards
  - Fixtures/test data: none listed
  - Tests: `web/lib/rankings/goalieMatrix.test.ts`
- **Leads (not audited):**
  - (opus) averages two metrics with different baselines (shot-quality vs league-average SV%), cumulative so favours workload
  - (opus) function itself averages whichever is present (1 or 2 values) — fallback differs from column description 'when both are present'
  - (codex:GOAL-RATIOS) No mathematical accuracy or fitness assessment performed. Tests listed, not run.

## M-RNK-012 Goalie relative SV% (vs same-team other goalies)

- **Match:** Both; Opus RNK-019; Codex GOAL-RATIOS
- **Purpose:** Goalie 5v5 SV% minus teammates' 5v5 SV% over the latest team's game window.
- **Where:** `web/lib/rankings/goalieMatrix.ts:548 (calculateGoalieRelativeSavePercentage)`; `web/lib/rankings/goalieMatrix.ts:872 (buildGoalieRelativeSaveContexts)`; `web/lib/rankings/goalieMatrix.ts:978 (buildGoalieTeamContexts)`; `web/lib/rankings/goalieMatrix.ts:569 metricValue`; `web/lib/rankings/goalieMatrix.ts:548 calculateGoalieRelativeSavePercentage`; `web/lib/rankings/goalieMatrix.ts:529 calculateGoalieValueSignal`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: per 60, per game, 5v5 only, all strengths; generation: current
- **Opus view (RNK-019):**
  - Method: Team window = team's last N scheduled games (N per window); requires exactly one starter per game and complete attribution. Rel SV% = goalie saves/SA - (team saves - goalie saves)/(team SA - goalie SA); null if teammate baseline SA < 50.
  - Inputs/units: save and shot counts; sources: goalie_stats_unified, games
  - Output scale: fraction difference (e.g. +0.012); writes: —
  - Status: live — goalie matrix
  - Consumers: goalie matrix
- **Codex view (GOAL-RATIOS, calculation, location; Codex family 'Goalie rankings'):** SV%, HD SV%, relative SV%, GSAx, GSAA/60, shot-quality and value signal
  - Purpose: Produce current goalie matrix calculated metrics.
  - Inputs/units: All-strength saves/shots/starts; matched 5v5 NST xGA, GA, GSAA, TOI seconds, HD counts; team-without-goalie baseline.
  - Output scale: Save and start rates fractions 0–1; relative SV difference; GSAx/GSAA expected-goal counts; GSAA/60; xGA/shot; mean available GSAx/GSAA value signal.
  - Version/status: goalie_rankings_v4_official_appearance_population; local dirty implementation. Production deployment/active database state not checked.
- **Audit context:**
  - Intent (Opus): comment web/lib/rankings/goalieMatrix.ts:576-577 and METRIC_COLUMNS :236-243
  - Intended contract (Codex GOAL-RATIOS): Metric definitions and aggregate unavailable coverage gates govern source alignment; relative sample separately matched.
  - External references: dSV% / team-relative save percentage
  - Fixtures/test data: none listed
  - Tests: `web/lib/rankings/goalieMatrix.test.ts`
- **Leads (not audited):**
  - (opus) team-relative baseline with 50-shot minimum is noisy; goalie and teammates face different opponents/schedules
  - (opus) player performance window (goalie appearances) and relative SV% window (team games) differ (acknowledged in roleNotes)
  - (codex:GOAL-RATIOS) No mathematical accuracy or fitness assessment performed. Tests listed, not run.

## M-RNK-013 Goalie window aggregation (SV%, 5v5 GSAx, GSAA/60, xGA/shot, HD SV%)

- **Match:** Both; Opus RNK-021; Codex GOAL-RATIOS
- **Purpose:** Aggregate a goalie's last-N or season appearances into rate metrics for the goalie matrix.
- **Where:** `web/lib/rankings/goalieMatrix.ts:658 (aggregateGoalieGameRows)`; `web/lib/rankings/goalieMatrix.ts:569 (metricValue)`; `web/lib/rankings/goalieMatrix.ts:520 (calculateGoalieXgaPerShotAgainst)`; `web/lib/rankings/goalieMatrix.ts:541 (calculateGoalieHighDangerSavePercentage)`; `web/lib/rankings/goalieMatrix.ts:569 metricValue`; `web/lib/rankings/goalieMatrix.ts:548 calculateGoalieRelativeSavePercentage`; `web/lib/rankings/goalieMatrix.ts:529 calculateGoalieValueSignal`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: per 60, per game, 5v5 only, all strengths; generation: current
- **Opus view (RNK-021):**
  - Method: Window = goalie's last 5/10/20 appearances (or season) across teams. SV% = sum saves / sum SA (all situations, WGO). GSAx = sum(NST 5v5 xGA - NST 5v5 GA) (cumulative). GSAA/60 = sum NST 5v5 GSAA / sum NST 5v5 TOI *3600. xGA/shot = 5v5 xGA / 5v5 shots against. HD SV% = 5v5 HD saves / HD SA. Any missing per-game component marks the metric unavailable for the whole window.
  - Inputs/units: counts; TOI seconds; xG goals; sources: goalie_stats_unified, wgo_goalie_stats, games, wgo_team_stats
  - Output scale: SV% fraction 0-1; GSAx goals; GSAA per 60; xG per shot fraction; HD SV% fraction 0-1; writes: —
  - Status: live — goalie matrix (methodologyVersion goalie_rankings_v4_official_appearance_population, goalieMatrix.ts:1582)
  - Consumers: /api/v1/contextual-rankings goalie matrix; components/Rankings/GoalieMatrixTable.tsx
- **Codex view (GOAL-RATIOS, calculation, location; Codex family 'Goalie rankings'):** SV%, HD SV%, relative SV%, GSAx, GSAA/60, shot-quality and value signal
  - Purpose: Produce current goalie matrix calculated metrics.
  - Inputs/units: All-strength saves/shots/starts; matched 5v5 NST xGA, GA, GSAA, TOI seconds, HD counts; team-without-goalie baseline.
  - Output scale: Save and start rates fractions 0–1; relative SV difference; GSAx/GSAA expected-goal counts; GSAA/60; xGA/shot; mean available GSAx/GSAA value signal.
  - Version/status: goalie_rankings_v4_official_appearance_population; local dirty implementation. Production deployment/active database state not checked.
- **Audit context:**
  - Intent (Opus): METRIC_COLUMNS descriptions web/lib/rankings/goalieMatrix.ts:227-316; comment :704-705
  - Intended contract (Codex GOAL-RATIOS): Metric definitions and aggregate unavailable coverage gates govern source alignment; relative sample separately matched.
  - External references: GSAx = xGA - GA (MoneyPuck/Evolving-Hockey, all unblocked shots, all situations); NST GSAA and HD SV% definitions
  - Fixtures/test data: none listed
  - Tests: `web/__tests__/pages/api/v1/contextual-rankings-matrix.test.ts`; `web/components/Rankings/GoalieTeamMatrixTable.test.tsx`; `web/lib/rankings/goalieMatrix.test.ts`
- **Leads (not audited):**
  - (opus) GSAx is 5v5-only and cumulative (not per 60/per shot) while SV% is all-situations — mixed strengths in one matrix
  - (opus) GSAx uses NST xG (shots-on-goal based) whereas GSAx reference uses unblocked attempts
  - (opus) minShots gate (default 100) is on all-situations SA, not on the 5v5 sample used by GSAx/HD SV%
  - (opus) xGA per shot uses NST shots_against (SOG) not Fenwick, inconsistent with xgDenominatorSemantics Fenwick contract
  - (codex:GOAL-RATIOS) No mathematical accuracy or fitness assessment performed. Tests listed, not run.

## M-RNK-014 Goalie quality start / really bad start / steal game classification

- **Match:** Both; Opus RNK-022; Codex GOAL-QS
- **Purpose:** Per-start binary classifications used for QS%, RBS% and steal rate.
- **Where:** `web/lib/rankings/goalieMethodology.ts:100 (calculateGoalieGsax)`; `web/lib/rankings/goalieMethodology.ts:113 (isGoalieQualityStart)`; `web/lib/rankings/goalieMethodology.ts:138 (isGoalieReallyBadStart)`; `web/lib/rankings/goalieMethodology.ts:158 (isGoalieStealGame)`; `web/lib/rankings/goalieMatrix.ts:801 (QS from WGO quality_start)`; `web/lib/rankings/goalieMatrix.ts:817 (RBS/steal per start)`; `web/lib/rankings/goalieMethodology.ts:113 isGoalieQualityStart`; `web/lib/rankings/goalieMethodology.ts:138 isGoalieReallyBadStart`; `web/lib/rankings/goalieMethodology.ts:158 isGoalieStealGame`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: per game, 5v5 only; generation: current
- **Opus view (RNK-022):**
  - Method: modern_gsax mode (default): QS if GSAx>=0; RBS if GSAx<=-2; steal if won and GSAx>=1. classic mode: QS if SV%>=0.900 (or >=0.885 when SA<20); RBS if SV%<=0.850; steal if SA>=30 and SV%>=0.930 and won. Matrix: QS% = WGO quality_start / starts (not this function); RBS% and steal rate use modern mode with per-game 5v5 GSAx; rates = count/starts.
  - Inputs/units: counts; GSAx goals; SV% fraction; sources: goalie_stats_unified, wgo_goalie_stats
  - Output scale: booleans; rates fraction 0-1; writes: —
  - Status: live — goalie matrix (RBS/steal); isGoalieQualityStart likely test-only
  - Consumers: goalie matrix
- **Codex view (GOAL-QS, calculation, location; Codex family 'Goalie rankings'):** Modern/classic quality start, really bad start and steal
  - Purpose: Classify goalie starts using GSAx or save percentage thresholds.
  - Inputs/units: Start flag; xGA/GA expected-goal counts; saves/shots, win flag.
  - Output scale: Booleans; aggregate QS/RBS/steal fractions.
  - Version/status: Mode modern_gsax or classic_save_pct. Production deployment/active database state not checked.
- **Audit context:**
  - Intent (Opus): DEFAULT_THRESHOLDS web/lib/rankings/goalieMethodology.ts:74-83; METRIC_COLUMNS :285-306
  - Intended contract (Codex GOAL-QS): Modern defaults QS GSAx≥0, RBS≤−2, win+GSAx≥1 steal; classic threshold table distinct.
  - External references: Rob Vollman Quality Start (SV% >= league avg or >=.885 on <20 shots) and Really Bad Start (SV% < .850)
  - Fixtures/test data: none listed
  - Tests: `web/lib/rankings/goalieMatrix.test.ts`; `web/lib/rankings/goalieMethodology.test.ts`
- **Leads (not audited):**
  - (opus) QS% uses WGO/NHL quality_start while RBS%/steal use 5v5-only GSAx thresholds designed per game — inconsistent definitions in one row
  - (opus) classic leagueAverageSavePct hard-coded 0.900 rather than seasonal league average
  - (opus) isGoalieQualityStart has no production caller in matrix (QS read from WGO)
  - (codex:GOAL-QS) No mathematical accuracy or fitness assessment performed. Tests listed, not run.

## M-RNK-015 Goalie role / start-share buckets and adjusted core netshare

- **Match:** Both; Opus RNK-023; Codex GOAL-RATIOS, GOAL-ROLE
- **Purpose:** Classify goalie role (G1 workhorse..G2 reserve) from start share; optional core-tandem netshare excluding emergency starts.
- **Where:** `web/lib/rankings/goalieMethodology.ts:184 (getGoalieStartsShareBucket)`; `web/lib/rankings/goalieMethodology.ts:196 (getGoalieDeploymentBucket)`; `web/lib/rankings/goalieMethodology.ts:221 (calculateAdjustedCoreNetshare)`; `web/lib/rankings/goalieMatrix.ts:953 (buildTeamWorkloadContexts)`; `web/lib/rankings/goalieMatrix.ts:1041 (buildGoalieRoleContext)`; `web/lib/rankings/goalieMatrix.ts:569 start_share`; `web/lib/rankings/goalieMatrix.ts:569 metricValue`; `web/lib/rankings/goalieMatrix.ts:548 calculateGoalieRelativeSavePercentage`; `web/lib/rankings/goalieMatrix.ts:529 calculateGoalieValueSignal`; `web/lib/rankings/goalieMethodology.ts:196 getGoalieDeploymentBucket`; `web/lib/rankings/goalieMethodology.ts:221 calculateAdjustedCoreNetshare`; `web/lib/rankings/goalieMatrix.ts:1041 buildGoalieRoleContext`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: per 60, 5v5 only, all strengths; generation: current
- **Opus view (RNK-023):**
  - Method: roleShare = projected season_start_pct (matching team) else raw window share = goalie starts / team starts. Deployment bucket: >=0.65 g1_workhorse, >=0.55 g1_starter, >=0.45 g1a_tandem_lead, >=0.30 g1b, >=0.10 g2_backup, else g2_reserve. coreStartShare = starts / top-2 goalies' starts. Role confidence high if confirmed projection, medium if projection, else medium/low by core status. calculateAdjustedCoreNetshare = core starts / starts excluding emergency call-ups when both core goalies absent with >=medium confidence. start_share metric = projection season_start_pct ?? adjusted(null) ?? raw.
  - Inputs/units: start counts; share fraction 0-1; sources: goalie_start_projections, goalie_stats_unified, games
  - Output scale: categorical bucket; share fraction 0-1; writes: —
  - Status: live — goalie matrix (bucket); calculateAdjustedCoreNetshare unknown/likely test-only
  - Consumers: goalie matrix role filter & start_share metric
- **Codex view (GOAL-RATIOS, calculation, location; Codex family 'Goalie rankings'):** SV%, HD SV%, relative SV%, GSAx, GSAA/60, shot-quality and value signal
  - Purpose: Produce current goalie matrix calculated metrics.
  - Inputs/units: All-strength saves/shots/starts; matched 5v5 NST xGA, GA, GSAA, TOI seconds, HD counts; team-without-goalie baseline.
  - Output scale: Save and start rates fractions 0–1; relative SV difference; GSAx/GSAA expected-goal counts; GSAA/60; xGA/shot; mean available GSAx/GSAA value signal.
  - Version/status: goalie_rankings_v4_official_appearance_population; local dirty implementation. Production deployment/active database state not checked.
- **Codex view (GOAL-ROLE, calculation, location; Codex family 'Goalie rankings'):** Goalie start share, deployment role and adjusted core netshare
  - Purpose: Classify workload and remove qualifying emergency-start contamination.
  - Inputs/units: Team starts, core goalie IDs, absence confidence/emergency status, matching-team start projection.
  - Output scale: Start fraction; six deployment tiers; core/total starts, excluded starts, adjusted netshare.
  - Version/status: Local roles; projection fallback rules in goalieMatrix. Production deployment/active database state not checked.
- **Audit context:**
  - Intent (Opus): roleNotes text web/lib/rankings/goalieMatrix.ts:1078-1087
  - Intended contract (Codex GOAL-RATIOS): Metric definitions and aggregate unavailable coverage gates govern source alignment; relative sample separately matched.
  - Intended contract (Codex GOAL-ROLE): Role thresholds .65/.55/.45/.30/.10; emergency exclusion requires both top-two absent with sufficient confidence.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/rankings/goalieMatrix.test.ts`; `web/lib/rankings/goalieMethodology.test.ts`
- **Leads (not audited):**
  - (opus) start_share metric mixes a projection field and an observed window share in one ranked column
  - (opus) adjustedStartShare hard-coded null (goalieMatrix.ts:1064); calculateAdjustedCoreNetshare and getGoalieStartsShareBucket have no matrix callers
  - (opus) thresholds 0.65/0.55/0.45/0.30/0.10 are magic numbers
  - (codex:GOAL-RATIOS) No mathematical accuracy or fitness assessment performed. Tests listed, not run.
  - (codex:GOAL-ROLE) No mathematical accuracy or fitness assessment performed. Tests listed, not run.

## M-RNK-016 Results Luck Index (non-overlapping rate version with peer blend shrinkage)

- **Match:** Both; Opus RNK-024; Codex RANK-LUCK-DETAIL, RANK-results_luck_index
- **Purpose:** Older single-metric luck index: current per-60 vs season-remainder per-60 blended toward peer average when baseline TOI is thin.
- **Where:** `web/lib/rankings/resultsLuckIndex.ts:241 (calculateNonOverlappingResultsLuckIndex)`; `web/lib/rankings/resultsLuckIndex.ts:89 (seasonTotalsForBaseline)`; `web/lib/rankings/resultsLuckIndex.ts:232 (canPersistResultsLuckIndex)`; `web/lib/rankings/resultsLuckIndex.ts:157 calculateComponentAwareResultsLuckIndex`; `web/lib/rankings/resultsLuckIndex.ts:241 calculateNonOverlappingResultsLuckIndex`; `web/lib/rankings/skaterCompositeMethodology.ts:213 RESULTS_LUCK_SIGNAL_COMPONENTS`
- **Tags (heuristic):** percent scale: 0-100; denominators: per 60; generation: legacy, current
- **Opus view (RNK-024):**
  - Method: Baseline numerator/denominator = season minus current; player baseline = per-60; weight w = clamp01(baselineTOI/1200 s); baseline = w*player + (1-w)*peer; index = current/baseline*100.
  - Inputs/units: counts and TOI seconds; sources: rolling_player_game_metrics (via aggregates)
  - Output scale: index centred at 100 (unclamped); writes: —
  - Status: legacy/dead — no non-test callers of calculateNonOverlappingResultsLuckIndex/canPersistResultsLuckIndex
  - Consumers: no non-test callers found (rg)
- **Codex view (RANK-LUCK-DETAIL, calculation, location; Codex family 'Contextual skater rankings'):** Component-aware and non-overlapping Results Luck Index variants
  - Purpose: Compare current outcomes to frozen player/peer baseline.
  - Inputs/units: Current and season totals, selected-window-excluded baseline, peer fallback and component weights.
  - Output scale: Ratio variant 100×current/baseline; signed component variant 100+100×delta/scale clamped 0–200 then weighted mean; centered 100.
  - Version/status: Two APIs coexist; default baseline minimum 1200 TOI seconds. Production deployment/active database state not checked.
- **Codex view (RANK-results_luck_index, calculation, location; Codex family 'Contextual skater rankings'):** Results Luck Index
  - Purpose: Current results compared with historical or blended baseline results.
  - Inputs/units: Source skater_composite_ratings fields: skater_composite_ratings.results_luck_index, skater_composite_ratings.components_json->resultsLuck.baselineProvenance. Denominator: Metric-specific denominator described by the formula and methodology metadata.
  - Output scale: 100 * current results / baseline results Contextual display may also include dense rank and percentile 0–100.
  - Version/status: contextual_rankings_v1; code-declared availability=available. Production deployment/active database state not checked.
- **Audit context:**
  - Intent (Opus): RESULTS_LUCK_INDEX_CONTRACT.baseline 'blended with active peer-group average when player history is thin' (skaterCompositeMethodology.ts:197)
  - Intended contract (Codex RANK-LUCK-DETAIL): GAX .35, SAX .25, IPP .20, on-ice shooting .20; baseline exclusion and coverage control publishability.
  - Intended contract (Codex RANK-results_luck_index): 100 * current results / baseline results Source: web/lib/rankings/metricDefinitions.ts:856. Minimum GP 1, TOI 1200 seconds.
  - External references: Linear shrinkage toward population mean (Tango regression to the mean)
  - Fixtures/test data: none listed
  - Tests: `web/lib/rankings/resultsLuckIndex.test.ts`; `web/lib/rankings/skaterCompositeMethodology.test.ts`
- **Leads (not audited):**
  - (opus) legacy/dead — no production callers
  - (opus) shrinkage constant 1200 s (20 min) TOI is far below reliability thresholds for per-60 scoring rates
  - (codex:RANK-LUCK-DETAIL) No mathematical accuracy or fitness assessment performed. Tests listed, not run.
  - (codex:RANK-results_luck_index) Registry formula is intended contract; implementation may have distinct missingness/variant rules. No agreement assessment performed.

## M-RNK-017 Results Luck Index (component-aware, written)

- **Match:** Both; Opus RNK-025; Codex RANK-LUCK-DETAIL, RANK-results_luck_index
- **Purpose:** Index (100 = normal) of whether a skater's current-window results run hot/cold vs a non-overlapping season-remainder baseline.
- **Where:** `web/lib/rankings/resultsLuckSources.ts:87 (buildResultsLuckRollingSourceFromRow)`; `web/lib/rankings/resultsLuckSources.ts:249 (fetchResultsLuckRollingSources)`; `web/lib/rankings/resultsLuckIndex.ts:121 (componentIndexFor)`; `web/lib/rankings/resultsLuckIndex.ts:157 (calculateComponentAwareResultsLuckIndex)`; `web/lib/rankings/resultsLuckIndex.ts:226 (canPersistComponentAwareResultsLuckIndex)`; `web/lib/rankings/skaterCompositeWriter.ts:545`; `web/lib/rankings/resultsLuckIndex.ts:157 calculateComponentAwareResultsLuckIndex`; `web/lib/rankings/resultsLuckIndex.ts:241 calculateNonOverlappingResultsLuckIndex`; `web/lib/rankings/skaterCompositeMethodology.ts:213 RESULTS_LUCK_SIGNAL_COMPONENTS`
- **Tags (heuristic):** percent scale: 0-100; generation: current
- **Opus view (RNK-025):**
  - Method: Baseline = season total minus current-window total. Components: GAx (G-ixG) signed, scale 2, weight 0.35; SAX% (G/att - ixG/att, x100) signed, scale 10, weight 0.25; IPP% ratio, weight 0.20; on-ice GF-xGF signed, scale 4, weight 0.20. Signed component index = clamp(100 + (current-baseline)/scale*100, 0, 200); ratio index = clamp(current/baseline*100, 0, 200). Index = weighted mean of usable components. Publish only if all weights usable and baseline window excluded (or season + peer_fallback). Season window uses last20 as current and has no baseline. Interpretation bands: >=120 hot, 105-119 slightly hot, 95-105 normal, 80-94 slightly cold, <=79 cold.
  - Inputs/units: goal counts, xG goals, attempt counts, IPP percent 0-100; sources: rolling_player_game_metrics
  - Output scale: index centred at 100, clamped 0-200; writes: skater_composite_ratings.results_luck_index, skater_composite_ratings.components_json
  - Status: live — update-skater-composite-ratings when source coverage verified
  - Consumers: metric results_luck_index (ranked higherIsBetter=false); playerMatrix; PlayerSnapshotPanel
- **Codex view (RANK-LUCK-DETAIL, calculation, location; Codex family 'Contextual skater rankings'):** Component-aware and non-overlapping Results Luck Index variants
  - Purpose: Compare current outcomes to frozen player/peer baseline.
  - Inputs/units: Current and season totals, selected-window-excluded baseline, peer fallback and component weights.
  - Output scale: Ratio variant 100×current/baseline; signed component variant 100+100×delta/scale clamped 0–200 then weighted mean; centered 100.
  - Version/status: Two APIs coexist; default baseline minimum 1200 TOI seconds. Production deployment/active database state not checked.
- **Codex view (RANK-results_luck_index, calculation, location; Codex family 'Contextual skater rankings'):** Results Luck Index
  - Purpose: Current results compared with historical or blended baseline results.
  - Inputs/units: Source skater_composite_ratings fields: skater_composite_ratings.results_luck_index, skater_composite_ratings.components_json->resultsLuck.baselineProvenance. Denominator: Metric-specific denominator described by the formula and methodology metadata.
  - Output scale: 100 * current results / baseline results Contextual display may also include dense rank and percentile 0–100.
  - Version/status: contextual_rankings_v1; code-declared availability=available. Production deployment/active database state not checked.
- **Audit context:**
  - Intent (Opus): RESULTS_LUCK_INDEX_CONTRACT and RESULTS_LUCK_BASELINE_PERSISTENCE_CONTRACT (web/lib/rankings/skaterCompositeMethodology.ts:188-302)
  - Intended contract (Codex RANK-LUCK-DETAIL): GAX .35, SAX .25, IPP .20, on-ice shooting .20; baseline exclusion and coverage control publishability.
  - Intended contract (Codex RANK-results_luck_index): 100 * current results / baseline results Source: web/lib/rankings/metricDefinitions.ts:856. Minimum GP 1, TOI 1200 seconds.
  - External references: PDO / regression-to-mean of shooting % and on-ice Sh% (Tango-style true-talent regression)
  - Fixtures/test data: none listed
  - Tests: `web/lib/rankings/resultsLuckIndex.test.ts`; `web/lib/rankings/resultsLuckSources.test.ts`; `web/lib/rankings/skaterCompositeMethodology.test.ts`; `web/lib/rankings/skaterCompositeWriter.test.ts`
- **Leads (not audited):**
  - (opus) GAx and on-ice GF-xGF components compare a last-N window COUNT with a season-remainder COUNT (different sample sizes) — signed difference is not rate-normalized
  - (opus) baseline = season total minus last-N total, but last-N windows can include prior-season games (skaterWindowAggregation.ts:243), so the remainder can be wrong or negative
  - (opus) SAX% uses shot_attempts (iCF vs Fenwick ambiguity) as denominator
  - (opus) scales 2/10/4 and 0-200 clamp are magic numbers
  - (opus) season-window rows can never publish (no peer fallback wired), so season results_luck_index is always null
  - (codex:RANK-LUCK-DETAIL) No mathematical accuracy or fitness assessment performed. Tests listed, not run.
  - (codex:RANK-results_luck_index) Registry formula is intended contract; implementation may have distinct missingness/variant rules. No agreement assessment performed.

## M-RNK-018 Offense Rating (skater composite)

- **Match:** Both; Opus RNK-028; Codex RANK-offense_rating
- **Purpose:** Percentile-weighted contextual offensive composite per skater/window/strength/peer group.
- **Where:** `web/lib/rankings/skaterCompositeWriter.ts:333 (calculateOffenseRating)`; `web/lib/rankings/skaterCompositeMethodology.ts:9 (OFFENSE_RATING_CONTRACT)`; `web/lib/rankings/skaterCompositeWriter.ts:161 (weightedAverage)`; `web/lib/rankings/skaterCompositeWriter.ts:333 calculateOffenseRating`
- **Tags (heuristic):** percent scale: 0-100; denominators: per 60, shots on goal; generation: current
- **Opus view (RNK-028):**
  - Method: Sub-scores = mean of available component percentiles: scoring_rate(G/60,P/60), chance_creation(ixG/60, iCF/60, SOG/60), playmaking(A1/60, A/60), finishing_context(xS%, SAX%, GAx). Offense = weighted mean 0.35/0.30/0.20/0.15 over non-null sub-scores (weights renormalized), clamp 0-100, round 2. Written to offense_rating_overall or _deployment depending on deployment filter.
  - Inputs/units: percentiles 0-100; sources: rolling_player_game_metrics (via contextual ranking surfaces)
  - Output scale: 0-100 weighted percentile score (not itself a percentile); writes: skater_composite_ratings.offense_rating_overall, skater_composite_ratings.offense_rating_deployment
  - Status: live — written by /api/v1/db/update-skater-composite-ratings (methodology contextual_composites_v2)
  - Consumers: metric offense_rating in rankings; playerMatrix.ts; snapshot.ts; comparison.ts; PlayerSnapshotPanel
- **Codex view (RANK-offense_rating, calculation, location; Codex family 'Contextual skater rankings'):** Offense Rating
  - Purpose: Published skater offensive composite sourced from skater_composite_ratings.
  - Inputs/units: Source skater_composite_ratings fields: skater_composite_ratings.offense_rating_overall, skater_composite_ratings.offense_rating_deployment. Denominator: Weighted component percentiles from published skater composite rating rows.
  - Output scale: Weighted blend of scoring-rate, chance-creation, playmaking, and finishing-context percentile components. Contextual display may also include dense rank and percentile 0–100.
  - Version/status: contextual_rankings_v1; code-declared availability=available. Production deployment/active database state not checked.
- **Audit context:**
  - Intent (Opus): OFFENSE_RATING_CONTRACT formula + caveats (web/lib/rankings/skaterCompositeMethodology.ts:9-30); metricDefinitions offense_rating adjustedImpactBoundary (metricDefinitions.ts:812)
  - Intended contract (Codex RANK-offense_rating): Weighted blend of scoring-rate, chance-creation, playmaking, and finishing-context percentile components. Source: web/lib/rankings/metricDefinitions.ts:787. Minimum GP 1, TOI 600 seconds.
  - External references: Evolving-Hockey EV/PP offense GAR components; percentile-card composites (JFresh)
  - Fixtures/test data: none listed
  - Tests: `web/__tests__/pages/api/v1/db/update-skater-composite-ratings.test.ts`; `web/lib/rankings/skaterCompositeMethodology.test.ts`; `web/lib/rankings/skaterCompositeWriter.test.ts`
- **Leads (not audited):**
  - (opus) missing components are silently dropped and weights renormalized, unlike MCM which requires all inputs ('never reweight') — inconsistent policies in the same writer
  - (opus) components are highly collinear (G/60 and P/60; ixG/60, iCF/60, SOG/60; A1/60 and A/60), so effective weight on shot volume is larger than labelled
  - (opus) a rating built from a single available component still publishes as a full 0-100 rating
  - (opus) finishing context includes GAx (count, TOI-dependent) alongside percentages
  - (codex:RANK-offense_rating) Registry formula is intended contract; implementation may have distinct missingness/variant rules. No agreement assessment performed.

## M-RNK-019 Defense Rating / Defensive Impact in Context (skater composite)

- **Match:** Both; Opus RNK-029; Codex RANK-defense_rating
- **Purpose:** Percentile-weighted contextual defensive composite.
- **Where:** `web/lib/rankings/skaterCompositeWriter.ts:365 (calculateDefenseRating)`; `web/lib/rankings/skaterCompositeMethodology.ts:32 (DEFENSE_RATING_CONTRACT)`; `web/lib/rankings/defensiveCompositeMethodology.ts:1`; `web/lib/rankings/skaterCompositeWriter.ts:365 calculateDefenseRating`
- **Tags (heuristic):** percent scale: 0-100; denominators: per 60; generation: current
- **Opus view (RNK-029):**
  - Method: suppression = pct(xGA/60); on_ice_process = mean(pct on-ice xGF%, pct on-ice GF%); physical_support = pct(blocks/60). Defense = weighted mean 0.45/0.35/0.20 over non-null sub-scores (renormalized), clamp 0-100, round 2.
  - Inputs/units: percentiles 0-100; sources: rolling_player_game_metrics
  - Output scale: 0-100 weighted percentile score; writes: skater_composite_ratings.defense_rating_overall, skater_composite_ratings.defense_rating_deployment
  - Status: live — update-skater-composite-ratings
  - Consumers: metric defense_rating; playerMatrix; snapshot; comparison
- **Codex view (RANK-defense_rating, calculation, location; Codex family 'Contextual skater rankings'):** Defensive Impact
  - Purpose: Published contextual defensive-impact composite sourced from skater_composite_ratings.
  - Inputs/units: Source skater_composite_ratings fields: skater_composite_ratings.defense_rating_overall, skater_composite_ratings.defense_rating_deployment. Denominator: Weighted component percentiles from published skater composite rating rows.
  - Output scale: Weighted blend of suppression, raw on-ice process, and physical-support percentile components. Contextual display may also include dense rank and percentile 0–100.
  - Version/status: contextual_rankings_v1; code-declared availability=available. Production deployment/active database state not checked.
- **Audit context:**
  - Intent (Opus): DEFENSE_RATING_CONTRACT + DEFENSIVE_COMPOSITE_CAVEATS (skaterCompositeMethodology.ts:32-46, defensiveCompositeMethodology.ts:10-13)
  - Intended contract (Codex RANK-defense_rating): Weighted blend of suppression, raw on-ice process, and physical-support percentile components. Source: web/lib/rankings/metricDefinitions.ts:823. Minimum GP 1, TOI 600 seconds.
  - External references: Evolving-Hockey defensive RAPM/GAR (xGA suppression controlling for teammates, competition, zone, score)
  - Fixtures/test data: none listed
  - Tests: `web/lib/rankings/defensiveCompositeMethodology.test.ts`; `web/lib/rankings/skaterCompositeWriter.test.ts`
- **Leads (not audited):**
  - (opus) xga_per_60 and on_ice_xgf_percentage are 5v5-only and are marked unavailable for strength all/ev/pp/pk (rankingQueries.ts:668), so non-5v5 defense ratings reduce to on-ice GF% + blocks with renormalized weights (~64/36)
  - (opus) on-ice GF% and xGF% are offense+defense shares, not defensive-only; blocks/60 rewards being hemmed in
  - (opus) no teammate/competition/zone/score adjustment (acknowledged in caveats)
  - (codex:RANK-defense_rating) Registry formula is intended contract; implementation may have distinct missingness/variant rules. No agreement assessment performed.

## M-RNK-020 MCM Score (multi-category fantasy composite)

- **Match:** Both; Opus RNK-030; Codex RANK-beast_tier, RANK-mcm_score
- **Purpose:** Fantasy multi-category peripheral/scoring score from component percentiles.
- **Where:** `web/lib/rankings/skaterCompositeWriter.ts:384 (calculateUnroundedMcmScore)`; `web/lib/rankings/skaterCompositeWriter.ts:399 (calculateMcmScore)`; `web/lib/rankings/skaterCompositeWriter.ts:153 (averageTopN)`; `web/lib/rankings/skaterCompositeMethodology.ts:48 (MCM_COMPONENTS)`; `web/lib/rankings/skaterCompositeMethodology.ts:60 (getMcmComponentGroups)`; `web/lib/rankings/skaterCompositeWriter.ts:178 (percentilesFor)`; `web/lib/rankings/skaterCompositeWriter.ts:406 resolveBeastTier`; `web/lib/rankings/skaterCompositeWriter.ts:399 calculateMcmScore`
- **Tags (heuristic):** percent scale: 0-100; generation: current
- **Opus view (RNK-030):**
  - Method: Requires every component percentile valid (no reweighting); percentile only accepted if sample met, peer count>=3, same peer group & snapshot. MCM = 0.45*mean(top 2 riff pct) + 0.35*max(scoring pct) + 0.20*mean(all component pct); round 2.
  - Inputs/units: percentiles 0-100; sources: rolling_player_game_metrics
  - Output scale: 0-100 weighted score (not a percentile); writes: skater_composite_ratings.mcm_score, skater_composite_ratings.components_json
  - Status: live — update-skater-composite-ratings
  - Consumers: metric mcm_score; resolveBeastTier; playerMatrix; snapshot
- **Codex view (RANK-beast_tier, calculation, location; Codex family 'Contextual skater rankings'):** BEAST Tier
  - Purpose: Tier label for qualified multi-category players.
  - Inputs/units: Source skater_composite_ratings fields: skater_composite_ratings.beast_tier. Denominator: Eligibility thresholds applied to contextual percentile components.
  - Output scale: Eligibility gates based on verified live MCM percentile thresholds, including power-play points where PP rows are available. Contextual display may also include dense rank and percentile 0–100.
  - Version/status: contextual_rankings_v1; code-declared availability=available. Production deployment/active database state not checked.
- **Codex view (RANK-mcm_score, calculation, location; Codex family 'Contextual skater rankings'):** MCM Score
  - Purpose: Multi-category fantasy score based on verified live percentile components.
  - Inputs/units: Source skater_composite_ratings fields: skater_composite_ratings.mcm_score. Denominator: Weighted component percentiles from published contextual metric components.
  - Output scale: Weighted blend of riff score, live scoring score, and live category depth score, including power-play points where PP rows are available. Contextual display may also include dense rank and percentile 0–100.
  - Version/status: contextual_rankings_v1; code-declared availability=available. Production deployment/active database state not checked.
- **Audit context:**
  - Intent (Opus): MCM_SCORE_CONTRACT formula/componentPolicy/caveats (web/lib/rankings/skaterCompositeMethodology.ts:73-102)
  - Intended contract (Codex RANK-beast_tier): Eligibility gates based on verified live MCM percentile thresholds, including power-play points where PP rows are available. Source: web/lib/rankings/metricDefinitions.ts:926. Minimum GP 1, TOI 600 seconds.
  - Intended contract (Codex RANK-mcm_score): Weighted blend of riff score, live scoring score, and live category depth score, including power-play points where PP rows are available. Source: web/lib/rankings/metricDefinitions.ts:886. Minimum GP 1, TOI 600 seconds.
  - External references: Fantasy category z-score/value-over-replacement methods (e.g. standard H2H category z-scores)
  - Fixtures/test data: none listed
  - Tests: `web/lib/rankings/skaterCompositeMethodology.test.ts`; `web/lib/rankings/skaterCompositeWriter.test.ts`
- **Leads (not audited):**
  - (opus) 6-input (5v5/ev/pk) and 7-input (all/pp) variants share one column; values not comparable across strengths (acknowledged)
  - (opus) overlapping scoring components (G, A1, P, PPP) double count production
  - (opus) uses per-60 rates, whereas fantasy categories are totals — high-rate low-TOI players can score high
  - (codex:RANK-beast_tier) Registry formula is intended contract; implementation may have distinct missingness/variant rules. No agreement assessment performed.
  - (codex:RANK-mcm_score) Registry formula is intended contract; implementation may have distinct missingness/variant rules. No agreement assessment performed.

## M-RNK-021 BEAST tier classification

- **Match:** Both; Opus RNK-031; Codex RANK-MCM-DETAIL, RANK-beast_tier, RANK-mcm_score
- **Purpose:** Tier label (BEAST+, BEAST, MCM, MCM Watch) from MCM score and category percentile counts.
- **Where:** `web/lib/rankings/skaterCompositeWriter.ts:406 (resolveBeastTier)`; `web/lib/rankings/skaterCompositeMethodology.ts:104 (BEAST_TIER_GATES)`; `web/lib/rankings/skaterCompositeMethodology.ts:73 MCM_SCORE_CONTRACT`; `web/lib/rankings/skaterCompositeMethodology.ts:104 BEAST_TIER_GATES`; `web/lib/rankings/skaterCompositeWriter.ts:512 flagCounts`; `web/lib/rankings/skaterCompositeWriter.ts:406 resolveBeastTier`; `web/lib/rankings/skaterCompositeWriter.ts:399 calculateMcmScore`
- **Tags (heuristic):** percent scale: 0-100; denominators: shots on goal; generation: current
- **Opus view (RNK-031):**
  - Method: First gate passed wins: BEAST+ MCM>=88, >=3 riff>=80, >=2 scoring>=75, >=4 all>=80; BEAST MCM>=80, >=2 riff>=75, >=1 scoring>=70, >=4 all>=70; MCM MCM>=70, >=2 riff>=70, >=1 scoring>=60; MCM Watch no MCM floor, >=2 riff>=60, >=1 scoring>=60. Compares unrounded score.
  - Inputs/units: percentiles 0-100; sources: rolling_player_game_metrics
  - Output scale: categorical tier or null; writes: skater_composite_ratings.beast_tier, skater_composite_ratings.tags
  - Status: live — update-skater-composite-ratings
  - Consumers: metric beast_tier; playerMatrix; PlayerSnapshotPanel
- **Codex view (RANK-MCM-DETAIL, calculation, location; Codex family 'Contextual skater rankings'):** MCM components, BEAST thresholds and flags
  - Purpose: Detailed fantasy multi-category composite and tier classification.
  - Inputs/units: Riff percentiles SOG/hits/blocks; scoring goals/primary assists/points plus PP points for all/PP.
  - Output scale: Weighted score 0–100 = .45 mean(top2 riff)+.35 max(scoring)+.20 mean(all); BEAST+/BEAST/MCM/MCM Watch and signal counts.
  - Version/status: contextual_composites_v2; methodology and writer were dirty at inspection. Production deployment/active database state not checked.
- **Codex view (RANK-beast_tier, calculation, location; Codex family 'Contextual skater rankings'):** BEAST Tier
  - Purpose: Tier label for qualified multi-category players.
  - Inputs/units: Source skater_composite_ratings fields: skater_composite_ratings.beast_tier. Denominator: Eligibility thresholds applied to contextual percentile components.
  - Output scale: Eligibility gates based on verified live MCM percentile thresholds, including power-play points where PP rows are available. Contextual display may also include dense rank and percentile 0–100.
  - Version/status: contextual_rankings_v1; code-declared availability=available. Production deployment/active database state not checked.
- **Codex view (RANK-mcm_score, calculation, location; Codex family 'Contextual skater rankings'):** MCM Score
  - Purpose: Multi-category fantasy score based on verified live percentile components.
  - Inputs/units: Source skater_composite_ratings fields: skater_composite_ratings.mcm_score. Denominator: Weighted component percentiles from published contextual metric components.
  - Output scale: Weighted blend of riff score, live scoring score, and live category depth score, including power-play points where PP rows are available. Contextual display may also include dense rank and percentile 0–100.
  - Version/status: contextual_rankings_v1; code-declared availability=available. Production deployment/active database state not checked.
- **Audit context:**
  - Intent (Opus): metricDefinitions beast_tier description (web/lib/rankings/metricDefinitions.ts:926-956); tierComparison note skaterCompositeMethodology.ts:84
  - Intended contract (Codex RANK-MCM-DETAIL): All required inputs; no missing-input reweighting; six/seven-input variants not interchangeable; threshold on unrounded score.
  - Intended contract (Codex RANK-beast_tier): Eligibility gates based on verified live MCM percentile thresholds, including power-play points where PP rows are available. Source: web/lib/rankings/metricDefinitions.ts:926. Minimum GP 1, TOI 600 seconds.
  - Intended contract (Codex RANK-mcm_score): Weighted blend of riff score, live scoring score, and live category depth score, including power-play points where PP rows are available. Source: web/lib/rankings/metricDefinitions.ts:886. Minimum GP 1, TOI 600 seconds.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/rankings/skaterCompositeMethodology.test.ts`; `web/lib/rankings/skaterCompositeWriter.test.ts`
- **Leads (not audited):**
  - (opus) thresholds are hand-set magic numbers; BEAST+ riff requirement '3 riff >=80' equals all riff categories
  - (opus) MCM Watch has no score floor
  - (codex:RANK-MCM-DETAIL) No mathematical accuracy or fitness assessment performed. Tests listed, not run.
  - (codex:RANK-beast_tier) Registry formula is intended contract; implementation may have distinct missingness/variant rules. No agreement assessment performed.
  - (codex:RANK-mcm_score) Registry formula is intended contract; implementation may have distinct missingness/variant rules. No agreement assessment performed.

## M-RNK-022 Skater archetype scores & tags (shoot-first, pass-first, play-driver)

- **Match:** Both; Opus RNK-032; Codex RANK-ARCHETYPE
- **Purpose:** Proxy archetype scores and tags from component percentiles.
- **Where:** `web/lib/rankings/skaterCompositeWriter.ts:430 (calculateArchetypeScores)`; `web/lib/rankings/skaterCompositeWriter.ts:478 (archetypeTags)`; `web/lib/rankings/skaterCompositeMethodology.ts:135 (SKATER_ARCHETYPE_TAG_CONTRACTS)`; `web/lib/rankings/skaterCompositeWriter.ts:430 calculateArchetypeScores`; `web/lib/rankings/skaterCompositeMethodology.ts:135 SKATER_ARCHETYPE_TAG_CONTRACTS`
- **Tags (heuristic):** percent scale: 0-100; denominators: shots on goal; generation: development, current
- **Opus view (RNK-032):**
  - Method: shootFirst = wavg(iCF pct 0.55, SOG pct 0.35, (100-A1 pct) 0.10); passFirst = wavg(A1 0.6, A 0.3, (100-iCF) 0.1); playDriver = wavg(on-ice xGF% 0.5, iCF 0.25, A1 0.25); renormalize over non-null. Tags: shoot_first iCF>=75 & A1<70; pass_first A1>=75 & iCF<70; play_driver xGF%>=70 & max(iCF,A1)>=70; high_shot_volume score>=85; high_playmaking >=85.
  - Inputs/units: percentiles 0-100; sources: rolling_player_game_metrics
  - Output scale: 0-100 scores; tag strings; writes: skater_composite_ratings.shoot_first_score/pass_first_score/play_driver_score/tags
  - Status: live — update-skater-composite-ratings
  - Consumers: playerMatrix; PlayerSnapshotPanel
- **Codex view (RANK-ARCHETYPE, calculation, location; Codex family 'Contextual skater rankings'):** Shoot-first, pass-first and play-driver scores/tags
  - Purpose: Calculate contextual archetype proxies from component percentiles.
  - Inputs/units: Shot-attempt/SOG/primary-assist/assist/on-ice xGF percentiles.
  - Output scale: Three weighted 0–100 scores and threshold proxy tags.
  - Version/status: current_proxy; exact formula inputs source_pending. Production deployment/active database state not checked.
- **Audit context:**
  - Intent (Opus): SKATER_ARCHETYPE_TAG_CONTRACTS rules (web/lib/rankings/skaterCompositeMethodology.ts:135-186), exactFormulaStatus source_pending
  - Intended contract (Codex RANK-ARCHETYPE): Shoot .55 attempts+.35 SOG+.10 inverse primary assists; pass .60 primary+.30 assists+.10 inverse attempts; driver .50 on-ice xGF+.25 attempts+.25 primary.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/rankings/skaterCompositeMethodology.test.ts`; `web/lib/rankings/skaterCompositeWriter.test.ts`
- **Leads (not audited):**
  - (opus) tags treat a missing opposing percentile as 0 (?? 0), so shoot_first/pass_first fire when the other component is unavailable
  - (opus) play-driver uses 5v5-only on-ice xGF%, unavailable for non-5v5 strengths -> score falls back to iCF/A1 only
  - (codex:RANK-ARCHETYPE) No mathematical accuracy or fitness assessment performed. Tests listed, not run.

## M-RNK-023 xG denominator semantics helpers (xS%, SAX%, team shot quality, goalie xGA per Fenwick)

- **Match:** Both; Opus RNK-033; Codex TEAM-STYLE, XG-DENOM
- **Purpose:** Fenwick-denominator helpers for expected shooting %, shooting above expected, team xG/FF, goalie xGA/FA.
- **Where:** `web/lib/rankings/xgDenominatorSemantics.ts:35 (calculateExpectedShootingPercentage)`; `web/lib/rankings/xgDenominatorSemantics.ts:45 (calculateShootingAboveExpectedPercentage)`; `web/lib/rankings/xgDenominatorSemantics.ts:57 (calculateTeamShotQuality)`; `web/lib/rankings/xgDenominatorSemantics.ts:67 (calculateGoalieXgaPerUnblockedAttempt)`; `web/lib/rankings/teamStyleMethodology.ts:132 (calculateTeamShotQuality duplicate)`; `web/lib/rankings/teamStyleMethodology.ts:120 calculateTeamExpectedGoalsForPercentage`; `web/lib/rankings/teamStyleMethodology.ts:132 calculateTeamShotQuality`; `web/lib/rankings/teamStyleMethodology.ts:142 calculateRunAndGunProfile`; `web/lib/rankings/xgDenominatorSemantics.ts:35 calculateExpectedShootingPercentage`; `web/lib/rankings/xgDenominatorSemantics.ts:45 calculateShootingAboveExpectedPercentage`; `web/lib/rankings/xgDenominatorSemantics.ts:57 calculateTeamShotQuality`; `web/lib/rankings/xgDenominatorSemantics.ts:67 calculateGoalieXgaPerUnblockedAttempt`
- **Tags (heuristic):** percent scale: both/ambiguous; denominators: per game, unblocked attempts; generation: legacy, current
- **Opus view (RNK-033):**
  - Method: xS% = ixG/unblocked*100; SAX% = (G - ixG)/unblocked*100; team shot quality = xGF/FF; goalie xGA per unblocked = xGA/FA (6dp). Denominator must be >0.
  - Inputs/units: goals, xG (goals), unblocked attempt counts; sources: nhl_xg_player_rolling_aggregates / team / goalie aggregates (by field name)
  - Output scale: percent 0-100 (xS%, SAX%); xG per attempt fraction; writes: —
  - Status: legacy/dead — no non-test callers of xgDenominatorSemantics exports (rg); teamStyleMethodology duplicate is live
  - Consumers: teamMatrix.ts uses the teamStyleMethodology duplicate; xgDenominatorSemantics exports have no non-test callers found via rg
- **Codex view (TEAM-STYLE, calculation, location; Codex family 'Team rankings'):** Team xGF%, shot quality, pace/control and run-and-gun profile
  - Purpose: Describe team shot-process style with separate event and control axes.
  - Inputs/units: xGF/xGA expected goals, Fenwick attempts, games count, league event baseline.
  - Output scale: xGF%=100*xGF/(xGF+xGA); quality=xGF/FF; event rate=(xGF+xGA)/GP; pace/control categorical axes.
  - Version/status: team_rankings_v2_season_5v5_asof. Production deployment/active database state not checked.
- **Codex view (XG-DENOM, calculation, location; Codex family 'Expected goals'):** Unblocked-attempt xG denominator helpers
  - Purpose: Make shot-universe-specific ratios explicit.
  - Inputs/units: Goals, ixG/xGF/xGA in goal units and Fenwick/unblocked attempts.
  - Output scale: xSH%=100*ixG/unblocked; SAX%=100*(goals−ixG)/unblocked; team and goalie xG per unblocked attempt.
  - Version/status: Explicit denominator semantics helper. Production deployment/active database state not checked.
- **Audit context:**
  - Intent (Opus): XG_SHOT_UNIVERSE = 'fenwick_unblocked' (web/lib/rankings/xgDenominatorSemantics.ts:1)
  - Intended contract (Codex TEAM-STYLE): TEAM_STYLE_SOURCE_CONTRACT explicitly raw/contextual 5v5; adjusted target not yet wired.
  - Intended contract (Codex XG-DENOM): XG_SHOT_UNIVERSE=fenwick_unblocked; positive denominators required; 6-decimal rounding. Repository design sources: tasks/TASKS/xg-model/docs/definitions-and-parity.md; tasks/TASKS/xg-model/docs/data-contract-boundaries.md; tasks/TASKS/xg-model/baseline/xg-training-feature-contract.md. These document historical intent, not deployment evidence.
  - External references: MoneyPuck/Evolving-Hockey xG per Fenwick (unblocked) attempt
  - Fixtures/test data: none listed
  - Tests: `web/lib/rankings/teamStyleMethodology.test.ts`; `web/lib/rankings/xgDenominatorSemantics.test.ts`
- **Leads (not audited):**
  - (opus) dead code — no production callers of xgDenominatorSemantics functions; calculateTeamShotQuality duplicated in teamStyleMethodology
  - (opus) getGoalieXgAggregateFenwickAgainst maps shots_against (name suggests SOG) to Fenwick against
  - (codex:TEAM-STYLE) No mathematical accuracy or fitness assessment performed. Tests listed, not run.
  - (codex:XG-DENOM) No mathematical accuracy or fitness assessment performed. Tests listed, not run.

## M-RNK-024 Trending percentile deltas, trend score & opportunity signals

- **Match:** Both; Opus RNK-040; Codex RANK-TREND
- **Purpose:** Detect skaters whose recent percentiles/TOI moved vs longer windows.
- **Where:** `web/lib/rankings/trending.ts:286 (delta)`; `web/lib/rankings/trending.ts:359 (severityFromMagnitude)`; `web/lib/rankings/trending.ts:368 (buildToiOpportunitySignal)`; `web/lib/rankings/trending.ts:397 (buildShotVolumeOpportunitySignal)`; `web/lib/rankings/trending.ts:471 (buildTrendingSurface)`; `web/lib/rankings/trending.ts:471 buildTrendingSurface`; `web/lib/rankings/trending.ts:430 buildOpportunitySignals`
- **Tags (heuristic):** denominators: per 60, per game, shots on goal; generation: current
- **Opus view (RNK-040):**
  - Method: deltaLast5VsLast20 = pct(last5) - pct(last20); deltaLast5VsSeason likewise (1dp). trendScore = mean of last5-vs-last20 percentile deltas across selected metrics. TOI signal if \|TOI/G last5 - last20\| >= 30 s; severity 30/60/120 s. Shot-volume spike if iCF/60 (else SOG/60) percentile delta >= 8; severity 8/15/25 pts. Rows sorted by trendScore. Min GP per window via minGpForComparisonWindow.
  - Inputs/units: percentiles 0-100; TOI seconds per game; sources: rolling_player_game_metrics (via contextual surfaces)
  - Output scale: percentile-point deltas (-100..100); seconds; severity enum; writes: —
  - Status: live — /api/v1/contextual-rankings/trending
  - Consumers: /api/v1/contextual-rankings/trending; components/Rankings/TrendingPanel.tsx
- **Codex view (RANK-TREND, calculation, location; Codex family 'Contextual skater rankings'):** Window deltas and opportunity signals
  - Purpose: Compare L5/L10/L20/season ranks and values for usage/chance changes.
  - Inputs/units: Metric values/percentiles by player and window; TOI and shot volume.
  - Output scale: Raw/percentile deltas, severity and opportunity signal labels.
  - Version/status: Local contextual trend layer. Production deployment/active database state not checked.
- **Audit context:**
  - Intent (Opus): OPPORTUNITY_SIGNAL_CONTRACTS in web/lib/rankings/trending.ts; comment :311
  - Intended contract (Codex RANK-TREND): OPPORTUNITY_SIGNAL_CONTRACTS and fixed thresholds.
  - External references: Rolling-window form indicators; compare with EWMA or Bayesian updated rates
  - Fixtures/test data: none listed
  - Tests: `web/__tests__/pages/api/v1/contextual-rankings-trending.test.ts`; `web/lib/rankings/trending.test.ts`
- **Leads (not audited):**
  - (opus) last5 is a subset of last20 (overlapping windows) so deltas understate change and are partially self-correlated
  - (opus) percentiles in each window come from different qualified peer pools (min GP 2 vs 5), so percentile deltas mix player change with population change
  - (opus) no sample-size/regression adjustment — a 5-game percentile is very noisy; thresholds 8/15/25 and 30/60/120 are magic numbers
  - (codex:RANK-TREND) No mathematical accuracy or fitness assessment performed. Tests listed, not run.

## M-RNK-025 WAR surface (placeholder, no calculation)

- **Match:** Both; Opus RNK-043; Codex WAR-PLANNED
- **Purpose:** API stub that reports WAR as source_pending with prerequisites; no WAR/GAR numbers are computed anywhere in the rankings slice.
- **Where:** `web/lib/rankings/war.ts:127 (buildWarSurface)`; `web/lib/rankings/war.ts:57 (parseSeason)`; `web/pages/api/v1/contextual-rankings/war.ts:18`; `web/lib/rankings/rankingMetadata.ts:192`; `web/lib/rankings/war.ts:127 buildWarSurface`
- **Tags (heuristic):** generation: development, current
- **Opus view (RNK-043):**
  - Method: Returns static methodology {replacementBaseline null, formula null, denominator wins}; prerequisites replacement baseline (missing), position adjustment (missing), win conversion (needs_validation), snapshot join (available_not_joined).
  - Inputs/units: —; sources: —
  - Output scale: none (empty rows); writes: —
  - Status: draft — route /api/v1/contextual-rankings/war returns source_pending
  - Consumers: components/Rankings/WarPanel.tsx; rankingMetadata
- **Codex view (WAR-PLANNED, calculation, location; Codex family 'Planned metrics'):** Wins Above Replacement
  - Purpose: Track requested calculation surface that does not yet define a formula.
  - Inputs/units: Replacement baseline, position adjustment and goals-to-wins inputs are prerequisites, not established.
  - Output scale: No computed rows; formula/version/baseline null; intended unit wins.
  - Version/status: Not implemented as a numerical model. Production deployment/active database state not checked.
- **Audit context:**
  - Intent (Opus): sourcePendingReason text web/lib/rankings/war.ts:145
  - Intended contract (Codex WAR-PLANNED): Explicit source_pending contract; missing replacement level/position adjustments/goals-to-wins.
  - External references: Evolving-Hockey GAR/WAR (replacement level, goals-to-wins ~5.5-6 goals/win), TopDownHockey WAR
  - Fixtures/test data: none listed
  - Tests: `No adjacent test located; broader suites not exhaustively traced.`; `web/__tests__/pages/api/v1/contextual-rankings-war.test.ts`
- **Leads (not audited):**
  - (opus) parseSeason defaults to hard-coded 20252026
  - (opus) no WAR/GAR implementation exists; offense/defense ratings are percentile composites and are not convertible to goals or wins
  - (codex:WAR-PLANNED) No mathematical accuracy or fitness assessment performed. Tests listed, not run.

## M-RNK-026 Season-decayed player impact priors

- **Match:** Both; Opus RNK-044; Codex IMPACT-PRIOR
- **Purpose:** Blend multiple seasons of impact ratings with fixed season decay weights.
- **Where:** `web/lib/ratings/playerImpactRatings.ts:504 (defaultPlayerImpactSeasonDecayWeight)`; `web/lib/ratings/playerImpactRatings.ts:517 (buildSeasonDecayedPlayerImpactPriors)`; `web/lib/ratings/playerImpactRatings.ts:517 buildSeasonDecayedPlayerImpactPriors`; `web/lib/ratings/playerImpactRatings.ts:504 defaultPlayerImpactSeasonDecayWeight`
- **Tags (heuristic):** percent scale: 0-100; generation: legacy, current
- **Opus view (RNK-044):**
  - Method: Season weight by age: current 1.0, prior 0.65, two back 0.35, three back 0.20, else 0 (overridable). ratingRaw = sum(w*rating_raw)/sum(w); re-ranked to ordinal percentile 0-100. sample games/TOI summed across all input rows.
  - Inputs/units: rating_raw z-composite; ratings 0-100; sources: skater_offensive_ratings_daily, skater_defensive_ratings_daily, goalie_ratings_daily
  - Output scale: 0-100 ordinal percentile; writes: —
  - Status: legacy/dead — no non-test callers of buildSeasonDecayedPlayerImpactPriors
  - Consumers: no non-test callers found (rg)
- **Codex view (IMPACT-PRIOR, calculation, location; Codex family 'Player impact ratings'):** Season-decayed impact priors
  - Purpose: Combine current and earlier-season impact estimates.
  - Inputs/units: Season-specific raw ratings/0–100 rating and season IDs.
  - Output scale: Weighted raw prior, average rating and reranked percentile/0–100.
  - Version/status: player_impact_season_decay_v1_current_1_prev_0_65_prev2_0_35_prev3_0_2. Production deployment/active database state not checked.
- **Audit context:**
  - Intent (Opus): PLAYER_IMPACT_SEASON_DECAY_VERSION 'player_impact_season_decay_v1_current_1_prev_0_65_prev2_0_35_prev3_0_2' (playerImpactRatings.ts:85)
  - Intended contract (Codex IMPACT-PRIOR): Current 1, prior .65, prior2 .35, prior3 .20 by declared version.
  - External references: Marcel-style weighting (5/4/3) with regression
  - Fixtures/test data: none listed
  - Tests: `web/lib/ratings/playerImpactRatings.test.ts`
- **Leads (not audited):**
  - (opus) legacy/dead — no production callers
  - (opus) if multiple daily snapshot rows per season are passed, each snapshot gets full season weight and sample_games/TOI are summed across snapshots (inflated)
  - (opus) no regression to the mean despite being called a 'prior'
  - (codex:IMPACT-PRIOR) No mathematical accuracy or fitness assessment performed. Tests listed, not run.

## M-RNK-027 Player impact ratings (skater offense/defense, goalie) — z-score composite with TOI shrinkage

- **Match:** Both; Opus RNK-045; Codex IMPACT-GOALIE, IMPACT-SKATER
- **Purpose:** Season-to-date 0-100 impact ratings for skaters (offense, defense) and goalies from NST game logs.
- **Where:** `web/lib/ratings/playerImpactRatings.ts:88 (OFFENSE_COMPONENTS)`; `web/lib/ratings/playerImpactRatings.ts:99 (DEFENSE_COMPONENTS)`; `web/lib/ratings/playerImpactRatings.ts:110 (GOALIE_COMPONENTS)`; `web/lib/ratings/playerImpactRatings.ts:190 (aggregateSkaters)`; `web/lib/ratings/playerImpactRatings.ts:293 (aggregateGoalies)`; `web/lib/ratings/playerImpactRatings.ts:161 (zScore)`; `web/lib/ratings/playerImpactRatings.ts:166 (meanAndStdDev)`; `web/lib/ratings/playerImpactRatings.ts:437 (buildRows)`; `web/lib/ratings/playerImpactRatings.ts:636 (buildPlayerImpactRatings)`; `web/lib/ratings/playerImpactRatings.ts:395 goalieComponents`; `web/lib/ratings/playerImpactRatings.ts:437 buildRows`; `web/lib/ratings/playerImpactRatings.ts:636 buildPlayerImpactRatings`
- **Tags (heuristic):** percent scale: both/ambiguous; denominators: per 60, per game, shots on goal; generation: current
- **Opus view (RNK-045):**
  - Method: Per player, TOI-weighted mean of per-game per-60 rates over all game rows <= snapshot. Components z-scored across all players (population SD; missing -> z=0). Offense = 0.24 P/60 + 0.16 G/60 + 0.12 A1/60 + 0.16 ixG/60 + 0.10 SOG/60 + 0.08 iCF/60 + 0.08 oiXGF/60 + 0.06 (oiXGF%-50). Defense = 0.24 -oiXGA/60 + 0.14 -oiCA/60 + 0.12 -oiSCA/60 + 0.16 (oiXGF%-50) + 0.12 (oiCF%-50) + 0.10 blocks/60 + 0.08 (TK-GV)/60 + 0.04 DZS/60. Goalie = 0.50 GSAA/60 + 0.28 SV% + 0.12 QS% + 0.10 -GA/60. Raw x shrink factor TOI/(TOI+k), k=3600 s skaters, 2400 s goalies. rating_0_to_100 = ordinal percentile 100*(1 - index/(N-1)).
  - Inputs/units: per-60 rates; percentages 0-100 for oi%; TOI seconds (assumed); SV% fraction; sources: player_stats_unified, vw_goalie_stats_unified
  - Output scale: 0-100 ordinal percentile; raw weighted z-score; writes: skater_offensive_ratings_daily, skater_defensive_ratings_daily, goalie_ratings_daily (via web/pages/api/v1/db/update-player-impact-ratings.ts)
  - Status: live — /api/v1/db/update-player-impact-ratings
  - Consumers: lib/xg/qotQoc.ts (QoT/QoC inputs); lib/game-predictions/featureBuilder.ts; lib/underlying-stats/entityRatingsOverlay.ts; update-nhl-xg-qot-qoc
- **Codex view (IMPACT-GOALIE, calculation, location; Codex family 'Player impact ratings'):** TOI-shrunk goalie impact rating
  - Purpose: Blend goalie save performance into an impact rank.
  - Inputs/units: GSAA/60, SV fraction, quality-start fraction, negative GA/60; TOI seconds.
  - Output scale: Raw weighted z-score and TOI-shrunk rating; rank/percentile/0–100.
  - Version/status: goalie_impact_v1_game_log_toi_shrunk. Production deployment/active database state not checked.
- **Codex view (IMPACT-SKATER, calculation, location; Codex family 'Player impact ratings'):** TOI-shrunk skater offense and defense ratings
  - Purpose: Weight standardized historical performance into comparable impact scores.
  - Inputs/units: Game-log per60 metrics and on-ice percentages; TOI seconds.
  - Output scale: Weighted z-score raw rating shrunk by sample; ordered rating 0–100 and percentile 0–1.
  - Version/status: skater_impact_v1_game_log_toi_shrunk. Production deployment/active database state not checked.
- **Audit context:**
  - Intent (Opus): model versions skater_impact_v1_game_log_toi_shrunk / goalie_impact_v1_game_log_toi_shrunk (playerImpactRatings.ts:83-84); sql/ratings/001_create_analytics_rating_contracts.sql
  - Intended contract (Codex IMPACT-GOALIE): Weights .50 GSAA/60, .28 SV%, .12 QS%, .10 negative GA/60.
  - Intended contract (Codex IMPACT-SKATER): OFFENSE_COMPONENTS eight weighted metrics; DEFENSE_COMPONENTS eight metrics; population z-scores and TOI shrinkage.
  - External references: Evolving-Hockey RAPM/GAR; standard z-score composites with position-specific pools
  - Fixtures/test data: none listed
  - Tests: `web/lib/ratings/playerImpactRatings.test.ts`
- **Leads (not audited):**
  - (opus) forwards and defensemen z-scored in one pool (no position adjustment)
  - (opus) missing components contribute z=0 (imputed league mean) rather than being excluded
  - (opus) no minimum-TOI filter before percentile ranking — every player with any TOI gets a 0-100 rating; shrinkage only scales raw score
  - (opus) TOI weight uses nst_toi ?? toi_per_game — units (minutes vs seconds) of nst_toi not verified; if nst_toi is minutes and toi_per_game seconds, weights mix units
  - (opus) goalie GSAA uses nst_all_counts_gsaa ?? nst_5v5_counts_gsaa per row (mixed strengths across rows)
  - (opus) defense rewards more defensive-zone starts per 60 (usage, not impact); oiXGF% edge counted in both offense and defense
  - (opus) weights are hand-set magic numbers, collinear components (P/60 & G/60 & A1/60)
  - (codex:IMPACT-GOALIE) No mathematical accuracy or fitness assessment performed. Tests listed, not run.
  - (codex:IMPACT-SKATER) No mathematical accuracy or fitness assessment performed. Tests listed, not run.

## M-RNK-028 Player percentile rank across skaters (avg stats)

- **Match:** Opus only; Opus RNK-001; Codex —
- **Purpose:** Percentile of a player's per-game goals, assists, +/-, PIM, hits, blocks, PPP and shots among all skaters in a date window.
- **Where:** `web/pages/api/v1/player/[id]/percentile-rank.ts:27 (getPercentileRank)`; `web/pages/api/v1/player/[id]/percentile-rank.ts:83 (getSinglePercentileRank)`
- **Tags (heuristic):** percent scale: 0-100; denominators: per game; generation: legacy
- **Opus view (RNK-001):**
  - Method: percentile = index of player's value in the sorted array / N * 100 (rounded 2 dp). No minimum games filter.
  - Inputs/units: per-game averages from the RPC; sources: rpc get_skaters_avg_stats
  - Output scale: 0-100 percentile; writes: —
  - Status: legacy/dead — no callers found; route ledger incoming_counts {}
  - Consumers: none found
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: Standard percentile rank (count below + 0.5*ties)/N
  - Fixtures/test data: none listed
  - Tests: none listed
- **Leads (not audited):**
  - (opus) Array.sort() with no comparator sorts numbers as strings (e.g. 10 < 9, negatives misplaced), so percentiles are wrong
  - (opus) findIndex returns the first tie, so ties get the lowest percentile; top player maxes at (N-1)/N*100
  - (opus) no games-played floor; one-game players distort the distribution
  - (opus) when player is absent returns 0 for all, indistinguishable from a real 0th percentile

## M-RNK-029 Legacy /api/v1/rankings start-chart scaffold

- **Match:** Opus only; Opus RNK-002; Codex —
- **Purpose:** Deprecated route returning empty projected-points rankings.
- **Where:** `web/pages/api/v1/rankings.ts:46 (handler)`
- **Tags (heuristic):** generation: legacy
- **Opus view (RNK-002):**
  - Method: No calculation; returns rankings [] with Deprecation headers.
  - Inputs/units: —; sources: —
  - Output scale: —; writes: —
  - Status: legacy/dead — Deprecation header, rankings always []
  - Consumers: unknown
- **Audit context:**
  - Intent (Opus): TODO comment web/pages/api/v1/rankings.ts:67
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/__tests__/pages/api/v1/rankings.test.ts`
- **Leads (not audited):**
  - (opus) dead scaffold with TODO; schema advertises projectedPoints/multipliers never computed

## M-RNK-030 Skater contextual metric catalogue (per-60 rates, shares, regression metrics)

- **Match:** Opus only; Opus RNK-003; Codex —
- **Purpose:** Definitions, formulas, directionality and minimums for every contextual skater ranking metric.
- **Where:** `web/lib/rankings/metricDefinitions.ts:195 (CONTEXTUAL_RANKING_METRIC_DEFINITION_INPUTS)`; `web/lib/rankings/metricDefinitions.ts:92 (defaultDenominatorKey)`; `web/lib/rankings/metricDefinitions.ts:141 (defaultSourceQualityFlags)`
- **Tags (heuristic):** percent scale: 0-100; denominators: per 60, 5v5 only, unblocked attempts, shots on goal; generation: development, current
- **Opus view (RNK-003):**
  - Method: goals/assists/primary_assists/points/sog/shot_attempts(NST iCF)/hits/blocks/ixG/penalties_taken per 60 = count/TOIsec*3600; pp_points_per_60 = PP points / PP TOI *3600 (minToi 120); xGA/60 on-ice (5v5 only, lower better, minToi 600); xS% = ixG/unblocked attempts*100; SAX% = Sh% - xS%; GAx = G - ixG; unrealized xG = ixG - G; on-ice GF% = GF/(GF+GA); on-ice xGF% = xGF/(xGF+xGA) (5v5 only); rel 5v5 GF%/xGF% planned (blocked); offense/defense/MCM/BEAST/results_luck read from skater_composite_ratings. methodologyVersion contextual_rankings_v1.
  - Inputs/units: counts and TOI seconds from rolling windows; xG in goals; sources: rolling_player_game_metrics, skater_composite_ratings
  - Output scale: per-60 rates; percentages 0-100; goal differences (counts); writes: —
  - Status: live — registry for /rankings pages and writers; rel_5v5_* are 'planned' (blockedFromLiveMatrix)
  - Consumers: rankingCalculator; skaterWindowAggregation; rankingQueries; entityMetricRanking*; Rankings UI
- **Audit context:**
  - Intent (Opus): description/formulaDescription fields in web/lib/rankings/metricDefinitions.ts:195-956; PRD tasks/TASKS/contextual-hockey-rankings/prd-contextual-hockey-rankings.md
  - External references: NST per-60 and on-ice share conventions; Evolving-Hockey RAPM for relative metrics
  - Fixtures/test data: none listed
  - Tests: `web/lib/rankings/metricDefinitions.test.ts`
- **Leads (not audited):**
  - (opus) shot_attempts_per_60 is documented as NST iCF (incl. blocked), but expected_shooting_percentage/SAX% describe the same shot_attempts field as unblocked (Fenwick) — inconsistent denominator semantics
  - (opus) SAX% uses attempts not SOG, so 'actual shooting %' is goals/attempts, not NHL Sh% (goals/SOG)
  - (opus) GAx and unrealized xG are raw counts (not rate) ranked across players with very different TOI
  - (opus) penalties_taken_per_60 counts penalties not PIM and is not net of penalties drawn

## M-RNK-031 Player matrix composite cells & composite-sort ranking

- **Match:** Opus only; Opus RNK-004; Codex —
- **Purpose:** Show composite ratings in the skater matrix and rank players when sorting by a composite.
- **Where:** `web/lib/rankings/playerMatrix.ts:580 (compositeMetricValue)`; `web/lib/rankings/playerMatrix.ts:846 (compositeSample)`; `web/lib/rankings/playerMatrix.ts:872 (cellFromCompositeRow)`; `web/lib/rankings/playerMatrix.ts:1091 (composite sort ranks)`; `web/lib/rankings/playerMatrix.ts:1338 (sortOverallScope)`
- **Tags (heuristic):** percent scale: 0-100; generation: current
- **Opus view (RNK-004):**
  - Method: Composite cell 'percentile' = the composite raw value itself (offense/defense/MCM) or clamp(results_luck_index, 0, 100); null if sample minimum not met. Composite sort ranks = rankNormalizedMetricValues over composite values, sign-flipped when sortDirection=asc. Overall value falls back from *_overall to *_deployment.
  - Inputs/units: composite scores 0-100; luck index ~0-200; sources: skater_composite_ratings, rolling_player_game_metrics, entity_metric_rankings
  - Output scale: pseudo-percentile 0-100; rank 1..N; writes: —
  - Status: live — /rankings matrix
  - Consumers: components/Rankings/PlayerMatrixTable.tsx; /api/v1/contextual-rankings matrix
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED (no comment for percentile substitution)
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/__tests__/pages/api/v1/contextual-rankings-matrix.test.ts`; `web/components/Rankings/PlayerMatrixTable.test.tsx`; `web/lib/rankings/playerMatrix.test.ts`
- **Leads (not audited):**
  - (opus) composite 0-100 weighted scores are displayed in the percentile slot although they are not percentiles (MCM contract says it is not a percentile)
  - (opus) results_luck_index (centred at 100, range 0-200) is clamped to 0-100 as a 'percentile', so every hot/normal player (>=100) shows 100
  - (opus) composite rank depends on sort direction (asc flips sign -> rank 1 = lowest)
  - (opus) overall ?? deployment fallback can show a deployment-peer composite in an overall column

## M-RNK-032 Player matrix all-strengths TOI per game

- **Match:** Opus only; Opus RNK-005; Codex —
- **Purpose:** Display all-strength TOI/GP next to strength-specific rows.
- **Where:** `web/lib/rankings/playerMatrix.ts:649 (allStrengthsToiPerGame)`; `web/lib/rankings/playerMatrix.ts:671 (fetchAllStrengthsToiByPlayerId)`
- **Tags (heuristic):** denominators: per game; generation: current
- **Opus view (RNK-005):**
  - Method: season: toi_seconds_avg_season; last-N: toi_total_lastN / min(seasonGP, N).
  - Inputs/units: TOI seconds; sources: rolling_player_game_metrics (strength all)
  - Output scale: seconds per game; writes: —
  - Status: live
  - Consumers: PlayerMatrixTable
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/rankings/playerMatrix.test.ts`
- **Leads (not audited):**
  - (opus) last-N divisor min(seasonGP, N) disagrees with resolveGamesPlayed in skaterWindowAggregation (which lets last-N span prior season); early-season TOI/GP is overstated when window includes prior-season games

## M-RNK-033 Team matrix ranking (power-rating passthrough + percentiles)

- **Match:** Opus only; Opus RNK-009; Codex —
- **Purpose:** Rank 19 team metrics (power ratings, style, luck, context, unit usage) with shared percentile convention.
- **Where:** `web/lib/rankings/teamMatrix.ts:752 (rankTeamMetricValues)`; `web/lib/rankings/teamMatrix.ts:710 (metricValue)`; `web/lib/rankings/teamMatrix.ts:765 (aggregateTeamStyleRows)`; `web/lib/rankings/teamMatrix.ts:1020 (aggregateNstTeamStyleRows)`; `web/lib/rankings/teamMatrix.ts:1365 (buildTeamMatrixSurface)`
- **Tags (heuristic):** percent scale: 0-100; denominators: per 60, 5v5 only; generation: current
- **Opus view (RNK-009):**
  - Method: Event window = season start to min(asOf, regular-season end) and capped at latest power date; regular-season games only (type 2). Style totals summed per team; NST 5v5 fallback sums gp and counts across dated rows when team_underlying missing. Each metric ranked via rankNormalizedMetricValues with lowerIsBetter flip (xga60, Pen/60). methodologyVersion team_rankings_v2_season_5v5_asof.
  - Inputs/units: mixed (ratings, per-60, %, counts); sources: seasons, team_power_ratings_daily, team_underlying_stats_summary, nst_team_5v5, wgo_team_stats, games, team_unit_toi, teams
  - Output scale: rank 1..32, percentile 0-100; writes: —
  - Status: live — methodologyVersion team_rankings_v2_season_5v5_asof (teamMatrix.ts:1671)
  - Consumers: /api/v1/contextual-rankings team matrix; components/Rankings/TeamMatrixTable.tsx
- **Audit context:**
  - Intent (Opus): comment web/lib/rankings/teamMatrix.ts:1378-1379 (event components stop at selected power snapshot)
  - External references: NST team 5v5 tables
  - Fixtures/test data: none listed
  - Tests: `web/__tests__/pages/api/v1/contextual-rankings-matrix.test.ts`; `web/components/Rankings/GoalieTeamMatrixTable.test.tsx`; `web/lib/rankings/teamMatrix.test.ts`
- **Leads (not audited):**
  - (opus) NST fallback sums gp and counts across dated rows; percentUnits.ts:62-65 documents nst team rows as one regular-season date per row, so summing appears consistent (verify nst_team_5v5 specifically)
  - (opus) power-rating columns retain their own strength context while style columns are 5v5 (mixed strengths in one matrix, acknowledged in warnings)
  - (opus) no minimum-games gate before ranking team style/luck metrics

## M-RNK-034 Team unit TOI builder (5v5 lines/pairs and PP units, pooled player-seconds)

- **Match:** Opus only; Opus RNK-017; Codex —
- **Purpose:** Derive per-game forward-line, defense-pair and PP-unit TOI and shares from raw shifts.
- **Where:** `web/lib/rankings/teamUnitToiBuilder.ts:239 (buildEvenStrengthTeamUnitToiRows)`; `web/lib/rankings/teamUnitToiBuilder.ts:346 (buildPowerPlayTeamUnitToiRows)`; `web/lib/rankings/teamUnitToiBuilder.ts:195 (emitRankedRows)`; `web/lib/rankings/teamUnitToiWriter.ts:92`; `web/supabase/migrations/20260622150500_create_team_unit_toi.sql:23 (unit_share generated column)`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: per game, 5v5 only; generation: current
- **Opus view (RNK-017):**
  - Method: Per game-period, split time at every shift boundary; a segment is 5v5 if both teams have exactly 5 skaters (F or D) on ice; only exact 3F+2D configurations counted. Unit seconds = segment duration x player count (pooled player-seconds); units are exact player sets ranked by pooled seconds -> unit_number 1..k. Coverage partial if any skater has an unclassified position. PP: unit from powerPlayCombinations, pool = sum of PPTOI across all PP players; unit seconds = sum of its players' PPTOI. unit_share (DB generated) = unit_toi_seconds / team_unit_pool_toi_seconds.
  - Inputs/units: shift seconds within period; PPTOI seconds; sources: nhl_api_shift_rows, players, powerPlayCombinations, games
  - Output scale: seconds; share fraction 0-1; writes: team_unit_toi
  - Status: live — update-team-unit-toi registered in route runner (web/lib/routeRunner/registry.ts:156)
  - Consumers: teamMatrix.aggregateTeamUnitToiRows; web/pages/api/v1/db/update-team-unit-toi.ts (route runner nightly)
- **Audit context:**
  - Intent (Opus): comments web/lib/rankings/teamUnitToiBuilder.ts:86-92; migration comment on unit_share (20260622150500_create_team_unit_toi.sql:83)
  - External references: NST/HockeyViz line-combination TOI (5v5 shared ice time)
  - Fixtures/test data: none listed
  - Tests: `web/__tests__/pages/api/v1/db/update-team-unit-toi.test.ts`; `web/lib/rankings/teamUnitToiBuilder.test.ts`; `web/lib/rankings/teamUnitToiNightly.test.ts`; `web/lib/rankings/teamUnitToiWriter.test.ts`
- **Leads (not audited):**
  - (opus) 5v5 detection counts skaters only (goalie presence not checked), so 5v5 with a pulled goalie in some edge cases may be included
  - (opus) line 1 is defined as the most-used exact trio in that game, so line shuffles fragment units and lower 'top load'
  - (opus) PP unit membership comes from powerPlayCombinations.unit (external), while pool is total PPTOI incl. units 3+ — PP1/PP2 share depends on that labelling

## M-RNK-035 Goalie matrix sample gate, confidence and ranking

- **Match:** Opus only; Opus RNK-020; Codex —
- **Purpose:** Qualify goalies by starts/shots and rank 11 goalie metrics.
- **Where:** `web/lib/rankings/goalieMatrix.ts:637 (sampleConfidence)`; `web/lib/rankings/goalieMatrix.ts:1121 (rankGoalieMetricValues)`; `web/lib/rankings/goalieMatrix.ts:1310 (buildGoalieMatrixSurface)`; `web/lib/rankings/goaliePopulation.ts:91 (reconcileGoaliePopulation)`
- **Tags (heuristic):** percent scale: 0-100; generation: current
- **Opus view (RNK-020):**
  - Method: Population anchored on official WGO appearances (regular season type 2, games_played>0), NST advanced fields joined by player/date only when unique. Qualified if starts>=minStarts and SA>=minShots and role matches; confidence high if min(starts/minStarts, SA/minShots)>=2 else medium; below min -> low. Ranked with shared percentile convention; RBS% lower-is-better.
  - Inputs/units: start counts; shot counts; sources: goalie_stats_unified, wgo_goalie_stats, wgo_team_stats, games, goalie_start_projections, players, teams
  - Output scale: rank 1..N; percentile 0-100; writes: —
  - Status: live — goalie matrix
  - Consumers: GoalieMatrixTable.tsx; /api/v1 goalie matrix
- **Audit context:**
  - Intent (Opus): comment web/lib/rankings/goaliePopulation.ts:87-90 (official appearances anchor eligibility)
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/rankings/goalieMatrix.test.ts`; `web/lib/rankings/goaliePopulation.test.ts`
- **Leads (not audited):**
  - (opus) role filter is applied before ranking so percentiles are within-role, changing meaning with the filter
  - (opus) default minimum 3 starts / 100 shots is a tiny sample for SV%-type metrics (SV% SD ~ .015 at 1,000 shots)

## M-RNK-036 Skater composite source population & coverage gate

- **Match:** Opus only; Opus RNK-026; Codex —
- **Purpose:** Define the composite ranking population (latest regular-season appearance per player) and verify rolling rows exist for each.
- **Where:** `web/lib/rankings/skaterCompositeSourceCoverage.ts:34 (loadAndCheckSourceCoverage)`; `web/lib/rankings/skaterCompositeSourceCoverage.ts:151 (loadSkaterCompositeSeasonSources)`
- **Tags (heuristic):** generation: current
- **Opus view (RNK-026):**
  - Method: Regular season = game_id digits 5-6 == 02; latest appearance per player since Sept 1 of season start through cutoff; each must have a rolling row at that exact date for the requested strength; caps 60,000 WGO rows and 40x50 player chunks; any gap -> blocker.
  - Inputs/units: dates; ids; sources: wgo_skater_stats, rolling_player_game_metrics
  - Output scale: boolean verified + blockers; writes: —
  - Status: live — update-skater-composite-ratings
  - Consumers: buildSkaterCompositeRatingRows
- **Audit context:**
  - Intent (Opus): comment web/lib/rankings/skaterCompositeSourceCoverage.ts:74 and :99-100
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/rankings/skaterCompositeSourceCoverage.test.ts`
- **Leads (not audited):**
  - (opus) players' windows are taken at their own last-game date, so injured/scratched players are ranked on stale windows alongside current ones
  - (opus) for pp/pk strength a player whose last game has no PP/PK rolling row blocks publication (strict but may make PP composites unpublishable)
  - (opus) 2,000-player cap (40 x 50) on coverage queries

## M-RNK-037 Skater composite publication gate & population re-check

- **Match:** Opus only; Opus RNK-027; Codex —
- **Purpose:** Verify published percentiles reproduce from the raw population and block partial/combined-filter publication.
- **Where:** `web/lib/rankings/skaterCompositeWriter.ts:202 (metricPercentilesMatchPopulation)`; `web/lib/rankings/skaterCompositeWriter.ts:636 (buildSkaterCompositeRatingRows)`; `web/lib/rankings/skaterCompositeWriter.ts:762 (upsertSkaterCompositeRatingRows)`
- **Tags (heuristic):** generation: current
- **Opus view (RNK-027):**
  - Method: Recompute percentile per peer group = 100*worse/(N-1) (N=1 -> 100), compare within 1e-6; blockers for unverified coverage, snapshot mismatch, duplicates, peer-group inconsistency, truncation, >1 combined filter, custom minGp!=1 or minToi!=300. Upsert <=1000 rows atomically.
  - Inputs/units: percentiles 0-100; sources: rolling_player_game_metrics, players, teams, games
  - Output scale: boolean gate + blocker strings; writes: skater_composite_ratings (upsert key player_id,season_id,snapshot_date,window_type,window_size,strength_state,peer_group_type,peer_group_key)
  - Status: live — update-skater-composite-ratings
  - Consumers: web/pages/api/v1/db/update-skater-composite-ratings.ts
- **Audit context:**
  - Intent (Opus): comments web/lib/rankings/skaterCompositeWriter.ts:200-201, 734, 768-769
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/__tests__/pages/api/v1/db/update-skater-composite-ratings.test.ts`; `web/lib/rankings/skaterCompositeWriter.test.ts`
- **Leads (not audited):**
  - (opus) re-check treats every component as higher-is-better (comment line 201); fine for MCM components but xga_per_60 (lower-is-better) is excluded from requiredMetrics only by construction
  - (opus) durable key only supports minGp=1/minToi=300 — the published composite always uses the very low default sample floor

## M-RNK-038 Rankings UI score tones and snapshot strengths/weak spots

- **Match:** Opus only; Opus RNK-034; Codex —
- **Purpose:** Client-side percentile banding for score tiles and player snapshot highlights.
- **Where:** `web/components/Rankings/matrixScoreFormatting.ts:8 (getScoreTileTone)`; `web/components/Rankings/matrixScoreFormatting.ts:3 (formatPercentileScore)`; `web/components/Rankings/PlayerSnapshotPanel.tsx:122 (topStrengths)`; `web/components/Rankings/PlayerSnapshotPanel.tsx:130 (weakSpots)`; `web/components/Rankings/ComparisonSummaryPanel.tsx:57 (TOI/GP)`
- **Tags (heuristic):** denominators: per game; generation: current
- **Opus view (RNK-034):**
  - Method: Tones: >=95 peak, >=90 elite, >=80 strong, >=60 positive, >=40 neutral, >=20 weak, else poor. Strengths: top 4 metrics with percentile >=80 else top 3; weak spots: up to 4 with percentile <=39. TOI/G = round(TOI/GP).
  - Inputs/units: percentile 0-100; sources: —
  - Output scale: categorical tone; lists; writes: —
  - Status: live — /rankings page
  - Consumers: PlayerMatrixTable; GoalieMatrixTable; TeamMatrixTable; PlayerSnapshotPanel; ComparisonSummaryPanel
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/components/Rankings/PlayerMatrixTable.test.tsx`; `web/components/Rankings/PlayerSnapshotPanel.test.tsx`
- **Leads (not audited):**
  - (opus) composite scores and clamped luck index flow into the same percentile bands/strength lists as true percentiles

## M-RNK-039 Entity metric rankings snapshot writer/reader (persisted percentiles, re-ranked on read)

- **Match:** Opus only; Opus RNK-035; Codex —
- **Purpose:** Persist per-metric skater ranks/percentiles and re-rank on read under the request's minimums.
- **Where:** `web/lib/rankings/entityMetricRankingWriter.ts:203 (toInsertRow)`; `web/lib/rankings/entityMetricRankingWriter.ts:257 (buildEntityMetricRankingRows)`; `web/lib/rankings/entityMetricRankingWriter.ts:310 (upsertEntityMetricRankingRows)`; `web/lib/rankings/entityMetricRankingReader.ts:428 (re-rank via buildContextualRankingRows)`; `web/lib/rankings/rankingQueries.ts:1054 (buildSnapshotFirstContextualRankingsSurface)`
- **Tags (heuristic):** percent scale: 0-100; generation: current
- **Opus view (RNK-035):**
  - Method: Writer stores raw_value, normalized_value, raw_rank, percentile, qualified_peer_count, sample flags (methodology contextual_rankings_v1). Reader ignores stored ranks and recomputes rank/percentile from stored raw_value, GP, TOI under the request minGp/minToi and peer group. Snapshot-first surface falls back to live rolling computation when no rows.
  - Inputs/units: as per metric; sources: rolling_player_game_metrics, entity_metric_rankings
  - Output scale: rank 1..N; percentile 0-100; writes: entity_metric_rankings
  - Status: live — update-entity-metric-rankings route; reader used by snapshot-first surfaces
  - Consumers: web/pages/api/v1/db/update-entity-metric-rankings.ts; playerMatrix; Metric Explorer
- **Audit context:**
  - Intent (Opus): comments web/lib/rankings/entityMetricRankingReader.ts:428-429, 558-560
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/__tests__/pages/api/v1/db/update-entity-metric-rankings.test.ts`; `web/lib/rankings/entityMetricRankingReader.test.ts`; `web/lib/rankings/entityMetricRankingWriter.test.ts`
- **Leads (not audited):**
  - (opus) chunked, split-on-failure upserts are not atomic (contrast with skater composite atomic upsert) — a partially replaced cohort is possible
  - (opus) stored raw_value for season xGA/60 inherits the per-game-average TOI sample issue

## M-RNK-040 Window-scaled minimum GP defaults (min GP by window, comparison-window min GP)

- **Match:** Opus only; Opus RNK-036; Codex —
- **Purpose:** Set default sample minimums per window and translate a base min GP into comparison windows.
- **Where:** `web/lib/rankings/rankingUrlState.ts:65 (DEFAULT_MIN_GP_BY_WINDOW)`; `web/lib/rankings/rankingUrlState.ts:85 (minGpForComparisonWindow)`; `web/lib/rankings/rankingUrlState.ts:98 (DEFAULT_RANKINGS_FILTERS)`
- **Tags (heuristic):** generation: current
- **Opus view (RNK-036):**
  - Method: Defaults: season 10 GP, last20 5, last10 3, last5 2; min TOI 300 s for all windows. If base uses its window default, target uses its own default; else min(baseMinGp, window length).
  - Inputs/units: games; seconds; sources: —
  - Output scale: GP integer; writes: —
  - Status: live — Rankings page URL state
  - Consumers: trending.ts; splits.ts; Rankings page filters
- **Audit context:**
  - Intent (Opus): comments web/lib/rankings/rankingUrlState.ts:63-64 and :82-84
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/rankings/rankingUrlState.test.ts`
- **Leads (not audited):**
  - (opus) UI default (10 GP season) differs from server metric default (minimumGp 1) and from the composite publishing key (minGp 1 / 300 s), so published composites use looser samples than the page
  - (opus) DEFAULT_RANKINGS_FILTERS.season hard-coded '20252026'
  - (opus) minToi 300 s does not scale with window

## M-RNK-041 Skater window aggregation from rolling rows (per-60 / derived metrics)

- **Match:** Opus only; Opus RNK-037; Codex —
- **Possible related records (low-confidence location link, unconfirmed):** RANK-assists_per_60, RANK-blocks_per_60, RANK-expected_shooting_percentage, RANK-goals_above_expected, RANK-goals_per_60, RANK-hits_per_60, RANK-ixg_per_60, RANK-on_ice_gf_percentage, RANK-on_ice_xgf_percentage, RANK-penalties_taken_per_60, RANK-points_per_60, RANK-pp_points_per_60, RANK-primary_assists_per_60, RANK-rel_5v5_gf_percentage, RANK-rel_5v5_xgf_percentage, RANK-sax_percentage, RANK-shot_attempts_per_60, RANK-sog_per_60, RANK-unrealized_xg, RANK-xga_per_60
- **Purpose:** Turn one rolling_player_game_metrics row into per-window metric values, numerators, denominators, GP and TOI for ranking.
- **Where:** `web/lib/rankings/skaterWindowAggregation.ts:180 (ratePer60)`; `web/lib/rankings/skaterWindowAggregation.ts:185 (percent)`; `web/lib/rankings/skaterWindowAggregation.ts:324 (extractDerivedWindowMetric)`; `web/lib/rankings/skaterWindowAggregation.ts:434 (extractWindowMetric)`; `web/lib/rankings/skaterWindowAggregation.ts:514 (buildSkaterWindowAggregatesFromRollingRow)`
- **Tags (heuristic):** percent scale: 0-100; denominators: per 60, per game; generation: current
- **Opus view (RNK-037):**
  - Method: Windows season,last5,last10,last20. Rate = num/den*3600 (6dp); direct stored *_per_60_{window} value preferred over recomputation. points/pp_points season = avg_season * season GP (num and den). Derived: xS% = ixG/shot_attempts*100; SAX% = G/att*100 - ixG/att*100; GAx = G-ixG; unrealized = ixG-G; xGA/60 = oi_xga/toi*3600; on-ice GF% = GF/(GF+GA)*100; xGF% likewise. Season derived on-ice/xGA metrics use *_avg_season fields (ratio of per-game averages).
  - Inputs/units: TOI seconds; counts; season fields are per-game averages (*_avg_season) or season totals; sources: rolling_player_game_metrics
  - Output scale: per-60 rates; percent 0-100; count differences; writes: —
  - Status: live — used by rankingQueries/deploymentTiers/entityMetricRankingWriter
  - Consumers: rankingQueries.buildCandidates; deploymentTiers; entityMetricRankingWriter; skaterCompositeWriter (via surfaces)
- **Audit context:**
  - Intent (Opus): comment web/lib/rankings/skaterWindowAggregation.ts:243 (last-N windows reach into prior season); SKATER_WINDOW_AGGREGATION_REFRESH_SURFACES :165
  - External references: NST per-60 convention; on-ice GF%/xGF% = For/(For+Against)
  - Fixtures/test data: none listed
  - Tests: `web/lib/rankings/skaterWindowAggregation.test.ts`
- **Leads (not audited):**
  - (opus) for season xGA/60 the denominator is toi_seconds_avg_season (a per-game average) and resolveToiSeconds returns it as the sample TOI, so the 600s minimum TOI gate is compared to per-game TOI, not total TOI
  - (opus) direct stored per-60 field and recomputed numerator/denominator can disagree; direct field wins silently
  - (opus) derived season GAx/unrealized xG use season totals but last-N use totals — not rate-normalized, so season vs last5 values are not comparable

## M-RNK-042 Last-N window games-played / TOI resolution

- **Match:** Opus only; Opus RNK-038; Codex —
- **Purpose:** Estimate games in a last-N window and the TOI used for sample gates.
- **Where:** `web/lib/rankings/skaterWindowAggregation.ts:230 (resolveGamesPlayed)`; `web/lib/rankings/skaterWindowAggregation.ts:267 (resolveToiSeconds)`
- **Tags (heuristic):** generation: current
- **Opus view (RNK-038):**
  - Method: Season: participation GP (strength-specific field unless 'all'). Last-N: GP = min(N, round(windowTOI/windowAvgTOI)) when avg present; else N if season GP>=N; else N if windowTOI > seasonAvgTOI*seasonGP*1.05 (window spans prior season); else season GP. Season TOI = denominator or avgTOI*GP.
  - Inputs/units: TOI seconds, GP counts; sources: rolling_player_game_metrics
  - Output scale: GP 0..N; TOI seconds; writes: —
  - Status: live — buildSkaterWindowAggregatesFromRollingRow
  - Consumers: buildSkaterWindowAggregatesFromRollingRow
- **Audit context:**
  - Intent (Opus): comment web/lib/rankings/skaterWindowAggregation.ts:243-244 and :254
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/rankings/skaterWindowAggregation.test.ts`
- **Leads (not audited):**
  - (opus) heuristic 1.05 factor and comment that writer does not fill toi_seconds_avg_last10/20 — GP for last10/20 is inferred, not counted
  - (opus) last-N windows reach into prior season while season windows do not; mixing in one ranking surface

## M-RNK-043 Rankings splits (strength/window/deployment comparisons)

- **Match:** Opus only; Opus RNK-039; Codex —
- **Purpose:** Show the same skater metric across strengths, windows and deployment buckets.
- **Where:** `web/lib/rankings/splits.ts:151 (buildRequest)`; `web/lib/rankings/splits.ts:184 (deploymentComparisons)`; `web/lib/rankings/splits.ts:266 (buildRankingsSplitsSurface)`
- **Tags (heuristic):** percent scale: 0-100; denominators: 5v5 only; generation: current
- **Opus view (RNK-039):**
  - Method: No new formula: re-runs the contextual ranking calculator per split (strengths all/5v5/ev/pp/pk; windows season/last20/last10/last5; deployment all/L1-L4/P1-P3/PP1-3/PK1-2) and reports value, percentile, rank, qualifiedPeerCount. Peer type team>deployment>position>all_skaters.
  - Inputs/units: as per metric; sources: rolling_player_game_metrics
  - Output scale: percentile 0-100; rank; writes: —
  - Status: live — /api/v1/contextual-rankings/splits
  - Consumers: /api/v1/contextual-rankings/splits; components/Rankings/SplitsPanel.tsx
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED beyond code
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/__tests__/pages/api/v1/contextual-rankings-splits.test.ts`; `web/lib/rankings/splits.test.ts`
- **Leads (not audited):**
  - (opus) deployment split changes the peer group to that bucket, so percentiles across split rows are not on a common population

## M-RNK-044 Team-vs-opponent splits (skater/goalie aggregates, PP share, QS)

- **Match:** Opus only; Opus RNK-041; Codex —
- **Purpose:** Current-season player stats for a team against a chosen opponent, plus landing leaders.
- **Where:** `web/lib/splits/splitsServer.ts:147 (parseToiToSeconds)`; `web/lib/splits/splitsServer.ts:626 (buildTeamPpShotShare)`; `web/lib/splits/splitsServer.ts:668 (buildSkaterRows)`; `web/lib/splits/splitsServer.ts:825 (isQualityStart)`; `web/lib/splits/splitsServer.ts:834 (buildGoalieRows)`; `web/lib/splits/splitsServer.ts:440 (buildLandingSkaterLeaders)`; `web/lib/splits/splitsServer.ts:536 (buildLandingGoalieLeaders)`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: per 60, per game, shots on goal; generation: current
- **Opus view (RNK-041):**
  - Method: Sum ES+PP+PK TOI and counts vs opponent; P/GP; Sh% = G/SOG; avg TOI = total/GP; PP TOI/G; PP% (share) = player PP TOI / team PP TOI vs that opponent; PP shot share = player PP shots / roster PP shots. Goalie SV% = saves/SA; GAA = GA*3600/TOI; QS if SV% > .910 or (SA <= 20 and SV% >= .885); QS% = QS/GS.
  - Inputs/units: seconds; counts; mm:ss strings; sources: strength game rows tables (see fetchStrengthRowsForSeason), team strength rows, goalie game rows, games
  - Output scale: fractions 0-1; per game; GAA per 60; writes: —
  - Status: live — /api/v1/splits
  - Consumers: web/pages/api/v1/splits/index.ts; splits page
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: Vollman Quality Start (SV% >= league avg, or >= .885 on <=20 shots)
  - Fixtures/test data: none listed
  - Tests: `web/lib/splits/splitsSurface.test.ts`
- **Leads (not audited):**
  - (opus) third distinct quality-start definition (> .910) vs goalieMethodology classic (>= .900) and WGO quality_start
  - (opus) tiny opponent-specific samples (1-4 games) presented without sample gates

## M-RNK-045 Adjusted-impact promotion readiness gate

- **Match:** Opus only; Opus RNK-042; Codex —
- **Purpose:** Classify whether the RAPM-like adjusted-impact model can replace contextual defense ratings.
- **Where:** `web/lib/rankings/adjustedImpactPromotionContract.ts:78 (evaluateAdjustedImpactPromotionReadiness)`; `web/lib/rankings/adjustedImpactPromotionContract.ts:21 (ADJUSTED_IMPACT_PROMOTION_CONTROLS)`; `web/lib/rankings/defensiveCompositeMethodology.ts:23 (ADJUSTED_DEFENSE_MODEL_ROADMAP)`
- **Tags (heuristic):** generation: current
- **Opus view (RNK-042):**
  - Method: rankings_promotable only if zero 'missing' and zero 'available_not_joined' controls; else blocked_missing_controls. Current static statuses: 2 verified, 2 available_not_joined, 1 missing -> blocked. Roadmap names regularized RAPM-like residual model with chronological held-out validation.
  - Inputs/units: status enums; sources: nhl_xg_adjusted_impact_model_runs, nhl_xg_adjusted_player_impacts (referenced only)
  - Output scale: status enum + counts; writes: —
  - Status: live — surfaced via rankingMetadata (metadata only)
  - Consumers: rankingMetadata.ts:186
- **Audit context:**
  - Intent (Opus): ADJUSTED_IMPACT_PROMOTION_CONTRACT.promotionGate web/lib/rankings/adjustedImpactPromotionContract.ts:73
  - External references: Evolving-Hockey RAPM (ridge regression on shift stints with score/zone/venue controls)
  - Fixtures/test data: none listed
  - Tests: `web/lib/rankings/adjustedImpactPromotionContract.test.ts`; `web/lib/rankings/defensiveCompositeMethodology.test.ts`
- **Leads (not audited):**
  - (opus) statuses are hard-coded constants, not derived from live table checks

## M-RNK-046 Assists/60

- **Match:** Codex only; Opus —; Codex RANK-assists_per_60
- **Possible related records (low-confidence location link, unconfirmed):** RNK-037
- **Purpose:** Total assists per 60 minutes in the selected window.
- **Where:** `web/lib/rankings/metricDefinitions.ts:959 CONTEXTUAL_RANKING_METRIC_DEFINITIONS`; `web/lib/rankings/skaterWindowAggregation.ts:514 buildSkaterWindowAggregatesFromRollingRow`
- **Tags (heuristic):** percent scale: 0-100; denominators: per 60; generation: current
- **Codex view (RANK-assists_per_60, calculation; Codex family 'Contextual skater rankings'):** Assists/60
  - Purpose: Total assists per 60 minutes in the selected window.
  - Inputs/units: Source rolling_player_game_metrics fields: assists_per_60_{window}, assists_per_60_total_last{n}, toi_seconds_total_last{n}, assists_per_60_assists_{baseline_window}, assists_per_60_toi_seconds_{baseline_window}. Denominator: Total TOI seconds in the selected player-production window.
  - Output scale: Events/expected goals per 60 minutes. Contextual display may also include dense rank and percentile 0–100.
  - Version/status: contextual_rankings_v1; code-declared availability=available. Production deployment/active database state not checked.
  - Consumers: Contextual rankings/player matrix/splits/trending/composites; metric definitions registry.
- **Audit context:**
  - Intended contract (Codex RANK-assists_per_60): assists / TOI seconds * 3600 Source: web/lib/rankings/metricDefinitions.ts:223. Minimum GP 1, TOI 300 seconds.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/rankings/metricDefinitions.test.ts`; `web/lib/rankings/skaterWindowAggregation.test.ts`
- **Leads (not audited):**
  - (codex:RANK-assists_per_60) Registry formula is intended contract; implementation may have distinct missingness/variant rules. No agreement assessment performed.

## M-RNK-047 Blocks/60

- **Match:** Codex only; Opus —; Codex RANK-blocks_per_60
- **Possible related records (low-confidence location link, unconfirmed):** RNK-037
- **Purpose:** Blocked shots per 60 minutes in the selected window.
- **Where:** `web/lib/rankings/metricDefinitions.ts:959 CONTEXTUAL_RANKING_METRIC_DEFINITIONS`; `web/lib/rankings/skaterWindowAggregation.ts:514 buildSkaterWindowAggregatesFromRollingRow`
- **Tags (heuristic):** percent scale: 0-100; denominators: per 60; generation: current
- **Codex view (RANK-blocks_per_60, calculation; Codex family 'Contextual skater rankings'):** Blocks/60
  - Purpose: Blocked shots per 60 minutes in the selected window.
  - Inputs/units: Source rolling_player_game_metrics fields: blocks_per_60_{window}, blocks_per_60_total_last{n}, toi_seconds_total_last{n}, blocks_per_60_blocks_{baseline_window}, blocks_per_60_toi_seconds_{baseline_window}. Denominator: Total TOI seconds in the selected player-production window.
  - Output scale: Events/expected goals per 60 minutes. Contextual display may also include dense rank and percentile 0–100.
  - Version/status: contextual_rankings_v1; code-declared availability=available. Production deployment/active database state not checked.
  - Consumers: Contextual rankings/player matrix/splits/trending/composites; metric definitions registry.
- **Audit context:**
  - Intended contract (Codex RANK-blocks_per_60): blocks / TOI seconds * 3600 Source: web/lib/rankings/metricDefinitions.ts:429. Minimum GP 1, TOI 300 seconds.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/rankings/metricDefinitions.test.ts`; `web/lib/rankings/skaterWindowAggregation.test.ts`
- **Leads (not audited):**
  - (codex:RANK-blocks_per_60) Registry formula is intended contract; implementation may have distinct missingness/variant rules. No agreement assessment performed.

## M-RNK-048 xS%

- **Match:** Codex only; Opus —; Codex RANK-expected_shooting_percentage
- **Possible related records (low-confidence location link, unconfirmed):** RNK-037
- **Purpose:** Expected shooting percentage based on individual xG and unblocked shot attempts.
- **Where:** `web/lib/rankings/metricDefinitions.ts:959 CONTEXTUAL_RANKING_METRIC_DEFINITIONS`; `web/lib/rankings/skaterWindowAggregation.ts:514 buildSkaterWindowAggregatesFromRollingRow`
- **Tags (heuristic):** percent scale: 0-100; denominators: unblocked attempts; generation: current
- **Codex view (RANK-expected_shooting_percentage, calculation; Codex family 'Contextual skater rankings'):** xS%
  - Purpose: Expected shooting percentage based on individual xG and unblocked shot attempts.
  - Inputs/units: Source rolling_player_game_metrics fields: rolling_player_game_metrics.ixg_per_60_total_{window}, rolling_player_game_metrics.shot_attempts_per_60_total_{window}, rolling_player_game_metrics.ixg_per_60_ixg_{baseline_window}, rolling_player_game_metrics.shot_attempts_per_60_shot_attempts_{baseline_window}. Denominator: Individual unblocked shot attempts from approved shot-goal xG feature rows.
  - Output scale: individual xG / individual unblocked attempts * 100 Contextual display may also include dense rank and percentile 0–100.
  - Version/status: contextual_rankings_v1; code-declared availability=available. Production deployment/active database state not checked.
  - Consumers: Contextual rankings/player matrix/splits/trending/composites; metric definitions registry.
- **Audit context:**
  - Intended contract (Codex RANK-expected_shooting_percentage): individual xG / individual unblocked attempts * 100 Source: web/lib/rankings/metricDefinitions.ts:545. Minimum GP 1, TOI 600 seconds.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/rankings/metricDefinitions.test.ts`; `web/lib/rankings/skaterWindowAggregation.test.ts`
- **Leads (not audited):**
  - (codex:RANK-expected_shooting_percentage) Registry formula is intended contract; implementation may have distinct missingness/variant rules. No agreement assessment performed.

## M-RNK-049 Goals Above Expected

- **Match:** Codex only; Opus —; Codex RANK-goals_above_expected
- **Possible related records (low-confidence location link, unconfirmed):** RNK-037
- **Purpose:** Goals scored above individual expected goals.
- **Where:** `web/lib/rankings/metricDefinitions.ts:959 CONTEXTUAL_RANKING_METRIC_DEFINITIONS`; `web/lib/rankings/skaterWindowAggregation.ts:514 buildSkaterWindowAggregatesFromRollingRow`
- **Tags (heuristic):** percent scale: 0-100; generation: current
- **Codex view (RANK-goals_above_expected, calculation; Codex family 'Contextual skater rankings'):** Goals Above Expected
  - Purpose: Goals scored above individual expected goals.
  - Inputs/units: Source rolling_player_game_metrics fields: rolling_player_game_metrics.goals_per_60_total_{window}, rolling_player_game_metrics.ixg_per_60_total_{window}, rolling_player_game_metrics.goals_per_60_goals_{baseline_window}, rolling_player_game_metrics.ixg_per_60_ixg_{baseline_window}. Denominator: Metric-specific denominator described by the formula and methodology metadata.
  - Output scale: goals - individual xG Contextual display may also include dense rank and percentile 0–100.
  - Version/status: contextual_rankings_v1; code-declared availability=available. Production deployment/active database state not checked.
  - Consumers: Contextual rankings/player matrix/splits/trending/composites; metric definitions registry.
- **Audit context:**
  - Intended contract (Codex RANK-goals_above_expected): goals - individual xG Source: web/lib/rankings/metricDefinitions.ts:615. Minimum GP 1, TOI 600 seconds.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/rankings/metricDefinitions.test.ts`; `web/lib/rankings/skaterWindowAggregation.test.ts`
- **Leads (not audited):**
  - (codex:RANK-goals_above_expected) Registry formula is intended contract; implementation may have distinct missingness/variant rules. No agreement assessment performed.

## M-RNK-050 Goals/60

- **Match:** Codex only; Opus —; Codex RANK-goals_per_60
- **Possible related records (low-confidence location link, unconfirmed):** RNK-037
- **Purpose:** Goals scored per 60 minutes in the selected window.
- **Where:** `web/lib/rankings/metricDefinitions.ts:959 CONTEXTUAL_RANKING_METRIC_DEFINITIONS`; `web/lib/rankings/skaterWindowAggregation.ts:514 buildSkaterWindowAggregatesFromRollingRow`
- **Tags (heuristic):** percent scale: 0-100; denominators: per 60; generation: current
- **Codex view (RANK-goals_per_60, calculation; Codex family 'Contextual skater rankings'):** Goals/60
  - Purpose: Goals scored per 60 minutes in the selected window.
  - Inputs/units: Source rolling_player_game_metrics fields: goals_per_60_{window}, goals_per_60_total_last{n}, toi_seconds_total_last{n}, goals_per_60_goals_{baseline_window}, goals_per_60_toi_seconds_{baseline_window}. Denominator: Total TOI seconds in the selected player-production window.
  - Output scale: Events/expected goals per 60 minutes. Contextual display may also include dense rank and percentile 0–100.
  - Version/status: contextual_rankings_v1; code-declared availability=available. Production deployment/active database state not checked.
  - Consumers: Contextual rankings/player matrix/splits/trending/composites; metric definitions registry.
- **Audit context:**
  - Intended contract (Codex RANK-goals_per_60): goals / TOI seconds * 3600 Source: web/lib/rankings/metricDefinitions.ts:197. Minimum GP 1, TOI 300 seconds.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/rankings/metricDefinitions.test.ts`; `web/lib/rankings/skaterWindowAggregation.test.ts`
- **Leads (not audited):**
  - (codex:RANK-goals_per_60) Registry formula is intended contract; implementation may have distinct missingness/variant rules. No agreement assessment performed.

## M-RNK-051 Hits/60

- **Match:** Codex only; Opus —; Codex RANK-hits_per_60
- **Possible related records (low-confidence location link, unconfirmed):** RNK-037
- **Purpose:** Hits per 60 minutes in the selected window.
- **Where:** `web/lib/rankings/metricDefinitions.ts:959 CONTEXTUAL_RANKING_METRIC_DEFINITIONS`; `web/lib/rankings/skaterWindowAggregation.ts:514 buildSkaterWindowAggregatesFromRollingRow`
- **Tags (heuristic):** percent scale: 0-100; denominators: per 60; generation: current
- **Codex view (RANK-hits_per_60, calculation; Codex family 'Contextual skater rankings'):** Hits/60
  - Purpose: Hits per 60 minutes in the selected window.
  - Inputs/units: Source rolling_player_game_metrics fields: hits_per_60_{window}, hits_per_60_total_last{n}, toi_seconds_total_last{n}, hits_per_60_hits_{baseline_window}, hits_per_60_toi_seconds_{baseline_window}. Denominator: Total TOI seconds in the selected player-production window.
  - Output scale: Events/expected goals per 60 minutes. Contextual display may also include dense rank and percentile 0–100.
  - Version/status: contextual_rankings_v1; code-declared availability=available. Production deployment/active database state not checked.
  - Consumers: Contextual rankings/player matrix/splits/trending/composites; metric definitions registry.
- **Audit context:**
  - Intended contract (Codex RANK-hits_per_60): hits / TOI seconds * 3600 Source: web/lib/rankings/metricDefinitions.ts:403. Minimum GP 1, TOI 300 seconds.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/rankings/metricDefinitions.test.ts`; `web/lib/rankings/skaterWindowAggregation.test.ts`
- **Leads (not audited):**
  - (codex:RANK-hits_per_60) Registry formula is intended contract; implementation may have distinct missingness/variant rules. No agreement assessment performed.

## M-RNK-052 Individual xG/60

- **Match:** Codex only; Opus —; Codex RANK-ixg_per_60
- **Possible related records (low-confidence location link, unconfirmed):** RNK-037
- **Purpose:** Individual expected goals per 60 minutes in the selected window.
- **Where:** `web/lib/rankings/metricDefinitions.ts:959 CONTEXTUAL_RANKING_METRIC_DEFINITIONS`; `web/lib/rankings/skaterWindowAggregation.ts:514 buildSkaterWindowAggregatesFromRollingRow`
- **Tags (heuristic):** percent scale: 0-100; denominators: per 60; generation: current
- **Codex view (RANK-ixg_per_60, calculation; Codex family 'Contextual skater rankings'):** Individual xG/60
  - Purpose: Individual expected goals per 60 minutes in the selected window.
  - Inputs/units: Source rolling_player_game_metrics fields: ixg_per_60_{window}, ixg_per_60_total_last{n}, toi_seconds_total_last{n}, ixg_per_60_ixg_{baseline_window}, ixg_per_60_toi_seconds_{baseline_window}. Denominator: Total TOI seconds in the selected player-production window.
  - Output scale: Events/expected goals per 60 minutes. Contextual display may also include dense rank and percentile 0–100.
  - Version/status: contextual_rankings_v1; code-declared availability=available. Production deployment/active database state not checked.
  - Consumers: Contextual rankings/player matrix/splits/trending/composites; metric definitions registry.
- **Audit context:**
  - Intended contract (Codex RANK-ixg_per_60): individual xG / TOI seconds * 3600 Source: web/lib/rankings/metricDefinitions.ts:455. Minimum GP 1, TOI 300 seconds.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/rankings/metricDefinitions.test.ts`; `web/lib/rankings/skaterWindowAggregation.test.ts`
- **Leads (not audited):**
  - (codex:RANK-ixg_per_60) Registry formula is intended contract; implementation may have distinct missingness/variant rules. No agreement assessment performed.

## M-RNK-053 On-ice GF%

- **Match:** Codex only; Opus —; Codex RANK-on_ice_gf_percentage
- **Possible related records (low-confidence location link, unconfirmed):** RNK-037
- **Purpose:** Share of on-ice goals that were goals for.
- **Where:** `web/lib/rankings/metricDefinitions.ts:959 CONTEXTUAL_RANKING_METRIC_DEFINITIONS`; `web/lib/rankings/skaterWindowAggregation.ts:514 buildSkaterWindowAggregatesFromRollingRow`
- **Tags (heuristic):** percent scale: 0-100; generation: current
- **Codex view (RANK-on_ice_gf_percentage, calculation; Codex family 'Contextual skater rankings'):** On-ice GF%
  - Purpose: Share of on-ice goals that were goals for.
  - Inputs/units: Source rolling_player_game_metrics fields: rolling_player_game_metrics.oi_gf_total_{window}, rolling_player_game_metrics.oi_ga_total_{window}, rolling_player_game_metrics.oi_gf_avg_{baseline_window}, rolling_player_game_metrics.oi_ga_avg_{baseline_window}. Denominator: Metric-specific denominator described by the formula and methodology metadata.
  - Output scale: on-ice GF / (on-ice GF + on-ice GA) Contextual display may also include dense rank and percentile 0–100.
  - Version/status: contextual_rankings_v1; code-declared availability=available. Production deployment/active database state not checked.
  - Consumers: Contextual rankings/player matrix/splits/trending/composites; metric definitions registry.
- **Audit context:**
  - Intended contract (Codex RANK-on_ice_gf_percentage): on-ice GF / (on-ice GF + on-ice GA) Source: web/lib/rankings/metricDefinitions.ts:665. Minimum GP 1, TOI 600 seconds.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/rankings/metricDefinitions.test.ts`; `web/lib/rankings/skaterWindowAggregation.test.ts`
- **Leads (not audited):**
  - (codex:RANK-on_ice_gf_percentage) Registry formula is intended contract; implementation may have distinct missingness/variant rules. No agreement assessment performed.

## M-RNK-054 On-ice xGF%

- **Match:** Codex only; Opus —; Codex RANK-on_ice_xgf_percentage
- **Possible related records (low-confidence location link, unconfirmed):** RNK-037
- **Purpose:** Share of on-ice expected goals that were expected goals for.
- **Where:** `web/lib/rankings/metricDefinitions.ts:959 CONTEXTUAL_RANKING_METRIC_DEFINITIONS`; `web/lib/rankings/skaterWindowAggregation.ts:514 buildSkaterWindowAggregatesFromRollingRow`
- **Tags (heuristic):** percent scale: 0-100; generation: current
- **Codex view (RANK-on_ice_xgf_percentage, calculation; Codex family 'Contextual skater rankings'):** On-ice xGF%
  - Purpose: Share of on-ice expected goals that were expected goals for.
  - Inputs/units: Source rolling_player_game_metrics fields: rolling_player_game_metrics.oi_xgf_total_{window}, rolling_player_game_metrics.oi_xga_total_{window}, rolling_player_game_metrics.oi_xgf_avg_{baseline_window}, rolling_player_game_metrics.oi_xga_avg_{baseline_window}. Denominator: Metric-specific denominator described by the formula and methodology metadata.
  - Output scale: on-ice xGF / (on-ice xGF + on-ice xGA) Contextual display may also include dense rank and percentile 0–100.
  - Version/status: contextual_rankings_v1; code-declared availability=available. Production deployment/active database state not checked.
  - Consumers: Contextual rankings/player matrix/splits/trending/composites; metric definitions registry.
- **Audit context:**
  - Intended contract (Codex RANK-on_ice_xgf_percentage): on-ice xGF / (on-ice xGF + on-ice xGA) Source: web/lib/rankings/metricDefinitions.ts:694. Minimum GP 1, TOI 600 seconds.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/rankings/metricDefinitions.test.ts`; `web/lib/rankings/skaterWindowAggregation.test.ts`
- **Leads (not audited):**
  - (codex:RANK-on_ice_xgf_percentage) Registry formula is intended contract; implementation may have distinct missingness/variant rules. No agreement assessment performed.

## M-RNK-055 Penalties Taken/60

- **Match:** Codex only; Opus —; Codex RANK-penalties_taken_per_60
- **Possible related records (low-confidence location link, unconfirmed):** RNK-037
- **Purpose:** Penalties taken per 60 minutes.
- **Where:** `web/lib/rankings/metricDefinitions.ts:959 CONTEXTUAL_RANKING_METRIC_DEFINITIONS`; `web/lib/rankings/skaterWindowAggregation.ts:514 buildSkaterWindowAggregatesFromRollingRow`
- **Tags (heuristic):** percent scale: 0-100; denominators: per 60; generation: current
- **Codex view (RANK-penalties_taken_per_60, calculation; Codex family 'Contextual skater rankings'):** Penalties Taken/60
  - Purpose: Penalties taken per 60 minutes.
  - Inputs/units: Source rolling_player_game_metrics fields: rolling_player_game_metrics.penalties_taken_per_60_{window}, rolling_player_game_metrics.penalties_taken_per_60_total_{window}, rolling_player_game_metrics.toi_seconds_total_{window}. Denominator: Total TOI seconds in the selected player-production window.
  - Output scale: Events/expected goals per 60 minutes. Contextual display may also include dense rank and percentile 0–100.
  - Version/status: contextual_rankings_v1; code-declared availability=available. Production deployment/active database state not checked.
  - Consumers: Contextual rankings/player matrix/splits/trending/composites; metric definitions registry.
- **Audit context:**
  - Intended contract (Codex RANK-penalties_taken_per_60): penalties taken / TOI seconds * 3600. Lower raw values are better. Source: web/lib/rankings/metricDefinitions.ts:517. Minimum GP 1, TOI 300 seconds.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/rankings/metricDefinitions.test.ts`; `web/lib/rankings/skaterWindowAggregation.test.ts`
- **Leads (not audited):**
  - (codex:RANK-penalties_taken_per_60) Registry formula is intended contract; implementation may have distinct missingness/variant rules. No agreement assessment performed.

## M-RNK-056 Points/60

- **Match:** Codex only; Opus —; Codex RANK-points_per_60
- **Possible related records (low-confidence location link, unconfirmed):** RNK-037
- **Purpose:** Total points per 60 minutes in the selected window.
- **Where:** `web/lib/rankings/metricDefinitions.ts:959 CONTEXTUAL_RANKING_METRIC_DEFINITIONS`; `web/lib/rankings/skaterWindowAggregation.ts:514 buildSkaterWindowAggregatesFromRollingRow`
- **Tags (heuristic):** percent scale: 0-100; denominators: per 60; generation: current
- **Codex view (RANK-points_per_60, calculation; Codex family 'Contextual skater rankings'):** Points/60
  - Purpose: Total points per 60 minutes in the selected window.
  - Inputs/units: Source rolling_player_game_metrics fields: points_total_last{n}, toi_seconds_total_last{n}, points_avg_{baseline_window}, toi_seconds_avg_{baseline_window}. Denominator: Total TOI seconds in the selected player-production window.
  - Output scale: Events/expected goals per 60 minutes. Contextual display may also include dense rank and percentile 0–100.
  - Version/status: contextual_rankings_v1; code-declared availability=available. Production deployment/active database state not checked.
  - Consumers: Contextual rankings/player matrix/splits/trending/composites; metric definitions registry.
- **Audit context:**
  - Intended contract (Codex RANK-points_per_60): points / TOI seconds * 3600 Source: web/lib/rankings/metricDefinitions.ts:275. Minimum GP 1, TOI 300 seconds.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/rankings/metricDefinitions.test.ts`; `web/lib/rankings/skaterWindowAggregation.test.ts`
- **Leads (not audited):**
  - (codex:RANK-points_per_60) Registry formula is intended contract; implementation may have distinct missingness/variant rules. No agreement assessment performed.

## M-RNK-057 Power-play Points/60

- **Match:** Codex only; Opus —; Codex RANK-pp_points_per_60
- **Possible related records (low-confidence location link, unconfirmed):** RNK-037
- **Purpose:** Power-play points per 60 minutes in the selected player-production window.
- **Where:** `web/lib/rankings/metricDefinitions.ts:959 CONTEXTUAL_RANKING_METRIC_DEFINITIONS`; `web/lib/rankings/skaterWindowAggregation.ts:514 buildSkaterWindowAggregatesFromRollingRow`
- **Tags (heuristic):** percent scale: 0-100; denominators: per 60; generation: current
- **Codex view (RANK-pp_points_per_60, calculation; Codex family 'Contextual skater rankings'):** Power-play Points/60
  - Purpose: Power-play points per 60 minutes in the selected player-production window.
  - Inputs/units: Source rolling_player_game_metrics fields: pp_points_total_last{n}, pp_toi_seconds_total_last{n}, pp_points_avg_{baseline_window}, pp_toi_seconds_avg_{baseline_window}. Denominator: Player power-play TOI seconds in the selected player-production window.
  - Output scale: Events/expected goals per 60 minutes. Contextual display may also include dense rank and percentile 0–100.
  - Version/status: contextual_rankings_v1; code-declared availability=available. Production deployment/active database state not checked.
  - Consumers: Contextual rankings/player matrix/splits/trending/composites; metric definitions registry.
- **Audit context:**
  - Intended contract (Codex RANK-pp_points_per_60): power-play points / power-play TOI seconds * 3600 Source: web/lib/rankings/metricDefinitions.ts:303. Minimum GP 1, TOI 120 seconds.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/rankings/metricDefinitions.test.ts`; `web/lib/rankings/skaterWindowAggregation.test.ts`
- **Leads (not audited):**
  - (codex:RANK-pp_points_per_60) Registry formula is intended contract; implementation may have distinct missingness/variant rules. No agreement assessment performed.

## M-RNK-058 Primary Assists/60

- **Match:** Codex only; Opus —; Codex RANK-primary_assists_per_60
- **Possible related records (low-confidence location link, unconfirmed):** RNK-037
- **Purpose:** Primary assists per 60 minutes in the selected window.
- **Where:** `web/lib/rankings/metricDefinitions.ts:959 CONTEXTUAL_RANKING_METRIC_DEFINITIONS`; `web/lib/rankings/skaterWindowAggregation.ts:514 buildSkaterWindowAggregatesFromRollingRow`
- **Tags (heuristic):** percent scale: 0-100; denominators: per 60; generation: current
- **Codex view (RANK-primary_assists_per_60, calculation; Codex family 'Contextual skater rankings'):** Primary Assists/60
  - Purpose: Primary assists per 60 minutes in the selected window.
  - Inputs/units: Source rolling_player_game_metrics fields: primary_assists_per_60_{window}, primary_assists_per_60_total_last{n}, toi_seconds_total_last{n}, primary_assists_per_60_primary_assists_{baseline_window}, primary_assists_per_60_toi_seconds_{baseline_window}. Denominator: Total TOI seconds in the selected player-production window.
  - Output scale: Events/expected goals per 60 minutes. Contextual display may also include dense rank and percentile 0–100.
  - Version/status: contextual_rankings_v1; code-declared availability=available. Production deployment/active database state not checked.
  - Consumers: Contextual rankings/player matrix/splits/trending/composites; metric definitions registry.
- **Audit context:**
  - Intended contract (Codex RANK-primary_assists_per_60): primary assists / TOI seconds * 3600 Source: web/lib/rankings/metricDefinitions.ts:249. Minimum GP 1, TOI 300 seconds.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/rankings/metricDefinitions.test.ts`; `web/lib/rankings/skaterWindowAggregation.test.ts`
- **Leads (not audited):**
  - (codex:RANK-primary_assists_per_60) Registry formula is intended contract; implementation may have distinct missingness/variant rules. No agreement assessment performed.

## M-RNK-059 Relative 5v5 GF%

- **Match:** Codex only; Opus —; Codex RANK-rel_5v5_gf_percentage
- **Possible related records (low-confidence location link, unconfirmed):** RNK-037
- **Purpose:** Player 5v5 GF% relative to team-without-player baseline.
- **Where:** `web/lib/rankings/metricDefinitions.ts:959 CONTEXTUAL_RANKING_METRIC_DEFINITIONS`; `web/lib/rankings/skaterWindowAggregation.ts:514 buildSkaterWindowAggregatesFromRollingRow`
- **Tags (heuristic):** percent scale: 0-100; denominators: 5v5 only; generation: development, current
- **Codex view (RANK-rel_5v5_gf_percentage, calculation; Codex family 'Contextual skater rankings'):** Relative 5v5 GF%
  - Purpose: Player 5v5 GF% relative to team-without-player baseline.
  - Inputs/units: Source None fields: . Denominator: Metric-specific denominator described by the formula and methodology metadata.
  - Output scale: player 5v5 GF% - team 5v5 GF% without player Contextual display may also include dense rank and percentile 0–100.
  - Version/status: contextual_rankings_v1; code-declared availability=planned. Production deployment/active database state not checked.
  - Consumers: Contextual rankings/player matrix/splits/trending/composites; metric definitions registry.
- **Audit context:**
  - Intended contract (Codex RANK-rel_5v5_gf_percentage): player 5v5 GF% - team 5v5 GF% without player Source: web/lib/rankings/metricDefinitions.ts:723. Minimum GP 1, TOI 1200 seconds.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/rankings/metricDefinitions.test.ts`; `web/lib/rankings/skaterWindowAggregation.test.ts`
- **Leads (not audited):**
  - (codex:RANK-rel_5v5_gf_percentage) Registry formula is intended contract; implementation may have distinct missingness/variant rules. No agreement assessment performed.

## M-RNK-060 Relative 5v5 xGF%

- **Match:** Codex only; Opus —; Codex RANK-rel_5v5_xgf_percentage
- **Possible related records (low-confidence location link, unconfirmed):** RNK-037
- **Purpose:** Player 5v5 xGF% relative to team-without-player baseline.
- **Where:** `web/lib/rankings/metricDefinitions.ts:959 CONTEXTUAL_RANKING_METRIC_DEFINITIONS`; `web/lib/rankings/skaterWindowAggregation.ts:514 buildSkaterWindowAggregatesFromRollingRow`
- **Tags (heuristic):** percent scale: 0-100; denominators: 5v5 only; generation: development, current
- **Codex view (RANK-rel_5v5_xgf_percentage, calculation; Codex family 'Contextual skater rankings'):** Relative 5v5 xGF%
  - Purpose: Player 5v5 xGF% relative to team-without-player baseline.
  - Inputs/units: Source None fields: . Denominator: Metric-specific denominator described by the formula and methodology metadata.
  - Output scale: player 5v5 xGF% - team 5v5 xGF% without player Contextual display may also include dense rank and percentile 0–100.
  - Version/status: contextual_rankings_v1; code-declared availability=planned. Production deployment/active database state not checked.
  - Consumers: Contextual rankings/player matrix/splits/trending/composites; metric definitions registry.
- **Audit context:**
  - Intended contract (Codex RANK-rel_5v5_xgf_percentage): player 5v5 xGF% - team 5v5 xGF% without player Source: web/lib/rankings/metricDefinitions.ts:755. Minimum GP 1, TOI 1200 seconds.
  - External references: none suggested
  - Fixtures/test data: none listed
  - Tests: `web/lib/rankings/metricDefinitions.test.ts`; `web/lib/rankings/skaterWindowAggregation.test.ts`
- **Leads (not audited):**
  - (codex:RANK-rel_5v5_xgf_percentage) Registry formula is intended contract; implementation may have distinct missingness/variant rules. No agreement assessment performed.

