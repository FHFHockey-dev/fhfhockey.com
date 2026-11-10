# Audit packet: NST-derived stats

Master entries M-NST-001 to M-NST-034 (34 of 34 in this family). Built from the merged Opus and Codex inventories; see [../MASTER.md](../MASTER.md) and [../MERGE-NOTES.md](../MERGE-NOTES.md).

How to read: each entry gives both inventories' descriptions side by side. **Conflicts** are places where the two descriptions disagree; they are unresolved. **Leads** are Opus red flags and Codex unknowns: observations to check, not audited findings. Tags are keyword heuristics. Line numbers were valid when each inventory was written on 2026-11-10 (Opus at d31dcb33f, Codex at 11e4192d3); re-check against the current checkout.

| ID | Name | Match | Conflicts | Leads |
|---|---|---|---:|---:|
| M-NST-001 | On-ice percentages and PDO | Both | 0 | 4 |
| M-NST-002 | Individual skater counts (NST individual table parity) | Both | 0 | 4 |
| M-NST-003 | Penalty count classification | Both | 0 | 3 |
| M-NST-004 | Danger bucket and scoring-chance fallback | Both | 0 | 5 |
| M-NST-005 | Approximate xG fallback heuristic | Both | 0 | 5 |
| M-NST-006 | NST radar season values (on-ice shares, per-60 rates, league sample m… | Both | 0 | 7 |
| M-NST-007 | Per-60 rates (skater individual and on-ice) | Both | 0 | 3 |
| M-NST-008 | Score-state context features (running score, game-time segments) | Both | 0 | 4 |
| M-NST-009 | Contextual shot features (shift age, PP age, movement, royal road) | Both | 0 | 5 |
| M-NST-010 | Flurry sequences | Both | 0 | 4 |
| M-NST-011 | Possession chains | Both | 0 | 5 |
| M-NST-012 | Prior-event context (time, distance, speed) | Both | 0 | 3 |
| M-NST-013 | Rebound detection and rebound control outcome | Both | 0 | 4 |
| M-NST-014 | Rush shot detection | Both | 0 | 4 |
| M-NST-015 | Coordinate normalization, shot distance and angle | Both | 0 | 5 |
| M-NST-016 | Strength segments and TOI by split (skater and goalie) | Both | 0 | 5 |
| M-NST-017 | usePlayerStats zone-start % and NST merge coercion | Opus only | 0 | 3 |
| M-NST-018 | NST goalie catch-up step planner (windows, budgets, burst sizing) | Opus only | 0 | 4 |
| M-NST-019 | NST goalie freshness assessment (coverage counts and status tiers) | Opus only | 0 | 2 |
| M-NST-020 | Goalie parity counts, SV%, GAA and 'GSAA' | Opus only | 0 | 5 |
| M-NST-021 | On-ice For/Against counts by danger | Opus only | 0 | 3 |
| M-NST-022 | Zone starts and zone faceoff shares | Opus only | 0 | 3 |
| M-NST-023 | IPP (parity) | Opus only | 0 | 1 |
| M-NST-024 | On-ice attribution per event | Opus only | 0 | 2 |
| M-NST-025 | Normalized event inclusion rules | Opus only | 0 | 1 |
| M-NST-026 | PbP clock and game-time derivation | Opus only | 0 | 2 |
| M-NST-027 | NST rate-limit admission window math (local ledger + shared RPC + Pyt… | Opus only | 0 | 5 |
| M-NST-028 | Score-state filters (parity) | Opus only | 0 | 3 |
| M-NST-029 | Shift interval normalization, stints and stint lookup | Opus only | 0 | 2 |
| M-NST-030 | Miss-reason buckets | Opus only | 0 | 2 |
| M-NST-031 | Shot feature row assembly | Opus only | 0 | 3 |
| M-NST-032 | Team-relative strength-state and split classification | Opus only | 0 | 3 |
| M-NST-033 | NST team count aggregation (CF%, xGF%, HDCF%, SCF%, SH%, SV%, PDO) | Opus only | 0 | 3 |
| M-NST-034 | NHL-vs-legacy NST parity validation tolerances | Opus only | 0 | 3 |

## M-NST-001 On-ice percentages and PDO

- **Match:** Both; Opus NST-008; Codex parity-skater-rates
- **Purpose:** Compute CF%, FF%, SF%, GF%, xGF%, SCF%, HDCF%, HDGF%, MDCF%, MDGF%, LDCF%, LDGF%, oiSH%, oiSV%, PDO.
- **Where:** `web/lib/supabase/Upserts/nhlNstParityMetrics.ts:427 (toPct)`; `web/lib/supabase/Upserts/nhlNstParityMetrics.ts:1622 (onIceSvPct)`; `web/lib/supabase/Upserts/nhlNstParityMetrics.ts:1673 (pdo)`; `web/lib/supabase/Upserts/nhlNstParityMetrics.ts:427 toPct; :432 toPer60; :1592 buildSkaterSplitParity`
- **Tags (heuristic):** percent scale: 0-100; denominators: per 60; generation: current
- **Opus view (NST-008):**
  - Method: X% = For/(For+Against)*100 (null if denom<=0). oiSH% = GF/SF*100; oiSV% = (SA-GA)/SA*100; PDO = oiSH% + oiSV% (scale ~200, percent units 0-100).
  - Inputs/units: counts; sources: in-memory on-ice counts
  - Output scale: percent 0-100 (PDO ~ 200 scale); per single game; writes: —
  - Status: live — update-player-underlying-stats-yesterday pg_cron (09:35 UTC, active=true, tasks/TASKS/cron-operations/cron-schedule.md:382) -> pages/api/v1/db/update-player-underlying-stats.ts -> lib/underlying-stats/playerStatsSummaryRefresh.ts -> playerStatsLandingServer.ts:1066 buildPlayerStatsNativeGameParity -> buildNstParityMetrics; also read paths pages/api/v1/underlying-stats/players*.ts
  - Consumers: underlying stats player landing; nhlXgValidation comparisons vs legacy NST tables
- **Codex view (parity-skater-rates, calculation, location; Codex family 'Native NST-parity metrics'):** Individual/on-ice per60, IPP, possession shares, zone shares, PDO
  - Purpose: Create rate fields from native game counts.
  - Inputs/units: Counts from parity-skater-counts; TOI seconds; denominator counts
  - Output scale: Per60 = count ×3600/TOI; percentages ×100; IPP=(G+A)/oiGF×100; CF/FF/SF/GF/xGF/SCF/HDCF/HDGF/MDCF/MDGF/LDCF/LDGF shares = for/(for+against)×100; on-ice SH=GF/SF×100; SV=(SA-GA)/SA×100; PDO=SH+SV (roughly 100 scale, not rolling 1 scale); OZ starts and OZ faceoffs include neutral in denominator.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
- **Audit context:**
  - Intent (Opus): tasks/TASKS/xg-model/docs/definitions-and-parity.md:143-145 (on-ice SH%, SV%, PDO listed as parity targets)
  - Intended contract (Codex parity-skater-rates): web/lib/supabase/Upserts/nhlNstParityMetrics.ts row types and formulas; explicit separate rolling contracts do not define these game-level output scales.
  - External references: NST PDO = on-ice SH% + on-ice SV% (5v5 by default); percentages 0-100
  - Fixtures/test data: `tasks/artifacts/nhl-pbp-recon-2026-03-30.json (sampled NHL PbP recon)`; `tasks/TASKS/xg-model/docs/event-dictionary.md (observed payload shapes)`; `tasks/TASKS/xg-model/nhl-api-foundation/metric-parity-map.md (legacy NST metric -> NHL-derived mapping)`; `web/__tests__/fixtures/nst/oct1-identity-source.json (NST source sample)`; `inline game fixtures in web/lib/supabase/Upserts/nhlNstParityMetrics.test.ts`
  - Tests: `web/lib/supabase/Upserts/nhlNstParityMetrics.test.ts`; `web/lib/supabase/Upserts/nhlXgValidation.test.ts`; `web/lib/underlying-stats/playerStatsLandingServer.test.ts`; `web/lib/underlying-stats/playerStatsSummaryRefresh.test.ts`; `{"discovered_not_run": ["web/lib/supabase/Upserts/nhlNstParityMetrics.test.ts"]}`
- **Leads (not audited):**
  - (opus) per-game single-row percentages; any multi-game aggregation downstream must re-sum counts (ratio of sums) rather than average these
  - (opus) 'all' split includes empty-net events, so all-situations PDO/oiSV% are depressed by EN goals against (NST shows the same for all situations but its default PDO view is 5v5)
  - (opus) oiSH% uses GF that includes own goals while SF excludes them
  - (codex:parity-skater-rates) No runtime verification or correctness assessment performed.

## M-NST-002 Individual skater counts (NST individual table parity)

- **Match:** Both; Opus NST-011; Codex parity-skater-counts
- **Purpose:** Count goals, first/second assists, points, shots, iCF, iFF, ixG, iSCF, iHDCF, rush attempts, rebounds created, hits, hits taken, giveaways, takeaways, shots blocked, faceoffs won/lost per player per split.
- **Where:** `web/lib/supabase/Upserts/nhlNstParityMetrics.ts:1312 (buildNstParityMetrics goal/assist credit)`; `web/lib/supabase/Upserts/nhlNstParityMetrics.ts:1339 (iCF/ixG/iSCF/iHDCF block)`; `web/lib/supabase/Upserts/nhlNstParityMetrics.ts:365 (SHOT_ATTEMPT_TYPES/UNBLOCKED_ATTEMPT_TYPES/SHOT_ON_GOAL_TYPES)`; `web/lib/supabase/Upserts/nhlNstParityMetrics.ts:1103 buildNstParityMetrics; :906 accumulateToiBySplit; :1592 buildSkaterSplitParity`
- **Tags (heuristic):** denominators: per game, shots on goal; generation: current
- **Opus view (NST-011):**
  - Method: Shots = goal+shot-on-goal; iCF = goal+SOG+missed+blocked; iFF = goal+SOG+missed; own goals excluded from shooter credit. Shooter = shot.shooterPlayerId ?? shooting_player_id ?? scoring_player_id. Each increment goes to 'all' plus every split the event matches for the player's team, subject to score-state filter. Shootout and penalty-shot events excluded via evaluateNormalizedEventInclusion.
  - Inputs/units: event counts; sources: nhl_api_pbp_events, shot features
  - Output scale: integer counts per game per split (ixg in goals); writes: —
  - Status: live — update-player-underlying-stats-yesterday pg_cron (09:35 UTC, active=true, tasks/TASKS/cron-operations/cron-schedule.md:382) -> pages/api/v1/db/update-player-underlying-stats.ts -> lib/underlying-stats/playerStatsSummaryRefresh.ts -> playerStatsLandingServer.ts:1066 buildPlayerStatsNativeGameParity -> buildNstParityMetrics; also read paths pages/api/v1/underlying-stats/players*.ts
  - Consumers: playerStatsLandingServer.ts (underlying stats player pages); scripts/run-nhl-xg-release-validation.ts
- **Codex view (parity-skater-counts, calculation, location; Codex family 'Native NST-parity metrics'):** Individual and on-ice skater event/TOI totals
  - Purpose: Translate normalized PBP and shifts into game/strength/score-state stat rows.
  - Inputs/units: Normalized PBP event types and player attribution; shift intervals seconds; shot features and goalie/team identities
  - Output scale: Individual goals, assists, primary/secondary assists, points, shots, ixG, iCF/iFF/iSCF/iHDCF, rush/rebounds, PIM/penalties/drawn, giveaways/takeaways, hits/hits-taken/blocks, FOW/FOL; on-ice CF/CA, FF/FA, SF/SA, GF/GA, xGF/xGA, SC/danger counts, zone starts/faceoffs; TOI seconds.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
- **Audit context:**
  - Intent (Opus): tasks/TASKS/xg-model/docs/definitions-and-parity.md (phase-1 count families; NHL-derived correctness wins over NST on edge cases per tasks/TASKS/xg-model/tasks-nhl-api-xg-model.md:90)
  - Intended contract (Codex parity-skater-counts): web/lib/supabase/Upserts/nhlNstParityMetrics.ts exported row types and event-inclusion/strength helpers are implementation contract; no claim of numerical parity with third-party NST.
  - External references: Natural Stat Trick individual counts (iCF, iFF, iSCF, iHDCF, ixG)
  - Fixtures/test data: `tasks/artifacts/nhl-pbp-recon-2026-03-30.json (sampled NHL PbP recon)`; `tasks/TASKS/xg-model/docs/event-dictionary.md (observed payload shapes)`; `tasks/TASKS/xg-model/nhl-api-foundation/metric-parity-map.md (legacy NST metric -> NHL-derived mapping)`; `web/__tests__/fixtures/nst/oct1-identity-source.json (NST source sample)`; `inline game fixtures in web/lib/supabase/Upserts/nhlNstParityMetrics.test.ts`
  - Tests: `web/lib/supabase/Upserts/nhlNstParityMetrics.test.ts`; `web/lib/underlying-stats/playerStatsLandingServer.test.ts`; `web/lib/underlying-stats/playerStatsSummaryRefresh.test.ts`; `{"discovered_not_run": ["web/lib/supabase/Upserts/nhlNstParityMetrics.test.ts", "web/lib/supabase/Upserts/nhlNormalizedLayer.test.ts"]}`
- **Leads (not audited):**
  - (opus) penalty-shot goals are excluded from individual goals (exclusionReason penalty-shot), so goal totals can differ from NHL.com official counts
  - (opus) iHDCF counts blocked attempts in the HD bucket; NST HDC subtracts a point for blocked shots
  - (opus) ixg/iscfs/hdcf/rush/rebound only increment when a shot feature row exists for the event
  - (codex:parity-skater-counts) No runtime verification or correctness assessment performed.

## M-NST-003 Penalty count classification

- **Match:** Both; Opus NST-012; Codex parity-skater-counts
- **Purpose:** Sum PIM and classify penalties taken as minor/major/misconduct; count penalties drawn.
- **Where:** `web/lib/supabase/Upserts/nhlNstParityMetrics.ts:1357 (buildNstParityMetrics penalty block)`; `web/lib/supabase/Upserts/nhlNstParityMetrics.ts:1103 buildNstParityMetrics; :906 accumulateToiBySplit; :1592 buildSkaterSplitParity`
- **Tags (heuristic):** generation: current
- **Opus view (NST-012):**
  - Method: pim += duration; total_penalties += 1; duration == 2 -> minor; duration >= 5 -> major; else -> misconduct. penalties_drawn += 1 for drawn_by.
  - Inputs/units: penalty duration in minutes; sources: nhl_api_pbp_events
  - Output scale: PIM minutes; integer counts; writes: —
  - Status: live — update-player-underlying-stats-yesterday pg_cron (09:35 UTC, active=true, tasks/TASKS/cron-operations/cron-schedule.md:382) -> pages/api/v1/db/update-player-underlying-stats.ts -> lib/underlying-stats/playerStatsSummaryRefresh.ts -> playerStatsLandingServer.ts:1066 buildPlayerStatsNativeGameParity -> buildNstParityMetrics; also read paths pages/api/v1/underlying-stats/players*.ts
  - Consumers: underlying stats player landing; per-60 penalty rates
- **Codex view (parity-skater-counts, calculation, location; Codex family 'Native NST-parity metrics'):** Individual and on-ice skater event/TOI totals
  - Purpose: Translate normalized PBP and shifts into game/strength/score-state stat rows.
  - Inputs/units: Normalized PBP event types and player attribution; shift intervals seconds; shot features and goalie/team identities
  - Output scale: Individual goals, assists, primary/secondary assists, points, shots, ixG, iCF/iFF/iSCF/iHDCF, rush/rebounds, PIM/penalties/drawn, giveaways/takeaways, hits/hits-taken/blocks, FOW/FOL; on-ice CF/CA, FF/FA, SF/SA, GF/GA, xGF/xGA, SC/danger counts, zone starts/faceoffs; TOI seconds.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED (no stated duration->type mapping)
  - Intended contract (Codex parity-skater-counts): web/lib/supabase/Upserts/nhlNstParityMetrics.ts exported row types and event-inclusion/strength helpers are implementation contract; no claim of numerical parity with third-party NST.
  - External references: NST/NHL penalty types (minor 2, double minor 4, major 5, misconduct 10, game misconduct)
  - Fixtures/test data: `tasks/artifacts/nhl-pbp-recon-2026-03-30.json (sampled NHL PbP recon)`; `tasks/TASKS/xg-model/docs/event-dictionary.md (observed payload shapes)`; `tasks/TASKS/xg-model/nhl-api-foundation/metric-parity-map.md (legacy NST metric -> NHL-derived mapping)`; `web/__tests__/fixtures/nst/oct1-identity-source.json (NST source sample)`; `inline game fixtures in web/lib/supabase/Upserts/nhlNstParityMetrics.test.ts`
  - Tests: `web/lib/supabase/Upserts/nhlNstParityMetrics.test.ts`; `web/lib/underlying-stats/playerStatsLandingServer.test.ts`; `web/lib/underlying-stats/playerStatsSummaryRefresh.test.ts`; `{"discovered_not_run": ["web/lib/supabase/Upserts/nhlNstParityMetrics.test.ts", "web/lib/supabase/Upserts/nhlNormalizedLayer.test.ts"]}`
- **Leads (not audited):**
  - (opus) 4-minute double minors fall into 'misconduct'; 10-minute misconducts (>=5) fall into 'major' - classification by duration is inverted for these cases
  - (opus) penalties served-by vs committed-by: bench/team penalties with no committed_by are dropped
  - (codex:parity-skater-counts) No runtime verification or correctness assessment performed.

## M-NST-004 Danger bucket and scoring-chance fallback

- **Match:** Both; Opus NST-013; Codex parity-skater-rates, parity-xg-proxy
- **Purpose:** Classify shot attempts as high/medium/low danger and scoring chance when the feature row lacks a model-provided bucket.
- **Where:** `web/lib/supabase/Upserts/nhlNstParityMetrics.ts:399 (getDangerBucket)`; `web/lib/supabase/Upserts/nhlNstParityMetrics.ts:421 (isScoringChance)`; `web/lib/supabase/Upserts/nhlNstParityMetrics.ts:427 toPct; :432 toPer60; :1592 buildSkaterSplitParity`; `web/lib/supabase/Upserts/nhlNstParityMetrics.ts:399 getDangerBucket; :407 getApproximateXgValue; web/lib/underlying-stats/teamStatsSummaryRefresh.ts:462 getDangerBucket; :481 getApproximateXgValue`
- **Tags (heuristic):** percent scale: 0-100; denominators: per 60; generation: current
- **Opus view (NST-013):**
  - Method: If no dangerBucket: high if distance<=20 ft and angle<=35 deg; medium if distance<=40 and angle<=50; else low. Scoring chance = bucket != low.
  - Inputs/units: feet (distance), degrees (angle, 0 = straight on); sources: shot feature rows (in-memory from nhlShotFeatureBuilder)
  - Output scale: categorical high/medium/low; boolean scoring chance; writes: —
  - Status: live — update-player-underlying-stats-yesterday pg_cron (09:35 UTC, active=true, tasks/TASKS/cron-operations/cron-schedule.md:382) -> pages/api/v1/db/update-player-underlying-stats.ts -> lib/underlying-stats/playerStatsSummaryRefresh.ts -> playerStatsLandingServer.ts:1066 buildPlayerStatsNativeGameParity -> buildNstParityMetrics; also read paths pages/api/v1/underlying-stats/players*.ts; identical copy in web/lib/underlying-stats/teamStatsSummaryRefresh.ts:489 (team summaries)
  - Consumers: HDCF/MDCF/LDCF, SCF, iHDCF, iSCF, goalie HD/MD/LD SV% in buildNstParityMetrics
- **Codex view (parity-skater-rates, calculation, location; Codex family 'Native NST-parity metrics'):** Individual/on-ice per60, IPP, possession shares, zone shares, PDO
  - Purpose: Create rate fields from native game counts.
  - Inputs/units: Counts from parity-skater-counts; TOI seconds; denominator counts
  - Output scale: Per60 = count ×3600/TOI; percentages ×100; IPP=(G+A)/oiGF×100; CF/FF/SF/GF/xGF/SCF/HDCF/HDGF/MDCF/MDGF/LDCF/LDGF shares = for/(for+against)×100; on-ice SH=GF/SF×100; SV=(SA-GA)/SA×100; PDO=SH+SV (roughly 100 scale, not rolling 1 scale); OZ starts and OZ faceoffs include neutral in denominator.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
- **Codex view (parity-xg-proxy, calculation, location; Codex family 'Native xG proxy cross-reference'):** Approximate danger-bucket xG fallback
  - Purpose: Supply a heuristic proxy when a supplied shot xG is absent.
  - Inputs/units: Shot distance feet, angle degrees, rebound/rush/royal-road/goal booleans; optional supplied xG
  - Output scale: High≤20ft and ≤35°, medium≤40ft and ≤50°, otherwise low; base .18/.08/.02 plus rebound .03, rush .02, royal road .02; goal floor .25, cap .95. Supplied xG wins.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
- **Audit context:**
  - Intent (Opus): tasks/TASKS/xg-model/docs/definitions-and-parity.md:84-86 (rule-based phase-1 low/medium/high danger; thresholds must be versioned); exact 20/40 ft and 35/50 deg thresholds UNDOCUMENTED
  - Intended contract (Codex parity-skater-rates): web/lib/supabase/Upserts/nhlNstParityMetrics.ts row types and formulas; explicit separate rolling contracts do not define these game-level output scales.
  - Intended contract (Codex parity-xg-proxy): Explicit implementation fallback, not a fitted model probability. See the xG inventory for shot-model artifacts and geometry.
  - External references: Natural Stat Trick scoring-chance/HD definition (zone polygons + point system: HD area 3 pts, rebounds/rush +1, blocked shots -1; SC >=2, HDC >=3 in HD area)
  - Fixtures/test data: `tasks/artifacts/nhl-pbp-recon-2026-03-30.json (sampled NHL PbP recon)`; `tasks/TASKS/xg-model/docs/event-dictionary.md (observed payload shapes)`; `tasks/TASKS/xg-model/nhl-api-foundation/metric-parity-map.md (legacy NST metric -> NHL-derived mapping)`; `web/__tests__/fixtures/nst/oct1-identity-source.json (NST source sample)`; `inline game fixtures in web/lib/supabase/Upserts/nhlNstParityMetrics.test.ts`
  - Tests: `web/lib/supabase/Upserts/nhlNstParityMetrics.test.ts`; `{"discovered_not_run": ["web/lib/supabase/Upserts/nhlNstParityMetrics.test.ts", "web/lib/underlying-stats/teamStatsSummaryRefresh.test.ts"]}`; `{"discovered_not_run": ["web/lib/supabase/Upserts/nhlNstParityMetrics.test.ts"]}`
- **Leads (not audited):**
  - (opus) distance/angle cones are not NST's zone polygons and ignore NST's rebound/rush bonuses and blocked-shot penalty, so HDCF/SCF will not match NST
  - (opus) production caller (playerStatsLandingServer.ts buildPlayerStatsNativeGameParity) passes buildShotFeatureRows output which has no dangerBucket/isScoringChance fields, so the fallback is always used there
  - (opus) blocked shots use the block location coordinates (NHL api) for distance/angle, so blocked attempts get mis-bucketed vs shooter location
  - (codex:parity-skater-rates) No runtime verification or correctness assessment performed.
  - (codex:parity-xg-proxy) No runtime verification or correctness assessment performed.

## M-NST-005 Approximate xG fallback heuristic

- **Match:** Both; Opus NST-014; Codex parity-xg-proxy
- **Purpose:** Assign an xG value per shot attempt when no model xG is attached.
- **Where:** `web/lib/supabase/Upserts/nhlNstParityMetrics.ts:407 (getApproximateXgValue)`; `web/lib/supabase/Upserts/nhlNstParityMetrics.ts:399 getDangerBucket; :407 getApproximateXgValue; web/lib/underlying-stats/teamStatsSummaryRefresh.ts:462 getDangerBucket; :481 getApproximateXgValue`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: shots on goal; generation: current
- **Opus view (NST-014):**
  - Method: Base 0.18 high / 0.08 medium / 0.02 low; +0.03 rebound, +0.02 rush, +0.02 royal-road; if the shot is a goal, value = max(value, 0.25); cap 0.95. Applied to every shot attempt type including blocked and missed. XG INCLUDES (fallback heuristic): shot x,y mirrored to attacking direction by event-owner side and homeTeamDefendingSide, net at (89,0) ft; distance (ft) and angle (deg, \|dy\|/\|89-x\|) only via danger bucket cut-offs (<=20ft&<=35deg high, <=40ft&<=50deg medium); rebound flag (3 s, same team, immediate prior SOG/miss/block); rush flag (10 s backward scan, D/N-zone takeaway/faceoff win/opp giveaway/opp block); royal-road flag; goal outcome floor 0.25. XG EXCLUDES: shot type, strength state, score state, empty-net adjustment, shooter effects, goalie effects, any trained model or training set/seasons (hand-set constants), calibration (excluded). The trained model (scripts/train-nhl-xg-baseline.ts) is NOT wired into this path in production.
  - Inputs/units: danger bucket from feet/degrees; booleans; sources: shot feature rows (in-memory)
  - Output scale: xG per attempt, probability-like 0.02-0.95 (summed to xGF/xGA in goals); writes: —
  - Status: live — update-player-underlying-stats-yesterday pg_cron (09:35 UTC, active=true, tasks/TASKS/cron-operations/cron-schedule.md:382) -> pages/api/v1/db/update-player-underlying-stats.ts -> lib/underlying-stats/playerStatsSummaryRefresh.ts -> playerStatsLandingServer.ts:1066 buildPlayerStatsNativeGameParity -> buildNstParityMetrics; also read paths pages/api/v1/underlying-stats/players*.ts (no xgValue is attached on this path, so this heuristic is what ships); identical copy at web/lib/underlying-stats/teamStatsSummaryRefresh.ts:489-515
  - Consumers: ixG, xGF, xGA, xGF%, goalie xG against / 'gsaa' in buildNstParityMetrics; underlying-stats player landing
- **Codex view (parity-xg-proxy, calculation, location; Codex family 'Native xG proxy cross-reference'):** Approximate danger-bucket xG fallback
  - Purpose: Supply a heuristic proxy when a supplied shot xG is absent.
  - Inputs/units: Shot distance feet, angle degrees, rebound/rush/royal-road/goal booleans; optional supplied xG
  - Output scale: High≤20ft and ≤35°, medium≤40ft and ≤50°, otherwise low; base .18/.08/.02 plus rebound .03, rush .02, royal road .02; goal floor .25, cap .95. Supplied xG wins.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED (no comment or PRD states the 0.18/0.08/0.02 constants or goal floor; tasks/TASKS/xg-model/docs/definitions-and-parity.md:84 only covers danger buckets)
  - Intended contract (Codex parity-xg-proxy): Explicit implementation fallback, not a fitted model probability. See the xG inventory for shot-model artifacts and geometry.
  - External references: Evolving-Hockey / MoneyPuck / NST xG (Fenwick-based logistic models; outcome never an input)
  - Fixtures/test data: `tasks/artifacts/nhl-pbp-recon-2026-03-30.json (sampled NHL PbP recon)`; `tasks/TASKS/xg-model/docs/event-dictionary.md (observed payload shapes)`; `tasks/TASKS/xg-model/nhl-api-foundation/metric-parity-map.md (legacy NST metric -> NHL-derived mapping)`; `web/__tests__/fixtures/nst/oct1-identity-source.json (NST source sample)`; `inline game fixtures in web/lib/supabase/Upserts/nhlNstParityMetrics.test.ts`
  - Tests: `web/lib/supabase/Upserts/nhlNstParityMetrics.test.ts`; `{"discovered_not_run": ["web/lib/supabase/Upserts/nhlNstParityMetrics.test.ts", "web/lib/underlying-stats/teamStatsSummaryRefresh.test.ts"]}`
- **Leads (not audited):**
  - (opus) target leakage - goals are floored to 0.25 xG, so xG depends on the outcome and inflates xGF/ixG for scorers
  - (opus) blocked shots receive xG (NST and most public models compute xG on unblocked attempts only)
  - (opus) magic constants 0.18/0.08/0.02/+0.03/+0.02/+0.02/0.25/0.95 with no calibration reference
  - (opus) overlap: xG slice
  - (codex:parity-xg-proxy) No runtime verification or correctness assessment performed.

## M-NST-006 NST radar season values (on-ice shares, per-60 rates, league sample minima)

- **Match:** Both; Opus NST-016; Codex core-372
- **Purpose:** Compute a skater's season value and the league comparison values for the /stats/player radar from NST all-strength season views.
- **Where:** `web/lib/nst/radarSeasonStats.ts:30 (share)`; `web/lib/nst/radarSeasonStats.ts:37 (onIceShare)`; `web/lib/nst/radarSeasonStats.ts:44 (rate)`; `web/lib/nst/radarSeasonStats.ts:51 (NST_RADAR_STATS)`; `web/lib/nst/radarSeasonStats.ts:68 (hdca_per_60)`; `web/lib/nst/radarSeasonStats.ts:82 (meetsLeagueMin)`; `web/lib/nst/radarSeasonStats.ts:94 (nstRadarStatValue)`; `web/lib/nst/radarSeasonStats.ts:179 (nstRadarComparison)`; `web/components/PlayerStats/PlayerRadarChart.tsx:417 (rankAgainst percentile/rank, consumer)`; `web/components/PlayerStats/PlayerRadarChart.tsx:417 rankAgainst`
- **Tags (heuristic):** percent scale: 0-100; denominators: per 60, all strengths; generation: current
- **Opus view (NST-016):**
  - Method: On-ice shares = for/(for+against)*100 (0-100 scale) for CF%, FF%, SF%, GF%, xGF% (ratio of season sums from NST counts). Per-60 rates are taken as stored NST values (not recomputed) except hdca_per_60 = hdca*3600/toi_seconds_oi. League rows must clear minima: CF+CA>=20, FF+FA>=15, SF+SA>=10, GF+GA>=1, xGF+xGA>=1, toi_seconds>=3600 (1 h) for rates, toi_seconds_oi>=3600 for HDCA/60; player row is NOT filtered. Consumer percentile = round(#league values strictly worse / N * 100); rank = #strictly better + 1; inverted for 'isInverted' stats and GAA.
  - Inputs/units: NST season counts (CF/CA/FF/FA/SF/SA/GF/GA/xGF/xGA/HDCA totals), toi_seconds and toi_seconds_oi in SECONDS, stored NST per-60 rates; all strengths; sources: nst_seasonlong_as_rates, nst_seasonlong_as_counts_oi, wgo_skater_stats_per_game (position filter only)
  - Output scale: on-ice shares 0-100 (percent points, ratio of season sums); per-60 rates; consumer percentile integer 0-100 (exclusive of ties), rank 1..N; writes: —
  - Status: live — imported by web/components/PlayerStats/PlayerRadarChart.tsx:22-24 on /stats/player/[playerId]
  - Consumers: web/components/PlayerStats/PlayerRadarChart.tsx (/stats/player/[playerId] radar)
- **Codex view (core-372, calculation, location; Codex family 'player performance UI'):** Radar strict percentile and competition rank
  - Formula: Percentile = round(100 * count strictly worse / cohort size); rank = 1 + count strictly better.
  - Purpose: Provide radar strict percentile and competition rank for the identified consumer.
  - Inputs/units: Player stat and eligible comparison-cohort values; preferred direction.
  - Output scale: Rounded percentile 0–100 and one-based competition rank.
  - Version/status: Local working tree on octoberBranch, read on 2026-11-10. HEAD changed during the inventory from d31dcb33f72d4c9d69b507874c388f0cd549fe2f to 11e4192d36ecc4ac4b338f9ab48e529c7049c618. This is a non-atomic local scan; deployment and persisted-data state are not verified. Referenced implementation files had no tracked/untracked status entry at the final status check.
- **Audit context:**
  - Intent (Opus): web/lib/nst/radarSeasonStats.ts:1-9 (rank a skater's season row against every skater's season row from the same NST views so both are measured the same way); :23 ('one hour of ice time before a per-60 rate counts'); PlayerRadarChart.tsx:240 comment on small-sample guard
  - Intended contract (Codex core-372): Function signature and comments at web/components/PlayerStats/PlayerRadarChart.tsx:417 rankAgainst; independent product specification not verified.
  - External references: Natural Stat Trick on-ice share definitions (CF% = CF/(CF+CA)); NST per-60 = count*3600/TOI seconds; percentile-rank conventions (inclusive vs exclusive ties)
  - Fixtures/test data: `web/lib/nst/radarSeasonStats.test.ts (inline NST row fixtures)`
  - Tests: `Located only; not run for this inventory.`; `web/components/PlayerStats/PlayerRadarChart.test.tsx`; `web/lib/nst/radarSeasonStats.test.ts`
- **Leads (not audited):**
  - (opus) uses all-strength (as) views for possession shares; community-standard CF%/xGF% comparisons are usually 5v5, so PP/PK usage distorts shares
  - (opus) hdcf_per_60 radar key is mapped to individual ihdcf_per_60 while hdca_per_60 is on-ice HDCA - asymmetric/misleading naming vs NST 'HDCF' (on-ice)
  - (opus) league minima are very low (GF+GA>=1, xGF+xGA>=1, SF+SA>=10) so tiny samples produce extreme 0%/100% shares in the comparison set
  - (opus) the player's own value is not subject to the minimum, and the player's row is included in leagueValues if it clears it; ties count as neither worse nor better so percentile tops out below 100
  - (opus) shares are 0-100 here whereas web/lib/stats/percentUnits.ts aggregates return fractions (0-1) - mixed percent units across modules
  - (opus) position filter reads wgo_skater_stats_per_game with season as String(season) while NST views are filtered by numeric season
  - (codex:core-372) ["Calculation inventory only; no correctness or model-quality verdict."]

## M-NST-007 Per-60 rates (skater individual and on-ice)

- **Match:** Both; Opus NST-017; Codex parity-skater-rates
- **Purpose:** Convert per-split counts into per-60-minute rates.
- **Where:** `web/lib/supabase/Upserts/nhlNstParityMetrics.ts:432 (toPer60)`; `web/lib/supabase/Upserts/nhlNstParityMetrics.ts:1678 (rates)`; `web/lib/supabase/Upserts/nhlNstParityMetrics.ts:1710 (ratesOi)`; `web/lib/supabase/Upserts/nhlNstParityMetrics.ts:427 toPct; :432 toPer60; :1592 buildSkaterSplitParity`
- **Tags (heuristic):** percent scale: 0-100; denominators: per 60; generation: current
- **Opus view (NST-017):**
  - Method: rate = value * 3600 / toiSeconds (null if toi<=0). Applied to ~28 individual metrics (goals, assists, points, shots, ixg, icf, iff, iscfs, hdcf, rush, rebounds, pim, penalties, drawn, giveaways, takeaways, hits, hits taken, blocks, FO won/lost) and ~22 on-ice metrics (CF/CA, FF/FA, SF/SA, GF/GA, xGF/xGA, SCF/SCA, HD/MD/LD CF/CA). toi_per_gp = toi (gp fixed 1).
  - Inputs/units: counts and TOI in SECONDS; sources: in-memory
  - Output scale: per-60 rates (value*3600/toiSeconds); toi_per_gp in seconds; writes: —
  - Status: live — update-player-underlying-stats-yesterday pg_cron (09:35 UTC, active=true, tasks/TASKS/cron-operations/cron-schedule.md:382) -> pages/api/v1/db/update-player-underlying-stats.ts -> lib/underlying-stats/playerStatsSummaryRefresh.ts -> playerStatsLandingServer.ts:1066 buildPlayerStatsNativeGameParity -> buildNstParityMetrics; also read paths pages/api/v1/underlying-stats/players*.ts
  - Consumers: underlying stats player landing; nhlXgValidation
- **Codex view (parity-skater-rates, calculation, location; Codex family 'Native NST-parity metrics'):** Individual/on-ice per60, IPP, possession shares, zone shares, PDO
  - Purpose: Create rate fields from native game counts.
  - Inputs/units: Counts from parity-skater-counts; TOI seconds; denominator counts
  - Output scale: Per60 = count ×3600/TOI; percentages ×100; IPP=(G+A)/oiGF×100; CF/FF/SF/GF/xGF/SCF/HDCF/HDGF/MDCF/MDGF/LDCF/LDGF shares = for/(for+against)×100; on-ice SH=GF/SF×100; SV=(SA-GA)/SA×100; PDO=SH+SV (roughly 100 scale, not rolling 1 scale); OZ starts and OZ faceoffs include neutral in denominator.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
- **Audit context:**
  - Intent (Opus): tasks/TASKS/xg-model/docs/definitions-and-parity.md:150-153 (every count family needs its per-60 surface; raw TOI and TOI/GP retained)
  - Intended contract (Codex parity-skater-rates): web/lib/supabase/Upserts/nhlNstParityMetrics.ts row types and formulas; explicit separate rolling contracts do not define these game-level output scales.
  - External references: NST per-60 convention (count / TOI minutes * 60, TOI in minutes)
  - Fixtures/test data: `tasks/artifacts/nhl-pbp-recon-2026-03-30.json (sampled NHL PbP recon)`; `tasks/TASKS/xg-model/docs/event-dictionary.md (observed payload shapes)`; `tasks/TASKS/xg-model/nhl-api-foundation/metric-parity-map.md (legacy NST metric -> NHL-derived mapping)`; `web/__tests__/fixtures/nst/oct1-identity-source.json (NST source sample)`; `inline game fixtures in web/lib/supabase/Upserts/nhlNstParityMetrics.test.ts`
  - Tests: `web/lib/supabase/Upserts/nhlNstParityMetrics.test.ts`; `web/lib/supabase/Upserts/nhlXgValidation.test.ts`; `web/lib/underlying-stats/playerStatsLandingServer.test.ts`; `web/lib/underlying-stats/playerStatsSummaryRefresh.test.ts`; `{"discovered_not_run": ["web/lib/supabase/Upserts/nhlNstParityMetrics.test.ts"]}`
- **Leads (not audited):**
  - (opus) toi and toi_per_gp are in seconds here; NST gamelog tables store TOI in minutes - unit mismatch risk when compared/merged with legacy nst_* tables
  - (opus) single-game per-60s on tiny TOI (e.g. 3v3, EN) produce extreme values; no minimum-TOI guard
  - (codex:parity-skater-rates) No runtime verification or correctness assessment performed.

## M-NST-008 Score-state context features (running score, game-time segments)

- **Match:** Both; Opus NST-020; Codex score-state
- **Purpose:** Per-event pre-event score, owner score differential buckets and late-game flags for shot features.
- **Where:** `web/lib/supabase/Upserts/nhlScoreState.ts:47 (bucketOwnerScoreDiff)`; `web/lib/supabase/Upserts/nhlScoreState.ts:61 (getScoreEffectsGameTimeSegment)`; `web/lib/supabase/Upserts/nhlScoreState.ts:108 (updateRunningScore)`; `web/lib/supabase/Upserts/nhlScoreState.ts:138 (buildScoreStateContexts)`; `web/lib/supabase/Upserts/nhlScoreState.ts:138 buildScoreStateContexts; :47 bucketOwnerScoreDiff; :61 getScoreEffectsGameTimeSegment`
- **Tags (heuristic):** denominators: per game; generation: current
- **Opus view (NST-020):**
  - Method: Running score per game starting 0-0, updated after each event (max of running and event-reported score, or +1 to owner on goals with no score). Diff buckets: <=-2 trail-2plus, -1, 0, +1, >=2 lead-2plus. Segments: <20 min early, <40 mid, <55 late, else final-five; OT/SO labeled. Late game = >=50:00 elapsed; isLateGameClose = late and \|diff\|<=1; finalFive >=55:00, finalTwo >=58:00 (REG only).
  - Inputs/units: goals; game seconds elapsed; sources: nhl_api_pbp_events
  - Output scale: integer score diffs; categorical buckets; booleans; writes: nhl xG shot feature table via update-nhl-xg-shot-features (columns of same names)
  - Status: live — built in-memory on the parity path (playerStatsLandingServer.ts:1078 buildShotFeatureRows); persisted feature job update-nhl-xg-shot-features exists (pages/api/v1/db/update-nhl-xg-shot-features.ts) but its pg_cron SQL is commented out in tasks/TASKS/cron-operations/cron-schedule.md:1645-1655 (manual/backfill only)
  - Consumers: nhlShotFeatureBuilder; xG training/scoring scripts
- **Codex view (score-state, calculation, location; Codex family 'NHL event context'):** Pre-event score differentials, score buckets and late-game flags
  - Purpose: Attach pre-event score/time context for event metrics and filters.
  - Inputs/units: Sorted NHL PBP events, score counts, owning side, period type and elapsed seconds
  - Output scale: Home/away/owner score differences; trail-2plus/trail-1/tied/lead-1/lead-2plus; regulation segments 20/40/55 minutes plus OT/SO; late window ≥50m; final-five ≥55m and final-two ≥58m in REG. Close \|diff\|≤1.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
- **Audit context:**
  - Intent (Opus): tasks/TASKS/xg-model/docs/definitions-and-parity.md (score state listed among phase-1 contextual inputs); 50:00/55:00/58:00 thresholds UNDOCUMENTED
  - Intended contract (Codex score-state): Implementation explicitly computes contexts before updateRunningScore; source web/lib/supabase/Upserts/nhlScoreState.ts.
  - External references: NST/Corsica 'close' (within 1 in 1st/2nd, tied in 3rd) and score-adjustment conventions
  - Fixtures/test data: `inline fixtures in web/lib/supabase/Upserts/nhlScoreState.test.ts`; `tasks/artifacts/nhl-pbp-recon-2026-03-30.json`
  - Tests: `web/lib/supabase/Upserts/nhlScoreState.test.ts`; `{"discovered_not_run": ["web/lib/supabase/Upserts/nhlScoreState.test.ts"]}`
- **Leads (not audited):**
  - (opus) isLateGameClose uses \|diff\|<=1 after 50:00, not NST's score-close definition
  - (opus) period_type compared to exact 'OT'/'SO'/'REG' strings while nhlEventInclusion uses regex - casing differences would misbucket
  - (opus) overlap: xG slice
  - (codex:score-state) No runtime verification or correctness assessment performed.

## M-NST-009 Contextual shot features (shift age, PP age, movement, royal road)

- **Match:** Both; Opus NST-022; Codex XG-08
- **Purpose:** Per-shot shooter/team shift ages, previous shift gaps/durations, power-play age, east-west/north-south movement and royal-road crossing.
- **Where:** `web/lib/supabase/Upserts/nhlContextualFeatures.ts:149 (computePlayerShiftAgeSeconds)`; `web/lib/supabase/Upserts/nhlContextualFeatures.ts:187 (computePlayerPreviousShiftGapSeconds)`; `web/lib/supabase/Upserts/nhlContextualFeatures.ts:212 (computePlayerPreviousShiftDurationSeconds)`; `web/lib/supabase/Upserts/nhlContextualFeatures.ts:237 (computeShiftAgeStats)`; `web/lib/supabase/Upserts/nhlContextualFeatures.ts:277 (computeCrossedRoyalRoad)`; `web/lib/supabase/Upserts/nhlContextualFeatures.ts:303 (buildContextualFeatureContexts)`; `web/lib/supabase/Upserts/nhlContextualFeatures.ts:303 buildContextualFeatureContexts`; `web/lib/supabase/Upserts/nhlContextualFeatures.ts:277 computeCrossedRoyalRoad`
- **Tags (heuristic):** generation: current
- **Opus view (NST-022):**
  - Method: Shift age = event period second - active shift start; previous gap/duration from player's prior shift; owner/opponent averages and max over on-ice players. PP age = seconds since the team's current PP segment started (restarts if strength_exact changes). Movement (same-team prior event only): east-west = \|dy\|, north-south = dx. Royal road crossed if both x>=25 and y sign flips (non-zero). XG ROLE: INCLUDES shooter shift age, owner PP age, east-west/north-south movement and royal-road crossing (x>=25 ft both events, y sign flip) as model features; EXCLUDES opponent PP age, owner/opponent average shift age and previous-shift gaps from first_pass_v1 (computed but unused there), pre-shot passes (not in NHL PbP).
  - Inputs/units: seconds (shift/PP age), feet (normalized coords); sources: nhl_api_pbp_events, nhl_api_shift_rows
  - Output scale: seconds; feet; boolean; writes: nhl xG shot feature table
  - Status: live — built in-memory on the parity path (playerStatsLandingServer.ts:1078 buildShotFeatureRows); persisted feature job update-nhl-xg-shot-features exists (pages/api/v1/db/update-nhl-xg-shot-features.ts) but its pg_cron SQL is commented out in tasks/TASKS/cron-operations/cron-schedule.md:1645-1655 (manual/backfill only)
  - Consumers: approximate xG (+0.02 royal road); xG model
- **Codex view (XG-08, calculation, location; Codex family 'Expected goals'):** Shift fatigue, power-play age and royal-road movement
  - Purpose: Derive shot-time shift and movement context.
  - Inputs/units: Shift start/end seconds, strength intervals, ordered event positions.
  - Output scale: Shooter/team/opponent shift ages and prior shift gap/duration seconds; PP age seconds; east-west/north-south feet; crossedRoyalRoad boolean.
  - Version/status: Local feature generator. Production deployment/active database state not checked.
- **Audit context:**
  - Intent (Opus): tasks/TASKS/xg-model/docs/definitions-and-parity.md:88 Phase 1 Contextual Features (power-play age from continuous owner PP segments, resets on leaving PP or new segment; fatigue = shooter shift age plus owner/opponent average and max shift age)
  - Intended contract (Codex XG-08): NhlContextualFeatureContext type and inline helpers. Repository design sources: tasks/TASKS/xg-model/docs/definitions-and-parity.md; tasks/TASKS/xg-model/docs/data-contract-boundaries.md; tasks/TASKS/xg-model/baseline/xg-training-feature-contract.md. These document historical intent, not deployment evidence.
  - External references: none suggested
  - Fixtures/test data: `inline fixtures in web/lib/supabase/Upserts/nhlContextualFeatures.test.ts`
  - Tests: `web/lib/supabase/Upserts/nhlContextualFeatures.test.ts`
- **Leads (not audited):**
  - (opus) on-ice averages include goalies, whose long shifts inflate average shift age
  - (opus) PP age resets when 5v4 becomes 5v3 or back, so it is time-in-exact-strength not time-on-PP
  - (opus) royal-road uses the previous event of any type, not a pass (passes are not in NHL PbP)
  - (opus) overlap: xG slice
  - (codex:XG-08) No mathematical accuracy or fitness assessment performed. Tests listed, not run.

## M-NST-010 Flurry sequences

- **Match:** Both; Opus NST-023; Codex XG-06
- **Purpose:** Group consecutive same-team shot attempts into flurries.
- **Where:** `web/lib/supabase/Upserts/nhlFlurries.ts:4 (DEFAULT_FLURRY_GAP_SECONDS)`; `web/lib/supabase/Upserts/nhlFlurries.ts:108 (breaksActiveFlurrySequence)`; `web/lib/supabase/Upserts/nhlFlurries.ts:137 (buildFlurryContexts)`; `web/lib/supabase/Upserts/nhlFlurries.ts:3 (DEFAULT_FLURRY_GAP_SECONDS=5)`; `web/lib/supabase/Upserts/nhlFlurries.ts:137 buildFlurryContexts`
- **Tags (heuristic):** generation: current
- **Opus view (NST-023):**
  - Method: Same-team attempts with gaps <=5 s form a sequence; broken by stoppage/penalty/faceoff/period events, opponent takeaway, own giveaway, or opponent shot. Emits flurry ids, position in sequence and flags.
  - Inputs/units: seconds (5 s gap); sources: nhl_api_pbp_events
  - Output scale: sequence ids/indices/counts; boolean; writes: nhl xG shot feature table
  - Status: live — built in-memory on the parity path (playerStatsLandingServer.ts:1078 buildShotFeatureRows); persisted feature job update-nhl-xg-shot-features exists (pages/api/v1/db/update-nhl-xg-shot-features.ts) but its pg_cron SQL is commented out in tasks/TASKS/cron-operations/cron-schedule.md:1645-1655 (manual/backfill only)
  - Consumers: xG model features
- **Codex view (XG-06, calculation, location; Codex family 'Expected goals'):** Flurry sequence context
  - Purpose: Group related successive shot attempts.
  - Inputs/units: Event order, team/possession, seconds between events.
  - Output scale: Sequence ID; shot index/count; flurry indicator.
  - Version/status: Feature-generation layer, not probability model. Production deployment/active database state not checked.
- **Audit context:**
  - Intent (Opus): tasks/TASKS/xg-model/docs/definitions-and-parity.md:72-83 (5 s gap grouping, sequence metadata only; raw per-shot values untouched)
  - Intended contract (Codex XG-06): DEFAULT_FLURRY_GAP_SECONDS=5 and break types. Repository design sources: tasks/TASKS/xg-model/docs/definitions-and-parity.md; tasks/TASKS/xg-model/docs/data-contract-boundaries.md; tasks/TASKS/xg-model/baseline/xg-training-feature-contract.md. These document historical intent, not deployment evidence.
  - External references: MoneyPuck flurry-adjusted xG (discounting later shots in a flurry)
  - Fixtures/test data: `inline fixtures in web/lib/supabase/Upserts/nhlFlurries.test.ts`; `web/scripts/output/xg-corrected-candidate/logistic_l2-s20252026-p1-st1-f1-cfg2afcf561/model-artifact.json`
  - Tests: `web/lib/supabase/Upserts/nhlFlurries.test.ts`; `web/lib/xg/flurryAdjusted.test.ts`
- **Leads (not audited):**
  - (opus) flurry flag is a feature only; no flurry adjustment is applied to parity xG
  - (opus) overlap: xG slice
  - (opus) LEAKAGE RISK: isFlurryShot for the first shot depends on whether a later shot followed (future information); goals end play so a goal can never be followed within the flurry, biasing the coefficient — and it is a default model feature (baselineDataset.ts:160)
  - (codex:XG-06) No mathematical accuracy or fitness assessment performed. Tests listed, not run.

## M-NST-011 Possession chains

- **Match:** Both; Opus NST-025; Codex XG-07
- **Purpose:** Segment events into team possession sequences for shot context.
- **Where:** `web/lib/supabase/Upserts/nhlPossessionChains.ts:63 (shouldStartNewChain)`; `web/lib/supabase/Upserts/nhlPossessionChains.ts:138 (buildPossessionChainContexts)`; `web/lib/supabase/Upserts/nhlPossessionChains.ts:138 buildPossessionChainContexts`
- **Tags (heuristic):** generation: current
- **Opus view (NST-025):**
  - Method: New chain on missing owner, new period, faceoff, previous hard break (stoppage, period/game start/end, penalty, delayed penalty), or owner change (regainedFromOpponent=true). Chain carries id, event count, start zone (non-offensive flag) and regain event type.
  - Inputs/units: event order; zone codes; sources: nhl_api_pbp_events
  - Output scale: chain ids, counts, durations (seconds); writes: nhl xG shot feature table
  - Status: live — built in-memory on the parity path (playerStatsLandingServer.ts:1078 buildShotFeatureRows); persisted feature job update-nhl-xg-shot-features exists (pages/api/v1/db/update-nhl-xg-shot-features.ts) but its pg_cron SQL is commented out in tasks/TASKS/cron-operations/cron-schedule.md:1645-1655 (manual/backfill only)
  - Consumers: xG model features
- **Codex view (XG-07, calculation, location; Codex family 'Expected goals'):** Possession-chain context
  - Purpose: Derive possession duration, event count and regain/entry context.
  - Inputs/units: Ordered play-by-play, team, zones, game seconds.
  - Output scale: Possession duration seconds, event count, start/regain/zone-entry categories.
  - Version/status: Expanded feature family. Production deployment/active database state not checked.
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED (tasks/artifacts/xg-possession-chain-benchmark-2026-03-31.md)
  - Intended contract (Codex XG-07): State machine and HARD_CHAIN_BREAK_TYPES are implementation contract. Repository design sources: tasks/TASKS/xg-model/docs/definitions-and-parity.md; tasks/TASKS/xg-model/docs/data-contract-boundaries.md; tasks/TASKS/xg-model/baseline/xg-training-feature-contract.md. These document historical intent, not deployment evidence.
  - External references: none suggested
  - Fixtures/test data: `inline fixtures in web/lib/supabase/Upserts/nhlPossessionChains.test.ts`
  - Tests: `web/lib/supabase/Upserts/nhlPossessionChains.test.ts`
- **Leads (not audited):**
  - (opus) event_owner_team_id is not possession for hits/blocked shots/penalties-drawn, so 'owner change' over-splits chains
  - (opus) overlap: xG slice
  - (opus) NHL PBP 'owner' is not puck possession (hits/blocks owned by defending team), so chains are proxies
  - (opus) zone_code is owner-relative and not normalized before 'O' check
  - (codex:XG-07) No mathematical accuracy or fitness assessment performed. Tests listed, not run.

## M-NST-012 Prior-event context (time, distance, speed)

- **Match:** Both; Opus NST-026; Codex XG-03
- **Purpose:** Per-event previous-event type/team, time since previous, distance and speed from previous event.
- **Where:** `web/lib/supabase/Upserts/nhlPriorEventContext.ts:21 (computeDistance)`; `web/lib/supabase/Upserts/nhlPriorEventContext.ts:51 (buildPriorEventContexts)`; `web/lib/supabase/Upserts/nhlShotFeatureBuilder.ts:202 (computeFeetPerSecond)`; `web/lib/supabase/Upserts/nhlPriorEventContext.ts:51 buildPriorEventContexts`; `web/lib/supabase/Upserts/nhlShotFeatureBuilder.ts:202 computeFeetPerSecond`
- **Tags (heuristic):** generation: current
- **Opus view (NST-026):**
  - Method: distance = Euclidean distance between RAW coordinates of previous and current event; speed = distance / seconds (null if seconds<=0); normalized coordinates of both events also exposed (each in its own owner's attacking frame).
  - Inputs/units: seconds; feet (raw coords); sources: nhl_api_pbp_events
  - Output scale: seconds; feet; feet per second; writes: nhl xG shot feature table
  - Status: live — built in-memory on the parity path (playerStatsLandingServer.ts:1078 buildShotFeatureRows); persisted feature job update-nhl-xg-shot-features exists (pages/api/v1/db/update-nhl-xg-shot-features.ts) but its pg_cron SQL is commented out in tasks/TASKS/cron-operations/cron-schedule.md:1645-1655 (manual/backfill only)
  - Consumers: rebounds; contextual movement/royal road; xG model
- **Codex view (XG-03, calculation, location; Codex family 'Expected goals'):** Prior-event movement and speed
  - Purpose: Derive elapsed time and movement before a shot.
  - Inputs/units: Ordered event timestamps seconds; x/y feet.
  - Output scale: Time since event seconds; Euclidean distance feet; distance/time ft/s; same-team flag.
  - Version/status: Feature families first_pass_v1, expanded_v2, speed_context_v3 coexist. Production deployment/active database state not checked.
- **Audit context:**
  - Intent (Opus): tasks/TASKS/xg-model/docs/definitions-and-parity.md:339 (prior-event context is a versioned derived feature); formulas UNDOCUMENTED
  - Intended contract (Codex XG-03): NhlPriorEventContext and feature units. Repository design sources: tasks/TASKS/xg-model/docs/definitions-and-parity.md; tasks/TASKS/xg-model/docs/data-contract-boundaries.md; tasks/TASKS/xg-model/baseline/xg-training-feature-contract.md. These document historical intent, not deployment evidence.
  - External references: MoneyPuck/EH prior-event features
  - Fixtures/test data: `inline fixtures in web/lib/supabase/Upserts/nhlPriorEventContext.test.ts`
  - Tests: `web/lib/supabase/Upserts/nhlPriorEventContext.test.ts`; `web/lib/supabase/Upserts/nhlShotFeatureBuilder.test.ts`
- **Leads (not audited):**
  - (opus) previous-event normalized coords use the previous owner's frame, so cross-team comparisons mix frames (only used when same team)
  - (opus) overlap: xG slice
  - (codex:XG-03) No mathematical accuracy or fitness assessment performed. Tests listed, not run.

## M-NST-013 Rebound detection and rebound control outcome

- **Match:** Both; Opus NST-027; Codex XG-04
- **Purpose:** Flag rebound shots and classify what each source shot produced.
- **Where:** `web/lib/supabase/Upserts/nhlRebounds.ts:6 (DEFAULT_REBOUND_WINDOW_SECONDS)`; `web/lib/supabase/Upserts/nhlRebounds.ts:108 (classifyReboundControlOutcome)`; `web/lib/supabase/Upserts/nhlRebounds.ts:173 (buildReboundContexts)`; `web/lib/supabase/Upserts/nhlRebounds.ts:173 buildReboundContexts`
- **Tags (heuristic):** denominators: shots on goal; generation: current
- **Opus view (NST-027):**
  - Method: Rebound shot = shot-feature-eligible attempt whose immediately previous event (same period, same owner team) is a SOG/missed/blocked shot within 0<dt<=3 s. Also distance from source, lateral displacement \|dy\|, distance delta and \|angle change\|. Source outcome: has rebound target -> second_chance_allowed; SOG followed by stoppage within 3 s -> goalie_freeze/covered puck; else no_danger_continuation. XG ROLE: rebound definition = time window 3 s, immediate prior event only, same team, same period; NO distance window (excluded); rebound distance/angle-change are recorded but not used by first_pass_v1; fallback xG adds +0.03.
  - Inputs/units: seconds (time delta), feet, degrees; sources: nhl_api_pbp_events
  - Output scale: booleans; deltas in feet/degrees; categorical outcome; writes: nhl xG shot feature table
  - Status: live — built in-memory on the parity path (playerStatsLandingServer.ts:1078 buildShotFeatureRows); persisted feature job update-nhl-xg-shot-features exists (pages/api/v1/db/update-nhl-xg-shot-features.ts) but its pg_cron SQL is commented out in tasks/TASKS/cron-operations/cron-schedule.md:1645-1655 (manual/backfill only)
  - Consumers: approximate xG (+0.03); rebounds_created / rebound_attempts_against in parity; xG model
- **Codex view (XG-04, calculation, location; Codex family 'Expected goals'):** Rebound identity and geometry
  - Purpose: Classify rebound sequences, source/target and outcome context.
  - Inputs/units: Ordered shot-like events, team, timestamps, coordinates.
  - Output scale: Rebound flag; time seconds; lateral/distance change feet; angle change degrees; creation and control-outcome labels.
  - Version/status: Default 3-second window. Production deployment/active database state not checked.
- **Audit context:**
  - Intent (Opus): tasks/TASKS/xg-model/docs/definitions-and-parity.md:51-58 (rebound = same-team shot within 3 s of an immediately prior SOG/missed/blocked shot, any intervening event breaks it; rebound goals count; rebounds created credited to source)
  - Intended contract (Codex XG-04): DEFAULT_REBOUND_WINDOW_SECONDS=3 and eligibility/break rules. Repository design sources: tasks/TASKS/xg-model/docs/definitions-and-parity.md; tasks/TASKS/xg-model/docs/data-contract-boundaries.md; tasks/TASKS/xg-model/baseline/xg-training-feature-contract.md. These document historical intent, not deployment evidence.
  - External references: NST rebound: attempt within 3 s of a blocked/missed/saved attempt by same team without stoppage
  - Fixtures/test data: `inline fixtures in web/lib/supabase/Upserts/nhlRebounds.test.ts`
  - Tests: `web/lib/supabase/Upserts/nhlRebounds.test.ts`; `web/lib/xg/reboundRichLabels.test.ts`
- **Leads (not audited):**
  - (opus) requires the immediately previous event to be the source; any intervening event (hit, giveaway) breaks it, stricter than NST
  - (opus) blocked-shot sources depend on blocked-shot owner semantics (see attribution flag)
  - (opus) overlap: xG slice
  - (codex:XG-04) No mathematical accuracy or fitness assessment performed. Tests listed, not run.

## M-NST-014 Rush shot detection

- **Match:** Both; Opus NST-028; Codex XG-05
- **Purpose:** Flag rush attempts from transition events in the neutral/defensive zone.
- **Where:** `web/lib/supabase/Upserts/nhlRush.ts:5 (DEFAULT_RUSH_WINDOW_SECONDS)`; `web/lib/supabase/Upserts/nhlRush.ts:91 (isQualifyingRushSource)`; `web/lib/supabase/Upserts/nhlRush.ts:122 (isHardRushBreak)`; `web/lib/supabase/Upserts/nhlRush.ts:149 (buildRushContexts)`; `web/lib/supabase/Upserts/nhlRush.ts:149 buildRushContexts`
- **Tags (heuristic):** generation: current
- **Opus view (NST-028):**
  - Method: Non-rebound eligible attempt; scan back up to 10 s in same period; qualifying source = own takeaway, own faceoff win, opponent giveaway, opponent blocked shot, located in team-relative D or N zone. Stoppages/penalties/period boundaries/any shot or goal/opponent possession events break the scan. XG ROLE: rush definition = up to 10 s backward, sources limited to own takeaway/faceoff win, opponent giveaway/blocked shot in own D or N zone; rebounds cannot be rushes; NO distance or speed threshold (excluded); rush distance/speed are speed_context_v3 features only; fallback xG adds +0.02.
  - Inputs/units: seconds (10 s window), feet; sources: nhl_api_pbp_events
  - Output scale: boolean; seconds; feet; event count; writes: nhl xG shot feature table
  - Status: live — built in-memory on the parity path (playerStatsLandingServer.ts:1078 buildShotFeatureRows); persisted feature job update-nhl-xg-shot-features exists (pages/api/v1/db/update-nhl-xg-shot-features.ts) but its pg_cron SQL is commented out in tasks/TASKS/cron-operations/cron-schedule.md:1645-1655 (manual/backfill only)
  - Consumers: approximate xG (+0.02); rush_attempts / rush_attempts_against in parity; xG model
- **Codex view (XG-05, calculation, location; Codex family 'Expected goals'):** Rush-shot context
  - Purpose: Identify shots linked to qualifying transition sources.
  - Inputs/units: Event team-relative zones, times seconds, locations feet.
  - Output scale: Rush flag/source; elapsed seconds; distance feet, derived speed ft/s.
  - Version/status: Local deterministic heuristic. Production deployment/active database state not checked.
- **Audit context:**
  - Intent (Opus): tasks/TASKS/xg-model/docs/definitions-and-parity.md:60-71 (10 s backward scan, defined sources, D/N team-relative zone; explicit approximation because no controlled-entry data) — the 10 s vs NST 4 s difference is a documented choice
  - Intended contract (Codex XG-05): DEFAULT_RUSH_WINDOW_SECONDS=10; qualifying sources and hard breaks encoded. Repository design sources: tasks/TASKS/xg-model/docs/definitions-and-parity.md; tasks/TASKS/xg-model/docs/data-contract-boundaries.md; tasks/TASKS/xg-model/baseline/xg-training-feature-contract.md. These document historical intent, not deployment evidence.
  - External references: NST rush: attempt within 4 s of any event in the neutral or defensive zone without stoppage
  - Fixtures/test data: `inline fixtures in web/lib/supabase/Upserts/nhlRush.test.ts`
  - Tests: `web/lib/supabase/Upserts/nhlRush.test.ts`
- **Leads (not audited):**
  - (opus) 10 s window vs NST 4 s, and restricted source event types; rush counts will exceed/differ from NST
  - (opus) rush distance uses raw (non-normalized) coordinates of source and shot
  - (opus) overlap: xG slice
  - (codex:XG-05) No mathematical accuracy or fitness assessment performed. Tests listed, not run.

## M-NST-015 Coordinate normalization, shot distance and angle

- **Match:** Both; Opus NST-030; Codex XG-01, XG-02
- **Purpose:** Mirror raw rink coordinates to the attacking direction and compute distance/angle to the net at (89,0).
- **Where:** `web/lib/supabase/Upserts/nhlCoordinates.ts:37 (getTeamAttackingSide)`; `web/lib/supabase/Upserts/nhlCoordinates.ts:51 (normalizeCoordinatesToAttackingDirection)`; `web/lib/supabase/Upserts/nhlShotFeatureBuilder.ts:182 (computeShotDistanceFeet)`; `web/lib/supabase/Upserts/nhlShotFeatureBuilder.ts:192 (computeShotAngleDegrees)`; `web/lib/supabase/Upserts/nhlRebounds.ts:49 (computeShotDistanceFeet duplicate)`; `web/lib/supabase/Upserts/nhlCoordinates.ts:51 normalizeCoordinatesToAttackingDirection`; `web/lib/supabase/Upserts/nhlShotFeatureBuilder.ts:182 computeShotDistanceFeet`; `web/lib/supabase/Upserts/nhlShotFeatureBuilder.ts:192 computeShotAngleDegrees`
- **Tags (heuristic):** generation: current
- **Opus view (NST-030):**
  - Method: Attacking side: home attacks opposite its defending side, away attacks the home defending side. If attacking 'left', negate x and y. Distance = sqrt((89-x)^2 + (0-y)^2) ft; angle = atan2(\|y\|, \|89-x\|) in degrees (0 = straight on). XG ROLE: x,y mirrored only when the owner attacks 'left' (both x and y negated); net fixed at (89,0); no rink-bias/scorekeeper adjustment (excluded); distance and angle are both trained-model features and fallback-bucket inputs.
  - Inputs/units: NHL rink coordinates in feet (x -100..100, y -42.5..42.5); sources: nhl_api_pbp_events
  - Output scale: normalized feet; distance feet; angle degrees 0-90; writes: nhl xG shot feature table
  - Status: live — built in-memory on the parity path (playerStatsLandingServer.ts:1078 buildShotFeatureRows); persisted feature job update-nhl-xg-shot-features exists (pages/api/v1/db/update-nhl-xg-shot-features.ts) but its pg_cron SQL is commented out in tasks/TASKS/cron-operations/cron-schedule.md:1645-1655 (manual/backfill only)
  - Consumers: danger buckets; xG model; rebounds/rush/royal road
- **Codex view (XG-01, calculation, location; Codex family 'Expected goals'):** Attacking-direction coordinate normalization
  - Purpose: Normalize NHL rink coordinates to the offensive net at (89,0).
  - Inputs/units: Raw x/y in feet; event team side and home defending side.
  - Output scale: Normalized x/y feet; attacking side and mirror flag.
  - Version/status: Coordinate helper, shot feature version 1. Production deployment/active database state not checked.
- **Codex view (XG-02, calculation, location; Codex family 'Expected goals'):** Shot distance and angle
  - Purpose: Calculate distance to offensive goal and unsigned angle.
  - Inputs/units: Normalized x/y feet; net (89,0).
  - Output scale: Distance sqrt((89-x)^2+y^2) feet; atan2(abs(y),abs(89-x))*180/pi degrees (0–90).
  - Version/status: NHL_SHOT_FEATURE_VERSION=1. Production deployment/active database state not checked.
- **Audit context:**
  - Intent (Opus): tasks/TASKS/xg-model/docs/definitions-and-parity.md:339 (feature version increments when distance/angle normalization changes); tasks/TASKS/xg-model/docs/event-dictionary.md (coordinates normalized with homeTeamDefendingSide)
  - Intended contract (Codex XG-01): OFFENSIVE_NET_X=89; both axes negated for left-attacking events. Unknown direction produces null geometry. Repository design sources: tasks/TASKS/xg-model/docs/definitions-and-parity.md; tasks/TASKS/xg-model/docs/data-contract-boundaries.md; tasks/TASKS/xg-model/baseline/xg-training-feature-contract.md. These document historical intent, not deployment evidence.
  - Intended contract (Codex XG-02): Inline implementations and NhlShotFeatureRow define units. Repository design sources: tasks/TASKS/xg-model/docs/definitions-and-parity.md; tasks/TASKS/xg-model/docs/data-contract-boundaries.md; tasks/TASKS/xg-model/baseline/xg-training-feature-contract.md. These document historical intent, not deployment evidence.
  - External references: Standard NHL rink coordinates (goal line x=89); MoneyPuck/EH distance-angle features
  - Fixtures/test data: `tasks/artifacts/nhl-pbp-recon-2026-03-30.json`; `inline fixtures in web/lib/supabase/Upserts/nhlCoordinates.test.ts`
  - Tests: `web/lib/supabase/Upserts/nhlCoordinates.test.ts`; `web/lib/supabase/Upserts/nhlNormalizedLayer.test.ts`; `web/lib/supabase/Upserts/nhlShotFeatureBuilder.test.ts`
- **Leads (not audited):**
  - (opus) owner side drives mirroring, so blocked-shot coordinates (block location) and owner semantics both affect distance
  - (opus) shots from behind the net (x>89) get the same angle as in front because \|89-x\| is used
  - (opus) overlap: xG slice
  - (codex:XG-01) Community-convention comparison intentionally deferred.
  - (codex:XG-02) No geometry convention validation performed.

## M-NST-016 Strength segments and TOI by split (skater and goalie)

- **Match:** Both; Opus NST-033; Codex parity-goalie-metrics
- **Purpose:** Derive per-player TOI (seconds) for each strength split by overlapping shift intervals with event-to-event strength segments.
- **Where:** `web/lib/supabase/Upserts/nhlNstParityMetrics.ts:588 (buildStrengthSegments)`; `web/lib/supabase/Upserts/nhlNstParityMetrics.ts:906 (accumulateToiBySplit)`; `web/lib/supabase/Upserts/nhlNstParityMetrics.ts:989 (accumulateGoalieToiBySplit)`; `web/lib/supabase/Upserts/nhlNstParityMetrics.ts:989 accumulateGoalieToiBySplit; :1754 buildGoalieSplitParity`
- **Tags (heuristic):** percent scale: 0-100; denominators: per 60; generation: current
- **Opus view (NST-033):**
  - Method: Segments run from each included event's period_seconds_elapsed to the next included event's time in the same period (last segment ends at period_duration_seconds); each carries its situation and score. For each shift interval, overlap = min(end)-max(start) with each segment of the same game/period; overlap seconds added to every split the segment matches. 'all' TOI uses full shift durationSeconds when scoreState=allScores, otherwise only overlapped seconds passing the score filter. Goalie TOI same, restricted to goalieIds (goalies seen as goalieInNetId on shots).
  - Inputs/units: seconds (period_seconds_elapsed, shift start/end/duration seconds); sources: nhl_api_pbp_events, nhl_api_shift_rows
  - Output scale: TOI in SECONDS per player per split (not minutes); writes: —
  - Status: live — update-player-underlying-stats-yesterday pg_cron (09:35 UTC, active=true, tasks/TASKS/cron-operations/cron-schedule.md:382) -> pages/api/v1/db/update-player-underlying-stats.ts -> lib/underlying-stats/playerStatsSummaryRefresh.ts -> playerStatsLandingServer.ts:1066 buildPlayerStatsNativeGameParity -> buildNstParityMetrics; also read paths pages/api/v1/underlying-stats/players*.ts
  - Consumers: per-60 rates and GAA in buildNstParityMetrics; playerStatsLandingServer.ts (buildPlayerStatsNativeGameParity)
- **Codex view (parity-goalie-metrics, calculation, location; Codex family 'Native NST-parity metrics'):** Goalie saves, save%, GAA, GSAA-labelled xGA differential, danger splits and distances
  - Purpose: Build goalie count/rate tables from attributed shots and shifts.
  - Inputs/units: Shots/goals attributed to goalie; xG values; danger labels; shot and goal distances feet; TOI seconds
  - Output scale: SV%=saves/SA×100; GAA=GA×3600/TOI; gsaa=xGA-GA when available; per60 transforms; high/medium/low danger save% and GAA; average distances=sum/count. HD/MD/LD gsaa game parity fields are null in implementation.
  - Version/status: Local source inspected on octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f, 2026-11-10. Existing dirty working tree preserved. Runtime/deployment and migration-applied state unknown.
- **Audit context:**
  - Intent (Opus): tasks/TASKS/xg-model/docs/definitions-and-parity.md:153 (raw TOI and TOI/GP must remain available); tasks/TASKS/xg-model/nhl-api-foundation/shift-charts-vs-nhl-api-shifts-audit.md (TOI parity audit)
  - Intended contract (Codex parity-goalie-metrics): web/lib/supabase/Upserts/nhlNstParityMetrics.ts types/formulas are code contract; null unavailable values preserved.
  - External references: NST TOI by strength (shift-chart based, seconds)
  - Fixtures/test data: `tasks/artifacts/nhl-pbp-recon-2026-03-30.json (sampled NHL PbP recon)`; `tasks/TASKS/xg-model/docs/event-dictionary.md (observed payload shapes)`; `tasks/TASKS/xg-model/nhl-api-foundation/metric-parity-map.md (legacy NST metric -> NHL-derived mapping)`; `web/__tests__/fixtures/nst/oct1-identity-source.json (NST source sample)`; `inline game fixtures in web/lib/supabase/Upserts/nhlNstParityMetrics.test.ts`; `tasks/TASKS/xg-model/nhl-api-foundation/shift-charts-vs-nhl-api-shifts-audit.md`
  - Tests: `web/lib/supabase/Upserts/nhlNstParityMetrics.test.ts`; `web/lib/underlying-stats/playerStatsLandingServer.test.ts`; `web/lib/underlying-stats/playerStatsSummaryRefresh.test.ts`; `{"discovered_not_run": ["web/lib/supabase/Upserts/nhlNstParityMetrics.test.ts"]}`
- **Leads (not audited):**
  - (opus) 'all' TOI (full shift duration) and split TOI (segment overlap) use different bases, so sum of splits can differ from 'all' when segments have gaps (e.g. before first included event)
  - (opus) segment boundaries come from event timestamps, so strength changes between events (penalty expiry with no event) are assigned to the prior strength until the next event
  - (opus) goalieIds derived only from shot goalieInNetId; a goalie who faced no shots is treated as a skater and gets skater TOI/on-ice rows
  - (opus) O(intervals x segments) filter per interval; fine per game but costly for multi-game inputs
  - (codex:parity-goalie-metrics) No runtime verification or correctness assessment performed.

## M-NST-017 usePlayerStats zone-start % and NST merge coercion

- **Match:** Opus only; Opus NST-001; Codex —
- **Purpose:** Legacy player game log hook: derives DZ/NZ start % per game and merges NST rates.
- **Where:** `web/hooks/usePlayerStats.ts:291 (zone start pct)`; `web/hooks/usePlayerStats.ts:340 (rate merge)`
- **Tags (heuristic):** percent scale: 0-100; denominators: per 60; generation: legacy
- **Opus view (NST-001):**
  - Method: If all three zone-start counts truthy: total = OZ+NZ+DZ; DZ% = DZ/total*100, NZ% = NZ/total*100. All NST fields copied with `value \|\| null`.
  - Inputs/units: counts; per-60; sources: wgo_skater_stats, wgo_skater_stats_playoffs, wgo_goalie_stats, nst_gamelog_as_counts, nst_gamelog_as_counts_oi, nst_gamelog_as_rates, nst_gamelog_as_rates_oi
  - Output scale: percent 0-100; writes: —
  - Status: legacy/dead — no importers of hooks/usePlayerStats found
  - Consumers: none found (no importers)
- **Audit context:**
  - Intent (Opus): UNDOCUMENTED
  - External references: NST/Evolving-Hockey zone start % (OZS% usually excludes neutral starts)
  - Fixtures/test data: none listed
  - Tests: none listed
- **Leads (not audited):**
  - (opus) any zero count (e.g. 0 NZ starts) skips the calculation entirely
  - (opus) `\|\| null` turns legitimate 0 per-60 values into null
  - (opus) neutral starts in denominator, unlike common OZS% convention

## M-NST-018 NST goalie catch-up step planner (windows, budgets, burst sizing)

- **Match:** Opus only; Opus NST-002; Codex —
- **Purpose:** Plan bounded daily NST goalie dataset catch-up: which date/dataset units to fetch, when, with what spacing and attempt cap.
- **Where:** `web/lib/nst/goalieCatchup.ts:3 (GOALIE_DATASETS)`; `web/lib/nst/goalieCatchup.ts:25 (completedGoalieDate)`; `web/lib/nst/goalieCatchup.ts:92 (buildGoalieCatchupManifest)`; `web/lib/nst/goalieCatchup.ts:202 (planGoalieCatchupStep)`; `web/lib/nst/goalieCatchup.server.ts:46 (expectedUnits check)`; `web/lib/nst/goaliePreparation.server.ts:94 (prepareGoalieCatchup)`
- **Tags (heuristic):** denominators: 5v5 only; generation: development
- **Opus view (NST-002):**
  - Method: 10 datasets (5v5/ev/all/pp/pk x counts/rates) per date; completed date = yesterday in America/New_York; manifest span max 14 dates (start..min(seasonEnd, completedDate, start+13 days)); expected units = days*10. Daily caps: MAX_STEPS 7, MAX_ATTEMPTS 60; cooldown 600 s after the last direct NST job; operating windows 08:30-08:35 and 11:10-12:50 UTC and a step (220 s) must fit inside the window. Burst iff 0 < plannedRequestCount < 40 -> up to 20 units at 0 ms spacing, else 6 units at 21,000 ms; maxAttempts = min(units*3, 60 - attemptsUsed); deadline = now + 220 s.
  - Inputs/units: dates YYYY-MM-DD (America/New_York completed day, UTC windows as minutes of day), ms durations, request/attempt counts; sources: goalie catch-up manifest/receipt tables via server adapters (not inspected in detail), NHL final-score schedule payloads
  - Output scale: step decision: unit list (<=20 burst / <=6 paced), minIntervalMs 0 or 21000, maxAttempts <=60, deadline epoch ms; writes: manifest/receipts via goalieCatchup.server.ts adapters
  - Status: draft (opt-in) — only runs when update-nst-goalies is called with ?catchupScope=<sha256> (web/pages/api/v1/db/update-nst-goalies.ts:947-957); goalieCatchup.ts:201 says it 'activates no scheduler'; tables from supabase/migrations/20261101161622_nst_goalie_catchup_v1.sql
  - Consumers: web/lib/nst/goalieCatchup.server.ts (runGoalieCatchupStep); pages/api/v1/db/update-nst-goalies.ts / check-missing-goalie-data.ts
- **Audit context:**
  - Intent (Opus): web/lib/nst/goalieCatchup.ts:90 ('Pure proposal only...') and :200-201 ('These are proposed operating windows; this function activates no scheduler'); NST policy AGENTS.md:105
  - External references: Repository NST rate-limit policy (21 s spacing, burst only <40 total)
  - Fixtures/test data: `web/lib/nst/goalieCatchup.test.ts (manifest/budget fixtures)`
  - Tests: `web/lib/nst/goalieCatchup.server.test.ts`; `web/lib/nst/goalieCatchup.test.ts`; `web/lib/nst/goaliePreparation.server.test.ts`
- **Leads (not audited):**
  - (opus) 08:30-08:35 UTC window is 5 minutes but a step needs 220 s, so only starts before ~08:31:20 qualify
  - (opus) paced step allows 6 units x 3 attempts = 18 attempts at 21 s = 378 s, exceeding the 220 s step deadline; deadline, not the cap, bounds work
  - (opus) burst threshold here is <40 (matches policy) while sharedAdmission semi-burst accepts up to 78 - two different burst rules in the same pipeline
  - (opus) magic constants (14 days, 60 attempts, 7 steps, 600 s cooldown, UTC windows) hard-coded

## M-NST-019 NST goalie freshness assessment (coverage counts and status tiers)

- **Match:** Opus only; Opus NST-003; Codex —
- **Purpose:** Compare expected WGO goalie appearances to NST goalie rows over the last 14 days and classify freshness healthy/warning/critical.
- **Where:** `web/lib/nst/goalieFreshness.ts:31 (assessGoalieFreshness)`; `web/lib/nst/goalieFreshness.ts:50 (14-day floor)`; `web/lib/nst/goalieFreshness.ts:103 (status tiers)`; `web/lib/nst/goalieFreshness.server.ts:44 (readGoalieFreshness)`; `web/lib/nst/goalieFreshness.server.ts:84 (window start)`
- **Tags (heuristic):** generation: current
- **Opus view (NST-003):**
  - Method: cutoff = min(yesterday ET, regularSeasonEnd); window = [max(seasonStart, cutoff-13 days), cutoff]. A game is matched when an NST row exists with non-null hdShotsAgainst (>=0). expected = count, matched = expected - missing, per-date expected/matched, oldestGap = earliest missing date, latestCompleteDate = last date with expected==matched. Status: before 13:00 UTC with gaps -> not_due; else gaps -> critical if (cutoff - oldestGap) >= 2 days or noProgressWindows >= 2, otherwise warning; no gaps -> healthy; any incomplete enumeration -> unknown.
  - Inputs/units: dates YYYY-MM-DD, now (UTC), counts of expected/observed goalie-games, hdShotsAgainst counts; sources: WGO goalie rows, NST goalie gamelog tables, schedule/final-game calendar, checkpoint progress tables
  - Output scale: status enum healthy\|warning\|critical\|unknown\|not_due; integer counts expected/matched; writes: —
  - Status: live — readGoalieFreshness called by web/pages/api/v1/db/cron-report.ts:1763 (cron-report scheduled in web/vercel.json:131)
  - Consumers: pages/api/v1/db/cron-report.ts; pages/api/v1/db/check-missing-goalie-data.ts
- **Audit context:**
  - Intent (Opus): web/lib/nst/goalieFreshness.ts:29-30 ('Evaluate supplied, completely enumerated snapshots...') and :101-102 (13:00 UTC report after catch-up window)
  - External references: none suggested
  - Fixtures/test data: `web/lib/nst/goalieFreshness.test.ts (inline snapshot fixtures)`
  - Tests: `web/lib/nst/goalieFreshness.server.test.ts`; `web/lib/nst/goalieFreshness.test.ts`
- **Leads (not audited):**
  - (opus) 'matched' only checks hdShotsAgainst non-null; other NST goalie fields (e.g. GSAA/xGA) are not verified
  - (opus) hard-coded 13:00 UTC report hour and 2-day / 2-window critical thresholds

## M-NST-020 Goalie parity counts, SV%, GAA and 'GSAA'

- **Match:** Opus only; Opus NST-004; Codex —
- **Purpose:** Compute goalie shots against, saves, GA, SV%, GAA, xGA, GSAA, HD/MD/LD SV% and GAA, rush/rebound attempts against, average shot/goal distance.
- **Where:** `web/lib/supabase/Upserts/nhlNstParityMetrics.ts:1468 (goalie accumulation)`; `web/lib/supabase/Upserts/nhlNstParityMetrics.ts:1754 (buildGoalieSplitParity)`; `web/lib/supabase/Upserts/nhlNstParityMetrics.ts:1765 (svPercentage)`; `web/lib/supabase/Upserts/nhlNstParityMetrics.ts:1780 (gsaa)`; `web/lib/supabase/Upserts/nhlNstParityMetrics.ts:1789 (hd_gaa)`; `web/lib/supabase/Upserts/nhlNstParityMetrics.ts:1820 (avg_shot_distance)`
- **Tags (heuristic):** percent scale: 0-100; denominators: per 60, shots on goal; generation: current
- **Opus view (NST-004):**
  - Method: Goalie team = team opposite event owner. SA/saves from goal+SOG excluding own goals; GA counts all goals incl. own goals. SV% = saves/SA*100. GAA = GA*3600/TOI. xg_against = sum of approximate xG for all non-own-goal attempts. gsaa = xg_against - GA. HD SV% = hd_saves/hd_SA*100; hd_gaa = (hd_SA - hd_saves)*3600/TOI; md/ld analogous; hd/md/ld_gsaa hard-coded null. avg distances = mean shot/goal distance in feet. Per-60 versions via toPer60 including gsaa_per_60. XG INCLUDES (fallback heuristic): shot x,y mirrored to attacking direction by event-owner side and homeTeamDefendingSide, net at (89,0) ft; distance (ft) and angle (deg, \|dy\|/\|89-x\|) only via danger bucket cut-offs (<=20ft&<=35deg high, <=40ft&<=50deg medium); rebound flag (3 s, same team, immediate prior SOG/miss/block); rush flag (10 s backward scan, D/N-zone takeaway/faceoff win/opp giveaway/opp block); royal-road flag; goal outcome floor 0.25. XG EXCLUDES: shot type, strength state, score state, empty-net adjustment, shooter effects, goalie effects, any trained model or training set/seasons (hand-set constants), calibration (excluded). The trained model (scripts/train-nhl-xg-baseline.ts) is NOT wired into this path in production.
  - Inputs/units: shot counts; TOI seconds; distance feet; xG in goals; sources: nhl_api_pbp_events, nhl_api_shift_rows
  - Output scale: SV% percent 0-100; GAA per 60 (per 3600 s); gsaa in goals (xGA-GA); avg distance feet; writes: —
  - Status: live — update-player-underlying-stats-yesterday pg_cron (09:35 UTC, active=true, tasks/TASKS/cron-operations/cron-schedule.md:382) -> pages/api/v1/db/update-player-underlying-stats.ts -> lib/underlying-stats/playerStatsSummaryRefresh.ts -> playerStatsLandingServer.ts:1066 buildPlayerStatsNativeGameParity -> buildNstParityMetrics; also read paths pages/api/v1/underlying-stats/players*.ts; goalie views via lib/underlying-stats/goalieStatsServer.ts / goalieStatsSummaryRefresh.ts
  - Consumers: underlying stats goalie views via playerStatsLandingServer.ts; scripts/run-nhl-xg-release-validation.ts
- **Audit context:**
  - Intent (Opus): tasks/TASKS/xg-model/tasks-nhl-api-xg-model.md:89 (phase-1 parity covers skaters plus goalies); GSAA-as-xGA-minus-GA definition UNDOCUMENTED
  - External references: NST goalie: GSAA = SA x league-average SV% - GA; GSAx = xGA - GA; SV% 0-100 on NST
  - Fixtures/test data: `tasks/artifacts/nhl-pbp-recon-2026-03-30.json (sampled NHL PbP recon)`; `tasks/TASKS/xg-model/docs/event-dictionary.md (observed payload shapes)`; `tasks/TASKS/xg-model/nhl-api-foundation/metric-parity-map.md (legacy NST metric -> NHL-derived mapping)`; `web/__tests__/fixtures/nst/oct1-identity-source.json (NST source sample)`; `inline game fixtures in web/lib/supabase/Upserts/nhlNstParityMetrics.test.ts`
  - Tests: `web/lib/supabase/Upserts/nhlNstParityMetrics.test.ts`; `web/lib/underlying-stats/goalieStatsServer.test.ts`; `web/lib/underlying-stats/playerStatsLandingServer.test.ts`; `web/lib/underlying-stats/playerStatsSummaryRefresh.test.ts`
- **Leads (not audited):**
  - (opus) 'gsaa' is computed as xGA - GA, which is GSAx, not GSAA (league-average-SV% baseline) - label mismatch vs NST
  - (opus) xg_against includes blocked and missed attempts while GA/SV% use shots on goal, and xG is the leaky heuristic in production
  - (opus) GA includes own goals but SA excludes them, so SV% and GA-based GAA disagree
  - (opus) shots against are credited to goalieInNetId regardless of whether goalie is on ice; empty-net events have no goalie so are dropped
  - (opus) hd/md/ld_gsaa always null but still emitted with per-60 columns

## M-NST-021 On-ice For/Against counts by danger

- **Match:** Opus only; Opus NST-005; Codex —
- **Purpose:** Count on-ice CF/CA, FF/FA, SF/SA, GF/GA, xGF/xGA, SCF/SCA, HD/MD/LD CF/CA and GF/GA per player per split.
- **Where:** `web/lib/supabase/Upserts/nhlNstParityMetrics.ts:1411 (owner side increments)`; `web/lib/supabase/Upserts/nhlNstParityMetrics.ts:1439 (opponent side increments)`
- **Tags (heuristic):** denominators: shots on goal; generation: current
- **Opus view (NST-005):**
  - Method: For each shot feature event: owner on-ice skaters get CF (goal/SOG/miss/block), FF (goal/SOG/miss), SF (goal/SOG), GF (any goal incl. own goal), xGF, SCF, and HD/MD/LD CF plus GF by bucket; opponents get the mirrored Against counts. Own goals excluded from CF/FF/SF/xG/danger but included in GF/GA.
  - Inputs/units: event counts; xG in goals; sources: nhl_api_pbp_events, nhl_api_shift_rows
  - Output scale: integer counts; xGF/xGA sums in goals; writes: —
  - Status: live — update-player-underlying-stats-yesterday pg_cron (09:35 UTC, active=true, tasks/TASKS/cron-operations/cron-schedule.md:382) -> pages/api/v1/db/update-player-underlying-stats.ts -> lib/underlying-stats/playerStatsSummaryRefresh.ts -> playerStatsLandingServer.ts:1066 buildPlayerStatsNativeGameParity -> buildNstParityMetrics; also read paths pages/api/v1/underlying-stats/players*.ts
  - Consumers: on-ice % and per-60 in buildNstParityMetrics; playerStatsLandingServer.ts
- **Audit context:**
  - Intent (Opus): tasks/TASKS/xg-model/docs/definitions-and-parity.md:129-146 (on-ice count families CF..LDGA, on-ice SH%/SV%, PDO, zone starts)
  - External references: Natural Stat Trick on-ice: CF = goals+SOG+missed+blocked; FF excludes blocked; SF = goals+SOG
  - Fixtures/test data: `tasks/artifacts/nhl-pbp-recon-2026-03-30.json (sampled NHL PbP recon)`; `tasks/TASKS/xg-model/docs/event-dictionary.md (observed payload shapes)`; `tasks/TASKS/xg-model/nhl-api-foundation/metric-parity-map.md (legacy NST metric -> NHL-derived mapping)`; `web/__tests__/fixtures/nst/oct1-identity-source.json (NST source sample)`; `inline game fixtures in web/lib/supabase/Upserts/nhlNstParityMetrics.test.ts`
  - Tests: `web/lib/supabase/Upserts/nhlNstParityMetrics.test.ts`; `web/lib/underlying-stats/playerStatsLandingServer.test.ts`; `web/lib/underlying-stats/playerStatsSummaryRefresh.test.ts`
- **Leads (not audited):**
  - (opus) GF/GA only counted when a shot feature row exists; goals filtered out of shot features (e.g. delayed-penalty typed rows) would be missing from GF
  - (opus) own goals count in GF/GA but not SF/SA, so on-ice SV% = (SA-GA)/SA can be pulled below the save rate of actual shots
  - (opus) HD/MD/LD 'CF' counts blocked attempts by bucket (NST HDCF excludes blocked HD attempts from HDC)

## M-NST-022 Zone starts and zone faceoff shares

- **Match:** Opus only; Opus NST-006; Codex —
- **Purpose:** Count O/N/D zone starts and on-ice zone faceoffs and compute OZS% and OZFO%.
- **Where:** `web/lib/supabase/Upserts/nhlNstParityMetrics.ts:1543 (zone-start block)`; `web/lib/supabase/Upserts/nhlNstParityMetrics.ts:444 (getTeamRelativeZone)`; `web/lib/supabase/Upserts/nhlNstParityMetrics.ts:1074 (buildShiftStartPlayersByMoment)`
- **Tags (heuristic):** percent scale: 0-100; generation: current
- **Opus view (NST-006):**
  - Method: Zone code made team-relative (owner keeps code, opponent inverted O<->D). A faceoff is a zone start if the previous event is stoppage/period-start/goal/penalty/delayed-penalty; zone-start credit goes only to on-ice players whose shift started at that exact period second. All on-ice players get zone faceoff counts. OZS% = OZ/(OZ+NZ+DZ)*100; OZFO% = OZFO/(all FO)*100.
  - Inputs/units: faceoff counts; zone codes O/N/D; sources: nhl_api_pbp_events, nhl_api_shift_rows
  - Output scale: counts; OZS% and OZFO% percent 0-100 (NZ in denominator); writes: —
  - Status: live — update-player-underlying-stats-yesterday pg_cron (09:35 UTC, active=true, tasks/TASKS/cron-operations/cron-schedule.md:382) -> pages/api/v1/db/update-player-underlying-stats.ts -> lib/underlying-stats/playerStatsSummaryRefresh.ts -> playerStatsLandingServer.ts:1066 buildPlayerStatsNativeGameParity -> buildNstParityMetrics; also read paths pages/api/v1/underlying-stats/players*.ts
  - Consumers: underlying stats player landing
- **Audit context:**
  - Intent (Opus): tasks/TASKS/xg-model/docs/definitions-and-parity.md:146-148 (O/N/D zone starts, zone faceoffs, on-the-fly starts are parity targets); zone-start detection rule UNDOCUMENTED
  - External references: NST zone starts (shifts starting with a faceoff; OZS% often reported excluding neutral zone)
  - Fixtures/test data: `tasks/artifacts/nhl-pbp-recon-2026-03-30.json (sampled NHL PbP recon)`; `tasks/TASKS/xg-model/docs/event-dictionary.md (observed payload shapes)`; `tasks/TASKS/xg-model/nhl-api-foundation/metric-parity-map.md (legacy NST metric -> NHL-derived mapping)`; `web/__tests__/fixtures/nst/oct1-identity-source.json (NST source sample)`; `inline game fixtures in web/lib/supabase/Upserts/nhlNstParityMetrics.test.ts`
  - Tests: `web/lib/supabase/Upserts/nhlNstParityMetrics.test.ts`; `web/lib/underlying-stats/playerStatsLandingServer.test.ts`; `web/lib/underlying-stats/playerStatsSummaryRefresh.test.ts`
- **Leads (not audited):**
  - (opus) OZS% denominator includes neutral-zone starts; NST's commonly quoted Off. Zone Start % excludes NZ (OZ/(OZ+DZ))
  - (opus) NHL zoneCode on faceoffs is relative to the event owner (winner); inversion assumes that - verify
  - (opus) on-the-fly shift starts that coincide with a faceoff second are counted as zone starts

## M-NST-023 IPP (parity)

- **Match:** Opus only; Opus NST-007; Codex —
- **Purpose:** Individual points percentage = share of on-ice goals for in which player recorded a point.
- **Where:** `web/lib/supabase/Upserts/nhlNstParityMetrics.ts:1605 (buildSkaterSplitParity ipp)`
- **Tags (heuristic):** percent scale: 0-100; generation: current
- **Opus view (NST-007):**
  - Method: ipp = (goals + total_assists) / oi.gf * 100 when oi.gf > 0 else null.
  - Inputs/units: counts; sources: in-memory
  - Output scale: percent 0-100; writes: —
  - Status: live — update-player-underlying-stats-yesterday pg_cron (09:35 UTC, active=true, tasks/TASKS/cron-operations/cron-schedule.md:382) -> pages/api/v1/db/update-player-underlying-stats.ts -> lib/underlying-stats/playerStatsSummaryRefresh.ts -> playerStatsLandingServer.ts:1066 buildPlayerStatsNativeGameParity -> buildNstParityMetrics; also read paths pages/api/v1/underlying-stats/players*.ts
  - Consumers: underlying stats player landing
- **Audit context:**
  - Intent (Opus): tasks/TASKS/xg-model/nhl-api-foundation/metric-parity-map.md (IPP as NST metric replacement) — formula itself UNDOCUMENTED
  - External references: NST IPP = points / on-ice GF (percent)
  - Fixtures/test data: `tasks/artifacts/nhl-pbp-recon-2026-03-30.json (sampled NHL PbP recon)`; `tasks/TASKS/xg-model/docs/event-dictionary.md (observed payload shapes)`; `tasks/TASKS/xg-model/nhl-api-foundation/metric-parity-map.md (legacy NST metric -> NHL-derived mapping)`; `web/__tests__/fixtures/nst/oct1-identity-source.json (NST source sample)`; `inline game fixtures in web/lib/supabase/Upserts/nhlNstParityMetrics.test.ts`
  - Tests: `web/lib/supabase/Upserts/nhlNstParityMetrics.test.ts`; `web/lib/underlying-stats/playerStatsLandingServer.test.ts`; `web/lib/underlying-stats/playerStatsSummaryRefresh.test.ts`
- **Leads (not audited):**
  - (opus) on-ice GF includes own goals (which give no points) and individual goals exclude penalty-shot goals, so IPP can deviate slightly from NST

## M-NST-024 On-ice attribution per event

- **Match:** Opus only; Opus NST-009; Codex —
- **Purpose:** Map an event to owner-team and opponent on-ice player lists for For/Against crediting.
- **Where:** `web/lib/supabase/Upserts/nhlOnIceAttribution.ts:48 (buildOnIceAttributionForEvent)`; `web/lib/supabase/Upserts/nhlOnIceAttribution.ts:151 (isEntityOnIce)`
- **Tags (heuristic):** generation: current
- **Opus view (NST-009):**
  - Method: Find stint at (period, second); ownerPlayerIds = players of event_owner_team_id, opponentPlayerIds = other team. Entity helpers test player/pairing (2)/line (>=3) all on ice.
  - Inputs/units: period number, period second, team ids; sources: nhl_api_pbp_events, nhl_api_shift_rows
  - Output scale: player id lists (owner/opponent); writes: —
  - Status: live — update-player-underlying-stats-yesterday pg_cron (09:35 UTC, active=true, tasks/TASKS/cron-operations/cron-schedule.md:382) -> pages/api/v1/db/update-player-underlying-stats.ts -> lib/underlying-stats/playerStatsSummaryRefresh.ts -> playerStatsLandingServer.ts:1066 buildPlayerStatsNativeGameParity -> buildNstParityMetrics; also read paths pages/api/v1/underlying-stats/players*.ts
  - Consumers: buildNstParityMetrics on-ice counts; nhlContextualFeatures
- **Audit context:**
  - Intent (Opus): tasks/TASKS/xg-model/tasks-nhl-api-xg-model.md:48 (on-ice player-set attribution, team-relative strength, entity membership); tasks/TASKS/xg-model/docs/event-dictionary.md (eventOwnerTeamId alone not enough for on-ice attribution)
  - External references: NST on-ice For/Against attribution
  - Fixtures/test data: `tasks/TASKS/xg-model/nhl-api-foundation/manual-audit-requirements.md (on-ice spot-check procedure)`; `tasks/artifacts/nhl-pbp-recon-2026-03-30.json`; `tasks/TASKS/xg-model/docs/event-dictionary.md:256 (blocked-shot payload keys)`
  - Tests: `web/lib/supabase/Upserts/nhlNormalizedLayer.test.ts`; `web/lib/supabase/Upserts/nhlOnIceAttribution.test.ts`
- **Leads (not audited):**
  - (opus) For/Against depends entirely on event_owner_team_id; parser takes it raw from NHL details and no blocked-shot owner flip exists (fixture test assumes owner = shooting team). If live api-web reports the blocking team as owner for blocked-shot events, CF/CA and iCF for blocked attempts are reversed - verify against live payloads
  - (opus) goalies are inside ownerPlayerIds, so goalies accrue skater on-ice CF/CA rows unless filtered by goalieIds

## M-NST-025 Normalized event inclusion rules

- **Match:** Opus only; Opus NST-010; Codex —
- **Purpose:** Decide which events count toward parity, on-ice parity and shot features.
- **Where:** `web/lib/supabase/Upserts/nhlEventInclusion.ts:86 (isShootoutEvent)`; `web/lib/supabase/Upserts/nhlEventInclusion.ts:95 (isPenaltyShotEvent)`; `web/lib/supabase/Upserts/nhlEventInclusion.ts:101 (hasRareManpower)`; `web/lib/supabase/Upserts/nhlEventInclusion.ts:106 (evaluateNormalizedEventInclusion)`
- **Tags (heuristic):** denominators: 5v5 only; generation: current
- **Opus view (NST-010):**
  - Method: Exclude shootout (type/period regex or 'SO') and penalty shot (regex /penalty[- ]shot/ on reason/descKey texts) from parity; shot features also exclude delayed-penalty events. Flags: EN if strength_state EN, OT if period>3 or OT text, rare manpower if strength_exact not in {3v3,4v3,3v4,4v4,5v3,3v5,5v4,4v5,5v5,6v5,5v6}.
  - Inputs/units: event type/period text; sources: nhl_api_pbp_events
  - Output scale: booleans and exclusion reason; writes: —
  - Status: live — every nhl* builder and parity call
  - Consumers: nhlNstParityMetrics; nhlShotFeatureBuilder; nhlRebounds/nhlRush/nhlFlurries/nhlMissReasons
- **Audit context:**
  - Intent (Opus): tasks/TASKS/xg-model/docs/definitions-and-parity.md:205-206 and :213-220 (shootouts and penalty shots stored but excluded from parity, on-ice parity and shot features until a versioned penalty-shot method exists) — exclusion is intentional
  - External references: NST excludes shootouts; NHL counts penalty-shot goals as goals
  - Fixtures/test data: `inline fixtures in web/lib/supabase/Upserts/nhlEventInclusion.test.ts`
  - Tests: `web/lib/supabase/Upserts/nhlEventInclusion.test.ts`; `web/lib/supabase/Upserts/nhlNormalizedLayer.test.ts`
- **Leads (not audited):**
  - (opus) penalty-shot attempts/goals dropped from all parity counts, diverging from NHL official goals and NST (which counts penalty-shot goals in individual stats)

## M-NST-026 PbP clock and game-time derivation

- **Match:** Opus only; Opus NST-015; Codex —
- **Purpose:** Convert NHL clock strings into period/game seconds elapsed, period durations and inter-event deltas.
- **Where:** `web/lib/supabase/Upserts/nhlPlayByPlayParser.ts:129 (parseClockToSeconds)`; `web/lib/supabase/Upserts/nhlPlayByPlayParser.ts:188 (derivePeriodDurationSeconds)`; `web/lib/supabase/Upserts/nhlPlayByPlayParser.ts:219 (buildPeriodDurations)`; `web/lib/supabase/Upserts/nhlPlayByPlayParser.ts:240 (cumulativeSecondsBeforePeriod)`; `web/lib/supabase/Upserts/nhlPlayByPlayParser.ts:268 (parseNhlPlayByPlayEvents)`; `web/lib/supabase/Upserts/nhlShotFeatureBuilder.ts:311 (hydratePersistedEventTimingFields)`
- **Tags (heuristic):** generation: current
- **Opus view (NST-015):**
  - Method: Period duration = elapsed + remaining (max per period), fallback 1200 s regulation, 300 s OT, 0 shootout. game_seconds_elapsed = sum of prior period durations + period elapsed. seconds_since_previous_event = difference vs previous ordered event (hydrated version clamps to >=0). Events ordered by sortOrder then eventId.
  - Inputs/units: clock strings mm:ss; sources: NHL api-web gamecenter play-by-play, nhl_api_pbp_events
  - Output scale: seconds (period, game, delta); writes: nhl_api_pbp_events (via normalized ingest)
  - Status: live — nhlPlayByPlayParser used by normalized ingest (nhlRawGamecenterRoute/update-player-underlying-stats path) and by all builders
  - Consumers: all nhl* context builders; parity segments
- **Audit context:**
  - Intent (Opus): tasks/TASKS/xg-model/docs/data-contract-boundaries.md (normalized layer owns parsed timing/strength; versioned via parser_version/strength_version)
  - External references: none suggested
  - Fixtures/test data: `tasks/artifacts/nhl-pbp-recon-2026-03-30.json`; `tasks/TASKS/xg-model/docs/event-dictionary.md`
  - Tests: `web/lib/supabase/Upserts/nhlNormalizedLayer.test.ts`; `web/lib/supabase/Upserts/nhlPlayByPlayParser.test.ts`
- **Leads (not audited):**
  - (opus) OT default 300 s is regular-season only; playoff OT (1200 s) relies on inferred elapsed+remaining
  - (opus) parser does not clamp negative seconds_since_previous_event; feature builder does (Math.max(0, ...)) - two slightly different definitions

## M-NST-027 NST rate-limit admission window math (local ledger + shared RPC + Python admission)

- **Match:** Opus only; Opus NST-018; Codex —
- **Purpose:** Decide when the next NST request may start so the rolling 1m/5m/15m/1h windows and 21 s spacing are never exceeded across callers.
- **Where:** `web/lib/nst/requestBudget.ts:83 (withNstRequestBudget)`; `web/lib/nst/requestBudget.ts:107 (1h ledger prune + window wait loop to :120)`; `web/lib/nst/sharedAdmission.ts:68 (admitSharedNstAttempt)`; `web/lib/nst/sharedAdmission.ts:78 (burst eligibility)`; `web/lib/cron/nstRateLimitPolicy.ts:28 (NST_RATE_LIMIT_WINDOWS)`; `web/lib/cron/nstRateLimitPolicy.ts:57 (getProjectedRequestsInWindow)`; `web/lib/cron/nstRateLimitPolicy.ts:122 (canUseNstSemiBurst)`; `functions/lib/nst_admission.py:169 (admit_nst_attempt)`; `functions/lib/nst_admission.py:184 (burst eligibility)`; `web/lib/nst/client.ts:281 (admission deadline = run deadline - timeout - 5 s)`
- **Tags (heuristic):** generation: current
- **Opus view (NST-018):**
  - Method: Windows: 1m max 39, 5m max 80, 15m max 100, 1h max 180; min spacing 21,000 ms. Local ledger: drop inactive attempts older than 1 h; wait = max(100 ms if same URL in flight, last.startedAt + max(last.intervalMs, intervalMs) - now, for each window with count>=max: the (count-max)-th oldest startedAt + windowMs + 1 - now). Interval = 0 only when minIntervalMs==0 AND plannedRequestCount is a safe integer 1..78 (semi-burst, 'two 39-attempt waves'); else max(21000, minIntervalMs). Every network attempt (incl. retries) counts. Shared RPC: POST with p_burst/p_planned_requests; if allowed, permit must be used within permitTtlMs=1000 ms measured from before the POST; if denied sleep max(25 ms, waitMs). Python mirror: same receipt checks, burst iff min_interval_ms==0 and 1<=planned_requests<=78, default min_interval_ms 21000, default deadline now+220 s, sleep max(0.025 s, waitMs/1000). Static plan check: projected requests in a window at fixed cadence = min(n, floor(window/interval)+1).
  - Inputs/units: milliseconds (TS: windowMs, intervalMs, waitMs, Date.now epoch ms); seconds (Python: time.monotonic, waitMs/1000); request counts per rolling window; sources: local /tmp ledger file fhfhockey-nst-budget-<uid>/attempts.json, Supabase RPC nst_admit_attempt_v1 / nst_admit_job_attempt_v1
  - Output scale: wait time in ms (>=0) or permit/deny; ledger counts per window 0..39/80/100/180; writes: local ledger file (attempts.json), shared admission ledger via RPC (server-side SQL, not in this slice)
  - Status: live — every NST fetch goes through web/lib/nst/client.ts:280 (withNstRequestBudget) and admitSharedNstAttempt; used by update-nst-goalies, update-nst-team-daily, update-nst-gamelog etc.; scheduled per web/lib/cron/nstCoordination.ts:20-23 (update-nst-goalies 08:30 UTC, team-daily 09:55 UTC); job lifecycle gated by env NST_JOB_LIFECYCLE_ENABLED (web/lib/nst/jobLifecycle.server.ts:76)
  - Consumers: web/lib/nst/client.ts (all NST page fetches); pages/api/v1/db/update-nst-*.ts routes; functions/api/fetch_team_table.py and other Python NST callers
- **Audit context:**
  - Intent (Opus): AGENTS.md:105 (NST: 40/1m, 80/5m, 100/15m, 180/h unique URLs; jobs <40 requests may burst; >=21 s spacing); web/lib/cron/nstRateLimitPolicy.ts:25-27 and :120-121 ('at most two 39-attempt waves; the authoritative ledger decides'); functions/lib/nst_admission.py:1-5
  - External references: Repository NST policy (AGENTS.md / memory): 40/1m, 80/5m, 100/15m, 180/h unique URLs, 21 s spacing, only jobs <40 requests may burst
  - Fixtures/test data: `web/lib/cron/nstRateLimitPolicy.test.ts (window/interval cases)`; `web/lib/nst/requestBudget.test.ts (ledger scenarios)`; `functions/tests/test_nst_admission.py (receipt fixtures)`
  - Tests: `functions/tests/test_fetch_team_table_contract.py`; `functions/tests/test_nst_admission.py`; `functions/tests/test_nst_legacy_lifecycle.py`; `web/__tests__/pages/api/v1/db/update-nst-gamelog.test.ts`; `web/lib/cron/nstBurstPlans.test.ts`; `web/lib/cron/nstCoordination.test.ts`; `web/lib/cron/nstRateLimitPolicy.test.ts`; `web/lib/nst/client.test.ts`; `web/lib/nst/clientOperationControls.test.ts`; `web/lib/nst/jobLifecycle.server.test.ts`; `web/lib/nst/nstBypassGuard.test.ts`; `web/lib/nst/requestBudget.test.ts`; `web/lib/nst/sharedAdmission.test.ts`
- **Leads (not audited):**
  - (opus) 1m window is coded as 39 (stricter than documented 40) - fine, but differs from the policy text
  - (opus) semi-burst eligibility allows plannedRequestCount up to 78 (TS canUseNstSemiBurst and Python <=78), looser than the documented 'only a job needing fewer than 40 requests may burst'; safety then depends entirely on the server-side RPC enforcing windows
  - (opus) local ledger is per-host /tmp (explicitly not distributed); the authoritative window math lives in the nst_admit_attempt_v1 SQL, outside this slice
  - (opus) window membership uses now - startedAt <= windowMs (inclusive) and adds +1 ms; startedAt is stamped after dispatch, so window expiry is measured from dispatch not completion
  - (opus) limits are documented as unique-URL limits but both TS and Python count every attempt including retries (conservative)

## M-NST-028 Score-state filters (parity)

- **Match:** Opus only; Opus NST-019; Codex —
- **Purpose:** Restrict parity counts and TOI to tied/leading/trailing/withinOne/upOne/downOne score states.
- **Where:** `web/lib/supabase/Upserts/nhlNstParityMetrics.ts:782 (getScoreStateBucketFromDiff)`; `web/lib/supabase/Upserts/nhlNstParityMetrics.ts:802 (matchesScoreStateFromDiff)`; `web/lib/supabase/Upserts/nhlNstParityMetrics.ts:818 (getTeamScoreDiff)`; `web/lib/supabase/Upserts/nhlNstParityMetrics.ts:840 (getPreEventScores)`; `web/lib/supabase/Upserts/nhlNstParityMetrics.ts:863 (matchesEventScoreState)`; `web/lib/supabase/Upserts/nhlNstParityMetrics.ts:887 (matchesSegmentScoreState)`
- **Tags (heuristic):** generation: current
- **Opus view (NST-019):**
  - Method: Team diff = own score - opponent score; for goal events subtract the goal from the scorer to get pre-event score. Buckets: 0 tied, +1 upOne, -1 downOne, >1 leading, <-1 trailing; withinOne = \|diff\|<=1. Note leading/trailing buckets exclude +-1 by construction. Null diff fails any non-allScores filter.
  - Inputs/units: goal counts (home/away score); sources: nhl_api_pbp_events
  - Output scale: boolean filter; writes: —
  - Status: live — update-player-underlying-stats-yesterday pg_cron (09:35 UTC, active=true, tasks/TASKS/cron-operations/cron-schedule.md:382) -> pages/api/v1/db/update-player-underlying-stats.ts -> lib/underlying-stats/playerStatsSummaryRefresh.ts -> playerStatsLandingServer.ts:1066 buildPlayerStatsNativeGameParity -> buildNstParityMetrics; also read paths pages/api/v1/underlying-stats/players*.ts (scoreState option exposed by player underlying-stats views)
  - Consumers: buildNstParityMetrics(scoreState option); playerStatsLandingServer.ts score-state views
- **Audit context:**
  - Intent (Opus): tasks/TASKS/xg-model/docs/event-dictionary.md (goal carries homeScore/awayScore at 100%; score fields are NOT present on every event class) — supports the null-diff concern; bucket semantics UNDOCUMENTED
  - External references: NST score states (Tied, Leading, Trailing, Within 1, Up 1, Down 1, Close); NST Leading includes all leads
  - Fixtures/test data: `tasks/artifacts/nhl-pbp-recon-2026-03-30.json (sampled NHL PbP recon)`; `tasks/TASKS/xg-model/docs/event-dictionary.md (observed payload shapes)`; `tasks/TASKS/xg-model/nhl-api-foundation/metric-parity-map.md (legacy NST metric -> NHL-derived mapping)`; `web/__tests__/fixtures/nst/oct1-identity-source.json (NST source sample)`; `inline game fixtures in web/lib/supabase/Upserts/nhlNstParityMetrics.test.ts`
  - Tests: `web/lib/supabase/Upserts/nhlNstParityMetrics.test.ts`; `web/lib/underlying-stats/playerStatsLandingServer.test.ts`; `web/lib/underlying-stats/playerStatsSummaryRefresh.test.ts`
- **Leads (not audited):**
  - (opus) 'leading'/'trailing' mean lead/trail by 2+ only (diff==1 maps to upOne), unlike NST where Leading includes +1
  - (opus) relies on per-event home_score/away_score; in api-web these are populated on goal events only, so for most events/segments diff is null and the score-state filter returns false unless an upstream step back-fills running scores - verify
  - (opus) duplicate score logic exists in nhlScoreState.ts (running score) with different semantics

## M-NST-029 Shift interval normalization, stints and stint lookup

- **Match:** Opus only; Opus NST-021; Codex —
- **Purpose:** Clean NHL shift rows into intervals, dedupe, build constant-personnel stints and find on-ice players at an event second.
- **Where:** `web/lib/supabase/Upserts/nhlShiftStints.ts:84 (normalizeShiftInterval)`; `web/lib/supabase/Upserts/nhlShiftStints.ts:136 (normalizeShiftIntervals)`; `web/lib/supabase/Upserts/nhlShiftStints.ts:195 (buildShiftStints)`; `web/lib/supabase/Upserts/nhlShiftStints.ts:270 (findShiftStintAtTime)`
- **Tags (heuristic):** generation: current
- **Opus view (NST-021):**
  - Method: If end<=start or null, end = start + duration; drop non-positive durations. Dedupe on game/player/team/period/start/end keeping lowest shift_id. Stints: split each period at every shift start/end boundary, players active if interval overlaps [start,end); merge adjacent identical personnel. Lookup at second s: candidates with start<=s<=end; prefer the stint ENDING at s, else start<=s<end.
  - Inputs/units: seconds within period; sources: nhl_api_shift_rows
  - Output scale: intervals/stints in period seconds; writes: —
  - Status: live — used by parity path and contextual features (see buildNstParityMetrics status)
  - Consumers: nhlOnIceAttribution; nhlNstParityMetrics; nhlContextualFeatures
- **Audit context:**
  - Intent (Opus): tasks/TASKS/xg-model/tasks-nhl-api-xg-model.md:83 (shift integration treated as a release blocker); no stated shift-change tie-break rule found — UNDOCUMENTED for the end-of-stint preference
  - External references: NST shift-change convention (events at a change second credited to outgoing players except faceoffs credited to incoming)
  - Fixtures/test data: `inline shift fixtures in web/lib/supabase/Upserts/nhlShiftStints.test.ts`; `tasks/TASKS/xg-model/nhl-api-foundation/shift-charts-vs-nhl-api-shifts-audit.md`
  - Tests: `web/lib/supabase/Upserts/nhlNormalizedLayer.test.ts`; `web/lib/supabase/Upserts/nhlOnIceAttribution.test.ts`; `web/lib/supabase/Upserts/nhlShiftStints.test.ts`
- **Leads (not audited):**
  - (opus) tie-break prefers the stint ending at the event second for ALL event types, including faceoffs; parity only uses the incoming stint for faceoffs that qualify as zone starts
  - (opus) goalies are included in stints, so on-ice player lists include goalies (affects contextual shift-age averages)

## M-NST-030 Miss-reason buckets

- **Match:** Opus only; Opus NST-024; Codex —
- **Purpose:** Bucket missed-shot reasons (short side, wide, post, crossbar, over, blocked-like).
- **Where:** `web/lib/supabase/Upserts/nhlMissReasons.ts:36 (classifyMissReasonBucket)`; `web/lib/supabase/Upserts/nhlMissReasons.ts:51 (buildMissReasonContext)`
- **Tags (heuristic):** generation: current
- **Opus view (NST-024):**
  - Method: Lowercased substring rules in order: short -> short-side; wide; crossbar; post; over -> over-net; blocked -> blocked-like; else other.
  - Inputs/units: reason strings; sources: nhl_api_pbp_events
  - Output scale: categorical bucket; boolean; writes: nhl xG shot feature table
  - Status: live — built in-memory on the parity path (playerStatsLandingServer.ts:1078 buildShotFeatureRows); persisted feature job update-nhl-xg-shot-features exists (pages/api/v1/db/update-nhl-xg-shot-features.ts) but its pg_cron SQL is commented out in tasks/TASKS/cron-operations/cron-schedule.md:1645-1655 (manual/backfill only)
  - Consumers: xG features
- **Audit context:**
  - Intent (Opus): tasks/TASKS/xg-model/tasks-nhl-api-xg-model.md:57 (short-side and other miss buckets with explicit parity and xG inclusion flags)
  - External references: none suggested
  - Fixtures/test data: `inline fixtures in web/lib/supabase/Upserts/nhlMissReasons.test.ts`
  - Tests: `web/lib/supabase/Upserts/nhlMissReasons.test.ts`
- **Leads (not audited):**
  - (opus) 'hit-crossbar' style reasons are matched by order (crossbar before post); 'short' match may catch unrelated strings
  - (opus) overlap: xG slice

## M-NST-031 Shot feature row assembly

- **Match:** Opus only; Opus NST-029; Codex —
- **Purpose:** Assemble one feature row per eligible shot attempt combining geometry, context and inclusion flags.
- **Where:** `web/lib/supabase/Upserts/nhlShotFeatureBuilder.ts:384 (resolveGoalieOnIceFlags)`; `web/lib/supabase/Upserts/nhlShotFeatureBuilder.ts:410 (buildShotFeatureRows)`
- **Tags (heuristic):** denominators: unblocked attempts, shots on goal; generation: current
- **Opus view (NST-029):**
  - Method: Filter is_shot_like and includeInShotFeatures; isShotOnGoal = SOG or non-own goal; isUnblockedShotAttempt = not blocked and not own goal; goalie-on-ice flags from situationCode by owner side; shooter = shooting ?? scoring player; merges score-state, rebound, rush, flurry, miss reason, contextual features. Several features hard-coded null (roster position, handedness, F/D counts, deployment buckets). XG MODEL (trained, consumes these feature rows; scripts/train-nhl-xg-baseline.ts + web/lib/xg/baselineDataset.ts): model type default xgboost_js (train-nhl-xg-baseline.ts:665), alternatives logistic_unregularized/logistic_l2/logistic_elastic_net (:2003); training set = unblocked attempts (goal, SOG, missed; blocked excluded; own goals excluded via isUnblockedShotAttempt) excluding penalty shots and shootouts (baselineDataset.ts:281-296), empty-net shots INCLUDED with isEmptyNetEvent as a feature; default season 20252026 single season (train-nhl-xg-baseline.ts:298,:660), game-level train/validation/test split; features first_pass_v1 = normalizedX/Y, shotDistanceFeet, shotAngleDegrees, period, period/game seconds, time and distance since previous event, ownerPowerPlayAgeSeconds, shooterShiftAgeSeconds, east-west/north-south movement, isReboundShot, isRushShot, isFlurryShot, isEmptyNetEvent, isOvertimeEvent, crossedRoyalRoad, previousEventSameTeam, shotType, strengthState, strengthExact, zoneCode, previousEventTypeDescKey; expanded_v2 adds score diffs, ownerScoreDiffBucket, late-game flags, possession features, isDefensemanShooter and shooter roster position; speed_context_v3 adds speeds/rush distance. EXCLUDED: shooter identity/talent, goalie identity/talent, handedness and goalie catch hand (null in feature v1), F/D on-ice counts (null), shotEventType/missReasonBucket/isShortSideMiss (forbidden as leakage, baselineDataset.ts:241). Calibration: raw by default, Platt or isotonic optional (web/lib/xg/calibration.ts:46). Released artifact seasons not checked here (overlap: xG slice).
  - Inputs/units: feet, degrees, seconds, booleans, categorical strings; sources: nhl_api_pbp_events, nhl_api_shift_rows
  - Output scale: one feature row per eligible attempt (featureVersion 1); writes: nhl xG shot feature table via pages/api/v1/db/update-nhl-xg-shot-features.ts
  - Status: live — built in-memory on the parity path (playerStatsLandingServer.ts:1078 buildShotFeatureRows); persisted feature job update-nhl-xg-shot-features exists (pages/api/v1/db/update-nhl-xg-shot-features.ts) but its pg_cron SQL is commented out in tasks/TASKS/cron-operations/cron-schedule.md:1645-1655 (manual/backfill only)
  - Consumers: buildNstParityMetrics; playerStatsLandingServer.ts; scripts/train-nhl-xg-baseline.ts; scripts/run-nhl-xg-release-validation.ts
- **Audit context:**
  - Intent (Opus): tasks/TASKS/xg-model/tasks-nhl-api-xg-model.md:62,69 (integrated shot-feature row assembly across distance, angle, rebound, rush, flurry, miss-reason and exclusions); tasks/TASKS/xg-model/docs/data-contract-boundaries.md:178 (approximations isolated in the derived layer)
  - External references: MoneyPuck/Evolving-Hockey xG feature sets
  - Fixtures/test data: `tasks/artifacts/nhl-pbp-recon-2026-03-30.json`; `inline fixtures in web/lib/supabase/Upserts/nhlShotFeatureBuilder.test.ts`
  - Tests: `web/lib/supabase/Upserts/nhlShotFeatureBuilder.test.ts`; `web/lib/xg/baselineDataset.test.ts`; `web/lib/xg/deploymentContext.test.ts`; `web/lib/xg/featureCoverage.test.ts`; `web/lib/xg/shotFeatureEnrichment.test.ts`; `web/scripts/train-nhl-xg-baseline.test.ts`
- **Leads (not audited):**
  - (opus) shooter handedness/position/F-D counts are always null in v1, so models using them see constants
  - (opus) no xgValue/dangerBucket attached, forcing parity to heuristic fallbacks
  - (opus) overlap: xG slice

## M-NST-032 Team-relative strength-state and split classification

- **Match:** Opus only; Opus NST-031; Codex —
- **Purpose:** Classify each event/time segment into all/EV/5v5/PP/PK/5v4/4v5/3v3/withEN/againstEN splits from the NHL situationCode.
- **Where:** `web/lib/supabase/Upserts/nhlStrengthState.ts:24 (parseSituationCode)`; `web/lib/supabase/Upserts/nhlStrengthState.ts:64 (isEmptyNetSituation)`; `web/lib/supabase/Upserts/nhlStrengthState.ts:71 (classifyTeamStrengthState)`; `web/lib/supabase/Upserts/nhlNstParityMetrics.ts:654 (resolveTeamRelativeSituation)`; `web/lib/supabase/Upserts/nhlNstParityMetrics.ts:688 (matchesRelativeStrengthSplit)`; `web/lib/supabase/Upserts/nhlNstParityMetrics.ts:740 (getSplitKeysForTeamSituation)`
- **Tags (heuristic):** denominators: 5v5 only; generation: current
- **Opus view (NST-031):**
  - Method: Parse situationCode digits. classifyTeamStrengthState: if either goalie=0 -> 'EN'; else equal skaters -> EV, more -> PP, fewer -> SH. Splits: ev = teamState EV; fiveOnFive = both goalies in and 5v5 skaters; pp = PP; pk = SH; fiveOnFourPP/fourOnFivePK require goalies in and exact 5v4/4v5; threeOnThree = goalies in and 3v3; withEmptyNet = own goalie 0; againstEmptyNet = opponent goalie 0. An event can belong to several splits; 'all' always added.
  - Inputs/units: situationCode 4-digit string (goalie/skater counts); sources: nhl_api_pbp_events (parsed NHL api-web play-by-play)
  - Output scale: categorical split keys; strength_state EV/PP/SH/EN; strength_exact 'awayvhome'; writes: —
  - Status: live — update-player-underlying-stats-yesterday pg_cron (09:35 UTC, active=true, tasks/TASKS/cron-operations/cron-schedule.md:382) -> pages/api/v1/db/update-player-underlying-stats.ts -> lib/underlying-stats/playerStatsSummaryRefresh.ts -> playerStatsLandingServer.ts:1066 buildPlayerStatsNativeGameParity -> buildNstParityMetrics; also read paths pages/api/v1/underlying-stats/players*.ts
  - Consumers: buildNstParityMetrics (all splits); nhlOnIceAttribution; nhlContextualFeatures (PP age); nhlPlayByPlayParser strength_state column
- **Audit context:**
  - Intent (Opus): tasks/TASKS/xg-model/docs/definitions-and-parity.md:208-211 (zero goalie digit -> EN, not ordinary EV/PP/SH); tasks/TASKS/xg-model/nhl-api-foundation/strength-mapping.md (canonical situationCode mapping)
  - External references: Natural Stat Trick strength definitions (5v5 = both goalies in; EV = 5v5+4v4+3v3; PP/PK exclude empty-net; all situations includes EN)
  - Fixtures/test data: `tasks/TASKS/xg-model/nhl-api-foundation/strength-mapping.md (examples 1331, 0651, 1560)`; `tasks/artifacts/nhl-pbp-recon-2026-03-30.json`
  - Tests: `web/lib/supabase/Upserts/nhlNstParityMetrics.test.ts`; `web/lib/supabase/Upserts/nhlPlayByPlayParser.test.ts`; `web/lib/supabase/Upserts/nhlStrengthState.test.ts`
- **Leads (not audited):**
  - (opus) any pulled goalie maps to 'EN', so EV/PP/PK splits exclude all extra-attacker time (incl. delayed-penalty 6v5); matches NST EV but differs from NHL.com EV which counts by skater strength
  - (opus) strength_exact is formatted away-first ('awayvhome'), whereas NST/most sites report team-relative (e.g. 5v4 from PP team view); COMMON_MANPOWER_STATES in nhlEventInclusion uses the same away-first string
  - (opus) 'ev' requires equal skaters so 4v4 and 3v3 OT are EV (consistent with NST)

## M-NST-033 NST team count aggregation (CF%, xGF%, HDCF%, SCF%, SH%, SV%, PDO)

- **Match:** Opus only; Opus NST-032; Codex —
- **Purpose:** Aggregate dated NST team rows into season/period team shares via ratio of sums.
- **Where:** `web/lib/stats/percentUnits.ts:107 (aggregateNstTeamCounts)`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: per game, 5v5 only; generation: current
- **Opus view (NST-032):**
  - Method: Exclude rows with gp==0; games = sum gp (null if any unknown). CF%/xGF%/HDCF%/SCF% = sum for / (sum for + sum against) as fractions; SH% = sum GF / sum SF; SV% = 1 - sum GA / sum SA; PDO = SH% + SV% (1.000 scale); xGF/game, xGA/game = sum / games.
  - Inputs/units: NST team per-date COUNTS (cf, ca, xgf, xga, hdcf, hdca, scf, sca, gf, ga, sf, sa), gp, toi in SECONDS; strength set by caller's table (5v5 in TeamDashboard); sources: NST team per-date tables written by pages/api/Teams/nst-team-stats.ts (e.g. 5v5 rows)
  - Output scale: shares as FRACTIONS 0-1 (ratio of sums); SH%/SV% fractions; PDO on 1.000 scale; xGF/xGA per game; writes: —
  - Status: live — TeamDashboard.tsx:199/:494, AdvancedL10Metrics.tsx:187/:228 (L10/L5), GameStateAnalysis.tsx:65
  - Consumers: web/components/TeamDashboard/TeamDashboard.tsx:199 and :494 (5v5 season shares); web/components/TeamDashboard/AdvancedL10Metrics.tsx:187 and :228 (L10/L5); web/components/GameStateAnalysis/GameStateAnalysis.tsx:65
- **Audit context:**
  - Intent (Opus): web/lib/stats/percentUnits.ts:101-106 ('ratio of sums, never a mean of per-row percentages...'); TeamDashboard.tsx:491-492
  - External references: Natural Stat Trick team on-ice definitions; PDO = on-ice SH% + SV%
  - Fixtures/test data: `web/lib/stats/percentUnits.test.ts`; `web/components/TeamDashboard/AdvancedL10Metrics.test.tsx`
  - Tests: `web/components/TeamDashboard/AdvancedL10Metrics.test.tsx`; `web/lib/stats/percentUnits.test.ts`
- **Leads (not audited):**
  - (opus) PDO on 1.000 scale while NST displays PDO on ~100 scale - unit mismatch risk when compared to NST
  - (opus) strength state depends on caller's table (5v5 vs all); not enforced here
  - (opus) one missing count in any row nulls that metric for the whole sample

## M-NST-034 NHL-vs-legacy NST parity validation tolerances

- **Match:** Opus only; Opus NST-034; Codex —
- **Purpose:** Compare legacy NST gamelog rows to NHL-derived parity rows and classify mismatches for release.
- **Where:** `web/lib/supabase/Upserts/nhlXgValidation.ts:125 (tolerance constants)`; `web/lib/supabase/Upserts/nhlXgValidation.ts:281 (getToleranceForMetric)`; `web/lib/supabase/Upserts/nhlXgValidation.ts:446 (compareLegacyAndNhlParitySample)`; `web/lib/supabase/Upserts/nhlXgValidation.ts:564 (classifyParityMismatchForRelease)`
- **Tags (heuristic):** denominators: per 60; generation: current
- **Opus view (NST-034):**
  - Method: Exact metrics tolerance 1e-6; approximate metrics (xG, SC, HD/MD/LD, rush, rebound, gsaa, distances): pct/pdo/ipp 0.02, per-60/GAA/avg 0.25, xG 0.15, counts 1. Warnings for approximate drift; errors for exact drift unless family is on-ice (nst_gamelog_as_counts_oi/rates_oi), metric is toi, or an approved individual exact metric - then 'approved-exception'. XG ROLE: validation compares outputs only; xG metrics are 'close approximation' with absolute tolerance 0.15 goals and warnings never block release; no calibration check here (calibration lives in web/lib/xg/calibration.ts, excluded from this module).
  - Inputs/units: metric values in each table's native units (percent scale of legacy NST not confirmed); sources: nst_gamelog_* tables (legacy), parity output
  - Output scale: pass/warn/error per metric; release disposition counts; writes: —
  - Status: live (manual) — used only by scripts/run-nhl-xg-release-validation.ts; no route/cron
  - Consumers: scripts/run-nhl-xg-release-validation.ts
- **Audit context:**
  - Intent (Opus): tasks/TASKS/xg-model/release/prd/prd-xg-release-validation-and-exception-resolution.md (release validation and exception policy); tasks/TASKS/xg-model/tasks-nhl-api-xg-model.md:90 (NHL-derived correctness wins over NST on edge cases, divergences documented)
  - External references: Natural Stat Trick gamelog values
  - Fixtures/test data: `tasks/TASKS/xg-model/release/tasks-xg-release-exception-resolution.md`; `tasks/TASKS/xg-model/nhl-api-foundation/validation-checklist.md`; `tasks/TASKS/xg-model/nhl-api-foundation/metric-parity-map.md`
  - Tests: `web/lib/supabase/Upserts/nhlXgValidation.test.ts`
- **Leads (not audited):**
  - (opus) percent tolerance 0.02 is tiny if both sides are 0-100 and meaningless if legacy NST stores 0-1 - percent unit scale should be confirmed
  - (opus) every on-ice metric and TOI drift is auto-approved, so the gate cannot catch on-ice/TOI regressions
  - (opus) overlap: xG slice

